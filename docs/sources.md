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

使用者在 I00 途中要求：包內資料不足時要主動找「同型號」的原廠操作手冊，並記錄網址、版本與頁碼；查不到列待確認。

**這次沒有取得任何新的正文。** 2026-09-29 在本環境實測：

| 方式 | 目標網域 | 結果 |
|---|---|---|
| curl（容器內） | www.keysight.com、keysight.com、literature.cdn.keysight.com、www.gwinstek.com、www.tek.com、download.tek.com、www.manualslib.com | 全部 `CONNECT … 403`（環境網路政策拒絕） |
| curl（容器內，第三方副本） | www.batronix.com、docs.rs-online.com、www.tme.eu、xdevs.com、www.newark.com、assets.testequity.com | 全部 `CONNECT … 403` |
| WebFetch（伺服器端） | www.keysight.com、literature.cdn.keysight.com、rfmw.em.keysight.com、docs.keysight.com、www.keysight.com.cn、www.gwinstek.com、www.tek.com、www.tek.com.cn | 全部 `EGRESS_BLOCKED` |
| WebSearch | — | 可用；只有標題、網址與摘要，不是手冊正文 |

所以下表全部屬於 **IX**：證明文件存在、在哪裡、版本是什麼，不證明任何操作細節。「頁碼」欄記錄這次能不能給出頁碼；因為沒有正文，全部是「未取得」。

**第三方副本的處理（實作者的來源決策，PD）：** 04 的規定是「不得繞過登入」以及「不拿 DM34460A、34465A／34470A 的操作填空」，並沒有禁止第三方副本。
實作者另外決定：第三方副本在能與官方 9018-03876 比對版次（與雜湊）之前，最多只算 IX，不升為 OT。這次所有第三方副本網域都被封鎖，所以這個決策沒有實際影響。

### 3.1 34460A（包內缺口最大）

| ID | 文件 | 料號／版本 | 網址 | 頁碼 | 狀態 |
|---|---|---|---|---|---|
| M-DMM | Keysight Truevolt Series DMM Operating and Service Guide（34460A/61A/65A/70A 共用） | 手冊料號 34460-90901；資產 9018-03876；搜尋摘要稱最新 Edition 7（2020-03），摘要出自非官方副本，官方 PDF 版次未核對 | https://www.keysight.com/us/en/assets/9018-03876/service-manuals/9018-03876.pdf | 未取得 | IX，封鎖 |
| M-DMM（舊連結） | 同上，舊 literature 連結 | 34460-90901 | http://literature.cdn.keysight.com/litweb/pdf/34460-90901.pdf?id=2345839 | 未取得 | IX，封鎖 |
| M-DMM（中國官網） | 同上 | 9018-03876 | https://www.keysight.com.cn/cn/zh/assets/9018-03876/service-manuals/9018-03876.pdf | 未取得 | IX，封鎖 |
| M-DMM-WH | Truevolt WebHelp（官方線上說明） | 無料號 | 見下方「搜尋摘要線索」各列的完整網址 | 未取得 | IX，封鎖 |
| — | 34460A 官方支援頁 | — | https://www.keysight.com/us/en/support/34460A/digital-multimeter-6-5-digit-basic-truevolt.html ；系列頁 https://www.keysight.com/us/en/support/key-34694/truevolt-series-multimeters.html | 不適用 | IX；支援頁的更新日不是校機韌體證據 |
| — | Firmware 3.02 Release Notes | 9018-07020 | https://www.keysight.com/ml/en/assets/9018-07020/release-notes/9018-07020.pdf | 未取得 | IX |
| — | Firmware 3.03 Release Notes | 9921-02752 | https://www.keysight.com/us/en/assets/9921-02752/release-notes/Firmware-303-ReleaseNotes.docx | 未取得 | IX |
| — | 前面板 USB 韌體更新指南 | 9018-61214 | https://www.keysight.com/us/en/assets/9018-61214/installation-guides/9018-61214.pdf | 未取得 | IX |
| — | 第三方副本：batronix | 版次未知 | https://www.batronix.com/files/Keysight/DMM/34460-34470/34460-70-Manual.pdf | 未取得 | IX，封鎖；非官方 |
| — | 第三方副本：docs.rs-online、ManualsLib | 版次未知 | docs.rs-online：URL 未記錄；ManualsLib：https://www.manualslib.com/manual/3854209/Keysight-34460a.html | 未取得 | IX，封鎖；非官方 |
| — | 舊版 Agilent 副本（2013-12） | 34460-90901 舊版 | https://xdevs.com/doc/HP_Agilent_Keysight/English%20_%202013-12-01%20_%20PDF%209.33%20MB%2034460-90901%20c20140121%20[352].pdf | 未取得 | 版本過舊，不用 |
| — | 繁體中文操作手冊 | — | WebSearch「Keysight 34460A 操作手冊 繁體中文」沒有找到 | 不適用 | 未找到 |

**排除提醒：** `DM34460 Series`（資產 9925-01336，https://www.keysight.com/us/en/assets/9925-01336/user-manuals/DM34460-Series-DMM-Users-Guide.pdf）名字很像，但是另一條產品線，不可用。WebHelp 搜尋結果裡的 33500、N6705「Front Panel Menu Reference」是別的儀器，也不可用。

**搜尋摘要線索（IX，非正文、未核對，只用來決定日後先查哪一章）：**

| 主題 | 摘要內容 | 摘要網址（完整） | 頁碼 |
|---|---|---|---|
| Null | null 值會從之後的量測中扣除；值綁定目前功能，離開再回來仍保留 | https://rfmw.em.keysight.com/bihelpfiles/Truevolt/WebHelp-Mobile/US/Advanced/Content/__E_Features%20and%20Functions/41%20Math-Null.htm | 未取得 |
| 導通 | ≤10 Ω 會嗶聲並顯示電阻；10 Ω–1.2 kΩ 顯示電阻、不嗶；>1.2 kΩ 顯示「OPEN」；導通固定 1 kΩ 量程 | https://rfmw.em.keysight.com/bihelpfiles/truevolt/webhelp-mobile/us/advanced/content/__i_scpi/CONFigure_Subsystem.htm （摘要來源頁不確定） | 未取得 |
| Beeper | Beeper 軟鍵可開關導通、Probe Hold、二極體、錯誤的嗶聲 | http://rfmw.em.keysight.com/bihelpfiles/Truevolt/WebHelp/DE/Content/__E_Features%20and%20Functions/65%20Utility-System%20Setup.htm | 未取得 |
| Shift | Shift 讓下一個鍵變成上方印的次功能，例如 [Probe Hold] 取代 [Single]；Remote 時 Shift 兼 Local；先按放開再按目標鍵 | https://www.manualslib.com/manual/3854209/Keysight-34460a.html （非官方） | 未取得 |
| DCV Input Z | Auto 模式下 100 mV、1 V、10 V 量程為 HighZ，100 V、1000 V 為 10 MΩ | https://rfmw.em.keysight.com/spdhelpfiles/truevolt/webhelp/US/Content/__E_Features%20and%20Functions/05%20DC%20Voltage.htm | 未取得 |
| Resistance | （頁面存在，摘要沒有具體數字） | https://rfmw.em.keysight.com/bihelpfiles/Truevolt/WebHelp/US/Content/__E_Features%20and%20Functions/13%20Resistance.htm | 未取得 |
| Probe Hold | Probe Hold 會最佳化量測參數以可靠偵測穩定訊號（法文頁的英譯摘要） | http://rfmw.em.keysight.com/spdhelpfiles/truevolt/webhelp-mobile/FR/Advanced/Content/__E_Features%20and%20Functions/72%20-%20Probe%20Hold.htm | 未取得 |
| 觸發與讀值 | （頁面存在） | https://rfmw.em.keysight.com/bihelpfiles/Truevolt/WebHelp/US/Content/__E_Features%20and%20Functions/75%20-%20Triggering%20and%20Readings.htm | 未取得 |
| Utility 目錄 | （頁面存在） | http://rfmw.em.keysight.com/spdhelpfiles/truevolt/webhelp-mobile/US/Advanced/Content/__E_Features%20and%20Functions/60%20---Utility---.htm | 未取得 |
| SCPI 速查 | （頁面存在） | http://rfmw.em.keysight.com/spdhelpfiles/truevolt/webhelp/US/Content/_Home_Page/Command_Quick_Reference.htm | 未取得 |
| 34460A 功能差異 | 34460A／34461A 只有連續量測模式，沒有 data log 與 digitize；Front/Rear 開關只在 34461A 以上；LAN 在 34460A 為選配 | https://docs.keysight.com/kkbopen/what-are-the-differences-between-the-34460a-34461a-34465a-and-34470a-dmms-583423662.html | 未取得 |
| Trend chart | WebHelp 摘要說 34460A 沒有 trend chart；零售商頁面說有，**互相矛盾**。D-DMM p.3 的 34460A 欄寫「Histogram, bar meter」，沒有 trend chart，採 D-DMM | http://rfmw.em.keysight.com/bihelpfiles/Truevolt/WebHelp-Mobile/US/Advanced/Content/__E_Features%20and%20Functions/53%20Display-Trend%20Chart.htm | 未取得 |
| Smoothing | 平滑濾波不適用 Digitizing、Data Logging、Continuity、Diode、Probe Hold；34460A 是否提供未知 | https://rfmw.em.keysight.com/bihelpfiles/truevolt/webhelp/us/content/__e_features%20and%20functions/Math-Smoothing.htm | 未取得 |
| 二極體 | 二極體測試滿刻度 5 V；0.3–0.8 V 時嗶聲 | https://assets.testequity.com/te1/Documents/pdf/keysight/Keysight_Truevolt-Digital-Multimeters_Datasheet.pdf （第三方 datasheet 副本；5 V 與本包 D-DMM p.3「Y, 5 V」一致） | 未取得 |

這些線索**不得**寫成已確認規格。I05 如果採用其中某項當教學近似（例如導通的 OPEN 字樣、Shift 先按放開），要在範圍說明標示「近似，待手冊正文核對」。

### 3.2 其他三台：包內版本就是目前查得到的最新版

| 機型 | 文件 | 料號／版本 | 網址 | 頁碼 | 狀態 |
|---|---|---|---|---|---|
| AFG-2225 | User Manual（英文） | Ver.B（2020-03-13），本包 M-AFG；沒找到更新版 | https://www.gwinstek.com/en-global/products/downloadSeriesDownNew/5250/430 ；本包來源 https://www.gwinstek.com/en-IN/products/downloadSeriesDownNew/5260/440 | 本包已有 | 已取得（本包） |
| AFG-2225 | Quick Start Guide | Ver.E（2018-12-07） | https://www.gwinstek.com/en-global/products/downloadSeriesDownNew/5264/430 | 未取得 | IX，封鎖 |
| AFG-2225 | 中文使用手冊 | Version 1（2018-01-08，比 Ver.B 舊） | 產品頁 https://www.gwinstek.com/zh-TW/products/detail/AFG-2225 （檔案直連 URL 未記錄） | 未取得 | IX，封鎖 |
| AFG-2225 | Programming Manual | 不存在獨立文件；遠端指令收在 User Manual 內 | — | — | — |
| TDS2001C | User Manual（英文） | 077-0826-00（2013）＋071-2722-03（2011），本包；搜 077-0826-01/-02、071-2722-04/-05 沒有結果 | https://www.tek.com/en/oscilloscope/tds2000-digital-storage-oscilloscope-manual/tds2000c-and-tds1000c-edu-series-0 | 本包已有 | 已取得（本包） |
| TDS2001C | 繁體中文使用手冊 | 077-0834-XX（件號見 M-TDS-13 p.124 (PDF 148) 選購配件清單） | WebSearch「TDS2000C TDS1000C-EDU 使用手冊 繁體中文 077-0834」沒有找到公開網址 | 未取得 | 未找到；校機 LCD 語言見 GAP-TDS-01 |
| TDS2001C | Service Manual | 077-0446-01 Rev A；077-0446-00 web 版 | https://download.tek.com/manual/077044601_RevA.pdf ；https://download.tek.com/manual/077044600web.pdf | 未取得 | IX，封鎖 |
| TDS2001C | Programmer Manual（多系列共用） | 077-0444-03（搜尋摘要） | https://download.tek.com/manual/TBS1000-B-EDU-TDS2000-B-C-TDS1000-B-C-EDU-TDS200-TPS2000-Programmer.pdf | 未取得 | IX，封鎖；不可拿 TBS1000B、TDS2000B 的行為替代 |
| TDS2001C | 韌體更新頁（TDS1000C-SC／TDS2000C） | V24.26 | https://www.tek.com/en/support/software/firmware/firmware-update-tds1000c-sc-and-tds2000c | 不適用 | IX；TDS1000C-SC 不是 TDS1000C-EDU |
| GPE-4323 | User Manual（英文） | 82GP343230E01（2019-10-02），本包 M-GPE；沒找到更新版 | https://www.gwinstek.com/en-global/products/downloadSeriesDownNew/8033/1198 ；本包來源 https://www.gwinstek.com/zh-TW/products/downloadSeriesDownNew/8034/1199 | 本包已有 | 已取得（本包） |
| GPE-4323 | GPE-X323 系列 Quick Start | 德文版 2021-02-03；英文版未確認 | 產品頁 https://www.gwinstek.com/en-global/products/detail/GPE-X323 （檔案直連 URL 未記錄） | 未取得 | IX，封鎖 |
| GPE-4323 | 中文使用手冊 | — | WebSearch「固緯 GPE-4323 使用手冊 中文 GPE-X323 使用說明書」沒有找到；zh-TW 產品頁 https://www.gwinstek.com/zh-TW/products/detail/GPE-X323 | 不適用 | 未找到 |
| GPE-4323A（排除） | GPE-x32xA 系列新聞稿 | 2025-05-29 | https://www.gwinstek.com/en-global/news_release/detail/20250529_GPE_x32xA | 不適用 | IX；A 版改用編碼器取代 VR 旋鈕並可逐通道設 OVP，**不是**校機的原版 GPE-4323。可作「原版是 VR 旋鈕」的間接線索（GAP-GPE-03） |

**排除提醒：** GPE-X323A 系列（含 GPE-4323A）不可套用；官方連結 downloadSeriesDownNew/24324/2421 在不同搜尋裡標題不一（有一次是 GPE-3060/6030 手冊），不要用。TDS1000C-SC 韌體頁的 TDS1000C-SC 也不是 TDS1000C-EDU。

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
