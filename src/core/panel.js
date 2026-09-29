// 由控制矩陣（穩定 ID＋照片座標）與各台 layout 產生前面板 SVG。
// 座標系＝原照片像素（P1、P2），每台用 layout.viewBox 裁出自己的範圍。
import CONTROLS from '../generated/controls.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STATUS_TEXT = { CORE: '本輪可操作', APPROX: '近似（行為待校機確認）', OUT: '本輪未納入', STATIC: '被動件／標示' };

export function controlMeta(instId) {
  return Object.fromEntries(CONTROLS[instId].map((c) => [c.id, c]));
}

// 多行文字：label 以 \n 分行
function textLines(label, x, y, size, cls = '') {
  const lines = String(label).split('\n');
  const top = y - ((lines.length - 1) * size * 1.1) / 2;
  return lines.map((ln, i) => `<text class="${cls}" x="${x}" y="${top + i * size * 1.1}" font-size="${size}">${esc(ln)}</text>`).join('');
}

function tooltip(meta, spec) {
  const name = spec.label ? spec.label.replace(/\n/g, ' ') : meta.id;
  return `<title>${esc(name)}（${STATUS_TEXT[meta.status]}）\n${esc(meta.fn || '')}</title>`;
}

function shapeSvg(meta, spec) {
  const { x, y } = spec;
  const st = meta.status;
  const interactive = st === 'CORE' || st === 'APPROX' || st === 'OUT';
  const common = `data-id="${meta.id}" class="ctl ${spec.shape} st-${st}${spec.cls ? ` ${spec.cls}` : ''}"` +
    (interactive ? ` tabindex="0" role="button" aria-label="${esc((spec.label || meta.id).replace(/\n/g, ' '))}"` : '');
  const tip = tooltip(meta, spec);
  switch (spec.shape) {
    case 'key': {
      const w = spec.w ?? 30, h = spec.h ?? 18, r = spec.rx ?? 3;
      const fs = spec.fs ?? Math.min(h * 0.5, 9);
      const sub = spec.sub ? textLines(spec.sub, x, y - h / 2 - (spec.subGap ?? 5), spec.subFs ?? 6.5, 'sub') : '';
      return `<g ${common}>${tip}<rect class="cap" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${r}"` +
        `${spec.fill ? ` style="fill:${spec.fill}"` : ''}/>` +
        (spec.label ? textLines(spec.label, x, y + fs * 0.35, fs, `lbl${spec.dark ? ' dark' : ''}`) : '') + sub +
        (spec.led ? `<circle class="keyled" cx="${x + spec.led[0]}" cy="${y + spec.led[1]}" r="${spec.led[2] ?? 2.2}"/>` : '') + '</g>';
    }
    case 'knob': {
      const r = spec.r ?? 14;
      const sub = spec.sub ? textLines(spec.sub, x + (spec.subDx ?? 0), y - r - (spec.subGap ?? 6), spec.subFs ?? 7, 'sub') : '';
      return `<g ${common}>${tip}<circle class="skirt" cx="${x}" cy="${y}" r="${r}"/><circle class="cap" cx="${x}" cy="${y}" r="${r * 0.78}"/>` +
        `<g class="ptr" data-cx="${x}" data-cy="${y}"><line x1="${x}" y1="${y - r * 0.2}" x2="${x}" y2="${y - r * 0.72}"/></g>${sub}</g>`;
    }
    case 'led':
      return `<g ${common}>${tip}<circle class="lamp" cx="${x}" cy="${y}" r="${spec.r ?? 3}"/></g>`;
    case 'bnc': {
      const r = spec.r ?? 13;
      return `<g ${common}>${tip}<circle class="ring" cx="${x}" cy="${y}" r="${r}"/><circle class="body" cx="${x}" cy="${y}" r="${r * 0.62}"/>` +
        `<circle class="pin" cx="${x}" cy="${y}" r="${r * 0.18}"/>` +
        (spec.label ? textLines(spec.label, x + (spec.lx ?? 0), y + (spec.ly ?? -r - 6), spec.fs ?? 7, 'sub') : '') + '</g>';
    }
    case 'post': case 'jack': {
      const r = spec.r ?? 10;
      return `<g ${common}>${tip}<circle class="ring" cx="${x}" cy="${y}" r="${r}" style="stroke:${spec.color ?? '#222'}"/>` +
        `<circle class="hole" cx="${x}" cy="${y}" r="${r * 0.42}"/>` +
        (spec.label ? textLines(spec.label, x + (spec.lx ?? 0), y + (spec.ly ?? -r - 5), spec.fs ?? 6.5, 'sub') : '') + '</g>';
    }
    case 'label':
      return `<g ${common}>${tip}${textLines(spec.label, x, y, spec.fs ?? 7, `plain${spec.dark ? ' dark' : ''}`)}</g>`;
    default:
      return '';
  }
}

// layout = { viewBox:[x,y,w,h], decor: svgString, lcd:{id,x,y,w,h,screen:[W,H]}, shapes:{id:{...}}, skip:[id] }
export function panelSvg(instId, layout) {
  const meta = controlMeta(instId);
  const [vx, vy, vw, vh] = layout.viewBox;
  const parts = [];
  for (const c of CONTROLS[instId]) {
    if (c.id === layout.lcd?.id || layout.skip?.includes(c.id)) continue;
    const spec = layout.shapes[c.id];
    if (!spec) continue; // 後面板、LCD 內的圖示等：不畫成獨立控制項
    const pos = { x: spec.x ?? c.pos?.x, y: spec.y ?? c.pos?.y };
    if (pos.x == null) continue;
    parts.push(shapeSvg(c, { ...spec, ...pos }));
  }
  const L = layout.lcd;
  const lcd = L ? `<g class="lcd-frame" data-id="${L.id}"><title>${esc(meta[L.id]?.label ?? 'LCD')}</title>` +
    `<rect x="${L.x - 3}" y="${L.y - 3}" width="${L.w + 6}" height="${L.h + 6}" rx="3" class="bezel"/>` +
    `<svg class="screen" x="${L.x}" y="${L.y}" width="${L.w}" height="${L.h}" viewBox="0 0 ${L.screen[0]} ${L.screen[1]}" preserveAspectRatio="none"></svg></g>` : '';
  return `<svg class="panel panel-${instId}" viewBox="${vx} ${vy} ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg">` +
    `${layout.decor ?? ''}${lcd}${parts.join('')}</svg>`;
}
