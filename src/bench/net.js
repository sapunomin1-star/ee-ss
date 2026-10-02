// 通用線性電路解算（實驗台的麵包板與固定 RC 板共用）：電阻、電容（可多顆）、AFG（EMF 串 50 Ω）、GPE 直流通道（CV／CC）、
// 儀器輸入電阻。求週期穩態（AFG 週期；沒有 AFG 時為直流），並提供逐點精確值、區間精確積分（RMS、時間窗平均）與暫態用的模態資料。
//
// 作法：節點方程 Cn·v′＋G·v＝i(t)。
//   1. 電容的關聯向量張成「動態子空間」P，其餘為「代數子空間」Q；代數部分用 Schur 補數消去 → 只剩電容電壓的 r 維系統
//      Cr·z′＝−Gr·z＋Br·i（沒有人為的小電容，慢模態的精度不被快模態拖累）。
//   2. 廣義特徵分解 Gr·ψ＝λ·Cr·ψ 化成 r 個獨立的一階模態 y′＝−λy＋g(t)；每個取樣區間內輸入是一次式，用
//      φ 函數精確積分：y(s)＝y₀＋(p₀−λy₀)·s·φ₁(λs)＋p₁·s²·φ₂(λs)（對任何 λ 都不會大數相消）。
//   3. 一般把時間常數短於 1 ns 的模態視為瞬間跟上；實驗台有 GPE 時保留這些模態，先以真實初始電荷判斷限流。
//   節點電壓在區間內＝A＋B·s＋Σ_m w_m·(a_m·s·φ₁(λ_m s)＋b_m·s²·φ₂(λ_m s))；平方積分用分段 Gauss–Legendre（快模態在區間開頭分級）。
import { emf } from './circuit.js';

export const M = 4000;          // 每週期取樣點（與固定 RC 板相同）
export const R_OUT = 50;        // AFG 輸出內阻
export const R_GPE = 0.01;      // GPE CV 的輸出電阻（近似理想電壓源）
const GMIN = 1e-12;             // 每個節點對地的極小電導
const LAMBDA_FAST = 1e9;        // 比這快的模態（τ < 1 ns）當作瞬間跟上

// ---- φ 函數：φk(z)＝Σ (−z)^n/(n+k)!，小 z 用級數，大 z 用閉式 ----
function phi(k, z) {
  if (z < 0.2) {
    let t = 1, f = 1, sum = 0;
    for (let i = 2; i <= k; i++) f *= i;
    t = 1 / f;
    for (let n = 0; n < 24; n++) { sum += t; t *= -z / (n + k + 1); }
    return sum;
  }
  const e = Math.expm1(-z); // e^(−z)−1
  if (k === 1) return -e / z;
  if (k === 2) return (z + e) / (z * z);
  return ((z * z) / 2 - z - e) / (z * z * z); // k＝3
}

// ---- 小型線性代數（n 通常 < 30）----
const zeros = (n, m) => Array.from({ length: n }, () => new Float64Array(m));
function cholesky(A) { // A＝L·Lᵀ（對稱正定）；回傳 L
  const n = A.length, L = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-300));
      else L[i][j] = s / L[j][j];
    }
  }
  return L;
}
const fwd = (L, b) => { const n = L.length, x = new Float64Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * x[k]; x[i] = s / L[i][i]; } return x; };
const bwdT = (L, b) => { const n = L.length, x = new Float64Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; } return x; };
const cholSolve = (L, b) => bwdT(L, fwd(L, b));
// 反覆修正：浮接電路（GPE 不接地）的節點矩陣條件數可到 10¹⁴，單次 Cholesky 會有 1e-5 級的誤差；
// 用殘差再解幾次，把誤差壓到接近機器精度
function refined(A, L, b) {
  const x = cholSolve(L, b), n = x.length;
  for (let it = 0; it < 4; it++) {
    const r = Float64Array.from(b);
    for (let i = 0; i < n; i++) { let sum = 0; for (let j = 0; j < n; j++) sum += A[i][j] * x[j]; r[i] -= sum; }
    const dx = cholSolve(L, r);
    let big = 0; for (let i = 0; i < n; i++) { x[i] += dx[i]; big = Math.max(big, Math.abs(dx[i])); }
    if (big === 0) break;
  }
  return x;
}
// 對稱矩陣 Jacobi 特徵分解：回傳 { val, vec }（vec[i][m]＝第 m 個特徵向量的第 i 分量）
function jacobi(S) {
  const n = S.length, A = S.map((r) => Float64Array.from(r)), V = zeros(n, n);
  for (let i = 0; i < n; i++) V[i][i] = 1;
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0, diag = 0;
    for (let i = 0; i < n; i++) { diag += A[i][i] * A[i][i]; for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j]; }
    if (off <= 1e-30 * diag || off === 0) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (A[p][q] === 0) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
      for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
      for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
    }
  }
  return { val: Array.from({ length: n }, (_, i) => A[i][i]), vec: V };
}
// 正交化：把 vecs 依序做 Gram–Schmidt（兩遍），長度小於 tol 的丟掉
function orthonormal(vecs, basis = [], tol = 1e-9) {
  const out = [];
  for (const v0 of vecs) {
    const v = Float64Array.from(v0);
    for (let pass = 0; pass < 2; pass++) for (const b of [...basis, ...out]) { let d = 0; for (let i = 0; i < v.length; i++) d += b[i] * v[i]; for (let i = 0; i < v.length; i++) v[i] -= d * b[i]; }
    let nn = 0; for (const x of v) nn += x * x;
    nn = Math.sqrt(nn);
    if (nn > tol) out.push(v.map((x) => x / nn));
  }
  return out;
}

// 8 點 Gauss–Legendre（[-1,1]）
const GL8 = [[0.1834346424956498, 0.362683783378362], [0.525532409916329, 0.3137066458778873],
  [0.7966664774136267, 0.2223810344533745], [0.9602898564975363, 0.1012285362903763]].flatMap(([u, w]) => [[-u, w], [u, w]]);

// net＝{ nodes:[名稱], elements:[{id, kind:'R'|'C', a, b, value}], loads:[{a, b, r}],
//        afg:[{ node, p:{wave,freq,sym,emfVpp,emfOffset} }]（黑夾＝大地）, dc:[{ id, pos, neg, v, i, mode:'CV'|'CC' }] }
// 節點名 'E'＝大地。回傳週期穩態解（見檔頭）。
export function solveNet(net, { retainFastModes = false } = {}) {
  const names = net.nodes.filter((x) => x !== 'E'), n = names.length, idx = new Map(names.map((x, i) => [x, i]));
  const at = (x) => (x === 'E' || !idx.has(x) ? -1 : idx.get(x));
  const G = zeros(n, n), Cn = zeros(n, n);
  const stamp = (Mx, a, b, g) => {
    const i = at(a), j = at(b);
    if (i >= 0) Mx[i][i] += g;
    if (j >= 0) Mx[j][j] += g;
    if (i >= 0 && j >= 0) { Mx[i][j] -= g; Mx[j][i] -= g; }
  };
  for (let i = 0; i < n; i++) G[i][i] += GMIN;
  const caps = [];
  for (const el of net.elements) {
    if (at(el.a) === at(el.b)) continue; // 兩端同一點：被短路（不影響電路）
    if (el.kind === 'R') stamp(G, el.a, el.b, 1 / el.value);
    if (el.kind === 'C') { stamp(Cn, el.a, el.b, el.value); caps.push({ id: el.id, key: el.stateId ?? el.id, a: at(el.a), b: at(el.b), C: el.value }); }
  }
  for (const L of net.loads || []) if (at(L.a) !== at(L.b)) stamp(G, L.a, L.b, 1 / L.r);
  // 電源的 Norton 等效：AFG＝EMF/50 注入紅夾節點；GPE CV＝V/R_GPE 注入＋、流出−（並聯 1/R_GPE）；CC＝定電流
  const inj = (a, b, amp) => { const v = new Float64Array(n); const i = at(a), j = at(b); if (i >= 0) v[i] += amp; if (j >= 0) v[j] -= amp; return v; };
  const afg = (net.afg || []).filter((s) => at(s.node) >= 0);
  for (const s of afg) stamp(G, s.node, 'E', 1 / R_OUT);
  const nAfg = afg.map((s) => inj(s.node, 'E', 1 / R_OUT)); // 乘上 EMF
  const nDc = new Float64Array(n);
  for (const s of net.dc || []) {
    if (at(s.pos) === at(s.neg) || s.mode === 'RB') continue; // RB：被其他電源灌入、不能吸收電流 → 開路
    if (s.mode === 'CC') { const v = inj(s.pos, s.neg, s.i); for (let i = 0; i < n; i++) nDc[i] += v[i]; } else {
      stamp(G, s.pos, s.neg, 1 / R_GPE);
      const v = inj(s.pos, s.neg, s.v / R_GPE);
      for (let i = 0; i < n; i++) nDc[i] += v[i];
    }
  }

  // ---- 動態／代數子空間 ----
  const dvec = caps.map((c) => { const v = new Float64Array(n); if (c.a >= 0) v[c.a] += 1; if (c.b >= 0) v[c.b] -= 1; return v; });
  const P = orthonormal(dvec), r = P.length;
  const unit = Array.from({ length: n }, (_, i) => { const v = new Float64Array(n); v[i] = 1; return v; });
  const Q = orthonormal(unit, P, 1e-6).slice(0, n - r), q = Q.length;
  const mul = (A, x) => { const y = new Float64Array(A.length); for (let i = 0; i < A.length; i++) { let s = 0; for (let j = 0; j < x.length; j++) s += A[i][j] * x[j]; y[i] = s; } return y; };
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const GP = P.map((p) => mul(G, p)), GQ = Q.map((u) => mul(G, u)), CP = P.map((p) => mul(Cn, p));
  const Gqq = Q.map((u) => GQ.map((g) => dot(u, g))), Lq = q ? cholesky(Gqq) : [];
  // X＝Gqq⁻¹·Gqp（q×r）。注意：不組出 Gqq⁻¹ 本身——浮接電路的 Gqq⁻¹ 每一項都約 1/GMIN，真正的差動資訊是大數間的
  //   小差，乘上去會只剩幾位有效數字；一律對每個向量直接解（再反覆修正）
  const X = P.map((_, j) => (q ? refined(Gqq, Lq, Q.map((u) => dot(u, GP[j]))) : new Float64Array(0))); // X[j]＝第 j 行
  const Gr = P.map((p, i) => P.map((_, j) => dot(p, GP[j]) - Q.reduce((s, u, k) => s + dot(u, GP[i]) * X[j][k], 0)));
  const Cr = P.map((p) => CP.map((c) => dot(p, c)));
  // Hz＝P−Q·X（n×r，行 j）：電容狀態 z 對節點電壓的影響
  const Hz = P.map((p, j) => { const v = Float64Array.from(p); Q.forEach((u, k) => { for (let i = 0; i < n; i++) v[i] -= u[i] * X[j][k]; }); return v; });

  // ---- 模態 ----
  let lam = [], Phi = [], Psi = [];
  if (r) {
    const L = cholesky(Cr);
    const M1 = Gr.map((_, j) => fwd(L, Gr.map((row) => row[j]))); // M1[j]＝L⁻¹·Gr 的第 j 行
    const S = Array.from({ length: r }, (_, i) => Float64Array.from({ length: r }, (_, j) => M1[j][i]));
    const S2 = S.map((row) => fwd(L, row)); // 第 i 行＝L⁻¹·(L⁻¹Gr 的第 i 列)＝(L⁻¹·Gr·L⁻ᵀ) 的第 i 行
    const Ssym = S2.map((row, i) => row.map((x, j) => (x + S2[j][i]) / 2));
    const { val, vec } = jacobi(Ssym);
    Psi = val.map((_, m) => bwdT(L, vec.map((row) => row[m]))); // Psi[m]（z 空間）
    lam = val.map((x) => Math.max(x, 0));
    Phi = Psi.map((psi) => { const v = new Float64Array(n); Hz.forEach((h, j) => { for (let i = 0; i < n; i++) v[i] += h[i] * psi[j]; }); return v; });
  }
  // GPE 的限流判斷必須先看見所有電容的初始電壓；CV 的快模態也可能
  // 對應到數百 µs 的 CC 充電，不能在判斷之前把初始電荷消去。
  const fastLimit = retainFastModes ? Infinity : LAMBDA_FAST;
  const slow = lam.map((l, m) => m).filter((m) => lam[m] <= fastLimit);
  // 某個輸入向量 u（Norton 注入）的響應：代數部分 Q·Gqq⁻¹·Qᵀu（直接解）＋快模態的準靜態部分；慢模態的輸入係數 Ψᵀ·Br·u
  const respond = (u) => {
    const w = q ? refined(Gqq, Lq, Q.map((qq) => dot(qq, u))) : new Float64Array(0);
    const alg = new Float64Array(n);
    Q.forEach((qq, k) => { for (let i = 0; i < n; i++) alg[i] += qq[i] * w[k]; });
    const bru = P.map((p, i) => dot(p, u) - Q.reduce((s2, qq, k) => s2 + dot(qq, GP[i]) * w[k], 0));
    const g = Psi.map((psi) => dot(psi, bru));
    lam.forEach((l, m) => { if (l > fastLimit) for (let i = 0; i < n; i++) alg[i] += (Phi[m][i] * g[m]) / l; });
    return { alg, beta: slow.map((m) => g[m]) };
  };
  const rAfg = nAfg.map(respond), rDc = respond(nDc);
  const hAfg = rAfg.map((x) => x.alg), hDc = rDc.alg;

  // ---- 週期與輸入 ----
  const periodic = afg.length > 0;
  const T = periodic ? 1 / afg[0].p.freq : 1, h = T / M;
  const e = afg.map((s) => Float64Array.from({ length: M + 1 }, (_, k) => emf(s.p, k * h)));
  const ed = afg.map((s, j) => Float64Array.from({ length: M }, (_, k) => (s.p.wave === 'SQUARE' ? 0 : (e[j][k + 1] - e[j][k]) / h)));
  const R = slow.length, lamS = slow.map((m) => lam[m]), PhiS = slow.map((m) => Phi[m]);
  const beta = slow.map((m, si) => rAfg.map((x) => x.beta[si])), kappa = slow.map((m, si) => rDc.beta[si]);
  // 每個慢模態：區間起點 y、區間內 a＝p0−λy、b＝p1
  const Y0 = [], Aco = [], Bco = [];
  slow.forEach((m, si) => {
    const l = lamS[si], E1 = Math.exp(-l * h), f1 = h * phi(1, l * h), f2 = h * h * phi(2, l * h);
    const p0 = new Float64Array(M), p1 = new Float64Array(M);
    for (let k = 0; k < M; k++) { let a = kappa[si], b = 0; afg.forEach((_, j) => { a += beta[si][j] * e[j][k]; b += beta[si][j] * ed[j][k]; }); p0[k] = a; p1[k] = b; }
    const y = new Float64Array(M + 1);
    const run = (y0) => { y[0] = y0; for (let k = 0; k < M; k++) y[k + 1] = y[k] * E1 + p0[k] * f1 + p1[k] * f2; return y[M]; };
    const b0 = run(0), cyc = -Math.expm1(-l * T);
    run(cyc > 1e-300 ? b0 / cyc : 0);
    Y0.push(y);
    Aco.push(Float64Array.from({ length: M }, (_, k) => p0[k] - l * y[k]));
    Bco.push(p1);
  });

  // ---- 節點的區間係數：A（起點值）、B（輸入的一次項）；模態權重＝PhiS[si][i] ----
  const Aof = (w, wsrc, wdc) => Float64Array.from({ length: M }, (_, k) => { // w：各慢模態權重；wsrc：各 AFG 權重；wdc：直流
    let v = wdc;
    for (let si = 0; si < R; si++) v += w[si] * Y0[si][k];
    for (let j = 0; j < afg.length; j++) v += wsrc[j] * e[j][k];
    return v;
  });
  const Bof = (wsrc) => Float64Array.from({ length: M }, (_, k) => { let v = 0; for (let j = 0; j < afg.length; j++) v += wsrc[j] * ed[j][k]; return v; });
  const nodeW = (x) => { const i = at(x); return i < 0 ? null : { w: PhiS.map((p) => p[i]), wsrc: hAfg.map((v) => v[i]), wdc: hDc[i] }; };
  const tables = new Map();
  const table = (x) => {
    if (!tables.has(x)) { const W = nodeW(x); tables.set(x, W ? Aof(W.w, W.wsrc, W.wdc) : new Float64Array(M)); }
    return tables.get(x);
  };
  const locate = (t) => { const ph = t - Math.floor(t / T) * T, k = Math.max(0, Math.min(M - 1, Math.floor(ph / h))); return [k, Math.max(0, ph - k * h)]; };
  // 區間 k、偏移 s 的值（權重組 W；A、B 已算好的陣列）
  const valAt = (W, A, B, k, s) => {
    let v = A[k] + B[k] * s;
    for (let si = 0; si < R; si++) if (W.w[si]) { const z = lamS[si] * s; v += W.w[si] * (Aco[si][k] * s * phi(1, z) + Bco[si][k] * s * s * phi(2, z)); }
    return v;
  };
  const intAt = (W, A, B, k, s) => { // ∫0^s
    let v = A[k] * s + (B[k] * s * s) / 2;
    for (let si = 0; si < R; si++) if (W.w[si]) { const z = lamS[si] * s; v += W.w[si] * (Aco[si][k] * s * s * phi(2, z) + Bco[si][k] * s * s * s * phi(3, z)); }
    return v;
  };
  const bCache = new Map();
  const Bnode = (x) => { if (!bCache.has(x)) { const W = nodeW(x); bCache.set(x, W ? Bof(W.wsrc) : new Float64Array(M)); } return bCache.get(x); };
  const nodeAtFast = (x, t) => { const W = nodeW(x); if (!W) return 0; const [k, s] = locate(t); return valAt(W, table(x), Bnode(x), k, s); };

  // HI−LO 的統計與時間窗平均（每組只算一次）
  const memo = new Map();
  const pair = (hi, lo) => {
    const key = `${hi}|${lo}`;
    if (memo.has(key)) return memo.get(key);
    const Wh = nodeW(hi), Wl = nodeW(lo), zero = { w: PhiS.map(() => 0), wsrc: afg.map(() => 0), wdc: 0 };
    const a = Wh || zero, b = Wl || zero;
    const W = { w: a.w.map((x, i) => x - b.w[i]), wsrc: a.wsrc.map((x, i) => x - b.wsrc[i]), wdc: a.wdc - b.wdc };
    const A = Aof(W.w, W.wsrc, W.wdc), B = Bof(W.wsrc);
    const pre = new Float64Array(M + 1);
    for (let k = 0; k < M; k++) pre[k + 1] = pre[k] + intAt(W, A, B, k, h);
    const mean = pre[M] / T;
    // 平方積分：每個「銳利」模態（λh ≥ 0.5）都在區間開頭分級切段（0.5／λ…32／λ），各段 8 點 Gauss–Legendre；
    //   只看最快的一個會漏掉較慢的尖峰（兩個時間常數差很多時）
    const cutSet = new Set([0, h]);
    lamS.forEach((l, si) => { if (W.w[si] && l * h >= 0.5) for (const c of [0.5, 1, 2, 4, 8, 16, 32]) { const s = c / l; if (s < h) cutSet.add(s); } });
    const cuts = [...cutSet].sort((a, b) => a - b);
    let S = 0, peak = 0, peakAc = 0;
    for (let k = 0; k < M; k++) {
      for (let c = 0; c + 1 < cuts.length; c++) {
        const s0 = cuts[c], s1 = cuts[c + 1], half = (s1 - s0) / 2;
        for (const [u, wgt] of GL8) { const v = valAt(W, A, B, k, s0 + (u + 1) * half) - mean; S += wgt * half * v * v; }
      }
      const v0 = A[k];
      if (Math.abs(v0) > peak) peak = Math.abs(v0);
      if (Math.abs(v0 - mean) > peakAc) peakAc = Math.abs(v0 - mean);
    }
    const res = { W, A, B, pre, stats: { mean, acRms: Math.sqrt(Math.max(0, S / T)), peak, peakAc } };
    memo.set(key, res);
    return res;
  };
  const stats = (hi, lo) => pair(hi, lo).stats;
  const meanOver = (hi, lo, t1, t2) => {
    const d = pair(hi, lo);
    if (!(t2 > t1)) return d.stats.mean;
    const part = (t) => { const [k, s] = locate(t); return d.pre[k] + intAt(d.W, d.A, d.B, k, s); };
    const nn = Math.floor(t2 / T) - Math.floor(t1 / T);
    return (nn * d.pre[M] + part(t2) - part(t1)) / (t2 - t1);
  };

  // ---- 暫態用：電容電壓、模態對電容的影響、節點權重 ----
  const capSS = (t) => caps.map((c) => (c.a >= 0 ? nodeAtFast(names[c.a], t) : 0) - (c.b >= 0 ? nodeAtFast(names[c.b], t) : 0));
  const D = caps.map((c) => lamS.map((_, si) => (c.a >= 0 ? PhiS[si][c.a] : 0) - (c.b >= 0 ? PhiS[si][c.b] : 0)));
  // 給定各電容改變前一刻的電壓，求慢模態的偏移量 a。電路一接上，被導線直接連在一起的電容瞬間重新分配電荷：
  //   每個節點上的電荷守恆 ⇔ 以電容量加權的最小平方 min Σ C_k·(v_k − 原電壓_k)²（例：5 V 的 1 µF 並上 0 V 的 10 µF → 0.455 V）
  const modalFromCaps = (target, t) => {
    if (!R) return [];
    const ss = capSS(t), rhs = caps.map((_, k) => target[k] - ss[k]);
    const N = zeros(R, R), bb = new Float64Array(R);
    for (let k = 0; k < caps.length; k++) { const c = caps[k].C; for (let i = 0; i < R; i++) { bb[i] += c * D[k][i] * rhs[k]; for (let j = 0; j < R; j++) N[i][j] += c * D[k][i] * D[k][j]; } }
    let tr = 0; for (let i = 0; i < R; i++) tr += N[i][i];
    for (let i = 0; i < R; i++) N[i][i] += 1e-24 * (tr || 1);
    return Array.from(cholSolve(cholesky(N), bb));
  };
  const modeW = (x) => { const i = at(x); return i < 0 ? lamS.map(() => 0) : PhiS.map((p) => p[i]); };

  // 直流工作點（週期平均）；瞬間的 GPE 讀回與模式判斷另用 nodeAt。
  const dcOut = (net.dc || []).map((s) => {
    const vt = at(s.pos) === at(s.neg) ? 0 : stats(s.pos, s.neg).mean;
    return { id: s.id, v: vt, i: s.mode === 'CC' ? s.i : s.mode === 'RB' ? 0 : at(s.pos) === at(s.neg) ? Infinity : (s.v - vt) / R_GPE, mode: s.mode };
  });

  return {
    names, periodic, period: T, h, M, lam: lamS, caps: caps.map((c) => c.id), capKeys: caps.map((c) => c.key), capIdx: caps,
    table, nodeAt: nodeAtFast, stats, meanOver, capSS, modalFromCaps, modeW, dcOut, capD: D,
    tauMax: lamS.length ? 1 / Math.min(...lamS) : 0,
  };
}

// 直流電阻（電表 Ω，電路沒通電時）：只看電阻與儀器輸入電阻；電容開路；1 A 注入 hi、從 lo 流出
export function ohmsNet(net, hi, lo) {
  if (hi === lo) return 0.05;
  const names = net.nodes.filter((x) => x !== 'E'), n = names.length, idx = new Map(names.map((x, i) => [x, i]));
  const at = (x) => (x === 'E' || !idx.has(x) ? -1 : idx.get(x));
  const G = zeros(n, n);
  const stamp = (a, b, g) => { const i = at(a), j = at(b); if (i === j) return; if (i >= 0) G[i][i] += g; if (j >= 0) G[j][j] += g; if (i >= 0 && j >= 0) { G[i][j] -= g; G[j][i] -= g; } };
  for (let i = 0; i < n; i++) G[i][i] += 1e-15;
  for (const el of net.elements) if (el.kind === 'R') stamp(el.a, el.b, 1 / el.value);
  for (const L of net.loads || []) stamp(L.a, L.b, 1 / L.r);
  if (!n) return Infinity;
  const I = new Float64Array(n);
  if (at(hi) >= 0) I[at(hi)] += 1;
  if (at(lo) >= 0) I[at(lo)] -= 1;
  const v = refined(G, cholesky(G), I), vol = (x) => (at(x) < 0 ? 0 : v[at(x)]);
  const r = vol(hi) - vol(lo);
  return r > 1e11 ? Infinity : r;
}
