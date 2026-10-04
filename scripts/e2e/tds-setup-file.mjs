import fs from 'node:fs/promises';
import { openApp, Check } from './lib.mjs';

export async function run() {
  const T = new Check('示波器設定檔匯入與拒絕損壞檔'), ui = await openApp(), p = ui.page;
  const key = (id) => ui.press(`TDS.KEY.${id}`), opt = (n) => ui.press(`TDS.SOFT.OPT${n}`);
  const upload = async (content) => {
    const chooser = p.waitForEvent('filechooser'); await opt(5);
    await (await chooser).setFiles({ name: 'TDS2001C-setup.json', mimeType: 'application/json', buffer: Buffer.from(content) });
  };
  try {
    await ui.tab('tds'); await key('AUTOSET'); await key('SAVE_RECALL'); await opt(2);
    const wait = p.waitForEvent('download'); await opt(5); const file = await wait;
    const text = await fs.readFile(await file.path(), 'utf8'), setup = JSON.parse(text);
    T.ok(file.suggestedFilename() === 'TDS2001C-setup.json', 'Save Setup File下載真實JSON設定');
    const saved = await ui.snap('tds');
    await p.locator('[data-id="TDS.KNOB.HORIZ_SCALE"]').focus(); await p.keyboard.press('ArrowUp');
    T.ok((await ui.snap('tds')).sdiv !== saved.sdiv, '回讀前先用面板改變時基');
    await opt(1); await opt(1); await upload(text);
    await p.locator('.hintbar').filter({ hasText: /已回復|已載入/ }).waitFor();
    T.near((await ui.snap('tds')).sdiv, saved.sdiv, 1e-15, 'Recall Setup File實際恢復匯出的時基');
    // Recalled setup restores Save Setup selection; choose Recall again.
    await opt(1); await opt(1);
    const before = await ui.snap('tds'); setup.state.ch[0].vIdx = 999;
    await upload(JSON.stringify(setup));
    await p.locator('.hintbar').filter({ hasText: '原設定保留' }).waitFor();
    const after = await ui.snap('tds');
    T.ok(after.sdiv === before.sdiv && after.ch[0].vdiv === before.ch[0].vdiv, '非法刻度被拒絕且保留目前兩軸設定');
    await upload('{broken json');
    await p.locator('.hintbar').filter({ hasText: '原設定保留' }).waitFor();
    T.ok((await ui.snap('tds')).sdiv === before.sdiv, '損壞JSON不改變示波器狀態');
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}
if (process.argv[1]?.endsWith('/tds-setup-file.mjs')) { const T = await run(); T.print(); if (T.fail) process.exitCode = 1; }
