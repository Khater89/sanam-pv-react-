'use client';
import { useState, useRef, useEffect } from 'react';
import * as RF from '@/lib/engine/roof';
import { fmt } from '@/lib/controller';

const MODES_AZ = [['pan', '✋ تحريك'], ['roof', '⬠ رسم السطح'], ['edge', '📐 حافة الاتجاه'], ['move', '↔ تعديل نقاط']];
const MODES_SH = [['pan', '✋ تحريك'], ['bld', '🏢 مبنى/غرفة'], ['tree', '🌳 شجرة'], ['move', '↔ تعديل نقاط']];
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

export default function Roof({ ctl, part }) {
  const AZ = part !== 'shade', MODES = AZ ? MODES_AZ : MODES_SH;
  const R0 = ctl.roof() || RF.blankRoof(), [mode, setMode] = useState(AZ && R0.pts.length < 3 ? 'roof' : 'pan'), [draft, setDraft] = useState([]), [hover, setHover] = useState(null);
  const [v, setV] = useState({ cx: 0, cy: 0, s: 12 }), [sel, setSel] = useState(null), [rect, setRect] = useState({ a: 20, b: 12, r: 0 }), [shd, setShd] = useState(null), [busy, setBusy] = useState(false);
  const svg = useRef(null), drag = useRef(null), Wpx = 900, Hpx = 520, R = R0, L = R.lay;
  const lat = ctl.num('lat'), lon = ctl.num('lon'), tilt = ctl.num('tilt');
  const commit = fn => { const n = JSON.parse(JSON.stringify(R)); fn(n); ctl.roofSet(n); setShd(null); };
  const Y = AZ ? null : ctl.roofLayout(R);
  useEffect(() => { if (!AZ && Y && Y.n && !shd) calc(); }, [ctl.f.roof, ctl.f.tilt, Y && Y.n]); // eslint-disable-line
  useEffect(() => { if (R.pts.length > 2) { const b = R.pts.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    setV({ cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, s: Math.min(Wpx / (b[2] - b[0] + 8), Hpx / (b[3] - b[1] + 8)) }); } }, []); // eslint-disable-line

  const SX = x => Wpx / 2 + (x - v.cx) * v.s, SY = y => Hpx / 2 - (y - v.cy) * v.s;
  const toW = e => { const r = svg.current.getBoundingClientRect(), px = (e.clientX - r.left) * Wpx / r.width, py = (e.clientY - r.top) * Hpx / r.height;
    return [Math.round(((px - Wpx / 2) / v.s + v.cx) * 20) / 20, Math.round((-(py - Hpx / 2) / v.s + v.cy) * 20) / 20]; };
  const ortho = (p, e) => { const d = draft; if (!e.shiftKey || !d.length) return p; const q = d[d.length - 1]; return Math.abs(p[0] - q[0]) > Math.abs(p[1] - q[1]) ? [p[0], q[1]] : [q[0], p[1]]; };
  const nearVert = (p, tol) => { let best = null; const t = tol / v.s, chk = (arr, kind, i) => arr.forEach((q, j) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < t && (!best || d < best.d)) best = { kind, i, j, d }; });
    chk(R.pts, 'roof', 0); R.bld.forEach((b, i) => chk(b.pts, 'bld', i)); R.trees.forEach((t, i) => chk([[t.x, t.y]], 'tree', i)); return best; };

  const down = e => { e.currentTarget.setPointerCapture(e.pointerId); const p = toW(e); drag.current = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy, moved: false, vert: mode === 'move' ? nearVert(p, 12) : null }; };
  const move = e => { const p = toW(e); setHover(ortho(p, e)); const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.hypot(dx, dy) > 4) d.moved = true; if (!d.moved) return;
    if (d.vert) { const V = d.vert; commit(n => { if (V.kind === 'roof') n.pts[V.j] = p; else if (V.kind === 'bld') n.bld[V.i].pts[V.j] = p; else { n.trees[V.i].x = p[0]; n.trees[V.i].y = p[1]; } }); return; }
    const r = svg.current.getBoundingClientRect(), k = Wpx / r.width; setV(o => ({ ...o, cx: d.cx - dx * k / o.s, cy: d.cy + dy * k / o.s })); };
  const up = e => { const d = drag.current; drag.current = null; if (!d || d.moved) return; const p = ortho(toW(e), e);
    if (mode === 'roof' || mode === 'bld') { if (draft.length >= 3 && Math.hypot(p[0] - draft[0][0], p[1] - draft[0][1]) * v.s < 12) return finish(); setDraft(draft.concat([p])); }
    else if (mode === 'tree') commit(n => { n.trees.push({ x: p[0], y: p[1], r: 2, h: 5, tr: 20 }); });
    else if (mode === 'edge' && R.pts.length > 2) { let bi = 0, bd = 1e9; R.pts.forEach((a, i) => { const b = R.pts[(i + 1) % R.pts.length], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dd = Math.hypot(m[0] - p[0], m[1] - p[1]); if (dd < bd) { bd = dd; bi = i; } });
      commit(n => { n.lay.edge = bi; n.lay.azMode = 'edge'; }); } };
  const finish = () => { if (draft.length < 3) return; if (mode === 'roof') commit(n => { n.pts = draft; }); else commit(n => { n.bld.push({ pts: draft, h: 3, name: 'مبنى ' + (n.bld.length + 1) }); }); setDraft([]); setMode('pan'); };
  const wheel = e => { e.preventDefault(); const p = toW(e), k = e.deltaY < 0 ? 1.15 : 1 / 1.15; setV(o => ({ s: Math.max(1, Math.min(200, o.s * k)), cx: p[0] - (p[0] - o.cx) / k, cy: p[1] - (p[1] - o.cy) / k })); };
  useEffect(() => { const el = svg.current; if (!el) return; el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel); });
  useEffect(() => { const k = e => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') setDraft([]); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); });

  const view = [v.cx - Wpx / 2 / v.s, v.cy - Hpx / 2 / v.s, v.cx + Wpx / 2 / v.s, v.cy + Hpx / 2 / v.s], z = v.s > 6 ? 19 : v.s > 3 ? 18 : 17;
  const T = R.map && R.map.on ? tiles(lat, lon, view, z) : [], pp = a => a.map(p => SX(p[0]) + ',' + SY(p[1])).join(' ');
  const quickRect = () => { const a = +rect.a / 2, b = +rect.b / 2, r = (+rect.r || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    commit(n => { n.pts = [[-a, -b], [a, -b], [a, b], [-a, b]].map(([x, y]) => [Math.round((x * c + y * s) * 100) / 100, Math.round((-x * s + y * c) * 100) / 100]); n.lay.edge = 0; });
    setV({ cx: 0, cy: 0, s: Math.min(Wpx / (+rect.a + 8), Hpx / (+rect.b + 8)) }); };
  const calc = () => { setBusy(true); setTimeout(() => { const t = ctl.roofShade(); setShd(t ? { T: t, hor: RF.horizon(R, Y) } : null); setBusy(false); }, 30); };
  const horCSV = () => { const h = RF.horizon(R, Y); if (!h) return; const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['# Sanam PV horizon — Azimuth from South, West positive (PVsyst convention); Height in degrees\nAzimuth;Height\n' + h.map(p => p[0] + ';' + p[1]).join('\n')], { type: 'text/csv' }));
    a.download = 'horizon-pvsyst.csv'; a.click(); };
  const set = (k, x) => commit(n => { n.lay[k] = x; });
  const num = (lbl, val, on, step, w) => <label className="rf-f" style={w ? { width: w } : null}><span>{lbl}</span><input type="number" step={step || 'any'} value={val ?? ''} onChange={e => on(e.target.value === '' ? '' : +e.target.value)} /></label>;

  /* modules + frames in the editor */
  let mods = null; if (Y && Y.n) { const F = Y.F, g = (Y.S - Y.nr * Y.mS) / Math.max(1, Y.nr - 1), cb = Math.cos(Y.b), poly = (u0, u1, v0, v1) => pp([RF.toW(F, u0, v0), RF.toW(F, u1, v0), RF.toW(F, u1, v1), RF.toW(F, u0, v1)]);
    mods = Y.tables.map(t => <g key={t.id}>{t.mods.map(m => { const a = m.j * (Y.mS + (Y.nr > 1 ? g : 0)) * cb; return <polygon key={m.idx} points={poly(m.u0, m.u1, t.vF - a, t.vF - a - Y.mS * cb)} fill="#1e3a8a" fillOpacity=".85" stroke="#93c5fd" strokeWidth=".6" />; })}</g>); }

  if (!AZ && R.pts.length < 3) return <div className="warn">ارسم السطح أول بتبويب "الاتجاه"، وبعدها بتنرسم الألواح هون لحالها وبنحسب الظل.</div>;
  if (!AZ && !ctl.lastC) return <div className="warn">صمّم النظام أول (تبويب الاستهلاك ثم النظام)، وبعدها الألواح بتنرسم على السطح لحالها.</div>;
  return <div className="roofed">
    <div className="rf-bar">{MODES.map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setDraft([]); }}>{l}</button>)}
      <span className="rf-sp" />
      <label className="rf-ck"><input type="checkbox" checked={!!(R.map && R.map.on)} onChange={e => commit(n => { n.map = { ...(n.map || {}), on: e.target.checked ? 1 : 0 }; })} /> صورة القمر الصناعي</label>
      <button onClick={() => setV(o => ({ ...o, s: o.s * 1.3 }))}>＋</button><button onClick={() => setV(o => ({ ...o, s: o.s / 1.3 }))}>－</button></div>
    <div className="rf-hint">{mode === 'roof' || mode === 'bld' ? (mode === 'bld' ? 'ارسم المبنى أو الغرفة أو العمارة المجاورة: ' : '') + 'اضغط لتضيف نقاط الزوايا، وارجع اضغط على أول نقطة (أو Enter) لتسكّر الشكل. Shift = خطوط مستقيمة 90°. Esc يلغي.' : mode === 'tree' ? 'اضغط مكان الشجرة، وبعدين عدّل نصف القطر والارتفاع من القائمة تحت.' : mode === 'edge' ? 'اضغط على حافة السطح اللي بدك الصفوف تكون موازية إلها، والأداة بتحسب الـ Azimuth لحالها.' : mode === 'move' ? 'اسحب أي نقطة لتعدّلها.' : 'اسحب لتحرك الخريطة، وعجلة الماوس للتكبير.'}
      {!lat && <b className="bad"> · حدد إحداثيات الموقع بتبويب 1 عشان تظهر صورة القمر الصناعي.</b>}</div>
    <svg ref={svg} viewBox={'0 0 ' + Wpx + ' ' + Hpx} className="rf-svg" dir="ltr" onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={finish} style={{ cursor: mode === 'pan' ? 'grab' : 'crosshair' }}>
      <rect width={Wpx} height={Hpx} fill="#e2e8f0" />
      {T.map(t => <image key={t.k} href={t.url} x={SX(t.x)} y={SY(t.y)} width={t.w * v.s + 0.5} height={t.h * v.s + 0.5} preserveAspectRatio="none" />)}
      {(() => { const st = v.s > 20 ? 1 : v.s > 6 ? 5 : 10, L2 = []; for (let x = Math.ceil(view[0] / st) * st; x < view[2]; x += st) L2.push(<line key={'x' + x} x1={SX(x)} x2={SX(x)} y1="0" y2={Hpx} stroke="#fff" strokeOpacity={T.length ? 0.12 : 0.7} />);
        for (let y = Math.ceil(view[1] / st) * st; y < view[3]; y += st) L2.push(<line key={'y' + y} y1={SY(y)} y2={SY(y)} x1="0" x2={Wpx} stroke="#fff" strokeOpacity={T.length ? 0.12 : 0.7} />); return L2; })()}
      {R.pts.length > 2 && <polygon points={pp(R.pts)} fill="#fff" fillOpacity={T.length ? 0.25 : 0.9} stroke="#0f172a" strokeWidth={+R.hp > 0 ? 4 : 2} />}
      {R.pts.length > 2 && L.azMode === 'edge' && (() => { const i = Math.min(L.edge || 0, R.pts.length - 1), a = R.pts[i], b = R.pts[(i + 1) % R.pts.length]; return <line x1={SX(a[0])} y1={SY(a[1])} x2={SX(b[0])} y2={SY(b[1])} stroke="#16a34a" strokeWidth="6" strokeOpacity=".8" />; })()}
      {R.pts.length > 2 && R.pts.map((a, i) => { const b = R.pts[(i + 1) % R.pts.length]; return <text key={i} x={(SX(a[0]) + SX(b[0])) / 2} y={(SY(a[1]) + SY(b[1])) / 2 - 6} className="rf-dim">{fmt(RF.len(a, b), 2)} m</text>; })}
      {R.bld.map((b, i) => <g key={i} onClick={() => setSel(['bld', i])}><polygon points={pp(b.pts)} fill="#64748b" fillOpacity=".45" stroke="#334155" strokeWidth="1.5" /><text x={SX(b.pts[0][0])} y={SY(b.pts[0][1]) - 4} className="rf-dim">{b.name} · {b.h}m</text></g>)}
      {R.trees.map((t, i) => <g key={i}><circle cx={SX(t.x)} cy={SY(t.y)} r={t.r * v.s} fill="#22c55e" fillOpacity=".45" stroke="#15803d" /><text x={SX(t.x)} y={SY(t.y)} className="rf-dim" textAnchor="middle">{t.h}m</text></g>)}
      {mods}
      {draft.length > 0 && <polyline points={pp(hover ? draft.concat([hover]) : draft)} fill="none" stroke="#ea580c" strokeWidth="2" strokeDasharray="6 4" />}
      {draft.map((p, i) => <circle key={i} cx={SX(p[0])} cy={SY(p[1])} r={i === 0 ? 7 : 4} fill={i === 0 ? '#ea580c' : '#fff'} stroke="#ea580c" strokeWidth="2" />)}
      {mode === 'move' && R.pts.concat(...R.bld.map(b => b.pts)).map((p, i) => <circle key={'v' + i} cx={SX(p[0])} cy={SY(p[1])} r="5" fill="#fff" stroke="#2563eb" strokeWidth="2" />)}
      <g transform={'translate(' + (Wpx - 36) + ',36)'}><circle r="18" fill="#fff" stroke="#334155" /><path d="M0 -15 L6 4 L0 0 L-6 4 z" fill="#dc2626" /><text y="-22" textAnchor="middle" className="rf-dim">N</text></g>
      {hover && <text x="10" y={Hpx - 10} className="rf-dim">x {fmt(hover[0], 2)} · y {fmt(hover[1], 2)} m</text>}
      {T.length > 0 && <text x={Wpx - 8} y={Hpx - 8} textAnchor="end" className="rf-att">Imagery © Esri, Maxar, Earthstar Geographics</text>}
    </svg>

    {AZ ? <div className="rf-grid">
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
    </div> : <>
    <div className="rf-grid">
      <div className="rf-box"><h4>التصوينة</h4>
        <div className="rf-row">{num('ارتفاع التصوينة m', R.hp, x => commit(n => { n.hp = x; }), 0.05)}{num('بُعد الألواح عن التصوينة m', L.setback, x => set('setback', x), 0.1)}</div>
        <div className="mute">السطح والاتجاه من تبويب الاتجاه. هون بتضيف العوائق، والألواح بتنرسم لحالها من التصميم.</div>
      </div>
      <div className="rf-box"><h4>العوائق</h4>
        {!R.bld.length && !R.trees.length && <div className="mute">ما في عوائق. استعمل "مبنى/غرفة" لدرج السطح أو بيت الدرج أو العمارات المجاورة، و"شجرة" للأشجار. الارتفاع دايماً فوق مستوى سطحك.</div>}
        {R.bld.map((b, i) => <div key={'b' + i} className="rf-row"><input value={b.name} onChange={e => commit(n => { n.bld[i].name = e.target.value; })} style={{ width: 110 }} />{num('ارتفاع فوق سطحك m', b.h, x => commit(n => { n.bld[i].h = x; }), 0.1)}<button className="sm" onClick={() => commit(n => { n.bld.splice(i, 1); })}>×</button></div>)}
        {R.trees.map((t, i) => <div key={'t' + i} className="rf-row"><b>🌳 {i + 1}</b>{num('نصف القطر m', t.r, x => commit(n => { n.trees[i].r = x; }), 0.1)}{num('الارتفاع m', t.h, x => commit(n => { n.trees[i].h = x; }), 0.1)}{num('شفافية %', t.tr, x => commit(n => { n.trees[i].tr = x; }), 5)}<button className="sm" onClick={() => commit(n => { n.trees.splice(i, 1); })}>×</button></div>)}
      </div>
      <div className="rf-box"><h4>ترتيب الألواح</h4>
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
  const c = ctl.lastC;
  return <>
    <div className="card"><h2>ملخص التصميم <small>Full design</small></h2>
      <div className="kpis">{[['قدرة الألواح', fmt(c.kWp, 2) + ' kWp'], ['الانفيرتر', fmt(c.kWac, 2) + ' kWac'], ['الألواح على السطح', Y.n + ' لوح · ' + Y.tables.length + ' طاولة · ' + Y.rows + ' صف'], ['الاتجاه / الميل', 'Az ' + fmt(Y.az, 1) + '° · ' + fmt(Y.tilt, 1) + '°'], ['المسافة بين الصفوف', fmt(Y.pitch, 2) + ' m · GCR ' + fmt(Y.gcr * 100, 0) + '%'], ['الحديد', fmt(ST.steelM, 0) + ' m · ' + fmt(ST.steelKg, 0) + ' kg']].map(([k, x]) => <div key={k} className="kpi"><div>{k}</div><b>{x}</b></div>)}</div>
    </div>
    <div className="card"><h2>الرسمة الكاملة: الألواح والهيكل على السطح</h2>
      <div className="sldw" dangerouslySetInnerHTML={{ __html: RF.planSVG(R, Y, { structure: true, st: ST }) }} />
      <div className="mute">البرتقالي = الإطارات (مدادة مائلة + رجلين + دعامة)، والأصفر = المدادات الأفقية اللي بتنقط عليها الألواح (على ربع وثلاث أرباع طول اللوح).</div></div>
    <div className="card"><h2>الهيكل المعدني <small>Steel structure</small></h2>
      <div className="rf-row">{num('أقصى بُعد بين الإطارات m', L.span, x => set('span', x), 0.1)}{num('مكان الأرجل من طرف المدادة (نسبة)', L.legPos, x => set('legPos', x), 0.05)}{num('ارتفاع الحافة السفلى m', L.h1, x => set('h1', x), 0.05)}</div>
      <div className="rf-row">{[['pRaf', 'مقطع المدادة المائلة', 'kgRaf'], ['pLeg', 'مقطع الأرجل', 'kgLeg'], ['pRail', 'مقطع المدادات الأفقية', 'kgRail'], ['pBr', 'مقطع الدعامات', 'kgBr']].map(([k, l, kg]) => <span key={k} className="rf-prof">
        <label className="rf-f"><span>{l}</span><input value={L[k]} onChange={e => set(k, e.target.value)} /></label>{num('kg/m', L[kg], x => set(kg, x), 0.05, 70)}</span>)}</div>
      <h4>مقطع جانبي</h4><div className="sldw" dangerouslySetInnerHTML={{ __html: RF.sectionSVG(Y, ST) }} />
      <h4>واجهة أمامية</h4><div className="sldw" dangerouslySetInnerHTML={{ __html: RF.elevSVG(Y, ST) }} />
      <h4>جدول الكميات</h4><div dangerouslySetInnerHTML={{ __html: ctl.bomTable(ST) }} />
      <div className="mute">الأبعاد تقديرية للتصميم الأولي، والمقاطع لازم يتحقق منها مهندس إنشائي حسب أحمال الرياح.</div></div>
    <div className="card diag-card"><h2>شكل النظام الكهربائي <small>Single-line diagram</small></h2><div dangerouslySetInnerHTML={{ __html: ctl.out.diagram || ctl.diagram(c) }} /></div>
  </>;
}
