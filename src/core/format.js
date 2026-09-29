// 顯示格式：以十進位值四捨五入（half away from zero），不直接用二進位浮點的 toFixed（GAP-AFG-13）。

// 把數字轉成可靠的十進位字串（15 位有效數字，去掉二進位雜訊）
function decimalString(x) {
  const s = Math.abs(x).toPrecision(15);
  return /e/i.test(s) ? Math.abs(x).toFixed(20) : s;
}

// x 四捨五入到小數 d 位，回傳字串；結果為 0 時不帶負號
export function fmtFixed(x, d) {
  if (!Number.isFinite(x)) return '---';
  const [ip, fpRaw = ''] = decimalString(x).split('.');
  const fp = fpRaw.padEnd(d + 1, '0');
  const digits = (ip + fp.slice(0, d)).split('').map(Number);
  if (fp.charCodeAt(d) - 48 >= 5) {
    let i = digits.length - 1;
    while (i >= 0 && digits[i] === 9) { digits[i] = 0; i--; }
    if (i < 0) digits.unshift(1); else digits[i]++;
  }
  const str = digits.join('');
  const intPart = str.slice(0, str.length - d).replace(/^0+(?=\d)/, '') || '0';
  const out = d > 0 ? `${intPart}.${str.slice(str.length - d)}` : intPart;
  const zero = /^0(\.0*)?$/.test(out);
  return (x < 0 && !zero ? '-' : '') + out;
}

// 先取 d 位小數；結果的整數部分超過 maxInt 位時改少一位小數（例：9.99954 → 10.00，p.26 的 20.00 VPP）
export function fmtWidth(x, d, maxInt = 1) {
  let s = fmtFixed(x, d);
  while (d > 0 && s.replace('-', '').split('.')[0].length > maxInt) { d -= 1; maxInt += 1; s = fmtFixed(x, d); }
  return s;
}

// 工程記號：1.23k、500m、250µ（示波器讀值用）
const PREFIX = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];
export function eng(x, digits = 3) {
  if (!Number.isFinite(x)) return '?';
  if (x === 0) return '0';
  const a = Math.abs(x);
  for (const [m, p] of PREFIX) {
    if (a >= m * 0.9995) {
      const v = x / m;
      const intLen = Math.floor(Math.log10(Math.abs(v))) + 1;
      return `${fmtFixed(v, Math.max(0, digits - intLen))}${p}`;
    }
  }
  return `${fmtFixed(x / 1e-9, 0)}n`;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
