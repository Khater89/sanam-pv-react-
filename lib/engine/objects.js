/* Roof objects: presets with typical Jordanian sizes and heights above the roof (m), and a height guess from the object's name.
   Heights are estimates; the user can always overwrite them. */
export const OBJ_PRESETS = [
  { kind: 'stair', name: 'بيت درج', h: 3.0, w: 3, l: 4, color: '#94a3b8' },
  { kind: 'stairTank', name: 'بيت درج فوقه خزانات', h: 4.6, w: 3, l: 4, top: { h: 1.6, k: 0.7 }, color: '#94a3b8' },
  { kind: 'roomTank', name: 'غرفة فوقها خزانات', h: 4.4, w: 3, l: 3, top: { h: 1.6, k: 0.7 }, color: '#a8a29e' },
  { kind: 'tank', name: 'خزان ماء', h: 1.6, w: 1.3, l: 1.3, color: '#e2e8f0' },
  { kind: 'tankStand', name: 'خزانات على قاعدة حديد', h: 2.6, w: 2.6, l: 1.4, color: '#e2e8f0' },
  { kind: 'heater', name: 'سخان شمسي', h: 1.8, w: 2.0, l: 2.0, color: '#1e3a8a' },
  { kind: 'ac', name: 'وحدة مكيف خارجية', h: 0.9, w: 0.9, l: 0.4, color: '#f8fafc' },
  { kind: 'room', name: 'غرفة', h: 2.8, w: 3, l: 3, color: '#a8a29e' },
  { kind: 'laundry', name: 'غرفة غسيل', h: 2.6, w: 2.5, l: 2, color: '#a8a29e' },
  { kind: 'dish', name: 'صحن ستالايت', h: 1.2, w: 1, l: 1, color: '#cbd5e1' },
  { kind: 'wall', name: 'جدار', h: 1.0, w: 4, l: 0.2, color: '#d6d3d1' },
  { kind: 'vent', name: 'مدخنة / فتحة تهوية', h: 1.0, w: 0.5, l: 0.5, color: '#78716c' },
  { kind: 'elev', name: 'غرفة مصعد', h: 3.5, w: 2.5, l: 2.5, color: '#94a3b8' },
  { kind: 'opening', name: 'منور / فتحة بالسطح', h: 0, w: 3, l: 3, block: true, color: '#1f2937' },
  { kind: 'keepout', name: 'منطقة ممنوعة (ممر)', h: 0, w: 4, l: 1, block: true, color: '#fca5a5' },
  { kind: 'neighbour', name: 'عمارة مجاورة', h: 6, w: 12, l: 15, ref: 'ground', color: '#64748b' },
];
export const presetOf = k => OBJ_PRESETS.find(p => p.kind === k) || null;

/* guess kind/height from a free-text name (Arabic or English); the more specific rules come first */
const RULES = [
  [/(درج|stair).*(خزان|tank)|(خزان|tank).*(درج|stair)/i, 'stairTank'],
  [/(غرف|غسيل|room|laundry).*(خزان|tank)|(خزان|tank).*(غرف|غسيل|room|laundry)/i, 'roomTank'],
  [/(منور|فتحة|سكاي|skylight|opening|courtyard)/i, 'opening'],
  [/(ممر|ممنوع|keep ?out|walkway)/i, 'keepout'],
  [/(مصعد|elevator|lift)/i, 'elev'],
  [/(درج|stair)/i, 'stair'],
  [/(قاعدة|ستاند|stand|حديد).*(خزان|tank)|(خزان|tank).*(قاعدة|ستاند|stand|حديد)/i, 'tankStand'],
  [/(سخان|heater)/i, 'heater'],
  [/(خزان|tank)/i, 'tank'],
  [/(مكيف|كمبروسر|كمبريسر|ac\b|a\/c|condens)/i, 'ac'],
  [/(غسيل|laundry)/i, 'laundry'],
  [/(ستالايت|ستلايت|صحن|dish|satellite)/i, 'dish'],
  [/(مدخن|شفاط|تهوي|vent|chimney)/i, 'vent'],
  [/(جدار|سور|درابزين|wall|rail)/i, 'wall'],
  [/(عمار|بناي|مبنى مجاور|building|neighbo)/i, 'neighbour'],
  [/(غرف|room)/i, 'room'],
];
export function guessKind(name) { const s = String(name || ''); for (const [re, k] of RULES) if (re.test(s)) return k; return null; }

/* rectangle object → polygon (centre, width along x before rotation, length along y, rotation ° clockwise from North) */
export function rectPts(r) { const a = (+r.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), w = (+r.w || 1) / 2, l = (+r.l || 1) / 2;
  return [[-w, -l], [w, -l], [w, l], [-w, l]].map(([x, y]) => [Math.round((r.cx + x * c + y * s) * 1000) / 1000, Math.round((r.cy - x * s + y * c) * 1000) / 1000]); }
