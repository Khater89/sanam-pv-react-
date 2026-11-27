/* eslint-disable */
const __root = {};
/* PV System v0.1 (Sanam PV Design Tool) — equipment presets + PVsyst-style string sizing checks.
   Presets are TYPICAL values: always overwrite with the manufacturer datasheet before a real design. */
(function (root) {
  'use strict';

  /* PVsyst Project settings — design temperatures (handoff: −10 / 70 assumed, user screenshot pending) */
  var DESIGN_T = { tMin: -10, tWinterOp: 20, tSummerOp: 70, vSysMax: 1500,
    src: 'PVsyst Project settings (مفترض −10 / 20 / 70 °C — عدّلها حسب إعدادات مشروعك)' };

  var MODULES = {
    gen615: { name: 'Generic 615 W N-type 132c (typical)', Pmax: 615, Vmp: 46.0, Imp: 13.37, Voc: 55.6, Isc: 14.05,
              betaVoc: -0.25, alphaIsc: 0.046, gammaP: -0.29, L: 2.382, W: 1.134 },
    gen670: { name: 'Generic 670 W 210-mm 132c (typical, Madama VCZ class)', Pmax: 670, Vmp: 38.4, Imp: 17.45, Voc: 46.1, Isc: 18.62,
              betaVoc: -0.25, alphaIsc: 0.045, gammaP: -0.29, L: 2.384, W: 1.303 },
    gen590: { name: 'Generic 590 W N-type 144c (typical)', Pmax: 590, Vmp: 43.1, Imp: 13.69, Voc: 52.2, Isc: 14.45,
              betaVoc: -0.25, alphaIsc: 0.046, gammaP: -0.30, L: 2.278, W: 1.134 }
  };
  var INVERTERS = {
    g1ph37: { name: 'Generic 3.6 kW 1-ph (typical)', kind: 'grid', phase: '1ph', Pac: 3.6, Vmax: 600, VmppMin: 90, VmppMax: 560, nMPPT: 2, ImaxMPPT: 16, IscMPPT: 20, maxEff: 0.976, euroEff: 0.97 },
    g1ph2:  { name: 'Generic 2 kW 1-ph (typical)', kind: 'grid', phase: '1ph', Pac: 2, Vmax: 600, VmppMin: 90, VmppMax: 560, nMPPT: 1, ImaxMPPT: 16, IscMPPT: 20, maxEff: 0.975, euroEff: 0.968 },
    g1ph3:  { name: 'Generic 3 kW 1-ph (typical)', kind: 'grid', phase: '1ph', Pac: 3, Vmax: 600, VmppMin: 90, VmppMax: 560, nMPPT: 2, ImaxMPPT: 16, IscMPPT: 20, maxEff: 0.976, euroEff: 0.97 },
    g3ph4:  { name: 'Generic 4 kW 3-ph (typical)', kind: 'grid', phase: '3ph', Pac: 4, Vmax: 1100, VmppMin: 160, VmppMax: 950, nMPPT: 2, ImaxMPPT: 16, IscMPPT: 20, maxEff: 0.982, euroEff: 0.975 },
    g3ph5:  { name: 'Generic 5 kW 3-ph (typical)', kind: 'grid', phase: '3ph', Pac: 5, Vmax: 1100, VmppMin: 160, VmppMax: 950, nMPPT: 2, ImaxMPPT: 16, IscMPPT: 20, maxEff: 0.982, euroEff: 0.975 },
    g3ph6:  { name: 'Generic 6 kW 3-ph (typical)', kind: 'grid', phase: '3ph', Pac: 6, Vmax: 1100, VmppMin: 160, VmppMax: 950, nMPPT: 2, ImaxMPPT: 16, IscMPPT: 20, maxEff: 0.983, euroEff: 0.977 },
    g3ph8:  { name: 'Generic 8 kW 3-ph (typical)', kind: 'grid', phase: '3ph', Pac: 8, Vmax: 1100, VmppMin: 160, VmppMax: 950, nMPPT: 2, ImaxMPPT: 16, IscMPPT: 20, maxEff: 0.984, euroEff: 0.978 },
    g3ph10: { name: 'Generic 10 kW 3-ph (typical)', kind: 'grid', phase: '3ph', Pac: 10, Vmax: 1100, VmppMin: 160, VmppMax: 950, nMPPT: 2, ImaxMPPT: 16, IscMPPT: 20, maxEff: 0.984, euroEff: 0.98 },
    g3ph50: { name: 'Generic 50 kW 3-ph (typical)', phase: '3ph', Pac: 50, Vmax: 1100, VmppMin: 200, VmppMax: 1000, nMPPT: 4, ImaxMPPT: 32, IscMPPT: 40, maxEff: 0.987, euroEff: 0.983 },
    deye12h: { name: 'Deye SUN-12K-SG04LP3 hybrid/off-grid 48 V (datasheet)', kind: 'offgrid', phase: '3ph', Pac: 12, Vmax: 800, VmppMin: 200, VmppMax: 650, nMPPT: 2, ImaxMPPT: 13, IscMPPT: 17, maxEff: 0.976, euroEff: 0.97, bVmin: 40, bVmax: 60, bImax: 240 },
    deye5h1: { name: 'Deye SUN-5K-SG03LP1 hybrid/off-grid 48 V (datasheet)', kind: 'offgrid', phase: '1ph', Pac: 5, Vmax: 500, VmppMin: 150, VmppMax: 425, nMPPT: 2, ImaxMPPT: 13, IscMPPT: 17, maxEff: 0.976, euroEff: 0.965, bVmin: 40, bVmax: 60, bImax: 120 },
    g3ph100: { name: 'Generic 100 kW 3-ph (typical)', phase: '3ph', Pac: 100, Vmax: 1100, VmppMin: 200, VmppMax: 1000, nMPPT: 10, ImaxMPPT: 30, IscMPPT: 40, maxEff: 0.988, euroEff: 0.984 }
  };

  var BATTERIES = {
    us5000: { name: 'Pylontech US5000 4.8 kWh 48 V', V: 48, kWh: 4.8, usable: 4.56, Ah: 100, Ich: 100, Idis: 100, dod: 95, rte: 95, hv: false },
    seg51:  { name: 'Deye SE-G5.1 Pro-B 5.12 kWh 51.2 V', V: 51.2, kWh: 5.12, usable: 4.6, Ah: 100, Ich: 100, Idis: 100, dod: 90, rte: 95, hv: false },
    luna5:  { name: 'Huawei LUNA2000-5 (5 kWh HV module)', V: 450, kWh: 5, usable: 5, Ah: null, Ich: null, Idis: null, dod: 100, rte: 95, hv: true, pKW: 2.5 }
  };

  function vocAt(m, t) { return m.Voc * (1 + m.betaVoc / 100 * (t - 25)); }
  // Vmpp temperature coefficient ≈ γPmax − αIsc (Imp nearly flat) — standard approximation; PVsyst uses its one-diode model.
  function vmpAt(m, t) { return m.Vmp * (1 + (m.gammaP - m.alphaIsc) / 100 * (t - 25)); }
  function iscAt(m, t) { return m.Isc * (1 + m.alphaIsc / 100 * (t - 25)); }

  /* Ns window allowed by the inverter + design temperatures */
  function nsWindow(m, inv, T) {
    T = T || DESIGN_T;
    var vMax = Math.min(inv.Vmax, T.vSysMax);
    var nsVoc = Math.floor(vMax / vocAt(m, T.tMin));
    var nsMppMax = Math.floor(inv.VmppMax / vmpAt(m, T.tWinterOp));
    var nsMin = Math.ceil(inv.VmppMin / vmpAt(m, T.tSummerOp));
    return { nsMin: nsMin, nsMax: Math.min(nsVoc, nsMppMax), nsVoc: nsVoc, nsMppMax: nsMppMax,
             // PVsyst: Isc vs inverter max short-circuit current is the hard limit; Impp above Imax only clips current (warning)
             npMaxMPPT: Math.max(0, Math.floor(inv.IscMPPT / iscAt(m, 70) + 1e-9)),
             npNoClip: Math.max(0, Math.floor(inv.ImaxMPPT / m.Imp + 1e-9)) };
  }

  /* auto layout: nInv identical inverters, target module count; choose Ns (prefer high), strings/inverter spread over MPPTs */
  function autoLayout(m, inv, nInv, targetModules, T) {
    var w = nsWindow(m, inv, T), best = null;
    if (w.nsMin > w.nsMax || w.npMaxMPPT < 1) return { ok: false, win: w, msg: 'لا يوجد طول string يحقق شروط الجهد/التيار لهذا الانفيرتر' };
    var perInv = targetModules / nInv, maxStr = w.npMaxMPPT * inv.nMPPT;
    for (var ns = w.nsMax; ns >= w.nsMin; ns--) {
      var nstr = Math.min(maxStr, Math.floor(perInv / ns + 1e-9));
      if (nstr < 1) continue;
      var n = ns * nstr * nInv;
      if (!best || n > best.n || (n === best.n && ns > best.ns)) best = { ns: ns, nstr: nstr, n: n };
    }
    if (!best) { best = { ns: w.nsMin, nstr: 1, n: w.nsMin * nInv }; }
    return { ok: true, win: w, ns: best.ns, nstrPerInv: best.nstr, nModules: best.n };
  }

  /* full check list, PVsyst "System" page warnings */
  function check(m, inv, nInv, ns, nstrPerInv, T) {
    T = T || DESIGN_T;
    var w = nsWindow(m, inv, T), perMPPT = Math.ceil(nstrPerInv / inv.nMPPT);
    var kWp = m.Pmax * ns * nstrPerInv * nInv / 1000, kWac = inv.Pac * nInv;
    var V = { vocMin: vocAt(m, T.tMin) * ns, vmpHot: vmpAt(m, T.tSummerOp) * ns, vmpCold: vmpAt(m, T.tWinterOp) * ns,
              vmpStc: m.Vmp * ns, iMppt: m.Imp * perMPPT, iscMppt: iscAt(m, 70) * perMPPT };
    function row(k, val, lim, ok, f) { return { k: k, v: val, lim: lim, ok: ok, f: f }; }
    var rows = [
      row('Voc @ ' + T.tMin + '°C (أقصى جهد مطلق)', V.vocMin, '≤ ' + Math.min(inv.Vmax, T.vSysMax) + ' V', V.vocMin <= Math.min(inv.Vmax, T.vSysMax),
          ns + ' × ' + m.Voc + ' × (1 ' + m.betaVoc + '%×(' + T.tMin + '−25))'),
      row('Vmpp @ ' + T.tSummerOp + '°C (أدنى جهد تشغيل)', V.vmpHot, '≥ ' + inv.VmppMin + ' V', V.vmpHot >= inv.VmppMin,
          ns + ' × ' + m.Vmp + ' × (1 + (' + m.gammaP + '−' + m.alphaIsc + ')%×(' + T.tSummerOp + '−25))'),
      row('Vmpp @ ' + T.tWinterOp + '°C (أعلى جهد تشغيل)', V.vmpCold, '≤ ' + inv.VmppMax + ' V', V.vmpCold <= inv.VmppMax,
          ns + ' × Vmp(' + T.tWinterOp + '°C)'),
      Object.assign(row('Impp لكل MPPT', V.iMppt, '≤ ' + inv.ImaxMPPT + ' A', true, perMPPT + ' string × ' + m.Imp),
        V.iMppt > inv.ImaxMPPT ? { warn: 'الانفيرتر بيحد التيار عند ' + inv.ImaxMPPT + ' A (خسارة تقليم صغيرة)، مش ممنوع حسب PVsyst' } : {}),
      row('Isc @70°C لكل MPPT', V.iscMppt, '≤ ' + inv.IscMPPT + ' A', V.iscMppt <= inv.IscMPPT, perMPPT + ' × Isc(70°C)'),
      row('Pnom ratio (DC/AC)', kWp / kWac, T.dcMax ? '≤ ' + T.dcMax + ' (حد التصميم)' : 'مرجع PVsyst 1.0–1.3', kWp / kWac <= (T.dcMax ? T.dcMax + 0.005 : 1.35), kWp.toFixed(2) + ' / ' + kWac)
    ];
    return { rows: rows, ok: rows.every(function (r) { return r.ok; }), kWp: kWp, kWac: kWac, perMPPT: perMPPT, win: w, V: V,
             area: m.L * m.W * ns * nstrPerInv * nInv, nModules: ns * nstrPerInv * nInv };
  }

  var api = { VERSION: '0.3', DESIGN_T: DESIGN_T, MODULES: MODULES, INVERTERS: INVERTERS, BATTERIES: BATTERIES, vocAt: vocAt, vmpAt: vmpAt, iscAt: iscAt,
              nsWindow: nsWindow, autoLayout: autoLayout, check: check };
  root.PVSystem = api;
})(__root);
export default __root.PVSystem;
