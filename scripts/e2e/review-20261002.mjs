// 2026-10-02 審查反例的真 UI 回歸；狀態鉤子只讀，設定全用滑鼠／鍵盤。
import { openApp, Check, sleep } from './lib.mjs';
import { setupRC } from './rc-ui.mjs';

export async function run() {
  const T = new Check('2026-10-02：微赫茲、替換電容、慢充電 Single');
  const ui = await openApp(), p = ui.page;
  const afg = async (...ids) => { for (const id of ids) await ui.press(`AFG.${id}`); };
  const digits = async (value) => {
    for (const c of String(value)) await ui.press(c === '.' ? 'AFG.NUM.DOT' : `AFG.NUM.DIGIT_${c}`);
  };
  const turnKeys = async (id, ticks) => {
    await p.locator(`[data-id="${id}"]`).focus();
    for (let i = 0; i < Math.abs(ticks); i++) await p.keyboard.press(ticks > 0 ? 'ArrowUp' : 'ArrowDown');
  };
  try {
    await ui.tab('afg');
    await afg('KEY.FREQ_RATE'); await digits(1); await afg('SOFT.F1');
    await turnKeys('AFG.KNOB.SCROLL_WHEEL', 10);
    T.near((await ui.snap('afg')).ch[0].freq, 11e-6, 1e-12, '1 µHz 提交後不用移動游標，真鍵盤轉十格變 11 µHz');
    await ui.shot('review-20261002-afg-microhz');
    await afg('KEY.PRESET');

    await ui.tab('bench');
    await p.check('input[name="benchView"][value="breadboard"]');
    await p.click('[data-bb="demo-gpe"]');
    await p.check('input[name="bbtool"][value="C"]');
    await p.locator('select[name="bbC"]').selectOption('1e-7');
    await p.click('[data-hole="f22"]'); await p.click('[data-hole="f26"]');
    await ui.tab('gpe');
    await sleep(250); await ui.dragKnob('GPE.KNOB.CH1_VOLTAGE', 6);
    const vset = (await ui.snap('gpe')).vset[1];
    await ui.press('GPE.KEY.OUTPUT_ON_OFF'); await sleep(1100);
    const charged = await ui.snap('bench');
    const chargedV = charged.dcNow['22L'] - charged.dcNow['B-'];
    T.ok(vset > 0.5 && chargedV > 0.2, `GPE 分壓示範中插入 C1，確實充電（兩腳電壓 ${chargedV} V）`);
    await ui.tab('bench'); await p.click('[data-bb="demo-rc"]');
    const fresh = await ui.snap('bench');
    T.near(fresh.dcNow['12U'], 0, 1e-8, '替換成 RC 低通示範、AFG OFF：新 C1 從 0 V 開始');
    await sleep(150);
    T.near((await ui.snap('bench')).dcNow['12U'], 0, 1e-8, '150 ms 後新 C1 仍沒有憑空繼承電荷');
    await ui.shot('review-20261002-fresh-capacitor');

    // 同一麵包板 RC：100 kΩ／10 µF，2 mVpp＋1 V，先 Single 再開 Output。
    await setupRC(ui, { R: 100000, C: 0.00001 });
    await ui.tab('afg');
    await afg('KEY.CH1_CH2', 'KEY.CH1_CH2', 'SOFT.F1', 'SOFT.F2', 'KEY.AMPL');
    await digits(0.002); await afg('SOFT.F5', 'KEY.DC_OFFSET');
    await digits(1); await afg('SOFT.F2');
    await ui.tab('tds');
    await ui.press('TDS.KEY.DEFAULT_SETUP');
    await ui.press('TDS.KEY.CH2_MENU');
    await turnKeys('TDS.KNOB.CH2_VOLTS_DIV', 2);
    await turnKeys('TDS.KNOB.HORIZ_SCALE', 14);
    await ui.press('TDS.KEY.TRIG_MENU');
    await ui.press('TDS.SOFT.OPT2'); await ui.press('TDS.SOFT.OPT4');
    await turnKeys('TDS.KNOB.TRIG_LEVEL', 125);
    const settings = await ui.snap('tds');
    T.ok(Math.abs(settings.sdiv - 10e-6) < 1e-15 && Math.abs(settings.trig.levelV - 0.5) < 1e-9 && settings.trig.src === 1,
      '面板設定：10 µs/div、CH2、上升觸發 0.5 V');
    await ui.press('TDS.KEY.SINGLE');
    T.ok((await ui.snap('tds')).status === 'Ready', 'Output OFF 時 Single 等待觸發');
    await ui.tab('afg'); await afg('KEY.OUTPUT');
    await ui.tab('tds');
    const immediate = await ui.snap('tds'), actualNow = await p.evaluate(() => performance.now() / 1000);
    T.ok(immediate.status === 'Ready' || immediate.rec?.abs0 <= actualNow, '開輸出後 Single 不預先擷取尚未發生的交越');
    await ui.press('TDS.KEY.MEASURE');
    const afterMenu = await ui.snap('tds'), menuNow = await p.evaluate(() => performance.now() / 1000);
    T.ok(afterMenu.status === 'Ready' || afterMenu.rec?.abs0 <= menuNow, '等待交越時切換 MEASURE 選單也不能擷取未來事件');
    await sleep(1500);
    const captured = await ui.snap('tds');
    T.ok(captured.status === 'Acq. Complete' && captured.rec?.triggered, '慢充電越過 0.5 V：快時基 Single 完成採集');
    await ui.shot('review-20261002-slow-single');

    // 無電容的週期 GPE 限制：模型會切換，LCD 也必須在沒有操作時更新。
    await ui.tab('afg'); await afg('KEY.OUTPUT', 'KEY.AMPL');
    await digits(10); await afg('SOFT.F5', 'KEY.DC_OFFSET');
    await digits(5); await afg('SOFT.F2', 'KEY.FREQ_RATE');
    await digits(1); await afg('SOFT.F3');
    await ui.tab('bench');
    await p.check('input[name="benchView"][value="breadboard"]');
    await p.click('[data-bb="clear"]');
    for (const [lead, hole] of Object.entries({
      'GPE.CH1+': 'b5', 'GPE.CH1-': 'b10', 'GPE.GND': 'c10',
      'AFG.CH1+': 'd5', 'AFG.CH1-': 'd10', 'TDS.CH1.TIP': 'c5',
    })) { await p.click(`[data-lead="${lead}"]`); await p.click(`[data-hole="${hole}"]`); }
    await ui.tab('gpe'); await ui.press('GPE.KEY.OUTPUT_ON_OFF');
    let time = await p.evaluate(() => Date.now());
    await p.locator('[data-id="GPE.KNOB.CH1_CURRENT"]').focus();
    try {
      for (let i = 0; i < 90; i++) {
        await p.clock.setFixedTime(time += 200); await p.keyboard.press('ArrowDown');
      }
    } finally { await p.clock.setSystemTime(time + 200); }
    T.near((await ui.snap('gpe')).iset[1], 0.01, 1e-12, '真鍵盤設定 GPE 10 mA 限流');
    await ui.press('GPE.KEY.OUTPUT_ON_OFF');
    await ui.tab('afg'); await afg('KEY.OUTPUT');
    await ui.tab('gpe');
    const readings = [];
    for (let i = 0; i < 12; i++) {
      await sleep(210);
      readings.push(await p.$$eval('svg.screen [data-row="1"]', (els) => {
        const e = els.find((el) => getComputedStyle(el).visibility === 'visible');
        return e ? { v: Number(e.dataset.v), mode: e.dataset.mode } : { v: NaN, mode: 'missing', count: els.length };
      }));
    }
    // LCD 更新動畫偶爾會讓取樣落在暫時隱藏的一幀；至少六筆實際可見讀值仍須跨越兩種保護模式及電壓範圍。
    const visible = readings.filter((r) => Number.isFinite(r.v));
    T.ok(visible.length >= 6 && Math.max(...visible.map((r) => r.v)) > 7 && Math.min(...visible.map((r) => r.v)) < 2 && visible.some((r) => r.mode === 'CC') && visible.some((r) => r.mode === 'RB'),
      `無電容 AFG／GPE：未操作時 LCD 自己更新端電壓與 CC／逆灌（${JSON.stringify(readings)}）`);
    await ui.shot('review-20261002-periodic-gpe');
    T.ok(ui.errors.length === 0, `沒有瀏覽器程式錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally { await ui.close(); }
  return T;
}
