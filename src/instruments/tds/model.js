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
export const MEAS_TYPES = ['FREQ', 'PERIOD', 'MEAN', 'PKPK', 'CYCRMS', 'RMS', 'CURSORRMS', 'MIN', 'MAX', 'RISE', 'FALL', 'POSWIDTH', 'NEGWIDTH', 'DUTY', 'PHASE', 'DELAY', 'NONE'];
export const MEAS_NAME = { FREQ: 'Freq', PERIOD: 'Period', MEAN: 'Mean', PKPK: 'Pk-Pk', CYCRMS: 'Cyc RMS', RMS: 'RMS', CURSORRMS: 'Cursor RMS', MIN: 'Min', MAX: 'Max', RISE: 'Rise Time', FALL: 'Fall Time', POSWIDTH: 'Pos Width', NEGWIDTH: 'Neg Width', DUTY: 'Duty Cyc', PHASE: 'Phase', DELAY: 'Delay', NONE: 'None' };
export const N = 2500;
const PTS_DIV = 250;
const CPL = { DC: 'DC', AC: 'AC', GND: 'Ground' };
export const extendedDefaults = () => ({ invert: [false, false], acquire: 'SAMPLE', averages: 16,
  display: { type: 'VECTORS', persist: 0, format: 'YT' },
  math: { on: false, op: '-', reverse: false, pos: 0, scale: 2 },
  autoRange: { on: false, axes: 'BOTH' },
  fft: { source: 0, window: 'HANNING', zoom: 1, center: 0.5, verticalZoom: 1 },
  horizontal: { view: 'MAIN', windowIdx: SDIV.indexOf(0.05), windowPos: 0, holdoff: 0, holdoffSelected: false },
  fine: [false, false], fineScale: [null, null],
  cursorSource: 'CHANNEL',
  limit: { on: false, source: 0, compare: 0, templateSource: 0, destination: 0, vTolerance: .2, hTolerance: 0, show: true, action: 'NONE', stop: 'MANUAL', count: 1, seconds: 10, page: 0, target: 'V' },
  logging: { on: false, source: 0, duration: 1800 },
  pulse: { type: 'EDGE', when: '=', width: 1e-3, polarity: 'POSITIVE', page: 0, widthSelected: false },
  store: { action: 'SAVE_SETUP', setup: 0, source: 0, ref: 0, target: 'INTERNAL' }, refOn: [false, false] });
const clone = (x) => structuredClone(x);
const STORE_ACTIONS = ['SAVE_SETUP', 'SAVE_WAVEFORM', 'RECALL_SETUP'];
const STORE_NAMES = { SAVE_SETUP: 'Save Setup', SAVE_WAVEFORM: 'Save Waveform', RECALL_SETUP: 'Recall Setup' };

// Extrema of the simulated signal, rather than drawing interpolated Sample points.
// Sine extrema are analytic; table extrema include every source grid point in the interval.
// This is a bounded teaching model, not a claim of the hardware's 10 ns glitch sensitivity.
function peakRange(p, a, b, at = p.at) {
  let lo = Math.min(at(a), at(b)), hi = Math.max(at(a), at(b));
  const add = (t) => { const v = at(t); lo = Math.min(lo, v); hi = Math.max(hi, v); };
  if (p.kind === 'sine' && p.f > 0 && at === p.at) {
    const h = 1 / (2 * p.f), first = p.d + 1 / (4 * p.f);
    const k0 = Math.ceil((a - first) / h), k1 = Math.floor((b - first) / h);
    if (k1 >= k0) { add(first + k0 * h); if (k1 > k0) add(first + (k0 + 1) * h); }
  } else if (p.kind === 'table' && p.period > 0) {
    const h = p.period / p.v.length, count = Math.min(p.v.length + 1, Math.ceil((b - a) / h) + 1);
    const first = a + ((h - ((a % h) + h) % h) % h);
    for (let j = 0; j < count; j++) { const t = first + j * h; if (t > b) break; add(t); add(Math.max(a, t - 1e-12)); }
    if (b - a >= p.period && at === p.at) { lo = Math.min(lo, p.m - p.a); hi = Math.max(hi, p.m + p.a); }
  }
  for (let j = 1; j < 8; j++) add(a + (b - a) * j / 8);
  return [lo, hi];
}

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
const KNOB_TEXT = { holdoff: 'Trigger Holdoff', mathpos: 'Math Position', mathscale: 'Math Vertical Scale', averages: 'Acquire Averages', probe: 'Probe ► Attenuation（LED 亮）', trigsrc: 'Trigger ► Source（LED 亮）', meastype: 'Measure ► Type（LED 亮）', cursor: '移動選取的游標（LED 亮）' };

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

function edgePoints(x, level, rising) {
  const out = [];
  for (let k = 1; k < x.length; k++) if (rising ? x[k - 1] < level && x[k] >= level : x[k - 1] > level && x[k] <= level)
    out.push(k - 1 + (level - x[k - 1]) / (x[k] - x[k - 1]));
  return out;
}

function fft2048(input, window) {
  const n = 2048, re = new Float64Array(n), im = new Float64Array(n), start = Math.floor((input.length - n) / 2);
  let sum = 0;
  for (let j = 0; j < n; j++) {
    const a = 2 * Math.PI * j / (n - 1), w = window === 'RECTANGULAR' ? 1 : window === 'HANNING' ? 0.5 - 0.5 * Math.cos(a)
      : 0.21557895 - 0.41663158 * Math.cos(a) + 0.277263158 * Math.cos(2 * a) - 0.083578947 * Math.cos(3 * a) + 0.006947368 * Math.cos(4 * a);
    re[j] = input[start + j] * w; sum += w;
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size <<= 1) for (let k = 0; k < n; k += size) for (let j = 0; j < size / 2; j++) {
    const a = -2 * Math.PI * j / size, c = Math.cos(a), s = Math.sin(a), b = k + j + size / 2;
    const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c, q = k + j;
    re[b] = re[q] - tr; im[b] = im[q] - ti; re[q] += tr; im[q] += ti;
  }
  return Float64Array.from({ length: 1024 }, (_, j) => Math.hypot(re[j], im[j]) / sum * (j ? Math.SQRT2 : 1));
}

// 週期表格平均。絕對歷史的 AC 耦合另由因果濾波計算。
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

function lowpass(p, fc) {
  if (p.kind === 'sine') {
    if (!(p.f > 0)) return p;
    return sinePath(p.a / Math.hypot(1, p.f / fc), p.m, p.f, p.d + Math.atan(p.f / fc) / (2 * Math.PI * p.f));
  }
  const v = lowpassTable(p.v, p.period, fc);
  return tablePath(v, p.period, p.ex && bwExact(p, fc));
}

// Causal one-pole convolution. Split actual history boundaries and exponential
// time scales; the periodic part is integrated from its steady-state solution.
function filteredAbsolute(at, t, fc, high = false, changes = []) {
  const tau = 1 / (2 * Math.PI * fc), span = 20 * tau, cuts = [0, span];
  for (let j = 1; j < 10; j++) cuts.push(2 * j * tau);
  for (const change of changes) { const u = t - change; if (u > 0 && u < span) cuts.push(u); }
  cuts.sort((a, b) => a - b);
  let value = Math.exp(-20) * at(t - span);
  for (let j = 1; j < cuts.length; j++) {
    const a = cuts[j - 1], b = cuts[j];
    for (const [x, w] of GL4) {
      const u = a + (x + 1) / 2 * (b - a);
      value += w * (b - a) / (2 * tau) * Math.exp(-u / tau) * at(t - u);
    }
  }
  return high ? at(t) - value : value;
}

function modalIntegral(c, lambda, a, b, t0, rate) {
  if (!(b > a) || !c) return 0;
  if (a < t0) {
    const end = Math.min(b, t0);
    const constant = c * -Math.expm1(-rate * (end - a)) * Math.exp(-rate * (b - end));
    return constant + (b > t0 ? modalIntegral(c, lambda, t0, b, t0, rate) : 0);
  }
  const d = b - a, gap = Math.abs(rate - lambda), initial = c * Math.exp(-lambda * (a - t0));
  return initial * (gap < 1e-7 * rate ? rate * d * Math.exp(-rate * d)
    : rate * Math.exp(-Math.min(rate, lambda) * d) * -Math.expm1(-gap * d) / gap);
}

function historyLowpass(signal, probe, history, fc, variableProbeCorner = false) {
  const tau = 1 / (2 * Math.PI * (variableProbeCorner ? 1 : fc));
  const parts = history.map((h) => {
    const px = h.probe ?? probe, frequency = variableProbeCorner ? px === 10 ? 1 : 10 : fc, rate = 2 * Math.PI * frequency;
    const raw = tablePath(Float64Array.from(h.table, (v) => v / px), h.period, (t) => h.at(t) / px);
    return { ...h, probe: px, rate, lp: h.period / h.table.length > 1 / (2 * rate) ? bwExact(raw, frequency) : lerpTable(lowpassTable(raw.v, h.period, frequency), h.period) };
  });
  return (t) => {
    const start = t - 20 * tau;
    let value = signal.abs(start) / (signal.probeAt?.(start) ?? probe), cursor = start;
    for (const h of parts) {
      const a = Math.max(cursor, h.from), b = Math.min(t, h.to);
      if (!(b > a)) continue;
      const rate = h.rate, localTau = 1 / rate, decay = Math.exp(-rate * (b - a));
      if (!h.actual) {
        let integral = h.lp(b) - decay * h.lp(a);
        for (let j = 0; j < h.lam.length; j++) integral += modalIntegral(h.coeff[j] / h.probe, h.lam[j], a, b, h.t0, rate);
        value = decay * value + integral;
      } else {
        // CC and nonlinear protection use their stable physical voltage rather
        // than subtracting enormous steady/modal quantities that cancel.
        const cuts = [a, b];
        for (let j = 1; j <= 10; j++) { const q = b - 2 * j * localTau; if (q > a) cuts.push(q); }
        for (const lambda of h.lam) for (const q of [.25, .5, 1, 2, 4, 8, 16, 32]) {
          const time = h.t0 + q / lambda; if (time > a && time < b) cuts.push(time);
        }
        cuts.sort((x, y) => x - y);
        let integral = h.periodic ? h.lp(b) - decay * h.lp(a) : 0;
        for (let j = 1; j < cuts.length; j++) for (const [x, w] of GL4) {
          const half = (cuts[j] - cuts[j - 1]) / 2, q = cuts[j - 1] + (x + 1) * half;
          integral += w * half * rate * Math.exp(-rate * (b - q)) * (h.abs(q) - (h.periodic ? h.at(q) : 0)) / h.probe;
        }
        value = decay * value + integral;
      }
      cursor = b;
      if (cursor >= t) break;
    }
    return value;
  };
}

// Constant-rate transfer functions with at most three first-order poles.
// Repeated AC poles use a coherent periodic/history LP2 kernel, not sampled
// convolution of a high-frequency carrier.
function filterTransfer(filters, raw, make) {
  const poles = filters.map((f) => 2 * Math.PI * f.fc), zeros = filters.filter((f) => f.high).length;
  const constant = filters.filter((f) => !f.high).reduce((v, f) => v * 2 * Math.PI * f.fc, 1);
  const direct = zeros === poles.length ? 1 : 0;
  if (new Set(poles).size === poles.length) {
    const terms = poles.map((rate, j) => ({ coeff: constant * (-rate) ** zeros
      / poles.reduce((v, r, k) => k === j ? v : v * (r - rate), 1) / rate, lp: make(rate) }));
    return (t) => direct * raw(t) + terms.reduce((v, q) => v + q.coeff * q.lp(t), 0);
  }
  const a = poles.find((r, j) => poles.indexOf(r) !== j), b = poles.find((r) => r !== a), delta = a * .01;
  const lp = make(a), plus = make(a + delta), minus = make(a - delta), plus2 = make(a + 2 * delta), minus2 = make(a - 2 * delta);
  const twice = (t) => lp(t) - a * (-plus2(t) + 8 * plus(t) - 8 * minus(t) + minus2(t)) / (12 * delta);
  const numerator = constant * (-a) ** zeros, derivative = zeros ? constant * zeros * (-a) ** (zeros - 1) : 0;
  const second = numerator / (b == null ? 1 : b - a) / (a * a);
  const first = (b == null ? derivative : (derivative * (b - a) - numerator) / (b - a) ** 2) / a;
  const other = b == null ? null : make(b), otherCoeff = b == null ? 0 : constant * (-b) ** zeros / (a - b) ** 2 / b;
  return (t) => direct * raw(t) + first * lp(t) + second * twice(t) + (other ? otherCoeff * other(t) : 0);
}

// Scale-and-square Taylor matrix exponential for the <=3 internal low-pass
// states. The scaled matrix norm is <=1/2, so 18 terms are below double-precision
// rounding. This retains filter capacitor states when a physical probe changes
// the channel AC corner, including repeated 10 Hz and BW/trigger combinations.
function advanceFilterState(matrix, value, elapsed) {
  if (!(elapsed > 0) || value.every((v) => v === 0)) return value;
  const n = value.length, norm = Math.max(...matrix.map((r) => r.reduce((v, x) => v + Math.abs(x), 0))) * elapsed;
  const count = Math.max(0, Math.ceil(Math.log2(norm * 2))), factor = elapsed / 2 ** count;
  const multiply = (a, b) => a.map((r) => Array.from({ length: n }, (_, j) => r.reduce((v, x, k) => v + x * b[k][j], 0)));
  const scaled = matrix.map((r) => r.map((v) => v * factor));
  let term = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j))), result = term.map((r) => [...r]);
  for (let k = 1; k <= 18; k++) { term = multiply(term, scaled).map((r) => r.map((v) => v / k)); result = result.map((r, i) => r.map((v, j) => v + term[i][j])); }
  for (let k = 0; k < count; k++) result = multiply(result, result);
  return result.map((r) => r.reduce((v, x, j) => v + x * value[j], 0));
}

function switchedAcPath(filters, raw, make, history, probe) {
  const cache = new Map();
  const context = (px) => {
    const corner = px === 10 ? 1 : 10;
    if (cache.has(corner)) return cache.get(corner);
    const stages = filters.map((f, j) => j === 0 ? { ...f, fc: corner } : f), n = stages.length;
    const states = stages.map((f, j) => filterTransfer(stages.slice(0, j + 1).map((q, k) => k === j ? { ...q, high: false } : q), raw, make));
    let output = Array(n).fill(0); const matrix = [];
    for (let j = 0; j < n; j++) {
      const rate = 2 * Math.PI * stages[j].fc;
      matrix[j] = output.map((v, k) => k === j ? -rate : rate * v);
      if (stages[j].high) output[j] = -1;
      else { output = Array(n).fill(0); output[j] = 1; }
    }
    const value = { states, matrix, output, direct: stages.every((f) => f.high) ? 1 : 0 };
    cache.set(corner, value); return value;
  };
  const changes = [];
  let previous = context(history[0]?.probe ?? probe), priorDelta = Array(filters.length).fill(0), previousTime = -Infinity;
  for (const h of history) {
    const next = context(h.probe ?? probe), time = h.from;
    if (next === previous || !Number.isFinite(time)) continue;
    const carried = advanceFilterState(previous.matrix, priorDelta, time - previousTime);
    const delta = previous.states.map((at, j) => at(time) + carried[j] - next.states[j](time));
    changes.push({ time, context: next, delta }); previous = next; priorDelta = delta; previousTime = time;
  }
  const initial = context(history[0]?.probe ?? probe);
  return (t) => {
    const change = changes.findLast((q) => q.time <= t), ctx = change?.context ?? initial;
    const carried = change ? advanceFilterState(ctx.matrix, change.delta, t - change.time) : Array(filters.length).fill(0);
    return ctx.direct * raw(t) + ctx.states.reduce((v, at, j) => v + ctx.output[j] * (at(t) + carried[j]), 0);
  };
}

// BW Limit：一階低通 fc＝20 MHz（手冊只寫會濾掉高頻雜訊，響應形狀未載，PD 近似）。
//   正弦：解析的增益與相位落後。表格：取樣間隔 h ≤ τ/2 才對表格做週期穩態低通（輸出在 τ 尺度上平滑，之後用表格內插、
//   不再用精確解）；h 更粗時對精確解在邊緣切段積分，仍保留20MHz圓化。
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
      '量測：Measure → 按 OPT1–5 選一格 → Source／Type（也可轉多功能旋鈕）→ Back。支援 16 種量測；Phase／Delay 需要兩通道都有顯示且採到完整週期，Cursor RMS 需要 Time 游標界定區間。',
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
    this.savedSetups ??= Array(10).fill(null);
    this.references ??= [null, null];
    this.limitMasks ??= [null, null];
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
    this.extended = extendedDefaults();
    this.avgState = null;
    this.persistence = [];
    this.persistPixels = new Set();
    this.lastTriggerAt = null;
    this.pendingAcquisition = null;
    this.lastRecordEndAt = null;
    this.lastRecordPublishedAt = null;
    this.lastRecordKey = null;
    this.pulseStartedAt = null;
    this.trigView = false;
    this.mathTarget = 'mathpos';
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
    this.autoOption = 0;
    this.utilityPage = 0;
    this.limitStats = { tested: 0, passed: 0, failed: 0, result: null };
    this.limitStarted = null; this.limitViolation = null;
    this.loggingRows = []; this.loggingStarted = null; this.loggingDropped = 0;
    this.undo = null;
    this.autoRangeUndo = null;
  }

  isOn() { return this.on; }
  get sdiv() { return SDIV[this.extended.horizontal.view === 'WINDOW' ? this.extended.horizontal.windowIdx : this.sIdx]; }
  get mainSdiv() { return SDIV[this.sIdx]; }
  get viewPosition() { return this.extended.horizontal.view === 'WINDOW' ? this.extended.horizontal.windowPos : this.mpos; }
  normalizeWindow() {
    const h = this.extended.horizontal;
    h.windowIdx = Math.min(h.windowIdx, this.sIdx);
    const range = 5 * (this.mainSdiv - SDIV[h.windowIdx]);
    h.windowPos = clamp(h.windowPos, this.mpos - range, this.mpos + range);
  }
  base(i) { return this.extended.fineScale[i] ?? VDIV[this.ch[i].vIdx]; } // BNC 伏特／格
  vdiv(i) { return this.base(i) * this.ch[i].probe; } // 顯示的 V/div
  levelV() { return this.trig.level * this.ch[this.trig.src].probe; } // 顯示的觸發位準
  posLimit(i, b = this.base(i)) { return (b <= 0.2 + 1e-12 ? 1.8 : 45) / b; } // 以格數表示（GAP-TDS-11）；b 可供 AutoSet 檢查候選檔位
  isScan() { return this.extended.display.format !== 'XY' && this.run === 'run' && this.trig.mode === 'AUTO' && this.sdiv >= 0.1 - 1e-12; }
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

  absolutePath(i, { trigger = false } = {}) {
    const c = this.ch[i], s = this.fx.sig[i], probe = this.fx.probe[i];
    if (!s?.abs || c.coupling === 'GND') return () => 0;
    const raw = (t) => { const actual = this.fx.now != null ? Math.min(t, this.fx.now) : t; return s.abs(actual) / (s.probeAt?.(actual) ?? probe); };
    const filters = [];
    if (c.coupling === 'AC') filters.push({ fc: probe === 10 ? 1 : 10, high: true });
    if (c.bw) filters.push({ fc: BW_FC, high: false });
    if (trigger && ['AC', 'HF', 'LF'].includes(this.trig.coup)) filters.push({
      fc: this.trig.coup === 'AC' ? 10 : this.trig.coup === 'HF' ? 80e3 : 300e3, high: this.trig.coup !== 'HF' });
    if (!filters.length) return raw;
    const history = s.history?.(-Infinity, this.fx.now ?? Infinity);
    const changes = history?.flatMap((h) => [h.from, h.to]).filter(Number.isFinite) ?? [this.fx.changedAt].filter(Number.isFinite);
    if (filters.length === 1 && c.coupling === 'AC' && history?.length) {
      const lp = historyLowpass(s, probe, history, probe === 10 ? 1 : 10, true);
      return (t) => raw(t) - lp(t);
    }
    const cache = new Map();
    const make = (rate) => {
      if (!cache.has(rate)) cache.set(rate, history?.length ? historyLowpass(s, probe, history, rate / (2 * Math.PI))
        : (t) => filteredAbsolute(raw, t, rate / (2 * Math.PI), false, changes));
      return cache.get(rate);
    };
    if (c.coupling === 'AC' && history?.some((h) => (h.probe ?? probe) !== probe)) return switchedAcPath(filters, raw, make, history, probe);
    return filterTransfer(filters, raw, make);
  }

  absoluteBounds(i, a, b, { trigger = false } = {}) {
    const s = this.fx.sig[i], c = this.ch[i];
    if (!s?.transientRange) return [-Infinity, Infinity, Infinity];
    if (c.coupling === 'GND') return [0, 0, 0];
    this.absoluteBoundsCache ??= new WeakMap();
    let cached = this.absoluteBoundsCache.get(s);
    if (!cached) {
      let low = Infinity, high = -Infinity;
      for (const v of s.table ?? []) { low = Math.min(low, v); high = Math.max(high, v); }
      cached = { low, high, history: s.history?.(-Infinity, this.fx.now ?? Infinity) };
      this.absoluteBoundsCache.set(s, cached);
    }
    const { low, high } = cached;
    if (!Number.isFinite(low + high)) return [-Infinity, Infinity, Infinity];
    const input = (x, y) => {
      const probes = cached.history?.filter((h) => h.from <= y && h.to >= x).map((h) => h.probe ?? this.fx.probe[i])
        ?? [s.probeAt?.(x) ?? this.fx.probe[i], s.probeAt?.(y) ?? this.fx.probe[i]];
      const minimum = Math.min(...probes), maximum = Math.max(...probes);
      const [lo, hi] = s.transientRange(x, y), values = [(low + lo) / minimum, (low + lo) / maximum, (high + hi) / minimum, (high + hi) / maximum];
      const parts = cached.history?.filter((h) => h.from < y && h.to > x);
      let derivative = parts?.length ? 0 : Infinity;
      for (const h of parts ?? []) {
        if (h.steadyConstant !== true || h.actual || (h.from > x && h.from < y)) { derivative = Infinity; break; }
        derivative = Math.max(derivative, h.lam.reduce((v, lambda, j) => v + Math.abs(h.coeff[j] ?? 0) * lambda * Math.exp(-lambda * Math.max(0, x - h.t0)), 0) / (h.probe ?? this.fx.probe[i]));
      }
      return [Math.min(...values), Math.max(...values), derivative];
    };
    const filters = [];
    if (c.coupling === 'AC') filters.push({ fc: 1, maxFc: 10, high: true });
    if (c.bw) filters.push({ fc: BW_FC, high: false });
    if (trigger && ['AC', 'HF', 'LF'].includes(this.trig.coup)) filters.push({ fc: this.trig.coup === 'AC' ? 10 : this.trig.coup === 'HF' ? 80e3 : 300e3, high: this.trig.coup !== 'HF' });
    const bounds = (j, x, y) => {
      if (j < 0) return input(x, y);
      const f = filters[j], memory = bounds(j - 1, x - 20 / (2 * Math.PI * f.fc), y);
      const pad = Math.max(Math.abs(memory[0]), Math.abs(memory[1]), 1) * 1e-7;
      const speed = 2 * Math.PI * (f.maxFc ?? f.fc) * (memory[1] - memory[0] + 2 * pad);
      if (!f.high) return [memory[0] - pad, memory[1] + pad, speed];
      const current = bounds(j - 1, x, y);
      return [current[0] - memory[1] - pad, current[1] - memory[0] + pad, current[2] + speed];
    };
    return bounds(filters.length - 1, a, b);
  }

  // 觸發路徑：取自通道耦合（含 BW Limit）後的訊號（GAP-TDS-13）。觸發耦合 AC 再加一階高通 10 Hz：手冊 p.97–98
  //   「blocks DC、attenuates below 10 Hz」，一階為 PD；是觸發系統內部的耦合，不隨探棒倍率改變（PD）。只影響觸發，不改波形（p.21、TDS-F07）
  trigPath() {
    const p = this.path(this.trig.src);
    return this.trig.coup === 'AC' ? highpass(p, 10) : this.trig.coup === 'HF' ? lowpass(p, 80e3) : this.trig.coup === 'LF' ? highpass(p, 300e3) : p;
  }
  pulseMatches(width) {
    const p = this.extended.pulse;
    if (!(width >= 5e-9)) return false;
    return p.when === '=' ? Math.abs(width - p.width) <= .05 * p.width + 1e-15
      : p.when === '!=' ? Math.abs(width - p.width) > .05 * p.width + 1e-15 : p.when === '<' ? width < p.width : width > p.width;
  }

  pulseEvents() {
    const p = this.trigPath(), L = this.trig.level;
    if (!(p.f > 0 && p.a > 0 && L > p.m - p.a && L < p.m + p.a)) return [];
    const period = 1 / p.f, positive = this.extended.pulse.polarity === 'POSITIVE';
    const normalize = (t) => ((t % period) + period) % period;
    let rise, fall;
    if (p.kind === 'sine') { rise = [normalize(p.cross(L, 'R'))]; fall = [normalize(p.cross(L, 'F'))]; }
    else {
      rise = []; fall = [];
      for (let k = 0; k < p.v.length; k++) {
        const a = p.v[k], b = p.v[(k + 1) % p.v.length], up = a < L && b >= L, down = a > L && b <= L;
        if (!up && !down) continue;
        let lo = k / p.v.length * period, hi = (k + 1) / p.v.length * period;
        for (let j = 0; j < 35; j++) { const mid = (lo + hi) / 2; if (up ? p.at(mid) < L : p.at(mid) > L) lo = mid; else hi = mid; }
        (up ? rise : fall).push(normalize(hi));
      }
    }
    const starts = positive ? rise : fall, ends = positive ? fall : rise, events = [];
    starts.sort((a, b) => a - b); ends.sort((a, b) => a - b);
    for (const end of ends) {
      const before = starts.filter((q) => q < end), start = before.at(-1) ?? (starts.at(-1) == null ? null : starts.at(-1) - period);
      if (start != null && this.pulseMatches(end - start)) events.push({ start, end, width: end - start });
    }
    return events;
  }
  triggerThreshold() { const band = this.trig.coup === 'NOISE' ? Math.max(this.trigPath().a * .05, this.base(this.trig.src) / 25) : 0; return this.trig.level + (this.trig.slope === 'R' ? band : -band); }

  // Level 必須落在觸發訊號的最小值與最大值之間才有觸發事件（DC、無訊號永遠沒有）
  crosses() { if (this.extended.pulse.type === 'PULSE') return this.pulseEvents().length > 0; const p = this.trigPath(), L = this.trig.level, band = this.trig.coup === 'NOISE' ? Math.max(p.a * .05, this.base(this.trig.src) / 25) : 0; return p.a > 0 && p.f > 0 && L > p.m - p.a + band && L < p.m + p.a - band; }

  // 觸發事件的絕對時間（依 Slope 與 Level）；沒有觸發 → null
  trigTime() {
    if (this.extended.pulse.type === 'PULSE') return this.pulseEvents()[0]?.end ?? null;
    if (!this.crosses()) return null;
    return this.trigPath().cross(this.triggerThreshold(), this.trig.slope);
  }

  // 觸發頻率讀值：停止時也照樣追蹤目前觸發源（p.112）；沒有觸發事件時不顯示（GAP-TDS-16）
  trigFreq() { if (this.extended.display.format === 'XY' || this.fx.sig[this.trig.src]?.noise) return null; const p = this.trigPath(), count = this.extended.pulse.type === 'PULSE' ? this.pulseEvents().length : this.crosses() ? 1 : 0; return count && p.f >= 10 ? p.f * count : null; }

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
  //   紀錄裡看得到充放電的曲線；絕對歷史經因果通道與觸發濾波，不會讀取現在之後的样本。
  //   scan：abs0 已對好（紀錄結束在「看的時刻」），未觸發也不加隨機相位。
  acquire(tau, abs0 = null, { force = false, scan = false, absolute = false, sampleT0 = null } = {}) {
    const triggered = tau != null;
    if (!triggered) tau = this.rand();
    // 未觸發：週期訊號的起點落在「看的時刻」之後一個週期內的隨機相位（與週期路徑同一個亂數），不會跑到未來或過去很遠
    const anchor = (p) => {
      if (abs0 == null || triggered || scan || absolute || !(p.f > 0)) return abs0;
      const P = 1 / p.f;
      return abs0 + ((((tau - abs0) % P) + P) % P);
    };
    const xy = this.extended.display.format === 'XY';
    const dt = xy ? 1e-6 : this.sdiv / PTS_DIV, t0 = sampleT0 ?? (xy ? 0 : this.viewPosition - 5 * this.sdiv + this.rand() * dt);
    const peak = !xy && !scan && this.extended.acquire === 'PEAK' && this.sdiv >= 5e-3;
    const fe = [null, null], clip = [false, false];
    const v = this.ch.map((c, i) => {
      if (!c.on) return null; // 只採顯示中的通道
      const base = this.base(i), lo = (-5 - c.pos) * base, hi = (5 - c.pos) * base;
      const p = this.path(i), arr = new Float64Array(N), s = this.fx.sig?.[i];
      const useAbs = abs0 != null && s?.abs && (force || (c.coupling === 'DC' && !c.bw)), a0 = useAbs ? anchor(p) : 0;

      fe[i] = { base, pos: c.pos, probe: c.probe, coupling: c.coupling, bw: c.bw };
      const at = useAbs ? this.absolutePath(i) : p.at;
      for (let k = 0; k < N; k++) {
        const t = (useAbs ? a0 : tau) + t0 + k * dt;
        const bounds = peak ? peakRange(p, t - (k % 2) * dt, t + (2 - k % 2) * dt, at) : null;
        const y = bounds ? bounds[k % 2] : at(t);
        if (y > hi || y < lo) clip[i] = true;
        arr[k] = clamp(y, lo, hi);
      }
      return arr;
    });
    return { n: ++this.acqN, t0, dt, v, fe, clip, triggered: xy ? false : triggered, broken: false, abs0,
      ...(abs0 != null ? { endAt: abs0 + t0 + (peak ? N : N - 1) * dt } : {}),
      ...(this.fx.sig.some((s) => s?.noise) ? { noise: this.fx.sig.map((s) => !!s?.noise) } : {}),
      ...(peak ? { mode: 'PEAK' } : {}) };
  }

  clearAcquisition() { this.avgState = null; this.persistence = []; this.persistPixels = new Set(); }

  resetTemporalAcquisition() {
    this.pendingAcquisition = null; this.lastRecordEndAt = null; this.lastRecordPublishedAt = null; this.lastRecordKey = null;
    this.changeSearch = null; this.pulseStartedAt = null; this.armedAt = null; this.lastTriggerAt = null;
  }

  acquisitionKey() {
    return JSON.stringify([this.ch, this.extended.fineScale, this.sIdx, this.viewPosition,
      this.extended.horizontal.view, this.extended.horizontal.windowIdx, this.extended.display.format,
      this.extended.acquire, this.extended.averages, this.trig,
      [this.extended.pulse.type, this.extended.pulse.when, this.extended.pulse.width, this.extended.pulse.polarity]]);
  }

  queueAcquisition(triggerAt) {
    const dt = this.sdiv / PTS_DIV, t0 = this.viewPosition - 5 * this.sdiv + this.rand() * dt;
    const peak = this.extended.acquire === 'PEAK' && this.sdiv >= 5e-3;
    const endAt = triggerAt + t0 + (peak ? N : N - 1) * dt;
    this.pendingAcquisition = { triggerAt, endAt, t0, key: this.acquisitionKey(), sig: this.fx.sig };
    this.lastTriggerAt = triggerAt;
    return this.finishPendingAcquisition();
  }

  finishPendingAcquisition() {
    const pending = this.pendingAcquisition;
    if (!pending) return false;
    if (pending.key !== this.acquisitionKey()) {
      this.pendingAcquisition = null; this.changeSearch = null; this.pulseStartedAt = null;
      this.lastRecordEndAt = null; this.lastRecordPublishedAt = null;
      if (this.run === 'single') this.armedAt = this.fx.now;
      return false;
    }
    if (!(this.fx.now >= pending.endAt)) return false;
    this.pendingAcquisition = null;
    // Retain the historical absolute reader when a tip is disconnected during
    // the post-trigger interval. That reader follows Bench's actual lead map.
    const fx = this.fx;
    this.fx = { ...fx, sig: fx.sig.map((s, i) => s ?? pending.sig[i]) };
    try { this.publish(this.acquire(0, pending.triggerAt, { force: true, absolute: true, sampleT0: pending.t0 })); }
    finally { this.fx = fx; }
    this.lastRecordEndAt = Math.max(pending.triggerAt, pending.endAt);
    this.lastRecordPublishedAt = this.fx.now;
    this.lastRecordKey = pending.key;
    if (this.changeSearch) this.changeSearch.cursor = Math.max(this.changeSearch.cursor, this.lastRecordEndAt);
    this.frames = null;
    if (this.run === 'single' && this.sequenceDone()) { this.run = 'stop'; this.complete = true; this.armedAt = null; }
    return true;
  }

  // Free-running/XY/Scan captures have already completed at the current time.
  // A steady preview's tView may be later than now and is never an acquisition.
  acquireHistory({ scan = false } = {}) {
    const now = this.fx.now;
    if (now == null) return this.acquire(null, null, { scan });
    const xy = this.extended.display.format === 'XY', dt = xy ? 1e-6 : this.sdiv / PTS_DIV;
    const t0 = xy ? 0 : this.viewPosition - 5 * this.sdiv + this.rand() * dt;
    const peak = !xy && !scan && this.extended.acquire === 'PEAK' && this.sdiv >= 5e-3;
    const anchor = now - t0 - (peak ? N : N - 1) * dt;
    return this.acquire(null, anchor, { force: true, absolute: true, scan, sampleT0: t0 });
  }

  autoHistory() {
    if (this.run !== 'run' || this.trig.mode !== 'AUTO') return;
    // GAP-TDS-06: after publishing a completed trigger, wait two record
    // durations (at least 50 ms) before free-running. A bounded poll can
    // publish older history; sample endAt is not the start of this new wait.
    // Only a completed trigger resets it, never a Cursor/menu interaction.
    const timeout = Math.max(20 * this.sdiv, .05);
    if (this.lastRecordPublishedAt != null && this.lastRecordKey === this.acquisitionKey() && this.fx.now < this.lastRecordPublishedAt + timeout) return;
    this.publish(this.acquireHistory());
  }

  horizontalSoft(j) {
    const h = this.extended.horizontal;
    if (this.extended.display.format === 'XY') return { kind: 'info', text: 'XY 不使用時基與觸發 Holdoff。' };
    if (j < 3) { h.view = ['MAIN', 'ZONE', 'WINDOW'][j]; h.holdoffSelected = false; }
    if (j === 3) h.holdoffSelected = true;
    this.normalizeWindow(); this.clearAcquisition();
    return { kind: 'approx', text: h.holdoffSelected
      ? 'Holdoff：旋鈕以目前時基1/25格為步幅（近似），限制下一次實際觸發的最短間隔；0表示最小，非硬體固定最小時間。'
      : 'Window Zone用水平Scale與Position界定主紀錄的區域；Window展開該區域，停止時只縮放既有取樣。' };
  }

  setTrigView(active) {
    if (!this.on || this.extended.display.format === 'XY') active = false;
    this.trigView = !!active;
    return { kind: 'approx', text: active ? '按住 Trig View：顯示觸發耦合後的波形；除Print外其他按鍵停用，旋鈕仍有效。' : 'Trig View放開，回到通道波形。' };
  }

  triggerViewRecord() {
    if (!this.trigView || !this.rec) return null;
    const r = this.rec, i = this.trig.src, p = this.trigPath(), tau = this.trigTime() ?? 0;
    const absolute = r.abs0 != null && this.fx.sig[i]?.abs;
    const at = absolute ? this.absolutePath(i, { trigger: true }) : p.at;
    const anchor = absolute ? (this.fx.now ?? r.abs0) - r.t0 - (N - 1) * r.dt : tau;
    const value = Float64Array.from({ length: N }, (_, k) => at(anchor + r.t0 + k * r.dt));
    return { ...r, v: [i === 0 ? value : null, i === 1 ? value : null], broken: false };
  }

  // Average combines distinct acquired records after alignment to their trigger.
  // It does not fabricate noise or future triggers. Single remains armed until N records arrive.
  publish(r) {
    if (this.extended.acquire === 'AVERAGE' && this.extended.display.format === 'YT' && !this.isScan()) {
      const key = JSON.stringify([this.scen, this.ch, this.extended.fineScale, this.trig, this.sIdx, this.viewPosition, this.extended.horizontal.windowIdx, this.extended.horizontal.view, this.extended.pulse.type, this.extended.pulse.when, this.extended.pulse.width, this.extended.pulse.polarity, this.extended.averages, this.fx.changedAt]);
      let a = this.avgState;
      if (!a || a.key !== key || a.count >= this.extended.averages) this.avgState = a = { key, count: 0, rec: clone(r), lastAbs: null };
      if (r.abs0 != null && a.lastAbs === r.abs0) return this.rec;
      a.lastAbs = r.abs0;
      a.count++;
      if (a.count > 1) for (let i = 0; i < 2; i++) {
        const target = a.rec.v[i], src = r.v[i];
        if (!target || !src) continue;
        for (let k = 0; k < target.length; k++) {
          const u = clamp((a.rec.t0 + k * a.rec.dt - r.t0) / r.dt, 0, src.length - 1), j = Math.floor(u);
          const val = src[j] + (src[Math.min(j + 1, src.length - 1)] - src[j]) * (u - j);
          target[k] += (val - target[k]) / a.count;
        }
        a.rec.clip[i] ||= r.clip[i];
      }
      a.rec.n = r.n;
      r = clone(a.rec); r.mode = 'AVERAGE'; r.averageCount = a.count;
    }
    const persist = this.extended.display.persist;
    const now = this.displayNow();
    if (persist && this.rec && this.rec !== r) {
      if (persist === 'INFINITE') this.rememberPixels(this.rec);
      else this.persistence.push({ rec: this.rec, at: now });
    }
    this.persistence = this.persistence.filter((x) => now - x.at <= persist);
    this.rec = r;
    if (!(r.mode === 'AVERAGE' && r.averageCount < this.extended.averages)) this.processRecord(r);
    return r;
  }

  recordSource(source, r = this.rec) {
    if (!r || this.extended.display.format !== 'YT') return null;
    if (source === 2) { const v = this.mathRecord(r); return v && { v, unit: this.extended.math.op === '×' ? 'VV' : 'V', scale: this.extended.math.scale, pos: this.extended.math.pos }; }
    if (!this.ch[source].on || !r.v[source]) return null;
    return { v: Float64Array.from(r.v[source], (v) => v * this.ch[source].probe * (this.extended.invert[source] ? -1 : 1)), unit: 'V', scale: this.vdiv(source), pos: this.ch[source].pos };
  }

  applyLimitTemplate() {
    const q = this.extended.limit, r = this.rec, src = this.recordSource(q.templateSource);
    if (!src) return { kind: 'info', text: 'Template Source 必須有顯示中的時域採集，Math FFT不能當時域模板。' };
    const radius = Math.ceil(q.hTolerance * this.sdiv / r.dt), vertical = q.vTolerance * src.scale;
    const lower = new Float64Array(N), upper = new Float64Array(N);
    for (let k = 0; k < N; k++) {
      let lo = Infinity, hi = -Infinity;
      for (let j = Math.max(0, k - radius); j <= Math.min(N - 1, k + radius); j++) { lo = Math.min(lo, src.v[j]); hi = Math.max(hi, src.v[j]); }
      lower[k] = lo - vertical; upper[k] = hi + vertical;
    }
    this.limitMasks[q.destination] = { lower, upper, t0: r.t0, dt: r.dt, sdiv: this.sdiv, mpos: this.viewPosition, scale: src.scale, unit: src.unit };
    q.compare = q.destination;
    return { kind: 'approx', text: `已建立 Ref${q.destination ? 'B' : 'A'} 的 Limit 模板，垂直±${q.vTolerance}格、水平±${q.hTolerance}格；由目前2500點膨脹界線（教學近似），隨實驗存檔保存。` };
  }

  processRecord(r) {
    const q = this.extended.limit, log = this.extended.logging, now = this.displayNow();
    if (q.on) {
      const mask = this.limitMasks[q.compare], src = this.recordSource(q.source, r);
      if (!mask || !src || src.unit !== mask.unit) { this.limitStats.result = 'NO SOURCE'; }
      else {
        let pass = true;
        for (let k = 0; k < N && pass; k++) {
          const u = (r.t0 + k * r.dt - mask.t0) / mask.dt;
          if (u < -1 || u > N) { pass = false; break; }
          const x = clamp(u, 0, N - 1), a = Math.floor(x), b = Math.min(N - 1, a + 1), mix = x - a;
          const lo = mask.lower[a] + (mask.lower[b] - mask.lower[a]) * mix, hi = mask.upper[a] + (mask.upper[b] - mask.upper[a]) * mix;
          if (!Number.isFinite(src.v[k]) || src.v[k] < lo - 1e-12 || src.v[k] > hi + 1e-12) pass = false;
        }
        this.limitStats.tested++; this.limitStats[pass ? 'passed' : 'failed']++; this.limitStats.result = pass ? 'PASS' : 'FAIL';
        if (!pass && q.action !== 'NONE') this.limitViolation = q.action === 'SAVE_IMAGE' ? { name: 'TDS2001C-limit-fail.svg', mime: 'image/svg+xml', text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">${this.lcd()}</svg>` }
          : this.waveCsv(r, src, 'TDS2001C-limit-fail.csv');
        if ((q.stop === 'WAVEFORMS' && this.limitStats.tested >= q.count) || (q.stop === 'VIOLATIONS' && this.limitStats.failed >= q.count)) { q.on = false; this.msg = 'Limit test completed'; }
      }
    }
    if (log.on && r.triggered && (r.abs0 == null || this.fx.now == null || r.abs0 <= this.fx.now + 1e-12)) {
      const src = this.recordSource(log.source, r);
      if (src) {
        let min = Infinity, max = -Infinity, sum = 0, square = 0;
        for (const v of src.v) { min = Math.min(min, v); max = Math.max(max, v); sum += v; square += v * v; }
        this.loggingRows.push({ n: r.n, time: r.abs0 ?? now, elapsed: Math.max(0, now - this.loggingStarted), source: log.source, unit: src.unit, min, max, mean: sum / N, rms: Math.sqrt(square / N) });
        if (this.loggingRows.length > 2000) { this.loggingRows.shift(); this.loggingDropped++; }
        this.msg = 'Data Logging';
      }
    }
  }

  updateTimedFeatures() {
    const q = this.extended.limit, log = this.extended.logging, now = this.displayNow();
    if (q.on && q.stop === 'TIME' && this.limitStarted != null && now - this.limitStarted >= q.seconds) { q.on = false; this.msg = 'Limit test completed'; }
    if (log.on && log.duration !== 'INFINITE' && this.loggingStarted != null && now - this.loggingStarted >= log.duration) { log.on = false; this.msg = 'Data logging completed'; }
  }

  waveCsv(r, src, name) {
    const rows = [`Time(s),Amplitude(${src.unit})`];
    for (let k = 0; k < src.v.length; k++) rows.push(`${r.t0 + k * r.dt},${src.v[k]}`);
    return { name, mime: 'text/csv', text: rows.join('\n') + '\n' };
  }

  limitSoft(j) {
    const q = this.extended.limit;
    if (q.page === 0) {
      if (j === 0) q.source = (q.source + 1) % 3;
      if (j === 1) q.compare = 1 - q.compare;
      if (j === 2) {
        if (q.on) q.on = false;
        else if (!this.limitMasks[q.compare]) return { kind: 'info', text: 'Compare To 尚無模板，請先進 Template Setup，Apply Template。' };
        else { q.on = true; this.limitStarted = this.displayNow(); this.limitStats = { tested: 0, passed: 0, failed: 0, result: null }; this.limitViolation = null; }
      }
      if (j === 3) this.menu = 'LIMIT_TEMPLATE';
    } else {
      if (j === 0) this.menu = 'LIMIT_ACTION';
      if (j === 1) this.menu = 'LIMIT_STOP';
      if (j === 2) q.show = !q.show;
      if (j === 3) this.menu = 'UTILITY';
    }
    if (j === 4) q.page = 1 - q.page;
    return { kind: 'approx', text: 'Limit Test逐筆比較2500點採集與已保存模板。容差以格數建立界線；統計與違規下載保留本次開頁，非實體USB。' };
  }

  loggingSoft(j) {
    const log = this.extended.logging;
    if (j === 0) {
      log.on = !log.on;
      if (log.on) { this.loggingStarted = this.displayNow(); this.loggingRows = []; this.loggingDropped = 0; this.changeSearch = null; this.pulseStartedAt = null; this.msg = 'Data Logging - Waiting for trigger'; }
    }
    if (j === 1) log.source = (log.source + 1) % 3;
    if (j === 2) this.stepLoggingDuration(1);
    if (j === 3) {
      const rows = ['Record,Timestamp(s),Elapsed(s),Source,Unit,Min,Max,Mean,RMS'];
      for (const r of this.loggingRows) rows.push(`${r.n},${r.time},${r.elapsed},${['CH1', 'CH2', 'Math'][r.source]},${r.unit},${r.min},${r.max},${r.mean},${r.rms}`);
      return { kind: 'approx', text: `下載${this.loggingRows.length}筆採集摘要CSV；保留最近2000筆，較早${this.loggingDropped}筆已移除。沒有USB硬體传输；日志不隨實驗保存。`, download: { name: 'TDS2001C-data-log.csv', mime: 'text/csv', text: rows.join('\n') + '\n' } };
    }
    if (j === 4) this.menu = 'UTILITY';
    return { kind: 'approx', text: 'Data Logging只記錄已觸發、已完成的採集，輸出時間、Min/Max/Mean/RMS摘要。保留最近2000筆，透過瀏覽器下載CSV；非完整原廠USB波形日志。' };
  }

  stepLoggingDuration(dir) {
    const options = [...Array.from({ length: 16 }, (_, k) => (k + 1) * 1800), ...Array.from({ length: 16 }, (_, k) => (k + 9) * 3600), 'INFINITE'];
    this.extended.logging.duration = options[(options.indexOf(this.extended.logging.duration) + dir + options.length) % options.length];
  }

  displayNow() { return this.fx?.now ?? performance.now() / 1000; }
  sequenceDone() { return this.extended.acquire !== 'AVERAGE' || this.extended.display.format === 'XY' || (this.avgState?.count ?? 0) >= this.extended.averages; }

  rememberPixels(r) {
    this.persistPixels ??= new Set();
    const xy = this.extended.display.format === 'XY';
    for (let i = 0; i < (xy ? 1 : 2); i++) {
      if (!r.v[i] || !this.ch[i].on || (xy && (!r.v[1] || !this.ch[1].on))) continue;
      for (let k = 0; k < N; k++) {
        const x = xy ? 135 + 25 * (this.ch[0].pos + r.v[0][k] / this.base(0) * (this.extended.invert[0] ? -1 : 1))
          : 10 + (r.t0 + k * r.dt - this.viewPosition + 5 * this.sdiv) / this.sdiv * 25;
        const ch = xy ? 1 : i, y = 116 - 25 * (this.ch[ch].pos + r.v[ch][k] / this.base(ch) * (this.extended.invert[ch] ? -1 : 1));
        if (x >= 10 && x <= 260 && y >= 16 && y <= 216) this.persistPixels.add(`${xy ? 1 : i},${Math.round(x)},${Math.round(y)}`);
      }
    }
  }

  acquireSoft(j) {
    if (j < 3) this.extended.acquire = ['SAMPLE', 'PEAK', 'AVERAGE'][j];
    else if (j === 3) { const n = [4, 16, 64, 128]; this.extended.averages = n[(n.indexOf(this.extended.averages) + 1) % n.length]; }
    else return null;
    this.clearAcquisition();
    return { kind: 'approx', text: this.extended.acquire === 'PEAK'
      ? 'Peak Detect：5 ms/div 或更慢取每區間最高與最低電壓；2.5 ms/div 或更快依手冊改用 Sample。峰值以模擬訊號極值計算，未承諾實機 10 ns 偵測規格。'
      : this.extended.acquire === 'AVERAGE' ? `Average：累積 ${this.extended.averages} 筆觸發對齊的 Sample；Single 達到筆數才停止。` : 'Sample：每筆採集 2500 點。' };
  }

  displaySoft(j) {
    const d = this.extended.display;
    if (j === 0) d.type = d.type === 'VECTORS' ? 'DOTS' : 'VECTORS';
    else if (j === 1) { const n = [0, 1, 2, 5, 'INFINITE']; d.persist = n[(n.indexOf(d.persist) + 1) % n.length]; }
    else if (j === 2) d.format = d.format === 'YT' ? 'XY' : 'YT';
    else return null;
    if (d.format === 'XY' || d.persist) this.deactivateAutoRange();
    this.clearAcquisition();
    return { kind: 'approx', text: d.format === 'XY'
      ? 'XY：CH1 為橫軸、CH2 為縱軸；執行時固定 1 MS/s、未觸發 Sample 點；停止後改 XY 會顯示既有紀錄。自動量測、游標、Math 與 Ref 在 XY 不顯示。'
      : 'Display：點／向量與餘暉只改顯示，量測仍來自目前採集。餘暉時間使用模擬時鐘；Infinite 在操作控制項後清除。' };
  }

  mathSoft(j) {
    const m = this.extended.math;
    if (j === 0) { const ops = ['+', '-', '×', 'FFT']; m.op = ops[(ops.indexOf(m.op) + 1) % ops.length]; }
    if (m.op === 'FFT') {
      const f = this.extended.fft;
      if (j === 1) f.source = 1 - f.source;
      if (j === 3) { const w = ['HANNING', 'FLATTOP', 'RECTANGULAR']; f.window = w[(w.indexOf(f.window) + 1) % w.length]; }
      if (j === 4) { const z = [1, 2, 5, 10]; f.zoom = z[(z.indexOf(f.zoom) + 1) % z.length]; }
      return null;
    }
    if (j === 1 && m.op === '-') m.reverse = !m.reverse;
    if (j === 2) this.mathTarget = 'mathpos';
    if (j === 3) this.mathTarget = 'mathscale';
    return null;
  }

  mathRecord(r = this.rec) {
    const m = this.extended.math;
    if (!m.on || m.op === 'FFT' || this.extended.display.format === 'XY' || !r?.v[0] || !r.v[1]) return null;
    const a = r.v[0], b = r.v[1], k0 = this.ch[0].probe * (this.extended.invert[0] ? -1 : 1), k1 = this.ch[1].probe * (this.extended.invert[1] ? -1 : 1);
    return Float64Array.from(a, (x, j) => m.op === '+' ? x * k0 + b[j] * k1
      : m.op === '×' ? x * k0 * b[j] * k1 : (x * k0 - b[j] * k1) * (m.reverse ? -1 : 1));
  }

  mathStats() {
    const a = this.mathRecord();
    if (!a) return null;
    let min = Infinity, max = -Infinity, mean = 0;
    for (const v of a) { min = Math.min(min, v); max = Math.max(max, v); mean += v / a.length; }
    return { min, max, mean };
  }

  fftRecord() {
    const f = this.extended.fft, r = this.rec;
    if (!this.extended.math.on || this.extended.math.op !== 'FFT' || this.extended.display.format === 'XY' || !r?.v[f.source]) return null;
    const key = `${f.source}:${f.window}:${this.ch[f.source].probe}`;
    if (this.fftCache?.record === r && this.fftCache.key === key) return this.fftCache.value;
    const input = Float64Array.from(r.v[f.source], (v) => v * this.ch[f.source].probe);
    const rms = fft2048(input, f.window), db = Float64Array.from(rms, (v) => 20 * Math.log10(Math.max(v, 1e-12)));
    const value = { rms, db, df: 1 / (2048 * r.dt), nyquist: 1 / (2 * r.dt), clipped: r.clip[f.source] };
    this.fftCache = { record: r, key, value }; return value;
  }

  deactivateAutoRange(axis = null) {
    const a = this.extended.autoRange;
    if (!a.on) return;
    if (axis && a.axes === 'BOTH') a.axes = axis === 'VERTICAL' ? 'HORIZONTAL' : 'VERTICAL';
    else if (!axis || a.axes === axis) a.on = false;
  }

  autoRangeKey() {
    const a = this.extended.autoRange;
    this.menu = 'AUTORANGE';
    if (a.on) { a.on = false; return null; }
    this.autoRangeUndo = this.save(); a.on = true;
    this.extended.acquire = 'SAMPLE'; this.extended.horizontal.view = 'MAIN'; this.extended.horizontal.holdoff = 0; this.extended.display.format = 'YT'; this.extended.display.persist = 0; this.extended.invert = [false, false]; this.extended.fineScale = [null, null];
    this.extended.pulse.type = 'EDGE'; this.pulseStartedAt = null; this.changeSearch = null;
    this.ch.forEach((c) => { c.coupling = 'DC'; c.bw = false; });
    this.trig.coup = 'DC'; this.run = 'run'; this.complete = false; this.clearAcquisition();
    this.trackAutoRange();
    return { kind: 'approx', text: 'AutoRange：持續追蹤目前顯示的訊號，可選兩軸／只垂直／只水平。選檔與顯示門檻為教學近似；手動改刻度會停用對應軸，改觸發、通道顯示或 Single 會停用。' };
  }

  trackAutoRange() {
    const a = this.extended.autoRange;
    if (!a.on || this.extended.display.format === 'XY') return;
    const paths = [0, 1].map((i) => this.path(i));
    for (let i = 0; i < 2; i++) if (this.ch[i].on && a.axes !== 'HORIZONTAL') {
      const p = paths[i], c = this.ch[i];
      if (!(p.a > 0 || Math.abs(p.m) > 1e-12)) continue;
      const fit = (pos) => VDIV.findIndex((v) => pos + (p.m + p.a) / v <= 4 && pos + (p.m - p.a) / v >= -4 && Math.abs(pos) <= this.posLimit(i, v));
      let k = fit(c.pos);
      if (k < 0) { c.pos = 0; k = fit(0); }
      c.vIdx = k < 0 ? VDIV.length - 1 : k; this.extended.fineScale[i] = null;
    }
    const candidates = [0, 1].filter((i) => this.ch[i].on && paths[i].f > 0);
    const src = candidates.includes(this.trig.src) ? this.trig.src : candidates[0];
    if (src != null) {
      this.trig.src = src;
      if (a.axes !== 'VERTICAL') {
        const k = SDIV.findIndex((s) => 10 * s * paths[src].f >= 2 - 1e-9);
        this.sIdx = k < 0 ? SDIV.length - 1 : k; this.mpos = 0;
      }
      this.setTo50();
    }
  }

  autoRangeSoft(j) {
    if (j === 0) return this.autoRangeKey();
    if (j >= 1 && j <= 3) { this.extended.autoRange.axes = ['BOTH', 'VERTICAL', 'HORIZONTAL'][j - 1]; return null; }
    if (j === 4 && this.autoRangeUndo) { const old = this.autoRangeUndo; this.autoRangeUndo = null; this.restore(clone(old)); this.extended.autoRange.on = false; }
    return null;
  }

  setSetupFileHandler(fn) { this.setupFileHandler = fn; }

  recallSetup(setup) {
    this.restore(clone(setup));
    this.extended = clone(setup.extended); this.extended.autoRange.on = false; this.run = setup.run; this.complete = false;
    this.extended.limit.on = false; this.extended.logging.on = false;
    this.clearAcquisition(); this.resetTemporalAcquisition();
    this.rec = null; this.frames = null;
    if (this.run === 'stop') {
      this.run = 'run';
      if (this.scen === 'BENCH') this.fx = this.benchFx();
      this.publish(this.acquireHistory()); this.run = 'stop';
    }
    else if (this.run === 'single') this.armedAt = this.scen === 'BENCH' ? this.benchFx().now ?? null : null;
    return { kind: 'info', text: '已回復示波器設定；輸入接線保持目前狀態，重新採集。' };
  }

  storeSoft(j) {
    const s = this.extended.store;
    if (j === 0) { s.action = STORE_ACTIONS[(STORE_ACTIONS.indexOf(s.action) + 1) % STORE_ACTIONS.length]; return null; }
    if (j === 1) { s.target = s.target === 'FILE' ? 'INTERNAL' : 'FILE'; return { kind: 'approx', text: 'File使用瀏覽器儲存／載入示波器設定JSON與匯出波形CSV；沒有模擬實體USB。' }; }
    if (j === 2) { if (s.action === 'SAVE_WAVEFORM') s.source = 1 - s.source; else s.setup = (s.setup + 1) % 10; return null; }
    if (j === 3 && s.action === 'SAVE_WAVEFORM') { s.ref = 1 - s.ref; return null; }
    if (j !== 4) return null;
    if (s.target === 'FILE') {
      if (s.action === 'RECALL_SETUP') {
        if (!this.setupFileHandler) return { kind: 'info', text: '此執行環境未提供檔案選擇器，設定保持原值。' };
        this.setupFileHandler(); return { kind: 'approx', text: '選擇本模擬器匯出的示波器設定JSON；檢查成功後才回復設定（非原廠SET／USB）。' };
      }
      if (s.action === 'SAVE_SETUP') return { kind: 'approx', text: '下載示波器設定JSON（瀏覽器檔案，非原廠SET／USB）。', download: { name: 'TDS2001C-setup.json', mime: 'application/json', text: JSON.stringify({ format: 'ee-ss-tds-setup-v1', state: { ...this.save(), ch: this.ch, run: this.run } }, null, 2) } };
      if (!this.ch[s.source].on || !this.rec?.v[s.source]) return { kind: 'info', text: '來源必須已顯示且有採集才能匯出CSV。' };
      const r = this.rec, factor = this.ch[s.source].probe * (this.extended.invert[s.source] ? -1 : 1), rows = ['Time(s),Voltage(V)'];
      for (let k = 0; k < r.v[s.source].length; k++) rows.push(`${r.t0 + k * r.dt},${r.v[s.source][k] * factor}`);
      return { kind: 'approx', text: '下載目前2500點採集CSV（含探棒倍率與Invert；非實體USB）。', download: { name: `TDS2001C-CH${s.source + 1}.csv`, mime: 'text/csv', text: rows.join('\n') + '\n' } };
    }
    if (s.action === 'SAVE_SETUP') {
      this.savedSetups[s.setup] = clone({ ...this.save(), ch: this.ch, run: this.run, extended: this.extended });
      return { kind: 'info', text: `已保存至示波器內部 Setup ${s.setup + 1}（隨實驗存檔保存）。` };
    }
    if (s.action === 'RECALL_SETUP') {
      const setup = this.savedSetups[s.setup];
      if (!setup) return { kind: 'info', text: `Setup ${s.setup + 1} 尚未保存，設定保持原值。` };
      this.recallSetup(setup);
      return { kind: 'info', text: `已回復 Setup ${s.setup + 1}；輸入接線保持目前狀態，重新採集。` };
    }
    if (!this.ch[s.source].on || !this.rec?.v[s.source]) return { kind: 'info', text: '來源波形必須已顯示且有採集，才能保存。' };
    this.references[s.ref] = { v: Float64Array.from(this.rec.v[s.source], (v) => v * (this.extended.invert[s.source] ? -1 : 1)),
      t0: this.rec.t0, dt: this.rec.dt, base: this.base(s.source), probe: this.ch[s.source].probe,
      pos: this.ch[s.source].pos, sdiv: this.sdiv, mpos: this.viewPosition };
    return { kind: 'info', text: `CH${s.source + 1} 波形已保存至 Ref${s.ref ? 'B' : 'A'}；按 Ref 可顯示或隱藏。` };
  }

  // 實驗台：觸發點（週期穩態的相位 tau）對到「看的時刻」之後的第一個同相位時刻
  absAnchor(tau) {
    if (this.extended.display.format === 'XY') {
      this.publish(this.acquire(null, this.fx.now ?? this.fx.tView ?? null));
      if (this.run === 'single') { this.run = 'stop'; this.complete = true; }
      return;
    }
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
  //   觸發判斷取實際歷史經通道 AC/BW 與觸發耦合後的訊號。
  captureChange() {
    if (this.pendingAcquisition) return false;
    const fx = this.fx, src = this.trig.src, s = fx.sig?.[src], c = this.ch[src];
    if (!s?.abs || c.coupling === 'GND' || fx.changedAt == null) return false;
    const kp = 1 / fx.probe[src], dc = 0;
    let calls = 0;
    const pulse = this.extended.pulse.type === 'PULSE';
    const conditioned = this.absolutePath(src, { trigger: true });
    const y = (t) => { calls++; return conditioned(t); }, L = pulse ? this.trig.level : this.triggerThreshold();
    let up = pulse ? (this.pulseStartedAt == null) === (this.extended.pulse.polarity === 'POSITIVE') : this.trig.slope === 'R';
    const crossed = (a, b) => (up ? a < L && b >= L : a > L && b <= L);
    const P = s.period > 0 && fx.sig[src].table && this.path(src).f > 0 ? s.period : 0;
    const currentStep = Math.min(this.sdiv / 25, P ? P / 400 : Infinity);
    const key = JSON.stringify([src, c.coupling, c.bw, this.trig.coup, this.trig.slope, L, this.extended.horizontal.holdoff, [this.extended.pulse.type, this.extended.pulse.when, this.extended.pulse.width, this.extended.pulse.polarity], this.run === 'single' ? this.armedAt : null]);
    let search = this.changeSearch;
    if (search?.key !== key) {
      this.pulseStartedAt = null; up = pulse ? this.extended.pulse.polarity === 'POSITIVE' : this.trig.slope === 'R';
      const start = Math.max(this.lastTriggerAt == null ? -Infinity : this.lastTriggerAt + this.extended.horizontal.holdoff, fx.changedAt, this.run === 'single' ? this.armedAt ?? fx.now ?? fx.changedAt : fx.now ?? fx.changedAt);
      this.changeSearch = search = { key, cursor: start, pending: [], initial: start === fx.changedAt, step: currentStep,
        sources: [{ from: fx.changedAt, to: Infinity, sig: s }] };
    } else if (search.sources.at(-1).from !== fx.changedAt) {
      search.sources.at(-1).to = fx.changedAt;
      search.sources.push({ from: fx.changedAt, to: Infinity, sig: s });
    }
    const earliest = Math.max(this.lastRecordEndAt ?? -Infinity,
      this.lastTriggerAt == null ? -Infinity : this.lastTriggerAt + this.extended.horizontal.holdoff);
    search.cursor = Math.max(search.cursor, earliest);
    search.pending = search.pending.filter((g) => g.b > earliest).map((g) => ({ a: Math.max(g.a, earliest), b: g.b }));
    // 電路改變後仍續查未處理的歷史；新訊號較慢或時基放大，也不能把舊窄脈衝的搜尋解析度變粗。
    const step = search.step = Math.min(search.step, currentStep);
    // 截止時刻必須是現在，tView 的預覽偏移與預測中的交越都不能完成採集。
    const end = fx.now ?? fx.changedAt;
    const hit = (t) => {
      // Normal 每次畫面更新取一筆，下一次從這次的現在繼續，避免追趕早已發生的每一個週期。
      search.cursor = this.run === 'single' || pulse ? t : end; search.waiting = false; search.pending = [];
      search.step = currentStep;
      search.sources = search.sources.filter((g) => g.to > search.cursor);
      if (pulse) {
        if (this.pulseStartedAt == null) { this.pulseStartedAt = t; return true; }
        const width = t - this.pulseStartedAt; this.pulseStartedAt = null;
        if (!this.pulseMatches(width)) return true;
      }
      this.queueAcquisition(t);
      return true;
    };
    // 改變那一瞬間電壓就跳過觸發線（例：開輸出時 0 → 0.952 V 的階躍）：觸發點＝改變時刻。改變前取前一段電路的值
    if (search.initial && fx.changedAt <= end) {
      search.initial = false;
      if (fx.changedAt >= earliest && crossed(y(fx.changedAt - 1e-9), y(fx.changedAt))) return hit(fx.changedAt);
    }
    // abs(t)＝週期波形＋電容暫態。先用電壓範圍排除離 Level 很遠的區間，只有候選區間才細分到原本的步進。
    // 區間內的表格格點也納入範圍：窄脈衝不能只看區間兩端，否則兩端都低於 Level 時會漏掉尖峰。
    const possible = (a, b, ya, yb) => {
      if (c.coupling === 'AC' || c.bw || ['AC', 'HF', 'LF'].includes(this.trig.coup)) {
        const [lo, hi, derivative] = this.absoluteBounds(src, a, b, { trigger: true });
        const reach = derivative * (b - a) / 2;
        return L >= Math.max(lo, Math.min(ya, yb) - reach) && L <= Math.min(hi, Math.max(ya, yb) + reach);
      }
      const ctx = search.sources.find((g) => a >= g.from && a < g.to);
      if (!ctx || b >= ctx.to) return true; // 跨電路變化的區間先細分，包含邊界本身的跳變。
      const signal = ctx.sig;
      if (signal.probeAt?.(a) !== signal.probeAt?.(b)) return true;
      const scale = 1 / (signal.probeAt?.((a + b) / 2) ?? fx.probe[src]);
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
      const [r0, r1] = signal.transientRange(a, b), rlo = r0 * scale, rhi = r1 * scale;
      if (L < low * scale - dc + rlo || L > high * scale - dc + rhi) return false;
      if (!M || !(period > 0) || b - a >= period) return true;
      const pa = steady(a) * scale - dc, pb = steady(b) * scale - dc;
      let lo = Math.min(pa, pb), hi = Math.max(pa, pb);
      const h = period / M, phase = ((a % period) + period) % period;
      const first = Math.ceil(phase / h - 1e-7), offset = first * h - phase;
      const count = Math.max(0, Math.min(M + 1, Math.floor(((b - a) - offset) / h + 1e-7) + 1));
      // 只在一個週期內列格點；絕對時間／h 太大時，直接遞增那個整數會超出 JS 安全整數範圍。
      for (let j = 0; j < count; j++) {
        const v = table[(first + j) % M] * scale - dc;
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
      if (!possible(a, b, ya, yb)) continue;
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
    if (!this.on) return false;
    if (this.pendingAcquisition) return true;
    if (this.extended.limit.on || this.extended.logging.on) return true;
    if (this.run === 'stop') return false;
    if (this.extended.pulse.type === 'PULSE' || this.extended.horizontal.holdoff > 0 || this.extended.autoRange.on || this.extended.acquire === 'AVERAGE' || this.extended.display.persist || this.extended.display.format === 'XY') return true;
    if (this.scen !== 'BENCH') return false;
    if (this.fx.now != null && this.run === 'run' && this.trig.mode === 'AUTO') return true;
    return (this.extended.acquire === 'AVERAGE' && this.run === 'single' && !this.sequenceDone()) || !!this.changeSearch?.waiting || ((this.run === 'single' || this.trig.mode === 'NORMAL') && this.crosses());
  }

  tick(force = false) {
    if (!this.on) return;
    if (this.scen === 'BENCH') this.fx = this.benchFx();
    this.updateTimedFeatures();
    if (this.run === 'stop') return;
    this.frames = null;
    this.trackAutoRange(); this.normalizeWindow();
    if (this.pendingAcquisition) {
      if (this.finishPendingAcquisition()) return;
      if (this.pendingAcquisition || this.run === 'stop') return;
    }
    if (this.extended.display.format === 'XY') {
      this.publish(this.acquireHistory());
      if (this.run === 'single') { this.run = 'stop'; this.complete = true; }
      return;
    }
    const tv = this.fx.tView; // 實驗台「看的時刻」；單機情境沒有
    if (this.isScan()) { this.publish(this.acquireHistory({ scan: true })); return; }
    if (this.scen === 'BENCH' && this.fx.now != null && force) { this.queueAcquisition(this.fx.now); return; }
    if (this.scen === 'BENCH' && this.fx.sig?.[this.trig.src]?.abs && this.fx.changedAt != null && this.ch[this.trig.src].coupling !== 'GND') {
      {
        const n = this.acqN;
        for (let j = 0; j < (this.extended.pulse.type === 'PULSE' ? 8 : 1); j++) if (!this.captureChange() || this.acqN !== n || this.run === 'stop') break;
        if (this.acqN === n && !this.pendingAcquisition) this.autoHistory();
        return; // 所有按鍵、旋鈕、定時更新共用實際交越；不能退回穩態相位而擷取未來的交越。
      }
    }
    if (this.scen === 'BENCH' && this.fx.now != null) {
      this.autoHistory();
      return; // Clocked bench inputs never fall back to a preview/next-phase anchor.
    }
    const tt = this.trigTime();
    if (tt != null || force) {
      const a0 = this.absAnchor(tt);
      if (tt != null && this.run === 'run' && this.undersampled() && this.extended.acquire === 'SAMPLE') { // 連續採集又欠取樣：每筆混疊的樣子不同 → 幾幀輪播（真機畫面不穩定）
        this.frames = [0, 1, 2, 3].map(() => this.acquire(tt, a0));
        this.publish(this.frames[3]);
      } else {
        this.publish(this.acquire(tt, a0));
      }
      if (this.run === 'single' && this.sequenceDone()) { this.run = 'stop'; this.complete = true; this.armedAt = null; }
      return;
    }
    if (this.run === 'run' && this.trig.mode === 'AUTO') { // Auto 無觸發：自由執行
      if (this.extended.acquire === 'SAMPLE') {
        this.frames = [0, 1, 2, 3].map(() => this.acquire(null, tv ?? null));
        this.publish(this.frames[3]);
      } else this.publish(this.acquire(null, tv ?? null));
    }
    // Normal 或 Single 等待中：保留舊採集（TDS-F10、GAP-TDS-07）
  }

  trigStatus() {
    if (this.run === 'stop') return this.complete ? 'Acq. Complete' : 'Stop';
    if (this.isScan()) return 'Scan';
    if (this.pendingAcquisition) return "Trig'd";
    if (this.run === 'single' && this.changeSearch) return 'Ready';
    if (this.crosses() && (this.scen !== 'BENCH' || this.fx.now == null || this.rec?.triggered)) return "Trig'd";
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
    if (r.noise?.[i] && ['FREQ', 'PERIOD', 'CYCRMS', 'DUTY', 'PHASE', 'DELAY'].includes(type)) return { text: '?', value: null, why: 'Noise 非週期訊號，不能把教學快取的重複週期當頻率' };
    if (this.extended.display.format === 'XY') return { text: '?', value: null, why: 'XY 模式不能自動量測' };
    if (this.isScan()) return { text: '?', value: null, why: 'Scan 模式不能量測' };
    const b = this.base(i), x = new Float64Array(arr.length);
    let off = false, mx = -Infinity, mn = Infinity, sum = 0;
    for (let j = 0; j < arr.length; j++) {
      if (Math.abs(c.pos + arr[j] / b * (this.extended.invert[i] ? -1 : 1)) > 4 + 1e-9) off = true; // 超出畫面（overrange）
      x[j] = arr[j] * c.probe * (this.extended.invert[i] ? -1 : 1);
      if (x[j] > mx) mx = x[j];
      if (x[j] < mn) mn = x[j];
      sum += x[j];
    }
    const over = r.clip[i] || off, why = r.clip[i] ? '採集時超出 10 格動態範圍（削頂）' : off ? '波形超出畫面' : '';
    let value = null, unit = 'V', digits = 3;
    if (type === 'PKPK') value = mx - mn;
    else if (type === 'MEAN') value = sum / x.length;
    else if (type === 'MIN') value = mn;
    else if (type === 'MAX') value = mx;
    else if (type === 'RMS') { let s2 = 0; for (const y of x) s2 += y * y; value = Math.sqrt(s2 / x.length); }
    else if (type === 'CURSORRMS') {
      if (this.cursor.type !== 'TIME') return { text: '?', value: null, why: 'Cursor RMS 需要 Time 游標界定區間' };
      const t = this.cursor.t.map((q) => this.viewPosition + q / 25 * this.sdiv).sort((a, b) => a - b);
      const a = Math.ceil((t[0] - r.t0) / r.dt), b = Math.floor((t[1] - r.t0) / r.dt);
      if (a < 0 || b >= x.length || b < a) return { text: '?', value: null, why: '游標区間超出紀錄或沒有取樣點' };
      let s2 = 0; for (let j = a; j <= b; j++) s2 += x[j] * x[j]; value = Math.sqrt(s2 / (b - a + 1));
    }
    else if (['RISE', 'FALL', 'POSWIDTH', 'NEGWIDTH', 'DUTY', 'PHASE', 'DELAY'].includes(type)) {
      if (!(mx - mn > 1e-12) || r.mode === 'PEAK') return { text: '?', value: null, why: '紀錄沒有可確定的邊緣' };
      const midpoint = (mx + mn) / 2, rise = edgePoints(x, midpoint, true), fall = edgePoints(x, midpoint, false);
      const duration = (a, b) => { const t = a[0], next = b.find((q) => q > t); return t != null && next != null ? (next - t) * r.dt : null; };
      unit = 's'; digits = 4;
      if (type === 'RISE') value = duration(edgePoints(x, mn + .1 * (mx - mn), true), edgePoints(x, mn + .9 * (mx - mn), true));
      if (type === 'FALL') value = duration(edgePoints(x, mn + .9 * (mx - mn), false), edgePoints(x, mn + .1 * (mx - mn), false));
      if (type === 'POSWIDTH') value = duration(rise, fall);
      if (type === 'NEGWIDTH') value = duration(fall, rise);
      if (type === 'DUTY') { const width = duration(rise, fall); value = width != null && rise.length > 1 ? 100 * width / ((rise[1] - rise[0]) * r.dt) : null; unit = '%'; }
      if (type === 'PHASE' || type === 'DELAY') {
        const other = 1 - i, raw = r.v[other];
        if (!this.ch[other].on || !raw || r.clip[other] || r.noise?.[other]) return { text: '?', value: null, why: 'Phase/Delay 需要兩通道都顯示、週期且未削頂' };
        const c2 = this.ch[other], y = Float64Array.from(raw, (v) => v * c2.probe * (this.extended.invert[other] ? -1 : 1));
        let lo = Infinity, hi = -Infinity; for (const v of y) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        const cr = edgePoints(y, (hi + lo) / 2, true);
        const cycle = firstCycle(x), otherCycle = firstCycle(y);
        if (cycle && otherCycle && rise.length && cr.length) {
          const P = (cycle[1].k - cycle[0].k) * r.dt, delta = (cr[0] - rise[0]) * r.dt;
          value = ((delta + P / 2) % P + P) % P - P / 2;
          if (type === 'PHASE') { value = value / P * 360; unit = '°'; }
        }
      }
      if (value == null) return { text: '?', value: null, why: '紀錄內缺少完整的量測邊緣' };
    }
    else {
      if (r.mode === 'PEAK') return { text: '?', value: null, why: 'Peak Detect 極值紀錄不能確定週期；請改用 Sample 或 Average' };
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
    return (arr[j] + (arr[j + 1] - arr[j]) * (k - j)) * this.ch[i].probe * (this.extended.invert[i] ? -1 : 1);
  }

  cursorSourceName() { return this.extended.cursorSource === 'CHANNEL' ? `CH${this.cursor.src + 1}` : { MATH: 'Math', REFA: 'RefA', REFB: 'RefB' }[this.extended.cursorSource]; }

  // 游標讀值（TDS-F17）：時間以觸發點為基準、電壓以該通道接地為基準；來源未顯示或沒有波形時不出現
  cursorInfo() {
    const cu = this.cursor, i = cu.src;
    if (cu.type === 'OFF' || this.extended.display.format === 'XY') return null;
    const source = this.extended.cursorSource;
    if (source !== 'CHANNEL') {
      const math = source === 'MATH', q = this.extended.math, f = this.extended.fft;
      if (math && q.op === 'FFT') {
        const fft = this.fftRecord(); if (!fft) return { hidden: true };
        if (cu.type === 'TIME') {
          const frequency = cu.t.map((x) => (f.center + x / (250 * f.zoom)) * fft.nyquist);
          const db = frequency.map((hz) => { const u = hz / fft.df; if (u < 0 || u > fft.db.length - 1) return null; const j = Math.floor(u); return fft.db[j] + (fft.db[Math.min(j + 1, fft.db.length - 1)] - fft.db[j]) * (u - j); });
          return { type: 'FREQ', frequency, db, df: Math.abs(frequency[1] - frequency[0]), dv: db.every((v) => v != null) ? Math.abs(db[1] - db[0]) : null };
        }
        const v = cu.v.map((s) => (s / 25 - q.pos) * 10 / f.verticalZoom);
        return { type: 'MAG', v, dv: Math.abs(v[0] - v[1]), unit: 'dB' };
      }
      const ri = source === 'REFA' ? 0 : 1, ref = !math && this.references[ri];
      const a = math ? this.mathRecord() : this.extended.refOn[ri] && ref?.v;
      if (!a) return { hidden: true };
      const r = math ? this.rec : ref, pos = math ? q.pos : ref.pos, scale = math ? q.scale : ref.base * ref.probe;
      const unit = math && q.op === '×' ? 'VV' : 'V', factor = math ? 1 : ref.probe;
      if (cu.type === 'TIME') {
        const t = cu.t.map((s) => (math ? this.viewPosition : ref.mpos) + s / 25 * (math ? this.sdiv : ref.sdiv));
        const v = t.map((tt) => { const u = (tt - r.t0) / r.dt; if (u < 0 || u > a.length - 1) return null; const j = Math.floor(u); return (a[j] + (a[Math.min(j + 1, a.length - 1)] - a[j]) * (u - j)) * factor; });
        return { type: 'TIME', t, v, dt: Math.abs(t[1] - t[0]), dv: v.every((x) => x != null) ? Math.abs(v[1] - v[0]) : null, unit };
      }
      const v = cu.v.map((s) => (s / 25 - pos) * scale);
      return { type: 'AMPL', v, dv: Math.abs(v[0] - v[1]), unit };
    }
    if (!this.ch[i].on || !this.rec?.v[i]) return { hidden: true };
    if (cu.type === 'TIME') {
      const t = cu.t.map((s) => this.viewPosition + (s / 25) * this.sdiv);
      const v = t.map((tt) => this.sampleAt(i, tt));
      return { type: 'TIME', t, v, dt: Math.abs(t[1] - t[0]), dv: v[0] != null && v[1] != null ? Math.abs(v[1] - v[0]) : null };
    }
    const v = cu.v.map((s) => (s / 25 - this.ch[i].pos) * this.vdiv(i));
    return { type: 'AMPL', v, dv: Math.abs(v[0] - v[1]) };
  }

  // 多功能旋鈕目前作用對象（TDS-F20）；null＝沒有作用、LED 熄滅
  knobTarget() {
    const m = this.menu || '';
    if (m === 'HORIZ' && this.extended.horizontal.holdoffSelected) return 'holdoff';
    if (m === 'LIMIT_TEMPLATE') return this.extended.limit.target === 'H' ? 'limith' : 'limitv';
    if (m === 'LIMIT_STOP' && this.extended.limit.stop !== 'MANUAL') return this.extended.limit.stop === 'TIME' ? 'limittime' : 'limitcount';
    if (m === 'LOGGING') return 'logduration';
    if (m === 'MATH' && this.extended.math.op === 'FFT') return null;
    if (m === 'MATH' && this.extended.math.on) return this.mathTarget ?? 'mathpos';
    if (m === 'ACQ' && this.extended.acquire === 'AVERAGE') return 'averages';
    if (m.startsWith('PROBE')) return 'probe';
    if (m === 'TRIG' && this.extended.pulse.type === 'PULSE' && this.extended.pulse.widthSelected && this.extended.pulse.page === 0) return 'pulsewidth';
    if (m === 'TRIG') return 'trigsrc';
    if (/^MEAS\d$/.test(m)) return 'meastype';
    if (m === 'CURSOR' && this.cursor.type !== 'OFF' && this.cursor.sel != null) return 'cursor';
    return null;
  }

  // ---- 輸入：按鍵 ----
  press(id) {
    if (this.trigView && id !== 'TDS.KEY.PRINT') return { kind: 'info', text: '放開 Trig View 後再操作按鍵。' };
    if (id === 'TDS.PWR.ON_OFF') return this.power();
    if (!this.on) return { kind: 'info', text: '電源關閉中：先按左上角 POWER（實機電源鍵在機殼頂部）。' };
    this.msg = '';
    const soft = id.match(/^TDS\.SOFT\.OPT(\d)$/);
    if (this.extended.display.persist === 'INFINITE') this.persistPixels = new Set();
    const h = soft ? this.soft(Number(soft[1]) - 1) : this.key(id);
    this.tick(id === 'TDS.KEY.FORCE_TRIG');
    return h;
  }

  power() {
    // 關機期間沒有採集：不能在重新開機後續查關機前尚未處理的觸發歷史。
    this.resetTemporalAcquisition();
    if (this.on) { this.on = false; return { kind: 'approx', text: '模擬電源關閉：畫面熄滅（實機電源鍵在機殼頂部，照片看不到）。' }; }
    this.on = true; this.extended.autoRange.on = false;
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
      case 'TDS.KEY.AUTORANGE': return this.autoRangeKey();
      case 'TDS.KEY.ACQUIRE': this.menu = 'ACQ'; return null;
      case 'TDS.KEY.DISPLAY': this.menu = 'DISPLAY'; return null;
      case 'TDS.KEY.MATH_MENU':
        this.extended.math.on = this.menu === 'MATH' ? !this.extended.math.on : true;
        this.menu = 'MATH'; return null;
      case 'TDS.KEY.SAVE_RECALL': this.menu = 'STORE'; return null;
      case 'TDS.KEY.REF': this.menu = 'REF'; return null;
      case 'TDS.KEY.PRINT': return { kind: 'approx', text: '下載目前LCD SVG（瀏覽器匯出，非PictBridge列印）。', download: { name: 'TDS2001C-screen.svg', mime: 'image/svg+xml', text: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 320 240">${this.lcd()}</svg>` } };
      case 'TDS.KEY.UTILITY': this.menu = 'UTILITY'; this.utilityPage = 0; return { kind: 'approx', text: 'Utility支援System Status、虛擬Limit Test與Data Logging（More）。韌體/序號未知；校準、USB/印表機需要真機，不顯示假成功。' };
      case 'TDS.KEY.HELP': this.helpFrom = this.menu; this.menu = 'HELP'; return { kind: 'approx', text: 'Help提供目前已支援操作的英文說明（教學摘要，非完整原廠Help全文）。按面板選單鍵返回操作。' };
      case 'TDS.KEY.HORIZ_MENU': this.menu = 'HORIZ'; return null;
      case 'TDS.KEY.AUTOSET': return this.autoset();
      case 'TDS.KEY.DEFAULT_SETUP': return this.defaultSetup();
      case 'TDS.KEY.RUN_STOP':
        // 每次恢復從現在開始等待；Stop 期間錯過的邊緣不補抓。
        this.resetTemporalAcquisition();
        if (this.run === 'stop') { this.run = 'run'; this.complete = false; return null; }
        this.run = 'stop'; this.complete = false; this.frames = null;
        return null;
      case 'TDS.KEY.SINGLE':
        this.deactivateAutoRange();
        this.clearAcquisition();
        this.run = 'single'; this.complete = false; this.frames = null;
        this.resetTemporalAcquisition();
        this.armedAt = this.scen === 'BENCH' ? this.benchFx().now ?? null : null; // 之後電路一變就擷取那一刻起的暫態
        return this.crosses() ? null : { kind: 'approx', text: 'Single 等待有效觸發（Ready）；Auto 模式下也不會自己完成（暫定 GAP-TDS-07），可按 Force Trig 強制取一幀。' };
      case 'TDS.KEY.SET_TO_ZERO':
        if (this.extended.horizontal.view !== 'MAIN') { this.extended.horizontal.windowPos = 0; this.normalizeWindow(); return null; }
        if (this.extended.math.on && this.extended.math.op === 'FFT') { this.extended.fft.center = 0.5; return null; }
        if (this.extended.display.format === 'XY') return null; this.mpos = 0; return null;
      case 'TDS.KEY.SET_TO_50':
        if (this.extended.display.format === 'XY') return null; this.setTo50(); this.markBroken(); return null;
      case 'TDS.KEY.FORCE_TRIG':
        if (this.extended.display.format === 'XY') return null;
        return this.run === 'stop' ? { kind: 'info', text: '已停止時 Force Trig 沒有作用（手冊 p.15）。' } : null;
      default: return null;
    }
  }

  // 1／2 鍵（GAP-TDS-05）：關閉→開啟並顯示選單；已開但選單不是它→切到它的選單；它的選單已顯示→關閉通道
  chanKey(i) {
    const c = this.ch[i], name = `CH${i + 1}`;
    if (!c.on) { this.deactivateAutoRange(); c.on = true; this.menu = name; return null; }
    if (this.menu !== name) { this.menu = name; return null; }
    this.deactivateAutoRange(); c.on = false;
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
    if (m === 'ACQ') return this.acquireSoft(j);
    if (m === 'DISPLAY') return this.displaySoft(j);
    if (m === 'MATH') return this.mathSoft(j);
    if (m === 'STORE') return this.storeSoft(j);
    if (m === 'AUTORANGE') return this.autoRangeSoft(j);
    if (m === 'LIMIT') return this.limitSoft(j);
    if (m === 'LOGGING') return this.loggingSoft(j);
    if (m === 'LIMIT_TEMPLATE') {
      const q = this.extended.limit;
      if (j === 0) q.templateSource = (q.templateSource + 1) % 3;
      if (j === 1) { q.target = q.target === 'H' ? 'V' : 'H'; return null; }
      if (j === 2) return this.applyLimitTemplate();
      if (j === 3) q.destination = 1 - q.destination;
      if (j === 4) this.menu = 'LIMIT';
      return null;
    }
    if (m === 'LIMIT_ACTION') {
      if (j < 3) this.extended.limit.action = ['NONE', 'SAVE_WAVEFORM', 'SAVE_IMAGE'][j];
      if (j === 3) return this.limitViolation ? { kind: 'approx', text: '下載最近一次違規的已採集資料／畫面（瀏覽器檔案，非USB）。', download: this.limitViolation } : { kind: 'info', text: '尚無已保存的違規資料。先選動作並開始測試。' };
      if (j === 4) this.menu = 'LIMIT';
      return null;
    }
    if (m === 'LIMIT_STOP') { if (j < 4) this.extended.limit.stop = ['WAVEFORMS', 'VIOLATIONS', 'TIME', 'MANUAL'][j]; if (j === 4) this.menu = 'LIMIT'; return null; }
    if (m === 'UTILITY') {
      if (j === 4) { this.utilityPage = 1 - (this.utilityPage ?? 0); return null; }
      if (this.utilityPage === 1) {
        if (j === 0) { this.menu = 'LOGGING'; return null; }
        if (j === 1) return OUT('File Utilities：沒有實體USB；瀏覽器匯出請用Save/Recall或Print');
        if (j === 2) return { kind: 'info', text: '目前LCD只支援手冊英文；未取得原廠其他語言字樣，不能冒稱校機選單翻譯。' };
        if (j === 3) { this.utilityPage = 0; return null; }
      }
      if (j === 0) { this.menu = 'STATUS'; return null; }
      if (j === 1) { this.menu = 'UTILITY_OPTIONS'; return null; }
      if (j === 2) return OUT('Do Self Cal：需要真機溫度、ADC與已知電壓參照，本模擬器不會產生校準成功');
      if (j === 3) { this.menu = 'LIMIT'; return null; }
    }
    if (m === 'UTILITY_OPTIONS') return j === 4 ? (this.menu = 'UTILITY', null) : OUT(['Printer Setup', 'GPIB Setup', 'Set Date and Time', 'Error Log'][j]);
    if (m === 'STATUS' || m.startsWith('STATUS_')) { this.menu = ['STATUS_HORIZONTAL', 'STATUS_VERTICAL', 'STATUS_TRIGGER', 'STATUS_MISC', 'UTILITY'][j]; return null; }
    if (m === 'HELP' && j === 4) { this.menu = this.helpFrom ?? null; return null; }
    if (m === 'REF' && j < 2) {
      if (!this.references[j]) return { kind: 'info', text: `Ref${j ? 'B' : 'A'} 尚未保存波形。` };
      this.extended.refOn[j] = !this.extended.refOn[j]; return null;
    }
    if (m === 'HORIZ') return this.horizontalSoft(j);
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
    if (j === 2) { this.extended.fine[i] = !this.extended.fine[i]; return { kind: 'approx', text: 'Fine 以每步約2%微調V/div（教學近似）；切回Coarse時保留目前實際刻度，下一次轉動才回1-2-5檔。' }; }
    if (j === 3) { this.menu = `PROBE${i + 1}`; return null; }
    this.extended.invert[i] = !this.extended.invert[i];
    return null;
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
    if (this.extended.display.format === 'XY') return { kind: 'info', text: 'XY 模式不使用觸發控制。' };
    this.deactivateAutoRange();
    const t = this.trig;
    const pulse = this.extended.pulse;
    if (j === 0) { pulse.type = pulse.type === 'EDGE' ? 'PULSE' : 'EDGE'; pulse.widthSelected = false; return { kind: 'approx', text: '觸發Type可選Edge/Pulse；Video缺少NTSC/PAL/SECAM同步訊號來源，本版略過。Pulse等實際脈波結束後比對脈寬。' }; }
    if (pulse.type === 'PULSE') {
      if (j === 4) { pulse.page = 1 - pulse.page; return null; }
      if (pulse.page === 0) {
        if (j === 1) return this.setTrigSrc(1 - t.src);
        if (j === 2) { const when = ['=', '!=', '<', '>']; pulse.when = when[(when.indexOf(pulse.when) + 1) % when.length]; }
        if (j === 3) pulse.widthSelected = true;
      } else {
        if (j === 1) pulse.polarity = pulse.polarity === 'POSITIVE' ? 'NEGATIVE' : 'POSITIVE';
        if (j === 2) t.mode = t.mode === 'AUTO' ? 'NORMAL' : 'AUTO';
        if (j === 3) { const coups = ['DC', 'AC', 'NOISE', 'HF', 'LF']; t.coup = coups[(coups.indexOf(t.coup) + 1) % coups.length]; }
      }
      this.markBroken(); return null;
    }
    if (j === 1) return this.setTrigSrc(1 - t.src);
    this.markBroken();
    if (j === 2) t.slope = t.slope === 'R' ? 'F' : 'R';
    if (j === 3) t.mode = t.mode === 'AUTO' ? 'NORMAL' : 'AUTO';
    if (j === 4) {
      const coups = ['DC', 'AC', 'NOISE', 'HF', 'LF']; t.coup = coups[(coups.indexOf(t.coup) + 1) % coups.length];
      return { kind: 'approx', text: `觸發耦合 ${t.coup}：只影響觸發路徑；AC為10Hz高通、HF Reject為80kHz低通、LF Reject為300kHz高通，均採一階近似。Noise Reject以峰幅5%或1/25格較大者增加遲滯（門檻為近似）。` };
    }
    return null;
  }

  setTrigSrc(s) {
    this.deactivateAutoRange();
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
      return { kind: 'approx', text: `${MEAS_NAME[s.type]} 由目前採集計算，演算法是模擬器定義（近似，TDS-F21）；其他量測同样由目前2500點紀錄計算，超出紀錄或沒有有效邊緣時留?。` };
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
      const sources = ['CH1', 'CH2', 'MATH', 'REFA', 'REFB'], old = this.extended.cursorSource === 'CHANNEL' ? `CH${cu.src + 1}` : this.extended.cursorSource;
      const next = sources[(sources.indexOf(old) + 1) % sources.length]; this.extended.cursorSource = next.startsWith('CH') ? 'CHANNEL' : next;
      if (next.startsWith('CH')) cu.src = Number(next[2]) - 1;
      return this.cursorInfo()?.hidden ? { kind: 'info', text: `${this.cursorSourceName()} 未顯示：游標與讀值不會出現（手冊p.82）。` } : null;
    }
    if ((j === 3 || j === 4) && cu.type !== 'OFF') cu.sel = j - 3;
    return null; // OPT3 是 Δ 讀值格，按了沒有作用（PD）
  }

  // AutoSet presentation options (manual pp.80–81); scale-selection thresholds are approximate.
  autosetSoft(j) {
    const k = this.autoKind in AUTO ? this.autoKind : 'UNKNOWN';
    if (j === AUTO[k].undo) {
      if (!this.undo) return null;
      this.restore(this.undo);
      this.undo = null;
      return { kind: 'approx', text: 'Undo Autoset：回到按 AutoSet 之前的設定（近似）。' };
    }
    if (!['SINE', 'SQUARE'].includes(k) || j > (k === 'SINE' ? 2 : 3)) return null;
    const src = this.autoMeas?.src ?? this.trig.src, p = this.path(src);
    this.autoOption = j; this.extended.math.on = k === 'SINE' && j === 2;
    if (this.extended.math.on) {
      this.extended.math.op = 'FFT'; this.extended.fft.source = src; this.extended.fft.center = .5;
      this.extended.display.type = 'VECTORS'; this.autoMeas = null;
      return { kind: 'approx', text: 'Autoset FFT：將目前採集轉換為FFT頻譜，採2048點與所選視窗。' };
    }
    this.autoMeas = { src, types: j === 0 ? AUTO[k].meas : k === 'SINE' ? ['MEAN', 'PKPK']
      : j === 1 ? ['MIN', 'MAX', 'MEAN', 'POSWIDTH'] : j === 2 ? ['RISE', 'PKPK'] : ['FALL', 'PKPK'] };
    const edge = k === 'SQUARE' && j >= 2;
    this.trig.slope = j === 3 ? 'F' : 'R'; this.mpos = 0;
    const duration = edge ? this.measure(src, j === 2 ? 'RISE' : 'FALL').value ?? 1 / p.f / 100 : (j === 0 ? 2 : 1) / p.f;
    const target = edge ? 5 * duration : duration;
    const idx = SDIV.findIndex((s) => 10 * s >= target - 1e-15);
    this.sIdx = idx < 0 ? SDIV.length - 1 : idx; this.normalizeWindow();
    return { kind: 'approx', text: `Autoset ${edge ? j === 2 ? 'Rising edge' : 'Falling edge' : j === 0 ? 'Multi-cycle' : 'Single-cycle'}：更新時間刻度與對應量測；選檔為教學近似。` };
    return null;
  }

  // ---- AutoSet（TDS-F15、GAP-TDS-10）----
  save() {
    return JSON.parse(JSON.stringify({ ch: this.ch.map(({ probe, ...c }) => c), sIdx: this.sIdx, mpos: this.mpos, trig: this.trig, cursor: this.cursor, meas: this.meas, menu: this.menu, extended: this.extended }));
  }

  restore(s) {
    s.ch.forEach((c, i) => Object.assign(this.ch[i], c));
    Object.assign(this, { sIdx: s.sIdx, mpos: s.mpos, trig: s.trig, cursor: s.cursor, meas: s.meas, menu: s.menu });
    if (s.extended) this.extended = clone(s.extended);
    this.extended.limit.on = false; this.extended.logging.on = false;
    this.limitStats = { tested: 0, passed: 0, failed: 0, result: null }; this.limitStarted = null; this.limitViolation = null;
    this.loggingRows = []; this.loggingStarted = null; this.loggingDropped = 0;
    this.resetTemporalAcquisition();
    this.clearAcquisition();
    this.autoMeas = null;
  }

  autoset() {
    this.undo = this.save();
    this.extended.display.format = 'YT'; this.extended.acquire = 'SAMPLE'; this.extended.horizontal.view = 'MAIN'; this.extended.horizontal.holdoff = 0; this.clearAcquisition();
    this.extended.pulse.type = 'EDGE'; this.extended.math.on = false; this.pulseStartedAt = null; this.changeSearch = null;
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
      c.vIdx = k < 0 ? VDIV.length - 1 : k; this.extended.fineScale[i] = null;
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
    this.autoOption = 0;
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
    if (this.extended.display.format === 'XY' && /HORIZ|TRIG_LEVEL/.test(id)) return { kind: 'info', text: 'XY 模式不使用時基與觸發控制。' };
    if (this.extended.display.persist === 'INFINITE') this.persistPixels = new Set();
    if (!this.on) return null;
    this.msg = '';
    const h = this.knob(id, dir);
    this.tick();
    return h;
  }

  knob(id, dir) {
    if (this.extended.math.on && this.extended.math.op === 'FFT' && this.extended.display.format === 'YT') {
      const f = this.extended.fft, q = this.extended.math;
      if (id === `TDS.KNOB.CH${f.source + 1}_VOLTS_DIV`) {
        const scales = [.5, 1, 2, 5, 10]; f.verticalZoom = scales[clamp(scales.indexOf(f.verticalZoom) + dir, 0, 4)]; return null;
      }
      if (id === `TDS.KNOB.CH${f.source + 1}_POSITION`) { q.pos = clamp(q.pos + dir / 25, -4, 4); return null; }
      if (id === 'TDS.KNOB.HORIZ_POSITION') { f.center = clamp(f.center - dir / (250 * f.zoom), 0, 1); return null; }
    }
    const chan = id.match(/^TDS\.KNOB\.CH(\d)_(POSITION|VOLTS_DIV)$/);
    if (chan) {
      const i = Number(chan[1]) - 1, c = this.ch[i];
      if (!c.on) return { kind: 'info', text: `CH${i + 1} 沒有開啟：先按 ${i + 1} 顯示通道。` };
      if (chan[2] === 'VOLTS_DIV') {
        this.deactivateAutoRange('VERTICAL');
        if (this.extended.fine[i]) this.extended.fineScale[i] = clamp(this.base(i) * Math.pow(1.02, -dir), VDIV[0], VDIV.at(-1));
        else {
          const b = this.base(i), choices = VDIV.map((v, k) => ({ v, k })).filter((q) => dir > 0 ? q.v < b - 1e-12 : q.v > b + 1e-12);
          c.vIdx = choices.length ? (dir > 0 ? choices.at(-1).k : choices[0].k) : dir > 0 ? 0 : VDIV.length - 1; this.extended.fineScale[i] = null;
        }
      } // 順時針＝V/div 變小
      else c.pos += dir / 25; // 每格 1/25 div
      c.pos = clamp(Math.round(c.pos * 25) / 25, -this.posLimit(i), this.posLimit(i)); // 改 V/div 時格數不變（GAP-TDS-11）
      return null;
    }
    switch (id) {
      case 'TDS.KNOB.HORIZ_SCALE':
        this.deactivateAutoRange('HORIZONTAL');
        if (this.extended.horizontal.view !== 'MAIN') { this.extended.horizontal.windowIdx = clamp(this.extended.horizontal.windowIdx - dir, 0, this.sIdx); this.normalizeWindow(); return null; }
        this.sIdx = clamp(this.sIdx - dir, 0, SDIV.length - 1); // 以螢幕中央縮放：M Pos（中央的時間）不變
        this.mpos = clamp(this.mpos, ...this.mposRange()); this.normalizeWindow();
        return null;
      case 'TDS.KNOB.HORIZ_POSITION': {
        if (this.extended.horizontal.view !== 'MAIN') { const h = this.extended.horizontal, step = SDIV[h.windowIdx] / 25; h.windowPos = Math.round(h.windowPos / step - dir) * step; this.normalizeWindow(); return null; }
        if (this.isScan()) return { kind: 'info', text: 'Scan 模式下不能調水平位置（手冊 p.77）。' };
        const step = this.sdiv / 25; // 解析度 1/25 div；順時針＝波形往右（M Pos 變小）
        this.mpos = clamp(Math.round(this.mpos / step - dir) * step, ...this.mposRange()); this.normalizeWindow();
        return null;
      }
      case 'TDS.KNOB.TRIG_LEVEL': {
        this.deactivateAutoRange();
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
    if (t === 'holdoff') { this.extended.horizontal.holdoff = clamp(this.extended.horizontal.holdoff + dir * this.sdiv / 25, 0, 50); return null; }
    if (t === 'limitv' || t === 'limith') { const q = this.extended.limit, field = t === 'limitv' ? 'vTolerance' : 'hTolerance'; q[field] = clamp(Math.round((q[field] + dir / 100) * 100) / 100, 0, 5); return null; }
    if (t === 'limitcount') { const q = this.extended.limit; q.count = clamp(q.count + dir, 1, 1e6); return null; }
    if (t === 'limittime') { const q = this.extended.limit; q.seconds = clamp(q.seconds + dir, 1, 86400); return null; }
    if (t === 'logduration') { this.stepLoggingDuration(dir); return null; }
    if (t === 'pulsewidth') { const p = this.extended.pulse, step = Math.max(1e-9, Math.round(p.width * .01 / 1e-9) * 1e-9); p.width = clamp(p.width + dir * step, 33e-9, 10); return null; }
    if (t === 'averages') {
      const n = [4, 16, 64, 128], k = clamp(n.indexOf(this.extended.averages) + dir, 0, n.length - 1);
      this.extended.averages = n[k]; this.clearAcquisition(); return null;
    }
    if (t === 'mathpos') { this.extended.math.pos = clamp(this.extended.math.pos + dir / 25, -4, 4); return null; }
    if (t === 'mathscale') {
      const scales = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
      const k = scales.indexOf(this.extended.math.scale);
      this.extended.math.scale = scales[clamp(k - dir, 0, scales.length - 1)]; return null;
    }
    const cu = this.cursor, arr = cu.type === 'TIME' ? cu.t : cu.v; // 游標每格 1/25 div，限制在 graticule 內（GAP-TDS-15）
    arr[cu.sel] = clamp(arr[cu.sel] + dir, cu.type === 'TIME' ? -125 : -100, cu.type === 'TIME' ? 125 : 100);
    return null;
  }

  // 實驗台：外殼注入訊號來源（回傳 { sig:[{table,period}|null ×2], probe:[倍率 ×2] }）；電路變了呼叫 inputChanged
  setBenchSource(fn) { this.benchSource = fn; }
  benchFx() { return this.benchSource?.() ?? { sig: [null, null], probe: [10, 10] }; }
  inputChanged() {
    if (this.scen === 'BENCH') this.fx = this.benchFx();
    else if (!this.needsTriggerPoll()) return;
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
  visual(id) { if (id === 'TDS.LED.AUTORANGE') return { lit: this.extended.autoRange.on ? this.on : undefined }; return id === 'TDS.LED.MULTIPURPOSE' ? { lit: this.on && !!this.knobTarget() } : {}; }

  // 右側選單（LCD 用）：{ title, items[5]: { lines, hot（反白的行）} }；鍵位依手冊表列順序暫定（GAP-TDS-02）
  menuItems() {
    const m = this.menu;
    if (!m) return null;
    const hot = (a, b) => ({ lines: [a, b], hot: [1] });
    const plain = (...lines) => ({ lines, hot: [] });
    const E = plain();
    const i = Number(m.slice(-1)) - 1;
    const sourceName = (s) => ['CH1', 'CH2', 'Math'][s];
    if (m === 'UTILITY') return { title: 'Utility', items: this.utilityPage === 1
      ? [plain('Data', 'Logging'), plain('File Utilities'), hot('Language', 'English'), plain('Back'), plain('More')]
      : [plain('System', 'Status'), plain('Options'), plain('Do Self Cal'), plain('Limit Test'), plain('More')] };
    if (m === 'LIMIT') {
      const q = this.extended.limit;
      return { title: 'Limit Test', items: q.page === 0
        ? [hot('Source', sourceName(q.source)), hot('Compare To', `Ref${q.compare ? 'B' : 'A'}`), hot('Run/Stop Test', q.on ? 'Run' : 'Stop'), plain('Template', 'Setup'), plain('More')]
        : [plain('Action on', 'Violation'), plain('Stop After', q.stop === 'MANUAL' ? 'Manual' : q.stop === 'TIME' ? fmtS(q.seconds) : `${q.count} ${q.stop === 'WAVEFORMS' ? 'Waves' : 'Fails'}`), hot('Display', 'Template', q.show ? 'On' : 'Off'), plain('Back'), plain('More')] };
    }
    if (m === 'LIMIT_TEMPLATE') {
      const q = this.extended.limit;
      return { title: 'Template', items: [hot('Source', sourceName(q.templateSource)), { lines: [`V Limit ${q.vTolerance}`, `H Limit ${q.hTolerance}`], hot: [q.target === 'H' ? 1 : 0] }, plain('Apply', 'Template'), hot('Destination', `Ref${q.destination ? 'B' : 'A'}`), plain('Back')] };
    }
    if (m === 'LIMIT_ACTION') return { title: 'Violation', items: [hot('Action', 'None'), hot('Save', 'Waveform'), hot('Save', 'Image'), plain('Download', 'Last'), plain('Back')].map((it, j) => ({ ...it, hot: j < 3 && this.extended.limit.action === ['NONE', 'SAVE_WAVEFORM', 'SAVE_IMAGE'][j] ? [0, 1] : [] })) };
    if (m === 'LIMIT_STOP') {
      const q = this.extended.limit;
      return { title: 'Stop After', items: [hot('Waveforms', String(q.count)), hot('Violations', String(q.count)), hot('Time', fmtS(q.seconds)), plain('Manual'), plain('Back')].map((it, j) => ({ ...it, hot: j < 4 && q.stop === ['WAVEFORMS', 'VIOLATIONS', 'TIME', 'MANUAL'][j] ? it.lines.map((_, k) => k) : [] })) };
    }
    if (m === 'LOGGING') {
      const q = this.extended.logging;
      return { title: 'Data Logging', items: [hot('Data Logging', q.on ? 'On' : 'Off'), hot('Source', sourceName(q.source)), hot('Duration', q.duration === 'INFINITE' ? 'Infinite' : `${q.duration / 3600} hour`), plain('Download', 'CSV'), plain('Back')] };
    }
    if (m === 'UTILITY_OPTIONS') return { title: 'Options', items: [plain('Printer', 'Setup'), plain('GPIB', 'Setup'), plain('Set Date', 'and Time'), plain('Error Log'), plain('Back')] };
    if (m === 'STATUS' || m.startsWith('STATUS_')) return { title: 'System Status', items: [plain('Horizontal'), plain('Vertical'), plain('Trigger'), plain('Misc'), plain('Back')] };
    if (m === 'HELP') return { title: 'Help', items: [E, E, E, E, plain('Back')] };
    if (m === 'CH1' || m === 'CH2') {
      const c = this.ch[i];
      return { title: m, items: [hot('Coupling', CPL[c.coupling]), c.bw ? { lines: ['BW Limit', 'On', '20MHz'], hot: [1] } : hot('BW Limit', 'Off'),
        hot('Volts/Div', this.extended.fine[i] ? 'Fine' : 'Coarse'), plain('Probe', `${c.probe}X`, 'Voltage'), hot('Invert', this.extended.invert[i] ? 'On' : 'Off')] };
    }
    if (m.startsWith('PROBE')) return { title: 'Probe', items: [{ lines: ['Voltage'], hot: [0] }, plain('Current'), hot('Attenuation', `${this.ch[i].probe}X`), E, plain('Back')] };
    if (m === 'TRIG') {
      const t = this.trig;
      const p = this.extended.pulse;
      if (p.type === 'PULSE') return { title: 'Trigger', items: p.page === 0
        ? [hot('Type', 'Pulse'), hot('Source', `CH${t.src + 1}`), hot('When', p.when === '!=' ? '≠' : p.when), hot('Pulse Width', fmtS(p.width)), plain('More')]
        : [hot('Type', 'Pulse'), hot('Polarity', p.polarity === 'POSITIVE' ? 'Positive' : 'Negative'), hot('Mode', t.mode === 'AUTO' ? 'Auto' : 'Normal'), hot('Coupling', { HF: 'HF Reject', LF: 'LF Reject', NOISE: 'Noise Reject' }[t.coup] ?? t.coup), plain('More')] };
      return { title: 'Trigger', items: [hot('Type', 'Edge'), hot('Source', `CH${t.src + 1}`), hot('Slope', t.slope === 'R' ? 'Rising' : 'Falling'),
        hot('Mode', t.mode === 'AUTO' ? 'Auto' : 'Normal'), hot('Coupling', { HF: 'HF Reject', LF: 'LF Reject', NOISE: 'Noise Reject' }[t.coup] ?? t.coup)] };
    }
    if (m === 'MEAS') return { title: 'Measure', items: this.meas.map((s) => plain(`CH${s.src + 1}`, MEAS_NAME[s.type], this.measure(s.src, s.type).text)) };
    if (m.startsWith('MEAS')) {
      const s = this.meas[i];
      return { title: `Measure ${i + 1}`, items: [hot('Source', `CH${s.src + 1}`), hot('Type', MEAS_NAME[s.type]), E, E, plain('Back')] };
    }
    if (m === 'CURSOR') {
      const cu = this.cursor, ci = this.cursorInfo();
      const fft = this.extended.cursorSource === 'MATH' && this.extended.math.op === 'FFT';
      const valueText = (v) => v == null ? '' : ci?.unit === 'VV' ? `${engp(v, 3)}VV` : ci?.unit === 'dB' ? `${fmtFixed(v, 2)}dB` : fmtV(v);
      const items = [hot('Type', { OFF: 'Off', TIME: fft ? 'Frequency' : 'Time', AMPL: fft ? 'Magnitude' : 'Amplitude' }[cu.type]), hot('Source', this.cursorSourceName()), E, E, E];
      if (ci && !ci.hidden) {
        const cur = (k) => {
          const lines = [`Cursor${k + 1}`, ...(ci.type === 'FREQ' ? [`${engp(ci.frequency[k], 4)}Hz`, ci.db[k] == null ? '' : `${fmtFixed(ci.db[k], 2)}dB`] : ci.type === 'TIME' ? [fmtS(ci.t[k]), valueText(ci.v[k])] : [valueText(ci.v[k])])];
          return { lines, hot: cu.sel === k ? lines.map((_, n) => n) : [] };
        };
        items[2] = ci.type === 'FREQ' ? plain(`Δf ${engp(ci.df, 4)}Hz`, `1/Δf ${ci.df ? fmtS(1 / ci.df) : '?'}`, `Δ ${ci.dv == null ? '' : `${fmtFixed(ci.dv, 2)}dB`}`)
          : ci.type === 'TIME' ? plain(`Δt ${fmtS(ci.dt)}`, `1/Δt ${ci.dt > 0 ? `${engp(1 / ci.dt, 4)}Hz` : '?'}`, `Δ ${valueText(ci.dv)}`)
          : plain(`Δ ${valueText(ci.dv)}`);
        items[3] = cur(0);
        items[4] = cur(1);
      }
      return { title: 'Cursor', items };
    }
    if (m === 'ACQ') return { title: 'Acquire', items: ['Sample', 'Peak Detect', 'Average'].map((name, j) => ({ lines: [name], hot: this.extended.acquire === ['SAMPLE', 'PEAK', 'AVERAGE'][j] ? [0] : [] })).concat([plain('Averages', String(this.extended.averages)), E]) };
    if (m === 'DISPLAY') {
      const d = this.extended.display;
      return { title: 'Display', items: [hot('Type', d.type === 'DOTS' ? 'Dots' : 'Vectors'), hot('Persist', d.persist === 'INFINITE' ? 'Infinite' : d.persist ? `${d.persist} sec` : 'Off'), hot('Format', d.format), E, E] };
    }
    if (m === 'MATH') {
      const q = this.extended.math, sources = q.op === '-' && q.reverse ? 'CH2-CH1' : `CH1${q.op}CH2`;
      if (q.op === 'FFT') {
        const f = this.extended.fft;
        return { title: 'Math', items: [hot('Operation', 'FFT'), hot('Source', `CH${f.source + 1}`), E, hot('Window', { HANNING: 'Hanning', FLATTOP: 'Flattop', RECTANGULAR: 'Rectangular' }[f.window]), hot('FFT Zoom', `X${f.zoom}`)] };
      }
      return { title: 'Math', items: [hot('Operation', q.op), plain('Sources', sources), hot('Position', `${fmtFixed(q.pos, 2)}div`), hot('Vertical', 'Scale', `${engp(q.scale, 3)}${q.op === '×' ? 'VV' : 'V'}`), E] };
    }
    if (m === 'STORE') {
      const q = this.extended.store, wave = q.action === 'SAVE_WAVEFORM', recall = q.action === 'RECALL_SETUP';
      return { title: 'Save/Recall', items: [hot('Action', STORE_NAMES[q.action]), hot(recall ? 'Recall From' : 'Save To', q.target === 'FILE' ? 'File' : wave ? 'Ref' : 'Setup'),
        hot(wave ? 'Source' : 'Setup', wave ? `CH${q.source + 1}` : String(q.setup + 1)), wave ? hot('To', `Ref${q.ref ? 'B' : 'A'}`) : E, plain(recall ? 'Recall' : 'Save')] };
    }
    if (m === 'REF') return { title: 'Reference', items: [0, 1].map((k) => hot(`Ref${k ? 'B' : 'A'}`, this.extended.refOn[k] ? 'On' : 'Off')).concat([E, E, E]) };
    if (m === 'AUTORANGE') {
      const a = this.extended.autoRange;
      return { title: 'Autorange', items: [hot('Autoranging', a.on ? 'On' : 'Off'), hot('Vertical and', 'Horizontal'), plain('Vertical', 'Only'), plain('Horizontal', 'Only'), plain('Undo', 'Autoranging')].map((it, j) => j > 0 && j < 4 ? { ...it, hot: a.axes === ['BOTH', 'VERTICAL', 'HORIZONTAL'][j - 1] ? it.lines.map((_, k) => k) : [] } : it) };
    }
    if (m === 'HORIZ') { const h = this.extended.horizontal; return { title: 'Horizontal', items: [plain('Main'), plain('Window', 'Zone'), plain('Window'), plain('Set Holdoff', fmtS(h.holdoff)), E].map((it, j) => ({ ...it, hot: (j < 3 && h.view === ['MAIN', 'ZONE', 'WINDOW'][j]) || (j === 3 && h.holdoffSelected) ? it.lines.map((_, k) => k) : [] })) }; }
    if (m === 'AUTOSET') {
      const undo = plain('Undo', 'Autoset'), sel = (a, b) => ({ lines: [a, b], hot: [0, 1] });
      const items = {
        SINE: [sel('Multi-cycle', 'sine'), plain('Single-cycle', 'sine'), plain('FFT'), undo, E],
        SQUARE: [sel('Multi-cycle', 'square'), plain('Single-cycle', 'square'), plain('Rising', 'edge'), plain('Falling', 'edge'), undo],
      }[this.autoKind] ?? [E, E, E, undo, E];
      return { title: 'Autoset', items: items.map((it, j) => j < AUTO[this.autoKind ?? 'UNKNOWN'].undo ? { ...it, hot: j === (this.autoOption ?? 0) ? it.lines.map((_, n) => n) : [] } : it) };
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
    rows.push(['水平', `${this.extended.horizontal.view} · ${fmtScale(this.sdiv)}/div · Pos ${fmtS(this.viewPosition)} · Holdoff ${fmtS(this.extended.horizontal.holdoff)}`]);
    const pulse = this.extended.pulse;
    rows.push(['觸發', `${pulse.type === 'PULSE' ? `Pulse ${pulse.polarity} ${pulse.when} ${fmtS(pulse.width)}` : `Edge ${t.slope === 'R' ? 'Rising' : 'Falling'}`} · CH${t.src + 1} · ${t.mode === 'AUTO' ? 'Auto' : 'Normal'} · 耦合 ${t.coup} · Level ${fmtV(this.levelV())}`]);
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
      const k = this.ch[i].probe * (this.extended.invert[i] ? -1 : 1);
      for (const y of a) { const v = y * k; mx = Math.max(mx, v); mn = Math.min(mn, v); sum += v; }
      return { max: mx, min: mn, mean: sum / a.length };
    };
    return {
      on: this.on, scenario: this.scen, run: this.run, complete: this.complete, status: this.trigStatus(), scan: this.isScan(),
      menu: this.menu, msg: this.msg, knob: this.knobTarget(),
      ch: this.ch.map((c, i) => ({ ...c, vdiv: this.vdiv(i), actual: this.fx.probe[i] })),
      sdiv: this.sdiv, mpos: this.viewPosition,
      trig: { ...this.trig, levelV: this.levelV(), freq: this.trigFreq() },
      meas: this.meas.map((q) => ({ ...q, text: this.measure(q.src, q.type).text })),
      autoMeas: this.autoMeas && this.autoMeas.types.map((ty) => ({ type: ty, text: this.measure(this.autoMeas.src, ty).text })),
      cursor: { ...this.cursor, info: this.cursorInfo() },
      extended: clone(this.extended), memory: { setups: this.savedSetups.map(Boolean), references: this.references.map(Boolean) },
      limit: { ...this.limitStats, masks: this.limitMasks.map(Boolean) }, logging: { records: this.loggingRows.length, dropped: this.loggingDropped },
      math: this.mathRecord() && { unit: this.extended.math.op === '×' ? 'VV' : 'V', stats: this.mathStats() },
      fft: (() => { const f = this.fftRecord(); if (!f) return null; let peak = 1; for (let k = 2; k < f.rms.length; k++) if (f.rms[k] > f.rms[peak]) peak = k; return { df: f.df, nyquist: f.nyquist, clipped: f.clipped, peak: { frequency: peak * f.df, rms: f.rms[peak], db: f.db[peak] } }; })(),
      acqN: this.acqN,
      pendingAcquisition: this.pendingAcquisition && { triggerAt: this.pendingAcquisition.triggerAt, endAt: this.pendingAcquisition.endAt },
      rec: r && { n: r.n, triggered: r.triggered, broken: r.broken, t0: r.t0, dt: r.dt, abs0: r.abs0, ...(r.endAt != null ? { endAt: r.endAt } : {}), clip: r.clip, fe: r.fe, ...(r.noise ? { noise: r.noise } : {}), ...(r.mode ? { mode: r.mode, averageCount: r.averageCount } : {}), stats: [stats(0), stats(1)] },
    };
  }

  infoText() {
    if (this.menu === 'HELP') {
      const topic = this.helpFrom ?? 'GENERAL';
      const rows = {
        ACQ: ['Acquire', 'Sample: 2500 points per record.', 'Peak Detect: min/max pairs.', 'Average: 4, 16, 64, 128 records.', 'Single ends after N averages.'],
        TRIG: ['Trigger', 'Edge: rising/falling threshold.', 'Pulse: compare actual pulse width.', 'Set Width with multipurpose knob.', 'Force Trig captures one record.', 'Hold Trig View to see coupling.'],
        MATH: ['Math', 'Addition, subtraction, multiplication.', 'FFT uses center 2048 samples.', 'Window: Hanning, Flattop, Rectangular.', 'FFT Zoom: X1, X2, X5, X10.'],
        DISPLAY: ['Display', 'YT: voltage against time.', 'XY: CH1 horizontal, CH2 vertical.', 'XY runs untriggered at 1 MS/s.', 'Dots: acquired sample points.', 'Persist retains older samples.'],
        HORIZ: ['Horizontal', 'Main: main time base.', 'Window Zone: select a region.', 'Window: expand selected region.', 'Set Holdoff: wait between triggers.'],
        STORE: ['Save/Recall', '10 setup slots; RefA and RefB.', 'Source must be displayed to save.', 'File saves browser JSON or CSV.', 'Print downloads the LCD as SVG.'],
        LIMIT: ['Limit Test', 'Template Setup: use captured wave.', 'V/H Limits expand the template.', 'Apply stores the selected mask.', 'Run/Stop compares captured points.', 'Statistics count actual passes/fails.', 'Violation action can retain a download.'],
        LOGGING: ['Data Logging', 'Select CH1, CH2 or time-domain Math.', 'Only completed triggered records log.', 'Duration: 0.5 to 24 hours or Infinite.', 'Latest 2000 summaries are retained.', 'Download CSV exports the summaries.', 'No physical USB hardware simulated.'],
      };
      return rows[topic] ?? ['Help', 'Press a front-panel menu button.', 'Use option keys beside the display.', 'Run/Stop freezes acquired data.', 'Single waits for a trigger.', 'Probe setting must match the probe.', 'Print exports the current LCD.'];
    }
    const h = this.extended.horizontal, t = this.trig;
    if (this.menu === 'LOGGING') return ['Data Logging', `${this.extended.logging.on ? 'Running' : 'Off'} - ${this.loggingRows.length} records`, `Source: ${['CH1', 'CH2', 'Math'][this.extended.logging.source]}`, 'Triggered completed records only.', 'CSV: timestamp, Min, Max, Mean, RMS.', 'Latest 2000 record summaries.', `Earlier summaries removed: ${this.loggingDropped}`, 'Browser export; no physical USB.'];
    if (this.menu === 'STATUS') return ['System Status', 'Select Horizontal, Vertical,', 'Trigger or Misc.'];
    if (this.menu === 'STATUS_HORIZONTAL') return ['Horizontal', `Main: ${fmtScale(this.mainSdiv)}/div`, `Position: ${fmtS(this.mpos)}`, `Window: ${fmtScale(SDIV[h.windowIdx])}/div`, `Window Pos: ${fmtS(h.windowPos)}`, `Holdoff: ${fmtS(h.holdoff)}`, `View: ${h.view}`];
    if (this.menu === 'STATUS_VERTICAL') return ['Vertical', ...this.ch.flatMap((c, i) => [`CH${i + 1}: ${c.on ? 'On' : 'Off'} ${fmtV(this.vdiv(i))}/div`, `${CPL[c.coupling]} Probe ${c.probe}X`, `Invert ${this.extended.invert[i] ? 'On' : 'Off'} BW ${c.bw ? '20MHz' : 'Off'}`])];
    if (this.menu === 'STATUS_TRIGGER') return ['Trigger', `Type: ${this.extended.pulse.type}`, `Source: CH${t.src + 1}`, `Slope: ${t.slope === 'R' ? 'Rising' : 'Falling'}`, `Mode: ${t.mode}`, `Coupling: ${t.coup}`, `Level: ${fmtV(this.levelV())}`, `Pulse Width: ${fmtS(this.extended.pulse.width)}`];
    if (this.menu === 'STATUS_MISC') return ['Misc', 'Model: TDS2001C', 'Firmware: ---', 'Serial Number: ---'];
    return null;
  }
}
