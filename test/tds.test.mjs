// TDS2001C 模型：照 docs/data/tds.json 的驗收（TDS-F01～F21）按鍵、轉旋鈕。這是模型層測試；真 UI 操作見 scripts/e2e/tds.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import { TdsModel } from '../src/instruments/tds/model.js';

const K = {
  AUTOSET: 'TDS.KEY.AUTOSET', DEFAULT: 'TDS.KEY.DEFAULT_SETUP', RUN: 'TDS.KEY.RUN_STOP', SINGLE: 'TDS.KEY.SINGLE',
  CH1: 'TDS.KEY.CH1_MENU', CH2: 'TDS.KEY.CH2_MENU', TRIG: 'TDS.KEY.TRIG_MENU', MEAS: 'TDS.KEY.MEASURE', CURSOR: 'TDS.KEY.CURSOR',
  ACQ: 'TDS.KEY.ACQUIRE', HORIZ: 'TDS.KEY.HORIZ_MENU', ZERO: 'TDS.KEY.SET_TO_ZERO', FIFTY: 'TDS.KEY.SET_TO_50', FORCE: 'TDS.KEY.FORCE_TRIG',
  O1: 'TDS.SOFT.OPT1', O2: 'TDS.SOFT.OPT2', O3: 'TDS.SOFT.OPT3', O4: 'TDS.SOFT.OPT4', O5: 'TDS.SOFT.OPT5', POWER: 'TDS.PWR.ON_OFF',
  V1: 'TDS.KNOB.CH1_VOLTS_DIV', V2: 'TDS.KNOB.CH2_VOLTS_DIV', P1: 'TDS.KNOB.CH1_POSITION', P2: 'TDS.KNOB.CH2_POSITION',
  HS: 'TDS.KNOB.HORIZ_SCALE', HP: 'TDS.KNOB.HORIZ_POSITION', LEVEL: 'TDS.KNOB.TRIG_LEVEL', MULTI: 'TDS.KNOB.MULTIPURPOSE',
};
// run(m, 'AUTOSET CH1 O1') 依序按鍵，回傳最後一個非 null 提示；turn(m, 'V1', -2) 逆時針兩格
const run = (m, seq) => { let h = null; for (const t of seq.split(/\s+/).filter(Boolean)) h = m.press(K[t]) ?? h; return h; };
const turn = (m, id, n) => { let h = null; for (let i = 0; i < Math.abs(n); i++) h = m.turn(K[id], Math.sign(n)) ?? h; return h; };
const fresh = (scen = 'S1') => { const m = new TdsModel(); m.scenarios.set(scen); return m; };
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≉ ${b}`);
const stats = (m, i = 0) => m.snapshot().rec.stats[i];
const settings = (m) => JSON.stringify({ ch: m.ch, trig: m.trig, sIdx: m.sIdx, mpos: m.mpos, cursor: m.cursor, meas: m.meas });
// Measure 第 n 格（0 起算）設成指定 Type：Measure → OPTn → 按 Type 直到符合 → Back
function setMeas(m, n, type) {
  run(m, `MEAS O${n + 1}`);
  for (let k = 0; k < 6 && m.meas[n].type !== type; k++) run(m, 'O2');
  run(m, 'O5');
}
// LCD 上 CH 波形折線的 x、y 座標
function polyline(m, ch = 1) {
  const pts = m.lcd().match(new RegExp(`class="wave ch${ch}" points="([^"]+)"`))[1].split(' ').map((p) => p.split(',').map(Number));
  return { xs: pts.map((p) => p[0]), ys: pts.map((p) => p[1]) };
}
const rising = (arr, ref) => { let n = 0; for (let j = 1; j < arr.length; j++) if (arr[j - 1] < ref && arr[j] >= ref) n++; return n; };

test('首次載入＝Default Setup：500 ms/div 進入 Scan、只顯示 CH1 1.00 V、Probe 10X（GAP-TDS-08、19）', () => {
  const m = new TdsModel();
  const s = m.snapshot();
  assert.equal(s.status, 'Scan');
  near(s.sdiv, 0.5);
  assert.deepEqual(s.ch.map((c) => c.on), [true, false]);
  near(s.ch[0].vdiv, 1);
  assert.deepEqual(s.ch.map((c) => c.probe), [10, 10]);
  assert.equal(m.measure(0, 'PKPK').text, '?'); // Scan 時量測無效
});

test('AutoSet 對 S1：500 mV/div、250 µs/div、Trig\'d、Level 50%＝+0.5 V、自動量測由採集算出（TDS-F15、F21）', () => {
  const m = fresh();
  assert.equal(run(m, 'AUTOSET').kind, 'approx');
  const s = m.snapshot();
  near(s.ch[0].vdiv, 0.5);
  near(s.sdiv, 250e-6);
  assert.equal(s.status, "Trig'd");
  near(s.trig.levelV, 0.5);
  assert.equal(s.ch[0].probe, 10);
  // Cyc RMS＝√(0.5² + 0.707²)＝0.866 V（DC 耦合）
  assert.deepEqual(s.autoMeas.map((a) => a.text), ['866mV', '1.000kHz', '1.000ms', '2.00V']);
  assert.equal(m.visual('TDS.LED.AUTORANGE').lit, undefined); // AutoRange LED 不亮
});

test('同一份採集：LCD 波形的格數 × V/div＝Measure 的 Pk-Pk', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  const { ys } = polyline(m);
  const ppDiv = (Math.max(...ys) - Math.min(...ys)) / 25;
  near(ppDiv * m.vdiv(0), m.measure(0, 'PKPK').value, 0.01);
});

test('V/div 1 V → 500 mV：波形格數加倍、Pk-Pk 仍 2 V；Position 只移動波形（TDS-F02、F03）', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  turn(m, 'V1', -1);
  near(m.vdiv(0), 1);
  const span = () => (stats(m).max - stats(m).min) / m.vdiv(0);
  const a = span();
  assert.equal(m.measure(0, 'PKPK').text, '2.00V');
  turn(m, 'V1', 1);
  near(m.vdiv(0), 0.5);
  near(span() / a, 2, 1e-6);
  assert.equal(m.measure(0, 'PKPK').text, '2.00V');
  turn(m, 'P1', 25);
  assert.equal(m.ch[0].pos, 1);
  assert.equal(m.measure(0, 'PKPK').text, '2.00V');
  assert.equal(m.measure(0, 'FREQ').text, '1.000kHz');
});

test('s/div 500 µs → 250 µs：畫面週期數 5 → 2.5，Freq 仍 1 kHz（TDS-F04）', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  turn(m, 'HS', -1);
  near(m.sdiv, 500e-6);
  assert.equal(rising(m.rec.v[0], 0.05), 5);
  assert.equal(m.measure(0, 'FREQ').text, '1.000kHz');
  turn(m, 'HS', 1);
  near(m.sdiv, 250e-6);
  assert.ok([2, 3].includes(rising(m.rec.v[0], 0.05)));
  assert.equal(m.measure(0, 'FREQ').text, '1.000kHz');
});

test('水平位置：讀值與標記同步、Freq 不變；Set to Zero 歸零（TDS-F05）', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  turn(m, 'HP', -5); // 逆時針 5 格＝波形往左、M Pos +50 µs
  near(m.mpos, 50e-6, 1e-12);
  const lcd = m.lcd();
  assert.ok(lcd.includes('M Pos: 50.00µs'));
  assert.ok(lcd.includes('class="trig-pos" d="M127.0,10h6')); // 觸發標記在中央左邊 0.2 div
  assert.equal(m.measure(0, 'FREQ').text, '1.000kHz');
  run(m, 'ZERO');
  assert.equal(m.mpos, 0);
});

test('CH1／CH2 設定分開保存；連按 2 移除 CH2；Default Setup 後只剩 CH1（TDS-F01）', () => {
  const m = fresh('S2');
  run(m, 'AUTOSET');
  turn(m, 'V2', -1);
  turn(m, 'P2', 25);
  run(m, 'CH1 CH2 CH1');
  near(m.vdiv(0), 0.5);
  assert.equal(m.ch[0].pos, 0);
  near(m.vdiv(1), 1);
  assert.equal(m.ch[1].pos, 1);
  run(m, 'CH2 CH2');
  assert.equal(m.ch[1].on, false);
  assert.ok(!m.lcd().includes('rd-ch2'));
  run(m, 'CH2 DEFAULT');
  assert.deepEqual(m.ch.map((c) => c.on), [true, false]);
});

test('探棒錯配按比例錯讀，AutoSet 不改 Probe（TDS-F08）', () => {
  const m = fresh('S2');
  run(m, 'AUTOSET');
  setMeas(m, 0, 'PKPK');
  assert.equal(m.meas[0].type, 'PKPK');
  assert.equal(m.measure(0, 'PKPK').text, '2.00V'); // 實際 10×、儀器 10X
  run(m, 'CH1 O4');
  assert.equal(m.visual('TDS.LED.MULTIPURPOSE').lit, true);
  turn(m, 'MULTI', -1); // 10X → 1X
  assert.equal(m.ch[0].probe, 1);
  near(m.vdiv(0), 0.05);
  assert.equal(m.measure(0, 'PKPK').text, '200mV'); // 原值的 1/10
  run(m, 'AUTOSET');
  assert.equal(m.ch[0].probe, 1);
  assert.equal(m.measure(0, 'PKPK').text, '200mV');
  const m2 = fresh('S2P1'); // 實際 1×、儀器仍 10X：大 10 倍
  run(m2, 'AUTOSET');
  assert.equal(m2.measure(0, 'PKPK').text, '20.0V');
  near(m2.vdiv(0), 5);
});

test('S1 的耦合：DC 中心 +0.5 V、AC 回到 0、Ground 為接地標記上的水平線且跟著 Position（TDS-F06）', () => {
  const m = fresh();
  const center = () => (stats(m).max + stats(m).min) / 2;
  run(m, 'AUTOSET CH1');
  near(center(), 0.5, 0.01);
  near(stats(m).max, 1.5, 0.01);
  run(m, 'O1');
  assert.equal(m.ch[0].coupling, 'AC');
  near(center(), 0, 0.01);
  near(stats(m).max, 1, 0.01);
  assert.equal(m.measure(0, 'PKPK').text, '2.00V');
  run(m, 'O1');
  assert.equal(m.ch[0].coupling, 'GND');
  assert.equal(stats(m).max, 0);
  assert.equal(stats(m).min, 0);
  turn(m, 'P1', 25);
  assert.ok(polyline(m).ys.every((y) => Math.abs(y - (116 - 25)) < 0.06)); // 零伏線在 +1 div
  run(m, 'O1');
  assert.equal(m.ch[0].coupling, 'DC');
});

test('觸發耦合 AC 只影響觸發，不改通道耦合與波形（TDS-F07）', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  const before = stats(m);
  run(m, 'TRIG O5');
  assert.equal(m.trig.coup, 'AC');
  assert.equal(m.ch[0].coupling, 'DC');
  near(stats(m).max, before.max, 1e-3);
  near(stats(m).min, before.min, 1e-3);
});

test('Slope：Rising 時觸發點斜率為正、Falling 為負，都在 Level 上（TDS-F09）', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  const slope = () => m.sampleAt(0, 2e-6) - m.sampleAt(0, -2e-6);
  assert.ok(slope() > 0);
  near(m.sampleAt(0, 0), 0.5, 0.01);
  run(m, 'TRIG O3');
  assert.equal(m.trig.slope, 'F');
  assert.ok(slope() < 0);
  near(m.sampleAt(0, 0), 0.5, 0.01);
});

test('Set To 50%：Level 出範圍後按下回到 +0.5 V 並 Trig\'d（TDS-F11）', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  turn(m, 'LEVEL', 120);
  assert.equal(m.trigStatus(), 'Auto');
  assert.equal(m.trigFreq(), null); // 沒有觸發事件：頻率讀值不顯示（GAP-TDS-16）
  run(m, 'FIFTY');
  near(m.levelV(), 0.5);
  assert.equal(m.trigStatus(), "Trig'd");
});

test('S3c：Normal 下 Level 出範圍保留舊波形、狀態 Ready；改 Auto 後自由更新（TDS-F10）', () => {
  const m = fresh('S3C');
  run(m, 'AUTOSET TRIG O4');
  assert.equal(m.trig.mode, 'NORMAL');
  assert.equal(m.trigStatus(), "Trig'd");
  turn(m, 'LEVEL', 110); // +0.5 V → +1.6 V，超過峰值 +1.5 V
  assert.equal(m.trigStatus(), 'Ready');
  const n = m.rec.n;
  run(m, 'MEAS CURSOR');
  turn(m, 'V1', 1);
  assert.equal(m.rec.n, n); // 沒有新採集
  assert.ok(m.rec.v[0] && m.rec.triggered); // 舊的已觸發波形還在
  run(m, 'TRIG O4');
  assert.equal(m.trigStatus(), 'Auto');
  assert.ok(m.rec.n > n);
  assert.equal(m.rec.triggered, false);
  const k = m.rec.n;
  run(m, 'MEAS');
  assert.ok(m.rec.n > k);
  assert.equal(m.frames.length, 4); // 隨機相位多幀輪播（GAP-TDS-06）
  assert.ok(m.lcd().includes('<animate attributeName="opacity"'));
});

test('S3a：Default Setup 起 Normal 沒有新波形；Force Trig 出現一幀；Stop 時 Force 無效（TDS-F10、F12）', () => {
  const m = fresh('S3A');
  run(m, 'DEFAULT TRIG O4');
  assert.equal(m.trigStatus(), 'Ready');
  const n = m.acqN;
  run(m, 'MEAS CURSOR');
  turn(m, 'HS', 1);
  assert.equal(m.acqN, n);
  run(m, 'FORCE');
  assert.equal(m.acqN, n + 1);
  assert.equal(m.rec.triggered, false);
  run(m, 'RUN');
  const h = run(m, 'FORCE');
  assert.equal(h.kind, 'info');
  assert.equal(m.acqN, n + 1);
});

test('Stop：換成 2 kHz 後波形與 Measure 不變、觸發頻率讀值是新頻率；s/div 縮放凍結紀錄；改觸發設定變斷線（TDS-F13、GAP-TDS-21）', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  setMeas(m, 0, 'FREQ');
  run(m, 'RUN');
  assert.equal(m.trigStatus(), 'Stop');
  const n = m.rec.n;
  m.scenarios.set('S1F');
  assert.equal(m.rec.n, n);
  assert.equal(m.measure(0, 'FREQ').text, '1.000kHz');
  near(m.trigFreq(), 2000);
  assert.ok(m.lcd().includes('2.00000kHz'));
  const width = () => { const { xs } = polyline(m); return Math.max(...xs) - Math.min(...xs); };
  const w0 = width();
  turn(m, 'HS', -1); // 250 → 500 µs/div：紀錄只佔半個畫面
  near(width(), w0 / 2, 2);
  turn(m, 'V1', -1); // 改 V/div：保持實線
  assert.equal(m.rec.n, n);
  assert.equal(m.rec.broken, false);
  run(m, 'TRIG O3'); // 停止後改 Slope
  assert.equal(m.rec.broken, true);
  assert.ok(m.lcd().includes('stroke-dasharray="3 2"'));
  run(m, 'RUN');
  assert.ok(m.rec.n > n);
  assert.equal(m.rec.broken, false);
  assert.equal(m.measure(0, 'FREQ').text, '2.000kHz');
});

test('Single：取一幀後 Acq. Complete、換訊號畫面不變、再按再取；S3a 等觸發直到 Force（TDS-F14、GAP-TDS-07）', () => {
  const m = fresh();
  run(m, 'AUTOSET SINGLE');
  assert.equal(m.trigStatus(), 'Acq. Complete');
  const n = m.rec.n;
  m.scenarios.set('S1F');
  run(m, 'MEAS');
  assert.equal(m.rec.n, n);
  run(m, 'SINGLE');
  assert.equal(m.rec.n, n + 1);
  assert.equal(m.trigStatus(), 'Acq. Complete');
  const m2 = fresh('S3A');
  run(m2, 'AUTOSET');
  assert.equal(run(m2, 'SINGLE').kind, 'approx');
  assert.equal(m2.trigStatus(), 'Ready');
  run(m2, 'FORCE');
  assert.equal(m2.trigStatus(), 'Acq. Complete');
});

test('AutoSet 恢復案例：S2 的 CH1 Position +5 div → 歸零並選 500 mV/div；CH2 照一般規則（TDS-F15）', () => {
  const m = fresh('S2');
  run(m, 'AUTOSET');
  turn(m, 'P1', 125);
  assert.equal(m.ch[0].pos, 5);
  run(m, 'AUTOSET');
  assert.equal(m.ch[0].pos, 0);
  near(m.vdiv(0), 0.5);
  assert.equal(m.ch[1].pos, 0);
  near(m.vdiv(1), 0.5);
  assert.ok(stats(m).max / m.vdiv(0) <= 2 + 1e-9);
});

test('AutoSet 只調一次：之後幅度 ×5 時 V/div 不變、量測標 ?；Undo Autoset 回到先前設定', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  m.scenarios.set('S1X5');
  near(m.vdiv(0), 0.5);
  assert.ok(m.measure(0, 'PKPK').text.endsWith('?'));
  const m2 = fresh();
  const before = settings(m2);
  run(m2, 'AUTOSET');
  assert.equal(run(m2, 'O4').kind, 'approx');
  assert.equal(settings(m2), before);
});

test('量測無效：CH2 關閉後 Measure 2 Source 設 CH2 → 留空、不顯示 0（TDS-F16、GAP-TDS-14）', () => {
  const m = fresh('S2');
  run(m, 'AUTOSET CH2 CH2');
  assert.equal(m.ch[1].on, false);
  run(m, 'MEAS O2 O2'); // Measure 2 → Type Freq
  assert.equal(run(m, 'O1').kind, 'info'); // Source → CH2（未顯示）
  run(m, 'O5');
  assert.deepEqual(m.meas[1], { src: 1, type: 'FREQ' });
  assert.deepEqual(m.menuItems().items[1].lines, ['CH2', 'Freq', '']);
  assert.ok(m.status().some(([k, v]) => k === 'Measure 2' && v.includes('無效')));
});

test('游標：S2 量 CH1→CH2 上升零交越 Δt，250 µs/div 為 125±10 µs、50 µs/div 為 125±2 µs；來源關閉時不出現（TDS-F17）', () => {
  const m = fresh('S2');
  run(m, 'AUTOSET CURSOR O1 O4');
  assert.equal(m.cursor.type, 'TIME');
  assert.equal(m.knobTarget(), 'cursor');
  turn(m, 'MULTI', 100); // 游標 1：−4 div → 中央（CH1 零交越）
  run(m, 'O5');
  turn(m, 'MULTI', -87); // 游標 2：+4 div → +13 步（130 µs，CH2 零交越 125 µs 附近）
  let ci = m.cursorInfo();
  near(ci.dt, 125e-6, 10e-6, 'Δt @250µs/div');
  near(ci.v[0], 0, 0.02);
  turn(m, 'HS', 2); // 250 → 100 → 50 µs/div；游標格位不變
  near(m.sdiv, 50e-6);
  turn(m, 'MULTI', 50); // 游標 2：+63 步＝126 µs
  ci = m.cursorInfo();
  near(ci.dt, 125e-6, 2e-6, 'Δt @50µs/div');
  const box = m.menuItems().items[2].lines.join(' ');
  assert.ok(box.includes('Δt 126.0µs'), box);
  run(m, 'CH2 CH2 CURSOR O2'); // 關 CH2、游標來源改 CH2
  assert.deepEqual(m.cursorInfo(), { hidden: true });
  assert.ok(!m.lcd().includes('class="cursor'));
});

test('Default Setup：改亂後回到 Appendix E 的值、只顯示 CH1、Probe 不重設；接著 AutoSet 可再看到波形（TDS-F18）', () => {
  const m = fresh('S2');
  run(m, 'AUTOSET CH1 O1 O4');
  turn(m, 'MULTI', -1); // CH1 Probe 1X
  turn(m, 'P1', 10);
  run(m, 'CURSOR O1 TRIG O3 O4');
  setMeas(m, 2, 'PKPK');
  assert.equal(run(m, 'DEFAULT').kind, 'approx');
  const s = m.snapshot();
  assert.equal(s.msg, 'Default setup recalled');
  assert.ok(m.lcd().includes('Default setup recalled'));
  assert.deepEqual(s.ch.map((c) => c.on), [true, false]);
  assert.equal(s.ch[0].coupling, 'DC');
  assert.equal(s.ch[0].pos, 0);
  near(s.ch[0].vdiv, 1);
  assert.equal(s.ch[0].probe, 1); // Probe 不重設（GAP-TDS-09）
  near(s.sdiv, 0.5);
  assert.equal(s.mpos, 0);
  assert.deepEqual([s.trig.src, s.trig.slope, s.trig.mode, s.trig.coup, s.trig.level], [0, 'R', 'AUTO', 'DC', 0]);
  assert.equal(s.cursor.type, 'OFF');
  assert.ok(s.meas.every((q) => q.type === 'NONE' && q.src === 0));
  run(m, 'AUTOSET');
  assert.equal(m.trigStatus(), "Trig'd");
});

test('多功能旋鈕：Probe、Cursor 選取時 LED 亮並可調；離開後 LED 熄滅、旋轉不改值（TDS-F20）', () => {
  const m = fresh();
  run(m, 'AUTOSET CH1 O4');
  assert.equal(m.visual('TDS.LED.MULTIPURPOSE').lit, true);
  turn(m, 'MULTI', 1);
  assert.equal(m.ch[0].probe, 20);
  run(m, 'O5'); // Back
  assert.equal(m.visual('TDS.LED.MULTIPURPOSE').lit, false);
  const before = settings(m);
  assert.equal(turn(m, 'MULTI', 3).kind, 'info');
  assert.equal(settings(m), before);
  run(m, 'CURSOR O1');
  assert.equal(m.visual('TDS.LED.MULTIPURPOSE').lit, false); // 還沒選 Cursor 1／2
  run(m, 'O4');
  assert.equal(m.visual('TDS.LED.MULTIPURPOSE').lit, true);
});

test('選單裡的未納入選項回傳 out，不改狀態（common §0.2-3）', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  const check = (seq) => {
    const before = settings(m);
    const h = run(m, seq);
    assert.equal(h?.kind, 'out', seq);
    assert.equal(settings(m), before, seq);
  };
  run(m, 'CH1');
  check('O3'); // Volts/Div Fine
  check('O5'); // Invert
  run(m, 'O4');
  check('O2'); // Current 探棒
  run(m, 'TRIG');
  check('O1'); // Video／Pulse
  run(m, 'ACQ');
  check('O2');
  check('O3');
  run(m, 'HORIZ');
  check('O2');
  check('O4');
  run(m, 'AUTOSET');
  check('O2'); // Single-cycle sine
  check('O3'); // FFT
});

test('電源：關機畫面熄滅、按鍵無效；開機回復關機前設定並重新採集（common §0.2-1 TDS 例外）', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  turn(m, 'V1', 1);
  const n = m.rec.n;
  assert.equal(run(m, 'POWER').kind, 'approx');
  assert.equal(m.isOn(), false);
  assert.equal(run(m, 'AUTOSET').kind, 'info');
  assert.equal(m.turn(K.V1, 1), null);
  near(m.vdiv(0), 0.2);
  run(m, 'POWER');
  assert.equal(m.isOn(), true);
  near(m.vdiv(0), 0.2);
  assert.ok(m.rec.n > n);
});
