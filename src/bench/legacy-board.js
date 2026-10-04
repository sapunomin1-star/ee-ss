// App-only compatibility: the active experiment is now always a breadboard.
// The core session API can still restore a fixed board for old integrations.
import { validateSession } from '../core/session.js';
import { LEADS } from './circuit.js';

const occupied = (board) => board.parts.length > 0 || Object.keys(board.wires).length > 0;
const railHoles = (rail, start = 1) => Array.from({ length: 31 - start }, (_, i) => `${rail}${start + i}`);

function fixedBreadboard(fixed) {
  const first = fixed.topo === 'RC' ? 'R' : 'C', second = first === 'R' ? 'C' : 'R';
  const parts = [
    { id: `${first}1`, kind: first, a: 'b8', b: 'b12', value: fixed[first] },
    { id: `${second}1`, kind: second, a: 'a12', b: 'T-12', value: fixed[second] },
  ];
  const holes = { A: ['a8', 'c8', 'd8', 'e8'], B: ['c12', 'd12', 'e12'], G: railHoles('T-').filter((h) => h !== 'T-12') };
  // A fixed node allowed every instrument lead on the same point. Extend the
  // two five-hole strips onto separate rails only when their capacity is used.
  // No lead or component shares a physical hole, including the jumper ends.
  for (const [node, rail] of [['A', 'T+'], ['B', 'B+']]) {
    const count = Object.values(fixed.wires).filter((n) => n === node).length;
    if (count <= holes[node].length) continue;
    const a = holes[node].pop();
    parts.push({ id: `W${parts.filter((p) => p.kind === 'W').length + 1}`, kind: 'W', a, b: `${rail}1` });
    holes[node].push(...railHoles(rail, 2));
  }
  const wires = {};
  for (const id of Object.keys(LEADS)) {
    const node = fixed.wires[id];
    if (node !== undefined) wires[id] = holes[node].shift();
  }
  return { parts, wires };
}

// Validate before reading/migrating, and validate the generated file too. This
// function never mutates its input or live instruments. An unused old board is
// preserved as a strict, serializable archive instead of silently discarded.
export function prepareBreadboardSession(data) {
  const session = validateSession(data), bench = session.bench;
  const converted = bench.board === 'rc';
  if (converted) {
    if (occupied(bench.breadboard)) {
      if (bench.breadboardArchive) throw new Error('舊實驗同時包含麵包板與備存麵包板，無法再新增備存；原實驗已保留。');
      bench.breadboardArchive = bench.breadboard;
    }
    bench.breadboard = fixedBreadboard(bench.fixed);
    bench.board = 'bb';
  }
  session.ui.benchView ??= 'breadboard';
  return { session: validateSession(session), converted, archived: Boolean(bench.breadboardArchive) };
}

// Swapping preserves both boards and deliberately uses the normal restore path
// in the app, so clocks/charge and acquisition history restart just like loading.
export function swapArchivedBreadboardSession(data) {
  const session = validateSession(data), bench = session.bench;
  if (!bench.breadboardArchive) throw new Error('此實驗沒有備存麵包板。');
  if (bench.board !== 'bb') throw new Error('請先轉換舊固定 RC 板，再切換備存麵包板。');
  [bench.breadboard, bench.breadboardArchive] = [bench.breadboardArchive, bench.breadboard];
  session.ui.benchView = 'breadboard';
  return validateSession(session);
}
