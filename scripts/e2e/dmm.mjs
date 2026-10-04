// 34460A 真 UI：滑鼠點面板鍵、鍵盤 Enter 按鍵、側欄單選鈕選單機測試情境；斷言讀 LCD 字串與唯讀狀態。
import { openApp, Check, sleep } from './lib.mjs';

const K = {
  DCV: 'DMM.KEY.DCV', ACV: 'DMM.KEY.ACV', OHM: 'DMM.KEY.OHM_2W', CONT: 'DMM.KEY.CONT', NULL: 'DMM.KEY.NULL',
  SHIFT: 'DMM.KEY.SHIFT', RANGE: 'DMM.KEY.RANGE', UP: 'DMM.KEY.RANGE_UP', DOWN: 'DMM.KEY.RANGE_DOWN',
  S1: 'DMM.SOFT.S1', S2: 'DMM.SOFT.S2', FREQ: 'DMM.KEY.FREQ', POWER: 'DMM.PWR.POWER',
};

export async function run() {
  const T = new Check('34460A 真 UI');
  const ui = await openApp();
  const keys = async (s) => { for (const t of s.split(/\s+/).filter(Boolean)) await ui.press(K[t] ?? t); };
  const scen = async (id) => { await ui.page.check(`input[name=scen][value=${id}]`); await sleep(30); };
  const snap = () => ui.snap('dmm');
  const view = async () => (await snap()).view;
  try {
    await ui.tab('dmm');

    // DCV：D1 1.234 V → Auto 10 V
    await scen('dcv');
    await keys('DCV');
    let lcd = await ui.lcdText();
    T.ok(['DC Voltage', '+01.234 00', 'VDC', 'Auto 10V', 'Auto Trigger'].every((s) => lcd.includes(s)), 'DC 1.234 V → DCV：LCD「DC Voltage」「+01.234 00」「VDC」「Auto 10V」');
    await ui.shot('dmm-dcv');

    // 手動量程：Range 鎖 10 V → − 到 1 V 超量程 → − 到 100 mV → 端點停住 → + 回 10 V、100 V → Range 回 Auto
    await keys('RANGE');
    T.ok((await ui.lcdText()).includes('Manual 10V') && (await ui.lcdText()).includes('+01.234 00'), 'Range：轉手動並鎖在 10 V，讀值不變');
    await keys('DOWN');
    lcd = await ui.lcdText();
    T.ok(lcd.includes('Manual 1V') && lcd.includes('-------') && !lcd.includes('1.2'), '手動 1 V：讀值欄顯示中性記號，不截斷成 1.2、不顯示 0');
    T.ok((await ui.hint()).includes('超量程'), '超量程在儀器外說明');
    await ui.shot('dmm-overload');
    await keys('DOWN DOWN');
    T.ok((await snap()).range === '100mV' && (await ui.hint()).includes('最低量程'), '− 到 100 mV 後停住，不循環');
    await keys('UP UP UP');
    T.ok((await ui.lcdText()).includes('+001.234 0') && (await snap()).range === '100V', '+ 連按回到 100 V 檔：+001.234 0（物理值相同、解析度不同）');
    await keys('RANGE');
    T.ok((await ui.lcdText()).includes('Auto 10V'), 'Range：回 Auto 立即重選 10 V 檔');
    await keys('S1');
    T.ok((await snap()).auto === false && (await ui.lcdText()).includes('Manual 10V'), 'S1 軟鍵（Range）：Auto → 手動');
    await keys('S1');
    T.ok((await snap()).auto === true, 'S1 再按：回 Auto');

    // 不相容：DC 電壓情境在 DCI 沒有讀值
    await keys('SHIFT');
    T.ok((await snap()).shift === true && !(await ui.lcdText()).includes('Shift'), 'Shift：狀態只在儀器外，LCD 不加字樣');
    await keys('DCV');
    let s = await snap();
    lcd = await ui.lcdText();
    T.ok(s.fn === 'DCI' && s.shift === false, 'Shift→DCV＝DCI，Shift 自動解除');
    T.ok(s.view.state === 'none' && !lcd.includes('1.234') && !/[+-]\d/.test(lcd), 'DCI 接電壓情境：讀值欄留空，不沿用 DCV 讀值');
    T.ok((await ui.hint()).includes('未提供相容測試輸入'), '儀器外顯示「未提供相容測試輸入」');
    await ui.shot('dmm-incompatible');

    // DCI／ACI
    await scen('dci');
    lcd = await ui.lcdText();
    T.ok(lcd.includes('+012.340 0') && lcd.includes('mADC') && lcd.includes('Auto 100mA'), 'DC 12.34 mA → DCI：+012.340 0 mADC、Auto 100mA');
    await keys('RANGE DOWN');
    T.ok((await snap()).range === '10mA' && (await view()).state === 'over', 'DCI 手動 10 mA：超量程');
    await keys('SHIFT ACV');
    s = await snap();
    T.ok(s.fn === 'ACI' && !(await ui.lcdText()).includes('12.34'), 'DC 電流情境在 ACI 不顯示 12.34 mA（只量交流成分）');
    await scen('aci');
    lcd = await ui.lcdText();
    T.ok(lcd.includes('+05.000 00') && lcd.includes('mAAC') && lcd.includes('Auto 10mA'), 'AC 5 mArms → ACI：+05.000 00 mAAC、Auto 10mA');

    // ACV
    await scen('acv');
    await keys('ACV');
    T.ok((await ui.lcdText()).includes('+02.000 00') && (await ui.lcdText()).includes('VAC'), 'AC 2 Vrms → ACV：+02.000 00 VAC');

    // Ω2W＋Null：短路當基準 → 換 1 kΩ 看差值 → 切 DCV 再切回，Null 仍在 → 關 Null
    await scen('short');
    await keys('OHM');
    T.ok((await ui.lcdText()).includes('+000.500 0'), '短路 0.5 Ω → Ω 2W：+000.500 0 Ω');
    await keys('NULL');
    lcd = await ui.lcdText();
    T.ok(lcd.includes('+000.000 0') && lcd.includes('Null'), 'Null 開：讀值歸零、LCD 出現 Null');
    await scen('r1k');
    T.ok((await ui.lcdText()).includes('+0.999 500'), '換 1 kΩ：顯示差值 +0.999 500 kΩ（不重取基準）');
    await ui.shot('dmm-null');
    await keys('DCV');
    T.ok(!(await ui.lcdText()).includes('Null'), '切到 DCV：不套用 Ω 2W 的 Null');
    await keys('OHM');
    T.ok((await ui.lcdText()).includes('Null') && (await ui.lcdText()).includes('+0.999 500'), '切回 Ω 2W：Null 與基準保留');
    await keys('NULL');
    T.ok((await ui.lcdText()).includes('+1.000 000') && !(await ui.lcdText()).includes('Null'), 'Null 關：回到 +1.000 000 kΩ');

    // 導通
    await scen('short');
    await keys('CONT');
    T.ok((await view()).beep === true && (await ui.lcdText()).includes('Continuity'), 'Cont 短路 0.5 Ω：有導通指示');
    await ui.shot('dmm-cont');
    await scen('open');
    T.ok((await ui.lcdText()).includes('OPEN') && (await view()).beep === false, 'Cont 開路：LCD 顯示 OPEN、沒有導通指示');
    await keys('RANGE');
    T.ok((await ui.hint()).includes('固定 1 kΩ'), 'Cont 按 Range：說明固定 1 kΩ，不改量程');

    // 新功能：Temp必須有相容感測器；Math開真正選單
    await keys('DMM.KEY.TEMP');
    T.ok((await snap()).fn === 'TEMP' && (await view()).state === 'none', 'Temp：切到溫度功能，開路不是虛構溫度');
    await scen('pt100');
    T.near((await view()).value, 25, 1e-8, 'PT100情境實際轉換為25°C');
    await keys('SHIFT NULL');
    s = await snap();
    T.ok(s.menu === 'MATH' && s.shift === false && !s.view.nullOn, 'Shift→Null開Math，Null保持關、Shift解除');

    // 無效操作：沒有讀值時 Null 被拒絕
    await scen('none');
    await keys('NULL');
    T.ok((await ui.hint()).includes('已拒絕') && (await view()).nullOn === false, '沒有讀值時按 Null：被拒絕、Null 保持關');

    // 鍵盤：聚焦 DCV 按 Enter
    await ui.page.locator(`[data-id="${K.DCV}"]`).focus();
    await ui.page.keyboard.press('Enter');
    T.ok((await snap()).fn === 'DCV', '鍵盤：聚焦 DCV 後按 Enter 切到 DCV');

    // 電源：關機按鍵無作用 → 開機回到預設（DCV、Auto、Null 關），情境不變
    await scen('dcv');
    await keys('ACV RANGE');
    await keys('POWER');
    T.ok((await snap()).on === false && (await ui.lcdText()) === '', '電源關：LCD 無畫面');
    await keys('DCV');
    T.ok((await snap()).fn === 'ACV' && (await ui.hint()).includes('電源關閉中'), '關機時按 DCV 沒有作用');
    await keys('POWER');
    s = await snap();
    T.ok(s.on && s.fn === 'DCV' && s.auto && Object.values(s.per).every((p) => p.auto && !p.nullOn) && s.fixture === 'dcv', '電源開：DCV、Auto、Null 關，測試情境保留');
    T.ok((await ui.lcdText()).includes('+01.234 00'), '開機後照常讀到 +01.234 00 VDC');

    // 外殼「重設這台」
    await keys('SHIFT ACV RANGE');
    await ui.page.click('[data-act="reset-one"]');
    s = await snap();
    T.ok(s.fn === 'DCV' && s.auto && !s.shift, '「重設這台」：回到 DCV、Auto');

    T.ok(ui.errors.length === 0, `沒有 JS 錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally {
    await ui.close();
  }
  return T;
}
