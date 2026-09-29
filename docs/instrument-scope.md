# 四台儀器：核心功能、規格、未納入、資料缺口與暫定行為（I00）

> 由 `docs/data/*.json` 經 `node scripts/render-i00-docs.mjs` 產生。控制項逐列見 `docs/control-matrix.md`，來源見 `docs/sources.md`。
> 「暫定」表示有明確規格可實作，但未證實與校機相同，I01–I05 必須在儀器外標示「近似／待校機確認」。

## 0. 四台共通

### 0.1 目前沒有、也不要求使用者一次補齊的校機資訊（I00-4）

| 項目 | 四台現況 | 暫定做法 | 理由 | 日後怎麼確認 |
|---|---|---|---|---|
| 韌體版本 | 四台都未知（照片 LCD 全暗；支援頁或 release notes 的日期不是校機版本證據） | 行為依本包手冊版本（M-AFG Ver.B、M-TDS-13、M-GPE 2019-10-02、D-DMM）；34460A 另見 GAP-DMM | 手冊是目前唯一正文來源 | 校機開機畫面或 Utility／System Info 拍照 |
| LCD 語言 | 四台都未知。TDS 前面板貼了中文標籤，不代表 LCD 選單是中文；但 M-TDS-13 p.1 說開機可選螢幕語言，校機可能是中文（GAP-TDS-25） | LCD 文字一律用手冊英文；中文說明只放儀器外 | 手冊只有英文選單名稱，編造中文選單會誤導學生 | 亮屏正面照 |
| 開機畫面與開機記憶 | 四台都未知；手冊有寫的另列在各機 gap（例如 GPE 預設開機 Output OFF、4 位數顯示） | 模擬器的「電源開」＝回到該台已定義的重設狀態，並在儀器外標示「非校機開機記憶」；不宣稱等同校機 | 開機記憶依學校使用習慣而變，照片無法證明 | 校機關機再開，記錄畫面 |
| 學校實際使用的探棒與倍率 | 未知（P2 沒拍到探棒） | 測試情境明示實際探棒倍率（1× 或 10×），跟示波器 Probe 設定分開 | 02 要求兩者分開，錯配要按比例錯讀 | 拍探棒型號與開關 |
| 旋鈕實際步進、長按時間、按鍵重複速度 | 手冊只寫到部分（見各機 gap） | I01 定共用旋鈕：拖曳＋聚焦後方向鍵細調；步進依各機手冊，沒寫的標近似 | 不能讓滾輪意外改值；在家練的是操作順序，不是手感 | 校機操作短片 |
| 蜂鳴器、錯誤訊息文字 | 大多未知 | 不播放聲音；錯誤只在儀器外用近似說明，不偽造原廠錯誤碼 | 02 禁止偽造錯誤碼 | 校機操作與手冊錯誤訊息章節 |

### 0.2 共通暫定規則（I01 定案、各卡沿用）

1. **電源鍵**：四台都有實體電源鍵，列 APPROX。按下只切換「模擬電源」：關＝面板變暗、輸出 descriptor 無效、量測無效；開＝AFG、GPE、34460A 回到該台的已定義重設狀態（手冊沒寫開機記憶）；**TDS2001C 例外**，依 M-TDS-13 p.20 回復關機前的設定、清除採集。重設狀態與原廠 Preset／Default Setup 分開記錄。
2. **設定值、暫存輸入、有效輸出分三層**：數字輸入緩衝未提交前不改設定；設定值不等於端子上的有效值（Output OFF、負載、量程都會影響）。
3. **未納入的按鍵**：保留外觀與位置，按下只在儀器外顯示「本輪未納入：…」，不改任何儀器狀態、不顯示成功。I01 要有共用元件做這件事，I06 逐列對照本矩陣抽查。
4. **測試情境（fixture）**：S1、S2、S3、L1、D1 放在儀器外、明示「單機測試情境」，只餵給選定的那一台；沒有接線引擎前，畫面要說明四台是獨立練習、沒有互相連接。
5. **LCD 內容**：只顯示手冊有來源的欄位與選單名稱；沒有來源的欄位（例如 AFG 的 Period）不得出現在 LCD 上。教學換算放儀器外。
6. **證據標示**：APPROX 列在儀器外的「功能範圍說明」逐條標示；OUT 列在按下時提示。reviewer 會分開評「模型一致性」和「與原廠證據相符」。

### 0.3 驗收方式總表

| 卡 | 本矩陣提供什麼 | 驗收怎麼用 |
|---|---|---|
| I00 | 控制矩陣、規格、缺口、來源分級 | 獨立 reviewer 對照 P1／P2 與手冊頁逐列抽查；`node scripts/check-control-matrix.mjs` 只驗結構與照片硬性數量 |
| I01 | 穩定 ID、STATIC／OUT 處理規則、共用旋鈕與輸入規則 | DOM 以同一 ID 標記；e2e 用真滑鼠／鍵盤；可寫測試逐列確認 ID 存在、OUT 列按下不改狀態 |
| I02–I05 | 每台 CORE／APPROX 列、選單路徑、規格與 gap 的暫定行為 | 03 的 I02-1…I05-7 案例；APPROX 行為要跟本檔寫的暫定規格一致 |
| I06 | 全部列 | 逐列對照照片與本矩陣：數量、分組、標籤、端子；未納入不假成功 |

**證據界線：** 本卡沒有接觸任何校機，也還沒有應用程式。這裡的 OT 只代表「手冊某頁這樣寫」，不代表校機或模擬器已驗證。

## 1. GW Instek AFG-2225 任意波形訊號產生器（I02）

### 核心功能與驗收規則

| ID | 功能 | 可驗收規則 | 來源 | 證據 | 驗收（03 案例） |
| --- | --- | --- | --- | --- | --- |
| AFG-F01 | CH1／CH2 獨立設定 | 每個通道各自保存波形、頻率、幅度（值與顯示單位）、offset、SYM、Load、Output。CH1/CH2 鍵只改變目前選取的通道（並顯示 CH 選單），不覆寫另一通道。LCD 同時顯示兩個通道的 status tab 與參數窗。 | M-AFG p.14, p.18, p.51, p.144 (PDF 同)；P1 | PH+OT；按鍵語義為 PD（GAP-AFG-01） | I02-2：CH1 設 Sine 1 kHz 2 Vpp，CH2 設 Ramp SYM 50% 10 kHz 1 Vpp；按 CH1/CH2 來回至少 3 次，兩通道的值都不變。 |
| AFG-F02 | 波形選擇 Sine／Square／Ramp | Waveform → F1 Sine／F2 Square／F4 Ramp 只改目前選取通道的波形，LCD 波形區隨之更新。F3 Pulse、F5 Noise 只顯示範圍說明，不改狀態。 | M-AFG p.18, p.44, p.55–59 (PDF 同) | OT | I02-8、I02-5：用真 UI 依序選三種波形並確認 LCD 顯示；按 Pulse、Noise 時波形狀態不變，並出現範圍說明。 |
| AFG-F03 | 三角波＝Ramp＋SYM 50% | Waveform → F4 Ramp → F1 SYM → 5、0 → F2 % 把 SYM 設為 50.0%，LCD 顯示「SYMM: 50.0 %」並畫出對稱三角波。SYM 範圍 0%–100%，解析度 0.1%。介面不得出現 Triangle 軟鍵。 | M-AFG p.27, p.58–59, p.289 (PDF 同) | OT | I02-8：照上述按鍵序列操作，檢查 SYM=50.0% 與波形；另輸入 101 → % 應被拒絕，原值不變（暫定）。 |
| AFG-F04 | 頻率輸入（數字＋單位軟鍵），上限依波形而定 | FREQ/Rate → 數字 → F1 uHz／F2 mHz／F3 Hz／F4 kHz／F5 MHz 提交。Sine／Square 1 μHz–25 MHz，Ramp 1 μHz–1 MHz，解析度 1 μHz。超出範圍的輸入暫定拒絕，原值保留。 | M-AFG p.27, p.60–61, p.208, p.288 (PDF 同) | OT；拒絕方式為 PD | I02-1：輸入 1 kHz（1＋F4），再輸入 1 MHz（1＋F5），LCD 顯示相應改變；I02-5：Ramp 時輸入 2 MHz 被拒絕，Sine 時輸入 25 MHz 被接受。 |
| AFG-F05 | 旋鈕與方向鍵微調 | ◀▶ 移動游標位數；旋鈕順時針以該位數為步進增加，逆時針減少。結果超出範圍或違反聯合限制時該步不生效（暫定）。 | M-AFG p.14–15, p.23 (PDF 同) | OT；超界處理為 PD | I02-1：在 1.000000 kHz 把游標移到 kHz 個位，旋鈕順時針一格得 2 kHz，逆時針回到 1 kHz，結果可重現。 |
| AFG-F06 | 幅度輸入與單位換算 | AMPL → 數字 → F1 dBm／F2 mVRMS／F3 VRMS／F4 mVPP／F5 VPP。50 Ω 時 1 mVpp–10 Vpp，High Z 時 2 mVpp–20 Vpp（20–25 MHz 時分別為 5 Vpp／10 Vpp）。Vrms 與 dBm 必須依波形 crest factor 真的換算數值，不能只換文字：sine 10 Vpp＝3.536 Vrms；其他波形與 dBm 的算法為暫定。 單位換算後先依顯示解析度（1 mV 或 3 位有效數字）捨入，再做範圍與聯合限制檢查（PD）。 | M-AFG p.61–62, p.202–203, p.288 (PDF 同) | OT+PD（非 sine 換算與 dBm 公式） | I02-4、I02-5：Sine、50 Ω 下輸入 3.535 VRMS 後顯示約 9.998 Vpp；輸入 11 VPP 被拒絕且原值保留。 |
| AFG-F07 | DC Offset 輸入 | DC Offset → 數字（可用 +/- 輸入負值）→ F1 mVDC／F2 VDC。50 Ω 時 ±5 Vpk，High Z 時 ±10 Vpk，並受聯合限制約束。 | M-AFG p.62–63, p.289 (PDF 同) | OT；+/- 鍵功能為 PD | I02-5：50 Ω、2 Vpp 時輸入 -3 VDC 被接受；輸入 -4.5 VDC 被拒絕，原值保留。 |
| AFG-F08 | 幅度＋offset 聯合限制（共用檢查） | \|Voffset\| + Vpp/2 ≤ Vmax，Vmax＝5 V（50 Ω）或 10 V（High Z），20–25 MHz 時為 2.5／5 V。改 AMPL、Offset、FREQ、波形、Load 都走同一個檢查；非法輸入不污染已提交的值（暫定拒絕，不偽造原廠錯誤碼）。（Vmax 數值由 p.289 推定，手冊公式本身未定義 Vmax：PD） | M-AFG p.202, p.210–211, p.289, p.63 (PDF 同) | OT+PD | I02-5：50 Ω 下 10 Vpp＋0 V 接受（p.28 範例）；4 Vpp＋3 V 接受；4 Vpp＋3.5 V 被拒絕，原值不變。 |
| AFG-F09 | 各通道 Output 狀態 | OUTPUT 切換目前選取通道的 ON／OFF，LCD status tab 顯示「CHn ON／OFF」。OFF 時所有設定保留，source descriptor 標為 enabled=false、端子高阻（>10 MΩ）。Output、選取通道、電源是三個獨立狀態。 | M-AFG p.14, p.18, p.53, p.214, p.289 (PDF 同) | OT；「作用於選取通道」為 PD | I02-2、I02-3：CH1 ON 且 CH2 OFF 可以並存；OFF 時改參數會被保留，descriptor 未啟用；ON 後才成為有效來源。 |
| AFG-F10 | Load 50 Ω／High Z（顯示參照） | CH1/CH2 → F1 Load → F1 50 OHM／F2 High Z。Load 只改變幅度與 offset 顯示所參照的負載：50Ω→High Z 顯示值 ×2，反向 ÷2。內部輸出阻抗永遠是 50 Ω，實際輸出不因切換而跳變。 | M-AFG p.144–145, p.202–203, p.210–211, p.214–215, p.289 (PDF 同) | OT+PD（面板顯示換算取自遠端說明） | I02-4：Preset 後切 High Z，顯示 6.000 Vpp／0.00 V；若 offset 為 1 V 則變成 2 V；切回 50 Ω 顯示 3.000 Vpp；descriptor 的內阻始終為 50 Ω、EMF 不變。 |
| AFG-F11 | High Z 時禁止 dBm | Load＝High Z 時拒絕 dBm 單位；若切換前單位是 dBm，切換後改成 Vpp。 | M-AFG p.202, p.210, p.215, p.278 (PDF 同) | OT（遠端章節）+PD（面板呈現） | I02-4：50 Ω 下設 13.52 dBm 後切 High Z，顯示改為 Vpp 且數值 ×2；在 High Z 下按 dBm 被拒絕。 |
| AFG-F12 | 切換波形時重新檢查頻率 | 切到 Ramp 而頻率 >1 MHz 時，頻率降為 1 MHz 並提示（依遠端說明的近似）；之後重新檢查幅度與 offset 的聯合限制。 | M-AFG p.207, p.209, p.277 (PDF 同) | OT（遠端章節）+PD | I02-5：Sine 5 MHz 切到 Ramp，頻率變成 1 MHz 並出現近似提示。 |
| AFG-F13 | Preset | 按 Preset 後（暫定兩通道都套用）：Sine、1 kHz、3.000 Vpp、0.00 V、單位 Vpp、Load 50 Ω、Output OFF；SYM／Duty 暫定 50%，Phase 0°。 Preset 同時把 MOD、Sweep、Burst 設為 Off（本輪這三者本來就 OUT，只需保持 Off）。 | M-AFG p.52–53, p.212–213 (PDF 同) | OT+PD（套用範圍與未列項目） | I02-7：任意設定後按 Preset，檢查 LCD 與兩通道 descriptor 都回到上列值。 |
| AFG-F14 | 軟鍵依情境改變意義；Return | F1–F5 的意義依目前上層選單而定（見 menus），空白軟鍵無動作。Return 回上一層。未按單位鍵的半截輸入不成為有效輸出（暫定：Return 或換功能時捨棄）。 | M-AFG p.13, p.18, p.23, p.44 (PDF 同) | OT+PD（提交語義） | I02-6：按 FREQ/Rate 後 F4＝kHz，按 AMPL 後 F4＝mVPP；輸入 5 後按 Return，頻率不變。 |
| AFG-F15 | 未納入的鍵要明示範圍 | ARB、MOD、Sweep、Burst、UTIL，以及 Pulse、Noise、Duty、Phase、DSO Link，只顯示實際選單名稱與範圍說明，不改狀態，不出現成功訊息。 | M-AFG p.14, p.29–51 (PDF 同) | OT+PD（UI 處理方式） | I02-7、I02-8：逐一按下這些鍵，確認狀態與 descriptor 都沒改變。 |
| AFG-F16 | LCD 與狀態同源 | status tab、參數窗、波形區、軟鍵標籤全部從同一份儀器狀態產生；Phase 列顯示 0.0°（本輪不可編輯）；不新增 Period 欄位。 | M-AFG p.18, p.55–63 截圖 (PDF 同) | OT | I02-1 至 I02-8：每一步都比對 LCD 與唯讀 debug 狀態是否一致。 |

### 規格、範圍與預設值

| 項目 | 值 | 來源 | 證據 | 原文 |
| --- | --- | --- | --- | --- |
| 頻率範圍：Sine | 1 μHz–25 MHz | M-AFG p.60 (PDF 60)；p.208；p.288 | OT | Sine wave 1μHz~25MHz |
| 頻率範圍：Square | 1 μHz–25 MHz | M-AFG p.60 (PDF 60)；p.208；p.288 | OT | Square wave 1μHz~25MHz |
| 頻率範圍：Ramp（含 SYM 50% 三角波） | 1 μHz–1 MHz | M-AFG p.61 (PDF 61)；p.208；p.288 只寫「Ramp 1MHz」 | OT | Ramp wave 1μHz~1MHz |
| 頻率範圍：Pulse（OUT）／Noise（OUT） | Pulse 500 μHz–25 MHz；Noise 不適用頻率 | M-AFG p.60 (PDF 60)；p.208–209 | OT | Pulse wave 500μHz~25MHz / Noise Not applicable |
| 頻率解析度 | 1 μHz（全頻段） | M-AFG p.11 (PDF 11)；p.288 | OT | 1μHz high frequency resolution maintained at full range |
| 頻率單位軟鍵 | F1 uHz、F2 mHz、F3 Hz、F4 kHz、F5 MHz | M-AFG p.60–61 (PDF 60–61) 截圖；p.27 | OT | Choose a frequency unit by pressing F1~F5. |
| 幅度範圍（20 MHz 以下；20–25 MHz 另列） | 50 Ω：1 mVpp–10 Vpp；High Z（open-circuit）：2 mVpp–20 Vpp | M-AFG p.61–62 (PDF 61–62)；p.288 | OT | 1mVpp to 10 Vpp (into 50Ω) / 2mVpp to 20 Vpp (open-circuit) |
| 幅度範圍（20–25 MHz） | 50 Ω：1 mVpp–5 Vpp；open-circuit：2 mVpp–10 Vpp | M-AFG p.288 (PDF 288) | OT | 1mVpp to 5 Vpp (into 50Ω) for 20MHz-25MHz |
| 幅度單位與軟鍵 | Vpp、Vrms、dBm；F1 dBm、F2 mVRMS、F3 VRMS、F4 mVPP、F5 VPP | M-AFG p.61–62 (PDF 61–62) 截圖；p.288 | OT | Unit Vpp, Vrms, dBm |
| 幅度解析度與準確度 | 解析度 1 mV 或 3 位；準確度 ±2% of setting ±1 mVpp（1 kHz） | M-AFG p.288 (PDF 288) | OT | Resolution 1mV or 3 digits |
| Vpp／Vrms 換算（crest factor） | Sine：10 Vpp ↔ 3.536 Vrms；5 Vrms 方波改成正弦時變成 3.536 Vrms。其他波形與 dBm 的公式手冊沒有給（GAP-AFG-11） | M-AFG p.202–203, p.207, p.210 (PDF 同) | OT（只有 sine 與方波例） | a 5Vrms square wave must be adjusted to 3.536 Vrms for a sine wave |
| Offset 範圍 | 50 Ω：±5 Vpk；High Z：±10 Vpk（20–25 MHz 時為 ±2.5／±5 Vpk）。「Vpk ac +dc」表示峰值（幅度加 offset）的限制 | M-AFG p.62–63 (PDF 62–63)；p.289 | OT | ±5 Vpk ac +dc (into 50Ω) / ±10Vpk ac +dc (Open circuit) |
| 幅度＋Offset 聯合限制 | 手冊公式 \|Voffset\| < Vmax − Vpp/2，但手冊沒有定義 Vmax。依 p.289「Vpk ac +dc」推定 Vmax＝5 V（50 Ω）／10 V（High Z），20–25 MHz 時為 2.5／5 V。暫定實作 \|Voffset\| + Vpp/2 ≤ Vmax（等號邊界待校機） | M-AFG p.202, p.210, p.211 (PDF 同)；p.289 | OT+PD | The offset and amplitude are related by the following equation. \|Voffset\| < Vmax – Vpp/2 |
| Offset 單位軟鍵 | F1 mVDC、F2 VDC | M-AFG p.62 (PDF 62) | OT | Press F1 (mVDC) or F2 (VDC) to choose a voltage range. |
| Offset 準確度（非核心） | 2% of setting + 20mV + 0.5% of amplitude（渲染字形為 20mV；文字層抽出 10mV） | M-AFG p.289 (PDF 289) | OT | 2% of setting + 20mV+ 0.5% of amplitude |
| 內部輸出阻抗 | 50 Ω typical，固定不變；輸出關閉時 >10 MΩ | M-AFG p.289 (PDF 289) | OT | 50Ω typical (fixed) / > 10MΩ (output disabled) |
| Load 設定（面板） | CH1/CH2 → F1 Load → F1 50 OHM／F2 High Z；預設 50 Ω；只作參照 | M-AFG p.144–145 (PDF 同) | OT | The output impedances are to be used as a reference only. If the actual load impedance is different to that specified, then the actual amplitude and offset will vary accordingly. |
| High Z 的定義 | INFinity＝high impedance >10 kΩ | M-AFG p.214 (PDF 214) | OT（遠端說明） | DEFault (50Ω) and INFinity (high impedance >10 kΩ) |
| 切換 Load 時顯示值的換算 | 50Ω→High Z：幅度與 offset 顯示值 ×2；High Z→50Ω：÷2（內部 EMF 不變） | M-AFG p.202–203, p.210–211, p.214–215 (PDF 同) | OT（遠端章節）+PD（套用到面板顯示） | If the amplitude has been set and the output termination is changed from 50Ω to high impedance, the amplitude will double. Changing the output termination from high impedance to 50Ω will half the amplitude. |
| High Z 時不能用 dBm | Load＝High Z 時不能用 dBm；原單位若為 dBm 會自動改成 Vpp | M-AFG p.202, p.210, p.215, p.278 (PDF 同) | OT（遠端章節） | If the output termination is set to high impedance, dBm units cannot be used. The Units will automatically default to Vpp. |
| Ramp Symmetry | 0%–100%，解析度 0.1%；預設 50%；切換波形後保留該設定 | M-AFG p.59 (PDF 59)；p.213；p.289（範圍／解析度：p.59、p.289 面板與規格；預設 50% 與切換保留：p.213 遠端章節，套用到面板屬 PD） | OT+PD | Variable Symmetry 0% to 100% (0.1% Resolution) |
| Square Duty（OUT，供參考） | ≤100kHz：1.0%–99.0%；100kHz–≤1MHz：10.0%–90.0%；>1MHz–25MHz：固定 50%；預設 50% | M-AFG p.56 (PDF 56)；p.212；p.289 | OT | >1MHz~25MHz 50% (Fixed) |
| Preset 預設值 | Output：Function Sine、Frequency 1kHz、Amplitude 3.000 Vpp、Offset 0.00V dc、Output units Vpp、Output terminal 50Ω；Modulation／Sweep／Burst status 皆 Off（各自參數回預設）；System：Power off signal On、Display mode On、Error queue Cleared、Memory settings No change、Output Off；Trigger source Internal (immediate)；Calibration Menu Restricted | M-AFG p.52–53 (PDF 同) | OT | The Preset key is used to restore the default panel settings. |
| 遠端預設幅度（不採用於 Preset） | 100 mVpp（50 Ω） | M-AFG p.202, p.210 (PDF 同) | OT（遠端章節） | The default amplitude for all functions is 100 mVpp (50Ω). |
| Output 預設 | OFF | M-AFG p.53 (PDF 53)；p.214 | OT | Enables/Disables or queries the front panel output from the selected channel. The default is set to off. |
| 切換波形時的頻率處理（遠端說明） | 新波形不支援目前頻率時會自動調整；切到 Ramp 會降低頻率 | M-AFG p.207, p.209, p.277 (PDF 同) | OT（遠端章節） | -221 Settings conflict; frequency reduced for ramp function |
| 超限值處理（遠端說明） | 遠端命令會把超限值夾到最大／最小值並記錯；面板行為 UN | M-AFG p.201, p.202, p.278–279 (PDF 同) | OT（遠端章節） | If the amplitude was set to a value out of range ,it is automatically set to an upper or lower limit. |
| 數字編輯方式 | ◀▶ 選位數，旋鈕順時針增加、逆時針減少；或用數字鍵輸入再按單位鍵 | M-AFG p.23–24 (PDF 同)；p.60–62 | OT | Use the scroll wheel to edit the parameter. Clockwise increases the value, counter clockwise decreases the value. |
| LCD | 3.5 吋彩色 TFT，320×240 | M-AFG p.12–13 (PDF 同) | OT | 3.5 inch Color TFT LCD (320 X 240) |
| 開機 | 開機顯示 loading screen；開機後的設定手冊沒寫 | M-AFG p.20 (PDF 20) | OT+UN | When the power switch is turned on the screen displays the loading screen. |
| 輸出保護（非核心） | 短路保護；過載時繼電器自動關閉主輸出 | M-AFG p.289 (PDF 289)；p.214 | OT | Overload relay automatically disables main output |
| Phase（OUT，供參考） | -180°–180°；Square 與 Pulse 不能改，固定 0° | M-AFG p.145 (PDF 145)；p.291–292 | OT | Square and Pulse can not be change,phase is 0° |

### 本輪未納入

| 項目 | 理由 | 面板處理 |
| --- | --- | --- |
| Pulse 波形與 Width 參數（Waveform→F3） | 02 本輪未納入 Pulse 完整參數 | 保留 F3 Pulse 軟鍵標籤；按下時在儀器外顯示範圍說明，波形狀態不變 |
| Noise 波形（Waveform→F5） | 02 本輪未納入 | 同上 |
| Square Duty／TTL | 02 必做只有方波基本輸出，Duty 不在清單內 | Square 子選單顯示 Duty、%、TTL 標籤；Duty 固定 50%；按下時顯示範圍說明 |
| ARB（Display／Edit／Built in／Output／More） | 02 未納入 ARB 編輯 | 按 ARB 顯示頂層名稱與範圍說明，不改狀態 |
| MOD（AM／FM／FSK／PM／SUM） | 02 未納入完整 MOD | 同上 |
| Sweep | 02 未納入 | 同上 |
| Burst | 02 未納入 | 同上 |
| UTIL（Memory、Cal.、System：Language／Help／Beep、Dual Chan：Freq Cpl／Ampl Cpl／Tracking／S_Phase、Counter） | 02 必做沒有列入；耦合與追蹤會破壞「兩通道獨立」的驗收 | 按 UTIL 顯示頂層名稱與範圍說明；耦合與追蹤固定 Off |
| CH1/CH2 → Phase／S_Phase、DSO Link | 02 未列 | CH 選單顯示 F4 Phase、F5 DSO Link 標籤，按下顯示範圍說明；LCD 的 Phase 固定 0.0° |
| 遠端控制（USB Device、SCPI、REM/LOCK） | 02 未納入 | 不提供；在功能矩陣列出 |
| 後面板端子與埠（Trigger IN／OUT、MOD IN、Counter IN、USB Host／Device、AC、風扇） | 照片未見，且功能未納入 | 不繪後面板；在功能矩陣列為 OUT |
| 過載保護與錯誤訊息 | 手冊只有遠端 SCPI 錯誤碼，沒有面板訊息字樣 | 不偽造原廠錯誤碼；超限時在儀器外顯示近似提示 |
| 20–25 MHz 平坦度、失真、上升時間等類比性能 | 不在第一階段範圍 | 不模擬；範圍說明中註明 |

### 資料缺口與暫定行為

| ID | 缺口 | 影響 | 暫定行為 | 理由 | 日後驗證 |
| --- | --- | --- | --- | --- | --- |
| GAP-AFG-01 | CH1/CH2 鍵的精確語義：按一次是切換選取通道、開啟 Load／Phase／DSO Link 選單，還是兩者都做？ | 通道選取與 Load 設定路徑（I02-2、I02-4） | 每按一次就在 CH1 與 CH2 之間切換選取通道，同時顯示該通道的 CH 選單（F1 Load、F4 Phase、F5 DSO Link）；在儀器外標示為近似 | p.14 說「switch between the two output channels」，p.144 的 Load 步驟又是「Press the CH1/CH2 key → F1 (Load)」，兩者合起來最直接的讀法就是這樣 | 校機：Preset 後按 CH1/CH2 一次，看哪個 status tab 變亮、軟鍵是否出現 Load；再按一次看會不會切回。也可查原廠是否有更新版手冊或 Quick Start Guide |
| GAP-AFG-02 | OUTPUT 鍵作用於哪個通道，以及按鍵本身會不會亮 | Output 回饋（I02-2、I02-3） | 只切換目前選取通道；以 LCD status tab「CHn ON／OFF」為準。按鍵不做發光效果；若日後要加，須標 APPROX，並跟隨選取通道的狀態 | 手冊全文搜尋 light／LED／illuminat 都沒有相關說明；p.18 顯示兩通道 ON／OFF 各自獨立 | 校機：CH1 ON、CH2 OFF 時，切換選取通道並觀察 OUTPUT 鍵是否發光 |
| GAP-AFG-03 | 數字輸入的提交與取消：沒按單位鍵就按 Return、按其他功能鍵或切通道時，輸入是否提交 | I02-6 | 只有按單位軟鍵（或 SYM 的 %）才提交；Return、換功能、切通道都捨棄輸入，原值保留 | 手冊所有範例都是「數字＋單位鍵」；02 也要求半截輸入不能成為有效輸出 | 校機：FREQ/Rate 輸入 5 後分別按 Return、AMPL，看頻率有沒有變 |
| GAP-AFG-04 | 旋鈕調整是否立即生效；游標可移動的位數範圍；越界時是停住、夾到極值還是拒絕 | I02-1 | 旋鈕調整立即生效（改到已提交值）；越界那一步不生效；游標可在顯示的位數之間移動 | p.23 只寫順時針增加、逆時針減少 | 校機：在 Ramp 1 MHz 時把旋鈕往上轉；在 Sine 3 Vpp 時用旋鈕把幅度往上加到超限 |
| GAP-AFG-05 | 面板上超限時的處理方式與訊息字樣 | I02-5 | 拒絕輸入並保留原值；在儀器外顯示近似提示（例如「超出 AFG-2225 範圍，已保留原值（近似行為）」）；不偽造原廠錯誤碼 | 手冊只有遠端的「夾到極值＋SCPI 錯誤碼」說明；02 允許明示的暫定拒絕 | 校機：50 Ω 下輸入 12 VPP，以及在 4 Vpp 時輸入 3.5 VDC，觀察 LCD |
| GAP-AFG-06 | 開機狀態（回到上次設定，還是固定預設） | POWER 鍵 | 模擬器開機＝Preset 值，兩通道 Output OFF，並標示近似 | p.20 只說開機顯示 loading screen；p.53 的 Output Off 是 Preset 表，不是開機值；p.127 只說 Burst trigger source 開機為 Internal。三處都沒有寫基本參數的開機值，所以仍是 UN | 校機：改設定後關機再開，看開機後的設定 |
| GAP-AFG-07 | Preset 是否兩通道都套用；SYM、Duty、Phase、耦合的重設值；Preset 後的選取通道與顯示的選單 | I02-7 | 兩通道都套用 p.52 的值；SYM、Duty 為 50%（p.212–213 遠端預設），Phase 0°，耦合與追蹤 Off，選取 CH1，軟鍵顯示 Waveform 選單 | p.52 的預設表只列部分參數 | 校機：兩通道各設不同值、SYM 30%，按 Preset 後檢查 |
| GAP-AFG-08 | 面板切換 Load 時的顯示換算、High Z 時 status tab 的字樣、High Z 時 dBm 軟鍵是否隱藏 | I02-4 | 顯示值 ×2 或 ÷2（依遠端說明）；status tab 顯示「High Z」（取軟鍵名稱）；dBm 軟鍵仍顯示，但按下會被拒絕並提示 | p.144 面板章節只說「reference only」；遠端 p.214–215 才寫明倍率 | 校機：Preset 後切 High Z，看 AMPL 是否變 6.000 Vpp、tab 字樣、F1 標籤 |
| GAP-AFG-09 | 20–25 MHz 限制的邊界（剛好 20 MHz 算哪一段）；已有大幅度時把頻率調到 20 MHz 以上會怎樣 | I02-5 | 20 MHz ≤ f ≤ 25 MHz 使用縮減後的上限；調頻率會造成幅度或 offset 非法時，拒絕這次頻率輸入 | p.288 只寫「for 20MHz-25MHz」 | 校機：8 Vpp、1 MHz 時輸入 22 MHz，觀察結果 |
| GAP-AFG-10 | 面板上從 Sine 切到 Ramp、而頻率 >1 MHz 時的行為 | I02-5 | 頻率夾到 1 MHz 並給近似提示 | 遠端 p.209 與 p.277 的「frequency reduced for ramp function」是唯一來源 | 校機：Sine 5 MHz 時選 Ramp |
| GAP-AFG-11 | 非正弦波的 Vrms 換算與 dBm 公式；只按單位鍵、沒輸入數字時，是換算顯示單位還是別的行為 | I02-4 單位 | Square（50%）Vrms＝Vpp/2；Ramp 與三角波 Vrms＝Vpp/(2√3)；dBm＝10·log10(Vrms²/50Ω/1mW)（以 50 Ω 為參照）。只按單位鍵時換算目前值的顯示單位，物理幅度不變 | 手冊只給 sine 的 3.536 Vrms 與方波 5 Vrms 例子（p.202–203） | 校機：3 Vpp 的 sine、square、ramp 分別按 VRMS 與 dBm，記錄讀數 |
| GAP-AFG-12 | +/- 鍵的功能 | Offset 負值輸入 | 切換輸入中數值的正負號；不可為負的參數在提交時拒絕 | p.15 有畫出此鍵，但沒有說明 | 校機：DC Offset 輸入 2、按 +/-、再按 VDC |
| GAP-AFG-13 | Offset 與幅度的顯示位數，以及用 mVDC 時的顯示格式 | LCD 顯示 | 依截圖：AMPL 3 位小數（Vpp）、Offset 2 位小數（VDC）、FREQ 參數窗 7 位有效數字、編輯框精確到 μHz。mVDC 格式暫定為整數 mV | 只有截圖可參考，沒有正文規則 | 校機觀察各單位的顯示 |
| GAP-AFG-14 | LCD 語言（English／中文）與韌體版本 | LCD 字樣 | 用英文（與手冊截圖相同），並標示校機語言待確認 | 照片 LCD 全暗；p.51 顯示有中文選項 | 校機亮屏拍照；UTIL→Cal.→Software→Version（p.137） |
| GAP-AFG-15 | 開機或 Preset 後預設高亮的參數與顯示的軟鍵選單；空白軟鍵的行為 | I02-6 | 沒有參數高亮時旋鈕不作用；空白軟鍵不作用 | 手冊沒寫 | 校機：Preset 後直接轉旋鈕、按空白軟鍵 |
| GAP-AFG-16 | 從 Ramp 切到其他波形再切回時，SYM 是否保留（面板） | I02-8 | 每個通道保留自己的 SYM | 遠端 p.213：「The setting is remembered if the function mode is changed.」 | 校機：SYM 設 30%，切 Sine 再切回 Ramp |
| GAP-AFG-17 | UTIL 選單是否也有 Load／輸出阻抗入口（p.14 說有，p.51 選單樹沒有） | AFG.KEY.UTIL、Load 操作路徑 | 只做 CH1/CH2 → F1 Load → F1 50 OHM／F2 High Z；UTIL 本輪 OUT | p.144 有逐步操作，比 p.14 的概述具體 | 校機逐層打開 UTIL 選單，確認有無 Load 或 Impedance 項 |
| GAP-AFG-18 | 幅度單位為 Vrms／dBm 時切換波形，保留的是 Vpp 還是 Vrms（p.207 只有遠端的 5 Vrms 方波→正弦例子） | AFG.KEY.WAVEFORM、AMPL 顯示 | 保留物理 Vpp（內部 EMF）不變，Vrms／dBm 顯示依新波形的 crest factor 重算；若換算後超限，沿用 GAP-AFG-05 的拒絕／提示方式 | 與 GAP-AFG-11 的「只換顯示單位不改物理幅度」一致；p.207 的遠端例子語意不同，不直接套用 | 校機：Square 設 5 Vrms 後切到 Sine，記錄顯示值與示波器量到的 Vpp |

### 來源差異

| 主題 | 來源 A | 來源 B | 採用 |
| --- | --- | --- | --- |
| Load 在哪個選單 | M-AFG p.14 (PDF 14)：UTIL key 可用來設定「output impedance settings」 | M-AFG p.51 選單樹與 p.144–145 操作步驟：CH1/CH2 → F1 Load → 50 OHM／High Z；UTIL 選單樹裡沒有 Load | 暫定採 p.144 操作步驟與 p.51 選單樹：CH1/CH2 → F1 Load。UTIL 裡是否也有入口未知，列 GAP-AFG-17 待校機。 |
| 「output impedance」這個用詞與實際內阻 | M-AFG p.144：「selectable output impedances: 50Ω or high impedance」 | M-AFG p.289：「Impedance 50Ω typical (fixed)」；p.144／p.214：「to be used as a reference only」 | Load 是顯示幅度的負載參照，內部 50 Ω 固定不變（符合 02）。p.144 的「selectable output impedances」屬於用詞不精確，不照字面實作。 |
| 預設幅度：面板 Preset 與遠端說明 | M-AFG p.52：Preset 的 Amplitude 為 3.000 Vpp | M-AFG p.202、p.210：「The default amplitude for all functions is 100 mVpp (50Ω).」 | Preset 鍵採 p.52（面板章節，是專門針對 Preset 的表）；100 mVpp 屬於 SCPI DEFault 與 APPLy 的語境。兩者都不能證明開機值（GAP-AFG-06）。 |
| 聯合限制的邊界 | M-AFG p.202／p.210／p.211：\|Voffset\| < Vmax – Vpp/2（嚴格小於） | M-AFG p.288–289：10 Vpp（50 Ω）與「±5 Vpk ac +dc」；p.28 範例：Sine 10Vpp 接 50Ω。若照嚴格不等式，10 Vpp＋0 V offset 會變成非法 | 暫定採 \|Voffset\| + Vpp/2 ≤ Vmax（PD）；等號邊界待校機確認。 |
| 遠端 APPLy 的 offset 參數 vs 面板 offset 範圍 | M-AFG p.203–206：<offset> -4.99V~4.99V (50Ω) | M-AFG p.63：Range ±5Vpk；p.289：±5 Vpk ac+dc | 面板採 ±5 Vpk 並套用聯合限制。最小幅度 1 mVpp 時 \|offset\| ≤ 4.9995 V，兩位小數顯示時可能呈現為 4.99；不另訂 4.99 上限。 |
| Ramp 頻率範圍的寫法 | M-AFG p.61、p.208：1μHz~1MHz | M-AFG p.288 規格表：「Ramp 1MHz」（沒寫下限） | 採 1 μHz–1 MHz。 |
| AMPL 按鍵字樣 | M-AFG p.13 操作鍵說明表的按鍵圖示印成「AMP」 | P1 照片、p.13 面板圖、p.13 內文（「AMPL sets the waveform amplitude」）與 p.27 圖示都是「AMPL」 | 面板標籤採照片的「AMPL」。 |
| FREQ/Rate 字樣 | P1 照片：斜線在解析度下不清楚，看起來像「FREQ Rate」 | M-AFG p.13 面板圖與 p.27 圖示：「FREQ/Rate」 | 採「FREQ/Rate」；照片沒有與此矛盾的證據。 |
| Offset 準確度數字 | M-AFG p.289 PDF 文字層抽出為「10mV+」 | 同頁渲染出來的字形為「20mV+」 | 以可見字形 20 mV 為準；此項非核心，不影響實作。 |
| Load 切換時的顯示換算，出處只在遠端章節 | 面板章節 p.144 只說「actual amplitude and offset will vary accordingly」，沒寫顯示值怎麼變 | 遠端章節 p.202–203、p.210–211、p.214–215：切到 High Z 時幅度與 offset 加倍，切回 50Ω 時減半 | 實作採「內部 EMF 不變、顯示值 ×2／÷2」（與 02 的負載參照定義一致），並標示面板顯示部分為 PD（GAP-AFG-08）。 |
| High Z 禁用 dBm：面板章節沒提 | 面板 p.61–62 列出 dBm 軟鍵，沒有 High Z 的限制 | 遠端 p.202、p.210、p.215 與錯誤碼 p.278：High Z 時不能用 dBm，單位改成 Vpp | 採遠端的明文限制（02 也要求如此）；dBm 軟鍵在 High Z 時的外觀 UN。 |
| 超限處理：遠端與規劃暫定 | 遠端 p.201、p.202、p.279：超限值會被夾到最大或最小值，並產生 -221／-222 錯誤 | 02／03 規劃：面板超限可採明示的暫定拒絕，非法值不能污染原值 | 面板暫定用拒絕方式（GAP-AFG-05），並記錄這與遠端的夾值語義不同；校機後再調整。 |
| Square Duty 的頻段邊界（非核心） | 面板 p.56：≤100kHz 1.0–99.0%；100kHz~≤1MHz 10.0–90.0%；>1MHz~25MHz 固定 50% | 遠端 p.209／p.212：「10% to 90% (100 KHz ≤ frequency ≤1MHz)」「50% (frequency ≤ 25 MHz)」，剛好 100 kHz 時兩處說法不同 | Duty 本輪 OUT，只記錄；日後實作採面板 p.56。 |
| 遠端查詢範例的最大幅度 | M-AFG p.211 範例：「SOUR1:AMP? MAX +5.0000E+00 ... maximum amplitude ... is 5 volts」 | M-AFG p.288：50 Ω 為 1mVpp to 10 Vpp | 範例的條件沒寫（可能受 offset 或頻率影響），不拿來當上限；採規格表。 |
| 通道選擇鍵的數量 | 任務描述與 02 寫作「CH1/CH2 鍵」，可能被讀成兩顆鍵 | P1 照片與 M-AFG p.13–14：只有一顆印「CH1/CH2」的切換鍵 | 實作為單一切換鍵 AFG.KEY.CH1_CH2，不做兩顆。 |
| 後面板 Trigger Output 的適用功能 | M-AFG p.16：只用於 Sweep 與 ARB | M-AFG p.291：Type「For Burst, Sweep, Arb」 | 後面板端子本輪 OUT，不影響實作；記錄矛盾，日後做 J 卡或 Burst 時再核對。 |

## 2. Tektronix TDS2001C 雙通道數位儲存示波器（I03）

### 核心功能與驗收規則

| ID | 功能 | 可驗收規則 | 來源 | 證據 | 驗收（03 案例） |
| --- | --- | --- | --- | --- | --- |
| TDS-F01 | CH1／CH2 顯示開關與各自的垂直選單 | 按 1 或 2 會開啟該通道的垂直選單，並切換波形顯示（多狀態細節暫定見 GAP-TDS-05）。通道顯示時有波形、左側接地參考標記與下方 V/div 讀值；關閉時三者都消失。兩通道所有垂直設定分開保存。Default Setup 後只顯示 CH1 | M-TDS-13 p.4 (PDF 28)、p.11 (PDF 35)、p.14 (PDF 38)、p.104 (PDF 128)、p.106 (PDF 130)、p.127 (PDF 151) | OT+PD | I03-1、I03-9：真 UI 開啟 CH2、分別設不同 V/div 與 Position，來回切換後值不互相覆寫；連按 2 可移除 CH2；Default Setup 後只剩 CH1 |
| TDS-F02 | 垂直刻度（V/div） | 刻度旋鈕依 1-2-5 在 2 mV–5 V/div（1X）之間切換，顯示值乘上該通道 Probe 設定。波形以接地參考位準為中心縮放，佔用格數改變。量到的 Pk-Pk 物理值不變；波形超出畫面時量測顯示 ? | M-TDS-13 p.23 (PDF 47)、p.105 (PDF 129)、p.107–108 (PDF 131–132) | OT | I03-1：S1 在 CH1 從 1 V/div 改 500 mV/div，波形格數約加倍，Pk-Pk 讀值維持 2 V（探棒匹配時），容差依 I03 取樣規格 |
| TDS-F03 | 垂直位置 | 位置旋鈕只移動該通道的波形、接地參考標記與 GND 零伏線，不改量測值。範圍 ±1.8 V（≤200 mV/div）或 ±45 V（>200 mV/div），預設 0 div | M-TDS-13 p.14 (PDF 38)、p.108 (PDF 132)、p.128 (PDF 152) | OT+PD（單位與步進見 GAP-TDS-11） | I03-1、I03-3：移動 CH1 位置時 Pk-Pk、Freq 不變；GND 耦合時零伏線跟著移動 |
| TDS-F04 | 水平時基（s/div） | 刻度旋鈕依 1-2.5-5 在 5 ns–50 s/div 之間切換，所有通道共用，以螢幕中央為中心縮放。量到的頻率不隨時基改變。停止時縮放已取得的紀錄。≥100 ms/div 且 Auto 時進入 Scan（近似，GAP-TDS-08） | M-TDS-13 p.23 (PDF 47)、p.77 (PDF 101)、p.86–87 (PDF 110–111)、p.110 (PDF 134) | OT | I03-2：S1 在 250 µs/div 與 500 µs/div 下 Freq 都是 1 kHz，畫面週期數約減半 |
| TDS-F05 | 水平位置與 Set to Zero | 位置旋鈕改變觸發點相對螢幕中央的時間；M Pos 讀值為中央刻度的時間（觸發點＝0），觸發位置標記跟著移動；解析度 1/25 div，範圍依 p.110 表。Set to Zero 讓位置歸零 | M-TDS-13 p.11 (PDF 35)、p.14 (PDF 38)、p.86 (PDF 110)、p.110 (PDF 134) | OT | I03-2、I03-9：轉動水平位置後讀值與標記同步；按 Set to Zero 回到 0.00 s；頻率讀值不變 |
| TDS-F06 | 通道耦合 DC／AC／Ground | CH 選單 OPT1 依 DC→AC→Ground 循環。DC 保留 DC 成分；AC 隔直並衰減 <10 Hz（模型見 GAP-TDS-12）；Ground 讓該通道顯示零伏水平參考線（位置跟著 Position），通道仍在、並非清空。AutoSet 時 GND 改回 DC | M-TDS-13 p.12–13 (PDF 36–37)、p.79–80 (PDF 103–104)、p.104–105 (PDF 128–129)、p.107 (PDF 131) | OT | I03-3：S1（2 Vpp＋0.5 V DC）DC 時中心在 +0.5 V，AC 時中心回到接地標記，Ground 時只剩位於接地標記的水平線；調 Position 時該線跟著移動 |
| TDS-F07 | 觸發耦合與通道耦合互相獨立 | Trig Menu 的 Coupling 只影響觸發路徑，不改通道耦合、不改顯示波形 | M-TDS-13 p.21 (PDF 45)、p.98 (PDF 122) | OT | I03-3：CH1 設 DC，把觸發耦合改 AC 後，CH1 選單仍顯示 DC，波形 DC 位移不變 |
| TDS-F08 | 探棒倍率（儀器設定與實際探棒分開） | 1/2 ►Probe ►Voltage ►Attenuation 以多功能旋鈕選 1X…1000X（預設 10X）。顯示電壓＝探棒後訊號 × 儀器設定。fixture 的實際倍率另外保存：兩者一致時顯示原訊號尺度，不一致時依比例錯讀。不自動校正；AutoSet 不改 Probe | M-TDS-13 p.7 (PDF 31)、p.17 (PDF 41)、p.79–80 (PDF 103–104)、p.105 (PDF 129)、p.107 (PDF 131) | OT+PD | I03-4：S2 實際 10×、儀器 10× 時 Pk-Pk＝原值；儀器改 1× 時讀值為原值的 1/10；按 AutoSet 後 Probe 設定不變 |
| TDS-F09 | Edge 觸發 Source／Slope／Level | Type＝Edge；Source 選 CH1 或 CH2（通道不必顯示）；Slope 選 Rising 或 Falling；Level 旋鈕在螢幕中央 ±8 div 內、0.02 div 解析度。觸發點依 Slope 與 Level 決定，位準標記與讀值同步 | M-TDS-13 p.21–22 (PDF 45–46)、p.96–97 (PDF 120–121)、p.111 (PDF 135) | OT | I03-5：S1 切 Rising／Falling 時，觸發點的波形斜率反向；Level 在峰值範圍內時狀態為 Trig'd |
| TDS-F10 | 觸發模式 Auto／Normal | Auto：沒有有效觸發時經過一段時間自動觸發並持續更新（狀態 Auto）。Normal：只有有效觸發才更新；沒有觸發時保留舊採集；第一次觸發前沒有波形（狀態 Ready）。Level 超過訊號峰值時不可顯示 Trig'd | M-TDS-13 p.11 (PDF 35)、p.96–97 (PDF 120–121) | OT（等待時間 PD，GAP-TDS-06） | I03-5：S3 下 Normal 從 Default Setup 起算沒有新波形；已有採集後把 Level 調出範圍，舊波形保留、狀態 Ready；改 Auto 後畫面恢復更新、狀態 Auto |
| TDS-F11 | Set To 50% | 按下後觸發位準設為目前觸發源訊號 (max+min)/2，讀值與標記同步；典型最低 50 Hz | M-TDS-13 p.15 (PDF 39)、p.100 (PDF 124)、p.111 (PDF 135) | OT | I03-5：S1（DC 耦合，−0.5 V 至 +1.5 V）按下後位準約 +0.5 V（依探棒設定換算），並轉為 Trig'd |
| TDS-F12 | Force Trig | 不論觸發條件，都強制完成一次採集；在 Normal 或 Single 等待時可看到結果；已停止時無效 | M-TDS-13 p.15 (PDF 39)、p.100 (PDF 124) | OT | I03-5、I03-6：S3 Normal 下按 Force Trig 出現一幀；Stop 狀態下按下畫面不變 |
| TDS-F13 | Run/Stop | Run 連續採集；Stop 凍結採集，狀態顯示 Stop。之後 fixture 改變不影響畫面與量測。停止時仍可調 V/div、垂直位置、s/div、水平位置來縮放或移動凍結紀錄；改觸發設定時波形改為斷線樣式 例外：右下角觸發頻率讀值不凍結，停止時仍追蹤目前的觸發源（p.112「including when oscilloscope acquisition is halted」）。凍結的是波形紀錄與 Measure 量測欄。 | M-TDS-13 p.77 (PDF 101)、p.84 (PDF 108)、p.87 (PDF 111) | OT | I03-6：Stop 後把 S1 頻率改掉，波形與 Measure 欄的 Freq 仍是舊值，右下角觸發頻率讀值則顯示新頻率；轉 s/div 時凍結波形跟著縮放；再按 Run/Stop 回復更新 |
| TDS-F14 | Single | 每按一次開始一次新採集，等到觸發後完成並停止（狀態 Acq. Complete），之後 fixture 改變不影響畫面。Auto 模式下的行為見 GAP-TDS-07 例外：右下角觸發頻率讀值不凍結，停止時仍追蹤目前的觸發源（p.112「including when oscilloscope acquisition is halted」）。凍結的是波形紀錄與 Measure 量測欄。 | M-TDS-13 p.11 (PDF 35)、p.41 (PDF 65)、p.77 (PDF 101) | OT | I03-6：S1 按 Single 得到一幀後停止；改 fixture 畫面不變；再按 Single 再取一幀 |
| TDS-F15 | AutoSet（一次性） | 依 p.79–80 表做一次設定：Acquire 固定 Sample、Cursors Off、YT、Trigger Edge／Auto／Level 50%、觸發耦合固定 DC（手冊為「Adjusted to Sample or Peak Detect」與「Adjusted to DC, Noise Reject, or HF Reject」，本輪因 Peak Detect／Noise Reject／HF Reject 為 OUT 而化簡，PD）、BW Full、GND 改 DC；V/div、s/div、水平位置、Slope 依訊號調整；顯示有訊號的通道並依規則選觸發源；自動量測依 TDS-F21。之後輸入改變不再自動調整。不影響 Probe 設定 | M-TDS-13 p.19 (PDF 43)、p.79–81 (PDF 103–105) | OT+PD | I03-7：Default Setup→AutoSet 後 S1 可讀、Trig'd；再把 fixture 幅度改 5 倍，V/div 不自動改變；AutoRange LED 保持熄滅 |
| TDS-F16 | 自動量測 Freq／Period／Pk-Pk | Measure 的 5 格各自有 Source（CH1/CH2）與 Type。數值從該通道目前的採集紀錄計算：Freq、Period 取第一個完整週期，Pk-Pk 取整筆紀錄 max−min。來源通道需顯示；超出範圍顯示 ?；停止時以凍結紀錄為準；約每秒更新 2 次 | M-TDS-13 p.26–27 (PDF 50–51)、p.31–34 (PDF 55–58)、p.89 (PDF 113)、p.105 (PDF 129) | OT | I03-8：S1 量到 Freq 約 1.000 kHz、Period 約 1.000 ms、Pk-Pk 約 2 V；關閉 CH2 後把 Measure 2 Source 設 CH2，顯示無效狀態（GAP-TDS-14），不可顯示 0 |
| TDS-F17 | 時間／電壓游標 | Cursor ►Type 選 Time 或 Amplitude，►Source 選 CH1 或 CH2，►Cursor 1／Cursor 2 用多功能旋鈕移動（只在 Cursor 選單顯示時可調）。Time 顯示 Δt、1/Δt、ΔV，時間以觸發點為基準；Amplitude 顯示 ΔV，以接地參考為基準；讀值來自所選通道的採集資料 Source 通道未顯示時，游標與讀值不出現或標示無效（p.106「You must display a channel waveform to … use cursors on it」、p.82；呈現方式依 GAP-TDS-14）。 | M-TDS-13 p.26 (PDF 50)、p.36–39 (PDF 60–63)、p.43–44 (PDF 67–68)、p.82–83 (PDF 106–107) | OT | I03-8：S2 以 Time 游標分別放在 CH1、CH2 上升零交越處，Δt 約 125 µs（容差依游標步進）；Type Off 時游標消失；反例：關閉 CH2 後把 Cursor Source 選 CH2，游標與讀值不出現或標示無效，不顯示 0。 |
| TDS-F18 | Default Setup | 依 Appendix E 回復已列出的設定並只顯示 CH1，訊息區顯示『Default setup recalled』；不重設清單內的項目（Probe 爭議見 GAP-TDS-09） | M-TDS-13 p.12 (PDF 36)、p.127–128 (PDF 151–152) | OT | I03-9、I06-1：各種設定改亂後按 Default Setup，讀值符合表列；接著 AutoSet 可以再次看到波形，不需要重開 App |
| TDS-F19 | 觸發狀態與畫面讀值一致 | LCD 的觸發狀態（Ready／Trig'd／Auto／Stop／Acq. Complete／Scan）、觸發源、類型圖示、位準讀值與標記、M 時基、各通道 V/div、接地標記，全部由同一個狀態產生 | M-TDS-13 p.10–12 (PDF 34–36) | OT | I03-5、I03-6：每個操作後截圖比對狀態圖示與讀值，不可出現『波形在動但狀態為 Stop』之類的矛盾 |
| TDS-F20 | 多功能旋鈕與 LED | 只有在手冊列出的核心選單項目（Cursor 1/2、Measure Type、Edge Source、Probe Attenuation）中，旋鈕才有作用且 LED 亮；其他狀態下旋轉無效 | M-TDS-13 p.13 (PDF 37)、p.16–17 (PDF 40–41) | OT+PD | I03-4、I03-8：進入 Probe ►Attenuation 或選 Cursor 1 時 LED 亮並可調整；離開選單後 LED 熄滅、旋轉不改任何值 |
| TDS-F21 | AutoSet 自動量測的有限例外：Mean、Cyc RMS | AutoSet 偵測到 multi-cycle sine 時顯示 Cycle RMS、Frequency、Period、Pk-Pk；multi-cycle square 顯示 Pk-Pk、Mean、Period、Frequency；無法判定時顯示 Mean、Pk-Pk（p.80–81）。Mean 與 Cyc RMS 由目前採集資料計算（APPROX：演算法為模擬器定義，Cyc RMS 取第一個完整週期），Measure 選單也可選這兩項；其餘 11 種量測仍 OUT。 | M-TDS-13 p.80 (PDF 104)、p.81 (PDF 105) | OT+PD | I03-7：S1 按 AutoSet 後出現 Cyc RMS、Freq、Period、Pk-Pk，數值由採集算出（S1 的 Cyc RMS 應接近 AC 部分 0.707 V 與 DC 0.5 V 的合成值，依耦合而定）。 |

### 規格、範圍與預設值

| 項目 | 值 | 來源 | 證據 | 原文 |
| --- | --- | --- | --- | --- |
| 型號基本規格 | TDS2001C：2 通道、50 MHz、500 MS/s、彩色顯示 | M-TDS-13 p.1 (PDF 25)；P2 型號條 | PH+OT | TDS2001C 2 50 MHz 500 MS/s Color |
| 最大取樣率 | 500 MS/s（40/50 MHz 機型）。p.110 表另寫 1 GS/s，見 discrepancies | M-TDS-13 p.76 (PDF 100) | OT | Maximum of 500 MS/s for 40 MHz and 50 MHz models |
| 記錄長度 | 每通道 2500 點（OT）；2500 點對應 10 div（250 點/div）是依 p.10 圖與 p.98 推定（PD，見 GAP-TDS-20／24） | M-TDS-13 p.1 (PDF 25)；p.75 (PDF 99)；p.110 (PDF 134) | OT+PD | Record Length 2500 samples per record |
| 快速時基的內插 | 手冊 p.76「At 100 ns and faster settings, this sample rate does not acquire 2500 points」是跨機型通用句（對 1 GS/s 機型成立）。依本卡採用的 500 MS/s 與 2500 點／10 div 推算，TDS2001C 在 ≤ 250 ns/div 就需要內插（PD，與 GAP-TDS-24 一致）。p.110 另寫「Waveform interpolation is activated for sweep speeds of 100 ms/div and faster」，與 p.76 的 100 ns 不一致，疑為誤植。 | M-TDS-13 p.76 (PDF 100)；p.110 (PDF 134) | OT+PD | At 100 ns and faster settings, this sample rate does not acquire 2500 points. In this case, a Digital Signal Processor interpolates points |
| 垂直靈敏度（V/div） | 2 mV/div–5 V/div，1-2-5 序列（探棒設定 1X 時）；Coarse＝1-2-5，Fine＝兩檔之間的小步（步幅未載） | M-TDS-13 p.108 (PDF 132)；p.105 (PDF 129) | OT | 2 mV/Div to 5 V/Div in 1-2-5 sequence with probe attenuation set to 1X |
| 探棒倍率與顯示刻度 | 儀器 Probe 設定只改顯示刻度，沒有自動偵測，由使用者自行對應。推論：10X 時顯示 V/div 為 20 mV–50 V（PD） | M-TDS-13 p.107 (PDF 131) | OT+PD | This adjusts the display scale factor of the instrument to accommodate various probe types. ... No automatic probe interface is provided, so the user must assure the settings match the probe characteristics. |
| 電壓探棒倍率選項與預設 | 1X、10X、20X、50X、100X、500X、1000X；預設 10X | M-TDS-13 p.105 (PDF 129)；p.7 (PDF 31)；p.128 (PDF 152) | OT | NOTE. The default setting for the Attenuation option is 10X. |
| 垂直位置範圍與預設 | 2–200 mV/div：±1.8 V；>200 mV/div 至 5 V/div：±45 V（1X 規格）；預設 0.00 divs (0.00 V) | M-TDS-13 p.108 (PDF 132)；p.128 (PDF 152) | OT | 2 mV/div to 200 mV/div ±1.8 V / >200 mV/div to 5 V/div ±45 V |
| 垂直數位化 | 8 bits（2 mV/div 除外）；每格 25 階；10 格動態範圍 | M-TDS-13 p.108 (PDF 132) | OT | Displayed vertically with 25 digitalization levels per division, 10 divisions dynamic range. |
| graticule 格數 | 水平 10 div：觸發在中央時可看到 5 div pretrigger；垂直可視 ±4 div（共 8 div），另見 p.10 顯示圖 | M-TDS-13 p.98 (PDF 122)；p.108 (PDF 132)；p.111 (PDF 135)；p.10 (PDF 34) | OT+PD | you are able to view five divisions of pretrigger information / Maximum viewable signal while DC coupled is ±50 V offset ±5 V/division at 4 divisions |
| 縮放的參考點 | 垂直刻度以接地參考位準為中心縮放；水平刻度以螢幕中央為中心縮放 | M-TDS-13 p.23 (PDF 47)；p.86 (PDF 110) | OT | The waveform display will contract or expand relative to the ground reference level. / When you change the horizontal scale, the waveform will expand or contract around the screen center. |
| 接地參考標記 | graticule 左側的通道標記指向該通道的接地參考位準；沒有標記代表通道未顯示 | M-TDS-13 p.11 (PDF 35)；p.23 (PDF 47) | OT | On-screen markers show the ground reference points of the displayed waveforms. If there is no marker, the channel is not displayed. |
| 通道耦合 | DC、AC、Ground；預設 DC | M-TDS-13 p.104 (PDF 128)；p.128 (PDF 152) | OT | DC passes both AC and DC components of the input signal / AC blocks the DC component of the input signal and attenuates signals below 10 Hz / Ground disconnects the input signal |
| GND 耦合的零伏參考線 | Ground 耦合時顯示零伏波形（參考線），通道本身仍保持顯示 | M-TDS-13 p.105 (PDF 129)；p.107 (PDF 131) | OT | Ground Coupling. Use Ground coupling to display a zero-volt waveform. Internally, the channel input is connected to a zero-volt reference level. / Ground coupling mode provides a reference waveform derived from the values identified during SPC. This reference waveform shows visually where ground is expected to be. |
| AC 耦合下限頻率 | ≤10 Hz；使用 10X 被動探棒時 ≤1 Hz；做法是輸入串接電容 | M-TDS-13 p.109 (PDF 133)；p.107 (PDF 131) | OT | Lower Frequency Limit, AC Coupled ≤10 Hz ≤1 Hz when 10X passive probes are used. / AC coupling connects a capacitor in series with the input circuitry. |
| BW Limit | 20 MHz／Off，預設 Off；開啟時 LCD 顯示 BW 圖示 | M-TDS-13 p.105 (PDF 129)；p.11 (PDF 35)；p.128 (PDF 152) | OT | Limits the bandwidth to reduce display noise; filters the signal to reduce noise and other unwanted high frequency components |
| 類比頻寬（只作標示） | 5 mV/div–5 V/div 為 DC 至 >50 MHz；<5 mV/div 限 20 MHz。模擬器不承諾此效能 | M-TDS-13 p.109 (PDF 133) | OT | DC to >50 MHz for 5 mV/div through 5 V/div settings with bandwidth limit at full. <5 mV/div settings are limited to 20 MHz BW |
| 輸入阻抗與最大輸入（J 階段用） | 1 MΩ ±2% 並聯 20 pF ±3 pF；300 V RMS CAT II | M-TDS-13 p.107–108 (PDF 131–132)；P2『300V CAT II』 | PH+OT | 1 MΩ±2% in parallel with 20 pF ±3 pF / At front panel connector, 300 V RMS, Installation Category II |
| 秒/格範圍 | 5 ns/div–50 s/div，1、2.5、5 序列（TDS2001C 所屬欄位） | M-TDS-13 p.110 (PDF 134) | OT | 5 ns/div to 50 s/div, in a 1, 2.5, 5 sequence |
| 水平位置 | 讀值為中央刻度相對觸發點的時間（觸發點＝0）。範圍：5–10 ns/div 為 (−4 div×s/div) 至 20 ms；25 ns–100 µs/div 為 (−4 div×s/div) 至 50 ms；250 µs–10 s/div 為 (−4 div×s/div) 至 50 s；2.5–50 s/div 為 (−4 div×s/div) 至 250 s。解析度 1/25 div；預設 0.00 s | M-TDS-13 p.110 (PDF 134)；p.86 (PDF 110)；p.11 (PDF 35)；p.127 (PDF 151) | OT | The resolution of the horizontal position time is 1/25 of a horizontal division. |
| Scan（Roll）模式條件 | 時基 ≥100 ms/div 且 Trigger Mode 為 Auto 時進入；此時沒有觸發，也不能控制水平位置 | M-TDS-13 p.77 (PDF 101)；p.87 (PDF 111) | OT | When the Horizontal Scale control is set to 100 ms/div or slower and the trigger mode is set to Auto, the oscilloscope enters the Scan acquisition mode. |
| 觸發類型 | Edge（預設）、Video、Pulse | M-TDS-13 p.96 (PDF 120) | OT | Edge (default) Triggers the oscilloscope on the rising or falling edge of the input signal when it crosses the trigger level (threshold) |
| Edge 觸發選項（2 通道機） | Source：CH1、CH2、Ext、Ext/5、AC Line；Slope：Rising、Falling；Mode：Auto、Normal；Coupling：AC、DC、Noise Reject、HF Reject、LF Reject。預設 CH1／Rising／Auto／DC／0.00 V | M-TDS-13 p.96 (PDF 120)；p.127–128 (PDF 151–152) | OT | Source CH1, CH2, CH3 1, CH4 1, Ext, Ext/5, AC Line ... 1 Available only on a 4-channel oscilloscope. |
| 觸發源不必顯示 | 通道不論是否顯示都可以作觸發源；但量測與游標需要該通道顯示 | M-TDS-13 p.97 (PDF 121)；p.106 (PDF 130) | OT | Triggers on a channel whether or not the waveform is displayed / You must display a channel waveform to take measurements from it, use cursors on it |
| 觸發位準範圍與解析度 | 通道觸發源：螢幕中央 ±8 div，解析度 0.02 div；Ext 為 ±1.6 V（4 mV），Ext/5 為 ±8 V（20 mV） | M-TDS-13 p.111 (PDF 135)；p.97 (PDF 121) | OT | The settable resolution for the trigger level is 0.02 division for an input channel source ... Input channels ±8 divisions from center screen |
| 觸發耦合與通道耦合分離 | 觸發耦合只影響送入觸發系統的訊號；DC 全部通過；AC 隔 DC 並衰減 <10 Hz | M-TDS-13 p.21 (PDF 45)；p.97–98 (PDF 121–122) | OT | Trigger coupling affects only the signal passed to the trigger system. It does not affect the bandwidth or coupling of the signal displayed on the screen. |
| Auto 模式 | 一段時間內沒偵測到觸發就強制觸發（free-run）；等待時間依時基而定，確切值未載 | M-TDS-13 p.96–97 (PDF 120–121) | OT | The Auto mode (default) forces the oscilloscope to trigger when it does not detect a trigger within a certain amount of time based on the horizontal scale setting. ... Use the Auto mode to let the acquisition free-run in the absence of a valid trigger. |
| Normal 模式 | 只有有效觸發才更新畫面；沒有觸發時保留舊波形；第一次觸發前不顯示波形 | M-TDS-13 p.97 (PDF 121) | OT | The Normal mode updates displayed waveforms only when the oscilloscope detects a valid trigger condition. The oscilloscope displays older waveforms until the oscilloscope replaces them with new ones. ... When you use this mode, the oscilloscope does not display a waveform until after the first trigger. |
| Single | 每按一次開始一次新採集；偵測到觸發後完成並停止；Sample 模式採到 1 次即結束 | M-TDS-13 p.77 (PDF 101) | OT | Each time you push the Single button, the oscilloscope begins to acquire another waveform. After the oscilloscope detects a trigger it completes the acquisition and stops. |
| Run/Stop 與停止後的畫面 | 停止即凍結畫面，但仍可用垂直、水平控制縮放或移動；控制不影響顯示準確度時波形保持實線；停止後改觸發設定，波形改為斷線 | M-TDS-13 p.77 (PDF 101)；p.84 (PDF 108)；p.87 (PDF 111) | OT | Stopping the acquisition (when you push the Run/Stop button) freezes the display. In either mode, the waveform display can be scaled or positioned with the vertical and horizontal controls. / changing the trigger controls on a stopped acquisition causes a broken-line waveform. |
| Force Trig | 不論觸發條件是否成立，都完成一次採集；已停止時無效；主要用於 Single 與 Normal | M-TDS-13 p.15 (PDF 39)；p.100 (PDF 124) | OT | Completes an acquisition regardless of an adequate trigger signal. This button has no effect if the acquisition is already stopped. |
| Set To 50% | 觸發位準設在觸發訊號最大值與最小值的中點；典型最低可用頻率 50 Hz | M-TDS-13 p.15 (PDF 39)；p.100 (PDF 124)；p.111 (PDF 135) | OT | The oscilloscope automatically sets the Trigger Level to be about halfway between the minimum and maximum voltage levels. |
| 觸發狀態圖示 | Armed、Ready、Trig'd、Stop、Acq. Complete、Auto、Scan | M-TDS-13 p.11 (PDF 35) | OT | Ready. All pretrigger data has been acquired and the oscilloscope is ready to accept a trigger. / Auto. The oscilloscope is in auto mode and is acquiring waveforms in the absence of triggers. |
| 觸發頻率讀值 | 顯示在右下角，6 位數；以 AC 耦合量 10 Hz 至額定頻寬；停止時仍持續量測；不計入不合格的觸發事件 | M-TDS-13 p.96 (PDF 120)；p.112 (PDF 136) | OT | Frequency counter measures selected trigger source at all times in pulse width and edge mode, including when oscilloscope acquisition is halted |
| AutoSet 設定表 | Acquire 改為 Sample 或 Peak Detect；Cursors Off；Display YT；水平位置、水平刻度 Adjusted；觸發耦合 DC／Noise Reject／HF Reject；Holdoff 最小；Level 設 50%；Mode Auto；Source Adjusted（不能用在 Ext Trig）；Slope Adjusted；Type Edge 或 Video；BW Full；Vertical coupling：原為 GND 則改 DC，Video 改 AC，其他不變；VOLTS/DIV Adjusted。表中沒有 Probe 與垂直位置；Display type：video 時 Dots、FFT 時 Vectors，否則不變（本輪 Display 固定 Vectors，所以不變） | M-TDS-13 p.79–80 (PDF 103–104) | OT | Trigger level Set to 50% / Trigger mode Auto / Vertical coupling DC (if GND was previously selected); AC for a video signal; otherwise, unchanged |
| AutoSet 觸發源與通道規則 | 檢查所有通道並顯示有訊號的通道；多個通道有訊號時取頻率最低者；都沒有訊號時顯示按下時編號最小的已顯示通道；沒有訊號也沒有顯示通道時使用 CH1；判斷不出訊號種類時調整刻度並量 Mean、Pk-Pk | M-TDS-13 p.80 (PDF 104) | OT | If multiple channels have signals, the oscilloscope displays the channel with the lowest frequency signal. If no signals are found, then the oscilloscope displays the lowest-numbered channel when Autoset was invoked. |
| AutoSet 與 AutoRange 的差異 | AutoSet 每按一次調一次；AutoRange 是可開關的持續追蹤功能 | M-TDS-13 p.19 (PDF 43)；p.77 (PDF 101)；p.80 (PDF 104) | OT | Each time you push the AutoSet button, the Autoset function obtains a stable waveform display for you. / Autorange is a continuous function that you can enable or disable. The function adjusts setup values to track a signal when the signal exhibits large changes |
| AutoSet 正弦選項與自動量測 | Multi-cycle sine：顯示數個週期，並量 Cycle RMS、Frequency、Period、Peak-to-Peak；Single-cycle sine：約一個週期，並量 Mean、Peak-to-Peak；Undo Autoset 回到先前設定 | M-TDS-13 p.80–81 (PDF 104–105) | OT | Multi-cycle sine Displays several cycles with appropriate vertical and horizontal scaling; the oscilloscope displays Cycle RMS, Frequency, Period, and Peak-to-Peak automatic measurements |
| 自動量測 | 16 種，最多同時 5 項；通道須顯示；參考波形、XY、Scan 時不能量測；約每秒更新 2 次 | M-TDS-13 p.89 (PDF 113) | OT | The waveform channel must be on (displayed) to make a measurement. Automated measurements cannot be taken on reference waveforms, or while using XY or scan mode. The measurements update about two times per second. |
| Freq／Period／Pk-Pk 定義 | Freq、Period 取第一個週期；Pk-Pk 取整筆波形的最大值減最小值 | M-TDS-13 p.89 (PDF 113) | OT | Freq Calculates the frequency of the waveform by measuring the first cycle / Period Calculates the time of the first cycle / Pk-Pk Calculates the absolute difference between the maximum and minimum peaks of the entire waveform |
| 量測無效標記 | 超出量測範圍或波形超出畫面時，數值顯示 ? | M-TDS-13 p.31 (PDF 55)；p.105 (PDF 129) | OT | If a question mark (?) appears in the Value readout, the signal is outside the measurement range. / Waveforms that extend beyond the screen (overrange) and display a ? in the measurement readout indicates an invalid value. |
| 游標類型、來源與讀值 | Type：Time、Amplitude、Off。Source（2 通道機）：CH1、CH2、MATH、REFA、REFB。Time 顯示 Δt、1/Δt、ΔV，另顯示各游標與波形交點的電壓；Amplitude 顯示 ΔV。時間以觸發位置為基準，振幅以參考接點為基準 | M-TDS-13 p.82 (PDF 106)；p.26 (PDF 50) | OT | Time cursors display Δt, 1/ Δt and ΔV ... Displays selected cursor location (time is referenced to the trigger position, and amplitude to the reference connection) |
| 游標操作限制 | 只有在 Cursor 選單顯示時能用多功能旋鈕移動；作用中的游標為實線；畫面上必須有波形；離開選單後游標仍顯示但不能調 | M-TDS-13 p.83 (PDF 107)；p.82 (PDF 106)；p.17 (PDF 41) | OT | You can move the cursors only while the Cursor Menu is displayed. The active cursor is represented by a solid line. / The oscilloscope must display a waveform for the cursors and cursor readouts to appear. |
| 游標預設位置 | Amplitude 游標在 ±3.2 div；Time 游標在 ±4 div；Type Off；Source CH1 | M-TDS-13 p.127 (PDF 151) | OT | Horizontal (amplitude) +/- 3.2 divs / Vertical (time) +/- 4 divs |
| Default Setup 回復值 | 只顯示 CH1。ACQUIRE：Sample、Averages 16、Run。AUTORANGE：Off（Vertical and Horizontal）。CURSOR：Off、CH1。DISPLAY：Vectors、Persist Off、YT。HORIZONTAL：Main、Trig Knob Level、Position 0.00 s、Scale 500 ms、Window Zone 50 ms。MATH：CH1−CH2、0 divs、2 V。MEASURE（全部）：CH1、None。TRIGGER：Edge、CH1、Rising、Auto、DC、0.00 V。各通道垂直：DC、BW Off、Coarse、Probe Voltage、Attenuation 10X、Current 10 A/V、Invert Off、Position 0.00 divs (0.00 V)、Scale 1.00 V | M-TDS-13 p.127–128 (PDF 151–152)；M-TDS-11 同頁同值 | OT | NOTE. When you push the Default Setup button, the oscilloscope displays the CH1 waveform and removes all other waveforms. |
| Default Setup 不重設的項目 | 語言、已存設定、Ref 波形、校正資料、印表機設定、GPIB、Probe 設定（類型與倍率）、日期時間、USB 目前資料夾 | M-TDS-13 p.128 (PDF 152) | OT | The Default Setup button does not reset the following settings: ... Probe setup (type and attenuation factor) |
| Probe Comp 輸出 | 典型 5.0 V ±10%（1 MΩ 負載）、1 kHz | M-TDS-13 p.113 (PDF 137)；P2『~5V@1kHz』 | PH+OT | Output voltage 5.0 V ±10% into 1 Meg Ω load / Frequency 1 kHz |
| LCD | 11.5×8.64 cm、¼VGA、320×240 彩色 TFT、黑底 | M-TDS-13 p.113 (PDF 137) | OT | Display Resolution 320 horizontal by 240 vertical pixels |
| 長按與開機行為 | 只有 Trig View 需要按住；開機時 AutoRange 一律關閉；關機前設定停止改變 5 秒（p.20）或 3 秒（p.95）後，會保存並於開機回復 | M-TDS-13 p.100 (PDF 124)；p.77 (PDF 101)；p.20 (PDF 44)；p.95 (PDF 119) | OT | This is the only button that you must hold down to use. / When you power on the oscilloscope, autoranging is always inactive. |

### 本輪未納入

| 項目 | 理由 | 面板處理 |
| --- | --- | --- |
| Math（+、−、×）與 Math FFT | 02 明列 FFT 本輪未納入，Math 運算也不在核心清單 | Math 鍵可以按，但只在儀器外顯示『本輪未納入』範圍說明，不產生 Math 波形，也不改狀態 |
| Video、Pulse Width 觸發 | 02 明列不納入 | Trig Menu OPT1 維持 Edge；嘗試切到 Video/Pulse 時顯示範圍說明，不切換觸發類型 |
| Trigger Holdoff、Horiz 的 Window Zone／Window | 不在 02 核心 | Horiz 選單只啟用 Main，其餘選項灰階並附說明 |
| Ext、Ext/5、AC Line 觸發源；Noise Reject、HF Reject、LF Reject 觸發耦合 | 單機階段沒有對應 fixture，也沒有精準濾波模型 | 依 GAP-TDS-17：循環中略過並在儀器外列出，不假裝有效 |
| Peak Detect、Average、Averages；精準取樣率、aliasing、雜訊、8-bit 量化、類比頻寬 | 02 明列所有 acquisition mode 與精準取樣／雜訊模型不納入 | Acquire 選單只能選 Sample；型號條上的 50 MHz／500 MS/s 只是標示，儀器外註明模擬器不承諾 |
| Scan（Roll）模式的完整行為 | 屬採集模式，但 Default Setup 的 500 ms/div 會觸及 | 依 GAP-TDS-08 以明示近似呈現，量測顯示無效 |
| Display 選單（Vectors/Dots、Persist、XY） | 不在核心 | 固定 YT／Vectors／Persist Off；按鍵顯示範圍說明 |
| Ref 參考波形、Save/Recall、USB Flash Drive、PRINT/儲存鍵、PictBridge、USB Device | 02 明列完整 USB 存取不納入 | 按鍵顯示範圍說明；儲存 LED 恆滅；USB 口只作外觀 |
| Utility（Language、System Status、Self Cal、File Utilities、Error Log、Data Logging、Limit Test、日期時間、GPIB） | 不在核心 | 按鍵顯示範圍說明 |
| Help 說明系統 | 不在核心 | 教學說明放在儀器外；Help 鍵顯示範圍說明 |
| AutoRange | 02 規定先 OUT，且不可用 AutoSet 代替 | 按鍵顯示範圍說明，LED 恆滅 |
| Probe Check 精靈 | 02 明列 Probe Check 全流程不納入 | 圓鍵顯示範圍說明；Probe Comp 端子只作外觀與 J01 預留 |
| Trig View | 不在核心 | 按住時顯示範圍說明，不停用其他鍵 |
| 電流探棒 Scale、Invert、Volts/Div Fine | 不在核心，Fine 步幅也無來源 | CH 選單中這些選項保持預設值（Voltage、Off、Coarse），按下顯示範圍說明 |
| BW Limit 的濾波效果 | fixture 為 1 kHz，20 MHz 濾波影響可忽略 | APPROX：可切換狀態並顯示 BW 圖示，波形不變，儀器外標示近似 |
| AutoSet 的 Single-cycle、Rising/Falling edge、FFT、Video 選項 | 不在核心 | 選項可見但停用並附說明；Undo Autoset 以 APPROX 提供 |
| Freq／Period／Pk-Pk／Mean／Cyc RMS 以外的 11 種量測；以 MATH、REF 作游標來源 | 02 核心只有 Vpp、頻率、週期；Mean 與 Cyc RMS 因為 AutoSet 會自動顯示（p.80–81），列為有限例外（APPROX） | 不列入選擇，或選到時顯示『未納入』，不輸出數值 |
| 電源鍵與開機記憶 | 照片看不到電源鍵，校機開機狀態未知 | 不模擬電源循環；載入即為已定義的初始狀態（GAP-TDS-19） |

### 資料缺口與暫定行為

| ID | 缺口 | 影響 | 暫定行為 | 理由 | 日後驗證 |
| --- | --- | --- | --- | --- | --- |
| GAP-TDS-01 | LCD 語言與韌體版本。手冊可在 Utility ►Language 選 10 種語言（含 Traditional Chinese），韌體版本在 System Status 顯示（p.102 (PDF 126)、p.xv (PDF 23)）；照片 LCD 全暗 | LCD 選單、訊息列、讀值的字樣 | LCD 字樣依手冊英文圖（p.10、p.13、p.36 等），並在儀器外標示『LCD 語言暫定英文』；面板固定字樣照照片（中文＋英文） | 可引用的只有英文原文，不能從暗螢幕推測中文翻譯 | 到校按 Utility ►System Status 拍韌體版本，按 Utility ►Language 看語言並拍各核心選單。若是中文，補取原廠繁中使用手冊 077-0834-XX（件號見 M-TDS-13 p.124 (PDF 148)，本次未取得）核對用語 |
| GAP-TDS-02 | 部分側選單的 option 鍵位置。有逐格圖的只有 CH 選單（p.10）、Cursor（p.36）、Acquire（p.13）、Measure 頂層（p.31 文字）。Trigger Edge 頁的 OPT2–5、Probe 子選單、Measure n 子選單、AutoSet 選單、Horiz 選單只列項目，沒有鍵位 | 學生按哪一顆 option 鍵 | 依手冊表列或文字出現的順序，由上而下放在 OPT1 之後；Back 一律放 OPT5。儀器外標示『鍵位暫定』 | 表列順序是目前唯一的來源；位置錯只影響鍵位，不影響語義 | 到校亮屏逐一拍 Trig Menu、1 ►Probe、Measure ►Measure 1、AutoSet 後的選單、Horiz 選單 |
| GAP-TDS-03 | 各選項如何改值。手冊明說通道 Coupling 是循環（p.12–13）、Acquire 是 Radio（p.13）、Trigger Type 由頂鍵換頁（p.12）；Probe Attenuation、Measure Type、Edge Source 可用旋鈕（p.16–17）。Slope、Mode、Trigger Coupling、Cursor Type/Source、Measure Source 只寫『Push X ►Y』 | 操作手感與步驟數 | 沒寫明的一律採『每按一次換下一個值』；手冊有列旋鈕可調的項目，同時支援旋鈕並亮 LED | 循環清單是手冊示範的主要形式 | 到校逐項操作並錄影 |
| GAP-TDS-04 | 如何收起側選單。手冊沒有 Menu On/Off 鍵；只有 Help 的 Exit（p.xiv），以及 System Status 按任一選單鍵會移除（p.102） | I03-9『取消選單』後的恢復路徑 | 不發明 Menu Off 鍵；側選單一直保留，直到按下其他選單鍵 | 不可加原廠沒有的按鍵 | 到校確認再按一次同一個選單鍵是否會收起選單 |
| GAP-TDS-05 | 1/2 鍵在不同狀態下的效果。手冊寫『Displays the Vertical menu selections and toggles the display』（p.14），以及『push ... twice to remove channel 1』（p.4），但沒有逐狀態說明 | 通道開關的操作 | 通道關閉→開啟並顯示該通道選單；通道已開但目前選單不是它→只切換到它的選單；它的選單已顯示→關閉該通道 | 這樣能同時符合 p.4『按兩下移除』與 p.14 的描述 | 到校從三種起始狀態各按一次並拍照 |
| GAP-TDS-06 | Auto 模式等多久才自動觸發，以及未觸發時畫面長什麼樣。手冊只寫『within a certain amount of time based on the horizontal scale setting』（p.96） | S3、Level 超出範圍時的畫面 | 等待時間＝max(2×記錄時間(10 div×s/div), 50 ms)（PD）。未觸發的採集以固定種子隨機相位呈現可辨識的不穩定畫面，狀態顯示 Auto。測試使用確定性時鐘 | 要可重現，又要和 Normal 明顯不同 | 到校在 Auto 下把 Level 轉到超出峰值，錄影觀察更新速率與畫面 |
| GAP-TDS-07 | Auto 模式下按 Single、又沒有觸發時，會不會自動完成。p.77 寫『After the oscilloscope detects a trigger it completes the acquisition and stops』；p.100 又說 Force Trig 對 Single 有用，且 Auto 會週期性強制觸發 | S3 下按 Single 的結果 | Single 一律等有效觸發或 Force Trig 才完成，等待時狀態為 Ready；儀器外標示暫定 | 採用 p.77 對 Single 的直接描述 | 到校 Auto 模式、無輸入時按 Single 觀察 |
| GAP-TDS-08 | Default Setup 的時基是 500 ms/div（Window Zone 50 ms，兩版手冊相同），但 ≥100 ms/div 且 Auto 會進入 Scan（p.77、p.87），而 Scan 屬本輪未納入的採集模式 | 按 Default Setup 後的畫面 | 照表設 500 ms/div、Auto；狀態顯示 Scan，波形以簡化的由左至右更新呈現並標示近似，量測顯示 ?。教學流程依 p.4，Default Setup 後再按 AutoSet 取得可讀畫面。不擅自改用其他時基值 | 表值有兩版手冊支持；不能憑記憶當成印刷錯誤 | 到校按 Default Setup 後拍下方 M 時基讀值與狀態圖示 |
| GAP-TDS-09 | Default Setup 會不會重設探棒倍率。p.128 表列 Attenuation 10X，但同頁又說不重設 Probe setup（type and attenuation factor） | I03-4 錯配練習、重設後的讀值 | 首次載入時 CH1、CH2 都是 10X（p.7 預設）；按 Default Setup 不改使用者設定的 Probe 類型與倍率；儀器外標示暫定 | 不重設清單的描述比較明確，也能避免重設時偷偷替學生修正錯配 | 到校把 CH1 Probe 設 1X，按 Default Setup 後查看 1 ►Probe |
| GAP-TDS-10 | AutoSet 如何選刻度。表中 VOLTS/DIV、Horizontal scale、Horizontal position、Trigger slope 都只寫 Adjusted；垂直位置不在表內；判定『有訊號』的門檻也沒寫（p.79–80） | AutoSet 之後的畫面與讀值 | V/div 取最小的 1-2-5 檔，使整個波形在 ±4 div 內；s/div 取能顯示約 2–5 個週期的 1-2.5-5 檔；水平位置 0；Slope Rising；垂直位置不改；fixture 未提供或為 0 V 時視為沒有訊號。Multi-cycle sine 的 Cyc RMS 以第一個完整週期計算（APPROX）；Acquire 固定 Sample、觸發耦合固定 DC（化簡，PD）。 | 手冊只描述結果（usable display），演算法需要可重現的教學近似 | 到校用類似 S1 的訊號按 AutoSet，記錄 V/div、s/div、位置、Slope 與量測項 |
| GAP-TDS-11 | 垂直位置用什麼單位保存、步進多少。預設寫『0.00 divs (0.00 V)』，範圍卻以伏特表示；改 V/div 時是保持格數還是伏特沒寫；步進沒寫；探棒倍率是否放大範圍也沒寫 | 改 V/div 後波形或 GND 線的位置 | 以格數保存，改 V/div 時格數不變，再依新刻度夾在範圍內；步進 1/25 div（取自每格 25 階）；範圍以 1X 規格乘上 Probe 倍率（PD） | 預設值先以 divs 表示 | 到校把位置設 +2 div 後切換 V/div，觀察接地標記 |
| GAP-TDS-12 | AC 耦合的濾波模型。手冊只有『attenuates signals below 10 Hz』、下限頻率 ≤10 Hz（10X 被動探棒 ≤1 Hz）、串接電容（p.104、p.107、p.109） | AC 耦合下的波形與 DC 位移 | 一階高通 fc＝10 Hz；fixture 實際探棒為 10× 時 fc＝1 Hz。切換後直接呈現穩態，不模擬暫態。S1、S2 都是 1 kHz，實際效果等於扣掉 DC 平均 | 取規格上限，對核心 fixture 的影響可以忽略 | 到校以 1–100 Hz 方波觀察 AC 耦合下的下垂 |
| GAP-TDS-13 | 通道耦合會不會影響觸發路徑。手冊只說觸發耦合不影響顯示（p.21、p.98），反方向沒寫 | CH1 設 GND 又當觸發源時是否仍會觸發 | 觸發取自經過通道耦合的訊號；GND 時為 0 V，Normal 下不會觸發 | 最直觀的單一訊號路徑 | 到校 CH1 設 GND、Source CH1、Normal，觀察是否觸發 |
| GAP-TDS-14 | 量測與游標無效時怎麼顯示。手冊只給超出範圍時的 ?（p.31、p.105）；通道未顯示、還沒有採集、紀錄不足一週期時沒寫 | I03-8 的無效狀態 | 超出範圍或削頂：數值後加 ?。不足一週期或沒有有效交越：顯示 ?。通道未顯示或尚無採集：數值欄留空，儀器外標示『無效』。任何情況都不可顯示 0 | 02 要求無效狀態要清楚，不能用 0 代替 | 到校關閉 CH2 後看 Measure 欄；在 S3、Normal、未觸發時看量測欄 |
| GAP-TDS-15 | Freq/Period 用哪個位準判定交越；游標步進與範圍。手冊只寫『measuring the first cycle』 | 量測精度與游標讀值的步幅 | 以紀錄的 (max+min)/2 為參考位準，加小遲滯，取第一個完整週期；游標步進 1/25 div，限制在 graticule 內（PD） | 和 Set To 50% 的中點概念一致 | 到校以已知訊號比對；記錄游標旋轉一格時讀值的變化量 |
| GAP-TDS-16 | 沒有觸發事件時，右下角的觸發頻率讀值顯示什麼（p.112 只寫 10 Hz 下限、不計不合格事件）；停止時觸發頻率讀值依 p.112 持續更新（OT），只有「沒有事件時顯示什麼」未寫。 | S3 與 Level 超出範圍時的畫面 | APPROX：有觸發事件時顯示觸發源頻率（6 位數）；沒有事件時不顯示數值 | 不可顯示假的頻率 | 到校在 S3 狀態下拍右下角 |
| GAP-TDS-17 | Edge 的 Source 與 Coupling 清單中，有些值本輪沒有 fixture 或模型（Ext、Ext/5、AC Line、Noise Reject、HF Reject、LF Reject） | 循環順序與實機不同 | Source 只在 CH1↔CH2 之間切換，Coupling 只在 DC↔AC 之間切換；其餘值在儀器外列出，並標明與實機循環不同 | 避免選到後沒有實際效果卻顯示成功 | J 階段或補上 Ext 與濾波 fixture 後重審 |
| GAP-TDS-18 | 學校實際用哪一支探棒、補償狀態如何。手冊說 <100 MHz 的 TDS2000C 標配 TPP0101 10X（p.123），另提 P2220 可切 1X/10X（p.8） | 探棒錯配情境是否貼近學校 | fixture 明示實際倍率 1× 或 10×；補償視為理想；Probe Check 不納入 | 02 要求實際衰減在測試情境中指定 | 到校拍探棒標籤與倍率開關，並跑一次 Probe Check |
| GAP-TDS-19 | 開機狀態與記憶。手冊說關機前等 5 秒（p.20）或 3 秒（p.95）會保存設定，開機時回復；開機時 AutoRange 一律關閉（p.77）；開機時可選語言（p.1）。學校機器上次的設定未知；電源鍵在機殼頂部，照片看不到（p.4 圖） | 首次載入時的狀態 | 不模擬電源循環；首次載入使用 Appendix E 的值（配合 GAP-TDS-08、09），並標示『不是校機的開機值』 | 開機記憶屬 02 的待確認項目 | 到校開機後不按任何鍵直接拍畫面 |
| GAP-TDS-20 | 每格多少像素。LCD 為 320×240（p.113）；10×8 div 是由 p.10 圖與 p.98、p.108、p.111 推得；每格像素數沒寫 | 波形與游標的最小步幅 | 25 px/div（PD：p.56 說 FFT 壓成 250 points、p.108 說每格 25 階），模擬器可等比放大 | 兩處數字一致 | 到校亮屏近拍，核對比例 |
| GAP-TDS-21 | 停止時改耦合或探棒倍率，波形會不會變斷線（手冊只舉『改觸發設定』為例，p.84） | I03-6 停止畫面的樣式 | 改 V/div、垂直位置、s/div、水平位置、Probe 倍率（只換算讀值）：重畫凍結紀錄，保持實線。改觸發設定或通道耦合：改為斷線樣式，資料不重算（PD） | 依『控制是否能套用到已顯示的波形』這條原則 | 到校停止後逐項改設定並觀察 |
| GAP-TDS-22 | Volts/Div Fine 的步幅（p.105 只寫『small steps between the coarse settings』） | 精細調刻度 | 本輪 OUT：選項保持 Coarse，選 Fine 時顯示範圍說明 | 步幅沒有來源 | 到校開 Fine，記錄旋鈕轉一格的讀值變化 |
| GAP-TDS-23 | 照片上中文貼字的來源與術語對照。手冊配件章（p.123–124）沒有列出中文貼面；『自動調整』對應 AutoRange、『單一』對應 Single，是依位置與手冊面板圖對照推定 | 面板字樣與功能對應 | 面板字樣照抄照片；功能依手冊英文名（對照證據為 PH+OT 的位置比對） | 位置、數量與手冊圖完全一致 | 取得繁中手冊 077-0834-XX，或到校用亮屏 Help 核對 |
| GAP-TDS-24 | 模擬器採集模型與量測容差（02／03 要求明訂解析度） | I03 所有數值測試 | 每筆紀錄 2500 點涵蓋 10 div（p.75、p.110）；取樣間隔＝s/div/250，最快 2 ns（500 MS/s）；更快的時基以內插補滿 2500 點（p.76）；不加雜訊與量化；容差以 1 個取樣間隔、1/25 div 為基礎 | 採用手冊的記錄結構，但不宣稱真機精度 | I03 實作者記錄演算法；以 S1、S2 反推驗證 |
| GAP-TDS-25 | 校機 LCD 語言：M-TDS-13 p.1 (PDF 25) 說開機時可選螢幕語言，也可用 Utility ►Language 隨時改；校機前面板有中文貼字，但 LCD 語言未知 | LCD 選單文字；學生到校看到的可能是中文選單 | LCD 用手冊英文；儀器外提供「校機可能設為中文」提醒與對照表（對照表只列本卡 CORE 選單項目） | 只有英文手冊，中文選單字樣沒有來源，不能自行翻譯後放進 LCD | 到校拍亮屏選單；若為中文，補一版有來源的中英對照 |

### 來源差異

| 主題 | 來源 A | 來源 B | 採用 |
| --- | --- | --- | --- |
| TDS2001C 最大取樣率 | M-TDS-13 p.1 (PDF 25) 型號表『TDS2001C … 500 MS/s』；p.76 (PDF 100)『Maximum of 500 MS/s for 40 MHz and 50 MHz models』；P2 型號條『500 MS/s』 | M-TDS-13 p.110 (PDF 134) Table 4『Sample Rate Range … TDS2001C, 2002C, 2004C: 5 S/s to 1 GS/s』；M-TDS-11 同頁同文 | 採 500 MS/s（照片加兩處正文一致），只作採集模型的上限；精準取樣率本輪不納入；p.76 的「100 ns 門檻」與 1 GS/s 機型相符，TDS2001C 依 500 MS/s 推算為 250 ns/div（PD）。 |
| Default Setup 是否重設探棒倍率 | M-TDS-13 p.128 (PDF 152) 表列『Voltage Probe Attenuation 10X』；p.4 (PDF 28)『Push the Default Setup button. The default Probe option attenuation setting is 10X.』 | 同頁 p.128『The Default Setup button does not reset … Probe setup (type and attenuation factor)』 | 暫定不重設，首次載入為 10X（GAP-TDS-09），到校驗證 |
| 關機前保存設定的等待時間 | M-TDS-13 p.20 (PDF 44)『wait five seconds after the last change』 | M-TDS-13 p.95 (PDF 119)『wait three seconds after the last change』 | 本輪不模擬電源循環，只記錄 |
| HF Reject 觸發耦合的頻率 | M-TDS-13 p.98 (PDF 122)『Attenuates the high-frequency components above 80 kHz』 | M-TDS-13 p.111 (PDF 135)『HF REJ Same as DC Coupled limits from DC to 7 KHz』 | HF Reject 本輪 OUT，兩個數字都不採用 |
| 附錄代號前後不一致 | 正文 p.20 (PDF 44)、p.83 (PDF 107)、p.95 (PDF 119) 寫『Appendix D: Default Setup』；p.2 (PDF 26) 寫『Appendix B: Accessories』；M-TDS-11 的前言也用 B/C/D/E | 兩版實際章名與目錄：Appendix C: Accessories（p.123）、Appendix E: Default Setup（p.127）；M-TDS-13 的前言已改成 C/D/E/F | 一律以章節標題與印刷頁引用 |
| 面板字樣：照片與手冊 2 通道面板圖 | P2：AutoRange 位置的鍵面無字，上方貼『自動調整』；Single 鍵面看不到字，上方貼『單一』；水平鍵面只有『Horiz』，左側加『選單』；區塊與旋鈕標字為中文（垂直、水平、觸發、位置、刻度、功能表、位準、儲存）；另有參考值、自動設定、執行/停止、設置為零、設置為 50%、強制觸發、觸發監看；型號條完整印『TDS 2001C TWO CHANNEL DIGITAL STORAGE OSCILLOSCOPE』與『50 MHz 500 MS/s』 | M-TDS-13 p.9 (PDF 33) 面板圖：英文 AutoRange；鍵面 Single、Horiz Menu；Vertical/Horizontal/Trigger、Position、Scale、Menu、Level、Save；型號條只有『Tektronix TDS』。M-TDS-11 同圖 | 面板字樣照照片（中文貼字＋照片可見的英文鍵面字），功能名稱與行為依手冊；控制數量、分組、順序兩者完全一致 |
| Set to Zero 的寫法 | P2 鍵面與 p.14 (PDF 38)『Set to Zero』 | p.86 (PDF 110)『Set To Zero Button』 | 面板照照片寫『Set to Zero』 |
| Horiz 選單中的 Holdoff／Trig Knob 項目 | p.86 (PDF 110) 表只列 Main、Window Zone、Window、Set Holdoff | p.101 (PDF 125)『Horiz ►Set Trigger Holdoff』；Appendix E p.127 (PDF 151) 在 HORIZONTAL 下列『Trig Knob: Level』 | Holdoff 與 Trig Knob 本輪 OUT，只記錄；Horiz 選單只啟用 Main |
| AutoRange 表的 Trigger mode 值 | p.78 (PDF 102) Autorange 表『Trigger mode Edge』 | p.96 (PDF 120)：Mode 為 Auto/Normal，Edge 是 Type | AutoRange 本輪 OUT，不引用該列 |
| FFT 章列的機型頻寬 | p.56 (PDF 80)『(40 MHz, 60 MHz, 100 MHz or 200 MHz, depending on the model…)』，沒有 50 MHz | p.1 (PDF 25)、p.109 (PDF 133) TDS2001C 為 50 MHz | 採 50 MHz；FFT 本輪 OUT |
| 秒/格下限 | p.110 (PDF 134) TDS2001C 所屬欄『5 ns/div to 50 s/div』 | p.25 (PDF 49) 反混疊表列到 2.5 ns，註『Depending on the oscilloscope model』 | 採 5 ns/div（機型欄位明確） |
| 量測類型名稱 | p.31 (PDF 55)、p.89 (PDF 113) 寫『Freq』 | p.35 (PDF 59)『Push Type ►Frequency』 | LCD 用 p.32 (PDF 56) 圖上的『Freq』 |
| GND 耦合的三段描述 | p.104 (PDF 128)『Ground disconnects the input signal』；p.105 (PDF 129)『Internally, the channel input is connected to a zero-volt reference level』 | p.107 (PDF 131)『reference waveform derived from the values identified during SPC … shows visually where ground is expected to be』 | 三段都指向『顯示零伏參考』，不算矛盾；模擬器顯示位於該通道位置的零伏水平線，不關閉通道 |
| 規劃提示與來源：option 鍵下方的圓鍵 | 本次任務提示寫『下方圓形鍵（Menu On/Off？）』 | P2 圓鍵右側直書『Probe Check』；M-TDS-13 p.9 (PDF 33) 圖同一位置也標 Probe Check；p.6 (PDF 30)『push the PROBE CHECK button』；全手冊沒有 Menu On/Off 鍵 | 定為 PROBE CHECK 鍵（OUT），不新增 Menu On/Off |
| 兩版手冊之間 | M-TDS-13：077-0826-00（2013） | M-TDS-11：071-2722-03 Revision A（2011） | 全文 diff 只有文件號、Revision、安全摘要大小寫、RoHS 文句、前言附錄代號、標準配件文句、各語言手冊件號不同；操作章節、規格表、Appendix E 的文字相同；圖頁只有反鋸齒等級的差異。以 M-TDS-13 為主引用 |
| 內插啟用門檻的單位 | M-TDS-13 p.76 (PDF 100)：「At 100 ns and faster settings…」 | M-TDS-13 p.110 (PDF 134)：「Waveform interpolation is activated for sweep speeds of 100 ms/div and faster」 | 100 ms 疑為 100 ns 誤植；兩者都不直接適用 500 MS/s 的 TDS2001C，模擬器依 GAP-TDS-24 推算。精準取樣仍 OUT。 |

## 3. GW Instek GPE-4323 四路直流電源供應器（原版，非 A 版）（I04）

### 核心功能與驗收規則

| ID | 功能 | 可驗收規則 | 來源 | 證據 | 驗收（03 案例） |
| --- | --- | --- | --- | --- | --- |
| GPE-F01 | 四路電壓設定 | 四顆 Voltage 旋鈕各自只改所屬通道的 V-set：GPE.KNOB.CH1_VOLTAGE→CH1（0–32 V）、CH2_VOLTAGE→CH2（0–32 V）、CH3_VOLTAGE→CH3（0–5 V）、CH4_VOLTAGE→CH4（0–15 V）；到上下限夾住不溢位；四路設定分開保存，轉某顆旋鈕不改其他三路。步進為暫定值並在儀器外標示。 | M-GPE p.18 (PDF 18)、M-GPE p.31 (PDF 31)、M-GPE p.32 (PDF 32)、M-GPE p.33 (PDF 33)、M-GPE p.35 (PDF 35)、M-GPE p.45 (PDF 45) | PH+OT；步進 PD | I04-1：逐一轉四顆 Voltage 旋鈕，只有對應通道的設定改變；I04-7：推到極限後其餘通道不受影響。 |
| GPE-F02 | CH1／CH2 電流限制 | 只有 GPE.KNOB.CH1_CURRENT、CH2_CURRENT 可調 I-set（0–3 A）；CH3、CH4 沒有電流旋鈕也沒有可調限流 UI。 | M-GPE p.18 (PDF 18)、M-GPE p.31 (PDF 31)、M-GPE p.32 (PDF 32)、M-GPE p.45 (PDF 45) | PH+OT | I04-1：旋鈕數量＝6，只有 CH1/CH2 有 Current；對照照片。 |
| GPE-F03 | LCD 通道切換（只切顯示） | CH1/CH4 鍵切換第一列 ①⇔④，CH2/CH3 鍵切換第二列 ②⇔③；切換後 V/A 與 CV/CC 圖示改顯示該通道。旋鈕歸屬固定，不隨顯示重新指派；例如第一列顯示 ④ 時轉 CH1 Voltage 仍改 CH1（暫定：顯示不自動跳回 ①，見 GAP-GPE-04）。 | M-GPE p.17 (PDF 17)、M-GPE p.18 (PDF 18)、M-GPE p.26 (PDF 26)、M-GPE p.34 (PDF 34)、M-GPE p.35 (PDF 35) | PH+OT；自動跳回與否 PD | I04-2：切到 ④ 後轉 CH1 Voltage，再切回 ① 看到 CH1 已變、CH4 未變。 |
| GPE-F04 | 設定值／讀回值區分 | 狀態分三層：旋鈕設定（V-set/I-set）、有效輸出（Output 與模式決定）、LCD 顯示。Output OFF：LCD 顯示設定值（暫定，依 p.23）；Output ON：LCD 顯示讀回（由測試負載計算），短按 Set View 暫時顯示設定並亮 Set 圖示（返回時機暫定，見 GAP-GPE-02）。無負載時讀回電流為 0，不得顯示 I-set。 | M-GPE p.16 (PDF 16)、M-GPE p.17 (PDF 17)、M-GPE p.19 (PDF 19)、M-GPE p.22 (PDF 22)、M-GPE p.23 (PDF 23) | OT；OFF 時顯示內容與返回時機 PD | I04-3：Output ON、無負載，電流顯示 0.000 A；按 Set View 看到 I-set；I04-6：Set View 行為與矩陣暫定規格一致。 |
| GPE-F05 | 總 Output（一鍵全部通道） | GPE.KEY.OUTPUT_ON_OFF 一次開／關 CH1–CH4 全部輸出；ON 時鍵燈亮、LCD ON 圖示、各顯示通道出現 CV/CC；OFF 時 OFF 圖示、CV/CC 熄，所有設定值保留。Output 與 POWER、模式、顯示切換是不同狀態。Lock 不影響 Output 鍵。 | M-GPE p.17 (PDF 17)、M-GPE p.25 (PDF 25)、M-GPE p.27 (PDF 27)、M-GPE p.32 (PDF 32)、M-GPE p.43 (PDF 43) | OT+PH | I04-3：OFF→ON→OFF，四通道同步；設定值不變；未開輸出時不亮 CV/CC。 |
| GPE-F06 | Independent／Series／Parallel 切換與自動關 Output | 兩顆模式鍵各為按下／彈起兩態（依圖例推論為自鎖）：右彈起＝Independent（SER、PARA 皆滅），左彈起＋右按下＝Series（SER 亮），兩鍵按下＝Parallel（PARA 亮）。Output ON 時只要模式改變即自動 OFF；Output OFF 時換模式維持 OFF。左按下＋右彈起暫定為 Independent（GAP-GPE-07）。不得做成三顆模式大按鈕。 | M-GPE p.25 (PDF 25)、M-GPE p.26 (PDF 26)、M-GPE p.31 (PDF 31)、M-GPE p.37 (PDF 37)、M-GPE p.41 (PDF 41)；P1 圖例 | PH+OT；自鎖與第四組合 PD | I04-5：依序操作兩鍵走遍三模式，每次換模式 Output 由 ON 變 OFF、SER/PARA 正確；I04-7：切回 Independent 後可再操作。 |
| GPE-F07 | Series tracking 控制關係 | Series：CH1 為 master，CH1 Voltage 同時決定 master 與 slave 電壓；CH1 Current 設 master 限流，CH2 Current 設 slave 限流；CH2 Voltage 暫定無效（PD）。CH1 列顯示 master，CH2 列顯示 slave（共地接法 p.40）；無共地接法的合併電壓＝CH1 讀值 ×2，由學生換算（面板不顯示 64 V 合併值）。CH3/CH4 不受影響。 | M-GPE p.11 (PDF 11)、M-GPE p.37 (PDF 37)、M-GPE p.38 (PDF 38)、M-GPE p.39 (PDF 39)、M-GPE p.40 (PDF 40)、M-GPE p.45 (PDF 45) | OT；CH2 Voltage 無效與合併限流模型 PD | I04-5：Series 下轉 CH2 Voltage 無輸出變化，轉 CH1 Voltage 兩列同步；CH3/CH4 設定與輸出不變。 |
| GPE-F08 | Parallel tracking 控制關係 | Parallel：CH1 Voltage／Current 控制合併輸出（0–32 V、0–6 A）；CH2 兩顆旋鈕停用；Output ON 時 CH2 列顯示 CC 圖示；CH1 電流讀值為總電流的一半（輸出電流＝CH1 讀值 ×2）。CH3/CH4 不受影響。 | M-GPE p.41 (PDF 41)、M-GPE p.42 (PDF 42)、M-GPE p.45 (PDF 45) | OT；合併限流＝2×I1set 為 PD | I04-5：Parallel 下轉 CH2 旋鈕無效；Output ON 時 CH2 顯示 CC。 |
| GPE-F09 | 以已知測試負載展示 CH1／CH2 的 CV／CC | 儀器外「單機測試情境」提供理想電阻負載（L1）。理想模型：I＝min(V-set/R, I-set)；若 V-set/R < I-set → CV（V＝V-set）；否則 CC（I＝I-set，V＝I-set×R）。L1：5 V、0.1 A，100 Ω → CV 5.00 V/0.050 A；10 Ω → CC 1.00 V/0.100 A。0 Ω／開路需明確處理，不出 NaN。只在 Output ON 時生效。 | M-GPE p.22 (PDF 22)；02 L1 | OT（模型）+PD（fixture 與數值） | I04-4：100 Ω→10 Ω，CV 轉 CC，讀回 V/I 自洽；空載讀回電流 0。 |
| GPE-F10 | CH3／CH4 獨立、不參與 tracking | CH3/CH4 只有電壓設定；Series/Parallel 不改變其設定或輸出；Output ON 且在測試情境的輕載（≤ 額定）下顯示 CV；過載／CC 轉換不列核心，1 A 不當精準門檻。 | M-GPE p.33 (PDF 33)、M-GPE p.34 (PDF 34)、M-GPE p.35 (PDF 35)、M-GPE p.36 (PDF 36) | OT；過載行為 UN | I04-1、I04-5：切換模式前後 CH3/CH4 設定與讀回不變。 |
| GPE-F11 | 重設／開機狀態 | POWER 開機：短暫全段顯示 → 顯示各通道設定；Output＝OFF；模式由兩模式鍵實體狀態決定（PD）；顯示預設 ①、②（PD）；顯示位數 4 位。儀器外提供「重設到已定義狀態」，不宣稱為原廠開機記憶。 | M-GPE p.23 (PDF 23)、M-GPE p.28 (PDF 28)、M-GPE p.29 (PDF 29) | OT；設定值記憶與預設顯示通道 PD/UN | I04-7：重設後 Output OFF、可再次操作。 |
| GPE-F12 | Lock（近似） | 若實作：長按 Set View >2 s 上鎖，Lock 圖示亮；暫定只鎖 CH1、CH2 Voltage 旋鈕（依 p.27 專節）；On/Off 永不被鎖；再長按 >2 s 解鎖，Lock 熄且 Output 關。其他控制是否被鎖在儀器外標為「待校機確認」。若暫緩，Set View 長按顯示範圍說明，不假成功。 | M-GPE p.19 (PDF 19)、M-GPE p.25 (PDF 25)、M-GPE p.27 (PDF 27)、M-GPE p.43 (PDF 43) | OT；範圍 UN→PD | I04-6：Lock 後 Output 仍可開關；解鎖後 Output 為 OFF。 |

### 規格、範圍與預設值

| 項目 | 值 | 來源 | 證據 | 原文 |
| --- | --- | --- | --- | --- |
| CH1/CH2 Independent 輸出範圍 | 各 0–32 V／0–3 A | M-GPE p.31 (PDF 31)、M-GPE p.45 (PDF 45) | OT | "0 ~ 32V/0~3A for each channel"（p.31）；"CH1/CH2 Independent 0 ~ 32V / 0 ~ 3A"（p.45） |
| CH3 輸出範圍（GPE-4323 欄） | 0–5 V 可調，1 A max；無電流旋鈕 | M-GPE p.33 (PDF 33)、M-GPE p.45 (PDF 45)、M-GPE p.18 (PDF 18) | OT | "GPE-4323：0~5V,1A Max."（p.33）；"0~5V, 1A(GPE-4323)"（p.45） |
| CH4 輸出範圍 | 0–15 V 可調，1 A max；無電流旋鈕 | M-GPE p.35 (PDF 35)、M-GPE p.45 (PDF 45)、M-GPE p.18 (PDF 18) | OT | "0~15V/1A max"（p.35）；"CH4 0~15V,1A"（p.45）；p.18 "Sets the voltage for the GPE-4323." |
| Series tracking（無共地） | 0–64 V／0–3 A；輸出電壓＝CH1 電壓表 ×2，輸出電流＝CH1 電流表 | M-GPE p.37 (PDF 37)、M-GPE p.38 (PDF 38)、M-GPE p.45 (PDF 45) | OT | "0 ~ 64V/0 ~ 3A"（p.37）；"Double the reading on the CH1 voltage meter."（p.38） |
| Series tracking（共地 COM） | CH1~COM 0–32 V／0–3 A；CH2~COM 0～−32 V／0–3 A；CH1(−) 為 COM | M-GPE p.39 (PDF 39) | OT | "0~32V/0~3A for CH1 ~ COM" "0~-32V/0~3A for CH2 ~ COM"（p.39） |
| Parallel tracking | 0–32 V／0–6 A；輸出電流＝CH1 電流表 ×2；CH2 控制停用、CH2 顯示 CC | M-GPE p.41 (PDF 41)、M-GPE p.42 (PDF 42)、M-GPE p.45 (PDF 45) | OT | "0 ~ 32V/0 ~ 6A"（p.41）；"CH2 control function is disabled."（p.42）；"Double the amount of CH1 current meter reading."（p.42） |
| Tracking 範圍與誤差 | master 0–32 V；tracking error ≤0.1%+10 mV（教學模型不模擬誤差） | M-GPE p.45 (PDF 45) | OT | "Tracking Error ≤ 0.1% + 10mV of Master (0 ~ 32V)" |
| 模式鍵組合 | Independent：兩鍵皆彈起（OT+PH）；Series：右鍵按下＋左鍵彈起（OT+PH）；Parallel：兩鍵按下（OT+PH）；左按下＋右彈起：暫定 Independent（PD，GAP-GPE-07） | M-GPE p.25 (PDF 25)、M-GPE p.26 (PDF 26)；P1 圖例 | OT+PH+PD | "For the independent mode, the right key is not pressed"；"Toggle to parallel mode when both keys are pressed."；"Right key is pressed and the left key is not pressed in series mode." |
| 模式切換與 Output 聯動 | Output ON 時切換 Independent／Series／Parallel → Output 自動 OFF | M-GPE p.25 (PDF 25) | OT | "Any of the following actions during output on automatically turns it off. • Change the operation mode between independent / series tracking / parallel tracking" |
| 其他自動關 Output 條件 | OVP 觸發（本輪不做）；Lock 解除；切到遠端控制（本輪不做） | M-GPE p.25 (PDF 25)、M-GPE p.27 (PDF 27) | OT | "When OVP is activated on a channel (except CH3 on the GPE-3323)" "When the lock function is disabled." "When toggling to remote control" |
| Output 鍵作用範圍 | 一鍵控制全部通道（CH1–CH4） | M-GPE p.25 (PDF 25) | OT | "Press the Output key to turn on all outputs in each channel." "Push the Output key again to turn off all outputs." |
| 開機 Output 預設 | OFF（可由開機組合改為 ON，本輪不做；校機設定未知） | M-GPE p.27 (PDF 27)、M-GPE p.28 (PDF 28) | OT；校機設定 UN | "By default the output is set to OFF at startup." |
| 開機顯示 | 先亮全部 LCD 段，再顯示各通道設定 | M-GPE p.23 (PDF 23) | OT；時長 UN | "The display will first display all the LCD segments before showing settings for each channel." |
| CV/CC 判定 | 負載電流 < I-set → CV（V＝V-set，I 由負載決定）；電流達 I-set → CC（I＝I-set，V < V-set）；電流降回 → CV | M-GPE p.22 (PDF 22)、M-GPE p.11 (PDF 11) | OT | "When the current level is smaller than the output setting ... operates in Constant Voltage mode." "When the current level reaches the output setting ... starts operating in Constant Current mode." |
| CV/CC 指示有效條件 | 僅 Output ON 有效；Output OFF 時 CV/CC 顯示熄滅；指示跟隨該列所選通道 | M-GPE p.17 (PDF 17) | OT | "Each state is valid only when the output is ON. When output is OFF, the display is turns off." |
| Set View（查看設定） | Output ON 時按下顯示所選通道 V/I 設定；Set 圖示；返回時機未找到 | M-GPE p.17 (PDF 17)、M-GPE p.19 (PDF 19) | OT；返回 UN | "When the output is ON, you can view the voltage/current settings of each channel by pressing this key." |
| Lock 長按時間與效果 | 長按 >2 s 上鎖／解鎖；Lock 圖示；解鎖時 Output 關；OUTPUT 鍵不受影響；鎖定範圍段落不一（見 discrepancies） | M-GPE p.27 (PDF 27)、M-GPE p.19 (PDF 19)、M-GPE p.43 (PDF 43) | OT；範圍 UN | "Press the LOCK key (for more than 2 seconds) to lock the voltage knob operation for CH1 & CH2"；"The OUTPUT key is not affected by the lock operation." |
| Meter resolution | 電壓 10 mV 或 100 mV；電流 1 mA 或 10 mA（GPE-4323 不取 GPE-1326 的 2 mA） | M-GPE p.45 (PDF 45) | OT | "Meter Resolution Voltage 10mV or 100mV current 1mA or 10mA" |
| 顯示位數與滿刻度 | 4.3" 單色 LCD；電壓表 33.00 V 滿刻度、電流表 3.200 A 滿刻度，4 位或 3 位；預設 4 位（對應推論：4 位＝10 mV/1 mA，3 位＝100 mV/10 mA） | M-GPE p.46 (PDF 46)、M-GPE p.29 (PDF 29)、M-GPE p.45 (PDF 45) | OT；位數↔解析度對應 PD | "Voltmeter 33.00V full scale, 4 digits or 3 digits"；"Ammeter 3.200A full scale"；"By default the number of displayed digits is set to four." |
| 設定／讀回精度（不模擬，只用於說明顯示≠精度） | 電壓 ±(0.1% rdg＋30 mV)（4 位）／±(0.1%＋200 mV)（3 位）；電流 ±(0.3%＋6 mA)（4 位）／±(0.3%＋20 mA)（3 位） | M-GPE p.46 (PDF 46) | OT | "Voltage: ± (0.1% of reading + 30mV) (4digits)" "Current: ± (0.3% of reading + 6mA)(4digits)" |
| 旋鈕步進／粗細調 | 未找到（GPE-4323 無 coarse/fine；coarse/fine 只屬 GPE-1326） | M-GPE p.18 (PDF 18) | UN | GPE-1326: "It has coarse and fine adjustment features."（p.18，僅 GPE-1326） |
| CH3/CH4 限流 | 無電流旋鈕；額定 1 A max；手冊寫 "exceeds the setting value" 轉 CC，但未定義 CH3/CH4 的電流設定值 → 精準門檻 UN，不作核心 | M-GPE p.34 (PDF 34)、M-GPE p.36 (PDF 36)、M-GPE p.18 (PDF 18) | OT+UN | "When the output current level exceeds the setting value, the CV icon changes to the CC icon on the LCD display."（p.34、p.36） |
| 規格前提 | 開機 30 分鐘、+20–30 °C；規格為 Unlock 狀態；Lock 後輸出約 20 mV 波動（不模擬） | M-GPE p.45 (PDF 45)、M-GPE p.46 (PDF 46)、M-GPE p.27 (PDF 27) | OT | "Specifications listed above are specifications under the “Unlock” state."；"It is normal for the output voltage to have a fluctuation of around 20mV after the voltage settings are locked." |
| Regulation／Ripple（不模擬） | 電壓 line/load ≤0.01%+3 mV；ripple ≤1 mVrms；電流 line/load ≤0.2%+3 mA；recovery ≤100 µs | M-GPE p.45 (PDF 45) | OT | "Line ≤ 0.01% + 3mV" "Ripple & Noise ≤ 1mVrms (5Hz ~ 1MHz)" |
| L1 測試負載預期值（規劃者 fixture，理想模型） | CH1 V-set 5 V、I-set 0.1 A：100 Ω → CV，約 5.00 V／0.050 A；10 Ω → CC，約 1.00 V／0.100 A；無負載 → CV，5.00 V／0.000 A | 02 第一階段測試情境 L1；M-GPE p.22 (PDF 22) | PD（依 OT p.22 模型計算） | 02："預期 CV、約 0.05 A；改成 10 Ω 時在理想教學模型下進 CC、約 1 V／0.1 A" |

### 本輪未納入

| 項目 | 理由 | 面板處理 |
| --- | --- | --- |
| OVP／OCP／OTP 功能與 LCD 圖示 | 手冊只提 OVP 狀態與 OVP 觸發關輸出（p.17、p.25），全冊無 GPE-4323 設定方法或門檻；OCP、OTP 無正文。 | LCD 保留圖示段但恆暗；儀器外範圍說明「未納入」。 |
| 開機輸出狀態設定（按住 Output 開機） | 02 未列核心；校機目前設定未知（p.27–28）。 | 不提供此開機組合；範圍說明寫「原廠預設 OFF，校機設定待確認」。 |
| 顯示位數 3／4 設定（按住 Set View 開機） | 非核心（p.29）；預設 4 位。 | 固定 4 位顯示；範圍說明提及 3 位選項存在。 |
| 遠端控制（後面板 Remote control 端子） | 後面板功能、非第一階段（p.21、p.30）。 | 不繪製或僅於說明中提及。 |
| 後面板：AC Selector、電源線／保險絲座、風扇 | 照片只拍前面板；第一階段不做後面板（p.21、p.44）。 | 不繪製。 |
| CH3／CH4 過載與精準保護門檻；GPE-3323 CH3 OverLoad（5.2 A） | 1 A 為額定，手冊未定義 CH3/CH4 電流設定值；OverLoad 屬 GPE-3323（p.18、p.34、p.43）。 | 測試情境不提供 CH3/CH4 超載負載，或選到時顯示「本輪未納入」；OverLoad 圖示恆暗。 |
| Overload／反接保護、熱、瞬態、regulation／ripple／recovery、tracking error、設定/讀回精度誤差 | 02／01 列為本輪不做（p.12、p.45–46 僅作說明）。 | 範圍說明；讀值用理想模型並標示近似。 |
| 端子實際接線、Series/Parallel 外部接線計算、任意負載 | 屬 J01／J02。 | 端子只顯示並保留 terminal ID；CV/CC 用儀器外測試負載。 |
| Lock 後約 20 mV 輸出波動 | 硬體特性，非操作邏輯（p.27）。 | 不模擬。 |
| 其他型號功能：GPE-1326 coarse/fine 與 sense 端子、GPE-3323 固定 5 V/5 A、GPE-4323A 任何功能 | 型號不同（p.18、p.19、p.20）。 | 不加入面板。 |
| LCD「Set」「Out」列標示（GPE-1326）與「③ 5v 3.3v 2.5v 1.8v OverLoad」列（GPE-3323） | 推論（PD）：列首 Set/Out 疑為 GPE-1326 的設定／讀回列標示；「③ 5v 3.3v 2.5v 1.8v OverLoad」列依 p.18 屬 GPE-3323。p.15 沒有明說 Set/Out 屬哪一型。 | 保持暗段。 |

### 資料缺口與暫定行為

| ID | 缺口 | 影響 | 暫定行為 | 理由 | 日後驗證 |
| --- | --- | --- | --- | --- | --- |
| GAP-GPE-01 | Lock 鎖定範圍原廠說法不一。只鎖 CH1/CH2 電壓的說法：p.12「Inadvertent voltage setting protection」「Function for locking the setting voltage (CH1/CH2)」、p.27「lock the voltage knob operation for CH1 & CH2」「The voltage lock function only applies to CH1 & CH2.」「takes the present channel settings as the reference levels」。鎖面板按鍵（Output 除外）的說法：p.15 callout 與 p.19 小標「View setting value/ Key lock」、p.19「Press and hold the key to lock and unlock the panel keys (except OUTPUT).」、p.43「Q1. I pressed the panel lock key but the output still turns on/off.」「A1. … the output key is not affected by the panel key lock feature.」。一致點：長按、On/Off 不受影響、解鎖時 Output 關閉（p.25、p.27）。 | I04-6 的 Lock 行為無法宣稱完全還原；若鎖太多會困住學生操作。 | 近似版（定案）：長按 Set View ≥ 2.0 s 切換 Lock；Lock 期間只鎖 CH1、CH2 Voltage 旋鈕（轉動無作用），其他旋鈕與按鍵照常；On/Off 永不鎖；Lock 圖示亮；解鎖時 Output 自動關閉。儀器外標示「Lock 範圍原廠說法不一（p.19／p.43 說鎖面板按鍵），待校機確認」。 | 暫採 p.27：它是唯一有逐步操作的段落。p.19／p.43 的「鎖面板按鍵」說法同樣是原廠正文，不是摘要；兩種解讀都保留，校機後再定。 | 校機：上鎖後逐一轉 CH1/CH2 Current、CH3/CH4 Voltage、按 CH1/CH4、CH2/CH3、Set View 短按、模式鍵，記錄是否有反應；錄影。 |
| GAP-GPE-02 | Set View 返回時機與條件未寫：p.17 "When output is ON, you can view the voltage/ current setting value depending on the channel be selected."；p.19 "When the output is ON, you can view the voltage/current settings of each channel by pressing this key. The corresponding channel will be displayed on the LCD display."——沒寫是再按返回、放開返回還是逾時返回；Output OFF 時按下的效果、Set 圖示在 OFF 時是否亮也未寫；看設定時轉旋鈕的顯示也未寫。 | 設定／讀回區分的 UI 細節（I04-3、I04-6）。 | 定案：Output ON 時短按 Set View → 兩列改顯示該列通道的設定值並亮 Set；再按一次或 3.0 s 無操作即返回讀回（兩者都生效）；Output OFF 時 LCD 本來就顯示設定值，短按沒有額外變化，Set 段不亮。儀器外標示近似。 | 手冊只保證「Output ON 時可看設定」；p.23 說開機後顯示設定，故 OFF 時顯示設定為最小推論。 | 校機：Output ON 接負載，短按 Set View 計時看何時返回；再按一次是否返回；OFF 時按下有無變化；看 Set 圖示。 |
| GAP-GPE-03 | 旋鈕步進、加速、是否為無限旋轉編碼器或有端點的電位器、上限是否可超過 32 V/3 A（顯示滿刻度 33.00 V、3.200 A）皆未找到。 | 旋鈕手感與可重現細調（I01-2、I04-1）。 | 近似：CH1/CH2 電壓每格 10 mV、電流每格 1 mA（對應 4 位顯示解析），CH3/CH4 電壓每格 10 mV；支援聚焦後細調／粗調倍率；上限夾在額定 32 V/3 A/5 V/15 V。儀器外標示「步進為模擬器設定」。 | p.45 的 Meter Resolution（10 mV／1 mA）與 p.46 的 Setting/Read back Accuracy 是分開列的（OT）；「顯示解析度不等於精度、也不一定是旋鈕最小步進」出自規劃文件 02，不是手冊原文。 | 校機：慢轉一格記錄讀值變化；快轉是否加速；轉到底是否有機械停點；記錄最大可設值。 |
| GAP-GPE-04 | 轉動目前未顯示通道的旋鈕時，LCD 是否自動跳到該通道（例如顯示 ④ 時轉 CH1 Voltage）未寫。 | I04-2 的可見回饋。 | 近似：不自動跳轉；設定照樣改變，切回該通道才看得到；儀器外提示。 | p.26 只描述按鍵切換；02 要求旋鈕歸屬與顯示分離。 | 校機：切到 ④ 後轉 CH1 Voltage，觀察第一列是否跳回 ①。 |
| GAP-GPE-05 | 開機記憶：開機 Output 狀態可被設定（p.27–28，預設 OFF），校機目前設定未知；斷電後 V/I 設定是否保留、模式鍵狀態（若為機械自鎖則保持）未寫。 | 重設／開機行為（I04-7）。 | 定案：模擬器「電源開／重設」＝CH1–CH4 V-set 0.00 V、CH1／CH2 I-set 0.100 A、兩模式鍵彈起（Independent）、LCD 顯示 ①②、Output OFF、Lock 解除；儀器外標示「非原廠開機記憶」。原廠預設開機 Output OFF（p.28）與此一致。 | p.28 "By default the output is set to OFF at startup."；02 要求開機記憶與重設分開。 | 校機：記錄開機後 LCD、Output 狀態；改設定後關機再開看是否保留。 |
| GAP-GPE-06 | 校機顯示位數（3 或 4）未知；位數與解析度對應為推論。 | LCD 小數點位置。 | 近似：4 位（10 mV、1 mA），例如 5.00 V、0.050 A。 | p.29 預設四位；p.46 "33.00V full scale"、"3.200A full scale"。 | 校機亮屏照片；若為 3 位則加設定選項。 |
| GAP-GPE-07 | 模式鍵第四組合（左按下＋右彈起）未圖示；p.25 文字 "For the independent mode, the right key is not pressed" 只約束右鍵。模式鍵是否為機械自鎖也只由圖例高低推論。 | I04-5 模式邏輯。 | 近似：右鍵彈起即 Independent（不論左鍵）；兩鍵以可保持按下的 toggle 呈現，按下狀態有明顯視覺差。 | 依 p.25 文字規則；Series 與 Parallel 條件都要求右鍵按下。 | 校機：只按左鍵，看 SER/PARA 是否全滅；觀察鍵是否停在按下位置。 |
| GAP-GPE-08 | Series 下 CH2 Voltage 旋鈕是否有效未寫；Series/Parallel 下 CH2 列顯示內容（slave 電壓的正負號、Parallel 時數值）未寫；返回 Independent 後 CH2 是否恢復原 V2set 未寫。 | I04-5 master/slave 控制與顯示。 | 近似：Series 時 CH2 Voltage 無效、CH2 列顯示 slave 電壓（正值，與 CH1 同）與 slave 電流；Parallel 時 CH2 列顯示 CC 與 CH1 相同電壓、電流約為總電流一半；回 Independent 後 CH2 用自己保存的 V2set/I2set。 | p.40 "Use the CH1 voltage knob to set the master & slave output voltage"、p.42 "CH2 control function is disabled"、p.42 CH2 顯示 CC；其餘為推論。；另 p.11、p.37、p.41 說 CH1 (Master) 控制合併輸出，但沒寫 CH2 Voltage 旋鈕的效果。 | 校機：Series 時轉 CH2 Voltage 觀察輸出；拍 Series／Parallel 下 LCD。 |
| GAP-GPE-09 | CH3/CH4 的 CC 條件：p.34/p.36 "When the output current level exceeds the setting value"，但 CH3/CH4 無電流旋鈕（p.18），「setting value」未定義；Set View 時 CH3/CH4 電流欄顯示什麼也未寫。 | CH3/CH4 過載教學；02 已排除核心。 | 定案：CH3／CH4 只提供 ≤ 額定的輕載或空載測試，顯示 CV；Set View 時 CH3／CH4 電流欄顯示「---」（不顯示數值，因為沒有電流設定可看）。 | 02：1 A 額定不能當精準保護門檻。 | 校機：CH3/CH4 接已知負載逐步加大電流記錄 CC 門檻；Set View 拍 LCD。 |
| GAP-GPE-10 | LCD 數字格式（前導零、小數點、負號）、開機全段顯示時長、開機時預設顯示 ①/② 還是上次通道皆未寫；手冊 LCD 圖為系列通用圖。 | LCD 外觀擬真。 | 定案：右對齊、無前導零（例 5.00 V、0.050 A）；模擬開機時全段顯示 1.0 s 後進入重設狀態，預設顯示 ①②；標示近似。 | 照片 LCD 全暗無法佐證。 | 校機亮屏照片與開機錄影。 |
| GAP-GPE-11 | Series 合併限流：無共地接法手冊要求 CH2 Current 調到最大（p.38），暗示 slave 限流也會生效，但合併電流如何由 I1set、I2set 決定未寫；Parallel 合併限流是否＝2×I1set 未寫。 | tracking 下 CV/CC 示意讀值。 | 近似：Series 限流＝min(I1set, I2set)，由較早達限的一側決定 CC；Parallel 限流＝2×I1set，CH1 讀值＝總電流/2。僅示意，J 階段再精化。 | p.38、p.40、p.42 的操作步驟與 p.45 0–3 A／0–6 A 額定。 | 校機：Series 接已知負載，分別降低 I1set、I2set 觀察 CC 圖示出現在哪列。 |
| GAP-GPE-12 | OVP/OCP/OTP 在 LCD 圖與 p.17、p.25 被提及，但無設定或觸發規格。 | 避免假功能。 | 全部 OUT，圖示恆暗。 | 手冊無正文。 | 向原廠或新版手冊確認 GPE-4323 是否有 OVP 設定；校機觀察是否有相關操作。 |
| GAP-GPE-13 | 只有一版 GPE 手冊（82GP343230E01），無第二版可交叉核對；校機韌體版本未知。 | 無法排除手冊與校機韌體差異。 | 以此版為準；差異記錄。 | 04 僅提供此版。 | 校機背板序號標籤、開機畫面；日後取得新版手冊時比對 p.19/p.27 Lock 描述。 |
| GAP-GPE-14 | 照片部分字樣被遮：CH4 下「0 - 15…」、CH3「5V , 1…」、左下旋鈕標籤「C…age」、「+ CH4」「+ CH1」「GND」字淡、藍帶文字、POWER 符號左半。 | 面板印字完整度。 | 被遮部分依 M-GPE p.15 圖補齊（「0 - 15V , 1A」「0 - 5V, 1A」「CH4 Voltage」「+ COM SERIES OUTPUT −」「+ − PARALLEL OUTPUT」），標記 PH（部分）+OT。 | 手冊面板圖與照片可見部分完全吻合。 | 日後補拍正面近照。 |
| GAP-GPE-15 | 切換到 Series／Parallel 時，若 LCD 正顯示 ③／④，是否自動切回 ①／②（p.18 Parallel/Series Keys 只說 activates tracking；p.19 Set View 的「The corresponding channel will be displayed」不是在講模式鍵） | I04-5 的可見回饋 | 定案：切到 Series 或 Parallel 時 LCD 自動回到 ①②（tracking 讀值都在 CH1／CH2 列）；切回 Independent 時維持 ①② | tracking 只涉及 CH1／CH2，顯示 ③④ 會讓學生看不到 tracking 結果；手冊未寫，屬 PD | 校機：先切到 ④／③，再按模式鍵進 Series，拍 LCD |

### 來源差異

| 主題 | 來源 A | 來源 B | 採用 |
| --- | --- | --- | --- |
| Set View 鍵的印字 | 照片 P1：鍵上方「Set View」、下方「LOCK」；M-GPE p.19 圖示「Set View／Lock」；p.27–29 正文 "Set View" key、"LOCK key"；p.31/33 小面板圖亦為 Set View。 | M-GPE p.15 前面板總圖印「V/I Check」，callout 為 "View setting value/ Key lock"。 | 依照片採「Set View」＋「LOCK」；p.15 為舊圖或誤植。 |
| 顯示切換鍵名稱 | 照片 P1「CH1/CH4」「CH2/CH3」；p.15 callout "CH1/CH4 Toggle Key"、"CH2/CH3 Toggle Key"；p.26 "CH1/4 key"、"CH2/3 key"；p.34、p.35 "CH2/CH3 key"、"CH1/CH4 key"。 | p.18 標題 "CH1/3 and CH2/4"，正文 "Press the CH1/3 or CH2/4 key"（同頁圖示卻印 CH1/ CH4、CH2/CH3）。 | 依照片與多數段落：CH1/CH4、CH2/CH3；p.18 視為誤植。 |
| Lock 鎖定範圍（段落間） | p.12「Inadvertent voltage setting protection」「Function for locking the setting voltage (CH1/CH2)」；p.27「lock the voltage knob operation for CH1 & CH2」「The voltage lock function only applies to CH1 & CH2.」 | p.15／p.19 小標「Key lock」；p.19「Press and hold the key to lock and unlock the panel keys (except OUTPUT).」；p.43「I pressed the panel lock key…」「the output key is not affected by the panel key lock feature」。 | 未解決。暫定依 p.27（只鎖 CH1/CH2 Voltage），On/Off 不鎖（兩方一致），標 APPROX；GAP-GPE-01 校機確認。 |
| 模式鍵是一顆還是兩顆 | 照片 P1：兩顆無字鍵＋Series/Parallel/Independent 圖例；p.18 "Parallel/Series Keys"；p.25 "different combinations of the mode selection key"、p.26 左右鍵組合。 | p.11「can be selected through pressing the TRACKING key」；p.31「Make sure the Series/Parallel key is not activated」；p.37、p.39、p.41「Press the Series/Parallel key」（單數）。 | 依照片與 p.25–26：兩顆鍵組合；單數說法視為簡稱。 |
| Independent 的鍵組合描述 | p.25 文字 "For the independent mode, the right key is not pressed"（只限定右鍵）。 | p.25 圖示與照片圖例：Independent 左右兩鍵皆為彈起圖示。 | 兩者在「兩鍵皆彈起」一致；「左按下＋右彈起」暫定 Independent（GAP-GPE-07）。 |
| Output 鍵名稱 | 照片 P1 鍵上印「On / Off」；p.19、p.25 "Output Key"；p.27 註 "The OUTPUT key"。 | p.28、p.29 "Press the “ON/OFF” key"；LCD 圖示也是 ON / OFF。 | 同一顆鍵；面板標籤用「On / Off」，功能名稱為 Output。 |
| CH3/CH4 的 CC 條件 | p.34（GPE-4323 CH3）、p.36（CH4）："When the output current level exceeds the setting value, the CV icon changes to the CC icon"。 | p.18：CH3/CH4 旋鈕 "Sets the voltage for the GPE-4323."（無電流設定）；額定 "1A Max"（p.33、p.35）。 | 未解決；「setting value」無對應控制。不作核心，不把 1 A 當精準門檻（GAP-GPE-09）。 |
| CC 是否只在 Independent | p.11 "When in the CC mode (independent mode only), the maximum (ceiling) output voltage can be controlled via the front panel." | p.38、p.40 Series 要求看 CH1/CH2 "indicators for the output level and CV/CC status"；p.42 Parallel 時 "The operating mode of CH2 will appear as the CC icon"。 | tracking 模式下 CV/CC 圖示仍會出現；p.11 的限定理解為「CC 時可調電壓上限」僅就 Independent 描述。模擬器在 tracking 模式仍依限流顯示 CV/CC（PD）。 |
| LCD 圖示與 GPE-4323 功能 | p.15 GPE-4323 LCD 圖含 Set/CV/CC/OVP/OCP、SER/PARA/OTP/Lock、ON/OFF 與「③ 5v 3.3v 2.5v 1.8v OverLoad」列、行首「Set」「Out」。 | p.18 說明 CH3 固定電壓列屬 GPE-3323；列首「Set」「Out」疑為 GPE-1326 標示（推論，p.15 未明說）；OVP/OCP/OTP 無 GPE-4323 設定正文。 | 只實作 GPE-4323 有正文的圖示；其餘保留暗段並標 OUT。 |
| 端子額定印字（照片遮擋） | 照片 P1：CH4 下「0 - 15…」；CH3 右下「5V , 1…」（未見「0 -」）。 | M-GPE p.15 圖：「0 - 15V , 1A」「0 - 5V, 1A」。 | 照片可見部分與手冊一致，被遮字依手冊補，證據 PH（部分）+OT。 |
| 手冊內部交叉引用頁碼 | 正文：遠端控制在 p.30、Front Panel Overview 在 p.15、Parallel Tracking 在 p.41。 | p.21 "see page 29"（遠端端子）；索引 p.48 "Front panel Overview ... 16"、"tracking mode parallel ... 27, 29, 30"。 | 以正文頁為準；引用一律用實際閱讀的正文頁。 |
| 規劃文件 vs 手冊（Set View／標籤位置） | 02／提示中照片觀察：旋鈕標籤「看起來印在旋鈕上方」；左欄 Voltage→Current→CH4 Voltage，右欄 Voltage→Current→CH3 Voltage。 | M-GPE p.15 callout：CH1 Voltage Knob（左上）、CH1 Current Knob（左中）、CH4 Voltage Knob（左下）、CH2 Voltage/CH2 Current/CH3 Voltage（右上/中/下）。 | 一致，無衝突；確認標籤在各旋鈕上方。 |
| 手冊版本間比對 | 本包只有 M-GPE 82GP343230E01 一版。 | 無第二版可比對（與 TDS 有 2011/2013 兩版不同）。 | 不適用；列 GAP-GPE-13。 |
| Series 合併電流由誰設定 | p.37「CH1 (Master) controls the combined output voltage/current level which is set independently.」 | p.38 步驟 3「Use the current knob to set the CH2 output current to the maximum level.」；p.40 步驟 5「Use the CH2 current knob to set the slave output current.」 | 未解決；暫定依 GAP-GPE-11（Series 限流＝min(I1set, I2set)），只做示意讀值，J 階段與校機再確認。 |

## 4. Keysight 34460A 6½ 位數電表（I05）

### 核心功能與驗收規則

| ID | 功能 | 可驗收規則 | 來源 | 證據 | 驗收（03 案例） |
| --- | --- | --- | --- | --- | --- |
| DMM-F01 | 面板布局與端子（無 10 A、無 Front/Rear） | 只提供 5 個端子：上排 Sense Ω4W HI（紅）、Input V Ω ⊣▶⊢ HI（紅）；中排 Sense LO（黑）、Input LO（黑）；下排 I 3A（紅）。功能鍵 12（4 列×3）、方向鍵 4＋Select、+／Range／− 3 鍵、軟鍵 6、USB-A、電源鍵與小指示點。深色圓形件與橢圓件為不可互動外觀。不得出現 10 A 端子、Front/Rear 切換、後面板輸入、數字鍵盤或旋鈕。 | P1 中層；D-DMM p.3 (PDF 3) "Rear input terminals No"；p.21 (PDF 21) "Input protection 10 A (34461/65/70A only)" | PH+DS | I05-1、I00-1：對照 P1 逐項計數；搜尋 UI 不得有 10A／Front／Rear 控制。 |
| DMM-F02 | DCV | 按 DCV 進入直流電壓；量程 100 mV／1 V／10 V／100 V／1000 V，除 1000 V 外可讀到 1.2×量程；單位 mVDC（100 mV 量程）、VDC。D1 DC 1.234 V：依暫定選檔規則（GAP-DMM-05）預期 Auto 落在 10 V 量程（1 V 量程上限 1.2 V）顯示 ≈ +1.234 V；手動 10 V 或 100 V 物理值相同只差解析度；手動 1 V／100 mV 顯示超量程狀態（不顯示 0、不截斷成 1.2）。 | D-DMM p.11 (PDF 11)、p.12 (PDF 12) 註 2、p.21 (PDF 21)、p.4 (PDF 4) 畫面範例；DC Auto 量程存在：p.24 (PDF 24) | DS+PD | I05-2、I05-3：真 UI 選 D1 DC 1.234 V → DCV → 讀值與單位；Range 切手動逐檔比對。 |
| DMM-F03 | ACV（純正弦） | 按 ACV；AC 耦合真有效值，只計交流成分（fixture 含 DC 成分時不得加進 ACV）；量程 100 mV／1 V／10 V／100 V／750 V（750 V 無超量程）。D1 1 kHz 純正弦 2 Vrms：依暫定選檔規則（GAP-DMM-05）預期 Auto 落在 10 V 量程顯示 ≈ 2 V；手動 1 V 量程為超量程。3 Hz–300 kHz 以外或非正弦不宣稱準確度。 | D-DMM p.21 (PDF 21) "AC–coupled True RMS. Measures the AC component of the input."；p.11 (PDF 11)；p.12 (PDF 12) 註 2、5 | DS+PD（頻寬外／非正弦處理） | I05-2、I05-3：D1 2 Vrms 1 kHz；另測 DC fixture 於 ACV 不得顯示 1.234 V。 |
| DMM-F04 | DCI（3 A 端子） | Shift 後按 DCV 進入 DCI（路徑 PD）；量程 100 µA／1 mA／10 mA／100 mA／1 A／3 A，3 A 無超量程，>3 A 顯示超量程；單位 µA／mA／A；量測端語義為 I 3A＋LO。沒有 10 A 量程。電壓或電阻 fixture 在 DCI 不得顯示成電流值。 | P1（DCV 上方 "DCI"；"I""3A" 端子）；D-DMM p.3 (PDF 3)、p.11 (PDF 11)、p.12 (PDF 12) 註 2、p.21 (PDF 21) | PH+DS+PD | I05-1、I05-2、I05-3：D1 已知 DC 電流（fixture 值由 I01 定）→ Auto／手動比對；過小量程超量程。 |
| DMM-F05 | ACI（純正弦） | Shift 後按 ACV 進入 ACI（路徑 PD）；量程 100 µA…3 A；只計交流成分；規格頻率 3 Hz–5 kHz（5–10 kHz typ）；第一版只用純正弦已知電流 fixture；3 A 無超量程。 | P1（ACV 上方 "ACI"）；D-DMM p.11–12 (PDF 11–12)、p.21 (PDF 21) | PH+DS+PD | I05-2、I05-3。 |
| DMM-F06 | 二線電阻 | 按 Ω2W；量程 100 Ω／1 kΩ／10 kΩ／100 kΩ／1 MΩ／10 MΩ／100 MΩ（皆可 20% 超量程）；單位 Ω／kΩ／MΩ；量測端 Input HI／LO。D1 1 kΩ：依暫定選檔規則（GAP-DMM-05）預期 Auto 落在 1 kΩ 量程顯示 ≈ 1.000 kΩ；手動 100 Ω 為超量程；D1 開路顯示超量程／開路狀態而非 0。 | D-DMM p.11 (PDF 11) Resistance；p.12 (PDF 12) 註 2；p.21 (PDF 21) | DS+PD（開路字樣） | I05-2、I05-3、I05-5。 |
| DMM-F07 | 導通 | 按 Cont ·))；固定 1 kΩ 量程（+／Range／− 不改量程，顯示範圍說明，PD）；電阻低於門檻 10 Ω 時提示音＋可見指示（音效可關但可見指示必須有）；D1 導通 fixture → 提示；D1 開路 → 無提示並顯示開路／超量程狀態。門檻恰為 10 Ω 的比較方式未確認，fixture 避開 10 Ω。門檻值 10 Ω 標 DS，不是教學近似；顯示字樣與邊界屬 PD。 | D-DMM p.12 (PDF 12) "Continuity 1 kΩ"；p.21 (PDF 21) "Continuity threshold Fixed at 10 Ω"、"300 samples/s with audible tone" | DS+PD | I05-2、I05-5：導通／開路兩種 fixture 真 UI 比對。 |
| DMM-F08 | 自動／手動量程與正確單位 | 每個核心功能（導通除外）有 Auto 與手動。Auto：超量程自動升檔、讀值落回最合適量程（降檔門檻 PD）；手動：不自動換檔，超量程時顯示超量程狀態。Range 鍵切 Auto⇄手動（PD，進手動時鎖定目前量程）；+／− 在手動逐檔升降，到端點停住（PD）。同一固定輸入在 Auto 與任何不超量程的手動量程下物理值一致。LCD 顯示 "Auto <量程>"（DS 範例 "Auto 1V"）或手動量程字樣（PD）；單位前綴隨量程換算（mV/V、µA/mA/A、Ω/kΩ/MΩ），不是只換文字。 | D-DMM p.21 (PDF 21) Overload ranging；p.24 (PDF 24) Autorange time；p.3–4 (PDF 3–4) 畫面範例；DC Auto 量程存在：p.24 (PDF 24) | DS+PD | I05-3：固定值切 Auto／Manual；+／− 連續可恢復；過小量程 out-of-range。 |
| DMM-F09 | Null 基本相對讀值 | 按 Null 開啟：以當下有效讀值為基準（PD），顯示＝量測值－基準、同單位；Null 開啟時改 fixture 顯示差值，不自動重取基準；再按 Null 關閉並回到原量測值。基準按功能分別保存（DS "Per function null"），切功能不得套用其他功能的基準或不相容單位；讀值超量程／無輸入時不得做減法。Null 基準編輯（Math 選單）OUT。 | P1 Null 鍵；D-DMM p.26 (PDF 26) "Per function null"；p.12 (PDF 12) 註 7、15 | PH+DS+PD | I05-4：設基準→改 fixture→看差值→關 Null 恢復；切到另一功能再切回，驗矩陣所定的保存策略。 |
| DMM-F10 | 超量程／未提供輸入／正常零值可區分 | (a) fixture 明確為 0（0 V 或短路）→ 顯示數值 0 與單位；(b) 超量程（手動量程過小，或超出 1000 VDC／750 VAC／3 A）→ 顯示超量程狀態；(c) 未選 fixture 或 fixture 與目前功能不相容 → LCD 不顯示數值讀值，儀器外顯示「未提供相容測試輸入」。(b)(c) 的 LCD 字樣原廠未找到，採模擬器暫定字樣並在儀器外標示近似，不偽造原廠錯誤碼。 | D-DMM p.21 (PDF 21) "Overload is reported in manual ranging."；02 34460A 關鍵規則；DC Auto 量程存在：p.24 (PDF 24) | DS+PD | I05-5、I05-2。 |
| DMM-F11 | 功能切換語義 | 切換 DCV／ACV／DCI／ACI／Ω2W／Cont 時換成該功能自己的量程表、單位與 Null 基準；不得沿用上一功能的讀值；D1 各 fixture 只在相容功能產生讀值（電壓→DCV/ACV、電阻／導通→Ω2W/Cont、電流→DCI/ACI）。 | P1；D-DMM p.3 (PDF 3)；02 D1 | PH+DS+PD | I05-2。 |
| DMM-F12 | Shift 次功能（暫定操作） | 暫定 latch：按 Shift 進入 Shift 狀態（LCD 暫定指示），下一個有藍字次標籤的鍵執行次功能後自動解除；再按 Shift 取消。核心只用 DCI／ACI；其餘次功能（Ω4W、二極體、Reset、Probe Hold、Math、Utility、Help）只顯示「本輪未納入」並解除 Shift，不改量測狀態。儀器外標示此流程為近似。 | P1 藍字次標籤與藍色 Shift 鍵；M-DMM 未取得 | PH+PD | I05-6、I05-7。 |
| DMM-F13 | 未納入功能不假成功、不加高階機型功能 | Freq、Temp、Ω4W、二極體、Probe Hold、Math、Display 其他 view、Utility、Help、Acquire、Run/Stop、Single、Reset、Local、方向鍵／Select、S2–S6：可見可按，但只顯示範圍說明。Probe Hold 不得做成任意 Freeze。不得出現 trend chart、digitizing、ACAL、1 µA 量程、10 A、1 GΩ、熱電偶、Front/Rear、2 M 記憶。 data logging 是否屬 34460A 為 UN，本輪以範圍決策不提供（GAP-DMM-23）。 | P1；D-DMM p.3 (PDF 3)、p.15 (PDF 15)／p.18 (PDF 18) ACAL、p.17 (PDF 17)／p.20 (PDF 20) Digitizing、p.26 (PDF 26)、p.27 (PDF 27) | PH+DS | I05-7、I00-3。 |
| DMM-F14 | LCD 讀值格式 | 讀值帶正負號、6½ 位並以空格三位分組（DS 範例 "+0.634 450"、"+000.030 6"）；單位字尾含前綴（DS 範例 VDC、mVDC）；左下量程字樣（"Auto 1V"）；左上功能名（"DC Voltage"）。AC、電流、電阻畫面字樣未找到，比照 DCV 格式並列 PD。 格式範例出自 datasheet 行銷合成畫面，只當 PD 參考。 | D-DMM p.3 (PDF 3) 產品照；p.4 (PDF 4)；p.23 (PDF 23) 位數 | PD | I05-2、I05-3：截圖比對格式與單位換算。 |
| DMM-F15 | 電源與重設（恢復到已定義狀態） | 電源鍵模擬開／關：關機 LCD 暗、其他鍵無作用；開機進入明示暫定預設（DCV、Auto、Null off；PD）。原廠關機狀態保存／開機回復未確認，不宣稱。模擬器重設放在儀器外（I01），不把 Shift→Run/Stop（Reset）當已確認的原廠重設。 | P1 電源鍵；D-DMM p.26 (PDF 26) 註 3 | PH+DS+PD | I05-6；I06-3（DMM range／Null 的錯誤與恢復）。 |

### 規格、範圍與預設值

| 項目 | 值 | 來源 | 證據 | 原文 |
| --- | --- | --- | --- | --- |
| 機型與位數 | 34460A，6½ 位數；Basic DCV accuracy 75 ppm | D-DMM p.3 (PDF 3) Key Specifications 34460A 欄；P1 型號標 | PH+DS | Digits of resolution 6½ ... Basic DCV accuracy 75 ppm |
| DCV 量程 | 100 mV、1 V、10 V、100 V、1000 V | D-DMM p.11 (PDF 11) DC Voltage；p.3 (PDF 3) | DS | DCV 100 mV to 1,000 V |
| ACV 量程與頻率 | 100 mV、1 V、10 V、100 V、750 V（真有效值）；3 Hz–300 kHz | D-DMM p.11 (PDF 11) True RMS AC Voltage；p.3 (PDF 3) | DS | 100 mV, 1 V, 10 V, 100 V, and 750 V Ranges ... 3 Hz to 5 Hz ... 100 kHz to 300 kHz |
| ACV 量測型態 | AC 耦合真有效值，只量交流成分；數位取樣＋抗混疊濾波 | D-DMM p.21 (PDF 21) True RMS AC Voltage | DS | AC–coupled True RMS. Measures the AC component of the input. |
| ACV 輸入限制 | 最大輸入 400 DCV、1,100 Vpeak；輸入阻抗 1 MΩ ± 1% ∥ < 100 pF；保護 750 Vrms；750 V 量程限 8×10^7 V·Hz | D-DMM p.21 (PDF 21)；p.12 (PDF 12) 註 5 | DS | Maximum input 400 DCV, 1,100 Vpeak ... Input protection 750 Vrms all ranges |
| DCI 量程與負擔電壓 | 100 µA(<0.011 V)、1 mA(<0.11 V)、10 mA(<0.05 V)、100 mA(<0.5 V)、1 A(<0.7 V)、3 A(<2.0 V) | D-DMM p.3 (PDF 3) 機型表（100 μA to 3 A）、p.11 (PDF 11) DC Current | DS | DCI 100 μA to 3 A |
| ACI 量程與頻率 | 100 µA、1 mA、10 mA、100 mA、1 A、3 A；3 Hz–5 kHz（5–10 kHz 為 typ）；只量交流成分 | D-DMM p.11–12 (PDF 11–12) True RMS AC Current；p.21 (PDF 21) | DS | Directly coupled to the fuse and shunt. AC True RMS measurement (Measures the AC component only). |
| 電流上限（無 10 A） | 34460A 最大 3 A；10 A 輸入只限 34461A/65A/70A | D-DMM p.3 (PDF 3) DCI/ACI 34460A 欄；p.21 (PDF 21) | PH+DS | Input protection 10 A (34461/65/70A only) |
| 電流輸入保護 | 外部可取用 3.15 A 500 V 保險絲＋內部 11 A 1,000 V 保險絲；保險絲座位置：後面板左下（D-DMM p.24 34460A 後面板照「Current Input 3.15A (500V)」） | D-DMM p.21 (PDF 21)、p.24 (PDF 24) 後面板照 | DS | Externally accessible 3.15 A, 500 V fuse |
| 電阻量程與測試電流 | 100 Ω(1 mA)、1 kΩ(1 mA)、10 kΩ(100 µA)、100 kΩ(10 µA)、1 MΩ(5 µA)、10 MΩ(500 nA)、100 MΩ(500 nA ∥ 10 MΩ)；2 線與 4 線可選 | D-DMM p.11 (PDF 11) Resistance；p.3 (PDF 3)；p.21 (PDF 21) | DS | 2- and 4-wire resistance 100 Ω to 100 MΩ |
| 2 線電阻與 Null | 規格以 4 線或 2 線加 math null 為準；不做 null 時 2 線另加 0.2 Ω 誤差 | D-DMM p.12 (PDF 12) 註 7 | DS | Without math null, add 0.2 Ω additional error in 2-wire ohms function. |
| 超量程比例 | 所有量程可超量程 20%（顯示到 1.2×量程）；例外：1000 V DCV、750 V ACV、3 A 電流、二極體測試（例外之比例未明寫，34465A/70A 同註寫 0%） | D-DMM p.12 (PDF 12) 註 2；對照 p.17 (PDF 17)、p.20 (PDF 20) | DS+PD（例外視為 0%） | 20% overrange on all ranges, except 1,000 V DCV, 750 ACV, 3 A Current, and diode test. |
| 自動／手動量程與超量程回報 | Auto 下偵測到峰值過載會升檔；手動量程下回報 overload（顯示字樣未找到）（p.21 的「Overload ranging」原文位於 AC Crest Factor 段，只作 ACV／ACI 的 DS 依據；DC 功能有 Auto 量程引 p.24 換檔時間；DC 的手動超量程呈現屬 PD） | D-DMM p.21 (PDF 21) AC Crest Factor and Peak Input → Overload ranging | DS+PD | Will select higher range if peak input overload is detected during auto range. Overload is reported in manual ranging. |
| 自動換檔時間 | DCV/DCI/Ω < 40 ms；ACV/ACI < 35 ms；Freq < 55 ms（≤ 10 V、≤ 10 MΩ） | D-DMM p.24 (PDF 24) System Speeds 34460A 欄 | DS | Autorange time < 40 ms |
| 導通測試 | 量程固定 1 kΩ；門檻固定 10 Ω；300 samples/s 並有提示音 | D-DMM p.12 (PDF 12) Continuity；p.21 (PDF 21) Continuity / Diode Test | DS | Continuity threshold Fixed at 10 Ω ... 300 samples/s with audible tone |
| 二極體測試 | 5 V 滿刻度；測試電流 1 mA（typ）；無 20% 超量程 | D-DMM p.12 (PDF 12) Diode Test 與註 9；p.8 (PDF 8)；p.3 (PDF 3) "Continuity, diode Y, 5 V" | DS | The 1 mA test current is typical. |
| 頻率／週期（OUT） | 3 Hz–300 kHz；電壓量程 100 mVrms–750 Vrms，Auto 或手動；gate 10 ms、100 ms、1 s（1 ms 只限 34465/70A） | D-DMM p.3 (PDF 3)；p.22 (PDF 22) | DS | Gate time 1 ms (34465/70A), 10 ms, 100 ms, or 1 s |
| 溫度（OUT） | PT100/RTD（-200 °C–600 °C）、thermistor（-80 °C–150 °C）；34460A 無熱電偶 | D-DMM p.3 (PDF 3)；p.21 (PDF 21) | DS | Temperature RTD/PT100, thermistor |
| 電容（OUT） | 1 nF、10 nF、100 nF、1 µF、10 µF、100 µF | D-DMM p.11 (PDF 11) Capacitance；p.3 (PDF 3) | DS | Capacitance 1 nF to 100 µF |
| DCV 輸入電阻 | 0.1 V／1 V／10 V：可選 10 MΩ 或 >10 GΩ；100 V／1000 V：10 MΩ ± 1%；輸入保護 1,000 V | D-DMM p.21 (PDF 21) | DS | Selectable 10 MΩ or >10 GΩ |
| AC 規格前提（第一版只用純正弦） | ACV：正弦且 > 0.3% 量程、> 1 mVrms；ACI：正弦且 > 1% 量程、> 10 µA；crest factor 最大 10:1（滿刻度 3:1） | D-DMM p.12 (PDF 12) 註 1、5、8；p.21 (PDF 21) Crest factor | DS | Specifications are for sine wave input > 0.3% of range and > 1 mVrms. |
| 讀值位數與速率（DC/Ω） | 100 PLC：6½ 位、0.6 rdg/s；10 PLC：6½、6/s；1 PLC：5½、60/s；0.2 PLC：5½、100/s；0.02 PLC：3½、300/s；最大 300 rdgs/s | D-DMM p.23 (PDF 23) 34460A 欄；p.3 (PDF 3) | DS | Max reading rate 300 rdgs/s |
| 讀值位數與速率（AC） | ACV/ACI 皆 6½ 位；ACV 0.4/1.6/20/50 rdg/s、ACI 0.6/4/20/50 rdg/s（Slow/Medium/Fast/Fast） | D-DMM p.23 (PDF 23) | DS | 34460A, 34461A, 34465A, 34470A 6½ 0.4/s 0.6/s Slow |
| LCD 讀值格式範例 | "DC Voltage"、"Auto Trigger"、"+0.634 450 VDC"、"Auto 1V"；100 mV 量程例 "+000.030 6 mVDC"、"Auto 100mV" | D-DMM p.3 (PDF 3) 34460A 產品照；p.4 (PDF 4) 畫面圖 | PD | +0.634 450 VDC / Auto 1V |
| 顯示器 | 4.3 吋彩色 TFT WQVGA 480×272；Number、Bar meter、Histogram；Trend chart 只限 34461A/65A/70A；Dual line display | D-DMM p.26 (PDF 26) Display；p.3 (PDF 3) | DS | Supports: Basic number, bar meter, trend chart (34461A, 34465A, 34470A), histogram views. |
| Math／Null | Per function null、min/max/avg/Sdev、dB、dBm、span、count、limit test、histogram | D-DMM p.26 (PDF 26) Math Functions | DS | Per function null, min/max/avg/Sdev, dB, dBm, span, count, limit test, histogram |
| Probe Hold（OUT） | 擷取並瀏覽穩定讀值清單；穩定判定未找到 | D-DMM p.26 (PDF 26) | DS | Capture and navigate stable list of readings |
| 讀值記憶 | 揮發性 1,000 筆（34461A 10,000；34465A/70A 50,000 std、MEM 選配 2 M） | D-DMM p.26 (PDF 26)；p.3 (PDF 3)；p.27 (PDF 27) MEM 只限 34465/70A | DS | Volatile reading memory 10,000 (34461A), 1,000 (34460A) |
| 前面板 USB Host | FAT32；USB 2.0 mass storage；匯入／匯出設定、存讀值與螢幕截圖 | D-DMM p.25 (PDF 25) | PH+DS | Front-Panel USB Host Port (FAT32) |
| 介面與選配（34460A） | USB 2.0 標準；LAN/LXI 選配（3446LANU：LAN＋外部觸發）；GPIB 選配（3446GPBU）；SEC（3446SECU）；ACC（3446ACCU：34138A 測試線、USB 線）；Z54 校正證書；MEM 不適用 34460A | D-DMM p.3–4 (PDF 3–4)；p.25 (PDF 25)；p.27 (PDF 27) | DS | LAN 3446LANU 34460A Enable LAN interface and external triggering |
| 34460A 標配附件 | 只有電源線與校正證書（無測試線；測試線需 ACC 選配） | D-DMM p.27 (PDF 27) Accessories Included | DS | 34460A Power cord Calibration certificate |
| 後面板輸入／Front-Rear | 34460A 無後面板量測端子，故無 Front/Rear 切換 | D-DMM p.3 (PDF 3)；p.24 (PDF 24) 後面板照；P1 | PH+DS | Rear input terminals No |
| 外部觸發（OUT） | TTL 相容邊緣觸發，34460A 最高 300 Hz；Voltmeter complete 3.3 V 輸出；34460A 需 3446LANU 軟體授權才啟用（p.27「Enable LAN interface and external triggering」） | D-DMM p.25 (PDF 25) Triggering Conditions、p.27 (PDF 27) | DS | Up to 1 kHz (34461A), up to 300 Hz (34460A) |
| 安全額定 | Measurement Category II to 300 V（面板 CAT II (300V)） | D-DMM p.25 (PDF 25)；P1 | PH+DS | Measurement Category II to 300 V |
| 關機狀態保存 | 只有用前面板電源開關關機時才保存 power-off state；開機是否回復未找到 | D-DMM p.26 (PDF 26) 註 3 | DS+UN | Power-off state only when power-down is initiated via front-panel power switch. |
| 外型比例（面板繪製） | Bench 261.2 × 103.8 × 303.2 mm（W×H×D）；Rack 212.8 × 88.3 × 272.3 mm；螢幕對角 4.3 in／109 mm | D-DMM p.25 (PDF 25) Mechanical；p.3 (PDF 3) 圖示 | DS | Bench dimensions (W x H x D): 261.2 mm x 103.8 mm x 303.2 mm |
| 開機預設功能／量程／觸發 | 未找到（UN）；第一版暫定 DCV、Auto、Null off（PD） | 未找到（M-DMM 未取得） | UN+PD | 未找到 |
| 超量程顯示字樣 | 未找到（UN）；以模擬器近似字樣並在儀器外標示 | 未找到；D-DMM p.21 (PDF 21) 只說會回報 | UN+PD | Overload is reported in manual ranging. |

### 本輪未納入

| 項目 | 理由 | 面板處理 |
| --- | --- | --- |
| 四線電阻 Ω4W（Shift→Ω2W）與 Sense HI/LO 實際使用 | 02 允許首版不做；需四端接線（J01） | Sense 端子可見；Shift→Ω2W 顯示「四線量測本輪未納入」，不假裝兩線完成四線。 |
| 二極體測試（Shift→Cont） | 不在 02 第一版必做清單（DS 有 5 V、1 mA typ 規格） | 顯示範圍說明，不改功能。 |
| 頻率／週期（Freq） | 不在第一版必做；DS 3 Hz–300 kHz | 按下顯示範圍說明。 |
| 溫度（Temp） | 不在第一版必做；需 PT100／thermistor 探棒 | 按下顯示範圍說明；不得列熱電偶。 |
| 電容量測 | 34460A 具備（DS p.3、p.11），但 P1 找不到前面板入口（Freq 上方無符號），M-DMM 未取得 | 不配置到任何鍵；在功能範圍說明列「具備但入口待校機確認」。 |
| DCV Ratio、Aperture/NPLC、Auto Zero、Input Z、AC filter | 非核心；只見於 DS 產品照標籤或註腳 | DCV 畫面照 DS 產品照顯示 S2–S5 標籤，按下顯示範圍說明；模擬器固定理想輸入與 6½ 位。 |
| Math（min/max/avg/Sdev、dB、dBm、span、count、limit test、histogram） | 非核心（DS p.26 列出） | Shift→Null 顯示範圍說明。 |
| Display 的 Bar meter／Histogram view、Dual line 次顯示 | 非核心 | Display 鍵顯示範圍說明；固定 Number view。 |
| Probe Hold（Shift→Single） | 02 明定不列核心，且穩定判定未找到 | 顯示範圍說明；不可做成任意 Freeze。 |
| Run/Stop、Single、Acquire（觸發／取樣設定）、Reset | 操作定義未找到 | 顯示範圍說明；讀值維持連續更新；Reset 不作原廠重設。 |
| Utility、Help（長按說明）、Local | 非核心；Help 依 DS 為長按按鍵提供；Local 與遠端控制相關 | 顯示範圍說明；長按不觸發未證實功能。 |
| 方向鍵 ▲▼◀▶ 與 Select | 選單內容未找到，核心不需要 | 按下顯示範圍說明。 |
| 前面板 USB 隨身碟存取、內部 Flash 狀態存取、讀值記憶 1,000 筆、螢幕截圖 | 非核心 | USB 口只畫外觀。 |
| 遠端介面（USB device、LAN 選配、GPIB 選配）、外部觸發、Voltmeter complete、Web UI、SCPI | 後面板或選配；非單機練習範圍 | 不繪後面板；不提供。 |
| 保險絲熔斷、輸入保護、負擔電壓、輸入阻抗負載效應、雜訊與精度模型 | 02：首版為理想教學模型 | 讀值理想化；在範圍說明註明不模擬精度與保護。 |
| 高階機型功能：digitizing、ACAL、1 µA 量程、10 A 端子、1 GΩ、熱電偶、trend chart、2 M 讀值記憶 | D-DMM 機型欄（p.3 表與各機型規格頁）顯示 34460A 沒有這些。 | 完全不出現（不是停用，而是不存在）。 |
| 開機記憶、使用者自訂開機訊息、螢幕色彩、時鐘 | DS p.26 有提及但操作未找到 | 不提供；開機用明示暫定預設。 |
| Data logging 模式 | 範圍決策（PD）：34460A 是否具備 UN——只有 p.3 概述「Both models also provide a data logging mode…」提到，沒寫是哪兩個機型；IX 線索（知識庫摘要）說 34460A／61A 只有連續量測模式。02 核心不需要。 | 不提供；範圍說明寫「34460A 是否有 data logging 待手冊確認」。 |

### 資料缺口與暫定行為

| ID | 缺口 | 影響 | 暫定行為 | 理由 | 日後驗證 |
| --- | --- | --- | --- | --- | --- |
| GAP-DMM-01 | 34460A Operating and Service Guide（M-DMM）正文未取得。料號 34460-90901／資產 9018-03876 來自本次 WebSearch（IX，見 docs/sources.md §3.1），不是正文。所有軟鍵頁、Shift 流程、選單層級均未核對。 | I05 的所有選單路徑只能以 P1 標籤＋DS 產品照＋PD 實作，不能宣稱完整還原。 | 只做 02 核心；其餘鍵顯示範圍說明；所有暫定行為在儀器外標「近似／待校機確認」。 | 官方網域在本環境被封鎖；04 已記錄存取表單問題；搜尋索引只算 IX。 | 取得 M-DMM 後補讀 Front Panel、Front Panel Menu Reference、DC/AC Voltage、DC/AC Current、Resistance、Continuity、Math/Null、Probe Hold 章節，記錄版本與適用型號，只回修 I05。 |
| GAP-DMM-02 | Shift 的操作模式未找到：latch（先按後按）或同時按住、Shift 指示字樣、何時自動解除、對無次標籤鍵（Freq、Temp、+、Range、−、方向鍵）的效果。 | DCI／ACI 的進入方式（核心）只能暫定。 | latch：按 Shift→LCD 暫定指示→下一次按帶藍字次標籤的鍵執行次功能並解除；再按 Shift 取消；對無次標籤鍵直接執行主功能並解除 Shift。 | P1 次標籤為藍色、Shift 鍵為藍色，符合常見面板慣例；無正文。；IX 搜尋摘要稱 Shift 為先按放開再按目標鍵，與暫定一致，但不是正文。 | 校機實測：按 Shift 後觀察 LCD 指示，再按 DCV 看是否進 DCI；補 M-DMM Front Panel 章節。 |
| GAP-DMM-03 | Range／+／− 的精確行為未找到：Range 是切 Auto⇄手動還是其他；+／− 是否在 Auto 時直接轉手動；進手動時停在哪一檔；到端點是否循環。 | 核心的自動／手動量程操作路徑為暫定。 | Range：Auto⇄手動（進手動鎖定當前檔）；+／−：手動升／降一檔，Auto 時按下先轉手動再移一檔；端點停住不循環。 | D-DMM p.21 只證明 auto/manual 與 overload 行為；鍵語義依位置與符號推論。 | 校機：DCV 輸入固定值，按 Range、+、− 各數次並記錄 LCD 量程字樣；補 M-DMM Range 相關段落。 |
| GAP-DMM-04 | 各功能畫面的軟鍵標籤未找到（只有 DS 產品照中的 DCV 畫面：Range／Aperture／Auto Zero／Input Z／DCV Ratio）；S1 Range 按下後是否展開子選單也未找到。 | DCI／ACV／ACI／Ω2W／Cont 畫面的軟鍵列只能暫定。 | DCV 照 DS 產品照繪製 S1–S5；其他核心畫面只顯示 S1 "Range"（Cont 不顯示），S2–S6 空白；S1 按下＝Range 鍵。 | 不編造未見的標籤。 | 校機拍攝各功能亮屏正面；補 M-DMM Front Panel Menu Reference。 |
| GAP-DMM-05 | Auto range 的降檔門檻／遲滯未找到（DS 只寫過載時升檔）。 | Auto 讀值落在哪一檔可能與校機不同，但物理值不受影響。 | Auto 一律選能容納讀值的最小量程：\|x\| ≤ 1.2×量程（1000 VDC、750 VAC、3 A 為 ≤ 1.0×）；不設遲滯、確定性計算（PD）。預期：D1 1.234 VDC→10 V 檔；2 Vrms→10 V 檔；1 kΩ→1 kΩ 檔。 | D-DMM p.12 註 2 的 20% 超量程與 p.21 Overload ranging。 | 校機以可調電源緩慢升降電壓，記錄換檔點；補 M-DMM。 |
| GAP-DMM-06 | 超量程的 LCD 字樣未找到（DS p.21 只說 "Overload is reported"）。 | I05-5 的超量程呈現無法照原廠字樣。 | LCD 以模擬器暫定字樣（例如中性的「超量程」標記）＋儀器外註明「近似字樣」，不假冒原廠錯誤碼。 | 02：顯示字樣有手冊才按原廠。 | 校機：手動 1 V 量程接 1.5 V 拍 LCD；補 M-DMM。 |
| GAP-DMM-07 | Null 細節未找到：按下時是否即取當下讀值為基準、基準可否手動輸入、切功能後 Null 開關狀態是否保留、換量程時基準處理。DS 只寫 "Per function null"。 | I05-4 的保存策略為暫定。 | 按 Null＝取當下有效讀值為基準並開啟；每功能各存 {on/off, 基準}；切回該功能時恢復其 Null 狀態；換量程保留基準（以物理值保存）；讀值超量程或無輸入時不能開啟 Null（按下顯示說明）。 | DS p.26 "Per function null"；02 要求不默默共用不相容單位。 | 校機：DCV 開 Null→切 ACV→切回 DCV 觀察 Null 是否仍開；補 M-DMM Math/Null 章節。 |
| GAP-DMM-08 | 導通細節未找到：門檻 10 Ω 為 < 或 ≤；是否可關閉提示音；LCD 在導通時顯示電阻值或文字；開路時顯示字樣。 | 導通顯示為部分暫定（門檻值本身有 DS）。 | R ≤ 10 Ω 時可見指示（提示音可在儀器外開關）；LCD 顯示電阻值到 1.2 kΩ，超過顯示暫定「OPEN」字樣；< 或 ≤ 的邊界待證（IX 摘要為 ≤），fixture 避開 10 Ω 與 1.2 kΩ 邊界。 | D-DMM p.12、p.21：1 kΩ 量程、門檻固定 10 Ω、audible tone。；邊界與 OPEN 字樣只有 IX 搜尋摘要，屬 PD。 | 校機以 5 Ω、15 Ω 電阻與開路測試；補 M-DMM Continuity 章節。 |
| GAP-DMM-09 | AC、電流、電阻、導通畫面的功能名與單位字樣（如 VAC、ADC、AAC）未找到；DS 只有 DCV 範例（"DC Voltage"、VDC、mVDC）。 | LCD 文字可能與校機不同。 | 比照 DCV 格式：AC Voltage／VAC、DC Current／ADC、AC Current／AAC、2-Wire Ohms／Ω、Continuity（全部標 PD）。 | 避免空白，但明示暫定。 | 校機亮屏拍各功能畫面。 |
| GAP-DMM-10 | 電容功能的前面板入口未找到：P1 在 Freq 上方沒有任何次標籤；DS 產品照（p.1、p.3）在 Freq 上方有藍色電容符號。 | 電容雖為 34460A 功能，本輪無法確認入口。 | 本輪 OUT，不配置到任何鍵；範圍說明寫「34460A 具備電容量測，入口待確認」。 | 照片優先於行銷產品照；兩者矛盾不可默默合併。 | 校機近拍 Freq 周邊與按 Shift→Freq 的結果；補 M-DMM Capacitance 章節。 |
| GAP-DMM-11 | 3A 端子左側深色圓形件的功能未找到（D-DMM p.24 後面板照已排除「前面板保險絲座」；推論為 10 A 位置的封蓋） | 只影響外觀與 J01 的端子清單。 | STATIC、不可互動、不列為端子。 | D-DMM p.24 34460A 後面板照有「Current Input 3.15A (500V)」保險絲座；p.1 封面 34470A 同位置為 10A 端子。 | 校機近拍或觸摸確認；補 M-DMM 保險絲更換章節。 |
| GAP-DMM-12 | 3A 端子下方深色橢圓件的功能未找到。 | 只影響外觀。 | STATIC、不可互動；不得做成 Front/Rear。 | DS p.1 34470A 同位置是 Front/Rear 切換；34460A 無後面板輸入（p.3）。 | 校機近拍確認是否為封蓋。 |
| GAP-DMM-13 | 電源鍵下方小圓點的意義（待機燈／電源燈／顏色）未找到。 | 只影響外觀回饋。 | 只畫外觀，不賦予燈號語義。 | DS 未提。 | 校機拍待機與開機兩種狀態。 |
| GAP-DMM-14 | 開機預設功能／量程／觸發狀態與開機記憶未找到；DS p.26 只說 power-off state 在前面板關機時保存。 | I00-4 開機記憶待確認；模擬器開機畫面為暫定。 | 開機一律 DCV、Auto、Null off、連續更新（PD），儀器外註明非原廠開機記憶。 | 02 共用規則：未知開機記憶另列，不與 Preset 混淆。 | 校機：改設定後用前面板電源鍵關／開機，觀察是否回復；補 M-DMM Power-on／Utility 章節。 |
| GAP-DMM-15 | Reset（Shift→Run/Stop）、Run/Stop、Single、Acquire 的功能未找到。 | 無法用原廠鍵做重設。 | 模擬器重設放在儀器外（I01）；這些鍵顯示範圍說明。 | 不把未確認語義當原廠 Default／Preset。 | 補 M-DMM Triggering 與 Front Panel 章節。 |
| GAP-DMM-16 | 校機韌體版本、LCD 語言、已安裝選配（LAN、GPIB、SEC）與是否含 ACC 測試線未提供；DS p.27 註「DIG now included with latest firmware update」未寫適用機型。 | 不影響核心，但不能以韌體更新為由加入 digitizing。 | 不加入 digitizing／advanced triggering；UI 語言暫用英文面板字樣。 | DS 的 digitizing 規格只出現在 34465A／34470A 頁（p.17、p.20）。 | 校機 Utility／About 畫面拍照；拍後面板確認選配。 |
| GAP-DMM-17 | ACV／ACI 對非正弦、DC 偏移變動後的沉降、3 Hz 以下或頻寬外訊號的行為第一版不模擬。 | 只影響進階教學。 | fixture 限純正弦 1 kHz；非相容 fixture 顯示未提供相容輸入。 | 02：ACV／ACI 第一版用明確純正弦測試情境。 | 日後依 DS p.21–22（crest factor、DC blocking capacitor）另做規格。 |
| GAP-DMM-18 | 單機階段的端子選用：fixture 如何表示「接在 Input 還是 3A」未由原廠決定。 | 電流 fixture 在電壓功能、電壓 fixture 在電流功能時的顯示需要規則。 | fixture 自帶量測類型（電壓／電流／電阻），只在相容功能顯示；錯接情境延到 J01。 | 02 D1：不同類型值只能用相容模式測。 | J01 定義端子接線後以電路計算取代。 |
| GAP-DMM-19 | 面板印字「200 Vpk」的精確意義未在 DS 找到；「500 Vpk」有 D-DMM p.22「± 500 V peak maximum」（LO lead）佐證，但面板印字的完整意義仍待手冊。 | 只影響說明文字。 | 照印，不做保護門檻。 | DS p.21 只有 sense 對 LO < 12 V（DC Ratio 條件）。 | 補 M-DMM Safety／Input terminals 章節。 |
| GAP-DMM-20 | 預設積分時間／位數與讀值更新率未找到（DS 產品照 DCV 畫面為 "Aperture 10 PLC"）。 | LCD 位數與更新節奏為暫定。 | 固定 6½ 位顯示（對應 DS p.23 的 10 PLC）；更新節奏採確定性時間軸，不加隨機雜訊。 | DS p.23：10 PLC → 6½ 位、6 rdg/s（60 Hz）。 | 校機觀察預設 NPLC 與更新速度。 |
| GAP-DMM-21 | LCD 上方觸發狀態字樣（DS 產品照 "Auto Trigger"）是否為預設未確認。 | 僅影響狀態列文字。 | 可顯示 "Auto Trigger" 並標為依 DS 產品照（PD），不提供觸發設定。 | DS p.3 產品照可見。 | 校機亮屏確認。 |
| GAP-DMM-22 | IX 線索（主控的官方手冊搜尋與驗證者搜尋，詳見 docs/sources.md §3.1）：官方 9018-03876 PDF 與 Truevolt WebHelp 都被環境封鎖；搜尋摘要稱導通「≤10 Ω 嗶聲、10 Ω–1.2 kΩ 顯示電阻、>1.2 kΩ 顯示 OPEN」、Shift 為「先按放開再按目標鍵」。也有第三方副本（batronix、docs.rs-online、manualslib），依規則不下載；日後若使用，要先核對與官方 9018-03876 同版次才能當 OT。 | 無法升級任何 PD／UN。 | 維持 PD／UN。 | 主控已確認所有 Keysight 網域被封鎖。 | 改在可存取網路的環境下載並記錄 Edition。 |
| GAP-DMM-23 | Data logging 是否為 34460A 功能：D-DMM p.3 概述「Both models also provide a data logging mode」未指明機型；機型欄沒有此列 | 只影響未納入清單的措辭 | 本輪不提供；範圍說明標「待手冊確認」 | 02 核心不需要；證據不足時不能寫成「不具備」也不能寫成「具備」 | 取得 M-DMM 後查 Acquire／Data Logging 章節的適用機型 |

### 來源差異

| 主題 | 來源 A | 來源 B | 採用 |
| --- | --- | --- | --- |
| Freq 鍵上方次標籤（電容符號） | P1 中層（放大確認）：Freq 上方沒有任何字樣或符號；Cont 上方為藍色二極體符號。 | D-DMM p.3 (PDF 3) 與 p.1 (PDF 1) 34460A 產品照：Freq 上方有藍色電容符號 ⊣⊢，Cont 上方為二極體符號。 | 面板照 P1；電容入口列 GAP-DMM-10，本輪不配置 Shift→Freq＝電容。可能是面板改版或產品照版本不同（未證實）。 |
| 面板顏色 | P1：淺灰白色面板、淺色按鍵、藍灰色軟鍵、藍色 Shift。 | D-DMM 所有產品照（p.1、p.3、p.11）：黑色面板、深色按鍵。 | 外觀以 P1 為準；DS 照片只用於比例與畫面範例。 |
| Datasheet 概述文字 vs 機型欄（trend chart、data logging、digitizing、1 µA、ACAL） | D-DMM p.3 (PDF 3) 概述："graphical capabilities such as trend and histogram charts ... Both models also provide a data logging mode ... and a digitizing mode"、"1 μA range"、"Auto calibration"，未指明機型。 | 同頁機型表：34460A Statistical graphics 只有 "Histogram, bar meter"、DCI 由 100 μA 起；ACAL 只寫在 34465A／34470A 規格頁（p.15、p.18）；Digitizing 只在 p.17、p.20；p.26 trend chart 限 34461A/65A/70A。 | trend chart、digitizing、1 µA、ACAL：依 p.3 機型欄與各機型規格頁，34460A 沒有。data logging：機型欄沒提，34460A 是否具備 UN，本輪以範圍決策不提供（不是 DS 證實不存在）。 |
| DIG 韌體註記的適用機型 | D-DMM p.27 (PDF 27)："Note: High speed digitizing and advanced triggering (DIG) now included with latest firmware update."（未列機型） | D-DMM p.17 (PDF 17)、p.20 (PDF 20)：Digitizing 規格只在 34465A、34470A 頁；34460A 規格頁 p.11–12 無。 | 不加入 34460A；列 GAP-DMM-16。 |
| Truevolt 家族電流範圍敘述 | D-DMM p.8 (PDF 8)："Truevolt DMMs offer expanded current ranges from 100 µA to 10 A." | D-DMM p.3 (PDF 3) 34460A 欄：DCI／ACI "100 μA to 3 A"；p.21：10 A 只限 34461/65/70A；P1 只有 3A 端子。 | 34460A 上限 3 A，不提供 10 A。 |
| 超量程例外的比例 | D-DMM p.12 (PDF 12) 註 2（34460A）："20% overrange on all ranges, except 1,000 V DCV, 750 ACV, 3 A Current, and diode test."（未寫例外是幾 %） | D-DMM p.17 (PDF 17)／p.20 (PDF 20)（34465A／34470A）：同類例外明寫 "have 0%"。 | 34460A 例外量程暫定 0% 超量程（PD），並在 specs 註明。 |
| 頻率規格表的列名 | D-DMM p.12 (PDF 12) Frequency 表："3 Hz to 10 Hz"、"10 Hz to 100 Hz"、"100 Hz to 1 kHz"、下一列印 "1 Hz to 300 kHz"（Additional Gate Time Errors 表同）。 | D-DMM p.3 (PDF 3)：Frequency, period "3 Hz to 300 kHz"。 | 該列疑為 "1 kHz to 300 kHz" 的印刷錯誤；頻率功能本輪 OUT，採 p.3 的 3 Hz–300 kHz。 |
| 導通門檻是否有證據 | 02（規劃文件）：導通門檻需有正文，缺證據時列為近似教學參數。 | D-DMM p.21 (PDF 21)："Continuity threshold Fixed at 10 Ω"；p.12 導通量程 1 kΩ。 | 門檻採 DS 值 10 Ω（證據 DS），不是教學近似；邊界比較、蜂鳴設定與顯示字樣仍 PD（GAP-DMM-08）。 |
| 3A 左側深色圓形件 | 主控提示：旁有保險絲符號，可能與保險絲有關（照片推論）。 | D-DMM p.1 (PDF 1) 封面照：34470A 在同一位置是 "10A" 紅色端子；P1 的保險絲符號位於 LO→I 的連線上，並非緊貼圓形件。 | 保險絲座推論被 p.24 排除；暫以「10 A 位置封蓋」推論（PD）畫成不可互動外觀件，不當端子。 |
| 3 A 保險絲位置 | D-DMM p.21 (PDF 21)：3 A 輸入有 "Externally accessible 3.15 A, 500 V fuse"。 | D-DMM p.24 行銷照「34460A DMM rear panel with GPIB option installed」：後面板左下有圓形座，印「Current Input 3.15A (500V)」（主控放大原圖確認） | 3.15 A 電流保險絲座在後面板左下（DS 行銷照；校機後面板未拍，套用到校機時標 PD）。本輪不畫後面板，不模擬換保險絲或熔斷。 |
| Input 端子標題符號（機型差異） | P1 與 D-DMM p.1 (PDF 1) 34460A："Input V Ω ⊣▶⊢"（只有二極體符號）。 | D-DMM p.1 (PDF 1) 34470A："Input VΩ ⊣⊢ ⊣▶⊢"（多一個電容符號），且有 10A 端子、Front/Rear、▲ 上方 "ACAL"。 | 非矛盾而是型號差異；只照 34460A（P1）繪製，不借用 34470A 標示。 |
| 軟鍵 S6 標籤隨畫面不同 | D-DMM p.3 (PDF 3) 產品照（Number view）：S6 空白。 | D-DMM p.1 (PDF 1) 產品照（Histogram view）：S6 "Clear Readings"。 | 軟鍵為情境式；第一版固定 Number view，S6 保持空白。 |
