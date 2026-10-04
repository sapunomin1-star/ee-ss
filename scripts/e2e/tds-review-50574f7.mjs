// Real front-panel replay of the charging-Phase and Cursor/Auto regressions.
// Use a paused browser clock and the supported setup-file workflow; __eess is read-only.
import fs from 'node:fs/promises';
import { openApp, Check } from './lib.mjs';

export async function run() {
  const T = new Check('50574f7：充電 Phase 與 Auto 游標'), ui = await openApp(), p = ui.page;
  const scope = (id) => ui.press(`TDS.KEY.${id}`), opt = (n) => ui.press(`TDS.SOFT.OPT${n}`);
  const afg = (id) => ui.press(`AFG.${id}`);
  const digits = async (value) => { for (const c of String(value)) await afg(c === '.' ? 'NUM.DOT' : `NUM.DIGIT_${c}`); };
  const wave = () => p.locator('svg.screen .wave.ch1').getAttribute('points');
  try {
    const epoch = Date.now(); await p.clock.install({ time: epoch }); await p.reload();
    await p.locator('svg.panel').waitFor(); await p.clock.pauseAt(epoch + 1000);
    await ui.tab('afg');
    for (const id of ['KEY.PRESET', 'KEY.CH1_CH2', 'KEY.CH1_CH2', 'SOFT.F1', 'SOFT.F2', 'KEY.AMPL']) await afg(id);
    await digits(2); await afg('SOFT.F5'); await afg('KEY.DC_OFFSET'); await digits(2); await afg('SOFT.F2');
    await afg('KEY.FREQ_RATE'); await digits(1); await afg('SOFT.F4');
    await ui.tab('bench'); await p.getByRole('button', { name: '示範接線（看答案）', exact: true }).click();
    await p.locator('select[name="R"]').selectOption('100000');
    await p.locator('select[name="C"]').selectOption('0.00001');

    await ui.tab('tds'); await scope('SAVE_RECALL'); await opt(2);
    const downloadWait = p.waitForEvent('download'); await opt(5);
    const download = await downloadWait, setup = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    const state = setup.state;
    Object.assign(state, { sIdx: 14, mpos: 0, run: 'run' });
    state.ch.forEach((c) => Object.assign(c, { on: true, probe: 10, vIdx: 6, pos: 0, coupling: 'DC', bw: false }));
    Object.assign(state.trig, { src: 0, level: .2, mode: 'AUTO', coup: 'DC', slope: 'R' });
    state.meas = [{ src: 0, type: 'PHASE' }, { src: 0, type: 'DELAY' }, { src: 0, type: 'PERIOD' }, { src: 1, type: 'PERIOD' }, { src: 0, type: 'NONE' }];
    state.extended.acquire = 'SAMPLE'; state.extended.horizontal.view = 'MAIN'; state.extended.autoRange.on = false;
    while ((await ui.snap('tds')).extended.store.action !== 'RECALL_SETUP') await opt(1);
    const chooserWait = p.waitForEvent('filechooser'); await opt(5);
    await (await chooserWait).setFiles({ name: 'review-scope.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(setup)) });
    await p.locator('.hintbar').filter({ hasText: /已回復|已載入/ }).waitFor();

    await ui.tab('afg'); await afg('KEY.OUTPUT'); await p.clock.runFor(3);
    await ui.tab('tds'); await scope('MEASURE');
    const before = await ui.snap('tds'), points = await wave();
    T.ok(before.rec?.triggered && !before.pendingAcquisition && before.status === "Trig'd", '實際交越已完成採集，沒有待完成的後觸發樣本');
    T.ok(/\d/.test(before.meas[2].text) && !before.meas[2].text.includes('?') && before.meas[3].text === '?', 'CH1 有完整週期，CH2 仍只有充電曲線');
    T.ok(before.meas[0].text === '?' && before.meas[1].text === '?', 'Phase 與 Delay 拒絕未完整週期的 CH2');
    T.ok((await ui.lcdText()).includes('Phase?') && (await ui.lcdText()).includes('Delay?'), 'LCD 同步顯示無效 Phase／Delay');
    await scope('CURSOR'); await opt(1); await opt(4);
    await p.locator('[data-id="TDS.KNOB.MULTIPURPOSE"]').focus(); await p.keyboard.press('ArrowUp');
    const after = await ui.snap('tds');
    T.ok(after.rec.n === before.rec.n && after.rec.triggered && after.status === "Trig'd", 'Cursor 選單、軟鍵與旋鈕不會產生未觸發紀錄覆蓋原波形');
    T.ok(await wave() === points, '游標操作保留 LCD 原本的已觸發樣本');
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤：${ui.errors.join('; ')}`);
    await ui.shot('tds-review-50574f7');
  } finally { await ui.close(); }
  return T;
}

if (process.argv[1]?.endsWith('/tds-review-50574f7.mjs')) { const T = await run(); T.print(); if (T.fail) process.exitCode = 1; }
