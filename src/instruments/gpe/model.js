// GPE-4323 行為模型（I04）。規格：docs/data/gpe.json（GPE-F01～F12、GAP-GPE-01～15）、common §0.2／§0.4。
// 狀態分三層（GPE-F04）：旋鈕設定（V-set／I-set）→ 有效輸出（Output、模式、測試負載決定）→ LCD 顯示。
// 設定值存整數（電壓以 10 mV、電流以 1 mA 為單位），避免浮點累積誤差。
import { fmtFixed } from '../../core/format.js';
import layout from './layout.js';
import { renderLcd } from './lcd.js';

export const K = {
  V1: 'GPE.KNOB.CH1_VOLTAGE', I1: 'GPE.KNOB.CH1_CURRENT', V4: 'GPE.KNOB.CH4_VOLTAGE',
  V2: 'GPE.KNOB.CH2_VOLTAGE', I2: 'GPE.KNOB.CH2_CURRENT', V3: 'GPE.KNOB.CH3_VOLTAGE',
  LEFT: 'GPE.KEY.TRACK_LEFT', RIGHT: 'GPE.KEY.TRACK_RIGHT', CH14: 'GPE.KEY.CH1_CH4', CH23: 'GPE.KEY.CH2_CH3',
  SET: 'GPE.KEY.SET_VIEW', OUT: 'GPE.KEY.OUTPUT_ON_OFF', POWER: 'GPE.PWR.POWER', LED: 'GPE.LED.OUTPUT_KEY',
};

// 旋鈕：所屬通道、量（v＝10 mV、i＝1 mA 單位）、上限（GAP-GPE-03：0–額定值，轉到端點就停）
const KNOBS = {
  [K.V1]: { ch: 1, q: 'v', max: 3200 }, [K.I1]: { ch: 1, q: 'i', max: 3000 },
  [K.V2]: { ch: 2, q: 'v', max: 3200 }, [K.I2]: { ch: 2, q: 'i', max: 3000 },
  [K.V3]: { ch: 3, q: 'v', max: 500 }, [K.V4]: { ch: 4, q: 'v', max: 1500 },
};
export const BOOT_MS = 1000;     // 開機全段顯示（GAP-GPE-10）
export const SET_VIEW_MS = 3000; // Set View 無操作自動返回（GAP-GPE-02）
const CIRCLED = { 1: '①', 2: '②', 3: '③', 4: '④' };

// 單機測試情境（common §0.4 的 L1、L1-CH3/4）：各路輸出端接的理想電阻（Ω），沒列的＝開路
export const LOADS = { open: {}, 'ch1-100': { 1: 100 }, 'ch1-10': { 1: 10 }, 'ch2-100': { 2: 100 }, 'ch2-10': { 2: 10 }, ch34: { 3: 100, 4: 1000 }, bench: {} };
const SCENARIOS = [
  { id: 'open', label: '開路（四路都沒接負載）', desc: 'Output ON 時讀回電流 0.000 A、CV（不是 I-set）。' },
  { id: 'ch1-100', label: 'L1：CH1 接 100 Ω', desc: '設 5.00 V／0.100 A → CV 5.00 V／0.050 A。' },
  { id: 'ch1-10', label: 'L1：CH1 接 10 Ω', desc: '設 5.00 V／0.100 A → CC 1.00 V／0.100 A。' },
  { id: 'ch2-100', label: 'L1：CH2 接 100 Ω', desc: '同 L1，負載改掛 CH2。' },
  { id: 'ch2-10', label: 'L1：CH2 接 10 Ω', desc: '同 L1，負載改掛 CH2。' },
  { id: 'ch34', label: 'L1-CH3/4：CH3 接 100 Ω、CH4 接 1 kΩ', desc: 'CH3 5.00 V → 0.050 A；CH4 ≤15 V → ≤0.015 A；都在額定內，只展示 CV。' },
  { id: 'bench', label: '實驗台接線', desc: '輸出端接在「實驗台」麵包板的電路上：讀回是電路實際的電壓、電流與 CV／CC（目前只支援 Independent；CH3／CH4 以額定 1 A 當限流，近似）。' },
];

// 理想電源一路（GPE-F09、p.22）：vs 電壓設定、is 限流（null＝沒有可調限流）、r 負載（Infinity＝開路）
export function solve(vs, is, r = Infinity) {
  if (!(r < Infinity)) return { v: vs, i: 0, cc: false };
  if (is != null && vs >= is * r) return { v: is * r, i: is, cc: true };
  return { v: vs, i: vs / r, cc: false };
}

// 往 dir 走一步並對齊步進格（例 4.37 V 快轉一格 → 5.00 V），夾在 0–max
function stepValue(x, dir, s, max) {
  const y = dir > 0 ? Math.floor(x / s) * s + s : Math.ceil(x / s) * s - s;
  return Math.min(max, Math.max(0, y));
}
const fmtV = (x) => `${fmtFixed(x / 100, 2)} V`;
const fmtA = (x) => `${fmtFixed(x / 1000, 3)} A`;

export class GpeModel {
  constructor() {
    this.id = 'gpe';
    this.title = 'GPE-4323';
    this.subtitle = '四路直流電源供應器';
    this.layout = layout;
    this.practice = [
      '設定：轉 Voltage／Current 旋鈕；CH1、CH2 有限流旋鈕，CH3、CH4 只有電壓。慢轉一格 10 mV／1 mA，快轉自動放大成 0.1 V、1 V 並對齊整數（步進是模擬器設定）。',
      'Output OFF 時 LCD 顯示設定值；按 On/Off 一次開關四路，LCD 改顯示讀回值與 CV／CC。',
      '在「單機測試情境」選負載：L1 設 5.00 V／0.100 A，100 Ω → CV 0.050 A；10 Ω → CC 1.00 V；開路 → 讀回 0.000 A。',
      'CH1/CH4、CH2/CH3 只切換 LCD 那一列看哪一路，旋鈕歸屬不變。',
      'Set View：Output ON 時短按看設定值（亮 Set；再按一次或 3 秒沒操作就回讀回）；長按＝Lock。',
      '模式鍵（按下會停住）：兩鍵彈起＝Independent、只按右鍵＝Series、兩鍵都按＝Parallel；換模式時 Output 自動全關，要重新按 On/Off 才恢復。',
      '近似清單（手冊沒寫或說法不一，待校機確認）：Set View 返回方式（再按或 3 秒）；Lock 只鎖 CH1／CH2 Voltage；Lock 要按住 2 秒以上（p.27）；開機重設值不是校機開機記憶（模式鍵是按下／彈起的機械鍵，關開機不變）；旋鈕步進；CH3／CH4 沒有限流設定，看設定時電流欄顯示「---」；換模式後 LCD 回到 ①②；tracking 時 CH2 列與限流是示意模型。',
    ];
    this.now = () => Date.now();
    this.load = 'open'; // 測試情境在儀器外：重設、開關機都不改
    this.scenarios = {
      title: '單機測試情境（輸出端接理想電阻；四台彼此沒有連接）',
      list: SCENARIOS,
      get: () => this.load,
      set: (id) => this.setLoad(id),
    };
    this.reset();
  }

  // 模擬器「電源開」／重設（GPE-F11、GAP-GPE-05）：四路 0.00 V、限流 0.100 A、Independent、①②、Output OFF、Lock 解除
  reset() {
    this.on = true;
    this.bootAt = -Infinity;
    this.vset = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.iset = { 1: 100, 2: 100 };
    this.keyL = false; this.keyR = false;
    this.rows = [1, 2];
    this.output = false;
    this.lock = false;
    this.viewAt = null; // Set View 最後一次操作的時間；null＝沒在看設定
    this.last = null;   // 上一格旋鈕 {id, dir, t}，判斷快轉
    this.startupOutput = false;
    this.digits = 4;
    this.setup = null;
  }

  isOn() { return this.on; }
  // 模式鍵組合（GPE-F06、GAP-GPE-07）：右鍵彈起＝Independent（不論左鍵）
  get mode() { return !this.keyR ? 'INDEP' : this.keyL ? 'PARA' : 'SER'; }
  bootLeft() { return Math.max(0, BOOT_MS - (this.now() - this.bootAt)); }
  setViewLeft() { return this.viewAt == null || !this.output ? 0 : Math.max(0, SET_VIEW_MS - (this.now() - this.viewAt)); }

  // 每次操作：Set View 已逾時就結束，否則重新計時（3 s 無操作才返回）
  touch() { if (this.viewAt != null) this.viewAt = this.setViewLeft() > 0 ? this.now() : null; }

  // ---- 按鍵 ----
  press(id, { long = false, ms, held } = {}) {
    if (ms != null) long = ms >= 2000; // 手冊 p.27：LOCK 要按住超過 2 秒（GAP-GPE-01 定案 ≥2.0 s）
    if (id === K.POWER) return this.power({ held });
    if (!this.on) return { kind: 'info', text: '電源關閉中，先按 POWER。' };
    if (this.setup) {
      if (id === K.SET) {
        this.setup.value = this.setup.kind === 'output' ? !this.setup.value : this.setup.value === 4 ? 3 : 4;
        return { kind: 'info', text: `開機設定：${this.setup.kind === 'output' ? `Output ${this.setup.value ? 'ON' : 'OFF'}` : `${this.setup.value} 位顯示`}；按 On/Off 確認。` };
      }
      if (id === K.OUT) {
        const { kind, value } = this.setup;
        if (kind === 'output') this.startupOutput = value; else this.digits = value;
        this.setup = null; this.output = false;
        return { kind: 'info', text: `已保存${kind === 'output' ? `下次開機 Output ${value ? 'ON' : 'OFF'}` : `${value} 位顯示`}（手冊 p.27–29）。本次輸出保持 OFF。` };
      }
      return { kind: 'info', text: '開機設定中：Set View 選擇、On/Off 確認；POWER 取消。' };
    }
    this.touch();
    switch (id) {
      case K.OUT: return this.toggleOutput();
      case K.SET: return long ? this.toggleLock() : this.toggleSetView();
      case K.LEFT: return this.modeKey('keyL');
      case K.RIGHT: return this.modeKey('keyR');
      case K.CH14: this.rows[0] = this.rows[0] === 1 ? 4 : 1; return null;
      case K.CH23: this.rows[1] = this.rows[1] === 2 ? 3 : 2; return null;
      default: return null;
    }
  }

  // 模式鍵是按下／彈起的機械鍵（p.25「the right key is not pressed」、GAP-GPE-07），關開機不會改變它們的位置
  power({ held } = {}) {
    if (this.on) { this.on = false; this.setup = null; return { kind: 'approx', text: '模擬電源關：LCD 全暗、四路都沒有輸出。' }; }
    const { keyL, keyR, startupOutput, digits } = this;
    this.reset();
    Object.assign(this, { keyL, keyR, startupOutput, digits, output: startupOutput });
    if (held === K.OUT || held === 'output') return this.beginSetup('output');
    if (held === K.SET || held === 'digits') return this.beginSetup('digits');
    this.bootAt = this.now();
    const mode = { INDEP: 'Independent', SER: 'Series', PARA: 'Parallel' }[this.mode];
    return { kind: 'approx', text: `模擬電源開：LCD 全段亮 1 秒；四路 0.00 V、CH1／CH2 限流 0.100 A、Output ${this.output ? 'ON' : 'OFF'}（已保存的開機輸出設定）、${digits} 位顯示、Lock 解除。V／I 值是模擬器定義，不是校機開機記憶。模式鍵位置不變：${mode}。` };
  }

  // Outside-panel entry reproduces the manual's hold-a-key-at-power-up chord.
  // Configuration never energizes a circuit; Output selects/commits the value.
  beginSetup(kind) {
    if (!['output', 'digits'].includes(kind)) return { kind: 'reject', text: '沒有此開機設定。' };
    this.on = true; this.output = false; this.viewAt = null; this.bootAt = -Infinity;
    this.setup = { kind, value: kind === 'output' ? this.startupOutput : this.digits };
    return { kind: 'info', text: `${kind === 'output' ? '按住 Output 開機' : '按住 Set View 開機'}：已進入${kind === 'output' ? '開機輸出' : '3／4 位顯示'}設定；Set View 選擇、On/Off 保存；POWER 可取消。` };
  }

  // GPE-F05：一鍵開關四路；Lock 不影響
  toggleOutput() {
    this.output = !this.output;
    this.viewAt = null;
    return this.output
      ? { kind: 'info', text: 'Output ON：四路同時輸出（p.25）；LCD 改顯示讀回值，各列亮 CV 或 CC。' }
      : { kind: 'info', text: 'Output OFF：四路都關、設定值保留；LCD 改顯示設定值（p.23，近似）。' };
  }

  // GAP-GPE-02：Output ON 才有作用；再按一次或 3 s 無操作返回
  toggleSetView() {
    if (!this.output) return { kind: 'approx', text: 'Output OFF 時 LCD 本來就顯示設定值，Set View 沒有額外變化（近似 GAP-GPE-02）。' };
    if (this.viewAt != null) { this.viewAt = null; return { kind: 'info', text: 'Set View 結束，回到讀回值。' }; }
    this.viewAt = this.now();
    return { kind: 'approx', text: 'Set View：兩列暫時顯示設定值並亮 Set；再按一次或 3 秒沒操作就回到讀回（返回方式手冊沒寫，近似）。' };
  }

  // GAP-GPE-01：只鎖 CH1／CH2 Voltage；解鎖時 Output 自動 OFF
  toggleLock() {
    if (!this.lock) {
      this.lock = true;
      return { kind: 'approx', text: 'Lock：Lock 圖示亮，CH1、CH2 Voltage 旋鈕鎖住；On/Off 不受影響。鎖定範圍暫依 p.27（p.19／p.43 說鎖面板按鍵，待校機確認）；按住 2 秒以上才算長按（p.27）。' };
    }
    const was = this.output;
    this.lock = false; this.output = false; this.viewAt = null;
    return { kind: 'approx', text: `解除 Lock：Lock 圖示熄${was ? '，Output 自動 OFF（p.27）' : '，Output 維持 OFF'}。` };
  }

  // GPE-F06：模式鍵各自按下／彈起；模式真的改變時 Output 自動 OFF、兩列回到 ①②（GAP-GPE-15）
  modeKey(key) {
    const before = this.mode;
    this[key] = !this[key];
    const after = this.mode;
    if (after === before) {
      return { kind: 'approx', text: `左鍵${this.keyL ? '按下' : '彈起'}、右鍵彈起：仍是 Independent（右鍵彈起就是 Independent；只按左鍵的組合手冊沒有圖示，近似 GAP-GPE-07）。` };
    }
    const wasOn = this.output;
    this.output = false; this.viewAt = null;
    this.rows = [1, 2];
    const what = { INDEP: 'Independent（SER、PARA 都熄）', SER: 'Series（SER 亮；CH1 Voltage 同時設定兩路）', PARA: 'Parallel（PARA 亮；CH1 設定合併輸出，CH2 旋鈕停用）' }[after];
    return { kind: 'info', text: `換成 ${what}。${wasOn ? 'Output 原本 ON → 自動 OFF（p.25），四路都關、設定保留，要重新按 On/Off。' : ''}LCD 回到 ①②（近似 GAP-GPE-15）。` };
  }

  // ---- 旋鈕 ----
  // 步進（GAP-GPE-03 暫定，模擬器設定）：慢轉一格＝10 mV／1 mA；同方向連續快轉放大 ×10、×100。
  // 拖曳事件跟著畫面更新（60 Hz 時一格間隔約 17／33 ms），門檻留足餘裕才不會時快時慢。
  stepSize(id, dir) {
    const t = this.now();
    const dt = this.last && this.last.id === id && this.last.dir === dir ? t - this.last.t : Infinity;
    this.last = { id, dir, t };
    return dt <= 60 ? 100 : dt <= 150 ? 10 : 1;
  }

  turn(id, dir) {
    const k = KNOBS[id];
    if (!this.on || !k) return null;
    if (this.setup) return { kind: 'info', text: '請先用 On/Off 確認開機設定，再調旋鈕。' };
    this.touch();
    const s = this.stepSize(id, dir);
    const name = `CH${k.ch} ${k.q === 'v' ? 'Voltage' : 'Current'}`;
    if (this.lock && k.q === 'v' && k.ch <= 2) {
      return { kind: 'approx', text: `Lock 中：${name} 不動作（暫定只鎖 CH1／CH2 電壓旋鈕，p.27）。長按 Set View 解鎖。` };
    }
    const store = k.q === 'v' ? this.vset : this.iset;
    const fmt = k.q === 'v' ? fmtV : fmtA;
    const old = store[k.ch];
    store[k.ch] = stepValue(old, dir, s, k.max);
    if (store[k.ch] === old) return { kind: 'info', text: `${name} 已到${dir > 0 ? '上限' : '下限'} ${fmt(old)}（旋鈕端點）。` };
    const mode = this.mode;
    if (k.ch === 2 && (mode === 'PARA' || (mode === 'SER' && k.q === 'v'))) {
      const why = mode === 'SER' ? 'Series 時兩路電壓都由 CH1 Voltage 設定（p.40；CH2 Voltage 無效為暫定）' : 'Parallel 時 CH2 控制停用（p.42）';
      return { kind: 'approx', text: `${why}：${name} 不影響輸出。旋鈕位置會記住（${fmt(store[k.ch])}），回 Independent 才生效（近似 GAP-GPE-08）。` };
    }
    const r = k.ch === 1 || k.ch === 4 ? 0 : 1;
    if (this.rows[r] !== k.ch) {
      return { kind: 'approx', text: `LCD 第${r ? '二' : '一'}列正在看 ${CIRCLED[this.rows[r]]}，這次改的是 CH${k.ch}（${fmt(store[k.ch])}）；按 ${r ? 'CH2/CH3' : 'CH1/CH4'} 切到 ${CIRCLED[k.ch]} 才看得到（不自動跳轉，近似 GAP-GPE-04）。` };
    }
    return null;
  }

  // ---- 測試情境 ----
  setLoad(id) {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s) return { kind: 'reject', text: `沒有「${id}」這個測試情境。` };
    this.load = id;
    return { kind: 'info', text: `單機測試情境：${s.label}（理想電阻，只接在這台）。${this.output ? '' : '按 On/Off 開輸出才有讀回。'}` };
  }

  // ---- 計算 ----
  // 各路的有效設定（V、A）：tracking 時 CH2 跟 CH1（GPE-F07／F08、GAP-GPE-08／11）
  eff(ch) {
    const V = (c) => this.vset[c] / 100, I = (c) => this.iset[c] / 1000;
    const m = this.mode;
    if (ch === 2 && m === 'SER') return { vs: V(1), is: I(2) };
    if (ch === 2 && m === 'PARA') return { vs: V(1), is: I(1) };
    return { vs: V(ch), is: ch <= 2 ? I(ch) : null };
  }

  // 實驗台：外殼注入讀回來源（回傳 {1..4: {v, i, cc}}｜null）
  setBenchSource(fn) { this.benchSource = fn; }

  // Output ON 時四路讀回（理想模型）；OFF 或關機回傳 null
  readback() {
    if (!this.on || !this.output) return null;
    if (this.load === 'bench') { // 實驗台：電路算出的端電壓與電流；沒接成迴路的通道＝開路
      const b = this.benchSource?.();
      return Object.fromEntries([1, 2, 3, 4].map((c) => [c, b?.[c] ?? { v: this.eff(c).vs, i: 0, cc: false }]));
    }
    const R = LOADS[this.load];
    const r = (c) => R[c] ?? Infinity;
    const out = {};
    if (this.mode === 'PARA') {
      // 兩路內部並接（p.11、p.41）：合併限流 2×I1set；兩列各顯示一半電流，CH2 恆亮 CC（p.42）
      const o = solve(this.vset[1] / 100, (2 * this.iset[1]) / 1000, 1 / (1 / r(1) + 1 / r(2)));
      out[1] = { v: o.v, i: o.i / 2, cc: o.cc };
      out[2] = { v: o.v, i: o.i / 2, cc: true };
    } else {
      // Independent；Series 依共地接法（p.39–40）：CH1＝master、CH2＝slave，電壓都跟 CH1，限流各自
      for (const c of [1, 2]) { const e = this.eff(c); out[c] = solve(e.vs, e.is, r(c)); }
    }
    for (const c of [3, 4]) out[c] = solve(this.vset[c] / 100, null, r(c));
    return out;
  }

  // LCD 一列（GPE-F04）：Output OFF 或 Set View → 設定值；ON → 讀回＋CV／CC。show：'auto'｜'set'｜'read'
  rowView(ch, show = 'auto') {
    const digits = this.setup?.kind === 'digits' ? this.setup.value : this.digits;
    const fmtVolt = (v) => fmtFixed(v, digits === 3 ? 1 : 2);
    const fmtCurrent = (i) => fmtFixed(i, digits === 3 ? 2 : 3);
    const rb = this.readback();
    if (!rb || show === 'set' || (show === 'auto' && this.setViewLeft() > 0)) {
      const e = this.eff(ch);
      return { ch, v: fmtVolt(e.vs), a: e.is == null ? '---' : fmtCurrent(e.is), mode: null, set: !!rb };
    }
    const o = rb[ch];
    return { ch, v: fmtVolt(o.v), a: fmtCurrent(o.i), mode: o.rb ? 'RB' : o.cc ? 'CC' : 'CV', set: false };
  }

  lcdState(show = 'auto') {
    return { rows: this.rows.map((ch) => this.rowView(ch, show)), ser: this.mode === 'SER', para: this.mode === 'PARA', lock: this.lock,
      out: this.setup?.kind === 'output' ? this.setup.value : this.output, setup: this.setup };
  }

  // ---- 輸出 ----
  lcd() { return renderLcd(this); }

  visual(id) {
    if (id === K.OUT || id === K.LED) return { lit: this.on && this.output };
    if (id === K.LEFT) return { active: this.keyL };
    if (id === K.RIGHT) return { active: this.keyR };
    return {};
  }

  status() {
    if (!this.on) return [['電源', '關（按 POWER 開機）']];
    const m = this.mode;
    const rows = [
      ['模式', { INDEP: 'Independent', SER: 'Series（CH1 master、CH2 slave）', PARA: 'Parallel（CH1 控制合併輸出）' }[m]],
      ['Output', this.output ? 'ON（四路輸出中）' : 'OFF（LCD 顯示設定值）'],
      ['LCD', `第一列 ${CIRCLED[this.rows[0]]}、第二列 ${CIRCLED[this.rows[1]]}${this.setViewLeft() > 0 ? '；Set View 中' : ''}`],
      ['Lock', this.lock ? '上鎖（CH1／CH2 Voltage 不動作，近似）' : '未鎖'],
      ['開機設定', `Output ${this.startupOutput ? 'ON' : 'OFF'}、${this.digits} 位顯示${this.setup ? '；設定中：Set View 選擇、On/Off 保存' : ''}`],
      ['CH1 設定', `${fmtV(this.vset[1])}／限流 ${fmtA(this.iset[1])}`],
      ['CH2 設定', `${fmtV(this.vset[2])}／限流 ${fmtA(this.iset[2])}${m === 'SER' ? '（電壓跟 CH1）' : m === 'PARA' ? '（停用，跟 CH1）' : ''}`],
      ['CH3 設定', `${fmtV(this.vset[3])}（沒有限流旋鈕）`],
      ['CH4 設定', `${fmtV(this.vset[4])}（沒有限流旋鈕）`],
      ['負載', SCENARIOS.find((s) => s.id === this.load).label],
    ];
    const rb = this.readback();
    if (rb) for (const c of [1, 2, 3, 4]) rows.push([`CH${c} 讀回`, `${fmtFixed(rb[c].v, 2)} V／${fmtFixed(rb[c].i, 3)} A（${rb[c].rb ? '逆灌，失去穩壓' : rb[c].cc ? 'CC' : 'CV'}）`]);
    return rows;
  }

  snapshot() {
    const per = (o, d) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / d]));
    return {
      on: this.on, booting: this.on && this.bootLeft() > 0, mode: this.mode,
      keys: { left: this.keyL, right: this.keyR }, output: this.output, lock: this.lock,
      setView: this.setViewLeft() > 0, rows: [...this.rows], load: this.load,
      vset: per(this.vset, 100), iset: per(this.iset, 1000),
      display: this.on ? this.lcdState().rows : null, readback: this.readback(),
      startupOutput: this.startupOutput, digits: this.digits, setup: this.setup ? { ...this.setup } : null,
    };
  }
}
