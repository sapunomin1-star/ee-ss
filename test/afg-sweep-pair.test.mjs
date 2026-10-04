import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
import { captureSession, validateSession } from '../src/core/session.js';
import { activeChannelsError } from '../src/instruments/afg/motion.js';
import { emf } from '../src/bench/circuit.js';

function run(m, sequence) {
  let result;
  for (const key of sequence.split(' ')) {
    if (/^[\d.]+$/.test(key)) {
      for (const digit of key) result = m.press(`AFG.NUM.${digit === '.' ? 'DOT' : `DIGIT_${digit}`}`);
    } else result = m.press(/^F\d$/.test(key) ? `AFG.SOFT.${key}` : `AFG.KEY.${({ CH: 'CH1_CH2', FREQ: 'FREQ_RATE', OUT: 'OUTPUT', BACK: 'RETURN' })[key] || key}`);
  }
  return result;
}

function setup(start = 999.123) {
  const models = createInstruments(), m = models.afg, bench = new Bench(m, models.dmm, models.gpe), clock = { t: 0 };
  bench.now = () => clock.t;
  m.setTriggerSource(() => clock.t);
  bench.wires = { 'AFG.CH1+': 'A', 'AFG.CH1-': 'G', 'AFG.CH2+': 'B', 'AFG.CH2-': 'G' };
  run(m, `SWEEP F1 F3 BACK BACK F3 ${start} F3 BACK OUT F1 F3`);
  assert.equal(m.c.extended.motion.start, start);
  assert.equal(m.c.extended.motion.source, 'MANUAL');
  assert.equal(m.c.output, true);
  bench.solution();
  return { models, m, bench, clock };
}

for (const phase of ['pending', 'running', 'completed']) {
  test(`Manual Sweep ${phase}: incompatible second output is rejected before any solver transition`, () => {
    const { m, bench, clock } = setup();
    if (phase !== 'pending') { run(m, 'F1'); bench.solution(); }
    clock.t = phase === 'completed' ? 1.1 : .25;
    bench.solution();
    run(m, 'CH');
    const before = structuredClone(m.ch), runtime = structuredClone(m.motionRuntime), history = bench.segs.length;
    const result = run(m, 'OUT');
    assert.equal(result.kind, 'reject');
    assert.match(result.text, /共同週期|頻率組合/);
    assert.deepEqual(m.ch, before);
    assert.deepEqual(m.motionRuntime, runtime);
    assert.doesNotThrow(() => bench.solution());
    assert.equal(bench.segs.length, history);
  });
}

test('editing the Start frequency of an active compatible pair is rejected atomically', () => {
  const { m, bench, clock } = setup(100);
  run(m, 'CH OUT CH SWEEP SWEEP F1 F3 F1');
  clock.t = .25; bench.solution();
  run(m, 'BACK BACK F3');
  const before = structuredClone(m.ch), runtime = structuredClone(m.motionRuntime);
  assert.ok(runtime[0]);
  assert.equal(run(m, '999.123 F3')?.kind, 'reject');
  assert.deepEqual(m.ch, before);
  assert.deepEqual(m.motionRuntime, runtime);
  assert.doesNotThrow(() => bench.solution());
});

test('compatible Manual Sweep and continuous output solve while waiting, running and after completion', () => {
  const { m, bench, clock } = setup(100);
  assert.notEqual(run(m, 'CH OUT')?.kind, 'reject');
  assert.deepEqual(m.ch.map(c => c.output), [true, true]);
  assert.doesNotThrow(() => bench.solution());
  run(m, 'CH SWEEP SWEEP F1 F3 F1');
  assert.ok(m.motionRuntime[0]);
  for (const time of [.25, 1.1]) {
    clock.t = time;
    assert.doesNotThrow(() => bench.solution());
    assert.ok(Number.isFinite(bench.solution().nodeAt('B', time)));
  }
  assert.equal(m.driverDescriptor(0, clock.t).extended.motion.mode, 'CONT');
  assert.equal(m.driverDescriptor(0, clock.t).freq, 100);
});

test('two Manual Sweeps must also support one running while the other is still at Start', () => {
  const { m, bench } = setup();
  run(m, 'CH SWEEP F1 F3 BACK BACK F3 999.123 F3 BACK');
  assert.equal(m.ch[1].extended.motion.start, 999.123);
  const before = structuredClone(m.ch);
  assert.equal(run(m, 'OUT').kind, 'reject');
  assert.deepEqual(m.ch, before);
  assert.doesNotThrow(() => bench.solution());
});

test('Manual Infinite Burst uses its actual continuous carrier rather than a fictitious N-cycle period', () => {
  const { m, bench, clock } = setup();
  run(m, 'PRESET BURST F1 F5 F3 BACK BACK F2 OUT CH');
  assert.notEqual(run(m, 'OUT')?.kind, 'reject');
  assert.deepEqual(m.ch.map(c => c.output), [true, true]);
  assert.doesNotThrow(() => bench.solution());
  run(m, 'CH BURST BURST F1 F5 F3 F1');
  assert.ok(m.motionRuntime[0]);
  clock.t = .00025;
  assert.equal(m.driverDescriptor(0, clock.t).extended.motion.mode, 'CONT');
  assert.ok(emf(m.driverDescriptor(0, clock.t), clock.t) > 2.9);
  assert.doesNotThrow(() => bench.solution());
});

test('finite Manual Bursts validate staggered trigger states instead of only two configured bursts', () => {
  const { m, bench } = setup();
  run(m, 'PRESET BURST F1 F5 F3 OUT CH BURST F1 F5 F3');
  const before = structuredClone(m.ch);
  assert.equal(run(m, 'OUT').kind, 'reject');
  assert.deepEqual(m.ch, before);
  assert.doesNotThrow(() => bench.solution());
});

test('delayed Infinite Burst checks its pre-delay driver as well as the continuous carrier', () => {
  const { m, bench } = setup();
  run(m, 'PRESET BURST F1 F5 F3 BACK BACK F2 F5 F4 50 F2 BACK OUT CH');
  assert.ok(Math.abs(m.ch[0].extended.motion.delay - .00005) < 1e-19);
  assert.equal(run(m, 'OUT').kind, 'reject');
  assert.deepEqual(m.ch.map(c => c.output), [true, false]);
  assert.doesNotThrow(() => bench.solution());
});

test('disabled channels stay configurable but saved active Manual pairs cannot bypass validation', () => {
  const { m, models, bench } = setup();
  assert.equal(activeChannelsError(m.ch), null);
  const saved = captureSession(models, bench);
  assert.doesNotThrow(() => validateSession(saved));
  saved.instruments.afg.ch[1].output = true;
  assert.throws(() => validateSession(saved), /共同週期|頻率組合/);
});
