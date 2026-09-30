// 實驗台狀態：固定 RC 板（R、C 的值與接法、A／B／G 接點）或麵包板（外殼掛上 bb＝Breadboard，導線接孔 bbWires），
// 探棒 1×／10× 開關，以及三台儀器（AFG、電表、GPE）的設定。提供示波器、電表、GPE 讀回的輸入。
// 電路一律由通用解算 solveNet 計算（src/bench/net.js）；固定 RC 板只是一個固定的電路描述。
// 時間：this.now()（秒，預設為頁面時鐘）。電路每變一次就開新的一段 { sol, built, from, to, t0, amp }，保留最近幾秒：
//   各電容電壓在變化那一刻連續（改變前一刻的電壓；新插上的電容從 0 V 開始），之後各模態以自己的時間常數衰減到新的週期穩態。
//   電表積分窗、示波器單次擷取往前看的部分，都照「當時那一段」的電路算：已完成的讀值不會被後來的操作改掉。
import { stats, LEADS, NODES, M } from './circuit.js';
import { solveNet, ohmsNet } from './net.js';

export const R_OPTIONS = [100, 470, 1000, 2200, 4700, 10000, 47000, 100000];
export const C_OPTIONS = [0.001e-6, 0.01e-6, 0.047e-6, 0.1e-6, 0.47e-6, 1e-6, 10e-6];
export const fmtR = (r) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
export const fmtC = (c) => (c >= 1e-6 ? `${Number((c * 1e6).toPrecision(3))} µF` : `${Number((c * 1e9).toPrecision(3))} nF`);
// 示波器輸入 1 MΩ（M-TDS-13 p.107）；10× 被動探棒尖端 10 MΩ
export const PROBE_R = { 1: 1e6, 10: 10e6 };
const HIST_S = 2; // 保留多久以前的電路狀態（秒）：電表積分窗 1/6 秒、示波器單次擷取往前看都在這之內
// 示波器連續採集取改變後這麼久的電路狀態（模擬器的取樣策略，不代表真機時序）；更短的暫態用 Single／Normal 擷取（見 TdsModel）
export const SCOPE_SETTLE = 0.05;
// GPE CH3／CH4 沒有限流旋鈕：實驗台以額定 1 A 當限流（PD，避免短路時電流無限大）
const GPE_FIXED_LIMIT = 1;

// 示範接線：AFG CH1 → A、黑夾 → G；示波器 CH1 量輸入（A）、CH2 量 B；電表跨在 B–G
export const DEMO = {
  'AFG.CH1+': 'A', 'AFG.CH1-': 'G', 'TDS.CH1.TIP': 'A', 'TDS.CH1.GND': 'G',
  'TDS.CH2.TIP': 'B', 'TDS.CH2.GND': 'G', 'DMM.HI': 'B', 'DMM.LO': 'G',
};

// ---- 某一段的暫態：各慢模態的偏移 amp_m·e^(−λ_m·(t−t0))（t0 之前視為不衰減）----
const decay = (g, t) => g.sol.lam.map((l) => Math.exp(-l * Math.max(0, t - g.t0)));
function devNode(g, node, t) {
  if (!g.amp.length || node == null || node === 'E') return 0;
  const w = g.sol.modeW(node), d = decay(g, t);
  let v = 0;
  for (let m = 0; m < w.length; m++) v += w[m] * g.amp[m] * d[m];
  return v;
}
// Σ_m w_m·amp_m·∫e^(−λ_m(t−t0))dt over [t1, t2]
function devInt(g, w, t1, t2) {
  if (!g.amp.length || !(t2 > t1)) return 0;
  let sum = 0;
  g.sol.lam.forEach((l, m) => {
    if (!w[m] || !g.amp[m]) return;
    const before = Math.max(0, Math.min(t2, g.t0) - Math.min(t1, g.t0));
    const a = Math.max(t1, g.t0), b = Math.max(t2, g.t0);
    const after = l > 0 ? (Math.exp(-l * (a - g.t0)) - Math.exp(-l * (b - g.t0))) / l : b - a;
    sum += w[m] * g.amp[m] * (before + after);
  });
  return sum;
}
const nodeIn = (g, node, t) => (node == null ? 0 : node === 'E' ? 0 : g.sol.nodeAt(node, t) + devNode(g, node, t));
// 某一段各電容在 t 的電壓 { 元件 id: V }
function capsAt(g, t) {
  const ss = g.sol.capSS(t), d = decay(g, t), out = {};
  g.sol.caps.forEach((id, k) => { let v = ss[k]; g.sol.capD[k]?.forEach((w, m) => { v += w * (g.amp[m] || 0) * d[m]; }); out[id] = v; });
  return out;
}

export class Bench {
  // dmm：查電表目前的輸入電阻（依功能不同）；gpe：直流電源的設定（麵包板用）；沒有就不計
  constructor(afg, dmm = null, gpe = null) {
    this.afg = afg;
    this.dmm = dmm;
    this.gpe = gpe;
    this.now = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000;
    this.board = 'rc'; // 'rc'＝固定 RC 板；'bb'＝麵包板（外殼掛 this.bb 與 this.bbWires）
    this.bbWires = {};
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

  // GPE 四路輸出的設定（開機、Output ON 才輸出）。實驗台目前只支援 Independent；Series／Parallel 時不輸出並提示
  gpeParams() {
    const g = this.gpe;
    if (!g?.on || !g.output) return { active: false, mode: g?.mode ?? 'INDEP', ch: [] };
    if (g.mode !== 'INDEP') return { active: false, mode: g.mode, ch: [] };
    return { active: true, mode: g.mode, ch: [1, 2, 3, 4].map((c) => ({ v: g.vset[c] / 100, ilim: c <= 2 ? g.iset[c] / 1000 : GPE_FIXED_LIMIT })) };
  }

  // 目前板子的導線位置（固定 RC 板＝接點 A／B／G；麵包板＝孔）
  leadMap() { return this.board === 'bb' ? this.bbWires : this.wires; }

  // 接上的儀器輸入電阻：探棒尖端對大地（依探棒開關），電表 HI–LO（依功能：DCV 10 MΩ、ACV 1 MΩ）。a、b＝導線 id
  loadLeads() {
    const L = [], W = this.leadMap();
    [0, 1].forEach((i) => { if (W[`TDS.CH${i + 1}.TIP`]) L.push({ a: `TDS.CH${i + 1}.TIP`, b: null, r: PROBE_R[this.probeX[i]] }); });
    const z = this.dmm?.inputZ?.();
    if (z && W['DMM.HI'] && W['DMM.LO']) L.push({ a: 'DMM.HI', b: 'DMM.LO', r: z });
    return L;
  }

  key() {
    const board = this.board === 'bb' ? [this.bb?.parts ?? [], this.bbWires] : [this.topo, this.R, this.C, this.wires];
    return JSON.stringify([this.board, board, this.probeX, this.afgParams(), this.gpeParams(), this.loadLeads()]);
  }

  // ---- 電路描述：把接地的導線（AFG 黑夾、示波器接地夾、GPE GND）併到大地 'E' ----
  build() {
    const W = this.leadMap(), warn = [];
    let nodes, elements, raw; // raw：導線 → 原始節點
    if (this.board === 'bb') {
      const nl = this.bb.netlist(W);
      nodes = [...nl.nodes];
      elements = nl.elements.map((e) => ({ ...e }));
      raw = nl.leads;
      warn.push(...(nl.warnings || []));
    } else {
      nodes = [...NODES];
      const [rA, rB] = this.topo === 'RC' ? ['A', 'B'] : ['B', 'G'], [cA, cB] = this.topo === 'RC' ? ['B', 'G'] : ['A', 'B'];
      elements = [{ id: 'R', kind: 'R', a: rA, b: rB, value: this.R }, { id: 'C', kind: 'C', a: cA, b: cB, value: this.C }];
      raw = { ...W };
    }
    const parent = new Map([...nodes, 'E'].map((x) => [x, x]));
    const find = (x) => { let y = x; while (parent.get(y) !== y) y = parent.get(y); parent.set(x, y); return y; };
    const union = (a, b) => { const x = find(a), y = find(b); if (x !== y) { if (y === 'E') parent.set(x, y); else parent.set(y, x); } };
    const grounds = Object.entries(raw).filter(([id, n]) => n && LEADS[id]?.role === 'gnd');
    for (const [, n] of grounds) union(n, 'E');
    const node = (x) => (x == null ? null : find(x));
    const leadNode = Object.fromEntries(Object.entries(raw).filter(([, n]) => n).map(([id, n]) => [id, node(n)]));
    elements = elements.map((e) => ({ ...e, a: node(e.a), b: node(e.b) }));
    const netNodes = [...new Set(nodes.map(find))].filter((x) => x !== 'E');

    // 固定 RC 板的接線提醒（與原本相同）
    if (this.board !== 'bb') {
      const [R, C] = elements;
      if (C.a === C.b) warn.push({ level: 'bad', text: `電容兩端被接到同一點（${this.topo === 'RC' ? 'B、G' : 'A、B'} 都接到大地或彼此相連），電容被短路。` });
      if (R.a === R.b) warn.push({ level: 'bad', text: `電阻兩端被接到同一點（${this.topo === 'RC' ? 'A、B' : 'B、G'}），電阻被短路。` });
      for (const [id, n] of grounds) if (id.startsWith('TDS') && n !== 'G') warn.push({ level: 'bad', text: `${LEADS[id].name}接在 ${n}：示波器接地夾就是大地，${n} 點被直接接地（量元件兩端時不能把接地夾夾在中間點）。` });
    }
    // AFG：紅夾接在哪一點（Output ON 才算）；黑夾＝大地
    const afgP = this.afgParams(), afg = [];
    [0, 1].forEach((ch) => {
      const red = leadNode[`AFG.CH${ch + 1}+`];
      if (!red) return;
      if (!afgP[ch].output) { warn.push({ level: 'info', text: `AFG CH${ch + 1} 紅夾已接，但輸出是 OFF（按 AFG 的 OUTPUT 開啟）。` }); return; }
      if (red === 'E') { warn.push({ level: 'bad', text: `AFG CH${ch + 1} 紅夾接在接地點：輸出被短路到地。` }); return; }
      afg.push({ node: red, p: afgP[ch], ch });
    });
    if (afg.length && !Object.values(leadNode).includes('E')) warn.push({ level: 'bad', text: '電路沒有接回地：AFG 黑夾和示波器接地夾都沒接到電路，沒有電流回路。' });
    if (!Object.keys(W).some((id) => id.startsWith('AFG') && id.endsWith('+') && W[id]) && this.board !== 'bb') warn.push({ level: 'info', text: '還沒有接 AFG 紅夾（訊號源）。' });
    if (afg.length > 1 && Math.abs(afg[0].p.freq - afg[1].p.freq) > 1e-9 * afg[0].p.freq) warn.push({ level: 'info', text: '兩個 AFG 通道頻率不同：本模擬以 CH1 的週期計算，畫面只是近似。' });
    // GPE：兩條導線都接上的通道才形成迴路
    const gp = this.gpeParams(), gpe = [];
    if (this.gpe && !gp.active && gp.mode !== 'INDEP' && Object.keys(W).some((id) => id.startsWith('GPE.CH') && W[id])) {
      warn.push({ level: 'info', text: `GPE 在 ${gp.mode === 'SER' ? 'Series' : 'Parallel'} 模式：實驗台目前只支援 Independent，輸出當作關閉。` });
    }
    if (gp.active) {
      gp.ch.forEach((c, k) => {
        const pos = leadNode[`GPE.CH${k + 1}+`], neg = leadNode[`GPE.CH${k + 1}-`];
        if (!pos || !neg) return; // ＋－接在一起的短路提醒由麵包板模型給（GPE 會進入 CC 限流）
        gpe.push({ id: `GPE${k + 1}`, ch: k + 1, pos, neg, v: c.v, ilim: c.ilim });
      });
    }
    // 儀器輸入電阻
    const loads = this.loadLeads().map((L) => ({ a: leadNode[L.a], b: L.b ? leadNode[L.b] : 'E', r: L.r })).filter((L) => L.a && L.b && L.a !== L.b);
    return { net: { nodes: netNodes, elements, loads, afg }, gpe, leadNode, warn, find: node };
  }

  // 解算，GPE 依直流工作點決定 CV／CC（超過限流→CC；CC 時端電壓超過設定→回 CV），最多幾輪
  solveBuilt(b) {
    const modes = b.gpe.map(() => 'CV');
    let sol;
    for (let it = 0; it < 8; it++) {
      sol = solveNet({ ...b.net, dc: b.gpe.map((c, k) => ({ id: c.id, pos: c.pos, neg: c.neg, v: c.v, i: c.ilim, mode: modes[k] })) });
      let changed = false;
      sol.dcOut.forEach((o, k) => {
        const c = b.gpe[k];
        if (modes[k] === 'CV' && o.i > c.ilim * (1 + 1e-9)) { modes[k] = 'CC'; changed = true; } else if (modes[k] === 'CC' && o.v > c.v * (1 + 1e-9)) { modes[k] = 'CV'; changed = true; }
      });
      if (!changed) break;
    }
    return { sol, modes };
  }

  solution() {
    const k = this.key();
    if (k !== this.cacheKey) {
      const t = this.now(), prev = this.cur;
      const before = prev ? capsAt(prev, t) : {}; // 變化前一刻各電容的電壓
      this.cacheKey = k;
      const built = this.build(), { sol, modes } = this.solveBuilt(built);
      sol.warn = built.warn;
      if (this.board !== 'bb') { // 固定 RC 板：A／B／G 的取樣表與相容欄位（測試、畫面沿用）
        sol.v = Object.fromEntries(NODES.map((x) => [x, sol.table(built.find(x))]));
      }
      sol.tau = sol.tauMax;
      const amp = sol.modalFromCaps(sol.caps.map((id) => before[id] ?? 0), t); // 新插上的電容從 0 V 開始
      if (prev) prev.to = t;
      this.segs.push({ sol, built, modes, from: prev ? t : -Infinity, to: Infinity, t0: t, amp });
      this.segs = this.segs.filter((g) => g.to > t - HIST_S);
    }
    return this.cur.sol;
  }

  // 接點名稱（固定 RC 板的 A／B／G、麵包板的節點）→ 解算用的節點（接地的＝'E'）
  node(x) { this.solution(); return this.cur.built.find(x); }

  // 第一顆電容偏離週期穩態的電壓（固定 RC 板只有一顆；相容舊介面）
  dev(t = this.now()) {
    this.solution();
    const g = this.cur, id = g.sol.caps[0];
    if (id == null) return 0;
    const d = decay(g, t);
    return (g.sol.capD[0] || []).reduce((s, w, m) => s + w * (g.amp[m] || 0) * d[m], 0);
  }

  // 第一顆電容的電壓（相容舊介面）
  vcAt(t) { this.solution(); const g = this.cur, id = g.sol.caps[0]; return id == null ? 0 : capsAt(g, t)[id]; }

  // 最近一次電路改變的時刻（第一段＝第一次計算的時刻）
  changedAt() { this.solution(); return this.cur.t0; }

  // 還在充放電（任一接點偏離穩態超過 1 µV）：外殼要定時更新畫面
  transientActive(t = this.now()) {
    this.solution();
    const g = this.cur;
    if (!g.amp.some((a) => Math.abs(a) > 1e-9)) return false;
    return g.sol.names.some((x) => Math.abs(devNode(g, x, t)) > 1e-6);
  }

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
  tdsInput() {
    const sol = this.solution(), g = this.cur, now = this.now(), tView = Math.max(now, g.t0 + SCOPE_SETTLE);
    const sig = [0, 1].map((i) => {
      const lead = `TDS.CH${i + 1}.TIP`, node = g.built.leadNode[lead];
      if (!node) return null;
      const off = devNode(g, node, tView);
      const abs = (t) => { const h = this.segAt(t); return nodeIn(h, h.built.leadNode[lead], t); };
      if (node === 'E') return { table: new Float64Array(M), period: sol.period, at: () => 0, abs };
      const tb = sol.table(node);
      return { table: Float64Array.from(tb, (x) => x + off), period: sol.period, at: (t) => sol.nodeAt(node, t) + off, abs };
    });
    return { sig, probe: [...this.probeX], now, tView, changedAt: g.t0, tau: sol.tauMax };
  }

  // 電表：HI−LO 的電壓。dc＝整週期平均（含目前暫態）、meanOver(t1,t2)＝時間窗平均（DCV 積分用）、
  // ac＝交流有效值、peak／peakAc＝瞬間最大值／交流峰值（自動量程看峰值）、freq＝訊號頻率、now＝目前時間。
  // 電阻只在電路沒通電時量（C 在直流下視為開路）。
  dmmInput() {
    const W = this.leadMap();
    if (!W['DMM.HI'] || !W['DMM.LO']) return { v: null, ohm: null, why: '電表的 HI、LO 測試線要兩條都接上電路。' };
    const sol = this.solution(), g = this.cur, t = this.now(), hi = g.built.leadNode['DMM.HI'], lo = g.built.leadNode['DMM.LO'];
    const w = sol.stats(hi, lo), off = devNode(g, hi, t) - devNode(g, lo, t);
    // 積分窗 [t1, t2]：每一小段照「當時」的電路與測試線位置算（當時測試線沒接好就當 0 V）
    const meanOver = (t1, t2) => {
      let sum = 0;
      for (const s of this.segs) {
        const a = Math.max(t1, s.from), b = Math.min(t2, s.to), h = s.built.leadNode['DMM.HI'], l = s.built.leadNode['DMM.LO'];
        if (!(b > a) || !h || !l) continue;
        const wh = h === 'E' ? s.sol.lam.map(() => 0) : s.sol.modeW(h), wl = l === 'E' ? s.sol.lam.map(() => 0) : s.sol.modeW(l);
        sum += s.sol.meanOver(h, l, a, b) * (b - a) + devInt(s, wh.map((x, m) => x - wl[m]), a, b);
      }
      return sum / (t2 - t1);
    };
    const v = {
      dc: w.mean + off, ac: w.acRms, peak: w.peak + Math.abs(off), peakAc: w.peakAc,
      freq: sol.periodic ? 1 / sol.period : 0, now: t, meanOver,
    };
    const powered = g.built.net.afg.length > 0 || g.built.gpe.length > 0;
    let ohm = null, whyR = '';
    if (powered) whyR = '電路通電中不能量電阻：先關 AFG 的 OUTPUT（或拔掉紅夾）、GPE 的 Output。';
    else ohm = ohmsNet(g.built.net, hi, lo);
    return { v, ohm, why: '', whyR, whyI: '實驗台目前只支援電壓（DCV、ACV）與電阻量測；量電流要把電表串進電路，還沒有提供。' };
  }

  // GPE 四路讀回（實驗台）：接上兩條導線的通道＝電路實際的端電壓、電流與 CV／CC；沒接成迴路＝開路（設定電壓、0 A）
  gpeInput() {
    const gp = this.gpeParams();
    if (!gp.active) return null;
    this.solution();
    const out = {};
    gp.ch.forEach((c, k) => {
      const j = this.cur.built.gpe.findIndex((x) => x.ch === k + 1);
      if (j < 0) { out[k + 1] = { v: c.v, i: 0, cc: false }; return; }
      const o = this.cur.sol.dcOut[j];
      out[k + 1] = { v: Math.max(0, o.v), i: Math.max(0, Math.min(o.i, c.ilim)), cc: this.cur.modes[j] === 'CC' };
    });
    return out;
  }

  leadsOn(node) { return Object.entries(this.wires).filter(([, n]) => n === node).map(([id]) => LEADS[id].name); }

  snapshot() {
    const sol = this.solution(), g = this.cur, t = this.now(), d = this.dev(t);
    const names = this.board === 'bb' ? g.built.net.nodes : NODES;
    const res = (x) => (this.board === 'bb' ? x : g.built.find(x));
    const pp = Object.fromEntries(names.map((n) => [n, res(n) === 'E' ? 0 : stats(sol.table(res(n))).pp]));
    const ssMean = Object.fromEntries(names.map((n) => [n, res(n) === 'E' ? 0 : sol.stats(res(n), 'E').mean]));
    const dcNow = Object.fromEntries(names.map((n) => [n, ssMean[n] + devNode(g, res(n), t)]));
    return {
      board: this.board, topo: this.topo, R: this.R, C: this.C, wires: { ...this.wires }, bbWires: { ...this.bbWires }, probeX: [...this.probeX], sel: this.sel,
      period: sol.period, tau: sol.tauMax, modes: sol.lam.map((l) => 1 / l), pp, ssMean, dcNow, dev: d,
      loads: g.built.net.loads, gpe: this.gpeInput(), gpeModes: g.modes, warn: sol.warn.map((w) => w.text),
    };
  }
}
