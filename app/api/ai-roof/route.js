// AI roof scan: sends the site image to OpenAI (Responses API, vision) and returns the roof outline and the objects on it.
// Needs OPENAI_API_KEY on the server (Railway → Variables). Optional OPENAI_MODEL (default gpt-5.5).
export const runtime = 'nodejs';

const PROMPT = (w, h, mpp) => `You are analysing a top-down image of a building roof (satellite screenshot, drone photo or plan) for a rooftop solar PV layout.
Image size: ${w} x ${h} pixels${mpp ? `, about ${mpp.toFixed(3)} metres per pixel` : ''}.
Return ONLY a JSON object with:
- "roof": the outer edge of the main flat roof the user wants to use, as a polygon [[x,y],...] in NORMALISED image coordinates (0..1, origin top-left), 4-12 vertices, clockwise, following the parapet line.
- "objects": every obstruction ON that roof (water tanks, stair room / roof access, AC units, solar water heaters, chimneys, satellite dishes, existing panels): [{"type": "<Arabic name, e.g. خزان مي، بيت درج، مكيف، سخان شمسي>", "poly": [[x,y],[x,y],[x,y],[x,y]] normalised oriented rectangle, "height_m": estimated height above the roof in metres}].
- "parapet_m": estimated parapet height in metres if visible, else 0.
- "notes": one short sentence in Arabic about anything uncertain.
Be precise with coordinates; do not include neighbouring roofs.`;

export async function POST(req) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: 'ما في مفتاح OpenAI على السيرفر: ضيف OPENAI_API_KEY بإعدادات Railway (Variables) وأعد النشر.' }, { status: 200 });
  let b; try { b = await req.json(); } catch (e) { return Response.json({ error: 'طلب غير صالح' }, { status: 400 }); }
  if (!b.image || !/^data:image\//.test(b.image) || b.image.length > 6e6) return Response.json({ error: 'الصورة ناقصة أو كبيرة كثير' }, { status: 400 });
  try {
    const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-5.5', input: [{ role: 'user', content: [{ type: 'input_text', text: PROMPT(b.w, b.h, b.mpp) }, { type: 'input_image', image_url: b.image, detail: 'high' }] }],
        text: { format: { type: 'json_object' } } }) });
    const j = await r.json();
    if (!r.ok) return Response.json({ error: 'OpenAI ' + r.status + ': ' + ((j.error && j.error.message) || '').slice(0, 200) });
    const txt = j.output_text || (j.output || []).flatMap(o => o.content || []).filter(c => c.type === 'output_text' || c.text).map(c => c.text).join('');
    let out; try { out = JSON.parse(txt); } catch (e) { return Response.json({ error: 'رد غير مفهوم من الذكاء الاصطناعي' }); }
    const clamp = a => Array.isArray(a) ? a.filter(p => Array.isArray(p) && p.length >= 2).map(p => [Math.max(0, Math.min(1, +p[0])), Math.max(0, Math.min(1, +p[1]))]) : [];
    return Response.json({ roof: clamp(out.roof), objects: (out.objects || []).map(o => ({ type: String(o.type || 'جسم').slice(0, 30), poly: clamp(o.poly), height_m: Math.max(0, Math.min(30, +o.height_m || 1.5)) })),
      parapet_m: Math.max(0, Math.min(3, +out.parapet_m || 0)), notes: String(out.notes || '').slice(0, 200) });
  } catch (e) { return Response.json({ error: 'ما قدرت أوصل لـ OpenAI: ' + e.message }); }
}
