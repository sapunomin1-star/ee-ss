// 34460A 前面板（P1 中層；座標＝原照片像素，同列鍵與端子拉齊）
const fkey = (label, sub, extra = {}) => ({ shape: 'key', label, sub, w: 36, h: 17, fs: 6.5, subFs: 5, subGap: 2.5, fill: '#e1e3e5', ...extra });
const soft = () => ({ shape: 'key', label: '', w: 36, h: 12, y: 578, fill: '#8ea3b5' });
const nav = (label, extra = {}) => ({ shape: 'key', label, w: 20, h: 16, rx: 8, fs: 7, fill: '#e1e3e5', ...extra });
const jack = (color, label, extra = {}) => ({ shape: 'jack', r: 12, color, label, fs: 5.5, ...extra });

export default {
  viewBox: [58, 362, 626, 250],
  decor: `
    <rect x="60" y="365" width="620" height="244" rx="14" fill="#34383d" stroke="#1d2024" stroke-width="1.5"/>
    <rect x="98" y="382" width="284" height="210" rx="4" fill="#2a2d31"/>
    <text x="72" y="380" font-size="5.5" fill="#e33" style="text-anchor:start">∿</text>
    <text x="80" y="380" font-size="6.5" font-weight="700" fill="#fff" style="text-anchor:start">KEYSIGHT</text>
    <text x="150" y="380" font-size="6" fill="#dfe3e6" style="text-anchor:start">34460A   6½ Digit Multimeter</text>
    <text x="360" y="380" font-size="6" font-style="italic" fill="#dfe3e6">Truevolt</text>
    <rect x="74" y="450" width="14" height="36" rx="2" fill="#15171a" stroke="#666"/>
    <g stroke="#ccc" stroke-width=".6" fill="none"><path d="M81 500v-8.5M81 498l-2.6-2v-1.4M81 496.5l2.6-1.8v-1.2"/></g>
    <path d="M81 489.8l-1.1 1.9h2.2z" fill="#ccc"/><circle cx="78.4" cy="494.2" r=".75" fill="#ccc"/><rect x="82.9" y="492.8" width="1.4" height="1.4" fill="#ccc"/>
    <rect x="536" y="400" width="130" height="206" rx="6" fill="#2b2e32" stroke="#555"/>
    <text x="561" y="418" font-size="5" fill="#ddd">Sense</text><text x="561" y="424" font-size="5" fill="#ddd">Ω4W</text>
    <text x="622" y="418" font-size="5" fill="#ddd">Input</text><text x="622" y="424" font-size="5" fill="#ddd">V Ω ⊣▶⊢</text>
    <text x="541" y="441" font-size="5" fill="#ddd">HI</text><text x="541" y="501" font-size="5" fill="#ddd">LO</text>
    <text x="592" y="467" font-size="4.8" fill="#ddd">200 Vpk</text>
    <text x="652" y="470" font-size="4.5" fill="#ddd">1000 VDC</text><text x="652" y="476" font-size="4.5" fill="#ddd">750 VAC</text>
    <text x="648" y="528" font-size="4.5" fill="#ddd">500 Vpk ⏚</text>
    <text x="586" y="530" font-size="5" fill="#ddd">⚠</text>
    <text x="596" y="560" font-size="5.5" fill="#ddd">I</text><text x="634" y="560" font-size="5" fill="#ddd">3A</text>
    <text x="628" y="598" font-size="4.5" fill="#ddd">CAT II (300V) ⚠</text>
    <text x="657" y="396" font-size="6" fill="#ffd54f">⚡</text>
    <circle cx="552" cy="552" r="6" fill="#1b1d20" stroke="#777"/>
    <ellipse cx="579" cy="592" rx="9" ry="5" fill="#1b1d20" stroke="#777"/>`,
  lcd: { id: 'DMM.LCD.MAIN', x: 104, y: 388, w: 272, h: 180, screen: [480, 318] },
  shapes: {
    'DMM.SOFT.S1': soft(), 'DMM.SOFT.S2': soft(), 'DMM.SOFT.S3': soft(),
    'DMM.SOFT.S4': soft(), 'DMM.SOFT.S5': soft(), 'DMM.SOFT.S6': soft(),
    'DMM.PWR.POWER': { shape: 'key', label: '⏻', w: 18, h: 18, rx: 9, fs: 9, fill: '#e1e3e5' },
    'DMM.LED.POWER': { shape: 'led', r: 2.2 },
    'DMM.KEY.DCV': fkey('DCV', 'DCI', { x: 406, y: 406 }),
    'DMM.KEY.ACV': fkey('ACV', 'ACI', { x: 454, y: 406 }),
    'DMM.KEY.OHM_2W': fkey('Ω 2W', 'Ω4W', { x: 501, y: 406 }),
    'DMM.KEY.FREQ': fkey('Freq', '', { x: 406, y: 439 }),
    'DMM.KEY.CONT': fkey('Cont ·))', '⊣▶⊢', { x: 454, y: 439, fs: 5.8 }),
    'DMM.KEY.TEMP': fkey('Temp', '', { x: 501, y: 439 }),
    'DMM.KEY.RUN_STOP': fkey('Run/Stop', 'Reset', { x: 406, y: 472, fs: 5.5 }),
    'DMM.KEY.SINGLE': fkey('Single', 'Probe Hold', { x: 454, y: 472 }),
    'DMM.KEY.NULL': fkey('Null', 'Math', { x: 501, y: 472 }),
    'DMM.KEY.DISPLAY': fkey('Display', 'Utility', { x: 406, y: 505, fs: 6 }),
    'DMM.KEY.ACQUIRE': fkey('Acquire', 'Help', { x: 454, y: 505, fs: 6 }),
    'DMM.KEY.SHIFT': fkey('Shift', '', { x: 501, y: 505, fill: '#3f7fd0', dark: true }),
    'DMM.KEY.UP': nav('▲', { x: 427, y: 538 }), 'DMM.KEY.DOWN': nav('▼', { x: 427, y: 588 }),
    'DMM.KEY.LEFT': nav('◀', { x: 399, y: 563 }), 'DMM.KEY.RIGHT': nav('▶', { x: 455, y: 563 }),
    'DMM.KEY.SELECT': nav('Select', { x: 427, y: 563, w: 26, fs: 4.8 }),
    'DMM.KEY.RANGE_UP': nav('+', { x: 499, y: 541, w: 24, fs: 9 }),
    'DMM.KEY.RANGE': nav('Range', { x: 499, y: 566, w: 28, fs: 5.5 }),
    'DMM.KEY.RANGE_DOWN': nav('−', { x: 499, y: 591, w: 24, fs: 9 }),
    'DMM.TERM.SENSE_HI': jack('#d32f2f', '', { x: 561, y: 440 }),
    'DMM.TERM.SENSE_LO': jack('#222', '', { x: 561, y: 499 }),
    'DMM.TERM.INPUT_HI': jack('#d32f2f', '', { x: 622, y: 440 }),
    'DMM.TERM.INPUT_LO': jack('#222', '', { x: 622, y: 499 }),
    'DMM.TERM.I_3A': jack('#d32f2f', '', { x: 614, y: 557 }),
  },
};
