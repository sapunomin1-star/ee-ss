import test from 'node:test';
import assert from 'node:assert/strict';
import { TdsModel, SDIV, extendedDefaults, N } from '../src/instruments/tds/model.js';

const press = (m, key) => m.press(`TDS.KEY.${key}`);
const opt = (m, n) => m.press(`TDS.SOFT.OPT${n}`);
const fresh = (scenario = 'S1') => { const m = new TdsModel(); m.setScenario(scenario); press(m, 'AUTOSET'); return m; };
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} differs from ${b}`);

test('Invert reverses displayed voltage, Mean and cursor readings without changing the trigger', () => {
  const m = fresh(), mean = m.measure(0, 'MEAN').value, trigger = m.levelV();
  press(m, 'RUN_STOP'); const r = m.rec;
  press(m, 'CH1_MENU'); opt(m, 5);
  assert.equal(m.extended.invert[0], true);
  near(m.measure(0, 'MEAN').value, -mean);
  near(m.levelV(), trigger);
  near(m.sampleAt(0, 0), -0.5, 0.002);
  assert.equal(m.rec, r, 'inversion works on the frozen record');
  assert.match(m.lcd(), /Invert/);
  opt(m, 5); near(m.measure(0, 'MEAN').value, mean);
});

test('Math has physical probe-scaled sums, both subtraction orders and voltage products', () => {
  const m = fresh('S2'); press(m, 'RUN_STOP'); press(m, 'MATH_MENU');
  const stat = () => m.mathStats();
  near(stat().max - stat().min, 4 * Math.sin(Math.PI / 8), 0.003);
  opt(m, 2); const reverse = stat();
  near(reverse.max, -(-2 * Math.sin(Math.PI / 8)), 0.003);
  opt(m, 1); assert.equal(m.extended.math.op, '×');
  // Average over five full cycles instead of relying on a partial-cycle mean.
  m.sIdx = SDIV.indexOf(500e-6); m.run = 'run'; m.tick(); m.run = 'stop';
  near(stat().mean, Math.cos(Math.PI / 4) / 2, 0.002);
  opt(m, 1); assert.equal(m.extended.math.op, 'FFT'); opt(m, 1); assert.equal(m.extended.math.op, '+');
  near(stat().max - stat().min, 4 * Math.cos(Math.PI / 8), 0.003);
  assert.match(m.lcd(), /class="wave math"/);
  const saved = m.mathRecord(); m.setScenario('S1F');
  assert.deepEqual(m.mathRecord(), saved, 'new inputs cannot change frozen Math');
  opt(m, 3); m.turn('TDS.KNOB.MULTIPURPOSE', 1); near(m.extended.math.pos, 0.04);
  opt(m, 4); m.turn('TDS.KNOB.MULTIPURPOSE', 1); near(m.extended.math.scale, 1);
  press(m, 'MATH_MENU'); assert.equal(m.mathRecord(), null);
});

test('Display Dots uses sample points and XY runs untriggered at 1MS/s with restricted controls', () => {
  const m = fresh('S2'); press(m, 'DISPLAY'); opt(m, 1);
  assert.match(m.lcd(), /class="wave ch1 dots"/);
  opt(m, 3);
  assert.equal(m.extended.display.format, 'XY'); near(m.rec.dt, 1e-6, 1e-12);
  assert.equal(m.rec.triggered, false); assert.match(m.lcd(), /class="wave xy"/);
  assert.equal(m.measure(0, 'PKPK').value, null); assert.equal(m.cursorInfo(), null);
  const state = [m.sIdx, m.mpos, m.trig.level];
  m.turn('TDS.KNOB.HORIZ_SCALE', 1); m.turn('TDS.KNOB.HORIZ_POSITION', 1); m.turn('TDS.KNOB.TRIG_LEVEL', 1);
  assert.deepEqual([m.sIdx, m.mpos, m.trig.level], state);
  press(m, 'AUTOSET'); assert.equal(m.extended.display.format, 'YT');
});

test('Stopped XY displays the original frozen record instead of resampling it', () => {
  const m = fresh('S2'); press(m, 'RUN_STOP'); const r = m.rec;
  press(m, 'DISPLAY'); opt(m, 3);
  assert.equal(m.rec, r); near(m.rec.dt, 1e-6, 1e-12);
  // Original dt was also 1us; zoom before switching must still preserve it.
  opt(m, 3); m.sIdx = SDIV.indexOf(50e-6); opt(m, 3);
  assert.equal(m.rec, r); assert.match(m.lcd(), /class="wave xy"/);
});

test('Average Single needs 4/16/64/128 real acquisitions and resets on new settings', () => {
  for (const n of [4, 16, 64, 128]) {
    const m = fresh(); press(m, 'ACQUIRE'); opt(m, 3);
    m.extended.averages = n; press(m, 'SINGLE');
    assert.equal(m.run, 'single'); assert.equal(m.rec.averageCount, 1);
    assert.equal(m.needsTriggerPoll(), true);
    for (let j = 1; j < n - 1; j++) m.inputChanged();
    assert.equal(m.run, 'single'); m.inputChanged();
    assert.equal(m.run, 'stop'); assert.equal(m.complete, true); assert.equal(m.rec.averageCount, n);
    near(m.measure(0, 'PKPK').value, 2, 0.003);
    assert.equal(m.needsTriggerPoll(), false);
  }
});

test('Average combines differing acquired voltages rather than merely labelling Sample', () => {
  const m = fresh(); m.extended.acquire = 'AVERAGE'; m.extended.averages = 4; m.clearAcquisition();
  const record = (v, n) => ({ n, t0: 0, dt: 1e-6, v: [new Float64Array(N).fill(v), null], fe: [null, null], clip: [false, false], triggered: true, abs0: null });
  for (let j = 1; j <= 4; j++) m.publish(record(j, j));
  near(m.rec.v[0][1250], 2.5); assert.equal(m.rec.averageCount, 4);
  press(m, 'ACQUIRE'); opt(m, 1); assert.equal(m.extended.acquire, 'SAMPLE');
  assert.equal(m.avgState, null);
});

test('Peak Detect finds narrow table glitches, uses 1250 min/max intervals, and falls back at fast scales', () => {
  const table = new Float64Array(4000); table.fill(1, 0, 4);
  const m = new TdsModel(); m.setBenchSource(() => ({ sig: [{ table, period: 1e-3 }, null], probe: [1, 1] })); m.setScenario('BENCH');
  m.ch[0].probe = 1; m.ch[0].vIdx = 8; m.sIdx = SDIV.indexOf(5e-3); m.trig.mode = 'NORMAL'; m.trig.level = 0.5;
  m.extended.acquire = 'PEAK'; m.tick();
  assert.equal(m.rec.mode, 'PEAK'); assert.equal(m.rec.v[0].length, 2500);
  assert.equal(Math.max(...m.rec.v[0]), 1); assert.equal(Math.min(...m.rec.v[0]), 0);
  near(m.measure(0, 'PKPK').value, 1);
  assert.equal(m.measure(0, 'FREQ').value, null, 'an extrema envelope cannot report a fabricated frequency');
  m.sIdx = SDIV.indexOf(2.5e-3); m.tick(); assert.equal(m.rec.mode, undefined);
});

test('Timed persistence expires and Infinite retains old pixels until a control changes', () => {
  const m = fresh(); let t = 0; m.displayNow = () => t;
  press(m, 'DISPLAY'); opt(m, 2); assert.equal(m.extended.display.persist, 1);
  m.tick(); assert.ok(m.persistence.length > 0);
  t = 1.01; m.tick(); assert.equal(m.persistence.length, 1, 'only the immediately previous record remains');
  opt(m, 2); opt(m, 2); opt(m, 2); assert.equal(m.extended.display.persist, 'INFINITE');
  m.tick(); assert.ok(m.persistPixels.size > 0); assert.match(m.lcd(), /class="persistence"/);
  press(m, 'RUN_STOP'); press(m, 'CURSOR'); assert.equal(m.persistPixels.size, 0);
});

test('Save/Recall keeps ten independent setup slots and Reference waveform scales remain frozen', () => {
  const m = fresh(); press(m, 'SAVE_RECALL'); opt(m, 5);
  assert.equal(m.savedSetups[0].sIdx, SDIV.indexOf(250e-6));
  m.ch[0].probe = 100; m.sIdx = SDIV.indexOf(5e-6);
  opt(m, 1); opt(m, 1); assert.equal(m.extended.store.action, 'RECALL_SETUP'); opt(m, 5);
  assert.equal(m.ch[0].probe, 10); assert.equal(m.sIdx, SDIV.indexOf(250e-6));
  press(m, 'SAVE_RECALL'); opt(m, 1); assert.equal(m.extended.store.action, 'SAVE_WAVEFORM'); opt(m, 5);
  const saved = structuredClone(m.references[0]); press(m, 'REF'); opt(m, 1);
  const shape = () => m.lcd().match(/class="wave ref0" points="([^"]+)"/)[1];
  const before = shape(); m.turn('TDS.KNOB.CH1_VOLTS_DIV', 1); m.turn('TDS.KNOB.HORIZ_SCALE', 1);
  assert.equal(shape(), before); assert.deepEqual(m.references[0], saved);
  assert.match(m.lcd(), /rd-ref0/); opt(m, 1); assert.doesNotMatch(m.lcd(), /class="wave ref0"/);
});

test('Empty setup or undisplayed waveform cannot fake a successful save/recall', () => {
  const m = fresh(); press(m, 'SAVE_RECALL'); opt(m, 1); opt(m, 1); opt(m, 3);
  const old = m.sIdx, hint = opt(m, 5); assert.equal(hint.kind, 'info'); assert.equal(m.sIdx, old);
  opt(m, 1); opt(m, 1); opt(m, 3); opt(m, 5); assert.equal(m.references[0], null);
  assert.deepEqual(new TdsModel().extended, extendedDefaults());
});
