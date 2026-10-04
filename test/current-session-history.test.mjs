import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
import { Breadboard } from '../src/bench/breadboard.js';
import { WiringHistory } from '../src/bench/history.js';
import { captureSession, validateSession, restoreSession } from '../src/core/session.js';

const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
function setup() {
  const models = createInstruments(), bench = new Bench(models.afg, models.dmm, models.gpe);
  const clock = { t: 0 };
  bench.now = () => clock.t;
  bench.board = 'bb'; bench.bb = new Breadboard();
  bench.bb.add('R', 'a5', 'a10', 1000, bench.bbWires);
  for (const [lead, hole] of Object.entries({ 'GPE.CH1+': 'b5', 'GPE.CH1-': 'b15',
    'GPE.GND': 'c15', 'DMM.I': 'b10', 'DMM.LO': 'd15' })) {
    assert.ok(bench.bb.plug(bench.bbWires, lead, hole).ok);
  }
  models.gpe.vset[1] = 500; models.gpe.iset[1] = 1000;
  models.gpe.output = true; models.gpe.load = 'bench';
  models.dmm.fn = 'DCI'; models.dmm.fixture = 'bench';
  models.dmm.per.DCI.auto = false; models.dmm.per.DCI.idx = 2;
  models.dmm.setBenchSource(() => bench.dmmInput());
  models.gpe.setBenchSource(() => bench.gpeInput());
  models.tds.setBenchSource(() => bench.tdsInput());
  bench.solution(); clock.t = 1;
  return { models, bench, clock };
}

test('series current session round-trip retains I terminal, physical burden and source callbacks', () => {
  const s = setup(), saved = captureSession(s.models, s.bench, { tab: 'dmm', zoom: 1.5 });
  assert.equal(saved.bench.breadboard.wires['DMM.I'], 'b10');
  const expected = 5 / (1000 + 5 + 0.01);
  near(s.models.dmm.view().value, expected);
  near(s.bench.gpeInput()[1].i, expected);
  const callbacks = [s.models.dmm.benchSource, s.models.gpe.benchSource, s.models.tds.benchSource];
  s.clock.t = 5;
  const ui = restoreSession(saved, s.models, s.bench);
  assert.deepEqual(captureSession(s.models, s.bench, ui), saved);
  assert.deepEqual([s.models.dmm.benchSource, s.models.gpe.benchSource, s.models.tds.benchSource], callbacks);
  near(s.models.dmm.currentShunt(), 5);
  near(s.models.dmm.view().value, expected);
  near(s.bench.gpeInput()[1].i, expected);
});

test('undoing current-circuit edits preserves historical readings and records the restored circuit at present time', () => {
  const s = setup(), h = new WiringHistory(s.bench), past = s.bench.dmmInput().i.meanOver(0.5, 0.6);
  h.perform('bb', 'change resistor', () => s.bench.bb.setValue('R1', 4700));
  s.bench.solution(); s.clock.t = 1.1;
  near(s.bench.dmmInput().i.dc, 5 / (4700 + 5 + 0.01));
  near(s.bench.dmmInput().i.meanOver(0.5, 0.6), past);
  h.undo('bb'); s.bench.solution();
  assert.equal(s.bench.changedAt(), 1.1);
  near(s.bench.dmmInput().i.dc, 5 / (1000 + 5 + 0.01));
  near(s.bench.dmmInput().i.meanOver(1.025, 1.075), 5 / (4700 + 5 + 0.01));
  near(s.bench.dmmInput().i.meanOver(0.5, 0.6), past);
  assert.equal(h.status('bb').redo, 1);
});

test('current terminal obeys strict file validation while older sessions without I remain loadable', () => {
  const s = setup(), saved = captureSession(s.models, s.bench);
  const bad = structuredClone(saved); bad.bench.breadboard.wires['DMM.I'] = 'z31';
  const history = s.bench.segs;
  assert.throws(() => restoreSession(bad, s.models, s.bench), /孔位不存在/);
  assert.equal(s.bench.segs, history);
  assert.deepEqual(captureSession(s.models, s.bench), saved);
  const legacy = structuredClone(saved); delete legacy.bench.breadboard.wires['DMM.I'];
  assert.deepEqual(validateSession(legacy), legacy);
  restoreSession(legacy, s.models, s.bench);
  assert.equal(s.bench.dmmInput().i, null);
  assert.equal(s.models.dmm.view().state, 'none');
});
