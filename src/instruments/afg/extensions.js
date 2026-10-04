// AFG-2225 Ver.B: Pulse p.57–60/218, UTIL p.133–146, ARB p.148–180.
// Pure data helpers are shared with the electrical solver and session validator.
import { motionDefaults, normalizeMotion, motionError, motionFrequency, carrierRate, activeChannelsError } from './motion.js';
import { fmtFixed } from '../../core/format.js';

export const ARB_SIZE = 4096;
export const EXT_MENUS = {
  MOD: ['AM', 'FM', 'FSK', 'PM', 'SUM'],
  AM: ['Source','Depth','AM Freq','Shape',''], FM: ['Source','Freq Dev','FM Freq','Shape',''],
  FSK: ['Source','Hop Freq','FSK Rate','',''], PM: ['Source','Phase Dev','PM Freq','Shape',''], SUM: ['Source','SUM Ampl','SUM Freq','Shape',''],
  MOD_SOURCE: ['INT','EXT','','',''], MOD_SHAPE: ['Sine','Square','Triangle','UpRamp','DnRamp'],
  MOD_FREQ: ['mHz','Hz','kHz','',''], MOTION_FREQ: ['uHz','mHz','Hz','kHz','MHz'], MOTION_PERCENT: ['%','','','',''],
  MOTION_DEGREE: ['Degree','','','',''], BURST_DEGREE: ['Clear','Degree','','',''], SWEEP_TIME: ['mSEC','SEC','','',''],
  BURST_TIME: ['uSEC','mSEC','SEC','',''], BURST_DELAY: ['nSEC','uSEC','mSEC','SEC',''], BURST_COUNT: ['Cycles','Cyc','','',''],
  SWEEP: ['Source','Type','Start','Stop','More'], SWEEP_MORE: ['SWP Time','Span','Center','Marker',''],
  SWEEP_TYPE: ['Linear','Log','','',''], SWEEP_SOURCE: ['INT','EXT','Manual','',''], SWEEP_MARKER: ['Freq','ON/OFF','','',''],
  BURST: ['N Cycle','Gate','','',''], BURST_N: ['Cycles','Infinite','Phase','Period','TRIG set'],
  BURST_GATE: ['Polarity','Phase','','',''], BURST_POLARITY: ['Pos','Neg','','',''],
  BURST_TRIG: ['INT','EXT','Manual','Delay','TRIG out'], BURST_OUT: ['Rise','Fall','ON/OFF','',''], MOTION_TRIGGER: ['Trigger','','','',''],
  PULSE: ['Width', 'nSEC', 'uSEC', 'mSEC', 'SEC'],
  CPL_OFFSET: ['uHz', 'mHz', 'Hz', 'kHz', 'MHz'],
  CPL_RATIO: ['Ratio', '', '', '', 'Enter'],
  RATE: ['uSa/s', 'mSa/s', 'Sa/s', 'kSa/s', 'MSa/s'],
  UTIL: ['Memory', 'Cal.', 'System', 'Dual Chan', 'Counter'],
  MEMORY: ['Store', 'Recall', 'Delete', 'Delete All', ''],
  MEMORY_TYPE: ['', '', '', '', 'Done'], MEMORY_CONFIRM: ['', '', '', '', 'Done'],
  DELETE_ALL: ['Done', '', '', '', ''],
  CAL: ['', 'Software', '', '', ''], SOFTWARE: ['Version', 'Upgrade', '', '', ''], VERSION: ['', '', '', '', ''],
  SYSTEM: ['Language', 'Help', 'Beep', '', ''], BEEP: ['ON', 'OFF', '', '', ''], HELP: ['', '', '', '', ''], LANGUAGE: ['English', '', '', '', ''],
  DUAL: ['Freq Cpl', 'Ampl Cpl', 'Tracking', 'S_Phase', ''],
  FREQ_CPL: ['Ratio', 'Offset', 'OFF', '', ''], AMPL_CPL: ['ON', 'OFF', '', '', ''], TRACKING: ['OFF', 'ON', 'Inverted', '', ''],
  COUNTER: ['Gate Time', '', '', '', ''], COUNTER_GATE: ['0.01 Sec', '0.1 Sec', '1 Sec', '10 Sec', ''],
  DSO: ['Search', 'CH1', 'CH2', 'CH3', 'CH4'],
  ARB: ['Display', 'Edit', 'Built in', 'Output', 'More'],
  ARB_DISPLAY: ['Horizon', 'Vertical', 'Display', 'Back Page', 'Next Page'],
  ARB_HORIZ: ['Start', 'Length', 'Center', 'Zoom in', 'Zoom out'], ARB_VERTICAL: ['Low', 'High', 'Center', 'Zoom in', 'Zoom out'],
  ARB_EDIT: ['Point', 'Line', 'Copy', 'Clear', 'Protect'],
  ARB_POINT: ['Address', 'Data', 'Done', '', ''], ARB_LINE: ['Start', 'Stop', 'Data', 'Line', 'Done'],
  ARB_COPY: ['From', 'Length', 'To', 'Done', ''], ARB_CLEAR: ['Start', 'Length', 'Done', 'ALL', ''],
  ARB_CLEAR_ALL: ['Done', '', '', '', ''], ARB_PROTECT: ['ALL', 'Start', 'Length', 'Done', 'Unprotect'],
  ARB_PROTECT_ALL: ['Done', '', '', '', ''], ARB_UNPROTECT: ['Done', '', '', '', ''],
  ARB_BUILTIN: ['Start', 'Length', 'Scale', 'Wave', 'Done'], ARB_CATEGORIES: ['Common', 'Math', 'Window', 'Engineer', ''],
  ARB_WAVES: ['', '', '', '', 'Select'], ARB_OUTPUT: ['Start', 'Length', '', '', ''],
  ARB_MORE: ['Save', 'Load', '', '', ''], ARB_SAVE: ['Start', 'Length', 'Memory', 'USB', ''],
  ARB_LOAD: ['To', '', 'Memory', 'USB', ''], ARB_SAVE_MEMORY: ['Select', '', '', '', ''], ARB_LOAD_MEMORY: ['Select', '', '', '', ''],
  EXT_INPUT: ['Clear', 'Enter', '', '', ''],
};

export function channelExtensionDefaults(seed = 12345) {
  return { motion: motionDefaults(), inverted: false, pulseWidth: 100e-6, widthUnit: 'USEC', noiseSeed: seed, noiseRate: 1e6,
    arb: { points: Array(ARB_SIZE).fill(0), rate: 4096e3, start: 0, length: ARB_SIZE, display: true,
      displayStart: 0, displayLength: ARB_SIZE, low: -511, high: 511, protectStart: 0, protectLength: 0,
      pointAddress: 0, pointData: 0, lineStart: 0, lineStop: 32, lineData: 511, lineMode: 'RISING',
      copyFrom: 0, copyLength: 32, copyTo: 32, clearStart: 0, clearLength: 32,
      builtinStart: 0, builtinLength: 33, builtinScale: 511, builtinCategory: 'COMMON', builtinIndex: 0,
      saveStart: 0, saveLength: ARB_SIZE, loadTo: 0 } };
}
export function instrumentExtensionDefaults() {
  return { memoryIndex: 0, memoryType: 'BOTH', memoryAction: 'STORE', memories: Array(10).fill(null),
    beep: false, editReturn: 'ARB', tracking: 'OFF', amplCoupled: false, freqCoupled: false,
    freqMode: 'RATIO', ratio: 1, freqOffset: 0, gate: 1, dsoChannel: 0, dsoFound: false };
}
const clone = (x) => JSON.parse(JSON.stringify(x));
export function ensureExtensions(m) {
  m.extended ??= instrumentExtensionDefaults();
  m.ch.forEach((c, i) => { c.extended ??= channelExtensionDefaults(12345 + i); });
}

export function pulseBounds(freq) {
  const period = 1 / freq;
  // The manual does not give the default edge time and its remote examples
  // conflict with the published 20 ns minimum. Use ideal edges and reserve
  // 20 ns low time; clearly described as a conservative teaching approximation.
  return [Math.max(20e-9, freq <= 100e3 ? period / 4096 : 0), Math.min(1999.9, period - 20e-9)];
}

const noiseCache = new Map();
export function noisePoints(seed = 12345) {
  seed >>>= 0;
  if (!noiseCache.has(seed)) {
    let x = seed || 1; const a = [];
    for (let k = 0; k < ARB_SIZE / 2; k++) {
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      const value = Math.round((((x >>> 0) / 4294967295) * 2 - 1) * 511);
      a.push(value, -value);
    }
    // Shuffle the paired values without changing mean/RMS.
    for (let k = a.length - 1; k > 0; k--) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; const j = (x >>> 0) % (k + 1); [a[k], a[j]] = [a[j], a[k]]; }
    noiseCache.set(seed, Object.freeze(a));
    if (noiseCache.size > 16) noiseCache.delete(noiseCache.keys().next().value);
  }
  return noiseCache.get(seed);
}
export function electricalFrequency(c) {
  return motionFrequency(c);
}
export function tableData(c) {
  if (c.wave === 'NOISE') return { points: noisePoints(c.extended?.noiseSeed), start: 0, length: ARB_SIZE };
  if (c.wave === 'ARB') { const a = c.extended?.arb ?? channelExtensionDefaults().arb; return { points: a.points, start: a.start, length: a.length }; }
  return null;
}
export function crestFactor(waveOrChannel) {
  const wave = typeof waveOrChannel === 'string' ? waveOrChannel : waveOrChannel.wave;
  if (wave === 'SINE') return 2 * Math.SQRT2;
  if (wave === 'SQUARE' || wave === 'PULSE') return 2;
  if (wave === 'RAMP') return 2 * Math.sqrt(3);
  const c = typeof waveOrChannel === 'string' ? { wave } : waveOrChannel, a = tableData(c);
  let square = 0;
  for (let k = 0; k < a.length; k++) square += (a.points[a.start + k] / 511) ** 2;
  return square > 0 ? 2 / Math.sqrt(square / a.length) : Infinity;
}

const menuReturn = {
  MOD:'WAVE',SWEEP:'WAVE',SWEEP_MORE:'SWEEP',SWEEP_TYPE:'SWEEP',SWEEP_SOURCE:'SWEEP',SWEEP_MARKER:'SWEEP_MORE',BURST:'WAVE',BURST_N:'BURST',BURST_TRIG:'BURST_N',BURST_OUT:'BURST_TRIG',
  UTIL: 'WAVE', MEMORY: 'UTIL', MEMORY_TYPE: 'MEMORY', MEMORY_CONFIRM: 'MEMORY_TYPE', DELETE_ALL: 'MEMORY',
  CAL: 'UTIL', SOFTWARE: 'CAL', VERSION: 'SOFTWARE', SYSTEM: 'UTIL', BEEP: 'SYSTEM', HELP: 'SYSTEM', LANGUAGE: 'SYSTEM',
  DUAL: 'UTIL', FREQ_CPL: 'DUAL', CPL_OFFSET: 'FREQ_CPL', CPL_RATIO: 'FREQ_CPL', AMPL_CPL: 'DUAL', TRACKING: 'DUAL', COUNTER: 'UTIL', COUNTER_GATE: 'COUNTER', DSO: 'CH',
  ARB: 'WAVE', ARB_DISPLAY: 'ARB', ARB_HORIZ: 'ARB_DISPLAY', ARB_VERTICAL: 'ARB_DISPLAY', ARB_EDIT: 'ARB',
  ARB_POINT: 'ARB_EDIT', ARB_LINE: 'ARB_EDIT', ARB_COPY: 'ARB_EDIT', ARB_CLEAR: 'ARB_EDIT', ARB_CLEAR_ALL: 'ARB_CLEAR',
  ARB_PROTECT: 'ARB_EDIT', ARB_PROTECT_ALL: 'ARB_PROTECT', ARB_UNPROTECT: 'ARB_PROTECT', ARB_BUILTIN: 'ARB',
  ARB_CATEGORIES: 'ARB_BUILTIN', ARB_WAVES: 'ARB_CATEGORIES', ARB_OUTPUT: 'ARB', ARB_MORE: 'ARB', ARB_SAVE: 'ARB_MORE', ARB_LOAD: 'ARB_MORE',
  ARB_SAVE_MEMORY: 'ARB_SAVE', ARB_LOAD_MEMORY: 'ARB_LOAD', PULSE: 'WAVE', RATE: 'ARB',
};

// Built-in sample recipes are teaching approximations to the named functions;
// the real 66-shape ROM is not present in the manual. No fabricated ROM data.
export const BUILTINS = {
  COMMON: ['AbsAtan', 'Sine', 'Square', 'Triangle', 'UpRamp', 'DnRamp', 'DC'],
  MATH: ['AbsSine', 'Sinc', 'Exponential', 'Logarithm', 'Gaussian'],
  WINDOW: ['Hanning', 'Hamming', 'Blackman', 'Bartlett'],
  ENGINEER: ['Step', 'Pulse', 'DampedSine'],
};
function builtinValue(name, q) {
  const x = 2 * q - 1;
  return ({ AbsAtan: () => Math.abs(Math.atan(4 * x)) / Math.atan(4), Sine: () => Math.sin(2 * Math.PI * q),
    Square: () => q < .5 ? 1 : -1, Triangle: () => 1 - 2 * Math.abs(x), UpRamp: () => x, DnRamp: () => -x, DC: () => 1,
    AbsSine: () => Math.abs(Math.sin(2 * Math.PI * q)), Sinc: () => Math.abs(x) < 1e-12 ? 1 : Math.sin(4 * Math.PI * x) / (4 * Math.PI * x),
    Exponential: () => (Math.exp(3 * q) - 1) / Math.expm1(3), Logarithm: () => Math.log1p(9 * q) / Math.log(10), Gaussian: () => Math.exp(-8 * x * x),
    Hanning: () => .5 - .5 * Math.cos(2 * Math.PI * q), Hamming: () => .54 - .46 * Math.cos(2 * Math.PI * q),
    Blackman: () => .42 - .5 * Math.cos(2 * Math.PI * q) + .08 * Math.cos(4 * Math.PI * q), Bartlett: () => 1 - Math.abs(x),
    Step: () => q < .5 ? 0 : 1, Pulse: () => q < .1 ? 1 : 0, DampedSine: () => Math.exp(-4 * q) * Math.sin(8 * Math.PI * q) }[name] || (() => 0))();
}

const FIELDS = {
  MODFREQ: {path:['motion','frequency'],label:'Mod Freq',lo:.002,hi:20000,decimals:6,unit:'Hz'},
  DEPTH: {path:['motion','depth'],label:'Depth',lo:0,hi:120,decimals:1,unit:'%'},
  DEVIATION: {path:['motion','deviation'],label:'Freq Dev',lo:0,hi:25e6,decimals:6,unit:'Hz'},
  PMDEV: {path:['motion','phaseDeviation'],label:'Phase Dev',lo:0,hi:360,decimals:1,unit:'Degree'},
  HOP: {path:['motion','hop'],label:'Hop Freq',lo:1e-6,hi:25e6,decimals:6,unit:'Hz'},
  SUMAMPL: {path:['motion','sum'],label:'SUM Ampl',lo:0,hi:100,decimals:1,unit:'%'},
  SWEEPSTART: {path:['motion','start'],label:'Start',lo:1e-6,hi:25e6,decimals:6,unit:'Hz'},
  SWEEPSTOP: {path:['motion','stop'],label:'Stop',lo:1e-6,hi:25e6,decimals:6,unit:'Hz'},
  SWEEPCENTER: {label:'Center',lo:1e-6,hi:25e6,decimals:6,unit:'Hz'}, SWEEPSPAN: {label:'Span',lo:-25e6,hi:25e6,decimals:6,unit:'Hz'},
  SWEEPTIME: {path:['motion','sweepTime'],label:'SWP Time',lo:.001,hi:500,decimals:9,unit:'SEC'},
  MARKER: {path:['motion','marker'],label:'Marker',lo:1e-6,hi:25e6,decimals:6,unit:'Hz'},
  BCYCLES: {path:['motion','cycles'],label:'Cycles',lo:1,hi:65535},
  BPERIOD: {path:['motion','period'],label:'Period',lo:.001,hi:500,decimals:9,unit:'SEC'},
  BPHASE: {path:['motion','burstPhase'],label:'Phase',lo:-360,hi:360,decimals:1,unit:'Degree'},
  BDELAY: {path:['motion','delay'],label:'Delay',lo:0,hi:655350e-9,decimals:9,unit:'SEC'},
  WIDTH: { path: ['pulseWidth'], label: 'Width', lo: 20e-9, hi: 1999.9, decimals: 9, unit: 'SEC' },
  RATE: { path: ['arb', 'rate'], label: 'Rate', lo: .000002, hi: 120e6, decimals: 6, unit: 'Sa/s' },
  HSTART: { path: ['arb', 'displayStart'], label: 'H_From', lo: 0, hi: 4095 }, HLENGTH: { path: ['arb', 'displayLength'], label: 'H_Length', lo: 1, hi: 4096 },
  HCENTER: { label: 'H_Center', lo: 0, hi: 4095 }, VLOW: { path: ['arb', 'low'], label: 'V_Low', lo: -511, hi: 510 },
  VHIGH: { path: ['arb', 'high'], label: 'V_High', lo: -510, hi: 511 }, VCENTER: { label: 'V_Center', lo: -511, hi: 511 },
  ADDRESS: { path: ['arb', 'pointAddress'], label: 'Address', lo: 0, hi: 4095 }, DATA: { path: ['arb', 'pointData'], label: 'Data', lo: -511, hi: 511 },
  LINESTART: { path: ['arb', 'lineStart'], label: 'Start', lo: 0, hi: 4095 }, LINESTOP: { path: ['arb', 'lineStop'], label: 'Stop', lo: 0, hi: 4095 }, LINEDATA: { path: ['arb', 'lineData'], label: 'Data', lo: -511, hi: 511 },
  COPYFROM: { path: ['arb', 'copyFrom'], label: 'From', lo: 0, hi: 4095 }, COPYLEN: { path: ['arb', 'copyLength'], label: 'Length', lo: 1, hi: 4096 }, COPYTO: { path: ['arb', 'copyTo'], label: 'To', lo: 0, hi: 4095 },
  CLEARSTART: { path: ['arb', 'clearStart'], label: 'From', lo: 0, hi: 4095 }, CLEARLEN: { path: ['arb', 'clearLength'], label: 'Length', lo: 1, hi: 4096 },
  PROTECTSTART: { path: ['arb', 'protectStart'], label: 'Start', lo: 0, hi: 4095 }, PROTECTLEN: { path: ['arb', 'protectLength'], label: 'Length', lo: 0, hi: 4096 },
  BUILTINSTART: { path: ['arb', 'builtinStart'], label: 'Start', lo: 0, hi: 4095 }, BUILTINLEN: { path: ['arb', 'builtinLength'], label: 'Length', lo: 2, hi: 4096 }, BUILTINSCALE: { path: ['arb', 'builtinScale'], label: 'Scale', lo: 0, hi: 511 },
  OUTSTART: { path: ['arb', 'start'], label: 'Start', lo: 0, hi: 4094 }, OUTLEN: { path: ['arb', 'length'], label: 'Length', lo: 2, hi: 4096 },
  SAVESTART: { path: ['arb', 'saveStart'], label: 'Start', lo: 0, hi: 4095 }, SAVELEN: { path: ['arb', 'saveLength'], label: 'Length', lo: 1, hi: 4096 }, LOADTO: { path: ['arb', 'loadTo'], label: 'To', lo: 0, hi: 4095 },
  RATIO: { instrument: true, path: ['ratio'], label: 'Ratio', lo: .000001, hi: 1e6, decimals: 6 },
  FCOFFSET: { instrument: true, path: ['freqOffset'], label: 'Offset', lo: -25e6, hi: 25e6, decimals: 6, unit: 'Hz' },
};
export const EXT_HIGHLIGHTS = Object.keys(FIELDS).map((name) => `X_${name}`);
const getPath = (obj, path) => path.reduce((x, key) => x[key], obj);
function setPath(obj, path, value) { const o = path.slice(0, -1).reduce((x, key) => x[key], obj); o[path.at(-1)] = value; }
function fieldValue(m, key) {
  const f = FIELDS[key], a = m.c.extended.arb;
  if (key === 'SWEEPCENTER') return (m.c.extended.motion.start+m.c.extended.motion.stop)/2;
  if (key === 'SWEEPSPAN') return m.c.extended.motion.stop-m.c.extended.motion.start;
  if (key === 'HCENTER') return Math.floor(a.displayStart + a.displayLength / 2);
  if (key === 'VCENTER') return Math.round((a.low + a.high) / 2);
  return getPath(f.instrument ? m.extended : m.c.extended, f.path);
}
function edit(m, key, menu = 'EXT_INPUT') {
  m.discard(); m.extended.editReturn = m.menu; m.menu = menu; m.hl = `X_${key}`;
  const p = extensionEditParts(m), shown = p.text.replace(/^-/, '').split('.'), min = -Math.min(shown[1]?.length || 0, FIELDS[key].decimals || 0);
  m.cexp = Math.max(min + Math.round(Math.log10(p.mult)), Math.round(Math.log10(p.mult)));
  return null;
}
export function extensionEditParts(m) {
  const key = m.hl.slice(2), f = FIELDS[key], value = fieldValue(m, key);
  let unit = f.unit || '', mult = 1, decimals = f.decimals || 0;
  if (key === 'WIDTH') { unit = { NSEC: 'nSEC', USEC: 'uSEC', MSEC: 'mSEC', SEC: 'SEC' }[m.c.extended.widthUnit]; mult = { NSEC: 1e-9, USEC: 1e-6, MSEC: 1e-3, SEC: 1 }[m.c.extended.widthUnit]; decimals = Math.max(0, Math.round(Math.log10(mult)) + 9); }
  if (key === 'RATE') { unit = value >= 1e6 ? 'MSa/s' : value >= 1e3 ? 'kSa/s' : 'Sa/s'; mult = value >= 1e6 ? 1e6 : value >= 1e3 ? 1e3 : 1; decimals = 6; }
  return { text: fmtFixed(value / mult, decimals), unit, mult };
}
export function extensionCursorRange(m) {
  const f = FIELDS[m.hl.slice(2)], p = extensionEditParts(m), [ip, fp = ''] = p.text.replace(/^-/, '').split('.'), exponent = Math.round(Math.log10(p.mult));
  return [Math.max(-(f.decimals || 0), exponent - fp.length), exponent + ip.length - 1];
}
function setField(m, key, value) {
  const f = FIELDS[key], a = m.c.extended.arb;
  if (!Number.isFinite(value) || value < f.lo - 1e-12 || value > f.hi + 1e-12 || !f.decimals && !Number.isInteger(value)) return { kind: 'reject', text: `${f.label} 範圍 ${f.lo}–${f.hi}${f.decimals ? '' : '（整數）'}，原值保留。` };
  if (key === 'WIDTH') {
    const [lo, hi] = pulseBounds(m.c.freq);
    if (value < lo - 1e-15 || value > hi + 1e-15) return { kind: 'reject', text: `此頻率的 Width 範圍為 ${lo.toPrecision(5)}–${hi.toPrecision(5)} SEC（理想邊緣且保留至少20 ns低平台的教學近似）。` };
  }
  const pairs = [['HSTART', 'HLENGTH', 'displayStart', 'displayLength'], ['OUTSTART', 'OUTLEN', 'start', 'length'], ['COPYFROM', 'COPYLEN', 'copyFrom', 'copyLength'], ['CLEARSTART', 'CLEARLEN', 'clearStart', 'clearLength'], ['PROTECTSTART', 'PROTECTLEN', 'protectStart', 'protectLength'], ['BUILTINSTART', 'BUILTINLEN', 'builtinStart', 'builtinLength'], ['SAVESTART', 'SAVELEN', 'saveStart', 'saveLength']];
  for (const [startKey, lengthKey, start, length] of pairs) if (key === startKey || key === lengthKey) {
    if ((key === startKey ? value : a[start]) + (key === lengthKey ? value : a[length]) > ARB_SIZE) return { kind: 'reject', text: `${f.label} 使區段超過4096點，原值保留。` };
  }
  if ((key === 'RATE' && (value / a.length < 1e-6 || value / a.length > 60e6)) || (key === 'OUTLEN' && (a.rate / value < 1e-6 || a.rate / value > 60e6))) return { kind: 'reject', text: 'ARB輸出頻率須在1µHz–60MHz，原值保留。' };
  if (['RATE', 'OUTLEN'].includes(key) && m.c.wave === 'ARB') { const frequency = key === 'RATE' ? value / a.length : a.rate / value, err = m.check(m.candidate({ freq: frequency })); if (err) return { kind: 'reject', text: err }; }
  if (key === 'VLOW' && value >= a.high || key === 'VHIGH' && value <= a.low) return { kind: 'reject', text: 'Vertical Low 必須小於 High，原值保留。' };
  if (key === 'SWEEPCENTER' || key === 'SWEEPSPAN') { const s=m.c.extended.motion, center=key==='SWEEPCENTER'?value:(s.start+s.stop)/2, span=key==='SWEEPSPAN'?value:s.stop-s.start; if (center-Math.abs(span)/2<1e-6||center+Math.abs(span)/2>25e6) return {kind:'reject',text:'Sweep Center/Span使起迄頻率超界，原值保留。'};s.start=center-span/2;s.stop=center+span/2; }
  else if (key === 'HCENTER') a.displayStart = Math.min(ARB_SIZE - a.displayLength, Math.max(0, value - Math.floor(a.displayLength / 2)));
  else if (key === 'VCENTER') {const span=a.high-a.low;let low=value-Math.ceil(span/2),high=low+span;if(low< -511){high+=-511-low;low=-511;}if(high>511){low-=high-511;high=511;}a.low=low;a.high=high;}
  else setPath(f.instrument ? m.extended : m.c.extended, f.path, value);
  if (['RATE', 'OUTLEN'].includes(key) && m.c.wave === 'ARB') m.c.freq = a.rate / a.length;
  if (['SWEEPSTART','SWEEPSTOP','SWEEPCENTER','SWEEPSPAN'].includes(key) && !m.c.extended.motion.markerOn) m.c.extended.motion.marker=(m.c.extended.motion.start+m.c.extended.motion.stop)/2;
  if (['RATIO', 'FCOFFSET'].includes(key)) { m.extended.freqCoupled = true; m.extended.tracking = 'OFF'; }
  return null;
}
function commit(m, multiplier = 1) {
  if (!m.buf) return null;
  const key = m.hl.slice(2), raw = m.buf, value = m.parseBuf();
  if (value == null) return { kind: 'reject', text: `${raw} 不是有效數字，原值保留。` };
  return setField(m, key, value * multiplier);
}
function mutatePoints(m, start, length, values) {
  const a = m.c.extended.arb;
  if (start < 0 || length < 1 || start + length > ARB_SIZE) return { kind: 'reject', text: '區段超過4096點，波形保留原值。' };
  if (a.protectLength && start < a.protectStart + a.protectLength && start + length > a.protectStart) return { kind: 'reject', text: '選定區段包含 Protect 區域，波形保留原值。' };
  for (let k = 0; k < length; k++) a.points[start + k] = Math.max(-511, Math.min(511, Math.round(values[k])));
  return { kind: 'info', text: `CH${m.sel + 1} ARB 已寫入${length}點，實際輸出依Start/Length、Rate與Output狀態連動。` };
}
export function extensionReturn(m) {
  if (['MOD_SOURCE','MOD_SHAPE','MOTION_FREQ','MOD_FREQ','MOTION_PERCENT','MOTION_DEGREE','SWEEP_TIME','BURST_TIME','BURST_DELAY','BURST_DEGREE','BURST_COUNT'].includes(m.menu)) {m.menu=m.extended.editReturn;m.hl=null;return true;}
  if (m.menu === 'MOTION_TRIGGER') {m.menu=m.c.extended.motion.mode==='SWEEP'?'SWEEP_SOURCE':'BURST_TRIG';m.hl=null;return true;}
  if (['AM','FM','FSK','PM','SUM'].includes(m.menu)) {m.menu='MOD';m.hl=null;return true;}
  if (m.menu === 'EXT_INPUT') { m.menu = m.extended.editReturn; m.hl = null; return true; }
  if (menuReturn[m.menu]) { m.menu = menuReturn[m.menu]; m.hl = null; return true; }
  return false;
}
export function extensionPress(m, id) {
  if (['AFG.KEY.MOD','AFG.KEY.SWEEP','AFG.KEY.BURST'].includes(id)) {
    ensureExtensions(m);const s=m.c.extended.motion,key=id.split('.').at(-1);m.extended.freqCoupled=false;m.extended.amplCoupled=false;m.extended.tracking='OFF';
    if(key==='MOD'){m.openMenu('MOD',null);if(s.mode==='MOD')s.mode='CONT';}
    else{s.mode=s.mode===key?'CONT':key;m.openMenu(key,null);m.motionRuntime[m.sel]=null;}
    return {handled:true,result:{kind:'approx',text:`${key}：INT週期或Manual單次的理想波形；解析相位積分、最多64000區段，超界拒絕。External/Gate需未提供的後面板輸入。再次按模式鍵關閉。`}};
  }
  if (id === 'AFG.KEY.UTIL') { ensureExtensions(m); m.openMenu('UTIL', null); return { handled: true, result: null }; }
  if (id === 'AFG.KEY.ARB') { ensureExtensions(m); m.c.wave = 'ARB'; m.extended.tracking = 'OFF'; m.extended.freqCoupled = false; m.c.unit = 'VPP'; m.c.phase = 0; m.c.freq = carrierRate(m.c); m.openMenu('ARB', null); return { handled: true, result: { kind: 'approx', text: 'ARB 開啟：4k點 sample-and-hold 教學模型，不含真機重建濾波器；輸出仍須按 OUTPUT。Built in 是函數近似，非原廠ROM資料。' } }; }
  return { handled: false };
}
export function extensionTurn(m, dir) {
  if (m.hl?.startsWith('X_')) { m.discard(); const range = extensionCursorRange(m); m.cexp = Math.max(range[0], Math.min(range[1], m.cexp)); return { handled: true, result: setField(m, m.hl.slice(2), fieldValue(m, m.hl.slice(2)) + dir * 10 ** m.cexp) }; }
  if (['MEMORY', 'MEMORY_TYPE', 'ARB_SAVE_MEMORY', 'ARB_LOAD_MEMORY', 'ARB_WAVES'].includes(m.menu)) {
    if (m.menu === 'MEMORY_TYPE') { const types = ['ARB', 'SETTING', 'BOTH']; m.extended.memoryType = types[(types.indexOf(m.extended.memoryType) + dir + 3) % 3]; }
    else if (m.menu === 'ARB_WAVES') { const a = m.c.extended.arb, list = BUILTINS[a.builtinCategory]; a.builtinIndex = (a.builtinIndex + dir + list.length) % list.length; }
    else m.extended.memoryIndex = Math.min(9, Math.max(0, m.extended.memoryIndex + dir));
    return { handled: true, result: null };
  }
  return { handled: false };
}

export function extensionSoftkey(m, i) {
  ensureExtensions(m); const a = m.c.extended.arb, u = m.extended, open = (menu) => m.openMenu(menu, null);
  const motion=m.c.extended.motion;
  switch (m.menu) {
    case 'MOD': motion.mode='MOD';motion.type=['AM','FM','FSK','PM','SUM'][i];motion.source='INT';m.motionRuntime[m.sel]=null;return open(motion.type);
    case 'AM': case 'FM': case 'PM': case 'SUM': case 'FSK':
      if(i===0){u.editReturn=m.menu;return open('MOD_SOURCE');}
      if(i===1){const key={AM:'DEPTH',FM:'DEVIATION',PM:'PMDEV',SUM:'SUMAMPL',FSK:'HOP'}[m.menu];return edit(m,key,key==='DEVIATION'||key==='HOP'?'MOTION_FREQ':key==='PMDEV'?'MOTION_DEGREE':'MOTION_PERCENT');}
      if(i===2)return edit(m,'MODFREQ','MOD_FREQ');
      if(i===3){u.editReturn=m.menu;return open('MOD_SHAPE');}return null;
    case 'MOD_SOURCE': if(i===0){motion.source='INT';return null;}return {kind:'reject',text:'EXT調變需要後面板MOD INPUT；目前沒有虛擬輸入，原值保留。'};
    case 'MOD_SHAPE':motion.shape=['SINE','SQUARE','TRIANGLE','UPRAMP','DNRAMP'][i];return null;
    case 'MOD_FREQ':return commit(m,[.001,1,1000][i]);
    case 'MOTION_FREQ':return commit(m,[1e-6,.001,1,1000,1e6][i]);
    case 'MOTION_PERCENT':case 'MOTION_DEGREE':return commit(m);
    case 'SWEEP':if(i===0)return open('SWEEP_SOURCE');if(i===1)return open('SWEEP_TYPE');if(i===4)return open('SWEEP_MORE');return edit(m,i===2?'SWEEPSTART':'SWEEPSTOP','MOTION_FREQ');
    case 'SWEEP_MORE':if(i===3)return open('SWEEP_MARKER');return edit(m,['SWEEPTIME','SWEEPSPAN','SWEEPCENTER'][i],i===0?'SWEEP_TIME':'MOTION_FREQ');
    case 'SWEEP_TYPE':motion.sweepType=i===0?'LINEAR':'LOG';return null;
    case 'SWEEP_SOURCE':if(i===1)return {kind:'reject',text:'EXT Sweep需要後面板Trigger IN；目前未提供虛擬接線，原值保留。'};motion.source=i===0?'INT':'MANUAL';m.motionRuntime[m.sel]=null;if(i===2)return open('MOTION_TRIGGER');return null;
    case 'SWEEP_TIME':return commit(m,[.001,1][i]);
    case 'SWEEP_MARKER':if(i===0)return edit(m,'MARKER','MOTION_FREQ');motion.markerOn=!motion.markerOn;return {kind:'info',text:'Marker設定已改；後面板TTL Trigger OUT目前未提供虛擬接線，不影響主輸出波形。'};
    case 'BURST':if(i===1)return {kind:'reject',text:'Gate需要後面板Trigger INPUT的高低電位，目前未提供虛擬接線，原設定保留。'};motion.burstType='NCYCLE';return open('BURST_N');
    case 'BURST_N':if(i===0)return edit(m,'BCYCLES','BURST_COUNT');if(i===1){motion.infinite=!motion.infinite;return null;}if(i===2)return edit(m,'BPHASE','BURST_DEGREE');if(i===3)return edit(m,'BPERIOD','BURST_TIME');return open('BURST_TRIG');
    case 'BURST_COUNT':if(i===0)return edit(m,'BCYCLES','BURST_COUNT');return commit(m);
    case 'BURST_DEGREE':if(i===0){m.buf='';return null;}return commit(m);
    case 'BURST_TIME':return commit(m,[1e-6,.001,1][i]);
    case 'BURST_DELAY':return commit(m,[1e-9,1e-6,.001,1][i]);
    case 'BURST_TRIG':if(i===1)return {kind:'reject',text:'EXT Burst需要後面板Trigger IN，目前未提供虛擬接線，原值保留。'};if(i===3)return edit(m,'BDELAY','BURST_DELAY');if(i===4)return open('BURST_OUT');motion.source=i===0?'INT':'MANUAL';m.motionRuntime[m.sel]=null;if(i===2)return open('MOTION_TRIGGER');return null;
    case 'BURST_OUT':if(i<2)motion.triggerEdge=i===0?'RISE':'FALL';else motion.triggerOut=!motion.triggerOut;return {kind:'info',text:'TRIG out設定已保存；後面板TTL輸出目前沒有虛擬端子。'};
    case 'MOTION_TRIGGER':{const time=m.triggerSource?.();if(!Number.isFinite(time))return {kind:'reject',text:'Manual Trigger需要實驗台時鐘，尚未接上。'};const old=m.motionRuntime[m.sel],duration=motion.mode==='SWEEP'?motion.sweepTime:motion.infinite?Infinity:motion.delay+motion.cycles/carrierRate(m.c);if(old&&time<old.firedAt+duration)return {kind:'info',text:'本次輸出尚未完成，依官方行為忽略新的Trigger。'};m.motionRuntime[m.sel]={firedAt:time};return {kind:'info',text:`Manual Trigger：已在模擬時間${time.toFixed(6)} SEC啟動一次${motion.mode}。`};}

    case 'PULSE': if (i === 0) return edit(m, 'WIDTH', 'PULSE'); { const units = ['NSEC', 'USEC', 'MSEC', 'SEC'], mult = [1e-9, 1e-6, 1e-3, 1]; if (m.hl !== 'X_WIDTH') return null; const result = commit(m, mult[i - 1]); if (!result) m.c.extended.widthUnit = units[i - 1]; return result; }
    case 'CPL_OFFSET': return commit(m, [1e-6, 1e-3, 1, 1e3, 1e6][i]);
    case 'CPL_RATIO': return i === 4 ? commit(m) : null;
    case 'RATE': if (m.hl !== 'X_RATE') return null; return commit(m, [1e-6, 1e-3, 1, 1e3, 1e6][i]);
    case 'EXT_INPUT': if (i === 0) { m.buf = ''; return null; } if (i === 1) return commit(m); return null;
    case 'UTIL': return open(['MEMORY', 'CAL', 'SYSTEM', 'DUAL', 'COUNTER'][i]);
    case 'MEMORY': if (i === 3) return open('DELETE_ALL'); u.memoryAction = ['STORE', 'RECALL', 'DELETE'][i]; return open('MEMORY_TYPE');
    case 'MEMORY_TYPE': return i === 4 ? open('MEMORY_CONFIRM') : null;
    case 'MEMORY_CONFIRM': if (i === 4) return memoryOperation(m); return null;
    case 'DELETE_ALL': if (i === 0) { u.memories.fill(null); open('MEMORY'); return { kind: 'info', text: '10個模擬器記憶槽已刪除。' }; } return null;
    case 'CAL': return i === 1 ? open('SOFTWARE') : { kind: 'info', text: 'Calibration Menu Restricted：模擬器不執行硬體校正。' };
    case 'SOFTWARE': if (i === 0) return open('VERSION'); return { kind: 'info', text: 'Firmware Upgrade 需要真機USB與韌體，浏览器模擬器不更新校機韌體。' };
    case 'SYSTEM': return open(['LANGUAGE', 'HELP', 'BEEP'][i]);
    case 'BEEP': u.beep = i === 0; return { kind: 'approx', text: `Beep 設定${u.beep ? 'ON' : 'OFF'}；瀏覽器提示音由App音訊支援播放。` };
    case 'LANGUAGE': return { kind: 'info', text: 'LCD以官方英文顯示；中文操作說明在儀器外。' };
    case 'DUAL': if (i === 3) { m.ch.forEach((c) => { c.phase = 0; }); return { kind: 'approx', text: 'S_Phase：以共用模擬時鐘將兩通道相位歸零；Square/Pulse相位固定0°。' }; } return open(['FREQ_CPL', 'AMPL_CPL', 'TRACKING'][i]);
    case 'FREQ_CPL': if (i < 2) { u.freqMode = i === 0 ? 'RATIO' : 'OFFSET'; return edit(m, i === 0 ? 'RATIO' : 'FCOFFSET', i === 0 ? 'CPL_RATIO' : 'CPL_OFFSET'); } u.freqCoupled = false; return { kind: 'approx', text: `Frequency Coupling ${u.freqCoupled ? 'ON' : 'OFF'}：CH2=CH1${u.freqMode === 'RATIO' ? '×Ratio' : '+Offset'}（教學近似）。` };
    case 'AMPL_CPL': u.amplCoupled = i === 0; if (u.amplCoupled) u.tracking = 'OFF'; return { kind: 'approx', text: `Amplitude Coupling ${u.amplCoupled ? 'ON' : 'OFF'}：另一通道追隨目前通道的面板幅度與Offset（教學近似）。` };
    case 'TRACKING': u.tracking = ['OFF', 'ON', 'INVERT'][i]; if (u.tracking !== 'OFF') { u.freqCoupled = false; u.amplCoupled = false; } return { kind: 'approx', text: `Tracking ${u.tracking}：另一通道追隨目前通道的設定，Inverted反轉整個輸出EMF（教學近似），Output各自開關。` };
    case 'COUNTER': return i === 0 ? open('COUNTER_GATE') : null;
    case 'COUNTER_GATE': u.gate = [.01, .1, 1, 10][i]; return null;
    case 'DSO': if (i === 0) { u.dsoFound = !!m.dsoSource?.(); return { kind: 'info', text: u.dsoFound ? '已連到模擬示波器；請選CH1或CH2匯入已採集波形。' : '未提供DSO連線；需要已採集的模擬示波器波形。' }; } return importDso(m, i - 1);
    case 'ARB': return open(['ARB_DISPLAY', 'ARB_EDIT', 'ARB_BUILTIN', 'ARB_OUTPUT', 'ARB_MORE'][i]);
    case 'ARB_DISPLAY': if (i < 2) return open(i ? 'ARB_VERTICAL' : 'ARB_HORIZ'); if (i === 2) a.display = !a.display; else a.displayStart = Math.max(0, Math.min(4096 - a.displayLength, a.displayStart + (i === 3 ? -1 : 1) * a.displayLength)); return null;
    case 'ARB_HORIZ': if (i < 3) return edit(m, ['HSTART', 'HLENGTH', 'HCENTER'][i]); { const center = a.displayStart + a.displayLength / 2; a.displayLength = Math.max(3, Math.min(4096, i === 3 ? Math.floor(a.displayLength / 2) : a.displayLength * 2)); a.displayStart = Math.max(0, Math.min(4096 - a.displayLength, Math.round(center - a.displayLength / 2))); return null; }
    case 'ARB_VERTICAL': if (i < 3) return edit(m, ['VLOW', 'VHIGH', 'VCENTER'][i]); { const center = (a.high + a.low) / 2, half = Math.max(1, Math.round((a.high - a.low) / (i === 3 ? 4 : 1))); a.low = Math.max(-511, Math.floor(center - half)); a.high = Math.min(511, Math.ceil(center + half)); return null; }
    case 'ARB_EDIT': return open(['ARB_POINT', 'ARB_LINE', 'ARB_COPY', 'ARB_CLEAR', 'ARB_PROTECT'][i]);
    case 'ARB_POINT': if (i < 2) return edit(m, i ? 'DATA' : 'ADDRESS'); return mutatePoints(m, a.pointAddress, 1, [a.pointData]);
    case 'ARB_LINE': if (i < 3) return edit(m, ['LINESTART', 'LINESTOP', 'LINEDATA'][i]); if (i === 3) { a.lineMode = a.lineMode === 'RISING' ? 'FALLING' : a.lineMode === 'FALLING' ? 'LEVEL' : 'RISING'; return null; } { const length = a.lineStop - a.lineStart + 1; if (length < 1) return { kind: 'reject', text: 'Line Stop 必須不小於Start。' }; const values = Array.from({ length }, (_, k) => a.lineMode === 'LEVEL' ? a.lineData : a.lineData * (a.lineMode === 'RISING' ? k : length - 1 - k) / Math.max(1, length - 1)); return mutatePoints(m, a.lineStart, length, values); }
    case 'ARB_COPY': if (i < 3) return edit(m, ['COPYFROM', 'COPYLEN', 'COPYTO'][i]); return mutatePoints(m, a.copyTo, a.copyLength, a.points.slice(a.copyFrom, a.copyFrom + a.copyLength));
    case 'ARB_CLEAR': if (i < 2) return edit(m, i ? 'CLEARLEN' : 'CLEARSTART'); if (i === 3) return open('ARB_CLEAR_ALL'); return mutatePoints(m, a.clearStart, a.clearLength, Array(a.clearLength).fill(0));
    case 'ARB_CLEAR_ALL': if (i !== 0) return null; return mutatePoints(m, 0, ARB_SIZE, Array(ARB_SIZE).fill(0));
    case 'ARB_PROTECT': if (i === 0) return open('ARB_PROTECT_ALL'); if (i === 4) return open('ARB_UNPROTECT'); if (i === 1 || i === 2) return edit(m, i === 1 ? 'PROTECTSTART' : 'PROTECTLEN'); return { kind: 'info', text: `Protect區段${a.protectStart}–${a.protectStart + a.protectLength - 1}，後續修改會檢查。` };
    case 'ARB_PROTECT_ALL': a.protectStart = 0; a.protectLength = ARB_SIZE; return open('ARB_PROTECT');
    case 'ARB_UNPROTECT': a.protectStart = 0; a.protectLength = 0; return open('ARB_PROTECT');
    case 'ARB_BUILTIN': if (i < 3) return edit(m, ['BUILTINSTART', 'BUILTINLEN', 'BUILTINSCALE'][i]); if (i === 3) return open('ARB_CATEGORIES'); { const name = BUILTINS[a.builtinCategory][a.builtinIndex]; return mutatePoints(m, a.builtinStart, a.builtinLength, Array.from({ length: a.builtinLength }, (_, k) => a.builtinScale * builtinValue(name, k / (a.builtinLength - 1)))); }
    case 'ARB_CATEGORIES': a.builtinCategory = ['COMMON', 'MATH', 'WINDOW', 'ENGINEER'][i]; a.builtinIndex = 0; return open('ARB_WAVES');
    case 'ARB_WAVES': return i === 4 ? open('ARB_BUILTIN') : null;
    case 'ARB_OUTPUT': if (i < 2) return edit(m, i ? 'OUTLEN' : 'OUTSTART'); return null;
    case 'ARB_MORE': return open(i === 0 ? 'ARB_SAVE' : 'ARB_LOAD');
    case 'ARB_SAVE': if (i < 2) return edit(m, i ? 'SAVELEN' : 'SAVESTART'); if (i === 2) return open('ARB_SAVE_MEMORY'); return m.arbFileHandler ? m.arbFileHandler('SAVE', exportArbFile(m)) : {kind:'reject',text:'尚未接上ARB檔案匯出；不會存入實體USB。'};
    case 'ARB_LOAD': if (i === 0) return edit(m, 'LOADTO'); if (i === 2) return open('ARB_LOAD_MEMORY'); return m.arbFileHandler ? m.arbFileHandler('LOAD', null) : {kind:'reject',text:'尚未接上ARB檔案匯入；不會讀取實體USB。'};
    case 'ARB_SAVE_MEMORY': { const slot = { ...(u.memories[u.memoryIndex] ?? {}) }; slot.arb = clone(m.ch.map((c) => c.extended.arb)); slot.arb[m.sel].points = a.points.slice(a.saveStart, a.saveStart + a.saveLength); slot.arb[m.sel].start = 0; slot.arb[m.sel].length = Math.max(2, a.saveLength); while (slot.arb[m.sel].points.length < ARB_SIZE) slot.arb[m.sel].points.push(0); u.memories[u.memoryIndex] = slot; return { kind: 'info', text: `ARB已保存至Memory${u.memoryIndex}。` }; }
    case 'ARB_LOAD_MEMORY': { const stored = u.memories[u.memoryIndex]?.arb?.[m.sel]; if (!stored) return { kind: 'reject', text: '此記憶槽沒有ARB資料。' }; const length = stored.length, result = mutatePoints(m, a.loadTo, length, stored.points.slice(stored.start, stored.start + length)); return result; }
    default: return null;
  }
}

function memoryOperation(m) {
  const u = m.extended, slot = { ...(u.memories[u.memoryIndex] ?? {}) }, hasArb = u.memoryType !== 'SETTING', hasSettings = u.memoryType !== 'ARB';
  if (u.memoryAction === 'STORE') {
    if (hasArb) slot.arb = clone(m.ch.map((c) => c.extended.arb));
    if (hasSettings) slot.settings = { ch: clone(m.ch), beep: u.beep, tracking: u.tracking, amplCoupled: u.amplCoupled, freqCoupled: u.freqCoupled, freqMode: u.freqMode, ratio: u.ratio, freqOffset: u.freqOffset };
    u.memories[u.memoryIndex] = slot;
  } else if (u.memoryAction === 'RECALL') {
    if (hasArb && !slot.arb || hasSettings && !slot.settings) return { kind: 'reject', text: '記憶槽沒有選定類型的資料，設定保留原值。' };
    if (hasSettings) { const saved = clone(slot.settings); m.ch = saved.ch; m.motionRuntime.fill(null); delete saved.ch; Object.assign(u, saved); }
    if (hasArb) m.ch.forEach((c, i) => { c.extended.arb = clone(slot.arb[i]); if (c.wave === 'ARB') c.freq = carrierRate(c); });
  } else { if (hasArb) delete slot.arb; if (hasSettings) delete slot.settings; u.memories[u.memoryIndex] = Object.keys(slot).length ? slot : null; }
  m.openMenu('MEMORY', null);
  return { kind: 'info', text: `Memory${u.memoryIndex} ${u.memoryAction} ${u.memoryType} 已完成，保存的是模擬器資料。` };
}
function importDso(m, ch) {
  const source = m.dsoSource?.(), rec = source?.rec ?? source?.snapshot?.().rec;
  const values = rec?.v?.[ch];
  if (!values?.length) return { kind: 'reject', text: `DSO CH${ch + 1} 沒有可匯入的已採集波形。` };
  const min = Math.min(...values), max = Math.max(...values), amplitude = (max - min) / 2;
  if (!(amplitude > 0)) return { kind: 'reject', text: '此DSO波形是直流或沒有振幅，不能正規化至ARB。' };
  m.extended.dsoChannel = ch;
  const a = m.c.extended.arb, n = Math.min(ARB_SIZE, values.length);
  const result = mutatePoints(m, 0, n, Array.from({ length: n }, (_, k) => (values[Math.min(values.length - 1, Math.floor(k * values.length / n))] - (max + min) / 2) / amplitude * 511));
  if (result?.kind !== 'reject') { a.start = 0; a.length = Math.max(2, n); m.c.wave = 'ARB'; m.c.phase = 0; m.c.unit = 'VPP'; m.extended.tracking = 'OFF'; m.extended.freqCoupled = false; m.c.freq = carrierRate(m.c); }
  return result;
}

export function extensionRows(m) {
  ensureExtensions(m); const u = m.extended, a = m.c.extended.arb, motion=m.c.extended.motion;
  if (['MOD','AM','FM','FSK','PM','SUM','MOD_SOURCE','MOD_SHAPE','MOD_FREQ','MOTION_FREQ','MOTION_PERCENT','MOTION_DEGREE','SWEEP','SWEEP_MORE','SWEEP_TYPE','SWEEP_SOURCE','SWEEP_TIME','SWEEP_MARKER','BURST','BURST_N','BURST_COUNT','BURST_TIME','BURST_DEGREE','BURST_TRIG','BURST_DELAY','BURST_OUT','MOTION_TRIGGER'].includes(m.menu))return [['Mode',motion.mode==='MOD'?motion.type:motion.mode],['Source',motion.source],['Shape',motion.shape],...(motion.mode==='MOD'?[['Mod Freq',`${motion.frequency} Hz`],['Depth',`${motion.depth}%`],['Freq Dev',`${motion.deviation} Hz`],['Phase Dev',`${motion.phaseDeviation}°`],['Hop',`${motion.hop} Hz`],['SUM Ampl',`${motion.sum}%`]]:motion.mode==='SWEEP'?[['Type',motion.sweepType],['Start',`${motion.start} Hz`],['Stop',`${motion.stop} Hz`],['Time',`${motion.sweepTime} SEC`],['Marker',motion.markerOn?`${motion.marker} Hz`:'OFF']]:[['Cycles',motion.infinite?'Infinite':String(motion.cycles)],['Period',`${motion.period} SEC`],['Phase',`${motion.burstPhase}°`],['Delay',`${motion.delay} SEC`]]),['Trigger',m.motionRuntime?.[m.sel]?'Triggered':'Ready']];
  if (m.menu.startsWith('MEMORY') || m.menu === 'DELETE_ALL') return [['Memory', String(u.memoryIndex)], ['Operation', u.memoryAction], ['Type', u.memoryType], ...u.memories.map((slot, i) => [`Memory${i}`, slot ? [slot.arb && 'ARB', slot.settings && 'Setting'].filter(Boolean).join('+') : 'Empty'])];
  if (m.menu === 'VERSION') return [['Instrument', 'AFG-2225'], ['Version', 'Simulator'], ['FPGA Revision', '—']];
  if (m.menu === 'HELP') return [['Help', 'Use Return to go back'], ['Waveform', 'Sine/Square/Pulse/Ramp/Noise'], ['ARB', 'Display/Edit/Built in/Output'], ['UTIL', 'Memory/System/Dual Chan/Counter']];
  if (m.menu === 'BEEP' || m.menu === 'SYSTEM') return [['Beep', u.beep ? 'ON' : 'OFF']];
  if (m.menu.startsWith('COUNTER')) { const frequency = m.counterSource?.(); return [['Gate Time', `${u.gate} SEC`], ['Frequency', Number.isFinite(frequency) && frequency >= 5 && frequency <= 150e6 ? `${fmtFixed(Math.round(frequency * u.gate) / u.gate, 3)} Hz` : '—']]; }
  if (m.menu.startsWith('FREQ_CPL') || m.menu.startsWith('CPL_')) return [['Coupling', u.freqCoupled ? 'ON' : 'OFF'], ['Ratio', String(u.ratio)], ['Offset', `${u.freqOffset} Hz`]];
  if (m.menu === 'AMPL_CPL' || m.menu === 'TRACKING' || m.menu === 'DUAL') return [['Tracking', u.tracking], ['Ampl Cpl', u.amplCoupled ? 'ON' : 'OFF'], ['Freq Cpl', u.freqCoupled ? 'ON' : 'OFF']];
  if (m.menu === 'DSO') return [['DSO', u.dsoFound ? 'Connected' : '—'], ['Source', `CH${u.dsoChannel + 1}`]];
  if (m.menu === 'EXT_INPUT') return [[FIELDS[m.hl.slice(2)].label, extensionEditParts(m).text]];
  if (m.menu.startsWith('ARB')) {
    const rows = [['Rate', `${a.rate} Sa/s`], ['Start', String(a.start)], ['Length', String(a.length)], ['Protect', `${a.protectStart}/${a.protectLength}`]];
    if (m.menu === 'ARB_WAVES' || m.menu === 'ARB_BUILTIN') rows.push(['Wave', BUILTINS[a.builtinCategory][a.builtinIndex]], ['Insert', `${a.builtinStart}/${a.builtinLength}`], ['Scale', String(a.builtinScale)]);
    if (m.menu === 'ARB_POINT') rows.push(['Address', String(a.pointAddress)], ['Data', String(a.pointData)]);
    if (m.menu === 'ARB_LINE') rows.push(['Start', String(a.lineStart)], ['Stop', String(a.lineStop)], ['Data', String(a.lineData)], ['Line', a.lineMode]);
    if (m.menu === 'ARB_COPY') rows.push(['From', String(a.copyFrom)], ['Length', String(a.copyLength)], ['To', String(a.copyTo)]);
    if (m.menu === 'ARB_CLEAR') rows.push(['From', String(a.clearStart)], ['Length', String(a.clearLength)]);
    return rows;
  }
  return [];
}

// Strict, side-effect-free persistence validation. Missing whole extensions are
// migrated to defaults; partially present or unknown fields are rejected.
const plain = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function objectKeys(value, allowed, path) {
  if (!plain(value)) throw new TypeError(`${path} must be an object`);
  for (const k of Object.keys(value)) if (!allowed.includes(k)) throw new TypeError(`${path}.${k} is unsupported`);
  for (const k of allowed) if (!(k in value)) throw new TypeError(`${path}.${k} is missing`);
}
function num(v, lo, hi, path, integer = false) { if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi || integer && !Number.isInteger(v)) throw new TypeError(`${path} is out of range`); }
function bool(v, path) { if (typeof v !== 'boolean') throw new TypeError(`${path} must be boolean`); }
function member(v, values, path) { if (!values.includes(v)) throw new TypeError(`${path} is invalid`); }
function validateArb(a, path) {
  const defaults = channelExtensionDefaults().arb;
  objectKeys(a, Object.keys(defaults), path);
  if (!Array.isArray(a.points) || a.points.length !== ARB_SIZE) throw new TypeError(`${path}.points must contain 4096 points`);
  for (const [i, value] of a.points.entries()) num(value, -511, 511, `${path}.points[${i}]`, true);
  for (const [name, defaultValue] of Object.entries(defaults)) {
    if (name === 'points') continue;
    if (typeof defaultValue === 'boolean') bool(a[name], `${path}.${name}`);
    else if (typeof defaultValue === 'number') {
      const field = Object.values(FIELDS).find((f) => f.path?.length === 2 && f.path[0] === 'arb' && f.path[1] === name);
      num(a[name], field?.lo ?? (name === 'builtinIndex' ? 0 : -511), field?.hi ?? (name === 'builtinIndex' ? 20 : 511), `${path}.${name}`, name !== 'rate');
    }
  }
  member(a.lineMode, ['RISING', 'FALLING', 'LEVEL'], `${path}.lineMode`);
  member(a.builtinCategory, Object.keys(BUILTINS), `${path}.builtinCategory`);
  num(a.builtinIndex, 0, BUILTINS[a.builtinCategory].length - 1, `${path}.builtinIndex`, true);
  for (const [start, length] of [['start', 'length'], ['displayStart', 'displayLength'], ['protectStart', 'protectLength'], ['copyFrom', 'copyLength'], ['clearStart', 'clearLength'], ['builtinStart', 'builtinLength'], ['saveStart', 'saveLength']]) if (a[start] + a[length] > ARB_SIZE) throw new TypeError(`${path}.${start}+${length} exceeds 4096`);
  if (a.low >= a.high || a.rate / a.length < 1e-6 || a.rate / a.length > 60e6) throw new TypeError(`${path} has incompatible parameters`);
}
export function normalizeChannelExtension(value, channel = null, path = 'AFG.channel.extended') {
  if (value === undefined) return channelExtensionDefaults();
  objectKeys(value, Object.keys(channelExtensionDefaults()), path);
  normalizeMotion(value.motion, `${path}.motion`);
  bool(value.inverted, `${path}.inverted`);
  num(value.pulseWidth, 20e-9, 1999.9, `${path}.pulseWidth`); member(value.widthUnit, ['NSEC', 'USEC', 'MSEC', 'SEC'], `${path}.widthUnit`);
  num(value.noiseSeed, 0, 4294967295, `${path}.noiseSeed`, true); num(value.noiseRate, 1e6, 1e6, `${path}.noiseRate`);
  validateArb(value.arb, `${path}.arb`);
  if (channel?.wave === 'PULSE') { const [lo, hi] = pulseBounds(channel.freq); if (value.pulseWidth < lo - 1e-15 || value.pulseWidth > hi + 1e-15) throw new TypeError(`${path}.pulseWidth conflicts with frequency`); }
  if (channel) { const error = motionError({ ...channel, extended: value }); if (error) throw new TypeError(`${path}: ${error}`); }
  return clone(value);
}
function validateSavedChannels(ch, path) {
  if (!Array.isArray(ch) || ch.length !== 2) throw new TypeError(`${path} needs two channels`);
  ch.forEach((c, i) => {
    const p = `${path}[${i}]`; objectKeys(c, ['wave', 'freq', 'sym', 'duty', 'phase', 'emfVpp', 'emfOffset', 'load50', 'unit', 'offUnit', 'output', 'extended'], p);
    member(c.wave, ['SINE', 'SQUARE', 'RAMP', 'PULSE', 'NOISE', 'ARB'], `${p}.wave`); num(c.freq, c.wave === 'PULSE' ? 500e-6 : 1e-6, c.wave === 'RAMP' ? 1e6 : c.wave === 'ARB' ? 60e6 : 25e6, `${p}.freq`);
    num(c.sym, 0, 100, `${p}.sym`); num(c.duty, 1, 99, `${p}.duty`); num(c.phase, -180, 180, `${p}.phase`);
    num(c.emfVpp, .002 - 2e-9, 20 + 2e-9, `${p}.emfVpp`); num(c.emfOffset, -10, 10, `${p}.emfOffset`);
    bool(c.load50, `${p}.load50`); bool(c.output, `${p}.output`); member(c.unit, ['VPP', 'MVPP', 'VRMS', 'MVRMS', 'DBM'], `${p}.unit`); member(c.offUnit, ['VDC', 'MVDC'], `${p}.offUnit`);
    if (!c.load50 && c.unit === 'DBM' || ['SQUARE', 'PULSE', 'NOISE'].includes(c.wave) && c.phase !== 0) throw new TypeError(`${p} has conflicting mode`);
    const high = c.wave !== 'NOISE' && c.freq >= 20e6, pk = high ? 5 : 10;
    if (Math.abs(c.emfOffset) + c.emfVpp / 2 > pk + 2e-9) throw new TypeError(`${p} exceeds peak limit`);
    if (c.wave === 'SQUARE' && (c.freq > 1e6 && c.duty !== 50 || c.freq > 100e3 && (c.duty < 10 || c.duty > 90))) throw new TypeError(`${p}.duty conflicts with frequency`);
    normalizeChannelExtension(c.extended, c, `${p}.extended`);
  });
  const error=activeChannelsError(ch);if(error)throw new TypeError(`${path}: ${error}`);
}
export function normalizeInstrumentExtension(value, path = 'AFG.extended') {
  if (value === undefined) return instrumentExtensionDefaults();
  objectKeys(value, Object.keys(instrumentExtensionDefaults()), path);
  num(value.memoryIndex, 0, 9, `${path}.memoryIndex`, true); member(value.memoryType, ['ARB', 'SETTING', 'BOTH'], `${path}.memoryType`); member(value.memoryAction, ['STORE', 'RECALL', 'DELETE'], `${path}.memoryAction`);
  bool(value.beep, `${path}.beep`); bool(value.amplCoupled, `${path}.amplCoupled`); bool(value.freqCoupled, `${path}.freqCoupled`); bool(value.dsoFound, `${path}.dsoFound`);
  member(value.editReturn, [...Object.keys(EXT_MENUS), 'CH', 'WAVE', 'PHASE', 'DUTY'], `${path}.editReturn`); member(value.tracking, ['OFF', 'ON', 'INVERT'], `${path}.tracking`); member(value.freqMode, ['RATIO', 'OFFSET'], `${path}.freqMode`);
  num(value.ratio, 1e-6, 1e6, `${path}.ratio`); num(value.freqOffset, -25e6, 25e6, `${path}.freqOffset`); member(value.gate, [.01, .1, 1, 10], `${path}.gate`); num(value.dsoChannel, 0, 3, `${path}.dsoChannel`, true);
  if (!Array.isArray(value.memories) || value.memories.length !== 10) throw new TypeError(`${path}.memories must contain ten slots`);
  value.memories.forEach((slot, i) => {
    if (slot === null) return;
    if (!plain(slot) || !Object.keys(slot).length || Object.keys(slot).some((k) => !['arb', 'settings'].includes(k))) throw new TypeError(`${path}.memories[${i}] is invalid`);
    if (slot.arb) { if (!Array.isArray(slot.arb) || slot.arb.length !== 2) throw new TypeError('stored ARB needs two channels'); slot.arb.forEach((a, j) => validateArb(a, `${path}.memories[${i}].arb[${j}]`)); }
    if (slot.settings) {
      objectKeys(slot.settings, ['ch', 'beep', 'tracking', 'amplCoupled', 'freqCoupled', 'freqMode', 'ratio', 'freqOffset'], `${path}.memories[${i}].settings`);
      validateSavedChannels(slot.settings.ch, `${path}.memories[${i}].settings.ch`);
      bool(slot.settings.beep, 'stored beep'); bool(slot.settings.amplCoupled, 'stored amplitude coupling'); bool(slot.settings.freqCoupled, 'stored frequency coupling');
      member(slot.settings.tracking, ['OFF', 'ON', 'INVERT'], 'stored tracking'); member(slot.settings.freqMode, ['RATIO', 'OFFSET'], 'stored frequency mode');
      num(slot.settings.ratio, 1e-6, 1e6, 'stored ratio'); num(slot.settings.freqOffset, -25e6, 25e6, 'stored frequency offset');
    }
  });
  return clone(value);
}

export function relationState(m) { const u = m.extended; return { tracking: u.tracking, amplCoupled: u.amplCoupled, freqCoupled: u.freqCoupled, freqMode: u.freqMode, ratio: u.ratio, freqOffset: u.freqOffset }; }
export function applyRelations(m, before, relations) {
  const u = m.extended, changed = JSON.stringify(before) !== JSON.stringify(m.ch) || JSON.stringify(relations) !== JSON.stringify(relationState(m));
  if (!changed || u.tracking === 'OFF' && !u.amplCoupled && !u.freqCoupled) return null;
  const source = m.c, target = m.ch[1 - m.sel];
  if (u.freqCoupled && m.ch.some((c) => ['NOISE', 'ARB'].includes(c.wave))) return 'Noise／ARB 不支援 Frequency Coupling';
  if (u.tracking !== 'OFF') {
    if (source.wave === 'ARB') return 'ARB 不支援 Tracking';
    const output = target.output, load50 = target.load50, sign = u.tracking === 'INVERT';
    m.ch[1 - m.sel] = clone(source); const copy = m.ch[1 - m.sel]; copy.output = output; copy.load50 = load50;
    copy.emfVpp = m.refVpp(source) * (load50 ? 2 : 1); copy.emfOffset = m.refOffset(source) * (load50 ? 2 : 1);
    copy.extended.inverted = sign ? !source.extended.inverted : source.extended.inverted;
    // A timestamp from an earlier target mode cannot arm a newly copied Manual
    // Sweep/Burst. Mode changes use the same Ready state as its own front key.
    if(JSON.stringify(before[1-m.sel].extended.motion)!==JSON.stringify(copy.extended.motion))m.motionRuntime[1-m.sel]=null;
    if (!copy.load50 && copy.unit === 'DBM') return 'Tracking 的另一通道是 High Z，不能使用dBm';
  } else {
    if (u.freqCoupled) target.freq = m.sel === 0 ? (u.freqMode === 'RATIO' ? source.freq * u.ratio : source.freq + u.freqOffset) : (u.freqMode === 'RATIO' ? source.freq / u.ratio : source.freq - u.freqOffset);
    if (u.amplCoupled) { target.emfVpp = m.refVpp(source) * (target.load50 ? 2 : 1); target.emfOffset = m.refOffset(source) * (target.load50 ? 2 : 1); if (!target.load50 && source.unit === 'DBM') return '另一通道是High Z，幅度耦合時不能使用dBm'; }
  }
  for (const c of m.ch) { const err = m.check({ wave: c.wave, freq: c.freq, duty: c.duty, pulseWidth: c.extended.pulseWidth, vpp: m.refVpp(c), off: m.refOffset(c), load50: c.load50 }); if (err) return err; }
  return null;
}

export function exportArbFile(m) { const a=m.c.extended.arb;return {format:'ee-ss-afg-arb',version:1,rate:a.rate,points:a.points.slice(a.saveStart,a.saveStart+a.saveLength)}; }
export function importArbFile(m,value) {
 objectKeys(value,['format','version','rate','points'],'ARB file');
 if(value.format!=='ee-ss-afg-arb'||value.version!==1)throw new TypeError('Unsupported ARB file format/version');
 num(value.rate,2e-6,120e6,'ARB file.rate');if(!Array.isArray(value.points)||value.points.length<1||value.points.length>4096)throw new TypeError('ARB file points must contain 1–4096 samples');
 for(const [i,v]of value.points.entries())num(v,-511,511,`ARB file.points[${i}]`,true);
 const a=m.c.extended.arb,length=Math.max(2,value.points.length),freq=value.rate/length;if(freq<1e-6||freq>60e6)throw new TypeError('ARB file rate/length exceeds repetition range');
 if(a.loadTo+length>4096)throw new TypeError('ARB file exceeds memory at selected To address');
 const candidate={...m.c,wave:'ARB',freq,phase:0,extended:{...m.c.extended,arb:{...a,rate:value.rate,start:a.loadTo,length}}},error=m.check({wave:'ARB',freq,duty:candidate.duty,vpp:m.refVpp(candidate),off:m.refOffset(candidate),load50:candidate.load50})||motionError(candidate);if(error)return {kind:'reject',text:error};
 const result=mutatePoints(m,a.loadTo,length,[...value.points,...(value.points.length===1?[0]:[])]);if(result.kind==='reject')return result;
 a.rate=value.rate;a.start=a.loadTo;a.length=length;m.c.wave='ARB';m.c.freq=freq;m.c.phase=0;m.c.unit='VPP';m.extended.freqCoupled=false;m.extended.tracking='OFF';m.motionRuntime[m.sel]=null;return {kind:'info',text:`ARB JSON已匯入${value.points.length}點，Rate/Start/Length與真正輸出同步。`};
}
