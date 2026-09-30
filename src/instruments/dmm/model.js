// 34460A 行為模型（I05）。規格：docs/data/dmm.json（DMM-F01～F15、GAP-DMM-01～23）。
// 操作手冊（M-DMM）未取得：Shift、Range、Null、軟鍵等面板流程都是推論（PD），在儀器外用 approx 提示標示。
// 讀值是理想教學值：測試情境的物理量 → 功能相容判定 → 選檔（GAP-DMM-05）→ 超量程判定 → 格式化，不加雜訊（GAP-DMM-20）。
import { fmtFixed } from '../../core/format.js';
import layout from './layout.js';
import { renderLcd } from './lcd.js';

const K = (s) => `DMM.KEY.${s}`;
const POWER = 'DMM.PWR.POWER';

// 量程：v＝滿刻度（基本單位）；limit＝可讀上限，20% 超量程，1000 VDC、750 VAC、3 A 為 0%（D-DMM p.12 註 2）
const PFX = { V: [[1, ''], [1e-3, 'm'], [1e-6, 'µ']], A: [[1, ''], [1e-3, 'm'], [1e-6, 'µ']], 'Ω': [[1e6, 'M'], [1e3, 'k'], [1, '']] };
function range(v, base, over = 1.2) {
  const [mult, p] = PFX[base].find(([m]) => v >= m * 0.999);
  const n = Math.round(v / mult);
  return { v, mult, p, int: String(n).length, label: `${n}${p}${base}`, limit: v * over };
}
const I_RANGES = [1e-4, 1e-3, 1e-2, 0.1, 1].map((v) => range(v, 'A')).concat(range(3, 'A', 1));

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
  CONT: { key: 'Cont', zh: '導通', name: 'Continuity', kind: 'R', base: 'Ω', suffix: '', ranges: [range(1e3, 'Ω')] },
};
export const CONT_THRESHOLD = 10; // Ω，D-DMM p.21 "Continuity threshold Fixed at 10 Ω"；≤ 的邊界為 PD（GAP-DMM-08）

// 單機測試情境 D1（common §0.4）：情境自帶量測類型，只在相容功能有讀值（GAP-DMM-18）
export const D1 = [
  { id: 'none', label: '未接測試輸入', desc: '端子上沒有任何訊號：每個功能都沒有讀值。' },
  { id: 'dcv', kind: 'V', dc: 1.234, ac: 0, label: 'DC 1.234 V', desc: '電壓類，接 Input HI／LO。' },
  { id: 'acv', kind: 'V', dc: 0, ac: 2, label: 'AC 2.000 Vrms（1 kHz 純正弦）', desc: '電壓類，接 Input HI／LO。' },
  { id: 'r1k', kind: 'R', ohm: 1000, label: '電阻 1.000 kΩ', desc: '電阻類，接 Input HI／LO。' },
  { id: 'short', kind: 'R', ohm: 0.5, label: '導通短路 0.5 Ω', desc: '電阻類（兩條測試線碰在一起），接 Input HI／LO。' },
  { id: 'open', kind: 'R', ohm: Infinity, label: '開路', desc: '電阻類（測試線之間沒有接東西），接 Input HI／LO。' },
  { id: 'dci', kind: 'I', dc: 0.01234, ac: 0, label: 'DC 12.34 mA', desc: '電流類，串在 I 3A／LO。' },
  { id: 'aci', kind: 'I', dc: 0, ac: 0.005, label: 'AC 5.000 mArms（1 kHz 純正弦）', desc: '電流類，串在 I 3A／LO。' },
  { id: 'bench', bench: true, label: '實驗台接線', desc: '測試線接在「實驗台」分頁的電路上：HI、LO 接在哪裡就量哪裡（電壓、電阻）。' },
];
const TERM = { V: 'Input HI／LO', R: 'Input HI／LO', I: 'I 3A／LO' };
const CAT = { V: '電壓類', R: '電阻類', I: '電流類' };
const USE = { V: 'DCV 或 ACV', R: 'Ω 2W 或 Cont', I: 'DCI 或 ACI（Shift → DCV／ACV）' };

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
export function fmtReading(x, r) {
  const v = x / r.mult;
  for (let int = r.int; int <= 7; int++) {
    const d = 7 - int;
    const s = fmtFixed(Math.abs(v), d);
    const [ip, fp = ''] = s.split('.');
    if (ip.length > int) continue;
    const sign = v < 0 && !/^[0.]+$/.test(s) ? '-' : '+';
    return sign + ip.padStart(int, '0') + (d ? `.${fp.match(/.{1,3}/g).join(' ')}` : '');
  }
  return null;
}
const plain = (x, base) => `${Number(x.toPrecision(6))} ${base}`;

const fresh = () => Object.fromEntries(Object.keys(FUNCS).map((k) => [k, { auto: true, idx: 0, nullOn: false, base: 0 }]));
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
      '功能鍵：DCV、ACV、Ω 2W、Cont ·)) 直接按；DCI、ACI＝先按 Shift 再按 DCV／ACV（先按後按的流程依面板藍字推論，近似）。',
      '測試情境：在上方選 D1 情境。只有相容功能有讀值：電壓→DCV／ACV、電阻→Ω 2W／Cont、電流→DCI／ACI；不相容時讀值欄留空。',
      '量程：Range 切 Auto／手動（進手動鎖定目前檔）；+／− 在手動逐檔升降，到端點停住；S1 軟鍵＝Range。Auto 選能容納讀值的最小檔（≤ 1.2×量程），換檔門檻手冊未取得，近似。',
      '超量程：手動量程太小時讀值欄顯示「-------」中性記號（原廠字樣未取得）；導通 > 1.2 kΩ 顯示 OPEN、≤ 10 Ω 出現 ·)) 導通指示。',
      'Null：有讀值時按 Null，以當下讀值為基準、之後顯示差值；再按一次關閉。每個功能各自保存 Null（按下即取基準、切功能保留皆為近似）。',
      '電源 ⏻：關機後按鍵無作用；開機回到模擬器預設 DCV、Auto、Null 關（非原廠開機記憶）；測試情境不受影響。',
      'LCD 字樣近似清單：DC Voltage、VDC／mVDC、Auto 1V、Auto Trigger 與 DCV 軟鍵列來自 datasheet 產品照（p.3–4）；AC Voltage、DC Current、AC Current、2-Wire Ohms、Continuity、VAC／ADC／AAC、Manual、Null、OPEN 為推論字樣。',
    ];
    this.fixture = 'dcv';
    this.scenarios = {
      title: '單機測試情境 D1（已知訊號接在這台電表上，不是自由接線）',
      list: D1.map(({ id, label, desc }) => ({ id, label, desc })),
      get: () => this.fixture,
      set: (id) => this.setFixture(id),
    };
    this.reset();
  }

  // 模擬器「電源開」＝DCV、Auto、Null 關（GAP-DMM-14 暫定，非原廠開機記憶）；測試情境在儀器外，不跟著重設
  reset() {
    this.on = true;
    this.fn = 'DCV';
    this.shift = false;
    this.per = fresh();
  }

  isOn() { return this.on; }
  get f() { return FUNCS[this.fn]; }
  get st() { return this.per[this.fn]; }
  get fx() { return D1.find((d) => d.id === this.fixture); }

  // 目前功能看得到的物理量；null＝未提供相容測試輸入。AC 功能只取交流成分、DC 功能只取直流成分（DMM-F03）
  input() {
    const fx = this.fx, f = this.f;
    if (fx.bench) { // 實驗台：由電路算出 HI−LO（J 階段）
      const b = this.benchSource?.();
      if (!b) return null;
      if (f.kind === 'V') {
        if (!b.v) return null;
        if (f.part === 'ac') return b.v.ac;
        const tr = Math.floor(b.v.now / APERTURE) * APERTURE; // 最近一次讀值的積分窗 [tr−10 PLC, tr]
        return b.v.meanOver(tr - APERTURE, tr);
      }
      if (f.kind === 'R') return b.ohm;
      return null;
    }
    if (!fx.kind || fx.kind !== f.kind) return null;
    if (f.kind === 'R') return fx.ohm;
    return f.part === 'dc' ? fx.dc : fx.ac;
  }

  // 輸入峰值（量程要容納）：DC 功能看瞬間最大 |v|、AC 功能看交流峰值；D1 情境是純 DC／純正弦
  peakIn() {
    const fx = this.fx, f = this.f;
    if (f.kind === 'R') return 0;
    if (fx.bench) { const v = this.benchSource?.()?.v; return v ? (f.part === 'ac' ? v.peakAc : v.peak) : 0; }
    if (fx.kind !== f.kind) return 0;
    return f.part === 'ac' ? Math.abs(fx.ac) * Math.SQRT2 : Math.abs(fx.dc);
  }

  rangeIdx() {
    const x = this.input();
    return this.st.auto && x != null ? pickRange(this.f, x, this.peakIn()) : this.st.idx;
  }

  // 接在電路上的輸入電阻（實驗台負載用）：DCV 10 MΩ（Input Z 預設 10M；>10 GΩ 選項未納入）、
  // ACV 1 MΩ（D-DMM p.21；並聯 < 100 pF 未計入）；其他功能或關機不計
  inputZ() {
    if (!this.on) return null;
    return { DCV: 10e6, ACV: 1e6 }[this.fn] ?? null;
  }

  // 讀值會隨時間變（實驗台 DCV 的積分窗與電容充放電；ACV 是穩態有效值，不變）：外殼要定時重畫
  isLive() {
    if (!this.on || !this.fx.bench || this.fn !== 'DCV') return false;
    return !!this.benchSource?.()?.v?.live;
  }

  // 實驗台 ACV 的適用條件（D-DMM p.11 頻率 3 Hz–300 kHz、p.21 峰值因數最大 10:1）：超出時真機讀值不準，
  // 模擬器仍顯示理想有效值，只在儀器外標示
  specNotes() {
    if (!this.on || !this.fx.bench || this.fn !== 'ACV') return [];
    const v = this.benchSource?.()?.v;
    if (!v || !(v.ac > 1e-9)) return [];
    const out = [];
    const hz = (x) => (x >= 1e6 ? `${Number((x / 1e6).toPrecision(4))} MHz` : x >= 1e3 ? `${Number((x / 1e3).toPrecision(4))} kHz` : `${Number(x.toPrecision(4))} Hz`);
    if (v.freq > 0 && (v.freq < 3 || v.freq > 300e3)) out.push(`訊號 ${hz(v.freq)} 超出 ACV 規格 3 Hz–300 kHz，真機讀值不準`);
    const cf = v.peakAc / v.ac;
    if (cf > 10) out.push(`峰值因數 ${cf.toFixed(0)} 超過規格上限 10，真機讀值不準`);
    return out;
  }

  settle() { if (this.st.auto) this.st.idx = this.rangeIdx(); } // 記住 Auto 最後選的檔（沒有輸入時沿用）

  reading() {
    const f = this.f, st = this.st, x = this.input();
    if (x == null) return { state: 'none' };
    const r = f.ranges[this.rangeIdx()];
    if (Math.abs(x) > r.limit * (1 + 1e-12)) return { state: this.fn === 'CONT' ? 'open' : 'over', raw: x };
    if (this.peakIn() > peakLimit(f, r) * (1 + 1e-12)) return { state: 'over', raw: x, peak: true }; // 峰值過載
    const shown = st.nullOn ? x - st.base : x; // Null：量測值－基準（超量程／無輸入時不做減法）
    const text = fmtReading(shown, r);
    if (text == null) return { state: 'over', raw: x };
    return { state: 'value', raw: x, shown, text, beep: this.fn === 'CONT' && x <= CONT_THRESHOLD };
  }

  // ---- 輸入 ----
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
    switch (id) {
      case K('SHIFT'):
        this.shift = !sh;
        return sh ? { kind: 'info', text: 'Shift 已取消。' }
          : { kind: 'approx', text: 'Shift：接著按有藍字次標籤的鍵執行次功能（DCV→DCI、ACV→ACI），再按一次 Shift 取消。流程依面板藍字推論，LCD 不顯示 Shift（近似）。' };
      case K('DCV'): return this.setFn(sh ? 'DCI' : 'DCV', sh);
      case K('ACV'): return this.setFn(sh ? 'ACI' : 'ACV', sh);
      case K('OHM_2W'): return sh ? out('Ω4W 四線電阻（Shift→Ω 2W）', '不會用兩線假裝四線量測，') : this.setFn('OHM');
      case K('CONT'): return sh ? out('二極體測試（Shift→Cont）') : this.setFn('CONT');
      case K('NULL'): return sh ? out('Math（Shift→Null）', 'Null 開關不變，') : this.toggleNull();
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

  power() {
    if (this.on) {
      this.on = false;
      this.shift = false;
      return { kind: 'approx', text: '模擬電源關：LCD 暗、其他鍵沒有作用。' };
    }
    this.reset();
    return { kind: 'approx', text: '模擬電源開：DCV、Auto、Null 關（模擬器暫定預設，非原廠開機記憶）；測試情境不變。' };
  }

  setFixture(id) {
    const fx = D1.find((d) => d.id === id);
    if (!fx) return null;
    this.fixture = id;
    const head = fx.bench ? '改用實驗台接線：讀值來自實驗台上的電路（HI、LO 接在哪裡就量哪裡）。'
      : fx.kind ? `單機測試情境：${fx.label}，接在 ${TERM[fx.kind]}。` : '已拔除測試輸入。';
    if (!this.on) return { kind: 'info', text: `${head}電表電源關閉中，開機後才有讀值。` };
    this.settle();
    const h = this.readingHint();
    const nul = this.st.nullOn && this.reading().state === 'value' ? 'Null 開啟中：顯示＝新讀值－原基準（不重取基準）。' : '';
    return { kind: h?.kind ?? 'info', text: head + (h ? h.text : '') + nul };
  }

  // 讀值狀態的儀器外說明（不相容／超量程／開路）；正常讀值回 null
  readingHint() {
    const rd = this.reading();
    const label = this.f.ranges[this.rangeIdx()].label;
    if (rd.state === 'none') return { kind: 'info', text: `未提供相容測試輸入：${this.compatNote()}LCD 讀值欄留空。` };
    if (rd.state === 'over') {
      const why = rd.peak ? `峰值超過 ${label} 檔的容量（約 3 倍量程，依峰值因數規格）` : this.st.auto ? `超過最大量程 ${label}` : `手動 ${label} 檔太小`;
      return { kind: 'approx', text: `超量程：${why}，讀值欄顯示中性記號「-------」（原廠字樣未取得，近似）。` };
    }
    if (rd.state === 'open') return { kind: 'approx', text: '開路：電阻超過 1.2 kΩ，LCD 顯示 OPEN（字樣依搜尋摘要，近似）。' };
    if (rd.beep) return { kind: 'approx', text: '導通：電阻 ≤ 10 Ω，LCD 出現 ·)) 導通指示（畫面為近似；提示音本模擬器未提供）。' };
    const spec = this.specNotes();
    if (spec.length) return { kind: 'approx', text: `${spec.join('；')}（模擬器顯示理想有效值）。` };
    return null;
  }

  // 實驗台：外殼注入電路來源（回傳 { v:{dc,ac}|null, ohm|null, why, whyR, whyI }）
  setBenchSource(fn) { this.benchSource = fn; }

  compatNote() {
    const fx = this.fx;
    if (fx.bench) {
      const b = this.benchSource?.() ?? {};
      if (b.why) return b.why;
      if (this.f.kind === 'R') return b.whyR || '';
      if (this.f.kind === 'I') return b.whyI || '';
      return '';
    }
    if (!fx.kind) return '目前沒有接測試情境。';
    return `「${fx.label}」是${CAT[fx.kind]}，要用 ${USE[fx.kind]} 量（目前是 ${this.f.key}）。`;
  }

  setFn(fn, viaShift = false) {
    this.fn = fn;
    const pre = viaShift ? `Shift→${fn === 'DCI' ? 'DCV' : 'ACV'}＝${fn}（路徑依面板藍字推論，近似）。` : '';
    const v = this.view();
    const h = this.readingHint()
      ?? { kind: 'info', text: `${this.f.key}（${this.f.zh}）：${[v.rangeLabel, `${v.text} ${v.unit}`].filter(Boolean).join('，')}。${this.note()}` };
    return { kind: pre ? 'approx' : h.kind, text: pre + h.text };
  }

  // Range：Auto⇄手動（進手動鎖定目前檔；回 Auto 立即依輸入重選）——GAP-DMM-03 暫定
  rangeKey(name) {
    if (this.fn === 'CONT') return CONT_FIXED;
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
    if (this.fn === 'CONT') return CONT_FIXED;
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
    const st = this.st;
    if (st.nullOn) {
      st.nullOn = false;
      return { kind: 'info', text: `${this.f.key} 的 Null 關：回到原量測值。` };
    }
    const rd = this.reading();
    if (rd.state === 'none') return { kind: 'reject', text: '沒有相容測試輸入、沒有讀值，不能開 Null。' };
    if (rd.state !== 'value') return { kind: 'reject', text: '讀值超量程（或 OPEN）時不能拿來當 Null 基準。' };
    st.nullOn = true;
    st.base = rd.raw;
    return { kind: 'approx', text: `${this.f.key} 的 Null 開：以目前讀值 ${plain(rd.raw, this.f.base)} 為基準，之後顯示＝量測值－基準（按下即取基準屬推論，近似）。` };
  }

  turn() { return null; } // 34460A 沒有旋鈕

  // ---- 輸出 ----
  view() {
    const f = this.f, st = this.st, r = f.ranges[this.rangeIdx()], rd = this.reading();
    const text = { value: rd.text, over: '-------', open: 'OPEN', none: '' }[rd.state];
    return {
      fnName: f.name,
      state: rd.state,
      text,
      value: rd.state === 'value' ? rd.shown : null,
      unit: rd.state === 'open' ? '' : `${r.p}${f.base}${f.suffix}`,
      rangeLabel: this.fn === 'CONT' ? '' : `${st.auto ? 'Auto' : 'Manual'} ${r.label}`,
      nullOn: st.nullOn,
      beep: !!rd.beep,
      soft: this.softLabels(r),
    };
  }

  // 軟鍵列（GAP-DMM-04）：DCV 照 datasheet 產品照 S1–S5；其他功能只有 S1 Range；導通沒有
  softLabels(r) {
    if (this.fn === 'CONT') return [];
    const s1 = { label: 'Range', value: this.st.auto ? 'Auto' : r.label };
    if (this.fn !== 'DCV') return [s1];
    return [s1, { label: 'Aperture', value: '10 PLC' }, { label: 'Auto Zero', opts: ['Off', 'On'], sel: 1 },
      { label: 'Input Z', opts: ['10M', 'Auto'], sel: 0 }, { label: 'DCV Ratio', opts: ['Off', 'On'], sel: 0 }];
  }

  lcd() { return this.on ? renderLcd(this.view()) : ''; }
  visual() { return {}; }

  // 儀器外補充（AC／DC 成分、有效值換算）
  note() {
    const fx = this.fx, f = this.f;
    if (this.reading().state === 'none') return this.compatNote();
    if (f.kind === 'R' || !fx.kind) return '';
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
    const scen = ['測試情境', fx.bench ? '實驗台接線（HI−LO）' : fx.kind ? `${fx.label}（${TERM[fx.kind]}）` : '未接（在下方選 D1 情境）'];
    if (!this.on) return [['電源', '關：LCD 暗、按鍵無作用（按 ⏻ 開機）'], scen];
    const f = this.f, st = this.st, r = f.ranges[this.rangeIdx()], rd = this.reading(), v = this.view();
    const read = rd.state === 'value'
      ? `${v.text} ${v.unit}${this.fn === 'CONT' ? `（＝${plain(rd.shown, 'Ω')}）` : ''}${rd.beep ? '；≤ 10 Ω 導通，LCD 顯示 ·)) 指示' : ''}`
      : {
        none: '未提供相容測試輸入（LCD 讀值欄留空）',
        over: '超量程（讀值欄顯示中性記號，原廠字樣未取得，近似）',
        open: 'OPEN：開路，電阻 > 1.2 kΩ（字樣近似）',
      }[rd.state];
    const rows = [
      ['功能', `${f.key}（${f.zh}）`],
      ['量程', this.fn === 'CONT' ? '固定 1 kΩ（導通門檻 10 Ω）' : st.auto ? `Auto → ${r.label}（選檔規則近似）` : `手動 ${r.label}`],
      ['讀值', read],
      ['Null', st.nullOn ? `開（基準 ${plain(st.base, f.base)}）` : '關'],
      ['Shift', this.shift ? '已按下：下一個藍字鍵執行次功能（近似）' : '未按'],
      scen,
    ];
    const spec = this.specNotes();
    if (spec.length) rows.push(['規格外', `${spec.join('；')}（這裡顯示理想有效值）`]);
    if (this.fx.bench && this.fn === 'DCV' && rd.state === 'value') rows.push(['積分', 'DCV 每筆讀值是 10 PLC（1/6 秒）內的平均：波形比這個慢，讀值會跟著起伏']);
    if (this.fx.bench && this.inputZ()) rows.push(['輸入電阻', `${this.fn === 'DCV' ? '10 MΩ' : '1 MΩ'}（接在電路上會分走一點電流，R 很大時讀值偏低）`]);
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
    };
  }
}
