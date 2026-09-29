# I00 基線：資料包、工作目錄、Git 與工具

紀錄日期：2026-09-29。角色：I00 實作者。本檔記錄現場事實，不含任何儀器功能驗收。

## 1. 附件完整性（I00-5）

| 項目 | 結果 |
|---|---|
| 交接 ZIP | `電子學儀器模擬_Opus交接包_20260929.zip`（上傳後檔名被改為 `b1897dc9-________Opus____20260929.zip`）13,836,450 bytes，SHA-256 `c447853c04780d274e3fddab16bbcb7ffcc962b3bf5427cd70a062c2ddfa3a83` |
| 啟動指令 | `貼給Opus_啟動指令.txt` SHA-256 `6f4bd367…124638d`，與包內 `START_PROMPT.txt` 逐位元相同（`diff` 無差異；MANIFEST 記錄的 SHA-256 亦同） |
| 交接說明 md | 上傳後只剩 `e6f8aebd-____.md`（原檔名的中文字被移除），SHA-256 `5e6e018d10f9c2d48262fa3ca80664ff05cee0035a0e6b026638fc63fc19dfdc`；內容是「先上傳 ZIP、再貼啟動指令、第一回合只做 I00」的使用說明 |
| 解壓 | 21 個檔案，全部可讀 |
| `python3 verify_bundle.py` | `OK: 21 files match size and SHA-256. This is NOT an application test.`，exit 0（在 scratchpad 與 `reference/` 各跑一次，結果相同） |
| PDF 可解析性 | PyMuPDF 1.28.2 開啟 5 份 PDF：M-AFG 307 頁、M-GPE 49 頁、M-TDS-11 161 頁、M-TDS-13 161 頁、D-DMM 28 頁，與 `DOWNLOAD_SOURCES.json` 一致；全部抽得出正文文字 |
| DOCX | C-RC 以 OOXML 讀得欄位：電源波形／電源＆電容波形的電壓刻度、時間刻度、峰對峰值、頻率、相位差、實驗心得。沒有 R、C 值或電路圖，與 04 描述一致 |
| 照片 | P1、P2 各 768×1024、300 dpi JPEG；SHA-256 與 MANIFEST 相符。放大裁切只在 scratchpad 產生，未改原檔 |

`verify_bundle.py` 只驗檔案大小與雜湊，不是功能測試。

## 2. 工作目錄與 Git 現場

| 項目 | 結果 |
|---|---|
| 工作目錄 | `/home/user/ee-ss`（雲端容器，非使用者 Mac） |
| 遠端 | `https://github.com/sapunomin1-star/ee-ss`，**public** repo，預設分支 `main` |
| 接手時狀態 | 本機分支 `claude/new-session-24ecn6`，**尚無任何 commit**，工作樹空白；`git ls-remote origin` 沒有任何 ref（遠端也是空的） |
| 基線 HEAD | 無（空 repo）。所以本卡不會覆蓋任何既有工作 |
| 本專案定位 | 這個 repo 就是獨立的 `electronics-lab-trainer` 專案根目錄。I01 建 `package.json` 時把 name 定為 `electronics-lab-trainer` |
| HFSS／ADS | 容器內不存在 `ads-hfss-trainer` 或任何 HFSS／ADS 專案（`find / -maxdepth 4 -iname '*hfss*'` 無結果）；本卡沒有讀寫或修改它們 |
| 交付分支 | 只推 `claude/new-session-24ecn6`；不合併 `main`、不開 PR（除非使用者要求）、不做 GitHub Pages 或其他公開部署 |

### 為什麼資料包不進 Git

repo 是 public。包內 PDF 是廠商著作，照片是使用者私人拍攝，`PHOTO_ORIGINS.json` 還含使用者 Mac 的本機路徑。
所以 `.gitignore` 排除 `reference/*`，文件只用「來源 ID＋檔名＋SHA-256＋頁碼」引用。重建方式見 `reference/README.md`。
Reviewer 需要另外取得同一份交接包。

## 3. 可用工具（I01 選工具的依據）

| 工具 | 版本／狀態 |
|---|---|
| OS | Ubuntu 24.04.4 LTS，Linux 6.18.44 x86_64，4 vCPU，15 GiB RAM |
| Node／npm | v22.22.2／10.9.7（另有全域 pnpm 10.33.0、yarn 1.22.22） |
| Python | 3.11.15（標準函式庫沒有 PDF 套件；PyMuPDF 只裝在 scratchpad 的 venv，專案不依賴它） |
| Git | 2.43.0 |
| Playwright | 全域 1.56.1。`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`，內含 chromium-1194（Chromium 141.0.7390.37）與 headless shell |
| 瀏覽器實測 | 用 Playwright 開啟 headless Chromium，1440×900 viewport，`page.mouse.click` 與 `page.click` 都能觸發 DOM click（最小探針，不是本專案測試） |
| LibreOffice | `/usr/bin/soffice` 存在（本卡未使用） |

I01 注意：專案若自己鎖定 `@playwright/test` 版本，要跟 1.56.x 相容，或用 `executablePath: '/opt/pw-browsers/chromium'`；不要執行 `playwright install`，也不要寫死 Mac Chrome 路徑。

## 4. 網路與補手冊的嘗試

使用者在本卡中途補充了要求：包內資料不足時，要主動查找對應型號的原廠操作手冊，並記錄網址、版本與頁碼。實際結果如下：

| 嘗試 | 結果 |
|---|---|
| `curl` 下載 Keysight Operating and Service Guide（`www.keysight.com/.../9018-03876.pdf`） | `CONNECT tunnel failed, response 403`；proxy 狀態記為 `connect_rejected www.keysight.com:443` |
| `curl` 探測 gwinstek.com、tek.com、download.tek.com、keysight.com、literature.cdn.keysight.com、manualslib.com 等 | 全部連不上（000／403） |
| WebFetch（伺服器端）讀 keysight.com、literature.cdn.keysight.com、gwinstek.com、tek.com | 全部 `EGRESS_BLOCKED` |
| `curl` 探測第三方副本網域 batronix.com、docs.rs-online.com、tme.eu、xdevs.com、newark.com、assets.testequity.com | 全部 `CONNECT … 403` |
| WebSearch | 可用，但只有標題、網址與摘要，不是手冊正文。另查了 TDS 繁中手冊 077-0834-XX、GPE-4323 中文手冊、34460A 繁中手冊，都沒有找到公開網址 |

結論：目前環境的網路政策擋住三家原廠網域，所以 34460A 完整操作手冊（M-DMM）**仍未取得**。搜尋得到的官方網址／版本只當「IX 索引定位」，詳見 `docs/sources.md`。
要解除的話，使用者可以在雲端環境設定（session 標題列的環境選單 → Edit → Network access）放寬存取，或把 `www.keysight.com` 等網域加進允許清單；也可以直接把 PDF 上傳到下一個 session。
