import fs from 'node:fs/promises';
import { openApp, Check } from './lib.mjs';

export async function run() {
  const T = new Check('載入實驗清除示波器舊 Undo'), ui = await openApp(), p = ui.page;
  const key = (id) => ui.press(`TDS.KEY.${id}`);
  const undoRange = () => ui.press('TDS.SOFT.OPT5');
  const upload = async (content) => {
    const chooser = p.waitForEvent('filechooser');
    await p.click('[data-session="import"]');
    await (await chooser).setFiles({ name: 'scope-undo.json', mimeType: 'application/json', buffer: Buffer.from(content) });
  };
  try {
    await ui.tab('tds');
    await key('AUTOSET');
    await key('AUTORANGE'); await key('AUTORANGE');
    const downloading = p.waitForEvent('download');
    await p.click('[data-session="export"]');
    const exported = await fs.readFile(await (await downloading).path(), 'utf8');
    T.near((await ui.snap('tds')).sdiv, 250e-6, 1e-15, '保存 250 μs/div 的新實驗');

    await key('DEFAULT_SETUP');
    T.near((await ui.snap('tds')).sdiv, 0.5, 1e-15, '另一份實驗從 500 ms/div 開始');
    await key('AUTORANGE'); await key('AUTORANGE');
    await upload('{invalid');
    await p.locator('.hintbar').filter({ hasText: '沒有載入實驗' }).waitFor();
    await undoRange();
    T.near((await ui.snap('tds')).sdiv, 0.5, 1e-15, '無效檔案仍保留原本可用的 Undo');

    await key('AUTORANGE'); await key('AUTORANGE');
    await upload(exported);
    await p.locator('.hintbar').filter({ hasText: '已載入實驗' }).waitFor();
    T.near((await ui.snap('tds')).sdiv, 250e-6, 1e-15, '合法檔案恢復新實驗時基');
    await undoRange();
    T.near((await ui.snap('tds')).sdiv, 250e-6, 1e-15, 'Undo Autoranging 不會跨實驗還原成 500 ms/div');

    await p.locator('[data-id="TDS.KNOB.HORIZ_SCALE"]').focus();
    await p.keyboard.press('ArrowUp');
    const selected = (await ui.snap('tds')).sdiv;
    await key('AUTORANGE'); await undoRange();
    T.near((await ui.snap('tds')).sdiv, selected, 1e-15, '載入後的新 AutoRange 仍可正常 Undo');
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}
if (process.argv[1]?.endsWith('/session-undo-isolation.mjs')) { const T = await run(); T.print(); if (T.fail) process.exitCode = 1; }
