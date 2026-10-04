// App 外殼：四台切換、實驗台（接線）、縮放、重設、儀器外提示與教學側欄。
// 儀器本身的行為都在 src/instruments/<id>/model.js；實驗台電路在 src/bench/；這裡只負責事件與畫面更新。
import { panelSvg, controlMeta } from './core/panel.js';
import { createInstruments } from './instruments/index.js';
import { Bench, fmtR, fmtC } from './bench/bench.js';
import { LEADS } from './bench/circuit.js';
import { schematicSvg, schematicSide } from './bench/schematic-view.js';
import { buildSchematicNet } from './bench/schematic-net.js';
import { prepareBreadboardSession, swapArchivedBreadboardSession } from './bench/legacy-board.js';
import './bench/schematic.css';
import { Breadboard, BB_DEMO, DEFAULT_VALUE, KIND_NAME, holeGroup, groupName, occupantName } from './bench/breadboard.js';
import { bbSvg, bbSide, boardSwitch, bbToolbar } from './bench/bb-view.js';
import { captureSession, restoreSession, restoreTdsSetupFile } from './core/session.js';
import { WiringHistory } from './bench/history.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KNOB_DEG = 15;         // 每一格旋轉的視覺角度
const DRAG_PX_PER_STEP = 9;  // 拖曳多少像素算一格（不接受滑鼠滾輪，避免誤改值）
const HINT_KIND = { out: '未納入', approx: '近似', reject: '已拒絕', info: '說明', ok: '完成' };
const BENCH = 'bench';
const SESSION_KEY = 'ee-ss.session.v1';
const MAX_SESSION_BYTES = 4 * 1024 * 1024;
const LIVE_MS = 200; // 讀值隨時間變（電表積分窗、電容充放電）時的畫面更新間隔
const SCHEMATIC_HELP = '電路圖依目前麵包板接線產生；同名節點相連。點元件核對值與孔位，點節點可回麵包板查看相連的孔。';
const BB_HELP = '麵包板上方選「插電阻／插電容／接跳線」後點兩個空孔擺上；點導線端（變藍）再點孔＝接線；滑鼠移到孔上會標出所有相連的孔。';
const FOCUSABLE = '[data-lead],[data-schematic-node],[data-goto],[data-hole],[data-comp],[data-bbtool]'; // 實驗台上可聚焦、Enter／空白鍵＝點擊的東西
const TOOL_HELP = { select: '選取：點元件選取（可改值），Delete 刪除。', R: '電阻：點第一個孔，再點第二個孔。', C: '電容：點第一個孔，再點第二個孔。', W: '跳線：點第一個孔，再點第二個孔，兩個孔所在的組就連在一起。' };

export function startApp(root) {
  const models = createInstruments();
  const ids = Object.keys(models);
  const metas = Object.fromEntries(ids.map((id) => [id, controlMeta(id)]));
  const bench = new Bench(models.afg, models.dmm, models.gpe);
  // 一份實際接線、兩種檢視；檢視狀態不參與電路或時間軸。
  bench.board = 'bb';
  bench.bb = new Breadboard();
  bench.bbWires = {};
  const history = new WiringHistory(bench);
  // 麵包板的操作狀態（只給畫面用）：工具、已點的第一個孔、選取的元件、新元件的值、滑鼠所在的孔
  const bbUi = { tool: 'select', first: null, sel: null, newR: DEFAULT_VALUE.R, newC: DEFAULT_VALUE.C, hover: null, view: 'breadboard', schematicNode: null };
  models.tds.setBenchSource(() => bench.tdsInput());
  models.dmm.setBenchSource(() => bench.dmmInput());
  models.dmm.now = () => bench.now();
  models.gpe.setBenchSource(() => bench.gpeInput());
  models.afg.setDsoSource?.(() => models.tds);
  models.afg.setTriggerSource?.(() => bench.now());
  models.afg.setCounterSource?.(() => {
    const sig = bench.tdsInput()?.sig?.[0];
    if (!sig || sig.noise) return null;
    const now = bench.now();
    const f = sig.carrierFreq || (sig.period > 0 ? 1 / sig.period : 0);
    if (!(f >= 5 && f <= 150e6)) return null;
    const n = Math.max(640, Math.ceil(5 * (sig.maxFreq || f) / f * 128));
    if (n > 64000) return null;
    const at = sig.abs, start = now - 5 / f, step = 5 / (n * f);
    const values = Array.from({ length: n + 1 }, (_, k) => at(start + k * step));
    const low = Math.min(...values), high = Math.max(...values), level = (low + high) / 2;
    if (!(high - low > 1e-5)) return null;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const rms = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    if (rms < .035 || rms > 30) return null;
    const crossings = [];
    for (let k = 1; k < values.length; k++) if (values[k - 1] < level && values[k] >= level) {
      let a = start + (k - 1) * step, b = a + step;
      for (let j = 0; j < 34; j++) { const mid = (a + b) / 2; if (at(mid) < level) a = mid; else b = mid; }
      crossings.push((a + b) / 2);
    }
    if (crossings.length < 3) return null;
    const period = (crossings.at(-1) - crossings[0]) / (crossings.length - 1);
    if (crossings.slice(1).some((t, k) => Math.abs((t - crossings[k]) / period - 1) > 0.02)) return null;
    const measured = 1 / period;
    return measured >= 5 && measured <= 150e6 ? measured : null;
  });
  let benchKey = bench.key();
  const knobAngle = {};
  const hints = [];
  let cur = ids[0];
  let zoom = 1;
  let saveTimer = null;
  let saveFailed = false;
  let gpeTimed = false;
  let benchWarnings = [];

  root.innerHTML = `
    <header class="top">
      <div class="brand">電子學實習儀器練習<small class="build-version">2026.10.04 麵包板電路圖版</small><small>模擬器 · 操作順序練習用，數值行為依手冊與暫定規則</small></div>
      <nav class="tabs" role="tablist">${ids.map((id) => `<button role="tab" data-tab="${id}">${esc(models[id].title)}<small>${esc(models[id].subtitle)}</small></button>`).join('')}<button role="tab" data-tab="${BENCH}" class="tab-bench">實驗台<small>麵包板接線／電路圖</small></button></nav>
      <div class="tools">
        <button data-zoom="-1" title="縮小">－</button><button data-zoom="0" title="符合視窗">符合</button><button data-zoom="1" title="放大">＋</button>
        <button data-session="export" title="把接線、元件與四台儀器設定下載成實驗檔">匯出實驗</button>
        <button data-session="import" title="載入實驗檔；載入後重新開始模擬">載入實驗</button>
        <input class="session-file" type="file" accept=".json,application/json" aria-label="選擇實驗檔" hidden>
        <button data-act="reset-all" title="四台都回到開機重設狀態（接線保留）">全部重設</button>
      </div>
      <div class="save-status" role="status" title="保存接線、元件、儀器設定與明確存入的 Setup／Ref；重新開啟時重新開始模擬，不保存電容電荷或即時採集。">接線與設定會自動保存在此瀏覽器</div>
      <input class="arb-file" type="file" accept=".json,application/json" aria-label="選擇 AFG 波形檔" hidden>
      <input class="tds-setup-file" type="file" accept=".json,application/json" aria-label="選擇示波器設定檔" hidden>
    </header>
    <main class="stage">
      <section class="bench"><div class="panel-host"></div><div class="hintbar" aria-live="polite"></div></section>
      <aside class="side"></aside>
    </main>`;
  const host = root.querySelector('.panel-host');
  const hintbar = root.querySelector('.hintbar');
  const side = root.querySelector('.side');
  const saveStatus = root.querySelector('.save-status');
  const sessionFile = root.querySelector('.session-file');
  const arbFile = root.querySelector('.arb-file');
  models.afg.setArbFileHandler?.((operation, payload) => {
    if (operation === 'LOAD') { arbFile.click(); return { kind: 'info', text: '選擇已匯出的 AFG 波形 JSON 檔。' }; }
    return { kind: 'ok', text: '已匯出 AFG 任意波形樣本與取樣率。', download: { name: 'ee-ss-AFG-波形.json', mime: 'application/json', text: JSON.stringify(payload, null, 2) } };
  });
  arbFile.addEventListener('change', async () => {
    const file = arbFile.files?.[0]; arbFile.value = '';
    if (!file) return;
    try {
      if (file.size > 256 * 1024) throw new Error('波形檔超過 256 KB。');
      const result = models.afg.importArbFile(JSON.parse(await file.text()));
      syncBench(); mountPanel(); scheduleSave(); hint(result);
    } catch (e) { hint({ kind: 'reject', text: `沒有載入 AFG 波形：${e.message} 原波形保留。` }); }
  });
  const scopeFile = root.querySelector('.tds-setup-file');
  models.tds.setSetupFileHandler?.(() => {
    scopeFile.click();
    return { kind: 'info', text: '選擇由示波器 Save Setup 匯出的 JSON 設定檔。' };
  });
  scopeFile.addEventListener('change', async () => {
    const file = scopeFile.files?.[0]; scopeFile.value = '';
    if (!file) return;
    try {
      if (file.size > 256 * 1024) throw new Error('示波器設定檔超過 256 KB。');
      const result = restoreTdsSetupFile(JSON.parse(await file.text()), models.tds);
      mountPanel(); scheduleSave(); hint(result);
    } catch (e) { hint({ kind: 'reject', text: `沒有載入示波器設定：${e.message} 原設定保留。` }); }
  });
  let audio;
  models.afg.setBeepHandler?.(() => {
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) return;
    audio ??= new Audio(); audio.resume().catch(() => {});
    const oscillator = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
    oscillator.frequency.value = 1000; gain.gain.setValueAtTime(.04, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .07);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(now); oscillator.stop(now + .08);
  });

  function saveSession() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(captureSession(models, bench, { tab: cur, zoom, benchView: bbUi.view })));
      saveStatus.textContent = '接線與設定已自動保存 · 重開時重新開始模擬';
      saveFailed = false;
    } catch {
      saveStatus.textContent = '此瀏覽器無法自動保存 · 請用「匯出實驗」存檔';
      saveFailed = true;
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    if (!saveFailed) saveStatus.textContent = '正在保存接線與設定…';
    saveTimer = setTimeout(saveSession, 200);
  }

  function loadSession(data) {
    const prepared = prepareBreadboardSession(data);
    const view = restoreSession(prepared.session, models, bench); // 完整驗證通過後才替換現況
    history.clear(); // 載入成功後才清掉舊編輯歷史；失敗仍保留歷史
    cur = view.tab;
    zoom = view.zoom;
    benchKey = bench.key();
    Object.assign(bbUi, { tool: 'select', first: null, sel: null, hover: null, view: view.benchView ?? 'breadboard', schematicNode: null });
    Object.keys(knobAngle).forEach((id) => delete knobAngle[id]);
    hints.length = 0;
    return prepared;
  }

  function exportSession() {
    const data = JSON.stringify(captureSession(models, bench, { tab: cur, zoom, benchView: bbUi.view }), null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ee-ss-實驗.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    hint({ kind: 'ok', text: '已匯出接線、元件、儀器設定及明確存入的記憶／Ref。載入後會重新開始模擬，不保留電容電荷或即時採集。' });
  }

  sessionFile.addEventListener('change', async () => {
    const file = sessionFile.files?.[0];
    sessionFile.value = ''; // 同一個檔案也可以再次載入
    if (!file) return;
    try {
      if (file.size > MAX_SESSION_BYTES) throw new Error('實驗檔超過 4 MB。');
      const text = await file.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('實驗檔不是有效的 JSON。'); }
      const loaded = loadSession(data);
      mountPanel();
      hint({ kind: 'ok', text: `已載入實驗接線與設定；模擬重新開始，電容從 0 V 開始。${migrationNotice(loaded)}` });
    } catch (e) {
      hint({ kind: 'reject', text: `沒有載入實驗：${e.message} 目前接線與設定保留。` });
    }
  });
  window.addEventListener('pagehide', saveSession);

  function hint(h) {
    if (!h) return;
    if (h.download) {
      const file = h.download, url = URL.createObjectURL(new Blob([file.text], { type: file.mime }));
      const a = document.createElement('a'); a.href = url; a.download = file.name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const item = { inst: cur, kind: h.kind || 'info', text: h.text, t: Date.now() };
    hints.push(item);
    if (hints.length > 60) hints.shift();
    hintbar.className = `hintbar k-${item.kind}`;
    hintbar.innerHTML = `<b>${HINT_KIND[item.kind] ?? '說明'}</b> ${esc(item.text)}`;
  }

  // 電路有變（接線、R／C、探棒開關、AFG 設定、電表功能）才重算並通知示波器重新採集；電表讀值是即時算的。
  // 立刻重算：暫態要從「這次操作的時刻」開始算，不能等到下次有人讀電路才開始。
  function syncBench() {
    const k = bench.key();
    if (k === benchKey) return;
    benchKey = k;
    bench.solution();
    models.tds.inputChanged?.();
  }

  // Auto 電流量程是電路的一部分；切到另一台面板時也要繼續工作。
  // 在其他儀器讀回之前選定分流負載，避免可見分頁改變實際電流。
  function syncCurrentRange() {
    const meter = models.dmm, wires = bench.leadMap();
    if (!meter.isOn() || meter.run === 'stop' || !meter.fx?.bench || !meter.st.auto) return false;
    const terminals = meter.f.kind === 'I' ? ['DMM.I', 'DMM.LO']
      : meter.fn === 'DCV' && meter.inputZMode === 'AUTO' ? ['DMM.HI', 'DMM.LO'] : null;
    if (!terminals || terminals.some((id) => !wires[id])) return false;
    const previous = meter.st.idx;
    bench.dmmInput();
    return previous !== meter.st.idx;
  }

  // 定時更新：電容還在充放電，或電表 DCV 的積分窗隨時間移動時，只重畫螢幕與狀態，不重建面板（不影響點擊）
  // 只重畫讀值可能在變的那一台（示波器重畫會重播 LCD 動畫，不能每次都畫）：
  //   示波器＝電容還在充放電、電路剛改，或實際觸發搜尋尚有待查區間；電表＝接在實驗台上就畫
  setInterval(() => {
    if (syncCurrentRange()) { syncBench(); scheduleSave(); }
    const t = bench.now(), tr = bench.transientActive(t);
    const timed = models.gpe.isOn() && (models.gpe.bootLeft() > 0 || models.gpe.setViewLeft() > 0);
    // GPE：限流充電暫態或 AFG 的週期保護切換時，端電壓／電流／模式都會變。
    const live = { afg: models.afg.isOn() && models.afg.menu?.startsWith('COUNTER'),
      tds: tr || t - bench.changedAt() < 1 || models.tds.needsTriggerPoll?.(), dmm: models.dmm.isLive?.(),
      gpe: timed || gpeTimed || (models.gpe.isOn() && models.gpe.scenarios.get() === 'bench' && bench.gpeReadbackActive(t)) };
    gpeTimed = timed; // 逾時後再更新一次，側欄和 LCD 一起結束 Set View／開機畫面
    if (live.tds) models.tds.inputChanged?.();
    // Acquisition belongs to the instrument, regardless of the selected tab.
    // reading() deduplicates a completed aperture if LCD/status also reads it.
    if (live.dmm) models.dmm.reading();
    if (cur === BENCH) {
      host.querySelectorAll('svg[data-mini]').forEach((el) => { const id = el.dataset.mini, m = models[id]; if (live[id] && m.isOn()) el.innerHTML = m.lcd(); });
      return;
    }
    if (!live[cur]) return;
    const m = models[cur], screen = host.querySelector('svg.panel svg.screen');
    if (screen && m.isOn()) screen.innerHTML = m.lcd();
    const dl = side.querySelector('dl.kv');
    if (dl) dl.innerHTML = m.status().map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  }, LIVE_MS);

  function mountPanel() {
    root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === cur)));
    hintbar.className = 'hintbar';
    if (cur === BENCH) {
      hintbar.textContent = bbUi.view === 'breadboard' ? `麵包板：${BB_HELP}` : SCHEMATIC_HELP;
      refresh();
      return;
    }
    host.innerHTML = panelSvg(cur, models[cur].layout);
    applyZoom();
    hintbar.textContent = '點按鍵或拖曳旋鈕操作；旋鈕聚焦後可用 ↑↓←→ 微調；需要長按的鍵請按住（GPE Set View 的 Lock 要 2 秒；鍵盤用 Shift+Enter）。灰色鍵是本輪未納入的功能，按了只會在這裡說明。';
    refresh();
  }

  function applyZoom() {
    const svg = host.querySelector('svg.panel, svg.bench-svg');
    if (!svg) return;
    svg.style.width = zoom === 1 ? '100%' : `${zoom * 100}%`;
  }

  function refresh() {
    syncCurrentRange();
    syncBench();
    scheduleSave();
    if (cur === BENCH) return renderBench();
    const m = models[cur];
    const svg = host.querySelector('svg.panel');
    if (!svg) return;
    svg.classList.toggle('power-off', !m.isOn());
    const screen = svg.querySelector('svg.screen');
    if (screen) screen.innerHTML = m.isOn() ? m.lcd() : '';
    svg.querySelectorAll('.ctl[data-id]').forEach((el) => {
      const v = m.visual?.(el.dataset.id) || {};
      el.classList.toggle('lit', !!v.lit);
      el.classList.toggle('active', !!v.active);
    });
    svg.querySelectorAll('.knob .ptr').forEach((p) => {
      const id = p.closest('.ctl').dataset.id;
      p.setAttribute('transform', `rotate(${knobAngle[id] || 0} ${p.dataset.cx} ${p.dataset.cy})`);
    });
    renderSide();
  }

  function renderBench({ inspectionOnly = false } = {}) {
    // Switching a view reuses LCDs; drawing a preview must not take a new DMM
    // sample or complete Single. The existing acquisition timer still runs.
    const displayModels = inspectionOnly ? Object.fromEntries(ids.map(id => {
      const body = host.querySelector(`svg[data-mini="${id}"]`)?.innerHTML ?? '';
      return [id, Object.assign(Object.create(models[id]), { lcd: () => body })];
    })) : models;
    if (!inspectionOnly) benchWarnings = bench.solution().warn;

    // 重畫後把鍵盤焦點還給同一個導線端／接點／孔／元件
    const f = document.activeElement?.closest?.(FOCUSABLE);
    const k = f && ['lead', 'schematicNode', 'goto', 'hole', 'comp', 'bbtool'].find((a) => f.dataset[a]);
    const key = k && `[data-${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}="${f.dataset[k]}"]`;
    const log = hints.filter((h) => h.inst === BENCH).slice(-6).reverse().map((h) => `<li class="k-${h.kind}"><b>${HINT_KIND[h.kind] ?? ''}</b> ${esc(h.text)}</li>`).join('');
    const schematic = bbUi.view === 'schematic';
    host.innerHTML = boardSwitch(bbUi.view) + (schematic
      ? schematicSvg(bench, displayModels, bbUi)
      : bbToolbar(bench, bbUi) + bbSvg(bench, displayModels, bbUi));
    side.innerHTML = historyControls() + (schematic ? schematicSide(bench, bbUi, log) : bbSide(bench, bbUi, log, benchWarnings));
    if (bench.breadboardArchive) side.innerHTML += `<section><h3>舊實驗的另一塊麵包板</h3><p>匯入前已插好的麵包板仍保存在實驗檔。切換會交換目前與備存接線，並重新開始模擬、清除 Undo。</p><button data-schematic="archive">切換備存麵包板</button></section>`;
    applyZoom();
    if (key) host.querySelector(key)?.focus({ preventScroll: true });
    if (!schematic) bbHighlight(bbUi.hover);
  }

  function historyControls() {
    const h = history.status(bench.board);
    return `<section class="wiring-history" aria-label="接線編輯歷史"><div class="btns">
      <button data-history="undo"${h.undo ? '' : ' disabled'} title="${esc(h.undoLabel ? `復原：${h.undoLabel}` : '沒有可復原的操作')}">復原${h.undo ? `（${h.undo}）` : ''}</button>
      <button data-history="redo"${h.redo ? '' : ' disabled'} title="${esc(h.redoLabel ? `重做：${h.redoLabel}` : '沒有可重做的操作')}">重做${h.redo ? `（${h.redo}）` : ''}</button></div>
      <p class="muted">⌘／Ctrl＋Z 復原，⌘／Ctrl＋Shift＋Z 重做；兩種檢視共用最近 100 步。只改接線與元件，時間繼續前進；已拿掉的電容重新擺上從 0 V 開始。</p></section>`;
  }

  function travelHistory(direction) {
    if (cur !== BENCH) return;
    const result = history[direction](bench.board);
    if (!result) return;
    Object.assign(bbUi, { first: null, sel: null, hover: null, schematicNode: null });
    hint({ kind: 'ok', text: `已${direction === 'undo' ? '復原' : '重做'}「${result.label}」；時間繼續前進。${result.restoredCaps ? '重新擺上的電容從 0 V 開始。' : ''}` });
    refresh();
  }

  function renderSide() {
    const m = models[cur];
    const status = m.status();
    const sc = m.scenarios;
    const mine = hints.filter((h) => h.inst === cur).slice(-8).reverse();
    side.innerHTML = `
      <h2>${esc(m.title)}<small>${esc(m.subtitle)}</small></h2>
      <section><h3>這台現在</h3><dl class="kv">${status.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>
      ${cur === 'gpe' ? `<section><h3>電源開機設定</h3><div class="btns"><button data-act="gpe-setup-output">開機 Output</button><button data-act="gpe-setup-digits">3／4 位顯示</button></div><p class="muted">設定在電源 LCD 操作；開機輸出與顯示位數會保存在實驗檔。</p></section>` : ''}
      ${sc ? `<section><h3>${esc(sc.title)}</h3><div class="scen">${sc.list.map((s) => `<label><input type="radio" name="scen" value="${s.id}"${sc.get() === s.id ? ' checked' : ''}> <b>${esc(s.label)}</b><span>${esc(s.desc)}</span></label>`).join('')}</div></section>` : ''}
      <section><h3>可以練習</h3><ul class="practice">${m.practice.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></section>
      <section><h3>最近提示</h3><ul class="log">${mine.length ? mine.map((h) => `<li class="k-${h.kind}"><b>${HINT_KIND[h.kind] ?? ''}</b> ${esc(h.text)}</li>`).join('') : '<li class="empty">（還沒有）</li>'}</ul></section>
      <section class="legend"><h3>圖例</h3>
        <span class="lg core">可操作</span><span class="lg approx">近似行為</span><span class="lg out">本輪未納入</span>
        <p>LCD 上只放儀器原有的英文字樣；中文說明都在儀器外。</p></section>
      <button class="reset-one" data-act="reset-one">重設這台（回到開機狀態）</button>`;
  }

  function act(id, fn) {
    const meta = metas[cur][id];
    if (!meta) return;
    if (meta.status === 'STATIC') return;
    if (meta.status === 'OUT') {
      const spec = models[cur].layout.shapes[id];
      const name = (spec?.label || spec?.sub || id.split('.').pop()).replace(/\n/g, ' ');
      // 模型可選擇知道 OUT 鍵被按（例：34460A 任何鍵都解除 Shift），但不能改其他狀態
      hint(models[cur].onOut?.(id) || { kind: 'out', text: `「${name}」本輪未納入練習範圍，按了不會改變儀器狀態。` });
      refresh();
      return;
    }
    hint(fn());
    refresh();
  }

  // ---- 實驗台操作 ----
  function useBench(inst) { // 探棒或測試線接上電路：該台改用實驗台訊號
    if (inst === 'tds' && models.tds.scenarios.get() !== 'BENCH') return models.tds.scenarios.set('BENCH');
    if (inst === 'dmm' && models.dmm.scenarios.get() !== 'bench') return models.dmm.scenarios.set('bench');
    if (inst === 'gpe' && models.gpe.scenarios.get() !== 'bench') return models.gpe.scenarios.set('bench');
    return null;
  }
  const holeText = (h) => `${h}（${groupName(holeGroup(h), true)}）`;
  function migrationNotice(result) {
    return result?.converted ? `舊固定 RC 板已轉成相同接線的麵包板。${result.archived ? '原本另一塊麵包板已備存，可在實驗台側欄切換。' : ''}` : '';
  }
  function setBenchView(view) {
    if (!['breadboard', 'schematic'].includes(view)) return;
    bbUi.view = view;
    bbUi.first = null;
    bbUi.hover = null;
    bench.sel = null;
    // 僅換畫面；不變更求解器 key、電容狀態、採集或接線歷史。
    renderBench({ inspectionOnly: true });
    scheduleSave();
    hint({ kind: 'info', text: view === 'schematic' ? SCHEMATIC_HELP : BB_HELP });
  }
  function selectSchematicNode(id) {
    const node = buildSchematicNet(bench.bb, bench.bbWires).nodes.find(n => n.id === id);
    if (!node) return;
    bbUi.schematicNode = id;
    bbUi.sel = null;
    hint({ kind: 'info', text: `${node.label}：${node.groupNames.join('、')}。切回麵包板可查看標亮的相連孔。` });
    renderBench({ inspectionOnly: true });
  }
  function swapArchive() {
    const session = captureSession(models, bench, { tab: cur, zoom, benchView: bbUi.view });
    loadSession(swapArchivedBreadboardSession(session));
    mountPanel();
    hint({ kind: 'info', text: '已交換目前與備存麵包板，兩份接線仍保留。模擬重新開始、Undo 清空，電容從 0 V 開始。' });
  }
  // 導線端：點一下選取（變藍）→ 點孔插上；已插的導線端選取後再點一次＝拔掉
  function bbLead(id) {
    bbUi.first = null;
    if (bench.sel === id && bench.bbWires[id]) {
      const h = bench.bbWires[id];
      history.perform('bb', `拔掉 ${LEADS[id].name}`, () => { delete bench.bbWires[id]; });
      bench.sel = null;
      hint({ kind: 'info', text: `拔掉 ${LEADS[id].name}（原本插在 ${h}）。` });
    } else if (bench.sel === id) {
      bench.sel = null;
    } else {
      bench.sel = id;
      hint({ kind: 'info', text: `選取 ${LEADS[id].name}：接著點麵包板上的孔${bench.bbWires[id] ? `（目前插在 ${bench.bbWires[id]}；再點一次這個導線端＝拔掉）` : ''}。` });
    }
    refresh();
  }
  function bbHole(h) {
    const bb = bench.bb, occ = bb.occupant(h, bench.bbWires);
    if (bench.sel) { // 有選導線端：插導線優先
      const id = bench.sel, r = history.perform('bb', `${LEADS[id].name} 插到 ${h}`, () => bb.plug(bench.bbWires, id, h));
      if (!r.ok) { hint({ kind: 'reject', text: r.why }); return refresh(); }
      bench.sel = null;
      const sw = useBench(LEADS[id].inst);
      hint({ kind: 'ok', text: `${LEADS[id].name} 插到 ${holeText(h)}。${sw ? '（已改用實驗台訊號）' : ''}` });
      return refresh();
    }
    if (bbUi.tool === 'select') {
      const g = holeGroup(h), n = bb.netlist(bench.bbWires).groupOf(h);
      hint({ kind: 'info', text: `孔 ${h}：${groupName(g)}${n !== g ? `，經跳線併入節點 ${n}` : ''}；${occ ? `插著${occupantName(occ)}` : '空著'}。要擺元件先在右邊選工具；要接線先點導線端。` });
      return refresh();
    }
    const kind = bbUi.tool, name = KIND_NAME[kind], leg1 = kind === 'W' ? '第一端' : '第一隻腳';
    if (!bbUi.first) {
      if (occ) { hint({ kind: 'reject', text: `孔 ${h} 已經插了${occupantName(occ)}：一個孔只能插一樣東西。` }); return refresh(); }
      bbUi.first = h;
      hint({ kind: 'info', text: `${name}的${leg1}：${holeText(h)}。接著點第二個孔（再點 ${h} 一次＝取消）。` });
      return refresh();
    }
    if (bbUi.first === h) {
      bbUi.first = null;
      hint({ kind: 'info', text: `取消擺放${name}。` });
      return refresh();
    }
    const r = history.perform('bb', `擺上${name}`, () => bb.add(kind, bbUi.first, h, kind === 'R' ? bbUi.newR : kind === 'C' ? bbUi.newC : undefined, bench.bbWires));
    if (!r.ok) { hint({ kind: 'reject', text: `${r.why}（${leg1}仍在 ${bbUi.first}，換一個孔，或再點 ${bbUi.first} 取消）` }); return refresh(); }
    const p = r.part;
    bbUi.first = null;
    bbUi.sel = p.id;
    const val = kind === 'R' ? ` ${fmtR(p.value)}` : kind === 'C' ? ` ${fmtC(p.value)}` : '';
    const bad = bb.netlist(bench.bbWires).warnings.find((w) => w.level === 'bad' && w.text.startsWith(`${p.id}（`));
    hint(bad ? { kind: 'info', text: `擺上 ${p.id}（${name}${val}）：${p.a}–${p.b}。注意：${bad.text}` } : { kind: 'ok', text: `擺上 ${p.id}（${name}${val}）：${p.a}–${p.b}。` });
    refresh();
  }
  function bbComp(id) {
    const p = bench.bb.get(id);
    if (!p) return;
    bench.sel = null;
    bbUi.first = null;
    bbUi.sel = id;
    bbUi.schematicNode = null;
    hint({ kind: 'info', text: `選取 ${id}（${KIND_NAME[p.kind]}${p.kind === 'W' ? '' : ` ${p.kind === 'R' ? fmtR(p.value) : fmtC(p.value)}`}，${p.a}–${p.b}）：右邊可${p.kind === 'W' ? '' : '改值、'}按「刪除」，或按 Delete 鍵拿掉。` });
    refresh();
  }
  function bbDelete() {
    if (!bbUi.sel || !history.perform('bb', `拿掉 ${bbUi.sel}`, () => bench.bb.remove(bbUi.sel))) return;
    hint({ kind: 'info', text: `拿掉 ${bbUi.sel}。` });
    bbUi.sel = null;
    refresh();
  }
  function bbAction(a) {
    if (a === 'delete') return bbDelete();
    const demo = { 'demo-rc': BB_DEMO.rc, 'demo-gpe': BB_DEMO.gpe, 'demo-current': BB_DEMO.current }[a];
    if (a !== 'clear' && !demo) return;
    bench.sel = null;
    bbUi.first = null;
    bbUi.sel = null;
    if (demo) {
      // 示範是完整接線答案：先清空再擺；接上的示波器／電表改用實驗台訊號
      history.perform('bb', `示範「${demo.name}」`, () => bench.bb.load(demo, bench.bbWires));
      new Set(Object.keys(demo.wires).map((id) => LEADS[id].inst)).forEach((inst) => useBench(inst));
      if (a === 'demo-current') models.dmm.setFn('DCI');
      hint({ kind: 'info', text: demo.desc });
    } else {
      history.perform('bb', '清空麵包板', () => { bench.bb.clear(); bench.bbWires = {}; });
      hint({ kind: 'info', text: '麵包板清空了：元件都拿掉、導線都拔掉。' });
    }
    refresh();
  }
  function bbSet(name, value) {
    if (name === 'bbtool' && value === 'cancel') {
      bench.sel = null;
      bbUi.first = null;
      hint({ kind: 'info', text: '已取消接線／放置；原有元件與導線保留。' });
    }
    if (name === 'bbtool' && TOOL_HELP[value]) {
      bbUi.tool = value;
      bbUi.first = null;
      bench.sel = null;
      hint({ kind: 'info', text: `工具＝${TOOL_HELP[value]}` });
    }
    if (name === 'bbR') bbUi.newR = Number(value);
    if (name === 'bbC') bbUi.newC = Number(value);
    if (name === 'bbVal' && bbUi.sel && history.perform('bb', `${bbUi.sel} 改值`, () => bench.bb.setValue(bbUi.sel, Number(value)))) {
      const p = bench.bb.get(bbUi.sel);
      hint({ kind: 'info', text: `${p.id} 改成 ${p.kind === 'R' ? fmtR(p.value) : fmtC(p.value)}。` });
    }
    refresh();
  }
  // 滑鼠所在（或鍵盤聚焦）的孔：同一個節點的孔都加上 hl
  function bbHighlight(h) {
    host.querySelectorAll('.hole.hl').forEach((el) => el.classList.remove('hl'));
    const graph = buildSchematicNet(bench.bb, bench.bbWires);
    const node = graph.nodes.find(n => h ? n.groups.includes(holeGroup(h)) : n.id === bbUi.schematicNode);
    const groups = new Set(node?.groups ?? (h ? [holeGroup(h)] : []));
    host.querySelectorAll('[data-hole]').forEach(el => {
      if (groups.has(holeGroup(el.dataset.hole))) el.classList.add('hl');
    });
  }
  function bbHover(e) {
    if (cur !== BENCH || bbUi.view !== 'breadboard') return;
    const h = e.target.closest?.('[data-hole]')?.dataset.hole ?? null;
    if (h === bbUi.hover) return;
    bbUi.hover = h;
    bbHighlight(h);
  }
  host.addEventListener('pointerover', bbHover);
  host.addEventListener('focusin', bbHover);
  host.addEventListener('pointerleave', () => { if (bbUi.hover) { bbUi.hover = null; bbHighlight(null); } });

  // ---- 事件：按鍵（滑鼠／觸控／鍵盤）與旋鈕（拖曳／方向鍵） ----
  let drag = null;
  let trigViewHeld = false;
  function setTrigViewHeld(active) {
    if (trigViewHeld === active) return;
    trigViewHeld = active;
    host.querySelector('[data-id="TDS.KEY.TRIG_VIEW"]')?.classList.toggle('pressed', active);
    models.tds.setTrigView?.(active);
    if (cur === 'tds') {
      const screen = host.querySelector('svg.panel svg.screen');
      if (screen) screen.innerHTML = models.tds.lcd();
      const dl = side.querySelector('dl.kv');
      if (dl) dl.innerHTML = models.tds.status().map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    }
  }
  let downAt = 0;
  const LONG_MS = 800; // 一般長按門檻；需要更久的鍵由模型看 ms 自己判斷（GPE Lock ≥2 s）
  host.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.ctl[tabindex]');
    if (!el) return;
    el.focus({ preventScroll: true });
    if (cur === 'tds' && el.dataset.id === 'TDS.KEY.TRIG_VIEW') {
      setTrigViewHeld(true); e.preventDefault(); return;
    }
    if (el.classList.contains('knob')) {
      drag = { el, id: el.dataset.id, lastX: e.clientX, lastY: e.clientY, acc: 0 };
      el.setPointerCapture(e.pointerId);
      el.classList.add('turning');
    } else {
      el.classList.add('pressed');
      downAt = performance.now();
    }
    e.preventDefault();
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    // 往上或往右拖＝順時針
    drag.acc += (e.clientX - drag.lastX) - (e.clientY - drag.lastY);
    drag.lastX = e.clientX; drag.lastY = e.clientY;
    while (Math.abs(drag.acc) >= DRAG_PX_PER_STEP) {
      const dir = Math.sign(drag.acc);
      drag.acc -= dir * DRAG_PX_PER_STEP;
      turn(drag.id, dir, 'drag');
    }
  });
  const endDrag = () => { if (drag) { drag.el.classList.remove('turning'); drag = null; } };
  host.addEventListener('pointerup', (e) => {
    if (trigViewHeld) { endDrag(); setTrigViewHeld(false); return; }
    if (drag) return endDrag();
    const el = e.target.closest('.ctl.pressed');
    host.querySelectorAll('.pressed').forEach((p) => p.classList.remove('pressed'));
    if (el) {
      const ms = performance.now() - downAt;
      act(el.dataset.id, () => models[cur].press(el.dataset.id, { long: ms >= LONG_MS, ms }));
    }
  });
  host.addEventListener('pointercancel', () => { setTrigViewHeld(false); endDrag(); host.querySelectorAll('.pressed').forEach((p) => p.classList.remove('pressed')); });
  window.addEventListener('pointerup', () => setTrigViewHeld(false));
  window.addEventListener('pointercancel', () => setTrigViewHeld(false));
  window.addEventListener('blur', () => setTrigViewHeld(false));
  host.addEventListener('click', (e) => {
    if (cur !== BENCH) return;
    const lead = e.target.closest('[data-lead]');
    if (lead) return bbLead(lead.dataset.lead);
    const comp = e.target.closest('[data-comp]'); // 麵包板的元件、孔（只在麵包板模式出現）
    if (comp) return bbComp(comp.dataset.comp);
    const hole = e.target.closest('[data-hole]');
    if (hole) return bbHole(hole.dataset.hole);
    const node = e.target.closest('[data-schematic-node]');
    if (node) return selectSchematicNode(node.dataset.schematicNode);
    const go = e.target.closest('[data-goto]');
    if (go) { cur = go.dataset.goto; mountPanel(); }
  });
  host.addEventListener('keydown', (e) => {
    if (cur === BENCH) {
      const el = e.target.closest?.(FOCUSABLE);
      if (el && (e.key === 'Enter' || e.key === ' ')) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); e.preventDefault(); }
      return;
    }
    const el = e.target.closest?.('.ctl[tabindex]');
    if (!el) return;
    const id = el.dataset.id;
    if (cur === 'tds' && id === 'TDS.KEY.TRIG_VIEW' && (e.key === 'Enter' || e.key === ' ')) {
      setTrigViewHeld(true); e.preventDefault(); return;
    }
    if (el.classList.contains('knob')) {
      const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (dir) { turn(id, dir, 'key'); e.preventDefault(); }
      return;
    }
    // Enter／空白鍵＝按一下；Shift+Enter＝長按
    if (e.key === 'Enter' || e.key === ' ') { act(id, () => models[cur].press(id, { long: e.shiftKey })); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') setTrigViewHeld(false); });

  function turn(id, dir, source) {
    knobAngle[id] = ((knobAngle[id] || 0) + dir * KNOB_DEG) % 360;
    act(id, () => models[cur].turn(id, dir, { source }));
  }

  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { setTrigViewHeld(false); cur = tab.dataset.tab; mountPanel(); return; }
    const z = e.target.closest('[data-zoom]');
    if (z) { const d = Number(z.dataset.zoom); zoom = d === 0 ? 1 : Math.min(2.5, Math.max(1, zoom + d * 0.25)); applyZoom(); scheduleSave(); return; }
    const session = e.target.closest('[data-session]');
    if (session?.dataset.session === 'export') { exportSession(); return; }
    if (session?.dataset.session === 'import') { sessionFile.click(); return; }
    const historyButton = e.target.closest('[data-history]');
    if (historyButton && cur === BENCH) { travelHistory(historyButton.dataset.history); return; }
    const a = e.target.closest('[data-act]');
    if (cur === 'gpe' && a?.dataset.act?.startsWith('gpe-setup-')) {
      hint(models.gpe.beginSetup(a.dataset.act === 'gpe-setup-output' ? 'output' : 'digits'));
      refresh();
      return;
    }
    if (a?.dataset.act === 'reset-all') { ids.forEach((id) => models[id].reset()); hint({ kind: 'info', text: '四台都已回到開機重設狀態（模擬器定義，非校機開機記憶）；實驗台的接線保留。' }); refresh(); }
    if (a?.dataset.act === 'reset-one') {
      if (cur === BENCH) {
        bbAction('clear');
      }
      else { models[cur].reset(); hint({ kind: 'info', text: `${models[cur].title} 已回到開機重設狀態。` }); }
      refresh();
    }
    const schematic = e.target.closest('[data-schematic]');
    if (cur === BENCH && schematic?.dataset.schematic === 'edit') return setBenchView('breadboard');
    if (cur === BENCH && schematic?.dataset.schematic === 'archive') return swapArchive();
    const sideComp = e.target.closest('.side [data-comp]');
    if (cur === BENCH && sideComp) return bbComp(sideComp.dataset.comp);
    const sideNode = e.target.closest('.side [data-schematic-node]');
    if (cur === BENCH && sideNode) return selectSchematicNode(sideNode.dataset.schematicNode);
    const bbBtn = e.target.closest('[data-bb]');
    if (bbBtn && cur === BENCH) bbAction(bbBtn.dataset.bb);
    const bbTool = e.target.closest('[data-bbtool],input[name="bbtool"]');
    if (bbTool && cur === BENCH && bench.board === 'bb') bbSet('bbtool', bbTool.dataset.bbtool || bbTool.value);
  });
  // 麵包板：Delete／Backspace 刪除選取的元件（焦點在輸入欄、選單時不攔）
  document.addEventListener('keydown', (e) => {
    if (cur === BENCH && (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
      if (e.target.closest?.('input, select, textarea') || e.target.isContentEditable) return;
      e.preventDefault();
      if (!e.repeat) travelHistory(e.shiftKey ? 'redo' : 'undo');
      return;
    }
    if ((e.key !== 'Delete' && e.key !== 'Backspace') || cur !== BENCH || bench.board !== 'bb' || !bbUi.sel) return;
    if (e.target.closest?.('input, select, textarea')) return;
    e.preventDefault();
    bbDelete();
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.closest('.side') && !['benchView', 'insertR', 'insertC'].includes(t.name)) return;
    if (t.name === 'scen') { hint(models[cur].scenarios.set(t.value)); refresh(); return; }
    if (cur !== BENCH) return;
    if (t.name === 'benchView') return setBenchView(t.value);
    if (t.name === 'insertR') return bbSet('bbR', t.value);
    if (t.name === 'insertC') return bbSet('bbC', t.value);
    if (t.name?.startsWith('bb')) return bbSet(t.name, t.value);
    if (t.name === 'px1') bench.probeX[0] = Number(t.value);
    if (t.name === 'px2') bench.probeX[1] = Number(t.value);
    hint({ kind: 'info', text: '電路已更新。' });
    refresh();
  });

  // e2e 只讀掛鉤：讀狀態做斷言，不提供任何操作入口
  Object.defineProperty(window, '__eess', {
    value: Object.freeze({
      current: () => cur,
      // 實驗台另外附上麵包板：board、bb（元件清單＋netlist 的 nodes／elements／leads／warnings）、bbWires、bbUi（工具、第一個孔、選取）
      snapshot: (id = cur) => JSON.parse(JSON.stringify(id === BENCH
        ? { ...bench.snapshot(), board: bench.board, bb: bench.bb.snapshot(bench.bbWires), bbWires: bench.bbWires, bbUi: { tool: bbUi.tool, first: bbUi.first, sel: bbUi.sel, view: bbUi.view, schematicNode: bbUi.schematicNode }, history: history.status(bench.board) }
        : models[id].snapshot())),
      hints: () => hints.map((h) => ({ ...h })),
    }),
  });

  let restored = null, restoreError = null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) { restored = loadSession(JSON.parse(raw)); }
  } catch (e) {
    restoreError = e.message;
  }
  mountPanel();
  if (restored) hint({ kind: 'info', text: `已還原上次的接線與儀器設定；模擬重新開始，電容從 0 V 開始。${migrationNotice(restored)}` });
  if (restoreError) hint({ kind: 'info', text: '未能還原上次實驗，已開啟預設配置；仍可用「載入實驗」開啟匯出的檔案。' });
}
