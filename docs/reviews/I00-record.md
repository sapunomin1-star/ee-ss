# I00 實作紀錄：來源與基線核定（第 3 版：第 1 次獨立審查後的同卡修正，含修正複核補正）

**判決：I00 同卡修正自測完成／待第 2 次獨立審查。** 這不是 REVIEW PASS。依 03 與 06，只有全新 context 的獨立 reviewer 能寫 REVIEW PASS／FAIL；拿到 PASS 之前不開始 I01。

（格式依 03「每卡紀錄模板」。）

## 1. 卡 ID、角色、版本

| 項目 | 內容 |
|---|---|
| 卡 ID／角色／日期 | I00／實作者（雲端 Claude Code session）／2026-09-29 |
| 前次獨立審查 | 第 1 次：**REVIEW FAIL**，必改 R1–R7。報告原文 `docs/reviews/I00-review-1.md`（SHA-256 `95685810…a09e`）。當次被審版本：成品 `c668ce3`／紀錄 `9f8a083` |
| 本次修正對照 | `docs/reviews/I00-fix-1.md`（R1–R7 的「原規則 → 修後規則 → 證據／反例 → 受影響欄位」，以及修正複核指出的 AFG 捨入矛盾） |
| 修正複核 | 第 1 次審查脈絡對第 2 版（`51d9b17`）的複核：前次 7 項已處理，剩 1 項 AFG 幅度判定的捨入矛盾。依使用者轉述，這是修正複核，**不算**新的獨立 FAIL。複核報告原檔在使用者的 Mac，本 session 無法取得 |
| 基線 HEAD | `51d9b17e34a820f9ae0f04716925897446727709`（第 2 版的紀錄 commit，修正複核的對象）；第 1 次獨立審查的對象是 `9f8a083` |
| **成品 commit** | `164c9945d60dd1dc3b2d46cbb097c317d821bdae`（分支 `claude/new-session-24ecn6`）。自 `9f8a083` 起依序為 `71225cd`（套用 R1–R7）、`35f0c85`（內部對抗檢查後補正）、`51d9b17`（第 2 版紀錄）、`164c994`（修正複核：AFG 捨入規則） |
| **紀錄 commit** | 本檔所在的 commit，也就是成品 commit 的下一個 commit。完整 hash 見交付訊息，或 `git log -1 -- docs/reviews/I00-record.md`。它相對成品 commit 只修改本檔，可用 `git diff --stat 164c994 <紀錄 commit>` 確認 |
| dirty | 無（提交前 `git status --short` 為空） |
| HTML SHA-256 | 不適用：I00 是純文件卡，還沒有應用程式或離線 HTML |
| 審查次數 | I00 第 1 次獨立 FAIL；本版送第 2 次獨立審查。實作者內部的抽取、驗證、批評、對抗檢查都不算審查次數 |

### 版本歷程

| 版本 | 成品 commit | 紀錄 commit | 判決 |
|---|---|---|---|
| 第 1 版 | `c668ce316cf36f7ab4b62a256551a0dcbbc36802` | `9f8a0833b301e58313a50270a641d5b08a3582ab` | 第 1 次獨立審查：REVIEW FAIL（R1–R7） |
| 第 2 版 | `35f0c85b5ac97aaca818603ead9f05ea26332bbc` | `51d9b17e34a820f9ae0f04716925897446727709` | 修正複核（同一審查脈絡，不計 FAIL）：剩 1 項 AFG 捨入矛盾 |
| 第 3 版（本版） | `164c9945d60dd1dc3b2d46cbb097c317d821bdae` | 本檔所在 commit | 待第 2 次獨立審查 |

## 2. 實際環境

Ubuntu 24.04.4 LTS（Linux 6.18.44 x86_64）雲端容器；Node v22.22.2、npm 10.9.7；Python 3.11.15；Git 2.43.0；Playwright 1.56.1＋Chromium 141.0.7390.37（headless，已實測可點擊）。
沒有接觸任何校機，也沒有使用者的 Mac。viewport／file: 測試不適用（沒有應用程式）。細節見 `docs/I00-baseline.md`。

## 3. 成品與 SHA-256（成品 commit `164c994` 時的檔案）

| 檔案 | SHA-256 | 本版有無修改 |
|---|---|---|
| `docs/control-matrix.md` | `a8a107cc61e46bd787c02ffb2c967008436174438e869accc8586b812c442c85` | 重產 |
| `docs/instrument-scope.md` | `eee01c091128f4399729af172f3bdb87375229968d1dcb24084a6dcfe73d4b65` | 重產 |
| `docs/data/afg.json` | `26a52866d7fb3e8f7138cfb875fe7c5e5e33470f522a20d9b7e0195c31ddf73e` | R1、R5、修正複核 |
| `docs/data/tds.json` | `be8fffbaba912bd6e20b5068fce69df14d4405764fde14ccf318815f72d9e987` | R2、R7 |
| `docs/data/gpe.json` | `fbb4227530ff81b1bc35c55cccdca6ceeb71509b7c0fe7f1940b06641c63c9fc` | R3、R5、R6 |
| `docs/data/dmm.json` | `ce90d10a9bfe3c5c237b071adb1442acfae83d0055d9a8119e29f2c5b26c622f` | R4、R5 |
| `docs/data/common.json` | `42aefe78a0151e9039aae93ad81c41c62bc07f8f5f0703fbfd22ef1d04f6c88d` | R2、R3、R5 |
| `docs/reviews/I00-review-1.md` | `95685810367f226202a1ee8071fca0674c03fb8395de961706da85addb61a09e` | 新增（reviewer 原文，與審查包 `SHA256.json` 相符） |
| `docs/reviews/I00-fix-1.md` | `c1c5e2cd2b0f7d5942f95480cac7263d32f7273cb2ea4c801a679e19b3d4e6d1` | 新增（含修正複核一節） |
| `docs/reviews/I00-reviewer-handoff.md` | `d2660f607a3a66c2940419ef6029acf6e9c2646154039e3f570d854309bb63ed` | 改為第 2 次審查用 |
| `docs/reviews/I00-selfcheck.md` | `dfcdb8be62ef2c19553b3894ea76c89c90fdc120a5f38036000ea85ffb9b35b4` | 只在開頭加一行說明，內容凍結 |
| `README.md` | `1938f935627bec3c013066a01c21f355086e2b7ae3ac0ef739e6af84a9f53e38` | 更新「目前狀態」 |
| `docs/sources.md` | `c2a39993042cee584a77e109e50523905ffff1ecab0c41b63e6d4f29999f30d9` | 未改 |
| `docs/I00-baseline.md` | `65b475a759d9973bf1d5b98c3c6bfd8f1ee40309729cc1195bed383649923a21` | 未改 |
| `scripts/check-control-matrix.mjs` | `257ae5842647fc6f166720162594040d648e2e051aca10abd846eaf7ae34aa53` | 未改 |
| `scripts/check-control-matrix.test.mjs` | `cff195052da43300b69fbd6fbce96e09ec735e1068cd6d7ed86ec5350d9cb676` | 未改 |
| `scripts/render-i00-docs.mjs` | `0fde9abb1b34f24a9dbf9e6309935b812224bfbf0e3df4faea21c233fca5fa4d` | 未改 |
| `reference/README.md` | `3999ca5955b9da17ef3ccb3ef1920c88b7f07b65f37905bad48a1357272632b2` | 未改 |
| `.gitignore` | `33803c2d7ee6938c6645db72c0721c95c4a55120800cad48fb42191e4a1c0a81` | 未改 |

審查包裡的 `verification.json`、`verification.log` 含使用者 Mac 的本機路徑，repo 又是 public，所以沒有提交；只記錄雜湊：`verification.json` `d5aa076d…2a9b49`、`verification.log` `b9a0d815…0e137a`（與審查包 `SHA256.json` 相符）。

## 4. 本卡控制項、來源頁與證據級別（摘要）

| 儀器 | 控制列 | CORE | APPROX | OUT | STATIC | 選單路徑 | 規格 | 核心規則 | 缺口 | 來源差異 | CORE／APPROX 含 PD 或 UN 的列 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AFG-2225 | 46 | 28 | 2 | 13 | 3 | 19 | 33 | 16 | 18 | 16 | 6 |
| TDS2001C | 53 | 27 | 3 | 11 | 12 | 22 | 49 | 21 | 24 | 17 | 1 |
| GPE-4323 | 47 | 24 | 5 | 4 | 14 | 16 | 25 | 12 | 15 | 15 | 15 |
| 34460A | 44 | 10 | 2 | 16 | 16 | 11 | 38 | 15 | 23 | 12 | 12 |

與第 1 版相比：控制列、狀態、卡別都沒變；AFG 規格多一列（dBm 可輸入範圍），GPE 來源差異多一列（p.33／p.35 vs p.25），AFG 含 PD 的 CORE／APPROX 列多一列（`AFG.KEY.AMPL` 的 dBm 範圍是換算值）。

## 5. 最小修改範圍與共用變更

只改 R1–R7 相關的 `docs/data/*.json` 欄位並重產兩份文件，外加審查原文、修正對照、交接與本紀錄。沒有新增功能、沒有刪除核心項目、沒有放寬任何驗收條件、沒有改腳本。
沒有合併 main、沒有部署、沒有開始 I01 或 J 階段。

## 6. 案例（I00-1～I00-5）

I00 是文件卡，沒有應用程式，03 註明「免跑尚不存在的應用 e2e」。下表的「自測結果」只代表實作者自檢，最終由獨立 reviewer 判定。

| 案例 | 第 1 次審查的判定 | 本版處理 | 自測結果 | 證據檔 |
|---|---|---|---|---|
| I00-1 機型、面板與數量 | 相符 | 未改（控制列、數量、端子順序照舊；檢查器仍通過） | 自測完成 | `docs/control-matrix.md` 各台「照片核對」 |
| I00-2 證據分級 | R5／R6 需修正 | R5：DMM 11 列與其他機型 5 列的「原廠：」歸屬已更正，共通 §0.2-3 補規則；R6：p.18 模式鍵顯示句改列 OT，只留真正未寫的細節為 PD | 自測完成 | `docs/reviews/I00-fix-1.md` R5、R6 |
| I00-3 核心功能與未納入 | 語義 R1／R3 需修正 | R1：負或 0 dBm 合法，依換算後 Vpp 與聯合限制判定；修正複核後改為一律用未捨入值判定、再格式化顯示；R3：換模式四路全 OFF、設定保留、重新 ON 才恢復，並記錄 p.33／p.35 與 p.25 的差異 | 自測完成 | `docs/reviews/I00-fix-1.md` R1、R3 |
| I00-4 暫定規格與驗收 | R2／R4／R7 需統一、改成可達成 | R2：游標容差 ±1 步（PD），不再要求不可表示的精確值；R4：Shift 只在儀器外；R7：AutoSet 後備規則與恢復案例 | 自測完成 | `docs/reviews/I00-fix-1.md` R2、R4、R7 |
| I00-5 版本、來源與環境 | 已查 | 本版新 commit 與 hash 見第 1、3 節；乾淨 clone 重跑所有檢查（第 8 節） | 自測完成 | 本檔 |

## 7. 數值容差與 fixture 規格

I00 沒有數值量測。本版與容差有關的修改：TDS 游標讀值容差＝±1 個游標步進（1/25 div，PD）——250 µs/div 為 ±10 µs、50 µs/div 為 ±2 µs；AFG dBm 範圍用精確上限 +23.979 dBm（10 Vpp）與 +17.958 dBm（5 Vpp）；★ 修正複核後，AFG 幅度合法性一律用未捨入的換算值判定，顯示才四捨五入（23.98 dBm＝10.00069 Vpp 拒絕、23.979 dBm 接受並顯示 10.000 VPP、3.536 VRMS＝10.00132 Vpp 拒絕）。暫定測試情境參數仍在 `docs/instrument-scope.md` §0.4（PD）。

## 8. 測試命令、exit code（在乾淨 clone 的成品 commit `164c994` 上重跑）

| 命令 | 結果 |
|---|---|
| `python3 verify_bundle.py`（資料包根目錄） | `OK: 21 files match size and SHA-256.`，exit 0 |
| `node scripts/check-control-matrix.mjs` | 190 列通過，exit 0 |
| `node scripts/check-control-matrix.test.mjs` | 12／12 個刻意破壞的矩陣都被擋下，exit 0 |
| `node scripts/render-i00-docs.mjs && git diff --exit-code docs/` | 重新產生的文件與提交的內容完全相同，exit 0 |
| 舊規則殘留字樣搜尋（`docs/`、`README.md`） | 「不可為負」「可精確」「精確量」「設定與讀回不變」「設定與輸出不變」「Shift 暫定指示」「LCD 暫定指示」「原廠：按下顯示」「原廠：本輪保持熄滅」「只說 activates tracking」「不是在講模式鍵」「確保按 AutoSet 一定」「先依顯示解析度」「1 mV 或 3 位有效數字」「可能呈現為 4.99」等 0 筆（已凍結的 `I00-selfcheck.md` 歷史紀錄除外） |
| 數值複算 | −10 dBm＝0.200 Vpp；offset +4 V 時 +13 dBm 峰值 5.41 V；+23.979 dBm＝9.9995 Vpp、+23.98 dBm＝10.0007 Vpp；游標格點 250 µs/div 最近 120／130 µs、50 µs/div 最近 124／126 µs；Position +5 div 時 10× 的 11 檔全不合格，歸零後最小合格 500 mV/div |

這些都只驗結構、一致性與算術，**不是**儀器功能測試。

## 9. 近似行為與未納入（重點，本版有更新的標 ★）

1. **34460A 操作手冊未取得。** Shift 流程、軟鍵、Null 保存、超量程字樣、自動量程換檔點都是 PD。導通門檻 10 Ω 有 datasheet（p.21，第 1 次審查已接受），≤／< 邊界與「OPEN」字樣只有搜尋線索。★ Shift 狀態只在儀器外顯示。
2. **GPE Lock** 依 p.27 近似（第 1 次審查已接受）。★ 換模式時四路全 OFF（p.25 優先於 p.33／p.35 的解讀，PD）；★ 模式鍵顯示相應通道是 OT（p.18），兩列回 ①② 與 tracking 模式下切 ③④ 是 PD。
3. **AFG** ★ 負或 0 dBm 合法，依換算後 Vpp 判定；★ 合法性用未捨入值判定、顯示才捨入（修正複核）；`+/-` 的實機提交語義、Return 提交、超限提示仍為 PD／UN。
4. **TDS** LCD 英文暫定（第 1 次審查已接受）；停止時觸發頻率計仍更新（已接受）。★ 游標步進 1/25 div 與 ±1 步容差為 PD；★ AutoSet 找不到刻度時先把 Position 歸零（PD），接近邊緣仍有壓扁的已知限制。
5. **LCD 文字規則**、**未納入按鍵**：同第 1 版；★ 不能按的 OUT 項目保持熄滅或不繪製，「原廠：」只寫有依據的原廠行為。

reviewer 的非阻擋建議 4（儀器外中文教學說明可標「教學翻譯」）本版沒有採用，留到 I03 再決定。

## 10. 自檢摘要

- 第 1 版自檢（抽取、反向驗證、完整性批評）：見 `docs/reviews/I00-selfcheck.md`（已凍結）。
- 第 1 次獨立審查：REVIEW FAIL，R1–R7；原文 `I00-review-1.md`。
- 本版：逐條回原文核對後修正 R1–R7（56 處修改，含新增列），自查其他機型找到 5 列同類歸屬問題一併修正；再派一個全新 context 子代理對抗檢查，它找到 11 項內容殘留（最重要的是 R3：p.33／p.35 的原文未加註）與 1 項流程缺漏（本紀錄當時尚未更新），再做 25 處修改。全部記在 `I00-fix-1.md`。這些都是實作者端，**不算**獨立審查。
- 修正複核（同一審查脈絡，不計 FAIL）：指出 AFG 幅度判定的兩種捨入會得到相反結果；已改為「先用未捨入值判定，再格式化顯示」（PD），修改 5 處（AFG-F06 規則與驗收、AFG-F08、GAP-AFG-13、offset 4.9995 V 差異列），見 `I00-fix-1.md`「修正複核」一節。

## 11. 下一步

1. 使用者把 `docs/reviews/I00-reviewer-handoff.md` 所列資料交給全新 context 的 reviewer（第 2 次審查）。
2. REVIEW PASS：reviewer 回覆原文存成 `docs/reviews/I00-review-2.md`，再開始 I01。
3. REVIEW FAIL：回 I00 修正後重新送審；這會是 I00 第 2 次 FAIL，第 3 次 FAIL 就停下報告使用者。
