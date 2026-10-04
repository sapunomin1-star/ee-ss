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
test('固定 RC 板以 GPE 5 V 供電：100 nF 充電、電表積分與電源讀回符合解析式', () => {
  let t = 0;
  const afg = { on: true, ch: [{ ...off }, { ...off }] }, dmm = new DmmModel(), gpe = new GpeModel();
  const b = new Bench(afg, dmm, gpe); b.now = () => t;
  dmm.setBenchSource(() => b.dmmInput()); dmm.fixture = 'bench';
  gpe.setBenchSource(() => b.gpeInput()); gpe.load = 'bench';
  b.connect('GPE.CH1+', 'A'); b.connect('GPE.CH1-', 'G');
  b.connect('DMM.HI', 'B'); b.connect('DMM.LO', 'G'); b.solution();
  assert.equal(b.build().warn.some((x) => x.text.includes('還沒有接')), false, 'GPE 已接時不要求再接 AFG');
  gpe.vset[1] = 500; gpe.iset[1] = 100; gpe.output = true; b.solution();
  assert.equal(b.build().gpe.length, 1);
  const sourceR = 1000 + 0.01, meterR = 10e6;
  const target = 5 * meterR / (sourceR + meterR), tau = 100e-9 / (1 / sourceR + 1 / meterR);
  for (const time of [0, 100e-6, 1e-3, .5]) {
    t = time;
    const voltage = target * -Math.expm1(-time / tau), readback = gpe.readback()[1];
    near(b.dmmInput().v.dc, voltage, 1e-7, '電容電壓');
    near(readback.i, (5 - voltage) / sourceR, 1e-9, 'GPE 供給電阻與電表的電流');
    near(readback.v, 5 - readback.i * .01, 1e-10, 'CV 含 0.01 Ω 輸出內阻');
    assert.equal(readback.cc, false); assert.equal(readback.rb, false);
  }
  const reading = dmm.reading();
  assert.equal(reading.state, 'value'); near(reading.raw, target, 1e-7, '充飽後的電表 DCV 讀值');
});

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

const sharedSupplyWires = { 'GPE.CH1+': 'b5', 'GPE.CH1-': 'b10', 'GPE.GND': 'c10', 'TDS.CH1.TIP': 'c5' };

test('47 nF 直接跨 GPE 5 V／1 mA：100 µs 仍以 CC 充到 2.127 V，約 235 µs 後才轉 CV', () => {
  const s = bbSetup([['C', 'a5', 'a10', 47e-9]], sharedSupplyWires);
  s.gpe.vset[1] = 500; s.gpe.iset[1] = 1; s.b.solution();
  s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution();
  const t0 = s.now();
  near(s.b.vcAt(t0), 0, 1e-12, '開輸出當下保持未充電');
  assert.equal(s.b.gpeInput()[1].cc, true);
  s.adv(100e-6);
  near(s.b.vcAt(s.now()), 0.001 * 10e6 * -Math.expm1(-100e-6 / (10e6 * 47e-9)), 1e-8, '限流充電及探棒負載');
  const r = s.b.gpeInput()[1];
  assert.equal(r.cc, true); near(r.i, 0.001, 1e-12, '1 mA 限流');
  const sw = s.b.segs.find((g) => g.from > t0 && g.modes[0] === 'CV');
  assert.ok(sw);
  near(sw.from - t0, -10e6 * 47e-9 * Math.log1p(-(5 - 0.001 * 0.01) / (0.001 * 10e6)), 1e-8, 'CV 內阻 0.01 Ω 的電流等於 1 mA 時轉 CV');
  s.adv(150e-6);
  assert.equal(s.b.gpeInput()[1].cc, false);
  near(s.b.vcAt(s.now()), 5, 1e-7, '已轉 CV');
});

test('無儀器負載的 1 nF～10 µF 接 GPE 5／32 V、1 mA／1 A：初值為 0，CC 轉 CV 不超設定或誤判逆灌', () => {
  for (const voltage of [5, 32]) for (const current of [0.001, 1]) for (const capacitance of [1e-9, 47e-9, 1e-6, 10e-6]) {
    const s = bbSetup([['C', 'a5', 'a10', capacitance]], { 'GPE.CH1+': 'b5', 'GPE.CH1-': 'b10', 'GPE.GND': 'c10' });
    s.gpe.vset[1] = voltage * 100; s.gpe.iset[1] = current * 1000; s.b.solution(); s.adv(1);
    s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution();
    const t0 = s.now(), crossing = voltage * capacitance / current;
    const limitV = voltage - current * .01;
    const protectionTime = -capacitance / 1e-12 * Math.log1p(-1e-12 * limitV / current);
    const cvTarget = voltage / (1 + .01 * 1e-12), cvTau = capacitance / (100 + 1e-12);
    near(s.b.vcAt(t0), 0, 0, `${voltage} V／${current} A／${capacitance} F 未充電初值`);
    const node = s.b.cur.built.leadNode['GPE.CH1+'];
    near(s.b.snapshot().dcNow[node], 0, 0, 'snapshot 也使用有限初值');
    assert.deepEqual(s.b.segs.filter((g) => g.from >= t0).map((g) => g.modes[0]), ['CC', 'CV']);
    for (const segment of s.b.segs.filter((g) => g.from >= t0)) assert.ok(segment.initial.capInitial[0] <= voltage, '每個模式交界都不超過設定電壓');
    for (const fraction of [0.1, 0.5, 0.99, 1.02]) {
      s.adv(t0 + fraction * crossing - s.now());
      const elapsed = s.now() - t0, r = s.b.gpeInput()[1];
      const expected = elapsed < protectionTime ? current / 1e-12 * -Math.expm1(-1e-12 * elapsed / capacitance)
        : cvTarget + (limitV - cvTarget) * Math.exp(-(elapsed - protectionTime) / cvTau);
      near(s.b.vcAt(s.now()), expected, 1e-8, '實際時間的限流充電電压');
      assert.equal(r.cc, fraction < 1); assert.equal(r.rb, false);
      assert.ok(s.b.vcAt(s.now()) <= voltage, '充電電容不超過設定電壓');
      if (r.cc) near(r.i, current, 0, 'CC 正好以設定電流充電');
      else assert.ok(r.i >= 0 && r.i <= current, 'CV 讀回電流在合法範圍');
      near(s.b.snapshot().dcNow[node], s.b.vcAt(s.now()), 1e-12, 'snapshot 與真實電容電壓一致');
      assert.ok(!s.b.snapshot().warn.some((w) => w.includes('灌入')));
    }
    s.adv(1.5);
    near(s.b.vcAt(s.now()), voltage, 1e-8, '充飽後保持設定電壓');
    assert.equal(s.b.gpeInput()[1].rb, false);
  }
});

test('超高阻抗電容 CC 充電的 DC 積分以有限初值及 expm1 計算，不把巨大穩態相消誤差寫入讀值', () => {
  const dmm = { inputZ: () => 1e12 }, s = bbSetup([['C', 'a5', 'a10', 47e-9]], {
    'GPE.CH1+': 'b5', 'GPE.CH1-': 'b10', 'GPE.GND': 'c10', 'DMM.HI': 'd5', 'DMM.LO': 'd10',
  });
  s.b.dmm = dmm; s.gpe.vset[1] = 500; s.gpe.iset[1] = 1000; s.b.solution();
  s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution();
  const t0 = s.now(); s.adv(100e-9);
  const input = s.b.dmmInput().v, elapsed = s.now() - t0;
  near(input.dc, elapsed / 47e-9, 1e-10, '當下的有限電壓');
  near(input.meanOver(t0, s.now()), elapsed / (2 * 47e-9), 1e-10, '線性充電窗平均約為終值一半');
  near(input.ac, 0, 0, '純直流 CC 沒有捨入產生的交流');
  near(input.peak, input.dc, 1e-10, '自動量程峰值依有限實際電壓');
});

function periodicSupply(C = 0) {
  const s = bbSetup(C ? [['C', 'a5', 'a10', C]] : [], { ...sharedSupplyWires, 'AFG.CH1+': 'd5', 'AFG.CH1-': 'd10' });
  s.afg.ch[0] = sine(10, 1000, 5); s.gpe.vset[1] = 500; s.gpe.iset[1] = 10;
  s.b.solution(); s.gpe.press('GPE.KEY.OUTPUT_ON_OFF'); s.b.solution();
  return s;
}

test('同節點 AFG 0～10 V／GPE 5 V 10 mA：正峰 RB、負峰 CC，10 秒後與示波器波形仍遵守限制', () => {
  const s = periodicSupply(), t0 = s.now(), historyCount = s.b.segs.length;
  for (const elapsed of [0, 10]) {
    s.adv(t0 + elapsed + 0.25e-3 - s.now());
    let r = s.b.gpeInput()[1];
    assert.equal(r.rb, true); assert.equal(r.cc, false); near(r.i, 0, 0, '不能吸收 AFG 電流');
    near(r.v, 10 / (1 + 50 / 10e6), 1e-8, 'RB 端電壓跟隨 AFG');
    near(s.b.tdsInput().sig[0].abs(s.now()), r.v, 1e-10, '示波器實際 RB 波形');
    assert.equal(s.b.cur.modes[0], 'RB');
    s.adv(0.5e-3); r = s.b.gpeInput()[1];
    assert.equal(r.cc, true); assert.equal(r.rb, false); near(r.i, 0.01, 0, '10 mA 限流');
    near(r.v, 0.01 / (1 / 50 + 1 / 10e6), 1e-8, 'CC 端電壓沒有箝在 5 V');
    near(s.b.tdsInput().sig[0].abs(s.now()), r.v, 1e-10, '示波器實際 CC 波形');
  }
  assert.ok(s.b.snapshot().warn.some((w) => w.includes('灌入')));
  assert.equal(s.b.segs.length, historyCount, '10 秒週期切換不新增操作歷史');
});

test('GPE／AFG 無電容的受限波形：週期統計、負時間與大絕對時間的積分一致', () => {
  const s = periodicSupply(), sol = s.b.solution(), node = s.b.cur.built.leadNode['GPE.CH1+'];
  const expected = (t) => {
    const emf = 5 + 5 * Math.sin(2 * Math.PI * 1000 * t), load = 1 / 10e6 + 1e-12;
    if (emf / (1 + 50 * load) > 5) return emf / (1 + 50 * load);
    if ((5 - emf) / 50 + 5 * load > 0.01) return (emf / 50 + 0.01) / (1 / 50 + load);
    return (emf / 50 + 5 / 0.01) / (1 / 50 + 1 / 0.01 + load);
  };
  const numericalMean = (a, b) => {
    let sum = 0; const n = 100000;
    for (let i = 0; i < n; i++) sum += expected(a + (i + 0.5) * (b - a) / n);
    return sum / n;
  };
  const mean = numericalMean(0, sol.period);
  near(sol.stats(node, 'E').mean, mean, 2e-6, '受限波形整週期平均');
  for (const [a, b] of [[-2.25e-3, 2.75e-3], [1234.000123, 1234.005123]]) near(sol.meanOver(node, 'E', a, b), mean, 2e-6, '任意時間的整週期積分');
  for (const [a, b] of [[-0.1e-3, 0.1e-3], [12.0002, 12.0008]]) near(sol.meanOver(node, 'E', a, b), numericalMean(a, b), 2e-6, '部分週期跨模式積分');
});

test('含電容的 AFG／GPE 共同驅動：週期求解收斂且保護切換有效', () => {
  const s = periodicSupply(47e-9);
  assert.equal(s.b.solution().hybrid.converged, true);
  assert.ok(!s.b.snapshot().warn.some((w) => w.includes('目前不支援')));
  const t0 = s.now(); s.adv(10.00025);
  assert.equal(s.b.gpeInput()[1].rb, true);
  s.adv(.0005); assert.equal(s.b.gpeInput()[1].cc, true);
  near(s.b.gpeInput()[1].i, .01, 0, '負峰保有 10 mA 限流');
  near(s.b.tdsInput().sig[0].abs(s.now()), s.b.gpeInput()[1].v, 1e-10, '示波器與保護讀回一致');
});

test('共用大地的獨立 AFG RC 迴路，不影響另一組無電容 AFG／GPE 的週期限流或 RC 暫態', () => {
  const parts = [['R', 'a15', 'a20', 1000], ['C', 'b20', 'b25', 1e-6]];
  const wires = { 'AFG.CH2+': 'c15', 'AFG.CH2-': 'c25', 'TDS.CH2.TIP': 'c20' };
  const s = periodicSupply(), reference = bbSetup(parts, wires);
  for (const [kind, a, b, value] of parts) s.b.bb.add(kind, a, b, value, s.b.bbWires);
  for (const [lead, hole] of Object.entries(wires)) s.b.bb.plug(s.b.bbWires, lead, hole);
  s.afg.ch[1] = sine(2, 1000, 1); reference.afg.ch[1] = sine(2, 1000, 1);
  s.b.solution(); reference.b.solution();
  assert.ok(!s.b.snapshot().warn.some((w) => w.includes('目前不支援')), '獨立 RC 不應觸發混合電源限制');
  const t0 = s.now();
  near(s.b.vcAt(t0), 0, 1e-12, '獨立電容仍從 0 V 開始');
  for (const dt of [0.25e-3, 0.75e-3, 10.00025]) {
    s.adv(t0 + dt - s.now()); reference.adv(t0 + dt - reference.now());
    const r = s.b.gpeInput()[1];
    assert.equal(r.rb, dt !== 0.75e-3); assert.equal(r.cc, dt === 0.75e-3);
    near(s.b.vcAt(s.now()), reference.b.vcAt(reference.now()), 1e-10, 'RC 充電不受其他迴路模式切換影響');
    near(s.b.tdsInput().sig[1].abs(s.now()), reference.b.tdsInput().sig[1].abs(reference.now()), 1e-10, '獨立 RC 的示波器波形');
  }
  const sg = s.b.cur, rg = reference.b.cur, node = sg.built.leadNode['TDS.CH2.TIP'], refNode = rg.built.leadNode['TDS.CH2.TIP'];
  near(sg.sol.stats(node, 'E').acRms, rg.sol.stats(refNode, 'E').acRms, 1e-12, '獨立 RC 的非線性區間積分仍使用原解析解');
  near(sg.sol.meanOver(node, 'E', 12.0001, 12.0012), rg.sol.meanOver(refNode, 'E', 12.0001, 12.0012), 1e-10, '獨立 RC 的穩態平均');
});

test('P2-1 空腳 47 nF 不影響無電容 AFG／GPE：正負峰與 10 秒後 GPE／TDS／DMM 仍正確', () => {
  const s = periodicSupply(), reference = periodicSupply();
  s.b.bb.add('C', 'a20', 'a25', 47e-9, s.b.bbWires);
  for (const fixture of [s, reference]) {
    fixture.b.bb.plug(fixture.b.bbWires, 'DMM.HI', 'e5');
    fixture.b.bb.plug(fixture.b.bbWires, 'DMM.LO', 'e10');
    fixture.b.solution();
  }
  assert.ok(!s.b.snapshot().warn.some((w) => w.includes('目前不支援')), '完全空腳電容不應限制其他迴路');
  near(s.b.vcAt(s.now()), 0, 0, '空腳电容沒有憑空取得電荷');
  const t0 = s.now(), conductance = 2 / 10e6;
  for (const elapsed of [0, 10]) for (const phase of [0.25e-3, 0.75e-3]) {
    const t = t0 + elapsed + phase;
    s.adv(t - s.now()); reference.adv(t - reference.now());
    const r = s.b.gpeInput()[1], positive = phase === 0.25e-3;
    assert.equal(r.rb, positive); assert.equal(r.cc, !positive);
    near(r.i, positive ? 0 : 0.01, 0, '逆灌時 0 A，負峰限流 10 mA');
    near(r.v, positive ? 10 / (1 + 50 * conductance) : 0.01 / (1 / 50 + conductance), 1e-8, '計入探棒與電表的峰值電壓');
    near(s.b.tdsInput().sig[0].abs(t), r.v, 1e-10, 'TDS 實際波形跟著 RB／CC');
    near(s.b.dmmInput().v.dc, reference.b.dmmInput().v.dc, 1e-11, 'DMM 週期平均與無空腳電容相同');
    near(s.dmm.view().value, reference.dmm.view().value, 1e-10, 'DMM 已完成積分窗的實際讀值');
    assert.equal(s.b.gpeReadbackActive(), true, '沒有電容暫態時仍須更新 GPE 的週期讀回');
    assert.ok(!s.b.snapshot().warn.some((w) => w.includes('目前不支援')));
  }
});

test('GPE2 獨立 47 nF 充電與 GPE1／AFG 週期限流並存，仍排出 GPE2 CC→CV 事件', () => {
  const s = periodicSupply();
  s.b.bb.add('C', 'a20', 'a25', 47e-9, s.b.bbWires);
  for (const [lead, hole] of Object.entries({ 'GPE.CH2+': 'b20', 'GPE.CH2-': 'b25', 'TDS.CH2.TIP': 'c20', 'TDS.CH2.GND': 'c25' })) s.b.bb.plug(s.b.bbWires, lead, hole);
  s.gpe.vset[2] = 500; s.gpe.iset[2] = 1; s.b.solution();
  const t0 = s.now();
  s.adv(100e-6);
  assert.equal(s.b.gpeInput()[1].rb, true); assert.equal(s.b.gpeInput()[2].cc, true);
  near(s.b.vcAt(s.now()), 2.127433244, 1e-8, '獨立 GPE2 100 µs 限流充電');
  assert.ok(s.b.segs.some((g) => g.from > t0 && g.modes[1] === 'CV'), '仍排出獨立通道的充電完成事件');
  s.adv(150e-6);
  assert.equal(s.b.gpeInput()[1].rb, true); assert.equal(s.b.gpeInput()[2].cc, false);
  near(s.b.vcAt(s.now()), 5, 1e-7, 'GPE2 到 5 V 後轉 CV');
  s.adv(0.5e-3);
  assert.equal(s.b.gpeInput()[1].cc, true); assert.equal(s.b.gpeInput()[2].cc, false);
  assert.ok(!s.b.snapshot().warn.some((w) => w.includes('目前不支援')));
});

test('多路 GPE 模式迭代循環時，枚舉找到合法工作點；無關 AFG 不會使端電壓暴增到 1000 V', () => {
  for (const periodic of [false, true]) {
    const b = new Bench({ on: true, ch: [{ ...off }, { ...off }] });
    b.now = () => 12.00025;
    const built = { net: { nodes: ['P', 'X', 'Y'], elements: [
      { id: 'R1', kind: 'R', a: 'P', b: 'E', value: 10000 },
      { id: 'R2', kind: 'R', a: 'X', b: 'E', value: 100 },
      { id: 'R3', kind: 'R', a: 'Y', b: 'E', value: 10000 },
    ], afg: periodic ? [{ node: 'P', p: sine(2, 1000, 1) }] : [] }, gpe: [
      { id: 'GPE1', ch: 1, pos: 'X', neg: 'Y', v: 10, ilim: 0.1 },
      { id: 'GPE2', ch: 2, pos: 'X', neg: 'Y', v: 0, ilim: 1 },
      { id: 'GPE3', ch: 3, pos: 'Y', neg: 'X', v: 5, ilim: 1 },
    ], warn: [], find: (x) => x };
    let g = b.makeSeg(built, {}, 12, null);
    if (periodic) g = b.periodicSeg(g);
    for (const t of [12.00025, 22.00075]) {
      const modes = g.modeAt ? g.modeAt(t) : g.modes;
      assert.deepEqual(modes, ['CC', 'CV', 'CC']);
      near(g.sol.nodeAt('X', t) - g.sol.nodeAt('Y', t), -0.008999991, 1e-9, '一致工作點');
      built.gpe.forEach((c, k) => {
        const v = g.sol.nodeAt(c.pos, t) - g.sol.nodeAt(c.neg, t);
        if (modes[k] === 'CC') assert.ok(v <= c.v + 1e-9, 'CC 端電壓不能超过設定');
        if (modes[k] === 'CV') assert.ok((c.v - v) / 0.01 <= c.ilim + 1e-9 && (c.v - v) / 0.01 >= -1e-6, 'CV 電流合法');
      });
    }
  }
});

test('慢時基歷史超過 2 秒：10.5 秒的 OFF 真值在 14 秒與後續改設定後仍為 0 V', () => {
  let t = 10;
  const afg = { on: true, ch: [{ ...off, emfVpp: 0.002, emfOffset: 1 }, { ...off }] }, b = new Bench(afg);
  b.now = () => t; b.R = 1000; b.C = 10e-6; Object.assign(b.wires, DEMO); b.solution();
  t = 11; afg.ch[0].output = true; b.solution();
  const at105 = b.tdsInput().sig[0].abs(10.5), at115 = b.tdsInput().sig[0].abs(11.5);
  near(at105, 0, 0, 'OFF 時段'); assert.ok(at115 > 0.9);
  t = 14; afg.ch[0].emfOffset = 2; b.solution();
  near(b.tdsInput().sig[0].abs(10.5), at105, 0, '3 秒後不外插 ON 設定');
  near(b.tdsInput().sig[0].abs(11.5), at115, 0, '旧 ON 波形也保留');
  t = 80; afg.ch[0].emfOffset = 3; b.solution();
  near(b.tdsInput().sig[0].abs(10.5), at105, 0, '任意水平位置仍看實際歷史');
  const sig = b.tdsInput().sig[0], [low, high] = sig.transientRange(10, 80);
  for (const x of [10.5, 11.5, 14.5, 79]) {
    const residual = sig.abs(x) - sig.at(x);
    assert.ok(residual >= low - 1e-10 && residual <= high + 1e-10, '觸發用殘差範圍涵蓋歷史');
  }
});
