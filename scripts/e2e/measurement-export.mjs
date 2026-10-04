import fs from 'node:fs/promises';
import { openApp, Check } from './lib.mjs';

export async function run() {
  const T = new Check('量測CSV的數值與單位一致'), ui = await openApp(), p = ui.page;
  const key = (id) => ui.press(`DMM.KEY.${id}`);
  try {
    await ui.tab('dmm');
    for (const [fixture, keys, fn, value, unit] of [
      ['dci', ['SHIFT', 'DCV'], 'DCI', .01234, 'ADC'],
      ['acv', ['FREQ'], 'FREQ', 1000, 'Hz'],
      ['cap', ['SHIFT', 'FREQ'], 'CAP', 1e-6, 'F'],
    ]) {
      await p.check(`input[name=scen][value=${fixture}]`);
      for (const id of keys) await key(id);
      await key('ACQUIRE');
      const wait = p.waitForEvent('download'); await ui.press('DMM.SOFT.S6'); const file = await wait;
      const csv = await fs.readFile(await file.path(), 'utf8');
      const rows = csv.trim().split('\n').slice(1).map((line) => line.split(','));
      T.ok(rows.length > 0 && rows.every((row) => row[1] === fn && row[3] === unit), `${fn}匯出使用與資料相符的${unit}單位`);
      T.ok(rows.every((row) => Math.abs(Number(row[2]) - value) < Math.abs(value) * 1e-8), `${fn}資料保留正確物理量，不混用LCD前綴倍率`);
    }
    T.ok(ui.errors.length === 0, `沒有瀏覽器錯誤：${ui.errors.join('; ')}`);
  } finally { await ui.close(); }
  return T;
}
if (process.argv[1]?.endsWith('/measurement-export.mjs')) { const T = await run(); T.print(); if (T.fail) process.exitCode = 1; }
