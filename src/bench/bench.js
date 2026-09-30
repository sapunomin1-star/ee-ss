// 實驗台狀態：板上 RC 的值與接法、每條導線端接在哪個接點、探棒 1×／10× 開關。
// 提供示波器與電表的輸入（外殼在每次操作後呼叫 sync，電路有變才重算）。
// 時間：this.now()（秒，預設為頁面時鐘）。電路每變一次就開新的一段 { sol, wires, from, to, t0, d0 }，保留最近幾秒：
//   電容電壓＝該段週期穩態＋δ·e^(−(t−t0)/τ)，δ0＝變化前一刻的電容電壓－新穩態在 t0 的值（電容電壓不能跳變）。
//   電表積分窗、示波器單次擷取往前看的部分，都照「當時那一段」的電路算：已完成的讀值不會被後來的操作改掉。
import { solve, stats, nodeAt, diffStats, diffMeanOver, ohms, LEADS, NODES, M } from './circuit.js';

export const R_OPTIONS = [100, 470, 1000, 2200, 4700, 10000, 47000, 100000];
export const C_OPTIONS = [0.001e-6, 0.01e-6, 0.047e-6, 0.1e-6, 0.47e-6, 1e-6, 10e-6];
export const fmtR = (r) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
export const fmtC = (c) => (c >= 1e-6 ? `${Number((c * 1e6).toPrecision(3))} µF` : `${Number((c * 1e9).toPrecision(3))} nF`);
// 示波器輸入 1 MΩ（M-TDS-13 p.107）；10× 被動探棒尖端 10 MΩ
export const PROBE_R = { 1: 1e6, 10: 10e6 };
const HIST_S = 2; // 保留多久以前的電路狀態（秒）：電表積分窗 1/6 秒、示波器單次擷取往前看都在這之內
// 示波器連續採集呈現的是變化後這麼久的畫面（真機每秒更新數十次）；更短的暫態要用 Single 才抓得到（見 TdsModel）
export const SCOPE_SETTLE = 0.05;

// 示範接線：AFG CH1 → A、黑夾 → G；示波器 CH1 量輸入（A）、CH2 量 B；電表跨在 B–G
export const DEMO = {
  'AFG.CH1+': 'A', 'AFG.CH1-': 'G', 'TDS.CH1.TIP': 'A', 'TDS.CH1.GND': 'G',
  'TDS.CH2.TIP': 'B', 'TDS.CH2.GND': 'G', 'DMM.HI': 'B', 'DMM.LO': 'G',
};

// 某一段的電容偏離量 δ(t)（t0 之前視為 δ0）與它在 [t1, t2] 的積分
function devOf(g, t) {
  if (!g?.sol.capLive || !g.d0 || !(g.sol.tau > 0)) return 0;
  return g.d0 * Math.exp(-Math.max(0, t - g.t0) / g.sol.tau);
}
function devInt(g, t1, t2) {
  if (!g?.sol.capLive || !g.d0 || !(g.sol.tau > 0) || !(t2 > t1)) return 0;
  const { t0, d0, sol } = g, e = (t) => Math.exp(-(Math.max(t, t0) - t0) / sol.tau);
  return d0 * (Math.max(0, Math.min(t2, t0) - Math.min(t1, t0)) + sol.tau * (e(t1) - e(t2)));
}
// 某一段裡接點 node 在絕對時間 t 的電壓（週期穩態＋暫態）
const nodeIn = (g, node, t) => (g.sol.dc ? 0 : nodeAt(g.sol, node, t)) + g.sol.kv[node] * devOf(g, t);

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
    this.segs = []; // 電路狀態歷史，最後一段是目前的
  }

  get cur() { return this.segs[this.segs.length - 1]; }
  // 絕對時間 t 時的電路狀態（那一段）
  segAt(t) {
    for (let i = this.segs.length - 1; i >= 0; i--) if (this.segs[i].from <= t) return this.segs[i];
    return this.segs[0];
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
      const t = this.now(), prev = this.cur, before = this.vcAt(t); // 變化前一刻的電容電壓
      this.cacheKey = k;
      const sol = solve({ topo: this.topo, R: this.R, C: this.C, wires: this.wires, loads: this.loads() }, this.afgParams());
      if (prev) prev.to = t;
      this.segs.push({ sol, wires: { ...this.wires }, from: prev ? t : -Infinity, to: Infinity, t0: t, d0: sol.capLive ? before - sol.vcAt(t) : 0 });
      this.segs = this.segs.filter((g) => g.to > t - HIST_S);
    }
    return this.cur.sol;
  }

  // 電容電壓偏離週期穩態的部分 δ(t)（目前這段）
  dev(t = this.now()) { this.solution(); return devOf(this.cur, t); }

  vcAt(t) { const g = this.cur; return g?.sol.capLive ? g.sol.vcAt(t) + devOf(g, t) : 0; }

  // 最近一次電路改變的時刻（第一段＝第一次計算的時刻）
  changedAt() { this.solution(); return this.cur.t0; }

  // 還在充放電（偏離超過 1 µV）：外殼要定時更新畫面
  transientActive(t = this.now()) { return Math.abs(this.dev(t)) > 1e-6; }

  connect(lead, node) {
    this.wires[lead] = node;
    this.sel = null;
  }

  disconnect(lead) {
    delete this.wires[lead];
    this.sel = null;
  }

  // 示波器：每通道探棒尖端的波形（接點對大地）；尖端沒接＝沒有訊號。
  //   table／at：週期穩態＋「看的時刻」tView 的暫態偏移（連續採集用；at 在取樣點之間照解析式，窄脈衝不失真）；
  //   abs(t)：絕對時間 t 的實際電壓（含暫態與歷史）：單次擷取、暫態中的採集用。
  //   tView＝max(現在, 最近一次改變＋SCOPE_SETTLE)；changedAt＝最近一次改變的時刻。
  tdsInput() {
    const sol = this.solution(), g = this.cur, now = this.now(), tView = Math.max(now, g.t0 + SCOPE_SETTLE), d = devOf(g, tView);
    const sig = [0, 1].map((i) => {
      const lead = `TDS.CH${i + 1}.TIP`, node = this.wires[lead];
      if (!node) return null;
      const off = sol.kv[node] * d;
      const abs = (t) => { const h = this.segAt(t), n = h.wires[lead]; return n ? nodeIn(h, n, t) : 0; };
      if (sol.dc) return { table: new Float64Array(M).fill(off), period: 1, at: () => off, abs };
      return { table: Float64Array.from(sol.v[node], (x) => x + off), period: sol.period, at: (t) => nodeAt(sol, node, t) + off, abs };
    });
    return { sig, probe: [...this.probeX], now, tView, changedAt: g.t0, tau: sol.tau };
  }

  // 電表：HI−LO 的電壓。dc＝整週期平均（含目前暫態）、meanOver(t1,t2)＝時間窗平均（DCV 積分用）、
  // ac＝交流有效值、peak／peakAc＝瞬間最大值／交流峰值（自動量程看峰值）、freq＝訊號頻率、now＝目前時間。
  // 電阻只在電路沒通電時量（C 在直流下視為開路）。
  dmmInput() {
    const hi = this.wires['DMM.HI'], lo = this.wires['DMM.LO'];
    if (!hi || !lo) return { v: null, ohm: null, why: '電表的 HI、LO 測試線要兩條都接上電路。' };
    const sol = this.solution(), t = this.now(), kv = sol.kv[hi] - sol.kv[lo];
    const w = diffStats(sol, hi, lo), off = kv * this.dev(t);
    // 積分窗 [t1, t2]：每一小段照「當時」的電路與測試線位置算（當時測試線沒接好就當 0 V）
    const meanOver = (t1, t2) => {
      let sum = 0;
      for (const g of this.segs) {
        const a = Math.max(t1, g.from), b = Math.min(t2, g.to), h = g.wires['DMM.HI'], l = g.wires['DMM.LO'];
        if (!(b > a) || !h || !l) continue;
        sum += diffMeanOver(g.sol, h, l, a, b) * (b - a) + (g.sol.kv[h] - g.sol.kv[l]) * devInt(g, a, b);
      }
      return sum / (t2 - t1);
    };
    const v = {
      dc: w.mean + off, ac: w.acRms, peak: w.peak + Math.abs(off), peakAc: w.peakAc,
      freq: sol.dc ? 0 : 1 / sol.period, now: t, meanOver,
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
