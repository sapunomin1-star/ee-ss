#!/usr/bin/env node
// Render docs/control-matrix.md and docs/instrument-scope.md from docs/data/*.json.
// The JSON files are the single source of truth for the I00 matrix; edit them, then re-run.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTRUMENTS = [
  { key: 'afg', title: 'GW Instek AFG-2225 任意波形訊號產生器', photo: 'P1 上層', card: 'I02' },
  { key: 'tds', title: 'Tektronix TDS2001C 雙通道數位儲存示波器', photo: 'P2', card: 'I03' },
  { key: 'gpe', title: 'GW Instek GPE-4323 四路直流電源供應器（原版，非 A 版）', photo: 'P1 下層', card: 'I04' },
  { key: 'dmm', title: 'Keysight 34460A 6½ 位數電表', photo: 'P1 中層', card: 'I05' },
];
const STATUS_ORDER = ['CORE', 'APPROX', 'OUT', 'STATIC'];

const cell = (v) => String(v ?? '').trim().replace(/\r?\n+/g, '<br>').replace(/\|/g, '\\|') || '—';
const row = (cells) => `| ${cells.map(cell).join(' | ')} |`;
const table = (header, rows) => [row(header), row(header.map(() => '---')), ...rows.map(row)].join('\n');

const data = Object.fromEntries(
  INSTRUMENTS.map(({ key }) => [key, JSON.parse(readFileSync(path.join(root, 'docs', 'data', `${key}.json`), 'utf8'))]),
);

// ---------- control-matrix.md ----------
const MATRIX_HEADER = ['ID', '照片位置', '面板標籤', '類型／動作', '功能／影響設定', '可見回饋', '參數範圍', '來源頁', '證據', '狀態', '卡', '備註'];
const out = [];
out.push('# 控制矩陣（I00）');
out.push('');
out.push('> 由 `docs/data/*.json` 經 `node scripts/render-i00-docs.mjs` 產生，請改 JSON 後重跑，不要直接改本檔。');
out.push('> 結構自檢：`node scripts/check-control-matrix.mjs`。自檢只驗表格、ID、代碼與照片硬性數量，**不是**儀器行為測試。');
out.push('');
out.push('## 讀法');
out.push('');
out.push('- **ID**：`<儀器>.<類型>.<名稱>`，I01 起 DOM、狀態與測試都用同一個 ID。類型：KEY 實體鍵、SOFT 螢幕旁軟鍵、NUM 數字鍵、KNOB 旋鈕、TERM 端子、PORT 連接埠、LED 指示燈、LCD 顯示、PWR 電源、MISC 其他。');
out.push('- **照片位置／面板標籤**：以使用者實拍 P1、P2 為準，寫照片上真正印的字（含中文貼面、Shift 次標籤）。');
out.push('- **來源頁**：`M-AFG p.144` 表印刷頁；TDS 另附 PDF 頁。來源 ID 與版本見 `docs/sources.md`。');
out.push('- **證據**：PH 照片、OT 官方手冊正文、DS datasheet、IX 索引／搜尋定位（未取得正文）、PD 推論或教學決策（暫定）、UN 未知；可用 `+` 組合。');
out.push('- **狀態**：CORE 本輪該卡必做；APPROX 近似可操作，須在儀器外標示；OUT 本輪未納入，面板保留但停用或顯示範圍說明，**不得假成功**；STATIC 被動件（端子、連接埠、固定標籤、本輪不會變化的指示燈），只顯示或預留 terminal ID，接線屬 J01。會隨本輪核心狀態變化的指示燈與 LCD 圖示列 CORE。');
out.push('- **照片未見的列**：手冊有、照片看不到的部件（後面板、機頂電源鍵）也列出，避免遺漏；後面板一律 OUT。');
out.push('- **卡**：該控制項的實作卡；共用互動元件（旋鈕拖曳、按鍵焦點）另由 I01 提供。');
out.push('');
out.push('## 總覽');
out.push('');
const summaryRows = INSTRUMENTS.map(({ key, title }) => {
  const cs = data[key].controls;
  const n = (s) => cs.filter((c) => c.status === s).length;
  return [title, cs.length, ...STATUS_ORDER.map(n)];
});
out.push(table(['儀器', '列數', 'CORE', 'APPROX', 'OUT', 'STATIC'], summaryRows));
out.push('');

INSTRUMENTS.forEach(({ key, title, photo, card }, i) => {
  const d = data[key];
  out.push(`## ${i + 1}. ${title}（${photo}，${card}）`);
  out.push('');
  out.push(`**照片核對：** ${d.photo_checks}`);
  out.push('');
  out.push(`**頁碼對照：** ${d.page_map}`);
  out.push('');
  const groups = [...new Set(d.controls.map((c) => c.group))];
  for (const g of groups) {
    out.push(`### ${g}`);
    out.push('');
    out.push(
      table(
        MATRIX_HEADER,
        d.controls
          .filter((c) => c.group === g)
          .map((c) => [
            `\`${c.id}\``, c.photo_location, c.label, `${c.kind}；${c.action}`, c.function, c.feedback, c.range,
            c.sources, c.evidence, c.status, c.card, c.notes,
          ]),
      ),
    );
    out.push('');
  }
  if (d.menus?.length) {
    out.push(`### ${title.split(' ').slice(0, 3).join(' ')} 核心選單路徑`);
    out.push('');
    out.push('只列來源有寫的路徑；沒有來源的不補。');
    out.push('');
    out.push(table(['路徑', '軟鍵／選項', '來源', '證據', '狀態', '備註'], d.menus.map((m) => [m.path, m.softkeys, m.source, m.evidence, m.status, m.notes])));
    out.push('');
  }
});
writeFileSync(path.join(root, 'docs', 'control-matrix.md'), out.join('\n').replace(/\n+$/, '\n'));

// ---------- instrument-scope.md ----------
const s = [];
s.push('# 四台儀器：核心功能、規格、未納入、資料缺口與暫定行為（I00）');
s.push('');
s.push('> 由 `docs/data/*.json` 經 `node scripts/render-i00-docs.mjs` 產生。控制項逐列見 `docs/control-matrix.md`，來源見 `docs/sources.md`。');
s.push('> 「暫定」表示有明確規格可實作，但未證實與校機相同，I01–I05 必須在儀器外標示「近似／待校機確認」。');
s.push('');
const common = JSON.parse(readFileSync(path.join(root, 'docs', 'data', 'common.json'), 'utf8'));
s.push('## 0. 四台共通');
s.push('');
for (const block of common.sections) {
  s.push(`### ${block.title}`);
  s.push('');
  s.push(block.body.trim());
  s.push('');
}
INSTRUMENTS.forEach(({ key, title, card }, i) => {
  const d = data[key];
  s.push(`## ${i + 1}. ${title}（${card}）`);
  s.push('');
  s.push('### 核心功能與驗收規則');
  s.push('');
  s.push(table(['ID', '功能', '可驗收規則', '來源', '證據', '驗收（03 案例）'], d.core_features.map((f) => [f.id, f.feature, f.rule, f.source, f.evidence, f.acceptance])));
  s.push('');
  s.push('### 規格、範圍與預設值');
  s.push('');
  s.push(table(['項目', '值', '來源', '證據', '原文'], d.specs.map((x) => [x.item, x.value, x.source, x.evidence, x.quote])));
  s.push('');
  s.push('### 本輪未納入');
  s.push('');
  s.push(table(['項目', '理由', '面板處理'], d.out_of_scope.map((x) => [x.item, x.reason, x.ui_treatment])));
  s.push('');
  s.push('### 資料缺口與暫定行為');
  s.push('');
  s.push(table(['ID', '缺口', '影響', '暫定行為', '理由', '日後驗證'], d.gaps.map((g) => [g.id, g.gap, g.impact, g.provisional, g.rationale, g.verify_method])));
  s.push('');
  s.push('### 來源差異');
  s.push('');
  s.push(table(['主題', '來源 A', '來源 B', '採用'], d.discrepancies.map((x) => [x.topic, x.a, x.b, x.resolution])));
  s.push('');
});
writeFileSync(path.join(root, 'docs', 'instrument-scope.md'), s.join('\n').replace(/\n+$/, '\n'));
console.log('rendered docs/control-matrix.md and docs/instrument-scope.md');
