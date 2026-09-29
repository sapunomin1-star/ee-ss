// 34460A LCD（模擬座標 480×318）。版面依 datasheet p.3–4 的 Number view 產品照（行銷合成畫面，PD）：
// 左上功能名分頁、上方 Auto Trigger、藍灰讀值區（大字讀值、右下單位、左下量程），最下列 S1–S6 軟鍵標籤。
// 只放英文字樣與不含文字的記號；中文說明都在儀器外（common §0.2-5）。
import layout from './layout.js';

const W = 480;
const AMBER = '#f6b52a', SLATE = '#38566f', INK = '#eef2f5', GREEN = '#46d160';
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const T = (x, y, s, { size = 16, fill = INK, anchor = 'start', weight = 400 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" style="text-anchor:${anchor}">${esc(s)}</text>`;
// 大字讀值：Arial 橫向壓縮，接近產品照的瘦長數字
const BIG = (x, s, anchor) =>
  `<text transform="translate(${x} 172) scale(0.84 1)" font-size="104" fill="${AMBER}" style="text-anchor:${anchor}">${esc(s)}</text>`;

// 軟鍵標籤中心＝面板上 S1–S6 的照片 x（矩陣 photo_location 128…345）換算到 LCD 座標
const SOFT_X = [128, 171, 214, 257, 300, 345].map((x) => ((x - layout.lcd.x) / layout.lcd.w) * W);

// 導通指示：跟 Cont 鍵面相同的 ·)) 圖形（不含文字，common §0.2-5 第 (3) 級）
const beepMark = (x, y) =>
  `<circle cx="${x}" cy="${y}" r="5" fill="${GREEN}"/><g fill="none" stroke="${GREEN}" stroke-width="3.5" stroke-linecap="round">` +
  `<path d="M${x + 9} ${y - 9} A13 13 0 0 1 ${x + 9} ${y + 9}"/><path d="M${x + 15} ${y - 16} A22 22 0 0 1 ${x + 15} ${y + 16}"/></g>`;

function softKey(cx, k) {
  let s = `<rect x="${cx - 36}" y="252" width="72" height="62" fill="#565d62"/><rect x="${cx - 36}" y="252" width="72" height="30" fill="#6b7277"/>`;
  if (!k) return s;
  s += T(cx, 273, k.label, { size: 14, anchor: 'middle' });
  if (k.opts) {
    k.opts.forEach((o, j) => { s += T(cx + (j ? 17 : -17), 302, o, { size: 14, fill: j === k.sel ? AMBER : '#c4c9cd', anchor: 'middle', weight: 700 }); });
  } else {
    s += T(cx, 302, k.value, { size: 14, fill: AMBER, anchor: 'middle', weight: 700 });
  }
  return s;
}

export function renderLcd(v) {
  let s = '<rect width="480" height="318" fill="#000"/>';
  s += `<rect x="6" y="4" width="176" height="40" rx="6" fill="${SLATE}"/>` + T(16, 32, v.fnName, { size: 22, fill: AMBER, weight: 700 });
  s += T(300, 30, 'Auto Trigger', { size: 17, fill: GREEN, anchor: 'middle' });
  if (v.nullOn) s += `<rect x="408" y="11" width="60" height="26" rx="4" fill="none" stroke="${AMBER}" stroke-width="1.5"/>` + T(438, 30, 'Null', { size: 18, fill: AMBER, anchor: 'middle', weight: 700 });
  s += `<rect x="6" y="38" width="468" height="206" rx="6" fill="${SLATE}"/>`;
  if (v.state === 'value') s += BIG(462, v.text, 'end');
  else if (v.text) s += BIG(240, v.text, 'middle'); // 超量程「-------」、導通開路 OPEN；沒有相容輸入時留空
  if (v.beep) s += beepMark(34, 72);
  if (v.unit) s += T(462, 230, v.unit, { size: 42, fill: AMBER, anchor: 'end' });
  if (v.rangeLabel) s += T(18, 232, v.rangeLabel, { size: 18 });
  SOFT_X.forEach((cx, i) => { s += softKey(cx, v.soft[i]); });
  return s;
}
