// 真面板與麵包板操作；__eess 只讀，不注入電流結果或偷偷修改模型。
import { openApp, Check } from './lib.mjs';

const A = { PRESET: 'AFG.KEY.PRESET', CH: 'AFG.KEY.CH1_CH2', AMPL: 'AFG.KEY.AMPL', OFFSET: 'AFG.KEY.DC_OFFSET',
  OUT: 'AFG.KEY.OUTPUT', F1: 'AFG.SOFT.F1', F2: 'AFG.SOFT.F2', F5: 'AFG.SOFT.F5' };

export async function run() {
  const T = new Check('真串接電流 DCI／ACI 與負擔負載');
  const ui = await openApp(), p = ui.page;
  const wire = async (id, hole) => { await p.click(`[data-lead="${id}"]`); await p.click(`[data-hole="${hole}"]`); };
  const unplug = async (id) => { await p.click(`[data-lead="${id}"]`); await p.click(`[data-lead="${id}"]`); };
  const d = (id) => ui.press(`DMM.KEY.${id}`);
  try {
    const epoch = Date.now(); await p.clock.install({ time: epoch }); await p.reload();
    await p.locator('svg.panel').waitFor(); await p.clock.pauseAt(epoch + 1000);
    await ui.tab('bench'); await p.check('input[name="board"][value="bb"]');
    await p.click('[data-bb="demo-current"]');
    let b = await ui.snap('bench');
    T.ok(b.bbWires['DMM.I'] === 'i18' && b.bbWires['DMM.LO'] === 'B-26' && !b.bbWires['DMM.HI'] && (await ui.snap('dmm')).fn === 'DCI',
      '電流示範拆開回路，以真正 I 3A–LO 支路接回；自動選 DCI，HI 獨立');
    T.ok(await p.locator('.bb-svg [data-lead="DMM.I"]').count() === 1, '麵包板顯示可實際接線的 3A 電流端');
    await ui.tab('gpe'); await ui.dragKnob('GPE.KNOB.CH1_VOLTAGE', 6);
    await ui.press('GPE.KEY.OUTPUT_ON_OFF'); await p.clock.runFor(500);
    const g = await ui.snap('gpe'), expected = g.vset[1] / (1000 + 5 + 0.01);
    await ui.tab('dmm'); let m = await ui.snap('dmm');
    T.ok(m.view.rangeLabel === 'Auto 10mA' && m.view.unit === 'mADC', 'DCI Auto 收斂於 10mA 實體分流檔');
    T.near(m.view.value, expected, 1e-7, 'DCI 包含 5Ω 等效負擔與電源內阻，符合串接迴路');
    T.near(m.view.value, g.readback[1].i, 1e-7, 'DCI 與 GPE 電流讀回守恆');
    T.ok((await p.locator('dl.kv').innerText()).includes('負擔上限等效近似'), '側欄明示分流近似，不宣稱為原廠實際內阻');
    await ui.shot('current-dci-series');
    await d('RANGE_DOWN'); await p.clock.runFor(500);
    m = await ui.snap('dmm'); const lower = (await ui.snap('gpe')).readback[1].i;
    T.ok(m.view.rangeLabel === 'Manual 1mA' && m.view.state === 'over', '手動 1mA 量程太小時顯示過載');
    T.ok(lower < expected && Math.abs(lower - g.vset[1] / (1000 + 110 + 0.01)) < 1e-7, '降量程同時改變實際電路負載，電流降低');
    await d('RANGE'); await p.clock.runFor(500);

    await ui.tab('bench'); await unplug('DMM.I'); await wire('DMM.LO', 'h18'); await wire('DMM.I', 'B-27');
    await p.clock.runFor(500); await ui.tab('dmm');
    T.near((await ui.snap('dmm')).view.value, -expected, 1e-7, 'I 與 LO 互換後讀到負電流');
    await ui.tab('bench'); await unplug('DMM.I'); await wire('DMM.HI', 'B-28');
    await p.clock.runFor(500); await ui.tab('dmm');
    T.ok((await ui.snap('dmm')).view.state === 'none' && (await p.locator('dl.kv').innerText()).includes('HI 不能代替 I'), '只有 HI–LO 時 DCI 沒有相容輸入，明示應使用 I 端');
    T.near((await ui.snap('gpe')).readback[1].i, 0, 1e-7, '拔掉串接電流端後原回路真的開路');

    await ui.tab('bench'); await p.click('[data-bb="demo-current"]'); await p.clock.runFor(500);
    await wire('DMM.I', 'B+27'); await p.clock.runFor(500);
    b = await ui.snap('bench');
    T.ok(b.warn.some((w) => w.includes('直接並接在電源兩端')), '把電流端並接電源時清楚提醒錯接');
    const parallel = (await ui.snap('gpe')).readback[1].i;
    await ui.tab('dmm'); await d('DCV'); await p.clock.runFor(500);
    T.near((await ui.snap('gpe')).readback[1].i, parallel, 1e-7, '切 DCV 不會偷偷移除 I–LO 分流而掩蓋錯接');
    await ui.press('DMM.PWR.POWER'); await p.clock.runFor(500);
    T.near((await ui.snap('gpe')).readback[1].i, parallel, 1e-7, '關電表仍保留電流端低阻支路');
    await ui.press('DMM.PWR.POWER');

    // 改成 AFG→R→I→LO→AFG地；DC 偏移也會經過分流，ACI只顯示交流。
    await ui.tab('bench'); await p.click('[data-bb="demo-current"]');
    await unplug('GPE.CH1+'); await unplug('GPE.CH1-');
    await wire('AFG.CH1+', 'B+27'); await wire('AFG.CH1-', 'B-27');
    await ui.tab('afg'); await ui.keys('AFG', A, 'PRESET CH CH F1 F2 AMPL 2 F5 OFFSET 1 F2 OUT');
    await p.clock.runFor(500); await ui.tab('dmm'); await d('SHIFT'); await d('ACV');
    await p.clock.runFor(500); m = await ui.snap('dmm');
    T.ok(m.fn === 'ACI' && m.view.rangeLabel === 'Auto 1mA', '真 Shift→ACV 進入 ACI 並收斂於 1mA 檔');
    T.near(m.view.value, 1 / (Math.SQRT2 * (1000 + 50 + 110)), 1e-8, 'ACI 僅顯示正弦交流有效值，忽略 DC 偏移但包含分流負擔');
    await ui.shot('current-aci-series');
    T.ok(ui.errors.length === 0, `沒有瀏覽器程式錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally { await ui.close(); }
  return T;
}
