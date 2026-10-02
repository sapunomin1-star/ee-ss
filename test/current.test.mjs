// 串接電表的讀值要與真正分流負載、電源讀回及操作歷史一致。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Bench } from '../src/bench/bench.js';
import { Breadboard, BB_DEMO } from '../src/bench/breadboard.js';
import { DmmModel, CURRENT_SHUNT, APERTURE } from '../src/instruments/dmm/model.js';
import { GpeModel } from '../src/instruments/gpe/model.js';
import { R_GPE } from '../src/bench/net.js';

const off = { wave: 'SINE', freq: 1000, sym: 50, emfVpp: 2, emfOffset: 0, output: false };
const near = (x, y, tol = 1e-8) => assert.ok(Math.abs(x - y) <= tol, `${x} vs ${y}`);
function setup({ fn = 'DCI', auto = true, idx = 0, v = 5, r = 1000, sine = null } = {}) {
  let time = 10;
  const afg = { on: true, ch: [sine ? { ...off, ...sine, output: true } : { ...off }, { ...off }] };
  const dmm = new DmmModel(), gpe = new GpeModel(), bench = new Bench(afg, dmm, gpe);
  bench.now = () => time; gpe.now = () => time * 1000;
  bench.board = 'bb'; bench.bb = new Breadboard();
  bench.bb.load(BB_DEMO.current, bench.bbWires);
  bench.bb.parts[0].value = r;
  gpe.vset[1] = v * 100; gpe.iset[1] = 3000; gpe.output = !sine;
  if (sine) {
    delete bench.bbWires['GPE.CH1+']; delete bench.bbWires['GPE.CH1-'];
    bench.bbWires['AFG.CH1+'] = 'B+29'; bench.bbWires['AFG.CH1-'] = 'B-29';
  }
  dmm.fixture = 'bench'; dmm.fn = fn; dmm.st.auto = auto; dmm.st.idx = idx;
  dmm.setBenchSource(() => bench.dmmInput());
  gpe.setBenchSource(() => bench.gpeInput()); gpe.load = 'bench';
  bench.dmmInput();
  return { bench, dmm, gpe, afg, tick: (dt = 1) => { time += dt; }, at: (t) => { time = t; } };
}

test('串接 DCI Auto：I→LO 正向電流包含實際負擔，與 GPE 讀回相同且不需要 HI', () => {
  const { bench, dmm, gpe, tick } = setup(); tick();
  assert.equal(dmm.view().rangeLabel, 'Auto 10mA');
  near(dmm.view().value, 5 / (1000 + 5 + R_GPE));
  near(dmm.view().value, gpe.readback()[1].i);
  assert.equal(bench.dmmInput().v, null);
  assert.ok(bench.cur.built.net.loads.some((l) => l.current && l.r === 5));
  assert.ok(bench.snapshot().warn.some((w) => w.includes('教學近似') && w.includes('非原廠內阻')));
});

test('交換 I 與 LO：電流讀值反號，電路負載與電源電流不變', () => {
  const s = setup(); s.tick(); const pos = s.dmm.view().value;
  [s.bench.bbWires['DMM.I'], s.bench.bbWires['DMM.LO']] = [s.bench.bbWires['DMM.LO'], s.bench.bbWires['DMM.I']];
  s.bench.solution(); s.tick(); near(s.dmm.view().value, -pos);
  near(s.gpe.readback()[1].i, pos);
});

test('拆除 I 端使原串接回路開路，沒有相容電流輸入；HI 不能代替 I', () => {
  const s = setup(); delete s.bench.bbWires['DMM.I']; s.bench.bbWires['DMM.HI'] = 'i18';
  s.bench.solution(); s.tick();
  assert.equal(s.dmm.view().state, 'none');
  assert.match(s.dmm.compatNote(), /HI 不能代替 I/);
  near(s.gpe.readback()[1].i, 0, 1e-8);
  assert.ok(s.bench.dmmInput().v);
});

test('電流兩線都有接但回路另一處開路：DCI 為零，並非沿用舊電流', () => {
  const s = setup(); s.bench.bb.remove('R1'); s.bench.solution(); s.tick();
  near(s.dmm.view().value, 0); near(s.gpe.readback()[1].i, 0, 1e-8);
});

test('同一節點 I–LO 為零且提醒未串入回路', () => {
  const s = setup(); s.bench.bbWires['DMM.LO'] = 'h18'; s.bench.solution(); s.tick();
  near(s.dmm.view().value, 0);
  assert.ok(s.bench.snapshot().warn.some((w) => w.includes('同一電氣節點')));
});

test('手動電流量程改變實際負載、GPE 電流和讀值；低檔過載不截斷', () => {
  const s = setup({ auto: false, idx: 2 }); s.tick();
  const hi = s.dmm.view().value;
  s.dmm.st.idx = 1; s.bench.solution(); s.tick();
  near(s.bench.dmmInput().i.dc, 5 / (1000 + 110 + R_GPE));
  assert.ok(s.gpe.readback()[1].i < hi);
  assert.equal(s.dmm.view().state, 'over');
  assert.equal(s.dmm.view().text, '-------');
  assert.deepEqual(CURRENT_SHUNT.map((r) => Number(r.toPrecision(5))), [110, 110, 5, 5, 0.7, 0.66667]);
});

test('Auto 有限收斂，重複 snapshot/view 不增加電路歷史；降檔遲滯在負載邊界不振盪', () => {
  const s = setup({ v: 1.34 }); s.tick();
  assert.equal(s.dmm.st.idx, 2);
  const n = s.bench.segs.length, key = s.bench.key();
  for (let k = 0; k < 30; k++) { s.dmm.snapshot(); s.dmm.view(); }
  assert.equal(s.bench.segs.length, n); assert.equal(s.bench.key(), key); assert.equal(s.bench.cacheKey, key);
  s.gpe.vset[1] = 125; s.bench.solution(); s.tick();
  for (let k = 0; k < 30; k++) s.dmm.snapshot();
  assert.equal(s.dmm.st.idx, 2); // 1.244 mA：不能在 110 Ω／5 Ω 邊界反覆切。
  s.gpe.vset[1] = 50; s.bench.solution(); s.tick(); s.dmm.snapshot();
  assert.equal(s.dmm.st.idx, 1);
});

test('ACI AC耦合：含 DC 偏移的正弦只顯示交流 RMS，但 DC 負擔仍流經同一 shunt', () => {
  const s = setup({ fn: 'ACI', auto: false, idx: 2, sine: { emfVpp: 2, emfOffset: 1 } }); s.tick();
  const resistance = 1000 + 50 + 5, i = s.bench.dmmInput().i;
  near(s.dmm.view().value, 1 / (Math.SQRT2 * resistance), 1e-9);
  near(i.dc, 1 / resistance); near(i.peakAc, 1 / resistance);
  near(i.meanOver(10, 11), 1 / resistance, 1e-9);
  s.dmm.fn = 'DCI'; s.dmm.st.auto = false; s.dmm.st.idx = 2; s.bench.solution(); s.tick();
  const tr = Math.floor(12 / APERTURE) * APERTURE, start = tr - APERTURE;
  const expected = (1 + (Math.cos(2 * Math.PI * 1000 * start) - Math.cos(2 * Math.PI * 1000 * tr)) / (2 * Math.PI * 1000 * APERTURE)) / resistance;
  near(s.dmm.view().value, expected, 1e-9);
});

test('ACI 的規格外提示採 3 Hz–5 kHz；Auto 同時容納交流 RMS 與峰值', () => {
  const s = setup({ fn: 'ACI', sine: { freq: 6000, emfVpp: 2, emfOffset: 0 } }); s.tick();
  assert.equal(s.dmm.view().rangeLabel, 'Auto 1mA');
  assert.ok(s.dmm.specNotes().some((x) => x.includes('ACI 規格 3 Hz–5 kHz')));
  near(s.dmm.view().value, 1 / (Math.SQRT2 * 1160), 1e-9);
});

test('電流分流歷史：改量程不改寫已完成的 10 PLC DCI 讀值，跨變更的積分使用各段的 r', () => {
  const s = setup({ auto: false, idx: 2 }); s.at(10.21);
  const old = s.dmm.view().value;
  s.dmm.st.idx = 1; s.bench.solution();
  near(s.dmm.input(), old); assert.equal(s.dmm.view().state, 'over'); // 已完成讀值仍超出新手動小量程。
  const newer = 5 / (1000 + 110 + R_GPE);
  const mixed = s.bench.dmmInput().i.meanOver(10.20, 10.22);
  near(mixed, (old + newer) / 2);
  s.at(10.21 + 2 * APERTURE); near(s.dmm.input(), newer);
});

test('改回 DCV 或關電表不移除 I–LO 負載，不掩蓋並接誤用；HI 電壓端保持獨立', () => {
  const s = setup({ auto: false, idx: 2 });
  s.bench.bbWires['DMM.I'] = 'B+27'; s.bench.bbWires['DMM.HI'] = 'g18';
  s.bench.solution(); s.tick();
  assert.ok(s.bench.snapshot().warn.some((w) => w.includes('直接並接在電源兩端')));
  const before = s.gpe.readback()[1].i;
  s.dmm.fn = 'DCV'; s.bench.solution(); s.tick();
  near(s.bench.dmmInput().i.dc, before, 1e-7); assert.ok(s.dmm.view().value !== null);
  s.dmm.on = false; s.bench.solution();
  near(s.gpe.readback()[1].i, before, 1e-7);
  assert.ok(s.dmm.status().some(([name, text]) => name === '電流端負載' && text.includes('仍導通')));
});

test('兩路電源並接 I–LO 合計超過 3 A：真實 shunt 支路過載並顯眼提示，不假設熔絲安全', () => {
  const s = setup({ r: 1000, auto: false, idx: 5, v: 5 });
  s.bench.bbWires['DMM.I'] = 'B+27';
  s.bench.bbWires['GPE.CH2+'] = 'B+28'; s.bench.bbWires['GPE.CH2-'] = 'B-28';
  s.gpe.vset[2] = 500; s.gpe.iset[2] = 3000; s.bench.solution(); s.tick();
  assert.ok(s.bench.dmmInput().i.dc > 3);
  assert.equal(s.dmm.view().state, 'over');
  assert.equal(s.dmm.readingHint().kind, 'reject');
  assert.match(s.dmm.readingHint().text, /超過 3 A/);
  assert.ok(s.dmm.status().some(([name]) => name === '錯接／超限'));
});

test('3A 額定以 AC 有效電流判斷，不把合法正弦峰值當成超額；ACI 仍計入 DC 對分流的負擔', () => {
  const dmm = new DmmModel(); dmm.fixture = 'bench'; dmm.fn = 'ACI';
  const i = { dc: 0, ac: 2.5, peak: 2.5 * Math.SQRT2 };
  dmm.setBenchSource(() => ({ i }));
  assert.equal(dmm.currentWarning(), '');
  i.dc = 2;
  assert.match(dmm.currentWarning(), /總有效電流（含 DC 成分）超過 3 A/);
});

test('AFG／GPE 混合保護＋1µF＋真串接電流：Auto、歷史積分與電源／電容支路守恆一致', () => {
  let t = 0;
  const p = { wave: 'SINE', freq: 1000, sym: 50, emfVpp: 10, emfOffset: 5, output: true };
  const dmm = new DmmModel(), gpe = new GpeModel();
  const bench = new Bench({ on: true, ch: [p, { ...p, output: false }] }, dmm, gpe);
  bench.now = () => t; gpe.now = () => t * 1000;
  bench.board = 'bb'; bench.bb = new Breadboard();
  assert.ok(bench.bb.add('C', 'a5', 'a10', 1e-6, bench.bbWires).ok);
  assert.ok(bench.bb.add('R', 'e5', 'e18', 1000, bench.bbWires).ok);
  for (const [lead, hole] of Object.entries({
    'AFG.CH1+': 'b5', 'AFG.CH1-': 'b10', 'GPE.CH1+': 'c5', 'GPE.CH1-': 'c10',
    'DMM.I': 'd18', 'DMM.LO': 'd10',
  })) assert.ok(bench.bb.plug(bench.bbWires, lead, hole).ok);
  gpe.vset[1] = 500; gpe.iset[1] = 10; gpe.output = true;
  dmm.fixture = 'bench'; dmm.fn = 'DCI'; dmm.setBenchSource(() => bench.dmmInput());
  bench.dmmInput(); t = 0.4;
  assert.equal(dmm.view().rangeLabel, 'Auto 10mA');
  const count = bench.segs.length, key = bench.key(), idx = dmm.st.idx;
  for (let k = 0; k < 8; k++) { dmm.view(); dmm.snapshot(); }
  assert.equal(dmm.st.idx, idx); assert.equal(bench.segs.length, count);
  assert.equal(bench.key(), key); assert.equal(bench.cacheKey, key);
  const g = bench.cur, sol = g.sol, source = g.built.leadNode['GPE.CH1+'];
  const hi = g.built.leadNode['DMM.I'], lo = g.built.leadNode['DMM.LO'], r = g.built.current.r;
  assert.ok(sol.hybrid?.converged); assert.equal(r, 5);

  // 獨立中點取樣：不呼叫 actualMeanOver、sol.stats 或 DMM.input 的積分算法。
  const end = Math.floor(t / APERTURE) * APERTURE, start = end - APERTURE, samples = 50000;
  let sum = 0;
  for (let k = 0; k < samples; k++) {
    const at = start + (k + 0.5) * (end - start) / samples, segment = bench.segAt(at);
    const H = segment.built.leadNode['DMM.I'], L = segment.built.leadNode['DMM.LO'];
    sum += (segment.sol.actualNodeAt(H, at) - segment.sol.actualNodeAt(L, at)) / segment.built.current.r;
  }
  near(dmm.view().value, sum / samples, 2e-8);

  // KCL 的另一條核對路徑：用已知 AFG EMF／50Ω、GPE 讀回、R 端電壓，
  // 加上實際電容電壓的中央差分 C·dv/dt；不是拿積分結果彼此比較。
  for (const phase of [0.000231337, 0.000491337, 0.000711337]) {
    t = 0.4 + phase;
    const v = sol.actualNodeAt(source, t), x = sol.actualNodeAt(hi, t), earth = sol.actualNodeAt(lo, t);
    const iR = (v - x) / 1000, iMeter = (x - earth) / r;
    near(iR, iMeter, 1e-9);
    const rb = bench.gpeInput()[1]; near(rb.v, v - earth, 1e-9);
    assert.ok(rb.i >= 0 && rb.i <= 0.01 + 1e-9);
    const eps = 1e-10;
    const dvdt = (sol.actualNodeAt(source, t + eps) - sol.actualNodeAt(source, t - eps)) / (2 * eps);
    const emf = 5 + 5 * Math.sin(2 * Math.PI * 1000 * t);
    near((emf - v) / 50 + rb.i - iR, 1e-6 * dvdt, 1e-7);
  }
  assert.equal(bench.segs.length, count);
});
