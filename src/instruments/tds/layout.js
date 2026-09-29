// TDS2001C 前面板（P2；座標＝原照片像素，同列鍵拉齊；鍵上方字樣依照片：部分為校方中文貼紙）
const key = (label, extra = {}) => ({ shape: 'key', label, w: 30, h: 14, fs: 6, ...extra });
const top = (sub, extra = {}) => key('', { sub, subFs: 6, subGap: 3, ...extra });
const opt = () => ({ shape: 'key', label: '', w: 20, h: 16, rx: 2, fill: '#e3e5e7' });

export default {
  viewBox: [20, 364, 690, 344],
  decor: `
    <rect x="22" y="367" width="684" height="338" rx="10" fill="#d4d6d8" stroke="#6f767d" stroke-width="1.5"/>
    <rect x="28" y="372" width="262" height="24" rx="3" fill="#e7e8ea" stroke="#9aa0a6"/>
    <text x="58" y="388" font-size="10" font-weight="700" fill="#1f3e7a">Tektronix</text>
    <text x="112" y="388" font-size="9" font-weight="700" fill="#222" style="text-anchor:start">TDS 2001C</text>
    <text x="165" y="386" font-size="4.6" fill="#222" style="text-anchor:start">TWO CHANNEL</text>
    <text x="165" y="392" font-size="4.6" fill="#222" style="text-anchor:start">DIGITAL STORAGE OSCILLOSCOPE</text>
    <rect x="248" y="374" width="40" height="20" fill="#27306b"/><text x="268" y="382" font-size="5" fill="#fff">50 MHz</text><text x="268" y="390" font-size="5" fill="#fff">500 MS/s</text>
    <rect x="34" y="628" width="250" height="68" rx="4" fill="#c8cbce" stroke="#9aa0a6"/>
    <text x="232" y="660" font-size="5.5" fill="#222">USB</text><text x="232" y="667" font-size="5.5" fill="#222">Flash Drive</text>
    <rect x="248" y="658" width="18" height="12" fill="#1a1a1a"/>
    <text x="318" y="667" font-size="4.5" fill="#222" style="text-anchor:start">Probe Comp</text><text x="318" y="673" font-size="4.5" fill="#222" style="text-anchor:start">~5V@1kHz</text>
    <rect x="382" y="452" width="138" height="14" rx="2" fill="#9fa5ab"/><text x="451" y="462" font-size="8" fill="#fff" font-weight="700">垂直</text>
    <rect x="538" y="452" width="82" height="14" rx="2" fill="#9fa5ab"/><text x="579" y="462" font-size="8" fill="#fff" font-weight="700">水平</text>
    <rect x="634" y="452" width="68" height="14" rx="2" fill="#9fa5ab"/><text x="668" y="462" font-size="8" fill="#fff" font-weight="700">觸發</text>
    <line x1="382" y1="642" x2="520" y2="642" stroke="#555" stroke-width=".8"/>
    <text x="451" y="650" font-size="5.2" fill="#222">300 V ⚠ 300V CAT II</text>
    <text x="450" y="484" font-size="5.5" fill="#222">位置</text>
    <text x="450" y="553" font-size="6" fill="#222">功能表</text>
    <text x="446" y="600" font-size="6" fill="#222">刻度</text>`,
  lcd: { id: 'TDS.LCD.MAIN', x: 46, y: 412, w: 232, h: 192, screen: [320, 240] },
  shapes: {
    'TDS.KNOB.MULTIPURPOSE': { shape: 'knob', r: 13 },
    'TDS.LED.MULTIPURPOSE': { shape: 'led', r: 2.6 },
    'TDS.KEY.AUTORANGE': top('自動調整', { y: 398 }),
    'TDS.LED.AUTORANGE': { shape: 'led', r: 2.4 },
    'TDS.KEY.SAVE_RECALL': top('Save/Recall', { y: 398 }),
    'TDS.KEY.MEASURE': top('Measure', { y: 398 }),
    'TDS.KEY.ACQUIRE': top('Acquire', { y: 398 }),
    'TDS.KEY.HELP': top('Help', { y: 398, fill: '#bfc3c7' }),
    'TDS.KEY.AUTOSET': key('Auto Set', { y: 398, sub: '自動設定', subFs: 6, subGap: 3, fill: '#3a3f45', dark: true, fs: 5.5 }),
    'TDS.KEY.REF': key('Ref', { y: 428, sub: '參考值', subFs: 6, subGap: 3 }),
    'TDS.KEY.UTILITY': top('Utility', { y: 428 }),
    'TDS.KEY.CURSOR': top('Cursor', { y: 428 }),
    'TDS.KEY.DISPLAY': top('Display', { y: 428 }),
    'TDS.KEY.DEFAULT_SETUP': top('Default Setup', { y: 428, fill: '#bfc3c7' }),
    'TDS.KEY.SINGLE': top('單一', { y: 428 }),
    'TDS.KEY.RUN_STOP': key('Run/\nStop', { w: 28, h: 26, sub: '執行/停止', subFs: 5.5, subGap: 3, fs: 5.5, led: [10, 9, 2] }),
    'TDS.KEY.PRINT': key('⎙', { w: 22, h: 14, fs: 8 }),
    'TDS.LED.SAVE': { shape: 'led', r: 2.4 },
    'TDS.KNOB.CH1_POSITION': { shape: 'knob', r: 10, y: 481 },
    'TDS.KNOB.CH2_POSITION': { shape: 'knob', r: 10, y: 481 },
    'TDS.KEY.CH1_MENU': key('1', { y: 535, w: 24, fs: 8, fill: '#f2d23c' }),
    'TDS.KEY.MATH_MENU': key('Math', { y: 535, w: 24, fs: 6, fill: '#f0a6c8' }),
    'TDS.KEY.CH2_MENU': key('2', { y: 535, w: 24, fs: 8, fill: '#6ec3ee' }),
    'TDS.KNOB.CH1_VOLTS_DIV': { shape: 'knob', r: 17, y: 598 },
    'TDS.KNOB.CH2_VOLTS_DIV': { shape: 'knob', r: 17, y: 598 },
    'TDS.TERM.CH1_IN': { shape: 'bnc', r: 13, y: 672, label: '1', ly: -17 },
    'TDS.TERM.CH2_IN': { shape: 'bnc', r: 13, y: 672, label: '2', ly: -17 },
    'TDS.KNOB.HORIZ_POSITION': { shape: 'knob', r: 10, sub: '位置', subFs: 5.5, subGap: 4 },
    'TDS.KEY.HORIZ_MENU': key('Horiz', { sub: '選單', subFs: 5.5, subGap: 2 }),
    'TDS.KEY.SET_TO_ZERO': key('Set to\nZero', { h: 16, fs: 5, sub: '設置為零', subFs: 5.5, subGap: 2 }),
    'TDS.KNOB.HORIZ_SCALE': { shape: 'knob', r: 17, sub: '刻度', subFs: 5.5, subGap: 4 },
    'TDS.TERM.EXT_TRIG': { shape: 'bnc', r: 11, label: 'Ext Trig', ly: -15 },
    'TDS.KNOB.TRIG_LEVEL': { shape: 'knob', r: 10, sub: '位準', subFs: 5.5, subGap: 4 },
    'TDS.KEY.TRIG_MENU': key('Trig\nMenu', { h: 16, fs: 5, sub: '選單', subFs: 5.5, subGap: 2 }),
    'TDS.KEY.SET_TO_50': key('Set To\n50%', { h: 16, fs: 5, sub: '設置為', subFs: 5.5, subGap: 2 }),
    'TDS.KEY.FORCE_TRIG': key('Force\nTrig', { h: 16, fs: 5, sub: '強制觸發', subFs: 5.5, subGap: 2 }),
    'TDS.KEY.TRIG_VIEW': key('Trig\nView', { h: 16, fs: 5, sub: '觸發監看', subFs: 5.5, subGap: 2 }),
    'TDS.SOFT.OPT1': opt(), 'TDS.SOFT.OPT2': opt(), 'TDS.SOFT.OPT3': opt(), 'TDS.SOFT.OPT4': opt(), 'TDS.SOFT.OPT5': opt(),
    'TDS.KEY.PROBE_CHECK': { shape: 'key', label: '', w: 11, h: 11, rx: 6 },
    'TDS.TERM.PROBE_COMP_SIGNAL': { shape: 'post', r: 5, color: '#888' },
    'TDS.TERM.PROBE_COMP_GND': { shape: 'post', r: 5, color: '#888' },
    // 照片看不到的機頂電源鍵：放在面板左上角外側，標示照片未見
    'TDS.PWR.ON_OFF': key('POWER', { x: 40, y: 402, w: 20, h: 10, fs: 4 }),
  },
};
