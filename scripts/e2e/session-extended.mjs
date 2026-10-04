import { openApp, Check } from './lib.mjs';
export async function run() {
  const T = new Check('儀器記憶與舊存檔整合'), ui = await openApp(), p = ui.page;
  try {
    await ui.tab('tds'); await ui.press('TDS.KEY.AUTOSET'); await ui.press('TDS.KEY.SAVE_RECALL');
    await ui.press('TDS.SOFT.OPT5');
    await ui.press('TDS.SOFT.OPT1'); await ui.press('TDS.SOFT.OPT5');
    await ui.press('TDS.KEY.REF'); await ui.press('TDS.SOFT.OPT1');
    const before = await p.locator('svg.screen .wave.ref0').getAttribute('points');
    T.ok((await ui.snap('tds')).memory.setups[0] && (await ui.snap('tds')).memory.references[0], '實際按键存入 Setup 1 與 RefA');
    await p.locator('.save-status').filter({ hasText: '已自動保存' }).waitFor(); await p.reload();
    const after = await ui.snap('tds');
    T.ok(after.memory.setups[0] && after.memory.references[0], '重新開啟保留明確儲存的設定與參考波形');
    T.ok(await p.locator('svg.screen .wave.ref0').getAttribute('points') === before, '重開後參考波形樣本與刻度保持原值');
    const raw = await p.evaluate(() => localStorage.getItem('ee-ss.session.v1'));
    T.ok(JSON.parse(raw).instruments.tds.references[0].v.length === 2500, '存檔包含2500個有限參考樣本');
    await ui.tab('bench');
    T.ok(await p.locator('[data-lead="DMM.SHI"]').count() === 1 && await p.locator('[data-lead="DMM.SLO"]').count() === 1, '麵包板有獨立 Sense HI／LO 端');
    await p.click('[data-lead="DMM.SHI"]'); await p.click('[data-hole="a1"]');
    await p.click('[data-lead="DMM.SLO"]'); await p.click('[data-hole="a2"]');
    await p.check('input[name="benchView"][value="schematic"]');
    const leads = await p.locator('.schematic-svg .sc-lead-label').allTextContents();
    T.ok(leads.includes('DMM SHI → a1') && leads.includes('DMM SLO → a2'), '電路圖保留兩條 Sense 導線與各自實體孔位');
    await ui.shot('instrument-memory-session');
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}
if (process.argv[1]?.endsWith('/session-extended.mjs')) { const T = await run(); T.print(); if (T.fail) process.exitCode = 1; }
