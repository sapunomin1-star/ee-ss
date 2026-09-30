// 實驗台真 UI：照學生流程——設 AFG → 在實驗台點擊接線 → 示波器 AutoSet／Measure → 電表 ACV，讀值與理論值比對；
// 再示範常見錯誤（接地夾夾在 B、拔掉黑夾）與恢復。
import { openApp, Check, sleep } from './lib.mjs';

const A = {
  PRESET: 'AFG.KEY.PRESET', CH: 'AFG.KEY.CH1_CH2', AMPL: 'AFG.KEY.AMPL', FREQ: 'AFG.KEY.FREQ_RATE', OUT: 'AFG.KEY.OUTPUT',
  F1: 'AFG.SOFT.F1', F2: 'AFG.SOFT.F2', F4: 'AFG.SOFT.F4', F5: 'AFG.SOFT.F5',
};
const S = {
  AUTOSET: 'TDS.KEY.AUTOSET', MEAS: 'TDS.KEY.MEASURE', O1: 'TDS.SOFT.OPT1', O2: 'TDS.SOFT.OPT2', O5: 'TDS.SOFT.OPT5',
};

// 理論值（與模擬相同的模型）：EMF 2 Vpp、50 Ω 內阻、R 1 kΩ、C 100 nF、1 kHz
const R = 1000, C = 100e-9, f = 1000, w = 2 * Math.PI * f, Xc = 1 / (w * C);
const vA = 2 * Math.hypot(R, Xc) / Math.hypot(R + 50, Xc);
const vB = 2 * Xc / Math.hypot(R + 50, Xc);

export async function run() {
  const T = new Check('實驗台 AFG→RC→示波器＋電表');
  const ui = await openApp();
  const p = ui.page;
  const seq = async (map, s) => {
    for (const t of s.split(/\s+/).filter(Boolean)) {
      if (/^[\d.]+$/.test(t)) { for (const ch of t) await ui.press(ch === '.' ? 'AFG.NUM.DOT' : `AFG.NUM.DIGIT_${ch}`); } else await ui.press(map[t]);
    }
  };
  const wire = async (lead, node) => { await p.click(`[data-lead="${lead}"]`); await sleep(20); await p.click(`[data-node="${node}"]`); await sleep(20); };
  const volts = (txt) => { const m = String(txt).match(/(-?[\d.]+)\s*(m?)V/); return m ? Number(m[1]) * (m[2] ? 1e-3 : 1) : NaN; };
  try {
    // 1. AFG：Preset → CH 選單（按兩下回 CH1）→ Load High Z → 2 VPP、1 kHz → OUTPUT
    await ui.tab('afg');
    await seq(A, 'PRESET CH CH F1 F2 AMPL 2 F5 FREQ 1 F4 OUT');
    const afg = (await ui.snap('afg')).ch[0];
    T.ok(!afg.load50 && Math.abs(afg.emfVpp - 2) < 1e-9 && afg.freq === 1000 && afg.output, 'AFG：High Z、2 Vpp（EMF 2 Vpp）、1 kHz、輸出 ON');

    // 2. 實驗台：逐條點擊接線
    await ui.tab('bench');
    await wire('AFG.CH1+', 'A'); await wire('AFG.CH1-', 'G');
    await wire('TDS.CH1.TIP', 'A'); await wire('TDS.CH1.GND', 'G');
    await wire('TDS.CH2.TIP', 'B'); await wire('TDS.CH2.GND', 'G');
    await wire('DMM.HI', 'B'); await wire('DMM.LO', 'G');
    let b = await ui.snap('bench');
    T.ok(Object.keys(b.wires).length === 8 && b.wires['TDS.CH2.TIP'] === 'B', '點擊接線：8 條線都接上');
    T.ok(b.warn.length === 0, `接線沒有警告${b.warn.length ? `：${b.warn.join('；')}` : ''}`);
    T.ok((await ui.snap('tds')).scenario === 'BENCH' && (await ui.snap('dmm')).fixture === 'bench', '探棒與測試線接上後，示波器與電表自動改用實驗台訊號');
    await ui.shot('bench-wired');

    // 3. 示波器：AutoSet → Measure 1＝CH1 Pk-Pk、Measure 2＝CH2 Pk-Pk
    await ui.tab('tds');
    await ui.press(S.AUTOSET);
    let t = await ui.snap('tds');
    T.ok(t.ch[0].on && t.ch[1].on && t.status === "Trig'd", 'AutoSet：CH1、CH2 都顯示、已觸發');
    await seq(S, 'MEAS O1 O2 O2 O2 O2 O5');
    await seq(S, 'O2 O1 O2 O2 O2 O2 O5');
    t = await ui.snap('tds');
    const m1 = volts(t.meas[0].text), m2 = volts(t.meas[1].text);
    T.near(m1, vA, 0.02, `示波器 CH1 Pk-Pk ≈ 理論 ${vA.toFixed(3)} V（${t.meas[0].text}）`);
    T.near(m2, vB, 0.02, `示波器 CH2 Pk-Pk ≈ 理論 ${vB.toFixed(3)} V（${t.meas[1].text}）`);
    await ui.shot('bench-tds');

    // 4. 電表：ACV 讀電容電壓有效值
    await ui.tab('dmm');
    await ui.press('DMM.KEY.ACV');
    const d = await ui.snap('dmm');
    T.near(d.view.value, vB / (2 * Math.SQRT2), 1e-3, `電表 ACV ≈ 理論 ${(vB / (2 * Math.SQRT2)).toFixed(4)} Vrms（LCD ${d.view.text}）`);
    await ui.shot('bench-dmm');

    // 5. 常見錯誤：示波器 CH2 接地夾夾在 B → 電容被短路
    await ui.tab('bench');
    await wire('TDS.CH2.GND', 'B');
    b = await ui.snap('bench');
    T.ok(b.warn.some((x) => x.includes('接地夾') && x.includes('B')), '接地夾夾在 B：實驗台警告');
    T.ok(b.pp.B < 1e-6, 'B 點被接到大地，電壓變 0');
    await ui.shot('bench-mistake');
    await ui.tab('tds');
    await ui.press(S.MEAS);
    t = await ui.snap('tds');
    T.ok(volts(t.meas[1].text) < 0.05 || t.meas[1].text === '?' || t.meas[1].text === '', `示波器 CH2 看到的電容電壓變成 0（${t.meas[1].text}）`);
    // 恢復
    await ui.tab('bench');
    await wire('TDS.CH2.GND', 'G');
    T.ok((await ui.snap('bench')).warn.length === 0 && (await ui.snap('bench')).pp.B > 1.5, '接地夾改回 G：恢復正常');

    // 6. 量電阻：通電中拒絕；關 AFG 輸出後把電表跨在 R（A–B）量到 1 kΩ
    await ui.tab('dmm');
    await ui.press('DMM.KEY.OHM_2W');
    T.ok((await ui.snap('dmm')).view.state === 'none' && (await ui.hint()).includes('通電'), '通電中按 Ω 2W：沒有讀值並說明要先關輸出');
    await ui.tab('afg'); await ui.press(A.OUT);
    await ui.tab('bench'); await wire('DMM.HI', 'A'); await wire('DMM.LO', 'B');
    await ui.tab('dmm');
    // 示波器兩支探棒（各 10 MΩ 對地）還接在 A、B：量到的是 1 kΩ ∥ 20 MΩ（真機也一樣）
    T.near((await ui.snap('dmm')).view.value, (1000 * 20e6) / (20e6 + 1000), 1e-6, '關輸出後電表跨在 R 兩端：1 kΩ ∥ 探棒 20 MΩ ≈ 999.95 Ω');
    T.ok(ui.errors.length === 0, `沒有 JS 錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally {
    await ui.close();
  }
  return T;
}
