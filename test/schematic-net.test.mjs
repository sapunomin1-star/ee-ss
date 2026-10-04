import test from 'node:test';
import assert from 'node:assert/strict';
import { Breadboard, BB_DEMO } from '../src/bench/breadboard.js';
import { buildSchematicNet } from '../src/bench/schematic-net.js';

const edgeList = (net) => net.components.map(({ id, kind, a, b, value }) => [id, kind, a, b, value]);
const partitions = (net) => net.nodes.map(({ id, groups }) => [id, groups]);
const nodeForLead = (net, id) => net.leads.find((lead) => lead.id === id)?.node;
const demo = (name) => {
  const bb = new Breadboard(), wires = {};
  bb.load(BB_DEMO[name], wires);
  return { bb, wires };
};
const add = (bb, kind, a, b, value) => assert.ok(bb.add(kind, a, b, value).ok, `${kind} ${a}–${b}`);

test('schematic: RC is input–R1–output–C1–earth, with physical endpoints and all lead IDs', () => {
  const { bb, wires } = demo('rc'), net = buildSchematicNet(bb, wires);
  assert.deepEqual(partitions(net), [['E', ['T-']], ['8U', ['8U']], ['12U', ['12U']]]);
  assert.deepEqual(net.nodes.map(({ id, label, grounded }) => [id, label, grounded]), [
    ['E', 'GND', true], ['8U', 'N1', false], ['12U', 'N2', false],
  ]);
  assert.deepEqual(edgeList(net), [['R1', 'R', '8U', '12U', 1000], ['C1', 'C', '12U', 'E', 1e-7]]);
  assert.equal(nodeForLead(net, 'AFG.CH1+'), '8U');
  assert.equal(nodeForLead(net, 'TDS.CH1.TIP'), '8U');
  assert.equal(nodeForLead(net, 'TDS.CH2.TIP'), '12U');
  assert.equal(nodeForLead(net, 'DMM.HI'), '12U');
  assert.equal(nodeForLead(net, 'DMM.LO'), 'E');
  const output = net.nodes.find((node) => node.id === '12U');
  assert.deepEqual(output.holes, ['a12', 'b12', 'c12', 'd12']);
  assert.deepEqual(output.pins.map(({ partId, leg, hole }) => [partId, leg, hole]), [['R1', 'b', 'b12'], ['C1', 'a', 'a12']]);
  assert.deepEqual(output.leadIds, ['DMM.HI', 'TDS.CH2.TIP']);
  assert.deepEqual(output.groupNames, ['第 12 欄 a–e']);
  assert.deepEqual(net.components.map(({ holeA, holeB, groupA, groupB }) => [holeA, holeB, groupA, groupB]), [
    ['b8', 'b12', '8U', '12U'], ['a12', 'T-12', '12U', 'T-'],
  ]);
  assert.deepEqual(net.warnings, []);
});

test('schematic: floating GPE divider keeps its return floating and audits merged rail jumpers', () => {
  const { bb, wires } = demo('gpe'), net = buildSchematicNet(bb, wires);
  assert.deepEqual(partitions(net), [['B+', ['B+', '18L']], ['B-', ['B-', '26L']], ['22L', ['22L']]]);
  assert.deepEqual(edgeList(net), [['R1', 'R', 'B+', '22L', 1000], ['R2', 'R', '22L', 'B-', 1000]]);
  assert.ok(net.nodes.every((node) => !node.grounded));
  assert.equal(nodeForLead(net, 'GPE.CH1-'), 'B-');
  assert.equal(nodeForLead(net, 'DMM.LO'), 'B-');
  assert.deepEqual(net.jumpers.map(({ id, a, b, holeA, holeB }) => [id, a, b, holeA, holeB]), [
    ['W1', 'B+', 'B+', 'B+18', 'j18'], ['W2', 'B-', 'B-', 'j26', 'B-26'],
  ]);
  assert.deepEqual(net.nodes[0].wireIds, ['W1']);
  assert.deepEqual(net.nodes[1].wireIds, ['W2']);
  assert.deepEqual(net.warnings, []);
});

test('schematic: parallel R/C branches remain individually identified with unchanged values', () => {
  const bb = new Breadboard();
  add(bb, 'R', 'a1', 'a6', 1000);
  add(bb, 'R', 'b6', 'b1', 2200);
  add(bb, 'C', 'c1', 'c6', 47e-9);
  add(bb, 'C', 'd6', 'd1', 1e-6);
  const net = buildSchematicNet(bb);
  assert.deepEqual(partitions(net), [['1U', ['1U']], ['6U', ['6U']]]);
  assert.deepEqual(edgeList(net), [
    ['R1', 'R', '1U', '6U', 1000], ['R2', 'R', '6U', '1U', 2200],
    ['C1', 'C', '1U', '6U', 47e-9], ['C2', 'C', '6U', '1U', 1e-6],
  ]);
  assert.ok(net.components.every((part) => !part.shorted && part.dangling.length === 0));
});

test('schematic: same-strip and jumper-shorted components survive as visible self-loops', () => {
  const bb = new Breadboard();
  add(bb, 'R', 'a2', 'c2', 470);
  add(bb, 'C', 'a8', 'a12', 1e-7);
  add(bb, 'W', 'b8', 'b12');
  const net = buildSchematicNet(bb);
  assert.deepEqual(partitions(net), [['2U', ['2U']], ['8U', ['8U', '12U']]]);
  assert.deepEqual(edgeList(net), [['R1', 'R', '2U', '2U', 470], ['C1', 'C', '8U', '8U', 1e-7]]);
  assert.ok(net.components.every((part) => part.shorted));
  assert.deepEqual(net.warnings.map(({ level, partId }) => [level, partId]), [['bad', 'R1'], ['bad', 'C1']]);
});

test('schematic: instrument grounds on different strips short a component and preserve both physical groups', () => {
  const bb = new Breadboard(), wires = {};
  add(bb, 'R', 'a8', 'a12', 1000);
  assert.ok(bb.plug(wires, 'AFG.CH1-', 'b8').ok);
  assert.ok(bb.plug(wires, 'TDS.CH2.GND', 'b12').ok);
  const net = buildSchematicNet(bb, wires);
  assert.deepEqual(partitions(net), [['E', ['8U', '12U']]]);
  assert.deepEqual(edgeList(net), [['R1', 'R', 'E', 'E', 1000]]);
  assert.equal(net.components[0].shorted, true);
  assert.deepEqual(net.components[0].dangling, []);
  assert.deepEqual(net.nodes[0].holes, ['a8', 'b8', 'a12', 'b12']);
  assert.deepEqual(net.nodes[0].leadIds, ['AFG.CH1-', 'TDS.CH2.GND']);
  assert.equal(net.warnings.length, 1);
  assert.match(net.warnings[0].text, /大地.*短路/);
});

test('schematic: negative rails, GPE minus and meter LO become earth only after an actual ground connection', () => {
  const bb = new Breadboard(), wires = { 'GPE.CH1-': 'T-1', 'DMM.LO': 'B-1', 'GPE.CH2-': 'a3' };
  let net = buildSchematicNet(bb, wires);
  assert.deepEqual(partitions(net), [['T-', ['T-']], ['B-', ['B-']], ['3U', ['3U']]]);
  assert.ok(net.nodes.every((node) => !node.grounded));
  assert.ok(bb.plug(wires, 'GPE.GND', 'T-2').ok);
  net = buildSchematicNet(bb, wires);
  assert.deepEqual(partitions(net), [['E', ['T-']], ['B-', ['B-']], ['3U', ['3U']]]);
  assert.equal(nodeForLead(net, 'DMM.LO'), 'B-');
  assert.equal(nodeForLead(net, 'GPE.CH2-'), '3U');
  assert.equal(nodeForLead(net, 'GPE.CH1-'), 'E');
});

test('schematic: incomplete and disconnected circuits are retained; a wire extension still leaves a bare leg', () => {
  const bb = new Breadboard();
  add(bb, 'R', 'a1', 'a2', 1000);
  add(bb, 'W', 'b2', 'f8');
  add(bb, 'C', 'a15', 'a20', 1e-6);
  const net = buildSchematicNet(bb, { 'DMM.HI': 'j30' });
  assert.deepEqual(partitions(net), [['1U', ['1U']], ['2U', ['2U', '8L']], ['15U', ['15U']], ['20U', ['20U']], ['30L', ['30L']]]);
  assert.deepEqual(edgeList(net), [['R1', 'R', '1U', '2U', 1000], ['C1', 'C', '15U', '20U', 1e-6]]);
  assert.deepEqual(net.components.map(({ dangling }) => dangling), [['a', 'b'], ['a', 'b']]);
  assert.equal(nodeForLead(net, 'DMM.HI'), '30L');
  assert.deepEqual(net.warnings.map(({ level, partId }) => [level, partId]), [['info', 'R1'], ['info', 'C1']]);
});

test('schematic: jumper-only islands and an empty board produce honest audit data', () => {
  const bb = new Breadboard();
  assert.deepEqual(buildSchematicNet(bb), { nodes: [], components: [], jumpers: [], leads: [], warnings: [] });
  add(bb, 'W', 'e9', 'f9');
  add(bb, 'W', 'T+1', 'a4');
  const net = buildSchematicNet(bb);
  assert.deepEqual(partitions(net), [['T+', ['T+', '4U']], ['9U', ['9U', '9L']]]);
  assert.deepEqual(net.nodes.map(({ holes }) => holes), [['T+1', 'a4'], ['e9', 'f9']]);
  assert.deepEqual(net.components, []);
  assert.equal(net.jumpers.length, 2);
  assert.equal(net.nodes.reduce((sum, node) => sum + node.pins.length, 0), 4);
});

test('schematic: source shorts caused by separate earth clips are visible without enabling a source', () => {
  const bb = new Breadboard();
  const wires = { 'GPE.CH1+': 'a1', 'GPE.CH1-': 'a9', 'TDS.CH1.GND': 'b1', 'TDS.CH2.GND': 'b9', 'AFG.CH1+': 'c9' };
  const net = buildSchematicNet(bb, wires);
  assert.deepEqual(partitions(net), [['E', ['1U', '9U']]]);
  assert.ok(net.warnings.some(({ text }) => text.includes('GPE CH1') && text.includes('短路')));
  assert.ok(net.warnings.some(({ text }) => text.includes('AFG CH1') && text.includes('短路')));
});

test('schematic: output order and labels do not depend on part or lead object insertion order', () => {
  const { bb, wires } = demo('gpe');
  add(bb, 'C', 'a2', 'a10', 1e-6);
  const expected = buildSchematicNet(bb, wires);
  bb.parts.reverse();
  const reordered = Object.fromEntries(Object.entries(wires).reverse());
  assert.deepEqual(buildSchematicNet(bb, reordered), expected);
  assert.deepEqual(JSON.parse(JSON.stringify(expected)), expected);
});

test('schematic: reads accept frozen state and result edits cannot mutate the breadboard or instrument wiring', () => {
  const { bb, wires } = demo('rc');
  const before = JSON.stringify({ parts: bb.parts, wires });
  bb.parts.forEach(Object.freeze);
  Object.freeze(bb.parts); Object.freeze(bb); Object.freeze(wires);
  const net = buildSchematicNet(bb, wires);
  assert.equal(JSON.stringify({ parts: bb.parts, wires }), before);
  net.components[0].value = 1;
  net.components[0].holeA = 'a1';
  net.nodes[0].pins[0].hole = 'a1';
  net.nodes[0].groups.push('fake');
  net.leads[0].hole = 'a1';
  assert.equal(JSON.stringify({ parts: bb.parts, wires }), before);
  assert.equal(buildSchematicNet(bb, wires).components[0].value, 1000);
});
