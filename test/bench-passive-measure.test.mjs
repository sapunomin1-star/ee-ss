import test from 'node:test';
import assert from 'node:assert/strict';
import { fourWireResistance, equivalentCapacitance } from '../src/bench/measure.js';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
const R = (a, b, value) => ({ kind: 'R', a, b, value });
const C = (a, b, value, id) => ({ kind: 'C', a, b, value, id });
const net = (elements, loads = []) => ({ elements, loads });
const near = (got, expected) => assert.ok(Math.abs(got - expected) <= 1e-10 * Math.max(Math.abs(expected), 1e-12), `${got} vs ${expected}`);

test('four-wire removes separate current lead resistance and preserves sense polarity', () => {
  const n = net([R('HI', 'A', 10), R('A', 'B', 100), R('B', 'LO', 20)]);
  near(fourWireResistance(n, 'HI', 'LO', 'HI', 'LO'), 130);
  near(fourWireResistance(n, 'HI', 'LO', 'A', 'B'), 100);
  near(fourWireResistance(n, 'HI', 'LO', 'B', 'A'), -100);
  assert.equal(fourWireResistance(n, 'HI', 'LO', 'A', 'floating'), null);
});
test('four-wire sees parallel loads and bridge current division', () => {
  const n = net([R('A', 'B', 100), R('A', 'B', 100)], [{ a: 'A', b: 'B', r: 100 }]);
  near(fourWireResistance(n, 'A', 'B', 'A', 'B'), 100 / 3);
  assert.equal(fourWireResistance(n, 'A', 'B', 'A', 'A'), 0);
});
test('equivalent capacitance computes series, parallel and a balanced bridge', () => {
  near(equivalentCapacitance(net([C('A', 'X', 100e-9, 'C1'), C('X', 'B', 100e-9, 'C2')]), 'A', 'B').value, 50e-9);
  near(equivalentCapacitance(net([C('A', 'B', 100e-9, 'C1'), C('A', 'B', 47e-9, 'C2')]), 'A', 'B').value, 147e-9);
  const bridge = net([C('A', 'X', 1e-6, '1'), C('X', 'B', 1e-6, '2'), C('A', 'Y', 1e-6, '3'), C('Y', 'B', 1e-6, '4'), C('X', 'Y', 10e-6, '5')]);
  near(equivalentCapacitance(bridge, 'A', 'B').value, 1e-6);
});
test('capacitance rejects short, missing network, stored charge and resistive leakage', () => {
  const n = net([C('A', 'B', 100e-9, 'C1')]);
  assert.equal(equivalentCapacitance(n, 'A', 'A').value, null);
  assert.equal(equivalentCapacitance(n, 'A', 'X').value, null);
  assert.match(equivalentCapacitance(n, 'A', 'B', { C1: 2.5 }).why, /電荷/);
  assert.match(equivalentCapacitance(net([...n.elements, R('A', 'B', 1e6)]), 'A', 'B').why, /電阻/);
  near(equivalentCapacitance(net([...n.elements, R('A', 'dangling', 1000)]), 'A', 'B').value, 100e-9);
});
test('Bench exposes real four-lead resistance, passive capacitance and powered rejection', () => {
  const m = createInstruments(), b = new Bench(m.afg, m.dmm, m.gpe); b.now = () => 1;
  m.dmm.fn = 'OHM';
  m.afg.ch.forEach((c) => c.output = false);
  b.wires = { 'DMM.HI': 'A', 'DMM.LO': 'B', 'DMM.SHI': 'A', 'DMM.SLO': 'B' };
  near(b.dmmInput().ohm4, b.R);
  b.wires = { 'DMM.HI': 'B', 'DMM.LO': 'G' };
  near(b.dmmInput().cap, b.C);
  b.wires['GPE.CH1+'] = 'B'; b.wires['GPE.CH1-'] = 'G'; m.gpe.on = true; m.gpe.output = true;
  assert.equal(b.dmmInput().cap, null); assert.match(b.dmmInput().whyC, /關閉/);
});
