// 麵包板模型（使用者 2026-09-30 要求：讓學生練習怎麼插麵包板；元件先少、能用就好）。
// 這裡只管「插在哪裡、哪些孔相連」，不算電壓：電路計算讀 netlist(bbWires)。
//   孔 id：主區 '{列}{欄}'（a1～j30）；電源軌 'T+{欄}'、'T-{欄}'（上方兩條）、'B+{欄}'、'B-{欄}'（下方兩條），欄 1～30。
//   原始組（沒有跳線時相連的孔）：a–e 同一欄一組＝'{欄}U'、f–j 同一欄一組＝'{欄}L'；四條電源軌各自整條一組＝'T+'、'T-'、'B+'、'B-'。
//   元件 { id, kind: 'R'|'C'|'W', a, b, value }：兩腳插在孔 a、b；R 的 value 單位 Ω、C 單位 F，W（跳線）沒有 value。
//   一個孔只能插一樣東西（元件腳、跳線端或儀器導線）；儀器導線插在哪個孔由外部的 bbWires（導線 id → 孔 id）記錄。
import { LEADS } from './circuit.js';

export const COLS = 30;
export const ROWS_U = ['a', 'b', 'c', 'd', 'e'];
export const ROWS_L = ['f', 'g', 'h', 'i', 'j'];
export const RAILS = ['T+', 'T-', 'B+', 'B-'];
export const KIND_NAME = { R: '電阻', C: '電容', W: '跳線' };
export const DEFAULT_VALUE = { R: 1000, C: 0.1e-6 };
const RAIL_NAME = { 'T+': '上方紅色＋軌', 'T-': '上方藍色−軌', 'B+': '下方紅色＋軌', 'B-': '下方藍色−軌' };

// 示範電路（示範按鈕先清空再照表擺）：parts＝[種類, 孔 a, 孔 b, 值]，wires＝導線 id → 孔
export const BB_DEMO = {
  rc: {
    name: 'RC 低通',
    desc: '示範「RC 低通」：AFG CH1 紅夾→a8，R1 1 kΩ 插 b8–b12，C1 100 nF 插 a12 到上方藍色−軌；AFG 黑夾、示波器兩個接地夾、電表 LO 都插藍色−軌（地）；示波器 CH1 量輸入（c8）、CH2 量電容（c12），電表 HI 插 d12（跨電容）。',
    parts: [['R', 'b8', 'b12', 1000], ['C', 'a12', 'T-12', 0.1e-6]],
    wires: {
      'AFG.CH1+': 'a8', 'AFG.CH1-': 'T-3',
      'TDS.CH1.TIP': 'c8', 'TDS.CH1.GND': 'T-5',
      'TDS.CH2.TIP': 'c12', 'TDS.CH2.GND': 'T-7',
      'DMM.HI': 'd12', 'DMM.LO': 'T-9',
    },
  },
  gpe: {
    name: 'GPE 分壓',
    desc: '示範「GPE 分壓」：GPE CH1 ＋插下方紅色＋軌、−插下方藍色−軌；跳線 W1 把＋軌接到第 18 欄，R1 1 kΩ（i18–i22）、R2 1 kΩ（h22–h26）串聯，跳線 W2 把第 26 欄接回−軌；電表 HI 插 g22、LO 插 g26（跨 R2）。',
    parts: [['W', 'B+18', 'j18'], ['R', 'i18', 'i22', 1000], ['R', 'h22', 'h26', 1000], ['W', 'j26', 'B-26']],
    wires: { 'GPE.CH1+': 'B+29', 'GPE.CH1-': 'B-29', 'DMM.HI': 'g22', 'DMM.LO': 'g26' },
  },
};

// 解析孔 id：{ rail, col } 或 { row, col }；不是合法的孔回傳 null
export function parseHole(h) {
  const m = /^(T\+|T-|B\+|B-|[a-j])([1-9]\d?)$/.exec(String(h));
  if (!m || Number(m[2]) > COLS) return null;
  return m[1].length === 2 ? { rail: m[1], col: Number(m[2]) } : { row: m[1], col: Number(m[2]) };
}

// 孔所在的原始組（沒有跳線時的連通組）
export function holeGroup(h) {
  const p = parseHole(h);
  if (!p) return null;
  return p.rail ?? `${p.col}${ROWS_U.includes(p.row) ? 'U' : 'L'}`;
}

// 原始組的說明（提示文字用）；brief＝只要名稱，不加「哪些孔相連」
export function groupName(g, brief = false) {
  if (RAIL_NAME[g]) return brief ? RAIL_NAME[g] : `${RAIL_NAME[g]}（整條相連）`;
  const m = /^(\d+)([UL])$/.exec(g);
  return m ? `第 ${m[1]} 欄 ${m[2] === 'U' ? 'a–e' : 'f–j'}${brief ? '' : '（這 5 個孔相連）'}` : String(g);
}

// 節點命名順序：電源軌優先（T+、T-、B+、B-），再依欄號由小到大、同一欄 U 在 L 前。
// 跳線合併後的節點用其中最前面的原始組名（例：第 9 欄 f–j 用跳線接到 B- → 節點 'B-'）。
function rank(g) {
  const r = RAILS.indexOf(g);
  if (r >= 0) return r;
  const m = /^(\d+)([UL])$/.exec(g);
  return RAILS.length + (Number(m[1]) - 1) * 2 + (m[2] === 'L' ? 1 : 0);
}

// 孔上插的東西的名稱（提示文字用）
export function occupantName(o) {
  if (!o) return '';
  if (o.lead) return LEADS[o.lead]?.name ?? o.lead;
  return o.part.kind === 'W' ? `跳線 ${o.part.id} 的一端` : `${o.part.id}（${KIND_NAME[o.part.kind]}）的腳`;
}

const validValue = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

export class Breadboard {
  constructor() { this.parts = []; }

  clear() { this.parts = []; }

  get(id) { return this.parts.find((p) => p.id === id) ?? null; }

  // 各類自動編號：取最小的沒用過的號碼（R1、R2…；刪掉 R1 後，下一顆電阻又是 R1）
  nextId(kind) {
    let n = 1;
    while (this.parts.some((p) => p.id === `${kind}${n}`)) n++;
    return `${kind}${n}`;
  }

  // 孔 h 上插了什麼：{ part, leg: 'a'|'b' }、{ lead } 或 null
  occupant(h, bbWires = {}) {
    for (const p of this.parts) {
      if (p.a === h) return { part: p, leg: 'a' };
      if (p.b === h) return { part: p, leg: 'b' };
    }
    const lead = Object.keys(bbWires).find((id) => bbWires[id] === h);
    return lead ? { lead } : null;
  }

  // 擺元件：成功 { ok: true, part }；失敗 { ok: false, why }（不是合法的孔、兩腳同孔、孔已被佔用、值不對）
  add(kind, a, b, value, bbWires = {}) {
    if (!KIND_NAME[kind]) return { ok: false, why: `沒有「${kind}」這種元件。` };
    for (const h of [a, b]) if (!parseHole(h)) return { ok: false, why: `沒有 ${h} 這個孔。` };
    if (a === b) return { ok: false, why: '兩隻腳不能插在同一個孔。' };
    for (const h of [a, b]) {
      const o = this.occupant(h, bbWires);
      if (o) return { ok: false, why: `孔 ${h} 已經插了${occupantName(o)}：一個孔只能插一樣東西。` };
    }
    const part = { id: this.nextId(kind), kind, a, b };
    if (kind !== 'W') {
      part.value = value ?? DEFAULT_VALUE[kind];
      if (!validValue(part.value)) return { ok: false, why: `${KIND_NAME[kind]}的值要是正數。` };
    }
    this.parts.push(part);
    return { ok: true, part };
  }

  remove(id) {
    const n = this.parts.length;
    this.parts = this.parts.filter((p) => p.id !== id);
    return this.parts.length < n;
  }

  // 改電阻／電容的值（跳線沒有值）
  setValue(id, value) {
    const p = this.get(id);
    if (!p || p.kind === 'W' || !validValue(value)) return false;
    p.value = value;
    return true;
  }

  // 儀器導線插到孔 h（可以從別的孔移過來）；孔要空著。成功 { ok: true }，失敗 { ok: false, why }
  plug(bbWires, lead, h) {
    if (!LEADS[lead]) return { ok: false, why: `沒有「${lead}」這條導線。` };
    if (!parseHole(h)) return { ok: false, why: `沒有 ${h} 這個孔。` };
    const o = this.occupant(h, bbWires);
    if (o && o.lead !== lead) return { ok: false, why: `孔 ${h} 已經插了${occupantName(o)}：一個孔只能插一樣東西。` };
    bbWires[lead] = h;
    return { ok: true };
  }

  // 示範電路：先清空（元件拿掉、導線拔掉），再照表擺元件、插導線
  load(demo, bbWires) {
    this.clear();
    Object.keys(bbWires).forEach((k) => delete bbWires[k]);
    for (const [kind, a, b, value] of demo.parts) this.add(kind, a, b, value, bbWires);
    for (const [lead, h] of Object.entries(demo.wires)) this.plug(bbWires, lead, h);
  }

  // 給電路計算用的接線表：跳線把兩端所在的組合併成同一個節點（union-find），不出現在 elements。
  //   nodes＝有接東西（元件腳或儀器導線）的節點，依節點命名順序排列；groupOf(孔)＝該孔目前所在的節點（任何合法的孔都有）；
  //   warnings＝擺放問題（元件被短路、空腳、GPE 同一路＋−相連）；電氣問題由電路計算判斷。
  netlist(bbWires = {}) {
    const parent = {};
    const find = (g) => {
      if (!(g in parent)) parent[g] = g;
      return parent[g] === g ? g : (parent[g] = find(parent[g]));
    };
    for (const p of this.parts) {
      if (p.kind !== 'W') continue;
      const x = find(holeGroup(p.a)), y = find(holeGroup(p.b));
      if (x !== y) { if (rank(x) < rank(y)) parent[y] = x; else parent[x] = y; } // 根＝排序最前的組名
    }
    const groupOf = (h) => { const g = holeGroup(h); return g ? find(g) : null; };
    const elements = this.parts.filter((p) => p.kind !== 'W').map((p) => ({ id: p.id, kind: p.kind, a: groupOf(p.a), b: groupOf(p.b), value: p.value }));
    const leads = {};
    for (const [id, h] of Object.entries(bbWires)) { const n = groupOf(h); if (n) leads[id] = n; }
    const nodes = [...new Set([...elements.flatMap((e) => [e.a, e.b]), ...Object.values(leads)])].sort((x, y) => rank(x) - rank(y));

    // 擺放問題
    const warnings = [];
    const count = (n) => elements.reduce((k, e) => k + (e.a === n) + (e.b === n), 0) + Object.values(leads).filter((x) => x === n).length;
    for (const p of this.parts) {
      if (p.kind === 'W') continue;
      const a = groupOf(p.a), b = groupOf(p.b), name = `${p.id}（${KIND_NAME[p.kind]}）`;
      if (a === b) {
        const ga = holeGroup(p.a), why = ga !== holeGroup(p.b) ? '跳線把兩隻腳所在的組連在一起了'
          : RAILS.includes(ga) ? '同一條電源軌整條相連' : '同一組 5 孔（同一欄的 a–e，或同一欄的 f–j）本來就相連，兩腳要插在不同組';
        warnings.push({ level: 'bad', text: `${name}兩隻腳在同一個節點 ${a}，被短路了（${why}）。` });
        continue;
      }
      const lone = [p.a, p.b].filter((h) => count(groupOf(h)) === 1); // 這個節點只有這隻腳
      if (lone.length === 2) warnings.push({ level: 'info', text: `${name}兩隻腳（${lone.join('、')}）都沒有接到其他東西（空腳）。` });
      else if (lone.length) warnings.push({ level: 'info', text: `${name}插在 ${lone[0]} 的腳沒有接到其他東西（空腳）。` });
    }
    for (let ch = 1; ch <= 4; ch++) {
      const pos = leads[`GPE.CH${ch}+`];
      if (pos && pos === leads[`GPE.CH${ch}-`]) warnings.push({ level: 'bad', text: `GPE CH${ch} 的＋與−接在同一個節點 ${pos}：電源短路。` });
    }
    warnings.sort((x, y) => (x.level === 'bad' ? 0 : 1) - (y.level === 'bad' ? 0 : 1));
    return { nodes, groupOf, elements, leads, warnings };
  }

  // 測試與 __eess 用：可 JSON 化的狀態（不含 groupOf 函式）
  snapshot(bbWires = {}) {
    const { nodes, elements, leads, warnings } = this.netlist(bbWires);
    return { parts: this.parts.map((p) => ({ ...p })), nodes, elements, leads, warnings };
  }
}
