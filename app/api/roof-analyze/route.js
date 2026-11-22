// Two-pass roof analysis with OpenAI vision (Responses API, strict JSON schema):
//   step "roof":    the whole site image → the main building's roof outline, parapet, an estimate of metres per pixel, neighbouring buildings
//   step "objects": a crop of that roof only (enlarged) → every object on the roof as an oriented box with a type from a fixed list
// Needs OPENAI_API_KEY (Railway → Variables). Optional OPENAI_MODEL (default gpt-5.5).
export const runtime = 'nodejs';
export const maxDuration = 120;

const KINDS = ['stair', 'stairTank', 'roomTank', 'tank', 'tankStand', 'heater', 'ac', 'room', 'laundry', 'dish', 'wall', 'vent', 'elev', 'opening', 'panels', 'other'];
const pt = { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 };
const SCHEMA = {
  roof: { type: 'object', additionalProperties: false, required: ['found', 'roof', 'parapet_m', 'mpp_estimate', 'mpp_basis', 'floors_estimate', 'neighbours', 'notes'], properties: {
    found: { type: 'boolean' },
    roof: { type: 'array', items: pt, description: 'outer roof edge polygon, normalised 0..1, clockwise' },
    parapet_m: { type: 'number' }, mpp_estimate: { type: 'number', description: 'metres per pixel of this image, 0 if unknown' },
    mpp_basis: { type: 'string' }, floors_estimate: { type: 'number' },
    neighbours: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['poly', 'floors', 'note'], properties: { poly: { type: 'array', items: pt }, floors: { type: 'number' }, note: { type: 'string' } } } },
    notes: { type: 'string' } } },
  objects: { type: 'object', additionalProperties: false, required: ['objects', 'tank_px', 'notes'], properties: {
    tank_px: { type: 'number', description: 'typical diameter in pixels of ONE single water tank in this crop, 0 if there are no tanks' },
    objects: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'name_ar', 'cx', 'cy', 'w', 'l', 'angle_deg', 'height_m', 'confidence'], properties: {
      kind: { type: 'string', enum: KINDS }, name_ar: { type: 'string' },
      cx: { type: 'number' }, cy: { type: 'number' }, w: { type: 'number' }, l: { type: 'number' }, angle_deg: { type: 'number' },
      height_m: { type: 'number' }, confidence: { type: 'number' } } } },
    notes: { type: 'string' } } } };

const P_ROOF = (w, h, mpp) => `You are a careful photogrammetry assistant preparing a rooftop solar PV design in Jordan.
The image (${w} x ${h} px) is a top-down view (Google Maps satellite screenshot, drone photo or plan). It may be blurry.
1) Decide which building is the subject: normally the one in the middle of the image. Trace the OUTER edge of its flat roof (the parapet line) as a polygon in normalised image coordinates (0..1, origin top-left, x right, y down), clockwise, 4-12 vertices. Most Jordanian roofs are rectangles or L/U shapes with right angles: keep edges straight and corners square. Do not include balconies' shadows, the street or neighbouring roofs. Google views are often slightly oblique: a side wall (facade with rows of windows) may be visible next to the roof — it is NOT roof, exclude it. Ignore map pins, labels and logos drawn over the image.
2) parapet_m: parapet height if you can judge it from its shadow or thickness, typically 0.8-1.2 m; 1.0 if unsure.
3) mpp_estimate: metres per pixel of this image, from reference objects (cars ≈ 4.5 m, plastic water tanks ≈ 1.2 m diameter, street lanes ≈ 3.5 m, doors ≈ 0.9 m)${mpp ? `. The user calibrated about ${mpp.toFixed(4)} m/px; repeat it` : ''}. mpp_basis: which reference you used.
4) floors_estimate: number of floors of the building if shadows allow, else 0.
5) neighbours: adjacent buildings that could shade this roof (polygon normalised, estimated floors).
6) notes: one short sentence in Arabic. found=false if there is no clear building roof.`;
const P_OBJ = (w, h) => `This image (${w} x ${h} px) is a crop showing ONLY one flat roof seen from above, for a rooftop solar PV design in Jordan. It may be blurry.
List EVERY obstruction on the roof as an oriented box, coordinates normalised to this crop (0..1, origin top-left): cx, cy = centre; w, l = width and length as a fraction of the crop width (w) and crop height (l) before rotation; angle_deg = rotation clockwise.
kind must be one of: stair (stair room / roof access, ~3 m), stairTank (stair room with water tanks on top), roomTank (room with tanks on top), tank (single water tank, usually white/black cylinder ~1.2 m), tankStand (group of tanks on a steel stand), heater (solar water heater with tilted collector), ac (AC outdoor unit), room, laundry, dish (satellite dish), wall, vent, elev (elevator room), opening (light well / skylight / courtyard hole), panels (existing PV panels), other.
name_ar: short Arabic name (e.g. بيت درج، خزان مي، سخان شمسي، مكيف). height_m: estimated height above the roof. confidence 0..1. Group touching tanks of the same group into one tankStand box covering the whole group (one box per group). A light well, courtyard or skylight opening in the roof is kind opening. Ignore the parapet itself, shadows, map pins and labels. tank_px: diameter in pixels of one single tank (measure it carefully, it is the scale reference).
notes: one short Arabic sentence about anything uncertain.`;

export async function POST(req) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: 'ما في مفتاح OpenAI على السيرفر: ضيف OPENAI_API_KEY بإعدادات Railway (Variables) وأعد النشر.' });
  let b; try { b = await req.json(); } catch (e) { return Response.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  const step = b.step === 'objects' ? 'objects' : 'roof';
  if (!b.image || !/^data:image\//.test(b.image) || b.image.length > 6e6) return Response.json({ error: 'الصورة ناقصة أو كبيرة كثير' }, { status: 400 });
  try {
    const body = { model: process.env.OPENAI_MODEL || 'gpt-5.5',
      input: [{ role: 'user', content: [{ type: 'input_text', text: step === 'roof' ? P_ROOF(b.w, b.h, b.mpp) : P_OBJ(b.w, b.h) }, { type: 'input_image', image_url: b.image, detail: 'high' }] }],
      text: { format: { type: 'json_schema', name: 'roof_' + step, strict: true, schema: SCHEMA[step] } }, reasoning: { effort: process.env.OPENAI_EFFORT || 'low' } };
    const call = bd => fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(bd) });
    let r = await call(body), j = await r.json();
    if (!r.ok && /reasoning/i.test((j.error && j.error.message) || '')) { delete body.reasoning; r = await call(body); j = await r.json(); } // model without reasoning effort
    if (!r.ok) return Response.json({ error: 'OpenAI ' + r.status + ': ' + ((j.error && j.error.message) || '').slice(0, 200) });
    const txt = j.output_text || (j.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text' || c.text).map(c => c.text).join('');
    let out; try { out = JSON.parse(txt); } catch (e) { return Response.json({ error: 'رد غير مفهوم من الذكاء الاصطناعي' }); }
    const c01 = v => Math.max(0, Math.min(1, +v || 0)), poly = a => (a || []).filter(p => Array.isArray(p)).map(p => [c01(p[0]), c01(p[1])]);
    if (step === 'roof') return Response.json({ found: !!out.found, roof: poly(out.roof), parapet_m: Math.max(0, Math.min(3, +out.parapet_m || 0)), mpp: Math.max(0, Math.min(2, +out.mpp_estimate || 0)),
      mpp_basis: String(out.mpp_basis || '').slice(0, 160), floors: Math.max(0, Math.min(60, Math.round(+out.floors_estimate || 0))),
      neighbours: (out.neighbours || []).slice(0, 8).map(n => ({ poly: poly(n.poly), floors: Math.max(0, Math.min(60, Math.round(+n.floors || 0))), note: String(n.note || '').slice(0, 80) })).filter(n => n.poly.length >= 3),
      notes: String(out.notes || '').slice(0, 240) });
    return Response.json({ tank_px: Math.max(0, +out.tank_px || 0), objects: (out.objects || []).slice(0, 60).map(o => ({ kind: KINDS.includes(o.kind) ? o.kind : 'other', name: String(o.name_ar || '').slice(0, 40), cx: c01(o.cx), cy: c01(o.cy), w: c01(o.w), l: c01(o.l),
      angle: +o.angle_deg || 0, h: Math.max(0, Math.min(20, +o.height_m || 0)), conf: c01(o.confidence) })), notes: String(out.notes || '').slice(0, 240) });
  } catch (e) { return Response.json({ error: 'ما قدرت أوصل لـ OpenAI: ' + e.message }); }
}
