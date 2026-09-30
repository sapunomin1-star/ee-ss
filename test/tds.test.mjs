// TDS2001C 模型：照 docs/data/tds.json 的驗收（TDS-F01～F21）按鍵、轉旋鈕。這是模型層測試；真 UI 操作見 scripts/e2e/tds.mjs。
import test from 'node:test';
import assert from 'node:assert/strict';
import { TdsModel, SDIV, VDIV } from '../src/instruments/tds/model.js';
import { Bench, DEMO } from '../src/bench/bench.js';
import { stats as waveStats } from '../src/bench/circuit.js';

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
function freshBench(wave = 'SQUARE', freq = 1000, topo = 'RC') {
  const afg = { on: true, ch: [true, false].map((output) => ({ wave, freq, sym: 50, emfVpp: 2, emfOffset: 0, output })) };
  const bench = new Bench(afg);
  bench.topo = topo;
  Object.entries(DEMO).forEach(([lead, node]) => bench.connect(lead, node));
  const m = new TdsModel();
  m.setBenchSource(() => bench.tdsInput());
  m.setScenario('BENCH');
  return { m, bench, afg };
}
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

test('BENCH AutoSet 恰好兩週期：RC／CR 正弦與方波的 Freq、Period、Cyc RMS 可從紀錄量測', () => {
  for (const topo of ['RC', 'CR']) for (const wave of ['SINE', 'SQUARE']) for (const freq of [200, 2000]) {
    const { m, bench } = freshBench(wave, freq, topo);
    run(m, 'AUTOSET');
    near(10 * m.sdiv * freq, 2, 1e-9, `${topo} ${wave} ${freq} Hz 保持最小兩週期時基`);
    for (const [i, node] of ['A', 'B'].entries()) {
      const label = `${topo} ${wave} ${freq} Hz CH${i + 1}`;
      near(m.measure(i, 'FREQ').value, freq, freq * 1e-6, `${label} Freq`);
      near(m.measure(i, 'PERIOD').value, 1 / freq, 1e-9, `${label} Period`);
      const expected = waveStats(bench.solution().v[node]);
      const rms = Math.hypot(expected.mean, expected.acRms);
      near(m.measure(i, 'CYCRMS').value, rms, rms * 0.02, `${label} Cyc RMS`);
    }
    turn(m, 'HS', 2); // 縮到不足一週期：不得用邊界外資料捏造量測
    assert.ok(10 * m.sdiv * freq < 1);
    for (const type of ['FREQ', 'PERIOD', 'CYCRMS']) assert.equal(m.measure(0, type).value, null, type);
  }
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

test('BENCH 關機時同步拔線與探棒倍率但不採集；開機從當前接線重新採集', () => {
  const { m, bench, afg } = freshBench();
  run(m, 'AUTOSET POWER');
  const rec = m.rec, n = m.acqN;
  bench.disconnect('TDS.CH1.TIP');
  bench.probeX[0] = 1;
  m.inputChanged();
  assert.equal(m.fx.sig[0], null);
  assert.equal(m.fx.probe[0], 1);
  assert.equal(m.rec, rec);
  assert.equal(m.acqN, n);
  run(m, 'POWER');
  assert.ok(m.acqN > n);
  assert.equal(m.trigFreq(), null);
  assert.equal(m.measure(0, 'PKPK').value, 0);

  run(m, 'POWER');
  const offN = m.acqN;
  bench.connect('TDS.CH1.TIP', 'A');
  afg.ch[0].freq = 2000;
  // 即使未收到個別變更通知，開機也要重新取得來源。
  run(m, 'POWER AUTOSET');
  assert.ok(m.acqN > offN);
  near(m.measure(0, 'FREQ').value, 2000, 1e-6);
  assert.equal(m.ch[0].probe, 10); // 示波器設定保留，與實際 1× 錯配
  near(m.measure(0, 'PKPK').value, waveStats(bench.solution().v.A).pp * 10, 0.02);
});

test('BENCH Stop 期間來源保持更新但紀錄凍結，Single 才採入新頻率', () => {
  const { m, afg } = freshBench();
  run(m, 'AUTOSET RUN');
  const rec = m.rec, n = m.acqN;
  afg.ch[0].freq = 2000;
  m.inputChanged();
  assert.equal(m.rec, rec);
  assert.equal(m.acqN, n);
  near(m.trigFreq(), 2000);
  near(m.measure(0, 'FREQ').value, 1000, 1e-6);
  run(m, 'SINGLE');
  assert.equal(m.trigStatus(), 'Acq. Complete');
  assert.equal(m.acqN, n + 1);
  near(m.measure(0, 'FREQ').value, 2000, 1e-6);
});

// ---- 審查修正：採集時削頂、AC 耦合高通、BW Limit 濾波、AutoSet 辨識方波、慢時基混疊 ----
// 自訂實驗台來源：sig＝[{table, period, at?} 或 {vpp, dc, f, delay}, …]；probe＝實際探棒倍率（示波器 Probe 設定仍是 10X）
function custom(sig, probe = [1, 1]) {
  const m = new TdsModel();
  const fx = { sig, probe };
  m.setBenchSource(() => fx);
  m.setScenario('BENCH');
  return m;
}
const TM = 4000; // 表格點數（同實驗台）
const square = (hi = 1, lo = -1) => Float64Array.from({ length: TM }, (_, k) => (k < TM / 2 ? hi : lo));

test('採集時削頂：S1X5 V/div 轉小 3 格 → 停止 → 轉回，Pk-Pk 維持削頂後的 2.00V?、波形是平頂（p.108、p.31、p.105）', () => {
  const m = fresh('S1X5');
  run(m, 'AUTOSET');
  near(m.vdiv(0), 2);
  turn(m, 'V1', 3);
  near(m.vdiv(0), 0.2);
  assert.equal(m.measure(0, 'PKPK').text, '2.00V?');
  assert.deepEqual(m.rec.clip, [true, false]);
  assert.deepEqual(m.rec.fe[0], { base: 0.02, pos: 0, probe: 10, coupling: 'DC', bw: false }); // 採集時的前端設定
  run(m, 'RUN');
  turn(m, 'V1', -3);
  near(m.vdiv(0), 2);
  const r = m.measure(0, 'PKPK');
  assert.equal(r.text, '2.00V?');
  assert.match(r.why, /削頂/);
  const { ys } = polyline(m);
  near((Math.max(...ys) - Math.min(...ys)) / 25, 1, 0.05, '±1 V 平頂 ÷ 2 V/div＝1 div');
  assert.ok(m.status().some(([k, v]) => k === '採集紀錄' && v.includes('削頂')));
});

test('停止後放大：從紀錄算、不以新刻度重新削頂；超出畫面才加 ?，轉回後恢復（p.105）', () => {
  const m = fresh();
  run(m, 'AUTOSET RUN');
  assert.equal(m.measure(0, 'PKPK').text, '2.00V');
  turn(m, 'V1', 2); // 500 → 100 mV/div：波形超出 ±4 div
  assert.deepEqual(m.rec.clip, [false, false]);
  assert.deepEqual(m.measure(0, 'PKPK'), { text: '2.00V?', value: m.measure(0, 'PKPK').value, why: '波形超出畫面' });
  near(m.measure(0, 'PKPK').value, 2, 1e-3);
  turn(m, 'V1', -2);
  assert.equal(m.measure(0, 'PKPK').text, '2.00V');
});

test('AC 耦合（實驗台波形表）：一階高通週期穩態，20 Hz 方波半週期傾斜 1× 探棒約 79%、10× 探棒（fc 1 Hz）約 15%（GAP-TDS-12）', () => {
  for (const [X, fc] of [[1, 10], [10, 1]]) {
    const m = custom([{ table: square(X, -X), period: 0.05 }, null], [X, X]);
    run(m, 'CH1 O1');
    assert.equal(m.ch[0].coupling, 'AC');
    const p = m.path(0), h = 0.05 / TM, w = 2 * Math.PI * fc;
    near(1 - p.at((TM / 2 - 1) * h) / p.at(h), 1 - Math.exp(-(0.025 - 2 * h) * w), 1e-3, `${X}× 平台傾斜`);
    near(p.a, 2 / (1 + Math.exp(-0.025 * w)), 2e-3, `${X}× 穩態峰值 2/(1+e^(−T/2τ))`);
    near(p.mean, 0, 1e-9, 'AC：平均為 0');
    run(m, 'AUTOSET'); // AutoSet 不改 AC（只有 GND 改 DC）
    assert.equal(m.ch[0].coupling, 'AC');
    near(Math.max(...m.rec.v[0]), p.a, 0.01, '紀錄裡看得到平台起點的過衝');
  }
  const d = custom([{ table: square(), period: 0.05 }, null]); // 對照：DC 耦合沒有傾斜
  near(d.path(0).at(0.05 / TM) - d.path(0).at(0.0249), 0, 1e-12);
});

test('實驗台精確解 at(t)：表格之間逐點取值、觸發交越用精確解求準；統計仍用表格；AC 耦合＝at(t) − 低通表格', () => {
  const T = 1e-3, tau = 150e-9, h = T / TM;
  const exact = (t) => 2 + Math.exp(-((((t % T) + T) % T) / tau)); // 每週期開頭一個 τ＝150 ns 的窄脈衝（比表格間隔 250 ns 還窄）
  const table = Float64Array.from({ length: TM }, (_, k) => exact(k * h));
  const m = custom([{ table, period: T, at: exact }, null]);
  let p = m.path(0);
  near(p.at(100e-9), exact(100e-9), 1e-12, '取樣點之間用精確解（表格內插會是 2.676）');
  near(p.a, 0.5, 1e-12, '統計用表格');
  near(p.cross(2.5, 'R'), T, 1e-12, '上升交越在邊緣上（表格內插會早 125 ns）');
  const noAt = custom([{ table, period: T }, null]).path(0);
  near(noAt.at(100e-9), 2 + (1 - 0.4 * (1 - Math.exp(-h / tau))), 1e-12, '沒有 at 時維持表格線性內插');
  run(m, 'CH1 O1');
  p = m.path(0);
  const mean = table.reduce((s, x) => s + x, 0) / TM;
  near(p.at(100e-9), exact(100e-9) - mean, 1e-4, 'AC：精確解減掉低通（≈ 平均）');
});

test('觸發耦合 AC＝一階高通 10 Hz：擋直流（Set To 50% 回到 0）、衰減 10 Hz 以下，通道波形不變（p.21、p.97–98）', () => {
  const m = custom([{ table: square(2, 0), period: 1e-3 }, null]); // 0～2 V 方波
  run(m, 'AUTOSET');
  near(m.trig.level, 1, 1e-9, 'DC 耦合：50% 位準 1 V');
  const before = stats(m);
  run(m, 'TRIG O5 FIFTY');
  assert.equal(m.trig.coup, 'AC');
  near(m.trig.level, 0, 0.02 * m.base(0) + 1e-12, 'AC 耦合：直流被擋掉，50% 位準約 0 V');
  assert.equal(m.trigStatus(), "Trig'd");
  assert.equal(m.ch[0].coupling, 'DC');
  near(stats(m).max, before.max, 1e-9);
  near(stats(m).min, before.min, 1e-9);
  const s = custom([{ vpp: 2, dc: 0.5, f: 2, delay: 0 }, null]); // 2 Hz 正弦＋0.5 V
  run(s, 'TRIG O5');
  near(s.trigPath().a, 2 / Math.hypot(2, 10), 1e-12, '觸發路徑衰減到 f/√(f²+10²)');
  near(s.trigPath().m, 0, 1e-12);
  near(s.path(0).a, 1, 1e-12, '顯示的訊號不受影響');
  near(s.path(0).m, 0.5, 1e-12);
});

test('BW Limit 20 MHz：一階低通（正弦解析、表格夠細才濾、太粗不處理）；提示誠實標示近似；停止後切換變斷線', () => {
  const m = custom([{ vpp: 2, dc: 0, f: 20e6, delay: 0 }, null]);
  near(m.path(0).a, 1, 1e-12);
  const h = run(m, 'CH1 O2');
  assert.equal(m.ch[0].bw, true);
  assert.match(h.text, /一階低通 fc＝20 MHz/);
  assert.match(h.text, /近似/);
  assert.doesNotMatch(h.text, /只切換/);
  assert.deepEqual(m.menuItems().items[1].lines, ['BW Limit', 'On', '20MHz']);
  near(m.path(0).a, Math.SQRT1_2, 1e-12, 'fc 處振幅 ×0.707');
  near(m.path(0).d, 1 / (8 * 20e6), 1e-18, '相位落後 45°＝1/8 週期');
  // 5 MHz 方波：表格間隔 50 ps ≤ τ/2，邊緣變成 τ＝7.96 ns 的指數（表格的邊緣是一格寬的斜坡，等效在 −h/2）
  const tau = 1 / (2 * Math.PI * 20e6), T = 200e-9, hh = T / TM;
  const m2 = custom([{ table: square(), period: T }, null]);
  run(m2, 'CH1 O2');
  near(m2.path(0).at(tau), 1 - 2 * Math.exp(-(tau + hh / 2) / tau), 1e-4, '上升緣後一個 τ');
  // 1 kHz 方波：表格間隔 250 ns > τ/2，效果低於表格解析度，不處理
  const m3 = custom([{ table: square(), period: 1e-3 }, null]), ts = [1e-7, 3e-7, 0.25e-3];
  const before = ts.map((t) => m3.path(0).at(t));
  run(m3, 'CH1 O2');
  assert.deepEqual(ts.map((t) => m3.path(0).at(t)), before);
  // S1（1 kHz 正弦）讀值不變；AutoSet 回到 BW Full；停止後切換＝前端設定套不到凍結紀錄 → 斷線
  const m4 = fresh();
  run(m4, 'AUTOSET CH1 O2');
  assert.equal(m4.measure(0, 'PKPK').text, '2.00V');
  assert.ok(m4.lcd().includes('>BW<'));
  run(m4, 'AUTOSET');
  assert.equal(m4.ch[0].bw, false);
  run(m4, 'RUN CH1 O2');
  assert.equal(m4.rec.broken, true);
});

test('AutoSet 辨識方波（p.80–81、TDS-F21）：訊息區、Multi-cycle square 選單、Pk-Pk／Mean／Period／Freq；正弦沒有訊息；三角波無法判定', () => {
  const { m } = freshBench('SQUARE', 1000);
  const before = settings(m);
  assert.match(run(m, 'AUTOSET').text, /辨識為方波／脈波/);
  assert.equal(m.autoKind, 'SQUARE');
  assert.equal(m.msg, 'Square wave or pulse detected on CH1');
  assert.ok(m.lcd().includes('Square wave or pulse detected on CH1'));
  const am = m.snapshot().autoMeas;
  assert.deepEqual(am.map((a) => a.type), ['PKPK', 'MEAN', 'PERIOD', 'FREQ']);
  assert.deepEqual(am.slice(2).map((a) => a.text), ['1.000ms', '1.000kHz']);
  const items = m.menuItems().items;
  assert.deepEqual(items[0], { lines: ['Multi-cycle', 'square'], hot: [0, 1] });
  assert.deepEqual(items.map((it) => it.lines.join(' ')), ['Multi-cycle square', 'Single-cycle square', 'Rising edge', 'Falling edge', 'Undo Autoset']);
  const after = settings(m);
  for (const o of ['O2', 'O3', 'O4']) {
    assert.equal(run(m, o).kind, 'out', o);
    assert.equal(settings(m), after, o);
  }
  assert.equal(m.msg, ''); // 下一個操作清掉訊息
  assert.equal(run(m, 'O5').kind, 'approx'); // Undo Autoset 在 OPT5
  assert.equal(settings(m), before);

  const s = freshBench('SINE', 1000).m;
  run(s, 'AUTOSET');
  assert.equal(s.autoKind, 'SINE');
  assert.equal(s.msg, ''); // 手冊沒有正弦的訊息字樣，不自創
  assert.deepEqual(s.snapshot().autoMeas.map((a) => a.type), ['CYCRMS', 'FREQ', 'PERIOD', 'PKPK']);

  const r = freshBench('RAMP', 1000).m; // Ramp 對稱 50%＝三角波
  run(r, 'AUTOSET');
  assert.equal(r.autoKind, 'UNKNOWN');
  assert.equal(r.msg, '');
  assert.deepEqual(r.snapshot().autoMeas.map((a) => a.type), ['MEAN', 'PKPK']);
  assert.deepEqual(r.menuItems().items.map((it) => it.lines.join(' ')), ['', '', '', 'Undo Autoset', '']);
  assert.equal(run(r, 'O4').kind, 'approx');

  const t = custom([{ table: Float64Array.from({ length: TM }, (_, k) => Math.sin((2 * Math.PI * k) / TM) + 0.3), period: 1e-3 }, null]);
  run(t, 'AUTOSET');
  assert.equal(t.autoKind, 'SINE', '表格形式的正弦（含直流）也判為正弦');
});

test('慢時基取樣：欠取樣逐點混疊（1.001 kHz 在 250 ms/div 量到 1 Hz），連續採集輪播 4 幀；觸發頻率讀值仍是真實頻率；不再畫包絡帶', () => {
  const m = custom([{ vpp: 2, dc: 0, f: 1001, delay: 0 }, null]);
  run(m, 'AUTOSET TRIG O4'); // Normal：慢時基不進 Scan
  turn(m, 'HS', -9); // 250 µs → 250 ms/div：取樣間隔 1 ms，每週期不到 2 點
  near(m.sdiv, 0.25);
  assert.equal(m.trigStatus(), "Trig'd");
  assert.equal(m.frames.length, 4);
  assert.equal(new Set(m.frames.map((r) => r.v[0][0])).size, 4, '每幀的次取樣相位不同，混疊的樣子也不同');
  assert.equal(m.measure(0, 'FREQ').text, '1.000Hz'); // 從混疊的紀錄算：|1001 − 1000| Hz
  near(m.trigFreq(), 1001);
  const lcd = m.lcd();
  assert.ok(lcd.includes('1.00100kHz'));
  assert.equal((lcd.match(/<animate attributeName="opacity"/g) || []).length, 4);
  assert.ok(!lcd.includes('<rect class="wave'));
  assert.equal(m.snapshot().rec.band, undefined);
  run(m, 'SINGLE'); // Single：只取一幀、不輪播
  assert.equal(m.frames, null);
  assert.equal(m.trigStatus(), 'Acq. Complete');
  const d = new TdsModel(); // 首次載入＝500 ms/div Scan：1 kHz 每 2 ms 取一點 → 混疊成一條水平線
  const v = d.rec.v[0];
  assert.ok(Math.max(...v) - Math.min(...v) < 1e-9);
  assert.ok(d.lcd().includes('<mask id="tds-scan" maskUnits="userSpaceOnUse"'), 'Scan 遮罩用 LCD 座標：高度 0 的水平線不會被整條遮掉');
});

test('取樣充足時畫面穩定：次取樣相位含在紀錄時間軸裡，觸發點仍在 Level 上、不輪播', () => {
  const m = fresh();
  run(m, 'AUTOSET');
  assert.equal(m.frames, null);
  const off = (m.rec.t0 - (m.mpos - 5 * m.sdiv)) / m.rec.dt;
  assert.ok(off >= 0 && off < 1, `次取樣相位 ${off} 在一個取樣間隔內`);
  near(m.sampleAt(0, 0), 0.5, 0.01);
  const a = m.measure(0, 'FREQ').text;
  run(m, 'MEAS'); // 再採一筆：相位不同，讀值不變
  assert.equal(m.measure(0, 'FREQ').text, a);
  const { ys } = polyline(m); // 每像素欄最多兩點（最小、最大）
  assert.ok(ys.length <= 2 * 252 && ys.length >= 250, `${ys.length} 點`);
});

// ---- 2026-09-30 修正後複核：低頻方波邊緣的 BW、Single 擷取暫態、慢時基看到充電曲線 ----
function benchWith({ wave = 'SQUARE', freq = 1000, emfVpp = 2, emfOffset = 0, R = 1000, C = 0.1e-6, t0 = 100, output = true } = {}) {
  const clock = { t: t0 };
  const afg = { on: true, ch: [{ wave, freq, sym: 50, emfVpp, emfOffset, output }, { wave: 'SINE', freq: 1000, sym: 50, emfVpp: 2, emfOffset: 0, output: false }] };
  const bench = new Bench(afg);
  bench.now = () => clock.t;
  Object.assign(bench, { R, C });
  Object.entries(DEMO).forEach(([lead, node]) => bench.connect(lead, node));
  const m = new TdsModel();
  m.setBenchSource(() => bench.tdsInput());
  m.setScenario('BENCH');
  const change = (fn, dt = 0) => { clock.t += dt; fn(); bench.solution(); m.inputChanged(); };
  return { m, bench, afg, clock, change };
}
// 紀錄在 t（相對觸發點）的顯示電壓；B 點（電容）週期穩態的平均
const recAt = (m, i, t) => m.sampleAt(i, t);
const diffStatsB = (bench) => waveStats(bench.solution().v.B).mean;

test('BW Limit：1 kHz 方波的邊緣在快時基也被 20 MHz 一階低通圓化（10–90% 約 17.5 ns）', () => {
  const { m, clock } = benchWith();
  clock.t += 1;
  run(m, 'AUTOSET');
  m.sIdx = SDIV.indexOf(25e-9); m.mpos = 0; m.tick();
  const rise = () => {
    const r = m.rec.v[0], lo = Math.min(...r), hi = Math.max(...r), f = (q) => r.findIndex((y) => y >= lo + q * (hi - lo));
    return (f(0.9) - f(0.1)) * m.rec.dt;
  };
  assert.ok(rise() < 1e-9, `BW 關：理想邊緣（${rise()}）`);
  run(m, 'CH1 O2'); m.tick();
  near(rise(), 2.197 / (2 * Math.PI * 20e6), 1.5e-9, 'BW 開：10–90% 上升時間≈2.2τ');
});

test('Single：先關輸出並按 Single 等待，再開輸出 → 擷取到電容從 0 V 充電的曲線（τ≈10.5 ms）', () => {
  // 正弦幅度極小、DC 偏移 1 V：等於在 A 點加一個 1 V 的階躍
  const { m, afg, change } = benchWith({ wave: 'SINE', emfVpp: 0.002, emfOffset: 1, R: 1000, C: 10e-6, output: false }); // 電容沒充電
  Object.assign(m.ch[1], { on: true, vIdx: VDIV.indexOf(0.02), pos: 0 }); // CH2（B 點，10×）：顯示 200 mV/div
  m.sIdx = SDIV.indexOf(5e-3); m.mpos = 0;
  m.trig = { ...m.trig, src: 1, slope: 'R', mode: 'NORMAL', level: 0.05 }; // 位準＝探棒尖端 0.5 V
  run(m, 'SINGLE');
  assert.equal(m.trigStatus(), 'Ready');
  change(() => { afg.ch[0].output = true; }, 1); // 階躍
  assert.equal(m.trigStatus(), 'Acq. Complete');
  const tau = 1050 * 10e-6 * (1 - 1050 / 3.34e6); // 含儀器負載，約 10.5 ms
  near(recAt(m, 1, 0), 0.5, 0.02, '觸發點＝位準 0.5 V');
  near(recAt(m, 1, tau), 1 - 0.5 * Math.exp(-1), 0.03, '觸發後 τ：1−0.5e^−1');
  near(recAt(m, 1, -Math.log(2) * tau - 3e-3), 0, 0.01, '改變之前：0 V（輸出關）');
});

test('慢時基（Scan）看得到大 RC 的充電曲線：紀錄前段低、後段高，不是整條平移', () => {
  const { m, afg, change } = benchWith({ wave: 'SINE', emfVpp: 0.002, emfOffset: 1, R: 100e3, C: 10e-6, output: false }); // 電容沒充電
  Object.assign(m.ch[1], { on: true, vIdx: VDIV.indexOf(0.02), pos: 0 });
  m.sIdx = SDIV.indexOf(0.25); m.mpos = 0; // 250 ms/div、Auto → Scan
  change(() => { afg.ch[0].output = true; }, 1);
  change(() => {}, 1.5); // 1.5 秒後看
  const r = m.rec.v[1].map((y) => y * 10);
  assert.ok(m.isScan());
  assert.ok(r[0] < 0.05 && r[2499] > 0.7 && r[1800] > r[1200] && r[1200] > r[600], `前段 ${r[0].toFixed(3)}、後段 ${r[2499].toFixed(3)}`);
});

test('Single：電容帶著殘留電壓再開輸出 → 擷取的曲線從殘留電壓連續開始（不是從 0 V）', () => {
  const { m, bench, afg, change, clock } = benchWith({ wave: 'SINE', emfVpp: 0.002, emfOffset: 1, R: 1000, C: 10e-6 });
  change(() => {}, 1); // 充到約 1 V
  change(() => { afg.ch[0].output = false; }, 0); // 關輸出：電容經探棒 10 MΩ 慢慢放電（τ≈50 s）
  clock.t += 5;
  const residual = bench.vcAt(clock.t);
  assert.ok(residual > 0.85 && residual < 0.95, `殘留約 0.9 V（${residual}）`);
  Object.assign(m.ch[1], { on: true, vIdx: VDIV.indexOf(0.05), pos: -2 }); // CH2：500 mV/div
  m.sIdx = SDIV.indexOf(5e-3); m.mpos = 0;
  m.trig = { ...m.trig, src: 1, slope: 'R', mode: 'NORMAL', level: 0.15 }; // 位準＝尖端 1.5 V
  afg.ch[0].emfOffset = 2;
  run(m, 'SINGLE');
  const t0 = clock.t;
  change(() => { afg.ch[0].output = true; }, 0); // 開輸出：往 2 V 充電
  assert.equal(m.trigStatus(), 'Acq. Complete');
  const final = diffStatsB(bench), tau = bench.solution().tau;
  const tTrig = tau * Math.log((final - residual) / (final - 1.5)); // 從殘留電壓充到 1.5 V 的時間
  near(recAt(m, 1, -tTrig - 1e-3), residual, 0.01, '改變前 1 ms：殘留電壓');
  near(recAt(m, 1, -tTrig + 1e-4), residual + (final - residual) * (1 - Math.exp(-1e-4 / tau)), 0.01, '改變後 0.1 ms：從殘留電壓連續上升');
  near(recAt(m, 1, 0), 1.5, 0.02, '觸發點＝位準');
  near(recAt(m, 1, tau), final - (final - 1.5) * Math.exp(-1), 0.02, '觸發後 τ');
  near(m.rec.abs0, t0 + tTrig, 1e-4, '觸發時刻＝改變後 τ·ln((終值−殘留)/(終值−位準))');
});

test('Normal：直流階躍只穿越一次 → 擷取暫態並保留；週期訊號還會觸發時被新採集蓋掉', () => {
  const { m, afg, change } = benchWith({ wave: 'SINE', emfVpp: 0.002, emfOffset: 1, R: 1000, C: 10e-6, output: false });
  Object.assign(m.ch[1], { on: true, vIdx: VDIV.indexOf(0.02), pos: 0 });
  m.sIdx = SDIV.indexOf(5e-3); m.mpos = 0;
  m.trig = { ...m.trig, src: 1, slope: 'R', mode: 'NORMAL', level: 0.05 };
  m.tick();
  change(() => { afg.ch[0].output = true; }, 1);
  const n = m.acqN;
  assert.equal(m.run, 'run');
  near(recAt(m, 1, 0), 0.5, 0.02, '擷取到穿越 0.5 V 的那一刻');
  assert.ok(recAt(m, 1, -5e-3) < 0.2, '觸發前還在充電的低處');
  change(() => {}, 1); // 之後是 1 V 直流，不再觸發：保留
  assert.equal(m.acqN, n);
  near(recAt(m, 1, 0), 0.5, 0.02, '沒有新觸發：畫面保留暫態那一筆');
  // 換成會一直觸發的方波：下一筆就被週期穩態蓋掉
  change(() => { Object.assign(afg.ch[0], { wave: 'SQUARE', emfVpp: 10, emfOffset: 0, freq: 100 }); }, 1); // B 點約 ±2.2 V，每週期都穿越 0.5 V
  change(() => {}, 1);
  assert.ok(m.acqN > n + 1);
});
