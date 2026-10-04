import test from 'node:test';
import assert from 'node:assert/strict';
import { TdsModel } from '../src/instruments/tds/model.js';

// Independent continuous-time oracle: complex harmonic response plus explicit
// scalar exponential convolutions. It does not use the model's matrix
// exponential, sampled filter kernels, or saved filter state.
const TAU = 2 * Math.PI;
const OMEGA = TAU * 2;
const FIRST = .37, SECOND = .83;
const physicalSine = (t) => 3 + 2 * Math.sin(OMEGA * t);
const multiply = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const decay = (rate, time) => Math.exp(-rate * time);

function convolution(a, b, time) {
  if (a === b) return time * decay(a, time); // repeated 10 Hz poles
  const delta = b - a;
  return delta > 0 ? decay(a, time) * -Math.expm1(-delta * time) / delta
    : decay(b, time) * Math.expm1(delta * time) / delta;
}

function stages(probe, bandwidth, trigger) {
  return [{ rate: TAU * (probe === 10 ? 1 : 10), high: true },
    ...(bandwidth ? [{ rate: TAU * 20e6, high: false }] : []),
    ...(trigger === 'DC' ? [] : [{ rate: TAU * (trigger === 'AC' ? 10 : trigger === 'HF' ? 80e3 : 300e3), high: trigger !== 'HF' }])];
}

function harmonicState(probe, bandwidth, trigger, time) {
  let transfer = [1, 0], dc = 3 / probe;
  const states = [];
  for (const pole of stages(probe, bandwidth, trigger)) {
    const denominator = pole.rate ** 2 + OMEGA ** 2;
    const low = [pole.rate ** 2 / denominator, -pole.rate * OMEGA / denominator];
    const state = multiply(transfer, low);
    states.push(dc + 2 / probe * (state[0] * Math.sin(OMEGA * time) + state[1] * Math.cos(OMEGA * time)));
    transfer = multiply(transfer, pole.high ? [1 - low[0], -low[1]] : low);
    if (pole.high) dc = 0;
  }
  return { states, output: dc + 2 / probe * (transfer[0] * Math.sin(OMEGA * time) + transfer[1] * Math.cos(OMEGA * time)) };
}

function naturalResponse(initial, probe, bandwidth, trigger, elapsed) {
  const poles = stages(probe, bandwidth, trigger), a = poles[0].rate;
  const states = [initial[0] * decay(a, elapsed)];
  if (poles.length > 1) {
    const b = poles[1].rate;
    states[1] = initial[1] * decay(b, elapsed) - b * initial[0] * convolution(a, b, elapsed);
    if (poles.length > 2) {
      // The middle pole is the 20 MHz channel low-pass. Its exponential
      // response drives the last trigger capacitor, whose state is continuous.
      const c = poles[2].rate, A = -b * initial[0] / (b - a), B = initial[1] - A;
      states[2] = initial[2] * decay(c, elapsed)
        + c * (A * convolution(a, c, elapsed) + B * convolution(b, c, elapsed));
    }
  }
  let output = 0;
  poles.forEach((pole, i) => { output = pole.high ? output - states[i] : states[i]; });
  return { states, output };
}

function switchedSine(bandwidth, trigger, time) {
  if (time < FIRST) return harmonicState(1, bandwidth, trigger, time).output;
  const before = harmonicState(1, bandwidth, trigger, FIRST), after = harmonicState(10, bandwidth, trigger, FIRST);
  const firstDelta = before.states.map((value, i) => value - after.states[i]);
  if (time < SECOND) return harmonicState(10, bandwidth, trigger, time).output
    + naturalResponse(firstDelta, 10, bandwidth, trigger, time - FIRST).output;
  const old = harmonicState(10, bandwidth, trigger, SECOND);
  const carried = naturalResponse(firstDelta, 10, bandwidth, trigger, SECOND - FIRST);
  const next = harmonicState(1, bandwidth, trigger, SECOND);
  const secondDelta = old.states.map((value, i) => value + carried.states[i] - next.states[i]);
  return harmonicState(1, bandwidth, trigger, time).output
    + naturalResponse(secondDelta, 1, bandwidth, trigger, time - SECOND).output;
}

function historicalPiece(from, to, probe, period, table, at, abs) {
  return { from, to, t0: from, probe, period, table, at, abs, lam: [], coeff: [], actual: false, periodic: true };
}

function absoluteFilter({ history, table, period, abs, probeAt, probe, changedAt, now, bandwidth, trigger }) {
  const model = new TdsModel();
  model.setBenchSource(() => ({ sig: [{ table, period, at: history.at(-1).at,
    abs: (t) => { assert.ok(t <= now + 1e-12, `future voltage requested at ${t}`); return abs(t); },
    probeAt, history: () => history }, null], probe: [probe, probe], changedAt, now }));
  model.setScenario('BENCH');
  model.ch[0].coupling = 'AC'; model.ch[0].bw = bandwidth; model.trig.coup = trigger;
  model.fx = model.benchFx();
  return model.absolutePath(0, { trigger: true });
}

for (const bandwidth of [false, true]) for (const trigger of ['DC', 'AC', 'HF', 'LF']) {
  test(`probe changes preserve a 2 Hz harmonic and filter state; BW=${bandwidth}, trigger=${trigger}`, () => {
    const period = .5, table = Float64Array.from({ length: 4096 }, (_, i) => physicalSine(i * period / 4096));
    const probeAt = (t) => t < FIRST || t >= SECOND ? 1 : 10;
    const history = [[-Infinity, FIRST, 1], [FIRST, SECOND, 10], [SECOND, Infinity, 1]]
      .map(([from, to, probe]) => historicalPiece(from, to, probe, period, table, physicalSine, physicalSine));
    const at = absoluteFilter({ history, table, period, abs: physicalSine, probeAt, probe: 1,
      changedAt: SECOND, now: 1.4, bandwidth, trigger });
    const times = [.1, .3, FIRST - 1e-8,
      ...[FIRST, SECOND].flatMap((t) => [0, 1e-8, 1e-6, .001, .01, .1, .3].map((dt) => t + dt))];
    for (const time of times) {
      const expected = switchedSine(bandwidth, trigger, time), actual = at(time);
      // The 4096-point periodic source interpolation contributes <1 µV here.
      assert.ok(Math.abs(actual - expected) < 1.5e-6, `t=${time}: ${actual} versus ${expected} BNC V`);
    }
  });

  test(`simultaneous DC step/probe change retains every capacitor; BW=${bandwidth}, trigger=${trigger}`, () => {
    const boundary = 1, abs = (t) => t < boundary ? 5 : 4, probeAt = (t) => t < boundary ? 1 : 10;
    const history = [[-Infinity, boundary, 1, 5], [boundary, Infinity, 10, 4]].map(([from, to, probe, value]) =>
      historicalPiece(from, to, probe, 1, Float64Array.of(value, value), () => value, abs));
    const at = absoluteFilter({ history, table: Float64Array.of(4, 4), period: 1, abs, probeAt, probe: 10,
      changedAt: boundary, now: 1.5, bandwidth, trigger });
    const initial = [4.6, ...Array(stages(10, bandwidth, trigger).length - 1).fill(0)];
    for (const offset of [0, 1e-9, 5e-9, 1e-8, 2e-8, 5e-8, 1e-7, 3e-7, 1e-6, 1e-5, .001, .01, .1]) {
      const time = boundary + offset;
      // Subtract the represented epoch: 1 s + 1 ns loses ~8e-17 s, a visible
      // effect at the 20 MHz pole if the oracle uses the requested offset.
      const expected = naturalResponse(initial, 10, bandwidth, trigger, time - boundary).output, actual = at(time);
      assert.ok(Math.abs(actual - expected) < 2e-9, `offset=${offset}: ${actual} versus ${expected} BNC V`);
    }
  });
}
