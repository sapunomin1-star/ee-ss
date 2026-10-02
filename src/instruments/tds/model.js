// TDS2001C 行為模型（I03）。規格：docs/data/tds.json（TDS-F01～F21、GAP-TDS-01～24）、common.json §0.2／§0.4。
// 核心：每次採集產生一份紀錄（2500 點＝10 div，GAP-TDS-24）；波形、Measure、Cursor 都只從這份紀錄算。
// 訊號路徑：情境訊號（探棒尖端）÷ 實際探棒 → BNC → 通道耦合（AC＝一階高通）→ BW Limit（一階 20 MHz）
//   → 採集（每 div 250 點、10 格動態範圍外削頂）→ 紀錄（存 BNC 伏特）。
//   顯示值＝紀錄 × 示波器 Probe 設定：設定與實際探棒不一致時，讀值按比例錯（TDS-F08）。
// 時間模型：事件驅動。每次操作（按鍵、旋鈕、換情境）後做一次掃描更新 tick()：
//   有效觸發 → 以觸發點為 t＝0 採一筆（連續採集又欠取樣時採幾幀輪播）；Auto 無觸發 → 以固定種子隨機相位採幾幀（LCD 輪播成不穩定畫面，GAP-TDS-06）；
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

// 表格平均（AC 耦合時單次擷取要扣掉的直流）
const tableMean = (v) => { if (!v?.length) return 0; let s = 0; for (const x of v) s += x; return s / v.length; };

// ---- 訊號路徑物件（正弦解析式／週期波形表）----
function sinePath(a, m, f, d) {
  return {
    kind: 'sine', a, m, f, d, mean: m,
    at: (t) => m + a * Math.sin(2 * Math.PI * f * (t - d)),
    cross: (L, slope) => { const s = Math.asin((L - m) / a); return d + (slope === 'R' ? s : Math.PI - s) / (2 * Math.PI * f); },
  };
}
// 週期表格（等間隔 M 點）在時間 t 的線性內插
function lerpTable(v, period) {
  const M = v.length;
  return (t) => {
    const u = ((((t / period) % 1) + 1) % 1) * M, j = Math.floor(u) % M, fr = u - Math.floor(u);
    return v[j] + (v[(j + 1) % M] - v[j]) * fr;
  };
}
// v：一個週期的波形（BNC 伏特，等間隔 M 點，點間線性）；ex：選填的精確解 ex(t)（實驗台提供，取樣點之間也準）。
// 統計（a、m、mean）、交越、濾波都用表格；at() 有精確解就逐點用它，交越在表格找到的區段內再用精確解二分求準
// （例：RC 窄脈衝的邊緣，否則觸發點會偏離邊緣最多一個表格間隔）。
function tablePath(v, period, ex = null) {
  const M = v.length;
  let mx = -Infinity, mn = Infinity, sum = 0;
  for (const x of v) { if (x > mx) mx = x; if (x < mn) mn = x; sum += x; }
  const a = (mx - mn) / 2 > 1e-12 ? (mx - mn) / 2 : 0;
  const cross = (L, slope) => { // 一個週期內第一個符合斜率的穿越點
    const before = (y) => (slope === 'R' ? y < L : y > L); // 還沒穿越
    for (let j = 0; j < M; j++) {
      const y0 = v[j], y1 = v[(j + 1) % M];
      if (!before(y0) || before(y1)) continue;
      let lo = (j / M) * period, hi = ((j + 1) / M) * period;
      const lin = ((j + (L - y0) / (y1 - y0)) / M) * period;
      if (!ex || !before(ex(lo))) return lin;
      // 精確解的穿越可能比表格晚一點（例：BW 低通讓跳變後的邊緣延遲幾 ns，落到下一格）：往後找到第一個已穿越的點再二分
      const h = period / M;
      if (before(ex(hi))) {
        let t = hi;
        for (let n = 1; n <= 24 && before(ex(t)); n++) t = hi + (n * h) / 8;
        if (before(ex(t))) return lin;
        lo = t - h / 8; hi = t;
      }
      for (let n = 0; n < 40; n++) { const c = (lo + hi) / 2; if (before(ex(c))) lo = c; else hi = c; }
      return hi;
    }
    return 0;
  };
  return { kind: 'table', v, period, ex, a, m: (mx + mn) / 2, f: a > 0 && period > 0 ? 1 / period : 0, d: 0, mean: sum / M, at: ex ?? lerpTable(v, period), cross };
}

// 一階低通 dz/dt＝(x−z)/τ（τ＝1/(2πfc)）對週期表格的週期穩態解。x 在點間線性（和 at() 的內插一致），每段精確積分：
//   z⁺＝z＋(1−e^(−s))(x₀−z)＋(1−(1−e^(−s))/s)(x₁−x₀)，s＝h/τ（小 s 用級數，同 bench/circuit.js）；
//   shooting：z(T)＝e^(−T/τ)·z(0)＋b → z(0)＝b/(1−e^(−T/τ))，用 expm1 維持數值穩定。
function lowpassTable(v, period, fc) {
  const M = v.length, tau = 1 / (2 * Math.PI * fc), z = new Float64Array(M);
  if (period < 1e-6 * tau) { // 週期遠小於 τ：輸出＝平均值（同 bench/circuit.js）
    let mean = 0;
    for (const x of v) mean += x / M;
    return z.fill(mean);
  }
  const s = period / M / tau, dec = -Math.expm1(-s);
  const ramp = s < 1e-3 ? s * (0.5 + s * (-1 / 6 + s * (1 / 24 - s / 120))) : 1 - dec / s;
  const run = (z0) => {
    let y = z0;
    for (let k = 0; k < M; k++) {
      z[k] = y;
      const x0 = v[k], x1 = v[(k + 1) % M];
      y += dec * (x0 - y) + ramp * (x1 - x0);
    }
    return y;
  };
  run(run(0) / -Math.expm1(-period / tau));
  return z;
}

// 一階高通 fc（AC 耦合）：正弦用解析的增益與相位超前；表格＝x − LPF(x)（週期穩態），有精確解時 at'(t)＝at(t) − LPF 表格內插
function highpass(p, fc) {
  if (p.kind === 'sine') {
    if (!(p.f > 0)) return sinePath(0, 0, 0, 0);
    return sinePath((p.a * p.f) / Math.hypot(p.f, fc), 0, p.f, p.d - Math.atan(fc / p.f) / (2 * Math.PI * p.f));
  }
  const z = lowpassTable(p.v, p.period, fc), zt = lerpTable(z, p.period);
  return tablePath(p.v.map((x, k) => x - z[k]), p.period, p.ex && ((t) => p.ex(t) - zt(t)));
}

// BW Limit：一階低通 fc＝20 MHz（手冊只寫會濾掉高頻雜訊，響應形狀未載，PD 近似）。
//   正弦：解析的增益與相位落後。表格：取樣間隔 h ≤ τ/2 才對表格做週期穩態低通（輸出在 τ 尺度上平滑，之後用表格內插、
//   不再用精確解）；h 更粗時（實驗台每週期 4000 點，約 63 kHz 以下）20 MHz 的效果小於表格解析度，不處理。
//   示波器本身 50 MHz 的類比頻寬仍不模擬（I00 範圍表 OUT）。
const BW_FC = 20e6;
function bwLimit(p) {
  if (p.kind === 'sine') {
    if (!(p.f > 0)) return p;
    const r = p.f / BW_FC;
    return sinePath(p.a / Math.hypot(1, r), p.m, p.f, p.d + Math.atan(r) / (2 * Math.PI * p.f));
  }
  if (p.period / p.v.length > 1 / (4 * Math.PI * BW_FC)) return p.ex ? tablePath(p.v, p.period, bwExact(p, BW_FC)) : p;
  return tablePath(lowpassTable(p.v, p.period, BW_FC), p.period);
}

// 表格太粗（低頻訊號）時的 BW：對實驗台給的精確解做一階低通卷積 y(t)＝∫(1/τ)e^(−u/τ)·x(t−u)du。
//   跳變只發生在表格格點上：先從表格找出跳變格點（相鄰兩點差超過峰對峰的 20%）；離最近跳變超過 12τ 的點，
//   平滑訊號經一階低通≈延遲 τ（誤差 τ²·x″ 級），直接取 x(t−τ)；12τ 內有跳變就在跳變處與每 2τ 切段、各段 4 點 Gauss–Legendre。
const GL4 = [[-0.8611363115940526, 0.3478548451374538], [-0.3399810435848563, 0.6521451548625461],
  [0.3399810435848563, 0.6521451548625461], [0.8611363115940526, 0.3478548451374538]];
function bwExact(p, fc) {
  const { v, period, ex } = p, M = v.length, h = period / M, tau = 1 / (2 * Math.PI * fc), span = 12 * tau;
  const jumps = [];
  for (let k = 0; k < M; k++) if (Math.abs(v[k] - v[(k + M - 1) % M]) > 0.2 * 2 * p.a) jumps.push(k * h);
  if (!jumps.length) return (t) => ex(t - tau);
  return (t) => {
    const ph = t - Math.floor(t / period) * period;
    const cuts = [];
    for (const e of jumps) { const u = ph - e - Math.floor((ph - e) / period) * period; if (u > 0 && u < span) cuts.push(u); } // 往回 u 秒是跳變
    if (!cuts.length) return ex(t - tau);
    for (let j = 0; j <= 6; j++) cuts.push(2 * j * tau);
    cuts.sort((a, b) => a - b);
    let y = 0;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (!(b - a > 1e-15)) continue;
      for (const [x, w] of GL4) { const u = a + ((x + 1) / 2) * (b - a); y += ((w * (b - a)) / 2) * (Math.exp(-u / tau) / tau) * ex(t - u); }
    }
    return y + Math.exp(-span / tau) * ex(t - span);
  };
}

// AutoSet 的波形辨識（手冊 p.80–81 只列結果，演算法 PD）。正弦情境（解析式）＝正弦。表格：
//   扣掉基頻正弦後的殘差 RMS < 基頻 RMS 的 2%（THD < 2%）＝正弦；
//   ≥ 70% 的點落在距最大值或最小值 20% 峰對峰以內（平頂＋平底，容許 RC 圓角與小傾斜）＝方波／脈波；
//   其他（三角波、Ramp、圓角太多的充放電波形、窄尖脈衝）＝無法判定。
function waveKind(p) {
  if (!(p.a > 0 && p.f > 0)) return 'UNKNOWN';
  if (p.kind === 'sine') return 'SINE';
  const v = p.v, M = v.length, top = p.m + 0.6 * p.a, bot = p.m - 0.6 * p.a;
  let re = 0, im = 0, s2 = 0, flat = 0;
  for (let k = 0; k < M; k++) {
    const x = v[k] - p.mean, w = (2 * Math.PI * k) / M;
    re += x * Math.cos(w);
    im += x * Math.sin(w);
    s2 += x * x;
    if (v[k] >= top || v[k] <= bot) flat++;
  }
  const fund = (2 * (re * re + im * im)) / (M * M); // 基頻成分的均方值
  if (s2 / M - fund < 0.02 ** 2 * fund) return 'SINE';
  return flat >= 0.7 * M ? 'SQUARE' : 'UNKNOWN';
}
// 各辨識結果的自動量測（手冊 p.80–81、TDS-F21）與 Undo Autoset 鍵位（依手冊表列順序暫定，GAP-TDS-02）
const AUTO = {
  SINE: { meas: ['CYCRMS', 'FREQ', 'PERIOD', 'PKPK'], undo: 3, name: '正弦' },
  SQUARE: { meas: ['PKPK', 'MEAN', 'PERIOD', 'FREQ'], undo: 4, name: '方波／脈波' },
  UNKNOWN: { meas: ['MEAN', 'PKPK'], undo: 3, name: '無法判定' },
};

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
      '採集：Run/Stop 停止後仍可縮放凍結的紀錄（採集時超出 10 格的部分已削頂，放大縮小也回不來）；單一（Single）取到一幀就停。',
      '量測：Measure → 按 OPT1–5 選一格 → Source／Type（也可轉多功能旋鈕）→ Back。',
      '游標：Cursor → Type（Time／Amplitude）→ Source → Cursor 1／Cursor 2，再轉多功能旋鈕（每格 1/25 div）。',
      '探棒錯配：側欄情境裡的「實際探棒」和示波器的 Probe 設定是兩回事，設錯時讀值按比例錯。',
      '近似／暫定：LCD 語言暫定英文；Trigger、Probe、Measure n、AutoSet、Horiz 選單的鍵位暫定；Auto 無觸發的不穩定畫面、Scan、AutoSet 選檔與波形辨識、AC 耦合與 BW Limit 的一階濾波、游標步進都是教學近似。',
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
    this.changeSearch = null;
    this.armedAt = null;
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
  posLimit(i, b = this.base(i)) { return (b <= 0.2 + 1e-12 ? 1.8 : 45) / b; } // 以格數表示（GAP-TDS-11）；b 可供 AutoSet 檢查候選檔位
  isScan() { return this.run === 'run' && this.trig.mode === 'AUTO' && this.sdiv >= 0.1 - 1e-12; }
  rand() { // mulberry32：固定種子，測試可重現
    let t = (this.seed = (this.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---- 訊號路徑 ----
  // 通道 i 在 BNC、經通道耦合與 BW Limit 後的訊號（BNC 伏特）。兩種來源：
  //   正弦情境：v(τ) = m + a·sin(2πf(τ − d))（解析式）
  //   週期波形表（實驗台電路算出的探棒尖端電壓，一個週期 M 點）：線性內插；另給精確解 at(t) 時逐點用它
  // 共同欄位：a＝(max−min)/2、m＝(max+min)/2、f（0＝直流或無訊號）、mean、at(t)、cross(L, slope)
  path(i) {
    const s = this.fx.sig[i], c = this.ch[i];
    if (!s || c.coupling === 'GND') return sinePath(0, 0, 0, 0); // Ground＝零伏參考線
    const px = this.fx.probe[i], k = 1 / px;
    let p = s.table
      ? tablePath(Float64Array.from(s.table, (x) => x * k), s.period, s.at ? (t) => s.at(t) * k : null)
      : sinePath((s.vpp / 2) * k, s.dc * k, s.f, s.delay);
    if (c.coupling === 'AC') p = highpass(p, px === 10 ? 1 : 10); // 一階高通 fc＝10 Hz，實際 10× 探棒時 1 Hz，直接呈現週期穩態（GAP-TDS-12）
    return c.bw ? bwLimit(p) : p;
  }

  // 觸發路徑：取自通道耦合（含 BW Limit）後的訊號（GAP-TDS-13）。觸發耦合 AC 再加一階高通 10 Hz：手冊 p.97–98
  //   「blocks DC、attenuates below 10 Hz」，一階為 PD；是觸發系統內部的耦合，不隨探棒倍率改變（PD）。只影響觸發，不改波形（p.21、TDS-F07）
  trigPath() {
    const p = this.path(this.trig.src);
    return this.trig.coup === 'AC' ? highpass(p, 10) : p;
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
  // tau＝觸發事件的絕對時間（紀錄的 t＝0 對到觸發點）；null＝未觸發（隨機相位）。
  // 取樣（Sample 模式，每 div 250 點，GAP-TDS-24）：取樣時鐘和觸發不同步，每筆採集相對觸發點有隨機的次取樣相位
  //   （固定種子，測試可重現），紀錄的時間軸含這個相位 → 取樣充足的訊號畫面穩定；欠取樣的訊號逐點取值後自然混疊
  //   （手冊的 aliasing 段落），每筆的樣子都不同。快時基（≤250 ns/div，超過 500 MS/s）仍直接取值：真機以 sin(x)/x
  //   內插補點，對頻寬內的訊號結果等同直接取值。
  // 前端（p.108：每格 25 階、10 格動態範圍）：樣本限制在採集當下的 [(−5 − pos)·V/div, (5 − pos)·V/div]（BNC 伏特，
  //   1X V/div），超出的削頂並記旗標；紀錄保存採集時的前端設定。停止後轉 V/div、位置只縮放既有資料，削掉的波峰不會回來。
  //   不做 8-bit 量化（範圍外）。
  // abs0（實驗台才有）：紀錄 t＝0 對應的絕對時間。DC 耦合、BW 關時改用實際電壓 abs(t)（含電容暫態與改變前的電路），
  //   紀錄裡看得到充放電的曲線；force＝單次擷取電路變化：各種耦合都用 abs（AC 只扣掉目前的直流，GND 為 0，BW 不計，PD）。
  //   scan：abs0 已對好（紀錄結束在「看的時刻」），未觸發也不加隨機相位。
  acquire(tau, abs0 = null, { force = false, scan = false } = {}) {
    const triggered = tau != null;
    if (!triggered) tau = this.rand();
    // 未觸發：週期訊號的起點落在「看的時刻」之後一個週期內的隨機相位（與週期路徑同一個亂數），不會跑到未來或過去很遠
    const anchor = (p) => {
      if (abs0 == null || triggered || scan || !(p.f > 0)) return abs0;
      const P = 1 / p.f;
      return abs0 + ((((tau - abs0) % P) + P) % P);
    };
    const dt = this.sdiv / PTS_DIV, t0 = this.mpos - 5 * this.sdiv + this.rand() * dt;
    const fe = [null, null], clip = [false, false];
    const v = this.ch.map((c, i) => {
      if (!c.on) return null; // 只採顯示中的通道
      const base = this.base(i), lo = (-5 - c.pos) * base, hi = (5 - c.pos) * base;
      const p = this.path(i), arr = new Float64Array(N), s = this.fx.sig?.[i];
      const useAbs = abs0 != null && s?.abs && (force || (c.coupling === 'DC' && !c.bw)), a0 = useAbs ? anchor(p) : 0;
      const kp = 1 / this.fx.probe[i], dc = c.coupling === 'AC' ? tableMean(s?.table) * kp : 0;
      fe[i] = { base, pos: c.pos, probe: c.probe, coupling: c.coupling, bw: c.bw };
      for (let k = 0; k < N; k++) {
        const y = !useAbs ? p.at(tau + t0 + k * dt) : c.coupling === 'GND' ? 0 : s.abs(a0 + t0 + k * dt) * kp - dc;
        if (y > hi || y < lo) clip[i] = true;
        arr[k] = clamp(y, lo, hi);
      }
      return arr;
    });
    return { n: ++this.acqN, t0, dt, v, fe, clip, triggered, broken: false, abs0 };
  }

  // 實驗台：觸發點（週期穩態的相位 tau）對到「看的時刻」之後的第一個同相位時刻
  absAnchor(tau) {
    const tv = this.fx.tView;
    if (tv == null) return null;
    if (tau == null) return tv;
    const f = this.trigPath().f;
    if (!(f > 0)) return tv;
    const P = 1 / f;
    return tv + ((((tau - tv) % P) + P) % P);
  }

  // 擷取電路變化（暫態）：Single 等待中、或 Normal 模式下電路改變時，從改變的時刻往後，用實際電壓（含暫態、改變前的電路）
  //   找第一個觸發，以它為 t＝0 擷取。Single 擷取後停止；Normal 繼續等下一個觸發：之後週期訊號還會觸發就被新採集蓋掉，
  //   不再觸發（例如直流階躍只穿越一次）就一直保留這筆（手冊：Normal 只在有效觸發時更新）。只搜尋已經發生的時間。
  //   觸發判斷只看觸發源的實際電壓與位準／斜率（PD：AC 耦合只扣掉目前的直流、不模擬濾波暫態；觸發耦合 AC 同樣處理）。
  captureChange() {
    const fx = this.fx, src = this.trig.src, s = fx.sig?.[src], c = this.ch[src];
    if (!s?.abs || c.coupling === 'GND' || fx.changedAt == null) return false;
    const kp = 1 / fx.probe[src], dc = c.coupling === 'AC' || this.trig.coup === 'AC' ? tableMean(s.table) * kp : 0;
    let calls = 0;
    const y = (t) => { calls++; return s.abs(t) * kp - dc; }, L = this.trig.level, up = this.trig.slope === 'R';
    const crossed = (a, b) => (up ? a < L && b >= L : a > L && b <= L);
    const P = s.period > 0 && fx.sig[src].table && this.path(src).f > 0 ? s.period : 0;
    const currentStep = Math.min(this.sdiv / 25, P ? P / 400 : Infinity);
    const key = JSON.stringify([src, c.coupling, this.trig.coup, this.trig.slope, L, kp, this.run === 'single' ? this.armedAt : null]);
    let search = this.changeSearch;
    if (search?.key !== key) {
      const start = Math.max(fx.changedAt, this.run === 'single' ? this.armedAt ?? fx.now ?? fx.changedAt : fx.now ?? fx.changedAt);
      this.changeSearch = search = { key, cursor: start, pending: [], initial: start === fx.changedAt, step: currentStep,
        sources: [{ from: fx.changedAt, to: Infinity, sig: s }] };
    } else if (search.sources.at(-1).from !== fx.changedAt) {
      search.sources.at(-1).to = fx.changedAt;
      search.sources.push({ from: fx.changedAt, to: Infinity, sig: s });
    }
    // 電路改變後仍續查未處理的歷史；新訊號較慢或時基放大，也不能把舊窄脈衝的搜尋解析度變粗。
    const step = search.step = Math.min(search.step, currentStep);
    // 截止時刻必須是現在，tView 的預覽偏移與預測中的交越都不能完成採集。
    const end = fx.now ?? fx.changedAt;
    const hit = (t) => {
      // Normal 每次畫面更新取一筆，下一次從這次的現在繼續，避免追趕早已發生的每一個週期。
      search.cursor = this.run === 'single' ? t : end; search.waiting = false; search.pending = [];
      search.step = currentStep;
      search.sources = search.sources.filter((g) => g.to > search.cursor);
      this.rec = this.acquire(0, t, { force: true });
      this.frames = null;
      if (this.run === 'single') { this.run = 'stop'; this.complete = true; this.armedAt = null; }
      return true;
    };
    // 改變那一瞬間電壓就跳過觸發線（例：開輸出時 0 → 0.952 V 的階躍）：觸發點＝改變時刻。改變前取前一段電路的值
    if (search.initial && fx.changedAt <= end) {
      search.initial = false;
      if (crossed(y(fx.changedAt - 1e-9), y(fx.changedAt))) return hit(fx.changedAt);
    }
    // abs(t)＝週期波形＋電容暫態。先用電壓範圍排除離 Level 很遠的區間，只有候選區間才細分到原本的步進。
    // 區間內的表格格點也納入範圍：窄脈衝不能只看區間兩端，否則兩端都低於 Level 時會漏掉尖峰。
    const possible = (a, b) => {
      const ctx = search.sources.find((g) => a >= g.from && a < g.to);
      if (!ctx || b >= ctx.to) return true; // 跨電路變化的區間先細分，包含邊界本身的跳變。
      const signal = ctx.sig;
      // 電路以各模態指數項的上下界提供保守範圍；未知來源沒有範圍時逐點續查，不能用少數取樣猜測沒有尖峰。
      if (!signal.transientRange) return true;
      if (!ctx.range) {
        const table = signal.table, period = signal.period, M = table?.length ?? 0;
        const steady = signal.at ?? (M && period > 0 ? lerpTable(table, period) : () => tableMean(table));
        let low = Infinity, high = -Infinity;
        for (const v of table ?? []) { low = Math.min(low, v); high = Math.max(high, v); }
        if (!M) low = high = steady(a);
        ctx.range = { table, period, M, steady, low, high };
      }
      const { table, period, M, steady, low, high } = ctx.range;
      const [r0, r1] = signal.transientRange(a, b), rlo = r0 * kp, rhi = r1 * kp;
      if (L < low * kp - dc + rlo || L > high * kp - dc + rhi) return false;
      if (!M || !(period > 0) || b - a >= period) return true;
      const pa = steady(a) * kp - dc, pb = steady(b) * kp - dc;
      let lo = Math.min(pa, pb), hi = Math.max(pa, pb);
      const h = period / M, phase = ((a % period) + period) % period;
      const first = Math.ceil(phase / h - 1e-7), offset = first * h - phase;
      const count = Math.max(0, Math.min(M + 1, Math.floor(((b - a) - offset) / h + 1e-7) + 1));
      // 只在一個週期內列格點；絕對時間／h 太大時，直接遞增那個整數會超出 JS 安全整數範圍。
      for (let j = 0; j < count; j++) {
        const v = table[(first + j) % M] * kp - dc;
        lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
      return L >= lo + rlo && L <= hi + rhi;
    };
    // 每次更新有固定工作量上限，未完成的區間保留到下次；不能把尚未查完整的電路變化標為已處理。
    while (calls < 40000) {
      if (!search.pending.length) {
        if (search.cursor >= end) break;
        const a = search.cursor, b = end;
        search.cursor = b;
        search.pending.push({ a, b });
      }
      const interval = search.pending.pop(), { a, b } = interval;
      // abs 的歷史可隨新電路狀態補齊；續查時重新讀兩端，不沿用未知訊號來源快照中的舊值。
      const ya = y(a), yb = y(b);
      if (!possible(a, b)) continue;
      const mid = (a + b) / 2;
      if (b - a <= step || mid === a || mid === b) {
        if (!crossed(ya, yb)) continue;
        let ta = a, tb = b, va = ya;
        for (let r = 0; r < 50; r++) { const tm = (ta + tb) / 2, ym = y(tm); if (crossed(va, ym)) tb = tm; else { ta = tm; va = ym; } }
        return hit(tb);
      }
      search.pending.push({ a: mid, b });
      search.pending.push({ a, b: mid }); // 先查較早的半段，找到的仍是第一個交越
    }
    search.waiting = search.pending.length > 0 || search.cursor < end;
    if (!search.waiting) {
      search.step = currentStep;
      search.sources = search.sources.filter((g) => g.to > search.cursor);
    }
    return false;
  }

  // 欠取樣：顯示中的通道有訊號頻率 > 取樣率/2（取樣率＝250 點／div）
  undersampled() {
    const dt = this.sdiv / PTS_DIV;
    return this.ch.some((c, i) => {
      if (!c.on) return false;
      const p = this.path(i);
      return p.a > 0 && p.f * dt > 0.5;
    });
  }

  // 暫態已結束時，低頻週期訊號的下一次實際交越仍可能尚未發生；外殼需要繼續通知等待中的採集。
  needsTriggerPoll() {
    if (this.scen !== 'BENCH' || !this.on || this.run === 'stop') return false;
    return !!this.changeSearch?.waiting || ((this.run === 'single' || this.trig.mode === 'NORMAL') && this.crosses());
  }

  tick(force = false) {
    if (!this.on || this.run === 'stop') return;
    if (this.scen === 'BENCH') this.fx = this.benchFx();
    this.frames = null;
    const tv = this.fx.tView; // 實驗台「看的時刻」；單機情境沒有
    if (this.isScan()) { this.rec = this.acquire(null, tv == null ? null : tv - 5 * this.sdiv - this.mpos, { scan: true }); return; } // Scan：紀錄結束在「看的時刻」（簡化，GAP-TDS-08）
    if (this.scen === 'BENCH' && this.fx.sig?.[this.trig.src]?.abs && this.fx.changedAt != null && this.ch[this.trig.src].coupling !== 'GND') {
      if (force) {
        this.rec = this.acquire(0, this.fx.now ?? this.fx.changedAt, { force: true });
        if (this.run === 'single') { this.run = 'stop'; this.complete = true; this.armedAt = null; }
        return;
      }
      if (this.run === 'single' || this.trig.mode === 'NORMAL') {
        this.captureChange();
        return; // 所有按鍵、旋鈕、定時更新共用實際交越；不能退回穩態相位而擷取未來的交越。
      }
    }
    const tt = this.trigTime();
    if (tt != null || force) {
      const a0 = this.absAnchor(tt);
      if (tt != null && this.run === 'run' && this.undersampled()) { // 連續採集又欠取樣：每筆混疊的樣子不同 → 幾幀輪播（真機畫面不穩定）
        this.frames = [0, 1, 2, 3].map(() => this.acquire(tt, a0));
        this.rec = this.frames[3];
      } else this.rec = this.acquire(tt, a0);
      if (this.run === 'single') { this.run = 'stop'; this.complete = true; this.armedAt = null; }
      return;
    }
    if (this.run === 'run' && this.trig.mode === 'AUTO') { // Auto 無觸發：自由執行
      this.frames = [0, 1, 2, 3].map(() => this.acquire(null, tv ?? null));
      this.rec = this.frames[3];
    }
    // Normal 或 Single 等待中：保留舊採集（TDS-F10、GAP-TDS-07）
  }

  trigStatus() {
    if (this.run === 'stop') return this.complete ? 'Acq. Complete' : 'Stop';
    if (this.isScan()) return 'Scan';
    if (this.run === 'single' && this.changeSearch) return 'Ready';
    if (this.crosses()) return "Trig'd";
    return this.run === 'run' && this.trig.mode === 'AUTO' ? 'Auto' : 'Ready';
  }

  // 停止後改觸發設定或通道耦合：波形改斷線樣式、資料不重算（p.84、GAP-TDS-21）
  markBroken() { if (this.run === 'stop' && this.rec) this.rec.broken = true; }

  // ---- 從紀錄算量測（TDS-F16、F21）----
  // 回傳 { text, value, why }：text＝'' 留空（通道未顯示或尚無採集，GAP-TDS-14）；'?' 或結尾 '?'＝無效
  // 數值一律從紀錄（採集時已削頂）算；紀錄有削頂，或以目前 V/div、位置顯示時超出 ±4 div（overrange），讀值後加 ?（p.31、p.105）
  measure(i, type) {
    if (type === 'NONE') return { text: '', value: null };
    const c = this.ch[i], r = this.rec, arr = r?.v[i];
    if (!c.on) return { text: '', value: null, why: `CH${i + 1} 未顯示` };
    if (!arr) return { text: '', value: null, why: '尚無採集' };
    if (this.isScan()) return { text: '?', value: null, why: 'Scan 模式不能量測' };
    const b = this.base(i), x = new Float64Array(arr.length);
    let off = false, mx = -Infinity, mn = Infinity, sum = 0;
    for (let j = 0; j < arr.length; j++) {
      if (Math.abs(c.pos + arr[j] / b) > 4 + 1e-9) off = true; // 超出畫面（overrange）
      x[j] = arr[j] * c.probe;
      if (x[j] > mx) mx = x[j];
      if (x[j] < mn) mn = x[j];
      sum += x[j];
    }
    const over = r.clip[i] || off, why = r.clip[i] ? '採集時超出 10 格動態範圍（削頂）' : off ? '波形超出畫面' : '';
    let value = null, unit = 'V', digits = 3;
    if (type === 'PKPK') value = mx - mn;
    else if (type === 'MEAN') value = sum / x.length;
    else {
      const cr = firstCycle(x);
      if (!cr) return { text: '?', value: null, why: '紀錄裡沒有完整週期' };
      const period = (cr[1].k - cr[0].k) * r.dt;
      if (type === 'FREQ') { value = 1 / period; unit = 'Hz'; digits = 4; }
      if (type === 'PERIOD') { value = period; unit = 's'; digits = 4; }
      if (type === 'CYCRMS') {
        let s2 = 0;
        for (let j = cr[0].j; j < cr[1].j; j++) s2 += x[j] * x[j];
        value = Math.sqrt(s2 / (cr[1].j - cr[0].j));
      }
    }
    const txt = unit === 'V' ? fmtV(value) : `${engp(value, digits)}${unit}`;
    return { text: txt + (over ? '?' : ''), value, why };
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
    // 關機期間沒有採集：不能在重新開機後續查關機前尚未處理的觸發歷史。
    this.changeSearch = null;
    this.armedAt = null;
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
      case 'TDS.KEY.ACQUIRE': this.menu = 'ACQ'; return { kind: 'approx', text: 'Acquire 選單：本模擬器固定 Sample（Peak Detect、Average 未納入）。Sample 取樣率＝每 div 250 點，訊號頻率超過取樣率一半會混疊（畫面不穩、量到假頻率），這時把 s/div 轉快。' };
      case 'TDS.KEY.HORIZ_MENU': this.menu = 'HORIZ'; return { kind: 'approx', text: 'Horiz 選單只啟用 Main（Window Zone、Window、Holdoff 未納入）。' };
      case 'TDS.KEY.AUTOSET': return this.autoset();
      case 'TDS.KEY.DEFAULT_SETUP': return this.defaultSetup();
      case 'TDS.KEY.RUN_STOP':
        // 每次恢復從現在開始等待；Stop 期間錯過的邊緣不補抓。
        this.changeSearch = null;
        this.armedAt = null;
        if (this.run === 'stop') { this.run = 'run'; this.complete = false; return null; }
        this.run = 'stop'; this.complete = false; this.frames = null;
        return null;
      case 'TDS.KEY.SINGLE':
        this.run = 'single'; this.complete = false; this.frames = null;
        this.changeSearch = null;
        this.armedAt = this.scen === 'BENCH' ? this.benchFx().now ?? null : null; // 之後電路一變就擷取那一刻起的暫態
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
    if (j === 1) { // 停止後切換：前端設定套不到凍結紀錄，和耦合一樣改斷線樣式（GAP-TDS-21 的原則，PD）
      c.bw = !c.bw;
      this.markBroken();
      return { kind: 'approx', text: c.bw
        ? 'BW Limit On（20MHz）：通道訊號加一階低通 fc＝20 MHz（響應形狀手冊未載，近似）；1 kHz 訊號幾乎看不出差別。示波器本身 50 MHz 的類比頻寬不模擬。'
        : 'BW Limit Off：拿掉 20 MHz 低通（示波器本身 50 MHz 的類比頻寬不模擬，近似）。' };
    }
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

  // AutoSet 選單（p.80–81）：Multi-cycle 選取中；Single-cycle、FFT、Rising／Falling edge 本輪 OUT；Undo 鍵位依選單而定
  autosetSoft(j) {
    const k = this.autoKind in AUTO ? this.autoKind : 'UNKNOWN';
    if (j === AUTO[k].undo) {
      if (!this.undo) return null;
      this.restore(this.undo);
      this.undo = null;
      return { kind: 'approx', text: 'Undo Autoset：回到按 AutoSet 之前的設定（近似）。' };
    }
    if (k === 'SINE') return [null, OUT('Single-cycle sine'), OUT('FFT'), null, null][j];
    if (k === 'SQUARE') return [null, OUT('Single-cycle square'), OUT('Rising edge'), OUT('Falling edge'), null][j];
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
      const fit = (pos) => VDIV.findIndex((b) => Math.abs(pos) <= this.posLimit(i, b) + 1e-9
        && pos + hi / b <= 4 + 1e-9 && pos + lo / b >= -4 - 1e-9);
      let k = fit(c.pos);
      if (k < 0 && c.pos !== 0) { c.pos = 0; k = fit(0); notes.push(`CH${i + 1} 位置先歸零再選刻度（後備規則）`); }
      c.vIdx = k < 0 ? VDIV.length - 1 : k;
    });
    if (periodic.length) {
      const k = SDIV.findIndex((s) => 10 * s * P[src].f >= 2 - 1e-9); // 至少 2 個完整週期的最快檔
      this.sIdx = k < 0 ? SDIV.length - 1 : k;
      if (k < 0) notes.push('訊號太慢，已選最大時基 50 s/div；畫面仍不足兩個週期，請手動調整或使用游標');
    }
    this.mpos = 0;
    this.trig = { src, slope: 'R', mode: 'AUTO', coup: 'DC', level: 0 };
    this.setTo50();
    this.cursor.type = 'OFF';
    this.run = 'run';
    this.complete = false;
    this.autoKind = periodic.includes(src) ? waveKind(P[src]) : 'UNKNOWN';
    this.autoMeas = { src, types: AUTO[this.autoKind].meas };
    this.menu = 'AUTOSET';
    // 訊息區：方波字樣照手冊（tds.json 的 AutoSet 回饋引文）；正弦、無法判定沒有引文，不顯示
    if (this.autoKind === 'SQUARE') this.msg = `Square wave or pulse detected on CH${src + 1}`;
    const scales = this.ch.map((c, i) => (c.on ? `CH${i + 1} ${fmtV(this.vdiv(i))}/div` : null)).filter(Boolean).join('、');
    return { kind: 'approx', text: `AutoSet：${scales}、${fmtScale(this.sdiv)}/div、觸發 CH${src + 1} 位準 50%、CH${src + 1} 辨識為${AUTO[this.autoKind].name}${notes.length ? `；${notes.join('；')}` : ''}。選檔規則與波形辨識是教學近似（GAP-TDS-10），Probe 設定不變；之後訊號再變也不會自動重調。` };
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
      const undo = plain('Undo', 'Autoset'), sel = (a, b) => ({ lines: [a, b], hot: [0, 1] });
      const items = {
        SINE: [sel('Multi-cycle', 'sine'), plain('Single-cycle', 'sine'), plain('FFT'), undo, E],
        SQUARE: [sel('Multi-cycle', 'square'), plain('Single-cycle', 'square'), plain('Rising', 'edge'), plain('Falling', 'edge'), undo],
      }[this.autoKind] ?? [E, E, E, undo, E];
      return { title: 'Autoset', items };
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
      rows.push([`CH${i + 1}`, c.on ? `${CPL[c.coupling]}${c.bw ? ' · BW 20MHz' : ''} · ${fmtV(this.vdiv(i))}/div · 位置 ${fmtFixed(c.pos, 2)} div · ${probe}` : `關閉 · ${probe}`]);
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
    rows.push(['採集紀錄', r ? `第 ${r.n} 筆（${r.triggered ? '已觸發' : '未觸發'}）${this.run === 'stop' ? '，已凍結' : ''}${r.broken ? '，停止後改了觸發／耦合／BW（斷線樣式）' : ''}${r.clip.some(Boolean) ? '，採集時有削頂' : ''}` : '尚無']);
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
      rec: r && { n: r.n, triggered: r.triggered, broken: r.broken, t0: r.t0, dt: r.dt, abs0: r.abs0, clip: r.clip, fe: r.fe, stats: [stats(0), stats(1)] },
    };
  }
}
