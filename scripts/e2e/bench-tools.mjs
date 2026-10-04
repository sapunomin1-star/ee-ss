// 真滑鼠／鍵盤：實際 RC 電路的直流電源、麵包板工具與重選同工具。
import { openApp, Check } from './lib.mjs';
import { setupRC, wireRC, RC_NODES } from './rc-ui.mjs';

export async function run() {
  const T = new Check('RC 電源與麵包板工具');
  const ui = await openApp(), p = ui.page;
  const wire = (lead, node) => wireRC(ui, lead, node);
  try {
    await setupRC(ui, { wired: false });
    T.ok(await p.locator('[data-goto="gpe"]').count() === 1 && await p.locator('[data-lead^="GPE."]').count() === 9,
      '麵包板有直流電源小螢幕與四路正負端、大地端');
    await wire('GPE.CH1+', 'A'); await wire('GPE.CH1-', 'G');
    await wire('DMM.HI', 'B'); await wire('DMM.LO', 'G');
    T.ok((await ui.snap('gpe')).load === 'bench', '接線後，電源自動讀回實際 RC 電路');
    await p.click('[data-goto="gpe"]');
    T.ok(await p.locator('[data-tab="gpe"]').getAttribute('aria-selected') === 'true', '點電源小螢幕可操作完整面板');
    await p.locator('[data-id="GPE.KNOB.CH1_VOLTAGE"]').scrollIntoViewIfNeeded();
    await ui.dragKnob('GPE.KNOB.CH1_VOLTAGE', 6);
    await ui.press('GPE.KEY.OUTPUT_ON_OFF');
    await ui.tab('dmm');
    await p.waitForTimeout(500);
    const g = await ui.snap('gpe'), d = await ui.snap('dmm');
    T.ok(g.vset[1] > 0 && d.view.state === 'value' && Math.abs(d.view.value - g.vset[1] * 10e6 / (10e6 + 1000.01)) < 1e-5,
      '真面板開啟直流輸出後，電表讀到有負載的電容電壓');
    await ui.tab('bench');
    await p.locator('.save-status').filter({ hasText: '已自動保存' }).waitFor();
    await p.reload();
    T.ok((await ui.snap('bench')).bb.leads['GPE.CH1+'] === RC_NODES.A && await p.locator('[data-goto="gpe"]').count() === 1,
      '含 GPE 接線的實際 RC 電路可自動保存再開啟，不會繪圖崩潰');
    await ui.shot('rc-gpe-extended');

    await p.check('input[name="benchView"][value="breadboard"]');
    await p.click('[data-bb="clear"]');
    await p.click('[data-bbtool="R"]');
    await p.click('[data-hole="a1"]'); await p.click('[data-hole="a2"]');
    await p.click('[data-bbtool="C"]');
    await p.click('[data-hole="a3"]'); await p.click('[data-hole="a4"]');
    await p.click('[data-bbtool="W"]');
    await p.click('[data-hole="a5"]'); await p.click('[data-hole="a6"]');
    T.ok((await ui.snap('bench')).bb.parts.length === 3, '上方工具能自行插電阻、電容及跳線');
    await p.click('[data-bbtool="R"]'); await p.click('[data-lead="GPE.CH1+"]');
    // 側欄已選 R：重點一次也必須解除導線模式。
    await p.click('input[name="bbtool"][value="R"]');
    await p.click('[data-hole="a8"]'); await p.click('[data-hole="a9"]');
    let b = await ui.snap('bench');
    T.ok(b.bb.parts.length === 4 && !b.bbWires['GPE.CH1+'], '重新選相同電阻工具後插元件，不會誤接電源線');
    await p.click('[data-hole="a10"]'); await p.click('[data-bbtool="cancel"]');
    T.ok((await ui.snap('bench')).bbUi.first === null, '取消放置能解除第一腳選取');
    await p.click('[data-lead="GPE.CH1+"]'); await p.click('[data-bbtool="R"]');
    await p.click('[data-hole="a11"]'); await p.click('[data-hole="a12"]');
    T.ok((await ui.snap('bench')).bb.parts.length === 5 && !(await ui.snap('bench')).bbWires['GPE.CH1+'],
      '主工具列重選同工具同樣解除導線模式');
    await p.setViewportSize({ width: 900, height: 700 });
    await p.evaluate(() => window.scrollTo(0, 0));
    const toolbar = await p.locator('.bb-toolbar').boundingBox();
    T.ok(toolbar.y >= 0 && toolbar.y + toolbar.height < 700, '窄視窗的插元件工具在第一屏可見');
    await ui.shot('bb-toolbar-900px');
    T.ok(ui.errors.length === 0, `沒有瀏覽器程式錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally { await ui.close(); }
  return T;
}
