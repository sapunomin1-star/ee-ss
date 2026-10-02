// Session v1 contains committed configuration only, never sampled voltages,
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
import { VDIV, SDIV, PROBES, MEAS_TYPES, SCENARIOS } from '../instruments/tds/model.js';
import { LOADS } from '../instruments/gpe/model.js';
import { FUNCS, D1 } from '../instruments/dmm/model.js';
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

// Do not call model.snapshot(), DMM.view(), Bench.solution(), or any clock here:
// periodic autosaving must not create acquisitions or change the circuit history.
export function captureSession(models, bench, { tab = 'afg', zoom = 1 } = {}) {
  const a = models.afg, t = models.tds, g = models.gpe, d = models.dmm;
  return copy({ format: SESSION_FORMAT, version: SESSION_VERSION,
    instruments: {
      afg: { ...pick(a, AFG_FIELDS), ch: a.ch.map((c) => pick(c,
        ['wave', 'freq', 'sym', 'emfVpp', 'emfOffset', 'load50', 'unit', 'offUnit', 'output'])) },
      tds: { ...pick(t, TDS_FIELDS), scenario: t.scen,
        ch: t.ch.map((c) => pick(c, ['on', 'coupling', 'bw', 'vIdx', 'pos', 'probe'])),
        trig: pick(t.trig, ['src', 'slope', 'mode', 'coup', 'level']),
        cursor: pick(t.cursor, ['type', 'src', 'sel', 't', 'v']),
        meas: t.meas.map((q) => pick(q, ['src', 'type'])),
        autoMeas: t.autoMeas ? pick(t.autoMeas, ['src', 'types']) : null },
      gpe: pick(g, GPE_FIELDS),
      dmm: { ...pick(d, DMM_FIELDS), per: Object.fromEntries(Object.keys(FUNCS).map((fn) =>
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
  object(a, 'AFG', AFG_FIELDS); bool(a.on, 'AFG.on'); index(a.sel, 'AFG.sel', 2);
  enumeration(a.menu, 'AFG.menu', Object.keys(MENUS)); enumeration(a.hl, 'AFG.hl', [null, 'FREQ', 'AMPL', 'OFFSET', 'SYM']);
  array(a.ch, 'AFG.ch', 2);
  const afgCheck = new AfgModel();
  a.ch.forEach((c, i) => {
    const p = `AFG.CH${i + 1}`;
    object(c, p, ['wave', 'freq', 'sym', 'emfVpp', 'emfOffset', 'load50', 'unit', 'offUnit', 'output']);
    enumeration(c.wave, `${p}.wave`, ['SINE', 'SQUARE', 'RAMP']);
    number(c.freq, `${p}.freq`, 1e-6, c.wave === 'RAMP' ? 1e6 : 25e6);
    number(c.sym, `${p}.sym`, 0, 100); number(c.emfVpp, `${p}.emfVpp`, 0.002 - 2e-9, 20 + 2e-9);
    number(c.emfOffset, `${p}.emfOffset`, -10 - 2e-9, 10 + 2e-9);
    bool(c.load50, `${p}.load50`); bool(c.output, `${p}.output`);
    enumeration(c.unit, `${p}.unit`, AMPL_UNITS); enumeration(c.offUnit, `${p}.offUnit`, ['VDC', 'MVDC']);
    if (!c.load50 && c.unit === 'DBM') fail(p, 'High Z 不能使用 dBm。');
    const divisor = c.load50 ? 2 : 1;
    const why = afgCheck.check({ wave: c.wave, freq: c.freq, vpp: c.emfVpp / divisor,
      off: c.emfOffset / divisor, load50: c.load50 });
    if (why) fail(p, why);
  });
  object(t, 'TDS', [...TDS_FIELDS, 'scenario']); bool(t.on, 'TDS.on');
  enumeration(t.scenario, 'TDS.scenario', SCENARIOS.map((s) => s.id));
  enumeration(t.run, 'TDS.run', ['run', 'stop', 'single']); enumeration(t.menu, 'TDS.menu', TDS_MENUS);
  array(t.ch, 'TDS.ch', 2);
  t.ch.forEach((c, i) => {
    const p = `TDS.CH${i + 1}`;
    object(c, p, ['on', 'coupling', 'bw', 'vIdx', 'pos', 'probe']);
    bool(c.on, `${p}.on`); bool(c.bw, `${p}.bw`); enumeration(c.coupling, `${p}.coupling`, ['DC', 'AC', 'GND']);
    index(c.vIdx, `${p}.vIdx`, VDIV.length); enumeration(c.probe, `${p}.probe`, PROBES);
    const b = VDIV[c.vIdx], limit = (b <= 0.2 + 1e-12 ? 1.8 : 45) / b;
    number(c.pos, `${p}.pos`, -limit - 1e-9, limit + 1e-9);
  });
  index(t.sIdx, 'TDS.sIdx', SDIV.length);
  const s = SDIV[t.sIdx], maxPos = s <= 10e-9 ? 0.02 : s <= 100e-6 ? 0.05 : s <= 10 ? 50 : 250;
  number(t.mpos, 'TDS.mpos', -4 * s - 1e-12, maxPos + 1e-12);
  object(t.trig, 'TDS.trig', ['src', 'slope', 'mode', 'coup', 'level']); index(t.trig.src, 'TDS.trig.src', 2);
  enumeration(t.trig.slope, 'TDS.trig.slope', ['R', 'F']); enumeration(t.trig.mode, 'TDS.trig.mode', ['AUTO', 'NORMAL']);
  enumeration(t.trig.coup, 'TDS.trig.coup', ['DC', 'AC']);
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
  object(g, 'GPE', GPE_FIELDS);
  for (const k of ['on', 'keyL', 'keyR', 'output', 'lock']) bool(g[k], `GPE.${k}`);
  object(g.vset, 'GPE.vset', ['1', '2', '3', '4']); object(g.iset, 'GPE.iset', ['1', '2']);
  for (const [ch, max] of [[1, 3200], [2, 3200], [3, 500], [4, 1500]]) number(g.vset[ch], `GPE.vset.${ch}`, 0, max, true);
  for (const ch of [1, 2]) number(g.iset[ch], `GPE.iset.${ch}`, 0, 3000, true);
  array(g.rows, 'GPE.rows', 2); enumeration(g.rows[0], 'GPE.rows[0]', [1, 4]); enumeration(g.rows[1], 'GPE.rows[1]', [2, 3]);
  enumeration(g.load, 'GPE.load', Object.keys(LOADS));
  object(d, 'DMM', DMM_FIELDS); bool(d.on, 'DMM.on'); enumeration(d.fn, 'DMM.fn', Object.keys(FUNCS));
  enumeration(d.fixture, 'DMM.fixture', D1.map((f) => f.id)); object(d.per, 'DMM.per', Object.keys(FUNCS));
  for (const [fn, f] of Object.entries(FUNCS)) {
    const p = `DMM.per.${fn}`, q = d.per[fn]; object(q, p, ['auto', 'idx', 'nullOn', 'base']);
    bool(q.auto, `${p}.auto`); bool(q.nullOn, `${p}.nullOn`); index(q.idx, `${p}.idx`, f.ranges.length);
    const max = f.ranges.at(-1).limit;
    number(q.base, `${p}.base`, f.part === 'dc' ? -max : 0, max);
  }
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
  return copy(data);
}

function applySession(data, models, bench) {
  const { afg: a, tds: t, gpe: g, dmm: d } = data.instruments;
  const bb = new Breadboard();
  for (const p of data.bench.breadboard.parts) {
    const result = bb.add(p.kind, p.a, p.b, p.value);
    if (!result.ok) fail('麵包板', result.why);
    result.part.id = p.id; // stateId remains a new, never reused lifetime ID.
  }
  Object.assign(models.afg, copy(a), { buf: '', cexp: null });
  if (models.afg.hl) models.afg.cexp = models.afg.defaultCursor(models.afg.hl);
  Object.assign(models.gpe, copy(g), { bootAt: -Infinity, viewAt: null, last: null });
  Object.assign(models.dmm, copy(d), { shift: false });
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
  const scope = models.tds;
  Object.assign(scope, copy(pick(t, TDS_FIELDS)), { scen: t.scenario,
    seed: 20260930, acqN: 0, rec: null, frames: null, complete: false,
    changeSearch: null, armedAt: null, undo: null, msg: '' });
  scope.fx = t.scenario === 'BENCH' ? scope.benchFx() : SCENARIOS.find((x) => x.id === t.scenario);
  if (t.run === 'single') {
    // Rearm at the new configuration's current time; old missed edges cannot
    // complete a recalled Single acquisition.
    scope.armedAt = t.scenario === 'BENCH' ? scope.fx.now ?? bench.now() : null;
  } else if (t.run === 'stop') {
    // No waveform samples are saved. Recall Stop with one new, forced record
    // from the restored inputs, then freeze that record.
    scope.on = true; scope.run = 'run'; scope.tick(true);
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
