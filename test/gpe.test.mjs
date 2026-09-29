// GPE-4323 模型：照 docs/data/gpe.json 的 GPE-F01～F12 驗收（I04-1～7）與必測反例。真 UI 操作見 scripts/e2e/gpe.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import { GpeModel, K, solve } from '../src/instruments/gpe/model.js';

// 模型換成可控時鐘：m.tick(ms) 推進時間（Set View 逾時、開機全段、旋鈕快轉都看時間）
function fresh() {
  const m = new GpeModel();
  let t = 1e6;
  m.now = () => t;
  m.tick = (ms) => { t += ms; };
  return m;
}
// 慢轉 n 格：每格間隔 200 ms → 10 mV／1 mA
function slow(m, id, n) { let h; for (let i = 0; i < Math.abs(n); i++) { m.tick(200); h = m.turn(id, Math.sign(n)); } return h; }
// 快轉 n 格：第一格細調，之後每格 10 ms → ×100 並對齊整數（0.00 → 6 格 → 5.00 V）
function fast(m, id, n) { let h; m.tick(200); for (let i = 0; i < Math.abs(n); i++) { h = m.turn(id, Math.sign(n)); m.tick(10); } return h; }
const row = (m, k) => { const r = m.snapshot().display[k]; return [r.ch, r.v, r.a, r.mode]; };
const lit = (svg) => [...svg.matchAll(/<text class="lit"[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]);

test('重設狀態（GPE-F11、GAP-GPE-05）', () => {
  const s = fresh().snapshot();
  assert.deepEqual(s.vset, { 1: 0, 2: 0, 3: 0, 4: 0 });
  assert.deepEqual(s.iset, { 1: 0.1, 2: 0.1 });
  assert.equal(s.mode, 'INDEP'); assert.deepEqual(s.rows, [1, 2]);
  assert.equal(s.output, false); assert.equal(s.lock, false);
  assert.deepEqual(s.display.map((r) => [r.ch, r.v, r.a, r.mode]), [[1, '0.00', '0.100', null], [2, '0.00', '0.100', null]]);
});

test('I04-1／I04-7：四顆 Voltage 旋鈕只改自己的通道，到端點夾住', () => {
  const m = fresh();
  for (const [id, ch] of [[K.V1, 1], [K.V2, 2], [K.V3, 3], [K.V4, 4]]) {
    const before = m.snapshot().vset;
    slow(m, id, 3);
    const after = m.snapshot().vset;
    for (const c of [1, 2, 3, 4]) assert.equal(after[c], c === ch ? 0.03 : before[c], `轉 CH${ch}，看 CH${c}`);
  }
  fast(m, K.V3, 20); fast(m, K.V4, 30); fast(m, K.V1, 50);
  assert.deepEqual(m.snapshot().vset, { 1: 32, 2: 0.03, 3: 5, 4: 15 });
  assert.equal(slow(m, K.V1, 1).kind, 'info'); // 上限提示，不溢位
  fast(m, K.V1, -50);
  assert.deepEqual(m.snapshot().vset, { 1: 0, 2: 0.03, 3: 5, 4: 15 });
});

test('GPE-F02：只有 CH1／CH2 有限流旋鈕，0–3 A', () => {
  const m = fresh();
  slow(m, K.I1, 5); assert.equal(m.snapshot().iset[1], 0.105);
  fast(m, K.I2, 40); assert.equal(m.snapshot().iset[2], 3);
  fast(m, K.I1, -40); assert.equal(m.snapshot().iset[1], 0);
  const knobs = Object.entries(m.layout.shapes).filter(([, s]) => s?.shape === 'knob').map(([id]) => id);
  assert.equal(knobs.length, 6);
  assert.deepEqual(knobs.filter((id) => id.includes('CURRENT')).sort(), [K.I1, K.I2].sort());
});

test('旋鈕步進：慢轉 10 mV；快轉 ×10／×100 並對齊；反向回到細調（GAP-GPE-03 暫定）', () => {
  const m = fresh();
  slow(m, K.V1, 7);
  m.tick(200); m.turn(K.V1, 1); m.tick(100); m.turn(K.V1, 1);
  assert.equal(m.snapshot().vset[1], 0.1); // 0.08 → ×10 對齊 0.10
  m.tick(10); m.turn(K.V1, 1);
  assert.equal(m.snapshot().vset[1], 1);   // ×100 對齊 1.00
  m.tick(10); m.turn(K.V1, -1);
  assert.equal(m.snapshot().vset[1], 0.99); // 反向第一格是細調
});

test('I04-2：切到 ④ 後轉 CH1 Voltage，改的是 CH1、顯示不跳回（GPE-F03、GAP-GPE-04）', () => {
  const m = fresh();
  m.press(K.CH14);
  assert.deepEqual(row(m, 0), [4, '0.00', '---', null]);
  const h = slow(m, K.V1, 2);
  assert.equal(h.kind, 'approx'); assert.match(h.text, /CH1\/CH4/);
  assert.deepEqual(row(m, 0), [4, '0.00', '---', null]);
  m.press(K.CH14);
  assert.deepEqual(row(m, 0), [1, '0.02', '0.100', null]);
  assert.equal(m.snapshot().vset[4], 0);
  m.press(K.CH23); assert.equal(row(m, 1)[0], 3);
  m.press(K.CH23); assert.equal(row(m, 1)[0], 2);
});

test('I04-4：L1 在 CH1、CH2 都成立：100 Ω CV、10 Ω CC、開路讀回 0（GPE-F09）', () => {
  for (const ch of [1, 2]) {
    const m = fresh();
    fast(m, ch === 1 ? K.V1 : K.V2, 6);
    m.press(K.OUT);
    const k = ch - 1, other = 1 - k;
    m.scenarios.set(`ch${ch}-100`); assert.deepEqual(row(m, k), [ch, '5.00', '0.050', 'CV']);
    m.scenarios.set(`ch${ch}-10`); assert.deepEqual(row(m, k), [ch, '1.00', '0.100', 'CC']);
    assert.deepEqual(row(m, other), [other + 1, '0.00', '0.000', 'CV']); // 另一路不受影響
    m.scenarios.set('open'); assert.deepEqual(row(m, k), [ch, '5.00', '0.000', 'CV']);
  }
});

test('I04-3：Output OFF 顯示設定值（不是讀回）；OFF→ON→OFF 設定不變、燈與圖示同步（GPE-F04、F05）', () => {
  const m = fresh();
  fast(m, K.V1, 6); m.scenarios.set('ch1-100');
  assert.deepEqual(row(m, 0), [1, '5.00', '0.100', null]);
  assert.equal(m.visual(K.OUT).lit, false); assert.ok(lit(m.lcd()).includes('OFF'));
  m.press(K.OUT);
  assert.deepEqual(row(m, 0), [1, '5.00', '0.050', 'CV']);
  assert.equal(m.visual(K.OUT).lit, true);
  assert.ok(lit(m.lcd()).includes('ON') && !lit(m.lcd()).includes('OFF'));
  m.press(K.OUT);
  assert.deepEqual(row(m, 0), [1, '5.00', '0.100', null]);
  assert.ok(!lit(m.lcd()).includes('CV') && !lit(m.lcd()).includes('CC'));
  assert.deepEqual([m.snapshot().vset[1], m.snapshot().iset[1]], [5, 0.1]);
});

test('I04-6：Set View 看 I-set；再按或 3 s 無操作返回；OFF 時沒有變化（GAP-GPE-02）', () => {
  const m = fresh();
  fast(m, K.V1, 6); m.press(K.OUT); // 開路
  assert.equal(row(m, 0)[2], '0.000'); // 無負載讀回 0，不是 I-set
  assert.equal(m.press(K.SET).kind, 'approx');
  assert.deepEqual(row(m, 0), [1, '5.00', '0.100', null]);
  assert.equal(m.snapshot().display[0].set, true);
  assert.ok(m.lcd().includes('data-layer="after"')); // LCD 到時自己換回讀回
  m.press(K.SET);
  assert.equal(row(m, 0)[2], '0.000');
  m.press(K.SET); m.tick(2500); slow(m, K.I1, 1); // 操作會重新計時
  assert.equal(row(m, 0)[2], '0.101');
  m.tick(2900); assert.equal(m.snapshot().setView, true);
  m.tick(200); assert.equal(m.snapshot().setView, false);
  assert.deepEqual(row(m, 0), [1, '5.00', '0.000', 'CV']);
  m.press(K.OUT);
  const before = JSON.stringify(m.snapshot());
  assert.equal(m.press(K.SET).kind, 'approx');
  assert.equal(JSON.stringify(m.snapshot()), before);
});

test('I04-5／I04-7：模式鍵組合、換模式自動關 Output、第四組合仍是 Independent（GPE-F06）', () => {
  const m = fresh();
  m.press(K.OUT); m.press(K.CH14); m.press(K.CH23);
  assert.match(m.press(K.RIGHT).text, /自動 OFF/);
  let s = m.snapshot();
  assert.deepEqual([s.mode, s.output, s.rows], ['SER', false, [1, 2]]);
  assert.ok(lit(m.lcd()).includes('SER') && !lit(m.lcd()).includes('PARA'));
  m.press(K.OUT); m.press(K.LEFT);
  s = m.snapshot(); assert.deepEqual([s.mode, s.output], ['PARA', false]);
  assert.ok(lit(m.lcd()).includes('PARA') && !lit(m.lcd()).includes('SER'));
  m.press(K.OUT); m.press(K.RIGHT); // 左按下＋右彈起
  s = m.snapshot(); assert.deepEqual([s.mode, s.output], ['INDEP', false]);
  assert.equal(m.visual(K.LEFT).active, true); assert.equal(m.visual(K.RIGHT).active, false);
  m.press(K.OUT);
  assert.equal(m.press(K.LEFT).kind, 'approx'); // 模式沒變 → Output 不關
  s = m.snapshot(); assert.deepEqual([s.mode, s.output], ['INDEP', true]);
  assert.ok(!lit(m.lcd()).includes('SER') && !lit(m.lcd()).includes('PARA'));
});

test('Series：CH1 Voltage 設兩路、CH2 Voltage 無效、限流各自、回 Independent 用自己的設定（GPE-F07）', () => {
  const m = fresh();
  slow(m, K.V2, 3); fast(m, K.V1, 6); m.scenarios.set('ch1-100');
  m.press(K.RIGHT); m.press(K.OUT);
  assert.deepEqual([row(m, 0), row(m, 1)], [[1, '5.00', '0.050', 'CV'], [2, '5.00', '0.000', 'CV']]);
  assert.equal(slow(m, K.V2, 5).kind, 'approx');
  assert.deepEqual(row(m, 1), [2, '5.00', '0.000', 'CV']);
  assert.equal(m.snapshot().vset[2], 0.08); // 旋鈕位置記住
  slow(m, K.V1, 1);
  assert.deepEqual([row(m, 0)[1], row(m, 1)[1]], ['5.01', '5.01']);
  slow(m, K.V1, -1);
  m.scenarios.set('ch2-10'); // slave 由 CH2 Current 限流
  assert.deepEqual([row(m, 0), row(m, 1)], [[1, '5.00', '0.000', 'CV'], [2, '1.00', '0.100', 'CC']]);
  m.press(K.RIGHT); m.press(K.OUT); m.scenarios.set('open');
  assert.deepEqual(row(m, 1), [2, '0.08', '0.000', 'CV']);
});

test('Parallel：CH2 旋鈕停用、CH2 顯示 CC、每列一半電流、合併限流 2×I1set（GPE-F08）', () => {
  const m = fresh();
  fast(m, K.V1, 6); m.scenarios.set('ch1-100');
  m.press(K.RIGHT); m.press(K.LEFT); m.press(K.OUT);
  assert.deepEqual([row(m, 0), row(m, 1)], [[1, '5.00', '0.025', 'CV'], [2, '5.00', '0.025', 'CC']]);
  assert.equal(slow(m, K.V2, 3).kind, 'approx');
  assert.equal(slow(m, K.I2, 3).kind, 'approx');
  assert.deepEqual(row(m, 1), [2, '5.00', '0.025', 'CC']);
  m.scenarios.set('ch1-10'); // 0.5 A > 0.2 A → CC，V＝0.2 A×10 Ω
  assert.deepEqual([row(m, 0), row(m, 1)], [[1, '2.00', '0.100', 'CC'], [2, '2.00', '0.100', 'CC']]);
});

test('GPE-F10：CH3／CH4 換模式後四路全關，要重新 ON 讀回才回來', () => {
  const m = fresh();
  fast(m, K.V3, 6); fast(m, K.V4, 6); m.scenarios.set('ch34');
  m.press(K.OUT); m.press(K.CH23); m.press(K.CH14);
  assert.deepEqual([row(m, 0), row(m, 1)], [[4, '5.00', '0.005', 'CV'], [3, '5.00', '0.050', 'CV']]);
  m.press(K.RIGHT);
  assert.deepEqual([m.snapshot().output, m.snapshot().rows], [false, [1, 2]]);
  assert.ok(lit(m.lcd()).includes('OFF') && !lit(m.lcd()).includes('CV'));
  m.press(K.CH23); m.press(K.CH14);
  assert.deepEqual([row(m, 0), row(m, 1)], [[4, '5.00', '---', null], [3, '5.00', '---', null]]); // 設定值，不是讀回
  m.press(K.OUT);
  assert.deepEqual([row(m, 0), row(m, 1)], [[4, '5.00', '0.005', 'CV'], [3, '5.00', '0.050', 'CV']]);
  assert.deepEqual([m.snapshot().vset[3], m.snapshot().vset[4]], [5, 5]);
});

test('I04-6：Lock 只鎖 CH1／CH2 Voltage；Output 照常；解鎖時 Output 關（GPE-F12、GAP-GPE-01）', () => {
  const m = fresh();
  fast(m, K.V1, 6); m.press(K.OUT);
  assert.equal(m.press(K.SET, { long: true }).kind, 'approx');
  assert.equal(m.snapshot().lock, true); assert.ok(lit(m.lcd()).includes('Lock'));
  assert.match(slow(m, K.V1, 3).text, /Lock/);
  slow(m, K.V2, 1);
  assert.deepEqual([m.snapshot().vset[1], m.snapshot().vset[2]], [5, 0]);
  slow(m, K.I1, 2); slow(m, K.V3, 1);
  assert.deepEqual([m.snapshot().iset[1], m.snapshot().vset[3]], [0.102, 0.01]);
  m.press(K.OUT); assert.equal(m.snapshot().output, false);
  m.press(K.OUT); assert.equal(m.snapshot().output, true);
  m.press(K.SET, { long: true });
  assert.deepEqual([m.snapshot().lock, m.snapshot().output], [false, false]);
  assert.ok(!lit(m.lcd()).includes('Lock'));
  slow(m, K.V1, 1); assert.equal(m.snapshot().vset[1], 5.01);
});

test('POWER：關機不反應；開機回到重設狀態、全段顯示 1 s；測試情境保留', () => {
  const m = fresh();
  fast(m, K.V1, 6); m.press(K.RIGHT); m.press(K.OUT); m.scenarios.set('ch1-100');
  m.press(K.POWER);
  assert.equal(m.isOn(), false); assert.equal(m.visual(K.OUT).lit, false);
  assert.equal(m.press(K.OUT).kind, 'info'); assert.equal(m.turn(K.V1, 1), null);
  assert.equal(m.snapshot().vset[1], 5);
  assert.equal(m.press(K.POWER).kind, 'approx');
  const s = m.snapshot();
  assert.deepEqual([s.on, s.booting, s.mode, s.output, s.lock, s.rows, s.vset[1], s.load], [true, true, 'INDEP', false, false, [1, 2], 0, 'ch1-100']);
  assert.ok(m.lcd().includes('data-v="8.8.8.8."'));
  m.tick(1100);
  assert.equal(m.snapshot().booting, false); assert.ok(!m.lcd().includes('8.8.8.8.'));
});

test('LCD：只有英文字樣；OVP／OCP／OTP、CH3 固定列、列首 Out 恆暗（common §0.2-5）', () => {
  const m = fresh();
  const svgs = [];
  m.press(K.POWER); m.press(K.POWER); svgs.push(m.lcd()); // 開機全段
  m.tick(1100); fast(m, K.V1, 6); m.scenarios.set('ch1-10'); m.press(K.OUT); svgs.push(m.lcd());
  m.press(K.SET); svgs.push(m.lcd());
  m.press(K.SET, { long: true }); m.press(K.RIGHT); m.press(K.LEFT); m.press(K.OUT); svgs.push(m.lcd());
  for (const s of svgs) {
    assert.doesNotMatch(s, /[　-鿿＀-￯]/);
    const on = lit(s);
    for (const w of ['OVP', 'OCP', 'OTP', 'Out']) assert.ok(!on.includes(w), w);
    assert.ok(!on.some((t) => t.includes('OverLoad')));
  }
});

test('理想模型邊界不出 NaN；測試情境介面', () => {
  assert.deepEqual(solve(5, 0.1), { v: 5, i: 0, cc: false });
  assert.deepEqual(solve(5, 0.1, 0), { v: 0, i: 0.1, cc: true });
  assert.deepEqual(solve(5, 0.1, 100), { v: 5, i: 0.05, cc: false });
  assert.deepEqual(solve(5, 0.1, 10), { v: 1, i: 0.1, cc: true });
  const m = fresh();
  assert.deepEqual(m.scenarios.list.map((s) => s.id), ['open', 'ch1-100', 'ch1-10', 'ch2-100', 'ch2-10', 'ch34']);
  assert.equal(m.scenarios.set('nope').kind, 'reject'); assert.equal(m.scenarios.get(), 'open');
  m.reset(); m.scenarios.set('ch34'); m.reset(); assert.equal(m.scenarios.get(), 'ch34');
});
