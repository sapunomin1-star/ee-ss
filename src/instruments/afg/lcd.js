// AFG-2225 LCD（320×240，版面依手冊 p.61–63 截圖）：兩通道 status tab、參數窗、波形區、編輯框、F1–F5 軟鍵。
// 所有字串都由同一份狀態格式化而來（AFG-F16）；LCD 只放原廠英文字樣。
import { MENUS, UNIT_TEXT, fmtAmpl, fmtOffset, freqParts } from './model.js';
import { fmtFixed } from '../../core/format.js';
import { emf, waveCuts } from '../../bench/circuit.js';
import { motionFrequency, maxMotionRate } from './motion.js';
import { tableData } from './extensions.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const T = (x, y, s, { size = 11, fill = '#10213a', anchor = 'start', weight = 400 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" style="text-anchor:${anchor}">${esc(s)}</text>`;

function motionPreview(c) {
  const period=1/motionFrequency(c),motion=c.extended.motion,gain=motion.mode==='MOD'&&['AM','SUM'].includes(motion.type)?1+(motion.type==='AM'?motion.depth:motion.sum)/100:1,scale=Math.max(1,c.emfVpp/2*gain);
  const buckets=Array.from({length:240},()=>({min:Infinity,max:-Infinity})),density=Math.min(64000,Math.max(480,Math.ceil(maxMotionRate(c)*period*48)));
  const put=t=>{if(t<0||t>=period)return;const b=buckets[Math.min(239,Math.floor(t/period*240))],v=emf(c,t)-c.emfOffset;b.min=Math.min(b.min,v);b.max=Math.max(b.max,v);};
  for(let i=0;i<density;i++)put(i/density*period);
  // Pixel envelopes retain fast carriers and short Pulse/ARB platforms instead
  // of drawing an aliased low-frequency line across a slow sweep/burst window.
  for(const t of waveCuts(c,period)){const d=period/density*1e-6;put(t-d);put(t+d);}
  return buckets.map((b,i)=>`M${10+i} ${174-18*b.min/scale}V${174-18*b.max/scale}`).join(' ');
}

function wavePath(c, x0, y0, w, h) {
  const n = 160, periods = 2, mid = y0 + h / 2, A = h * 0.34;
  const offset = ['SQUARE', 'PULSE', 'NOISE'].includes(c.wave) ? 0 : (c.phase ?? 0) / 360, data = tableData(c);
  const times = Array.from({ length: n + 1 }, (_, i) => i / n * periods), pts = [];
  if (['SQUARE', 'RAMP', 'PULSE'].includes(c.wave)) {
    const corner = c.wave === 'SQUARE' ? (c.duty ?? 50) / 100 : c.wave === 'PULSE' ? (c.extended?.pulseWidth ?? 100e-6) * c.freq : c.sym / 100;
    for (let cycle = -1; cycle <= periods + 1; cycle++) for (const edge of [0, corner]) {
      const t = cycle + edge - offset;
      if (t > 0 && t < periods) { times.push(t); if (c.wave !== 'RAMP') times.push(t - 1e-9); }
    }
  }
  times.sort((a, b) => a - b);
  for (const at of times) {
    const t = at + offset;
    const ph = t - Math.floor(t);
    let v;
    if (c.wave === 'SINE') v = Math.sin(2 * Math.PI * t);
    else if (c.wave === 'SQUARE') v = ph < (c.duty ?? 50) / 100 ? 1 : -1;
    else if (c.wave === 'PULSE') v = ph < (c.extended?.pulseWidth ?? 100e-6) * c.freq ? 1 : -1;
    else if (data) v = data.points[data.start + Math.min(data.length - 1, Math.floor(ph * data.length))] / 511;
    else { const s = Math.min(Math.max(c.sym / 100, 1e-6), 1 - 1e-6); v = ph < s ? -1 + (2 * ph) / s : 1 - (2 * (ph - s)) / (1 - s); }
    pts.push(`${(x0 + at / periods * w).toFixed(1)},${(mid - v * A).toFixed(1)}`);
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
  if (key === 'AMPL') return [fmtAmpl(m.refVpp(c), c.unit, c), UNIT_TEXT[c.unit], c.unit.startsWith('M') ? 1e-3 : 1];
  if (key === 'WIDTH') return [fmtFixed((c.extended?.pulseWidth ?? 100e-6) * 1e6, 3), 'uSEC', 1e-6];
  if (key === 'RATE') return [fmtFixed(c.extended?.arb.rate / 1e6, 3), 'MSa/s', 1e6];
  if (key === 'OFFSET') return [fmtOffset(m.refOffset(c), c.offUnit), UNIT_TEXT[c.offUnit], c.offUnit === 'MVDC' ? 1e-3 : 1];
  if (key === 'PHASE') return [fmtFixed(c.phase ?? 0, 1), '°', 1];
  return [fmtFixed(key === 'DUTY' ? c.duty ?? 50 : c.sym, 1), '%', 1];
}

function channelBlock(m, i, x0) {
  const c = m.ch[i];
  const selected = m.sel === i;
  const w = 126;
  const tabFill = selected ? (i === 0 ? '#f3d21a' : '#8ccaf5') : '#7d8792';
  const panelFill = selected ? '#d4ebfb' : '#aab4be';
  const ink = selected ? '#10213a' : '#3c4650';
  const rows = [['FREQ', 'FREQ'], ['AMPL', 'AMPL'], ['Offset', 'OFFSET']];
  if (c.wave === 'NOISE') rows.shift();
  if (c.wave === 'ARB') rows[0] = ['Rate', 'RATE'];
  if (c.wave === 'RAMP') rows.push(['SYMM', 'SYM']);
  if (c.wave === 'SQUARE') rows.push(['Duty', 'DUTY']);
  if (c.wave === 'PULSE') rows.push(['Width', 'WIDTH']);
  const rh = rows.length > 3 ? 13 : 16;
  let s = `<rect x="${x0}" y="3" width="${w}" height="18" rx="3" fill="${tabFill}"/>` +
    T(x0 + 5, 16, `CH${i + 1}`, { size: 12, weight: 700, fill: '#10213a' }) +
    T(x0 + 42, 16, c.output ? 'ON' : 'OFF', { size: 10, weight: 700, fill: c.output ? '#0a6b19' : '#6b1010' }) +
    T(x0 + w - 5, 16, c.load50 ? '50 Ω' : 'High Z', { size: 10, anchor: 'end' }) +
    `<rect x="${x0}" y="23" width="${w}" height="${rh * (rows.length + 1) + 6}" fill="${panelFill}"/>`;
  rows.forEach(([name, key], r) => {
    const y = 36 + r * rh;
    const hot = selected && (m.hl === key || m.hl === `X_${key}`);
    const [val, unit] = paramText(m, c, key);
    const col = hot ? '#d00000' : ink;
    s += T(x0 + 4, y, `${name}:`, { size: 10, fill: col, weight: 700 }) + T(x0 + 96, y, val, { size: 10, fill: col, anchor: 'end' }) + T(x0 + 99, y, unit, { size: 9, fill: col });
  });
  const py = 36 + rows.length * rh;
  const phaseInk = selected && m.hl === 'PHASE' ? '#d00000' : ink;
  s += T(x0 + 4, py, 'Phase:', { size: 10, fill: phaseInk, weight: 700 }) + T(x0 + 96, py, fmtFixed(['SQUARE', 'PULSE', 'NOISE'].includes(c.wave) ? 0 : c.phase ?? 0, 1), { size: 10, fill: phaseInk, anchor: 'end' }) + T(x0 + 99, py, '°', { size: 9, fill: phaseInk });
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
  const extra = m.extensionRows();
  if (extra.length) {
    s += '<rect x="3" y="3" width="255" height="194" fill="#d4ebfb"/>' + T(12, 18, `CH${m.sel + 1} ${m.menu.replaceAll('_', ' ')}`, { size: 11, weight: 700 });
    extra.forEach(([name, value], i) => {
      const y = 34 + i * 11;
      if (y > 192) return;
      const slot = name.match(/^Memory(\d)$/), occupied = slot && m.extended.memories[Number(slot[1])];
      s += T(12, y, `${name}:`, { size: 9, fill: slot ? occupied ? '#b00000' : '#184d99' : '#10213a', weight: 700 }) + T(108, y, value, { size: 9, fill: slot && Number(slot[1]) === m.extended.memoryIndex ? '#d00000' : '#10213a' });
    });
    if(m.c.extended.motion.mode!=='CONT' && !m.menu.startsWith('MEMORY') && !m.menu.startsWith('ARB')) {s+='<rect x="10" y="151" width="240" height="43" fill="#163b6f"/>'+`<defs><clipPath id="afg-motion-clip"><rect x="10" y="151" width="240" height="43"/></clipPath></defs><path d="${motionPreview(m.c)}" fill="none" stroke="#ffe14d" stroke-width="1" clip-path="url(#afg-motion-clip)"/>`+T(12,159,'Preview',{size:7,fill:'#cce3ff'}); }
    if (m.menu.startsWith('ARB') && m.c.extended.arb.display) {
      const a = m.c.extended.arb, y0 = 140, wh = 53, x0 = 10, w = 240;
      s += `<rect x="${x0}" y="${y0}" width="${w}" height="${wh}" fill="#163b6f"/>`;
      const left = Math.max(a.displayStart, a.protectStart), right = Math.min(a.displayStart + a.displayLength, a.protectStart + a.protectLength);
      if (right > left) s += `<rect x="${x0 + w * (left - a.displayStart) / a.displayLength}" y="${y0}" width="${w * (right - left) / a.displayLength}" height="${wh}" fill="#7d4b11"/>`;
      const points = Array.from({ length: 241 }, (_, k) => { const index = Math.min(4095, a.displayStart + Math.floor(k / 240 * (a.displayLength - 1))), v = a.points[index]; return `${x0 + k},${y0 + wh * (1 - (v - a.low) / (a.high - a.low))}`; });
      s += `<defs><clipPath id="afg-arb-clip"><rect x="${x0}" y="${y0}" width="${w}" height="${wh}"/></clipPath></defs><polyline points="${points.join(' ')}" fill="none" stroke="#ffe14d" stroke-width="1.2" clip-path="url(#afg-arb-clip)"/>`;
    }
  }
  // 編輯框：有參數高亮時顯示（輸入中的數字，或目前值＋單位與游標底線）
  if (m.hl) {
    const { text, unit, mult } = m.editParts();
    s += '<rect x="22" y="202" width="214" height="30" rx="2" fill="#f7fbff" stroke="#d00000" stroke-width="1.2"/>';
    if (m.buf) {
      s += T(128, 223, `${m.buf}_`, { size: 16, fill: '#d00000', anchor: 'middle', weight: 700 });
    } else {
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
