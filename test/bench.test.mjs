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
