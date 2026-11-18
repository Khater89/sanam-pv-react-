'use client';
import { useMemo, useState, useSyncExternalStore, useEffect } from 'react';
import Controller, { fmt } from '@/lib/controller';
import { useRipple, readFile } from './ui';
import { PSite, POrient, PLoads, PSystem, PLosses, PReport } from './Pages';
import DBPage from './DBPage';

const STEPS = [['1', 'المشروع والموقع'], ['2', 'الاتجاه (Tilt / Azimuth)'], ['5', 'الاستهلاك والتعرفة'], ['3', 'النظام والـ Strings'], ['4', 'الخسائر التفصيلية'], ['6', 'المحاكاة والتقرير']];
const TYPES = { grid: 'مربوط', hybrid: 'هجين', offgrid: 'منفصل' };

export default function App() {
  const ctl = useMemo(() => new Controller(), []);
  useSyncExternalStore(ctl.subscribe, ctl.snapshot, ctl.snapshot);
  useEffect(() => { ctl.start(); }, [ctl]);
  useRipple();
  const p = ctl.page;
  return (
    <div id="app">
      <Sidebar ctl={ctl} />
      <div id="main">
        <Header ctl={ctl} />
        <div className="page on" key={p}>
          {p === '1' && <PSite ctl={ctl} />}
          {p === '2' && <POrient ctl={ctl} />}
          {p === '5' && <PLoads ctl={ctl} />}
          {p === '3' && <PSystem ctl={ctl} />}
          {p === '4' && <PLosses ctl={ctl} />}
          {p === '6' && <PReport ctl={ctl} />}
          {p === '7' && <DBPage ctl={ctl} />}
        </div>
      </div>
      <div id="toasts">{ctl.toasts.map(t => <div key={t.id} className={'toast ' + t.k}>{t.t}</div>)}</div>
    </div>
  );
}

function Sidebar({ ctl }) {
  const [q, setQ] = useState('');
  const steps = ctl.steps();
  const items = [];
  if (ctl.curPid == null) items.push({ id: null, name: ctl.f.pname || 'مشروع جديد', client: ctl.f.client, system_type: ctl.stype(), kwp: ctl.kwpNow() || null, unsaved: true });
  ctl.PJ.forEach(pj => { if (!q || ((pj.name || '') + ' ' + (pj.client || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0 || pj.id === ctl.curPid) items.push(pj); });
  const nav = (
    <nav id="nav">
      {STEPS.map(([k, t]) => <button key={k} className={(ctl.page === k ? 'on ' : '') + (steps[k] ? 'done' : '')} onClick={() => ctl.go(k)}>
        <i className="st" />{t}{k === '3' && ctl.sysOk ? <span className={ctl.sysOk}>{ctl.sysOk === 'ok' ? ' ✓' : ' ✗'}</span> : null}</button>)}
    </nav>
  );
  return (
    <aside id="side">
      <div className="logo"><img src="/logo.png" alt="Sanam" style={{ width: 54, height: 'auto', filter: 'drop-shadow(0 0 10px rgba(245,158,11,.35))' }} /><div>Sanam PV<small>Design Tool — الأردن</small></div></div>
      <button className="newp" onClick={() => ctl.projNew()}>＋ مشروع جديد</button>
      <input id="pjQ" placeholder="🔍 بحث بالمشاريع أو العملاء" value={q} onChange={e => setQ(e.target.value)} />
      <div id="tree">
        {items.map(pj => { const cur = pj.unsaved || pj.id === ctl.curPid;
          return (
            <div key={pj.id == null ? 'new' : pj.id} className={'node' + (cur ? ' cur' : '')}>
              <div className="nh" onClick={() => { if (!cur) ctl.projOpen(pj.id); }}>
                <span className="chev">◀</span>
                <span className="nm">{pj.name || 'مشروع'}<span className="meta">{pj.unsaved ? 'غير محفوظ' : (pj.client || '')}{pj.kwp ? ' · ' + fmt(pj.kwp, 2) + ' kWp' : ''}</span></span>
                <span className={'bdg t-' + (pj.system_type || '')}>{TYPES[pj.system_type] || ''}</span>
                {pj.id != null && <button className="del" title="حذف المشروع" onClick={e => { e.stopPropagation(); if (confirm('حذف المشروع "' + pj.name + '" نهائياً؟')) ctl.projDelete(pj.id); }}>×</button>}
              </div>
              {cur && nav}
            </div>
          ); })}
        {!ctl.PJ.length && ctl.sess && <div className="mute" style={{ padding: '4px 10px', color: '#8fb0cf' }}>ما في مشاريع محفوظة لسا. اضغط &quot;حفظ&quot; فوق.</div>}
      </div>
      <div className="side-foot">
        <button className={'dbb' + (ctl.page === '7' ? ' on' : '')} onClick={() => ctl.go('7')}>🗄️ قاعدة البيانات والموردين {ctl.dbOk ? <span className={ctl.dbOk}>{ctl.dbOk === 'ok' ? '✓' : '!'}</span> : null}</button>
        <div className="mute" dangerouslySetInnerHTML={{ __html: ctl.out.pjMsg || '' }} />
      </div>
    </aside>
  );
}

function Header({ ctl }) {
  return (
    <header>
      <input id="pname" placeholder="اسم المشروع" value={ctl.f.pname ?? ''} onChange={e => ctl.input('pname', e.target.value)} />
      <input id="client" placeholder="العميل" value={ctl.f.client ?? ''} onChange={e => ctl.input('client', e.target.value)} />
      <div className="sp" />
      <button className="hp" onClick={() => ctl.projSave(false)}>💾 حفظ</button>
      <button onClick={() => ctl.projSave(true)}>⧉ نسخة</button>
      <button onClick={() => ctl.downloadJSON()}>⬇ JSON</button>
      <label style={{ margin: 0 }}><span className="hbtn">📂 فتح ملف</span>
        <input type="file" accept=".json" className="hid" onChange={async e => { const f = e.target.files[0]; if (f) ctl.openJSON(await readFile(f)); e.target.value = ''; }} /></label>
      <button onClick={() => window.print()}>🖨 تقرير PDF</button>
    </header>
  );
}
