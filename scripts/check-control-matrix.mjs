#!/usr/bin/env node
// I00 control-matrix structural self-check (no dependencies).
// Checks table shape, unique stable IDs, allowed codes, and the photo-derived
// hard counts from 03 I00-1. It does NOT prove any instrument behaviour.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] ?? path.join(root, 'docs', 'control-matrix.md');
const text = readFileSync(file, 'utf8');

const ID_RE = /^(AFG|TDS|GPE|DMM)\.(KEY|SOFT|NUM|KNOB|TERM|PORT|LED|LCD|PWR|MISC)\.[A-Z0-9_]+$/;
const EVIDENCE = new Set(['PH', 'OT', 'DS', 'IX', 'PD', 'UN']);
const STATUS = new Set(['CORE', 'APPROX', 'OUT', 'STATIC']);
const CARD_RE = /^(I0[1-5]|J01)(\/(I0[1-5]|J01))*$/;
const HEADER = ['ID', '照片位置', '面板標籤', '類型／動作', '功能／影響設定', '可見回饋', '參數範圍', '來源頁', '證據', '狀態', '卡', '備註'];

const errors = [];
const rows = [];
let header = null;

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

text.split('\n').forEach((line, idx) => {
  if (!line.startsWith('|')) return;
  const cells = splitRow(line);
  if (strip(cells[0]) === 'ID') {
    header = cells.map(strip);
    if (header.join('|') !== HEADER.join('|')) {
      errors.push(`L${idx + 1}: 表頭不符，應為 ${HEADER.join(' | ')}`);
    }
    return;
  }
  const id = strip(cells[0] ?? '');
  if (!/^(AFG|TDS|GPE|DMM)\./.test(id)) return;
  rows.push({ line: idx + 1, cells: cells.map(strip), id });
});

const seen = new Map();
for (const r of rows) {
  const where = `L${r.line} ${r.id}`;
  if (r.cells.length !== HEADER.length) errors.push(`${where}: 欄數 ${r.cells.length}，應為 ${HEADER.length}`);
  if (!ID_RE.test(r.id)) errors.push(`${where}: ID 格式不符`);
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
  if (st === 'CORE' && evParts.every((p) => p === 'UN' || p === 'PD')) {
    errors.push(`${where}: CORE 列至少要有 PH/OT/DS 證據`);
  }
  if (!/P1|P2|M-|D-/.test(src ?? '')) errors.push(`${where}: 來源頁沒有來源 ID（P1/P2/M-*/D-*）`);
}

// Photo-derived hard facts (03 I00-1 / 02).
const ids = rows.map((r) => r.id);
const has = (id) => ids.includes(id);
const count = (re) => ids.filter((i) => re.test(i)).length;
const expect = (cond, msg) => { if (!cond) errors.push(`硬性檢查失敗：${msg}`); };

expect(count(/^GPE\.KNOB\./) === 6, `GPE 旋鈕應正好 6 顆（實得 ${count(/^GPE\.KNOB\./)}）`);
expect(!ids.some((i) => /^GPE\.KNOB\.CH[34]_CURRENT/.test(i)), 'GPE 不可有 CH3／CH4 電流旋鈕');
expect(count(/^GPE\.TERM\./) === 9, `GPE 端子應為 CH4±、CH1±、GND、CH2±、CH3± 共 9 個（實得 ${count(/^GPE\.TERM\./)}）`);
expect(['TDS.TERM.CH1_IN', 'TDS.TERM.CH2_IN', 'TDS.TERM.EXT_TRIG'].every(has), 'TDS 需有 CH1_IN、CH2_IN、EXT_TRIG');
expect(!ids.some((i) => /^TDS\..*CH[34]/.test(i)), 'TDS 不可出現 CH3／CH4');
expect(!ids.some((i) => /10A/.test(i)), '不可出現 10 A 端子');
expect(count(/^DMM\.TERM\./) === 5, `34460A 端子應為 Sense HI/LO、Input HI/LO、3A 共 5 個（實得 ${count(/^DMM\.TERM\./)}）`);
expect(['AFG.TERM.CH1_OUT', 'AFG.TERM.CH2_OUT'].every(has), 'AFG 需有 CH1_OUT 與 CH2_OUT');
expect(count(/^AFG\.SOFT\.F[1-5]$/) === 5, 'AFG 需有 F1–F5');

const summary = {};
for (const r of rows) {
  const inst = r.id.split('.')[0];
  const st = r.cells[9];
  summary[inst] ??= { total: 0 };
  summary[inst].total++;
  summary[inst][st] = (summary[inst][st] ?? 0) + 1;
}

console.log(`control-matrix: ${rows.length} rows in ${path.relative(root, file)}`);
for (const [inst, s] of Object.entries(summary)) {
  const parts = ['CORE', 'APPROX', 'OUT', 'STATIC'].map((k) => `${k}=${s[k] ?? 0}`).join(' ');
  console.log(`  ${inst}: ${s.total} (${parts})`);
}
if (!header) errors.push('找不到控制矩陣表頭');
if (errors.length) {
  console.error(`FAIL: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('OK: structure, IDs, codes and photo-derived counts pass. This is NOT an instrument behaviour test.');
