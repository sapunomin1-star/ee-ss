// 在家實驗的儀器回歸：所有設定使用真按鍵／鍵盤，__eess 只讀。
import { openApp, Check } from './lib.mjs';
import fs from 'node:fs/promises';
import { validateSession } from '../../src/core/session.js';

const A = {
  PRESET: 'AFG.KEY.PRESET', FREQ: 'AFG.KEY.FREQ_RATE', AMPL: 'AFG.KEY.AMPL', OFFSET: 'AFG.KEY.DC_OFFSET',
  CH: 'AFG.KEY.CH1_CH2', LEFT: 'AFG.KEY.ARROW_LEFT', OUT: 'AFG.KEY.OUTPUT',
  F1: 'AFG.SOFT.F1', F2: 'AFG.SOFT.F2', F4: 'AFG.SOFT.F4', F5: 'AFG.SOFT.F5',
};

export async function run() {
  const T = new Check('在家實驗：游標、低頻 AutoSet、採集恢復、Set View');
  const ui = await openApp(), p = ui.page;
  const keys = (seq) => ui.keys('AFG', A, seq);
  const turn = async (id, ticks) => {
    await p.locator(`[data-id="${id}"]`).focus();
    for (let n = 0; n < Math.abs(ticks); n++) await p.keyboard.press(ticks > 0 ? 'ArrowUp' : 'ArrowDown');
  };
  const underline = () => p.locator('svg.screen rect[y="226"][height="2"][fill="#d00000"]').count();
  const tds = (id) => ui.press(`TDS.${id}`);
  const now = () => p.evaluate(() => performance.now() / 1000);
  try {
    // 重新載入之前安裝時鐘，讓應用程式的 performance、Date 與定時更新一起受控。
    const epoch = Date.now();
    await p.clock.install({ time: epoch });
    await p.reload(); await p.locator('svg.panel').waitFor();
    await p.clock.pauseAt(epoch + 1000);

    await ui.tab('afg');
    await keys('PRESET FREQ LEFT LEFT');
    T.ok((await ui.snap('afg')).cursorExp === 3 && await underline() === 1,
      '1 kHz 連按左鍵兩次：游標停在最大可見位，編輯框底線仍可見');
    await turn('AFG.KNOB.SCROLL_WHEEL', 1);
    T.near((await ui.snap('afg')).ch[0].freq, 2000, 1e-12, '真鍵盤轉一格：1 kHz → 2 kHz');
    T.ok(await underline() === 1, '旋鈕操作後底線仍在編輯框內');
    await ui.shot('home-instruments-afg-cursor');

    await keys('PRESET FREQ 1 F2 OUT'); // 1 mHz，輸出接到固定 RC 示範板。
    await ui.tab('bench');
    await p.check('input[name="board"][value="rc"]');
    await p.getByRole('button', { name: '示範接線（看答案）', exact: true }).click();
    await p.locator('select[name="R"]').selectOption('1000');
    await p.locator('select[name="C"]').selectOption('0.00001');
    await ui.tab('tds'); await tds('KEY.AUTOSET');
    T.near((await ui.snap('tds')).sdiv, 50, 1e-12, '實驗台 1 mHz AutoSet：選最大 50 s/div');
    T.ok((await ui.hint()).includes('訊號太慢'), 'AutoSet 清楚提示画面不足兩個週期');
    T.ok(await p.locator('svg.screen .wave').count() > 0 && !(await ui.lcdText()).includes('NaN'),
      '低頻 AutoSet 後 LCD 仍可繪製波形與刻度');
    await ui.shot('home-instruments-low-frequency');

    // 2 mVpp＋1 V DC；High Z 參照對應 1 V 的實際階躍，RC 約 10.5 ms。
    await ui.tab('afg');
    await keys('PRESET CH CH F1 F2 AMPL 0.002 F5 OFFSET 1 F2');
    await ui.tab('tds');
    await tds('KEY.DEFAULT_SETUP'); await tds('KEY.CH2_MENU');
    await turn('TDS.KNOB.CH2_VOLTS_DIV', 2);
    await turn('TDS.KNOB.HORIZ_SCALE', 6);
    await tds('KEY.TRIG_MENU'); await tds('SOFT.OPT2'); await tds('SOFT.OPT4');
    await turn('TDS.KNOB.TRIG_LEVEL', 125);
    const config = await ui.snap('tds');
    T.ok(config.trig.src === 1 && config.trig.mode === 'NORMAL' && Math.abs(config.trig.levelV - 0.5) < 1e-9 && config.sdiv === 0.005,
      '真面板設定 CH2／Normal／上升 0.5 V／5 ms/div');

    for (const action of ['Stop', 'Power']) {
      // 在恢復採集之前確保電容為零；Output OFF 會浮接，所以先用接通的 0 V 經 R 放電。
      await ui.tab('afg');
      if (!(await ui.snap('afg')).ch[0].output) await keys('OUT');
      await keys('OFFSET 0 F2'); await p.clock.runFor(1000);
      await keys('OUT OFFSET 1 F2');
      await ui.tab('tds');
      const key = action === 'Stop' ? 'KEY.RUN_STOP' : 'PWR.ON_OFF';
      await tds(key);
      const stopped = await ui.snap('tds');
      await p.clock.runFor(1000);
      await ui.tab('afg'); await keys('OUT');
      await p.clock.runFor(1000); // 整個交越發生於停止／關機期間。
      T.ok((await ui.snap('tds')).acqN === stopped.acqN, `${action} 期間 RC 充電不產生新採集`);
      await ui.tab('tds'); await tds(key);
      const resumed = await ui.snap('tds');
      T.ok(resumed.acqN === stopped.acqN && (action === 'Power' ? resumed.rec === null : resumed.rec?.n === stopped.rec?.n),
        `${action} 恢復時不補抓早已錯過的交越`);
      await ui.tab('afg'); await keys('OFFSET 0 F2'); await p.clock.runFor(1000);
      await keys('OFFSET 1 F2');
      const eventAt = await now();
      await p.clock.runFor(250);
      const fresh = await ui.snap('tds');
      T.ok(fresh.acqN === resumed.acqN + 1 && fresh.rec?.triggered && fresh.rec.abs0 >= eventAt && fresh.rec.abs0 <= await now(),
        `${action} 恢復後新的 RC 上升沿仍可正常擷取`);
      await ui.tab('tds'); await ui.shot(`home-instruments-tds-${action.toLowerCase()}`);
    }

    // 大位置偏移後 AutoSet 的新刻度也必須能保存／載入。
    await ui.tab('bench');
    await p.selectOption('select[name="px1"]', '1');
    await ui.tab('afg');
    await keys('PRESET CH CH F1 F2 AMPL 0.002 F5 OFFSET');
    await ui.press('AFG.NUM.PLUS_MINUS'); await keys('9.998 F2 OUT');
    await ui.tab('tds'); await tds('KEY.DEFAULT_SETUP');
    await tds('KEY.CH1_MENU'); await tds('SOFT.OPT4');
    await turn('TDS.KNOB.MULTIPURPOSE', -1); // 10X -> 1X
    await tds('SOFT.OPT5');
    await turn('TDS.KNOB.CH1_VOLTS_DIV', -2); // 0.1 -> 0.5 V/div
    await ui.dragKnob('TDS.KNOB.CH1_POSITION', 1250); // 1250 * 1/25 div
    const largePos = await ui.snap('tds');
    T.ok(largePos.ch[0].vdiv === 0.5 && largePos.ch[0].pos === 50,
      '真拖曳旋鈕設定合法的 0.5 V/div、Position +50 div');
    await tds('KEY.AUTOSET');
    const adjusted = await ui.snap('tds');
    T.ok(adjusted.ch[0].pos === 0 && adjusted.ch[0].vdiv === 5,
      'AutoSet 新刻度無法保留原位置時，歸零並選合法的 5 V/div');
    const download = p.waitForEvent('download');
    await p.click('[data-session="export"]');
    const file = await download, exported = await fs.readFile(await file.path(), 'utf8');
    T.ok(validateSession(JSON.parse(exported)).instruments.tds.ch[0].pos === 0,
      '大位置偏移 AutoSet 的匯出檔通過嚴格存檔驗證');
    const chooser = p.waitForEvent('filechooser');
    await p.click('[data-session="import"]');
    await (await chooser).setFiles({ name: 'autoset.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
    await p.locator('.hintbar').filter({ hasText: '已載入實驗' }).waitFor();
    T.ok((await ui.snap('tds')).ch[0].pos === 0 && (await ui.snap('tds')).ch[0].vdiv === 5,
      'AutoSet 匯出檔可從真選檔流程載入');

    await ui.tab('gpe');
    await p.check('input[name="scen"][value="open"]');
    await ui.press('GPE.KEY.OUTPUT_ON_OFF'); await ui.press('GPE.KEY.SET_VIEW');
    T.ok((await ui.snap('gpe')).setView && (await p.locator('dl.kv').innerText()).includes('Set View 中'),
      'Set View 開始時 LCD 與側欄一致');
    await p.clock.runFor(3300);
    const visible = await p.$$eval('svg.screen [data-row="1"]', (els) => els
      .filter((el) => getComputedStyle(el).visibility === 'visible').map((el) => el.dataset.mode));
    T.ok(!(await ui.snap('gpe')).setView && !(await p.locator('dl.kv').innerText()).includes('Set View 中') && visible.includes('CV'),
      '3 秒無操作逾時：LCD 回讀回值，側欄也清除 Set View 中');
    await ui.shot('home-instruments-gpe-timeout');
    T.ok(ui.errors.length === 0, `沒有瀏覽器程式錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally { await ui.close(); }
  return T;
}
