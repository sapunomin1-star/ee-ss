// 接線編輯歷史：只保存兩塊板各自的配置；不保存儀器、時鐘、電荷或波形。
// 復原／重做是「現在」重新接成某個配置，讓 Bench 正常建立新的電路時間段。
import { Breadboard } from './breadboard.js';

export const HISTORY_LIMIT = 100;
const copy = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortedWires = (wires) => Object.fromEntries(Object.entries(wires).sort(([a], [b]) => a.localeCompare(b)));

export class WiringHistory {
  constructor(bench, limit = HISTORY_LIMIT) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('接線歷史上限必須是正整數。');
    this.bench = bench;
    this.limit = limit;
    this.clear();
  }

  clear() {
    this.stacks = { rc: { undo: [], redo: [] }, bb: { undo: [], redo: [] } };
    this.identities = new WeakMap();
  }

  identity(part) {
    if (!this.identities.has(part)) this.identities.set(part, part.stateId);
    return this.identities.get(part);
  }

  capture(board) {
    const b = this.bench;
    if (board === 'rc') return { topo: b.topo, R: b.R, C: b.C, wires: sortedWires(b.wires) };
    if (board !== 'bb') throw new Error('未知的實驗板。');
    return { parts: b.bb.parts.map((p) => ({ identity: this.identity(p), id: p.id,
      kind: p.kind, a: p.a, b: p.b, ...(p.kind === 'W' ? {} : { value: p.value }) })),
      wires: sortedWires(b.bbWires) };
  }

  perform(board, label, edit) {
    const before = this.capture(board);
    const result = edit();
    const after = this.capture(board);
    if (!same(before, after)) {
      const stack = this.stacks[board];
      stack.undo.push({ label, before, after });
      if (stack.undo.length > this.limit) stack.undo.shift();
      stack.redo.length = 0;
    }
    return result;
  }

  status(board) {
    const { undo, redo } = this.stacks[board];
    return { undo: undo.length, redo: redo.length, undoLabel: undo.at(-1)?.label ?? '', redoLabel: redo.at(-1)?.label ?? '' };
  }

  apply(board, data) {
    const b = this.bench;
    if (board === 'rc') {
      Object.assign(b, { topo: data.topo, R: data.R, C: data.C, wires: copy(data.wires), sel: null });
      return { restoredCaps: 0 };
    }
    const existing = new Map(b.bb.parts.map((p) => [this.identity(p), p]));
    const rebuilt = new Breadboard();
    let restoredCaps = 0;
    for (const p of data.parts) {
      const result = rebuilt.add(p.kind, p.a, p.b, p.value, data.wires);
      if (!result.ok) throw new Error(`無法復原接線：${result.why}`);
      const current = existing.get(p.identity), next = result.part;
      next.id = p.id;
      // 一直在板上的元件保留生命週期，改值／改接線保持當下電容電壓。
      // 已被拿掉的元件重新擺上時使用 add() 的新 stateId，從 0 V 開始。
      if (current?.kind === p.kind) next.stateId = current.stateId;
      else if (p.kind === 'C') restoredCaps++;
      this.identities.set(next, p.identity);
    }
    b.bb = rebuilt;
    b.bbWires = copy(data.wires);
    b.sel = null;
    return { restoredCaps };
  }

  travel(board, direction) {
    const stack = this.stacks[board], from = stack[direction], to = stack[direction === 'undo' ? 'redo' : 'undo'];
    const item = from.at(-1);
    if (!item) return null;
    const result = this.apply(board, item[direction === 'undo' ? 'before' : 'after']);
    from.pop(); to.push(item);
    return { label: item.label, ...result };
  }

  undo(board) { return this.travel(board, 'undo'); }
  redo(board) { return this.travel(board, 'redo'); }
}
