// 實驗台狀態：固定 RC 板（R、C 的值與接法、A／B／G 接點）或麵包板（外殼掛上 bb＝Breadboard，導線接孔 bbWires），
// 探棒 1×／10× 開關，以及三台儀器（AFG、電表、GPE）的設定。提供示波器、電表、GPE 讀回的輸入。
// 電路一律由通用解算 solveNet 計算（src/bench/net.js）；固定 RC 板只是一個固定的電路描述。
// 時間：this.now()（秒，預設為頁面時鐘）。電路每變一次就開新的一段 { sol, built, from, to, t0, amp }，保留操作歷史：
//   各電容電壓在變化那一刻連續（改變前一刻的電壓；新插上的電容從 0 V 開始），之後各模態以自己的時間常數衰減到新的週期穩態。
//   電表積分窗、示波器單次擷取往前看的部分，都照「當時那一段」的電路算：已完成的讀值不會被後來的操作改掉。
import { stats, LEADS, NODES, M } from './circuit.js';
import { solveNet, ohmsNet, R_GPE } from './net.js';

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
// 某一段各電容在 t 的電壓 { 元件生命週期識別碼: V }
function capsAt(g, t) {
  const ss = g.sol.capSS(t), d = decay(g, t), out = {};
  g.sol.capKeys.forEach((id, k) => { let v = ss[k]; g.sol.capD[k]?.forEach((w, m) => { v += w * (g.amp[m] || 0) * d[m]; }); out[id] = v; });
  return out;
}

// GPE 第 k 路在某一段、時刻 t 的端電壓與輸出電流（瞬間週期電壓＋暫態）。
function chanAt(g, k, t) {
  const c = g.built.gpe[k], m = g.modeAt ? g.modeAt(t)[k] : g.modes[k];
  if (c.pos === c.neg) return { v: 0, i: m === 'CC' ? c.ilim : m === 'RB' ? 0 : Infinity };
  const v = nodeIn(g, c.pos, t) - nodeIn(g, c.neg, t);
  return { v, i: m === 'CC' ? c.ilim : m === 'RB' ? 0 : (c.v - v) / R_GPE };
}
const nextMode = (c, m, { v, i }) => m === 'CV'
  ? (i > c.ilim * (1 + 1e-9) ? 'CC' : i < -1e-6 ? 'RB' : m)
  : m === 'CC' ? (v > c.v * (1 + 1e-9) ? 'CV' : m) : v < c.v * (1 - 1e-9) ? 'CV' : m;
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

  afgParams() {
    return this.afg.ch.map((c) => ({ wave: c.wave, freq: c.freq, sym: c.sym, emfVpp: c.emfVpp, emfOffset: c.emfOffset, output: c.output && this.afg.on }));
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
    // 儀器輸入電阻
    const loads = this.loadLeads().map((L) => ({ a: leadNode[L.a], b: L.b ? leadNode[L.b] : 'E', r: L.r })).filter((L) => L.a && L.b && L.a !== L.b);
    // 通電範圍：和有輸出的電源（AFG、GPE）以元件、儀器輸入電阻或電源本身相連的接點（量電阻時要避開）
    const cp = new Map(), cf = (x) => { if (!cp.has(x)) cp.set(x, x); let y = x; while (cp.get(y) !== y) y = cp.get(y); cp.set(x, y); return y; };
    const cu = (a, b) => { if (a != null && b != null) cp.set(cf(a), cf(b)); };
    elements.forEach((e) => cu(e.a, e.b)); loads.forEach((L) => cu(L.a, L.b));
    afg.forEach((s) => cu(s.node, 'E')); gpe.forEach((s) => cu(s.pos, s.neg));
    const live = new Set([...afg.map((s) => cf(s.node)), ...gpe.map((s) => cf(s.pos))]);
    const powered = (x) => x != null && live.has(cf(x));
    return { net: { nodes: netNodes, elements, loads, afg }, gpe, leadNode, warn, find: node, powered };
  }

  // 一段電路狀態：從 t0 起，GPE 各路用 modes（CV／CC／RB）。模式依「t0 當下」的狀態決定（含電容電壓），
  //   不是只看最後的穩態：例如開輸出時電容還沒充電，電流超過限流就先 CC（線性充電），之後再回 CV。
  makeSeg(built, caps, t0, hint) {
    const variants = new Map();
    const candidate = (modes) => {
      const key = modes.join('|');
      if (variants.has(key)) return variants.get(key);
      const sol = solveNet({ ...built.net, dc: built.gpe.map((c, k) => ({ id: c.id, pos: c.pos, neg: c.neg, v: c.v, i: c.ilim, mode: modes[k] })) }, { retainFastModes: built.gpe.length > 0 });
      const seg = { sol, built, modes: [...modes], t0, from: t0, to: Infinity, amp: sol.modalFromCaps(sol.capKeys.map((id) => caps[id] ?? 0), t0) }; // 新插上的電容從 0 V 開始
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
    const T = seg.sol.period, h = seg.sol.h, intervals = [];
    for (let k = 0; k < M; k++) {
      let a = k * h;
      const b = (k + 1) * h, eps = h * 1e-8;
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
    const sol = { ...seg.sol, nodeAt, table, stats: (hi, lo) => pair(hi, lo).stats, meanOver, warn };
    if (this.board !== 'bb') sol.v = Object.fromEntries(NODES.map((x) => [x, table(built.find(x))]));
    const modeAt = (t) => locate(t).interval.g.modes;
    return { ...seg, sol, modeAt, get modes() { return modeAt(thisBench.now()); } };
  }

  // 這一段之後第一次模式切換（CC 的端電壓升到設定值→CV；CV 電流超過限流→CC、變成負的→RB；RB 端電壓降回設定→CV）
  nextEvent(seg) {
    const b = seg.built;
    if (!b.gpe.length || seg.modeAt || !seg.sol.lam.length || !seg.amp.some((a) => Math.abs(a) > 1e-12)) return null;
    const span = 40 / Math.min(...seg.sol.lam), N = 240;
    const f = (k, t) => {
      const c = b.gpe[k], { v, i } = chanAt(seg, k, t), m = seg.modes[k];
      if (m === 'CV') return Math.max(i - c.ilim * (1 + 1e-9), -1e-6 - i); // > 0：該切換了
      if (m === 'CC') return v - c.v * (1 + 1e-9);
      return c.v * (1 - 1e-9) - v;
    };
    let best = null;
    b.gpe.forEach((c, k) => {
      let ta = seg.t0, fa = f(k, ta + 1e-12);
      if (fa > 0) return;
      for (let j = 1; j <= N; j++) {
        const tb = seg.t0 + 1e-9 * Math.pow(span / 1e-9, j / N), fb = f(k, tb);
        if (fb > 0) {
          let lo = ta, hi = tb;
          for (let r = 0; r < 60; r++) { const mid = (lo + hi) / 2; if (f(k, mid) > 0) hi = mid; else lo = mid; }
          if (!best || hi < best.t) best = { t: hi, k };
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
      const built = this.build();
      let seg = this.makeSeg(built, before, t, null);
      if (built.gpe.length && seg.sol.periodic && !seg.sol.caps.length) seg = this.periodicSeg(seg);
      else if (seg.sol.periodic && seg.sol.caps.length && built.gpe.some((c) => seg.sol.stats(c.pos, c.neg).acRms > 1e-12)) {
        // 有動態狀態的混合電源需要完整的混合系統求解，目前的有限暫態事件
        // 排程不能保證無限週期的保護切換；接線結果必須明確標示這個限制。
        built.warn.push({ level: 'bad', text: '目前不支援 AFG 與 GPE 共同驅動含電容電路的週期限流／逆灌切換：波形及 GPE CV／CC 讀回僅為近似，請關閉其中一台輸出後再量測。' });
        seg.sol.warn = [...seg.sol.warn, built.warn.at(-1)];
      }
      if (!prev) seg.from = -Infinity;
      this.segs.push(seg);
      for (let ev = 0; ev < 8; ev++) { // 依序排出之後的模式切換（例：CC 充電 → CV）
        const nx = this.nextEvent(seg);
        if (!nx) break;
        seg.to = nx.t;
        seg = this.makeSeg(built, capsAt(seg, nx.t), nx.t, nx.modes);
        this.segs.push(seg);
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
  //   table／at：週期穩態＋「看的時刻」tView 的暫態偏移（連續採集用；at 在取樣點之間照解析式，窄脈衝不失真）；
  //   abs(t)：絕對時間 t 的實際電壓（含暫態與歷史）：單次擷取、暫態中的採集用。
  tdsInput() {
    this.solution();
    const now = this.now(), tView = Math.max(now, this.changeT + SCOPE_SETTLE), g = this.segAt(tView), sol = g.sol;
    const sig = [0, 1].map((i) => {
      const lead = `TDS.CH${i + 1}.TIP`, node = g.built.leadNode[lead];
      if (!node) return null;
      const off = devNode(g, node, tView);
      const abs = (t) => { const h = this.segAt(t); return nodeIn(h, h.built.leadNode[lead], t); };
      // abs(t) 相對連續採集的 at(t) 的保守範圍：每個模態分別取兩端
      // 最大／最小值，避免多模態互相抵消後讓觸發搜尋跳過真正的交越。
      const transientRange = (a, b) => {
        let min = Infinity, max = -Infinity;
        for (const s of this.segs) {
          const x = Math.max(a, s.from), y = Math.min(b, s.to);
          if (y < x) continue;
          const n = s.built.leadNode[lead];
          let low = -off, high = -off;
          if (s.sol !== sol || n !== node) {
            const sw = s.sol.stats(n, 'E'), gw = sol.stats(node, 'E');
            low += sw.mean - gw.mean - sw.peakAc - gw.peakAc;
            high += sw.mean - gw.mean + sw.peakAc + gw.peakAc;
          }
          const w = s.sol.modeW(n);
          s.sol.lam.forEach((l, m) => {
            const c = w[m] * (s.amp[m] || 0), va = c * Math.exp(-l * Math.max(0, x - s.t0)), vb = c * Math.exp(-l * Math.max(0, y - s.t0));
            low += Math.min(va, vb); high += Math.max(va, vb);
          });
          min = Math.min(min, low); max = Math.max(max, high);
        }
        return min === Infinity ? [0, 0] : [min, max];
      };
      if (node === 'E') return { table: new Float64Array(M), period: sol.period, at: () => 0, abs, transientRange };
      const tb = sol.table(node);
      return { table: Float64Array.from(tb, (x) => x + off), period: sol.period, at: (t) => sol.nodeAt(node, t) + off, abs, transientRange };
    });
    return { sig, probe: [...this.probeX], now, tView, changedAt: this.changeT, tau: sol.tauMax };
  }

  // 電表：HI−LO 的電壓。dc＝整週期平均（含目前暫態）、meanOver(t1,t2)＝時間窗平均（DCV 積分用）、
  // ac＝交流有效值、peak／peakAc＝瞬間最大值／交流峰值（自動量程看峰值）、freq＝訊號頻率、now＝目前時間。
  // 電阻只在電路沒通電時量（C 在直流下視為開路）。
  dmmInput() {
    const W = this.leadMap();
    if (!W['DMM.HI'] || !W['DMM.LO']) return { v: null, ohm: null, why: '電表的 HI、LO 測試線要兩條都接上電路。' };
    this.solution();
    const t = this.now(), g = this.segAt(t), sol = g.sol, hi = g.built.leadNode['DMM.HI'], lo = g.built.leadNode['DMM.LO'];
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
    // 只有和通電中的電源連在一起的迴路不能量；完全獨立、沒通電的迴路照常量
    const powered = g.built.powered(hi) || g.built.powered(lo);
    let ohm = null, whyR = '';
    if (powered) whyR = '電表接的這個迴路通電中，不能量電阻：先關 AFG 的 OUTPUT（或拔掉紅夾）、GPE 的 Output。';
    else ohm = ohmsNet(g.built.net, hi, lo);
    return { v, ohm, why: '', whyR, whyI: '實驗台目前只支援電壓（DCV、ACV）與電阻量測；量電流要把電表串進電路，還沒有提供。' };
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
      out[k + 1] = { v: Math.max(0, v), i: Math.max(0, Math.min(i, c.ilim)), cc: mode === 'CC', rb: mode === 'RB' };
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
    const dcNow = Object.fromEntries(names.map((n) => [n, ssMean[n] + devNode(g, res(n), t)]));
    return {
      board: this.board, topo: this.topo, R: this.R, C: this.C, wires: { ...this.wires }, bbWires: { ...this.bbWires }, probeX: [...this.probeX], sel: this.sel,
      period: sol.period, tau: sol.tauMax, modes: sol.lam.map((l) => 1 / l), pp, ssMean, dcNow, dev: d,
      loads: g.built.net.loads, gpe: this.gpeInput(), gpeModes: g.modes, warn: sol.warn.map((w) => w.text),
    };
  }
}
