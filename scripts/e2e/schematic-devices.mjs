// Instrument branches and electrical warnings must match the real breadboard.
// All changes use visible controls; snapshots only inspect the physical result.
import { openApp, Check } from './lib.mjs';
import { setupRC, unplugRC } from './rc-ui.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const physical = ({ board, bb, bbWires, history, probeX, dcNow, dev, period, tau, loads }) =>
  ({ board, bb, bbWires, history, probeX, dcNow, dev, period, tau, loads });

export async function run() {
  const T = new Check('電路圖：儀器共地、電流支路與電路警告');
  const ui = await openApp(), p = ui.page;
  const view = (name) => p.check(`input[name="benchView"][value="${name}"]`);
  const wire = async (lead, hole) => { await p.click(`[data-lead="${lead}"]`); await p.click(`[data-hole="${hole}"]`); };
  const warnings = () => p.locator('.side ul.warn li').allTextContents();
  const unchangedState = async () => {
    const b = await ui.snap('bench'), t = await ui.snap('tds'), a = await ui.snap('afg'), d = await ui.snap('dmm'), g = await ui.snap('gpe');
    return { bench: physical(b), scope: { run: t.run, rec: t.rec, acqN: t.acqN },
      afg: { on: a.on, ch: a.ch }, dmm: { on: d.on, fn: d.fn, per: d.per, run: d.run },
      gpe: { on: g.on, output: g.output, vset: g.vset, iset: g.iset } };
  };
  // Follow visible wire strokes, so terminal labels alone cannot pass the loop check.
  const drawing = () => p.locator('.schematic-svg').evaluate((svg) => {
    const parent = [], samples = new Map(), pins = {}, edges = {};
    const find = (id) => parent[id] === id ? id : (parent[id] = find(parent[id]));
    const add = () => { const id = parent.length; parent.push(id); return id; };
    const point = (id, net, x, y) => {
      const gx = Math.round(x), gy = Math.round(y);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const other of samples.get(`${net}:${gx + dx}:${gy + dy}`) ?? []) {
          if (Math.hypot(other.x - x, other.y - y) < 1.1) parent[find(id)] = find(other.id);
        }
      }
      const key = `${net}:${gx}:${gy}`;
      if (!samples.has(key)) samples.set(key, []);
      samples.get(key).push({ id, x, y });
    };
    for (const wire of svg.querySelectorAll('.sc-wire[data-wire-node]')) {
      const id = add(), length = wire.getTotalLength(), steps = Math.max(1, Math.ceil(length));
      for (let step = 0; step <= steps; step++) {
        const position = wire.getPointAtLength(length * step / steps);
        point(id, wire.dataset.wireNode, position.x, position.y);
      }
    }
    for (const el of svg.querySelectorAll('.sc-component, .sc-source, .sc-meter')) {
      const id = el.dataset.comp ?? el.dataset.source ?? el.dataset.device;
      const edge = { a: el.dataset.nodeA, b: el.dataset.nodeB, leadA: el.dataset.leadA, leadB: el.dataset.leadB,
        active: el.dataset.active, output: el.dataset.output, return: el.dataset.return, text: el.textContent,
        glyph: el.querySelector('.sc-meter-glyph')?.textContent, shunt: Number(el.dataset.shunt),
        x1: Number(el.dataset.x1), y1: Number(el.dataset.y1), x2: Number(el.dataset.x2), y2: Number(el.dataset.y2) };
      edges[id] = edge;
      for (const [leg, net, x, y] of [['a', edge.a, edge.x1, edge.y1], ['b', edge.b, edge.x2, edge.y2]]) {
        const index = add(); pins[`${id}.${leg}`] = { id: index, net };
        if (Number.isFinite(x) && Number.isFinite(y)) point(index, net, x, y);
      }
    }
    return { edges, pins: Object.fromEntries(Object.entries(pins).map(([id, pin]) => [id, { net: pin.net, group: find(pin.id) }])) };
  });
  const joined = (diagram, a, b) => diagram.pins[a] && diagram.pins[b]
    && diagram.pins[a].net === diagram.pins[b].net && diagram.pins[a].group === diagram.pins[b].group;

  try {
    const epoch = Date.now(); await p.clock.install({ time: epoch }); await p.reload();
    await p.locator('svg.panel').waitFor(); await p.clock.pauseAt(epoch + 1000);
    await setupRC(ui);
    await ui.tab('afg');
    for (const key of ['KEY.CH1_CH2', 'KEY.CH1_CH2', 'SOFT.F1', 'SOFT.F2', 'KEY.AMPL', 'NUM.DIGIT_2', 'SOFT.F5', 'KEY.OUTPUT']) await ui.press(`AFG.${key}`);
    await ui.tab('dmm'); await ui.press('DMM.KEY.ACV'); await p.clock.runFor(500);
    await unplugRC(ui, 'AFG.CH1-'); await p.clock.runFor(250);
    let b = await ui.snap('bench');
    T.ok(!b.bbWires['AFG.CH1-'] && b.bbWires['TDS.CH1.GND'] && b.bbWires['TDS.CH2.GND'], '拔掉 AFG 黑夾後，示波器接地夾仍提供實際共地回路');
    T.near((await ui.snap('dmm')).view.value, 0.5902299, .001, '只有 AFG 紅夾與示波器共地，RC 仍量到約 0.59 Vrms');
    await ui.tab('tds'); await ui.press('TDS.KEY.RUN_STOP');
    await ui.tab('bench');
    const sourceState = await unchangedState();
    await view('schematic');
    let diagram = await drawing(), source = diagram.edges['AFG.CH1'];
    T.ok(source?.a === '8U' && source?.b === 'E' && source?.output === 'on', '原理圖仍有作用中的 AFG CH1，紅夾接輸入、內部回線接大地');
    T.ok(source?.return === 'earth' && source?.leadB === '' && source?.text.includes('黑夾未接') && source?.text.includes('共地'), '清楚註明黑夾未接與共地回路，不虛構已插上的黑夾');
    T.ok(same(await unchangedState(), sourceState), '切換共地電路的視圖不更動元件、電荷、儀器、停止紀錄或 Undo');
    await ui.shot('schematic-afg-shared-earth');

    await view('breadboard'); await p.click('[data-bb="demo-current"]');
    await ui.tab('gpe');
    await p.locator('[data-id="GPE.KNOB.CH1_VOLTAGE"]').focus();
    for (let step = 0; step < 6; step++) await p.keyboard.press('ArrowUp');
    await ui.press('GPE.KEY.OUTPUT_ON_OFF'); await p.clock.runFor(500);
    const supply = await ui.snap('gpe'), expectedCurrent = supply.vset[1] / (1000 + 5 + .01);
    T.near((await ui.snap('dmm')).view.value, expectedCurrent, 1e-7, '串接電流示範的實際電流包含 1 kΩ、5 Ω 分流與電源內阻');
    await ui.tab('bench'); const currentState = await unchangedState();
    await view('schematic'); diagram = await drawing();
    const meter = diagram.edges['DMM.I-LO'];
    T.ok(meter?.a === '18L' && meter?.b === 'B-' && meter?.active === 'true'
      && meter?.leadA === 'DMM.I' && meter?.leadB === 'DMM.LO' && meter?.glyph === 'A' && meter?.shunt === 5, '電路圖將 I–LO 畫成有明確正反端與 5 Ω 負擔的電流表支路');
    T.ok(joined(diagram, 'GPE.CH1.a', 'R1.a') && joined(diagram, 'R1.b', 'DMM.I-LO.a')
      && joined(diagram, 'DMM.I-LO.b', 'GPE.CH1.b'), '可沿實際 SVG 導線走完 GPE → R1 → 電流表 → GPE 的閉合迴路');
    T.ok(same(await unchangedState(), currentState), '畫出電流表不改實體分流、測量狀態、停止紀錄或 Undo');
    await ui.shot('schematic-current-loop');

    await ui.tab('dmm'); await ui.press('DMM.KEY.DCV'); await p.clock.runFor(250);
    await ui.tab('bench'); diagram = await drawing();
    T.ok(diagram.edges['DMM.I-LO']?.active === 'false' && diagram.edges['DMM.I-LO']?.text.includes('Ω'), '改用 DCV 後，仍畫出真實存在的 I–LO 被動分流及阻值');
    T.near((await ui.snap('gpe')).readback[1].i, expectedCurrent, 1e-7, 'DCV 模式不會把電流端支路移除而改變電路');
    await ui.tab('dmm'); await ui.press('DMM.PWR.POWER'); await p.clock.runFor(250);
    await ui.tab('bench'); diagram = await drawing();
    T.ok(diagram.edges['DMM.I-LO']?.active === 'false'
      && joined(diagram, 'R1.b', 'DMM.I-LO.a') && joined(diagram, 'DMM.I-LO.b', 'GPE.CH1.b'), '電表關機後，被動分流仍保持可見且兩端接入原迴路');
    T.near((await ui.snap('gpe')).readback[1].i, expectedCurrent, 1e-7, '電表關機仍保留相同負擔電流');

    await ui.tab('dmm'); await ui.press('DMM.PWR.POWER');
    await ui.tab('bench'); await view('breadboard'); await p.click('[data-bb="demo-current"]');
    await wire('DMM.I', 'B+27'); await p.clock.runFor(250);
    b = await ui.snap('bench'); const boardWarnings = await warnings(), warningState = await unchangedState();
    T.ok(b.warn.some((warning) => warning.includes('直接並接在電源兩端'))
      && boardWarnings.some((warning) => warning.includes('直接並接在電源兩端')), '錯把 I–LO 並聯電源時，麵包板顯示電路求解器的錯接警告');
    await view('schematic'); const schematicWarnings = await warnings();
    T.ok(boardWarnings.every((warning) => schematicWarnings.includes(warning)), '切原理圖完整保留麵包板的電路警告，不只顯示元件空腳');
    T.ok(schematicWarnings.some((warning) => warning.includes('直接並接在電源兩端'))
      && !schematicWarnings.some((warning) => warning.includes('未發現元件短路或空腳')), '原理圖明示電流端並接電源的問題，不以正常訊息掩蓋');
    T.ok(same(await unchangedState(), warningState), '檢視電路警告不改電荷、儀器或停止紀錄，也不新增 Undo');
    await ui.shot('schematic-current-warning');
    await view('breadboard');
    const returnedWarnings = await warnings();
    T.ok(same(await unchangedState(), warningState) && boardWarnings.every((warning) => returnedWarnings.includes(warning)), '切回麵包板保留同一份錯接電路、警告與歷史');
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally { await ui.close(); }
  return T;
}
