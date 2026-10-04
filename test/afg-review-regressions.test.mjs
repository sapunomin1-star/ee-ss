import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
import { emf } from '../src/bench/circuit.js';
import { captureSession, validateSession, restoreSession } from '../src/core/session.js';

function run(m, sequence) {
  let result;
  for (const key of sequence.split(' ')) {
    if (/^[\d.]+$/.test(key)) {
      for (const digit of key) result = m.press(`AFG.NUM.${digit === '.' ? 'DOT' : `DIGIT_${digit}`}`);
    } else result = m.press(/^F\d$/.test(key) ? `AFG.SOFT.${key}` : `AFG.KEY.${({ FREQ: 'FREQ_RATE', OUT: 'OUTPUT', BACK: 'RETURN' })[key] || key}`);
  }
  return result;
}

function setup() {
  const models = createInstruments(), m = models.afg, bench = new Bench(m, models.dmm, models.gpe), clock = { t: 0 };
  bench.now = () => clock.t;
  m.setTriggerSource(() => clock.t);
  bench.wires = { 'AFG.CH1+': 'A', 'AFG.CH1-': 'G' };
  bench.C = .001e-6;
  bench.solution();
  return { models, m, bench, clock };
}

for (const [name, edit] of [['Cycles', 'BACK BACK F1 100 F2'], ['carrier frequency', 'FREQ 10 F3']]) {
  test(`completed Manual Burst stays idle after editing ${name} until a new Trigger`, () => {
    const { m, bench, clock } = setup();
    run(m, 'BURST F1 F5 F3 OUT F1');
    bench.solution();
    clock.t = .00025;
    assert.ok(bench.solution().nodeAt('A', clock.t) > 2.9);
    clock.t = .01025;
    assert.equal(m.driverDescriptor(0, clock.t).emfVpp, 0);
    bench.solution();
    assert.notEqual(run(m, edit)?.kind, 'reject');
    assert.equal(m.driverDescriptor(0, clock.t).emfVpp, 0, 'an old trigger cannot acquire a longer duration');
    assert.deepEqual(m.driverTransitionTimes(clock.t), []);
    assert.ok(Math.abs(bench.solution().nodeAt('A', clock.t)) < 1e-8);

    // Return through the real source menu and explicitly trigger the new setup.
    run(m, 'BURST BURST F1 F5 F3 F1');
    const fired = clock.t;
    const end = fired + m.c.extended.motion.cycles / m.c.freq;
    assert.deepEqual(m.driverTransitionTimes(fired), [end]);
    bench.solution();
    clock.t += .25 / m.c.freq;
    assert.ok(emf(m.driverDescriptor(0, clock.t), clock.t) > 2.9);
    assert.ok(bench.solution().nodeAt('A', clock.t) > 2.9);
  });
}

test('rejected edits and menu navigation preserve an active Manual Burst trigger', () => {
  const { m, clock } = setup();
  run(m, 'BURST F1 F5 F3 BACK BACK F1 100 F2 BACK F5 F3 OUT F1');
  const runtime = structuredClone(m.motionRuntime);
  clock.t = .001;
  run(m, 'BACK BACK F1');
  assert.deepEqual(m.motionRuntime, runtime);
  assert.equal(run(m, '0 F2').kind, 'reject');
  assert.deepEqual(m.motionRuntime, runtime);
  assert.deepEqual(m.driverTransitionTimes(clock.t), [.1]);
  assert.equal(m.driverDescriptor(0, clock.t).emfVpp, 6);
});

test('TRIG out settings and INT period do not interrupt an active Manual Burst', () => {
  const { m, clock } = setup();
  run(m, 'BURST F1 F5 F3 BACK BACK F1 100 F2 BACK F5 F3 OUT F1');
  const runtime = structuredClone(m.motionRuntime);
  clock.t = .001;
  run(m, 'BACK F5 F3 F2');
  assert.equal(m.c.extended.motion.triggerOut, true);
  assert.equal(m.c.extended.motion.triggerEdge, 'FALL');
  assert.deepEqual(m.motionRuntime, runtime);
  run(m, 'BACK BACK F4 1 F3');
  assert.equal(m.c.extended.motion.period, 1);
  assert.deepEqual(m.motionRuntime, runtime);
  assert.deepEqual(m.driverTransitionTimes(clock.t), [.1]);
  assert.equal(m.driverDescriptor(0, clock.t).emfVpp, 6);
});

test('Sweep marker settings do not interrupt an active Manual Sweep', () => {
  const { m, clock } = setup();
  run(m, 'SWEEP F1 F3 OUT F1');
  const runtime = structuredClone(m.motionRuntime);
  clock.t = .001;
  run(m, 'BACK BACK F5 F4 F2 F1 600 F3');
  assert.equal(m.c.extended.motion.markerOn, true);
  assert.equal(m.c.extended.motion.marker, 600);
  assert.deepEqual(m.motionRuntime, runtime);
  assert.deepEqual(m.driverTransitionTimes(clock.t), [1]);
  assert.equal(m.driverDescriptor(0, clock.t).extended.motion.mode, 'SWEEP');
});

test('ARB Memory rejects an unplayable saved region atomically and keeps session round-trippable', () => {
  const { models, m, bench } = setup();
  run(m, 'UTIL F1 F1 F5 F5');
  const previous = structuredClone(m.extended.memories[0]);
  run(m, 'ARB F4 F2 2 F2 BACK FREQ 2 F1 ARB F5 F1');
  assert.equal(m.c.extended.arb.rate, .000002);
  assert.equal(m.c.extended.arb.length, 2);
  assert.equal(m.c.extended.arb.saveLength, 4096);
  const result = run(m, 'F3 F1');
  assert.equal(result?.kind, 'reject');
  assert.match(result.text, /1µHz–60MHz/);
  assert.deepEqual(m.extended.memories[0], previous);
  assert.equal(m.c.extended.arb.rate, .000002);
  const saved = validateSession(captureSession(models, bench)), into = setup();
  restoreSession(saved, into.models, into.bench);
  assert.deepEqual(captureSession(into.models, into.bench), saved);
});

for (const [rate, length] of [[.000002, 1], [.000002, 2], [.004096, 4096], [120e6, 2], [4000, 4096]]) {
  test(`ARB Memory save at ${rate} Sa/s with ${length} samples survives export/import and loads exact data`, () => {
    const { models, m, bench } = setup();
    run(m, `ARB F4 F2 2 F2 BACK FREQ ${rate} F3`);
    assert.equal(m.c.extended.arb.rate, rate);
    run(m, 'ARB F2 F1 F2 511 F2 BACK F3');
    run(m, `ARB F5 F1 F2 ${length} F2 BACK F3 F1`);
    const stored = m.extended.memories[0].arb[0];
    assert.equal(stored.length, Math.max(2, length));
    assert.equal(stored.rate, rate);
    assert.equal(stored.points[0], 511);
    assert.equal(stored.points[1], 0);
    const saved = validateSession(captureSession(models, bench)), into = setup();
    restoreSession(saved, into.models, into.bench);
    assert.deepEqual(captureSession(into.models, into.bench), saved);
    run(into.m, 'ARB F2 F4 F4 F1 ARB F5 F2 F3 F1');
    assert.equal(into.m.c.extended.arb.points[0], 511);
    assert.equal(into.m.c.extended.arb.points[1], 0);
  });
}
