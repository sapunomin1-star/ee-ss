// 全部 E2E（真滑鼠、鍵盤）。用法：npm run e2e（HEADED=1 可看畫面）
import { run as afg } from './afg.mjs';
import { run as tds } from './tds.mjs';
import { run as gpe } from './gpe.mjs';
import { run as dmm } from './dmm.mjs';
import { run as i06 } from './i06.mjs';
import { run as bench } from './bench.mjs';
import { run as benchRecovery } from './bench-recovery.mjs';
import { run as benchAudit } from './bench-audit.mjs';
import { run as breadboard } from './breadboard.mjs';
import { run as breadboardMeasure } from './breadboard-measure.mjs';
import { run as review20261002 } from './review-20261002.mjs';
import { run as homeSession } from './home-session.mjs';
import { run as homeInstruments } from './home-instruments.mjs';
import { run as current } from './current.mjs';
import { run as undo } from './undo.mjs';
import { run as protection } from './protection.mjs';
import { run as benchTools } from './bench-tools.mjs';
import { run as instrumentsExtended } from './instruments-extended.mjs';
import { run as tdsExtended } from './tds-extended.mjs';
import { run as sessionExtended } from './session-extended.mjs';
import { run as afgExtended } from './afg-extended.mjs';
import { run as backgroundAcquisition } from './background-acquisition.mjs';
import { run as tdsSetupFile } from './tds-setup-file.mjs';
import { run as measurementExport } from './measurement-export.mjs';
import { run as tdsCausalAcquisition } from './tds-causal-acquisition.mjs';
import { run as dmmStoppedRange } from './dmm-stopped-range.mjs';
import { run as afgReviewRegressions } from './afg-review-regressions.mjs';
import { run as sessionUndoIsolation } from './session-undo-isolation.mjs';
import { run as tdsReview50574f7 } from './tds-review-50574f7.mjs';
import { run as afgArbExport } from './afg-arb-export.mjs';

let fail = 0, pass = 0;
for (const r of [afg, tds, gpe, dmm, i06, bench, benchRecovery, benchAudit, breadboard, breadboardMeasure, review20261002, homeSession, homeInstruments, current, undo, protection, benchTools, instrumentsExtended, tdsExtended, sessionExtended, afgExtended, backgroundAcquisition, tdsSetupFile, measurementExport, tdsCausalAcquisition, dmmStoppedRange, afgReviewRegressions, sessionUndoIsolation, tdsReview50574f7, afgArbExport]) {
  const T = await r();
  T.print();
  fail += T.fail; pass += T.pass;
}
console.log(`\ne2e: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
