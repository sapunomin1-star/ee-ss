// I06 整合：同一個瀏覽器操作四台，換分頁狀態不串台；單台關機不影響別台；全部重設；錯誤後恢復。
import { openApp, Check, sleep } from './lib.mjs';

export async function run() {
  const T = new Check('I06 四台整合');
  const ui = await openApp();
  const p = ui.page;
  const scen = async (id) => { await p.check(`input[name=scen][value="${id}"]`); await sleep(30); };
  const digits = async (prefix, s) => { for (const ch of s) await ui.press(ch === '.' ? `${prefix}.NUM.DOT` : `${prefix}.NUM.DIGIT_${ch}`); };
  try {
    // AFG：2 VPP、5 kHz、CH1 輸出 ON；再故意輸入非法值（11 VPP）確認拒絕後仍可繼續
    await ui.tab('afg');
    await ui.press('AFG.KEY.PRESET');
    await ui.press('AFG.KEY.AMPL'); await digits('AFG', '11'); await ui.press('AFG.SOFT.F5');
    T.ok((await ui.hint()).includes('已拒絕'), 'AFG 11 VPP 被拒絕');
    await digits('AFG', '2'); await ui.press('AFG.SOFT.F5');
    await ui.press('AFG.KEY.FREQ_RATE'); await digits('AFG', '5'); await ui.press('AFG.SOFT.F4');
    await ui.press('AFG.KEY.OUTPUT');
    const afg0 = await ui.snap('afg');
    T.ok(Math.abs(afg0.ch[0].refVpp - 2) < 1e-9 && afg0.ch[0].freq === 5000 && afg0.ch[0].output, '拒絕後接著輸入 2 VPP、5 kHz、Output ON 都成功');

    // TDS：AutoSet
    await ui.tab('tds');
    T.ok(await p.locator('svg.panel-tds').isVisible(), '切到示波器面板');
    await ui.press('TDS.KEY.AUTOSET');
    const tds0 = await ui.snap('tds');

    // GPE：L1 100 Ω、CH1 拖到 5 V、Output ON
    await ui.tab('gpe');
    await scen('ch1-100');
    await sleep(250); await ui.dragKnob('GPE.KNOB.CH1_VOLTAGE', 6);
    await ui.press('GPE.KEY.OUTPUT_ON_OFF');
    const gpe0 = await ui.snap('gpe');
    T.ok(gpe0.output && gpe0.vset[1] === 5, 'GPE CH1 5.00 V、Output ON');

    // DMM：DC 1.234 V、DCV、手動量程
    await ui.tab('dmm');
    await scen('dcv');
    await ui.press('DMM.KEY.DCV'); await ui.press('DMM.KEY.RANGE');
    const dmm0 = await ui.snap('dmm');
    T.ok(dmm0.fn === 'DCV' && dmm0.auto === false, 'DMM DCV、手動量程');

    // 來回切換四台，狀態都不變
    for (const id of ['afg', 'gpe', 'tds', 'dmm', 'afg']) await ui.tab(id);
    const same = async (id, before) => JSON.stringify(await ui.snap(id)) === JSON.stringify(before);
    T.ok(await same('afg', afg0), '來回切換後 AFG 狀態不變');
    T.ok(await same('gpe', gpe0), '來回切換後 GPE 狀態不變');
    T.ok(await same('dmm', dmm0), '來回切換後 DMM 狀態不變');
    const tds1 = await ui.snap('tds');
    T.ok(tds1.ch[0].vdiv === tds0.ch[0].vdiv && tds1.status === tds0.status, '來回切換後示波器設定不變');

    // 單台關機不影響別台
    await ui.press('AFG.PWR.POWER');
    T.ok((await ui.snap('afg')).on === false, 'AFG 關機');
    T.ok((await ui.snap('gpe')).output === true && (await ui.snap('dmm')).on === true, 'AFG 關機不影響 GPE 輸出與 DMM');
    await ui.press('AFG.PWR.POWER');

    // 全部重設
    await p.click('[data-act="reset-all"]');
    const [a, g, d] = [await ui.snap('afg'), await ui.snap('gpe'), await ui.snap('dmm')];
    T.ok(Math.abs(a.ch[0].refVpp - 3) < 1e-9 && a.ch[0].freq === 1000 && !a.ch[0].output, '全部重設：AFG 回 Preset 值、Output OFF');
    T.ok(!g.output && g.vset[1] === 0, '全部重設：GPE Output OFF、設定歸零');
    T.ok(d.fn === 'DCV' && d.auto === true, '全部重設：DMM 回 DCV、Auto');
    await ui.tab('tds');
    await ui.shot('i06-tds-after-reset');
    await ui.tab('afg');
    await ui.shot('i06-afg');
    T.ok(ui.errors.length === 0, `沒有 JS 錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally {
    await ui.close();
  }
  return T;
}
