// Exercise the real Save USB download and Load USB file chooser paths.
import fs from 'node:fs/promises';
import { openApp, Check, sleep } from './lib.mjs';

const K = Object.fromEntries(Object.entries({ FREQ: 'FREQ_RATE', PRESET: 'PRESET', BACK: 'RETURN', ARB: 'ARB' })
  .map(([key, value]) => [key, `AFG.KEY.${value}`]));
for (let i = 1; i <= 5; i++) K[`F${i}`] = `AFG.SOFT.F${i}`;

export async function run() {
  const T = new Check('ARB USB 匯出片段驗證');
  const ui = await openApp(), keys = (s) => ui.keys('AFG', K, s), snap = () => ui.snap('afg'), downloads = [];
  ui.page.on('download', (download) => downloads.push(download));
  const load = async (buffer) => {
    await keys('ARB F5 F2');
    const [chooser] = await Promise.all([ui.page.waitForEvent('filechooser'), keys('F4')]);
    await chooser.setFiles({ name: 'ee-ss-arb-export.json', mimeType: 'application/json', buffer });
    await sleep(100);
  };
  const download = async () => {
    const [file] = await Promise.all([ui.page.waitForEvent('download'), keys('F4')]);
    return fs.readFile(await file.path());
  };
  try {
    await ui.tab('afg');
    await keys('ARB F4 F2 2 F2 BACK FREQ 2 F1 ARB F2 F1 F2 511 F2 BACK F3 ARB F5 F1');
    const before = JSON.stringify(await snap());
    await keys('F4');
    await sleep(150);
    T.ok((await ui.hint()).includes('已拒絕') && (await ui.hint()).includes('1µHz–60MHz'), '合法低速設定匯出過長片段會顯示清楚的拒絕原因');
    T.ok(downloads.length === 0, '拒絕時不產生 USB／JSON 下載');
    T.ok(JSON.stringify(await snap()) === before, '拒絕後波形、Rate、Output 範圍與儲存片段完全保留');

    await keys('F2 1 F2 BACK');
    const lowBuffer = await download(), low = JSON.parse(lowBuffer.toString('utf8'));
    T.ok(low.format === 'ee-ss-afg-arb' && low.version === 1 && low.rate === .000002 && JSON.stringify(low.points) === '[511]', '單點片段以實際 Rate 與選定樣本匯出，不改寫取樣率');
    await keys('PRESET');
    await load(lowBuffer);
    let a = (await snap()).ch[0].extended.arb;
    T.ok((await ui.hint()).includes('已匯入1點') && a.rate === .000002 && a.length === 2 && JSON.stringify(a.points.slice(0, 2)) === '[511,0]', '下載檔可以重新載入：1 µHz 下限與單點補零維持一致');

    await keys('FREQ 120 F5 ARB F5 F1 F2 2 F2 BACK');
    const highBuffer = await download(), high = JSON.parse(highBuffer.toString('utf8'));
    T.ok(high.rate === 120e6 && JSON.stringify(high.points) === '[511,0]', '120 MSa/s 上限的兩點片段可下載');
    await keys('PRESET');
    await load(highBuffer);
    a = (await snap()).ch[0].extended.arb;
    T.ok((await snap()).ch[0].freq === 60e6 && a.rate === 120e6 && a.length === 2 && a.points[0] === 511, '上限 JSON 回讀產生合法的 60 MHz 波形');

    const loaded = JSON.stringify((await snap()).ch);
    await load(Buffer.from(JSON.stringify({ ...low, points: Array(4096).fill(0) })));
    T.ok((await ui.hint()).includes('已拒絕') && (await ui.hint()).includes('1µHz–60MHz') && JSON.stringify((await snap()).ch) === loaded, '外部不合法片段仍被匯入器拒絕並保留原波形');
    T.ok(ui.errors.length === 0, `沒有 JS 錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}
