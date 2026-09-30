// TDS2001C 行為模型（I03）。規格：docs/data/tds.json（TDS-F01～F21、GAP-TDS-01～24）、common.json §0.2／§0.4。
// 核心：每次採集產生一份紀錄（2500 點＝10 div，GAP-TDS-24）；波形、Measure、Cursor 都只從這份紀錄算。
// 訊號路徑：情境訊號（探棒尖端）÷ 實際探棒 → BNC → 通道耦合 → 紀錄（存 BNC 伏特）。
//   顯示值＝紀錄 × 示波器 Probe 設定：設定與實際探棒不一致時，讀值按比例錯（TDS-F08）。
// 時間模型：事件驅動。每次操作（按鍵、旋鈕、換情境）後做一次掃描更新 tick()：
//   有效觸發 → 以觸發點為 t＝0 採一筆；Auto 無觸發 → 以固定種子隨機相位採幾幀（LCD 輪播成不穩定畫面，GAP-TDS-06）；
//   Normal／Single 等待中 → 保留舊紀錄；Stop → 不採（凍結）。
import { eng, fmtFixed, clamp } from '../../core/format.js';
import layout from './layout.js';
import { renderLcd } from './lcd.js';

export const VDIV = [2e-3, 5e-3, 10e-3, 20e-3, 50e-3, 0.1, 0.2, 0.5, 1, 2, 5]; // 1X 探棒的 V/div（1-2-5）
export const SDIV = [5e-9, 10e-9, 25e-9, 50e-9, 100e-9, 250e-9, 500e-9, 1e-6, 2.5e-6, 5e-6, 10e-6, 25e-6, 50e-6, 100e-6,
  250e-6, 500e-6, 1e-3, 2.5e-3, 5e-3, 10e-3, 25e-3, 50e-3, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50]; // 1-2.5-5
export const PROBES = [1, 10, 20, 50, 100, 500, 1000];
export const MEAS_TYPES = ['FREQ', 'PERIOD', 'MEAN', 'PKPK', 'CYCRMS', 'NONE']; // 手冊 p.89 表的順序，只留本輪納入的
export const MEAS_NAME = { FREQ: 'Freq', PERIOD: 'Period', MEAN: 'Mean', PKPK: 'Pk-Pk', CYCRMS: 'Cyc RMS', NONE: 'None' };
export const N = 2500;
const PTS_DIV = 250;
const CPL = { DC: 'DC', AC: 'AC', GND: 'Ground' };

// 讀值格式（手冊圖例：1.00V、500mV、M 250µs、M Pos: -130.0µs、1.000kHz、1.00000kHz）
// 先取 d 位有效數字再交給 eng，避免 999.9999… 顯示成 1.0000k（多一位）
export const engp = (x, d) => eng(Number(x.toPrecision(d)), d);
export const fmtV = (v) => (Math.abs(v) < 1e-12 ? '0.00V' : `${engp(v, 3)}V`);
export const fmtS = (t) => (Math.abs(t) < 1e-15 ? '0.000s' : `${engp(t, 4)}s`);
export const fmtScale = (s) => `${engp(s, 3)}s`;

// ---- 單機測試情境（common §0.4；訊號值都在探棒尖端）----
const sine = (vpp, dc = 0, f = 1000, delay = 0) => ({ vpp, dc, f, delay });
export const SCENARIOS = [
  { id: 'S1', label: 'S1 正弦＋DC', desc: 'CH1：1 kHz 正弦，探棒尖端 2 Vpp＋0.5 V DC；實際探棒 10×', sig: [sine(2, 0.5), null], probe: [10, 10] },
  { id: 'S1F', label: 'S1 改成 2 kHz', desc: '同 S1，頻率改 2 kHz（Stop 後換訊號用）', sig: [sine(2, 0.5, 2000), null], probe: [10, 10] },
  { id: 'S1X5', label: 'S1 幅度 ×5', desc: '同 S1，幅度改 10 Vpp（AutoSet 只調一次）', sig: [sine(10, 0.5), null], probe: [10, 10] },
  { id: 'S2', label: 'S2 雙通道（實際探棒 10×）', desc: 'CH1、CH2 各 1 kHz 2 Vpp，CH2 落後 125 µs（45°）', sig: [sine(2), sine(2, 0, 1000, 125e-6)], probe: [10, 10] },
  { id: 'S2P1', label: 'S2 雙通道（實際探棒 1×）', desc: '同 S2，但實際探棒 1×（Probe 設 10X 會錯讀）', sig: [sine(2), sine(2, 0, 1000, 125e-6)], probe: [1, 1] },
  { id: 'S3A', label: 'S3a 無輸入', desc: 'CH1、CH2 都沒有訊號', sig: [null, null], probe: [10, 10] },
  { id: 'S3B', label: 'S3b 固定 +1.00 V DC', desc: 'CH1：+1.00 V 直流（沒有邊緣可觸發）', sig: [sine(0, 1, 0), null], probe: [10, 10] },
  { id: 'S3C', label: 'S3c S1＋Level 出範圍', desc: 'S1 訊號；把 Level 轉出 −0.5～+1.5 V，比較 Normal／Auto', sig: [sine(2, 0.5), null], probe: [10, 10] },
  { id: 'BENCH', label: '實驗台接線', desc: '訊號來自「實驗台」分頁：AFG → RC 電路，探棒接在哪裡就量哪裡（實際探棒倍率看探棒上的 1×／10× 開關）', bench: true },
];
const SCEN = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

const OUT = (name) => ({ kind: 'out', text: `「${name}」本輪未納入練習範圍，按了不會改變儀器狀態。` });
const KNOB_TEXT = { probe: 'Probe ► Attenuation（LED 亮）', trigsrc: 'Trigger ► Source（LED 亮）', meastype: 'Measure ► Type（LED 亮）', cursor: '移動選取的游標（LED 亮）' };

// 最接近「顯示 V/div＝target」的 1X 檔位（Default Setup 的 Scale 1.00 V 是顯示值）
function vIdxFor(target, probe) {
  let best = 0;
  VDIV.forEach((v, i) => { if (Math.abs(Math.log((v * probe) / target)) < Math.abs(Math.log((VDIV[best] * probe) / target))) best = i; });
  return best;
}

// 第一個完整週期（GAP-TDS-15：參考位準＝(max+min)/2，加 5% 遲滯，優先取前兩次上升交越；k＝內插後的點位）。
// 上升交越若落在紀錄邊界，改取紀錄內兩次下降交越，仍只使用實際採到的完整週期。
function firstCycle(x) {
  let mx = -Infinity, mn = Infinity;
  for (const y of x) { if (y > mx) mx = y; if (y < mn) mn = y; }
  const pp = mx - mn;
  if (!(pp > 0)) return null;
  const ref = (mx + mn) / 2, h = pp * 0.05;
  const crossings = (slope) => {
    const cr = [];
    let armed = false;
    for (let j = 1; j < x.length && cr.length < 2; j++) {
      const y0 = (x[j - 1] - ref) * slope, y1 = (x[j] - ref) * slope;
      if (y0 < -h) armed = true;
      if (armed && y0 < 0 && y1 >= 0) { cr.push({ j, k: j - 1 - y0 / (y1 - y0) }); armed = false; }
    }
    return cr.length === 2 ? cr : null;
  };
  return crossings(1) ?? crossings(-1);
}

// ---- 訊號路徑物件（正弦解析式／週期波形表）----
function sinePath(a, m, f, d) {
  return {
    a, m, f, d, mean: m,
    at: (t) => m + a * Math.sin(2 * Math.PI * f * (t - d)),
    cross: (L, slope) => { const s = Math.asin((L - m) / a); return d + (slope === 'R' ? s : Math.PI - s) / (2 * Math.PI * f); },
  };
}
// table：一個週期的探棒尖端電壓（等間隔 M 點）；k＝1／實際探棒倍率
function tablePath(table, period, k) {
  const M = table.length, v = Float64Array.from(table, (x) => x * k);
  let mx = -Infinity, mn = Infinity, sum = 0;
  for (const x of v) { if (x > mx) mx = x; if (x < mn) mn = x; sum += x; }
  const a = (mx - mn) / 2 > 1e-12 ? (mx - mn) / 2 : 0;
  const at = (t) => {
    const u = ((((t / period) % 1) + 1) % 1) * M, j = Math.floor(u) % M, fr = u - Math.floor(u);
    return v[j] + (v[(j + 1) % M] - v[j]) * fr;
  };
  const cross = (L, slope) => { // 一個週期內第一個符合斜率的穿越點
    for (let j = 0; j < M; j++) {
      const y0 = v[j], y1 = v[(j + 1) % M];
      const hit = slope === 'R' ? y0 < L && y1 >= L : y0 > L && y1 <= L;
      if (hit) return ((j + (L - y0) / (y1 - y0)) / M) * period;
    }
    return 0;
  };
  return { a, m: (mx + mn) / 2, f: a > 0 && period > 0 ? 1 / period : 0, d: 0, mean: sum / M, at, cross };
}
function shiftPath(p, dv) {
  return { ...p, m: p.m + dv, mean: p.mean + dv, at: (t) => p.at(t) + dv, cross: (L, slope) => p.cross(L - dv, slope) };
}

export class TdsModel {
  constructor() {
    this.id = 'tds';
    this.title = 'TDS2001C';
    this.subtitle = '數位儲存示波器';
    this.layout = layout;
    this.practice = [
      '首次載入＝Default Setup 狀態（500 ms/div，會進入 Scan）：先按 Auto Set 取得穩定波形（手冊 p.4 的流程）。',
      '通道：按 1／2 開關通道並開垂直選單；右側 OPT1 Coupling（DC→AC→Ground）、OPT4 Probe → 用多功能旋鈕選倍率。',
      '刻度與位置：垂直、水平的大旋鈕改 V/div、s/div；位置旋鈕每格 1/25 div；Set to Zero 讓 M Pos 歸零。',
      '觸發：Trig Menu → Source／Slope／Mode（Auto、Normal）／Coupling；位準旋鈕、Set To 50%、Force Trig。',
      '採集：Run/Stop 停止後仍可縮放凍結的紀錄；單一（Single）取到一幀就停。',
      '量測：Measure → 按 OPT1–5 選一格 → Source／Type（也可轉多功能旋鈕）→ Back。',
      '游標：Cursor → Type（Time／Amplitude）→ Source → Cursor 1／Cursor 2，再轉多功能旋鈕（每格 1/25 div）。',
      '探棒錯配：側欄情境裡的「實際探棒」和示波器的 Probe 設定是兩回事，設錯時讀值按比例錯。',
      '近似／暫定：LCD 語言暫定英文；Trigger、Probe、Measure n、AutoSet、Horiz 選單的鍵位暫定；Auto 無觸發的不穩定畫面、Scan、AutoSet 選檔、游標步進都是教學近似。',
    ];
    this.scenarios = {
      title: '單機測試情境（明示訊號，不是自由接線）',
      list: SCENARIOS.map(({ id, label, desc }) => ({ id, label, desc })),
      get: () => this.scen,
      set: (id) => this.setScenario(id),
    };
    this.reset();
  }

  // 模擬器「重設」＝首次載入：Appendix E 的值、兩通道 Probe 10X、情境 S1（GAP-TDS-19，不是校機的開機值）
  // 例外：已改用實驗台接線時保留（接線是實體的，重設示波器不會拔掉探棒）
  reset() {
    const bench = this.scen === 'BENCH';
    this.on = true;
    this.seed = 20260930;
    this.acqN = 0;
    this.scen = bench ? 'BENCH' : 'S1';
    this.fx = bench ? this.benchFx() : SCEN.S1;
    this.ch = [0, 1].map(() => ({ on: false, coupling: 'DC', bw: false, vIdx: 5, pos: 0, probe: 10 }));
    this.applyDefaults();
    this.menu = null;
    this.msg = '';
    this.rec = null;
    this.frames = null;
    this.tick();
  }

  // Appendix E（p.127–128）；Probe 類型與倍率不重設（GAP-TDS-09）
  applyDefaults() {
    this.ch.forEach((c, i) => Object.assign(c, { on: i === 0, coupling: 'DC', bw: false, pos: 0, vIdx: vIdxFor(1, c.probe) }));
    this.sIdx = SDIV.indexOf(0.5);
    this.mpos = 0;
    this.trig = { src: 0, slope: 'R', mode: 'AUTO', coup: 'DC', level: 0 }; // level 存 BNC 伏特
    this.cursor = { type: 'OFF', src: 0, sel: null, t: [-100, 100], v: [80, -80] }; // 單位 1/25 div（±4 div、±3.2 div）
    this.meas = [0, 1, 2, 3, 4].map(() => ({ src: 0, type: 'NONE' }));
    this.run = 'run'; // 'run' | 'single'（等觸發）| 'stop'
    this.complete = false; // Single 完成（Acq. Complete）
    this.autoMeas = null;
    this.autoKind = null;
    this.undo = null;
  }

  isOn() { return this.on; }
  get sdiv() { return SDIV[this.sIdx]; }
  base(i) { return VDIV[this.ch[i].vIdx]; } // BNC 伏特／格
  vdiv(i) { return this.base(i) * this.ch[i].probe; } // 顯示的 V/div
  levelV() { return this.trig.level * this.ch[this.trig.src].probe; } // 顯示的觸發位準
  posLimit(i) { const b = this.base(i); return (b <= 0.2 + 1e-12 ? 1.8 : 45) / b; } // 以格數表示（GAP-TDS-11）
  isScan() { return this.run === 'run' && this.trig.mode === 'AUTO' && this.sdiv >= 0.1 - 1e-12; }
  rand() { // mulberry32：固定種子，測試可重現
    let t = (this.seed = (this.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---- 訊號路徑 ----
  // 通道 i 在 BNC、經通道耦合後的訊號（BNC 伏特）。兩種來源：
  //   正弦情境：v(τ) = m + a·sin(2πf(τ − d))（解析式）
  //   週期波形表（實驗台電路算出的探棒尖端電壓，一個週期 M 點）：線性內插
  // 共同欄位：a＝(max−min)/2、m＝(max+min)/2、f（0＝直流或無訊號）、mean、at(t)、cross(L, slope)
  path(i) {
    const s = this.fx.sig[i], c = this.ch[i];
    if (!s || c.coupling === 'GND') return sinePath(0, 0, 0, 0); // Ground＝零伏參考線
    const k = 1 / this.fx.probe[i];
    if (s.table) {
      const p = tablePath(s.table, s.period, k);
      return c.coupling === 'AC' ? shiftPath(p, -p.mean) : p; // AC：去掉直流（不模擬低頻傾斜，近似 GAP-TDS-12）
    }
    let a = (s.vpp / 2) * k, m = s.dc * k, d = s.delay;
    if (c.coupling === 'AC') { // 一階高通 fc＝10 Hz，實際 10× 探棒時 1 Hz，直接呈現穩態（GAP-TDS-12）
      const fc = this.fx.probe[i] === 10 ? 1 : 10;
      m = 0;
      if (s.f > 0) { a *= s.f / Math.hypot(s.f, fc); d -= Math.atan(fc / s.f) / (2 * Math.PI * s.f); } else a = 0;
    }
    return sinePath(a, m, s.f, d);
  }

  // 觸發路徑：取自通道耦合後的訊號（GAP-TDS-13）；觸發耦合 AC 再去掉直流（只影響觸發，TDS-F07）
  trigPath() {
    const p = this.path(this.trig.src);
    return this.trig.coup === 'AC' ? shiftPath(p, -p.mean) : p;
  }

  // Level 必須落在觸發訊號的最小值與最大值之間才有觸發事件（DC、無訊號永遠沒有）
  crosses() { const p = this.trigPath(), L = this.trig.level; return p.a > 0 && p.f > 0 && L > p.m - p.a && L < p.m + p.a; }

  // 觸發事件的絕對時間（依 Slope 與 Level）；沒有觸發 → null
  trigTime() {
    if (!this.crosses()) return null;
    return this.trigPath().cross(this.trig.level, this.trig.slope);
  }

  // 觸發頻率讀值：停止時也照樣追蹤目前觸發源（p.112）；沒有觸發事件時不顯示（GAP-TDS-16）
  trigFreq() { const p = this.trigPath(); return this.crosses() && p.f >= 10 ? p.f : null; }

  // ---- 採集 ----
  // tau＝觸發事件的絕對時間（紀錄的 t＝0 對到觸發點）；null＝未觸發（隨機相位）
  acquire(tau) {
    const triggered = tau != null;
    if (!triggered) tau = this.rand();
    const dt = this.sdiv / PTS_DIV, t0 = this.mpos - 5 * this.sdiv;
    const band = [false, false];
    const v = this.ch.map((c, i) => {
      if (!c.on) return null; // 只採顯示中的通道
      const p = this.path(i), arr = new Float64Array(N);
      band[i] = p.a > 0 && p.f * dt > 0.25; // 每週期不到 4 點：畫成包絡帶，不模擬混疊（取樣率與混疊本輪 OUT）
      for (let k = 0; k < N; k++) {
        arr[k] = band[i] ? p.m + (k % 2 ? -p.a : p.a) : p.at(tau + t0 + k * dt);
      }
      return arr;
    });
    return { n: ++this.acqN, t0, dt, v, band, triggered, broken: false };
  }

  tick(force = false) {
    if (!this.on || this.run === 'stop') return;
    this.frames = null;
    if (this.isScan()) { this.rec = this.acquire(null); return; } // Scan：不等觸發（簡化，GAP-TDS-08）
    const tt = this.trigTime();
    if (tt != null || force) {
      this.rec = this.acquire(tt);
      if (this.run === 'single') { this.run = 'stop'; this.complete = true; }
      return;
    }
    if (this.run === 'run' && this.trig.mode === 'AUTO') { // Auto 無觸發：自由執行
      this.frames = [0, 1, 2, 3].map(() => this.acquire(null));
      this.rec = this.frames[3];
    }
    // Normal 或 Single 等待中：保留舊採集（TDS-F10、GAP-TDS-07）
  }

  trigStatus() {
    if (this.run === 'stop') return this.complete ? 'Acq. Complete' : 'Stop';
    if (this.isScan()) return 'Scan';
    if (this.crosses()) return "Trig'd";
    return this.run === 'run' && this.trig.mode === 'AUTO' ? 'Auto' : 'Ready';
  }

  // 停止後改觸發設定或通道耦合：波形改斷線樣式、資料不重算（p.84、GAP-TDS-21）
  markBroken() { if (this.run === 'stop' && this.rec) this.rec.broken = true; }

  // ---- 從紀錄算量測（TDS-F16、F21）----
  // 回傳 { text, value, why }：text＝'' 留空（通道未顯示或尚無採集，GAP-TDS-14）；'?' 或結尾 '?'＝無效
  measure(i, type) {
    if (type === 'NONE') return { text: '', value: null };
    const c = this.ch[i], arr = this.rec?.v[i];
    if (!c.on) return { text: '', value: null, why: `CH${i + 1} 未顯示` };
    if (!arr) return { text: '', value: null, why: '尚無採集' };
    if (this.isScan()) return { text: '?', value: null, why: 'Scan 模式不能量測' };
    const vd = this.vdiv(i), lo = (-5 - c.pos) * vd, hi = (5 - c.pos) * vd; // 10 div 動態範圍外視為削頂
    const x = new Float64Array(arr.length);
    let over = false, mx = -Infinity, mn = Infinity, sum = 0;
    for (let j = 0; j < arr.length; j++) {
      const y = arr[j] * c.probe;
      if (Math.abs(c.pos + y / vd) > 4 + 1e-9) over = true; // 超出畫面（overrange）
      x[j] = clamp(y, lo, hi);
      if (x[j] > mx) mx = x[j];
      if (x[j] < mn) mn = x[j];
      sum += x[j];
    }
    let value = null, unit = 'V', digits = 3;
    if (type === 'PKPK') value = mx - mn;
    else if (type === 'MEAN') value = sum / x.length;
    else {
      const cr = this.rec.band[i] ? null : firstCycle(x);
      if (!cr) return { text: '?', value: null, why: '紀錄裡沒有完整週期' };
      const period = (cr[1].k - cr[0].k) * this.rec.dt;
      if (type === 'FREQ') { value = 1 / period; unit = 'Hz'; digits = 4; }
      if (type === 'PERIOD') { value = period; unit = 's'; digits = 4; }
      if (type === 'CYCRMS') {
        let s2 = 0;
        for (let j = cr[0].j; j < cr[1].j; j++) s2 += x[j] * x[j];
        value = Math.sqrt(s2 / (cr[1].j - cr[0].j));
      }
    }
    const txt = unit === 'V' ? fmtV(value) : `${engp(value, digits)}${unit}`;
    return { text: txt + (over ? '?' : ''), value, why: over ? '波形超出畫面' : '' };
  }

  // 紀錄在時間 t（相對觸發點）的顯示電壓；超出紀錄範圍回 null
  sampleAt(i, t) {
    const arr = this.rec?.v[i];
    if (!arr) return null;
    const k = (t - this.rec.t0) / this.rec.dt;
    if (k < 0 || k > N - 1) return null;
    const j = Math.min(N - 2, Math.floor(k));
    return (arr[j] + (arr[j + 1] - arr[j]) * (k - j)) * this.ch[i].probe;
  }

  // 游標讀值（TDS-F17）：時間以觸發點為基準、電壓以該通道接地為基準；來源未顯示或沒有波形時不出現
  cursorInfo() {
    const cu = this.cursor, i = cu.src;
    if (cu.type === 'OFF') return null;
    if (!this.ch[i].on || !this.rec?.v[i]) return { hidden: true };
    if (cu.type === 'TIME') {
      const t = cu.t.map((s) => this.mpos + (s / 25) * this.sdiv);
      const v = t.map((tt) => this.sampleAt(i, tt));
      return { type: 'TIME', t, v, dt: Math.abs(t[1] - t[0]), dv: v[0] != null && v[1] != null ? Math.abs(v[1] - v[0]) : null };
    }
    const v = cu.v.map((s) => (s / 25 - this.ch[i].pos) * this.vdiv(i));
    return { type: 'AMPL', v, dv: Math.abs(v[0] - v[1]) };
  }

  // 多功能旋鈕目前作用對象（TDS-F20）；null＝沒有作用、LED 熄滅
  knobTarget() {
    const m = this.menu || '';
    if (m.startsWith('PROBE')) return 'probe';
    if (m === 'TRIG') return 'trigsrc';
    if (/^MEAS\d$/.test(m)) return 'meastype';
    if (m === 'CURSOR' && this.cursor.type !== 'OFF' && this.cursor.sel != null) return 'cursor';
    return null;
  }

  // ---- 輸入：按鍵 ----
  press(id) {
    if (id === 'TDS.PWR.ON_OFF') return this.power();
    if (!this.on) return { kind: 'info', text: '電源關閉中：先按左上角 POWER（實機電源鍵在機殼頂部）。' };
    this.msg = '';
    const soft = id.match(/^TDS\.SOFT\.OPT(\d)$/);
    const h = soft ? this.soft(Number(soft[1]) - 1) : this.key(id);
    this.tick(id === 'TDS.KEY.FORCE_TRIG');
    return h;
  }

  power() {
    if (this.on) { this.on = false; return { kind: 'approx', text: '模擬電源關閉：畫面熄滅（實機電源鍵在機殼頂部，照片看不到）。' }; }
    this.on = true;
    if (this.scen === 'BENCH') this.fx = this.benchFx();
    this.rec = null; this.frames = null; this.msg = '';
    this.run = 'run'; this.complete = false;
    this.tick();
    return { kind: 'approx', text: '模擬電源開：依手冊 p.20 回復關機前的設定、清除舊採集後重新採集（5 秒保存等待不模擬）。' };
  }

  key(id) {
    switch (id) {
      case 'TDS.KEY.CH1_MENU': return this.chanKey(0);
      case 'TDS.KEY.CH2_MENU': return this.chanKey(1);
      case 'TDS.KEY.TRIG_MENU': this.menu = 'TRIG'; this.msg = 'For TRIGGER HOLDOFF, go to HORIZONTAL MENU'; return null;
      case 'TDS.KEY.MEASURE': this.menu = 'MEAS'; this.msg = 'Push an option button to change its measurement'; return null;
      case 'TDS.KEY.CURSOR': this.menu = 'CURSOR'; return null;
      case 'TDS.KEY.ACQUIRE': this.menu = 'ACQ'; return { kind: 'approx', text: 'Acquire 選單：本模擬器固定 Sample（Peak Detect、Average 未納入）。' };
      case 'TDS.KEY.HORIZ_MENU': this.menu = 'HORIZ'; return { kind: 'approx', text: 'Horiz 選單只啟用 Main（Window Zone、Window、Holdoff 未納入）。' };
      case 'TDS.KEY.AUTOSET': return this.autoset();
      case 'TDS.KEY.DEFAULT_SETUP': return this.defaultSetup();
      case 'TDS.KEY.RUN_STOP':
        if (this.run === 'stop') { this.run = 'run'; this.complete = false; return null; }
        this.run = 'stop'; this.complete = false; this.frames = null;
        return null;
      case 'TDS.KEY.SINGLE':
        this.run = 'single'; this.complete = false; this.frames = null;
        return this.crosses() ? null : { kind: 'approx', text: 'Single 等待有效觸發（Ready）；Auto 模式下也不會自己完成（暫定 GAP-TDS-07），可按 Force Trig 強制取一幀。' };
      case 'TDS.KEY.SET_TO_ZERO': this.mpos = 0; return null;
      case 'TDS.KEY.SET_TO_50': this.setTo50(); this.markBroken(); return null;
      case 'TDS.KEY.FORCE_TRIG':
        return this.run === 'stop' ? { kind: 'info', text: '已停止時 Force Trig 沒有作用（手冊 p.15）。' } : null;
      default: return null;
    }
  }

  // 1／2 鍵（GAP-TDS-05）：關閉→開啟並顯示選單；已開但選單不是它→切到它的選單；它的選單已顯示→關閉通道
  chanKey(i) {
    const c = this.ch[i], name = `CH${i + 1}`;
    if (!c.on) { c.on = true; this.menu = name; return null; }
    if (this.menu !== name) { this.menu = name; return null; }
    c.on = false;
    this.menu = null;
    return { kind: 'approx', text: `${name} 關閉：波形、接地標記與 V/div 讀值都移除（選單顯示時再按一次＝關閉，暫定 GAP-TDS-05）。` };
  }

  setTo50() { // 觸發位準＝觸發訊號 (max+min)/2，取 0.02 div 解析度（TDS-F11）
    const p = this.trigPath(), step = 0.02 * this.base(this.trig.src);
    this.trig.level = Math.round(p.m / step) * step;
  }

  // ---- 右側選單軟鍵 ----
  soft(j) {
    const m = this.menu;
    if (!m) return null;
    const i = Number(m.slice(-1)) - 1;
    if (m === 'CH1' || m === 'CH2') return this.chanSoft(i, j);
    if (m.startsWith('PROBE')) return this.probeSoft(i, j);
    if (m === 'TRIG') return this.trigSoft(j);
    if (m === 'MEAS') { this.menu = `MEAS${j + 1}`; return null; }
    if (m.startsWith('MEAS')) return this.measSoft(i, j);
    if (m === 'CURSOR') return this.cursorSoft(j);
    if (m === 'ACQ') return [{ kind: 'approx', text: '本模擬器只提供 Sample（固定選取）。' }, OUT('Peak Detect'), OUT('Average'), OUT('Averages'), null][j];
    if (m === 'HORIZ') return [null, OUT('Window Zone'), OUT('Window'), OUT('Set Holdoff'), null][j];
    if (m === 'AUTOSET') return this.autosetSoft(j);
    return null;
  }

  chanSoft(i, j) {
    const c = this.ch[i];
    if (j === 0) { c.coupling = { DC: 'AC', AC: 'GND', GND: 'DC' }[c.coupling]; this.markBroken(); return null; }
    if (j === 1) { c.bw = !c.bw; return { kind: 'approx', text: `BW Limit ${c.bw ? 'On（20MHz）' : 'Off'}：只切換狀態與 BW 圖示，1 kHz 測試訊號的波形不變（近似）。` }; }
    if (j === 2) return OUT('Volts/Div Fine');
    if (j === 3) { this.menu = `PROBE${i + 1}`; return null; }
    return OUT('Invert');
  }

  probeSoft(i, j) {
    if (j === 1) return OUT('Current（電流探棒）');
    if (j === 2) return this.setProbe(i, (PROBES.indexOf(this.ch[i].probe) + 1) % PROBES.length);
    if (j === 4) { this.menu = `CH${i + 1}`; return null; }
    return null; // OPT1 Voltage 已選取
  }

  setProbe(i, k) {
    const c = this.ch[i], actual = this.fx.probe[i];
    c.probe = PROBES[k];
    const note = c.probe === actual ? '與情境的實際探棒一致' : `情境的實際探棒是 ${actual}×，顯示的電壓會是真值的 ${c.probe / actual} 倍`;
    return { kind: 'info', text: `CH${i + 1} Probe 設定 ${c.probe}X：只改顯示刻度與讀值（${note}）。` };
  }

  trigSoft(j) {
    const t = this.trig;
    if (j === 0) return { kind: 'out', text: 'Video、Pulse 觸發本輪未納入，Type 維持 Edge（按了不會改變狀態）。' };
    if (j === 1) return this.setTrigSrc(1 - t.src);
    this.markBroken();
    if (j === 2) t.slope = t.slope === 'R' ? 'F' : 'R';
    if (j === 3) t.mode = t.mode === 'AUTO' ? 'NORMAL' : 'AUTO';
    if (j === 4) {
      t.coup = t.coup === 'DC' ? 'AC' : 'DC';
      return { kind: 'approx', text: `觸發耦合 ${t.coup}：只影響觸發路徑，不改通道耦合與波形（AC＝去掉直流，近似）；實機循環還有 Noise Reject、HF Reject、LF Reject，本輪略過（GAP-TDS-17）。` };
    }
    return null;
  }

  setTrigSrc(s) {
    this.trig.src = s;
    this.markBroken();
    return { kind: 'approx', text: `觸發源 CH${s + 1}（通道不必顯示）。實機循環還有 Ext、Ext/5、AC Line，本輪略過（GAP-TDS-17）。` };
  }

  measSoft(n, j) {
    const s = this.meas[n];
    if (j === 0) { s.src = 1 - s.src; return this.measHint(s); }
    if (j === 1) return this.stepMeasType(n, 1);
    if (j === 4) this.menu = 'MEAS';
    return null;
  }

  stepMeasType(n, dir) {
    const s = this.meas[n], L = MEAS_TYPES.length;
    s.type = MEAS_TYPES[(MEAS_TYPES.indexOf(s.type) + dir + L) % L];
    if (s.type === 'MEAN' || s.type === 'CYCRMS') {
      return { kind: 'approx', text: `${MEAS_NAME[s.type]} 由目前採集計算，演算法是模擬器定義（近似，TDS-F21）；實機另有 11 種量測本輪未列入。` };
    }
    return this.measHint(s);
  }

  measHint(s) {
    if (s.type === 'NONE' || this.ch[s.src].on) return null;
    return { kind: 'info', text: `CH${s.src + 1} 未顯示：這格量測留空（無效），不會顯示 0。先按 ${s.src + 1} 開啟通道。` };
  }

  cursorSoft(j) {
    const cu = this.cursor;
    if (j === 0) { cu.type = { OFF: 'TIME', TIME: 'AMPL', AMPL: 'OFF' }[cu.type]; return null; }
    if (j === 1) {
      cu.src = 1 - cu.src;
      return this.ch[cu.src].on ? null : { kind: 'info', text: `CH${cu.src + 1} 未顯示：游標與讀值不會出現（手冊 p.82、p.106）。` };
    }
    if ((j === 3 || j === 4) && cu.type !== 'OFF') cu.sel = j - 3;
    return null; // OPT3 是 Δ 讀值格，按了沒有作用（PD）
  }

  autosetSoft(j) {
    if (j === 3 && this.undo) {
      this.restore(this.undo);
      this.undo = null;
      return { kind: 'approx', text: 'Undo Autoset：回到按 AutoSet 之前的設定（近似）。' };
    }
    if (this.autoKind === 'SINE' && j === 1) return OUT('Single-cycle sine');
    if (this.autoKind === 'SINE' && j === 2) return OUT('FFT');
    return null;
  }

  // ---- AutoSet（TDS-F15、GAP-TDS-10）----
  save() {
    return JSON.parse(JSON.stringify({ ch: this.ch.map(({ probe, ...c }) => c), sIdx: this.sIdx, mpos: this.mpos, trig: this.trig, cursor: this.cursor, meas: this.meas, menu: this.menu }));
  }

  restore(s) {
    s.ch.forEach((c, i) => Object.assign(this.ch[i], c));
    Object.assign(this, { sIdx: s.sIdx, mpos: s.mpos, trig: s.trig, cursor: s.cursor, meas: s.meas, menu: s.menu });
    this.autoMeas = null;
  }

  autoset() {
    this.undo = this.save();
    this.ch.forEach((c) => { if (c.coupling === 'GND') c.coupling = 'DC'; c.bw = false; });
    const P = [0, 1].map((i) => this.path(i));
    const has = P.map((p) => p.a > 0 || Math.abs(p.m) > 1e-12); // 情境沒訊號或 0 V：視為沒有訊號
    // 顯示有訊號的通道；都沒有：保留原顯示中的通道，連一個都沒有就開 CH1（p.80）
    if (has.some(Boolean)) this.ch.forEach((c, i) => { c.on = has[i]; });
    else if (!this.ch.some((c) => c.on)) this.ch[0].on = true;
    const periodic = [0, 1].filter((i) => has[i] && P[i].f > 0);
    const src = periodic.length ? periodic.reduce((a, b) => (P[b].f < P[a].f ? b : a))
      : has.includes(true) ? has.indexOf(true) : this.ch.findIndex((c) => c.on);
    const notes = [];
    [0, 1].forEach((i) => {
      if (!has[i]) return;
      const c = this.ch[i], hi = P[i].m + P[i].a, lo = P[i].m - P[i].a;
      // 在目前位置下，讓整個波形落在 ±4 div 內的最小檔；都不行就先把位置歸零（後備規則）
      const fit = (pos) => VDIV.findIndex((b) => pos + hi / b <= 4 + 1e-9 && pos + lo / b >= -4 - 1e-9);
      let k = fit(c.pos);
      if (k < 0 && c.pos !== 0) { c.pos = 0; k = fit(0); notes.push(`CH${i + 1} 位置先歸零再選刻度（後備規則）`); }
      c.vIdx = k < 0 ? VDIV.length - 1 : k;
    });
    if (periodic.length) this.sIdx = SDIV.findIndex((s) => 10 * s * P[src].f >= 2 - 1e-9); // 至少 2 個完整週期的最快檔
    this.mpos = 0;
    this.trig = { src, slope: 'R', mode: 'AUTO', coup: 'DC', level: 0 };
    this.setTo50();
    this.cursor.type = 'OFF';
    this.run = 'run';
    this.complete = false;
    this.autoKind = periodic.includes(src) ? 'SINE' : 'UNKNOWN';
    this.autoMeas = { src, types: this.autoKind === 'SINE' ? ['CYCRMS', 'FREQ', 'PERIOD', 'PKPK'] : ['MEAN', 'PKPK'] };
    this.menu = 'AUTOSET';
    const scales = this.ch.map((c, i) => (c.on ? `CH${i + 1} ${fmtV(this.vdiv(i))}/div` : null)).filter(Boolean).join('、');
    return { kind: 'approx', text: `AutoSet：${scales}、${fmtScale(this.sdiv)}/div、觸發 CH${src + 1} 位準 50%${notes.length ? `；${notes.join('；')}` : ''}。選檔規則是教學近似（GAP-TDS-10），Probe 設定不變；之後訊號再變也不會自動重調。` };
  }

  // ---- Default Setup（TDS-F18）----
  defaultSetup() {
    this.applyDefaults();
    this.rec = null; this.frames = null;
    if (['CH2', 'PROBE2', 'AUTOSET'].includes(this.menu)) this.menu = null; // CH2 已關、AutoSet 量測已失效；其他選單保留（GAP-TDS-04）
    this.msg = 'Default setup recalled';
    return { kind: 'approx', text: 'Default Setup：依手冊 Appendix E 回復，只顯示 CH1；500 ms/div＋Auto 會進入 Scan（簡化呈現、量測無效，GAP-TDS-08）；Probe 倍率不重設（暫定 GAP-TDS-09）。接著按 Auto Set。' };
  }

  // ---- 輸入：旋鈕 ----
  turn(id, dir) {
    if (!this.on) return null;
    this.msg = '';
    const h = this.knob(id, dir);
    this.tick();
    return h;
  }

  knob(id, dir) {
    const chan = id.match(/^TDS\.KNOB\.CH(\d)_(POSITION|VOLTS_DIV)$/);
    if (chan) {
      const i = Number(chan[1]) - 1, c = this.ch[i];
      if (!c.on) return { kind: 'info', text: `CH${i + 1} 沒有開啟：先按 ${i + 1} 顯示通道。` };
      if (chan[2] === 'VOLTS_DIV') c.vIdx = clamp(c.vIdx - dir, 0, VDIV.length - 1); // 順時針＝V/div 變小
      else c.pos += dir / 25; // 每格 1/25 div
      c.pos = clamp(Math.round(c.pos * 25) / 25, -this.posLimit(i), this.posLimit(i)); // 改 V/div 時格數不變（GAP-TDS-11）
      return null;
    }
    switch (id) {
      case 'TDS.KNOB.HORIZ_SCALE':
        this.sIdx = clamp(this.sIdx - dir, 0, SDIV.length - 1); // 以螢幕中央縮放：M Pos（中央的時間）不變
        this.mpos = clamp(this.mpos, ...this.mposRange());
        return null;
      case 'TDS.KNOB.HORIZ_POSITION': {
        if (this.isScan()) return { kind: 'info', text: 'Scan 模式下不能調水平位置（手冊 p.77）。' };
        const step = this.sdiv / 25; // 解析度 1/25 div；順時針＝波形往右（M Pos 變小）
        this.mpos = clamp(Math.round(this.mpos / step - dir) * step, ...this.mposRange());
        return null;
      }
      case 'TDS.KNOB.TRIG_LEVEL': {
        const s = this.trig.src, b = this.base(s), pos = this.ch[s].pos, step = 0.02 * b; // 解析度 0.02 div；範圍中央 ±8 div
        this.trig.level = clamp(Math.round(this.trig.level / step + dir) * step, (-8 - pos) * b, (8 - pos) * b);
        this.markBroken();
        return null;
      }
      case 'TDS.KNOB.MULTIPURPOSE': return this.turnMulti(dir);
      default: return null;
    }
  }

  mposRange() { // p.110：(−4 div × s/div) 至依時基而定的上限
    const s = this.sdiv;
    return [-4 * s, s <= 10e-9 ? 20e-3 : s <= 100e-6 ? 50e-3 : s <= 10 ? 50 : 250];
  }

  turnMulti(dir) {
    const t = this.knobTarget();
    if (!t) return { kind: 'info', text: '多功能旋鈕在目前的選單沒有作用（旁邊 LED 熄滅）。' };
    if (t === 'probe') {
      const i = Number(this.menu.slice(-1)) - 1, k = PROBES.indexOf(this.ch[i].probe);
      const nk = clamp(k + dir, 0, PROBES.length - 1);
      return nk === k ? null : this.setProbe(i, nk);
    }
    if (t === 'trigsrc') { const s = dir > 0 ? 1 : 0; return s === this.trig.src ? null : this.setTrigSrc(s); }
    if (t === 'meastype') return this.stepMeasType(Number(this.menu.slice(-1)) - 1, dir);
    const cu = this.cursor, arr = cu.type === 'TIME' ? cu.t : cu.v; // 游標每格 1/25 div，限制在 graticule 內（GAP-TDS-15）
    arr[cu.sel] = clamp(arr[cu.sel] + dir, cu.type === 'TIME' ? -125 : -100, cu.type === 'TIME' ? 125 : 100);
    return null;
  }

  // 實驗台：外殼注入訊號來源（回傳 { sig:[{table,period}|null ×2], probe:[倍率 ×2] }）；電路變了呼叫 inputChanged
  setBenchSource(fn) { this.benchSource = fn; }
  benchFx() { return this.benchSource?.() ?? { sig: [null, null], probe: [10, 10] }; }
  inputChanged() {
    if (this.scen !== 'BENCH') return;
    this.fx = this.benchFx();
    this.tick();
  }

  setScenario(id) {
    const s = SCEN[id];
    if (!s) return null;
    this.scen = id;
    this.fx = s.bench ? this.benchFx() : s;
    this.tick();
    const frozen = this.run === 'stop' ? ' 採集已停止：波形與量測仍是舊紀錄，只有右下角觸發頻率會跟著新訊號。' : '';
    return { kind: 'info', text: `單機測試情境 ${s.label}：${s.desc}。${frozen}` };
  }

  // ---- 輸出 ----
  lcd() { return renderLcd(this); }
  visual(id) { return id === 'TDS.LED.MULTIPURPOSE' ? { lit: this.on && !!this.knobTarget() } : {}; }

  // 右側選單（LCD 用）：{ title, items[5]: { lines, hot（反白的行）} }；鍵位依手冊表列順序暫定（GAP-TDS-02）
  menuItems() {
    const m = this.menu;
    if (!m) return null;
    const hot = (a, b) => ({ lines: [a, b], hot: [1] });
    const plain = (...lines) => ({ lines, hot: [] });
    const E = plain();
    const i = Number(m.slice(-1)) - 1;
    if (m === 'CH1' || m === 'CH2') {
      const c = this.ch[i];
      return { title: m, items: [hot('Coupling', CPL[c.coupling]), c.bw ? { lines: ['BW Limit', 'On', '20MHz'], hot: [1] } : hot('BW Limit', 'Off'),
        hot('Volts/Div', 'Coarse'), plain('Probe', `${c.probe}X`, 'Voltage'), hot('Invert', 'Off')] };
    }
    if (m.startsWith('PROBE')) return { title: 'Probe', items: [{ lines: ['Voltage'], hot: [0] }, plain('Current'), hot('Attenuation', `${this.ch[i].probe}X`), E, plain('Back')] };
    if (m === 'TRIG') {
      const t = this.trig;
      return { title: 'Trigger', items: [hot('Type', 'Edge'), hot('Source', `CH${t.src + 1}`), hot('Slope', t.slope === 'R' ? 'Rising' : 'Falling'),
        hot('Mode', t.mode === 'AUTO' ? 'Auto' : 'Normal'), hot('Coupling', t.coup)] };
    }
    if (m === 'MEAS') return { title: 'Measure', items: this.meas.map((s) => plain(`CH${s.src + 1}`, MEAS_NAME[s.type], this.measure(s.src, s.type).text)) };
    if (m.startsWith('MEAS')) {
      const s = this.meas[i];
      return { title: `Measure ${i + 1}`, items: [hot('Source', `CH${s.src + 1}`), hot('Type', MEAS_NAME[s.type]), E, E, plain('Back')] };
    }
    if (m === 'CURSOR') {
      const cu = this.cursor, ci = this.cursorInfo();
      const items = [hot('Type', { OFF: 'Off', TIME: 'Time', AMPL: 'Amplitude' }[cu.type]), hot('Source', `CH${cu.src + 1}`), E, E, E];
      if (ci && !ci.hidden) {
        const cur = (k) => {
          const lines = [`Cursor${k + 1}`, ...(ci.type === 'TIME' ? [fmtS(ci.t[k]), ci.v[k] == null ? '' : fmtV(ci.v[k])] : [fmtV(ci.v[k])])];
          return { lines, hot: cu.sel === k ? lines.map((_, n) => n) : [] };
        };
        items[2] = ci.type === 'TIME'
          ? plain(`Δt ${fmtS(ci.dt)}`, `1/Δt ${ci.dt > 0 ? `${engp(1 / ci.dt, 4)}Hz` : '?'}`, `ΔV ${ci.dv == null ? '' : fmtV(ci.dv)}`)
          : plain(`ΔV ${fmtV(ci.dv)}`);
        items[3] = cur(0);
        items[4] = cur(1);
      }
      return { title: 'Cursor', items };
    }
    if (m === 'ACQ') return { title: 'Acquire', items: [{ lines: ['Sample'], hot: [0] }, plain('Peak Detect'), plain('Average'), plain('Averages', '16'), E] };
    if (m === 'HORIZ') return { title: 'Horizontal', items: [{ lines: ['Main'], hot: [0] }, plain('Window', 'Zone'), plain('Window'), plain('Set', 'Holdoff'), E] };
    if (m === 'AUTOSET') {
      const undo = plain('Undo', 'Autoset');
      return { title: 'Autoset', items: this.autoKind === 'SINE'
        ? [{ lines: ['Multi-cycle', 'sine'], hot: [0, 1] }, plain('Single-cycle', 'sine'), plain('FFT'), undo, E] : [E, E, E, undo, E] };
    }
    return null;
  }

  status() {
    if (!this.on) return [['電源', '關閉（再按 POWER 開機，會回復關機前的設定）']];
    const s = SCEN[this.scen], t = this.trig;
    const runText = this.run === 'stop' ? (this.complete ? 'Single 完成，已停止' : '已停止（凍結）') : this.run === 'single' ? 'Single 等待觸發' : '連續採集';
    const rows = [
      ['測試情境', s.label],
      ['採集', `${runText} · LCD 狀態 ${this.trigStatus()}${this.isScan() ? '（Scan 簡化呈現，量測無效）' : ''}`],
    ];
    this.ch.forEach((c, i) => {
      const probe = `Probe ${c.probe}X（實際 ${this.fx.probe[i]}×${c.probe !== this.fx.probe[i] ? '，不一致' : ''}）`;
      rows.push([`CH${i + 1}`, c.on ? `${CPL[c.coupling]} · ${fmtV(this.vdiv(i))}/div · 位置 ${fmtFixed(c.pos, 2)} div · ${probe}` : `關閉 · ${probe}`]);
    });
    rows.push(['水平', `${fmtScale(this.sdiv)}/div · M Pos ${fmtS(this.mpos)}`]);
    rows.push(['觸發', `Edge · CH${t.src + 1} · ${t.slope === 'R' ? 'Rising' : 'Falling'} · ${t.mode === 'AUTO' ? 'Auto' : 'Normal'} · 耦合 ${t.coup} · Level ${fmtV(this.levelV())}`]);
    this.meas.forEach((q, n) => {
      if (q.type === 'NONE') return;
      const r = this.measure(q.src, q.type);
      rows.push([`Measure ${n + 1}`, `CH${q.src + 1} ${MEAS_NAME[q.type]}：${r.text === '' ? `無效（${r.why}）` : r.text}${r.text.endsWith('?') && r.why ? `（${r.why}）` : ''}`]);
    });
    rows.push(['多功能旋鈕', KNOB_TEXT[this.knobTarget()] ?? '目前沒有作用（LED 熄滅）']);
    const r = this.rec;
    rows.push(['採集紀錄', r ? `第 ${r.n} 筆（${r.triggered ? '已觸發' : '未觸發'}）${this.run === 'stop' ? '，已凍結' : ''}${r.broken ? '，停止後改了觸發／耦合（斷線樣式）' : ''}` : '尚無']);
    return rows;
  }

  snapshot() {
    const r = this.rec;
    const stats = (i) => {
      const a = r?.v[i];
      if (!a) return null;
      let mx = -Infinity, mn = Infinity, sum = 0;
      for (const y of a) { mx = Math.max(mx, y); mn = Math.min(mn, y); sum += y; }
      const k = this.ch[i].probe;
      return { max: mx * k, min: mn * k, mean: (sum / a.length) * k };
    };
    return {
      on: this.on, scenario: this.scen, run: this.run, complete: this.complete, status: this.trigStatus(), scan: this.isScan(),
      menu: this.menu, msg: this.msg, knob: this.knobTarget(),
      ch: this.ch.map((c, i) => ({ ...c, vdiv: this.vdiv(i), actual: this.fx.probe[i] })),
      sdiv: this.sdiv, mpos: this.mpos,
      trig: { ...this.trig, levelV: this.levelV(), freq: this.trigFreq() },
      meas: this.meas.map((q) => ({ ...q, text: this.measure(q.src, q.type).text })),
      autoMeas: this.autoMeas && this.autoMeas.types.map((ty) => ({ type: ty, text: this.measure(this.autoMeas.src, ty).text })),
      cursor: { ...this.cursor, info: this.cursorInfo() },
      acqN: this.acqN,
      rec: r && { n: r.n, triggered: r.triggered, broken: r.broken, t0: r.t0, dt: r.dt, band: r.band, stats: [stats(0), stats(1)] },
    };
  }
}
