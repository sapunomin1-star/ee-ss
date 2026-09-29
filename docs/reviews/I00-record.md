# I00 實作紀錄：來源與基線核定（第 4 版：修正複核 C1 補齊，疊在第 3 版上）

**判決：I00 同卡修正自測完成／待第 2 次獨立審查。** 這不是 REVIEW PASS。依 03 與 06，只有全新 context 的獨立 reviewer 能寫 REVIEW PASS／FAIL；拿到 PASS 之前不開始 I01。

（格式依 03「每卡紀錄模板」。）

## 1. 卡 ID、角色、版本

| 項目 | 內容 |
|---|---|
| 卡 ID／角色／日期 | I00／實作者（使用者 Mac 上的 Claude Code session）／2026-09-29 |
| 前次獨立審查 | 第 1 次：**REVIEW FAIL**，必改 R1–R7。報告原文 `docs/reviews/I00-review-1.md`（SHA-256 `95685810…a09e`）。當次被審版本：成品 `c668ce3`／紀錄 `9f8a083` |
| 修正複核（非正式） | `docs/reviews/I00-correction-recheck.md`（SHA-256 `96885030…05ff`）：沿用第 1 次審查 context 的有界複核，**不是**第 2 次獨立審查，不計入 FAIL 次數。結論：R1–R7 已處理，另有 C1（AFG 幅度的捨入與判定順序，P2）。當次被查版本：成品 `35f0c85`／紀錄 `51d9b17` |
| 第 3 版（雲端 session） | 成品 `164c994`／紀錄 `453e8de`：另一個雲端 session 依使用者轉述先修了 C1 的一部分（拿不到複核原文），沒有送審。第 4 版以它為基礎補齊，差異見 `I00-fix-C1.md`「與第 3 版的關係」 |
| 本次修正對照 | `docs/reviews/I00-fix-C1.md`（C1）；R1–R7 仍見 `docs/reviews/I00-fix-1.md` |
| 基線 HEAD | `453e8de719816cd86e6a575e4d9454d66c30ca6c`（第 3 版的紀錄 commit） |
| **成品 commit** | `fc98813dc16812f875a104703c3f5c4518f1106f`（分支 `claude/new-session-24ecn6`）。基線之後只有這一個成品 commit |
| **紀錄 commit** | 本檔所在的 commit，也就是成品 commit 的下一個 commit。完整 hash 見交付訊息，或 `git log -1 -- docs/reviews/I00-record.md`。它相對成品 commit 只修改本檔，可用 `git diff --stat fc98813 <紀錄 commit>` 確認 |
| dirty | 無（提交前 `git status --short` 為空） |
| HTML SHA-256 | 不適用：I00 是純文件卡，還沒有應用程式或離線 HTML |
| 審查次數 | I00 第 1 次獨立 FAIL；修正複核不計；第 3 版沒有送審；本版送第 2 次獨立審查。實作者內部的檢查都不算審查次數 |

### 版本歷程

| 版本 | 成品 commit | 紀錄 commit | 判決 |
|---|---|---|---|
| 第 1 版 | `c668ce316cf36f7ab4b62a256551a0dcbbc36802` | `9f8a0833b301e58313a50270a641d5b08a3582ab` | 第 1 次獨立審查：REVIEW FAIL（R1–R7） |
| 第 2 版 | `35f0c85b5ac97aaca818603ead9f05ea26332bbc` | `51d9b17e34a820f9ae0f04716925897446727709` | 修正複核（非正式）：R1–R7 已處理，C1 待修 |
| 第 3 版 | `164c9945d60dd1dc3b2d46cbb097c317d821bdae` | `453e8de719816cd86e6a575e4d9454d66c30ca6c` | 雲端 session 依轉述部分修正 C1；沒有送審，由第 4 版補齊 |
| 第 4 版（本版） | `fc98813dc16812f875a104703c3f5c4518f1106f` | 本檔所在 commit | 待第 2 次獨立審查 |

## 2. 實際環境

第 4 版在使用者的 Mac 上完成：macOS 15.7.7（24G720）；Node v22.22.3、npm 10.9.8；Python 3.9.6；Git 2.39.5（Apple Git-154）。從 GitHub clone 後修改；push 前發現雲端 session 已推第 3 版，依使用者決定改以第 3 版為基礎重新套用。沒有接觸任何校機。
第 1–3 版在 Ubuntu 24.04 雲端容器完成（Node v22.22.2、Python 3.11.15、Git 2.43.0），細節見 `docs/I00-baseline.md` 與 git 歷史中的前一版紀錄。viewport／file: 測試不適用（沒有應用程式）。

## 3. 成品與 SHA-256（成品 commit `fc98813` 時的檔案）

| 檔案 | SHA-256 | 本版有無修改 |
|---|---|---|
| `docs/control-matrix.md` | `3d4b52c17da3844f3c2e997590def6e96520ee8a66e5ba21964c20b97dfa2631` | 重產 |
| `docs/instrument-scope.md` | `ea9adf0b343d67076fa99d0620da8530864b393a24e0b50949c6b5f2376ca269` | 重產 |
| `docs/data/afg.json` | `95cd593336f4eb883c99e5c8ae2ec68e8a95818d8320f27561d9a82883fd8b81` | C1（以第 3 版為基礎補齊） |
| `docs/data/tds.json` | `be8fffbaba912bd6e20b5068fce69df14d4405764fde14ccf318815f72d9e987` | 未改 |
| `docs/data/gpe.json` | `fbb4227530ff81b1bc35c55cccdca6ceeb71509b7c0fe7f1940b06641c63c9fc` | 未改 |
| `docs/data/dmm.json` | `ce90d10a9bfe3c5c237b071adb1442acfae83d0055d9a8119e29f2c5b26c622f` | 未改 |
| `docs/data/common.json` | `42aefe78a0151e9039aae93ad81c41c62bc07f8f5f0703fbfd22ef1d04f6c88d` | 未改 |
| `docs/reviews/I00-correction-recheck.md` | `96885030fd2544b6dc94e520558f0c314b28ce946e0a68f697b9f21feb6005ff` | 新增（修正複核原文，與複核交接檔的 SHA-256 相符） |
| `docs/reviews/I00-fix-C1.md` | `cf0e23603e2263ebb1ca19580c19618fa787bc29163f1df65658f39e4f2544e9` | 新增 |
| `docs/reviews/I00-fix-1.md` | `43123ecf73960ace1058401d14a3d4a3a8a007be52fdbe87b4db309284ec8e6f` | 第 3 版寫的末節保留；本版在被取代的句子後加〔C1 更正〕〔第 4 版更正〕標記，表頭加 1 列；原句未改 |
| `docs/reviews/I00-reviewer-handoff.md` | `26de07f13a9f2511ed49bb48637fd04c12737590f2f0bb502f1c94a07eb5232c` | 補 C1 的交接與檢查項目 |
| `docs/reviews/I00-review-1.md` | `95685810367f226202a1ee8071fca0674c03fb8395de961706da85addb61a09e` | 未改 |
| `docs/reviews/I00-selfcheck.md` | `dfcdb8be62ef2c19553b3894ea76c89c90fdc120a5f38036000ea85ffb9b35b4` | 未改（凍結） |
| `README.md` | `05b16ee944b8c4fee9f2aff90c3c9174d1e649bb006db941529dfdf9c180254f` | 更新「目前狀態」 |
| `docs/sources.md` | `c2a39993042cee584a77e109e50523905ffff1ecab0c41b63e6d4f29999f30d9` | 未改 |
| `docs/I00-baseline.md` | `65b475a759d9973bf1d5b98c3c6bfd8f1ee40309729cc1195bed383649923a21` | 未改 |
| `scripts/check-control-matrix.mjs` | `257ae5842647fc6f166720162594040d648e2e051aca10abd846eaf7ae34aa53` | 未改 |
| `scripts/check-control-matrix.test.mjs` | `cff195052da43300b69fbd6fbce96e09ec735e1068cd6d7ed86ec5350d9cb676` | 未改 |
| `scripts/render-i00-docs.mjs` | `0fde9abb1b34f24a9dbf9e6309935b812224bfbf0e3df4faea21c233fca5fa4d` | 未改 |
| `reference/README.md` | `3999ca5955b9da17ef3ccb3ef1920c88b7f07b65f37905bad48a1357272632b2` | 未改 |
| `.gitignore` | `33803c2d7ee6938c6645db72c0721c95c4a55120800cad48fb42191e4a1c0a81` | 未改 |

修正複核的 `verification.json`、`verification.log` 含使用者 Mac 的本機路徑，repo 又是 public，所以沒有提交；只記錄本機算得的雜湊：`verification.json` `b8ce0154…c62d28`、`verification.log` `fff87409…644398`。複核交接檔 `交接檔案SHA256.json` 列出的兩個檔（複核報告 `96885030…05ff`、給實作者的說明 `490b5f1e…bb65`）已核對相符。

## 4. 本卡控制項、來源頁與證據級別（摘要）

| 儀器 | 控制列 | CORE | APPROX | OUT | STATIC | 選單路徑 | 規格 | 核心規則 | 缺口 | 來源差異 | CORE／APPROX 含 PD 或 UN 的列 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AFG-2225 | 46 | 28 | 2 | 13 | 3 | 19 | 33 | 16 | 19 | 17 | 6 |
| TDS2001C | 53 | 27 | 3 | 11 | 12 | 22 | 49 | 21 | 24 | 17 | 1 |
| GPE-4323 | 47 | 24 | 5 | 4 | 14 | 16 | 25 | 12 | 15 | 15 | 15 |
| 34460A | 44 | 10 | 2 | 16 | 16 | 11 | 38 | 15 | 23 | 12 | 12 |

與第 2、3 版相比（第 3 版的條目數與第 2 版相同）：控制列、狀態、卡別、選單路徑數、規格列數、核心規則數都沒變。AFG 缺口多一列 GAP-AFG-19（幅度提交的判定順序），來源差異多一列（「3.536 Vrms 是不是 sine 的 Vrms 上限」）；規格「幅度範圍」列名由「20 MHz 以下」改為「低於 20 MHz」。表中數字由 `docs/data/*.json` 直接計算。

## 5. 最小修改範圍與共用變更

- 以第 3 版為基礎，只改 `docs/data/afg.json` 裡引用 C1 同一條規則的欄位，再重產兩份文件。欄位清單與每一項的理由見 `I00-fix-C1.md`；第 3 版改過的 AFG-F06、AFG-F08、GAP-AFG-13 與 offset 來源差異，第 4 版的寫法涵蓋並取代它們。
- 另外新增或更新：修正複核原文、C1 修正對照、`I00-fix-1.md` 的〔C1 更正〕〔第 4 版更正〕標記（第 3 版寫的末節保留）、交接、README 與本紀錄。
- 沒有改 TDS、GPE、DMM 的 JSON、`common.json` 與三個腳本；沒有新增功能、沒有刪除核心項目、沒有放寬 R1–R7 已定的驗收。
- 沒有合併 main、沒有部署、沒有開始 I01 或 J 階段。

## 6. 案例（I00-1～I00-5）

I00 是文件卡，沒有應用程式，03 註明「免跑尚不存在的應用 e2e」。下表的「自測結果」只代表實作者自檢，最終由獨立 reviewer 判定。

| 案例 | 前次判定 | 本版處理 | 自測結果 | 證據檔 |
|---|---|---|---|---|
| I00-1 機型、面板與數量 | 第 1 次審查：相符 | 未改（控制列、數量、端子順序照舊；檢查器仍通過） | 自測完成 | `docs/control-matrix.md` 各台「照片核對」 |
| I00-2 證據分級 | R5、R6 已修，修正複核確認 | C1：判定順序、顯示格式、「3.536 是捨入標示」都標成 PD 或推論；新增 GAP-AFG-19 與來源差異一列 | 自測完成 | `docs/reviews/I00-fix-C1.md` |
| I00-3 核心功能與未納入 | R1、R3 已修 | C1：AFG-F06 改為先判定未捨入值；offset、Load 切換、旋鈕、只換顯示單位都引用同一規則 | 自測完成 | `docs/reviews/I00-fix-C1.md` |
| I00-4 暫定規格與驗收 | R2、R4、R7 已修；C1 第 3 版部分修正 | C1：F06 驗收 (a)–(h) 寫成完整按鍵序列，已提交值與 LCD 字串分開寫；F11、F16 驗收同步 | 自測完成 | `docs/reviews/I00-fix-C1.md`「文件複算」 |
| I00-5 版本、來源與環境 | 已查 | 本版 commit 與 hash 見第 1、3 節；乾淨 clone 重跑所有檢查（第 8 節） | 自測完成 | 本檔 |

## 7. 數值容差與 fixture 規格

I00 沒有數值量測。本版與容差有關的修改都是 PD：

- AFG 幅度與 offset 一律用未捨入值判定；比較時容許 1×10⁻⁹ V，只為吸收浮點誤差。
- dBm 不另設硬邊界。+23.979／+17.958 dBm 只是範圍內的三位小數示例；10／5 Vpp 實際對應 +23.979400087…／+17.958800173… dBm，1 mVpp 對應 −56.020599913… dBm。判定一律回到 Vpp。
- LCD 以十進位四捨五入：VPP／VRMS 取 3 位小數（結果 ≥10 時改 2 位），dBm 2 位，mVPP／mVRMS 1 位。

TDS 游標容差（±1 個游標步進）與 §0.4 的暫定測試情境參數沒有改。

## 8. 測試命令、exit code（在乾淨 clone 的成品 commit `fc98813` 上重跑）

| 命令 | 結果 |
|---|---|
| `python3 verify_bundle.py`（資料包根目錄） | **本版沒有重跑**：資料包 zip 不在這台 Mac 上，第 1–3 版的 21／21 是雲端紀錄。本版引用的 M-AFG PDF 頁（p.26、p.61–62、p.202–203、p.207、p.210、p.215、p.279、p.288）取自 SHA-256 `79b684d4f7480d0dfed7a502908af79b297db975b7e336881d066c2e030b8d40` 的檔案，與 `docs/sources.md` 的 M-AFG 前綴 `79b684d4f7480d0d` 相符 |
| `node scripts/check-control-matrix.mjs` | 190 列通過（AFG 46、TDS 53、GPE 47、DMM 44），exit 0 |
| `node scripts/check-control-matrix.test.mjs` | 12／12 個刻意破壞的矩陣都被擋下，exit 0 |
| `node scripts/render-i00-docs.mjs && git diff --exit-code docs/` | 重新產生的文件與提交的內容完全相同，exit 0 |
| 舊規則殘留字樣搜尋（`docs/`、`README.md`） | 「先依顯示解析度」只出現在 GAP-AFG-19 說明舊規則的地方、`I00-fix-C1.md` 的「原規則」欄與 `I00-fix-1.md` 第 3 版末節的「原規則」欄；「精確的 +」「−56.02～+23.979」只出現在 `I00-fix-1.md` 已加〔C1 更正〕的原句與 `I00-fix-C1.md`；「10.000 VPP」只出現在第 3 版末節已加〔第 4 版更正〕的原句與 `I00-fix-C1.md` 的說明；「顯示值 ×2」只出現在 `I00-fix-C1.md` 與交接裡「不得再有這類兩讀」的說明；「可能呈現為 4.99」「若換算後超限」在 `docs/data/` 與生成文件中 0 筆。凍結的 `I00-selfcheck.md` 與複核原文保留舊說法 |
| 數值複算（Python `decimal`，50 位；實作者端腳本，未提交） | 71 項全部相符。重點：+23.979 dBm≈9.99954、+23.98 dBm≈10.00069、+17.958 dBm≈4.99954、+17.959 dBm≈5.00012 Vpp；0 dBm≈0.632456、−10 dBm＝0.2 Vpp；offset +4 V 時 +13 dBm 峰值≈5.4125 V；3.535 VRMS≈9.998489886、3.536 VRMS≈10.00132 Vpp；13.52 dBm≈2.99937 Vpp，切 High Z 顯示 5.999 VPP；LCD 字串 23.98 dBm、17.96 dBm、3.536 VRMS、10.00 VPP、9.998 VPP |

這些都只驗結構、一致性與算術，**不是**儀器功能測試。

## 9. 近似行為與未納入（重點，本版有更新的標 ★）

1. **34460A 操作手冊未取得。** Shift 流程、軟鍵、Null 保存、超量程字樣、自動量程換檔點都是 PD。導通門檻 10 Ω 有 datasheet（p.21，第 1 次審查已接受），≤／< 邊界與「OPEN」字樣只有搜尋線索。Shift 狀態只在儀器外顯示。
2. **GPE Lock** 依 p.27 近似（第 1 次審查已接受）。換模式時四路全 OFF（p.25 優先於 p.33／p.35 的解讀，PD）；模式鍵顯示相應通道是 OT（p.18），兩列回 ①② 與 tracking 模式下切 ③④ 是 PD。
3. **AFG** 負或 0 dBm 合法，依換算後 Vpp 判定；`+/-` 的實機提交語義、Return 提交、超限提示仍為 PD／UN。
   - ★ 幅度與 offset 一律先判定未捨入值，合法才提交，LCD 只格式化（AFG-F06、GAP-AFG-19）。
   - ★ 同一規則的已知限制：顯示值不一定能照打回去（3.536 VRMS、23.98 dBm、17.96 dBm）；已提交值不在顯示格點上時，旋鈕可能在畫面看似合法的地方被擋。
   - ★ 手冊遠端章節把 3.536 Vrms 寫成 sine 的上限讀值；本專案推論那是捨入標示（PD，待校機）。
4. **TDS** LCD 英文暫定（第 1 次審查已接受）；停止時觸發頻率計仍更新（已接受）。游標步進 1/25 div 與 ±1 步容差為 PD；AutoSet 找不到刻度時先把 Position 歸零（PD），接近邊緣仍有壓扁的已知限制。
5. **LCD 文字規則**、**未納入按鍵**：同第 2 版。★ AFG 的 VRMS、dBm、mV 單位顯示位數與 ≥10 V 的 VPP 格式都是 PD（≥10 V 只有 p.26 一張 20.00 VPP 說明畫面），I02 要列入儀器外近似清單。

reviewer 的非阻擋建議 4（儀器外中文教學說明可標「教學翻譯」）本版仍未採用，留到 I03 再決定。

## 10. 自檢摘要

- 第 1 版自檢（抽取、反向驗證、完整性批評）：見 `docs/reviews/I00-selfcheck.md`（已凍結）。
- 第 1 次獨立審查：REVIEW FAIL，R1–R7；第 2 版的修正見 `I00-fix-1.md`。
- 修正複核（非正式）：R1–R7 已處理，指出 C1；原文 `I00-correction-recheck.md`。
- 第 3 版（雲端 session）：依轉述修 5 處（AFG-F06 規則與驗收、AFG-F08、GAP-AFG-13、offset 4.9995 V 來源差異），見 `I00-fix-1.md` 末節。
- 本版的實作者端檢查分兩輪，**都不算**獨立審查。兩輪都在第 2 版基礎上進行；疊到第 3 版時，afg.json 與生成文件和檢查過的版本相同，只合併了 `I00-fix-1.md`、交接與 `I00-fix-C1.md` 的文字：
  - **改之前：** 派 5 個唯讀子代理檢查修改草案，分別負責完整性掃描、手冊證據、數值複算、嚴格 reviewer 模擬、I02 實作者模擬。補齊它們指出的交叉引用後才套用；相對第 2 版的淨改動是 afg.json 33 個欄位（含 1 個列名）與 2 個新增條目。
  - **改之後：** 原本派 4 個唯讀子代理做對抗驗證（正式 reviewer 模擬、驗收逐步執行、一致性掃描、範圍與紀錄衛生）。使用者認為這一輪沒有必要，中途停止，只有「範圍與紀錄衛生」完成：判通過、沒有阻擋項。它指出的都是 `I00-fix-C1.md` 的措辭與交接漏列，已在成品 commit 前修正；另依它的建議刪掉原本新增在 GAP-AFG-05 的拒絕提示要求，以免超出 C1 範圍。其餘三個沒有結果，所以本版的修改後檢查以第 8 節的指令為準。

## 11. 下一步

1. 使用者把 `docs/reviews/I00-reviewer-handoff.md` 所列資料交給全新 context 的 reviewer（第 2 次審查）；待審的是本檔所在的紀錄 commit。
2. REVIEW PASS：reviewer 回覆原文存成 `docs/reviews/I00-review-2.md`，再開始 I01。
3. REVIEW FAIL：回 I00 修正後重新送審。這會是 I00 第 2 次獨立 FAIL（修正複核不計）；第 3 次 FAIL 就停下報告使用者。
