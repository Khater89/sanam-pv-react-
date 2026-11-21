'use client';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, X, Save, Trash2, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, AlertTriangle, LogIn, Sun, Zap, BatteryCharging, Building2, Tag } from 'lucide-react';
import { COLS, TITLES, KIND2T, fmt } from '@/lib/controller';
import { Button, Card, Badge, Input, NativeSelect, Stat } from './ui-kit';
import { cn } from '@/lib/cn';
import { templateCSV, rowsToBodies, readSheet, pdfLines, parseDatasheet, pickColumn } from '@/lib/dsImport';
import { Upload, FileText, Download } from 'lucide-react';

const blankFor = tt => { const o = {}; COLS[tt].forEach(c => { o[c[0]] = c[0] === 'quoted_on' ? new Date().toISOString().slice(0, 10) : c[0] === 'unit' ? 'unit' : c[2] === 's' ? c[3][0] : c[2] === 'b' ? false : ''; }); return o; };
const TAB_ICON = { modules: Sun, inverters: Zap, batteries: BatteryCharging, suppliers: Building2, prices: Tag };
const KIND_AR = { grid: 'مربوط', hybrid: 'هجين', offgrid: 'هجين/منفصل' };

/* columns shown in the big table (key, label, render?, numeric?) — every spec value, not just 3 */
function columns(t, ctl) {
  const L = x => <span dir="ltr">{x}</span>;
  const n = (k, d) => r => r[k] == null || r[k] === '' ? '—' : fmt(r[k], d);
  const price = kind => r => { const bp = ctl.bestPrice(kind, r.id); return bp ? fmt(bp.p.price_jod, 3) + (bp.p.unit !== 'unit' ? ' /' + bp.p.unit : '') : '—'; };
  if (t === 'modules') return [['brand', 'الماركة'], ['model', 'الموديل'], ['pmax_w', 'Pmax W', n('pmax_w', 0), 1], ['vmp', 'Vmp V', n('vmp', 2), 1], ['imp', 'Imp A', n('imp', 2), 1], ['voc', 'Voc V', n('voc', 2), 1], ['isc', 'Isc A', n('isc', 2), 1],
    ['eff', 'الكفاءة %', r => r.pmax_w && r.length_m && r.width_m ? fmt(r.pmax_w / (r.length_m * r.width_m * 10), 2) : '—', 1], ['gamma_p', 'γPmax', n('gamma_p', 2), 1], ['beta_voc', 'βVoc', n('beta_voc', 2), 1],
    ['size', 'المقاس m', r => r.length_m ? L(fmt(r.length_m, 3) + ' × ' + fmt(r.width_m, 3)) : '—'], ['technology', 'التقنية'], ['bifacial', 'وجهين', r => r.bifacial ? '✓' : ''], ['_price', 'أقل سعر JD', price('module'), 1]];
  if (t === 'inverters') return [['brand', 'الماركة'], ['model', 'الموديل'], ['kind', 'النوع', r => KIND_AR[r.kind] || r.kind], ['phase', 'الطور', r => r.phase === '1ph' ? '1 فاز' : '3 فاز'], ['pac_kw', 'AC kW', n('pac_kw', 2), 1], ['pdc_max_kw', 'أقصى PV kW', n('pdc_max_kw', 1), 1],
    ['vmax_dc', 'Vmax DC', n('vmax_dc', 0), 1], ['mppt', 'مدى MPPT V', r => r.vmpp_min ? L(r.vmpp_min + '–' + r.vmpp_max) : '—'], ['n_mppt', 'MPPT', n('n_mppt', 0), 1], ['imax_mppt', 'Imax/MPPT', n('imax_mppt', 1), 1], ['isc_mppt', 'Isc/MPPT', n('isc_mppt', 1), 1],
    ['max_eff', 'Max %', n('max_eff', 1), 1], ['euro_eff', 'Euro %', n('euro_eff', 1), 1], ['batt', 'بطارية V', r => r.batt_v_min ? L(r.batt_v_min + '–' + r.batt_v_max) : '—'], ['batt_i_max', 'بطارية A', n('batt_i_max', 0), 1], ['_price', 'أقل سعر JD', price('inverter'), 1]];
  if (t === 'batteries') return [['brand', 'الماركة'], ['model', 'الموديل'], ['chemistry', 'الكيمياء'], ['voltage_nom', 'الجهد V', n('voltage_nom', 1), 1], ['capacity_kwh', 'الاسمي kWh', n('capacity_kwh', 2), 1],
    ['usable_kwh', 'الصافي kWh', r => r.usable_kwh != null ? fmt(r.usable_kwh, 2) : (r.capacity_kwh && r.dod_pct ? fmt(r.capacity_kwh * r.dod_pct / 100, 2) : '—'), 1], ['capacity_ah', 'Ah', n('capacity_ah', 0), 1],
    ['max_charge_a', 'شحن A', n('max_charge_a', 0), 1], ['max_discharge_a', 'تفريغ A', n('max_discharge_a', 0), 1], ['dod_pct', 'DoD %', n('dod_pct', 0), 1], ['rte_pct', 'RTE %', n('rte_pct', 1), 1], ['cycles', 'دورات', n('cycles', 0), 1],
    ['hv', 'جهد', r => r.hv ? 'عالي HV' : 'منخفض LV'], ['_price', 'أقل سعر JD', price('battery'), 1]];
  if (t === 'suppliers') return [['name', 'المورد'], ['kind', 'النوع'], ['city', 'المدينة'], ['brands', 'الماركات'], ['phone', 'الهاتف'], ['contact', 'المسؤول'], ['website', 'الموقع', r => r.website ? <a href={r.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-brand-600 hover:underline">فتح</a> : '—']];
  return [['_item', 'البند', r => ctl.itemLabel(r)], ['item_kind', 'النوع'], ['_sup', 'المورد', r => { const sp = ctl.DB.suppliers.filter(x => x.id === r.supplier_id)[0]; return sp ? sp.name : '—'; }],
    ['price_jod', 'السعر JD', n('price_jod', 3), 1], ['unit', 'الوحدة'], ['incl_tax', 'شامل الضريبة', r => r.incl_tax ? '✓' : ''], ['quoted_on', 'التاريخ'], ['notes', 'ملاحظات', r => <span className="line-clamp-1 max-w-72 text-slate-500">{r.notes || ''}</span>]];
}
const sortVal = (r, k) => k === 'eff' ? (r.pmax_w && r.length_m ? r.pmax_w / (r.length_m * r.width_m) : null) : k === 'mppt' ? r.vmpp_max : k === 'batt' ? r.batt_v_max : k === 'size' ? r.length_m : r[k];

export default function DBPage({ ctl }) {
  const [t, setT] = useState('modules'), [edit, setEdit] = useState(null), [open, setOpen] = useState(false), [q, setQ] = useState('');
  const [brand, setBrand] = useState(''), [f1, setF1] = useState(''), [f2, setF2] = useState(''), [ver, setVer] = useState(''), [sort, setSort] = useState(['', 1]);
  const [form, setForm] = useState(() => blankFor('modules')), [msg, setMsg] = useState(''), [lg, setLg] = useState({ e: '', p: '' });
  const [imp, setImp] = useState(null), [pdf, setPdf] = useState(null), [col, setCol] = useState(0), [imsg, setImsg] = useState('');
  const rows = ctl.DB[t] || [], cols = columns(t, ctl), hasBrand = t !== 'suppliers' && t !== 'prices', hasVer = hasBrand;
  const brands = useMemo(() => [...new Set(rows.map(r => r.brand).filter(Boolean))].sort(), [rows]);
  const sw = tt => { setT(tt); setImp(null); setPdf(null); setImsg(''); setEdit(null); setOpen(false); setMsg(''); setForm(blankFor(tt)); setBrand(''); setF1(''); setF2(''); setVer(''); setSort(['', 1]); setQ(''); };
  const pick = r => { const o = {}; COLS[t].forEach(c => { o[c[0]] = r[c[0]] == null ? (c[2] === 'b' ? false : '') : r[c[0]]; }); setForm(o); setEdit(r.id); setOpen(true); setMsg(''); };
  let list = rows.filter(r => (!q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()) || (t === 'prices' && ctl.itemLabel(r).toLowerCase().includes(q.toLowerCase())))
    && (!brand || r.brand === brand) && (!ver || (ver === 'y' ? r.verified : !r.verified))
    && (!f1 || (t === 'inverters' ? r.kind === f1 : t === 'batteries' ? String(!!r.hv) === f1 : t === 'suppliers' ? r.city === f1 : t === 'prices' ? r.item_kind === f1 : true))
    && (!f2 || (t === 'inverters' ? r.phase === f2 : true)));
  if (sort[0]) list = list.slice().sort((a, b) => { const x = sortVal(a, sort[0]), y = sortVal(b, sort[0]); if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * sort[1]; });
  const save = () => { const body = {}; COLS[t].forEach(c => { const v = form[c[0]]; body[c[0]] = c[2] === 'b' ? !!v : (c[2] === 'n' || c[2] === 'fk' || c[2] === 'sup') ? (v === '' || v == null ? null : +v) : (v === '' ? null : v); });
    setMsg('جاري الحفظ…'); ctl.dbSave(t, edit, body).then(row => { if (row) setEdit(row.id); setMsg('تم الحفظ ✓'); }).catch(e => setMsg('خطأ: ' + e.message)); };
  const del = () => { if (!edit) return; const r = rows.filter(x => x.id === edit)[0]; if (!confirm('حذف "' + ctl.label(t, r) + '" نهائياً؟')) return;
    ctl.dbDelete(t, edit).then(() => { setEdit(null); setOpen(false); setForm(blankFor(t)); setMsg('انحذف'); }).catch(e => setMsg('خطأ: ' + e.message)); };
  useEffect(() => { if (!open) return; const k = e => { if (e.key === 'Escape') setOpen(false); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [open]);
  const dlTpl = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([templateCSV(t)], { type: 'text/csv' })); a.download = 'sanam-' + t + '-template.csv'; a.click(); };
  const onSheet = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; setPdf(null); setImsg('جاري القراءة…');
    try { const r = rowsToBodies(t, await readSheet(f)); if (r.err) { setImsg(r.err); setImp(null); } else { setImp({ name: f.name, rows: r.rows }); setImsg(r.rows.length + ' صف جاهز للاستيراد من ' + f.name + '. راجعهم وبعدين اضغط استورد.'); } } catch (er) { setImsg('خطأ: ' + er.message); } };
  const doImport = async () => { if (!imp) return; let ok = 0, bad = 0; for (const b of imp.rows) { try { setImsg('جاري الحفظ ' + (ok + bad + 1) + ' / ' + imp.rows.length + '…'); await ctl.dbSave(t, null, Object.assign({ verified: false }, b)); ok++; } catch (er) { bad++; } }
    setImp(null); setImsg('✓ انضاف ' + ok + ' صف' + (bad ? '، وفشل ' + bad + ' (غالباً عمود ناقص أو قيمة غلط)' : '') + '.'); };
  const onPdf = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; setImp(null); setImsg('جاري قراءة الداتا شيت…');
    try { const L = await pdfLines(f), P = parseDatasheet(t, L); if (!P.found) { setImsg('ما قدرت أطلع قيم من هالملف (ممكن يكون صورة مش نص). عبّيها يدوياً.'); return; } setPdf({ P, name: f.name }); setCol(Math.max(0, P.columns - 1));
      setImsg('لقيت ' + P.found + ' قيمة من ' + f.name + (P.columns > 1 ? '. الداتا شيت فيه ' + P.columns + ' موديلات: اختار العمود.' : '.')); } catch (er) { setImsg('خطأ: ' + er.message); } };
  const fillFromPdf = () => { if (!pdf) return; const v = pickColumn(pdf.P, col), o = blankFor(t); COLS[t].forEach(c => { if (v[c[0]] != null && v[c[0]] !== '') o[c[0]] = v[c[0]]; });
    o.verified = false; o.notes = 'مستورد من ' + pdf.name + ' — راجع القيم مع الداتا شيت'; setForm(o); setEdit(null); setOpen(true); setMsg('راجع القيم، كمّل الناقص، واحفظ.'); };
  const cur = edit ? rows.filter(x => x.id === edit)[0] : null;
  const D = ctl.DB, maxOf = (tb, k) => (D[tb] || []).reduce((a, r) => Math.max(a, +r[k] || 0), 0);

  if (!ctl.sess) return <Card className="mx-auto max-w-md p-6">
    <div className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900"><LogIn className="size-5" />سجّل دخول عشان تفتح قاعدة المعدات</div>
    <div className="space-y-3">
      <div><label className="mb-1 block text-xs font-semibold text-slate-600">الإيميل</label><Input type="email" dir="ltr" value={lg.e} onChange={e => setLg({ ...lg, e: e.target.value })} /></div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-600">كلمة السر</label><Input type="password" dir="ltr" value={lg.p} onChange={e => setLg({ ...lg, p: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') ctl.login(lg.e, lg.p); }} /></div>
      <div className="flex items-center justify-between gap-2"><Button variant="outline" onClick={() => ctl.signup(lg.e, lg.p)}>إنشاء حساب</Button><Button onClick={() => ctl.login(lg.e, lg.p)}><LogIn />دخول</Button></div>
      <div className="text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: ctl.out.lgMsg || '' }} />
    </div></Card>;

  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Stat icon={Sun} tone="amber" label="الألواح" value={(D.modules || []).length} sub={'لحد ' + maxOf('modules', 'pmax_w') + ' W'} />
      <Stat icon={Zap} label="الانفيرترات" value={(D.inverters || []).length} sub={'لحد ' + maxOf('inverters', 'pac_kw') + ' kW'} />
      <Stat icon={BatteryCharging} tone="green" label="البطاريات" value={(D.batteries || []).length} sub={'لحد ' + maxOf('batteries', 'capacity_kwh') + ' kWh'} />
      <Stat icon={Building2} tone="violet" label="الموردين" value={(D.suppliers || []).length} />
      <Stat icon={Tag} tone="amber" label="الأسعار" value={(D.prices || []).length} />
    </div>
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2">
        {Object.keys(TITLES).map(k => { const I = TAB_ICON[k]; return <button key={k} onClick={() => sw(k)} className={cn('-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition cursor-pointer', t === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
          <I className="size-4" />{TITLES[k].replace(' المحليين', '')}<span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{(D[k] || []).length}</span></button>; })}
        <div className="ms-auto flex flex-wrap gap-2 py-2">
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Upload className="size-4" />استيراد CSV / Excel<input type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={onSheet} /></label>
          {hasBrand && <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FileText className="size-4" />من الداتا شيت PDF<input type="file" accept="application/pdf" className="hidden" onChange={onPdf} /></label>}
          <Button size="sm" variant="ghost" onClick={dlTpl}><Download />نموذج</Button>
          <Button size="sm" variant="accent" onClick={() => { setEdit(null); setForm(blankFor(t)); setOpen(true); setMsg(''); }}><Plus />إضافة {TITLES[t].replace(' المحليين', '')}</Button></div>
      </div>
      {(imsg || imp || pdf) && <div className="space-y-2 border-b border-amber-200 bg-amber-50/60 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-800">{imsg}</span><span className="ms-auto" /><Button size="sm" variant="ghost" onClick={() => { setImp(null); setPdf(null); setImsg(''); }}><X />إغلاق</Button></div>
        {imp && <><div className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white"><table className="fn-table w-full text-xs"><thead><tr>{COLS[t].slice(0, 9).map(c => <th key={c[0]}>{c[1]}</th>)}</tr></thead>
          <tbody>{imp.rows.slice(0, 30).map((r, i) => <tr key={i}>{COLS[t].slice(0, 9).map(c => <td key={c[0]}>{r[c[0]] == null ? '—' : String(r[c[0]])}</td>)}</tr>)}</tbody></table></div>
          <Button size="sm" onClick={doImport}><Upload />استورد {imp.rows.length} صف</Button></>}
        {pdf && <div className="flex flex-wrap items-center gap-2">{pdf.P.columns > 1 && pdf.P.label && <NativeSelect className="w-56" value={col} onChange={e => setCol(+e.target.value)}>{pdf.P.label.map((v, i) => <option key={i} value={i}>العمود {i + 1}: {v}</option>)}</NativeSelect>}
          <span className="text-xs text-slate-600">{Object.entries(pickColumn(pdf.P, col)).filter(([, v]) => v !== '' && v != null && v !== false).map(([k, v]) => k + '=' + v).join(' · ')}</span>
          <Button size="sm" onClick={fillFromPdf}><FileText />عبّي النموذج للمراجعة</Button></div>}
      </div>}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 p-3">
        <div className="relative min-w-56 flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="ps-9" placeholder="بحث بأي قيمة: موديل، ماركة، رقم…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {hasBrand && <NativeSelect className="w-40" value={brand} onChange={e => setBrand(e.target.value)}><option value="">كل الماركات</option>{brands.map(b => <option key={b}>{b}</option>)}</NativeSelect>}
        {t === 'inverters' && <><NativeSelect className="w-36" value={f1} onChange={e => setF1(e.target.value)}><option value="">كل الأنواع</option><option value="grid">مربوط</option><option value="hybrid">هجين</option><option value="offgrid">هجين/منفصل</option></NativeSelect>
          <NativeSelect className="w-28" value={f2} onChange={e => setF2(e.target.value)}><option value="">كل الأطوار</option><option value="1ph">1 فاز</option><option value="3ph">3 فاز</option></NativeSelect></>}
        {t === 'batteries' && <NativeSelect className="w-36" value={f1} onChange={e => setF1(e.target.value)}><option value="">كل الجهود</option><option value="false">منخفض LV</option><option value="true">عالي HV</option></NativeSelect>}
        {t === 'suppliers' && <NativeSelect className="w-36" value={f1} onChange={e => setF1(e.target.value)}><option value="">كل المدن</option>{[...new Set(rows.map(r => r.city).filter(Boolean))].map(c => <option key={c}>{c}</option>)}</NativeSelect>}
        {t === 'prices' && <NativeSelect className="w-36" value={f1} onChange={e => setF1(e.target.value)}><option value="">كل البنود</option>{['module', 'inverter', 'battery', 'other'].map(c => <option key={c}>{c}</option>)}</NativeSelect>}
        {hasVer && <NativeSelect className="w-36" value={ver} onChange={e => setVer(e.target.value)}><option value="">التحقق: الكل</option><option value="y">متحقق ✓</option><option value="n">بحاجة تحقق ⚠</option></NativeSelect>}
        <span className="text-xs text-slate-500">{list.length} من {rows.length}</span>
      </div>
      <div className="max-h-[calc(100vh-340px)] overflow-auto">
        <table className="fn-table dbt w-full text-[13px]">
          <thead className="sticky top-0 z-10"><tr>
            {hasVer && <th className="w-8" />}
            {cols.map(([k, l, , num]) => <th key={k} className={cn(num && 'n', 'cursor-pointer select-none hover:text-slate-900')} onClick={() => setSort(s => [k, s[0] === k ? -s[1] : (num ? -1 : 1)])}>
              <span className="inline-flex items-center gap-1">{l}{sort[0] === k ? (sort[1] > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-30" />}</span></th>)}
            {hasBrand && <th>داتا شيت</th>}</tr></thead>
          <tbody>{list.map(r => <tr key={r.id} onClick={() => pick(r)} className={edit === r.id ? '!bg-amber-50' : ''}>
            {hasVer && <td>{r.verified ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertTriangle className="size-4 text-amber-500" title="بحاجة تحقق من الداتا شيت" />}</td>}
            {cols.map(([k, , fn, num]) => <td key={k} className={cn(num && 'n', k === 'model' || k === 'name' || k === '_item' ? 'font-semibold text-slate-900' : 'text-slate-700', 'whitespace-nowrap')}>{fn ? fn(r) : (r[k] == null || r[k] === '' ? '—' : String(r[k]))}</td>)}
            {hasBrand && <td>{r.datasheet_url ? <a href={r.datasheet_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="inline-flex text-brand-600 hover:text-brand-800"><ExternalLink className="size-4" /></a> : ''}</td>}
          </tr>)}</tbody>
        </table>
        {!list.length && <div className="py-12 text-center text-sm text-slate-500">ما في نتائج.</div>}
      </div>
    </Card>

    {open && createPortal(<div dir="rtl" className="fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
      <div className="flex-1 bg-slate-900/30 backdrop-blur-[1px]" />
      <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div><div className="text-xs text-slate-500">{TITLES[t]}</div><div className="text-lg font-bold text-slate-900">{cur ? ctl.label(t, cur) : 'إضافة جديد'}</div></div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X /></Button></div>
        <div className="grid flex-1 grid-cols-2 content-start gap-x-4 gap-y-3 overflow-auto p-5">
          {COLS[t].map(c => { const v = form[c[0]] ?? '', on = x => setForm({ ...form, [c[0]]: x }), wide = ['model', 'datasheet_url', 'notes', 'brands', 'name', 'item_label', 'address'].includes(c[0]);
            let inp;
            if (c[2] === 'b') inp = <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand-600" checked={!!v} onChange={e => on(e.target.checked)} />{c[1]}</label>;
            else if (c[2] === 's') inp = <NativeSelect value={v} onChange={e => on(e.target.value)}>{c[3].map(o => <option key={o}>{o}</option>)}</NativeSelect>;
            else if (c[2] === 'sup') inp = <NativeSelect value={v} onChange={e => on(e.target.value)}><option value="">—</option>{D.suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}</NativeSelect>;
            else if (c[2] === 'fk') { const tb = KIND2T[form.item_kind]; inp = <NativeSelect value={v} onChange={e => on(e.target.value)}><option value="">—</option>{tb ? D[tb].map(x => <option key={x.id} value={x.id}>{ctl.label(tb, x)}</option>) : null}</NativeSelect>; }
            else if (c[0] === 'notes') inp = <textarea className="min-h-20 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-brand-500 focus:outline-none" value={v} onChange={e => on(e.target.value)} />;
            else inp = <Input type={c[2] === 'n' ? 'number' : c[2] === 'd' ? 'date' : 'text'} step={c[2] === 'n' ? 'any' : undefined} dir={c[2] === 'n' || c[0] === 'datasheet_url' ? 'ltr' : undefined} value={v} onChange={e => on(e.target.value)} />;
            return <div key={c[0]} className={wide ? 'col-span-2' : ''}>{c[2] !== 'b' && <label className="mb-1 block text-xs font-semibold text-slate-600">{c[1]}</label>}{inp}</div>; })}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
          <Button onClick={save}><Save />حفظ</Button>
          <Button variant="outline" onClick={() => { setEdit(null); setForm(blankFor(t)); setMsg(''); }}><Plus />جديد</Button>
          {edit && <Button variant="danger" onClick={del}><Trash2 />حذف</Button>}
          <span className="ms-auto text-xs text-slate-500">{msg}</span>
        </div>
      </aside>
    </div>, document.body)}
    <div className="flex items-center justify-between text-xs text-slate-500"><span dangerouslySetInnerHTML={{ __html: ctl.out.lgMsg || 'متصل ✓' }} /><Button variant="ghost" size="sm" onClick={() => ctl.logout()}>خروج</Button></div>
  </div>;
}
