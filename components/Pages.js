'use client';
import { useState } from 'react';
import { Fd, Sel, Picker, Html, Help, readFile } from './ui';
import { CITIES, STYPE_INFO, TARIFFS, BTYPES, MON, IAM_ANG, LOSS_SRC, DESIGN_T_SRC, fmt } from '@/lib/controller';
import { importRows, parseCSV, loadXLSX, TEMPLATE_CSV } from '@/lib/loadsImport';
import { HELP } from '@/lib/help';
import Roof, { FullDesign } from './Roof';
export { FullDesign };

/* system size typed before any drawing: the tool builds the closest real design (modules, strings, inverter) and the roof follows when drawn */
function KwpCard({ ctl }) { const [kw, setKw] = useState(''), [msg, setMsg] = useState('');
  return <div className="card"><h2>⚡ حجم النظام المطلوب <small>Target size</small></h2>
    <div className="r2"><label>kWp<input type="number" step="0.1" min="0" value={kw} onChange={e => setKw(e.target.value)} placeholder={ctl.kwpNow() ? fmt(ctl.kwpNow(), 2) : 'مثلاً 20'} onKeyDown={e => { if (e.key === 'Enter') setMsg(ctl.designKWp(kw).msg); }} /></label>
      <button className="b pri" style={{ alignSelf: 'end' }} onClick={() => setMsg(ctl.designKWp(kw).msg)}>صمّم على هالحجم</button></div>
    <div className="mute" style={{ marginTop: 6 }}>اكتب الحجم قبل الرسم، والبرنامج بيختار عدد الألواح والـ strings والانفيرتر. لما ترسم، الألواح بتتوزع على السطح أو الأرض.</div>
    {msg && <div className={msg[0] === '✓' ? 'info' : 'warn'}>{msg}</div>}</div>; }

/* 1 · project & site */
export function PSite({ ctl }) {
  return (
    <div className="grid">
      <div className="card"><h2>نوع النظام <small>System type</small></h2>
        <Sel ctl={ctl} id="stype" bare options={[['grid', 'مربوط على الشبكة (On-grid)'], ['hybrid', 'هجين: شبكة + بطاريات (Hybrid)'], ['offgrid', 'منفصل عن الشبكة + بطاريات (Off-grid / Stand-alone)'], ['offgrid_nb', 'منفصل بدون بطاريات (Off-grid / PV direct)']]} />
        <div className="mute" style={{ marginTop: 6 }}>{STYPE_INFO[ctl.stype()]}</div>
        <div className="info">الخطوات: اختار نوع النظام والموقع هون، وبعدين الميل والاتجاه بتبويب 2، وبعدين الفواتير (kWh) أو الأحمال بتبويب 3، والبرنامج بيصمم لحاله. التعديل بتبويب 4، والمحاكاة بتبويب 6.</div>
      </div>
      <div className="card"><h2>نوع المشروع <small>Building type</small></h2>
        <Sel ctl={ctl} id="btype" bare options={[['', '— اختار —']].concat(BTYPES.map(b => [b[0], b[1]]))} />
        <div className="mute" style={{ marginTop: 6 }}>بيحدد فئة التعرفة الافتراضية بتبويب 3 (بتقدر تغيّرها هناك).</div>
      </div>
      <KwpCard ctl={ctl} />
      <div className="card"><h2>الموقع الجغرافي <small>Geographical site</small></h2>
        <Sel ctl={ctl} id="city" label="الموقع" options={CITIES.map((c, i) => [String(i), c[0]])} />
        <div className="r2"><Fd ctl={ctl} id="lat" label="خط العرض (°N)" step="0.0001" /><Fd ctl={ctl} id="lon" label="خط الطول (°E)" step="0.0001" /></div>
        <div className="r2"><Fd ctl={ctl} id="tz" label="المنطقة الزمنية" /><Fd ctl={ctl} id="alb" label="Albedo" step="0.05" /></div>
      </div>
      <div className="card"><h2>بيانات الطقس <small>Meteo</small></h2>
        <div className="info">PVGIS 5.3 TMY ساعي (SARAH3 + ERA5) لأي إحداثيات، بيوصل عن طريق سيرفر الموقع نفسه. النموذج معاير على تقرير PVsyst لمشروع مدامة يجوز 2 (VCZ)، والفرق +0.1٪ سنوياً.</div>
        <label>أو حمّل ملف PVGIS JSON (بدون إنترنت)</label>
        <input type="file" accept=".json" onChange={async e => { const f = e.target.files[0]; if (f) ctl.loadWeatherFile(f.name, await readFile(f)); }} />
        <Html html={ctl.out.wInfo} className="mute" />
      </div>
      <div className="card"><h2>إعدادات المشروع <small>Project settings — design temperatures</small></h2>
        <div className="r2"><Fd ctl={ctl} id="tMin" label="أدنى حرارة لحد الجهد المطلق (Voc max) °C" /><Fd ctl={ctl} id="tWin" label="حرارة تشغيل الشتاء (Vmpp max) °C" /></div>
        <div className="r2"><Fd ctl={ctl} id="tSum" label="حرارة تشغيل الصيف (Vmpp min) °C" /><Fd ctl={ctl} id="vSys" label="أقصى جهد للنظام (V)" /></div>
        <div className="mute">{DESIGN_T_SRC}</div>
      </div>
    </div>
  );
}

/* 2 · orientation */
export function POrient({ ctl }) {
  return (<>
    <div className="grid">
      <div className="card"><h2>الاتجاه <small>Orientation — fixed tilted plane</small></h2>
        <div className="r2"><Fd ctl={ctl} id="tilt" label="ميل اللوح (Plane tilt) °" placeholder="مثلاً 20" /><Fd ctl={ctl} id="az" label="الاتجاه (Azimuth) ° — جنوب = 0، غرب +، شرق −" placeholder="جنوب = 0" /></div>
        <div className="mute" style={{ marginTop: 8 }}>نفس تعريف PVsyst. مشروع مدامة (VCZ): ميل 7.5° واتجاه −3.2°.</div>
        <button className="b" style={{ marginTop: 10 }} onClick={() => ctl.optTilt()}>احسب الميل الأمثل (يحتاج بيانات الطقس)</button>
        <Html html={ctl.out.optOut} className="mute" />
      </div>
      <div className="card"><h2>Transposition</h2>
        <table><tbody><tr><td>نموذج النقل</td><td>Perez 1990 — circumsolar separate</td></tr><tr><td>Diffuse</td><td>من PVGIS (Gd(h))، Erbs لما ما يكون في DHI</td></tr><tr><td>Horizon (بعيد)</td><td>PVGIS DEM horizon مضمّن بالإشعاع</td></tr><tr><td>Near shadings</td><td>بتبويب الخسائر، بعد تصميم النظام</td></tr></tbody></table>
      </div>
    </div>
    <div className="card"><h2>رسم السطح لتحديد الاتجاه <small>Roof drawing — Azimuth</small></h2>
      <Roof ctl={ctl} part="az" />
    </div>
  </>);
}

/* 3 · consumption & tariff */
export function PLoads({ ctl }) {
  const [imp, setImp] = useState('');
  const off = ctl.isOff(), T = ctl.loadTotals();
  const onFile = async e => {
    const f = e.target.files[0]; if (!f) return; e.target.value = ''; setImp('<div class="mute">جاري قراءة ' + f.name + '…</div>');
    try {
      let rows;
      if (/\.(csv|txt)$/i.test(f.name)) rows = parseCSV(await readFile(f));
      else { await loadXLSX(); const wb = window.XLSX.read(new Uint8Array(await readFile(f, 'buffer')), { type: 'array' }); rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }); }
      const r = importRows(rows); ctl.loads = r.loads; if (ctl.cmode !== 'loads') ctl.setCmode('loads'); ctl.loadsChanged();
      setImp('<div class="info">انقرأ ' + r.loads.length + ' حمل من الملف' + (r.bad ? ' (تجاهلنا ' + r.bad + ' سطر بدون قدرة)' : '') + '. راجع الجدول وعدّل إذا بدك.</div>' +
        (r.noH.length ? '<div class="warn">' + r.noH.length + ' حمل ما إلهم ساعات تشغيل بالملف (' + r.noH.join('، ') + ')، فحطيناهم شغالين 24 ساعة. عدّل "من" و"إلى" إلهم بالجدول.</div>' : ''));
      ctl.toast('انقرأ ' + r.loads.length + ' حمل ✓', 'ok');
    } catch (x) { setImp('<div class="warn">ما انقرأ الملف: ' + x.message + '</div>'); ctl.toast('ما انقرأ الملف', 'bad'); }
  };
  const tpl = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' })); a.download = 'sanam-loads-template.csv'; a.click(); ctl.toast('نزل النموذج — افتحه بالإكسل وعبّيه', 'ok'); };
  return (<>
    <div className="grid">
      {!off && <div className="card"><h2>آلية الربط والتعرفة</h2>
        <Sel ctl={ctl} id="mech" label="آلية الربط" options={[['netOn', 'صافي القيمة — نفس الموقع'], ['zero', 'التصدير الصفري'], ['sellAll', 'تصدير الكل واستجرار الكل'], ['netOff', 'صافي القيمة — خارج الموقع (≥30 ك.و)']]} />
        <Sel ctl={ctl} id="sector" label="فئة التعرفة" options={TARIFFS} />
        {!ctl.isOff() && ctl.f.sector && ctl.f.sector.indexOf('dom_') === 0 && <>
          <label>اشتراك البيت (الطور) — بيتحدد تلقائياً من الاستهلاك</label>
          <div className={'phase-pill ' + (ctl.subPh() === '1ph' ? 'ph1' : 'ph3')}>{ctl.subPh() === '1ph' ? 'سنغل فيز · حد 3.68 kW · الألواح = الانفيرتر × 1.5' : '3 فاز · حد 11.04 kW · الألواح = الانفيرتر × 1.2'}</div>
          <div className="info" dangerouslySetInnerHTML={{ __html: ctl.phInfo() }} />
        </>}
        <Sel ctl={ctl} id="regime" label="القوانين المطبّقة بالحسابات" options={[['reg58', 'النافذة: نظام 58/2024 + تعرفة الهيئة الحالية'], ['draft26', 'سيناريو: مسودة أيلول 2026 (غير نافذة)']]} />
        {ctl.f.regime === 'draft26' && <div className="warn">مسودة النظام المعدّل (أيلول 2026) لسا مش نافذة لحد ما تنشر بالجريدة الرسمية. استعملها كسيناريو مقارنة بس: شراء الفائض المنزلي 70 فلس مع تخزين ≥ 50٪ من الإنتاج المتوقع (وبين 50 و70 إذا أقل)، وغير المنزلي 50 فلس مع تخزين أكثر من 50٪، وبدلات شبكة جديدة، وقدرة حتى 100٪ من الاستهلاك مع التخزين.</div>}
        <Fd ctl={ctl} id="bands" type="text" dir="ltr" label="شرائح التعرفة — حد:فلس، … (مثال 300:50, 600:100, inf:200)" />
        <div className="r2"><Fd ctl={ctl} id="bb" label="سعر شراء الفائض (فلس/ك.و.س)" /><Fd ctl={ctl} id="fee" label="بدل خدمات الشبكة (دينار/ك.و/شهر)" step="0.5" /></div>
        <div className="mute">{ctl.out.tarsrc}</div>
      </div>}
      <div className="card"><h2>الاستهلاك</h2>
        <div className="tabs"><button className={ctl.cmode === 'bills' ? 'on' : ''} onClick={() => ctl.setCmode('bills')}>12 فاتورة</button><button className={ctl.cmode === 'loads' ? 'on' : ''} onClick={() => ctl.setCmode('loads')}>جدول أحمال</button></div>
        {ctl.cmode === 'bills' ? <div>
          <div className="bills">{MON.map((m, i) => <div key={i}><label>{m}<Help text={HELP['b' + i]} /></label>
            <input type="number" placeholder=" " value={ctl.f['b' + i] ?? ''} onChange={e => ctl.input('b' + i, e.target.value)}
              onPaste={i === 0 ? (e => { if (ctl.pasteBills((e.clipboardData || window.clipboardData).getData('text'))) e.preventDefault(); }) : undefined} /></div>)}</div>
          <div className="mute" style={{ marginTop: 6 }}>أدخل الاستهلاك بالـ <b>ك.و.س (kWh)</b> من الفاتورة، مش بالدينار. بتقدر تدخل فاتورة وحدة بس، أو أكثر، أو الـ 12. الأشهر الفاضية بتنحسب بمعدل الفواتير اللي دخلتها. ولصق 12 رقم من الإكسل بأول خانة بيعبّيهم كلهم.</div>
          {ctl.out.billInfo && ctl.billsFilled() > 0 && <div className="info">{ctl.out.billInfo}</div>}
        </div> : <div>
          <table className="loadtbl"><thead><tr><th>الحمل</th><th>W</th><th>عدد</th><th title="نسبة وقت التشغيل الفعلي خلال الفترة (0–1): مكيف/ثلاجة ≈ 0.5–0.7، إنارة 1">معامل الحمل</th><th>من</th><th>إلى</th><th>حرج</th><th></th><th title="الطاقة اليومية لهذا الحمل">kWh/يوم</th></tr></thead>
            <tbody>{ctl.loads.map((l, i) => <tr key={i}>
              <td><input value={l.n} onChange={e => ctl.editLoad(i, 'n', e.target.value)} /></td>
              <td><input type="number" style={{ width: 70 }} value={l.W} onChange={e => ctl.editLoad(i, 'W', e.target.value)} /></td>
              <td><input type="number" style={{ width: 50 }} value={l.q} onChange={e => ctl.editLoad(i, 'q', e.target.value)} /></td>
              <td><input type="number" min="0" max="1" step="0.05" style={{ width: 55 }} value={l.f} onChange={e => ctl.editLoad(i, 'f', e.target.value)} /></td>
              <td><input type="number" min="0" max="24" style={{ width: 50 }} value={l.a} onChange={e => ctl.editLoad(i, 'a', e.target.value)} /></td>
              <td><input type="number" min="0" max="24" style={{ width: 50 }} value={l.b} onChange={e => ctl.editLoad(i, 'b', e.target.value)} /></td>
              <td><input type="checkbox" style={{ width: 'auto' }} checked={!!l.c} onChange={e => ctl.editLoad(i, 'c', e.target.checked)} /></td>
              <td><button className="sm" onClick={() => ctl.delLoad(i)}>×</button></td>
              <td className="n mute" style={{ whiteSpace: 'nowrap' }}>{fmt(T.rowKWh[i] || 0, 2)}</td></tr>)}</tbody>
            <tfoot><tr className="ltot"><th>المجموع</th><th className="n">{fmt(T.connW, 0)}</th><th className="n">{T.qty}</th><th colSpan="4"></th><th></th><th className="n">{fmt(T.d, 2)}</th></tr></tfoot></table>
          <button className="sm" onClick={() => ctl.addLoad()}>+ حمل</button>{' '}
          <label style={{ display: 'inline-flex', margin: 0 }}><span className="sm" style={{ padding: '3px 9px', border: '1px solid var(--line)', borderRadius: 7, cursor: 'pointer', background: '#fff', color: 'var(--ink)' }}>📥 استيراد ملف أحمال (Excel / CSV)</span>
            <input type="file" accept=".xlsx,.xls,.csv,.txt" className="hid" onChange={onFile} /></label>{' '}
          <button className="sm" onClick={tpl}>⬇ نموذج الملف</button>
          <div className="mute" style={{ marginTop: 4 }}>الملف لازم يكون فيه أعمدة: <b>الحمل، W، العدد، معامل الحمل، من، إلى، حرج</b> (بأي ترتيب، بالعربي أو الإنجليزي). لو بدل "من/إلى" في عمود <b>ساعات</b>، بنعتبر التشغيل من 5 المسا. نزّل النموذج وعبّيه.</div>
          <Html html={imp} />
          <div className="ltots">
            {[['القدرة الموصولة (مجموع W × العدد)', fmt(T.connW / 1000, 2) + ' kW', 'مجموع قدرات كل الأجهزة لو اشتغلت مع بعض. ما بنصمم عليه مباشرة لأنه نادراً ما بيصير، بس بيفيد بحجم القاطع الرئيسي والكوابل ومقارنته مع اشتراك العداد.'],
              ['أعلى حمل متزامن (الذروة)', [fmt(T.pk, 2) + ' kW', 'الساعة ' + T.pkH + ':00'], 'أعلى مجموع أحمال شغالة بنفس الساعة بعد معامل الحمل. هاد اللي بيحدد قدرة الانفيرتر (لازم يغطيه مع هامش 20–25٪ لتيار الإقلاع).'],
              ['الاستهلاك اليومي', fmt(T.d, 2) + ' kWh', 'مجموع W × العدد × الساعات × معامل الحمل. هاد اللي بيحدد عدد الألواح: kWp ≈ الاستهلاك اليومي ÷ (الإنتاج النوعي اليومي × كفاءة النظام).'],
              ['منها بالنهار (7–17)', fmt(T.day, 2) + ' kWh', 'بتنغطى مباشرة من الألواح بدون بطارية. كل ما زادت نسبتها، قلّت البطاريات اللازمة.'],
              ['منها بالليل (17–7)', fmt(T.night, 2) + ' kWh', 'هاي اللي لازم البطاريات تخزنها: السعة الصافية ≥ استهلاك الليل ÷ كفاءة التفريغ، والاسمية = الصافية ÷ (حد الشحن − أدنى SOC).'],
              ['الأحمال الحرجة', [fmt(T.dc, 2) + ' kWh/day', fmt(T.critW / 1000, 2) + ' kW موصول · ليل ' + fmt(T.nightC, 2) + ' kWh'], 'الأحمال اللي لازم تضل شغالة وقت انقطاع الكهرباء أو لما تنزل البطارية. بالهجين بتحدد سعة البطارية الاحتياطية، وبالمنفصل هي اللي بتضل لما تنفصل الأحمال غير الحرجة.'],
              ['شهري / سنوي', fmt(T.d * 30.4, 0) + ' / ' + fmt(T.d * 365, 0) + ' kWh', 'بنقارنه مع فواتير الكهرباء للتأكد إنه جدول الأحمال واقعي، ومنه بتنحسب حدود الهيئة (150 kWh/kW/شهر) والطور (552 kWh/شهر).']].map(([k, v, why]) =>
              <div key={k} className="lt"><div className="lt-k">{k}</div><div className="lt-v" dir="ltr">{Array.isArray(v) ? v[0] : v}</div>{Array.isArray(v) && <div className="lt-s">{v[1]}</div>}<div className="lt-w">{why}</div></div>)}
          </div>
        </div>}
        <Sel ctl={ctl} id="shape" label="شكل الحمل الساعي" options={[['auto', 'تلقائي حسب القطاع'], ['domestic', 'منزلي (ذروة مسائية)'], ['commercial', 'تجاري (نهاري)'], ['industrial', 'صناعي (ورديتين)'], ['flat', 'ثابت']]} />
        <button className="b" style={{ width: '100%', marginTop: 10 }} onClick={() => ctl.autoDesign()}>⚡ تصميم تلقائي: kWp + الانفيرتر + البطاريات</button>
        {ctl.stype() === 'offgrid' && ctl.optRes && ctl.optRes.list && ctl.optRes.list.length > 0 && ctl.optRes.applied == null && <div className="info">⚙ التحسين لقى تصميم أرخص بـ <b>{fmt(ctl.optRes.base.cost - ctl.optRes.list[0].cost, 0)} JD</b>: {ctl.optRes.list[0].nMods} لوح، {ctl.optRes.list[0].n} × {fmt(ctl.optRes.list[0].spec.Pac, 1)} kW، {ctl.optRes.list[0].nb} بطارية، بتغطية {fmt(ctl.optRes.list[0].Y.solFrac * 100, 1)}٪. <button className="sm" onClick={() => ctl.applyOpt(0)}>طبّقه</button> <button className="sm" onClick={() => ctl.go('3')}>شوف كل الخيارات</button></div>}
        <div key={ctl.autoFlash} className={ctl.out.autoRes && ctl.out.autoRes.indexOf('⚡') >= 0 ? 'flash' : ''}><Html html={ctl.out.autoRes} id="autoRes" /></div>
        {ctl.out.autoRes && ctl.out.autoRes.indexOf('⚡') >= 0 && <div style={{ marginTop: 8 }}>
          <button className="b" onClick={() => ctl.go('3')}>شوف/عدّل التصميم ←</button>{' '}
          <button className="b pri" onClick={() => { ctl.go('6'); ctl.run(); }}>شغّل المحاكاة ←</button></div>}
      </div>
    </div>
    {!off && <div className="card"><h2>التحجيم حسب أنظمة الهيئة <small>نظام 58/2024 — للمربوط والهجين المربوط فقط</small></h2><Html html={ctl.out.emrc} /></div>}
  </>);
}

/* 4 · system & strings */
export function PSystem({ ctl }) {
  const off = ctl.isOff();
  return (<>
    <div className="grid">
      <KwpCard ctl={ctl} />
      <div className="card"><h2>اللوح الشمسي <small>PV module — datasheet</small></h2>
        <Picker ctl={ctl} id="modP" />
        <div className="r4"><Fd ctl={ctl} id="mP" label="Pmax W" /><Fd ctl={ctl} id="mVmp" label="Vmp V" step="0.01" /><Fd ctl={ctl} id="mImp" label="Imp A" step="0.01" /><Fd ctl={ctl} id="mVoc" label="Voc V" step="0.01" /></div>
        <div className="r4"><Fd ctl={ctl} id="mIsc" label="Isc A" step="0.01" /><Fd ctl={ctl} id="mB" label="βVoc %/°C" step="0.01" /><Fd ctl={ctl} id="mA" label="αIsc %/°C" step="0.001" /><Fd ctl={ctl} id="mG" label="γPmax %/°C" step="0.01" /></div>
        <div className="r3"><Fd ctl={ctl} id="mL" label="الطول m" step="0.001" /><Fd ctl={ctl} id="mW" label="العرض m" step="0.001" /><Fd ctl={ctl} id="mEff" label="الكفاءة" type="text" disabled value={ctl.modEff()} /></div>
        <div className="mute">القيم الجاهزة نموذجية. عدّلها من الداتا شيت قبل أي تصميم حقيقي.</div>
      </div>
      <div className="card"><h2>الانفيرتر <small>Inverter — datasheet</small></h2>
        <Picker ctl={ctl} id="invP" />
        <div className="r4"><Fd ctl={ctl} id="iP" label="Pnom AC kW" step="0.01" /><Sel ctl={ctl} id="iPh" label="الطور" options={[['3ph', '3 فاز'], ['1ph', '1 فاز']]} /><Fd ctl={ctl} id="iVmax" label="Vmax DC V" /><Fd ctl={ctl} id="iN" label="عدد MPPT" /></div>
        <div className="r4"><Fd ctl={ctl} id="iVmin" label="Vmpp min V" /><Fd ctl={ctl} id="iVmpp" label="Vmpp max V" /><Fd ctl={ctl} id="iI" label="Imax/MPPT A" step="0.1" /><Fd ctl={ctl} id="iIsc" label="Isc max/MPPT A" step="0.1" /></div>
        <div className="r2"><Fd ctl={ctl} id="iMx" label="Max eff %" step="0.1" /><Fd ctl={ctl} id="iEu" label="EURO eff %" step="0.1" /></div>
      </div>
      {ctl.stype() === 'offgrid_nb' && <div className="card nobat-card"><h2>البطاريات <small>غير مستخدمة بهذا النوع</small></h2>
        <div className="nobat">🔋 النوع المختار <b>منفصل بدون بطاريات</b>، فحساب البطاريات (العدد، السعة، SOC، أيام الاستقلالية) متوقف ومش داخل بالمحاكاة ولا بالتكلفة. الأحمال بتشتغل من الألواح وقت الشمس بس.</div>
        <button className="b" style={{ marginTop: 8 }} onClick={() => ctl.input('stype', 'offgrid')}>حوّل لـ "منفصل + بطاريات"</button>
      </div>}
      {ctl.hasBat() && <div className="card"><h2>البطاريات <small>Storage — battery bank</small></h2>
        <Picker ctl={ctl} id="batP" />
        <div className="r4"><Fd ctl={ctl} id="bV" label="جهد الوحدة V" step="0.1" /><Fd ctl={ctl} id="bK" label="سعة الوحدة kWh" step="0.01" /><Fd ctl={ctl} id="bD" label="DoD %" /><Fd ctl={ctl} id="bR" label="RTE %" /></div>
        <div className="r4"><Fd ctl={ctl} id="bI" label="Imax شحن/تفريغ A" /><Fd ctl={ctl} id="bN" label="عدد الوحدات" /><Fd ctl={ctl} id="bSmin" label="SOC أدنى %" /><Fd ctl={ctl} id="bSmax" label="إيقاف الشحن SOC %" /></div>
        <div className="r3"><Fd ctl={ctl} id="bShed" label="فصل غير الحرج تحت SOC %" placeholder="فاضي = بدون فصل" /><Fd ctl={ctl} id="bDays" label="أيام الاستقلالية" step="0.5" placeholder="1" />
          <div><label>&nbsp;</label><button className="b" style={{ width: '100%' }} onClick={() => ctl.batSug()}>اقترح عدد البطاريات</button></div></div>
        <div className="mute">SOC أدنى 10٪ وإيقاف الشحن 96٪ من تقرير PVsyst تبع مدامة. فصل الأحمال غير الحرجة وأيام الاستقلالية إنت بتحددهم (أيام الاستقلالية الفاضية = 1).</div>
        <Html html={ctl.out.batInfo} />
      </div>}
      <div className="card"><h2>المصفوفة <small>Array design</small></h2>
        <div className="r3"><Fd ctl={ctl} id="nInv" label="عدد الانفيرترات" /><Fd ctl={ctl} id="ns" label="ألواح بالـ string (Ns)" /><Fd ctl={ctl} id="nstr" label="strings لكل انفيرتر" /></div>
        <div className="r2"><Fd ctl={ctl} id="dcacT" label={off ? 'DC/AC المستهدف (بدون حد قانوني للمنفصل)' : 'DC/AC المستهدف'} step="0.05" />
          <div><label>&nbsp;</label><button className="b" style={{ width: '100%' }} onClick={() => { ctl.roofFollow(); ctl.autoS(); ctl.syncLater(); }}>توزيع تلقائي للـ strings</button></div></div>
        <button className="b" style={{ width: '100%', marginTop: 8 }} onClick={() => { ctl.roofFollow(); ctl.fromBills(); ctl.syncLater(); }}>{off ? 'حجّم من الأحمال (نظام منفصل — بدون قيود الهيئة)' : 'حجّم من الفواتير حسب أنظمة الهيئة (تبويب 3)'}</button>
        <Html html={ctl.out.sizeMsg} />
      </div>
    </div>
    <div className="card"><h2>فحص الـ Strings <small>PVsyst sizing conditions</small></h2><Html html={ctl.out.sysChk} /></div>
    <div className="card diag-card"><h2>شكل النظام <small>Single-line diagram</small></h2><Html html={ctl.out.diagram || ''} /></div>
    <div className="card"><h2>إعدادات السعر التقديري</h2>
      <div className="r2"><Sel ctl={ctl} id="mount" label="نوع التركيب" options={[['roof', 'على السطح (هيكل عادي)'], ['elevated', 'على السطح — هيكل مرتفع'], ['ground', 'أرضي / مزرعة']]} />
        <Fd ctl={ctl} id="pk" label="معامل السوق (1 = نموذجي، 0.9 = أرخص 10٪)" step="0.05" /></div></div>
    <Html html={ctl.out.price || ''} />
    {(ctl.stype() === 'offgrid' || ctl.stype() === 'hybrid') && <BatCard ctl={ctl} />}
    {ctl.stype() === 'offgrid' && <OptCard ctl={ctl} />}
  </>);
}


function BatCard({ ctl }) {
  const R = ctl.batRes, [busy, setBusy] = useState(false), go = async ap => { setBusy(true); await ctl.batBalance(ap); setBusy(false); if (ap && ctl.repData) ctl.run(); };
  const pct = x => fmt(x * 100, 1) + '%', cur = ctl.num('bN') || 1;
  return <div className="card"><h2>⚖ موازنة البطاريات <small>Battery balance — للألواح والانفيرتر الحاليين</small></h2>
    {R && R.hyb && <div className="info">نظام هجين: كل kWh بيطلع من البطارية بيوفّر سعر الكهرباء من الشبكة ({fmt(R.tariff * 1000, 0)} فلس) ناقص اللي كان رح ينحسبلك لو انصدّر. {R.mech === 'netOn' ? 'بصافي القياس الفائض المصدّر بينحسب بنفس السعر، فالبطارية تقريباً ما بتوفر فلوس: قيمتها احتياط وقت انقطاع الكهرباء. احسب حجمها على الأحمال الحرجة وساعات الانقطاع، مش على التوفير.' : 'قيمة الكيلوواط المخزّن هون = ' + fmt(R.V * 1000, 0) + ' فلس.'} هون الأداة بتنصح بس وما بتغيّر عدد البطاريات لحالها.</div>}
    <div className="mute">بتجرب كل أحجام البنك على نفس الألواح والانفيرتر سنة كاملة، وبتختار اللي بيعطي أعلى صافي: (الطاقة المفيدة بالسنة × عمر البطارية × قيمة الكيلوواط من البديل، متل المولد) ناقص سعر البطاريات، بشرط ما تنزل التغطية الشمسية عن الحد اللي بتحطه. يعني بتزيد بطارية بس إذا بتخزّن فائض بينصرف فعلاً وبتسدّ تمنها، وما بتزيد بطاريات بتخزّن فائض بيضيع.</div>
    <div className="rf-row" style={{ marginTop: 8 }}><label className="rf-f" style={{ maxWidth: 260 }} hidden={ctl.stype() === 'hybrid'}><span>قيمة الكيلوواط من البديل (مولد) JD</span><input type="number" step="0.01" min="0" value={ctl.f.vAlt || 0.3} onChange={e => ctl.input('vAlt', e.target.value)} /></label>
      <label className="rf-f" style={{ maxWidth: 200 }} hidden={ctl.stype() === 'hybrid'}><span>أقل تغطية مقبولة %</span><input type="number" step="0.5" min="50" max="100" value={ctl.f.solMin || 95} onChange={e => ctl.input('solMin', e.target.value)} /></label>
      <label className="rf-f" style={{ maxWidth: 200 }}><span>عمر البطارية (سنة)</span><input type="number" step="1" min="1" value={ctl.f.batLife || 10} onChange={e => ctl.input('batLife', e.target.value)} /></label>
      <button className="b" disabled={busy} onClick={() => go(false)}>{busy ? 'جاري الحساب…' : '⚖ احسب'}</button>
      {R && R.best && R.best.nb !== cur && <button className="b pri" disabled={busy} onClick={() => go(true)}>طبّق {R.best.nb} وحدة</button>}</div>
    {R && R.err && <div className="warn">{R.err}</div>}
    {R && R.best && <>
      <div className={R.best.nb === cur ? 'info' : 'warn'}>{R.best.nb === cur ? '✓ البطاريات الحالية (' + cur + ' وحدة) موزونة مع الألواح.' : 'الأوزن ' + R.best.nb + ' وحدة بدل ' + cur + '.'} بهالبنك: تغطية {pct(R.best.Y.solFrac)}، نقص {fmt(R.best.Y.eMiss, 0)} kWh، فائض ضايع {fmt(R.best.Y.eUnused, 0)} kWh بالسنة.
        {R.pvNeed && R.pvNeed < R.nMods * 0.9 ? <> <b>الألواح:</b> نفس التغطية بتطلع من حوالي {R.pvNeed} لوح بدل {R.nMods}؛ الزيادة بتضيع إلا إذا زدت أحمال نهارية.</> : null}</div>
      <div style={{ overflowX: 'auto' }}><table className="fn-table"><thead><tr><th className="n">البطاريات</th><th className="n">kWh</th><th className="n">التغطية</th><th className="n">E_Miss kWh</th><th className="n">E_Unused kWh</th><th className="n">{R.hyb ? 'توفير من الشبكة kWh' : 'E_User kWh'}</th><th className="n">السعر JD</th><th className="n">الصافي JD</th></tr></thead>
        <tbody>{R.rows.filter(r => r.nb <= Math.max(R.best.nb, cur) + 3).map(r => <tr key={r.nb} className={r === R.best ? 'opt-best' : r.nb === cur ? 'opt-base' : ''}><td className="n">{r.nb}{r === R.best ? ' ⭐' : ''}{r.nb === cur ? ' (الحالي)' : ''}</td><td className="n">{fmt(r.kWh, 1)}</td><td className="n">{pct(r.Y.solFrac)}</td>
          <td className="n">{fmt(r.Y.eMiss, 0)}</td><td className="n">{fmt(r.Y.eUnused, 0)}</td><td className="n">{fmt(R.hyb ? r.gain : r.Y.eUser, 0)}</td><td className="n">{fmt(r.cost, 0)}</td><td className="n">{fmt(r.net, 0)}</td></tr>)}</tbody></table></div></>}
  </div>;
}

function OptCard({ ctl }) {
  const tol = ctl.f.optTol || 1, setTol = x => ctl.input('optTol', x), R = ctl.optRes, win = ctl.num('bSmax') / 100 - ctl.num('bSmin') / 100;
  const pct = x => fmt(x * 100, 1) + '%', Yf = (Y, k) => fmt(Y[k], 0);
  const line = (r, i, isBase) => <tr key={isBase ? 'b' : i} className={isBase ? 'opt-base' : i === 0 ? 'opt-best' : ''}>
    <td>{isBase ? 'التصميم الحالي' : i === 0 ? '⭐ الأوفر' : 'خيار ' + (i + 1)}</td><td className="n">{r.nMods} لوح<div className="mute">{fmt(r.kWp, 2)} kWp</div></td><td>{r.n} × {r.name || '—'}<div className="mute">{fmt(r.kWac, 2)} kWac</div></td>
    <td className="n">{r.nb} × {fmt(r.kWh / r.nb, 2)}<div className="mute">{fmt(r.kWh, 1)} / صافي {fmt(r.kWh * win, 1)} kWh</div></td>
    <td className="n"><b>{fmt(r.cost, 0)}</b>{!isBase && <div className="okc">وفّر {fmt(R.base.cost - r.cost, 0)}</div>}</td>
    <td className="n">{pct(r.Y.solFrac)}</td><td className="n">{Yf(r.Y, 'eMiss')}</td><td className="n">{Yf(r.Y, 'eUnused')}</td><td className="n">{Yf(r.Y, 'eClip')}</td><td className="n">{r.w != null ? fmt(r.w * 100, 1) + '%' : '—'}{!isBase && r.w != null && R.base.w != null ? <div className="mute">{r.w >= R.base.w ? '+' : ''}{fmt((r.w - R.base.w) * 100, 1)}</div> : null}</td>
    <td className="n">{pct(r.Y.eDirect / Math.max(1, r.Y.eLoad))}</td><td className="n">{fmt(r.Y.cycles, 0)}</td>
    <td>{isBase ? '' : <button className="sm" onClick={() => ctl.applyOpt(i)}>{R.applied === i ? '✓ مطبّق' : 'طبّق'}</button>}</td></tr>;
  return <div className="card"><h2>تحسين التكلفة <small>Optimization — منفصل مع بطاريات</small></h2>
    <div className="mute">الأداة بتجرب انفيرترات أصغر، وعدد ألواح أقل (لحد 45٪)، وأصغر بنك بطاريات بيحافظ على التغطية لكل تركيبة، وبتقبل الـ Clipping (قص إنتاج الظهر) لأنه هالفائض أصلاً كان رايح هدر لما البطارية بتتعبّى. الشرط: نسبة التغطية الشمسية ما تنزل أكثر من الحد اللي بتحدده، والانفيرتر ما يقل عن أعلى حمل ساعي × 1.05. الأحمال النهارية بتنغذى من الألواح مباشرة قبل البطارية، فكل ما زادت الأحمال النهارية قلت البطاريات اللازمة.</div>
    <div className="rf-row" style={{ marginTop: 8 }}><label className="rf-f" style={{ maxWidth: 260 }}><span>أقصى نزول بالتغطية الشمسية (نقاط %)</span><input type="number" step="0.5" min="0" value={tol} onChange={e => setTol(e.target.value)} /></label>
      <label className="rf-f" style={{ maxWidth: 250 }}><span>أقصى زيادة بالطاقة الضايعة (نقاط %)</span><input type="number" step="1" min="0" value={ctl.f.wasteTol ?? 5} onChange={e => ctl.input('wasteTol', e.target.value)} /></label>
      <label className="rf-f" style={{ maxWidth: 220 }}><span>أقصى DC/AC مسموح (Clipping)</span><input type="number" step="0.1" min="1" value={ctl.f.dcMaxOG || 2} onChange={e => ctl.input('dcMaxOG', e.target.value)} /></label>
      <button className="b pri" disabled={R && R.busy} onClick={() => ctl.optimize(tol)}>{R && R.busy ? 'جاري التجريب…' : '⚙ احسب أرخص تصميم'}</button></div>
    {R && R.err && <div className="warn">{R.err}</div>}
    {R && R.base && <>
      {R.dropped > 0 && <div className="mute">⚖ استبعدنا {R.dropped} تركيبة أرخص لأنها بتزيد الطاقة الضايعة (الفائض اللي ما بينصرف + القص) أكثر من {fmt(R.wTol * 100, 0)} نقاط عن التصميم الحالي ({fmt(R.base.w * 100, 1)}%).</div>}
      <div className="info">جرّبنا {R.tried} تركيبة (انفيرتر × عدد × بطاريات). أعلى حمل ساعي {fmt(R.peak, 2)} kW، فأصغر انفيرتر مسموح {fmt(R.minAC, 2)} kW.
        {R.list.length ? ' أوفر خيار بيوفّر ' + fmt(R.base.cost - R.list[0].cost, 0) + ' JD (' + fmt((1 - R.list[0].cost / R.base.cost) * 100, 0) + '٪ من تكلفة الألواح والانفيرتر والبطاريات) بتغطية ' + pct(R.list[0].Y.solFrac) + ' بدل ' + pct(R.base.Y.solFrac) + '.' : ' ما في خيار أرخص بنفس التغطية، التصميم الحالي هو الأمثل ضمن الحد.'}</div>
      <div style={{ overflowX: 'auto' }}><table className="opt-t"><thead><tr><th></th><th className="n">الألواح</th><th>الانفيرتر</th><th className="n">البطاريات</th><th className="n">التكلفة JD</th><th className="n">التغطية SolFrac</th><th className="n">نقص E_Miss kWh</th><th className="n">فائض ضايع kWh</th><th className="n">قص دخل PV kWh</th><th className="n">الطاقة الضايعة %<div className="mute">فائض + قص</div></th><th className="n">الأحمال من الألواح مباشرة</th><th className="n">دورات/سنة</th><th></th></tr></thead>
        <tbody>{line(R.base, -1, true)}{R.list.map((r, i) => line(r, i))}</tbody></table></div>
      <div className="mute">التكلفة = الألواح (مع حصتها من الهيكل والكوابل ≈ 0.06 JD/W) + الانفيرتر + البطاريات، من قاعدة الأسعار إذا في سعر، وإلا تقدير السوق (لوح ≈ 0.115 JD/W، هجين ≈ 150 + 105 JD/kW، بطارية LV ≈ 190 وHV ≈ 250 JD/kWh). الانفيرتر بيقص الإنتاج فوق أقصى دخل PV إله (من الداتا شيت، أو 1.3 × قدرته إذا مش معروف)، ونسبة DC/AC مسموحة لحد الحد اللي فوق، والقص بيطلع بعمود "قص دخل PV". بعد ما تطبّق خيار، شغّل المحاكاة من جديد.</div>
      {R.shift && <div className="rf-box" style={{ marginTop: 10 }}><h4>استغلال الإنتاج النهاري للأحمال</h4>
        <div className="mute">بالتصميم الحالي بيضيع بالمعدل {fmt(R.shift.unusedDay, 1)} kWh باليوم من الإنتاج النهاري. أي حمل مرن (مش حرج) بينقل لساعات الشمس بيشتغل من الألواح مباشرة بدل البطارية، فبتقل البطاريات اللازمة.</div>
        {R.shift.list.length ? <><table><thead><tr><th>الحمل</th><th className="n">kWh/يوم</th><th>من</th><th>يصير</th></tr></thead><tbody>{R.shift.list.map(x => <tr key={x.i}><td>{x.n}</td><td className="n">{fmt(x.e, 2)}</td><td dir="ltr">{x.from}</td><td dir="ltr"><b>{x.to}</b></td></tr>)}</tbody></table>
          <button className="b" onClick={() => ctl.applyShift()}>انقل هالأحمال للنهار وأعد التصميم والتحسين</button></> : <div className="mute">ما في أحمال مرنة (غير حرجة، ≤ 7 ساعات، وشغالة برّا 9–16) بتتسع بالفائض. علّم الأحمال الحرجة صح بجدول الأحمال.</div>}
      </div>}
    </>}
  </div>;
}

/* 5 · losses */
export function PLosses({ ctl }) {
  return (<>
    <div className="card"><h2>الظلال القريبة <small>Near shadings — PVsyst method · بعد تصميم النظام</small></h2>
      <Roof ctl={ctl} part="shade" />
    </div>
    <div className="grid">
      <div className="card"><h2>Thermal & soiling</h2>
        <div className="r3"><Fd ctl={ctl} id="Uc" label="Uc W/m²K" step="0.5" /><Fd ctl={ctl} id="Uv" label="Uv W/m²K/(m/s)" step="0.1" /><Fd ctl={ctl} id="abs" label="Absorptance α" step="0.01" /></div>
        <Fd ctl={ctl} id="soil" label="Soiling %" step="0.1" />
      </div>
      <div className="card"><h2>Module & wiring</h2>
        <div className="r2"><Fd ctl={ctl} id="lid" label="LID %" step="0.1" /><Fd ctl={ctl} id="qual" label="Module quality % (سالب = ربح)" step="0.05" /></div>
        <div className="r2"><Fd ctl={ctl} id="mis" label="Mismatch % at MPP" step="0.1" /><Fd ctl={ctl} id="ohm" label="DC ohmic % at STC" step="0.05" /></div>
        <div className="r2"><Fd ctl={ctl} id="acOhm" label="AC ohmic % at STC" step="0.05" /><div className="mute" style={{ alignSelf: 'center' }}>{ctl.f.eAuto !== '0' && ctl.lastE ? 'محسوبة من مقاطع وأطوال الكوابل (تبويب التصميم الكلي)' : 'يدوي'}</div></div>
        <Fd ctl={ctl} id="kIrr" label="PV loss due to irradiance level — معامل k (ln)" step="0.001" />
      </div>
      <div className="card"><h2>IAM <small>Fresnel AR — n 1.526 / 1.290</small></h2>
        <table><tbody><tr><th>θ°</th>{IAM_ANG.map(a => <th key={a} className="n">{a}</th>)}</tr>
          <tr><td>IAM</td>{IAM_ANG.map((a, i) => <td key={a}><input type="number" step="0.001" style={{ width: 58 }} value={ctl.f['iam' + i] ?? ''} onChange={e => ctl.input('iam' + i, e.target.value)} /></td>)}</tr></tbody></table>
        <div className="mute">IAM للإشعاع المنتشر والمنعكس من الأرض: 0.955 (متوسط نصف الكرة لنفس الجدول)</div>
      </div>
    </div>
    <button className="b" onClick={() => { ctl.resetL(); ctl.emit(); }}>رجّع ثوابت PVsyst (مشروع مدامة VCZ)</button> <span className="mute">{LOSS_SRC}</span>
  </>);
}

/* 6 · simulation & report */
export function PReport({ ctl }) {
  return (<>
    <div className="noprint"><button className={'b pri' + (ctl.busy ? ' busy' : '')} disabled={ctl.busy} onClick={() => ctl.run()}>شغّل المحاكاة</button> <span id="status" dangerouslySetInnerHTML={{ __html: ctl.out.status || '' }} /></div>
    {ctl.out.rep ? <Html html={ctl.out.rep} id="rep" onRendered={() => ctl.drawCharts()} />
      : <div className="card mute">جهّز التبويبات 1–5 واضغط &quot;شغّل المحاكاة&quot;. التقرير بيطلع بنفس ترتيب تقرير PVsyst: ملخص المشروع، والنظام، والخسائر، والنتائج الرئيسية، والإنتاج المعياري، ومخطط الخسائر، وبعدها الفاتورة.</div>}
  </>);
}
