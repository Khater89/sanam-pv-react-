// Google satellite tiles (Map Tiles API, 2D tiles) through the server, so the key stays here.
// Needs GOOGLE_MAPS_KEY (Railway → Variables) with the Map Tiles API enabled. Without it: { on: false } and the drawing uses Esri.
//   ?status=1                         → { on }
//   ?z=&x=&y=                         → the tile image
//   ?attr=1&zoom=&n=&s=&e=&w=         → { copyright } (the attribution Google requires on the map)
export const runtime = 'nodejs';
let S = null; // { token, exp }
async function session(key) {
  if (S && S.exp > Date.now() + 60000) return S.token;
  const r = await fetch('https://tile.googleapis.com/v1/createSession?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapType: 'satellite', language: 'ar', region: 'JO', scale: 'scaleFactor2x', highDpi: true }) });
  if (!r.ok) throw new Error('createSession ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json(); S = { token: j.session, exp: j.expiry ? +j.expiry * 1000 : Date.now() + 12 * 3600e3 }; return S.token; }
export async function GET(req) {
  const key = process.env.GOOGLE_MAPS_KEY, u = new URL(req.url), q = k => u.searchParams.get(k);
  if (q('status')) return Response.json({ on: !!key });
  if (!key) return new Response('no key', { status: 404 });
  try { const tok = await session(key), base = '?session=' + encodeURIComponent(tok) + '&key=' + encodeURIComponent(key);
    if (q('attr')) { const r = await fetch('https://tile.googleapis.com/tile/v1/viewport' + base + '&zoom=' + (+q('zoom') || 19) + '&north=' + +q('n') + '&south=' + +q('s') + '&east=' + +q('e') + '&west=' + +q('w'));
      const j = r.ok ? await r.json() : {}; return Response.json({ copyright: j.copyright || 'Google' }); }
    const z = Math.round(+q('z')), x = Math.round(+q('x')), y = Math.round(+q('y'));
    if (!(z >= 0 && z <= 22) || !(x >= 0) || !(y >= 0)) return new Response('bad tile', { status: 400 });
    const r = await fetch('https://tile.googleapis.com/v1/2dtiles/' + z + '/' + x + '/' + y + base);
    if (r.status === 401 || r.status === 403) S = null;
    if (!r.ok) return new Response('tile ' + r.status, { status: r.status });
    return new Response(await r.arrayBuffer(), { headers: { 'Content-Type': r.headers.get('content-type') || 'image/png', 'Cache-Control': 'private, max-age=3600' } });
  } catch (e) { return new Response(String(e.message || e), { status: 502 }); } }
