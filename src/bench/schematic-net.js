// A read-only wiring projection for the breadboard schematic. This deliberately
// does not call Bench.build()/solution(): inspecting a drawing cannot advance
// time, charge capacitors, change output state, or add simulation history.
import { groupName, holeGroup, parseHole, RAILS } from './breadboard.js';
import { LEADS } from './circuit.js';

const rank = (group) => {
  if (group === 'E') return -1;
  const rail = RAILS.indexOf(group);
  if (rail >= 0) return rail;
  const [, col, half] = /^(\d+)([UL])$/.exec(group);
  return RAILS.length + (Number(col) - 1) * 2 + (half === 'L' ? 1 : 0);
};
const compareGroup = (a, b) => rank(a) - rank(b);
const compareId = (a, b) => {
  const kind = (x) => 'RCW'.indexOf(x[0]);
  return kind(a) - kind(b) || Number(a.slice(1)) - Number(b.slice(1));
};
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const compareHole = (a, b) => {
  const pa = parseHole(a), pb = parseHole(b);
  return compareGroup(holeGroup(a), holeGroup(b)) || pa.col - pb.col || compareText(pa.row ?? '', pb.row ?? '');
};

/**
 * Return a JSON-serializable schematic of the actual wiring, never an electrical
 * equivalent: every R/C remains a separate component, even parallel or shorted.
 *
 * nodes: [{ id, label, grounded, groups, groupNames, holes, pins, leadIds,
 *           wireIds }]. id is a canonical breadboard group, or 'E' for earth;
 * label is N1, N2, ... or GND. groups list all occupied original strips/rails;
 * holes list occupied holes; pins are { partId, kind, leg, hole } for R/C/W.
 * components: [{ id, stateId, kind, value, a, b, holeA, holeB, groupA, groupB,
 *                shorted, dangling }]. a/b are node IDs; holeA/B and groupA/B
 * preserve the physical endpoints; dangling contains unconnected legs ('a'/'b').
 * jumpers: [{ id, stateId, kind:'W', a, b, holeA, holeB, groupA, groupB }].
 * leads: [{ id, name, inst, role, ch?, hole, group, node }], only plugged leads.
 * warnings: [{ level:'bad'|'info', text, partId? }], after earth equivalence.
 *
 * Breadboard.netlist supplies the jumper equivalence. Exactly the LEADS entries
 * with role='gnd' additionally share earth, matching Bench.build. Rail colour,
 * GPE minus and DMM LO do not imply earth. Wire-only networks are kept for audit.
 */
export function buildSchematicNet(bb, bbWires = {}) {
  const wiring = bb.netlist(bbWires);
  const grounds = new Set(Object.entries(wiring.leads)
    .filter(([id]) => LEADS[id]?.role === 'gnd').map(([, node]) => node));
  const nodeOf = (hole) => {
    const node = wiring.groupOf(hole);
    return grounds.has(node) ? 'E' : node;
  };
  const parts = [...bb.parts].sort((a, b) => compareId(a.id, b.id));
  const leads = Object.entries(bbWires).filter(([, hole]) => parseHole(hole))
    .sort(([a], [b]) => compareText(a, b))
    .map(([id, hole]) => ({ id, ...(LEADS[id] ?? { name: id, inst: '', role: '' }), hole, group: holeGroup(hole), node: nodeOf(hole) }));
  const byNode = new Map();
  const addHole = (hole) => {
    const id = nodeOf(hole);
    if (!byNode.has(id)) byNode.set(id, { id, grounded: id === 'E', groups: new Set(), holes: new Set(), pins: [], leadIds: [], wireIds: [] });
    const node = byNode.get(id);
    node.groups.add(holeGroup(hole));
    node.holes.add(hole);
    return node;
  };
  for (const part of parts) for (const leg of ['a', 'b']) {
    const node = addHole(part[leg]);
    node.pins.push({ partId: part.id, kind: part.kind, leg, hole: part[leg] });
    if (part.kind === 'W' && !node.wireIds.includes(part.id)) node.wireIds.push(part.id);
  }
  for (const lead of leads) addHole(lead.hole).leadIds.push(lead.id);
  let nextLabel = 1;
  const nodes = [...byNode.values()].sort((a, b) => compareGroup(a.id, b.id)).map((node) => {
    const groups = [...node.groups].sort(compareGroup);
    return { ...node, label: node.grounded ? 'GND' : `N${nextLabel++}`, groups,
      groupNames: groups.map((group) => groupName(group, true)), holes: [...node.holes].sort(compareHole) };
  });
  const connectionCount = (id) => {
    const node = byNode.get(id);
    // Extending a bare leg with a jumper does not connect another component.
    return node.pins.filter((pin) => pin.kind !== 'W').length + node.leadIds.length;
  };
  const endpoints = (part) => ({ id: part.id, stateId: part.stateId, kind: part.kind,
    a: nodeOf(part.a), b: nodeOf(part.b), holeA: part.a, holeB: part.b,
    groupA: holeGroup(part.a), groupB: holeGroup(part.b) });
  const components = parts.filter((part) => part.kind !== 'W').map((part) => {
    const component = { ...endpoints(part), value: part.value };
    const shorted = component.a === component.b;
    return { ...component, shorted, dangling: shorted ? [] : ['a', 'b'].filter((leg) => connectionCount(component[leg]) === 1) };
  });
  const jumpers = parts.filter((part) => part.kind === 'W').map(endpoints);
  const warnings = [];
  for (const component of components) {
    if (component.shorted) {
      const throughEarth = wiring.groupOf(component.holeA) !== wiring.groupOf(component.holeB);
      warnings.push({ level: 'bad', partId: component.id, text: throughEarth
        ? `${component.id} 的兩端經儀器接地夾接到同一個大地節點，被短路了；示波器接地夾與 AFG 黑夾共地。`
        : `${component.id} 的兩腳（${component.holeA}、${component.holeB}）在同一個節點，被短路了。` });
    } else if (component.dangling.length) {
      const holes = component.dangling.map((leg) => leg === 'a' ? component.holeA : component.holeB);
      warnings.push({ level: 'info', partId: component.id, text: `${component.id} 插在 ${holes.join('、')} 的腳沒有接到其他元件或儀器導線（空腳）。` });
    }
  }
  const leadNode = Object.fromEntries(leads.map((lead) => [lead.id, lead.node]));
  for (let ch = 1; ch <= 4; ch++) {
    const pos = leadNode[`GPE.CH${ch}+`], neg = leadNode[`GPE.CH${ch}-`];
    if (pos && pos === neg) warnings.push({ level: 'bad', text: `GPE CH${ch} 的＋與−接在同一個節點：電源短路。` });
  }
  for (let ch = 1; ch <= 2; ch++) if (leadNode[`AFG.CH${ch}+`] === 'E') {
    warnings.push({ level: 'bad', text: `AFG CH${ch} 紅夾接到大地節點：開啟輸出時會短路。` });
  }
  warnings.sort((a, b) => (a.level === 'bad' ? 0 : 1) - (b.level === 'bad' ? 0 : 1));
  return { nodes, components, jumpers, leads, warnings };
}
