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

<!-- SEARCH-RESULTS -->

## 4. 使用規則（I01–I05 都適用）

1. 照片與手冊不一致時，**固定標籤照照片**，操作語義照該型號手冊；差異寫進 `docs/instrument-scope.md` 的「來源差異」。
2. 共冊手冊只取本機欄位：M-TDS 只取 TDS2001C（2 通道、50 MHz、500 MS/s）；M-GPE 只取 GPE-4323（不是 GPE-4323A，也不用 GPE-3323 的 5 V／5 A 規格）；D-DMM 只取 34460A 欄。
3. 引用格式：`M-AFG p.144`（印刷頁）；TDS 另附 PDF 頁，如 `M-TDS-13 p.104 (PDF 128)`。
4. PD 或 UN 項目若要實作，必須在儀器外的「功能範圍說明」標示「近似／待校機確認」，並在該卡紀錄寫明暫定規格。
5. 日後取得新證據（34460A 手冊、亮屏照片、校機操作影片）時，只回到受影響的卡重新核對，並在本檔新增一列來源。
