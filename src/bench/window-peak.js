// Finite-aperture peaks use actual corners and numerical extrema, never a
// conservative voltage bound as a measured peak. Relative teaching tolerance
// is 0.2 ppm plus 0.1 nV; an unresolved very complex window returns NaN.
export const PEAK_REL_TOL = 2e-7;
export const PEAK_ABS_TOL = 1e-10;
const TAUS = [.125, .25, .5, 1, 2, 4, 8, 16, 32, 64];
const steadyCache = new WeakMap();

function inward(edge, other) {
  const sign = Math.sign(other - edge), span = Math.abs(other - edge);
  const step = Math.max(span * 1e-9, Number.EPSILON * Math.max(1, Math.abs(edge)) * 2);
  return edge + sign * Math.min(span / 8, step);
}
function extremum(value, lo, hi, maximum) {
  const ratio = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, x = b - ratio * (b - a), y = a + ratio * (b - a);
  let vx = value(x), vy = value(y);
  for (let k = 0; k < 48 && b - a > 8 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)); k++) {
    if ((vx < vy) === maximum) { a = x; x = y; vx = vy; y = a + ratio * (b - a); vy = value(y); }
    else { b = y; y = x; vy = vx; x = b - ratio * (b - a); vx = value(x); }
  }
  return (vx > vy) === maximum ? [x, vx] : [y, vy];
}

// Each supplied interval must be a smooth analytic source/limiter piece.
// For RC pieces, exponential boundary layers are resolved separately for every
// mode. Exported for the hybrid solver's actual CV/CC/RB pieces as well.
export function analyticPieceRange(value, a, b, corners = [], rates = []) {
  if (!(b > a)) { const v = value(a); return { min: v, max: v, minAt: a, maxAt: a }; }
  const cuts = new Set([a, b]);
  for (const t of corners) if (t > a && t < b) cuts.add(t);
  const ordered = [...cuts].sort((x, y) => x - y);
  const result = { min: Infinity, max: -Infinity, minAt: a, maxAt: a };
  const put = (t, v = value(t)) => {
    if (!Number.isFinite(v)) { result.min = result.max = NaN; return; }
    if (v < result.min) { result.min = v; result.minAt = t; }
    if (v > result.max) { result.max = v; result.maxAt = t; }
  };
  for (let k = 1; k < ordered.length; k++) {
    const begin = ordered[k - 1], end = ordered[k], fine = new Set([begin, end]);
    for (const rate of rates) if (rate > 0 && rate * (end - begin) > .5)
      for (const z of TAUS) if (begin + z / rate < end) fine.add(begin + z / rate);
    const points = [...fine].sort((x, y) => x - y);
    for (let j = 1; j < points.length; j++) {
      const lo = points[j - 1], hi = points[j], span = hi - lo;
      // A modal extremum can lie just after a tau cut, before the first
      // quarter-point. Endpoint slope samples bracket those extrema too.
      const left = inward(lo, hi), right = inward(hi, lo), inside = (t) => Math.max(left, Math.min(right, t));
      const ts = [...new Set([left, inside(lo + span * 1e-6), inside(lo + span / 4), inside(lo + span / 2),
        inside(lo + 3 * span / 4), inside(hi - span * 1e-6), right])].sort((a, b) => a - b);
      const vs = ts.map(value); ts.forEach((t, i) => put(t, vs[i]));
      if (!Number.isFinite(result.min)) return result;
      for (let i = 1; i + 1 < ts.length; i++) {
        if (vs[i] > vs[i - 1] && vs[i] > vs[i + 1]) { const [t, v] = extremum(value, ts[i - 1], ts[i + 1], true); put(t, v); }
        if (vs[i] < vs[i - 1] && vs[i] < vs[i + 1]) { const [t, v] = extremum(value, ts[i - 1], ts[i + 1], false); put(t, v); }
      }
    }
  }
  return result;
}

function steadyRange(sol, hi, lo) {
  if (!steadyCache.has(sol)) steadyCache.set(sol, new Map());
  const cache = steadyCache.get(sol), key = `${hi}|${lo}`;
  if (!cache.has(key)) cache.set(key, analyticPieceRange((t) => sol.nodeAt(hi, t) - sol.nodeAt(lo, t),
    0, sol.period, sol.mesh ?? sol.driveCuts ?? [], sol.lam ?? []));
  return cache.get(key);
}
const peakOf = (range, center) => Math.max(Math.abs(range.min - center), Math.abs(range.max - center));
function windowCorners(sol, a, b, t0) {
  const T = sol.period, cuts = new Set([a, b]);
  const mesh = sol.mesh ?? sol.driveCuts ?? [0, T];
  for (let cycle = Math.floor(a / T); cycle <= Math.floor(b / T); cycle++) {
    const start = cycle * T;
    for (const phase of mesh) { const t = start + phase; if (t > a && t < b) cuts.add(t); }
  }
  if (t0 > a && t0 < b) cuts.add(t0);
  for (const rate of sol.lam ?? []) if (rate > 0)
    for (const z of TAUS) { const t = t0 + z / rate; if (t > a && t < b) cuts.add(t); }
  return [...cuts].sort((x, y) => x - y);
}

export function nodePairPeakOver(seg, hi, lo, a, b, center = 0, actualValue) {
  if (!(b > a)) return 0;
  const sol = seg.sol;
  if (typeof sol.actualPeakOver === 'function') return sol.actualPeakOver(hi, lo, a, b, center);
  // Unknown nonlinear trajectories must not silently use their steady orbit.
  if (sol.actualNodeAt) return NaN;
  const T = sol.period;
  if (!(T > 0) || !Number.isFinite(T) || !Number.isFinite(center)) return NaN;
  const h = sol.modeW(hi), l = sol.modeW(lo);
  const coefficients = (sol.lam ?? []).map((_, i) => (h[i] - l[i]) * (seg.amp[i] ?? 0));
  const dev = (t) => coefficients.reduce((sum, c, i) => sum + c * Math.exp(-sol.lam[i] * Math.max(0, t - seg.t0)), 0);
  const value = actualValue ?? ((t) => sol.nodeAt(hi, t) - sol.nodeAt(lo, t) + dev(t));
  const exact = (x, y) => peakOf(analyticPieceRange(value, x, y, windowCorners(sol, x, y, seg.t0), sol.lam), center);
  if (b - a <= 2 * T) return exact(a, b);
  const steady = steadyRange(sol, hi, lo);
  if (!Number.isFinite(steady.min)) return NaN;
  if (coefficients.every((c) => c === 0)) return peakOf(steady, center);
  if (steady.max === steady.min) {
    const cuts = [seg.t0];
    for (const rate of sol.lam) if (rate > 0)
      for (const z of TAUS) cuts.push(seg.t0 + z / rate);
    return peakOf(analyticPieceRange(value, a, b, cuts, sol.lam), center);
  }
  let best = Math.max(exact(a, Math.min(b, a + T)), exact(Math.max(a, b - T), b));
  if (!Number.isFinite(best)) return NaN;
  const atPhase = (phase, x, y, target) => {
    const cycle = Math.floor((target - phase) / T);
    for (const n of [cycle, cycle + 1]) {
      const t = n * T + phase;
      if (t >= x && t < y) best = Math.max(best, Math.abs(value(t) - center));
    }
  };
  const candidate = (x, y) => {
    let lower = 0, upper = 0;
    for (let i = 0; i < coefficients.length; i++) {
      const v = coefficients[i] * Math.exp(-sol.lam[i] * Math.max(0, x - seg.t0));
      const w = coefficients[i] * Math.exp(-sol.lam[i] * Math.max(0, y - seg.t0));
      lower += Math.min(v, w); upper += Math.max(v, w);
    }
    // Two RC modes have at most one interior transient extremum. Its exact
    // exponential derivative avoids millions of tiny carrier intervals near
    // a slowly changing envelope peak.
    const modes = coefficients.map((c, i) => ({ c, rate: sol.lam[i] })).filter((m) => m.c !== 0);
    if (modes.length <= 2) {
      const values = [dev(x), dev(y)];
      if (modes.length === 2) {
        const [p, q] = modes, ratio = -p.c * p.rate / (q.c * q.rate);
        if (ratio > 0 && p.rate !== q.rate) {
          const t = seg.t0 + Math.log(ratio) / (p.rate - q.rate);
          if (t > Math.max(x, seg.t0) && t < y) values.push(dev(t));
        }
      }
      lower = Math.min(...values); upper = Math.max(...values);
    }
    for (const target of [x, (x + y) / 2, y]) {
      atPhase(steady.minAt, x, y, target); atPhase(steady.maxAt, x, y, target);
    }
    return { x, y, bound: Math.max(Math.abs(steady.min + lower - center), Math.abs(steady.max + upper - center)) };
  };
  const pending = [candidate(a + T, b - T)];
  // The transient bounds only prune impossible maxima. The reported peak is
  // always a value on the actual waveform; unresolved work is unavailable.
  for (let work = 0; pending.length && work < 1024; work++) {
    pending.sort((x, y) => x.bound - y.bound);
    const next = pending.pop(), tolerance = PEAK_ABS_TOL + PEAK_REL_TOL * Math.max(1e-3, best);
    if (next.bound <= best + tolerance) continue;
    if (next.y - next.x <= T) { best = Math.max(best, exact(next.x, next.y)); continue; }
    const mid = (next.x + next.y) / 2;
    if (!(mid > next.x && mid < next.y)) return NaN;
    pending.push(candidate(next.x, mid), candidate(mid, next.y));
  }
  return pending.some((p) => p.bound > best + PEAK_ABS_TOL + PEAK_REL_TOL * Math.max(1e-3, best)) ? NaN : best;
}
