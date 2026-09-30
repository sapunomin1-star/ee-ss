// 實驗台電路計算：用教科書公式核對正弦穩態、方波時間常數、直流偏移與常見接錯線的後果。
import test from 'node:test';
import assert from 'node:assert/strict';
import { solve, stats, M } from '../src/bench/circuit.js';

const sine = (emfVpp, freq = 1000, emfOffset = 0) => ({ wave: 'SINE', freq, sym: 50, emfVpp, emfOffset, output: true });
const off = { wave: 'SINE', freq: 1000, sym: 50, emfVpp: 2, emfOffset: 0, output: false };
const std = { 'AFG.CH1+': 'A', 'AFG.CH1-': 'G' };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
// 複數小工具
const cx = (re, im = 0) => ({ re, im });
const add = (a, b) => cx(a.re + b.re, a.im + b.im);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const mag = (a) => Math.hypot(a.re, a.im);
const ang = (a) => (Math.atan2(a.im, a.re) * 180) / Math.PI;
// 兩個週期表之間的相位差（度，b 落後 a 為負）：用一次諧波
function phase(a, b) {
  const h = (arr) => { let re = 0, im = 0; arr.forEach((x, k) => { re += x * Math.cos((2 * Math.PI * k) / M); im -= x * Math.sin((2 * Math.PI * k) / M); }); return Math.atan2(im, re); };
  let d = ((h(b) - h(a)) * 180) / Math.PI;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

test('RC 低通正弦穩態：振幅與相位符合 1/(1+jω(R+50)C)', () => {
  const R = 1000, C = 0.1e-6, f = 1000, w = 2 * Math.PI * f;
  const sol = solve({ topo: 'RC', R, C, wires: std }, [sine(2, f), off]);
  const Zc = cx(0, -1 / (w * C));
  const vA = div(add(cx(R), Zc), add(cx(R + 50), Zc)); // 端子電壓／EMF
  const vB = div(Zc, add(cx(R + 50), Zc));
  near(stats(sol.v.A).pp, 2 * mag(vA), 2e-3, 'A 點 pk-pk');
  near(stats(sol.v.B).pp, 2 * mag(vB), 2e-3, 'B 點（電容）pk-pk');
  near(phase(sol.v.A, sol.v.B), ang(vB) - ang(vA), 0.2, '電容電壓落後輸入的角度');
  near(stats(sol.v.B).acRms, (2 * mag(vB)) / (2 * Math.SQRT2), 1e-3, '電容交流有效值');
  assert.equal(sol.warn.filter((x) => x.level === 'bad').length, 0);
});

test('CR 高通：B 點是電阻電壓，振幅符合 R/(R+50+Zc)', () => {
  const R = 1000, C = 0.1e-6, f = 1000, w = 2 * Math.PI * f;
  const sol = solve({ topo: 'CR', R, C, wires: std }, [sine(2, f), off]);
  const vB = div(cx(R), add(cx(R + 50), cx(0, -1 / (w * C))));
  near(stats(sol.v.B).pp, 2 * mag(vB), 2e-3, 'B 點（電阻）pk-pk');
});

test('方波充放電：上升緣後一個 τ 到 63.2%', () => {
  const R = 1000, C = 1e-6, f = 50, tau = (R + 50) * C;
  const sol = solve({ topo: 'RC', R, C, wires: std }, [{ wave: 'SQUARE', freq: f, sym: 50, emfVpp: 2, emfOffset: 0, output: true }, off]);
  near(sol.tau, tau, 1e-9, '時間常數 (R+50)·C');
  const k = Math.round((tau * f) * M); // 上升緣在 t＝0
  const vb = sol.v.B, lo = vb[0], hi = vb[Math.round(M / 2) - 1];
  near((vb[k] - lo) / (hi - lo), 1 - Math.exp(-1), 0.01, 'Vc(τ) 比例');
});

test('低頻方波：跳變當下電容電壓連續，邊緣後才指數充放電', () => {
  const R = 1000, C = 0.1e-6, f = 1, tau = (R + 50) * C, h = 1 / (f * M);
  const sol = solve({ topo: 'RC', R, C, wires: std }, [{ ...sine(2, f), wave: 'SQUARE' }, off]);
  // 半週期遠大於 τ，邊緣前已充飽到 ±1 V；邊緣後遵守解析階躍響應。
  near(sol.v.B[0], -1, 1e-7, '上升緣當下');
  near(sol.v.B[1], 1 - 2 * Math.exp(-h / tau), 1e-7, '上升緣後一格');
  near(sol.v.B[M / 2], 1, 1e-7, '下降緣當下');
  near(sol.v.B[M / 2 + 1], -1 + 2 * Math.exp(-h / tau), 1e-7, '下降緣後一格');
});

test('大時間常數配高頻：週期穩態平均值保持輸入 Offset', () => {
  const R = 100000, C = 10e-6;
  for (const [wave, freq] of [['SINE', 999000], ['SQUARE', 500000], ['RAMP', 999000]]) {
    for (const emfOffset of [0, 1]) {
      const source = { ...sine(2, freq, emfOffset), wave, sym: 30 };
      const sol = solve({ topo: 'RC', R, C, wires: std }, [source, off]);
      // 積分一階方程一個週期：<dVc/dt>＝0，所以 <Vc>＝輸入平均值。
      near(stats(sol.v.B).mean, emfOffset, 2e-6, `${wave} ${freq} Hz，Offset ${emfOffset} V`);
      assert.ok(stats(sol.v.B).pp > 0, `${wave} 仍保留週期漣波`);
    }
  }
});

test('直流偏移：電容上的平均＝偏移量，電阻上的平均＝0', () => {
  const sol = solve({ topo: 'RC', R: 1000, C: 0.1e-6, wires: std }, [sine(2, 1000, 1), off]);
  near(stats(sol.v.B).mean, 1, 1e-3, '電容平均');
  near(stats(sol.v.A).mean - stats(sol.v.B).mean, 0, 1e-3, '電阻兩端平均差');
});

test('接錯線：示波器接地夾夾在 B → 電容被短路、B＝0 V，並警告', () => {
  const sol = solve({ topo: 'RC', R: 1000, C: 0.1e-6, wires: { ...std, 'TDS.CH2.TIP': 'B', 'TDS.CH2.GND': 'B' } }, [sine(2), off]);
  assert.ok(stats(sol.v.B).pp < 1e-6, 'B 點被接地');
  assert.ok(sol.warn.some((x) => x.level === 'bad' && x.text.includes('接地夾')), '有接地夾警告');
  assert.ok(sol.warn.some((x) => x.text.includes('電容') && x.text.includes('短路')), '有電容短路警告');
});

test('沒有接回地：只接紅夾 → 警告、電容兩端電壓幾乎為 0', () => {
  const sol = solve({ topo: 'RC', R: 1000, C: 0.1e-6, wires: { 'AFG.CH1+': 'A' } }, [sine(2), off]);
  assert.ok(sol.warn.some((x) => x.text.includes('沒有接回地')));
  const vc = Float64Array.from(sol.v.B, (x, k) => x - sol.v.G[k]);
  assert.ok(stats(vc).pp < 1e-3, `電容兩端 ${stats(vc).pp}`);
});

test('AFG 輸出 OFF：沒有訊號並提示', () => {
  const sol = solve({ topo: 'RC', R: 1000, C: 0.1e-6, wires: std }, [off, off]);
  assert.equal(sol.dc, true);
  assert.ok(sol.warn.some((x) => x.text.includes('OFF')));
});

test('紅夾接在接地點：輸出被短路', () => {
  const sol = solve({ topo: 'RC', R: 1000, C: 0.1e-6, wires: { 'AFG.CH1+': 'G', 'AFG.CH1-': 'G' } }, [sine(2), off]);
  assert.ok(sol.warn.some((x) => x.text.includes('短路到地')));
});

// ---- 2026-09-30 審查修正：窄脈衝、儀器負載、電容暫態、電阻量測 ----
import { diffStats, diffMeanOver, nodeAt, ohms } from '../src/bench/circuit.js';
import { Bench, DEMO } from '../src/bench/bench.js';
import { DmmModel, APERTURE as APERTURE_S } from '../src/instruments/dmm/model.js';

test('窄脈衝（τ 比取樣間隔短）：有效值照區間解析式積分，等於解析值；區間內照指數衰減取值', () => {
  // CR 高通 100 Ω／1 nF、1 kHz 方波：τ＝150 ns，取樣間隔 250 ns
  const sol = solve({ topo: 'CR', R: 100, C: 1e-9, wires: std }, [{ ...sine(2, 1000), wave: 'SQUARE' }, off]);
  const V0 = (2 * 100) / 150, tau = 150e-9;
  near(diffStats(sol, 'B', 'G').acRms, Math.sqrt((2 * V0 * V0 * tau) / 2 / 1e-3), 1e-7, '有效值');
  near(nodeAt(sol, 'B', 0.5e-3 + tau), -V0 * Math.exp(-1), 1e-6, '下降緣後 τ');
  near(nodeAt(sol, 'B', 5.5e-3 + 2 * tau), -V0 * Math.exp(-2), 1e-6, '第 6 個週期、下降緣後 2τ');
  // 正弦時與取樣表統計一致
  const s2 = solve({ topo: 'RC', R: 1000, C: 0.1e-6, wires: std }, [sine(2, 1000, 1), off]);
  const d = diffStats(s2, 'B', 'G'), t = stats(s2.v.B);
  near(d.mean, t.mean, 1e-9, '平均'); near(d.acRms, t.acRms, 1e-9, '有效值');
});

test('儀器負載：電表 ACV 1 MΩ 跨在 C 上，R 100 kΩ 時電壓照並聯後的阻抗下降', () => {
  const R = 100e3, C = 1e-9, f = 100, w = 2 * Math.PI * f;
  const loaded = solve({ topo: 'RC', R, C, wires: std, loads: [{ a: 'B', b: 'G', r: 1e6 }] }, [sine(2, f), off]);
  const Zp = div(cx(1e6), add(cx(1), cx(0, w * C * 1e6))); // 1 MΩ ∥ C
  const want = (2 * mag(div(Zp, add(cx(R + 50), Zp)))) / (2 * Math.SQRT2);
  near(stats(loaded.v.B).acRms, want, 1e-4, '含負載有效值');
  const bare = solve({ topo: 'RC', R, C, wires: std }, [sine(2, f), off]);
  assert.ok(stats(bare.v.B).acRms / want > 1.09, '不計負載時高估約 10%');
});

test('電容暫態：關 OUTPUT 後電容保有電荷，經儀器輸入電阻以 τ 放電；改偏移後 DC 以 τ 趨近新值', () => {
  let t = 100;
  const afg = { on: true, ch: [{ wave: 'SINE', freq: 1000, sym: 50, emfVpp: 2, emfOffset: 1, output: true }, { ...off }] };
  const dmm = new DmmModel();
  const b = new Bench(afg, dmm);
  b.now = () => t;
  Object.entries(DEMO).forEach(([l, n]) => b.connect(l, n));
  dmm.setBenchSource(() => b.dmmInput()); dmm.setFixture('bench');
  b.solution(); // 剛接好線：電容從 0 V 以 τ≈105 µs 充電
  assert.ok(Math.abs(b.dev(t)) > 0.1, '接線當下電容還沒充電');
  t += 0.01;
  near(b.dmmInput().v.dc, 1 * (10e6 / 3) / (10e6 / 3 + 1050), 1e-3, '10 ms 後電容平均 ≈ 1 V（含儀器負載分壓）');
  t += 1;
  const vcBefore = b.vcAt(t);
  afg.ch[0].output = false; b.solution(); // 關輸出
  const tau = b.solution().tau, d0 = b.dev(t);
  near(d0, vcBefore, 1e-9, '關輸出那一刻電容電壓不變（新穩態＝0）');
  near(tau / (0.1e-6 / (1 / 10e6 + 1 / 10e6 + 1 / (10e6 + 1000))), 1, 1e-4, '放電 τ＝C×(電表 10 MΩ ∥ CH2 10 MΩ ∥ R＋CH1 10 MΩ)');
  assert.ok(d0 > 0.1 && d0 < 1.9, `關輸出瞬間電容保有 1 V±漣波（${d0}）`);
  t += tau; near(b.dev(t), d0 * Math.exp(-1), 1e-9, '經過 τ 剩 e^-1');
  near(b.dmmInput().v.dc, d0 * Math.exp(-1), 1e-6, '電表讀到慢慢下降的電壓');
  t += 20 * tau; assert.ok(!b.transientActive(t), '10τ 以上就視為放完');
  // 大 RC：改 DC 偏移後電容以 τ 趨近
  afg.ch[0].output = true; afg.ch[0].emfOffset = 0; b.R = 100e3; b.C = 10e-6; t += 1; b.solution();
  const tau2 = b.solution().tau;
  t += 100 * tau2; afg.ch[0].emfOffset = 1; b.solution(); const t0 = t;
  t = t0 + tau2;
  near(b.vcAt(t), b.solution().capSS(t)[0] + b.dev(t), 1e-12, '電容電壓＝該時刻的週期穩態值＋暫態偏移');
  const target = b.solution().stats(b.node('B'), b.node('G')).mean;
  near(b.dmmInput().v.dc, target * (1 - Math.exp(-1)), 1e-3, 'DC 偏移改 1 V 後 τ 時刻約到 63%');
});

test('Ω：示波器探棒 10 MΩ 對大地也會並聯進量測（1 kΩ ∥ 20 MΩ）；探棒拔掉就是 R', () => {
  const wires = { ...DEMO, 'DMM.HI': 'A', 'DMM.LO': 'B' };
  const withProbes = ohms({ topo: 'RC', R: 1000, wires, loads: [{ a: 'A', b: 'E', r: 10e6 }, { a: 'B', b: 'E', r: 10e6 }] }, 'A', 'B');
  near(withProbes, (1000 * 20e6) / (20e6 + 1000), 1e-6, '含探棒');
  near(ohms({ topo: 'RC', R: 1000, wires: { 'DMM.HI': 'A', 'DMM.LO': 'B' } }, 'A', 'B'), 1000, 1e-6, '只有 R');
  assert.equal(ohms({ topo: 'RC', R: 1000, wires: { 'DMM.HI': 'B', 'DMM.LO': 'G' } }, 'B', 'G'), Infinity, '跨在 C 上：開路');
});

test('電表 DCV 是 10 PLC 積分窗的平均：0.1 Hz 正弦的讀值跟著波形走，1 kHz 幾乎不動', () => {
  let t = 1000.05;
  const afg = { on: true, ch: [{ wave: 'SINE', freq: 0.1, sym: 50, emfVpp: 2, emfOffset: 0, output: true }, { ...off }] };
  const dmm = new DmmModel(), b = new Bench(afg, dmm);
  b.now = () => t;
  Object.entries(DEMO).forEach(([l, n]) => b.connect(l, n));
  dmm.setBenchSource(() => b.dmmInput()); dmm.setFixture('bench');
  const read = () => dmm.view().value;
  const vals = [0, 2.5, 5, 7.5].map((dt) => { t = 1000.05 + dt; return read(); });
  assert.ok(vals[1] > 0.9 && vals[3] < -0.9 && Math.abs(vals[0]) < 0.1 && Math.abs(vals[2]) < 0.1, `讀值隨正弦起伏：${vals.map((x) => x.toFixed(3))}`);
  const s = b.solution(), T = APERTURE_S;
  near(read(), s.meanOver(b.node('B'), b.node('G'), Math.floor(t / T) * T - T, Math.floor(t / T) * T), 1e-12, '讀值＝最近一次積分窗平均');
  const before = read();
  afg.ch[0].freq = 1000; b.solution(); t += 0.01;
  near(read(), before, 1e-9, '改頻率後 10 ms：畫面仍是上一筆（積分窗在改之前）');
  t += 0.5;
  assert.ok(Math.abs(read()) < 5e-3, `下一筆以後：1 kHz 的積分窗平均接近 0（${read()}）`);
});

// ---- 2026-09-30 修正後複核：長時間常數的積分、已完成讀值不被改 ----
test('長時間常數：RMS 與平均用不會大數相消的寫法，全部 R／C 在 1 kHz、100 kHz 都等於相量解析值', () => {
  const loads = [{ a: 'A', b: 'E', r: 10e6 }, { a: 'B', b: 'E', r: 10e6 }, { a: 'B', b: 'G', r: 1e6 }];
  const RL = 1 / (1 / 1e6 + 1 / 10e6), par = (a, b) => div(cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re), add(a, b));
  for (const R of [100, 1000, 100e3]) for (const C of [1e-9, 0.1e-6, 10e-6]) for (const f of [1000, 1e5]) {
    const w = 2 * Math.PI * f, Zc = cx(0, -1 / (w * C));
    const sol = solve({ topo: 'RC', R, C, wires: DEMO, loads }, [sine(20, f), off]); // Load 50 Ω 顯示 10 Vpp＝EMF 20 Vpp
    const zB = par(cx(RL), Zc), zBR = add(zB, cx(R)), zA = par(cx(10e6), zBR);
    const vA = 10 * mag(div(zA, add(zA, cx(50)))), want = (vA * mag(div(zB, zBR))) / Math.SQRT2;
    const got = diffStats(sol, 'B', 'G').acRms;
    assert.ok(Math.abs(got / want - 1) < 1e-6, `R ${R} C ${C} f ${f}：${got} vs ${want}`);
    assert.ok(Math.abs(diffStats(sol, 'B', 'G').mean) < 1e-9, '沒有偏移時平均＝0');
  }
});

test('同一個積分窗內連改兩次設定：已完成的 DCV 讀值不變（照當時的電路算）', () => {
  let t = 500;
  const afg = { on: true, ch: [{ wave: 'SINE', freq: 1000, sym: 50, emfVpp: 2, emfOffset: 1, output: true }, { ...off }] };
  const dmm = new DmmModel(), b = new Bench(afg, dmm);
  b.now = () => t;
  Object.entries(DEMO).forEach(([l, n]) => b.connect(l, n));
  dmm.setBenchSource(() => b.dmmInput()); dmm.setFixture('bench'); b.solution();
  t += 5;
  const done = dmm.view().value, tr = Math.floor(t / APERTURE_S) * APERTURE_S;
  t = tr + 0.02; afg.ch[0].emfOffset = 3; b.solution();
  t = tr + 0.04; afg.ch[0].emfOffset = 5; b.solution();
  t = tr + 0.05;
  near(dmm.view().value, done, 1e-12, '已完成的讀值');
  t = tr + APERTURE_S + 0.01; // 下一筆：窗內前 20 ms 是 1 V、再 20 ms 是 3 V、其餘是 5 V（電容 τ≈0.1 ms，幾乎立刻跟上）
  near(dmm.view().value, (1 * 0.02 + 3 * 0.02 + 5 * (APERTURE_S - 0.04)) / APERTURE_S, 0.01, '跨兩次改變的窗照各段平均');
});

test('週期邊界與負時間：t＝nT、前後極小偏移、負的預觸發時間都得到有限且連續的值', () => {
  const sol = solve({ topo: 'RC', R: 1000, C: 0.1e-6, wires: DEMO }, [sine(2, 1000, 0.5), off]);
  const T = sol.period;
  for (const n of [0, 1, 7, 12345, 1e6, -1, -3, -12345]) {
    const t = n * T;
    for (const e of [0, 1e-15, -1e-15, T * 1e-9, -T * 1e-9]) {
      for (const node of ['A', 'B']) assert.ok(Number.isFinite(nodeAt(sol, node, t + e)), `nodeAt ${node} n=${n} ε=${e}`);
      assert.ok(Number.isFinite(sol.vcAt(t + e)), `vcAt n=${n} ε=${e}`);
    }
    // 電容電壓連續：邊界兩側差 < 1 µV；正弦源 A 點也連續
    near(sol.vcAt(t - T * 1e-9), sol.vcAt(t + T * 1e-9), 1e-6, `vc 在 n=${n} 連續`);
    near(nodeAt(sol, 'B', t - T * 1e-9), nodeAt(sol, 'B', t + T * 1e-9), 1e-6, `B 在 n=${n} 連續`);
    // 週期性：t 與 t＋T 同值（含負時間）
    near(nodeAt(sol, 'B', t + 0.3 * T), nodeAt(sol, 'B', t + 1.3 * T), 1e-9, `週期性 n=${n}`);
    const m = diffMeanOver(sol, 'B', 'G', t - 0.5 * T, t + 0.5 * T);
    near(m, 0.5 * (1e7 / (1e7 + 1050)) || 0.5, 1e-3, `跨邊界整週期平均 n=${n}`);
  }
  // Bench 的絕對時間取值（示波器預觸發可能落在第一段之前、甚至負時間）
  let t = 0.0123;
  const afg = { on: true, ch: [{ wave: 'SINE', freq: 1000, sym: 50, emfVpp: 2, emfOffset: 0.5, output: true }, { ...off }] };
  const b = new Bench(afg);
  b.now = () => t;
  Object.entries(DEMO).forEach(([l, n]) => b.connect(l, n));
  const abs = b.tdsInput().sig[1].abs;
  for (const x of [-1, -0.001, 0, 0.001, t, 5]) assert.ok(Number.isFinite(abs(x)), `abs(${x})`);
});

// ---- 麵包板＋GPE（用固定的 netlist 代替麵包板模型；麵包板本身的測試在 breadboard.test.mjs）----
import { GpeModel } from '../src/instruments/gpe/model.js';
import { Breadboard, BB_DEMO } from '../src/bench/breadboard.js';
function fakeBoard(elements, leads) {
  const nodes = [...new Set([...elements.flatMap((e) => [e.a, e.b]), ...Object.values(leads)])];
  return { key: () => JSON.stringify([elements, leads]), netlist: (w) => ({ nodes, groupOf: (h) => h, elements, leads: Object.fromEntries(Object.keys(w).map((id) => [id, leads[id]])), warnings: [] }) };
}
function gpeBench(elements, leads, { v = 5, i = 0.1 } = {}) {
  let t = 10;
  const afg = { on: true, ch: [{ ...off }, { ...off }] };
  const dmm = new DmmModel(), gpe = new GpeModel();
  gpe.now = () => t * 1000; gpe.reset(); t += 2;
  gpe.vset[1] = v * 100; gpe.iset[1] = i * 1000;
  const b = new Bench(afg, dmm, gpe);
  b.now = () => t;
  b.board = 'bb'; b.bb = fakeBoard(elements, leads); b.bbWires = Object.fromEntries(Object.keys(leads).map((id) => [id, id]));
  dmm.setBenchSource(() => b.dmmInput()); dmm.setFixture('bench');
  gpe.setBenchSource(() => b.gpeInput()); gpe.setLoad('bench');
  return { b, dmm, gpe, tick: (dt) => { t += dt; } };
}

test('麵包板＋GPE：CH1 5 V 接兩顆 1 kΩ 分壓，電表讀中點 2.5 V，GPE 讀回 5.00 V／0.003 A CV', () => {
  const { b, dmm, gpe, tick } = gpeBench([{ id: 'R1', kind: 'R', a: 'P', b: 'M', value: 1000 }, { id: 'R2', kind: 'R', a: 'M', b: 'N', value: 1000 }],
    { 'GPE.CH1+': 'P', 'GPE.CH1-': 'N', 'DMM.HI': 'M', 'DMM.LO': 'N' });
  gpe.press('GPE.KEY.OUTPUT_ON_OFF');
  b.solution(); tick(1);
  const Rp = (1000 * 10e6) / (1000 + 10e6); // R2 ∥ 電表 DCV 10 MΩ
  near(dmm.view().value, (5 * Rp) / (1000 + Rp), 1e-4, '中點約 2.5 V（電表 10 MΩ 負載只差 1e-4）');
  const rb = gpe.readback()[1];
  near(rb.v, 5, 1e-3, 'GPE 端電壓'); near(rb.i, 0.0025, 1e-5, 'GPE 電流'); assert.equal(rb.cc, false);
  assert.deepEqual(gpe.rowView(1).mode, 'CV');
});

test('麵包板＋GPE：10 Ω 負載超過 0.1 A 限流 → CC，端電壓 1 V；短路 → CC、0 V 並提示', () => {
  const { b, gpe } = gpeBench([{ id: 'R1', kind: 'R', a: 'P', b: 'N', value: 10 }], { 'GPE.CH1+': 'P', 'GPE.CH1-': 'N' });
  gpe.press('GPE.KEY.OUTPUT_ON_OFF'); b.solution();
  const rb = gpe.readback()[1];
  assert.equal(rb.cc, true); near(rb.v, 1, 1e-6, 'CC 端電壓'); near(rb.i, 0.1, 1e-9, 'CC 電流');
  // 真的麵包板：＋、−插在同一欄（a5、b5 相連）＝短路
  const s = gpeBench([], {});
  s.b.bb = new Breadboard(); s.b.bbWires = { 'GPE.CH1+': 'a5', 'GPE.CH1-': 'b5' };
  s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution();
  assert.ok(s.b.snapshot().warn.some((w) => w.includes('短路')), '麵包板模型的短路提醒');
  assert.equal(s.gpe.readback()[1].cc, true); near(s.gpe.readback()[1].v, 0, 1e-9, '短路 0 V');
});

test('麵包板＋GPE：開 Output 後經 10 kΩ 對 10 µF 充電（τ≈0.1 s），電表看得到慢慢上升；兩顆電容的網路也能算', () => {
  const { b, dmm, gpe, tick } = gpeBench([{ id: 'R1', kind: 'R', a: 'P', b: 'M', value: 10e3 }, { id: 'C1', kind: 'C', a: 'M', b: 'N', value: 10e-6 },
    { id: 'R2', kind: 'R', a: 'M', b: 'X', value: 10e3 }, { id: 'C2', kind: 'C', a: 'X', b: 'N', value: 1e-6 }], { 'GPE.CH1+': 'P', 'GPE.CH1-': 'N', 'DMM.HI': 'M', 'DMM.LO': 'N' });
  b.solution(); tick(1);
  gpe.press('GPE.KEY.OUTPUT_ON_OFF'); b.solution();
  assert.equal(b.solution().lam.length, 2, '兩個模態');
  tick(0.05); const v1 = dmm.view().value;
  tick(0.3); const v2 = dmm.view().value;
  tick(3); const v3 = dmm.view().value;
  assert.ok(v1 < v2 && v2 < v3 && Math.abs(v3 - 5 * (10e6 / (10e6 + 10e3))) < 0.01, `充電：${v1} → ${v2} → ${v3}`);
});

test('麵包板示範「RC 低通」和固定 RC 板是同一個電路：電表 ACV、各點波形都相同', () => {
  let t = 50;
  const mk = (board) => {
    const afg = { on: true, ch: [{ wave: 'SINE', freq: 1000, sym: 50, emfVpp: 2, emfOffset: 0, output: true }, { ...off }] };
    const dmm = new DmmModel(), b = new Bench(afg, dmm);
    b.now = () => t;
    if (board === 'bb') { b.board = 'bb'; b.bb = new Breadboard(); b.bbWires = {}; b.bb.load(BB_DEMO.rc, b.bbWires); } else Object.entries(DEMO).forEach(([l, n]) => b.connect(l, n));
    dmm.setBenchSource(() => b.dmmInput()); dmm.setFixture('bench'); dmm.press('DMM.KEY.ACV');
    return { b, dmm };
  };
  const rc = mk('rc'), bb = mk('bb');
  rc.b.solution(); bb.b.solution(); t += 1;
  near(bb.dmm.view().value, rc.dmm.view().value, 1e-12, '電表 ACV');
  for (const i of [0, 1]) {
    const x = rc.b.tdsInput().sig[i].table, y = bb.b.tdsInput().sig[i].table;
    for (let k = 0; k < x.length; k += 131) near(y[k], x[k], 1e-12, `示波器 CH${i + 1} 取樣 ${k}`);
  }
  assert.deepEqual(bb.b.snapshot().warn, []);
});

test('麵包板示範「GPE 分壓」：GPE 5 V 開輸出，電表 DCV 讀 R2 約 2.5 V、GPE 讀回 CV 2.5 mA', () => {
  const { b, dmm, gpe, tick } = gpeBench([], {});
  b.bb = new Breadboard(); b.bbWires = {}; b.bb.load(BB_DEMO.gpe, b.bbWires);
  gpe.press('GPE.KEY.OUTPUT_ON_OFF'); b.solution(); tick(1);
  const Rp = (1000 * 10e6) / (1000 + 10e6);
  near(dmm.view().value, (5 * Rp) / (1000 + Rp), 1e-4, 'R2 兩端');
  const rb = gpe.readback()[1];
  near(rb.i, 5 / (1000 + Rp), 1e-6, 'GPE 電流'); assert.equal(rb.cc, false);
  near(gpe.readback()[2].i, 0, 0, '沒接的 CH2＝開路');
});

// ---- 2026-09-30 麵包板複核（7c5ccf4）：電荷守恆、限流充電、電源灌入、獨立迴路量電阻、接地短路、Series ----
function bbSetup(parts, wires) {
  let t = 10;
  const afg = { on: true, ch: [{ ...off }, { ...off }] }, dmm = new DmmModel(), gpe = new GpeModel();
  gpe.now = () => t * 1000; gpe.reset(); t += 2;
  const b = new Bench(afg, dmm, gpe);
  b.now = () => t;
  b.board = 'bb'; b.bb = new Breadboard(); b.bbWires = {};
  for (const [k, x, y, v] of parts) b.bb.add(k, x, y, v, b.bbWires);
  for (const [l, h] of Object.entries(wires)) b.bb.plug(b.bbWires, l, h);
  dmm.setBenchSource(() => b.dmmInput()); dmm.setFixture('bench');
  gpe.setBenchSource(() => b.gpeInput()); gpe.setLoad('bench');
  return { b, dmm, gpe, afg, adv: (dt) => { t += dt; }, now: () => t };
}

test('電容並聯瞬間電荷守恆：5 V 的 1 µF 並上沒充電的 10 µF → 約 0.455 V', () => {
  const s = bbSetup([['R', 'a5', 'a10', 100], ['C', 'b10', 'b20', 1e-6]], { 'GPE.CH1+': 'c5', 'GPE.CH1-': 'c20' });
  s.gpe.vset[1] = 500; s.gpe.iset[1] = 1000; s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution(); s.adv(1);
  s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution(); s.adv(1e-3);
  const v1 = s.b.vcAt(s.now());
  s.b.bb.add('C', 'e10', 'e20', 10e-6, s.b.bbWires); s.b.solution(); s.adv(1e-6);
  const caps = capsOf(s.b);
  near(caps.C1, v1 / 11, 1e-6, 'C1＝(1 µF×V)/(11 µF)');
  near(caps.C2, caps.C1, 1e-9, '並聯兩顆電壓相同');
});
const capsOf = (b) => { const t = b.now(), g = b.segAt(t); return Object.fromEntries(g.sol.caps.map((id, k) => [id, g.sol.capSS(t)[k] + g.sol.lam.reduce((x, l, m) => x + g.sol.capD[k][m] * g.amp[m] * Math.exp(-l * Math.max(0, t - g.t0)), 0)])); };

test('GPE 限流充電：5 V／10 mA 經 100 Ω 對 10 µF，先 CC 線性充電（1 ms 後 1 V），4 ms 後轉 CV 指數趨近', () => {
  const s = bbSetup([['R', 'a5', 'a10', 100], ['C', 'b10', 'b20', 10e-6]], { 'GPE.CH1+': 'c5', 'GPE.CH1-': 'c20' });
  s.gpe.vset[1] = 500; s.gpe.iset[1] = 10; s.b.solution(); s.adv(1);
  s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution();
  const t0 = s.now();
  s.adv(1e-3);
  near(s.b.vcAt(s.now()), 1, 1e-4, '1 ms：10 mA×1 ms／10 µF＝1 V');
  let rb = s.gpe.readback()[1];
  assert.equal(rb.cc, true); near(rb.i, 0.01, 1e-9, 'CC 10 mA'); near(rb.v, 2, 1e-3, '端電壓＝1 V＋10 mA×100 Ω');
  const sw = s.b.segs.find((g) => g.from > t0 && g.modes[0] === 'CV');
  assert.ok(sw, '排好一次 CC→CV');
  near(sw.from - t0, 4e-3, 1e-5, '電容到 5−10 mA×100 Ω＝4 V 時（4 ms）轉 CV');
  s.adv(3e-3 + 1e-3); // t0＋5 ms
  rb = s.gpe.readback()[1];
  assert.equal(rb.cc, false);
  near(s.b.vcAt(s.now()), 5 - Math.exp(-1e-3 / (100 * 10e-6)), 2e-3, 'CV 後以 τ＝1 ms 趨近 5 V');
});

test('兩路不同電壓直接並接：低的那路被灌入（RB，0 A）並提醒，節點跟著高的那路', () => {
  const s = bbSetup([['R', 'a5', 'a10', 1000]], { 'GPE.CH1+': 'c5', 'GPE.CH1-': 'c10', 'GPE.CH2+': 'd5', 'GPE.CH2-': 'd10' });
  s.gpe.vset[1] = 500; s.gpe.vset[2] = 400; s.gpe.iset[1] = 1000; s.gpe.iset[2] = 1000;
  s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution();
  const r = s.gpe.readback();
  near(r[1].v, 5, 1e-3, 'CH1 端電壓'); near(r[1].i, 0.005, 1e-6, 'CH1 供 5 mA'); assert.equal(r[1].cc, false);
  near(r[2].i, 0, 0, 'CH2 不能吸收電流'); near(r[2].v, 5, 1e-3, 'CH2 端電壓被抬到 5 V');
  assert.ok(s.b.snapshot().warn.some((w) => w.includes('CH2') && w.includes('灌入')));
});

test('量電阻：另一個獨立迴路通電不影響；電表接的迴路通電才拒絕', () => {
  const s = bbSetup([['R', 'a5', 'a10', 1000], ['R', 'a20', 'a25', 470]], { 'GPE.CH1+': 'c5', 'GPE.CH1-': 'c10', 'DMM.HI': 'c20', 'DMM.LO': 'c25' });
  s.dmm.press('DMM.KEY.OHM_2W');
  s.gpe.vset[1] = 500; s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution();
  near(s.dmm.view().value, 470, 1e-6, '獨立迴路的 470 Ω');
  s.b.bb.plug(s.b.bbWires, 'DMM.HI', 'd5'); s.b.bb.plug(s.b.bbWires, 'DMM.LO', 'd10'); s.b.solution();
  assert.equal(s.dmm.view().state, 'none');
  assert.ok(s.b.dmmInput().whyR.includes('通電'));
});

test('兩個示波器接地夾夾在電容兩端：提醒電容被短路（接地夾都是大地）', () => {
  const s = bbSetup([['R', 'a5', 'a10', 1000], ['C', 'b10', 'b15', 1e-6]], { 'AFG.CH1+': 'c5', 'AFG.CH1-': 'c15', 'TDS.CH1.GND': 'd10', 'TDS.CH2.GND': 'd15' });
  s.afg.ch[0].output = true; s.b.solution();
  assert.ok(s.b.snapshot().warn.some((w) => w.includes('C1') && w.includes('短路') && w.includes('接地夾')));
});

test('GPE Series：CH2 電壓跟 CH1；自己把 CH1− 接到 CH2＋，CH1＋到 CH2− 之間是兩倍電壓', () => {
  const s = bbSetup([['R', 'a5', 'a15', 1000], ['W', 'b10', 'b11']], { 'GPE.CH1+': 'c5', 'GPE.CH1-': 'c10', 'GPE.CH2+': 'c11', 'GPE.CH2-': 'c15', 'DMM.HI': 'd5', 'DMM.LO': 'd15' });
  s.gpe.vset[1] = 500; s.gpe.vset[2] = 100; s.gpe.iset[1] = 1000; s.gpe.iset[2] = 1000;
  s.gpe.press('GPE.KEY.TRACK_RIGHT'); s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution(); s.adv(1);
  assert.equal(s.gpe.mode, 'SER');
  const Rl = (1000 * 10e6) / (1000 + 10e6);
  near(s.dmm.view().value, 10 * Rl / (Rl + 2 * 0.01), 1e-4, '兩路各 5 V 串聯＝10 V');
  const r = s.gpe.readback();
  near(r[1].v, 5, 1e-3, 'CH1'); near(r[2].v, 5, 1e-3, 'CH2 跟 CH1（不是自己的 1 V）');
});
