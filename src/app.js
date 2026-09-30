// App 外殼：四台切換、實驗台（接線）、縮放、重設、儀器外提示與教學側欄。
// 儀器本身的行為都在 src/instruments/<id>/model.js；實驗台電路在 src/bench/；這裡只負責事件與畫面更新。
import { panelSvg, controlMeta } from './core/panel.js';
import { createInstruments } from './instruments/index.js';
import { Bench, DEMO, fmtR, fmtC } from './bench/bench.js';
import { LEADS } from './bench/circuit.js';
import { benchSvg, benchSide } from './bench/view.js';
import { Breadboard, BB_DEMO, DEFAULT_VALUE, KIND_NAME, holeGroup, groupName, occupantName } from './bench/breadboard.js';
import { bbSvg, bbSide, boardSwitch } from './bench/bb-view.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KNOB_DEG = 15;         // 每一格旋轉的視覺角度
const DRAG_PX_PER_STEP = 9;  // 拖曳多少像素算一格（不接受滑鼠滾輪，避免誤改值）
const HINT_KIND = { out: '未納入', approx: '近似', reject: '已拒絕', info: '說明', ok: '完成' };
const BENCH = 'bench';
const LIVE_MS = 200; // 讀值隨時間變（電表積分窗、電容充放電）時的畫面更新間隔
const RC_HELP = '點一個導線端（變藍），再點電路板上的 A／B／G 接上；已接好的導線端選取後再點一次＝拔掉。';
const BB_HELP = '右邊選工具（電阻／電容／跳線）後點兩個孔擺上；點導線端（變藍）再點孔＝接線；滑鼠移到孔上會標出所有相連的孔。';
const FOCUSABLE = '[data-lead],[data-node],[data-goto],[data-hole],[data-comp]'; // 實驗台上可聚焦、Enter／空白鍵＝點擊的東西
const TOOL_HELP = { select: '選取：點元件選取（可改值），Delete 刪除。', R: '電阻：點第一個孔，再點第二個孔。', C: '電容：點第一個孔，再點第二個孔。', W: '跳線：點第一個孔，再點第二個孔，兩個孔所在的組就連在一起。' };

export function startApp(root) {
  const models = createInstruments();
  const ids = Object.keys(models);
  const metas = Object.fromEntries(ids.map((id) => [id, controlMeta(id)]));
  const bench = new Bench(models.afg, models.dmm, models.gpe);
  // 麵包板模式（掛在 bench 上的純屬性，Bench 本身不用它們；電路計算讀 bench.bb.netlist(bench.bbWires)）：
  //   board＝'rc'（固定 RC 板，用 bench.wires）｜'bb'（麵包板）；bb＝麵包板上的元件；bbWires＝導線 id → 孔 id
  bench.board = 'rc';
  bench.bb = new Breadboard();
  bench.bbWires = {};
  // 麵包板的操作狀態（只給畫面用）：工具、已點的第一個孔、選取的元件、新元件的值、滑鼠所在的孔
  const bbUi = { tool: 'select', first: null, sel: null, newR: DEFAULT_VALUE.R, newC: DEFAULT_VALUE.C, hover: null };
  models.tds.setBenchSource(() => bench.tdsInput());
  models.dmm.setBenchSource(() => bench.dmmInput());
  models.gpe.setBenchSource(() => bench.gpeInput());
  let benchKey = bench.key();
  const knobAngle = {};
  const hints = [];
  let cur = ids[0];
  let zoom = 1;

  root.innerHTML = `
    <header class="top">
      <div class="brand">電子學實習儀器練習<small>模擬器 · 操作順序練習用，數值行為依手冊與暫定規則</small></div>
      <nav class="tabs" role="tablist">${ids.map((id) => `<button role="tab" data-tab="${id}">${esc(models[id].title)}<small>${esc(models[id].subtitle)}</small></button>`).join('')}<button role="tab" data-tab="${BENCH}" class="tab-bench">實驗台<small>接線：RC 板／麵包板</small></button></nav>
      <div class="tools">
        <button data-zoom="-1" title="縮小">－</button><button data-zoom="0" title="符合視窗">符合</button><button data-zoom="1" title="放大">＋</button>
        <button data-act="reset-all" title="四台都回到開機重設狀態（接線保留）">全部重設</button>
      </div>
    </header>
    <main class="stage">
      <section class="bench"><div class="panel-host"></div><div class="hintbar" aria-live="polite"></div></section>
      <aside class="side"></aside>
    </main>`;
  const host = root.querySelector('.panel-host');
  const hintbar = root.querySelector('.hintbar');
  const side = root.querySelector('.side');

  function hint(h) {
    if (!h) return;
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

  // 定時更新：電容還在充放電，或電表 DCV 的積分窗隨時間移動時，只重畫螢幕與狀態，不重建面板（不影響點擊）
  // 只重畫讀值可能在變的那一台（示波器重畫會重播 LCD 動畫，不能每次都畫）：
  //   示波器＝電容還在充放電，或電路剛改（1 秒內，確保暫態結束後補一幅穩態）；電表＝接在實驗台上就畫
  setInterval(() => {
    const t = bench.now(), live = { tds: bench.transientActive(t) || t - bench.changedAt() < 1, dmm: models.dmm.isLive?.() };
    if (live.tds) models.tds.inputChanged?.();
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
      hintbar.textContent = bench.board === 'bb' ? `麵包板：${BB_HELP}` : RC_HELP;
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
    syncBench();
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

  function renderBench() {
    // 重畫後把鍵盤焦點還給同一個導線端／接點／孔／元件
    const f = document.activeElement?.closest?.(FOCUSABLE);
    const k = f && ['lead', 'node', 'goto', 'hole', 'comp'].find((a) => f.dataset[a]);
    const key = k && `[data-${k}="${f.dataset[k]}"]`;
    const log = hints.filter((h) => h.inst === BENCH).slice(-6).reverse().map((h) => `<li class="k-${h.kind}"><b>${HINT_KIND[h.kind] ?? ''}</b> ${esc(h.text)}</li>`).join('');
    if (bench.board === 'bb') {
      host.innerHTML = bbSvg(bench, models, bbUi);
      side.innerHTML = boardSwitch(bench.board) + bbSide(bench, bbUi, log);
    } else {
      host.innerHTML = benchSvg(bench, models);
      side.innerHTML = boardSwitch(bench.board) + benchSide(bench, models, log) + '<button class="reset-one" data-act="reset-one">重設實驗台（拔掉所有線、R／C 回預設）</button>';
    }
    applyZoom();
    if (key) host.querySelector(key)?.focus({ preventScroll: true });
    if (bench.board === 'bb') bbHighlight(bbUi.hover);
  }

  function renderSide() {
    const m = models[cur];
    const status = m.status();
    const sc = m.scenarios;
    const mine = hints.filter((h) => h.inst === cur).slice(-8).reverse();
    side.innerHTML = `
      <h2>${esc(m.title)}<small>${esc(m.subtitle)}</small></h2>
      <section><h3>這台現在</h3><dl class="kv">${status.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>
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
  function benchLead(id) {
    if (bench.sel === id && bench.wires[id]) {
      const n = bench.wires[id];
      bench.disconnect(id);
      hint({ kind: 'info', text: `拔掉 ${LEADS[id].name}（原本接在 ${n}）。` });
    } else if (bench.sel === id) {
      bench.sel = null;
    } else {
      bench.sel = id;
      hint({ kind: 'info', text: `選取 ${LEADS[id].name}：接著點電路板上的 A、B 或 G${bench.wires[id] ? `（目前接在 ${bench.wires[id]}；再點一次這個導線端＝拔掉）` : ''}。` });
    }
    refresh();
  }
  function benchNode(n) {
    if (!bench.sel) {
      const on = bench.leadsOn(n);
      hint({ kind: 'info', text: `接點 ${n}：${on.length ? on.join('、') : '還沒有接線'}。要接線先點一個導線端。` });
      return refresh();
    }
    const id = bench.sel;
    bench.connect(id, n);
    const sw = useBench(LEADS[id].inst);
    hint({ kind: 'ok', text: `${LEADS[id].name} 接到 ${n}。${sw ? '（已改用實驗台訊號）' : ''}` });
    refresh();
  }

  // ---- 麵包板操作（bench.board＝'bb'）----
  const holeText = (h) => `${h}（${groupName(holeGroup(h), true)}）`;
  function setBoard(b) {
    if (b !== 'rc' && b !== 'bb') return;
    bench.board = b;
    bench.sel = null;
    bbUi.first = null;
    hint({ kind: 'info', text: b === 'bb' ? `換到麵包板：${BB_HELP}（固定 RC 板的接線保留，切回去還在。）` : '換回固定 RC 板（麵包板上的元件與接線保留）。' });
    refresh();
  }
  // 導線端：和 RC 板一樣——點一下選取（變藍）→ 點孔插上；已插的導線端選取後再點一次＝拔掉
  function bbLead(id) {
    bbUi.first = null;
    if (bench.sel === id && bench.bbWires[id]) {
      const h = bench.bbWires[id];
      delete bench.bbWires[id];
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
      const id = bench.sel, r = bb.plug(bench.bbWires, id, h);
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
    const r = bb.add(kind, bbUi.first, h, kind === 'R' ? bbUi.newR : kind === 'C' ? bbUi.newC : undefined, bench.bbWires);
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
    hint({ kind: 'info', text: `選取 ${id}（${KIND_NAME[p.kind]}${p.kind === 'W' ? '' : ` ${p.kind === 'R' ? fmtR(p.value) : fmtC(p.value)}`}，${p.a}–${p.b}）：右邊可${p.kind === 'W' ? '' : '改值、'}按「刪除」，或按 Delete 鍵拿掉。` });
    refresh();
  }
  function bbDelete() {
    if (!bbUi.sel || !bench.bb.remove(bbUi.sel)) return;
    hint({ kind: 'info', text: `拿掉 ${bbUi.sel}。` });
    bbUi.sel = null;
    refresh();
  }
  function bbAction(a) {
    if (a === 'delete') return bbDelete();
    const demo = { 'demo-rc': BB_DEMO.rc, 'demo-gpe': BB_DEMO.gpe }[a];
    if (a !== 'clear' && !demo) return;
    bench.sel = null;
    bbUi.first = null;
    bbUi.sel = null;
    if (demo) {
      // 示範是完整接線答案：先清空再擺；接上的示波器／電表改用實驗台訊號
      bench.bb.load(demo, bench.bbWires);
      new Set(Object.keys(demo.wires).map((id) => LEADS[id].inst)).forEach((inst) => useBench(inst));
      hint({ kind: 'info', text: demo.desc });
    } else {
      bench.bb.clear();
      bench.bbWires = {};
      hint({ kind: 'info', text: '麵包板清空了：元件都拿掉、導線都拔掉。' });
    }
    refresh();
  }
  function bbSet(name, value) {
    if (name === 'bbtool' && TOOL_HELP[value]) {
      bbUi.tool = value;
      bbUi.first = null;
      bench.sel = null;
      hint({ kind: 'info', text: `工具＝${TOOL_HELP[value]}` });
    }
    if (name === 'bbR') bbUi.newR = Number(value);
    if (name === 'bbC') bbUi.newC = Number(value);
    if (name === 'bbVal' && bbUi.sel && bench.bb.setValue(bbUi.sel, Number(value))) {
      const p = bench.bb.get(bbUi.sel);
      hint({ kind: 'info', text: `${p.id} 改成 ${p.kind === 'R' ? fmtR(p.value) : fmtC(p.value)}。` });
    }
    refresh();
  }
  // 滑鼠所在（或鍵盤聚焦）的孔：同一個節點的孔都加上 hl
  function bbHighlight(h) {
    host.querySelectorAll('.hole.hl').forEach((el) => el.classList.remove('hl'));
    const net = h && host.querySelector(`[data-hole="${h}"]`)?.dataset.net;
    if (net) host.querySelectorAll(`[data-net="${net}"]`).forEach((el) => el.classList.add('hl'));
  }
  function bbHover(e) {
    if (cur !== BENCH || bench.board !== 'bb') return;
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
  let downAt = 0;
  const LONG_MS = 800; // 一般長按門檻；需要更久的鍵由模型看 ms 自己判斷（GPE Lock ≥2 s）
  host.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.ctl[tabindex]');
    if (!el) return;
    el.focus({ preventScroll: true });
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
    if (drag) return endDrag();
    const el = e.target.closest('.ctl.pressed');
    host.querySelectorAll('.pressed').forEach((p) => p.classList.remove('pressed'));
    if (el) {
      const ms = performance.now() - downAt;
      act(el.dataset.id, () => models[cur].press(el.dataset.id, { long: ms >= LONG_MS, ms }));
    }
  });
  host.addEventListener('pointercancel', () => { endDrag(); host.querySelectorAll('.pressed').forEach((p) => p.classList.remove('pressed')); });
  host.addEventListener('click', (e) => {
    if (cur !== BENCH) return;
    const lead = e.target.closest('[data-lead]');
    if (lead) return bench.board === 'bb' ? bbLead(lead.dataset.lead) : benchLead(lead.dataset.lead);
    const comp = e.target.closest('[data-comp]'); // 麵包板的元件、孔（只在麵包板模式出現）
    if (comp) return bbComp(comp.dataset.comp);
    const hole = e.target.closest('[data-hole]');
    if (hole) return bbHole(hole.dataset.hole);
    const node = e.target.closest('[data-node]');
    if (node) return benchNode(node.dataset.node);
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
    if (el.classList.contains('knob')) {
      const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (dir) { turn(id, dir, 'key'); e.preventDefault(); }
      return;
    }
    // Enter／空白鍵＝按一下；Shift+Enter＝長按
    if (e.key === 'Enter' || e.key === ' ') { act(id, () => models[cur].press(id, { long: e.shiftKey })); e.preventDefault(); }
  });

  function turn(id, dir, source) {
    knobAngle[id] = ((knobAngle[id] || 0) + dir * KNOB_DEG) % 360;
    act(id, () => models[cur].turn(id, dir, { source }));
  }

  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { cur = tab.dataset.tab; mountPanel(); return; }
    const z = e.target.closest('[data-zoom]');
    if (z) { const d = Number(z.dataset.zoom); zoom = d === 0 ? 1 : Math.min(2.5, Math.max(1, zoom + d * 0.25)); applyZoom(); return; }
    const a = e.target.closest('[data-act]');
    if (a?.dataset.act === 'reset-all') { ids.forEach((id) => models[id].reset()); hint({ kind: 'info', text: '四台都已回到開機重設狀態（模擬器定義，非校機開機記憶）；實驗台的接線保留。' }); refresh(); }
    if (a?.dataset.act === 'reset-one') {
      if (cur === BENCH) { bench.reset(); hint({ kind: 'info', text: '實驗台已重設：所有線拔掉、R 1 kΩ、C 100 nF、探棒 10×。' }); }
      else { models[cur].reset(); hint({ kind: 'info', text: `${models[cur].title} 已回到開機重設狀態。` }); }
      refresh();
    }
    const b = e.target.closest('[data-bench]');
    if (b?.dataset.bench === 'demo') {
      // 示範是完整接線答案；先移除額外導線，避免殘留 CH2 黑夾把電容短路。
      bench.wires = {};
      bench.sel = null;
      Object.entries(DEMO).forEach(([id, n]) => bench.connect(id, n));
      useBench('tds'); useBench('dmm');
      hint({ kind: 'info', text: '示範接線：AFG CH1 紅夾→A、黑夾→G；示波器 CH1 量 A、CH2 量 B（接地夾都在 G）；電表 HI→B、LO→G。記得打開 AFG 的 OUTPUT。' });
      refresh();
    }
    if (b?.dataset.bench === 'clear') { bench.wires = {}; bench.sel = null; hint({ kind: 'info', text: '所有線都拔掉了。' }); refresh(); }
    const bbBtn = e.target.closest('[data-bb]');
    if (bbBtn && cur === BENCH) bbAction(bbBtn.dataset.bb);
  });
  // 麵包板：Delete／Backspace 刪除選取的元件（焦點在輸入欄、選單時不攔）
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'Delete' && e.key !== 'Backspace') || cur !== BENCH || bench.board !== 'bb' || !bbUi.sel) return;
    if (e.target.closest?.('input, select, textarea')) return;
    e.preventDefault();
    bbDelete();
  });
  side.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'scen') { hint(models[cur].scenarios.set(t.value)); refresh(); return; }
    if (cur !== BENCH) return;
    if (t.name === 'board') return setBoard(t.value);
    if (t.name?.startsWith('bb')) return bbSet(t.name, t.value);
    if (t.name === 'topo') bench.topo = t.value;
    if (t.name === 'R') bench.R = Number(t.value);
    if (t.name === 'C') bench.C = Number(t.value);
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
        ? { ...bench.snapshot(), board: bench.board, bb: bench.bb.snapshot(bench.bbWires), bbWires: bench.bbWires, bbUi: { tool: bbUi.tool, first: bbUi.first, sel: bbUi.sel } }
        : models[id].snapshot())),
      hints: () => hints.map((h) => ({ ...h })),
    }),
  });

  mountPanel();
}
