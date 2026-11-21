/* Arabic/English switch. Arabic is the source language; English is applied at
   runtime by translating DOM text (and a few attributes) with lib/i18n-en.js.
   Mark user data with translate="no" or class "notranslate" to keep it as-is. */
const AR = /[؀-ۿ]/;
const LET = '\\u0621-\\u064A';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
let D = null, RE = null, obs = null;

export function getLang() { try { return localStorage.getItem('lang') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; } }
export function setLang(l) { try { localStorage.setItem('lang', l); } catch { } location.reload(); }

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function build(dict) {
  D = dict;
  const keys = Object.keys(dict).filter(k => k && dict[k] != null).sort((a, b) => b.length - a.length);
  const isL = c => /[ء-ي]/.test(c);
  const parts = keys.map(k => (isL(k[0]) ? `(?<![${LET}])` : '') + esc(k) + (isL(k[k.length - 1]) ? `(?![${LET}])` : ''));
  RE = new RegExp(parts.join('|'), 'g');
}
export function tr(s) {
  if (!RE || !s || !AR.test(s)) return s;
  return s.replace(RE, m => D[m] ?? m).replace(/ ?، ?/g, ', ').replace(/٪/g, '%').replace(/؟/g, '?').replace(/؛/g, ';');
}
const skip = el => !el || el.closest('script,style,textarea,[translate="no"],.notranslate');
function doText(n) {
  const v = n.nodeValue; if (!v || !AR.test(v) || skip(n.parentElement)) return;
  const t = tr(v); if (t !== v) n.nodeValue = t;
}
function doEl(el) {
  if (skip(el)) return;
  for (const a of ATTRS) { const v = el.getAttribute(a); if (v && AR.test(v)) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } }
  if (el.tagName === 'INPUT' && /^(button|submit)$/i.test(el.type) && AR.test(el.value)) el.value = tr(el.value);
}
function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  doEl(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = w.nextNode())) n.nodeType === 3 ? doText(n) : doEl(n);
}

export async function initI18n() {
  if (typeof window === 'undefined' || getLang() !== 'en' || obs) return;
  const m = await import('./i18n-en');
  build(m.default);
  const h = document.documentElement; h.lang = 'en'; h.dir = 'ltr';
  document.title = 'Sanam PV Design Tool';
  for (const f of ['alert', 'confirm', 'prompt']) { const o = window[f].bind(window); window[f] = (msg, ...r) => o(tr(String(msg ?? '')), ...r); }
  walk(document.body);
  obs = new MutationObserver(ms => {
    for (const x of ms) {
      if (x.type === 'characterData') doText(x.target);
      else if (x.type === 'attributes') doEl(x.target);
      else x.addedNodes.forEach(walk);
    }
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
