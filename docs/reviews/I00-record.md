# I00 實作紀錄：來源與基線核定

**判決：I00 自測完成／待獨立審查。** 這不是 REVIEW PASS。依 03 與 06，只有全新 context 的獨立 reviewer 能寫 REVIEW PASS／FAIL；拿到 PASS 之前不開始 I01。

（格式依 03「每卡紀錄模板」。）

## 1. 卡 ID、角色、版本

| 項目 | 內容 |
|---|---|
| 卡 ID／角色／日期 | I00／實作者（雲端 Claude Code session）／2026-09-29 |
| 前置 review 版本與判決 | 無（I00 是第一張卡） |
| 基線 HEAD | 無：接手時 repo 沒有任何 commit，遠端也沒有任何 ref（`docs/I00-baseline.md` §2） |
| **成品 commit** | `c668ce316cf36f7ab4b62a256551a0dcbbc36802`（分支 `claude/new-session-24ecn6`） |
| **紀錄 commit** | 本檔所在的 commit，也就是成品 commit 的下一個 commit。完整 hash 見交付訊息，或 `git log -1 -- docs/reviews/I00-record.md`。它相對成品 commit 只新增本檔，可用 `git diff --stat c668ce3 <紀錄 commit>` 確認 |
| dirty | 無（提交前 `git status --short` 為空） |
| HTML SHA-256 | 不適用：I00 是純文件卡，還沒有應用程式或離線 HTML |

## 2. 實際環境

Ubuntu 24.04.4 LTS（Linux 6.18.44 x86_64）雲端容器；Node v22.22.2、npm 10.9.7；Python 3.11.15；Git 2.43.0；Playwright 1.56.1＋Chromium 141.0.7390.37（headless，已實測可點擊）。
沒有接觸任何校機，也沒有使用者的 Mac。viewport／file: 測試不適用（沒有應用程式）。細節見 `docs/I00-baseline.md`。

## 3. 成品與 SHA-256（成品 commit `c668ce3` 時的檔案）

| 檔案 | SHA-256 | 內容 |
|---|---|---|
| `docs/control-matrix.md` | `822234a366ba040403e6eb733b88012827a303e95c3c7812cf5b97ad39d03ad1` | 控制矩陣（190 列） |
| `docs/instrument-scope.md` | `10b36439ee24a6c6638897076340ac40f3e2c6ca185ac6ad7065b280a3514e77` | 核心功能、規格、未納入、缺口、差異、共通規則、暫定測試情境 |
| `docs/sources.md` | `c2a39993042cee584a77e109e50523905ffff1ecab0c41b63e6d4f29999f30d9` | 來源登錄、證據分級、補查手冊紀錄 |
| `docs/I00-baseline.md` | `65b475a759d9973bf1d5b98c3c6bfd8f1ee40309729cc1195bed383649923a21` | 資料包完整性、Git 現場、工具、網路限制 |
| `docs/data/afg.json` | `4d24d0a36e1206cca2bb7d8d0105fc63ce97198ad6dd4b3408caff9f6ebf1671` | AFG-2225 資料 |
| `docs/data/tds.json` | `dcfbcafd78d4c991ec9edde8bc9f1f1a814968170381fd2d26bd2162bcbaefa6` | TDS2001C 資料 |
| `docs/data/gpe.json` | `2d608817ff16f2024cfc177acf8195f2f19915cef82d0136ea2d8eb4a62e1188` | GPE-4323 資料 |
| `docs/data/dmm.json` | `9f90022a928cc846138c078b0bce5f175c78f459aec86cd792d787706f55ddad` | 34460A 資料 |
| `docs/data/common.json` | `e7ea4096ddb0b86f4422d174cf5d7249ea6b63ddbb7f19f9a1df488dd46705e5` | 四台共通規則與暫定測試情境參數 |
| `docs/reviews/I00-selfcheck.md` | `65a4074db1c364ed344d920657dd5dde7ee849cfad3ccd5d60e46fcfdb0e8de8` | 實作者自檢過程與全部裁決 |
| `docs/reviews/I00-reviewer-handoff.md` | `2893bb8dbc60ca2f71d849d8f1d9c161325159c671de66f8ca32d3c5ab268013` | 給獨立 reviewer 的交接 |
| `scripts/check-control-matrix.mjs` | `257ae5842647fc6f166720162594040d648e2e051aca10abd846eaf7ae34aa53` | 矩陣結構自檢 |
| `scripts/check-control-matrix.test.mjs` | `cff195052da43300b69fbd6fbce96e09ec735e1068cd6d7ed86ec5350d9cb676` | 檢查器的 12 個負向案例 |
| `scripts/render-i00-docs.mjs` | `0fde9abb1b34f24a9dbf9e6309935b812224bfbf0e3df4faea21c233fca5fa4d` | 由 JSON 產生兩份矩陣文件 |
| `README.md` | `fd7c9ef39c864fd00f60fbdc0f697108183b6ce35607014d7473ee62e316715b` | 專案說明 |
| `reference/README.md` | `3999ca5955b9da17ef3ccb3ef1920c88b7f07b65f37905bad48a1357272632b2` | 資料包放置方式 |
| `.gitignore` | `33803c2d7ee6938c6645db72c0721c95c4a55120800cad48fb42191e4a1c0a81` | 排除 `reference/*` 等 |

總大小約 0.8 MB，每個檔案都遠小於 30 MB。

## 4. 本卡控制項、來源頁與證據級別（摘要）

| 儀器 | 控制列 | CORE | APPROX | OUT | STATIC | 選單路徑 | 規格 | 核心規則 | 缺口 | 來源差異 | CORE／APPROX 含 PD 或 UN 的列 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AFG-2225 | 46 | 28 | 2 | 13 | 3 | 19 | 32 | 16 | 18 | 16 | 5 |
| TDS2001C | 53 | 27 | 3 | 11 | 12 | 22 | 49 | 21 | 24 | 17 | 1 |
| GPE-4323 | 47 | 24 | 5 | 4 | 14 | 16 | 25 | 12 | 15 | 14 | 15 |
| 34460A | 44 | 10 | 2 | 16 | 16 | 11 | 38 | 15 | 23 | 12 | 12 |

證據級別的分布說明了各台的可信程度：AFG 與 TDS 幾乎每列都有手冊正文（OT）；GPE 的 Lock、Set View 與旋鈕型式有較多 PD／UN；34460A 只有 datasheet（DS），選單與按鍵語義大量是 PD／UN。完整逐列內容見 `docs/control-matrix.md`。

## 5. 最小修改範圍與共用變更

全新 repo，只新增文件與三支無相依套件的 Node 腳本；沒有應用程式碼、沒有 `package.json`（I01 再建立）。
沒有任何共用 UI 變更。資料包不進 Git（repo 是 public，含廠商 PDF 與使用者私人照片）。HFSS／ADS 不在容器內，也沒有被讀寫。

## 6. 案例（I00-1～I00-5）

I00 是文件卡，沒有應用程式，03 註明「免跑尚不存在的應用 e2e」。下表的「自測結果」只代表實作者自檢，最終由獨立 reviewer 判定。

| 案例 | 前置 | 步驟 | 預期 | 實際 | 自測結果 | 證據檔 |
|---|---|---|---|---|---|---|
| I00-1 機型與照片 | 資料包 SHA-256 相符 | 放大 P1／P2 逐顆核對；每台一個抽取代理＋一個反向驗證者；`check-control-matrix.mjs` 比對確切集合 | 四台型號相符；TDS 只有 CH1／CH2＋Ext Trig；GPE 正好 6 顆旋鈕、無 CH3／CH4 電流旋鈕；34460A 無 10 A 孔 | 相符：TDS 3 個 BNC、8 顆旋鈕、無 CH3／CH4；GPE 6 顆旋鈕（CH1 V／I、CH4 V、CH2 V／I、CH3 V）、9 個端子順序 CH4±、CH1±、GND、CH2±、CH3±；34460A 5 個端子、無 10 A、無 Front/Rear | 自測完成 | `docs/control-matrix.md` 各台「照片核對」；檢查器輸出見 `I00-selfcheck.md` §3 |
| I00-2 證據分級 | 同上 | 每列標 PH／OT／DS／IX／PD／UN；驗證者逐條回原文；兩個批評者查過度宣稱 | 照片、官方正文、datasheet、搜尋索引、推論分開；34460A 手冊缺口與 GPE Lock 歧義保留 | 34460A 選單全部 PD／UN，datasheet 行銷照的軟鍵標籤已降為 PD；GPE Lock 兩派原文並列（p.12／p.27 vs p.15／p.19／p.43），暫採 p.27 並標近似 | 自測完成 | `docs/sources.md` §1、§3；`I00-selfcheck.md` §2、§4 |
| I00-3 核心與未納入 | 讀 02 各台必做／未納入 | 逐項對照 02，建立 core_features 與 out_of_scope；批評者查覆蓋 | 不擅自取消核心、不加入高階型號功能 | 02 必做項都有 CORE／APPROX 列與可驗收規則；Pulse、Noise、ARB、MOD、FFT、Video、Ω4W、Probe Hold 等 OUT；沒有加入 34461A/65A/70A、GPE-4323A、四通道 TDS 的功能 | 自測完成 | `docs/instrument-scope.md` 各台「核心功能」「本輪未納入」 |
| I00-4 未提供資料與暫定規格 | — | 列出韌體、LCD 語言、開機記憶等；每個暫定都寫理由與驗證方式 | 不要求使用者一次補齊；暫定有明確單一規格 | 共通 0.1 表＋各台 gaps（共 80 條）；每條有暫定、理由、日後驗證；第二輪把多選項的暫定改成單一值；另訂暫定測試情境參數（0.4 節，PD） | 自測完成 | `docs/instrument-scope.md` §0 與各台「資料缺口」 |
| I00-5 repo、工具、hash | 容器剛啟動 | 檢查 Git 現場、Node／Playwright／Chromium、跑 `verify_bundle.py` | 新 repo 不覆蓋既有工作；瀏覽器可用；hash 可追溯；HFSS 沒動 | 空 repo、無遠端 ref；Chromium 141 headless 點擊實測可用；21 個檔案 SHA-256 全符合；HFSS／ADS 不在容器內、沒被動 | 自測完成 | `docs/I00-baseline.md` |

使用者途中追加的要求（包內不足時主動找同型號原廠手冊、記錄網址版本頁碼、查不到列待確認）：已用 WebSearch 查四台原廠文件與繁中手冊，全部記在 `docs/sources.md` §3。
原廠與第三方網域都被環境網路政策封鎖，所以**沒有取得任何新的正文**；查到的網址、料號、版本只記為 IX，頁碼都是「未取得」。沒有因此停掉已有充分資料的功能。

## 7. 數值容差與 fixture 規格

I00 沒有數值量測。02 的 S1、S2、S3、L1、D1 補了一組暫定參數（`docs/instrument-scope.md` §0.4，全部是 PD），讓各卡驗收值可以核對；I01 定案時可調整，但要同步改各卡驗收。

## 8. 測試命令、exit code

| 命令 | 結果 |
|---|---|
| `python3 verify_bundle.py`（資料包根目錄） | `OK: 21 files match size and SHA-256.`，exit 0 |
| `node scripts/check-control-matrix.mjs` | 190 列通過，exit 0（完整輸出見 `I00-selfcheck.md` §3） |
| `node scripts/check-control-matrix.test.mjs` | 12／12 個刻意破壞的矩陣都被擋下，exit 0 |
| `node scripts/render-i00-docs.mjs && git diff --exit-code docs/` | 重新產生的文件與提交的內容完全相同，exit 0 |

這些都只驗結構與一致性，**不是**儀器功能測試。

## 9. 近似行為與未納入（重點）

完整清單在 `docs/instrument-scope.md`。對後續各卡影響最大的：

1. **34460A 操作手冊未取得。** Shift 流程、軟鍵、Null 保存、超量程字樣、自動量程換檔點都是 PD。導通門檻 10 Ω 有 datasheet（p.21），但 ≤／< 的邊界與「OPEN」字樣只有搜尋線索。
2. **GPE Lock** 原廠說法矛盾，暫採「只鎖 CH1／CH2 電壓旋鈕」；Set View 的返回時機、旋鈕型式（推定為有端點的 VR）都是 PD。
3. **AFG** 的 Return／換功能時數字輸入是否提交、超限提示字樣、開機狀態、Load 是否也在 UTIL 裡都未知；暫定「只有按單位鍵才提交、超限拒絕並保留原值」。
4. **TDS** 的 LCD 語言未知（手冊說開機可選繁中）；AutoSet 選檔演算法、量測交越位準、游標步進是 PD。電源循環依手冊回復上次設定。
5. **LCD 文字規則**：有來源才照原文；只有 IX／PD 依據的英文字樣須列入儀器外近似清單；沒有字樣來源就用不含文字的記號。LCD 不放中文。
6. **未納入的按鍵**：按下時 LCD 與狀態都不變，只在儀器外顯示範圍說明。

## 10. 自檢摘要

- 反向驗證者（每台一個）：3 個 error、39 個 warn，全部回原文核對後採納。
- 兩個完整性批評者：26 條（5 must-fix、21 should-fix，有重疊），全部採納。
- 實作者另外修正：檢查器抓到的 TDS 端子 ID 與「同…」來源，以及 TDS 電源鍵依 p.20 改為 APPROX。
- 過程與逐條裁決：`docs/reviews/I00-selfcheck.md`。這些都是實作者派出的子代理，**不算**獨立審查。

## 11. 下一步

1. 使用者把 `docs/reviews/I00-reviewer-handoff.md` 所列資料交給全新 context 的 reviewer。
2. REVIEW PASS：reviewer 回覆原文存成 `docs/reviews/I00-review-1.md`，再開始 I01。
3. REVIEW FAIL：回 I00 修正後重新送審；同一張卡三次 FAIL 就停下報告使用者。
4. 可選：若能放寬網路或上傳 Keysight 9018-03876 PDF，先補 34460A 正文，只回修 I05 相關列。
