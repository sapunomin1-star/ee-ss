#!/usr/bin/env node
// I00 control-matrix structural self-check (no dependencies).
// Checks table shape, unique stable IDs, allowed codes, source-ID whitelist, and the
// photo-derived hard facts from 03 I00-1. It does NOT prove any instrument behaviour.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ID_RE = /^(AFG|TDS|GPE|DMM)\.(KEY|SOFT|NUM|KNOB|TERM|PORT|LED|LCD|PWR|MISC)\.[A-Z0-9_]+$/;
const EVIDENCE = new Set(['PH', 'OT', 'DS', 'IX', 'PD', 'UN']);
const STATUS = new Set(['CORE', 'APPROX', 'OUT', 'STATIC']);
const CARD_RE = /^(I0[1-5]|J01)(\/(I0[1-5]|J01))*$/;
export const HEADER = ['ID', '照片位置', '面板標籤', '類型／動作', '功能／影響設定', '可見回饋', '參數範圍', '來源頁', '證據', '狀態', '卡', '備註'];
// Source IDs from docs/sources.md, including the 2020 Truevolt guide obtained
// during the instrument function completion work.
const SOURCE_IDS = new Set(['P1', 'P2', 'M-AFG', 'M-TDS-13', 'M-TDS-11', 'M-GPE', 'D-DMM', 'M-DMM-2020']);
const SOURCE_TOKEN_RE = /\b(P[0-9]+|[MD]-[A-Z]+(?:-[0-9]+)?)\b/g;

// Exact sets and order taken from photos P1/P2 (see docs/control-matrix.md 照片核對).
const EXACT = {
  'GPE.KNOB.': ['CH1_VOLTAGE', 'CH1_CURRENT', 'CH4_VOLTAGE', 'CH2_VOLTAGE', 'CH2_CURRENT', 'CH3_VOLTAGE'],
  'GPE.TERM.': ['CH4_POS', 'CH4_NEG', 'CH1_POS', 'CH1_NEG', 'GND', 'CH2_POS', 'CH2_NEG', 'CH3_POS', 'CH3_NEG'],
  'DMM.TERM.': ['SENSE_HI', 'SENSE_LO', 'INPUT_HI', 'INPUT_LO', 'I_3A'],
  'AFG.SOFT.': ['F1', 'F2', 'F3', 'F4', 'F5'],
};
const ORDERED = ['GPE.TERM.']; // table order must follow the photo, left to right
const REQUIRED = [
  'AFG.TERM.CH1_OUT', 'AFG.TERM.CH2_OUT', 'AFG.KEY.CH1_CH2', 'AFG.KEY.OUTPUT',
  'TDS.TERM.CH1_IN', 'TDS.TERM.CH2_IN', 'TDS.TERM.EXT_TRIG', 'TDS.KEY.CH1_MENU', 'TDS.KEY.CH2_MENU',
  'TDS.KNOB.CH1_POSITION', 'TDS.KNOB.CH2_POSITION', 'TDS.KNOB.CH1_VOLTS_DIV', 'TDS.KNOB.CH2_VOLTS_DIV',
  'GPE.KEY.CH1_CH4', 'GPE.KEY.CH2_CH3', 'GPE.KEY.SET_VIEW', 'GPE.KEY.OUTPUT_ON_OFF',
];

const splitRow = (line) => {
  // Split on unescaped pipes; "\|" inside a cell stays literal.
  const cells = [];
  let cur = '';
  for (let i = 1; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '|') { cells.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  return cells;
};
const strip = (s) => s.replace(/`/g, '').trim();

export function checkMatrix(text) {
  const errors = [];
  const rows = [];
  let headers = 0;
  let inMatrix = false;

  text.split('\n').forEach((line, idx) => {
    if (!line.startsWith('|')) { inMatrix = false; return; }
    const cells = splitRow(line);
    const first = strip(cells[0] ?? '');
    if (first === 'ID') {
      const header = cells.map(strip);
      inMatrix = header.join('|') === HEADER.join('|');
      if (inMatrix) headers++;
      else if (header.includes('證據') && header.includes('狀態')) errors.push(`L${idx + 1}: 表頭不符，應為 ${HEADER.join(' | ')}`);
      return;
    }
    if (/^-+$/.test(first)) return;
    const looksLikeId = /^[A-Za-z]{2,}\.[A-Za-z]+\./.test(first);
    if (!inMatrix) {
      if (looksLikeId) errors.push(`L${idx + 1} ${first}: 控制 ID 列不在標準矩陣表內`);
      return;
    }
    rows.push({ line: idx + 1, cells: cells.map(strip), id: first });
  });

  const seen = new Map();
  for (const r of rows) {
    const where = `L${r.line} ${r.id}`;
    if (r.cells.length !== HEADER.length) errors.push(`${where}: 欄數 ${r.cells.length}，應為 ${HEADER.length}`);
    if (!ID_RE.test(r.id)) errors.push(`${where}: ID 格式或儀器前綴不符`);
    if (seen.has(r.id)) errors.push(`${where}: ID 與 L${seen.get(r.id)} 重複`);
    seen.set(r.id, r.line);
    const [, loc, label, , fn, , , src, ev, st, card] = r.cells;
    for (const [name, v] of [['照片位置', loc], ['面板標籤', label], ['功能', fn], ['來源頁', src]]) {
      if (!v) errors.push(`${where}: ${name} 空白`);
    }
    const evParts = (ev ?? '').split('+');
    if (!evParts.length || evParts.some((p) => !EVIDENCE.has(p))) errors.push(`${where}: 證據代碼「${ev}」不合法`);
    if (!STATUS.has(st)) errors.push(`${where}: 狀態「${st}」不合法`);
    if (!CARD_RE.test(card ?? '')) errors.push(`${where}: 卡「${card}」不合法`);
    if (st === 'CORE' && evParts.every((p) => p === 'UN' || p === 'PD' || p === 'IX')) {
      errors.push(`${where}: CORE 列至少要有 PH/OT/DS 證據`);
    }
    const tokens = [...(src ?? '').matchAll(SOURCE_TOKEN_RE)].map((m) => m[1]);
    const known = tokens.filter((t) => SOURCE_IDS.has(t));
    if (!known.length) errors.push(`${where}: 來源頁沒有已取得的來源 ID（${[...SOURCE_IDS].join('、')}）`);
    for (const t of tokens) {
      if (SOURCE_IDS.has(t)) continue;
      if (t === 'M-DMM' && /M-DMM\s*未取得/.test(src)) continue;
      errors.push(`${where}: 來源 ID「${t}」不在白名單（M-DMM 只能寫成「M-DMM 未取得」）`);
    }
    if (/^DMM\.TERM\./.test(r.id) && /10\s*A/i.test(label)) errors.push(`${where}: 34460A 端子標籤不可出現 10 A`);
  }

  const ids = rows.map((r) => r.id);
  const expect = (cond, msg) => { if (!cond) errors.push(`硬性檢查失敗：${msg}`); };
  for (const [prefix, names] of Object.entries(EXACT)) {
    const got = ids.filter((i) => i.startsWith(prefix)).map((i) => i.slice(prefix.length));
    const want = [...names].sort().join(',');
    expect([...got].sort().join(',') === want, `${prefix}* 應正好是 {${names.join(', ')}}，實得 {${got.join(', ')}}`);
    if (ORDERED.includes(prefix) && got.length === names.length) {
      expect(got.join(',') === names.join(','), `${prefix}* 表內順序應依照片由左到右：${names.join(' → ')}`);
    }
  }
  for (const id of REQUIRED) expect(ids.includes(id), `缺少必要列 ${id}`);
  expect(!ids.some((i) => /^TDS\..*CH[34]/.test(i)), 'TDS 不可出現 CH3／CH4');
  expect(!ids.some((i) => /10A/.test(i)), '不可出現 10 A 端子');
  if (!headers) errors.push('找不到控制矩陣表頭');

  const summary = {};
  for (const r of rows) {
    const inst = r.id.split('.')[0];
    const st = r.cells[9];
    summary[inst] ??= { total: 0 };
    summary[inst].total++;
    summary[inst][st] = (summary[inst][st] ?? 0) + 1;
  }
  return { errors, rows: rows.length, summary };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = process.argv[2] ?? path.join(root, 'docs', 'control-matrix.md');
  const { errors, rows, summary } = checkMatrix(readFileSync(file, 'utf8'));
  console.log(`control-matrix: ${rows} rows in ${path.relative(root, file)}`);
  for (const [inst, s] of Object.entries(summary)) {
    const parts = ['CORE', 'APPROX', 'OUT', 'STATIC'].map((k) => `${k}=${s[k] ?? 0}`).join(' ');
    console.log(`  ${inst}: ${s.total} (${parts})`);
  }
  if (errors.length) {
    console.error(`FAIL: ${errors.length} problem(s)`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('OK: structure, IDs, codes, sources and photo-derived facts pass. This is NOT an instrument behaviour test.');
}
