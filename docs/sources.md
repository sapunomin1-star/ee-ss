# 來源登錄與證據分級

整理日期：2026-09-29（I00）。本檔是 `docs/control-matrix.md` 與 `docs/instrument-scope.md` 的引用依據。
來源 ID 沿用交接包 `04_來源與照片對照.md`。所有檔案路徑都相對於解壓後的 `reference/electronics-lab-handoff-20260929/`（不進 Git，見 `reference/README.md`）。

## 1. 證據級別代碼

| 代碼 | 意義 | 能支持 | 不能支持 |
|---|---|---|---|
| **PH** | 本次照片直接確認（P1／P2） | 機型、固定標籤（含中文貼面、Shift 次標籤）、控制項數量與分組、端子順序 | LCD 全暗：任何選單、開機畫面、預設值、按鍵效果、指示燈時序 |
| **OT** | 本次官方手冊正文核對（I00 實際讀過的頁） | 列出頁面上的操作語義、選單路徑、規格數字 | 沒讀到的頁；實機韌體差異；實際操作驗證 |
| **DS** | 本次 datasheet 核對（D-DMM） | 34460A 功能範圍、量程、機型差異 | 每層軟鍵流程、提交／取消細節、Null／導通細節 |
| **IX** | 官方索引或搜尋結果定位，未取得正文 | 「該文件存在、在哪裡、版本是什麼」 | 任何操作細節（搜尋摘要不算正文） |
| **PD** | 規劃者或實作者的推論、教學決策（明示暫定） | 可操作的暫定規格；測試只證明符合此規格 | 校機行為相同 |
| **UN** | 未知，待校機或補手冊 | — | — |

可以組合，例如 `PH+OT` 表示照片確認標籤、手冊確認功能。矩陣中 `CORE` 列至少要有 PH、OT 或 DS 其中一項（由 `scripts/check-control-matrix.mjs` 檢查）。

## 2. 本包來源

| ID | 檔案 | 版本／識別 | 頁數 | 印刷頁 ↔ PDF 頁 | SHA-256（前 16 碼） |
|---|---|---|---|---|---|
| P1 | `materials/photos/01_校機_AFG2225_34460A_GPE4323.jpeg` | 使用者 2026-09-29 提供；上 AFG-2225／中 34460A／下 GPE-4323 | 768×1024 | — | `1b0f1643b073ec37` |
| P2 | `materials/photos/02_校機_TDS2001C.jpeg` | 同上；TDS2001C 正面 | 768×1024 | — | `2dc102a3006e5c94` |
| M-AFG | `materials/manuals/AFG-2225_User_Manual_EN_VerB.pdf` | AFG-2225 Series User Manual，原廠下載索引 Ver.B 2020-03-13 | 307 | 印刷頁＝PDF 頁（p.13、p.144 已核） | `79b684d4f7480d0d` |
| M-TDS-13 | `materials/manuals/TDS2000C_TDS1000C-EDU_077082600_2013.pdf` | 077-0826-00，2013-04-11；適用清單含 TDS2001C | 161 | PDF 頁＝印刷頁＋24（p.7→PDF 31、p.79→103、p.104→128 已核） | `9db1d5147c068bfa` |
| M-TDS-11 | `materials/manuals/TDS2000C_TDS1000C-EDU_071272203_2011.pdf` | 071-2722-03，2011-04-14；交叉核對用 | 161 | 同 M-TDS-13（＋24，已核同樣四頁） | `d10f4dce0ab04a30` |
| M-GPE | `materials/manuals/GPE-4323_User_Manual_EN_82GP343230E01.pdf` | GPE-1326/2323/3323/4323 Series User Manual，82GP343230E01，索引 F.,EN 2019-10-02 | 49 | 印刷頁＝PDF 頁（p.15 已核） | `9239f7717f6b1b1b` |
| D-DMM | `materials/manuals/Truevolt_34460A_DataSheet_5991-1983EN.pdf` | 5991-1983EN，34460A/34461A/34465A/34470A 共用 datasheet，**不是操作手冊** | 28 | 印刷頁＝PDF 頁（p.11、p.21、p.27 已核） | `6f8ff9debdd277e2` |
| C-RC | `materials/classroom/電子學實習作業_RC電路波形測量.docx` | 使用者既有作業原檔 | — | — | `172aa7756a246a08` |

完整 SHA-256 在包內 `MANIFEST.json`；`verify_bundle.py` 全數通過（見 `docs/I00-baseline.md`）。

## 3. 未取得的來源與查找紀錄

使用者在 I00 途中要求：包內資料不足時要主動找「同型號」的原廠操作手冊，並記錄網址、版本與頁碼。

**這次沒有取得任何新的正文。** curl 和 WebFetch 碰到下列網域都被網路政策擋下（403／EGRESS_BLOCKED）：
`www.keysight.com`、`keysight.com`、`literature.cdn.keysight.com`、`rfmw.em.keysight.com`、`docs.keysight.com`、`www.keysight.com.cn`、`www.gwinstek.com`、`www.tek.com`、`download.tek.com`、`www.tek.com.cn`、`www.manualslib.com`。
只有 WebSearch 能用，它給的是標題、網址和摘要，所以下表全部屬於 **IX**：證明文件存在、在哪裡，不證明任何操作細節。頁碼欄都是「未取得」。
依規則，不從非官方鏡像站抓原廠 PDF。

### 3.1 34460A（包內缺口最大）

| ID | 文件 | 料號／版本 | 官方網址 | 狀態 |
|---|---|---|---|---|
| M-DMM | Keysight Truevolt Series DMM Operating and Service Guide（34460A/61A/65A/70A 共用） | 手冊料號 34460-90901；資產 9018-03876；搜尋摘要稱最新 Edition 7（2020-03），但摘要出自非官方副本，官方 PDF 版次未核對 | https://www.keysight.com/us/en/assets/9018-03876/service-manuals/9018-03876.pdf ；舊 literature 連結 http://literature.cdn.keysight.com/litweb/pdf/34460-90901.pdf | IX，未取得，封鎖 |
| M-DMM-WH | Truevolt WebHelp（官方線上說明；Features and Functions 各章） | 無料號 | https://rfmw.em.keysight.com/bihelpfiles/Truevolt/WebHelp/US/Content/ 下的 DC Voltage、Resistance、Math-Null、Probe Hold、Triggering and Readings 等頁 | IX，未取得，封鎖 |
| — | 34460A 官方支援頁 | — | https://www.keysight.com/us/en/support/34460A/digital-multimeter-6-5-digit-basic-truevolt.html | IX；支援頁的更新日不是校機韌體證據 |
| — | Firmware 3.02／3.03 Release Notes | 9018-07020；9921-02752 | https://www.keysight.com/ml/en/assets/9018-07020/release-notes/9018-07020.pdf | IX；韌體異動可能晚於手冊 |

**排除提醒：** `DM34460 Series`（資產 9925-01336）名字很像，但是另一條產品線，不可用。WebHelp 搜尋結果裡的 33500、N6705「Front Panel Menu Reference」是別的儀器，也不可用。

**搜尋摘要線索（IX，非正文、未核對，只用來決定日後先查哪一章）：**

| 主題 | 摘要內容 | 摘要網址 |
|---|---|---|
| Null | null 值會從之後的量測中扣除；值綁定目前功能，離開再回來仍保留 | …/41%20Math-Null.htm |
| 導通 | ≤10 Ω 會嗶聲並顯示電阻；10 Ω–1.2 kΩ 顯示電阻、不嗶；>1.2 kΩ 顯示「OPEN」；導通固定 1 kΩ 量程 | …/__i_scpi/CONFigure_Subsystem.htm |
| Shift | Shift 讓下一個鍵變成上方印的次功能，例如 [Probe Hold] 取代 [Single]；Remote 時 Shift 兼 Local | 非官方 ManualsLib 摘要 |
| DCV Input Z | Auto 模式下 100 mV、1 V、10 V 量程為 HighZ，100 V、1000 V 為 10 MΩ | …/05%20DC%20Voltage.htm |
| 34460A 功能差異 | 34460A／34461A 只有連續量測模式，沒有 data log 與 digitize；Front/Rear 開關只在 34461A 以上 | docs.keysight.com 知識庫摘要 |
| Trend chart | WebHelp 摘要說 34460A 沒有 trend chart；零售商頁面說有，**互相矛盾**。D-DMM p.3 的 34460A 欄寫「Histogram, bar meter」，沒有 trend chart，採 D-DMM | …/53%20Display-Trend%20Chart.htm |

這些線索**不得**寫成已確認規格。I05 如果採用其中某項當教學近似，要在範圍說明標示「近似，待手冊正文核對」。

### 3.2 其他三台：包內版本就是目前查得到的最新版

| 機型 | 本包版本 | 搜尋結果 | 其他官方文件（IX，未取得） |
|---|---|---|---|
| AFG-2225 | User Manual Ver.B（2020-03-13） | 沒找到更新的英文版；也沒有獨立的 Programming Manual（遠端指令收在 User Manual 內） | Quick Start Guide Ver.E（2018-12-07）https://www.gwinstek.com/en-global/products/downloadSeriesDownNew/5264/430 ；中文使用手冊 Version 1（2018-01-08，比 Ver.B 舊） |
| TDS2001C | 077-0826-00（2013）＋071-2722-03（2011） | 搜 077-0826-01/-02、071-2722-04/-05 沒有結果；官方頁適用清單含 TDS2001C | Service Manual 077-0446-01 Rev A https://download.tek.com/manual/077044601_RevA.pdf ；多系列共用 Programmer Manual 077-0444-03（不可拿 TBS1000B、TDS2000B 的行為替代） |
| GPE-4323 | 82GP343230E01（2019-10-02） | 沒找到更新版本 | GPE-X323 系列 Quick Start（只確認有德文版 2021-02-03） |

**排除提醒：** GPE-X323A 系列（含 GPE-4323A，2025-05-29 新聞稿）改用編碼器取代 VR 旋鈕，並可逐通道設定 OVP，**不是**校機的原版 GPE-4323，不可套用。
TDS1000C-SC 韌體頁的 TDS1000C-SC 也不是 TDS1000C-EDU。

### 3.3 怎麼補上缺口

1. 使用者在雲端環境設定（session 標題列的環境選單 → Edit → Network access）允許 `www.keysight.com`（以及 `rfmw.em.keysight.com`），或放寬存取等級；或
2. 使用者從官方網址自行下載 9018-03876 PDF，上傳到下一個 session。

取得後在本檔新增 M-DMM 列（檔名、版次、頁數、SHA-256），只重新核對 I05 受影響的列，不必重做其他卡。

## 4. 使用規則（I01–I05 都適用）

1. 照片與手冊不一致時，**固定標籤照照片**，操作語義照該型號手冊；差異寫進 `docs/instrument-scope.md` 的「來源差異」。
2. 共冊手冊只取本機欄位：M-TDS 只取 TDS2001C（2 通道、50 MHz、500 MS/s）；M-GPE 只取 GPE-4323（不是 GPE-4323A，也不用 GPE-3323 的 5 V／5 A 規格）；D-DMM 只取 34460A 欄。
3. 引用格式：`M-AFG p.144`（印刷頁）；TDS 另附 PDF 頁，如 `M-TDS-13 p.104 (PDF 128)`。
4. PD 或 UN 項目若要實作，必須在儀器外的「功能範圍說明」標示「近似／待校機確認」，並在該卡紀錄寫明暫定規格。
5. 日後取得新證據（34460A 手冊、亮屏照片、校機操作影片）時，只回到受影響的卡重新核對，並在本檔新增一列來源。
