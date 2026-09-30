// 通用電路解算（麵包板用）：多顆電容對相量解析、直流分壓、GPE 的 CV／CC、電容並聯與跨在電源上、窄脈衝與長時間常數。
import test from 'node:test';
import assert from 'node:assert/strict';
import { solveNet, ohmsNet, R_GPE } from '../src/bench/net.js';
import { solve, diffStats } from '../src/bench/circuit.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const sine = (vpp, f, off = 0) => ({ wave: 'SINE', freq: f, sym: 50, emfVpp: vpp, emfOffset: off });
const cx = (re, im = 0) => ({ re, im });
const add = (a, b) => cx(a.re + b.re, a.im + b.im);
const mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const par = (a, b) => div(mul(a, b), add(a, b));
const mag = (a) => Math.hypot(a.re, a.im);

test('兩級 RC 低通（兩顆電容）：每個節點的有效值等於相量解析', () => {
  for (const f of [100, 1000, 10000]) {
    const w = 2 * Math.PI * f, R1 = 1000, C1 = 0.1e-6, R2 = 10e3, C2 = 10e-9;
    const net = { nodes: ['A', 'B', 'C'], elements: [
      { id: 'R1', kind: 'R', a: 'A', b: 'B', value: R1 }, { id: 'C1', kind: 'C', a: 'B', b: 'E', value: C1 },
      { id: 'R2', kind: 'R', a: 'B', b: 'C', value: R2 }, { id: 'C2', kind: 'C', a: 'C', b: 'E', value: C2 }], afg: [{ node: 'A', p: sine(2, f) }] };
    const s = solveNet(net);
    const z2 = add(cx(R2), cx(0, -1 / (w * C2))), zB = par(cx(0, -1 / (w * C1)), z2), zA = add(cx(R1), zB);
    const vA = div(zA, add(zA, cx(50))), vB = mul(vA, div(zB, zA)), vC = mul(vB, div(cx(0, -1 / (w * C2)), z2));
    for (const [node, v] of [['A', vA], ['B', vB], ['C', vC]]) near(s.stats(node, 'E').acRms, mag(v) / Math.SQRT2, 1e-9 + mag(v) * 1e-6, `${f} Hz ${node}`); // AFG 正弦每週期 4000 點線性內插，相對誤差約 2e-7
  }
});

test('直流分壓（只有 GPE）：兩顆 1 kΩ 串聯接 CH1 5 V，中點 2.5 V、電流 2.5 mA、CV', () => {
  const net = { nodes: ['P', 'M', 'N'], elements: [{ id: 'R1', kind: 'R', a: 'P', b: 'M', value: 1000 }, { id: 'R2', kind: 'R', a: 'M', b: 'N', value: 1000 }],
    dc: [{ id: 'GPE1', pos: 'P', neg: 'N', v: 5, mode: 'CV' }] };
  const s = solveNet(net);
  near(s.stats('M', 'N').mean, (5 * 1000) / (2000 + R_GPE), 1e-9, '中點對負端');  // 浮接電源對地的共模電壓只由極小漏電導決定、物理上未定義，不檢查；元件兩端電壓才有意義
  near(s.dcOut[0].i, 5 / (2000 + R_GPE), 1e-9, '電流（端電壓差÷R_GPE，誤差放大 100 倍仍遠小於 GPE 顯示的 1 mA 位數）');
  near(s.stats('M', 'N').acRms, 0, 1e-12, '沒有交流');
  near(ohmsNet(net, 'P', 'M'), 1000, 1e-9, 'Ω（R1，電源不計）');
});

test('GPE 浮接：負端不接地時元件兩端電壓仍正確；電容直接跨在電源上（τ＝R_GPE·C＝10 ps）瞬間跟上', () => {
  const net = { nodes: ['P', 'N'], elements: [{ id: 'R1', kind: 'R', a: 'P', b: 'N', value: 100 }, { id: 'C1', kind: 'C', a: 'P', b: 'N', value: 1e-9 }],
    dc: [{ id: 'GPE1', pos: 'P', neg: 'N', v: 12, mode: 'CV' }] };
  const s = solveNet(net);
  near(s.stats('P', 'N').mean, 12 * 100 / (100 + R_GPE), 1e-9, '電阻兩端');
  assert.equal(s.lam.length, 0, '電容直接跨在電源上：τ＝R_GPE·C＜1 ns，當作瞬間跟上');
});

test('CC：輸出電流超過限流 → 定電流，端電壓＝I×R', () => {
  const net = { nodes: ['P', 'N'], elements: [{ id: 'R1', kind: 'R', a: 'P', b: 'N', value: 10 }], dc: [{ id: 'GPE1', pos: 'P', neg: 'N', i: 0.1, mode: 'CC' }] };
  const s = solveNet(net);
  near(s.dcOut[0].v, 1, 1e-9, 'CC 0.1 A × 10 Ω');
});

test('並聯的兩顆電容（同一對節點）與交直流混合：AFG 經 R 對並聯電容充放電，GPE 另一迴路不互相影響', () => {
  const f = 1000, w = 2 * Math.PI * f;
  const net = { nodes: ['A', 'B', 'P', 'N'], elements: [
    { id: 'R1', kind: 'R', a: 'A', b: 'B', value: 1000 }, { id: 'C1', kind: 'C', a: 'B', b: 'E', value: 47e-9 }, { id: 'C2', kind: 'C', a: 'B', b: 'E', value: 53e-9 },
    { id: 'R2', kind: 'R', a: 'P', b: 'N', value: 1000 }], afg: [{ node: 'A', p: sine(2, f) }], dc: [{ id: 'GPE1', pos: 'P', neg: 'N', v: 3, mode: 'CV' }] };
  const s = solveNet(net);
  const zc = cx(0, -1 / (w * 100e-9)), vB = div(zc, add(cx(1050), zc));
  near(s.stats('B', 'E').acRms, mag(vB) / Math.SQRT2, mag(vB) * 1e-6, '並聯電容＝100 nF');
  near(s.stats('P', 'N').mean, 3 * 1000 / (1000 + R_GPE), 1e-9, '另一迴路');
});

test('與固定 RC 板的專用解算一致（低通、高通、窄脈衝、長時間常數）', () => {
  const wires = { 'AFG.CH1+': 'A', 'AFG.CH1-': 'G' };
  for (const [topo, R, C, f, wave] of [['RC', 1000, 0.1e-6, 1000, 'SINE'], ['CR', 100, 1e-9, 1000, 'SQUARE'], ['RC', 100e3, 10e-6, 1e5, 'RAMP'], ['CR', 1000, 1e-9, 60, 'SQUARE']]) {
    const p = { wave, freq: f, sym: 30, emfVpp: 2, emfOffset: 0.3 };
    const old = solve({ topo, R, C, wires }, [{ ...p, output: true }, { ...p, output: false }]);
    const [ra, rb] = topo === 'RC' ? ['A', 'B'] : ['B', 'E'], [ca, cb] = topo === 'RC' ? ['B', 'E'] : ['A', 'B'];
    const s = solveNet({ nodes: ['A', 'B'], elements: [{ id: 'R', kind: 'R', a: ra, b: rb, value: R }, { id: 'C', kind: 'C', a: ca, b: cb, value: C }], afg: [{ node: 'A', p }] });
    const a = diffStats(old, 'B', 'G'), b = s.stats('B', 'E');
    near(b.acRms, a.acRms, a.acRms * 1e-7, `${topo} ${R} ${C} ${f} ${wave} RMS`);
    near(b.mean, a.mean, 1e-9, `${topo} ${R} ${C} ${f} ${wave} 平均`);
    for (let k = 0; k < 4000; k += 97) near(s.table('B')[k], old.v.B[k], 1e-9, `取樣 ${k}`);
  }
});

test('暫態：給電容目標電壓求模態偏移，再合成回來等於目標', () => {
  const net = { nodes: ['A', 'B', 'C'], elements: [
    { id: 'R1', kind: 'R', a: 'A', b: 'B', value: 1000 }, { id: 'C1', kind: 'C', a: 'B', b: 'E', value: 1e-6 },
    { id: 'R2', kind: 'R', a: 'B', b: 'C', value: 1000 }, { id: 'C2', kind: 'C', a: 'C', b: 'E', value: 2e-6 }], dc: [] };
  const s = solveNet(net), t = 0.3, a = s.modalFromCaps([1.5, -0.7], t);
  const ss = s.capSS(t), wB = s.modeW('B'), wC = s.modeW('C');
  near(ss[0] + a.reduce((x, y, i) => x + y * wB[i], 0), 1.5, 1e-12, 'C1');
  near(ss[1] + a.reduce((x, y, i) => x + y * wC[i], 0), -0.7, 1e-12, 'C2');
  assert.equal(s.lam.length, 2);
  assert.ok(s.lam.every((l) => l > 0));
});
