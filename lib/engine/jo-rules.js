/* eslint-disable */
const __root = {};
/* Jordan rules v0.1 — sizing limits, retail tariffs and net-value billing.
   Sources (each value carries its own src so the report can print it):
   - REG58  = نظام رقم 58 لسنة 2024 (الجريدة الرسمية عدد 5948، 2/9/2024) — tables 2/3/4, art. 3–9
   - GUIDE  = الدليل الإرشادي لتنظيم ربط منشآت مصادر الطاقة المتجددة على نظام التوزيع (EMRC), art. 5, 10, annex 8
   - TAR22  = EMRC retail tariff restructuring effective 1/4/2022 (Al-Mamlaka / Attaqa reports)
   Values are editable in the UI: tariffs change and a draft amendment (Sept 2026, not in force) is pending. */
(function (root) {
  'use strict';

  var SRC = {
    REG58: 'نظام 58/2024 (ج.ر 5948)',
    GUIDE: 'دليل الهيئة لربط منشآت الطاقة المتجددة',
    TAR22: 'تعرفة الهيئة من 1/4/2022'
  };

  /* ---------- sizing constants ---------- */
  var SIZING = {
    kWhPerKWMonth: 150, kWhPerKWMonthSrc: SRC.REG58 + ' م8/ز — 1 ك.و = 150 ك.و.س/شهر',
    dcacMax: { '1ph': 1.5, '3ph': 1.2 }, dcacSrc: SRC.REG58 + ' م9/ج ؛ ' + SRC.GUIDE + ' م5/3',
    ampPerPhase: 16, vPhase: 230, ampSrc: SRC.GUIDE + ' م5/11 — المنزلي ≤ 16 أمبير/طور',
    // EMRC "small" installations = ≤16 A/phase (G98); bigger = "large" (G99)
    inverterSizes: {
      '1ph': [1, 1.5, 2, 2.2, 2.5, 3, 3.6, 3.68, 4, 4.6, 5, 6],
      '3ph': [3, 4, 5, 6, 8, 10, 11, 12, 15, 17, 20, 25, 30, 33, 36, 40, 50, 60, 75, 100, 110, 125, 150, 175, 196, 215, 250, 300, 320, 330, 350]
    }
  };
  function ampLimitKW(phase) { return (phase === '1ph' ? 1 : 3) * SIZING.vPhase * SIZING.ampPerPhase / 1000; } // 3.68 / 11.04

  /* ---------- connection mechanisms (REG58 table 1 / GUIDE art.5/20) ---------- */
  var MECH = {
    netOn:   { ar: 'صافي القيمة — نفس الموقع', capPct: { domestic: 1.0, other: 0.5 },
               sectors: ['dom_sub', 'dom_nosub', 'ind_small', 'ind_med', 'agri', 'hotel'], gridFee: true,
               src: SRC.REG58 + ' م4–5 ؛ ' + SRC.GUIDE + ' جدول 1' },
    netOff:  { ar: 'صافي القيمة — خارج الموقع (≥30 ك.و)', capPct: { domestic: 0, other: 0.5 },
               sectors: ['ind_small', 'ind_med', 'agri', 'hotel'], gridFee: true, minKW: 30, src: SRC.REG58 + ' م3' },
    zero:    { ar: 'التصدير الصفري', capPct: { domestic: 1.0, other: 1.0 }, sectors: 'all_but_extr_bank_regular', gridFee: true,
               src: SRC.REG58 + ' م6' },
    sellAll: { ar: 'تصدير الكل واستجرار الكل', capPct: { domestic: 1.0, other: 1.0 }, sectors: 'all', gridFee: false,
               src: SRC.REG58 + ' م7 ؛ ' + SRC.GUIDE + ' م5/4' }
  };

  /* ---------- netting periods (REG58 table 2) ---------- */
  var PERIODS = { src: SRC.REG58 + ' جدول 2', def: [{ n: 1, from: 5, to: 17 }, { n: 2, from: 17, to: 23 }, { n: 3, from: 23, to: 5 }] };
  function periodOf(h) { return h >= 5 && h < 17 ? 1 : (h >= 17 && h < 23 ? 2 : 3); }

  /* ---------- buy-back of surplus (REG58 table 3), fils/kWh ---------- */
  var BUYBACK = { domestic: 50, other: 40, src: SRC.REG58 + ' جدول 3' };

  /* ---------- grid service fee (REG58 table 4, art.9/أ), JD per kW AC per month ---------- */
  var GRIDFEE = { src: SRC.REG58 + ' جدول 4 (دينار/ك.و شهرياً)',
    v: { dom_sub: 1, dom_nosub: 1, commercial: 13, ind_small: 0, ind_med: 0, ind_large: 8, agri: 0, agri_mixed: 7,
         hotel: 2.5, hospital: 12, telecom: 12, water: 5, ports: 14, media: 13, ev: 8, street: 7, other: 0 } };

  /* ---------- retail tariffs, fils/kWh, monthly blocks (TAR22). bands: [upTo kWh, fils] ---------- */
  var TARIFF = {
    dom_sub:    { ar: 'منزلي مدعوم', domestic: true, bands: [[300, 50], [600, 100], [Infinity, 200]], src: SRC.TAR22 },
    dom_nosub:  { ar: 'منزلي غير مدعوم', domestic: true, bands: [[1000, 120], [Infinity, 150]], src: SRC.TAR22 },
    commercial: { ar: 'تجاري', bands: [[2000, 120], [Infinity, 152]], src: SRC.TAR22 },
    ind_small:  { ar: 'صناعي صغير', bands: [[10000, 60], [Infinity, 68]], src: SRC.TAR22 },
    ind_med:    { ar: 'صناعي متوسط (صافي القيمة: 61/79/69 حسب الفترة)', periodFils: { 1: 61, 2: 79, 3: 69 }, bands: [[Infinity, 68]], src: SRC.GUIDE + ' ملحق 8' },
    agri:       { ar: 'زراعي (مستوية)', bands: [[Infinity, 55]], src: SRC.TAR22 },
    hotel:      { ar: 'فندقي', bands: [[Infinity, 82]], src: SRC.TAR22 },
    hospital:   { ar: 'مستشفيات خاصة', bands: [[Infinity, 140]], src: SRC.TAR22 },
    other:      { ar: 'أخرى (سعر يدوي)', bands: [[Infinity, 120]], src: 'يدوي' }
  };
  function isDomestic(sector) { return !!(TARIFF[sector] && TARIFF[sector].domestic); }

  // monthly energy charge (JD) for net imported kWh, with block bands
  function energyCharge(kWh, sector, bandsOverride) {
    var b = bandsOverride || TARIFF[sector].bands, prev = 0, jd = 0;
    for (var i = 0; i < b.length && kWh > prev; i++) { var q = Math.min(kWh, b[i][0]) - prev; jd += q * b[i][1] / 1000; prev = b[i][0]; }
    return jd;
  }

  /* ---------- sizing from 12 bills (reproduces the user's Excel + adds the legal limits) ---------- */
  function sizeFromBills(o) {
    // o: { bills:[12 kWh], sector, phase, mech, moduleW, dcac (optional), inverterKW (optional override) }
    var annual = o.bills.reduce(function (a, b) { return a + (+b || 0); }, 0), monthly = annual / 12;
    var dom = isDomestic(o.sector), m = MECH[o.mech || 'netOn'];
    var cap = m.capPct[dom ? 'domestic' : 'other'];
    var kwByConsumption = monthly * cap / SIZING.kWhPerKWMonth;            // = Excel E19 when cap = 100 %
    var kwAmp = dom ? ampLimitKW(o.phase) : Infinity;
    var kwAllowed = Math.min(kwByConsumption, kwAmp);
    var sizes = SIZING.inverterSizes[o.phase].filter(function (s) { return s <= kwAllowed + 1e-9; });
    var invSuggested = sizes.length ? sizes[sizes.length - 1] : null;
    if (kwAllowed > 60 && kwAllowed !== Infinity) invSuggested = Math.floor(kwAllowed); // large plants: several inverters, total rounded down to 1 kW
    var inv = o.inverterKW || invSuggested;
    var dcacMax = SIZING.dcacMax[o.phase], dcac = Math.min(o.dcac || dcacMax, dcacMax);
    var nMod = inv ? Math.floor(1000 * inv * dcac / o.moduleW + 1e-9) : 0;
    var kWp = nMod * o.moduleW / 1000;
    var warn = [];
    if (o.inverterKW && o.inverterKW > kwAllowed + 1e-9) warn.push('قدرة الانفيرتر ' + o.inverterKW + ' ك.و أعلى من المسموح ' + kwAllowed.toFixed(2) + ' ك.و');
    if (o.dcac && o.dcac > dcacMax) warn.push('DC/AC المطلوب ' + o.dcac + ' أعلى من الحد ' + dcacMax + ' — تم تحديده عند الحد');
    if (m.sectors !== 'all' && Array.isArray(m.sectors) && m.sectors.indexOf(o.sector) < 0) warn.push('القطاع غير مشمول بآلية "' + m.ar + '" حسب الجدول 1');
    if (m.minKW && inv < m.minKW) warn.push('الحد الأدنى لهذه الآلية ' + m.minKW + ' ك.و');
    return {
      annual: annual, monthly: monthly, capPct: cap, kwByConsumption: kwByConsumption, kwAmp: kwAmp, kwAllowed: kwAllowed,
      inverterSuggested: invSuggested, inverterKW: inv, dcacMax: dcacMax, dcac: dcac, nModules: nMod, kWp: kWp,
      dcacActual: inv ? kWp / inv : 0, warnings: warn,
      steps: [
        { k: 'مجموع الاستهلاك السنوي', v: annual, u: 'ك.و.س', f: 'Σ 12 فاتورة', s: SRC.GUIDE + ' م5/5' },
        { k: 'معدل الاستهلاك الشهري', v: monthly, u: 'ك.و.س', f: annual.toFixed(0) + ' / 12' },
        { k: 'نسبة الآلية من الاستهلاك', v: cap * 100, u: '%', f: m.ar, s: m.src },
        { k: 'القدرة حسب الاستهلاك', v: kwByConsumption, u: 'ك.و AC', f: monthly.toFixed(0) + ' × ' + cap + ' / ' + SIZING.kWhPerKWMonth, s: SIZING.kWhPerKWMonthSrc },
        { k: 'حد 16 أمبير/طور', v: kwAmp, u: 'ك.و', f: dom ? (o.phase === '1ph' ? '1' : '3') + ' × 230 × 16 / 1000' : 'لا ينطبق (غير منزلي)', s: SIZING.ampSrc },
        { k: 'قدرة الانفيرتر التصميمية', v: inv, u: 'ك.و AC', f: o.inverterKW ? 'إدخال يدوي' : 'أكبر قياس قياسي ≤ ' + kwAllowed.toFixed(2) },
        { k: 'DC/AC', v: dcac, u: '', f: 'الحد ' + dcacMax + ' (' + o.phase + ')', s: SIZING.dcacSrc },
        { k: 'عدد الألواح', v: nMod, u: 'لوح', f: 'ROUNDDOWN(1000 × ' + inv + ' × ' + dcac + ' / ' + o.moduleW + ')' },
        { k: 'قدرة الألواح الفعلية', v: kWp, u: 'kWp', f: nMod + ' × ' + o.moduleW + ' / 1000' },
        { k: 'DC/AC الفعلي', v: inv ? kWp / inv : 0, u: '', f: kWp.toFixed(2) + ' / ' + inv }
      ]
    };
  }

  /* ---------- hourly load profile from monthly kWh ---------- */
  var SHAPES = { // 24 relative weights, local time (index 0 = 00:00–01:00)
    domestic:   [3,2.5,2.2,2,2,2.2,3,4,4.2,4,3.8,3.8,4,4,3.8,3.8,4.2,5.2,6.5,7.2,7.2,6.5,5.2,4],
    commercial: [1.5,1.4,1.4,1.4,1.4,1.6,2.5,4,6,7,7.2,7.3,7.3,7.3,7.2,7,6.5,5.5,4.5,3.5,2.8,2.2,1.8,1.6],
    industrial: [3,3,3,3,3,3.2,4,5.5,6.5,6.8,6.8,6.8,6.5,6.8,6.8,6.8,6.5,5.5,4.5,3.8,3.5,3.2,3,3],
    flat:       [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    src: 'أشكال حمل نموذجية (افتراض — يُستبدل ببيانات عداد ساعية عند توفرها)'
  };
  function shapeFor(sector) {
    if (isDomestic(sector)) return 'domestic';
    if (sector === 'commercial' || sector === 'hospital') return 'commercial';
    if (sector === 'ind_small' || sector === 'ind_med') return 'industrial';
    return 'flat';
  }
  // rows: weather rows (month, hour local) from PVGIS — used only for the calendar; returns kW per row (kWh per hour)
  function loadProfile(rows, monthlyKWh, shapeName) {
    var sh = SHAPES[shapeName], sum = new Array(12).fill(0), out = new Array(rows.length);
    rows.forEach(function (r) { sum[r.month - 1] += sh[((Math.floor(r.hour) % 24) + 24) % 24]; });
    rows.forEach(function (r, i) { var m = r.month - 1; out[i] = monthlyKWh[m] * sh[((Math.floor(r.hour) % 24) + 24) % 24] / sum[m]; });
    return out;
  }

  /* ---------- net-value billing (GUIDE art.10, same site) ----------
     Bidirectional meter at the connection point: per hour, net = load − PV.
     Per month and per period: imp = Σ max(net,0), exp = Σ max(−net,0).
     If exp > imp in a period → surplus (exp−imp) credited at buy-back price (JD); else (imp−exp) kWh billed at the user tariff.
     JD credit carries forward month to month; balance resets 31 Dec except December's own surplus (art.10/6).
     Grid service fee = fee × kW_AC each month (art.5/4). Meter rent / rural fils not modelled (unchanged before/after). */
  function netValueYear(o) {
    // o: { rows, pvKWh:[per row AC], loadKWh:[per row], sector, bands (opt), buyback fils (opt), gridFee JD/kW (opt), kWac, mech }
    var dom = isDomestic(o.sector), bb = (o.buyback != null ? o.buyback : (dom ? BUYBACK.domestic : BUYBACK.other)) / 1000;
    var fee = o.mech === 'sellAll' ? 0 : (o.gridFee != null ? o.gridFee : (GRIDFEE.v[o.sector] || 0));
    var T = TARIFF[o.sector];
    var M = []; for (var m = 0; m < 12; m++) M.push({ load: 0, base: 0, pv: 0, selfUse: 0, imp: [0, 0, 0, 0], exp: [0, 0, 0, 0] });
    o.rows.forEach(function (r, i) {
      var mm = M[r.month - 1], L = o.loadKWh[i], P = o.pvKWh[i], p = periodOf(Math.floor(r.hour) % 24);
      mm.load += L; mm.base += o.baseLoadKWh ? o.baseLoadKWh[i] : L; mm.pv += P; mm.selfUse += Math.min(L, P);
      if (o.mech === 'sellAll') { mm.imp[p] += L; mm.exp[p] += P; return; }
      if (o.mech === 'zero') { mm.imp[p] += Math.max(0, L - P); return; } // surplus curtailed
      var n = L - P; if (n > 0) mm.imp[p] += n; else mm.exp[p] += -n;
    });
    var carry = 0, rows = [];
    M.forEach(function (mm, m) {
      var before = energyCharge(mm.base, o.sector, o.bands);
      var netImp = 0, creditKWh = 0, periodJD = 0;
      for (var p = 1; p <= 3; p++) {
        if (o.mech === 'sellAll') { netImp += mm.imp[p]; creditKWh += mm.exp[p]; continue; }
        var d = mm.imp[p] - mm.exp[p];
        if (d >= 0) { if (T.periodFils) periodJD += d * T.periodFils[p] / 1000; else netImp += d; }
        else creditKWh += -d;
      }
      var charge = energyCharge(netImp, o.sector, o.bands) + periodJD;
      var credit = creditKWh * bb, gf = fee * (o.kWac || 0);
      var bal = charge - credit - carry + gf, pay, newCarry;
      // surplus value pays energy only (art.5/23): fee is never offset by credit
      var energyNet = charge - credit - carry;
      if (energyNet < 0) { pay = gf; newCarry = -energyNet; } else { pay = energyNet + gf; newCarry = 0; }
      if (m === 11) { /* Dec: only December's own surplus carries to Jan */ newCarry = Math.min(newCarry, Math.max(0, credit - charge)); }
      rows.push({ month: m + 1, load: mm.load, pv: mm.pv, selfUse: mm.selfUse, imp: mm.imp.slice(1), exp: mm.exp.slice(1),
                  netImp: netImp, creditKWh: creditKWh, before: before, charge: charge, credit: credit, carryIn: carry,
                  gridFee: gf, pay: pay, carryOut: newCarry, saving: before - pay });
      carry = newCarry;
    });
    var y = rows.reduce(function (a, r) { ['load', 'pv', 'selfUse', 'before', 'pay', 'saving', 'gridFee', 'credit'].forEach(function (k) { a[k] += r[k]; }); return a; },
      { load: 0, pv: 0, selfUse: 0, before: 0, pay: 0, saving: 0, gridFee: 0, credit: 0 });
    y.unusedCredit = carry;
    return { months: rows, year: y, buyback: bb * 1000, fee: fee };
  }

  var api = { VERSION: '0.1', SRC: SRC, SIZING: SIZING, MECH: MECH, PERIODS: PERIODS, BUYBACK: BUYBACK, GRIDFEE: GRIDFEE,
              TARIFF: TARIFF, SHAPES: SHAPES, ampLimitKW: ampLimitKW, isDomestic: isDomestic, energyCharge: energyCharge,
              periodOf: periodOf, sizeFromBills: sizeFromBills, shapeFor: shapeFor, loadProfile: loadProfile, netValueYear: netValueYear };
  root.JORules = api;
})(__root);
export default __root.JORules;
