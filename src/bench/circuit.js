// 實驗台電路計算：AFG → RC → 示波器／電表（J 階段，使用者 2026-09-30 指定先做這個實驗）。
// 模型：板上三個接點 A、B、G，串聯 RC（topo 'RC'：R 在 A–B、C 在 B–G；'CR'：C 在 A–B、R 在 B–G）。
//   AFG 每通道＝EMF e(t) 串 50 Ω 內阻（AFG-F10：內阻固定 50 Ω；Output OFF＝高阻、不接）；黑夾＝AFG 機殼地（大地）。
//   示波器接地夾＝大地（接在哪一點，那一點就被接到大地）；探棒尖端量「該點對大地」的電壓。
//   電表浮接，量 HI−LO；探棒與電表的輸入阻抗（10 MΩ 級）忽略不計。
// 解法：只有一顆電容 → 戴維寧等效 Vth(t)、Rth，一階方程 dVc/dt＝(Vth−Vc)/(Rth·C) 在每段取樣間以
//   分段線性輸入精確積分；週期穩態用 shooting：Vc(T)＝a·Vc(0)＋b → Vc(0)＝b/(1−a)。
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

// bench＝{ topo, R, C, wires:{ leadId: 'A'|'B'|'G' } }；afg＝兩通道 { wave, freq, sym, emfVpp, emfOffset, output }
export function solve(bench, afg) {
  const { topo, R, C, wires } = bench;
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
  const solveI = (I) => (n ? linSolve(G0, I) : []);
  const volt = (v, x) => (x === E ? 0 : v[idx[x]]);
  const inj = (pairs) => { const I = new Array(n).fill(0); for (const [x, a] of pairs) if (x !== E) I[idx[x]] += a; return I; };

  // 每個訊號源單位 EMF 的節點電壓（電容開路）u_j，與電容電流 1 A 的節點響應 z
  const P = find(cA), Q = find(cB), capLive = P !== Q;
  const u = sources.map((s) => solveI(inj([[s.node, 1 / R_OUT]])));
  const z = capLive ? solveI(inj([[P, -1], [Q, 1]])) : new Array(n).fill(0);
  const kth = u.map((v) => (capLive ? volt(v, P) - volt(v, Q) : 0));
  const Rth = capLive ? -(volt(z, P) - volt(z, Q)) : 0;

  // ---- 5. 週期與取樣 ----
  if (!sources.length) return { period: 0, dc: true, v: { A: 0, B: 0, G: 0 }, warn, grounded: Object.fromEntries(NODES.map((x) => [x, grounded(x)])), Rth, tau: 0 };
  const f = sources[0].p.freq;
  if (sources.some((s) => Math.abs(s.p.freq - f) > 1e-9 * f)) warn.push({ level: 'info', text: '兩個 AFG 通道頻率不同：本模擬以 CH1 的週期計算，畫面只是近似。' });
  const T = 1 / f, h = T / M;
  const e = sources.map((s) => Float64Array.from({ length: M + 1 }, (_, k) => emf(s.p, k * h)));
  const vth = Float64Array.from({ length: M + 1 }, (_, k) => sources.reduce((acc, s, j) => acc + kth[j] * e[j][k], 0));
  const tau = capLive ? Rth * C : 0;
  const vc = new Float64Array(M + 1);
  if (capLive) {
    let mean = 0;
    for (let k = 0; k < M; k++) mean += vth[k] / M;
    if (tau > 1e6 * T) vc.fill(mean); // 時間常數遠大於週期：電容電壓＝輸入平均值
    else {
      const E1 = Math.exp(-h / tau);
      const run = (x0) => {
        vc[0] = x0;
        for (let k = 0; k < M; k++) {
          const u0 = vth[k], u1 = vth[k + 1], sl = (u1 - u0) / h;
          vc[k + 1] = u1 - sl * tau + (vc[k] - u0 + sl * tau) * E1;
        }
        return vc[M];
      };
      const b = run(0), a = Math.exp(-T / tau);
      run(1 - a > 1e-12 ? b / (1 - a) : mean);
    }
  }
  // ---- 6. 各接點電壓波形（對大地）----
  const out = {};
  for (const x of NODES) {
    const g = find(x), arr = new Float64Array(M);
    if (g !== E) {
      for (let k = 0; k < M; k++) {
        let v = 0;
        sources.forEach((s, j) => { v += e[j][k] * u[j][idx[g]]; });
        if (capLive && Rth > 0) v += ((vth[k] - vc[k]) / Rth) * z[idx[g]];
        arr[k] = v;
      }
    }
    out[x] = arr;
  }
  return { period: T, dc: false, v: out, warn, grounded: Object.fromEntries(NODES.map((x) => [x, grounded(x)])), Rth, tau };
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
