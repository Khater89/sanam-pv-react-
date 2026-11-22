'use client';
import { useState, useRef, useEffect } from 'react';
import * as RF from '@/lib/engine/roof';
import { detectRoof, orthogonalize } from '@/lib/engine/vision';
import { toRuby } from '@/lib/engine/sketchup';
import { OBJ_PRESETS, presetOf, guessKind, rectPts } from '@/lib/engine/objects';
import dynamic from 'next/dynamic';
const load3D = () => import('./Roof3D');
const Roof3D = dynamic(load3D, { ssr: false, loading: () => <div className="rf-3d mute" style={{ height: 520, display: 'grid', placeItems: 'center' }}>جاري تحميل العرض الثلاثي الأبعاد…</div> });
import { fmt } from '@/lib/controller';
import { Component } from 'react';

/* any 3D failure (old page after a site update → missing file, no WebGL, a bad shape) stays inside this box instead of taking the whole page down */
class Safe3D extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { try { console.warn('3D view failed:', err); } catch (e) { } }
  render() {
    const e = this.state.err; if (!e) return this.props.children;
    const m = String((e && (e.message || e.name)) || e), chunk = /chunk|loading.*(module|css)|failed to fetch|importing a module/i.test(m), gl = /webgl/i.test(m);
    return <div className="rf-3d" style={{ height: 520, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}><div>
      <div className="warn" style={{ marginBottom: 12 }}>{chunk ? 'الموقع انعمله تحديث وهاي الصفحة مفتوحة من قبل التحديث، فملف العرض الثلاثي الأبعاد القديم ما عاد موجود. احفظ المشروع وحدّث الصفحة.' : gl ? 'المتصفح ما شغّل WebGL (كرت الشاشة أو تسريع الرسوم مطفي)، فالعرض الثلاثي الأبعاد مش متاح هون. الرسمة 2D وكل الحسابات شغالة عادي.' : 'صار خطأ بالعرض الثلاثي الأبعاد. شغلك ما راح، ارجع للرسمة 2D أو جرّب مرة ثانية.'}</div>
      <div className="mute" style={{ fontSize: 12, marginBottom: 12, direction: 'ltr' }} translate="no">{m.slice(0, 160)}</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {chunk && <button className="on" onClick={async () => { try { await this.props.onSave(); } catch (x) { } location.reload(); }}>💾 احفظ وحدّث الصفحة</button>}
        {!chunk && <button onClick={() => this.setState({ err: null })}>↻ جرّب مرة ثانية</button>}
        <button onClick={() => { this.setState({ err: null }); this.props.onBack(); }}>🗺 رجوع للرسمة 2D</button>
      </div></div></div>;
  }
}

const MODES_AZ = [['pan', '✋ تحريك'], ['wand', '🪄 كشف السطح من الصورة'], ['roof', '⬠ رسم السطح'], ['bld', '🏢 جسم/غرفة'], ['tree', '🌳 شجرة'], ['edge', '📐 حافة الاتجاه'], ['scale', '📏 مقياس الرسم'], ['move', '↔ تعديل/إضافة نقاط'], ['del', '🗑 حذف']];
const MODES_SH = [['pan', '✋ تحريك'], ['bld', '🏢 مبنى/غرفة'], ['tree', '🌳 شجرة'], ['drop', '⬇ نزول الكوابل (الدرج)'], ['inv', '🔌 مكان الانفيرتر'], ['move', '↔ تعديل/إضافة نقاط'], ['del', '🗑 حذف']];
const M_LAT = 110574, mLon = lat => 111320 * Math.cos(lat * Math.PI / 180);

function tiles(lat0, lon0, view, z) { // Esri World Imagery tiles covering the view (world metres)
  if (lat0 == null || lon0 == null) return []; const n = Math.pow(2, z), toLon = x => lon0 + x / mLon(lat0), toLat = y => lat0 + y / M_LAT;
  const tx = lon => Math.floor((lon + 180) / 360 * n), ty = lat => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); };
  const x0 = tx(toLon(view[0])), x1 = tx(toLon(view[2])), y0 = ty(toLat(view[3])), y1 = ty(toLat(view[1])), out = [];
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) return [];
  const lonOf = x => x / n * 360 - 180, latOf = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ k: z + '/' + y + '/' + x, url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x,
    x: (lonOf(x) - lon0) * mLon(lat0), y: (latOf(y) - lat0) * M_LAT, w: (lonOf(x + 1) - lonOf(x)) * mLon(lat0), h: (latOf(y) - latOf(y + 1)) * M_LAT });
  return out; }


/* image placement: centre at world (0,0), I = { w, h, mpp, rot (image "up" azimuth, ° clockwise from North) } */
const imgToW = (I, px, py) => { const r = (I.rot || 0) * Math.PI / 180, dx = (px - I.w / 2) * I.mpp, dy = -(py - I.h / 2) * I.mpp; return [dx * Math.cos(r) + dy * Math.sin(r), -dx * Math.sin(r) + dy * Math.cos(r)]; };
const wToImg = (I, x, y) => { const r = (I.rot || 0) * Math.PI / 180, dx = x * Math.cos(r) - y * Math.sin(r), dy = x * Math.sin(r) + y * Math.cos(r); return [dx / I.mpp + I.w / 2, -dy / I.mpp + I.h / 2]; };
/* sun position (solar time): elevation and azimuth from South, West + (PVsyst convention) */
const sunAt = (lat, doy, hr) => { const d = 23.45 * Math.sin(2 * Math.PI * (284 + doy) / 365) * Math.PI / 180, f = lat * Math.PI / 180, w = 15 * (hr - 12) * Math.PI / 180;
  const se = Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(w), el = Math.asin(se); return { el: el * 180 / Math.PI, az: Math.atan2(Math.sin(w), Math.cos(w) * Math.sin(f) - Math.tan(d) * Math.cos(f)) * 180 / Math.PI }; };
const hull = P => { const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
const cen = P => [P.reduce((a, q) => a + q[0], 0) / P.length, P.reduce((a, q) => a + q[1], 0) / P.length];
/* obstacle heights: "roof" = height above your roof; "ground" = height from the ground, minus your building height */
const fixH = n => { const hb = +n.hb || 0; (n.bld || []).forEach(b => { if (b.ref === 'ground' && b.hg !== '' && b.hg != null) b.h = Math.max(0, Math.round((+b.hg - hb) * 100) / 100); });
  (n.trees || []).forEach(t => { if (t.ref === 'ground' && t.hg !== '' && t.hg != null) t.h = Math.max(0, Math.round((+t.hg - hb) * 100) / 100); }); };
const loadImg = (src, cors) => new Promise((res, rej) => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = src; });
function downscale(file, max) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => loadImg(fr.result).then(im => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
  c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res({ src: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height, ow: im.width }); }).catch(rej); fr.onerror = rej; fr.readAsDataURL(file); }); }

export default function Roof({ ctl, part }) {
  const AZ = part !== 'shade', MODES = AZ ? MODES_AZ : MODES_SH;
  const R0 = ctl.roof() || RF.blankRoof(), [mode, setMode] = useState(AZ && R0.pts.length < 3 ? 'roof' : 'pan'), [draft, setDraft] = useState([]), [hover, setHover] = useState(null);
  const [rcMsg, setRcMsg] = useState(''), [tool3, setTool3] = useState('select'), [gimg, setGimg] = useState(true), [pick, setPick] = useState(null), nPrev = useRef(null), [nDelta, setNDelta] = useState(0), [view3, setView3] = useState(false), [sh, setSh] = useState({ on: 1, doy: 355, hr: 10 }), [full, setFull] = useState(false), [v, setV] = useState({ cx: 0, cy: 0, s: 12 }), [sel, setSel] = useState(null), [rect, setRect] = useState({ a: 20, b: 12, r: 0 }), [shd, setShd] = useState(null), [busy, setBusy] = useState(false);
  const svg = useRef(null), drag = useRef(null), Wpx = 900, Hpx = 520, R = R0, L = R.lay;
  const I = ctl.f.roofImg && R.img ? R.img : null, [sc, setSc] = useState([]), [scD, setScD] = useState(''), [tol, setTol] = useState(32), [vmsg, setVmsg] = useState('');
  const lat = ctl.num('lat'), lon = ctl.num('lon'), tilt = ctl.num('tilt');
  const commit = fn => { const n = JSON.parse(JSON.stringify(R)); fn(n); ctl.roofSet(n); setShd(null); };
  const Y = AZ ? null : ctl.roofLayout(R), Yv = Y || (R.pts.length > 2 ? ctl.roofLayout(R) : null);
  useEffect(() => { const t = setTimeout(() => { load3D().catch(() => { }); }, 1200); return () => clearTimeout(t); }, []); // fetch the 3D file with this page version, so a later site update can't break it
  useEffect(() => { const n = Yv ? Yv.n : null; if (nPrev.current != null && n != null && n !== nPrev.current) setNDelta(n - nPrev.current); nPrev.current = n; }, [Yv && Yv.n]); // eslint-disable-line
  /* near-shading loss of this drawing (updates when the roof, objects, tilt or structure height change) */
  const [sloss, setSloss] = useState(null), lkey = Yv && Yv.n ? [ctl.f.roof, ctl.f.tilt, ctl.f.ns, Yv.n].join('|') : '';
  useEffect(() => { if (!lkey) { setSloss(null); return; } setSloss('…'); const t = setTimeout(() => { ctl.shadeLoss().then(x => setSloss(x || null)).catch(e => setSloss({ err: e.message })); }, 600); return () => clearTimeout(t); }, [lkey]); // eslint-disable-line
  useEffect(() => { if (!AZ && Y && Y.n && !shd) calc(); }, [ctl.f.roof, ctl.f.tilt, Y && Y.n]); // eslint-disable-line
  useEffect(() => { if (R.pts.length > 2) { const b = R.pts.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    setV({ cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, s: Math.min(Wpx / (b[2] - b[0] + 8), Hpx / (b[3] - b[1] + 8)) }); } }, []); // eslint-disable-line

  const SX = x => Wpx / 2 + (x - v.cx) * v.s, SY = y => Hpx / 2 - (y - v.cy) * v.s;
  const toW = e => { const r = svg.current.getBoundingClientRect(), px = (e.clientX - r.left) * Wpx / r.width, py = (e.clientY - r.top) * Hpx / r.height;
    return [Math.round(((px - Wpx / 2) / v.s + v.cx) * 20) / 20, Math.round((-(py - Hpx / 2) / v.s + v.cy) * 20) / 20]; };
  const ortho = (p, e) => { const d = draft; if (!e.shiftKey || !d.length) return p; const q = d[d.length - 1]; return Math.abs(p[0] - q[0]) > Math.abs(p[1] - q[1]) ? [p[0], q[1]] : [q[0], p[1]]; };
  const nearVert = (p, tol) => { let best = null; const t = tol / v.s, chk = (arr, kind, i) => arr.forEach((q, j) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < t && (!best || d < best.d)) best = { kind, i, j, d }; });
    chk(R.pts, 'roof', 0); R.bld.forEach((b, i) => chk(b.pts, 'bld', i)); R.trees.forEach((t, i) => chk([[t.x, t.y]], 'tree', i)); return best; };

  const nearEdge = p => { const t = 10 / v.s; let best = null; const chk = arr => arr.forEach((a, j) => { const b = arr[(j + 1) % arr.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; let u = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0; u = Math.max(0, Math.min(1, u));
      const d = Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy); if (d < t && (!best || d < best.d)) best = { a, b, d }; }); if (R.pts.length > 2) chk(R.pts); R.bld.forEach(b => chk(b.pts)); return best; };
  /* objects: find, move, edit (shared by the 2D editor, the 3D view and the side panel) */
  const objAt = p => { for (let i = R.trees.length - 1; i >= 0; i--) { const t = R.trees[i]; if (Math.hypot(t.x - p[0], t.y - p[1]) < Math.max(+t.r || 1, 8 / v.s)) return ['tree', i]; }
    for (let i = R.bld.length - 1; i >= 0; i--) if (RF.inside(R.bld[i].pts, p[0], p[1])) return ['bld', i]; return null; };
  const shift = (n, kind, i, dx, dy) => { if (kind === 'tree') { n.trees[i].x = Math.round((+n.trees[i].x + dx) * 100) / 100; n.trees[i].y = Math.round((+n.trees[i].y + dy) * 100) / 100; return; }
    const b = n.bld[i]; b.pts = b.pts.map(q => [Math.round((q[0] + dx) * 1000) / 1000, Math.round((q[1] + dy) * 1000) / 1000]); if (b.rect) { b.rect.cx += dx; b.rect.cy += dy; } };
  const moveObj = (kind, i, dx, dy) => commit(n => { shift(n, kind, i, dx, dy); const b = kind === 'bld' ? n.bld[i] : null; // snap to the 25 cm roof grid
    if (b && b.rect) { const sx = Math.round(b.rect.cx * 4) / 4 - b.rect.cx, sy = Math.round(b.rect.cy * 4) / 4 - b.rect.cy; b.rect.cx += sx; b.rect.cy += sy; b.pts = rectPts(b.rect); } });
  /* SketchUp-style: draw the footprint, push/pull heights, rotate the building to its true orientation */
  const southEdge = P => { let bi = 0, ba = 1e9; P.forEach((_, i) => { const z = Math.abs(RF.edgeAz(P, i)); if (z < ba) { ba = z; bi = i; } }); return bi; };
  const onDraw = pts => { commit(n => { n.pts = pts.map(p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]); if (!(+n.hb > 0)) n.hb = 3; n.lay.edge = southEdge(n.pts); n.lay.azMode = 'edge'; fixH(n); });
    setTool3('push'); setVmsg('✓ انرسمت حدود المبنى (' + fmt(Math.abs(RF.area(pts)), 1) + ' m²). هلق ⬆ اسحب سطح المبنى لفوق لترفع ارتفاعه، وبعدين ⟳ دوّره ليطابق اتجاهه الحقيقي.'); };
  const onPush = (k, i, h) => commit(n => { if (k === 'building') { n.hb = h; fixH(n); return; } const o = k === 'tree' ? n.trees[i] : n.bld[i]; if (!o) return;
    if (o.ref === 'ground') { o.hg = Math.round((h + (+n.hb || 0)) * 10) / 10; o.h = h; } else o.h = h; o.hAuto = false; });
  const rotAll = deg => commit(n => { if (n.pts.length < 3) return; const c = cen(n.pts), a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), r = q => { const dx = q[0] - c[0], dy = q[1] - c[1]; return [Math.round((c[0] + dx * ca + dy * sa) * 1000) / 1000, Math.round((c[1] - dx * sa + dy * ca) * 1000) / 1000]; };
    n.pts = n.pts.map(r); n.bld.forEach(b => { if (b.rect) { const q = r([b.rect.cx, b.rect.cy]); b.rect.cx = q[0]; b.rect.cy = q[1]; b.rect.rot = Math.round(((+b.rect.rot || 0) + deg) * 10) / 10; b.pts = rectPts(b.rect); } else b.pts = b.pts.map(r); });
    n.trees.forEach(t => { const q = r([t.x, t.y]); t.x = q[0]; t.y = q[1]; }); if (n.lay.invPos) n.lay.invPos = r(n.lay.invPos); if (n.lay.dbPos) n.lay.dbPos = r(n.lay.dbPos); });
  const onModule = k => commit(n => { const off = new Set(n.lay.off || []); if (off.has(k)) off.delete(k); else off.add(k); n.lay.off = [...off]; });
  const addPicked = () => { const rows = Object.entries(pick || {}).filter(([, x]) => x.on && +x.q > 0); if (!rows.length) return;
    const b = R.pts.length > 2 ? R.pts.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[0]), Math.max(a[3], q[1])], [1e9, 1e9, -1e9, -1e9]) : [v.cx - 5, v.cy - 5, v.cx + 5, v.cy + 5];
    let x = b[2] + 2, y = b[3], col = 0, made = 0;
    commit(n => { rows.forEach(([k, o]) => { const pr = presetOf(k); for (let i = 0; i < +o.q; i++) { const w = +o.w || pr.w, l = +o.l || pr.l, r = { cx: Math.round((x + w / 2) * 4) / 4, cy: Math.round((y - l / 2) * 4) / 4, w, l, rot: 0 };
      n.bld.push({ hAuto: true, name: pr.name + (+o.q > 1 ? ' ' + (i + 1) : ''), kind: k, rect: r, pts: rectPts(r), h: +o.h || pr.h, ref: 'roof', hg: '' }); made++;
      y -= l + 1; if (++col >= 4) { col = 0; y = b[3]; x += 5; } } }); fixH(n); });
    setPick(null); setVmsg('➕ انضاف ' + made + ' جسم جنب المبنى. اسحب كل واحد لمكانه على السطح (بيلتصق على شبكة 25 cm).'); };
  const setKind = (n, i, k) => { const b = n.bld[i], pr = presetOf(k); b.kind = k; if (!pr) return; b.h = pr.h; if (pr.ref === 'ground') { b.ref = 'ground'; b.hg = Math.round(((+n.hb || 0) + pr.h) * 100) / 100; } else { b.ref = 'roof'; b.hg = ''; } fixH(n); };
  const addPreset = k => { const pr = presetOf(k), c0 = R.pts.length > 2 ? cen(R.pts) : [v.cx, v.cy], nb = R.bld.length, c = [c0[0] + ((nb % 3) - 1) * 3.5, c0[1] + ((Math.floor(nb / 3) % 3) - 1) * 3.5], r = { cx: c[0], cy: c[1], w: pr.w, l: pr.l, rot: 0 };
    if (pr.ref === 'ground') { const b = R.pts.length > 2 ? R.pts.reduce((a, q) => Math.max(a, q[0]), -1e9) : c[0]; r.cx = b + pr.w / 2 + 4; }
    commit(n => { n.bld.push({ hAuto: true, name: pr.name, kind: k, rect: r, pts: rectPts(r), h: pr.h, ref: pr.ref || 'roof', hg: pr.ref === 'ground' ? Math.round(((+n.hb || 0) + pr.h) * 100) / 100 : '' }); fixH(n); setSel(['bld', n.bld.length - 1]); });
    setVmsg('➕ انضاف "' + pr.name + '" بنص السطح بارتفاع تقديري ' + pr.h + ' m. اسحبه لمكانه (بالـ 3D أو بوضع ↔ بالرسمة)، وعدّل أبعاده وارتفاعه من لوحة الجسم.'); };
  const roofRot = () => { if (R.pts.length < 3) return 0; const i = Math.min(L.edge || 0, R.pts.length - 1), a = R.pts[i], b = R.pts[(i + 1) % R.pts.length]; return -Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; };
  const [brect, setBrect] = useState(null);
  const rectFrom = (p0, p1) => { const rot = roofRot(), a = rot * Math.PI / 180, c = Math.cos(a), s2 = Math.sin(a), loc = p => [p[0] * c - p[1] * s2, p[0] * s2 + p[1] * c];
    const A = loc(p0), B = loc(p1), m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], cx = m[0] * c + m[1] * s2, cy = -m[0] * s2 + m[1] * c;
    return { cx: Math.round(cx * 100) / 100, cy: Math.round(cy * 100) / 100, w: Math.max(0.2, Math.round(Math.abs(B[0] - A[0]) * 100) / 100), l: Math.max(0.2, Math.round(Math.abs(B[1] - A[1]) * 100) / 100), rot: Math.round(rot * 10) / 10 }; };
  const down = e => { e.currentTarget.setPointerCapture(e.pointerId); const p = toW(e); const vt = mode === 'move' ? nearVert(p, 12) : null, ob = mode === 'move' && !vt ? objAt(p) : null; drag.current = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy, moved: false, vert: vt, obj: ob, p0: p, R0: ob ? JSON.parse(JSON.stringify(R)) : null, box: mode === 'bld' && !draft.length }; };
  const move = e => { const p = toW(e); setHover(ortho(p, e)); const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.hypot(dx, dy) > 4) d.moved = true; if (!d.moved) return;
    if (d.box) { setBrect(rectFrom(d.p0, p)); return; }
    if (d.obj) { const n = JSON.parse(JSON.stringify(d.R0)); shift(n, d.obj[0], d.obj[1], p[0] - d.p0[0], p[1] - d.p0[1]); ctl.roofSet(n); setShd(null); return; }
    if (d.vert) { const V = d.vert; commit(n => { if (V.kind === 'roof') n.pts[V.j] = p; else if (V.kind === 'bld') n.bld[V.i].pts[V.j] = p; else { n.trees[V.i].x = p[0]; n.trees[V.i].y = p[1]; } }); return; }
    const r = svg.current.getBoundingClientRect(), k = Wpx / r.width; setV(o => ({ ...o, cx: d.cx - dx * k / o.s, cy: d.cy + dy * k / o.s })); };
  const up = e => { const d = drag.current; drag.current = null; if (d && d.obj) setSel(d.obj);
    if (d && d.box && d.moved) { const r = rectFrom(d.p0, toW(e)); setBrect(null); if (r.w < 0.3 || r.l < 0.3) return;
      commit(n => { const inR = n.pts.length > 2 && RF.inside(n.pts, r.cx, r.cy); n.bld.push({ name: inR ? 'جسم ' + (n.bld.length + 1) : 'مبنى مجاور ' + (n.bld.length + 1), kind: '', rect: r, pts: rectPts(r), h: inR ? 1.5 : 3, ref: inR ? 'roof' : 'ground', hg: inR ? '' : (+n.hb || 0) + 3, hAuto: true }); fixH(n); setSel(['bld', n.bld.length - 1]); });
      setVmsg('▭ انضاف جسم ' + fmt(r.w, 2) + ' × ' + fmt(r.l, 2) + ' m. اختار نوعه من لوحة الجسم تحت (الارتفاع بيتعبّى لحاله)، أو اسحب مستطيل ثاني.'); return; }
    if (!d || d.moved) return; const p = ortho(toW(e), e);
    if (mode === 'pan') { setSel(objAt(p)); return; }
    if (mode === 'roof' || mode === 'bld') { if (draft.length >= 3 && Math.hypot(p[0] - draft[0][0], p[1] - draft[0][1]) * v.s < 12) return finish(); setDraft(draft.concat([p])); }
    else if (mode === 'tree') { commit(n => { const inR = n.pts.length > 2 && RF.inside(n.pts, p[0], p[1]); n.trees.push({ x: p[0], y: p[1], r: 2, h: 5, tr: 20, ref: inR ? 'roof' : 'ground', hg: inR ? '' : (+n.hb || 0) + 5 }); fixH(n); }); setVmsg('🌳 انضافت شجرة. عدّل ارتفاعها ونصف قطرها بجدول الأجسام والارتفاعات تحت.'); }
    else if (mode === 'inv') commit(n => { n.lay.invPos = p; });
    else if (mode === 'scale') { const vt = nearVert(p, 12), q = vt ? (vt.kind === 'roof' ? R.pts[vt.j] : vt.kind === 'bld' ? R.bld[vt.i].pts[vt.j] : p) : p;
      if (!vt && sc.length !== 1) { const e = nearEdge(p); if (e) { setSc([e.a, e.b]); return; } }
      setSc(sc.length >= 2 ? [q] : sc.concat([q])); }
    else if (mode === 'drop') commit(n => { n.lay.dbPos = p; });
    else if (mode === 'del') delAt(p);
    else if (mode === 'move') insertAt(p);
    else if (mode === 'wand') wand(p);
    else if (mode === 'edge' && R.pts.length > 2) { let bi = 0, bd = 1e9; R.pts.forEach((a, i) => { const b = R.pts[(i + 1) % R.pts.length], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dd = Math.hypot(m[0] - p[0], m[1] - p[1]); if (dd < bd) { bd = dd; bi = i; } });
      commit(n => { n.lay.edge = bi; n.lay.azMode = 'edge'; }); } };
  const finish = () => { if (draft.length < 3) return; if (mode === 'roof') commit(n => { n.pts = draft; }); else commit(n => { const c = cen(draft), inR = n.pts.length > 2 && RF.inside(n.pts, c[0], c[1]); n.bld.push({ ref: inR ? 'roof' : 'ground', hg: inR ? '' : (+n.hb || 0) + 3, pts: draft, h: 3, name: (inR ? 'جسم ' : 'مبنى مجاور ') + (n.bld.length + 1) }); fixH(n); }); if (mode === 'roof' && I) setVmsg('✓ انحدد السطح: الأداة بتستعمل اللي جوّا الخط بس، والباقي من الصورة بيتعتّم. هلق ارسم الأجسام والمباني المجاورة وحط ارتفاعاتها.'); if (mode === 'bld') setVmsg('🏢 انضاف. اكتب ارتفاعه بجدول الأجسام والارتفاعات تحت.'); setDraft([]); setMode('pan'); };
  const wheel = e => { e.preventDefault(); const p = toW(e), k = e.deltaY < 0 ? 1.15 : 1 / 1.15; setV(o => ({ s: Math.max(1, Math.min(200, o.s * k)), cx: p[0] - (p[0] - o.cx) / k, cy: p[1] - (p[1] - o.cy) / k })); };
  useEffect(() => { const el = svg.current; if (!el) return; el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel); });
  useEffect(() => { const k = e => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') setDraft([]); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); });

  const view = [v.cx - Wpx / 2 / v.s, v.cy - Hpx / 2 / v.s, v.cx + Wpx / 2 / v.s, v.cy + Hpx / 2 / v.s], z = v.s > 6 ? 19 : v.s > 3 ? 18 : 17;
  const T = R.map && R.map.on ? tiles(lat, lon, view, z) : [], pp = a => a.map(p => SX(p[0]) + ',' + SY(p[1])).join(' ');
  const quickRect = () => { const a = +rect.a / 2, b = +rect.b / 2, r = (+rect.r || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    commit(n => { n.pts = [[-a, -b], [a, -b], [a, b], [-a, b]].map(([x, y]) => [Math.round((x * c + y * s) * 100) / 100, Math.round((-x * s + y * c) * 100) / 100]); n.lay.edge = 0; });
    setV({ cx: 0, cy: 0, s: Math.min(Wpx / (+rect.a + 8), Hpx / (+rect.b + 8)) }); };
  /* delete: a vertex (roof keeps ≥ 3), an object, a tree, the inverter / drop markers */
  const delAt = p => { const t = 12 / v.s, vt = nearVert(p, 12);
    if (vt && vt.kind === 'roof' && R.pts.length > 3) return commit(n => { n.pts.splice(vt.j, 1); n.lay.edge = Math.min(n.lay.edge || 0, n.pts.length - 1); });
    if (vt && vt.kind === 'bld' && R.bld[vt.i].pts.length > 3) return commit(n => { n.bld[vt.i].pts.splice(vt.j, 1); });
    const ti = R.trees.findIndex(tr => Math.hypot(tr.x - p[0], tr.y - p[1]) < Math.max(+tr.r, t)); if (ti >= 0) return commit(n => { n.trees.splice(ti, 1); });
    const bi = R.bld.findIndex(b => RF.inside(b.pts, p[0], p[1])); if (bi >= 0) return commit(n => { n.bld.splice(bi, 1); });
    if (L.invPos && Math.hypot(L.invPos[0] - p[0], L.invPos[1] - p[1]) < 2 * t) return commit(n => { delete n.lay.invPos; });
    if (L.dbPos && Math.hypot(L.dbPos[0] - p[0], L.dbPos[1] - p[1]) < 2 * t) return commit(n => { delete n.lay.dbPos; });
    setVmsg('اضغط على نقطة زاوية، أو جوّا جسم أو شجرة لحذفها.'); };
  /* add a vertex on the nearest edge (roof or object) when clicking on it in "move" mode */
  const insertAt = p => { const t = 10 / v.s, segD = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; let u = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0; u = Math.max(0, Math.min(1, u)); return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy); };
    let best = null; const chk = (arr, kind, i) => arr.forEach((a, j) => { const d = segD(a, arr[(j + 1) % arr.length]); if (d < t && (!best || d < best.d)) best = { kind, i, j, d }; });
    chk(R.pts, 'roof', 0); R.bld.forEach((b, i) => chk(b.pts, 'bld', i)); if (!best) return;
    commit(n => { const arr = best.kind === 'roof' ? n.pts : n.bld[best.i].pts; arr.splice(best.j + 1, 0, p); }); };
  const restart = () => { if (!confirm('بدك تمسح الصورة والسطح وكل الأجسام وتبدأ من جديد؟')) return; ctl.set('roofImg', ''); commit(n => { delete n.img; n.pts = []; n.bld = []; n.trees = []; delete n.lay.invPos; delete n.lay.dbPos; }); setSc([]); setVmsg(''); setMode('roof'); };
  /* Google Maps scale: metres per pixel = 156543.03392 × cos(lat) / 2^zoom / devicePixelRatio */
  const [gz, setGz] = useState(''), [gdpr, setGdpr] = useState(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1), [glink, setGlink] = useState('');
  const gLat = () => lat || 32;
  const applyGoogle = (z, latX) => { if (!I || !(z > 0)) return; const mpp = 156543.03392 * Math.cos((latX || gLat()) * Math.PI / 180) / Math.pow(2, z) / (+gdpr || 1) * (I.k0 || 1), k = mpp / I.mpp;
    commit(n => { n.img.mpp = mpp; n.img.calOK = 1; n.pts = n.pts.map(q => [q[0] * k, q[1] * k]); n.bld = n.bld.map(b => ({ ...b, pts: b.pts.map(q => [q[0] * k, q[1] * k]) })); n.trees = n.trees.map(tr => ({ ...tr, x: tr.x * k, y: tr.y * k, r: tr.r * k })); });
    setV(o => ({ cx: o.cx * k, cy: o.cy * k, s: o.s / k })); setVmsg('✓ مقياس Google Maps: zoom ' + z + ' → ' + fmt(mpp * 100, 2) + ' cm/px. تأكد بقياس حافة معروفة إذا بدك دقة أعلى.'); };
  const parseLink = () => { const m = glink.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+(?:\.\d+)?)(z|m)/); if (!m) return setVmsg('ما لقيت @lat,lng,zoom بالرابط. انسخ الرابط من شريط العنوان بعد ما تفتح الموقع على Google Maps.');
    const la = +m[1], lo = +m[2]; if (!lat) { ctl.input('lat', la); ctl.input('lon', lo); }
    if (m[4] === 'm') { setMode('scale'); return setVmsg('هالرابط من عرض القمر الصناعي (فيه m بدل z) وما بيعطي مقياس دقيق. أخذت الإحداثيات بس. حدّد المقياس بنقطتين: اضغط على حافة معروفة واكتب طولها الحقيقي.'); }
    const z = +m[3]; setGz(z.toFixed(2)); applyGoogle(z, la); };
  /* AI scan (OpenAI vision via the server route) */
  const [aiBusy, setAiBusy] = useState(false);
  /* 🔬 analysis option: (1) the whole image → building roof outline, parapet, scale estimate, neighbours; (2) a crop of that roof → every object
     with its type; then the roof is redrawn clean with its dimensions and area, objects as editable boxes with heights from their type */
  const [ana, setAna] = useState(null), [anaBusy, setAnaBusy] = useState('');
  const analyze = async () => { if (!I) return setVmsg('ارفع صورة الموقع أول.');
    try { const im = await loadImg(ctl.f.roofImg), cal = !!(R.cal || I.calOK), toCanvas = (x0, y0, bw, bh, max) => { const k = Math.min(1, max / Math.max(bw, bh)), c = document.createElement('canvas'); c.width = Math.round(bw * k); c.height = Math.round(bh * k);
        const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, x0, y0, bw, bh, 0, 0, c.width, c.height); return { c, k }; };
      const post = body => fetch('/api/roof-analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json());
      setAnaBusy('1/2 بحدد المبنى وسطحه…'); const A = toCanvas(0, 0, I.w, I.h, 1280);
      const r1 = await post({ step: 'roof', image: A.c.toDataURL('image/jpeg', 0.9), w: A.c.width, h: A.c.height, mpp: cal ? I.mpp / A.k : 0 }); if (r1.error) throw new Error(r1.error);
      if (!r1.found || r1.roof.length < 3) throw new Error('ما قدرت أميّز سطح مبنى واضح بالصورة.' + (r1.notes ? ' ' + r1.notes : ''));
      let rp = r1.roof.map(([x, y]) => [x * I.w, y * I.h]); rp = orthogonalize(rp, 12).P;
      // crop of the roof only, enlarged, for the objects
      const bx = rp.reduce((a, q) => [Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.max(a[2], q[0]), Math.max(a[3], q[1])], [1e9, 1e9, -1e9, -1e9]), pad = 0.06 * Math.max(bx[2] - bx[0], bx[3] - bx[1]);
      const x0 = Math.max(0, bx[0] - pad), y0 = Math.max(0, bx[1] - pad), bw = Math.min(I.w, bx[2] + pad) - x0, bh = Math.min(I.h, bx[3] + pad) - y0;
      setAnaBusy('2/2 بحلل الأجسام على السطح…'); const B = toCanvas(x0, y0, bw, bh, 1024); const up = Math.max(1, 1024 / Math.max(bw, bh)); if (up > 1) { const c2 = document.createElement('canvas'); c2.width = Math.round(bw * up); c2.height = Math.round(bh * up); const g2 = c2.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(im, x0, y0, bw, bh, 0, 0, c2.width, c2.height); B.c = c2; }
      const r2 = await post({ step: 'objects', image: B.c.toDataURL('image/jpeg', 0.92), w: B.c.width, h: B.c.height }); if (r2.error) throw new Error(r2.error);
      // scale: the user's calibration, else the water tanks (one tank ≈ 1.25 m across — most reliable on Jordanian roofs), else the AI's estimate
      const tankPx = r2.tank_px > 0 ? r2.tank_px * bw / B.c.width : 0, mTank = tankPx >= 3 ? 1.25 / tankPx : 0, mAI = r1.mpp > 0 ? r1.mpp * A.k : 0;
      const mpp = cal ? I.mpp : mTank || mAI || I.mpp, basis = cal ? 'معاير' : mTank ? 'من قطر الخزان (' + fmt(tankPx, 1) + ' px = 1.25 m)' : r1.mpp_basis;
      const Ic = { ...I, mpp }, W = (x, y) => imgToW(Ic, x, y).map(v => Math.round(v * 100) / 100), roofW = rp.map(([x, y]) => W(x, y));
      const hb = +R.hb > 0 ? +R.hb : r1.floors > 0 ? Math.round(r1.floors * 3.2 * 10) / 10 : '';
      const objs = r2.objects.map(o => { const c = W(x0 + o.cx * bw, y0 + o.cy * bh), pr = presetOf(o.kind), rect = { cx: c[0], cy: c[1], w: Math.max(0.3, Math.round(o.w * bw * mpp * 100) / 100), l: Math.max(0.3, Math.round(o.l * bh * mpp * 100) / 100), rot: Math.round(((o.angle || 0) + (I.rot || 0)) * 10) / 10 };
        return { name: o.name || (pr ? pr.name : 'جسم'), kind: pr ? o.kind : '', rect, pts: rectPts(rect), h: pr ? pr.h : (o.h || 1.5), ref: 'roof', hg: '', hAuto: true, conf: o.conf, ai: 1, block: pr && pr.block ? true : undefined }; })
        .filter(o => RF.inside(roofW, o.rect.cx, o.rect.cy));
      const nbs = (r1.neighbours || []).map((nb, i) => { const pts = orthogonalize(nb.poly.map(([x, y]) => [x * I.w, y * I.h]), 12).P.map(([x, y]) => W(x, y)), hg = nb.floors > 0 ? Math.round(nb.floors * 3.2 * 10) / 10 : (+hb || 0) + 3;
        return { name: 'عمارة مجاورة ' + (i + 1) + (nb.floors ? ' (' + nb.floors + ' طوابق)' : ''), kind: 'neighbour', pts, ref: 'ground', hg, h: Math.max(0, Math.round((hg - (+hb || 0)) * 100) / 100), hAuto: true, ai: 1 }; });
      const wid = Math.max(...roofW.map(p => p[0])) - Math.min(...roofW.map(p => p[0])), dep = Math.max(...roofW.map(p => p[1])) - Math.min(...roofW.map(p => p[1])), odd = wid > 120 || dep > 120 || wid < 4 || dep < 4;
      setAna({ roof: roofW, objs, nbs, hp: r1.parapet_m, hb, mpp, cal, odd, size: [wid, dep], mppAI: mAI, basis, floors: r1.floors, notes: [r1.notes, r2.notes].filter(Boolean).join(' · ') }); setAnaBusy('');
    } catch (e) { setAnaBusy(''); setVmsg('🔬 ' + e.message); } };
  const applyAna = () => { const a = ana; if (!a) return; commit(n => { if (n.img) { n.img.mpp = a.mpp; if (!a.cal) n.img.calOK = 0; } n.pts = a.roof; n.bld = a.objs.concat(a.nbs).map(({ conf, ...o }) => o); n.trees = n.trees || [];
      if (a.hp > 0) n.hp = a.hp; if (a.hb !== '' && !(+n.hb > 0)) n.hb = a.hb; let bi = 0, ba = 1e9; a.roof.forEach((_, i) => { const z = Math.abs(RF.edgeAz(a.roof, i)); if (z < ba) { ba = z; bi = i; } }); n.lay.edge = bi; n.lay.azMode = 'edge'; delete n.cal; fixH(n); });
    const b = a.roof.reduce((q, p) => [Math.min(q[0], p[0]), Math.min(q[1], p[1]), Math.max(q[2], p[0]), Math.max(q[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    setV({ cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, s: Math.min(Wpx / (b[2] - b[0] + 8), Hpx / (b[3] - b[1] + 8)) }); setAna(null); setMode('pan');
    setVmsg('✓ انرسم السطح من جديد مع ' + a.objs.length + ' جسم و' + a.nbs.length + ' عمارة مجاورة. راجع الأجسام بالـ 3D واسحب أي جسم لمكانه أو عدّل ارتفاعه.' + (a.cal ? '' : ' المقياس تقديري من الذكاء الاصطناعي: تأكد منه بـ "📏 مقياس الرسم" على ضلع معروف.')); };
  const dlRuby = () => { const Yr = Y || (ctl.lastC ? ctl.roofLayout(R) : null), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([toRuby(R, Yr && Yr.n ? Yr : null)], { type: 'text/plain' }));
    a.download = 'sanam-roof-' + ((ctl.f.pname || 'project').replace(/[^\w\u0600-\u06FF-]+/g, '_')) + '.rb'; a.click(); };
  const aiScan = async () => { if (!I) return setVmsg('ارفع صورة الموقع أول.'); setAiBusy(true); setVmsg('🤖 جاري المسح بالذكاء الاصطناعي…');
    try { const im = await loadImg(ctl.f.roofImg), k = Math.min(1, 1024 / Math.max(I.w, I.h)), c = document.createElement('canvas'); c.width = Math.round(I.w * k); c.height = Math.round(I.h * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const r = await fetch('/api/ai-roof', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height, mpp: I.mpp / k }) }).then(x => x.json());
      if (r.error) throw new Error(r.error); const toWorld = (x, y) => imgToW(I, x * I.w, y * I.h).map(q => Math.round(q * 100) / 100);
      if (!r.roof || r.roof.length < 3) throw new Error('الذكاء الاصطناعي ما لقى سطح واضح بالصورة.');
      const pts = r.roof.map(([x, y]) => toWorld(x, y));
      commit(n => { n.pts = pts; n.bld = (n.bld || []).filter(b => !b.auto).concat((r.objects || []).filter(o => o.poly && o.poly.length >= 3).map((o, i) => ({ pts: o.poly.map(([x, y]) => toWorld(x, y)), h: +o.height_m || 1.5, name: (o.type || 'جسم') + ' ' + (i + 1), auto: 1 })));
        if (r.parapet_m > 0) n.hp = +r.parapet_m; let bi = 0, ba = 1e9; pts.forEach((_, i) => { const a = Math.abs(RF.edgeAz(pts, i)); if (a < ba) { ba = a; bi = i; } }); n.lay.edge = bi; n.lay.azMode = 'edge'; });
      setVmsg('✓ الذكاء الاصطناعي لقى سطح ' + fmt(Math.abs(RF.area(pts)), 1) + ' m² و' + (r.objects || []).length + ' جسم' + (r.notes ? ' — ' + r.notes : '') + '. راجع الرسمة وعدّلها إذا لازم.');
    } catch (e) { setVmsg('🤖 ' + e.message); } setAiBusy(false); };
  /* auto detection: region growing from the click on the uploaded image (or the satellite view) */
  const applyDetect = (r, toWorld) => { if (r.err) { setVmsg(r.err); return; } const pts = r.outer.map(([x, y]) => toWorld(x, y).map(v => Math.round(v * 100) / 100));
    commit(n => { n.pts = pts; n.bld = (n.bld || []).filter(b => !b.auto).concat(r.holes.map((hh, i) => ({ pts: hh.rect.map(([x, y]) => toWorld(x, y).map(v => Math.round(v * 100) / 100)), h: 1.5, name: 'جسم ' + (i + 1), auto: 1 })));
      let bi = 0, ba = 1e9; pts.forEach((_, i) => { const a = Math.abs(RF.edgeAz(pts, i)); if (a < ba) { ba = a; bi = i; } }); n.lay.edge = bi; n.lay.azMode = 'edge'; });
    setVmsg('✓ لقيت سطح ' + fmt(Math.abs(RF.area(pts)), 1) + ' m² (' + pts.length + ' زوايا' + (r.ortho ? '، زوايا قائمة' : '') + ') و' + r.holes.length + ' جسم عليه (ارتفاعهم 1.5 m، عدّلها بتبويب الخسائر). الاتجاه من الحافة الأقرب للجنوب.'); setMode('pan'); };
  const wand = async p => { setVmsg('جاري الكشف…');
    try {
      if (I) { const im = await loadImg(ctl.f.roofImg), k = Math.min(1, 1000 / Math.max(I.w, I.h)), c = document.createElement('canvas'); c.width = Math.round(I.w * k); c.height = Math.round(I.h * k);
        const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height), q = wToImg(I, p[0], p[1]);
        return applyDetect(detectRoof(d, q[0] * k, q[1] * k, { mpp: I.mpp / k, tol }), (x, y) => imgToW(I, x / k, y / k)); }
      if (!T.length) return setVmsg('ارفع صورة الموقع أو شغّل صورة القمر الصناعي أول.');
      const pxm = Math.min(10, 1100 / (view[2] - view[0])), c = document.createElement('canvas'); c.width = Math.round((view[2] - view[0]) * pxm); c.height = Math.round((view[3] - view[1]) * pxm); const g = c.getContext('2d');
      const ims = await Promise.all(T.map(t => loadImg(t.url, true).then(im => ({ t, im }))));
      ims.forEach(({ t, im }) => g.drawImage(im, (t.x - view[0]) * pxm, (view[3] - t.y) * pxm, t.w * pxm, t.h * pxm));
      const d = g.getImageData(0, 0, c.width, c.height);
      applyDetect(detectRoof(d, (p[0] - view[0]) * pxm, (view[3] - p[1]) * pxm, { mpp: 1 / pxm, tol }), (x, y) => [view[0] + x / pxm, view[3] - y / pxm]);
    } catch (e) { setVmsg('ما قدرت أقرأ الصورة' + (I ? '' : ' (القمر الصناعي ممكن يمنع القراءة)') + '. نزّل لقطة شاشة للسطح وارفعها من "📷 صورة الموقع".'); } };
  const onImg = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; setVmsg('جاري تجهيز الصورة…');
    try { const r = await downscale(f, 1600); ctl.set('roofImg', r.src); commit(n => { n.img = { w: r.w, h: r.h, mpp: 0.05, rot: 0, k0: r.ow / r.w }; n.map = { ...(n.map || {}), on: 0 }; delete n.cal; });
      setV({ cx: 0, cy: 0, s: Math.min(Wpx / (r.w * 0.05 + 4), Hpx / (r.h * 0.05 + 4)) }); setMode('scale'); setVmsg('الصورة انرفعت. الخطوة 1: حدد المقياس — اضغط نقطتين مسافتهم معروفة (مثلاً طول حافة السطح) واكتب المسافة الحقيقية. الخطوة 2: ارسم حدود السطح بالخطوط (⬠).'); }
    catch (er) { setVmsg('ما قدرت أفتح الصورة.'); } };
  /* two-point calibration: real length ÷ length on the drawing = factor for the whole drawing (image, roof, objects, trees, markers) */
  const applyScale = () => { const dReal = +scD; if (sc.length < 2 || !(dReal > 0)) return setVmsg('اضغط نقطتين واكتب المسافة الحقيقية بالمتر.'); const dm = RF.len(sc[0], sc[1]); if (!(dm > 0.01)) return setVmsg('النقطتين فوق بعض، اختار نقطتين متباعدات.');
    const k = dReal / dm, S = q => [Math.round(q[0] * k * 1000) / 1000, Math.round(q[1] * k * 1000) / 1000];
    commit(n => { if (n.img) n.img.mpp = n.img.mpp * k; n.pts = n.pts.map(S); n.bld = n.bld.map(b => ({ ...b, pts: b.pts.map(S) })); n.trees = n.trees.map(t => ({ ...t, x: t.x * k, y: t.y * k, r: t.r * k }));
      if (n.lay.invPos) n.lay.invPos = S(n.lay.invPos); if (n.lay.dbPos) n.lay.dbPos = S(n.lay.dbPos); n.cal = { len: dReal, a: S(sc[0]), b: S(sc[1]) }; });
    setV(o => ({ cx: o.cx * k, cy: o.cy * k, s: o.s / k })); setSc([]); setScD(''); setMode(I && R.pts.length < 3 ? 'roof' : 'pan');
    setVmsg('✓ المقياس اتطبّق على كل الرسمة (×' + fmt(k, 3) + '): الخط اللي حددته صار ' + fmt(dReal, 2) + ' m، وكل الأطوال والمساحات انحسبت على نفس النسبة' + (I ? ' (' + fmt(I.mpp * k * 100, 2) + ' cm للبكسل)' : '') + (R.map && R.map.on && !I ? '. ملاحظة: صورة القمر الصناعي مقياسها ثابت من الإحداثيات، فممكن الرسمة ما تنطبق عليها بعد التعديل.' : '.')); };
  const calc = () => { setBusy(true); setTimeout(() => { const t = ctl.roofShade(); setShd(t ? { T: t, hor: RF.horizon(R, Y) } : null); setBusy(false); }, 30); };
  const horCSV = () => { const h = RF.horizon(R, Y); if (!h) return; const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['# Sanam PV horizon — Azimuth from South, West positive (PVsyst convention); Height in degrees\nAzimuth;Height\n' + h.map(p => p[0] + ';' + p[1]).join('\n')], { type: 'text/csv' }));
    a.download = 'horizon-pvsyst.csv'; a.click(); };
  const set = (k, x) => commit(n => { n.lay[k] = x; });
  const num = (lbl, val, on, step, w) => <label className="rf-f" style={w ? { width: w } : null}><span>{lbl}</span><input type="number" step={step || 'any'} value={val ?? ''} onChange={e => on(e.target.value === '' ? '' : +e.target.value)} /></label>;

  /* modules + frames in the editor */
  let mods = null; if (Y && Y.n) { const F = Y.F, g = (Y.S - Y.nr * Y.mS) / Math.max(1, Y.nr - 1), cb = Math.cos(Y.b), poly = (u0, u1, v0, v1) => pp([RF.toW(F, u0, v0), RF.toW(F, u1, v0), RF.toW(F, u1, v1), RF.toW(F, u0, v1)]);
    mods = Y.tables.map(t => <g key={t.id}>{t.mods.map(m => { const a = m.j * (Y.mS + (Y.nr > 1 ? g : 0)) * cb; return <polygon key={m.idx} points={poly(m.u0, m.u1, t.vF - a, t.vF - a - Y.mS * cb)} fill="#1e3a8a" fillOpacity=".85" stroke="#93c5fd" strokeWidth=".6" />; })}</g>).concat((Y.ghost || []).map(m => { const a = m.j * (Y.mS + (Y.nr > 1 ? g : 0)) * cb; return <polygon key={'g' + m.key} points={poly(m.u0, m.u1, m.vF - a, m.vF - a - Y.mS * cb)} fill="#22c55e" fillOpacity=".15" stroke="#16a34a" strokeDasharray="3 2" strokeWidth=".8" />; })); }

  /* live shadow preview of the parapet, objects, neighbouring buildings and trees on the roof (sun at the chosen date/hour) */
  const sun = sunAt(lat || 32, sh.doy, sh.hr), kS = sun.el > 1 ? 1 / Math.tan(sun.el * Math.PI / 180) : 0, ux = Math.sin(sun.az * Math.PI / 180), uy = Math.cos(sun.az * Math.PI / 180);
  const off = (q, h) => [q[0] + ux * h * kS, q[1] + uy * h * kS], shPolys = [];
  if (sh.on && kS > 0 && R.pts.length > 2) {
    if (+R.hp > 0) R.pts.forEach((a, i) => { const b = R.pts[(i + 1) % R.pts.length]; shPolys.push([a, b, off(b, +R.hp), off(a, +R.hp)]); });
    R.bld.forEach(b => { if (+b.h > 0 && b.pts.length > 2) shPolys.push(hull(b.pts.concat(b.pts.map(q => off(q, +b.h))))); });
    R.trees.forEach(t => { if (!(+t.h > 0)) return; const ring = []; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; ring.push([+t.x + t.r * Math.cos(a), +t.y + t.r * Math.sin(a)]); }
      shPolys.push(hull(ring.map(q => off(q, 0.3 * t.h)).concat(ring.map(q => off(q, +t.h))))); }); }
  const clipId = 'rfclip' + (AZ ? 'a' : 's'), shadows = shPolys.length ? <g pointerEvents="none"><defs><clipPath id={clipId}><polygon points={pp(R.pts)} /></clipPath></defs>
    <g clipPath={'url(#' + clipId + ')'}>{shPolys.map((P, i) => <polygon key={i} points={pp(P)} fill="#020617" fillOpacity=".38" />)}</g></g> : null;
  const DAYS = [[355, '21 ك1 (أسوأ يوم)'], [80, '21 آذار'], [172, '21 حزيران']];
  const sunBar = <div className="rf-row rf-imgrow"><label className="rf-ck"><input type="checkbox" checked={!!sh.on} onChange={e => setSh({ ...sh, on: e.target.checked ? 1 : 0 })} /> ☀ اعرض الظل على السطح</label>
    <select value={sh.doy} onChange={e => setSh({ ...sh, doy: +e.target.value })} style={{ width: 150 }}>{DAYS.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>
    <label className="rf-f" style={{ minWidth: 220 }}><span>الساعة (توقيت شمسي) {fmt(sh.hr, 1)}</span><input type="range" min="6" max="18" step="0.5" value={sh.hr} onChange={e => setSh({ ...sh, hr: +e.target.value })} /></label>
    <span className="mute">{sun.el > 1 ? 'ارتفاع الشمس ' + fmt(sun.el, 1) + '° · اتجاهها ' + fmt(sun.az, 0) + '° · ظل جسم ارتفاعه 1 m = ' + fmt(kS, 2) + ' m' : 'الشمس تحت الأفق بهالساعة'}</span>
    {I && R.pts.length > 2 && <label className="rf-ck"><input type="checkbox" checked={full} onChange={e => setFull(e.target.checked)} /> أظهر الصورة كاملة</label>}</div>;
  /* analysis result: clean redraw of the roof with dimensions, area and objects, before applying it */
  const anaView = ana && (() => { const all = ana.roof.concat(...ana.objs.map(o => o.pts), ...ana.nbs.map(o => o.pts)), b = all.reduce((q, p) => [Math.min(q[0], p[0]), Math.min(q[1], p[1]), Math.max(q[2], p[0]), Math.max(q[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    const Wv = 900, Hv = 460, k = Math.min((Wv - 80) / (b[2] - b[0] || 1), (Hv - 80) / (b[3] - b[1] || 1)), X = x => 40 + (x - b[0]) * k, Yv = y => Hv - 40 - (y - b[1]) * k, ps = P => P.map(p => X(p[0]) + ',' + Yv(p[1])).join(' ');
    const area = Math.abs(RF.area(ana.roof)), PR = ana.roof;
    return <div className="rf-box rf-ana"><h4>🔬 نتيجة التحليل — راجعها قبل ما تعتمدها <span><button className="b pri" onClick={applyAna}>✓ اعتمد الرسمة</button> <button className="sm" onClick={() => setAna(null)}>إلغاء</button></span></h4>
      <div className="kpis">{[['مساحة السطح', fmt(area, 1) + ' m²'], ['الأضلاع', PR.length], ['الأجسام على السطح', ana.objs.length], ['المباني المجاورة', ana.nbs.length], ['التصوينة', fmt(ana.hp, 1) + ' m'], ['المقياس', fmt(ana.mpp * 100, 2) + ' cm/px' + (ana.cal ? ' (معاير)' : ' (تقدير)')]].map(([a, x]) => <div key={a} className="kpi"><div>{a}</div><b>{x}</b></div>)}</div>
      {ana.odd && <div className="bad">⚠ أبعاد السطح ({fmt(ana.size[0], 1)} × {fmt(ana.size[1], 1)} m) مش منطقية: المقياس غالباً غلط. اعتمد وصحّحه فوراً بـ "📏 مقياس الرسم".</div>}
      {!ana.cal && <div className="warn">المقياس تقدير من الذكاء الاصطناعي ({ana.basis || '—'}). بعد ما تعتمد، صحّحه بـ "📏 مقياس الرسم" على ضلع طوله معروف، وكل الأبعاد بتتعدّل مع بعض.</div>}
      <svg viewBox={'0 0 ' + Wv + ' ' + Hv} className="rf-svg" dir="ltr" style={{ background: '#fff' }}>
        {ana.nbs.map((o, i) => <g key={'n' + i}><polygon points={ps(o.pts)} fill="#cbd5e1" stroke="#64748b" strokeDasharray="5 4" /><text x={X(cen(o.pts)[0])} y={Yv(cen(o.pts)[1])} textAnchor="middle" className="rf-dim">{o.name} · {fmt(o.hg, 1)} m</text></g>)}
        <polygon points={ps(PR)} fill="#f8fafc" stroke="#0f172a" strokeWidth={ana.hp > 0 ? 5 : 2.5} strokeLinejoin="round" />
        {PR.map((a, i) => { const c = PR[(i + 1) % PR.length]; return <text key={i} x={(X(a[0]) + X(c[0])) / 2} y={(Yv(a[1]) + Yv(c[1])) / 2 - 7} textAnchor="middle" className="rf-dim">{fmt(RF.len(a, c), 2)} m</text>; })}
        {ana.objs.map((o, i) => { const pr = presetOf(o.kind); return <g key={i}><polygon points={ps(o.pts)} fill={(pr && pr.color) || '#9ca3af'} fillOpacity=".85" stroke="#334155" /><text x={X(o.rect.cx)} y={Yv(o.rect.cy) + 4} textAnchor="middle" className="rf-dim rf-dim2">{o.name} · {o.h} m</text></g>; })}
        <text x={Wv / 2} y={Hv - 12} textAnchor="middle" className="rf-dim">مساحة السطح {fmt(area, 1)} m²</text>
      </svg>
      <table className="fn-table"><thead><tr><th>#</th><th>الجسم</th><th>النوع</th><th className="n">الأبعاد m</th><th className="n">الارتفاع m</th><th className="n">الثقة</th></tr></thead>
        <tbody>{ana.objs.map((o, i) => <tr key={i}><td>{i + 1}</td><td>{o.name}</td><td>{(presetOf(o.kind) || {}).name || '—'}</td><td className="n">{fmt(o.rect.w, 2)} × {fmt(o.rect.l, 2)}</td><td className="n">{o.h}</td><td className="n">{o.conf != null ? fmt(o.conf * 100, 0) + '%' : '—'}</td></tr>)}
          {ana.nbs.map((o, i) => <tr key={'n' + i}><td>—</td><td>{o.name}</td><td>عمارة مجاورة</td><td className="n">{fmt(Math.abs(RF.area(o.pts)), 0)} m²</td><td className="n">{fmt(o.hg, 1)} من الأرض</td><td className="n">—</td></tr>)}</tbody></table>
      {ana.notes && <div className="mute">🤖 {ana.notes}</div>}
      <div className="mute">الارتفاعات من نوع كل جسم (تقديرية). بعد الاعتماد بتقدر تعدّل أي جسم: مكانه وأبعاده وارتفاعه واسمه، وتشوفه بالـ 3D، وتنزّله لـ SketchUp كملف Ruby.</div>
    </div>; })();
  /* modules + steel structure: tilt, front/rear heights, rows, orientation → layout, 3D, shading and losses all follow */
  const T3 = [['select', '👆 اختيار وسحب'], ['rect', '▭ مستطيل'], ['poly', '⬠ مضلع'], ['push', '⬆ دفع/سحب الارتفاع'], ['rotate', '⟳ تدوير المبنى'], ['delmod', '🗑➕ حذف/إضافة لوح']];
  const H3 = { select: 'اضغط على جسم لتختاره واسحبه لمكانه (بيلتصق على شبكة 25 cm). لف بالماوس وكبّر بالعجلة.', rect: 'اضغط واسحب على الأرض لترسم حدود المبنى كمستطيل (بيلتصق كل 25 cm).', poly: 'اضغط زوايا المبنى وحدة وحدة، وارجع اضغط على أول نقطة (أو دبل كليك) لتسكّره.',
    push: 'اسحب لفوق أو لتحت على المبنى لتغيّر ارتفاعه، أو على أي جسم لتغيّر ارتفاعه.', rotate: 'اسحب يمين أو يسار لتدوير المبنى وكل اللي عليه حوالين نصّه، لحتى يطابق اتجاهه الحقيقي.', delmod: 'اضغط على أي لوح لتحذفه، وبيضل مكانه أخضر شفاف. اضغط على المكان الأخضر ليرجع اللوح.' };
  const tools3 = <div className="rf-3dbar"><div className="rf-row">{T3.map(([k, l]) => <button key={k} className={'sm' + (tool3 === k ? ' on' : '')} onClick={() => setTool3(k)}>{l}</button>)}
      {img3toggle()}</div>
    <div className="rf-row">{num('عدد الطوابق', R.floors, x => commit(n => { n.floors = x; if (+x > 0) n.hb = Math.round(+x * 3.2 * 10) / 10; fixH(n); }), 1, 100)}{num('ارتفاع المبنى m', R.hb, x => commit(n => { n.hb = x; fixH(n); }), 0.1, 120)}
      <span className="rf-rot"><b>⟳</b>{[-15, -1, 1, 15].map(d => <button key={d} className="sm" onClick={() => rotAll(d)}>{d > 0 ? '+' : ''}{d}°</button>)}
        <button className="sm" title="تدوير ليصير الضلع الأخضر مواجه للجنوب تماماً" onClick={() => rotAll(-RF.layAz(R))}>واجهة للجنوب</button></span>
      {R.pts.length > 2 && <span className="mute">اتجاه الواجهة Az {fmt(RF.layAz(R), 1)}° · {fmt(Math.abs(RF.area(R.pts)), 1)} m²</span>}</div>
    <div className="rf-hint">{H3[tool3]}</div></div>;
  function img3toggle() { return I ? <label className="rf-ck"><input type="checkbox" checked={gimg} onChange={e => setGimg(e.target.checked)} /> صورة الموقع على الأرض</label> : null; }
  const stPanel = Yv && Yv.n ? (() => { const STv = RF.structure(Yv, L), hr = Yv.h1 + Yv.S * Math.sin(Yv.b), T0 = Yv.tables[0];
    return <div className="rf-box rf-st"><h4>🏗 الألواح والهيكل الحديدي <small className="mute">أبعاد حقيقية من الداتا شيت</small></h4>
      <div className="rf-row">
        <label className="rf-f" style={{ width: 110 }}><span>الميل °</span><input type="number" step="0.5" value={ctl.f.tilt ?? ''} onChange={e => ctl.input('tilt', e.target.value)} /></label>
        {num('ارتفاع الحافة الأمامية m', L.h1, x => set('h1', x === '' ? '' : Math.max(0, +x)), 0.05, 160)}
        {num('ارتفاع الحافة الخلفية m', Math.round(hr * 100) / 100, x => set('h1', Math.max(0, Math.round(((+x || 0) - Yv.S * Math.sin(Yv.b)) * 100) / 100)), 0.05, 160)}
        {num('ألواح فوق بعض', L.nr, x => set('nr', Math.max(1, Math.round(x || 1))), 1, 110)}
        <label className="rf-f"><span>الوضع</span><select value={L.orient} onChange={e => set('orient', e.target.value)}><option value="P">طولي Portrait</option><option value="L">عرضي Landscape</option></select></label>
        {num('البعد عن التصوينة m', L.setback, x => set('setback', x), 0.1, 130)}</div>
      <div className="rf-cnt"><span className="rf-cnt-n">{Yv.n}</span><span>لوح على السطح{Yv.kWp ? ' = ' + fmt(Yv.kWp, 2) + ' kWp' : ''}{nDelta ? <b className={nDelta > 0 ? 'okc' : 'bad'}> ({nDelta > 0 ? '+' : ''}{nDelta})</b> : null}{ctl.lastC ? <span className="mute"> · التصميم {ctl.lastC.nModules}</span> : null}{Yv.nOff ? <span className="mute"> · محذوف {Yv.nOff}</span> : null}</span>
        <button className="sm" onClick={() => commit(n => { n.lay.fill = 'count'; n.lay.cs = Yv.single ? 1 : 0; n.lay.nMan = Math.max(0, Yv.n - 1 + (n.lay.off || []).length); })}>− لوح</button><button className="sm" onClick={() => commit(n => { const off = n.lay.off || []; if (off.length) { n.lay.off = off.slice(0, -1); return; } n.lay.fill = 'count'; n.lay.cs = Yv.single ? 1 : 0; n.lay.nMan = Yv.n + 1; })}>+ لوح</button>
        <button className={'sm' + (L.fill === 'max' ? ' on' : '')} onClick={() => set('fill', 'max')}>املأ السطح كامل</button>{ctl.lastC && <button className={'sm' + (L.fill === 'design' ? ' on' : '')} onClick={() => set('fill', 'design')}>حسب التصميم</button>}
        {ctl.lastC && Yv.n !== ctl.lastC.nModules && <button className="b pri" onClick={() => setRcMsg(ctl.useRoofCount().msg)}>✓ اعتمد عدد السطح بالتصميم ({Yv.n} لوح)</button>}
        <button className={'sm' + (tool3 === 'delmod' && view3 ? ' on' : '')} onClick={() => { setView3(true); setTool3('delmod'); }}>🗑➕ احذف/أضف ألواح بالنقر</button>{(L.off || []).length > 0 && <button className="sm" onClick={() => set('off', [])}>استرجع المحذوفة ({(L.off || []).length})</button>}</div>
      {rcMsg && <div className={rcMsg[0] === '✓' ? 'info' : 'warn'}>{rcMsg}</div>}
      {Yv.single && <div className="mute">🏗 هيكل واحد مرفوع فوق السطح: {Yv.nr} لوح فوق بعض × {Yv.tables[0].cols} عمود ({fmt(Yv.tables[0].len, 1)} × {fmt(Yv.D, 1)} m). الهيكل بيتخطى بس الأماكن اللي فيها جسم أعلى منه أو منور.</div>}
      {Yv.cap > 0 && <div className="warn">السطح ما بيساع أكثر من {Yv.cap} لوح على هيكل واحد بهالارتفاع. ارفع الهيكل ليمرّ فوق الأجسام، أو احذف عوائق.</div>}
      <label className="rf-f rf-slide"><span>ارتفاع الهيكل (الحافة الأمامية) {fmt(+L.h1 || 0, 2)} m — ارفعه ليمرّ فوق الأجسام ويزيد عدد الألواح (بيرجع العداد لملء السطح كامل)</span><input type="range" min="0" max="4" step="0.05" value={+L.h1 || 0} onChange={e => commit(n => { n.lay.h1 = +e.target.value; if (n.lay.fill !== 'max') { n.lay.fill = 'max'; n.lay.cs = 0; } })} /></label>
      <div className="kpis">{[['اللوح', fmt(Math.max(Yv.mU, Yv.mS), 3) + ' × ' + fmt(Math.min(Yv.mU, Yv.mS), 3) + ' m'], ['الألواح', Yv.n + ' · ' + Yv.tables.length + ' طاولة'], ['طول الطاولة × عمقها', fmt(T0.len, 2) + ' × ' + fmt(Yv.D, 2) + ' m'],
        ['الأرجل أمامية / خلفية', fmt(STv.hf, 2) + ' / ' + fmt(STv.hr, 2) + ' m'], ['الإطارات', STv.tables.reduce((a, t) => a + t.nf, 0) + ' إطار'], ['الحديد', fmt(STv.steelKg, 0) + ' kg']].map(([a, x]) => <div key={a} className="kpi"><div>{a}</div><b>{x}</b></div>)}</div>
      <div className={sloss && sloss.near > 0.03 ? 'warn' : 'info'}>{!sloss ? 'خسارة الظل بتنحسب بعد تحميل بيانات الطقس.' : sloss === '…' ? '☀ جاري حساب خسارة الظل…' : sloss.err ? 'ما قدرت أحسب خسارة الظل: ' + sloss.err :
        <>☀ خسارة الظل القريب على هالرسمة: <b>{fmt(sloss.near * 100, 2)}٪</b> من الإشعاع{sloss.elec > 0.0005 ? <> + <b>{fmt(sloss.elec * 100, 2)}٪</b> أثر كهربائي</> : null}، يعني الإنتاج بيقل <b>{fmt(sloss.tot * 100, 2)}٪</b>. معامل ظل المنتشر {fmt(sloss.fd * 100, 1)}٪. هاد الرقم نفسه بيدخل المحاكاة ومخطط الخسائر (Near Shadings).</>}</div>
      <div className="mute">غيّر الميل أو ارتفاع الهيكل أو حرّك الأجسام: الرسمة والـ 3D والظل والخسائر بيتحدّثوا لحالهم. رفع الهيكل فوق التصوينة بيقلل ظلها، بس بيزيد طول الأرجل ووزن الحديد.</div>
    </div>; })() : null;
  /* quick add + the selected object's panel */
  const SB = sel && sel[0] === 'bld' ? R.bld[sel[1]] : null, ST = sel && sel[0] === 'tree' ? R.trees[sel[1]] : null;
  const editB = fn => commit(n => { const b = n.bld[sel[1]]; fn(b, n); if (b.rect) b.pts = rectPts(b.rect); fixH(n); });
  const objPanel = <div className="rf-objs">
    <div className="rf-row"><button className="b" onClick={() => setPick(pick ? null : Object.fromEntries(OBJ_PRESETS.filter(p => p.kind !== 'neighbour').map(p => [p.kind, { on: false, q: 1, w: p.w, l: p.l, h: p.h }])))}>{pick ? 'إغلاق القائمة' : '☑ اختيار أجسام متعددة بأبعادها'}</button></div>
    {pick && <div className="rf-box rf-pick"><table className="fn-table"><thead><tr><th></th><th>الجسم</th><th className="n">العدد</th><th className="n">العرض m</th><th className="n">الطول m</th><th className="n">الارتفاع m</th></tr></thead><tbody>
      {OBJ_PRESETS.filter(p => p.kind !== 'neighbour').map(p => { const o = pick[p.kind], up = (k, x) => setPick({ ...pick, [p.kind]: { ...o, [k]: x, on: k === 'on' ? x : true } });
        return <tr key={p.kind} className={o.on ? 'rf-on' : ''}><td><input type="checkbox" checked={o.on} onChange={e => up('on', e.target.checked)} /></td><td>{p.name}</td>
          {['q', 'w', 'l', 'h'].map(k => <td key={k} className="n"><input type="number" step={k === 'q' ? 1 : 0.1} min="0" value={o[k]} onChange={e => up(k, e.target.value)} style={{ width: 70 }} /></td>)}</tr>; })}</tbody></table>
      <button className="b pri" onClick={addPicked}>أضف المختار ({Object.values(pick).filter(x => x.on).reduce((a, x) => a + (+x.q || 0), 0)})</button> <span className="mute">بينضافوا جنب المبنى، وبعدين بتسحب كل واحد لمكانه على السطح.</span></div>}
    <div className="rf-row rf-add"><b>➕ أضف جسم جاهز:</b>{OBJ_PRESETS.map(pr => <button key={pr.kind} className="sm" onClick={() => addPreset(pr.kind)}>{pr.name} <span className="mute">{pr.h}m</span></button>)}</div>
    {SB && <div className="rf-box rf-sel"><h4>✏️ الجسم المختار <button className="sm" onClick={() => setSel(null)}>إغلاق</button></h4>
      <div className="rf-row">
        <label className="rf-f" style={{ minWidth: 200 }}><span>الاسم (الارتفاع بيتقدّر من الاسم)</span><input list="rf-names" value={SB.name || ''} onChange={e => { const nm = e.target.value, k = guessKind(nm); editB((b, n) => { b.name = nm; if (k && b.hAuto !== false && k !== b.kind) setKind(n, sel[1], k); }); }} />
          <datalist id="rf-names">{OBJ_PRESETS.map(pr => <option key={pr.kind} value={pr.name} />)}</datalist></label>
        <label className="rf-f"><span>النوع</span><select value={SB.kind || ''} onChange={e => editB((b, n) => { setKind(n, sel[1], e.target.value); const pr = presetOf(e.target.value); if (pr && (!b.name || /^(جسم|مبنى مجاور) \d+$/.test(b.name))) b.name = pr.name; b.hAuto = true; })}><option value="">— غير محدد —</option>{OBJ_PRESETS.map(pr => <option key={pr.kind} value={pr.kind}>{pr.name} ({pr.h} m)</option>)}</select></label>
        <label className="rf-f"><span>المرجع</span><select value={SB.ref || 'roof'} onChange={e => editB((b, n) => { b.ref = e.target.value; if (b.ref === 'ground' && (b.hg === '' || b.hg == null)) b.hg = Math.round(((+n.hb || 0) + (+b.h || 0)) * 100) / 100; })}><option value="roof">على سطحي</option><option value="ground">من الأرض (مجاور)</option></select></label>
        {SB.ref === 'ground' ? num('الارتفاع من الأرض m', SB.hg, x => editB(b => { b.hg = x; b.hAuto = false; }), 0.1, 140) : num('الارتفاع فوق السطح m', SB.h, x => editB(b => { b.h = x; b.hAuto = false; }), 0.1, 140)}
      </div>
      <div className="rf-row">{SB.rect ? <>{num('العرض m', SB.rect.w, x => editB(b => { b.rect.w = +x || 0.1; }), 0.1, 100)}{num('الطول m', SB.rect.l, x => editB(b => { b.rect.l = +x || 0.1; }), 0.1, 100)}{num('الدوران °', SB.rect.rot, x => editB(b => { b.rect.rot = +x || 0; }), 5, 100)}</>
        : <span className="mute">شكل مرسوم بالنقاط: عدّل زواياه بوضع "↔ تعديل/إضافة نقاط".</span>}
        <span className="mute">{fmt(Math.abs(RF.area(SB.pts)), 2)} m² · فوق سطحك {fmt(+SB.h || 0, 2)} m</span>
        {[['⬅', -0.25, 0], ['➡', 0.25, 0], ['⬆', 0, 0.25], ['⬇', 0, -0.25]].map(([t, dx, dy]) => <button key={t} className="sm" title="تحريك 25 cm" onClick={() => moveObj('bld', sel[1], dx, dy)}>{t}</button>)}
        <button className="sm" onClick={() => commit(n => { const c = JSON.parse(JSON.stringify(n.bld[sel[1]])); c.name = (c.name || '') + ' 2'; c.pts = c.pts.map(q => [q[0] + 1, q[1] - 1]); if (c.rect) { c.rect.cx += 1; c.rect.cy -= 1; } n.bld.push(c); setSel(['bld', n.bld.length - 1]); })}>نسخ</button>
        <button className="sm" onClick={() => { commit(n => { n.bld.splice(sel[1], 1); }); setSel(null); }}>🗑 حذف</button></div></div>}
    {ST && <div className="rf-box rf-sel"><h4>🌳 الشجرة المختارة <button className="sm" onClick={() => setSel(null)}>إغلاق</button></h4>
      <div className="rf-row"><label className="rf-f"><span>المرجع</span><select value={ST.ref || 'roof'} onChange={e => commit(n => { const t = n.trees[sel[1]]; t.ref = e.target.value; if (t.ref === 'ground' && (t.hg === '' || t.hg == null)) t.hg = Math.round(((+n.hb || 0) + (+t.h || 0)) * 100) / 100; fixH(n); })}><option value="roof">على سطحي</option><option value="ground">من الأرض</option></select></label>
        {ST.ref === 'ground' ? num('الارتفاع من الأرض m', ST.hg, x => commit(n => { n.trees[sel[1]].hg = x; fixH(n); }), 0.1, 140) : num('الارتفاع فوق السطح m', ST.h, x => commit(n => { n.trees[sel[1]].h = x; }), 0.1, 140)}
        {num('نصف القطر m', ST.r, x => commit(n => { n.trees[sel[1]].r = x; }), 0.1, 100)}
        <button className="sm" onClick={() => { commit(n => { n.trees.splice(sel[1], 1); }); setSel(null); }}>🗑 حذف</button></div></div>}
    {!SB && !ST && <div className="mute">اضغط على أي جسم (بالرسمة بوضع ✋ أو بالـ 3D) لتختاره وتعدّل اسمه وارتفاعه ومكانه. بالـ 3D بتسحب الجسم بالماوس لمكانه، وبتلف حوالين السطح بالماوس وبتكبّر بالعجلة.</div>}
  </div>;
  /* obstacles and their heights (shared by both tabs) */
  const hb = R.hb, refSel = (o, on) => <select value={o.ref || 'roof'} onChange={e => on(e.target.value)} style={{ width: 150 }}><option value="roof">على سطحي (فوق السطح)</option><option value="ground">من الأرض (مبنى/شجرة مجاورة)</option></select>;
  const hIn = (o, on, onG) => o.ref === 'ground' ? <>{num('الارتفاع من الأرض m', o.hg, onG, 0.1, 140)}<span className="mute">= {fmt(+o.h || 0, 2)} m فوق سطحك</span></> : num('الارتفاع فوق سطحك m', o.h, on, 0.1, 140);
  const obsBox = <div className="rf-box"><h4>الأجسام والارتفاعات</h4>
    <div className="rf-row">{num('عدد الطوابق', R.floors, x => commit(n => { n.floors = x; if (+x > 0) { n.hb = Math.round(+x * 3.2 * 10) / 10; n.bld.forEach(b => { if (b.ref === 'ground' && b.hAuto !== false) b.hg = Math.round((n.hb + (+b.h || 0)) * 100) / 100; }); } fixH(n); }), 1, 110)}{num('ارتفاع مبناك من الأرض للسطح m', hb, x => commit(n => { n.hb = x; n.bld.forEach(b => { if (b.ref === 'ground' && b.hAuto !== false) b.hg = Math.round(((+x || 0) + (+b.h || 0)) * 100) / 100; }); fixH(n); }), 0.1, 200)}{num('ارتفاع التصوينة m', R.hp, x => commit(n => { n.hp = x; }), 0.05, 140)}</div>
    {!(+hb > 0) && (R.bld.some(b => b.ref === 'ground') || R.trees.some(t => t.ref === 'ground')) && <div className="warn">اكتب ارتفاع مبناك، عشان نطرحه من ارتفاع المباني والأشجار المجاورة ونعرف قديش أعلى من سطحك.</div>}
    {!R.bld.length && !R.trees.length && <div className="mute">ما في أجسام. ارسم بـ "🏢" بيت الدرج والخزانات والعمارات المجاورة، وبـ "🌳" الأشجار، وبعدين اكتب ارتفاعاتها هون.</div>}
    {R.bld.map((b, i) => <div key={'b' + i} className={'rf-row' + (sel && sel[0] === 'bld' && sel[1] === i ? ' rf-on' : '')}><input value={b.name || ''} onChange={e => { const nm = e.target.value, k = guessKind(nm); commit(n => { n.bld[i].name = nm; if (k && n.bld[i].hAuto !== false && k !== n.bld[i].kind) setKind(n, i, k); }); }} style={{ width: 140 }} />
      {refSel(b, x => commit(n => { const o = n.bld[i]; o.ref = x; if (x === 'ground' && (o.hg === '' || o.hg == null)) o.hg = Math.round(((+n.hb || 0) + (+o.h || 0)) * 100) / 100; fixH(n); }))}
      {hIn(b, x => commit(n => { n.bld[i].h = x; n.bld[i].hAuto = false; }), x => commit(n => { n.bld[i].hg = x; n.bld[i].hAuto = false; fixH(n); }))}
      <span className="mute">{fmt(Math.abs(RF.area(b.pts)), 1)} m²</span><button className="sm" onClick={() => commit(n => { n.bld.splice(i, 1); })}>×</button></div>)}
    {R.trees.map((t, i) => <div key={'t' + i} className="rf-row"><b style={{ width: 120 }}>🌳 شجرة {i + 1}</b>
      {refSel(t, x => commit(n => { const o = n.trees[i]; o.ref = x; if (x === 'ground' && (o.hg === '' || o.hg == null)) o.hg = Math.round(((+n.hb || 0) + (+o.h || 0)) * 100) / 100; fixH(n); }))}
      {hIn(t, x => commit(n => { n.trees[i].h = x; }), x => commit(n => { n.trees[i].hg = x; fixH(n); }))}
      {num('نصف القطر m', t.r, x => commit(n => { n.trees[i].r = x; }), 0.1, 100)}{num('شفافية %', t.tr, x => commit(n => { n.trees[i].tr = x; }), 5, 90)}<button className="sm" onClick={() => commit(n => { n.trees.splice(i, 1); })}>×</button></div>)}
    <div className="mute">الأجسام على سطحك: ارتفاعها فوق السطح. المباني والأشجار المجاورة: اكتب ارتفاعها من الأرض، والأداة بتطرح ارتفاع مبناك. أي جسم أوطى من سطحك ما بيعمل ظل. الظل الكامل (طريقة PVsyst) بينحسب بتبويب الخسائر بعد تصميم النظام.</div></div>;
  if (!AZ && R.pts.length < 3) return <div className="warn">ارسم السطح أول بتبويب "الاتجاه"، وبعدها بتنرسم الألواح هون لحالها وبنحسب الظل.</div>;
  if (!AZ && !ctl.lastC) return <div className="warn">صمّم النظام أول (تبويب الاستهلاك ثم النظام)، وبعدها الألواح بتنرسم على السطح لحالها.</div>;
  return <div className="roofed">
    <div className="rf-bar">{MODES.map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setDraft([]); }}>{l}</button>)}
      <span className="rf-sp" />
      <label className="rf-ck"><input type="checkbox" checked={!!(R.map && R.map.on)} onChange={e => commit(n => { n.map = { ...(n.map || {}), on: e.target.checked ? 1 : 0 }; })} /> صورة القمر الصناعي</label>
      <button onClick={() => { setView3(true); setTool3(R.pts.length > 2 ? 'push' : 'rect'); }}>📐 رسم زي SketchUp</button>
      {R.pts.length > 2 && <button onClick={dlRuby} title="SketchUp: Window → Ruby Console → load">⬇ SketchUp (Ruby)</button>}
      <button className={view3 ? 'on' : ''} onClick={() => setView3(!view3)}>{view3 ? '🗺 رجوع للرسمة 2D' : '🧊 عرض ثلاثي الأبعاد 3D'}</button>
      <button onClick={() => setV(o => ({ ...o, s: o.s * 1.3 }))}>＋</button><button onClick={() => setV(o => ({ ...o, s: o.s / 1.3 }))}>－</button></div>
    <div className="rf-hint">{mode === 'del' ? 'اضغط على نقطة زاوية لحذفها، أو جوّا جسم أو شجرة لحذفها.' : mode === 'move' ? 'اسحب أي نقطة لتحرّكها، أو اضغط على ضلع لتضيف نقطة جديدة عليه.' : mode === 'drop' ? 'اضغط مكان نزول الكوابل من السطح (الدرج أو الشفت). منه بنحسب الطريق لغرفة الكهرباء.' : mode === 'wand' ? 'اضغط بنص السطح بالصورة: الأداة بتلقى حدود السطح والأجسام اللي عليه (خزانات، بيت درج، مكيفات) لحالها. إذا طلع أكبر أو أصغر غيّر التسامح.' : mode === 'scale' ? 'اضغط على ضلع معروف طوله (أو نقطتين — بتلتصق بالزوايا)، واكتب الطول الحقيقي. الأداة بتكبّر أو بتصغّر الرسمة كلها بنفس النسبة.' : mode === 'roof' || mode === 'bld' ? (mode === 'bld' ? 'اسحب مستطيل فوق الجسم (بينحاذى مع حافة السطح) — أسرع طريقة للخزانات والغرف. أو ارسمه نقطة نقطة: ' : '') + 'اضغط لتضيف نقاط الزوايا، وارجع اضغط على أول نقطة (أو Enter) لتسكّر الشكل. Shift = خطوط مستقيمة 90°. Esc يلغي.' : mode === 'inv' ? 'اضغط مكان الانفيرتر (أو نقطة نزول الكوابل من السطح). منه بتنحسب أطوال كوابل الـ DC.' : mode === 'tree' ? 'اضغط مكان الشجرة، وبعدين عدّل نصف القطر والارتفاع من القائمة تحت.' : mode === 'edge' ? 'اضغط على حافة السطح اللي بدك الصفوف تكون موازية إلها، والأداة بتحسب الـ Azimuth لحالها.' : mode === 'move' ? 'اسحب أي نقطة لتعدّلها.' : 'اسحب لتحرك الخريطة، وعجلة الماوس للتكبير.'}
      {!lat && <b className="bad"> · حدد إحداثيات الموقع بتبويب 1 عشان تظهر صورة القمر الصناعي.</b>}</div>
    {AZ && <div className="rf-row rf-imgrow">
      <label className="b sm-file">📷 صورة الموقع<input type="file" accept="image/*" className="hid" onChange={onImg} /></label>
      {I && <>{num('اتجاه أعلى الصورة عن الشمال °', I.rot || 0, x => commit(n => { n.img.rot = +x || 0; }), 1, 150)}<span className="mute">المقياس {fmt(I.mpp * 100, 2)} cm/px</span>
        <button className="sm" onClick={() => { ctl.set('roofImg', ''); commit(n => { delete n.img; }); }}>حذف الصورة</button></>}
      {I && <button className="b pri" onClick={analyze} disabled={!!anaBusy}>{anaBusy || '🔬 تحليل الصورة وإعادة الرسم'}</button>}
      {I && <button className="b" onClick={aiScan} disabled={aiBusy}>{aiBusy ? '🤖 جاري المسح…' : '🤖 مسح بالذكاء الاصطناعي (OpenAI)'}</button>}
      {num('تسامح الألوان للكشف', tol, x => setTol(+x || 32), 2, 120)}
      <button className="sm" onClick={restart}>↺ ابدأ من جديد (امسح الصورة والرسمة)</button>
    </div>}
    {AZ && I && <div className="rf-row rf-imgrow">
      <b className="mute">مقياس Google Maps:</b>
      <label className="rf-f" style={{ minWidth: 260 }}><span>الصق رابط Google Maps (فيه @lat,lng,zoom)</span><input dir="ltr" value={glink} onChange={e => setGlink(e.target.value)} placeholder="https://www.google.com/maps/@31.95,35.91,20z" /></label>
      <button className="sm" onClick={parseLink}>خذ المقياس من الرابط</button>
      {num('أو Zoom', gz, x => setGz(x), 0.5, 90)}{num('دقة الشاشة (DPR)', gdpr, x => setGdpr(x), 0.25, 110)}<button className="sm" onClick={() => applyGoogle(+gz)}>طبّق Zoom</button>
    </div>}
    {AZ && (mode === 'scale' || vmsg || R.cal) && <div className="rf-row rf-imgrow">
      {mode === 'scale' && <><b>📏 مقياس الرسم:</b>
        <span className="mute">{sc.length === 0 ? 'اضغط على ضلع (بياخذ طوله كامل) أو على نقطتين بينهم مسافة معروفة.' : sc.length === 1 ? 'اضغط النقطة الثانية.' : 'الطول على الرسمة ' + fmt(RF.len(sc[0], sc[1]), 2) + ' m'}</span>
        {sc.length === 2 && <>{num('الطول الحقيقي m', scD, x => setScD(x), 0.01, 130)}<button className="b pri" onClick={applyScale}>طبّق على كل الرسمة</button></>}
        {sc.length > 0 && <button className="sm" onClick={() => setSc([])}>إلغاء النقاط</button>}</>}
      {R.cal && mode !== 'scale' && <span className="okc">✓ الرسمة معايرة على خط طوله {fmt(R.cal.len, 2)} m</span>}
      {vmsg && <span className={vmsg[0] === '✓' ? 'okc' : 'mute'}>{vmsg}</span>}
    </div>}
    {AZ && I && <div className="rf-steps">{[['1', 'المقياس', !!R.cal || I.mpp !== 0.05, 'scale'], ['2', 'حدود السطح بالخطوط', R.pts.length > 2, 'roof'], ['3', 'الأجسام والمباني المجاورة', R.bld.length + R.trees.length > 0, 'bld'], ['4', 'الارتفاعات (تحت)', R.bld.length + R.trees.length > 0 && (!R.bld.concat(R.trees).some(o => o.ref === 'ground') || +R.hb > 0), null]].map(([k, l, ok, m]) =>
      <button key={k} className={'rf-step' + (ok ? ' ok' : '')} onClick={() => m && (setMode(m), setDraft([]))}><b>{ok ? '✓' : k}</b> {l}</button>)}</div>}
    {sunBar}
    {view3 ? <>{tools3}<Safe3D onSave={() => ctl.projSave(false)} onBack={() => setView3(false)}><Roof3D R={R} img={ctl.f.roofImg} Y={Yv} sun={sun} sel={sel} tool={tool3} groundImg={gimg} onSelect={(k, i) => setSel(k ? [k, i] : null)} onMove={moveObj} onDraw={onDraw} onPush={onPush} onRotate={rotAll} onModule={onModule} /></Safe3D></> :
    <svg ref={svg} viewBox={'0 0 ' + Wpx + ' ' + Hpx} className="rf-svg" dir="ltr" onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={finish} style={{ cursor: mode === 'pan' ? 'grab' : mode === 'wand' ? 'cell' : 'crosshair' }}>
      <rect width={Wpx} height={Hpx} fill="#e2e8f0" />
      {T.map(t => <image key={t.k} href={t.url} x={SX(t.x)} y={SY(t.y)} width={t.w * v.s + 0.5} height={t.h * v.s + 0.5} preserveAspectRatio="none" />)}
      {I && (() => { const c = [SX(0), SY(0)], w = I.w * I.mpp * v.s, h = I.h * I.mpp * v.s; return <image href={ctl.f.roofImg} x={c[0] - w / 2} y={c[1] - h / 2} width={w} height={h} transform={'rotate(' + (I.rot || 0) + ' ' + c[0] + ' ' + c[1] + ')'} opacity="0.95" />; })()}
      {sc.length > 0 && (() => { const L3 = hover && sc.length === 1 ? sc.concat([hover]) : sc; return <><polyline points={pp(L3)} fill="none" stroke="#e11d48" strokeWidth="3" />{sc.map((p, i) => <circle key={i} cx={SX(p[0])} cy={SY(p[1])} r="5" fill="#e11d48" />)}
        {L3.length === 2 && <text x={(SX(L3[0][0]) + SX(L3[1][0])) / 2} y={(SY(L3[0][1]) + SY(L3[1][1])) / 2 + 16} className="rf-dim" fill="#e11d48">{fmt(RF.len(L3[0], L3[1]), 2)} m</text>}</>; })()}
      {(() => { const st = v.s > 20 ? 1 : v.s > 6 ? 5 : 10, L2 = []; for (let x = Math.ceil(view[0] / st) * st; x < view[2]; x += st) L2.push(<line key={'x' + x} x1={SX(x)} x2={SX(x)} y1="0" y2={Hpx} stroke="#fff" strokeOpacity={T.length ? 0.12 : 0.7} />);
        for (let y = Math.ceil(view[1] / st) * st; y < view[3]; y += st) L2.push(<line key={'y' + y} y1={SY(y)} y2={SY(y)} x1="0" x2={Wpx} stroke="#fff" strokeOpacity={T.length ? 0.12 : 0.7} />); return L2; })()}
      {R.pts.length > 2 && <polygon points={pp(R.pts)} fill="#fff" fillOpacity={T.length || I ? 0.22 : 0.9} stroke="#0f172a" strokeWidth={+R.hp > 0 ? 4 : 2} />}
      {R.pts.length > 2 && L.azMode === 'edge' && (() => { const i = Math.min(L.edge || 0, R.pts.length - 1), a = R.pts[i], b = R.pts[(i + 1) % R.pts.length]; return <line x1={SX(a[0])} y1={SY(a[1])} x2={SX(b[0])} y2={SY(b[1])} stroke="#16a34a" strokeWidth="6" strokeOpacity=".8" />; })()}
      {R.pts.length > 2 && R.pts.map((a, i) => { const b = R.pts[(i + 1) % R.pts.length]; return <text key={i} x={(SX(a[0]) + SX(b[0])) / 2} y={(SY(a[1]) + SY(b[1])) / 2 - 6} className="rf-dim">{fmt(RF.len(a, b), 2)} m</text>; })}
      {R.bld.map((b, i) => <g key={i} onClick={() => setSel(['bld', i])}><polygon points={pp(b.pts)} fill={sel && sel[0] === 'bld' && sel[1] === i ? '#f59e0b' : b.ref === 'ground' ? '#334155' : '#64748b'} fillOpacity=".5" stroke={sel && sel[0] === 'bld' && sel[1] === i ? '#b45309' : '#334155'} strokeWidth={sel && sel[0] === 'bld' && sel[1] === i ? 3 : 1.5} /><text x={SX(b.pts[0][0])} y={SY(b.pts[0][1]) - 4} className="rf-dim">{b.name} · {b.h}m</text>
        {v.s > 4 && b.pts.map((a, j) => { const c2 = b.pts[(j + 1) % b.pts.length], d = RF.len(a, c2); return d * v.s > 28 ? <text key={j} x={(SX(a[0]) + SX(c2[0])) / 2} y={(SY(a[1]) + SY(c2[1])) / 2 + 4} textAnchor="middle" className="rf-dim rf-dim2">{fmt(d, 2)}</text> : null; })}</g>)}
      {R.trees.map((t, i) => v.s > 4 && <text key={'td' + i} x={SX(t.x)} y={SY(t.y) + 14} textAnchor="middle" className="rf-dim rf-dim2">⌀ {fmt(2 * t.r, 1)} m</text>)}
      {R.trees.map((t, i) => <g key={i}><circle cx={SX(t.x)} cy={SY(t.y)} r={t.r * v.s} fill="#22c55e" fillOpacity=".45" stroke="#15803d" /><text x={SX(t.x)} y={SY(t.y)} className="rf-dim" textAnchor="middle">{t.h}m</text></g>)}
      {I && R.pts.length > 2 && !full && <path d={'M0 0H' + Wpx + 'V' + Hpx + 'H0Z M' + R.pts.map(p => SX(p[0]) + ' ' + SY(p[1])).join(' L') + 'Z'} fillRule="evenodd" fill="#0f172a" fillOpacity=".62" pointerEvents="none" />}
      {shadows}
      {mods}
      {!AZ && L.dbPos && <g transform={'translate(' + SX(L.dbPos[0]) + ',' + SY(L.dbPos[1]) + ')'}><circle r="11" fill="#ecfdf5" stroke="#059669" strokeWidth="2" /><text y="4" textAnchor="middle" className="rf-dim">⬇</text></g>}
      {(() => { const target = 120 / v.s, p10 = Math.pow(10, Math.floor(Math.log10(target))), st = [1, 2, 5, 10].map(k => k * p10).filter(x => x <= target).pop() || p10; return <g transform={'translate(' + (Wpx - 20 - st * v.s) + ',' + (Hpx - 22) + ')'}><rect width={st * v.s} height="5" fill="#0f172a" /><rect width={st * v.s / 2} height="5" fill="#fff" stroke="#0f172a" /><text y="-4" className="rf-dim">{st >= 1 ? st + ' m' : st * 100 + ' cm'}</text></g>; })()}
      {!AZ && L.invPos && <g transform={'translate(' + SX(L.invPos[0]) + ',' + SY(L.invPos[1]) + ')'}><rect x="-20" y="-12" width="40" height="24" rx="5" fill="#eef2ff" stroke="#4f46e5" strokeWidth="2" /><text y="4" textAnchor="middle" className="rf-dim">INV</text></g>}
      {brect && <polygon points={pp(rectPts(brect))} fill="#f59e0b" fillOpacity=".35" stroke="#b45309" strokeWidth="2" strokeDasharray="5 3" />}
      {draft.length > 0 && <polyline points={pp(hover ? draft.concat([hover]) : draft)} fill="none" stroke="#ea580c" strokeWidth="2" strokeDasharray="6 4" />}
      {draft.map((p, i) => <circle key={i} cx={SX(p[0])} cy={SY(p[1])} r={i === 0 ? 7 : 4} fill={i === 0 ? '#ea580c' : '#fff'} stroke="#ea580c" strokeWidth="2" />)}
      {mode === 'move' && R.pts.concat(...R.bld.map(b => b.pts)).map((p, i) => <circle key={'v' + i} cx={SX(p[0])} cy={SY(p[1])} r="5" fill="#fff" stroke="#2563eb" strokeWidth="2" />)}
      <g transform={'translate(' + (Wpx - 36) + ',36)'}><circle r="18" fill="#fff" stroke="#334155" /><path d="M0 -15 L6 4 L0 0 L-6 4 z" fill="#dc2626" /><text y="-22" textAnchor="middle" className="rf-dim">N</text></g>
      {hover && <text x="10" y={Hpx - 10} className="rf-dim">x {fmt(hover[0], 2)} · y {fmt(hover[1], 2)} m</text>}
      {T.length > 0 && <text x={Wpx / 2} y={Hpx - 6} textAnchor="middle" className="rf-att">Imagery © Esri, Maxar, Earthstar Geographics</text>}
    </svg>}
    {ana && anaView}
    {stPanel}
    {objPanel}

    {AZ && (R.bld.length > 0 || R.trees.length > 0) && <div className="rf-row rf-chips">{R.bld.map((b, i) => <span key={'b' + i} className="rf-chip">🏢 {b.name} · {b.h} m <button onClick={() => commit(n => { n.bld.splice(i, 1); })}>×</button></span>)}
      {R.trees.map((t2, i) => <span key={'t' + i} className="rf-chip">🌳 {i + 1} · {t2.h} m <button onClick={() => commit(n => { n.trees.splice(i, 1); })}>×</button></span>)}
      <button className="sm" onClick={() => commit(n => { n.bld = []; n.trees = []; })}>حذف كل الأجسام</button></div>}
    {AZ ? <><div className="rf-grid">
      <div className="rf-box"><h4>السطح</h4>
        <div className="rf-row">{num('طول السطح m', rect.a, x => setRect({ ...rect, a: x }), 0.1)}{num('عرض السطح m', rect.b, x => setRect({ ...rect, b: x }), 0.1)}{num('دوران عن الشمال °', rect.r, x => setRect({ ...rect, r: x }), 1)}</div>
        <button className="sm" onClick={quickRect}>⬛ ارسم سطح مستطيل بهالأبعاد</button>
        <div className="mute">السطح: {fmt(Math.abs(RF.area(R.pts)), 1)} m² · {R.pts.length} زوايا {R.pts.length > 2 && <button className="sm" onClick={() => commit(n => { n.pts = []; })}>مسح السطح</button>}</div>
      </div>
      <div className="rf-box"><h4>الاتجاه (Azimuth)</h4>
        <select value={L.azMode} onChange={e => set('azMode', e.target.value)}><option value="edge">موازي لحافة السطح المختارة (الخضرا)</option><option value="south">جنوب تماماً (0°)</option><option value="manual">يدوي</option></select>
        {L.azMode === 'manual' && num('Azimuth °', L.az, x => set('az', x), 0.5)}
        <div className="rf-big">Az = {fmt(RF.layAz(R), 1)}°</div>
        <div className="mute">نفس تعريف PVsyst: جنوب 0، غرب +، شرق −. بيتحدّث بحقل الاتجاه فوق لحاله. الميل (Tilt) من حقل الميل: {tilt == null ? <b className="bad">ما في ميل، حطه فوق</b> : tilt + '°'}.</div>
      </div>
    </div>{obsBox}</> : <>
    {obsBox}
    <div className="rf-grid">
      <div className="rf-box"><h4>التصوينة</h4>
        <div className="rf-row">{num('ارتفاع التصوينة m', R.hp, x => commit(n => { n.hp = x; }), 0.05)}{num('بُعد الألواح عن التصوينة m', L.setback, x => set('setback', x), 0.1)}</div>
        <div className="mute">السطح والاتجاه من تبويب الاتجاه. هون بتضيف العوائق، والألواح بتنرسم لحالها من التصميم.</div>
      </div>
      <div className="rf-box"><h4>ترتيب الألواح</h4>
        <div className="rf-row"><label className="rf-f"><span>الهيكل</span><select value={L.struct || 'auto'} onChange={e => set('struct', e.target.value)}><option value="auto">تلقائي: هيكل واحد للأسطح، صفوف للأرضي</option><option value="single">هيكل واحد لكل الألواح</option><option value="multi">صفوف (هياكل منفصلة)</option></select></label></div>
        {Y && Y.single && <div className="info">هيكل واحد: كل الألواح ({Y.n}) على طاولة وحدة، {Y.nr} لوح فوق بعض × {Y.tables[0].cols} عمود، طولها {fmt(Y.tables[0].len, 2)} m وعمقها {fmt(Y.D, 2)} m.</div>}
        {Y && Y.singleFail && <div className="warn">ما زبط هيكل واحد بيتسع كل الألواح لحد 6 ألواح فوق بعض، فوزعتهم على صفوف. صغّر البُعد عن التصوينة أو العوائق، أو قلل الميل.</div>}
        <div className="rf-row"><label className="rf-f"><span>الوضع</span><select value={L.orient} onChange={e => set('orient', e.target.value)}><option value="P">طولي Portrait</option><option value="L">عرضي Landscape</option></select></label>
          {num('ألواح فوق بعض', L.nr, x => set('nr', Math.max(1, Math.round(x || 1))), 1)}{num('ارتفاع الحافة السفلى m', L.h1, x => set('h1', x), 0.05)}</div>
        <div className="rf-row"><label className="rf-f"><span>المسافة بين الصفوف</span><select value={L.pitchMode} onChange={e => set('pitchMode', e.target.value)}><option value="auto">تلقائي: بدون ظل 21 ك1</option><option value="manual">يدوي</option></select></label>
          {L.pitchMode === 'manual' ? num('Pitch m', L.pitch, x => set('pitch', x), 0.05) : <>{num('من الساعة', L.tFrom, x => set('tFrom', x), 0.5)}{num('للساعة', L.tTo, x => set('tTo', x), 0.5)}</>}</div>
        <div className="rf-row"><label className="rf-f"><span>عدد الألواح</span><select value={L.fill} onChange={e => set('fill', e.target.value)}><option value="design">حسب التصميم ({ctl.lastC ? ctl.lastC.nModules : '—'})</option><option value="max">أقصى عدد بيتسع</option></select></label></div>
        {Y && <div className={Y.n < (ctl.lastC ? ctl.lastC.nModules : 0) && L.fill === 'design' ? 'warn' : 'info'}>انحطّ <b>{Y.n}</b> لوح{Y.kWp ? ' = ' + fmt(Y.kWp, 2) + ' kWp' : ''} على {Y.rows} صف و{Y.tables.length} طاولة. Pitch {fmt(Y.pitch, 2)} m، GCR {fmt(Y.gcr * 100, 0)}٪{Y.lim ? '، زاوية الحد ' + fmt(Y.lim.el, 1) + '°' : ''}.
          {Y.n < (ctl.lastC ? ctl.lastC.nModules : 0) && L.fill === 'design' ? ' السطح ما بيتسع لكل ألواح التصميم: صغّر البُعد عن التصوينة أو الـ Pitch، أو قلل الميل.' : ''}</div>}
      </div>
    </div>
    <div className="rf-box"><h4>الظلال القريبة (طريقة PVsyst)</h4>
      <div className="rf-row"><label className="rf-f"><span>الحساب الكهربائي</span><select value={L.elec} onChange={e => set('elec', e.target.value)}><option value="linear">خطي (Linear)</option><option value="strings">حسب السلاسل (According to strings)</option></select></label>
        {L.elec === 'strings' && num('Fraction for electrical effect %', L.kEl, x => set('kEl', x), 5)}
        <button className="b pri" onClick={calc} disabled={!Y || !Y.n || busy}>{busy ? 'جاري الحساب…' : '☀ احسب الظل ومسار الشمس'}</button>
        <button className="sm" onClick={horCSV} disabled={!Y || !Y.n}>⬇ خط الأفق لـ PVsyst (CSV)</button></div>
      <div className="mute">بنبني مشهد 3D (السطح والتصوينة والمباني والأشجار وصفوف الألواح نفسها)، وبنحسب نسبة الظل على الألواح لكل اتجاه شمس (جدول Azimuth × ارتفاع، متل PVsyst)، ومعامل ظل الإشعاع المنتشر. المحاكاة بتطبّقهم ساعة بساعة، وبيطلعوا بمخطط الخسائر كـ "Near Shadings".</div>
      {shd && <><div className="kpis">{[['معامل ظل المنتشر', fmt(shd.T.fd * 100, 1) + ' %'], ['نقاط الحساب', shd.T.pts], ['وقت الحساب', shd.T.ms + ' ms']].map(([k, x]) => <div key={k} className="kpi"><div>{k}</div><b>{x}</b></div>)}</div>
        <div className="sldw" dangerouslySetInnerHTML={{ __html: RF.sunPathSVG(lat || 32, shd.T, shd.hor) }} /></>}
    </div>

    </>}
  </div>;
}

/* last tab: full design — structure + complete system drawings */
export function FullDesign({ ctl }) {
  const R = ctl.roof(), Y = R ? ctl.roofLayout(R) : null, L = R ? R.lay : null;
  if (!R || R.pts.length < 3) return <div className="card"><div className="warn">ارسم السطح بتبويب "الاتجاه" عشان يطلع التصميم الكلي.</div></div>;
  if (!ctl.lastC || !Y || !Y.n) return <div className="card"><div className="warn">صمّم النظام أول (تبويب الاستهلاك ثم النظام)، وبعدها الهيكل والرسومات بيطلعوا هون لحالهم.</div></div>;
  const ST = RF.structure(Y, L), set = (k, x) => { const n = JSON.parse(JSON.stringify(R)); n.lay[k] = x; ctl.roofSet(n); };
  const num = (lbl, val, on, step, w) => <label className="rf-f" style={w ? { width: w } : null}><span>{lbl}</span><input type="number" step={step || 'any'} value={val ?? ''} onChange={e => on(e.target.value === '' ? '' : +e.target.value)} /></label>;
  const c = ctl.lastC, E = ctl.lastE, fd = (id, lbl, step) => <label className="rf-f"><span>{lbl}</span><input type="number" step={step || 'any'} value={ctl.f[id] ?? ''} onChange={e => ctl.input(id, e.target.value)} /></label>;
  return <>
    <div className="card"><h2>ملخص التصميم <small>Full design</small></h2>
      <div className="kpis">{[['قدرة الألواح', fmt(c.kWp, 2) + ' kWp'], ['الانفيرتر', fmt(c.kWac, 2) + ' kWac'], ['الألواح على السطح', Y.n + ' لوح · ' + Y.tables.length + ' طاولة · ' + Y.rows + ' صف'], ['الاتجاه / الميل', 'Az ' + fmt(Y.az, 1) + '° · ' + fmt(Y.tilt, 1) + '°'], ['المسافة بين الصفوف', fmt(Y.pitch, 2) + ' m · GCR ' + fmt(Y.gcr * 100, 0) + '%'], ['الحديد', fmt(ST.steelM, 0) + ' m · ' + fmt(ST.steelKg, 0) + ' kg']].map(([k, x]) => <div key={k} className="kpi"><div>{k}</div><b>{x}</b></div>)}</div>
    </div>
    <div className="card"><h2>الرسمة الكاملة: الألواح والهيكل والكوابل على السطح</h2>
      <div className="sldw" dangerouslySetInnerHTML={{ __html: RF.planSVG(R, Y, { structure: true, st: ST, routes: E && E.routes, inv: (E && E.invAt) || L.invPos || R.pts[0], drop: E && E.dropPos, cableTxt: E ? (E.nRuns + ' خط كابل · DC: ' + E.cab[0].spec.split('،')[0] + ' · AC: ' + E.cab.find(x => x.id === 'ac').spec.split('،')[0].replace(/ \(.*\)/, '') + ' × ' + fmt(E.cab.find(x => x.id === 'ac').L, 0) + ' m · الانفيرتر: ' + (E.mode === 'room' ? 'غرفة الكهرباء' : E.mode === 'roof' ? 'السطح' : 'مكانك')) : '' }) }} />
      {E && !E.routes && <div className="mute">أطوال كوابل الـ DC من الحقل اليدوي. لتنحسب من الرسمة: امسح الطول اليدوي، وحط مكان الانفيرتر بتبويب الخسائر (🔌).</div>}
      <div className="mute">البرتقالي = الإطارات (مدادة مائلة + رجلين + دعامة)، والأصفر = المدادات الأفقية اللي بتنقط عليها الألواح (على ربع وثلاث أرباع طول اللوح).</div></div>
    <div className="card"><h2>الهيكل المعدني <small>Steel structure</small></h2>
      <div className="rf-row">{num('أقصى بُعد بين الإطارات m', L.span, x => set('span', x), 0.1)}{num('مكان الأرجل من طرف المدادة (نسبة)', L.legPos, x => set('legPos', x), 0.05)}{num('ارتفاع الحافة السفلى m', L.h1, x => set('h1', x), 0.05)}</div>
      <div className="rf-row">{[['pRaf', 'مقطع المدادة المائلة', 'kgRaf'], ['pLeg', 'مقطع الأرجل', 'kgLeg'], ['pRail', 'مقطع المدادات الأفقية', 'kgRail'], ['pBr', 'مقطع الدعامات', 'kgBr']].map(([k, l, kg]) => <span key={k} className="rf-prof">
        <label className="rf-f"><span>{l}</span><input value={L[k]} onChange={e => set(k, e.target.value)} /></label>{num('kg/m', L[kg], x => set(kg, x), 0.05, 70)}</span>)}</div>
      <h4>مقطع جانبي</h4><div className="sldw" dangerouslySetInnerHTML={{ __html: RF.sectionSVG(Y, ST) }} />
      <h4>واجهة أمامية</h4><div className="sldw" dangerouslySetInnerHTML={{ __html: RF.elevSVG(Y, ST) }} />
      <h4>جدول الكميات</h4><div dangerouslySetInnerHTML={{ __html: ctl.bomTable(ST) }} />
      <div className="mute">الأبعاد تقديرية للتصميم الأولي، والمقاطع لازم يتحقق منها مهندس إنشائي حسب أحمال الرياح.</div></div>
    <div className="card"><h2>الكوابل والحمايات <small>Cables & protections — DC / AC</small></h2>
      <div className="rf-row"><label className="rf-f"><span>مكان الانفيرتر</span><select value={ctl.f.eInvAt || 'auto'} onChange={e => ctl.input('eInvAt', e.target.value)}><option value="auto">اقترح الأفضل</option><option value="roof">على السطح عند نزول الكوابل</option><option value="room">بغرفة الكهرباء</option><option value="manual">المكان اللي حطيته (🔌)</option></select></label>
        {fd('eFloors', 'عدد الطوابق من السطح لغرفة الكهرباء', 1)}{fd('eRoomH', 'المسافة الأفقية من نزول الكوابل للغرفة m', 1)}{fd('eRoomAC', 'كابل AC إذا الانفيرتر بالغرفة m', 1)}{fd('eIk', 'تيار القصر المتوقع باللوحة kA (فاضي = تلقائي)', 1)}</div>
      <div className="mute">الأحمال ولوحة التوزيع: حدد بتبويب الخسائر نقطة نزول الكوابل من السطح (⬇)، وهون عدد الطوابق لغرفة الكهرباء والمسافة. الأداة بتقارن الانفيرتر على السطح مقابل بغرفة الكهرباء بتكلفة الكوابل وخسائرها.</div>
      <div className="rf-row">{fd('eLDC', 'طول كابل String يدوي m (فاضي = من الرسمة)', 1)}{fd('eDrop', 'نزول الكابل من السطح m', 0.5)}{fd('eLAC', 'طول كابل AC m', 1)}{ctl.hasBat() && fd('eLBat', 'طول كابل البطارية m', 0.5)}</div>
      <div className="rf-row">{fd('eDvDC', 'أقصى هبوط جهد DC %', 0.1)}{fd('eDvAC', 'أقصى هبوط جهد AC %', 0.1)}{fd('eFuse', 'أقصى فيوز للوح (Max series fuse) A', 1)}
        <label className="rf-ck"><input type="checkbox" checked={ctl.f.eAuto !== '0'} onChange={e => ctl.input('eAuto', e.target.checked ? '1' : '0')} /> خسائر الكوابل بالمحاكاة من هالحساب</label></div>
      {E ? <><div className="sldw" dangerouslySetInnerHTML={{ __html: ctl.sldFull() }} /><div dangerouslySetInnerHTML={{ __html: ctl.elecTables() }} /></> : <div className="warn">صمّم النظام (اللوح والانفيرتر والـ strings) عشان تنحسب الكوابل والحمايات.</div>}
    </div>
  </>;
}
