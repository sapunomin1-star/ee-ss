import { openApp, Check, sleep } from './lib.mjs';

export async function run() {
  const T = new Check('TDS extended functions'), ui = await openApp(), p = ui.page;
  const key = (s) => ui.press(`TDS.KEY.${s}`), opt = (n) => ui.press(`TDS.SOFT.OPT${n}`);
  const snap = () => ui.snap('tds');
  const has = (selector) => p.locator(`svg.screen ${selector}`).count();
  const knob = async (id, direction = 'ArrowUp') => { await p.locator(`[data-id="TDS.KNOB.${id}"]`).focus(); await p.keyboard.press(direction); };
  try {
    await ui.tab('tds'); await p.check('input[name=scen][value=S2]'); await key('AUTOSET');
    await key('MATH_MENU');
    T.ok((await snap()).extended.math.on && await has('.wave.math'), 'Math produces an arithmetic waveform');
    await opt(1); T.ok((await snap()).extended.math.op === '×', 'Math multiplication is selectable');
    await opt(1); T.ok((await snap()).extended.math.op === 'FFT' && await has('.wave.fft'), 'Math FFT displays a spectrum');
    await opt(1); T.ok((await snap()).extended.math.op === '+', 'Math addition is selectable');
    await key('CH1_MENU'); await opt(5);
    T.ok((await snap()).extended.invert[0], 'CH1 Invert toggles on');
    await opt(5);
    await key('DISPLAY'); await opt(1);
    T.ok(await has('.wave.ch1.dots'), 'Display Dots draws sample points');
    await opt(3); let s = await snap();
    T.ok(s.extended.display.format === 'XY' && s.rec.dt === 1e-6 && !s.rec.triggered && await has('.wave.xy'), 'XY uses untriggered 1MS/s data');
    T.ok(!(await has('.wave.math')), 'XY suppresses Math');
    await key('AUTOSET'); await key('SAVE_RECALL'); await opt(5);
    T.ok((await snap()).memory.setups[0], 'Save Setup stores slot 1');
    await opt(1); await opt(5); await key('REF'); await opt(1);
    T.ok((await snap()).memory.references[0] && await has('.wave.ref0'), 'RefA displays saved waveform');
    const refShape = await p.locator('svg.screen .wave.ref0').getAttribute('points');
    await p.locator('[data-id="TDS.KNOB.HORIZ_SCALE"]').focus(); await p.keyboard.press('ArrowUp');
    T.ok(await p.locator('svg.screen .wave.ref0').getAttribute('points') === refShape, 'Reference remains frozen when live time-base changes');
    await key('ACQUIRE'); await opt(3);
    await p.locator('[data-id="TDS.KNOB.MULTIPURPOSE"]').focus(); await p.keyboard.press('ArrowDown');
    T.ok((await snap()).extended.averages === 4, 'Average count changes to 4');
    await key('SINGLE');
    await sleep(600); s = await snap();
    T.ok(s.complete && s.rec.mode === 'AVERAGE' && s.rec.averageCount === 4, 'Average Single completes after 4 autonomous acquisitions');
    await key('AUTOSET'); await opt(2);s=await snap();
    T.ok(s.sdiv===100e-6 && s.autoMeas.map(x=>x.type).join(',')==='MEAN,PKPK','AutoSet Single-cycle sets about one cycle and documented measurements');
    await opt(3);await key('CURSOR');await opt(1);await opt(2);await opt(2);s=await snap();
    T.ok(s.extended.cursorSource==='MATH' && s.cursor.info.type==='FREQ' && await has('.cursor'),'FFT Frequency cursors use the actual spectrum');
    await key('AUTOSET');await key('CH1_MENU');await opt(3);const gain=(await snap()).ch[0].vdiv;
    await knob('CH1_VOLTS_DIV');T.near((await snap()).ch[0].vdiv,gain/1.02,1e-9,'Fine changes real V/div by the teaching 2% step');
    await key('HORIZ_MENU');await opt(2);await knob('HORIZ_SCALE');await knob('HORIZ_POSITION');
    T.ok((await snap()).extended.horizontal.view==='ZONE' && await has('.window-zone'),'Window Zone draws the bounded region');
    await opt(3);s=await snap();T.ok(s.extended.horizontal.view==='WINDOW' && s.sdiv<250e-6 && s.mpos!==0,'Window expands and positions the selected region');
    await opt(4);await knob('MULTIPURPOSE');T.ok((await snap()).extended.horizontal.holdoff>0,'Holdoff is adjustable with the multipurpose knob');
    await key('AUTOSET');await key('TRIG_MENU');await opt(1);await opt(4);const width=(await snap()).extended.pulse.width;
    await knob('MULTIPURPOSE');s=await snap();T.ok(s.extended.pulse.type==='PULSE' && s.extended.pulse.width>width,'Pulse width is selectable and changes through its active knob');
    await opt(5);await opt(2);T.ok((await snap()).extended.pulse.polarity==='NEGATIVE','Pulse second page selects negative polarity');
    await opt(4);await opt(4);await opt(4);T.ok((await snap()).trig.coup==='HF','HF Reject is an active trigger coupling option');
    await key('AUTOSET');
    const view=p.locator('[data-id="TDS.KEY.TRIG_VIEW"]');await view.focus();await p.keyboard.down('Space');
    T.ok(await has('.trigger-view'),'Holding Trig View displays the conditioned trigger trace');
    await p.keyboard.up('Space');T.ok(!(await has('.trigger-view')),'Releasing Trig View restores channel display');
    await key('UTILITY');await opt(4);await opt(4);await opt(3);await opt(5);await opt(3);await sleep(300);s=await snap();
    T.ok(s.limit.masks[0] && s.limit.passed>0 && await has('.limit-mask'),'Limit Test creates a mask and counts actual passing captures');
    await key('RUN_STOP');await p.check('input[name=scen][value=S1X5]');await key('SINGLE');s=await snap();
    T.ok(s.limit.failed>0 && s.limit.result==='FAIL','Limit Test detects a changed signal against the retained mask');
    await key('UTILITY');await opt(5);await opt(1);await opt(1);await key('RUN_STOP');await sleep(300);await key('RUN_STOP');
    T.ok((await snap()).logging.records>0,'Data Logging autonomously collects actual triggered record summaries');
    const loggedDownload=p.waitForEvent('download');await opt(4);const logFile=await loggedDownload;
    T.ok(logFile.suggestedFilename()==='TDS2001C-data-log.csv','Data Logging downloads browser CSV');
    await key('MEASURE');await key('HELP');T.ok((await snap()).menu==='HELP' && await has('.info-overlay'),'Help presents a readable teaching topic');
    await key('UTILITY');await opt(1);await opt(3);T.ok((await snap()).menu==='STATUS_TRIGGER' && await has('.info-overlay'),'Utility System Status shows actual trigger configuration');
    const screenDownload=p.waitForEvent('download');await key('PRINT');const screenFile=await screenDownload;
    T.ok(screenFile.suggestedFilename()==='TDS2001C-screen.svg','Print downloads current LCD SVG');
    await ui.shot('tds-extended');
    T.ok(ui.errors.length === 0, `No browser errors: ${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  T.print(); return T;
}

if (process.argv[1]?.endsWith('/tds-extended.mjs')) {
  const result = await run(); if (result.fail) process.exitCode = 1;
}
