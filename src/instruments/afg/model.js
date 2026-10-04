// AFG-2225 行為模型（I02）。規格：docs/data/afg.json（AFG-F01～F25、GAP-AFG-01～20）。
// 物理量一律存「未捨入的 EMF」：Load 50 Ω 時面板參照值＝EMF/2，High Z 時＝EMF（AFG-F10）。
// 判定順序（AFG-F06）：換算成 Load 參照的 Vpp（不捨入）→ 判定範圍與聯合限制 → 合法才提交 → LCD 只格式化。
import { fmtFixed, fmtWidth } from '../../core/format.js';
import layout from './layout.js';
import { renderLcd } from './lcd.js';
import { motionError, activeChannelsError, carrierRate, applyMotionAt, motionEnd, maxMotionRate } from './motion.js';
import { EXT_MENUS, instrumentExtensionDefaults, ensureExtensions, crestFactor,
  pulseBounds, normalizeChannelExtension, extensionPress, extensionSoftkey, extensionTurn, extensionReturn, extensionEditParts, extensionCursorRange, extensionRows, relationState, applyRelations, exportArbFile, importArbFile } from './extensions.js';

export const EPS = 1e-9; // 只吸收浮點誤差（GAP-AFG-19）
// Bipolar Square's total waveform RMS is A for every Duty. Its AC-only RMS
// differs: 2*A*sqrt(d*(1-d)); the bench meter removes the waveform's DC mean.
const FMAX = { SINE: 25e6, SQUARE: 25e6, RAMP: 1e6, PULSE: 25e6, NOISE: 25e6, ARB: 60e6 };
const FMIN = 1e-6;
export const WAVE_NAME = { SINE: 'Sine', SQUARE: 'Square', RAMP: 'Ramp', PULSE: 'Pulse', NOISE: 'Noise', ARB: 'ARB' };

export const AMPL_UNITS = ['DBM', 'MVRMS', 'VRMS', 'MVPP', 'VPP'];
export const UNIT_TEXT = { VPP: 'VPP', MVPP: 'mVPP', VRMS: 'VRMS', MVRMS: 'mVRMS', DBM: 'dBm', VDC: 'VDC', MVDC: 'mVDC' };
const FREQ_UNITS = [['uHz', 1e-6], ['mHz', 1e-3], ['Hz', 1], ['kHz', 1e3], ['MHz', 1e6]];

export const MENUS = {
  ...EXT_MENUS,
  WAVE: ['Sine', 'Square', 'Pulse', 'Ramp', 'Noise'],
  SQUARE: ['Duty', '', 'TTL', '', ''],
  RAMP: ['SYM', '%', '', '', ''],
  FREQ: ['uHz', 'mHz', 'Hz', 'kHz', 'MHz'],
  AMPL: ['dBm', 'mVRMS', 'VRMS', 'mVPP', 'VPP'],
  OFFSET: ['mVDC', 'VDC', '', '', ''],
  CH: ['Load', '', '', 'Phase', 'DSO Link'],
  LOAD: ['50 OHM', 'High Z', '', '', ''],
  DUTY: ['Duty', '%', '', '', ''],
  PHASE: ['Phase', 'S_Phase', '', '', 'Degree'],
};

// ---- 換算（GAP-AFG-11）：Load 參照的 Vpp ↔ 各單位 ----
export function toVpp(x, unit, wave) {
  const cf = crestFactor(wave);
  switch (unit) {
    case 'VPP': return x;
    case 'MVPP': return x / 1000;
    case 'VRMS': return x * cf;
    case 'MVRMS': return (x / 1000) * cf;
    case 'DBM': return cf * Math.sqrt(50 * 1e-3 * 10 ** (x / 10));
    default: throw new Error(unit);
  }
}
export function fromVpp(v, unit, wave) {
  const cf = crestFactor(wave);
  switch (unit) {
    case 'VPP': return v;
    case 'MVPP': return v * 1000;
    case 'VRMS': return v / cf;
    case 'MVRMS': return (v / cf) * 1000;
    case 'DBM': return 10 * Math.log10((v / cf) ** 2 / 50 / 1e-3);
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
  DUTY: { min: () => -1, max: () => 1, def: () => 0 },
  PHASE: { min: () => -1, max: () => 2, def: () => 0 },
};

// M-AFG p.56/p.289; input rounding and incompatible edits use the simulator's
// existing reject-and-retain convention. The 0.1%/0.1° step is a teaching approximation.
export function dutyRange(freq) { return freq > 1e6 ? [50, 50] : freq > 100e3 ? [10, 90] : [1, 99]; }

function presetChannel() {
  return { wave: 'SINE', freq: 1000, sym: 50, duty: 50, phase: 0, emfVpp: 6, emfOffset: 0, load50: true, unit: 'VPP', offUnit: 'VDC', output: false };
}

export class AfgModel {
  constructor() {
    this.id = 'afg';
    this.title = 'AFG-2225';
    this.subtitle = '任意波形訊號產生器';
    this.layout = layout;
    this.practice = [
      '選波形：Waveform → F1 Sine／F2 Square／F3 Pulse／F4 Ramp／F5 Noise（三角波＝Ramp 再設 SYM 50%）',
      '設頻率：FREQ/Rate → 數字 → 單位鍵（例 1 → F4 kHz）',
      '設幅度：AMPL → 數字 → F5 VPP／F3 VRMS／F1 dBm（換單位會真的換算）',
      '設直流偏移：DC Offset → 數字（負值先按 +/-）→ F2 VDC',
      'Pulse：Waveform→Pulse→Width→數字與n/u/mSEC/SEC；20ns低平台/理想邊緣是教學近似，不模擬真機<50ns幅度衰減。',
      'Noise：固定種子、1MSa/s、4096點對稱雜訊的sample-and-hold教學近似；非原廠頻譜，不顯示Frequency。',
      'ARB：Display/Edit/Built in/Output/More，最多4096點±511、Rate最高120MSa/s；命名Built in使用函數近似，未內建原廠66種ROM。',
      'UTIL：10個記憶槽可保存設定/ARB，Preset保留記憶；Dual Chan真的連動兩通道，超界時整筆拒絕。',
      'Inverted Tracking反轉整個EMF（含直流），為教學近似；各通道Output仍獨立。Counter虛擬輸入取實驗台示波器CH1探棒尖端，5Hz–150MHz與gate整數計數近似。',
      'DSO Link從模擬示波器已採集資料正規化匯入ARB；真機只支援GDS-2000，這裡為跨儀器教學橋接，不連實體USB。',
      '微調：◀ ▶ 選位數，再轉旋鈕',
      '方波占空比：Waveform → Square → Duty → 數字 → %；相位：CH1/CH2 → Phase → Phase → 數字 → Degree',
      'Duty／Phase 步進暫定 0.1%／0.1°；改頻率造成 Duty 超界時拒絕。Square 的相位固定 0°。',
      '非 50% 方波自身帶有直流平均；AFG VRMS 幅度是波形本身的總 RMS，電表 AC 檔先去直流，兩者讀值會不同（教學模型）。',
      '通道與輸出：CH1/CH2 切換通道並開 Load 選單；OUTPUT 開關目前通道',
      'MOD：AM/FM/FSK/PM/SUM使用解析相位；最大64000區段，不能整比重複的INT配置或工作量超界會拒絕。FM先積分瞬時頻率，並非frequency×time。',
      'Sweep：INT保持跨掃描相位連續。一般Log積分不能有限整比重複，請用Source→Manual→Trigger作一次掃描；掃描完持續輸出Start頻率。',
      'Burst：INT N Cycle會真的輸出指定cycles與間隔；Manual一次觸發由實驗台排截止段，Infinite只適用Manual。理想Square/Ramp閒置電壓採起始phase對應的波形值。',
      'MOD的峰值採(1+depth×modulator)理想AM或相加SUM；外部MOD/Trigger/Gate、Marker/Trigger TTL端子與韌體校正需硬體，目前明示限制。',
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
    const memories = this.extended?.memories;
    this.extended = instrumentExtensionDefaults();
    if (memories) this.extended.memories = memories;
    ensureExtensions(this);
    this.motionRuntime=[null,null];
  }

  isOn() { return this.on; }
  get c() { return this.ch[this.sel]; }
  refVpp(c = this.c) { return c.load50 ? c.emfVpp / 2 : c.emfVpp; }
  refOffset(c = this.c) { return c.load50 ? c.emfOffset / 2 : c.emfOffset; }

  // 共用判定（AFG-F06 ②、AFG-F08）：候選的 Load 參照值，回傳錯誤字串或 null
  check({ wave, freq, vpp, off, load50, duty = 50, pulseWidth = 100e-6 }) {
    const k = load50 ? 1 : 2;
    const hi = wave !== 'NOISE' && freq >= 20e6;
    const vmin = 0.001 * k, vmax = (hi ? 5 : 10) * k, pk = (hi ? 2.5 : 5) * k;
    const ld = load50 ? '50 Ω' : 'High Z';
    if (wave !== 'NOISE' && (freq < (wave === 'PULSE' ? 500e-6 : FMIN) - 1e-12 || freq > FMAX[wave] * (1 + 1e-12))) {
      return `${WAVE_NAME[wave]} 的頻率範圍是 ${wave==='PULSE'?'500 μHz':'1 μHz'}–${wave === 'RAMP' ? '1 MHz' : wave==='ARB'?'60 MHz':'25 MHz'}`;
    }
    if (wave === 'PULSE') { const [lo, hi] = pulseBounds(freq); if (pulseWidth < lo - 1e-15 || pulseWidth > hi + 1e-15) return `此頻率的 Pulse Width 範圍為 ${lo.toPrecision(5)}–${hi.toPrecision(5)} SEC（先改 Width 再改頻率）`; }
    if (!Number.isFinite(vpp) || !Number.isFinite(off)) return '目前波形不能換算此幅度單位（空白ARB請使用VPP）';
    if (wave === 'SQUARE') {
      const [lo, hi] = dutyRange(freq);
      if (duty < lo - EPS || duty > hi + EPS) return `此頻率的 Square Duty 範圍為 ${lo}%–${hi}%（先改 Duty 再改頻率）`;
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
    return { wave: c.wave, freq: c.freq, duty: c.duty ?? 50, pulseWidth: c.extended?.pulseWidth ?? 100e-6, vpp: this.refVpp(), off: this.refOffset(), load50: c.load50, ...patch };
  }

  // ---- 輸入 ----
  press(id) { const result=this.transaction(() => this.pressRaw(id));if(this.on&&this.extended.beep)this.beepHandler?.();return result; }
  transaction(action) {
    const before = JSON.parse(JSON.stringify(this.ch)), relations = relationState(this), runtime = JSON.parse(JSON.stringify(this.motionRuntime));
    // Memory records are immutable; copying the slot array is sufficient even
    // when recall, delete or an external file callback later fails validation.
    const instrument={...this.extended,memories:[...this.extended.memories]},ui={on:this.on,sel:this.sel,menu:this.menu,hl:this.hl,cexp:this.cexp};
    const rollback=()=>{this.ch=before;this.motionRuntime=runtime;this.extended=instrument;Object.assign(this,ui);};
    try {
      const result=action();let err=applyRelations(this,before,relations);
      // Waveform switches and uncoupled edits need the same limits as numeric
      // commits. In particular Noise/ARB must not bypass the Sine MHz limit.
      if(!err)for(const c of this.ch){err=this.check({wave:c.wave,freq:c.freq,duty:c.duty,pulseWidth:c.extended.pulseWidth,vpp:this.refVpp(c),off:this.refOffset(c),load50:c.load50});if(err)break;}
      if(!err)err=this.ch.map(c=>motionError(c)).find(Boolean);
      if(!err)err=activeChannelsError(this.ch.filter(c=>c.output));
      if(!err&&JSON.stringify(before)!==JSON.stringify(this.ch))try{this.ch.forEach(c=>normalizeChannelExtension(c.extended,c));}catch(e){err=e.message;}
      if(err||result?.kind==='reject'){rollback();return err?{kind:'reject',text:`設定被拒絕：${err}。原值保留。`}:result;}
      // A committed timing/waveform edit arms a new Manual operation. Reusing
      // its old timestamp with a longer duration could restart a finished burst.
      this.ch.forEach((c, i) => {
        const motion = c.extended.motion, old = before[i].extended.motion;
        const timingFields = motion.mode === 'SWEEP' ? ['start', 'stop', 'sweepTime', 'sweepType'] : ['cycles', 'infinite', 'delay', 'burstPhase'];
        if (this.motionRuntime[i] && motion.source === 'MANUAL' &&
          (c.wave !== before[i].wave || carrierRate(c) !== carrierRate(before[i]) ||
           motion.mode !== old.mode || timingFields.some((key) => motion[key] !== old[key]))) this.motionRuntime[i] = null;
      });
      return result;
    } catch(e){rollback();throw e;}
  }
  pressRaw(id) {
    if (id === 'AFG.PWR.POWER') {
      if (this.on) { this.on = false; return { kind: 'approx', text: '模擬電源關閉：面板變暗、兩通道都沒有輸出。' }; }
      this.reset();
      return { kind: 'approx', text: '模擬電源開：回到 Preset 值、兩通道 Output OFF（校機開機記憶未確認，近似）。' };
    }
    if (!this.on) return { kind: 'info', text: '電源關閉中，先按 POWER。' };
    const extended = extensionPress(this, id);
    if (extended.handled) return extended.result;
    const digit = id.match(/^AFG\.NUM\.DIGIT_(\d)$/);
    if (digit) return this.typeChar(digit[1]);
    if (id === 'AFG.NUM.DOT') return this.typeChar('.');
    if (id === 'AFG.NUM.PLUS_MINUS') return this.toggleSign();
    const soft = id.match(/^AFG\.SOFT\.F(\d)$/);
    if (soft) return this.softkey(Number(soft[1]) - 1);
    switch (id) {
      case 'AFG.KEY.WAVEFORM': return this.openMenu('WAVE', null);
      case 'AFG.KEY.FREQ_RATE':
        if (this.c.wave === 'NOISE') return { kind: 'info', text: 'Noise 不適用 Frequency；模擬器以固定種子與1 MSa/s、4096點重複雜訊作教學近似。' };
        if (this.c.wave === 'ARB') { this.discard(); this.menu = 'RATE'; this.hl = 'X_RATE'; this.cexp = 3; return null; }
        return this.openMenu('FREQ', 'FREQ');
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
        { const memories = this.extended.memories; this.extended = instrumentExtensionDefaults(); this.extended.memories = memories; ensureExtensions(this); this.motionRuntime=[null,null]; }
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
    if (extensionReturn(this)) return d;
    if (this.menu === 'LOAD' || this.menu === 'PHASE') { this.menu = 'CH'; this.hl = null; }
    else if (this.menu === 'DUTY') { this.menu = 'SQUARE'; this.hl = null; }
    else if (this.menu === 'RAMP' || this.menu === 'SQUARE') { this.menu = 'WAVE'; if (this.hl === 'SYM' || this.hl === 'DUTY') this.hl = null; }
    return d;
  }

  typeChar(ch) {
    if (!this.hl) return { kind: 'info', text: '先按 FREQ/Rate、AMPL、DC Offset，或選 SYM／Duty／Phase，再輸入數字。' };
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
    if (hl.startsWith('X_')) return 0;
    const spec = CURSOR[hl];
    const preferred = hl === 'FREQ' ? spec.def(this.c) : spec.def(hl === 'AMPL' ? this.c.unit : this.c.offUnit);
    const [lo, hi] = this.cursorRange(hl);
    return Math.min(hi, Math.max(lo, preferred));
  }

  // 編輯框與游標共用格式：位權只能落在畫面實際顯示的數字上（GAP-AFG-04）。
  editParts(hl = this.hl, c = this.c) {
    if (hl?.startsWith('X_')) return extensionEditParts(this);
    if (hl === 'FREQ') {
      const p = freqParts(c.freq);
      return { text: fmtFixed(c.freq / p.mult, Math.round(Math.log10(p.mult)) + 6), unit: p.unit, mult: p.mult };
    }
    if (hl === 'AMPL') return { text: fmtAmpl(this.refVpp(c), c.unit, c), unit: UNIT_TEXT[c.unit], mult: c.unit.startsWith('M') ? 1e-3 : 1 };
    if (hl === 'OFFSET') return { text: fmtOffset(this.refOffset(c), c.offUnit), unit: UNIT_TEXT[c.offUnit], mult: c.offUnit === 'MVDC' ? 1e-3 : 1 };
    if (hl === 'PHASE') return { text: fmtFixed(c.phase ?? 0, 1), unit: '°', mult: 1 };
    return { text: fmtFixed(hl === 'DUTY' ? c.duty ?? 50 : c.sym, 1), unit: '%', mult: 1 };
  }

  cursorRange(hl = this.hl) {
    if (hl?.startsWith('X_')) return extensionCursorRange(this);
    const spec = CURSOR[hl], u = hl === 'AMPL' ? this.c.unit : this.c.offUnit;
    const lo = hl === 'FREQ' ? spec.min : spec.min(u), hi = hl === 'FREQ' ? spec.max : spec.max(u);
    const { text, mult } = this.editParts(hl);
    const [ip, fp = ''] = text.replace(/^-/, '').split('.');
    const unitExp = Math.round(Math.log10(mult));
    return [Math.max(lo, unitExp - fp.length), Math.min(hi, unitExp + ip.length - 1)];
  }

  syncCursor() {
    if (!this.hl) return;
    const [lo, hi] = this.cursorRange();
    this.cexp = Math.min(hi, Math.max(lo, this.cexp));
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
    if (EXT_MENUS[this.menu]) return extensionSoftkey(this, i);
    switch (this.menu) {
      case 'WAVE': return this.pickWave(i);
      case 'SQUARE': if(i===0)return this.openMenu('DUTY','DUTY'); if(i===2){this.c.emfVpp=5;this.c.emfOffset=2.5;this.c.unit='VPP';this.c.offUnit='VDC';return {kind:'approx',text:'TTL shortcut：EMF 5Vpp＋2.5V offset；50Ω參照為2.5Vpp＋1.25Vdc，F3位置採教學近似。'};}return null;
      case 'DUTY':
        if (i === 0) return this.openMenu('DUTY', 'DUTY');
        return this.commitScalar('DUTY');
      case 'PHASE':
        if (i === 0) return this.openMenu('PHASE', 'PHASE');
        if (i === 4) return this.commitScalar('PHASE');
        this.ch.forEach((c) => { c.phase = 0; }); return { kind: 'info', text: 'S_Phase：兩通道Phase已歸零並使用共用模擬時鐘。' };
      case 'RAMP':
        if (i === 0) { this.discard(); this.hl = 'SYM'; this.cexp = this.defaultCursor('SYM'); return null; }
        return this.commitSym();
      case 'FREQ': return this.commitFreq(FREQ_UNITS[i][1], FREQ_UNITS[i][0]);
      case 'AMPL': return this.amplUnitKey(AMPL_UNITS[i]);
      case 'OFFSET': return this.offsetUnitKey(i === 0 ? 'MVDC' : 'VDC');
      case 'CH':
        if (i === 0) { this.discard(); this.menu = 'LOAD'; return null; }
        if (i === 3) {
          if(this.c.extended.motion.mode!=='CONT')return {kind:'reject',text:'MOD/Sweep/Burst啟用時不能改面板Phase；Burst請用Burst Phase。'};
          if (['SQUARE', 'PULSE', 'NOISE', 'ARB'].includes(this.c.wave)) return { kind: 'reject', text: 'Square／Pulse 的 Phase 固定 0°；Noise沒有週期相位。請先選 Sine或Ramp。' };
          return this.openMenu('PHASE', 'PHASE');
        }
        if (i === 4) return this.openMenu('DSO', null);
        return { kind: 'out', text: `「${label}」本輪未納入練習範圍，按了不會改變狀態。` };
      case 'LOAD': return this.setLoad(i === 0);
      default: return null;
    }
  }

  pickWave(i) {
    const w = ['SINE', 'SQUARE', 'PULSE', 'RAMP', 'NOISE'][i];
    if (!w) return { kind: 'out', text: `${MENUS.WAVE[i]} 本輪未納入練習範圍，波形不變。` };
    this.discard();
    const c = this.c;
    let msg = null;
    if (w === 'RAMP' && c.freq > FMAX.RAMP) {
      c.freq = FMAX.RAMP;
      msg = { kind: 'approx', text: 'Ramp 最高 1 MHz：頻率已降為 1 MHz（依遠端說明的近似行為，AFG-F12）。' };
    }
    c.wave = w;
    if (w === 'PULSE') {
      c.freq = Math.min(25e6, Math.max(500e-6, c.freq));
      const [lo, hi] = pulseBounds(c.freq); c.extended.pulseWidth = Math.min(hi, Math.max(lo, c.extended.pulseWidth)); c.phase = 0;
      msg = { kind: 'approx', text: 'Pulse已啟用：理想跳變且保留至少20ns低平台；Width依頻率下限與T/4096限制，校機邊緣時間尚待確認。' };
    }
    if (w === 'NOISE') { c.phase = 0; msg = { kind: 'approx', text: 'Noise已啟用：固定種子、1MSa/s、4096點對稱sample-and-hold雜訊（教學近似，非原廠頻譜），不提供雜訊頻率讀值。' }; }
    if (w === 'SQUARE') {
      const [lo, hi] = dutyRange(c.freq), before = c.duty ?? 50;
      c.duty = Math.min(hi, Math.max(lo, before)); c.phase = 0;
      if (c.duty !== before) msg = { kind: 'approx', text: `Square 的 Duty 已調至 ${c.duty}%（切波形時夾至合法範圍，教學近似）。Phase 固定 0°。` };
    }
    this.menu = w === 'RAMP' ? 'RAMP' : w === 'SQUARE' ? 'SQUARE' : w === 'PULSE' ? 'PULSE' : 'WAVE';
    if (['SYM', 'DUTY', 'PHASE'].includes(this.hl)) this.hl = null;
    this.syncCursor();
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
    if (!Number.isFinite(crestFactor(c)) && !['VPP', 'MVPP'].includes(unit)) { this.buf = ''; return { kind: 'reject', text: '空白ARB沒有RMS振幅，請先編輯波形或使用VPP。' }; }
    if (unit === 'DBM' && !c.load50) {
      this.buf = '';
      return { kind: 'reject', text: 'High Z 時不能用 dBm（AFG-F11），顯示單位不變。' };
    }
    if (this.hl !== 'AMPL') return null;
    if (!this.buf) { // 只換顯示單位：物理幅度不變、不重新判定（GAP-AFG-11）
      c.unit = unit;
      this.cexp = this.defaultCursor('AMPL');
      return null;
    }
    const raw = this.buf;
    const x = this.parseBuf();
    if (x == null) return { kind: 'reject', text: `「${raw}」不是有效數字，幅度保留原值。` };
    if (unit !== 'DBM' && x <= 0) return { kind: 'reject', text: 'Vpp／Vrms 必須大於 0，幅度保留原值。' };
    const vpp = toVpp(x, unit, c); // ① 不先捨入
    const err = this.check(this.candidate({ vpp })); // ②
    if (err) return { kind: 'reject', text: `${raw} ${UNIT_TEXT[unit]} 被拒絕：${err}。已提交值與顯示單位不變。` };
    c.emfVpp = c.load50 ? vpp * 2 : vpp; // ③ 保存未捨入值
    c.unit = unit;
    this.cexp = this.defaultCursor('AMPL');
    return unit === 'VPP' ? null : { kind: 'info', text: `${raw} ${UNIT_TEXT[unit]} ≈ ${vpp.toPrecision(7)} Vpp（${WAVE_NAME[c.wave]}，${c.load50 ? '50 Ω' : 'High Z'} 參照）。` };
  }

  offsetUnitKey(unit) {
    const c = this.c;
    if (this.hl !== 'OFFSET') return null;
    if (!this.buf) { c.offUnit = unit; this.cexp = this.defaultCursor('OFFSET'); return null; }
    const raw = this.buf;
    const x = this.parseBuf();
    if (x == null) return { kind: 'reject', text: `「${raw}」不是有效數字，Offset 保留原值。` };
    const off = unit === 'MVDC' ? x / 1000 : x;
    const lim = (c.wave !== 'NOISE' && c.freq >= 20e6 ? 2.5 : 5) * (c.load50 ? 1 : 2);
    if (Math.abs(off) > lim + EPS) return { kind: 'reject', text: `Offset ${raw} ${UNIT_TEXT[unit]} 超過 ±${lim} Vpk，原值保留。` };
    const err = this.check(this.candidate({ off }));
    if (err) return { kind: 'reject', text: `Offset ${raw} ${UNIT_TEXT[unit]} 被拒絕：${err}。原值保留。` };
    c.emfOffset = c.load50 ? off * 2 : off;
    c.offUnit = unit;
    this.cexp = this.defaultCursor('OFFSET');
    return null;
  }

  commitSym() {
    if (this.hl !== 'SYM' || !this.buf) return null;
    const raw = this.buf;
    const x = this.parseBuf();
    if (x == null || x < 0 || x > 100) return { kind: 'reject', text: `SYM ${raw}% 超出 0%–100%，原值保留。` };
    this.c.sym = Math.round(x * 10) / 10;
    this.syncCursor();
    return null;
  }

  scalarError(hl, x) {
    if (!Number.isFinite(x)) return '輸入不是有效數字';
    if (hl === 'PHASE') return x < -180 || x > 180 ? 'Phase 範圍為 −180°–180°' : null;
    const [lo, hi] = dutyRange(this.c.freq);
    return x < lo || x > hi ? `此頻率的 Square Duty 範圍為 ${lo}%–${hi}%` : null;
  }

  commitScalar(hl) {
    if (this.hl !== hl || !this.buf) return null;
    const raw = this.buf, x = this.parseBuf(), err = this.scalarError(hl, x);
    if (x == null || err) return { kind: 'reject', text: `${hl} ${raw} 被拒絕：${err || '輸入不是有效數字'}。原值保留。` };
    this.c[hl === 'DUTY' ? 'duty' : 'phase'] = Math.round(x * 10) / 10;
    this.syncCursor();
    return null;
  }

  setLoad(to50) {
    const c = this.c;
    if (c.load50 === to50) return null;
    c.load50 = to50; // EMF 不變，參照值自動 ×2／÷2（AFG-F10）
    let text = `CH${this.sel + 1} Load 改為 ${to50 ? '50 Ω' : 'High Z'}：顯示值${to50 ? '減半' : '加倍'}，實際輸出（EMF）不變。`;
    if (!to50 && c.unit === 'DBM') { c.unit = 'VPP'; text += ' dBm 在 High Z 不能用，單位改為 VPP。'; }
    this.syncCursor();
    return { kind: 'info', text };
  }

  // ---- 旋鈕（AFG-F05、GAP-AFG-04、AFG-F06 旋鈕句）----
  turn(id, dir) { return this.transaction(() => this.turnRaw(id, dir)); }
  turnRaw(id, dir) {
    if (!this.on) return null;
    const extended = extensionTurn(this, dir);
    if (extended.handled) return extended.result;
    if (!this.hl) return null; // 沒有參數高亮時旋鈕不作用（GAP-AFG-15）
    const d = this.discard();
    this.syncCursor();
    const w = 10 ** this.cexp;
    const c = this.c;
    if (this.hl === 'FREQ') {
      const f = Math.round((c.freq + dir * w) * 1e6) / 1e6;
      const err = this.check(this.candidate({ freq: f }));
      if (err) return { kind: 'reject', text: `這一步不生效：${err}。` };
      c.freq = f;
    } else if (this.hl === 'AMPL') {
      const x = fromVpp(this.refVpp(), c.unit, c) + dir * (c.unit.startsWith('M') ? w * 1000 : w);
      if (c.unit !== 'DBM' && x <= 0) return { kind: 'reject', text: '這一步不生效：幅度必須大於 0。' };
      const vpp = toVpp(x, c.unit, c);
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
    } else if (this.hl === 'DUTY' || this.hl === 'PHASE') {
      const field = this.hl === 'DUTY' ? 'duty' : 'phase';
      const x = Math.round(((c[field] ?? (field === 'duty' ? 50 : 0)) + dir * w) * 10) / 10;
      const err = this.scalarError(this.hl, x);
      if (err) return { kind: 'reject', text: `這一步不生效：${err}。` };
      c[field] = x;
    }
    this.syncCursor();
    return d;
  }

  // ---- 輸出 ----
  lcd() { return renderLcd(this); }
  extensionRows() { return extensionRows(this); }
  setBeepHandler(handler) { this.beepHandler=handler; }
  setArbFileHandler(handler) { this.arbFileHandler=handler; }
  exportArbFile() { return exportArbFile(this); }
  importArbFile(value) { return this.transaction(()=>importArbFile(this,value)); }
  setTriggerSource(source) { this.triggerSource=source; }
  driverDescriptor(i,time) { const p={...this.descriptor(i),output:this.on&&this.ch[i].output,triggeredAt:this.motionRuntime[i]?.firedAt??null};return time===undefined?p:applyMotionAt(p,time); }
  driverTransitionTimes(afterTime) {return this.ch.map((c,i)=>motionEnd(this.driverDescriptor(i),afterTime)).filter((t)=>Number.isFinite(t));}
  setCounterSource(source) { this.counterSource = source; }
  setDsoSource(source) { this.dsoSource = source; }
  visual() { return {}; }

  descriptor(i) {
    const c = this.ch[i];
    return { enabled: this.on&&c.output, carrierFreq:carrierRate(c), maxCarrierFreq:c.wave==='ARB'?c.extended.arb.rate:c.wave==='NOISE'?c.extended.noiseRate:maxMotionRate(c), rInternal: 50, wave: c.wave, freq: c.freq, sym: c.sym, duty: c.duty ?? 50, phase: ['SQUARE', 'PULSE', 'NOISE'].includes(c.wave) ? 0 : c.phase ?? 0, extended: c.extended, emfVpp: c.emfVpp, emfOffset: c.emfOffset };
  }

  status() {
    const rows = [['選取通道', `CH${this.sel + 1}`], ...this.extensionRows()];
    this.ch.forEach((c, i) => {
      const ld = c.load50 ? '50 Ω' : 'High Z';
      rows.push([`CH${i + 1}`, `${WAVE_NAME[c.wave]}${c.wave === 'RAMP' ? `（SYM ${fmtFixed(c.sym, 1)}%）` : ''}，${c.wave === 'NOISE' ? 'Frequency N/A' : c.wave === 'ARB' ? `Rate ${c.extended.arb.rate} Sa/s` : `${freqParts(c.freq).text} ${freqParts(c.freq).unit}`}，輸出 ${c.output ? 'ON' : 'OFF'}`]);
      rows.push(['', `幅度 ${fmtAmpl(this.refVpp(c), c.unit, c)} ${UNIT_TEXT[c.unit]}（${ld} 參照 ≈ ${this.refVpp(c).toPrecision(6)} Vpp），Offset ${fmtOffset(this.refOffset(c), c.offUnit)} ${UNIT_TEXT[c.offUnit]}`]);
      rows.push(['', `Phase ${fmtFixed(['SQUARE', 'PULSE', 'NOISE', 'ARB'].includes(c.wave) ? 0 : c.phase ?? 0, 1)}°${c.wave === 'SQUARE' ? `，Duty ${fmtFixed(c.duty ?? 50, 1)}%` : ''}`]);
    });
    if (this.buf) rows.push(['輸入中', `${this.buf}（按單位鍵才提交）`]);
    return rows;
  }

  snapshot() {
    return {
      extended: this.extended,
      on: this.on, sel: this.sel + 1, menu: this.menu, highlight: this.hl, buffer: this.buf, cursorExp: this.cexp,
      ch: this.ch.map((c, i) => ({ ...c, refVpp: this.refVpp(c), refOffset: this.refOffset(c), descriptor: this.descriptor(i) })),
    };
  }
}
