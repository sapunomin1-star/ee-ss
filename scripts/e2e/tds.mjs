// TDS2001C 真 UI：滑鼠點面板鍵、拖曳旋鈕、旋鈕聚焦後按方向鍵；測試情境用側欄單選鈕選。
// 斷言只讀 LCD 上的字串／波形座標與 window.__eess 的唯讀狀態，不經由掛鉤操作。
import { openApp, Check, sleep } from './lib.mjs';

const K = {
  AUTOSET: 'TDS.KEY.AUTOSET', DEFAULT: 'TDS.KEY.DEFAULT_SETUP', RUN: 'TDS.KEY.RUN_STOP', SINGLE: 'TDS.KEY.SINGLE',
  CH1: 'TDS.KEY.CH1_MENU', CH2: 'TDS.KEY.CH2_MENU', MATH: 'TDS.KEY.MATH_MENU', TRIG: 'TDS.KEY.TRIG_MENU', MEAS: 'TDS.KEY.MEASURE',
  CURSOR: 'TDS.KEY.CURSOR', FIFTY: 'TDS.KEY.SET_TO_50', FORCE: 'TDS.KEY.FORCE_TRIG', POWER: 'TDS.PWR.ON_OFF',
  O1: 'TDS.SOFT.OPT1', O2: 'TDS.SOFT.OPT2', O3: 'TDS.SOFT.OPT3', O4: 'TDS.SOFT.OPT4', O5: 'TDS.SOFT.OPT5',
  V1: 'TDS.KNOB.CH1_VOLTS_DIV', P1: 'TDS.KNOB.CH1_POSITION', HS: 'TDS.KNOB.HORIZ_SCALE', LEVEL: 'TDS.KNOB.TRIG_LEVEL', MULTI: 'TDS.KNOB.MULTIPURPOSE',
};
const CY = 116; // LCD 上 graticule 中央的 y（lcd.js：GY 16＋100）

export async function run() {
  const T = new Check('TDS2001C 真 UI');
  const ui = await openApp();
  const p = ui.page;
  const keys = async (seq) => { for (const t of seq.split(/\s+/).filter(Boolean)) await ui.press(K[t]); };
  // 旋鈕：聚焦後按 ↑（順時針）或 ↓ n 次
  const knob = async (id, n) => {
    await p.locator(`[data-id="${K[id]}"]`).focus();
    for (let i = 0; i < Math.abs(n); i++) await p.keyboard.press(n > 0 ? 'ArrowUp' : 'ArrowDown');
  };
  const scen = async (id) => { await p.check(`input[name=scen][value=${id}]`); await sleep(30); };
  const snap = () => ui.snap('tds');
  const lcd = (sel) => p.evaluate((s) => document.querySelector(`svg.screen ${s}`)?.textContent ?? null, sel);
  const wave = (ch) => p.evaluate((c) => {
    const pts = document.querySelector(`svg.screen .wave.ch${c}`)?.getAttribute('points');
    return pts ? pts.trim().split(' ').map((q) => q.split(',').map(Number)) : null;
  }, ch);
  const ys = async (ch) => (await wave(ch))?.map((q) => q[1]) ?? [];
  const center = async (ch) => { const y = await ys(ch); return (Math.max(...y) + Math.min(...y)) / 2; };
  const width = async (ch) => { const x = (await wave(ch)).map((q) => q[0]); return Math.max(...x) - Math.min(...x); };
  const ledLit = () => p.locator('[data-id="TDS.LED.MULTIPURPOSE"]').evaluate((el) => el.classList.contains('lit'));
  let s;
  try {
    await ui.tab('tds');
    s = await snap();
    T.ok(s.status === 'Scan' && (await lcd('.rd-m')) === 'M 500ms', '首次載入＝Default Setup：M 500ms、狀態 Scan');

    // ---- AutoSet（S1）----
    await ui.press(K.AUTOSET);
    s = await snap();
    T.ok((await lcd('.rd-ch1')) === 'CH1 500mV' && (await lcd('.rd-m')) === 'M 250µs', 'Auto Set：LCD 讀值 CH1 500mV、M 250µs');
    T.ok(s.status === "Trig'd" && (await lcd('.rd-status')) === "TTrig'd", "LCD 觸發狀態 Trig'd");
    T.ok((await lcd('.am2'))?.includes('Freq 1.000kHz') && (await lcd('.am4'))?.includes('Pk-Pk 2.00V'), 'AutoSet 自動量測：Freq 1.000kHz、Pk-Pk 2.00V');
    let y = await ys(1);
    T.near(((Math.max(...y) - Math.min(...y)) / 25) * s.ch[0].vdiv, 2, 0.02, '同一份採集：LCD 波形的格數 × V/div＝Pk-Pk 2 V');
    await ui.shot('tds-autoset');

    // ---- 拖曳 V/div 旋鈕 ----
    await ui.dragKnob(K.V1, -1);
    s = await snap();
    y = await ys(1);
    T.ok(Math.abs(s.ch[0].vdiv - 1) < 1e-9 && Math.abs((Math.max(...y) - Math.min(...y)) / 25 - 2) < 0.02, '往下拖 CH1 刻度一格：1 V/div，波形高度變 2 div');
    await ui.dragKnob(K.V1, 1);

    // ---- Measure 用多功能旋鈕選 Type；Probe 錯配 ----
    await keys('MEAS O1');
    T.ok(await ledLit(), 'Measure 1 選單：多功能旋鈕 LED 亮');
    await knob('MULTI', 4); // None → Freq → Period → Mean → Pk-Pk
    await keys('O5');
    T.ok((await lcd('.mb1')) === 'CH1Pk-Pk2.00V' && !(await ledLit()), 'Measure 1＝CH1 Pk-Pk 2.00V；回頂層後 LED 熄滅');
    await keys('CH1 O4');
    await knob('MULTI', -1); // 10X → 1X
    T.ok((await lcd('.rd-ch1')) === 'CH1 50.0mV', 'Probe 設 1X（實際 10×）：V/div 讀值變 50.0mV');
    await keys('MEAS');
    T.ok((await lcd('.mb1')) === 'CH1Pk-Pk200mV', '探棒錯配：Pk-Pk 讀成 200mV（真值的 1/10）');
    await keys('CH1 O4');
    await knob('MULTI', 1);
    await keys('O5');
    T.ok((await snap()).ch[0].probe === 10, 'Probe 改回 10X');

    // ---- 耦合 AC／Ground／DC（S1：2 Vpp＋0.5 V DC）----
    await keys('O1');
    T.ok((await lcd('.mb1')) === 'CouplingAC' && Math.abs((await center(1)) - CY) < 0.6, 'Coupling AC：波形中心回到接地標記');
    await keys('O1');
    y = await ys(1);
    T.ok((await lcd('.mb1')) === 'CouplingGround' && y.every((v) => Math.abs(v - CY) < 0.1), 'Coupling Ground：只剩接地標記上的水平線');
    await keys('O1');
    T.ok(Math.abs((await center(1)) - (CY - 25)) < 0.6, 'Coupling DC：波形中心在 +0.5 V（500 mV/div 時高 1 div）');

    // ---- Stop 後改訊號與設定 ----
    await keys('MEAS O2');
    await knob('MULTI', 1);
    await keys('O5');
    T.ok((await lcd('.mb2')) === 'CH1Freq1.000kHz', 'Measure 2＝CH1 Freq 1.000kHz');
    await ui.press(K.RUN);
    s = await snap();
    const n0 = s.rec.n;
    T.ok(s.status === 'Stop' && (await lcd('.rd-status')) === 'Stop', 'Run/Stop：LCD 狀態 Stop');
    await scen('S1F');
    s = await snap();
    T.ok(s.rec.n === n0 && (await lcd('.mb2')) === 'CH1Freq1.000kHz', '停止後把訊號改成 2 kHz：波形紀錄與 Measure 仍是 1.000kHz');
    T.ok((await lcd('.rd-freq')) === '2.00000kHz', '右下角觸發頻率讀值跟著新訊號：2.00000kHz');
    const w0 = await width(1);
    await ui.dragKnob(K.HS, -1);
    T.near(await width(1), w0 / 2, 3, '停止時 s/div 250→500 µs：凍結波形縮成一半寬');
    await keys('TRIG O3');
    T.ok((await p.evaluate(() => document.querySelector('svg.screen .wave.ch1')?.getAttribute('stroke-dasharray'))) === '3 2', '停止後改 Slope：波形改為斷線樣式');
    const a0 = (await snap()).acqN;
    await ui.press(K.FORCE);
    T.ok((await snap()).acqN === a0 && (await ui.hint()).includes('沒有作用'), '停止時按 Force Trig 沒有作用');
    await ui.shot('tds-stopped');
    await ui.press(K.RUN);
    s = await snap();
    T.ok(s.rec.n > n0 && s.status === "Trig'd" && s.meas[1].text === '2.000kHz', '再按 Run/Stop：恢復採集，Measure 2 Freq 變 2.000kHz');
    await keys('TRIG O3');
    await ui.dragKnob(K.HS, 1);

    // ---- S3c：Level 超出範圍，Normal 與 Auto ----
    await scen('S3C');
    await ui.press(K.AUTOSET);
    await keys('TRIG O4');
    s = await snap();
    T.ok(s.trig.mode === 'NORMAL' && s.status === "Trig'd" && (await lcd('.mb4')) === 'ModeNormal', "Trig Menu → Mode Normal（仍 Trig'd）");
    await knob('LEVEL', 110); // +0.5 V → +1.6 V，超過峰值 +1.5 V
    s = await snap();
    const n1 = s.rec.n;
    T.ok(s.status === 'Ready' && (await lcd('.rd-status')) === 'RReady' && (await lcd('.rd-freq')) === null, 'Level 轉出範圍：Ready，觸發頻率讀值消失');
    await keys('MEAS CURSOR TRIG');
    T.ok((await snap()).rec.n === n1 && (await ys(1)).length > 100, 'Normal 沒有觸發：不再採集、舊波形保留');
    await ui.shot('tds-normal-ready');
    await keys('O4');
    s = await snap();
    T.ok(s.status === 'Auto' && s.rec.n > n1 && !s.rec.triggered, 'Mode 改 Auto：狀態 Auto、畫面自由更新（未觸發）');
    T.ok((await p.evaluate(() => document.querySelectorAll('svg.screen animate[attributeName=opacity]').length)) === 4, 'Auto 無觸發：LCD 輪播 4 幀隨機相位');
    await ui.press(K.FIFTY);
    s = await snap();
    T.ok(s.status === "Trig'd" && Math.abs(s.trig.levelV - 0.5) < 1e-9 && (await lcd('.rd-trig')) === 'CH1500mV', "Set To 50%：Level 回到 500mV、Trig'd");

    // ---- S3a：Default Setup 起 Normal 沒有新波形；Force Trig ----
    await scen('S3A');
    await ui.press(K.DEFAULT);
    T.ok((await lcd('.rd-msg')) === 'Default setup recalled', 'Default Setup：訊息區 Default setup recalled');
    await keys('TRIG O4');
    const a1 = (await snap()).acqN;
    await keys('MEAS TRIG');
    s = await snap();
    T.ok(s.acqN === a1 && s.status === 'Ready', 'S3a＋Normal：沒有新採集、狀態 Ready');
    await ui.press(K.FORCE);
    T.ok((await snap()).acqN === a1 + 1, 'Force Trig：出現一幀');

    // ---- S2：游標量延遲 ----
    await scen('S2');
    await ui.press(K.AUTOSET);
    s = await snap();
    T.ok(s.ch.every((c) => c.on && Math.abs(c.vdiv - 0.5) < 1e-9) && Math.abs(s.sdiv - 250e-6) < 1e-12, 'S2 Auto Set：兩通道 500 mV/div、250 µs/div');
    await keys('CURSOR O1 O4');
    T.ok(await ledLit(), '選 Cursor 1：多功能旋鈕 LED 亮');
    await knob('MULTI', 100); // 游標 1 → 中央（CH1 零交越）
    await keys('O5');
    await knob('MULTI', -87); // 游標 2 → +13 步（CH2 零交越附近）
    s = await snap();
    T.near(s.cursor.info.dt, 125e-6, 10e-6, 'Time 游標量 CH1→CH2 延遲：Δt 在 125±10 µs');
    T.ok((await lcd('.mb3'))?.startsWith('Δt 130.0µs'), 'Cursor 選單顯示 Δt 130.0µs');
    await ui.shot('tds-cursor');

    // ---- AutoSet 恢復案例：CH1 Position +5 div ----
    await knob('P1', 125);
    T.ok((await snap()).ch[0].pos === 5, 'CH1 Position 轉到 +5.00 div');
    await ui.press(K.AUTOSET);
    s = await snap();
    T.ok(s.ch[0].pos === 0 && Math.abs(s.ch[0].vdiv - 0.5) < 1e-9, 'Auto Set：CH1 Position 歸零、500 mV/div，波形回到畫面');

    // ---- 量測無效：CH2 關閉 ----
    await keys('CH2 CH2');
    T.ok(!(await snap()).ch[1].on && (await lcd('.rd-ch2')) === null, '連按 2：CH2 關閉、V/div 讀值消失');
    await keys('MEAS O2');
    await knob('MULTI', 1);
    await keys('O1 O5');
    T.ok((await lcd('.mb2')) === 'CH2Freq', 'Measure 2 來源 CH2（未顯示）：數值留空，不顯示 0');

    // ---- Newly supported Math and Invert ----
    const before = JSON.stringify((await snap()).ch);
    await ui.press(K.MATH);
    T.ok((await snap()).extended.math.on && (await lcd('.mtitle')) === 'Math', 'Math opens an active arithmetic menu');
    await keys('CH1 O5');
    T.ok((await snap()).extended.invert[0] && (await lcd('.mb5')) === 'InvertOn' && JSON.stringify((await snap()).ch) === before, 'Invert turns on without overwriting channel range/probe settings');

    // ---- 電源 ----
    await ui.press(K.POWER);
    T.ok(!(await snap()).on && (await ui.lcdText()) === '', '電源關：LCD 無畫面');
    await ui.press(K.POWER);
    s = await snap();
    T.ok(s.on && Math.abs(s.ch[0].vdiv - 0.5) < 1e-9 && Math.abs(s.sdiv - 250e-6) < 1e-12 && s.status === "Trig'd", '電源開：回復關機前設定並重新採集');

    // ---- 採集時削頂（p.108 10 格動態範圍）：停止後把 V/div 轉回，削掉的波峰不會回來 ----
    await scen('S1X5');
    await ui.press(K.AUTOSET);
    await knob('V1', 3); // 2 V/div → 200 mV/div
    T.ok((await lcd('.rd-ch1')) === 'CH1 200mV' && (await lcd('.am4')) === 'CH1 Pk-Pk 2.00V?', 'S1X5 AutoSet 後 V/div 轉小 3 格：Pk-Pk 2.00V?（採集時削頂）');
    await ui.press(K.RUN);
    await knob('V1', -3);
    y = await ys(1);
    T.ok((await lcd('.rd-ch1')) === 'CH1 2.00V' && (await lcd('.am4')) === 'CH1 Pk-Pk 2.00V?', '停止後轉回 2 V/div：Pk-Pk 仍是 2.00V?，不會變回 10.0V');
    T.near((Math.max(...y) - Math.min(...y)) / 25, 1, 0.05, '凍結的波形是 1 div 高的平頂（±1 V）');
    await ui.shot('tds-clipped');
    await ui.press(K.RUN);

    // ---- 慢時基欠取樣（取樣率＝250 點／div）：逐點混疊、畫面不穩，不再畫包絡帶 ----
    await scen('S1');
    await ui.press(K.AUTOSET);
    await keys('TRIG O4'); // Normal：慢時基不進 Scan
    await knob('HS', -9); // 250 µs → 250 ms/div
    s = await snap();
    const nFrames = await p.evaluate(() => document.querySelectorAll('svg.screen animate[attributeName=opacity]').length);
    T.ok(s.status === "Trig'd" && (await lcd('.rd-m')) === 'M 250ms' && nFrames === 4, '1 kHz 用 250 ms/div（Normal）：已觸發但欠取樣，LCD 輪播 4 幀不同相位');
    T.ok((await p.evaluate(() => document.querySelectorAll('svg.screen rect.wave').length)) === 0 && (await lcd('.rd-freq')) === '1.00000kHz', '沒有包絡帶；右下角觸發頻率仍是真實的 1.00000kHz');
    await keys('O4');
    await knob('HS', 9);

    // ---- 實驗台 20 Hz 方波：AutoSet 辨識方波、AC 耦合的平台傾斜、BW Limit ----
    await ui.tab('afg');
    for (const id of ['KEY.PRESET', 'KEY.CH1_CH2', 'KEY.CH1_CH2', 'SOFT.F1', 'SOFT.F2', 'KEY.AMPL', 'NUM.DIGIT_2', 'SOFT.F5',
      'KEY.WAVEFORM', 'SOFT.F2', 'KEY.FREQ_RATE', 'NUM.DIGIT_2', 'NUM.DIGIT_0', 'SOFT.F3', 'KEY.OUTPUT']) await ui.press(`AFG.${id}`);
    await ui.tab('bench');
    await p.click('[data-bb="demo-rc"]');
    await ui.tab('tds');
    await ui.press(K.AUTOSET);
    s = await snap();
    T.ok(s.scenario === 'BENCH' && (await lcd('.rd-msg')) === 'Square wave or pulse detected on CH1', 'AutoSet 辨識方波：訊息區 Square wave or pulse detected on CH1');
    T.ok((await lcd('.mb1')) === 'Multi-cyclesquare' && (await lcd('.mb5')) === 'UndoAutoset', 'AutoSet 選單：Multi-cycle square（選取中）… OPT5 Undo Autoset');
    const am = await Promise.all([1, 2, 3, 4].map((k) => lcd(`.am${k}`)));
    T.ok(am[0] === 'CH1 Pk-Pk 2.00V' && am[1]?.startsWith('CH1 Mean ') && am[2] === 'CH1 Period 50.00ms' && am[3] === 'CH1 Freq 20.00Hz', `方波自動量測 Pk-Pk、Mean、Period、Freq（${am.join('／')}）`);
    await keys('CH1 O1'); // Coupling AC
    s = await snap();
    const pk = s.autoMeas.find((a) => a.type === 'PKPK').text;
    T.ok(s.ch[0].coupling === 'AC' && pk === '2.15V', `CH1 AC 耦合（10× 探棒 fc 1 Hz）：20 Hz 方波平台傾斜，Pk-Pk 2.00V → ${pk}`);
    await ui.shot('tds-ac-square');
    await keys('O2'); // BW Limit On
    const hbw = await ui.hint();
    T.ok((await lcd('.mb2')) === 'BW LimitOn20MHz' && hbw.includes('一階低通 fc＝20 MHz') && !hbw.includes('只切換'), 'BW Limit On：提示說明 20 MHz 一階低通（近似），不再說只切換圖示');
    await keys('O2 O1 O1'); // BW Off；Coupling AC → Ground → DC
    T.ok((await snap()).ch[0].coupling === 'DC', '耦合改回 DC');
    T.ok(ui.errors.length === 0, `沒有 JS 錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally {
    await ui.close();
  }
  return T;
}
