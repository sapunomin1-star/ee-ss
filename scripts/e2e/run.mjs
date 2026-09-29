// 全部 E2E（真滑鼠、鍵盤）。用法：npm run e2e（HEADED=1 可看畫面）
import { run as afg } from './afg.mjs';
import { run as tds } from './tds.mjs';
import { run as gpe } from './gpe.mjs';
import { run as dmm } from './dmm.mjs';

let fail = 0, pass = 0;
for (const r of [afg, tds, gpe, dmm]) {
  const T = await r();
  T.print();
  fail += T.fail; pass += T.pass;
}
console.log(`\ne2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
