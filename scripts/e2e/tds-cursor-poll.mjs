// A normal 200 ms background poll must not publish an already-expired Auto wait.
// Configuration uses real UI/setup files; the debug hook is only read.
import fs from 'node:fs/promises';
import { openApp, Check } from './lib.mjs';
import { setupRC } from './rc-ui.mjs';

export async function run() {
  const T = new Check('Auto：200 ms 採集更新後操作 Cursor'), ui = await openApp(), p = ui.page;
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
    await setupRC(ui, { R: 100000, C: .00001 });

    await ui.tab('tds'); await scope('SAVE_RECALL'); await opt(2);
    const downloadWait = p.waitForEvent('download'); await opt(5);
    const download = await downloadWait, setup = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    const state = setup.state;
    Object.assign(state, { sIdx: 14, mpos: 0, run: 'run' });
    state.ch.forEach((c) => Object.assign(c, { on: true, probe: 10, vIdx: 6, pos: 0, coupling: 'DC', bw: false }));
    Object.assign(state.trig, { src: 0, level: .2, mode: 'AUTO', coup: 'DC', slope: 'R' });
    state.extended.acquire = 'SAMPLE'; state.extended.horizontal.view = 'MAIN'; state.extended.autoRange.on = false;
    while ((await ui.snap('tds')).extended.store.action !== 'RECALL_SETUP') await opt(1);
    const chooserWait = p.waitForEvent('filechooser'); await opt(5);
    await (await chooserWait).setFiles({ name: 'cursor-poll.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(setup)) });
    await p.locator('.hintbar').filter({ hasText: /已回復|已載入/ }).waitFor();
    await ui.tab('afg'); await afg('KEY.OUTPUT'); await ui.tab('tds');

    for (let poll = 1; poll <= 3; poll++) {
      await p.clock.runFor(200);
      const before = await ui.snap('tds'), points = await wave();
      const now = await p.evaluate(() => performance.now() / 1000);
      T.ok(before.rec?.triggered && !before.pendingAcquisition && before.status === "Trig'd", `第 ${poll} 次 200 ms 定時更新完成實際觸發紀錄`);
      T.ok(before.rec.endAt < now - .05, `第 ${poll} 筆歷史樣本比發布時刻早超過 50 ms`);
      await scope('CURSOR');
      if (poll === 1) { await opt(1); await opt(4); }
      await p.locator('[data-id="TDS.KNOB.MULTIPURPOSE"]').focus(); await p.keyboard.press('ArrowUp');
      const after = await ui.snap('tds');
      T.ok(after.rec.n === before.rec.n && after.rec.triggered && after.status === "Trig'd", `第 ${poll} 次 Cursor 操作保留有效觸發紀錄與狀態`);
      T.ok(await wave() === points, `第 ${poll} 次游標操作保留原本 LCD 波形`);
    }
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤：${ui.errors.join('; ')}`);
    await ui.shot('tds-cursor-poll');
  } finally { await ui.close(); }
  return T;
}

if (process.argv[1]?.endsWith('/tds-cursor-poll.mjs')) { const T = await run(); T.print(); if (T.fail) process.exitCode = 1; }
