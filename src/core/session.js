// Session v1 contains committed configuration and explicitly saved memories,
// never live acquisition records,
// capacitor charge, absolute times, partially entered numbers, or undo history.
// Exact fields:
// {format,version,instruments:{afg:{on,sel,menu,hl,ch:[{wave,freq,sym,
// emfVpp,emfOffset,load50,unit,offUnit,output}]},tds:{on,scenario,run,menu,
// ch:[{on,coupling,bw,vIdx,pos,probe}],sIdx,mpos,trig:{src,slope,mode,coup,level},
// cursor:{type,src,sel,t,v},meas:[{src,type}],autoMeas:null|{src,types},autoKind},
// gpe:{on,vset,iset,keyL,keyR,rows,output,lock,load},dmm:{on,fn,fixture,
// per:{FUNCTION:{auto,idx,nullOn,base}}}},bench:{board,probeX,
// fixed:{topo,R,C,wires},breadboard:{parts:[{id,kind,a,b,value?}],wires}},
// ui:{tab,zoom}}. Wire maps are lead ID -> fixed node / breadboard hole.
import { createInstruments } from '../instruments/index.js';
import { AfgModel, AMPL_UNITS, MENUS } from '../instruments/afg/model.js';
import { normalizeChannelExtension, normalizeInstrumentExtension, EXT_MENUS, EXT_HIGHLIGHTS } from '../instruments/afg/extensions.js';
import { activeChannelsError } from '../instruments/afg/motion.js';
import { VDIV, SDIV, PROBES, MEAS_TYPES, SCENARIOS, extendedDefaults } from '../instruments/tds/model.js';
import { LOADS } from '../instruments/gpe/model.js';
import { FUNCS, D1, NPLCS, GATES, DMM_SETTING_FIELDS, DMM_MENUS, validateSettings } from '../instruments/dmm/model.js';
import { Bench, R_OPTIONS, C_OPTIONS } from '../bench/bench.js';
import { Breadboard, parseHole } from '../bench/breadboard.js';
import { LEADS, NODES } from '../bench/circuit.js';

export const SESSION_FORMAT = 'ee-ss-session';
export const SESSION_VERSION = 1;
// 10 rows and 4 rails, 30 holes each: physically at most 210 two-leg parts.
export const MAX_SESSION_PARTS = 210;
const INST = ['afg', 'tds', 'gpe', 'dmm'];
const LEAD_IDS = Object.keys(LEADS);
const TDS_MENUS = [null, 'CH1', 'CH2', 'PROBE1', 'PROBE2', 'TRIG', 'MEAS',
  'MEAS1', 'MEAS2', 'MEAS3', 'MEAS4', 'MEAS5', 'CURSOR', 'ACQ', 'HORIZ', 'AUTOSET'];
const copy = (x) => JSON.parse(JSON.stringify(x));
const pick = (x, fields) => Object.fromEntries(fields.map((k) => [k, x[k]]));
const wires = (x = {}) => Object.fromEntries(LEAD_IDS.filter((k) => Object.hasOwn(x, k)).map((k) => [k, x[k]]));
const AFG_FIELDS = ['on', 'sel', 'menu', 'hl', 'ch'];
const TDS_FIELDS = ['on', 'run', 'menu', 'ch', 'sIdx', 'mpos', 'trig', 'cursor', 'meas', 'autoMeas', 'autoKind'];
const GPE_FIELDS = ['on', 'vset', 'iset', 'keyL', 'keyR', 'rows', 'output', 'lock', 'load'];
const DMM_FIELDS = ['on', 'fn', 'fixture', 'per'];
const AFG_CH_FIELDS = ['wave', 'freq', 'sym', 'emfVpp', 'emfOffset', 'load50', 'unit', 'offUnit', 'output'];
const DMM_EXTRA = [...new Set([...DMM_SETTING_FIELDS, 'menu'])];
const DMM_DISPLAY_EXTRA = ['digitMask', 'barAuto', 'barLow', 'barHigh', 'barFormat', 'secondaryOn'];
const GPE_EXTRA = ['startupOutput', 'digits'];

// Do not call model.snapshot(), DMM.view(), Bench.solution(), or any clock here:
// periodic autosaving must not create acquisitions or change the circuit history.
export function captureSession(models, bench, { tab = 'afg', zoom = 1 } = {}) {
  const a = models.afg, t = models.tds, g = models.gpe, d = models.dmm;
  return copy({ format: SESSION_FORMAT, version: SESSION_VERSION,
    instruments: {
      afg: { ...pick(a, AFG_FIELDS), extended: a.extended, ch: a.ch.map((c) => ({ ...pick(c, AFG_CH_FIELDS), duty: c.duty ?? 50, phase: c.phase ?? 0, extended: normalizeChannelExtension(c.extended, c) })) },
      tds: { ...pick(t, TDS_FIELDS), scenario: t.scen,
        ch: t.ch.map((c) => pick(c, ['on', 'coupling', 'bw', 'vIdx', 'pos', 'probe'])),
        trig: pick(t.trig, ['src', 'slope', 'mode', 'coup', 'level']),
        cursor: pick(t.cursor, ['type', 'src', 'sel', 't', 'v']),
        meas: t.meas.map((q) => pick(q, ['src', 'type'])),
        autoMeas: t.autoMeas ? pick(t.autoMeas, ['src', 'types']) : null, extended: t.extended,
        savedSetups: t.savedSetups, references: t.references.map((r) => r ? { ...r, v: Array.from(r.v) } : null),
        limitMasks: (t.limitMasks ?? [null, null]).map((r) => r ? { ...r, lower: Array.from(r.lower), upper: Array.from(r.upper) } : null) },
      gpe: pick(g, [...GPE_FIELDS, ...GPE_EXTRA]),
      dmm: { ...pick(d, [...DMM_FIELDS, ...DMM_EXTRA]), savedState: d.savedState ?? null, per: Object.fromEntries(Object.keys(FUNCS).map((fn) =>
        [fn, pick(d.per[fn], ['auto', 'idx', 'nullOn', 'base'])])) },
    },
    bench: { board: bench.board ?? 'rc', probeX: [...bench.probeX],
      fixed: { topo: bench.topo, R: bench.R, C: bench.C, wires: wires(bench.wires) },
      breadboard: { parts: (bench.bb?.parts ?? []).map((p) => pick(p,
        p.kind === 'W' ? ['id', 'kind', 'a', 'b'] : ['id', 'kind', 'a', 'b', 'value'])), wires: wires(bench.bbWires) } },
    ui: { tab, zoom },
  });
}

function fail(path, message) { throw new Error(`實驗存檔 ${path}：${message}`); }

// A scope setup file uses the same strict schema as an internal Setup memory.
// Validate against fresh defaults so unrelated live settings cannot affect it.
export function validateTdsSetupFile(data) {
  jsonTree(data, 'TDS setup file');
  object(data, 'TDS setup file', ['format', 'state']);
  if (data.format !== 'ee-ss-tds-setup-v1') fail('TDS setup file', '不是支援的示波器設定檔。');
  if (data.state == null) fail('TDS setup file', '缺少示波器設定。');
  const models = createInstruments(), bench = new Bench(models.afg, models.dmm, models.gpe);
  const candidate = captureSession(models, bench);
  candidate.instruments.tds.savedSetups[0] = data.state;
  return validateSession(candidate).instruments.tds.savedSetups[0];
}

export function restoreTdsSetupFile(data, scope) {
  const setup = validateTdsSetupFile(data), previous = backup(scope);
  try {
    // restore() updates channel objects in place; detach these before applying
    // so an input callback failure can also restore the original channel data.
    scope.ch = copy(scope.ch);
    return scope.recallSetup(setup);
  }
  catch (error) { rollback(scope, previous); throw error; }
}

function object(x, path, fields, partial = false) {
  if (!x || typeof x !== 'object' || Array.isArray(x)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(x))) fail(path, '必須是 JSON 物件。');
  const keys = Reflect.ownKeys(x);
  for (const k of keys) {
    if (typeof k !== 'string' || !fields.includes(k)) fail(path, `包含不支援的欄位 ${String(k)}。`);
    if (!Object.hasOwn(Object.getOwnPropertyDescriptor(x, k), 'value')) fail(path, '不接受動態屬性。');
  }
  if (!partial) for (const k of fields) if (!Object.hasOwn(x, k)) fail(path, `缺少 ${k} 欄位。`);
}
function optionalObject(x, path, required, optional) {
  object(x, path, [...required, ...optional], true);
  for (const key of required) if (!Object.hasOwn(x, key)) fail(path, `缺少 ${key} 欄位。`);
}
function jsonTree(value, path, depth = 0, budget = { left: 250000 }) {
  if (--budget.left < 0 || depth > 16) fail(path, '資料超過可接受的大小或深度。');
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) array(value, path, value.length);
  else object(value, path, Object.keys(value));
  for (const key of Object.keys(value)) jsonTree(value[key], `${path}.${key}`, depth + 1, budget);
}

function scopeExtended(e) {
  const p = 'TDS.extended';
  optionalObject(e, p, ['invert', 'acquire', 'averages', 'display', 'math', 'store', 'refOn'], ['autoRange', 'fft', 'horizontal', 'fine', 'fineScale', 'pulse', 'cursorSource', 'limit', 'logging']);
  if (Object.hasOwn(e, 'cursorSource')) enumeration(e.cursorSource, `${p}.cursorSource`, ['CHANNEL', 'MATH', 'REFA', 'REFB']);
  for (const key of ['invert', 'refOn']) { array(e[key], `${p}.${key}`, 2); e[key].forEach((x) => bool(x, `${p}.${key}`)); }
  enumeration(e.acquire, `${p}.acquire`, ['SAMPLE', 'PEAK', 'AVERAGE']);
  enumeration(e.averages, `${p}.averages`, [4, 16, 64, 128]);
  object(e.display, `${p}.display`, ['type', 'persist', 'format']);
  enumeration(e.display.type, `${p}.display.type`, ['VECTORS', 'DOTS']);
  enumeration(e.display.persist, `${p}.display.persist`, [0, 1, 2, 5, 'INFINITE']);
  enumeration(e.display.format, `${p}.display.format`, ['YT', 'XY']);
  object(e.math, `${p}.math`, ['on', 'op', 'reverse', 'pos', 'scale']);
  bool(e.math.on, `${p}.math.on`); bool(e.math.reverse, `${p}.math.reverse`);
  enumeration(e.math.op, `${p}.math.op`, ['+', '-', '×', 'FFT']);
  number(e.math.pos, `${p}.math.pos`, -4, 4); number(e.math.scale, `${p}.math.scale`, 1e-12, 1e12);
  optionalObject(e.store, `${p}.store`, ['action', 'setup', 'source', 'ref'], ['target']);
  if (Object.hasOwn(e.store, 'target')) enumeration(e.store.target, `${p}.store.target`, ['INTERNAL', 'FILE']);
  enumeration(e.store.action, `${p}.store.action`, ['SAVE_SETUP', 'RECALL_SETUP', 'SAVE_WAVEFORM']);
  index(e.store.setup, `${p}.store.setup`, 10); index(e.store.source, `${p}.store.source`, 2); index(e.store.ref, `${p}.store.ref`, 2);
  if (Object.hasOwn(e, 'autoRange')) {
    object(e.autoRange, `${p}.autoRange`, ['on', 'axes']); bool(e.autoRange.on, `${p}.autoRange.on`);
    enumeration(e.autoRange.axes, `${p}.autoRange.axes`, ['BOTH', 'VERTICAL', 'HORIZONTAL']);
  }
  if (Object.hasOwn(e, 'fft')) {
    object(e.fft, `${p}.fft`, ['source', 'window', 'zoom', 'center', 'verticalZoom']);
    index(e.fft.source, `${p}.fft.source`, 2); enumeration(e.fft.window, `${p}.fft.window`, ['HANNING', 'FLATTOP', 'RECTANGULAR']);
    enumeration(e.fft.zoom, `${p}.fft.zoom`, [1, 2, 5, 10]); number(e.fft.center, `${p}.fft.center`, 0, 1);
    enumeration(e.fft.verticalZoom, `${p}.fft.verticalZoom`, [0.5, 1, 2, 5, 10]);
  }
  if (Object.hasOwn(e, 'horizontal')) {
    object(e.horizontal, `${p}.horizontal`, ['view', 'windowIdx', 'windowPos', 'holdoff', 'holdoffSelected']);
    enumeration(e.horizontal.view, `${p}.horizontal.view`, ['MAIN', 'ZONE', 'WINDOW']);
    index(e.horizontal.windowIdx, `${p}.horizontal.windowIdx`, SDIV.length);
    number(e.horizontal.windowPos, `${p}.horizontal.windowPos`, -500, 500);
    number(e.horizontal.holdoff, `${p}.horizontal.holdoff`, 0, 50); bool(e.horizontal.holdoffSelected, `${p}.horizontal.holdoffSelected`);
  }
  if (Object.hasOwn(e, 'fine')) { array(e.fine, `${p}.fine`, 2); e.fine.forEach((x) => bool(x, `${p}.fine`)); }
  if (Object.hasOwn(e, 'fineScale')) {
    array(e.fineScale, `${p}.fineScale`, 2);
    e.fineScale.forEach((x) => { if (x !== null) number(x, `${p}.fineScale`, VDIV[0], VDIV.at(-1)); });
  }
  if (Object.hasOwn(e, 'pulse')) {
    object(e.pulse, `${p}.pulse`, ['type', 'when', 'width', 'polarity', 'page', 'widthSelected']);
    enumeration(e.pulse.type, `${p}.pulse.type`, ['EDGE', 'PULSE']); enumeration(e.pulse.when, `${p}.pulse.when`, ['=', '!=', '<', '>']);
    number(e.pulse.width, `${p}.pulse.width`, 33e-9, 10); enumeration(e.pulse.polarity, `${p}.pulse.polarity`, ['POSITIVE', 'NEGATIVE']);
    index(e.pulse.page, `${p}.pulse.page`, 2); bool(e.pulse.widthSelected, `${p}.pulse.widthSelected`);
  }
  if (Object.hasOwn(e, 'limit')) {
    const q = e.limit, path = `${p}.limit`;
    object(q, path, ['on', 'source', 'compare', 'templateSource', 'destination', 'vTolerance', 'hTolerance', 'show', 'action', 'stop', 'count', 'seconds', 'page', 'target']);
    bool(q.on, `${path}.on`); bool(q.show, `${path}.show`);
    for (const key of ['source', 'templateSource']) index(q[key], `${path}.${key}`, 3);
    for (const key of ['compare', 'destination', 'page']) index(q[key], `${path}.${key}`, 2);
    for (const key of ['vTolerance', 'hTolerance']) number(q[key], `${path}.${key}`, 0, 5);
    enumeration(q.action, `${path}.action`, ['NONE', 'SAVE_WAVEFORM', 'SAVE_IMAGE']);
    enumeration(q.stop, `${path}.stop`, ['MANUAL', 'WAVEFORMS', 'VIOLATIONS', 'TIME']);
    enumeration(q.target, `${path}.target`, ['V', 'H', 'COUNT', 'TIME']);
    number(q.count, `${path}.count`, 1, 1e6, true); number(q.seconds, `${path}.seconds`, 1, 86400);
  }
  if (Object.hasOwn(e, 'logging')) {
    const q = e.logging, path = `${p}.logging`; object(q, path, ['on', 'source', 'duration']);
    bool(q.on, `${path}.on`); index(q.source, `${path}.source`, 3);
    const durations = [...Array.from({ length: 16 }, (_, i) => (i + 1) * 1800), ...Array.from({ length: 16 }, (_, i) => 32400 + i * 3600), 'INFINITE'];
    enumeration(q.duration, `${path}.duration`, durations);
  }
}
function dmmPer(per, path, legacy = false) {
  const basic = ['DCV', 'ACV', 'DCI', 'ACI', 'OHM', 'CONT'];
  optionalObject(per, path, legacy ? basic : Object.keys(FUNCS), legacy ? Object.keys(FUNCS).filter((fn) => !basic.includes(fn)) : []);
  for (const [fn, f] of Object.entries(FUNCS)) {
    if (!Object.hasOwn(per, fn)) continue;
    const p = `${path}.${fn}`, q = per[fn]; object(q, p, ['auto', 'idx', 'nullOn', 'base']);
    bool(q.auto, `${p}.auto`); bool(q.nullOn, `${p}.nullOn`); index(q.idx, `${p}.idx`, f.ranges.length);
    const max = f.kind === 'F' ? fn === 'PER' ? 1 / 3 : 300e3 : f.kind === 'T' ? 1112 : f.ranges.at(-1).limit;
    number(q.base, `${p}.base`, f.kind === 'T' ? -328 : f.part === 'dc' ? -max : 0, max);
  }
}
function scopeMemories(t, data) {
  if (Object.hasOwn(t, 'savedSetups')) {
    array(t.savedSetups, 'TDS.savedSetups', 10);
    t.savedSetups.forEach((s, i) => {
      if (s === null) return;
      object(s, `TDS.savedSetups[${i}]`, ['ch', 'sIdx', 'mpos', 'trig', 'cursor', 'meas', 'menu', 'extended', 'run']);
      // Reuse the live panel's validation without allowing nested memories.
      const candidate = copy(data);
      candidate.instruments.tds = { ...pick(t, [...TDS_FIELDS, 'scenario']), ...s };
      try { validateSession(candidate); } catch (error) { fail(`TDS.savedSetups[${i}]`, error.message); }
    });
  }
  if (Object.hasOwn(t, 'references')) {
    array(t.references, 'TDS.references', 2);
    t.references.forEach((r, i) => {
      if (r === null) return;
      const p = `TDS.references[${i}]`;
      object(r, p, ['v', 't0', 'dt', 'base', 'probe', 'pos', 'sdiv', 'mpos']);
      array(r.v, `${p}.v`, 2500); r.v.forEach((v) => number(v, `${p}.v`, -1000, 1000));
      number(r.t0, `${p}.t0`, -1e12, 1e12); number(r.dt, `${p}.dt`, 1e-12, 1);
      number(r.base, `${p}.base`, VDIV[0], VDIV.at(-1)); enumeration(r.probe, `${p}.probe`, PROBES);
      number(r.pos, `${p}.pos`, -900, 900); enumeration(r.sdiv, `${p}.sdiv`, SDIV);
      number(r.mpos, `${p}.mpos`, -500, 500);
    });
  }
  if (Object.hasOwn(t, 'limitMasks')) {
    array(t.limitMasks, 'TDS.limitMasks', 2);
    t.limitMasks.forEach((r, i) => {
      if (r === null) return;
      const p = `TDS.limitMasks[${i}]`;
      object(r, p, ['lower', 'upper', 't0', 'dt', 'sdiv', 'mpos', 'scale', 'unit']);
      array(r.lower, `${p}.lower`, 2500); array(r.upper, `${p}.upper`, 2500);
      r.lower.forEach((v, k) => { number(v, `${p}.lower`, -1e15, 1e15); number(r.upper[k], `${p}.upper`, v, 1e15); });
      number(r.t0, `${p}.t0`, -1e12, 1e12); number(r.dt, `${p}.dt`, 1e-12, 1);
      enumeration(r.sdiv, `${p}.sdiv`, SDIV); number(r.mpos, `${p}.mpos`, -500, 500);
      number(r.scale, `${p}.scale`, 1e-12, 1e12); enumeration(r.unit, `${p}.unit`, ['V', 'VV']);
    });
  }
}
function array(x, path, n, min = n) {
  if (!Array.isArray(x) || x.length < min || x.length > n) fail(path, `必須是 ${min === n ? n : `${min}–${n}`} 項的陣列。`);
  const keys = Reflect.ownKeys(x);
  if (keys.some((k) => k !== 'length' && (typeof k !== 'string' || !/^(0|[1-9]\d*)$/.test(k)))
      || keys.length !== x.length + 1) fail(path, '陣列不能有空位或額外欄位。');
  for (let i = 0; i < x.length; i++) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(x, String(i)), 'value')) fail(path, '不接受動態屬性。');
}
function number(x, path, min, max, integer = false) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max || (integer && !Number.isInteger(x)))
    fail(path, `必須是 ${min}–${max} 的有限${integer ? '整' : '數'}值。`);
}
function enumeration(x, path, values) { if (!values.includes(x)) fail(path, `不支援 ${String(x)}。`); }
function bool(x, path) { if (typeof x !== 'boolean') fail(path, '必須是 true 或 false。'); }
function index(x, path, n) { number(x, path, 0, n - 1, true); }
function wireMap(x, path, holes, occupied = new Set()) {
  object(x, path, LEAD_IDS, true);
  for (const [id, h] of Object.entries(x)) {
    if (holes) {
      if (typeof h !== 'string' || !parseHole(h)) fail(`${path}.${id}`, '麵包板孔位不存在。');
      if (occupied.has(h)) fail(`${path}.${id}`, `孔 ${h} 已被其他元件或導線佔用。`);
      occupied.add(h);
    } else enumeration(h, `${path}.${id}`, NODES);
  }
}

// Pure whitelist validation. A malformed file cannot reset or partially replace
// the live models. Returns a detached JSON object suitable for later application.
export function validateSession(data) {
  object(data, '根目錄', ['format', 'version', 'instruments', 'bench', 'ui']);
  enumeration(data.format, 'format', [SESSION_FORMAT]);
  if (data.version !== SESSION_VERSION) fail('version', `不支援版本 ${String(data.version)}（目前為 ${SESSION_VERSION}）。`);
  object(data.instruments, 'instruments', INST);
  const { afg: a, tds: t, gpe: g, dmm: d } = data.instruments;
  optionalObject(a, 'AFG', AFG_FIELDS, ['extended']); bool(a.on, 'AFG.on'); index(a.sel, 'AFG.sel', 2);
  if (Object.hasOwn(a, 'extended')) {
    jsonTree(a.extended, 'AFG.extended');
    try { normalizeInstrumentExtension(a.extended); } catch (e) { fail('AFG.extended', e.message); }
  }
  enumeration(a.menu, 'AFG.menu', [...Object.keys(MENUS), ...Object.keys(EXT_MENUS)]); enumeration(a.hl, 'AFG.hl', [null, 'FREQ', 'AMPL', 'OFFSET', 'SYM', 'DUTY', 'PHASE', ...EXT_HIGHLIGHTS]);
  array(a.ch, 'AFG.ch', 2);
  const afgCheck = new AfgModel();
  a.ch.forEach((c, i) => {
    const p = `AFG.CH${i + 1}`;
    optionalObject(c, p, AFG_CH_FIELDS, ['duty', 'phase', 'extended']);
    enumeration(c.wave, `${p}.wave`, ['SINE', 'SQUARE', 'RAMP', 'PULSE', 'NOISE', 'ARB']);
    number(c.freq, `${p}.freq`, c.wave === 'PULSE' ? 500e-6 : 1e-6, c.wave === 'RAMP' ? 1e6 : c.wave === 'ARB' ? 60e6 : 25e6);
    if (Object.hasOwn(c, 'extended')) jsonTree(c.extended, `${p}.extended`);
    let ext;
    try { ext = normalizeChannelExtension(c.extended, c, `${p}.extended`); } catch (e) { fail(p, e.message); }
    number(c.sym, `${p}.sym`, 0, 100); number(c.emfVpp, `${p}.emfVpp`, 0.002 - 2e-9, 20 + 2e-9);
    number(c.emfOffset, `${p}.emfOffset`, -10 - 2e-9, 10 + 2e-9);
    bool(c.load50, `${p}.load50`); bool(c.output, `${p}.output`);
    if (Object.hasOwn(c, 'duty')) {
      const [min, max] = c.freq > 1e6 ? [50, 50] : c.freq > 1e5 ? [10, 90] : [1, 99];
      number(c.duty, `${p}.duty`, c.wave === 'SQUARE' ? min : 1, c.wave === 'SQUARE' ? max : 99);
    }
    if (Object.hasOwn(c, 'phase')) number(c.phase, `${p}.phase`, ['SQUARE', 'PULSE', 'NOISE'].includes(c.wave) ? 0 : -180, ['SQUARE', 'PULSE', 'NOISE'].includes(c.wave) ? 0 : 180);
    enumeration(c.unit, `${p}.unit`, AMPL_UNITS); enumeration(c.offUnit, `${p}.offUnit`, ['VDC', 'MVDC']);
    if (!c.load50 && c.unit === 'DBM') fail(p, 'High Z 不能使用 dBm。');
    const divisor = c.load50 ? 2 : 1;
    const why = afgCheck.check({ wave: c.wave, freq: c.freq, vpp: c.emfVpp / divisor,
      off: c.emfOffset / divisor, load50: c.load50, duty: c.duty ?? 50, phase: c.phase ?? 0, pulseWidth: ext.pulseWidth });
    if (why) fail(p, why);
  });
  optionalObject(t, 'TDS', [...TDS_FIELDS, 'scenario'], ['extended', 'savedSetups', 'references', 'limitMasks']); bool(t.on, 'TDS.on');
  if (Object.hasOwn(t, 'extended')) scopeExtended(t.extended);
  enumeration(t.scenario, 'TDS.scenario', SCENARIOS.map((s) => s.id));
  enumeration(t.run, 'TDS.run', ['run', 'stop', 'single']); enumeration(t.menu, 'TDS.menu', [...TDS_MENUS, 'MATH', 'DISPLAY', 'SAVE', 'STORE', 'REF', 'AUTORANGE',
    'UTILITY', 'UTILITY_OPTIONS', 'STATUS', 'STATUS_HORIZONTAL', 'STATUS_VERTICAL', 'STATUS_TRIGGER', 'STATUS_MISC', 'HELP',
    'LIMIT', 'LIMIT_TEMPLATE', 'LIMIT_ACTION', 'LIMIT_STOP', 'LOGGING']);
  array(t.ch, 'TDS.ch', 2);
  t.ch.forEach((c, i) => {
    const p = `TDS.CH${i + 1}`;
    object(c, p, ['on', 'coupling', 'bw', 'vIdx', 'pos', 'probe']);
    bool(c.on, `${p}.on`); bool(c.bw, `${p}.bw`); enumeration(c.coupling, `${p}.coupling`, ['DC', 'AC', 'GND']);
    index(c.vIdx, `${p}.vIdx`, VDIV.length); enumeration(c.probe, `${p}.probe`, PROBES);
    const b = t.extended?.fineScale?.[i] ?? VDIV[c.vIdx], limit = (b <= 0.2 + 1e-12 ? 1.8 : 45) / b;
    number(c.pos, `${p}.pos`, -limit - 1e-9, limit + 1e-9);
  });
  index(t.sIdx, 'TDS.sIdx', SDIV.length);
  const s = SDIV[t.sIdx], maxPos = s <= 10e-9 ? 0.02 : s <= 100e-6 ? 0.05 : s <= 10 ? 50 : 250;
  number(t.mpos, 'TDS.mpos', -4 * s - 1e-12, maxPos + 1e-12);
  object(t.trig, 'TDS.trig', ['src', 'slope', 'mode', 'coup', 'level']); index(t.trig.src, 'TDS.trig.src', 2);
  enumeration(t.trig.slope, 'TDS.trig.slope', ['R', 'F']); enumeration(t.trig.mode, 'TDS.trig.mode', ['AUTO', 'NORMAL']);
  enumeration(t.trig.coup, 'TDS.trig.coup', ['DC', 'AC', 'NOISE', 'HF', 'LF']);
  // Changing vertical scale does not re-clamp an existing trigger level. This is
  // the envelope reachable by the panel, rather than today's scale's knob range.
  number(t.trig.level, 'TDS.trig.level', -85 - 1e-9, 85 + 1e-9);
  object(t.cursor, 'TDS.cursor', ['type', 'src', 'sel', 't', 'v']);
  enumeration(t.cursor.type, 'TDS.cursor.type', ['OFF', 'TIME', 'AMPL']); index(t.cursor.src, 'TDS.cursor.src', 2);
  enumeration(t.cursor.sel, 'TDS.cursor.sel', [null, 0, 1]);
  for (const [key, bound] of [['t', 125], ['v', 100]]) {
    array(t.cursor[key], `TDS.cursor.${key}`, 2);
    t.cursor[key].forEach((x) => number(x, `TDS.cursor.${key}`, -bound, bound, true));
  }
  array(t.meas, 'TDS.meas', 5);
  t.meas.forEach((q) => { object(q, 'TDS.meas', ['src', 'type']); index(q.src, 'TDS.meas.src', 2); enumeration(q.type, 'TDS.meas.type', MEAS_TYPES); });
  enumeration(t.autoKind, 'TDS.autoKind', [null, 'SINE', 'SQUARE', 'UNKNOWN']);
  if (t.autoMeas !== null) {
    object(t.autoMeas, 'TDS.autoMeas', ['src', 'types']); index(t.autoMeas.src, 'TDS.autoMeas.src', 2);
    array(t.autoMeas.types, 'TDS.autoMeas.types', 4, 1);
    t.autoMeas.types.forEach((v) => enumeration(v, 'TDS.autoMeas.types', MEAS_TYPES));
  }
  optionalObject(g, 'GPE', GPE_FIELDS, GPE_EXTRA);
  if (Object.hasOwn(g, 'startupOutput')) bool(g.startupOutput, 'GPE.startupOutput');
  if (Object.hasOwn(g, 'digits')) enumeration(g.digits, 'GPE.digits', [3, 4]);
  for (const k of ['on', 'keyL', 'keyR', 'output', 'lock']) bool(g[k], `GPE.${k}`);
  object(g.vset, 'GPE.vset', ['1', '2', '3', '4']); object(g.iset, 'GPE.iset', ['1', '2']);
  for (const [ch, max] of [[1, 3200], [2, 3200], [3, 500], [4, 1500]]) number(g.vset[ch], `GPE.vset.${ch}`, 0, max, true);
  for (const ch of [1, 2]) number(g.iset[ch], `GPE.iset.${ch}`, 0, 3000, true);
  array(g.rows, 'GPE.rows', 2); enumeration(g.rows[0], 'GPE.rows[0]', [1, 4]); enumeration(g.rows[1], 'GPE.rows[1]', [2, 3]);
  enumeration(g.load, 'GPE.load', Object.keys(LOADS));
  optionalObject(d, 'DMM', DMM_FIELDS, [...DMM_EXTRA, 'savedState']); bool(d.on, 'DMM.on'); enumeration(d.fn, 'DMM.fn', Object.keys(FUNCS));
  const settingsError = validateSettings({ ...pick(d, DMM_SETTING_FIELDS.filter((k) => Object.hasOwn(d, k))), per: d.per });
  if (settingsError) fail('DMM', settingsError);
  if (Object.hasOwn(d, 'savedState') && d.savedState !== null) {
    jsonTree(d.savedState, 'DMM.savedState');
    optionalObject(d.savedState, 'DMM.savedState', ['fn', 'per', ...DMM_SETTING_FIELDS.filter((k) => !DMM_DISPLAY_EXTRA.includes(k))], DMM_DISPLAY_EXTRA);
    const why = validateSettings(d.savedState); if (why) fail('DMM.savedState', why);
    dmmPer(d.savedState.per, 'DMM.savedState.per');
  }
  if (Object.hasOwn(d, 'nplc')) enumeration(d.nplc, 'DMM.nplc', NPLCS);
  if (Object.hasOwn(d, 'gate')) enumeration(d.gate, 'DMM.gate', GATES);
  if (Object.hasOwn(d, 'inputZMode')) enumeration(d.inputZMode, 'DMM.inputZMode', ['10M', 'AUTO']);
  if (Object.hasOwn(d, 'run')) enumeration(d.run, 'DMM.run', ['run', 'stop', 'single']);
  if (Object.hasOwn(d, 'menu')) enumeration(d.menu, 'DMM.menu', [null, ...DMM_MENUS]);
  if (Object.hasOwn(d, 'acFilter')) enumeration(d.acFilter, 'DMM.acFilter', [3, 20, 200]);
  if (Object.hasOwn(d, 'triggerMode')) enumeration(d.triggerMode, 'DMM.triggerMode', ['AUTO', 'SINGLE']);
  if (Object.hasOwn(d, 'displayMode')) enumeration(d.displayMode, 'DMM.displayMode', ['NUMBER', 'BAR', 'HIST']);
  enumeration(d.fixture, 'DMM.fixture', D1.map((f) => f.id));
  dmmPer(d.per, 'DMM.per', true);
  const b = data.bench;
  object(b, 'bench', ['board', 'probeX', 'fixed', 'breadboard']); enumeration(b.board, 'bench.board', ['rc', 'bb']);
  array(b.probeX, 'bench.probeX', 2); b.probeX.forEach((x) => enumeration(x, 'bench.probeX', [1, 10]));
  object(b.fixed, 'bench.fixed', ['topo', 'R', 'C', 'wires']); enumeration(b.fixed.topo, 'bench.fixed.topo', ['RC', 'CR']);
  enumeration(b.fixed.R, 'bench.fixed.R', R_OPTIONS); enumeration(b.fixed.C, 'bench.fixed.C', C_OPTIONS);
  wireMap(b.fixed.wires, 'bench.fixed.wires', false);
  object(b.breadboard, 'bench.breadboard', ['parts', 'wires']); array(b.breadboard.parts, 'bench.breadboard.parts', MAX_SESSION_PARTS, 0);
  const occupied = new Set(), partIds = new Set();
  b.breadboard.parts.forEach((p, i) => {
    const path = `bench.breadboard.parts[${i}]`;
    if (!p || !['R', 'C', 'W'].includes(p.kind)) fail(path, '只支援電阻 R、電容 C 和跳線 W。');
    object(p, path, p.kind === 'W' ? ['id', 'kind', 'a', 'b'] : ['id', 'kind', 'a', 'b', 'value']);
    if (typeof p.id !== 'string' || !new RegExp(`^${p.kind}[1-9]\\d{0,5}$`).test(p.id) || partIds.has(p.id)) fail(path, '元件 ID 必須符合種類且不能重複。');
    partIds.add(p.id);
    for (const h of [p.a, p.b]) {
      if (typeof h !== 'string' || !parseHole(h)) fail(path, '麵包板孔位不存在。');
      if (occupied.has(h)) fail(path, `孔 ${h} 已被其他元件腳佔用。`);
      occupied.add(h);
    }
    if (p.kind !== 'W') {
      // Values available in the current component UI. A later component/range
      // expansion must intentionally extend the validator (or session version).
      enumeration(p.value, `${path}.value`, p.kind === 'R' ? R_OPTIONS : C_OPTIONS);
    }
  });
  wireMap(b.breadboard.wires, 'bench.breadboard.wires', true, occupied);
  object(data.ui, 'ui', ['tab', 'zoom']); enumeration(data.ui.tab, 'ui.tab', [...INST, 'bench']); number(data.ui.zoom, 'ui.zoom', 1, 2.5);
  scopeMemories(t, data);
  const result = copy(data), defaults = createInstruments();
  result.instruments.afg.ch.forEach((c) => { c.duty ??= 50; c.phase ??= 0; c.extended = normalizeChannelExtension(c.extended, c); });
  result.instruments.afg.extended = normalizeInstrumentExtension(result.instruments.afg.extended);
  const activeError = activeChannelsError(result.instruments.afg.ch);
  if (activeError) fail('AFG', activeError);
  result.instruments.tds.extended ??= extendedDefaults();
  for (const key of Object.keys(extendedDefaults())) result.instruments.tds.extended[key] ??= extendedDefaults()[key];
  const normalWindow = (s) => {
    s.extended = { ...extendedDefaults(), ...s.extended };
    const h = s.extended.horizontal;
    h.windowIdx = Math.min(h.windowIdx, s.sIdx);
    const margin = 5 * (SDIV[s.sIdx] - SDIV[h.windowIdx]);
    h.windowPos = Math.max(s.mpos - margin, Math.min(s.mpos + margin, h.windowPos));
  };
  normalWindow(result.instruments.tds);
  result.instruments.tds.extended.store.target ??= 'INTERNAL';
  result.instruments.tds.savedSetups ??= Array(10).fill(null); result.instruments.tds.references ??= [null, null];
  result.instruments.tds.limitMasks ??= [null, null];
  result.instruments.tds.savedSetups.forEach((s) => { if (s) normalWindow(s); });
  for (const key of DMM_EXTRA) result.instruments.dmm[key] ??= defaults.dmm[key];
  result.instruments.dmm.savedState ??= null;
  if (result.instruments.dmm.savedState) {
    const saved = result.instruments.dmm.savedState;
    for (const key of DMM_DISPLAY_EXTRA) if (DMM_SETTING_FIELDS.includes(key)) saved[key] ??= defaults.dmm[key];
    const why = validateSettings(saved); if (why) fail('DMM.savedState', why);
  }
  const normalizedError = validateSettings({ ...pick(result.instruments.dmm, DMM_SETTING_FIELDS), per: result.instruments.dmm.per });
  if (normalizedError) fail('DMM', normalizedError);
  for (const fn of Object.keys(FUNCS)) result.instruments.dmm.per[fn] ??= pick(defaults.dmm.per[fn], ['auto', 'idx', 'nullOn', 'base']);
  for (const key of GPE_EXTRA) result.instruments.gpe[key] ??= defaults.gpe[key];
  return result;
}

function applySession(data, models, bench) {
  const { afg: a, tds: t, gpe: g, dmm: d } = data.instruments;
  const bb = new Breadboard();
  for (const p of data.bench.breadboard.parts) {
    const result = bb.add(p.kind, p.a, p.b, p.value);
    if (!result.ok) fail('麵包板', result.why);
    result.part.id = p.id; // stateId remains a new, never reused lifetime ID.
  }
  Object.assign(models.afg, copy(a), { buf: '', cexp: null, motionRuntime: [null, null] });
  if (models.afg.hl) models.afg.cexp = models.afg.hl.startsWith('X_') ? 0 : models.afg.defaultCursor(models.afg.hl);
  Object.assign(models.gpe, copy(g), { bootAt: -Infinity, viewAt: null, last: null, setup: null });
  Object.assign(models.dmm, copy(d), { shift: false, held: null, pending: null, sampleStart: null, sampleEnd: null,
    edit: null, readings: [], lastSampleKey: null, limitFailures: { low: 0, high: 0 }, probeHold: false, probeRestore: null,
    probeEntries: [], probeWindow: [], probeLast: null });
  if (['PROBE', 'EDIT'].includes(models.dmm.menu)) models.dmm.menu = null;
  bench.reset();
  Object.assign(bench, { afg: models.afg, dmm: models.dmm, gpe: models.gpe,
    board: data.bench.board, topo: data.bench.fixed.topo, R: data.bench.fixed.R, C: data.bench.fixed.C,
    wires: copy(data.bench.fixed.wires), bb, bbWires: copy(data.bench.breadboard.wires), probeX: [...data.bench.probeX] });
  // reset() intentionally preserves the selected board and external sources.
  // The session replaces both boards and starts their history afresh.
  delete bench.changeT;
  models.tds.benchSource ??= () => bench.tdsInput();
  models.dmm.benchSource ??= () => bench.dmmInput();
  models.gpe.benchSource ??= () => bench.gpeInput();
  bench.solution();
  models.dmm.resetSecondary?.();
  if (d.run === 'single') models.dmm.single();
  else if (d.run === 'stop') models.dmm.held = { ...models.dmm.liveReading(), idx: models.dmm.rangeIdx() };
  const scope = models.tds;
  Object.assign(scope, copy(pick(t, [...TDS_FIELDS, 'extended'])), { scen: t.scenario,
    seed: 20260930, acqN: 0, rec: null, frames: null, complete: false,
    changeSearch: null, armedAt: null, undo: null, autoRangeUndo: null, msg: '',
    references: t.references.map((r) => r ? { ...copy(r), v: Float64Array.from(r.v) } : null), savedSetups: copy(t.savedSetups),
    limitMasks: t.limitMasks.map((r) => r ? { ...copy(r), lower: Float64Array.from(r.lower), upper: Float64Array.from(r.upper) } : null),
    persistence: [], persistPixels: null, avgState: null, lastTriggerAt: null, trigView: false, fftCache: null,
    limitStats: { tested: 0, passed: 0, failed: 0, result: null }, limitStarted: null, limitViolation: null,
    loggingRows: [], loggingStarted: null, loggingDropped: 0 });
  scope.resetTemporalAcquisition();
  if (scope.extended.limit) scope.extended.limit.on = false;
  if (scope.extended.logging) scope.extended.logging.on = false;
  scope.fx = t.scenario === 'BENCH' ? scope.benchFx() : SCENARIOS.find((x) => x.id === t.scenario);
  if (t.run === 'single') {
    // Rearm at the new configuration's current time; old missed edges cannot
    // complete a recalled Single acquisition.
    scope.armedAt = t.scenario === 'BENCH' ? scope.fx.now ?? bench.now() : null;
  } else if (t.run === 'stop') {
    // No waveform samples are saved. Recall Stop with one new, forced record
    // from the restored inputs, then freeze that record.
    scope.on = true; scope.run = 'run'; scope.publish(scope.acquireHistory());
    scope.run = 'stop'; scope.on = t.on; scope.frames = null;
  } else scope.tick();
}

function backup(x) { return Object.getOwnPropertyDescriptors(x); }
function rollback(x, state) {
  for (const k of Reflect.ownKeys(x)) if (!Object.hasOwn(state, k)) delete x[k];
  Object.defineProperties(x, state);
}

export function restoreSession(data, models, bench) {
  const valid = validateSession(data);
  // Exercise the solver and the fresh acquisition against entirely independent
  // models before touching any live configuration or capacitor history.
  const trial = createInstruments(), trialBench = new Bench(trial.afg, trial.dmm, trial.gpe);
  trialBench.now = bench.now;
  trial.dmm.now = () => trialBench.now();
  try { applySession(valid, trial, trialBench); }
  catch (error) { throw new Error(`實驗存檔無法建立有效的電路與採集，原實驗已保留：${error.message}`); }
  const targets = [...INST.map((id) => models[id]), bench];
  const old = targets.map(backup);
  try { applySession(valid, models, bench); }
  catch (error) {
    targets.forEach((x, i) => rollback(x, old[i]));
    throw new Error(`實驗存檔載入失敗，原實驗已保留：${error.message}`);
  }
  return { ...valid.ui };
}
