/* Export the roof model as a SketchUp Ruby script (.rb): Window → Ruby Console → load "path/to/file.rb" (or paste it).
   Units: metres. x = East, y = North, z = up; z = 0 is the ground, the roof is at the building height. */
import * as RF from './roof';

const f = v => (Math.round((+v || 0) * 1000) / 1000).toString();
const P = (pts, z) => '[' + pts.map(p => '[' + f(p[0]) + '.m, ' + f(p[1]) + '.m, ' + f(z) + '.m]').join(', ') + ']';
const q = s => '"' + String(s || '').replace(/["\\#]/g, '') + '"';
/* inward offset of a simple polygon by d (for the parapet ring) */
function inset(pts, d) { const n = pts.length, s = Math.sign(RF.area(pts)) || 1, L = [];
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * s, ny = dx / l * s; L.push([[a[0] + nx * d, a[1] + ny * d], [b[0] + nx * d, b[1] + ny * d]]); }
  return L.map((l2, i) => { const l1 = L[(i - 1 + n) % n], [p1, p2] = l1, [p3, p4] = l2, d1 = [p2[0] - p1[0], p2[1] - p1[1]], d2 = [p4[0] - p3[0], p4[1] - p3[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-9) return p3; const t = ((p3[0] - p1[0]) * d2[1] - (p3[1] - p1[1]) * d2[0]) / den; return [p1[0] + t * d1[0], p1[1] + t * d1[1]]; }); }

export function toRuby(R, Y, o) { o = o || {}; const hb = +R.hb > 0 ? +R.hb : 3, hp = +R.hp || 0, L = [];
  L.push('# encoding: UTF-8', '# Sanam PV — roof model for SketchUp (generated ' + new Date().toISOString().slice(0, 10) + ')', '# Load: Window → Ruby Console → load "C:/path/sanam-roof.rb"', '',
    'model = Sketchup.active_model', 'model.start_operation("Sanam PV roof", true)', 'ents = model.active_entities',
    'def mat(model, name, rgb) m = model.materials[name] || model.materials.add(name); m.color = Sketchup::Color.new(*rgb); m end',
    'def prism(ents, pts, h, name, m)', '  g = ents.add_group; f = g.entities.add_face(pts); f.reverse! if f.normal.z < 0; f.pushpull(h) if h > 0.001', '  g.name = name; g.material = m; g', 'end', '');
  L.push('bld = prism(ents, ' + P(R.pts, 0) + ', ' + f(hb) + '.m, ' + q('Building') + ', mat(model, "Building", [231, 225, 214]))');
  if (hp > 0) { const inn = inset(R.pts, 0.2);
    L.push('g = ents.add_group; g.name = "Parapet"; o = g.entities.add_face(' + P(R.pts, hb) + '); i = g.entities.add_face(' + P(inn, hb) + '); i.erase! if i && i.valid?',
      'g.entities.grep(Sketchup::Face).each { |fc| fc.reverse! if fc.normal.z < 0; fc.pushpull(' + f(hp) + '.m) }', 'g.material = mat(model, "Parapet", [214, 207, 194])'); }
  (R.bld || []).forEach((b, i) => { if (!b.pts || b.pts.length < 3) return; const ground = b.ref === 'ground', z0 = ground ? 0 : hb, H = ground ? (+b.hg || (+b.h || 0) + hb) : (+b.h || 0);
    L.push('prism(ents, ' + P(b.pts, z0) + ', ' + f(Math.max(0.05, H)) + '.m, ' + q((b.name || 'Object ' + (i + 1)) + ' ' + f(+b.h || 0) + 'm') + ', mat(model, ' + q(ground ? 'Neighbour' : 'Roof object') + ', ' + (ground ? '[100, 116, 139]' : '[156, 163, 175]') + '))'); });
  (R.trees || []).forEach((t, i) => { const ground = t.ref === 'ground', z0 = ground ? 0 : hb, H = ground ? (+t.hg || (+t.h || 0) + hb) : (+t.h || 0); if (!(H > 0)) return;
    L.push('g = ents.add_group; g.name = ' + q('Tree ' + (i + 1)) + '; c = g.entities.add_circle([' + f(t.x) + '.m, ' + f(t.y) + '.m, ' + f(z0 + H * 0.3) + '.m], Z_AXIS, ' + f(t.r || 1) + '.m, 16); fc = g.entities.add_face(c); fc.reverse! if fc.normal.z < 0; fc.pushpull(' + f(H * 0.7) + '.m); g.material = mat(model, "Tree", [63, 143, 74])'); });
  if (Y && Y.n) { const F = Y.F, cb = Math.cos(Y.b), sb = Math.sin(Y.b), gp = (Y.S - Y.nr * Y.mS) / Math.max(1, Y.nr - 1);
    L.push('pv = ents.add_group; pv.name = ' + q('PV modules (' + Y.n + ')') + '; pm = mat(model, "PV module", [30, 58, 138])');
    Y.tables.forEach(t => t.mods.forEach(m => { const a = m.j * (Y.mS + (Y.nr > 1 ? gp : 0)), z0 = hb + Y.h1 + a * sb, z1 = z0 + Y.mS * sb, vF = t.vF - a * cb, vB = vF - Y.mS * cb;
      const c = [[m.u0, vF, z0], [m.u1, vF, z0], [m.u1, vB, z1], [m.u0, vB, z1]].map(([u, v, z]) => { const w = RF.toW(F, u, v); return '[' + f(w[0]) + '.m, ' + f(w[1]) + '.m, ' + f(z) + '.m]'; });
      L.push('fc = pv.entities.add_face([' + c.join(', ') + ']); fc.material = pm; fc.back_material = pm'); })); }
  L.push('', 'model.commit_operation', 'Sketchup.active_model.active_view.zoom_extents', 'puts "Sanam PV: roof ' + f(Math.abs(RF.area(R.pts))) + ' m2, ' + (R.bld || []).length + ' objects' + (Y && Y.n ? ', ' + Y.n + ' modules' : '') + '"');
  return L.join('\n') + '\n'; }
