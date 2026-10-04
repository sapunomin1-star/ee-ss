import test from 'node:test';
import assert from 'node:assert/strict';
import { DmmModel, CURRENT_SHUNT } from '../src/instruments/dmm/model.js';

const key = (m, id) => m.press(/^S[1-6]$/.test(id) ? `DMM.SOFT.${id}` : `DMM.KEY.${id}`);

test('Stopped Range +/- displays the selected range and corresponding input load without acquiring a reading', () => {
  const m = new DmmModel(); key(m, 'S4'); key(m, 'RUN_STOP');
  const captured = m.reading(), count = m.readings.length;
  assert.equal(m.inputZ(), 1e10);
  key(m, 'RANGE_UP');
  assert.equal(m.view().rangeLabel, 'Manual 100V');
  assert.equal(m.view().soft[0].value, '100V');
  assert.match(m.lcd(), /Manual 100V/);
  assert.equal(m.rangeIdx(), m.st.idx); assert.equal(m.inputZ(), 1e7);
  assert.equal(m.run, 'stop'); assert.deepEqual(m.reading(), captured);
  m.setFixture('acv');
  assert.deepEqual(m.reading(), captured); assert.equal(m.readings.length, count);
  key(m, 'RANGE_DOWN');
  assert.equal(m.view().rangeLabel, 'Manual 10V'); assert.equal(m.inputZ(), 1e10);
  key(m, 'RANGE');
  assert.equal(m.view().rangeLabel, 'Auto 10V'); assert.equal(m.inputZ(), 1e10);
  key(m, 'RUN_STOP');
  assert.equal(m.view().value, 0); assert.equal(m.view().rangeLabel, 'Auto 100mV');
});

test('Stopped manual range changes preserve the captured reading unit across SI prefixes and display edits', () => {
  const m = new DmmModel(); m.setFn('DCI'); m.setFixture('dci');
  key(m, 'RUN_STOP');
  const before = m.view();
  assert.equal(before.unit, 'mADC'); assert.equal(before.rangeLabel, 'Auto 100mA');
  key(m, 'RANGE_UP');
  const after = m.view();
  assert.equal(after.rangeLabel, 'Manual 1A'); assert.equal(m.currentShunt(), CURRENT_SHUNT[4]);
  assert.equal(after.unit, before.unit); assert.equal(after.text, before.text); assert.equal(after.value, before.value);
  key(m, 'NULL');
  assert.equal(m.view().value, 0); assert.equal(m.view().unit, 'mADC');
  key(m, 'NULL');
  assert.equal(m.view().value, before.value); assert.equal(m.view().unit, before.unit);
  key(m, 'RUN_STOP');
  assert.equal(m.view().unit, 'ADC'); assert.equal(m.view().value, before.value);
});

test('Range changes during Single show the active range while retaining the prior sample until completion', () => {
  let now = 10; const m = new DmmModel(); m.now = () => now;
  key(m, 'SINGLE');
  const captured = m.reading();
  key(m, 'RANGE_UP');
  assert.equal(m.run, 'single'); assert.equal(m.view().rangeLabel, 'Manual 100V');
  assert.deepEqual(m.reading(), captured);
  now += m.apertureSeconds() + 1e-6;
  assert.equal(m.view().rangeLabel, 'Manual 100V'); assert.equal(m.run, 'stop');
  assert.equal(m.held.idx, 3); assert.equal(m.view().text, '+001.234 0');
});
