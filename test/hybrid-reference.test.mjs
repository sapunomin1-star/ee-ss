import test from 'node:test';
import assert from 'node:assert/strict';
import { Bench } from '../src/bench/bench.js';
import { Breadboard } from '../src/bench/breadboard.js';
import { GpeModel } from '../src/instruments/gpe/model.js';

// Independent one-node reference: backward Euler on
// C dv/dt = (emf-v)/50 + clamp((5-v)/.01, 0, .01) - GMIN*v.
// This deliberately does not use modal propagation, event finding or shooting.
function reference() {
  const T = 0.001, C = 1e-6, N = 200000, h = T / N;
  const sampled = new Map([[0, 0]]);
  let v = 0, sum = 0, square = 0;
  for (let step = 1; step <= 8 * N; step++) {
    const t = step * h, emf = 5 + 5 * Math.sin(2 * Math.PI * t / T);
    const rhs = v + h * emf / (50 * C), g = 1 / 50 + 1e-12;
    const cc = (rhs + h * 0.01 / C) / (1 + h * g / C);
    const rb = rhs / (1 + h * g / C);
    v = cc <= 5 - 0.01 * 0.01 ? cc : rb >= 5 ? rb
      : (rhs + h * 5 / (0.01 * C)) / (1 + h * (g + 1 / 0.01) / C);
    if ([N / 4, N / 2, 3 * N / 4, N, 7 * N + N / 4, 7 * N + 3 * N / 4].includes(step)) sampled.set(step, v);
    if (step > 7 * N) { sum += v; square += v * v; }
  }
  const mean = sum / N;
  return { sampled, h, N, mean, acRms: Math.sqrt(square / N - mean * mean) };
}

test('capacitive protection agrees with independent ODE reference at startup and after thousands of cycles', () => {
  let t = 0;
  const p = { wave: 'SINE', freq: 1000, sym: 50, emfVpp: 10, emfOffset: 5, output: true };
  const afg = { on: true, ch: [p, { ...p, output: false }] }, gpe = new GpeModel();
  gpe.vset[1] = 500; gpe.iset[1] = 10; gpe.output = true;
  const b = new Bench(afg, null, gpe); b.now = () => t; b.board = 'bb'; b.bb = new Breadboard();
  b.bb.add('C', 'a5', 'a10', 1e-6, b.bbWires);
  for (const [lead, hole] of Object.entries({ 'AFG.CH1+': 'b5', 'AFG.CH1-': 'b10',
    'GPE.CH1+': 'c5', 'GPE.CH1-': 'c10' })) assert.ok(b.bb.plug(b.bbWires, lead, hole).ok);
  const sol = b.solution(), node = b.cur.built.leadNode['GPE.CH1+'], ref = reference();
  const count = b.segs.length;
  for (const [step, expected] of ref.sampled) {
    t = step * ref.h;
    const reading = b.gpeInput()[1];
    assert.ok(Math.abs(reading.v - expected) < 0.0002, `t=${t}: ${reading.v} vs ${expected}`);
    const actualV = b.vcAt(t), current = Math.max(0, Math.min(0.01, (5 - actualV) / 0.01));
    assert.ok(Math.abs(reading.i - current) < 1e-7, `channel law at t=${t}`);
  }
  for (const [phase, step] of [[0.00025, 7.25 * ref.N], [0.00075, 7.75 * ref.N]]) {
    t = 10 + phase;
    const expected = ref.sampled.get(step);
    assert.ok(Math.abs(b.gpeInput()[1].v - expected) < 0.0002, `long-term phase ${phase}`);
  }
  assert.equal(b.segs.length, count, 'periodic switches do not accumulate circuit edit history');
  assert.ok(Math.abs(sol.stats(node, 'E').mean - ref.mean) < 0.0002);
  assert.ok(Math.abs(sol.stats(node, 'E').acRms - ref.acRms) < 0.0002);
  assert.ok(!b.snapshot().warn.some((w) => w.includes('目前不支援') && w.includes('週期限流')));
});
