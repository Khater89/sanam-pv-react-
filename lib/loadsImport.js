/* Import a loads table from Excel / CSV. Column names in Arabic or English, any order.
   Returns { loads:[{n,W,q,f,a,b,c}], bad, noH:[names without operating hours] }. */
const LCOL = { n: /^(الحمل|الجهاز|اسم|البند|name|load|device|item|appliance)/i, W: /^(w$|واط|القدرة|قدرة|power|watt|w\s|w\()/i, q: /^(العدد|عدد|الكمية|qty|quantity|count|no)/i, f: /^(معامل|factor|load ?factor|duty|df)/i,
  a: /^(من|from|start|بداية)/i, b: /^(إلى|الى|لـ|to$|to\s|end|نهاية)/i, h: /^(ساعات|عدد الساعات|hours|hrs|h\/day)/i, c: /^(حرج|critical|crit|ضروري)/i };
const yes = v => /^(1|y|yes|true|نعم|اه|آه|✓|x|ضروري|حرج)$/i.test(String(v).trim());
function hourOf(v) { if (v == null || v === '') return null; if (typeof v === 'number') return v < 1 && v > 0 ? Math.round(v * 24) : v;
  const m = String(v).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|ص|م)?/i); if (!m) return null; let h = +m[1];
  if (m[3] && /pm|م/i.test(m[3]) && h < 12) h += 12; if (m[3] && /am|ص/i.test(m[3]) && h === 12) h = 0; return h; }

export function importRows(R) {
  R = R.filter(r => r && r.some(c => String(c == null ? '' : c).trim() !== '')); if (!R.length) throw new Error('الملف فاضي');
  const hd = R[0].map(c => String(c == null ? '' : c).trim()); let idx = {}, hasH = false;
  hd.forEach((c, i) => Object.keys(LCOL).forEach(k => { if (idx[k] == null && LCOL[k].test(c)) { idx[k] = i; hasH = true; } }));
  if (!hasH) idx = { n: 0, W: 1, q: 2, f: 3, a: 4, b: 5, c: 6 }; else R = R.slice(1);
  if (idx.W == null) throw new Error('ما لقيت عمود القدرة (W)');
  const out = [], noH = []; let bad = 0;
  R.forEach(r => { const g = k => idx[k] == null ? null : r[idx[k]], W = parseFloat(String(g('W')).replace(/,/g, '')); if (!(W > 0)) { bad++; return; }
    let a = hourOf(g('a')), b = hourOf(g('b')); const hrs = parseFloat(g('h')); if ((a == null || b == null) && hrs > 0) { a = 17; b = (17 + Math.round(hrs)) % 24; if (hrs >= 24) { a = 0; b = 24; } }
    if (a == null || b == null) noH.push(String(g('n') || 'حمل').trim()); if (a == null) a = 0; if (b == null) b = 24; let f = parseFloat(g('f')); if (f > 1 && f <= 100) f /= 100;
    out.push({ n: String(g('n') || 'حمل').trim(), W, q: parseFloat(g('q')) || 1, a, b, c: idx.c != null && yes(g('c')), f: isFinite(f) ? Math.max(0, Math.min(1, f)) : 1 }); });
  if (!out.length) throw new Error('ما في ولا سطر فيه قدرة صحيحة');
  return { loads: out, bad, noH };
}
export function parseCSV(t) { const first = t.split('\n')[0]; const d = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (t.indexOf('\t') >= 0 ? '\t' : ',');
  return t.replace(/\r/g, '').split('\n').map(l => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === d && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; }); }
export function loadXLSX() { if (window.XLSX) return Promise.resolve(); return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'; s.onload = ok;
  s.onerror = () => no(new Error('ما قدرت أحمّل قارئ Excel (بدها إنترنت). احفظ الملف CSV وجرّب.')); document.head.appendChild(s); }); }
export const TEMPLATE_CSV = '﻿الحمل,W,العدد,معامل الحمل,من,إلى,حرج\nمكيف 1.5 طن,1400,2,0.7,12,18,لا\nثلاجة,150,1,0.5,0,24,نعم\nإنارة LED,10,20,1,18,24,نعم\nغسالة,500,1,0.6,10,11,لا\nراوتر وكاميرات,60,1,1,0,24,نعم\n';
