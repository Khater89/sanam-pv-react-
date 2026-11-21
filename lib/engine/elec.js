/* Sanam PV — cables, voltage drop, ohmic losses and protections (DC + AC), and the detailed single-line diagram.
   References: IEC 62548 (PV array design: string cable ≥ 1.25 Isc, fuses 1.5–2.4 Isc when ≥ 3 strings in parallel, Voc
   margin 1.2), IEC 60364-7-712, EN 50618 / H1Z2Z2-K (PV cable ampacity), IEC 60364-5-52 (AC cable ampacity, method C,
   XLPE Cu), IEC 61643-31/-11 (SPD), PVsyst "Ohmic losses" (loss fraction at STC). Values are for preliminary design. */
import { selectAC, selectDC, cmpTable } from './protect';
export { cmpTable };
const RHO = 0.0214; // Ω·mm²/m, copper at ~60 °C
const PV_AMP = [[4, 55], [6, 70], [10, 98], [16, 132], [25, 176], [35, 218]];                 // H1Z2Z2-K, single core in free air, 60 °C
const BAT_AMP = [[6, 54], [10, 75], [16, 100], [25, 135], [35, 170], [50, 210], [70, 260], [95, 320], [120, 370], [150, 425], [185, 490], [240, 580]]; // flexible Cu 90 °C, in air
const AC_AMP = [[2.5, 30], [4, 40], [6, 51], [10, 70], [16, 94], [25, 119], [35, 148], [50, 180], [70, 232], [95, 282], [120, 328], [150, 379], [185, 434], [240, 514]]; // Cu XLPE, method C, 30 °C
const FUSE = [10, 12, 15, 16, 20, 25, 30, 32, 40];
const MCB = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800];
const DCBRK = [32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];
const ISO_I = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
const pick = (arr, v) => arr.find(x => x >= v - 1e-9) || arr[arr.length - 1];
const vClass = v => [600, 800, 1000, 1100, 1200, 1500].find(x => x >= v) || 1500;
export const DEF_ELEC = { Ik: 6, dvDC: 1.5, dvAC: 1.5, dvBat: 1, kGrpDC: 0.9, kAmbAC: 0.87, lDC: '', lAC: 10, lBat: 2, drop: 3, cosphi: 1, fuseMax: 25, auto: 1 };

function size(table, Ireq, dvFn, dvMax) { for (const [A, Iz] of table) if (Iz >= Ireq && dvFn(A) <= dvMax) return { A, Iz }; const L = table[table.length - 1]; return { A: L[0], Iz: L[1], over: true }; }

/* o: { m, inv, nInv, ns, nstr (per inverter), perMPPT, V (S.check V), kWp, kWac, stype, phase ('1ph'|'3ph'), bat: {V, maxA, hv} | null, P (DEF_ELEC overrides), lenDC: [one-way m per string] } */
export function design(o) {
  const P = Object.assign({}, DEF_ELEC, o.P || {}), m = o.m, v = o.inv, nStr = o.ns ? o.nstr * o.nInv : 0, vmp = o.ns * m.Vmp, cab = [], prot = [], notes = [];
  if (!m.Isc || !o.ns || !nStr) return null;
  // ---------- DC strings ----------
  const lens = o.lenDC && o.lenDC.length ? o.lenDC : new Array(nStr).fill(+P.lDC || 20), Lmax = Math.max(...lens), Lavg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const Idc = 1.25 * m.Isc, Iz = A => A, dvS = A => 2 * Lmax * m.Imp * RHO / A / vmp * 100;
  const sDC = size(PV_AMP.map(([A, I]) => [A, I * P.kGrpDC]), Idc, dvS, +P.dvDC);
  const pDC = lens.reduce((a, L) => a + 2 * L * RHO / sDC.A * m.Imp * m.Imp, 0), pctDC = pDC / (o.kWp * 1000);
  cab.push({ id: 'dc', k: 'كابل الـ Strings (DC)', spec: 'H1Z2Z2-K 1×' + sDC.A + ' mm² (+ و −)، EN 50618، 1.5 kV DC', n: nStr + ' string × 2', L: Lavg, Lmax, Ireq: Idc, Iz: sDC.Iz, dv: dvS(sDC.A), loss: pctDC,
    why: 'التيار التصميمي = 1.25 × Isc = 1.25 × ' + m.Isc + ' = ' + Idc.toFixed(1) + ' A (IEC 62548). هبوط الجهد لأطول string (' + Lmax.toFixed(0) + ' m) = 2·L·Imp·ρ/A ÷ Vmp ≤ ' + P.dvDC + '٪.' + (sDC.over ? ' ⚠ ما في مقطع بيحقق الشرطين، قلل الطول.' : '') });
  // ---------- DC protections ----------
  const perM = o.perMPPT || 1, VocMax = o.V ? o.V.vocMin : o.ns * m.Voc * 1.15, Ue = vClass(VocMax * 1.0), Ucpv = vClass(1.2 * o.ns * m.Voc);
  const SF = selectDC({ app: 'string', nPar: perM, Isc: m.Isc, V: VocMax });
  if (SF.need && SF.pick) prot.push({ side: 'DC', k: SF.pick.id === 'gPV' ? 'فيوز String (gPV)' : 'قاطع String (DC MCB)', spec: SF.In + ' A ' + (SF.pick.id === 'gPV' ? 'gPV' : 'DC 2P') + '، ' + Ue + ' V DC، ' + SF.pick.std, n: nStr * 2 + ' (على + و −)', why: perM + ' strings على نفس الـ MPPT: التيار العكسي ممكن يتجاوز تحمّل اللوح. 1.5 × Isc ≤ In ≤ 2.4 × Isc. انختار الأرخص المناسب.', cmp: [['حماية الـ Strings', SF.rows, SF.pick.id]] });
  else notes.push('ما في حاجة لفيوزات String: عدد الـ strings على كل MPPT ' + perM + ' (أقل من 3، IEC 62548).');
  const Iiso = 1.25 * m.Isc * perM, isoI = pick(ISO_I, Iiso), nMppt = Math.ceil(nStr / perM);
  prot.push({ side: 'DC', k: 'مفتاح فصل DC (DC Isolator)', spec: isoI + ' A، ' + Ue + ' V DC، DC-PV2، IEC 60947-3، قابل للقفل', n: nMppt + ' (واحد لكل MPPT، قطبين)', why: 'Ie ≥ 1.25 × Isc × ' + perM + ' = ' + Iiso.toFixed(1) + ' A، Ue ≥ Voc عند أقل حرارة = ' + VocMax.toFixed(0) + ' V.' });
  prot.push({ side: 'DC', k: 'مانعة صواعق DC (SPD Type 2)', spec: 'Ucpv ' + Ucpv + ' V DC، In 20 kA، Imax 40 kA، Up ≤ 4 kV، IEC 61643-31', n: o.nInv + ' (عند مدخل الانفيرتر)', why: 'Ucpv ≥ 1.2 × Voc(STC) × Ns = ' + (1.2 * o.ns * m.Voc).toFixed(0) + ' V. لو الكابل من الألواح أطول من 10 m بتنحط وحدة كمان جنب الألواح.' });
  // ---------- battery ----------
  if (o.bat && o.bat.V) { const Vb = o.bat.V, Ib = Math.max(o.bat.maxA || 0, v.Pac * 1000 / (Vb * 0.95)), Lb = +P.lBat || 2, dvB = A => 2 * Lb * Ib * RHO / A / Vb * 100;
    const SB = selectDC({ app: 'battery', I: Ib, V: Vb }), In = SB.In, sB = size(BAT_AMP, In, dvB, +P.dvBat);
    cab.push({ id: 'bat', k: 'كابل البطارية (DC)', spec: 'Cu مرن 1×' + sB.A + ' mm² (+ و −)، 1 kV', n: o.nInv + ' × 2', L: Lb, Lmax: Lb, Ireq: In, Iz: sB.Iz, dv: dvB(sB.A), loss: null,
      why: 'التيار = max(أقصى تيار البطارية، Pac ÷ (Vbat × 0.95)) = ' + Ib.toFixed(0) + ' A. الحماية ≥ 1.25 × التيار = ' + In + ' A، وتحمّل الكابل ≥ الحماية. هبوط الجهد ≤ ' + P.dvBat + '٪ على ' + Vb + ' V.' });
    prot.push({ side: 'DC', k: 'حماية البطارية — ' + SB.pick.ar, spec: In + ' A DC، ' + (Vb > 100 ? vClass(Vb * 1.25) : 125) + ' V DC، قدرة قطع ≥ 20 kA DC، ' + SB.pick.std, n: o.nInv, why: 'In ≥ 1.25 × ' + Ib.toFixed(0) + ' A. لازم تكون DC وقريبة من البطارية قدر الإمكان.' + (Vb < 150 && In > 125 ? ' فوق 125 A ببطارية ليثيوم LV الفيوز أضمن لأنه تيار القصر DC عالي جداً.' : ''), cmp: [['حماية البطارية', SB.rows, SB.pick.id]] });
  }
  // ---------- AC ----------
  const ph3 = o.phase === '3ph', Vn = ph3 ? 400 : 230, Iac = v.Pac * 1000 / (ph3 ? Math.sqrt(3) * 400 * P.cosphi : 230 * P.cosphi), Lac = +P.lAC || 10;
  const SA = selectAC({ I: Iac, Ik: +P.Ik || 6, ph3, app: 'inverter' }), In = SA.In, dvA = A => (ph3 ? Math.sqrt(3) * Lac * Iac * RHO * P.cosphi : 2 * Lac * Iac * RHO) / A / Vn * 100;
  const sA = size(AC_AMP.map(([A, I]) => [A, I * P.kAmbAC]), In, dvA, +P.dvAC), pA = (ph3 ? 3 : 2) * Lac * RHO / sA.A * Iac * Iac * o.nInv, pctAC = pA / (o.kWac * 1000);
  const core = ph3 ? '5×' : '3×';
  cab.push({ id: 'ac', k: 'كابل AC (انفيرتر ← اللوحة)', spec: 'Cu XLPE ' + core + sA.A + ' mm² (' + (ph3 ? 'L1 L2 L3 N PE' : 'L N PE') + ')، 0.6/1 kV', n: o.nInv, L: Lac, Lmax: Lac, Ireq: In, Iz: sA.Iz, dv: dvA(sA.A), loss: pctAC,
    why: 'Iac = ' + (ph3 ? 'Pac ÷ (√3 × 400)' : 'Pac ÷ 230') + ' = ' + Iac.toFixed(1) + ' A. القاطع ≥ 1.25 × Iac، والكابل ≥ القاطع بعد معامل حرارة ' + P.kAmbAC + '. هبوط الجهد ≤ ' + P.dvAC + '٪.' });
  const rcbo = SA.rcd && SA.rcd.id === 'RCBO', poles = ph3 ? '4P' : '2P';
  prot.push({ side: 'AC', k: rcbo ? 'قاطع AC مع حماية تسرب (RCBO)' : 'قاطع AC (' + SA.pick.id + ')', spec: In + ' A، ' + poles + '، ' + (SA.pick.id === 'MCB' ? 'منحنى ' + SA.curve : 'تريب قابل للضبط Ir = ' + (1.25 * Iac / In).toFixed(2) + ' × In') + '، Icu ≥ ' + SA.icu + ' kA (تيار القصر ' + SA.Ik + ' kA)' + (rcbo ? '، IΔn ' + SA.idn + ' mA Type A' : '') + '، ' + SA.pick.std, n: o.nInv,
    why: 'In ≥ 1.25 × Iac = ' + (1.25 * Iac).toFixed(1) + ' A، وIn ≤ Iz للكابل. قدرة القطع لازم تكون أكبر من تيار القصر المتوقع بنقطة التركيب. انختار الأرخص من الأنواع المناسبة.', cmp: [['قاطع الـ AC', SA.rows, SA.pick.id]].concat(SA.rcdRows.length ? [['حماية التسرب', SA.rcdRows, SA.rcd && SA.rcd.id]] : []) });
  if (SA.rcd && !rcbo) prot.push({ side: 'AC', k: 'حماية تسرب — ' + SA.rcd.ar, spec: 'Type A، ' + SA.idn + ' mA، ' + poles + ' ' + (SA.rcd.id === 'ELR' ? 'مع ملف فصل على الـ ' + SA.pick.id : pick([25, 40, 63, 80, 100, 125], In) + ' A') + '، ' + SA.rcd.std, n: o.nInv, why: 'Type A بيكفي إذا الانفيرتر بيمنع تيار DC المتسرب (مكتوب بالداتا شيت أو فيه عازل)، وإلا Type B (IEC 60364-7-712).' });
  prot.push({ side: 'AC', k: 'مانعة صواعق AC (SPD Type 2)', spec: 'Uc 275 V، In 20 kA، Imax 40 kA، ' + (ph3 ? '3P+N' : '1P+N') + '، IEC 61643-11', n: 1, why: 'عند لوحة التوزيع الرئيسية، وبتتأرض مع المانعة الـ DC على نفس قضيب التأريض.' });
  if (o.stype === 'grid' || o.stype === 'hybrid') prot.push({ side: 'AC', k: 'عداد ثنائي الاتجاه + مفتاح فصل رئيسي', spec: 'من شركة التوزيع (JEPCO / IDECO / EDCO)، ' + (ph3 ? '3 فاز' : 'سنغل فيز'), n: 1, why: 'شرط هيئة تنظيم قطاع الطاقة لأنظمة صافي القياس / صافي الفاتورة.' });
  prot.push({ side: 'AC', k: 'التأريض', spec: 'PE أصفر/أخضر 6 mm² لكل هيكل، موصل ربط 16 mm² للقضيب، مقاومة أرضي ≤ 10 Ω', n: 1, why: 'ربط كل الهياكل المعدنية وإطارات الألواح ومانعات الصواعق على نقطة تأريض وحدة (IEC 60364-5-54).' });
  // cable schedule (runs × length × price)
  const pr = o.price || ((kind, A, c) => Math.round((0.075 * A * (c || 1) + (kind === 'ac' ? 0.3 : kind === 'battery' ? 0.25 : kind === 'earth' ? 0.08 : 0.15)) * 100) / 100), sch = [];
  sch.push({ k: 'DC Strings (+/−)', from: 'الألواح', to: 'الانفيرتر', spec: 'H1Z2Z2-K 1×' + sDC.A + ' mm²', runs: nStr * 2, L: Lavg, tot: 2 * lens.reduce((a, b) => a + b, 0), pm: pr('dc_pv', sDC.A, 1) });
  const bc = cab.find(x => x.id === 'bat'); if (bc) sch.push({ k: 'البطارية (+/−)', from: 'البطاريات', to: 'الانفيرتر', spec: bc.spec.split('،')[0], runs: 2 * o.nInv, L: bc.L, tot: 2 * o.nInv * bc.L, pm: pr('battery', +bc.spec.match(/1×(\d+)/)[1], 1) });
  sch.push({ k: 'AC', from: 'الانفيرتر', to: 'لوحة التوزيع', spec: (ph3 ? '5×' : '3×') + sA.A + ' mm² XLPE', runs: o.nInv, L: Lac, tot: o.nInv * Lac, pm: pr('ac', sA.A, ph3 ? 5 : 3) });
  sch.push({ k: 'تأريض الهياكل (PE)', from: 'الهيكل والألواح', to: 'قضيب التأريض', spec: 'H07V-K 1×6 mm² أصفر/أخضر', runs: 1, L: Lmax, tot: Lmax, pm: pr('earth', 6, 1) });
  sch.push({ k: 'موصل التأريض الرئيسي', from: 'بار التأريض', to: 'القضيب', spec: 'H07V-K 1×16 mm²', runs: 1, L: 5, tot: 5, pm: pr('earth', 16, 1) });
  sch.forEach(r => { r.cost = r.tot * r.pm; }); const cabCost = sch.reduce((a, r) => a + r.cost, 0);
  return { cab, prot, notes, pctDC, pctAC, Iac, In, sDC, sA, P, sch, cabCost, nRuns: sch.reduce((a, r) => a + r.runs, 0) }; }

/* string routes: one-way length per string from its modules' centre to the inverter (Manhattan in the array frame + vertical drop + 2 m slack) */
export function routes(Y, toW, invPos, ns, drop) { if (!Y || !Y.n || !invPos) return null; const g = (Y.S - Y.nr * Y.mS) / Math.max(1, Y.nr - 1), cb = Math.cos(Y.b), pts = [];
  Y.tables.forEach(t => t.mods.forEach(m => { const a = m.j * (Y.mS + (Y.nr > 1 ? g : 0)) * cb + Y.mS * cb / 2; pts[m.idx] = toW(Y.F, (m.u0 + m.u1) / 2, t.vF - a); }));
  const out = []; for (let k = 0; k * ns < Y.n; k++) { const ms = pts.slice(k * ns, (k + 1) * ns).filter(Boolean); if (!ms.length) break; const c = ms.reduce((a, p) => [a[0] + p[0] / ms.length, a[1] + p[1] / ms.length], [0, 0]);
    const L = Math.abs(c[0] - invPos[0]) + Math.abs(c[1] - invPos[1]) + (+drop || 0) + 2; out.push({ k, c, L, first: ms[0], last: ms[ms.length - 1] }); }
  return out; }

/* detailed single-line diagram with protections and cable sizes */
export function sldSVG(E, o) { if (!E) return ''; const X = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'), bat = o.bat && o.bat.V, grid = o.stype === 'grid' || o.stype === 'hybrid';
  const W = 1180, H = bat ? 560 : 430, y0 = 150; let g = '';
  const box = (x, y, w, h, t1, t2, fill, stroke) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="10" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/><text x="' + (x + w / 2) + '" y="' + (y + h / 2 - 4) + '" class="t1">' + X(t1) + '</text><text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 13) + '" class="t2">' + X(t2) + '</text>';
  const wire = (x1, y1, x2, y2, col, lbl, dy) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + col + '" stroke-width="3"/>' + (lbl ? '<text x="' + ((x1 + x2) / 2) + '" y="' + ((y1 + y2) / 2 + (dy || -8)) + '" class="t3">' + X(lbl) + '</text>' : '');
  const dev = (x, y, t1, t2, sym) => { let s = '<g transform="translate(' + x + ',' + y + ')">';
    if (sym === 'fuse') s += '<rect x="-16" y="-8" width="32" height="16" rx="3" fill="#fff" stroke="#334155" stroke-width="1.5"/><line x1="-16" y1="0" x2="16" y2="0" stroke="#334155"/>';
    else if (sym === 'iso') s += '<circle cx="-14" cy="0" r="3" fill="#334155"/><circle cx="14" cy="0" r="3" fill="#334155"/><line x1="-14" y1="0" x2="12" y2="-12" stroke="#334155" stroke-width="2"/>';
    else if (sym === 'brk') s += '<rect x="-16" y="-12" width="32" height="24" rx="4" fill="#fff" stroke="#334155" stroke-width="1.5"/><path d="M-8 6 L0 -6 L8 6" fill="none" stroke="#334155" stroke-width="2"/>';
    else if (sym === 'rcd') s += '<rect x="-16" y="-12" width="32" height="24" rx="4" fill="#fff" stroke="#334155" stroke-width="1.5"/><text y="4" class="t3" style="font-size:9px">RCD</text>';
    else if (sym === 'meter') s += '<circle r="16" fill="#fff" stroke="#334155" stroke-width="1.5"/><text y="4" class="t3">kWh</text>';
    s += '<text y="-20" class="t2">' + X(t1) + '</text><text y="30" class="t3">' + X(t2) + '</text></g>'; return s; };
  const spd = (x, y, t) => '<g transform="translate(' + x + ',' + y + ')"><line x1="0" y1="0" x2="0" y2="22" stroke="#334155" stroke-width="2"/><rect x="-10" y="22" width="20" height="26" rx="3" fill="#fef3c7" stroke="#b45309"/><path d="M-4 28 L2 35 L-2 35 L4 43" fill="none" stroke="#b45309" stroke-width="1.5"/><line x1="0" y1="48" x2="0" y2="62" stroke="#16a34a" stroke-width="2"/><text y="76" class="t3">' + X(t) + '</text></g>';
  const c = k => E.cab.find(x => x.id === k), pr = k => E.prot.find(x => x.k.indexOf(k) === 0);
  // PV array
  g += box(20, y0 - 60, 190, 120, 'الألواح ' + o.kWp.toFixed(2) + ' kWp', o.nStr + ' string × ' + o.ns + ' لوح', '#fff8e6', '#f59e0b');
  let x = 210; const dcCol = '#dc2626';
  g += wire(x, y0, x + 70, y0, dcCol, (o.nStr * 2) + ' × ' + c('dc').spec.split('،')[0].replace(' (+ و −)', ''), -10) + '<text x="' + (x + 35) + '" y="' + (y0 + 18) + '" class="t3">' + c('dc').L.toFixed(0) + ' m · ΔV ' + c('dc').dv.toFixed(2) + '%</text>'; x += 70;
  const fz = E.prot.find(x => /^(فيوز String|قاطع String)/.test(x.k)); if (fz) { g += dev(x + 25, y0, fz.k.indexOf('فيوز') === 0 ? 'فيوز gPV' : 'DC MCB', fz.spec.split('،')[0], fz.k.indexOf('فيوز') === 0 ? 'fuse' : 'brk'); g += wire(x + 41, y0, x + 70, y0, dcCol); x += 70; }
  g += dev(x + 25, y0, 'DC Isolator', (E.prot.find(x => x.k.indexOf('مفتاح فصل DC') === 0) || { spec: '' }).spec.split('،').slice(0, 2).join(' ')); g += wire(x + 41, y0, x + 90, y0, dcCol); g += spd(x + 70, y0, 'SPD DC ' + (E.prot.find(x => x.k.indexOf('مانعة صواعق DC') === 0) || { spec: '' }).spec.split('،')[0].replace('Ucpv ', '')); x += 90;
  // inverter
  const ix = x, iw = 170; g += box(ix, y0 - 55, iw, 110, (o.nInv > 1 ? o.nInv + ' × ' : '') + 'الانفيرتر', o.invName + ' · ' + o.kWac.toFixed(1) + ' kW', '#eef2ff', '#6366f1'); x += iw;
  // battery
  if (bat) { const bc = c('bat'), bp = E.prot.find(x => x.k.indexOf('حماية البطارية') === 0) || { spec: '' }, bx = ix + iw / 2; g += wire(bx, y0 + 55, bx, y0 + 140, '#7c3aed', '', 0) + '<text x="' + (bx + 10) + '" y="' + (y0 + 90) + '" class="t3" text-anchor="start">' + X(bc.spec.split('،')[0]) + ' · ' + bc.L + ' m</text>';
    g += dev(bx, y0 + 160, '', bp.spec.split('،')[0], 'brk') + wire(bx, y0 + 172, bx, y0 + 220, '#7c3aed'); g += box(bx - 95, y0 + 220, 190, 80, 'البطاريات', o.batTxt, '#f5f3ff', '#7c3aed'); }
  // AC chain
  const acCol = '#1d4ed8', ac = c('ac'); g += wire(x, y0, x + 90, y0, acCol, o.nInv + ' × ' + ac.spec.split('،')[0].replace('Cu XLPE ', '').replace(/ \(.*\)/, ''), -10) + '<text x="' + (x + 45) + '" y="' + (y0 + 18) + '" class="t3">' + ac.L + ' m · ΔV ' + ac.dv.toFixed(2) + '%</text>'; x += 90;
  const br = E.prot.find(x => x.k.indexOf('قاطع AC') === 0) || { k: '', spec: '' }; g += dev(x + 18, y0, br.k.replace('قاطع AC ', '').replace('مع حماية تسرب ', ''), br.spec.split('،').slice(0, 2).join(' '), 'brk'); g += wire(x + 34, y0, x + 70, y0, acCol); x += 70;
  const rc = E.prot.find(x => x.k.indexOf('حماية تسرب') === 0); if (rc) { g += dev(x + 18, y0, 'RCD', rc.spec.split('،').slice(0, 2).join(' '), 'rcd'); } g += wire(x + (rc ? 34 : 0), y0, x + 100, y0, acCol); g += spd(x + 70, y0, 'SPD AC 275V'); x += 100;
  g += box(x, y0 - 45, 120, 90, 'لوحة التوزيع', 'الأحمال' + (o.stype === 'offgrid' ? ' (منفصل)' : ''), '#f0fdf4', '#16a34a'); x += 120;
  if (grid) { g += wire(x, y0, x + 50, y0, acCol); g += dev(x + 66, y0, 'عداد', 'ثنائي الاتجاه', 'meter'); g += wire(x + 82, y0, x + 120, y0, acCol); g += '<text x="' + (x + 150) + '" y="' + (y0 + 4) + '" class="t1">الشبكة</text>'; }
  // earthing bar
  const ey = bat ? H - 40 : H - 60; g += '<line x1="40" y1="' + ey + '" x2="' + (W - 40) + '" y2="' + ey + '" stroke="#16a34a" stroke-width="3" stroke-dasharray="8 5"/><text x="' + (W / 2) + '" y="' + (ey + 20) + '" class="t3">قضيب التأريض ≤ 10 Ω · PE 6 mm² للهياكل · 16 mm² للقضيب</text>';
  [115, ix + iw / 2 - 40].forEach(xx => { g += '<line x1="' + xx + '" y1="' + (xx === 115 ? y0 + 60 : y0 + 55) + '" x2="' + xx + '" y2="' + ey + '" stroke="#16a34a" stroke-width="1.5" stroke-dasharray="4 4"/>'; });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="sld" xmlns="http://www.w3.org/2000/svg" dir="ltr"><style>.t1{font:700 13px system-ui;fill:#0f172a;text-anchor:middle}.t2{font:600 11px system-ui;fill:#334155;text-anchor:middle}.t3{font:10.5px system-ui;fill:#475569;text-anchor:middle}text{direction:ltr;unicode-bidi:plaintext}</style>' +
    '<text x="20" y="24" class="t1" style="text-anchor:start">المخطط الأحادي الخط مع الحمايات والكوابل</text><text x="20" y="42" class="t3" style="text-anchor:start">أحمر = DC الألواح · بنفسجي = DC البطارية · أزرق = AC · أخضر = التأريض</text>' + g + '</svg>'; }
