// GPE-4323 LCD（480×266；版面依手冊 p.15 的 LCD 圖）：兩列 4 位七段（V、A）＋通道圖示 ①／④、②／③、
// 每列 Set／CV／CC，狀態區 SER／PARA／Lock 與 ON／OFF。未點亮的段畫成淡影，像單色 LCD。
// 恆暗（本輪未納入或不屬 GPE-4323）：OVP／OCP、OTP、GPE-3323 的 ③ 固定列、GPE-1326 的列首 Set／Out。
// 外殼只在操作時重畫 LCD，所以「開機全段 1 秒」「Set View 3 秒返回」用 CSS 動畫到時切換兩層畫面。

const INK = '#1b241b';
const GHOST = 'rgba(27,36,27,.07)';
const PAT = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
const W = 32, H = 50, T = 6.5, PITCH = 44; // 一位數字的寬、高、段粗、間距
const r1 = (v) => Math.round(v * 10) / 10;

// 兩端削尖的段：中心線 (x1,y1)→(x2,y2)，水平或垂直
function bar(x1, y1, x2, y2) {
  const k = T / 2;
  const P = y1 === y2
    ? [[x1, y1], [x1 + k, y1 - k], [x2 - k, y1 - k], [x2, y2], [x2 - k, y2 + k], [x1 + k, y1 + k]]
    : [[x1, y1], [x1 + k, y1 + k], [x1 + k, y2 - k], [x2, y2], [x2 - k, y2 - k], [x1 - k, y1 + k]];
  return `M${P.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}Z`;
}

// 一位七段（左上 x,y）的 a–g 與小數點 p
function digit(x, y) {
  const g = 1.2, xl = x + T / 2, xr = x + W - T / 2, yt = y + T / 2, ym = y + H / 2, yb = y + H - T / 2;
  return {
    a: bar(xl + g, yt, xr - g, yt), g: bar(xl + g, ym, xr - g, ym), d: bar(xl + g, yb, xr - g, yb),
    f: bar(xl, yt + g, xl, ym - g), b: bar(xr, yt + g, xr, ym - g), e: bar(xl, ym + g, xl, yb - g), c: bar(xr, ym + g, xr, yb - g),
    p: `M${r1(x + W + 3)} ${r1(y + H - T)}h${T}v${T}h${-T}Z`,
  };
}

// 4 位欄位，例 '5.00'、'0.050'、'---'、'8.8.8.8.'：右對齊、無前導零（GAP-GPE-10）
function field(x, y, text) {
  const cells = [];
  for (const ch of text) {
    if (ch === '.' && cells.length) cells[cells.length - 1].dp = true;
    else cells.push({ ch, dp: false });
  }
  while (cells.length < 4) cells.unshift({ ch: ' ', dp: false });
  let ghost = '', lit = '';
  cells.slice(-4).forEach((c, i) => {
    const S = digit(x + i * PITCH, y);
    ghost += Object.values(S).join('');
    lit += [...(PAT[c.ch] ?? '')].map((s) => S[s]).join('') + (c.dp ? S.p : '');
  });
  return `<path d="${ghost}" fill="${GHOST}"/><path d="${lit}" fill="${INK}"/>`;
}

// 圖示字樣：點亮的加 class="lit"（e2e 讀這個）
const txt = (x, y, s, on, size = 14, anchor = 'middle') =>
  `<text${on ? ' class="lit"' : ''} x="${x}" y="${y}" font-size="${size}" font-weight="700" fill="${on ? INK : GHOST}" style="text-anchor:${anchor}">${s}</text>`;
const circ = (x, y, n, on) => `<circle cx="${x}" cy="${y}" r="10" fill="none" stroke="${on ? INK : GHOST}" stroke-width="2"/>${txt(x, y + 5, n, on, 14)}`;
const unit = (x, y, s) => `<text x="${x}" y="${y}" font-size="20" font-weight="600" fill="${INK}" style="text-anchor:middle">${s}</text>`;

const ROW_Y = [36, 134];         // 兩列數字上緣
const ROW_CH = [[1, 4], [2, 3]]; // 第一列 ①／④、第二列 ②／③

function row(k, r, all) {
  const y = ROW_Y[k], [a, b] = ROW_CH[k];
  const v = all ? '8.8.8.8.' : r.v, A = all ? '8.8.8.8.' : r.a;
  return circ(26, y + 2, a, all || r.ch === a) + txt(26, y + 31, k ? 'Out' : 'Set', false, 12) + circ(26, y + 50, b, all || r.ch === b) +
    txt(120, y - 9, 'Set', all || r.set) + txt(200, y - 9, 'CV', all || r.mode === 'CV') + txt(252, y - 9, 'CC', all || r.mode === 'CC') +
    txt(330, y - 9, 'OVP', false) + txt(416, y - 9, 'OCP', false) +
    `<g data-row="${k + 1}" data-ch="${all ? '' : r.ch}" data-v="${v}" data-a="${A}" data-mode="${all ? '' : r.mode ?? ''}" data-set="${!all && r.set ? 1 : 0}">` +
    `${field(60, y, v)}${field(268, y, A)}</g>` + unit(240, y + H, 'V') + unit(448, y + H, 'A');
}

// 分隔線與恆暗的列（GPE-3323 CH3 固定列）
const LINES = `<g stroke="${INK}" stroke-opacity=".55" fill="none"><path d="M48 8V262M48 105H472M334 204V262M48 231H334" stroke-width="1.5"/>` +
  `<path d="M6 202H474" stroke-width="3"/></g>` + circ(26, 217, 3, false) + txt(62, 222, '5v 3.3v 2.5v 1.8v OverLoad', false, 14, 'start');

function frame(st) {
  const all = !!st.all;
  return LINES + st.rows.map((r, k) => row(k, r, all)).join('') +
    txt(84, 254, 'SER', all || st.ser, 15) + txt(148, 254, 'PARA', all || st.para, 15) + txt(212, 254, 'OTP', false, 15) +
    txt(278, 254, 'Lock', all || st.lock, 15) + txt(376, 246, 'ON', all || st.out, 28) + txt(440, 246, 'OFF', all || !st.out, 28);
}

const CSS = '<style>@keyframes gpeHide{to{visibility:hidden}}@keyframes gpeShow{to{visibility:visible}}</style>';
// 先顯示 before，ms 毫秒後換成 after
const swap = (before, after, ms) => `<g data-layer="before" style="animation:gpeHide 1ms ${Math.round(ms)}ms forwards">${before}</g>` +
  `<g data-layer="after" style="visibility:hidden;animation:gpeShow 1ms ${Math.round(ms)}ms forwards">${after}</g>`;

export function renderLcd(m) {
  const view = m.setViewLeft();
  let body = view > 0 ? swap(frame(m.lcdState('set')), frame(m.lcdState('read')), view) : frame(m.lcdState());
  const boot = m.bootLeft();
  if (boot > 0) body = swap(frame({ all: true, rows: [{}, {}] }), body, boot);
  return `<rect width="480" height="266" fill="#c3cdbd"/>${CSS}${body}`;
}
