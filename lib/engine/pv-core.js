/* eslint-disable */
const __root = {};
/* PV Core v0.4 (Sanam PV Design Tool) — hourly PV model using PVsyst's published models and default losses.
   Works in the browser (window.PVCore) and in Node (module.exports).
   Every constant below carries its source so the report can print it next to the number. */
(function (root) {
  'use strict';
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;

  /* ---------- PVsyst defaults (copied from the user's PVsyst 8.1.6 reports, Madama Yajoz 2) ---------- */
  var PVSYST = {
    site: { name: 'Russeifa', lat: 32.0175, lon: 36.0435, alt: 631, tz: 3, albedo: 0.20,
            src: 'PVsyst report VCZ – Geographical site / Project settings' },
    meteo: { name: 'Meteonorm 9.0 (Synthetic)',
             globHorMonthly: [94.6, 109.3, 160.7, 193.0, 232.8, 248.1, 250.3, 232.4, 191.3, 149.4, 102.5, 87.7],
             src: 'PVsyst report VCZ – Balances and main results, GlobHor kWh/m²' },
    transposition: 'Perez', diffuse: 'Perez, Meteonorm', circumsolar: 'separate',
    losses: {
      soiling: 0.030,          // Array Soiling Losses 3.0 %
      Uc: 29.0, Uv: 0.0,       // Thermal loss factor W/m²K (free-standing default)
      absorptance: 0.9,        // PVsyst default alpha
      LID: 0.010,              // Light Induced Degradation 1.0 %
      quality: -0.0075,        // Module quality loss −0.75 % (a gain)
      mismatch: 0.020,         // Module mismatch 2.0 % at MPP
      ohmicSTC: 0.0055,        // DC wiring 0.55 % at STC
      iam: { // Fresnel, AR coating, n(glass)=1.526, n(AR)=1.290
        ang: [0, 30, 50, 60, 70, 75, 80, 85, 90],
        val: [1.000, 0.999, 0.987, 0.963, 0.892, 0.814, 0.679, 0.438, 0.000] },
      src: 'PVsyst report VCZ – Array losses'
    },
    converter: { maxEff: 0.980, euroEff: 0.965, src: 'PVsyst report VCZ – Converter, Maxi and EURO efficiencies' },
    battery: { socMin: 0.10, chargeStop: 0.96, chargeResume: 0.80, src: 'PVsyst report VCZ – Battery management control' }
  };

  /* ---------- sun position (NOAA / Spencer) ---------- */
  function sunPos(lat, lon, tz, doy, hour) { // hour = local standard time (decimal), mid-interval
    var g = 2 * Math.PI / 365 * (doy - 1 + (hour - 12) / 24);
    var eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var tst = hour * 60 + eqt + 4 * lon - 60 * tz;
    var ha = (tst / 4 - 180) * D2R, la = lat * D2R;
    var cz = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
    cz = Math.max(-1, Math.min(1, cz));
    var zen = Math.acos(cz);
    var az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la)); // from south, west +
    var E0 = 1.000110 + 0.034221 * Math.cos(g) + 0.001280 * Math.sin(g) + 0.000719 * Math.cos(2 * g) + 0.000077 * Math.sin(2 * g);
    return { zen: zen, az: az, cosz: cz, I0: 1361 * E0 };
  }

  /* ---------- Erbs diffuse fraction (only when the weather file has no DHI) ---------- */
  function erbs(ghi, cosz, I0) {
    if (ghi <= 0 || cosz <= 0.01) return { dhi: ghi, dni: 0 };
    var kt = Math.min(1, ghi / (I0 * cosz)), kd;
    if (kt <= 0.22) kd = 1 - 0.09 * kt;
    else if (kt <= 0.80) kd = 0.9511 - 0.1604 * kt + 4.388 * kt * kt - 16.638 * Math.pow(kt, 3) + 12.336 * Math.pow(kt, 4);
    else kd = 0.165;
    var dhi = kd * ghi;
    return { dhi: dhi, dni: (ghi - dhi) / cosz };
  }

  /* ---------- Perez 1990 transposition ---------- */
  var PZ = [ // eps bins: f11 f12 f13 f21 f22 f23
    [-0.008, 0.588, -0.062, -0.060, 0.072, -0.022],
    [0.130, 0.683, -0.151, -0.019, 0.066, -0.029],
    [0.330, 0.487, -0.221, 0.055, -0.064, -0.026],
    [0.568, 0.187, -0.295, 0.109, -0.152, -0.014],
    [0.873, -0.392, -0.362, 0.226, -0.462, 0.001],
    [1.132, -1.237, -0.412, 0.288, -0.823, 0.056],
    [1.060, -1.600, -0.359, 0.264, -1.127, 0.131],
    [0.678, -0.327, -0.250, 0.156, -1.377, 0.251]];
  var EPSB = [1.065, 1.230, 1.500, 1.950, 2.800, 4.500, 6.200];
  function perez(ghi, dhi, dni, sp, tilt, azim, albedo) {
    var b = tilt * D2R, g = azim * D2R; // azimuth from south, west +, PVsyst convention
    var cosInc = Math.cos(sp.zen) * Math.cos(b) + Math.sin(sp.zen) * Math.sin(b) * Math.cos(sp.az - g);
    var beam = Math.max(0, cosInc) * dni;
    var grd = ghi * albedo * (1 - Math.cos(b)) / 2;
    if (dhi <= 0) return { poa: beam + grd, beam: beam, sky: 0, grd: grd, inc: Math.acos(Math.max(-1, Math.min(1, cosInc))) };
    var zdeg = sp.zen * R2D, k = 1.041;
    var eps = ((dhi + dni) / dhi + k * Math.pow(sp.zen, 3)) / (1 + k * Math.pow(sp.zen, 3));
    var am = 1 / (Math.max(sp.cosz, 0.0) + 0.50572 * Math.pow(Math.max(96.07995 - zdeg, 0.01), -1.6364));
    var delta = dhi * am / sp.I0;
    var bin = 0; while (bin < 7 && eps >= EPSB[bin]) bin++;
    var c = PZ[bin];
    var F1 = Math.max(0, c[0] + c[1] * delta + c[2] * sp.zen), F2 = c[3] + c[4] * delta + c[5] * sp.zen;
    var a = Math.max(0, cosInc), bb = Math.max(Math.cos(85 * D2R), sp.cosz);
    var sky = dhi * ((1 - F1) * (1 + Math.cos(b)) / 2 + F1 * a / bb + F2 * Math.sin(b));
    var circ = dhi * F1 * a / bb; // circumsolar part, treated like beam for IAM ("separate")
    return { poa: beam + Math.max(0, sky) + grd, beam: beam, circ: circ, sky: Math.max(0, sky) - circ, grd: grd,
             inc: Math.acos(Math.max(-1, Math.min(1, cosInc))) };
  }

  function iam(incRad, tbl) {
    var a = incRad * R2D; if (a >= 90) return 0;
    for (var i = 1; i < tbl.ang.length; i++) if (a <= tbl.ang[i]) {
      var t = (a - tbl.ang[i - 1]) / (tbl.ang[i] - tbl.ang[i - 1]); return tbl.val[i - 1] + t * (tbl.val[i] - tbl.val[i - 1]); }
    return 0;
  }
  var IAM_DIFF = 0.955; // hemispherical average of the Fresnel-AR table for sky diffuse / ground (tilt < 30°)

  /* ---------- relative efficiency at low irradiance (fit to PVsyst one-diode, typical mono-Si) ---------- */
  function lowIrr(G, k) { if (G <= 0) return 0; return 1 + (k == null ? 0.010 : k) * Math.log(G / 1000) * (G < 1000 ? 1 : 0); }

  /* ---------- converter (MPPT / inverter) efficiency vs load ----------
     Loss model P_loss = p0 + k·p + r·p² (per-unit of rated power), the standard 3-term inverter model.
     Default p0/k/r fitted to PVsyst VCZ Max 98.0 % / EURO 96.5 % (fit gives 98.0 / 96.5).
     Calibration Nov 2026: with this curve E_Avail = VCZ +0.1 %/yr, every month within ±1.3 %. */
  var CONV = { p0: 0.008, k: 0.005, r: 0.007, src: 'fit to PVsyst VCZ converter Max/EURO efficiency' };
  function convEff(p, c) { c = c || CONV; if (p <= 0) return 0; return Math.max(0, 1 - (c.p0 + c.k * p + c.r * p * p) / p); }

  /* fit p0/r of the 3-term loss model to a datasheet Max / EURO efficiency pair (k fixed at 0.005) */
  function fitConv(maxEff, euroEff) {
    var W = [[.05, .03], [.1, .06], [.2, .13], [.3, .1], [.5, .48], [1, .2]], best = null;
    for (var p0 = 0.0005; p0 <= 0.03; p0 += 0.0005) for (var r = 0; r <= 0.04; r += 0.0005) {
      var c = { p0: p0, k: 0.005, r: r }, mx = 0, eu = 0;
      for (var p = 0.02; p <= 1; p += 0.01) mx = Math.max(mx, convEff(p, c));
      W.forEach(function (w) { eu += w[1] * convEff(w[0], c); });
      var err = Math.abs(mx - maxEff) + Math.abs(eu - euroEff);
      if (!best || err < best.err) best = { p0: p0, k: 0.005, r: r, err: err, max: mx, euro: eu };
    }
    best.src = 'fit to datasheet Max ' + (maxEff * 100).toFixed(1) + ' % / EURO ' + (euroEff * 100).toFixed(1) + ' %';
    return best;
  }

  /* ---------- the hourly array chain, with PVsyst-style loss accounting ----------
     Loss diagram order (PVsyst): GlobHor -> GlobInc (transposition) -> IAM -> soiling = GlobEff
     -> E nominal at STC eff -> irradiance level -> temperature -> module quality -> LID -> mismatch -> ohmic = E_Array (MPP)
     -> inverter efficiency -> inverter over nominal power (clipping) = E_Grid / E_out */
  var KEYS = ['globHor', 'diffHor', 'globInc', 'globShd', 'lShdEl', 'globIAM', 'globEff', 'eNom', 'lIrr', 'lTemp', 'lQual', 'lLID', 'lMis', 'lOhm', 'eArray', 'lInvEff', 'lClip', 'eOut'];
  function simulate(opts) {
    var L = Object.assign({}, PVSYST.losses, opts.losses || {});
    var site = opts.site || PVSYST.site, w = opts.weather, mod = opts.module, nMod = opts.nModules;
    var Pnom = mod.Pmax * nMod / 1000; // kWp
    var gamma = mod.gammaP / 100, eff = mod.eff || 0.21;
    var pRated = opts.convKW || Pnom, conv = opts.converter;
    var out = { hourly: [], monthly: [], kWp: Pnom, kWac: pRated, losses: L };
    for (var m = 0; m < 12; m++) { var o = { tAmb: 0, n: 0 }; KEYS.forEach(function (k) { o[k] = 0; }); out.monthly.push(o); }
    for (var i = 0; i < w.length; i++) {
      var r = w[i], sp = sunPos(site.lat, site.lon, site.tz, r.doy, r.tSun != null ? r.tSun : r.hour + 0.5);
      var dhi = r.dhi, dni = r.dni;
      if (dhi == null) { var e = erbs(r.ghi, sp.cosz, sp.I0); dhi = e.dhi; dni = e.dni; }
      else if (dni == null) dni = sp.cosz > 0.01 ? Math.max(0, (r.ghi - dhi) / sp.cosz) : 0;
      var p = r.ghi > 0 && sp.cosz > 0 ? perez(r.ghi, dhi, dni, sp, opts.tilt, opts.azimuth, site.albedo) : { poa: 0, beam: 0, circ: 0, sky: 0, grd: 0, inc: 0 };
      var fb = 0, fbe = 0, sh = opts.shade;
      if (sh && p.poa > 0) { var bf = sh.beam(sp.az * R2D, 90 - sp.zen * R2D); fb = bf[0]; fbe = Math.max(0, bf[1] - bf[0]);
        p = { poa: p.poa, beam: p.beam * (1 - fb), circ: (p.circ || 0) * (1 - fb), sky: p.sky * (1 - sh.fd), grd: p.grd * (1 - sh.fa), inc: p.inc, b0: p.beam + (p.circ || 0) }; }
      var gShd = p.beam + (p.circ || 0) + p.sky + p.grd;
      var gIAM = (p.beam + (p.circ || 0)) * iam(p.inc, L.iam) + (p.sky + p.grd) * IAM_DIFF;
      var gEff = gIAM * (1 - L.soiling);
      var tc = r.tamb + gEff * L.absorptance * (1 - eff) / (L.Uc + L.Uv * (r.ws || 0));
      var e0 = Pnom * gEff / 1000;
      var e1 = e0 * lowIrr(gEff, opts.lowIrrK);
      var e2 = e1 * (1 + gamma * (tc - 25));
      var e3 = e2 * (1 - L.quality), e4 = e3 * (1 - L.LID), e5 = e4 * (1 - L.mismatch), lEl = 0;
      if (fbe > 0 && gEff > 0) { lEl = Math.min(e5, e5 * fbe * p.b0 * iam(p.inc, L.iam) * (1 - L.soiling) / gEff); e5 -= lEl; }
      var pdc = Math.max(0, e5 * (1 - L.ohmicSTC * (e5 / Pnom))); // ohmic loss ∝ I², 0.55 % at STC
      var pac = pdc * convEff(pdc / pRated, conv), clip = Math.max(0, pac - pRated), eout = pac - clip;
      var mo = out.monthly[r.month - 1];
      mo.globHor += r.ghi / 1000; mo.diffHor += (dhi || 0) / 1000; mo.globInc += p.poa / 1000; mo.globShd += gShd / 1000; mo.lShdEl += lEl; mo.globIAM += gIAM / 1000; mo.globEff += gEff / 1000;
      mo.eNom += e0; mo.lIrr += e0 - e1; mo.lTemp += e1 - e2; mo.lQual += e2 - e3; mo.lLID += e3 - e4; mo.lMis += e4 - e5 - lEl; mo.lOhm += Math.max(0, e5) - pdc;
      mo.eArray += pdc; mo.lInvEff += pdc - pac; mo.lClip += clip; mo.eOut += eout; mo.tAmb += r.tamb; mo.n++;
      out.hourly.push({ i: i, month: r.month, poa: p.poa, gEff: gEff, tc: tc, pdc: pdc, eout: eout });
    }
    out.monthly.forEach(function (m) { m.tAmb /= Math.max(1, m.n); });
    var y = { tAmb: 0 }; KEYS.forEach(function (k) { y[k] = out.monthly.reduce(function (a, m) { return a + m[k]; }, 0); });
    y.tAmb = out.monthly.reduce(function (a, m) { return a + m.tAmb; }, 0) / 12;
    out.year = y;
    // normalized indicators (IEC 61724 / PVsyst): Yr = GlobInc/1, Ya = EArray/Pnom, Yf = EOut/Pnom, PR = Yf/Yr
    function norm(m, days) { return { Yr: m.globInc / days, Ya: m.eArray / Pnom / days, Yf: m.eOut / Pnom / days,
      Lc: (m.globInc - m.eArray / Pnom) / days, Ls: (m.eArray - m.eOut) / Pnom / days, PR: m.globInc > 0 ? m.eOut / Pnom / m.globInc : 0 }; }
    var MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    out.monthly.forEach(function (m, i) { m.norm = norm(m, MD[i]); });
    y.norm = norm(y, 365);
    return out;
  }

  /* ---------- storage: off-grid / hybrid hourly battery simulation (PVsyst stand-alone logic) ----------
     DC-coupled hybrid inverter: PV -> MPPT (etaMppt) -> DC bus; battery on DC bus; loads through the inverter (efficiency curve).
     Battery: energy E between socMin·C and chargeStop·C, charge/discharge efficiencies = sqrt(RTE), power limits.
     Load shedding: below shedSOC only the critical part of the load is served (non-critical = shed, counted in E_Miss).
     Off-grid: surplus = E_Unused, deficit = E_Miss.  Hybrid: surplus exported (or curtailed if zero-export), deficit imported.
     The year is run twice; the 2nd pass starts from the SOC reached at the end of the 1st (steady state). */
  function simulateStorage(o) {
    var B = o.battery, C = B.kWh, socMin = B.socMin != null ? B.socMin : 0.10, socMax = B.chargeStop != null ? B.chargeStop : 0.96;
    var shed = B.shedSOC != null ? B.shedSOC : socMin, eta = Math.sqrt(B.rte != null ? B.rte : 0.95);
    var pCh = B.maxChargeKW || C, pDis = B.maxDischargeKW || C, kWac = o.kWac, etaM = o.etaMppt != null ? o.etaMppt : 0.99;
    var pdc = o.pdc, L = o.load, crit = o.critical || null, mode = o.mode || 'offgrid', exportOK = o.exportAllowed !== false;
    var E = C * socMax, M, Y, socH;
    function invEff(pac) { return pac <= 0 ? 1 : Math.max(0.80, convEff(Math.min(1, pac / kWac), o.converter)); }
    for (var pass = 0; pass < 2; pass++) {
      M = []; for (var m = 0; m < 12; m++) M.push({ eAvail: 0, eLoad: 0, eUser: 0, eMiss: 0, eShed: 0, eUnused: 0, eExport: 0, eImport: 0,
        eBatIn: 0, eBatOut: 0, lBat: 0, lInv: 0, hMiss: 0, socMin: 1, socSum: 0, n: 0 });
      socH = new Float32Array(pdc.length); var impH = new Float32Array(pdc.length), expH = new Float32Array(pdc.length);
      for (var i = 0; i < pdc.length; i++) {
        var mo = M[o.months[i] - 1], pv = Math.max(0, pdc[i]) * etaM, lac = L[i], soc = E / C;
        var serveAC = lac;
        if (crit && mode === 'offgrid' && soc < shed) { var sh = Math.max(0, lac - crit[i]); mo.eShed += sh; serveAC = lac - sh; }
        var ei = invEff(serveAC), needDC = serveAC / ei;
        var direct = Math.min(pv, needDC), surplus = pv - direct, deficit = needDC - direct;
        // charge
        var room = Math.max(0, (socMax * C - E) / eta), chIn = Math.min(surplus, pCh, room);
        E += chIn * eta; mo.eBatIn += chIn; mo.lBat += chIn * (1 - eta); surplus -= chIn;
        // discharge
        var avail = Math.max(0, (E - socMin * C) * eta), dis = Math.min(deficit, pDis, avail);
        E -= dis / eta; mo.eBatOut += dis; mo.lBat += dis / eta - dis; deficit -= dis;
        var deliveredAC = (direct + dis) * ei, missAC = deficit * ei;
        mo.lInv += (direct + dis) * (1 - ei);
        if (mode === 'offgrid') { mo.eUnused += surplus; mo.eMiss += missAC; if (missAC > 1e-6) mo.hMiss++; }
        else { if (exportOK) { var ex = surplus * invEff(surplus); mo.eExport += ex; expH[i] = ex; } else mo.eUnused += surplus; mo.eImport += missAC; impH[i] = missAC; }
        mo.eAvail += pv; mo.eLoad += lac; mo.eUser += deliveredAC;
        var s = E / C; socH[i] = s; mo.socSum += s; mo.n++; if (s < mo.socMin) mo.socMin = s;
      }
    }
    Y = { eAvail: 0, eLoad: 0, eUser: 0, eMiss: 0, eShed: 0, eUnused: 0, eExport: 0, eImport: 0, eBatIn: 0, eBatOut: 0, lBat: 0, lInv: 0, hMiss: 0 };
    M.forEach(function (m) { Object.keys(Y).forEach(function (k) { Y[k] += m[k]; }); m.socAvg = m.socSum / Math.max(1, m.n);
      m.solFrac = m.eLoad > 0 ? (m.eLoad - m.eMiss - m.eShed - m.eImport) / m.eLoad : 0; });
    Y.solFrac = Y.eLoad > 0 ? (Y.eLoad - Y.eMiss - Y.eShed - Y.eImport) / Y.eLoad : 0;
    Y.cycles = C > 0 ? Y.eBatOut / (C * (socMax - socMin)) : 0;
    return { monthly: M, year: Y, soc: socH, imp: impH, exp: expH, battery: B };
  }

  var api = { VERSION: '0.4', simulateStorage: simulateStorage, PVSYST: PVSYST, CONV: CONV, KEYS: KEYS, sunPos: sunPos, erbs: erbs, perez: perez, iam: iam, convEff: convEff, fitConv: fitConv, simulate: simulate };
  root.PVCore = api;
})(__root);
export default __root.PVCore;
