// 麵包板量測（真 UI）：示範 RC 低通 → 示波器／電表讀值與固定 RC 板相同；插一條跳線把電容短路 → 提醒且 B 點歸零；
// 示範 GPE 分壓 → 開 GPE 輸出，電表讀 R2 兩端、GPE 讀回 CV 電流；把 −線移到＋軌 → 電源短路進 CC。__eess 只讀。
import { openApp, Check, sleep } from './lib.mjs';

const A = { PRESET: 'AFG.KEY.PRESET', CH: 'AFG.KEY.CH1_CH2', AMPL: 'AFG.KEY.AMPL', FREQ: 'AFG.KEY.FREQ_RATE', OUT: 'AFG.KEY.OUTPUT', F1: 'AFG.SOFT.F1', F2: 'AFG.SOFT.F2', F4: 'AFG.SOFT.F4', F5: 'AFG.SOFT.F5' };
const S = { AUTOSET: 'TDS.KEY.AUTOSET', MEAS: 'TDS.KEY.MEASURE', O1: 'TDS.SOFT.OPT1', O2: 'TDS.SOFT.OPT2', O5: 'TDS.SOFT.OPT5' };
const R = 1000, C = 100e-9, w = 2 * Math.PI * 1000, Xc = 1 / (w * C);
const vA = (2 * Math.hypot(R, Xc)) / Math.hypot(R + 50, Xc), vB = (2 * Xc) / Math.hypot(R + 50, Xc);

export async function run() {
  const T = new Check('麵包板量測（RC、GPE）');
  const ui = await openApp();
  const p = ui.page;
  const seq = async (map, s) => {
    for (const t of s.split(/\s+/).filter(Boolean)) {
      if (/^[\d.]+$/.test(t)) { for (const ch of t) await ui.press(ch === '.' ? 'AFG.NUM.DOT' : `AFG.NUM.DIGIT_${ch}`); } else await ui.press(map[t]);
    }
  };
  const volts = (txt) => { const m = String(txt).match(/(-?[\d.]+)\s*(m?)V/); return m ? Number(m[1]) * (m[2] ? 1e-3 : 1) : NaN; };
  const hole = (h) => p.click(`[data-hole="${h}"]`);
  try {
    // RC 低通：AFG High Z、2 Vpp、1 kHz、OUTPUT → 麵包板示範 → 示波器 AutoSet、Pk-Pk；電表 ACV
    await ui.tab('afg');
    await seq(A, 'PRESET CH CH F1 F2 AMPL 2 F5 FREQ 1 F4 OUT');
    await ui.tab('bench');
    await p.check('input[name="board"][value="bb"]');
    await p.click('[data-bb="demo-rc"]');
    let b = await ui.snap('bench');
    T.ok(b.board === 'bb' && b.bb.elements.length === 2 && b.warn.length === 0, `示範 RC 低通：兩個元件、沒有提醒${b.warn.length ? `（${b.warn.join('；')}）` : ''}`);
    await ui.tab('tds');
    await ui.press(S.AUTOSET);
    await seq(S, 'MEAS O1 O2 O2 O2 O2 O5');
    await seq(S, 'O2 O1 O2 O2 O2 O2 O5');
    let t = await ui.snap('tds');
    T.near(volts(t.meas[0].text), vA, 0.02, `麵包板 RC：示波器 CH1 Pk-Pk ≈ ${vA.toFixed(3)} V（${t.meas[0].text}）`);
    T.near(volts(t.meas[1].text), vB, 0.02, `麵包板 RC：示波器 CH2 Pk-Pk ≈ ${vB.toFixed(3)} V（${t.meas[1].text}）`);
    await ui.tab('dmm');
    await ui.press('DMM.KEY.ACV');
    const acv = (await ui.snap('dmm')).view.value;
    T.near(acv, 0.5897523, 1e-3, `麵包板 RC：電表 ACV 與固定 RC 板相同（${acv}）`);
    await ui.shot('breadboard-rc-measure');

    // 常見錯誤：跳線把電容所在的第 12 欄接到−軌（地）→ 電容被短路
    await ui.tab('bench');
    await p.check('input[name="bbtool"][value="W"]');
    await hole('e12'); await hole('T-20');
    b = await ui.snap('bench');
    T.ok(b.warn.some((x) => x.includes('C1') && x.includes('短路')), `跳線把電容兩腳接在一起：提醒電容被短路（${b.warn.join('；')}）`);
    await ui.tab('dmm'); await sleep(300);
    T.ok(Math.abs((await ui.snap('dmm')).view.value) < 1e-3, '電容被短路：電表 ACV 讀到 0');
    await ui.tab('tds'); await ui.press(S.MEAS);
    t = await ui.snap('tds');
    T.ok(volts(t.meas[1].text) < 0.05, `電容被短路：示波器 CH2 看到 0（${t.meas[1].text}）`);

    // GPE 分壓：示範 → GPE CH1 設約 5 V → Output ON → 電表 DCV 讀 R2
    await ui.tab('bench');
    await p.click('[data-bb="demo-gpe"]');
    await ui.tab('gpe');
    await sleep(250); await ui.dragKnob('GPE.KNOB.CH1_VOLTAGE', 6);
    const vset = (await ui.snap('gpe')).vset[1];
    await ui.press('GPE.KEY.OUTPUT_ON_OFF');
    const Rp = (1000 * 10e6) / (1000 + 10e6); // R2 ∥ 電表 DCV 10 MΩ
    const g = await ui.snap('gpe');
    T.ok(vset > 0.5 && g.load === 'bench' && !g.readback[1].cc && Math.abs(g.readback[1].i - vset / (1000 + Rp)) < 2e-6,
      `GPE 設 ${vset} V、Output ON：讀回 CV ${g.readback[1].i.toFixed(4)} A（電路算出）`);
    await ui.tab('dmm'); await ui.press('DMM.KEY.DCV'); await sleep(400);
    const dcv = (await ui.snap('dmm')).view.value;
    T.near(dcv, (vset * Rp) / (1000 + Rp), 1e-3, `電表 DCV 讀 R2 兩端 ≈ ${(vset / 2).toFixed(3)} V（${dcv}）`);
    await ui.tab('bench');
    await ui.shot('breadboard-gpe-measure');

    // 電源短路：把 GPE CH1 −線移到下方紅色＋軌
    await p.click('[data-lead="GPE.CH1-"]'); await hole('B+27');
    b = await ui.snap('bench');
    const g2 = await ui.snap('gpe');
    T.ok(b.warn.some((x) => x.includes('GPE CH1') && x.includes('短路')) && g2.readback[1].cc && g2.readback[1].v < 1e-6,
      `GPE ＋－接在一起：提醒電源短路，GPE 進入 CC、端電壓 0（${JSON.stringify(g2.readback[1])}）`);
    T.ok(ui.errors.length === 0, `沒有瀏覽器程式錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally { await ui.close(); }
  return T;
}
