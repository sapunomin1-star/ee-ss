// 獨立補驗：用真面板／接線 UI 重現審查問題；__eess 僅讀取斷言資料。
import { openApp, Check, sleep } from './lib.mjs';

export async function run() {
  const T = new Check('RC 接線與採集恢復');
  const ui = await openApp();
  const p = ui.page;
  const key = (id) => ui.press(id);
  const afgKeys = async (...ids) => { for (const id of ids) await key(`AFG.${id}`); };
  const digits = async (value) => {
    for (const c of String(value)) await key(c === '.' ? 'AFG.NUM.DOT' : `AFG.NUM.DIGIT_${c}`);
  };
  const freq = async (value, unit = 'F3') => {
    await ui.tab('afg'); await afgKeys('KEY.FREQ_RATE'); await digits(value); await afgKeys(`SOFT.${unit}`);
  };
  const wire = async (lead, node) => { await p.locator(`[data-lead="${lead}"]`).click(); await p.locator(`[data-node="${node}"]`).click(); };
  const unplug = async (lead) => { await p.locator(`[data-lead="${lead}"]`).click(); await p.locator(`[data-lead="${lead}"]`).click(); };
  const autoFreq = (s) => s.autoMeas?.find((m) => m.type === 'FREQ')?.text;
  try {
    await ui.tab('bench');
    T.ok((await p.locator('.bench-svg').textContent()).includes('來源：單機情境（非接線）'), '未接線時，小螢幕明示是單機情境，避免把內建讀值誤認成電路結果');

    await ui.tab('afg');
    await afgKeys('KEY.PRESET', 'KEY.CH1_CH2', 'KEY.CH1_CH2', 'SOFT.F1', 'SOFT.F2', 'KEY.AMPL');
    await digits(2); await afgKeys('SOFT.F5', 'KEY.OUTPUT');
    await ui.tab('bench');
    await wire('AFG.CH2-', 'B');
    await p.getByRole('button', { name: '示範接線（看答案）', exact: true }).click();
    let b = await ui.snap('bench');
    T.ok(Object.keys(b.wires).length === 8 && !b.wires['AFG.CH2-'] && b.pp.B > 1.6, '示範接線移除額外 CH2 黑夾，電容不被殘留導線短路');
    // 舊版也繼續跑其他獨立案例，不能讓第一項問題遮住後續缺陷。
    if (b.wires['AFG.CH2-']) await unplug('AFG.CH2-');
    await ui.tab('dmm'); await key('DMM.KEY.ACV');
    T.near((await ui.snap('dmm')).view.value, 0.5902299, 0.001, 'ACV 量到預設 RC 的有效值');
    const status = await p.locator('.side dl.kv').innerText();
    T.ok(status.includes('實驗台接線') && !status.includes('未接（在下方選 D1 情境）'), 'DMM 狀態標出真正的實驗台來源');

    await ui.tab('afg'); await afgKeys('KEY.WAVEFORM', 'SOFT.F2');
    await freq(200);
    await ui.tab('tds'); await key('TDS.KEY.AUTOSET');
    let s = await ui.snap('tds');
    T.ok(autoFreq(s) === '200.0Hz' && s.autoMeas.every((m) => !m.text.includes('?')), '200 Hz 方波 AutoSet 後立即得到方波的自動量測（Pk-Pk／Mean／Period／Freq）');
    await ui.shot('review-rc-square-200hz');

    await key('TDS.KEY.RUN_STOP');
    const frozen = (await ui.snap('tds')).rec;
    await freq(400);
    s = await ui.snap('tds');
    T.ok(s.rec.n === frozen.n && JSON.stringify(s.rec.stats) === JSON.stringify(frozen.stats), 'Stop 後改 AFG 頻率：保留同一份採集');
    await ui.tab('tds'); await key('TDS.KEY.RUN_STOP'); await key('TDS.KEY.AUTOSET');
    T.ok(autoFreq(await ui.snap('tds')) === '400.0Hz', '恢復 Run 後讀取新頻率');

    await key('TDS.PWR.ON_OFF');
    await ui.tab('afg'); await afgKeys('KEY.OUTPUT');
    await ui.tab('bench'); await unplug('TDS.CH1.TIP');
    await ui.tab('tds'); await key('TDS.PWR.ON_OFF');
    s = await ui.snap('tds');
    // 關輸出後電容還在經探棒 10 MΩ 慢慢放電（τ≈0.3 s）：CH2 看到的是緩慢下降的直流（一筆紀錄內差幾 mV），不是原本 ±1 V 的方波
    T.ok(s.trig.freq === null && s.rec?.stats.every((r) => !r || Math.abs(r.max - r.min) < 0.05), `示波器關機中拔線及關訊號，開機不再採集舊波形（紀錄內起伏 ${s.rec?.stats.map((r) => (r ? (r.max - r.min).toExponential(1) : '-')).join('／')} V）`);
    await ui.tab('bench'); await wire('TDS.CH1.TIP', 'A');
    await ui.tab('afg'); await afgKeys('KEY.OUTPUT');
    await ui.tab('tds'); await key('TDS.KEY.AUTOSET');
    T.ok(autoFreq(await ui.snap('tds')) === '400.0Hz', '接回探棒並開 OUTPUT 後可恢復量測，不需重載');

    await ui.tab('afg'); await afgKeys('KEY.DC_OFFSET'); await digits(1); await afgKeys('SOFT.F2');
    await ui.tab('dmm'); await key('DMM.KEY.DCV');
    // DCV 每筆讀值是 10 PLC（1/6 秒）積分：等下一筆；400 Hz 方波在積分窗裡不是整數週期，讀值會有幾 mV 的起伏（真機也會）
    await sleep(450);
    T.near((await ui.snap('dmm')).view.value, 1, 0.01, 'DMM DCV 讀電容平均值 +1 V');
    await ui.tab('bench'); await wire('DMM.HI', 'G'); await wire('DMM.LO', 'B');
    await ui.tab('dmm'); await sleep(450);
    T.near((await ui.snap('dmm')).view.value, -1, 0.01, '反接表筆時 DCV 符號反轉');
    await ui.tab('bench'); await unplug('DMM.LO');
    await ui.tab('dmm');
    T.ok((await ui.snap('dmm')).view.state === 'none', '拔掉 LO 後不沿用先前電壓讀值');

    // 在 UI 可選範圍內，高 τ／高頻不能憑空產生 DC。
    await ui.tab('bench');
    await p.getByRole('button', { name: '示範接線（看答案）', exact: true }).click();
    await p.locator('select[name="R"]').selectOption('100000');
    await p.locator('select[name="C"]').selectOption('0.00001');
    await ui.tab('afg'); await afgKeys('KEY.DC_OFFSET'); await digits(0); await afgKeys('SOFT.F2');
    await afgKeys('KEY.WAVEFORM', 'SOFT.F4', 'SOFT.F1'); await digits(30); await afgKeys('SOFT.F2');
    await freq(999, 'F4');
    await ui.tab('dmm'); await key('DMM.KEY.DCV');
    // 換成 τ≈1 s 時電容還帶著換之前的電壓，要幾秒才放完（真實行為）；這裡檢查的是週期穩態本身沒有假直流
    const bs = await ui.snap('bench');
    T.near(bs.ssMean.B, 0, 2e-6, '100 kΩ／10 µF、999 kHz Ramp 的週期穩態 DC 保持零，不產生假直流');
    await sleep(600);
    T.ok(Math.abs((await ui.snap('bench')).dev) < Math.abs(bs.dev) || Math.abs(bs.dev) < 1e-6, '電容偏離穩態的電壓隨時間衰減（暫態）');
    T.ok(ui.errors.length === 0, '沒有瀏覽器程式錯誤');
  } finally { await ui.close(); }
  return T;
}
