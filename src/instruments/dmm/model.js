// 34460A 行為模型（I05）。規格：docs/data/dmm.json（DMM-F01～F15、GAP-DMM-01～23）。
// 原廠 Truevolt Operating and Service Guide 已核對；面板選單座標及數值編輯手勢為教學近似。
// 讀值是理想教學值：測試情境的物理量 → 功能相容判定 → 選檔（GAP-DMM-05）→ 超量程判定 → 格式化，不加雜訊（GAP-DMM-20）。
import { fmtFixed, eng } from '../../core/format.js';
import layout from './layout.js';
import { renderLcd } from './lcd.js';

const K = (s) => `DMM.KEY.${s}`;
const POWER = 'DMM.PWR.POWER';

// 量程：v＝滿刻度（基本單位）；limit＝可讀上限，20% 超量程，1000 VDC、750 VAC、3 A 為 0%（D-DMM p.12 註 2）
const PFX = { V: [[1, ''], [1e-3, 'm'], [1e-6, 'µ']], A: [[1, ''], [1e-3, 'm'], [1e-6, 'µ']], 'Ω': [[1e6, 'M'], [1e3, 'k'], [1, '']], F: [[1e-6, 'µ'], [1e-9, 'n']] };
function range(v, base, over = 1.2) {
  const [mult, p] = PFX[base].find(([m]) => v >= m * 0.999);
  const n = Math.round(v / mult);
  return { v, mult, p, int: String(n).length, label: `${n}${p}${base}`, limit: v * over };
}
const I_RANGES = [1e-4, 1e-3, 1e-2, 0.1, 1].map((v) => range(v, 'A')).concat(range(3, 'A', 1));
// D-DMM p.11／12 只列負擔電壓「上限」，沒有實際 shunt 電阻。
// 教學近似：用上限÷滿刻度作保守等效負載；不能解讀成原廠內阻或精準負擔電壓。
export const CURRENT_SHUNT = [0.011 / 1e-4, 0.11 / 1e-3, 0.05 / 1e-2, 0.5 / 0.1, 0.7, 2 / 3];

// 功能：LCD 功能名與單位字樣只有 DCV 見於 datasheet 產品照，其餘比照 DCV（GAP-DMM-09，近似）
export const FUNCS = {
  DCV: { key: 'DCV', zh: '直流電壓', name: 'DC Voltage', kind: 'V', part: 'dc', base: 'V', suffix: 'DC',
    ranges: [0.1, 1, 10, 100].map((v) => range(v, 'V')).concat(range(1000, 'V', 1)) },
  ACV: { key: 'ACV', zh: '交流電壓，真有效值', name: 'AC Voltage', kind: 'V', part: 'ac', base: 'V', suffix: 'AC',
    ranges: [0.1, 1, 10, 100].map((v) => range(v, 'V')).concat(range(750, 'V', 1)) },
  DCI: { key: 'DCI', zh: '直流電流', name: 'DC Current', kind: 'I', part: 'dc', base: 'A', suffix: 'DC', ranges: I_RANGES },
  ACI: { key: 'ACI', zh: '交流電流，真有效值', name: 'AC Current', kind: 'I', part: 'ac', base: 'A', suffix: 'AC', ranges: I_RANGES },
  OHM: { key: 'Ω 2W', zh: '二線電阻', name: '2-Wire Ohms', kind: 'R', base: 'Ω', suffix: '',
    ranges: [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].map((v) => range(v, 'Ω')) },
  OHM4: { key: 'Ω 4W', zh: '四線電阻', name: '4-Wire Ohms', kind: 'R', base: 'Ω', suffix: '',
    ranges: [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8].map((v) => range(v, 'Ω')) },
  CONT: { key: 'Cont', zh: '導通', name: 'Continuity', kind: 'R', base: 'Ω', suffix: '', ranges: [range(1e3, 'Ω')] },
  DIODE: { key: 'Diode', zh: '二極體測試', name: 'Diode', kind: 'D', base: 'V', suffix: '', ranges: [range(10, 'V', 0.5)] },
  CAP: { key: 'Cap', zh: '電容量', name: 'Capacitance', kind: 'C', base: 'F', suffix: '', ranges: [1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4].map((v) => range(v, 'F')) },
  TEMP: { key: 'Temp', zh: '溫度', name: 'Temperature', kind: 'T', base: '°C', suffix: '', ranges: [{ v: 600, limit: Infinity, mult: 1, p: '', int: 3, label: 'RTD' }] },
  FREQ: { key: 'Freq', zh: '頻率', name: 'Frequency', kind: 'F', part: 'ac', base: 'Hz', suffix: '',
    ranges: [0.1, 1, 10, 100].map((v) => range(v, 'V')).concat(range(750, 'V', 1)) },
  PER: { key: 'Period', zh: '週期', name: 'Period', kind: 'F', part: 'ac', base: 's', suffix: '',
    ranges: [0.1, 1, 10, 100].map((v) => range(v, 'V')).concat(range(750, 'V', 1)) },
};
export const NPLCS = [0.02, 0.2, 1, 10, 100]; // M-DMM Front Panel Menu Reference (34460A/61A).
export const GATES = [0.01, 0.1, 1];
export const DB_RESISTANCES = [50, 75, 93, 110, 124, 125, 135, 150, 250, 300, 500, 600, 800, 900, 1000, 1200, 8000];
const SETTING_ENUMS = { nplc: NPLCS, inputZMode: ['10M', 'AUTO'], gate: GATES, acFilter: [3, 20, 200], tempSensor: ['PT100', 'THERMISTOR'], tempWire: [2, 4], tempUnit: ['C', 'F', 'K'], dbMode: ['OFF', 'DB', 'DBM'], dbResistance: DB_RESISTANCES, displayMode: ['NUMBER', 'BAR', 'HIST'], run: ['run', 'stop', 'single'], triggerMode: ['AUTO', 'SINGLE'], histBins: [10, 20, 40, 100, 200, 400], powerOnMode: ['FACTORY', 'LAST', 'USER'], digitMask: ['AUTO', 7, 6, 5, 4], barFormat: ['LOWHIGH', 'SPAN'] };
const SETTING_BOOLS = ['autoZero', 'ratioOn', 'statsOn', 'limitsOn', 'beeper', 'delayAuto', 'histAuto', 'histOuter', 'histCumulative', 'barAuto', 'secondaryOn'];
const SETTING_NUMBERS = { tempR0: [80, 120], dbRef: [-200, 200], limitLow: [-1e9, 1e9], limitHigh: [-1e9, 1e9], sampleCount: [1, 1e6], triggerDelay: [0, 3600], histLow: [-1e9, 1e9], histHigh: [-1e9, 1e9], barLow: [-1e9, 1e9], barHigh: [-1e9, 1e9] };
export const DMM_SETTING_FIELDS = Object.freeze([...Object.keys(SETTING_ENUMS), ...SETTING_BOOLS, ...Object.keys(SETTING_NUMBERS)]);
export const DMM_MENUS = Object.freeze(['ACQUIRE', 'DISPLAY', 'DISPLAY_SELECT', 'NPLC', 'MATH', 'DB', 'STATS', 'LIMITS', 'PROBE', 'HELP', 'UTILITY', 'STORE', 'FILES', 'HIST', 'EDIT', 'DIGITS', 'BAR_SCALE', 'SECONDARY']);
export function validateSettings(value) {
  const plainObject = (v) => v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));
  if (!plainObject(value)) return 'DMM設定必須為一般物件';
  const ds = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(ds).some((k) => typeof k !== 'string')) return 'DMM設定不接受Symbol欄位';
  for (const [key, descriptor] of Object.entries(ds)) {
    if (!Object.hasOwn(descriptor, 'value')) return `DMM設定${key}不接受accessor`;
    const v = descriptor.value;
    if (key === 'fn') { if (!Object.hasOwn(FUNCS, v)) return 'DMM功能無效'; continue; }
    if (key === 'per') {
      if (!plainObject(v)) return 'DMM per必須為一般物件';
      const perFields = Object.getOwnPropertyDescriptors(v);
      if (Reflect.ownKeys(perFields).some((k) => typeof k !== 'string')) return 'DMM per不接受Symbol欄位';
      for (const [fn, d] of Object.entries(perFields)) {
        if (!Object.hasOwn(d, 'value') || !Object.hasOwn(FUNCS, fn) || !plainObject(d.value)) return 'DMM per功能無效';
        const fields = Object.getOwnPropertyDescriptors(d.value);
        if (Reflect.ownKeys(fields).some((k) => typeof k !== 'string')) return 'DMM per欄位不接受Symbol';
        if (Object.keys(fields).some((k) => !['auto', 'idx', 'nullOn', 'base'].includes(k) || !Object.hasOwn(fields[k], 'value'))) return 'DMM per欄位無效';
        if (typeof fields.auto?.value !== 'boolean' || typeof fields.nullOn?.value !== 'boolean' || !Number.isInteger(fields.idx?.value) || fields.idx.value < 0 || fields.idx.value >= FUNCS[fn].ranges.length || !Number.isFinite(fields.base?.value)) return 'DMM per值無效';
      }
      continue;
    }
    if (!DMM_SETTING_FIELDS.includes(key)) return `DMM未知設定${key}`;
    if (SETTING_ENUMS[key] && !SETTING_ENUMS[key].includes(v)) return `DMM設定${key}選項無效`;
    if (SETTING_BOOLS.includes(key) && typeof v !== 'boolean') return `DMM設定${key}必須為boolean`;
    if (SETTING_NUMBERS[key] && (!Number.isFinite(v) || v < SETTING_NUMBERS[key][0] || v > SETTING_NUMBERS[key][1])) return `DMM設定${key}超出範圍`;
    if (key === 'sampleCount' && !Number.isInteger(v)) return 'DMM樣本數必須為整數';
  }
  if (ds.limitLow && ds.limitHigh && ds.limitLow.value > ds.limitHigh.value) return 'DMM Low Limit不得大於High Limit';
  if (ds.histLow && ds.histHigh && ds.histLow.value >= ds.histHigh.value) return 'DMM Histogram Low必須小於High';
  if (ds.barLow && ds.barHigh && ds.barLow.value >= ds.barHigh.value) return 'DMM Bar Low必須小於High';
  if (ds.secondaryOn?.value && ds.fn && !['DCV', 'ACV', 'DCI', 'ACI', 'FREQ', 'PER', 'TEMP'].includes(ds.fn.value)) return '34460A此功能沒有次測量';
  if (ds.ratioOn?.value && ds.per?.value?.DCV?.nullOn) return 'DCV Ratio不提供Null';
  return null;
}
export const CONT_THRESHOLD = 10; // Ω，D-DMM p.21 "Continuity threshold Fixed at 10 Ω"；≤ 的邊界為 PD（GAP-DMM-08）

// 單機測試情境 D1（common §0.4）：情境自帶量測類型，只在相容功能有讀值（GAP-DMM-18）
export const D1 = [
  { id: 'none', label: '未接測試輸入', desc: '端子上沒有任何訊號：每個功能都沒有讀值。' },
  { id: 'dcv', kind: 'V', dc: 1.234, ac: 0, label: 'DC 1.234 V', desc: '電壓類，接 Input HI／LO。' },
  { id: 'acv', kind: 'V', dc: 0, ac: 2, freq: 1000, label: 'AC 2.000 Vrms（1 kHz 純正弦）', desc: '電壓類，接 Input HI／LO。' },
  { id: 'r1k', kind: 'R', ohm: 1000, label: '電阻 1.000 kΩ', desc: '電阻類，接 Input HI／LO。' },
  { id: 'r4w', kind: 'R', ohm: 1000, fourWire: true, label: '四線電阻 1.000 kΩ（Sense 已接）', desc: '獨立四線情境：Input HI／LO提供試驗電流，Sense HI／LO直接接在1kΩ兩端，四條線皆已提供。' },
  { id: 'short', kind: 'R', ohm: 0.5, label: '導通短路 0.5 Ω', desc: '電阻類（兩條測試線碰在一起），接 Input HI／LO。' },
  { id: 'open', kind: 'R', ohm: Infinity, label: '開路', desc: '電阻類（測試線之間沒有接東西），接 Input HI／LO。' },
  { id: 'dci', kind: 'I', dc: 0.01234, ac: 0, label: 'DC 12.34 mA', desc: '電流類，串在 I 3A／LO。' },
  { id: 'aci', kind: 'I', dc: 0, ac: 0.005, label: 'AC 5.000 mArms（1 kHz 純正弦）', desc: '電流類，串在 I 3A／LO。' },
  { id: 'cap', kind: 'C', cap: 1e-6, label: '已放電電容 1.000 µF', desc: '電容類，與供電分離，接 Input HI／LO。' },
  { id: 'cap-open', kind: 'C', cap: 0, label: '電容測試線開放（理想寄生 0 F）', desc: '明確提供已接Input HI／LO的電容測試線，兩端開放；理想寄生0F，可作Null基準。不是未接輸入情境。' },
  { id: 'diode', kind: 'D', vf: 0.65, label: '二極體順向 0.650 V（1 mA）', desc: '獨立測試情境；麵包板尚無二極體元件，不能把電阻當成二極體。' },
  { id: 'diode-open', kind: 'D', vf: Infinity, label: '二極體逆向／開路', desc: '獨立測試情境，測试電流 1 mA 時超過 5 V。' },
  { id: 'pt100', kind: 'T', ohm: 109.73465625, sensor: 'PT100', fourWire: true, label: 'PT100 25.000 °C（109.734656 Ω）', desc: '理想 DIN/IEC PT100，四條測試線已接好；R0=100 Ω。' },
  { id: 'thermistor', kind: 'T', ohm: 5000, sensor: 'THERMISTOR', fourWire: true, label: '5 kΩ 44007 熱敏電阻', desc: '只適用原廠指定 5 kΩ 44007 的 Steinhart–Hart 係數；兩線與四線接線已提供。' },
  { id: 'ratio', kind: 'V', dc: 2, ac: 0, ref: { hi: 1, lo: 0, valid: true }, label: 'DCV Ratio：Input 2 V／Sense 1 V', desc: '獨立情境同時提供 Input HI−LO 與 Sense HI／LO，沒有 Sense 參考時不可計算比值。' },
  { id: 'bench', bench: true, label: '實驗台接線', desc: '電壓／電阻接 HI–LO；電流需拆開原回路，將 I 3A–LO 串入。I–LO 分流會實際改變電路負載。' },
];
const TERM = { V: 'Input HI／LO', R: 'Input HI／LO（四線另接 Sense HI／LO）', I: 'I 3A／LO', C: 'Input HI／LO', D: 'Input HI／LO', T: 'Input HI／LO 與 Sense HI／LO' };
const CAT = { V: '電壓類', R: '電阻類', I: '電流類', C: '電容類', D: '二極體類', T: '溫度感測器類' };
const USE = { V: 'DCV／ACV／Freq', R: 'Ω 2W／Ω 4W／Cont', I: 'DCI 或 ACI（Shift → DCV／ACV）', C: 'Cap（Shift → Freq）', D: 'Diode（Shift → Cont）', T: 'Temp 並選對 Probe' };

// IEC 60751 PT100 inverse Callendar–Van Dusen, ideal transducer conversion.
export function temperatureOf(r, sensor = 'PT100', r0 = 100) {
  if (!(r > 0) || !Number.isFinite(r)) return null;
  if (sensor === 'THERMISTOR') {
    const l = Math.log(r), t = 1 / (1.285e-3 + 2.362e-4 * l + 9.285e-8 * l ** 3) - 273.15;
    return t >= -80 && t <= 150 ? t : null;
  }
  const at = (t) => r0 * (1 + 3.9083e-3 * t - 5.775e-7 * t * t + (t < 0 ? -4.183e-12 * (t - 100) * t ** 3 : 0));
  if (!(r0 >= 80 && r0 <= 120) || r < at(-200) || r > at(600)) return null;
  let lo = -200, hi = 600;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (at(mid) < r) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// 積分時間：預設 10 PLC（DS 產品照 "Aperture 10 PLC"，GAP-DMM-20）；台灣市電 60 Hz → 1/6 秒，
// 10 PLC 約每秒 6 筆讀值（D-DMM p.23）。DCV 讀值＝最近一次積分窗內的平均。
export const APERTURE = 10 / 60;
// 峰值容量：AC 依峰值因數「滿刻度 3:1」（D-DMM p.21）→ 約 3×量程。DC 功能的峰值過載規則沒有原廠依據，不判斷。
const PEAK = { ac: 3 };
export const peakLimit = (f, r) => r.v * (PEAK[f.part] ?? Infinity);

// Auto 選檔（GAP-DMM-05 暫定）：能容納 |x| 的最小量程；AC／DC 另外要容納峰值（D-DMM p.21「Will select
// higher range if peak input overload is detected during auto range」）；都容納不了就停在最高檔（超量程）
export function pickRange(f, x, pk = 0) {
  const i = f.ranges.findIndex((r) => Math.abs(x) <= r.limit * (1 + 1e-12) && pk <= peakLimit(f, r) * (1 + 1e-12));
  return i < 0 ? f.ranges.length - 1 : i;
}

// 6½ 位讀值：共 7 位數字，整數位數由量程決定，小數每三位空一格（DS 範例 "+0.634 450"、"+000.030 6"）。
// Null 差值超出該檔位數時少一位小數；7 位都放不下回傳 null（顯示中性記號）。
export function fmtReading(x, r, digits = 7) {
  if (!Number.isFinite(x)) return null;
  const v = x / r.mult;
  for (let int = r.int; int <= digits; int++) {
    const d = digits - int;
    const s = fmtFixed(Math.abs(v), d);
    const [ip, fp = ''] = s.split('.');
    if (ip.length > int) continue;
    const sign = v < 0 && !/^[0.]+$/.test(s) ? '-' : '+';
    return sign + ip.padStart(int, '0') + (d ? `.${fp.match(/.{1,3}/g).join(' ')}` : '');
  }
  return null;
}
const plain = (x, base) => `${Number(x.toPrecision(6))} ${base}`;
const beforeEnd = (time) => time - Math.max(1e-12, Math.abs(time) * Number.EPSILON * 4);

const fresh = () => Object.fromEntries(Object.keys(FUNCS).map((k) => [k, { auto: true, idx: 0, nullOn: false, base: 0 }]));
// A nominal frequency only chooses a safe search step. The result comes from
// repeated crossings of the actual terminal waveform, including clipping and
// circuit history. Reject an aperiodic transient or disconnected zero signal.
export function frequencyOf(signal, end = signal?.now, earliest = -Infinity) {
  const hint = signal?.carrierFreq ?? signal?.freq;
  if (signal?.noise || !(hint > 0) || !Number.isFinite(hint) || typeof signal?.at !== 'function' || !Number.isFinite(end)) return null;
  const start = Math.max(earliest, end - 5 / hint), maxFreq = signal.maxFreq ?? hint;
  if (!(maxFreq > 0) || !Number.isFinite(maxFreq)) return null;
  const n = Math.ceil(Math.max(640, (end - start) * maxFreq * 128));
  if (n > 64000) return null;
  const dt = (end - start) / n;
  if (!(dt > 0)) return null;
  const values = Array.from({ length: n + 1 }, (_, i) => signal.at(start + i * dt));
  if (values.some((v) => !Number.isFinite(v))) return null;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo;
  if (!(span > 1e-5)) return null;
  const level = (hi + lo) / 2, edges = [];
  for (let i = 1; i <= n; i++) {
    if (!(values[i - 1] < level && values[i] >= level)) continue;
    let a = start + (i - 1) * dt, b = a + dt;
    for (let j = 0; j < 34; j++) { const m = (a + b) / 2; if (signal.at(m) < level) a = m; else b = m; }
    edges.push((a + b) / 2);
  }
  if (edges.length < 3) return null;
  const periods = edges.slice(1).map((t, i) => t - edges[i]);
  const period = periods.reduce((a, b) => a + b, 0) / periods.length;
  if (periods.some((p) => Math.abs(p / period - 1) > 0.02)) return null;
  const freq = 1 / period;
  return freq >= 3 * (1 - 1e-8) && freq <= 300e3 * (1 + 1e-8) ? freq : null;
}
const CONT_FIXED = { kind: 'approx', text: '導通固定 1 kΩ 量程：Range／+／− 不改量程（近似）。' };
const OUT_NAME = {
  [K('FREQ')]: 'Freq（頻率／週期）', [K('TEMP')]: 'Temp（溫度）', [K('RUN_STOP')]: ['Run/Stop', 'Reset'], [K('SINGLE')]: ['Single', 'Probe Hold'],
  [K('DISPLAY')]: ['Display', 'Utility'], [K('ACQUIRE')]: ['Acquire', 'Help'], [K('UP')]: '▲', [K('DOWN')]: '▼', [K('LEFT')]: '◀',
  [K('RIGHT')]: '▶', [K('SELECT')]: 'Select', 'DMM.SOFT.S2': '軟鍵 S2', 'DMM.SOFT.S3': '軟鍵 S3', 'DMM.SOFT.S4': '軟鍵 S4',
  'DMM.SOFT.S5': '軟鍵 S5', 'DMM.SOFT.S6': '軟鍵 S6',
};

export class DmmModel {
  constructor() {
    this.id = 'dmm';
    this.title = '34460A';
    this.subtitle = '6½ 位數電表';
    this.layout = layout;
    this.practice = [
      '直接按DCV／ACV／Ω2W／Freq／Cont／Temp；Shift再按DCV／ACV／Ω2W／Freq／Cont，分別選DCI／ACI／Ω4W／Cap／Diode。電容快捷入口依原廠手冊，校機照片沒有可辨識的Cap次標籤。',
      '接線：電壓、頻率、已放電電容接Input HI–LO；電流需I 3A–LO串入回路；四線電阻及4W溫度另接Sense HI–LO，電阻與電容量測前關閉電路供電。DCV Ratio另接Sense參考。',
      'Range切Auto／手動，+／−逐檔調整；Aperture用▲▼選NPLC。數值選單用◀▶選位數、▲▼改值、Select完成，這個編輯手勢為教學近似。',
      'Run/Stop保留最後读值，再按恢復；Single等待完整積分窗後停止。Acquire可設定每觸發1–1,000,000筆、手動延遲、下載最近最多1,000筆CSV。Auto記錄由背景定時採集約5Hz，並非真機內部速度。',
      'Null取目前讀值作基準；Shift→Null開Math，可設定dB/dBm、Statistics、Limits與Null數值。Display可選Number、Bar Meter或Histogram；34460A沒有Trend。',
      'Shift→Single開Probe Hold：至少3筆跨0.5秒、變動≤0.1%才捕獲，最多8筆；這是明示的教學穩定判定，原廠算法未公開。',
      'Temp預設PT100四線，Probe軟鍵可選PT100／44007熱敏電阻兩線或四線；Units切°C／°F／K。板上电阻只作感測器等效，不提供熱環境；二極體只提供獨立測試情境。',
      'Shift→Run/Stop執行Reset；Shift→Display開Utility，可Store/Recall一組設定或下載CSV／LCD SVG／設定JSON；Shift→Acquire開Help。硬體I/O、校準、熔絲、精準AC濾波沉降與雜訊未模擬。',
      'DCV Input Z 10M／Auto會改變電路負載；Auto低三檔用10GΩ近似原廠>10GΩ，Sense參考也用10GΩ作教學近似。Auto Zero保留真實選項，理想內部offset=0，不虛構精度差。',
      'I–LO接上後關機或其他功能仍保留等效分流（教學假設）；沒有保險絲熔斷模型。⏻重新開機回到模擬器預設，外部接線與測試情境保留。',
    ];
    this.fixture = 'dcv';
    this.now = () => Date.now() / 1000;
    this.scenarios = {
      title: '單機測試情境 D1（已知訊號接在這台電表上，不是自由接線）',
      list: D1.map(({ id, label, desc }) => ({ id, label, desc })),
      get: () => this.fixture,
      set: (id) => this.setFixture(id),
    };
    this.reset();
  }

  // Factory/Reset defaults are ideal teaching settings. Stored setup and
  // Power On preference are separate from this measurement reset.
  reset() {
    this.on = true;
    this.fn = 'DCV';
    this.shift = false;
    this.per = fresh();
    this.nplc = 10;
    this.inputZMode = '10M';
    this.gate = 0.1;
    this.acFilter = 20;
    this.run = 'run';
    this.triggerMode = 'AUTO';
    this.menu = null;
    this.displayMode = 'NUMBER';
    this.digitMask = 'AUTO'; this.barAuto = true; this.barLow = -1; this.barHigh = 1; this.barFormat = 'LOWHIGH';
    this.secondaryOn = false; this.resetSecondary();
    this.held = null;
    this.pending = null;
    this.sampleEnd = null;
    this.sampleStart = null;
    this.autoZero = true;
    this.ratioOn = false;
    this.tempSensor = 'PT100'; this.tempWire = 4; this.tempUnit = 'C'; this.tempR0 = 100;
    this.dbMode = 'OFF'; this.dbRef = 0; this.dbResistance = 600;
    this.statsOn = false; this.limitsOn = false; this.limitLow = 0; this.limitHigh = 1;
    this.beeper = true; this.probeHold = false; this.probeEntries = []; this.probeWindow = []; this.probeLast = null;
    this.sampleCount = 1; this.triggerDelay = 0; this.delayAuto = true;
    this.histAuto = true; this.histBins = 10; this.histLow = 0; this.histHigh = 1; this.histOuter = false; this.histCumulative = false;
    this.edit = null; this.savedState ??= null; this.powerOnMode ??= 'FACTORY';
    this.clearReadings();
  }

  isOn() { return this.on; }
  get f() { return FUNCS[this.fn]; }
  get st() { return this.per[this.fn]; }
  get fx() { return D1.find((d) => d.id === this.fixture); }
  apertureSeconds() { return this.f.kind === 'F' ? this.gate : this.nplc / 60; }
  inputSignal() {
    if (!this.fx.bench) return null;
    const b = this.benchSource?.(), key = this.f.kind === 'I' ? 'i' : 'v';
    return b?.[`${key}Window`] ?? b?.[key] ?? null;
  }
  clock() { return this.fx.bench ? this.benchSource?.()?.now ?? this.inputSignal()?.now ?? this.now() : this.now(); }
  senseInputZ() { return this.on && this.fn === 'DCV' && this.ratioOn ? 1e10 : null; } // 教學近似，非原廠 Sense 阻值規格。
  clearReadings() { this.readings = []; this.lastSampleKey = null; this.limitFailures = { low: 0, high: 0 }; this.probeWindow = []; this.probeLast = null; }
  effectiveAutoZero() { return this.fn === 'OHM4' || this.ratioOn && this.fn === 'DCV' || this.fn === 'TEMP' && this.tempWire === 4 || this.autoZero; }
  acOf(signal) { return this.sampleEnd != null && typeof signal?.rmsAcOver === 'function' ? signal.rmsAcOver(this.sampleStart, this.sampleEnd) : signal?.ac; }

  // 目前功能看得到的物理量；null＝未提供相容測試輸入。AC 功能只取交流成分、DC 功能只取直流成分（DMM-F03）
  input() {
    const fx = this.fx, f = this.f;
    if (fx.bench) { // 實驗台：HI−LO 電壓或真正串入電路的 I−LO 分流電流
      let b = this.benchSource?.();
      if (!b) return null;
      if (this.sampleEnd != null && typeof b.passiveAt === 'function' && ['R', 'C', 'T'].includes(f.kind)) b = b.passiveAt(beforeEnd(this.sampleEnd));
      if (f.kind === 'V' || f.kind === 'I') {
        const key = f.kind === 'I' ? 'i' : 'v', signal = this.sampleEnd != null ? b[`${key}Window`] ?? b[key] : b[key];
        if (!signal) return null;
        if (this.sampleEnd != null && signal.validOver && !signal.validOver(this.sampleStart, this.sampleEnd)) return null;
        if (f.part === 'ac') return this.acOf(signal);
        const aperture = this.apertureSeconds();
        const tr = this.sampleEnd ?? Math.floor(signal.now / aperture) * aperture;
        return signal.meanOver(tr - aperture, tr);
      }
      if (f.kind === 'R') return this.fn === 'OHM4' ? b.ohm4 ?? null : b.ohm;
      if (f.kind === 'C') return b.cap ?? null;
      if (f.kind === 'D') return null; // board currently has R/C/W only; no nonlinear diode model.
      if (f.kind === 'T') {
        const resistance = this.tempWire === 4 ? b.ohm4 : b.ohm;
        return resistance == null ? null : temperatureOf(resistance, this.tempSensor, this.tempR0);
      }
      if (f.kind === 'F') {
        const v = this.sampleEnd != null ? b.vWindow ?? b.v : b.v;
        if (this.sampleEnd != null && v?.validOver && !v.validOver(this.sampleStart, this.sampleEnd)) return null;
        const clues = this.sampleEnd != null ? v?.frequencyAt?.(beforeEnd(this.sampleEnd)) : null;
        const hz = frequencyOf(clues ? { ...v, ...clues } : v, this.sampleEnd ?? v?.now, this.sampleStart ?? -Infinity);
        return hz == null ? null : this.fn === 'PER' ? 1 / hz : hz;
      }
      return null;
    }
    if (f.kind === 'F') return fx.kind === 'V' && fx.freq >= 3 && fx.freq <= 300e3 && fx.ac > 0
      ? this.fn === 'PER' ? 1 / fx.freq : fx.freq : null;
    if (f.kind === 'T') return fx.kind === 'T' && fx.sensor === this.tempSensor ? temperatureOf(fx.ohm, this.tempSensor, this.tempR0) : null;
    if (f.kind === 'R' && fx.kind === 'T') return this.fn === 'OHM4' && !fx.fourWire ? null : fx.ohm;
    if (!fx.kind || fx.kind !== f.kind) return null;
    if (f.kind === 'R') return this.fn === 'OHM4' && !fx.fourWire ? null : fx.ohm;
    if (f.kind === 'C') return fx.cap;
    if (f.kind === 'D') return fx.vf;
    return f.part === 'dc' ? fx.dc : fx.ac;
  }

  // 輸入峰值（量程要容納）：DC 功能看瞬間最大 |v|、AC 功能看交流峰值；D1 情境是純 DC／純正弦
  peakIn() {
    const fx = this.fx, f = this.f;
    if (['R', 'C', 'T', 'D'].includes(f.kind)) return 0;
    if (fx.bench) {
      const b = this.benchSource?.(), key = f.kind === 'I' ? 'i' : 'v', v = this.sampleEnd != null ? b?.[`${key}Window`] ?? b?.[key] : b?.[key];
      if (!v) return 0;
      const over = f.part === 'ac' ? 'peakAcOver' : 'peakOver';
      return this.sampleEnd != null && typeof v[over] === 'function' ? v[over](this.sampleStart, this.sampleEnd) : f.part === 'ac' ? v.peakAc ?? 0 : v.peak ?? 0;
    }
    if (fx.kind !== f.kind) return 0;
    return f.part === 'ac' || f.kind === 'F' ? Math.abs(fx.ac ?? 0) * Math.SQRT2 : Math.abs(fx.dc);
  }

  rangeIdx() {
    // A stopped Auto acquisition retains its range; manual keys still change
    // the selected range and its physical input load while the sample is held.
    if (this.run !== 'run' && this.held?.idx != null) return this.st.auto ? this.held.idx : this.st.idx;
    const peak = this.peakIn();
    if (!Number.isFinite(peak)) return this.st.idx;
    if (this.f.kind === 'F') {
      const ac = this.fx.bench ? this.acOf(this.inputSignal()) : this.fx.kind === 'V' ? this.fx.ac : null;
      return this.st.auto && ac != null ? pickRange(FUNCS.ACV, ac, peak) : this.st.idx;
    }
    const x = this.input();
    if (x != null && !Number.isFinite(x) && !(x === Infinity && ['R', 'D'].includes(this.f.kind))) return this.st.idx;
    if (this.fx.bench && this.sampleEnd != null && this.st.auto && x != null) return pickRange(this.f, x, peak);
    // Loading and Auto range are solved together by Bench. Keep the physical
    // range even when a recent change is absent from the previous DC aperture.
    if (this.fx.bench && (this.f.kind === 'I' || this.fn === 'DCV' && this.inputZMode === 'AUTO')) return this.st.idx;
    return this.st.auto && x != null ? pickRange(this.f, x, peak) : this.st.idx;
  }

  // I–LO 不隨切 DCV 或關機悄悄開路。非電流功能保留 DCI 檔（教學假設，非手冊確認）。
  currentShunt() { return CURRENT_SHUNT[this.per[this.fn === 'ACI' ? 'ACI' : 'DCI'].idx]; }

  // 接在電路上的輸入電阻（實驗台負載用）：DCV 10 MΩ，Auto低三檔10 GΩ理想近似；
  // ACV 1 MΩ（D-DMM p.21；並聯 < 100 pF 未計入）；其他功能或關機不計
  inputZ() {
    if (!this.on) return null;
    if (this.fn === 'DCV') return this.inputZMode === 'AUTO' && this.st.idx <= 2 ? 10e9 : 10e6;
    return { ACV: 1e6, FREQ: 1e6, PER: 1e6 }[this.fn] ?? null;
  }

  // 接在實驗台上時讀值會隨時間變（DCV 積分窗、電容充放電、關輸出後的新讀值…）：外殼定時重畫。
  // 不只在「還在變」時重畫，否則最後一筆新讀值可能沒畫上去，畫面停在舊值。
  isLive() { return this.on && (this.run === 'single' || this.run === 'run'); }

  // 實驗台 ACV 的適用條件（D-DMM p.11 頻率 3 Hz–300 kHz、p.21 峰值因數最大 10:1）：超出時真機讀值不準，
  // 模擬器仍顯示理想有效值，只在儀器外標示
  specNotes() {
    if (!this.on || !this.fx.bench || !['ACV', 'ACI'].includes(this.fn)) return [];
    const b = this.benchSource?.(), v = this.fn === 'ACI' ? b?.i : b?.v;
    if (!v || !(v.ac > 1e-9)) return [];
    const out = [];
    const hz = (x) => (x >= 1e6 ? `${Number((x / 1e6).toPrecision(4))} MHz` : x >= 1e3 ? `${Number((x / 1e3).toPrecision(4))} kHz` : `${Number(x.toPrecision(4))} Hz`);
    const max = this.fn === 'ACI' ? 5e3 : 300e3;
    if (v.freq > 0 && (v.freq < 3 || v.freq > max)) out.push(`訊號 ${hz(v.freq)} 超出 ${this.fn} 規格 3 Hz–${hz(max)}，真機讀值不準`);
    const cf = v.peakAc / v.ac;
    if (cf > 10) out.push(`峰值因數 ${cf.toFixed(0)} 超過規格上限 10，真機讀值不準`);
    return out;
  }

  settle() { if (this.st.auto) this.st.idx = this.rangeIdx(); } // 記住 Auto 最後選的檔（沒有輸入時沿用）

  reading() {
    let completed = 0;
    while (this.run === 'single' && this.pending && this.clock() >= this.pending.end && completed++ < 256) {
      const { start, end, queued, remaining = 1 } = this.pending;
      this.pending = null; this.sampleEnd = end; this.sampleStart = start; this.held = null;
      this.held = { ...this.liveReading(), idx: this.rangeIdx() };
      this.updateSecondary(this.held, end);
      this.held.secondary = this.secondaryCache;
      this.st.idx = this.held.idx;
      this.record(this.held, end, `single:${end}`);
      this.sampleEnd = null; this.sampleStart = null;
      if (remaining > 1 || queued) {
        const next = remaining > 1 ? remaining - 1 : this.sampleCount;
        const begin = end + this.triggerDelay;
        this.pending = { start: begin, end: begin + this.singleDuration(), remaining: next, queued: remaining > 1 && queued };
      }
      else this.run = 'stop';
    }
    if (this.run !== 'run' && this.held) return { ...this.held };
    if (this.run === 'single') return { state: 'none' };
    const rd = this.liveReading(), time = this.clock(), bucket = Math.floor(time / Math.max(this.apertureSeconds() + this.triggerDelay, 0.001));
    this.updateSecondary(rd, time); rd.secondary = this.secondaryCache;
    this.record(rd, time, `${this.fn}:${bucket}`);
    return rd;
  }

  record(rd, time, key) {
    if (key === this.lastSampleKey) return;
    this.lastSampleKey = key;
    if (rd.state !== 'value' || !Number.isFinite(rd.shown)) { this.probeWindow = []; this.probeLast = null; return; }
    const entry = { time, fn: this.fn, value: rd.shown, raw: rd.raw, unit: this.baseUnitFor(), displayUnit: this.unitFor(rd), text: rd.text };
    this.readings.push(entry); if (this.readings.length > 1000) this.readings.shift();
    if (this.limitsOn) { if (rd.shown < this.limitLow) this.limitFailures.low++; if (rd.shown > this.limitHigh) this.limitFailures.high++; }
    if (!this.probeHold) return;
    const tol = Math.max(Math.abs(rd.shown) * 0.001, 1e-8);
    if (this.probeWindow.some((e) => e.fn !== this.fn || Math.abs(e.value - rd.shown) > tol)) this.probeWindow = [];
    this.probeWindow.push(entry); if (this.probeWindow.length > 16) this.probeWindow.shift();
    if (this.probeWindow.length >= 3 && time - this.probeWindow[0].time >= 0.5 && (!this.probeLast || this.probeLast.fn !== this.fn || Math.abs(this.probeLast.value - rd.shown) > tol)) {
      this.probeEntries.push(entry); if (this.probeEntries.length > 8) this.probeEntries.shift();
      this.probeLast = entry;
    }
  }

  liveReading(x = this.input(), rangeIdx = this.rangeIdx(), frozen = false) {
    const f = this.f, st = this.st;
    if (x == null) {
      const signal = this.sampleEnd != null && this.fx.bench && ['V', 'I', 'F'].includes(f.kind) ? this.inputSignal() : null;
      return signal?.validOver && !signal.validOver(this.sampleStart, this.sampleEnd) ? { state: 'none', why: '量測窗內測試線未完整接妥；不提供未完成的讀值。' } : { state: 'none' };
    }
    // A positive infinity is the explicit open-circuit result for resistance
    // and diode fixtures. An unresolved integral must never become a reading
    // or reach the decimal formatter.
    if (!Number.isFinite(x) && !(x === Infinity && ['R', 'D'].includes(f.kind))) return { state: 'none', unsupported: true, why: '量測窗讀值超過模型可解析範圍；不提供未驗證的讀值。' };
    const r = f.ranges[rangeIdx];
    const peak = frozen ? 0 : this.peakIn();
    if (!Number.isFinite(peak)) return { state: 'none', raw: x, unsupported: true, why: '量測窗峰值超過模型可解析範圍；不提供未驗證的讀值。' };
    const ranged = f.kind === 'F' ? (this.fx.bench ? this.acOf(this.inputSignal()) : this.fx.ac) : Math.abs(x);
    // Capacitance does not overload at 120% of the selected manual range.
    // Above the documented 100 µF range, the unmodelled timeout is shown as unavailable.
    if (this.fn === 'CAP' && x > 1e-4) return { state: 'none', raw: x, unsupported: true };
    if (!frozen && this.fn !== 'CAP' && ranged > r.limit * (1 + 1e-12)) return { state: ['CONT', 'DIODE'].includes(this.fn) ? 'open' : 'over', raw: x };
    if (!frozen && peak > peakLimit(f, r) * (1 + 1e-12)) return { state: 'over', raw: x, peak: true }; // 峰值過載
    let measured = x;
    if (this.fn === 'DCV' && this.ratioOn && !frozen) {
      const ref = this.referenceReading();
      if (!ref?.valid || Math.abs(ref.hi) > 12 || Math.abs(ref.lo) > 12 || !(Math.abs(ref.hi - ref.lo) > 1e-12)) return { state: 'none' };
      measured /= ref.hi - ref.lo;
    }
    const nullOn = st.nullOn && !(this.fn === 'DCV' && this.ratioOn);
    let shown = nullOn ? measured - st.base : measured;
    if (this.fn === 'TEMP') shown = this.tempUnit === 'F' ? shown * 1.8 + (st.nullOn ? 0 : 32) : this.tempUnit === 'K' ? shown + (st.nullOn ? 0 : 273.15) : shown;
    if (this.dbMode !== 'OFF' && ['DCV', 'ACV'].includes(this.fn) && !this.ratioOn) {
      if (!(Math.abs(shown) > 0)) return { state: 'over', raw: x, displayTransformOver: true };
      shown = 10 * Math.log10(shown * shown / this.dbResistance / 0.001) - (this.dbMode === 'DB' ? this.dbRef : 0);
    }
    const rr = f.kind === 'F' ? this.frequencyDisplayRange(shown) : this.ratioOn && this.fn === 'DCV' || this.dbMode !== 'OFF' && f.kind === 'V' ? { mult: 1, p: '', int: Math.max(1, String(Math.floor(Math.abs(shown))).length) } : r;
    const autoDigits = f.kind === 'F' ? (this.gate === 1 ? 7 : this.gate === 0.1 ? 6 : 5)
      : f.part === 'dc' || f.kind === 'R' ? (this.nplc >= 10 ? 7 : this.nplc >= 0.2 ? 6 : 4) : 7;
    const digits = this.digitMask === 'AUTO' ? autoDigits : this.digitMask;
    const text = this.fn === 'TEMP' ? `${shown < 0 ? '-' : '+'}${fmtFixed(Math.abs(shown), Math.min(3, Math.max(0, digits - Math.max(1, String(Math.floor(Math.abs(shown))).length))))}` : fmtReading(shown, rr, digits);
    if (text == null) return { state: 'over', raw: x };
    return { state: 'value', raw: measured, shown, text, beep: this.beeper && (this.fn === 'CONT' && x <= CONT_THRESHOLD || this.fn === 'DIODE' && x >= 0.3 && x <= 0.8), limit: this.limitsOn && (shown < this.limitLow || shown > this.limitHigh) };
  }

  unitFor(rd) {
    if (this.fn === 'TEMP') return { C: '°C', F: '°F', K: 'K' }[this.tempUnit];
    if (this.fn === 'DCV' && this.ratioOn) return 'V/V';
    if (this.dbMode !== 'OFF' && ['DCV', 'ACV'].includes(this.fn)) return this.dbMode === 'DB' ? 'dB' : 'dBm';
    // A held reading keeps the prefix it was formatted with, independently
    // of any newly selected manual range (e.g. mA -> A while stopped).
    const r = this.f.ranges[rd.idx ?? this.rangeIdx()];
    return `${this.f.kind === 'F' ? this.frequencyDisplayRange(rd.shown ?? 0).p : r.p}${this.f.base}${this.f.suffix}`;
  }
  baseUnitFor() {
    return this.fn === 'TEMP' ? { C: '°C', F: '°F', K: 'K' }[this.tempUnit] : this.fn === 'DCV' && this.ratioOn ? 'V/V'
      : this.dbMode !== 'OFF' && ['DCV', 'ACV'].includes(this.fn) ? this.dbMode === 'DB' ? 'dB' : 'dBm' : `${this.f.base}${this.f.suffix}`;
  }

  frequencyDisplayRange(x) {
    const mult = this.fn === 'PER' ? (Math.abs(x) < 1e-3 ? 1e-6 : Math.abs(x) < 1 ? 1e-3 : 1)
      : Math.abs(x) >= 1e3 ? 1e3 : 1;
    return { mult, p: mult === 1e3 ? 'k' : mult === 1e-3 ? 'm' : mult === 1e-6 ? 'µ' : '', int: Math.max(1, String(Math.floor(Math.abs(x / mult))).length) };
  }

  // ---- 輸入 ----
  referenceReading() {
    if (!this.fx.bench) return this.fx.ref;
    const b = this.benchSource?.(), aperture = this.apertureSeconds(), end = this.sampleEnd ?? Math.floor((b?.now ?? b?.v?.now ?? this.now()) / aperture) * aperture;
    return b?.refWindow?.meanOver ? b.refWindow.meanOver(this.sampleStart ?? end - aperture, end) : b?.ref;
  }
  resetSecondary(time = null) { this.secondaryCache = null; this.secondaryAt = null; this.secondarySince = time; }
  secondaryKind() { return this.fn === 'DCV' && this.ratioOn ? 'Input/Ref' : { DCV: 'ACV', ACV: 'Frequency', DCI: 'ACI', ACI: 'Frequency', FREQ: 'Period', PER: 'Frequency', TEMP: 'Sensor' }[this.fn] ?? null; }
  updateSecondary(rd, time) {
    const kind = this.secondaryKind();
    if (!this.secondaryOn || !kind || rd.state !== 'value') { this.secondaryCache = null; return; }
    this.secondarySince ??= time;
    const interleaved = ['ACV', 'ACI'].includes(kind);
    if (interleaved && time - (this.secondaryAt ?? this.secondarySince) < 4 - 1e-9) return;
    const b = this.fx.bench ? this.benchSource?.() : null, key = this.f.kind === 'I' ? 'i' : 'v';
    const signal = this.sampleEnd != null ? b?.[`${key}Window`] ?? b?.[key] : b?.[key];
    let values;
    if (interleaved) {
      const value = b ? this.acOf(signal) : this.fx.kind === this.f.kind ? this.fx.ac : null;
      const peak = b ? this.sampleEnd != null && signal?.peakAcOver ? signal.peakAcOver(this.sampleStart, this.sampleEnd) : signal?.peakAc : Math.abs(value ?? 0) * Math.SQRT2;
      const f = FUNCS[kind], max = f.ranges.at(-1);
      if (!(value >= 0) || !Number.isFinite(value) || !Number.isFinite(peak) || value > max.limit || peak > peakLimit(f, max)) { this.secondaryCache = null; return; }
      values = [{ value, unit: kind === 'ACV' ? 'VAC' : 'AAC' }];
    } else if (kind === 'Frequency' && !['FREQ', 'PER'].includes(this.fn)) {
      const clues = this.sampleEnd != null ? signal?.frequencyAt?.(beforeEnd(this.sampleEnd)) : null;
      const value = b ? frequencyOf(clues ? { ...signal, ...clues } : signal, this.sampleEnd ?? signal?.now, this.sampleStart ?? -Infinity)
        : this.fx.freq >= 3 && this.fx.freq <= 300e3 && this.fx.ac > 0 ? this.fx.freq : null;
      values = [{ value, unit: 'Hz' }];
    } else if (kind === 'Period' || kind === 'Frequency') values = [{ value: rd.raw > 0 ? 1 / rd.raw : null, unit: kind === 'Period' ? 's' : 'Hz' }];
    else if (kind === 'Sensor') {
      const input = this.sampleEnd != null && b?.passiveAt ? b.passiveAt(beforeEnd(this.sampleEnd)) : b;
      const value = input ? this.tempWire === 4 ? input.ohm4 : input.ohm : this.fx.kind === 'T' ? this.fx.ohm : null;
      values = [{ value, unit: 'Ω' }];
    } else if (kind === 'Input/Ref') {
      const ref = this.referenceReading();
      values = [{ value: this.input(), unit: 'VDC' }, { value: ref?.valid ? ref.hi - ref.lo : null, unit: 'VDC' }];
    }
    this.secondaryCache = values?.every(({ value }) => Number.isFinite(value)) ? { kind, values } : null;
    this.secondaryAt = time;
  }
  secondaryView(rd) {
    if (!this.secondaryOn || !this.secondaryKind() || this.probeHold || this.displayMode === 'HIST') return null;
    const s = rd.secondary ?? this.secondaryCache;
    return s ? { ...s, text: s.values.map(({ value, unit }) => `${eng(value, this.digitMask === 'AUTO' ? 6 : this.digitMask - 1)} ${unit}`).join(' / ') } : { kind: this.secondaryKind(), text: '-------', values: [] };
  }
  get barCenter() { return (this.barLow + this.barHigh) / 2; }
  set barCenter(value) { const half = this.barSpan / 2, center = Math.max(-1e9 + half, Math.min(1e9 - half, value)); this.barLow = center - half; this.barHigh = center + half; }
  get barSpan() { return this.barHigh - this.barLow; }
  set barSpan(value) { const center = this.barCenter, half = Math.max(1e-12, Math.abs(center) * Number.EPSILON * 8, Math.min(2e9, value)) / 2; this.barLow = center - half; this.barHigh = center + half; this.barCenter = center; }
  barScale() {
    if (!this.barAuto) return { low: this.barLow, high: this.barHigh };
    const r = this.f.ranges[this.rangeIdx()];
    if (this.dbMode !== 'OFF' && ['DCV', 'ACV'].includes(this.fn)) return { low: -200, high: 200 };
    if (this.fn === 'TEMP') return this.st.nullOn ? { low: this.tempUnit === 'F' ? -360 : -200, high: this.tempUnit === 'F' ? 1080 : 600 }
      : { low: this.tempUnit === 'F' ? -328 : this.tempUnit === 'K' ? 73.15 : -200, high: this.tempUnit === 'F' ? 1112 : this.tempUnit === 'K' ? 873.15 : 600 };
    if (this.fn === 'FREQ') return { low: 0, high: 300e3 };
    if (this.fn === 'PER') return { low: 0, high: 1 / 3 };
    return { low: this.f.part === 'dc' ? -r.v : 0, high: this.fn === 'DIODE' ? 5 : r.v };
  }

  press(id) {
    if (id === POWER) return this.power();
    if (!this.on) return { kind: 'info', text: '電源關閉中：LCD 暗、按鍵沒有作用，先按 ⏻。' };
    const sh = this.shift;
    this.shift = false; // 任何鍵都會解除 Shift（GAP-DMM-02）；Shift 鍵本身在下面切換
    const h = this.dispatch(id, sh);
    this.settle();
    return h;
  }

  dispatch(id, sh) {
    const out = (name, extra = '') => ({ kind: 'out', text: `${name}本輪未納入練習範圍，${extra}按了不改變量測狀態；Shift 已解除。` });
    const soft = /^DMM\.SOFT\.S([1-6])$/.exec(id);
    if (soft) { const handled = this.softPress(Number(soft[1])); if (handled) return handled; }
    switch (id) {
      case K('SHIFT'):
        this.shift = !sh;
        return sh ? { kind: 'info', text: 'Shift 已取消。' }
          : { kind: 'approx', text: 'Shift：接著按有藍字次標籤的鍵執行次功能（DCV→DCI、ACV→ACI），再按一次 Shift 取消。流程依面板藍字推論，LCD 不顯示 Shift（近似）。' };
      case K('DCV'): return this.setFn(sh ? 'DCI' : 'DCV', sh);
      case K('ACV'): return this.setFn(sh ? 'ACI' : 'ACV', sh);
      case K('FREQ'): return this.setFn(sh ? 'CAP' : 'FREQ');
      case K('TEMP'): return this.setFn('TEMP');
      case K('RUN_STOP'):
        if (!sh) return this.toggleRun();
        this.reset(); return { kind: 'info', text: 'Reset：回復前面板量測預設，清除讀值記憶；外部測試接線不變。' };
      case K('SINGLE'): return sh ? this.toggleProbeHold() : this.single();
      case K('ACQUIRE'):
        if (sh) { this.menu = 'HELP'; return { kind: 'info', text: 'Help：S1 操作提示、S2 功能範圍、S3 接線原因；Select 返回。' }; }
        this.menu = this.menu === 'ACQUIRE' ? null : 'ACQUIRE';
        return { kind: 'info', text: 'Acquire：Auto／Single、每次觸發樣本數、延遲；Save Readings 下載目前讀值。外部觸發接頭尚未模擬。' };
      case K('DISPLAY'):
        if (sh) { this.menu = 'UTILITY'; return { kind: 'info', text: 'Utility：Store/Recall 保存與叫回一組量測設定；Manage Files 可下載讀值／LCD圖／設定；Test/Admin 為軟體自檢。實體I/O與校準未模擬。' }; }
        this.menu = this.menu === 'DISPLAY' ? null : 'DISPLAY';
        return { kind: 'info', text: 'Display → Display：Number／Bar Meter／Histogram；34460A 沒有 Trend Chart。圖表使用真實已取得的最多 1,000 筆讀值。' };
      case K('UP'): case K('DOWN'):
        if (this.edit) return this.editNumber(id === K('UP') ? 1 : -1);
        if (this.menu === 'NPLC') return this.setNplc(NPLCS[Math.max(0, Math.min(NPLCS.length - 1, NPLCS.indexOf(this.nplc) + (id === K('UP') ? 1 : -1)))]);
        return { kind: 'info', text: '先選 Aperture，再用 ▲／▼ 調整 NPLC。' };
      case K('LEFT'): case K('RIGHT'):
        if (this.edit) { this.edit.exp = Math.max(-9, Math.min(6, this.edit.exp + (id === K('LEFT') ? 1 : -1))); return { kind: 'info', text: `編輯位數：每次 ▲／▼ 增減 ${10 ** this.edit.exp}；Select 完成。` }; }
        return { kind: 'info', text: '在數值設定中，◀／▶ 選編輯位數，▲／▼ 改值。' };
      case K('SELECT'):
        this.menu = null; this.edit = null;
        return { kind: 'info', text: '返回量測畫面。' };
      case K('OHM_2W'): return this.setFn(sh ? 'OHM4' : 'OHM', sh);
      case K('CONT'): return this.setFn(sh ? 'DIODE' : 'CONT', sh);
      case K('NULL'):
        if (!sh) return this.toggleNull();
        this.menu = 'MATH'; return { kind: 'info', text: 'Math：Null、dB/dBm、Statistics、Limits。34460A 沒有一般 Mx−B scaling 或 Smoothing。' };
      case K('RANGE'): return this.rangeKey('Range');
      case 'DMM.SOFT.S1':
        if (this.fn === 'CONT') return { kind: 'info', text: '導通畫面的 S1 沒有標籤（固定 1 kΩ 量程），按了沒有作用。' };
        return this.rangeKey('S1（Range 軟鍵，近似）');
      case K('RANGE_UP'): return this.step(1);
      case K('RANGE_DOWN'): return this.step(-1);
      default: {
        // OUT 鍵平常由外殼攔下；模型也保證不改狀態
        const name = OUT_NAME[id];
        if (!name) return null;
        const n = Array.isArray(name) ? (sh ? name[1] : name[0]) : name;
        return { kind: 'out', text: `「${n}」本輪未納入練習範圍，按了不會改變儀器狀態${sh ? '；Shift 已解除' : ''}。` };
      }
    }
  }

  // 外殼按到 OUT 鍵時通知：只解除 Shift 並回報未納入，不改其他狀態（DMM-F12）
  onOut(id) { return this.on ? this.press(id) : null; }

  softPress(n) {
    const info = (text) => ({ kind: 'info', text });
    if (this.menu === 'DISPLAY') {
      if (n === 1) { this.menu = 'DISPLAY_SELECT'; return info('選擇 Number 或 Bar Meter。'); }
      if (n === 4 && this.displayMode === 'BAR') { this.menu = 'BAR_SCALE'; return info('Scale：Default依量測範圍；Manual可設Low／High或Center／Span，數值使用目前顯示單位的基本單位。'); }
      if (n === 5) { this.menu = 'SECONDARY'; return info(`2nd Meas：${this.secondaryKind() || '目前功能沒有次測量'}。DCV／DCI次測約4秒更新，使用主功能的實際輸入負載，未模擬硬體交錯切換。`); }
      if (n === 6) { this.menu = 'DIGITS'; return info('Digit Mask：Auto、6½、5½、4½或3½位；僅四捨五入顯示，不改量測與記憶。'); }
      return info('此 Display 選項尚未納入；量測設定保留。');
    }
    if (this.menu === 'DIGITS') {
      if (n <= 5) { this.digitMask = ['AUTO', 7, 6, 5, 4][n - 1]; this.reformatHeld(); this.menu = 'DISPLAY'; return info(`Digit Mask：${this.digitMask === 'AUTO' ? 'Auto' : `${this.digitMask - .5}位`}，只改顯示。`); }
      if (n === 6) { this.menu = 'DISPLAY'; return info('返回 Display。'); }
    }
    if (this.menu === 'SECONDARY') {
      if (n === 1 || n === 2 && this.secondaryKind()) { this.secondaryOn = n === 2; this.resetSecondary(this.clock()); if (this.run === 'stop' && this.secondaryOn) this.secondaryCache = this.held?.secondary ?? null; this.menu = 'DISPLAY'; return info(`2nd Meas：${this.secondaryOn ? this.secondaryKind() : 'Off'}。`); }
      if (n === 6) { this.menu = 'DISPLAY'; return info('返回 Display。'); }
      return info('34460A此主功能沒有其他次測量選項。');
    }
    if (this.menu === 'BAR_SCALE') {
      if (n === 1) { if (this.barAuto) { const { low, high } = this.barScale(); this.barLow = Math.max(-1e9, low); this.barHigh = Math.min(1e9, high); } this.barAuto = !this.barAuto; return info(`Scale：${this.barAuto ? 'Default' : 'Manual'}。`); }
      if (n === 4) { this.barFormat = this.barFormat === 'LOWHIGH' ? 'SPAN' : 'LOWHIGH'; return info(`Scale Format：${this.barFormat === 'SPAN' ? 'Span／Center' : 'High／Low'}。`); }
      if (n === 2 || n === 3) {
        if (this.barAuto) { const { low, high } = this.barScale(); this.barLow = Math.max(-1e9, low); this.barHigh = Math.min(1e9, high); this.barAuto = false; }
        const step = this.f.kind === 'F' ? (this.fn === 'FREQ' ? 1 : .0001) : this.fn === 'TEMP' || this.dbMode !== 'OFF' || this.ratioOn ? .1 : this.f.ranges[this.rangeIdx()].mult / 1000;
        if (this.barFormat === 'SPAN') return this.beginNumber(n === 2 ? 'barCenter' : 'barSpan', n === 2 ? 'Center' : 'Span', step, n === 2 ? -1e9 + this.barSpan / 2 : Math.max(1e-12, Math.abs(this.barCenter) * Number.EPSILON * 8), n === 2 ? 1e9 - this.barSpan / 2 : 2e9);
        const gap = Math.max(1e-12, Math.max(Math.abs(this.barLow), Math.abs(this.barHigh)) * Number.EPSILON * 8);
        return this.beginNumber(n === 2 ? 'barLow' : 'barHigh', n === 2 ? 'Low' : 'High', step, n === 2 ? -1e9 : this.barLow + gap, n === 2 ? this.barHigh - gap : 1e9);
      }
      if (n === 6) { this.menu = 'DISPLAY'; return info('返回 Display。'); }
    }
    if (this.menu === 'DISPLAY_SELECT') {
      if ([1, 2, 4].includes(n)) {
        if (this.probeHold) return info('Probe Hold 使用固定讀值清單；先關 Probe Hold 才能改 Display。');
        this.displayMode = { 1: 'NUMBER', 2: 'BAR', 4: 'HIST' }[n]; this.menu = null; return info(`Display：${this.displayMode}。`);
      }
      return info('34460A 沒有 Trend Chart；請選 Number／Bar Meter／Histogram。');
    }
    if (this.menu === 'ACQUIRE') {
      if (n === 1) {
        this.triggerMode = this.triggerMode === 'AUTO' ? 'SINGLE' : 'AUTO';
        if (this.triggerMode === 'AUTO') { this.run = 'run'; this.held = null; this.pending = null; }
        else { this.held = { ...this.liveReading(), idx: this.rangeIdx() }; this.run = 'stop'; }
        return info(`Trg Src：${this.triggerMode === 'AUTO' ? 'Auto' : 'Single'}。`);
      }
      if (n === 2) return this.beginNumber('sampleCount', 'Samples/Trig', 1, 1, 1e6, true);
      if (n === 3) { this.delayAuto = !this.delayAuto; if (this.delayAuto) this.triggerDelay = 0; return info(`Delay：${this.delayAuto ? 'Auto，教學理想模型不加硬體沉降延遲' : 'Manual'}。`); }
      if (n === 4) { this.delayAuto = false; return this.beginNumber('triggerDelay', 'Delay', 0.01, 0, 3600); }
      if (n === 5) return info('34460A 的樣本依序完成；可調 Sample Timer 只屬34465A／70A，這裡不套用。');
      if (n === 6) return this.downloadReadings();
      return info('實體 Ext Trig／VMC 接頭未模擬。');
    }
    if (this.menu === 'MATH') {
      if (n === 1) return this.toggleNull();
      if (n === 2) { if (!['DCV', 'ACV'].includes(this.fn) || this.ratioOn) return info('dB/dBm 只適用一般 DCV／ACV；先關 DCV Ratio。'); this.menu = 'DB'; return info('dB/dBm：開关、功能、參考值、參考阻抗。'); }
      if (n === 3) { this.menu = 'STATS'; return info('Statistics：顯示 Min／Max／Average／標準差與樣本數；Clear Readings 重新統計。'); }
      if (n === 4) { this.menu = 'LIMITS'; return info('Limits：開關、Low、High、Beeper、Clear Condition；依量測後的顯示值判斷。'); }
      if (n === 5) {
        if (this.fn === 'DCV' && this.ratioOn) return { kind: 'reject', text: 'DCV Ratio 不提供 Null Value（原廠手冊p.374）；先關 Ratio。' };
        return this.beginNumber('nullBase', 'Null Value', this.f.ranges[this.rangeIdx()].mult / 1000, -1e9, 1e9);
      }
      if (n === 6) { this.menu = null; return info('返回量測。'); }
    }
    if (this.menu === 'DB') {
      if (n === 1) { this.dbMode = this.dbMode === 'OFF' ? 'DB' : 'OFF'; this.clearReadings(); this.reformatHeld(); return info(`dB/dBm：${this.dbMode}。`); }
      if (n === 2) { this.dbMode = this.dbMode === 'DBM' ? 'DB' : 'DBM'; this.clearReadings(); this.reformatHeld(); return info(`Function：${this.dbMode}。`); }
      if (n === 3) return this.beginNumber('dbRef', 'dB Ref', 1, -200, 200);
      if (n === 4) {
        const rd = this.reading(), x = rd.raw == null ? null : rd.raw - (this.st.nullOn ? this.st.base : 0);
        if (rd.state !== 'value' || !Number.isFinite(x) || !x) return info('沒有有效有限非零電壓，不能量參考值。');
        this.dbRef = 10 * Math.log10(x * x / this.dbResistance / .001); this.clearReadings(); this.reformatHeld();
        return info(`Measure Ref：${this.dbRef.toFixed(6)} dBm；與目前讀值使用同一Null電壓基準。`);
      }
      if (n === 5) return this.beginNumber('dbResistance', 'Ref R', 1, 50, 8000, true);
      if (n === 6) { this.menu = 'MATH'; this.edit = null; return info('返回 Math。'); }
    }
    if (this.menu === 'STATS') {
      if (n === 1) { if (this.probeHold) return info('Probe Hold 不能併用統計顯示。'); this.statsOn = !this.statsOn; return info(`Statistics：${this.statsOn ? 'On' : 'Off'}。`); }
      if (n === 6) { this.clearReadings(); return info('已清除讀值、統計、Histogram 與超限計數。'); }
    }
    if (this.menu === 'LIMITS') {
      if (n === 1) { this.limitsOn = !this.limitsOn; return info(`Limits：${this.limitsOn ? 'On' : 'Off'}。`); }
      if (n === 2) return this.beginNumber('limitLow', 'Low Limit', this.f.ranges[this.rangeIdx()].mult / 1000, -1e9, this.limitHigh);
      if (n === 3) return this.beginNumber('limitHigh', 'High Limit', this.f.ranges[this.rangeIdx()].mult / 1000, this.limitLow, 1e9);
      if (n === 4) { this.beeper = !this.beeper; return info(`Beeper：${this.beeper ? 'On' : 'Off'}；畫面提示，未產生聲音。`); }
      if (n === 6) { this.limitFailures = { low: 0, high: 0 }; return info('已清除累計超限條件。'); }
    }
    if (this.menu === 'PROBE' || this.probeHold && !this.menu) {
      if (n === 1) return this.toggleProbeHold();
      if (n === 2) { this.beeper = !this.beeper; return info(`Beeper：${this.beeper ? 'On' : 'Off'}。`); }
      if (n === 3) { this.probeEntries.pop(); this.probeLast = null; return info('移除最後一笔 Probe Hold 讀值。'); }
      if (n === 4) { this.probeEntries = []; this.probeWindow = []; this.probeLast = null; return info('已清除 Probe Hold 清單。'); }
    }
    if (this.menu === 'HELP') { if (n === 6) { this.menu = null; return info('返回量測。'); } return info(n === 1 ? `目前 ${this.f.zh}：${this.practice[0]} 數值選項使用◀▶移位、▲▼改值、Select返回。` : n === 2 ? '可量R/C與線性電路訊號；二極體僅獨立情境，未加入麵包板二極體；硬體校準／I/O不模擬。' : this.compatNote() || '目前接線可提供本功能所需的量測輸入。'); }
    if (this.menu === 'UTILITY') {
      if (n === 1) { this.menu = 'STORE'; return info('Store/Recall：S1保存、S2叫回、S3下載、S4選Power On；UserDefined使用已保存的設定槽。'); }
      if (n === 2) { this.menu = 'FILES'; return info('Manage Files：讀值 CSV、LCD SVG、設定 JSON 下載。'); }
      if (n === 3) return info('實體 USB／LAN／GPIB 介面未連接模擬器，不能發出遠端控制指令。');
      if (n === 4) return info('軟體自檢完成：目前功能、量程、積分設定均有效；這不是硬體自檢或校準。');
      if (n === 5) { this.beeper = !this.beeper; return info(`System Setup：Beeper ${this.beeper ? 'On' : 'Off'}；市電60Hz、畫面480×318為此模擬器設定。`); }
    }
    if (this.menu === 'STORE') {
      if (n === 1) { this.savedState = this.measurementState(); return info('目前量測設定已保存到模擬器的一個記憶槽；不保存接線或讀值。'); }
      if (n === 2) { if (!this.savedState) return info('尚未 Store State。'); const defaults = new DmmModel().measurementState(); Object.assign(this, defaults, structuredClone(this.savedState)); this.run = 'run'; this.triggerMode = 'AUTO'; this.probeHold = false; this.held = null; this.pending = null; this.resetSecondary(); this.clearReadings(); this.menu = null; return info('已叫回量測設定；重新採集讀值。'); }
      if (n === 3) return this.downloadState();
      if (n === 4) {
        const next = ['FACTORY', 'LAST', 'USER'][(['FACTORY', 'LAST', 'USER'].indexOf(this.powerOnMode) + 1) % 3];
        if (next === 'USER' && !this.savedState) return { kind: 'reject', text: 'UserDefined必須先Store State；目前保持Last。' };
        this.powerOnMode = next;
        return info(`Power On：${{ FACTORY: 'FactoryDefaults', LAST: 'Last', USER: 'UserDefined（目前保存的設定槽）' }[next]}；重新開機後生效，重新採集，不保留舊讀值。`);
      }
      if (n === 5) { this.reset(); return info('Set to Defaults：重設量測狀態；Power On偏好、已保存設定槽、外部測試輸入保留。'); }
      if (n === 6) { this.menu = 'UTILITY'; return info('返回Utility。'); }
    }
    if (this.menu === 'FILES') {
      if (n === 1) return this.downloadReadings();
      if (n === 2) return { kind: 'info', text: '已下載目前 LCD 圖。', download: { name: '34460A-screen.svg', mime: 'image/svg+xml', text: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="318">${this.lcd()}</svg>` } };
      if (n === 3) return this.downloadState();
    }
    if (this.edit) { if (n === 6) { this.menu = this.edit.back; this.edit = null; return info('數值設定完成。'); } return info('◀／▶ 選位數，▲／▼ 改值；Select 返回。'); }
    if (this.menu === 'NPLC') {
      if (n === 6) { this.menu = null; return info('返回量測畫面。'); }
      return null;
    }
    if (this.menu === 'HIST') {
      if (n === 1) { this.histBins = [10, 20, 40, 100, 200, 400][([10, 20, 40, 100, 200, 400].indexOf(this.histBins) + 1) % 6]; this.clearReadings(); return info(`Bins：${this.histBins}。`); }
      if (n === 2) return this.beginNumber('histLow', 'Bin Low', this.f.ranges[this.rangeIdx()].mult / 1000, -1e9, this.histHigh - 1e-12);
      if (n === 3) return this.beginNumber('histHigh', 'Bin High', this.f.ranges[this.rangeIdx()].mult / 1000, this.histLow + 1e-12, 1e9);
      if (n === 6) { this.menu = null; return info('返回 Histogram。'); }
    }
    if (this.menu && !['NPLC'].includes(this.menu)) return info('此軟鍵沒有目前選單的功能；Select 返回量測。');
    if (this.displayMode === 'HIST' && !this.menu) {
      if (n === 1) { this.menu = 'DISPLAY_SELECT'; return info('選擇顯示型式。'); }
      if (n === 2) { this.histAuto = !this.histAuto; this.clearReadings(); return info(`Binning：${this.histAuto ? 'Auto' : 'Manual'}。`); }
      if (n === 3) { this.menu = 'HIST'; return info('Bin Settings：Bins／Low／High；修改後清除讀值。'); }
      if (n === 4) { this.histOuter = !this.histOuter; return info(`Outer Bins：${this.histOuter ? 'On' : 'Off'}。`); }
      if (n === 5) { this.histCumulative = !this.histCumulative; return info(`Cumulative：${this.histCumulative ? 'On' : 'Off'}。`); }
      if (n === 6) { this.clearReadings(); return info('已清除 Histogram 與讀值記憶。'); }
    }
    if (this.f.kind === 'F') {
      if (n === 1) return this.setFn(this.fn === 'FREQ' ? 'PER' : 'FREQ');
      if (n === 2) return this.rangeKey('Range');
      if (n === 3) { this.acFilter = [3, 20, 200][([3, 20, 200].indexOf(this.acFilter) + 1) % 3]; return info(`AC Filter：>${this.acFilter} Hz。模型仍以理想訊號計算，不模擬原廠濾波器沉降。`); }
      if (n === 4) { this.gate = GATES[(GATES.indexOf(this.gate) + 1) % GATES.length]; return info(`Gate Time：${this.gate} s，顯示解析度與 Single 等待時間同步改變。`); }
      return info('34460A 的 Timeout 不是可調前面板選項；沒有可辨識的週期訊號時讀值留空。');
    }
    if (this.fn === 'TEMP') {
      if (n === 1) { const probes = [['PT100', 4], ['PT100', 2], ['THERMISTOR', 2], ['THERMISTOR', 4]], i = probes.findIndex(([s, w]) => s === this.tempSensor && w === this.tempWire); [this.tempSensor, this.tempWire] = probes[(i + 1) % probes.length]; this.restartAcquisition(); return info(`Probe：${this.tempSensor} ${this.tempWire}W，重新採集。麵包板電阻值僅作理想感測器等效，需選對型式。`); }
      if (n === 2 && this.tempSensor === 'PT100') return this.beginNumber('tempR0', 'R0', 1, 80, 120);
      if (n === 3 && this.tempWire === 2) { this.autoZero = !this.autoZero; return info(`Auto Zero：${this.autoZero ? 'On' : 'Off'}；理想offset=0，讀值不會人為改變。`); }
      if (n === 4) { this.menu = 'NPLC'; return info('Aperture：▲／▼選 NPLC。'); }
      if (n === 5) { this.tempUnit = ['C', 'F', 'K'][(['C', 'F', 'K'].indexOf(this.tempUnit) + 1) % 3]; this.clearReadings(); this.reformatHeld(); return info(`Units：${this.tempUnit}。`); }
    }
    if (['CONT', 'DIODE'].includes(this.fn) && n === 1) { this.beeper = !this.beeper; return info(`Beeper：${this.beeper ? 'On' : 'Off'}；畫面提示，尚無聲音。`); }
    if (n === 2 && (this.f.part === 'dc' || ['OHM', 'OHM4'].includes(this.fn))) {
      this.menu = 'NPLC'; return info('Aperture：用 ▲／▼ 選 0.02、0.2、1、10 或 100 PLC；Select 返回。積分窗與顯示位數會同步改變。');
    }
    if (n === 3 && ['DCV', 'DCI', 'OHM'].includes(this.fn)) {
      if (this.fn === 'DCV' && this.ratioOn) return info('DCV Ratio 的 Auto Zero 固定開啟。');
      this.autoZero = !this.autoZero; return info(`Auto Zero：${this.autoZero ? 'On' : 'Off'}；教學模型內部offset=0，兩種設定讀值相同，不虛構校準誤差。`);
    }
    if (n === 3 && ['ACV', 'ACI'].includes(this.fn)) { this.acFilter = [3, 20, 200][([3, 20, 200].indexOf(this.acFilter) + 1) % 3]; return info(`AC Filter：>${this.acFilter}Hz；理想有效值模型未模擬硬體沉降。`); }
    if (n === 4 && this.fn === 'DCV') {
      this.inputZMode = this.inputZMode === '10M' ? 'AUTO' : '10M';
      return info(`Input Z：${this.inputZMode === '10M' ? '10 MΩ' : 'Auto：100 mV／1 V／10 V 檔採 10 GΩ 理想近似；100 V／1000 V 檔 10 MΩ'}。輸入負載會影響實驗台電路。`);
    }
    if (n === 5 && this.fn === 'DCV') { this.ratioOn = !this.ratioOn; this.dbMode = 'OFF'; this.secondaryOn = false; this.resetSecondary(); if (this.ratioOn) this.st.nullOn = false; this.clearReadings(); this.held = null; this.pending = null; this.run = 'run'; return info(`DCV Ratio：${this.ratioOn ? 'On；Null已關閉（原廠Ratio不提供Null）。必須另外接Sense HI／LO；各Sense相對InputLO不得超過±12V且參考不為零。Sense負載用10GΩ作教學近似。' : 'Off'}。`); }
    return null;
  }

  beginNumber(field, label, step, min, max, integer = false) {
    if (field === 'nullBase') label += ` (${this.fn === 'TEMP' ? { C: '°C', F: '°F', K: 'K' }[this.tempUnit] : this.f.base})`;
    this.edit = { field, label, exp: Math.round(Math.log10(step)), min, max, integer, back: this.menu };
    this.menu = 'EDIT'; return { kind: 'info', text: `${label}：◀／▶ 選位數、▲／▼ 改值；Select 完成（編輯手勢為教學近似）。` };
  }
  editNumber(dir) {
    const e = this.edit, old = e.field === 'nullBase' ? this.nullBaseValue() : this[e.field];
    let next;
    if (e.field === 'dbResistance') next = DB_RESISTANCES[Math.max(0, Math.min(DB_RESISTANCES.length - 1, DB_RESISTANCES.indexOf(old) + dir))];
    else next = Math.max(e.min, Math.min(e.max, Number((old + dir * 10 ** e.exp).toPrecision(12))));
    if (e.integer) next = Math.round(next);
    if (e.field === 'nullBase') { this.st.base = this.fn === 'TEMP' ? this.tempUnit === 'F' ? (next - 32) / 1.8 : this.tempUnit === 'K' ? next - 273.15 : next : next; this.st.nullOn = true; }
    else this[e.field] = next;
    if (['nullBase', 'dbRef', 'dbResistance', 'tempR0', 'histLow', 'histHigh'].includes(e.field)) this.clearReadings();
    if (e.field === 'tempR0') this.restartAcquisition();
    if (['nullBase', 'dbRef', 'dbResistance'].includes(e.field)) this.reformatHeld();
    return { kind: 'info', text: `${e.label}：${next}。` };
  }
  toggleProbeHold() {
    this.probeHold = !this.probeHold; this.clearReadings(); this.probeWindow = []; this.probeLast = null;
    if (this.probeHold) { this.probeRestore = { displayMode: this.displayMode, statsOn: this.statsOn }; this.displayMode = 'NUMBER'; this.statsOn = false; this.run = 'run'; this.held = null; this.pending = null; this.menu = 'PROBE'; }
    else { Object.assign(this, this.probeRestore ?? {}); this.menu = null; }
    return { kind: 'approx', text: `Probe Hold：${this.probeHold ? 'On，最多8筆；穩定判定採至少3筆、0.5秒內變動≤0.1%的教學近似，原廠算法未公開。' : 'Off，恢復先前顯示設定。'}` };
  }
  restartAcquisition() { this.run = 'run'; this.triggerMode = 'AUTO'; this.held = null; this.pending = null; this.resetSecondary(); this.clearReadings(); }
  measurementState() {
    return structuredClone(Object.fromEntries(['fn', 'per', ...DMM_SETTING_FIELDS].map((k) => [k, this[k]])));
  }
  downloadReadings() {
    this.reading();
    return { kind: 'info', text: `下載 ${this.readings.length} 筆已完成讀值；最多保留最近1,000筆，連續量測記錄由背景定時採集（約5Hz），Single逐筆記錄。`, download: { name: '34460A-readings.csv', mime: 'text/csv;charset=utf-8', text: 'time_s,function,value,unit\n' + this.readings.map((r) => `${r.time},${r.fn},${r.value},${r.unit}`).join('\n') + '\n' } };
  }
  downloadState() { return { kind: 'info', text: '下載目前 DMM 量測設定；完整接線保存使用「匯出實驗」。', download: { name: '34460A-state.json', mime: 'application/json', text: JSON.stringify({ instrument: '34460A', version: 1, state: this.measurementState() }, null, 2) } }; }

  setNplc(value) {
    if (!NPLCS.includes(value)) return { kind: 'reject', text: '34460A NPLC 必須為 0.02、0.2、1、10 或 100。' };
    this.nplc = value;
    if (this.run === 'single') { this.run = 'stop'; this.pending = null; this.single(); }
    return { kind: 'info', text: `Aperture：${value} PLC（${Number((value / 60).toPrecision(5))} s，台灣 60 Hz），新讀值依此積分。` };
  }

  toggleRun() {
    if (this.run === 'run') {
      this.held = { ...this.liveReading(), idx: this.rangeIdx(), secondary: this.secondaryCache }; this.run = 'stop'; this.pending = null;
      return { kind: 'info', text: 'Run/Stop：停止採集並保留最後讀值；電路仍繼續運作。' };
    }
    if (this.run === 'single') {
      this.pending = null; this.run = 'stop';
      return { kind: 'info', text: 'Run/Stop：取消進行中的 Single，保留上一筆讀值。' };
    }
    this.run = 'run'; this.triggerMode = 'AUTO'; this.held = null; this.pending = null;
    return { kind: 'info', text: 'Run/Stop：Auto 連續量測恢復。' };
  }

  single() {
    this.reading();
    if (this.run === 'single' && this.pending) {
      const queued = this.pending.queued;
      this.pending.queued = true;
      return { kind: 'info', text: queued ? 'Single：已有一個等待觸發，再次觸發忽略。' : 'Single：正在完成目前一筆；再排入一筆觸發（最多緩衝一筆）。' };
    }
    if (this.run === 'run') this.held = { ...this.liveReading(), idx: this.rangeIdx() };
    this.triggerMode = 'SINGLE'; this.run = 'single';
    const start = this.clock() + this.triggerDelay;
    this.pending = { start, end: start + this.singleDuration(), remaining: this.sampleCount };
    return { kind: 'info', text: `Single：延遲${this.triggerDelay}s後開始量${this.sampleCount}筆（每筆${Number(this.singleDuration().toPrecision(5))}s），完成後停止並保留讀值。` };
  }

  singleDuration() {
    // Frequency needs several real, post-trigger cycles; never take the
    // pre-trigger history as the new single measurement's evidence.
    const signal = this.fx.bench ? this.inputSignal() : this.fx;
    const hint = signal?.carrierFreq ?? signal?.freq;
    return this.f.kind === 'F' && hint >= 3 && hint <= 300e3 ? Math.max(this.gate, 5 / hint) : this.apertureSeconds();
  }

  power() {
    if (this.on) {
      this.on = false;
      this.shift = false;
      return { kind: 'approx', text: '模擬電源關：LCD 暗、其他鍵沒有作用。' };
    }
    const mode = this.powerOnMode, restored = mode === 'LAST' ? this.measurementState() : mode === 'USER' ? this.savedState : null;
    this.reset();
    if (restored) Object.assign(this, structuredClone(restored), { powerOnMode: mode });
    this.run = 'run'; this.triggerMode = 'AUTO'; this.menu = null;
    return { kind: 'approx', text: `模擬電源開：${{ FACTORY: 'FactoryDefaults（DCV、Auto、Null off教學預設）', LAST: 'Last（關機時的量測設定）', USER: restored ? 'UserDefined（已保存的設定槽）' : 'UserDefined尚無設定槽，回FactoryDefaults' }[mode]}；重新採集，外部測試輸入不變。Power On三種選擇依原廠p.141，硬體校準與檔案系統不模擬。` };
  }

  setFixture(id) {
    const fx = D1.find((d) => d.id === id);
    if (!fx) return null;
    this.fixture = id;
    const head = fx.bench ? '改用實驗台接線：電壓／電阻接 HI–LO；電流將 I 3A–LO 串入回路。'
      : fx.kind ? `單機測試情境：${fx.label}，接在 ${TERM[fx.kind]}。` : '已拔除測試輸入。';
    if (!this.on) return { kind: 'info', text: `${head}電表電源關閉中，開機後才有讀值。` };
    this.settle();
    const h = this.readingHint();
    const nul = this.st.nullOn && this.reading().state === 'value' ? 'Null 開啟中：顯示＝新讀值－原基準（不重取基準）。' : '';
    return { kind: h?.kind ?? 'info', text: head + (h ? h.text : '') + nul };
  }

  // 讀值狀態的儀器外說明（不相容／超量程／開路）；正常讀值回 null
  readingHint() {
    const danger = this.currentWarning();
    if (danger) return { kind: 'reject', text: danger };
    const rd = this.reading();
    const label = this.f.ranges[this.rangeIdx()].label;
    if (rd.state === 'none') return { kind: 'info', text: `${rd.why || '未提供相容測試輸入：' + this.compatNote()}LCD 讀值欄留空。` };
    if (rd.state === 'over') {
      const why = rd.peak ? `峰值超過 ${label} 檔的容量（約 3 倍量程，依峰值因數規格）` : this.st.auto ? `超過最大量程 ${label}` : `手動 ${label} 檔太小`;
      return { kind: 'approx', text: `超量程：${why}，讀值欄顯示中性記號「-------」（原廠字樣未取得，近似）。` };
    }
    if (rd.state === 'open') return { kind: 'info', text: this.fn === 'DIODE' ? 'Diode：1 mA 測試情境的壓降大於5V，顯示 OPEN。' : '開路：電阻超過 1.2 kΩ，LCD 顯示 OPEN。' };
    if (rd.beep) return { kind: 'approx', text: this.fn === 'DIODE' ? 'Diode：1 mA測試情境壓降在0.3–0.8 V，LCD出現提示指示；未模擬硬體提示音。' : '導通：電阻 ≤ 10 Ω，LCD 出現 ·)) 導通指示（畫面為近似；提示音本模擬器未提供）。' };
    const spec = this.specNotes();
    if (spec.length) return { kind: 'approx', text: `${spec.join('；')}（模擬器顯示理想有效值）。` };
    return null;
  }

  currentWarning() {
    const i = this.fx.bench ? this.benchSource?.()?.i : null;
    const rms = i && Math.hypot(i.dc, i.ac);
    return Number.isFinite(rms) && rms > 3 * (1 + 1e-12) ? 'I–LO 的總有效電流（含 DC 成分）超過 3 A 額定輸入，必須拆除錯接或降低電源；沒有模擬保險絲熔斷，讀值不能表示此接法安全。' : '';
  }

  // 實驗台：外殼注入電路來源（回傳 { v:{dc,ac}|null, i:{dc,ac}|null, ohm|null, why, whyR, whyI }）
  setBenchSource(fn) { this.benchSource = fn; }

  compatNote() {
    const fx = this.fx;
    if (fx.bench) {
      const b = this.benchSource?.() ?? {};
      if (b.why) return b.why;
      if (this.fn === 'OHM4') return b.why4 || '';
      if (this.f.kind === 'R') return b.whyR || '';
      if (this.f.kind === 'C') return b.whyC || '本模型只量已放電、與電阻負載分離的電容網路；不模擬漏電或原廠充電演算法。';
      if (this.f.kind === 'D') return '麵包板沒有二極體元件；請選獨立二極體測試情境。';
      if (this.f.kind === 'T') return (this.tempWire === 4 ? b.why4 : b.whyR) || '將未通電電阻網路視為所選感測器的理想等效；未提供感測器熱環境。';
      if (this.fn === 'DCV' && this.ratioOn) return b.ref?.valid ? '' : 'DCV Ratio 必須有 Input HI／LO 與 Sense HI／LO；兩個Sense相對InputLO在±12V內、參考不為零。';
      if (this.f.kind === 'I') return b.whyI || '';
      if (this.f.kind === 'V') return b.whyV || '';
      return '';
    }
    if (!fx.kind) return '目前沒有接測試情境。';
    return `「${fx.label}」是${CAT[fx.kind]}，要用 ${USE[fx.kind]} 量（目前是 ${this.f.key}）。`;
  }

  setFn(fn, viaShift = false) {
    this.fn = fn;
    this.menu = null; this.edit = null; this.run = 'run'; this.triggerMode = 'AUTO'; this.held = null; this.pending = null; this.dbMode = 'OFF'; this.secondaryOn = false; this.resetSecondary(); this.clearReadings();
    const pre = viaShift ? `Shift 次功能：${fn}。` : '';
    const v = this.view();
    const h = this.readingHint()
      ?? { kind: 'info', text: `${this.f.key}（${this.f.zh}）：${[v.rangeLabel, `${v.text} ${v.unit}`].filter(Boolean).join('，')}。${this.note()}` };
    return { kind: pre ? 'approx' : h.kind, text: pre + h.text };
  }

  // Range：Auto⇄手動（進手動鎖定目前檔；回 Auto 立即依輸入重選）——GAP-DMM-03 暫定
  rangeKey(name) {
    if (['CONT', 'DIODE', 'TEMP'].includes(this.fn)) return { kind: 'info', text: this.fn === 'CONT' ? '導通固定 1 kΩ 量程；Range 不改量程。' : `${this.f.key} 使用固定測試量程；Range 不改量程。` };
    const st = this.st;
    if (st.auto) {
      st.idx = this.rangeIdx();
      st.auto = false;
      return { kind: 'approx', text: `${name}：Auto → 手動，鎖定在 ${this.f.ranges[st.idx].label}（鍵語義為推論，近似）。` };
    }
    st.auto = true;
    return { kind: 'approx', text: `${name}：手動 → Auto，依輸入選到 ${this.f.ranges[this.rangeIdx()].label}（近似）。` };
  }

  // +／−：手動逐檔升降；Auto 時先轉手動再移一檔；端點停住不循環（GAP-DMM-03 暫定）
  step(dir) {
    if (['CONT', 'DIODE', 'TEMP'].includes(this.fn)) return { kind: 'info', text: `${this.f.key} 使用固定測試量程；+／− 不改量程。` };
    const st = this.st, rs = this.f.ranges;
    let pre = '';
    if (st.auto) {
      st.idx = this.rangeIdx();
      st.auto = false;
      pre = `Auto 時按 ${dir > 0 ? '+' : '−'} 先轉手動（近似）；`;
    }
    const to = st.idx + dir;
    if (to < 0 || to >= rs.length) {
      return { kind: pre ? 'approx' : 'info', text: `${pre}已是${dir > 0 ? '最高' : '最低'}量程 ${rs[st.idx].label}，不會循環。` };
    }
    st.idx = to;
    const over = this.reading().state === 'over';
    return { kind: 'approx', text: `${pre}手動 ${rs[to].label}${over ? '：超量程，讀值欄顯示中性記號「-------」（原廠字樣未取得）' : ''}（量程鍵語義為推論，近似）。` };
  }

  // Null：按下以當下有效讀值為基準；每功能各存 {on, 基準}；超量程／無輸入不能開（GAP-DMM-07 暫定）
  toggleNull() {
    if (this.fn === 'DCV' && this.ratioOn) return { kind: 'reject', text: 'DCV Ratio 不提供 Null（原廠手冊p.374）；先關 Ratio 再使用 Null。' };
    const st = this.st;
    if (st.nullOn) {
      st.nullOn = false;
      this.clearReadings(); this.reformatHeld();
      return { kind: 'info', text: `${this.f.key} 的 Null 關：回到原量測值。` };
    }
    const rd = this.reading();
    if (rd.state === 'none') return { kind: 'reject', text: '沒有相容測試輸入、沒有讀值，不能開 Null。' };
    if (rd.state !== 'value') return { kind: 'reject', text: '讀值超量程（或 OPEN）時不能拿來當 Null 基準。' };
    st.nullOn = true;
    st.base = rd.raw;
    this.clearReadings(); this.reformatHeld();
    return { kind: 'approx', text: `${this.f.key} 的 Null 開：以目前讀值 ${plain(rd.raw, this.f.base)} 為基準，之後顯示＝量測值－基準${this.dbMode !== 'OFF' ? '，再轉dB/dBm；差值0V的對數無定義，顯示超限記號。Null基準是電壓單位，不是dB。' : '。'}` };
  }
  reformatHeld() { if (this.held?.state === 'value' || this.held?.displayTransformOver) this.held = { ...this.liveReading(this.held.raw, this.held.idx, true), idx: this.held.idx, secondary: this.held.secondary }; }
  nullBaseValue() { return this.fn === 'TEMP' ? this.tempUnit === 'F' ? this.st.base * 1.8 + 32 : this.tempUnit === 'K' ? this.st.base + 273.15 : this.st.base : this.st.base; }

  turn() { return null; } // 34460A 沒有旋鈕

  // ---- 輸出 ----
  view() {
    const f = this.f, st = this.st, rd = this.reading(), r = f.ranges[this.rangeIdx()];
    const text = { value: rd.text, over: '-------', open: 'OPEN', none: '' }[rd.state];
    const scale = this.barScale();
    return {
      fnName: f.name,
      state: rd.state,
      text,
      value: rd.state === 'value' ? rd.shown : null,
      unit: rd.state === 'open' ? '' : this.unitFor(rd),
      rangeLabel: ['CONT', 'DIODE'].includes(this.fn) ? '' : this.fn === 'TEMP' ? `${this.tempSensor} ${this.tempWire}W` : `${st.auto ? 'Auto' : 'Manual'} ${r.label}`,
      nullOn: st.nullOn && !(this.fn === 'DCV' && this.ratioOn),
      beep: !!rd.beep,
      soft: this.softLabels(r),
      triggerLabel: this.run === 'run' ? 'Auto Trigger' : this.run === 'single' ? 'Single Trigger' : 'Stopped',
      displayMode: this.displayMode,
      bar: rd.state === 'value' ? Math.max(0, Math.min(1, (rd.shown - scale.low) / (scale.high - scale.low))) : null,
      barScale: { ...scale, zero: Math.max(0, Math.min(1, -scale.low / (scale.high - scale.low))), unit: this.fn === 'TEMP' ? this.unitFor(rd) : this.fn === 'DCV' && this.ratioOn ? 'V/V' : this.dbMode !== 'OFF' ? this.unitFor(rd) : this.f.base },
      secondary: this.secondaryView(rd),
      stats: this.statsOn && !this.probeHold ? this.statistics() : null,
      histogram: this.displayMode === 'HIST' && !this.probeHold ? this.histogram() : null,
      probe: this.probeHold ? this.probeEntries : null,
      edit: this.edit ? { label: this.edit.label, value: this.edit.field === 'nullBase' ? this.nullBaseValue() : this[this.edit.field], step: 10 ** this.edit.exp } : null,
      limit: !!rd.limit, limits: this.limitsOn ? this.limitFailures : null,
    };
  }

  // 軟鍵列（GAP-DMM-04）：DCV 照 datasheet 產品照 S1–S5；其他功能只有 S1 Range；導通沒有
  softLabels(r) {
    const s = (label, value = '') => ({ label, value: String(value) });
    if (this.menu === 'EDIT') return [s(this.edit.label, this.edit.field === 'nullBase' ? this.nullBaseValue() : this[this.edit.field]), s('Step', 10 ** this.edit.exp), null, null, null, s('Done')];
    if (this.menu === 'ACQUIRE') return [s('Trg Src', this.triggerMode === 'AUTO' ? 'Auto' : 'Single'), s('Samples/Trig', this.sampleCount), s('Delay Auto', this.delayAuto ? 'On' : 'Off'), s('Delay Man', `${this.triggerDelay}s`), null, s('Save Readings')];
    if (this.menu === 'MATH') return [s('Null', this.st.nullOn ? 'On' : 'Off'), s('dB/dBm', this.dbMode), s('Statistics'), s('Limits'), s('Null Value', this.nullBaseValue()), s('Done')];
    if (this.menu === 'DB') return [s('Scaling', this.dbMode === 'OFF' ? 'Off' : 'On'), s('Function', this.dbMode === 'DBM' ? 'dBm' : 'dB'), s('dB Ref', this.dbRef), s('Measure Ref'), s('Ref R', `${this.dbResistance}Ω`), s('Back')];
    if (this.menu === 'STATS') return [s('Statistics', this.statsOn ? 'On' : 'Off'), null, null, null, null, s('Clear Readings')];
    if (this.menu === 'LIMITS') return [s('Limits', this.limitsOn ? 'On' : 'Off'), s('Low', this.limitLow), s('High', this.limitHigh), s('Beeper', this.beeper ? 'On' : 'Off'), null, s('Clear Condition')];
    if (this.menu === 'PROBE' || this.probeHold && !this.menu) return [s('Probe Hold', this.probeHold ? 'On' : 'Off'), s('Beeper', this.beeper ? 'On' : 'Off'), s('Remove Last'), s('Clear List')];
    if (this.menu === 'HELP') return [s('How To'), s('Scope'), s('Input Status'), null, null, s('Done')];
    if (this.menu === 'UTILITY') return [s('Store/Recall'), s('Manage Files'), s('I/O'), s('Test/Admin'), s('System Setup')];
    if (this.menu === 'STORE') return [s('Store State'), s('Recall State'), s('Save State'), s('Power On', { FACTORY: 'Factory', LAST: 'Last', USER: 'UserDefined' }[this.powerOnMode]), s('Set Defaults'), s('Back')];
    if (this.menu === 'FILES') return [s('Readings CSV'), s('Screen SVG'), s('State JSON')];
    if (this.menu === 'HIST') return [s('Bins', this.histBins), s('Low', this.histLow), s('High', this.histHigh), null, null, s('Done')];
    if (this.menu === 'DISPLAY') return [s('Display', this.displayMode === 'BAR' ? 'Bar Meter' : this.displayMode === 'HIST' ? 'Histogram' : 'Number'), null, null, this.displayMode === 'BAR' ? s('Scale', this.barAuto ? 'Default' : 'Manual') : null, s('2nd Meas', this.secondaryOn ? this.secondaryKind() ?? 'Off' : 'Off'), s('Digit Mask', this.digitMask === 'AUTO' ? 'Auto' : `${this.digitMask - .5}`)];
    if (this.menu === 'DISPLAY_SELECT') return [{ label: 'Number', value: '' }, { label: 'Bar Meter', value: '' }, null, { label: 'Histogram', value: '' }];
    if (this.menu === 'DIGITS') return [s('Auto'), s('6½'), s('5½'), s('4½'), s('3½'), s('Back')];
    if (this.menu === 'SECONDARY') return [s('Off'), this.secondaryKind() ? s(this.secondaryKind()) : null, null, null, null, s('Back')];
    if (this.menu === 'BAR_SCALE') return [s('Scale', this.barAuto ? 'Default' : 'Manual'), s(this.barFormat === 'SPAN' ? 'Center' : 'Low', this.barFormat === 'SPAN' ? this.barCenter : this.barLow), s(this.barFormat === 'SPAN' ? 'Span' : 'High', this.barFormat === 'SPAN' ? this.barSpan : this.barHigh), s('Format', this.barFormat === 'SPAN' ? 'Span/Center' : 'Low/High'), null, s('Back')];
    if (this.menu === 'NPLC') return [null, { label: 'Aperture', value: `${this.nplc} PLC` }, null, null, null, { label: 'Done', value: '' }];
    if (this.displayMode === 'HIST') return [s('Display', 'Histogram'), s('Binning', this.histAuto ? 'Auto' : 'Manual'), s('Bin Settings'), s('Outer Bins', this.histOuter ? 'On' : 'Off'), s('Cumulative', this.histCumulative ? 'On' : 'Off'), s('Clear Readings')];
    if (['CONT', 'DIODE'].includes(this.fn)) return [{ label: 'Beeper', opts: ['Off', 'On'], sel: this.beeper ? 1 : 0 }];
    if (this.fn === 'TEMP') return [s('Probe', `${this.tempSensor} ${this.tempWire}W`), this.tempSensor === 'PT100' ? s('R0', `${this.tempR0}Ω`) : null, this.tempWire === 2 ? s('Auto Zero', this.autoZero ? 'On' : 'Off') : null, s('Aperture', `${this.nplc} PLC`), s('Units', this.tempUnit)];
    if (this.f.kind === 'F') return [{ label: 'Freq/Period', value: this.fn === 'FREQ' ? 'Freq' : 'Period' }, { label: 'Range', value: this.st.auto ? 'Auto' : r.label },
      { label: 'AC Filter', value: `>${this.acFilter}Hz` }, { label: 'Gate Time', value: this.gate === 1 ? '1s' : `${this.gate * 1000}ms` }];
    const s1 = { label: 'Range', value: this.st.auto ? 'Auto' : r.label };
    const aperture = { label: 'Aperture', value: `${this.nplc} PLC` };
    if (this.fn !== 'DCV') return this.fn === 'OHM4' ? [s1, aperture] : this.f.part === 'dc' || this.fn === 'OHM' ? [s1, aperture, s('Auto Zero', this.autoZero ? 'On' : 'Off')] : this.f.part === 'ac' ? [s1, null, s('AC Filter', `>${this.acFilter}Hz`)] : [s1];
    return [s1, aperture, this.ratioOn ? null : { label: 'Auto Zero', opts: ['Off', 'On'], sel: this.autoZero ? 1 : 0 },
      { label: 'Input Z', opts: ['10M', 'Auto'], sel: this.inputZMode === 'AUTO' ? 1 : 0 }, { label: 'DCV Ratio', opts: ['Off', 'On'], sel: this.ratioOn ? 1 : 0 }];
  }

  statistics() {
    const xs = this.readings.map((r) => r.value), n = xs.length;
    if (!n) return { count: 0 };
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    return { count: n, min: Math.min(...xs), max: Math.max(...xs), mean, sd: Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / n), hideMean: this.dbMode !== 'OFF', unit: this.readings[0]?.unit ?? this.baseUnitFor() };
  }
  histogram() {
    const xs = this.readings.map((r) => r.value), n = xs.length;
    let low = this.histAuto && n ? Math.min(...xs) : this.histLow, high = this.histAuto && n ? Math.max(...xs) : this.histHigh;
    if (!(high > low)) { const pad = Math.max(Math.abs(low) * .01, 1e-6); low -= pad; high += pad; }
    const bins = this.histAuto ? n <= 100 ? 10 : n <= 500 ? 20 : 40 : this.histBins;
    const counts = Array(bins).fill(0); let under = 0, over = 0;
    for (const x of xs) { if (x < low) under++; else if (x > high) over++; else counts[Math.min(bins - 1, Math.floor((x - low) / (high - low) * bins))]++; }
    if (this.histOuter) { counts.unshift(under); counts.push(over); }
    return { counts, low, high, total: n, cumulative: this.histCumulative, under, over, unit: this.readings[0]?.unit ?? this.baseUnitFor() };
  }

  lcd() { return this.on ? renderLcd(this.view()) : ''; }
  visual() { return {}; }

  // 儀器外補充（AC／DC 成分、有效值換算）
  note() {
    const fx = this.fx, f = this.f;
    const rd = this.reading();
    if (rd.state === 'none') return rd.why || this.compatNote();
    if (!['V', 'I'].includes(f.kind) || !fx.kind) return '';
    const mine = f.part === 'ac' ? fx.ac : fx.dc;
    const other = f.part === 'ac' ? fx.dc : fx.ac;
    if (mine === 0 && other !== 0) {
      return f.part === 'ac' ? `${f.key} 是 AC 耦合真有效值，只量交流成分：純 DC 情境的交流成分＝0。` : `${f.key} 只量直流成分：純正弦的直流（平均）成分＝0。`;
    }
    if (f.part === 'ac') return `讀值是有效值（rms）；正弦峰值＝rms×√2 ≈ ${plain(fx.ac * Math.SQRT2, f.base)}。`;
    return '';
  }

  status() {
    const fx = this.fx;
    const scen = ['測試情境', fx.bench ? '實驗台接線（電壓 HI−LO；電流 I 3A−LO）' : fx.kind ? `${fx.label}（${TERM[fx.kind]}）` : '未接（在下方選 D1 情境）'];
    const shunt = fx.bench && this.benchSource?.()?.i ? ['電流端負載', `${Number(this.currentShunt().toPrecision(5))} Ω（負擔上限等效近似；關機／其他功能仍導通，不模擬熔絲）`] : null;
    const danger = this.currentWarning();
    if (!this.on) return [['電源', '關：LCD 暗、按鍵無作用（按 ⏻ 開機）'], scen, ...(shunt ? [shunt] : []), ...(danger ? [['錯接／超限', danger]] : [])];
    const f = this.f, st = this.st, r = f.ranges[this.rangeIdx()], rd = this.reading(), v = this.view();
    const read = rd.state === 'value'
      ? `${v.text} ${v.unit}${this.fn === 'CONT' ? `（＝${plain(rd.shown, 'Ω')}）` : ''}${rd.beep ? '；≤ 10 Ω 導通，LCD 顯示 ·)) 指示' : ''}`
      : {
        none: '未提供相容測試輸入（LCD 讀值欄留空）',
        over: '超量程（讀值欄顯示中性記號，原廠字樣未取得，近似）',
        open: this.fn === 'DIODE' ? 'OPEN：二極體壓降>5V' : 'OPEN：開路，電阻>1.2kΩ',
      }[rd.state];
    const rows = [
      ['功能', `${f.key}（${f.zh}）`],
      ['量程', this.fn === 'CONT' ? '固定 1 kΩ（導通門檻 10 Ω）' : st.auto ? `Auto → ${r.label}（選檔規則近似）` : `手動 ${r.label}`],
      ['讀值', read],
      ['Null', st.nullOn ? `開（基準 ${plain(st.base, f.base)}）` : '關'],
      ['Shift', this.shift ? '已按下：下一個藍字鍵執行次功能（近似）' : '未按'],
      ['採集', this.run === 'run' ? 'Auto 連續量測' : this.run === 'single' ? 'Single 積分中，完成後保留讀值' : '停止，保留最後讀值'],
      scen,
    ];
    const spec = this.specNotes();
    if (shunt) rows.push(shunt);
    if (danger) rows.push(['錯接／超限', danger]);
    if (spec.length) rows.push(['規格外', `${spec.join('；')}（這裡顯示理想有效值）`]);
    if (this.fx.bench && ['DCV', 'DCI'].includes(this.fn) && rd.state === 'value') rows.push(['積分', `${this.fn} 每筆讀值是 ${this.nplc} PLC（${Number((this.nplc / 60).toPrecision(5))} 秒）內的平均：波形比這個慢，讀值會跟著起伏`]);
    if (this.fx.bench && this.inputZ()) rows.push(['輸入電阻', `${this.inputZ() / 1e6} MΩ${this.inputZ() === 1e10 ? '（>10 GΩ 用10 GΩ作理想近似）' : ''}；接在電路上會分走一點電流`]);
    if (this.f.kind === 'F') rows.push(['頻率模型', '以 HI−LO 實際波形的重複上升交越量測；3 Hz–300 kHz。沒有週期或不穩定時留空，不直接抄 AFG 設定。AC Filter 只保存選擇，不模擬濾波沉降。']);
    rows.push(['讀值記憶', `${this.readings.length}/1,000筆；Auto由背景定時採集（約5Hz），Single完成時逐筆採集；不模擬真機內部讀值吞吐速度。`]);
    if (['DCV', 'DCI', 'OHM', 'OHM4', 'TEMP'].includes(this.fn)) rows.push(['Auto Zero', `${this.effectiveAutoZero() ? 'On' : 'Off'}；理想內部offset=0，不虛構精度變化。`]);
    if (this.fn === 'OHM4') rows.push(['四線', '必須接Input HI／LO與Sense HI／LO四條線，電路關電；以獨立測試電流及Sense壓差解算。']);
    if (this.fn === 'CAP') rows.push(['電容模型', '只量已放電、無跨電容節點電阻負載的1nF–100µF等效電容網路；充電、漏電及超過100µF的演算法超時不模擬。手動小量程不以120%判超載。']);
    if (this.fn === 'TEMP') rows.push(['溫度模型', `${this.tempSensor} ${this.tempWire}W；${this.tempSensor === 'PT100' ? `IEC PT100 Callendar–Van Dusen，R0=${this.tempR0}Ω，80–120Ω可設` : '只適用5kΩ 44007係數'}；板上的電阻只作理想感測器等效，不提供環境溫度。`]);
    if (this.ratioOn && this.fn === 'DCV') rows.push(['DCV Ratio', 'Input HI−LO ÷ (Sense HI−LO)；Sense各相對InputLO須±12V內，10GΩ輸入負載為教學近似。']);
    if (this.dbMode !== 'OFF') rows.push(['dB/dBm', `10 log10(V²／${this.dbResistance}Ω／1mW)${this.dbMode === 'DB' ? `－${this.dbRef}dBm參考` : ''}；僅DCV/ACV。`]);
    if (this.probeHold) rows.push(['Probe Hold', `${this.probeEntries.length}/8筆；至少3筆跨0.5秒、變動≤0.1%才捕獲（原廠穩定判定未公开，教學近似）；退出恢復先前顯示。`]);
    if (this.displayMode === 'HIST') rows.push(['Histogram', '用已取得讀值重分箱；Auto分箱跨度算法採理想近似，沒有套用其他機型的Trend或游標。']);
    const note = this.note();
    if (note) rows.push(['說明', note]);
    return rows;
  }

  snapshot() {
    return {
      on: this.on, fn: this.fn, shift: this.shift, fixture: this.fixture,
      auto: this.st.auto, range: this.f.ranges[this.rangeIdx()].label,
      view: this.on ? this.view() : null,
      per: this.per,
      nplc: this.nplc, inputZMode: this.inputZMode, gate: this.gate, acFilter: this.acFilter,
      run: this.run, triggerMode: this.triggerMode, menu: this.menu, displayMode: this.displayMode,
      ...this.measurementState(),
      probeHold: this.probeHold,
    };
  }
}
