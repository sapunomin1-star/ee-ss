import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench, DEMO } from '../src/bench/bench.js';
import { Breadboard, BB_DEMO } from '../src/bench/breadboard.js';
import { DMM_SETTING_FIELDS } from '../src/instruments/dmm/model.js';
import { captureSession, validateSession, restoreSession, MAX_SESSION_PARTS } from '../src/core/session.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
function setup() {
  const models = createInstruments();
  const bench = new Bench(models.afg, models.dmm, models.gpe);
  bench.bb = new Breadboard();
  const clock = { t: 0 };
  bench.now = () => clock.t;
  models.gpe.now = () => clock.t * 1000;
  models.tds.setBenchSource(() => bench.tdsInput());
  models.dmm.setBenchSource(() => bench.dmmInput());
  models.gpe.setBenchSource(() => bench.gpeInput());
  return { models, bench, clock };
}
function configure(s) {
  const { afg, tds, gpe, dmm } = s.models;
  afg.ch[0] = { wave: 'RAMP', freq: 1234, sym: 30, emfVpp: 4, emfOffset: 1,
    load50: false, unit: 'VRMS', offUnit: 'MVDC', output: true };
  afg.ch[1] = { wave: 'SQUARE', freq: 10000, sym: 50, emfVpp: 2, emfOffset: -1,
    load50: true, unit: 'MVPP', offUnit: 'VDC', output: false };
  afg.sel = 1; afg.menu = 'AMPL'; afg.hl = 'AMPL'; afg.cexp = -3;
  afg.buf = '99'; // not committed and must never become an output setting
  tds.menu = 'CURSOR'; tds.ch[0].vIdx = 7; tds.ch[0].coupling = 'AC';
  tds.ch[1] = { on: true, coupling: 'DC', bw: true, vIdx: 6, pos: 0.2, probe: 1 };
  tds.sIdx = 15; tds.mpos = 0.002;
  tds.extended.horizontal.windowIdx = 15; tds.extended.horizontal.windowPos = 0.002;
  tds.trig = { src: 1, slope: 'F', mode: 'AUTO', coup: 'AC', level: -0.1 };
  tds.cursor = { type: 'TIME', src: 1, sel: 0, t: [-100, 25], v: [10, -20] };
  tds.meas[0] = { src: 1, type: 'CYCRMS' };
  tds.autoKind = 'SQUARE'; tds.autoMeas = { src: 0, types: ['PKPK', 'MEAN', 'PERIOD', 'FREQ'] };
  gpe.vset = { 1: 1234, 2: 800, 3: 330, 4: 1200 };
  gpe.iset = { 1: 234, 2: 345 }; gpe.keyL = true; gpe.keyR = true;
  gpe.rows = [4, 3]; gpe.output = true; gpe.lock = true; gpe.load = 'bench';
  gpe.viewAt = 4; gpe.bootAt = 3; gpe.last = { id: 'old', dir: 1, t: 4 };
  dmm.fn = 'ACV'; dmm.fixture = 'bench'; dmm.shift = true;
  dmm.per.ACV = { auto: false, idx: 2, nullOn: true, base: 0.123 };
  dmm.per.OHM = { auto: false, idx: 4, nullOn: true, base: 1000 };
  s.bench.topo = 'CR'; s.bench.R = 4700; s.bench.C = 1e-6;
  s.bench.wires = { ...DEMO }; s.bench.probeX = [1, 10];
  s.bench.bb.load(BB_DEMO.gpe, s.bench.bbWires);
  s.bench.bb.remove('R1');
  const added = s.bench.bb.add('C', 'a1', 'a2', 10e-6, s.bench.bbWires);
  assert.ok(added.ok);
  // Restore must keep R2 rather than renumber a diagram after a deletion.
  assert.ok(s.bench.bb.get('R2'));
}

test('explicit Setup and Ref memories survive a session while live acquisition is restarted', () => {
  const from = setup(), scope = from.models.tds;
  scope.press('TDS.KEY.AUTOSET');
  scope.storeSoft(4);
  scope.extended.store.action = 'SAVE_WAVEFORM'; scope.storeSoft(4);
  assert.ok(scope.references[0]);
  const saved = captureSession(from.models, from.bench);
  const into = setup(); restoreSession(saved, into.models, into.bench);
  assert.deepEqual(into.models.tds.savedSetups, scope.savedSetups);
  assert.ok(into.models.tds.references[0].v instanceof Float64Array);
  assert.deepEqual(Array.from(into.models.tds.references[0].v), Array.from(scope.references[0].v));
  assert.notEqual(into.models.tds.rec, scope.rec);
  for (const corrupt of [
    (s) => { s.instruments.tds.references[0].v.pop(); },
    (s) => { s.instruments.tds.references[0].v[0] = Infinity; },
    (s) => { s.instruments.tds.savedSetups[0].rec = {}; },
    (s) => { s.instruments.tds.savedSetups[0].trig.src = 7; },
  ]) { const broken = clone(saved); corrupt(broken); assert.throws(() => validateSession(broken), /實驗存檔/); }
});

test('legacy sessions normalize new settings and empty memories without changing their source', () => {
  const s = setup(), legacy = captureSession(s.models, s.bench);
  for (const c of legacy.instruments.afg.ch) { delete c.duty; delete c.phase; }
  delete legacy.instruments.afg.extended; legacy.instruments.afg.ch.forEach((c) => delete c.extended);
  for (const k of ['extended', 'savedSetups', 'references']) delete legacy.instruments.tds[k];
  for (const k of ['startupOutput', 'digits']) delete legacy.instruments.gpe[k];
  for (const k of [...DMM_SETTING_FIELDS, 'menu', 'savedState']) delete legacy.instruments.dmm[k];
  for (const fn of Object.keys(legacy.instruments.dmm.per)) if (!['DCV', 'ACV', 'DCI', 'ACI', 'OHM', 'CONT'].includes(fn)) delete legacy.instruments.dmm.per[fn];
  const original = clone(legacy), valid = validateSession(legacy);
  assert.deepEqual(legacy, original); assert.equal(valid.instruments.afg.ch[0].duty, 50);
  assert.equal(valid.instruments.tds.extended.math.op, '-'); assert.equal(valid.instruments.tds.savedSetups.length, 10);
  assert.ok(valid.instruments.tds.references.every((r) => r === null));
  assert.equal(valid.instruments.dmm.nplc, s.models.dmm.nplc);
  assert.doesNotThrow(() => restoreSession(legacy, s.models, s.bench));
});

test('advanced committed instrument settings round-trip and malformed values are rejected', () => {
  const from = setup(), { afg, tds, dmm, gpe } = from.models;
  afg.press('AFG.KEY.ARB'); afg.ch[0].extended.arb.points[20] = 511;
  afg.extended.memories[0] = { arb: afg.ch.map((c) => clone(c.extended.arb)) };
  afg.menu = 'ARB_POINT'; afg.hl = 'X_ADDRESS';
  tds.extended.math.op = 'FFT'; tds.extended.fft.window = 'FLATTOP';
  tds.extended.pulse.type = 'PULSE'; tds.extended.pulse.width = 0.002;
  tds.extended.fine[0] = true; tds.extended.fineScale[0] = 0.49;
  dmm.fn = 'TEMP'; dmm.tempWire = 4; dmm.tempUnit = 'F'; dmm.histBins = 40;
  dmm.savedState = dmm.measurementState();
  gpe.startupOutput = true; gpe.digits = 3;
  const saved = captureSession(from.models, from.bench), into = setup();
  restoreSession(saved, into.models, into.bench);
  assert.deepEqual(captureSession(into.models, into.bench), saved);
  for (const corrupt of [
    (s) => { s.instruments.afg.ch[0].extended.arb.points[0] = 512; },
    (s) => { s.instruments.afg.extended.memories[0].arb[0].points[0] = NaN; },
    (s) => { s.instruments.tds.extended.fineScale[0] = 0; },
    (s) => { s.instruments.tds.extended.pulse.width = 0; },
    (s) => { s.instruments.dmm.tempR0 = 79; },
    (s) => { s.instruments.dmm.savedState.per = {}; },
    (s) => { s.instruments.gpe.digits = 9; },
  ]) { const broken = clone(saved); corrupt(broken); assert.throws(() => validateSession(broken), /實驗存檔/); }
  const getter = clone(saved);
  Object.defineProperty(getter.instruments.afg.ch[0].extended.arb.points, '0', { enumerable: true, get() { throw new Error('getter executed'); } });
  assert.throws(() => validateSession(getter), /動態屬性/);
});

test('DMM recall clears Probe Hold history and freezes both value and unit in Stop', () => {
  const s = setup(), d = s.models.dmm;
  d.fixture = 'dcv'; d.run = 'stop';
  const saved = captureSession(s.models, s.bench);
  d.probeEntries = [{ value: 999 }]; d.probeWindow = [99]; d.probeLast = 99; d.probeHold = true;
  restoreSession(saved, s.models, s.bench);
  assert.deepEqual(d.probeEntries, []); assert.deepEqual(d.probeWindow, []); assert.equal(d.probeLast, null); assert.equal(d.probeHold, false);
  const held = d.view(); assert.equal(held.value, 1.234);
  d.fixture = 'acv';
  assert.deepEqual(d.view(), held);
});

test('partial legacy DMM settings must also be valid after merging defaults', () => {
  const s = setup(), saved = captureSession(s.models, s.bench);
  delete saved.instruments.dmm.limitHigh; saved.instruments.dmm.limitLow = 2;
  assert.throws(() => validateSession(saved), /Low Limit/);
  saved.instruments.dmm.limitLow = 0; delete saved.instruments.dmm.histHigh; saved.instruments.dmm.histLow = 2;
  assert.throws(() => validateSession(saved), /Histogram Low/);
});

test('previous DMM user memories receive display defaults without losing saved measurement settings', () => {
  const s = setup(), dmm = s.models.dmm;
  dmm.fn = 'ACV'; dmm.nplc = 1; dmm.savedState = dmm.measurementState();
  const file = captureSession(s.models, s.bench);
  const added = ['digitMask', 'barAuto', 'barLow', 'barHigh', 'barFormat', 'secondaryOn'];
  for (const key of added) { delete file.instruments.dmm[key]; delete file.instruments.dmm.savedState[key]; }
  const old = clone(file), valid = validateSession(file);
  assert.deepEqual(file, old);
  for (const key of added) assert.equal(valid.instruments.dmm.savedState[key], dmm[key]);
  assert.equal(valid.instruments.dmm.savedState.fn, 'ACV'); assert.equal(valid.instruments.dmm.savedState.nplc, 1);
  restoreSession(file, s.models, s.bench);
  assert.equal(s.models.dmm.savedState.fn, 'ACV');
});

test('new display settings survive restore while secondary readings restart their acquisition clock', () => {
  const s = setup(), dmm = s.models.dmm;
  dmm.now = () => s.clock.t; dmm.fixture = 'acv'; dmm.secondaryOn = true;
  Object.assign(dmm, { digitMask: 5, barAuto: false, barLow: -10, barHigh: 10, barFormat: 'SPAN' });
  dmm.reading(); s.clock.t = 4.1; dmm.reading();
  assert.equal(dmm.secondaryCache.values[0].value, 2);
  const saved = captureSession(s.models, s.bench);
  assert.equal(Object.hasOwn(saved.instruments.dmm, 'secondaryCache'), false);
  s.clock.t = 20; restoreSession(saved, s.models, s.bench);
  assert.equal(dmm.secondaryCache, null); assert.equal(dmm.secondaryOn, true);
  assert.equal(dmm.digitMask, 5); assert.equal(dmm.barLow, -10); assert.equal(dmm.barHigh, 10); assert.equal(dmm.barFormat, 'SPAN');
  dmm.reading(); s.clock.t = 23.9; dmm.reading(); assert.equal(dmm.secondaryCache, null);
  s.clock.t = 24.1; dmm.reading(); assert.equal(dmm.secondaryCache.values[0].value, 2);
});

test('capture is read-only, detached JSON and omits edits, clocks, charge and acquisition records', () => {
  const s = setup(); configure(s);
  s.bench.solution();
  const rec = s.models.tds.rec, segs = s.bench.segs, acq = s.models.tds.acqN;
  s.bench.now = () => { throw new Error('capture must not read the clock'); };
  s.models.tds.tick = () => { throw new Error('capture must not acquire'); };
  s.bench.snapshot = () => { throw new Error('capture must not solve'); };
  const saved = captureSession(s.models, s.bench, { tab: 'bench', zoom: 1.5 });
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), saved);
  assert.deepEqual(validateSession(saved), saved);
  const raw = JSON.stringify(saved);
  for (const field of ['stateId', 'rec', 'segs', 'acqN', 'buf', 'cexp', 'viewAt', 'bootAt', 'armedAt', 'changeSearch'])
    assert.ok(!raw.includes(`"${field}"`), field);
  assert.equal(s.models.tds.rec, rec); assert.equal(s.models.tds.acqN, acq); assert.equal(s.bench.segs, segs);
  assert.equal(s.models.afg.buf, '99');
  saved.instruments.afg.ch[0].freq = 1;
  assert.equal(s.models.afg.ch[0].freq, 1234);
});

for (const board of ['rc', 'bb']) test(`${board}: all four instruments and both diagrams round-trip, then remain usable`, () => {
  const from = setup(); configure(from); from.bench.board = board;
  const expected = captureSession(from.models, from.bench, { tab: 'tds', zoom: 2 });
  const into = setup();
  const hooks = [into.bench.now, into.models.gpe.now, into.models.tds.benchSource, into.models.dmm.benchSource, into.models.gpe.benchSource];
  const ui = restoreSession(expected, into.models, into.bench);
  assert.deepEqual(ui, { tab: 'tds', zoom: 2 });
  assert.deepEqual(captureSession(into.models, into.bench, ui), expected);
  assert.deepEqual([into.bench.now, into.models.gpe.now, into.models.tds.benchSource, into.models.dmm.benchSource, into.models.gpe.benchSource], hooks);
  assert.equal(into.models.afg.buf, ''); assert.notEqual(into.models.afg.cexp, null);
  assert.equal(into.models.dmm.shift, false); assert.equal(into.models.gpe.viewAt, null);
  assert.equal(into.models.gpe.bootAt, -Infinity); assert.equal(into.models.gpe.last, null);
  assert.deepEqual(into.bench.bb.parts.map((p) => p.id), from.bench.bb.parts.map((p) => p.id));
  assert.ok(into.bench.bb.parts.every((p, i) => p.stateId !== from.bench.bb.parts[i].stateId));
  into.models.afg.turn('AFG.KNOB.MAIN', 1);
  into.models.gpe.press('GPE.KEY.OUTPUT_ON_OFF');
  assert.doesNotThrow(() => into.models.tds.press('TDS.KEY.AUTOSET'));
  assert.doesNotThrow(() => into.models.dmm.view());
  assert.doesNotThrow(() => into.bench.solution());
});

const corruptions = [
  ['unknown version', (x) => { x.version = 2; }],
  ['wrong format', (x) => { x.format = 'anything'; }],
  ['unknown top-level field', (x) => { x.history = []; }],
  ['missing instrument', (x) => { delete x.instruments.afg; }],
  ['unknown instrument field', (x) => { x.instruments.tds.rec = {}; }],
  ['AFG invalid wave', (x) => { x.instruments.afg.ch[0].wave = 'UNKNOWN'; }],
  ['AFG excessive joint peak', (x) => { x.instruments.afg.ch[0].emfVpp = 20; x.instruments.afg.ch[0].emfOffset = 1; }],
  ['AFG high-frequency amplitude', (x) => { x.instruments.afg.ch[0].wave = 'SINE'; x.instruments.afg.ch[0].freq = 25e6; x.instruments.afg.ch[0].emfVpp = 12; }],
  ['AFG High Z dBm', (x) => { x.instruments.afg.ch[0].load50 = false; x.instruments.afg.ch[0].unit = 'DBM'; }],
  ['AFG non-finite', (x) => { x.instruments.afg.ch[0].freq = Infinity; }],
  ['AFG active channels without a supported common period', (x) => {
    x.instruments.afg.ch.forEach((c,i) => { c.wave='SINE'; c.freq=i?1000.5:1000; c.emfVpp=2; c.emfOffset=0; c.phase=0; c.output=true; });
  }],
  ['TDS invalid source', (x) => { x.instruments.tds.trig.src = 2; }],
  ['TDS invalid scale index', (x) => { x.instruments.tds.ch[0].vIdx = 12; }],
  ['TDS invalid scenario', (x) => { x.instruments.tds.scenario = 'unknown'; }],
  ['TDS impossible position', (x) => { x.instruments.tds.mpos = -999; }],
  ['TDS sparse array', (x) => { delete x.instruments.tds.ch[0]; }],
  ['TDS array extra field', (x) => { x.instruments.tds.ch.foo = true; }],
  ['GPE above CH3 rating', (x) => { x.instruments.gpe.vset[3] = 501; }],
  ['GPE non-integer setting', (x) => { x.instruments.gpe.iset[1] = 1.1; }],
  ['GPE invalid row', (x) => { x.instruments.gpe.rows[0] = 2; }],
  ['DMM invalid range', (x) => { x.instruments.dmm.per.DCV.idx = 99; }],
  ['DMM invalid null base', (x) => { x.instruments.dmm.per.DCV.base = NaN; }],
  ['DMM negative AC null base', (x) => { x.instruments.dmm.per.ACV.base = -1; }],
  ['DMM Ratio together with DCV Null', (x) => { x.instruments.dmm.ratioOn = true; x.instruments.dmm.per.DCV.nullOn = true; }],
  ['unknown fixed lead', (x) => { x.bench.fixed.wires['DMM.BAD'] = 'A'; }],
  ['unknown fixed node', (x) => { x.bench.fixed.wires['AFG.CH1+'] = 'D'; }],
  ['unknown breadboard hole', (x) => { x.bench.breadboard.parts[0].a = 'a31'; }],
  ['duplicate part IDs', (x) => { x.bench.breadboard.parts.push({ ...x.bench.breadboard.parts[0], a: 'a8', b: 'a9' }); }],
  ['part ID kind mismatch', (x) => { x.bench.breadboard.parts[0].id = 'R1'; }],
  ['both legs in one hole', (x) => { x.bench.breadboard.parts[0].b = x.bench.breadboard.parts[0].a; }],
  ['occupied part hole', (x) => { x.bench.breadboard.wires['AFG.CH1+'] = x.bench.breadboard.parts[0].a; }],
  ['occupied lead hole', (x) => { x.bench.breadboard.wires['AFG.CH1+'] = x.bench.breadboard.wires['GPE.CH1+']; }],
  ['old charge identity', (x) => { x.bench.breadboard.parts[0].stateId = 'old'; }],
  ['invalid capacitor', (x) => { x.bench.breadboard.parts.find((p) => p.kind === 'C').value = -1; }],
  ['too many components', (x) => { x.bench.breadboard.parts = Array.from({ length: MAX_SESSION_PARTS + 1 }, () => ({})); }],
  ['unknown UI tab', (x) => { x.ui.tab = 'unknown'; }],
  ['invalid zoom', (x) => { x.ui.zoom = 99; }],
  ['prototype key', (x) => { x.bench.fixed.wires = JSON.parse('{"__proto__":"A"}'); }],
];
for (const [name, corrupt] of corruptions) test(`reject ${name} without changing any current setting, record or charge history`, () => {
  const s = setup(); configure(s); s.bench.board = 'bb'; s.clock.t = 10;
  s.bench.solution(); s.models.tds.scen = 'BENCH'; s.models.tds.tick();
  const saved = captureSession(s.models, s.bench), bad = clone(saved);
  corrupt(bad);
  const descriptors = [...Object.values(s.models), s.bench].map((x) => Object.getOwnPropertyDescriptors(x));
  assert.throws(() => validateSession(bad), /實驗存檔/);
  assert.throws(() => restoreSession(bad, s.models, s.bench), /實驗存檔/);
  assert.deepEqual(captureSession(s.models, s.bench), saved);
  assert.deepEqual([...Object.values(s.models), s.bench].map((x) => Object.getOwnPropertyDescriptors(x)), descriptors);
});

test('recalling a stopped bench scope replaces an old waveform and clears charge/search history', () => {
  const s = setup(); s.bench.board = 'bb'; s.bench.bb.load(BB_DEMO.rc, s.bench.bbWires);
  s.models.afg.ch[0].output = true;
  s.models.tds.scen = 'BENCH'; s.models.tds.sIdx = 15; s.models.tds.tick();
  s.clock.t = 2; s.models.afg.ch[0].emfOffset = 1; s.models.tds.tick();
  s.models.tds.run = 'stop';
  const oldRec = s.models.tds.rec, oldSegs = s.bench.segs, oldPart = s.bench.bb.get('C1').stateId;
  s.models.tds.changeSearch = { old: true }; s.models.tds.armedAt = -100;
  s.models.tds.pendingAcquisition = { triggerAt: 2, endAt: 200, key: 'old capture' };
  s.models.tds.lastRecordEndAt = 150;
  const saved = captureSession(s.models, s.bench);
  s.clock.t = 100;
  restoreSession(saved, s.models, s.bench);
  assert.equal(s.models.tds.run, 'stop'); assert.ok(s.models.tds.rec); assert.notEqual(s.models.tds.rec, oldRec);
  assert.notEqual(s.bench.segs, oldSegs); assert.notEqual(s.bench.bb.get('C1').stateId, oldPart);
  assert.equal(s.bench.changeT, 100); assert.equal(s.models.tds.changeSearch, null); assert.equal(s.models.tds.armedAt, null);
  assert.ok(Math.abs(s.bench.vcAt(100)) < 1e-10, 'recalled capacitor starts without the old stored charge');
  assert.equal(s.models.tds.complete, false);
  assert.equal(s.models.tds.pendingAcquisition, null);
  assert.equal(s.models.tds.lastRecordEndAt, null);
  assert.ok(s.models.tds.rec.endAt <= s.clock.t, 'Stop recall only publishes elapsed samples');
  const frozen = s.models.tds.rec; s.clock.t = 101; s.models.tds.tick(); assert.equal(s.models.tds.rec, frozen);
  s.models.tds.press('TDS.KEY.RUN_STOP'); assert.equal(s.models.tds.run, 'run'); assert.notEqual(s.models.tds.rec, frozen);
});

test('Single recall starts waiting again and acquires only after a subsequent input edge', () => {
  const s = setup(); s.bench.bb.load(BB_DEMO.rc, s.bench.bbWires); s.bench.board = 'bb';
  s.models.afg.ch[0].emfOffset = 1; s.models.afg.ch[0].emfVpp = 0.002;
  s.models.afg.ch[0].output = false;
  s.models.tds.scen = 'BENCH'; s.models.tds.sIdx = 15; s.models.tds.trig.level = 0.05;
  s.models.tds.run = 'single';
  const saved = captureSession(s.models, s.bench); s.clock.t = 20;
  restoreSession(saved, s.models, s.bench);
  assert.equal(s.models.tds.run, 'single'); assert.equal(s.models.tds.rec, null);
  assert.equal(s.models.tds.changeSearch, null); assert.equal(s.models.tds.armedAt, 20);
  s.models.tds.tick(); assert.equal(s.models.tds.run, 'single');
  s.clock.t = 20.1; s.models.afg.ch[0].output = true; s.models.tds.inputChanged();
  assert.equal(s.models.tds.run, 'single', 'trigger still needs actual post-trigger samples');
  s.clock.t = 20.2; s.models.tds.inputChanged();
  assert.equal(s.models.tds.run, 'stop'); assert.equal(s.models.tds.complete, true);
  assert.ok(s.models.tds.rec.abs0 >= 20);
});

test('unexpected live source failure rolls back complete own state after trial validation', () => {
  const s = setup(); const saved = captureSession(s.models, s.bench);
  saved.instruments.tds.scenario = 'BENCH'; saved.instruments.afg.ch[0].freq = 100;
  s.models.tds.benchSource = () => { throw new Error('live source failed'); };
  const targets = [...Object.values(s.models), s.bench], before = targets.map((x) => Object.getOwnPropertyDescriptors(x));
  assert.throws(() => restoreSession(saved, s.models, s.bench), /原實驗已保留/);
  assert.deepEqual(targets.map((x) => Object.getOwnPropertyDescriptors(x)), before);
});

test('power-off and missing source callbacks can be recalled without activating outputs', () => {
  const s = setup(); s.models.afg.on = false; s.models.tds.on = false; s.models.gpe.on = false; s.models.dmm.on = false;
  s.models.tds.run = 'stop';
  const saved = captureSession(s.models, s.bench), models = createInstruments();
  const bench = new Bench(models.afg, models.dmm, models.gpe);
  restoreSession(saved, models, bench);
  assert.deepEqual(captureSession(models, bench), saved);
  assert.ok(Object.values(models).every((m) => !m.on));
  assert.deepEqual(bench.afgParams().map((c) => c.output), [false, false]);
  assert.equal(bench.gpeParams().active, false);
});
