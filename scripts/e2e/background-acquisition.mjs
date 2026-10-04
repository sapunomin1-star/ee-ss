import { openApp, Check, sleep } from './lib.mjs';

export async function run() {
  const T = new Check('跨分頁背景採集'), ui = await openApp();
  const key = (id) => ui.press(id.startsWith('S') && /^S\d$/.test(id) ? `DMM.SOFT.${id}` : `DMM.KEY.${id}`);
  try {
    await ui.tab('dmm');
    await ui.page.check('input[name=scen][value=dcv]');
    await key('SHIFT'); await key('NULL'); await key('S3'); await key('S1'); await key('S6');
    const before = (await ui.snap('dmm')).view.stats.count;
    await ui.tab('afg');
    // No meter snapshot, LCD or status reads while another instrument is shown.
    await sleep(1600);
    const after = await ui.snap('dmm');
    T.ok(after.view.stats.count >= before + 5, '切到AFG後電表仍累積實際定時讀值');
    T.near(after.view.stats.mean, 1.234, 1e-10, '背景Statistics保持相容輸入的平均值');
    await ui.tab('dmm'); await key('SHIFT'); await key('SINGLE');
    await ui.tab('tds'); await sleep(900);
    const probe = await ui.snap('dmm');
    T.ok(probe.probeHold && probe.view.probe.length === 1, '操作示波器時Probe Hold仍捕獲穩定輸入');
    await ui.tab('dmm'); await key('SHIFT'); await key('SINGLE'); await key('RUN_STOP');
    const stopped = (await ui.snap('dmm')).view.stats.count;
    await ui.tab('gpe'); await sleep(700);
    T.ok((await ui.snap('dmm')).view.stats.count === stopped, '停止量測後跨分頁不再新增樣本');
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}
if (process.argv[1]?.endsWith('/background-acquisition.mjs')) { const T = await run(); T.print(); if (T.fail) process.exitCode = 1; }
