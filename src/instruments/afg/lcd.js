// AFG-2225 LCD（320×240，版面依手冊 p.61–63 截圖）：兩通道 status tab、參數窗、波形區、編輯框、F1–F5 軟鍵。
// 所有字串都由同一份狀態格式化而來（AFG-F16）；LCD 只放原廠英文字樣。
import { MENUS, UNIT_TEXT, fmtAmpl, fmtOffset, freqParts } from './model.js';
import { fmtFixed } from '../../core/format.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const T = (x, y, s, { size = 11, fill = '#10213a', anchor = 'start', weight = 400 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" style="text-anchor:${anchor}">${esc(s)}</text>`;

function wavePath(c, x0, y0, w, h) {
  const n = 160, periods = 2, mid = y0 + h / 2, A = h * 0.34;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * periods;
    const ph = t - Math.floor(t);
    let v;
    if (c.wave === 'SINE') v = Math.sin(2 * Math.PI * t);
    else if (c.wave === 'SQUARE') v = ph < 0.5 ? 1 : -1;
    else { const s = Math.min(Math.max(c.sym / 100, 1e-6), 1 - 1e-6); v = ph < s ? -1 + (2 * ph) / s : 1 - (2 * (ph - s)) / (1 - s); }
    pts.push(`${(x0 + (i / n) * w).toFixed(1)},${(mid - v * A).toFixed(1)}`);
  }
  return pts.join(' ');
}

// 游標底線：字串中位權為 10^k（顯示單位）的字元位置
function cursorIndex(text, k) {
  const dot = text.indexOf('.');
  const intLen = (dot < 0 ? text.length : dot) - (text.startsWith('-') ? 1 : 0);
  const sign = text.startsWith('-') ? 1 : 0;
  if (k >= 0) return k < intLen ? sign + intLen - 1 - k : -1;
  const idx = (dot < 0 ? text.length : dot) - k;
  return dot >= 0 && idx < text.length ? idx : -1;
}

function paramText(m, c, key) {
  if (key === 'FREQ') { const p = freqParts(c.freq); return [p.text, p.unit, p.mult]; }
  if (key === 'AMPL') return [fmtAmpl(m.refVpp(c), c.unit, c.wave), UNIT_TEXT[c.unit], c.unit.startsWith('M') ? 1e-3 : 1];
  if (key === 'OFFSET') return [fmtOffset(m.refOffset(c), c.offUnit), UNIT_TEXT[c.offUnit], c.offUnit === 'MVDC' ? 1e-3 : 1];
  return [fmtFixed(c.sym, 1), '%', 1];
}

function channelBlock(m, i, x0) {
  const c = m.ch[i];
  const selected = m.sel === i;
  const w = 126;
  const tabFill = selected ? (i === 0 ? '#f3d21a' : '#8ccaf5') : '#7d8792';
  const panelFill = selected ? '#d4ebfb' : '#aab4be';
  const ink = selected ? '#10213a' : '#3c4650';
  const rows = [['FREQ', 'FREQ'], ['AMPL', 'AMPL'], ['Offset', 'OFFSET']];
  if (c.wave === 'RAMP') rows.push(['SYMM', 'SYM']);
  const rh = c.wave === 'RAMP' ? 13 : 16;
  let s = `<rect x="${x0}" y="3" width="${w}" height="18" rx="3" fill="${tabFill}"/>` +
    T(x0 + 5, 16, `CH${i + 1}`, { size: 12, weight: 700, fill: '#10213a' }) +
    T(x0 + 42, 16, c.output ? 'ON' : 'OFF', { size: 10, weight: 700, fill: c.output ? '#0a6b19' : '#6b1010' }) +
    T(x0 + w - 5, 16, c.load50 ? '50 Ω' : 'High Z', { size: 10, anchor: 'end' }) +
    `<rect x="${x0}" y="23" width="${w}" height="${rh * (rows.length + 1) + 6}" fill="${panelFill}"/>`;
  rows.forEach(([name, key], r) => {
    const y = 36 + r * rh;
    const hot = selected && m.hl === key;
    const [val, unit] = paramText(m, c, key);
    const col = hot ? '#d00000' : ink;
    s += T(x0 + 4, y, `${name}:`, { size: 10, fill: col, weight: 700 }) + T(x0 + 96, y, val, { size: 10, fill: col, anchor: 'end' }) + T(x0 + 99, y, unit, { size: 9, fill: col });
  });
  const py = 36 + rows.length * rh;
  s += T(x0 + 4, py, 'Phase:', { size: 10, fill: ink, weight: 700 }) + T(x0 + 96, py, '0.0', { size: 10, fill: ink, anchor: 'end' }) + T(x0 + 99, py, '°', { size: 9, fill: ink });
  const wy = 30 + rh * (rows.length + 1) + 4;
  const wh = 196 - wy;
  s += `<rect x="${x0}" y="${wy}" width="${w}" height="${wh}" fill="#1f4f9e"/>` +
    `<line x1="${x0 + 4}" y1="${wy + wh / 2}" x2="${x0 + w - 4}" y2="${wy + wh / 2}" stroke="#6f93cf" stroke-dasharray="3 3" stroke-width=".7"/>` +
    `<polyline points="${wavePath(c, x0 + 6, wy + 6, w - 12, wh - 12)}" fill="none" stroke="${i === 0 ? '#ffe14d' : '#7fe0ff'}" stroke-width="1.6" opacity="${selected ? 1 : 0.6}"/>`;
  return s;
}

export function renderLcd(m) {
  let s = '<rect x="0" y="0" width="320" height="240" fill="#0d2a63"/>';
  s += channelBlock(m, 0, 3) + channelBlock(m, 1, 132);
  // 編輯框：有參數高亮時顯示（輸入中的數字，或目前值＋單位與游標底線）
  if (m.hl) {
    const c = m.c;
    const [val, unit, mult] = paramText(m, c, m.hl);
    s += '<rect x="22" y="202" width="214" height="30" rx="2" fill="#f7fbff" stroke="#d00000" stroke-width="1.2"/>';
    if (m.buf) {
      s += T(128, 223, `${m.buf}_`, { size: 16, fill: '#d00000', anchor: 'middle', weight: 700 });
    } else {
      const text = m.hl === 'FREQ' ? fmtFixed(c.freq / mult, Math.max(0, 9 - Math.max(1, Math.floor(Math.log10(c.freq / mult) + 1e-9) + 1))) : val;
      const k = Math.round(m.cexp - Math.log10(mult));
      const idx = cursorIndex(text, k);
      const cw = 9.4;
      const x0 = 128 - ((text.length + unit.length + 1) * cw) / 2;
      s += `<text x="${x0}" y="223" font-size="16" font-family="Menlo, Consolas, monospace" fill="#d00000" font-weight="700" style="text-anchor:start">${esc(`${text} ${unit}`)}</text>`;
      if (idx >= 0) s += `<rect x="${x0 + idx * cw + 0.5}" y="226" width="${cw - 1.5}" height="2" fill="#d00000"/>`;
    }
  }
  // F1–F5 軟鍵標籤
  // 標籤中心對齊面板上 F1–F5 實體鍵的高度（照片 y 111／144／177／208／241 換算到 LCD 座標）
  const SOFT_Y = [34, 76, 117, 157, 198];
  MENUS[m.menu].forEach((label, i) => {
    const y = SOFT_Y[i] - 19;
    s += `<rect x="262" y="${y}" width="55" height="38" rx="4" fill="${label ? '#2a3d5c' : '#152440'}" stroke="#6b86ad" stroke-width=".8"/>`;
    if (label) {
      const lines = label.split(' ');
      lines.forEach((ln, j) => { s += T(289.5, SOFT_Y[i] + 4 + (j - (lines.length - 1) / 2) * 12, ln, { size: 11, fill: '#fff', anchor: 'middle', weight: 700 }); });
    }
  });
  return s;
}
