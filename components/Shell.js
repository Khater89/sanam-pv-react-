'use client';
import { useState, useEffect } from 'react';
import { LayoutDashboard, FolderKanban, Plus, Database, Search, LogIn, User, Sun, Zap, BatteryCharging, Gauge, ChevronLeft, Trash2, ExternalLink, Filter, Save, Copy, Download, Upload, Printer, Check, MapPin } from 'lucide-react';
import { fmt, CITIES, STATUS, statusOf, TYPE_INFO, BTYPES } from '@/lib/controller';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Input, NativeSelect, Table, Stat, Tabs, TabsList, TabsTrigger } from './ui-kit';
import { readFile } from './ui';
import { cn } from '@/lib/cn';
import { getLang, setLang } from '@/lib/i18n';

const go = (ctl, v) => { ctl.view = v; if (v === 'saved' || v === 'home') { if (ctl.sess) ctl.projList(); } ctl.emit(); };
const cityName = c => (c != null && c !== '' && CITIES[+c]) ? CITIES[+c][0] : '—';
const dateAr = d => d ? new Date(d).toLocaleDateString('en-GB') : '—';
export function TypeBadge({ t }) { const i = TYPE_INFO[t]; return i ? <Badge tone={i[1]}>{i[0]}</Badge> : null; }
export function StatusBadge({ s }) { const i = STATUS[s] || STATUS.draft; return <Badge tone={i[1]} dot>{i[0]}</Badge>; }

/* ---------- top bar + side nav (Field Nation-like chrome) ---------- */
export function TopBar({ ctl }) {
  const [q, setQ] = useState('');
  const [lg, setLg] = useState('ar');
  useEffect(() => setLg(getLang()), []);
  return (
    <header className="fn-shell-chrome noprint sticky top-0 z-40 flex h-14 items-center gap-4 bg-navy px-4 text-white shadow-[0_1px_0_rgba(255,255,255,.06)]">
      <button className="flex items-center gap-2.5 cursor-pointer" onClick={() => go(ctl, 'home')}>
        <img src="/logo.png" alt="" className="h-8 w-auto drop-shadow-[0_0_8px_rgba(245,158,11,.4)]" />
        <span className="text-[17px] font-extrabold tracking-tight">Sanam PV</span>
        <span className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-blue-100 sm:inline">Design</span>
      </button>
      <div className="relative mx-auto hidden w-full max-w-md md:block">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-blue-200/70" />
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { ctl.searchQ = q; go(ctl, 'saved'); } }}
          placeholder="ابحث عن مشروع أو عميل…" className="h-9 w-full rounded-lg border border-white/10 bg-white/10 ps-9 pe-3 text-sm text-white placeholder:text-blue-200/60 focus:bg-white/15 focus:outline-none" />
      </div>
      <div className="ms-auto flex items-center gap-2">
        <button translate="no" title="Language / اللغة" onClick={() => setLang(getLang() === 'en' ? 'ar' : 'en')}
          className="h-8 cursor-pointer rounded-lg border border-white/20 bg-white/10 px-2.5 text-xs font-bold text-white hover:bg-white/20">{lg === 'en' ? 'عربي' : 'EN'}</button>
        <Button variant="accent" size="sm" onClick={() => go(ctl, 'new')}><Plus />مشروع جديد</Button>
        <div className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-blue-100">
          <div className="grid size-8 place-items-center rounded-full bg-white/15"><User className="size-4" /></div>
          <span className="hidden max-w-40 truncate lg:inline">{ctl.sess ? ((ctl.sess.user && ctl.sess.user.email) || ctl.sess.email || 'مسجّل') : 'غير مسجّل'}</span>
        </div>
      </div>
    </header>
  );
}

export function SideNav({ ctl }) {
  const cur = ctl.view;
  const items = [['home', 'لوحة التحكم', LayoutDashboard], ['saved', 'المشاريع', FolderKanban], ['new', 'مشروع جديد', Plus], ['db', 'المعدات والموردين', Database]];
  return (
    <aside className="fn-shell-chrome noprint sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col border-e border-slate-200 bg-white p-3 lg:flex">
      <nav className="flex flex-col gap-0.5">
        {items.map(([k, t, I]) => <button key={k} onClick={() => go(ctl, k)} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition cursor-pointer',
          cur === k || (k === 'saved' && cur === 'work') ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}><I className="size-[18px]" />{t}</button>)}
      </nav>
      {cur === 'work' && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">المشروع المفتوح</div>
        <div className="mt-1 truncate font-bold text-slate-800" translate="no">{ctl.f.pname || 'مشروع'}</div>
        <div className="truncate text-xs text-slate-500" translate="no">{ctl.f.client || '—'}</div>
      </div>}
      <div className="mt-auto rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
        <div className="mb-1 flex items-center gap-1.5 font-bold"><Sun className="size-4" />PVGIS + ثوابت PVsyst</div>
        قوانين هيئة تنظيم قطاع الطاقة: نظام 58/2024 والتعرفة حسب الزمن.
      </div>
    </aside>
  );
}

/* ---------- login card (used when there is no session) ---------- */
function LoginCard({ ctl }) {
  const [e, setE] = useState(''), [p, setP] = useState('');
  return <Card className="mx-auto max-w-md"><CardHeader><CardTitle className="flex items-center gap-2"><LogIn className="size-4" />سجّل دخول عشان تشوف مشاريعك</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <div><label className="mb-1 block text-xs font-semibold text-slate-600">الإيميل</label><Input type="email" dir="ltr" value={e} onChange={x => setE(x.target.value)} /></div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-600">كلمة السر</label><Input type="password" dir="ltr" value={p} onChange={x => setP(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') ctl.login(e, p); }} /></div>
      <div className="flex items-center justify-between"><span className="text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: ctl.out.lgMsg || '' }} /><Button onClick={() => ctl.login(e, p)}><LogIn />دخول</Button></div>
    </CardContent></Card>;
}

/* ---------- projects table (work-order list style) ---------- */
function ProjectsTable({ ctl, rows, compact }) {
  if (!rows.length) return <div className="px-5 py-12 text-center text-sm text-slate-500">ما في مشاريع بهالفلتر.</div>;
  return <Table>
    <thead><tr><th>المشروع</th><th>الحالة</th><th>النوع</th><th className="n">kWp</th>{!compact && <th className="n">AC kW</th>}{!compact && <th className="n">بطارية kWh</th>}<th>الموقع</th><th>آخر تعديل</th><th /></tr></thead>
    <tbody>{rows.map(pj => <tr key={pj.id} onClick={() => ctl.projOpen(pj.id)}>
      <td><div className="font-bold text-slate-900" translate="no">{pj.name}</div><div className="text-xs text-slate-500" translate="no">{pj.client || '—'} · #{pj.id}</div></td>
      <td><StatusBadge s={statusOf(pj)} /></td><td><TypeBadge t={pj.system_type} /></td>
      <td className="n font-semibold text-slate-800">{pj.kwp ? fmt(pj.kwp, 2) : '—'}</td>
      {!compact && <td className="n">{pj.kwac ? fmt(pj.kwac, 2) : '—'}</td>}{!compact && <td className="n">{pj.battery_kwh ? fmt(pj.battery_kwh, 1) : '—'}</td>}
      <td className="text-slate-600"><span className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-slate-400" />{cityName(pj.city)}</span></td>
      <td className="text-slate-500" dir="ltr" style={{ textAlign: 'right' }}>{dateAr(pj.updated_at)}</td>
      <td className="w-20"><div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" title="فتح" onClick={e => { e.stopPropagation(); ctl.projOpen(pj.id); }}><ExternalLink /></Button>
        <Button variant="danger" size="icon" title="حذف" onClick={e => { e.stopPropagation(); if (confirm('حذف المشروع "' + pj.name + '" نهائياً؟')) ctl.projDelete(pj.id); }}><Trash2 /></Button></div></td>
    </tr>)}</tbody>
  </Table>;
}

/* ---------- dashboard ---------- */
export function Dashboard({ ctl }) {
  const P = ctl.PJ, kwp = P.reduce((a, x) => a + (+x.kwp || 0), 0), bat = P.reduce((a, x) => a + (+x.battery_kwh || 0), 0);
  const byS = {}; P.forEach(x => { const s = statusOf(x); byS[s] = (byS[s] || 0) + 1; });
  const byT = {}; P.forEach(x => { byT[x.system_type] = (byT[x.system_type] || 0) + 1; });
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">لوحة التحكم</h1><p className="text-sm text-slate-500">ملخص مشاريع التصميم ومراحلها.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => go(ctl, 'saved')}><FolderKanban />كل المشاريع</Button><Button variant="accent" onClick={() => go(ctl, 'new')}><Plus />مشروع جديد</Button></div>
    </div>
    {!ctl.sess ? <LoginCard ctl={ctl} /> : <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={FolderKanban} label="عدد المشاريع" value={P.length} sub={(byS.designed || 0) + ' مصمم · ' + (byS.draft || 0) + ' مسودة'} />
        <Stat icon={Sun} tone="amber" label="مجموع القدرة المصممة" value={fmt(kwp, 1) + ' kWp'} />
        <Stat icon={BatteryCharging} tone="green" label="مجموع سعة البطاريات" value={fmt(bat, 1) + ' kWh'} />
        <Stat icon={Zap} tone="violet" label="حسب النوع" value={Object.keys(TYPE_INFO).map(k => byT[k] || 0).join(' / ')} sub="مربوط / هجين / منفصل / بدون بطاريات" />
      </div>
      <Card><CardHeader><CardTitle>مراحل المشاريع</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Object.keys(STATUS).map(k => <button key={k} onClick={() => { ctl.filterS = k; go(ctl, 'saved'); }} className="rounded-lg border border-slate-200 p-3 text-start transition hover:border-brand-300 hover:bg-brand-50/40 cursor-pointer">
            <StatusBadge s={k} /><div className="mt-2 text-2xl font-extrabold text-slate-900">{byS[k] || 0}</div></button>)}
        </CardContent></Card>
      <Card><CardHeader><CardTitle>آخر المشاريع</CardTitle><Button variant="ghost" size="sm" onClick={() => go(ctl, 'saved')}>عرض الكل<ChevronLeft /></Button></CardHeader>
        <ProjectsTable ctl={ctl} rows={P.slice(0, 8)} compact /></Card>
    </>}
  </div>;
}

/* ---------- projects list with filters ---------- */
export function ProjectsList({ ctl }) {
  const [q, setQ] = useState(ctl.searchQ || ''), [t, setT] = useState(''), [s, setS] = useState(ctl.filterS || '');
  const rows = ctl.PJ.filter(pj => (!q || ((pj.name || '') + ' ' + (pj.client || '') + ' ' + pj.id).toLowerCase().includes(q.toLowerCase())) && (!t || pj.system_type === t) && (!s || statusOf(pj) === s));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">المشاريع</h1><p className="text-sm text-slate-500">{ctl.PJ.length} مشروع محفوظ.</p></div>
      <div className="flex gap-2">
        <label className="inline-flex"><span className={cn('inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer')}><Upload className="size-4" />فتح ملف JSON</span>
          <input type="file" accept=".json" className="hidden" onChange={async e => { const f = e.target.files[0]; if (f) { ctl.openJSON(await readFile(f)); ctl.view = 'work'; ctl.emit(); } e.target.value = ''; }} /></label>
        <Button variant="accent" onClick={() => go(ctl, 'new')}><Plus />مشروع جديد</Button></div>
    </div>
    {!ctl.sess ? <LoginCard ctl={ctl} /> : <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-3">
        <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input className="ps-9" placeholder="بحث بالاسم أو العميل أو الرقم" value={q} onChange={e => { setQ(e.target.value); ctl.searchQ = e.target.value; }} /></div>
        <div className="flex items-center gap-2"><Filter className="size-4 text-slate-400" />
          <NativeSelect className="w-44" value={t} onChange={e => setT(e.target.value)}><option value="">كل الأنواع</option>{Object.keys(TYPE_INFO).map(k => <option key={k} value={k}>{TYPE_INFO[k][0]}</option>)}</NativeSelect>
          <NativeSelect className="w-40" value={s} onChange={e => { setS(e.target.value); ctl.filterS = e.target.value; }}><option value="">كل المراحل</option>{Object.keys(STATUS).map(k => <option key={k} value={k}>{STATUS[k][0]}</option>)}</NativeSelect></div>
      </div>
      <ProjectsTable ctl={ctl} rows={rows} />
    </Card>}
  </div>;
}

/* ---------- new project wizard ---------- */
const TYPE_CARDS = [
  { k: 'grid', I: Zap, d: 'الألواح والشبكة مع بعض. التحجيم حسب أنظمة الهيئة، والفاتورة بصافي القيمة.', tags: [['شبكة'], ['حدود الهيئة'], ['بطاريات', 1]] },
  { k: 'hybrid', I: Gauge, d: 'شبكة + بطاريات. البطارية بتغطي المسا، والنقص من الشبكة.', tags: [['شبكة'], ['حدود الهيئة'], ['بطاريات']] },
  { k: 'offgrid', I: BatteryCharging, d: 'بدون شبكة متل مدامة. الألواح بتشحن البطاريات وبتغطي الليل.', tags: [['بدون شبكة'], ['أسوأ شهر'], ['بطاريات']] },
  { k: 'offgrid_nb', I: Sun, d: 'الأحمال من الألواح مباشرة وقت الشمس بس (مضخات، أحمال نهارية). حساب البطاريات متوقف.', tags: [['بدون شبكة'], ['نهاري بس'], ['بطاريات', 1]] }];
export function NewProject({ ctl }) {
  const [step, setStep] = useState(1), [name, setName] = useState(''), [client, setClient] = useState(''), [bt, setBt] = useState(''), [mt, setMt] = useState(''), [err, setErr] = useState('');
  const next = () => { if (!name.trim()) return setErr('اكتب اسم المشروع'); if (!client.trim()) return setErr('اكتب اسم العميل'); if (!mt) return setErr('حدد التركيب: على السطح ولا أرضي'); setErr(''); setStep(2); };
  return <div className="mx-auto max-w-3xl space-y-5">
    <div><h1 className="text-2xl font-extrabold tracking-tight text-slate-900">مشروع جديد</h1>
      <div className="mt-3 flex items-center gap-3 text-sm">{[['1', 'بيانات المشروع'], ['2', 'نوع النظام']].map(([n, t], i) => <div key={n} className="flex items-center gap-2">
        <span className={cn('grid size-7 place-items-center rounded-full text-xs font-bold', step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500')}>{step > i + 1 ? <Check className="size-4" /> : n}</span>
        <span className={step === i + 1 ? 'font-bold text-slate-900' : 'text-slate-500'}>{t}</span>{i === 0 && <span className="mx-1 h-px w-10 bg-slate-300" />}</div>)}</div></div>
    {step === 1 ? <Card><CardContent className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="mb-1 block text-xs font-semibold text-slate-600">اسم المشروع *</label><Input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') next(); }} placeholder="مثلاً: فيلا الرابية 15 kWp" /></div>
        <div><label className="mb-1 block text-xs font-semibold text-slate-600">العميل *</label><Input value={client} onChange={e => setClient(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') next(); }} placeholder="اسم العميل أو الشركة" /></div>
      </div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-600">نوع المشروع</label>
        <div className="flex flex-wrap gap-1.5">{BTYPES.map(b => <button key={b[0]} type="button" onClick={() => setBt(bt === b[0] ? '' : b[0])} className={cn('rounded-full border px-3 py-1 text-[13px] cursor-pointer', bt === b[0] ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500')}>{b[1]}</button>)}</div></div>
      <div><label className="mb-1 block text-xs font-semibold text-slate-600">التركيب * <span className="font-normal text-slate-400">(للتأكيد — حتى للبيوت)</span></label>
        <div className="flex flex-wrap gap-1.5">{[['roof', '🏠 على السطح (Rooftop)'], ['ground', '🌾 أرضي (Ground)']].map(b => <button key={b[0]} type="button" onClick={() => setMt(b[0])} className={cn('rounded-full border px-3 py-1 text-[13px] cursor-pointer', mt === b[0] ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-500')}>{b[1]}</button>)}</div></div>
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{err}</div>}
      <div className="flex justify-between"><Button variant="ghost" onClick={() => go(ctl, 'home')}>إلغاء</Button><Button onClick={next}>التالي: نوع النظام<ChevronLeft /></Button></div>
    </CardContent></Card> : <>
      <div className="text-sm text-slate-500"><b className="text-slate-800">{name}</b> · {client} <button className="ms-2 text-brand-600 hover:underline cursor-pointer" onClick={() => setStep(1)}>تعديل</button></div>
      <div className="grid gap-4 sm:grid-cols-2">{TYPE_CARDS.map(c => <button key={c.k} onClick={() => ctl.createProject(name.trim(), client.trim(), c.k, bt, mt)}
        className="group rounded-xl border-2 border-slate-200 bg-white p-5 text-start transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-lg cursor-pointer">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white"><c.I className="size-5" /></div><div><div className="font-bold text-slate-900">{TYPE_INFO[c.k][0]}</div></div></div>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-500">{c.d}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{c.tags.map(([x, no]) => <span key={x} className={cn('rounded-full px-2 py-0.5 text-[11px]', no ? 'bg-orange-50 text-orange-700 line-through' : 'bg-slate-100 text-slate-600')}>{x}</span>)}</div>
      </button>)}</div></>}
  </div>;
}

/* ---------- project detail: header + tabs (work-order details style) ---------- */
const STEPS = [['1', 'المشروع والموقع'], ['2', 'الاتجاه'], ['5', 'الاستهلاك والتعرفة'], ['3', 'النظام والـ Strings'], ['4', 'الخسائر'], ['6', 'المحاكاة والتقرير'], ['8', 'التصميم الكلي']];
export function ProjectHeader({ ctl }) {
  const st = ctl.f.status && STATUS[ctl.f.status] ? ctl.f.status : (ctl.kwpNow() ? 'designed' : 'draft'), done = ctl.steps();
  const kv = [['قدرة الألواح', ctl.kwpNow() ? fmt(ctl.kwpNow(), 2) + ' kWp' : '—'], ['الانفيرتر', ctl.num('iP') ? fmt((ctl.num('nInv') || 1) * ctl.num('iP'), 2) + ' kW' : '—'],
    ['البطاريات (صافي / اسمي)', ctl.batNet() && ctl.num('bN') ? fmt(ctl.batNet().net, 1) + ' / ' + fmt(ctl.batNet().nom, 1) + ' kWh' : '—'], ['الطور', ctl.isOff() ? (ctl.f.iPh === '1ph' ? 'سنغل فيز' : '3 فاز') : (ctl.subPh() === '1ph' ? 'سنغل فيز' : '3 فاز')], ['الموقع', cityName(ctl.f.city)]];
  return <Card className="fn-shell-chrome noprint overflow-hidden">
    <div className="flex flex-wrap items-start gap-4 p-5 pb-4">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"><button className="hover:text-brand-600 cursor-pointer" onClick={() => go(ctl, 'saved')}>المشاريع</button><ChevronLeft className="size-3" /><span>{ctl.curPid ? '#' + ctl.curPid : 'غير محفوظ'}</span></div>
        <input value={ctl.f.pname ?? ''} onChange={e => ctl.input('pname', e.target.value)} className="w-full rounded-md border-0 bg-transparent px-1 py-0.5 -mx-1 shadow-none text-[22px] font-extrabold tracking-tight text-slate-900 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none" />
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input value={ctl.f.client ?? ''} onChange={e => ctl.input('client', e.target.value)} placeholder="العميل" className="w-48 rounded-md border-0 bg-transparent px-1 py-0.5 -mx-1 shadow-none text-sm text-slate-600 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none" />
          <TypeBadge t={ctl.stype()} />
          <select value={st} onChange={e => ctl.input('status', e.target.value)} className="h-7 w-auto appearance-auto rounded-full border border-slate-200 bg-white bg-none px-3 py-0 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer">{Object.keys(STATUS).map(k => <option key={k} value={k}>{STATUS[k][0]}</option>)}</select>
          {!ctl.curPid && <Badge tone="amber">غير محفوظ</Badge>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => ctl.projSave(false)}><Save />حفظ</Button>
        <Button variant="outline" onClick={() => ctl.projSave(true)}><Copy />نسخة</Button>
        <Button variant="outline" onClick={() => ctl.downloadJSON()}><Download />JSON</Button>
        <Button variant="outline" onClick={() => ctl.printReport()}><Printer />تقرير PDF</Button>
      </div>
    </div>
    <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/60 sm:grid-cols-5">
      {kv.map(([k, v]) => <div key={k} className="border-e border-slate-100 px-5 py-2.5 last:border-e-0"><div className="text-[11.5px] font-medium text-slate-500">{k}</div><div className="font-bold text-slate-800">{v}</div></div>)}
    </div>
    <Tabs value={ctl.page === '7' ? '1' : ctl.page} onValueChange={v => ctl.go(v)}>
      <TabsList className="bg-white">
        {STEPS.map(([k, t], i) => <TabsTrigger key={k} value={k}>
          <span className={cn('grid size-5 place-items-center rounded-full text-[10.5px] font-bold', done[k] ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600')}>{done[k] ? <Check className="size-3" /> : i + 1}</span>{t}
          {k === '3' && ctl.sysOk === 'x' && <span className="size-1.5 rounded-full bg-red-500" />}</TabsTrigger>)}
      </TabsList>
    </Tabs>
    {ctl.out.pjMsg ? <div className="border-t border-slate-100 px-5 py-1.5 text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: ctl.out.pjMsg }} /> : null}
  </Card>;
}
