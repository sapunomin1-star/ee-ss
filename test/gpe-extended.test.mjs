import test from 'node:test';
import assert from 'node:assert/strict';
import { GpeModel, K } from '../src/instruments/gpe/model.js';

test('GPE startup Output selection is staged, confirmed, retained at power cycles and defaults OFF', () => {
  const m = new GpeModel(); assert.equal(m.startupOutput, false);
  m.beginSetup('output'); assert.equal(m.output, false);
  m.press(K.SET); assert.equal(m.setup.value, true); assert.equal(m.startupOutput, false);
  assert.equal(m.readback(), null);
  m.press(K.OUT); assert.equal(m.startupOutput, true); assert.equal(m.output, false); assert.equal(m.setup, null);
  m.press(K.POWER); m.press(K.POWER); assert.equal(m.output, true); assert.equal(m.startupOutput, true);
  m.beginSetup('output'); m.press(K.SET); m.press(K.POWER); m.press(K.POWER);
  assert.equal(m.startupOutput, true, 'cancel never commits the staged OFF');
});

test('GPE 3/4 displayed digits change formatting only, preserve output resolution, and persist', () => {
  const m = new GpeModel(); m.vset[1] = 526; m.iset[1] = 123;
  const before = m.eff(1); m.beginSetup('digits'); m.press(K.SET);
  assert.equal(m.setup.value, 3); assert.equal(m.digits, 4);
  assert.equal(m.rowView(1).v, '5.3'); assert.equal(m.rowView(1).a, '0.12');
  m.press(K.OUT); assert.equal(m.digits, 3); assert.deepEqual(m.eff(1), before);
  m.press(K.POWER); m.press(K.POWER); assert.equal(m.digits, 3);
  m.beginSetup('digits'); m.press(K.SET); m.press(K.OUT); assert.equal(m.digits, 4);
});

test('GPE held-key power-on enters the specified settings without energizing a circuit', () => {
  const m = new GpeModel(); m.press(K.POWER); m.press(K.POWER, { held: K.OUT });
  assert.equal(m.setup.kind, 'output'); assert.equal(m.output, false);
  m.press(K.POWER); m.press(K.POWER, { held: K.SET });
  assert.equal(m.setup.kind, 'digits'); assert.equal(m.output, false);
  const old = { ...m.vset }; m.turn(K.V1, 1); assert.deepEqual(m.vset, old);
});

test('GPE configuration flashes only its documented icon/decimal and keeps unsupported protection dark', () => {
  const m = new GpeModel(); m.beginSetup('digits'); assert.match(m.lcd(), /gpeBlink/);
  for (const name of ['OVP', 'OCP', 'OTP']) assert.doesNotMatch(m.lcd(), new RegExp('class="lit"[^>]*>' + name));
  m.reset(); assert.equal(m.startupOutput, false); assert.equal(m.digits, 4); assert.equal(m.setup, null);
});
