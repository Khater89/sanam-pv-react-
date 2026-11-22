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

export default function Roof3D({ R, img, Y, sun, sel, onSelect, onMove, height = 520 }) {
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
    const down = e => { S.ray.setFromCamera(ptr(e), cam); const hit = S.ray.intersectObjects(S.objs, true)[0];
      if (!hit) { S.click = { x: e.clientX, y: e.clientY }; return; } let o = hit.object; while (o && o.userData.idx == null) o = o.parent; if (!o) return;
      S.cb.onSelect && S.cb.onSelect(o.userData.kind, o.userData.idx); const p0 = planeHit(e, 0); if (!p0) return;
      S.drag = { o, p0, start: o.position.clone(), moved: false }; ctr.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = e => { const d = S.drag; if (!d) return; const p = planeHit(e, 0); if (!p) return; const dx = p.x - d.p0.x, dz = p.z - d.p0.z; if (Math.hypot(dx, dz) > 0.02) d.moved = true; d.o.position.set(d.start.x + dx, d.start.y, d.start.z + dz); };
    const up = e => { const d = S.drag; S.drag = null; ctr.enabled = true;
      if (d && d.moved) { const dx = d.o.position.x - d.start.x, dz = d.o.position.z - d.start.z; S.cb.onMove && S.cb.onMove(d.o.userData.kind, d.o.userData.idx, Math.round(dx * 100) / 100, Math.round(-dz * 100) / 100); }
      else if (!d && S.click && Math.hypot(e.clientX - S.click.x, e.clientY - S.click.y) < 4) S.cb.onSelect && S.cb.onSelect(null, null); S.click = null; };
    const el2 = renderer.domElement; el2.addEventListener('pointerdown', down); el2.addEventListener('pointermove', move); el2.addEventListener('pointerup', up);
    const ro = new ResizeObserver(() => { const w = el.clientWidth || W; renderer.setSize(w, height); cam.aspect = w / height; cam.updateProjectionMatrix(); }); ro.observe(el);
    let raf; const loop = () => { raf = requestAnimationFrame(loop); ctr.update(); renderer.render(scene, cam); }; loop();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); el2.removeEventListener('pointerdown', down); el2.removeEventListener('pointermove', move); el2.removeEventListener('pointerup', up); ctr.dispose(); renderer.dispose(); el.removeChild(el2); st.current = null; };
  }, []); // eslint-disable-line
  useEffect(() => { if (st.current) st.current.cb = { onSelect, onMove }; });

  // (re)build the model when the roof, image or layout change
  const key = JSON.stringify([R.pts, R.bld, R.trees, R.hp, R.hb, R.img, R.lay, Y ? [Y.n, Y.pitch, Y.az, Y.tilt, Y.h1, Y.mS, Y.mU, Y.nr] : 0, sel, !!img]);
  useEffect(() => { const S = st.current; if (!S) return; const { root } = S;
    root.children.slice().forEach(c => { root.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); });
    S.objs = []; if (!R.pts || R.pts.length < 3) return;
    const hb = +R.hb > 0 ? +R.hb : 3, hp = +R.hp || 0, b = R.pts.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[2], p[0]), Math.max(a[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
    const span = Math.max(b[2] - b[0], b[3] - b[1], 10), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    // ground
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(span * 6, span * 6), new THREE.MeshStandardMaterial({ color: '#cfd8c4' })); gr.rotation.x = -Math.PI / 2; gr.position.set(cx, -hb - 0.01, -cy); gr.receiveShadow = true; root.add(gr);
    // building body + roof slab
    root.add(extr(R.pts, hb, -hb, new THREE.MeshStandardMaterial({ color: '#e7e1d6' })));
    // roof top: the site image cut to the roof outline (UV from the image placement), else plain
    const tg = new THREE.ShapeGeometry(shapeOf(R.pts)); tg.rotateX(-Math.PI / 2); tg.translate(0, 0.005, 0);
    let tmat = new THREE.MeshStandardMaterial({ color: '#f1ede4' });
    if (img && R.img) { const I = R.img, pos = tg.attributes.position, uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) { const q = wToImg(I, pos.getX(i), -pos.getZ(i)); uv[2 * i] = q[0] / I.w; uv[2 * i + 1] = 1 - q[1] / I.h; }
      tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); const tx = new THREE.TextureLoader().load(img); tx.colorSpace = THREE.SRGBColorSpace; tmat = new THREE.MeshStandardMaterial({ map: tx }); }
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
          mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); });
        if (!T) return; const e = ST.e, S = Y.S;
        for (let k = 0; k < T.nf; k++) { const u = t.u0 + ST.ov + k * T.sp; if (u > t.u1 + 0.01) break;
          const r0 = P3(t, u, -0.03, -0.05), r1 = P3(t, u, S + 0.02, -0.05); bar(r0, r1, 0.06, steel); // rafter
          const fT = P3(t, u, e, -0.05), fB = W3(u, t.vF - e * cb, 0), rT = P3(t, u, S - e, -0.05), rB = W3(u, t.vF - (S - e) * cb, 0);
          bar(fB, fT, 0.06, steel); bar(rB, rT, 0.06, steel); bar(fB, rT, 0.04, steel);
          if (ST.midLeg) { const mT = P3(t, u, S / 2, -0.05), mB = W3(u, t.vF - S / 2 * cb, 0); bar(mB, mT, 0.06, steel); }
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
