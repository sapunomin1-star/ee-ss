// Actual panel, wiring and acquisition controls. __eess is read-only.
import { openApp, Check } from './lib.mjs';
import { APERTURE } from '../../src/instruments/dmm/model.js';

const A = { PRESET: 'AFG.KEY.PRESET', CH: 'AFG.KEY.CH1_CH2', AMPL: 'AFG.KEY.AMPL', OFFSET: 'AFG.KEY.DC_OFFSET',
  FREQ: 'AFG.KEY.FREQ_RATE', WAVE: 'AFG.KEY.WAVEFORM', OUT: 'AFG.KEY.OUTPUT', F1: 'AFG.SOFT.F1', F2: 'AFG.SOFT.F2', F3: 'AFG.SOFT.F3', F5: 'AFG.SOFT.F5' };

export async function run() {
  const T = new Check('含電容 AFG／GPE：實際週期保護與擷取');
  const ui = await openApp(), p = ui.page;
  const wire = async (id, hole) => { await p.click(`[data-lead="${id}"]`); await p.click(`[data-hole="${hole}"]`); };
  const knobTo = async (id, field, target, unit) => {
    let time = await p.evaluate(() => Date.now()), value = (await ui.snap('gpe'))[field][1];
    await p.locator(`[data-id="${id}"]`).focus();
    try {
      for (let n = 0; n < Math.round(Math.abs(target - value) / unit); n++) {
        await p.clock.setFixedTime(time += 200); await p.keyboard.press(target > value ? 'ArrowUp' : 'ArrowDown');
      }
    } finally { await p.clock.setSystemTime(time + 200); }
  };
  const phase = async (fraction) => {
    const ms = await p.evaluate(() => performance.now());
    const target = Math.ceil(ms / 1000) * 1000 + fraction * 1000;
    await p.clock.runFor(target - ms);
  };
  const visibleRow = () => p.$$eval('svg.screen [data-row="1"]', (els) => {
    const e = els.find((x) => getComputedStyle(x).visibility === 'visible');
    return e ? { v: Number(e.dataset.v), i: Number(e.dataset.a), mode: e.dataset.mode } : null;
  });
  try {
    const epoch = Date.now(); await p.clock.install({ time: epoch }); await p.reload();
    await p.locator('svg.panel').waitFor(); await p.clock.pauseAt(epoch + 1000);
    await ui.tab('afg'); await ui.keys('AFG', A, 'PRESET CH CH F1 F2 AMPL 10 F5 OFFSET 5 F2 FREQ 1 F3 WAVE F2');
    const a = (await ui.snap('afg')).ch[0];
    T.ok(a.wave === 'SQUARE' && a.freq === 1 && a.emfVpp === 10 && a.emfOffset === 5 && !a.output,
      '真按鍵設定 High Z 0～10 V、1 Hz 方波且輸出先關');
    await ui.tab('bench'); await p.check('input[name="benchView"][value="breadboard"]'); await p.click('[data-bb="clear"]');
    await p.check('input[name="bbtool"][value="C"]'); await p.selectOption('select[name="bbC"]', '4.7e-8');
    await p.click('[data-hole="a5"]'); await p.click('[data-hole="a10"]');
    for (const [id, hole] of Object.entries({ 'GPE.CH1+': 'b5', 'GPE.CH1-': 'b10', 'AFG.CH1+': 'c5', 'AFG.CH1-': 'c10',
      'TDS.CH1.TIP': 'd5', 'TDS.CH1.GND': 'd10', 'DMM.HI': 'e5', 'DMM.LO': 'e10' })) await wire(id, hole);
    await ui.tab('gpe'); await knobTo('GPE.KNOB.CH1_VOLTAGE', 'vset', 5, .01); await knobTo('GPE.KNOB.CH1_CURRENT', 'iset', .01, .001);
    const g = await ui.snap('gpe'); T.ok(g.vset[1] === 5 && g.iset[1] === .01, '真鍵盤設定 GPE 5 V／10 mA');
    await ui.press('GPE.KEY.OUTPUT_ON_OFF'); await ui.tab('afg'); await ui.press(A.OUT);
    await p.clock.runFor(400); await ui.tab('gpe');
    for (const wait of [0, 10000]) {
      if (wait) await p.clock.runFor(wait);
      await phase(.25); const high = await ui.snap('gpe'), h = await visibleRow();
      T.ok(high.readback[1].rb && !high.readback[1].cc && high.readback[1].i === 0 && h?.mode === 'RB', `${wait / 1000} 秒：高平台模型及 LCD 都是 RB／0 A`);
      T.near(high.readback[1].v, 10 / (1 + 50 * 2 / 1e7), 1e-6, '計入探棒與 DMM 負載的高平台電壓');
      await phase(.75); const low = await ui.snap('gpe'), l = await visibleRow();
      T.ok(low.readback[1].cc && !low.readback[1].rb && l?.mode === 'CC', `${wait / 1000} 秒：低平台模型及 LCD 都是 CC`);
      T.near(low.readback[1].i, .01, 1e-12, '原始 GPE 讀回為 10 mA');
      T.near(low.readback[1].v, .01 / (1 / 50 + 2 / 1e7), 1e-6, '低平台由 10 mA×50 Ω 決定');
    }
    const bench = await ui.snap('bench');
    T.ok(!bench.warn.some((w) => w.includes('目前不支援')) && bench.warn.some((w) => w.includes('逆灌')), '含電容求解有效，仍顯示實際逆灌提醒');
    await ui.shot('protection-capacitor-periodic');
    await ui.tab('dmm'); await ui.press('DMM.KEY.DCV'); await p.clock.runFor(400);
    const now = await p.evaluate(() => performance.now() / 1000), tr = Math.floor(now / APERTURE) * APERTURE;
    const high = 10 / (1 + 50 * 2 / 1e7), low = .01 / (1 / 50 + 2 / 1e7);
    const primitive = (t) => { const n = Math.floor(t), ph = t - n; return n * (high + low) / 2 + high * Math.min(ph, .5) + low * Math.max(0, ph - .5); };
    const expected = (primitive(tr) - primitive(tr - APERTURE)) / APERTURE;
    T.near((await ui.snap('dmm')).view.value, expected, .0002, 'DMM 10PLC 窗符合該時刻受限方波的獨立分段積分');
    await ui.tab('tds'); await ui.press('TDS.KEY.AUTOSET');
    // A next rising edge may be a whole period away. The record then needs
    // five horizontal divisions after the trigger, plus a 200 ms UI poll.
    const autoScope = await ui.snap('tds');
    const singleWaitMs = Math.ceil((1 / a.freq + 5 * autoScope.sdiv + .2) * 1000) + 150;
    await ui.press('TDS.KEY.SINGLE'); await p.clock.runFor(singleWaitMs);
    const scope = await ui.snap('tds'), capturedAt = await p.evaluate(() => performance.now() / 1000);
    T.ok(scope.status === 'Acq. Complete' && scope.rec?.triggered && Number.isFinite(scope.rec.abs0), '實際含電容受限方波可觸發 Single 並完成擷取');
    T.ok(Number.isFinite(scope.rec?.endAt) && scope.rec.endAt <= capturedAt + 1e-9, 'Single 完成時間不早於實際記錄的最後樣本');
    T.ok(await p.locator('svg.screen .wave').count() > 0 && !(await ui.lcdText()).includes('NaN'), '擷取後 LCD 波形與數值有限');
    await ui.shot('protection-capacitor-single');
    T.ok(ui.errors.length === 0, `沒有瀏覽器程式錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally { await ui.close(); }
  return T;
}
