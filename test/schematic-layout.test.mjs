import test from 'node:test';
import assert from 'node:assert/strict';
import { Breadboard, BB_DEMO } from '../src/bench/breadboard.js';
import { buildSchematicNet } from '../src/bench/schematic-net.js';
import { buildSchematicLayout } from '../src/bench/schematic-layout.js';

const resistor = (id, a, b) => ({ id, kind: 'R', a, b, value: 1000 });
const source = (a = 'input', b = 'return') => ({ id: 'GPE.CH1', kind: 'source', wave: 'dc', a, b, label: 'GPE CH1' });
const net = (components, extraNodes = []) => ({
  nodes: [...new Set([...components.flatMap((edge) => [edge.a, edge.b]), ...extraNodes])].map((id) => ({ id })), components,
});
const pointKey = (point) => point.join(',');
const onSegment = (p, a, b) => (a[0] === b[0] ? p[0] === a[0] : p[1] === a[1])
  && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
  && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
function intersection(first, second) {
  const [a, b] = first, [c, d] = second, horizontalA = a[1] === b[1], horizontalB = c[1] === d[1];
  if (horizontalA !== horizontalB) {
    const point = horizontalA ? [c[0], a[1]] : [a[0], c[1]];
    return onSegment(point, a, b) && onSegment(point, c, d) ? { point } : null;
  }
  const axis = horizontalA ? 0 : 1, cross = 1 - axis;
  if (a[cross] !== c[cross]) return null;
  const low = Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
  const high = Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis]));
  if (low > high) return null;
  const point = [...a]; point[axis] = low;
  return { point, overlap: high > low };
}
const pins = (edge) => [[edge.x1, edge.y1], [edge.x2, edge.y2]];
const terminalAt = (edge, point) => pointKey(point) === pointKey(pins(edge)[0]) ? edge.a : pointKey(point) === pointKey(pins(edge)[1]) ? edge.b : null;

function checkNoFalseConnections(drawing) {
  for (let i = 0; i < drawing.wires.length; i++) for (let j = i + 1; j < drawing.wires.length; j++) {
    const [first, second] = [drawing.wires[i], drawing.wires[j]];
    if (first.netId === second.netId) continue;
    const hit = intersection(first.points, second.points);
    if (!hit) continue;
    assert.ok(!hit.overlap, 'distinct nets never share a wire segment');
    assert.ok(drawing.crossings.some((crossing) => crossing.x === hit.point[0] && crossing.y === hit.point[1]
      && [crossing.overNetId, crossing.underNetId].includes(first.netId) && [crossing.overNetId, crossing.underNetId].includes(second.netId)), 'every distinct-net crossing is explicitly bridged');
  }
  for (const edge of drawing.edges) for (const wire of drawing.wires) {
    const hit = intersection(pins(edge), wire.points);
    if (!hit) continue;
    assert.ok(!hit.overlap, `${edge.id}: a wire cannot run through a component symbol`);
    assert.equal(terminalAt(edge, hit.point), wire.netId, `${edge.id}: wires only touch the matching component terminal`);
  }
  for (let i = 0; i < drawing.edges.length; i++) for (let j = i + 1; j < drawing.edges.length; j++) {
    const [first, second] = [drawing.edges[i], drawing.edges[j]], hit = intersection(pins(first), pins(second));
    if (!hit) continue;
    assert.ok(!hit.overlap, 'components do not overlap');
    const terminal = terminalAt(first, hit.point);
    assert.ok(terminal !== null && terminal === terminalAt(second, hit.point), 'components only meet at actual shared terminals');
  }
}

// Independent geometry oracle: union conductor points, without treating the
// component itself as a wire. Every original net must connect all of its pins
// to its displayed node by actual drawn lines, not matching text labels.
function checkConnectivity(drawing, original, sources = []) {
  assert.deepEqual(drawing.nodes.map((node) => node.id).sort(), original.nodes.map((node) => node.id).sort());
  assert.deepEqual(drawing.edges.map((edge) => edge.id).sort(), [...original.components, ...sources].map((edge) => edge.id).sort());
  for (const expected of [...original.components, ...sources]) {
    const edge = drawing.edges.find((edge) => edge.id === expected.id);
    assert.equal(edge.a, expected.a, `${edge.id}: first pin belongs to original a`);
    assert.equal(edge.b, expected.b, `${edge.id}: second pin belongs to original b`);
    assert.ok(edge.x1 === edge.x2 || edge.y1 === edge.y2, `${edge.id}: straight symbol`);
    assert.ok(Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1) >= 100, `${edge.id}: readable symbol`);
  }
  for (const node of original.nodes) {
    const wires = drawing.wires.filter((wire) => wire.netId === node.id);
    const anchor = drawing.nodes.find((actual) => actual.id === node.id);
    const points = [[anchor.x, anchor.y], ...wires.flatMap((wire) => wire.points)];
    for (const edge of drawing.edges) {
      if (edge.a === node.id) points.push([edge.x1, edge.y1]);
      if (edge.b === node.id) points.push([edge.x2, edge.y2]);
    }
    const parent = new Map(points.map((point) => [pointKey(point), pointKey(point)]));
    const find = (key) => parent.get(key) === key ? key : find(parent.get(key));
    const union = (a, b) => parent.set(find(a), find(b));
    for (const wire of wires) {
      const [a, b] = wire.points;
      assert.ok(a[0] === b[0] || a[1] === b[1]);
      for (const point of points) if (onSegment(point, a, b)) union(pointKey(a), pointKey(point));
    }
    assert.equal(new Set(points.map((point) => find(pointKey(point)))).size, 1, `${node.id}: every pin has a physical conductor path`);
  }
  for (const crossing of drawing.crossings) {
    assert.notEqual(crossing.overNetId, crossing.underNetId);
    assert.ok(!drawing.junctions.some((dot) => dot.x === crossing.x && dot.y === crossing.y), 'crossed nets never get a junction dot');
  }
  for (const point of [...drawing.nodes, ...drawing.wires.flatMap((wire) => wire.points.map(([x, y]) => ({ x, y })))]) {
    assert.ok(point.x >= 0 && point.x <= drawing.width && point.y >= 0 && point.y <= drawing.height, 'geometry remains inside canvas');
  }
  checkNoFalseConnections(drawing);
}

test('layout: textbook R1 + (R2 || R3) uses source left, series top, parallel vertical and real return wire', () => {
  const circuit = net([resistor('R1', 'input', 'mid'), resistor('R2', 'mid', 'return'), resistor('R3', 'mid', 'return')]);
  const supply = source(), drawing = buildSchematicLayout(circuit, { sources: [supply] });
  checkConnectivity(drawing, circuit, [supply]);
  assert.equal(drawing.layout, 'series-parallel');
  const [r1, r2, r3, voltage] = ['R1', 'R2', 'R3', 'GPE.CH1'].map((id) => drawing.edges.find((edge) => edge.id === id));
  assert.equal(r1.y1, r1.y2);
  assert.equal(r2.x1, r2.x2); assert.equal(r3.x1, r3.x2);
  assert.equal(r2.y1, r3.y1); assert.equal(r2.y2, r3.y2);
  assert.ok(voltage.x1 < r1.x1 && r1.x2 < r2.x1 && r2.x1 < r3.x1);
  assert.ok(voltage.y2 > r2.y2);
  assert.ok(drawing.wires.some((wire) => wire.netId === 'return' && wire.points[0][0] === voltage.x2 && wire.points[1][0] >= r3.x2));
  assert.equal(drawing.crossings.length, 0);
  assert.equal(drawing.junctions.length, 2);
});

test('layout: actual breadboard RC has one AFG source loop and capacitor on the right', () => {
  const bb = new Breadboard(), wires = {}; bb.load(BB_DEMO.rc, wires);
  const circuit = buildSchematicNet(bb, wires), supply = { ...source('8U', 'E'), id: 'AFG.CH1', wave: 'ac' };
  const drawing = buildSchematicLayout(circuit, { sources: [supply] });
  checkConnectivity(drawing, circuit, [supply]);
  const resistance = drawing.edges.find((edge) => edge.id === 'R1'), capacitance = drawing.edges.find((edge) => edge.id === 'C1');
  assert.equal(resistance.y1, resistance.y2); assert.equal(capacitance.x1, capacitance.x2);
  assert.equal(capacitance.b, 'E'); assert.equal(drawing.crossings.length, 0);
});

test('layout: reversed component endpoints retain their original pin-to-net association', () => {
  const circuit = net([resistor('R1', 'mid', 'input'), resistor('R2', 'return', 'mid'), resistor('R3', 'mid', 'return')]);
  const supply = source(), drawing = buildSchematicLayout(circuit, { sources: [supply] });
  checkConnectivity(drawing, circuit, [supply]);
  const r1 = drawing.edges.find((edge) => edge.id === 'R1'), r2 = drawing.edges.find((edge) => edge.id === 'R2');
  assert.ok(r1.x1 > r1.x2, 'reversed R1 physical a stays on mid, at right');
  assert.ok(r2.y1 > r2.y2, 'reversed R2 physical a stays on return, at bottom');
});

test('layout: source polarity follows actual a/b even when graph traversal order differs', () => {
  const circuit = net([resistor('R1', 'input', 'mid'), resistor('R2', 'mid', 'return')]);
  const supply = source('return', 'input'), drawing = buildSchematicLayout(circuit, { sources: [supply] });
  checkConnectivity(drawing, circuit, [supply]);
  const voltage = drawing.edges.find((edge) => edge.isSource);
  assert.equal(voltage.a, 'return'); assert.equal(voltage.b, 'input');
  assert.ok(voltage.y1 < voltage.y2, 'positive actual terminal is drawn above negative');
});

test('layout: unequal nested parallel branches retain internal series nodes and conductor paths', () => {
  const circuit = net([
    resistor('R1', 'input', 'mid'), resistor('R2', 'input', 'x'), resistor('R3', 'x', 'mid'),
    resistor('R4', 'input', 'y'), resistor('R5', 'y', 'mid'), resistor('R6', 'mid', 'return'),
  ]);
  const supply = source(), drawing = buildSchematicLayout(circuit, { sources: [supply] });
  checkConnectivity(drawing, circuit, [supply]);
  assert.equal(drawing.layout, 'series-parallel');
  assert.equal(drawing.crossings.length, 0, 'bottom return must clear the lower parallel branches');
});

test('layout: a bridge gets actual routed conductors and explicit non-junction crossings', () => {
  const circuit = net([
    resistor('R1', 'input', 'x'), resistor('R2', 'x', 'return'),
    resistor('R3', 'input', 'y'), resistor('R4', 'y', 'return'), resistor('R5', 'x', 'y'),
  ]);
  const supply = source(), drawing = buildSchematicLayout(circuit, { sources: [supply] });
  checkConnectivity(drawing, circuit, [supply]);
  assert.equal(drawing.layout, 'connected');
  assert.ok(drawing.wires.length > 0);
  assert.ok(drawing.crossings.length > 0);
  assert.ok(drawing.crossings.every((crossing) => crossing.orientation === 'vertical'));
});

test('layout: shorted components and shorted sources stay visible with both pins wired to the same actual net', () => {
  const circuit = net([resistor('R1', 'earth', 'earth'), resistor('R2', 'earth', 'loose')]);
  const supply = source('earth', 'earth'), drawing = buildSchematicLayout(circuit, { sources: [supply] });
  checkConnectivity(drawing, circuit, [supply]);
  assert.equal(drawing.edges.length, 3);
  assert.equal(drawing.edges.find((edge) => edge.id === 'R1').a, 'earth');
  assert.equal(drawing.edges.find((edge) => edge.isSource).b, 'earth');
});

test('layout: missing source clip does not fabricate a voltage source or a return connection', () => {
  const circuit = net([resistor('R1', 'input', 'mid'), resistor('R2', 'mid', 'dangling')]);
  const drawing = buildSchematicLayout(circuit);
  checkConnectivity(drawing, circuit);
  assert.ok(drawing.edges.every((edge) => !edge.isSource));
  assert.equal(drawing.wires.length, 0, 'series edges meet at mid but the open endpoints stay open');
});

test('layout: disconnected passive islands, lead-only and wire-only nets remain separate and inspectable', () => {
  const circuit = net([resistor('R1', 'input', 'return'), resistor('R2', 'separateA', 'separateB')], ['wireOnly', 'leadOnly']);
  const supply = source(), drawing = buildSchematicLayout(circuit, { sources: [supply] });
  checkConnectivity(drawing, circuit, [supply]);
  assert.equal(drawing.regions.length, 4);
  assert.ok(drawing.regions.every((region, index) => index === 0 || region.y >= drawing.regions[index - 1].y + drawing.regions[index - 1].height));
  assert.equal(drawing.nodes.filter((node) => ['wireOnly', 'leadOnly'].includes(node.id)).length, 2);
});

test('layout: multiple real sources preserve all independently labelled branches', () => {
  const circuit = net([resistor('R1', 'input', 'return')], ['second']);
  const supplies = [source(), { ...source('second', 'return'), id: 'GPE.CH2' }];
  const drawing = buildSchematicLayout(circuit, { sources: supplies });
  checkConnectivity(drawing, circuit, supplies);
  assert.equal(drawing.edges.filter((edge) => edge.isSource).length, 2);
});

test('layout: empty input and deeply frozen inputs are deterministic and never mutated', () => {
  assert.equal(buildSchematicLayout(net([])).layout, 'empty');
  const circuit = net([resistor('R1', 'input', 'return')]), supplies = [source()];
  const before = JSON.stringify({ circuit, supplies });
  const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } };
  freeze(circuit); freeze(supplies);
  const first = buildSchematicLayout(circuit, { sources: supplies });
  assert.deepEqual(buildSchematicLayout(circuit, { sources: supplies }), first);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.equal(JSON.stringify({ circuit, supplies }), before);
  checkConnectivity(first, circuit, supplies);
});
