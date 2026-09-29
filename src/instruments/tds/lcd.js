// TDS2001C LCD（320×240，版面依手冊 p.10 顯示區圖）：上方狀態列、10×8 div graticule（25 px/div，GAP-TDS-20）、
// 右側 5 格選單（對齊面板 OPT1–5）、下方讀值與訊息區。波形、量測、游標讀值都取自模型的同一份採集紀錄。
// LCD 只放手冊上的英文字樣；中文說明都在儀器外（common §0.2-5）。
import { fmtV, fmtS, fmtScale, engp, MEAS_NAME, N } from './model.js';
import { clamp } from '../../core/format.js';

const GX = 10, GY = 16, DIV = 25, GW = 250, GH = 200, CX = GX + GW / 2, CY = GY + GH / 2;
const COL = ['#f4e24a', '#46c8f5']; // CH1 黃、CH2 藍
const MX = 262, MW = 57; // 右側選單欄
const BOX = [[20, 58], [62, 100], [104, 143], [147, 185], [189, 219]]; // 對齊面板 OPT1–5（照片 y 443／477／511／545／578 換算）
const INK = '#e9edf1';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const T = (x, y, s, { size = 9, fill = INK, anchor = 'start', weight = 400, cls = '' } = {}) =>
  `<text${cls ? ` class="${cls}"` : ''} x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" style="text-anchor:${anchor}">${esc(s)}</text>`;

function graticule() {
  let grid = '', ticks = '';
  for (let i = 1; i < 10; i++) grid += `M${GX + i * DIV},${GY}v${GH}`;
  for (let j = 1; j < 8; j++) grid += `M${GX},${GY + j * DIV}h${GW}`;
  for (let k = 1; k < 50; k++) ticks += `M${GX + k * 5},${CY - 2}v4`;
  for (let k = 1; k < 40; k++) ticks += `M${CX - 2},${GY + k * 5}h4`;
  return `<rect x="${GX}" y="${GY}" width="${GW}" height="${GH}" fill="none" stroke="#8a9098" stroke-width=".8"/>` +
    `<path d="${grid}" stroke="#5a6068" stroke-width=".6" stroke-dasharray="1 3" fill="none"/>` +
    `<path d="${ticks}" stroke="#737a82" stroke-width=".6" fill="none"/>`;
}

// 一個通道在一筆紀錄上的波形：時間軸以目前 s/div 與 M Pos 對映（停止時也能縮放、移動凍結紀錄）
function trace(m, rec, i) {
  const arr = rec.v[i];
  if (!arr || !m.ch[i].on) return '';
  const c = m.ch[i], base = m.base(i), sd = m.sdiv, left = m.mpos - 5 * sd;
  const X = (t) => GX + ((t - left) / sd) * DIV;
  const Y = (v) => CY - (c.pos + v / base) * DIV; // v 是 BNC 伏特；Probe 設定只改讀值、不改波形大小
  if (rec.band[i]) { // 時基太慢：包絡帶
    const x0 = X(rec.t0), x1 = X(rec.t0 + (N - 1) * rec.dt), yt = Y(Math.max(arr[0], arr[1])), yb = Y(Math.min(arr[0], arr[1]));
    return `<rect class="wave ch${i + 1}" x="${x0.toFixed(1)}" y="${yt.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${Math.max(1, yb - yt).toFixed(1)}" fill="${COL[i]}" opacity=".85"/>`;
  }
  const step = Math.max(1, Math.floor(0.5 / ((rec.dt / sd) * DIV))); // 每像素最多約 2 點
  const pts = [];
  for (let k = 0; k < N; k += step) {
    const x = X(rec.t0 + k * rec.dt);
    if (x >= GX - 20 && x <= GX + GW + 20) pts.push(`${x.toFixed(1)},${clamp(Y(arr[k]), GY - 20, GY + GH + 20).toFixed(1)}`);
  }
  return `<polyline class="wave ch${i + 1}" points="${pts.join(' ')}" fill="none" stroke="${COL[i]}" stroke-width="1.2"${rec.broken ? ' stroke-dasharray="3 2"' : ''}/>`;
}

function waves(m, scan) {
  let w = '';
  if (m.frames) { // Auto 無觸發：幾幀隨機相位輪播，呈現不穩定畫面（GAP-TDS-06）
    const n = m.frames.length;
    w = m.frames.map((r, j) => {
      const vals = m.frames.map((_, k) => (k === j ? 1 : 0)).join(';');
      return `<g opacity="${j === n - 1 ? 1 : 0}"><animate attributeName="opacity" values="${vals}" dur="${0.18 * n}s" repeatCount="indefinite" calcMode="discrete"/>${trace(m, r, 0)}${trace(m, r, 1)}</g>`;
    }).join('');
  } else if (m.rec) w = trace(m, m.rec, 0) + trace(m, m.rec, 1);
  return `<g clip-path="url(#tds-clip)"${scan ? ' mask="url(#tds-scan)"' : ''}>${w}</g>`;
}

// 左側接地參考標記、右緣觸發位準標記、上緣觸發位置標記
function markers(m) {
  let s = '';
  m.ch.forEach((c, i) => {
    if (!c.on) return;
    const y = clamp(CY - c.pos * DIV, GY + 3, GY + GH - 3);
    s += `<g class="gnd${i + 1}">${T(1.5, y + 3, String(i + 1), { size: 8, fill: COL[i], weight: 700 })}<path d="M5.5,${y - 3}L10,${y}L5.5,${y + 3}Z" fill="${COL[i]}"/></g>`;
  });
  const t = m.trig, ly = clamp(CY - (m.ch[t.src].pos + t.level / m.base(t.src)) * DIV, GY + 3, GY + GH - 3);
  s += `<path class="trig-level" d="M${GX + GW},${ly - 3}L${GX + GW - 5},${ly}L${GX + GW},${ly + 3}Z" fill="${COL[t.src]}"/>`;
  const tx = CX - (m.mpos / m.sdiv) * DIV;
  if (tx < GX) s += `<path class="trig-pos" d="M${GX + 1},${GY - 3}l5,-3v6Z" fill="#f39c33"/>`; // 觸發點在畫面左外（delayed sweep）
  else if (tx > GX + GW) s += `<path class="trig-pos" d="M${GX + GW - 1},${GY - 3}l-5,-3v6Z" fill="#f39c33"/>`;
  else s += `<path class="trig-pos" d="M${(tx - 3).toFixed(1)},${GY - 6}h6l-3,5Z" fill="#f39c33"/>`;
  return s;
}

function cursors(m) {
  const ci = m.cursorInfo();
  if (!ci || ci.hidden) return '';
  const cu = m.cursor;
  return [0, 1].map((k) => {
    const dash = m.menu === 'CURSOR' && cu.sel === k ? '' : ' stroke-dasharray="4 3"'; // 作用中的游標為實線
    const d = ci.type === 'TIME' ? `M${CX + cu.t[k]},${GY}v${GH}` : `M${GX},${CY - cu.v[k]}h${GW}`; // 1 步＝1/25 div＝1 px
    return `<path class="cursor c${k + 1}" d="${d}" stroke="#e8e2d0" stroke-width=".9"${dash} fill="none"/>`;
  }).join('');
}

function statusIcon(st) {
  const x = 52, y = 3;
  if (st === "Trig'd") return `<rect x="${x}" y="${y}" width="8" height="8" fill="${INK}"/>${T(x + 4, y + 7, 'T', { size: 7, fill: '#000', anchor: 'middle', weight: 700 })}`;
  if (st === 'Ready' || st === 'Auto') return `<rect x="${x + 0.5}" y="${y + 0.5}" width="7" height="7" fill="none" stroke="${INK}"/>${T(x + 4, y + 7, 'R', { size: 7, anchor: 'middle', weight: 700 })}`;
  if (st === 'Stop' || st === 'Acq. Complete') return `<circle cx="${x + 4}" cy="${y + 4}" r="4" fill="#e04848"/>`;
  return `<rect x="${x + 0.5}" y="${y + 0.5}" width="7" height="7" fill="none" stroke="${INK}"/>`; // Scan、Armed
}

function topLine(m, st) {
  return T(2, 11, 'Tek', { size: 10, weight: 700, fill: '#8cc4ff' }) +
    `<path d="M29,11h3v-7h6v7h3" stroke="${INK}" stroke-width="1" fill="none"/>` + // Sample 模式圖示
    `<g class="rd-status">${statusIcon(st)}${T(63, 11, st, { size: 9 })}</g>` +
    T(150, 11, `M Pos: ${fmtS(m.mpos)}`, { size: 9, cls: 'rd-mpos' });
}

function menu(m) {
  const mi = m.menuItems();
  if (!mi) return '';
  const cx = MX + MW / 2;
  let s = `<rect x="${MX}" y="1" width="${MW}" height="17" fill="#2b3a4b"/>${T(cx, 13, mi.title, { size: 9, anchor: 'middle', weight: 700, cls: 'mtitle' })}`;
  mi.items.forEach((it, j) => {
    const [y0, y1] = BOX[j], n = it.lines.length, mid = (y0 + y1) / 2;
    s += `<g class="mb mb${j + 1}"><rect x="${MX}" y="${y0}" width="${MW}" height="${y1 - y0}" fill="#141d27" stroke="#3f5163" stroke-width=".8"/>`;
    it.lines.forEach((ln, k) => {
      const y = mid + (k - (n - 1) / 2) * 9.5 + 3;
      const hot = it.hot.includes(k) && ln !== '';
      if (hot) { const w = Math.min(MW - 3, ln.length * 4.6 + 4); s += `<rect x="${cx - w / 2}" y="${y - 7.5}" width="${w}" height="9.5" fill="#dfe6ee"/>`; }
      s += T(cx, y, ln, { size: 8.3, anchor: 'middle', fill: hot ? '#0b1520' : INK });
    });
    s += '</g>';
  });
  return s;
}

function bottom(m) {
  let s = '';
  m.ch.forEach((c, i) => {
    if (!c.on) return;
    const x = i === 0 ? 2 : 66;
    s += T(x, 229, `CH${i + 1} ${fmtV(m.vdiv(i))}`, { size: 9, fill: COL[i], cls: `rd-ch${i + 1}` });
    if (c.bw) s += T(x + 55, 229, 'BW', { size: 5.5, fill: COL[i] }); // BW Limit 圖示（p.11 項 9）
  });
  const t = m.trig, slope = t.slope === 'R' ? 'M207,229h3l3,-7h3' : 'M207,222h3l3,7h3';
  s += T(132, 229, `M ${fmtScale(m.sdiv)}`, { size: 9, cls: 'rd-m' });
  s += `<g class="rd-trig">${T(186, 229, `CH${t.src + 1}`, { size: 9 })}<path d="${slope}" stroke="${INK}" stroke-width="1" fill="none"/>${T(219, 229, fmtV(m.levelV()), { size: 9 })}</g>`;
  if (m.msg) s += T(2, 239, m.msg, { size: 8.3, cls: 'rd-msg' });
  const f = m.trigFreq();
  if (f) s += T(318, 239, `${engp(f, 6)}Hz`, { size: 8.3, anchor: 'end', cls: 'rd-freq' });
  return s;
}

// AutoSet 後在 graticule 區顯示的自動量測（p.19、p.80–81；只在 AutoSet 選單顯示時出現，PD）
function autoMeas(m) {
  const a = m.autoMeas;
  if (m.menu !== 'AUTOSET' || !a) return '';
  const rows = Math.ceil(a.types.length / 2), y0 = GY + GH - 2 - rows * 11;
  let s = `<rect x="${GX + 1}" y="${y0}" width="${GW - 2}" height="${rows * 11 + 1}" fill="#000" opacity=".75"/>`;
  a.types.forEach((ty, k) => {
    const x = GX + 5 + (k % 2) * 124, y = y0 + 9 + Math.floor(k / 2) * 11;
    s += T(x, y, `CH${a.src + 1} ${MEAS_NAME[ty]} ${m.measure(a.src, ty).text}`, { size: 8.3, fill: COL[a.src], cls: `am am${k + 1}` });
  });
  return s;
}

export function renderLcd(m) {
  const st = m.trigStatus(), scan = st === 'Scan';
  // Scan：一格寬的空白區由左往右移動（p.77），代表新舊資料的交界；週期＝10 div × s/div（簡化呈現，GAP-TDS-08）
  const mask = scan ? `<mask id="tds-scan"><rect x="0" y="0" width="320" height="240" fill="#fff"/><rect y="${GY}" width="${DIV}" height="${GH}" fill="#000">` +
    `<animate attributeName="x" from="${GX - DIV}" to="${GX + GW}" dur="${10 * m.sdiv}s" repeatCount="indefinite"/></rect></mask>` : '';
  return `<rect width="320" height="240" fill="#000"/>` +
    `<defs><clipPath id="tds-clip"><rect x="${GX}" y="${GY}" width="${GW}" height="${GH}"/></clipPath>${mask}</defs>` +
    graticule() + waves(m, scan) + cursors(m) + markers(m) + autoMeas(m) + topLine(m, st) + menu(m) + bottom(m);
}
