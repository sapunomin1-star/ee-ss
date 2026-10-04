import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
import { captureSession, restoreSession } from '../src/core/session.js';

const key = (scope, id) => scope.press(`TDS.KEY.${id}`);
const undoRange = (scope) => scope.press('TDS.SOFT.OPT5');
function setup() {
  const models = createInstruments();
  const bench = new Bench(models.afg, models.dmm, models.gpe);
  bench.now = () => 10;
  return { models, bench, scope: models.tds };
}
function newExperiment() {
  const s = setup();
  key(s.scope, 'AUTOSET');
  key(s.scope, 'AUTORANGE');
  key(s.scope, 'AUTORANGE');
  assert.equal(s.scope.sdiv, 250e-6);
  return captureSession(s.models, s.bench, { tab: 'tds' });
}

test('experiment import discards previous AutoRange Undo without changing imported settings', () => {
  const s = setup(), saved = newExperiment();
  assert.equal(s.scope.sdiv, 0.5);
  key(s.scope, 'AUTORANGE');
  key(s.scope, 'AUTORANGE');
  assert.ok(s.scope.autoRangeUndo);
  restoreSession(saved, s.models, s.bench);
  assert.equal(s.scope.menu, 'AUTORANGE');
  assert.equal(s.scope.sdiv, 250e-6);
  const imported = captureSession(s.models, s.bench, { tab: 'tds' });
  undoRange(s.scope);
  assert.equal(s.scope.sdiv, 250e-6, 'Undo must not restore the previous experiment at 500 ms/div');
  assert.deepEqual(captureSession(s.models, s.bench, { tab: 'tds' }), imported);
  assert.equal(s.scope.autoRangeUndo, null);
  assert.equal(s.scope.undo, null);
  // Undo still works for AutoRange performed within the newly loaded experiment.
  s.scope.turn('TDS.KNOB.HORIZ_SCALE', 1);
  const selected = s.scope.sdiv;
  key(s.scope, 'AUTORANGE');
  undoRange(s.scope);
  assert.equal(s.scope.sdiv, selected);
});

test('rejected and rolled-back imports retain the existing AutoRange Undo', () => {
  for (const liveFailure of [false, true]) {
    const s = setup(), saved = newExperiment();
    key(s.scope, 'AUTORANGE');
    key(s.scope, 'AUTORANGE');
    const undo = s.scope.autoRangeUndo;
    if (liveFailure) {
      saved.instruments.tds.scenario = 'BENCH';
      s.scope.setBenchSource(() => { throw new Error('source failure'); });
    } else saved.instruments.tds.sIdx = -1;
    assert.throws(() => restoreSession(saved, s.models, s.bench), /實驗存檔/);
    assert.equal(s.scope.autoRangeUndo, undo);
    undoRange(s.scope);
    assert.equal(s.scope.sdiv, 0.5);
  }
});

test('Default Setup and instrument reset clear both kinds of scope Undo', () => {
  for (const reset of [(scope) => key(scope, 'DEFAULT_SETUP'), (scope) => scope.reset()]) {
    const { scope } = setup();
    key(scope, 'AUTOSET');
    key(scope, 'AUTORANGE');
    assert.ok(scope.undo);
    assert.ok(scope.autoRangeUndo);
    reset(scope);
    assert.equal(scope.undo, null);
    assert.equal(scope.autoRangeUndo, null);
  }
});
