// E2E 共用：用系統的 Chrome（playwright-core）開單檔 dist/index.html，只用真的滑鼠、鍵盤操作；
// window.__eess 只拿來「讀」狀態做斷言。雲端沒有 Chrome 時設 E2E_CHANNEL=chromium。
import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SHOTS = path.join(ROOT, 'output/e2e');
const CHANNEL = process.env.E2E_CHANNEL === 'chromium' ? null : (process.env.E2E_CHANNEL || 'chrome');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Check {
  constructor(name) { this.name = name; this.pass = 0; this.fail = 0; this.lines = []; }
  ok(cond, msg) { if (cond) this.pass++; else this.fail++; this.lines.push(`  ${cond ? '✓' : '✗'} ${msg}`); return !!cond; }
  near(a, b, tol, msg) { return this.ok(Math.abs(a - b) <= tol, `${msg}（${a}）`); }
  print() { console.log(`\n[${this.name}] ${this.pass} passed, ${this.fail} failed`); console.log(this.lines.join('\n')); }
}

export async function openApp({ headless = !process.env.HEADED } = {}) {
  const browser = await chromium.launch({ ...(CHANNEL ? { channel: CHANNEL } : {}), headless });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(pathToFileURL(path.join(ROOT, 'dist/index.html')).href);
  await page.locator('svg.panel').waitFor();
  fs.mkdirSync(SHOTS, { recursive: true });
  const ui = {
    page, errors,
    tab: async (id) => { await page.click(`[data-tab="${id}"]`); await sleep(50); },
    // 按一顆面板鍵（真滑鼠點在元素中心）
    press: async (id) => { await page.locator(`[data-id="${id}"]`).click(); await sleep(20); },
    // 依序按鍵：數字字串會拆成數字鍵；prefix 例 'AFG'
    keys: async (prefix, map, seq) => {
      for (const tok of seq.split(/\s+/).filter(Boolean)) {
        if (/^[\d.]+$/.test(tok)) {
          for (const ch of tok) await ui.press(ch === '.' ? `${prefix}.NUM.DOT` : `${prefix}.NUM.DIGIT_${ch}`);
        } else await ui.press(map[tok] ?? tok);
      }
    },
    // 拖曳旋鈕：往上拖＝順時針；steps 格
    dragKnob: async (id, steps, pxPerStep = 9) => {
      const box = await page.locator(`[data-id="${id}"]`).boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      const n = Math.abs(steps) * pxPerStep + 2;
      await page.mouse.move(x, y - Math.sign(steps) * n, { steps: 10 });
      await page.mouse.up(); await sleep(30);
    },
    lcdText: () => page.locator('svg.screen').evaluate((el) => el.textContent.replace(/\s+/g, ' ')),
    hint: () => page.locator('.hintbar').innerText(),
    snap: (id) => page.evaluate((i) => window.__eess.snapshot(i), id),
    shot: (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) }),
    close: () => browser.close(),
  };
  return ui;
}
