// Real controls and physical breadboard wiring; snapshots are read only.
import { openApp, Check } from './lib.mjs';
import { setupRC, wireRC, RC_NODES } from './rc-ui.mjs';

const K = Object.fromEntries(Object.entries({ CH: 'CH1_CH2', OUT: 'OUTPUT', PRESET: 'PRESET', BACK: 'RETURN', SWEEP: 'SWEEP' })
  .map(([key, value]) => [key, `AFG.KEY.${value}`]));
for (let i = 1; i <= 5; i++) K[`F${i}`] = `AFG.SOFT.F${i}`;

export async function run() {
  const T = new Check('Manual Sweep 與雙通道的實際輸出週期');
  const ui = await openApp(), p = ui.page, keys = (s) => ui.keys('AFG', K, s), snap = () => ui.snap('afg');
  try {
    const epoch = Date.now(); await p.clock.install({ time: epoch }); await p.reload();
    await p.locator('svg.panel').waitFor(); await p.clock.pauseAt(epoch + 1000);
    await setupRC(ui);
    await wireRC(ui, 'AFG.CH2+', 'B'); await wireRC(ui, 'AFG.CH2-', 'G');
    T.ok((await ui.snap('bench')).bb.leads['AFG.CH2+'] === RC_NODES.B, 'CH2 真正接到同一 RC 電路的另一個節點');
    await ui.tab('afg');
    await keys('SWEEP F1 F3 BACK BACK F3 999.123 F3 BACK OUT F1 F3 F1');
    T.ok((await snap()).ch[0].extended.motion.start === 999.123 && (await ui.hint()).includes('Manual Trigger'), 'CH1 以真按鍵設定並觸發 999.123 Hz 起始的 Manual Sweep');
    await p.clock.runFor(1100);
    T.near((await ui.snap('bench')).period, 1 / 999.123, 1e-12, 'Sweep 完成後實際輸出回到 Start 頻率');
    await keys('CH OUT');
    T.ok((await ui.hint()).includes('已拒絕') && /共同週期|頻率組合/.test(await ui.hint()), '完成 Sweep 後開啟不相容的 CH2 會明確拒絕');
    T.ok(JSON.stringify((await snap()).ch.map(c => c.output)) === '[true,false]' && (await snap()).ch[1].freq === 1000,
      '拒絕保留 CH1 輸出與 CH2 1 kHz 設定，CH2 仍為 OFF');
    T.ok(Number.isFinite((await ui.snap('bench')).pp[RC_NODES.B]), '拒絕後電路仍可正常求解與讀回');

    await keys('CH SWEEP SWEEP F3 100 F3 BACK CH OUT');
    T.ok((await snap()).ch.every(c => c.output), '改為相容的 100 Hz Start 後可以開啟兩路輸出');
    await keys('CH SWEEP SWEEP F1 F3 F1');
    await p.clock.runFor(250);
    T.ok((await snap()).ch.every(c => c.output) && Number.isFinite((await ui.snap('bench')).pp[RC_NODES.B]),
      '相容雙通道在 Manual Sweep 執行期間保持有效輸出');
    await p.clock.runFor(1000);
    T.near((await ui.snap('bench')).period, .01, 1e-12, 'Sweep 結束後 100 Hz 與 1 kHz 仍形成合法共同週期');
    T.ok(ui.errors.length === 0, `沒有求解例外或瀏覽器錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}

if (process.argv[1]?.endsWith('/afg-sweep-pair.mjs')) { const T = await run(); T.print(); if (T.fail) process.exitCode = 1; }
