// 實驗台電路計算：AFG → RC → 示波器／電表（J 階段，使用者 2026-09-30 指定先做這個實驗）。
// 模型：板上三個接點 A、B、G，串聯 RC（topo 'RC'：R 在 A–B、C 在 B–G；'CR'：C 在 A–B、R 在 B–G）。
//   AFG 每通道＝EMF e(t) 串 50 Ω 內阻（AFG-F10：內阻固定 50 Ω；Output OFF＝高阻、不接）；黑夾＝AFG 機殼地（大地）。
//   示波器接地夾＝大地（接在哪一點，那一點就被接到大地）；探棒尖端量「該點對大地」的電壓。
//   電表浮接，量 HI−LO。儀器輸入電阻會並聯在電路上（bench.loads：探棒尖端對大地 10 MΩ／1 MΩ、
//   電表 DCV 10 MΩ、ACV 1 MΩ）；輸入電容（探棒約 10–20 pF、電表 ACV < 100 pF）尚未計入。
// 解法：只有一顆電容 → 戴維寧等效 Vth(t)、Rth，一階方程 dVc/dt＝(Vth−Vc)/(Rth·C) 在每段取樣間以
//   分段線性輸入精確積分（方波各區間保持常值）；週期穩態用 shooting：Vc(T)＝a·Vc(0)＋b → Vc(0)＝b/(1−a)。
//   每個取樣區間內的接點電壓用解析式表示（co 係數）：窄脈衝（τ 比取樣間隔短）的有效值與逐點取值都照它算，
//   不靠取樣點。兩種寫法數學上相同，依 h/τ 選數值穩定的一種：
//     指數型（h/τ ≥ 0.5）v(s)＝x＋y·s＋c·e^(−s/τ)；
//     近線性型（h/τ < 0.5）v(s)＝x＋y·s＋c·r(s/τ)，r(σ)＝e^(−σ)−1＋σ。長時間常數時指數型的 x、c 很大又互相抵消，
//     平方積分會失準（例：100 kΩ／10 µF、1 kHz 的有效值少 5%，100 kHz 變成 0），所以改寫成值＋斜率＋小彎曲量。
//   電容電壓偏離穩態 δ 時，各接點再加 kv·δ（暫態由 Bench 依時間衰減）。
export const M = 4000;           // 每週期取樣點
export const R_OUT = 50;         // AFG 輸出內阻
const GMIN = 1e-12;              // 每個節點對地的極小電導，讓浮接電路也可解
export const NODES = ['A', 'B', 'G'];
export const LEADS = {
  'AFG.CH1+': { inst: 'afg', ch: 0, role: 'sig', name: 'AFG CH1 紅夾（訊號）' },
  'AFG.CH1-': { inst: 'afg', ch: 0, role: 'gnd', name: 'AFG CH1 黑夾（地）' },
  'AFG.CH2+': { inst: 'afg', ch: 1, role: 'sig', name: 'AFG CH2 紅夾（訊號）' },
  'AFG.CH2-': { inst: 'afg', ch: 1, role: 'gnd', name: 'AFG CH2 黑夾（地）' },
  'TDS.CH1.TIP': { inst: 'tds', ch: 0, role: 'tip', name: '示波器 CH1 探棒尖端' },
  'TDS.CH1.GND': { inst: 'tds', ch: 0, role: 'gnd', name: '示波器 CH1 接地夾' },
  'TDS.CH2.TIP': { inst: 'tds', ch: 1, role: 'tip', name: '示波器 CH2 探棒尖端' },
  'TDS.CH2.GND': { inst: 'tds', ch: 1, role: 'gnd', name: '示波器 CH2 接地夾' },
  'DMM.HI': { inst: 'dmm', role: 'hi', name: '電表 HI（紅）' },
  'DMM.LO': { inst: 'dmm', role: 'lo', name: '電表 LO（黑）' },
};

// AFG 開路電壓（EMF）：offset＋Vpp/2×波形；相位 0（Phase 本輪 OUT）
export function emf(ch, t) {
  const ph = (((t * ch.freq) % 1) + 1) % 1;
  let s;
  if (ch.wave === 'SINE') s = Math.sin(2 * Math.PI * ph);
  else if (ch.wave === 'SQUARE') s = ph < 0.5 ? 1 : -1;
  else { const k = Math.min(Math.max(ch.sym / 100, 1e-9), 1 - 1e-9); s = ph < k ? -1 + (2 * ph) / k : 1 - (2 * (ph - k)) / (1 - k); }
  return ch.emfOffset + (ch.emfVpp / 2) * s;
}

const LIN_X = 0.5; // h/τ 小於此值用近線性型
// r(σ)＝e^(−σ)−1＋σ（小 σ 用級數，避免相減失去精度）
function rq(σ) { return σ < 1e-2 ? σ * σ * (0.5 - σ * (1 / 6 - σ * (1 / 24 - σ * (1 / 120 - σ / 720)))) : Math.expm1(-σ) + σ; }
// ∫0^σ r(u) du＝σ²/2−σ＋1−e^(−σ)（小 σ 用級數 σ³/6−σ⁴/24＋…）
function rint(σ) {
  if (σ >= 0.1) return (σ * σ) / 2 - σ - Math.expm1(-σ);
  let t = (σ * σ * σ) / 6, sum = 0;
  for (let n = 3; n < 30 && t !== 0; n++) { sum += t; t *= -σ / (n + 1); }
  return sum;
}
// 8 點 Gauss–Legendre（近線性型的平方積分：被積函數平滑，8 點已到數值精度）
const GL8 = [[0.1834346424956498, 0.362683783378362], [0.525532409916329, 0.3137066458778873],
  [0.7966664774136267, 0.2223810344533745], [0.9602898564975363, 0.1012285362903763]].flatMap(([u, w]) => [[-u, w], [u, w]]);
// 區間內的值、從 0 積到 s、以及 ∫0^h v² ds（lin＝近線性型）
function segVal(lin, X, Y, C, s, tau) { return X + Y * s + (C ? C * (lin ? rq(s / tau) : Math.exp(-s / tau)) : 0); }
function segInt(lin, X, Y, C, s, tau) { return X * s + (Y * s * s) / 2 + (C ? C * tau * (lin ? rint(s / tau) : -Math.expm1(-s / tau)) : 0); }
function segSq(lin, X, Y, C, h, tau) {
  if (!C) return X * X * h + X * Y * h * h + (Y * Y * h * h * h) / 3;
  if (lin) {
    let S = 0;
    for (const [u, w] of GL8) { const s = ((u + 1) / 2) * h, v = X + Y * s + C * rq(s / tau); S += w * v * v; }
    return (S * h) / 2;
  }
  const E = Math.exp(-h / tau), m1 = -Math.expm1(-h / tau), m2 = -Math.expm1((-2 * h) / tau);
  return X * X * h + X * Y * h * h + (Y * Y * h * h * h) / 3 + 2 * X * C * tau * m1 + 2 * Y * C * tau * (tau * m1 - h * E) + C * C * (tau / 2) * m2;
}

// 小型高斯消去（n ≤ 3）
function linSolve(A, b) {
  const n = b.length, a = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < n; r++) {
      if (r === c || a[c][c] === 0) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((r, i) => r[n] / r[i]);
}

// bench＝{ topo, R, C, wires:{ leadId: 'A'|'B'|'G' }, loads?:[{ a, b, r }]（a、b＝接點或 'E' 大地）}；
// afg＝兩通道 { wave, freq, sym, emfVpp, emfOffset, output }
export function solve(bench, afg) {
  const { topo, R, C, wires, loads = [] } = bench;
  const warn = [];
  // ---- 1. 大地與接點合併（黑夾、接地夾都是大地）----
  const parent = { A: 'A', B: 'B', G: 'G', E: 'E' };
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const earthLeads = Object.entries(wires).filter(([id, n]) => n && LEADS[id].role === 'gnd');
  for (const [, n] of earthLeads) parent[find(n)] = find('E');
  const E = find('E');
  const grounded = (n) => find(n) === E;

  // ---- 2. 元件 ----
  const [rA, rB] = topo === 'RC' ? ['A', 'B'] : ['B', 'G'];
  const [cA, cB] = topo === 'RC' ? ['B', 'G'] : ['A', 'B'];
  const shorted = (x, y) => find(x) === find(y);
  const tdsGndOn = earthLeads.filter(([id]) => id.startsWith('TDS')).map(([id, n]) => [id, n]);
  if (shorted(cA, cB)) warn.push({ level: 'bad', text: `電容兩端被接到同一點（${cA}、${cB} 都接到大地或彼此相連），電容被短路。` });
  if (shorted(rA, rB)) warn.push({ level: 'bad', text: `電阻兩端被接到同一點（${rA}、${rB}），電阻被短路。` });
  for (const [id, n] of tdsGndOn) if (n !== 'G') warn.push({ level: 'bad', text: `${LEADS[id].name}接在 ${n}：示波器接地夾就是大地，${n} 點被直接接地（量元件兩端時不能把接地夾夾在中間點）。` });

  // ---- 3. 訊號源（AFG 紅夾，Output ON 才算）----
  const sources = [];
  [0, 1].forEach((ch) => {
    const node = wires[`AFG.CH${ch + 1}+`];
    if (!node) return;
    if (!afg[ch].output) { warn.push({ level: 'info', text: `AFG CH${ch + 1} 紅夾已接，但輸出是 OFF（按 AFG 的 OUTPUT 開啟）。` }); return; }
    if (grounded(node)) { warn.push({ level: 'bad', text: `AFG CH${ch + 1} 紅夾接在接地點 ${node}：輸出被短路到地。` }); return; }
    sources.push({ ch, node: find(node), p: afg[ch] });
  });
  const circuitGrounded = NODES.some(grounded);
  if (sources.length && !circuitGrounded) warn.push({ level: 'bad', text: '電路沒有接回地：AFG 黑夾和示波器接地夾都沒接到電路，沒有電流回路。' });
  if (!Object.keys(wires).some((id) => id.endsWith('+') && wires[id])) warn.push({ level: 'info', text: '還沒有接 AFG 紅夾（訊號源）。' });

  // ---- 4. 節點方程（未知數＝非大地的合併節點）----
  const groups = [...new Set(NODES.map(find))].filter((g) => g !== E);
  const idx = Object.fromEntries(groups.map((g, i) => [g, i]));
  const n = groups.length;
  const G0 = Array.from({ length: n }, () => new Array(n).fill(0));
  const stamp = (x, y, g) => {
    const i = x === E ? -1 : idx[x], j = y === E ? -1 : idx[y];
    if (i >= 0) G0[i][i] += g;
    if (j >= 0) G0[j][j] += g;
    if (i >= 0 && j >= 0) { G0[i][j] -= g; G0[j][i] -= g; }
  };
  groups.forEach((g) => stamp(g, E, GMIN));
  if (!shorted(rA, rB)) stamp(find(rA), find(rB), 1 / R);
  sources.forEach((s) => stamp(s.node, E, 1 / R_OUT));
  // 儀器輸入電阻：接上就並聯在電路上（負載效應）
  for (const L of loads) { const x = L.a === 'E' ? E : find(L.a), y = L.b === 'E' ? E : find(L.b); if (x !== y) stamp(x, y, 1 / L.r); }
  const solveI = (I) => (n ? linSolve(G0, I) : []);
  const volt = (v, x) => (x === E ? 0 : v[idx[x]]);
  const inj = (pairs) => { const I = new Array(n).fill(0); for (const [x, a] of pairs) if (x !== E) I[idx[x]] += a; return I; };

  // 電容電流 1 A 的節點響應 z、戴維寧電阻 Rth；電容電壓比穩態多 δ 時，接點電壓多 kv·δ
  const P = find(cA), Q = find(cB), capLive = P !== Q;
  const z = capLive ? solveI(inj([[P, -1], [Q, 1]])) : new Array(n).fill(0);
  const Rth = capLive ? -(volt(z, P) - volt(z, Q)) : 0;
  const tau = capLive ? Rth * C : 0;
  const kv = Object.fromEntries(NODES.map((x) => { const g = find(x); return [x, capLive && Rth > 0 && g !== E ? -z[idx[g]] / Rth : 0]; }));
  const common = { warn, grounded: Object.fromEntries(NODES.map((x) => [x, grounded(x)])), Rth, tau, capLive, kv };

  // ---- 5. 週期與取樣 ----
  if (!sources.length) return { ...common, period: 0, dc: true, v: { A: 0, B: 0, G: 0 }, vcAt: () => 0 };
  // 每個訊號源單位 EMF 的節點電壓（電容開路）u_j
  const u = sources.map((s) => solveI(inj([[s.node, 1 / R_OUT]])));
  const kth = u.map((v) => (capLive ? volt(v, P) - volt(v, Q) : 0));
  const f = sources[0].p.freq;
  if (sources.some((s) => Math.abs(s.p.freq - f) > 1e-9 * f)) warn.push({ level: 'info', text: '兩個 AFG 通道頻率不同：本模擬以 CH1 的週期計算，畫面只是近似。' });
  const T = 1 / f, h = T / M;
  const e = sources.map((s) => Float64Array.from({ length: M + 1 }, (_, k) => emf(s.p, k * h)));
  const vth = Float64Array.from({ length: M + 1 }, (_, k) => sources.reduce((acc, s, j) => acc + kth[j] * e[j][k], 0));
  // 區間內各訊號源的斜率（方波在跳變前保持原值＝0）與 Vth 的斜率
  const slope = sources.map((s, j) => Float64Array.from({ length: M }, (_, k) => (s.p.wave === 'SQUARE' ? 0 : (e[j][k + 1] - e[j][k]) / h)));
  const dv = Float64Array.from({ length: M }, (_, k) => sources.reduce((acc, s, j) => acc + kth[j] * slope[j][k] * h, 0));
  const vc = new Float64Array(M + 1);
  let mean = 0;
  for (let k = 0; k < M; k++) mean += vth[k] / M;
  const slow = capLive && tau > 1e6 * T; // 時間常數遠大於週期：電容電壓＝輸入平均值
  if (capLive) {
    if (slow) vc.fill(mean);
    else {
      const step = h / tau, decay = -Math.expm1(-step);
      // 線性輸入的係數 1−(1−exp(−step))/step；小 step 用級數避免相減失去精度。
      const ramp = step < 1e-3
        ? step * (0.5 + step * (-1 / 6 + step * (1 / 24 - step / 120)))
        : 1 - decay / step;
      const run = (x0) => {
        vc[0] = x0;
        for (let k = 0; k < M; k++) {
          // 方波在跳變前保持原值，電容電壓到邊緣仍連續；不要提前一格充放電。
          vc[k + 1] = vc[k] + decay * (vth[k] - vc[k]) + ramp * dv[k];
        }
        return vc[M];
      };
      const b = run(0), cycleDecay = -Math.expm1(-T / tau);
      run(cycleDecay > 1e-12 ? b / cycleDecay : mean);
    }
  }
  // ---- 6. 各接點電壓（對大地）：區間 k 內的解析式（s＝t−k·h），取樣表＝區間起點的值 ----
  const out = {}, co = {};
  const live = capLive && Rth > 0;
  const lin = !live || slow || h / tau < LIN_X;
  for (const x of NODES) {
    const g = find(x), X = new Float64Array(M), Y = new Float64Array(M), Cc = new Float64Array(M), arr = new Float64Array(M);
    if (g !== E) {
      const gi = idx[g], zr = live ? z[gi] / Rth : 0;
      for (let k = 0; k < M; k++) {
        let a0 = 0, b0 = 0;
        sources.forEach((s, j) => { a0 += e[j][k] * u[j][gi]; b0 += slope[j][k] * u[j][gi]; });
        const gk = dv[k] / h, dk = vth[k] - vc[k]; // 區間內 Vth 的斜率；Vth−Vc
        if (!live) { X[k] = a0; Y[k] = b0; } else if (slow) { X[k] = a0 + zr * (vth[k] - mean); Y[k] = b0 + zr * gk; } else if (lin) {
          X[k] = a0 + zr * dk; // 區間起點的值
          Y[k] = b0 + zr * (gk - dk / tau); // 區間起點的斜率
          Cc[k] = zr * (dk - gk * tau); // 乘上 r(s/τ) 的彎曲量
        } else {
          X[k] = a0 + zr * gk * tau;
          Y[k] = b0;
          Cc[k] = zr * (dk - gk * tau);
        }
        arr[k] = lin ? X[k] : X[k] + Cc[k];
      }
    }
    out[x] = arr;
    co[x] = { x: X, y: Y, c: Cc };
  }
  // 電容電壓（週期穩態）在絕對時間 t 的精確值：換線／改設定時接續暫態用（寫成不會大數相消的形式）
  const vcAt = (t) => {
    if (!capLive) return 0;
    if (slow) return mean;
    const [k, s] = locate({ h, period: T }, t), gk = dv[k] / h, σ = s / tau;
    return vc[k] + (vth[k] - vc[k]) * -Math.expm1(-σ) + gk * tau * rq(σ);
  };
  return { ...common, period: T, h, dc: false, lin, v: out, co, vcAt };
}

// 絕對時間 t 落在哪個區間：[k, s]（t 剛好在週期邊界時浮點誤差可能讓相位略小於 0，夾回區間內）
function locate(sol, t) {
  const { h, period: T } = sol, ph = t - Math.floor(t / T) * T, k = Math.max(0, Math.min(M - 1, Math.floor(ph / h)));
  return [k, Math.max(0, ph - k * h)];
}

// 某接點在絕對時間 t 的週期穩態電壓（取樣點之間照解析式，不是線性內插）
export function nodeAt(sol, node, t) {
  if (sol.dc) return 0;
  const q = sol.co[node], [k, s] = locate(sol, t);
  return segVal(sol.lin, q.x[k], q.y[k], q.c[k], s, sol.tau);
}

// HI−LO 電壓差的區間係數、一個週期內的累積積分與統計（每個解答、每組 HI／LO 只算一次）
function diff(sol, hi, lo) {
  const key = `${hi}${lo}`;
  sol.memo ??= {};
  if (sol.memo[key]) return sol.memo[key];
  const { h, tau, lin } = sol, P = sol.co[hi], Q = sol.co[lo];
  const X = Float64Array.from(P.x, (v, k) => v - Q.x[k]), Y = Float64Array.from(P.y, (v, k) => v - Q.y[k]), C = Float64Array.from(P.c, (v, k) => v - Q.c[k]);
  const pre = new Float64Array(M + 1);
  for (let k = 0; k < M; k++) pre[k + 1] = pre[k] + segInt(lin, X[k], Y[k], C[k], h, tau);
  const T = M * h, mean = pre[M] / T;
  let S = 0, peak = 0, peakAc = 0;
  for (let k = 0; k < M; k++) {
    S += segSq(lin, X[k] - mean, Y[k], C[k], h, tau); // ∫(v−平均)²：先扣平均再平方，避免大直流吃掉交流
    const v = lin ? X[k] : X[k] + C[k]; // 區間起點（脈衝尖峰正好落在跳變點）
    if (Math.abs(v) > peak) peak = Math.abs(v);
    if (Math.abs(v - mean) > peakAc) peakAc = Math.abs(v - mean);
  }
  return (sol.memo[key] = { X, Y, C, pre, stats: { mean, acRms: Math.sqrt(Math.max(0, S / T)), peak, peakAc } });
}

// HI−LO 的週期精確統計：平均、交流有效值（區間內解析積分，窄脈衝、長時間常數都準）、峰值
export function diffStats(sol, hi, lo) {
  if (sol.dc) return { mean: 0, acRms: 0, peak: 0, peakAc: 0 };
  return diff(sol, hi, lo).stats;
}

// HI−LO 在時間窗 [t1, t2] 的平均（週期延拓，分段精確積分）：電表 DCV 的積分窗
export function diffMeanOver(sol, hi, lo, t1, t2) {
  if (sol.dc) return 0;
  if (!(t2 > t1)) return diffStats(sol, hi, lo).mean;
  const { tau, lin, period: T } = sol, d = diff(sol, hi, lo);
  const part = (t) => { const [k, s] = locate(sol, t); return d.pre[k] + segInt(lin, d.X[k], d.Y[k], d.C[k], s, tau); }; // 從該週期起點積到 t
  const n = Math.floor(t2 / T) - Math.floor(t1 / T);
  return (n * d.pre[M] + part(t2) - part(t1)) / (t2 - t1);
}

// 電表 Ω 檔的直流電阻（電路未通電時）：黑夾、接地夾把接點接到大地；電容開路；
// 板上電阻＋已接上的儀器輸入電阻（例如示波器探棒 10 MΩ 對大地）都會並聯進來
export function ohms(bench, hi, lo) {
  const { topo, R, wires, loads = [] } = bench;
  const parent = { A: 'A', B: 'B', G: 'G', E: 'E' };
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  Object.entries(wires).forEach(([id, nd]) => { if (nd && LEADS[id].role === 'gnd') parent[find(nd)] = find('E'); });
  const h = find(hi), l = find(lo), E = find('E');
  if (h === l) return 0.05; // 同一點（導線／接地相連）：只剩測試線電阻
  const groups = [...new Set(NODES.map(find))].filter((g) => g !== E), idx = Object.fromEntries(groups.map((g, i) => [g, i]));
  const G0 = groups.map(() => new Array(groups.length).fill(0));
  const stamp = (x, y, g) => {
    const i = x === E ? -1 : idx[x], j = y === E ? -1 : idx[y];
    if (i >= 0) G0[i][i] += g;
    if (j >= 0) G0[j][j] += g;
    if (i >= 0 && j >= 0) { G0[i][j] -= g; G0[j][i] -= g; }
  };
  groups.forEach((g) => stamp(g, E, 1e-15));
  const [rA, rB] = topo === 'RC' ? ['A', 'B'] : ['B', 'G'];
  if (find(rA) !== find(rB)) stamp(find(rA), find(rB), 1 / R);
  for (const L of loads) { const x = L.a === 'E' ? E : find(L.a), y = L.b === 'E' ? E : find(L.b); if (x !== y) stamp(x, y, 1 / L.r); }
  const I = groups.map((g) => (g === h ? 1 : g === l ? -1 : 0));
  const v = linSolve(G0, I), vol = (x) => (x === E ? 0 : v[idx[x]]);
  const r = vol(h) - vol(l);
  return r > 1e11 ? Infinity : r;
}

// 某接點的電壓波形（週期表）或 null（該點沒有訊號時仍回傳 0 陣列）
export function nodeWave(sol, node) {
  if (sol.dc) return null;
  return sol.v[node];
}

// 波形統計：平均（直流）、交流有效值（去掉直流）
export function stats(arr) {
  if (!arr) return { mean: 0, acRms: 0, pp: 0 };
  let s = 0, mx = -Infinity, mn = Infinity;
  for (const x of arr) { s += x; if (x > mx) mx = x; if (x < mn) mn = x; }
  const mean = s / arr.length;
  let q = 0;
  for (const x of arr) q += (x - mean) ** 2;
  return { mean, acRms: Math.sqrt(q / arr.length), pp: mx - mn };
}
