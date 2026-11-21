/* Equipment import: spreadsheet rows (CSV / Excel) and datasheet PDFs (text extraction + pattern matching).
   The parsed values only pre-fill the form: the user checks them against the datasheet and saves. */
import { COLS } from '@/lib/controller';
import { parseCSV, loadXLSX } from '@/lib/loadsImport';

const norm = s => String(s || '').toLowerCase().replace(/[\s_\-()%/.]+/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');
export function templateCSV(t) { const C = COLS[t]; return '﻿' + C.map(c => c[0]).join(',') + '\n' + C.map(c => c[1].replace(/,/g, ' ')).join(',') + '\n'; }

/* rows → bodies; header row may use the DB keys or the Arabic labels; a second "label" row from the template is skipped */
export function rowsToBodies(t, rows) { const C = COLS[t], head = (rows[0] || []).map(norm), idx = C.map(c => { const a = head.indexOf(norm(c[0])); return a >= 0 ? a : head.indexOf(norm(c[1])); });
  if (!idx.some(i => i >= 0)) return { err: 'ما لقيت أعمدة معروفة بأول سطر. استعمل النموذج (أسماء الأعمدة: ' + C.slice(0, 5).map(c => c[0]).join(', ') + '…).' };
  const out = []; rows.slice(1).forEach(r => { if (!r || !r.some(x => String(x || '').trim())) return; const b = {}; let lbl = 0, any = 0;
    C.forEach((c, k) => { const i = idx[k]; if (i < 0) return; let v = r[i]; v = v == null ? '' : String(v).trim(); if (v === c[1].replace(/,/g, ' ')) lbl++;
      if (c[2] === 'b') b[c[0]] = /^(1|true|yes|y|نعم|✓)$/i.test(v); else if (c[2] === 'n' || c[2] === 'fk' || c[2] === 'sup') { const n = parseFloat(v.replace(',', '.')); b[c[0]] = isNaN(n) ? null : n; if (!isNaN(n)) any++; }
      else { b[c[0]] = v === '' ? null : v; if (v) any++; } });
    if (lbl < 2 && any) out.push(b); });
  return { rows: out }; }
export async function readSheet(file) { const n = file.name.toLowerCase();
  if (/\.(xlsx|xls)$/.test(n)) { await loadXLSX(); const wb = window.XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' }); return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }); }
  return parseCSV(await file.text()); }

/* ---------- PDF datasheets ---------- */
function loadPDFJS() { if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib); return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; ok(window.pdfjsLib); };
  s.onerror = () => no(new Error('ما قدرت أحمّل قارئ PDF (بدها إنترنت).')); document.head.appendChild(s); }); }
export async function pdfLines(file) { const lib = await loadPDFJS(), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, lines = [];
  for (let p = 1; p <= Math.min(doc.numPages, 4); p++) { const tc = await (await doc.getPage(p)).getTextContent(), rows = {};
    tc.items.forEach(it => { const y = Math.round(it.transform[5] / 3) * 3; (rows[y] = rows[y] || []).push({ x: it.transform[4], s: it.str }); });
    Object.keys(rows).map(Number).sort((a, b) => b - a).forEach(y => lines.push(rows[y].sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim())); }
  return lines.filter(Boolean); }

const NUM = /-?\d+(?:[.,]\d+)?/g, nums = s => (s.match(NUM) || []).map(x => parseFloat(x.replace(',', '.')));
function grab(lines, re, opt) { opt = opt || {}; for (const l of lines) { const m = l.match(re); if (!m) continue; const rest = l.slice(m.index + m[0].length); let v = nums(rest);
    if (opt.filter) v = v.filter(opt.filter); if (v.length) return v; } return null; }
const pct = (lines, re) => { for (const l of lines) { const m = l.match(re); if (!m) continue; const r = l.slice(m.index + m[0].length).match(/(-?\s?0[.,]\d+|[+-]?\d[.,]\d+)\s*%/); if (r) return parseFloat(r[1].replace(/\s/g, '').replace(',', '.')); } return null; };

/* returns { fields: {key: [candidates by column]}, single: {key: value}, columns: n, label: [...] } */
export function parseDatasheet(t, lines) { const F = {}, S = {}, txt = lines.join('\n');
  const brand = (txt.match(/\b(Jinko(?:Solar)?|JA ?Solar|LONGi|Trina|Canadian Solar|Risen|Astronergy|Huawei|Deye|Growatt|Sungrow|SMA|Fronius|Solis|GoodWe|Pylontech|BYD|Dyness|Felicity|Victron|SolaX|Fox ?ESS|Tongwei|DAS Solar|Aiko)\b/i) || [])[1];
  if (brand) S.brand = brand.replace(/\s+/g, ' ').replace(/^JinkoSolar$/i, 'Jinko');
  const model = (txt.match(/\b([A-Z]{2,}[A-Z0-9]*[-–][A-Z0-9][A-Z0-9\-–/.]{3,})\b/) || [])[1]; if (model) S.model = model;
  if (t === 'modules') {
    F.pmax_w = grab(lines, /(Maximum Power|Rated (Maximum )?Power|Pmax|Peak Power)\b[^0-9]*?(\(W\)|\[W\]|W\b)?/i, { filter: v => v >= 100 && v <= 900 });
    F.vmp = grab(lines, /(Maximum Power Voltage|Optimum Operating Voltage|Vmpp?|MPP Voltage)\b/i, { filter: v => v > 10 && v < 100 });
    F.imp = grab(lines, /(Maximum Power Current|Optimum Operating Current|Impp?|MPP Current)\b/i, { filter: v => v > 1 && v < 30 });
    F.voc = grab(lines, /(Open[- ]?Circuit Voltage|Voc)\b/i, { filter: v => v > 10 && v < 100 });
    F.isc = grab(lines, /(Short[- ]?Circuit Current|Isc)\b/i, { filter: v => v > 1 && v < 30 });
    S.gamma_p = pct(lines, /(Temperature Coefficients? (of|for) Pmax|Pmax.*Temperature|γ\s*\(?Pmax)/i); S.beta_voc = pct(lines, /(Temperature Coefficients? (of|for) Voc|Voc.*Temperature|β\s*\(?Voc)/i);
    S.alpha_isc = pct(lines, /(Temperature Coefficients? (of|for) Isc|Isc.*Temperature|α\s*\(?Isc)/i);
    const d = txt.match(/(\d{4})\s*[×xX*]\s*(\d{3,4})\s*[×xX*]\s*(\d{2})\s*mm/); if (d) { S.length_m = +d[1] / 1000; S.width_m = +d[2] / 1000; }
    if (/TOPCon|N[- ]type/i.test(txt)) S.technology = 'N-type TOPCon'; else if (/HJT|Heterojunction/i.test(txt)) S.technology = 'HJT'; else if (/PERC/i.test(txt)) S.technology = 'PERC';
    S.bifacial = /bifacial/i.test(txt); }
  if (t === 'inverters') {
    const pac = grab(lines, /(Rated (AC )?(Output )?Power|Nominal AC (Output )?Power|Rated Output Power|AC Nominal Power)\b/i); if (pac) F.pac_kw = pac.map(v => v > 300 ? v / 1000 : v);
    const pdc = grab(lines, /(Max\.? (PV|DC) Input Power|Max\.? PV Array Power|Max\.? Input Power)\b/i); if (pdc) F.pdc_max_kw = pdc.map(v => v > 300 ? v / 1000 : v);
    F.vmax_dc = grab(lines, /(Max\.? (DC |PV )?Input Voltage|Max\.? PV Voltage)\b/i, { filter: v => v >= 100 && v <= 1600 });
    for (const l of lines) { const m = l.match(/(MPPT?|MPP) (Operating )?(Voltage )?Range\D*(\d{2,4})\s*(V)?\s*[-~–]\s*(\d{2,4})/i); if (m) { S.vmpp_min = +m[4]; S.vmpp_max = +m[6]; break; } }
    F.n_mppt = grab(lines, /(Number of MPP ?T(rackers)?|No\.? of MPPT|MPPT Number)\b/i, { filter: v => v >= 1 && v <= 20 });
    F.imax_mppt = grab(lines, /(Max\.? (DC |PV )?Input Current)\b/i, { filter: v => v > 1 && v < 100 });
    F.isc_mppt = grab(lines, /(Max\.? (DC |PV )?Short[- ]Circuit Current|Max\.? Isc)\b/i, { filter: v => v > 1 && v < 100 });
    F.max_eff = grab(lines, /(Max(imum)?\.? Efficiency)\b/i, { filter: v => v > 80 && v < 100 }); F.euro_eff = grab(lines, /(Euro(pean)? Efficiency|EU Efficiency)\b/i, { filter: v => v > 80 && v < 100 });
    for (const l of lines) { const m = l.match(/Battery Voltage Range\D*(\d{2,4})\s*[-~–]\s*(\d{2,4})/i); if (m) { S.batt_v_min = +m[1]; S.batt_v_max = +m[2]; break; } }
    F.batt_i_max = grab(lines, /(Max\.? (Battery )?(Charg(e|ing)|Discharg(e|ing)) Current)\b/i, { filter: v => v > 5 && v < 1000 });
    S.phase = /three[- ]?phase|3[- ]?phase|3\/N\/PE|400 ?V/i.test(txt) ? '3ph' : '1ph'; S.kind = /hybrid|battery/i.test(txt) ? 'hybrid' : 'grid'; }
  if (t === 'batteries') {
    F.voltage_nom = grab(lines, /(Nominal Voltage|Rated Voltage)\b/i, { filter: v => v > 10 && v < 1000 });
    const e = grab(lines, /(Nominal Energy|Rated Energy|Nominal Capacity|Energy Capacity|Usable Energy|Capacity)\b/i); if (e) F.capacity_kwh = e.map(v => v > 200 ? v / 1000 : v).filter(v => v > 0.5 && v < 500);
    for (const l of lines) { const m = l.match(/(\d+(?:[.,]\d+)?)\s*Ah\b/); if (m && +m[1].replace(',', '.') >= 10) { S.capacity_ah = +m[1].replace(',', '.'); break; } }
    F.max_charge_a = grab(lines, /(Max\.? (Continuous )?Charg(e|ing) Current|Recommended Charge Current)\b/i, { filter: v => v > 1 && v < 1000 });
    F.max_discharge_a = grab(lines, /(Max\.? (Continuous )?Discharg(e|ing) Current)\b/i, { filter: v => v > 1 && v < 1000 });
    F.dod_pct = grab(lines, /(Depth of Discharge|DoD)\b/i, { filter: v => v >= 50 && v <= 100 }); F.cycles = grab(lines, /(Cycle Life|Cycles)\b/i, { filter: v => v >= 1000 && v <= 20000 });
    S.chemistry = /LFP|LiFePO4|Lithium Iron Phosphate/i.test(txt) ? 'LFP' : /NMC/i.test(txt) ? 'NMC' : ''; }
  Object.keys(F).forEach(k => { if (!F[k] || !F[k].length) delete F[k]; });
  const columns = Math.max(1, ...Object.values(F).map(a => a.length)), label = F.pmax_w || F.pac_kw || F.capacity_kwh || null;
  return { F, S, columns, label, found: Object.keys(F).length + Object.keys(S).length }; }
export function pickColumn(P, col) { const o = Object.assign({}, P.S); Object.keys(P.F).forEach(k => { const a = P.F[k]; o[k] = a.length >= P.columns ? a[Math.min(col, a.length - 1)] : a[0]; }); return o; }
