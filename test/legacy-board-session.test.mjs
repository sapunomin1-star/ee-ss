import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstruments } from '../src/instruments/index.js';
import { Bench, DEMO } from '../src/bench/bench.js';
import { Breadboard, BB_DEMO } from '../src/bench/breadboard.js';
import { LEADS } from '../src/bench/circuit.js';
import { captureSession, restoreSession, validateSession } from '../src/core/session.js';
import { prepareBreadboardSession, swapArchivedBreadboardSession } from '../src/bench/legacy-board.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
function setup() {
  const models = createInstruments(), bench = new Bench(models.afg, models.dmm, models.gpe);
  bench.bb = new Breadboard();
  bench.now = () => 0;
  models.dmm.now = () => 0;
  return { models, bench };
}
function legacy(topo = 'RC', wires = DEMO) {
  const { models, bench } = setup();
  bench.topo = topo; bench.wires = { ...wires };
  bench.R = 4700; bench.C = 0.47e-6; bench.probeX = [1, 10];
  models.afg.ch[0].output = true;
  return captureSession(models, bench, { tab: 'bench', zoom: 1.5 });
}
function network(board) {
  const bb = new Breadboard();
  for (const part of board.parts) {
    const result = bb.add(part.kind, part.a, part.b, part.value);
    assert.equal(result.ok, true, result.why);
    result.part.id = part.id;
  }
  const wires = {};
  for (const [lead, hole] of Object.entries(board.wires)) assert.equal(bb.plug(wires, lead, hole).ok, true);
  return bb.netlist(wires);
}
function assertEquivalentNodes(original, migrated) {
  const net = network(migrated.bench.breadboard), fixed = original.bench.fixed;
  const nodes = { A: net.groupOf('b8'), B: net.groupOf('b12'), G: net.groupOf('T-12') };
  assert.equal(new Set(Object.values(nodes)).size, 3, 'the three fixed terminals stay separate');
  const first = fixed.topo === 'RC' ? 'R' : 'C', second = first === 'R' ? 'C' : 'R';
  for (const [kind, a, b] of [[first, 'A', 'B'], [second, 'B', 'G']]) {
    const element = net.elements.find((e) => e.kind === kind);
    assert.deepEqual([element.a, element.b, element.value], [nodes[a], nodes[b], fixed[kind]]);
  }
  assert.deepEqual(net.leads, Object.fromEntries(Object.entries(fixed.wires).map(([lead, node]) => [lead, nodes[node]])));
  assert.deepEqual(migrated.bench.probeX, original.bench.probeX);
}

for (const topo of ['RC', 'CR']) {
  test(`${topo}: old fixed experiment migrates without mutation or changing measured waveforms`, () => {
    const data = legacy(topo), before = clone(data);
    const result = prepareBreadboardSession(data);
    assert.equal(result.converted, true); assert.equal(result.archived, false);
    assert.equal(result.session.bench.board, 'bb'); assert.equal(result.session.ui.benchView, 'breadboard');
    assert.deepEqual(data, before);
    assert.deepEqual(result.session.instruments, data.instruments);
    assertEquivalentNodes(data, result.session);
    assert.deepEqual(validateSession(result.session), result.session);
    const original = setup(), converted = setup();
    restoreSession(data, original.models, original.bench);
    restoreSession(result.session, converted.models, converted.bench);
    const first = original.bench.tdsInput(), second = converted.bench.tdsInput();
    for (let ch = 0; ch < 2; ch++) for (const time of [0, 0.0001, 0.0004, 0.001, 0.002, 0.01]) {
      assert.ok(Math.abs(first.sig[ch].abs(time) - second.sig[ch].abs(time)) < 1e-9, `${topo} CH${ch + 1} at ${time}`);
    }
  });
  for (const node of ['A', 'B', 'G']) test(`${topo}: all ${Object.keys(LEADS).length} instrument leads fit node ${node} with no shared holes`, () => {
    const data = legacy(topo, Object.fromEntries(Object.keys(LEADS).map((lead) => [lead, node])));
    const { session } = prepareBreadboardSession(data);
    assertEquivalentNodes(data, session);
    assert.equal(Object.keys(session.bench.breadboard.wires).length, Object.keys(LEADS).length);
    assert.equal(session.bench.breadboard.parts.filter((p) => p.kind === 'W').length, node === 'G' ? 0 : 1);
  });
  test(`${topo}: mixed high fan-out extends A and B independently and preserves every instrument terminal`, () => {
    const data = legacy(topo, Object.fromEntries(Object.keys(LEADS).map((lead, i) => [lead, ['A', 'B', 'G'][i % 3]])));
    const { session } = prepareBreadboardSession(data);
    assertEquivalentNodes(data, session);
    assert.equal(session.bench.breadboard.parts.filter((p) => p.kind === 'W').length, 2);
  });
}

test('an inactive old breadboard is archived, survives save/restore, and swaps both ways without losing either board', () => {
  const original = setup();
  original.bench.bb.load(BB_DEMO.gpe, original.bench.bbWires);
  original.bench.wires = { ...DEMO };
  const data = captureSession(original.models, original.bench), before = clone(data);
  const result = prepareBreadboardSession(data);
  assert.equal(result.archived, true); assert.deepEqual(data, before);
  assert.deepEqual(result.session.bench.breadboardArchive, data.bench.breadboard);
  const restored = setup(), ui = restoreSession(result.session, restored.models, restored.bench);
  const saved = captureSession(restored.models, restored.bench, ui);
  assert.deepEqual(saved, result.session);
  const swapped = swapArchivedBreadboardSession(saved);
  assert.equal(swapped.bench.board, 'bb'); assert.equal(swapped.ui.benchView, 'breadboard');
  assert.deepEqual(swapped.bench.breadboard, data.bench.breadboard);
  assert.deepEqual(swapped.bench.breadboardArchive, saved.bench.breadboard);
  assert.deepEqual(swapArchivedBreadboardSession(swapped), saved);
  assert.deepEqual(saved, result.session, 'swapping does not mutate the supplied file');
  assert.deepEqual(prepareBreadboardSession(saved).session, saved, 'migrated files are not converted a second time');
});

test('an inactive board containing only instrument leads is still preserved', () => {
  const data = legacy(); data.bench.breadboard.wires = { 'DMM.HI': 'a1' };
  const { session, archived } = prepareBreadboardSession(data);
  assert.equal(archived, true);
  assert.deepEqual(session.bench.breadboardArchive, data.bench.breadboard);
});

test('existing breadboard experiments stay intact and retain their chosen view', () => {
  const s = setup(); s.bench.board = 'bb'; s.bench.bb.load(BB_DEMO.current, s.bench.bbWires);
  const data = captureSession(s.models, s.bench, { tab: 'bench', benchView: 'schematic' }), before = clone(data);
  const result = prepareBreadboardSession(data);
  assert.equal(result.converted, false); assert.equal(result.archived, false);
  assert.deepEqual(result.session, data); assert.deepEqual(data, before);
  result.session.bench.breadboard.parts[0].value = 100;
  assert.deepEqual(data, before, 'the prepared session is detached');
});

test('legacy core capture/restore keep the optional view absent; both explicit views round-trip', () => {
  const s = setup(), data = captureSession(s.models, s.bench);
  assert.deepEqual(data.ui, { tab: 'afg', zoom: 1 });
  assert.deepEqual(restoreSession(data, s.models, s.bench), data.ui);
  assert.equal(s.bench.board, 'rc', 'the generic restore API does not migrate');
  for (const benchView of ['breadboard', 'schematic']) {
    const saved = captureSession(s.models, s.bench, { tab: 'bench', benchView });
    const ui = restoreSession(saved, s.models, s.bench);
    assert.deepEqual(ui, { tab: 'bench', zoom: 1, benchView });
    assert.deepEqual(captureSession(s.models, s.bench, ui), saved);
  }
});

test('restoring a file without an archive clears the previous archive', () => {
  const s = setup(), data = legacy();
  data.bench.breadboard.wires = { 'DMM.HI': 'a1' };
  restoreSession(prepareBreadboardSession(data).session, s.models, s.bench);
  assert.ok(s.bench.breadboardArchive);
  restoreSession(legacy(), s.models, s.bench);
  assert.equal(Object.hasOwn(s.bench, 'breadboardArchive'), false);
  assert.equal(Object.hasOwn(captureSession(s.models, s.bench).bench, 'breadboardArchive'), false);
});

for (const [name, corrupt] of [
  ['unknown view', (s) => { s.ui.benchView = 'fixed-rc'; }],
  ['archive with invalid hole', (s) => { s.bench.breadboardArchive = { parts: [], wires: { 'DMM.HI': 'a31' } }; }],
  ['archive with occupied hole', (s) => { s.bench.breadboardArchive = { parts: [{ id: 'R1', kind: 'R', a: 'a1', b: 'a2', value: 1000 }], wires: { 'DMM.HI': 'a1' } }; }],
  ['archive with live charge', (s) => { s.bench.breadboardArchive = { parts: [{ id: 'C1', kind: 'C', a: 'a1', b: 'a2', value: 1e-6, stateId: 'old-charge' }], wires: {} }; }],
  ['invalid original fixed node', (s) => { s.bench.fixed.wires['DMM.HI'] = 'X'; }],
]) test(`${name}: validation and migration reject without changing the file or live experiment`, () => {
  const s = setup(), saved = captureSession(s.models, s.bench), bad = clone(saved); corrupt(bad);
  const before = clone(bad), targets = [...Object.values(s.models), s.bench];
  const own = targets.map((x) => Object.getOwnPropertyDescriptors(x));
  assert.throws(() => validateSession(bad), /實驗存檔/);
  assert.throws(() => prepareBreadboardSession(bad), /實驗存檔/);
  assert.throws(() => restoreSession(bad, s.models, s.bench), /實驗存檔/);
  assert.deepEqual(bad, before);
  assert.deepEqual(targets.map((x) => Object.getOwnPropertyDescriptors(x)), own);
});

test('conflicting old archives are rejected rather than overwritten', () => {
  const data = legacy();
  data.bench.breadboard.wires = { 'DMM.HI': 'a1' };
  data.bench.breadboardArchive = { parts: [], wires: { 'DMM.LO': 'b1' } };
  const before = clone(data);
  assert.throws(() => prepareBreadboardSession(data), /原實驗已保留/);
  assert.deepEqual(data, before);
  assert.throws(() => swapArchivedBreadboardSession(legacy()), /沒有備存/);
});
