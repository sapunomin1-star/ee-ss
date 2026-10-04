// A schematic is a second view of the breadboard, never a second circuit.
// Labels are shared between the diagram, instrument terminals and original holes.
import { buildSchematicNet } from './schematic-net.js';
import { R_OPTIONS, C_OPTIONS, fmtR, fmtC } from './bench.js';
import { KIND_NAME } from './breadboard.js';
import { mini } from './view.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const value = (p) => p.kind === 'R' ? fmtR(p.value) : p.kind === 'C' ? fmtC(p.value) : '跳線';
const palette = ['#225f9d', '#925b13', '#7750a4', '#a64359', '#157b80', '#6a7330'];
const leadLabel = (lead) => lead.id.replace('.TIP', ' 尖端').replace('.GND', ' 地夾').replace('GPE 地夾', 'GPE GND').replaceAll('.', ' ').replaceAll('+', '＋').replace(/-$/, '−');
const opt = (values, selected, format) => (values.includes(selected) ? values : [...values, selected].sort((a, b) => a - b)).map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(format(v))}</option>`).join('');
const text = (x, y, content, cls = '', extra = '') => `<text x="${x}" y="${y}" class="sc-text ${cls}" ${extra}>${esc(content)}</text>`;

function context(bench, ui) {
  const net = buildSchematicNet(bench.bb, bench.bbWires);
  const nodes = new Map(net.nodes.map((n, i) => [n.id, { ...n, color: n.grounded ? '#237449' : palette[i % palette.length] }]));
  return { net, nodes, ui };
}

function nodeTag(node, x, y, ui, subtitle = '', side = false, subtitleOffset = 0) {
  const selected = ui.schematicNode === node.id;
  const tx = side ? x + 62 : x, ty = side ? y + 13 : y - 17;
  return `<g class="sc-node${selected ? ' sel' : ''}" data-schematic-node="${esc(node.id)}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="節點 ${esc(node.label)}；${esc(node.groupNames.join('、'))}；點選查看原始孔位" style="--net-color:${node.color}">
    <title>${esc(`${node.label}：${node.groupNames.join('、')}${node.grounded ? '；儀器共地' : ''}`)}</title>
    <rect class="sc-node-hit" x="${x - (side ? 12 : 37)}" y="${y - (side ? 24 : 49)}" width="${side ? 112 : 74}" height="${side ? 51 : 72}" rx="9"/>
    <rect class="sc-node-tag" x="${tx - 32}" y="${ty - 26}" width="64" height="26" rx="13"/>
    ${text(tx, ty - 8, node.label, 'sc-node-name')}
    <circle class="sc-junction" cx="${x}" cy="${y}" r="5"/>
    ${subtitle ? text(x + subtitleOffset, y + 25, subtitle, subtitle === '空腳' ? 'sc-caption sc-caution' : 'sc-caption') : ''}
  </g>`;
}

function symbol(part, x1, y1, x2, y2, ui) {
  const vertical = x1 === x2, length = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const center = length / 2;
  let shape;
  if (part.kind === 'R') {
    const pts = [[0, 0], [center - 37, 0]];
    for (let i = 0; i < 6; i++) pts.push([center - 30 + i * 12, i % 2 ? -10 : 10]);
    pts.push([center + 37, 0], [length, 0]);
    shape = `<polyline points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
  } else {
    shape = `<path d="M0,0 H${center - 6} M${center + 6},0 H${length} M${center - 6},-18 V18 M${center + 6},-18 V18"/>`;
  }
  const labelX = vertical ? x1 + 29 : (x1 + x2) / 2;
  const labelY = vertical ? (y1 + y2) / 2 - 5 : y1 - (part.kind === 'C' ? 42 : 30);
  const alignment = vertical ? 'style="text-anchor:start"' : '';
  const description = `${part.id} ${KIND_NAME[part.kind]} ${value(part)}，${part.holeA} 到 ${part.holeB}${part.shorted ? '，兩腳短路' : ''}${part.dangling.length ? '，有空腳' : ''}`;
  return `<g class="sc-component${ui.sel === part.id ? ' sel' : ''}${part.shorted ? ' shorted' : ''}" data-comp="${esc(part.id)}" data-node-a="${esc(part.a)}" data-node-b="${esc(part.b)}" data-hole-a="${esc(part.holeA)}" data-hole-b="${esc(part.holeB)}" tabindex="0" role="button" aria-label="${esc(description)}；選取元件" aria-pressed="${ui.sel === part.id}">
    <title>${esc(description)}</title>
    <g transform="translate(${x1} ${y1}) rotate(${angle})">
      <rect class="sc-component-hit" x="0" y="-23" width="${length}" height="46" rx="9"/>
      <g class="sc-symbol">${shape}</g>
    </g>
    ${text(labelX, labelY, `${part.id}  ${value(part)}`, 'sc-component-label', alignment)}
    ${vertical ? '' : text(labelX, labelY + 16, `${part.holeA} ↔ ${part.holeB}`, 'sc-hole-label')}
  </g>`;
}

function earth(x, y) {
  return `<path class="sc-earth" d="M${x},${y} v13 m-14,0 h28 m-23,6 h18 m-13,6 h8"/>`;
}

// Common RC / divider paths get the familiar horizontal element + vertical
// return leg. Other graphs use explicit labelled terminals: no crossing can
// accidentally imply a connection, and parallel/self-loop edges never vanish.
function simpleChain(net) {
  if (net.components.length < 2 || net.components.length > 4 || net.components.some((p) => p.shorted)) return null;
  const adj = new Map(net.nodes.map((n) => [n.id, []]));
  for (const p of net.components) { adj.get(p.a).push(p); adj.get(p.b).push(p); }
  if (net.nodes.length !== net.components.length + 1 || [...adj.values()].some((v) => !v.length || v.length > 2)) return null;
  const ends = net.nodes.filter((n) => adj.get(n.id).length === 1);
  if (ends.length !== 2) return null;
  const score = (n) => n.grounded ? -100 : net.leads.some((l) => l.node === n.id && (l.role === 'sig' || l.role === 'pos')) ? 100 : net.leads.some((l) => l.node === n.id && l.role === 'neg') ? -50 : 0;
  const first = [...ends].sort((a, b) => score(b) - score(a))[0];
  const order = [first.id], parts = [];
  let at = first.id, previous = null;
  while (parts.length < net.components.length) {
    const next = adj.get(at).find((p) => p.id !== previous);
    if (!next) return null;
    parts.push(next); previous = next.id; at = next.a === at ? next.b : next.a;
    if (order.includes(at)) return null;
    order.push(at);
  }
  return { order, parts };
}

function chainDiagram(ctx, chain) {
  const { nodes, ui, net } = ctx;
  const topCount = chain.order.length - 1;
  const xs = Array.from({ length: topCount }, (_, i) => 115 + i * 630 / (topCount - 1));
  const places = chain.order.map((id, i) => ({ node: nodes.get(id), x: xs[Math.min(i, topCount - 1)], y: i === topCount ? 335 : 166 }));
  let body = chain.parts.map((p, i) => symbol(p, places[i].x, places[i].y, places[i + 1].x, places[i + 1].y, ui)).join('');
  for (const place of places) {
    const { node, x, y } = place;
    const leads = net.leads.filter((l) => l.node === node.id);
    const dangling = net.components.some((p) => p.dangling.some((leg) => p[leg] === node.id));
    const caption = dangling ? '空腳' : leads.length === 1 ? leadLabel(leads[0]) : leads.length ? `${leads.length} 條儀器導線` : '';
    body += nodeTag(node, x, y, ui, node.grounded ? '' : caption, y === 335, y === 166 && x === xs[topCount - 1] ? 86 : 0);
    if (node.grounded) body += earth(x, y + 5);
  }
  return { body, bottom: 394, order: chain.order, layout: 'chain' };
}

function parallelDiagram(ctx) {
  const { net, nodes, ui } = ctx;
  const sorted = [...net.nodes].sort((a, b) => Number(a.grounded) - Number(b.grounded));
  const left = nodes.get(sorted[0].id), right = nodes.get(sorted[1].id);
  const first = 170, last = first + (net.components.length - 1) * 102;
  let body = `<path class="sc-wire" d="M180,${first} V${last} M760,${first} V${last}"/>`;
  net.components.forEach((p, i) => {
    const y = first + i * 102;
    body += symbol(p, 180, y, 760, y, ui);
    body += `<circle class="sc-wire-dot" cx="180" cy="${y}" r="4"/><circle class="sc-wire-dot" cx="760" cy="${y}" r="4"/>`;
  });
  const dangling = (id) => net.components.some((p) => p.dangling.some((leg) => p[leg] === id)) ? '空腳' : '';
  body += nodeTag(left, 180, first, ui, dangling(left.id)) + nodeTag(right, 760, first, ui, dangling(right.id));
  if (right.grounded) body += earth(760, last + 5);
  if (left.grounded) body += earth(180, last + 5);
  return { body, bottom: last + 72, order: sorted.map((n) => n.id), layout: 'parallel' };
}

function branchDiagram(ctx) {
  const { net, nodes, ui } = ctx;
  let body = text(52, 125, '每列是一個實際元件；相同節點標籤相連。', 'sc-caption', 'style="text-anchor:start"');
  net.components.forEach((p, i) => {
    const y = 194 + i * 110;
    body += `<rect class="sc-branch-bg${p.shorted ? ' shorted' : ''}" x="48" y="${y - 57}" width="904" height="99" rx="10"/>`;
    body += symbol(p, 206, y, 730, y, ui);
    body += nodeTag(nodes.get(p.a), 206, y, ui, p.dangling.includes('a') ? '空腳' : '');
    body += nodeTag(nodes.get(p.b), 730, y, ui, p.dangling.includes('b') ? '空腳' : '');
    if (p.shorted) body += text(859, y - 7, '兩腳短路', 'sc-error');
    else if (p.dangling.length) body += text(859, y - 7, '檢查空腳', 'sc-caution');
    body += text(859, y + 16, p.shorted ? '同一節點' : `${nodes.get(p.a).label} ↔ ${nodes.get(p.b).label}`, 'sc-caption');
  });
  if (!net.components.length) {
    body += text(500, 193, net.nodes.length ? '目前只有導線與接點' : '麵包板還沒有元件', 'sc-empty-title');
    body += text(500, 226, net.nodes.length ? '下方仍會列出所有已接節點；回到麵包板可繼續插入電阻或電容。' : '先在麵包板插入電阻、電容與導線，這裡就會即時產生電路圖。', 'sc-caption');
  }
  return { body, bottom: Math.max(290, 158 + net.components.length * 110), order: net.nodes.map((n) => n.id), layout: 'branches' };
}

function nodeCards(ctx, order, startY) {
  const { net, nodes, ui } = ctx;
  let body = text(44, startY, '節點與儀器導線', 'sc-section-title', 'style="text-anchor:start"');
  let y = startY + 20;
  for (let row = 0; row * 3 < order.length; row++) {
    const ids = order.slice(row * 3, row * 3 + 3);
    const rows = ids.map((id) => {
      const node = nodes.get(id), leads = net.leads.filter((l) => l.node === id);
      return { node, leads, height: 89 + Math.max(leads.length, 1) * 19 + (node.wireIds.length ? 20 : 0) };
    });
    const height = Math.max(...rows.map((r) => r.height));
    rows.forEach(({ node, leads }, column) => {
      const x = 42 + column * 309, selected = ui.schematicNode === node.id;
      body += `<g class="sc-net-card${selected ? ' sel' : ''}" data-schematic-node="${esc(node.id)}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="${esc(node.label)} 節點與原始孔位" style="--net-color:${node.color}">
        <title>${esc(`${node.label}：${node.groupNames.join('、')}；孔位 ${node.holes.join('、')}`)}</title>
        <rect class="sc-net-card-bg" x="${x}" y="${y}" width="297" height="${height}" rx="10"/>
        <circle cx="${x + 19}" cy="${y + 24}" r="5" fill="${node.color}"/>
        ${text(x + 34, y + 29, `${node.label}${node.grounded ? ' · 儀器共地' : ''}`, 'sc-net-card-name', 'style="text-anchor:start"')}
        ${text(x + 15, y + 54, node.groups.length <= 4 ? node.groups.join(' · ') : `${node.groups.slice(0, 3).join(' · ')} ＋${node.groups.length - 3} 組`, 'sc-caption', 'style="text-anchor:start"')}
        ${leads.length ? leads.map((l, i) => text(x + 15, y + 80 + 19 * i, `${leadLabel(l)} → ${l.hole}`, 'sc-lead-label', 'style="text-anchor:start"')).join('') : text(x + 15, y + 80, '未接儀器導線', 'sc-caption', 'style="text-anchor:start"')}
        ${node.wireIds.length ? text(x + 15, y + 80 + 19 * Math.max(1, leads.length), `跳線：${node.wireIds.slice(0, 5).join('、')}${node.wireIds.length > 5 ? ` 等 ${node.wireIds.length} 條` : ''}`, 'sc-caption', 'style="text-anchor:start"') : ''}
      </g>`;
    });
    y += height + 14;
  }
  return { body, bottom: y };
}

function instrumentStrip(models, y) {
  const configs = [
    ['afg', 'AFG-2225', [320, 240], '訊號產生器'],
    ['tds', 'TDS2001C', [320, 240], '示波器'],
    ['dmm', '34460A', [480, 318], '電表'],
    ['gpe', 'GPE-4323', [480, 266], '直流電源'],
  ];
  return text(44, y, '即時儀器 · 點螢幕回到面板', 'sc-section-title', 'style="text-anchor:start"') + configs.map(([id, title, dims, label], i) => {
    const x = 42 + i * 232, height = 88, width = height * dims[0] / dims[1];
    return `<rect class="sc-instrument-bg" x="${x}" y="${y + 16}" width="220" height="143" rx="10"/>` +
      text(x + 12, y + 37, `${title} · ${label}`, 'sc-instrument-title', 'style="text-anchor:start"') +
      mini(models[id], x + (220 - width) / 2, y + 52, width, height, dims, id, title);
  }).join('');
}

export function schematicSvg(bench, models, ui = {}) {
  const ctx = context(bench, ui), { net } = ctx;
  const chain = simpleChain(net);
  const diagram = chain ? chainDiagram(ctx, chain)
    : net.nodes.length === 2 && net.components.length && net.components.every((p) => !p.shorted) ? parallelDiagram(ctx)
      : branchDiagram(ctx);
  const cards = nodeCards(ctx, diagram.order, diagram.bottom + 18);
  const instrumentsY = cards.bottom + 26;
  const height = instrumentsY + 184;
  return `<svg class="bench-svg schematic-svg" data-schematic-layout="${diagram.layout}" viewBox="0 0 1000 ${height}" xmlns="http://www.w3.org/2000/svg" aria-label="依麵包板實際接線產生的電路圖">
    <title>麵包板電路圖</title>
    <desc>電阻、電容與儀器接線均由麵包板產生。相同節點標籤表示電氣相連，跳線合併成節點。選取元件或節點可在側欄核對原始孔位。</desc>
    <rect class="sc-sheet" x="16" y="16" width="968" height="${cards.bottom - 8}" rx="15"/>
    ${text(43, 49, '接線電路圖', 'sc-title', 'style="text-anchor:start"')}
    ${text(43, 75, '依麵包板即時產生 · 相同節點標籤相連 · 點節點可核對孔位', 'sc-caption', 'style="text-anchor:start"')}
    ${text(950, 47, `${net.components.length} 個元件  /  ${net.nodes.length} 個節點`, 'sc-stats', 'style="text-anchor:end"')}
    ${text(950, 71, `${net.jumpers.length} 條跳線已併入節點`, 'sc-caption', 'style="text-anchor:end"')}
    ${diagram.body}${cards.body}${instrumentStrip(models, instrumentsY)}
  </svg>`;
}

function selectedPart(bench, net, ui) {
  const part = [...net.components, ...net.jumpers].find((p) => p.id === ui.sel);
  if (!part) return '<p class="muted">點圖上的電阻／電容，或下方元件清單，可核對孔位與改值。</p>';
  const nodes = new Map(net.nodes.map((n) => [n.id, n]));
  const editableValue = part.kind === 'W' ? '<p class="muted">跳線已併入相連的節點。</p>'
    : `<label class="fld">值 <select name="bbVal">${opt(part.kind === 'R' ? R_OPTIONS : C_OPTIONS, part.value, part.kind === 'R' ? fmtR : fmtC)}</select></label>`;
  return `<dl class="kv"><dt>元件</dt><dd>${esc(part.id)} · ${KIND_NAME[part.kind]}</dd>
    <dt>原始孔位</dt><dd>${esc(part.holeA)} ↔ ${esc(part.holeB)}</dd>
    <dt>電路節點</dt><dd>${esc(nodes.get(part.a).label)} ↔ ${esc(nodes.get(part.b).label)}</dd></dl>
    ${editableValue}<div class="btns"><button data-bb="delete">刪除 ${esc(part.id)}</button><button data-schematic="edit">回麵包板查看</button></div>`;
}

export function schematicSide(bench, ui = {}, hints = '') {
  const { net } = context(bench, ui);
  const selected = net.nodes.find((n) => n.id === ui.schematicNode);
  const nodeDetails = selected ? `<div class="sc-selected-node"><b>${esc(selected.label)}${selected.grounded ? ' · 儀器共地' : ''}</b>
    <p>${selected.groupNames.map(esc).join('、')}</p>
    <p>使用的孔位：${selected.holes.map(esc).join('、') || '無'}</p>
    <ul>${selected.pins.map((p) => `<li>${esc(p.partId)} ${p.leg === 'a' ? '第一' : '第二'}腳 → ${esc(p.hole)}</li>`).join('')}${net.leads.filter((l) => l.node === selected.id).map((l) => `<li>${esc(l.name)} → ${esc(l.hole)}</li>`).join('')}</ul></div>` : '<p class="muted">點選圖上的節點標籤或節點卡片，查看哪些孔、元件腳與儀器導線相連。</p>';
  const rows = [...net.components, ...net.jumpers].map((p) => `<li><button class="sc-part-button${ui.sel === p.id ? ' sel' : ''}" data-comp="${esc(p.id)}" aria-pressed="${ui.sel === p.id}"><b>${esc(p.id)}</b> ${esc(value(p))}<small>${esc(p.holeA)} ↔ ${esc(p.holeB)}${p.shorted ? ' · 短路' : p.dangling?.length ? ' · 空腳' : ''}</small></button></li>`).join('');
  const warnings = net.warnings.length ? net.warnings.map((w) => `<li class="w-${w.level}">${esc(w.text)}</li>`).join('') : '<li class="w-ok">目前未發現元件短路或空腳。</li>';
  return `<h2>實驗台（電路圖）<small>與麵包板共用同一份元件和接線</small></h2>
    <section><h3>怎麼看</h3><p class="howto">電阻用折線、電容用兩片平行板表示。相同節點標籤代表相連；麵包板內部銅條與跳線會合併為節點。圖中保留所有元件，短路與空腳也會顯示。</p>
    <p class="muted">電源軌的＋／−只是位置標記；只有接上 AFG 黑夾、示波器接地夾或 GPE GND 的節點才標為 GND。GPE 負端與電表 LO 不會自動接地。</p>
    <div class="btns"><button data-schematic="edit">回麵包板接線</button></div></section>
    <section><h3>選取的元件</h3>${selectedPart(bench, net, ui)}</section>
    <section><h3>選取的節點</h3>${nodeDetails}</section>
    <section><h3>接線檢查</h3><ul class="warn">${warnings}</ul><p class="muted">此處檢查實際連接關係；輸出狀態與量測值請看各儀器面板。</p></section>
    <section><h3>元件與原始孔位</h3><ul class="sc-parts">${rows || '<li class="muted">麵包板還沒有元件。</li>'}</ul></section>
    <section><h3>實體探棒</h3><label class="fld">CH1 探棒開關 <select name="px1">${opt([1, 10], bench.probeX[0], (v) => `${v}×`)}</select></label>
    <label class="fld">CH2 探棒開關 <select name="px2">${opt([1, 10], bench.probeX[1], (v) => `${v}×`)}</select></label><p class="muted">探棒開關要和示波器 CH 選單的 Probe 設定一致。</p></section>
    <section><h3>最近提示</h3><ul class="log">${hints || '<li class="empty">（還沒有）</li>'}</ul></section>`;
}
