// RC circuit setup through the same physical breadboard controls students use.
// Snapshots/DOM metadata are read only, solely to choose an unoccupied hole.
export const RC_NODES = Object.freeze({ A: '8U', B: '12U', G: 'T-' });

async function breadboard(ui) {
  await ui.tab('bench');
  await ui.page.check('input[name="benchView"][value="breadboard"]');
}

export async function setRCValue(ui, kind, value) {
  await breadboard(ui);
  await ui.page.check('input[name="bbtool"][value="select"]');
  await ui.page.locator(`[data-comp="${kind}1"] > g rect`).first().click();
  await ui.page.selectOption('select[name="bbVal"]', String(value));
}

export async function unplugRC(ui, lead) {
  await breadboard(ui);
  const snapshot = await ui.snap('bench');
  if (!snapshot.bbWires[lead]) return;
  if (snapshot.sel !== lead) await ui.page.click(`[data-lead="${lead}"]`);
  await ui.page.click(`[data-lead="${lead}"]`);
}

export async function wireRC(ui, lead, node) {
  await breadboard(ui);
  const snapshot = await ui.snap('bench');
  const occupied = new Set([
    ...snapshot.bb.parts.flatMap((part) => [part.a, part.b]),
    ...Object.entries(snapshot.bbWires).filter(([id]) => id !== lead).map(([, hole]) => hole),
  ]);
  const holes = await ui.page.locator(`[data-hole][data-net="${RC_NODES[node] ?? node}"]`).evaluateAll((items) => items.map((item) => item.dataset.hole));
  const hole = holes.find((candidate) => !occupied.has(candidate));
  if (!hole) throw new Error(`No free physical hole at RC node ${node} for ${lead}`);
  if (snapshot.sel !== lead) await ui.page.click(`[data-lead="${lead}"]`);
  await ui.page.click(`[data-hole="${hole}"]`);
  return hole;
}

export async function setRCTopology(ui, topo) {
  if (!['RC', 'CR'].includes(topo)) throw new Error(`Unknown RC topology: ${topo}`);
  await breadboard(ui);
  const snapshot = await ui.snap('bench');
  const resistor = snapshot.bb.parts.find((part) => part.id === 'R1');
  const capacitor = snapshot.bb.parts.find((part) => part.id === 'C1');
  if (!resistor || !capacitor) throw new Error('RC demo components are required');
  const desired = topo === 'RC' ? { R: ['b8', 'b12'], C: ['a12', 'T-12'] } : { C: ['b8', 'b12'], R: ['a12', 'T-12'] };
  if ([resistor, capacitor].every((part) => part.a === desired[part.kind][0] && part.b === desired[part.kind][1])) return;
  await ui.page.check('input[name="bbtool"][value="select"]');
  for (const part of [resistor, capacitor]) {
    await ui.page.locator(`[data-comp="${part.id}"] > g rect`).first().click();
    await ui.page.click('[data-bb="delete"]');
  }
  for (const part of [resistor, capacitor]) {
    await ui.page.check(`input[name="bbtool"][value="${part.kind}"]`);
    await ui.page.selectOption(`select[name="bb${part.kind}"]`, String(part.value));
    for (const hole of desired[part.kind]) await ui.page.click(`[data-hole="${hole}"]`);
  }
  await ui.page.check('input[name="bbtool"][value="select"]');
}

export async function setupRC(ui, { R = 1000, C = 1e-7, topo = 'RC', wired = true } = {}) {
  await breadboard(ui);
  await ui.page.click('[data-bb="demo-rc"]');
  if (R !== 1000) await setRCValue(ui, 'R', R);
  if (C !== 1e-7) await setRCValue(ui, 'C', C);
  if (topo !== 'RC') await setRCTopology(ui, topo);
  if (!wired) {
    for (const lead of Object.keys((await ui.snap('bench')).bbWires)) await unplugRC(ui, lead);
  }
}
