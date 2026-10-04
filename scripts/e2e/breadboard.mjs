// 實驗台麵包板真 UI：切到麵包板 → 擺電阻／電容／跳線 → 滑過孔看同組高亮 → 選取改值、刪除 → 接導線、拔線 →
// 鍵盤操作 → 兩個示範 → 清空 → 切回 RC 板。只用真點擊／按鍵／選單操作；__eess 只讀狀態做斷言。
// 這一輪只驗結構與操作（元件、孔、netlist），不驗電壓：麵包板的電路計算另外接上。
import { openApp, Check, sleep } from './lib.mjs';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const partDetails = ({ stateId, ...part }) => part;

export async function run() {
  const T = new Check('實驗台麵包板：插元件、接導線');
  const ui = await openApp();
  const p = ui.page;
  const hole = async (h) => { await p.click(`[data-hole="${h}"]`); await sleep(15); };
  const place = async (a, b) => { await hole(a); await hole(b); };
  const tool = async (t) => { await p.click(`input[name="bbtool"][value="${t}"]`); await sleep(15); };
  const lead = async (id) => { await p.click(`[data-lead="${id}"]`); await sleep(15); };
  // 點元件本體：真滑鼠點在兩隻腳所在孔的正中間（元件的外框含標籤，中心不一定在本體上）
  const clickBody = async (a, b) => {
    const [A, B] = await Promise.all([a, b].map((h) => p.locator(`[data-hole="${h}"] .h`).boundingBox()));
    await p.mouse.click((A.x + A.width / 2 + B.x + B.width / 2) / 2, (A.y + A.height / 2 + B.y + B.height / 2) / 2); await sleep(15);
  };
  const snap = () => ui.snap('bench');
  const has = (sel, cls) => p.locator(sel).evaluate((el, c) => el.classList.contains(c), cls);
  const hoverHl = async (h, on, off) => {
    await p.hover(`[data-hole="${h}"]`); await sleep(20);
    const a = await Promise.all(on.map((x) => has(`[data-hole="${x}"]`, 'hl')));
    const b = await Promise.all(off.map((x) => has(`[data-hole="${x}"]`, 'hl')));
    return a.every(Boolean) && !b.some(Boolean);
  };
  try {
    // 0. 預設仍是固定 RC 板；先在 RC 板接一條線，之後確認換板子不會弄丟
    await ui.tab('bench');
    let s = await snap();
    T.ok(s.board === 'rc' && await p.locator('[data-node="A"]').count() === 1 && await p.locator('.bb-svg').count() === 0, '預設是固定 RC 板（接點 A／B／G）');
    await lead('AFG.CH1+'); await p.click('[data-node="A"]');

    // 1. 側欄最上面切到麵包板
    await p.click('input[name="board"][value="bb"]');
    s = await snap();
    T.ok(s.board === 'bb' && await p.locator('.bb-svg [data-hole]').count() === 420, '切到麵包板：300 個主區孔＋120 個電源軌孔');
    T.ok(await p.locator('.bb-svg [data-lead]').count() === 22 && await p.locator('.bb-svg [data-goto]').count() === 4 && await p.locator('svg[data-mini="gpe"]').count() === 1,
      '22 個導線端（含 DMM Sense HI／LO、I 3A、GPE 四路）與四台小螢幕');

    // 2. 電阻：點 a5（標示第一隻腳）→ 點 a9
    await tool('R');
    await hole('a5');
    T.ok((await snap()).bbUi.first === 'a5' && await has('[data-hole="a5"]', 'first'), '點第一個孔：記住並標示第一隻腳');
    await hole('a9');
    s = await snap();
    T.ok(same(s.bb.parts.map(partDetails), [{ id: 'R1', kind: 'R', a: 'a5', b: 'a9', value: 1000 }]) && typeof s.bb.parts[0].stateId === 'string' && (await ui.hint()).includes('R1'), '再點 a9：擺上 R1（預設 1 kΩ）');

    // 3. 一孔一物：電容的第一隻腳點在 R1 的腳上 → 拒絕；跨中間溝擺 C1（e9–f9）
    await tool('C');
    await hole('a9');
    T.ok((await snap()).bbUi.first === null && (await ui.hint()).includes('已經插了'), '孔已被 R1 佔用：拒絕並說明');
    await place('e9', 'f9');
    s = await snap();
    T.ok(same(partDetails(s.bb.parts[1]), { id: 'C1', kind: 'C', a: 'e9', b: 'f9', value: 1e-7 }), '電容 C1（預設 100 nF）跨中間溝插在 e9–f9');
    await place('j9', 'j9');
    T.ok((await snap()).bbUi.first === null && (await snap()).bb.parts.length === 2, '同一個孔再點一次＝取消，不會擺兩腳同孔的元件');

    // 4. 新電阻的值改 2.2 kΩ；兩腳插同一欄 → 短路警告
    await p.locator('select[name="bbR"]').selectOption('2200');
    await tool('R');
    await place('b12', 'd12');
    s = await snap();
    const r2 = s.bb.parts.find((x) => x.id === 'R2');
    T.ok(r2?.value === 2200 && s.bb.warnings.some((w) => w.level === 'bad' && w.text.includes('R2') && w.text.includes('12U')), 'R2（2.2 kΩ）兩腳都在第 12 欄 a–e：短路警告');
    T.ok((await p.locator('.side ul.warn').innerText()).includes('R2'), '側欄狀況列出警告');

    // 5. 跳線：j9 → 下方−軌 B-9；C1 下面那隻腳併入 B-
    await tool('W');
    await place('j9', 'B-9');
    s = await snap();
    const c1 = s.bb.elements.find((x) => x.id === 'C1');
    T.ok(s.bb.parts.some((x) => x.id === 'W1' && x.a === 'j9' && x.b === 'B-9') && c1.a === '9U' && c1.b === 'B-' && !s.bb.elements.some((x) => x.id === 'W1'),
      '跳線 W1 把第 9 欄 f–j 併入 B-（C1：9U–B-），跳線不算元件');

    // 6. 滑鼠移到孔上：同一節點的孔都亮起來
    T.ok(await hoverHl('a5', ['b5', 'e5', 'a5'], ['f5', 'a6', 'a4']), '滑到 a5：第 5 欄 a–e 都亮，f5、隔壁欄不亮');
    T.ok(await hoverHl('g9', ['f9', 'j9', 'B-1', 'B-30'], ['e9', 'B+9', 'T-9']), '滑到 g9：經跳線連到的整條 B- 軌也亮');
    T.ok(await hoverHl('T+3', ['T+1', 'T+30'], ['T-3', 'a3']), '滑到 T+3：整條上方＋軌都亮');
    await ui.shot('breadboard-hover');

    // 7. 選取工具：點 R2 選取 → 側欄改值 → Delete 刪除
    await tool('select');
    await clickBody('b12', 'd12');
    s = await snap();
    T.ok(s.bbUi.sel === 'R2' && await has('[data-comp="R2"]', 'sel') && await p.locator('select[name="bbVal"]').count() === 1, '點 R2 本體：選取（醒目外框），側欄出現改值選單');
    await p.locator('select[name="bbVal"]').selectOption('4700');
    T.ok((await snap()).bb.parts.find((x) => x.id === 'R2').value === 4700, '側欄改值：R2 變 4.7 kΩ');
    await p.keyboard.press('Delete');
    s = await snap();
    T.ok(!s.bb.parts.some((x) => x.id === 'R2') && s.bbUi.sel === null && !s.bb.warnings.some((w) => w.level === 'bad'), '按 Delete：R2 拿掉，短路警告消失');
    await clickBody('j9', 'B-9');
    await p.click('[data-bb="delete"]');
    s = await snap();
    T.ok(!s.bb.parts.some((x) => x.id === 'W1') && s.bb.elements.find((x) => x.id === 'C1').b === '9L', '選 W1 按側欄「刪除」：跳線拿掉，C1 那隻腳回到 9L');

    // 8. 導線：點導線端 → 點孔；被佔用的孔拒絕；已接的導線端選取後再點一次＝拔掉
    await lead('DMM.HI');
    T.ok((await snap()).sel === 'DMM.HI' && await has('[data-lead="DMM.HI"]', 'sel'), '點電表 HI：選取（變藍）');
    await hole('a5');
    s = await snap();
    T.ok(!s.bbWires['DMM.HI'] && (await ui.hint()).includes('已經插了'), '插到 R1 腳的孔：拒絕');
    await hole('b5');
    s = await snap();
    T.ok(s.bbWires['DMM.HI'] === 'b5' && s.bb.leads['DMM.HI'] === '5U' && s.sel === null, '電表 HI 插到 b5（節點 5U）');
    T.ok((await ui.snap('dmm')).fixture === 'bench', '接上電表測試線：電表自動改用實驗台來源');
    await lead('DMM.LO'); await hole('B-2');
    await lead('DMM.LO'); await lead('DMM.LO');
    s = await snap();
    T.ok(!s.bbWires['DMM.LO'] && s.bbWires['DMM.HI'] === 'b5', '電表 LO 插上後，選取再點一次＝拔掉');
    // GPE 同一路＋、−插在同一條軌 → 電源短路；把−移到藍色軌就好了
    await lead('GPE.CH1+'); await hole('T+1');
    await lead('GPE.CH1-'); await hole('T+2');
    T.ok((await snap()).bb.warnings.some((w) => w.level === 'bad' && w.text.includes('GPE CH1')), 'GPE CH1 ＋、−都插上方＋軌：電源短路警告');
    await lead('GPE.CH1-'); await hole('T-2');
    s = await snap();
    T.ok(s.bbWires['GPE.CH1-'] === 'T-2' && !s.bb.warnings.some((w) => w.text.includes('GPE')), '把 GPE CH1 −移到藍色−軌：警告消失');
    await ui.shot('breadboard-wired');

    // 9. 鍵盤：孔、導線端聚焦後 Enter／空白鍵＝點擊
    await tool('R');
    await p.focus('[data-hole="c20"]'); await p.keyboard.press('Enter');
    await p.focus('[data-hole="c24"]'); await p.keyboard.press(' ');
    T.ok((await snap()).bb.parts.some((x) => x.kind === 'R' && x.a === 'c20' && x.b === 'c24'), '鍵盤：孔聚焦後 Enter／空白鍵擺上電阻');
    await p.focus('[data-lead="TDS.CH1.TIP"]'); await p.keyboard.press('Enter');
    await p.focus('[data-hole="e20"]'); await p.keyboard.press('Enter');
    T.ok((await snap()).bbWires['TDS.CH1.TIP'] === 'e20' && (await ui.snap('tds')).scenario === 'BENCH', '鍵盤接上示波器探棒：示波器自動改用實驗台來源');

    // 10. 示範「RC 低通」：先清空再擺；netlist 符合 AFG → R → C 到地、CH1 量輸入、CH2 量電容、電表跨電容
    //     （先把示波器、電表切回單機情境，確認示範會把兩台切到實驗台）
    await ui.tab('tds'); await p.click('input[name="scen"][value="S1"]');
    await ui.tab('dmm'); await p.click('input[name="scen"][value="none"]');
    T.ok((await ui.snap('tds')).scenario === 'S1' && (await ui.snap('dmm')).fixture === 'none', '示波器、電表先切回單機情境');
    await ui.tab('bench');
    const previousStateIds = new Set((await snap()).bb.parts.map((part) => part.stateId));
    await p.click('[data-bb="demo-rc"]');
    s = await snap();
    let L = s.bb.leads;
    T.ok(same(s.bb.elements.map(partDetails), [{ id: 'R1', kind: 'R', a: '8U', b: '12U', value: 1000 }, { id: 'C1', kind: 'C', a: '12U', b: 'T-', value: 1e-7 }]) && s.bb.parts.length === 2,
      `示範 RC：只剩 R1（8U–12U）、C1（12U–T-）（${JSON.stringify(s.bb.elements)}）`);
    T.ok(s.bb.parts.every((part) => typeof part.stateId === 'string' && !previousStateIds.has(part.stateId))
      && s.bb.elements.every((el) => el.stateId === s.bb.parts.find((part) => part.id === el.id)?.stateId), '示範替換建立新的元件識別碼並傳入 netlist');
    T.ok(L['AFG.CH1+'] === '8U' && L['TDS.CH1.TIP'] === '8U' && L['TDS.CH2.TIP'] === '12U' && L['DMM.HI'] === '12U'
      && ['AFG.CH1-', 'TDS.CH1.GND', 'TDS.CH2.GND', 'DMM.LO'].every((id) => L[id] === 'T-') && Object.keys(L).length === 8,
    '示範 RC：輸入 8U、電容 12U、地都在藍色−軌 T-；舊導線都拔掉');
    T.ok(s.bb.warnings.length === 0 && same(s.bb.nodes, ['T-', '8U', '12U']), '示範 RC：沒有擺放警告');
    T.ok((await ui.snap('tds')).scenario === 'BENCH' && (await ui.snap('dmm')).fixture === 'bench', '示範 RC：示波器與電表都切到實驗台來源');
    await ui.shot('breadboard-demo-rc');

    // 11. 示範「GPE 分壓」
    const rcStateIds = new Set(s.bb.parts.map((part) => part.stateId));
    await p.click('[data-bb="demo-gpe"]');
    s = await snap();
    L = s.bb.leads;
    T.ok(same(s.bb.elements.map(partDetails), [{ id: 'R1', kind: 'R', a: 'B+', b: '22L', value: 1000 }, { id: 'R2', kind: 'R', a: '22L', b: 'B-', value: 1000 }]),
      `示範 GPE：R1（B+–22L）、R2（22L–B-）串聯（${JSON.stringify(s.bb.elements)}）`);
    T.ok(s.bb.parts.every((part) => !rcStateIds.has(part.stateId)), '再換示範也不重用 RC 元件識別碼');
    T.ok(same(L, { 'GPE.CH1+': 'B+', 'GPE.CH1-': 'B-', 'DMM.HI': '22L', 'DMM.LO': 'B-' }) && s.bb.warnings.length === 0, '示範 GPE：CH1 ＋接 B+、−接 B-，電表跨 R2');
    T.ok(await hoverHl('j18', ['f18', 'B+1', 'B+30'], ['B-1', 'e18']), '示範 GPE：滑到 j18 看到跳線把第 18 欄接到＋軌');
    await ui.shot('breadboard-demo-gpe');

    // 12. 小螢幕點一下切到 GPE 面板；回來麵包板還在
    await p.click('[data-goto="gpe"]');
    T.ok(await p.evaluate(() => window.__eess.current()) === 'gpe', '點 GPE 小螢幕：切到 GPE 面板');
    await ui.tab('bench');
    s = await snap();
    T.ok(s.board === 'bb' && s.bb.parts.length === 4 && await p.locator('.bb-svg').count() === 1, '回到實驗台：仍是麵包板、元件都在');

    // 13. 清空；切回 RC 板，RC 板的接線還在
    await p.click('[data-bb="clear"]');
    s = await snap();
    T.ok(s.bb.parts.length === 0 && Object.keys(s.bbWires).length === 0, '清空麵包板：元件拿掉、導線拔掉');
    await p.click('input[name="board"][value="rc"]');
    s = await snap();
    T.ok(s.board === 'rc' && s.wires['AFG.CH1+'] === 'A' && await p.locator('[data-node="A"]').count() === 1 && await p.locator('.bb-svg').count() === 0, '切回固定 RC 板：RC 板的接線還在');
    T.ok(ui.errors.length === 0, `沒有 JS 錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally {
    await ui.close();
  }
  return T;
}
