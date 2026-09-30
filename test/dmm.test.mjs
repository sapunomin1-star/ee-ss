// 34460A 模型：照 docs/data/dmm.json 的 DMM-F01～F15 驗收與 GAP-DMM 暫定行為按鍵。真 UI 操作見 scripts/e2e/dmm.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import { DmmModel, FUNCS, D1, pickRange, fmtReading } from '../src/instruments/dmm/model.js';

const KEY = {
  DCV: 'DMM.KEY.DCV', ACV: 'DMM.KEY.ACV', OHM: 'DMM.KEY.OHM_2W', CONT: 'DMM.KEY.CONT', NULL: 'DMM.KEY.NULL',
  SHIFT: 'DMM.KEY.SHIFT', RANGE: 'DMM.KEY.RANGE', UP: 'DMM.KEY.RANGE_UP', DOWN: 'DMM.KEY.RANGE_DOWN',
  S1: 'DMM.SOFT.S1', S2: 'DMM.SOFT.S2', FREQ: 'DMM.KEY.FREQ', RUN: 'DMM.KEY.RUN_STOP', UP_ARROW: 'DMM.KEY.UP', POWER: 'DMM.PWR.POWER',
};
// run(m, 'SHIFT DCV RANGE') → 依序按鍵，回傳最後一個提示
function run(m, seq) {
  let last = null;
  for (const t of seq.split(/\s+/).filter(Boolean)) last = m.press(KEY[t] ?? t);
  return last;
}
const fresh = (fx = 'none') => { const m = new DmmModel(); m.scenarios.set(fx); return m; };
const lcd = (m) => { const v = m.view(); return `${v.text} ${v.unit}`.trim(); };
const range = (m) => m.view().rangeLabel;
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('F15 開機預設：DCV、Auto、Null 關、Shift 未按；LCD 畫面帶功能名與 Auto Trigger', () => {
  const m = fresh('dcv');
  assert.equal(m.fn, 'DCV'); assert.equal(m.st.auto, true); assert.equal(m.st.nullOn, false); assert.equal(m.shift, false);
  const svg = m.lcd();
  assert.ok(svg.includes('DC Voltage') && svg.includes('Auto Trigger') && svg.includes('+01.234 00'));
});

test('F02 DCV：1.234 V Auto 落在 10 V 檔；手動 10／100／1000 V 同物理值只差解析度；1 V、100 mV 超量程', () => {
  const m = fresh('dcv');
  assert.equal(lcd(m), '+01.234 00 VDC'); assert.equal(range(m), 'Auto 10V');
  run(m, 'RANGE'); assert.equal(range(m), 'Manual 10V'); assert.equal(lcd(m), '+01.234 00 VDC');
  run(m, 'UP'); assert.equal(lcd(m), '+001.234 0 VDC'); near(m.view().value, 1.234);
  run(m, 'UP'); assert.equal(lcd(m), '+0001.234 VDC'); near(m.view().value, 1.234);
  assert.equal(run(m, 'UP').kind, 'info'); assert.equal(range(m), 'Manual 1000V'); // 端點停住
  run(m, 'DOWN DOWN DOWN');
  assert.equal(range(m), 'Manual 1V'); assert.equal(m.view().state, 'over');
  assert.equal(m.view().text, '-------'); assert.ok(!lcd(m).includes('1.2') && !lcd(m).includes('0.0')); // 不截斷成 1.2、不顯示 0
  run(m, 'DOWN'); assert.equal(range(m), 'Manual 100mV'); assert.equal(lcd(m), '------- mVDC');
  assert.equal(run(m, 'DOWN').kind, 'info'); assert.equal(range(m), 'Manual 100mV');
  run(m, 'RANGE'); assert.equal(range(m), 'Auto 10V'); assert.equal(lcd(m), '+01.234 00 VDC');
});

test('F08：Auto 時按 +／− 先轉手動再移一檔；S1 軟鍵＝Range；+／− 連續按可以恢復', () => {
  const m = fresh('dcv');
  const h = run(m, 'DOWN');
  assert.equal(h.kind, 'approx'); assert.equal(m.st.auto, false); assert.equal(range(m), 'Manual 1V');
  run(m, 'UP'); assert.equal(lcd(m), '+01.234 00 VDC');
  run(m, 'S1'); assert.equal(m.st.auto, true);
  run(m, 'S1'); assert.equal(m.st.auto, false); assert.equal(range(m), 'Manual 10V');
  assert.deepEqual(m.view().soft[0], { label: 'Range', value: '10V' });
});

test('F03 ACV：2 Vrms Auto 10 V、手動 1 V 超量程；DC 1.234 V 在 ACV 只量交流成分＝0', () => {
  const m = fresh('acv');
  run(m, 'ACV');
  assert.equal(lcd(m), '+02.000 00 VAC'); assert.equal(range(m), 'Auto 10V');
  run(m, 'DOWN'); assert.equal(range(m), 'Manual 1V'); assert.equal(m.view().state, 'over');
  const m2 = fresh('dcv');
  assert.ok(run(m2, 'ACV').text.includes('只量交流成分')); // 儀器外說明 AC 耦合
  assert.equal(m2.view().state, 'value'); assert.equal(m2.view().value, 0);
  assert.ok(!lcd(m2).includes('1.234')); assert.equal(lcd(m2), '+000.000 0 mVAC');
  const m3 = fresh('acv'); // 純正弦在 DCV 的直流成分＝0
  assert.equal(m3.view().value, 0); assert.equal(range(m3), 'Auto 100mV');
});

test('F04 DCI：Shift→DCV；12.34 mA Auto 100 mA、手動 10 mA 超量程；量程到 3 A、沒有 10 A', () => {
  const m = fresh('dci');
  run(m, 'SHIFT DCV');
  assert.equal(m.fn, 'DCI'); assert.equal(m.shift, false);
  assert.equal(lcd(m), '+012.340 0 mADC'); assert.equal(range(m), 'Auto 100mA');
  run(m, 'RANGE DOWN'); assert.equal(range(m), 'Manual 10mA'); assert.equal(m.view().state, 'over');
  assert.deepEqual(FUNCS.DCI.ranges.map((r) => r.label), ['100µA', '1mA', '10mA', '100mA', '1A', '3A']);
  assert.equal(FUNCS.DCI.ranges.at(-1).limit, 3); // 3 A 無超量程
});

test('F05 ACI：Shift→ACV；5 mArms Auto 10 mA；DC 12.34 mA 在 ACI 不顯示 12.34', () => {
  const m = fresh('aci');
  run(m, 'SHIFT ACV');
  assert.equal(m.fn, 'ACI'); assert.equal(lcd(m), '+05.000 00 mAAC'); assert.equal(range(m), 'Auto 10mA');
  m.scenarios.set('dci');
  assert.ok(!lcd(m).includes('12.34')); assert.equal(m.view().value, 0);
});

test('F06 Ω2W：1 kΩ Auto 1 kΩ 檔；手動 100 Ω 超量程；開路是超量程不是 0；短路 0.5 Ω', () => {
  const m = fresh('r1k');
  run(m, 'OHM');
  assert.equal(lcd(m), '+1.000 000 kΩ'); assert.equal(range(m), 'Auto 1kΩ');
  run(m, 'DOWN'); assert.equal(range(m), 'Manual 100Ω'); assert.equal(m.view().state, 'over');
  run(m, 'RANGE');
  m.scenarios.set('open');
  assert.equal(m.view().state, 'over'); assert.equal(range(m), 'Auto 100MΩ'); assert.notEqual(m.view().value, 0);
  m.scenarios.set('short');
  assert.equal(lcd(m), '+000.500 0 Ω'); assert.equal(range(m), 'Auto 100Ω');
});

test('F07 導通：0.5 Ω 有 ·)) 指示；1 kΩ 顯示電阻無指示；開路 OPEN；量程鍵與 S1 不改量程', () => {
  const m = fresh('short');
  assert.ok(run(m, 'CONT').text.includes('≤ 10 Ω'));
  assert.equal(m.view().beep, true); assert.equal(lcd(m), '+0.000 500 kΩ');
  m.scenarios.set('r1k');
  assert.equal(m.view().beep, false); assert.equal(lcd(m), '+1.000 000 kΩ');
  m.scenarios.set('open');
  assert.equal(m.view().state, 'open'); assert.equal(lcd(m), 'OPEN'); assert.equal(m.view().beep, false);
  const before = JSON.stringify(m.snapshot());
  assert.equal(run(m, 'RANGE').kind, 'approx');
  run(m, 'UP DOWN S1');
  assert.equal(JSON.stringify(m.snapshot()), before);
  assert.deepEqual(m.view().soft, []); // 導通畫面不顯示 Range
});

test('F10／F11 不相容：沒有讀值、讀值欄留空，也不沿用上一功能的讀值', () => {
  const m = fresh('dcv');
  assert.equal(m.view().state, 'value');
  const h = run(m, 'SHIFT DCV');
  assert.equal(m.fn, 'DCI'); assert.equal(m.view().state, 'none'); assert.equal(m.view().text, '');
  assert.ok(h.text.includes('未提供相容測試輸入'));
  assert.ok(!m.lcd().includes('1.234'));
  // 相容表：電壓→DCV／ACV、電阻→Ω2W／Cont、電流→DCI／ACI；未接情境→全部沒有讀值
  const ok = { none: [], dcv: ['DCV', 'ACV'], acv: ['DCV', 'ACV'], r1k: ['OHM', 'CONT'], short: ['OHM', 'CONT'], open: ['OHM', 'CONT'], dci: ['DCI', 'ACI'], aci: ['DCI', 'ACI'], bench: [] }; // bench：單元測試沒有接實驗台電路，全部沒有讀值
  for (const { id } of D1) {
    for (const fn of Object.keys(FUNCS)) {
      const t = fresh(id);
      t.setFn(fn);
      assert.equal(t.view().state === 'none', !ok[id].includes(fn), `${id} 在 ${fn}`);
      if (t.view().state === 'none') assert.ok(t.status().some(([, v]) => v.includes('未提供相容測試輸入')));
    }
  }
});

test('F09 Null：取基準→換情境看差值→關閉恢復；每功能各自保存；換量程保留基準', () => {
  const m = fresh('short');
  run(m, 'OHM');
  assert.equal(run(m, 'NULL').kind, 'approx');
  assert.equal(lcd(m), '+000.000 0 Ω'); assert.ok(m.lcd().includes('>Null<'));
  m.scenarios.set('r1k'); // 不重取基準
  assert.equal(lcd(m), '+0.999 500 kΩ'); near(m.view().value, 999.5);
  run(m, 'RANGE UP'); assert.equal(range(m), 'Manual 10kΩ'); assert.equal(lcd(m), '+00.999 50 kΩ'); // 基準以物理值保存
  run(m, 'RANGE');
  run(m, 'DCV'); assert.equal(m.view().nullOn, false); // DCV 不套用 Ω2W 的基準
  assert.ok(!m.lcd().includes('>Null<'));
  run(m, 'OHM'); assert.equal(m.view().nullOn, true); assert.equal(lcd(m), '+0.999 500 kΩ');
  m.scenarios.set('open'); assert.equal(m.view().state, 'over'); // 超量程時不做減法
  m.scenarios.set('r1k');
  assert.equal(run(m, 'NULL').kind, 'info'); assert.equal(lcd(m), '+1.000 000 kΩ');
});

test('F09 Null：超量程、開路、無輸入時不能開', () => {
  const m = fresh('none');
  assert.equal(run(m, 'NULL').kind, 'reject'); assert.equal(m.st.nullOn, false);
  m.scenarios.set('dcv');
  run(m, 'RANGE DOWN');
  assert.equal(run(m, 'NULL').kind, 'reject'); assert.equal(m.st.nullOn, false);
  m.scenarios.set('open');
  run(m, 'CONT');
  assert.equal(run(m, 'NULL').kind, 'reject');
  run(m, 'DCV');
  m.scenarios.set('dcv');
  run(m, 'RANGE NULL'); assert.equal(m.st.nullOn, true); assert.equal(lcd(m), '+00.000 00 VDC'); // 回 Auto 有讀值後才能開
});

test('F12 Shift：執行次功能後自動解除；再按取消；Ω4W／二極體／Math 未納入不改狀態', () => {
  const m = fresh('dcv');
  run(m, 'SHIFT'); assert.equal(m.shift, true);
  run(m, 'SHIFT'); assert.equal(m.shift, false);
  run(m, 'DCV'); assert.equal(m.fn, 'DCV');
  for (const k of ['OHM', 'CONT', 'NULL']) {
    const before = JSON.stringify({ ...m.snapshot(), shift: false });
    const h = run(m, `SHIFT ${k}`);
    assert.equal(h.kind, 'out', k); assert.equal(m.shift, false);
    assert.equal(JSON.stringify(m.snapshot()), before, `Shift→${k} 不改狀態`);
  }
  run(m, 'SHIFT RANGE'); assert.equal(m.shift, false); assert.equal(m.st.auto, false); // 無次標籤鍵：執行主功能並解除
  assert.ok(!m.lcd().includes('Shift')); // Shift 狀態不上 LCD
});

test('F13 未納入鍵：Freq、S2、Run/Stop、方向鍵回傳 out 且不改狀態', () => {
  const m = fresh('dcv');
  const before = JSON.stringify(m.snapshot());
  for (const k of ['FREQ', 'S2', 'RUN', 'UP_ARROW']) assert.equal(run(m, k).kind, 'out', k);
  assert.equal(JSON.stringify(m.snapshot()), before);
  assert.ok(run(m, 'SHIFT RUN').text.includes('Reset')); assert.equal(m.shift, false);
  const svg = m.lcd();
  for (const bad of ['10A', 'Front', 'Rear', 'Trend']) assert.ok(!svg.includes(bad), bad);
});

test('F15 電源：關機按鍵無作用、LCD 空；開機回到預設（測試情境不變）', () => {
  const m = fresh('r1k');
  run(m, 'OHM NULL RANGE');
  run(m, 'POWER');
  assert.equal(m.isOn(), false); assert.equal(m.lcd(), '');
  const h = run(m, 'DCV');
  assert.equal(h.kind, 'info'); assert.equal(m.fn, 'OHM');
  run(m, 'POWER');
  assert.equal(m.fn, 'DCV'); assert.equal(m.st.auto, true); assert.equal(m.shift, false);
  assert.ok(Object.values(m.per).every((p) => p.auto && !p.nullOn));
  assert.equal(m.fixture, 'r1k');
  m.reset(); assert.equal(m.fn, 'DCV');
});

test('F14 讀值格式：6½ 位、小數三位分組、帶正負號', () => {
  const [mv100, v1, v10] = FUNCS.DCV.ranges;
  assert.equal(fmtReading(0.63445, v1), '+0.634 450');
  assert.equal(fmtReading(30.6e-6, mv100), '+000.030 6');
  assert.equal(fmtReading(-1.234, v10), '-01.234 00');
  assert.equal(fmtReading(-1e-9, v10), '+00.000 00');
  assert.equal(fmtReading(1.2, v1), '+1.200 000');
});

test('GAP-DMM-05 Auto 選檔：≤ 1.2×量程的最小檔；1000 VDC、750 VAC、3 A 沒有超量程', () => {
  assert.equal(pickRange(FUNCS.DCV, 1.2), 1);
  assert.equal(pickRange(FUNCS.DCV, 1.21), 2);
  assert.equal(pickRange(FUNCS.DCV, 1000), 4);
  assert.equal(FUNCS.DCV.ranges[4].limit, 1000); assert.equal(FUNCS.ACV.ranges[4].limit, 750);
  assert.equal(pickRange(FUNCS.OHM, Infinity), FUNCS.OHM.ranges.length - 1);
});

test('LCD 只放英文字樣：各情境×功能都沒有中文；側欄與快照也不會丟例外（common §0.2-5）', () => {
  for (const { id } of D1) {
    for (const fn of Object.keys(FUNCS)) {
      const m = fresh(id);
      m.setFn(fn);
      run(m, 'NULL');
      assert.ok(!/[㐀-鿿]/.test(m.lcd()), `${id}／${fn}`);
      m.status(); JSON.stringify(m.snapshot());
      run(m, 'RANGE DOWN'); m.status(); m.lcd();
    }
  }
});

// ---- 2026-09-30 審查修正：AC 峰值升檔、規格外標示、輸入電阻 ----
test('ACV 自動量程也看峰值（D-DMM p.21 峰值過載升檔）；手動小量程峰值過載＝超量程', () => {
  const m = fresh('bench');
  // 窄脈衝：有效值 16.3 mV、峰值 1.33 V → 不能停在 100 mV 檔（峰值容量約 3×量程）
  const v = { ac: 0.01633, peakAc: 1.333, peak: 1.333, dc: 0, freq: 1000, now: 0, meanOver: () => 0, live: true };
  m.setBenchSource(() => ({ v, ohm: null, why: '' }));
  run(m, 'ACV');
  assert.equal(range(m), 'Auto 1V');
  assert.equal(pickRange(FUNCS.ACV, 0.01633), 0, '只看有效值會選 100 mV');
  run(m, 'RANGE DOWN');
  assert.equal(range(m), 'Manual 100mV'); assert.equal(m.view().state, 'over');
  assert.ok(m.readingHint().text.includes('峰值'));
  // 規格外：峰值因數 82 ＞ 10
  run(m, 'RANGE');
  assert.ok(m.specNotes().some((s) => s.includes('峰值因數')));
  assert.ok(m.status().some(([k]) => k === '規格外'));
});

test('ACV 規格頻寬 3 Hz–300 kHz 外標示真機讀值不準；DCV 不標示', () => {
  const m = fresh('bench');
  let v = { ac: 0.5, peakAc: 0.707, peak: 0.707, dc: 0, freq: 10e6, now: 0, meanOver: () => 0, live: true };
  m.setBenchSource(() => ({ v, ohm: null, why: '' }));
  run(m, 'ACV');
  assert.ok(m.specNotes()[0].includes('10 MHz') && m.specNotes()[0].includes('300 kHz'));
  v = { ...v, freq: 1000 };
  assert.deepEqual(m.specNotes(), []);
  v = { ...v, freq: 1 };
  assert.ok(m.specNotes()[0].includes('1 Hz'));
  run(m, 'DCV');
  assert.deepEqual(m.specNotes(), []);
});

test('輸入電阻（實驗台負載）：DCV 10 MΩ、ACV 1 MΩ、Ω 與關機不計', () => {
  const m = fresh('bench');
  assert.equal(m.inputZ(), 10e6);
  run(m, 'ACV'); assert.equal(m.inputZ(), 1e6);
  run(m, 'OHM'); assert.equal(m.inputZ(), null);
  run(m, 'DCV POWER'); assert.equal(m.inputZ(), null);
});

test('接在實驗台上就定時重畫（任何功能）；單機情境或關機不重畫', () => {
  const m = fresh('bench');
  m.setBenchSource(() => ({ v: null, ohm: null, why: '' }));
  assert.equal(m.isLive(), true);
  run(m, 'ACV'); assert.equal(m.isLive(), true);
  run(m, 'OHM'); assert.equal(m.isLive(), true);
  run(m, 'POWER'); assert.equal(m.isLive(), false);
  assert.equal(fresh('dcv').isLive(), false);
});
