// GPE-4323 前面板（P1 下層；座標＝原照片像素。照片有約 5° 透視傾斜，同列旋鈕／鍵／端子拉齊）
const knob = (sub, extra = {}) => ({ shape: 'knob', r: 16, sub, subFs: 6.5, subGap: 5, ...extra });
const key = (label, extra = {}) => ({ shape: 'key', label, w: 30, h: 14, fs: 6, ...extra });
const post = (color, label, extra = {}) => ({ shape: 'post', r: 11, color, label, ly: -15, fs: 6.5, y: 920, ...extra });
// 模式鍵圖例的鍵狀態小圖示（照片／p.15、p.26）：高方塊＝彈起、低扁塊＝按下
const leg = (x, y, up) => `<rect x="${x - 2.5}" y="${y - (up ? 3.4 : 1.4)}" width="5" height="${up ? 3.4 : 1.4}" fill="#222"/>` +
  `<line x1="${x - 3.6}" y1="${y + 0.4}" x2="${x + 3.6}" y2="${y + 0.4}" stroke="#222" stroke-width=".5"/>`;

export default {
  viewBox: [85, 646, 545, 322],
  decor: `
    <rect x="88" y="650" width="538" height="314" rx="10" fill="#c9cdd1" stroke="#6f767d" stroke-width="1.5"/>
    <rect x="94" y="655" width="264" height="175" rx="5" fill="#2e343b"/>
    <text x="104" y="669" font-size="9" font-weight="700" fill="#fff" style="text-anchor:start">GW INSTEK</text>
    <text x="175" y="669" font-size="7" fill="#dfe4e8" style="text-anchor:start">GPE-4323</text>
    <text x="300" y="665" font-size="5.5" fill="#dfe4e8">DC Power Supply</text><text x="300" y="672" font-size="5.5" fill="#dfe4e8">32V 3A</text>
    <rect x="398" y="660" width="214" height="20" rx="2" fill="#1c1f23"/>
    <text x="429" y="674" font-size="8.5" font-weight="700" fill="#fff">CH1</text>
    <text x="575" y="674" font-size="8.5" font-weight="700" fill="#fff">CH2</text>
    <rect x="462" y="700" width="86" height="58" rx="3" fill="none" stroke="#6b7278"/>
    <text x="503.5" y="709" font-size="5.5" fill="#222">Series</text>${leg(482, 708, true)}${leg(525, 708, false)}
    <text x="503.5" y="718" font-size="5.5" fill="#222">Parallel</text>${leg(482, 717, false)}${leg(525, 717, false)}
    <text x="503.5" y="753" font-size="5.5" fill="#222">Independent</text>${leg(482, 752, true)}${leg(525, 752, true)}
    <text x="463" y="881" font-size="5" fill="#222">LOCK</text><line x1="457" y1="882.6" x2="469" y2="882.6" stroke="#222" stroke-width=".5"/>
    <style>.panel-gpe .ctl.active .cap{fill:#8d949b!important;stroke:#30353a;stroke-width:1.4;transform-box:fill-box;transform-origin:center;transform:scale(.86)}</style>
    <text x="433" y="886" font-size="5" fill="#222">— : Long Push</text>
    <rect x="240" y="938" width="232" height="16" rx="2" fill="#2f6fb8"/>
    <text x="300" y="949" font-size="5.5" fill="#fff">COM   SERIES OUTPUT</text>
    <text x="410" y="949" font-size="5.5" fill="#fff">PARALLEL OUTPUT</text>
    <text x="182" y="945" font-size="5.5" fill="#222">0 - 15V , 1A</text>
    <text x="276" y="945" font-size="5.5" fill="#222" dy="-2"> </text>
    <text x="529" y="945" font-size="5.5" fill="#222">0 - 5V , 1A</text>
    <text x="108" y="862" font-size="7" font-weight="700" fill="#222">POWER</text>`,
  lcd: { id: 'GPE.LCD.MAIN', x: 100, y: 684, w: 252, h: 140, screen: [480, 266] },
  shapes: {
    'GPE.KNOB.CH1_VOLTAGE': knob('Voltage', { x: 429, y: 716 }),
    'GPE.KNOB.CH1_CURRENT': knob('Current', { x: 429, y: 781 }),
    'GPE.KNOB.CH4_VOLTAGE': knob('CH4 Voltage', { x: 429, y: 842 }),
    'GPE.KNOB.CH2_VOLTAGE': knob('Voltage', { x: 575, y: 716 }),
    'GPE.KNOB.CH2_CURRENT': knob('Current', { x: 575, y: 781 }),
    'GPE.KNOB.CH3_VOLTAGE': knob('CH3 Voltage', { x: 575, y: 842 }),
    'GPE.KEY.TRACK_LEFT': key('', { y: 734, w: 24, h: 13, fill: '#e2e4e6' }),
    'GPE.KEY.TRACK_RIGHT': key('', { y: 734, w: 24, h: 13, fill: '#e2e4e6' }),
    'GPE.KEY.CH1_CH4': key('CH1/CH4', { y: 805, w: 34, h: 13, fs: 5.5 }),
    'GPE.KEY.CH2_CH3': key('CH2/CH3', { y: 805, w: 34, h: 13, fs: 5.5 }),
    'GPE.KEY.SET_VIEW': key('', { y: 867, w: 30, h: 13, sub: 'Set View', subFs: 5.5, subGap: 3 }),
    'GPE.KEY.OUTPUT_ON_OFF': key('On / Off', { y: 867, w: 36, h: 17, fs: 6, fill: '#79c37a', led: [13, -4, 2] }),
    'GPE.LED.OUTPUT_KEY': null,
    'GPE.PWR.POWER': key('', { w: 30, h: 30, rx: 15, y: 886, fill: '#e3e5e7' }),
    'GPE.TERM.CH4_POS': post('#c62828', '+ CH4'), 'GPE.TERM.CH4_NEG': post('#222', '−'),
    'GPE.TERM.CH1_POS': post('#c62828', '+ CH1'), 'GPE.TERM.CH1_NEG': post('#222', '−'),
    'GPE.TERM.GND': post('#2e7d32', 'GND'),
    'GPE.TERM.CH2_POS': post('#c62828', '+ CH2'), 'GPE.TERM.CH2_NEG': post('#222', '−'),
    'GPE.TERM.CH3_POS': post('#c62828', '+ CH3'), 'GPE.TERM.CH3_NEG': post('#222', '−'),
  },
};
