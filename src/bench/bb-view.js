// 實驗台的「麵包板」畫面：中間 30 欄麵包板（a–j、中間分隔溝、上下各兩條電源軌），四周是四台的小螢幕
// （點一下切到該台面板）與導線端（AFG 鱷魚夾、示波器探棒、電表測試線、GPE 輸出端子）；另有麵包板模式的側欄。
// 孔帶 data-net＝目前所在節點（含跳線合併）：滑鼠移到孔上時，外殼把同一個 data-net 的孔都加上 class hl。
import { LEADS } from './circuit.js';
import { R_OPTIONS, C_OPTIONS, fmtR, fmtC } from './bench.js';
import { mini } from './view.js';
import { COLS, ROWS_U, ROWS_L, KIND_NAME, parseHole, holeGroup, groupName, occupantName } from './breadboard.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtVal = (p) => (p.kind === 'R' ? fmtR(p.value) : p.kind === 'C' ? fmtC(p.value) : '');

// ---- 版面 ----
const P = 17.5; // 孔距；每 5 欄多留 7 的間隔（只是畫面好數，電氣上不影響）
const colX = (c) => 229 + (c - 1) * P + Math.floor((c - 1) / 5) * 7;
// 由上到下：上方＋軌、−軌、a–e、中間溝、f–j、下方−軌、＋軌（紅線在外側）
const ROW_Y = { 'T+': 218, 'T-': 235, a: 270, b: 287.5, c: 305, d: 322.5, e: 340, f: 372, g: 389.5, h: 407, i: 424.5, j: 442, 'B-': 476, 'B+': 493 };
const XL = colX(1), XR = colX(COLS);
const holeXY = (h) => { const p = parseHole(h); return [colX(p.col), ROW_Y[p.rail ?? p.row]]; };

// 導線端：x、y＝圓點（插頭）；pill＝膠囊在圓點的哪一邊（'L' 左、'R' 右；v＝直立膠囊，圓點在上）
const RED = '#d32f2f', BLK = '#222';
const END = {
  'AFG.CH1+': { x: 330, y: 44, color: RED, label: 'CH1 紅夾', pill: 'L' },
  'AFG.CH1-': { x: 330, y: 80, color: BLK, label: 'CH1 黑夾', pill: 'L' },
  'AFG.CH2+': { x: 330, y: 122, color: RED, label: 'CH2 紅夾', pill: 'L' },
  'AFG.CH2-': { x: 330, y: 158, color: BLK, label: 'CH2 黑夾', pill: 'L' },
  'TDS.CH1.TIP': { x: 670, y: 44, color: '#e0b800', label: 'CH1 尖端', pill: 'R' },
  'TDS.CH1.GND': { x: 670, y: 80, color: BLK, label: 'CH1 接地夾', pill: 'R' },
  'TDS.CH2.TIP': { x: 670, y: 122, color: '#1e9bd7', label: 'CH2 尖端', pill: 'R' },
  'TDS.CH2.GND': { x: 670, y: 158, color: BLK, label: 'CH2 接地夾', pill: 'R' },
  'DMM.HI': { x: 330, y: 572, color: RED, label: 'HI（紅）', pill: 'L' },
  'DMM.LO': { x: 330, y: 612, color: BLK, label: 'LO（黑）', pill: 'L' },
};
// GPE 輸出端子排成一列（同一路的＋、−靠在一起），上方標路數
const GPE_X = [380, 474, 568, 662];
GPE_X.forEach((x, i) => {
  END[`GPE.CH${i + 1}+`] = { x, y: 574, color: RED, label: '＋', v: true };
  END[`GPE.CH${i + 1}-`] = { x: x + 42, y: 574, color: BLK, label: '−', v: true };
});
END['GPE.GND'] = { x: 750, y: 574, color: '#2e7d32', label: 'GND', v: true };

function leadEnd(id, bench, net) {
  const e = END[id], h = bench.bbWires[id], sel = bench.sel === id, name = LEADS[id].name;
  const where = h ? `插在 ${h}，節點 ${net.groupOf(h)}` : '未接';
  const head = `<g class="lead${sel ? ' sel' : ''}${h ? ' on' : ''}" data-lead="${id}" tabindex="0" role="button" aria-label="${esc(name)}（${where}）">` +
    `<title>${esc(name)}：${h ? `${where}（選取後再點一次＝拔掉）` : '點一下選取，再點麵包板上的孔'}</title>`;
  const dot = `<circle cx="${e.x}" cy="${e.y}" r="${e.v ? 8 : 9}" fill="${e.color}" stroke="#fff" stroke-width="2"/>`;
  if (e.v) {
    return `${head}<rect x="${e.x - 17}" y="${e.y - 12}" width="34" height="44" rx="14" class="pill"/>${dot}` +
      `<text x="${e.x}" y="${e.y + 25}" font-size="${e.label.length > 1 ? 11 : 15}" class="pill-t">${esc(e.label)}</text></g>`;
  }
  const w = 92, x0 = e.pill === 'L' ? e.x - w : e.x;
  return `${head}<rect x="${x0}" y="${e.y - 13}" width="${w}" height="26" rx="13" class="pill"/>${dot}` +
    `<text x="${x0 + w / 2 + (e.pill === 'L' ? -6 : 6)}" y="${e.y + 4.5}" font-size="12.5" class="pill-t">${esc(e.label)}</text></g>`;
}

// 已插上的導線：從導線端拉到孔（不擋滑鼠，孔還點得到）
function leadWire(id, h) {
  const e = END[id], [hx, hy] = holeXY(h);
  const [dx, dy] = e.v ? [0, -1] : e.pill === 'L' ? [1, 0] : [-1, 0], s = e.y < hy ? -1 : 1;
  return `<g class="bbw"><path d="M${e.x},${e.y} C${e.x + dx * 55},${e.y + dy * 55} ${hx},${hy + s * 45} ${hx},${hy}" fill="none" stroke="${e.color}" stroke-width="2.8" stroke-linecap="round" opacity=".85"/>` +
    `<circle cx="${hx}" cy="${hy}" r="4.2" fill="${e.color}" stroke="#fff" stroke-width="1.2"/></g>`;
}

// ---- 元件 ----
const BAND = ['#111', '#7b4a2a', '#d32f2f', '#f57c00', '#fbc02d', '#388e3c', '#1976d2', '#7b1fa2', '#9e9e9e', '#fafafa'];
// 四色環：兩位有效數字＋倍率（第四環金色＝±5%）
function bands(r) {
  const e = Math.floor(Math.log10(r)) - 1, d = Math.round(r / 10 ** e);
  return [BAND[Math.floor(d / 10)], BAND[d % 10], BAND[e] ?? '#c9a227'];
}
const JUMPER = ['#e53935', '#fb8c00', '#43a047', '#1e88e5', '#8e24aa', '#fdd835', '#6d4c41', '#00897b'];

function comp(p, selected) {
  const [x1, y1] = holeXY(p.a), [x2, y2] = holeXY(p.b);
  const len = Math.hypot(x2 - x1, y2 - y1), deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, seg = `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
  let body;
  if (p.kind === 'W') {
    const c = JUMPER[(Number(p.id.slice(1)) - 1) % JUMPER.length];
    body = `<line ${seg} stroke="${c}" stroke-width="3.6" stroke-linecap="round"/>` +
      [[x1, y1], [x2, y2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${c}" stroke="#fff" stroke-width="1"/>`).join('');
  } else {
    let shape;
    if (p.kind === 'R') { // 米色本體＋色環
      const L = Math.max(10, Math.min(30, len - 9)), cs = bands(p.value);
      shape = `<rect x="${-L / 2}" y="-4.5" width="${L}" height="9" rx="4" fill="#e3c89a" stroke="#9c7c46" stroke-width=".8"/>` +
        [-0.3, -0.12, 0.06, 0.3].map((f, i) => `<rect x="${f * L - 1.2}" y="-4.5" width="2.4" height="9" fill="${i < 3 ? cs[i] : '#c9a227'}"/>`).join('');
    } else { // 藍色本體（薄膜電容）
      const w = Math.max(6, Math.min(9, len - 9));
      shape = `<rect x="${-w / 2}" y="-6.5" width="${w}" height="13" rx="2.5" fill="#2f6fd6" stroke="#1b4a96" stroke-width=".8"/>`;
    }
    const lbl = Math.abs(x2 - x1) >= Math.abs(y2 - y1)
      ? `<text x="${mx}" y="${my - 9}" class="lbl">${esc(`${p.id} ${fmtVal(p)}`)}</text>`
      : `<text x="${mx + 9}" y="${my + 3}" class="lbl" style="text-anchor:start">${esc(`${p.id} ${fmtVal(p)}`)}</text>`;
    body = `<line ${seg} stroke="#9aa1a8" stroke-width="1.8"/>` +
      [[x1, y1], [x2, y2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#8d949b"/>`).join('') +
      `<g transform="translate(${mx} ${my}) rotate(${deg})">${shape}</g>${lbl}`;
  }
  const what = `${p.id}（${KIND_NAME[p.kind]}${p.kind === 'W' ? '' : ` ${fmtVal(p)}`}）${p.a}–${p.b}`;
  return `<g class="comp${selected ? ' sel' : ''}" data-comp="${p.id}" tabindex="0" role="button" aria-label="${esc(what)}"><title>${esc(what)}：選取工具點一下選取</title>` +
    (selected ? `<line ${seg} class="glow" stroke-width="15" stroke-linecap="round"/>` : '') +
    `<line ${seg} class="grab" stroke="transparent" stroke-width="12" stroke-linecap="round"/>${body}</g>`;
}

// ---- 麵包板 ----
function board(bench, ui, net) {
  const occ = {};
  for (const p of bench.bb.parts) { occ[p.a] = { part: p }; occ[p.b] = { part: p }; }
  for (const [id, h] of Object.entries(bench.bbWires)) occ[h] = { lead: id };
  const hole = (h, x, y) => {
    const g = holeGroup(h), n = net.groupOf(h), o = occ[h];
    const tip = `${h}：${groupName(g)}${n !== g ? `；經跳線併入節點 ${n}` : ''}${o ? `；插著${occupantName(o)}` : ''}`;
    return `<g class="hole${ui.first === h ? ' first' : ''}" data-hole="${h}" data-net="${esc(n)}" tabindex="0" role="button" aria-label="孔 ${h}"><title>${esc(tip)}</title>` +
      `<rect class="hit" x="${x - 8.25}" y="${y - 8.25}" width="16.5" height="16.5" rx="3"/><rect class="h" x="${x - 3}" y="${y - 3}" width="6" height="6" rx="1.2"/></g>`;
  };
  const cols = Array.from({ length: COLS }, (_, i) => i + 1);
  let s = `<rect x="${XL - 36}" y="198" width="${XR - XL + 72}" height="312" rx="10" class="bb-board"/>` +
    `<rect x="${XL - 10}" y="350" width="${XR - XL + 20}" height="12" rx="3" class="bb-trench"/>`;
  // 電源軌標線（紅＋在外側、藍−在內側）與符號
  for (const [y, c, t, ty] of [[208, RED, '+', 222], [245, '#1e6fd9', '−', 239], [466, '#1e6fd9', '−', 480], [503, RED, '+', 497]]) {
    s += `<line x1="${XL - 12}" y1="${y}" x2="${XR + 12}" y2="${y}" stroke="${c}" stroke-width="2"/>` +
      `<text x="${XL - 24}" y="${ty}" font-size="14" font-weight="700" fill="${c}">${t}</text><text x="${XR + 24}" y="${ty}" font-size="14" font-weight="700" fill="${c}">${t}</text>`;
  }
  for (const c of cols.filter((c) => c === 1 || c % 5 === 0)) s += `<text x="${colX(c)}" y="258" font-size="8.5" class="bb-num">${c}</text><text x="${colX(c)}" y="459" font-size="8.5" class="bb-num">${c}</text>`;
  for (const r of [...ROWS_U, ...ROWS_L]) s += `<text x="${XL - 20}" y="${ROW_Y[r] + 3}" font-size="9" class="bb-num">${r}</text><text x="${XR + 20}" y="${ROW_Y[r] + 3}" font-size="9" class="bb-num">${r}</text>`;
  for (const r of ['T+', 'T-', ...ROWS_U, ...ROWS_L, 'B-', 'B+']) for (const c of cols) s += hole(`${r}${c}`, colX(c), ROW_Y[r]);
  return s;
}

export function bbSvg(bench, models, ui) {
  const { afg, tds, dmm, gpe } = models;
  const net = bench.bb.netlist(bench.bbWires);
  const cls = `bench-svg bb-svg${ui.tool === 'select' && !bench.sel ? ' pick' : ''}${bench.sel ? ' armed' : ''}`;
  return `<svg class="${cls}" viewBox="0 0 1000 680" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="8" width="218" height="184" rx="10" fill="#c3c8cd" stroke="#6f767d"/>
    <text x="22" y="27" font-size="14" font-weight="700" class="blk" style="text-anchor:start">AFG-2225 輸出</text>
    ${mini(afg, 20, 36, 172, 129, [320, 240], 'afg', 'AFG-2225')}
    <text x="22" y="184" font-size="11.5" class="blk" style="text-anchor:start">BNC 轉鱷魚夾：紅＝訊號、黑＝地</text>
    <rect x="772" y="8" width="218" height="184" rx="10" fill="#d4d6d8" stroke="#6f767d"/>
    <text x="978" y="27" font-size="14" font-weight="700" class="blk" style="text-anchor:end">TDS2001C 探棒</text>
    ${mini(tds, 808, 36, 172, 129, [320, 240], 'tds', 'TDS2001C')}
    <text x="978" y="184" font-size="11.5" class="blk" style="text-anchor:end">${tds.scenarios.get() === 'BENCH' ? '來源：實驗台接線' : '來源：單機情境（非接線）'}</text>
    <rect x="10" y="518" width="218" height="154" rx="12" fill="#34383d" stroke="#1d2024"/>
    <text x="22" y="537" font-size="14" font-weight="700" fill="#fff" style="text-anchor:start">34460A 測試線</text>
    ${mini(dmm, 20, 545, 150, 99, [480, 318], 'dmm', '34460A')}
    <text x="22" y="663" font-size="11.5" fill="#dfe3e6" style="text-anchor:start">${dmm.scenarios.get() === 'bench' ? '來源：實驗台接線' : '來源：單機情境（非接線）'}</text>
    <rect x="772" y="518" width="218" height="154" rx="10" fill="#cfd3d6" stroke="#6f767d"/>
    <text x="978" y="537" font-size="14" font-weight="700" class="blk" style="text-anchor:end">GPE-4323 輸出</text>
    ${mini(gpe, 800, 545, 180, 100, [480, 266], 'gpe', 'GPE-4323')}
    <text x="978" y="663" font-size="11.5" class="blk" style="text-anchor:end">各路浮接；GND＝機殼地</text>
    <text x="363" y="538" font-size="11.5" class="blk" style="text-anchor:start">GPE-4323 輸出端子</text>
    ${GPE_X.map((x, i) => `<text x="${x + 21}" y="556" font-size="11" font-weight="700" class="blk">CH${i + 1}</text>`).join('')}
    ${board(bench, ui, net)}
    ${bench.bb.parts.map((p) => comp(p, ui.sel === p.id)).join('')}
    ${Object.entries(bench.bbWires).map(([id, h]) => leadWire(id, h)).join('')}
    ${Object.keys(END).map((id) => leadEnd(id, bench, net)).join('')}
  </svg>`;
}

// ---- 側欄 ----
const opt = (list, cur, fmt) => list.map((v) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(fmt(v))}</option>`).join('');

// 最上面的「板子」切換（兩種模式都有）
export function boardSwitch(board) {
  return `<div class="board-sw" role="radiogroup" aria-label="板子"><b>板子</b>` +
    [['rc', '固定 RC 板'], ['bb', '麵包板']].map(([v, t]) => `<label><input type="radio" name="board" value="${v}"${board === v ? ' checked' : ''}> ${t}</label>`).join('') + '</div>';
}

export function bbSide(bench, ui, hints) {
  const net = bench.bb.netlist(bench.bbWires), p = ui.sel ? bench.bb.get(ui.sel) : null;
  const tools = [['select', '選取'], ['R', '電阻'], ['C', '電容'], ['W', '跳線']]
    .map(([v, t]) => `<label><input type="radio" name="bbtool" value="${v}"${ui.tool === v ? ' checked' : ''}> ${t}</label>`).join('');
  let selHtml = '<p class="muted">（沒有選取：用「選取」工具點麵包板上的元件）</p>';
  if (p) {
    const val = p.kind === 'W' ? '<p class="muted">跳線沒有值，只是把兩個孔所在的組連起來。</p>'
      : `<label class="fld">值 <select name="bbVal">${p.kind === 'R' ? opt(R_OPTIONS, p.value, fmtR) : opt(C_OPTIONS, p.value, fmtC)}</select></label>`;
    selHtml = `<dl class="kv"><dt>元件</dt><dd>${esc(p.id)}（${KIND_NAME[p.kind]}）</dd><dt>${p.kind === 'W' ? '兩端' : '兩腳'}</dt><dd>${p.a}、${p.b}（節點 ${esc(net.groupOf(p.a))}、${esc(net.groupOf(p.b))}）</dd></dl>` +
      `${val}<div class="btns"><button data-bb="delete">刪除 ${esc(p.id)}</button></div>`;
  }
  // 擺放問題（麵包板模型）＋電氣問題（電路計算：輸出短路到地、沒有回路、AFG 輸出 OFF…）
  const all = bench.solution().warn;
  const warn = all.length ? all.map((w) => `<li class="w-${w.level}">${esc(w.text)}</li>`).join('') : '<li class="w-ok">擺放與接線沒有問題。</li>';
  const on = Object.keys(LEADS).filter((id) => bench.bbWires[id]);
  const rows = on.map((id) => `<li><b>${esc(LEADS[id].name)}</b>：${bench.bbWires[id]}（節點 ${esc(net.leads[id])}）</li>`).join('');
  return `
    <h2>實驗台（麵包板）<small>自己插元件、接導線</small></h2>
    <section><h3>怎麼操作</h3><p class="howto">① 選工具（電阻／電容／跳線）→ 點第一個孔 → 點第二個孔，就插上了。② 「選取」工具：點元件選取，可以改值；按 Delete 或下面的刪除鍵拿掉。③ 接線：點導線端（變藍）→ 點孔；已接的導線端選取後再點一次＝拔掉。滑鼠移到孔上，所有相連的孔會一起亮起來。</p></section>
    <section><h3>工具</h3><div class="bbtools">${tools}</div>
      <label class="fld">新電阻 <select name="bbR">${opt(R_OPTIONS, ui.newR, fmtR)}</select></label>
      <label class="fld">新電容 <select name="bbC">${opt(C_OPTIONS, ui.newC, fmtC)}</select></label></section>
    <section><h3>選取的元件</h3>${selHtml}</section>
    <section><h3>狀況</h3><ul class="warn">${warn}</ul></section>
    <section><h3>導線</h3><ul class="wires">${rows || '<li class="muted">還沒有接導線。</li>'}</ul>
      ${on.length && on.length < Object.keys(LEADS).length ? `<p class="muted">其餘 ${Object.keys(LEADS).length - on.length} 條未接。</p>` : ''}</section>
    <section><h3>示範與清空</h3>
      <div class="btns"><button data-bb="demo-rc">示範「RC 低通」</button><button data-bb="demo-gpe">示範「GPE 分壓」</button></div>
      <div class="btns"><button data-bb="clear">清空麵包板</button></div>
      <p class="muted">示範會先清空麵包板再擺上完整接線。</p></section>
    <section><h3>練習提示</h3><ul class="practice">
      <li>中間每一欄的 a–e 五個孔相連、f–j 五個孔相連；中間溝的兩邊不相連。</li>
      <li>上下的電源軌整條橫向相連：通常紅色＋軌接電源、藍色−軌接地。</li>
      <li>元件兩隻腳要插在不同欄；插在同一欄（或同一條軌）等於被短路。</li>
      <li>跳線把兩個孔所在的組連成同一個節點，例如把電源軌接到某一欄。</li>
      <li>量電壓：電表 HI、LO 並聯在要量的元件兩端（插在元件兩腳所在的欄）。</li>
      <li>AFG 黑夾、示波器接地夾都是地，要接到同一個地（例如藍色−軌）。</li>
    </ul></section>
    <section><h3>最近提示</h3><ul class="log">${hints || '<li class="empty">（還沒有）</li>'}</ul></section>`;
}
