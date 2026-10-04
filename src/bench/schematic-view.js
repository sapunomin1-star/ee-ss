// Draw the actual breadboard network as connected wires and conventional symbols.
// Layout only changes positions. It never replaces the user's circuit with a template.
import { buildSchematicNet } from './schematic-net.js';
import { buildSchematicLayout } from './schematic-layout.js';
import { R_OPTIONS, C_OPTIONS, fmtR, fmtC } from './bench.js';
import { KIND_NAME } from './breadboard.js';
import { mini } from './view.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const value = (p) => p.kind === 'R' ? fmtR(p.value) : p.kind === 'C' ? fmtC(p.value) : '跳線';
const leadLabel = (lead) => lead.id.replace('.TIP', '').replace('.GND', ' GND').replaceAll('.', ' ').replaceAll('+', '＋').replace(/-$/, '−');
const opt = (values, selected, format) => (values.includes(selected) ? values : [...values, selected].sort((a, b) => a - b)).map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(format(v))}</option>`).join('');
const text = (x, y, content, cls = '', extra = '') => `<text x="${x}" y="${y}" class="sc-text ${cls}" ${extra}>${esc(content)}</text>`;
const precise = (n) => Number.isFinite(n) ? String(Number(n.toPrecision(4))) : '—';
const frequency = (n) => n >= 1e6 ? `${precise(n / 1e6)} MHz` : n >= 1e3 ? `${precise(n / 1e3)} kHz` : `${precise(n)} Hz`;
const coords = (edge) => `data-node-a="${esc(edge.a)}" data-node-b="${esc(edge.b)}" data-x1="${edge.x1}" data-y1="${edge.y1}" data-x2="${edge.x2}" data-y2="${edge.y2}"`;
const path = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');

// AFG is earth-referenced even when its own black clip is unplugged.
// GPE floats and needs both physical leads. Settings never read back simulation.
function sourceEdges(net, models) {
  const leads = new Map(net.leads.map((l) => [l.id, l]));
  const sources = [];
  for (const [inst, count] of [['GPE', 4], ['AFG', 2]]) for (let ch = 1; ch <= count; ch++) {
    const id = `${inst}.CH${ch}`, positive = leads.get(`${id}+`), negative = leads.get(`${id}-`);
    if (!positive || inst === 'GPE' && !negative) continue;
    const model = models[inst.toLowerCase()];
    const source = { id, kind: 'source', a: positive.node, b: inst === 'AFG' ? 'E' : negative.node, leadA: positive.id, leadB: negative?.id ?? '', returnKind: negative ? 'lead' : 'earth', returnNote: !negative ? net.nodes.find((n) => n.id === 'E')?.internal ? '黑夾未接；尚未接回地' : '黑夾未接；經儀器共地' : '', label: `${inst} CH${ch}`, wave: inst === 'GPE' ? 'dc' : 'ac' };
    if (inst === 'GPE') {
      const volts = model.eff?.(ch)?.vs ?? (model.vset?.[ch] ?? 0) / 100;
      source.detail = `設定 ${precise(volts)} V`;
      source.off = !(model.isOn() && model.output);
    } else {
      const c = model.ch?.[ch - 1] ?? {};
      const vpp = model.refVpp?.(c) ?? c.emfVpp ?? 0;
      const rate = c.wave === 'ARB' && c.extended?.arb ? c.extended.arb.rate / c.extended.arb.length : c.freq;
      source.detail = `設定 ${precise(vpp)} Vpp`;
      source.extra = [c.wave, c.wave === 'NOISE' ? '' : frequency(rate), c.extended?.motion?.mode !== 'CONT' ? c.extended?.motion?.mode : ''].filter(Boolean).join(' · ');
      source.off = !(model.isOn() && c.output);
    }
    sources.push(source);
  }
  return sources;
}

// Project conductive instrument branches without touching the breadboard or
// querying its solver. The DMM shunt remains physically connected in DCV/OFF.
function instrumentGraph(physical, models) {
  const net = { ...physical, nodes: [...physical.nodes], components: [...physical.components] };
  if (physical.leads.some((lead) => /^AFG\.CH[12]\+$/.test(lead.id)) && !physical.nodes.some((node) => node.id === 'E')) {
    net.nodes.push({ id: 'E', label: 'GND', grounded: true, internal: true, groups: [], groupNames: [], holes: [], pins: [], leadIds: [], wireIds: [] });
  }
  const current = physical.leads.find((lead) => lead.id === 'DMM.I'), common = physical.leads.find((lead) => lead.id === 'DMM.LO');
  const meter = models.dmm, shunt = meter.currentShunt?.();
  if (current && common && Number.isFinite(shunt) && shunt > 0) {
    net.components.push({ id: 'DMM.I-LO', kind: 'ammeter', instrument: true,
      a: current.node, b: common.node, leadA: current.id, leadB: common.id, value: shunt,
      active: meter.isOn() && ['DCI', 'ACI'].includes(meter.fn), powered: meter.isOn(), fn: meter.fn,
      stopped: meter.run === 'stop', shorted: current.node === common.node, dangling: [] });
  }
  return net;
}

function component(edge, ui) {
  const { x1, y1, x2, y2 } = edge;
  const vertical = x1 === x2, length = Math.hypot(x2 - x1, y2 - y1), center = length / 2;
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  let shape;
  if (edge.kind === 'R') {
    const pts = [[0, 0], [center - 32, 0]];
    for (let i = 0; i < 6; i++) pts.push([center - 25 + i * 10, i % 2 ? -9 : 9]);
    pts.push([center + 32, 0], [length, 0]);
    shape = `<polyline points="${pts.map((p) => p.join(',')).join(' ')}"/>`;
  } else {
    shape = `<path d="M0,0 H${center - 5} M${center + 5},0 H${length} M${center - 5},-17 V17 M${center + 5},-17 V17"/>`;
  }
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const tx = edge.labelX ?? (vertical ? cx + (edge.shorted ? -28 : 28) : cx), ty = edge.labelY ?? (vertical ? cy - 6 : cy - 35);
  const anchor = edge.labelAnchor ?? (vertical ? edge.shorted ? 'end' : 'start' : 'middle');
  const description = `${edge.id} ${KIND_NAME[edge.kind]} ${value(edge)}，${edge.holeA} 到 ${edge.holeB}${edge.shorted ? '，兩腳短路' : ''}${edge.dangling.length ? '，有空腳' : ''}`;
  return `<g class="sc-component${ui.sel === edge.id ? ' sel' : ''}${edge.shorted ? ' shorted' : ''}" data-comp="${esc(edge.id)}" ${coords(edge)} data-hole-a="${esc(edge.holeA)}" data-hole-b="${esc(edge.holeB)}" tabindex="0" role="button" aria-label="${esc(description)}；選取元件" aria-pressed="${ui.sel === edge.id}">
    <title>${esc(description)}</title><g transform="translate(${x1} ${y1}) rotate(${angle})"><rect class="sc-component-hit" x="0" y="-23" width="${length}" height="46" rx="7"/><g class="sc-symbol">${shape}</g></g>
    ${text(tx, ty, edge.id, 'sc-component-label', `style="text-anchor:${anchor}"`)}
    ${text(tx, ty + 19, value(edge), 'sc-component-value', `style="text-anchor:${anchor}"`)}
    ${edge.shorted ? text(tx, ty + 38, '短路', 'sc-error', `style="text-anchor:${anchor}"`) : ''}
  </g>`;
}

function source(edge) {
  const { x1, y1, x2, y2 } = edge, length = Math.hypot(x2 - x1, y2 - y1), center = length / 2;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, vertical = x1 === x2;
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const shape = edge.wave === 'dc'
    ? `<path d="M0,0 H${center - 8} M${center + 8},0 H${length} M${center - 8},-26 V26 M${center + 8},-15 V15"/>`
    : `<path d="M0,0 H${center - 26} M${center + 26},0 H${length}"/><circle cx="${center}" cy="0" r="26"/>`;
  const tx = edge.labelX ?? (vertical ? cx - 42 : cx), ty = edge.labelY ?? (vertical ? cy - 26 : cy - 68), anchor = edge.labelAnchor ?? (vertical ? 'end' : 'middle');
  const annotation = `style="text-anchor:${anchor}"`;
  const ux = (x2 - x1) / length, uy = (y2 - y1) / length;
  const polarity = (sign) => text(cx + sign * ux * 32 + uy * 22, cy + sign * uy * 32 - ux * 22 + 6, sign < 0 ? '+' : '−', 'sc-polarity');
  return `<g class="sc-source${edge.off ? ' off' : ''}${edge.a === edge.b ? ' shorted' : ''}" data-source="${esc(edge.id)}" data-lead-a="${esc(edge.leadA)}" data-lead-b="${esc(edge.leadB)}" data-output="${edge.off ? 'off' : 'on'}" data-return="${edge.returnKind}" ${coords(edge)}>
    <title>${esc(`${edge.label}；${edge.detail}；Output ${edge.off ? 'OFF' : 'ON'}；${edge.leadA} 接 ${edge.a}，${edge.leadB ? `${edge.leadB} 接 ${edge.b}` : edge.returnNote}`)}</title>
    <g class="sc-symbol" transform="translate(${x1} ${y1}) rotate(${angle})">${shape}</g>
    ${edge.wave === 'ac' ? `<path class="sc-symbol" d="M${cx - 15},${cy} C${cx - 9},${cy - 19} ${cx - 5},${cy - 19} ${cx},${cy} S${cx + 9},${cy + 19} ${cx + 15},${cy}"/>` : ''}
    ${polarity(-1)}${polarity(1)}
    ${text(tx, ty, edge.label, 'sc-source-label', annotation)}${text(tx, ty + 20, edge.detail, 'sc-source-detail', annotation)}
    ${edge.extra ? text(tx, ty + 38, edge.extra, 'sc-source-extra', annotation) : ''}
    ${edge.off ? text(tx, ty + (edge.extra ? 57 : 40), 'Output OFF', 'sc-source-off', annotation) : ''}
    ${edge.returnNote ? text(tx, ty + (edge.extra ? 57 : 40) + (edge.off ? 18 : 0), edge.returnNote, 'sc-source-return', annotation) : ''}
  </g>`;
}

function ammeter(edge) {
  const { x1, y1, x2, y2 } = edge, length = Math.hypot(x2 - x1, y2 - y1), center = length / 2;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, vertical = x1 === x2, angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const tx = vertical ? cx + (edge.shorted ? -40 : 40) : cx, ty = vertical ? cy - 17 : cy - 59, anchor = vertical ? edge.shorted ? 'end' : 'start' : 'middle';
  const annotation = `style="text-anchor:${anchor}"`;
  const points = [[0, 0], [center - 32, 0]];
  for (let i = 0; i < 6; i++) points.push([center - 25 + i * 10, i % 2 ? -9 : 9]);
  points.push([center + 32, 0], [length, 0]);
  const symbol = edge.active ? `<path d="M0,0 H${center - 24} M${center + 24},0 H${length}"/><circle cx="${center}" cy="0" r="24"/>` : `<polyline points="${points.map((p) => p.join(',')).join(' ')}"/>`;
  const shuntText = fmtR(Number(edge.value.toPrecision(5)));
  const status = edge.active ? `${edge.fn}${edge.stopped ? ' · 停止擷取' : ''}` : `${edge.powered ? edge.fn : '關機'} · 分流仍導通`;
  return `<g class="sc-meter${edge.active ? ' active' : ' inactive'}${edge.shorted ? ' shorted' : ''}" data-device="DMM.I-LO" data-active="${edge.active}" data-lead-a="DMM.I" data-lead-b="DMM.LO" data-shunt="${edge.value}" ${coords(edge)}>
    <title>${esc(`DMM I → LO；${shuntText} 分流；${status}`)}</title>
    <g class="sc-symbol" transform="translate(${x1} ${y1}) rotate(${angle})">${symbol}</g>
    ${edge.active ? text(cx, cy + 8, 'A', 'sc-meter-glyph') : ''}
    ${text(tx, ty, 'DMM I → LO', 'sc-meter-label', annotation)}
    ${text(tx, ty + 18, `${shuntText} 分流`, 'sc-meter-value', annotation)}
    ${text(tx, ty + 35, status, 'sc-meter-status', annotation)}
    ${text(x1 + (vertical ? 13 : 0), y1 + (vertical ? 5 : -12), 'I ＋', 'sc-meter-terminal', vertical ? 'style="text-anchor:start"' : '')}
    ${text(x2 + (vertical ? 13 : 0), y2 + (vertical ? 5 : -12), 'LO −', 'sc-meter-terminal', vertical ? 'style="text-anchor:start"' : '')}
  </g>`;
}

function earth(x, y) {
  return `<path class="sc-earth" d="M${x},${y} v18 m-14,0 h28 m-23,6 h18 m-13,6 h8"/>`;
}

function nodeMark(place, net, ui, sourceLeadIds) {
  const node = net.nodes.find((n) => n.id === place.id);
  if (node.internal) return `<g class="sc-internal-earth" data-internal-node="E">${earth(place.x, place.y)}${text(place.x + 24, place.y + 28, 'AFG 內部大地', 'sc-caption', 'style="text-anchor:start"')}</g>`;
  const lone = net.components.some((p) => p.dangling.some((leg) => p[leg] === node.id)) || !node.pins.some((p) => p.kind !== 'W') && node.leadIds.length <= 1;
  const selected = ui.schematicNode === node.id;
  const leads = net.leads.filter((l) => l.node === node.id && !sourceLeadIds.has(l.id));
  const names = leads.map((l) => `${leadLabel(l)}${/^(AFG|GPE)\.CH\d[+-]$/.test(l.id) ? l.id.endsWith('+') ? '（−端未接）' : '（＋端未接）' : ''}`), lines = [];
  for (const name of names) {
    if (lines.length && `${lines.at(-1)} · ${name}`.length <= 28) lines[lines.length - 1] += ` · ${name}`;
    else lines.push(name);
  }
  const tx = place.labelX ?? place.x + 14, ty = place.labelY ?? place.y - 18, anchor = place.labelAnchor ?? 'start';
  return `<g class="sc-node${selected ? ' sel' : ''}${lone ? ' dangling' : ''}" data-schematic-node="${esc(node.id)}" data-x="${place.x}" data-y="${place.y}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="節點 ${esc(node.label)}；${esc(node.groupNames.join('、'))}；點選核對孔位">
    <title>${esc(`${node.label}：${node.groupNames.join('、')}${leads.length ? `；${leads.map((l) => l.name).join('、')}` : ''}`)}</title>
    <circle class="sc-node-hit" cx="${place.x}" cy="${place.y}" r="16"/>
    <circle class="sc-node-dot" cx="${place.x}" cy="${place.y}" r="${lone ? 5 : 3.5}"/>
    ${lines.map((line, i) => text(tx, ty - (lines.length - 1 - i) * 17, line, 'sc-measure-label', `style="text-anchor:${anchor}"`)).join('')}
    ${lone ? text(place.x, place.y + 25, '空腳', 'sc-caution') : ''}
    ${node.grounded ? earth(place.x, place.y) : ''}
  </g>`;
}

function instrumentStrip(models, y, canvasWidth) {
  const configs = [['afg', 'AFG-2225', [320, 240]], ['tds', 'TDS2001C', [320, 240]], ['dmm', '34460A', [480, 318]], ['gpe', 'GPE-4323', [480, 266]]];
  const left = Math.max(32, (canvasWidth - 924) / 2);
  return configs.map(([id, title, dims], i) => {
    const x = left + i * 232, h = 80, w = h * dims[0] / dims[1];
    return `<rect class="sc-instrument-bg" x="${x}" y="${y}" width="220" height="128" rx="8"/>` + text(x + 12, y + 21, title, 'sc-instrument-title', 'style="text-anchor:start"') + mini(models[id], x + (220 - w) / 2, y + 35, w, h, dims, id, title);
  }).join('');
}

export function schematicSvg(bench, models, ui = {}) {
  const physical = buildSchematicNet(bench.bb, bench.bbWires), net = instrumentGraph(physical, models), sources = sourceEdges(net, models);
  const layout = buildSchematicLayout(net, { sources });
  const dy = 0, shifted = (edge) => ({ ...edge, y1: edge.y1 + dy, y2: edge.y2 + dy, ...(edge.labelY != null ? { labelY: edge.labelY + dy } : {}) });
  const width = Math.max(1000, layout.width), diagramBottom = Math.max(440, layout.height + dy);
  const sourceLeadIds = new Set([...sources, ...net.components.filter((e) => e.instrument)].flatMap((s) => [s.leadA, s.leadB]));
  const wireHtml = layout.wires.map((wire) => `<path class="sc-wire${ui.schematicNode === wire.netId ? ' sel' : ''}" data-wire-node="${esc(wire.netId)}" d="${path(wire.points.map(([x, y]) => [x, y + dy]))}"/>`).join('');
  const bridges = (layout.crossings ?? []).map((cross) => {
    const x = cross.x, y = cross.y + dy;
    const under = layout.wires.find((w) => w.netId === cross.underNetId && w.points[0][1] === cross.y && w.points[1][1] === cross.y && w.points[0][0] <= x && w.points[1][0] >= x);
    const restore = under ? `M${Math.max(under.points[0][0], x - 12)},${y} H${Math.min(under.points[1][0], x + 12)}` : '';
    const arc = `M${x},${y - 9} C${x + 12},${y - 9} ${x + 12},${y + 9} ${x},${y + 9}`;
    return `<g class="sc-crossing" data-over-net="${esc(cross.overNetId)}" data-under-net="${esc(cross.underNetId)}"><path class="sc-crossing-gap" d="M${x},${y - 9} V${y + 9}"/>
      <path class="sc-wire${ui.schematicNode === cross.underNetId ? ' sel' : ''}" data-wire-node="${esc(cross.underNetId)}" d="${restore}"/>
      <path class="sc-crossing-gap" d="${arc}"/><path class="sc-wire${ui.schematicNode === cross.overNetId ? ' sel' : ''}" data-wire-node="${esc(cross.overNetId)}" d="${arc}"/></g>`;
  }).join('');
  const dots = layout.junctions.map((j) => `<circle class="sc-junction" data-junction-node="${esc(j.netId)}" cx="${j.x}" cy="${j.y + dy}" r="3.5"/>`).join('');
  const nodes = layout.nodes.map((node) => nodeMark({ ...node, y: node.y + dy, ...(node.labelY != null ? { labelY: node.labelY + dy } : {}) }, net, ui, sourceLeadIds)).join('');
  const edges = layout.edges.map((edge) => edge.isSource ? source(shifted(edge)) : edge.instrument ? ammeter(shifted(edge)) : component(shifted(edge), ui)).join('');
  return `<svg class="bench-svg schematic-svg" data-schematic-layout="${layout.layout}" viewBox="0 0 ${width} ${diagramBottom + 170}" xmlns="http://www.w3.org/2000/svg" aria-label="依麵包板實際接線產生的電路圖">
    <title>麵包板電路圖</title><desc>所有元件按麵包板實際接線連接；錯接、短路與空腳也照實呈現。導線交叉有圓點才相連。點元件可改值，點節點可核對孔位。</desc>
    <rect class="sc-sheet" x="16" y="16" width="${width - 32}" height="${diagramBottom - 16}" rx="10"/>
    ${text(43, 49, '電路圖', 'sc-title', 'style="text-anchor:start"')}
    ${text(43, 74, '麵包板的實際接線 · 交叉處有圓點才相連', 'sc-caption', 'style="text-anchor:start"')}
    ${text(width - 43, 48, `${physical.components.length} 個元件`, 'sc-stats', 'style="text-anchor:end"')}
    ${wireHtml}${bridges}${edges}${dots}${nodes}
    ${!net.nodes.length ? text(width / 2, 250, '先在麵包板插入元件與導線', 'sc-empty-title') : ''}
    ${instrumentStrip(models, diagramBottom + 18, width)}
  </svg>`;
}

function selectedPart(net, ui) {
  const part = [...net.components, ...net.jumpers].find((p) => p.id === ui.sel);
  if (!part) return '<p class="muted">點選圖上的元件，可核對孔位或改值。</p>';
  const editableValue = part.kind === 'W' ? '<p class="muted">跳線兩端已畫成同一條連線。</p>' : `<label class="fld">值 <select name="bbVal">${opt(part.kind === 'R' ? R_OPTIONS : C_OPTIONS, part.value, part.kind === 'R' ? fmtR : fmtC)}</select></label>`;
  return `<dl class="kv"><dt>元件</dt><dd>${esc(part.id)} · ${KIND_NAME[part.kind]}</dd><dt>孔位</dt><dd>${esc(part.holeA)} ↔ ${esc(part.holeB)}</dd></dl>${editableValue}
    <div class="btns"><button data-bb="delete">刪除 ${esc(part.id)}</button><button data-schematic="edit">回麵包板查看</button></div>`;
}

export function schematicSide(bench, ui = {}, hints = '', solverWarnings = []) {
  const net = buildSchematicNet(bench.bb, bench.bbWires), selected = net.nodes.find((n) => n.id === ui.schematicNode);
  const nodeDetails = selected ? `<div class="sc-selected-node"><b>${esc(selected.label)}${selected.grounded ? ' · 儀器共地' : ''}</b><p>${selected.groupNames.map(esc).join('、')}</p>
    <p>使用的孔位：${selected.holes.map(esc).join('、') || '無'}</p><ul>${selected.pins.map((p) => `<li>${esc(p.partId)} ${p.leg === 'a' ? '第一' : '第二'}腳 → ${esc(p.hole)}</li>`).join('')}${net.leads.filter((l) => l.node === selected.id).map((l) => `<li>${esc(l.name)} → ${esc(l.hole)}</li>`).join('')}</ul></div>` : '<p class="muted">點圖上的連接點，查看相連的孔位與導線。</p>';
  const rows = [...net.components, ...net.jumpers].map((p) => `<li><button class="sc-part-button${ui.sel === p.id ? ' sel' : ''}" data-comp="${esc(p.id)}" aria-pressed="${ui.sel === p.id}"><b>${esc(p.id)}</b> ${esc(value(p))}<small>${esc(p.holeA)} ↔ ${esc(p.holeB)}${p.shorted ? ' · 短路' : p.dangling?.length ? ' · 空腳' : ''}</small></button></li>`).join('');
  // Reuse the application's last evaluated warnings. Inspecting a view must
  // not invoke the solver, but it must retain its limitations and wiring faults.
  const byText = new Map();
  for (const warning of [...solverWarnings, ...net.warnings]) {
    if (!byText.has(warning.text) || warning.level === 'bad') byText.set(warning.text, warning);
  }
  const allWarnings = [...byText.values()];
  const warnings = allWarnings.length ? allWarnings.map((w) => `<li class="w-${w.level}">${esc(w.text)}</li>`).join('') : '<li class="w-ok">目前沒有接線或求解警告。</li>';
  const netRows = net.nodes.map((n) => `<li><button class="sc-net-audit" data-schematic-node="${esc(n.id)}">${esc(n.label)} · ${n.groupNames.map(esc).join('、')}</button><span>${n.holes.map(esc).join('、')}</span></li>`).join('');
  return `<h2>實驗台（電路圖）<small>直接呈現麵包板上的實際電路</small></h2>
    <p class="howto">插錯也會照實畫出。點元件改值、點連接點核對孔位。</p><div class="btns"><button data-schematic="edit">回麵包板接線</button></div>
    <section><h3>選取的元件</h3>${selectedPart(net, ui)}</section>
    <section><h3>接線檢查</h3><ul class="warn">${warnings}</ul></section>
    <details class="sc-audit"${selected ? ' open' : ''}><summary>選取節點的孔位</summary>${nodeDetails}</details>
    <details class="sc-audit"${ui.sel ? ' open' : ''}><summary>全部元件與原始孔位</summary><ul class="sc-parts">${rows || '<li class="muted">還沒有元件。</li>'}</ul></details>
    <details class="sc-audit"><summary>所有節點與導線</summary><ul class="sc-net-list">${netRows || '<li>還沒有接線。</li>'}</ul>
      <ul class="wires">${net.leads.map((l) => `<li>${esc(l.name)} → ${esc(l.hole)}</li>`).join('')}</ul>
      <p class="muted">GPE 負端、DMM LO 與電源軌的−標記不等於接地。AFG 黑夾、示波器接地夾與 GPE GND 共地。</p></details>
    <details class="sc-audit"><summary>實體探棒倍率</summary><label class="fld">CH1 探棒 <select name="px1">${opt([1, 10], bench.probeX[0], (v) => `${v}×`)}</select></label><label class="fld">CH2 探棒 <select name="px2">${opt([1, 10], bench.probeX[1], (v) => `${v}×`)}</select></label><p class="muted">須與示波器的 Probe 設定一致。</p></details>
    <details class="sc-audit"><summary>最近提示</summary><ul class="log">${hints || '<li class="empty">（還沒有）</li>'}</ul></details>`;
}
