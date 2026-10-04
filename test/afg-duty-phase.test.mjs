import test from 'node:test';
import assert from 'node:assert/strict';
import { AfgModel } from '../src/instruments/afg/model.js';
import { emf, solve, nodeAt, diffStats } from '../src/bench/circuit.js';
import { solveNet } from '../src/bench/net.js';
import { Bench, DEMO } from '../src/bench/bench.js';
import { TdsModel } from '../src/instruments/tds/model.js';

const near = (actual, expected, tol = 1e-9, label = '') => assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} vs ${expected}`);
const keys = { WAVE: 'WAVEFORM', FREQ: 'FREQ_RATE', CH: 'CH1_CH2', LEFT: 'ARROW_LEFT', RIGHT: 'ARROW_RIGHT', RETURN: 'RETURN', OUT: 'OUTPUT' };
function run(m, sequence) {
  let last = null;
  for (const word of sequence.split(' ')) {
    if (/^-?[\d.]+$/.test(word)) {
      for (const c of word) last = m.press(`AFG.NUM.${c === '.' ? 'DOT' : c === '-' ? 'PLUS_MINUS' : `DIGIT_${c}`}`);
    } else last = m.press(word.startsWith('F') && /^F\d$/.test(word) ? `AFG.SOFT.${word}` : `AFG.KEY.${keys[word] || word}`);
  }
  return last;
}
const signal = (patch = {}) => ({ wave: 'SINE', freq: 1000, sym: 50, duty: 50, phase: 0, emfVpp: 4, emfOffset: 0, output: true, ...patch });

test('Square Duty: input, visible knob precision, frequency limits, channel independence', () => {
  const m = new AfgModel();
  run(m, 'WAVE F2 F1 1.1 F2');
  assert.equal(m.c.duty, 1.1); assert.equal(m.descriptor(0).duty, 1.1);
  assert.match(m.lcd(), /Duty:/); assert.match(m.lcd(), />1.1</);
  run(m, 'RIGHT'); assert.equal(m.cexp, -1);
  m.turn('AFG.KNOB.SCROLL_WHEEL', -1); assert.equal(m.c.duty, 1);
  assert.equal(m.turn('AFG.KNOB.SCROLL_WHEEL', -1).kind, 'reject');
  run(m, 'FREQ 100 F4'); assert.equal(m.c.freq, 100e3);
  assert.equal(run(m, '100.1 F4').kind, 'reject'); assert.equal(m.c.freq, 100e3);
  run(m, 'WAVE F2 F1 10 F2 FREQ 1 F5'); assert.equal(m.c.freq, 1e6);
  assert.equal(run(m, '1.000001 F5').kind, 'reject');
  run(m, 'WAVE F2 F1 50 F2 FREQ 2 F5'); assert.equal(m.c.freq, 2e6);
  assert.equal(run(m, 'WAVE F2 F1 50.1 F2').kind, 'reject');
  run(m, 'CH WAVE F2 F1 25 F2'); assert.equal(m.c.duty, 25);
  run(m, 'CH'); assert.equal(m.c.duty, 50); assert.equal(m.c.freq, 2e6);
});

test('Sine/Ramp Phase: signed input, knob, bounds, LCD/descriptor, Square restriction', () => {
  const m = new AfgModel();
  run(m, 'CH CH F4 F1 -33.7 F5'); assert.equal(m.c.phase, -33.7);
  near(m.descriptor(0).phase, -33.7); assert.match(m.lcd(), />-33.7</);
  run(m, 'RIGHT'); m.turn('AFG.KNOB.SCROLL_WHEEL', 1); near(m.c.phase, -33.6);
  assert.equal(run(m, '180.1 F5').kind, 'reject'); near(m.c.phase, -33.6);
  run(m, '-180 F5'); assert.equal(m.c.phase, -180);
  assert.equal(m.turn('AFG.KNOB.SCROLL_WHEEL', -1).kind, 'reject');
  run(m, 'WAVE F4'); assert.equal(m.c.phase, -180);
  run(m, 'CH CH F4 F1 45 F5 RETURN'); assert.equal(m.menu, 'CH');
  run(m, 'WAVE F2'); assert.equal(m.c.phase, 0); assert.equal(m.descriptor(0).phase, 0);
  assert.equal(run(m, 'CH CH F4').kind, 'reject'); assert.equal(m.c.phase, 0);
  run(m, 'PRESET'); assert.ok(m.ch.every((c) => c.duty === 50 && c.phase === 0));
});

test('EMF keeps old defaults and gives positive phase a real advance', () => {
  near(emf(signal({ phase: 90 }), 0), 2);
  near(emf(signal({ phase: -90 }), 0), -2);
  const old = signal(); delete old.phase; delete old.duty;
  near(emf(old, 0.00025), 2);
  near(emf({ ...old, wave: 'SQUARE' }, 0.00025), 2);
  const short = signal({ wave: 'SQUARE', duty: 1 });
  near(emf(short, 0.000009999), 2); near(emf(short, 0.00001), -2);
});

test('1% bipolar Duty: mean, AC RMS, window integral and samples have actual numeric values', () => {
  const p = signal({ wave: 'SQUARE', duty: 1, emfOffset: 0.5 });
  const sol = solveNet({ nodes: ['A'], elements: [], afg: [{ node: 'A', p }] });
  const gain = 1 / (1 + 50e-12), stats = sol.stats('A', 'E');
  near(stats.mean, (0.5 + 2 * (2 * .01 - 1)) * gain, 1e-12);
  near(stats.acRms, 4 * Math.sqrt(.01 * .99) * gain, 1e-12);
  near(sol.meanOver('A', 'E', 0, .00001), 2.5 * gain, 1e-11);
  near(sol.nodeAt('A', .00001), -1.5 * gain, 1e-12);
  assert.equal(sol.table('A').length, 4000, 'public sampling remains uniform');
});

test('1.1% Square RC response agrees with independently derived exponential charging', () => {
  const R = 1000, C = 100e-9, p = signal({ wave: 'SQUARE', duty: 1.1 }), T = 1 / p.freq, high = p.duty / 100 * T;
  const tau = (R + 50) * C, eh = Math.exp(-high / tau), el = Math.exp(-(T - high) / tau);
  const v0 = (-2 * (1 - el) + el * 2 * (1 - eh)) / (1 - eh * el), v1 = 2 + (v0 - 2) * eh;
  const expected = (t) => t < high ? 2 + (v0 - 2) * Math.exp(-t / tau) : -2 + (v1 + 2) * Math.exp(-(t - high) / tau);
  const fixed = solve({ topo: 'RC', R, C, wires: { 'AFG.CH1+': 'A', 'AFG.CH1-': 'G' } }, [p, { ...p, output: false }]);
  const net = solveNet({ nodes: ['A', 'B'], elements: [{ id: 'R', kind: 'R', a: 'A', b: 'B', value: R }, { id: 'C', kind: 'C', a: 'B', b: 'E', value: C }], afg: [{ node: 'A', p }] });
  for (const t of [0, high / 2, high - 1e-12, high, high + 1e-12, high + tau, T - 1e-12]) {
    near(nodeAt(fixed, 'B', t), expected(t), 1e-8, `fixed RC at ${t}`);
    near(net.nodeAt('B', t), expected(t), 1e-8, `net RC at ${t}`);
  }
  near(diffStats(fixed, 'B', 'G').mean, 2 * (2 * .011 - 1), 1e-8);
  near(net.stats('B', 'E').mean, 2 * (2 * .011 - 1), 1e-8);
});

test('shifted Ramp corners: exact RC values/integrals are a time shift of the unshifted solution', () => {
  const p = signal({ wave: 'RAMP', sym: 37.3 }), phase = 33.7, shift = phase / (360 * p.freq);
  const net = { nodes: ['A', 'B'], elements: [{ id: 'R', kind: 'R', a: 'A', b: 'B', value: 1000 }, { id: 'C', kind: 'C', a: 'B', b: 'E', value: 100e-9 }] };
  const base = solveNet({ ...net, afg: [{ node: 'A', p }] });
  const shifted = solveNet({ ...net, afg: [{ node: 'A', p: { ...p, phase } }] });
  const fixed = solve({ topo: 'RC', R: 1000, C: 100e-9, wires: { 'AFG.CH1+': 'A', 'AFG.CH1-': 'G' } }, [{ ...p, phase }, { ...p, output: false }]);
  for (const t of [0, .0002, .0002793888889, .0008, .0009063888889, .001]) {
    near(shifted.nodeAt('B', t), base.nodeAt('B', t + shift), 1e-9, `shifted at ${t}`);
    near(nodeAt(fixed, 'B', t), base.nodeAt('B', t + shift), 1e-9);
  }
  near(shifted.meanOver('B', 'E', .00014, .00062), base.meanOver('B', 'E', .00014 + shift, .00062 + shift), 1e-10);
  near(shifted.stats('B', 'E').acRms, base.stats('B', 'E').acRms, 1e-10);
  assert.ok(shifted.mesh.length > 4001, 'phase corner has its own internal cell');
});

test('real bench and scope: positive Sine phase advances the actual rising trigger', () => {
  let time = 0;
  const afg = new AfgModel(), bench = new Bench(afg), scope = new TdsModel();
  bench.now = () => time; bench.probeX = [1, 1]; bench.C = 1e-12;
  for (const [lead, node] of Object.entries(DEMO)) bench.connect(lead, node);
  run(afg, 'OUT CH CH F4 F1 90 F5');
  time = 1; bench.solution(); scope.setBenchSource(() => bench.tdsInput()); scope.setScenario('BENCH');
  near(scope.path(0).cross(0, 'R'), .00075, 2e-9, '+90° rising edge is at 3/4 period');
  near(bench.afgParams()[0].phase, 90);
  run(afg, 'WAVE F2 F1 1 F2');
  time = 2; bench.solution(); scope.setScenario('BENCH');
  near(scope.path(0).cross(0, 'F'), .00001, 2e-9, '1% pulse falls at 10 µs');
});

function sharedSupply(p, C = null) {
  let time = 0;
  const afg = { on: true, ch: [{ ...p, output: false }, { ...p, output: false }] };
  const gpe = { on: true, output: false, mode: 'INDEP', eff: () => ({ vs: 5, is: .01 }) };
  const b = new Bench(afg, null, gpe), elements = C ? [{ id: 'C', kind: 'C', a: 'P', b: 'E', value: C }] : [];
  const leads = { 'AFG.CH1+': 'P', 'AFG.CH1-': 'E', 'GPE.CH1+': 'P', 'GPE.CH1-': 'E' };
  b.now = () => time; b.board = 'bb'; b.bbWires = Object.fromEntries(Object.keys(leads).map((id) => [id, id]));
  b.bb = { key: () => '', netlist: () => ({ nodes: ['P', 'E'], elements, leads, warnings: [] }) };
  b.solution(); afg.ch[0].output = true; gpe.output = true; b.solution();
  return { b, at: (t) => { time = t; return b.gpeInput()[1]; } };
}

test('1% Duty and GPE jointly drive 47 nF: actual short plateau, charge continuity and late-cycle CC/RB', () => {
  const p = signal({ wave: 'SQUARE', duty: 1, emfVpp: 10, emfOffset: 5 }), C = 47e-9;
  const { b, at } = sharedSupply(p, C), sol = b.solution(), tau = 50 * C;
  near(b.vcAt(100e-9), 10.5 * -Math.expm1(-100e-9 / tau), 1e-9, 'startup remains current-limited');
  assert.equal(at(100e-9).cc, true);
  const upToCV = tau * Math.log(10.5 / (10.5 - 4.9999)), tauCV = C / (100 + .02);
  const cvTarget = (10 / 50 + 5 / .01) / (1 / 50 + 1 / .01), upToRB = tauCV * Math.log((cvTarget - 4.9999) / (cvTarget - 5));
  const t = 9e-6, expectedHigh = 10 - 5 * Math.exp(-(t - upToCV - upToRB) / tau);
  near(at(t).v, expectedHigh, 1e-8, 'independent piecewise charging law'); assert.equal(at(t).rb, true);
  near(sol.actualNodeAt('P', .00001 - 1e-12), sol.actualNodeAt('P', .00001 + 1e-12), 1e-5, 'capacitor remains continuous at actual 1% falling edge');
  assert.equal(at(.00002).cc, true); near(at(.0001).v, .5, 1e-8);
  assert.equal(at(10.000005).rb, true); assert.equal(at(10.00002).cc, true);
  near(sol.stats('P', 'E').mean, sol.actualMeanOver('P', 'E', 10, 10.001), 1e-7, 'long-term integral uses actual duty');
});

test('shifted Ramp with algebraic GPE protection keeps the real CV/CC/RB law at corners', () => {
  const p = signal({ wave: 'RAMP', phase: 33.7, sym: 37.3, emfVpp: 10, emfOffset: 5 });
  const { b, at } = sharedSupply(p), sol = b.solution();
  for (const phase of [0, .0001, .0002793888889 - 1e-10, .0002793888889 + 1e-10, .0006, .0009063888889, .00095]) {
    const e = emf(p, phase), expected = e >= 5 ? e : e < 4.4999 ? e + .5 : (5 / .01 + e / 50) / (1 / .01 + 1 / 50);
    const r = at(10 + phase); near(r.v, expected, 1e-8, `protected Ramp at ${phase}`);
    assert.equal(r.rb, e > 5); assert.equal(r.cc, e < 4.4999);
  }
  assert.ok(sol.stats('P', 'E').acRms > 2, 'protection statistics still include the shifted triangle');
});

test('shifted Ramp + capacitor + GPE protection agrees with an independent implicit ODE reference', () => {
  const phase = 33.7, symmetry = .373, C = 1e-6, T = .001, N = 200000, h = T / N;
  const p = signal({ wave: 'RAMP', phase, sym: symmetry * 100, emfVpp: 10, emfOffset: 5 });
  const { b, at } = sharedSupply(p, C), sol = b.solution();
  const checkpoints = [N / 10, N / 4, N / 2, 4 * N / 5, N, 7.25 * N, 7.8 * N].map(Math.round);
  const values = new Map(); let v = 0, sum = 0, square = 0;
  // Backward Euler on C*v'=(e-v)/50+clamp((5-v)/.01,0,.01).
  // This uses neither modal decomposition, period shooting, edge cuts nor events.
  for (let k = 1; k <= 8 * N; k++) {
    const cycle = k / N + phase / 360, f = cycle - Math.floor(cycle);
    const e = f < symmetry ? 10 * f / symmetry : 10 * (1 - f) / (1 - symmetry);
    const rhs = v + h * e / (50 * C), g = .02 + 1e-12;
    const cc = (rhs + h * .01 / C) / (1 + h * g / C), rb = rhs / (1 + h * g / C);
    v = cc <= 4.9999 ? cc : rb >= 5 ? rb : (rhs + h * 5 / (.01 * C)) / (1 + h * (g + 100) / C);
    if (checkpoints.includes(k)) values.set(k, v);
    if (k > 7 * N) { sum += v; square += v * v; }
  }
  for (const [step, expected] of values) {
    const reading = at(step * h);
    near(reading.v, expected, .0003, `ODE startup/periodic Ramp at ${step * h}`);
    near(reading.i, Math.max(0, Math.min(.01, (5 - reading.v) / .01)), 1e-7, 'actual GPE current law');
  }
  near(at(10.00025).v, values.get(7.25 * N), .0003, 'long-term shifted corner');
  near(at(10.0008).v, values.get(7.8 * N), .0003, 'long-term descending slope');
  const mean = sum / N;
  near(sol.stats('P', 'E').mean, mean, .0003, 'ODE cycle mean');
  near(sol.stats('P', 'E').acRms, Math.sqrt(square / N - mean * mean), .0003, 'ODE cycle AC RMS');
});
