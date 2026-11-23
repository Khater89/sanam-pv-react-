'use client';
/* 3D view of the roof: the roof cut out of the site image (texture only inside the roof outline), building, parapet,
   objects (extruded with their heights), neighbouring buildings, trees and the module tables, with real sun shadows.
   Click an object to select it, drag it to move it on the roof; orbit with the mouse, wheel to zoom. */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RF from '@/lib/engine/roof';
import { presetOf } from '@/lib/engine/objects';
import { tr } from '@/lib/i18n';

const wToImg = (I, x, y) => { const r = (I.rot || 0) * Math.PI / 180, dx = x * Math.cos(r) - y * Math.sin(r), dy = x * Math.sin(r) + y * Math.cos(r); return [dx / I.mpp + I.w / 2, -dy / I.mpp + I.h / 2]; };
const shapeOf = P => { const s = new THREE.Shape(); P.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; };
const extr = (P, depth, y0, mat) => { const g = new THREE.ExtrudeGeometry(shapeOf(P), { depth: Math.max(0.01, depth), bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m; };
const label = (t0) => { const txt = tr(t0); const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = 512; c.height = 96; x.font = 'bold 44px Tajawal, system-ui, sans-serif';
  x.fillStyle = 'rgba(15,23,42,.78)'; const w = Math.min(500, x.measureText(txt).width + 36); x.beginPath(); x.roundRect((512 - w) / 2, 8, w, 80, 18); x.fill();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = /[\u0600-\u06FF]/.test(txt) ? 'rtl' : 'ltr'; x.fillText(txt, 256, 50);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.scale.set(4, 0.75, 1); s.renderOrder = 10; return s; };
const cen = P => [P.reduce((a, q) => a + q[0], 0) / P.length, P.reduce((a, q) => a + q[1], 0) / P.length];

export default function Roof3D({ R, img, Y, sun, sel, onSelect, onMove, tool = 'select', onDraw, onPush, onRotate, onModule, groundImg = true, height = 520 }) {
  const box = useRef(null), st = useRef(null);
  // one-time setup
  useEffect(() => { const el = box.current, W = el.clientWidth || 900;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W, height);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#dbe4ee');
    const cam = new THREE.PerspectiveCamera(45, W / height, 0.1, 2000); cam.position.set(-25, 30, 35);
    const ctr = new OrbitControls(cam, renderer.domElement); ctr.enableDamping = true; ctr.maxPolarAngle = Math.PI * 0.49;
    scene.add(new THREE.HemisphereLight('#ffffff', '#94a3b8', 0.75));
    const sunL = new THREE.DirectionalLight('#fff7e6', 2.2); sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048); sunL.shadow.bias = -0.0004; scene.add(sunL); scene.add(sunL.target);
    const root = new THREE.Group(); scene.add(root);
    const S = { renderer, scene, cam, ctr, sunL, root, objs: [], drag: null, ray: new THREE.Raycaster(), cb: {} }; st.current = S;
    const ptr = e => { const r = renderer.domElement.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    const planeHit = (e, y) => { S.ray.setFromCamera(ptr(e), cam); const p = new THREE.Vector3(); return S.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null; };
    const helper = new THREE.Group(); scene.add(helper); S.helper = helper; const lineMat = new THREE.LineBasicMaterial({ color: '#ea580c' });
    const drawLine = pts => { helper.children.slice().forEach(c => { helper.remove(c); c.geometry.dispose(); }); if (pts.length < 2) return;
      const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], S.drawY + 0.03, -p[1]))); helper.add(new THREE.Line(g, lineMat)); };
    const snap = v => S.snap ? Math.round(v / S.snap) * S.snap : Math.round(v * 100) / 100, hitW = e => { const p = planeHit(e, S.drawY || 0); return p ? [snap(p.x), snap(-p.z)] : null; };
    const pick = (e, list) => { S.ray.setFromCamera(ptr(e), cam); const h = S.ray.intersectObjects(list, true)[0]; if (!h) return null; let o = h.object; while (o && o.userData.kind == null && o.userData.mod == null) o = o.parent; return o; };
    const down = e => { const T = S.tool || 'select';
      if (T === 'rect') { const p = hitW(e); if (!p) return; S.drag = { t: 'rect', p0: p }; ctr.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); return; }
      if (T === 'poly') { S.click = { x: e.clientX, y: e.clientY }; return; }
      if (T === 'push') { const o = pick(e, S.objs.concat(S.body ? [S.body] : [])); if (!o) return; const k = o.userData.kind, i = o.userData.idx, h0 = k === 'building' ? S.hb : (k === 'tree' ? +(((S.R || {}).trees || [])[i] || {}).h : +(((S.R || {}).bld || [])[i] || {}).h) || 0;
        S.drag = { t: 'push', k, i, h0, y0: e.clientY, last: 0 }; ctr.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); return; }
      if (T === 'rotate') { S.drag = { t: 'rot', x0: e.clientX, applied: 0, last: 0 }; ctr.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); return; }
      if (T === 'delmod') { const o = pick(e, S.mods); if (o && o.userData.mod) S.cb.onModule && S.cb.onModule(o.userData.mod); return; }
      const o = pick(e, S.objs); if (!o || o.userData.idx == null) { S.click = { x: e.clientX, y: e.clientY }; return; }
      S.cb.onSelect && S.cb.onSelect(o.userData.kind, o.userData.idx); const p0 = planeHit(e, 0); if (!p0) return;
      S.drag = { t: 'move', o, p0, start: o.position.clone(), moved: false }; ctr.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = e => { const d = S.drag, T = S.tool || 'select';
      if (T === 'poly' && S.poly && S.poly.length) { const p = hitW(e); if (p) drawLine(S.poly.concat([p])); }
      if (!d) return; const now = performance.now();
      if (d.t === 'rect') { const p = hitW(e); if (!p) return; d.p1 = p; const [a, c] = [d.p0, p]; drawLine([a, [c[0], a[1]], c, [a[0], c[1]], a]); return; }
      if (d.t === 'push') { const dh = (d.y0 - e.clientY) * (S.centre ? S.centre[2] : 20) / 450, h = Math.max(0.1, Math.round((d.h0 + dh) * 10) / 10); d.h = h; if (now - d.last > 90) { d.last = now; S.cb.onPush && S.cb.onPush(d.k, d.i, h); } return; }
      if (d.t === 'rot') { const ang = Math.round((e.clientX - d.x0) * 0.25 * 2) / 2; if (now - d.last > 90 && ang !== d.applied) { d.last = now; S.cb.onRotate && S.cb.onRotate(ang - d.applied); d.applied = ang; } return; }
      const p = planeHit(e, 0); if (!p) return; const dx = p.x - d.p0.x, dz = p.z - d.p0.z; if (Math.hypot(dx, dz) > 0.02) d.moved = true; d.o.position.set(d.start.x + dx, d.start.y, d.start.z + dz); };
    const up = e => { const d = S.drag, T = S.tool || 'select'; S.drag = null; ctr.enabled = true;
      if (d && d.t === 'rect') { drawLine([]); if (d.p1 && Math.abs(d.p1[0] - d.p0[0]) > 0.3 && Math.abs(d.p1[1] - d.p0[1]) > 0.3) { const [a, c] = [d.p0, d.p1]; S.cb.onDraw && S.cb.onDraw([a, [c[0], a[1]], c, [a[0], c[1]]]); } return; }
      if (d && d.t === 'push') { if (d.h != null) S.cb.onPush && S.cb.onPush(d.k, d.i, d.h); return; }
      if (d && d.t === 'rot') { const ang = Math.round((e.clientX - d.x0) * 0.25 * 2) / 2; if (ang !== d.applied) S.cb.onRotate && S.cb.onRotate(ang - d.applied); return; }
      if (T === 'poly') { if (!S.click || Math.hypot(e.clientX - S.click.x, e.clientY - S.click.y) > 4) { S.click = null; return; } S.click = null; const p = hitW(e); if (!p) return; S.poly = S.poly || [];
        if (S.poly.length >= 3 && Math.hypot(p[0] - S.poly[0][0], p[1] - S.poly[0][1]) < Math.max(0.4, (S.centre ? S.centre[2] : 20) / 60)) { const P = S.poly; S.poly = []; drawLine([]); S.cb.onDraw && S.cb.onDraw(P); return; }
        S.poly.push(p); drawLine(S.poly); return; }
      if (d && d.moved) { const dx = d.o.position.x - d.start.x, dz = d.o.position.z - d.start.z; S.cb.onMove && S.cb.onMove(d.o.userData.kind, d.o.userData.idx, Math.round(dx * 100) / 100, Math.round(-dz * 100) / 100); }
      else if (!d && S.click && Math.hypot(e.clientX - S.click.x, e.clientY - S.click.y) < 4) S.cb.onSelect && S.cb.onSelect(null, null); S.click = null; };
    const dbl = () => { if ((S.tool || '') === 'poly' && S.poly && S.poly.length >= 3) { const P = S.poly; S.poly = []; drawLine([]); S.cb.onDraw && S.cb.onDraw(P); } };
    renderer.domElement.addEventListener('dblclick', dbl);
    const el2 = renderer.domElement; el2.addEventListener('pointerdown', down); el2.addEventListener('pointermove', move); el2.addEventListener('pointerup', up);
    const ro = new ResizeObserver(() => { const w = el.clientWidth || W; renderer.setSize(w, height); cam.aspect = w / height; cam.updateProjectionMatrix(); }); ro.observe(el);
    let raf; const loop = () => { raf = requestAnimationFrame(loop); ctr.update(); renderer.render(scene, cam); }; loop();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); el2.removeEventListener('pointerdown', down); el2.removeEventListener('pointermove', move); el2.removeEventListener('pointerup', up); ctr.dispose(); renderer.dispose(); el.removeChild(el2); st.current = null; };
  }, []); // eslint-disable-line
  useEffect(() => { const S = st.current; if (!S) return; S.cb = { onSelect, onMove, onDraw, onPush, onRotate, onModule }; if (S.tool !== tool) { S.poly = []; S.helper && S.helper.children.slice().forEach(c => S.helper.remove(c)); } S.tool = tool; S.snap = 0.25; S.R = R; S.hb = +R.hb > 0 ? +R.hb : 3; S.drawY = R.pts && R.pts.length > 2 ? 0 : 0; });

  // (re)build the model when the roof, image or layout change
  const key = JSON.stringify([R.pts, R.bld, R.trees, R.hp, R.hb, R.img, R.lay, Y ? [Y.n, Y.pitch, Y.az, Y.tilt, Y.h1, Y.mS, Y.mU, Y.nr] : 0, sel, !!img, groundImg]);
  useEffect(() => { const S = st.current; if (!S) return; const { root } = S;
    root.children.slice().forEach(c => { root.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map && !m.map.userData.keep) m.map.dispose(); m.dispose(); }); }); });
    S.objs = []; S.mods = []; S.body = null;
    const texOf = () => { if (!img) return null; if (S.tex && S.texSrc === img) return S.tex; if (S.tex) S.tex.dispose(); const tx = new THREE.TextureLoader().load(img); tx.colorSpace = THREE.SRGBColorSpace; tx.userData.keep = 1; S.tex = tx; S.texSrc = img; return tx; };
    const underlay = y => { if (!img || !R.img || !groundImg) return; const I = R.img, g = new THREE.PlaneGeometry(I.w * I.mpp, I.h * I.mpp); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: texOf(), transparent: true, opacity: 0.9 })); m.rotation.y = -(I.rot || 0) * Math.PI / 180; m.position.y = y; m.receiveShadow = true; root.add(m); };
    if (!R.pts || R.pts.length < 3) { // empty: drawing board (ground at the drawing level, 1 m grid, site image underneath)
      const gr = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#e8eee2' })); gr.rotation.x = -Math.PI / 2; gr.position.y = -0.02; gr.receiveShadow = true; root.add(gr);
      const gh = new THREE.GridHelper(100, 100, '#94a3b8', '#cbd5e1'); gh.position.y = -0.01; root.add(gh); underlay(0);
      const nA = label('N ↑ شمال'); nA.position.set(0, 0.5, -26); root.add(nA); S.centre = [0, 0, 30]; S.ctr.target.set(0, 0, 0); if (!S.framed0) { S.cam.position.set(0, 45, 30); S.framed0 = true; } placeSun(S, sun); return; }
    const hb = +R.hb > 0 ? +R.hb : 3, hp = +R.hp || 0, b = R.pts.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    const span = Math.max(b[2] - b[0], b[3] - b[1], 10), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    // ground
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(span * 6, span * 6), new THREE.MeshStandardMaterial({ color: '#cfd8c4' })); gr.rotation.x = -Math.PI / 2; gr.position.set(cx, -hb - 0.01, -cy); gr.receiveShadow = true; root.add(gr);
    // compass on the ground next to the building: N/S/E/W, true south arrow (red) and the facade direction (green) with its deviation from south
    { const R0 = Math.max(3, span * 0.22), x0 = b[2] + R0 * 1.6, z0 = -b[1] + R0 * 1.6, y0 = -hb + 0.03, grp = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(R0 * 0.96, R0, 64), new THREE.MeshBasicMaterial({ color: '#334155', side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; grp.add(ring);
      const arrow = (ang, len, col, w) => { const sh = new THREE.Shape(); sh.moveTo(-w, 0); sh.lineTo(w, 0); sh.lineTo(w, len * 0.78); sh.lineTo(w * 2.4, len * 0.78); sh.lineTo(0, len); sh.lineTo(-w * 2.4, len * 0.78); sh.lineTo(-w, len * 0.78); sh.lineTo(-w, 0);
        const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; const g2 = new THREE.Group(); g2.add(m); g2.rotation.y = ang; return g2; };
      // three: north = -z. Rotation about y by a turns +y(shape)→-z(north) after rotateX; south = PI
      grp.add(arrow(0, R0 * 0.9, '#64748b', R0 * 0.03)); const sA = arrow(Math.PI, R0 * 0.95, '#dc2626', R0 * 0.045); sA.position.y = 0.01; grp.add(sA);
      const fAz = R.pts.length > 2 && R.lay ? RF.edgeAz(R.pts, Math.min(R.lay.edge || 0, R.pts.length - 1)) : null, tAz = Y ? Y.az : null;
      if (fAz != null) { const fa = arrow(Math.PI - fAz * Math.PI / 180, R0 * 0.8, '#16a34a', R0 * 0.035); fa.position.y = 0.02; grp.add(fa); }
      if (tAz != null && Math.abs(tAz - (fAz || 0)) > 0.4) { const ta = arrow(Math.PI - tAz * Math.PI / 180, R0 * 0.7, '#2563eb', R0 * 0.03); ta.position.y = 0.03; grp.add(ta); }
      [['N شمال', 0, -1], ['S جنوب', 0, 1], ['E شرق', 1, 0], ['W غرب', -1, 0]].forEach(([t, dx, dz]) => { const l = label(t); l.scale.multiplyScalar(R0 / 3); l.position.set(dx * R0 * 1.35, 0.8, dz * R0 * 1.35); grp.add(l); });
      if (fAz != null) { const d = Math.round(fAz * 10) / 10, l = label(Math.abs(d) < 0.5 ? 'المبنى مواجه للجنوب' : 'المبنى منحرف ' + Math.abs(d) + '° ' + (d > 0 ? 'للغرب' : 'للشرق')); l.scale.multiplyScalar(R0 / 2.2); l.position.set(0, 0.8, R0 * 1.95); grp.add(l); }
      grp.position.set(x0, y0, z0); root.add(grp); }
    // building body + roof slab
    const body = extr(R.pts, hb, -hb, new THREE.MeshStandardMaterial({ color: '#e7e1d6' })); body.userData = { kind: 'building', idx: 0 }; S.body = body; root.add(body); underlay(-hb + 0.005);
    // 1 m grid on the roof (clipped to the outline) to place objects; drags snap to 25 cm
    { const segs = [], X = [R.pts.map(p => p[0]), R.pts.map(p => p[1])], cut = (ax, v) => { const xs = []; R.pts.forEach((p, i) => { const q = R.pts[(i + 1) % R.pts.length], a = ax ? p[1] : p[0], c = ax ? q[1] : q[0];
        if ((a > v) !== (c > v)) { const t = (v - a) / (c - a); xs.push(ax ? p[0] + t * (q[0] - p[0]) : p[1] + t * (q[1] - p[1])); } }); return xs.sort((m, n) => m - n); };
      for (let ax = 0; ax < 2; ax++) { const lo = Math.ceil(Math.min(...X[ax])), hi = Math.floor(Math.max(...X[ax])); for (let v = lo; v <= hi; v++) { const xs = cut(ax === 1, v + 1e-6);
        for (let k = 0; k + 1 < xs.length; k += 2) segs.push(ax === 0 ? [v, xs[k], v, xs[k + 1]] : [xs[k], v, xs[k + 1], v]); } }
      const g = new THREE.BufferGeometry().setFromPoints(segs.flatMap(([x1, y1, x2, y2]) => [new THREE.Vector3(x1, 0.012, -y1), new THREE.Vector3(x2, 0.012, -y2)]));
      root.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#64748b', transparent: true, opacity: 0.35 }))); }
    // roof top: the site image cut to the roof outline (UV from the image placement), else plain
    const tg = new THREE.ShapeGeometry(shapeOf(R.pts)); tg.rotateX(-Math.PI / 2); tg.translate(0, 0.005, 0);
    let tmat = new THREE.MeshStandardMaterial({ color: '#f1ede4' });
    if (img && R.img) { const I = R.img, pos = tg.attributes.position, uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { const q = wToImg(I, pos.getX(i), -pos.getZ(i)); uv[2 * i] = q[0] / I.w; uv[2 * i + 1] = 1 - q[1] / I.h; }
      tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); tmat = new THREE.MeshStandardMaterial({ map: texOf() }); }
    const top = new THREE.Mesh(tg, tmat); top.receiveShadow = true; root.add(top);
    // parapet
    if (hp > 0) R.pts.forEach((a, i) => { const c = R.pts[(i + 1) % R.pts.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.05) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(L, hp, 0.2), new THREE.MeshStandardMaterial({ color: '#d6cfc2' })); m.position.set((a[0] + c[0]) / 2, hp / 2, -(a[1] + c[1]) / 2);
      m.rotation.y = Math.atan2(c[1] - a[1], c[0] - a[0]); m.castShadow = m.receiveShadow = true; root.add(m); });
    // objects
    (R.bld || []).forEach((B, i) => { if (!B.pts || B.pts.length < 3) return; const g = new THREE.Group(), pr = presetOf(B.kind), on = sel && sel[0] === 'bld' && sel[1] === i;
      const ground = B.ref === 'ground', base = ground ? -hb : 0, H = Math.max(0.05, (+B.h || 0) + (ground ? hb : 0)), col = on ? '#f59e0b' : (pr && pr.color) || (ground ? '#64748b' : '#9ca3af');
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: on ? '#7c2d12' : '#000', emissiveIntensity: on ? 0.25 : 0 });
      if (pr && pr.top && H > pr.top.h + 0.2) { g.add(extr(B.pts, H - pr.top.h, base, mat)); const c = cen(B.pts), k = pr.top.k;
        g.add(extr(B.pts.map(p => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]), pr.top.h, base + H - pr.top.h, new THREE.MeshStandardMaterial({ color: on ? '#fbbf24' : '#e2e8f0' }))); }
      else g.add(extr(B.pts, H, base, mat));
      const c = cen(B.pts), lb = label((B.name || 'جسم') + ' · ' + (ground && B.hg !== '' && B.hg != null ? (Math.round(+B.hg * 10) / 10) + ' m من الأرض' : (Math.round((+B.h || 0) * 10) / 10) + ' m')); lb.position.set(c[0], base + H + 0.8, -c[1]); g.add(lb);
      g.userData = { kind: 'bld', idx: i }; root.add(g); S.objs.push(g); });
    // trees
    (R.trees || []).forEach((t, i) => { const g = new THREE.Group(), ground = t.ref === 'ground', base = ground ? -hb : 0, top = (+t.h || 0) + (ground ? hb : 0), r = +t.r || 1, on = sel && sel[0] === 'tree' && sel[1] === i;
      if (top <= 0.1) return; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, top * 0.35, 8), new THREE.MeshStandardMaterial({ color: '#7c5a3a' })); tr.position.set(+t.x, base + top * 0.175, -t.y); tr.castShadow = true; g.add(tr);
      const cr = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: on ? '#f59e0b' : '#3f8f4a', transparent: true, opacity: 0.95 })); cr.scale.set(r, Math.max(0.5, top * 0.33), r); cr.position.set(+t.x, base + top * 0.67, -t.y); cr.castShadow = true; g.add(cr);
      const lb = label('شجرة · ' + (Math.round((+t.h || 0) * 10) / 10) + ' m'); lb.position.set(+t.x, base + top + 0.8, -t.y); g.add(lb);
      g.userData = { kind: 'tree', idx: i }; root.add(g); S.objs.push(g); });
    // module tables with real module dimensions + the steel structure (frames: rafter, front/rear/middle legs, diagonal brace; horizontal rails)
    if (Y && Y.n) { const F = Y.F, b = Y.b, cb = Math.cos(b), sb = Math.sin(b), gp = (Y.S - Y.nr * Y.mS) / Math.max(1, Y.nr - 1), ST = RF.structure(Y, R.lay || {});
      const W3 = (u, v, z) => { const w = RF.toW(F, u, v); return new THREE.Vector3(w[0], z, -w[1]); }, P3 = (t, u, s, dz) => W3(u, t.vF - s * cb, Y.h1 + s * sb + (dz || 0));
      const steel = new THREE.MeshStandardMaterial({ color: '#9aa4b2', metalness: 0.6, roughness: 0.45 }), railM = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.6, roughness: 0.35 });
      const bar = (p1, p2, th, mat) => { const L = p1.distanceTo(p2); if (L < 0.01) return; const m = new THREE.Mesh(new THREE.BoxGeometry(th, th, L), mat); m.position.copy(p1).add(p2).multiplyScalar(0.5); m.lookAt(p2); m.castShadow = m.receiveShadow = true; root.add(m); };
      // module texture: cells grid (portrait 6 × 12 half-cut look)
      const cv = document.createElement('canvas'), cx2 = cv.getContext('2d'), port = Y.mS >= Y.mU; cv.width = port ? 192 : 384; cv.height = port ? 384 : 192; cx2.fillStyle = '#0b1f4d'; cx2.fillRect(0, 0, cv.width, cv.height);
      const nc = port ? 6 : 12, nr2 = port ? 12 : 6, cw = (cv.width - 8) / nc, ch = (cv.height - 8) / nr2; cx2.fillStyle = '#1d3b8b';
      for (let i = 0; i < nc; i++) for (let j = 0; j < nr2; j++) cx2.fillRect(4 + i * cw + 1, 4 + j * ch + 1, cw - 2, ch - 2); cx2.strokeStyle = '#cbd5e1'; cx2.lineWidth = 6; cx2.strokeRect(3, 3, cv.width - 6, cv.height - 6);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const modM = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.25, roughness: 0.35 }), sideM = new THREE.MeshStandardMaterial({ color: '#cbd5e1' });
      Y.tables.forEach((t, ti) => { const T = ST && ST.tables[ti];
        t.mods.forEach(m => { const a = m.j * (Y.mS + (Y.nr > 1 ? gp : 0)), c0 = P3(t, (m.u0 + m.u1) / 2, a + Y.mS / 2, 0.03), g = new THREE.BoxGeometry(m.u1 - m.u0, 0.035, Y.mS);
          const mesh = new THREE.Mesh(g, [sideM, sideM, modM, sideM, sideM, sideM]); mesh.position.copy(c0);
          const up = P3(t, (m.u0 + m.u1) / 2, a + Y.mS, 0.03).sub(P3(t, (m.u0 + m.u1) / 2, a, 0.03)).normalize(), ax = W3(1, 0, 0).sub(W3(0, 0, 0)).normalize(), nrm = new THREE.Vector3().crossVectors(up, ax).normalize();
          if (nrm.y < 0) nrm.negate(); const zAx = up.clone().negate(), xAx = new THREE.Vector3().crossVectors(nrm, zAx).normalize(); mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, nrm, zAx));
          mesh.castShadow = mesh.receiveShadow = true; mesh.userData = { mod: m.key }; S.mods.push(mesh); root.add(mesh); });
        if (ti === 0) (Y.ghost || []).forEach(gm => { const tg = { vF: gm.vF }, a = gm.j * (Y.mS + (Y.nr > 1 ? gp : 0)), c0 = P3(tg, (gm.u0 + gm.u1) / 2, a + Y.mS / 2, 0.03);
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(gm.u1 - gm.u0 - 0.04, 0.03, Y.mS - 0.04), new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.35, depthWrite: false })); mesh.position.copy(c0);
          const up = P3(tg, 0, a + Y.mS, 0.03).sub(P3(tg, 0, a, 0.03)).normalize(), ax = W3(1, 0, 0).sub(W3(0, 0, 0)).normalize(), nrm = new THREE.Vector3().crossVectors(up, ax).normalize(); if (nrm.y < 0) nrm.negate();
          const zAx = up.clone().negate(), xAx = new THREE.Vector3().crossVectors(nrm, zAx).normalize(); mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, nrm, zAx));
          mesh.userData = { mod: gm.key, ghost: 1 }; S.mods.push(mesh); root.add(mesh); });
        if (!T) return; const e = ST.e, SL = Y.S;
        for (let k = 0; k < T.nf; k++) { const u = t.u0 + ST.ov + k * T.sp; if (u > t.u1 + 0.01) break;
          const r0 = P3(t, u, -0.03, -0.05), r1 = P3(t, u, SL + 0.02, -0.05); bar(r0, r1, 0.06, steel); // rafter
          const fT = P3(t, u, e, -0.05), fB = W3(u, t.vF - e * cb, 0), rT = P3(t, u, SL - e, -0.05), rB = W3(u, t.vF - (SL - e) * cb, 0);
          bar(fB, fT, 0.06, steel); bar(rB, rT, 0.06, steel); bar(fB, rT, 0.04, steel);
          if (ST.midLeg) { const mT = P3(t, u, SL / 2, -0.05), mB = W3(u, t.vF - SL / 2 * cb, 0); bar(mB, mT, 0.06, steel); }
          [fB, rB].forEach(p => { const bp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2), steel); bp.position.copy(p); root.add(bp); }); }
        const rows = Math.max(1, Y.nr); for (let j = 0; j < rows; j++) [0.25, 0.75].forEach(fr => { const sd = j * (Y.mS + (Y.nr > 1 ? gp : 0)) + fr * Y.mS; bar(P3(t, t.u0 - 0.05, sd, -0.015), P3(t, t.u1 + 0.05, sd, -0.015), 0.04, railM); }); }); }
    // camera target and shadow box
    S.ctr.target.set(cx, 0, -cy); const sc = S.sunL.shadow.camera, ext = span * 1.6; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5; sc.far = span * 12; sc.updateProjectionMatrix();
    S.centre = [cx, cy, span]; if (!S.framed) { S.cam.position.set(cx - span * 0.9, span * 1.1, -cy + span * 1.3); S.framed = true; }
    placeSun(S, sun);
  }, [key]); // eslint-disable-line
  useEffect(() => { if (st.current) placeSun(st.current, sun); }, [sun && sun.el, sun && sun.az]); // eslint-disable-line
  return <div ref={box} className="rf-3d" style={{ height }} />;
}

function placeSun(S, sun) { if (!S.centre) return; const [cx, cy, span] = S.centre, el = Math.max(2, sun ? sun.el : 45) * Math.PI / 180, az = (sun ? sun.az : 0) * Math.PI / 180, d = span * 5;
  // towards the sun: South = −y (three: +z), West = −x; azimuth from South, West +
  S.sunL.position.set(cx - Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, -cy + Math.cos(az) * Math.cos(el) * d); S.sunL.target.position.set(cx, 0, -cy);
  S.sunL.intensity = sun && sun.el > 0 ? 2.2 : 0.2; }
