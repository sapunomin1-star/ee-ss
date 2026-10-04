// 實驗台狀態：固定 RC 板（R、C 的值與接法、A／B／G 接點）或麵包板（外殼掛上 bb＝Breadboard，導線接孔 bbWires），
// 探棒 1×／10× 開關，以及三台儀器（AFG、電表、GPE）的設定。提供示波器、電表、GPE 讀回的輸入。
// 電路一律由通用解算 solveNet 計算（src/bench/net.js）；固定 RC 板只是一個固定的電路描述。
// 時間：this.now()（秒，預設為頁面時鐘）。電路每變一次就開新的一段 { sol, built, from, to, t0, amp }，保留操作歷史：
//   各電容電壓在變化那一刻連續（改變前一刻的電壓；新插上的電容從 0 V 開始），之後各模態以自己的時間常數衰減到新的週期穩態。
//   電表積分窗、示波器單次擷取往前看的部分，都照「當時那一段」的電路算：已完成的讀值不會被後來的操作改掉。
import { stats, LEADS, NODES, M } from './circuit.js';
import { solveNet, ohmsNet, R_GPE } from './net.js';
import { hybridSeg } from './hybrid.js';
import { APERTURE } from '../instruments/dmm/model.js';
import { fourWireResistance, equivalentCapacitance } from './measure.js';
import { centeredSquareIntegral } from './window-rms.js';
import { nodePairPeakOver } from './window-peak.js';

export const R_OPTIONS = [100, 470, 1000, 2200, 4700, 10000, 47000, 100000];
export const C_OPTIONS = [0.001e-6, 0.01e-6, 0.047e-6, 0.1e-6, 0.47e-6, 1e-6, 10e-6];
export const fmtR = (r) => (r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`);
export const fmtC = (c) => (c >= 1e-6 ? `${Number((c * 1e6).toPrecision(3))} µF` : `${Number((c * 1e9).toPrecision(3))} nF`);
// 示波器輸入 1 MΩ（M-TDS-13 p.107）；10× 被動探棒尖端 10 MΩ
export const PROBE_R = { 1: 1e6, 10: 10e6 };
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
  if (g.sol.actualNodeAt) return g.sol.actualNodeAt(node, t) - g.sol.nodeAt(node, t);
  if (!g.amp.length || node == null || node === 'E') return 0;
  const w = g.sol.modeW(node), d = decay(g, t);
  let v = 0;
  for (let m = 0; m < w.length; m++) v += w[m] * g.amp[m] * d[m];
  return v;
}
// Σ_m w_m·amp_m·∫(e^(−λ_m(t−t0))−1)dt over [t1, t2]
function devDeltaInt(g, w, t1, t2) {
  if (!g.amp.length || !(t2 > t1)) return 0;
  let sum = 0;
  g.sol.lam.forEach((l, m) => {
    if (!w[m] || !g.amp[m]) return;
    const a = Math.max(t1, g.t0), b = Math.max(t2, g.t0);
    const dt = b - a, z = l * dt;
    // (1−e^−z)/z−1＝−z/2＋z²/6−…，小 z 不做兩個接近 1 的數相減。
    let delta;
    if (z < 0.2) {
      let term = -z / 2; delta = term;
      for (let j = 3; j < 25; j++) { term *= -z / j; delta += term; }
    } else delta = -Math.expm1(-z) / z - 1;
    sum += w[m] * g.amp[m] * dt * (Math.expm1(-l * (a - g.t0)) + Math.exp(-l * (a - g.t0)) * delta);
  });
  return sum;
}
const devDeltaNode = (g, node, t) => g.sol.modeW(node).reduce((sum, w, m) => sum + w * (g.amp[m] || 0) * Math.expm1(-g.sol.lam[m] * Math.max(0, t - g.t0)), 0);
const nodeIn = (g, node, t) => node == null || node === 'E' ? 0 : g.sol.actualNodeAt ? g.sol.actualNodeAt(node, t) : g.initial && g.sol.modeW(node).some((w) => w !== 0)
  ? g.initial.nodeAt(node) + g.sol.nodeChange(node, t, g.t0) + devDeltaNode(g, node, t) : g.sol.nodeAt(node, t);
const frozenMean = (g, node, t) => g.sol.actualMeanOver ? g.sol.actualMeanOver(node, 'E', t, t + g.sol.period)
  : nodeIn(g, node, t) + g.sol.meanChangeOver(node, 'E', 0, g.sol.period, t);
const expDiff = (a, b) => a <= b ? Math.exp(-a) * -Math.expm1(-(b - a)) : Math.exp(-b) * Math.expm1(-(a - b));
// 某一段各電容在 t 的電壓 { 元件生命週期識別碼: V }
function capsAt(g, t) {
  if (g.sol.capActual) { const voltages = g.sol.capActual(t); return Object.fromEntries(g.sol.capKeys.map((id, k) => [id, voltages[k]])); }
  const ss = g.sol.capSS(t), out = {};
  g.sol.capKeys.forEach((id, k) => {
    let v = ss[k];
    if (g.initial && g.sol.capD[k].some((w) => w !== 0)) {
      const c = g.sol.capIdx[k];
      v = g.initial.capInitial[k] + g.sol.nodeChange(g.sol.names[c.a], t, g.t0) - g.sol.nodeChange(g.sol.names[c.b], t, g.t0);
      g.sol.capD[k].forEach((w, m) => { v += w * (g.amp[m] || 0) * Math.expm1(-g.sol.lam[m] * Math.max(0, t - g.t0)); });
    }
    out[id] = v;
  });
  return out;
}
function noiseAffects(built, nodes) {
  const seen = new Set(built.net.afg.filter((s) => s.p.wave === 'NOISE').map((s) => s.node));
  if (!seen.size) return false;
  const edges = [...built.net.elements, ...built.net.loads, ...built.gpe.map((s) => ({ a: s.pos, b: s.neg }))];
  // Ideal earth cannot carry a voltage perturbation from an unrelated circuit.
  for (let changed = true; changed;) {
    changed = false;
    for (const e of edges) if (e.a !== 'E' && e.b !== 'E' && seen.has(e.a) !== seen.has(e.b)) {
      seen.add(e.a); seen.add(e.b); changed = true;
    }
  }
  return nodes.some((n) => n !== 'E' && seen.has(n));
}
function frequencyClues(built, nodes) {
  const seen = new Set(nodes.filter((n) => n && n !== 'E'));
  const edges = [...built.net.elements, ...built.net.loads, ...built.gpe.map((s) => ({ a: s.pos, b: s.neg }))];
  for (let changed = true; changed;) {
    changed = false;
    for (const e of edges) if (e.a !== 'E' && e.b !== 'E' && seen.has(e.a) !== seen.has(e.b)) {
      seen.add(e.a); seen.add(e.b); changed = true;
    }
  }
  const sources = built.net.afg.filter((s) => seen.has(s.node));
  return { carrierFreq: Math.max(0, ...sources.map((s) => s.p.carrierFreq ?? s.p.freq)),
    maxFreq: Math.max(0, ...sources.map((s) => s.p.maxCarrierFreq ?? s.p.freq)) };
}

// GPE 第 k 路在某一段、時刻 t 的端電壓與輸出電流（瞬間週期電壓＋暫態）。
function chanAt(g, k, t) {
  const c = g.built.gpe[k], m = g.modeAt ? g.modeAt(t)[k] : g.modes[k];
  if (c.pos === c.neg) return { v: 0, i: m === 'CC' ? c.ilim : m === 'RB' ? 0 : Infinity };
  const v = nodeIn(g, c.pos, t) - nodeIn(g, c.neg, t);
  return { v, i: m === 'CC' ? c.ilim : m === 'RB' ? 0 : (c.v - v) / R_GPE };
}
const nextMode = (c, m, { v, i }) => m === 'CV'
  ? (i > c.ilim + 1e-8 * Math.max(1, c.ilim) ? 'CC' : i < -1e-6 ? 'RB' : m)
  : m === 'CC' ? (v > c.v - c.ilim * R_GPE + 1e-9 ? 'CV' : m) : v < c.v * (1 - 1e-9) ? 'CV' : m;
// 幾路電源互相影響時，同時更新所有模式可能在幾組不合法模式間循環。
// 先試快速迭代，遇到循環再有限枚舉（最多四路，3⁴＝81 組），逐路驗證。
function resolveModes(channels, initial, t, candidate) {
  const seen = new Set(); let modes = [...initial], g;
  const legal = (s) => channels.every((c, k) => nextMode(c, s.modes[k], chanAt(s, k, t)) === s.modes[k]);
  for (let it = 0; it < 16; it++) {
    const key = modes.join('|');
    if (seen.has(key)) break;
    seen.add(key); g = candidate(modes);
    if (legal(g)) return g;
    modes = modes.map((m, k) => nextMode(channels[k], m, chanAt(g, k, t)));
  }
  for (let code = 0; code < 3 ** channels.length; code++) {
    let value = code;
    const choice = channels.map(() => { const mode = ['CV', 'CC', 'RB'][value % 3]; value = Math.floor(value / 3); return mode; });
    const s = candidate(choice);
    if (legal(s)) return s;
  }
  // 無法找到一致工作點時不宣稱此接法的保護有效。
  g.modesUnsupported = true;
  return g;
}
// 共用大地不會把獨立迴路併成一組；只有非接地節點之間的元件或
// 浮接電源才建立耦合。只把 AFG／GPE 真正共用的含電容組列為限制。
function periodicGroups(built) {
  const parent = new Map(built.net.nodes.map((n) => [n, n]));
  const find = (n) => {
    if (n == null || n === 'E' || !parent.has(n)) return null;
    const p = parent.get(n); if (p !== n) parent.set(n, find(p)); return parent.get(n);
  };
  const join = (a, b) => { const x = find(a), y = find(b); if (x != null && y != null) parent.set(x, y); };
  built.net.elements.forEach((e) => join(e.a, e.b));
  (built.net.loads || []).forEach((e) => join(e.a, e.b));
  built.gpe.forEach((c) => join(c.pos, c.neg));
  const afg = new Set((built.net.afg || []).map((s) => find(s.node)));
  const caps = new Set(built.net.elements.filter((e) => e.kind === 'C' && e.a !== e.b).map((e) => find(e.a) ?? find(e.b)));
  const indices = [], dynamic = [];
  built.gpe.forEach((c, k) => {
    const group = find(c.pos) ?? find(c.neg);
    if (group == null || !afg.has(group)) return;
    (caps.has(group) ? dynamic : indices).push(k);
  });
  const groups = new Set(indices.map((k) => find(built.gpe[k].pos) ?? find(built.gpe[k].neg)));
  return { indices, dynamic, nodes: new Set(built.net.nodes.filter((n) => groups.has(find(n)))) };
}
const QUAD8 = [[0.1834346424956498, 0.362683783378362], [0.525532409916329, 0.3137066458778873],
  [0.7966664774136267, 0.2223810344533745], [0.9602898564975363, 0.1012285362903763]].flatMap(([u, w]) => [[-u, w], [u, w]]);

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

  get cur() { return this.segAt(this.now()); }
  // 絕對時間 t 時的電路狀態（那一段）
  segAt(t) {
    for (let i = this.segs.length - 1; i >= 0; i--) if (this.segs[i].from <= t) return this.segs[i];
    return this.segs[0];
  }

  afgParams(time) {
    return this.afg.ch.map((c, i) => {
      const driver = this.afg.driverDescriptor?.(i, time);
      if (driver) return { ...driver, output: driver.output && this.afg.on };
      return { wave: c.wave, freq: c.freq, sym: c.sym, duty: c.duty ?? 50, phase: ['SQUARE', 'PULSE', 'NOISE'].includes(c.wave) ? 0 : c.phase ?? 0, extended: c.extended, emfVpp: c.emfVpp, emfOffset: c.emfOffset, output: c.output && this.afg.on };
    });
  }

  // GPE 四路輸出的設定（開機、Output ON 才輸出）。各路的有效電壓／限流照 GPE 模型的 eff()：
  //   Series＝CH2 電壓跟 CH1、限流各自；Parallel＝CH2 也用 CH1 的電壓與限流（兩路並接時合計 2×I1）。
  //   兩路之間的內部接法手冊沒寫清楚：實驗台不假設內部相連，由學生照手冊在麵包板上接（近似）
  gpeParams() {
    const g = this.gpe;
    if (!g?.on || !g.output) return { active: false, mode: g?.mode ?? 'INDEP', ch: [] };
    return { active: true, mode: g.mode, ch: [1, 2, 3, 4].map((c) => { const e = g.eff(c); return { v: e.vs, ilim: e.is ?? GPE_FIXED_LIMIT }; }) };
  }

  // 目前板子的導線位置（固定 RC 板＝接點 A／B／G；麵包板＝孔）
  leadMap() { return this.board === 'bb' ? this.bbWires : this.wires; }

  // 接上的儀器負載：探棒對大地、電壓端 HI–LO、電流端 I–LO 分流。a、b＝導線 id。
  loadLeads() {
    const L = [], W = this.leadMap();
    [0, 1].forEach((i) => { if (W[`TDS.CH${i + 1}.TIP`]) L.push({ a: `TDS.CH${i + 1}.TIP`, b: null, r: PROBE_R[this.probeX[i]] }); });
    const z = this.dmm?.inputZ?.();
    if (z && W['DMM.HI'] && W['DMM.LO']) L.push({ a: 'DMM.HI', b: 'DMM.LO', r: z });
    const senseZ = this.dmm?.senseInputZ?.();
    if (senseZ && W['DMM.LO']) for (const id of ['DMM.SHI', 'DMM.SLO'])
      if (W[id]) L.push({ a: id, b: 'DMM.LO', r: senseZ });
    const shunt = this.dmm?.currentShunt?.();
    if (shunt && W['DMM.I'] && W['DMM.LO']) L.push({ a: 'DMM.I', b: 'DMM.LO', r: shunt, current: true });
    return L;
  }

  key() {
    const board = this.board === 'bb' ? [this.bb?.parts ?? [], this.bbWires] : [this.topo, this.R, this.C, this.wires];
    return JSON.stringify([this.board, board, this.probeX, this.afgParams(), this.gpeParams(), this.loadLeads()]);
  }

  // ---- 電路描述：把接地的導線（AFG 黑夾、示波器接地夾、GPE GND）併到大地 'E' ----
  build(afgParams = this.afgParams(this.now())) {
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
    const pre = elements;
    elements = elements.map((e) => ({ ...e, a: node(e.a), b: node(e.b) }));
    // 接地的導線（接地夾、黑夾、GPE GND）把元件兩端都接到大地 → 被短路（麵包板模型只看得到插法本身的短路）
    if (this.board === 'bb') {
      pre.forEach((e, i) => {
        if (e.a === e.b || elements[i].a !== elements[i].b) return;
        const by = grounds.filter(([, n]) => find(n) === elements[i].a).map(([id]) => LEADS[id].name).join('、');
        warn.push({ level: 'bad', text: `${e.id} 兩端都經接地的導線接到大地（${by}），被短路了；示波器的接地夾都是大地，不能夾在元件兩端。` });
      });
    }
    const netNodes = [...new Set(nodes.map(find))].filter((x) => x !== 'E');

    // 固定 RC 板的接線提醒（與原本相同）
    if (this.board !== 'bb') {
      const [R, C] = elements;
      if (C.a === C.b) warn.push({ level: 'bad', text: `電容兩端被接到同一點（${this.topo === 'RC' ? 'B、G' : 'A、B'} 都接到大地或彼此相連），電容被短路。` });
      if (R.a === R.b) warn.push({ level: 'bad', text: `電阻兩端被接到同一點（${this.topo === 'RC' ? 'A、B' : 'B、G'}），電阻被短路。` });
      for (const [id, n] of grounds) if (id.startsWith('TDS') && n !== 'G') warn.push({ level: 'bad', text: `${LEADS[id].name}接在 ${n}：示波器接地夾就是大地，${n} 點被直接接地（量元件兩端時不能把接地夾夾在中間點）。` });
    }
    // AFG：紅夾接在哪一點（Output ON 才算）；黑夾＝大地
    // Each circuit segment owns its waveform settings. Later ARB edits and
    // motion changes must never change a lazy historical protection solution.
    const afgP = afgParams.map((p) => ({ ...p, extended: p.extended ? JSON.parse(JSON.stringify(p.extended)) : undefined })), afg = [];
    [0, 1].forEach((ch) => {
      const red = leadNode[`AFG.CH${ch + 1}+`];
      if (!red) return;
      if (!afgP[ch].output) { warn.push({ level: 'info', text: `AFG CH${ch + 1} 紅夾已接，但輸出是 OFF（按 AFG 的 OUTPUT 開啟）。` }); return; }
      if (red === 'E') { warn.push({ level: 'bad', text: `AFG CH${ch + 1} 紅夾接在接地點：輸出被短路到地。` }); return; }
      afg.push({ node: red, p: afgP[ch], ch });
    });
    if (afg.length && !Object.values(leadNode).includes('E')) warn.push({ level: 'bad', text: '電路沒有接回地：AFG 黑夾和示波器接地夾都沒接到電路，沒有電流回路。' });
    if (!Object.keys(W).some((id) => (id.startsWith('AFG') || id.startsWith('GPE.CH')) && id.endsWith('+') && W[id]) && this.board !== 'bb') warn.push({ level: 'info', text: '還沒有接訊號源：可接 AFG 紅夾，或 GPE 的＋、−端子。' });
    // GPE：兩條導線都接上的通道才形成迴路
    const gp = this.gpeParams(), gpe = [];
    if (gp.active && gp.mode !== 'INDEP' && Object.keys(W).some((id) => id.startsWith('GPE.CH') && W[id])) {
      warn.push({ level: 'info', text: gp.mode === 'SER'
        ? 'GPE Series：CH2 的電壓跟 CH1、限流各自（近似）；兩路之間不自動相連，串聯要自己在麵包板上把 CH1− 接到 CH2＋。'
        : 'GPE Parallel：CH2 也輸出 CH1 的電壓與限流（近似）；兩路之間不自動相連，並聯要自己把兩路的＋、−各自接在一起。' });
    }
    if (gp.active) {
      gp.ch.forEach((c, k) => {
        const pos = leadNode[`GPE.CH${k + 1}+`], neg = leadNode[`GPE.CH${k + 1}-`];
        if (!pos || !neg) return;
        if (pos === neg && raw[`GPE.CH${k + 1}+`] !== raw[`GPE.CH${k + 1}-`] && find(raw[`GPE.CH${k + 1}+`]) === 'E') {
          warn.push({ level: 'bad', text: `GPE CH${k + 1} 的＋與−都經接地的導線接到大地，電源被短路（會進入 CC 限流）。` });
        }
        gpe.push({ id: `GPE${k + 1}`, ch: k + 1, pos, neg, v: c.v, ilim: c.ilim });
      });
    }
    // 電流端確實形成一條負載支路；量測的是該支路電流，並非拿 HI 電壓除板上電阻。
    const instrumentLoads = this.loadLeads().map((L) => ({ a: leadNode[L.a], b: L.b ? leadNode[L.b] : 'E', r: L.r, ...(L.current ? { current: true } : {}) }));
    const current = instrumentLoads.find((L) => L.current) ?? null;
    const loads = instrumentLoads.filter((L) => L.a && L.b && L.a !== L.b);
    if (current) {
      const { a, b, r } = current, same = (x, y) => x === a && y === b || x === b && y === a;
      warn.push({ level: 'info', text: `電表 I–LO 保留 ${Number(r.toPrecision(5))} Ω 等效分流負載（以原廠負擔電壓上限推算的教學近似，非原廠內阻）；切其他功能或關機仍導通，不模擬保險絲熔斷。` });
      if (a === b) warn.push({ level: 'bad', text: '電表 I 與 LO 接在同一電氣節點，沒有串入回路；讀到 0 A 不能代表原回路沒有電流。' });
      else if (gpe.some((s) => same(s.pos, s.neg)) || afg.some((s) => same(s.node, 'E'))) {
        warn.push({ level: 'bad', text: '電表 I–LO 直接並接在電源兩端，形成低阻負載：電流表應先拆開回路再串入。沒有模擬保險絲熔斷，不能把限流或讀值當成安全接法。' });
      } else if (elements.some((e) => same(e.a, e.b))) warn.push({ level: 'bad', text: '電表 I–LO 與元件並聯，量到的是分流支路而非該元件電流，並會旁路原元件；量電流應拆開回路再串入。' });
    }
    // 通電範圍：和有輸出的電源（AFG、GPE）以元件、儀器輸入電阻或電源本身相連的接點（量電阻時要避開）
    const cp = new Map(), cf = (x) => { if (!cp.has(x)) cp.set(x, x); let y = x; while (cp.get(y) !== y) y = cp.get(y); cp.set(x, y); return y; };
    const cu = (a, b) => { if (a != null && b != null) cp.set(cf(a), cf(b)); };
    elements.forEach((e) => cu(e.a, e.b)); loads.forEach((L) => cu(L.a, L.b));
    afg.forEach((s) => cu(s.node, 'E')); gpe.forEach((s) => cu(s.pos, s.neg));
    const live = new Set([...afg.map((s) => cf(s.node)), ...gpe.map((s) => cf(s.pos))]);
    const powered = (x) => x != null && live.has(cf(x));
    return { net: { nodes: netNodes, elements, loads, afg }, gpe, leadNode, current, probeX: [...this.probeX], warn, find: node, powered };
  }

  // 一段電路狀態：從 t0 起，GPE 各路用 modes（CV／CC／RB）。模式依「t0 當下」的狀態決定（含電容電壓），
  //   不是只看最後的穩態：例如開輸出時電容還沒充電，電流超過限流就先 CC（線性充電），之後再回 CV。
  makeSeg(built, caps, t0, hint) {
    const variants = new Map();
    const candidate = (modes) => {
      const key = modes.join('|');
      if (variants.has(key)) return variants.get(key);
      const sol = solveNet({ ...built.net, dc: built.gpe.map((c, k) => ({ id: c.id, pos: c.pos, neg: c.neg, v: c.v, i: c.ilim, mode: modes[k] })) }, { retainFastModes: built.gpe.length > 0 });
      const initial = sol.initialStateFromCaps(sol.capKeys.map((id) => caps[id] ?? 0), t0);
      const seg = { sol, built, modes: [...modes], t0, from: t0, to: Infinity, initial, amp: initial.amp }; // 新插上的電容從 0 V 開始
      variants.set(key, seg); return seg;
    };
    const seg = resolveModes(built.gpe, hint || built.gpe.map(() => 'CV'), t0, candidate);
    const sol = seg.sol;
    sol.warn = [...built.warn];
    if (seg.modesUnsupported) sol.warn.push({ level: 'bad', text: '目前不支援此多電源接法：無法找到一致的 CV／CC／逆灌工作點，波形及保護讀回無效。' });
    built.gpe.forEach((c, k) => {
      if (seg.modes[k] === 'RB') sol.warn.push({ level: 'bad', text: `GPE CH${c.ch} 被其他電源灌入：端電壓高於設定的 ${c.v.toFixed(2)} V。電源不能吸收電流，會失去穩壓（真機可能損壞）；不同電壓的兩路不要直接並接。` });
    });
    if (this.board !== 'bb') sol.v = Object.fromEntries(NODES.map((x) => [x, sol.table(built.find(x))])); // 固定 RC 板：A／B／G 取樣表（相容）
    sol.tau = sol.tauMax;
    return seg;
  }

  // 沒有電容的電路沒有需要承接的動態狀態。每個 AFG 線性取樣區間內，
  // 直接找出合法的 CV／CC／RB 工作點與交界，組成可無限重複的週期。
  // 如此即使過了數千個週期，讀回、示波器及電表仍看同一個受限的波形。
  periodicSeg(seg) {
    const { built } = seg, variants = new Map(), thisBench = this;
    const variant = (modes) => {
      const key = modes.join('|');
      if (!variants.has(key)) {
        const sol = solveNet({ ...built.net, dc: built.gpe.map((c, k) => ({ id: c.id, pos: c.pos, neg: c.neg, v: c.v, i: c.ilim, mode: modes[k] })) });
        variants.set(key, { ...seg, sol, modes: [...modes], amp: [] });
      }
      return variants.get(key);
    };
    const operatingPoint = (t) => resolveModes(built.gpe, built.gpe.map(() => 'CV'), t, variant);
    const T = seg.sol.period, h = T / M, mesh = seg.sol.mesh, intervals = [];
    for (let k = 0; k + 1 < mesh.length; k++) {
      let a = mesh[k];
      const b = mesh[k + 1], eps = (b - a) * 1e-8;
      for (let it = 0; it < 16 && a < b; it++) {
        const ga = operatingPoint(a + eps), gb = operatingPoint(b - eps);
        if (ga === gb) { intervals.push({ from: a, to: b, g: ga }); break; }
        let lo = a, hi = b;
        for (let r = 0; r < 45; r++) {
          const mid = (lo + hi) / 2;
          if (operatingPoint(mid) === ga) lo = mid; else hi = mid;
        }
        intervals.push({ from: a, to: hi, g: ga });
        a = hi;
      }
    }
    const locate = (t) => {
      const phase = t - Math.floor(t / T) * T;
      let lo = 0, hi = intervals.length;
      while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (intervals[mid].from <= phase) lo = mid; else hi = mid; }
      return { interval: intervals[lo], phase };
    };
    const nodeAt = (node, t) => locate(t).interval.g.sol.nodeAt(node, t);
    const tables = new Map(), pairs = new Map();
    const table = (node) => {
      if (!tables.has(node)) tables.set(node, Float64Array.from({ length: M }, (_, k) => nodeAt(node, k * h)));
      return tables.get(node);
    };
    const pair = (hi, lo) => {
      const key = `${hi}|${lo}`;
      if (pairs.has(key)) return pairs.get(key);
      const pre = [0], pieces = []; let min = Infinity, max = -Infinity;
      for (const s of intervals) {
        const dt = s.to - s.from, f = (t) => s.g.sol.nodeAt(hi, t) - s.g.sol.nodeAt(lo, t);
        const x = f(s.from + dt / 3), y = f(s.from + 2 * dt / 3), a = 2 * x - y, b = 2 * y - x;
        pre.push(pre.at(-1) + dt * (a + b) / 2);
        pieces.push({ dt, a, b });
        min = Math.min(min, a, b); max = Math.max(max, a, b);
      }
      const mean = pre.at(-1) / T;
      const acSquare = pieces.reduce((sum, { dt, a, b }) => {
        const x = a - mean, y = b - mean;
        return sum + dt * (x * x + x * y + y * y) / 3;
      }, 0);
      const p = { pre, stats: { mean, acRms: Math.sqrt(acSquare / T), peak: Math.max(Math.abs(min), Math.abs(max)), peakAc: Math.max(Math.abs(min - mean), Math.abs(max - mean)) } };
      pairs.set(key, p); return p;
    };
    const meanOver = (hi, lo, t1, t2) => {
      const p = pair(hi, lo);
      if (!(t2 > t1)) return p.stats.mean;
      const integral = (t) => {
        const { interval: s, phase } = locate(t), i = intervals.indexOf(s);
        return Math.floor(t / T) * p.pre.at(-1) + p.pre[i] + s.g.sol.meanOver(hi, lo, s.from, phase) * (phase - s.from);
      };
      return (integral(t2) - integral(t1)) / (t2 - t1);
    };
    const warn = [...built.warn];
    if ([...variants.values()].some((g) => g.modesUnsupported)) warn.push({ level: 'bad', text: '目前不支援此多電源接法：週期中無法找到一致的 CV／CC／逆灌工作點，波形及保護讀回無效。' });
    built.gpe.forEach((c, k) => {
      if (intervals.some((s) => s.g.modes[k] === 'RB')) warn.push({ level: 'bad', text: `GPE CH${c.ch} 在 AFG 週期中被其他電源灌入：電源不能吸收電流，逆灌時輸出開路（RB）。` });
    });
    const nodeChange = (n, t, t0) => nodeAt(n, t) - nodeAt(n, t0);
    const meanChangeOver = (hi, lo, a, b, t0) => meanOver(hi, lo, a, b) - (nodeAt(hi, t0) - nodeAt(lo, t0));
    const sol = { ...seg.sol, nodeAt, nodeChange, table, mesh: [...new Set([...seg.sol.mesh, ...intervals.map((s) => s.from)])].sort((a, b) => a - b), stats: (hi, lo) => pair(hi, lo).stats, meanOver, meanChangeOver, warn };
    if (this.board !== 'bb') sol.v = Object.fromEntries(NODES.map((x) => [x, table(built.find(x))]));
    const modeAt = (t) => locate(t).interval.g.modes;
    return { ...seg, sol, modeAt, get modes() { return modeAt(thisBench.now()); } };
  }

  // 限流的代數迴路可以與獨立 RC 迴路並存。保留完整解的電容模態，
  // 只替換真正共用 AFG 的無電容組；其他 GPE 的充電事件照常排程。
  withPeriodicGroups(seg, groups) {
    if (!groups.indices.length || !seg.sol.periodic) return seg;
    if (!seg.sol.caps.length) {
      const g = this.periodicSeg(seg);
      g.periodicIndices = seg.built.gpe.map((_, k) => k); return g;
    }
    const { built } = seg, nodes = groups.nodes, attached = (e) => nodes.has(e.a) || nodes.has(e.b);
    const subset = { ...built, net: { ...built.net, nodes: [...nodes], elements: built.net.elements.filter(attached),
      loads: (built.net.loads || []).filter(attached), afg: (built.net.afg || []).filter((s) => nodes.has(s.node)) },
    gpe: groups.indices.map((k) => built.gpe[k]), warn: [] };
    const periodic = this.periodicSeg(this.makeSeg(subset, {}, seg.t0, null)), base = seg.sol;
    const source = (n) => nodes.has(n) ? periodic.sol : base;
    const nodeAt = (n, t) => source(n).nodeAt(n, t), table = (n) => source(n).table(n);
    const meanOver = (hi, lo, a, b) => source(hi).meanOver(hi, 'E', a, b) - source(lo).meanOver(lo, 'E', a, b);
    const pairs = new Map();
    const stats = (hi, lo) => {
      if (hi == null || hi === 'E') return source(lo).stats(hi, lo);
      if (lo == null || lo === 'E' || source(hi) === source(lo)) return source(hi).stats(hi, lo);
      const key = `${hi}|${lo}`; if (pairs.has(key)) return pairs.get(key);
      const T = base.period, h = T / M, mean = meanOver(hi, lo, 0, T), cuts = new Set([0, h]);
      base.lam.forEach((l) => { if (l * h >= 0.5) for (const c of [0.5, 1, 2, 4, 8, 16, 32]) if (c / l < h) cuts.add(c / l); });
      const ordered = [...cuts].sort((a, b) => a - b), f = (t) => nodeAt(hi, t) - nodeAt(lo, t);
      let square = 0, peak = 0, peakAc = 0;
      for (let k = 0; k < M; k++) {
        const v0 = f(k * h); peak = Math.max(peak, Math.abs(v0)); peakAc = Math.max(peakAc, Math.abs(v0 - mean));
        for (let j = 1; j < ordered.length; j++) {
          const a = k * h + ordered[j - 1], half = (ordered[j] - ordered[j - 1]) / 2;
          for (const [u, w] of QUAD8) { const v = f(a + (u + 1) * half) - mean; square += w * half * v * v; }
        }
      }
      const value = { mean, acRms: Math.sqrt(square / T), peak, peakAc }; pairs.set(key, value); return value;
    };
    const modes = [...seg.modes], modeAt = (t) => {
      const out = [...modes], active = periodic.modeAt(t);
      groups.indices.forEach((k, j) => { out[k] = active[j]; }); return out;
    };
    const nodeChange = (n, t, t0) => source(n).nodeChange(n, t, t0);
    const meanChangeOver = (hi, lo, a, b, t0) => source(hi).meanChangeOver(hi, 'E', a, b, t0) - source(lo).meanChangeOver(lo, 'E', a, b, t0);
    const sol = { ...base, nodeAt, nodeChange, table, meanOver, meanChangeOver, stats, mesh: [...new Set([...base.mesh, ...periodic.sol.mesh])].sort((a, b) => a - b), warn: [...base.warn, ...periodic.sol.warn] }, thisBench = this;
    return { ...seg, sol, modeAt, periodicIndices: groups.indices, get modes() { return modeAt(thisBench.now()); } };
  }

  // 這一段之後第一次模式切換（CC 的端電壓升到設定值→CV；CV 電流超過限流→CC、變成負的→RB；RB 端電壓降回設定→CV）
  nextEvent(seg) {
    const b = seg.built;
    if (!b.gpe.length || !seg.sol.lam.length || !seg.amp.some((a) => Math.abs(a) > 1e-12)) return null;
    const span = 40 / Math.min(...seg.sol.lam), N = 240;
    const f = (k, t) => {
      const c = b.gpe[k], { v, i } = chanAt(seg, k, t), m = seg.modes[k];
      if (m === 'CV') return Math.max(i - c.ilim - 1e-8 * Math.max(1, c.ilim), -1e-6 - i); // > 0：該切換了
      // 事件排在物理交界本身，CC→CV 時兩側電流都等於 Ilim；
      // 模式合法性的容忍不可拿來延後充電。
      if (m === 'CC') return v - (c.v - c.ilim * R_GPE);
      return c.v * (1 - 1e-9) - v;
    };
    let best = null;
    b.gpe.forEach((c, k) => {
      if (seg.periodicIndices?.includes(k)) return;
      let ta = seg.t0, fa = f(k, ta + 1e-12);
      if (fa > 0) return;
      for (let j = 1; j <= N; j++) {
        const tb = seg.t0 + 1e-9 * Math.pow(span / 1e-9, j / N), fb = f(k, tb);
        if (fb > 0) {
          let lo = ta, hi = tb;
          for (let r = 0; r < 60; r++) { const mid = (lo + hi) / 2; if (f(k, mid) > 0) hi = mid; else lo = mid; }
          // CC→CV 的交界是 Vset−Ilim·R_GPE；取第一個跨過交界的
          // 可表示時間，CV 初值的電流才不會因大絕對時間的一 ULP 超限。
          const crossing = seg.modes[k] === 'CC' ? hi : lo;
          if (!best || crossing < best.t) best = { t: crossing, k };
          return;
        }
        ta = tb; fa = fb;
      }
    });
    if (!best) return null;
    const modes = [...seg.modes], m = modes[best.k], { i } = chanAt(seg, best.k, best.t);
    modes[best.k] = m === 'CV' ? (i < 0 ? 'RB' : 'CC') : 'CV';
    return { t: best.t, modes };
  }

  appendBuilt(built, before, t, prev) {
    const groups = periodicGroups(built);
    const commonFrequency = built.net.afg.every((s) => Math.abs(s.p.freq - built.net.afg[0].p.freq) <= 1e-9 * s.p.freq);
    if (groups.dynamic.length && !commonFrequency) built.warn.push({ level: 'bad', text: '目前不支援不同頻率 AFG 與 GPE 共同驅動含電容的週期保護：本輪僅支援單一或同頻率 AFG，波形及保護讀回僅為近似。' });
    const initial = this.makeSeg(built, before, t, null);
    let seg = groups.dynamic.length && commonFrequency ? hybridSeg(initial, () => this.now()) : this.withPeriodicGroups(initial, groups);
    if (!prev) seg.from = -Infinity;
    this.segs.push(seg);
    for (let ev = 0; ev < 8; ev++) {
      const nx = this.nextEvent(seg);
      if (!nx) break;
      seg.to = nx.t;
      seg = this.withPeriodicGroups(this.makeSeg(built, capsAt(seg, nx.t), nx.t, nx.modes), groups);
      this.segs.push(seg);
    }
  }

  solution() {
    const k = this.key();
    if (k !== this.cacheKey) {
      const t = this.now(), prev = this.segs.length ? this.segAt(t) : null;
      const before = prev ? capsAt(prev, t) : {}; // 變化前一刻各電容的電壓
      this.cacheKey = k;
      this.changeT = t;
      // 之前排好但還沒到的模式切換作廢
      this.segs = this.segs.filter((g) => g.from <= t || g.from === -Infinity);
      if (prev) prev.to = t;
      this.appendBuilt(this.build(this.afgParams(t)), before, t, prev);
      // One-shot drivers end at their actual deadline even if the next UI poll
      // is much later. Capacitor state and all pre-trigger/history queries use
      // this scheduled transition, rather than stopping the source at poll time.
      const cuts = [...new Set(this.afg.driverTransitionTimes?.(t) ?? [])].filter((x) => Number.isFinite(x) && x > t).sort((a, b) => a - b);
      for (const deadline of cuts) {
        const previous = this.segAt(deadline), charge = capsAt(previous, deadline);
        this.segs = this.segs.filter((s) => s.from < deadline);
        previous.to = deadline;
        this.appendBuilt(this.build(this.afgParams(deadline)), charge, deadline, previous);
      }
      // 保留已發生的電路變更，讓慢時基與任意水平位置的預觸發查詢
      // 仍用真正的歷史；不得拿最早剩下的 ON 電路向 OFF 的過去外插。
    }
    return this.segAt(this.now()).sol;
  }

  // 接點名稱（固定 RC 板的 A／B／G、麵包板的節點）→ 解算用的節點（接地的＝'E'）
  node(x) { this.solution(); return this.segAt(this.now()).built.find(x); }

  // 第一顆電容偏離週期穩態的電壓（固定 RC 板只有一顆；相容舊介面）
  dev(t = this.now()) {
    this.solution();
    const g = this.segAt(t), id = g.sol.caps[0];
    if (id == null) return 0;
    if (g.sol.capActual) return g.sol.capActual(t)[0] - g.sol.capSS(t)[0];
    const d = decay(g, t);
    return (g.sol.capD[0] || []).reduce((s2, w, m) => s2 + w * (g.amp[m] || 0) * d[m], 0);
  }

  // 第一顆電容的電壓（相容舊介面）
  vcAt(t) { this.solution(); const g = this.segAt(t), id = g.sol.capKeys[0]; return id == null ? 0 : capsAt(g, t)[id]; }

  // 最近一次電路改變的時刻（第一段＝第一次計算的時刻）
  changedAt() { this.solution(); return this.changeT; }

  // 還在充放電（任一接點偏離穩態超過 1 µV），或之後還有排好的模式切換：外殼要定時更新畫面
  transientActive(t = this.now()) {
    this.solution();
    if (this.segs.some((g) => g.from > t)) return true;
    const g = this.segAt(t);
    if (g.sol.actualNodeAt) return g.sol.names.some((x) => Math.abs(devNode(g, x, t)) > 1e-6);
    if (!g.amp.some((a) => Math.abs(a) > 1e-9)) return false;
    return g.sol.names.some((x) => Math.abs(devNode(g, x, t)) > 1e-6);
  }

  // 無電容的 AFG／GPE 週期模式也會改變讀回，外殼須定時重畫 GPE。
  gpeReadbackActive(t = this.now()) {
    this.solution();
    return !!this.segAt(t).modeAt || this.transientActive(t);
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
  //   table／at：週期穩態＋tView 暫態偏移；混合週期保護直接用週期穩態。
  //     連續採集用；at 在取樣點之間照解析式，窄脈衝不失真。
  //   abs(t)：絕對時間 t 的實際電壓（含暫態與歷史）：單次擷取、暫態中的採集用。
  tdsInput() {
    this.solution();
    const now = this.now(), tView = Math.max(now, this.changeT + SCOPE_SETTLE), g = this.segAt(tView), sol = g.sol;
    const historyCuts = (a, b) => this.segs.map((s) => s.from).filter((t) => Number.isFinite(t) && a < t && t < b);
    const sig = [0, 1].map((i) => {
      const lead = `TDS.CH${i + 1}.TIP`, node = g.built.leadNode[lead];
      if (!node) return null;
      const noise = noiseAffects(g.built, [node]);
      // Hybrid 的連續採集 at 是週期穩態；實際暫態由 abs 提供。
      // 不必先求 tView 的實際狀態，且舊歷史段相對此 at 的偏移應為零。
      const hybrid = !!sol.actualNodeAt, off = hybrid ? 0 : devNode(g, node, tView);
      const atView = hybrid ? 0 : nodeIn(g, node, tView), at = hybrid ? (t) => sol.nodeAt(node, t) : (t) => atView + sol.nodeChange(node, t, tView);
      const abs = (t) => { const h = this.segAt(t); return nodeIn(h, h.built.leadNode[lead], t); };
      const probeAt = (t) => this.segAt(t).built.probeX[i];
      const history = (a, b) => this.segs.filter((s) => s.from < b && s.to > a).map((s) => {
        const n = s.built.leadNode[lead], grounded = !n || n === 'E';
        return { from: s.from, to: s.to, t0: s.t0, probe: s.built.probeX[i], period: s.sol.period, periodic: !!s.sol.periodic,
          // A flat lookup table can miss narrow pulses. Only source parameters
          // can certify that the steady drive has zero time derivative.
          steadyConstant: grounded || s.built.net.afg.every(({ p }) => p.emfVpp === 0),
          at: grounded ? () => 0 : (t) => s.sol.nodeAt(n, t), table: grounded ? new Float64Array(M) : s.sol.table(n),
          lam: grounded ? [] : [...s.sol.lam], coeff: grounded ? [] : s.sol.modeW(n).map((w, k) => w * (s.amp[k] || 0)),
          // CC/GMIN and hybrid trajectories use the stable absolute evaluator;
          // a huge steady solution minus its modal offset loses precision.
          actual: !!s.sol.actualNodeAt || !s.sol.periodic,
          abs: (t) => nodeIn(s, n, t) };
      });
      // abs(t) 相對連續採集的 at(t) 的保守範圍：每個模態分別取兩端
      // 最大／最小值，避免多模態互相抵消後讓觸發搜尋跳過真正的交越。
      const transientRange = (a, b) => {
        let min = Infinity, max = -Infinity;
        for (const s of this.segs) {
          const x = Math.max(a, s.from), y = Math.min(b, s.to);
          if (y < x) continue;
          const n = s.built.leadNode[lead];
          if (s.sol.actualRange) {
            const [low, high] = s.sol.actualRange(n, x, y), wave = sol.stats(node, 'E');
            min = Math.min(min, low - wave.mean - wave.peakAc); max = Math.max(max, high - wave.mean + wave.peakAc); continue;
          }
          const same = s.sol === sol && n === node;
          let low = same ? 0 : -off, high = same ? 0 : -off;
          if (!same) {
            const sw = s.sol.stats(n, 'E'), gw = sol.stats(node, 'E');
            low += sw.mean - gw.mean - sw.peakAc - gw.peakAc;
            high += sw.mean - gw.mean + sw.peakAc + gw.peakAc;
          }
          const w = s.sol.modeW(n);
          s.sol.lam.forEach((l, m) => {
            const c = w[m] * (s.amp[m] || 0), view = l * Math.max(0, tView - s.t0);
            const va = c * (same ? expDiff(l * Math.max(0, x - s.t0), view) : Math.exp(-l * Math.max(0, x - s.t0)));
            const vb = c * (same ? expDiff(l * Math.max(0, y - s.t0), view) : Math.exp(-l * Math.max(0, y - s.t0)));
            low += Math.min(va, vb); high += Math.max(va, vb);
          });
          min = Math.min(min, low); max = Math.max(max, high);
        }
        return min === Infinity ? [0, 0] : [min, max];
      };
      if (node === 'E') return { table: new Float64Array(M), period: sol.period, at: () => 0, abs, transientRange, historyCuts, history, probeAt };
      return { table: Float64Array.from({ length: M }, (_, k) => at(k * sol.period / M)), period: sol.period, at, abs, transientRange, historyCuts, history, probeAt, noise, ...frequencyClues(g.built, [node]) };
    });
    return { sig, probe: [...this.probeX], now, tView, changedAt: this.changeT, tau: sol.tauMax };
  }

  // 電表：HI−LO 電壓，以及真正串入電路的 I−LO 分流電流。dc＝整週期平均（含目前暫態）、meanOver(t1,t2)＝時間窗平均（DCV/DCI 積分用）、
  // ac＝交流有效值、peak／peakAc＝瞬間最大值／交流峰值（自動量程看峰值）、freq＝訊號頻率、now＝目前時間。
  // 電阻只在電路沒通電時量（C 在直流下視為開路）。
  dmmInput() {
    const W = this.leadMap();
    this.solution();
    const t = this.now();
    // 每段照當時測試線位置、量程負載及保護模式算；未接好的時間按零計，不能用新分流電阻改寫舊讀值。
    const pairMeanOver = (highLead, lowLead, isCurrent, t1, t2) => {
      if (!(t2 > t1)) return 0;
      let sum = 0;
      for (const s of this.segs) {
        const a = Math.max(t1, s.from), b = Math.min(t2, s.to), h = s.built.leadNode[highLead], l = s.built.leadNode[lowLead];
        if (!(b > a) || !h || !l) continue;
        const divisor = isCurrent ? s.built.current?.r : 1;
        if (!divisor) continue;
        if (s.sol.actualMeanOver) { sum += s.sol.actualMeanOver(h, l, a, b) * (b - a) / divisor; continue; }
        const wh = h === 'E' ? s.sol.lam.map(() => 0) : s.sol.modeW(h), wl = l === 'E' ? s.sol.lam.map(() => 0) : s.sol.modeW(l);
        const initial = nodeIn(s, h, s.t0) - nodeIn(s, l, s.t0);
        sum += ((initial + s.sol.meanChangeOver(h, l, a, b, s.t0)) * (b - a) + devDeltaInt(s, wh.map((x, m) => x - wl[m]), a, b)) / divisor;
      }
      return sum / (t2 - t1);
    };
    const meanOver = (isCurrent, a, b) => pairMeanOver(isCurrent ? 'DMM.I' : 'DMM.HI', 'DMM.LO', isCurrent, a, b);
    const validOver = (leads, isCurrent, a, b) => {
      if (!(b > a) || a < this.segs[0].t0 || b > this.now()) return false;
      return this.segs.filter((s) => s.from < b && s.to > a).every((s) =>
        leads.every((lead) => s.built.leadNode[lead]) && (!isCurrent || s.built.current?.r > 0));
    };
    const signal = (isCurrent, historical = false) => {
      const s = this.segAt(t), h = s.built.leadNode[isCurrent ? 'DMM.I' : 'DMM.HI'], l = s.built.leadNode['DMM.LO'];
      const divisor = isCurrent ? s.built.current?.r : 1;
      const connected = !!(h && l && divisor);
      if (!connected && !historical) return null;
      const w = connected ? s.sol.stats(h, l) : { acRms: 0, peakAc: 0 };
      const dc = connected ? (frozenMean(s, h, t) - frozenMean(s, l, t)) / divisor : 0;
      const windowPeak = (a, b, ac) => {
        if (!(b > a)) return 0;
        const center = ac ? meanOver(isCurrent, a, b) : 0; let peak = 0;
        for (const past of this.segs) {
          const start = Math.max(a, past.from), end = Math.min(b, past.to);
          if (!(end > start)) continue;
          const hi = past.built.leadNode[isCurrent ? 'DMM.I' : 'DMM.HI'], lo = past.built.leadNode['DMM.LO'];
          const r = isCurrent ? past.built.current?.r : 1;
          if (!hi || !lo || !r) { peak = Math.max(peak, Math.abs(center)); continue; }
          const value = nodePairPeakOver(past, hi, lo, start, end, center * r, (time) => nodeIn(past, hi, time) - nodeIn(past, lo, time));
          peak = Math.max(peak, value / r);
        }
        return peak;
      };
      return { dc, ac: connected ? w.acRms / divisor : 0, peak: connected ? Math.abs(dc) + w.peakAc / divisor : 0,
        peakAc: connected ? w.peakAc / divisor : 0, ...(connected ? frequencyClues(s.built, [h, l]) : {}),
        freq: connected && s.sol.periodic && !noiseAffects(s.built, [h, l]) ? 1 / s.sol.period : 0,
        noise: connected && noiseAffects(s.built, [h, l]), now: t,
        validOver: (a, b) => validOver([isCurrent ? 'DMM.I' : 'DMM.HI', 'DMM.LO'], isCurrent, a, b), meanOver: (a, b) => meanOver(isCurrent, a, b),
        peakOver: (a, b) => windowPeak(a, b, false), peakAcOver: (a, b) => windowPeak(a, b, true),
        rmsAcOver: (a, b) => {
          if (!(b > a)) return 0;
          const center = meanOver(isCurrent, a, b); let square = 0;
          for (const past of this.segs) {
            const start = Math.max(a, past.from), end = Math.min(b, past.to);
            if (!(end > start)) continue;
            const hi = past.built.leadNode[isCurrent ? 'DMM.I' : 'DMM.HI'], lo = past.built.leadNode['DMM.LO'];
            const r = isCurrent ? past.built.current?.r : 1;
            if (!hi || !lo || !r) { square += center * center * (end - start); continue; }
            square += centeredSquareIntegral(past, hi, lo, start, end, center * r, (time) => nodeIn(past, hi, time) - nodeIn(past, lo, time)) / (r * r);
          }
          return Math.sqrt(square / (b - a));
        },
        frequencyAt: (time) => {
          const past = this.segAt(time);
          const hi = past?.built.leadNode[isCurrent ? 'DMM.I' : 'DMM.HI'], lo = past?.built.leadNode['DMM.LO'];
          if (!hi || !lo || time < past.from) return { freq: 0, noise: false };
          const noise = noiseAffects(past.built, [hi, lo]);
          return { ...frequencyClues(past.built, [hi, lo]), noise, freq: past.sol.periodic && !noise ? 1 / past.sol.period : 0 };
        },
        at: (time) => {
          const past = this.segAt(time);
          if (!past || time < past.from) return 0;
          const hi = past.built.leadNode[isCurrent ? 'DMM.I' : 'DMM.HI'], lo = past.built.leadNode['DMM.LO'];
          const resistance = isCurrent ? past.built.current?.r : 1;
          return hi && lo && resistance ? (nodeIn(past, hi, time) - nodeIn(past, lo, time)) / resistance : 0;
        } };
    };
    // Auto 量程和分流電阻互相影響。只用純 idx/電路解算有限迭代，不呼叫 DMM.rangeIdx 或 reading。
    // 降檔需低於下一候選檔的 80% 容量，避免不同負載在邊界往返切檔（教學遲滯）。
    const meter = this.dmm;
    // DCV 的 Auto Input Z 在前三檔為 10 GΩ 教學近似，其餘為 10 MΩ。
    // 檔位與負載一起有限迭代，避免從 inputZ() 回呼量測造成遞迴。
    if (meter?.on && meter.run !== 'stop' && meter.fx?.bench && meter.fn === 'DCV' && meter.inputZMode === 'AUTO' && meter.st.auto && W['DMM.HI'] && W['DMM.LO']) {
      const seen = new Set();
      for (let n = 0; n < 8; n++) {
        const v = signal(false); if (!v) break;
        const aperture = meter.apertureSeconds?.() ?? APERTURE, end = Math.floor(t / aperture) * aperture;
        const x = Math.max(Math.abs(v.dc), Math.abs(v.meanOver(end - aperture, end)), v.peak);
        let wanted = meter.f.ranges.findIndex((r) => x <= r.limit * (1 + 1e-12));
        if (wanted < 0) wanted = meter.f.ranges.length - 1;
        const old = meter.st.idx;
        if (wanted === old) break;
        if (seen.has(wanted)) { meter.st.idx = Math.max(old, wanted, ...seen); this.solution(); break; }
        seen.add(old); meter.st.idx = wanted; this.solution();
      }
    }
    if (meter?.on && meter.run !== 'stop' && meter.fx?.bench && meter.f.kind === 'I' && meter.st.auto && W['DMM.I'] && W['DMM.LO']) {
      const seen = new Set();
      for (let n = 0; n < 8; n++) {
        const i = signal(true); if (!i) break;
        const aperture = meter.apertureSeconds?.() ?? APERTURE, tr = Math.floor(t / aperture) * aperture;
        const old = meter.st.idx, x = meter.f.part === 'ac' ? i.ac : Math.max(Math.abs(i.dc), Math.abs(i.meanOver(tr - aperture, tr))), pk = meter.f.part === 'ac' ? i.peakAc : 0;
        let wanted = meter.f.ranges.findIndex((r) => x <= r.limit * (1 + 1e-12) && pk <= (meter.f.part === 'ac' ? 3 * r.v : Infinity) * (1 + 1e-12));
        if (wanted < 0) wanted = meter.f.ranges.length - 1;
        if (wanted < old) {
          const r = meter.f.ranges[wanted];
          if (x > r.limit * 0.8 || pk > 3 * r.v * 0.8) break;
        }
        if (wanted === old) break;
        if (seen.has(wanted)) { meter.st.idx = Math.max(old, wanted, ...seen); this.solution(); break; }
        seen.add(old); meter.st.idx = wanted; this.solution();
      }
    }
    const passiveAt = (time) => {
      const g = this.segAt(time), hi = g.built.leadNode['DMM.HI'], lo = g.built.leadNode['DMM.LO'];
      // 只有和通電中的電源連在一起的迴路不能量；完全獨立、沒通電的迴路照常量
      const powered = g.built.powered(hi) || g.built.powered(lo);
      let ohm = null, whyR = '';
      if (!hi || !lo) whyR = '電表的 HI、LO 測試線要兩條都接上電路。';
      else if (powered) whyR = '電表接的這個迴路通電中，不能量電阻：先關 AFG 的 OUTPUT（或拔掉紅夾）、GPE 的 Output。';
      else ohm = ohmsNet(g.built.net, hi, lo);
      const shi = g.built.leadNode['DMM.SHI'], slo = g.built.leadNode['DMM.SLO'];
      let ohm4 = null, why4 = '', cap = null, whyC = '';
      if (!hi || !lo || !shi || !slo) why4 = '四線電阻要接好 Input HI、LO 與 Sense HI、LO 四條線。';
      else if (powered || g.built.powered(shi) || g.built.powered(slo)) why4 = whyR || 'Sense 接到通電迴路；請先關閉電源輸出。';
      else {
        ohm4 = fourWireResistance(g.built.net, hi, lo, shi, slo);
        if (ohm4 == null) why4 = 'Sense 必須接在測試電流實際流經的電阻網路上。';
      }
      if (powered) whyC = '電容量測前請先關閉 AFG、GPE 輸出並放電。';
      else { const q = equivalentCapacitance(g.built.net, hi, lo, capsAt(g, time)); cap = q.value; whyC = q.why; }
      return { ohm, ohm4, why4, cap, whyC, whyR };
    };
    const g = this.segAt(t), lo = g.built.leadNode['DMM.LO'];
    const shi = g.built.leadNode['DMM.SHI'], slo = g.built.leadNode['DMM.SLO'];
    const v = signal(false), i = signal(true);
    const { ohm, ohm4, why4, cap, whyC, whyR } = passiveAt(t);
    const ref = shi && slo && lo ? { hi: nodeIn(g, shi, t) - nodeIn(g, lo, t), lo: nodeIn(g, slo, t) - nodeIn(g, lo, t) } : null;
    if (ref) ref.valid = Math.abs(ref.hi) <= 12 && Math.abs(ref.lo) <= 12 && Math.abs(ref.hi - ref.lo) > 1e-12;
    const refWindow = { meanOver: (a, b) => {
      const hi = pairMeanOver('DMM.SHI', 'DMM.LO', false, a, b);
      const lo = pairMeanOver('DMM.SLO', 'DMM.LO', false, a, b);
      let valid = validOver(['DMM.SHI', 'DMM.SLO', 'DMM.LO'], false, a, b) && Math.abs(hi - lo) > 1e-12;
      // Check each terminal's actual peak relative to Input LO throughout the
      // completed aperture, even if the wires or reference changed after it.
      if (valid) for (const past of this.segs) {
        const start = Math.max(a, past.from), end = Math.min(b, past.to);
        if (!(end > start)) continue;
        const l = past.built.leadNode['DMM.LO'];
        for (const lead of ['DMM.SHI', 'DMM.SLO']) {
          const h = past.built.leadNode[lead];
          const peak = nodePairPeakOver(past, h, l, start, end, 0, (time) => nodeIn(past, h, time) - nodeIn(past, l, time));
          if (!(peak <= 12)) valid = false;
        }
      }
      return { hi, lo, valid };
    } };
    return { now: t, v, i, vWindow: v || signal(false, true), iWindow: i || signal(true, true),
      ohm, ohm4, why4, cap, whyC, passiveAt, ref, refWindow, why: '', whyV: v ? '' : '電壓量測要將 HI、LO 兩條測試線接上（I 3A 不是電壓端）。', whyR,
      whyI: i ? '' : '電流量測要拆開原回路，將 I 3A、LO 兩條測試線串入；HI 不能代替 I 端。' };
  }

  // GPE 四路讀回（實驗台）：接上兩條導線的通道＝電路實際的端電壓、電流與 CV／CC；沒接成迴路＝開路（設定電壓、0 A）
  gpeInput() {
    const gp = this.gpeParams();
    if (!gp.active) return null;
    this.solution();
    const t = this.now(), g = this.segAt(t), out = {};
    gp.ch.forEach((c, k) => {
      const j = g.built.gpe.findIndex((x) => x.ch === k + 1);
      if (j < 0) { out[k + 1] = { v: c.v, i: 0, cc: false }; return; }
      const { v, i } = chanAt(g, j, t); // 含暫態：例如限流充電時顯示 CC 與上升中的端電壓
      const mode = g.modeAt ? g.modeAt(t)[j] : g.modes[j];
      out[k + 1] = { v: Math.max(0, v), i: Math.max(0, i), cc: mode === 'CC', rb: mode === 'RB' };
    });
    return out;
  }

  leadsOn(node) { return Object.entries(this.wires).filter(([, n]) => n === node).map(([id]) => LEADS[id].name); }

  snapshot() {
    this.solution();
    const t = this.now(), g = this.segAt(t), sol = g.sol, d = this.dev(t);
    const names = this.board === 'bb' ? g.built.net.nodes : NODES;
    const res = (x) => (this.board === 'bb' ? x : g.built.find(x));
    const pp = Object.fromEntries(names.map((n) => [n, res(n) === 'E' ? 0 : stats(sol.table(res(n))).pp]));
    const ssMean = Object.fromEntries(names.map((n) => [n, res(n) === 'E' ? 0 : sol.stats(res(n), 'E').mean]));
    const dcNow = Object.fromEntries(names.map((n) => [n, frozenMean(g, res(n), t)]));
    return {
      board: this.board, topo: this.topo, R: this.R, C: this.C, wires: { ...this.wires }, bbWires: { ...this.bbWires }, probeX: [...this.probeX], sel: this.sel,
      period: sol.period, tau: sol.tauMax, modes: sol.lam.map((l) => 1 / l), pp, ssMean, dcNow, dev: d,
      loads: g.built.net.loads, gpe: this.gpeInput(), gpeModes: g.modes, warn: sol.warn.map((w) => w.text),
    };
  }
}
