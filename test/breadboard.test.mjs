// 麵包板模型：連通規則、跳線合併、一孔一物、擺放警告、示範電路的 netlist（只驗結構，不驗電壓）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Breadboard, BB_DEMO, parseHole, holeGroup, DEFAULT_VALUE } from '../src/bench/breadboard.js';
import { Bench, R_OPTIONS, C_OPTIONS } from '../src/bench/bench.js';
import { AfgModel } from '../src/instruments/afg/model.js';
import { DmmModel } from '../src/instruments/dmm/model.js';
import { GpeModel } from '../src/instruments/gpe/model.js';

const levels = (n, level) => n.warnings.filter((w) => w.level === level);

test('孔 id：主區 a1～j30、四條電源軌 1～30，其他都不是孔', () => {
  for (const h of ['a1', 'e30', 'f1', 'j30', 'T+1', 'T-30', 'B+15', 'B-1']) assert.ok(parseHole(h), h);
  for (const h of ['k1', 'a0', 'a31', 'a01', 'T+0', 'T+31', 'T1', 'X+5', 'A1', '', 'b 1']) assert.equal(parseHole(h), null, h);
});

test('連通規則：a–e 同一欄相連、f–j 同一欄相連、中間溝兩邊不相連；電源軌整條相連', () => {
  const n = new Breadboard().netlist({});
  for (const r of 'bcde') assert.equal(n.groupOf(`${r}1`), n.groupOf('a1'), `${r}1 與 a1 相連`);
  assert.equal(n.groupOf('a1'), '1U');
  assert.notEqual(n.groupOf('a1'), n.groupOf('f1'), 'a1 與 f1 在中間溝兩邊，不相連');
  for (const r of 'ghij') assert.equal(n.groupOf(`${r}1`), '1L');
  assert.notEqual(n.groupOf('a1'), n.groupOf('a2'), '相鄰兩欄不相連');
  assert.equal(n.groupOf('T+1'), n.groupOf('T+30'), '上方＋軌整條相連');
  assert.equal(n.groupOf('B-1'), n.groupOf('B-30'), '下方−軌整條相連');
  const rails = ['T+', 'T-', 'B+', 'B-'].map((r) => n.groupOf(`${r}7`));
  assert.deepEqual(rails, ['T+', 'T-', 'B+', 'B-']);
  assert.equal(new Set(rails).size, 4, '四條電源軌彼此不相連');
  assert.equal(n.groupOf('k9'), null);
  assert.equal(holeGroup('j12'), '12L');
});

test('跳線把兩組併成同一個節點（union-find），節點名＝電源軌優先、再依欄號最前的組名', () => {
  const bb = new Breadboard();
  assert.ok(bb.add('W', 'e5', 'f5').ok);
  let n = bb.netlist({});
  assert.equal(n.groupOf('a5'), n.groupOf('j5'), '跳線跨過中間溝：第 5 欄上下半相連');
  assert.equal(n.groupOf('j5'), '5U');
  // 串接：第 9 欄 → 第 3 欄 → 下方−軌
  bb.add('W', 'a9', 'a3'); bb.add('W', 'b3', 'B-3');
  n = bb.netlist({});
  for (const h of ['c9', 'e3', 'B-30']) assert.equal(n.groupOf(h), 'B-', `${h} 併入 B-`);
  assert.equal(n.groupOf('f9'), '9L', '沒被跳線碰到的下半欄不受影響');
  // 同欄號 U 在 L 前、欄號比字典序優先（第 2 欄在第 10 欄前）
  const bb2 = new Breadboard();
  bb2.add('W', 'a10', 'f2');
  assert.equal(bb2.netlist({}).groupOf('a10'), '2L');
  // 跳線不是元件
  assert.equal(n.elements.length, 0);
});

test('一孔一物：元件腳、跳線端、儀器導線都佔一個孔；兩腳不能同孔', () => {
  const bb = new Breadboard(), w = {};
  const r1 = bb.add('R', 'a1', 'a5', undefined, w);
  assert.ok(r1.ok);
  assert.deepEqual(r1.part, { id: 'R1', stateId: r1.part.stateId, kind: 'R', a: 'a1', b: 'a5', value: DEFAULT_VALUE.R });
  let r = bb.add('C', 'a1', 'a9', undefined, w);
  assert.ok(!r.ok && r.why.includes('a1') && r.why.includes('R1'), r.why);
  r = bb.add('W', 'b2', 'b2', undefined, w);
  assert.ok(!r.ok && r.why.includes('同一個孔'), r.why);
  assert.ok(!bb.add('R', 'a1', 'k1', undefined, w).ok, '不是合法的孔');
  assert.ok(!bb.add('X', 'c1', 'c2', undefined, w).ok, '沒有這種元件');
  assert.ok(!bb.add('R', 'c1', 'c2', -5, w).ok, '值要是正數');
  // 儀器導線
  r = bb.plug(w, 'DMM.HI', 'a5');
  assert.ok(!r.ok && r.why.includes('R1'), '導線不能插在元件腳的孔');
  assert.ok(bb.plug(w, 'DMM.HI', 'b5').ok);
  r = bb.add('C', 'b5', 'b9', undefined, w);
  assert.ok(!r.ok && r.why.includes('電表 HI'), '元件不能插在導線的孔');
  assert.ok(!bb.plug(w, 'DMM.LO', 'b5').ok, '兩條導線不能插同一個孔');
  assert.ok(bb.plug(w, 'DMM.HI', 'b5').ok, '插回原來的孔沒問題');
  assert.ok(bb.plug(w, 'DMM.HI', 'c5').ok, '導線可以移到別的空孔');
  assert.deepEqual(w, { 'DMM.HI': 'c5' });
  assert.ok(bb.add('C', 'b5', 'b9', undefined, w).ok, '移走後原來的孔空出來');
  assert.ok(!bb.plug(w, 'NOPE', 'd5').ok, '沒有這條導線');
  assert.ok(!bb.plug(w, 'DMM.LO', 'T+31').ok, '不是合法的孔');
});

test('編號各類自己算、取最小沒用過的號碼；改值、刪除', () => {
  const bb = new Breadboard();
  bb.add('R', 'a1', 'a3'); bb.add('R', 'b1', 'b3'); bb.add('C', 'c1', 'c3'); bb.add('W', 'd1', 'd3');
  assert.deepEqual(bb.parts.map((p) => p.id), ['R1', 'R2', 'C1', 'W1']);
  assert.equal(bb.get('C1').value, DEFAULT_VALUE.C);
  assert.ok(!('value' in bb.get('W1')), '跳線沒有值');
  assert.ok(bb.setValue('R2', R_OPTIONS[3]));
  assert.equal(bb.get('R2').value, 2200);
  assert.ok(bb.setValue('C1', C_OPTIONS[0]));
  assert.ok(!bb.setValue('W1', 1000), '跳線不能改值');
  assert.ok(!bb.setValue('R1', 0), '值要是正數');
  assert.ok(!bb.setValue('R9', 1000), '沒有這顆');
  assert.ok(bb.remove('R1'));
  assert.ok(!bb.remove('R1'));
  assert.equal(bb.add('R', 'e1', 'e3').part.id, 'R1', '刪掉 R1 後下一顆電阻又是 R1');
  assert.equal(bb.add('R', 'f1', 'f3').part.id, 'R3');
  bb.clear();
  assert.equal(bb.parts.length, 0);
});

test('警告：元件兩腳在同一個節點（同欄、同軌、經跳線）＝短路', () => {
  const bb = new Breadboard();
  bb.add('R', 'a4', 'c4');
  let bad = levels(bb.netlist({}), 'bad');
  assert.equal(bad.length, 1);
  assert.ok(bad[0].text.includes('R1') && bad[0].text.includes('4U') && bad[0].text.includes('不同組'), bad[0].text);
  bb.clear();
  bb.add('C', 'T+2', 'T+6');
  bad = levels(bb.netlist({}), 'bad');
  assert.ok(bad.length === 1 && bad[0].text.includes('C1') && bad[0].text.includes('電源軌'), bad[0]?.text);
  bb.clear();
  bb.add('R', 'a1', 'a5'); bb.add('W', 'b1', 'b5');
  bad = levels(bb.netlist({}), 'bad');
  assert.ok(bad.length === 1 && bad[0].text.includes('跳線'), bad[0]?.text);
  // 被短路的元件仍在 elements（a＝b），交給電路計算略過
  assert.deepEqual(bb.netlist({}).elements, [{ id: 'R1', stateId: bb.get('R1').stateId, kind: 'R', a: '1U', b: '1U', value: 1000 }]);
});

test('警告：空腳（元件那隻腳的節點沒接其他東西）是 info；跳線端不算接了東西', () => {
  const bb = new Breadboard(), w = {};
  bb.add('R', 'a1', 'a5', undefined, w);
  let info = levels(bb.netlist(w), 'info');
  assert.ok(info.length === 1 && info[0].text.includes('a1') && info[0].text.includes('a5') && info[0].text.includes('空腳'), info[0]?.text);
  bb.plug(w, 'DMM.HI', 'e1');
  info = levels(bb.netlist(w), 'info');
  assert.ok(info.length === 1 && info[0].text.includes('a5') && !info[0].text.includes('a1'), info[0]?.text);
  bb.add('W', 'b5', 'f5', undefined, w); // 跳線把第 5 欄延伸到下半，但下半沒有別的東西
  assert.equal(levels(bb.netlist(w), 'info').length, 1, '只有跳線接著仍是空腳');
  bb.add('C', 'g5', 'B-5', undefined, w); // 電容接上第 5 欄（經跳線）：R1 不再空腳，C1 的 B- 腳空著
  info = levels(bb.netlist(w), 'info');
  assert.ok(info.length === 1 && info[0].text.includes('C1') && info[0].text.includes('B-5'), info[0]?.text);
  bb.plug(w, 'DMM.LO', 'B-20');
  const n = bb.netlist(w);
  assert.equal(n.warnings.length, 0, n.warnings.map((x) => x.text).join('；'));
});

test('警告：GPE 同一路的＋與−在同一節點＝電源短路；不同路或 GND 不算', () => {
  const bb = new Breadboard(), w = {};
  bb.plug(w, 'GPE.CH1+', 'T+1'); bb.plug(w, 'GPE.CH1-', 'T+9');
  let bad = levels(bb.netlist(w), 'bad');
  assert.ok(bad.length === 1 && bad[0].text.includes('GPE CH1') && bad[0].text.includes('短路'), bad[0]?.text);
  bb.plug(w, 'GPE.CH1-', 'T-9'); // 改插到−軌
  assert.equal(levels(bb.netlist(w), 'bad').length, 0);
  bb.plug(w, 'GPE.CH2+', 'a3'); bb.plug(w, 'GPE.CH3-', 'b3'); bb.plug(w, 'GPE.GND', 'c3'); bb.plug(w, 'GPE.CH4+', 'd3');
  assert.equal(levels(bb.netlist(w), 'bad').length, 0, '不同路的端子在同一節點不是電源短路（交給電路計算）');
  bb.add('W', 'e3', 'T-3', undefined, w); bb.plug(w, 'GPE.CH4-', 'T-20'); // 經跳線：CH4＋（第 3 欄）與 CH4−（−軌）相連
  bad = levels(bb.netlist(w), 'bad');
  assert.ok(bad.length === 1 && bad[0].text.includes('GPE CH4'), bad.map((x) => x.text).join('；'));
  assert.equal(bb.netlist(w).warnings[0].level, 'bad', '嚴重的排在前面');
});

test('netlist：nodes 只列有接東西的節點；leads 是導線 → 節點', () => {
  const bb = new Breadboard(), w = {};
  bb.add('R', 'a2', 'a6', 470, w); bb.add('W', 'j30', 'B+30', undefined, w);
  bb.plug(w, 'AFG.CH1+', 'b2'); bb.plug(w, 'AFG.CH1-', 'e6');
  const n = bb.netlist(w);
  assert.deepEqual(n.nodes, ['2U', '6U']);
  assert.deepEqual(n.elements, [{ id: 'R1', stateId: bb.get('R1').stateId, kind: 'R', a: '2U', b: '6U', value: 470 }]);
  assert.deepEqual(n.leads, { 'AFG.CH1+': '2U', 'AFG.CH1-': '6U' });
  assert.equal(n.groupOf('f30'), 'B+', '沒有列在 nodes 的孔也查得到節點');
  const s = bb.snapshot(w);
  assert.deepEqual(Object.keys(s), ['parts', 'nodes', 'elements', 'leads', 'warnings']);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'snapshot 可 JSON 化');
});

test('示範「RC 低通」：AFG CH1 → R 1 kΩ → C 100 nF 到地；示波器 CH1 量輸入、CH2 量電容；電表跨電容', () => {
  const bb = new Breadboard(), w = { 'GPE.CH1+': 'a1' };
  bb.add('R', 'j1', 'j2', 100, w); // 示範要先清掉舊的
  bb.load(BB_DEMO.rc, w);
  assert.equal(bb.parts.length, BB_DEMO.rc.parts.length, '每個元件都擺得上');
  assert.deepEqual(w, BB_DEMO.rc.wires, '每條導線都插得上，舊導線已拔掉');
  const n = bb.netlist(w), L = n.leads;
  assert.deepEqual(n.elements, [
    { id: 'R1', stateId: bb.get('R1').stateId, kind: 'R', a: '8U', b: '12U', value: 1000 },
    { id: 'C1', stateId: bb.get('C1').stateId, kind: 'C', a: '12U', b: 'T-', value: 0.1e-6 },
  ]);
  assert.deepEqual(L, {
    'AFG.CH1+': '8U', 'AFG.CH1-': 'T-', 'TDS.CH1.TIP': '8U', 'TDS.CH1.GND': 'T-',
    'TDS.CH2.TIP': '12U', 'TDS.CH2.GND': 'T-', 'DMM.HI': '12U', 'DMM.LO': 'T-',
  });
  assert.deepEqual(n.nodes, ['T-', '8U', '12U']);
  // 關係：R 在輸入與電容之間、C 在電容與地之間
  const [R, C] = n.elements;
  assert.deepEqual([R.a, R.b], [L['AFG.CH1+'], L['TDS.CH2.TIP']]);
  assert.deepEqual([C.a, C.b], [L['DMM.HI'], L['DMM.LO']]);
  assert.equal(L['AFG.CH1-'], C.b);
  assert.equal(n.warnings.length, 0, n.warnings.map((x) => x.text).join('；'));
});

test('示範「GPE 分壓」：GPE CH1＋ → R1 → R2 → CH1−（經電源軌與跳線），電表跨 R2', () => {
  const bb = new Breadboard(), w = {};
  bb.load(BB_DEMO.gpe, w);
  assert.equal(bb.parts.length, BB_DEMO.gpe.parts.length, '每個元件都擺得上');
  assert.deepEqual(w, BB_DEMO.gpe.wires);
  const n = bb.netlist(w);
  assert.deepEqual(n.elements, [
    { id: 'R1', stateId: bb.get('R1').stateId, kind: 'R', a: 'B+', b: '22L', value: 1000 },
    { id: 'R2', stateId: bb.get('R2').stateId, kind: 'R', a: '22L', b: 'B-', value: 1000 },
  ]);
  assert.deepEqual(n.leads, { 'GPE.CH1+': 'B+', 'GPE.CH1-': 'B-', 'DMM.HI': '22L', 'DMM.LO': 'B-' });
  assert.deepEqual(n.nodes, ['B+', 'B-', '22L']);
  assert.equal(n.warnings.length, 0, n.warnings.map((x) => x.text).join('；'));
  assert.deepEqual(bb.parts.filter((p) => p.kind === 'W').map((p) => p.id), ['W1', 'W2']);
});

test('跨中間溝槽（e9–f9）是兩組，不算短路；同一欄同一組（a9–c9）才是短路', () => {
  const bb = new Breadboard();
  bb.add('R', 'e9', 'f9', 1000);
  assert.deepEqual(bb.netlist({}).warnings.filter((w) => w.level === 'bad'), []);
  bb.add('C', 'a9', 'c9', 1e-7);
  assert.ok(bb.netlist({}).warnings.some((w) => w.level === 'bad' && w.text.includes('C1') && w.text.includes('不同組')));
});

test('元件生命週期識別碼不因顯示編號重用而重用，改值與接線則保留識別碼', () => {
  const bb = new Breadboard(), w = {};
  const original = bb.add('C', 'a1', 'a5').part;
  assert.ok(original.stateId);
  bb.setValue('C1', 1e-6);
  bb.plug(w, 'DMM.HI', 'b1');
  assert.equal(bb.netlist(w).elements[0].stateId, original.stateId);
  bb.remove('C1');
  const replacement = bb.add('C', 'a1', 'a5').part;
  assert.equal(replacement.id, original.id);
  assert.notEqual(replacement.stateId, original.stateId);
  bb.clear();
  const afterClear = bb.add('C', 'a1', 'a5').part;
  assert.notEqual(afterClear.stateId, replacement.stateId);
  const otherBoard = new Breadboard().add('C', 'a1', 'a5').part;
  assert.notEqual(otherBoard.stateId, afterClear.stateId);
});

function chargedDivider() {
  const afg = new AfgModel(), gpe = new GpeModel();
  const bench = new Bench(afg, new DmmModel(), gpe);
  let t = 0;
  bench.now = () => t;
  bench.board = 'bb'; bench.bb = new Breadboard();
  gpe.vset[1] = 500; gpe.output = true; gpe.load = 'bench';
  bench.bb.load(BB_DEMO.gpe, bench.bbWires);
  bench.bb.add('C', 'f22', 'f26', 0.1e-6, bench.bbWires);
  bench.solution(); t = 1;
  assert.ok(Math.abs(bench.vcAt(t) - 2.5) < 2e-4, '原本電容已充到分壓電壓');
  return { bench, afg, setTime: (v) => { t = v; } };
}

test('已充電的 C1 清空換成 RC 示範後，新 C1 從 0 V 開始且舊歷史不變', () => {
  const { bench, afg, setTime } = chargedDivider();
  const oldStateId = bench.bb.get('C1').stateId;
  const before = bench.vcAt(1), history = bench.vcAt(0.5);
  bench.bb.load(BB_DEMO.rc, bench.bbWires);
  assert.equal(afg.ch[0].output, false);
  assert.notEqual(bench.bb.get('C1').stateId, oldStateId);
  assert.equal(bench.bb.get('C1').id, 'C1');
  assert.ok(Math.abs(bench.vcAt(1)) < 1e-9, '新電容沒有承接舊電荷');
  assert.ok(Math.abs(bench.vcAt(0.5) - history) < 1e-9, '更換前的量測歷史保留舊電容');
  setTime(1.1);
  assert.ok(Math.abs(bench.vcAt(1.1)) < 1e-9, '沒有輸出時新電容保持 0 V');
  assert.ok(before > 2.49);
});

test('移動儀器導線或改既有元件值，仍保留同一顆電容在改變當下的電壓', () => {
  const { bench } = chargedDivider();
  const stateId = bench.bb.get('C1').stateId, before = bench.vcAt(1);
  assert.ok(bench.bb.plug(bench.bbWires, 'DMM.HI', 'e22').ok);
  assert.ok(Math.abs(bench.vcAt(1) - before) < 1e-9, '重接導線保持電容電壓連續');
  bench.bb.setValue('R1', 2200);
  assert.equal(bench.bb.get('C1').stateId, stateId);
  assert.ok(Math.abs(bench.vcAt(1) - before) < 1e-9, '改電阻保持電容電壓連續');
  bench.bb.setValue('C1', 1e-6);
  assert.equal(bench.bb.get('C1').stateId, stateId);
  assert.ok(Math.abs(bench.vcAt(1) - before) < 1e-9, '調整既有電容值仍保留當下電壓');
});

test('刪掉已充電 C1 後立即在原孔插入新 C1，連續兩次 solution 之間仍會重設電荷', () => {
  const { bench } = chargedDivider();
  const stateId = bench.bb.get('C1').stateId;
  bench.bb.remove('C1');
  bench.bb.add('C', 'f22', 'f26', 0.1e-6, bench.bbWires);
  assert.notEqual(bench.bb.get('C1').stateId, stateId);
  assert.ok(Math.abs(bench.vcAt(1)) < 1e-9, '接線與面板編號相同也不能重用原電容電荷');
});
