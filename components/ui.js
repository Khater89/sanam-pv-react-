'use client';
import { useEffect, useRef } from 'react';
import { HELP, OH, OHK } from '@/lib/help';

/* ؟ icon with a popover: what the number is, how it is computed, and its source */
export function Help({ text }) {
  if (!text) return null;
  return <span className="h" tabIndex={0} data-h={text}>؟</span>;
}

/* Labelled input bound to a controller field */
export function Fd({ ctl, id, label, type = 'number', step, placeholder, dir, disabled, value, style }) {
  const v = value !== undefined ? value : (ctl.f[id] ?? '');
  return (
    <div style={style}>
      <label>{label}<Help text={HELP[id]} /></label>
      <input id={id} type={type} step={step} placeholder={placeholder} dir={dir} disabled={disabled}
        value={v} onChange={e => ctl.input(id, e.target.value)} />
    </div>
  );
}

export function Sel({ ctl, id, label, options, children, bare }) {
  const s = (
    <select id={id} value={ctl.f[id] ?? ''} onChange={e => ctl.input(id, e.target.value)}>
      {options ? options.map(o => <option key={o[0]} value={o[0]} disabled={o[2]}>{o[1]}</option>) : children}
    </select>
  );
  if (bare) return s;
  return <div><label>{label}<Help text={HELP[id]} /></label>{s}</div>;
}

/* Equipment picker: database group + offline presets */
export function Picker({ ctl, id }) {
  const o = ctl.pickerOptions(id);
  return (
    <select id={id} value={ctl.f[id] ?? ''} onChange={e => ctl.input(id, e.target.value)}>
      <option value="">— اختار من القائمة —</option>
      {o.db.length > 0 && <optgroup label="قاعدة البيانات">{o.db.map(x => <option key={x.v} value={x.v}>{x.t}</option>)}</optgroup>}
      <optgroup label="قوالب عامة (بدون إنترنت)">{o.presets.map(x => <option key={x.v} value={x.v}>{x.t}</option>)}</optgroup>
    </select>
  );
}

/* HTML produced by the controller (tables, reports). After each render: add ؟ explanations next to
   known outputs and count KPI numbers up from zero. */
export function Html({ html, className, id, onRendered }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) { decorate(ref.current); if (onRendered) onRendered(); } }, [html]);
  if (!html) return null;
  return <div id={id} ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export function decorate(root) {
  root.querySelectorAll('th,td:first-child,.kpi>div').forEach(e => {
    if (e.querySelector('.h,input,select,button')) return;
    const t = e.textContent.trim(); if (!t) return;
    for (let i = 0; i < OHK.length; i++) if (t.indexOf(OHK[i]) === 0) { e.insertAdjacentHTML('beforeend', '<span class="h" tabindex="0" data-h="' + esc(OH[OHK[i]]) + '">؟</span>'); return; }
  });
  root.querySelectorAll('.kpi b:not([data-cu])').forEach(countUp);
}
function countUp(b) {
  b.setAttribute('data-cu', '1'); const m = b.textContent.match(/^[^\d-]*(-?[\d,]+(?:\.\d+)?)/); if (!m) return;
  const full = b.textContent, num0 = m[1], v = parseFloat(num0.replace(/,/g, '')), dec = (num0.split('.')[1] || '').length; let t0 = null;
  if (!isFinite(v) || v === 0) return;
  const step = ts => { if (!t0) t0 = ts; const k = Math.min(1, (ts - t0) / 700), e = 1 - Math.pow(1 - k, 3);
    b.textContent = full.replace(num0, (v * e).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })); if (k < 1) requestAnimationFrame(step); else b.textContent = full; };
  requestAnimationFrame(step);
}

/* Ripple on every button press */
export function useRipple() {
  useEffect(() => {
    const on = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), sp = document.createElement('span');
      sp.className = 'rip'; sp.style.width = sp.style.height = s + 'px'; sp.style.left = (e.clientX - r.left - s / 2) + 'px'; sp.style.top = (e.clientY - r.top - s / 2) + 'px'; b.appendChild(sp); setTimeout(() => sp.remove(), 600); };
    document.addEventListener('click', on, true); return () => document.removeEventListener('click', on, true);
  }, []);
}

export function readFile(file, as = 'text') {
  return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; if (as === 'buffer') r.readAsArrayBuffer(file); else r.readAsText(file); });
}
