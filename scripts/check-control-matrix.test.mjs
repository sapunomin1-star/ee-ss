#!/usr/bin/env node
// Negative tests for check-control-matrix.mjs: each deliberate corruption of the real
// matrix must be rejected with the expected message. Run: node scripts/check-control-matrix.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { checkMatrix } from './check-control-matrix.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = readFileSync(path.join(root, 'docs', 'control-matrix.md'), 'utf8');

const rowOf = (text, id) => text.split('\n').find((l) => l.startsWith(`| \`${id}\``));
const dropRow = (id) => (t) => t.split('\n').filter((l) => !l.startsWith(`| \`${id}\``)).join('\n');
const renameId = (from, to) => (t) => t.replace(`| \`${from}\``, `| \`${to}\``);
const editRow = (id, fn) => (t) => t.replace(rowOf(t, id), fn(rowOf(t, id)));

const CASES = [
  ['刪掉一顆 GPE 旋鈕', dropRow('GPE.KNOB.CH3_VOLTAGE'), /GPE\.KNOB\.\* 應正好是/],
  ['GPE 旋鈕改成 CH3 電流旋鈕', renameId('GPE.KNOB.CH3_VOLTAGE', 'GPE.KNOB.CH3_CURRENT'), /GPE\.KNOB\.\* 應正好是/],
  ['GPE 端子順序對調', (t) => {
    const a = rowOf(t, 'GPE.TERM.CH4_POS');
    const b = rowOf(t, 'GPE.TERM.CH3_NEG');
    return t.replace(a, '@@A@@').replace(b, a).replace('@@A@@', b);
  }, /表內順序應依照片/],
  ['重複 ID', renameId('TDS.KEY.MEASURE', 'TDS.KEY.AUTOSET'), /ID 與 L\d+ 重複/],
  ['刪掉 TDS CH2 選單鍵', dropRow('TDS.KEY.CH2_MENU'), /缺少必要列 TDS\.KEY\.CH2_MENU/],
  ['儀器前綴打錯', renameId('TDS.KEY.HELP', 'TDZ.KEY.HELP'), /ID 格式或儀器前綴不符/],
  ['加入 10 A 端子', renameId('DMM.TERM.I_3A', 'DMM.TERM.I_10A'), /DMM\.TERM\.\* 應正好是|不可出現 10 A/],
  ['34460A 端子標籤寫 10 A', editRow('DMM.TERM.I_3A', (r) => r.replace('I — 3A', 'I — 10 A')), /端子標籤不可出現 10 A/],
  ['非法狀態', editRow('DMM.KEY.NULL', (r) => r.replace('| CORE |', '| DONE |')), /狀態「DONE」不合法/],
  ['引用未取得的 M-DMM 當來源', editRow('DMM.KEY.NULL', (r) => r.replaceAll('D-DMM', 'M-DMM')), /M-DMM/],
  ['CORE 列只有 PD 證據', editRow('AFG.KEY.PRESET', (r) => r.replace('| PH+OT |', '| PD |')), /CORE 列至少要有 PH\/OT\/DS/],
  ['TDS 出現 CH3', renameId('TDS.TERM.EXT_TRIG', 'TDS.TERM.CH3_IN'), /TDS 不可出現 CH3|缺少必要列 TDS\.TERM\.EXT_TRIG/],
];

let failed = 0;
const baseline = checkMatrix(base);
if (baseline.errors.length) {
  console.error('baseline matrix already fails:', baseline.errors);
  process.exit(1);
}
for (const [name, mutate, expected] of CASES) {
  const mutated = mutate(base);
  if (mutated === base) { console.error(`✗ ${name}: mutation did not change the matrix`); failed++; continue; }
  const { errors } = checkMatrix(mutated);
  const hit = errors.find((e) => expected.test(e));
  if (hit) console.log(`✓ ${name} → ${hit}`);
  else { console.error(`✗ ${name}: expected ${expected}, got ${JSON.stringify(errors)}`); failed++; }
}
console.log(`${CASES.length - failed}/${CASES.length} negative cases rejected as expected`);
process.exit(failed ? 1 : 0);
