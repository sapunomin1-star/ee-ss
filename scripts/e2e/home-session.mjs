// 在家接續實驗：真操作設定、重新整理、匯出／載入與失敗時保留現況。
import fs from 'node:fs/promises';
import { openApp, Check } from './lib.mjs';

const STORAGE = 'ee-ss.session.v1';
export async function run() {
  const T = new Check('在家實驗：保存與載入');
  const ui = await openApp(), p = ui.page;
  const doc = () => p.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE);
  const saved = () => p.locator('.save-status').filter({ hasText: '已自動保存' }).waitFor();
  const digits = async (n) => {
    for (const c of String(n)) await ui.press(c === '.' ? 'AFG.NUM.DOT' : `AFG.NUM.DIGIT_${c}`);
  };
  const upload = async (content, name = 'experiment.json') => {
    const chooser = p.waitForEvent('filechooser');
    await p.click('[data-session="import"]');
    await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });
  };
  const hintIs = (text) => p.locator('.hintbar').filter({ hasText: text }).waitFor();
  try {
    await ui.press('AFG.KEY.FREQ_RATE'); await digits(3.5); await ui.press('AFG.SOFT.F4');
    await ui.press('AFG.KEY.AMPL'); await digits(2); await ui.press('AFG.SOFT.F5');
    await ui.press('AFG.KEY.OUTPUT');
    await ui.tab('bench');
    await p.click('[data-bench="demo"]');
    await p.selectOption('select[name="R"]', '47000');
    await p.selectOption('select[name="C"]', '0.000001');
    await p.selectOption('select[name="px1"]', '1');
    await p.check('input[name="board"][value="bb"]');
    await p.click('[data-bb="demo-gpe"]');
    await p.check('input[name="bbtool"][value="C"]');
    await p.click('[data-hole="f22"]'); await p.click('[data-hole="f26"]');
    await ui.tab('gpe');
    await p.locator('[data-id="GPE.KNOB.CH1_VOLTAGE"]').focus();
    await p.keyboard.press('ArrowUp');
    await ui.press('GPE.KEY.OUTPUT_ON_OFF');
    await ui.tab('dmm');
    await p.check('input[name="scen"][value="dcv"]');
    await ui.press('DMM.KEY.RANGE'); await ui.press('DMM.KEY.NULL');
    await ui.tab('tds');
    await p.check('input[name="scen"][value="S2"]');
    await ui.press('TDS.KEY.AUTOSET'); await ui.press('TDS.KEY.RUN_STOP');
    await ui.tab('bench');
    await p.click('[data-zoom="1"]');
    await saved();
    const before = await doc();
    const [a, d, g, t, b] = await Promise.all(['afg', 'dmm', 'gpe', 'tds', 'bench'].map(ui.snap));
    T.ok(before?.format === 'ee-ss-session' && before.version === 1, '自動保存版本化實驗檔');

    await p.reload(); await saved();
    const after = await doc();
    T.ok(JSON.stringify(after) === JSON.stringify(before), '重新整理完整保留固定板、麵包板、探棒、四機設定與視窗設定');
    const [a2, d2, g2, t2, b2] = await Promise.all(['afg', 'dmm', 'gpe', 'tds', 'bench'].map(ui.snap));
    T.ok(a2.ch[0].freq === a.ch[0].freq && a2.ch[0].output === a.ch[0].output, 'AFG 頻率與 Output 正確還原');
    T.ok(d2.fn === d.fn && d2.auto === d.auto && JSON.stringify(d2.per) === JSON.stringify(d.per), 'DMM 功能、量程與 Null 正確還原');
    T.ok(JSON.stringify(g2.vset) === JSON.stringify(g.vset) && g2.output === g.output, 'GPE 電壓設定與 Output 正確還原');
    T.ok(t2.run === 'stop' && t2.sdiv === t.sdiv && t2.rec != null, 'TDS Stop 還原後從新配置採集再凍結');
    T.ok(b2.board === 'bb' && Object.keys(b2.bbWires).length === Object.keys(b.bbWires).length
      && Object.entries(b.bbWires).every(([id, hole]) => b2.bbWires[id] === hole)
      && b2.bb.parts.length === b.bb.parts.length, '麵包板元件與每條導線正確還原');
    T.ok((await ui.hint()).includes('電容從 0 V'), '還原提示明示重新開始模擬');

    const download = p.waitForEvent('download');
    await p.click('[data-session="export"]');
    const file = await download;
    const exported = await fs.readFile(await file.path(), 'utf8');
    T.ok(JSON.stringify(JSON.parse(exported)) === JSON.stringify(after), '匯出實驗檔與目前設定相同');
    await ui.tab('afg');
    await ui.press('AFG.KEY.FREQ_RATE'); await digits(9); await ui.press('AFG.SOFT.F4');
    T.ok((await ui.snap('afg')).ch[0].freq === 9000, '載入前確實改變目前設定');
    await upload(exported); await hintIs('已載入實驗'); await saved();
    T.ok(JSON.stringify(await doc()) === JSON.stringify(after), '從匯出檔還原原實驗設定');

    for (const [name, content] of [['壞JSON', '{invalid'], ['未知版本', JSON.stringify({ ...after, version: 999 })]]) {
      const keep = JSON.stringify(await doc());
      await upload(content); await hintIs('沒有載入實驗');
      T.ok(JSON.stringify(await doc()) === keep && (await ui.snap('afg')).ch[0].freq === 3500, `${name}：拒絕且保留現有接線與設定`);
    }
    await upload(' '.repeat(4 * 1024 * 1024 + 1)); await hintIs('超過 4 MB');
    T.ok((await ui.snap('afg')).ch[0].freq === 3500, '超大檔案拒絕且保留現況');
    await ui.shot('home-session-restored');

    // 私密瀏覽／政策禁止 storage 時，仍可手動匯出，且操作不崩潰。
    await p.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('storage disabled'); };
      Storage.prototype.setItem = () => { throw new Error('storage disabled'); };
    });
    await p.reload();
    await p.locator('.save-status').filter({ hasText: '無法自動保存' }).waitFor();
    await ui.press('AFG.KEY.FREQ_RATE'); await digits(2); await ui.press('AFG.SOFT.F4');
    const fallbackDownload = p.waitForEvent('download');
    await p.click('[data-session="export"]');
    const fallback = await fallbackDownload;
    T.ok(JSON.parse(await fs.readFile(await fallback.path(), 'utf8')).version === 1 && (await ui.snap('afg')).ch[0].freq === 2000, '自動保存不可用時可繼續操作並匯出');
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤${ui.errors.length ? `：${ui.errors.join('; ')}` : ''}`);
  } finally { await ui.close(); }
  return T;
}
