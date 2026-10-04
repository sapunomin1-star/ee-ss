import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { validateTdsSetupFile, restoreTdsSetupFile } from '../src/core/session.js';
function exported() {
  const scope = createInstruments().tds;
  scope.press('TDS.KEY.AUTOSET');
  scope.extended.store.target = 'FILE'; scope.extended.store.action = 'SAVE_SETUP';
  return JSON.parse(scope.storeSoft(4).download.text);
}

test('scope setup exports round-trip through the same strict schema as internal memories', () => {
  const file = exported(), original = structuredClone(file), valid = validateTdsSetupFile(file);
  assert.deepEqual(valid, file.state); assert.deepEqual(file, original);
  valid.ch[0].probe = 100;
  assert.notEqual(file.state.ch[0].probe, valid.ch[0].probe, 'validated state is detached');
});

test('scope file validation rejects partial, nested, corrupt and unrelated formats', () => {
  for (const corrupt of [
    (x) => { x.format = 'ee-ss-session'; },
    (x) => { x.state = null; },
    (x) => { delete x.state.ch; },
    (x) => { x.state.ch[0].probe = 0; },
    (x) => { x.state.ch[0].vIdx = 999; },
    (x) => { x.state.trig.level = NaN; },
    (x) => { x.state.rec = { future: true }; },
    (x) => { x.state.savedSetups = Array(10).fill(null); },
    (x) => { x.state.extended.averages = 3; },
  ]) {
    const file = exported(); corrupt(file);
    assert.throws(() => validateTdsSetupFile(file), /實驗存檔/);
  }
  const file = exported();
  Object.defineProperty(file.state, 'run', { enumerable: true, get() { throw new Error('must not execute'); } });
  assert.throws(() => validateTdsSetupFile(file), /不接受動態屬性/);
});

test('an unexpected setup application failure restores original channel objects and runtime state', () => {
  const scope = createInstruments().tds, file = exported();
  scope.recallSetup = function (state) {
    this.restore(state);
    this.rec = null;
    throw new Error('input source unavailable');
  };
  const original = Object.getOwnPropertyDescriptors(scope), channels = structuredClone(scope.ch);
  assert.throws(() => restoreTdsSetupFile(file, scope), /input source unavailable/);
  assert.deepEqual(Object.getOwnPropertyDescriptors(scope), original);
  assert.deepEqual(scope.ch, channels);
});
