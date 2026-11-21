/* Sanam PV — roof detection from a site image (uploaded photo / plan / satellite screenshot).
   Magic-wand region growing from the clicked point (colour distance to the seed colour, on a blurred copy), morphological
   closing, outer contour tracing (Moore neighbourhood), Douglas–Peucker simplification, orthogonalisation to the dominant
   roof direction, and objects on the roof = holes inside the region (water tanks, stair rooms, AC units, heaters).
   Pure functions on { data: Uint8ClampedArray RGBA, width, height }. Output in image pixels. */

function blur(img) { const { width: w, height: h, data: d } = img, o = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let r = 0, g = 0, b = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const k = (yy * w + xx) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
    const q = (y * w + x) * 3; o[q] = r / n; o[q + 1] = g / n; o[q + 2] = b / n; }
  return o; }

export function regionGrow(img, sx, sy, tol) { const w = img.width, h = img.height, B = blur(img), M = new Uint8Array(w * h); sx = Math.round(sx); sy = Math.round(sy);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return M;
  let r0 = 0, g0 = 0, b0 = 0, n0 = 0; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const x = sx + i, y = sy + j; if (x < 0 || y < 0 || x >= w || y >= h) continue; const q = (y * w + x) * 3; r0 += B[q]; g0 += B[q + 1]; b0 += B[q + 2]; n0++; }
  r0 /= n0; g0 /= n0; b0 /= n0; const T2 = tol * tol, st = [sy * w + sx]; M[sy * w + sx] = 1;
  while (st.length) { const p = st.pop(), x = p % w, y = (p - x) / w;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of nb) { if (q < 0 || M[q]) continue; const k = q * 3, dr = B[k] - r0, dg = B[k + 1] - g0, db = B[k + 2] - b0; if (dr * dr + dg * dg + db * db <= T2) { M[q] = 1; st.push(q); } } }
  return M; }

function morph(M, w, h, r, dil) { const o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = dil ? 0 : 1;
    for (let j = -r; j <= r && (dil ? !v : v); j++) for (let i = -r; i <= r; i++) { const xx = x + i, yy = y + j; const inside = xx >= 0 && yy >= 0 && xx < w && yy < h ? M[yy * w + xx] : 0;
      if (dil && inside) { v = 1; break; } if (!dil && !inside) { v = 0; break; } }
    o[y * w + x] = v; }
  return o; }
export const close = (M, w, h, r) => morph(morph(M, w, h, r, true), w, h, r, false);

/* outer boundary of the component containing (sx, sy) — Moore neighbour tracing */
export function traceOuter(M, w, h) { let s = -1; for (let i = 0; i < w * h && s < 0; i++) if (M[i]) s = i; if (s < 0) return [];
  const D = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]], at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && M[y * w + x] === 1;
  const sx = s % w, sy = (s - sx) / w; let px = sx, py = sy, bx = sx - 1, by = sy; const out = [[px, py]];
  for (let guard = 0; guard < w * h * 4; guard++) { let idx = D.findIndex(d => d[0] === bx - px && d[1] === by - py), moved = false;
    for (let k = 1; k <= 8; k++) { const d = D[(idx + k) % 8], cx = px + d[0], cy = py + d[1];
      if (at(cx, cy)) { const pb = D[(idx + k - 1) % 8]; bx = px + pb[0]; by = py + pb[1]; px = cx; py = cy; moved = true; break; } }
    if (!moved) break; if (px === sx && py === sy) break; out.push([px, py]); }
  return out; }

export function simplify(P, eps) { if (P.length < 3) return P.slice(); const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; const st = [[0, P.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let md = 0, mi = -1; const [x1, y1] = P[a], [x2, y2] = P[b], L = Math.hypot(x2 - x1, y2 - y1) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((y2 - y1) * P[i][0] - (x2 - x1) * P[i][1] + x2 * y1 - y2 * x1) / L; if (d > md) { md = d; mi = i; } }
    if (md > eps && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  const o = P.filter((_, i) => keep[i]); if (o.length > 3 && Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < eps) o.pop(); return o; }

/* dominant direction = longest edge; snap edges within `deg` of 0/90° to it */
export function orthogonalize(P, deg) { if (P.length < 4) return { P, ang: 0 }; let bi = 0, bl = 0;
  P.forEach((p, i) => { const q = P[(i + 1) % P.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > bl) { bl = l; bi = i; } });
  const a = Math.atan2(P[(bi + 1) % P.length][1] - P[bi][1], P[(bi + 1) % P.length][0] - P[bi][0]), c = Math.cos(-a), s = Math.sin(-a);
  const R = P.map(([x, y]) => [x * c - y * s, x * s + y * c]), n = R.length, kind = [];
  for (let i = 0; i < n; i++) { const p = R[i], q = R[(i + 1) % n], an = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI) % 180; kind.push(an < deg || an > 180 - deg ? 'H' : Math.abs(an - 90) < deg ? 'V' : 'X'); }
  if (kind.some(k => k === 'X')) return { P, ang: a }; // not rectilinear: keep as is
  // merge consecutive edges of the same kind, then intersect H/V lines
  const lines = []; for (let i = 0; i < n; i++) { const p = R[i], q = R[(i + 1) % n], k = kind[i], v = k === 'H' ? (p[1] + q[1]) / 2 : (p[0] + q[0]) / 2, L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (lines.length && lines[lines.length - 1].k === k) { const l = lines[lines.length - 1]; l.v = (l.v * l.L + v * L) / (l.L + L); l.L += L; } else lines.push({ k, v, L }); }
  if (lines.length > 1 && lines[0].k === lines[lines.length - 1].k) { const f = lines.pop(), l = lines[0]; l.v = (l.v * l.L + f.v * f.L) / (l.L + f.L); l.L += f.L; }
  if (lines.length < 4 || lines.length % 2) return { P, ang: a };
  const Q = []; for (let i = 0; i < lines.length; i++) { const l1 = lines[i], l2 = lines[(i + 1) % lines.length]; Q.push(l1.k === 'H' ? [l2.v, l1.v] : [l1.v, l2.v]); }
  const ci = Math.cos(a), si = Math.sin(a); return { P: Q.map(([x, y]) => [x * ci - y * si, x * si + y * ci]), ang: a }; }

/* holes = non-region pixels enclosed by the region (objects on the roof) → oriented rectangles in image px */
export function holes(M, w, h, minPx, ang) { const out = new Uint8Array(w * h), st = [];
  for (let x = 0; x < w; x++) { st.push(x, (h - 1) * w + x); } for (let y = 0; y < h; y++) { st.push(y * w, y * w + w - 1); }
  while (st.length) { const p = st.pop(); if (out[p] || M[p]) continue; out[p] = 1; const x = p % w, y = (p - x) / w; if (x > 0) st.push(p - 1); if (x < w - 1) st.push(p + 1); if (y > 0) st.push(p - w); if (y < h - 1) st.push(p + w); }
  const seen = new Uint8Array(w * h), res = [], c = Math.cos(-ang), s = Math.sin(-ang);
  for (let i = 0; i < w * h; i++) { if (M[i] || out[i] || seen[i]) continue; const comp = [], q = [i]; seen[i] = 1;
    while (q.length) { const p = q.pop(); comp.push(p); const x = p % w, y = (p - x) / w; for (const n of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (n >= 0 && !M[n] && !out[n] && !seen[n]) { seen[n] = 1; q.push(n); } }
    if (comp.length < minPx) continue; let a = [1e9, 1e9, -1e9, -1e9];
    comp.forEach(p => { const x = p % w, y = (p - x) / w, u = x * c - y * s, v = x * s + y * c; a = [Math.min(a[0], u), Math.min(a[1], v), Math.max(a[2], u), Math.max(a[3], v)]; });
    const ci = Math.cos(ang), si = Math.sin(ang), bk = ([u, v]) => [u * ci - v * si, u * si + v * ci];
    res.push({ px: comp.length, rect: [[a[0], a[1]], [a[2], a[1]], [a[2], a[3]], [a[0], a[3]]].map(bk) }); }
  return res.sort((x, y) => y.px - x.px).slice(0, 20); }

/* full pipeline. img: ImageData-like; (sx, sy) seed in px; mpp metres per pixel (for sizes) */
export function detectRoof(img, sx, sy, o) { o = o || {}; const w = img.width, h = img.height, mpp = o.mpp || 0.1, tol = o.tol || 28;
  let M = regionGrow(img, sx, sy, tol); const r = Math.max(1, Math.round(0.25 / mpp)); M = close(M, w, h, r);
  const area = M.reduce((a, v) => a + v, 0); if (area < 50) return { err: 'المنطقة صغيرة كثير: كبّر التسامح أو اضغط بنص السطح.' };
  const C = traceOuter(M, w, h); if (C.length < 8) return { err: 'ما قدرت أطلع حدود السطح.' };
  const S = simplify(C, Math.max(1.5, 0.3 / mpp)), O = o.ortho === false ? { P: S, ang: 0 } : orthogonalize(S, 12);
  const H = holes(M, w, h, Math.max(20, Math.round(0.4 / (mpp * mpp))), O.ang);
  return { outer: O.P, holes: H, areaPx: area, ortho: O.P !== S }; }
