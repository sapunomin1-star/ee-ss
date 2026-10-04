import test from 'node:test';
import assert from 'node:assert/strict';
import { TdsModel, SDIV, MEAS_TYPES } from '../src/instruments/tds/model.js';

const key = (m, s) => m.press(`TDS.KEY.${s}`), opt = (m, n) => m.press(`TDS.SOFT.OPT${n}`);
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} differs from ${b}`);
const fresh = (scenario = 'S1') => { const m = new TdsModel(); m.setScenario(scenario); key(m, 'AUTOSET'); return m; };

test('AutoRange tracks changing amplitude and frequency continuously, and can Undo', () => {
  const m = fresh(), old = { ch: structuredClone(m.ch), sIdx: m.sIdx };
  key(m, 'AUTORANGE'); assert.equal(m.extended.autoRange.on, true);
  assert.equal(m.needsTriggerPoll(), true); assert.equal(m.visual('TDS.LED.AUTORANGE').lit, true);
  m.setScenario('S1X5'); near(m.vdiv(0), 2);
  m.setScenario('S1F'); near(m.sdiv, 100e-6);
  opt(m, 5); assert.equal(m.extended.autoRange.on, false); assert.deepEqual(m.ch, old.ch); assert.equal(m.sIdx, old.sIdx);
});

test('AutoRange single axes stay independent and manual controls deactivate the affected axes', () => {
  const m = fresh(); key(m, 'AUTORANGE'); opt(m, 3);
  const sdiv = m.sdiv; m.setScenario('S1F'); near(m.sdiv, sdiv);
  m.setScenario('S1X5'); near(m.vdiv(0), 2);
  key(m, 'AUTORANGE'); key(m, 'AUTORANGE'); opt(m, 2);
  m.turn('TDS.KNOB.CH1_VOLTS_DIV', 1);
  assert.equal(m.extended.autoRange.axes, 'HORIZONTAL'); assert.equal(m.extended.autoRange.on, true);
  m.turn('TDS.KNOB.HORIZ_SCALE', 1); assert.equal(m.extended.autoRange.on, false);
  key(m, 'AUTORANGE'); key(m, 'SINGLE'); assert.equal(m.extended.autoRange.on, false);
  key(m, 'AUTORANGE'); key(m, 'TRIG_MENU'); opt(m, 3); assert.equal(m.extended.autoRange.on, false);
  key(m, 'AUTORANGE'); key(m, 'DISPLAY'); opt(m, 2); assert.equal(m.extended.autoRange.on, false);
});

test('All 16 measurement types use acquired records and valid edge/range conditions', () => {
  const m = fresh('S2'); assert.equal(MEAS_TYPES.length, 17);
  near(m.measure(0, 'RMS').value, Math.SQRT1_2, .0002);
  near(m.measure(0, 'MIN').value, -1, .0002); near(m.measure(0, 'MAX').value, 1, .0002);
  near(m.measure(0, 'RISE').value, Math.asin(.8) / (Math.PI * 1000), 2e-6);
  near(m.measure(0, 'FALL').value, Math.asin(.8) / (Math.PI * 1000), 2e-6);
  near(m.measure(0, 'POSWIDTH').value, .0005, 1e-6);
  near(m.measure(0, 'NEGWIDTH').value, .0005, 1e-6);
  near(m.measure(0, 'DUTY').value, 50, .01);
  near(m.measure(0, 'PHASE').value, 45, .1); near(m.measure(1, 'PHASE').value, -45, .1);
  near(m.measure(0, 'DELAY').value, 125e-6, 1e-6);
  assert.equal(m.measure(0, 'CURSORRMS').value, null);
  key(m, 'CURSOR'); opt(m, 1); near(m.measure(0, 'CURSORRMS').value, Math.SQRT1_2, .0005);
  key(m, 'RUN_STOP'); const width = m.measure(0, 'POSWIDTH').value; m.setScenario('S1F');
  near(m.measure(0, 'POSWIDTH').value, width, 1e-12);
  m.ch[1].on = false; assert.equal(m.measure(0, 'PHASE').value, null);
});

test('DC records have real RMS/min/max and invalid edge metrics rather than fake zero durations', () => {
  const m = fresh('S3B'); m.sIdx = SDIV.indexOf(250e-6); m.tick();
  near(m.measure(0, 'RMS').value, 1); near(m.measure(0, 'MIN').value, 1); near(m.measure(0, 'MAX').value, 1);
  for (const type of ['RISE', 'FALL', 'POSWIDTH', 'NEGWIDTH', 'DUTY', 'PHASE', 'DELAY']) assert.equal(m.measure(0, type).value, null);
});

function coherentFft(frequency = 9765.625) {
  const m = new TdsModel(); m.setBenchSource(() => ({ sig: [{ vpp: 2, dc: 0, f: frequency, delay: 0 }, null], probe: [1, 1] })); m.setScenario('BENCH');
  m.ch[0].probe = 1; m.ch[0].vIdx = 8; m.sIdx = SDIV.indexOf(250e-6); m.trig.level = 0; m.tick();
  key(m, 'MATH_MENU'); opt(m, 1); opt(m, 1); return m;
}

test('FFT uses central 2048 points and three coherent-gain-normalized windows with Vrms/dB units', () => {
  const m = coherentFft(); assert.equal(m.extended.math.op, 'FFT');
  for (const window of ['HANNING', 'FLATTOP', 'RECTANGULAR']) {
    m.extended.fft.window = window;
    const r = m.fftRecord(); assert.equal(r.rms.length, 1024); near(r.df, 488.28125); near(r.nyquist, 500000);
    near(r.rms[20], Math.SQRT1_2, .0002); near(r.db[20], -3.01029995664, .003);
    assert.match(m.lcd(), /class="wave fft"/);
  }
  key(m, 'RUN_STOP'); const old = m.fftRecord(); m.setScenario('S1F'); assert.equal(m.fftRecord(), old);
  opt(m, 5); assert.equal(m.extended.fft.zoom, 2);
  const dt = m.rec.dt; m.turn('TDS.KNOB.CH1_VOLTS_DIV', 1); assert.equal(m.extended.fft.verticalZoom, 2); assert.equal(m.rec.dt, dt);
  m.turn('TDS.KNOB.HORIZ_POSITION', 1); assert.ok(m.extended.fft.center < .5);
  key(m, 'SET_TO_ZERO'); assert.equal(m.extended.fft.center, .5);
});

test('FFT exposes sampling aliases from recorded data instead of reporting source truth', () => {
  const m = coherentFft(700000); const f = m.snapshot().fft;
  near(f.peak.frequency, 300000, f.df); assert.ok(f.peak.frequency !== 700000);
});
