import test from 'node:test';
import assert from 'node:assert/strict';
import { DmmModel, frequencyOf, temperatureOf, validateSettings } from '../src/instruments/dmm/model.js';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
import { Breadboard } from '../src/bench/breadboard.js';
const key = (m, id) => m.press(/^S[1-6]$/.test(id) ? `DMM.SOFT.${id}` : `DMM.KEY.${id}`);
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} versus ${b}`);
function bench(signal) {
  const m = new DmmModel(); m.fixture = 'bench';
  m.setBenchSource(() => ({ v: signal, i: null, ohm: null, why: '' })); return m;
}

test('Frequency/Period use terminal crossings, and never copy a DC source frequency hint', () => {
  const v = { now: 1, freq: 1000, ac: 1, peak: 2, peakAc: 2, meanOver: () => 0,
    at: (t) => 3 + Math.sin(2 * Math.PI * 2000 * t) };
  const m = bench(v); key(m, 'FREQ');
  near(m.view().value, 2000); assert.match(m.view().unit, /Hz$/);
  key(m, 'S1'); assert.equal(m.fn, 'PER'); near(m.view().value, 0.0005, 1e-12);
  v.at = () => 5; assert.equal(m.view().state, 'none');
  v.at = (t) => 5 * (1 - Math.exp(-t)); assert.equal(m.view().state, 'none');
});

test('Frequency supports the 3 Hz and 300 kHz boundaries and rejects outside bandwidth', () => {
  for (const f of [3, 10, 1000, 300000]) {
    const s = { now: 2, freq: f, at: (t) => Math.sin(2 * Math.PI * f * t) };
    near(frequencyOf(s), f, f * 1e-7);
  }
  assert.equal(frequencyOf({ now: 2, freq: 1, at: (t) => Math.sin(2 * Math.PI * t) }), null);
  assert.equal(frequencyOf({ now: 2, freq: 1e6, at: (t) => Math.sin(2e6 * Math.PI * t) }), null);
});

test('Frequency resolves the actual carrier inside a slow AM envelope and rejects noise/work beyond its sampling limit', () => {
  const signal = { now: 1, freq: 1, carrierFreq: 1000, maxFreq: 1001,
    at: (t) => Math.sin(2 * Math.PI * 1000 * t) * (1 + .5 * Math.sin(2 * Math.PI * t)) };
  near(frequencyOf(signal), 1000, .002);
  signal.noise = true; assert.equal(frequencyOf(signal), null); signal.noise = false;
  signal.carrierFreq = 1; signal.maxFreq = 1e6; assert.equal(frequencyOf(signal), null);
});

test('NPLC changes the real DC integration window and display resolution', () => {
  const windows = [];
  const s = { now: 1, ac: 0, peak: 2, peakAc: 0, dc: 1, freq: 0,
    meanOver: (a, b) => { windows.push([a, b]); return (a + b) / 2; }, at: (t) => t };
  const m = bench(s); m.setNplc(1);
  near(m.apertureSeconds(), 1 / 60, 1e-14);
  near(m.view().value, 1 - 1 / 120);
  const [a, b] = windows.at(-1); near(b - a, 1 / 60, 1e-14);
  const longText = m.view().text; m.setNplc(0.02);
  assert.ok(m.view().text.replace(/\D/g, '').length < longText.replace(/\D/g, '').length);
  assert.equal(m.setNplc(0.06).kind, 'reject');
});

test('Aperture menu arrows select only 34460A NPLC values and Select closes the menu', () => {
  const m = new DmmModel(); key(m, 'S2'); assert.equal(m.menu, 'NPLC');
  key(m, 'DOWN'); assert.equal(m.nplc, 1);
  key(m, 'DOWN'); assert.equal(m.nplc, 0.2);
  key(m, 'DOWN'); key(m, 'DOWN'); assert.equal(m.nplc, 0.02);
  key(m, 'SELECT'); assert.equal(m.menu, null);
});

test('Run/Stop freezes a completed reading across input changes and resumes live measurement', () => {
  const m = new DmmModel(); m.fixture = 'dcv'; key(m, 'RUN_STOP');
  assert.equal(m.run, 'stop'); const old = m.view().value;
  m.setFixture('acv'); assert.equal(m.view().value, old);
  key(m, 'RUN_STOP'); assert.equal(m.run, 'run'); assert.equal(m.view().value, 0);
});

test('Single waits for the real aperture, integrates only after its trigger, then freezes', () => {
  const windows = [];
  const s = { now: 10, ac: 0, dc: 10, peak: 20, peakAc: 0, freq: 0,
    meanOver: (a, b) => { windows.push([a, b]); return (a + b) / 2; }, at: (t) => t };
  const m = bench(s); m.setNplc(1); key(m, 'SINGLE');
  const old = m.view().value; assert.equal(m.run, 'single'); assert.equal(m.isLive(), true);
  s.now = 10.01; assert.equal(m.view().value, old); assert.equal(m.run, 'single');
  assert.ok(windows.every(([, b]) => b <= 10.01));
  s.now = 10.02; near(m.view().value, 10 + 1 / 120, 1e-9); assert.equal(m.run, 'stop');
  const [a, b] = windows.at(-1); near(a, 10, 1e-12); near(b, 10 + 1 / 60, 1e-12);
  s.now = 20; near(m.view().value, 10 + 1 / 120, 1e-9);
});

test('Single without an input retains none and Run/Stop cancels a pending acquisition', () => {
  let t = 10; const m = new DmmModel(); m.fixture = 'none'; m.now = () => t;
  key(m, 'SINGLE'); t += 1; assert.equal(m.view().state, 'none'); assert.equal(m.run, 'stop');
  key(m, 'SINGLE'); key(m, 'RUN_STOP'); assert.equal(m.run, 'stop'); assert.equal(m.pending, null);
});

test('Input Z Auto selects high impedance only on the three low DCV ranges without reading its source', () => {
  const m = new DmmModel(); key(m, 'S4'); assert.equal(m.inputZMode, 'AUTO');
  m.setBenchSource(() => { throw new Error('inputZ must not recurse into Bench'); });
  for (let idx = 0; idx < 5; idx++) { m.st.idx = idx; assert.equal(m.inputZ(), idx < 3 ? 1e10 : 1e7); }
  key(m, 'ACV'); assert.equal(m.inputZ(), 1e6);
});

test('Display offers a real bar meter from the measured value, and Histogram only graphs actual readings', () => {
  const m = new DmmModel(); key(m, 'DISPLAY'); key(m, 'S1'); key(m, 'S2');
  assert.equal(m.displayMode, 'BAR'); assert.match(m.lcd(), /data-dmm-bar/);
  m.fixture = 'none'; assert.doesNotMatch(m.lcd(), /data-dmm-bar/);
  key(m, 'DISPLAY'); key(m, 'S1'); key(m, 'S4'); assert.equal(m.displayMode, 'HIST');
  assert.equal(m.view().histogram.total, m.readings.length); assert.match(m.lcd(), /data-dmm-bin/);
});

test('Four-wire resistance needs four real leads, removes lead resistance and preserves Sense polarity', () => {
  const m = createInstruments(), b = new Bench(m.afg, m.dmm, m.gpe), bb = new Breadboard();
  b.now = () => 1; b.bb = bb; b.board = 'bb'; m.afg.ch.forEach((c) => c.output = false);
  bb.add('R', 'a1', 'a2', 10); bb.add('R', 'b2', 'a3', 100); bb.add('R', 'b3', 'a4', 20);
  b.bbWires = { 'DMM.HI': 'b1', 'DMM.LO': 'b4', 'DMM.SHI': 'c2', 'DMM.SLO': 'c3' };
  m.dmm.fixture = 'bench'; m.dmm.setBenchSource(() => b.dmmInput());
  m.dmm.setFn('OHM'); near(m.dmm.view().value, 130);
  key(m.dmm, 'SHIFT'); key(m.dmm, 'OHM_2W'); near(m.dmm.view().value, 100);
  delete b.bbWires['DMM.SLO']; assert.equal(m.dmm.view().state, 'none'); assert.match(m.dmm.compatNote(), /四條/);
  b.bbWires['DMM.SLO'] = 'c2'; b.bbWires['DMM.SHI'] = 'c3'; near(m.dmm.view().value, -100);
});

test('Capacitance comes from the passive circuit, rejects powered inputs, and manual range does not impose 120%', () => {
  const m = createInstruments(), b = new Bench(m.afg, m.dmm, m.gpe); b.now = () => 1;
  m.afg.ch.forEach((c) => c.output = false); b.wires = { 'DMM.HI': 'B', 'DMM.LO': 'G' };
  m.dmm.fixture = 'bench'; m.dmm.setBenchSource(() => b.dmmInput());
  key(m.dmm, 'SHIFT'); key(m.dmm, 'FREQ'); near(m.dmm.view().value, b.C, 1e-15);
  m.dmm.st.auto = false; m.dmm.st.idx = 0; assert.equal(m.dmm.view().state, 'value');
  b.wires['GPE.CH1+'] = 'B'; b.wires['GPE.CH1-'] = 'G'; m.gpe.on = true; m.gpe.output = true;
  assert.equal(m.dmm.view().state, 'none'); assert.match(m.dmm.compatNote(), /關閉/);
  m.dmm.fixture = 'none'; assert.equal(m.dmm.view().state, 'none');
});

test('Temperature inverts PT100 curves on both sides of zero, and supports 44007 and units without invented inputs', () => {
  for (const t of [-200, -100, 0, 25, 100, 600]) {
    const r = 100 * (1 + 3.9083e-3 * t - 5.775e-7 * t * t + (t < 0 ? -4.183e-12 * (t - 100) * t ** 3 : 0));
    near(temperatureOf(r), t, 1e-8);
  }
  assert.equal(temperatureOf(100, 'PT100', 200), null); assert.equal(temperatureOf(-1), null);
  const m = new DmmModel(); m.fixture = 'pt100'; key(m, 'TEMP'); near(m.view().value, 25);
  key(m, 'S5'); near(m.view().value, 77); assert.equal(m.view().unit, '°F');
  key(m, 'S5'); near(m.view().value, 298.15); assert.equal(m.view().unit, 'K');
  m.fixture = 'thermistor'; assert.equal(m.view().state, 'none');
  m.tempSensor = 'THERMISTOR'; m.tempUnit = 'C'; near(m.view().value, temperatureOf(5000, 'THERMISTOR'));
  m.fixture = 'none'; assert.equal(m.view().state, 'none');
});

test('Temperature four-wire uses Sense result and never substitutes a two-wire resistance', () => {
  const m = bench({ now: 1 }); m.setBenchSource(() => ({ ohm: 119.73465625, ohm4: null, why4: '缺Sense線' }));
  m.setFn('TEMP'); assert.equal(m.view().state, 'none'); assert.match(m.compatNote(), /Sense/);
  m.tempWire = 2; assert.ok(m.view().value > 25);
  m.setBenchSource(() => ({ ohm: 119.73465625, ohm4: 109.73465625 })); m.tempWire = 4; near(m.view().value, 25);
});

test('Diode is restricted to a diode fixture, OPEN over 5 V, and Beeper toggles the indication', () => {
  const m = new DmmModel(); m.fixture = 'diode'; key(m, 'SHIFT'); key(m, 'CONT');
  assert.equal(m.fn, 'DIODE'); near(m.view().value, .65); assert.equal(m.view().beep, true);
  key(m, 'S1'); assert.equal(m.view().beep, false);
  m.setFixture('diode-open'); assert.equal(m.view().state, 'open');
  m.setFixture('r1k'); assert.equal(m.view().state, 'none');
  m.fixture = 'bench'; m.setBenchSource(() => ({ ohm: 650, v: { dc: .65, ac: 0 } })); assert.equal(m.view().state, 'none');
});

test('DCV Ratio requires a separate nonzero reference with both Sense voltages in ±12 V', () => {
  const signal = { now: 1, peak: 4, ac: 0, meanOver: () => 4 };
  const m = bench(signal); let ref = null;
  m.setBenchSource(() => ({ v: signal, ref })); key(m, 'S5'); assert.equal(m.view().state, 'none');
  ref = { hi: 3, lo: 1, valid: true }; near(m.view().value, 2); assert.equal(m.view().unit, 'V/V');
  assert.equal(key(m, 'NULL').kind, 'reject'); near(m.view().value, 2); assert.equal(m.st.nullOn, false);
  key(m, 'SHIFT'); key(m, 'NULL'); assert.equal(key(m, 'S5').kind, 'reject'); assert.equal(m.menu, 'MATH');
  assert.equal(validateSettings({ ratioOn: true, per: m.per }), null);
  m.st.nullOn = true; m.st.base = 1;
  assert.match(validateSettings({ ratioOn: true, per: m.per }), /Ratio.*Null/); near(m.view().value, 2); assert.equal(m.view().nullOn, false);
  m.st.nullOn = false; m.menu = null;
  ref = { hi: 13, lo: 11, valid: true }; assert.equal(m.view().state, 'none');
  ref = { hi: 2, lo: 2, valid: true }; assert.equal(m.view().state, 'none');
  m.setBenchSource(() => { throw new Error('senseInputZ must not call Bench'); }); assert.equal(m.senseInputZ(), 1e10);
});

test('dBm and dB use measured voltage and selected reference resistance, and function changes turn scaling off', () => {
  const m = new DmmModel(); m.fixture = 'dcv'; key(m, 'SHIFT'); key(m, 'NULL'); key(m, 'S2'); key(m, 'S2');
  assert.equal(m.dbMode, 'DBM'); near(m.view().value, 10 * Math.log10(1.234 ** 2 / 600 / .001)); assert.equal(m.view().unit, 'dBm');
  key(m, 'S4'); key(m, 'S2'); near(m.view().value, 0); assert.equal(m.view().unit, 'dB');
  key(m, 'S5'); key(m, 'UP'); assert.equal(m.dbResistance, 800);
  key(m, 'ACV'); assert.equal(m.dbMode, 'OFF');
});

test('Single acquires configured samples in separate post-delay integration windows and only one series can queue', () => {
  let t = 10; const windows = [], s = { get now() { return t; }, peak: 10, ac: 0, meanOver: (a, b) => { windows.push([a, b]); return (a + b) / 2; } };
  const m = bench(s); m.nplc = 1; m.sampleCount = 3; m.triggerDelay = .1;
  key(m, 'SINGLE'); key(m, 'SINGLE'); key(m, 'SINGLE'); assert.equal(m.pending.queued, true);
  m.clearReadings(); windows.length = 0; t = 10.71; m.view();
  assert.equal(m.run, 'stop'); assert.equal(m.readings.length, 6);
  windows.filter(([, b]) => b > 10.1).forEach(([a, b]) => near(b - a, 1 / 60, 1e-12));
  near(m.readings[0].time, 10.1 + 1 / 60, 1e-12); near(m.readings[5].time, 10.7, 1e-10);
});

test('Read memory is deduplicated per acquisition, bounded at 1,000, and histogram/statistics/limits use it', () => {
  let t = 1, value = 0; const s = { get now() { return t; }, peak: 2, ac: 0, meanOver: () => value };
  const m = bench(s); m.limitsOn = true; m.statsOn = true; m.limitLow = -.5; m.limitHigh = .5;
  m.view(); m.view(); assert.equal(m.readings.length, 1);
  for (const [v, at] of [[1, 2], [-1, 3]]) { value = v; t = at; m.view(); }
  const stats = m.view().stats; assert.equal(stats.count, 3); near(stats.mean, 0); assert.equal(stats.min, -1); assert.equal(stats.max, 1);
  assert.deepEqual(m.limitFailures, { low: 1, high: 1 }); assert.match(m.lcd(), /data-dmm-limit/);
  m.displayMode = 'HIST'; assert.equal(m.histogram().counts.reduce((a, b) => a + b, 0), 3);
  m.histAuto = false; m.histLow = -.5; m.histHigh = .5; m.histOuter = true; const h = m.histogram(); assert.equal(h.under, 1); assert.equal(h.over, 1);
  for (let i = 0; i < 1010; i++) { t++; m.view(); } assert.equal(m.readings.length, 1000);
  const csv = m.downloadReadings().download; assert.match(csv.text, /^time_s,function,value,unit\n/); assert.equal(csv.text.trim().split('\n').length, 1001);
});

test('Probe Hold captures only a stable sequence, supports different functions, and restores display settings', () => {
  let t = 0; const m = new DmmModel(); m.now = () => t; m.displayMode = 'BAR'; m.statsOn = true;
  key(m, 'SHIFT'); key(m, 'SINGLE'); assert.equal(m.probeHold, true); assert.equal(m.statsOn, false);
  for (const at of [0, .2, .4]) { t = at; m.view(); } assert.equal(m.probeEntries.length, 0);
  t = .6; m.view(); assert.equal(m.probeEntries.length, 1);
  t = 1; m.view(); assert.equal(m.probeEntries.length, 1);
  m.fixture = 'r1k'; m.setFn('OHM');
  for (const at of [1.1, 1.3, 1.5, 1.7]) { t = at; m.view(); } assert.equal(m.probeEntries.length, 2);
  assert.match(m.lcd(), /Probe Hold/); key(m, 'SHIFT'); key(m, 'SINGLE'); assert.equal(m.displayMode, 'BAR'); assert.equal(m.statsOn, true);
});

test('Store/Recall keeps one real settings slot; pure validation rejects forged settings/accessors and allows legacy subsets', () => {
  const m = new DmmModel(); key(m, 'SHIFT'); key(m, 'DISPLAY'); key(m, 'S1'); key(m, 'S1');
  m.setNplc(1); m.setFn('ACV'); key(m, 'SHIFT'); key(m, 'DISPLAY'); key(m, 'S1'); key(m, 'S2');
  assert.equal(m.fn, 'DCV'); assert.equal(m.nplc, 10); assert.equal(m.run, 'run'); assert.equal(m.readings.length, 0);
  assert.equal(validateSettings(m.measurementState()), null); assert.equal(validateSettings({ nplc: 1 }), null);
  for (const value of [{ tempR0: 200 }, { sampleCount: 1.5 }, { histLow: 2, histHigh: 1 }, { limitLow: 2, limitHigh: 1 }, { dbResistance: 777 }, { unexpected: true }]) assert.ok(validateSettings(value));
  const accessor = Object.defineProperty({}, 'nplc', { enumerable: true, get() { throw new Error('must not invoke'); } }); assert.match(validateSettings(accessor), /accessor/);
});

test('Temp Null preserves temperature differences across °C/°F/K; dB Null keeps a voltage baseline and a zero logarithm is invalid', () => {
  const m = new DmmModel(); m.fixture = 'pt100'; m.setFn('TEMP'); key(m, 'NULL');
  for (let i = 0; i < 3; i++) { near(m.view().value, 0); key(m, 'S5'); }
  m.fixture = 'bench'; m.setBenchSource(() => ({ ohm4: 138.5055 })); near(m.view().value, 75);
  key(m, 'S5'); near(m.view().value, 135); key(m, 'S5'); near(m.view().value, 75);
  m.fixture = 'dcv'; m.setFn('DCV'); m.dbMode = 'DBM';
  const h = key(m, 'NULL'); near(m.st.base, 1.234); assert.equal(m.view().state, 'over'); assert.match(h.text, /基準是電壓/);
  key(m, 'NULL'); near(m.view().value, 10 * Math.log10(1.234 ** 2 / 600 / .001));
});

test('Front panel Reset keeps fixture and live Bench callbacks attached', () => {
  const m = bench({ now: 1, ac: 0, peak: 2, meanOver: () => 1.234 }); const source = m.benchSource;
  m.setFn('ACV'); key(m, 'SHIFT'); key(m, 'RUN_STOP');
  assert.equal(m.fixture, 'bench'); assert.equal(m.benchSource, source); assert.equal(m.fn, 'DCV'); near(m.view().value, 1.234);
});

test('Stopped temperature and dB readings reformat from the frozen raw value when units or Null change', () => {
  const m = new DmmModel(); m.fixture = 'pt100'; m.setFn('TEMP'); key(m, 'RUN_STOP');
  m.fixture = 'bench'; m.setBenchSource(() => ({ ohm4: 138.5055 }));
  key(m, 'S5'); near(m.view().value, 77); key(m, 'NULL'); near(m.view().value, 0);
  key(m, 'S5'); near(m.view().value, 0); key(m, 'NULL'); near(m.view().value, 298.15);
  m.fixture = 'dcv'; m.setFn('DCV'); key(m, 'RUN_STOP');
  key(m, 'SHIFT'); key(m, 'NULL'); key(m, 'S2'); key(m, 'S2');
  near(m.view().value, 10 * Math.log10(1.234 ** 2 / 600 / .001)); assert.equal(m.view().unit, 'dBm');
  m.fixture = 'ratio'; m.menu = null; key(m, 'NULL'); near(m.st.base, 1.234); assert.equal(m.view().state, 'over');
  key(m, 'NULL'); near(m.view().value, 10 * Math.log10(1.234 ** 2 / 600 / .001));
});

test('Null Value edits use the chosen temperature unit and dB Measure Ref uses the same linear Null result', () => {
  const m = new DmmModel(); m.fixture = 'pt100'; m.setFn('TEMP'); key(m, 'NULL'); key(m, 'S5');
  key(m, 'SHIFT'); key(m, 'NULL'); key(m, 'S5'); near(m.view().edit.value, 77);
  assert.match(m.view().edit.label, /°F/); key(m, 'UP'); near(m.st.base, 25 + .001 / 1.8); near(m.view().value, -.001);
  m.fixture = 'dcv'; m.setFn('DCV'); m.st.nullOn = true; m.st.base = .234;
  key(m, 'SHIFT'); key(m, 'NULL'); key(m, 'S2'); key(m, 'S1'); key(m, 'S4');
  near(m.dbRef, 10 * Math.log10(1 / 600 / .001)); near(m.view().value, 0);
  key(m, 'SELECT'); key(m, 'RUN_STOP'); m.fixture = 'ratio';
  key(m, 'SHIFT'); key(m, 'NULL'); key(m, 'S2'); key(m, 'S4'); near(m.view().value, 0);
});

test('Power On Last, UserDefined and Factory restore settings while preserving the external input and stored slot', () => {
  const m = new DmmModel(); m.fixture = 'acv'; m.setFn('ACV'); m.nplc = 1;
  const store = () => { key(m, 'SHIFT'); key(m, 'DISPLAY'); key(m, 'S1'); };
  assert.equal(m.powerOnMode, 'FACTORY'); store(); key(m, 'S1'); key(m, 'S4');
  assert.equal(m.powerOnMode, 'LAST'); m.setFn('OHM'); m.nplc = .2; m.readings = [{ value: 1000 }];
  m.power(); m.power(); assert.equal(m.fn, 'OHM'); assert.equal(m.nplc, .2); assert.equal(m.fixture, 'acv'); assert.equal(m.readings.length, 0);
  store(); key(m, 'S4'); assert.equal(m.powerOnMode, 'USER'); m.power(); m.power();
  assert.equal(m.fn, 'ACV'); assert.equal(m.nplc, 1); assert.equal(m.powerOnMode, 'USER'); assert.ok(m.savedState);
  store(); key(m, 'S4'); assert.equal(m.powerOnMode, 'FACTORY'); m.power(); m.power();
  assert.equal(m.fn, 'DCV'); assert.equal(m.nplc, 10); assert.equal(m.fixture, 'acv'); assert.ok(m.savedState);
  m.reset(); assert.ok(m.savedState); assert.equal(m.powerOnMode, 'FACTORY');
  const n = new DmmModel(); n.menu = 'STORE'; key(n, 'S4'); assert.equal(key(n, 'S4').kind, 'reject'); assert.equal(n.powerOnMode, 'LAST');
  assert.ok(validateSettings({ powerOnMode: 'INVALID' }));
});

test('AC Single uses the actual historical integration callback and freezes its completed RMS', () => {
  let t = 10; const windows = [], signal = { get now() { return t; }, ac: 9, peakAc: 12, peak: 12,
    rmsAcOver: (a, b) => { windows.push([a, b]); return 2; }, meanOver: () => 0 };
  const m = bench(signal); m.setFn('ACV'); m.nplc = 1; key(m, 'SINGLE'); t += 1 / 60; m.view();
  near(m.view().value, 2); assert.equal(m.run, 'stop'); near(windows[0][0], 10); near(windows[0][1], 10 + 1 / 60);
  signal.ac = 1; near(m.view().value, 2);
});

test('AC Single integrates a real resistive Bench output enabled for only half its sampling window', () => {
  const models = createInstruments(), b = new Bench(models.afg, models.dmm, models.gpe), bb = new Breadboard();
  let t = 1; b.now = () => t; models.dmm.now = () => t; b.bb = bb; b.board = 'bb'; bb.add('R', 'a1', 'a2', 1000);
  b.bbWires = { 'AFG.CH1+': 'b1', 'AFG.CH1-': 'b2', 'DMM.HI': 'c1', 'DMM.LO': 'c2' };
  Object.assign(models.afg.ch[0], { wave: 'SINE', freq: 120, emfVpp: 2, emfOffset: 0, output: true }); models.afg.ch[1].output = false;
  models.dmm.fixture = 'bench'; models.dmm.setBenchSource(() => b.dmmInput()); models.dmm.setFn('ACV');
  const fullRms = models.dmm.view().value; near(fullRms, (1000 * 1e6 / (1000 + 1e6)) / (50 + 1000 * 1e6 / (1000 + 1e6)) / Math.SQRT2, 1e-6);
  key(models.dmm, 'SINGLE'); t += 1 / 12; models.afg.ch[0].output = false; b.solution();
  t = 1 + 1 / 6 + 1e-9; near(models.dmm.view().value, fullRms / Math.SQRT2, 2e-5); assert.equal(models.dmm.run, 'stop');
  assert.equal(b.dmmInput().v.ac, 0); near(models.dmm.view().value, fullRms / Math.SQRT2, 2e-5);
});

test('Single AC range and overload use historical peaks and freeze the completed range for voltage and current', () => {
  for (const fn of ['ACV', 'ACI']) {
    let t = 10; const seen = [], signal = { get now() { return t; }, ac: 0, peakAc: 0, peak: 0,
      rmsAcOver: () => fn === 'ACV' ? .049 : .0001,
      peakAcOver: (a, b) => { seen.push([a, b]); return fn === 'ACV' ? 3 : .3; }, meanOver: () => 0 };
    const m = bench(signal); m.setBenchSource(() => ({ v: signal, i: signal })); m.setFn(fn); m.st.auto = false; m.st.idx = 0;
    key(m, 'SINGLE'); t = 10 + m.apertureSeconds() + 1e-9;
    assert.equal(m.view().state, 'over'); assert.equal(m.held.idx, 0); assert.equal(m.held.peak, true);
    near(seen[0][0], 10); near(seen[0][1], 10 + m.apertureSeconds());
    m.toggleRun(); m.st.auto = true; key(m, 'SINGLE'); t += m.apertureSeconds() + 1e-9;
    assert.equal(m.view().state, 'value'); const idx = m.held.idx;
    assert.equal(idx, fn === 'ACV' ? 1 : 3); signal.ac = fn === 'ACV' ? 500 : 2;
    assert.equal(m.rangeIdx(), idx); assert.equal(m.view().state, 'value');
  }
});

test('An unresolved historical peak with valid RMS remains unavailable without jumping Auto to the largest range', () => {
  let t = 10; const signal = { get now() { return t; }, ac: 0, peakAc: 0, peak: 0,
    rmsAcOver: () => .049, peakAcOver: () => NaN, meanOver: () => 0 };
  const m = bench(signal); m.setFn('ACV'); key(m, 'SINGLE'); t = 12;
  assert.equal(m.view().state, 'none'); assert.equal(m.held.idx, 0); assert.match(m.note(), /峰值.*解析/);
  assert.match(m.readingHint().text, /峰值.*解析/);
});

test('A real one-cycle Manual Burst cannot hide its high peak inside a long low-RMS Single window', () => {
  const models = createInstruments(), b = new Bench(models.afg, models.dmm, models.gpe), bb = new Breadboard();
  let t = 10; b.now = () => t; models.dmm.now = () => t; models.afg.setTriggerSource(() => t);
  b.bb = bb; b.board = 'bb'; bb.add('R', 'a1', 'a2', 1000);
  b.bbWires = { 'AFG.CH1+': 'b1', 'AFG.CH1-': 'b2', 'DMM.HI': 'c1', 'DMM.LO': 'c2' };
  const afg = (id) => models.afg.press(/^F\d$/.test(id) ? `AFG.SOFT.${id}` : `AFG.KEY.${id}`);
  for (const id of ['BURST', 'F1', 'F5', 'F3', 'OUTPUT']) afg(id);
  models.dmm.fixture = 'bench'; models.dmm.setBenchSource(() => b.dmmInput()); models.dmm.setFn('ACV');
  models.dmm.nplc = 100; models.dmm.st.auto = false; models.dmm.st.idx = 0;
  key(models.dmm, 'SINGLE'); afg('F1'); b.solution(); t = 12;
  assert.equal(models.dmm.view().state, 'over'); assert.equal(models.dmm.held.peak, true); assert.equal(models.dmm.held.idx, 0);
  models.dmm.toggleRun(); models.dmm.st.auto = true;
  key(models.dmm, 'SINGLE'); afg('F1'); b.solution(); t = 14;
  assert.equal(models.dmm.view().state, 'value'); assert.equal(models.dmm.held.idx, 1);
  const parallel = 1000 * 1e6 / (1000 + 1e6), amplitude = 3 * parallel / (50 + parallel);
  near(models.dmm.view().value, amplitude / Math.SQRT2 * Math.sqrt(.001 / (100 / 60)), 1e-5);
  assert.equal(b.dmmInput().v.peakAc, 0); assert.equal(models.dmm.rangeIdx(), 1);
});

test('Unresolved DC/AC integrals stay unavailable and never crash the LCD or falsely select a range', () => {
  for (const fn of ['DCV', 'DCI', 'ACV', 'ACI']) for (const value of [NaN, Infinity, -Infinity]) {
    let t = 10;
    const signal = { get now() { return t; }, dc: value, ac: value, peak: 1, peakAc: 1,
      meanOver: () => value, rmsAcOver: () => value };
    const m = bench(signal); m.setBenchSource(() => ({ v: signal, i: signal }));
    m.setFn(fn); m.st.idx = 1;
    assert.equal(m.view().state, 'none'); assert.equal(m.rangeIdx(), 1);
    assert.doesNotThrow(() => m.lcd()); assert.match(m.readingHint().text, /解析/);
    key(m, 'SINGLE'); t += 2;
    assert.equal(m.view().state, 'none'); assert.equal(m.held.idx, 1);
    assert.doesNotThrow(() => m.lcd());
  }
  const m = new DmmModel(); m.fixture = 'open'; m.setFn('CONT'); assert.equal(m.view().state, 'open');
  m.fixture = 'diode-open'; m.setFn('DIODE'); assert.equal(m.view().state, 'open');
});

function twoDcInputs() {
  const models = createInstruments(), b = new Bench(models.afg, models.dmm, models.gpe), bb = new Breadboard(), clock = { t: 10 };
  b.now = () => clock.t; models.dmm.now = () => clock.t; b.bb = bb; b.board = 'bb';
  bb.add('R', 'a1', 'a2', 1000); bb.add('R', 'a3', 'a2', 1000);
  models.afg.ch.forEach((c) => c.output = false); models.gpe.output = true;
  models.gpe.vset[1] = 400; models.gpe.vset[2] = 200;
  b.bbWires = { 'GPE.CH1+': 'b1', 'GPE.CH1-': 'b2', 'GPE.CH2+': 'b3', 'GPE.CH2-': 'c2',
    'DMM.HI': 'c1', 'DMM.LO': 'd2', 'DMM.SHI': 'c3', 'DMM.SLO': 'e2' };
  models.dmm.fixture = 'bench'; models.dmm.setBenchSource(() => b.dmmInput());
  b.solution(); clock.t += .2; return { models, b, bb, clock, m: models.dmm };
}

test('Ratio Single uses both input and Sense from its completed window, including late reference changes and unplugging', () => {
  const { models, b, clock, m } = twoDcInputs(); key(m, 'S5');
  const expected = m.view().value; near(expected, 2, 3e-5); key(m, 'SINGLE');
  clock.t += .2; models.gpe.vset[2] = 100; b.solution();
  delete b.bbWires['DMM.SHI']; delete b.bbWires['DMM.HI']; b.solution();
  near(m.view().value, expected, 1e-10); assert.equal(m.run, 'stop');
  key(m, 'RUN_STOP'); assert.equal(m.view().state, 'none');
});

test('A partial-window disconnection and a transient out-of-bounds Sense voltage invalidate Single instead of inventing a complete sample', () => {
  for (const kind of ['unplug', 'sense-overvoltage']) {
    const { models, b, clock, m } = twoDcInputs(); if (kind === 'sense-overvoltage') key(m, 'S5');
    key(m, 'SINGLE'); clock.t += .05;
    if (kind === 'unplug') delete b.bbWires['DMM.HI']; else models.gpe.vset[2] = 3200;
    b.solution(); clock.t += .05;
    if (kind === 'unplug') b.bbWires['DMM.HI'] = 'c1'; else models.gpe.vset[2] = 200;
    b.solution(); clock.t += .1;
    assert.equal(m.view().state, 'none', kind); assert.equal(m.run, 'stop');
    if (kind === 'unplug') assert.match(m.readingHint().text, /量測窗.*未完整/);
  }
});

test('Completed Auto Single freezes a range whose physical input load agrees with its displayed range', () => {
  const { models, b, clock, m } = twoDcInputs(); key(m, 'S4');
  assert.equal(m.rangeIdx(), 2); assert.equal(m.inputZ(), 1e10); const old = m.view().value;
  key(m, 'SINGLE'); clock.t += .2; models.gpe.vset[1] = 3200; b.solution();
  near(m.view().value, old, 1e-8); assert.equal(m.held.idx, 2); assert.equal(m.st.idx, 2); assert.equal(m.inputZ(), 1e10);
  key(m, 'RUN_STOP'); assert.equal(m.rangeIdx(), 3); assert.equal(m.inputZ(), 1e7);
});

test('Frequency Single uses a historical carrier and connections after the completed window is unplugged', () => {
  const { models, b, clock, m } = twoDcInputs(); models.gpe.output = false;
  b.bbWires = { 'AFG.CH1+': 'b1', 'AFG.CH1-': 'b2', 'DMM.HI': 'c1', 'DMM.LO': 'd2' };
  models.afg.ch[0].output = true; b.solution(); key(m, 'FREQ'); clock.t += .2; near(m.view().value, 1000, 1e-4);
  key(m, 'SINGLE'); clock.t += .2; models.afg.ch[0].freq = 2000; delete b.bbWires['DMM.HI']; b.solution();
  near(m.view().value, 1000, 1e-4); assert.equal(m.run, 'stop');
});

test('Passive Single reads the resistance and capacitance network at completion rather than a later replacement', () => {
  for (const fn of ['OHM4', 'CAP', 'TEMP']) {
    const models = createInstruments(), b = new Bench(models.afg, models.dmm, models.gpe); let t = 10;
    b.now = () => t; models.dmm.now = () => t; models.afg.ch.forEach((c) => c.output = false);
    b.R = 100; b.wires = fn === 'CAP' ? { 'DMM.HI': 'B', 'DMM.LO': 'G' }
      : { 'DMM.HI': 'A', 'DMM.LO': 'B', 'DMM.SHI': 'A', 'DMM.SLO': 'B' };
    models.dmm.fixture = 'bench'; models.dmm.setBenchSource(() => b.dmmInput()); models.dmm.setFn(fn);
    const expected = models.dmm.view().value; assert.ok(Number.isFinite(expected)); key(models.dmm, 'SINGLE');
    t = 10.2; b.R = 200; b.C *= 2; delete b.wires['DMM.HI']; b.solution();
    near(models.dmm.view().value, expected, 1e-10); assert.equal(models.dmm.run, 'stop');
  }
});

test('Changing a stopped temperature probe or R0 starts a fresh compatible conversion while changing units keeps the captured value', () => {
  const m = new DmmModel(); m.fixture = 'bench'; m.setBenchSource(() => ({ ohm: 109.73465625, ohm4: 100 }));
  m.setFn('TEMP'); near(m.view().value, 0); key(m, 'RUN_STOP'); key(m, 'S1');
  assert.equal(m.tempWire, 2); assert.equal(m.run, 'run'); near(m.view().value, 25);
  key(m, 'RUN_STOP'); key(m, 'S2'); key(m, 'UP');
  assert.equal(m.run, 'run'); near(m.view().value, temperatureOf(109.73465625, 'PT100', 101));
  key(m, 'SELECT'); key(m, 'RUN_STOP'); const captured = m.view().value; key(m, 'S5');
  assert.equal(m.run, 'stop'); near(m.view().value, captured * 1.8 + 32);
});

test('Clearing mathematical readings also restarts Probe Hold stability without erasing previous captures', () => {
  const m = new DmmModel(); let t = 10; m.now = () => t; m.toggleProbeHold();
  for (let i = 0; i < 5; i++) { t += .2; m.view(); }
  assert.equal(m.probeEntries.length, 1);
  key(m, 'SHIFT'); key(m, 'NULL'); key(m, 'S5'); key(m, 'UP'); key(m, 'DOWN'); key(m, 'SELECT');
  for (let i = 0; i < 5; i++) { t += .2; m.view(); }
  assert.equal(m.probeEntries.length, 2); near(m.probeEntries[0].value, m.probeEntries[1].value);
});

test('Digit Mask rounds only the visible digits, permits an explicit resolution, and preserves frozen readings and memory', () => {
  const m = bench({ now: 10, dc: 9.136, ac: 0, peak: 10, meanOver: () => 9.136 });
  assert.equal(m.view().text, '+09.136 00'); const count = m.readings.length;
  key(m, 'RUN_STOP'); key(m, 'DISPLAY'); key(m, 'S6'); key(m, 'S4');
  assert.equal(m.digitMask, 5); assert.equal(m.view().text, '+09.136'); near(m.view().value, 9.136); assert.equal(m.readings.length, count);
  m.setBenchSource(() => ({ v: { now: 20, dc: 100, ac: 0, peak: 100, meanOver: () => 100 } }));
  key(m, 'S6'); key(m, 'S5'); assert.equal(m.view().text, '+09.14'); near(m.view().value, 9.136);
  key(m, 'RUN_STOP'); key(m, 'DCV'); m.fixture = 'dcv'; m.setNplc(.02);
  const auto = m.view().text; key(m, 'DISPLAY'); key(m, 'S6'); key(m, 'S2');
  assert.ok(m.view().text.replace(/\D/g, '').length > auto.replace(/\D/g, '').length); near(m.view().value, 1.234);
  assert.equal(validateSettings(m.measurementState()), null); assert.ok(validateSettings({ digitMask: 3 }));
});

test('Bar Meter supports manual High/Low and equivalent Span/Center scales without changing the measurement or memory', () => {
  const m = new DmmModel(); m.view(); const count = m.readings.length;
  key(m, 'DISPLAY'); key(m, 'S1'); key(m, 'S2'); key(m, 'DISPLAY'); key(m, 'S4'); key(m, 'S1');
  assert.equal(m.barAuto, false); assert.deepEqual(m.barScale(), { low: -10, high: 10 });
  m.barLow = 0; m.barHigh = 2; near(m.view().bar, .617); near(m.view().barScale.zero, 0);
  key(m, 'S4'); assert.equal(m.barFormat, 'SPAN'); key(m, 'S2');
  key(m, 'UP'); near(m.barCenter, 1.001); near(m.barSpan, 2);
  key(m, 'SELECT'); m.menu = 'BAR_SCALE'; key(m, 'S3'); key(m, 'DOWN');
  near(m.barCenter, 1.001); near(m.barSpan, 1.999);
  assert.equal(m.readings.length, count); assert.equal(validateSettings(m.measurementState()), null);
  assert.ok(validateSettings({ barLow: 1, barHigh: 1 }));
  m.barCenter = 1e9; assert.ok(m.barHigh <= 1e9); m.barSpan = 1e-12; assert.ok(m.barHigh > m.barLow);
});

test('DC secondary AC measurement follows the Bench clock, waits four seconds and freezes with Run/Stop', () => {
  let t = 10; const s = { get now() { return t; }, dc: 1, ac: 2, peak: 4, peakAc: 3, meanOver: () => 1 };
  const m = bench(s); m.setBenchSource(() => ({ now: t, v: s }));
  key(m, 'DISPLAY'); key(m, 'S5'); key(m, 'S2'); assert.equal(m.secondaryOn, true);
  assert.deepEqual(m.view().secondary.values, []); t += 3.9; assert.deepEqual(m.view().secondary.values, []);
  t += .1; near(m.view().secondary.values[0].value, 2); assert.match(m.lcd(), /data-dmm-secondary/);
  s.ac = 4; t += 3.9; near(m.view().secondary.values[0].value, 2);
  t += .1; near(m.view().secondary.values[0].value, 4); key(m, 'RUN_STOP');
  s.ac = 8; t += 10; near(m.view().secondary.values[0].value, 4);
  key(m, 'DISPLAY'); key(m, 'S6'); key(m, 'S4'); near(m.view().secondary.values[0].value, 4);
});

test('Secondary frequency/period is a genuine unmodified measurement; incompatible primary functions do not invent a second line', () => {
  const m = new DmmModel(); m.fixture = 'acv'; m.setFn('FREQ'); m.st.nullOn = true; m.st.base = 100;
  key(m, 'DISPLAY'); key(m, 'S5'); key(m, 'S2'); near(m.view().value, 900); near(m.view().secondary.values[0].value, .001);
  m.setFn('ACV'); key(m, 'DISPLAY'); key(m, 'S5'); key(m, 'S2'); near(m.view().secondary.values[0].value, 1000);
  key(m, 'RUN_STOP'); m.fixture = 'dcv'; near(m.view().secondary.values[0].value, 1000);
  m.setFn('OHM'); key(m, 'DISPLAY'); key(m, 'S5'); key(m, 'S2'); assert.equal(m.secondaryOn, false); assert.equal(m.view().secondary, null);
  assert.ok(validateSettings({ fn: 'OHM', secondaryOn: true }));
});

test('Ratio and Sensor secondary readings retain the same historical evidence as a completed Single', () => {
  const { models, b, clock, m } = twoDcInputs(); key(m, 'S5');
  key(m, 'DISPLAY'); key(m, 'S5'); key(m, 'S2'); const expected = m.view().secondary.values.map((r) => r.value);
  key(m, 'SINGLE'); clock.t += .2; models.gpe.vset[2] = 100; delete b.bbWires['DMM.SHI']; b.solution();
  const actual = m.view().secondary.values.map((r) => r.value); assert.equal(actual.length, 2);
  actual.forEach((value, i) => near(value, expected[i], 1e-9));
  const n = new DmmModel(); n.fixture = 'pt100'; n.setFn('TEMP'); key(n, 'DISPLAY'); key(n, 'S5'); key(n, 'S2');
  near(n.view().secondary.values[0].value, 109.73465625); key(n, 'RUN_STOP'); n.fixture = 'thermistor';
  near(n.view().secondary.values[0].value, 109.73465625); key(n, 'SELECT'); key(n, 'S5'); near(n.view().value, 77);
  near(n.view().secondary.values[0].value, 109.73465625);
});

test('Store/Recall retains display settings and fills previous-version slots with display defaults', () => {
  const m = new DmmModel(); m.digitMask = 5; m.barAuto = false; m.barLow = 0; m.barHigh = 2; m.barFormat = 'SPAN'; m.secondaryOn = true;
  m.menu = 'STORE'; key(m, 'S1'); m.reset(); m.menu = 'STORE'; key(m, 'S2');
  assert.equal(m.digitMask, 5); assert.deepEqual(m.barScale(), { low: 0, high: 2 }); assert.equal(m.secondaryOn, true); assert.equal(m.secondaryCache, null);
  for (const key of ['digitMask', 'barAuto', 'barLow', 'barHigh', 'barFormat', 'secondaryOn']) delete m.savedState[key];
  m.menu = 'STORE'; key(m, 'S2'); assert.equal(m.digitMask, 'AUTO'); assert.equal(m.barAuto, true); assert.equal(m.secondaryOn, false);
});

test('CSV values carry their base units rather than the current engineering prefix', () => {
  const cases = [['DCI', 'dci', .01234, 'ADC', 'mADC'], ['FREQ', 'acv', 1000, 'Hz', 'kHz'],
    ['CAP', 'cap', 1e-6, 'F', 'µF'], ['OHM', 'r1k', 1000, 'Ω', 'kΩ'], ['TEMP', 'pt100', 25, '°C', '°C']];
  for (const [fn, fixture, expected, unit, displayUnit] of cases) {
    const m = new DmmModel(); m.fixture = fixture; m.setFn(fn); m.view();
    const rows = m.downloadReadings().download.text.trim().split('\n').slice(1).map((r) => r.split(','));
    assert.ok(rows.length > 0); for (const row of rows) { near(Number(row[2]), expected); assert.equal(row[3], unit); }
    assert.equal(m.readings.at(-1).displayUnit, displayUnit); assert.equal(m.statistics().unit, unit); assert.equal(m.histogram().unit, unit);
  }
});

test('Statistics, Histogram and CSV keep one physical unit across Auto changes of display prefix', () => {
  let t = 10, value = .01234; const signal = { get now() { return t; }, ac: 0, peak: 0, meanOver: () => value };
  const m = bench(signal); m.view(); value = 1.234; t += 1; m.view();
  assert.deepEqual(m.readings.map((r) => r.unit), ['VDC', 'VDC']); assert.deepEqual(m.readings.map((r) => r.displayUnit), ['mVDC', 'VDC']);
  near(m.statistics().mean, (.01234 + 1.234) / 2); assert.equal(m.statistics().unit, 'VDC');
  near(m.histogram().low, .01234); near(m.histogram().high, 1.234); assert.equal(m.histogram().unit, 'VDC');
  m.statsOn = true; assert.match(m.lcd(), /\[VDC\]/);
  key(m, 'RUN_STOP'); const csv = m.downloadReadings().download.text; assert.doesNotMatch(csv, /mVDC/); assert.match(csv, /,0\.01234,VDC/);
});
