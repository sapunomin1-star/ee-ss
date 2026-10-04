import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
import { Breadboard } from '../src/bench/breadboard.js';
const near = (v, x, e = 1e-6) => assert.ok(Math.abs(v - x) < e, `${v} vs ${x}`);
function setup() {
  const m = createInstruments(), b = new Bench(m.afg, m.dmm, m.gpe), clock = { t: 0 };
  b.now = () => clock.t; b.board = 'bb'; b.bb = new Breadboard();
  m.dmm.fixture = 'bench'; m.dmm.ratioOn = true;
  m.gpe.on = true; m.gpe.output = true; m.gpe.vset[1] = 400; m.gpe.vset[2] = 200;
  b.bbWires = { 'GPE.CH1+': 'a1', 'GPE.CH1-': 'a2', 'DMM.HI': 'b1', 'DMM.LO': 'b2',
    'GPE.CH2+': 'a3', 'GPE.CH2-': 'c2', 'DMM.SHI': 'b3', 'DMM.SLO': 'd2' };
  b.solution();
  return { m, b, clock };
}

test('completed meter windows retain Input and Sense history after all probes are removed', () => {
  const { b, clock } = setup(); clock.t = 1;
  const old = b.dmmInput(), input = old.v.meanOver(.5, 1), reference = old.refWindow.meanOver(.5, 1);
  clock.t = 2;
  for (const id of ['DMM.HI', 'DMM.LO', 'DMM.SHI', 'DMM.SLO']) delete b.bbWires[id];
  b.solution(); clock.t = 3;
  const now = b.dmmInput();
  assert.equal(now.now, 3); assert.equal(now.v, null); assert.equal(now.ref, null);
  assert.equal(now.vWindow.validOver(.5, 1), true);
  near(now.vWindow.meanOver(.5, 1), input);
  assert.deepEqual(now.refWindow.meanOver(.5, 1), reference);
  assert.equal(reference.valid, true);
  assert.equal(now.vWindow.validOver(1.5, 2.5), false);
  assert.equal(now.vWindow.validOver(-1, .5), false);
  assert.equal(now.vWindow.validOver(2, 4), false);
  assert.equal(now.refWindow.meanOver(1.5, 2.5).valid, false);
});

test('Sense validation checks a brief overvoltage inside the whole aperture, not just its mean', () => {
  const { b, m, clock } = setup(); clock.t = .4; m.gpe.vset[2] = 2000; b.solution();
  clock.t = .5; m.gpe.vset[2] = 200; b.solution(); clock.t = 1;
  const ref = b.dmmInput().refWindow;
  near(ref.meanOver(0, 1).hi, 3.8, 1e-5);
  assert.equal(ref.meanOver(0, 1).valid, false);
  assert.equal(ref.meanOver(.6, 1).valid, true);
});

test('frequency clues and passive networks are resolved at the completed acquisition time', () => {
  const { b, m, clock } = setup(); m.gpe.output = false; m.dmm.ratioOn = false;
  m.afg.ch[0].output = true; m.afg.ch[0].freq = 1000;
  b.bbWires = { 'AFG.CH1+': 'a1', 'AFG.CH1-': 'a2', 'DMM.HI': 'b1', 'DMM.LO': 'b2' };
  b.solution(); clock.t = 1;
  delete b.bbWires['DMM.HI']; b.solution(); clock.t = 2;
  const signal = b.dmmInput().vWindow;
  assert.equal(signal.frequencyAt(.5).carrierFreq, 1000);
  assert.equal(signal.frequencyAt(1.5).freq, 0);
  m.afg.ch[0].output = false; m.dmm.fn = 'OHM'; b.bbWires = { 'DMM.HI': 'a1', 'DMM.LO': 'a2' };
  b.bb.add('R', 'b1', 'b2', 1000); b.solution(); clock.t = 3;
  b.bb.parts[0].value = 2000; b.solution(); clock.t = 4;
  near(b.dmmInput().passiveAt(2.5).ohm, 1000);
  near(b.dmmInput().passiveAt(3.5).ohm, 2000);
});
