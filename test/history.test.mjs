import test from 'node:test';
import assert from 'node:assert/strict';
import { WiringHistory, HISTORY_LIMIT } from '../src/bench/history.js';
import { Bench, DEMO } from '../src/bench/bench.js';
import { Breadboard, BB_DEMO } from '../src/bench/breadboard.js';
import { createInstruments } from '../src/instruments/index.js';

function setup() {
  const models = createInstruments(), bench = new Bench(models.afg, models.dmm, models.gpe);
  bench.bb = new Breadboard();
  let t = 0;
  bench.now = () => t;
  return { bench, models, h: new WiringHistory(bench), setTime: (value) => { t = value; } };
}

test('RC 接線、值、接法可逐步復原／重做；示範與清空各佔一步', () => {
  const { bench: b, h } = setup();
  h.perform('rc', '接紅夾', () => b.connect('AFG.CH1+', 'A'));
  h.perform('rc', '改電阻', () => { b.R = 4700; });
  h.perform('rc', '改接法', () => { b.topo = 'CR'; });
  assert.equal(h.status('rc').undo, 3);
  h.undo('rc'); assert.equal(b.topo, 'RC');
  h.undo('rc'); assert.equal(b.R, 1000);
  h.undo('rc'); assert.deepEqual(b.wires, {});
  h.redo('rc'); h.redo('rc'); h.redo('rc');
  assert.equal(b.R, 4700); assert.equal(b.topo, 'CR');
  h.perform('rc', '示範', () => { b.wires = { ...DEMO }; });
  h.perform('rc', '拔線', () => { b.wires = {}; });
  h.undo('rc'); assert.deepEqual(b.wires, DEMO);
  h.undo('rc'); assert.deepEqual(b.wires, { 'AFG.CH1+': 'A' });
});

test('麵包板新增、改值、插拔、刪除、示範與清空皆可復原', () => {
  const { bench: b, h } = setup();
  h.perform('bb', '新增 R', () => b.bb.add('R', 'a1', 'a5', 1000, b.bbWires));
  h.perform('bb', '改值', () => b.bb.setValue('R1', 4700));
  h.perform('bb', '插 HI', () => b.bb.plug(b.bbWires, 'DMM.HI', 'b1'));
  h.perform('bb', '移 HI', () => b.bb.plug(b.bbWires, 'DMM.HI', 'b5'));
  h.undo('bb'); assert.deepEqual(b.bbWires, { 'DMM.HI': 'b1' });
  h.undo('bb'); assert.deepEqual(b.bbWires, {});
  h.undo('bb'); assert.equal(b.bb.get('R1').value, 1000);
  h.redo('bb'); h.redo('bb'); h.redo('bb');
  h.perform('bb', '刪 R', () => b.bb.remove('R1'));
  h.undo('bb'); assert.equal(b.bb.get('R1').value, 4700);
  h.perform('bb', '示範', () => b.bb.load(BB_DEMO.gpe, b.bbWires));
  assert.equal(b.bb.parts.length, 4);
  h.undo('bb'); assert.equal(b.bb.parts.length, 1); assert.equal(b.bb.get('R1').value, 4700);
  h.redo('bb');
  h.perform('bb', '清空', () => { b.bb.clear(); b.bbWires = {}; });
  h.undo('bb'); assert.equal(b.bb.parts.length, 4); assert.deepEqual(b.bbWires, BB_DEMO.gpe.wires);
});

test('無效操作及重接原孔不入歷史，也不清掉重做；新編輯清掉重做', () => {
  const { bench: b, h } = setup();
  h.perform('bb', '新增', () => b.bb.add('R', 'a1', 'a2'));
  h.perform('bb', '改值', () => b.bb.setValue('R1', 2200));
  h.undo('bb');
  assert.equal(h.status('bb').redo, 1);
  assert.equal(h.perform('bb', '壞孔', () => b.bb.add('C', 'a1', 'z2')).ok, false);
  assert.equal(h.perform('bb', '刪不存在', () => b.bb.remove('R9')), false);
  h.perform('bb', '相同值', () => b.bb.setValue('R1', 1000));
  assert.equal(h.status('bb').undo, 1); assert.equal(h.status('bb').redo, 1);
  h.perform('bb', '插導線', () => b.bb.plug(b.bbWires, 'DMM.LO', 'b1'));
  assert.equal(h.status('bb').redo, 0);
  h.perform('bb', '同孔', () => b.bb.plug(b.bbWires, 'DMM.LO', 'b1'));
  assert.equal(h.status('bb').undo, 2);
});

test('兩板有獨立歷史；復原不改儀器、探棒、時鐘、電路讀值歷史', () => {
  const { bench: b, models, h } = setup();
  h.perform('rc', 'R', () => { b.R = 4700; });
  h.perform('bb', 'C', () => b.bb.add('C', 'a1', 'a2'));
  models.afg.ch[0].freq = 2500; b.probeX[0] = 1;
  const clock = b.now, segments = b.segs;
  h.undo('rc');
  assert.equal(b.R, 1000); assert.equal(b.bb.parts.length, 1);
  assert.equal(models.afg.ch[0].freq, 2500); assert.equal(b.probeX[0], 1);
  assert.equal(b.now, clock); assert.equal(b.segs, segments);
  h.undo('bb'); assert.equal(b.bb.parts.length, 0);
  assert.equal(h.status('rc').redo, 1); assert.equal(h.status('bb').redo, 1);
});

test('歷史只保留最近 100 步，clear 同時清除兩板；空歷史無作用', () => {
  const { bench: b, h } = setup();
  assert.equal(h.undo('rc'), null); assert.equal(h.redo('bb'), null);
  for (let i = 1; i <= HISTORY_LIMIT + 8; i++) h.perform('rc', `第 ${i} 步`, () => { b.R = i; });
  assert.equal(h.status('rc').undo, HISTORY_LIMIT);
  for (let i = 0; i < HISTORY_LIMIT; i++) h.undo('rc');
  assert.equal(b.R, 8); assert.equal(h.undo('rc'), null);
  h.perform('bb', 'R', () => b.bb.add('R', 'a1', 'a2'));
  h.clear();
  assert.deepEqual(h.status('bb'), { undo: 0, redo: 0, undoLabel: '', redoLabel: '' });
  assert.equal(h.status('rc').redo, 0);
});

function charged() {
  const result = setup(), { bench: b, models, setTime } = result;
  b.board = 'bb';
  models.gpe.vset[1] = 500; models.gpe.output = true; models.gpe.load = 'bench';
  b.bb.load(BB_DEMO.gpe, b.bbWires);
  b.bb.add('C', 'f22', 'f26', 0.1e-6, b.bbWires);
  b.solution(); setTime(1);
  assert.ok(b.vcAt(1) > 2.49);
  return result;
}

test('導線／既有元件改值復原是當下新事件，電容電壓連續，過去量測保留', () => {
  const { bench: b, h, setTime } = charged();
  const stateId = b.bb.get('C1').stateId, historical = b.vcAt(0.5);
  h.perform('bb', 'R1 改值', () => b.bb.setValue('R1', 47000));
  b.solution(); setTime(1.1);
  const before = b.vcAt(1.1);
  h.undo('bb');
  assert.equal(b.bb.get('C1').stateId, stateId);
  assert.ok(Math.abs(b.vcAt(1.1) - before) < 1e-9);
  assert.equal(b.changedAt(), 1.1);
  assert.ok(Math.abs(b.vcAt(0.5) - historical) < 1e-9);
  setTime(1.2);
  h.perform('bb', '移 HI', () => b.bb.plug(b.bbWires, 'DMM.HI', 'e22'));
  b.solution(); setTime(1.3);
  const beforeWireUndo = b.vcAt(1.3);
  h.undo('bb');
  assert.equal(b.bb.get('C1').stateId, stateId);
  assert.ok(Math.abs(b.vcAt(1.3) - beforeWireUndo) < 1e-9);
});

test('刪掉已充電的電容後復原，產生新的生命週期且從 0 V 開始', () => {
  const { bench: b, h, setTime } = charged();
  const original = b.bb.get('C1').stateId, historical = b.vcAt(0.5);
  h.perform('bb', '刪 C1', () => b.bb.remove('C1'));
  b.solution(); setTime(1.1);
  assert.equal(h.undo('bb').restoredCaps, 1);
  const restored = b.bb.get('C1').stateId;
  assert.notEqual(restored, original);
  assert.ok(Math.abs(b.vcAt(1.1)) < 1e-9);
  assert.ok(Math.abs(b.vcAt(0.5) - historical) < 1e-9);
  setTime(1.2); assert.ok(b.vcAt(1.2) > 2.49);
  h.redo('bb'); b.solution(); setTime(1.3);
  h.undo('bb');
  assert.notEqual(b.bb.get('C1').stateId, restored);
  assert.ok(Math.abs(b.vcAt(1.3)) < 1e-9);
});

test('電容重新擺上後再復原先前改值，仍是同一顆新電容，避免重覆重設電荷', () => {
  const { bench: b, h, setTime } = charged();
  h.perform('bb', 'C1 改值', () => b.bb.setValue('C1', 1e-6)); b.solution();
  h.perform('bb', '刪 C1', () => b.bb.remove('C1')); b.solution();
  setTime(1.1); h.undo('bb'); b.solution();
  const restored = b.bb.get('C1').stateId;
  setTime(1.2); const before = b.vcAt(1.2);
  h.undo('bb');
  assert.equal(b.bb.get('C1').stateId, restored);
  assert.equal(b.bb.get('C1').value, 0.1e-6);
  assert.ok(Math.abs(b.vcAt(1.2) - before) < 1e-9);
});

test('清空與示範的復原皆不將已拿掉電容的舊電荷嫁接到新元件', () => {
  for (const action of ['clear', 'demo']) {
    const { bench: b, h, setTime } = charged();
    const original = b.bb.get('C1').stateId;
    h.perform('bb', action, () => {
      if (action === 'clear') { b.bb.clear(); b.bbWires = {}; }
      else b.bb.load(BB_DEMO.rc, b.bbWires);
    });
    b.solution(); setTime(1.1);
    h.undo('bb');
    assert.notEqual(b.bb.get('C1').stateId, original);
    assert.ok(Math.abs(b.vcAt(1.1)) < 1e-9, action);
  }
});
