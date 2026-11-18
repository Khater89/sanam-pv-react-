// PVGIS 5.3 TMY proxy. PVGIS sends no CORS headers, so the browser can't call it directly.
// Railway runs this server-side; responses are cached in memory for 30 days per rounded coordinate.
export const runtime = 'nodejs';
const CACHE = new Map();
const TTL = 30 * 24 * 3600 * 1000;

export async function GET(req) {
  const u = new URL(req.url);
  const lat = parseFloat(u.searchParams.get('lat'));
  const lon = parseFloat(u.searchParams.get('lon'));
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return Response.json({ message: 'lat/lon غير صحيحة' }, { status: 400 });
  const key = lat.toFixed(3) + ',' + lon.toFixed(3);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.t < TTL) return Response.json(hit.j, { headers: { 'x-cache': 'hit' } });
  const url = `https://re.jrc.ec.europa.eu/api/v5_3/tmy?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&outputformat=json`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const t = await r.text();
    if (!r.ok) return Response.json({ message: 'PVGIS ' + r.status + ': ' + t.slice(0, 200) }, { status: 502 });
    const j = JSON.parse(t);
    if (!j.outputs) return Response.json({ message: j.message || 'رد غير متوقع من PVGIS' }, { status: 502 });
    if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(key, { t: Date.now(), j });
    return Response.json(j, { headers: { 'x-cache': 'miss' } });
  } catch (e) {
    return Response.json({ message: 'ما قدرت أوصل PVGIS: ' + e.message }, { status: 502 });
  }
}
