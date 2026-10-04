import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticPieceRange, nodePairPeakOver } from '../src/bench/window-peak.js';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
import { Breadboard } from '../src/bench/breadboard.js';

const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}`);
const model = (period, mesh, lam, coefficients, wave = () => 0) => ({
  t0: 0, amp: coefficients,
  sol: { period, mesh, lam, modeW: (node) => lam.map(() => node === 'HI' ? 1 : 0), nodeAt: (node, t) => node === 'HI' ? wave(t) : 0 },
});

test('an actual aperture peak finds an interior multi-modal extremum', () => {
  const seg = model(1, [0, 1], [1, 10], [1, -1]);
  const at = Math.log(10) / 9, expected = Math.exp(-at) - Math.exp(-10 * at);
  near(nodePairPeakOver(seg, 'HI', 'E', 0, 5), expected, 1e-8);
  const range = analyticPieceRange((t) => Math.exp(-t) - Math.exp(-10 * t), 0, 1, [], [1, 10]);
  near(range.max, expected, 1e-8); near(range.maxAt, at, 1e-6);
});

test('true Pulse and ARB corners preserve a pulse narrower than an ordinary sample cell', () => {
  const period = .001, width = 20e-9;
  const seg = model(period, [0, width, period], [], [], (t) => ((t % period) + period) % period < width ? 5 : 0);
  near(nodePairPeakOver(seg, 'HI', 'E', 0, 10), 5);
  near(nodePairPeakOver(seg, 'HI', 'E', .0001, .0002), 0);
  near(nodePairPeakOver(seg, 'HI', 'E', 0, 10, 2), 3);
});

test('a completed segment never includes a larger voltage from after its ending corner', () => {
  const seg = model(1, [0, .5, 1], [], [], (t) => t < .5 ? 0 : 10);
  near(nodePairPeakOver(seg, 'HI', 'E', 0, .5), 0);
  near(nodePairPeakOver(seg, 'HI', 'E', .5, .75), 10);
});

test('a long high-carrier window resolves a slow interior peak with bounded work', () => {
  const seg = model(1 / 2e6, [0, 1 / 2e6], [.001, .01], [1, -1]);
  let evaluations = 0;
  const value = (t) => { evaluations++; return Math.exp(-.001 * t) - Math.exp(-.01 * t); };
  const at = Math.log(10) / .009, expected = value(at);
  near(nodePairPeakOver(seg, 'HI', 'E', 0, 1000, 0, value), expected, 2e-7);
  assert.ok(evaluations < 10000, `evaluated ${evaluations} values for two billion carrier cycles`);
});

test('nonlinear trajectories delegate actual peaks and unknown histories remain unavailable', () => {
  let call;
  const seg = { sol: { actualNodeAt: () => 100, actualPeakOver: (...args) => { call = args; return 2; } } };
  assert.equal(nodePairPeakOver(seg, 'HI', 'LO', 1, 2, 3), 2);
  assert.deepEqual(call, ['HI', 'LO', 1, 2, 3]);
  delete seg.sol.actualPeakOver;
  assert.ok(Number.isNaN(nodePairPeakOver(seg, 'HI', 'LO', 1, 2)));
});

test('a Manual Burst keeps its actual aperture peak after the output has returned to zero', () => {
  const m = createInstruments(), b = new Bench(m.afg, m.dmm, m.gpe); let time = 0;
  b.now = () => time; m.dmm.now = () => time;
  b.board = 'bb'; b.bb = new Breadboard(); b.bb.add('R', 'a1', 'a2', 1000);
  b.bbWires = { 'AFG.CH1+': 'b1', 'AFG.CH1-': 'b2', 'DMM.HI': 'c1', 'DMM.LO': 'c2' };
  m.dmm.fixture = 'bench'; m.dmm.fn = 'ACV';
  Object.assign(m.afg.ch[0], { wave: 'SINE', freq: 1000, emfVpp: 6, emfOffset: 0, output: true });
  Object.assign(m.afg.ch[0].extended.motion, { mode: 'BURST', source: 'MANUAL', cycles: 1 });
  m.afg.motionRuntime[0] = { firedAt: 0 }; b.solution(); time = 2;
  const input = b.dmmInput().v, center = input.meanOver(0, 100 / 60);
  let peak = 0;
  for (const seg of b.segs) {
    const a = Math.max(0, seg.from), z = Math.min(100 / 60, seg.to);
    if (!(z > a)) continue;
    const hi = seg.built.leadNode['DMM.HI'], lo = seg.built.leadNode['DMM.LO'];
    peak = Math.max(peak, nodePairPeakOver(seg, hi, lo, a, z, center, input.at));
  }
  const load = 1000 * 1e6 / (1000 + 1e6), expected = 3 * load / (50 + load);
  near(peak, expected, 1e-5);
  assert.equal(input.peakAc, 0);
});
