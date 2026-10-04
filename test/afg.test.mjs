// AFG 模型：照 docs/data/afg.json 的驗收序列按鍵（AFG-F01～F16）。這是模型層測試；真 UI 操作見 scripts/e2e。
import test from 'node:test';
import assert from 'node:assert/strict';
import { AfgModel, fmtAmpl, UNIT_TEXT } from '../src/instruments/afg/model.js';

const KEY = {
  WAVE: 'AFG.KEY.WAVEFORM', FREQ: 'AFG.KEY.FREQ_RATE', AMPL: 'AFG.KEY.AMPL', OFFSET: 'AFG.KEY.DC_OFFSET',
  CH: 'AFG.KEY.CH1_CH2', OUT: 'AFG.KEY.OUTPUT', PRESET: 'AFG.KEY.PRESET', RETURN: 'AFG.KEY.RETURN',
  LEFT: 'AFG.KEY.ARROW_LEFT', RIGHT: 'AFG.KEY.ARROW_RIGHT', PM: 'AFG.NUM.PLUS_MINUS', DOT: 'AFG.NUM.DOT',
  F1: 'AFG.SOFT.F1', F2: 'AFG.SOFT.F2', F3: 'AFG.SOFT.F3', F4: 'AFG.SOFT.F4', F5: 'AFG.SOFT.F5',
};
// run(m, 'AMPL 3.535 F3') → 依序按鍵；數字字串拆成單一數字鍵；回傳最後一個提示
function run(m, seq) {
  let last = null;
  for (const tok of seq.split(/\s+/).filter(Boolean)) {
    if (/^-?[\d.]+$/.test(tok)) {
      for (const ch of tok) last = m.press(ch === '.' ? KEY.DOT : ch === '-' ? KEY.PM : `AFG.NUM.DIGIT_${ch}`) ?? last;
    } else last = m.press(KEY[tok] ?? tok);
  }
  return last;
}
const lcdAmpl = (m) => `${fmtAmpl(m.refVpp(), m.c.unit, m.c.wave)} ${UNIT_TEXT[m.c.unit]}`;
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);
const fresh = () => { const m = new AfgModel(); run(m, 'PRESET'); return m; };

// 從實際 LCD SVG 確認底線落在數字上，且該數字的位權等於旋鈕用的位權。
function visibleCursor(m) {
  const svg = m.lcd();
  const edit = svg.match(/<text x="([^"]+)" y="223"[^>]*>([^<]+)<\/text>/);
  const line = svg.match(/<rect x="([^"]+)" y="226"/);
  assert.ok(edit && line, `編輯框必須有可見游標：${m.hl}，位權 ${m.cexp}`);
  const [number, unit] = edit[2].split(' ');
  const index = Math.round((Number(line[1]) - Number(edit[1]) - 0.5) / 9.4);
  assert.match(number[index] ?? '', /\d/, `底線必須落在數字而非小數點或負號：${edit[2]}`);
  const dot = number.indexOf('.');
  const shownExp = dot < 0 ? number.length - index - 1 : dot - index - (index < dot ? 1 : 0);
  const mult = { uHz: 1e-6, mHz: 1e-3, Hz: 1, kHz: 1e3, MHz: 1e6, mVPP: 1e-3, mVRMS: 1e-3, mVDC: 1e-3 }[unit] ?? 1;
  assert.equal(m.cexp, Math.round(Math.log10(mult)) + shownExp, `旋鈕與底線位權一致：${edit[2]}`);
}

test('Preset 狀態（AFG-F13）', () => {
  const m = fresh();
  assert.equal(m.c.wave, 'SINE'); assert.equal(m.c.freq, 1000); near(m.refVpp(), 3); assert.equal(m.refOffset(), 0);
  assert.equal(m.c.load50, true); assert.equal(m.c.output, false); assert.equal(lcdAmpl(m), '3.000 VPP');
});

test('(a) 3.535 VRMS：已提交值不捨入，只換顯示單位不改物理值', () => {
  const m = fresh();
  assert.equal(run(m, 'AMPL 3.535 F3')?.kind, 'info');
  near(m.refVpp(), 3.535 * 2 * Math.SQRT2);
  assert.equal(lcdAmpl(m), '3.535 VRMS');
  run(m, 'F5'); assert.equal(lcdAmpl(m), '9.998 VPP');
  run(m, 'F3'); assert.equal(lcdAmpl(m), '3.535 VRMS');
  near(m.refVpp(), 3.535 * 2 * Math.SQRT2);
});

test('(b) 11 VPP 被拒絕，原值保留', () => {
  const m = fresh();
  assert.equal(run(m, 'AMPL 11 F5').kind, 'reject');
  near(m.refVpp(), 3); assert.equal(lcdAmpl(m), '3.000 VPP');
});

test('(c) +23.979 dBm 接受、+23.98 dBm 拒絕（依未捨入值）', () => {
  const m = fresh();
  run(m, 'AMPL 23.979 F1');
  near(m.refVpp(), 9.99953939374911, 1e-9); assert.equal(lcdAmpl(m), '23.98 dBm');
  assert.equal(run(m, '23.98 F1').kind, 'reject');
  near(m.refVpp(), 9.99953939374911, 1e-9); assert.equal(lcdAmpl(m), '23.98 dBm');
  run(m, 'F5'); assert.equal(lcdAmpl(m), '10.00 VPP');
});

test('(d) 25 MHz：+17.958 dBm 接受、+17.959 dBm 拒絕', () => {
  const m = fresh();
  assert.equal(run(m, 'FREQ 25 F5'), null);
  assert.equal(m.c.freq, 25e6);
  run(m, 'AMPL 17.958 F1');
  near(m.refVpp(), 4.999539404357016, 1e-9); assert.equal(lcdAmpl(m), '17.96 dBm');
  assert.equal(run(m, '17.959 F1').kind, 'reject');
  near(m.refVpp(), 4.999539404357016, 1e-9);
});

test('(e) 10 VPP 只換顯示單位往返不改物理值；照打顯示值會被拒絕', () => {
  const m = fresh();
  run(m, 'AMPL 10 F5'); near(m.refVpp(), 10);
  assert.equal(lcdAmpl(m), '10.00 VPP');
  run(m, 'F1'); assert.equal(lcdAmpl(m), '23.98 dBm');
  run(m, 'F3'); assert.equal(lcdAmpl(m), '3.536 VRMS');
  run(m, 'F5'); assert.equal(lcdAmpl(m), '10.00 VPP'); near(m.refVpp(), 10);
  assert.equal(run(m, '3.536 F3').kind, 'reject');
  assert.equal(run(m, '23.98 F1').kind, 'reject');
  near(m.refVpp(), 10);
});

test('(f) 0／−10 dBm 接受；offset +4 V 時 +13 dBm 拒絕並保留 −10 dBm', () => {
  const m = fresh();
  run(m, 'AMPL 0 F1'); near(m.refVpp(), 0.6324555320336759, 1e-12); assert.equal(lcdAmpl(m), '0.00 dBm');
  run(m, '10 PM F1'); near(m.refVpp(), 0.2, 1e-12); assert.equal(lcdAmpl(m), '-10.00 dBm');
  assert.equal(run(m, 'OFFSET 4 F2'), null); near(m.refOffset(), 4);
  assert.equal(run(m, 'AMPL 13 F1').kind, 'reject');
  near(m.refVpp(), 0.2, 1e-12); assert.equal(lcdAmpl(m), '-10.00 dBm');
});

test('(g) VPP 輸入 0 或負值被拒絕', () => {
  const m = fresh();
  assert.equal(run(m, 'AMPL 0 F5').kind, 'reject');
  assert.equal(run(m, 'AMPL 1 PM F5').kind, 'reject');
  near(m.refVpp(), 3);
});

test('(h) 旋鈕以已提交的未捨入值為基準：9.998 → 9.999 → 下一格不生效', () => {
  const m = fresh();
  run(m, 'AMPL 3.535 F3 F5');
  run(m, 'RIGHT RIGHT'); // 游標 0.1 → 0.001 V
  assert.equal(m.cexp, -3);
  m.turn('AFG.KNOB.SCROLL_WHEEL', 1);
  assert.equal(lcdAmpl(m), '9.999 VPP'); near(m.refVpp(), 3.535 * 2 * Math.SQRT2 + 0.001);
  assert.equal(m.turn('AFG.KNOB.SCROLL_WHEEL', 1).kind, 'reject');
  assert.equal(lcdAmpl(m), '9.999 VPP');
});

test('F05：1 kHz 游標移到 kHz 個位，順時針得 2 kHz、逆時針回 1 kHz', () => {
  const m = fresh();
  run(m, 'FREQ LEFT');
  m.turn('AFG.KNOB.SCROLL_WHEEL', 1); assert.equal(m.c.freq, 2000);
  m.turn('AFG.KNOB.SCROLL_WHEEL', -1); assert.equal(m.c.freq, 1000);
});

test('F05：頻率／幅度／偏移／SYM 的游標只在 LCD 可見數字間移動', () => {
  for (const seq of ['FREQ', 'AMPL', 'AMPL F1', 'AMPL F2', 'AMPL F3', 'AMPL F4', 'OFFSET', 'OFFSET F1', 'OFFSET 0.9 PM F2', 'WAVE F4 F1']) {
    const m = fresh(); run(m, seq);
    visibleCursor(m);
    for (const direction of ['LEFT', 'RIGHT']) {
      for (let i = 0; i < 16; i++) { run(m, direction); visibleCursor(m); }
    }
  }
  const f = fresh(); run(f, 'FREQ LEFT LEFT');
  assert.equal(f.cexp, 3, '1 kHz 的最高可見位是 kHz 個位');
  f.turn('AFG.KNOB.SCROLL_WHEEL', 1);
  assert.equal(f.c.freq, 2000, '不能因隱藏的十 kHz 位而跳到 11 kHz'); visibleCursor(f);
  const a = fresh(); run(a, 'AMPL LEFT LEFT');
  a.turn('AFG.KNOB.SCROLL_WHEEL', 1); near(a.refVpp(), 4); visibleCursor(a);
  const o = fresh(); run(o, 'OFFSET LEFT LEFT');
  o.turn('AFG.KNOB.SCROLL_WHEEL', 1); near(o.refOffset(), 1); visibleCursor(o);
});

test('F05：頻率跨 Hz／kHz 與 mHz／uHz 時保留正確位權及可見游標', () => {
  const m = fresh(); run(m, 'FREQ 999.999999 F3');
  for (let i = 0; i < 16; i++) run(m, 'RIGHT');
  assert.equal(m.cexp, -6);
  m.turn('AFG.KNOB.SCROLL_WHEEL', 1);
  assert.equal(m.c.freq, 1000); assert.equal(m.cexp, -6); visibleCursor(m);
  m.turn('AFG.KNOB.SCROLL_WHEEL', -1);
  near(m.c.freq, 999.999999, 1e-10); visibleCursor(m);
  run(m, '1 F2');
  for (let i = 0; i < 16; i++) run(m, 'RIGHT');
  m.turn('AFG.KNOB.SCROLL_WHEEL', -1);
  near(m.c.freq, 999e-6, 1e-12); assert.equal(m.cexp, -6); visibleCursor(m);
});

test('F05：幅度進位縮減顯示小數時，游標移到最近的可見位數', () => {
  const m = fresh(); run(m, 'CH CH F1 F2 AMPL 9.999 F5 RIGHT RIGHT');
  assert.equal(m.cexp, -3); visibleCursor(m);
  m.turn('AFG.KNOB.SCROLL_WHEEL', 1);
  near(m.refVpp(), 10); assert.equal(lcdAmpl(m), '10.00 VPP');
  assert.equal(m.cexp, -2, '10.00 沒有千分位，不能保留隱藏游標'); visibleCursor(m);
  m.turn('AFG.KNOB.SCROLL_WHEEL', 1);
  near(m.refVpp(), 10.01); visibleCursor(m);
  run(m, 'F2'); visibleCursor(m);
  const before = m.refVpp();
  m.turn('AFG.KNOB.SCROLL_WHEEL', -1);
  near(m.refVpp(), before - 0.1 * 2 * Math.SQRT2); visibleCursor(m);
});

test('F05：偏移切到 mVDC 與 SYM 跨 100%→0% 時，旋鈕不使用消失的位數', () => {
  const m = fresh(); run(m, 'OFFSET F1');
  assert.equal(m.cexp, -3, '0 mVDC 只有 mV 個位'); visibleCursor(m);
  m.turn('AFG.KNOB.SCROLL_WHEEL', 1);
  near(m.refOffset(), 0.001); visibleCursor(m);
  run(m, 'F2'); visibleCursor(m);
  m.turn('AFG.KNOB.SCROLL_WHEEL', -1);
  near(m.refOffset(), -0.099); visibleCursor(m);
  run(m, 'WAVE F4 F1 100 F2 LEFT LEFT');
  assert.equal(m.cexp, 2); visibleCursor(m);
  m.turn('AFG.KNOB.SCROLL_WHEEL', -1);
  assert.equal(m.c.sym, 0); assert.equal(m.cexp, 0); visibleCursor(m);
  m.turn('AFG.KNOB.SCROLL_WHEEL', 1);
  assert.equal(m.c.sym, 1); visibleCursor(m);
});

test('F05：微赫茲頻率的預設游標不低於 1 µHz 解析度，提交與重開選單後旋鈕每格生效', () => {
  for (const f of [1, 25, 999]) {
    const m = fresh();
    run(m, `FREQ ${f} F1`);
    assert.equal(m.cexp, -6, `${f} µHz 提交後游標是合法最低位`);
    for (let i = 0; i < 10; i++) m.turn('AFG.KNOB.SCROLL_WHEEL', 1);
    near(m.c.freq, (f + 10) * 1e-6, 1e-12);
    run(m, 'AMPL FREQ');
    assert.equal(m.cexp, m.c.freq < 1e-3 ? -6 : -4, '重開頻率選單仍使用合法預設位權');
    const before = m.c.freq;
    m.turn('AFG.KNOB.SCROLL_WHEEL', 1);
    near(m.c.freq, before + 10 ** m.cexp, 1e-12);
  }
  const m = fresh();
  run(m, 'FREQ 1 F1 RIGHT');
  assert.equal(m.cexp, -6, '往右也不超過最低解析度');
  assert.equal(m.turn('AFG.KNOB.SCROLL_WHEEL', -1).kind, 'reject');
  assert.equal(m.c.freq, 1e-6, '逆時針低於頻率下限被拒絕');
});

test('F04：Ramp 2 MHz 拒絕；10 Vpp 時 25 MHz 拒絕；Preset 後 25 MHz 接受', () => {
  const m = fresh();
  run(m, 'WAVE F4');
  assert.equal(run(m, 'FREQ 2 F5').kind, 'reject'); assert.equal(m.c.freq, 1000);
  run(m, 'PRESET AMPL 10 F5');
  assert.equal(run(m, 'FREQ 25 F5').kind, 'reject'); assert.equal(m.c.freq, 1000);
  run(m, 'PRESET');
  assert.equal(run(m, 'FREQ 25 F5'), null); assert.equal(m.c.freq, 25e6);
});

test('F07／F08：offset 與聯合限制', () => {
  const m = fresh();
  run(m, 'AMPL 2 F5');
  assert.equal(run(m, 'OFFSET 3 PM F2'), null); near(m.refOffset(), -3);
  assert.equal(run(m, 'OFFSET 4.5 PM F2').kind, 'reject'); near(m.refOffset(), -3);
  run(m, 'PRESET AMPL 4 F5');
  assert.equal(run(m, 'OFFSET 3 F2'), null);
  assert.equal(run(m, 'OFFSET 3.5 F2').kind, 'reject'); near(m.refOffset(), 3);
  run(m, 'PRESET AMPL 10 F5'); near(m.refVpp(), 10); // 10 Vpp＋0 V 接受（p.28）
});

test('F10／F11：切 High Z 顯示 ×2、EMF 不變；dBm 自動改 VPP；High Z 按 dBm 拒絕', () => {
  const m = fresh();
  run(m, 'AMPL 13.52 F1');
  const emf = m.c.emfVpp;
  run(m, 'CH CH F1 F2'); // CH1/CH2 每按一次切換通道（GAP-AFG-01），按兩次回到 CH1 → Load → High Z
  assert.equal(m.sel, 0); assert.equal(m.c.load50, false);
  assert.equal(m.c.unit, 'VPP'); assert.equal(m.c.emfVpp, emf); assert.equal(lcdAmpl(m), '5.999 VPP');
  assert.equal(run(m, 'AMPL F1').kind, 'reject'); assert.equal(m.c.unit, 'VPP');
  const m2 = fresh();
  run(m2, 'OFFSET 1 F2 CH CH F1 F2');
  near(m2.refVpp(), 6); near(m2.refOffset(), 2);
  run(m2, 'F1'); near(m2.refVpp(), 3);
});

test('F01／F09：兩通道獨立；Output 各自開關', () => {
  const m = fresh();
  run(m, 'AMPL 2 F5 OUT');
  run(m, 'CH WAVE F4 FREQ 10 F4 AMPL 1 F5');
  assert.equal(m.sel, 1);
  for (let i = 0; i < 3; i++) run(m, 'CH');
  const [a, b] = m.ch;
  assert.equal(a.wave, 'SINE'); near(m.refVpp(a), 2); assert.equal(a.output, true);
  assert.equal(b.wave, 'RAMP'); assert.equal(b.freq, 10000); near(m.refVpp(b), 1); assert.equal(b.output, false);
});

test('F03：Ramp SYM 50%；101% 拒絕', () => {
  const m = fresh();
  run(m, 'WAVE F4 F1 50 F2'); assert.equal(m.c.sym, 50);
  assert.equal(run(m, 'F1 101 F2').kind, 'reject'); assert.equal(m.c.sym, 50);
});

test('F12：Sine 5 MHz 切到 Ramp，頻率降為 1 MHz 並提示近似', () => {
  const m = fresh();
  run(m, 'FREQ 5 F5');
  assert.equal(run(m, 'WAVE F4').kind, 'approx'); assert.equal(m.c.freq, 1e6);
});

test('F14：Return 捨棄半截輸入；F2 選單依情境', () => {
  const m = fresh();
  run(m, 'FREQ 5 RETURN'); assert.equal(m.c.freq, 1000); assert.equal(m.buf, '');
  assert.equal(m.menu, 'FREQ');
});

test('F15：Pulse、Noise與Phase 已可實際選取/編輯', () => {
  const m = new AfgModel();
  run(m, 'WAVE F3'); assert.equal(m.c.wave, 'PULSE');
  run(m, 'F1 250 F3'); assert.equal(m.c.extended.pulseWidth, 250e-6);
  run(m, 'WAVE F5'); assert.equal(m.c.wave, 'NOISE');
  assert.match(run(m, 'FREQ').text, /Noise/); assert.equal(m.hl, null);
  run(m, 'WAVE F1 CH CH F4 F1 45 F5'); assert.equal(m.c.phase, 45);
  assert.equal(m.descriptor(0).phase, 45);
});
