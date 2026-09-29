// 實驗台狀態：板上 RC 的值與接法、每條導線端接在哪個接點、探棒 1×／10× 開關。
// 提供示波器與電表的輸入（外殼在每次操作後呼叫 sync，電路有變才重算）。
import { solve, stats, LEADS, NODES } from './circuit.js';

export const R_OPTIONS = [100, 470, 1000, 2200, 4700, 10000, 47000, 100000];
export const C_OPTIONS = [0.001e-6, 0.01e-6, 0.047e-6, 0.1e-6, 0.47e-6, 1e-6, 10e-6];
export const fmtR = (r) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
export const fmtC = (c) => (c >= 1e-6 ? `${Number((c * 1e6).toPrecision(3))} µF` : `${Number((c * 1e9).toPrecision(3))} nF`);

// 示範接線：AFG CH1 → A、黑夾 → G；示波器 CH1 量輸入（A）、CH2 量 B；電表跨在 B–G
export const DEMO = {
  'AFG.CH1+': 'A', 'AFG.CH1-': 'G', 'TDS.CH1.TIP': 'A', 'TDS.CH1.GND': 'G',
  'TDS.CH2.TIP': 'B', 'TDS.CH2.GND': 'G', 'DMM.HI': 'B', 'DMM.LO': 'G',
};

export class Bench {
  constructor(afg) {
    this.afg = afg;
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
  }

  afgParams() {
    return this.afg.ch.map((c) => ({ wave: c.wave, freq: c.freq, sym: c.sym, emfVpp: c.emfVpp, emfOffset: c.emfOffset, output: c.output && this.afg.on }));
  }

  key() { return JSON.stringify([this.topo, this.R, this.C, this.wires, this.probeX, this.afgParams()]); }

  solution() {
    const k = this.key();
    if (k !== this.cacheKey) {
      this.cacheKey = k;
      this.sol = solve({ topo: this.topo, R: this.R, C: this.C, wires: this.wires }, this.afgParams());
    }
    return this.sol;
  }

  connect(lead, node) {
    this.wires[lead] = node;
    this.sel = null;
  }

  disconnect(lead) {
    delete this.wires[lead];
    this.sel = null;
  }

  // 示波器：每通道探棒尖端的週期波形（接點對大地）；尖端沒接＝沒有訊號
  tdsInput() {
    const sol = this.solution();
    const sig = [0, 1].map((i) => {
      const node = this.wires[`TDS.CH${i + 1}.TIP`];
      if (!node || sol.dc) return null;
      return { table: sol.v[node], period: sol.period };
    });
    return { sig, probe: [...this.probeX] };
  }

  // 電表：HI−LO 的直流／交流有效值；電阻只在電路沒通電時量（C 在直流下視為開路）
  dmmInput() {
    const hi = this.wires['DMM.HI'], lo = this.wires['DMM.LO'];
    if (!hi || !lo) return { v: null, ohm: null, why: '電表的 HI、LO 測試線要兩條都接上電路。' };
    const sol = this.solution();
    let v = { dc: 0, ac: 0 };
    if (!sol.dc) {
      const d = Float64Array.from(sol.v[hi], (x, k) => x - sol.v[lo][k]);
      const s = stats(d);
      v = { dc: s.mean, ac: s.acRms };
    }
    const powered = [0, 1].some((ch) => this.wires[`AFG.CH${ch + 1}+`] && this.afgParams()[ch].output);
    let ohm = null, whyR = '';
    if (powered) whyR = '電路通電中不能量電阻：先關 AFG 的 OUTPUT（或拔掉紅夾）。';
    else ohm = this.dcResistance(hi, lo);
    return { v, ohm, why: '', whyR, whyI: '實驗台目前只支援電壓（DCV、ACV）與電阻量測；量電流要把電表串進電路，還沒有提供。' };
  }

  // 直流電阻：接地夾／黑夾把接點接到大地（彼此相連）；電容開路；只有一顆電阻
  dcResistance(hi, lo) {
    const parent = { A: 'A', B: 'B', G: 'G', E: 'E' };
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    Object.entries(this.wires).forEach(([id, n]) => { if (n && LEADS[id].role === 'gnd') parent[find(n)] = find('E'); });
    const [rA, rB] = this.topo === 'RC' ? ['A', 'B'] : ['B', 'G'];
    const h = find(hi), l = find(lo);
    if (h === l) return 0.05; // 同一點（導線／接地相連）
    const ends = new Set([find(rA), find(rB)]);
    return ends.size === 2 && ends.has(h) && ends.has(l) ? this.R : Infinity;
  }

  leadsOn(node) { return Object.entries(this.wires).filter(([, n]) => n === node).map(([id]) => LEADS[id].name); }

  snapshot() {
    const sol = this.solution();
    const pp = Object.fromEntries(NODES.map((n) => [n, sol.dc ? 0 : stats(sol.v[n]).pp]));
    return { topo: this.topo, R: this.R, C: this.C, wires: { ...this.wires }, probeX: [...this.probeX], sel: this.sel, period: sol.period, tau: sol.tau, pp, warn: sol.warn.map((w) => w.text) };
  }
}
