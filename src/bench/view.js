// 實驗台畫面：導線端（AFG 鱷魚夾、示波器探棒、電表測試線）＋ RC 電路板＋三台的即時小螢幕。
// 接線：點導線端（變藍）→ 點接點 A／B／G；已接的導線端再點一次（變藍後）再點一次＝拔掉。
import { LEADS } from './circuit.js';
import { R_OPTIONS, C_OPTIONS, fmtR, fmtC } from './bench.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const POST = { A: [455, 380], B: [585, 380], G: [585, 540] };
// 導線端位置、顏色、短標籤
const END = {
  'AFG.CH1+': { x: 352, y: 70, color: '#d32f2f', label: 'CH1 紅夾' },
  'AFG.CH1-': { x: 352, y: 108, color: '#222', label: 'CH1 黑夾' },
  'AFG.CH2+': { x: 352, y: 170, color: '#d32f2f', label: 'CH2 紅夾' },
  'AFG.CH2-': { x: 352, y: 208, color: '#222', label: 'CH2 黑夾' },
  'TDS.CH1.TIP': { x: 648, y: 70, color: '#e0b800', label: 'CH1 尖端' },
  'TDS.CH1.GND': { x: 648, y: 108, color: '#222', label: 'CH1 接地夾' },
  'TDS.CH2.TIP': { x: 648, y: 170, color: '#1e9bd7', label: 'CH2 尖端' },
  'TDS.CH2.GND': { x: 648, y: 208, color: '#222', label: 'CH2 接地夾' },
  'DMM.HI': { x: 352, y: 470, color: '#d32f2f', label: 'HI（紅）' },
  'DMM.LO': { x: 352, y: 530, color: '#222', label: 'LO（黑）' },
};
const LEFT_SIDE = (id) => !id.startsWith('TDS');

function mini(model, x, y, w, h, screen, goto, title) {
  const body = model.isOn() ? model.lcd() : `<rect width="${screen[0]}" height="${screen[1]}" fill="#050505"/>`;
  return `<g class="mini" data-goto="${goto}" tabindex="0" role="button" aria-label="切到 ${esc(title)} 面板"><title>點一下切到 ${esc(title)} 面板操作</title>` +
    `<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="3" fill="#111"/>` +
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${screen[0]} ${screen[1]}" preserveAspectRatio="none">${body}</svg></g>`;
}

function leadEnd(id, bench) {
  const e = END[id], sel = bench.sel === id, on = !!bench.wires[id];
  const w = 92, x0 = LEFT_SIDE(id) ? e.x - w : e.x;
  const tipX = LEFT_SIDE(id) ? e.x : e.x;
  return `<g class="lead${sel ? ' sel' : ''}${on ? ' on' : ''}" data-lead="${id}" tabindex="0" role="button" aria-label="${esc(LEADS[id].name)}${on ? `（接在 ${bench.wires[id]}）` : '（未接）'}">` +
    `<title>${esc(LEADS[id].name)}${on ? `：接在 ${bench.wires[id]}（選取後再點一次＝拔掉）` : '：點一下選取，再點電路板上的接點'}</title>` +
    `<rect x="${x0}" y="${e.y - 13}" width="${w}" height="26" rx="13" class="pill"/>` +
    `<circle cx="${tipX}" cy="${e.y}" r="9" fill="${e.color}" stroke="#fff" stroke-width="2"/>` +
    `<text x="${x0 + w / 2 + (LEFT_SIDE(id) ? -6 : 6)}" y="${e.y + 4.5}" font-size="12.5" class="pill-t">${esc(e.label)}</text></g>`;
}

function wire(id, node, k) {
  const e = END[id], [px, py] = POST[node];
  const ang = (k * 0.9) - 0.9, ex = px + Math.cos(ang) * 8 * (LEFT_SIDE(id) ? -1 : 1), ey = py + Math.sin(ang) * 8;
  const mx = (e.x + ex) / 2;
  return `<path d="M${e.x},${e.y} C${mx},${e.y} ${mx},${ey} ${ex},${ey}" fill="none" stroke="${e.color}" stroke-width="3.2" stroke-linecap="round" opacity=".9"/>` +
    `<circle cx="${ex}" cy="${ey}" r="3.5" fill="${e.color}"/>`;
}

function resistor(x1, y1, x2, y2, label) {
  const horiz = y1 === y2, n = 6, pts = [];
  const L = horiz ? x2 - x1 : y2 - y1, a = L * 0.22, b = L * 0.78;
  pts.push([0, 0], [a, 0]);
  for (let i = 0; i < n; i++) pts.push([a + ((b - a) * (i + 0.5)) / n, i % 2 ? -9 : 9]);
  pts.push([b, 0], [L, 0]);
  const P = pts.map(([s, o]) => (horiz ? `${x1 + s},${y1 + o}` : `${x1 + o},${y1 + s}`)).join(' ');
  const t = horiz ? `<text x="${(x1 + x2) / 2}" y="${y1 - 16}" font-size="14" class="val">R ${esc(label)}</text>` : `<text x="${x1 + 16}" y="${(y1 + y2) / 2 + 5}" font-size="14" class="val" style="text-anchor:start">R ${esc(label)}</text>`;
  return `<polyline points="${P}" fill="none" stroke="#333" stroke-width="2.4"/>${t}`;
}

function capacitor(x1, y1, x2, y2, label) {
  const horiz = y1 === y2, m = horiz ? (x1 + x2) / 2 : (y1 + y2) / 2, g = 5;
  if (horiz) {
    return `<line x1="${x1}" y1="${y1}" x2="${m - g}" y2="${y1}" stroke="#333" stroke-width="2.4"/><line x1="${m + g}" y1="${y1}" x2="${x2}" y2="${y1}" stroke="#333" stroke-width="2.4"/>` +
      `<line x1="${m - g}" y1="${y1 - 14}" x2="${m - g}" y2="${y1 + 14}" stroke="#333" stroke-width="3"/><line x1="${m + g}" y1="${y1 - 14}" x2="${m + g}" y2="${y1 + 14}" stroke="#333" stroke-width="3"/>` +
      `<text x="${m}" y="${y1 - 22}" font-size="14" class="val">C ${esc(label)}</text>`;
  }
  return `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${m - g}" stroke="#333" stroke-width="2.4"/><line x1="${x1}" y1="${m + g}" x2="${x1}" y2="${y2}" stroke="#333" stroke-width="2.4"/>` +
    `<line x1="${x1 - 14}" y1="${m - g}" x2="${x1 + 14}" y2="${m - g}" stroke="#333" stroke-width="3"/><line x1="${x1 - 14}" y1="${m + g}" x2="${x1 + 14}" y2="${m + g}" stroke="#333" stroke-width="3"/>` +
    `<text x="${x1 + 20}" y="${m + 5}" font-size="14" class="val" style="text-anchor:start">C ${esc(label)}</text>`;
}

export function benchSvg(bench, models) {
  const { afg, tds, dmm } = models;
  const [A, B, G] = [POST.A, POST.B, POST.G];
  const top = bench.topo === 'RC' ? resistor(A[0] + 10, A[1], B[0] - 10, B[1], fmtR(bench.R)) : capacitor(A[0] + 10, A[1], B[0] - 10, B[1], fmtC(bench.C));
  const side = bench.topo === 'RC' ? capacitor(B[0], B[1] + 10, G[0], G[1] - 10, fmtC(bench.C)) : resistor(B[0], B[1] + 10, G[0], G[1] - 10, fmtR(bench.R));
  const perNode = { A: 0, B: 0, G: 0 };
  const wires = Object.entries(bench.wires).map(([id, n]) => wire(id, n, perNode[n]++)).join('');
  const post = (n, sub) => {
    const [x, y] = POST[n], on = bench.sel ? ' armed' : '';
    return `<g class="post${on}" data-node="${n}" tabindex="0" role="button" aria-label="接點 ${n}"><title>接點 ${n}${sub ? `（${sub}）` : ''}：${esc(bench.leadsOn(n).join('、') || '沒有接線')}</title>` +
      `<circle cx="${x}" cy="${y}" r="15" class="post-c"/><circle cx="${x}" cy="${y}" r="6" fill="#8a6d3b"/>` +
      (n === 'G' ? `<text x="${x + 30}" y="${y + 6}" font-size="16" font-weight="700" class="val">${n}</text>`
        : `<text x="${x}" y="${y - 22}" font-size="16" font-weight="700" class="val">${n}</text>`) +
      (sub ? `<text x="${x}" y="${y + 34}" font-size="12" class="sub-t">${esc(sub)}</text>` : '') + '</g>';
  };
  return `<svg class="bench-svg" viewBox="0 0 1000 640" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="16" width="250" height="238" rx="10" fill="#c3c8cd" stroke="#6f767d"/>
    <text x="30" y="36" font-size="14" font-weight="700" class="blk" style="text-anchor:start">AFG-2225 輸出</text>
    ${mini(afg, 26, 48, 200, 150, [320, 240], 'afg', 'AFG-2225')}
    <text x="30" y="226" font-size="11.5" class="blk" style="text-anchor:start">BNC 轉鱷魚夾：紅＝訊號、黑＝地</text>
    <circle cx="246" cy="90" r="11" fill="#b9bec3" stroke="#555"/><circle cx="246" cy="90" r="4" fill="#d7b56d"/>
    <circle cx="246" cy="190" r="11" fill="#b9bec3" stroke="#555"/><circle cx="246" cy="190" r="4" fill="#d7b56d"/>
    <path d="M257,90 C290,90 250,70 262,70 M257,92 C290,100 250,108 262,108" stroke="#444" fill="none" stroke-width="2"/>
    <path d="M257,190 C290,190 250,170 262,170 M257,192 C290,200 250,208 262,208" stroke="#444" fill="none" stroke-width="2"/>
    <rect x="734" y="16" width="250" height="238" rx="10" fill="#d4d6d8" stroke="#6f767d"/>
    <text x="970" y="36" font-size="14" font-weight="700" class="blk" style="text-anchor:end">TDS2001C 探棒</text>
    ${mini(tds, 774, 48, 200, 150, [320, 240], 'tds', 'TDS2001C')}
    <text x="970" y="211" font-size="11.5" class="blk" style="text-anchor:end">${tds.scenarios.get() === 'BENCH' ? '來源：實驗台接線' : '來源：單機情境（非接線）'}</text>
    <text x="970" y="226" font-size="11.5" class="blk" style="text-anchor:end">探棒倍率 CH1 ${bench.probeX[0]}×、CH2 ${bench.probeX[1]}×（側欄切換）</text>
    <path d="M740,70 L740,70" stroke="#444"/>
    <rect x="16" y="372" width="250" height="252" rx="12" fill="#34383d" stroke="#1d2024"/>
    <text x="30" y="394" font-size="14" font-weight="700" fill="#fff" style="text-anchor:start">34460A 測試線</text>
    ${mini(dmm, 26, 406, 230, 152, [480, 318], 'dmm', '34460A')}
    <text x="30" y="579" font-size="11.5" fill="#dfe3e6" style="text-anchor:start">${dmm.scenarios.get() === 'bench' ? '來源：實驗台接線' : '來源：單機情境（非接線）'}</text>
    <text x="30" y="600" font-size="11.5" fill="#dfe3e6" style="text-anchor:start">紅＝HI（V Ω）、黑＝LO</text>
    <rect x="400" y="316" width="240" height="284" rx="10" fill="#f3ead6" stroke="#b39b6a"/>
    <text x="520" y="340" font-size="13" font-weight="700" class="blk">RC 電路板</text>
    ${top}${side}
    ${post('A', '輸入')}${post('B', '')}${post('G', '地')}
    ${wires}
    ${Object.keys(END).map((id) => leadEnd(id, bench)).join('')}
  </svg>`;
}

const opt = (list, cur, fmt) => list.map((v) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(fmt(v))}</option>`).join('');

// 理論值：以示波器量到的輸入（A 點）為參考，50 Ω 內阻只影響 A 點本身
function theory(bench, afg) {
  const f = afg.ch[0].freq, w = 2 * Math.PI * f, x = w * bench.R * bench.C;
  const mag = bench.topo === 'RC' ? 1 / Math.hypot(1, x) : x / Math.hypot(1, x);
  const ph = bench.topo === 'RC' ? -Math.atan(x) : Math.PI / 2 - Math.atan(x);
  const fc = 1 / (2 * Math.PI * bench.R * bench.C);
  const eng = (v, u) => (v >= 1e3 ? `${Number((v / 1e3).toPrecision(4))} k${u}` : v >= 1 ? `${Number(v.toPrecision(4))} ${u}` : v >= 1e-3 ? `${Number((v * 1e3).toPrecision(4))} m${u}` : `${Number((v * 1e6).toPrecision(4))} µ${u}`);
  return [
    ['時間常數 τ＝RC', eng(bench.R * bench.C, 's')],
    ['截止頻率 fc＝1/(2πRC)', eng(fc, 'Hz')],
    [`在 ${eng(f, 'Hz')}：B 點／A 點`, `${mag.toFixed(3)} 倍，相位 ${(ph * 180 / Math.PI).toFixed(1)}°`],
  ];
}

export function benchSide(bench, models, hints) {
  const sol = bench.solution();
  const rows = Object.keys(LEADS).map((id) => `<li><b>${esc(LEADS[id].name)}</b>：${bench.wires[id] ? `接在 ${bench.wires[id]}` : '<span class="muted">未接</span>'}</li>`).join('');
  const warn = sol.warn.length ? sol.warn.map((w) => `<li class="w-${w.level}">${esc(w.text)}</li>`).join('') : '<li class="w-ok">接線沒有問題。</li>';
  return `
    <h2>實驗台（接線）<small>AFG → RC → 示波器＋電表</small></h2>
    <section><h3>怎麼接線</h3><p class="howto">① 點左右兩側的導線端（變藍）→ ② 點電路板上的 A／B／G 就接上。已接好的導線端選取後再點一次＝拔掉。三台的小螢幕點一下就切到該台面板操作。</p></section>
    <section><h3>電路</h3>
      <label class="fld">接法 <select name="topo"><option value="RC"${bench.topo === 'RC' ? ' selected' : ''}>R 在上：B 點＝電容電壓（低通）</option><option value="CR"${bench.topo === 'CR' ? ' selected' : ''}>C 在上：B 點＝電阻電壓（高通）</option></select></label>
      <label class="fld">R <select name="R">${opt(R_OPTIONS, bench.R, fmtR)}</select></label>
      <label class="fld">C <select name="C">${opt(C_OPTIONS, bench.C, fmtC)}</select></label>
      <label class="fld">CH1 探棒開關 <select name="px1">${opt([1, 10], bench.probeX[0], (v) => `${v}×`)}</select></label>
      <label class="fld">CH2 探棒開關 <select name="px2">${opt([1, 10], bench.probeX[1], (v) => `${v}×`)}</select></label>
      <p class="muted">探棒開關要和示波器 CH 選單的 Probe 設定一致，不一致時讀值按比例錯。</p>
    </section>
    <section><h3>狀況</h3><ul class="warn">${warn}</ul></section>
    <section><h3>接線狀態</h3><ul class="wires">${rows}</ul>
      <div class="btns"><button data-bench="demo">示範接線（看答案）</button><button data-bench="clear">全部拔掉</button></div></section>
    <section><h3>理論值（標準接線、正弦）</h3><dl class="kv">${theory(bench, models.afg).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <p class="muted">以上以 CH1 驅動的標準接線、A 點為輸入參考；方波不能直接套用這個振幅比與相位。模擬有算 AFG 的 50 Ω 內阻，實際端子電壓會隨負載改變。Load 設 50 Ω 時開路電壓是顯示值的 2 倍；High Z 時顯示的是開路電壓，接上電路後仍可能降低。</p></section>
    <section><h3>練習步驟</h3><ol class="practice">
      <li>AFG：Preset → CH1/CH2 按兩下（回到 CH1 並開 CH 選單）→ F1 Load → F2 High Z → AMPL 2、F5 VPP → FREQ/Rate 1、F4 kHz → OUTPUT。</li>
      <li>接線：AFG CH1 紅夾→A、黑夾→G；示波器 CH1 尖端→A、接地夾→G；CH2 尖端→B、接地夾→G；電表 HI→B、LO→G。</li>
      <li>示波器：Auto Set（兩個通道都有訊號會一起顯示）→ Measure 看 Pk-Pk、Freq；Cursor（Time）量兩波形的時間差，相位差＝Δt×f×360°。</li>
      <li>電表：按 ACV，讀 B 點的交流有效值；純正弦時約等於示波器 CH2 的 Pk-Pk ÷ 2√2。方波／充放電波形不能用這個換算。</li>
      <li>把 AFG 頻率改到接近 fc，再比較振幅比與相位差；試試把示波器接地夾夾在 B，看會發生什麼事。</li>
    </ol></section>
    <section><h3>最近提示</h3><ul class="log">${hints || '<li class="empty">（還沒有）</li>'}</ul></section>`;
}
