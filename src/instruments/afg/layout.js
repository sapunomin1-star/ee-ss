// AFG-2225 前面板（P1 上層；座標＝原照片像素，同列鍵拉齊）
const key = (label, extra = {}) => ({ shape: 'key', label, w: 38, h: 17, ...extra });
const num = (label, extra = {}) => ({ shape: 'key', label, w: 26, h: 20, rx: 10, fs: 10, ...extra });
const soft = (label) => ({ shape: 'key', label, w: 26, h: 19, fs: 8, fill: '#e7e9eb' });

export default {
  viewBox: [55, 50, 652, 262],
  decor: `
    <rect x="58" y="53" width="646" height="256" rx="12" fill="#c3c8cd" stroke="#6f767d" stroke-width="1.5"/>
    <rect x="66" y="58" width="334" height="246" rx="7" fill="#2f353c"/>
    <text x="76" y="71" font-size="11" font-weight="700" fill="#fff" style="text-anchor:start">GW INSTEK</text>
    <text x="150" y="70.5" font-size="7.5" fill="#d7dde3" style="text-anchor:start">AFG-2225  Arbitrary Function Generator</text>
    <circle cx="578" cy="95" r="33" fill="#8e959c" stroke="#5f666d"/>
    <rect x="640" y="72" width="62" height="140" rx="5" fill="#b7bcc1" stroke="#7a8188"/>
    <text x="671" y="84" font-size="8" font-weight="700" fill="#1d1f22">OUTPUT</text>
    <text x="700" y="112" font-size="6" fill="#1d1f22">50Ω</text><text x="696" y="188" font-size="6" fill="#1d1f22">50Ω</text>
    <rect x="628" y="248" width="70" height="52" rx="5" fill="#b7bcc1" stroke="#7a8188"/>
    <text x="657" y="258" font-size="7.5" font-weight="700" fill="#1d1f22">POWER</text>`,
  lcd: { id: 'AFG.LCD.MAIN', x: 88, y: 84, w: 240, h: 190, screen: [320, 240] },
  shapes: {
    'AFG.SOFT.F1': soft('F1'), 'AFG.SOFT.F2': soft('F2'), 'AFG.SOFT.F3': soft('F3'),
    'AFG.SOFT.F4': soft('F4'), 'AFG.SOFT.F5': soft('F5'),
    'AFG.KEY.RETURN': { ...soft('Return'), w: 30, fs: 7 },
    'AFG.NUM.DIGIT_7': num('7', { y: 90 }), 'AFG.NUM.DIGIT_8': num('8', { y: 90 }), 'AFG.NUM.DIGIT_9': num('9', { y: 90 }),
    'AFG.NUM.DIGIT_4': num('4', { y: 128 }), 'AFG.NUM.DIGIT_5': num('5', { y: 128 }), 'AFG.NUM.DIGIT_6': num('6', { y: 128 }),
    'AFG.NUM.DIGIT_1': num('1', { y: 166 }), 'AFG.NUM.DIGIT_2': num('2', { y: 166 }), 'AFG.NUM.DIGIT_3': num('3', { y: 166 }),
    'AFG.NUM.DIGIT_0': num('0', { y: 202 }), 'AFG.NUM.DOT': num('•', { y: 202 }), 'AFG.NUM.PLUS_MINUS': num('+/-', { y: 202, fs: 8 }),
    'AFG.KNOB.SCROLL_WHEEL': { shape: 'knob', r: 24 },
    'AFG.KEY.ARROW_LEFT': key('◀', { w: 24, h: 14, y: 158 }), 'AFG.KEY.ARROW_RIGHT': key('▶', { w: 24, h: 14, y: 158 }),
    'AFG.KEY.CH1_CH2': key('CH1/CH2', { w: 42, h: 15, fs: 7 }),
    'AFG.KEY.OUTPUT': key('OUTPUT', { w: 42, h: 17, fs: 7, fill: '#bfe2f4' }),
    'AFG.KEY.WAVEFORM': key('Waveform', { y: 257, fs: 7, fill: '#6f767d', dark: true }),
    'AFG.KEY.FREQ_RATE': key('FREQ/Rate', { y: 257, fs: 6.5 }),
    'AFG.KEY.AMPL': key('AMPL', { y: 257 }),
    'AFG.KEY.DC_OFFSET': key('DC Offset', { y: 257, fs: 6.5 }),
    'AFG.KEY.UTIL': key('UTIL', { y: 257 }),
    'AFG.KEY.ARB': key('ARB', { y: 288, fill: '#c9d7e3' }), 'AFG.KEY.MOD': key('MOD', { y: 288 }),
    'AFG.KEY.SWEEP': key('Sweep', { y: 288 }), 'AFG.KEY.BURST': key('Burst', { y: 288 }),
    'AFG.KEY.PRESET': key('Preset', { y: 288, fill: '#8fd08f' }),
    'AFG.TERM.CH1_OUT': { shape: 'bnc', r: 15, label: 'CH1', lx: -24, ly: 3 },
    'AFG.TERM.CH2_OUT': { shape: 'bnc', r: 15, label: 'CH2', lx: -24, ly: 3 },
    'AFG.PWR.POWER': key('', { w: 30, h: 18, fill: '#e6e8ea' }),
    'AFG.MISC.MODEL_LABEL': null,
  },
};
