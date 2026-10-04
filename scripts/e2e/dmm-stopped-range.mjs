// 50574f7 review regression: real panel keys, with snapshot hooks used only for assertions.
import { openApp, Check } from './lib.mjs';

export async function run() {
  const T = new Check('DMM 停止後切檔與凍結讀值');
  const ui = await openApp();
  const key = (id) => ui.press(/^S[1-6]$/.test(id) ? `DMM.SOFT.${id}` : `DMM.KEY.${id}`);
  try {
    await ui.tab('dmm');
    await ui.page.check('input[name=scen][value=dcv]');
    await key('S4'); await key('RUN_STOP');
    const held = (await ui.snap('dmm')).view;
    await key('RANGE_UP');
    let snap = await ui.snap('dmm'), lcd = await ui.lcdText();
    T.ok(snap.per.DCV.idx === 3 && snap.range === '100V' && lcd.includes('Manual 100V'), 'Stopped 按 Range+：設定與 LCD 都顯示 100 V');
    T.ok(snap.run === 'stop' && snap.view.value === held.value && snap.view.text === held.text && lcd.includes('Stopped'), '切量程仍保留原始凍結讀值與 Stopped 狀態');
    await ui.page.check('input[name=scen][value=bench]');
    T.ok((await ui.page.locator('.side').innerText()).includes('10 MΩ') && (await ui.lcdText()).includes('Manual 100V'), '實驗台負載說明為 10 MΩ，與 LCD 的 100 V 檔一致');
    await key('RANGE_DOWN');
    T.ok((await ui.page.locator('.side').innerText()).includes('10000 MΩ') && (await ui.lcdText()).includes('Manual 10V'), 'Range− 回到 10 V，LCD 與 10 GΩ 負載同步');

    await key('SHIFT'); await key('DCV');
    await ui.page.check('input[name=scen][value=dci]');
    await key('RUN_STOP');
    const current = (await ui.snap('dmm')).view;
    await key('RANGE_UP');
    snap = await ui.snap('dmm'); lcd = await ui.lcdText();
    T.ok(snap.range === '1A' && lcd.includes('Manual 1A') && snap.view.unit === 'mADC' && snap.view.text === current.text && snap.view.value === current.value,
      '100 mA → 1 A：量程更新，最後一筆讀值仍以原 mA 單位顯示');
    await key('RUN_STOP');
    snap = await ui.snap('dmm');
    T.ok(snap.run === 'run' && snap.view.unit === 'ADC' && snap.view.value === current.value, '恢復採集後以新 1 A 檔顯示同一物理電流');
    T.ok(ui.errors.length === 0, `沒有 JS 錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally {
    await ui.close();
  }
  return T;
}
