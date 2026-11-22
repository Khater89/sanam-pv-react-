/* Sanam PV — protective device catalogue and selection (AC and DC).
   The tool compares the device families for each position and picks the cheapest one that meets the requirement:
   rated current, short-circuit breaking capacity vs the prospective fault current (Ik), AC/DC and voltage, residual-current
   need, adjustability/selectivity. Sources: IEC 60898-1 (MCB: ≤ 125 A, ≤ 440 V, Icn ≤ 25 kA, fixed curves B/C/D),
   IEC 60947-2 (MCCB/ACB: adjustable trips, Icu/Ics up to 100–200 kA, AC or DC), IEC 61008 (RCCB: residual only, needs an
   overcurrent device), IEC 61009 (RCBO: MCB + RCD in one, for one circuit), IEC 60269-6 (gPV fuses), IEC 60947-3 (DC-PV2
   switch-disconnectors), UL 248-15 Class T / NH gG DC fuses for lithium battery mains (high DC fault current). */
const STD_I = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000];
const up = v => STD_I.find(x => x >= v - 1e-9) || STD_I[STD_I.length - 1];

export const AC_DEV = [
  { id: 'MCB', ar: 'قاطع مصغّر MCB', std: 'IEC 60898-1', iMin: 6, iMax: 125, icu: [6, 10, 15, 25], adj: false, rcd: false, cost: 1, use: 'دوائر نهائية وخرج انفيرترات صغيرة' },
  { id: 'MCCB', ar: 'قاطع علبة مقولبة MCCB', std: 'IEC 60947-2', iMin: 16, iMax: 1600, icu: [25, 36, 50, 70, 100, 150], adj: true, rcd: false, cost: 4, use: 'تغذيات رئيسية، انفيرترات كبيرة، لوحات تجارية وصناعية' },
  { id: 'ACB', ar: 'قاطع هوائي ACB', std: 'IEC 60947-2', iMin: 630, iMax: 6300, icu: [50, 65, 85, 100], adj: true, rcd: false, cost: 12, use: 'المداخل الرئيسية الكبيرة (محطات > 400 kW تقريباً)' }];
export const RCD_DEV = [
  { id: 'RCBO', ar: 'RCBO (قاطع + حماية تسرب)', std: 'IEC 61009', iMax: 63, poles3: true, cost: 2.2, note: 'جهاز واحد للدائرة: حمولة زائدة + قصر + تسرب' },
  { id: 'RCCB', ar: 'RCCB (حماية تسرب فقط)', std: 'IEC 61008', iMax: 125, poles3: true, cost: 1.6, note: 'ما بيحمي من الحمولة الزائدة: لازم معه MCB/MCCB قبله' },
  { id: 'ELR', ar: 'ريليه تسرب + ملف فصل للـ MCCB (ELR / Vigi)', std: 'IEC 60947-2 Annex B / M', iMax: 1600, poles3: true, cost: 3, note: 'للتيارات فوق 125 A مع MCCB أو ACB، حساسية قابلة للضبط' }];
export const DC_DEV = [
  { id: 'gPV', ar: 'فيوز gPV (مع حامل)', std: 'IEC 60269-6', iMax: 32, vMax: 1500, cost: 0.5, use: 'Strings بالتوازي (≥ 3) — أرخص حل، بس بدها تبديل بعد الفصل' },
  { id: 'DCMCB', ar: 'قاطع DC مصغّر', std: 'IEC 60947-2 / IEC 60898-2', iMax: 125, vMax: 1000, cost: 1.5, use: 'Strings أو بطاريات صغيرة — بيرجع بدون تبديل' },
  { id: 'DCMCCB', ar: 'قاطع DC علبة مقولبة', std: 'IEC 60947-2', iMax: 1600, vMax: 1500, cost: 5, use: 'تجميع المصفوفة والبطاريات الكبيرة وHV' },
  { id: 'NH', ar: 'فيوز NH gG/aR DC أو Class T + مفصل', std: 'IEC 60269 / UL 248-15', iMax: 1250, vMax: 1000, cost: 2, use: 'خط البطارية الليثيوم الرئيسي (تيار قصر DC عالي جداً)' }];

/* Ik: prospective short-circuit current at the board, kA (≈ 6 domestic, 10 commercial, 25+ near a transformer) */
export function selectAC(o) { const In = up(1.25 * o.I), Ik = o.Ik || 6, rows = [];
  AC_DEV.forEach(d => { const icu = d.icu.find(x => x >= Ik), ok = In >= d.iMin && In <= d.iMax && !!icu;
    rows.push({ id: d.id, ar: d.ar, ok, cost: d.cost * (In > 63 ? 1.5 : 1) * (o.ph3 ? 1.6 : 1), why: !icu ? 'قدرة القطع القصوى ' + d.icu[d.icu.length - 1] + ' kA أقل من تيار القصر ' + Ik + ' kA' : In < d.iMin ? 'أصغر تيار ' + d.iMin + ' A — مبالغة' : In > d.iMax ? 'أقصى تيار ' + d.iMax + ' A' : 'In ' + In + ' A، Icu ≥ ' + icu + ' kA' + (d.adj ? '، تريب قابل للضبط (تنسيق/انتقائية)' : '، منحنى ثابت B/C'), icu, std: d.std }); });
  if (o.price) rows.forEach(r => { const q = o.price(r.id, In, o.ph3 ? 4 : 2, { icu: Ik }); if (q) { r.jd = q.jd; r.model = q.model; r.cost = q.jd; } });
  const pick = rows.filter(r => r.ok).sort((a, b) => a.cost - b.cost)[0] || rows[1];
  // residual-current protection
  const need = o.rcd !== false, rr = []; if (need) RCD_DEV.forEach(d => { const ok = In <= d.iMax && (d.id !== 'RCBO' || (pick.id === 'MCB' && In <= 63)) && (d.id !== 'ELR' || pick.id !== 'MCB');
    rr.push({ id: d.id, ar: d.ar, ok, cost: d.cost, why: !ok ? (In > d.iMax ? 'أقصى تيار ' + d.iMax + ' A' : d.id === 'RCBO' ? 'بس مع دوائر MCB لحد 63 A' : 'للـ MCCB/ACB بس') : d.note, std: d.std }); });
  if (o.price) rr.forEach(r => { const q = o.price(r.id, In, o.ph3 ? 4 : 2, { rcd: 1 }); if (q) { r.jd = q.jd; r.model = q.model; } });
  const okR = rr.filter(r => r.ok), priced = okR.length > 1 && okR.every(r => r.jd != null) && pick.jd != null, eff = r => r.id === 'RCBO' ? r.jd - pick.jd : r.jd; // an RCBO replaces the MCB
  if (priced) okR.forEach(r => { r.why += ' — بالمقارنة: ' + (r.id === 'RCBO' ? 'RCBO ' + r.jd + ' JD بدل MCB ' + pick.jd + ' JD' : r.id + ' ' + r.jd + ' JD + القاطع ' + pick.jd + ' JD'); });
  const rPick = (priced ? okR.sort((a, b) => eff(a) - eff(b)) : okR.sort((a, b) => (a.id === 'RCBO' ? -1 : 0) - (b.id === 'RCBO' ? -1 : 0) || a.cost - b.cost))[0] || null;
  const curve = o.app === 'inverter' ? 'C' : 'C', idn = !o.ph3 ? 30 : In <= 63 ? 100 : 300;
  return { In, Ik, pick, rows, rcd: rPick, rcdRows: rr, curve, idn, icu: pick.icu }; }

/* DC: app = 'string' (strings per MPPT, Isc, Voc), 'battery' (I, V) */
export function selectDC(o) { const rows = [];
  if (o.app === 'string') { const nPar = o.nPar || 1, need = nPar >= 3, In = [10, 12, 15, 16, 20, 25, 30, 32].find(x => x >= 1.5 * o.Isc && x <= Math.max(2.4 * o.Isc, 1.5 * o.Isc + 1)) || 32;
    DC_DEV.filter(d => d.id !== 'NH').forEach(d => { const ok = need && In <= d.iMax && o.V <= d.vMax; rows.push({ id: d.id, ar: d.ar, ok, cost: d.cost, why: !need ? 'مش لازم: ' + nPar + ' string على الـ MPPT (أقل من 3)' : o.V > d.vMax ? 'أقصى جهد ' + d.vMax + ' V' : d.use, std: d.std }); });
    if (o.price) rows.forEach(r => { const q = o.price(r.id, In, 2, { V: o.V }); if (q) { r.jd = q.jd * (r.id === 'gPV' ? 2 : 1); r.model = q.model; r.cost = r.jd; } });
    return { need, In, rows, pick: rows.filter(r => r.ok).sort((a, b) => a.cost - b.cost)[0] || null }; }
  const In = up(1.25 * o.I), hv = o.V > 150;
  DC_DEV.filter(d => d.id !== 'gPV').forEach(d => { const lvOK = d.id === 'DCMCB' ? In <= 125 && !o.lithium500 : true, ok = In <= d.iMax && o.V * 1.25 <= d.vMax && lvOK && !(d.id === 'NH' && hv && In < 63);
    rows.push({ id: d.id, ar: d.ar, ok, cost: d.cost * (In > 125 ? 1.6 : 1), why: In > d.iMax ? 'أقصى تيار ' + d.iMax + ' A' : o.V * 1.25 > d.vMax ? 'أقصى جهد ' + d.vMax + ' V DC' : d.use, std: d.std }); });
  if (o.price) rows.forEach(r => { const q = o.price(r.id, In, 2, { V: o.V * 1.25 }); if (q) { r.jd = q.jd; r.model = q.model; r.cost = q.jd; } });
  // lithium LV banks: prefer a fuse (NH / Class T) above 125 A because of the very high DC short-circuit current
  const pick = rows.filter(r => r.ok).sort((a, b) => (!hv && In > 125 ? (a.id === 'NH' ? -1 : 0) - (b.id === 'NH' ? -1 : 0) : 0) || a.cost - b.cost)[0] || rows[rows.length - 1];
  return { In, rows, pick }; }

/* comparison table HTML */
export function cmpTable(title, rows, pickId, esc) { esc = esc || (s => s); return '<div class="pcmp"><b>' + esc(title) + '</b><table><thead><tr><th>الجهاز</th><th>المعيار</th><th>مناسب؟</th><th class="n">السعر JD</th><th>السبب</th></tr></thead><tbody>' +
  rows.map(r => '<tr class="' + (r.id === pickId ? 'pk' : '') + '"><td>' + (r.id === pickId ? '⭐ ' : '') + esc(r.ar) + (r.model ? '<div class="mute">' + esc(r.model) + '</div>' : '') + '</td><td>' + esc(r.std || '') + '</td><td>' + (r.ok ? '✓' : '✗') + '</td><td class="n">' + (r.jd != null ? (Math.round(r.jd * 100) / 100) : '—') + '</td><td class="mute">' + esc(r.why) + '</td></tr>').join('') + '</tbody></table></div>'; }
