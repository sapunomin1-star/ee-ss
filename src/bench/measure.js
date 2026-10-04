// Passive network measurements. Four-wire uses a 1 A test current and the
// separate sense voltage. Capacitance uses charge conservation at floating
// nodes; it is not the value of the first capacitor found on the board.
const resistors = (net) => [...net.elements.filter((e) => e.kind === 'R').map((e) => ({ ...e, w: 1 / e.value })),
  ...(net.loads ?? []).map((e) => ({ ...e, w: 1 / e.r }))].filter((e) => e.a !== e.b && e.w > 0);
function connected(edges, start) {
  const seen = new Set([start]);
  for (let changed = true; changed;) {
    changed = false;
    for (const e of edges) if (seen.has(e.a) !== seen.has(e.b)) { seen.add(e.a); seen.add(e.b); changed = true; }
  }
  return seen;
}
function solve(A, b) {
  const n = b.length, rows = A.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(rows[i][k]) > Math.abs(rows[p][k])) p = i;
    if (!(Math.abs(rows[p][k]) > 1e-18)) return null;
    [rows[k], rows[p]] = [rows[p], rows[k]];
    for (let i = k + 1; i < n; i++) {
      const f = rows[i][k] / rows[k][k];
      for (let j = k; j <= n; j++) rows[i][j] -= f * rows[k][j];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let v = rows[i][n]; for (let j = i + 1; j < n; j++) v -= rows[i][j] * x[j]; x[i] = v / rows[i][i]; }
  return x;
}
function matrix(edges, names, boundary) {
  const idx = new Map(names.map((n, i) => [n, i])), A = names.map(() => new Float64Array(names.length)), b = new Float64Array(names.length);
  const scale = Math.max(...edges.map((e) => e.w));
  for (const e of edges) for (const [a, other] of [[e.a, e.b], [e.b, e.a]]) {
    const i = idx.get(a), j = idx.get(other), w = e.w / scale;
    if (i === undefined) continue;
    A[i][i] += w;
    if (j !== undefined) A[i][j] -= w; else b[i] += w * (boundary.get(other) ?? 0);
  }
  return { A, b, scale, idx };
}
export function fourWireResistance(net, hi, lo, senseHi, senseLo) {
  if ([hi, lo, senseHi, senseLo].some((n) => n == null)) return null;
  const edges = resistors(net), nodes = connected(edges, hi);
  if (![lo, senseHi, senseLo].every((n) => nodes.has(n))) return null;
  if (hi === lo) return 0;
  const names = [...nodes].filter((n) => n !== lo), relevant = edges.filter((e) => nodes.has(e.a));
  const { A, b, scale, idx } = matrix(relevant, names, new Map([[lo, 0]]));
  b[idx.get(hi)] += 1 / scale;
  const x = solve(A, b);
  if (!x) return null;
  const at = (n) => n === lo ? 0 : x[idx.get(n)];
  return at(senseHi) - at(senseLo);
}
export function equivalentCapacitance(net, hi, lo, voltages = {}) {
  if (hi == null || lo == null) return { value: null, why: '電容量測要接好 HI、LO。' };
  if (hi === lo) return { value: null, why: 'HI、LO 接在同一節點，電容被短路。' };
  const caps = net.elements.filter((e) => e.kind === 'C' && e.a !== e.b).map((e) => ({ ...e, w: e.value }));
  const nodes = connected(caps, hi);
  if (!nodes.has(lo)) return { value: null, why: 'HI、LO 之間沒有可解析的電容網路。' };
  const edges = caps.filter((e) => nodes.has(e.a));
  if (edges.some((e) => Math.abs(voltages[e.stateId ?? e.id] ?? 0) > 1e-3))
    return { value: null, why: '待測電容仍有電荷，請先放電（教學判定低於 1 mV）。' };
  // A resistive component joining two capacitor nodes changes the charging
  // method. This bounded model asks the user to isolate that leakage path.
  const R = resistors(net), visited = new Set();
  for (const node of nodes) if (!visited.has(node)) {
    const component = connected(R, node); component.forEach((n) => visited.add(n));
    if ([...component].filter((n) => nodes.has(n)).length > 1)
      return { value: null, why: '電容網路有並聯電阻或儀器負載；請隔離待測電容、拔除探棒。' };
  }
  const names = [...nodes].filter((n) => n !== hi && n !== lo);
  const { A, b, idx } = matrix(edges, names, new Map([[hi, 1], [lo, 0]])), x = solve(A, b);
  if (!x) return { value: null, why: '電容網路無法解析。' };
  const at = (n) => n === hi ? 1 : n === lo ? 0 : x[idx.get(n)];
  let value = 0;
  for (const e of edges) if (e.a === hi) value += e.w * (1 - at(e.b)); else if (e.b === hi) value += e.w * (1 - at(e.a));
  return { value, why: '' };
}
