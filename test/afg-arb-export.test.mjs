import test from 'node:test';
import assert from 'node:assert/strict';
import { AfgModel } from '../src/instruments/afg/model.js';

function run(m, sequence) {
  let result;
  for (const key of sequence.split(' ')) {
    if (/^[\d.]+$/.test(key)) {
      for (const digit of key) result = m.press(`AFG.NUM.${digit === '.' ? 'DOT' : `DIGIT_${digit}`}`);
    } else result = m.press(/^F\d$/.test(key) ? `AFG.SOFT.${key}` : `AFG.KEY.${({ FREQ: 'FREQ_RATE', BACK: 'RETURN' })[key] || key}`);
  }
  return result;
}

function slowArb() {
  const m = new AfgModel();
  run(m, 'ARB F4 F2 2 F2 BACK FREQ 2 F1 ARB F5 F1');
  assert.equal(m.c.extended.arb.rate, .000002);
  assert.equal(m.c.extended.arb.length, 2);
  assert.equal(m.c.extended.arb.saveLength, 4096);
  return m;
}

test('direct ARB JSON export rejects a legal source with an unplayable selected region', () => {
  const m = slowArb(), before = structuredClone(m.snapshot());
  assert.throws(() => m.exportArbFile(), (e) => e instanceof TypeError && /1µHz–60MHz/.test(e.message));
  assert.deepEqual(m.snapshot(), before);
});

test('USB save rejects an unplayable region before invoking a download handler', () => {
  const m = slowArb(), calls = [];
  m.setArbFileHandler((operation, file) => {
    calls.push({ operation, file });
    return { kind: 'ok', download: { name: 'ARB.json', text: JSON.stringify(file) } };
  });
  const before = structuredClone(m.snapshot()), result = run(m, 'F4');
  assert.equal(result.kind, 'reject');
  assert.match(result.text, /1µHz–60MHz/);
  assert.equal(result.download, undefined);
  assert.deepEqual(calls, []);
  assert.deepEqual(m.snapshot(), before);

  // Repair only the selected save length; the same USB path now downloads a
  // standalone file that the real importer accepts unchanged.
  run(m, 'F2 2 F2 BACK F4');
  assert.equal(calls.length, 1);
  const target = new AfgModel();
  assert.equal(target.importArbFile(JSON.parse(JSON.stringify(calls[0].file))).kind, 'info');
  assert.equal(target.c.extended.arb.rate, .000002);
  assert.equal(target.c.extended.arb.length, 2);
});

for (const [rate, length] of [[.000002, 1], [.000002, 2], [.004096, 4096], [120e6, 1], [120e6, 2], [4000, 4096]]) {
  test(`ARB JSON region ${length} sample(s) at ${rate} Sa/s round-trips through USB and Memory`, () => {
    const m = new AfgModel();
    run(m, `ARB F4 F2 2 F2 BACK FREQ ${rate} F3 ARB F2 F1 F2 511 F2 BACK F3 ARB F5 F1 F2 ${length} F2 BACK`);
    const file = m.exportArbFile();
    assert.equal(file.rate, rate);
    assert.equal(file.points.length, length);
    assert.equal(file.points[0], 511);
    let downloaded;
    m.setArbFileHandler((operation, payload) => { assert.equal(operation, 'SAVE'); downloaded = payload; return { kind: 'ok' }; });
    assert.equal(run(m, 'F4').kind, 'ok');
    assert.deepEqual(downloaded, file);
    const target = new AfgModel();
    assert.equal(target.importArbFile(JSON.parse(JSON.stringify(downloaded))).kind, 'info');
    assert.equal(target.c.extended.arb.rate, rate);
    assert.equal(target.c.extended.arb.length, Math.max(2, length));
    assert.deepEqual(target.c.extended.arb.points.slice(0, length), file.points);
    if (length === 1) assert.equal(target.c.extended.arb.points[1], 0);
    run(m, 'F3 F1');
    const stored = m.extended.memories[0].arb[0];
    assert.equal(stored.rate, target.c.extended.arb.rate);
    assert.equal(stored.length, target.c.extended.arb.length);
    assert.deepEqual(stored.points, target.c.extended.arb.points);
  });
}

test('export validates the selected samples without applying import destination restrictions', () => {
  const m = new AfgModel();
  run(m, 'ARB F2 F1 F1 10 F2 BACK F2 511 F2 BACK F3 ARB F5 F1 F2 1 F2 BACK F1 10 F2 BACK');
  run(m, 'ARB F5 F2 F1 4095 F2 BACK ARB F2 F5 F1 F1 ARB F5 F1');
  const before = structuredClone(m.snapshot()), file = m.exportArbFile();
  assert.deepEqual(file.points, [511]);
  assert.deepEqual(m.snapshot(), before);
  const target = new AfgModel();
  assert.equal(target.importArbFile(file).kind, 'info');
  assert.deepEqual(target.c.extended.arb.points.slice(0, 2), [511, 0]);
  assert.throws(() => m.importArbFile(file), /selected To address/);
  assert.deepEqual(m.snapshot(), before);
});
