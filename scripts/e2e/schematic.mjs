// Real controls build an arbitrary circuit; the schematic must project that
// circuit, including mistakes, without changing its electrical state or history.
import fs from 'node:fs/promises';
import { openApp, Check } from './lib.mjs';
import { setupRC, RC_NODES } from './rc-ui.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const physical = ({ board, bb, bbWires, history, probeX, dcNow, dev, period, tau, loads }) =>
  ({ board, bb, bbWires, history, probeX, dcNow, dev, period, tau, loads });
const savedBoard = (snapshot) => ({
  parts: snapshot.bb.parts.map(({ stateId, ...part }) => part), wires: snapshot.bbWires,
});

export async function run() {
  const T = new Check('麵包板電路圖：拓撲、狀態延續與實驗存檔');
  const ui = await openApp(), p = ui.page;
  const view = (name) => p.check(`input[name="benchView"][value="${name}"]`);
  const miniScreens = () => p.locator('svg[data-mini]').evaluateAll((items) =>
    Object.fromEntries(items.map((el) => [el.dataset.mini, el.innerHTML])));
  // Trace the SVG strokes themselves, not only matching node names. Sampling
  // also follows any bridge arcs used to make an unconnected crossing clear.
  const drawing = () => p.locator('.schematic-svg').evaluate((svg) => {
    const parent = [], samples = new Map(), pins = {}, edges = {};
    const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const add = () => { const i = parent.length; parent.push(i); return i; };
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
        const p = wire.getPointAtLength(length * step / steps);
        point(id, wire.dataset.wireNode, p.x, p.y);
      }
    }
    for (const el of svg.querySelectorAll('.sc-component, .sc-source')) {
      const name = el.dataset.comp ?? el.dataset.source;
      const edge = { a: el.dataset.nodeA, b: el.dataset.nodeB,
        x1: Number(el.dataset.x1), y1: Number(el.dataset.y1), x2: Number(el.dataset.x2), y2: Number(el.dataset.y2) };
      edges[name] = edge;
      for (const [leg, net, x, y] of [['a', edge.a, edge.x1, edge.y1], ['b', edge.b, edge.x2, edge.y2]]) {
        const id = add(); pins[`${name}.${leg}`] = { id, net };
        if (Number.isFinite(x) && Number.isFinite(y)) point(id, net, x, y);
      }
    }
    return { edges, pins: Object.fromEntries(Object.entries(pins).map(([name, pin]) => [name, { net: pin.net, group: find(pin.id) }])),
      wires: svg.querySelectorAll('.sc-wire[data-wire-node]').length };
  });
  const joined = (diagram, ...pins) => pins.every((pin) => diagram.pins[pin]
    && diagram.pins[pin].net === diagram.pins[pins[0]].net && diagram.pins[pin].group === diagram.pins[pins[0]].group);
  const place = async (kind, a, b) => {
    await p.check(`input[name="bbtool"][value="${kind}"]`);
    await p.click(`[data-hole="${a}"]`); await p.click(`[data-hole="${b}"]`);
  };
  const wire = async (lead, hole) => {
    await p.click(`[data-lead="${lead}"]`); await p.click(`[data-hole="${hole}"]`);
  };
  const exportSession = async () => {
    const pending = p.waitForEvent('download'); await p.click('[data-session="export"]');
    const download = await pending;
    return JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  };
  const importSession = async (data) => {
    const pending = p.waitForEvent('filechooser'); await p.click('[data-session="import"]');
    await (await pending).setFiles({ name: 'schematic-experiment.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    await p.locator('.hintbar').filter({ hasText: '已載入實驗' }).waitFor();
  };
  try {
    const epoch = Date.now(); await p.clock.install({ time: epoch }); await p.reload();
    await p.locator('svg.panel').waitFor(); await p.clock.pauseAt(epoch + 1000);
    await ui.tab('bench');
    let b = await ui.snap('bench');
    T.ok(b.board === 'bb' && b.bbUi.view === 'breadboard' && b.bb.parts.length === 0,
      '預設只有一份空白麵包板；兩種檢視不代表兩個電路');
    T.ok(await p.locator('input[name="board"], select[name="topo"]').count() === 0,
      '固定 RC 板選擇器已移除');
    await view('schematic');
    T.ok(await p.locator('.schematic-svg .sc-component').count() === 0
      && (await p.locator('.schematic-svg').textContent()).includes('先在麵包板'), '空白板顯示空白電路圖，沒有虛構 RC 元件');
    T.ok(await p.locator('.schematic-svg .sc-source').count() === 0, '沒有接電源的空白板不會憑空出現電池');
    await view('breadboard');

    // The requested textbook example: source on the left, R1 in series with
    // two separate parallel branches, and a real wire returning to source−.
    await ui.tab('gpe');
    await p.locator('[data-id="GPE.KNOB.CH1_VOLTAGE"]').focus();
    for (let step = 0; step < 6; step++) await p.keyboard.press('ArrowUp');
    await ui.press('GPE.KEY.OUTPUT_ON_OFF'); await ui.tab('bench');
    await place('R', 'a2', 'a8'); await place('R', 'b8', 'b14'); await place('R', 'c8', 'c14');
    await wire('GPE.CH1+', 'b2'); await wire('GPE.CH1-', 'd14');
    await view('schematic');
    let diagram = await drawing();
    const source = diagram.edges['GPE.CH1'], r = diagram.edges;
    T.ok(source?.a === '2U' && source?.b === '14U' && await p.locator('.schematic-svg .sc-source').count() === 1,
      '只將實際接好的 GPE CH1 畫成電源，正負端對應原始接線');
    T.ok((await ui.snap('gpe')).vset[1] === 5
      && await p.locator('.sc-source[data-source="GPE.CH1"]').getAttribute('data-output') === 'on'
      && (await p.locator('.sc-source[data-source="GPE.CH1"]').textContent()).includes('5 V'),
      '電源符號標示真面板設定的 5 V 與 Output ON');
    T.ok(source && source.x1 === source.x2 && source.x1 < Math.min(r.R1.x1, r.R1.x2)
      && r.R1.y1 === r.R1.y2 && r.R2.x1 === r.R2.x2 && r.R3.x1 === r.R3.x2 && r.R2.x1 !== r.R3.x1,
      '電源在左、R1 水平串聯、R2 與 R3 各自垂直並聯，呈現課本式配置');
    T.ok(diagram.wires > 0 && joined(diagram, 'GPE.CH1.a', 'R1.a')
      && joined(diagram, 'R1.b', 'R2.a', 'R3.a') && joined(diagram, 'R2.b', 'R3.b', 'GPE.CH1.b'),
      'SVG 實際導線連通輸入、分支與下方回路，不只靠相同標籤表示相連');
    T.ok(await p.locator('.schematic-svg .sc-earth').count() === 0, '浮接 GPE 負端有回路導線，不冒充大地');
    await ui.shot('schematic-textbook-parallel');

    await view('breadboard'); await place('W', 'd8', 'e14'); await view('schematic');
    diagram = await drawing();
    T.ok(diagram.edges.R2.a === diagram.edges.R2.b && diagram.edges.R3.a === diagram.edges.R3.b
      && await p.locator('.schematic-svg .sc-component.shorted').count() === 2,
      '實際跨接跳線造成兩顆並聯電阻短路，圖上仍保留兩顆並標示短路');
    T.ok(joined(diagram, 'R1.b', 'R2.a', 'R2.b', 'R3.a', 'R3.b', 'GPE.CH1.b'),
      '短路後 SVG 導線按真實節點重接，不繼續顯示原本的理想分壓電路');
    await ui.shot('schematic-textbook-short');
    await view('breadboard'); await p.click('[data-history="undo"]');
    await p.click('[data-lead="GPE.CH1-"]'); await p.click('[data-lead="GPE.CH1-"]');
    await view('schematic');
    T.ok(await p.locator('.schematic-svg .sc-source').count() === 0
      && (await ui.snap('bench')).bbWires['GPE.CH1+'] === 'b2'
      && (await p.locator('.schematic-svg').textContent()).includes('GPE CH1'),
      '電源只接正端時保留該端註記，不虛構電池與未接的負端回路');
    await view('breadboard');
    await p.click('[data-lead="GPE.CH1+"]'); await p.click('[data-lead="GPE.CH1+"]');
    await view('schematic');
    T.ok(await p.locator('.schematic-svg .sc-source').count() === 0
      && await p.locator('.schematic-svg .sc-component').count() === 3,
      '拔掉電源兩端後電源符號消失，三顆實際電阻與未接回路仍保留');
    await ui.shot('schematic-textbook-disconnected');
    await view('breadboard'); await p.click('[data-bb="clear"]');

    // Parallel resistors, a grounded return through a jumper, a shorted part,
    // a disconnected capacitor, and floating negative/sense terminals.
    await place('R', 'a2', 'a6'); await place('R', 'b2', 'b6');
    await place('C', 'c6', 'c10'); await place('R', 'a20', 'c20');
    await place('C', 'f22', 'f26'); await place('W', 'd10', 'T-10');
    for (const [lead, hole] of [
      ['AFG.CH1+', 'd2'], ['AFG.CH1-', 'T-1'], ['TDS.CH1.TIP', 'e2'], ['TDS.CH1.GND', 'T-2'],
      ['TDS.CH2.TIP', 'd6'], ['TDS.CH2.GND', 'T-3'], ['DMM.HI', 'e6'], ['DMM.LO', 'e10'],
      ['GPE.CH1-', 'B-1'], ['DMM.SLO', 'B-2'],
    ]) await wire(lead, hole);
    const before = physical(await ui.snap('bench'));
    await view('schematic'); b = await ui.snap('bench');
    T.ok(same(physical(b), before), '切換電路圖保留所有元件識別碼、導線、Undo 與電氣狀態');
    const edges = await p.locator('.schematic-svg .sc-component').evaluateAll((items) =>
      Object.fromEntries(items.map((el) => [el.dataset.comp, [el.dataset.nodeA, el.dataset.nodeB, el.dataset.holeA, el.dataset.holeB]])));
    T.ok(same(edges.R1, ['2U', '6U', 'a2', 'a6']) && same(edges.R2, ['2U', '6U', 'b2', 'b6']),
      '兩顆並聯電阻各自保留，端點指向相同兩個節點及正確孔位');
    T.ok(same(edges.C1, ['6U', 'E', 'c6', 'c10']) && Object.keys(edges).length === 5,
      '跳線合併回路節點，電容接到儀器共地；五個 R/C 都在圖上');
    T.ok(same(edges.R3, ['20U', '20U', 'a20', 'c20'])
      && await p.locator('.schematic-svg .sc-component[data-comp="R3"].shorted').count() === 1,
      '兩腳同銅條的電阻仍顯示，明確標示為短路');
    T.ok(same(edges.C2, ['22L', '26L', 'f22', 'f26'])
      && (await p.locator('.schematic-svg [data-comp="C2"]').getAttribute('aria-label')).includes('空腳'),
      '未連接電容不被省略，保留兩個獨立端點與空腳提示');
    await p.locator('.sc-node[data-schematic-node="E"] .sc-node-hit').first().click();
    const ground = await p.locator('.sc-selected-node').textContent();
    await p.locator('.sc-node[data-schematic-node="B-"] .sc-node-hit').first().click();
    const floating = await p.locator('.sc-selected-node').textContent();
    const warnings = await p.locator('.side ul.warn').innerText();
    T.ok(ground.includes('GND') && ground.includes('T-10') && ground.includes('d10') && ground.includes('W1'),
      '共地節點列出上方負軌、經跳線相連的銅條與 W1');
    T.ok(!floating.includes('GND') && floating.includes('GPE CH1') && floating.includes('Sense LO')
      && floating.includes('B-1') && floating.includes('B-2'),
      'GPE 負端與 DMM Sense LO 所在負軌保持浮接，不誤畫為大地');
    T.ok(warnings.includes('R3') && warnings.includes('短路') && warnings.includes('C2') && warnings.includes('空腳'),
      '接線檢查同時顯示短路與未連接元件');

    // Editing this view must act on the same physical part and undo history.
    const r1 = b.bb.parts.find((part) => part.id === 'R1');
    await p.locator('.schematic-svg [data-comp="R1"]').click();
    await p.selectOption('select[name="bbVal"]', '2200'); b = await ui.snap('bench');
    T.ok(b.bb.parts.find((part) => part.id === 'R1')?.value === 2200
      && b.bb.parts.find((part) => part.id === 'R1')?.stateId === r1.stateId && b.history.undo === before.history.undo + 1,
      '圖上選電阻改值會修改同一實體元件，並記入共用 Undo');
    await p.click('[data-bb="delete"]');
    T.ok(!(await ui.snap('bench')).bb.parts.some((part) => part.id === 'R1')
      && await p.locator('.schematic-svg [data-comp="R1"]').count() === 0, '刪除立即同步到物理板與電路圖');
    await p.click('[data-history="undo"]');
    T.ok((await ui.snap('bench')).bb.parts.find((part) => part.id === 'R1')?.value === 2200,
      '電路圖上的 Undo 恢復剛才刪除的實體電阻');
    await p.click('[data-history="undo"]');
    T.ok((await ui.snap('bench')).bb.parts.find((part) => part.id === 'R1')?.value === 1000,
      '繼續 Undo 恢復改值前的 1 kΩ');

    await p.locator('.sc-node[data-schematic-node="E"]').first().focus(); await p.keyboard.press('Enter');
    const selected = physical(await ui.snap('bench'));
    T.ok((await ui.snap('bench')).bbUi.schematicNode === 'E'
      && (await p.locator('.sc-selected-node').innerText()).includes('d10'), '鍵盤選節點可查看跳線與元件的原始孔位');
    await p.locator('[data-schematic="edit"]').first().click();
    await p.mouse.move(0, 0);
    const highlighted = await p.locator('.bb-svg [data-hole].hl').evaluateAll((items) => items.map((el) => el.dataset.hole));
    T.ok(['a10', 'e10', 'T-1', 'T-30'].every((hole) => highlighted.includes(hole))
      && !highlighted.includes('a6') && !highlighted.includes('B-1'), '回到麵包板標亮同一節點的全部孔，包含跳線兩端且不混入浮接負軌');
    T.ok((await ui.snap('bench')).bbUi.schematicNode === 'E' && same(physical(await ui.snap('bench')), selected),
      '節點選取跨檢視保留，查看接線不消耗 Undo 或改動電路');
    await view('schematic');
    const arbitrary = await exportSession();
    T.ok(arbitrary.ui.benchView === 'schematic' && arbitrary.bench.board === 'bb', '匯出檔記錄電路圖檢視與唯一的物理麵包板');
    await view('breadboard'); await p.click('[data-bb="clear"]'); await importSession(arbitrary);
    b = await ui.snap('bench');
    T.ok(b.bbUi.view === 'schematic' && await p.locator('.schematic-svg').count() === 1
      && same(savedBoard(b), arbitrary.bench.breadboard) && b.history.undo === 0,
      '載入實驗恢復任意接線與電路圖檢視，清除上一份實驗的 Undo');

    // Pause wall time to distinguish a view change from a new physical segment.
    await setupRC(ui, { R: 100000, C: .00001 });
    await p.clock.runFor(250);
    await ui.tab('tds');
    if ((await ui.snap('tds')).run !== 'stop') await ui.press('TDS.KEY.RUN_STOP');
    const frozen = (await ui.snap('tds')).rec;
    await ui.tab('afg');
    for (const key of ['KEY.PRESET', 'KEY.CH1_CH2', 'KEY.CH1_CH2', 'SOFT.F1', 'SOFT.F2', 'KEY.AMPL', 'NUM.DIGIT_2', 'SOFT.F5', 'KEY.DC_OFFSET', 'NUM.DIGIT_2', 'SOFT.F2', 'KEY.OUTPUT']) await ui.press(`AFG.${key}`);
    await p.clock.runFor(250); await ui.tab('bench');
    const charging = physical(await ui.snap('bench'));
    const screens = await miniScreens();
    T.ok(charging.dcNow[RC_NODES.B] > .05 && charging.dcNow[RC_NODES.B] < 1.5,
      '驗收前電容正在充電，尚未達到穩態');
    await view('schematic');
    diagram = await drawing();
    T.ok(joined(diagram, 'AFG.CH1.a', 'R1.a') && joined(diagram, 'R1.b', 'C1.a')
      && joined(diagram, 'C1.b', 'AFG.CH1.b'), '實際 RC 串聯圖有輸入、電容與回到 AFG 的連續導線');
    await view('breadboard'); await view('schematic');
    T.ok(same(physical(await ui.snap('bench')), charging), '暫停時鐘後反覆切換：充電電壓、元件識別碼與編輯歷史完全不變');
    T.ok(same(await miniScreens(), screens), '暫停時鐘後四台儀器 LCD 內容完全相同，不因切換檢視重新量測');
    T.ok(frozen && same((await ui.snap('tds')).rec, frozen) && (await ui.snap('tds')).run === 'stop',
      '切換檢視與修改 AFG 都保留已停止示波器的採集紀錄');
    await p.clock.runFor(250);
    const later = await ui.snap('bench');
    T.ok(later.dcNow[RC_NODES.B] > charging.dcNow[RC_NODES.B] + .1
      && same(later.history, charging.history) && same(later.bb.parts, charging.bb.parts),
      '停留電路圖時模擬時間繼續前進，原本的電容持續充電');
    T.ok(same((await ui.snap('tds')).rec, frozen), '時間前進仍保留 Stop 的採集，不因小螢幕重畫而重取樣');

    // An old file may contain two independent boards. Migrate the active fixed
    // circuit, and expose an explicit archive swap without losing the other one.
    const legacy = structuredClone(arbitrary);
    legacy.bench.board = 'rc'; delete legacy.ui.benchView;
    Object.assign(legacy.bench.fixed, { topo: 'CR', R: 4700, C: .00000047, wires: {
      'AFG.CH1+': 'A', 'AFG.CH1-': 'G', 'TDS.CH1.TIP': 'A', 'TDS.CH1.GND': 'G',
      'TDS.CH2.TIP': 'B', 'TDS.CH2.GND': 'G', 'DMM.HI': 'B', 'DMM.LO': 'G',
    } });
    await importSession(legacy); b = await ui.snap('bench');
    T.ok(b.board === 'bb' && b.bbUi.view === 'breadboard'
      && b.bb.parts.some((part) => part.kind === 'C' && part.a === 'b8' && part.b === 'b12' && part.value === .00000047)
      && b.bb.parts.some((part) => part.kind === 'R' && part.a === 'a12' && part.b === 'T-12' && part.value === 4700),
      '舊 CR 實驗以原拓撲及數值轉成可編輯麵包板');
    T.ok((await ui.hint()).includes('備存') && await p.locator('[data-schematic="archive"]').count() === 1,
      '舊檔另一份接線有明確的備存提示與切換入口');
    const migrated = savedBoard(b);
    await p.click('[data-schematic="archive"]');
    T.ok(same(savedBoard(await ui.snap('bench')), arbitrary.bench.breadboard), '切換備存找回原本的任意麵包板接線');
    const archived = await exportSession();
    T.ok(same(archived.bench.breadboardArchive, migrated), '再次匯出仍保留剛轉換的 CR 板，不因切換丟失');
    await p.click('[data-schematic="archive"]');
    T.ok(same(savedBoard(await ui.snap('bench')), migrated), '備存可雙向切換，兩份接線均可取回');
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}

if (process.argv[1]?.endsWith('/schematic.mjs')) { const T = await run(); T.print(); if (T.fail) process.exitCode = 1; }
