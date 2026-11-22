/* Sanam PV — app controller.
   All design logic of the single-file version (sanam-pv.html v0.6), ported 1:1:
   DOM reads/writes became a field store (this.f) and HTML outputs (this.out) that React renders.
   The calculation engine (lib/engine) is unchanged. */
import C from './engine/pv-core';
import PG from './engine/pvgis';
import J from './engine/jo-rules';
import S from './engine/pv-system';
import * as PR from './engine/price';
import * as RF from './engine/roof';
import * as EL from './engine/elec';

export const MON = ['ك2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'ت1', 'ت2', 'ك1'];
export const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const CITIES = [['الرصيفة (مدامة)', 32.0175, 36.0435], ['عمّان', 31.9539, 35.9106], ['الزرقاء', 32.0728, 36.0880], ['إربد', 32.5556, 35.8500], ['المفرق', 32.3429, 36.2080],
  ['السلط', 32.0392, 35.7272], ['مادبا', 31.7160, 35.7939], ['الكرك', 31.1853, 35.7048], ['الطفيلة', 30.8375, 35.6044], ['معان', 30.1962, 35.7341],
  ['العقبة', 29.5321, 35.0063], ['الأغوار — دير علا', 32.1960, 35.6200], ['الأزرق', 31.8800, 36.8300], ['يدوي…', null, null]];
export const STYPE_INFO = {
  grid: 'نظام مربوط: الفائض بيتعامل حسب آلية الربط (صافي القيمة، أو التصدير الصفري، أو غيرها) والتعرفة بتبويب 3.',
  hybrid: 'هجين: البطاريات بتغطي الاستهلاك المسائي، والنقص من الشبكة. الفائض بعد شحن البطارية بيتصدّر حسب آلية الربط، وبالتصدير الصفري بينقطع. الهيئة ما بتحسب سعة البطارية من الاستطاعة المسموحة.',
  offgrid_nb: 'منفصل بدون بطاريات (PV direct): الأحمال بتشتغل من الألواح مباشرة وقت الشمس بس، متل مضخات المياه والأحمال النهارية. ما في بطاريات، فكل حمل بالليل أو وقت الغيم بيطلع E_Miss. ما بتنطبق عليه أنظمة الهيئة. التحجيم على الأحمال النهارية (7:00–17:00) بأسوأ شهر.',
  offgrid: 'منفصل (Stand-alone) متل مدامة: الأحمال من الألواح والبطاريات بس. ما بتنطبق عليه أنظمة الهيئة (حد الاستطاعة، 16 أمبير، DC/AC، بدل الشبكة) لأنه مش مربوط. المحاكاة بتحسب E_Miss وE_Unused ونسبة التغطية الشمسية وفصل الأحمال غير الحرجة. جدول الأحمال بتبويب 3 لازم يكون فيه ساعات التشغيل.'
};
export const COLS = {
  modules: [['brand', 'الماركة'], ['model', 'الموديل'], ['pmax_w', 'Pmax W', 'n'], ['vmp', 'Vmp V', 'n'], ['imp', 'Imp A', 'n'], ['voc', 'Voc V', 'n'], ['isc', 'Isc A', 'n'], ['beta_voc', 'βVoc %/°C', 'n'], ['alpha_isc', 'αIsc %/°C', 'n'], ['gamma_p', 'γPmax %/°C', 'n'], ['length_m', 'الطول m', 'n'], ['width_m', 'العرض m', 'n'], ['technology', 'التقنية'], ['bifacial', 'Bifacial', 'b'], ['datasheet_url', 'رابط الداتا شيت'], ['verified', 'متحقق من الداتا شيت', 'b'], ['notes', 'ملاحظات']],
  inverters: [['brand', 'الماركة'], ['model', 'الموديل'], ['kind', 'النوع', 's', ['grid', 'hybrid', 'offgrid']], ['phase', 'الطور', 's', ['3ph', '1ph']], ['pac_kw', 'Pnom AC kW', 'n'], ['pdc_max_kw', 'أقصى قدرة PV kW', 'n'], ['vmax_dc', 'Vmax DC', 'n'], ['vmpp_min', 'Vmpp min', 'n'], ['vmpp_max', 'Vmpp max', 'n'], ['n_mppt', 'عدد MPPT', 'n'], ['imax_mppt', 'Imax/MPPT A', 'n'], ['isc_mppt', 'Isc/MPPT A', 'n'], ['max_eff', 'Max eff %', 'n'], ['euro_eff', 'EURO eff %', 'n'], ['batt_v_min', 'بطارية V min', 'n'], ['batt_v_max', 'بطارية V max', 'n'], ['batt_i_max', 'بطارية I max A', 'n'], ['datasheet_url', 'رابط الداتا شيت'], ['verified', 'متحقق', 'b'], ['notes', 'ملاحظات']],
  batteries: [['brand', 'الماركة'], ['model', 'الموديل'], ['chemistry', 'الكيمياء'], ['voltage_nom', 'الجهد V', 'n'], ['capacity_kwh', 'السعة kWh', 'n'], ['usable_kwh', 'المتاح kWh', 'n'], ['capacity_ah', 'Ah', 'n'], ['max_charge_a', 'شحن max A', 'n'], ['max_discharge_a', 'تفريغ max A', 'n'], ['dod_pct', 'DoD %', 'n'], ['cycles', 'دورات', 'n'], ['rte_pct', 'RTE %', 'n'], ['hv', 'جهد عالي HV', 'b'], ['datasheet_url', 'رابط الداتا شيت'], ['verified', 'متحقق', 'b'], ['notes', 'ملاحظات']],
  protections: [['kind', 'النوع', 's', ['MCB', 'MCCB', 'ACB', 'RCBO', 'RCCB', 'ELR', 'gPV', 'DCMCB', 'DCMCCB', 'NH', 'SPD_AC', 'SPD_DC', 'ISO_DC', 'ISO_AC']], ['brand', 'الماركة'], ['model', 'الموديل'], ['poles', 'عدد الأقطاب', 'n'], ['rated_a', 'التيار In A', 'n'], ['icu_ka', 'قدرة القطع kA', 'n'], ['voltage', 'الجهد'], ['curve', 'المنحنى'], ['sens_ma', 'حساسية mA', 'n'], ['rcd_type', 'نوع التسرب (AC/A/B)'], ['spd_class', 'صنف SPD'], ['standard', 'المعيار'], ['supplier_id', 'المورد', 'sup'], ['price_jod', 'السعر JD', 'n'], ['quoted_on', 'تاريخ السعر', 'd'], ['source', 'المصدر'], ['verified', 'متحقق', 'b'], ['notes', 'ملاحظات']],
  cables: [['kind', 'النوع', 's', ['dc_pv', 'ac', 'battery', 'earth']], ['type', 'نوع الكابل'], ['cores', 'عدد الأقطاب', 'n'], ['size_mm2', 'المقطع mm²', 'n'], ['voltage', 'الجهد'], ['conductor', 'الموصل'], ['insulation', 'العزل'], ['brand', 'الماركة'], ['supplier_id', 'المورد', 'sup'], ['price_jod_m', 'السعر JD/m', 'n'], ['ampacity_a', 'التحمّل A', 'n'], ['standard', 'المعيار'], ['quoted_on', 'تاريخ السعر', 'd'], ['source', 'المصدر'], ['verified', 'متحقق', 'b'], ['notes', 'ملاحظات']],
  suppliers: [['name', 'اسم المورد'], ['city', 'المدينة'], ['address', 'العنوان'], ['phone', 'الهاتف'], ['contact', 'الشخص المسؤول'], ['website', 'الموقع'], ['brands', 'الماركات'], ['notes', 'ملاحظات']],
  prices: [['item_kind', 'نوع البند', 's', ['module', 'inverter', 'battery', 'other']], ['item_id', 'البند', 'fk'], ['item_label', 'وصف (لنوع other)'], ['supplier_id', 'المورد', 'sup'], ['price_jod', 'السعر JD', 'n'], ['unit', 'الوحدة', 's', ['unit', 'W', 'kWh', 'm', 'set']], ['incl_tax', 'شامل الضريبة', 'b'], ['quoted_on', 'تاريخ عرض السعر', 'd'], ['notes', 'ملاحظات']]
};
export const TITLES = { modules: 'الألواح', inverters: 'الانفيرترات', batteries: 'البطاريات', cables: 'الكوابل', protections: 'الحمايات', suppliers: 'الموردين المحليين', prices: 'الأسعار' };
export const KIND2T = { module: 'modules', inverter: 'inverters', battery: 'batteries' };
 /* project pipeline status (stored in data.fields.status) */
export const STATUS = { draft: ['مسودة', 'slate'], designed: ['تم التصميم', 'blue'], quoted: ['عرض سعر مُرسل', 'violet'], won: ['تم الاتفاق', 'teal'], installed: ['تم التركيب', 'green'], lost: ['ملغي', 'red'] };
export function statusOf(pj) { return pj.status && STATUS[pj.status] ? pj.status : (pj.kwp ? 'designed' : 'draft'); }
export const TYPE_INFO = { grid: ['مربوط', 'blue'], hybrid: ['هجين', 'violet'], offgrid: ['منفصل + بطاريات', 'green'], offgrid_nb: ['منفصل بدون بطاريات', 'orange'] };
export const TARIFFS = Object.keys(J.TARIFF).map(k => [k, J.TARIFF[k].ar]);
export const LOSS_SRC = C.PVSYST.losses.src + ' · PVsyst 8.1.6';
export const IAM_ANG = C.PVSYST.losses.iam.ang;
export const DESIGN_T_SRC = S.DESIGN_T.src;

export function fmt(v, d) { if (v == null || v === '' || isNaN(v)) return '—'; if (!isFinite(v)) return '∞'; return (+v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: 0 }); }
export function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ilmjdunufukrfbjwoyiz.supabase.co';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_whv2zaT0zioCeqvnr141ag_MQvqiTMO';
const EDGE = SB + '/functions/v1/pvgis-tmy';
const MF = [['mP', 'Pmax'], ['mVmp', 'Vmp'], ['mImp', 'Imp'], ['mVoc', 'Voc'], ['mIsc', 'Isc'], ['mB', 'betaVoc'], ['mA', 'alphaIsc'], ['mG', 'gammaP'], ['mL', 'L'], ['mW', 'W']];
const IF = [['iP', 'Pac'], ['iVmax', 'Vmax'], ['iN', 'nMPPT'], ['iVmin', 'VmppMin'], ['iVmpp', 'VmppMax'], ['iI', 'ImaxMPPT'], ['iIsc', 'IscMPPT']];
const BF = [['bV', 'V'], ['bK', 'kWh'], ['bD', 'dod'], ['bR', 'rte'], ['bI', 'Ich']];
const LF = [['Uc', 'Uc', 1], ['Uv', 'Uv', 1], ['abs', 'absorptance', 1], ['soil', 'soiling', 100], ['lid', 'LID', 100], ['qual', 'quality', 100], ['mis', 'mismatch', 100], ['ohm', 'ohmicSTC', 100], ['acOhm', 'acOhmSTC', 100]];
const NOT_PROJECT = { lgE: 1, lgP: 1, pjQ: 1, dbQ: 1 };
const SYS_FIELDS = /^(m[A-Z]|i[A-Z]|b[A-Z]|nInv$|ns$|nstr$|dcacT$|iPh$)/;

export default class Controller {
  constructor() {
    this.f = {}; this.out = {}; this.loads = []; this.cmode = 'bills'; this.page = '1'; this.view = 'home';
    this.DB = { modules: [], inverters: [], batteries: [], cables: [], protections: [], suppliers: [], prices: [] };
    this.sess = null; this.PJ = []; this.curPid = null; this.DEFAULTS = null; this.toasts = []; this.busy = false;
    this.curInv = {}; this.weatherCache = {}; this.fileWeather = null; this.modAuto = false; this.NEEDMOD = null;
    this.YC = {}; this.LASTOG = null; this.LASTB = null; this.repData = null; this.ver = 0; this.subs = new Set(); this.adT = null;
    this.init();
  }
  /* ---------- store ---------- */
  subscribe = (fn) => { this.subs.add(fn); return () => this.subs.delete(fn); };
  snapshot = () => this.ver;
  emit() { this.ver++; this.subs.forEach(fn => fn()); }
  num(id) { const v = this.f[id]; return v == null || v === '' ? null : +v; }
  set(id, v) { this.f[id] = v == null ? '' : String(v); }
  toast(t, k) { const id = Math.random(); this.toasts = this.toasts.concat([{ id, t, k: k || '' }]); this.emit(); setTimeout(() => { this.toasts = this.toasts.filter(x => x.id !== id); this.emit(); }, 3100); }
  stype() { return this.f.stype || 'grid'; }
  isOff() { const t = this.stype(); return t === 'offgrid' || t === 'offgrid_nb'; }
  hasBat() { const t = this.stype(); return t === 'hybrid' || t === 'offgrid'; }
  monthlyAvg() { const b = this.bills(); return b.reduce((a, x) => a + x, 0) / 12; }
  /* subscription phase: off-grid follows the inverter; non-domestic is 3-phase; domestic is chosen (auto = by consumption) */
  subPh() { if (this.isOff()) return this.f.iPh; if (!J.isDomestic(this.f.sector)) return '3ph';
    return J.suggestPhase(this.monthlyAvg()); }
  dcacLim() { return J.SIZING.dcacMax[this.isOff() ? (this.f.iPh || '3ph') : this.subPh()]; } // 1ph 1.5 / 3ph 1.2 (REG58 art.9/ج)
  phInfo() { if (this.isOff() || !J.isDomestic(this.f.sector)) return ''; const avg = this.monthlyAvg(), sug = J.suggestPhase(avg), cur = this.subPh(), th = J.PHASE_SWITCH_KWH;
    let h = 'معدل استهلاكك <b>' + fmt(avg, 0) + '</b> ك.و.س/شهر. حد السنغل فيز 16 أمبير = 3.68 kW، وبمعامل 150 ك.و.س/ك.و بيغطي لحد <b>' + fmt(th, 0) + '</b> ك.و.س/شهر. ';
    h += avg > th ? 'استهلاكك أعلى، فالمقترح <b>3 فاز</b> (حد 11.04 kW).' : 'استهلاكك ضمن حد السنغل فيز، فالمقترح <b>سنغل فيز</b>.';
    h = h.replace('فالمقترح', 'فالنظام').replace('فالمقترح', 'فالنظام');
    return h + ' والألواح = الانفيرتر × <b>' + (cur === '1ph' ? '1.5' : '1.2') + '</b> (DC/AC للـ' + (cur === '1ph' ? 'سنغل فيز' : '3 فاز') + '، نظام 58/2024 م9/ج). (دليل الهيئة م5/11، ونظام 58/2024 م8)'; }

  init() {
    try { this.sess = JSON.parse(localStorage.getItem('sanam:sess') || 'null'); } catch (e) { }
    const f = this.f;
    Object.assign(f, { mount: 'roof', pk: '1', optTol: '1', dcMaxOG: '2', roof: '', roofImg: '', acOhm: '0', eAuto: '1', eLAC: '10', eLBat: '2', eLDC: '', eDrop: '3', eDvDC: '1.5', eDvAC: '1.5', eFuse: '25', eIk: '', eInvAt: 'auto', eFloors: '2', eRoomH: '5', eRoomAC: '3', puid: '', pname: 'مشروع جديد', client: '', stype: 'grid', city: '0', tz: '3', alb: '0.2', tilt: '', az: '', modP: '', invP: '', batP: '', iPh: '3ph',
      bSmin: '10', bSmax: '96', bShed: '', bDays: '', bN: '', nInv: '1', ns: '', nstr: '', dcacT: '1.2', mech: 'netOn', sector: 'dom_nosub', shape: 'auto', sPh: 'auto', regime: 'reg58', status: 'draft',
      tMin: S.DESIGN_T.tMin, tWin: S.DESIGN_T.tWinterOp, tSum: S.DESIGN_T.tSummerOp, vSys: S.DESIGN_T.vSysMax });
    for (let i = 0; i < 12; i++) f['b' + i] = '';
    Object.keys(f).forEach(k => { f[k] = String(f[k]); });
    this.setCity(); this.setMod(); this.setInv(); this.setBat(); this.resetL(); this.setTariff();
    this.loads = [{ n: '', W: '', q: 1, f: 1, a: '', b: '', c: false }];
    this.applyType(); this.auto(); this.emrc(); this.DEFAULTS = this.collect();
  }
  start() { if (this.sess) this.loadDB(); else this.projList(); }

  /* ---------- input routing (what the DOM listeners did) ---------- */
  input(id, v) {
    this.f[id] = v == null ? '' : String(v);
    if (id === 'city') this.setCity();
    else if (id === 'modP') { this.modAuto = false; this.setMod(); this.sysCheck(); }
    else if (id === 'invP') { this.setInv(); this.sysCheck(); }
    else if (id === 'batP') this.setBat();
    else if (id === 'sector') this.setTariff();
    else if (id === 'mech') this.emrc();
    else if (id === 'sPh') { this.emrc(); this.autoLater(); }
    else if (id === 'regime') { this.setTariff(); this.autoLater(); }
    else if (id === 'stype') { this.applyType(); this.autoLater(); }
    else if (id === 'tilt' || id === 'az') this.autoLater();
    else if (id === 'mount' || id === 'pk' || id === 'dcMaxOG' || /^e(LDC|Drop|LAC|LBat|DvDC|DvAC|Fuse|Auto|Ik|InvAt|Floors|RoomH|RoomAC)$/.test(id)) this.sysCheck();
    else if (/^b\d+$/.test(id)) { this.emrc(); this.autoLater(); }
    else if (SYS_FIELDS.test(id)) { this.sysCheck(); if (/^b[A-Z]/.test(id)) this.batUpd(); }
    this.emit();
  }
  pasteBills(text) { const v = text.split(/[\s,;\t]+/).filter(Boolean).map(Number).filter(x => !isNaN(x)); if (v.length < 2) return false;
    for (let i = 0; i < 12 && i < v.length; i++) this.f['b' + i] = String(v[i]); this.emrc(); this.autoLater(); this.emit(); return true; }
  go(p) { this.page = p; if (p === '3') this.sysCheck(); if (p === '5') this.emrc(); this.emit(); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); }
  setCmode(m) { this.cmode = m; if (m === 'loads') this.sumLoads(); this.emrc(); this.emit(); }

  /* ---------- Supabase: auth + REST ---------- */
  saveSess() { try { localStorage.setItem('sanam:sess', JSON.stringify(this.sess)); } catch (e) { } }
  auth(path, body) { return fetch(SB + '/auth/v1/' + path, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error_description || j.msg || j.message || ('HTTP ' + r.status)); return j; })); }
  refresh() { if (!this.sess) return Promise.reject(new Error('سجّل دخول أولاً'));
    if (this.sess.expires_at && this.sess.expires_at * 1000 > Date.now() + 60000) return Promise.resolve();
    return this.auth('token?grant_type=refresh_token', { refresh_token: this.sess.refresh_token }).then(j => { this.sess = j; this.saveSess(); }); }
  rest(path, opt) { opt = opt || {}; return this.refresh().then(() => fetch(SB + '/rest/v1/' + path, { method: opt.method || 'GET',
    headers: { apikey: KEY, Authorization: 'Bearer ' + this.sess.access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: opt.body ? JSON.stringify(opt.body) : undefined }))
    .then(r => r.text().then(t => { const j = t ? JSON.parse(t) : null; if (!r.ok) throw new Error((j && (j.message || j.hint)) || ('HTTP ' + r.status)); return j; })); }
  loadDB() { return Promise.all(Object.keys(this.DB).map(t => this.rest(t + '?select=*&order=id').then(r => { this.DB[t] = r || []; })))
    .then(() => { this.projList(); const n = this.DB.modules.length + this.DB.inverters.length + this.DB.batteries.length; this.dbOk = n ? 'ok' : 'x';
      this.out.lgMsg = n ? 'متصل: ' + this.DB.modules.length + ' لوح، و' + this.DB.inverters.length + ' انفيرتر، و' + this.DB.batteries.length + ' بطارية، و' + this.DB.suppliers.length + ' مورد، و' + this.DB.prices.length + ' سعر.'
        : '<b class="bad">دخلت، بس حسابك لسا مش مفعّل على قاعدة البيانات.</b> ابعت لـ Claude إنك سجلت عشان يفعّله.'; this.emit(); })
    .catch(e => { this.dbOk = ''; this.out.lgMsg = 'قاعدة البيانات: ' + esc(e.message); this.emit(); }); }
  login(email, pw) { this.out.lgMsg = 'جاري الدخول…'; this.emit(); return this.auth('token?grant_type=password', { email: email.trim(), password: pw }).then(j => { this.sess = j; this.saveSess(); return this.loadDB(); }).catch(e => { this.out.lgMsg = 'خطأ: ' + esc(e.message); this.emit(); }); }
  signup(email, pw) { return this.auth('signup', { email: email.trim(), password: pw }).then(j => { if (j.access_token) { this.sess = j; this.saveSess(); return this.loadDB(); }
    this.out.lgMsg = 'انعمل الحساب. إذا وصلك إيميل تأكيد أكّده، وبعدين ادخل. وابعت لـ Claude إنك سجلت عشان يفعّل الحساب على قاعدة البيانات.'; this.emit(); }).catch(e => { this.out.lgMsg = 'خطأ: ' + esc(e.message); this.emit(); }); }
  logout() { this.sess = null; this.saveSess(); Object.keys(this.DB).forEach(k => { this.DB[k] = []; }); this.dbOk = ''; this.out.lgMsg = 'تم الخروج'; this.curPid = null; this.PJ = []; this.projList(); this.emit(); }

  /* ---------- 1 project ---------- */
  setCity() { const c = CITIES[+this.f.city || 0]; if (c && c[1] != null) { this.set('lat', c[1]); this.set('lon', c[2]); } }
  T() { return { tMin: this.num('tMin'), tWinterOp: this.num('tWin'), tSummerOp: this.num('tSum'), vSysMax: this.num('vSys') }; }
  loadWeatherFile(name, text) { try { this.fileWeather = JSON.parse(text); this.out.wInfo = 'تم تحميل ' + esc(name) + ' ✓'; } catch (x) { this.out.wInfo = 'ملف غير صالح'; } this.emit(); }

  /* ---------- 3 system ---------- */
  pickerOptions(id) {
    const map = { modP: [S.MODULES, this.DB.modules, r => r.brand + ' ' + r.model + ' — ' + r.pmax_w + ' W'],
      invP: [S.INVERTERS, this.DB.inverters, r => r.brand + ' ' + r.model + ' — ' + r.pac_kw + ' kW ' + r.phase + ' (' + r.kind + ')'],
      batP: [S.BATTERIES, this.DB.batteries, r => r.brand + ' ' + r.model + ' — ' + r.capacity_kwh + ' kWh / ' + r.voltage_nom + ' V'] }[id];
    return { db: map[1].map(r => ({ v: 'd:' + r.id, t: map[2](r) + (r.verified ? '' : ' ⚠') })), presets: Object.keys(map[0]).map(k => ({ v: 'p:' + k, t: map[0][k].name })) };
  }
  optLabel(id) { const v = this.f[id]; if (id === 'city') return (CITIES[+v] || [''])[0]; if (!v) return '— اختار من القائمة —';
    const o = this.pickerOptions(id); const x = o.db.concat(o.presets).filter(z => z.v === v)[0]; return x ? x.t : v; }
  dbRow(t, v) { const id = +String(v).slice(2); return this.DB[t].filter(r => r.id === id)[0]; }
  getModSpec(v) { if (!v) return null; if (v.indexOf('d:') === 0) { const r = this.dbRow('modules', v); if (!r) return null; return { Pmax: r.pmax_w, Vmp: r.vmp, Imp: r.imp, Voc: r.voc, Isc: r.isc, betaVoc: r.beta_voc, alphaIsc: r.alpha_isc, gammaP: r.gamma_p, L: r.length_m || 2.382, W: r.width_m || 1.134 }; } return S.MODULES[v.slice(2)] || null; }
  getInvSpec(v) { if (!v) return null; if (v.indexOf('d:') === 0) { const r = this.dbRow('inverters', v); if (!r) return null; return { Pac: r.pac_kw, Vmax: r.vmax_dc, VmppMin: r.vmpp_min, VmppMax: r.vmpp_max, nMPPT: r.n_mppt, ImaxMPPT: r.imax_mppt, IscMPPT: r.isc_mppt || +(r.imax_mppt * 1.25).toFixed(1),
    maxEff: (r.max_eff || 98) / 100, euroEff: (r.euro_eff || 97) / 100, Pdc: r.pdc_max_kw, phase: r.phase, kind: r.kind, bVmin: r.batt_v_min, bVmax: r.batt_v_max, bImax: r.batt_i_max }; } return S.INVERTERS[v.slice(2)] || null; }
  getBatSpec(v) { if (!v) return null; if (v.indexOf('d:') === 0) { const r = this.dbRow('batteries', v); if (!r) return null; return { V: r.voltage_nom, kWh: r.capacity_kwh, usable: r.usable_kwh, Ich: r.max_charge_a, dod: r.dod_pct || 90, rte: r.rte_pct || 95, hv: r.hv }; } return S.BATTERIES[v.slice(2)] || null; }
  setMod() { const m = this.getModSpec(this.f.modP); MF.forEach(f => this.set(f[0], m ? m[f[1]] : '')); }
  setInv() { const v = this.getInvSpec(this.f.invP); if (!v) { this.curInv = {}; IF.forEach(f => this.set(f[0], '')); this.set('iMx', ''); this.set('iEu', ''); this.batUpd(); return; }
    this.curInv = v; IF.forEach(f => this.set(f[0], v[f[1]])); this.set('iPh', v.phase); this.set('iMx', +(v.maxEff * 100).toFixed(2)); this.set('iEu', +(v.euroEff * 100).toFixed(2)); this.batUpd(); }
  mod() { const m = {}; MF.forEach(f => { m[f[1]] = this.num(f[0]); }); m.eff = m.Pmax / 1000 / (m.L * m.W); return m; }
  modEff() { const m = this.mod(); return isFinite(m.eff) ? (m.eff * 100).toFixed(2) + ' %' : ''; }
  inv() { const v = {}; IF.forEach(f => { v[f[1]] = this.num(f[0]); }); v.phase = this.f.iPh; v.maxEff = this.num('iMx') / 100; v.euroEff = this.num('iEu') / 100;
    const c = this.curInv; v.kind = c.kind || 'grid'; v.bVmin = c.bVmin; v.bVmax = c.bVmax; v.bImax = c.bImax; v.Pdc = c.Pdc; return v; }
  setBat() { const b = this.getBatSpec(this.f.batP); if (!b) { BF.forEach(f => this.set(f[0], '')); this.batUpd(); return; }
    BF.forEach(f => this.set(f[0], b[f[1]] != null ? b[f[1]] : '')); this.set('bSmin', Math.max(10, Math.round(100 - b.dod))); this.batUpd(); }
  bank() { const n = this.num('bN') || 1, V = this.num('bV'), k = this.num('bK'), I = this.num('bI'), kWh = n * k, p = I ? n * I * V / 1000 : kWh * 0.5;
    return { n, kWh, pKW: p, socMin: this.num('bSmin') / 100, chargeStop: this.num('bSmax') / 100, shedSOC: this.num('bShed') / 100, rte: this.num('bR') / 100, V }; }
  /* battery net (usable) energy: nominal × SOC window, and what reaches the loads after discharge + inverter losses */
  batNet() { if (!this.hasBat() || !this.num('bK')) return null; const B = this.bank(), win = Math.max(0, B.chargeStop - B.socMin), net = B.kWh * win,
      v = this.inv(), eta = Math.sqrt(B.rte || 0.95) * (v.euroEff || 0.96);
    return { n: B.n, unit: this.num('bK'), nom: B.kWh, net, win, toLoad: net * eta, eta }; }
  batUpd() { if (!this.hasBat()) { this.out.batInfo = ''; return; } if (!this.num('bK')) { this.out.batInfo = '<div class="mute">اختار بطارية من القائمة أو عبّي بياناتها من الداتا شيت.</div>'; return; }
    const B = this.bank(), v = this.inv(), msg = [];
    const N = this.batNet();
    msg.push('<div class="batnet"><div><span>السعة الاسمية</span><b>' + fmt(N.nom, 2) + ' kWh</b><i>' + B.n + ' × ' + this.num('bK') + ' kWh</i></div><div class="hl"><span>الصافي (المتاح)</span><b>' + fmt(N.net, 2) + ' kWh</b><i>× نافذة SOC ' + fmt(B.socMin * 100, 0) + '–' + fmt(B.chargeStop * 100, 0) + '٪ = ' + fmt(N.win * 100, 0) + '٪</i></div><div><span>الواصل للأحمال</span><b>' + fmt(N.toLoad, 2) + ' kWh</b><i>× كفاءة التفريغ والانفيرتر ' + fmt(N.eta * 100, 0) + '٪</i></div></div>');
    msg.push('البنك: ' + B.n + ' × ' + this.num('bK') + ' kWh = <b>' + fmt(B.kWh, 2) + ' kWh</b> اسمي، والصافي بين SOC ' + fmt(B.socMin * 100, 0) + '٪ و' + fmt(B.chargeStop * 100, 0) + '٪ = <b>' + fmt(N.net, 2) + ' kWh</b>. أقصى شحن/تفريغ ≈ ' + fmt(B.pKW, 1) + ' kW.');
    if (v.bVmin && (B.V < v.bVmin || B.V > v.bVmax)) msg.push('<b class="bad">جهد البطارية ' + B.V + ' V خارج مدى بطارية الانفيرتر ' + v.bVmin + '–' + v.bVmax + ' V.</b>');
    if (v.bImax && B.V < 100 && B.pKW * 1000 / B.V > v.bImax) msg.push('تيار البنك أعلى من حد شحن الانفيرتر (' + v.bImax + ' A)، فالمحاكاة بتحدده عند ' + fmt(v.bImax * B.V / 1000, 1) + ' kW.');
    if (this.isOff() && v.kind !== 'offgrid') msg.push('<b class="bad">الانفيرتر المختار مش off-grid. اختار انفيرتر هجين بيشتغل منفصل (مثلاً Deye SG04LP3 / SG03LP1).</b>');
    if (!v.bVmin) msg.push('<span class="mute">الانفيرتر المختار ما إله بيانات بطارية بالقاعدة، فما في فحص توافق جهد.</span>');
    this.out.batInfo = '<div class="info">' + msg.join('<br>') + '</div>'; }
  batSug() { const prof = this.dailyProfile(); let night = 0; prof.forEach((x, h) => { if (h < 7 || h >= 17) night += x; });
    const B = this.bank(), unit = this.num('bK'), win = B.chargeStop - B.socMin, d = this.num('bDays') || 1;
    const need = night * d / win / 0.95, n = Math.max(1, Math.ceil(need / unit)); this.LASTB = { night, d, win, need, unit, n }; this.set('bN', n); this.batUpd();
    this.out.batInfo += '<div class="mute">الاقتراح: استهلاك الليل (17:00–07:00) ' + fmt(night, 1) + ' kWh/يوم × ' + d + ' يوم ÷ نافذة SOC ' + fmt(win * 100, 0) + '٪ ÷ كفاءة الانفيرتر 95٪ = ' + fmt(need, 1) + ' kWh، يعني ' + n + ' وحدة. المحاكاة بتتأكد من النتيجة.</div>';
    this.emit(); }
  auto(target) { const m = this.mod(), v = this.inv(), n = Math.max(1, this.num('nInv') || 1); if (!m.Pmax || !v.Pac) { this.set('ns', ''); this.set('nstr', ''); this.sysCheck(); return { ok: false }; }
    target = target || Math.floor(n * v.Pac * (this.num('dcacT') || 1.2) * 1000 / m.Pmax + 1e-9);
    const a = S.autoLayout(m, v, n, target, this.T()); if (a.ok) { this.set('ns', a.ns); this.set('nstr', a.nstrPerInv); } else this.out.sizeMsg = '<div class="warn">' + esc(a.msg) + '</div>'; this.sysCheck(); return a; }
  autoS() { this.out.sizeMsg = ''; this.auto(); this.emit(); }
  fromBills() { if (!this.num('mP') || !this.num('iP')) { this.out.sizeMsg = '<div class="warn">اختار اللوح والانفيرتر أولاً.</div>'; this.emit(); return; }
    if (this.isOff()) { return this.offgridSize(); }
    const z = this.emrcSize(); if (!z) return; const v = this.inv(), m = this.mod();
    const n = Math.max(1, Math.floor(z.kwAllowed / v.Pac + 1e-9)); this.set('nInv', n);
    const dc = z.dcacMax; this.set('dcacT', dc); const target = Math.floor(Math.min(n * v.Pac, z.kwAllowed) * dc * 1000 / m.Pmax + 1e-9);
    const a = this.auto(target), kac = n * v.Pac;
    this.out.sizeMsg = '<div class="info">الهيئة بتسمح بـ <b>' + fmt(z.kwAllowed, 2) + ' kW AC</b> (' + esc(J.MECH[this.f.mech].ar) + '). يعني ' + n + ' × ' + v.Pac + ' = ' + fmt(kac, 2) + ' kW، والمستهدف ' + target + ' لوح (<span dir="ltr">DC/AC ≤ ' + z.dcacMax + '</span>)، والتوزيع ' + (a.ok ? a.ns + ' × ' + a.nstrPerInv + ' × ' + n + ' = ' + a.nModules + ' لوح' : 'غير ممكن') + '.' +
      (z.kwAllowed < v.Pac ? ' <b class="bad">الانفيرتر المختار أكبر من المسموح، اختار انفيرتر أصغر.</b>' : '') + '</div>'; this.emit(); }
  sysCheck() {
    const m = this.mod(), v = this.inv(), n = this.num('nInv') || 1, ns = this.num('ns'), ps = this.num('nstr');
    if (!m.Pmax || !v.Pac) { this.out.sysChk = '<div class="mute">اختار اللوح والانفيرتر من القائمة (أو عبّي بياناتهم من الداتا شيت).</div>'; this.sysOk = ''; return null; }
    if (!ns || !ps) { this.out.sysChk = '<div class="mute">حدد Ns وعدد الـ strings، أو اضغط توزيع تلقائي.</div>'; this.sysOk = ''; return null; }
    const c = S.check(m, v, n, ns, ps, this.T()), w = c.win;
    if (this.stype() === 'offgrid') { const r = c.rows[c.rows.length - 1], q = c.kWp / c.kWac, mx = this.num('dcMaxOG') || 2;
      if (r && !r.ok && q >= 0.8 && q <= mx + 1e-9) { r.ok = true; r.warn = 'أعلى من 1.3: الانفيرتر بيقص (Clipping) الإنتاج فوق أقصى دخل PV إله، والمحاكاة بتحسب القص. مقبول بالمنفصل لأنه فائض الظهر أصلاً بيضيع لما البطارية تتعبّى (الحد ' + mx + ')'; c.ok = c.rows.every(x => x.ok); } }
    let h = '<div class="kpis">' + kpi('عدد الألواح', c.nModules + ' = ' + ns + ' × ' + ps + ' × ' + n) + kpi('قدرة DC', fmt(c.kWp, 2) + ' kWp') + kpi('قدرة AC', fmt(c.kWac, 2) + ' kW') + kpi('Pnom ratio', fmt(c.kWp / c.kWac, 2)) + kpi('مساحة الألواح', fmt(c.area, 1) + ' m²') + kpi('strings / MPPT', c.perMPPT) + '</div>';
    h += '<div class="info"><b>شو هاد الفحص؟</b> الألواح بتنربط ورا بعض بسلاسل (string). جهد السلسلة = جهد اللوح × عدد الألواح فيها (Ns)، وتيارها = تيار اللوح. جهد اللوح بيتغير مع الحرارة: بيرتفع بالبرد وبينزل بالحر، فبنفحص السلسلة بأسوأ حالتين (برد −10° وحر 70°) ونتأكد إنها ضمن حدود الانفيرتر من الداتا شيت. الأرقام: جهد وتيار اللوح ومعاملات الحرارة من الداتا شيت تبع اللوح (فوق)، وحدود الجهد والتيار من الداتا شيت تبع الانفيرتر، ودرجات الحرارة من إعدادات المشروع بتبويب 1. ✓ يعني تمام، ⚠ تحذير، ✗ لازم تغيّر عدد الألواح بالسلسلة.</div>';
    h += '<div class="mute">نطاق Ns المسموح لهذا اللوح والانفيرتر: <b>' + w.nsMin + ' – ' + w.nsMax + '</b> (حد Voc: ' + w.nsVoc + '، حد Vmpp max: ' + w.nsMppMax + ')، وأقصى strings على التوازي لكل MPPT: <b>' + w.npMaxMPPT + '</b> (حسب Isc؛ وبدون تقليم تيار: ' + w.npNoClip + ')</div>';
    h += '<table><thead><tr><th>الشرط</th><th class="n">القيمة</th><th>الحد</th><th>الحالة</th><th>المعادلة</th></tr></thead><tbody>';
    const D = ['أعلى جهد ممكن: بأبرد صبح (−10°) الألواح بتعطي أعلى جهد وهي بدون حمل (Voc). مجموع جهد السلسلة لازم ما يتعدى أقصى جهد DC للانفيرتر، وإلا بيخرب. هاد شرط إجباري.',
      'أقل جهد تشغيل: بالصيف الألواح بتسخن لـ 70° وجهدها بينزل. لازم يضل أعلى من أقل جهد MPPT للانفيرتر، وإلا الانفيرتر بيطفي أو بيخسر إنتاج بعز الشمس.',
      'أعلى جهد تشغيل: بالشتا (20° للوح) جهد التشغيل بيرتفع. لازم يضل ضمن مدى الـ MPPT عشان الانفيرتر يلاحق أعلى قدرة.',
      'تيار التشغيل لكل مدخل MPPT = عدد السلاسل على المدخل × Imp للوح. إذا أعلى من حد الانفيرتر، الانفيرتر بيقص التيار الزايد (خسارة صغيرة) بس ما بيخرب، فهاد تحذير مش منع.',
      'تيار القصر لكل مدخل MPPT (Isc عند 70°، لأنه التيار بيزيد مع الحرارة). لازم ما يتعدى أقصى Isc للانفيرتر. هاد شرط سلامة إجباري.',
      'نسبة قدرة الألواح لقدرة الانفيرتر. PVsyst بيعتبر 1.0–1.3 مرجع طبيعي. بالأردن الحد القانوني 1.2 للـ 3 فاز و1.5 للسنغل فيز.'];
    c.rows.forEach((r, i) => { h += '<tr><td>' + esc(r.k) + (D[i] ? '<div class="ex">' + D[i] + '</div>' : '') + '</td><td class="n">' + fmt(r.v, 1) + '</td><td dir="ltr" style="text-align:right">' + esc(r.lim) + '</td><td class="' + (r.warn ? '' : r.ok ? 'okc' : 'bad') + '" title="' + esc(r.warn || '') + '">' + (r.warn ? '⚠' : r.ok ? '✓' : '✗') + '</td><td class="f">' + esc(r.f) + (r.warn ? ' — ' + esc(r.warn) : '') + '</td></tr>'; });
    h += '</tbody></table><div class="mute">معامل حرارة Vmpp ≈ γPmax − αIsc (تقريب قياسي). PVsyst بيستخدم نموذج one-diode، فالفرق بيكون بحدود ±1٪ بالجهد.</div>';
    this.out.sysChk = h; this.sysOk = c.ok ? 'ok' : 'x'; this.lastC = c; this.elecUpd(c); this.out.diagram = this.diagram(c); this.out.price = this.priceCard(c); return c; }
  /* ---------- single-line diagram (SVG) ---------- */
  diagram(c) {
    const m = this.mod(), v = this.inv(), st = this.stype(), ns = this.num('ns') || 0, np = this.num('nstr') || 0, ni = this.num('nInv') || 1;
    if (!m.Pmax || !v.Pac || !ns || !np) return '<div class="mute">الشكل بيطلع لما تختار اللوح والانفيرتر وتوزيع الـ strings.</div>';
    const bat = this.hasBat(), grid = st === 'grid' || st === 'hybrid', B = bat ? this.bank() : null, mech = this.f.mech;
    const X = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const W = 940, H = (bat ? 420 : 330) + 70, rows = Math.min(np, 4), cols = Math.min(ns, 7);
    let g = '';
    // PV array
    const ax = 20, ay = 40, aw = 250, ah = 40 + rows * 34 + 30;
    g += '<rect x="' + ax + '" y="' + ay + '" width="' + aw + '" height="' + ah + '" rx="12" fill="#fff8e6" stroke="#f59e0b" stroke-width="1.5"/>';
    g += '<text x="' + (ax + aw / 2) + '" y="' + (ay + 22) + '" class="t1">مصفوفة الألواح · ' + fmt(c.kWp, 2) + ' kWp</text>';
    for (let r = 0; r < rows; r++) { const y = ay + 36 + r * 34;
      for (let k = 0; k < cols; k++) g += '<rect x="' + (ax + 14 + k * 26) + '" y="' + y + '" width="22" height="26" rx="2" fill="#1e3a5f" stroke="#60a5fa" stroke-width=".8"/><line x1="' + (ax + 14 + k * 26) + '" y1="' + (y + 13) + '" x2="' + (ax + 36 + k * 26) + '" y2="' + (y + 13) + '" stroke="#60a5fa" stroke-width=".5"/>';
      g += '<text x="' + (ax + 22 + cols * 26) + '" y="' + (y + 18) + '" class="t3" text-anchor="start">' + (ns > cols ? '… ' : '') + ns + ' لوح</text>'; }
    g += '<text x="' + (ax + aw / 2) + '" y="' + (ay + ah - 10) + '" class="t3">' + (np > rows ? '… ' : '') + np + ' string × ' + ns + ' لوح' + (ni > 1 ? ' × ' + ni + ' انفيرتر' : '') + ' = ' + c.nModules + ' × ' + m.Pmax + ' W</text>';
    // DC protection
    const dx = 310, dy = ay + ah / 2 - 30;
    g += '<rect x="' + dx + '" y="' + dy + '" width="110" height="60" rx="10" fill="#fff" stroke="#94a3b8"/><text x="' + (dx + 55) + '" y="' + (dy + 25) + '" class="t2">حماية DC</text><text x="' + (dx + 55) + '" y="' + (dy + 44) + '" class="t3">فيوز · SPD · عازل</text>';
    g += '<path d="M' + (ax + aw) + ' ' + (dy + 30) + ' H' + dx + '" class="dc"/><text x="' + ((ax + aw + dx) / 2) + '" y="' + (dy + 22) + '" class="t3">DC</text>';
    // inverter
    const ix = 460, iy = dy - 15, iw = 170;
    g += '<rect x="' + ix + '" y="' + iy + '" width="' + iw + '" height="90" rx="12" fill="#eef4ff" stroke="#2563eb" stroke-width="1.5"/>';
    g += '<text x="' + (ix + iw / 2) + '" y="' + (iy + 24) + '" class="t1">' + (ni > 1 ? ni + ' × ' : '') + 'انفيرتر ' + fmt(v.Pac, 2) + ' kW</text>';
    g += '<text x="' + (ix + iw / 2) + '" y="' + (iy + 44) + '" class="t3">' + X((this.optLabel('invP') || '').split(' — ')[0].slice(0, 30)) + '</text>';
    g += '<text x="' + (ix + iw / 2) + '" y="' + (iy + 62) + '" class="t3">' + (v.phase === '1ph' ? 'سنغل فيز' : '3 فاز') + ' · ' + v.nMPPT + ' MPPT · DC/AC ' + fmt(c.kWp / c.kWac, 2) + '</text>';
    g += '<text x="' + (ix + iw / 2) + '" y="' + (iy + 80) + '" class="t3">' + ({ grid: 'مربوط', hybrid: 'هجين', offgrid: 'منفصل', offgrid_nb: 'منفصل بدون بطاريات' })[st] + '</text>';
    g += '<path d="M' + (dx + 110) + ' ' + (dy + 30) + ' H' + ix + '" class="dc"/>';
    // battery
    if (bat) { const bx = ix + 10, by = iy + 150;
      g += '<rect x="' + bx + '" y="' + by + '" width="' + (iw - 20) + '" height="70" rx="10" fill="#ecfdf5" stroke="#16a34a" stroke-width="1.5"/>';
      for (let k = 0; k < Math.min(B.n, 6); k++) g += '<rect x="' + (bx + 12 + k * 22) + '" y="' + (by + 10) + '" width="16" height="22" rx="2" fill="#16a34a"/><rect x="' + (bx + 17 + k * 22) + '" y="' + (by + 7) + '" width="6" height="3" fill="#16a34a"/>';
      g += '<text x="' + (bx + (iw - 20) / 2) + '" y="' + (by + 50) + '" class="t2">' + B.n + ' × ' + fmt(this.num('bK'), 2) + ' = ' + fmt(B.kWh, 1) + ' kWh · صافي ' + fmt(B.kWh * (B.chargeStop - B.socMin), 1) + '</text>';
      g += '<text x="' + (bx + (iw - 20) / 2) + '" y="' + (by + 64) + '" class="t3">' + fmt(B.V, 1) + ' V · SOC ' + fmt(B.socMin * 100, 0) + '–' + fmt(B.chargeStop * 100, 0) + '٪</text>';
      g += '<path d="M' + (ix + iw / 2) + ' ' + (iy + 90) + ' V' + by + '" class="dc bat"/><text x="' + (ix + iw / 2 + 8) + '" y="' + (iy + 125) + '" class="t3" text-anchor="start">DC بطارية</text>'; }
    // AC side
    const acx = 670, acy = dy;
    g += '<rect x="' + acx + '" y="' + acy + '" width="100" height="60" rx="10" fill="#fff" stroke="#94a3b8"/><text x="' + (acx + 50) + '" y="' + (acy + 25) + '" class="t2">حماية AC</text><text x="' + (acx + 50) + '" y="' + (acy + 44) + '" class="t3">قاطع · SPD · RCD</text>';
    g += '<path d="M' + (ix + iw) + ' ' + (dy + 30) + ' H' + acx + '" class="ac"/><text x="' + ((ix + iw + acx) / 2) + '" y="' + (dy + 22) + '" class="t3">AC</text>';
    const lx = 810, ly = grid ? acy - 70 : acy;
    g += '<rect x="' + lx + '" y="' + ly + '" width="110" height="60" rx="10" fill="#f8fafc" stroke="#475569"/><text x="' + (lx + 55) + '" y="' + (ly + 26) + '" class="t2">' + (st === 'offgrid_nb' ? 'أحمال نهارية' : 'الأحمال') + '</text><text x="' + (lx + 55) + '" y="' + (ly + 44) + '" class="t3">لوحة التوزيع</text>';
    g += '<path d="M' + (acx + 100) + ' ' + (acy + 30) + ' H' + (lx - 20) + ' V' + (ly + 30) + ' H' + lx + '" class="ac"/>';
    if (grid) { const mx = lx, my = acy + 70;
      g += '<rect x="' + mx + '" y="' + my + '" width="110" height="52" rx="10" fill="#fff" stroke="#475569"/><text x="' + (mx + 55) + '" y="' + (my + 22) + '" class="t2">عداد ثنائي الاتجاه</text><text x="' + (mx + 55) + '" y="' + (my + 40) + '" class="t3">' + X(J.MECH[mech] ? J.MECH[mech].ar.split(' — ')[0] : '') + '</text>';
      g += '<path d="M' + (lx - 20) + ' ' + (acy + 30) + ' V' + (my + 26) + ' H' + mx + '" class="ac"/>';
      const gy = my + 80; g += '<path d="M' + (mx + 55) + ' ' + (my + 52) + ' V' + gy + '" class="ac"/>';
      g += '<g transform="translate(' + (mx + 55) + ',' + (gy + 4) + ')"><path d="M-18 40 L0 0 L18 40 M-12 14 H12 M-15 26 H15" fill="none" stroke="#475569" stroke-width="1.6"/></g>';
      g += '<text x="' + (mx + 55) + '" y="' + (gy + 58) + '" class="t2">شبكة ' + (this.subPh() === '1ph' ? 'سنغل فيز' : '3 فاز') + (mech === 'zero' ? ' (تصدير صفري)' : '') + '</text>'; }
    const css = '<style>.sld .t1{font:800 13px Tajawal,Tahoma,sans-serif;fill:#0f2a44;text-anchor:middle}.sld .t2{font:700 12px Tajawal,Tahoma,sans-serif;fill:#0f2a44;text-anchor:middle}.sld .t3{font:500 10.5px Tajawal,Tahoma,sans-serif;fill:#64748b;text-anchor:middle}' +
      '.sld .dc{stroke:#f59e0b;stroke-width:3;fill:none;stroke-dasharray:8 5;animation:flow 1.2s linear infinite}.sld .dc.bat{stroke:#16a34a}.sld .ac{stroke:#2563eb;stroke-width:3;fill:none;stroke-dasharray:8 5;animation:flow 1.2s linear infinite}@keyframes flow{to{stroke-dashoffset:-26}}@media print{.sld .dc,.sld .ac{animation:none}}</style>';
    return '<div class="sldw" dir="ltr"><svg class="sld" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="single-line diagram">' + css + '<g transform="translate(0,70)">' + g + '</g></svg></div>'; }

  /* ---------- 4 losses ---------- */
  resetL() { const P = C.PVSYST.losses; LF.forEach(f => this.set(f[0], +(P[f[1]] * f[2]).toFixed(4))); this.set('kIrr', 0.010); P.iam.val.forEach((v, i) => this.set('iam' + i, v)); }
  losses() { const L = {}; LF.forEach(f => { L[f[1]] = this.num(f[0]) / f[2]; }); const t = C.PVSYST.losses.iam; L.iam = { ang: t.ang.slice(), val: t.ang.map((a, i) => this.num('iam' + i)) }; return L; }

  /* ---------- 5 consumption / tariff ---------- */
  setTariff() { const k = this.f.sector, Tt = J.TARIFF[k], dom = J.isDomestic(k);
    this.set('bands', Tt.bands.map(x => (x[0] === Infinity ? 'inf' : x[0]) + ':' + x[1]).join(', '));
    const rg = this.f.regime || 'reg58';
    this.set('bb', J.buybackFor(k, rg, 0)); this.set('fee', J.gridFeeFor(k, rg, this.subPh() === '1ph'));
    this.out.tarsrc = 'التعرفة: ' + Tt.src + (Tt.tou ? ' · تعرفة حسب الزمن: ذروة 17–23 = ' + Tt.tou.peak + '، جزئية 14–17 و23–05 = ' + Tt.tou.part + '، خارج الذروة 05–14 = ' + Tt.tou.off + ' فلس (الشرائح تحت ما بتنطبق)' : '') +
      ' · الشراء والبدل: ' + (rg === 'draft26' ? J.DRAFT26.src + (this.hasBat() ? '. سعر الشراء مع التخزين بينحسب بالمحاكاة حسب سعة البطارية.' : '') : J.BUYBACK.src + ' ؛ ' + J.GRIDFEE.src); this.emrc(); }
  parseBands(s) { try { const b = s.split(',').map(p => { const q = p.split(':'); return [/inf/i.test(q[0]) ? Infinity : +q[0], +q[1]]; }); return b.every(x => !isNaN(x[1]) && !isNaN(x[0])) ? b : null; } catch (e) { return null; } }
  addLoad(l) { this.loads = this.loads.concat([Object.assign({ n: '', W: '', q: 1, f: 1, a: '', b: '', c: false }, l || {})]); this.loadsChanged(); }
  delLoad(i) { this.loads = this.loads.filter((x, j) => j !== i); this.loadsChanged(); }
  editLoad(i, k, v) { this.loads = this.loads.map((x, j) => j === i ? Object.assign({}, x, { [k]: v }) : x); this.loadsChanged(); }
  loadsChanged() { this.sumLoads(); this.emrc(); this.autoLater(); this.emit(); }
  loadRows() { return this.loads.map(r => { const f = r.f === '' || r.f == null ? 1 : Math.max(0, Math.min(1, +r.f)); return { n: r.n, W: +r.W || 0, q: +r.q || 0, f, a: +r.a || 0, b: +r.b || 0, c: !!r.c }; }); }
  hoursOf(a, b) { a = ((a % 24) + 24) % 24; b = ((b % 24) + 24) % 24; const h = []; let k; if (a === b) { for (k = 0; k < 24; k++) h.push(k); return h; } for (k = a; k !== b; k = (k + 1) % 24) h.push(k); return h; }
  dailyProfile(critOnly) { const p = new Array(24).fill(0);
    if (this.cmode !== 'loads') { const b = this.bills(), avg = b.reduce((x, y) => x + y, 0) / 365, sh = J.SHAPES[this.f.shape === 'auto' ? J.shapeFor(this.f.sector) : this.f.shape], t = sh.reduce((x, y) => x + y, 0);
      return sh.map(w => avg * w / t); }
    this.loadRows().forEach(r => { if (critOnly && !r.c) return; this.hoursOf(r.a, r.b).forEach(h => { p[h] += r.W * r.q * r.f / 1000; }); }); return p; }
  loadsDaily() { return this.dailyProfile().reduce((a, b) => a + b, 0); }
  loadTotals() { const R = this.loadRows(), p = this.dailyProfile(), pc = this.dailyProfile(true), sum = a => a.reduce((x, y) => x + y, 0), day = h => h >= 7 && h < 17;
    const pk = Math.max.apply(null, p), pkH = p.indexOf(pk);
    return { connW: sum(R.map(r => r.W * r.q)), critW: sum(R.filter(r => r.c).map(r => r.W * r.q)), qty: sum(R.map(r => r.q)),
      rowKWh: R.map(r => r.W * r.q * r.f * this.hoursOf(r.a, r.b).length / 1000), rowH: R.map(r => this.hoursOf(r.a, r.b).length),
      d: sum(p), dc: sum(pc), day: sum(p.filter((x, h) => day(h))), night: sum(p.filter((x, h) => !day(h))), nightC: sum(pc.filter((x, h) => !day(h))), pk, pkH, pkC: Math.max.apply(null, pc) }; }
  sumLoads() { if (this.cmode !== 'loads') return; const p = this.dailyProfile(), pc = this.dailyProfile(true), d = p.reduce((a, b) => a + b, 0), dc = pc.reduce((a, b) => a + b, 0);
    this.out.loadSum = 'يومي <b>' + fmt(d) + '</b> ك.و.س (منها حرج ' + fmt(dc) + ')، شهري ≈ ' + fmt(d * 30.4, 0) + '، سنوي ≈ ' + fmt(d * 365, 0) + '. أعلى حمل ساعي ' + fmt(Math.max.apply(null, p), 2) + ' kW. الطاقة = W × العدد × الساعات × معامل الحمل. من/إلى بالساعات (0–24)، و16 إلى 2 يعني من 4 العصر لـ 2 الفجر.'; }
  autoLater() { clearTimeout(this.adT); this.adT = setTimeout(() => { if (this.loadsDaily() > 0) this.autoDesign(); else { this.out.autoRes = ''; this.emit(); } }, 700); }
  autoDesign() { return this.autoD().then(() => { if (this.stype() === 'offgrid' && this.sysOk === 'ok') return this.optimize(this.num('optTol')); }); }
  billsFilled() { let n = 0; for (let i = 0; i < 12; i++) if (this.f['b' + i] !== '' && this.f['b' + i] != null) n++; return n; }
  bills() { if (this.cmode === 'bills') { const b = [], f = []; for (let i = 0; i < 12; i++) { const v = this.f['b' + i]; b.push(v === '' || v == null ? null : +v || 0); if (v !== '' && v != null) f.push(+v || 0); }
      const avg = f.length ? f.reduce((a, x) => a + x, 0) / f.length : 0;
      this.out.billInfo = f.length && f.length < 12 ? 'دخلت ' + f.length + ' فاتورة، ومعدلها ' + fmt(avg, 0) + ' ك.و.س/شهر. الـ ' + (12 - f.length) + ' شهر الباقيين انحسبوا بنفس المعدل، يعني السنة ≈ ' + fmt(avg * 12, 0) + ' ك.و.س.' : '';
      return b.map(x => x == null ? avg : x); }
    const d = this.dailyProfile().reduce((a, x) => a + x, 0); return MD.map(n => d * n); }
  emrcSize() { const b = this.bills(); if (b.reduce((a, x) => a + x, 0) <= 0) return null;
    return J.sizeFromBills({ bills: b, sector: this.f.sector, phase: this.isOff() ? this.f.iPh : this.subPh(), regime: this.f.regime, storage: this.hasBat(), mech: this.f.mech, moduleW: this.num('mP'), dcac: this.isOff() ? this.num('dcacT') : null, inverterKW: (this.num('nInv') || 1) * this.num('iP') }); }
  emrc() { const z = this.emrcSize(); if (!z) { this.out.emrc = '<div class="mute">أدخل الاستهلاك</div>'; return; }
    let h = z.warnings.length ? '<div class="warn">⚠ ' + z.warnings.map(esc).join('<br>⚠ ') + '</div>' : '';
    h += '<table><thead><tr><th>البند</th><th class="n">القيمة</th><th>المعادلة</th><th>المصدر</th></tr></thead><tbody>';
    z.steps.forEach(s => { h += '<tr><td>' + esc(s.k) + '</td><td class="n">' + fmt(s.v, 2) + ' ' + esc(s.u) + '</td><td class="f">' + esc(s.f) + '</td><td class="s">' + esc(s.s || '') + '</td></tr>'; });
    this.out.emrc = h + '</tbody></table><div class="mute">الانفيرتر هنا = (عدد × قدرة) من تبويب 4. زر "حجّم من الفواتير" بتبويب 4 بيختار العدد والـ strings لحاله.</div>'; }

  /* ---------- off-grid sizing ---------- */
  dayNight(prof) { let day = 0, night = 0; prof.forEach((x, h) => { if (h >= 7 && h < 17) day += x; else night += x; }); return { day, night }; }
  offgridSize() { const prof = this.dailyProfile(), nb = this.stype() === 'offgrid_nb', dn = this.dayNight(prof), Ed = nb ? dn.day : prof.reduce((a, b) => a + b, 0), peak = Math.max.apply(null, prof);
    if (Ed <= 0) { this.out.sizeMsg = '<div class="warn">أدخل الأحمال بتبويب 3</div>'; this.emit(); return Promise.resolve(); }
    this.out.sizeMsg = '<div class="mute">جاري حساب إنتاج أسوأ شهر من بيانات الطقس…</div>'; this.emit();
    return this.getWeather().then(j => { const W = PG.fromJSON(j, this.num('tz')).rows, m = this.mod(), v = this.inv();
      const r = C.simulate({ weather: W, module: { Pmax: 1000, gammaP: m.gammaP, eff: m.eff }, nModules: 1, tilt: this.num('tilt'), azimuth: this.num('az'), site: this.site(), losses: this.losses(), lowIrrK: this.num('kIrr') });
      let yw = Infinity, wm = 0; r.monthly.forEach((x, i) => { const y = x.eArray / MD[i]; if (y < yw) { yw = y; wm = i; } });
      const eta = nb ? 0.93 : 0.88, kWp = Ed / (yw * eta); this.LASTOG = { Ed, yw, wm, kWp, peak, eta, nb, night: dn.night };
      const nInv = Math.max(1, Math.ceil(peak * 1.25 / v.Pac), Math.ceil(Math.ceil(kWp * 1000 / m.Pmax - 1e-9) / this.capMods(v) - 1e-9)), target = Math.ceil(kWp * 1000 / m.Pmax);
      this.set('nInv', nInv); const a = this.auto(target);
      this.out.sizeMsg = '<div class="info">تحجيم منفصل' + (nb ? ' بدون بطاريات' : '') + ' (بدون قيود الهيئة): الاستهلاك ' + (nb ? 'النهاري (7:00–17:00)' : 'اليومي') + ' <b>' + fmt(Ed, 1) + ' kWh</b>، وأعلى حمل ' + fmt(peak, 2) + ' kW. أسوأ شهر (' + MON[wm] + ') بيعطي ' + fmt(yw, 2) + ' kWh/kWp/يوم على الميل والاتجاه الحاليين. ' +
        'يعني <span dir="ltr">kWp = ' + fmt(Ed, 1) + ' / (' + fmt(yw, 2) + ' × ' + eta + ')</span> = <b>' + fmt(kWp, 2) + ' kWp</b>، وهاد ' + target + ' لوح. الـ ' + eta + (nb ? ' هي كفاءة الانفيرتر (ما في بطارية). ' : ' هي كفاءة مسار الانفيرتر والبطارية. ') +
        'الانفيرتر: ' + nInv + ' × ' + v.Pac + ' kW، بحيث يغطي أعلى حمل × 1.25 وكل الألواح. التوزيع: ' + (a.ok ? a.ns + ' × ' + a.nstrPerInv + ' × ' + nInv + ' = ' + a.nModules + ' لوح' : 'غير ممكن') + '.' +
        (a.ok && a.nModules < target * 0.9 ? ' <b class="bad">الانفيرتر ما بيستوعب كل الألواح (' + a.nModules + ' من ' + target + ')، زيّد عدد الانفيرترات أو اختار أكبر.</b>' : a.ok && a.nModules < target ? ' (أقل بشوي من المطلوب بسبب تقسيم الـ strings المتساوية.)' : '') +
        (v.kind !== 'offgrid' ? ' <b class="bad">الانفيرتر المختار مش off-grid.</b>' : '') + (nb ? (dn.night > 0 ? ' <b class="bad">أحمال الليل (' + fmt(dn.night, 1) + ' kWh/يوم) ما رح تتغطى لأنه ما في بطاريات.</b>' : '') + ' المحاكاة بتحسب E_Miss.</div>' : ' بعدها اضغط "اقترح عدد البطاريات"، والمحاكاة بتأكد E_Miss.</div>'); this.emit();
    }).catch(e => { this.out.sizeMsg = '<div class="warn">خطأ بالطقس: ' + esc(e.message) + '</div>'; this.emit(); }); }

  /* ---------- system type ---------- */
  applyType(keepMode) { this.out.sizeMsg = ''; if (!keepMode && this.isOff() && this.cmode !== 'loads') { this.cmode = 'loads'; this.sumLoads(); this.emrc(); } this.batUpd(); }

  /* ---------- save / load ---------- */
  collect() { const o = { v: 1, fields: {}, cmode: this.cmode, loads: [] }; Object.keys(this.f).forEach(k => { if (!NOT_PROJECT[k]) o.fields[k] = this.f[k]; });
    this.loadRows().forEach(r => o.loads.push([r.n, r.W, r.q, r.a, r.b, r.c, r.f])); return o; }
  applyData(o) {
    this.f.roof = ''; this.f.roofImg = ''; this.f.mount = 'roof'; this.f.pk = '1'; this.f.optTol = '1'; this.f.dcMaxOG = '2'; this.f.acOhm = '0'; this.f.eAuto = '1'; this.f.eLAC = '10'; this.f.eLBat = '2'; this.f.eLDC = ''; this.f.eDrop = '3'; this.f.eDvDC = '1.5'; this.f.eDvAC = '1.5'; this.f.eFuse = '25'; this.f.eIk = ''; this.f.eInvAt = 'auto'; this.f.eFloors = '2'; this.f.eRoomH = '5'; this.f.eRoomAC = '3'; this.f.puid = ''; this.RC = null; this.optRes = null; // project-specific, so a project without them doesn't inherit the previous one's
    Object.keys(o.fields || {}).forEach(k => { if (!NOT_PROJECT[k]) this.f[k] = o.fields[k] == null ? '' : String(o.fields[k]); });
    this.loads = (o.loads || []).map(l => ({ n: l[0], W: l[1], q: l[2], a: l[3], b: l[4], c: !!l[5], f: l[6] == null ? 1 : l[6] }));
    if (!this.loads.length) this.loads = [{ n: '', W: '', q: 1, f: 1, a: '', b: '', c: false }];
    this.cmode = o.cmode === 'loads' ? 'loads' : 'bills';
    const keep = {}; ['ns', 'nstr', 'nInv', 'bN'].forEach(k => { if (o.fields && o.fields[k] != null) keep[k] = o.fields[k]; });
    this.setInv(); Object.keys(keep).forEach(k => this.set(k, keep[k]));
    this.applyType(true); this.sysCheck(); this.emrc(); this.sumLoads(); this.bills(); this.emit(); }
  downloadJSON() { const b = new Blob([JSON.stringify(this.collect(), null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = (this.f.pname || 'project').replace(/[^\w؀-ۿ-]+/g, '_') + '.sanam.json'; a.click(); }
  openJSON(text) { try { this.applyData(JSON.parse(text)); this.curPid = null; this.pjMsg('اتفتح من ملف، "حفظ" بيعمله مشروع جديد على القاعدة.'); } catch (x) { this.toast('ملف غير صالح', 'bad'); } }

  /* ---------- cloud projects ---------- */
  pjMsg(t, k) { this.out.pjMsg = t; if (k !== false) this.toast(t.replace(/<[^>]+>/g, ''), /ما انحفظ|خطأ/.test(t) ? 'bad' : 'ok'); this.emit(); }
  kwpNow() { return (this.num('ns') || 0) * (this.num('nstr') || 0) * (this.num('nInv') || 1) * this.num('mP') / 1000; }
  projList() { if (!this.sess) { this.PJ = []; this.pjMsg('سجّل دخول من "قاعدة البيانات" تحت عشان تحفظ أكثر من مشروع. حفظ JSON شغال بدون حساب.', false); return; }
    this.rest('projects?select=id,name,client,system_type,kwp,kwac,battery_kwh,updated_at,created_at,status:data->fields->>status,city:data->fields->>city,phase:data->fields->>iPh&order=updated_at.desc').then(r => { this.PJ = r || []; this.emit(); }).catch(e => this.pjMsg('المشاريع: ' + esc(e.message))); }
  projSave(asNew) { if (!this.sess) { this.projList(); this.toast('سجّل دخول أولاً عشان تحفظ على القاعدة', 'bad'); return; } const d = this.collect(), t = this.stype();
    const body = { name: this.f.pname || 'مشروع بدون اسم', client: this.f.client || null, system_type: t, site: this.num('lat').toFixed(4) + ',' + this.num('lon').toFixed(4), data: d, kwp: +this.kwpNow().toFixed(3), kwac: +((this.num('nInv') || 1) * this.num('iP')).toFixed(2), battery_kwh: !this.hasBat() ? null : +((this.num('bN') || 0) * this.num('bK')).toFixed(2) };
    if (asNew && this.PJ.some(x => x.name === body.name)) body.name += ' (نسخة)';
    if (this.saving) return; this.saving = true; if (!this.f.puid || asNew) { this.set('puid', 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); body.data = this.collect(); } body.puid = this.f.puid;
    const pr = (this.curPid && !asNew ? Promise.resolve([{ id: this.curPid }]) : this.rest('projects?puid=eq.' + encodeURIComponent(this.f.puid) + '&select=id')).then(ex => ex && ex.length
      ? this.rest('projects?id=eq.' + ex[0].id, { method: 'PATCH', body }) : this.rest('projects', { method: 'POST', body }));
    pr.finally(() => { this.saving = false; this.emit(); });
    pr.then(r => { if (!r || !r[0]) throw new Error('ما رجع رد من القاعدة'); this.curPid = r[0].id; if (asNew) this.set('pname', body.name); this.pjMsg('انحفظ ✓ (' + esc(body.name) + ')'); this.projList(); }).catch(e => this.pjMsg('ما انحفظ: ' + esc(e.message))); }
  projOpen(id) { return this.rest('projects?id=eq.' + id + '&select=data,name').then(r => { this.applyData(r[0].data); this.curPid = id; this.view = 'work'; this.modAuto = false; this.out.autoRes = ''; this.out.rep = ''; this.repData = null; this.page = '1'; this.pjMsg('فتحت "' + esc(r[0].name) + '"'); }).catch(e => this.pjMsg('خطأ: ' + esc(e.message))); }
  projDelete(id) { return this.rest('projects?id=eq.' + id, { method: 'DELETE' }).then(() => { if (this.curPid === id) this.curPid = null; this.pjMsg('انحذف المشروع'); this.projList(); }).catch(e => this.pjMsg('خطأ: ' + esc(e.message))); }
  projNew() { if (this.DEFAULTS) this.applyData(JSON.parse(JSON.stringify(this.DEFAULTS))); this.set('pname', 'مشروع جديد'); this.set('client', ''); this.curPid = null; this.modAuto = false;
    this.out.autoRes = ''; this.out.rep = ''; this.out.sizeMsg = ''; this.repData = null; this.LASTOG = null; this.LASTB = null; this.page = '1'; this.pjMsg('مشروع جديد ✓ ابدأ بنوع النظام والموقع'); }
  createProject(name, client, type) { this.projNew(); this.set('pname', name); this.set('client', client); this.set('stype', type); this.applyType();
    this.view = 'work'; this.page = '1'; this.pjMsg('انعمل "' + esc(name) + '" ✓ كمّل بالموقع والاتجاه'); }
  printReport() { const go = () => { if (typeof window !== 'undefined') setTimeout(() => window.print(), 350); };
    if (!this.out.rep) { this.page = '6'; this.emit(); this.toast('شغّل المحاكاة أول، وبعدين اطبع التقرير', 'bad'); return; }
    if (this.page !== '6') { this.page = '6'; this.emit(); } go(); }
  steps() { return { 1: this.num('lat') != null && this.num('lon') != null, 2: this.num('tilt') != null && this.num('az') != null, 5: this.loadsDaily() > 0, 3: this.sysOk === 'ok', 4: true, 6: !!this.repData, 8: !!(this.lastC && this.roof() && this.roof().pts.length > 2) }; }

  /* ---------- weather ---------- */
  getWeather() {
    const lat = this.num('lat'), lon = this.num('lon'), k = lat.toFixed(3) + ',' + lon.toFixed(3);
    if (this.fileWeather) return Promise.resolve(this.fileWeather);
    if (this.weatherCache[k]) return Promise.resolve(this.weatherCache[k]);
    try { const s = localStorage.getItem('pvgis:' + k); if (s) { this.weatherCache[k] = JSON.parse(s); return Promise.resolve(this.weatherCache[k]); } } catch (e) { }
    const q = '?lat=' + lat.toFixed(4) + '&lon=' + lon.toFixed(4);
    const get = (url, h) => fetch(url, { headers: h || {} }).then(r => { if (!r.ok) return r.text().then(t => { throw new Error('PVGIS ' + r.status + ': ' + t.slice(0, 160)); }); return r.json(); })
      .then(j => { if (!j.outputs) throw new Error(j.message || 'رد غير متوقع من PVGIS'); return j; });
    return get('/api/pvgis' + q).catch(() => get(EDGE + q, { apikey: KEY, Authorization: 'Bearer ' + KEY }))
      .then(j => { this.weatherCache[k] = j; try { localStorage.setItem('pvgis:' + k, JSON.stringify(j)); } catch (e) { } return j; });
  }
  site() { return { lat: this.num('lat'), lon: this.num('lon'), tz: this.num('tz'), albedo: this.num('alb') }; }
  optTilt() { this.out.optOut = 'جاري الحساب…'; this.emit(); this.getWeather().then(j => { const W = PG.fromJSON(j, this.num('tz')).rows; let best = null;
    for (let t = 0; t <= 45; t += 2.5) { const r = C.simulate({ weather: W, module: { Pmax: 1000, gammaP: -0.3, eff: 0.21 }, nModules: 1, tilt: t, azimuth: this.num('az') || 0, site: this.site() }); if (!best || r.year.globEff > best[1]) best = [t, r.year.globEff]; }
    const cur = this.num('tilt') == null ? null : C.simulate({ weather: W, module: { Pmax: 1000, gammaP: -0.3, eff: 0.21 }, nModules: 1, tilt: this.num('tilt'), azimuth: this.num('az') || 0, site: this.site() }).year.globEff;
    this.out.optOut = 'الميل الأمثل للإشعاع الفعّال (GlobEff) على هالاتجاه: <b>' + best[0] + '°</b> (' + fmt(best[1], 0) + ' kWh/m²).' + (cur != null ? ' الميل الحالي ' + this.num('tilt') + '° بيعطي ' + fmt(cur, 0) + ' kWh/m²، يعني خسارة ' + fmt((1 - cur / best[1]) * 100, 1) + '٪ عن الأمثل.' : '');
    this.emit(); }).catch(e => { this.out.optOut = 'خطأ: ' + esc(e.message); this.emit(); }); }

  /* ---------- 6 run ---------- */
  status(t, ok) { this.out.status = t ? '<span style="color:' + (ok === false ? 'var(--bad)' : ok ? 'var(--ok)' : 'var(--mute)') + '">' + t + '</span>' : ''; this.emit(); }
  run() {
    if (this.num('tilt') == null || this.num('az') == null) { this.status('أدخل الميل والاتجاه بتبويب 2', false); return; }
    const c = this.sysCheck(); if (!c) { this.status('حدد تصميم المصفوفة بتبويب 4', false); return; }
    const bands = this.parseBands(this.f.bands || ''); if (!bands) { this.status('صيغة الشرائح غير صحيحة (تبويب 3)', false); return; }
    this.busy = true; this.status('جلب بيانات الطقس من PVGIS…');
    return this.getWeather().then(json => {
      this.status('محاكاة 8760 ساعة…');
      const W = PG.fromJSON(json, this.num('tz')), m = this.mod(), v = this.inv(), L = this.losses(), conv = C.fitConv(v.maxEff, v.euroEff);
      const sim = C.simulate({ weather: W.rows, module: { Pmax: m.Pmax, gammaP: m.gammaP, eff: m.eff }, nModules: c.nModules, tilt: this.num('tilt'), azimuth: this.num('az'),
        convKW: c.kWac, converter: conv, site: this.site(), losses: L, lowIrrK: this.num('kIrr'), shade: this.shadeSim() });
      const b = this.bills(), sector = this.f.sector, mech = this.f.mech, shp = this.f.shape === 'auto' ? J.shapeFor(sector) : this.f.shape, z = this.emrcSize();
      const st = this.stype(); let load = null, crit = null, stor = null, over = 0, bill = null;
      if (this.cmode === 'loads') { const pf = this.dailyProfile(), pc = this.dailyProfile(true); load = W.rows.map(r => pf[Math.floor(r.hour) % 24]); crit = W.rows.map(r => pc[Math.floor(r.hour) % 24]); }
      else if (b.reduce((a, x) => a + x, 0) > 0) load = J.loadProfile(W.rows, b, shp);
      if (load) load.forEach(x => { if (x > c.kWac) over++; });
      if (st !== 'grid') { if (!load) throw new Error('أدخل الأحمال أو الفواتير (تبويب 3)');
        const nb = st === 'offgrid_nb', B = nb ? { n: 0, kWh: 1e-9, socMin: 0.1, chargeStop: 0.96, shedSOC: null, rte: 1, pKW: 0, V: 0 } : this.bank(),
          lim = (!nb && v.bImax && B.V < 100) ? v.bImax * B.V / 1000 : Infinity, pB = nb ? 1e-12 : Math.min(B.pKW, lim);
        stor = C.simulateStorage({ pdc: sim.hourly.map(h => h.pdc), load, critical: crit, months: W.rows.map(r => r.month), kWac: c.kWac, converter: conv,
          battery: { kWh: B.kWh, socMin: B.socMin, chargeStop: B.chargeStop, shedSOC: B.shedSOC, rte: B.rte, maxChargeKW: pB, maxDischargeKW: pB }, mode: nb ? 'offgrid' : st, exportAllowed: mech !== 'zero', acLimit: true, pvMaxKW: (v.Pdc || v.Pac * 1.3) * (this.num('nInv') || 1) });
        stor.bank = B; stor.pB = pB; stor.nb = nb; }
      if (st === 'grid' && load) bill = J.netValueYear({ rows: W.rows, pvKWh: sim.hourly.map(h => h.eout), loadKWh: load, sector, bands, buyback: this.num('bb'), gridFee: this.num('fee'), kWac: c.kWac, mech });
      let bbH = this.num('bb'); if (st === 'hybrid' && this.f.regime === 'draft26') { const share = stor.bank.kWh / Math.max(1, sim.year.eOut / 365); bbH = J.buybackFor(sector, 'draft26', share); this.set('bb', bbH); }
      if (st === 'hybrid') bill = J.netValueYear({ rows: W.rows, pvKWh: Array.from(stor.exp), loadKWh: Array.from(stor.imp), baseLoadKWh: load, sector, bands, buyback: bbH, gridFee: this.num('fee'), kWac: c.kWac, mech: mech === 'sellAll' ? 'netOn' : mech });
      this.report({ sim, c, m, v, L, conv, W, bill, z, mech, sector, shp, stor, st, over });
      this.toast('المحاكاة خلصت ✓ ' + fmt(sim.year.eOut / 1000, 2) + ' MWh/سنة', 'ok'); this.status('تم ✓ — ' + W.meta.radDb + ' + ' + W.meta.meteoDb + ' (' + W.meta.years.join('–') + ')', true);
    }).catch(e => { this.status('خطأ: ' + esc(e.message) + ' — جرّب تحميل ملف PVGIS يدوياً بتبويب 1', false); })
      .then(() => { this.busy = false; this.emit(); });
  }
  report(R) {
    const s = R.sim, y = s.year, c = R.c, L = R.L; let h = '';
    h += '<div class="rep-h"><h1 style="margin:0;font-size:20px">Sanam PV Design Tool — تقرير المحاكاة</h1><div>' + esc(this.f.pname) + (this.f.client ? ' · ' + esc(this.f.client) : '') + ' · ' + new Date().toLocaleDateString('en-GB') + '</div></div>';
    if (R.stor && (R.st === 'offgrid' || R.st === 'offgrid_nb')) { const TY = R.stor.year, prSA = TY.eUser / (y.globInc * s.kWp);
      h += '<div class="kpis">' + kpi('الطاقة المستخدمة فعلياً (E_User)', fmt(TY.eUser / 1000, 2) + ' MWh/yr') + kpi('الإنتاج النوعي المفيد', fmt(TY.eUser / s.kWp, 0) + ' kWh/kWp/yr') + kpi('PR (منفصل، على المستخدم)', fmt(prSA * 100, 1) + ' %') +
        kpi('نسبة التغطية الشمسية', fmt(TY.solFrac * 100, 1) + ' %') + kpi('فائض ضايع (E_Unused)', fmt(TY.eUnused, 0) + ' kWh · ' + fmt(TY.eUnused / Math.max(1, TY.eAvail) * 100, 0) + '%') + kpi('قدرة النظام', fmt(c.kWp, 2) + ' kWp / ' + fmt(c.kWac, 2) + ' kWac') + '</div>' +
        '<div class="mute">بالنظام المنفصل، الإنتاج الممكن من الانفيرتر ' + fmt(y.eOut, 0) + ' kWh/سنة (' + fmt(y.eOut / s.kWp, 0) + ' kWh/kWp، PR ' + fmt(y.norm.PR * 100, 1) + '٪)، بس اللي بينستهلك فعلاً ' + fmt(TY.eUser, 0) + ' kWh. الباقي بيضيع لأنه ما في شبكة تاخده والبطارية مليانة. هاد طبيعي للمنفصل لأنه محجّم على أسوأ شهر. PR هون بتعريف PVsyst للأنظمة المنفصلة (على الطاقة المستخدمة).</div>'; }
    else h += '<div class="kpis">' + kpi('الطاقة المنتجة (E_Grid)', fmt(y.eOut / 1000, 2) + ' MWh/yr') + kpi('الإنتاج النوعي', fmt(y.eOut / s.kWp, 0) + ' kWh/kWp/yr') + kpi('Performance Ratio', fmt(y.norm.PR * 100, 2) + ' %') +
      kpi('قدرة النظام', fmt(c.kWp, 2) + ' kWp / ' + fmt(c.kWac, 2) + ' kWac') + (R.bill ? kpi('التوفير السنوي', fmt(R.bill.year.saving, 0) + ' JD') : '') + '</div>';
    h += '<div class="card diag-card"><h2>شكل النظام <small>Single-line diagram</small></h2>' + this.diagram(c) + '</div>';
    h += '<div class="grid"><div class="card"><h2>ملخص المشروع <small>Project summary</small></h2><table>' +
      tr('الموقع', esc(this.optLabel('city')) + ' — <span dir="ltr">' + this.num('lat') + '°N, ' + this.num('lon') + '°E, UTC+' + this.num('tz') + '</span>') +
      tr('بيانات الطقس', 'PVGIS 5.3 TMY — ' + R.W.meta.radDb + ' + ' + R.W.meta.meteoDb + ' ' + R.W.meta.years.join('–') + ' (offset ' + fmt(R.W.meta.offset, 3) + ' h)') +
      tr('Albedo', this.num('alb')) + tr('Transposition', 'Perez, circumsolar separate') + tr('الاتجاه', 'Tilt ' + this.num('tilt') + '° / Azimuth ' + this.num('az') + '°') +
      tr('حرارة التصميم', 'Voc: ' + this.num('tMin') + '°C · Vmpp max: ' + this.num('tWin') + '°C · Vmpp min: ' + this.num('tSum') + '°C') + '</table></div>';
    h += '<div class="card"><h2>خصائص النظام <small>System information</small></h2><table>' +
      tr('اللوح', esc(this.optLabel('modP')) + ' — ' + R.m.Pmax + ' Wp, η ' + fmt(R.m.eff * 100, 2) + '%') +
      tr('عدد الألواح', c.nModules + ' = ' + this.num('ns') + ' بالسلسلة × ' + this.num('nstr') + ' strings × ' + this.num('nInv') + ' انفيرتر') +
      tr('قدرة المصفوفة', fmt(c.kWp, 2) + ' kWp · ' + fmt(c.area, 1) + ' m²') +
      tr('الانفيرتر', this.num('nInv') + ' × ' + esc(this.optLabel('invP')) + ' — ' + R.v.Pac + ' kWac, ' + R.v.nMPPT + ' MPPT') +
      tr('Pnom ratio', fmt(c.kWp / c.kWac, 2)) + tr('كفاءة الانفيرتر', 'Max ' + fmt(R.v.maxEff * 100, 1) + '% / EURO ' + fmt(R.v.euroEff * 100, 1) + '% ← ' + esc(R.conv.src)) +
      tr('Array losses', 'Soiling ' + fmt(L.soiling * 100, 2) + '% · Uc ' + L.Uc + ' Uv ' + L.Uv + ' · LID ' + fmt(L.LID * 100, 2) + '% · Quality ' + fmt(L.quality * 100, 2) + '% · Mismatch ' + fmt(L.mismatch * 100, 2) + '% · Ohmic ' + fmt(L.ohmicSTC * 100, 2) + '% @STC') + '</table></div></div>';
    h += '<div class="card"><h2>شروط الـ Strings</h2><table><thead><tr><th>الشرط</th><th class="n">القيمة</th><th>الحد</th><th></th></tr></thead><tbody>';
    c.rows.forEach(r => { h += '<tr><td>' + esc(r.k) + '</td><td class="n">' + fmt(r.v, 1) + '</td><td dir="ltr" style="text-align:right">' + esc(r.lim) + '</td><td class="' + (r.warn ? '' : r.ok ? 'okc' : 'bad') + '">' + (r.warn ? '⚠ ' + esc(r.warn) : r.ok ? '✓' : '✗') + '</td></tr>'; });
    h += '</tbody></table></div>';
    h += '<div class="card"><h2>النتائج الرئيسية <small>Balances and main results</small></h2><table><thead><tr><th></th><th class="n">GlobHor<br>kWh/m²</th><th class="n">DiffHor<br>kWh/m²</th><th class="n">T_Amb<br>°C</th><th class="n">GlobInc<br>kWh/m²</th><th class="n">GlobEff<br>kWh/m²</th><th class="n">EArray<br>kWh</th><th class="n">E_Grid<br>kWh</th><th class="n">PR</th></tr></thead><tbody>';
    s.monthly.forEach((m, i) => { h += '<tr><td>' + MON[i] + '</td><td class="n">' + fmt(m.globHor) + '</td><td class="n">' + fmt(m.diffHor) + '</td><td class="n">' + fmt(m.tAmb, 2) + '</td><td class="n">' + fmt(m.globInc) + '</td><td class="n">' + fmt(m.globEff) + '</td><td class="n">' + fmt(m.eArray, 0) + '</td><td class="n">' + fmt(m.eOut, 0) + '</td><td class="n">' + fmt(m.norm.PR, 3) + '</td></tr>'; });
    h += '<tr><th>السنة</th><th class="n">' + fmt(y.globHor) + '</th><th class="n">' + fmt(y.diffHor) + '</th><th class="n">' + fmt(y.tAmb, 2) + '</th><th class="n">' + fmt(y.globInc) + '</th><th class="n">' + fmt(y.globEff) + '</th><th class="n">' + fmt(y.eArray, 0) + '</th><th class="n">' + fmt(y.eOut, 0) + '</th><th class="n">' + fmt(y.norm.PR, 3) + '</th></tr></tbody></table>' +
      '<div class="mute">نفس تعاريف PVsyst: GlobEff بعد IAM والغبار، وEArray طاقة المصفوفة على MPP، وE_Grid الطاقة بعد الانفيرتر، وPR = Yf / Yr.</div></div>';
    h += '<div class="grid"><div class="card"><h2>الإنتاج المعياري <small>Normalized productions (per kWp)</small></h2><canvas id="cN" width="640" height="260" dir="ltr"></canvas>' +
      '<div class="mute">Yf = ' + fmt(y.norm.Yf, 2) + ' · Ls (system) = ' + fmt(y.norm.Ls, 2) + ' · Lc (array) = ' + fmt(y.norm.Lc, 2) + ' kWh/kWp/day</div></div>';
    h += '<div class="card"><h2>Performance Ratio</h2><canvas id="cP" width="640" height="260" dir="ltr"></canvas></div></div>';
    h += '<div class="card"><h2>مخطط الخسائر <small>Loss diagram over the whole year</small></h2>' + lossDiagram(s, c) + '</div>';
    if (R.stor && R.stor.nb) { const TY = R.stor.year;
      h += '<div class="card"><h2>النظام المنفصل بدون بطاريات <small>Stand-alone, PV direct — no storage</small></h2>';
      h += '<div class="kpis">' + kpi('نسبة التغطية الشمسية (SolFrac)', fmt(TY.solFrac * 100, 1) + ' %') + kpi('E_Load', fmt(TY.eLoad, 0) + ' kWh') + kpi('E_User من الشمس مباشرة', fmt(TY.eUser, 0) + ' kWh') +
        kpi('E_Miss (نقص)', fmt(TY.eMiss, 0) + ' kWh · ' + TY.hMiss + ' ساعة') + kpi('E_Unused (فائض ضايع)', fmt(TY.eUnused, 0) + ' kWh') + '</div>';
      h += '<div class="nobat">🔋 البطاريات غير محسوبة بهذا التقرير: النظام بدون تخزين. كل حمل خارج ساعات الشمس، أو أكبر من إنتاج الألواح بنفس الساعة، بيطلع ضمن E_Miss.' + (R.over ? ' <b class="bad">في ' + R.over + ' ساعة الحمل أعلى من قدرة الانفيرتر ' + fmt(c.kWac, 1) + ' kW.</b>' : '') + '</div>';
      h += '<table><thead><tr><th></th><th class="n">E_Avail</th><th class="n">E_Load</th><th class="n">E_User</th><th class="n">E_Miss</th><th class="n">E_Unused</th><th class="n">SolFrac</th></tr></thead><tbody>';
      R.stor.monthly.forEach((m, i) => { h += '<tr><td>' + MON[i] + '</td><td class="n">' + fmt(m.eAvail, 0) + '</td><td class="n">' + fmt(m.eLoad, 0) + '</td><td class="n">' + fmt(m.eUser, 0) + '</td><td class="n">' + fmt(m.eMiss, 0) + '</td><td class="n">' + fmt(m.eUnused, 0) + '</td><td class="n">' + fmt(m.solFrac * 100, 1) + '%</td></tr>'; });
      h += '<tr><th>السنة</th><th class="n">' + fmt(TY.eAvail, 0) + '</th><th class="n">' + fmt(TY.eLoad, 0) + '</th><th class="n">' + fmt(TY.eUser, 0) + '</th><th class="n">' + fmt(TY.eMiss, 0) + '</th><th class="n">' + fmt(TY.eUnused, 0) + '</th><th class="n">' + fmt(TY.solFrac * 100, 1) + '%</th></tr></tbody></table></div>'; }
    else if (R.stor) { const T = R.stor, TY = T.year, BK = T.bank, isOff = R.st === 'offgrid';
      h += '<div class="card"><h2>' + (isOff ? 'النظام المنفصل والبطاريات <small>Stand-alone system — PVsyst balances</small>' : 'الهجين والبطاريات <small>Grid + storage</small>') + '</h2>';
      h += '<div class="kpis">' + kpi('نسبة التغطية الشمسية (SolFrac)', fmt(TY.solFrac * 100, 1) + ' %') + kpi('E_Load', fmt(TY.eLoad, 0) + ' kWh') + kpi('E_User من الشمس والبطارية', fmt(TY.eUser, 0) + ' kWh') +
        (isOff ? kpi('E_Miss (نقص)', fmt(TY.eMiss, 0) + ' kWh · ' + TY.hMiss + ' ساعة') + kpi('أحمال مفصولة (غير حرجة)', fmt(TY.eShed, 0) + ' kWh') + kpi('E_Unused (فائض ضايع)', fmt(TY.eUnused, 0) + ' kWh')
          : kpi('استجرار من الشبكة', fmt(TY.eImport, 0) + ' kWh') + kpi('تصدير للشبكة', fmt(TY.eExport, 0) + ' kWh') + kpi('فائض منقطع', fmt(TY.eUnused, 0) + ' kWh')) +
        kpi('البطاريات: صافي / اسمي', fmt(BK.kWh * (BK.chargeStop - BK.socMin), 1) + ' / ' + fmt(BK.kWh, 1) + ' kWh') + kpi('دورات البطارية/سنة', fmt(TY.cycles, 0)) + '</div>';
      h += '<div class="mute">البنك: ' + BK.n + ' وحدة = ' + fmt(BK.kWh, 2) + ' kWh، SOC بين ' + fmt(BK.socMin * 100, 0) + '٪ و' + fmt(BK.chargeStop * 100, 0) + '٪، كفاءة الشحن والتفريغ ' + fmt(BK.rte * 100, 0) + '٪، وحد القدرة ' + fmt(T.pB, 1) + ' kW. الأحمال غير الحرجة بتنفصل تحت SOC ' + fmt(BK.shedSOC * 100, 0) + '٪.' + (R.over ? ' <b class="bad">في ' + R.over + ' ساعة الحمل أعلى من قدرة الانفيرتر ' + fmt(c.kWac, 1) + ' kW.</b>' : '') + '</div>';
      h += '<table><thead><tr><th></th><th class="n">E_Avail</th><th class="n">E_Load</th><th class="n">E_User</th>' + (isOff ? '<th class="n">E_Miss</th><th class="n">مفصول</th><th class="n">E_Unused</th>' : '<th class="n">من الشبكة</th><th class="n">للشبكة</th><th class="n">منقطع</th>') + '<th class="n">شحن</th><th class="n">تفريغ</th><th class="n">SOC أدنى</th><th class="n">SolFrac</th></tr></thead><tbody>';
      T.monthly.forEach((m, i) => { h += '<tr><td>' + MON[i] + '</td><td class="n">' + fmt(m.eAvail, 0) + '</td><td class="n">' + fmt(m.eLoad, 0) + '</td><td class="n">' + fmt(m.eUser, 0) + '</td>' +
        (isOff ? '<td class="n">' + fmt(m.eMiss, 0) + '</td><td class="n">' + fmt(m.eShed, 0) + '</td><td class="n">' + fmt(m.eUnused, 0) + '</td>' : '<td class="n">' + fmt(m.eImport, 0) + '</td><td class="n">' + fmt(m.eExport, 0) + '</td><td class="n">' + fmt(m.eUnused, 0) + '</td>') +
        '<td class="n">' + fmt(m.eBatIn, 0) + '</td><td class="n">' + fmt(m.eBatOut, 0) + '</td><td class="n">' + fmt(m.socMin * 100, 0) + '%</td><td class="n">' + fmt(m.solFrac * 100, 1) + '%</td></tr>'; });
      h += '<tr><th>السنة</th><th class="n">' + fmt(TY.eAvail, 0) + '</th><th class="n">' + fmt(TY.eLoad, 0) + '</th><th class="n">' + fmt(TY.eUser, 0) + '</th>' + (isOff ? '<th class="n">' + fmt(TY.eMiss, 0) + '</th><th class="n">' + fmt(TY.eShed, 0) + '</th><th class="n">' + fmt(TY.eUnused, 0) + '</th>' : '<th class="n">' + fmt(TY.eImport, 0) + '</th><th class="n">' + fmt(TY.eExport, 0) + '</th><th class="n">' + fmt(TY.eUnused, 0) + '</th>') +
        '<th class="n">' + fmt(TY.eBatIn, 0) + '</th><th class="n">' + fmt(TY.eBatOut, 0) + '</th><th></th><th class="n">' + fmt(TY.solFrac * 100, 1) + '%</th></tr></tbody></table>';
      if (isOff) { const wr = (TY.eUnused + TY.eClip) / Math.max(1, TY.eAvail + TY.eClip); h += '<div class="' + (wr > 0.1 ? 'warn' : 'mute') + '">الإنتاج اللي ما انستعمل: فائض ضايع ' + fmt(TY.eUnused, 0) + ' kWh + قص الانفيرتر (Clipping) ' + fmt(TY.eClip, 0) + ' kWh = ' + fmt(wr * 100, 0) + '٪. الأحمال من الألواح مباشرة ' + fmt(TY.eDirect / Math.max(1, TY.eLoad) * 100, 0) + '٪، وحمل فوق قدرة الانفيرتر ' + fmt(TY.eOverAC, 0) + ' kWh.' + (wr > 0.1 ? ' في فائض كبير: جرّب "تحسين التكلفة" بتبويب النظام لتصغير الانفيرتر والبطاريات.' : '') + '</div>'; }
      h += '<canvas id="cS" width="1200" height="200" dir="ltr"></canvas><div class="mute">SOC اليومي (أدنى وأعلى) على مدار السنة. خسائر البطارية ' + fmt(TY.lBat, 0) + ' kWh، وخسائر الانفيرتر ' + fmt(TY.lInv, 0) + ' kWh. ' + (isOff ? 'بالنظام المنفصل، عمود E_Grid بجدول النتائج الرئيسية هو اللي ممكن يطلع من الانفيرتر لو انستهلك كله. الطاقة المستخدمة فعلياً هي E_User.' : '') + '</div></div>'; }
    if (R.bill) { const B = R.bill, Y = B.year;
      h += '<div class="card"><h2>الفاتورة الشهرية — ' + esc(J.MECH[R.mech].ar) + ' <small>' + esc(J.TARIFF[R.sector].ar) + '</small></h2>';
      if (R.z && R.z.warnings.length) h += '<div class="warn">⚠ ' + R.z.warnings.map(esc).join('<br>⚠ ') + '</div>';
      if (R.sector === 'dom_sub') h += '<div class="info">مالكو أنظمة الطاقة المتجددة المنزلية بيتحولوا عادةً للتعرفة غير المدعومة (هيكلة 2022). تأكد من الشركة الموزعة.</div>';
      h += '<table><thead><tr><th>الشهر</th><th class="n">استهلاك</th><th class="n">إنتاج</th><th class="n">استهلاك ذاتي</th><th class="n">مستجر ف1/ف2/ف3</th><th class="n">مصدّر ف1/ف2/ف3</th><th class="n">قبل JD</th><th class="n">طاقة JD</th><th class="n">فائض JD</th><th class="n">مدوّر</th><th class="n">بدل شبكة</th><th class="n">المستحق JD</th></tr></thead><tbody>';
      B.months.forEach((r, i) => { h += '<tr><td>' + MON[i] + '</td><td class="n">' + fmt(r.load, 0) + '</td><td class="n">' + fmt(r.pv, 0) + '</td><td class="n">' + fmt(r.selfUse / Math.max(1, r.pv) * 100, 0) + '%</td><td class="n">' + r.imp.map(x => fmt(x, 0)).join('/') + '</td><td class="n">' + r.exp.map(x => fmt(x, 0)).join('/') + '</td><td class="n">' + fmt(r.before, 1) + '</td><td class="n">' + fmt(r.charge, 1) + '</td><td class="n">' + fmt(r.credit, 1) + '</td><td class="n">' + fmt(r.carryIn, 1) + '</td><td class="n">' + fmt(r.gridFee, 1) + '</td><td class="n"><b>' + fmt(r.pay, 1) + '</b></td></tr>'; });
      h += '<tr><th>السنة</th><th class="n">' + fmt(Y.load, 0) + '</th><th class="n">' + fmt(Y.pv, 0) + '</th><th class="n">' + fmt(Y.selfUse / Y.pv * 100, 0) + '%</th><th></th><th></th><th class="n">' + fmt(Y.before, 0) + '</th><th></th><th class="n">' + fmt(Y.credit, 0) + '</th><th></th><th class="n">' + fmt(Y.gridFee, 0) + '</th><th class="n">' + fmt(Y.pay, 0) + '</th></tr></tbody></table>' +
        '<div class="mute">الفترات: ف1 05–17، ف2 17–23، ف3 23–05 (' + esc(J.PERIODS.src) + '). بكل فترة الفائض بيترصّد بسعر ' + B.buyback + ' فلس، والصافي المستجر بيتحاسب على التعرفة. الرصيد بالدينار بيتدوّر وبيتصفّر آخر السنة (دليل الهيئة م10). الفائض ما بيغطي بدل الشبكة (' + fmt(B.fee, 1) + ' JD/ك.و/شهر). شكل الحمل: ' + esc(R.shp) + '، وهو افتراضي.</div></div>'; }
    if (this.lastE) h += '<div class="card"><h2>الكوابل والحمايات <small>Cables & protections</small></h2><div class="sldw">' + this.sldFull() + '</div>' + this.elecTables() + '</div>';
    h += this.roofReport() + this.costCard(R) + this.priceCard(c);
    this.out.rep = h; this.repData = { sim: s, soc: R.stor && !R.stor.nb ? R.stor.soc : null, id: Math.random() };
  }
  drawCharts() { if (!this.repData) return; drawNorm(this.repData.sim); drawPR(this.repData.sim); if (this.repData.soc) drawSOC(this.repData.soc); }
  bestPrice(kind, id) { const ps = this.DB.prices.filter(p => p.item_kind === kind && p.item_id === id); if (!ps.length) return null;
    ps.sort((a, b) => a.price_jod - b.price_jod); const p = ps[0], sp = this.DB.suppliers.filter(x => x.id === p.supplier_id)[0]; return { p, sup: sp ? sp.name : '—' }; }
  /* cables + protections (lib/engine/elec.js); with eAuto the DC/AC ohmic losses follow the cable sizing */
  cablePrice(kind, A, cores) { const r = (this.DB.cables || []).filter(x => x.kind === kind && +x.size_mm2 === +A && (kind !== 'ac' || +x.cores === +cores) && x.price_jod_m != null)[0];
    return r ? +r.price_jod_m : Math.round((0.075 * A * (cores || 1) + (kind === 'ac' ? 0.3 : kind === 'battery' ? 0.25 : kind === 'earth' ? 0.08 : 0.15)) * 100) / 100; }
  /* protection device price from the DB: smallest rating that fits (In, poles, breaking capacity, voltage), then the cheapest */
  protPrice(kind, In, poles, x) { x = x || {}; const vNum = t => { const m = String(t || '').match(/\d+(\.\d+)?/); return m ? +m[0] : null; };
    const rs = (this.DB.protections || []).filter(r => r.kind === kind && r.price_jod != null && (!In || r.rated_a == null || +r.rated_a >= In - 1e-9) && (!poles || r.poles == null || +r.poles >= poles - (/^(MCB|MCCB|ACB)$/.test(kind) && poles > 2 ? 1 : 0))
      && (!x.icu || r.icu_ka == null || +r.icu_ka >= x.icu) && (!x.V || vNum(r.voltage) == null || vNum(r.voltage) >= x.V - 1e-9));
    if (!rs.length) return null; rs.sort((a, b) => (+a.rated_a || 0) - (+b.rated_a || 0) || (+a.poles || 0) - (+b.poles || 0) || a.price_jod - b.price_jod || (b.verified ? 1 : 0) - (a.verified ? 1 : 0));
    const r = rs[0], sp = (this.DB.suppliers || []).find(z => z.id === r.supplier_id);
    return { jd: +r.price_jod, model: [r.brand, r.model].filter(Boolean).join(' '), sup: sp ? sp.name.split(' — ')[0] : 'تقدير سوق', verified: !!r.verified }; }
  elecUpd(c) { try { const m = this.mod(), v = this.inv(), ns = this.num('ns'), np = this.num('nstr'), ni = this.num('nInv') || 1; if (!c || !m.Isc || !v.Pac || !ns || !np) { this.lastE = null; return null; }
      const R = this.roof(), Y = R && R.pts.length > 2 ? this.roofLayout(R) : null, B = this.hasBat() ? this.bank() : null, dom = (this.f.sector || '').indexOf('dom') === 0;
      const drop = R && R.lay.dbPos ? R.lay.dbPos : (R && R.pts.length ? R.pts[0] : null), vert = (this.num('eFloors') || 0) * 3, hor = this.num('eRoomH') || 0;
      const base = { m, inv: v, nInv: ni, ns, nstr: np, perMPPT: c.perMPPT, V: c.V, kWp: c.kWp, kWac: c.kWac, stype: this.stype(), phase: this.f.iPh, price: (k, A, n) => this.cablePrice(k, A, n), pprice: (k, In, p, x) => this.protPrice(k, In, p, x),
        bat: B ? { V: B.V, maxA: v.bImax || (B.pKW * 1000 / Math.max(1, B.V) / ni) } : null };
      const P0 = { Ik: this.num('eIk') || (dom ? 6 : 10), dvDC: this.num('eDvDC') || 1.5, dvAC: this.num('eDvAC') || 1.5, fuseMax: this.num('eFuse') || 25, lBat: this.num('eLBat') || 2 };
      const manualL = this.num('eLDC'), run = (mode) => { // inverter on the roof next to the cable drop, in the electrical room, or where the user put it
        let pos = drop, dDC = 0, lAC = this.num('eLAC') || 10, lBat = P0.lBat;
        if (mode === 'roof') { dDC = 0; lAC = vert + hor + 3; if (B) lBat = vert + hor + 2; }
        else if (mode === 'room') { dDC = vert + hor; lAC = this.num('eRoomAC') || 3; }
        else { pos = R && R.lay.invPos ? R.lay.invPos : drop; dDC = this.num('eDrop') || 0; }
        const rt = Y && Y.n && pos && !manualL ? EL.routes(Y, RF.toW, pos, ns, dDC) : null;
        const E = EL.design(Object.assign({}, base, { lenDC: rt ? rt.map(r => r.L) : null, P: Object.assign({}, P0, { lAC, lBat, lDC: manualL || (20 + dDC) }) }));
        if (!E) return null; E.routes = rt; E.invAt = pos; E.mode = mode; E.lossVal = (E.pctDC * 0.6 * c.kWp * 1700 + E.pctAC * 0.6 * c.kWp * 1650) * 0.08 * 15; E.total = E.cabCost + E.lossVal; return E; };
      const want = this.f.eInvAt || 'auto', opts = ['roof', 'room'].concat(R && R.lay.invPos ? ['manual'] : []).map(run).filter(Boolean);
      let E = want === 'auto' ? (B ? opts.find(x => x.mode === 'room') : opts.slice().sort((a, b) => a.total - b.total)[0]) : opts.find(x => x.mode === want) || opts[0];
      if (!E) { this.lastE = null; return null; }
      E.opts = opts; E.dropPos = drop; E.vert = vert; E.hor = hor;
      E.why = want !== 'auto' ? 'المكان اللي اخترته.' : B ? 'في بطاريات: الانفيرتر والبطاريات بغرفة الكهرباء (البطارية لازم بمكان داخلي مهوّى وكابلها قصير).' : 'الأرخص بتكلفة الكوابل + قيمة خسائرها على 15 سنة.';
      this.lastE = E;
      if (this.f.eAuto !== '0') { const d = +(E.pctDC * 100).toFixed(2), a = +(E.pctAC * 100).toFixed(2); if (this.num('ohm') !== d) this.set('ohm', d); if (this.num('acOhm') !== a) this.set('acOhm', a); }
      return E; } catch (e) { this.lastE = null; return null; } }
  sldFull() { const E = this.lastE, c = this.lastC; if (!E || !c) return ''; const B = this.hasBat() ? this.bank() : null;
    return EL.sldSVG(E, { stype: this.stype(), kWp: c.kWp, kWac: c.kWac, nInv: this.num('nInv') || 1, ns: this.num('ns'), nStr: this.num('nstr') * (this.num('nInv') || 1), invName: (this.optLabel('invP') || '').split(' — ')[0], bat: B, batTxt: B ? (this.num('bN') + ' × ' + fmt(this.num('bK'), 2) + ' kWh · ' + fmt(B.V, 1) + ' V') : '' }); }
  elecTables() { const E = this.lastE; if (!E) return ''; let h = '<h3>الكوابل</h3><table><thead><tr><th>الكابل</th><th>المواصفة</th><th class="n">العدد</th><th class="n">الطول m</th><th class="n">التيار التصميمي A</th><th class="n">تحمّل الكابل Iz A</th><th class="n">هبوط الجهد</th><th class="n">خسارة عند STC</th></tr></thead><tbody>';
    const ML = { roof: 'على السطح عند نزول الكوابل', room: 'بغرفة الكهرباء', manual: 'المكان اللي حطيته' };
    h = '<h3>مكان الانفيرتر المقترح: ' + ML[E.mode] + '</h3><div class="mute">' + esc(E.why) + ' نزول من السطح ' + fmt(E.vert, 0) + ' m + مسافة أفقية للغرفة ' + fmt(E.hor, 0) + ' m.</div><table><thead><tr><th>الخيار</th><th class="n">الكوابل JD</th><th class="n">قيمة الخسائر 15 سنة JD</th><th class="n">المجموع JD</th><th class="n">DC / AC خسارة</th></tr></thead><tbody>' +
      E.opts.map(o => '<tr class="' + (o.mode === E.mode ? 'pk' : '') + '"><td>' + (o.mode === E.mode ? '⭐ ' : '') + ML[o.mode] + '</td><td class="n">' + fmt(o.cabCost, 0) + '</td><td class="n">' + fmt(o.lossVal, 0) + '</td><td class="n"><b>' + fmt(o.total, 0) + '</b></td><td class="n">' + fmt(o.pctDC * 100, 2) + '% / ' + fmt(o.pctAC * 100, 2) + '%</td></tr>').join('') + '</tbody></table>';
    h += '<h3>جدول الكوابل (العدد والأطوال والتكلفة)</h3><table><thead><tr><th>الكابل</th><th>من ← إلى</th><th>المواصفة</th><th class="n">عدد الخطوط</th><th class="n">طول الخط m</th><th class="n">الطول الكلي m</th><th class="n">JD/m</th><th class="n">التكلفة JD</th></tr></thead><tbody>' +
      E.sch.map(r => '<tr><td><b>' + r.k + '</b></td><td>' + r.from + ' ← ' + r.to + '</td><td>' + esc(r.spec) + '</td><td class="n">' + r.runs + '</td><td class="n">' + fmt(r.L, 1) + '</td><td class="n">' + fmt(r.tot, 0) + '</td><td class="n">' + fmt(r.pm, 2) + '</td><td class="n">' + fmt(r.cost, 0) + '</td></tr>').join('') +
      '<tr><th colspan="3">المجموع</th><th class="n">' + E.nRuns + '</th><th></th><th class="n">' + fmt(E.sch.reduce((a, r) => a + r.tot, 0), 0) + '</th><th></th><th class="n">' + fmt(E.cabCost, 0) + '</th></tr></tbody></table><div class="mute">الأسعار من جدول الكوابل بقاعدة البيانات (تقديرية لحد ما يتحدّث بعروض أسعار).</div>' + h;
    E.cab.forEach(x => { h += '<tr><td><b>' + x.k + '</b><div class="mute">' + esc(x.why) + '</div></td><td>' + esc(x.spec) + '</td><td class="n">' + x.n + '</td><td class="n">' + fmt(x.L, 1) + (x.Lmax > x.L + 0.5 ? ' (أطول ' + fmt(x.Lmax, 0) + ')' : '') + '</td><td class="n">' + fmt(x.Ireq, 1) + '</td><td class="n">' + fmt(x.Iz, 0) + '</td><td class="n">' + fmt(x.dv, 2) + '%</td><td class="n">' + (x.loss == null ? '—' : fmt(x.loss * 100, 2) + '%') + '</td></tr>'; });
    h += '</tbody></table><h3>الحمايات</h3><table><thead><tr><th>الجهة</th><th>العنصر</th><th>المواصفة الفنية</th><th class="n">العدد</th><th>الموديل · المورد</th><th class="n">سعر الوحدة JD</th><th class="n">التكلفة JD</th><th>ليش</th></tr></thead><tbody>';
    E.prot.forEach(x => { h += '<tr><td>' + x.side + '</td><td><b>' + x.k + '</b></td><td>' + esc(x.spec) + '</td><td class="n">' + x.n + '</td><td>' + (x.model ? esc(x.model) + '<div class="mute">' + esc(x.sup) + (x.est ? ' · تقديري' : ' · سعر منشور') + '</div>' : '<span class="mute">—</span>') + '</td><td class="n">' + (x.unit != null ? fmt(x.unit, 2) : '—') + '</td><td class="n">' + (x.cost != null ? fmt(x.cost, 1) : '—') + '</td><td class="mute">' + esc(x.why) + '</td></tr>'; });
    h += '<tr><th colspan="6">مجموع الحمايات</th><th class="n">' + fmt(E.protCost || 0, 0) + '</th><th></th></tr></tbody></table><div class="mute">الأسعار من جدول الحمايات بقاعدة البيانات: "سعر منشور" من موقع المورد، و"تقديري" لحد ما يتحدّث بعرض سعر. العداد من شركة التوزيع والتأريض مش داخلين بالمجموع.</div>';
    h += '<h3>مقارنة أنواع الحمايات واختيار الأمثل</h3><div class="pcmps">' + E.prot.filter(x => x.cmp).map(x => x.cmp.map(([t, rows, pk]) => EL.cmpTable(t, rows, pk, esc)).join('')).join('') + '</div>';
    h += (E.notes.length ? '<div class="mute">' + E.notes.map(esc).join('<br>') + '</div>' : '') + '<div class="mute">خسارة الكوابل: DC ' + fmt(E.pctDC * 100, 2) + '٪ وAC ' + fmt(E.pctAC * 100, 2) + '٪ عند STC' + (this.f.eAuto !== '0' ? '، وهي اللي داخلة بالمحاكاة (Ohmic wiring loss و AC ohmic loss).' : '. (الحساب التلقائي للخسائر مطفي، المحاكاة بتستعمل القيم اليدوية.)') + '</div>';
    return h; }
  roof() { return RF.parseRoof(this.f.roof); }
  roofSet(R) { this.set('roof', JSON.stringify(R)); this.RC = null;
    if (R.pts.length > 2 && R.lay.azMode !== 'manual') { const a = RF.layAz(R); if (this.num('az') !== a) { this.set('az', a); this.autoLater(); } }
    this.emit(); }
  roofLayout(R) { R = R || this.roof(); if (!R || R.pts.length < 3) return null; const m0 = this.mod(), m = m0.L && m0.W ? m0 : (this.getModSpec(this.f.modP) || { L: 2.382, W: 1.134, Pmax: 620 }), n = this.lastC ? this.lastC.nModules : null, t = this.num('tilt') || 0,
      k = [this.f.roof, t, m.L, m.W, m.Pmax, n, this.num('lat'), this.f.mount].join('|'); this.RC = this.RC || {};
    if (this.RC.k !== k) this.RC = { k, Y: RF.layout(R, { tilt: t, L: Math.max(m.L || 0, m.W || 0), W: Math.min(m.L || 0, m.W || 0), Pmax: m.Pmax, nTarget: n, lat: this.num('lat') || 32, single: R.lay.struct === 'multi' ? false : R.lay.struct === 'single' ? true : this.f.mount !== 'ground' }) };
    return this.RC.Y; }
  roofShade() { const R = this.roof(), Y = this.roofLayout(R); if (!Y || !Y.n) return null; const k = this.RC.k + '|' + this.num('ns');
    if (this.RC.sk !== k) { this.RC.sk = k; this.RC.T = RF.shading(R, Y, { ns: this.num('ns') || 1 }); } return this.RC.T; }
  /* use the module count drawn on the roof in the system design: strings re-balanced, the inverter kept if it can take them,
     else more units of it, else the smallest suitable inverter (same phase; within the DC/AC limit; EMRC allowance for grid/hybrid) */
  useRoofCount() { const R = this.roof(), Y = R && R.pts.length > 2 ? this.roofLayout(R) : null, m = this.mod(), T = this.T();
    if (!Y || !Y.n) return { ok: false, msg: 'ما في ألواح على السطح.' }; if (!m.Pmax) return { ok: false, msg: 'اختار اللوح أول (تبويب النظام).' };
    const N = Y.n, off = this.isOff(), lim = off ? (this.num('dcMaxOG') || 2) : (this.dcacLim() || 1.3), ph = off ? this.f.iPh : this.subPh(), cur = this.f.invP, curN = this.num('nInv') || 1;
    const z = off ? null : this.emrcSize(), allow = z && z.kwAllowed > 0 ? z.kwAllowed : Infinity, minAC = off && this.lastC ? this.lastC.kWac : 0;
    const cfg = (val, sp, n) => { if (!sp || !sp.Pac) return null; const a = S.autoLayout(m, sp, n, N, T); if (!a.ok || !a.nModules) return null;
      const kac = n * sp.Pac, dcac = a.nModules * m.Pmax / 1000 / kac, pdc = (sp.Pdc || sp.Pac * (off ? lim : 1.3)) * n;
      return { val, sp, n, a, kac, dcac, ok: a.nModules >= Math.ceil(N * 0.95) && dcac <= lim + 1e-6 && a.nModules * m.Pmax / 1000 <= pdc + 1e-6 && kac >= minAC - 1e-6, emrc: kac <= allow + 1e-6 }; };
    const L = []; const curSp = this.inv(); for (let n = curN; n <= curN + 8; n++) { const c = cfg(cur, curSp, n); if (c) L.push(c); }
    this.invCands().filter(x => x.val !== cur && this.compatInv(x.s) && (!ph || !x.s.phase || x.s.phase === ph)).forEach(x => { for (let n = 1; n <= 6; n++) { const c = cfg(x.val, x.s, n); if (c) L.push(c); } });
    const good = L.filter(c => c.ok && c.emrc), pickFrom = good.length ? good : L.filter(c => c.ok);
    pickFrom.sort((a, b) => (a.val === cur ? 0 : 1) - (b.val === cur ? 0 : 1) || a.kac - b.kac || b.a.nModules - a.a.nModules);
    const best = pickFrom[0] || L.sort((a, b) => b.a.nModules - a.a.nModules)[0]; if (!best) return { ok: false, msg: 'ما لقيت انفيرتر بيستوعب ' + N + ' لوح بهاللوح المختار.' };
    const changed = best.val !== cur;
    if (changed) { this.set('invP', best.val); this.setInv(); } this.set('nInv', best.n); this.set('ns', best.a.ns); this.set('nstr', best.a.nstrPerInv);
    const n2 = JSON.parse(this.f.roof); n2.lay.fill = 'count'; n2.lay.nMan = best.a.nModules; n2.lay.cs = Y.single ? 1 : 0; this.set('roof', JSON.stringify(n2));
    this.sysCheck(); this.emit();
    const msg = '✓ التصميم صار ' + best.a.nModules + ' لوح = ' + fmt(best.a.nModules * m.Pmax / 1000, 2) + ' kWp: ' + best.a.ns + ' لوح بالـ string × ' + best.a.nstrPerInv + ' string × ' + best.n + ' انفيرتر' +
      (changed ? ' (انفيرتر جديد: ' + (this.optName(best.val) || best.val) + ')' : '') + ' — DC/AC ' + fmt(best.dcac, 2) + '.' + (best.a.nModules < N ? ' انشال ' + (N - best.a.nModules) + ' لوح لأن الـ strings لازم تكون متساوية.' : '') +
      (!best.ok ? ' ⚠ ما في انفيرتر بيستوعب كل الألواح ضمن الحدود؛ هاد أقرب خيار.' : !best.emrc ? ' ⚠ قدرة الانفيرتر فوق المسموح من الهيئة (' + fmt(allow, 2) + ' kW).' : '') + ' شغّل المحاكاة من جديد.';
    return { ok: true, msg }; }
  /* annual near-shading loss for the current roof drawing (same PVsyst shading table and hourly simulation; 1 kWp reference) */
  shadeLoss() { const T = this.roofShade(), Y = this.RC && this.RC.Y; if (!T || !Y) return Promise.resolve(null); const k = this.RC.sk + '|' + this.num('lat') + '|' + this.num('lon');
    if (this.RC.lk === k && this.RC.loss) return Promise.resolve(this.RC.loss);
    return this.getWeather().then(json => { const W = PG.fromJSON(json, this.num('tz')).rows, base = { weather: W, module: { Pmax: 1000, gammaP: -0.35, eff: 0.21 }, nModules: 1, tilt: Y.tilt, azimuth: Y.az, site: this.site() };
      const a = C.simulate(base).year, b = C.simulate(Object.assign({}, base, { shade: RF.shadeAdapter(T) })).year;
      const out = { near: a.globInc > 0 ? (b.globInc - b.globShd) / b.globInc : 0, elec: b.eNom > 0 ? b.lShdEl / b.eNom : 0, yA: a.eOut, yB: b.eOut, tot: a.eOut > 0 ? 1 - b.eOut / a.eOut : 0, fd: T.fd };
      this.RC.lk = k; this.RC.loss = out; return out; }); }
  shadeSim() { try { return RF.shadeAdapter(this.roofShade()); } catch (e) { return null; } }
  roofReport() { const R = this.roof(), Y = this.roofLayout(R); if (!Y || !Y.n) return ''; const ST = RF.structure(Y, R.lay), T = this.roofShade(), hor = RF.horizon(R, Y);
    let h = '<div class="card"><h2>مخطط السطح والألواح والهيكل <small>' + Y.n + ' لوح · ' + Y.tables.length + ' طاولة · ' + Y.rows + ' صف · Az ' + fmt(Y.az, 1) + '° · Tilt ' + fmt(Y.tilt, 1) + '°</small></h2>' +
      '<div class="sldw">' + RF.planSVG(R, Y, { structure: true, st: ST }) + '</div></div>';
    h += '<div class="card"><h2>مقطع الهيكل المعدني <small>Section</small></h2><div class="sldw">' + RF.sectionSVG(Y, ST) + '</div><div class="sldw">' + RF.elevSVG(Y, ST) + '</div>' + this.bomTable(ST) + '</div>';
    if (T) h += '<div class="card"><h2>الظلال القريبة <small>Near shadings — PVsyst method</small></h2><div class="sldw">' + RF.sunPathSVG(this.num('lat') || 32, T, hor) + '</div>' +
      '<div class="mute">معامل ظل الإشعاع المنتشر (diffuse) ' + fmt(T.fd * 100, 1) + '٪، والانعكاس الأرضي ' + fmt(T.fa * 100, 1) + '٪. الطريقة: ' + (T.elec === 'strings' ? 'حسب السلاسل (fraction for electrical effect ' + fmt(T.kEl * 100, 0) + '٪)' : 'خطية (Linear)') + '.</div></div>';
    return h; }
  bomTable(ST) { if (!ST) return ''; let h = '<table><thead><tr><th>العنصر</th><th>المقطع</th><th class="n">العدد</th><th class="n">طول القطعة m</th><th class="n">الطول الكلي m</th><th class="n">الوزن kg</th></tr></thead><tbody>';
    ST.items.forEach(i => { h += '<tr><td>' + i.k + '</td><td>' + esc(i.p || '') + '</td><td class="n">' + i.n + '</td><td class="n">' + (i.l == null ? 'متغير' : fmt(i.l, 2)) + '</td><td class="n">' + fmt(i.tot, 1) + '</td><td class="n">' + fmt(i.w, 0) + '</td></tr>'; });
    h += '<tr><th colspan="4">مجموع الحديد</th><th class="n">' + fmt(ST.steelM, 0) + '</th><th class="n">' + fmt(ST.steelKg, 0) + '</th></tr></tbody></table>';
    h += '<table><tbody>' + ST.acc.map(a => '<tr><td>' + a.k + '</td><td class="n">' + a.n + '</td></tr>').join('') + '</tbody></table>';
    return h; }
  /* ---------- off-grid (with batteries) cost optimization ----------
     PV array fixed. Search smaller inverters (accepting clipping of the midday surplus that is wasted anyway) and fewer
     batteries; keep the solar fraction within `tol` points of the current design; rank by equipment cost. */
  eqCost(val, spec, n, kind) { const bp = val && val.indexOf('d:') === 0 ? this.bestPrice(kind, +val.slice(2)) : null;
    if (kind === 'inverter') return n * (bp && bp.p.unit === 'unit' ? bp.p.price_jod : PR.invCostEst(spec.kind, spec.Pac));
    const kWh = spec.kWh || this.num('bK') || 0; return n * (bp ? (bp.p.unit === 'kWh' ? bp.p.price_jod * kWh : bp.p.price_jod) : PR.batCostEst(kWh, spec.hv || (spec.V || 0) > 100)); }
  async optimize(tolPts) {
    const tol = (tolPts == null ? 1 : +tolPts) / 100, st = this.stype(); this.optRes = { busy: true }; this.emit();
    try {
      if (st !== 'offgrid') throw new Error('التحسين خاص بالنظام المنفصل مع بطاريات.');
      const c = this.sysCheck(); if (!c || !c.nModules) throw new Error('صمّم النظام أول (تبويب النظام).');
      if (!this.num('bK')) throw new Error('اختار البطارية أول.');
      const json = await this.getWeather(), W = PG.fromJSON(json, this.num('tz')), m = this.mod(), v0 = this.inv(), L = this.losses();
      const sim = C.simulate({ weather: W.rows, module: { Pmax: m.Pmax, gammaP: m.gammaP, eff: m.eff }, nModules: c.nModules, tilt: this.num('tilt'), azimuth: this.num('az'),
        convKW: c.kWac, converter: C.fitConv(v0.maxEff, v0.euroEff), site: this.site(), losses: L, lowIrrK: this.num('kIrr'), shade: this.shadeSim() });
      const pf = this.dailyProfile(), pc = this.dailyProfile(true), load = W.rows.map(r => pf[Math.floor(r.hour) % 24]), crit = W.rows.map(r => pc[Math.floor(r.hour) % 24]);
      const pdc = sim.hourly.map(h => h.pdc), months = W.rows.map(r => r.month), B0 = this.bank(), unit = this.num('bK'), batSpec = this.getBatSpec(this.f.batP) || { kWh: unit, V: B0.V };
      const peak = Math.max.apply(null, pf), convC = {}, T = this.T();
      const run = (spec, n, nb, ratio) => { const k = spec.maxEff + '|' + spec.euroEff; convC[k] = convC[k] || C.fitConv(spec.maxEff || 0.97, spec.euroEff || 0.95);
        const kWh = nb * unit, pB = this.num('bI') ? nb * this.num('bI') * B0.V / 1000 : kWh * 0.5, lim = (spec.bImax && B0.V < 100) ? spec.bImax * n * B0.V / 1000 : Infinity, p = Math.min(pB, lim);
        return C.simulateStorage({ pdc, pvScale: ratio, load, critical: crit, months, kWac: n * spec.Pac, converter: convC[k], acLimit: true, pvMaxKW: (spec.Pdc || spec.Pac * 1.3) * n,
          battery: { kWh, socMin: B0.socMin, chargeStop: B0.chargeStop, shedSOC: B0.shedSOC, rte: B0.rte, maxChargeKW: p, maxDischargeKW: p }, mode: 'offgrid' }).year; };
      const bpM = this.f.modP && this.f.modP.indexOf('d:') === 0 ? this.bestPrice('module', +this.f.modP.slice(2)) : null, modJD = bpM ? (bpM.p.unit === 'W' ? bpM.p.price_jod * m.Pmax : bpM.p.price_jod) : null;
      const row = (val, spec, n, nb, ratio, nMods, lay, Y) => { Y = Y || run(spec, n, nb, ratio); const ci = this.eqCost(val, spec, n, 'inverter'), cb = this.eqCost(this.f.batP, batSpec, nb, 'battery'), cp = PR.pvCostEst(nMods, m.Pmax, modJD);
        return { val, name: val ? this.optName(val) : '', spec, n, nb, kWac: n * spec.Pac, kWh: nb * unit, nMods, kWp: nMods * m.Pmax / 1000, lay, Y, cInv: ci, cBat: cb, cPV: cp, cost: ci + cb + cp }; };
      const base = row(this.f.invP, Object.assign({}, this.curInv, v0), this.num('nInv') || 1, this.num('bN') || 1, 1, c.nModules, { ns: this.num('ns'), nstr: this.num('nstr') });
      const minAC = peak * 1.05, need = base.Y.solFrac - tol - 1e-9, nbMax = base.nb, L2 = [];
      const ph = this.f.iPh, dcMax = this.num('dcMaxOG') || 2, capOG = sp => { const w = S.nsWindow(m, sp, T); return Math.max(1, Math.min(w.nsMax * w.npMaxMPPT * sp.nMPPT, Math.floor(sp.Pac * dcMax * 1000 / m.Pmax + 1e-9))); };
      this.invCands(['offgrid']).filter(x => this.compatInv(x.s) && (!ph || x.s.phase === ph)).forEach(x => { for (let n = 1; n <= 4; n++) { const ac = n * x.s.Pac; if (ac < minAC - 1e-6 || ac > c.kWac + 1e-6) continue;
        const key = x.s.Pac + '|' + n + '|' + (x.name || '').replace(/[^A-Za-z0-9.]/g, '').slice(0, 14); if (L2.some(q => q.key === key)) continue; L2.push({ x, n, key }); } });
      if (!L2.some(q => q.x.val === this.f.invP && q.n === base.n)) L2.push({ x: { val: this.f.invP, s: base.spec }, n: base.n });
      const all = []; let tried = 0;
      L2.forEach(q => { const maxM = Math.min(c.nModules, capOG(q.x.s) * q.n), done = {};
        for (let fr = 1; fr >= 0.45; fr -= 0.05) { const tgt = Math.floor(Math.min(maxM, c.nModules * fr) + 1e-9); if (tgt < 1) continue; const a = S.autoLayout(m, q.x.s, q.n, tgt, T); if (!a.ok || done[a.nModules] || a.nModules > maxM) continue; done[a.nModules] = 1;
          const ratio = a.nModules / c.nModules; let lo = 1, hi = nbMax, best = null; // smallest battery bank that keeps the coverage (coverage grows with the bank)
          const Yh = run(q.x.s, q.n, hi, ratio); tried++; if (Yh.solFrac < need) continue; best = { nb: hi, Y: Yh };
          while (lo < hi) { const mid = Math.floor((lo + hi) / 2), Ym = run(q.x.s, q.n, mid, ratio); tried++; if (Ym.solFrac >= need) { hi = mid; best = { nb: mid, Y: Ym }; } else lo = mid + 1; }
          all.push(row(q.x.val, q.x.s, q.n, best.nb, ratio, a.nModules, { ns: a.ns, nstr: a.nstrPerInv }, best.Y)); } });
      const ok = all.filter(r => r.cost < base.cost - 1); ok.sort((a, b) => a.cost - b.cost || b.Y.solFrac - a.Y.solFrac);
      // keep only options whose string layout passes the PVsyst sizing checks (try each on the real fields, then restore)
      const snap = {}; ['invP', 'nInv', 'ns', 'nstr'].forEach(k => { snap[k] = this.f[k]; }); const list = [], seen = {};
      for (const r of ok) { if (list.length >= 8) break; const k = r.val + '|' + r.n + '|' + r.nb + '|' + r.nMods; if (seen[k]) continue; seen[k] = 1;
        this.set('invP', r.val); this.setInv(); this.set('nInv', r.n); this.set('ns', r.lay.ns); this.set('nstr', r.lay.nstr); this.sysCheck(); if (this.sysOk === 'ok') list.push(r); }
      Object.keys(snap).forEach(k => this.set(k, snap[k])); this.setInv(); this.set('nInv', snap.nInv); this.set('ns', snap.ns); this.set('nstr', snap.nstr); this.sysCheck();
      this.optRes = { base, list, tol, peak, minAC, dcMax, tried, shift: this.shiftSuggest(base) };
    } catch (e) { this.optRes = { err: e.message }; }
    this.emit(); }
  optName(val) { if (val.indexOf('d:') === 0) { const r = this.dbRow('inverters', val); return r ? r.brand + ' ' + r.model : val; } const p = S.INVERTERS[val.slice(2)]; return p ? p.name : val; }
  applyOpt(i) { const r = this.optRes && this.optRes.list[i]; if (!r) return; this.set('invP', r.val); this.setInv(); this.set('nInv', r.n); this.set('ns', r.lay.ns); this.set('nstr', r.lay.nstr); this.set('bN', r.nb);
    this.batUpd(); this.sysCheck(); this.optRes = Object.assign({}, this.optRes, { applied: i }); this.toast('انطبق الخيار ✓ شغّل المحاكاة من جديد', 'ok'); this.emit(); }
  /* daytime surplus that is wasted → suggest moving flexible (non-critical) loads into the sunny hours */
  shiftSuggest(base) { if (this.cmode !== 'loads') return null;
    const rows = this.loadRows(), day = h => h >= 9 && h < 16, out = [], un = base.Y.eUnused / 365; let room = un * 0.8;
    rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.c && r.W && r.q).map(({ r, i }) => { const hs = this.hoursOf(r.a, r.b), n = hs.length, off = hs.filter(h => !day(h)).length;
      return { i, r, n, off, e: r.W * r.q * r.f * n / 1000 }; }).filter(x => x.n && x.n <= 7 && x.off && x.n < 24).sort((a, b) => b.e - a.e).forEach(x => {
      if (x.e > room) return; room -= x.e; const a = Math.round(12.5 - x.n / 2); out.push({ i: x.i, n: x.r.n || ('حمل ' + (x.i + 1)), e: x.e, from: x.r.a + '–' + x.r.b, to: a + '–' + (a + x.n) }); });
    return { list: out, unusedDay: un }; }
  applyShift() { const S2 = this.optRes && this.optRes.shift; if (!S2 || !S2.list.length) return; const mv = {}; S2.list.forEach(x => { mv[x.i] = x.to.split('–').map(Number); }); this.loads = this.loads.map((l, i) => mv[i] ? Object.assign({}, l, { a: mv[i][0], b: mv[i][1] }) : l);
    const tol = this.optRes.tol * 100; this.sumLoads(); this.emrc(); clearTimeout(this.adT); this.toast('انتقلت الأحمال المرنة للنهار ✓ جاري إعادة التصميم', 'ok');
    return this.autoD().then(() => this.optimize(tol)); }
  priceEst(c) { c = c || this.lastC; if (!c || !c.kWp) return null; const has = this.hasBat(), B = has ? this.bank() : null;
    return PR.estimate({ kWp: c.kWp, kWac: c.kWac, stype: this.stype(), phase: this.isOff() ? this.f.iPh : this.subPh(), sector: this.f.sector, batKWh: B ? B.kWh : 0, batHV: B ? B.V > 100 : false, mount: this.f.mount || 'roof', k: this.num('pk') || 1 }); }
  priceCard(c) { const E = this.priceEst(c); if (!E) return ''; const r3 = v => fmt(Math.round(v / 10) * 10, 0);
    let h = '<div class="card price-card"><h2>السعر التقديري للنظام <small>تسليم مفتاح — ' + esc(E.segAr) + '</small></h2>';
    h += '<div class="kpis">' + kpi('تقدير منخفض', r3(E.tot[0]) + ' JD') + kpi('التقدير النموذجي', r3(E.tot[1]) + ' JD') + kpi('تقدير مرتفع', r3(E.tot[2]) + ' JD') + kpi('سعر الواط', fmt(E.perW[1], 3) + ' JD/W') + '</div>';
    h += '<table><thead><tr><th>البند</th><th class="n">منخفض</th><th class="n">نموذجي</th><th class="n">مرتفع</th><th>ملاحظة</th></tr></thead><tbody>';
    E.lines.forEach(l => { h += '<tr><td>' + esc(l.k) + '</td><td class="n">' + r3(l.v[0]) + '</td><td class="n">' + r3(l.v[1]) + '</td><td class="n">' + r3(l.v[2]) + '</td><td class="mute">' + esc(l.note) + '</td></tr>'; });
    h += '<tr><th>المجموع</th><th class="n">' + r3(E.tot[0]) + '</th><th class="n">' + r3(E.tot[1]) + '</th><th class="n">' + r3(E.tot[2]) + '</th><th></th></tr></tbody></table>';
    h += '<div class="mute">طريقة الحساب: سعر الكيلوواط بينزل كل ما كبر النظام. أخذنا نقاط أسعار معروفة لكل فئة (منزلي سنغل فيز، منزلي 3 فاز، تجاري، مزارع)، وبين النقاط حسبنا بالنسبة والتناسب على مقياس لوغاريتمي. السعر بيشمل الألواح والانفيرتر والهيكل والكوابل والحمايات والتركيب والموافقات، والبطاريات لحالها. هاد تقدير أولي مش عرض سعر. المصادر: ' + esc(E.src) + '</div></div>';
    return h; }
  costCard(R) { const rows = [], miss = []; let tot = 0;
    const add = (sel, kind, tbl, qty, label, unitW) => { const v = this.f[sel] || ''; if (v.indexOf('d:') !== 0) { miss.push(label + ' (قالب عام)'); return; } const r = this.dbRow(tbl, v), bp = r && this.bestPrice(kind, r.id);
      if (!bp) { miss.push(label + ': ' + (r ? r.brand + ' ' + r.model : '') + ' بدون سعر'); return; } const u = bp.p.unit === 'W' ? bp.p.price_jod * (unitW || 0) : bp.p.unit === 'kWh' ? bp.p.price_jod * (r.capacity_kwh || 0) : bp.p.price_jod;
      rows.push([label, r.brand + ' ' + r.model, qty, u, qty * u, bp.sup, bp.p.quoted_on]); tot += qty * u; };
    add('modP', 'module', 'modules', R.c.nModules, 'ألواح', R.m.Pmax); add('invP', 'inverter', 'inverters', this.num('nInv') || 1, 'انفيرتر');
    if (R.stor && !R.stor.nb) add('batP', 'battery', 'batteries', R.stor.bank.n, 'بطاريات');
    let h = '<div class="card"><h2>تكلفة المعدات الرئيسية <small>من قاعدة الأسعار (أقل سعر لكل بند)</small></h2>';
    if (!this.sess) return h + '<div class="mute">سجّل دخول من "قاعدة البيانات" واختار المعدات منها عشان تطلع التكلفة.</div></div>';
    if (rows.length) { h += '<table><thead><tr><th>البند</th><th>الموديل</th><th class="n">الكمية</th><th class="n">سعر الوحدة JD</th><th class="n">المجموع JD</th><th>المورد</th><th>تاريخ السعر</th></tr></thead><tbody>';
      rows.forEach(r => { h += '<tr><td>' + r[0] + '</td><td>' + esc(r[1]) + '</td><td class="n">' + r[2] + '</td><td class="n">' + fmt(r[3], 2) + '</td><td class="n">' + fmt(r[4], 0) + '</td><td>' + esc(r[5]) + '</td><td>' + esc(r[6] || '') + '</td></tr>'; });
      h += '<tr><th colspan="4">المجموع (بدون الهيكل والكوابل والحمايات والتركيب)</th><th class="n">' + fmt(tot, 0) + '</th><th colspan="2"></th></tr></tbody></table>';
      if (R.bill && R.bill.year.saving > 0) h += '<div class="mute">فترة استرداد المعدات الرئيسية بس ≈ ' + fmt(tot / R.bill.year.saving, 1) + ' سنة، على التوفير السنوي ' + fmt(R.bill.year.saving, 0) + ' JD.</div>'; }
    if (miss.length) h += '<div class="mute">ناقص سعر: ' + miss.map(esc).join('، ') + '. ضيف السعر من "قاعدة البيانات" ← الأسعار.</div>';
    return h + '</div>'; }

  /* ---------- database CRUD ---------- */
  label(t, r) { if (!r) return '—'; if (t === 'suppliers') return r.name; if (t === 'prices') return r.item_label || ''; return r.brand + ' ' + r.model; }
  itemLabel(p) { const t = KIND2T[p.item_kind]; if (!t) return p.item_label || '—'; return this.label(t, this.DB[t].filter(r => r.id === p.item_id)[0]); }
  dbSave(t, id, body) { const q = id ? this.rest(t + '?id=eq.' + id, { method: 'PATCH', body }) : this.rest(t, { method: 'POST', body });
    return q.then(res => { const row = res && res[0]; if (row) { if (id) this.DB[t] = this.DB[t].map(x => x.id === row.id ? row : x); else this.DB[t] = this.DB[t].concat([row]); }
      this.toast('انحفظ بقاعدة البيانات ✓', 'ok'); this.emit(); return row; }); }
  dbDelete(t, id) { return this.rest(t + '?id=eq.' + id, { method: 'DELETE' }).then(() => { this.DB[t] = this.DB[t].filter(x => x.id !== id); this.toast('انحذف', 'ok'); this.emit(); }); }

  /* ---------- auto design (bills or loads) — Madama methodology ---------- */
  invCands(kinds) { const t = this.stype(), ok = kinds || (this.isOff() ? ['offgrid'] : t === 'hybrid' ? ['hybrid', 'offgrid'] : ['grid']), L = [];
    this.DB.inverters.forEach(r => L.push({ val: 'd:' + r.id, s: this.getInvSpec('d:' + r.id), name: r.brand + ' ' + r.model }));
    Object.keys(S.INVERTERS).forEach(k => L.push({ val: 'p:' + k, s: S.INVERTERS[k], name: S.INVERTERS[k].name }));
    let c = L.filter(x => ok.indexOf(x.s.kind) >= 0 && x.s.Pac > 0); if (!c.length && t === 'grid') c = L.filter(x => x.s.Pac > 0); return c; }
  capMods(sp) { const w = S.nsWindow(this.mod(), sp, this.T()), pdc = sp.Pdc || sp.Pac * 1.3; return Math.max(1, Math.min(w.nsMax * w.npMaxMPPT * sp.nMPPT, Math.floor(pdc * 1000 / this.num('mP') + 1e-9))); }
  compatInv(s) { const w = S.nsWindow(this.mod(), s, this.T()); return w.npMaxMPPT >= 1 && w.nsMin <= w.nsMax && (!this.NEEDMOD || w.nsMin <= Math.max(this.NEEDMOD, 1)); }
  pickInv(req, mode, kinds) { const all = this.invCands(kinds).filter(x => this.compatInv(x.s)), ph = this.subPh(), same = all.filter(x => x.s.phase === ph);
    if (this.isOff()) return this.pickFrom(all, req, mode, true); // off-grid: no grid phase to match, take the smallest inverter that fits
    let r = this.pickFrom(same, req, mode, !(this.stype() === 'grid' && !kinds)); // the inverter phase must match the subscription phase
    if (!r && this.stype() === 'grid' && !kinds) r = this.pickInv(req, mode, ['grid', 'hybrid']); return r; }
  pickFrom(c, req, mode, last) { let best = null; if (!c.length) return null;
    c.forEach(x => { const P = x.s.Pac; let n, tot, score;
      if (mode === 'cap') { n = Math.floor(req / P + 1e-9); if (n < 1) return; n = Math.min(n, 10); tot = n * P; score = [-tot, n, P]; }
      else { n = Math.ceil(req / P - 1e-9); if (this.NEEDMOD) n = Math.max(n, Math.ceil(this.NEEDMOD / this.capMods(x.s) - 1e-9)); if (n > 10) return; tot = n * P; score = [n, tot, 0]; }
      if (!best || score[0] < best.sc[0] - 1e-9 || (Math.abs(score[0] - best.sc[0]) < 1e-9 && (score[1] < best.sc[1] - 1e-9 || (Math.abs(score[1] - best.sc[1]) < 1e-9 && score[2] < best.sc[2])))) best = { x, n, sc: score }; });
    if (!best && mode === 'cap' && last) { const mn = c.slice().sort((a, b) => a.s.Pac - b.s.Pac)[0]; best = { x: mn, n: 1, over: true }; }
    return best; }
  modCands() { const L = [];
    this.DB.modules.forEach(r => { const bp = this.bestPrice('module', r.id); if (!bp) return; const jw = bp.p.unit === 'W' ? bp.p.price_jod : bp.p.price_jod / r.pmax_w; L.push({ val: 'd:' + r.id, k: [0, jw], why: 'أرخص سعر للواط بالقاعدة (' + fmt(jw * 1000, 1) + ' فلس/W)' }); });
    this.DB.modules.forEach(r => { if (L.some(x => x.val === 'd:' + r.id)) return; L.push({ val: 'd:' + r.id, k: [r.verified ? 1 : 2, -r.pmax_w], why: 'ما إله سعر بالقاعدة؛ أعلى قدرة ' + (r.verified ? 'متحقق منها' : '') }); });
    L.sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1]);
    Object.keys(S.MODULES).forEach(k => L.push({ val: 'p:' + k, why: 'قالب عام، سجّل دخول عشان يختار من القاعدة' })); return L; }
  pickBat() { const v = this.inv(), cur = this.f.batP, fits = V => !v.bVmin || (V >= v.bVmin && V <= v.bVmax);
    if (this.num('bV') && fits(this.num('bV'))) return;
    const L = this.DB.batteries.map(r => ({ val: 'd:' + r.id, V: r.voltage_nom })).concat(Object.keys(S.BATTERIES).map(k => ({ val: 'p:' + k, V: S.BATTERIES[k].V })));
    const ib = (this.optLabel('invP') || '').split(' ')[0].toLowerCase(), bb = b => b.val.indexOf('d:') === 0 ? (this.dbRow('batteries', b.val).brand || '').toLowerCase() : S.BATTERIES[b.val.slice(2)].name.split(' ')[0].toLowerCase();
    const F = L.filter(b => fits(b.V)), f = F.filter(b => bb(b) === ib)[0] || F[0]; if (f && f.val !== cur) { this.set('batP', f.val); this.setBat(); } }
  yieldSpec() { const m = this.mod(), g = m.gammaP || -0.30, ef = isFinite(m.eff) ? m.eff : 0.21, L = this.losses(), k = [this.num('lat'), this.num('lon'), this.num('tz'), this.num('alb'), this.num('tilt'), this.num('az'), g, JSON.stringify(L), this.num('kIrr')].join('|');
    if (this.YC[k]) return Promise.resolve(this.YC[k]);
    return this.getWeather().then(j => { const W = PG.fromJSON(j, this.num('tz')).rows, r = C.simulate({ weather: W, module: { Pmax: 1000, gammaP: g, eff: ef }, nModules: 1, tilt: this.num('tilt'), azimuth: this.num('az'), site: this.site(), losses: L, lowIrrK: this.num('kIrr') });
      let yw = Infinity, wm = 0; r.monthly.forEach((x, i) => { const y = x.eArray / MD[i]; if (y < yw) { yw = y; wm = i; } }); return this.YC[k] = { Y: r.year.eOut, yw, wm }; }); }
  async autoD(YS) {
    const t = this.stype(), prof = this.dailyProfile(), Ed = prof.reduce((a, b) => a + b, 0), peak = Math.max.apply(null, prof); let kac, pk, z = null;
    const say = (h) => { this.out.autoRes = h; this.emit(); };
    if (Ed <= 0) return say('<div class="warn">أدخل الفواتير أو جدول الأحمال أولاً.</div>');
    if (this.num('tilt') == null || this.num('az') == null) return say('<div class="warn">أدخل الميل (Tilt) والاتجاه (Azimuth) بتبويب 2 أولاً، وبعدها التصميم بيطلع لحاله.</div>');
    if (YS == null) { say('<div class="mute">جاري حساب الإنتاج النوعي للموقع من PVGIS…</div>');
      try { YS = await this.yieldSpec(); } catch (e) { return say('<div class="warn">خطأ بالطقس: ' + esc(e.message) + '</div>'); } }
    const off = this.isOff(), nbT = t === 'offgrid_nb', dnA = this.dayNight(prof), Yspec = off ? null : YS.Y, annual = this.bills().reduce((a, x) => a + x, 0), needKWp = Yspec ? annual / Yspec : null; let dmax = null;
    let modWhy = '', first = null; const mods = (this.num('mP') && !this.modAuto) ? [{ val: null, why: '' }] : this.modCands();
    for (let mi = 0; mi < mods.length; mi++) { if (mods[mi].val) { this.set('modP', mods[mi].val); this.setMod(); }
      if (off) { kac = peak * 1.25; this.NEEDMOD = Math.ceil((nbT ? dnA.day : Ed) / (YS.yw * (nbT ? 0.93 : 0.88)) * 1000 / this.num('mP') - 1e-9); pk = this.pickInv(kac, 'cover'); this.NEEDMOD = null; }
      else { z = this.emrcSize(); if (!z) return say('<div class="warn">أدخل الاستهلاك.</div>'); kac = z.kwAllowed; dmax = z.dcacMax; pk = null;
        pk = this.pickInv(kac, 'cap'); }
      if (pk && !first) first = { i: mi, pk, kac, z }; if (pk && !pk.over) { modWhy = mods[mi].why; break; } }
    if (mods[0].val) this.modAuto = true;
    if ((!pk || pk.over) && first) { if (mods[first.i].val) { this.set('modP', mods[first.i].val); this.setMod(); } pk = first.pk; kac = first.kac; z = first.z || z; modWhy = mods[first.i].why; }
    if (!pk) return say('<div class="warn">ما لقيت انفيرتر ' + (off ? '' : (this.subPh() === '1ph' ? 'سنغل فيز' : '3 فاز') + ' ') + 'مناسب بالقاعدة (النوع ' + t + '، المطلوب ' + fmt(kac, 2) + ' kW). أضف موديل بهالطور لقاعدة البيانات، أو سجّل دخول عشان تنحمّل القاعدة.</div>');
    this.set('invP', pk.x.val); this.setInv(); say('<div class="mute">جاري التصميم…</div>');
    if (off) await this.offgridSize();
    else { this.set('dcacT', this.dcacLim()); this.fromBills(); const m0 = this.mod(), v0 = this.inv(), n0 = pk.n || 1; dmax = this.dcacLim(); const dc = dmax; this.set('nInv', n0);
      const invKW = Math.min(n0 * v0.Pac, kac), tg = Math.max(1, Math.floor(invKW * dc * 1000 / m0.Pmax + 1e-9)), a = this.auto(tg);
      this.out.sizeMsg = '<div class="info">نفس طريقة الإكسل تبعك: عدد الألواح = ROUNDDOWN(قدرة الانفيرتر ' + fmt(invKW, 2) + ' kW × DC/AC ' + dc + ' (' + (this.subPh() === '1ph' ? 'سنغل فيز' : '3 فاز') + ') × 1000 ÷ ' + m0.Pmax + ' W) = <b>' + tg + ' لوح</b>' +
        (a.ok ? '، ترتيبها ' + a.ns + ' × ' + a.nstrPerInv + ' × ' + n0 + ' = ' + a.nModules + ' لوح' + (a.nModules < tg ? ' (أقرب ترتيب بيمشي مع جهد وتيار الانفيرتر)' : '') : '') + '.</div>'; }
    if (this.hasBat()) { this.pickBat(); this.batSug(); }
    const nI = this.num('nInv') || 1, v = this.inv(), m = this.mod(), kwp = this.kwpNow(), nb = this.num('bN'), hp = prof.indexOf(peak), pctPk = peak / Ed * 100, cnt = this.billsFilled(), LASTOG = this.LASTOG, LASTB = this.LASTB, cm = this.cmode;
    const row = (k, val, ex, bold) => '<tr><td>' + (bold ? '<b>' + k + '</b>' : k) + '</td><td class="n">' + val + (ex ? '<div class="ex">↳ ' + ex + '</div>' : '') + '</td></tr>';
    const dcx = dmax ? Math.min(this.num('dcacT') || dmax, dmax) : null;
    const sum = '<table><tbody>' +
      row('الاستهلاك', fmt(Ed, 1) + ' kWh/يوم (' + fmt(annual, 0) + ' سنوي)', cm === 'bills' ? 'من الفواتير اللي دخلتها (' + cnt + ' شهر): مجموع السنة ' + fmt(annual, 0) + ' kWh ÷ 365 يوم = ' + fmt(Ed, 1) + ' باليوم.' + (cnt < 12 ? ' الأشهر الفاضية حطيناها بمعدل الفواتير اللي دخلتها.' : '') : 'من جدول الأحمال: كل جهاز = القدرة (W) × العدد × ساعات التشغيل × معامل الحمل، ومجموعهم ' + fmt(Ed, 1) + ' kWh باليوم. × 365 = ' + fmt(annual, 0) + ' بالسنة.') +
      (Yspec ? row('الإنتاج النوعي المتوقع', fmt(Yspec, 0) + ' kWh/kWp/سنة', 'ركّبنا لوح تجريبي قدرته 1 kWp على الميل ' + this.num('tilt') + '° والاتجاه ' + this.num('az') + '°، وشغّلناه سنة كاملة ساعة بساعة على بيانات شمس وحرارة حقيقية لموقعك من PVGIS (قياسات قمر صناعي 2005–2023)، مع نفس خسائر مشروع مدامة (غبار 3٪، حرارة، كوابل، انفيرتر). طلع إنه بينتج ' + fmt(Yspec, 0) + ' kWh بالسنة.') +
        row('kWp المطلوب للاستهلاك', '<b>' + fmt(needKWp, 2) + ' kWp</b>', 'عشان تغطي ' + fmt(annual, 0) + ' kWh بالسنة، وكل 1 kWp بيعطي ' + fmt(Yspec, 0) + ': ' + fmt(annual, 0) + ' ÷ ' + fmt(Yspec, 0) + ' = ' + fmt(needKWp, 2) + ' kWp. هاي القدرة اللي بتغطي 100٪ من فاتورتك.') : '') +
      (off ? row('أعلى حمل ساعي × 1.25', fmt(kac, 2) + ' kW', cm === 'bills' ? 'الفاتورة بتقول كم صرفت بالشهر بس، مش بأي ساعة. فافترضنا يوم بيت أردني نموذجي: أعلى ساعة (7–8 المسا) بتاخد ' + fmt(pctPk, 1) + '٪ من استهلاك اليوم. ' + fmt(Ed, 1) + ' × ' + fmt(pctPk, 1) + '٪ = ' + fmt(peak, 2) + ' kW، وضربناها × 1.25 هامش أمان = ' + fmt(kac, 2) + ' kW. (بجدول الأحمال الرقم بيطلع من أجهزتك الحقيقية.)' : 'من جدول الأحمال: أكثر ساعة فيها أجهزة شغالة مع بعض هي الساعة ' + hp + ':00، ومجموعها ' + fmt(peak, 2) + ' kW. × 1.25 هامش أمان = ' + fmt(kac, 2) + ' kW.')
        : row('المسموح من الهيئة (AC)', fmt(kac, 2) + ' kW → أقصى ألواح ' + fmt(kac * dcx, 2) + ' kWp', 'نظام الهيئة 58/2024 بيسمح بـ 1 kW لكل 150 kWh من معدل استهلاكك الشهري: ' + fmt(z.monthly, 0) + (z.capPct < 1 ? ' × ' + (z.capPct * 100) + '٪ (غير منزلي)' : '') + ' ÷ 150 = ' + fmt(z.kwByConsumption, 2) + ' kW.' + (z.kwAmp < z.kwByConsumption ? ' وللمنزلي في حد 16 أمبير للطور = ' + fmt(z.kwAmp, 2) + ' kW، فأخذنا الأقل.' : '') + ' والألواح مسموح تكون لحد ' + dcx + ' × هالرقم.')) +
      (off && LASTOG ? row('أسوأ شهر', MON[LASTOG.wm] + ': ' + fmt(LASTOG.yw, 2) + ' kWh/kWp/يوم', 'من محاكاة لوح 1 kWp على موقعك وميلك: أقل شهر شمس هو ' + MON[LASTOG.wm] + '، وكل 1 kWp بيعطي فيه ' + fmt(LASTOG.yw, 2) + ' kWh باليوم. المنفصل ما إله شبكة تعوّض، فلازم يكفي بأسوأ شهر.') +
        row('kWp المطلوب (منفصل)', '<b>' + fmt(LASTOG.kWp, 2) + ' kWp</b>', (LASTOG.nb ? 'استهلاكك النهاري (7:00–17:00) ' : 'استهلاكك اليومي ') + fmt(LASTOG.Ed, 1) + ' ÷ (' + fmt(LASTOG.yw, 2) + ' × ' + LASTOG.eta + ') = ' + fmt(LASTOG.kWp, 2) + ' kWp. ' + (LASTOG.nb ? 'الـ 0.93 كفاءة الانفيرتر بس، لأنه ما في بطارية.' : 'الـ 0.88 لأنه حوالي 12٪ من الطاقة بتضيع بالانفيرتر والشحن والتفريغ.')) : '') +
      row('الألواح', '<b>' + fmt(kwp, 2) + ' kWp</b> = ' + (this.num('ns') * this.num('nstr') * nI) + ' لوح × ' + m.Pmax + ' W', (off ? 'عدد الألواح = kWp المطلوب ÷ قدرة اللوح (' + m.Pmax + ' W)، مقرّب لفوق. ترتيبها: ' : 'عدد الألواح = ROUNDDOWN(قدرة الانفيرتر × ' + this.dcacLim() + ' × 1000 ÷ ' + m.Pmax + ' W)، متل الإكسل تبعك. الـ ' + this.dcacLim() + ' لأنه الاشتراك ' + (this.subPh() === '1ph' ? 'سنغل فيز (حد DC/AC 1.5)' : '3 فاز (حد DC/AC 1.2)') + ' حسب نظام 58/2024 م9/ج. ترتيبها: ') + this.num('ns') + ' لوح ورا بعض بكل سلسلة (string) × ' + this.num('nstr') + ' سلسلة × ' + nI + ' انفيرتر. هاد أكبر ترتيب بيضل جهده وتياره ضمن حدود الانفيرتر بالبرد (−10°) والحر (70°). ' +
        'اللوح: ' + esc(this.optLabel('modP')) + (modWhy ? ' — اخترناه لأنه ' + modWhy : '') + '.', 1) +
      row('الانفيرتر', '<b>' + nI + ' × ' + esc(pk.x.name) + '</b> = ' + fmt(nI * v.Pac, 1) + ' kW', (off ? 'لازم يكفي شغلتين: أعلى حمل (' + fmt(kac, 2) + ' kW)، وكل الألواح (كل انفيرتر بياخد ألواح لحد 1.3 × قدرته، وضمن عدد مداخله). أقل عدد بيحقق الاثنين = ' + nI + '.' : 'أصغر انفيرتر (أو مجموعة) بتكفي الألواح، وما بتتعدى المسموح من الهيئة (' + fmt(kac, 2) + ' kW).') + ' نسبة الألواح للانفيرتر (DC/AC) = ' + fmt(kwp, 2) + ' ÷ ' + fmt(nI * v.Pac, 1) + ' = ' + fmt(kwp / (nI * v.Pac), 2) + '.', 1) +
      (nbT ? '<tr class="nobat-row"><td><b>🔋 البطاريات</b></td><td class="n"><b>لا يوجد — نظام بدون بطاريات</b><div class="ex">↳ حساب البطاريات متوقف لهالنوع. أحمال الليل (17:00–07:00) = ' + fmt(dnA.night, 2) + ' kWh/يوم' + (dnA.night > 0 ? '، وهاي ما رح تتغطى وبتطلع E_Miss بالمحاكاة. إذا لازم تشتغل، غيّر النوع لـ "منفصل + بطاريات".' : '، يعني كل الأحمال نهارية ✓') + '</div></td></tr>' : '') +
      (this.hasBat() && LASTB ? row('استهلاك الليل', fmt(LASTB.night, 2) + ' kWh/يوم', cm === 'bills' ? 'حسب نفس اليوم النموذجي، من 5 المسا لـ 7 الصبح بتصرف ' + fmt(LASTB.night / Ed * 100, 1) + '٪ من استهلاك اليوم: ' + fmt(Ed, 1) + ' × ' + fmt(LASTB.night / Ed * 100, 1) + '٪ = ' + fmt(LASTB.night, 2) + ' kWh. هاد اللي لازم تغطيه البطارية لأنه ما في شمس.' : 'مجموع الأجهزة الشغالة من 5 المسا لـ 7 الصبح بجدولك = ' + fmt(LASTB.night, 2) + ' kWh. هاد اللي لازم تغطيه البطارية لأنه ما في شمس.') +
        row('البطارية المطلوبة', fmt(LASTB.need, 2) + ' kWh', 'ما بنفرّغ البطارية للآخر: بنستعمل من ' + this.num('bSmin') + '٪ لـ ' + this.num('bSmax') + '٪ بس (' + fmt(LASTB.win * 100, 0) + '٪) عشان تعيش أطول، وبيضيع 5٪ بالانفيرتر. ' + fmt(LASTB.night, 2) + ' × ' + LASTB.d + ' يوم ÷ ' + fmt(LASTB.win, 2) + ' ÷ 0.95 = ' + fmt(LASTB.need, 2) + ' kWh.') : '') +
      (this.hasBat() ? row('البطاريات', '<b>' + nb + ' × ' + esc(this.optLabel('batP')) + '</b> = ' + fmt(nb * this.num('bK'), 1) + ' kWh اسمي · <b>صافي ' + fmt((this.batNet() || {}).net, 1) + ' kWh</b>', LASTB ? fmt(LASTB.need, 2) + ' ÷ سعة الوحدة ' + LASTB.unit + ' kWh = ' + fmt(LASTB.need / LASTB.unit, 2) + '، مقرّب لفوق = ' + nb + ' وحدة. البطارية اخترناها بجهد بيناسب الانفيرتر، ومن نفس ماركته إذا موجودة.' : '', 1) : '') +
      '</tbody></table>' + (pk.over ? '<div class="warn">أصغر انفيرتر ' + (t === 'hybrid' ? 'هجين' : '') + ' بالقاعدة (' + pk.x.s.Pac + ' kW) أكبر من المسموح (' + fmt(kac, 2) + ' kW). أضف موديل أصغر أو حدّد التصدير (Zero export).</div>' : '') + '<div class="mute">الطريقة نفسها تبعت مدامة: ثوابت PVsyst، SOC من ' + this.num('bSmin') + '٪ لـ ' + this.num('bSmax') + '٪، ' + (off ? 'وبدون قيود الهيئة.' : 'وحدود الهيئة (نظام 58/2024).') + ' التفاصيل بتبويب 4، وشغّل المحاكاة بتبويب 6 عشان تتأكد من PR و' + (off ? 'E_Miss' : 'التوفير') + '.</div>';
    this.autoFlash = Math.random();
    say('<div class="card" style="margin:12px 0 0;border-color:#fcd38a"><h2>⚡ نتيجة التصميم التلقائي <small>بتتحدث لحالها مع كل تعديل</small></h2>' + sum + '</div>');
  }
}

/* ---------- report helpers ---------- */
function kpi(t, v) { return '<div class="kpi"><div>' + t + '</div><b>' + v + '</b></div>'; }
function tr(k, v) { return '<tr><td style="width:32%;color:var(--mute)">' + k + '</td><td dir="auto" style="text-align:right">' + v + '</td></tr>'; }
function lossDiagram(s, c) {
  const y = s.year, A = c.area, rows = [];
  const L = (label, val, base, unit, isTot) => rows.push({ l: label, v: val, b: base, u: unit, t: isTot });
  L('Global horizontal irradiation', y.globHor, null, 'kWh/m²', 1);
  L('Global incident in collector plane', y.globInc - y.globHor, y.globHor);
  const sh = y.globShd > 0 && y.globShd < y.globInc - 1e-6, g0 = sh ? y.globShd : y.globInc;
  if (sh) L('Near Shadings: irradiance loss', y.globShd - y.globInc, y.globInc);
  L('IAM factor on global', y.globIAM - g0, g0);
  L('Soiling loss factor', y.globEff - y.globIAM, y.globIAM);
  L('Effective irradiation on collectors', y.globEff, null, 'kWh/m² × ' + fmt(A, 0) + ' m²', 1);
  L('Array nominal energy (at STC efficiency ' + fmt(c.kWp / A * 100, 2) + '%)', y.eNom, null, 'kWh', 1);
  L('PV loss due to irradiance level', -y.lIrr, y.eNom);
  let b = y.eNom - y.lIrr; L('PV loss due to temperature', -y.lTemp, b); b -= y.lTemp;
  L('Module quality loss', -y.lQual, b); b -= y.lQual; L('LID — light induced degradation', -y.lLID, b); b -= y.lLID;
  if (y.lShdEl > 0) { L('Shadings: Electrical Loss acc. to strings', -y.lShdEl, b); b -= y.lShdEl; }
  L('Mismatch loss, modules and strings', -y.lMis, b); b -= y.lMis; L('Ohmic wiring loss', -y.lOhm, b);
  L('Array virtual energy at MPP (EArray)', y.eArray, null, 'kWh', 1);
  L('Inverter loss during operation (efficiency)', -y.lInvEff, y.eArray); L('Inverter loss over nominal inv. power', -y.lClip, y.eArray - y.lInvEff);
  if (y.lAC > 0) L('AC ohmic loss', -y.lAC, y.eOut + y.lAC);
  L('Available energy at inverter output (E_Grid)', y.eOut, null, 'kWh', 1);
  let h = '<table class="loss">';
  rows.forEach(r => { if (r.t) { h += '<tr class="tot"><td>' + r.l + '</td><td class="n" colspan="2">' + fmt(r.v, r.u === 'kWh' ? 0 : 1) + ' ' + r.u + '</td></tr>'; return; }
    const p = r.v / r.b * 100, w = Math.min(100, Math.abs(p) * 12);
    h += '<tr class="' + (p < 0 ? 'neg' : '') + '"><td>' + r.l + '</td><td class="n" style="width:70px">' + (p > 0.0005 ? '+' : '') + fmt(Math.abs(p) < 0.0005 ? 0 : p, 2) + ' %</td><td style="width:40%"><div class="bar" style="width:' + w + '%"></div></td></tr>'; });
  return h + '</table>'; }
function axes(x, W, H, pad, mx, lab) { x.clearRect(0, 0, W, H); x.direction = 'ltr'; x.textAlign = 'left'; x.font = '11px Tahoma'; x.strokeStyle = '#dde2e8'; x.fillStyle = '#66707c';
  for (let g = 0; g <= 4; g++) { const yy = H - pad - (H - pad * 1.6) * g / 4; x.beginPath(); x.moveTo(pad, yy); x.lineTo(W - 8, yy); x.stroke(); x.fillText((mx * g / 4).toFixed(mx < 2 ? 2 : 1), 2, yy + 4); } x.fillText(lab, pad, 12); }
function drawNorm(s) { const c = document.getElementById('cN'); if (!c) return; const x = c.getContext('2d'), W = c.width, H = c.height, pad = 34, bw = (W - pad - 8) / 12, mx = Math.ceil(Math.max.apply(null, s.monthly.map(m => m.norm.Yr)));
  axes(x, W, H, pad, mx, 'kWh/kWp/day'); const k = (H - pad * 1.6) / mx;
  s.monthly.forEach((m, i) => { const X = pad + i * bw + bw * .15, bwi = bw * .7, n = m.norm; let y0 = H - pad;
    [[n.Yf, '#d98a00'], [n.Ls, '#3d85c6'], [n.Lc, '#cc4125']].forEach(p => { const hh = p[0] * k; x.fillStyle = p[1]; x.fillRect(X, y0 - hh, bwi, hh); y0 -= hh; });
    x.fillStyle = '#66707c'; x.fillText(String(i + 1), X + bwi / 3, H - pad + 14); });
  [['Yf produced', '#d98a00'], ['Ls system', '#3d85c6'], ['Lc collection', '#cc4125']].forEach((l, i) => { x.fillStyle = l[1]; x.fillRect(W - 330 + i * 110, 4, 10, 10); x.fillStyle = '#1d232b'; x.fillText(l[0], W - 316 + i * 110, 13); }); }
function drawPR(s) { const c = document.getElementById('cP'); if (!c) return; const x = c.getContext('2d'), W = c.width, H = c.height, pad = 34, bw = (W - pad - 8) / 12;
  axes(x, W, H, pad, 1, 'PR'); const k = (H - pad * 1.6);
  s.monthly.forEach((m, i) => { const X = pad + i * bw + bw * .15, hh = m.norm.PR * k; x.fillStyle = '#ffc24d'; x.fillRect(X, H - pad - hh, bw * .7, hh); x.fillStyle = '#1d232b'; x.fillText(m.norm.PR.toFixed(2), X + 2, H - pad - hh - 3); x.fillStyle = '#66707c'; x.fillText(String(i + 1), X + bw * .25, H - pad + 14); });
  x.strokeStyle = '#15324f'; x.setLineDash([4, 3]); const yy = H - pad - s.year.norm.PR * k; x.beginPath(); x.moveTo(pad, yy); x.lineTo(W - 8, yy); x.stroke(); x.setLineDash([]); x.fillStyle = '#15324f'; x.fillText('PR year ' + (s.year.norm.PR * 100).toFixed(2) + '%', pad + 4, yy + 14); }
function drawSOC(soc) { const c = document.getElementById('cS'); if (!c) return; const x = c.getContext('2d'), W = c.width, H = c.height, pad = 30, nd = Math.floor(soc.length / 24), bw = (W - pad - 6) / nd;
  x.clearRect(0, 0, W, H); x.direction = 'ltr'; x.font = '11px Tahoma'; x.strokeStyle = '#dde2e8'; x.fillStyle = '#66707c';
  [0, 0.25, 0.5, 0.75, 1].forEach(g => { const yy = H - pad - (H - pad * 1.5) * g; x.beginPath(); x.moveTo(pad, yy); x.lineTo(W - 6, yy); x.stroke(); x.fillText(Math.round(g * 100) + '%', 2, yy + 4); });
  for (let d = 0; d < nd; d++) { let mn = 1, mx = 0; for (let k = 0; k < 24; k++) { const v = soc[d * 24 + k]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const y1 = H - pad - (H - pad * 1.5) * mx, y2 = H - pad - (H - pad * 1.5) * mn; x.fillStyle = mn < 0.2 ? '#e06666' : '#3d85c6'; x.fillRect(pad + d * bw, y1, Math.max(1, bw), Math.max(1, y2 - y1)); }
  for (let m = 0, dd = 0; m < 12; m++) { x.fillStyle = '#66707c'; x.fillText(String(m + 1), pad + (dd + MD[m] / 2) * bw - 3, H - pad + 14); dd += MD[m]; } }
