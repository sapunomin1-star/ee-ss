// Review regressions use real panel clicks and downloads; __eess is read only.
import fs from 'node:fs/promises';
import { openApp, Check, sleep } from './lib.mjs';

const K = Object.fromEntries(Object.entries({ FREQ: 'FREQ_RATE', OUT: 'OUTPUT', PRESET: 'PRESET', BACK: 'RETURN', UTIL: 'UTIL', ARB: 'ARB', BURST: 'BURST' })
  .map(([key, value]) => [key, `AFG.KEY.${value}`]));
for (let i = 1; i <= 5; i++) K[`F${i}`] = `AFG.SOFT.F${i}`;

export async function run() {
  const T = new Check('AFG review：Manual Burst 與 ARB 記憶');
  const ui = await openApp(), keys = (s) => ui.keys('AFG', K, s), snap = () => ui.snap('afg');
  try {
    await ui.tab('bench');
    await ui.page.click('[data-bench="demo"]');
    await ui.tab('afg');
    await keys('BURST F1 F5 F3 FREQ 10 F3 BURST BURST F1 F5 F3 OUT F1');
    await sleep(150);
    T.ok((await ui.snap('bench')).pp.A < 1e-8, '單次 Manual Burst 結束後實際輸出保持閒置');
    await keys('BACK BACK F1 100 F2');
    T.ok((await snap()).ch[0].extended.motion.cycles === 100, 'Cycles 由 1 改成 100 確實提交');
    T.ok((await ui.snap('bench')).pp.A < 1e-8, '改 Cycles 不會重用舊 Trigger 自行恢復輸出');
    await keys('BACK F5 F3 F1');
    T.ok((await ui.snap('bench')).pp.A > 5, '再次按 Trigger 才開始新的 100 Cycles 輸出');

    await keys('PRESET UTIL F1 F1 F5 F5');
    const previous = JSON.stringify((await snap()).extended.memories[0]);
    await keys('ARB F4 F2 2 F2 BACK FREQ 2 F1 ARB F5 F1 F3 F1');
    T.ok((await ui.hint()).includes('1µHz–60MHz') && (await ui.hint()).includes('已拒絕'), '低速儲存過長片段清楚拒絕並提示輸出頻率限制');
    T.ok(JSON.stringify((await snap()).extended.memories[0]) === previous, '被拒絕的 ARB 儲存保留原記憶槽');
    const [download] = await Promise.all([ui.page.waitForEvent('download'), ui.page.click('[data-session="export"]')]);
    const buffer = await fs.readFile(await download.path());
    await keys('PRESET');
    const [chooser] = await Promise.all([ui.page.waitForEvent('filechooser'), ui.page.click('[data-session="import"]')]);
    await chooser.setFiles({ name: 'ee-ss-review.json', mimeType: 'application/json', buffer });
    await sleep(100);
    T.ok((await ui.hint()).includes('已載入實驗') && (await snap()).ch[0].extended.arb.rate === .000002, '實驗下載再載入通過驗證並保留合法低速設定');
    await keys('ARB F5 F1 F2 2 F2 BACK F3 F1');
    const stored = (await snap()).extended.memories[0].arb[0];
    T.ok(stored.length === 2 && stored.rate === .000002, '1 µHz 邊界的兩點片段可以正常儲存');
    T.ok(ui.errors.length === 0, `沒有 JS 錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}
