/* eslint-disable */
const __root = {};
/* PVGIS TMY loader -> PVCore weather rows.
   Source: PVGIS 5.3 API  /api/v5_3/tmy?lat=..&lon=..&outputformat=json  (SARAH3 + ERA5).
   Must be fetched through a Supabase Edge Function in the browser (PVGIS sends no CORS headers).
   Timing: PVGIS values are stamped HH:00 UTC but are sampled at HH:00 + irradiance_time_offset
   (≈0.16 h at Russeifa). Verified: closure |DNI·cosZ + DHI − GHI| = 1.2 W/m² with the offset,
   11.6 W/m² without, 25 W/m² with the usual +0.5 h assumption. */
(function (root) {
  'use strict';
  var MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function fromJSON(json, tz) {
    var off = (json.inputs && json.inputs.location && json.inputs.location.irradiance_time_offset) || 0;
    var rows = json.outputs.tmy_hourly, out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], t = r['time(UTC)'];
      var mo = +t.slice(4, 6), dd = +t.slice(6, 8), hu = +t.slice(9, 11);
      var doy = dd; for (var k = 0; k < mo - 1; k++) doy += MD[k];
      var loc = hu + tz;                          // local standard time of the sample
      out.push({ month: mo, doy: doy, hour: loc, tSun: loc + off,
                 ghi: r['G(h)'], dni: r['Gb(n)'], dhi: r['Gd(h)'], tamb: r.T2m, ws: r.WS10m, rh: r.RH });
    }
    // TMY rows are in UTC order; month/doy already come from the stamp, which is what simulate() bins on.
    return { rows: out, meta: { lat: json.inputs.location.latitude, lon: json.inputs.location.longitude,
             elev: json.inputs.location.elevation, offset: off, radDb: json.inputs.meteo_data.radiation_db,
             meteoDb: json.inputs.meteo_data.meteo_db, years: [json.inputs.meteo_data.year_min, json.inputs.meteo_data.year_max],
             months: json.outputs.months_selected } };
  }

  /* Scale each month's irradiance to a target monthly GlobHor (kWh/m²) keeping the hourly shape and diffuse fraction.
     Used only to compare against a PVsyst run made on other weather (e.g. Meteonorm), never for production designs. */
  function scaleToMonthly(rows, target) {
    var s = new Array(12).fill(0);
    rows.forEach(function (r) { s[r.month - 1] += r.ghi / 1000; });
    var f = s.map(function (v, m) { return v > 0 ? target[m] / v : 1; });
    return rows.map(function (r) { var k = f[r.month - 1];
      return Object.assign({}, r, { ghi: r.ghi * k, dni: r.dni * k, dhi: r.dhi * k }); });
  }

  function monthly(rows) {
    var m = []; for (var i = 0; i < 12; i++) m.push({ ghi: 0, dhi: 0, t: 0, n: 0 });
    rows.forEach(function (r) { var o = m[r.month - 1]; o.ghi += r.ghi / 1000; o.dhi += r.dhi / 1000; o.t += r.tamb; o.n++; });
    return m.map(function (o) { return { ghi: o.ghi, dhi: o.dhi, tamb: o.t / o.n }; });
  }

  var api = { fromJSON: fromJSON, scaleToMonthly: scaleToMonthly, monthly: monthly,
              url: function (lat, lon) { return 'https://re.jrc.ec.europa.eu/api/v5_3/tmy?lat=' + lat + '&lon=' + lon + '&outputformat=json'; } };
  root.PVGIS = api;
})(__root);
export default __root.PVGIS;
