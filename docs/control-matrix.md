# 控制矩陣（I00）

> 由 `docs/data/*.json` 經 `node scripts/render-i00-docs.mjs` 產生，請改 JSON 後重跑，不要直接改本檔。
> 結構自檢：`node scripts/check-control-matrix.mjs`。自檢只驗表格、ID、代碼與照片硬性數量，**不是**儀器行為測試。

## 讀法

- **ID**：`<儀器>.<類型>.<名稱>`，I01 起 DOM、狀態與測試都用同一個 ID。類型：KEY 實體鍵、SOFT 螢幕旁軟鍵、NUM 數字鍵、KNOB 旋鈕、TERM 端子、PORT 連接埠、LED 指示燈、LCD 顯示、PWR 電源、MISC 其他。
- **照片位置／面板標籤**：以使用者實拍 P1、P2 為準，寫照片上真正印的字（含中文貼面、Shift 次標籤）。
- **來源頁**：`M-AFG p.144` 表印刷頁；TDS 另附 PDF 頁。來源 ID 與版本見 `docs/sources.md`。
- **證據**：PH 照片、OT 官方手冊正文、DS datasheet、IX 索引／搜尋定位（未取得正文）、PD 推論或教學決策（暫定）、UN 未知；可用 `+` 組合。
- **狀態**：CORE 本輪該卡必做；APPROX 近似可操作，須在儀器外標示；OUT 本輪未納入，面板保留但停用或顯示範圍說明，**不得假成功**；STATIC 被動件（端子、連接埠、固定標籤、本輪不會變化的指示燈），只顯示或預留 terminal ID，接線屬 J01。會隨本輪核心狀態變化的指示燈與 LCD 圖示列 CORE。
- **照片未見的列**：手冊有、照片看不到的部件（後面板、機頂電源鍵）也列出，避免遺漏；後面板一律 OUT。
- **卡**：該控制項的實作卡；共用互動元件（旋鈕拖曳、按鍵焦點）另由 I01 提供。

## 總覽

| 儀器 | 列數 | CORE | APPROX | OUT | STATIC |
| --- | --- | --- | --- | --- | --- |
| GW Instek AFG-2225 任意波形訊號產生器 | 46 | 28 | 2 | 13 | 3 |
| Tektronix TDS2001C 雙通道數位儲存示波器 | 53 | 27 | 3 | 11 | 12 |
| GW Instek GPE-4323 四路直流電源供應器（原版，非 A 版） | 47 | 24 | 5 | 4 | 14 |
| Keysight 34460A 6½ 位數電表 | 44 | 10 | 2 | 16 | 16 |

## 1. GW Instek AFG-2225 任意波形訊號產生器（P1 上層，I02）

**照片核對：** 型號：P1 上層印「GW INSTEK AFG-2225 Arbitrary Function Generator」，與 M-AFG p.13 (PDF 13) 面板圖一致（PH+OT）。通道數：2（OUTPUT 區有 CH1、CH2 兩個 BNC，上 CH1、下 CH2，各印接地符號與「50Ω」）。旋鈕數：1（右上大旋鈕，無印字，位於深灰凹框內，下方有 ◀ ▶ 兩鍵）。按鍵共 33 顆：F1–F5 加 Return（6，LCD 右側縱列）；數字鍵 12 顆（7 8 9／4 5 6／1 2 3／0 •  +/-）；◀ ▶（2）；CH1/CH2（1，只有一顆切換鍵，不是 CH1、CH2 兩顆）；OUTPUT（1，淺藍色）；上排深灰鍵 Waveform、FREQ/Rate、AMPL、DC Offset、UTIL（5）；下排淺藍灰鍵 ARB、MOD、Sweep、Burst，加上綠色 Preset（5）；POWER（1，下方左「▂ I」、右「▆ ○」圖示）。端子：前面板只有 2 個 BNC 輸出。前面板沒有 USB 口，也沒有 Trigger／MOD／Counter 端子（手冊 p.16–17 標示這些在後面板，照片未見）。沒看到任何 LED 指示燈。AFG 面板沒有中文貼面，也沒有 Shift 次標籤。LCD 全暗，因此無法證明開機畫面、選單語言或預設值。FREQ/Rate 的斜線在照片解析度下不清楚（看起來像「FREQ Rate」），依手冊 p.13 面板圖定為「FREQ/Rate」。照片的布局與 p.13 面板圖逐顆相符。

**頁碼對照：** M-AFG：印刷頁＝PDF 頁序（全 307 頁，無偏移）。實際核對例：PDF 13 頁面印「13」(Panel Overview)、PDF 18 印「18」(Display)、PDF 52 印「52」(Default Settings)、PDF 60 印「60」(Setting the Frequency)、PDF 144 印「144」(CHANNEL SETTINGS)、PDF 214 印「214」(OUTPut[1|2])、PDF 288 印「288」(AFG-2225 Specifications)、PDF 289 印「289」(Offset)、PDF 306–307 印「306/307」(INDEX)；目錄 PDF 3 所列頁碼（例 Default Settings 52、Channel Settings 144、Specifications 288）與實際頁一致。PDF 1 封面、PDF 2 版權頁不印頁碼。版本：封面只印「User Manual／GW INSTEK PART NO.」（料號空白），手冊本身未印版次；「Ver.B、2020-03-13」只來自 04／DOWNLOAD_SOURCES.json 的原廠下載索引（https://www.gwinstek.com/zh-TW/download/index?cate=0&down=0&key=AFG-2225&ser=0&subcate=0；檔案來源 https://www.gwinstek.com/en-IN/products/downloadSeriesDownNew/5260/440），本次未能連網重新核對。PDF metadata：Title「AFG-2225 Series User Manual」、ModDate 2020-03-05。本地 SHA-256 79b684d4f7480d0dfed7a502908af79b297db975b7e336881d066c2e030b8d40 與 DOWNLOAD_SOURCES.json 相同。P1 SHA-256 1b0f1643…3291 與 PHOTO_ORIGINS.json 相同。本文件的引用格式為「M-AFG p.N (PDF N)」；照片座標以原圖 768×1024 像素計。

### 品牌型號標示

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.MISC.MODEL_LABEL` | P1 上層 AFG 左上，LCD 上方深色框內，原圖約 x75–340, y60–75 | GW INSTEK  AFG-2225  Arbitrary Function Generator | 固定標籤；無 | 識別機型為 AFG-2225 | 無 | — | P1；M-AFG p.13 (PDF 13) 面板圖 | PH+OT | STATIC | I02 | 手冊面板圖印同樣字樣。不可沿用其他 AFG 系列的規格。 |

### LCD 與軟鍵

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.LCD.MAIN` | P1 上層 AFG 左半，原圖約 x90–325, y85–275（全暗） | 無印字（LCD 暗） | LCD（3.5 吋 TFT 320×240）；無（顯示） | 顯示 Status Tabs（CH1/CH2、ON/OFF、負載如「50Ω」）、Parameter Windows（FREQ／AMPL／Offset／Phase）、Waveform Display（波形示意，標註 Ampl、DC Offset、1/FREQ；編輯時下方紅框顯示數值與游標位數）、Soft Menu 標籤（對應 F1–F5） | 兩通道參數同時顯示；被選中的參數以紅字高亮。截圖格式例：「CH1 ON 50Ω」「FREQ: 1.000000 kHz」「AMPL: 3.000 VPP」「Offset: 0.00 VDC」「Phase: 0.0 °」；編輯框例「1.000000000 kHz」「3.000 VPP」「0.00VDC」「50.0%」 | 320×240 | P1；M-AFG p.12, p.13, p.18, p.23, p.55–63 截圖 (PDF 同) | PH+OT | CORE | I02/I01 | 照片 LCD 全暗，不能證明開機畫面、語言或預設值。UTIL→System→Language 有 English／中文（p.51），校機語言未知（UN）。截圖中 CH1 分頁為亮黃色、CH2 淡藍且參數灰字，推定代表目前選取的通道（PD）。「1/FREQ」只是波形區的圖示標註，不得新增 Period 欄位。High Z 時 status tab 的字樣 UN。；證據細節：PH（存在、位置、全暗）+OT（區塊配置與截圖格式）；卡別細節：I02（LCD 顯示元件 I01） |
| `AFG.SOFT.F1` | P1 AFG，LCD 右側縱列第 1 顆，原圖約 (371,111) | F1 | 軟鍵（螢幕旁）；按下 | 執行 LCD 右側第 1 格軟鍵：Waveform 選單＝Sine；FREQ/Rate＝uHz；AMPL＝dBm；DC Offset＝mVDC；Ramp 子選單＝SYM；CH1/CH2 選單＝Load；Load 子選單＝50 OHM；Square 子選單＝Duty（OUT）；Pulse 子選單＝Width（OUT） | LCD 軟鍵標籤；選波形時波形區改變；按單位鍵時提交數值並顯示單位 | 依選單 | P1；M-AFG p.13, p.18, p.23, p.55, p.58, p.60–62, p.144–145 (PDF 同) | PH+OT | CORE | I02/I01 | p.23：「the function key F1 corresponds to the Soft key 'Sine'」。；卡別細節：I02（軟鍵元件 I01） |
| `AFG.SOFT.F2` | P1 AFG，LCD 右側縱列第 2 顆，原圖約 (372,144) | F2 | 軟鍵（螢幕旁）；按下 | Waveform 選單＝Square；FREQ/Rate＝mHz；AMPL＝mVRMS；DC Offset＝VDC；Ramp／Square 子選單＝%；Load 子選單＝High Z；CH1/CH2 選單第 2 格（手冊未標示，UN） | 同 F1 | 依選單 | P1；M-AFG p.27, p.56, p.59, p.61–62, p.145 (PDF 同) | PH+OT | CORE | I02/I01 | CH1/CH2 選單的 F2 在手冊中是空白或未說明，暫定無動作（PD）。；卡別細節：I02（I01） |
| `AFG.SOFT.F3` | P1 AFG，LCD 右側縱列第 3 顆，原圖約 (371,177) | F3 | 軟鍵（螢幕旁）；按下 | Waveform 選單＝Pulse（本輪 OUT）；FREQ/Rate＝Hz；AMPL＝VRMS；DC Offset 選單＝空白；Pulse 子選單＝uSEC（OUT） | 同 F1；Pulse 顯示範圍說明 | 依選單 | P1；M-AFG p.18, p.57–58, p.61–62 (PDF 同) | PH+OT | CORE | I02/I01 | Pulse 參數本輪未納入，但軟鍵保留。；卡別細節：I02（I01） |
| `AFG.SOFT.F4` | P1 AFG，LCD 右側縱列第 4 顆，原圖約 (371,208) | F4 | 軟鍵（螢幕旁）；按下 | Waveform 選單＝Ramp；FREQ/Rate＝kHz；AMPL＝mVPP；CH1/CH2 選單＝Phase（OUT） | 同 F1 | 依選單 | P1；M-AFG p.27, p.58, p.61–62, p.145 (PDF 同) | PH+OT | CORE | I02/I01 | p.27：「Press the Waveform key, and select Ramp (F4)」「1 + 0 + kHz (F4)」。；卡別細節：I02（I01） |
| `AFG.SOFT.F5` | P1 AFG，LCD 右側縱列第 5 顆，原圖約 (370,241) | F5 | 軟鍵（螢幕旁）；按下 | Waveform 選單＝Noise（OUT）；FREQ/Rate＝MHz；AMPL＝VPP；CH1/CH2 選單＝DSO Link（OUT）；Pulse 子選單＝SEC（OUT） | 同 F1 | 依選單 | P1；M-AFG p.27–28, p.59, p.61–62, p.147 (PDF 同) | PH+OT | CORE | I02/I01 | p.27：「Press AMPL followed by, 3 + VPP (F5)」。；卡別細節：I02（I01） |
| `AFG.KEY.RETURN` | P1 AFG，F5 下方，原圖約 (369,271) | Return | 實體鍵；按下 | 回到上一層選單。p.13：「Goes back to the previous menu level.」p.44：「Pressing the Return key will return you to the previous menu level.」 | LCD 軟鍵標籤回到上一層 | — | P1；M-AFG p.13, p.26, p.44 (PDF 同) | PH+OT | CORE | I02 | 按 Return 時未提交的數字輸入是否生效：UN（GAP-AFG-03），暫定捨棄。在最上層按 Return 的行為：UN。 |

### 數字鍵盤

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.NUM.DIGIT_7` | P1 AFG 數字鍵盤第 1 列左，原圖約 (432,90) | 7 | 數字鍵；按下 | 把數字 7 輸入到目前高亮參數的編輯值；接著用單位軟鍵提交 | LCD 編輯框顯示輸入中的值（暫定） | — | P1；M-AFG p.15, p.24, p.27–28, p.60–62 (PDF 同) | PH+OT | CORE | I02/I01 | p.24：「the number pad can be used to set the value of a highlighted parameter」。提交語義見 GAP-AFG-03。；卡別細節：I02（數字輸入 I01） |
| `AFG.NUM.DIGIT_8` | P1 AFG 數字鍵盤第 1 列中，原圖約 (470,90) | 8 | 數字鍵；按下 | 輸入數字 8（同 DIGIT_7） | 同 DIGIT_7 | — | P1；M-AFG p.15, p.24 (PDF 同) | PH+OT | CORE | I02/I01 | 卡別細節：I02（I01） |
| `AFG.NUM.DIGIT_9` | P1 AFG 數字鍵盤第 1 列右，原圖約 (508,90) | 9 | 數字鍵；按下 | 輸入數字 9 | 同 DIGIT_7 | — | P1；M-AFG p.15, p.24 (PDF 同) | PH+OT | CORE | I02/I01 | 卡別細節：I02（I01） |
| `AFG.NUM.DIGIT_4` | P1 AFG 數字鍵盤第 2 列左，原圖約 (430,129) | 4 | 數字鍵；按下 | 輸入數字 4 | 同 DIGIT_7 | — | P1；M-AFG p.15, p.24 (PDF 同) | PH+OT | CORE | I02/I01 | 卡別細節：I02（I01） |
| `AFG.NUM.DIGIT_5` | P1 AFG 數字鍵盤第 2 列中，原圖約 (467,129) | 5 | 數字鍵；按下 | 輸入數字 5 | 同 DIGIT_7 | — | P1；M-AFG p.15, p.24, p.27 (PDF 同) | PH+OT | CORE | I02/I01 | p.27 範例：SYM(F1)，5 + 0 + %(F2)。；卡別細節：I02（I01） |
| `AFG.NUM.DIGIT_6` | P1 AFG 數字鍵盤第 2 列右，原圖約 (505,129) | 6 | 數字鍵；按下 | 輸入數字 6 | 同 DIGIT_7 | — | P1；M-AFG p.15, p.24 (PDF 同) | PH+OT | CORE | I02/I01 | 卡別細節：I02（I01） |
| `AFG.NUM.DIGIT_1` | P1 AFG 數字鍵盤第 3 列左，原圖約 (429,166) | 1 | 數字鍵；按下 | 輸入數字 1 | 同 DIGIT_7 | — | P1；M-AFG p.15, p.24, p.27 (PDF 同) | PH+OT | CORE | I02/I01 | p.27：「Press Freq/Rate, 1 + kHz (F4)」。；卡別細節：I02（I01） |
| `AFG.NUM.DIGIT_2` | P1 AFG 數字鍵盤第 3 列中，原圖約 (466,166) | 2 | 數字鍵；按下 | 輸入數字 2 | 同 DIGIT_7 | — | P1；M-AFG p.15, p.24 (PDF 同) | PH+OT | CORE | I02/I01 | 卡別細節：I02（I01） |
| `AFG.NUM.DIGIT_3` | P1 AFG 數字鍵盤第 3 列右，原圖約 (503,166) | 3 | 數字鍵；按下 | 輸入數字 3 | 同 DIGIT_7 | — | P1；M-AFG p.15, p.24, p.27 (PDF 同) | PH+OT | CORE | I02/I01 | 卡別細節：I02（I01） |
| `AFG.NUM.DIGIT_0` | P1 AFG 數字鍵盤第 4 列左，原圖約 (427,202) | 0 | 數字鍵；按下 | 輸入數字 0 | 同 DIGIT_7 | — | P1；M-AFG p.15, p.24 (PDF 同) | PH+OT | CORE | I02/I01 | 卡別細節：I02（I01） |
| `AFG.NUM.DOT` | P1 AFG 數字鍵盤第 4 列中，原圖約 (464,202) | •（圓點） | 數字鍵；按下 | 輸入小數點 | 同 DIGIT_7 | 每個數值只能有 1 個小數點（PD） | P1；M-AFG p.15, p.24 (PDF 同) | PH+OT+PD | CORE | I02/I01 | 手冊只把整個鍵盤統稱為輸入數值用，沒有單獨描述小數點鍵。；證據細節：PH+OT（存在）+PD（功能）；卡別細節：I02（I01） |
| `AFG.NUM.PLUS_MINUS` | P1 AFG 數字鍵盤第 4 列右，原圖約 (500,202) | +/-（斜排印成 ⁺/₋） | 數字鍵；按下 | 暫定：切換輸入中數值的正負號，用於 DC Offset 負值（PD） | LCD 編輯框數值前出現或消失負號（暫定） | 只對可為負的參數有意義（Offset；Phase 本輪 OUT） | P1；M-AFG p.15, p.24 (PDF 同) | PH+OT+PD | APPROX | I02/I01 | 手冊有畫出此鍵，但沒有文字說明其功能（GAP-AFG-12）。Offset 範圍 ±5 Vpk／±10 Vpk（p.63），因此需要負值輸入。；證據細節：PH+OT（存在）+PD（功能）；卡別細節：I02（I01） |

### 旋鈕與方向鍵

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.KNOB.SCROLL_WHEEL` | P1 AFG 右上大旋鈕（深灰凹框內），原圖約 (578,95) | 無印字 | 旋鈕；順時針／逆時針旋轉 | 編輯目前高亮參數的游標所在位數；p.23：「Clockwise increases the value, counter clockwise decreases the value.」也用於在清單中選項目（Memory、Help 等，本輪 OUT） | LCD 參數值與編輯框即時變化（立即生效與否 UN） | 受該參數的範圍與聯合限制約束 | P1；M-AFG p.13, p.15, p.23, p.25, p.40 (PDF 同) | PH+OT | CORE | I02/I01 | p.15 稱「Scroll Wheel」或「variable knob」。調整結果超出範圍時的行為 UN，暫定該步不生效（GAP-AFG-04）。；卡別細節：I02（旋鈕元件 I01） |
| `AFG.KEY.ARROW_LEFT` | P1 AFG 旋鈕下方左，原圖約 (551,158) | ◀ | 實體鍵；按下 | 編輯參數時把游標往左移一個位數（較高位）。p.14：「Used to select digits when editing parameters.」 | LCD 編輯框中游標底線移動（p.61–63 截圖可見底線） | 游標可移動的位數範圍 UN | P1；M-AFG p.14, p.23 (PDF 同) | PH+OT | CORE | I02/I01 | 卡別細節：I02（I01） |
| `AFG.KEY.ARROW_RIGHT` | P1 AFG 旋鈕下方右，原圖約 (595,158) | ▶ | 實體鍵；按下 | 編輯參數時把游標往右移一個位數（較低位） | 同 ARROW_LEFT | UN | P1；M-AFG p.14, p.23 (PDF 同) | PH+OT | CORE | I02/I01 | 卡別細節：I02（I01） |

### 通道／輸出

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.KEY.CH1_CH2` | P1 AFG 方向鍵下方，原圖約 (570,186) | CH1/CH2 | 實體鍵（單一切換鍵）；按下 | 切換目前操作的通道（p.14：「switch between the two output channels」），並顯示 CH 選單：F1 Load、F4 Phase、F5 DSO Link（p.51, p.144–147） | LCD status tab 的選取狀態（推定為亮黃分頁）；軟鍵顯示 Load／Phase／DSO Link | CH1、CH2 | P1；M-AFG p.14, p.18, p.51, p.144–147 (PDF 同) | PH+OT+PD | CORE | I02 | 照片與手冊都只有一顆標「CH1/CH2」的鍵，不是兩顆。按一次到底是切換通道、開啟選單，還是兩者都做，手冊沒寫清楚（GAP-AFG-01）。切換時不得覆寫另一通道的設定。；證據細節：PH+OT；按一次是否同時切換通道並開啟選單為 PD |
| `AFG.KEY.OUTPUT` | P1 AFG CH1/CH2 鍵下方，原圖約 (568,217)，淺藍色鍵 | OUTPUT | 實體鍵；按下 | 開啟或關閉波形輸出（p.14：「The Output key is used to turn on or off the waveform output.」）。每通道的輸出狀態各自獨立（p.18 截圖同時出現 CH1 ON、CH2 OFF；遠端 OUTPut[1\|2] 也分通道，p.214）。暫定只作用於目前選取的通道（PD） | LCD status tab「CHn ON／OFF」（p.18）；按鍵本身是否會亮：UN | ON／OFF | P1；M-AFG p.14, p.18, p.27–28, p.53, p.214, p.289 (PDF 同) | PH+OT+PD | CORE | I02 | Output 狀態、選取通道、電源開關是三個不同的狀態。Output OFF 時設定保留；p.289 規定輸出關閉時端子阻抗「> 10MΩ (output disabled)」。手冊全文搜尋 light／LED／illuminat 都沒有 Output 燈的說明（GAP-AFG-02）。；證據細節：PH+OT；「只作用於選取通道」為 PD |

### 操作鍵（上排）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.KEY.WAVEFORM` | P1 AFG 操作鍵上排第 1 顆，原圖約 (419,256)，深灰鍵 | Waveform | 實體鍵；按下 | 選擇波形類型；軟鍵顯示 F1 Sine／F2 Square／F3 Pulse／F4 Ramp／F5 Noise | LCD 軟鍵換成波形選單；選定後波形區更新 | Sine、Square、Ramp（CORE）；Pulse、Noise（OUT） | P1；M-AFG p.13, p.18, p.44, p.55–59 (PDF 同) | PH+OT | CORE | I02 | 沒有 Triangle 軟鍵；三角波必須走 Ramp→SYM 50%（p.27, p.58–59）。 |
| `AFG.KEY.FREQ_RATE` | P1 AFG 操作鍵上排第 2 顆，原圖約 (464,256) | FREQ/Rate（照片斜線不清楚，讀似「FREQ Rate」） | 實體鍵；按下 | 設定頻率（ARB 模式下為取樣率，本輪 OUT）。FREQ 參數高亮，軟鍵顯示 F1 uHz／F2 mHz／F3 Hz／F4 kHz／F5 MHz | LCD FREQ 欄紅字高亮；編輯框顯示如「1.000000000 kHz」 | Sine／Square 1 μHz–25 MHz；Ramp 1 μHz–1 MHz；Pulse 500 μHz–25 MHz（OUT）；解析度 1 μHz | P1；M-AFG p.13, p.60–61, p.208, p.288 (PDF 同) | PH+OT | CORE | I02 | 不能把所有波形的上限都寫成 25 MHz。Noise 不適用頻率（p.209）。 |
| `AFG.KEY.AMPL` | P1 AFG 操作鍵上排第 3 顆，原圖約 (508,256) | AMPL | 實體鍵；按下 | 設定幅度。AMPL 參數高亮，軟鍵顯示 F1 dBm／F2 mVRMS／F3 VRMS／F4 mVPP／F5 VPP | LCD AMPL 欄紅字；編輯框如「3.000 VPP」 | 50 Ω：1 mVpp–10 Vpp；High Z：2 mVpp–20 Vpp；20–25 MHz 時為 1 mVpp–5 Vpp（50 Ω）／2 mVpp–10 Vpp（open）；解析度 1 mV 或 3 位 | P1；M-AFG p.13, p.61–62, p.288 (PDF 同) | PH+OT | CORE | I02 | p.13 按鍵圖示印成「AMP」，但照片、p.13 面板圖與內文都是「AMPL」（見 discrepancies）。High Z 不可用 dBm（p.215）。 |
| `AFG.KEY.DC_OFFSET` | P1 AFG 操作鍵上排第 4 顆，原圖約 (555,257) | DC Offset | 實體鍵；按下 | 設定 DC offset。Offset 參數高亮，軟鍵 F1 mVDC／F2 VDC | LCD Offset 欄紅字；編輯框如「0.00VDC」 | ±5 Vpk（50 Ω）／±10 Vpk（High Z），並受幅度聯合限制 | P1；M-AFG p.13, p.62–63, p.289 (PDF 同) | PH+OT | CORE | I02 | 聯合限制見 specs。 |
| `AFG.KEY.UTIL` | P1 AFG 操作鍵上排第 5 顆，原圖約 (601,258) | UTIL | 實體鍵；按下 | 進入 Utility 選單：F1 Memory／F2 Cal.／F3 System／F4 Dual Chan／F5 Counter（p.51） | LCD 軟鍵換成 UTIL 選單 | — | P1；M-AFG p.14, p.40–43, p.51, p.134–143 (PDF 同) | PH+OT | OUT | I02 | p.14 說 UTIL 可設「output impedance settings」，但 p.51 選單樹與 p.144 操作步驟都把 Load 放在 CH1/CH2 下，衝突待校機（GAP-AFG-17）。本輪只顯示頂層選單名稱與範圍說明，不改任何狀態。 |

### 進階鍵（下排）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.KEY.ARB` | P1 AFG 操作鍵下排第 1 顆，原圖約 (418,286)，淺藍灰鍵 | ARB | 實體鍵；按下 | 任意波形設定：F1 Display／F2 Edit／F3 Built in／F4 Output／F5 More | LCD 軟鍵換成 ARB 選單 | — | P1；M-AFG p.14, p.37–38, p.45–48, p.149–172 (PDF 同) | PH+OT | OUT | I02 | 本輪未納入 ARB 編輯；只顯示範圍說明。 |
| `AFG.KEY.MOD` | P1 AFG 操作鍵下排第 2 顆，原圖約 (462,286) | MOD | 實體鍵；按下 | 調變：F1 AM／F2 FM／F3 FSK／F4 PM／F5 SUM | LCD 軟鍵換成 MOD 選單 | — | P1；M-AFG p.14, p.29–33, p.48, p.64, p.67–105 (PDF 同) | PH+OT | OUT | I02 | 本輪未納入。 |
| `AFG.KEY.SWEEP` | P1 AFG 操作鍵下排第 3 顆，原圖約 (506,287) | Sweep | 實體鍵；按下 | 掃頻：F1 Source／F2 Type／F3 Start／F4 Stop／F5 More | LCD 軟鍵換成 Sweep 選單 | — | P1；M-AFG p.14, p.34, p.49, p.109–117 (PDF 同) | PH+OT | OUT | I02 | 本輪未納入。 |
| `AFG.KEY.BURST` | P1 AFG 操作鍵下排第 4 顆，原圖約 (551,288) | Burst | 實體鍵；按下 | Burst 選單：F1 N Cycle、F2 Gate（p.121：「To select either N Cycle (F1) or Gate (F2).」）；本輪未納入 | LCD 軟鍵換成 Burst 選單 | — | P1；M-AFG p.14, p.35, p.50, p.120–121 | PH+OT | OUT | I02 | 本輪未納入。 |
| `AFG.KEY.PRESET` | P1 AFG 操作鍵下排第 5 顆，原圖約 (598,289)，綠色鍵 | Preset | 實體鍵；按下 | 恢復面板預設值（p.52：「The Preset key is used to restore the default panel settings.」）：Sine、1kHz、3.000 Vpp、0.00V dc、Output units Vpp、Output terminal 50Ω、Output Off；Memory settings No change | LCD 參數與 status tab 回到預設值（Output OFF、50Ω） | — | P1；M-AFG p.14, p.52–53 (PDF 同) | PH+OT | CORE | I02 | 預設表沒有寫是否兩通道都套用，也沒列 SYM／Duty／Phase（GAP-AFG-07）。遠端說明的預設幅度 100 mVpp 與此不同，採面板值（見 discrepancies）。 完整預設表（含 MOD／Sweep／Burst Off、Display mode On、Error queue Cleared、Trigger source Internal）見 instrument-scope 規格表。 |

### 輸出端子

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.TERM.CH1_OUT` | P1 AFG 右側 OUTPUT 區上方 BNC，原圖約 (672,107) | OUTPUT（區塊標題）／CH1／接地符號／50Ω | BNC 輸出端子；無（接線屬 J01） | CH1 輸出埠（p.14：「CH1: Channel 1 output port」）。內部輸出阻抗「50Ω typical (fixed)」，輸出關閉時「> 10MΩ (output disabled)」（p.289） | 無（只能從 LCD CH1 status tab 看到 ON／OFF） | 見幅度與 offset 規格 | P1；M-AFG p.13–14, p.289 (PDF 同) | PH+OT | STATIC | J01/I02 | J01 需分開中心與外殼，建議預留 AFG.TERM.CH1_OUT_CENTER／AFG.TERM.CH1_OUT_SHELL（命名為 PD）。面板印的 50Ω 是內阻，不是 Load 設定。；卡別細節：J01（I02 只提供 source descriptor） |
| `AFG.TERM.CH2_OUT` | P1 AFG 右側 OUTPUT 區下方 BNC，原圖約 (667,183) | CH2／接地符號／50Ω | BNC 輸出端子；無（接線屬 J01） | CH2 輸出埠（p.14）。內阻 50 Ω typical fixed；輸出關閉時 >10 MΩ（p.289） | 無（LCD CH2 status tab） | 見幅度與 offset 規格 | P1；M-AFG p.13–14, p.289 (PDF 同) | PH+OT | STATIC | J01/I02 | 預留 AFG.TERM.CH2_OUT_CENTER／AFG.TERM.CH2_OUT_SHELL（PD）。；卡別細節：J01（I02 source descriptor） |

### 電源

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.PWR.POWER` | P1 AFG 右下 POWER 區，原圖約 (657,275) | POWER；鍵下方左「▂ I」、右「▆ ○」圖示 | 電源鍵（按壓式）；按下／彈起 | 開關電源（p.14：「Turns the power on or off.」）；p.20：「When the power switch is turned on the screen displays the loading screen.」 | LCD 亮起並顯示 loading screen（p.20）；開機後的設定 UN | ON／OFF | P1；M-AFG p.14, p.19–20 (PDF 同) | PH+OT+UN | APPROX | I02 | I＝按入（ON）、O＝彈起（OFF），依圖示判讀（PD）。開機記憶或回復上次設定的行為手冊沒寫（GAP-AFG-06）。暫定開機＝Preset 值且兩通道 Output OFF，並標示為近似。；證據細節：PH+OT；開機狀態 UN |

### 後面板（照片未見）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AFG.PORT.USB_HOST` | 照片未見（手冊標示在後面板） | 照片未見（手冊：Host） | USB Type-A；— | USB 隨身碟（韌體更新、ARB 存取）與 DSO Link | — | — | M-AFG p.16–17, p.137, p.147 (PDF 同) | OT | OUT | I02 | 前面板沒有 USB 口。本輪不繪後面板。 |
| `AFG.PORT.USB_DEVICE` | 照片未見（後面板） | 照片未見（手冊：Device） | USB Type-B；— | PC 遠端控制（p.17, p.182） | 遠端連線時面板鍵除 F5 外都鎖住（p.183） | — | M-AFG p.16–17, p.182–183 (PDF 同) | OT | OUT | I02 | 遠端控制本輪未納入。 |
| `AFG.TERM.TRIG_IN` | 照片未見（後面板） | 照片未見（手冊：Trigger IN） | BNC；— | 外部觸發輸入（FSK、Burst、Sweep）；TTL，10kΩ | — | — | M-AFG p.16, p.290 (PDF 同) | OT | OUT | I02 | — |
| `AFG.TERM.MOD_IN` | 照片未見（後面板） | 照片未見（手冊：MOD IN） | BNC；— | 外部調變輸入（AM、FM、PM、SUM）；±5V full scale，10kΩ | — | — | M-AFG p.17, p.291 (PDF 同) | OT | OUT | I02 | — |
| `AFG.TERM.TRIG_OUT` | 照片未見（後面板） | 照片未見（手冊：Trigger OUT） | BNC；— | Trigger／Marker 輸出；p.16 稱只用於 Sweep 與 ARB，p.291 規格表寫「For Burst, Sweep, Arb」（手冊互相矛盾） | — | — | M-AFG p.16, p.291 (PDF 同) | OT | OUT | I02 | — |
| `AFG.TERM.COUNTER_IN` | 照片未見（後面板） | 照片未見（手冊：Counter IN） | BNC；— | 頻率計輸入；5Hz–150MHz，1kΩ/1pf | — | — | M-AFG p.17, p.41, p.291 (PDF 同) | OT | OUT | I02 | — |
| `AFG.MISC.AC_INLET` | 照片未見（後面板） | 照片未見（手冊：AC 100-240V 50-60Hz 25W MAX） | 電源插座；— | AC 電源輸入 | — | 100–240 V AC，50–60 Hz | M-AFG p.7–8, p.16 (PDF 同) | OT | OUT | I02 | p.8 保險絲規格為 F1A/250V，手冊沒畫出保險絲座位置。 |
| `AFG.MISC.FAN` | 照片未見（後面板） | 照片未見 | 風扇；— | 散熱 | — | — | M-AFG p.16 (PDF 16) | OT | OUT | I02 | — |

### GW Instek AFG-2225 核心選單路徑

只列來源有寫的路徑；沒有來源的不補。

| 路徑 | 軟鍵／選項 | 來源 | 證據 | 狀態 | 備註 |
| --- | --- | --- | --- | --- | --- |
| Waveform | F1 Sine｜F2 Square｜F3 Pulse｜F4 Ramp｜F5 Noise | M-AFG p.18, p.23, p.44, p.55–59 (PDF 同) | OT | CORE（Sine／Square／Ramp）；Pulse、Noise 為 OUT | 沒有 Triangle 軟鍵。p.55：「The AFG-2225 can output 5 standard waveforms: sine, square, pulse, ramp and noise.」 |
| Waveform → F4 Ramp → F1 SYM → 數字鍵（或 ◀▶＋旋鈕）→ F2 % | F1 SYM｜F2 %｜F3–F5 未標示（UN） | M-AFG p.27, p.44, p.58–59 (PDF 同) | OT | CORE（三角波＝SYM 50%） | p.27：「Press SYM(F1), 5 + 0 + %(F2).」LCD 波形區顯示「SYMM: 50.0 %」並畫出對稱三角波（p.59 截圖）。範圍 0%–100%。 |
| Waveform → F2 Square → F1 Duty → 數字 → F2 %；TTL | F1 Duty｜F2 %｜TTL（手冊未寫 F 鍵位置） | M-AFG p.44, p.56 (PDF 同) | OT | OUT（本輪 Duty 固定為預設 50%） | p.56：「TTL function is to set the amplitude of the current square wave at 2.5Vpp, and DC Offset at 1.25Vdc.」 |
| Waveform → F3 Pulse → F1 Width → 數字 → 單位 | F1 Width｜F2 nSEC｜F3 uSEC｜F4 mSEC｜F5 SEC | M-AFG p.44, p.57–58 (PDF 同) | OT | OUT | Pulse Width 20ns–1999.9s。 |
| FREQ/Rate →（FREQ 高亮）→ 數字鍵或 ◀▶＋旋鈕 → 單位軟鍵 | F1 uHz｜F2 mHz｜F3 Hz｜F4 kHz｜F5 MHz | M-AFG p.27–28, p.32, p.60–61（F1 uHz、F2 mHz、F5 MHz 只有 p.61 截圖一個來源） | OT | CORE | p.60：「Choose a frequency unit by pressing F1~F5.」p.27：「1 + kHz (F4)」；p.34：「1 + 0 + mHz (F2)」。；已移除誤引的 p.34（那是 Sweep→Start 子選單） |
| AMPL →（AMPL 高亮）→ 數字鍵或 ◀▶＋旋鈕 → 單位軟鍵 | F1 dBm｜F2 mVRMS｜F3 VRMS｜F4 mVPP｜F5 VPP | M-AFG p.27–28, p.61–62 (PDF 同；單位位置取自 p.62 截圖) | OT | CORE | p.61：「Choose a unit type by pressing F1~F5.」High Z 時不能用 dBm（遠端說明 p.215），面板上 dBm 軟鍵是否消失 UN。 |
| DC Offset →（Offset 高亮）→ 數字鍵（+/-）或 ◀▶＋旋鈕 → 單位軟鍵 | F1 mVDC｜F2 VDC｜F3–F5 空白 | M-AFG p.62–63 (PDF 同) | OT | CORE | p.62：「Press F1 (mVDC) or F2 (VDC) to choose a voltage range.」 |
| CH1/CH2 | F1 Load｜F4 Phase｜F5 DSO Link｜F2、F3 未標示（UN） | M-AFG p.51, p.144–147 (PDF 同) | OT | CORE（只做 Load）；Phase、DSO Link 為 OUT | 按 CH1/CH2 時是否同時切換通道：UN（GAP-AFG-01）。 |
| CH1/CH2 → F1 Load | F1 50 OHM｜F2 High Z | M-AFG p.51, p.144–145 (PDF 同) | OT | CORE | p.144 Note：「The load function can only be used if the ARB, MOD, SWEEP or BURST functions are not active.」 |
| CH1/CH2 → F4 Phase | F1 Phase（→ 數字 → F5 Degree）｜F2 S_Phase | M-AFG p.145–146 (PDF 同) | OT | OUT | LCD 的 Phase 列仍顯示 Preset 值 0.0°（截圖）。 |
| CH1/CH2 → F5 DSO Link | F1 Search｜F2 CH1｜F3 CH2｜F4 CH3｜F5 CH4 | M-AFG p.147 (PDF 147) | OT | OUT | 這些 CH1–CH4 是 GDS 示波器的通道，不是 AFG 的通道。 |
| OUTPUT（直接鍵，沒有選單） | — | M-AFG p.14, p.18, p.27–28 (PDF 同) | OT | CORE | 範例都以「Press the Output key.」結尾。 |
| Preset（直接鍵） | — | M-AFG p.14, p.52–53 (PDF 同) | OT | CORE | 預設值見 specs。 |
| Return | — | M-AFG p.13, p.44 (PDF 同) | OT | CORE | 回上一層選單。 |
| UTIL | F1 Memory｜F2 Cal.｜F3 System｜F4 Dual Chan｜F5 Counter | M-AFG p.25, p.40–43, p.51, p.134–143 (PDF 同) | OT | OUT | p.51 UTIL 選單樹沒有列 Load；但 p.14 說 UTIL 含「output impedance settings」，兩處衝突（UN，見 GAP-AFG-17）。本輪 UTIL 只顯示頂層與範圍說明。 |
| MOD | F1 AM｜F2 FM｜F3 FSK｜F4 PM｜F5 SUM | M-AFG p.29–33, p.48, p.67–105 (PDF 同) | OT | OUT | 只列頂層名稱。 |
| Sweep | F1 Source｜F2 Type｜F3 Start｜F4 Stop｜F5 More | M-AFG p.34, p.49, p.109–117 (PDF 同) | OT | OUT | 只列頂層名稱。 |
| Burst | F1 N Cycle｜F2 Gate｜F3–F5 未標示（UN） | M-AFG p.50, p.120–121 | OT | OUT | 只列頂層名稱。 |
| ARB | F1 Display｜F2 Edit｜F3 Built in｜F4 Output｜F5 More（→ F1 Save…） | M-AFG p.37–38, p.45–48, p.149–172 (PDF 同) | OT | OUT | 只列頂層名稱。 |

## 2. Tektronix TDS2001C 雙通道數位儲存示波器（P2，I03）

**照片核對：** P2（02_校機_TDS2001C.jpeg，768×1024，LCD 全暗；下列座標為原圖約略像素）。型號：螢幕上方標示條印『Tektronix  TDS 2001C  TWO CHANNEL DIGITAL STORAGE OSCILLOSCOPE』，右端深藍底『50 MHz / 500 MS/s』，與 M-TDS-13 p.1 (PDF 25) 的 TDS2001C 列一致。通道：只有 BNC『1』『2』加『Ext Trig』共 3 個 BNC；垂直區只有 1（黃）、Math（粉紅）、2（藍）三鍵，沒有 CH3/CH4 的按鍵、旋鈕或 BNC。旋鈕共 8 顆：多功能 1、垂直位置 2、垂直刻度 2、水平位置 1、水平刻度 1、觸發位準 1。按鍵共 29 顆：頂排 13 顆（第一列 自動調整/Save/Recall/Measure/Acquire/Help/Auto Set，第二列 Ref/Utility/Cursor/Display/Default Setup/單一，另有 Run/Stop）、儲存（印表機圖示）1、垂直 3、水平 2（Horiz、Set to Zero）、觸發 4（Trig Menu、Set To 50%、Force Trig、Trig View）、螢幕右側 5 顆方形 option 鍵加 1 顆圓鍵（旁邊直書 Probe Check）。指示燈 3 顆：多功能旋鈕左上、自動調整鍵左側、『儲存』字左側。端子與插口：CH1 BNC、CH2 BNC、Ext Trig BNC、Probe Comp 兩片金屬接片（上下排列，標示『Probe Comp ~5V@1kHz』加方波符號與接地符號）、USB Flash Drive 口 1 個。面板下緣由左到右：USB Flash Drive 口 → Probe Comp 兩片 → CH1 → CH2 → Ext Trig。照片上沒有的：CH3/CH4、Menu On/Off 鍵（原廠也沒有）；電源鍵（手冊 p.4 圖示在機殼頂部）與後面板 USB Device 口不在畫面內。中文貼字：自動調整、參考值、自動設定、單一、執行/停止、儲存、垂直、水平、觸發、位置（×2）、功能表、刻度（×2）、選單（×2）、設置為零、位準、設置為 50%、強制觸發、觸發監看。英文印字：Save/Recall、Measure、Acquire、Help、Utility、Cursor、Display、Default Setup、鍵面 Auto Set、Ref、Run/Stop、Math、Horiz、Set to Zero、Trig Menu、Set To 50%、Force Trig、Trig View、Ext Trig、300 V / 300V CAT II、USB Flash Drive、Probe Check、Probe Comp。另有手寫『13』（非原廠）。控制項數量、分組與相對位置和 M-TDS-13 p.9 (PDF 33) 的 2-channel 面板圖一致；字樣差異列在 discrepancies。

**頁碼對照：** 兩版（M-TDS-13 077-0826-00、M-TDS-11 071-2722-03）都是 161 個 PDF 頁，版面頁序完全相同。PDF 1–8：封面、版權、保固，無頁碼。PDF 9–24：前置頁 i–xvi（核對：PDF 9＝i、PDF 11＝iii、PDF 21＝xiii、PDF 22＝xiv、PDF 24＝xvi）。PDF 25–161：印刷頁 1–137，印刷頁＝PDF 頁序−24。核對方式：用腳本抓兩版所有頁尾的阿拉伯數字，69 個頁尾的差值全部是 24。人工抽查：PDF 28＝p.4（Functional Check）、PDF 31＝p.7（Manual Probe Compensation）、PDF 33＝p.9（Operating Basics 面板圖）、PDF 103＝p.79（Autoset）、PDF 110＝p.86（Horizontal）、PDF 120＝p.96（Trigger Controls）、PDF 128＝p.104（Vertical Controls）、PDF 134＝p.110（Table 4 Horizontal）、PDF 151＝p.127（Appendix E Default Setup）、PDF 161＝p.137。與 04 所寫『印刷頁＋24＝PDF 頁序』一致。兩版全文 diff 只有 99 行不同：文件號、Revision A、安全摘要的大小寫、RoHS 文句、前言的附錄代號、標準配件文句、各語言手冊件號。操作章節文字相同；抽查 15 頁的文字雜湊也相同。圖頁像素比對：PDF 28、33、39、152 有極小的反鋸齒差異，目視內容相同；PDF 34、35、37、41、42、57、60、129 完全相同。本輸出引用格式為『M-TDS-13 p.印刷頁 (PDF 頁序)』，M-TDS-11 同頁同文，不另重複。

### 選單與控制按鈕區（Menu and Control Buttons）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KNOB.MULTIPURPOSE` | P2 右半面板左上角大旋鈕，約 (362,408)；位在頂排按鍵左側、『儲存』鍵正上方 | 旋鈕本體無字；左上方有 LED，以短折線連向旋鈕（照片無中文貼字） | 旋鈕（手冊未提按壓功能）；旋轉 | 手冊名 Multipurpose Knob：『The function is determined by the displayed menu or selected menu option.』核心用途：Cursor 選單中移動 Cursor 1／Cursor 2；Measure 子選單選 Type；Trig Menu（Edge）選 Source；1/2 ►Probe ►Voltage ►Attenuation 輸入倍率值。手冊另列 Help 捲動、Holdoff、Math 位置／刻度、Save/Recall 選檔、Video 行號、Pulse Width、File Utilities、GPIB、日期時間，本輪未納入 | 作用中時旁邊 LED 亮；LCD 提示列會說明旋鈕目前可用（p.13）；游標／數值隨旋轉更新 | 依目前選單項目而定；游標步進與範圍手冊未載（見 GAP-TDS-15） | P2；M-TDS-13 p.15–17 (PDF 39–41) 功能對照表；p.13 (PDF 37)；p.36–39 (PDF 60–63)；p.83 (PDF 107) | PH+OT | CORE | I03/I01 | 沒有可作用的選單時，旋轉應無效果、LED 熄滅（PD）。不可把它做成可改任何參數的通用數值輪；卡別細節：I03（旋鈕元件屬 I01） |

### 選單與控制按鈕區

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.LED.MULTIPURPOSE` | P2 多功能旋鈕左上方小圓點，約 (347,386)，以折線連到旋鈕 | 無字 | LED；無（被動顯示） | 標示多功能旋鈕是否作用中 | 『When active, the adjacent LED lights.』；Help 檢視時也會亮 | 亮／滅 | P2；M-TDS-13 p.16 (PDF 40)；p.13 (PDF 37)；p.xiv (PDF 22) | PH+OT | CORE | I03 | 指示燈的分類規則：會隨本輪核心狀態變化的指示燈列 CORE（此燈由 TDS.KNOB.MULTIPURPOSE 是否作用驅動，驗收見 TDS-F20）；本輪不會變化的指示燈（如 AutoRange、儲存旁的燈）列 STATIC。照片 LCD 暗，無法證明實際亮滅時機。 |
| `TDS.LED.AUTORANGE` | P2 『自動調整』鍵左側小圓點，約 (388,383)，以折線連到鍵 | 無字 | LED；無 | 標示 autoranging 是否啟用 | 『When autoranging is active, the adjacent LED lights.』 | 本輪恆滅 | P2；M-TDS-13 p.17 (PDF 41)；p.77 (PDF 101) | PH+OT | STATIC | I03 | AutoRange 未納入，所以固定熄滅 |

### 選單與控制按鈕區（頂排第一列）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KEY.AUTORANGE` | P2 頂排第一列最左鍵，約 (415,394) | 鍵面無字；上方中文貼『自動調整』（照片看不到英文；手冊面板圖此位置印 AutoRange） | 按鍵；按一下 | AutoRange：『Displays the Autorange Menu, and activates or deactivates the autoranging function.』持續追蹤訊號並調整設定；選項有 Autoranging、Vertical and Horizontal、Vertical Only、Horizontal Only、Undo Autoranging | 啟用時左側 LED 亮 | Off／On；開機時一律 inactive | P2；M-TDS-13 p.17 (PDF 41)；p.19 (PDF 43)；p.77–79 (PDF 101–103)；p.127 (PDF 151)；p.9 面板圖 (PDF 33) | PH+OT | OUT | I03 | 02 規定 AutoRange 本輪先 OUT，不可拿 AutoSet 代替。按下只在儀器外顯示『本輪未納入』說明，LED 保持熄滅，不改任何設定 |
| `TDS.KEY.SAVE_RECALL` | P2 頂排第一列第 2 鍵，約 (456,394) | 上方英文『Save/Recall』（無中文貼字） | 按鍵；按一下 | 『Displays the Save/Recall Menu for setups and waveforms.』Action 有 Save All、Save Image、Save Setup、Save Waveform、Recall Setup、Recall Waveform | 右側選單 | Setup 1–10、USB 檔案 | P2；M-TDS-13 p.17 (PDF 41)；p.91–95 (PDF 115–119) | PH+OT | OUT | I03 | 儲存與 USB 不納入；按下顯示範圍說明，不可假裝已儲存 |
| `TDS.KEY.MEASURE` | P2 頂排第一列第 3 鍵，約 (498,394) | 上方英文『Measure』 | 按鍵；按一下 | 『Displays the automated measurements menu.』最多同時 5 項；核心類型 Freq、Period、Pk-Pk（另有 None） | 右側 5 格，每格顯示 Source／Type／Value；訊息區提示『Push an option button to change its measurement』 | 16 種量測，最多顯示 5 項 | P2；M-TDS-13 p.17 (PDF 41)；p.12 (PDF 36)；p.26–27 (PDF 50–51)；p.31–34 (PDF 55–58)；p.89 (PDF 113) | PH+OT | CORE | I03 | 量測值必須從所選通道的採集紀錄算出 |
| `TDS.KEY.ACQUIRE` | P2 頂排第一列第 4 鍵，約 (541,394) | 上方英文『Acquire』 | 按鍵；按一下 | 『Displays the Acquire Menu.』Sample（預設）／Peak Detect／Average，Averages 可選 4、16、64、128 | LCD 左上角的取樣模式圖示 | 見 function | P2；M-TDS-13 p.17 (PDF 41)；p.10 (PDF 34)；p.13 (PDF 37)；p.22 (PDF 46)；p.75–77 (PDF 99–101) | PH+OT | APPROX | I03 | 按下顯示 Acquire 選單，但只有 Sample 可用；Peak Detect、Average 停用並標示本輪未納入（02：所有 acquisition mode 未納入） |

### 選單與控制按鈕區（頂排第一列，灰底框上方）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KEY.HELP` | P2 頂排第一列第 5 鍵，約 (586,394)，灰底區塊內 | 上方英文『Help』 | 按鍵；按一下 | 『Displays the Help Menu.』內容感應說明、索引、超連結 | LCD 顯示說明文字，多功能旋鈕 LED 亮 | — | P2；M-TDS-13 p.xiv (PDF 22)；p.17 (PDF 41)；p.86 (PDF 110) | PH+OT | OUT | I03 | 不製作原廠 Help 內容；教學說明放在儀器外 |

### 選單與控制按鈕區（頂排第一列最右）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KEY.AUTOSET` | P2 頂排第一列最右的黑底鍵，約 (633,392) | 鍵面白字『Auto Set』；上方中文『自動設定』 | 按鍵；按一下（一次性動作） | 『Automatically sets the oscilloscope controls to produce a usable display of the input signals.』依 p.79–80 表調整垂直、水平、觸發設定，並依訊號種類顯示 AutoSet 側選單與自動量測 | 波形變得可讀；graticule 區顯示自動量測；右側 AutoSet 選單；訊息區例如『Square wave or pulse detected on CH1』 | 見 specs（AutoSet 設定表） | P2；M-TDS-13 p.4 (PDF 28)；p.12 (PDF 36)；p.17 (PDF 41)；p.19 (PDF 43)；p.30 (PDF 54)；p.79–82 (PDF 103–106) | PH+OT | CORE | I03 | 不可做成持續追蹤；刻度選擇演算法見 GAP-TDS-10 |

### 選單與控制按鈕區（頂排第二列）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KEY.REF` | P2 頂排第二列最左，白色鍵面，約 (414,426) | 鍵面『Ref』；上方中文『參考值』 | 按鍵；按一下 | 『Displays the Reference Menu to quickly display and hide reference waveforms stored in the oscilloscope non-volatile memory.』2 通道機只有 RefA、RefB | 白色參考波形 | RefA、RefB | P2；M-TDS-13 p.17 (PDF 41)；p.91 (PDF 115)；p.95 (PDF 119) | PH+OT | OUT | I03 | 參考波形不納入 |
| `TDS.KEY.UTILITY` | P2 頂排第二列第 2 鍵，約 (455,426) | 上方英文『Utility』 | 按鍵；按一下 | 『Displays the Utility Menu.』包括 System Status、Options（Printer Setup、GPIB、Date/Time）、Error Log、Do Self Cal、File Utilities、Language、Data Logging、Limit Test | 右側選單 | — | P2；M-TDS-13 p.17 (PDF 41)；p.101–104 (PDF 125–128)；p.52–54 (PDF 76–78) | PH+OT | OUT | I03 | LCD 語言在 Utility ►Language（p.102）；校機語言未知（GAP-TDS-01） |
| `TDS.KEY.CURSOR` | P2 頂排第二列第 3 鍵，約 (497,426) | 上方英文『Cursor』 | 按鍵；按一下 | 『Displays the Cursor Menu. Cursors remain visible (unless the Type option is set to Off) after you leave the Cursor Menu but are not adjustable.』 | 兩條游標線（作用中的一條為實線）；右側顯示 Δ 讀值與各游標位置讀值 | Type：Time／Amplitude／Off | P2；M-TDS-13 p.17 (PDF 41)；p.26 (PDF 50)；p.36–39 (PDF 60–63)；p.82–83 (PDF 106–107) | PH+OT | CORE | I03 | — |
| `TDS.KEY.DISPLAY` | P2 頂排第二列第 4 鍵，約 (540,426) | 上方英文『Display』 | 按鍵；按一下 | 『Displays the Display Menu.』Type（Vectors/Dots）、Persist、Format（YT/XY） | 右側選單 | — | P2；M-TDS-13 p.17 (PDF 41)；p.83–85 (PDF 107–109) | PH+OT | OUT | I03 | 固定 YT、Vectors、Persist Off（即 Default Setup 值） |

### 選單與控制按鈕區（頂排第二列，灰底框下方）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KEY.DEFAULT_SETUP` | P2 頂排第二列第 5 鍵，約 (586,426)，與 Help 同一灰底區塊 | 上方英文『Default Setup』 | 按鍵；按一下 | 『Recalls the factory setup.』手冊也說只恢復大部分設定（『recall most of the factory option and control settings, but not all』）；按下後只顯示 CH1 並移除其他波形；恢復值依 Appendix E | 訊息區『Default setup recalled』；各讀值回到預設 | 見 specs（Default Setup） | P2；M-TDS-13 p.4 (PDF 28)；p.12 (PDF 36)；p.17 (PDF 41)；p.20 (PDF 44)；p.83 (PDF 107)；p.95 (PDF 119)；p.127–128 (PDF 151–152) | PH+OT | CORE | I03 | 原廠有完整預設表，依 02 共用規則列為核心。探棒倍率是否被重設，手冊自相矛盾（GAP-TDS-09）；預設 500 ms/div 會落入 Scan 條件（GAP-TDS-08） |

### 選單與控制按鈕區（頂排第二列最右）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KEY.SINGLE` | P2 頂排第二列最右，Auto Set 正下方，約 (632,426)；右下有折線連到 Run/Stop | 照片上鍵面看不到英文；上方中文『單一』（手冊圖鍵面印 Single） | 按鍵；按一下 | Single（single sequence）：『Acquires a single waveform and then stops.』每按一次重新開始一次採集，偵測到觸發後完成並停止 | 觸發狀態依序為 Armed/Ready → Trig'd → Acq. Complete | Sample 模式完成 1 次採集即結束 | P2；M-TDS-13 p.17 (PDF 41)；p.20 (PDF 44)；p.41 (PDF 65)；p.77 (PDF 101)；p.11 (PDF 35) | PH+OT | CORE | I03 | Auto 模式下按 Single 是否會自動強制完成，見 GAP-TDS-07 |

### 選單與控制按鈕區（頂排最右）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KEY.RUN_STOP` | P2 頂排最右、位置略低，約 (681,409) | 鍵面『Run/ Stop』；上方中文『執行/停止』 | 按鍵；按一下切換 | 『Continuously acquires waveforms or stops the acquisition.』停止後畫面凍結，但仍可用垂直、水平控制縮放或移動 | 觸發狀態 Stop；波形凍結；停止後改觸發設定，波形改以斷線樣式顯示 | RUN／STOP；預設 RUN | P2；M-TDS-13 p.17 (PDF 41)；p.77 (PDF 101)；p.84 (PDF 108)；p.87 (PDF 111)；p.127 (PDF 151) | PH+OT | CORE | I03 | — |

### 選單與控制按鈕區（左側）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KEY.PRINT` | P2 多功能旋鈕正下方，印表機圖示圓角鍵，約 (362,467) | 鍵面印表機圖示；左上方 LED 與中文『儲存』（手冊圖為『Save』） | 按鍵；按一下 | 『Starts the print operation to a PictBridge compatible printer, or performs the Save function to the USB flash drive.』 | Save 功能時左上 LED 亮；USB 存取中螢幕顯示時鐘符號 | Prints／Saves All to Files／Saves Image to File | P2；M-TDS-13 p.17 (PDF 41)；p.67–69 (PDF 91–93)；p.73 (PDF 97)；p.90 (PDF 114)；p.92 (PDF 116) | PH+OT | OUT | I03 | 手冊說按住 Trig View 時，這是唯一仍可用的按鍵（p.100） |
| `TDS.LED.SAVE` | P2 『儲存』字樣左側小圓點，約 (345,451) | 旁印中文『儲存』 | LED；無 | 標示 PRINT 鍵是否設成存到 USB | 『An LED indicates when the print button is configured to save data to the USB flash drive.』 | 本輪恆滅 | P2；M-TDS-13 p.17 (PDF 41)；p.67 (PDF 91)；p.69 (PDF 93) | PH+OT | STATIC | I03 | — |

### 垂直（Vertical）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KNOB.CH1_POSITION` | P2 垂直區左上小旋鈕，約 (409,480) | 兩顆位置旋鈕中間印『位置』（手冊 Position） | 旋鈕；旋轉 | 『Positions a waveform vertically.』只移動 CH1 波形與它的接地參考標記，不改變輸入訊號 | 波形與螢幕左側的 CH1 接地參考標記一起上下移動；GND 耦合時零伏水平線也跟著移動 | 1X 探棒時：2–200 mV/div 為 ±1.8 V，>200 mV/div 至 5 V/div 為 ±45 V；預設 0.00 divs (0.00 V)；步進未載（GAP-TDS-11） | P2；M-TDS-13 p.14 (PDF 38)；p.23 (PDF 47)；p.105 (PDF 129)；p.108 (PDF 132)；p.128 (PDF 152)；p.11 (PDF 35) | PH+OT | CORE | I03 | p.9–12 的顯示區說明沒有列出垂直位置讀值（UN） |
| `TDS.KNOB.CH2_POSITION` | P2 垂直區右上小旋鈕，約 (492,482) | 『位置』（兩顆共用一個標字） | 旋鈕；旋轉 | 同 CH1，作用於 CH2 | CH2 波形與接地參考標記移動 | 同 CH1 | P2；M-TDS-13 p.14 (PDF 38)；p.23 (PDF 47)；p.105 (PDF 129)；p.108 (PDF 132)；p.128 (PDF 152)；p.11 (PDF 35)（與 TDS.KNOB.CH1_POSITION 相同） | PH+OT | CORE | I03 | 各通道分開保存 |
| `TDS.KEY.CH1_MENU` | P2 垂直區中列左側黃色鍵，約 (409,533) | 鍵面『1』（黃色）；1/Math/2 三鍵下方弧線，中間印中文『功能表』（手冊 Menu） | 按鍵；按一下 | 『Displays the Vertical menu selections and toggles the display of the channel waveform on and off.』 | 右側 CH1 選單（Coupling／BW Limit／Volts/Div／Probe／Invert）；CH1 波形與接地標記出現或消失；下方出現或移除 CH1 V/div 讀值 | 顯示／移除 | P2；M-TDS-13 p.4 (PDF 28)；p.10 (PDF 34)；p.12–14 (PDF 36–38)；p.104–106 (PDF 128–130) | PH+OT | CORE | I03 | 各狀態下按一次的精確效果見 GAP-TDS-05 |
| `TDS.KEY.MATH_MENU` | P2 垂直區中列中央粉紅鍵，約 (448,534) | 鍵面『Math』（粉紅） | 按鍵；按一下 | 『Displays waveform math operations menu and toggles the display of the math waveform on and off.』2 通道機可用 CH1+CH2、CH1−CH2、CH2−CH1、CH1×CH2、FFT | Math 波形與 Math 選單 | — | P2；M-TDS-13 p.14 (PDF 38)；p.87–88 (PDF 111–112)；p.55–57 (PDF 79–81) | PH+OT | OUT | I03 | FFT 與 Math 不納入 |
| `TDS.KEY.CH2_MENU` | P2 垂直區中列右側藍色鍵，約 (490,536) | 鍵面『2』（藍色）；下方『功能表』 | 按鍵；按一下 | 同 CH1，作用於 CH2 | CH2 選單、波形與讀值 | 顯示／移除 | P2；M-TDS-13 p.4 (PDF 28)；p.10 (PDF 34)；p.12–14 (PDF 36–38)；p.104–106 (PDF 128–130)（與 TDS.KEY.CH1_MENU 相同） | PH+OT | CORE | I03 | Default Setup 後 CH2 為關閉（p.127） |
| `TDS.KNOB.CH1_VOLTS_DIV` | P2 垂直區左下大旋鈕，約 (404,595) | 兩顆大旋鈕中間印『刻度』（手冊 Scale） | 旋鈕；旋轉 | 『Selects vertical scale factors.』波形以接地參考位準為中心放大或縮小 | 畫面下方的 CH1 刻度讀值（例如 CH1 1.00V）；波形所佔格數改變 | 2 mV/div–5 V/div，1-2-5 序列（1X 探棒）；顯示值乘上 Probe 設定；Coarse 為預設；Fine 本輪不納入 | P2；M-TDS-13 p.14 (PDF 38)；p.23 (PDF 47)；p.105 (PDF 129)；p.108 (PDF 132)；p.107 (PDF 131) | PH+OT | CORE | I03 | 停止時仍可調整，只縮放凍結的紀錄 |
| `TDS.KNOB.CH2_VOLTS_DIV` | P2 垂直區右下大旋鈕，約 (487,601) | 『刻度』 | 旋鈕；旋轉 | 同 CH1，作用於 CH2 | CH2 刻度讀值 | 同 CH1 | P2；M-TDS-13 p.14 (PDF 38)；p.23 (PDF 47)；p.105 (PDF 129)；p.108 (PDF 132)；p.107 (PDF 131)（與 TDS.KNOB.CH1_VOLTS_DIV 相同） | PH+OT | CORE | I03 | 各通道獨立 |
| `TDS.TERM.CH1_IN` | P2 垂直區下方左側 BNC，約 (403,667)，上方印『1』 | 『1』 | BNC 端子；接探棒（J 階段） | 『Input connectors for waveform display.』 | — | 1 MΩ ±2% 並聯 20 pF ±3 pF；300 V RMS CAT II | P2；M-TDS-13 p.18 (PDF 42)；p.107–108 (PDF 131–132) | PH+OT | STATIC | I03/J01 | 單機階段輸入來自儀器外的 fixture（S1/S2/S3）；預留 terminal ID；卡別細節：I03 顯示／J01 接線 |
| `TDS.TERM.CH2_IN` | P2 垂直區下方右側 BNC，約 (484,677)，上方印『2』 | 『2』 | BNC 端子；接探棒（J 階段） | 同 CH1 | — | 同 CH1 | P2；M-TDS-13 p.18 (PDF 42)；p.107–108 (PDF 131–132)（與 TDS.TERM.CH1_IN 相同） | PH+OT | STATIC | I03/J01 | 卡別細節：I03 顯示／J01 接線 |
| `TDS.MISC.INPUT_RATING` | P2 CH1/CH2 BNC 上方橫線標示，延伸到 Ext Trig | 『300 V ⚠ 300V CAT II』（300 V 前有接地／探棒符號） | 固定標籤；無 | 輸入額定標示 | — | 300 V RMS，Installation Category II | P2；M-TDS-13 p.9 (PDF 33) 面板圖；p.108 (PDF 132) | PH+OT | STATIC | I03 | — |

### 水平（Horizontal）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KNOB.HORIZ_POSITION` | P2 水平區上方旋鈕，約 (581,484) | 上方中文『位置』 | 旋鈕；旋轉 | 『Adjusts the horizontal position of all channel and math waveforms.』調整觸發點相對螢幕中央的位置 | graticule 頂端的觸發位置標記；讀值 M Pos 顯示中央刻度相對觸發點的時間（觸發點＝0） | 依 s/div 分段，見 specs；解析度 1/25 div | P2；M-TDS-13 p.11 (PDF 35)；p.14 (PDF 38)；p.23 (PDF 47)；p.86 (PDF 110)；p.110 (PDF 134) | PH+OT | CORE | I03 | 只影響顯示時間窗，不改訊號頻率 |
| `TDS.KEY.HORIZ_MENU` | P2 水平區第一顆鍵，約 (578,525) | 鍵面『Horiz』；左側中文『選單』（手冊圖鍵面為 Horiz Menu） | 按鍵；按一下 | 『Displays the Horizontal Menu.』Main／Window Zone／Window／Set Holdoff | 右側選單；使用 Window 時另有 W 讀值 | — | P2；M-TDS-13 p.14 (PDF 38)；p.48 (PDF 72)；p.86–87 (PDF 110–111)；p.101 (PDF 125) | PH+OT | APPROX | I03 | 只提供 Main（預設）；Window Zone、Window、Holdoff 停用並附範圍說明 |
| `TDS.KEY.SET_TO_ZERO` | P2 水平區第二顆鍵，約 (577,556) | 鍵面『Set to Zero』；左側中文『設置為零』 | 按鍵；按一下 | 『Sets the horizontal position to zero.』 | M Pos 讀值歸零；觸發標記回到中央 | — | P2；M-TDS-13 p.14 (PDF 38)；p.86 (PDF 110) | PH+OT | CORE | I03 | 屬 02 核心『水平位置』的一部分，也是 I03-9 的手動復原路徑 |
| `TDS.KNOB.HORIZ_SCALE` | P2 水平區大旋鈕，約 (577,608) | 上方中文『刻度』 | 旋鈕；旋轉 | 『Selects the horizontal time/division (scale factor) for the main or the window time base.』以螢幕中央為中心縮放；所有通道共用 | 畫面下方主時基讀值（M 100µs 形式） | 5 ns/div–50 s/div，1-2.5-5 序列；≥100 ms/div 且 Auto 時進入 Scan | P2；M-TDS-13 p.14 (PDF 38)；p.22–25 (PDF 46–49)；p.77 (PDF 101)；p.86–87 (PDF 110–111)；p.110 (PDF 134) | PH+OT | CORE | I03 | 停止時縮放已取得的波形（p.87） |

### 水平（Horizontal）區下方

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.TERM.EXT_TRIG` | P2 水平區下方 BNC，約 (572,687) | 上方英文『Ext Trig』 | BNC 端子；接外部觸發（J 階段） | 『Input connector for an external trigger source. Use the Trigger Menu to select the Ext, or Ext/5 trigger source.』 | 觸發訊號不顯示，需按住 Trig View 才看得到 | 觸發位準：Ext ±1.6 V、Ext/5 ±8 V | P2；M-TDS-13 p.18 (PDF 42)；p.97 (PDF 121)；p.111 (PDF 135) | PH+OT | STATIC | I03/J01 | Ext、Ext/5 觸發源本輪不納入；卡別細節：I03 顯示／J01 接線 |

### 觸發（Trigger）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KNOB.TRIG_LEVEL` | P2 觸發區上方旋鈕，約 (679,486) | 上方中文『位準』（手冊 Level） | 旋鈕；旋轉 | 『When you use an Edge or Pulse trigger, the Level knob sets the amplitude level that the signal must cross to acquire a waveform.』 | graticule 右緣的觸發位準標記；畫面下方的觸發位準讀值（例如 0.00V） | 通道觸發源為螢幕中央 ±8 div，解析度 0.02 div；預設 0.00 V | P2；M-TDS-13 p.11–12 (PDF 35–36)；p.15 (PDF 39)；p.21 (PDF 45)；p.100 (PDF 124)；p.111 (PDF 135)；p.128 (PDF 152) | PH+OT | CORE | I03 | — |
| `TDS.KEY.TRIG_MENU` | P2 觸發區第一顆鍵，約 (676,529) | 鍵面『Trig Menu』；左側中文『選單』 | 按鍵；按一下 | 『Displays the Trigger Menu.』Type（Edge/Video/Pulse）、Source、Slope、Mode、Coupling | 右側觸發選單；訊息區『For TRIGGER HOLDOFF, go to HORIZONTAL MENU』 | 見 menus | P2；M-TDS-13 p.12 (PDF 36)；p.15 (PDF 39)；p.96–99 (PDF 120–123) | PH+OT | CORE | I03 | 只有 Edge 為核心 |
| `TDS.KEY.SET_TO_50` | P2 觸發區第二顆鍵，約 (675,561) | 鍵面『Set To 50%』；左側中文『設置為』，下方小字『50%』 | 按鍵；按一下 | 『The trigger level is set to the vertical midpoint between the peaks of the trigger signal.』 | 觸發位準讀值與標記移到觸發訊號最大值和最小值的中點 | 典型最低可用頻率 50 Hz | P2；M-TDS-13 p.15 (PDF 39)；p.100 (PDF 124)；p.111 (PDF 135) | PH+OT | CORE | I03 | 中點由目前觸發源的資料算出 |
| `TDS.KEY.FORCE_TRIG` | P2 觸發區第三顆鍵，約 (675,592) | 鍵面『Force Trig』；左側中文『強制觸發』 | 按鍵；按一下 | 『Completes an acquisition regardless of an adequate trigger signal. This button has no effect if the acquisition is already stopped.』適用於 Single 與 Normal | 出現一次新採集（未觸發） | 停止狀態下無效 | P2；M-TDS-13 p.15 (PDF 39)；p.100 (PDF 124) | PH+OT | CORE | I03 | — |
| `TDS.KEY.TRIG_VIEW` | P2 觸發區第四顆鍵，約 (672,624) | 鍵面『Trig View』；左側中文『觸發監看』 | 按鍵（需按住）；按住 | 『Displays the trigger waveform in place of the channel waveform while you hold down the Trig View button.』手冊說這是唯一需要按住的鍵；按住時除 print 鍵外其他按鍵停用，旋鈕仍有效 | 顯示經觸發耦合處理後的觸發訊號 | — | P2；M-TDS-13 p.15 (PDF 39)；p.18 (PDF 42)；p.100 (PDF 124) | PH+OT | OUT | I03 | 不在 02 核心內；按下顯示範圍說明 |

### 顯示區（Display Area）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.LCD.MAIN` | P2 左側螢幕，約 x 48–275、y 418–612（照片全暗） | 無（螢幕） | LCD；無 | 顯示波形、graticule、右側選單與各種讀值 | 手冊顯示區 17 項：取樣模式圖示、觸發狀態、水平觸發位置標記、中央時間讀值、觸發位準標記、各通道接地參考標記、反相圖示、V/div 讀值、BW 圖示、主時基、視窗時基、觸發源、觸發類型圖示、觸發位準讀值、訊息區、日期時間、觸發頻率 | 320×240 ¼VGA 彩色 TFT；graticule 為 10 × 8 div（PD，見 specs） | P2；M-TDS-13 p.9–12 (PDF 33–36)；p.113 (PDF 137) | PH+OT | CORE | I03 | 照片無法證明 LCD 語言、開機畫面或預設值；字樣暫依手冊英文圖（GAP-TDS-01） |

### 螢幕右側 option 鍵

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.SOFT.OPT1` | P2 螢幕右側方形鍵，由上數第 1 顆，約 (293,443) | 無字 | 軟鍵；按一下 | 『The menu shows the options that are available when you push the unlabeled option buttons directly to the right of the screen.』頂鍵常用來切換子選單頁（例如 Trigger Type）或 CH 選單的 Coupling | 選單格反白或數值改變 | 依目前選單 | P2；M-TDS-13 p.12–13 (PDF 36–37)；p.10 (PDF 34)；p.xvi (PDF 24) | PH+OT | CORE | I03 | 手冊也稱 screen/side-menu/bezel buttons 或 soft keys |
| `TDS.SOFT.OPT2` | P2 由上數第 2 顆，約 (293,477) | 無字 | 軟鍵；按一下 | 依目前選單（例如 CH 選單的 BW Limit、Cursor 選單的 Source、Measure 的 Measure 2） | 同上 | 依選單 | P2；M-TDS-13 p.10 (PDF 34)；p.31 (PDF 55)；p.36 (PDF 60) | PH+OT | CORE | I03 | — |
| `TDS.SOFT.OPT3` | P2 由上數第 3 顆，約 (293,511) | 無字 | 軟鍵；按一下 | 依目前選單（例如 CH 選單的 Volts/Div、Measure 的 Measure 3；Cursor 選單中此格為 Δ 讀值） | 同上 | 依選單 | P2；M-TDS-13 p.10 (PDF 34)；p.31 (PDF 55)；p.36 (PDF 60) | PH+OT | CORE | I03 | — |
| `TDS.SOFT.OPT4` | P2 由上數第 4 顆，約 (293,545) | 無字 | 軟鍵；按一下 | 依目前選單（例如 CH 選單的 Probe、Cursor 選單的 Cursor 1、Measure 的 Measure 4） | 同上 | 依選單 | P2；M-TDS-13 p.10 (PDF 34)；p.31 (PDF 55)；p.36 (PDF 60) | PH+OT | CORE | I03 | — |
| `TDS.SOFT.OPT5` | P2 由上數第 5 顆，約 (293,578) | 無字 | 軟鍵；按一下 | 依目前選單（例如 CH 選單的 Invert、Cursor 選單的 Cursor 2、Measure 的 Measure 5） | 同上 | 依選單 | P2；M-TDS-13 p.10 (PDF 34)；p.31 (PDF 55)；p.36 (PDF 60) | PH+OT | CORE | I03 | — |

### 螢幕右側 option 鍵下方

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.KEY.PROBE_CHECK` | P2 5 顆 option 鍵下方的圓形鍵，約 (288,612)；右側面板邊緣直書『Probe Check』 | 鍵面無字；旁印『Probe Check』 | 按鍵；按一下 | 『To use the Probe Check Wizard, push the PROBE CHECK button.』檢查電壓探棒連接、補償與 Attenuation 設定是否一致；完成後除 Probe 選項外，其餘設定恢復原狀 | 通過時顯示 PASSED，否則顯示指引 | 適用 1X、10X、20X、50X、100X 探棒 | P2；M-TDS-13 p.5–6 (PDF 29–30)；p.91 (PDF 115)；p.9 面板圖 (PDF 33) | PH+OT | OUT | I03 | 不是 Menu On/Off 鍵，原廠手冊沒有 Menu On/Off 鍵。02 規定 Probe Check 全流程不納入 |

### 螢幕框右下（Other Front-Panel Items）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.TERM.PROBE_COMP_SIGNAL` | P2 USB 口右側凹槽內上方金屬片，約 (305,668)；旁邊直書『Probe Comp ~5V@1kHz』與方波符號 | 『Probe Comp ~5V@1kHz』＋方波符號 | 端子（金屬接片）；探棒勾針勾上（J 階段） | 『PROBE COMP. Probe compensation output and chassis reference.』 | — | 典型 5.0 V ±10%（負載 1 MΩ）、1 kHz | P2；M-TDS-13 p.18 (PDF 42)；p.7 (PDF 31)；p.113 (PDF 137) | PH+OT | STATIC | I03/J01 | 上片為訊號、下片為接地，是依標示符號位置判讀（方波在上、接地在下），日後宜打光近拍確認；卡別細節：I03 顯示／J01 接線 |
| `TDS.TERM.PROBE_COMP_GND` | P2 同一凹槽的下方金屬片，約 (305,686)；旁有接地符號 | 接地符號 | 端子（金屬接片）；接探棒接地夾（J 階段） | PROBE COMP 的機殼參考（chassis terminal） | — | — | P2；M-TDS-13 p.7 (PDF 31)；p.18 (PDF 42) | PH+OT | STATIC | I03/J01 | 卡別細節：I03 顯示／J01 接線 |

### 螢幕下方面板

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.PORT.USB_FLASH` | P2 螢幕下方面板右側，約 (256,664) | 『USB Flash Drive』 | USB-A 插口；插入隨身碟 | 『Insert a USB flash drive for data storage or retrieval.』 | 存取中螢幕顯示時鐘符號，完成後顯示提示 | 支援 64 GB 以下 | P2；M-TDS-13 p.18 (PDF 42)；p.63–64 (PDF 87–88) | PH+OT | STATIC | I03 | USB 存取本輪不納入 |
| `TDS.MISC.ASSET_NUMBER` | P2 螢幕下方面板左側 | 手寫『13』 | 非原廠標記；無 | 學校設備編號（推測） | — | — | P2 | PH | STATIC | I03 | 非原廠標示，重現與否由實作者決定，不影響功能 |

### 螢幕上方標示條

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.MISC.MODEL_LABEL` | P2 螢幕上方橫條，約 x 30–285、y 375–395 | 『Tektronix  TDS 2001C  TWO CHANNEL DIGITAL STORAGE OSCILLOSCOPE』，右端深藍底『50 MHz 500 MS/s』 | 固定標籤；無 | 型號與規格標示 | — | — | P2；M-TDS-13 p.1 (PDF 25) | PH+OT | STATIC | I03 | 標示的頻寬與取樣率不等於模擬器實作了該硬體效能 |

### 區塊標題

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.MISC.SECTION_LABELS` | P2 右半面板灰底標題列，以及 Help/Default Setup 的灰底框 | 『垂直』『水平』『觸發』（手冊為 Vertical/Horizontal/Trigger） | 固定標籤；無 | 控制分組 | — | — | P2；M-TDS-13 p.9 (PDF 33) | PH+OT | STATIC | I03 | — |

### 機殼頂部

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.PWR.ON_OFF` | 照片未見（手冊 p.4 圖示 ON/OFF button 位於機殼頂部左側） | 照片未見 | 電源鍵；按一下 | 電源開關（機殼頂部，照片未見）。p.20 (PDF 44)：「The oscilloscope saves the current setup if you wait five seconds after the last change before you power off… recalls this setup the next time you apply power.」 | — | — | M-TDS-13 p.4 (PDF 28) 圖；p.20 (PDF 44)；p.95 (PDF 119) | OT+PD | APPROX | I03 | 模擬「電源關→開」＝保留關機前的設定、清除採集（依 p.20；「等 5 秒才保存」不模擬）。這與其他三台「開機回重設狀態」不同，是依本機手冊。M-TDS-13 p.1 (PDF 25) 另說開機時可選螢幕語言（見 GAP-TDS-25）。 |

### 後面板

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDS.PORT.USB_DEVICE` | 照片未見（手冊：『The USB Device port is on the rear of the oscilloscope.』） | 照片未見 | USB-B 插口；接電腦或 PictBridge 印表機 | PC 通訊、列印 | — | — | M-TDS-13 p.69 (PDF 93) | OT | OUT | I03 | 不屬前面板，只列出以免遺漏；卡別細節：—（本輪不呈現） |

### Tektronix TDS2001C 雙通道數位儲存示波器 核心選單路徑

只列來源有寫的路徑；沒有來源的不補。

| 路徑 | 軟鍵／選項 | 來源 | 證據 | 狀態 | 備註 |
| --- | --- | --- | --- | --- | --- |
| 1（CH1 功能表）→ 右側 CH1 垂直選單 | OPT1 Coupling：每按一次依 DC→AC→Ground 循環；OPT2 BW Limit：20MHz／Off；OPT3 Volts/Div：Coarse／Fine；OPT4 Probe：進入子選單（格內顯示如『10X Voltage』）；OPT5 Invert：On／Off | M-TDS-13 p.10 (PDF 34) 顯示區圖中的 CH1 選單 5 格；p.12–13 (PDF 36–37)『push the 1 (channel 1 menu) button and then push the top option button to cycle through the Vertical (channel) Coupling options』；p.104–105 (PDF 128–129) 選項表 | OT | Coupling CORE；Probe CORE；Volts/Div 的 Coarse CORE、Fine OUT；BW Limit APPROX（只有狀態與 BW 圖示）；Invert OUT | OPT1–OPT5 由 p.10 圖逐格對應。『There is a separate vertical menu for each channel. Each option is set individually for each channel.』 |
| 2（CH2 功能表）→ 右側 CH2 垂直選單 | 與 CH1 相同：OPT1 Coupling／OPT2 BW Limit／OPT3 Volts/Div／OPT4 Probe／OPT5 Invert | M-TDS-13 p.104 (PDF 128)；p.10 (PDF 34) | OT | 同 CH1 | 設定與 CH1 分開保存 |
| 1（或 2）→ OPT4 Probe → Voltage → Attenuation → 用多功能旋鈕選值 → Back | Probe 子選單：Voltage／Current 類型、Attenuation（Voltage）或 Scale（Current）、Back。Attenuation 值 1X、10X、20X、50X、100X、500X、1000X 由多功能旋鈕選取（LED 亮） | M-TDS-13 p.5 (PDF 29)『1 ►Probe ►Voltage ►Attenuation』；p.7 (PDF 31)；p.17 (PDF 41) 旋鈕 Value entry；p.105 (PDF 129) | OT（路徑與可選值）+UN（子選單各項在第幾顆 option 鍵） | Voltage／Attenuation CORE；Current／Scale OUT | 子選單鍵位暫依文字順序由上而下排、Back 放最下（PD，GAP-TDS-02） |
| Trig Menu → OPT1 Type = Edge（頂鍵在 Edge／Video／Pulse 間切換頁面）→ Edge 頁 | OPT1 Type：Edge→Video→Pulse；Edge 頁其餘項目：Source（CH1、CH2、Ext、Ext/5、AC Line）、Slope（Rising、Falling）、Mode（Auto、Normal）、Coupling（AC、DC、Noise Reject、HF Reject、LF Reject） | M-TDS-13 p.12 (PDF 36)『when you push the top button in the Trigger Menu, the oscilloscope cycles through the Edge, Video, and Pulse Width trigger submenus』；p.13 (PDF 37) 圖；p.96 (PDF 120) Edge 表；p.16 (PDF 40) Edge 時可用旋鈕選 Source；p.41 (PDF 65)『Push Slope ►Rising』 | OT（項目與可選值）+PD（Source／Slope／Mode／Coupling 分別對應 OPT2–OPT5，依 p.96 表列順序推定） | Type=Edge CORE；Source 的 CH1/CH2 CORE、Ext/Ext5/AC Line OUT；Slope CORE；Mode CORE；Coupling 的 DC CORE、AC APPROX、其餘 OUT；Video/Pulse OUT | 觸發耦合只影響觸發訊號（p.21、p.98）。未納入值的處理見 GAP-TDS-17 |
| Measure → OPTn（Measure n；由上而下 n=1…5）→ Measure n 選單：Source → CH1/CH2；Type → Freq／Period／Pk-Pk（也可用多功能旋鈕）→ Back | 頂層：OPT1＝Measure 1（top）、OPT2＝Measure 2（second from top）、OPT3＝Measure 3（middle）、OPT4＝Measure 4（second from bottom）、OPT5＝Measure 5（bottom），每格顯示 Source／Type／Value。子選單：Source、Type、Back | M-TDS-13 p.31 (PDF 55) 步驟 1–16；p.33–34 (PDF 57–58)『Push Source ►CH1』『Push Type ►Pk-Pk』與圖；p.16 (PDF 40) Measure Type 可用旋鈕；p.89 (PDF 113) | OT（頂層鍵位、類型）+UN（子選單內 Source／Type／Back 的鍵位） | CORE：Freq、Period、Pk-Pk、None；其他 13 種 OUT | Default Setup 後所有量測為 Source CH1、Type None（p.127） |
| Cursor → OPT1 Type → OPT2 Source → OPT4 Cursor 1（旋鈕移動）→ OPT5 Cursor 2（旋鈕移動） | OPT1 Type：Time／Amplitude／Off；OPT2 Source：CH1、CH2（2 通道機另有 MATH、REFA、REFB）；OPT3 Δ 讀值格（Time：Δt、1/Δt、ΔV；Amplitude：ΔV）；OPT4 Cursor 1（位置讀值）；OPT5 Cursor 2（位置讀值） | M-TDS-13 p.36 (PDF 60) 步驟與側選單圖；p.37–39 (PDF 61–63)；p.82–83 (PDF 106–107) | OT | CORE（Time、Amplitude、Off；Source CH1/CH2）；MATH/REF 來源 OUT | 按 OPT3 有無作用手冊未載，暫定只是讀值格（PD） |
| AutoSet →（依偵測到的訊號）右側 AutoSet 選單 | 正弦：Multi-cycle sine、Single-cycle sine、FFT、Undo Autoset；方波／脈波：Multi-cycle square、Single-cycle square、Rising edge、Falling edge、Undo Autoset；Video：Fields ►All Fields、Lines ►All Lines、Lines ►Number、Odd Fields、Even Fields、Undo Autoset | M-TDS-13 p.80–82 (PDF 104–106)；p.44 (PDF 68)『Push the single cycle option button in the AutoSet Menu』 | OT（選項）+UN（鍵位與按下後預設選中哪一項） | Multi-cycle 為 AutoSet 後的預設呈現 CORE（預設選中為 PD）；Undo Autoset APPROX；其餘 OUT | Undo Autoset：『Causes the oscilloscope to recall the previous setup』 |
| Acquire → Sample／Peak Detect／Average（Radio）→ Averages | OPT1 Sample、OPT2 Peak Detect、OPT3 Average（p.13 圖 Radio 例）；Averages：4、16、64、128 | M-TDS-13 p.13 (PDF 37)；p.75–76 (PDF 99–100) | OT（前 3 格依圖）+UN（Averages 鍵位） | APPROX：Sample 固定；Peak Detect、Average、Averages OUT | — |
| Horiz → Main／Window Zone／Window／Set Holdoff | 選項名稱依 p.86 表；鍵位未載 | M-TDS-13 p.86 (PDF 110)；p.48 (PDF 72)；p.101 (PDF 125)『Horiz ►Set Trigger Holdoff』 | OT+UN | Main APPROX；其餘 OUT | Appendix E 另列『Trig Knob: Level』，與 p.86 表不一致（見 discrepancies） |
| Default Setup（無側選單） | 無；訊息區顯示『Default setup recalled』 | M-TDS-13 p.12 (PDF 36)；p.127–128 (PDF 151–152) | OT+PD+UN | CORE | 「鍵本身不開自己的選單」由 p.17 推論（PD）；按下後原本的側選單保留或清除 UN，併入 GAP-TDS-04 到校驗證。 |
| Run/Stop；Single（無側選單） | 無；以觸發狀態圖示回饋（Stop、Acq. Complete、Ready、Trig'd、Auto） | M-TDS-13 p.11 (PDF 35)；p.77 (PDF 101) | OT+PD+UN | CORE | 「鍵本身不開自己的選單」由 p.17 推論（PD）；按下後原本的側選單保留或清除 UN，併入 GAP-TDS-04 到校驗證。 |
| Set To 50%；Force Trig；Set to Zero（直接動作鍵，無側選單） | 無 | M-TDS-13 p.14–15 (PDF 38–39)；p.86 (PDF 110)；p.100 (PDF 124) | OT+PD+UN | CORE | 「鍵本身不開自己的選單」由 p.17 推論（PD）；按下後原本的側選單保留或清除 UN，併入 GAP-TDS-04 到校驗證。 |
| Math（只列頂層） | Operation（+、-、×、FFT）、Sources、Position、Vertical Scale | M-TDS-13 p.87–88 (PDF 111–112) | OT | OUT | — |
| Save/Recall（只列頂層） | Action：Save All、Save Image、Save Setup、Save Waveform、Recall Setup、Recall Waveform | M-TDS-13 p.91–95 (PDF 115–119) | OT | OUT | — |
| Ref（只列頂層） | RefA、RefB | M-TDS-13 p.91 (PDF 115) | OT | OUT | — |
| Utility（只列頂層） | System Status、Options、Error Log、Do Self Cal、File Utilities、Language、Data Logging、Limit Test | M-TDS-13 p.101–104 (PDF 125–128)；p.52–54 (PDF 76–78) | OT | OUT | Data Logging、Limit Test 註明 TDS1000C-EDU 不提供；TDS2001C 屬 TDS2000C，有此功能，但本輪不納入 |
| Display（只列頂層） | Type（Vectors、Dots）、Persist（OFF、1 sec、2 sec、5 sec、Infinite）、Format（YT、XY） | M-TDS-13 p.83–85 (PDF 107–109) | OT | OUT | — |
| Help（只列頂層） | Index、Show Topic、Back、Page Up、Page Down、Exit | M-TDS-13 p.xiv (PDF 22) | OT | OUT | — |
| AutoRange（只列頂層） | Autoranging、Vertical and Horizontal、Vertical Only、Horizontal Only、Undo Autoranging | M-TDS-13 p.77–78 (PDF 101–102) | OT | OUT | — |
| Trig Menu → Type = Video／Pulse（只列頂層） | Video：Source、Polarity、Sync、Standard；Pulse：Source、When、Pulse Width、Polarity、Mode、Coupling、More | M-TDS-13 p.98–99 (PDF 122–123) | OT | OUT | — |
| PROBE CHECK（精靈，只列頂層） | 依螢幕指示 | M-TDS-13 p.5–6 (PDF 29–30) | OT | OUT | — |
| PRINT（儲存）鍵（只列頂層） | 經由 Save/Recall ►Save All ►PRINT Button，或 Utility ►Options ►Printer Setup 設定 | M-TDS-13 p.67 (PDF 91)；p.73 (PDF 97)；p.90 (PDF 114) | OT | OUT | — |

## 3. GW Instek GPE-4323 四路直流電源供應器（原版，非 A 版）（P1 下層，I04）

**照片核對：** 型號：P1 下層面板左上印「GW INSTEK」「GPE-4323」，右側「DC Power Supply」「32 V 3 A」（與 M-GPE p.15 圖相同）。LCD：左側大窗（約 x100–350, y675–825）全暗，看不到任何圖示/數字。通道：CH1、CH2 黑底白字標頭在旋鈕區頂；CH3、CH4 只見於端子與旋鈕標籤，共四路。旋鈕：共 6 顆（左欄 3、右欄 3）。標籤印在各旋鈕上方（M-GPE p.15 圖 callout 佐證："CH1 Voltage Knob" 指左上、"CH1 Current Knob" 指左中、"CH4 Voltage Knob" 指左下；右欄同理 CH2 Voltage/CH2 Current/CH3 Voltage）。照片可讀：左欄「Voltage」「Current」「C…age」（中段被中間旋鈕遮住）；右欄「Voltage」「Current」「CH3 …ge」。分隔弧線繞過兩顆 Current 旋鈕下緣，上區為 CH1/CH2 V/I＋模式鍵，下區為 CH4/CH3 Voltage＋顯示切換＋Set View＋On/Off，與手冊圖一致。按鍵：模式鍵 2 顆（鍵上無字，框內圖例 Series/Parallel/Independent，每列左右各一個鍵狀態小圖示：Series 左高右低、Parallel 左右皆低、Independent 左右皆高）；「CH1/CH4」「CH2/CH3」各 1；「Set View」1（鍵下「LOCK」加底線、部分被鍵帽遮住；左下圖例「— : Long Push」）；「On / Off」1（綠色鍵帽，無法判斷是否點亮）；POWER 圓鍵 1（左下，上印「POWER」，右下可見「■ ○」，左側「▁ I」被鍵遮住）。端子：下排共 9 個，左→右：CH4＋（白帽紅環）、CH4−（白帽黑環）［下印「0 - 15…」］、CH1＋（紅）、CH1−（黑）［「0 - 32V」「3A」⚠「MAST…」］、GND（綠）［接地符號］、CH2＋（紅）、CH2−（黑）［「0 - 32V」「3A」⚠「SLAV…」］、CH3＋（紅）、CH3−（黑）［「5V , 1…」］。上方「+ CH4」「+ CH1」「GND」字跡淡且被端子頭遮擋；「+ CH2 −」「+ CH3 −」清楚。藍色色帶可見「PA…」「OUTP…」「OUTP…」，完整字樣依手冊 p.15 圖為「+ COM SERIES OUTPUT −」「+ − PARALLEL OUTPUT」。沒有的：CH3/CH4 電流旋鈕、數字鍵盤、螢幕軟鍵、USB/LAN 等前面板埠、sense 端子（GPE-1326 才有）、coarse/fine 旋鈕（GPE-1326）、GPE-3323 的固定 5 V 端子標示。LCD 下緣兩個小白點經放大為灰塵/反光，不列控制項。照片不能證明任何 LCD 內容、指示燈亮滅、模式鍵當下是否按下、開機值。；端子帽本體都是白色，只有一圈紅／黑／綠色環（驗證者放大確認，手冊 p.32 立體圖同）。

**頁碼對照：** M-GPE 共 49 頁 PDF。PDF 第 1 頁（封面）與第 2 頁（版權頁）無印刷頁碼；自 PDF 第 3 頁（目錄，頁尾印「3」）起，印刷頁＝PDF 頁序，無偏移。實際核對例：PDF 15 頁首印「15」且為 Front Panel Overview；PDF 25 印「25」為 Output On/Off；PDF 27 印「27」為 Setting Voltage Lock from Front Panel；PDF 37 印「37」為 CH1/CH2 Series Tracking Mode；PDF 45、46 印「45」「46」為 Specifications；目錄（PDF 3–4）所列章節頁碼與正文一致。引用格式一律「M-GPE p.N (PDF N)」。注意手冊內部交叉引用有誤：p.21 寫遠端端子 "see page 29"，實際在 p.30；索引 p.48 寫 "Front panel Overview ... 16"（實際 15）、"tracking mode parallel ... 27, 29, 30"（實際 41）——一律以正文頁為準。P1 照片：768×1024 原圖，文中座標為原圖像素的近似中心 (x,y)；GPE-4323 位於約 x60–625、y620–985。

### CH1 控制（旋鈕區左欄上區）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.KNOB.CH1_VOLTAGE` | P1 下層 GPE 旋鈕區左欄第 1 顆（約 x433,y708），CH1 標頭下 | Voltage（印在旋鈕右上方；CH1 標頭之下） | 旋鈕（旋轉式；編碼器或電位器未證實）；旋轉；順時針增加為暫定（PD） | Independent：設定 CH1 電壓設定值 V1set（p.32 "Use the voltage and current knob to set the CH1 output voltage and current."）。Series：設定 master 與 slave 共同電壓（p.40 "Use the CH1 voltage knob to set the master & slave output voltage (the same level for both channels)."）。Parallel：設定合併輸出電壓（p.42 "Use the CH1 voltage and current knobs to set the output voltage and current."）。Lock 時被鎖（p.27 "lock the voltage knob operation for CH1 & CH2"）。 | LCD 第一列顯示 ① 時的電壓欄：Output OFF 顯示設定值（暫定，依 p.23 開機後 "showing settings for each channel"）；Output ON 顯示讀回，按 Set View 看設定（p.19）。LCD 切到 ④ 時轉動不應改 CH4。 | Independent/Parallel 0–32 V（p.31、p.45）；Series 合併 0–64 V（p.37、p.45）；顯示解析 10 mV（4 位）或 100 mV（3 位）（p.45）；旋鈕每格步進／加速未找到（UN） | M-GPE p.15 (PDF 15)、M-GPE p.18 (PDF 18)、M-GPE p.27 (PDF 27)、M-GPE p.31 (PDF 31)、M-GPE p.32 (PDF 32)、M-GPE p.40 (PDF 40)、M-GPE p.42 (PDF 42)、M-GPE p.45 (PDF 45)；P1 | PH+OT+UN+PD | CORE | I04 | 手冊 p.15 圖 callout "CH1 Voltage Knob" 指向左上旋鈕，確認標籤在旋鈕上方。旋鈕歸屬固定 CH1，與 CH1/CH4 顯示切換無關。上限是 32.00 V 還是可到顯示滿刻度 33.00 V 未證實（見 GAP-GPE-03）。；證據細節：PH+OT；步進 UN；方向 PD |
| `GPE.KNOB.CH1_CURRENT` | P1 下層 GPE 左欄第 2 顆（約 x428,y772） | Current（印在此旋鈕上方、上一顆旋鈕之下） | 旋鈕；旋轉 | Independent：設定 CH1 限流 I1set（p.32）。Series：設定 master 輸出電流（p.40 "Use the CH1 current knob to set the master output current."）。Parallel：與 CH1 Voltage 一起設定合併輸出（p.42）。CV 時實際電流由負載決定，達 I1set 轉 CC（p.22）。 | LCD ① 列電流欄：Output ON 為讀回電流（非 I1set）；看 I1set 需 Output OFF 或 Set View（p.17、p.19）。 | 0–3 A（p.31、p.45）；Parallel 合併 0–6 A（p.41、p.45）；顯示解析 1 mA（4 位）或 10 mA（3 位）（p.45）；步進 UN | M-GPE p.15 (PDF 15)、M-GPE p.18 (PDF 18)、M-GPE p.22 (PDF 22)、M-GPE p.31 (PDF 31)、M-GPE p.32 (PDF 32)、M-GPE p.40 (PDF 40)、M-GPE p.42 (PDF 42)、M-GPE p.45 (PDF 45)；P1 | PH+OT+UN | CORE | I04 | Lock 是否也鎖電流旋鈕：p.27 只寫 voltage knob，p.19 寫 panel keys（見 GAP-GPE-01）。；證據細節：PH+OT；步進 UN |

### CH4 控制（旋鈕區左欄下區）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.KNOB.CH4_VOLTAGE` | P1 下層 GPE 左欄第 3 顆（約 x425,y833），CH1/CH4 鍵左側 | 照片可見「C…age」（中段被中間旋鈕遮住）；M-GPE p.15 圖印「CH4 Voltage」 | 旋鈕；旋轉 | 設定 CH4 電壓 V4set（p.18 CH3/CH4 "Sets the voltage for the GPE-4323."；p.35 "Use the voltage knobs to set the voltage."）。不參與 tracking（p.35 "CH4 doesn't have series/parallel tracking mode. The CH4 output is not affected by the CH1 and CH2 modes."）。 | LCD 第一列切到 ④ 時可見（p.35 "You can use the CH1/CH4 key to toggle to CH4(④ appears on the LCD display) to check the setting value."）。 | 0–15 V（p.35、p.45）；電流 1 A max，無電流旋鈕（p.35、p.18）；步進 UN | M-GPE p.15 (PDF 15)、M-GPE p.18 (PDF 18)、M-GPE p.35 (PDF 35)、M-GPE p.36 (PDF 36)、M-GPE p.45 (PDF 45)；P1 | PH+OT | CORE | I04 | 不得增加 CH4 電流旋鈕。1 A 為額定值，不當成精準保護門檻（02）。；證據細節：PH（部分被遮）+OT |

### CH2 控制（旋鈕區右欄上區）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.KNOB.CH2_VOLTAGE` | P1 下層 GPE 右欄第 1 顆（約 x580,y722），CH2 標頭下 | Voltage（印在旋鈕左上方；CH2 標頭之下） | 旋鈕；旋轉 | Independent：設定 CH2 電壓 V2set（p.32 "Use the voltage and current knob to set the CH2 output voltage and current."）。Series：手冊未寫 CH2 Voltage 是否有效；只寫 CH1 Voltage 設定 master & slave 同電壓（p.40）→ 暫定無效（PD）。Parallel：無效（p.42 "CH2 control function is disabled."）。Lock 時被鎖（p.27）。 依據：p.11、p.37「CH1 (Master) controls the combined output voltage/current level」、p.41；三處都沒寫轉 CH2 Voltage 的效果，所以仍為 PD。 | LCD 第二列顯示 ② 時電壓欄；Series/Parallel 下轉動不改變輸出（暫定），設定值是否仍被記錄未證實。 | 0–32 V（p.31、p.45）；步進 UN | M-GPE p.15 (PDF 15)、M-GPE p.18 (PDF 18)、M-GPE p.27 (PDF 27)、M-GPE p.32 (PDF 32)、M-GPE p.11 (PDF 11)、M-GPE p.37 (PDF 37)、M-GPE p.40 (PDF 40)、M-GPE p.41 (PDF 41)、M-GPE p.42 (PDF 42)、M-GPE p.45 (PDF 45)；P1 | PH+OT+PD | CORE | I04 | Series 下 CH2 Voltage 行為見 GAP-GPE-08。；證據細節：PH+OT；Series 下行為 PD |
| `GPE.KNOB.CH2_CURRENT` | P1 下層 GPE 右欄第 2 顆（約 x575,y790） | Current（印在此旋鈕上方） | 旋鈕；旋轉 | Independent：設定 CH2 限流 I2set（p.32）。Series：設定 slave 電流（p.40 "Use the CH2 current knob to set the slave output current."；無共地接法 p.38 "Use the current knob to set the CH2 output current to the maximum level."）。Parallel：無效（p.42 "CH2 control function is disabled."）。 | LCD ② 列電流欄；Output ON 顯示讀回，Set View 顯示設定。 | 0–3 A（p.31、p.45）；步進 UN | M-GPE p.15 (PDF 15)、M-GPE p.18 (PDF 18)、M-GPE p.32 (PDF 32)、M-GPE p.38 (PDF 38)、M-GPE p.40 (PDF 40)、M-GPE p.42 (PDF 42)、M-GPE p.45 (PDF 45)；P1 | PH+OT | CORE | I04 | Series 合併限流與 I1set/I2set 的關係為教學模型（見 GAP-GPE-11）。 |

### CH3 控制（旋鈕區右欄下區）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.KNOB.CH3_VOLTAGE` | P1 下層 GPE 右欄第 3 顆（約 x570,y850），On/Off 鍵右側 | 照片可見「CH3 …ge」（中段被中間旋鈕遮住）；M-GPE p.15 圖印「CH3 Voltage」 | 旋鈕；旋轉 | 設定 CH3 電壓 V3set（p.33 "For GPE-4323: Use the voltage knobs to set the voltage."）。不參與 tracking（p.33 "CH3 doesn't have series/parallel tracking mode. Also, the CH3 output is not affected by the CH1 and CH2 modes."）。 | LCD 第二列切到 ③ 時可見（p.34 "You can check the setting of the GPE-4323 by using the CH2/CH3 key to toggle to CH3(③ appears on the LCD display)."）。 | 0–5 V，1 A max（p.33、p.45 "0~5V, 1A(GPE-4323)"）；步進 UN | M-GPE p.15 (PDF 15)、M-GPE p.18 (PDF 18)、M-GPE p.33 (PDF 33)、M-GPE p.34 (PDF 34)、M-GPE p.45 (PDF 45)；P1 | PH+OT | CORE | I04 | 不可用 GPE-3323 的固定 5 V/5 A、5.2 A OverLoad 規則。不得增加 CH3 電流旋鈕。；證據細節：PH（部分被遮）+OT |

### CH1/CH2 模式鍵（Independent/Series/Parallel）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.KEY.TRACK_LEFT` | P1 下層 GPE 旋鈕區中上圖例框內左鍵（約 x482,y733） | 鍵上無字；所屬框內圖例「Series」「Parallel」「Independent」（左側小圖示：Series 高、Parallel 低、Independent 高） | 按鍵（圖例以鍵高低表示按下／彈起，推論為可保持按下的自鎖鍵，PD）；按一下切換本鍵按下／彈起（PD） | 與右鍵組合決定 CH1/CH2 模式（p.25 "You can toggle the connection mode of CH1/ CH2 by using different combinations of the mode selection key."）：兩鍵皆按下＝Parallel（p.26 "Toggle to parallel mode when both keys are pressed."）；左鍵未按＋右鍵按下＝Series（p.26 "Right key is pressed and the left key is not pressed in series mode."）；Independent：p.25 "For the independent mode, the right key is not pressed"，圖示兩鍵皆彈起。Output ON 時換模式自動關 Output（p.25）。 | LCD 狀態區 SER／PARA 圖示（p.26 "the corresponding series or parallel icon appears on the LCD display."）；兩者皆滅＝Independent（p.31 "both the SER and PARA icons are off"）；Output 若原為 ON 變 OFF（ON/OFF 圖示、On/Off 鍵燈）。 | 按下／彈起兩態 | M-GPE p.11 (PDF 11)、M-GPE p.18 (PDF 18)、M-GPE p.25 (PDF 25)、M-GPE p.26 (PDF 26)、M-GPE p.31 (PDF 31)、M-GPE p.37 (PDF 37)、M-GPE p.41 (PDF 41)；P1 圖例 | PH+OT+PD | CORE | I04 | 圖示判讀：高方塊＝彈起、低扁方塊＝按下（以 p.26 Series 文字「右按左未按」對應 Series 圖示「左高右低」反推）。照片圖例與手冊 p.25 圖示一致。手冊有時稱單一 "TRACKING key"（p.11）或 "Series/Parallel key"（p.31、37、41），見 discrepancies。；證據細節：PH+OT；自鎖機構 PD；「左按下＋右彈起」組合 PD |
| `GPE.KEY.TRACK_RIGHT` | P1 下層 GPE 旋鈕區中上圖例框內右鍵（約 x525,y737） | 鍵上無字；圖例右側小圖示：Series 低、Parallel 低、Independent 高 | 按鍵（推論自鎖，PD）；按一下切換本鍵按下／彈起（PD） | 同 GPE.KEY.TRACK_LEFT：右鍵按下＋左鍵彈起＝Series；兩鍵按下＝Parallel；兩鍵彈起＝Independent（p.25–26）；左按下＋右彈起暫定 Independent（PD）。Output ON 時換模式自動關 Output（p.25 "Change the operation mode between independent / series tracking / parallel tracking"）。 | LCD SER／PARA 圖示；Output 自動 OFF。 | 按下／彈起兩態 | M-GPE p.25 (PDF 25)、M-GPE p.26 (PDF 26)、M-GPE p.37 (PDF 37)、M-GPE p.41 (PDF 41)；P1 圖例 | PH+OT+PD | CORE | I04 | 不可做成三顆獨立的 Independent/Series/Parallel 大按鈕（02）。 自鎖機構與第四組合都是推論（GAP-GPE-07）。 |

### LCD 顯示切換

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.KEY.CH1_CH4` | P1 下層 GPE 旋鈕區中段左鍵（約 x477,y803） | CH1/CH4 | 按鍵（瞬時）；短按 | LCD 第一列在 CH1 與 CH4 之間切換（p.26 "Press the CH1/4 key to toggle between CH1 and CH4. The activated channel will be shown on the channel indicator."）。只切顯示，不改旋鈕所屬通道；四路設定分開保存（02 規則；p.18 "Views the channel settings or readback values"）。 | LCD 通道指示 ① ⇔ ④（p.26）；該列 V/A 與 CV/CC 圖示隨所選通道（p.17）。 | CH1 / CH4 兩態 | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.18 (PDF 18)、M-GPE p.26 (PDF 26)、M-GPE p.35 (PDF 35)；P1 | PH+OT | CORE | I04 | p.18 正文誤寫 "CH1/3 and CH2/4"，照片與 p.15、p.26、p.35 為 CH1/CH4；依照片。開機時預設顯示哪一通道未寫（暫定 ①、②，見 GAP-GPE-10）。 |
| `GPE.KEY.CH2_CH3` | P1 下層 GPE 旋鈕區中段右鍵（約 x518,y808） | CH2/CH3 | 按鍵（瞬時）；短按 | LCD 第二列在 CH2 與 CH3 之間切換（p.26 "Press the CH2/3 key to toggle between CH2 and CH3."）。只切顯示。 | LCD 通道指示 ② ⇔ ③（p.26）。 | CH2 / CH3 兩態 | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.18 (PDF 18)、M-GPE p.26 (PDF 26)、M-GPE p.34 (PDF 34)；P1 | PH+OT | CORE | I04 | 同上；p.18 寫 "CH2/4" 為誤植。 |

### 設定查看／Lock

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.KEY.SET_VIEW` | P1 下層 GPE 旋鈕區左下（約 x463,y865），CH4 Voltage 旋鈕右下 | 鍵上方「Set View」；鍵下方「LOCK」加底線（部分被鍵帽遮住）；左側圖例「— : Long Push」（底線＝長按） | 按鍵（短按／長按雙功能）；短按：查看設定；長按 >2 s：Lock／Unlock | 短按：Output ON 時顯示各通道 V/I 設定值（p.19 "When the output is ON, you can view the voltage/current settings of each channel by pressing this key. The corresponding channel will be displayed on the LCD display."）。長按：Lock（p.27 "Press the LOCK key (for more than 2 seconds) to lock the voltage knob operation for CH1 & CH2"；p.19 "Press and hold the key to lock and unlock the panel keys (except OUTPUT)."）；Unlock 時 Output 關閉（p.27）。開機組合用途（p.27–29）屬本輪未納入。 | LCD「Set」圖示（p.17 "View setting value"）；Lock 圖示亮／滅（p.27）；Unlock 時 OFF 圖示、On/Off 鍵燈滅。 | 長按門檻 >2 s（p.27）；Set View 顯示多久／如何返回：未找到（UN） | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.19 (PDF 19)、M-GPE p.25 (PDF 25)、M-GPE p.27 (PDF 27)、M-GPE p.28 (PDF 28)、M-GPE p.29 (PDF 29)、M-GPE p.43 (PDF 43)；P1 | PH+OT+UN | APPROX | I04 | p.15 面板圖印「V/I Check」，照片、p.19 圖示、p.27–29 正文皆為「Set View」；依照片。Lock 範圍與 Set View 返回時機見 GAP-GPE-01/02；UI 需在儀器外標示近似。；證據細節：PH+OT；返回時機 UN；Lock 範圍 UN（段落不一致） |

### 輸出

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.KEY.OUTPUT_ON_OFF` | P1 下層 GPE 旋鈕區右下（約 x523,y870），綠色鍵帽 | On / Off（鍵帽綠色） | 按鍵（瞬時，內含燈）；短按 | 一鍵開／關全部通道輸出（p.25 "Press the Output key to turn on all outputs in each channel." "Push the Output key again to turn off all outputs. The OFF icon will become lit on the LCD display."）。不受 Lock 影響（p.27 "The OUTPUT key is not affected by the lock operation."；p.43）。開機預設 OFF（p.28）。 | ON：按鍵亮、LCD ON 圖示、各通道 CV/CC 圖示（p.32 "The Output key will be lit and the ON icon will appear on the LCD display. The CV or CC icon appears on the LCD to indicate the output status for each channel."）；OFF：OFF 圖示，CV/CC 圖示熄（p.17）。設定值保留。 | ON / OFF | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.19 (PDF 19)、M-GPE p.25 (PDF 25)、M-GPE p.27 (PDF 27)、M-GPE p.28 (PDF 28)、M-GPE p.32 (PDF 32)、M-GPE p.43 (PDF 43)；P1 | PH+OT | CORE | I04 | 手冊稱 Output key／OUTPUT key／ON/OFF key，面板實印「On / Off」。開機時按住此鍵可設定開機輸出狀態（p.27–28），本輪未納入。 |
| `GPE.LED.OUTPUT_KEY` | P1 下層 GPE On / Off 鍵本體（約 x523,y870） | 無獨立標籤（屬 On / Off 鍵） | 按鍵背光／指示燈；無（跟隨 Output 狀態） | Output ON 時按鍵亮（p.32、p.34、p.36、p.38、p.40、p.42 "The Output key will be lit."）；p.25/p.32 圖示 OFF 為灰框、ON 為綠框。 | 亮＝Output ON；滅＝Output OFF。 | 亮／滅 | M-GPE p.25 (PDF 25)、M-GPE p.32 (PDF 32)、M-GPE p.34 (PDF 34)、M-GPE p.36 (PDF 36)；P1 | OT+PH | CORE | I04 | 照片的綠色是鍵帽顏色，不能當成 Output ON 的證據。燈與 LCD ON/OFF 圖示須來自同一狀態。；證據細節：OT；PH 只能看到綠色鍵帽，看不出是否點亮 |

### 電源

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.PWR.POWER` | P1 下層 GPE 左下角圓鍵（約 x107,y885） | POWER（鍵上方）；鍵右下「■ ○」（左側「▁ I」被鍵遮住，p.15/p.19 圖有） | 電源鍵（按壓式）；按下開機，再按關機 | 主電源開／關（p.19 "Turns On or Off the main power."；p.23 "Press the power switch to turn on the power. The display will first display all the LCD segments before showing settings for each channel." "Press the power switch again to turn off the power."）。 | 開機：LCD 全段短暫亮起後顯示各通道設定；Output 預設 OFF（p.28）。關機：LCD 全暗、無輸出。 | ON / OFF | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.23 (PDF 23)、M-GPE p.28 (PDF 28)；P1 | PH+OT+UN | APPROX | I04 | 電源開關與 Output 是不同狀態。開機後設定值是否沿用上次（記憶）未寫，暫定見 GAP-GPE-05。；證據細節：PH+OT；全段顯示時長與設定值是否斷電記憶 UN |

### LCD

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.LCD.MAIN` | P1 下層 GPE 左側大 LCD 視窗（約 x100–350, y675–825） | 照片未見（LCD 全暗；只確認視窗位置與外框） | LCD（4.3" single color）；無（顯示） | 兩列顯示：第一列 CH1/CH4、第二列 CH2/CH3 的電壓與電流（p.16 Voltmeter/Ammeter "GPE-4323: CH1/CH4 and CH2/CH3"；p.26 "The voltage and current settings and readback values for 2 channels can be displayed on the LCD display simultaneously."）；下方狀態區 SER PARA OTP Lock 與 ON OFF（p.15–16）。 | 開機先全段亮再顯示設定（p.23）。 | Voltmeter 33.00 V full scale、Ammeter 3.200 A full scale，4 或 3 位（p.46）；預設 4 位（p.29） | M-GPE p.15 (PDF 15)、M-GPE p.16 (PDF 16)、M-GPE p.23 (PDF 23)、M-GPE p.26 (PDF 26)、M-GPE p.29 (PDF 29)、M-GPE p.46 (PDF 46)；P1 | PH+OT | CORE | I04 | LCD 圖為系列通用圖，含 OVP/OCP/OTP 與 GPE-3323 CH3 列，不代表 GPE-4323 全部可用。數字前導零／小數點位置未證實（GAP-GPE-10）。；證據細節：PH（位置）+OT（內容） |
| `GPE.LCD.ROW1_CH_IND` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第一列最左 | 照片未見（LCD 全暗）；手冊圖為圓圈數字 ①／④ | LCD 圖示；無 | 指示第一列目前顯示的是 CH1 或 CH4（p.17 "Channel indicator ① ② ③ ④ Indicates the currently selected channel."；p.26）。 | 按 CH1/CH4 鍵時 ① ⇔ ④。 | ① 或 ④ | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.26 (PDF 26) | OT+PD | CORE | I04 | p.15 LCD 圖在兩個圓圈數字之間另印「Set」／「Out」。推論（PD）：疑為 GPE-1326 的設定／讀回列標示，GPE-4323 不使用，保持暗段；手冊沒有明說。 |
| `GPE.LCD.ROW1_VOLTAGE` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第一列左半「8.8.8.8 V」 | 照片未見（LCD 全暗）；手冊圖「8.8.8.8V」 | LCD 七段數字＋單位 V；無 | 顯示第一列所選通道電壓：Output ON 為讀回（Voltmeter "Displays output voltage of each channel." p.16）；Set View 時顯示設定（p.19）；Output OFF 顯示設定（暫定，p.23）。 | 隨旋鈕、負載、模式、Output 更新。 | 0–33.00 V 顯示滿刻度；4 位 10 mV／3 位 100 mV（p.45–46） | M-GPE p.15 (PDF 15)、M-GPE p.16 (PDF 16)、M-GPE p.19 (PDF 19)、M-GPE p.23 (PDF 23)、M-GPE p.45 (PDF 45)、M-GPE p.46 (PDF 46) | OT+PD | CORE | I04 | 顯示解析度≠精度（p.46 accuracy ±(0.1%+30mV)），亦不一定等於旋鈕最小步進。Series 無共地時合併電壓需學生自行 ×2（p.38），面板不顯示合併值。；證據細節：OT；OFF 時顯示內容 PD |
| `GPE.LCD.ROW1_CURRENT` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第一列右半「8.8.8.8 A」 | 照片未見（LCD 全暗）；手冊圖「8.8.8.8A」 | LCD 七段數字＋單位 A；無 | 顯示第一列所選通道電流：Output ON 為負載實際電流讀回（p.16 Ammeter "Displays output current of each channel."；p.22 CV 時 "the Current level fluctuates according to the load condition"）；Set View 顯示 I-set（p.19）。 | 無負載時讀回 0（不是 I-set）；CC 時等於 I-set。 | 0–3.200 A 顯示滿刻度；4 位 1 mA／3 位 10 mA（p.45–46） | M-GPE p.16 (PDF 16)、M-GPE p.19 (PDF 19)、M-GPE p.22 (PDF 22)、M-GPE p.45 (PDF 45)、M-GPE p.46 (PDF 46) | OT+PD | CORE | I04 | CH3/CH4 顯示電流讀回（p.16 Ammeter 列出 CH1/CH4、CH2/CH3），但其 Set View 時電流欄內容未寫（GAP-GPE-09）。Parallel 時 CH1 電流讀數為總電流的一半（p.42）。；證據細節：OT；無負載讀回 0 為 PD（依 p.22 推論） |
| `GPE.LCD.ROW1_SET_ICON` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第一列上方「Set」 | 照片未見（LCD 全暗）；手冊圖「Set」 | LCD 圖示；無 | 表示正在顯示設定值（p.17 "View setting value [Set] When output is ON, you can view the voltage/ current setting value depending on the channel be selected."）。 | Set View 短按時亮；返回時機 UN。 | 亮／滅 | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.19 (PDF 19) | OT+PD+UN | APPROX | I04 | p.17 只說有「View setting value」圖示；GPE-4323 按 Set View 時亮的是哪一個 Set 段屬推論（PD），Output OFF 時是否亮 UN（GAP-GPE-02）。 |
| `GPE.LCD.ROW1_CV_CC` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第一列上方「CV」「CC」 | 照片未見（LCD 全暗）；手冊圖「CV」「CC」 | LCD 圖示；無 | 第一列所選通道的 CV/CC 狀態（p.17 "You can view the constant current, constant voltage or OVP status for CH1 or CH4, depending on which CH1 ... or CH4 ... is selected. Each state is valid only when the output is ON. When output is OFF, the display is turns off."）；CV/CC 由負載與限流決定（p.22）。 | Output ON：CV 或 CC 其一亮；Output OFF：皆滅。 | CV／CC／滅 | M-GPE p.17 (PDF 17)、M-GPE p.22 (PDF 22)、M-GPE p.32 (PDF 32)、M-GPE p.34 (PDF 34)、M-GPE p.36 (PDF 36)、M-GPE p.42 (PDF 42) | OT | CORE | I04 | 使用者不能直接選 CV/CC 字樣（02）。Parallel 時 CH2 顯示 CC（p.42）。 |
| `GPE.LCD.ROW1_OVP_OCP` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第一列上方「OVP」「OCP」 | 照片未見（LCD 全暗）；手冊圖「OVP」「OCP」 | LCD 圖示；無 | 手冊提到 OVP 狀態（p.17）與 OVP 觸發自動關輸出（p.25），但全冊無 GPE-4323 的 OVP/OCP 設定方法或門檻；OCP 無任何正文。 | 本輪保持熄滅。 | 未找到 | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.25 (PDF 25) | OT+UN | OUT | I04 | 不得假裝有 OVP/OCP 設定。；證據細節：OT（僅提及）；功能 UN |
| `GPE.LCD.ROW2_CH_IND` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第二列最左 | 照片未見（LCD 全暗）；手冊圖為圓圈數字 ②／③ | LCD 圖示；無 | 指示第二列目前顯示的是 CH2 或 CH3（p.17 "Channel indicator ① ② ③ ④ Indicates the currently selected channel."；p.26）。 | 按 CH2/CH3 鍵時 ② ⇔ ③。 | ② 或 ③ | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.26 (PDF 26) | OT+PD | CORE | I04 | p.15 LCD 圖在兩個圓圈數字之間另印「Set」／「Out」。推論（PD）：疑為 GPE-1326 的設定／讀回列標示，GPE-4323 不使用，保持暗段；手冊沒有明說。 |
| `GPE.LCD.ROW2_VOLTAGE` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第二列左半「8.8.8.8 V」 | 照片未見（LCD 全暗）；手冊圖「8.8.8.8V」 | LCD 七段數字＋單位 V；無 | 顯示第二列所選通道電壓：Output ON 為讀回（Voltmeter "Displays output voltage of each channel." p.16）；Set View 時顯示設定（p.19）；Output OFF 顯示設定（暫定，p.23）。 | 隨旋鈕、負載、模式、Output 更新。 | 0–33.00 V 顯示滿刻度；4 位 10 mV／3 位 100 mV（p.45–46） | M-GPE p.15 (PDF 15)、M-GPE p.16 (PDF 16)、M-GPE p.19 (PDF 19)、M-GPE p.23 (PDF 23)、M-GPE p.45 (PDF 45)、M-GPE p.46 (PDF 46) | OT+PD | CORE | I04 | 顯示解析度≠精度（p.46 accuracy ±(0.1%+30mV)），亦不一定等於旋鈕最小步進。Series 無共地時合併電壓需學生自行 ×2（p.38），面板不顯示合併值。；證據細節：OT；OFF 時顯示內容 PD |
| `GPE.LCD.ROW2_CURRENT` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第二列右半「8.8.8.8 A」 | 照片未見（LCD 全暗）；手冊圖「8.8.8.8A」 | LCD 七段數字＋單位 A；無 | 顯示第二列所選通道電流：Output ON 為負載實際電流讀回（p.16 Ammeter "Displays output current of each channel."；p.22 CV 時 "the Current level fluctuates according to the load condition"）；Set View 顯示 I-set（p.19）。 | 無負載時讀回 0（不是 I-set）；CC 時等於 I-set。 | 0–3.200 A 顯示滿刻度；4 位 1 mA／3 位 10 mA（p.45–46） | M-GPE p.16 (PDF 16)、M-GPE p.19 (PDF 19)、M-GPE p.22 (PDF 22)、M-GPE p.45 (PDF 45)、M-GPE p.46 (PDF 46) | OT+PD | CORE | I04 | CH3/CH4 顯示電流讀回（p.16 Ammeter 列出 CH1/CH4、CH2/CH3），但其 Set View 時電流欄內容未寫（GAP-GPE-09）。Parallel 時 CH1 電流讀數為總電流的一半（p.42）。；證據細節：OT；無負載讀回 0 為 PD（依 p.22 推論） |
| `GPE.LCD.ROW2_SET_ICON` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第二列上方「Set」 | 照片未見（LCD 全暗）；手冊圖「Set」 | LCD 圖示；無 | 表示正在顯示設定值（p.17 "View setting value [Set] When output is ON, you can view the voltage/ current setting value depending on the channel be selected."）。 | Set View 短按時亮；返回時機 UN。 | 亮／滅 | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.19 (PDF 19) | OT+PD+UN | APPROX | I04 | p.17 只說有「View setting value」圖示；GPE-4323 按 Set View 時亮的是哪一個 Set 段屬推論（PD），Output OFF 時是否亮 UN（GAP-GPE-02）。 |
| `GPE.LCD.ROW2_CV_CC` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第二列上方「CV」「CC」 | 照片未見（LCD 全暗）；手冊圖「CV」「CC」 | LCD 圖示；無 | 第二列所選通道的 CV/CC 狀態（p.17 "You can view the constant current, constant voltage or OVP status for CH2 or CH3, depending on which CH2 ... or CH3 ... is selected. Each state is valid only when the output is ON. When output is OFF, the display is turns off."）；CV/CC 由負載與限流決定（p.22）。 | Output ON：CV 或 CC 其一亮；Output OFF：皆滅。 | CV／CC／滅 | M-GPE p.17 (PDF 17)、M-GPE p.22 (PDF 22)、M-GPE p.32 (PDF 32)、M-GPE p.34 (PDF 34)、M-GPE p.36 (PDF 36)、M-GPE p.42 (PDF 42) | OT | CORE | I04 | 使用者不能直接選 CV/CC 字樣（02）。Parallel 時 CH2 顯示 CC（p.42）。 |
| `GPE.LCD.ROW2_OVP_OCP` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第二列上方「OVP」「OCP」 | 照片未見（LCD 全暗）；手冊圖「OVP」「OCP」 | LCD 圖示；無 | 手冊提到 OVP 狀態（p.17）與 OVP 觸發自動關輸出（p.25），但全冊無 GPE-4323 的 OVP/OCP 設定方法或門檻；OCP 無任何正文。 | 本輪保持熄滅。 | 未找到 | M-GPE p.15 (PDF 15)、M-GPE p.17 (PDF 17)、M-GPE p.25 (PDF 25) | OT+UN | OUT | I04 | 不得假裝有 OVP/OCP 設定。；證據細節：OT（僅提及）；功能 UN |
| `GPE.LCD.CH3_FIXED_ROW` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；第三列「③ 5v 3.3v 2.5v 1.8v OverLoad」 | 照片未見（LCD 全暗）；手冊圖「③ 5v 3.3v 2.5v 1.8v OverLoad」 | LCD 圖示列；無 | p.15 說明此區為 "CH3 parameter display area for the GPE-3323"；p.18 OverLoad 為 "Output status of CH3 in the GPE-3323"。GPE-4323 的 CH3 改由第二列 ③ 顯示（p.34）。 | GPE-4323 本輪保持熄滅。 | 不適用 GPE-4323 | M-GPE p.15 (PDF 15)、M-GPE p.16 (PDF 16)、M-GPE p.18 (PDF 18)、M-GPE p.34 (PDF 34) | OT | OUT | I04 | GPE-4323 實機 LCD 是否具這些段未證實；不用 GPE-3323 規則。 |

### LCD 狀態區

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.LCD.SER_ICON` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；下方狀態列「SER」 | 照片未見（LCD 全暗）；手冊「SER」 | LCD 圖示；無 | Series tracking 時亮（p.37 "The SER icon will be lit on the LCD display."）。 | 模式鍵成 Series 組合時亮。 | 亮／滅 | M-GPE p.16 (PDF 16)、M-GPE p.26 (PDF 26)、M-GPE p.31 (PDF 31)、M-GPE p.37 (PDF 37)、M-GPE p.39 (PDF 39) | OT | CORE | I04 | 與 PARA 互斥；兩者皆滅＝Independent（p.31）。 |
| `GPE.LCD.PARA_ICON` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；下方狀態列「PARA」 | 照片未見（LCD 全暗）；手冊「PARA」 | LCD 圖示；無 | Parallel tracking 時亮（p.41 "The PARA icon will be lit on the LCD display."）。 | 兩模式鍵皆按下時亮。 | 亮／滅 | M-GPE p.16 (PDF 16)、M-GPE p.26 (PDF 26)、M-GPE p.31 (PDF 31)、M-GPE p.41 (PDF 41) | OT | CORE | I04 | — |
| `GPE.LCD.LOCK_ICON` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；下方狀態列「Lock」 | 照片未見（LCD 全暗）；手冊「Lock」 | LCD 圖示；無 | Lock 啟用時亮，解鎖時熄（p.27 "The Lock icon will become lit." / "The Lock icon will then turn off and the output turns off as well."）。 | 長按 Set View(LOCK) >2 s 切換。 | 亮／滅 | M-GPE p.16 (PDF 16)、M-GPE p.27 (PDF 27) | OT | APPROX | I04 | Lock 鎖定範圍有歧義（GAP-GPE-01）。 |
| `GPE.LCD.OTP_ICON` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；下方狀態列「OTP」 | 照片未見（LCD 全暗）；手冊「OTP」 | LCD 圖示；無 | p.16 狀態區列出 OTP 圖示，但全冊無說明或觸發條件。 | 本輪保持熄滅。 | 未找到 | M-GPE p.15 (PDF 15)、M-GPE p.16 (PDF 16) | OT+UN | OUT | I04 | 不模擬過溫。；證據細節：OT（僅圖示）；功能 UN |
| `GPE.LCD.ON_OFF_ICON` | P1 下層 GPE 左側 LCD 視窗內（約 x100–350, y675–825）；照片全暗，此元素位置依 M-GPE p.15 LCD 圖；右下「ON OFF」 | 照片未見（LCD 全暗）；手冊「ON OFF」 | LCD 圖示；無 | Output 狀態顯示（p.16 "Output status display"；p.25 "The OFF icon will become lit"；p.32 "the ON icon will appear"）。 | Output ON → ON 亮；OFF → OFF 亮。開機輸出狀態設定時會閃爍（p.27，本輪未納入）。 | ON／OFF | M-GPE p.16 (PDF 16)、M-GPE p.25 (PDF 25)、M-GPE p.27 (PDF 27)、M-GPE p.32 (PDF 32) | OT | CORE | I04 | 須與 On/Off 鍵燈同一狀態來源。 |

### 輸出端子（下排）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.TERM.CH4_POS` | P1 下層 GPE 下排左起第 1（約 x158,y895） | 上方「+ CH4」（字淡、被端子頭遮）；下方「0 - 15…」（手冊 p.15 圖「0 - 15V , 1A」） | 輸出接線柱（白色端子帽＋紅環；可插香蕉插頭或鎖線，p.24）；接線（屬 J01；本輪不接） | CH4 輸出正端（p.19 "Outputs CH4 voltage and current."） | 無（被動件）；有效輸出由 Output 與模式決定 | 0–15 V，1 A max | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.24 (PDF 24)、M-GPE p.35 (PDF 35)；P1 | PH+OT | STATIC | J01/I04 | CH4 不參與 tracking（p.35）。；卡別細節：J01（I04 只顯示並預留 terminal ID） |
| `GPE.TERM.CH4_NEG` | P1 下層 GPE 下排左起第 2（約 x205,y898） | 上方「−」（被遮）；與 CH4＋ 共用「0 - 15…」 | 輸出接線柱（白色端子帽＋黑環；可插香蕉插頭或鎖線，p.24）；接線（屬 J01；本輪不接） | CH4 輸出負端 | 無（被動件）；有效輸出由 Output 與模式決定 | 同 CH4 | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.24 (PDF 24)、M-GPE p.35 (PDF 35)；P1 | PH+OT | STATIC | J01/I04 | —；卡別細節：J01（I04 只顯示並預留 terminal ID） |
| `GPE.TERM.CH1_POS` | P1 下層 GPE 下排左起第 3（約 x252,y905） | 上方「+ CH1」（字淡）；右側「0 - 32V」「3A」⚠「MAST…」（手冊「MASTER」）；下方藍帶起點（手冊「+」SERIES／「+」PARALLEL） | 輸出接線柱（白色端子帽＋紅環；可插香蕉插頭或鎖線，p.24）；接線（屬 J01；本輪不接） | CH1 輸出正端；Series 單電源接法負載接 CH1+ 與 CH2−（p.38 "Connect the load to the front panel terminals, CH1+ & CH2− (Single supply)."）；Parallel 負載接 CH1 +/−（p.41）。 | 無（被動件）；有效輸出由 Output 與模式決定 | Independent 0–32 V/0–3 A；Series 0–64 V/0–3 A（CH1+ 到 CH2−）；Parallel 0–32 V/0–6 A（CH1±） | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.24 (PDF 24)、M-GPE p.31 (PDF 31)、M-GPE p.37 (PDF 37)、M-GPE p.38 (PDF 38)、M-GPE p.41 (PDF 41)；P1 | PH+OT | STATIC | J01/I04 | MASTER 標示對應 CH1 為 master（p.11）。；卡別細節：J01（I04 只顯示並預留 terminal ID） |
| `GPE.TERM.CH1_NEG` | P1 下層 GPE 下排左起第 4（約 x300,y912） | 上方「−」；下方藍帶（手冊 SERIES 帶此處為「COM」，PARALLEL 帶為「−」） | 輸出接線柱（白色端子帽＋黑環；可插香蕉插頭或鎖線，p.24）；接線（屬 J01；本輪不接） | CH1 輸出負端；Series 共地接法作 COM（p.39 "Use the CH1 (−) terminal as the common line connection."）；Parallel 負端（p.41）。 | 無（被動件）；有效輸出由 Output 與模式決定 | Series 共地：CH1~COM 0–32 V、CH2~COM 0~−32 V（p.39） | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.24 (PDF 24)、M-GPE p.39 (PDF 39)、M-GPE p.41 (PDF 41)；P1 | PH+OT | STATIC | J01/I04 | —；卡別細節：J01（I04 只顯示並預留 terminal ID） |
| `GPE.TERM.GND` | P1 下層 GPE 下排左起第 5（約 x350,y922） | 上方「GND」（字淡）；右側接地符號 | 輸出接線柱（白色端子帽＋綠環；可插香蕉插頭或鎖線，p.24）；接線（屬 J01；本輪不接） | 接地端（p.19 "Accepts a grounding wire."） | 無（被動件）；有效輸出由 Output 與模式決定 | 不輸出電壓 | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.24 (PDF 24)；P1 | PH+OT | STATIC | J01/I04 | 照片所見綠色與手冊 p.32 圖一致。；卡別細節：J01（I04 只顯示並預留 terminal ID） |
| `GPE.TERM.CH2_POS` | P1 下層 GPE 下排左起第 6（約 x400,y925） | 上方「+ CH2」；右側「0 - 32V」「3A」⚠「SLAV…」（手冊「SLAVE」） | 輸出接線柱（白色端子帽＋紅環；可插香蕉插頭或鎖線，p.24）；接線（屬 J01；本輪不接） | CH2 輸出正端（p.19 "Outputs CH2 voltage and current."） | 無（被動件）；有效輸出由 Output 與模式決定 | Independent 0–32 V/0–3 A | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.24 (PDF 24)、M-GPE p.31 (PDF 31)；P1 | PH+OT | STATIC | J01/I04 | SLAVE 標示對應 CH2 為 slave（p.11）。；卡別細節：J01（I04 只顯示並預留 terminal ID） |
| `GPE.TERM.CH2_NEG` | P1 下層 GPE 下排左起第 7（約 x452,y932） | 上方「−」；手冊 SERIES 帶終點「−」 | 輸出接線柱（白色端子帽＋黑環；可插香蕉插頭或鎖線，p.24）；接線（屬 J01；本輪不接） | CH2 輸出負端；Series 接法負載負端（p.38、p.39） | 無（被動件）；有效輸出由 Output 與模式決定 | Series 合併輸出負端 | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.24 (PDF 24)、M-GPE p.38 (PDF 38)、M-GPE p.39 (PDF 39)；P1 | PH+OT | STATIC | J01/I04 | —；卡別細節：J01（I04 只顯示並預留 terminal ID） |
| `GPE.TERM.CH3_POS` | P1 下層 GPE 下排左起第 8（約 x502,y940） | 上方「+ CH3」；右下「5V , 1…」（手冊 p.15 圖「0 - 5V, 1A」，「0 -」在照片中被端子遮住） | 輸出接線柱（白色端子帽＋紅環；可插香蕉插頭或鎖線，p.24）；接線（屬 J01；本輪不接） | CH3 輸出正端（p.19 "Outputs CH3 voltage and current."） | 無（被動件）；有效輸出由 Output 與模式決定 | 0–5 V，1 A max | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.24 (PDF 24)、M-GPE p.33 (PDF 33)；P1 | PH+OT | STATIC | J01/I04 | CH3 不參與 tracking（p.33）。；卡別細節：J01（I04 只顯示並預留 terminal ID） |
| `GPE.TERM.CH3_NEG` | P1 下層 GPE 下排左起第 9（約 x555,y948） | 上方「−」 | 輸出接線柱（白色端子帽＋黑環；可插香蕉插頭或鎖線，p.24）；接線（屬 J01；本輪不接） | CH3 輸出負端 | 無（被動件）；有效輸出由 Output 與模式決定 | 同 CH3 | M-GPE p.15 (PDF 15)、M-GPE p.19 (PDF 19)、M-GPE p.24 (PDF 24)、M-GPE p.33 (PDF 33)；P1 | PH+OT | STATIC | J01/I04 | —；卡別細節：J01（I04 只顯示並預留 terminal ID） |

### 固定標籤

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GPE.MISC.MODEL_PLATE` | P1 下層 GPE 面板左上（約 x95–355, y655–680） | GW INSTEK／GPE-4323／DC Power Supply／32 V 3 A | 固定印字；無 | 型號識別；「32 V 3 A」為 CH1/CH2 額定，不代表 CH3/CH4。 | 無 | — | M-GPE p.15 (PDF 15)；P1 | PH+OT | STATIC | I04 | 確認不是 GPE-4323A 或 GPE-3323。 |
| `GPE.MISC.CH_HEADER` | P1 下層 GPE 旋鈕區頂端黑帶（約 x400–610, y662–680） | CH1（左）／CH2（右） | 固定印字；無 | 標示上區左欄屬 CH1、右欄屬 CH2；下區旋鈕另印 CH4 Voltage／CH3 Voltage。 | 無 | — | M-GPE p.15 (PDF 15)；P1 | PH+OT | STATIC | I04 | — |
| `GPE.MISC.TRACKING_LEGEND` | P1 下層 GPE 旋鈕區中上圓角框（約 x460–550, y695–760） | Series／Parallel／Independent，每列左右各一鍵狀態小圖示 | 固定印字＋圖例；無 | 說明兩模式鍵的組合（p.25–26）。 | 無 | — | M-GPE p.15 (PDF 15)、M-GPE p.18 (PDF 18)、M-GPE p.25 (PDF 25)、M-GPE p.26 (PDF 26)；P1 | PH+OT | STATIC | I04 | 照片圖例與手冊圖示一致：Series 左高右低、Parallel 皆低、Independent 皆高。 |
| `GPE.MISC.LONG_PUSH_LEGEND` | P1 下層 GPE 旋鈕區左下（約 x400–440, y872） | — : Long Push | 固定印字；無 | 說明底線標示（LOCK）為長按功能（p.27 圖示同樣印 "— : Long Push"）。 | 無 | — | M-GPE p.15 (PDF 15)、M-GPE p.27 (PDF 27)；P1 | PH+OT | STATIC | I04 | — |
| `GPE.MISC.SER_PAR_BAND` | P1 下層 GPE 下排 CH1＋ 至 CH2− 下方藍色色帶（約 x250–470, y905–935） | 照片可見「PA…」「OUTP…」「OUTP…」；手冊 p.15 圖全文「+ COM SERIES OUTPUT −」「+ − PARALLEL OUTPUT」 | 固定印字色帶；無 | 提示 Series 輸出取 CH1+／CH2−（COM 在 CH1−），Parallel 輸出取 CH1+／CH1−（p.15 圖；p.38、p.39、p.41）。 | 無 | — | M-GPE p.15 (PDF 15)、M-GPE p.38 (PDF 38)、M-GPE p.39 (PDF 39)、M-GPE p.41 (PDF 41)；P1 | PH+OT | STATIC | J01/I04 | 被端子遮住的字依手冊補齊，UI 應標示此為手冊圖文字。；證據細節：PH（部分）+OT；卡別細節：J01（I04 顯示） |

### GW Instek GPE-4323 核心選單路徑

只列來源有寫的路徑；沒有來源的不補。

| 路徑 | 軟鍵／選項 | 來源 | 證據 | 狀態 | 備註 |
| --- | --- | --- | --- | --- | --- |
| 總輸出 ON/OFF：On / Off → 全部通道 ON → 再按 On / Off → 全部通道 OFF | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KEY.OUTPUT_ON_OFF 短按一次切換 | M-GPE p.25 (PDF 25)、M-GPE p.32 (PDF 32) | OT+PH | CORE | p.25 "Press the Output key to turn on all outputs in each channel." / "Push the Output key again to turn off all outputs. The OFF icon will become lit on the LCD display."；ON 時鍵亮＋ON 圖示＋CV/CC（p.32）。 |
| 選 Independent：兩模式鍵皆彈起 → SER、PARA 圖示皆滅 | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KEY.TRACK_LEFT＝彈起、GPE.KEY.TRACK_RIGHT＝彈起 | M-GPE p.25 (PDF 25)、M-GPE p.31 (PDF 31) | OT（文字＋圖示）+PH（圖例） | CORE | p.25 "For the independent mode, the right key is not pressed"；p.31 "Make sure the Series/Parallel key is not activated (both the SER and PARA icons are off)." 左鍵按下＋右鍵彈起的組合未圖示，暫依文字視為 Independent（GAP-GPE-07）。 |
| 選 Series：左模式鍵彈起＋右模式鍵按下 → SER 圖示亮（Output 若 ON 自動 OFF） | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KEY.TRACK_LEFT＝彈起、GPE.KEY.TRACK_RIGHT＝按下 | M-GPE p.25 (PDF 25)、M-GPE p.26 (PDF 26)、M-GPE p.37 (PDF 37) | OT+PH | CORE | p.26 "Right key is pressed and the left key is not pressed in series mode."；p.25 自動關輸出。 |
| 選 Parallel：兩模式鍵皆按下 → PARA 圖示亮（Output 若 ON 自動 OFF） | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KEY.TRACK_LEFT＝按下、GPE.KEY.TRACK_RIGHT＝按下 | M-GPE p.25 (PDF 25)、M-GPE p.26 (PDF 26)、M-GPE p.41 (PDF 41) | OT+PH | CORE | p.26 "Toggle to parallel mode when both keys are pressed." |
| CH1/CH2 Independent 操作：確認 SER/PARA 滅 → 接 CH1±、CH2± → CH1 Voltage、CH1 Current → CH2 Voltage、CH2 Current → On / Off → 看 CV/CC | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KNOB.CH1_VOLTAGE、GPE.KNOB.CH1_CURRENT、GPE.KNOB.CH2_VOLTAGE、GPE.KNOB.CH2_CURRENT、GPE.KEY.OUTPUT_ON_OFF | M-GPE p.31 (PDF 31)、M-GPE p.32 (PDF 32) | OT | CORE | p.32 "Press the Output key to turn on the output. The Output key will be lit and the ON icon will appear on the LCD display. The CV or CC icon appears on the LCD to indicate the output status for each channel." 接線屬 J01，本輪以測試負載代替。 |
| CH3 操作：接 CH3± → CH3 Voltage 旋鈕 → CH2/CH3 鍵切到 ③ 查看設定 → On / Off | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KNOB.CH3_VOLTAGE → GPE.KEY.CH2_CH3 → GPE.KEY.OUTPUT_ON_OFF | M-GPE p.33 (PDF 33)、M-GPE p.34 (PDF 34) | OT | CORE | p.34 "You can check the setting of the GPE-4323 by using the CH2/CH3 key to toggle to CH3(③ appears on the LCD display)." |
| CH4 操作：接 CH4± → CH4 Voltage 旋鈕 → CH1/CH4 鍵切到 ④ 查看設定 → On / Off | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KNOB.CH4_VOLTAGE → GPE.KEY.CH1_CH4 → GPE.KEY.OUTPUT_ON_OFF | M-GPE p.35 (PDF 35)、M-GPE p.36 (PDF 36) | OT | CORE | p.35 "You can use the CH1/CH4 key to toggle to CH4(④) appears on the LCD display) to check the setting value." |
| Series（無共地）：模式鍵成 Series（SER 亮）→ 負載接 CH1+ 與 CH2− → CH2 Current 調到最大 → CH1 Voltage、CH1 Current → On / Off → 讀 CH1 表（電壓 ×2＝輸出電壓；電流＝輸出電流） | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） TRACK_RIGHT 按下 → GPE.KNOB.CH2_CURRENT（max）→ GPE.KNOB.CH1_VOLTAGE、GPE.KNOB.CH1_CURRENT → GPE.KEY.OUTPUT_ON_OFF | M-GPE p.37 (PDF 37)、M-GPE p.38 (PDF 38) | OT | CORE | p.38 "Use the current knob to set the CH2 output current to the maximum level." / "Output voltage level: Double the reading on the CH1 voltage meter." / "Output current level: CH1 meter reading shows the output current." 輸出 0–64 V/0–3 A（p.37）。 |
| Series（共地 COM）：SER → 負載接 CH1+、CH2−，CH1(−) 為 COM → CH1 Voltage 設 master & slave 同電壓 → CH1 Current 設 master → CH2 Current 設 slave → On / Off → CH1 表讀 master、CH2 表讀 slave | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KNOB.CH1_VOLTAGE → GPE.KNOB.CH1_CURRENT → GPE.KNOB.CH2_CURRENT → GPE.KEY.OUTPUT_ON_OFF | M-GPE p.39 (PDF 39)、M-GPE p.40 (PDF 40) | OT | CORE | p.40 "Use the CH1 voltage knob to set the master & slave output voltage (the same level for both channels)." "Use the CH2 current knob to set the slave output current." 輸出 CH1~COM 0–32 V、CH2~COM 0~−32 V（p.39）。CH2 Voltage 旋鈕在此模式的效果未寫（GAP-GPE-08）。 |
| Parallel：模式鍵成 Parallel（PARA 亮）→ 負載接 CH1 +/− → CH1 Voltage、CH1 Current（CH2 控制停用）→ On / Off → CH2 顯示 CC → CH1 表：電壓＝輸出；電流 ×2＝輸出 | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） 兩模式鍵按下 → GPE.KNOB.CH1_VOLTAGE、GPE.KNOB.CH1_CURRENT → GPE.KEY.OUTPUT_ON_OFF | M-GPE p.41 (PDF 41)、M-GPE p.42 (PDF 42) | OT | CORE | p.42 "CH2 control function is disabled." "The operating mode of CH2 will appear as the CC icon on the LCD display." "Output current level: Double the amount of CH1 current meter reading." 輸出 0–32 V/0–6 A（p.41）。 |
| 顯示切換：CH1/CH4 → 第一列 ① ⇔ ④；CH2/CH3 → 第二列 ② ⇔ ③ | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KEY.CH1_CH4、GPE.KEY.CH2_CH3 | M-GPE p.26 (PDF 26) | OT+PH | CORE | p.26 "This feature is only available for the GPE-4323." 只切顯示，不改旋鈕歸屬（02）。 |
| 查看設定：Output ON 時短按 Set View → Set 圖示、顯示所選通道 V/I 設定 → 返回讀回（返回方式未找到） | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KEY.SET_VIEW 短按 | M-GPE p.17 (PDF 17)、M-GPE p.19 (PDF 19) | OT；返回 UN | APPROX | p.19 "When the output is ON, you can view the voltage/current settings of each channel by pressing this key." 手冊無「再按返回」或「逾時返回」的描述（GAP-GPE-02）。 |
| Lock：長按 Set View（下方 LOCK）>2 s → Lock 圖示亮；再長按 >2 s → Lock 滅、Output 關閉 | （GPE-4323 無螢幕軟鍵／選單；以下為實體鍵與旋鈕序列） GPE.KEY.SET_VIEW 長按 >2 s | M-GPE p.19 (PDF 19)、M-GPE p.25 (PDF 25)、M-GPE p.27 (PDF 27)、M-GPE p.43 (PDF 43) | OT；鎖定範圍 UN | APPROX | p.27 "Press the LOCK key (for more than 2 seconds) to lock the voltage knob operation for CH1 & CH2 in the front panel. The Lock icon will become lit." / "To unlock, press the LOCK key for more than 2 seconds. The Lock icon will then turn off and the output turns off as well." |
| Set the output state at startup（頂層名稱；本輪未納入） | （未納入，不列步驟） | M-GPE p.27 (PDF 27)、M-GPE p.28 (PDF 28) | OT | OUT | 手冊註記 "By default the output is set to OFF at startup."（p.28）。 |
| Set the displayed digit resolution for the voltage/current（頂層名稱；本輪未納入） | （未納入，不列步驟） | M-GPE p.29 (PDF 29) | OT | OUT | "By default the number of displayed digits is set to four."（p.29） |
| Remote Control Setting（後面板端子；頂層名稱；本輪未納入） | （未納入） | M-GPE p.30 (PDF 30) | OT | OUT | 後面板遠端 ON/OFF；切到遠端會自動關輸出（p.25）。 |

## 4. Keysight 34460A 6½ 位數電表（P1 中層，I05）

**照片核對：** P1 中層核對結果：型號標「KEYSIGHT 34460A 6 1/2 Digit Multimeter Truevolt」（Keysight 波形 logo），確認為 34460A。單一量測輸入的電表（無通道概念）；旋鈕 0 顆；無數字鍵盤。左側：LCD 1 面（全暗）、其下藍灰色軟鍵 6 顆（鍵面無字）、LCD 左方 USB-A 1 個（下印 USB 圖示）、圓形電源（待機）鍵 1 個與其下小圓點 1 個。右側功能鍵 4 列×3 共 12 顆：第 1 列 DCV〔上 DCI〕、ACV〔上 ACI〕、Ω2W〔上 Ω4W〕；第 2 列 Freq〔上方無次標籤〕、Cont ·))〔上方藍色二極體符號〕、Temp〔上方無次標籤〕；第 3 列 Run/Stop〔上 Reset〕、Single〔上 Probe Hold〕、Null〔上 Math〕；第 4 列 Display〔上 Utility〕、Acquire〔上 Help〕、藍色 Shift〔下 Local〕。功能鍵下方：十字方向鍵 ▲▼◀▶＋中央 Select（5 顆，▲ 上方無 ACAL 字樣）；Shift 正下方直列 +、Range、−（3 顆）。端子 5 個，排列：上排 Sense Ω4W HI（紅）、Input V Ω ⊣▶⊢ HI（紅）；中排 Sense LO（黑）、Input LO（黑）；下排右 I 3A（紅）。下排左為深色圓形平面件（非端子）、最下方為深色橢圓件（非端子）。印字：200 Vpk（Sense 側括號）、1000 VDC / 750 VAC（Input HI–LO 括號）、500 Vpk＋接地符號（Input LO）、LO→I 連線上保險絲符號＋⚠、CAT II (300V)＋其下 ⚠、右上角閃電 ⚠。沒有：10 A 端子、Front/Rear 切換、後面板端子（照片看不到後面板；DS p.3 表示 34460A 無 rear input）、ACAL 標示、數字鍵盤、旋鈕。LCD 全暗：不能證明任何畫面、選單、開機值或預設量程。面板顏色為淺灰白（DS 產品照為黑色）。

**頁碼對照：** D-DMM（Truevolt_34460A_DataSheet_5991-1983EN.pdf，28 PDF 頁；p.28 印「Published in USA, June 10, 2026, 5991-1983EN」）：PDF 1＝封面，無印刷頁碼；PDF 2–27 的頁尾印刷頁碼＝PDF 頁序（已核對：PDF 2 印 "2"（目錄）、PDF 3 印 "3"、PDF 4 印 "4"、PDF 11 印 "11"、PDF 12 印 "12"、PDF 21 印 "21"、PDF 23 印 "23"、PDF 24 印 "24"、PDF 25 印 "25"、PDF 26 印 "26"、PDF 27 印 "27"）；PDF 28＝封底 Definitions，無頁碼。目錄（p.2）對照：Overview p.3、Specifications 34460A p.11、34461A p.13、34465A p.15、34470A p.18、Measurement Characteristics p.21、Operating Characteristics p.23、System Speeds p.24、General Characteristics p.25（p.26 為其續頁，無標題）、Options p.27、Definitions p.28——與 PDF 頁序一致。因此本檔一律寫「D-DMM p.N (PDF N)」。04 指定頁核對：p.3 機型表、p.11–12 34460A 規格、p.21 量測特性、p.26–27 一般特性與選配，皆已開啟文字與渲染圖。P1（01_校機_AFG2225_34460A_GPE4323.jpeg，768×1024）：34460A 位於原圖約 x30–720、y330–650；controls 中的「原圖約 x,y」為原始像素座標估計。M-DMM：未取得，無頁碼可對照。

### 顯示

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DMM.LCD.MAIN` | P1 中層左半，型號列下方大面積螢幕（原圖約 x105–375, y385–557）；拍攝時全暗 | 無印字（LCD 全暗） | LCD（彩色 TFT）；無（被動顯示） | 顯示功能名稱、讀值＋單位、量程狀態、觸發狀態與 6 個軟鍵標籤。D-DMM p.26 (PDF 26)："4.3” color TFT WQVGA (480 x 272) with LED backlight"；"Supports: Basic number, bar meter, trend chart (34461A, 34465A, 34470A), histogram views."（34460A 無 trend chart）。D-DMM p.3 (PDF 3) 34460A 產品照畫面：左上 "DC Voltage"、上方 "Auto Trigger"、讀值 "+0.634 450"、單位 "VDC"、左下 "Auto 1V"；p.4 (PDF 4) 畫面圖另有 "+000.030 6 mVDC"、"Auto 100mV"。 | 第一版：Number view 的讀值、單位前綴、Auto／手動量程字樣、Null 標示、Shift 暫定指示、超量程／未提供輸入狀態（後兩者字樣為 PD）。 | 480×272 像素；對角 4.3 in／109 mm（D-DMM p.3 (PDF 3) 圖示 "4.3 in. / 109 mm"）；Dual line display: Yes（p.3） | P1 中層；D-DMM p.3 (PDF 3) 產品照與表、p.4 (PDF 4) 畫面圖、p.26 (PDF 26) Display | PH+DS+PD | CORE | I05 | P1 LCD 全暗，不能證明任何畫面、開機值或選單；畫面配置只來自 datasheet 行銷產品照（韌體版本未知）。bar meter／histogram 為 OUT；不得畫 trend chart。雙行顯示（Dual line）本輪 OUT。 LCD 版面與字樣取自 datasheet 行銷合成畫面，屬 PD。 |

### 軟鍵（LCD 下方）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DMM.SOFT.S1` | P1 中層，LCD 正下方一排 6 個藍灰色長圓鍵，由左數第 1 個（原圖約 x128, y577） | 鍵面無印字（功能由 LCD 標籤決定） | 軟鍵；按下 | DCV 畫面時 LCD 標籤為 "Range"／"Auto"（D-DMM p.3 (PDF 3)、p.1 (PDF 1) 34460A 產品照）。其他功能畫面的 S1 標籤：未找到。 | LCD 最下列對應位置的標籤／狀態（P1 LCD 全暗，無法確認） | DCV：100 mV/1 V/10 V/100 V/1000 V 或 Auto（D-DMM p.11 (PDF 11)） | P1 中層；D-DMM p.3 (PDF 3) 與 p.1 (PDF 1) 34460A 產品照 | PH+PD | APPROX | I05 | 暫定（PD）：DCV/DCI/ACV/ACI/Ω2W 畫面的 S1 顯示 "Range" 與目前 Auto 或量程值；按下等同前面板 Range 鍵（切 Auto／手動）。Cont 畫面不顯示 Range（D-DMM p.12 (PDF 12) Continuity 只有 1 kΩ）。原廠按下後是否展開下一層選單未找到，列 GAP-DMM-04。 軟鍵標籤取自 datasheet 行銷照（合成畫面，與 p.4 的獨立畫面圖一致），只算推論（PD），未經操作手冊或校機確認；儀器外要註明。 |
| `DMM.SOFT.S2` | P1 中層，LCD 正下方一排 6 個藍灰色長圓鍵，由左數第 2 個（原圖約 x171, y577） | 鍵面無印字（功能由 LCD 標籤決定） | 軟鍵；按下 | DCV 畫面標籤 "Aperture"／"10 PLC"（D-DMM p.3 (PDF 3) 產品照）。積分時間與位數關係見 D-DMM p.23 (PDF 23)。 | LCD 最下列對應位置的標籤／狀態（P1 LCD 全暗，無法確認） | D-DMM p.23 (PDF 23)：100 PLC、10 PLC、1 PLC、0.2 PLC、0.02 PLC | P1 中層；D-DMM p.3 (PDF 3) 與 p.1 (PDF 1) 34460A 產品照；p.23 (PDF 23) | PH+PD+UN | OUT | I05 | 只顯示 DS 產品照上的標籤，按下顯示「本輪未納入」；不改變位數／讀取速率。 軟鍵標籤取自 datasheet 行銷照（合成畫面，與 p.4 的獨立畫面圖一致），只算推論（PD），未經操作手冊或校機確認；儀器外要註明。 |
| `DMM.SOFT.S3` | P1 中層，LCD 正下方一排 6 個藍灰色長圓鍵，由左數第 3 個（原圖約 x214, y577） | 鍵面無印字（功能由 LCD 標籤決定） | 軟鍵；按下 | DCV 畫面標籤 "Auto Zero"／"Off On"（D-DMM p.3 (PDF 3) 產品照）。 | LCD 最下列對應位置的標籤／狀態（P1 LCD 全暗，無法確認） | Off／On（產品照） | P1 中層；D-DMM p.3 (PDF 3) 與 p.1 (PDF 1) 34460A 產品照 | PH+PD+UN | OUT | I05 | 只顯示標籤；按下顯示範圍說明。 軟鍵標籤取自 datasheet 行銷照（合成畫面，與 p.4 的獨立畫面圖一致），只算推論（PD），未經操作手冊或校機確認；儀器外要註明。 |
| `DMM.SOFT.S4` | P1 中層，LCD 正下方一排 6 個藍灰色長圓鍵，由左數第 4 個（原圖約 x257, y577） | 鍵面無印字（功能由 LCD 標籤決定） | 軟鍵；按下 | DCV 畫面標籤 "Input Z"／"10M Auto"（D-DMM p.3 (PDF 3) 產品照）。D-DMM p.21 (PDF 21)：0.1 V、1 V、10 V 量程 "Selectable 10 MΩ or >10 GΩ"，100 V、1000 V 量程 "10 MΩ ± 1%"。 | LCD 最下列對應位置的標籤／狀態（P1 LCD 全暗，無法確認） | 10 MΩ／>10 GΩ（D-DMM p.21 (PDF 21)） | P1 中層；D-DMM p.3 (PDF 3) 與 p.1 (PDF 1) 34460A 產品照；p.21 (PDF 21) | PH+PD+UN | OUT | I05 | 只顯示標籤；模擬器以理想輸入（不計負載效應），按下顯示範圍說明。 軟鍵標籤取自 datasheet 行銷照（合成畫面，與 p.4 的獨立畫面圖一致），只算推論（PD），未經操作手冊或校機確認；儀器外要註明。 |
| `DMM.SOFT.S5` | P1 中層，LCD 正下方一排 6 個藍灰色長圓鍵，由左數第 5 個（原圖約 x300, y577） | 鍵面無印字（功能由 LCD 標籤決定） | 軟鍵；按下 | DCV 畫面標籤 "DCV Ratio"／"Off On"（D-DMM p.3 (PDF 3) 產品照）。DC Ratio 規格見 D-DMM p.12 (PDF 12)、p.21 (PDF 21)（使用 Sense 端子作 reference）。 | LCD 最下列對應位置的標籤／狀態（P1 LCD 全暗，無法確認） | Input 100 mV–1000 V；Reference 100 mV–10 V（D-DMM p.21 (PDF 21)） | P1 中層；D-DMM p.3 (PDF 3) 與 p.1 (PDF 1) 34460A 產品照；p.21 (PDF 21) | PH+PD+UN | OUT | I05 | 只顯示標籤；按下顯示範圍說明。 軟鍵標籤取自 datasheet 行銷照（合成畫面，與 p.4 的獨立畫面圖一致），只算推論（PD），未經操作手冊或校機確認；儀器外要註明。 |
| `DMM.SOFT.S6` | P1 中層，LCD 正下方一排 6 個藍灰色長圓鍵，由左數第 6 個（原圖約 x345, y577） | 鍵面無印字（功能由 LCD 標籤決定） | 軟鍵；按下 | D-DMM p.3 (PDF 3) 產品照（Number view）此位置無標籤；p.1 (PDF 1) 產品照（histogram view）為 "Clear Readings"。 | LCD 最下列對應位置的標籤／狀態（P1 LCD 全暗，無法確認） | 未找到 | P1 中層；D-DMM p.3 (PDF 3) 與 p.1 (PDF 1) 34460A 產品照 | PH+PD+UN | OUT | I05 | 第一版保持空白；按下無動作並顯示範圍說明。軟鍵標籤會隨 view 改變（兩張 DS 產品照比較）。 軟鍵標籤取自 datasheet 行銷照（合成畫面，與 p.4 的獨立畫面圖一致），只算推論（PD），未經操作手冊或校機確認；儀器外要註明。 |

### 左側面板

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DMM.PORT.USB_HOST` | P1 中層最左側，LCD 左方直立 USB-A 母座（原圖約 x72–90, y450–487），下方印 USB 圖示 | USB 三叉圖示（印在插座下方），無文字 | USB-A 埠（Host）；無（被動） | D-DMM p.25 (PDF 25)："Front-Panel USB Host Port (FAT32) Supports USB 2.0 high-speed mass storage (MSC) class devices"；"Capability: Import/export instrument configuration files, save volatile readings and screen captures"。 | 無 | USB 2.0 MSC、FAT32 | P1 中層；D-DMM p.25 (PDF 25) | PH+DS | STATIC | I05 | 只畫外觀；不模擬隨身碟存取（OUT）。不是遠端控制用的 USB device 埠（後者在後面板，D-DMM p.24 (PDF 24) 後面板照）。 |
| `DMM.PWR.POWER` | P1 中層左下角，USB 圖示下方的圓形白色鍵（原圖約 x82, y542） | ⏻ 電源符號（無文字） | 電源（待機）按鍵；按下 | 開／關機。D-DMM p.26 (PDF 26) 註 3："Power-off state only when power-down is initiated via front-panel power switch."；Internal Flash："Store and recall user-defined states, power-off state"。開機時是否回復關機狀態：未找到。 | 關機：LCD 暗、所有鍵無作用；開機：LCD 顯示暫定預設畫面（PD） | On／Off（模擬） | P1 中層；D-DMM p.26 (PDF 26) | PH+DS+PD | APPROX | I05 | 暫定（PD）：開機一律進入明示的模擬器預設（DCV、Auto、Null off），儀器外註明「非原廠開機記憶」。原廠開機記憶列 GAP-DMM-14。 |
| `DMM.LED.POWER` | P1 中層，電源鍵正下方的小圓點（原圖約 x82, y565）；照片中不亮 | 無印字 | 指示燈（推定）；無 | 未找到（D-DMM 未描述此指示燈）。 | 未知；照片中未亮 | 未找到 | P1 中層 | PH+UN | STATIC | I05 | 只畫外觀；不要賦予未證實的待機／電源燈語義（GAP-DMM-13）。；證據細節：PH（存在）+UN（功能） |

### 功能鍵（右側 4×3）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DMM.KEY.DCV` | P1 中層功能鍵區第 1 列左（原圖約 x408, y404）；上方藍字 "DCI" | DCV（上方次標籤 DCI） | 實體按鍵；按下；上方藍字次功能需先按 Shift（路徑 PD） | DCV：直流電壓（D-DMM p.3 (PDF 3) "DCV 100 mV to 1,000 V"）。次功能 DCI：直流電流（p.3 "DCI 100 μA to 3 A"）；以 Shift→DCV 進入為依標籤推論（PD）。 | LCD 功能名（DS 範例 "DC Voltage"）、讀值、單位 mVDC／VDC；DCI 單位字樣未找到（PD：µA/mA/A） | DCV：100 mV、1 V、10 V、100 V、1000 V（D-DMM p.11 (PDF 11)）；DCI：100 µA、1 mA、10 mA、100 mA、1 A、3 A（p.11） | P1 中層；D-DMM p.3 (PDF 3)、p.11 (PDF 11) | PH+DS+PD | CORE | I05 | DCV 與 DCI 都是 02 第一版必做。DCI 必須對應 I 3A＋LO 端子語義；不得出現 10 A 量程。；證據細節：PH+DS（功能與量程）+PD（Shift 路徑） |
| `DMM.KEY.ACV` | P1 中層功能鍵區第 1 列中（原圖約 x456, y405）；上方藍字 "ACI" | ACV（上方次標籤 ACI） | 實體按鍵；按下；上方藍字次功能需先按 Shift（路徑 PD） | ACV：真有效值交流電壓，D-DMM p.21 (PDF 21) "AC–coupled True RMS. Measures the AC component of the input."。次功能 ACI：p.21 "AC True RMS measurement (Measures the AC component only)."；Shift→ACV 路徑為 PD。 | LCD 讀值與單位（PD：mVAC／VAC、µA/mA/A AC；原廠字樣未找到） | ACV：100 mV、1 V、10 V、100 V、750 V，3 Hz–300 kHz（D-DMM p.11 (PDF 11)）；ACI：100 µA、1 mA、10 mA、100 mA、1 A、3 A，3 Hz–5 kHz（5–10 kHz typ）（p.11–12） | P1 中層；D-DMM p.3 (PDF 3)、p.11 (PDF 11)、p.12 (PDF 12)、p.21 (PDF 21) | PH+DS+PD | CORE | I05 | 02：第一版用明確純正弦測試情境，不宣稱任意波形完整 AC 效能。；證據細節：PH+DS+PD（Shift 路徑、單位字樣） |
| `DMM.KEY.OHM_2W` | P1 中層功能鍵區第 1 列右（原圖約 x502, y407）；上方藍字 "Ω4W" | Ω2W（鍵面印 "Ω 2W"；上方次標籤 "Ω4W"） | 實體按鍵；按下；上方藍字次功能需先按 Shift（路徑 PD） | 二線電阻；次功能四線電阻（Shift 路徑 PD）。D-DMM p.3 (PDF 3) "2- and 4-wire resistance 100 Ω to 100 MΩ"；p.21 (PDF 21) "Selectable 4-wire or 2-wire ohms. Current source referenced to LO input." | LCD 讀值，單位 Ω／kΩ／MΩ（PD 字樣）；開路顯示超量程狀態（字樣 PD） | 100 Ω(1 mA)、1 kΩ(1 mA)、10 kΩ(100 µA)、100 kΩ(10 µA)、1 MΩ(5 µA)、10 MΩ(500 nA)、100 MΩ(500 nA ∥ 10 MΩ)（D-DMM p.11 (PDF 11)，括號為 Test Current） | P1 中層；D-DMM p.3 (PDF 3)、p.11 (PDF 11)、p.21 (PDF 21) | PH+DS+PD | CORE | I05 | Ω2W 為 CORE；次功能 Ω4W 本輪 OUT（02 允許），按 Shift→Ω2W 只顯示範圍說明，不假裝兩線完成四線量測。；證據細節：PH+DS+PD（Shift 路徑） |
| `DMM.KEY.FREQ` | P1 中層功能鍵區第 2 列左（原圖約 x407, y436）；P1 放大確認上方無任何次標籤 | Freq（上方無次標籤） | 實體按鍵；按下（P1 上方沒有 Shift 次標籤） | 頻率／週期（D-DMM p.3 (PDF 3) "Frequency, period 3 Hz to 300 kHz"；p.22 (PDF 22) "Reciprocal-counting technique. Measurement is AC-coupled"）。 | 按下顯示「本輪未納入」說明 | 3 Hz–300 kHz；Gate time 10 ms、100 ms、1 s（1 ms 只限 34465/70A，p.22） | P1 中層；D-DMM p.3 (PDF 3)、p.22 (PDF 22) | PH+DS | OUT | I05 | D-DMM p.3 產品照在 Freq 上方有藍色電容符號，但 P1 沒有 → 見 discrepancies；電容功能入口未確認（GAP-DMM-10）。 DS 行銷照在 Freq 上方有電容符號，校機沒有（GAP-DMM-10）。 |
| `DMM.KEY.CONT` | P1 中層功能鍵區第 2 列中（原圖約 x455, y438）；上方藍色二極體符號 | Cont ·))（上方次標籤：二極體符號 ⊣▶⊢） | 實體按鍵；按下；上方藍字次功能需先按 Shift（路徑 PD） | 導通測試；次功能二極體測試（Shift 路徑 PD）。D-DMM p.12 (PDF 12)：Continuity 量程 "1 kΩ"、Diode Test "5 V"；p.21 (PDF 21)："Response time 300 samples/s with audible tone"、"Continuity threshold Fixed at 10 Ω"；p.12 註 9 "The 1 mA test current is typical."（二極體）。 | 低於門檻時提示音＋可見指示（PD，需有非聲音替代）；LCD 顯示電阻值或開路狀態（字樣 PD） | 導通：固定 1 kΩ 量程、門檻固定 10 Ω；二極體：5 V、1 mA typ（D-DMM p.12、p.21） | P1 中層；D-DMM p.3 (PDF 3)、p.12 (PDF 12)、p.21 (PDF 21) | PH+DS+PD | CORE | I05 | 導通為 CORE；二極體（Shift→Cont）不在 02 必做清單 → OUT。門檻已有 DS 數字（10 Ω），不再是教學近似值；但 <10 Ω 或 ≤10 Ω 的比較方式、蜂鳴開關設定未找到（GAP-DMM-08）。；證據細節：PH+DS（門檻、量程、提示音）+PD（邊界、顯示、Shift 路徑） |
| `DMM.KEY.TEMP` | P1 中層功能鍵區第 2 列右（原圖約 x502, y441）；P1 放大確認上方無次標籤 | Temp（上方無次標籤） | 實體按鍵；按下（P1 上方沒有 Shift 次標籤） | 溫度量測：D-DMM p.3 (PDF 3) 34460A 欄 "RTD/PT100, thermistor"（無 thermocouples，後者只限 34465A/34470A）；p.21 (PDF 21) PT100 轉換 -200 °C–600 °C、Thermistor -80 °C–150 °C。 | 按下顯示「本輪未納入」說明 | PT100 -200–600 °C；Thermistor -80–150 °C（p.21） | P1 中層；D-DMM p.3 (PDF 3)、p.12 (PDF 12)、p.21 (PDF 21) | PH+DS | OUT | I05 | 不得加入熱電偶類型（高階機型功能）。 |
| `DMM.KEY.RUN_STOP` | P1 中層功能鍵區第 3 列左（原圖約 x405, y470）；上方藍字 "Reset" | Run/Stop（上方次標籤 Reset） | 實體按鍵；按下；上方藍字次功能需先按 Shift（路徑 PD） | Run/Stop 與 Reset 的操作定義：未找到（M-DMM 未取得；D-DMM 未描述前面板鍵）。D-DMM p.3 (PDF 3) 產品照畫面顯示 "Auto Trigger" 狀態字。 | 按下顯示「本輪未納入」說明；讀值照常更新 | 未找到 | P1 中層；D-DMM p.3 (PDF 3) 產品照 | PH+UN | OUT | I05 | 不得把 Run/Stop 做成 Probe Hold 或任意 Freeze；Reset 不作為已確認的原廠重設（模擬器重設放在儀器外，GAP-DMM-15）。；證據細節：PH（標籤）+UN（功能） |
| `DMM.KEY.SINGLE` | P1 中層功能鍵區第 3 列中（原圖約 x452, y472）；上方藍字 "Probe Hold" | Single（上方次標籤 Probe Hold） | 實體按鍵；按下；上方藍字次功能需先按 Shift（路徑 PD） | Single：未找到正文。Probe Hold：D-DMM p.26 (PDF 26) "Probe Hold — Capture and navigate stable list of readings"（一般特性，適用所有機型）；穩定判定條件未找到。 | 按下顯示「本輪未納入」說明 | 未找到 | P1 中層；D-DMM p.26 (PDF 26) | PH+DS+UN | OUT | I05 | 02：Probe Hold 不列核心，也不能簡化成任意 Freeze。；證據細節：PH+DS（Probe Hold 存在）+UN（操作與判定） |
| `DMM.KEY.NULL` | P1 中層功能鍵區第 3 列右（原圖約 x500, y475）；上方藍字 "Math" | Null（上方次標籤 Math） | 實體按鍵；按下；上方藍字次功能需先按 Shift（路徑 PD） | Null：相對讀值（顯示值＝量測值－基準）。D-DMM p.26 (PDF 26) Math Functions："Per function null, min/max/avg/Sdev, dB, dBm, span, count, limit test, histogram"；p.12 (PDF 12) 註 7 "2-wire ohms function using math null for offset"。按下即以當下讀值為基準：PD。次功能 Math（Shift 路徑 PD）。 | LCD 顯示 Null 標示（字樣 PD）與差值；關閉後回原量測值 | 每個量測功能各自一組 Null（"Per function null"） | P1 中層；D-DMM p.12 (PDF 12)、p.26 (PDF 26) | PH+DS+PD | CORE | I05 | Null 為 CORE；Math（min/max/avg/Sdev、dB、dBm、limit、histogram 等）本輪 OUT。Null 基準數值編輯 OUT（GAP-DMM-07）。；證據細節：PH+DS（per function null 存在）+PD（按鍵語義、基準擷取） |
| `DMM.KEY.DISPLAY` | P1 中層功能鍵區第 4 列左（原圖約 x404, y501）；上方藍字 "Utility" | Display（上方次標籤 Utility） | 實體按鍵；按下；上方藍字次功能需先按 Shift（路徑 PD） | 顯示模式：D-DMM p.3 (PDF 3) 34460A 欄 Statistical graphics "Histogram, bar meter"；p.4 (PDF 4) Number／Bar meter／Histogram 三種畫面；p.26 (PDF 26) trend chart 只限 34461A/65A/70A。Display 鍵與 view 切換的對應、Utility 內容：未找到（PD 推論 Display 鍵切 view）。 | 按下顯示「本輪未納入」說明（第一版固定 Number view） | Number、Bar meter、Histogram（34460A 無 Trend chart） | P1 中層；D-DMM p.3 (PDF 3)、p.4 (PDF 4)、p.26 (PDF 26) | PH+DS+UN | OUT | I05 | 不得提供 trend chart；不得以無效輸入畫出統計圖。；證據細節：PH+DS+UN（按鍵路徑） |
| `DMM.KEY.ACQUIRE` | P1 中層功能鍵區第 4 列中（原圖約 x451, y504）；上方藍字 "Help" | Acquire（上方次標籤 Help） | 實體按鍵；按下；上方藍字次功能需先按 Shift（路徑 PD） | Acquire 內容：未找到（D-DMM p.26 (PDF 26) 有 Triggering and Memory："Samples per trigger 1 to 1,000,000"、"Trigger delay 0 s to 3600 s"，但未寫在哪個鍵）。Help：p.26 "Integrated, context-sensitive system helps through press-and-hold buttons"。 | 按下顯示「本輪未納入」說明 | 未找到 | P1 中層；D-DMM p.26 (PDF 26) | PH+UN+DS | OUT | I05 | DS 說原廠說明是「長按按鍵」；模擬器不要把長按當成未證實的功能觸發。；證據細節：PH+UN（Acquire 內容）+DS（help 以長按提供） |
| `DMM.KEY.SHIFT` | P1 中層功能鍵區第 4 列右（原圖約 x498, y507）；藍色橢圓鍵，下方黑字 "Local" | Shift（藍色鍵；下方標籤 Local） | 實體按鍵（藍色）；按下（暫定為 latch：先按 Shift 再按目標鍵） | 存取各鍵上方藍字次功能（DCI、ACI、Ω4W、二極體、Reset、Probe Hold、Math、Utility、Help）：依 P1 標籤顏色與位置推論（PD）。 | PD：LCD 顯示暫定 Shift 指示；執行一次次功能後自動解除 | 無 | P1 中層；M-DMM 未取得 | PH+PD | CORE | I05 | 核心只靠 Shift 進入 DCI／ACI，因此列 CORE；latch／同時按、解除時機未確認（GAP-DMM-02）。Shift 下方黑字「Local」不是 Shift 次功能：推論（PD）為遠端控制時回本地；本輪沒有遠端狀態，不觸發。；證據細節：PH（標籤、顏色）+PD（操作語義） |

### 方向／選擇鍵

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DMM.KEY.UP` | P1 中層功能鍵區下方、LCD 右側的十字鍵群：方向鍵上（原圖約 x428, y535） | ▲（無次標籤；P1 確認 ▲ 上方沒有高階機型的 "ACAL" 字樣） | 實體按鍵；按下 | 選單導覽／數值編輯用途：未找到（M-DMM 未取得）。 | 按下顯示「本輪未納入」說明 | 未找到 | P1 中層 | PH+UN | OUT | I05 | 第一版核心功能不需方向鍵；不可自行設計未有來源的選單。D-DMM p.1 (PDF 1) 封面照中 34470A 在 ▲ 上方有 "ACAL"，34460A 與 P1 都沒有 → 不加 ACAL。 |
| `DMM.KEY.DOWN` | P1 中層功能鍵區下方、LCD 右側的十字鍵群：方向鍵下（原圖約 x426, y586） | ▼（無次標籤；P1 確認 ▲ 上方沒有高階機型的 "ACAL" 字樣） | 實體按鍵；按下 | 選單導覽／數值編輯用途：未找到（M-DMM 未取得）。 | 按下顯示「本輪未納入」說明 | 未找到 | P1 中層 | PH+UN | OUT | I05 | 第一版核心功能不需方向鍵；不可自行設計未有來源的選單。D-DMM p.1 (PDF 1) 封面照中 34470A 在 ▲ 上方有 "ACAL"，34460A 與 P1 都沒有 → 不加 ACAL。 |
| `DMM.KEY.LEFT` | P1 中層功能鍵區下方、LCD 右側的十字鍵群：方向鍵左（原圖約 x396, y561） | ◀（無次標籤；P1 確認 ▲ 上方沒有高階機型的 "ACAL" 字樣） | 實體按鍵；按下 | 選單導覽／數值編輯用途：未找到（M-DMM 未取得）。 | 按下顯示「本輪未納入」說明 | 未找到 | P1 中層 | PH+UN | OUT | I05 | 第一版核心功能不需方向鍵；不可自行設計未有來源的選單。D-DMM p.1 (PDF 1) 封面照中 34470A 在 ▲ 上方有 "ACAL"，34460A 與 P1 都沒有 → 不加 ACAL。 |
| `DMM.KEY.RIGHT` | P1 中層功能鍵區下方、LCD 右側的十字鍵群：方向鍵右（原圖約 x458, y563） | ▶（無次標籤；P1 確認 ▲ 上方沒有高階機型的 "ACAL" 字樣） | 實體按鍵；按下 | 選單導覽／數值編輯用途：未找到（M-DMM 未取得）。 | 按下顯示「本輪未納入」說明 | 未找到 | P1 中層 | PH+UN | OUT | I05 | 第一版核心功能不需方向鍵；不可自行設計未有來源的選單。D-DMM p.1 (PDF 1) 封面照中 34470A 在 ▲ 上方有 "ACAL"，34460A 與 P1 都沒有 → 不加 ACAL。 |
| `DMM.KEY.SELECT` | P1 中層功能鍵區下方、LCD 右側的十字鍵群：方向鍵中央（原圖約 x426, y562） | Select（無次標籤；P1 確認 ▲ 上方沒有高階機型的 "ACAL" 字樣） | 實體按鍵；按下 | 選單導覽／數值編輯用途：未找到（M-DMM 未取得）。 | 按下顯示「本輪未納入」說明 | 未找到 | P1 中層 | PH+UN | OUT | I05 | 第一版核心功能不需方向鍵；不可自行設計未有來源的選單。D-DMM p.1 (PDF 1) 封面照中 34470A 在 ▲ 上方有 "ACAL"，34460A 與 P1 都沒有 → 不加 ACAL。 |

### 量程鍵（+／Range／−）

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DMM.KEY.RANGE_UP` | P1 中層 Shift 正下方三鍵直列的最上鍵（原圖約 x498, y540） | + | 實體按鍵；按下 | 手動量程往上一檔（PD，依位置與符號推論）。D-DMM p.21 (PDF 21) 只證明有 Auto／manual ranging："Will select higher range if peak input overload is detected during auto range. Overload is reported in manual ranging." | LCD 量程字樣改變（手動字樣 PD）；讀值依新量程解析度重新顯示 | 依目前功能的量程表（見 specs）；到最大量程停住（PD） | P1 中層；D-DMM p.21 (PDF 21)、p.24 (PDF 24) | PH+DS+PD | CORE | I05 | 若在 Auto 時按 +，暫定轉為手動並升一檔（PD，GAP-DMM-03）。Cont 功能下無作用並顯示「固定 1 kΩ」說明（PD）。；證據細節：PH+DS（量程存在）+PD（鍵語義） |
| `DMM.KEY.RANGE` | P1 中層三鍵直列的中間鍵（原圖約 x497, y568） | Range | 實體按鍵；按下 | 切換 Auto／手動量程（PD）。自動量程行為依 D-DMM p.21 (PDF 21) Overload ranging；Autorange time "< 40 ms"（DC）、"<35ms"（AC）（p.24 (PDF 24)）。 | LCD 左下量程字樣（DS 範例 "Auto 1V"、"Auto 100mV"；手動字樣 PD） | Auto／手動 | P1 中層；D-DMM p.3 (PDF 3)、p.4 (PDF 4)、p.21 (PDF 21)、p.24 (PDF 24) | PH+DS+PD | CORE | I05 | 暫定：Auto→手動時鎖定目前量程；手動→Auto 立即依輸入重新選檔（PD）。原廠是否以 Range 鍵或 S1 軟鍵切換未確認（GAP-DMM-03、GAP-DMM-04）。；證據細節：PH+DS+PD（鍵語義） |
| `DMM.KEY.RANGE_DOWN` | P1 中層三鍵直列的最下鍵（原圖約 x495, y593） | − | 實體按鍵；按下 | 手動量程往下一檔（PD）。 | LCD 量程字樣改變；若新量程過小則顯示超量程狀態（手動量程不自動換檔：AC 依 D-DMM p.21，DC 為 PD） | 到最小量程停住（PD） | P1 中層；D-DMM p.21 (PDF 21)、p.24 (PDF 24) | PH+DS+PD | CORE | I05 | 與 + 對稱；過小量程時必須顯示超量程，不可截斷成滿格數字或 0。 |

### 量測端子

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DMM.TERM.SENSE_HI` | P1 中層端子區上排左（原圖約 x565, y437），紅色；上方標題 "Sense" "Ω4W"，左側 "HI" | Sense Ω4W — HI（紅） | 香蕉插座端子；（J01 接線；I05 只作 terminal ID 與 fixture 語義） | 四線電阻 sense HI；DC Ratio 的 reference HI（D-DMM p.21 (PDF 21) "Input HI-LO/reference (sense) HI-LO"）。 | 無（被動） | D-DMM p.21 (PDF 21)："HI and LO reference (sense) terminals reference to LO input < 12 V"；面板印 "200 Vpk"（意義未找到） | P1 中層；D-DMM p.21 (PDF 21) | PH+DS | STATIC | I05/J01 | 四線量測本輪 OUT；端子可見但不可假裝已完成四線。；卡別細節：I05（terminal ID 預留）／J01（接線） |
| `DMM.TERM.SENSE_LO` | P1 中層端子區中排左（原圖約 x557, y495），黑色；左側 "LO" | Sense Ω4W — LO（黑） | 香蕉插座端子；（J01 接線；I05 只作 terminal ID 與 fixture 語義） | 四線電阻 sense LO；DC Ratio reference LO。 | 無（被動） | 同 Sense HI | P1 中層；D-DMM p.21 (PDF 21) | PH+DS | STATIC | I05/J01 | 四線量測本輪 OUT。；卡別細節：I05（terminal ID 預留）／J01（接線） |
| `DMM.TERM.INPUT_HI` | P1 中層端子區上排右（原圖約 x625, y440），紅色；上方標題 "Input" "V Ω ⊣▶⊢"，右側 "HI" | Input V Ω ⊣▶⊢ — HI（紅） | 香蕉插座端子；（J01 接線；I05 只作 terminal ID 與 fixture 語義） | 電壓、電阻、導通、二極體的輸入 HI（面板標題「V Ω ⊣▶⊢」，PH）；電容／頻率／溫度是否也用此端子屬推論（PD，頻率可參考 D-DMM p.22 間接依據）。DCV、ACV、Ω2W、Cont 的 fixture 以 Input HI/LO 為量測端。 | 無（被動） | "1000 VDC" "750 VAC"（P1 印字）；D-DMM p.21 (PDF 21) DCV "Input protection 1,000 V on all ranges"、ACV "750 Vrms all ranges" | P1 中層；D-DMM p.21 (PDF 21) | PH+DS+PD | STATIC | I05/J01 | P1 端子標題只印一個二極體符號（無電容符號）。；卡別細節：I05（terminal ID 預留）／J01（接線） |
| `DMM.TERM.INPUT_LO` | P1 中層端子區中排右（原圖約 x620, y500），黑色；右側 "LO" | Input — LO（黑） | 香蕉插座端子；（J01 接線；I05 只作 terminal ID 與 fixture 語義） | 所有功能的共同 LO（電壓／電阻的回路；電流量測時與 I 3A 配對，P1 面板連線圖示 LO→保險絲符號→I）。D-DMM p.21 (PDF 21)："Current source referenced to LO input." | 無（被動） | "500 Vpk"＋接地符號（P1 印字，意義未找到） | P1 中層；D-DMM p.21 (PDF 21) | PH+DS | STATIC | I05/J01 | 電流功能的 fixture 以 I 3A＋LO 為量測端（P1 圖示）。；卡別細節：I05（terminal ID 預留）／J01（接線） |
| `DMM.TERM.I_3A` | P1 中層端子區下排右（原圖約 x612, y557），紅色；左側印 "I"、右側印 "3A" | I — 3A（紅） | 香蕉插座端子；（J01 接線；I05 只作 terminal ID 與 fixture 語義） | 直流／交流電流輸入（DCI、ACI）。D-DMM p.21 (PDF 21)："Input protection 3 A — Externally accessible 3.15 A, 500 V fuse ... Internal 11 A, 1,000 V fuse"。 | 無（被動） | 最大 3 A（D-DMM p.3 (PDF 3) "DCI 100 μA to 3 A"、"ACI 100 μA to 3 A"）；3 A 量程無 20% 超量程（p.12 註 2） | P1 中層；D-DMM p.3 (PDF 3)、p.12 (PDF 12)、p.21 (PDF 21) | PH+DS | STATIC | I05/J01 | 34460A 只有這一個電流端子；沒有 10 A 端子（p.21 "Input protection 10 A (34461/65/70A only)"）。；卡別細節：I05（terminal ID 預留）／J01（接線） |

### 端子區被動件

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DMM.MISC.ROUND_PART` | P1 中層端子區下排左，"I" 字左側的深色圓形平面件（原圖約 x552, y552）；其右上方為保險絲符號＋⚠ | 無印字 | 被動件（功能不明）；無 | 未找到正文。D-DMM p.24 後面板照顯示電流保險絲在後面板，所以「前面板保險絲座」的推論不成立。較合理的推論（PD）：D-DMM p.1 封面 34470A 在同一位置是 10A 端子，34460A 此處為封蓋。 | 無 | 無 | P1 中層；D-DMM p.1 (PDF 1) 封面產品照；p.24 (PDF 24) 後面板照 | PH+PD+UN | STATIC | I05 | 只畫外觀、不可互動、不可作為端子或 10 A 插孔（GAP-DMM-11）。 |
| `DMM.MISC.OVAL_PART` | P1 中層端子區最下方，3A 端子正下方偏左、"CAT II (300V)" 左側的深色橢圓件（原圖約 x579, y595），周圍有凹框 | 無印字 | 被動件（功能不明）；無 | 未找到。D-DMM p.1 (PDF 1) 封面照中 34470A 在同一位置是標有 "Front"／"Rear" 的切換鍵；34460A 無後面板輸入（D-DMM p.3 (PDF 3) "Rear input terminals No"），故此件推論為無功能的封蓋（PD）。 | 無 | 無 | P1 中層；D-DMM p.1 (PDF 1)、p.3 (PDF 3)、p.24 (PDF 24) 後面板照 | PH+PD+UN | STATIC | I05 | 絕對不能做成 Front/Rear 切換（GAP-DMM-12）。；證據細節：PH（存在）+PD（推論）+UN |

### 固定標籤

| ID | 照片位置 | 面板標籤 | 類型／動作 | 功能／影響設定 | 可見回饋 | 參數範圍 | 來源頁 | 證據 | 狀態 | 卡 | 備註 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DMM.MISC.MODEL_LABEL` | P1 中層頂列，LCD 上方由左至右（原圖約 x67–380, y372–382） | Keysight 波形 logo "KEYSIGHT"、"34460A"、"6 1/2 Digit Multimeter"、斜體 "Truevolt" | 印刷標籤；無 | 機型識別；D-DMM p.3 (PDF 3) "Digits of resolution 6½"。 | 無 | 無 | P1 中層；D-DMM p.1 (PDF 1)、p.3 (PDF 3) | PH+DS | STATIC | I05 | 機型確認為 34460A（不是 34461A/65A/70A）。P1 面板為淺灰白色；D-DMM 產品照為黑色面板（見 discrepancies）。 |
| `DMM.MISC.LABEL_200VPK` | P1 中層端子區，Sense HI 右下方括號旁（原圖約 x592, y465），括號連到 Sense LO 與 Input LO 間的連線 | 200 Vpk | 印刷額定標示；無 | Sense 端子相關的額定值；精確意義未找到（D-DMM p.21 只寫 "HI and LO reference (sense) terminals reference to LO input < 12 V"，是 DC Ratio 量測條件）。 | 無 | 200 Vpk（面板印字） | P1 中層；D-DMM p.21 (PDF 21) | PH+UN | STATIC | I05 | 照印，不延伸成模擬器保護門檻。；證據細節：PH+UN（意義） |
| `DMM.MISC.LABEL_1000VDC_750VAC` | P1 中層端子區，Input HI 與 Input LO 之間右側括號（原圖約 x650, y470） | 1000 VDC / 750 VAC | 印刷額定標示；無 | Input HI–LO 最大輸入。D-DMM p.21 (PDF 21)：DCV "Input protection 1,000 V on all ranges"；ACV "Input protection 750 Vrms all ranges"。 | 無 | 1000 VDC；750 VAC | P1 中層；D-DMM p.21 (PDF 21) | PH+DS | STATIC | I05 | 與 DCV 最大量程 1000 V、ACV 最大量程 750 V 一致（p.11）。 |
| `DMM.MISC.LABEL_500VPK_GND` | P1 中層端子區，Input LO 右下方括號（原圖約 x647, y527–542），下接接地符號 | 500 Vpk ＋ ⏚（接地符號） | 印刷額定標示；無 | LO 對大地的額定。D-DMM p.22：「1 kΩ LO lead unbalance (± 500 V peak maximum)」可佐證 LO 端 ±500 V 峰值；面板印字的精確意義仍屬 PD。 | 無 | 500 Vpk（面板印字） | P1 中層；D-DMM p.22 (PDF 22) | PH+DS+PD | STATIC | I05 | 照印即可。 |
| `DMM.MISC.FUSE_WARN` | P1 中層端子區，Input LO 往下接到 I 3A 的連線上（原圖約 x585, y526） | 保險絲符號（▭ 穿線）＋ ⚠ 警告三角 | 印刷符號；無 | 表示電流路徑經保險絲。D-DMM p.21：「Externally accessible 3.15 A, 500 V fuse」；保險絲座位置見 D-DMM p.24 後面板照（套用到校機為 PD）。 | 無 | 3.15 A, 500 V（DS） | P1 中層；D-DMM p.21 (PDF 21)、p.24 (PDF 24) | PH+DS | STATIC | I05 | 保險絲熔斷行為本輪不模擬（見 out_of_scope）。 |
| `DMM.MISC.CAT_II_300V` | P1 中層右下角（原圖約 x627, y595），其下方有 ⚠ 警告三角（原圖約 x627, y609） | CAT II (300V) ＋ ⚠ | 印刷額定標示；無 | 量測類別。D-DMM p.25 (PDF 25)："Measurement Category II to 300 V"。 | 無 | CAT II 300 V | P1 中層；D-DMM p.25 (PDF 25) | PH+DS | STATIC | I05 | — |
| `DMM.MISC.WARN_HV_TOP` | P1 中層右上角，"Input" 標題右方（原圖約 x657, y392） | 三角形內閃電符號（高壓警告） | 印刷符號；無 | 高電壓警告符號（面板印刷）。 | 無 | 無 | P1 中層 | PH | STATIC | I05 | 與下方兩個「!」警告三角不同，請分別繪製。 |

### Keysight 34460A 6½ 核心選單路徑

只列來源有寫的路徑；沒有來源的不補。

| 路徑 | 軟鍵／選項 | 來源 | 證據 | 狀態 | 備註 |
| --- | --- | --- | --- | --- | --- |
| DCV（按 DCV 鍵後的 DCV Number 畫面）→ 軟鍵列 | S1 "Range"〔Auto〕｜S2 "Aperture"〔10 PLC〕｜S3 "Auto Zero"〔Off On〕｜S4 "Input Z"〔10M Auto〕｜S5 "DCV Ratio"〔Off On〕｜S6（空白） | D-DMM p.3 (PDF 3) 34460A 產品照（放大可讀）；D-DMM p.1 (PDF 1) 封面 34460A 產品照（同一組 S1–S5，histogram view 時 S6＝"Clear Readings"） | PD | S1 APPROX（按下＝Range 鍵，PD）；S2–S6 OUT（只顯示標籤） | 只證明該畫面出現過這些標籤與當下值；按下後是否展開下一層、值如何循環、是否為開機預設、韌體版本皆未找到。第一版可照此繪製 DCV 軟鍵標籤。 路徑與標籤只來自 datasheet 行銷照，未經手冊確認（PD）。 |
| Shift → DCV（上方藍字 DCI）→ DCI 畫面 | 未找到（M-DMM 未取得）；暫定只顯示 S1 "Range"（PD） | P1 中層（DCV 上方 "DCI"）；D-DMM p.3 (PDF 3) DCI 100 μA to 3 A | PH（標籤）+DS（功能存在）+PD（Shift 路徑與軟鍵） | APPROX | 核心功能；路徑以面板藍字推論，GAP-DMM-02／04。 |
| ACV → ACV 畫面 | 未找到；D-DMM p.12 (PDF 12) 註 6 指出有 "three filter settings are available: 3 Hz, 20 Hz, 200 Hz"，但設定路徑未找到。暫定只顯示 S1 "Range"（PD） | P1；D-DMM p.11 (PDF 11)、p.12 (PDF 12) | PH+DS+PD | APPROX | AC filter 本輪 OUT；純正弦 1 kHz 測試情境不受 filter 影響。 |
| Shift → ACV（上方藍字 ACI）→ ACI 畫面 | 未找到；暫定只顯示 S1 "Range"（PD） | P1（ACV 上方 "ACI"）；D-DMM p.3 (PDF 3)、p.11–12 (PDF 11–12) | PH+DS+PD | APPROX | 核心功能；路徑推論。 |
| Ω2W → 二線電阻畫面 | 未找到；暫定只顯示 S1 "Range"（PD） | P1；D-DMM p.11 (PDF 11) | PH+DS+PD | APPROX | Offset compensation 等其他選項未找到，不自行加入。 |
| Cont ·)) → 導通畫面 | 未找到；暫定不顯示 Range（D-DMM p.12 (PDF 12) 導通只有 1 kΩ 一檔），不自行加入蜂鳴設定軟鍵 | P1；D-DMM p.12 (PDF 12)、p.21 (PDF 21) | PH+DS+PD | APPROX | 門檻 10 Ω 固定（DS）；是否有蜂鳴開關設定未找到（GAP-DMM-08）。 |
| 前面板 Range／+／−（實體鍵，非軟鍵） | Range：Auto⇄手動（PD）；+：手動升一檔（PD）；−：手動降一檔（PD） | P1 中層（三鍵直列）；D-DMM p.21 (PDF 21) Overload ranging | PH+DS（auto/manual 存在）+PD（鍵語義） | CORE（行為暫定） | GAP-DMM-03。 |
| Null（實體鍵）→ Null on／off | Null 開啟後的軟鍵（基準值編輯等）：未找到 | P1（Null 鍵）；D-DMM p.26 (PDF 26) "Per function null" | PH+DS+PD | CORE（on/off 與擷取基準行為暫定）；基準編輯 OUT | GAP-DMM-07。 |
| Display → view：Number／Bar meter／Histogram | view 名稱來自 datasheet；按鍵／軟鍵路徑未找到 | D-DMM p.3 (PDF 3) Statistical graphics "Histogram, bar meter"；p.4 (PDF 4)；p.26 (PDF 26) | DS+UN（路徑） | OUT（第一版固定 Number view） | 34460A 沒有 Trend chart（p.3、p.26）。 |
| 頂層（本輪未納入，只列名稱）：Freq、Temp、Run/Stop、Single、Acquire | 不列 | P1 中層鍵面字樣 | PH | OUT | 按下顯示範圍說明，不改狀態。 |
| 頂層 Shift 次功能（本輪未納入，只列名稱）：Ω4W（Shift→Ω2W）、二極體（Shift→Cont）、Reset（Shift→Run/Stop）、Probe Hold（Shift→Single）、Math（Shift→Null）、Utility（Shift→Display）、Help（Shift→Acquire） | 不列 | P1 中層藍字次標籤；Probe Hold／Math 內容見 D-DMM p.26 (PDF 26) | PH+PD（Shift 對應） | OUT | Probe Hold 不可做成任意 Freeze。 Local 不是 Shift 次功能（印在 Shift 鍵下方的黑字），另見 DMM.KEY.SHIFT。 |
