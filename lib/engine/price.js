/* Sanam PV — estimated turnkey price in Jordan (JD), by system size.
   Anchor points = installed price per kWp (supply + structure + cables + protection + installation + approvals),
   low / typical / high. Between anchors: log-log interpolation (price per kWp falls with size, economies of scale).
   Sources (Nov 2026):
   - Attaqa (Jan 2025): home systems ≈ 500 JD/kW; Attaqa (Feb 2025): 3–5 kW homes 2,300–4,200 JD.
   - OpenSooq listing (Aug 2026): 5.4 kW single-phase system 1,950 JD (aggressive low end).
   - Attaqa panel survey (May 2026): panels 0.108–0.130 JD/W.
   - Commercial / farm anchors: market estimate scaled from module + inverter + BOS shares; refine with real quotes. */
export const PRICE_SRC = 'Attaqa 1/2025 (≈500 JD/kW منزلي، 3–5 kW = 2,300–4,200 JD)، OpenSooq 8/2026 (5.4 kW = 1,950 JD)، مسح أسعار الألواح Attaqa 5/2026. التجاري والمزارع تقدير سوقي مبني على حصص المعدات.';

/* segment: [kWp, low, typical, high] JD per kWp */
export const ANCHORS = {
  res1: { ar: 'منزلي سنغل فيز', pts: [[2, 480, 600, 760], [3.68, 400, 500, 640], [5.5, 360, 440, 560]] },
  res3: { ar: 'منزلي أو تجاري صغير 3 فاز', pts: [[5, 380, 460, 580], [8, 350, 420, 530], [11.04, 330, 400, 500], [20, 310, 375, 470]] },
  com: { ar: 'تجاري / صناعي على السطح', pts: [[20, 320, 380, 470], [50, 295, 350, 430], [100, 275, 325, 395], [300, 255, 300, 360], [1000, 240, 280, 335]] },
  farm: { ar: 'مزرعة / أرضي (Ground-mount)', pts: [[100, 290, 340, 410], [500, 255, 295, 350], [1000, 235, 270, 320], [5000, 210, 245, 290]] }
};
/* add-ons */
export const ADD = {
  hybridInvPerKW: [60, 90, 130],    // hybrid inverter premium over a grid-tie, JD/kWac
  batLV: [150, 190, 240],          // LFP 48 V rack / wall, JD per nominal kWh
  batHV: [200, 250, 310],          // LFP HV stack, JD per nominal kWh
  elevated: [40, 60, 90]           // elevated (high) steel structure, JD/kWp
};

function interp(pts, x) {
  if (x <= pts[0][0]) return pts[0].slice(1);
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1].slice(1);
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const a = pts[i - 1], b = pts[i], t = Math.log(x / a[0]) / Math.log(b[0] / a[0]);
    return [1, 2, 3].map(k => Math.exp(Math.log(a[k]) + t * (Math.log(b[k]) - Math.log(a[k]))));
  }
}

/* o: { kWp, kWac, stype, phase, sector, batKWh, batHV, mount: 'roof'|'ground'|'elevated', k (market factor, 1 = typical) } */
export function segmentFor(o) {
  if (o.mount === 'ground' || /agri|farm|water|extractive/.test(o.sector || '') && o.kWp >= 100) return 'farm';
  if ((o.sector || '').indexOf('dom_') === 0 && o.kWp <= 20) return o.phase === '1ph' ? 'res1' : 'res3';
  if (o.kWp < 20) return o.phase === '1ph' ? 'res1' : 'res3';
  return 'com';
}
export function estimate(o) {
  const seg = segmentFor(o), A = ANCHORS[seg], perKWp = interp(A.pts, Math.max(0.5, o.kWp || 0)), k = o.k || 1, lines = [];
  const pv = perKWp.map(v => v * o.kWp * k);
  lines.push({ k: 'المنظومة الشمسية (' + A.ar + ')', v: pv, note: Math.round(perKWp[1]) + ' JD/kWp نموذجي' });
  if (o.stype === 'hybrid' || o.stype === 'offgrid') { const h = ADD.hybridInvPerKW.map(v => v * (o.kWac || 0) * k); lines.push({ k: 'فرق الانفيرتر الهجين', v: h, note: (o.kWac || 0).toFixed(1) + ' kWac' }); }
  if (o.batKWh > 0) { const t = o.batHV ? ADD.batHV : ADD.batLV, b = t.map(v => v * o.batKWh * k); lines.push({ k: 'البطاريات ' + (o.batHV ? 'HV' : 'LV'), v: b, note: o.batKWh.toFixed(1) + ' kWh اسمي × ' + t[1] + ' JD/kWh' }); }
  if (o.mount === 'elevated') { const e = ADD.elevated.map(v => v * o.kWp * k); lines.push({ k: 'هيكل مرتفع', v: e, note: ADD.elevated[1] + ' JD/kWp' }); }
  const tot = [0, 1, 2].map(i => lines.reduce((a, l) => a + l.v[i], 0));
  return { seg, segAr: A.ar, perKWp, lines, tot, perW: tot.map(v => v / Math.max(1e-9, o.kWp * 1000)), src: PRICE_SRC };
}
