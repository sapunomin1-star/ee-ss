// Hybrid RC protection. Inside each AFG linear segment the RC flow is analytic;
// protection crossings are bracketed and bisected, retaining capacitor charge.
// Sine inputs use the same 4000 linear pieces as solveNet. Long transients use
// checked step-doubling of the period map, with a 2 nV capacitor error target.
import { solveNet, R_GPE, M } from './net.js';

const TOL = 2e-9;
const GL8 = [[.1834346424956498, .362683783378362], [.525532409916329, .3137066458778873],
  [.7966664774136267, .2223810344533745], [.9602898564975363, .1012285362903763]].flatMap(([x, w]) => [[-x, w], [x, w]]);
const identity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => +(i === j)));
const mul = (A, B) => A.map((row) => B[0]?.map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0)) || []);
const mv = (A, v) => A.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
const distance = (a, b) => Math.max(0, ...a.map((v, k) => Math.abs(v - b[k])));
function linearSolve(A, b) {
  const n = b.length, a = A.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (Math.abs(a[p][k]) < 1e-20) return null;
    [a[p], a[k]] = [a[k], a[p]];
    for (let i = k + 1; i < n; i++) { const q = a[i][k] / a[k][k]; for (let j = k; j <= n; j++) a[i][j] -= q * a[k][j]; }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) x[i] = (a[i][n] - a[i].slice(i + 1, n).reduce((s, v, j) => s + v * x[i + 1 + j], 0)) / a[i][i];
  return x.every(Number.isFinite) ? x : null;
}

export function hybridSeg(seg, now) {
  const built = seg.built, channels = built.gpe, variants = new Map();
  const variant = (modes) => {
    const key = modes.join('|');
    if (!variants.has(key)) variants.set(key, solveNet({ ...built.net,
      dc: channels.map((c, k) => ({ id: c.id, pos: c.pos, neg: c.neg, v: c.v, i: c.ilim, mode: modes[k] })) }, { retainFastModes: true }));
    return variants.get(key);
  };
  const base = variant(channels.map(() => 'CV')), T = base.period, cuts = base.driveCuts;
  const timeLocation = (t) => { const cycle = Math.floor(t / T); return { cycle, phase: Math.min(T, Math.max(0, t - cycle * T)) }; };
  const phase = (t) => timeLocation(t).phase;
  const point = (step, modes, k, dt) => {
    const c = channels[k], v = step.nodeAt(c.pos, dt) - step.nodeAt(c.neg, dt);
    return { v, i: c.pos === c.neg ? (modes[k] === 'CV' ? Infinity : modes[k] === 'CC' ? c.ilim : 0)
      : modes[k] === 'CC' ? c.ilim : modes[k] === 'RB' ? 0 : (c.v - v) / R_GPE };
  };
  const guard = (step, modes, k, dt) => {
    const c = channels[k], p = point(step, modes, k, dt), m = modes[k];
    // All three boundaries have equal currents on both sides (continuous flow).
    if (m === 'CV') return [p.i - c.ilim, -p.i];
    return [m === 'CC' ? p.v - (c.v - c.ilim * R_GPE) : c.v - p.v];
  };
  const guardValue = (step, modes, k, dt, side) => {
    const c = channels[k], v = step.nodeAt(c.pos, dt) - step.nodeAt(c.neg, dt), mode = modes[k];
    if (mode === 'CV') { const i = c.pos === c.neg ? Infinity : (c.v - v) / R_GPE; return side ? -i : i - c.ilim; }
    return mode === 'CC' ? v - c.v + c.ilim * R_GPE : c.v - v;
  };
  const next = (step, modes, k, dt, side = null) => {
    const g = guard(step, modes, k, dt), c = channels[k], eps = modes[k] === 'CV' ? 1e-8 * Math.max(.001, c.ilim) : 1e-9;
    if (side == null && Math.max(...g) <= eps) return modes[k];
    return modes[k] === 'CV' ? ((side ?? (g[1] > g[0] ? 1 : 0)) === 1 ? 'RB' : 'CC') : 'CV';
  };
  let unsupported = false;
  const select = (caps, a, b, hint) => {
    const candidate = (modes) => ({ modes, step: variant(modes).linearStep(caps, a, b) });
    const legal = ({ step, modes }) => modes.every((m, k) => next(step, modes, k, 0) === m);
    let modes = [...hint], s; const seen = new Set();
    for (let i = 0; i < 16; i++) {
      const key = modes.join('|'); if (seen.has(key)) break; seen.add(key);
      s = candidate(modes); if (legal(s)) return s;
      modes = modes.map((m, k) => next(s.step, modes, k, 0));
    }
    for (let code = 0; code < 3 ** channels.length; code++) {
      let v = code; const modes = channels.map(() => { const m = ['CV', 'CC', 'RB'][v % 3]; v = Math.floor(v / 3); return m; });
      s = candidate(modes); if (legal(s)) return s;
    }
    unsupported = true; return s;
  };
  const event = (step, modes, duration) => {
    // Exponential scale cuts catch protection pulses much shorter than an AFG
    // sample. Include every mode, rather than just the fastest time constant.
    const samples = new Set([0, duration]);
    if (step.lam.length !== 1) {
      for (let j = 1; j < 9; j++) samples.add(duration * j / 9);
      for (const l of step.lam) if (l > 0) for (const q of [.125, .25, .5, 1, 2, 4, 8, 16, 32, 64]) if (q / l < duration) samples.add(q / l);
    } else {
      // One exponential plus a linear input has at most one derivative root.
      // Include it exactly, rather than allocate nine redundant tiny-cell probes.
      for (const c of channels) {
        const derivative = (t) => step.nodeDerivative(c.pos, t) - step.nodeDerivative(c.neg, t);
        const left = derivative(0), right = derivative(duration);
        if (left * right < 0) {
          let lo = 0, hi = duration;
          for (let r = 0; r < 40; r++) { const mid = (lo + hi) / 2; if (derivative(mid) * left > 0) lo = mid; else hi = mid; }
          samples.add((lo + hi) / 2);
        }
      }
    }
    const ts = [...samples].sort((a, b) => a - b); let best = null;
    channels.forEach((c, k) => {
      const count = modes[k] === 'CV' ? 2 : 1, eps = modes[k] === 'CV' ? 1e-8 * Math.max(.001, c.ilim) : 1e-9;
      for (let side = 0; side < count; side++) {
        let a = 0;
        for (let j = 1; j < ts.length; j++) {
          const b = ts[j], value = guardValue(step, modes, k, b, side);
          if (value > eps) {
            let lo = a, hi = b;
            for (let r = 0; r < 48; r++) { const mid = (lo + hi) / 2; if (guardValue(step, modes, k, mid, side) > 0) hi = mid; else lo = mid; }
            if (!best || hi < best.dt) best = { dt: hi, k, side };
            break;
          }
          a = b;
        }
      }
    });
    return best;
  };
  const run = (initial, start = 0, end = T, hint = channels.map(() => 'CV')) => {
    let caps = [...initial], modes = [...hint]; const pieces = [];
    for (let j = 1; j < cuts.length; j++) {
      let a = Math.max(start, cuts[j - 1]); const b = Math.min(end, cuts[j]); if (!(b > a)) continue;
      let count = 0;
      while (a < b) {
        const s = select(caps, a, b, modes); modes = s.modes;
        const nx = event(s.step, modes, b - a), dt = nx ? nx.dt : b - a;
        if (++count > 128) { unsupported = true; break; }
        // A state may be one rounding tick past a guard while still legal
        // within select's tolerance. Resolve its zero-time mode change instead
        // of dropping the rest of this source cell and freezing the capacitor.
        if (!(dt > T * 1e-15)) {
          if (!nx) { unsupported = true; break; }
          modes = [...modes]; modes[nx.k] = next(s.step, modes, nx.k, 0, nx.side); continue;
        }
        pieces.push({ from: a, to: a + dt, step: s.step, modes: [...modes] });
        caps = s.step.capAt(dt); a += dt;
        if (nx) { modes = [...modes]; modes[nx.k] = next(s.step, modes, nx.k, dt, nx.side); }
      }
    }
    const signature = pieces.reduce((out, p) => { const key = p.modes.join('|'); if (out.at(-1) !== key) out.push(key); return out; }, []).join('>');
    return { pieces, caps, start, end, initial: [...initial], signature };
  };
  const locate = (record, t) => {
    if (record.flow) return { modes: record.modes, from: 0, to: T };
    let lo = 0, hi = record.pieces.length;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (record.pieces[mid].from <= t) lo = mid; else hi = mid; }
    return record.pieces[lo];
  };
  const nodeIn = (record, node, t) => { if (record.flow) return record.flow.nodeAt(node, t); const p = locate(record, t); return p ? p.step.nodeAt(node, Math.max(0, Math.min(p.to, t) - p.from)) : 0; };
  const integral = (record, hi, lo, a = record.start, b = record.end) => {
    if (record.flow) return record.flow.nodeIntegral(hi, b) - record.flow.nodeIntegral(hi, a) - record.flow.nodeIntegral(lo, b) + record.flow.nodeIntegral(lo, a);
    let value = 0;
    for (const p of record.pieces) {
      const x = Math.max(a, p.from), y = Math.min(b, p.to); if (!(y > x)) continue;
      value += p.step.nodeIntegralBetween(hi, x - p.from, y - p.from) - p.step.nodeIntegralBetween(lo, x - p.from, y - p.from);
    }
    return value;
  };
  const coordinateMatrix = base.capD.map((r) => [...r]);
  const projectMatrix = (A) => A[0]?.map((_, j) => base.capProject(A.map((r) => r[j]))) || [];
  const jacobian = (record) => {
    if (record.J) return record.J;
    let J = record.flow ? record.flow.capTransition : identity(base.caps.length);
    if (!record.flow) for (const p of record.pieces) J = mul(p.step.capTransition(p.to - p.from), J);
    const cols = projectMatrix(mul(J, coordinateMatrix));
    record.J = base.lam.map((_, i) => cols.map((c) => c[i])); return record.J;
  };
  const integralSlope = (record, hi, lo) => {
    if (record.flow) {
      const h = record.flow.integralGradient(hi), l = record.flow.integralGradient(lo);
      const row = record.flow.projectColumns.map((col) => col.reduce((s, x, m) => s + x * (h[m] - l[m]), 0));
      return base.lam.map((_, j) => row.reduce((s, x, k) => s + x * coordinateMatrix[k][j], 0));
    }
    let H = coordinateMatrix.map((r) => [...r]), q = base.lam.map(() => 0);
    for (const p of record.pieces) {
      const dt = p.to - p.from, h = p.step.integralGradient(hi, dt), l = p.step.integralGradient(lo, dt);
      const row = p.step.projectColumns.map((col) => col.reduce((s, x, m) => s + x * (h[m] - l[m]), 0));
      q = q.map((v, j) => v + row.reduce((s, x, k) => s + x * H[k][j], 0));
      H = mul(p.step.capTransition(dt), H);
    }
    return q;
  };
  const affineAdvance = (caps, record, count, pair = null) => {
    const x = base.capProject(caps), y = base.capProject(record.caps), J = jacobian(record), r = x.length;
    const A = identity(r + 2);
    for (let i = 0; i < r; i++) { for (let j = 0; j < r; j++) A[i][j] = J[i][j]; A[i][r + 1] = y[i] - x[i]; }
    if (pair) { const q = integralSlope(record, ...pair); for (let j = 0; j < r; j++) A[r][j] = q[j]; A[r][r + 1] = integral(record, ...pair); }
    let power = A, out = [...Array(r + 1).fill(0), 1], n = count;
    while (n > 0) { if (n % 2) out = mv(power, out); n = Math.floor(n / 2); if (n) power = mul(power, power); }
    return { caps: base.capsFromCoordinates(x.map((v, i) => v + out[i])), integral: out[r] };
  };
  const flowMap = (caps) => {
    // Proven guard margin for a single grounded capacitor: |v'| is bounded by
    // the maximum AFG/GPE current plus passive leakage. If the entire period
    // fits inside one regulator region, use solveNet's exact whole-period map
    // instead of constructing 4000 equivalent pieces during long startup.
    if (base.names.length === 1 && base.caps.length === 1 && channels.every((c) => c.pos === base.names[0] && c.neg === 'E')) {
      const v = caps[0] * (base.capIdx[0].a >= 0 ? 1 : -1), C = base.capIdx[0].C;
      let g = 1e-12 + built.net.afg.length / 50;
      for (const e of built.net.elements) if (e.kind === 'R' && e.a !== e.b) g += 1 / e.value;
      for (const load of built.net.loads || []) g += 1 / load.r;
      const current = built.net.afg.reduce((s, { p }) => s + (Math.abs(p.emfOffset) + p.emfVpp / 2) / 50, 0) + channels.reduce((s, c) => s + c.ilim, 0);
      const change = (current + g * Math.abs(v)) * T / C * Math.exp(g * T / C);
      const modes = channels.map((c) => v + change < c.v - c.ilim * R_GPE ? 'CC' : v - change > c.v ? 'RB'
        : v - change > c.v - c.ilim * R_GPE && v + change < c.v ? 'CV' : null);
      if (modes.every(Boolean)) {
        const flow = variant(modes).periodFlow(caps);
        return { caps: flow.caps, initial: [...caps], flow, modes, start: 0, end: T, signature: modes.join('|') };
      }
    }
    return run(caps);
  };

  // Shooting in the independent capacitor coordinates. The protection vector
  // fields agree at each crossing, so the flow Jacobian needs no saltation jump.
  let ssCaps = [...seg.initial.capInitial], steady = null, converged = false;
  for (let it = 0; it < 30; it++) {
    const record = run(ssCaps), error = distance(record.caps, ssCaps);
    steady = record;
    if (error < 1e-11) { converged = true; break; }
    const x = base.capProject(ssCaps), y = base.capProject(record.caps), J = jacobian(record);
    const delta = linearSolve(J.map((row, i) => row.map((v, j) => +(i === j) - v)), y.map((v, i) => v - x[i]));
    let chosen = record.caps;
    if (delta) for (const factor of [1, .5, .25, .125]) {
      const trial = base.capsFromCoordinates(x.map((v, i) => v + factor * delta[i]));
      if (trial.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e5)) continue;
      const nextRecord = run(trial);
      if (distance(nextRecord.caps, trial) < error) { chosen = trial; break; }
    }
    ssCaps = chosen;
  }
  if (!converged) unsupported = true;
  steady = run(ssCaps);
  const t0 = seg.t0, firstPhase = phase(t0), firstCycle = timeLocation(t0).cycle + 1, boundary = firstCycle * T;
  const first = run(seg.initial.capInitial, firstPhase, T, seg.modes);
  const checkpoints = new Map([[0, first.caps]]), records = new Map(), flows = new Map(); let settledAt = null;
  const saveFlow = (origin, count, caps, record) => {
    if (origin == null) return;
    const x = base.capProject(caps), end = base.capProject(record.caps);
    flows.set(`${origin}:${count}`, { origin, count, x, J: jacobian(record), delta: end.map((v, i) => v - x[i]) });
    if (flows.size > 64) flows.delete(flows.keys().next().value);
  };
  const cachedFlow = (cycleNumber) => {
    for (const flow of [...flows.values()].reverse()) if (flow.origin <= cycleNumber && flow.origin + flow.count >= cycleNumber) {
      const r = flow.x.length, A = identity(r + 1);
      for (let i = 0; i < r; i++) { for (let j = 0; j < r; j++) A[i][j] = flow.J[i][j]; A[i][r] = flow.delta[i]; }
      let power = A, out = [...Array(r).fill(0), 1], n = cycleNumber - flow.origin;
      while (n > 0) { if (n % 2) out = mv(power, out); n = Math.floor(n / 2); if (n) power = mul(power, power); }
      return base.capsFromCoordinates(flow.x.map((v, i) => v + out[i]));
    }
    return null;
  };
  const cycle = (n, caps) => {
    if (!records.has(n)) { records.set(n, flowMap(caps)); if (records.size > 12) records.delete(records.keys().next().value); }
    return records.get(n);
  };
  const fixedGuards = (caps, record, count) => {
    if (record.signature.includes('>')) return false;
    const modes = record.signature.split('|'), sol = variant(modes), initial = sol.initialStateFromCaps(caps, 0), duration = count * T;
    return channels.every((c, k) => {
      const v0 = initial.nodeAt(c.pos) - initial.nodeAt(c.neg), wave = 2 * sol.acBound(c.pos, c.neg);
      let low = v0 - wave, high = v0 + wave;
      const positive = sol.modeW(c.pos), negative = sol.modeW(c.neg);
      sol.lam.forEach((lambda, m) => {
        const change = (positive[m] - negative[m]) * initial.amp[m] * Math.expm1(-lambda * duration);
        low += Math.min(0, change); high += Math.max(0, change);
      });
      const limit = c.v - c.ilim * R_GPE;
      return modes[k] === 'CC' ? high <= limit : modes[k] === 'RB' ? low >= c.v : low >= limit && high <= c.v;
    });
  };
  const block = (caps, count, pair = null, origin = null) => {
    if (distance(caps, ssCaps) < TOL) {
      if (origin != null) settledAt = settledAt == null ? origin : Math.min(settledAt, origin);
      return { caps: ssCaps, integral: pair ? count * integral(steady, ...pair) : 0 };
    }
    const a = flowMap(caps);
    if (count === 1) { saveFlow(origin, count, caps, a); return { caps: a.caps, integral: pair ? integral(a, ...pair) : 0 }; }
    // A fixed-mode block is accepted only with a whole-interval proof. Each
    // decay mode contributes its own endpoint range; cancellation at the two
    // block endpoints cannot hide an intermediate multi-capacitor RB pulse.
    if (fixedGuards(caps, a, count)) { saveFlow(origin, count, caps, a); return affineAdvance(caps, a, count, pair); }
    const full = affineAdvance(caps, a, count, pair), n = Math.floor(count / 2);
    const half = affineAdvance(caps, a, n, pair), b = flowMap(half.caps), rest = affineAdvance(half.caps, b, count - n, pair);
    const sum = half.integral + rest.integral;
    const voltageError = distance(full.caps, rest.caps), intError = pair ? Math.abs(full.integral - sum) / (count * T) : 0;
    // Full/half extrapolations may both start below the CC boundary and agree
    // while their future endpoint crosses it. Verify the endpoint's protection
    // itinerary before accepting a block, as well as its state/integral error.
    const endpoint = voltageError <= TOL && intError <= TOL ? flowMap(rest.caps) : null;
    const guardsAgree = endpoint && endpoint.signature === a.signature && endpoint.signature === b.signature;
    // In one dynamic dimension the passive limiter period map preserves order;
    // intermediate cycle states lie between the checked endpoints. Multiple
    // dynamic dimensions require the proven fixed-mode bound above or recurse.
    if (base.lam.length === 1 && guardsAgree && voltageError <= TOL && intError <= TOL) {
      saveFlow(origin, n, caps, a); saveFlow(origin == null ? null : origin + n, count - n, half.caps, b);
      return { caps: rest.caps, integral: sum };
    }
    const left = block(caps, n, pair, origin), right = block(left.caps, count - n, pair, origin == null ? null : origin + n);
    return { caps: right.caps, integral: left.integral + right.integral };
  };
  const capsAtCycle = (n) => {
    if (settledAt != null && n >= settledAt) return ssCaps;
    if (checkpoints.has(n)) return checkpoints.get(n);
    const known = cachedFlow(n); if (known) return known;
    let start = 0; for (const k of checkpoints.keys()) if (k <= n && k > start) start = k;
    let caps = checkpoints.get(start);
    while (start < n) {
      if (distance(caps, ssCaps) < TOL) { settledAt = start; return ssCaps; }
      const count = Math.min(n - start, start < 4 ? 1 : 1000000);
      const result = count === 1 ? cycle(start, caps) : block(caps, count, null, start);
      caps = result.caps; start += count;
      checkpoints.set(start, caps);
      if (checkpoints.size > 64) { const key = [...checkpoints.keys()].find((k) => k !== 0 && k !== start); checkpoints.delete(key); }
    }
    return caps;
  };
  const actualRecord = (t) => {
    if (t < boundary) return { record: first, at: Math.min(T, Math.max(firstPhase, firstPhase + t - t0)) };
    const location = timeLocation(t), n = Math.max(0, location.cycle - firstCycle), caps = capsAtCycle(n);
    return { record: settledAt != null && n >= settledAt ? steady : cycle(n, caps), at: location.phase };
  };
  const actualNodeAt = (node, t) => {
    // If the bench is first initialized with both outputs already enabled,
    // there is no earlier circuit record. Treat that unknown prehistory as OFF;
    // subsequent changes are served by Bench's actual preceding segments.
    if (t < t0) return 0;
    const { record, at } = actualRecord(t); return nodeIn(record, node, at);
  };
  const actualMeanOver = (hi, lo, a, b) => {
    if (!(b > a)) return actualNodeAt(hi, a) - actualNodeAt(lo, a);
    // For windows only a few representable absolute-time ticks wide, subtracting
    // two wrapped phases loses their relative duration. Integrate the absolute
    // callback directly; GL8 resolves the local continuous capacitor response.
    if (b - a < 128 * Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b))) {
      const half = (b - a) / 2;
      return GL8.reduce((sum, [u, w]) => { const t = a + (u + 1) * half; return sum + w * (actualNodeAt(hi, t) - actualNodeAt(lo, t)) / 2; }, 0);
    }
    let sum = 0, cursor = a;
    if (cursor < t0) {
      cursor = Math.min(b, t0);
    }
    if (cursor < boundary) {
      const end = Math.min(b, boundary); sum += integral(first, hi, lo, firstPhase + cursor - t0, firstPhase + end - t0); cursor = end;
    }
    if (cursor < b) {
      const location = timeLocation(cursor);
      let n = Math.max(0, location.cycle - firstCycle), p = location.phase;
      if (p > T * 1e-10) {
        const end = Math.min(b, boundary + (n + 1) * T), record = actualRecord(cursor).record;
        sum += integral(record, hi, lo, p, p + end - cursor); cursor = end; n++;
      }
      const count = Math.max(0, Math.floor((b - cursor) / T + 1e-10));
      if (count) {
        const caps = capsAtCycle(n);
        if (settledAt != null && n >= settledAt) sum += count * integral(steady, hi, lo);
        else sum += block(caps, count, [hi, lo], n).integral;
        cursor += count * T; n += count;
      }
      if (cursor < b) sum += integral(actualRecord(cursor).record, hi, lo, 0, b - cursor);
    }
    return sum / (b - a);
  };
  const nodeAt = (node, t) => nodeIn(steady, node, phase(t));
  const pairs = new Map(), tables = new Map();
  const stats = (hi, lo) => {
    const key = `${hi}|${lo}`; if (pairs.has(key)) return pairs.get(key);
    const mean = integral(steady, hi, lo) / T; let square = 0, peak = 0, peakAc = 0;
    for (const p of steady.pieces) {
      const dt = p.to - p.from, split = new Set([0, dt]);
      for (const l of p.step.lam) if (l > 0) for (const q of [.125, .25, .5, 1, 2, 4, 8, 16, 32, 64]) if (q / l < dt) split.add(q / l);
      const xs = [...split].sort((a, b) => a - b), value = (s) => p.step.nodeAt(hi, s) - p.step.nodeAt(lo, s);
      for (const s of xs) { const v = value(s); peak = Math.max(peak, Math.abs(v)); peakAc = Math.max(peakAc, Math.abs(v - mean)); }
      for (let j = 1; j < xs.length; j++) {
        const half = (xs[j] - xs[j - 1]) / 2;
        for (const [u, w] of GL8) { const v = value(xs[j - 1] + (u + 1) * half) - mean; square += w * half * v * v; }
      }
    }
    const result = { mean, acRms: Math.sqrt(square / T), peak, peakAc }; pairs.set(key, result); return result;
  };
  const meanOver = (hi, lo, a, b) => {
    if (!(b > a)) return stats(hi, lo).mean;
    const na = Math.floor(a / T), nb = Math.floor(b / T), pa = phase(a), pb = phase(b);
    if (na === nb) return integral(steady, hi, lo, pa, pb) / (b - a);
    return (integral(steady, hi, lo, pa, T) + (nb - na - 1) * integral(steady, hi, lo) + integral(steady, hi, lo, 0, pb)) / (b - a);
  };
  const table = (node) => { if (!tables.has(node)) tables.set(node, Float64Array.from({ length: M }, (_, k) => nodeAt(node, k * T / M))); return tables.get(node); };
  const warn = [...built.warn];
  const failure = { level: 'bad', text: '目前不支援此混合電源接法：週期保護求解未收斂或事件過密，波形及保護讀回無效。' };
  channels.forEach((c, k) => { if (steady.pieces.some((p) => p.modes[k] === 'RB')) warn.push({ level: 'bad', text: `GPE CH${c.ch} 在 AFG 週期中被其他電源灌入：電源不能吸收電流，逆灌時輸出開路（RB）。` }); });
  const modeAt = (t) => { const { record, at } = actualRecord(Math.max(t0, t)); return locate(record, at)?.modes || seg.modes; };
  const capSS = (t) => base.capIdx.map((c) => nodeAt(base.names[c.a], t) - nodeAt(base.names[c.b], t));
  const capActual = (t) => base.capIdx.map((c) => actualNodeAt(base.names[c.a], t) - actualNodeAt(base.names[c.b], t));
  const actualRange = (node, a, b) => {
    // For a grounded parallel capacitor, scalar comparison gives a rigorous
    // envelope even across millions of cycles: hold every AFG at its minimum
    // or maximum EMF, and integrate the same monotone limiter law. This lets
    // trigger search exclude early startup intervals without sampling pulses.
    const scalarNode = base.names.length === 1 ? base.names[0] : null;
    if (node === scalarNode && channels.every((c) => c.pos === node && c.neg === 'E')) {
      const capacitance = built.net.elements.filter((e) => e.kind === 'C' && e.a !== e.b).reduce((s, e) => s + e.value, 0);
      if (capacitance > 0) {
        let conductance = 1e-12 + built.net.afg.length / 50;
        for (const e of built.net.elements) if (e.kind === 'R' && e.a !== e.b) conductance += 1 / e.value;
        for (const load of built.net.loads || []) conductance += 1 / load.r;
        const input = (side) => built.net.afg.reduce((s, { p }) => s + (p.emfOffset + side * p.emfVpp / 2) / 50, 0);
        const start = actualNodeAt(node, Math.max(t0, a)), dt = Math.max(0, b - Math.max(t0, a));
        const evolve = (injection) => {
          let v = start, remaining = dt;
          for (let it = 0; it < 2 * channels.length + 2 && remaining > 0; it++) {
            const current = injection - conductance * v + channels.reduce((s, c) => s + Math.max(0, Math.min(c.ilim, (c.v - v) / R_GPE)), 0);
            if (current === 0) break;
            const direction = Math.sign(current); let g = conductance, i = injection;
            for (const c of channels) {
              const low = c.v - c.ilim * R_GPE;
              if (v < low || (v === low && direction < 0)) i += c.ilim;
              else if (v < c.v || (v === c.v && direction < 0)) { i += c.v / R_GPE; g += 1 / R_GPE; }
            }
            const target = i / g, lambda = g / capacitance;
            const boundaries = channels.flatMap((c) => [c.v - c.ilim * R_GPE, c.v]).filter((x) => direction * (x - v) > 0 && direction * (target - x) > 0);
            const next = boundaries.sort((x, y) => direction * (x - y))[0];
            const crossing = next == null ? Infinity : -Math.log1p((next - v) / (v - target)) / lambda;
            if (!(crossing > 0) || crossing >= remaining) { v += (target - v) * -Math.expm1(-lambda * remaining); break; }
            v = next; remaining -= crossing;
          }
          return v;
        };
        return [Math.min(a < t0 ? 0 : start, evolve(input(-1))) - TOL, Math.max(start, evolve(input(1))) + TOL];
      }
    }
    const bound = Math.max(1, ...built.net.afg.map(({ p }) => Math.abs(p.emfOffset) + p.emfVpp), ...channels.map((c) => c.v + c.ilim * R_GPE), ...seg.initial.capInitial.map(Math.abs));
    // A conservative passive-RC/source bound also covers the startup before the
    // repeating orbit. It deliberately does not assume one global decay mode.
    return [-4 * base.names.length * bound, 4 * base.names.length * bound];
  };
  const sol = { ...base, get warn() { return unsupported ? [...warn, failure] : warn; }, nodeAt, table, stats, meanOver, capSS, actualNodeAt, actualMeanOver, capActual, actualRange,
    nodeChange: (node, t, origin) => nodeAt(node, t) - nodeAt(node, origin),
    meanChangeOver: (hi, lo, a, b, origin) => meanOver(hi, lo, a, b) - nodeAt(hi, origin) + nodeAt(lo, origin),
    hybrid: { get converged() { return converged && !unsupported; }, voltageTolerance: TOL, pieces: steady.pieces.length, get checkpoints() { return checkpoints.size; } } };
  return { ...seg, sol, modeAt, amp: [], initial: null, periodicIndices: channels.map((_, k) => k), get modes() { return modeAt(now()); } };
}
