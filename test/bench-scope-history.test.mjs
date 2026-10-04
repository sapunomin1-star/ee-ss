import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';

test('scope filter history preserves actual lead positions and analytical RC segments', () => {
  const m = createInstruments(), b = new Bench(m.afg, m.dmm, m.gpe); let time = 0;
  b.now = () => time; b.R = 1000; b.C = 1e-6;
  b.wires = { 'AFG.CH1+': 'A', 'AFG.CH1-': 'G', 'TDS.CH1.TIP': 'B', 'TDS.CH1.GND': 'G' };
  m.afg.ch[0].output = false; b.solution();
  time = 1; m.afg.ch[0].output = true; b.solution();
  const signal = b.tdsInput().sig[0];
  time = 2; b.wires['TDS.CH1.TIP'] = 'G'; b.solution(); time = 3;
  assert.deepEqual(signal.historyCuts(.5, 2.5), [1, 2]);
  const pieces = signal.history(.5, 2.5); assert.equal(pieces.length, 3);
  for (const t of [.5, 1, 1.00002, 1.002, 1.9, 2.1]) {
    const p = pieces.find((p) => p.from <= t && t < p.to);
    assert.ok(Math.abs(p.abs(t) - signal.abs(t)) < 1e-10);
    if (!p.actual) {
      const v = p.at(t) + p.lam.reduce((sum, lam, k) => sum + p.coeff[k] * Math.exp(-lam * Math.max(0, t - p.t0)), 0);
      assert.ok(Math.abs(v - signal.abs(t)) < 1e-8, `${t}: ${v} vs ${signal.abs(t)}`);
    }
  }
  assert.equal(pieces.at(-1).abs(2.1), 0, 'moving the probe to ground remains visible in old callbacks');
});

test('CC history exposes its stable absolute trajectory rather than cancellation-prone modal subtraction', () => {
  const m = createInstruments(), b = new Bench(m.afg, m.dmm, m.gpe); let time = 0;
  b.now = () => time; b.C = 47e-9;
  b.wires = { 'GPE.CH1+': 'B', 'GPE.CH1-': 'G', 'TDS.CH1.TIP': 'B', 'TDS.CH1.GND': 'G' };
  m.gpe.on = true; m.gpe.output = false; m.gpe.vset[1] = 500; m.gpe.iset[1] = 10; b.solution();
  time = 1; m.gpe.output = true; b.solution(); time = 1.00001;
  const input = b.tdsInput().sig[0], piece = input.history(1, 1.00000001)[0];
  assert.equal(piece.actual, true);
  const t = 1.000000001, expected = .01 / b.C * (t - 1);
  assert.ok(Math.abs(piece.abs(t) - expected) < expected * 1e-5);
});

test('physical probe attenuation retains its own time history independently of the scope menu', () => {
  const m = createInstruments(), b = new Bench(m.afg, m.dmm, m.gpe); let time = 0;
  b.now = () => time; b.probeX[0] = 1;
  b.wires = { 'GPE.CH1+': 'A', 'GPE.CH1-': 'G', 'TDS.CH1.TIP': 'A', 'TDS.CH1.GND': 'G' };
  m.gpe.on = true; m.gpe.output = true; m.gpe.vset[1] = 500; b.solution();
  time = 1; const signal = b.tdsInput().sig[0];
  time = 2; b.probeX[0] = 10; b.solution(); time = 3;
  assert.equal(signal.probeAt(1), 1); assert.equal(signal.probeAt(2.5), 10);
  assert.deepEqual(signal.history(1, 3).map((h) => h.probe), [1, 10]);
  const oldBnc = signal.abs(1) / signal.probeAt(1), newBnc = signal.abs(2.5) / signal.probeAt(2.5);
  assert.ok(oldBnc > 4.99 && newBnc > .499 && newBnc < .501);
  assert.equal(m.tds.ch[0].probe, 10, 'physical switch did not rewrite the scope interpretation setting');
});
