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
    TAR22: 'تعرفة الهيئة من 1/4/2022',
    TOU24: 'التعرفة المرتبطة بالزمن — الهيئة، نافذة من 1/7/2024 (بترا)',
    DRAFT26: 'مشروع نظام معدّل أيلول 2026 — غير نافذ لحد ما ينشر بالجريدة الرسمية'
  };

  /* ---------- sizing constants ---------- */
  var SIZING = {
    kWhPerKWMonth: 150, kWhPerKWMonthSrc: SRC.REG58 + ' م8/ز — 1 ك.و = 150 ك.و.س/شهر',
    dcacMax: { '1ph': 1.5, '3ph': 1.2 }, dcacSrc: SRC.REG58 + ' م9/ج ؛ ' + SRC.GUIDE + ' م5/3',
    domCap: { '1ph': 3.6, '3ph': 10 }, domCapSrc: SRC.REG58 + ' — المنزلي: 100% من معدل الاستهلاك وبحد أقصى 3.6 kW للفاز الواحد و10 kW للثلاثة فاز',
    ampPerPhase: 16, vPhase: 230, ampSrc: SRC.GUIDE + ' م5/11 — المنزلي ≤ 16 أمبير/طور',
    // EMRC "small" installations = ≤16 A/phase (G98); bigger = "large" (G99)
    inverterSizes: {
      '1ph': [1, 1.5, 2, 2.2, 2.5, 3, 3.6, 3.68, 4, 4.6, 5, 6],
      '3ph': [3, 4, 5, 6, 8, 10, 11, 12, 15, 17, 20, 25, 30, 33, 36, 40, 50, 60, 75, 100, 110, 125, 150, 175, 196, 215, 250, 300, 320, 330, 350]
    }
  };
  function ampLimitKW(phase) { return phase === '1ph' ? SIZING.domCap['1ph'] : SIZING.domCap['3ph']; } // residential cap: 3.6 kW single-phase, 10 kW three-phase (Regulation 58/2024, net billing in place)
  /* domestic subscription phase: single phase can carry at most 3.6 kW (EMRC cap); at 150 kWh/kW/month that covers
     an average of 552 kWh/month. Above that the system needed exceeds the 1-phase cap -> 3-phase subscription. */
  var PHASE_SWITCH_KWH = ampLimitKW('1ph') * SIZING.kWhPerKWMonth; // 540
  function suggestPhase(monthlyAvg) { return monthlyAvg > PHASE_SWITCH_KWH + 1e-9 ? '3ph' : '1ph'; }

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

  /* ---------- draft amendment Sept 2026 (NOT in force) — optional scenario ----------
     buy-back: domestic 50 → 70 with storage ≥ 50 % of expected production (graduated below that, linear here);
     other 40 → 50 with storage > 50 %. Grid fees per the draft table. With storage, capacity up to 100 % of consumption. */
  var DRAFT26 = { src: SRC.DRAFT26,
    buyback: { domestic: [50, 70], other: [40, 50] },
    gridFee: { dom_sub: 1, dom_nosub: 1, commercial: 9, commercial_s: 5.5, ind_small: 0, ind_med: 0, ind_large: 5.5, agri: 0, agri_mixed: 5,
               hotel: 2, hospital: 8.5, telecom: 8.5, water: 3.5, ports: 10, media: 9, ev_home: 5.5, ev_public: 5.5, street: 5, extractive: 14, bank: 17.5, regular: 10, other: 0 } };
  function buybackFor(sector, regime, storShare) { // storShare = battery kWh / expected daily PV kWh
    var dom = isDomestic(sector);
    if (regime !== 'draft26') return dom ? BUYBACK.domestic : BUYBACK.other;
    var b = DRAFT26.buyback[dom ? 'domestic' : 'other'], x = Math.max(0, Math.min(1, (storShare || 0) / 0.5));
    if (!dom) return storShare > 0.5 ? b[1] : b[0];
    return Math.round(b[0] + (b[1] - b[0]) * x);
  }
  function gridFeeFor(sector, regime, small) {
    if (regime === 'draft26') { if (sector === 'commercial' && small) return DRAFT26.gridFee.commercial_s; var d = DRAFT26.gridFee[sector]; return d != null ? d : 0; }
    var v = GRIDFEE.v[sector]; return v != null ? v : 0;
  }

  /* ---------- grid service fee (REG58 table 4, art.9/أ), JD per kW AC per month ---------- */
  var GRIDFEE = { src: SRC.REG58 + ' جدول 4 (دينار/ك.و شهرياً)',
    v: { dom_sub: 1, dom_nosub: 1, commercial: 13, ind_small: 0, ind_med: 0, ind_large: 8, agri: 0, agri_mixed: 7,
         hotel: 2.5, hospital: 12, telecom: 12, water: 5, ports: 14, media: 13, ev: 8, ev_home: 8, ev_public: 8, street: 7, extractive: 0, other: 0 } };
  /* ---------- time-of-use tariff (TOU24), fils/kWh: peak 17–23, partial 14–17 & 23–05, off-peak 05–14 ----------
     Residential is excluded (EMRC statements Jul–Sep 2026). Banks and hotels are also on ToU per EMRC (2026) but their values
     were not published with the table, so they stay on the flat tariff here. */
  function touBand(h) { return (h >= 17 && h < 23) ? 'peak' : (h >= 5 && h < 14) ? 'off' : 'part'; }
  function touPeriodFils(t) { return { 1: Math.round((9 * t.off + 3 * t.part) / 12), 2: t.peak, 3: t.part }; } // netting periods P1/P2/P3 (ind_med → 61/79/69 = guide annex 8)

  /* ---------- retail tariffs, fils/kWh, monthly blocks (TAR22). bands: [upTo kWh, fils] ---------- */
  var TARIFF = {
    dom_sub:    { ar: 'منزلي مدعوم', domestic: true, bands: [[300, 50], [600, 100], [Infinity, 200]], src: SRC.TAR22 },
    dom_nosub:  { ar: 'منزلي غير مدعوم', domestic: true, bands: [[1000, 120], [Infinity, 150]], src: SRC.TAR22 },
    commercial: { ar: 'تجاري', bands: [[2000, 120], [Infinity, 152]], src: SRC.TAR22 },
    ind_small:  { ar: 'صناعي صغير', bands: [[10000, 60], [Infinity, 68]], src: SRC.TAR22 },
    ind_med:    { ar: 'صناعي متوسط — حسب الزمن 79/69/59', tou: { peak: 79, part: 69, off: 59 }, bands: [[Infinity, 68]], src: SRC.TOU24 + ' ؛ ' + SRC.GUIDE + ' ملحق 8' },
    ind_large:  { ar: 'صناعي كبير — حسب الزمن 130/120/110', tou: { peak: 130, part: 120, off: 110 }, bands: [[Infinity, 120]], src: SRC.TOU24 },
    extractive: { ar: 'صناعي استخراجي — حسب الزمن 226/216/206', tou: { peak: 226, part: 216, off: 206 }, bands: [[Infinity, 216]], src: SRC.TOU24 },
    telecom:    { ar: 'اتصالات — حسب الزمن 152/142/132', tou: { peak: 152, part: 142, off: 132 }, bands: [[Infinity, 142]], src: SRC.TOU24 },
    water:      { ar: 'ضخ مياه — حسب الزمن 106/96/86 (اختياري)', tou: { peak: 106, part: 96, off: 86 }, bands: [[Infinity, 96]], src: SRC.TOU24 },
    ev_home:    { ar: 'شحن مركبات منزلي — حسب الزمن 160/118/108', tou: { peak: 160, part: 118, off: 108 }, bands: [[Infinity, 118]], src: SRC.TOU24 },
    ev_public:  { ar: 'شحن مركبات محطات عامة — 133/113/103', tou: { peak: 133, part: 113, off: 103 }, bands: [[Infinity, 113]], src: SRC.TOU24 },
    agri:       { ar: 'زراعي (مستوية)', bands: [[Infinity, 55]], src: SRC.TAR22 },
    hotel:      { ar: 'فندقي', bands: [[Infinity, 82]], src: SRC.TAR22 },
    hospital:   { ar: 'مستشفيات خاصة', bands: [[Infinity, 140]], src: SRC.TAR22 },
    other:      { ar: 'أخرى (سعر يدوي)', bands: [[Infinity, 120]], src: 'يدوي' }
  };
  Object.keys(TARIFF).forEach(function (k) { if (TARIFF[k].tou) TARIFF[k].periodFils = touPeriodFils(TARIFF[k].tou); });
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
    if (o.regime === 'draft26' && o.storage && (o.mech === 'netOn' || o.mech === 'netOff')) cap = 1.0;
    var kwByConsumption = monthly * cap / SIZING.kWhPerKWMonth;            // = Excel E19 when cap = 100 %
    var kwAmp = dom ? ampLimitKW(o.phase) : Infinity;
    var kwAllowed = Math.min(kwByConsumption, kwAmp);
    var sizes = SIZING.inverterSizes[o.phase].filter(function (s) { return s <= kwAllowed + 1e-9; });
    var invSuggested = sizes.length ? sizes[sizes.length - 1] : null;
    if (kwAllowed > 60 && kwAllowed !== Infinity) invSuggested = Math.floor(kwAllowed); // large plants: several inverters, total rounded down to 1 kW
    var inv = o.inverterKW || invSuggested;
    var dcacMax = SIZING.dcacMax[o.phase], dcac = Math.min(o.dcac || dcacMax, dcacMax);
    var invEff = inv ? Math.min(inv, kwAllowed) : 0; // panels follow the AC the EMRC allows, even if the inverter nameplate is bigger
    var nMod = invEff && o.moduleW ? Math.floor(1000 * invEff * dcac / o.moduleW + 1e-9) : 0;
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
        { k: 'نسبة الآلية من الاستهلاك', v: cap * 100, u: '%', f: m.ar + (o.regime === 'draft26' && o.storage && cap === 1 && m.capPct.other < 1 ? ' + تخزين (مسودة 2026: حتى 100٪)' : ''), s: o.regime === 'draft26' ? SRC.DRAFT26 : m.src },
        { k: 'القدرة حسب الاستهلاك', v: kwByConsumption, u: 'ك.و AC', f: monthly.toFixed(0) + ' × ' + cap + ' / ' + SIZING.kWhPerKWMonth, s: SIZING.kWhPerKWMonthSrc },
        { k: 'حد 16 أمبير/طور (' + (o.phase === '1ph' ? 'سنغل فيز' : '3 فاز') + ')', v: kwAmp, u: 'ك.و', f: dom ? (o.phase === '1ph' ? '1' : '3') + ' × 230 × 16 / 1000' + (o.phase === '1ph' && monthly > PHASE_SWITCH_KWH ? ' — معدلك ' + monthly.toFixed(0) + ' > ' + PHASE_SWITCH_KWH.toFixed(0) + ' ك.و.س/شهر: السنغل فيز ما بيغطي استهلاكك، لازم 3 فاز' : '') : 'لا ينطبق (غير منزلي)', s: SIZING.ampSrc },
        { k: 'قدرة الانفيرتر التصميمية', v: inv, u: 'ك.و AC', f: o.inverterKW ? 'إدخال يدوي' : 'أكبر قياس قياسي ≤ ' + kwAllowed.toFixed(2) },
        { k: 'DC/AC', v: dcac, u: '', f: 'الحد ' + dcacMax + ' (' + o.phase + ')', s: SIZING.dcacSrc },
        { k: 'عدد الألواح', v: nMod, u: 'لوح', f: o.moduleW ? 'ROUNDDOWN(1000 × ' + (+invEff.toFixed(2)) + ' × ' + dcac + ' / ' + o.moduleW + ')' + (inv > kwAllowed + 1e-9 ? ' — على المسموح ' + kwAllowed.toFixed(2) + ' مش على الانفيرتر ' + inv : '') : 'اختار اللوح أول' },
        { k: 'قدرة الألواح الفعلية', v: kWp, u: 'kWp', f: o.moduleW ? nMod + ' × ' + o.moduleW + ' / 1000' : '—' },
        { k: 'DC/AC الفعلي', v: inv ? kWp / inv : 0, u: '', f: inv ? kWp.toFixed(2) + ' / ' + inv : '—' }
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
    var M = []; for (var m = 0; m < 12; m++) M.push({ load: 0, base: 0, baseJD: 0, pv: 0, selfUse: 0, imp: [0, 0, 0, 0], exp: [0, 0, 0, 0] });
    o.rows.forEach(function (r, i) {
      var mm = M[r.month - 1], L = o.loadKWh[i], P = o.pvKWh[i], p = periodOf(Math.floor(r.hour) % 24);
      var bL = o.baseLoadKWh ? o.baseLoadKWh[i] : L;
      mm.load += L; mm.base += bL; mm.pv += P; mm.selfUse += Math.min(L, P);
      if (T.tou && o.tou !== false) mm.baseJD += bL * T.tou[touBand(Math.floor(r.hour) % 24)] / 1000;
      if (o.mech === 'sellAll' && T.tou && o.tou !== false) { mm.imp[p] += L; mm.exp[p] += P; mm.impJD = (mm.impJD || 0) + L * T.tou[touBand(Math.floor(r.hour) % 24)] / 1000; return; }
      if (o.mech === 'sellAll') { mm.imp[p] += L; mm.exp[p] += P; return; }
      if (o.mech === 'zero') { mm.imp[p] += Math.max(0, L - P); return; } // surplus curtailed
      var n = L - P; if (n > 0) mm.imp[p] += n; else mm.exp[p] += -n;
    });
    var carry = 0, rows = [];
    M.forEach(function (mm, m) {
      var before = (T.tou && o.tou !== false) ? mm.baseJD : energyCharge(mm.base, o.sector, o.bands);
      var netImp = 0, creditKWh = 0, periodJD = 0;
      for (var p = 1; p <= 3; p++) {
        if (o.mech === 'sellAll') { if (mm.impJD == null) netImp += mm.imp[p]; creditKWh += mm.exp[p]; continue; }
        var d = mm.imp[p] - mm.exp[p];
        if (d >= 0) { if (T.periodFils && o.tou !== false) periodJD += d * T.periodFils[p] / 1000; else netImp += d; }
        else creditKWh += -d;
      }
      var charge = energyCharge(netImp, o.sector, o.bands) + periodJD + (o.mech === 'sellAll' && mm.impJD != null ? mm.impJD : 0);
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

  var api = { VERSION: '0.2', SRC: SRC, SIZING: SIZING, MECH: MECH, PERIODS: PERIODS, BUYBACK: BUYBACK, GRIDFEE: GRIDFEE, DRAFT26: DRAFT26,
              PHASE_SWITCH_KWH: PHASE_SWITCH_KWH, suggestPhase: suggestPhase, buybackFor: buybackFor, gridFeeFor: gridFeeFor, touBand: touBand,
              TARIFF: TARIFF, SHAPES: SHAPES, ampLimitKW: ampLimitKW, isDomestic: isDomestic, energyCharge: energyCharge,
              periodOf: periodOf, sizeFromBills: sizeFromBills, shapeFor: shapeFor, loadProfile: loadProfile, netValueYear: netValueYear };
  root.JORules = api;
})(__root);
export default __root.JORules;
