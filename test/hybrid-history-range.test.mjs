import test from 'node:test';
import assert from 'node:assert/strict';
import { Bench } from '../src/bench/bench.js';
import { Breadboard } from '../src/bench/breadboard.js';
import { GpeModel } from '../src/instruments/gpe/model.js';

test('hybrid trigger bounds include the earlier unpowered circuit without subtracting a future startup offset', () => {
  let now = 0;
  const p = { wave: 'SINE', freq: 1000, sym: 50, emfVpp: 10, emfOffset: 5, output: false };
  const afg = { on: true, ch: [p, { ...p }] }, gpe = new GpeModel();
  gpe.vset[1] = 3200; gpe.iset[1] = 1; gpe.output = false;
  const b = new Bench(afg, null, gpe); b.now = () => now; b.board = 'bb'; b.bb = new Breadboard();
  b.bb.add('R', 'a5', 'a10', 100000, b.bbWires);
  b.bb.add('C', 'b10', 'a15', 10e-6, b.bbWires);
  for (const [lead, hole] of Object.entries({ 'AFG.CH1+': 'b5', 'AFG.CH1-': 'b15',
    'GPE.CH1+': 'c10', 'GPE.CH1-': 'c15', 'TDS.CH1.TIP': 'd10', 'TDS.CH1.GND': 'd15' })) {
    assert.ok(b.bb.plug(b.bbWires, lead, hole).ok);
  }
  b.solution();
  now = 1; p.output = true; gpe.output = true; b.solution();
  const signal = b.tdsInput().sig[0], [low, high] = signal.transientRange(.5, .9);
  assert.ok(signal.at(.5) > 31, 'steady source is near 32 V while the capacitor has only just begun charging');
  for (const t of [.5, .61, .72, .9]) {
    const delta = signal.abs(t) - signal.at(t);
    assert.equal(signal.abs(t), 0, 'the preceding circuit was unpowered');
    assert.ok(low <= delta + 1e-9 && high >= delta - 1e-9, `t=${t}: ${delta} outside [${low}, ${high}]`);
  }
});
