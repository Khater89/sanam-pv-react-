/* Sanam PV — roof / site geometry, panel layout, near shading (PVsyst-style) and steel structure.
   Coordinates: metres, x = East, y = North, z = up, origin = site lat/lon. Heights are above OUR roof surface.
   Azimuth convention = PVsyst: from South, West positive, East negative.

   Near shading follows PVsyst's method:
   - beam shading factor table on a sun (azimuth × height) grid, from the 3D scene (PVsyst "Shading factor table"),
     interpolated hour by hour; circumsolar treated like beam;
   - diffuse shading factor = integral of the beam factor over the sky hemisphere, isotropic, weighted by the
     incidence on the plane (PVsyst "diffuse factor");
   - albedo factor (we use the diffuse factor for the ground part);
   - "linear" = shaded fraction of the module area; "according to strings" = fraction of strings touched by a shadow,
     weighted by the "fraction for electrical effect" (PVsyst default 100 %). */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

export const DEF_LAY = { azMode: 'edge', edge: 0, az: 0, orient: 'P', nr: 2, gapX: 0.02, gapY: 0.02, pitchMode: 'auto', pitch: '', h1: 0.5,
  setback: 0.8, fill: 'design', elec: 'linear', kEl: 100, span: 2.0, legPos: 0.2, tFrom: 10, tTo: 14,
  pRaf: 'C 41×41×2.5 مجلفن', pLeg: 'C 41×41×2.5 مجلفن', pRail: 'C 41×41×2 مجلفن', pBr: 'L 40×40×4 مجلفن', kgRaf: 2.4, kgLeg: 2.4, kgRail: 1.95, kgBr: 2.42 };
export function blankRoof() { return { v: 1, pts: [], hp: 1.0, bld: [], trees: [], lay: Object.assign({}, DEF_LAY), map: { on: 1 } }; }
export function parseRoof(s) { if (!s) return null; try { const r = typeof s === 'string' ? JSON.parse(s) : s; r.lay = Object.assign({}, DEF_LAY, r.lay || {}); r.bld = r.bld || []; r.trees = r.trees || []; return r; } catch (e) { return null; } }

/* ---------- 2D helpers ---------- */
export function area(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
export function inside(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j];
  if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function segDist(x, y, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((x - a[0]) * dx + (y - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); }
function edgeDist(P, x, y) { let d = 1e9; for (let i = 0; i < P.length; i++) d = Math.min(d, segDist(x, y, P[i], P[(i + 1) % P.length])); return d; }
export const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/* azimuth (PVsyst) of the facing direction normal to roof edge i, the side closest to South */
export function edgeAz(P, i) { const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1];
  const n1 = [dy, -dx], n2 = [-dy, dx], az = n => Math.atan2(-n[0], -n[1]) * R2D, a1 = az(n1), a2 = az(n2);
  return Math.abs(a1) <= Math.abs(a2) ? a1 : a2; }
export function layAz(R) { const L = R.lay; if (L.azMode === 'south') return 0; if (L.azMode === 'edge' && R.pts.length > 2) return Math.round(edgeAz(R.pts, Math.min(L.edge || 0, R.pts.length - 1)) * 10) / 10; return +L.az || 0; }

/* frame: u along the rows, f = facing direction (horizontal) */
export function frame(azDeg) { const a = azDeg * D2R; return { u: [Math.cos(a), -Math.sin(a)], f: [-Math.sin(a), -Math.cos(a)] }; }
const toF = (F, p) => [p[0] * F.u[0] + p[1] * F.u[1], p[0] * F.f[0] + p[1] * F.f[1]];
export const toW = (F, U, V) => [U * F.u[0] + V * F.f[0], U * F.u[1] + V * F.f[1]];

/* sun position from solar time (for row pitch and sun path) */
export function sunSolar(lat, decl, hSolar) { const la = lat * D2R, d = decl * D2R, w = (hSolar - 12) * 15 * D2R;
  const se = Math.sin(la) * Math.sin(d) + Math.cos(la) * Math.cos(d) * Math.cos(w), el = Math.asin(se);
  const az = Math.atan2(Math.sin(w), Math.cos(w) * Math.sin(la) - Math.tan(d) * Math.cos(la)); return { el: el * R2D, az: az * R2D }; }
export const declOf = doy => 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365);

/* ---------- layout ---------- */
export function layout(R, o) { // o: { tilt, L (module long side m), W (short side), nTarget, lat }
  const L = R.lay, P = R.pts; if (!P || P.length < 3 || !o.L || !o.W) return null;
  const az = layAz(R), F = frame(az), b = (o.tilt || 0) * D2R;
  const mS = L.orient === 'L' ? o.W : o.L, mU = L.orient === 'L' ? o.L : o.W, nr = Math.max(1, +L.nr || 1), mS0 = mS, mU0 = mU;
  const S = nr * mS + (nr - 1) * (+L.gapY || 0), D = S * Math.cos(b), H = S * Math.sin(b), h1 = +L.h1 || 0, cw = mU + (+L.gapX || 0);
  // pitch: shade-free between tFrom and tTo (solar time) on 21 December
  let pitch = +L.pitch, gapMin = 0, lim = null;
  if (L.pitchMode !== 'manual' || !pitch) { const dec = declOf(355); for (let t = +L.tFrom || 10; t <= (+L.tTo || 14) + 1e-9; t += 0.25) {
      const s = sunSolar(o.lat || 32, dec, t); if (s.el <= 1) continue; const g = H * Math.cos((s.az - az) * D2R) / Math.tan(s.el * D2R); if (g > gapMin) { gapMin = g; lim = s; } }
    pitch = D + gapMin; }
  pitch = Math.max(pitch, D + 0.05);
  const PF = P.map(p => toF(F, p)), Us = PF.map(p => p[0]), Vs = PF.map(p => p[1]);
  const uMin = Math.min(...Us), uMax = Math.max(...Us), vMax = Math.max(...Vs), vMin = Math.min(...Vs), sb = +L.setback || 0;
  // an object blocks a module only if it reaches the module's underside (+ clearance): raising the structure lets modules pass over low objects
  const CLR = 0.2, blk = (R.bld || []).filter(x => x.pts && x.pts.length > 2).map(x => ({ q: x.pts, h: x.block || x.kind === 'opening' || x.kind === 'keepout' || x.kind === 'panels' ? 999 : x.ref === 'ground' ? 0 : +x.h || 0 })), trees = R.trees || [];
  const ok = (U, V, z) => { const w = toW(F, U, V); if (!inside(P, w[0], w[1]) || edgeDist(P, w[0], w[1]) < sb - 0.01) return false; z = z == null ? h1 : z;
    for (const B of blk) if (B.h + CLR > z && (inside(B.q, w[0], w[1]) || edgeDist(B.q, w[0], w[1]) < 0.3)) return false;
    for (const t of trees) if ((+t.h || 0) + CLR > z && Math.hypot(w[0] - t.x, w[1] - t.y) < (+t.r || 0) + 0.3) return false; return true; };
  const off = new Set(L.off || []), key = (u0, vF, j) => Math.round(u0 * 10) + ':' + Math.round(vF * 10) + ':' + j;
  const target = L.fill === 'max' ? 1e9 : L.fill === 'count' ? Math.max(0, Math.round(+L.nMan || 0)) : !o.nTarget ? 1e9 : o.nTarget, tables = []; let n = 0, row = 0, nOff = 0;
  // single structure (domestic / rooftop): all modules on ONE table — the fewest modules up the slope that fits, frontmost, centred
  if (o.single && target < 1e9) for (const flip of [false, true]) {
    const mS = flip ? mU0 : mS0, mU = flip ? mS0 : mU0, cw = mU + (+L.gapX || 0);
    for (let k = flip ? 1 : nr; k <= 6; k++) { const S1 = k * mS + (k - 1) * (+L.gapY || 0), D1 = S1 * Math.cos(b), cols = Math.ceil(target / k);
      for (let vF = vMax - sb - 0.05; vF - D1 >= vMin + sb - 0.01; vF -= 0.25) {
        const H1 = S1 * Math.sin(b), okc = []; for (let u0 = uMin + sb + 0.05; u0 + mU <= uMax - sb + 0.01; u0 += cw) { const u1 = u0 + mU; let g = ok(u0, vF, h1) && ok(u1, vF, h1) && ok(u0, vF - D1, h1 + H1) && ok(u1, vF - D1, h1 + H1);
          for (let q = 1; g && q < 4; q++) g = ok(u0, vF - D1 * q / 4, h1 + H1 * q / 4) && ok(u1, vF - D1 * q / 4, h1 + H1 * q / 4); okc.push({ u0, u1, g }); }
        let best = null, a = -1; okc.forEach((c, i) => { if (c.g) { if (a < 0) a = i; if (i - a + 1 >= cols) { const mid = (okc.length - 1) / 2, st = i - cols + 1, d = Math.abs(st + (cols - 1) / 2 - mid); if (!best || d < best.d) best = { st, d }; } } else a = -1; });
        if (!best) continue;
        const t = { row: 0, vF, u0: okc[best.st].u0, cols, mods: [] }; let m = 0, slot = 0;
        for (let c = 0; c < cols; c++) { const col = okc[best.st + c], kk = Math.min(k, target - slot); for (let j = 0; j < kk; j++) { const ky = key(col.u0, vF, j); if (off.has(ky)) nOff++; else t.mods.push({ u0: col.u0, u1: col.u1, j, idx: m++, key: ky }); } slot += kk; t.u1 = col.u1; }
        t.id = 1; t.len = t.u1 - t.u0;
        return { az, F, tilt: o.tilt || 0, b, S: S1, D: D1, H: S1 * Math.sin(b), h1, pitch: D1, gapMin: 0, lim: null, mS, mU, nr: k, cw, tables: [t], n: m, nOff, rows: 1, gcr: 1, single: true, flipped: flip,
          areaRoof: Math.abs(area(P)), kWp: o.Pmax ? m * o.Pmax / 1000 : null }; } } }
  // each row slides (10 cm steps, within one pitch) to where most modules fit, so slanted edges and objects waste less space; the next row keeps the shade-free pitch
  const colsAt = vF => { const cols = []; for (let u0 = uMin + sb + 0.05; u0 + mU <= uMax - sb + 0.01; u0 += cw) { const u1 = u0 + mU;
      cols.push({ u0, u1, ok: ok(u0, vF, h1) && ok(u1, vF, h1) && ok(u0, vF - D, h1 + H) && ok(u1, vF - D, h1 + H) && ok((u0 + u1) / 2, vF - D / 2, h1 + H / 2) && ok(u0, vF - D / 2, h1 + H / 2) && ok(u1, vF - D / 2, h1 + H / 2) }); } return cols; };
  for (let vS = vMax - sb - 0.05; vS - D >= vMin + sb - 0.01 && n < target; row++) {
    let vF = vS, cols = null, best = -1; for (let v = vS; v > vS - pitch + 0.001 && v - D >= vMin + sb - 0.01; v -= 0.1) { const c = colsAt(v), k = c.filter(x => x.ok).length; if (k > best) { best = k; vF = v; cols = c; } }
    if (!cols || best <= 0) { vS -= pitch; continue; } vS = vF - pitch;
    const runs = []; let cur = null; cols.forEach((c, i) => { if (c.ok) { if (!cur) runs.push(cur = { a: i, b: i }); else cur.b = i; } else cur = null; });
    const cap = runs.reduce((x, r) => x + (r.b - r.a + 1), 0) * nr; let pick = null;
    if (n + cap > target) { const need = Math.ceil((target - n) / nr), mid = (cols.length - 1) / 2; // partial row: centre it
      runs.filter(r => r.b - r.a + 1 >= need).sort((x, y) => Math.abs((x.a + x.b) / 2 - mid) - Math.abs((y.a + y.b) / 2 - mid)).slice(0, 1).forEach(r => {
        const c0 = Math.round((r.a + r.b + 1 - need) / 2); pick = { a: Math.max(r.a, Math.min(r.b - need + 1, c0)), n: need }; }); }
    const use = i => !pick || (i >= pick.a && i < pick.a + pick.n);
    let run = null; const flush = () => { if (run && run.cols > 0) tables.push(run); run = null; };
    cols.forEach((c, i) => { if (n >= target) return; if (!c.ok || !use(i)) { flush(); return; }
      if (!run) run = { row, vF, u0: c.u0, cols: 0, mods: [] };
      const k = Math.min(nr, target - n); for (let j = 0; j < k; j++) { const ky = key(c.u0, vF, j); if (off.has(ky)) nOff++; else run.mods.push({ u0: c.u0, u1: c.u1, j, idx: n++, key: ky }); } run.cols++; run.u1 = c.u1; });
    flush(); }
  for (let i = tables.length - 1; i >= 0; i--) if (!tables[i].mods.length) tables.splice(i, 1);
  tables.forEach((t, i) => { t.id = i + 1; t.len = t.u1 - t.u0; });
  return { az, F, tilt: o.tilt || 0, b, S, D, H, h1, pitch, gapMin, lim, mS, mU, nr, cw, tables, n, nOff, rows: row, gcr: S / pitch, singleFail: !!o.single && target < 1e9,
    areaRoof: Math.abs(area(P)), kWp: o.Pmax ? n * o.Pmax / 1000 : null };
}

/* ---------- near shading ---------- */
export const SH_AZ = []; for (let a = -180; a <= 180; a += 10) SH_AZ.push(a);
export const SH_EL = [1, 3, 6, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90];
function sceneOf(R, Y) { const F = Y.F, walls = [], trees = [], hp = +R.hp || 0;
  if (hp > 0) R.pts.forEach((p, i) => { const q = R.pts[(i + 1) % R.pts.length]; walls.push({ a: toF(F, p), b: toF(F, q), z1: hp }); });
  (R.bld || []).forEach(B => { if (!B.pts || B.pts.length < 3 || !(+B.h > 0)) return; B.pts.forEach((p, i) => { walls.push({ a: toF(F, p), b: toF(F, B.pts[(i + 1) % B.pts.length]), z1: +B.h }); }); });
  (R.trees || []).forEach(t => { if (!(+t.h > 0)) return; trees.push({ c: toF(F, [+t.x, +t.y]), r: +t.r || 1, z0: (+t.h) * 0.3, z1: +t.h, opq: 1 - Math.min(1, Math.max(0, (+t.tr || 0) / 100)) }); });
  const tabs = Y.tables.map(t => ({ u0: t.u0, u1: t.u1, vF: t.vF, vB: t.vF - Y.D, h1: Y.h1, tb: Math.tan(Y.b) }));
  return { walls, trees, tabs }; }
function pointsOf(Y, per) { const pts = [], cb = Math.cos(Y.b), sb = Math.sin(Y.b), g = (Y.S - Y.nr * Y.mS) / Math.max(1, Y.nr - 1);
  const fr = per >= 4 ? [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] : per >= 2 ? [[0.5, 0.25], [0.5, 0.75]] : [[0.5, 0.5]];
  Y.tables.forEach((t, ti) => t.mods.forEach(m => { fr.forEach(([fu, fs]) => { const sd = m.j * (Y.mS + (Y.nr > 1 ? g : 0)) + fs * Y.mS;
    pts.push({ t: ti, m: m.idx, U: m.u0 + fu * (m.u1 - m.u0), V: t.vF - sd * cb, z: Y.h1 + sd * sb + 0.02 }); }); }));
  return pts; }
function hit(sc, p, d) { // returns opacity 0..1 of the first obstacle along direction d from point p
  let o = 0; const [dU, dV, dz] = d;
  for (let k = 0; k < sc.tabs.length; k++) { if (k === p.t) continue; const t = sc.tabs[k], den = dz + dV * t.tb; if (Math.abs(den) < 1e-9) continue; const tt = (t.h1 + (t.vF - p.V) * t.tb - p.z) / den; if (tt <= 1e-4) continue;
    const U = p.U + tt * dU, V = p.V + tt * dV; if (U >= t.u0 && U <= t.u1 && V <= t.vF && V >= t.vB) return 1; }
  for (const w of sc.walls) { const ex = w.b[0] - w.a[0], ey = w.b[1] - w.a[1], den = dU * ey - dV * ex; if (Math.abs(den) < 1e-12) continue;
    const ax = w.a[0] - p.U, ay = w.a[1] - p.V, tt = (ax * ey - ay * ex) / den, s = (ax * dV - ay * dU) / den;
    if (tt > 1e-4 && s >= 0 && s <= 1 && p.z + tt * dz <= w.z1) return 1; }
  const h2 = dU * dU + dV * dV; if (h2 > 1e-12) for (const c of sc.trees) { const fx = p.U - c.c[0], fy = p.V - c.c[1], B = fx * dU + fy * dV, Cc = fx * fx + fy * fy - c.r * c.r, disc = B * B - h2 * Cc; if (disc < 0) continue;
    const s1 = (-B - Math.sqrt(disc)) / h2, s2 = (-B + Math.sqrt(disc)) / h2; if (s2 <= 0) continue; const za = p.z + Math.max(0, s1) * dz, zb = p.z + s2 * dz;
    if (za <= c.z1 && zb >= c.z0) o = Math.max(o, c.opq); }
  return o; }
function dirF(F, azDeg, elDeg) { const a = azDeg * D2R, e = elDeg * D2R, w = [-Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e)];
  return [w[0] * F.u[0] + w[1] * F.u[1], w[0] * F.f[0] + w[1] * F.f[1], Math.sin(e)]; }

export function shading(R, Y, o) { // o: { ns (modules per string) }
  if (!Y || !Y.n) return null; const t0 = Date.now(), sc = sceneOf(R, Y), per = Y.n <= 300 ? 4 : Y.n <= 1200 ? 2 : 1, pts = pointsOf(Y, per), F = Y.F;
  const ns = Math.max(1, o && o.ns || 1), nStr = Math.ceil(Y.n / ns);
  const evalDir = (az, el, wantStr) => { const d = dirF(F, az, el), mS = wantStr ? new Uint8Array(Y.n) : null; let s = 0;
    for (const p of pts) { const h = hit(sc, p, d); s += h; if (mS && h >= 0.5) mS[p.m] = 1; }
    let fs = 0; if (mS) { const st = new Uint8Array(nStr); for (let i = 0; i < Y.n; i++) if (mS[i]) st[Math.floor(i / ns)] = 1; for (let i = 0; i < nStr; i++) fs += st[i]; fs /= nStr; }
    return [s / pts.length, fs]; };
  const lin = [], str = []; SH_EL.forEach(el => { const a = [], b = []; SH_AZ.forEach(az => { const r = evalDir(az, el, true); a.push(r[0]); b.push(r[1]); }); lin.push(a); str.push(b); });
  // diffuse: isotropic sky seen by the tilted plane (PVsyst diffuse factor)
  const nrm = [0, Math.sin(Y.b), Math.cos(Y.b)]; let wS = 0, wSh = 0;
  for (let el = 5; el < 90; el += 10) for (let az = -170; az <= 180; az += 20) { const d = dirF(F, az, el), ci = d[0] * nrm[0] + d[1] * nrm[1] + d[2] * nrm[2]; if (ci <= 0) continue;
    const w = Math.cos(el * D2R) * ci; wS += w; wSh += w * evalDir(az, el, false)[0]; }
  const fd = wS ? wSh / wS : 0;
  return { tilt: Y.tilt, paz: Y.az, az: SH_AZ, el: SH_EL, lin, str, fd, fa: fd, elec: R.lay.elec, kEl: (+R.lay.kEl || 100) / 100, pts: pts.length, ms: Date.now() - t0 }; }

/* factor lookup for the hourly simulation; returns [linear fraction, strings fraction] */
export function shadeAt(T, azDeg, elDeg) { if (!T || elDeg <= 0) return [0, 0]; let a = ((azDeg + 180) % 360 + 360) % 360 - 180, e = Math.max(T.el[0], Math.min(90, elDeg));
  let i = Math.min(T.az.length - 2, Math.max(0, Math.floor((a + 180) / 10))), j = 0; while (j < T.el.length - 2 && e > T.el[j + 1]) j++;
  const ta = (a - T.az[i]) / (T.az[i + 1] - T.az[i]), te = (e - T.el[j]) / (T.el[j + 1] - T.el[j]);
  const f = M => (M[j][i] * (1 - ta) + M[j][i + 1] * ta) * (1 - te) + (M[j + 1][i] * (1 - ta) + M[j + 1][i + 1] * ta) * te;
  return [f(T.lin), f(T.str)]; }
/* adapter for PVCore.simulate opts.shade */
export function shadeAdapter(T) { if (!T) return null; return { fd: T.fd, fa: T.fa, beam: (az, el) => { const r = shadeAt(T, az, el), lin = r[0];
  const tot = T.elec === 'strings' ? Math.min(1, lin + T.kEl * Math.max(0, r[1] - lin)) : lin; return [lin, tot]; } }; }

/* horizon profile seen from the array centre (for PVsyst "Horizon" import) */
export function horizon(R, Y) { if (!Y || !Y.n) return null; const F = Y.F, c = [0, 0]; let k = 0; Y.tables.forEach(t => { c[0] += (t.u0 + t.u1) / 2; c[1] += t.vF - Y.D / 2; k++; }); c[0] /= k; c[1] /= k;
  const z0 = Y.h1 + Y.H / 2, prof = new Array(181).fill(0), add = (U, V, z) => { const dU = U - c[0], dV = V - c[1], d = Math.hypot(dU, dV); if (d < 0.5 || z <= z0) return;
    const w = toW(F, dU, dV), az = Math.atan2(-w[0], -w[1]) * R2D, el = Math.atan2(z - z0, d) * R2D, bin = Math.round((az + 180) / 2); prof[bin] = Math.max(prof[bin], el); };
  const edge = (p, q, h) => { const a = toF(F, p), b = toF(F, q), n = Math.max(2, Math.ceil(len(a, b) / 0.25)); for (let i = 0; i <= n; i++) add(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, h); };
  if (+R.hp > 0) R.pts.forEach((p, i) => edge(p, R.pts[(i + 1) % R.pts.length], +R.hp));
  (R.bld || []).forEach(B => (B.pts || []).forEach((p, i) => edge(p, B.pts[(i + 1) % B.pts.length], +B.h || 0)));
  (R.trees || []).forEach(t => { const cc = toF(F, [+t.x, +t.y]); for (let a = 0; a < 360; a += 15) add(cc[0] + Math.cos(a * D2R) * t.r, cc[1] + Math.sin(a * D2R) * t.r, +t.h); });
  return prof.map((el, i) => [i * 2 - 180, Math.round(el * 10) / 10]); }

/* ---------- steel structure ---------- */
export function structure(Y, L) { if (!Y || !Y.n) return null; const S = Y.S, b = Y.b, e = (+L.legPos || 0.2) * S, ov = 0.3, span = Math.max(0.8, +L.span || 2);
  const hf = Y.h1 + e * Math.sin(b), hr = Y.h1 + (S - e) * Math.sin(b), dx = (S - 2 * e) * Math.cos(b), brace = Math.hypot(dx, hr), railsPer = 2 * Y.nr, midLeg = S > 5.5, hm = Y.h1 + S / 2 * Math.sin(b);
  const T = Y.tables.map(t => { const Lt = t.len, nf = Math.max(2, Math.ceil(Math.max(0, Lt - 2 * ov) / span) + 1), sp = (Lt - 2 * ov) / (nf - 1), rl = Lt + 0.1;
    const rows = Math.max(1, Math.round(t.mods.length / t.cols)), rails = 2 * Math.min(Y.nr, rows) || railsPer;
    return { id: t.id, cols: t.cols, mods: t.mods.length, Lt, nf, sp, rails, rl, splices: rails * Math.max(0, Math.ceil(rl / 6) - 1),
      endC: rails * 2, midC: rails * Math.max(0, t.cols - 1), xbr: nf > 2 ? 2 : 0, xl: Math.hypot(sp, hr) }; });
  const sum = k => T.reduce((a, t) => a + t[k], 0), nf = sum('nf');
  const items = [
    { k: 'مدادة مائلة (Rafter)', p: L.pRaf, n: nf, l: S + 0.05, kg: +L.kgRaf },
    { k: 'رجل أمامية', p: L.pLeg, n: nf, l: hf, kg: +L.kgLeg },
    { k: 'رجل خلفية', p: L.pLeg, n: nf, l: hr, kg: +L.kgLeg },
    ...(midLeg ? [{ k: 'رجل وسطية (المدادة أطول من 5.5 m)', p: L.pLeg, n: nf, l: hm, kg: +L.kgLeg }] : []),
    { k: 'دعامة قطرية للإطار', p: L.pBr, n: nf * (midLeg ? 2 : 1), l: midLeg ? Math.hypot(dx / 2, hm) : brace, kg: +L.kgBr },
    { k: 'مدادات أفقية للألواح (Rails)', p: L.pRail, n: sum('rails'), l: null, tot: T.reduce((a, t) => a + t.rails * t.rl, 0), kg: +L.kgRail },
    { k: 'تقوية طولية X خلفية', p: L.pBr, n: sum('xbr'), l: null, tot: T.reduce((a, t) => a + t.xbr * t.xl, 0), kg: +L.kgBr }];
  items.forEach(i => { if (i.tot == null) i.tot = i.n * i.l; i.w = i.tot * (i.kg || 0); });
  const acc = [{ k: 'قواعد/بليتات تثبيت (Base plate)', n: nf * (midLeg ? 3 : 2) }, { k: 'وصلات مدادات (Splice)', n: sum('splices') }, { k: 'ملاقط طرفية (End clamp)', n: sum('endC') }, { k: 'ملاقط وسطية (Mid clamp)', n: sum('midC') }];
  return { e, hf, hr, hm, midLeg, dx, brace, S, ov, items, acc, tables: T, steelM: items.reduce((a, i) => a + i.tot, 0), steelKg: items.reduce((a, i) => a + i.w, 0) }; }

/* ---------- SVG drawings (strings, reused in the report) ---------- */
const f1 = (v, d) => (Math.round(v * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d)).toString();
function bbox(pts) { let a = [1e9, 1e9, -1e9, -1e9]; pts.forEach(p => { a[0] = Math.min(a[0], p[0]); a[1] = Math.min(a[1], p[1]); a[2] = Math.max(a[2], p[0]); a[3] = Math.max(a[3], p[1]); }); return a; }
function dimLine(x1, y1, x2, y2, txt, off, cls) { const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L * off, ny = dx / L * off, mx = (x1 + x2) / 2 + nx * 1.6, my = (y1 + y2) / 2 + ny * 1.6;
  let ang = Math.atan2(dy, dx) * R2D; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  return '<g class="' + (cls || 'dm') + '"><line x1="' + (x1 + nx) + '" y1="' + (y1 + ny) + '" x2="' + (x2 + nx) + '" y2="' + (y2 + ny) + '" marker-start="url(#ar)" marker-end="url(#ar)"/>' +
    '<line class="ext" x1="' + x1 + '" y1="' + y1 + '" x2="' + (x1 + nx * 1.2) + '" y2="' + (y1 + ny * 1.2) + '"/><line class="ext" x1="' + x2 + '" y1="' + y2 + '" x2="' + (x2 + nx * 1.2) + '" y2="' + (y2 + ny * 1.2) + '"/>' +
    '<text x="' + mx + '" y="' + my + '" transform="rotate(' + ang + ' ' + mx + ' ' + my + ')" text-anchor="middle" dominant-baseline="middle">' + txt + '</text></g>'; }
const DEFS = '<defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 2 L10 5 L0 8 z" fill="#334155"/></marker>' +
  '<pattern id="hb" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" stroke-width="1.5"/></pattern></defs>';
const STY = '<style>.dm line{stroke:#334155;stroke-width:1}.dm .ext{stroke:#94a3b8;stroke-dasharray:2 2}.dm text,.lb{font:600 11px system-ui,sans-serif;fill:#0f172a}.sm{font:10px system-ui,sans-serif;fill:#475569}' +
  '.mod{fill:#1e3a8a;stroke:#93c5fd;stroke-width:.6}.frm{stroke:#ea580c;stroke-width:2}.rail{stroke:#f59e0b;stroke-width:1.2}.stl{stroke:#475569;stroke-width:4;stroke-linecap:round}.stl2{stroke:#64748b;stroke-width:3;stroke-linecap:round}</style>';

/* plan: roof, obstacles, panels (+ structure) with dimensions */
export function planSVG(R, Y, opt) { opt = opt || {}; const P = R.pts; if (!P || P.length < 3) return '';
  const all = P.concat(...(R.bld || []).map(b => b.pts || []), ...(R.trees || []).map(t => [[t.x - t.r, t.y - t.r], [t.x + t.r, t.y + t.r]])), bb = bbox(all), pad = 3.5;
  const Wm = bb[2] - bb[0] + 2 * pad, Hm = bb[3] - bb[1] + 2 * pad, W = opt.w || 900, s = Math.min(W / Wm, 640 / Hm), H = Hm * s;
  const X = x => (x - bb[0] + pad) * s, Yy = y => (bb[3] + pad - y) * s, pt = p => X(p[0]) + ',' + Yy(p[1]);
  let h = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="roofsvg" xmlns="http://www.w3.org/2000/svg" dir="ltr">' + DEFS + STY;
  h += '<polygon points="' + P.map(pt).join(' ') + '" fill="#f8fafc" stroke="#0f172a" stroke-width="' + (+R.hp > 0 ? 5 : 2) + '" stroke-linejoin="round"/>';
  (R.bld || []).forEach(B => { if (!B.pts || B.pts.length < 3) return; const c = B.pts.reduce((a, p) => [a[0] + p[0] / B.pts.length, a[1] + p[1] / B.pts.length], [0, 0]);
    h += '<polygon points="' + B.pts.map(pt).join(' ') + '" fill="url(#hb)" stroke="#64748b" stroke-width="1.5"/><text class="lb" x="' + X(c[0]) + '" y="' + Yy(c[1]) + '" text-anchor="middle">' + (B.name || 'مبنى') + ' ' + f1(+B.h, 1) + 'm</text>'; });
  (R.trees || []).forEach(t => { h += '<circle cx="' + X(t.x) + '" cy="' + Yy(t.y) + '" r="' + t.r * s + '" fill="#86efac" fill-opacity=".55" stroke="#16a34a"/><text class="sm" x="' + X(t.x) + '" y="' + Yy(t.y) + '" text-anchor="middle">شجرة ' + f1(+t.h, 1) + 'm</text>'; });
  if (Y) { const F = Y.F, poly = (U0, U1, V0, V1) => [toW(F, U0, V0), toW(F, U1, V0), toW(F, U1, V1), toW(F, U0, V1)].map(pt).join(' '), g = (Y.S - Y.nr * Y.mS) / Math.max(1, Y.nr - 1), cb = Math.cos(Y.b);
    Y.tables.forEach(t => { t.mods.forEach(m => { const a = m.j * (Y.mS + (Y.nr > 1 ? g : 0)) * cb; h += '<polygon class="mod" points="' + poly(m.u0, m.u1, t.vF - a, t.vF - a - Y.mS * cb) + '"/>'; });
      if (opt.structure) { const ST = opt.st, T = ST && ST.tables.find(x => x.id === t.id); if (T) { for (let i = 0; i < T.nf; i++) { const U = t.u0 + ST.ov + i * T.sp, a = toW(F, U, t.vF + 0.15), b = toW(F, U, t.vF - Y.D - 0.15);
          h += '<line class="frm" x1="' + X(a[0]) + '" y1="' + Yy(a[1]) + '" x2="' + X(b[0]) + '" y2="' + Yy(b[1]) + '"/>'; }
        for (let r = 0; r < Y.nr; r++) [0.25, 0.75].forEach(fr => { const sd = (r * (Y.mS + (Y.nr > 1 ? g : 0)) + fr * Y.mS) * cb, a = toW(F, t.u0 - 0.05, t.vF - sd), b = toW(F, t.u1 + 0.05, t.vF - sd);
          h += '<line class="rail" x1="' + X(a[0]) + '" y1="' + Yy(a[1]) + '" x2="' + X(b[0]) + '" y2="' + Yy(b[1]) + '"/>'; }); } }
      const c = toW(F, (t.u0 + t.u1) / 2, t.vF - Y.D / 2); if (opt.labels !== false) h += '<text class="sm" x="' + X(c[0]) + '" y="' + Yy(c[1]) + '" text-anchor="middle" fill="#fff" style="fill:#fff">T' + t.id + '</text>'; });
    const t0 = Y.tables[0], t1 = Y.tables.find(t => t.row === 1);
    if (t0 && t1) { const U = Math.max(t0.u0, t1.u0) + 0.3, a = toW(F, U, t0.vF), b = toW(F, U, t1.vF); h += dimLine(X(a[0]), Yy(a[1]), X(b[0]), Yy(b[1]), 'Pitch ' + f1(Y.pitch) + ' m', -14); }
    if (t0) { const a = toW(F, t0.u0, t0.vF), b = toW(F, t0.u1, t0.vF); h += dimLine(X(a[0]), Yy(a[1]), X(b[0]), Yy(b[1]), f1(t0.len) + ' m', 14); } }
  if (opt.routes && opt.inv) { const iv = opt.inv, col = ['#dc2626', '#ea580c', '#db2777', '#9333ea', '#0891b2', '#65a30d'];
    opt.routes.forEach((r, k) => { const a = r.c, mid = [iv[0], a[1]]; h += '<polyline points="' + [a, mid, iv].map(pt).join(' ') + '" fill="none" stroke="' + col[k % col.length] + '" stroke-width="2" stroke-dasharray="' + (k % 2 ? '6 3' : '') + '" stroke-opacity=".9"/><circle cx="' + X(a[0]) + '" cy="' + Yy(a[1]) + '" r="3.5" fill="' + col[k % col.length] + '"/>' +
      (k < 12 ? '<text class="sm" x="' + (X(a[0]) + 6) + '" y="' + (Yy(a[1]) - 5) + '" style="fill:' + col[k % col.length] + ';font-weight:700">S' + (k + 1) + ' · ' + f1(r.L, 0) + 'm</text>' : ''); });
    if (opt.drop) h += '<g transform="translate(' + X(opt.drop[0]) + ',' + Yy(opt.drop[1]) + ')"><circle r="12" fill="#ecfdf5" stroke="#059669" stroke-width="2"/><text class="sm" text-anchor="middle" y="4" style="font-weight:700;fill:#047857">⬇</text><text class="sm" y="26" text-anchor="middle" style="fill:#047857;font-weight:700">نزول لغرفة الكهرباء</text></g>';
    h += '<g transform="translate(' + X(iv[0]) + ',' + Yy(iv[1]) + ')"><rect x="-22" y="-14" width="44" height="28" rx="5" fill="#eef2ff" stroke="#4f46e5" stroke-width="2"/><text class="sm" text-anchor="middle" y="4" style="font-weight:700;fill:#3730a3">INV</text></g>';
    if (opt.cableTxt) h += '<g transform="translate(16,18)"><rect width="' + Math.min(W - 120, 9 + opt.cableTxt.length * 6.1) + '" height="20" rx="4" fill="#fff" fill-opacity=".9" stroke="#e2e8f0"/><text class="sm" x="8" y="14" style="font-weight:700">' + opt.cableTxt + '</text></g>'; }
  P.forEach((p, i) => { const q = P[(i + 1) % P.length], c = area(P) > 0 ? 1 : -1; h += dimLine(X(p[0]), Yy(p[1]), X(q[0]), Yy(q[1]), f1(len(p, q)) + ' m', 16 * c); });
  if (opt.edge != null && P.length > 2) { const p = P[opt.edge], q = P[(opt.edge + 1) % P.length]; h += '<line x1="' + X(p[0]) + '" y1="' + Yy(p[1]) + '" x2="' + X(q[0]) + '" y2="' + Yy(q[1]) + '" stroke="#16a34a" stroke-width="5" stroke-opacity=".7"/>'; }
  h += '<g transform="translate(' + (W - 40) + ',36)"><circle r="18" fill="#fff" stroke="#334155"/><path d="M0 -15 L6 4 L0 0 L-6 4 z" fill="#dc2626"/><text class="lb" y="-22" text-anchor="middle">N</text></g>';
  const sbm = Math.pow(10, Math.floor(Math.log10(Wm / 4))) * (Wm / 4 / Math.pow(10, Math.floor(Math.log10(Wm / 4))) >= 5 ? 5 : Wm / 4 / Math.pow(10, Math.floor(Math.log10(Wm / 4))) >= 2 ? 2 : 1);
  h += '<g transform="translate(16,' + (H - 16) + ')"><rect width="' + sbm * s + '" height="5" fill="#0f172a"/><text class="sm" y="-4">' + sbm + ' m</text></g>';
  if (Y) h += '<g transform="translate(' + (W - 40) + ',90)"><path d="' + (() => { const v = [-Math.sin(Y.az * D2R), -Math.cos(Y.az * D2R)]; return 'M0 0 L' + v[0] * 22 + ' ' + (-v[1] * 22); })() + '" stroke="#ea580c" stroke-width="3" marker-end="url(#ar)"/><text class="sm" y="34" text-anchor="middle">Az ' + f1(Y.az, 1) + '°</text></g>';
  return h + '</svg>'; }

/* side section through two rows: legs, rafter, rails, brace, all dimensions */
export function sectionSVG(Y, ST) { if (!Y || !ST) return ''; const s = Math.min(130, 760 / (Y.pitch + Y.D + 1.2)), W = 900, Hs = Math.max(260, (ST.hr + 1.6) * s + 70), g0 = Hs - 50, x0 = 70;
  const X = v => x0 + v * s, Z = z => g0 - z * s, b = Y.b; let h = '<svg viewBox="0 0 ' + W + ' ' + Hs + '" class="roofsvg" xmlns="http://www.w3.org/2000/svg" dir="ltr">' + DEFS + STY;
  h += '<line x1="20" y1="' + g0 + '" x2="' + (W - 20) + '" y2="' + g0 + '" stroke="#0f172a" stroke-width="2"/><rect x="20" y="' + g0 + '" width="' + (W - 40) + '" height="10" fill="url(#hb)"/>';
  (Y.single || Y.rows < 2 ? [0] : [0, 1]).forEach(k => { const o = k * Y.pitch, fx = o, bx = o + Y.D, fz = Y.h1, bz = Y.h1 + Y.H; // x grows toward the back (north)
    h += '<line x1="' + X(fx) + '" y1="' + Z(fz) + '" x2="' + X(bx) + '" y2="' + Z(bz) + '" stroke="#1e3a8a" stroke-width="7"/>';
    const lf = ST.e * Math.cos(b), lr = (Y.S - ST.e) * Math.cos(b);
    h += '<line class="stl" x1="' + X(fx + lf) + '" y1="' + Z(0) + '" x2="' + X(fx + lf) + '" y2="' + Z(ST.hf) + '"/><line class="stl" x1="' + X(fx + lr) + '" y1="' + Z(0) + '" x2="' + X(fx + lr) + '" y2="' + Z(ST.hr) + '"/>';
    if (ST.midLeg) { const lm = Y.S / 2 * Math.cos(b); h += '<line class="stl" x1="' + X(fx + lm) + '" y1="' + Z(0) + '" x2="' + X(fx + lm) + '" y2="' + Z(ST.hm) + '"/><line class="stl2" x1="' + X(fx + lf) + '" y1="' + Z(0) + '" x2="' + X(fx + lm) + '" y2="' + Z(ST.hm) + '"/><line class="stl2" x1="' + X(fx + lm) + '" y1="' + Z(0) + '" x2="' + X(fx + lr) + '" y2="' + Z(ST.hr) + '"/>'; }
    else h += '<line class="stl2" x1="' + X(fx + lf) + '" y1="' + Z(0) + '" x2="' + X(fx + lr) + '" y2="' + Z(ST.hr) + '"/>';
    h += '<line x1="' + X(fx) + '" y1="' + Z(fz - 0.06) + '" x2="' + X(bx) + '" y2="' + Z(bz - 0.06) + '" stroke="#ea580c" stroke-width="3"/>';
    for (let r = 0; r < Y.nr; r++) [0.25, 0.75].forEach(fr => { const sd = r * (Y.mS + (Y.nr > 1 ? (Y.S - Y.nr * Y.mS) / (Y.nr - 1) : 0)) + fr * Y.mS; h += '<rect x="' + (X(fx + sd * Math.cos(b)) - 4) + '" y="' + (Z(fz + sd * Math.sin(b)) - 1) + '" width="8" height="6" fill="#f59e0b"/>'; });
    [lf, lr].forEach(l => { h += '<rect x="' + (X(fx + l) - 9) + '" y="' + (g0 - 4) + '" width="18" height="5" fill="#334155"/>'; }); });
  const lf = ST.e * Math.cos(b), lr = (Y.S - ST.e) * Math.cos(b);
  h += dimLine(X(lf), Z(0), X(lf), Z(ST.hf), 'رجل أمامية ' + f1(ST.hf) + ' m', 16) + dimLine(X(lr), Z(0), X(lr), Z(ST.hr), 'رجل خلفية ' + f1(ST.hr) + ' m', -16);
  h += dimLine(X(0), g0 + 22, X(Y.D), g0 + 22, 'عمق ' + f1(Y.D) + ' m', 0) + (Y.single || Y.rows < 2 ? '' : dimLine(X(0), g0 + 40, X(Y.pitch), g0 + 40, 'المسافة بين الصفوف ' + f1(Y.pitch) + ' m', 0));
  h += dimLine(X(0), Z(Y.h1), X(Y.D), Z(Y.h1 + Y.H), 'طول المدادة ' + f1(Y.S) + ' m', -18);
  h += dimLine(X(0) - 30, Z(0), X(0) - 30, Z(Y.h1), 'h ' + f1(Y.h1), 0);
  h += '<path d="M' + (X(0) + 46) + ' ' + Z(Y.h1) + ' A46 46 0 0 0 ' + (X(0) + 46 * Math.cos(b)) + ' ' + (Z(Y.h1) - 46 * Math.sin(b)) + '" fill="none" stroke="#dc2626"/><text class="lb" x="' + (X(0) + 52) + '" y="' + (Z(Y.h1) - 8) + '">' + f1(Y.tilt, 1) + '°</text>';
  if (Y.lim && !Y.single) h += '<line x1="' + X(Y.D) + '" y1="' + Z(Y.h1 + Y.H) + '" x2="' + X(Y.D + Y.gapMin) + '" y2="' + Z(Y.h1) + '" stroke="#f59e0b" stroke-dasharray="5 4"/><text class="sm" x="' + X(Y.D + Y.gapMin / 2) + '" y="' + (Z(Y.h1 + Y.H / 2) - 6) + '">ظل 21 ك1 (ارتفاع الشمس ' + f1(Y.lim.el, 1) + '°)</text>';
  h += '<text class="sm" x="' + (W - 20) + '" y="18" text-anchor="end">مقطع جانبي ← الجنوب على اليسار · الأبعاد بالمتر</text>';
  return h + '</svg>'; }

/* front elevation of the longest table: frames, spacing, rails */
export function elevSVG(Y, ST) { if (!Y || !ST || !ST.tables.length) return ''; const T = ST.tables.slice().sort((a, b) => b.Lt - a.Lt)[0], t = Y.tables.find(x => x.id === T.id);
  const W = 900, s = Math.min(70, 800 / (T.Lt + 1)), Hs = (ST.hr + 0.6) * s + 90, g0 = Hs - 46, x0 = (W - T.Lt * s) / 2, X = u => x0 + (u - t.u0) * s, Z = z => g0 - z * s;
  let h = '<svg viewBox="0 0 ' + W + ' ' + Hs + '" class="roofsvg" xmlns="http://www.w3.org/2000/svg" dir="ltr">' + DEFS + STY;
  h += '<line x1="20" y1="' + g0 + '" x2="' + (W - 20) + '" y2="' + g0 + '" stroke="#0f172a" stroke-width="2"/>';
  const top = Y.h1 + Y.H; for (let c = 0; c < T.cols; c++) { const u0 = t.u0 + c * Y.cw; h += '<rect class="mod" x="' + X(u0) + '" y="' + Z(top) + '" width="' + Y.mU * s + '" height="' + (Y.H + 0.01) * s + '"/>'; }
  for (let i = 0; i < T.nf; i++) { const u = t.u0 + ST.ov + i * T.sp; h += '<line class="stl" x1="' + X(u) + '" y1="' + Z(0) + '" x2="' + X(u) + '" y2="' + Z(ST.hr) + '"/>'; }
  if (T.nf > 2) { const u1 = t.u0 + ST.ov, u2 = u1 + T.sp, u3 = t.u0 + ST.ov + (T.nf - 1) * T.sp, u4 = u3 - T.sp;
    h += '<line class="stl2" x1="' + X(u1) + '" y1="' + Z(0) + '" x2="' + X(u2) + '" y2="' + Z(ST.hr) + '"/><line class="stl2" x1="' + X(u2) + '" y1="' + Z(0) + '" x2="' + X(u1) + '" y2="' + Z(ST.hr) + '"/>' +
      '<line class="stl2" x1="' + X(u4) + '" y1="' + Z(0) + '" x2="' + X(u3) + '" y2="' + Z(ST.hr) + '"/><line class="stl2" x1="' + X(u3) + '" y1="' + Z(0) + '" x2="' + X(u4) + '" y2="' + Z(ST.hr) + '"/>'; }
  if (T.nf > 1) h += dimLine(X(t.u0 + ST.ov), g0 + 18, X(t.u0 + ST.ov + T.sp), g0 + 18, f1(T.sp) + ' m', 0);
  h += dimLine(X(t.u0), Z(top) - 18, X(t.u1), Z(top) - 18, 'طول الطاولة T' + T.id + ': ' + f1(T.Lt) + ' m · ' + T.cols + ' عمود × ' + Y.nr + ' لوح', 0);
  h += dimLine(X(t.u0), g0 + 36, X(t.u0 + ST.ov), g0 + 36, f1(ST.ov), 0);
  h += '<text class="sm" x="' + (W - 20) + '" y="16" text-anchor="end">واجهة أمامية · ' + T.nf + ' إطار · الأرجل الخلفية مع تقوية X بأول وآخر فتحة</text>';
  return h + '</svg>'; }

/* sun path diagram with the shading factor table (PVsyst "Iso-shadings") and the horizon line */
export function sunPathSVG(lat, T, hor) { const W = 900, H = 380, x0 = 50, y0 = H - 40, w = W - 80, hh = H - 70, X = a => x0 + (a + 180) / 360 * w, Yy = e => y0 - e / 90 * hh;
  let h = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="roofsvg" xmlns="http://www.w3.org/2000/svg" dir="ltr">' + STY;
  if (T) T.el.forEach((e, j) => { if (j === T.el.length - 1) return; T.az.forEach((a, i) => { if (i === T.az.length - 1) return; const v = (T.lin[j][i] + T.lin[j][i + 1] + T.lin[j + 1][i] + T.lin[j + 1][i + 1]) / 4; if (v < 0.005) return;
    const am = (a + 5) * D2R, em = (e + T.el[j + 1]) / 2 * D2R, bt = (T.tilt || 0) * D2R, ci = Math.sin(em) * Math.cos(bt) + Math.cos(em) * Math.sin(bt) * Math.cos(am - (T.paz || 0) * D2R); if (ci <= 0) return;
    h += '<rect x="' + X(a) + '" y="' + Yy(T.el[j + 1]) + '" width="' + (X(T.az[i + 1]) - X(a)) + '" height="' + (Yy(e) - Yy(T.el[j + 1])) + '" fill="#dc2626" fill-opacity="' + Math.min(0.85, 0.1 + v * 0.9).toFixed(2) + '"/>'; }); });
  for (let e = 0; e <= 90; e += 15) h += '<line x1="' + x0 + '" y1="' + Yy(e) + '" x2="' + (x0 + w) + '" y2="' + Yy(e) + '" stroke="#e2e8f0"/><text class="sm" x="' + (x0 - 6) + '" y="' + (Yy(e) + 4) + '" text-anchor="end">' + e + '°</text>';
  for (let a = -180; a <= 180; a += 30) h += '<line x1="' + X(a) + '" y1="' + y0 + '" x2="' + X(a) + '" y2="' + (y0 - hh) + '" stroke="#e2e8f0"/><text class="sm" x="' + X(a) + '" y="' + (y0 + 16) + '" text-anchor="middle">' + a + '°</text>';
  h += '<text class="sm" x="' + X(-90) + '" y="' + (y0 + 30) + '" text-anchor="middle">شرق</text><text class="sm" x="' + X(0) + '" y="' + (y0 + 30) + '" text-anchor="middle">جنوب</text><text class="sm" x="' + X(90) + '" y="' + (y0 + 30) + '" text-anchor="middle">غرب</text>';
  const days = [[172, '21 حزيران'], [141, '22 أيار'], [110, '20 نيسان'], [80, '20 آذار'], [52, '21 شباط'], [21, '21 ك2'], [355, '21 ك1']];
  days.forEach(([d, nm]) => { const dec = declOf(d), pts = []; for (let t = 4; t <= 20; t += 0.1) { const s = sunSolar(lat, dec, t); if (s.el > 0) pts.push(X(s.az) + ',' + Yy(s.el)); }
    if (pts.length) h += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#2563eb" stroke-width="1.4"/><text class="sm" x="' + (+pts[Math.floor(pts.length / 2)].split(',')[0]) + '" y="' + (+pts[Math.floor(pts.length / 2)].split(',')[1] - 4) + '" text-anchor="middle">' + nm + '</text>'; });
  for (let t = 6; t <= 18; t++) { const pts = []; for (let d = 172; d <= 355; d += 6) { const s = sunSolar(lat, declOf(d), t); if (s.el > 0) pts.push(X(s.az) + ',' + Yy(s.el)); }
    if (pts.length > 1) h += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#94a3b8" stroke-dasharray="3 3"/><text class="sm" x="' + pts[0].split(',')[0] + '" y="' + (+pts[0].split(',')[1] - 3) + '">' + t + 'h</text>'; }
  if (hor) h += '<polyline points="' + hor.map(p => X(p[0]) + ',' + Yy(p[1])).join(' ') + '" fill="#334155" fill-opacity=".12" stroke="#334155" stroke-width="1.5"/>';
  h += '<g transform="translate(' + (x0 + 8) + ',16)"><rect width="12" height="10" fill="#dc2626" fill-opacity=".6"/><text class="sm" x="16" y="9">نسبة الظل على الألواح (أغمق = أكثر)</text><line x1="230" y1="5" x2="250" y2="5" stroke="#334155" stroke-width="1.5"/><text class="sm" x="255" y="9">خط الأفق من العوائق</text></g>';
  return h + '</svg>'; }
