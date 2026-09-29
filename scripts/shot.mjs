// 截圖：開 dist/index.html，逐台切換並存圖到 output/shots/（用法：node scripts/shot.mjs [afg tds gpe dmm]）
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'output/shots');
fs.mkdirSync(out, { recursive: true });
const which = process.argv.slice(2).length ? process.argv.slice(2) : ['afg', 'tds', 'gpe', 'dmm'];

const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL || 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'dist/index.html')).href);
for (const id of which) {
  await page.click(`[data-tab="${id}"]`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(out, `${id}.png`) });
  console.log('saved', path.join('output/shots', `${id}.png`));
}
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
await browser.close();
