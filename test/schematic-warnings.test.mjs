import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench } from '../src/bench/bench.js';
import { Breadboard } from '../src/bench/breadboard.js';
import { buildSchematicNet } from '../src/bench/schematic-net.js';
import { schematicSide } from '../src/bench/schematic-view.js';

function setup(kind) {
  const models = createInstruments();
  const bench = new Bench(models.afg, models.dmm, models.gpe);
  bench.now = () => 0;
  bench.board = 'bb'; bench.bb = new Breadboard(); bench.bbWires = {};
  assert.ok(bench.bb.add(kind, 'a5', 'a10', kind === 'R' ? 1000 : 1e-7).ok);
  models.gpe.output = true; models.gpe.vset[1] = 500; models.gpe.iset[1] = 100;
  return { models, bench };
}

function cachedSide(bench) {
  const warnings = bench.solution().warn;
  bench.solution = () => { throw new Error('Inspecting a diagram must not solve the circuit'); };
  bench.now = () => { throw new Error('Inspecting a diagram must not advance/read time'); };
  return { warnings, html: schematicSide(bench, {}, '', warnings) };
}

test('schematic warnings preserve the actual unsupported mixed-source warning without solving', () => {
  const { models, bench } = setup('C');
  Object.assign(bench.bbWires, {
    'AFG.CH1+': 'b5', 'AFG.CH1-': 'b10', 'AFG.CH2+': 'c5', 'AFG.CH2-': 'c10',
    'GPE.CH1+': 'd5', 'GPE.CH1-': 'd10',
  });
  models.afg.ch.forEach((c, i) => { c.output = true; c.freq = (i + 1) * 1000; });
  const { warnings, html } = cachedSide(bench);
  const unsupported = warnings.find(w => w.text.includes('不支援不同頻率 AFG'));
  assert.ok(unsupported, 'fixture must actually produce a solver warning');
  assert.ok(html.includes(unsupported.text));
  assert.ok(!html.includes('w-ok'), 'unsupported solver result cannot be presented as all clear');
});

test('schematic warnings retain actual unsafe ammeter wiring and shunt limitation', () => {
  const { bench } = setup('R');
  Object.assign(bench.bbWires, { 'GPE.CH1+': 'b5', 'GPE.CH1-': 'b10', 'DMM.I': 'c5', 'DMM.LO': 'c10' });
  const { warnings, html } = cachedSide(bench);
  const unsafe = warnings.find(w => w.text.includes('直接並接在電源兩端'));
  const shunt = warnings.find(w => w.text.includes('等效分流負載'));
  assert.ok(unsafe && shunt, 'fixture must contain both actionable and approximation warnings');
  assert.ok(html.includes(unsafe.text) && html.includes(shunt.text));
  assert.ok(!html.includes('w-ok'));
});

test('schematic warnings keep topology-only findings without duplicating cached identical messages', () => {
  const { bench } = setup('R');
  const topology = buildSchematicNet(bench.bb, bench.bbWires).warnings;
  assert.ok(topology.length);
  bench.solution = () => { throw new Error('unexpected solver call'); };
  const html = schematicSide(bench, {}, '', topology.map(w => ({ ...w })));
  for (const warning of topology) assert.equal(html.split(warning.text).length - 1, 1);
  assert.ok(!html.includes('w-ok'));
});
