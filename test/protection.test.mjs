import test from 'node:test';
import assert from 'node:assert/strict';
import { Bench } from '../src/bench/bench.js';

const near = (a, b, tolerance, label) => assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b}`);
function setup({ C = 47e-9, R = 0, freq = 1000, wave = 'SQUARE', elements = null, start = 0 } = {}) {
  let time = start;
  const afg = { on: true, ch: [{ wave, freq, sym: 30, emfVpp: 10, emfOffset: 5, output: false }, { output: false }] };
  const gpe = { on: true, output: false, mode: 'INDEP', eff: () => ({ vs: 5, is: .01 }) };
  const b = new Bench(afg, null, gpe);
  const parts = elements || [...(R ? [{ id: 'R', kind: 'R', a: 'P', b: 'X', value: R }] : []), { id: 'C', kind: 'C', a: R ? 'X' : 'P', b: 'E', value: C }];
  const leads = { 'GPE.CH1+': 'P', 'GPE.CH1-': 'E', 'AFG.CH1+': 'P', 'AFG.CH1-': 'E' };
  b.now = () => time; b.board = 'bb'; b.bbWires = Object.fromEntries(Object.keys(leads).map((id) => [id, id]));
  b.bb = { key: () => '', netlist: () => ({ nodes: [...new Set(parts.flatMap((p) => [p.a, p.b]))], elements: parts, leads, warnings: [] }) };
  b.solution(); afg.ch[0].output = true; gpe.output = true; b.solution();
  return { b, afg, gpe, at: (t) => { time = t; return b.gpeInput()[1]; } };
}

test('方波共驅電容：啟用初值、RC 電荷連續、CC/RB 峰值與長期週期一致', () => {
  const { b, at } = setup(), sol = b.solution(), count = b.segs.length, tau = 50 * 47e-9;
  assert.equal(sol.hybrid.converged, true);
  near(b.vcAt(0), 0, 1e-12, '剛啟用電容沒有電荷');
  near(b.vcAt(100e-9), 10.5 * -Math.expm1(-100e-9 / tau), 1e-10, 'AFG 200 mA＋GPE 10 mA 的初始充電');
  assert.equal(at(100e-9).cc, true);
  for (const t of [.00025, .50025, 10.00025]) { const r = at(t); assert.equal(r.rb, true); near(r.i, 0, 0, '逆灌開路'); near(r.v, 10, 1e-8, 'AFG 高平台'); }
  for (const t of [.00075, .50075, 10.00075]) { const r = at(t); assert.equal(r.cc, true); near(r.i, .01, 0, 'GPE 限流'); near(r.v, .5, 1e-8, '10 mA×50 Ω 的低平台'); }
  near(sol.actualNodeAt('P', .0005 - 1e-12), sol.actualNodeAt('P', .0005 + 1e-12), 1e-5, 'AFG 邊緣的電容電壓連續');
  near(sol.actualNodeAt('P', .0005 + tau / 2), 10 * Math.exp(-.5), 1e-9, '下降緣仍 RB 放電，尚未回 CV');
  assert.equal(b.segs.length, count, '一萬週期不新增操作歷史');
  assert.ok(sol.hybrid.checkpoints <= 64, '實際暫態快取有上限');
});

test('次奈秒 CV 區段與 50 ns 電容響應不被 AFG 取樣間隔吞掉', () => {
  const { b, at } = setup({ C: 1e-9, freq: 1 }); const sol = b.solution(), tau = 50e-9;
  assert.equal(sol.hybrid.converged, true);
  near(sol.nodeAt('P', .5 + tau / 2), 10 * Math.exp(-.5), 1e-8, '短於 250 µs AFG 取樣的放電');
  assert.equal(at(.5 + tau / 2).rb, true);
  assert.equal(at(.5 + 10 * tau).cc, true);
  near(sol.nodeAt('P', .5 + 10 * tau), .5 + 4.5 * Math.exp(-(10 * tau - tau * Math.log(2)) / tau), 2e-4, '回限流後的 RC 尾端');
  near(sol.stats('P', 'E').mean, 5.25, 1e-6, '窄轉換區域的週期平均');
  near(sol.stats('P', 'E').acRms, 4.75, 1e-6, '窄轉換區域的 RMS');
});

test('一百萬 Hz／1 s RC：實際一百萬週期保留慢暫態，週期映射與積分符合解析方波 RC', () => {
  const R = 100000, C = 10e-6, freq = 1e6, T = 1 / freq;
  // Include the solver's explicit 1 pS grounding at both nodes: at 100 kΩ
  // its physical leakage changes the 1 s response by about 0.1 µV.
  const gp = 1 / 50 + 1 / R + 1e-12, ge = 1 / R + 1e-12 - 1 / (R * R * gp);
  const tau = C / ge, high = 10 / (50 * R * gp * ge), low = .01 / (R * gp * ge), target = (high + low) / 2;
  const { b, at } = setup({ R, C, freq }), sol = b.solution(), node = 'X';
  assert.equal(sol.hybrid.converged, true);
  const q = Math.exp(-T / (2 * tau)), ss0 = (high * q + low) / (1 + q);
  for (const cycles of [1000, 1000000, 100000000]) {
    const t = cycles * T + T / 4;
    const expected = ss0 * -Math.expm1(-cycles * T / tau) * Math.exp(-T / (4 * tau)) + high * -Math.expm1(-T / (4 * tau));
    at(t); near(sol.actualNodeAt(node, t), expected, 5e-8, `${cycles} 週期的真實 RC 電壓`);
  }
  const a = .2, c = .8;
  const expectedMean = target - ss0 * (Math.exp(-a / tau) - Math.exp(-c / tau)) * tau / (c - a);
  near(sol.actualMeanOver(node, 'E', a, c), expectedMean, 5e-8, '跨六十萬週期的暫態積分');
  near(sol.meanOver(node, 'E', -2 * T, 3 * T), target, 1e-8, '負時間的五週期穩態積分');
  near(sol.stats(node, 'E').mean, target, 1e-8, '慢電容的週期穩態平均');
  assert.ok(sol.hybrid.checkpoints <= 64);
});

test('正弦、多顆電容：積分/統計/逐點解一致且 CVCCRB 的原始電流合法', () => {
  const { b, at } = setup({ wave: 'SINE', elements: [
    { id: 'R1', kind: 'R', a: 'P', b: 'X', value: 100 }, { id: 'R2', kind: 'R', a: 'X', b: 'E', value: 1000 },
    { id: 'C1', kind: 'C', a: 'P', b: 'E', value: 47e-9 }, { id: 'C2', kind: 'C', a: 'X', b: 'E', value: 1e-6 },
  ] });
  const sol = b.solution(); assert.equal(sol.hybrid.converged, true);
  at(10); let sum = 0, square = 0; const n = 50000, stats = sol.stats('P', 'X');
  for (let k = 0; k < n; k++) {
    const t = (k + .5) * sol.period / n, v = sol.nodeAt('P', t) - sol.nodeAt('X', t); sum += v; square += (v - stats.mean) ** 2;
    if (k % 100 === 0) {
      const time = 10 + t, rawV = sol.actualNodeAt('P', time), mode = b.cur.modeAt(time)[0];
      if (mode === 'CV') { const i = (5 - rawV) / .01; assert.ok(i >= -2e-7 && i <= .01 + 2e-7, `raw CV current ${i}`); }
      if (mode === 'CC') assert.ok(rawV <= 5 - .01 * .01 + 2e-8);
      if (mode === 'RB') assert.ok(rawV >= 5 - 2e-8);
    }
  }
  near(stats.mean, sum / n, 2e-6, '節點差分週期平均'); near(stats.acRms, Math.sqrt(square / n), 2e-6, '節點差分 RMS');
  near(sol.meanOver('P', 'X', 1234.000123, 1234.005123), stats.mean, 2e-8, '大絕對時間五週期積分');
  near(sol.actualMeanOver('P', 'X', 10.0001, 10.0011), stats.mean, 2e-8, '实际穩定後的一週期積分');
});

test('非零啟用時間與大絕對時間的週期邊界，慢電容不跳到下一週期末', () => {
  const start = 12.345123, freq = 1e6, T = 1 / freq;
  const { b, at } = setup({ R: 100000, C: 10e-6, freq, start }), sol = b.solution();
  const boundary = (Math.floor(start / T) + 1) * T, epsilon = Number.EPSILON * boundary * 2;
  near(sol.actualNodeAt('X', start), 0, 1e-12, '偏移時間仍從零電荷啟用');
  for (const n of [0, 1, 17, 1000000]) {
    const t = boundary + n * T;
    const before = sol.actualNodeAt('X', t - epsilon), exact = sol.actualNodeAt('X', t), after = sol.actualNodeAt('X', t + epsilon);
    near(before, exact, 1e-10, `${n} 週期左邊界`); near(after, exact, 1e-10, `${n} 週期右邊界`);
    const mean = sol.actualMeanOver('X', 'E', t - epsilon * 20, t + epsilon * 20);
    near(mean, exact, 1e-6, '極短跨界積分與逐點電壓一致');
  }
  const old = sol.actualNodeAt('X', boundary + .25 * T); at(start + 100);
  near(sol.actualNodeAt('X', boundary + .25 * T), old, 1e-12, '晚期查詢不覆蓋先前暫態');
});

test('25 MHz 長週期區塊不能越過保護界，零時間切換不能凍結電容', () => {
  const freq = 25e6, C = 10e-6, { b, at } = setup({ freq, C, wave: 'SINE' }), sol = b.solution();
  // Once v first reaches 5 V, RB follows the 50 Ω RC forced by 5+5 sin(ωt).
  // Its largest possible excursion is bounded by twice the sinusoidal gain.
  const rbUpper = 5 + 10 / Math.hypot(1, 2 * Math.PI * freq * 50 * C);
  for (const t of [.0012, .0013, .0015, .002, .006]) {
    const r = at(t), v = b.vcAt(t);
    assert.ok(v <= rbUpper + 2e-9, `${t}: ${v} exceeds the passive RB bound ${rbUpper}`);
    assert.equal(sol.hybrid.converged, true, '浮點邊界的零時間模式變化仍完成整個 source cell');
    if (!r.cc && !r.rb) assert.ok(r.i >= 0 && r.i <= .01 + 2e-7);
  }
  near(sol.actualNodeAt('P', .006), sol.nodeAt('P', .006), 2e-9, '真實啟用暫態最終到達週期穩態');
});

test('離 CC 邊界不足 1 pV 的 scalar envelope 仍涵蓋下降真值', () => {
  let time = 0;
  const C = 10e-6, g = 1e-12 + 1e-7, target = 4.9999 + 1e-13;
  const t0 = -Math.log1p(-target * g / .01) / (g / C);
  const p = { wave: 'SQUARE', freq: 100, sym: 50, emfVpp: 10, emfOffset: 5, output: false };
  const afg = { on: true, ch: [p, { output: false }] }, gpe = { on: true, output: true, mode: 'INDEP', eff: () => ({ vs: 5, is: .01 }) };
  const b = new Bench(afg, null, gpe), leads = { 'AFG.CH1+': 'P', 'AFG.CH1-': 'E', 'GPE.CH1+': 'P', 'GPE.CH1-': 'E', 'TDS.CH1.TIP': 'P', 'TDS.CH1.GND': 'E' };
  b.now = () => time; b.board = 'bb'; b.bbWires = Object.fromEntries(Object.keys(leads).map((id) => [id, id]));
  b.bb = { key: () => '', netlist: () => ({ nodes: ['P', 'E'], elements: [{ id: 'C', kind: 'C', a: 'P', b: 'E', value: C }], leads, warnings: [] }) };
  b.solution(); time = t0; near(b.vcAt(time), target, 1e-10, '啟用前已充到 CC 界旁');
  p.output = true; const sol = b.solution(), end = t0 + .003, range = sol.actualRange('P', t0, end), actual = sol.actualNodeAt('P', end);
  assert.ok(actual < 1, 'AFG 低平台使電容真實放電');
  assert.ok(range[0] <= actual && actual <= range[1], `conservative range ${range} must enclose ${actual}`);
});

test('兩顆電容端點均 CC，區塊中途 RB 脈衝仍改變實際積分', () => {
  let time = 0, high = true;
  const p = { wave: 'SINE', freq: 25e6, sym: 50, emfVpp: .2, emfOffset: 0, output: false }, afg = { on: true, ch: [p, { output: false }] };
  const gpe = { on: true, output: true, mode: 'INDEP', eff: (ch) => ch === 2 ? { vs: 10, is: 1 } : { vs: high ? 4.5 : 5, is: .01 } };
  const parts = [{ id: 'CA', kind: 'C', a: 'A', b: 'E', value: 10e-6 }, { id: 'CB', kind: 'C', a: 'B', b: 'E', value: .1e-6 }];
  const leads = { 'GPE.CH1+': 'B', 'GPE.CH1-': 'E', 'GPE.CH2+': 'A', 'GPE.CH2-': 'E', 'AFG.CH1+': 'A', 'AFG.CH1-': 'E' }, b = new Bench(afg, null, gpe);
  b.now = () => time; b.board = 'bb'; b.bbWires = Object.fromEntries(Object.keys(leads).map((id) => [id, id]));
  b.bb = { key: () => String(parts.length), netlist: () => ({ nodes: ['A', 'B', 'E'], elements: parts, leads, warnings: [] }) };
  b.solution(); time = 1;
  near(b.cur.sol.capSS(time)[0], 10, 1e-9, '第一顆預充 10 V'); near(b.cur.sol.capSS(time)[1], 4.5, 1e-9, '第二顆預充 4.5 V');
  parts.push({ id: 'RAB', kind: 'R', a: 'A', b: 'B', value: 100 }, { id: 'RB', kind: 'R', a: 'B', b: 'E', value: 100 });
  delete leads['GPE.CH2+']; delete leads['GPE.CH2-']; delete b.bbWires['GPE.CH2+']; delete b.bbWires['GPE.CH2-']; high = false; p.output = true;
  const sol = b.solution(), mean = sol.actualMeanOver('B', 'E', 1, 1.04);
  // Independent 2×2 backward-Euler clip-law reference, with 4 million 10 ns
  // steps: 0.6493242364237825 V. 1M/2M/4M extrapolation is 0.6493241182 V.
  // The tiny 25 MHz forcing is attenuated by both RC stages below 1 µV here.
  near(mean, .6493242364237825, 1e-6, 'RB 脈衝的平均與獨立數值參考一致');
  assert.ok(Math.abs(mean - .649585007) > .0002, '不能退化成全程 CC 的線性積分');
  assert.equal(sol.hybrid.converged, true);
});
