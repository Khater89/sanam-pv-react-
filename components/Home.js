'use client';
import { useState } from 'react';
import { fmt } from '@/lib/controller';

const TYPE_CARDS = [
  { k: 'grid', ic: '🔌', t: 'مربوط على الشبكة', en: 'On-grid', d: 'الألواح والشبكة مع بعض. التحجيم حسب أنظمة الهيئة، والفاتورة بصافي القيمة.', tags: [['شبكة'], ['حدود الهيئة'], ['بطاريات', 1]] },
  { k: 'hybrid', ic: '⚡', t: 'هجين', en: 'Hybrid: grid + battery', d: 'شبكة + بطاريات. البطارية بتغطي المسا، والنقص من الشبكة.', tags: [['شبكة'], ['حدود الهيئة'], ['بطاريات']] },
  { k: 'offgrid', ic: '🏝️', t: 'منفصل + بطاريات', en: 'Off-grid / Stand-alone', d: 'بدون شبكة متل مدامة. الألواح بتشحن البطاريات وبتغطي الليل.', tags: [['بدون شبكة'], ['أسوأ شهر'], ['بطاريات']] },
  { k: 'offgrid_nb', ic: '☀️', t: 'منفصل بدون بطاريات', en: 'Off-grid / PV direct', d: 'الأحمال بتشتغل من الألواح مباشرة وقت الشمس بس (مضخات، أحمال نهارية). حساب البطاريات متوقف.', tags: [['بدون شبكة'], ['نهاري بس'], ['بطاريات', 1]] }
];
export const TYPE_AR = { grid: 'مربوط', hybrid: 'هجين', offgrid: 'منفصل + بطاريات', offgrid_nb: 'منفصل بدون بطاريات' };
const go = (ctl, v) => { ctl.view = v; ctl.emit(); };

function Logo() {
  return <div className="landlogo"><img src="/logo.png" alt="Sanam" /><h1>Sanam PV<small>Design Tool — الأردن</small></h1></div>;
}

export function Home({ ctl }) {
  return (
    <div className="landwrap">
      <Logo />
      <p className="landsub">تصميم أنظمة الطاقة الشمسية: مربوط، هجين، ومنفصل، على بيانات PVGIS وثوابت PVsyst.</p>
      <div className="bigbtns">
        <button className="bigbtn pri" onClick={() => go(ctl, 'new')}><span className="ic">＋</span><b>مشروع جديد</b><span>اسم المشروع والعميل، وبعدين نوع النظام</span></button>
        <button className="bigbtn" onClick={() => { if (ctl.sess) ctl.projList(); go(ctl, 'saved'); }}><span className="ic">📂</span><b>المشاريع المخزّنة</b>
          <span>{ctl.sess ? (ctl.PJ.length ? ctl.PJ.length + ' مشروع محفوظ' : 'افتح مشروع محفوظ') : 'سجّل دخول عشان تشوفها'}</span></button>
      </div>
      <div className="landfoot"><button onClick={() => go(ctl, 'db')}>🗄️ قاعدة البيانات والموردين</button></div>
    </div>
  );
}

export function NewProject({ ctl }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [err, setErr] = useState('');
  const next = () => { if (!name.trim()) { setErr('اكتب اسم المشروع'); return; } if (!client.trim()) { setErr('اكتب اسم العميل'); return; } setErr(''); setStep(2); };
  return (
    <div className="landwrap">
      <button className="back" onClick={() => step === 2 ? setStep(1) : go(ctl, 'home')}>→ {step === 2 ? 'رجوع' : 'الرئيسية'}</button>
      <div className="wz">
        {step === 1 ? <>
          <h2>مشروع جديد</h2><div className="stepn">الخطوة 1 من 2 — بيانات المشروع</div>
          <div className="row">
            <div><label>اسم المشروع *</label><input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') next(); }} placeholder="مثلاً: فيلا الرابية 15 kWp" /></div>
            <div><label>العميل *</label><input value={client} onChange={e => setClient(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') next(); }} placeholder="اسم العميل أو الشركة" /></div>
          </div>
          {err && <div className="warn" style={{ marginTop: 10 }}>{err}</div>}
          <div className="act"><span /><button className="b pri" onClick={next}>التالي: نوع النظام ←</button></div>
        </> : <>
          <h2>نوع النظام</h2><div className="stepn">الخطوة 2 من 2 — <b>{name}</b> · {client}</div>
          <div className="types">
            {TYPE_CARDS.map(c => <button key={c.k} className="tcard" onClick={() => ctl.createProject(name.trim(), client.trim(), c.k)}>
              <span className="ic">{c.ic}</span><b>{c.t}</b><span>{c.en}</span><span style={{ marginTop: 6 }}>{c.d}</span>
              <div className="tags">{c.tags.map(t => <i key={t[0]} className={t[1] ? 'no' : ''}>{t[0]}</i>)}</div></button>)}
          </div>
        </>}
      </div>
    </div>
  );
}

export function SavedProjects({ ctl }) {
  const [q, setQ] = useState('');
  const [lg, setLg] = useState({ e: '', p: '' });
  const L = ctl.PJ.filter(pj => !q || ((pj.name || '') + ' ' + (pj.client || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0);
  return (
    <div className="landwrap">
      <button className="back" onClick={() => go(ctl, 'home')}>→ الرئيسية</button>
      <div className="wz">
        <h2>المشاريع المخزّنة</h2>
        {!ctl.sess ? <>
          <div className="stepn">سجّل دخول على حسابك عشان تفتح مشاريعك.</div>
          <div className="row"><div><label>الإيميل</label><input type="email" dir="ltr" value={lg.e} onChange={e => setLg({ ...lg, e: e.target.value })} /></div>
            <div><label>كلمة السر</label><input type="password" dir="ltr" value={lg.p} onChange={e => setLg({ ...lg, p: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') ctl.login(lg.e, lg.p); }} /></div></div>
          <div className="act"><span className="mute" dangerouslySetInnerHTML={{ __html: ctl.out.lgMsg || '' }} /><button className="b pri" onClick={() => ctl.login(lg.e, lg.p)}>دخول</button></div>
        </> : <>
          <input placeholder="🔍 بحث بالمشاريع أو العملاء" value={q} onChange={e => setQ(e.target.value)} />
          <div className="plist">
            {L.map(pj => <div key={pj.id} className="pitem" onClick={() => ctl.projOpen(pj.id)}>
              <div className="nm"><b>{pj.name}</b><small>{pj.client || '—'}{pj.kwp ? ' · ' + fmt(pj.kwp, 2) + ' kWp' : ''}{pj.battery_kwh ? ' · ' + fmt(pj.battery_kwh, 1) + ' kWh' : ''}{pj.updated_at ? ' · ' + pj.updated_at.slice(0, 10) : ''}</small></div>
              <span className={'tb t-' + (pj.system_type || '')}>{TYPE_AR[pj.system_type] || ''}</span>
              <button className="del" title="حذف" onClick={e => { e.stopPropagation(); if (confirm('حذف المشروع "' + pj.name + '" نهائياً؟')) ctl.projDelete(pj.id); }}>×</button>
            </div>)}
            {!L.length && <div className="mute">{ctl.PJ.length ? 'ما في نتائج.' : 'ما في مشاريع محفوظة لسا.'}</div>}
          </div>
        </>}
      </div>
    </div>
  );
}
