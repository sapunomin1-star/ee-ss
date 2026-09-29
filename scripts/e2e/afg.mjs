// AFG 真 UI：滑鼠點面板鍵、拖曳旋鈕、鍵盤調旋鈕；斷言讀 LCD 字串與唯讀狀態。
import { openApp, Check } from './lib.mjs';

const K = {
  WAVE: 'AFG.KEY.WAVEFORM', FREQ: 'AFG.KEY.FREQ_RATE', AMPL: 'AFG.KEY.AMPL', OFFSET: 'AFG.KEY.DC_OFFSET',
  CH: 'AFG.KEY.CH1_CH2', OUT: 'AFG.KEY.OUTPUT', PRESET: 'AFG.KEY.PRESET', RETURN: 'AFG.KEY.RETURN',
  LEFT: 'AFG.KEY.ARROW_LEFT', RIGHT: 'AFG.KEY.ARROW_RIGHT', PM: 'AFG.NUM.PLUS_MINUS', POWER: 'AFG.PWR.POWER',
  F1: 'AFG.SOFT.F1', F2: 'AFG.SOFT.F2', F3: 'AFG.SOFT.F3', F4: 'AFG.SOFT.F4', F5: 'AFG.SOFT.F5', UTIL: 'AFG.KEY.UTIL',
};

export async function run() {
  const T = new Check('AFG 真 UI');
  const ui = await openApp();
  const keys = (s) => ui.keys('AFG', K, s);
  const ch1 = async () => (await ui.snap('afg')).ch[0];
  try {
    await ui.tab('afg');
    await keys('PRESET AMPL 3.535 F3');
    T.ok((await ui.lcdText()).includes('3.535VRMS') || (await ui.lcdText()).includes('3.535 VRMS'), 'AMPL 3.535 → VRMS：LCD 顯示 3.535 VRMS');
    T.near((await ch1()).refVpp, 3.535 * 2 * Math.SQRT2, 1e-9, '已提交值是未捨入的 9.998489886 Vpp');
    await keys('F5');
    T.ok(/9\.998\s*VPP/.test(await ui.lcdText()), '只按 F5 VPP：LCD 顯示 9.998 VPP');
    await keys('23.98 F1');
    T.ok((await ui.hint()).includes('已拒絕'), '23.98 dBm 被拒絕並在儀器外提示');
    T.near((await ch1()).refVpp, 3.535 * 2 * Math.SQRT2, 1e-9, '拒絕後已提交值不變');
    await ui.shot('afg-ampl');

    // 旋鈕：拖曳（1 kHz → 游標到 kHz 位 → 往上拖一格 → 2 kHz）
    await keys('PRESET FREQ LEFT');
    await ui.dragKnob('AFG.KNOB.SCROLL_WHEEL', 1);
    T.ok((await ch1()).freq === 2000, `拖曳旋鈕一格：頻率 1 kHz → 2 kHz（實得 ${(await ch1()).freq}）`);
    // 旋鈕：鍵盤（聚焦後 ↓ 一格回到 1 kHz）
    await ui.page.locator('[data-id="AFG.KNOB.SCROLL_WHEEL"]').focus();
    await ui.page.keyboard.press('ArrowDown');
    T.ok((await ch1()).freq === 1000, '旋鈕聚焦後按 ↓：回到 1 kHz');
    T.ok(/1\.000000\s*kHz/.test(await ui.lcdText()), 'LCD 參數窗顯示 1.000000 kHz');

    // 聯合限制：offset +4 V 時 +13 dBm 拒絕
    await keys('PRESET AMPL 10 PM F1 OFFSET 4 F2 AMPL 13 F1');
    const c = await ch1();
    T.near(c.refVpp, 0.2, 1e-9, 'offset +4 V 時 +13 dBm 被拒絕，幅度保留 −10 dBm（0.2 Vpp）');
    T.ok(/-10\.00\s*dBm/.test(await ui.lcdText()), 'LCD 仍顯示 -10.00 dBm');

    // 未納入的鍵：UTIL 不改狀態
    const before = JSON.stringify(await ui.snap('afg'));
    await ui.press(K.UTIL);
    T.ok((await ui.hint()).includes('本輪未納入'), 'UTIL 顯示「本輪未納入」');
    T.ok(JSON.stringify(await ui.snap('afg')) === before, 'UTIL 不改變任何狀態');

    // CH2 獨立、Output
    await keys('PRESET OUT CH WAVE F4');
    const s = await ui.snap('afg');
    T.ok(s.ch[0].output === true && s.ch[1].output === false, 'CH1 ON、CH2 OFF 並存');
    T.ok(s.sel === 2 && s.ch[1].wave === 'RAMP' && s.ch[0].wave === 'SINE', 'CH2 改 Ramp 不影響 CH1');

    // 電源
    await ui.press(K.POWER);
    T.ok((await ui.snap('afg')).on === false && (await ui.lcdText()) === '', '電源關：LCD 無畫面');
    await ui.press(K.POWER);
    T.ok((await ui.snap('afg')).on === true && (await ch1()).output === false, '電源開：回到 Preset、Output OFF');
    T.ok(ui.errors.length === 0, `沒有 JS 錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally {
    await ui.close();
  }
  return T;
}
