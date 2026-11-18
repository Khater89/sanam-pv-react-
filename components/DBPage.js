'use client';
import { useState, useMemo } from 'react';
import { COLS, TITLES, KIND2T, fmt } from '@/lib/controller';

const blankFor = tt => { const o = {}; COLS[tt].forEach(c => { o[c[0]] = c[0] === 'quoted_on' ? new Date().toISOString().slice(0, 10) : c[0] === 'unit' ? 'unit' : c[2] === 's' ? c[3][0] : c[2] === 'b' ? false : ''; }); return o; };

/* 7 · equipment / suppliers / prices database (Supabase) */
export default function DBPage({ ctl }) {
  const [t, setT] = useState('modules');
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(() => blankFor('modules'));
  const [msg, setMsg] = useState('');
  const [lg, setLg] = useState({ e: '', p: '' });
  const rows = ctl.DB[t] || [];
  const blank = () => blankFor(t);
  const pick = (tt, r) => { const o = {}; COLS[tt].forEach(c => { o[c[0]] = r[c[0]] == null ? (c[2] === 'b' ? false : '') : r[c[0]]; }); setForm(o); };
  const sw = tt => { setT(tt); setEdit(null); setMsg(''); setForm(blankFor(tt)); };
  const show = t === 'prices' ? ['البند', 'المورد', 'السعر', 'الوحدة', 'التاريخ'] : t === 'suppliers' ? ['المورد', 'المدينة', 'الماركات', 'الهاتف'] : ['الماركة', 'الموديل', t === 'modules' ? 'Pmax' : t === 'inverters' ? 'kW / الطور / النوع' : 'kWh / V', 'أقل سعر JD', '✓'];
  const list = useMemo(() => rows.filter(r => !q || JSON.stringify(r).toLowerCase().indexOf(q.toLowerCase()) >= 0 || (t === 'prices' && ctl.itemLabel(r).toLowerCase().indexOf(q.toLowerCase()) >= 0)), [rows, q, t, ctl.ver]);
  const cells = r => {
    if (t === 'prices') { const sp = ctl.DB.suppliers.filter(x => x.id === r.supplier_id)[0]; return [ctl.itemLabel(r), sp ? sp.name : '—', fmt(r.price_jod, 3), r.unit, r.quoted_on || '']; }
    if (t === 'suppliers') return [r.name, r.city || '', r.brands || '', r.phone || ''];
    const k = t === 'modules' ? 'module' : t === 'inverters' ? 'inverter' : 'battery', bp = ctl.bestPrice(k, r.id);
    return [r.brand, r.model, t === 'modules' ? r.pmax_w + ' W' : t === 'inverters' ? r.pac_kw + ' kW / ' + r.phase + ' / ' + r.kind : r.capacity_kwh + ' kWh / ' + r.voltage_nom + ' V', bp ? fmt(bp.p.price_jod, 2) + (bp.p.unit !== 'unit' ? '/' + bp.p.unit : '') : '—', r.verified ? '✓' : '⚠'];
  };
  const save = () => { const body = {}; COLS[t].forEach(c => { const v = form[c[0]]; body[c[0]] = c[2] === 'b' ? !!v : (c[2] === 'n' || c[2] === 'fk' || c[2] === 'sup') ? (v === '' || v == null ? null : +v) : (v === '' ? null : v); });
    setMsg('جاري الحفظ…'); ctl.dbSave(t, edit, body).then(row => { if (row) setEdit(row.id); setMsg('تم الحفظ ✓'); }).catch(e => setMsg('خطأ: ' + e.message)); };
  const del = () => { if (!edit) return; const r = rows.filter(x => x.id === edit)[0]; if (!confirm('حذف "' + ctl.label(t, r) + '" نهائياً؟')) return;
    ctl.dbDelete(t, edit).then(() => { setEdit(null); setForm(blank()); setMsg('انحذف'); }).catch(e => setMsg('خطأ: ' + e.message)); };
  const cur = edit ? rows.filter(x => x.id === edit)[0] : null;
  return (<>
    <div className="card lgbox"><h2>تسجيل الدخول <small>Supabase — قاعدة المعدات والأسعار والمشاريع</small></h2>
      {ctl.sess ? <div><span className="mute" dangerouslySetInnerHTML={{ __html: ctl.out.lgMsg || 'متصل ✓' }} /> <button className="b" onClick={() => ctl.logout()}>خروج</button></div> : <>
        <div className="r3"><div><label>الإيميل</label><input type="email" dir="ltr" value={lg.e} onChange={e => setLg({ ...lg, e: e.target.value })} /></div>
          <div><label>كلمة السر</label><input type="password" dir="ltr" value={lg.p} onChange={e => setLg({ ...lg, p: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') ctl.login(lg.e, lg.p); }} /></div>
          <div><label>&nbsp;</label><button className="b pri" style={{ width: '100%' }} onClick={() => ctl.login(lg.e, lg.p)}>دخول</button></div></div>
        <div style={{ marginTop: 6 }}><button className="b" onClick={() => ctl.signup(lg.e, lg.p)}>إنشاء حساب (أول مرة)</button> <span className="mute" dangerouslySetInnerHTML={{ __html: ctl.out.lgMsg || '' }} /></div></>}
    </div>
    <div className="tabs">{Object.keys(TITLES).map(k => <button key={k} className={t === k ? 'on' : ''} onClick={() => sw(k)}>{TITLES[k].replace(' المحليين', '')}</button>)}</div>
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)' }}>
      <div className="card"><h2>{TITLES[t]} ({rows.length})</h2>
        <input placeholder="بحث…" style={{ marginBottom: 8 }} value={q} onChange={e => setQ(e.target.value)} />
        <div style={{ maxHeight: 640, overflow: 'auto' }}>
          {!ctl.sess ? <div className="mute">سجّل دخول عشان تشوف قاعدة البيانات وتعدّل عليها.</div> :
            <table><thead><tr>{show.map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>
              {list.map(r => <tr key={r.id} style={{ cursor: 'pointer', background: edit === r.id ? '#fff6e5' : undefined }} onClick={() => { setEdit(r.id); pick(t, r); setMsg(''); }}>
                {cells(r).map((x, i) => <td key={i}>{x}</td>)}</tr>)}</tbody></table>}
        </div>
      </div>
      <div className="card"><h2>{cur ? 'تعديل: ' + ctl.label(t, cur) : 'إضافة ' + TITLES[t]}</h2>
        {COLS[t].map(c => { const v = form[c[0]] ?? ''; const on = x => setForm({ ...form, [c[0]]: x });
          let inp;
          if (c[2] === 'b') inp = <input type="checkbox" style={{ width: 'auto' }} checked={!!v} onChange={e => on(e.target.checked)} />;
          else if (c[2] === 's') inp = <select value={v} onChange={e => on(e.target.value)}>{c[3].map(o => <option key={o}>{o}</option>)}</select>;
          else if (c[2] === 'sup') inp = <select value={v} onChange={e => on(e.target.value)}><option value="">—</option>{ctl.DB.suppliers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}</select>;
          else if (c[2] === 'fk') { const tb = KIND2T[form.item_kind]; inp = <select value={v} onChange={e => on(e.target.value)}><option value="">—</option>{tb ? ctl.DB[tb].map(x => <option key={x.id} value={x.id}>{ctl.label(tb, x)}</option>) : null}</select>; }
          else inp = <input type={c[2] === 'n' ? 'number' : c[2] === 'd' ? 'date' : 'text'} step={c[2] === 'n' ? 'any' : undefined} value={v} onChange={e => on(e.target.value)} />;
          return <div key={c[0]}><label>{c[1]}</label>{inp}</div>; })}
        <div style={{ marginTop: 10 }}><button className="b pri" disabled={!ctl.sess} onClick={save}>حفظ</button>{' '}
          <button className="b" onClick={() => { setEdit(null); setForm(blank()); setMsg(''); }}>جديد</button>{' '}
          <button className="b" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} disabled={!edit} onClick={del}>حذف</button></div>
        <div className="mute" style={{ marginTop: 6 }}>{msg}</div>
      </div>
    </div>
  </>);
}
