// Real panel clicks and file chooser/downloads; __eess is read only.
import fs from 'node:fs/promises';
import { openApp, Check, sleep } from './lib.mjs';
import { setupRC } from './rc-ui.mjs';

const K = Object.fromEntries(Object.entries({ WAVE: 'WAVEFORM', FREQ: 'FREQ_RATE', AMPL: 'AMPL', OFFSET: 'DC_OFFSET',
  CH: 'CH1_CH2', OUT: 'OUTPUT', PRESET: 'PRESET', BACK: 'RETURN', UTIL: 'UTIL', ARB: 'ARB', MOD: 'MOD', SWEEP: 'SWEEP', BURST: 'BURST' })
  .map(([key, value]) => [key, `AFG.KEY.${value}`]));
for (let i = 1; i <= 5; i++) K[`F${i}`] = `AFG.SOFT.F${i}`;
K.PM = 'AFG.NUM.PLUS_MINUS';

export async function run() {
  const T = new Check('AFG 新增功能 真 UI');
  const ui = await openApp(), keys = (s) => ui.keys('AFG', K, s), snap = () => ui.snap('afg');
  const channel = async () => { const s = await snap(); return s.ch[s.sel - 1]; };
  const motion = async () => (await channel()).extended.motion;
  const point = (address, value) => keys(`ARB F2 F1 F1 ${address} F2 BACK F2 ${Math.abs(value)} ${value < 0 ? 'PM' : ''} F2 BACK F3 BACK BACK`);
  const loadFile = async (buffer) => {
    await keys('ARB F5 F2');
    const [chooser] = await Promise.all([ui.page.waitForEvent('filechooser'), keys('F4')]);
    await chooser.setFiles({ name: 'ee-ss-AFG-波形.json', mimeType: 'application/json', buffer });
    await sleep(100);
  };
  try {
    await ui.tab('afg');
    await keys('PRESET FREQ 25 F5 WAVE F5 AMPL 10 F5 OUT WAVE F1');
    T.ok((await channel()).wave === 'NOISE' && (await channel()).emfVpp === 20 && (await ui.hint()).includes('已拒絕'), '25MHz Noise高幅切Sine明確拒絕，保留合法Noise輸出');
    await keys('PRESET ARB F4 F2 2 F2 BACK FREQ 120 F5 WAVE F1');
    T.ok((await channel()).wave === 'ARB' && (await channel()).freq === 60e6 && (await ui.hint()).includes('已拒絕'), '60MHz ARB切Sine不會越過25MHz頻率上限');
    await keys('PRESET ARB F1 F2 F1 510 F2 BACK F2 511 F2 BACK F3 500 F2');
    const vertical = (await channel()).extended.arb;
    T.ok(vertical.low === 499 && vertical.high === 500 && !/\b(?:NaN|Infinity)\b/.test(await ui.lcdText()), '一碼ARB垂直窗口移動Center後保留寬度與合法LCD');
    const [sessionDownload] = await Promise.all([ui.page.waitForEvent('download'), ui.page.click('[data-session="export"]')]);
    const sessionBuffer = await fs.readFile(await sessionDownload.path()), sessionData = JSON.parse(sessionBuffer.toString('utf8'));
    T.ok(sessionData.instruments.afg.ch[0].extended.arb.low === 499 && sessionData.instruments.afg.ch[0].extended.arb.high === 500, '實驗匯出保留一碼ARB窗口');
    await keys('PRESET');
    const [sessionChooser] = await Promise.all([ui.page.waitForEvent('filechooser'), ui.page.click('[data-session="import"]')]);
    await sessionChooser.setFiles({name:'ee-ss-實驗.json',mimeType:'application/json',buffer:sessionBuffer});await sleep(150);
    T.ok((await channel()).extended.arb.low === 499 && (await channel()).extended.arb.high === 500 && (await ui.hint()).includes('已載入實驗'), '實驗回讀確實還原合法ARB窗口');
    await keys('PRESET WAVE F2 BURST F1 F5 F3 BACK BACK F2 OUT F5 F3 F1');
    T.ok((await motion()).infinite && (await motion()).source === 'MANUAL' && /Manual Trigger.*BURST/.test(await ui.hint()), 'Square Infinite Burst可由真按鍵以Manual觸發');
    await keys('PRESET WAVE F3 F1 500 F2 FREQ 1 F5 WAVE F3 F1 20 F2 OUT');
    T.ok((await channel()).wave === 'PULSE', 'Waveform→Pulse提供實際Pulse選項');
    T.near((await channel()).extended.pulseWidth, 20e-9, 1e-18, 'Pulse Width：20ns確實提交');
    T.ok((await channel()).freq === 1e6 && (await ui.lcdText()).includes('Width'), '1MHz Pulse的LCD顯示Width');
    await ui.shot('extended-afg-pulse');
    await keys('PRESET WAVE F5 OUT FREQ');
    T.ok((await channel()).wave === 'NOISE' && (await ui.hint()).includes('不適用'), 'Noise啟用後Frequency鍵明示不適用');
    T.ok((await ui.lcdText().then((s) => s.match(/FREQ:/g) || [])).length === 1, 'Noise參數窗省略FREQ，CH2仍有FREQ');

    await keys('PRESET MOD F1 F2 50 F1 OUT');
    T.ok((await motion()).mode === 'MOD' && (await motion()).type === 'AM' && (await motion()).depth === 50, 'AM Depth 50%真正保存且Output開啟');
    T.ok((await ui.lcdText()).includes('Depth'), 'AM選單與LCD顯示調變深度');
    await ui.shot('extended-afg-am');
    await keys('MOD F2 F2 200 F3'); T.ok((await motion()).type === 'FM' && (await motion()).deviation === 200, 'FM deviation 200Hz提交');
    await keys('MOD F4 F2 90 F1'); T.ok((await motion()).type === 'PM' && (await motion()).phaseDeviation === 90, 'PM phase deviation 90°提交');
    await keys('MOD F3 F2 200 F3'); T.ok((await motion()).type === 'FSK' && (await motion()).hop === 200, 'FSK Hop 200Hz提交');
    await keys('MOD F5'); T.ok((await motion()).type === 'SUM' && (await motion()).sum === 50, 'SUM採獨立調變模式與50%幅度');
    await keys('F1 F2'); T.ok((await motion()).source === 'INT' && (await ui.hint()).includes('已拒絕'), '未接後面板EXT調變源會拒絕並保留INT');

    await keys('PRESET WAVE F3 F1 200 F3 AMPL 2 F5 OUT UTIL F1');
    await ui.page.locator('[data-id="AFG.KNOB.SCROLL_WHEEL"]').focus(); await ui.page.keyboard.press('ArrowUp');
    await keys('F1 F5 F5');
    T.ok((await snap()).extended.memories[1]?.settings.ch[0].wave === 'PULSE', 'Memory1保存Pulse量測與設定');
    await keys('PRESET'); T.ok(!!(await snap()).extended.memories[1], 'Preset保留真記憶槽');
    await keys('UTIL F1'); await ui.page.locator('[data-id="AFG.KNOB.SCROLL_WHEEL"]').focus(); await ui.page.keyboard.press('ArrowUp');
    await keys('F2 F5 F5');
    T.ok((await channel()).wave === 'PULSE' && (await channel()).output, 'Memory1 Recall回復Pulse與Output');
    T.near((await channel()).extended.pulseWidth, 200e-6, 1e-15, 'Recall回復200µs Width');
    await keys('F3 F5 F5'); T.ok((await snap()).extended.memories[1] === null, 'Memory1 Delete真的清除資料');

    await keys('PRESET');
    for (const [address, value] of [[0, 511], [1, 0], [2, -511], [3, 0]]) await point(address, value);
    await keys('ARB F4 F2 4 F2 BACK FREQ 4 F4 OUT');
    T.ok((await channel()).extended.arb.length === 4 && (await channel()).extended.arb.rate === 4000, 'ARB Output四個樣本、Rate 4kSa/s確實提交');
    T.ok(JSON.stringify((await channel()).extended.arb.points.slice(0, 4)) === '[511,0,-511,0]', 'ARB逐點編輯產生四階實際資料');
    await keys('ARB F5 F1 F2 4 F2 BACK');
    const [download] = await Promise.all([ui.page.waitForEvent('download'), keys('F4')]);
    const buffer = await fs.readFile(await download.path()), file = JSON.parse(buffer.toString('utf8'));
    T.ok(download.suggestedFilename() === 'ee-ss-AFG-波形.json' && file.format === 'ee-ss-afg-arb', 'Save USB入口產生真JSON下載');
    T.ok(file.rate === 4000 && JSON.stringify(file.points) === '[511,0,-511,0]', '下載JSON包含選定四點與真正取樣率');
    await point(0, 0); T.ok((await channel()).extended.arb.points[0] === 0, '匯入前先改變ARB資料');
    await loadFile(buffer);
    T.ok(JSON.stringify((await channel()).extended.arb.points.slice(0, 4)) === '[511,0,-511,0]', 'Load USB入口透過檔案選擇回復四點波形');
    T.ok((await channel()).freq === 1000 && (await channel()).extended.arb.length === 4, '載入Rate/Length同步回復1kHz重複波形');
    await keys('ARB F2 F5 F1 F1');
    const protectedBefore = JSON.stringify((await channel()).extended.arb);
    await loadFile(buffer);
    T.ok((await ui.hint()).includes('Protect') && (await ui.hint()).includes('已拒絕'), 'ARB有保護區時載入會明確拒絕');
    T.ok(JSON.stringify((await channel()).extended.arb) === protectedBefore, '保護拒絕後全部ARB資料、Rate與範圍不變');
    await ui.shot('extended-afg-arb-protected');

    await keys('PRESET SWEEP F1 F3 BACK BACK F2 F2 OUT');
    T.ok((await motion()).source === 'MANUAL' && (await motion()).sweepType === 'LOG', 'Manual Log Sweep選項真正提交');
    await keys('BACK F1 F3 F1'); T.ok(/Manual Trigger.*SWEEP/.test(await ui.hint()), 'Manual Trigger在實驗台時鐘啟動一次Sweep');
    await keys('F1'); T.ok((await ui.hint()).includes('尚未完成'), 'Sweep還在執行時忽略第二次觸發');
    await sleep(1100); await keys('F1'); T.ok(/Manual Trigger.*SWEEP/.test(await ui.hint()), 'Sweep完成後可重新觸發一次');
    await ui.shot('extended-afg-manual-sweep');
    await keys('PRESET BURST F1 F1 2 F2 OUT BACK F5 F3 F1');
    T.ok((await motion()).mode === 'BURST' && (await motion()).source === 'MANUAL' && (await motion()).cycles === 2, 'Manual Burst保存2cycles與手動來源');
    T.ok(/Manual Trigger.*BURST/.test(await ui.hint()), 'Manual Trigger真的啟動一次2cycle Burst');
    await ui.shot('extended-afg-manual-burst');

    await keys('PRESET UTIL F5'); T.ok(/Frequency:\s*—/.test(await ui.lcdText()), '未接量測訊號的Counter留空');
    await keys('PRESET OUT'); await setupRC(ui);
    await ui.tab('afg'); await keys('UTIL F5');
    T.ok(/Frequency:\s*1000\.000 Hz/.test(await ui.lcdText()), 'Counter以已接示波器CH1的實際波形交越讀1kHz');
    await ui.tab('tds'); await ui.press('TDS.KEY.AUTOSET'); await sleep(450);
    await ui.tab('afg'); await keys('CH CH F5 F1 F2');
    const dso = await channel();
    T.ok(dso.wave === 'ARB' && Math.max(...dso.extended.arb.points) === 511 && Math.min(...dso.extended.arb.points) === -511, 'DSO Link從真正示波器採集記錄匯入有振幅的ARB');
    await keys('UTIL F3 F3 F2'); T.ok(!(await snap()).extended.beep, 'System→Beep OFF保存設定');
    await keys('F1'); T.ok((await snap()).extended.beep, 'System→Beep ON重新啟用瀏覽器提示音hook');
    T.ok(ui.errors.length === 0, `沒有JS錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}
