// 2026-09-30 外部審查修正的真 UI 驗收：窄脈衝有效值與峰值升檔、電容暫態（充電、關輸出後保有電荷）、畫面自動更新。
// 只用真點擊／按鍵／選單操作；__eess 只讀狀態做斷言。
import { openApp, Check, sleep } from './lib.mjs';

export async function run() {
  const T = new Check('審查修正：窄脈衝、峰值量程、電容暫態');
  const ui = await openApp();
  const p = ui.page;
  const afg = async (...ids) => { for (const id of ids) await ui.press(`AFG.${id}`); };
  const digits = async (v) => { for (const c of String(v)) await ui.press(c === '.' ? 'AFG.NUM.DOT' : `AFG.NUM.DIGIT_${c}`); };
  const dmmValue = async () => (await ui.snap('dmm')).view?.value;
  try {
    // AFG：High Z、2 Vpp、1 kHz 方波、輸出 ON
    await ui.tab('afg');
    await afg('KEY.PRESET', 'KEY.CH1_CH2', 'KEY.CH1_CH2', 'SOFT.F1', 'SOFT.F2', 'KEY.AMPL');
    await digits(2); await afg('SOFT.F5', 'KEY.WAVEFORM', 'SOFT.F2', 'KEY.OUTPUT');
    // 實驗台：示範接線，改成高通 100 Ω／1 nF（τ＝150 ns，比 1 kHz 每週期 4000 點的取樣間隔 250 ns 還短）
    await ui.tab('bench');
    await p.getByRole('button', { name: '示範接線（看答案）', exact: true }).click();
    await p.locator('select[name="topo"]').selectOption('CR');
    await p.locator('select[name="R"]').selectOption('100');
    await p.locator('select[name="C"]').selectOption('1e-9');
    await ui.tab('dmm'); await ui.press('DMM.KEY.ACV');
    const V0 = (2 * 100) / 150, ideal = Math.sqrt((2 * V0 * V0 * 150e-9) / 2 / 1e-3);
    T.near(await dmmValue(), ideal, ideal * 0.01, `窄脈衝 ACV＝解析值 ${(ideal * 1e3).toFixed(2)} mV（修正前取樣算成 30.36 mV）`);
    const d = await ui.snap('dmm');
    T.ok(d.range === '1V', `峰值 1.33 V 超過 100 mV 檔的峰值容量：自動量程停在 1 V（${d.range}）`);
    const side = await p.locator('.side dl.kv').innerText();
    T.ok(side.includes('規格外') && side.includes('峰值因數'), '儀器外標示峰值因數超出規格');

    // 電容暫態：低通 100 kΩ／10 µF（τ≈1 s），加 1 V DC 偏移 → 電表 DCV 慢慢爬升，畫面自己更新
    await ui.tab('bench');
    await p.locator('select[name="topo"]').selectOption('RC');
    await p.locator('select[name="R"]').selectOption('100000');
    await p.locator('select[name="C"]').selectOption('0.00001');
    await ui.tab('dmm'); await ui.press('DMM.KEY.DCV');
    await sleep(8000); // 先讓換元件留下的電荷放掉（約 8τ）
    await ui.tab('afg'); await afg('KEY.WAVEFORM', 'SOFT.F1', 'KEY.DC_OFFSET'); await digits(1); await afg('SOFT.F2');
    await ui.tab('dmm');
    await sleep(500);
    const lcd1 = await ui.lcdText(), v1 = await dmmValue();
    await sleep(1000);
    const lcd2 = await ui.lcdText(), v2 = await dmmValue();
    const final = 10e6 / (10e6 + 100e3 + 50); // 電表 DCV 10 MΩ 與 R 分壓
    T.ok(v1 > 0.2 && v1 < v2 && v2 < final, `DC 偏移改 1 V 後電容電壓慢慢上升：0.5 s ${v1?.toFixed(3)} V → 1.5 s ${v2?.toFixed(3)} V（終值約 ${final.toFixed(3)} V）`);
    T.ok(lcd1 !== lcd2, '沒有按任何鍵，電表 LCD 自己更新讀值');
    await ui.shot('audit-transient');

    // 關 OUTPUT：電容保有電荷，只經儀器輸入電阻慢慢放電（τ 約 30 秒）
    await sleep(4000);
    const held = await dmmValue();
    await ui.tab('afg'); await afg('KEY.OUTPUT');
    await ui.tab('dmm'); await sleep(700);
    const after = await dmmValue();
    T.ok(held > 0.9 && after > 0.9 * held && after < held, `關 OUTPUT 後電容仍有電：${held.toFixed(3)} V → 0.7 s 後 ${after.toFixed(3)} V`);
    const b = await ui.snap('bench');
    T.ok(b.tau > 20 && b.tau < 50, `放電時間常數＝C×(電表 10 MΩ ∥ 探棒…)，約 ${b.tau.toFixed(1)} s`);

    // 修正後複核的重現：暫態很快結束（100 Ω／1 nF）時關 OUTPUT，電表 LCD 要更新到新讀值，不能停在舊值
    await ui.tab('bench');
    await p.locator('select[name="R"]').selectOption('100');
    await p.locator('select[name="C"]').selectOption('1e-9');
    await ui.tab('afg'); await afg('KEY.OUTPUT');
    await ui.tab('dmm'); await sleep(600);
    const onText = await ui.lcdText();
    await ui.tab('afg'); await afg('KEY.OUTPUT');
    await ui.tab('dmm'); await sleep(900);
    const d2 = await ui.snap('dmm'), lcd = await ui.lcdText();
    // 開輸出時讀值≈1 V（1 kHz 正弦疊 1 V 直流，10 PLC 積分窗會有 ±2 mV 起伏，不能用字串比）
    const onValue = Number((onText.match(/[+-]\d[\d .]*/)?.[0] ?? 'NaN').replace(/\s/g, ''));
    T.ok(Math.abs(onValue - 1) < 0.01 && lcd.includes(d2.view.text) && Math.abs(d2.view.value) < 1e-3,
      `關 OUTPUT 900 ms 後 LCD 已更新（${lcd.match(/[+-][\d. ]+/)?.[0]}，模型 ${d2.view.text}）`);
    T.ok(ui.errors.length === 0, `沒有瀏覽器程式錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally { await ui.close(); }
  return T;
}
