import test from 'node:test';
import assert from 'node:assert/strict';
import { TdsModel, SDIV, VDIV } from '../src/instruments/tds/model.js';
import { Bench, DEMO } from '../src/bench/bench.js';

const key = (m, id) => m.press(`TDS.KEY.${id}`);
const opt = (m, n) => m.press(`TDS.SOFT.OPT${n}`);

function chargingScope({ frequency = 1000, scale = 250e-6, captureDelay = 12 * scale } = {}) {
  let now = 0;
  const afg = { on: true, ch: [{ wave: 'SINE', freq: frequency, emfVpp: 2, emfOffset: 2, sym: 50, output: false }, { output: false }] };
  const bench = new Bench(afg); bench.now = () => now; bench.R = 100000; bench.C = 10e-6;
  for (const [lead, node] of Object.entries(DEMO)) bench.connect(lead, node);
  const m = new TdsModel(); m.setBenchSource(() => bench.tdsInput()); m.setScenario('BENCH');
  m.ch.forEach((c) => Object.assign(c, { on: true, probe: 10, vIdx: VDIV.indexOf(.2) }));
  m.sIdx = SDIV.indexOf(scale); m.trig = { ...m.trig, mode: 'AUTO', level: .2 };
  const advance = (time) => { now = time; m.inputChanged(); };
  now = 1; afg.ch[0].output = true; bench.solution(); m.inputChanged();
  advance(1 + captureDelay);
  assert.ok(m.rec.triggered, 'fixture has a completed actual trigger');
  assert.equal(m.pendingAcquisition, null);
  assert.ok(m.rec.endAt <= now, 'fixture has no future samples');
  return { m, advance, afg, bench, now: () => now, setTime: (time) => { now = time; } };
}

test('Phase and Delay reject the charging CH2 even while CH1 has a complete cycle', () => {
  const { m } = chargingScope();
  assert.ok(m.measure(0, 'PERIOD').value > 0);
  assert.equal(m.measure(1, 'PERIOD').value, null, 'CH2 contains only a charging edge');
  for (const source of [0, 1]) for (const type of ['PHASE', 'DELAY']) {
    const reading = m.measure(source, type);
    assert.equal(reading.value, null, `CH${source + 1} ${type} cannot use a lone CH2 edge as a cycle`);
    assert.equal(reading.text, '?');
  }
});

test('Phase and Delay still measure both signs from complete acquired cycles', () => {
  const m = new TdsModel(); m.setScenario('S2'); key(m, 'AUTOSET'); key(m, 'RUN_STOP');
  for (const source of [0, 1]) {
    const sign = source ? -1 : 1;
    assert.ok(Math.abs(m.measure(source, 'PHASE').value - sign * 45) < .1);
    assert.ok(Math.abs(m.measure(source, 'DELAY').value - sign * 125e-6) < 1e-6);
  }
});

test('Auto keeps a triggered record through Cursor keys and knob turns until actual time advances', () => {
  const { m } = chargingScope(), record = m.rec, acquired = m.acqN;
  key(m, 'CURSOR'); opt(m, 1); opt(m, 4);
  for (let j = 0; j < 5; j++) m.turn('TDS.KNOB.MULTIPURPOSE', 1);
  assert.equal(m.cursor.type, 'TIME');
  assert.ok(m.rec === record, 'display-only actions keep the actual triggered samples');
  assert.equal(m.acqN, acquired);
  assert.equal(m.trigStatus(), "Trig'd");
  assert.ok(m.needsTriggerPoll(), 'Auto continues to seek actual triggers without UI interaction');
});

test('Auto timeout publishes causal free-run data and cannot label a predicted crossing Trig’d', () => {
  const { m, advance, now } = chargingScope({ frequency: 1 }), record = m.rec;
  const deadline = now() + .05;
  advance(deadline - 1e-6);
  assert.ok(m.rec === record, 'Auto waits at least 50 ms after a completed trigger');
  advance(deadline + 1e-6);
  assert.ok(m.crosses(), 'the periodic preview predicts a future crossing');
  assert.equal(m.rec.triggered, false, 'no real second edge has occurred');
  assert.equal(m.trigStatus(), 'Auto');
  assert.ok(m.rec.endAt <= deadline + 1e-6, 'free-run capture never reads the future');
  advance(2.003);
  assert.ok(m.rec.triggered, 'actual next-period edge restores triggered acquisition');
  assert.equal(m.trigStatus(), "Trig'd");
});

test('Auto timeout scales with the record duration and Normal never uses the fallback', () => {
  const { m, advance, now } = chargingScope({ frequency: 1, scale: .01 }), record = m.rec, publishedAt = now();
  advance(publishedAt + .1);
  assert.ok(m.rec === record, '10 ms/div uses a 200 ms timeout, not the minimum 50 ms');
  m.trig.mode = 'NORMAL'; advance(publishedAt + .21);
  assert.ok(m.rec === record, 'Normal holds the triggered record beyond the Auto timeout');
  m.trig.mode = 'AUTO'; m.tick();
  assert.equal(m.rec.triggered, false);
  assert.equal(m.trigStatus(), 'Auto');
});

test('Cursor preserves a completed trigger after each 200 ms acquisition poll', () => {
  const { m, advance, now, setTime } = chargingScope({ captureDelay: .0035 });
  for (let poll = 0; poll < 3; poll++) {
    advance(now() + .2);
    const record = m.rec, acquired = m.acqN;
    assert.ok(record.triggered && !m.pendingAcquisition, 'poll publishes a completed actual trigger');
    assert.ok(record.endAt < now() - .05, 'one-record-per-poll history capture can precede publication by more than the Auto timeout');
    setTime(now() + .0001); // Real UI latency, but still before the next rising edge.
    key(m, 'CURSOR'); opt(m, 1); opt(m, 4); m.turn('TDS.KNOB.MULTIPURPOSE', 1);
    assert.equal(m.acqN, acquired, 'Cursor keys and knob must not immediately replace the just-published record');
    assert.ok(m.rec === record);
    assert.equal(m.trigStatus(), "Trig'd");
  }
});

test('A trigger completed on a later poll starts a fresh Auto wait, which still expires without another edge', () => {
  const { m, advance, now, setTime } = chargingScope({ frequency: 1 });
  setTime(now() + .2); key(m, 'FORCE_TRIG');
  assert.ok(m.pendingAcquisition, 'Force waits for actual post-trigger samples');
  advance(now() + .2);
  const record = m.rec, publishedAt = now();
  assert.ok(record.triggered && record.endAt < publishedAt - .05);
  setTime(publishedAt + .001); key(m, 'CURSOR');
  assert.ok(m.rec === record, 'publishing a completed capture must not start with an already-expired wait');
  advance(publishedAt + .049);
  assert.ok(m.rec === record);
  advance(publishedAt + .051);
  assert.equal(m.rec.triggered, false, 'Auto still free-runs once the new wait expires');
  assert.equal(m.trigStatus(), 'Auto');
  assert.ok(m.rec.endAt <= now(), 'timeout samples remain causal');
});

test('Input loss still reaches Auto timeout, while Stop keeps its record through cursor operations', () => {
  const { m, advance, now, setTime, afg, bench } = chargingScope({ captureDelay: .0035 });
  advance(now() + .2);
  const record = m.rec, publishedAt = now();
  setTime(now() + .0001); afg.ch[0].output = false; bench.solution(); m.inputChanged();
  assert.ok(m.rec === record, 'a missing input does not bypass the new Auto wait');
  advance(publishedAt + .051);
  assert.equal(m.rec.triggered, false);
  assert.equal(m.trigStatus(), 'Auto');
  assert.ok(m.measure(0, 'PKPK').value < .001, 'new history contains only the small RC discharge, not the old 2 Vpp signal');
  key(m, 'RUN_STOP'); const frozen = m.rec;
  advance(now() + 1); key(m, 'CURSOR'); opt(m, 1);
  assert.ok(m.rec === frozen);
  assert.equal(m.trigStatus(), 'Stop');
});
