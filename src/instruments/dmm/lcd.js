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
const BIG = (x, s, anchor, y = 172, size = 104) =>
  `<text transform="translate(${x} ${y}) scale(0.84 1)" font-size="${size}" fill="${AMBER}" style="text-anchor:${anchor}">${esc(s)}</text>`;

// 軟鍵標籤中心＝面板上 S1–S6 的照片 x（矩陣 photo_location 128…345）換算到 LCD 座標
const SOFT_X = [128, 171, 214, 257, 300, 345].map((x) => ((x - layout.lcd.x) / layout.lcd.w) * W);

// 導通指示：跟 Cont 鍵面相同的 ·)) 圖形（不含文字，common §0.2-5 第 (3) 級）
const beepMark = (x, y) =>
  `<circle cx="${x}" cy="${y}" r="5" fill="${GREEN}"/><g fill="none" stroke="${GREEN}" stroke-width="3.5" stroke-linecap="round">` +
  `<path d="M${x + 9} ${y - 9} A13 13 0 0 1 ${x + 9} ${y + 9}"/><path d="M${x + 15} ${y - 16} A22 22 0 0 1 ${x + 15} ${y + 16}"/></g>`;

function softKey(cx, k) {
  let s = `<rect x="${cx - 36}" y="252" width="72" height="62" fill="#565d62"/><rect x="${cx - 36}" y="252" width="72" height="30" fill="#6b7277"/>`;
  if (!k) return s;
  s += T(cx, 273, k.label, { size: Math.min(14, 118 / Math.max(1, k.label.length)), anchor: 'middle' });
  if (k.opts) {
    k.opts.forEach((o, j) => { s += T(cx + (j ? 17 : -17), 302, o, { size: 14, fill: j === k.sel ? AMBER : '#c4c9cd', anchor: 'middle', weight: 700 }); });
  } else {
    s += T(cx, 302, k.value, { size: 14, fill: AMBER, anchor: 'middle', weight: 700 });
  }
  return s;
}

export function renderLcd(v) {
  const compact = !v.histogram && !v.probe && (!!v.stats || v.displayMode === 'BAR'), primaryY = v.secondary ? compact ? 100 : 113 : compact ? 117 : 172;
  const primarySize = v.secondary ? compact ? 64 : 78 : compact ? 74 : 104;
  let s = '<rect width="480" height="318" fill="#000"/>';
  s += `<rect x="6" y="4" width="176" height="40" rx="6" fill="${SLATE}"/>` + T(16, 32, v.fnName, { size: 22, fill: AMBER, weight: 700 });
  s += T(300, 30, v.triggerLabel ?? 'Auto Trigger', { size: 17, fill: GREEN, anchor: 'middle' });
  if (v.nullOn) s += `<rect x="408" y="11" width="60" height="26" rx="4" fill="none" stroke="${AMBER}" stroke-width="1.5"/>` + T(438, 30, 'Null', { size: 18, fill: AMBER, anchor: 'middle', weight: 700 });
  s += `<rect x="6" y="38" width="468" height="206" rx="6" fill="${SLATE}"/>`;
  if (v.state === 'value' && !v.histogram && !v.probe) s += BIG(462, v.text, 'end', primaryY, primarySize);
  else if (v.state !== 'value' && v.text && !v.histogram && !v.probe) s += BIG(240, v.text, 'middle', primaryY, primarySize); // 超量程、開路；無輸入時留空
  if (v.beep) s += beepMark(34, 72);
  if (v.unit && !v.histogram) s += T(462, v.secondary ? compact ? 117 : 130 : compact ? 144 : 230, v.unit, { size: v.secondary ? compact ? 22 : 26 : compact ? 24 : v.probe ? 20 : 42, fill: AMBER, anchor: 'end' });
  if (v.rangeLabel) s += T(18, v.histogram && v.stats ? 242 : compact ? 239 : 232, v.rangeLabel, { size: v.histogram && v.stats ? 14 : compact ? 15 : 18 });
  if (v.displayMode === 'BAR' && v.bar != null) {
    const y = compact ? 158 : 188, origin = 34 + (v.barScale?.zero ?? .5) * 412;
    s += `<rect x="34" y="${y}" width="412" height="10" fill="#182f43"/><path d="M${origin} ${y - 6}v22" stroke="#eee" stroke-width="1"/>`;
    const x = 34 + v.bar * 412;
    s += `<rect data-dmm-bar="1" x="${Math.min(x, origin)}" y="${y}" width="${Math.max(1, Math.abs(x - origin))}" height="10" fill="${AMBER}"/>`;
    if (v.barScale) s += T(34, y + 28, Number(v.barScale.low.toPrecision(5)), { size: 12 }) + T(240, y + 28, v.barScale.unit, { size: 12, anchor: 'middle' }) + T(446, y + 28, Number(v.barScale.high.toPrecision(5)), { size: 12, anchor: 'end' });
  }
  if (v.secondary) {
    const y = compact ? 120 : 135;
    s += `<rect data-dmm-secondary="1" x="16" y="${y}" width="448" height="${compact ? 37 : 44}" rx="4" fill="#25445b"/>` + T(24, y + 14, v.secondary.kind, { size: 14, fill: GREEN }) + T(455, y + (compact ? 31 : 38), v.secondary.text, { size: compact ? 17 : 18, fill: AMBER, anchor: 'end' });
  }
  if (v.histogram) {
    const h = v.histogram, max = Math.max(1, ...h.counts), w = 350 / h.counts.length, baseline = v.stats ? 174 : 201, heightLimit = v.stats ? 70 : 92, ticks = v.stats ? 188 : 216;
    s += T(18, 65, `${v.text || '-------'} ${v.unit}`, { size: 22, fill: AMBER });
    s += T(18, 91, `Total ${h.total}`, { size: 15 });
    s += `<path data-dmm-hist-axis="1" d="M102 103v${baseline - 102}h350" fill="none" stroke="#bcc7d0"/>`;
    let cumulative = 0; const total = Math.max(1, h.counts.reduce((a, b) => a + b, 0)), points = [];
    h.counts.forEach((count, i) => {
      const height = heightLimit * count / max, x = 103 + i * w;
      s += `<rect data-dmm-bin="${i}" x="${x}" y="${baseline - height}" width="${Math.max(.2, w - .7)}" height="${height}" fill="${AMBER}"/>`;
      cumulative += count; points.push(`${x + w / 2},${baseline - heightLimit * cumulative / total}`);
    });
    if (h.cumulative) s += `<polyline data-dmm-cumulative="1" points="${points.join(' ')}" fill="none" stroke="${GREEN}" stroke-width="2"/>`;
    s += T(103, ticks, Number(h.low.toPrecision(4)), { size: 12 }) + T(452, ticks, Number(h.high.toPrecision(4)), { size: 12, anchor: 'end' }) + T(278, ticks, h.unit ?? '', { size: 12, anchor: 'middle' });
  }
  if (v.probe) {
    s += T(18, 65, `Probe Hold  ${v.probe.length}/8`, { size: 18, fill: GREEN });
    v.probe.forEach((r, i) => { s += T(18 + Math.floor(i / 4) * 226, 96 + (i % 4) * 30, `${i + 1}: ${r.text} ${r.displayUnit ?? r.unit}`, { size: 18, fill: AMBER }); });
  }
  if (v.stats) {
    const st = v.stats, n = (x) => Number(x.toPrecision(5));
    const lines = st.count ? [`[${st.unit ?? ''}] N ${st.count}  Min ${n(st.min)}  Max ${n(st.max)}`, ...(st.hideMean ? [] : [`Avg ${n(st.mean)}  SD ${n(st.sd)}`])] : ['N 0'];
    const dense = compact || !!v.histogram, y = v.histogram ? 198 : compact ? 190 : 180;
    s += `<rect data-dmm-stats="1" x="10" y="${y}" width="455" height="${dense ? 30 : 36}" fill="#203f58"/>`;
    lines.forEach((line, i) => { s += T(18, y + (dense ? 12 : 14) + i * (dense ? 13 : 16), line, { size: dense ? 12 : 14 }); });
  }
  if (v.edit) {
    s += `<rect x="10" y="180" width="455" height="36" fill="#203f58"/>` + T(18, 203, `${v.edit.label}: ${v.edit.value}  Step: ${v.edit.step}`, { size: 17, fill: AMBER });
  }
  if (v.limit) s += '<rect data-dmm-limit="1" x="7" y="39" width="466" height="204" rx="6" fill="none" stroke="#ff554c" stroke-width="4"/>';
  if (v.limits) s += T(210, 232, `Lo ${v.limits.low}  Hi ${v.limits.high}`, { size: 14, fill: v.limit ? '#ffb1a9' : GREEN, anchor: 'middle' });
  SOFT_X.forEach((cx, i) => { s += softKey(cx, v.soft[i]); });
  return s;
}
