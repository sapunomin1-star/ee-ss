// App 外殼：四台切換、縮放、重設、儀器外提示與教學側欄。
// 儀器本身的行為都在 src/instruments/<id>/model.js；這裡只負責事件與畫面更新。
import { panelSvg, controlMeta } from './core/panel.js';
import { createInstruments } from './instruments/index.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KNOB_DEG = 15;         // 每一格旋轉的視覺角度
const DRAG_PX_PER_STEP = 9;  // 拖曳多少像素算一格（不接受滑鼠滾輪，避免誤改值）
const HINT_KIND = { out: '未納入', approx: '近似', reject: '已拒絕', info: '說明', ok: '完成' };

export function startApp(root) {
  const models = createInstruments();
  const ids = Object.keys(models);
  const metas = Object.fromEntries(ids.map((id) => [id, controlMeta(id)]));
  const knobAngle = {};
  const hints = [];
  let cur = ids[0];
  let zoom = 1;

  root.innerHTML = `
    <header class="top">
      <div class="brand">電子學實習儀器練習<small>模擬器 · 操作順序練習用，數值行為依手冊與暫定規則</small></div>
      <nav class="tabs" role="tablist">${ids.map((id) => `<button role="tab" data-tab="${id}">${esc(models[id].title)}<small>${esc(models[id].subtitle)}</small></button>`).join('')}</nav>
      <div class="tools">
        <button data-zoom="-1" title="縮小">－</button><button data-zoom="0" title="符合視窗">符合</button><button data-zoom="1" title="放大">＋</button>
        <button data-act="reset-all" title="四台都回到開機重設狀態">全部重設</button>
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

  function mountPanel() {
    const m = models[cur];
    host.innerHTML = panelSvg(cur, m.layout);
    applyZoom();
    root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === cur)));
    hintbar.className = 'hintbar';
    hintbar.textContent = '點按鍵或拖曳旋鈕操作；旋鈕聚焦後可用 ↑↓←→ 微調；需要長按的鍵按住 0.8 秒（鍵盤 Shift+Enter）。灰色鍵是本輪未納入的功能，按了只會在這裡說明。';
    refresh();
  }

  function applyZoom() {
    const svg = host.querySelector('svg.panel');
    if (!svg) return;
    svg.style.width = zoom === 1 ? '100%' : `${zoom * 100}%`;
  }

  function refresh() {
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
      const name = (spec?.label || meta.label).replace(/\n/g, ' ');
      hint({ kind: 'out', text: `「${name}」本輪未納入練習範圍，按了不會改變儀器狀態。` });
      renderSide();
      return;
    }
    hint(fn());
    refresh();
  }

  // ---- 事件：按鍵（滑鼠／觸控／鍵盤）與旋鈕（拖曳／方向鍵） ----
  let drag = null;
  let downAt = 0;
  const LONG_MS = 800; // 按住超過這個時間＝長按（例：GPE Set View 長按＝Lock）
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
      turn(drag.id, dir);
    }
  });
  const endDrag = () => { if (drag) { drag.el.classList.remove('turning'); drag = null; } };
  host.addEventListener('pointerup', (e) => {
    if (drag) return endDrag();
    const el = e.target.closest('.ctl.pressed');
    host.querySelectorAll('.pressed').forEach((p) => p.classList.remove('pressed'));
    if (el) {
      const long = performance.now() - downAt >= LONG_MS;
      act(el.dataset.id, () => models[cur].press(el.dataset.id, { long }));
    }
  });
  host.addEventListener('pointercancel', () => { endDrag(); host.querySelectorAll('.pressed').forEach((p) => p.classList.remove('pressed')); });
  host.addEventListener('keydown', (e) => {
    const el = e.target.closest?.('.ctl[tabindex]');
    if (!el) return;
    const id = el.dataset.id;
    if (el.classList.contains('knob')) {
      const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (dir) { turn(id, dir); e.preventDefault(); }
      return;
    }
    // Enter／空白鍵＝按一下；Shift+Enter＝長按
    if (e.key === 'Enter' || e.key === ' ') { act(id, () => models[cur].press(id, { long: e.shiftKey })); e.preventDefault(); }
  });

  function turn(id, dir) {
    knobAngle[id] = ((knobAngle[id] || 0) + dir * KNOB_DEG) % 360;
    act(id, () => models[cur].turn(id, dir));
  }

  root.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) { cur = tab.dataset.tab; mountPanel(); return; }
    const z = e.target.closest('[data-zoom]');
    if (z) { const d = Number(z.dataset.zoom); zoom = d === 0 ? 1 : Math.min(2.5, Math.max(1, zoom + d * 0.25)); applyZoom(); return; }
    const a = e.target.closest('[data-act]');
    if (a?.dataset.act === 'reset-all') { ids.forEach((id) => models[id].reset()); hint({ kind: 'info', text: '四台都已回到開機重設狀態（模擬器定義，非校機開機記憶）。' }); refresh(); }
    if (a?.dataset.act === 'reset-one') { models[cur].reset(); hint({ kind: 'info', text: `${models[cur].title} 已回到開機重設狀態。` }); refresh(); }
  });
  side.addEventListener('change', (e) => {
    if (e.target.name === 'scen') { hint(models[cur].scenarios.set(e.target.value)); refresh(); }
  });

  // e2e 只讀掛鉤：讀狀態做斷言，不提供任何操作入口
  Object.defineProperty(window, '__eess', {
    value: Object.freeze({
      current: () => cur,
      snapshot: (id = cur) => JSON.parse(JSON.stringify(models[id].snapshot())),
      hints: () => hints.map((h) => ({ ...h })),
    }),
  });

  mountPanel();
}
