import test from 'node:test';
import assert from 'node:assert/strict';
import { Bench } from '../src/bench/bench.js';
import { Breadboard, BB_DEMO } from '../src/bench/breadboard.js';
import { DmmModel } from '../src/instruments/dmm/model.js';
import { GpeModel } from '../src/instruments/gpe/model.js';
import { schematicSvg } from '../src/bench/schematic-view.js';

function fixture(demo = 'current') {
  const channel = { wave: 'SINE', freq: 1000, sym: 50, emfVpp: 2, emfOffset: 0, output: true };
  const afg = { on: true, ch: [{ ...channel }, { ...channel, output: false }], isOn() { return this.on; } };
  const dmm = new DmmModel(), gpe = new GpeModel();
  dmm.fn = 'DCI'; dmm.fixture = 'bench'; gpe.output = true; gpe.vset[1] = 500;
  const models = { afg, dmm, gpe, tds: { isOn: () => true } };
  const bench = new Bench(afg, dmm, gpe); bench.now = () => 1; bench.board = 'bb'; bench.bb = new Breadboard();
  bench.bb.load(BB_DEMO[demo], bench.bbWires);
  // Match app.js's inspection-only cached-LCD wrappers. No instrument readback
  // belongs to the renderer; all rendering uses these pre-existing screen strings.
  const screens = Object.fromEntries(Object.entries(models).map(([id, model]) => [id, Object.assign(Object.create(model), { lcd: () => '<text fill="#fff">cached LCD</text>' })]));
  return { bench, models, dmm, gpe, render: () => schematicSvg(bench, screens) };
}

const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
function element(svg, attribute, id) {
  const tags = [...svg.matchAll(/<g\b[^>]*>/g)].map((match) => attributes(match[0]));
  return tags.find((tag) => tag[attribute] === id);
}
const pin = (tag, leg) => [Number(tag[`data-x${leg}`]), Number(tag[`data-y${leg}`])];
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const on = (p, a, b) => (a[0] === b[0] ? p[0] === a[0] : p[1] === a[1]) && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
// Follow the actual rendered conductor segments rather than trusting matching
// net labels. The current-demo loop must genuinely reach both instrument pins.
function connected(svg, start, end, net) {
  const segments = [...svg.matchAll(/<path\b[^>]*>/g)].map((match) => attributes(match[0]))
    .filter((tag) => tag['data-wire-node'] === net && !/[CQ]/.test(tag.d))
    .map((tag) => [...tag.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]))
    .flatMap((points) => points.slice(1).map((point, i) => [points[i], point]));
  const points = [start, end, ...segments.flat()], visited = new Set([0]), queue = [0];
  while (queue.length) {
    const at = queue.shift();
    if (same(points[at], end)) return true;
    points.forEach((candidate, i) => {
      if (!visited.has(i) && (same(points[at], candidate) || segments.some(([a, b]) => on(points[at], a, b) && on(candidate, a, b)))) { visited.add(i); queue.push(i); }
    });
  }
  return false;
}

test('AFG stays drawn against the solver earth when its black clip is unplugged but a scope ground remains', () => {
  const s = fixture('rc'); delete s.bench.bbWires['AFG.CH1-'];
  const built = s.bench.build();
  assert.equal(built.net.afg.length, 1);
  assert.equal(built.leadNode['TDS.CH1.GND'], 'E');
  const svg = s.render(), source = element(svg, 'data-source', 'AFG.CH1');
  assert.ok(source, 'an actually driving source cannot disappear');
  assert.equal(source['data-node-a'], built.net.afg[0].node);
  assert.equal(source['data-node-b'], 'E');
  assert.equal(source['data-return'], 'earth');
  assert.equal(source['data-lead-b'], '', 'the unplugged black clip is never fabricated');
  assert.match(svg, /黑夾未接；經儀器共地/);
  const cap = element(svg, 'data-comp', 'C1');
  assert.ok(connected(svg, pin(source, 2), pin(cap, 2), 'E'));
});

test('AFG records a physical black clip when one is present', () => {
  const s = fixture('rc'), source = element(s.render(), 'data-source', 'AFG.CH1');
  assert.equal(source['data-return'], 'lead');
  assert.equal(source['data-lead-b'], 'AFG.CH1-');
});

test('red-only AFG shows its internal earth without connecting an unplugged return to any breadboard hole', () => {
  const s = fixture('rc');
  delete s.bench.bbWires['AFG.CH1-']; delete s.bench.bbWires['TDS.CH1.GND']; delete s.bench.bbWires['TDS.CH2.GND'];
  const before = s.bench.bb.snapshot(s.bench.bbWires), svg = s.render();
  const source = element(svg, 'data-source', 'AFG.CH1'), cap = element(svg, 'data-comp', 'C1');
  assert.equal(source['data-node-b'], 'E');
  assert.notEqual(cap['data-node-b'], 'E', 'the rail is still floating');
  assert.ok(element(svg, 'data-internal-node', 'E'));
  assert.equal(element(svg, 'data-schematic-node', 'E'), undefined, 'internal earth has no selectable breadboard holes');
  assert.match(svg, /黑夾未接；尚未接回地/);
  assert.deepEqual(s.bench.bb.snapshot(s.bench.bbWires), before);
});

test('a floating GPE still requires both output terminals, even with a scope ground attached', () => {
  const s = fixture(); delete s.bench.bbWires['GPE.CH1-'];
  assert.ok(s.bench.bb.plug(s.bench.bbWires, 'TDS.CH1.GND', 'T-1').ok);
  const svg = s.render();
  assert.equal(element(svg, 'data-source', 'GPE.CH1'), undefined);
  assert.match(svg, /GPE CH1＋（−端未接）/);
});

test('current demo draws the real active I→LO branch and a geometrically closed source–R–meter loop', () => {
  const s = fixture(), built = s.bench.build(), svg = s.render();
  const meter = element(svg, 'data-device', 'DMM.I-LO'), source = element(svg, 'data-source', 'GPE.CH1'), resistor = element(svg, 'data-comp', 'R1');
  assert.ok(meter);
  assert.equal(meter['data-active'], 'true');
  assert.equal(+meter['data-shunt'], built.current.r);
  assert.equal(meter['data-node-a'], built.current.a);
  assert.equal(meter['data-node-b'], built.current.b);
  assert.ok(connected(svg, pin(source, 1), pin(resistor, 1), built.leadNode['GPE.CH1+']));
  assert.ok(connected(svg, pin(resistor, 2), pin(meter, 1), built.current.a));
  assert.ok(connected(svg, pin(meter, 2), pin(source, 2), built.current.b));
  assert.match(svg, /sc-meter-glyph[^>]*>A<\/text>/);
  assert.equal((svg.match(/data-comp=/g) ?? []).length, 1, 'the ammeter is not a fictitious breadboard part');
});

test('swapping I and LO reverses the displayed positive-current terminals, not the physical source', () => {
  const s = fixture();
  [s.bench.bbWires['DMM.I'], s.bench.bbWires['DMM.LO']] = [s.bench.bbWires['DMM.LO'], s.bench.bbWires['DMM.I']];
  const built = s.bench.build(), svg = s.render(), meter = element(svg, 'data-device', 'DMM.I-LO');
  assert.equal(meter['data-node-a'], built.current.a);
  assert.equal(meter['data-node-b'], built.current.b);
  assert.equal(meter['data-lead-a'], 'DMM.I');
  assert.equal(meter['data-lead-b'], 'DMM.LO');
  const source = element(svg, 'data-source', 'GPE.CH1');
  assert.ok(connected(svg, pin(meter, 1), pin(source, 2), built.current.a));
});

test('DCV and power-off keep the solver shunt, while only powered DCI/ACI show the active ammeter', () => {
  const s = fixture();
  for (const [fn, powered] of [['DCI', true], ['ACI', true], ['DCV', true], ['DCI', false], ['DCV', false]]) {
    s.dmm.fn = fn; s.dmm.on = powered;
    const built = s.bench.build(), svg = s.render(), meter = element(svg, 'data-device', 'DMM.I-LO');
    assert.ok(meter, `${fn}/${powered} still has a physical shunt`);
    assert.equal(+meter['data-shunt'], built.current.r);
    assert.equal(meter['data-active'], String(powered && ['DCI', 'ACI'].includes(fn)));
    if (!powered || fn === 'DCV') { assert.match(svg, /分流仍導通/); assert.doesNotMatch(svg, /sc-meter-glyph/); }
  }
});

test('unplugged I or LO never creates an ammeter, and HI cannot substitute for I', () => {
  for (const missing of ['DMM.I', 'DMM.LO']) {
    const s = fixture(), hole = s.bench.bbWires[missing]; delete s.bench.bbWires[missing];
    if (missing === 'DMM.I') s.bench.bbWires['DMM.HI'] = hole;
    assert.equal(s.bench.build().current, null);
    assert.equal(element(s.render(), 'data-device', 'DMM.I-LO'), undefined);
  }
});

test('a shunt connected to one node stays a visible loop rather than disappearing', () => {
  const s = fixture(); s.bench.bbWires['DMM.LO'] = 'h18';
  const svg = s.render(), meter = element(svg, 'data-device', 'DMM.I-LO');
  assert.ok(meter);
  assert.equal(meter['data-node-a'], meter['data-node-b']);
  assert.match(meter.class, /shorted/);
  assert.ok(connected(svg, pin(meter, 1), pin(meter, 2), meter['data-node-a']));
});

test('inspection rendering reads only settings and cached LCDs, preserving acquisition and physical state', () => {
  const s = fixture('rc'); delete s.bench.bbWires['AFG.CH1-'];
  s.bench.bb.plug(s.bench.bbWires, 'DMM.I', 'e12');
  const before = JSON.stringify({ board: s.bench.bb.snapshot(s.bench.bbWires), per: s.dmm.per, samples: s.dmm.sampleEnd, segs: s.bench.segs, settings: s.gpe.vset });
  const forbidden = () => { throw new Error('rendering must not acquire or solve'); };
  for (const name of ['build', 'solution', 'snapshot', 'now', 'dmmInput', 'gpeInput']) s.bench[name] = forbidden;
  for (const model of Object.values(s.models)) for (const name of ['lcd', 'readback', 'reading', 'snapshot', 'status', 'now']) model[name] = forbidden;
  s.dmm.benchSource = forbidden; s.gpe.benchSource = forbidden;
  for (let i = 0; i < 3; i++) assert.ok(element(s.render(), 'data-device', 'DMM.I-LO'));
  assert.equal(JSON.stringify({ board: s.bench.bb.snapshot(s.bench.bbWires), per: s.dmm.per, samples: s.dmm.sampleEnd, segs: s.bench.segs, settings: s.gpe.vset }), before);
});
