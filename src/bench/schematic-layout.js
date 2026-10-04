// Pure geometry for the actual wiring graph. Two-terminal series/parallel
// networks get a conventional source-left loop. Other graphs retain explicit
// conductors; different nets crossing have an explicit bridge, never a dot.
const PIN_LENGTH = 180, LANE = 100, PARALLEL_GAP = 70, BUS_INSET = 40;
const key = (x, y) => `${x},${y}`;
const other = (edge, node) => edge.a === node ? edge.b : edge.a;
const sequence = (tree, from) => tree.a === from ? tree.children : [...tree.children].reverse();

function seriesParallel(components, a, b) {
  if (a === b || components.some((edge) => edge.a === edge.b)) return null;
  let work = components.map((edge) => ({ a: edge.a, b: edge.b, tree: { type: 'leaf', a: edge.a, b: edge.b, edge } }));
  while (work.length > 1) {
    const parallel = new Map();
    for (const edge of work) {
      const pair = JSON.stringify([edge.a, edge.b].sort());
      if (!parallel.has(pair)) parallel.set(pair, []);
      parallel.get(pair).push(edge);
    }
    const group = [...parallel.values()].find((edges) => edges.length > 1);
    if (group) {
      const { a: from, b: to } = group[0], members = new Set(group);
      work = [...work.filter((edge) => !members.has(edge)), { a: from, b: to,
        tree: { type: 'parallel', a: from, b: to, children: group.map((edge) => edge.tree) } }];
      continue;
    }
    const incident = new Map();
    for (const edge of work) for (const node of [edge.a, edge.b]) {
      if (!incident.has(node)) incident.set(node, []);
      incident.get(node).push(edge);
    }
    const joint = [...incident].find(([node, edges]) => node !== a && node !== b && edges.length === 2);
    if (!joint) break;
    const [node, [first, second]] = joint, from = other(first, node), to = other(second, node);
    work = [...work.filter((edge) => edge !== first && edge !== second), { a: from, b: to,
      tree: { type: 'series', a: from, b: to, children: [first.tree, second.tree] } }];
  }
  const result = work[0];
  return work.length === 1 && ((result.a === a && result.b === b) || (result.a === b && result.b === a)) ? result.tree : null;
}

function flattenSeries(tree, from) {
  if (tree.type !== 'series') return [tree];
  const children = []; let cursor = from;
  for (const child of sequence(tree, from)) {
    children.push(...flattenSeries(child, cursor)); cursor = other(child, cursor);
  }
  return children;
}

function measure(tree) {
  if (tree.type === 'leaf') return { length: PIN_LENGTH, breadth: LANE };
  const sizes = tree.children.map(measure);
  return tree.type === 'series'
    ? { length: sizes.reduce((sum, size) => sum + size.length, 0), breadth: Math.max(...sizes.map((size) => size.breadth)) }
    : { length: 2 * BUS_INSET + Math.max(...sizes.map((size) => size.length)),
      breadth: sizes.reduce((sum, size) => sum + size.breadth, 0) + PARALLEL_GAP * (sizes.length - 1) };
}

function drawState() {
  const state = { nodes: new Map(), edges: [], wires: [], maxX: 0, maxY: 0 };
  state.point = (x, y) => { state.maxX = Math.max(state.maxX, x); state.maxY = Math.max(state.maxY, y); };
  state.node = (id, x, y) => { if (!state.nodes.has(id)) state.nodes.set(id, { id, x, y }); state.point(x, y); };
  state.wire = (netId, points) => {
    if (points.length < 2) return;
    state.wires.push({ netId, points }); points.forEach(([x, y]) => state.point(x, y));
  };
  state.edge = (edge, from, start, end, isSource = false) => {
    const [a, b] = edge.a === from ? [start, end] : [end, start];
    state.edges.push({ ...edge, x1: a[0], y1: a[1], x2: b[0], y2: b[1], isSource });
    state.node(edge.a, ...a); state.node(edge.b, ...b);
  };
  return state;
}

// x/y is the top-left bounding box; every subtree is rotated as a whole.
function place(tree, from, orientation, x, y, out) {
  const size = measure(tree), horizontal = orientation === 'h';
  const at = (u, v) => horizontal ? [x + u, y + v] : [x + v, y + u];
  const start = at(0, size.breadth / 2), end = at(size.length, size.breadth / 2), to = other(tree, from);
  if (tree.type === 'leaf') out.edge(tree.edge, from, start, end);
  else if (tree.type === 'series') {
    let offset = 0, cursor = from;
    for (const child of sequence(tree, from)) {
      const childSize = measure(child), origin = at(offset, (size.breadth - childSize.breadth) / 2);
      place(child, cursor, orientation, ...origin, out);
      cursor = other(child, cursor); offset += childSize.length;
    }
  } else {
    let offset = 0;
    for (const child of tree.children) {
      const childSize = measure(child), middle = offset + childSize.breadth / 2;
      const origin = at(BUS_INSET, offset);
      place(child, from, orientation, ...origin, out);
      out.wire(from, [start, at(0, middle), at(BUS_INSET, middle)]);
      out.wire(to, [at(BUS_INSET + childSize.length, middle), at(size.length, middle), end]);
      offset += childSize.breadth + PARALLEL_GAP;
    }
  }
  out.node(from, ...start); out.node(to, ...end);
  return { start, end, size };
}

function conventional(island, source, tree) {
  const out = drawState();
  if (!source) {
    place(tree, tree.a, 'h', 180, 110, out);
  } else {
    const parts = flattenSeries(tree, source.a), sourceX = 180;
    let top, bottom;
    if (parts.length > 1) {
      const last = parts.at(-1), firstParts = parts.slice(0, -1);
      let middle = source.a;
      for (const part of firstParts) middle = other(part, middle);
      const first = firstParts.length === 1 ? firstParts[0] : { type: 'series', a: source.a, b: middle, children: firstParts };
      const firstSize = measure(first), topY = 110 + Math.max(50, firstSize.breadth / 2);
      const horizontal = place(first, source.a, 'h', sourceX + 110, topY - firstSize.breadth / 2, out);
      const horizontalBottom = out.maxY;
      const vertical = place(last, middle, 'v', horizontal.end[0] + 60, topY, out);
      out.wire(middle, [horizontal.end, vertical.start]);
      top = [sourceX, topY]; bottom = [sourceX, Math.max(vertical.end[1], horizontalBottom + 100)];
      out.wire(source.a, [top, horizontal.start]);
      out.wire(source.b, [vertical.end, [vertical.end[0], bottom[1]], bottom]);
    } else {
      const vertical = place(tree, source.a, 'v', sourceX + 190, 160, out);
      top = [sourceX, vertical.start[1]]; bottom = [sourceX, vertical.end[1]];
      out.wire(source.a, [top, vertical.start]); out.wire(source.b, [vertical.end, bottom]);
    }
    out.edge(source, source.a, top, bottom, true);
  }
  return { ...out, layout: 'series-parallel', width: Math.max(1000, out.maxX + 130), height: out.maxY + 120 };
}

// Deterministic orthogonal fallback: each net is a bus and each edge has its
// own vertical lane. Symbols stay between bus rows; only conductors cross.
function routed(island) {
  const out = drawState(), ordered = [...island.nodes];
  const source = island.sources.find((edge) => edge.a !== edge.b);
  if (source) ordered.sort((a, b) => (a.id === source.a ? -1 : a.id === source.b ? 1 : 0) - (b.id === source.a ? -1 : b.id === source.b ? 1 : 0));
  const rows = new Map(ordered.map((node, index) => [node.id, 150 + index * 200]));
  const buses = new Map(ordered.map((node) => [node.id, []]));
  const edges = [...island.sources.map((edge) => ({ edge, isSource: true })), ...island.components.map((edge) => ({ edge, isSource: false }))];
  edges.forEach(({ edge, isSource }, index) => {
    const x = 180 + index * 220, aY = rows.get(edge.a), bY = rows.get(edge.b);
    if (edge.a === edge.b) {
      out.edge(edge, edge.a, [x, aY + 35], [x, aY + 155], isSource);
      out.wire(edge.a, [[x, aY], [x, aY + 35]]);
      out.wire(edge.b, [[x, aY + 155], [x + 95, aY + 155], [x + 95, aY]]);
      buses.get(edge.a).push(x, x + 95);
    } else {
      const end = aY + Math.sign(bY - aY) * 120;
      out.edge(edge, edge.a, [x, aY], [x, end], isSource);
      out.wire(edge.b, [[x, end], [x, bY]]);
      buses.get(edge.a).push(x); buses.get(edge.b).push(x);
    }
  });
  for (const node of ordered) {
    const positions = buses.get(node.id), y = rows.get(node.id);
    const left = positions.length ? Math.min(...positions) : 180, right = positions.length ? Math.max(...positions) : left;
    out.wire(node.id, [[left, y], [right, y]]);
    // Anchor labels on the actual bus, not on an extended edge pin below it.
    out.nodes.set(node.id, { id: node.id, x: left, y }); out.point(right, y);
  }
  return { ...out, layout: edges.length ? 'connected' : 'isolated', width: Math.max(1000, out.maxX + 140), height: out.maxY + 170 };
}

function connectedIslands(net, sources) {
  const parent = new Map(net.nodes.map((node) => [node.id, node.id]));
  const find = (id) => { let root = id; while (parent.get(root) !== root) root = parent.get(root); return root; };
  const all = [...net.components, ...sources];
  for (const edge of all) {
    if (!parent.has(edge.a) || !parent.has(edge.b)) throw new Error(`Unknown schematic endpoint: ${edge.id}`);
    parent.set(find(edge.b), find(edge.a));
  }
  const groups = new Map();
  for (const node of net.nodes) {
    const root = find(node.id);
    if (!groups.has(root)) groups.set(root, { nodes: [], components: [], sources: [] });
    groups.get(root).nodes.push(node);
  }
  for (const edge of net.components) groups.get(find(edge.a)).components.push(edge);
  for (const source of sources) groups.get(find(source.a)).sources.push(source);
  return [...groups.values()];
}

function layoutIsland(island) {
  if (island.sources.length === 1 && island.components.length) {
    const source = island.sources[0], tree = seriesParallel(island.components, source.a, source.b);
    if (tree) return conventional(island, source, tree);
  } else if (!island.sources.length && island.components.length) {
    const degree = new Map(island.nodes.map((node) => [node.id, 0]));
    for (const edge of island.components) { degree.set(edge.a, degree.get(edge.a) + 1); degree.set(edge.b, degree.get(edge.b) + 1); }
    const ends = island.nodes.filter((node) => degree.get(node.id) === 1);
    const candidates = ends.length === 2 ? [ends[0].id, ends[1].id] : [island.nodes[0].id, island.nodes.at(-1).id];
    const tree = seriesParallel(island.components, ...candidates);
    if (tree) return conventional(island, null, tree);
  }
  return routed(island);
}

function segments(wires) {
  const rows = new Map();
  for (const wire of wires) for (let i = 1; i < wire.points.length; i++) {
    const [a, b] = [wire.points[i - 1], wire.points[i]];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const horizontal = a[1] === b[1], constant = horizontal ? a[1] : a[0];
    if (!horizontal && a[0] !== b[0]) throw new Error('Schematic wire is not orthogonal');
    const lane = JSON.stringify([wire.netId, horizontal, constant]);
    if (!rows.has(lane)) rows.set(lane, { netId: wire.netId, horizontal, constant, intervals: [] });
    rows.get(lane).intervals.push([Math.min(...[a, b].map((p) => p[horizontal ? 0 : 1])), Math.max(...[a, b].map((p) => p[horizontal ? 0 : 1]))]);
  }
  const result = [];
  for (const row of rows.values()) {
    const intervals = row.intervals.sort((a, b) => a[0] - b[0]), merged = [];
    for (const interval of intervals) {
      if (merged.length && interval[0] <= merged.at(-1)[1]) merged.at(-1)[1] = Math.max(merged.at(-1)[1], interval[1]);
      else merged.push([...interval]);
    }
    for (const [from, to] of merged) result.push({ netId: row.netId, points: row.horizontal ? [[from, row.constant], [to, row.constant]] : [[row.constant, from], [row.constant, to]] });
  }
  return result;
}

function wireDetails(wires, edges) {
  const candidates = new Map(), crossings = [];
  const addCandidate = (netId, x, y) => candidates.set(`${netId}:${key(x, y)}`, { netId, x, y });
  for (const wire of wires) wire.points.forEach(([x, y]) => addCandidate(wire.netId, x, y));
  for (const edge of edges) { addCandidate(edge.a, edge.x1, edge.y1); addCandidate(edge.b, edge.x2, edge.y2); }
  for (let i = 0; i < wires.length; i++) for (let j = i + 1; j < wires.length; j++) {
    const first = wires[i], second = wires[j], h1 = first.points[0][1] === first.points[1][1], h2 = second.points[0][1] === second.points[1][1];
    if (h1 === h2) continue;
    const [h, v] = h1 ? [first, second] : [second, first], x = v.points[0][0], y = h.points[0][1];
    if (x < h.points[0][0] || x > h.points[1][0] || y < v.points[0][1] || y > v.points[1][1]) continue;
    if (h.netId === v.netId) addCandidate(h.netId, x, y);
    else crossings.push({ x, y, overNetId: v.netId, underNetId: h.netId, orientation: 'vertical' });
  }
  const junctions = [];
  for (const point of candidates.values()) {
    const directions = new Set(), addRay = (x, y) => {
      if (x < point.x) directions.add('left'); if (x > point.x) directions.add('right');
      if (y < point.y) directions.add('up'); if (y > point.y) directions.add('down');
    };
    for (const wire of wires) {
      if (wire.netId !== point.netId) continue;
      const [a, b] = wire.points;
      if (point.x >= Math.min(a[0], b[0]) && point.x <= Math.max(a[0], b[0]) && point.y >= Math.min(a[1], b[1]) && point.y <= Math.max(a[1], b[1])) { addRay(...a); addRay(...b); }
    }
    for (const edge of edges) {
      if (edge.a === point.netId && edge.x1 === point.x && edge.y1 === point.y) addRay(edge.x2, edge.y2);
      if (edge.b === point.netId && edge.x2 === point.x && edge.y2 === point.y) addRay(edge.x1, edge.y1);
    }
    if (directions.size >= 3) junctions.push(point);
  }
  return { crossings, junctions };
}

/**
 * Read-only layout of buildSchematicNet's output. `sources` contain actual
 * connected a/b terminals only. Every edge's x1/y1 belongs to its original a,
 * x2/y2 to b; components and sources are never reduced or reoriented electrically.
 * Wires are orthogonal [[x,y],[x,y]] segments tagged netId. Crossings must render
 * as a vertical bridge with no junction dot. Separate regions are separate
 * connected islands; wire-only nodes remain inspectable even without an edge.
 */
export function buildSchematicLayout(net, { sources = [] } = {}) {
  const output = { width: 1000, height: 250, nodes: [], edges: [], wires: [], junctions: [], crossings: [], regions: [], layout: 'empty' };
  let offsetY = 0;
  for (const island of connectedIslands(net, sources)) {
    const drawing = layoutIsland(island);
    output.regions.push({ x: 0, y: offsetY, width: drawing.width, height: drawing.height, layout: drawing.layout, nodeIds: island.nodes.map((node) => node.id) });
    output.nodes.push(...[...drawing.nodes.values()].map((node) => ({ ...node, y: node.y + offsetY })));
    output.edges.push(...drawing.edges.map((edge) => ({ ...edge, y1: edge.y1 + offsetY, y2: edge.y2 + offsetY })));
    output.wires.push(...drawing.wires.map((wire) => ({ netId: wire.netId, points: wire.points.map(([x, y]) => [x, y + offsetY]) })));
    output.width = Math.max(output.width, drawing.width); offsetY += drawing.height;
  }
  if (output.regions.length) {
    output.height = offsetY;
    const layouts = new Set(output.regions.map((region) => region.layout));
    output.layout = layouts.size === 1 ? output.regions[0].layout : 'mixed';
  }
  output.wires = segments(output.wires);
  Object.assign(output, wireDetails(output.wires, output.edges));
  return output;
}
