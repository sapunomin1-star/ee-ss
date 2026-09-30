// 實驗台狀態：板上 RC 的值與接法、每條導線端接在哪個接點、探棒 1×／10× 開關。
// 提供示波器與電表的輸入（外殼在每次操作後呼叫 sync，電路有變才重算）。
// 時間：this.now()（秒，預設為頁面時鐘）。電路一變就從「變化前一刻的電容電壓」接續：
//   電容電壓＝新週期穩態＋δ·e^(−(t−t0)/τ)，δ＝變化前電壓－新穩態在 t0 的值（電容電壓不能跳變）。
import { solve, stats, nodeAt, diffStats, diffMeanOver, ohms, LEADS, NODES, M } from './circuit.js';

export const R_OPTIONS = [100, 470, 1000, 2200, 4700, 10000, 47000, 100000];
export const C_OPTIONS = [0.001e-6, 0.01e-6, 0.047e-6, 0.1e-6, 0.47e-6, 1e-6, 10e-6];
export const fmtR = (r) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
export const fmtC = (c) => (c >= 1e-6 ? `${Number((c * 1e6).toPrecision(3))} µF` : `${Number((c * 1e9).toPrecision(3))} nF`);
// 示波器輸入 1 MΩ（M-TDS-13 p.107）；10× 被動探棒尖端 10 MΩ
export const PROBE_R = { 1: 1e6, 10: 10e6 };
// 示波器只呈現看得見的暫態：τ 短於這個值時，一眨眼就結束（真機要用 Single 觸發才抓得到），直接顯示穩態
const SCOPE_TAU_MIN = 0.05;

// 示範接線：AFG CH1 → A、黑夾 → G；示波器 CH1 量輸入（A）、CH2 量 B；電表跨在 B–G
export const DEMO = {
  'AFG.CH1+': 'A', 'AFG.CH1-': 'G', 'TDS.CH1.TIP': 'A', 'TDS.CH1.GND': 'G',
  'TDS.CH2.TIP': 'B', 'TDS.CH2.GND': 'G', 'DMM.HI': 'B', 'DMM.LO': 'G',
};

// 電容電壓偏離週期穩態的部分：δ(t)＝δ0·e^(−(t−t0)/τ)；t0 之前視為 δ0（電容電壓在變化那一刻連續）
function devOf(sol, tr, t) {
  if (!sol?.capLive || !tr?.d0 || !(sol.tau > 0)) return 0;
  return tr.d0 * Math.exp(-Math.max(0, t - tr.t0) / sol.tau);
}
// δ(t) 在 [t1, t2] 的平均（電表積分窗用）
function devMeanOf(sol, tr, t1, t2) {
  if (!sol?.capLive || !tr?.d0 || !(sol.tau > 0) || !(t2 > t1)) return devOf(sol, tr, t2);
  const { t0, d0 } = tr, before = Math.max(0, Math.min(t2, t0) - Math.min(t1, t0));
  const e = (t) => Math.exp(-(Math.max(t, t0) - t0) / sol.tau);
  return (d0 * (before + sol.tau * (e(t1) - e(t2)))) / (t2 - t1);
}

export class Bench {
  // dmm：用來查電表目前的輸入電阻（依功能不同）；沒有就不計電表負載
  constructor(afg, dmm = null) {
    this.afg = afg;
    this.dmm = dmm;
    this.now = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000;
    this.reset();
  }

  reset() {
    this.topo = 'RC';
    this.R = 1000;
    this.C = 0.1e-6;
    this.wires = {};
    this.probeX = [10, 10];
    this.sel = null;
    this.cacheKey = null;
    this.sol = null;
    this.prev = null;
    this.solvedWires = {};
    this.tr = { t0: 0, d0: 0 }; // 暫態：電容電壓偏離穩態的初值與起點
  }

  afgParams() {
    return this.afg.ch.map((c) => ({ wave: c.wave, freq: c.freq, sym: c.sym, emfVpp: c.emfVpp, emfOffset: c.emfOffset, output: c.output && this.afg.on }));
  }

  // 接上的儀器輸入電阻：探棒尖端對大地（依探棒開關），電表 HI–LO（依功能：DCV 10 MΩ、ACV 1 MΩ）
  loads() {
    const L = [];
    [0, 1].forEach((i) => { const n = this.wires[`TDS.CH${i + 1}.TIP`]; if (n) L.push({ a: n, b: 'E', r: PROBE_R[this.probeX[i]] }); });
    const z = this.dmm?.inputZ?.(), hi = this.wires['DMM.HI'], lo = this.wires['DMM.LO'];
    if (z && hi && lo) L.push({ a: hi, b: lo, r: z });
    return L;
  }

  key() { return JSON.stringify([this.topo, this.R, this.C, this.wires, this.probeX, this.afgParams(), this.loads()]); }

  solution() {
    const k = this.key();
    if (k !== this.cacheKey) {
      const t = this.now(), before = this.vcAt(t); // 變化前一刻的電容電壓
      // 保留上一個狀態：跨過變化時刻的電表積分窗，前段照舊電路算
      if (this.sol) this.prev = { sol: this.sol, tr: this.tr, wires: this.solvedWires };
      this.cacheKey = k;
      this.solvedWires = { ...this.wires };
      this.sol = solve({ topo: this.topo, R: this.R, C: this.C, wires: this.wires, loads: this.loads() }, this.afgParams());
      this.tr = { t0: t, d0: this.sol.capLive ? before - this.sol.vcAt(t) : 0 };
    }
    return this.sol;
  }

  // 電容電壓偏離週期穩態的部分 δ(t)
  dev(t = this.now()) { return devOf(this.sol, this.tr, t); }

  vcAt(t) { return this.sol?.capLive ? this.sol.vcAt(t) + this.dev(t) : 0; }

  // 還在充放電（偏離超過 1 µV）：外殼要定時更新畫面
  transientActive(t = this.now()) { this.solution(); return Math.abs(this.dev(t)) > 1e-6; }

  connect(lead, node) {
    this.wires[lead] = node;
    this.sel = null;
  }

  disconnect(lead) {
    delete this.wires[lead];
    this.sel = null;
  }

  // 示波器：每通道探棒尖端的週期波形（接點對大地）；尖端沒接＝沒有訊號。
  // 暫態部分在一次採集的時間內視為定值；at(t) 在取樣點之間照解析式取值（窄脈衝不失真）。
  tdsInput() {
    const sol = this.solution(), d = sol.tau >= SCOPE_TAU_MIN ? this.dev() : 0;
    const sig = [0, 1].map((i) => {
      const node = this.wires[`TDS.CH${i + 1}.TIP`];
      if (!node) return null;
      const off = sol.kv[node] * d;
      if (sol.dc) return { table: new Float64Array(M).fill(off), period: 1, at: () => off };
      return { table: Float64Array.from(sol.v[node], (x) => x + off), period: sol.period, at: (t) => nodeAt(sol, node, t) + off };
    });
    return { sig, probe: [...this.probeX] };
  }

  // 電表：HI−LO 的電壓。dc＝整週期平均（含目前暫態）、meanOver(t1,t2)＝時間窗平均（DCV 積分用）、
  // ac＝交流有效值、peak／peakAc＝瞬間最大值／交流峰值（自動量程看峰值）、freq＝訊號頻率、now＝目前時間。
  // 電阻只在電路沒通電時量（C 在直流下視為開路）。
  dmmInput() {
    const hi = this.wires['DMM.HI'], lo = this.wires['DMM.LO'];
    if (!hi || !lo) return { v: null, ohm: null, why: '電表的 HI、LO 測試線要兩條都接上電路。' };
    const sol = this.solution(), t = this.now(), kv = sol.kv[hi] - sol.kv[lo];
    const w = diffStats(sol, hi, lo), off = kv * this.dev(t);
    // 積分窗 [t1, t2]：變化時刻 t0 之後照目前電路，之前照上一個電路（當時測試線沒接好就當 0 V）
    const seg = (S, TR, h, l, a, b) => (b > a ? (diffMeanOver(S, h, l, a, b) + (S.kv[h] - S.kv[l]) * devMeanOf(S, TR, a, b)) * (b - a) : 0);
    const meanOver = (t1, t2) => {
      const t0 = this.tr.t0, p = this.prev;
      let sum = seg(sol, this.tr, hi, lo, Math.max(t1, t0), t2);
      const ph = p?.wires?.['DMM.HI'], pl = p?.wires?.['DMM.LO'];
      if (t1 < t0 && ph && pl) sum += seg(p.sol, p.tr, ph, pl, t1, Math.min(t2, t0));
      return sum / (t2 - t1);
    };
    const v = {
      dc: w.mean + off, ac: w.acRms, peak: w.peak + Math.abs(off), peakAc: w.peakAc,
      freq: sol.dc ? 0 : 1 / sol.period, now: t, meanOver,
      live: !sol.dc || Math.abs(off) > 1e-6, // 讀值會隨時間變
    };
    const powered = [0, 1].some((ch) => this.wires[`AFG.CH${ch + 1}+`] && this.afgParams()[ch].output);
    let ohm = null, whyR = '';
    if (powered) whyR = '電路通電中不能量電阻：先關 AFG 的 OUTPUT（或拔掉紅夾）。';
    else ohm = ohms({ topo: this.topo, R: this.R, wires: this.wires, loads: this.loads() }, hi, lo);
    return { v, ohm, why: '', whyR, whyI: '實驗台目前只支援電壓（DCV、ACV）與電阻量測；量電流要把電表串進電路，還沒有提供。' };
  }

  leadsOn(node) { return Object.entries(this.wires).filter(([, n]) => n === node).map(([id]) => LEADS[id].name); }

  snapshot() {
    const sol = this.solution(), d = this.dev();
    const pp = Object.fromEntries(NODES.map((n) => [n, sol.dc ? 0 : stats(sol.v[n]).pp]));
    const ssMean = Object.fromEntries(NODES.map((n) => [n, sol.dc ? 0 : stats(sol.v[n]).mean]));
    const dcNow = Object.fromEntries(NODES.map((n) => [n, ssMean[n] + sol.kv[n] * d]));
    return {
      topo: this.topo, R: this.R, C: this.C, wires: { ...this.wires }, probeX: [...this.probeX], sel: this.sel, period: sol.period, tau: sol.tau,
      pp, ssMean, dcNow, dev: d, loads: this.loads(), warn: sol.warn.map((w) => w.text),
    };
  }
}
