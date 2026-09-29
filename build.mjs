// 建置：docs/data/*.json → src/generated/controls.js（只留面板需要的欄位），
// 再把 src/ 打包成單一、可離線開啟的 dist/index.html（JS 與 CSS 全部內嵌）。
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });

// 照片座標：「原圖約 (508,256)」「約 x433,y708」→ 中心點；「x90–325, y85–275」→ 範圍
function parseLoc(s) {
  let m = s.match(/x\s*(\d{2,4})\s*[–-]\s*(\d{2,4})\s*[,，、]\s*y\s*(\d{2,4})\s*[–-]\s*(\d{2,4})/);
  if (m) {
    const [x0, x1, y0, y1] = m.slice(1).map(Number);
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, box: [x0, y0, x1 - x0, y1 - y0] };
  }
  m = s.match(/\((?:約\s*)?x?\s*(\d{2,4})\s*,\s*y?\s*(\d{2,4})\)/) || s.match(/約\s*x(\d{2,4})\s*,\s*y(\d{2,4})/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

function generateControls() {
  const out = {};
  for (const key of ['afg', 'tds', 'gpe', 'dmm']) {
    const d = JSON.parse(fs.readFileSync(path.join(root, 'docs/data', `${key}.json`), 'utf8'));
    out[key] = d.controls.map((c) => ({
      id: c.id, status: c.status, kind: c.kind, group: c.group, label: c.label,
      fn: c.function, evidence: c.evidence, pos: parseLoc(c.photo_location),
    }));
  }
  const file = path.join(root, 'src/generated/controls.js');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = `// 由 build.mjs 從 docs/data/*.json 產生，請改 JSON 後重新建置。\nexport default ${JSON.stringify(out)};\n`;
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
}

function writeHtml(result) {
  if (result.errors.length) return;
  const files = result.outputFiles || [];
  const js = files.find((f) => f.path.endsWith('.js'))?.text ?? '';
  const css = files.find((f) => f.path.endsWith('.css'))?.text ?? '';
  const tpl = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const html = tpl
    .replace('/*__CSS__*/', () => css.replace(/<\/style/gi, '<\\/style'))
    .replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`[build] dist/index.html  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
}

generateControls();
const options = {
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  outdir: outDir,
  write: false,
  format: 'iife',
  target: 'es2020',
  minify: !watch,
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [{ name: 'inline-html', setup(b) { b.onEnd(writeHtml); } }],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[build] watching src/ …');
} else {
  const r = await esbuild.build(options);
  if (r.errors.length) process.exit(1);
}
