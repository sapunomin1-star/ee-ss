// AFG-2225 行為模型（I02）。規格：docs/data/afg.json（AFG-F01～F16、GAP-AFG-01～19）。
// 物理量一律存「未捨入的 EMF」：Load 50 Ω 時面板參照值＝EMF/2，High Z 時＝EMF（AFG-F10）。
// 判定順序（AFG-F06）：換算成 Load 參照的 Vpp（不捨入）→ 判定範圍與聯合限制 → 合法才提交 → LCD 只格式化。
import { fmtFixed, fmtWidth } from '../../core/format.js';
import layout from './layout.js';
import { renderLcd } from './lcd.js';

export const EPS = 1e-9; // 只吸收浮點誤差（GAP-AFG-19）
const CF = { SINE: 2 * Math.SQRT2, SQUARE: 2, RAMP: 2 * Math.sqrt(3) }; // Vpp／Vrms（GAP-AFG-11）
const FMAX = { SINE: 25e6, SQUARE: 25e6, RAMP: 1e6 };
const FMIN = 1e-6;
export const WAVE_NAME = { SINE: 'Sine', SQUARE: 'Square', RAMP: 'Ramp' };

export const AMPL_UNITS = ['DBM', 'MVRMS', 'VRMS', 'MVPP', 'VPP'];
export const UNIT_TEXT = { VPP: 'VPP', MVPP: 'mVPP', VRMS: 'VRMS', MVRMS: 'mVRMS', DBM: 'dBm', VDC: 'VDC', MVDC: 'mVDC' };
const FREQ_UNITS = [['uHz', 1e-6], ['mHz', 1e-3], ['Hz', 1], ['kHz', 1e3], ['MHz', 1e6]];

export const MENUS = {
  WAVE: ['Sine', 'Square', 'Pulse', 'Ramp', 'Noise'],
  SQUARE: ['Duty', '', '', '', ''],
  RAMP: ['SYM', '%', '', '', ''],
  FREQ: ['uHz', 'mHz', 'Hz', 'kHz', 'MHz'],
  AMPL: ['dBm', 'mVRMS', 'VRMS', 'mVPP', 'VPP'],
  OFFSET: ['mVDC', 'VDC', '', '', ''],
  CH: ['Load', '', '', 'Phase', 'DSO Link'],
  LOAD: ['50 OHM', 'High Z', '', '', ''],
};

// ---- 換算（GAP-AFG-11）：Load 參照的 Vpp ↔ 各單位 ----
export function toVpp(x, unit, wave) {
  switch (unit) {
    case 'VPP': return x;
    case 'MVPP': return x / 1000;
    case 'VRMS': return x * CF[wave];
    case 'MVRMS': return (x / 1000) * CF[wave];
    case 'DBM': return CF[wave] * Math.sqrt(50 * 1e-3 * 10 ** (x / 10));
    default: throw new Error(unit);
  }
}
export function fromVpp(v, unit, wave) {
  switch (unit) {
    case 'VPP': return v;
    case 'MVPP': return v * 1000;
    case 'VRMS': return v / CF[wave];
    case 'MVRMS': return (v / CF[wave]) * 1000;
    case 'DBM': return 10 * Math.log10((v / CF[wave]) ** 2 / 50 / 1e-3);
    default: throw new Error(unit);
  }
}

// ---- 顯示格式（GAP-AFG-13）----
export function fmtAmpl(v, unit, wave) {
  const x = fromVpp(v, unit, wave);
  if (unit === 'VPP' || unit === 'VRMS') return fmtWidth(x, 3, 1);
  if (unit === 'DBM') return fmtFixed(x, 2);
  return fmtFixed(x, 1);
}
export const fmtOffset = (o, unit) => (unit === 'MVDC' ? fmtFixed(o * 1000, 0) : fmtFixed(o, 2));
export function freqParts(f) {
  let [u, m] = FREQ_UNITS[0];
  for (const [uu, mm] of FREQ_UNITS) if (f >= mm * 0.9999995) { u = uu; m = mm; }
  const v = f / m;
  const intLen = Math.max(1, Math.floor(Math.log10(v) + 1e-9) + 1);
  return { text: fmtFixed(v, Math.max(0, 7 - intLen)), unit: u, mult: m };
}

// 游標位權的上下限（以基本單位 V、Hz、dB、% 的 10 次方表示）
const CURSOR = {
  FREQ: { min: -6, max: 7, def: (st) => Math.round(Math.log10(freqParts(st.freq).mult)) - 1 },
  AMPL: { min: (u) => ({ VPP: -3, VRMS: -3, MVPP: -4, MVRMS: -4, DBM: -2 }[u]), max: (u) => (u === 'DBM' ? 1 : 1), def: () => -1 },
  OFFSET: { min: (u) => (u === 'MVDC' ? -3 : -2), max: () => 1, def: () => -1 },
  SYM: { min: () => -1, max: () => 2, def: () => 0 },
};

function presetChannel() {
  return { wave: 'SINE', freq: 1000, sym: 50, emfVpp: 6, emfOffset: 0, load50: true, unit: 'VPP', offUnit: 'VDC', output: false };
}

export class AfgModel {
  constructor() {
    this.id = 'afg';
    this.title = 'AFG-2225';
    this.subtitle = '任意波形訊號產生器';
    this.layout = layout;
    this.practice = [
      '選波形：Waveform → F1 Sine／F2 Square／F4 Ramp（三角波＝Ramp 再設 SYM 50%）',
      '設頻率：FREQ/Rate → 數字 → 單位鍵（例 1 → F4 kHz）',
      '設幅度：AMPL → 數字 → F5 VPP／F3 VRMS／F1 dBm（換單位會真的換算）',
      '設直流偏移：DC Offset → 數字（負值先按 +/-）→ F2 VDC',
      '微調：◀ ▶ 選位數，再轉旋鈕',
      '通道與輸出：CH1/CH2 切換通道並開 Load 選單；OUTPUT 開關目前通道',
      '超出範圍或峰值超過限制會被拒絕並保留原值；Preset 回到出廠預設',
    ];
    this.on = true;
    this.reset();
  }

  // 模擬器「電源開」＝Preset 值、兩通道 Output OFF（GAP-AFG-06，近似）
  reset() {
    this.on = true;
    this.ch = [presetChannel(), presetChannel()];
    this.sel = 0;
    this.menu = 'WAVE';
    this.hl = null; // 'FREQ' | 'AMPL' | 'OFFSET' | 'SYM'
    this.buf = '';
    this.cexp = null;
  }

  isOn() { return this.on; }
  get c() { return this.ch[this.sel]; }
  refVpp(c = this.c) { return c.load50 ? c.emfVpp / 2 : c.emfVpp; }
  refOffset(c = this.c) { return c.load50 ? c.emfOffset / 2 : c.emfOffset; }

  // 共用判定（AFG-F06 ②、AFG-F08）：候選的 Load 參照值，回傳錯誤字串或 null
  check({ wave, freq, vpp, off, load50 }) {
    const k = load50 ? 1 : 2;
    const hi = freq >= 20e6;
    const vmin = 0.001 * k, vmax = (hi ? 5 : 10) * k, pk = (hi ? 2.5 : 5) * k;
    const ld = load50 ? '50 Ω' : 'High Z';
    if (freq < FMIN - 1e-12 || freq > FMAX[wave] * (1 + 1e-12)) {
      return `${WAVE_NAME[wave]} 的頻率範圍是 1 μHz–${wave === 'RAMP' ? '1 MHz' : '25 MHz'}`;
    }
    if (vpp < vmin - EPS) return `換算後 ${vpp.toPrecision(6)} Vpp，低於 ${ld} 的下限 ${vmin * 1000} mVpp`;
    if (vpp > vmax + EPS) return `換算後 ${vpp.toPrecision(6)} Vpp，超過 ${ld}${hi ? '（20–25 MHz）' : ''} 的上限 ${vmax} Vpp`;
    if (Math.abs(off) + vpp / 2 > pk + EPS) {
      return `峰值 |Offset|＋Vpp/2＝${(Math.abs(off) + vpp / 2).toPrecision(5)} V，超過 ${ld}${hi ? '（20–25 MHz）' : ''} 的 ${pk} V`;
    }
    return null;
  }

  candidate(patch) {
    const c = this.c;
    return { wave: c.wave, freq: c.freq, vpp: this.refVpp(), off: this.refOffset(), load50: c.load50, ...patch };
  }

  // ---- 輸入 ----
  press(id) {
    if (id === 'AFG.PWR.POWER') {
      if (this.on) { this.on = false; return { kind: 'approx', text: '模擬電源關閉：面板變暗、兩通道都沒有輸出。' }; }
      this.reset();
      return { kind: 'approx', text: '模擬電源開：回到 Preset 值、兩通道 Output OFF（校機開機記憶未確認，近似）。' };
    }
    if (!this.on) return { kind: 'info', text: '電源關閉中，先按 POWER。' };
    const digit = id.match(/^AFG\.NUM\.DIGIT_(\d)$/);
    if (digit) return this.typeChar(digit[1]);
    if (id === 'AFG.NUM.DOT') return this.typeChar('.');
    if (id === 'AFG.NUM.PLUS_MINUS') return this.toggleSign();
    const soft = id.match(/^AFG\.SOFT\.F(\d)$/);
    if (soft) return this.softkey(Number(soft[1]) - 1);
    switch (id) {
      case 'AFG.KEY.WAVEFORM': return this.openMenu('WAVE', null);
      case 'AFG.KEY.FREQ_RATE': return this.openMenu('FREQ', 'FREQ');
      case 'AFG.KEY.AMPL': return this.openMenu('AMPL', 'AMPL');
      case 'AFG.KEY.DC_OFFSET': return this.openMenu('OFFSET', 'OFFSET');
      case 'AFG.KEY.CH1_CH2':
        this.discard();
        this.sel = 1 - this.sel;
        this.menu = 'CH'; this.hl = null;
        return { kind: 'approx', text: `選取 CH${this.sel + 1}，並顯示 CH 選單（CH1/CH2 鍵每按一次切換通道，近似 GAP-AFG-01）。` };
      case 'AFG.KEY.OUTPUT':
        this.c.output = !this.c.output;
        return { kind: 'info', text: `CH${this.sel + 1} 輸出 ${this.c.output ? 'ON' : 'OFF'}${this.c.output ? '' : '（設定保留，端子無輸出）'}。` };
      case 'AFG.KEY.PRESET':
        this.ch = [presetChannel(), presetChannel()];
        this.sel = 0; this.menu = 'WAVE'; this.hl = null; this.buf = ''; this.cexp = null;
        return { kind: 'info', text: 'Preset：兩通道回到 Sine、1 kHz、3.000 Vpp、0.00 V、50 Ω、Output OFF。' };
      case 'AFG.KEY.RETURN': return this.goBack();
      case 'AFG.KEY.ARROW_LEFT': return this.moveCursor(1);
      case 'AFG.KEY.ARROW_RIGHT': return this.moveCursor(-1);
      default: return null;
    }
  }

  openMenu(menu, hl) {
    this.discard();
    this.menu = menu;
    this.hl = hl;
    this.cexp = hl ? this.defaultCursor(hl) : null;
    return null;
  }

  discard() {
    const had = this.buf;
    this.buf = '';
    return had ? { kind: 'info', text: `未按單位鍵的輸入「${had}」已捨棄，原值保留。` } : null;
  }

  goBack() {
    const d = this.discard();
    if (this.menu === 'LOAD') this.menu = 'CH';
    else if (this.menu === 'RAMP' || this.menu === 'SQUARE') { this.menu = 'WAVE'; if (this.hl === 'SYM') this.hl = null; }
    return d;
  }

  typeChar(ch) {
    if (!this.hl) return { kind: 'info', text: '先按 FREQ/Rate、AMPL 或 DC Offset（Ramp 的 SYM 用 F1）選要輸入的參數。' };
    if (ch === '.' && this.buf.includes('.')) return null;
    if (this.buf.replace(/[-.]/g, '').length >= 10) return null;
    this.buf += ch;
    return null;
  }

  toggleSign() {
    if (!this.hl) return { kind: 'info', text: '先選參數再輸入數字。' };
    this.buf = this.buf.startsWith('-') ? this.buf.slice(1) : `-${this.buf}`;
    return { kind: 'approx', text: '+/- 切換輸入中的正負號（手冊沒有文字說明，近似 GAP-AFG-12）。' };
  }

  defaultCursor(hl) {
    const spec = CURSOR[hl];
    if (hl === 'FREQ') return Math.min(spec.max, Math.max(spec.min, spec.def(this.c)));
    return spec.def(hl === 'AMPL' ? this.c.unit : this.c.offUnit);
  }

  cursorRange() {
    const spec = CURSOR[this.hl];
    if (this.hl === 'FREQ') return [spec.min, spec.max];
    const u = this.hl === 'AMPL' ? this.c.unit : this.c.offUnit;
    return [spec.min(u), spec.max(u)];
  }

  moveCursor(delta) {
    if (!this.hl) return { kind: 'info', text: '先選參數，◀ ▶ 才會移動要調整的位數。' };
    this.discard();
    const [lo, hi] = this.cursorRange();
    this.cexp = Math.min(hi, Math.max(lo, this.cexp + delta));
    return null;
  }

  // ---- 軟鍵 ----
  softkey(i) {
    const label = MENUS[this.menu][i];
    if (!label) return null;
    switch (this.menu) {
      case 'WAVE': return this.pickWave(i);
      case 'SQUARE': return { kind: 'out', text: 'Duty 本輪固定 50%，未納入練習（按了不會改變狀態）。' };
      case 'RAMP':
        if (i === 0) { this.discard(); this.hl = 'SYM'; this.cexp = CURSOR.SYM.def(); return null; }
        return this.commitSym();
      case 'FREQ': return this.commitFreq(FREQ_UNITS[i][1], FREQ_UNITS[i][0]);
      case 'AMPL': return this.amplUnitKey(AMPL_UNITS[i]);
      case 'OFFSET': return this.offsetUnitKey(i === 0 ? 'MVDC' : 'VDC');
      case 'CH':
        if (i === 0) { this.discard(); this.menu = 'LOAD'; return null; }
        return { kind: 'out', text: `「${label}」本輪未納入練習範圍，按了不會改變狀態。` };
      case 'LOAD': return this.setLoad(i === 0);
      default: return null;
    }
  }

  pickWave(i) {
    const w = ['SINE', 'SQUARE', null, 'RAMP', null][i];
    if (!w) return { kind: 'out', text: `${MENUS.WAVE[i]} 本輪未納入練習範圍，波形不變。` };
    this.discard();
    const c = this.c;
    let msg = null;
    if (w === 'RAMP' && c.freq > FMAX.RAMP) {
      c.freq = FMAX.RAMP;
      msg = { kind: 'approx', text: 'Ramp 最高 1 MHz：頻率已降為 1 MHz（依遠端說明的近似行為，AFG-F12）。' };
    }
    c.wave = w;
    this.menu = w === 'RAMP' ? 'RAMP' : w === 'SQUARE' ? 'SQUARE' : 'WAVE';
    if (this.hl === 'SYM') this.hl = null;
    return msg;
  }

  parseBuf() {
    const s = this.buf;
    this.buf = '';
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    return Number(s);
  }

  commitFreq(mult, unitText) {
    if (this.hl !== 'FREQ') return null;
    if (!this.buf) return null;
    const x = this.parseBuf();
    if (x == null) return { kind: 'reject', text: '輸入不是有效數字，頻率保留原值。' };
    const f = Math.round(x * mult * 1e6) / 1e6; // 解析度 1 μHz
    const err = this.check(this.candidate({ freq: f }));
    if (err) return { kind: 'reject', text: `頻率 ${x} ${unitText} 被拒絕：${err}。原值保留。` };
    this.c.freq = f;
    this.cexp = this.defaultCursor('FREQ');
    return null;
  }

  amplUnitKey(unit) {
    const c = this.c;
    if (unit === 'DBM' && !c.load50) {
      this.buf = '';
      return { kind: 'reject', text: 'High Z 時不能用 dBm（AFG-F11），顯示單位不變。' };
    }
    if (this.hl !== 'AMPL') return null;
    if (!this.buf) { // 只換顯示單位：物理幅度不變、不重新判定（GAP-AFG-11）
      c.unit = unit;
      this.cexp = CURSOR.AMPL.def();
      return null;
    }
    const raw = this.buf;
    const x = this.parseBuf();
    if (x == null) return { kind: 'reject', text: `「${raw}」不是有效數字，幅度保留原值。` };
    if (unit !== 'DBM' && x <= 0) return { kind: 'reject', text: 'Vpp／Vrms 必須大於 0，幅度保留原值。' };
    const vpp = toVpp(x, unit, c.wave); // ① 不先捨入
    const err = this.check(this.candidate({ vpp })); // ②
    if (err) return { kind: 'reject', text: `${raw} ${UNIT_TEXT[unit]} 被拒絕：${err}。已提交值與顯示單位不變。` };
    c.emfVpp = c.load50 ? vpp * 2 : vpp; // ③ 保存未捨入值
    c.unit = unit;
    this.cexp = CURSOR.AMPL.def();
    return unit === 'VPP' ? null : { kind: 'info', text: `${raw} ${UNIT_TEXT[unit]} ≈ ${vpp.toPrecision(7)} Vpp（${WAVE_NAME[c.wave]}，${c.load50 ? '50 Ω' : 'High Z'} 參照）。` };
  }

  offsetUnitKey(unit) {
    const c = this.c;
    if (this.hl !== 'OFFSET') return null;
    if (!this.buf) { c.offUnit = unit; this.cexp = CURSOR.OFFSET.def(); return null; }
    const raw = this.buf;
    const x = this.parseBuf();
    if (x == null) return { kind: 'reject', text: `「${raw}」不是有效數字，Offset 保留原值。` };
    const off = unit === 'MVDC' ? x / 1000 : x;
    const lim = (c.freq >= 20e6 ? 2.5 : 5) * (c.load50 ? 1 : 2);
    if (Math.abs(off) > lim + EPS) return { kind: 'reject', text: `Offset ${raw} ${UNIT_TEXT[unit]} 超過 ±${lim} Vpk，原值保留。` };
    const err = this.check(this.candidate({ off }));
    if (err) return { kind: 'reject', text: `Offset ${raw} ${UNIT_TEXT[unit]} 被拒絕：${err}。原值保留。` };
    c.emfOffset = c.load50 ? off * 2 : off;
    c.offUnit = unit;
    this.cexp = CURSOR.OFFSET.def();
    return null;
  }

  commitSym() {
    if (this.hl !== 'SYM' || !this.buf) return null;
    const raw = this.buf;
    const x = this.parseBuf();
    if (x == null || x < 0 || x > 100) return { kind: 'reject', text: `SYM ${raw}% 超出 0%–100%，原值保留。` };
    this.c.sym = Math.round(x * 10) / 10;
    return null;
  }

  setLoad(to50) {
    const c = this.c;
    if (c.load50 === to50) return null;
    c.load50 = to50; // EMF 不變，參照值自動 ×2／÷2（AFG-F10）
    let text = `CH${this.sel + 1} Load 改為 ${to50 ? '50 Ω' : 'High Z'}：顯示值${to50 ? '減半' : '加倍'}，實際輸出（EMF）不變。`;
    if (!to50 && c.unit === 'DBM') { c.unit = 'VPP'; text += ' dBm 在 High Z 不能用，單位改為 VPP。'; }
    return { kind: 'info', text };
  }

  // ---- 旋鈕（AFG-F05、GAP-AFG-04、AFG-F06 旋鈕句）----
  turn(id, dir) {
    if (!this.on) return null;
    if (!this.hl) return null; // 沒有參數高亮時旋鈕不作用（GAP-AFG-15）
    const d = this.discard();
    const w = 10 ** this.cexp;
    const c = this.c;
    if (this.hl === 'FREQ') {
      const f = Math.round((c.freq + dir * w) * 1e6) / 1e6;
      const err = this.check(this.candidate({ freq: f }));
      if (err) return { kind: 'reject', text: `這一步不生效：${err}。` };
      c.freq = f;
    } else if (this.hl === 'AMPL') {
      const x = fromVpp(this.refVpp(), c.unit, c.wave) + dir * (c.unit.startsWith('M') ? w * 1000 : w);
      if (c.unit !== 'DBM' && x <= 0) return { kind: 'reject', text: '這一步不生效：幅度必須大於 0。' };
      const vpp = toVpp(x, c.unit, c.wave);
      const err = this.check(this.candidate({ vpp }));
      if (err) return { kind: 'reject', text: `這一步不生效：${err}。` };
      c.emfVpp = c.load50 ? vpp * 2 : vpp;
    } else if (this.hl === 'OFFSET') {
      const off = this.refOffset() + dir * w;
      const err = this.check(this.candidate({ off }));
      if (err) return { kind: 'reject', text: `這一步不生效：${err}。` };
      c.emfOffset = c.load50 ? off * 2 : off;
    } else if (this.hl === 'SYM') {
      const s = Math.round((c.sym + dir * w) * 10) / 10;
      if (s < 0 || s > 100) return { kind: 'reject', text: '這一步不生效：SYM 範圍 0%–100%。' };
      c.sym = s;
    }
    return d;
  }

  // ---- 輸出 ----
  lcd() { return renderLcd(this); }
  visual() { return {}; }

  descriptor(i) {
    const c = this.ch[i];
    return { enabled: c.output, rInternal: 50, wave: c.wave, freq: c.freq, emfVpp: c.emfVpp, emfOffset: c.emfOffset };
  }

  status() {
    const rows = [['選取通道', `CH${this.sel + 1}`]];
    this.ch.forEach((c, i) => {
      const ld = c.load50 ? '50 Ω' : 'High Z';
      rows.push([`CH${i + 1}`, `${WAVE_NAME[c.wave]}${c.wave === 'RAMP' ? `（SYM ${fmtFixed(c.sym, 1)}%）` : ''}，${freqParts(c.freq).text} ${freqParts(c.freq).unit}，輸出 ${c.output ? 'ON' : 'OFF'}`]);
      rows.push(['', `幅度 ${fmtAmpl(this.refVpp(c), c.unit, c.wave)} ${UNIT_TEXT[c.unit]}（${ld} 參照 ≈ ${this.refVpp(c).toPrecision(6)} Vpp），Offset ${fmtOffset(this.refOffset(c), c.offUnit)} ${UNIT_TEXT[c.offUnit]}`]);
    });
    if (this.buf) rows.push(['輸入中', `${this.buf}（按單位鍵才提交）`]);
    return rows;
  }

  snapshot() {
    return {
      on: this.on, sel: this.sel + 1, menu: this.menu, highlight: this.hl, buffer: this.buf, cursorExp: this.cexp,
      ch: this.ch.map((c, i) => ({ ...c, refVpp: this.refVpp(c), refOffset: this.refOffset(c), descriptor: this.descriptor(i) })),
    };
  }
}
