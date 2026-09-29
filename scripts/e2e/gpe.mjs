// GPE-4323 真 UI：滑鼠點鍵、拖曳旋鈕、鍵盤細調與長按；測試情境用側欄單選鈕選。
// 斷言讀 LCD 的 DOM（依 CSS 可見性取看得到的那一層）與 window.__eess 唯讀狀態。
import { openApp, Check, sleep } from './lib.mjs';

const K = {
  V1: 'GPE.KNOB.CH1_VOLTAGE', I1: 'GPE.KNOB.CH1_CURRENT', V4: 'GPE.KNOB.CH4_VOLTAGE',
  V2: 'GPE.KNOB.CH2_VOLTAGE', I2: 'GPE.KNOB.CH2_CURRENT', V3: 'GPE.KNOB.CH3_VOLTAGE',
  LEFT: 'GPE.KEY.TRACK_LEFT', RIGHT: 'GPE.KEY.TRACK_RIGHT', CH14: 'GPE.KEY.CH1_CH4', CH23: 'GPE.KEY.CH2_CH3',
  SET: 'GPE.KEY.SET_VIEW', OUT: 'GPE.KEY.OUTPUT_ON_OFF', POWER: 'GPE.PWR.POWER',
};

export async function run() {
  const T = new Check('GPE-4323 真 UI');
  const ui = await openApp();
  const { page } = ui;
  const snap = () => ui.snap('gpe');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // LCD 上看得到的兩列：[通道, 電壓欄, 電流欄, CV/CC]
  const rows = () => page.$$eval('svg.screen [data-row]', (els) => els
    .filter((e) => getComputedStyle(e).visibility === 'visible')
    .map((e) => [Number(e.dataset.ch), e.dataset.v, e.dataset.a, e.dataset.mode]));
  const lit = () => page.$$eval('svg.screen text.lit', (els) => els
    .filter((e) => getComputedStyle(e).visibility === 'visible').map((e) => e.textContent));
  const cls = async (id) => (await page.locator(`[data-id="${id}"]`).getAttribute('class')).split(/\s+/);
  const scen = async (id) => { await page.check(`input[name=scen][value="${id}"]`); await sleep(30); };
  // 拖曳前先停一下，和上一次轉動隔開：第一格細調、之後快轉
  const drag = async (id, n) => { await sleep(250); await ui.dragKnob(id, n); };
  // 聚焦旋鈕後按方向鍵；每格間隔 >150 ms，才不會被當成快轉
  const nudge = async (id, n) => {
    await page.locator(`[data-id="${id}"]`).focus();
    for (let i = 0; i < Math.abs(n); i++) { await sleep(220); await page.keyboard.press(n > 0 ? 'ArrowUp' : 'ArrowDown'); }
  };
  const longPress = async (id) => {
    const b = await page.locator(`[data-id="${id}"]`).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down(); await sleep(900); await page.mouse.up(); await sleep(30);
  };
  try {
    await ui.tab('gpe');
    T.ok(same(await rows(), [[1, '0.00', '0.100', ''], [2, '0.00', '0.100', '']]), 'LCD 初始：①② 顯示設定 0.00 V／0.100 A');
    T.ok((await lit()).includes('OFF') && !(await lit()).includes('ON'), 'LCD 亮 OFF、不亮 ON');

    // L1：CH1 設 5.00 V（拖曳粗調＋方向鍵細調）
    await scen('ch1-100');
    await drag(K.V1, 6);
    T.ok((await snap()).vset[1] === 5, `拖曳 CH1 Voltage 6 格：第一格細調、之後快轉對齊整數 → 5.00 V（實得 ${(await snap()).vset[1]}）`);
    await nudge(K.V1, -1);
    T.ok((await snap()).vset[1] === 4.99, '聚焦後按 ↓：4.99 V（一格 10 mV）');
    await nudge(K.V1, 1);
    T.ok(same((await rows())[0], [1, '5.00', '0.100', '']), 'Output OFF：LCD 顯示設定值 5.00 V／0.100 A（不是讀回）');

    await ui.press(K.OUT);
    T.ok(same((await rows())[0], [1, '5.00', '0.050', 'CV']), '100 Ω、Output ON：讀回 5.00 V／0.050 A、CV');
    T.ok((await cls(K.OUT)).includes('lit') && (await lit()).includes('ON') && !(await lit()).includes('OFF'), 'On/Off 鍵燈亮、LCD 亮 ON');
    await ui.shot('gpe-l1-cv');

    // Set View：看設定、再按返回、3 秒沒操作自己返回
    await ui.press(K.SET);
    T.ok(same((await rows())[0], [1, '5.00', '0.100', '']) && (await lit()).includes('Set'), 'Set View：顯示 I-set 0.100 A、亮 Set');
    await ui.press(K.SET);
    T.ok(same((await rows())[0], [1, '5.00', '0.050', 'CV']), '再按 Set View：回到讀回');
    await ui.press(K.SET);
    await sleep(3300);
    T.ok(same((await rows())[0], [1, '5.00', '0.050', 'CV']) && !(await snap()).setView, 'Set View 3 秒沒操作：LCD 自己回到讀回');

    await scen('ch1-10');
    T.ok(same((await rows())[0], [1, '1.00', '0.100', 'CC']), '換 10 Ω：CC 1.00 V／0.100 A');
    await ui.shot('gpe-l1-cc');
    await scen('open');
    T.ok(same((await rows())[0], [1, '5.00', '0.000', 'CV']), '開路：CV 5.00 V／0.000 A（不是 I-set）');

    // Series：換模式 Output 自動關 → 重新 ON；CH2 Voltage 無效；CH1 Voltage 兩列同步
    await scen('ch1-100');
    await ui.press(K.RIGHT);
    let s = await snap();
    T.ok(s.mode === 'SER' && !s.output && !(await cls(K.OUT)).includes('lit'), '按右模式鍵 → Series，Output 自動 OFF、鍵燈熄');
    T.ok((await cls(K.RIGHT)).includes('active') && (await lit()).includes('SER') && (await lit()).includes('OFF'), '右鍵呈按下狀態；LCD 亮 SER、OFF');
    await ui.press(K.OUT);
    T.ok(same(await rows(), [[1, '5.00', '0.050', 'CV'], [2, '5.00', '0.000', 'CV']]), '重新 ON：CH1 master 5.00 V／0.050 A，CH2 slave 跟著 5.00 V');
    await drag(K.V2, 3);
    T.ok(same((await rows())[1], [2, '5.00', '0.000', 'CV']) && (await ui.hint()).includes('Series'), '轉 CH2 Voltage：輸出不變，儀器外說明');
    await nudge(K.V1, 1);
    T.ok((await rows()).every((r) => r[1] === '5.01'), '轉 CH1 Voltage：兩列同步 5.01 V');
    await nudge(K.V1, -1);
    await ui.shot('gpe-series');

    // Parallel：CH2 顯示 CC、每列一半電流、CH2 旋鈕停用
    await ui.press(K.LEFT);
    s = await snap();
    T.ok(s.mode === 'PARA' && !s.output && (await lit()).includes('PARA'), '再按左模式鍵 → Parallel，Output 自動 OFF、亮 PARA');
    await ui.press(K.OUT);
    T.ok(same(await rows(), [[1, '5.00', '0.025', 'CV'], [2, '5.00', '0.025', 'CC']]), 'Parallel ON：每列 0.025 A（總電流一半），CH2 亮 CC');
    await drag(K.I2, 3);
    T.ok(same((await rows())[1], [2, '5.00', '0.025', 'CC']), '轉 CH2 Current：停用，讀回不變');
    await ui.press(K.LEFT); await ui.press(K.RIGHT);
    s = await snap();
    T.ok(s.mode === 'INDEP' && !s.output && !(await lit()).includes('SER') && !(await lit()).includes('PARA'), '兩鍵彈起 → Independent，SER／PARA 熄');

    // CH3／CH4：換模式後要重新 ON 讀回才回來（GPE-F10）
    await scen('ch34');
    await ui.press(K.CH23); await drag(K.V3, 6);
    await ui.press(K.CH14); await drag(K.V4, 6);
    T.ok(same(await rows(), [[4, '5.00', '---', ''], [3, '5.00', '---', '']]), '切到 ④③：Output OFF 顯示設定 5.00 V，電流欄「---」');
    await ui.press(K.OUT);
    T.ok(same(await rows(), [[4, '5.00', '0.005', 'CV'], [3, '5.00', '0.050', 'CV']]), 'ON：CH4 1 kΩ → 0.005 A、CH3 100 Ω → 0.050 A，都 CV');
    await ui.shot('gpe-ch34');
    await ui.press(K.RIGHT);
    T.ok(!(await snap()).output && same((await rows()).map((r) => r[0]), [1, 2]), '換 Series：四路全 OFF，兩列回到 ①②');
    await ui.press(K.CH23); await ui.press(K.CH14);
    T.ok(same(await rows(), [[4, '5.00', '---', ''], [3, '5.00', '---', '']]), '再切到 ④③：顯示設定值，不是讀回');
    await ui.press(K.OUT);
    T.ok(same(await rows(), [[4, '5.00', '0.005', 'CV'], [3, '5.00', '0.050', 'CV']]), '重新 ON：CH3／CH4 讀回回來');
    await ui.press(K.RIGHT); // 回 Independent（Output 自動 OFF、兩列回 ①②）

    // Lock：長按 Set View；CH1 Voltage 不動、On/Off 照常、解鎖時 Output 關
    await scen('ch1-100');
    await ui.press(K.OUT);
    await longPress(K.SET);
    T.ok((await snap()).lock && (await lit()).includes('Lock'), '滑鼠按住 Set View 0.9 秒 → Lock 亮');
    await drag(K.V1, 2);
    T.ok((await snap()).vset[1] === 5 && (await ui.hint()).includes('Lock'), 'Lock 中拖曳 CH1 Voltage：設定不變並提示');
    await ui.press(K.OUT);
    T.ok(!(await snap()).output, 'Lock 中 On/Off 照常能關');
    await ui.press(K.OUT);
    await ui.shot('gpe-lock');
    await page.locator(`[data-id="${K.SET}"]`).focus();
    await page.keyboard.press('Shift+Enter');
    s = await snap();
    T.ok(!s.lock && !s.output && !(await lit()).includes('Lock'), '鍵盤 Shift+Enter（長按）解鎖：Lock 熄、Output 自動 OFF');

    // 電源：關 → LCD 全暗；開 → 全段 1 秒後回到重設狀態，測試情境保留
    await ui.press(K.POWER);
    T.ok(!(await snap()).on && (await ui.lcdText()) === '' && !(await cls(K.OUT)).includes('lit'), '關機：LCD 無畫面、鍵燈熄');
    await ui.press(K.POWER);
    T.ok((await rows()).every((r) => r[1] === '8.8.8.8.'), '開機：LCD 先全段顯示');
    await sleep(1200);
    s = await snap();
    T.ok(same(await rows(), [[1, '0.00', '0.100', ''], [2, '0.00', '0.100', '']]) && s.mode === 'INDEP' && !s.output && s.load === 'ch1-100',
      '1 秒後回到重設狀態（0.00 V／0.100 A、Independent、OFF），測試情境保留');
    T.ok(ui.errors.length === 0, `沒有 JS 錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally {
    await ui.close();
  }
  return T;
}
