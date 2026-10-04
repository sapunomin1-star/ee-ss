# 四台儀器功能補強（2026-10-04）

使用者選定「四台儀器尚未支援的按鍵與功能」。本輪從 `e1ead65` 的完整離線版接續，保留原有 RC 板、自由麵包板、GPE 實驗台接線、電流量測、復原與實驗存檔，補上可由現有虛擬輸入實際執行的儀器功能。

## 已實作與操作入口

| 儀器 | 新增功能與入口 |
|---|---|
| AFG-2225 | Waveform 的 Pulse／Noise；Square 的 Duty；CH1/CH2 的 Phase。ARB 支援樣本、線段、複製、清除、保護區、內建函數、輸出 Rate／Start／Length；More 的 USB 入口下載或載入瀏覽器 JSON 波形檔。UTIL 的十組設定／ARB 記憶、Beep、雙通道 Tracking／Amplitude／Frequency Coupling、虛擬 Counter；DSO Link 匯入模擬示波器已採集的波形。MOD 的 AM／FM／FSK／PM／SUM、Sweep 的 Linear／Log、Burst 的 N Cycle／Manual／Infinite。 |
| TDS2001C | ACQUIRE 的 Sample／Peak Detect／Average；MATH 的加、減、乘、FFT，FFT window／zoom；DISPLAY 的 Vectors／Dots、Persistence、XY；16 種量測與 Math／Ref／FFT 游標。HORIZONTAL 的 Main／Window Zone／Window、Holdoff；Trigger 的 Pulse width／polarity／condition 與耦合選項；CH MENU 的 Invert／Fine；AUTOSET 的波形視圖、AUTORANGE 的持續調整；按住 TRIG VIEW 檢視觸發來源。SAVE/RECALL 支援十組 Setup、兩組 Ref、檔案匯出；PRINT 下載 LCD SVG。UTILITY 包含實際波形 Limit Test、資料 Logging 與 CSV 匯出。 |
| 34460A | Freq／Period、Shift→Ω4W／Cap／Diode、Temp 的 PT100／44007 與單位／R0；Acquire 的 NPLC／Gate／AC Filter／Single／Samples／Delay；DCV Input Z／Ratio，Math 的 dB／dBm／統計／Limits／Null；Display 的 Bar／Histogram；Probe Hold。Utility 的 Store／Recall、自訂開機設定、CSV／LCD SVG／設定 JSON 匯出與 Help。 |
| GPE-4323 | 在關機狀態按住 On/Off 再開機設定開機 Output；按住 Set View 再開機設定三位／四位小數顯示。設定過程輸出保持關閉，選定偏好在下次開機生效。 |

固定 RC 板與麵包板皆新增獨立 DMM Sense HI／LO。四線電阻從實際試驗電流與 Sense 壓差計算；電容量從已斷電、放電的電容網路計算，支援串聯、並聯及橋式連接，含電阻漏路時明確拒絕。Ratio 的兩條 Sense 對 Input LO 各不得超過 ±12 V，並禁止同時 Null。

## 量測與記憶的一致性

Manual Burst／Sweep 的輸出截止排在真正的時間點；即使畫面下一次更新已在截止之後，電容電荷、預觸發歷史與電表時間窗仍按原截止點銜接。FM 先積分瞬時頻率，Sweep 跨週期保持相位連續。電表 Single 的直流平均、交流 RMS、頻率與峰值過載檢查都使用觸發後實際經過的時間窗，停止後凍結讀值與顯示量程。

獨立交叉審查再修正連用反例：ARB 原地編輯不再改寫 lazy hybrid 的舊波形與電容電荷；1 ns–1 µs 的限流充電 RMS 不再因巨大穩態與暫態相消而變成零；單次 Burst 在量測結束前已歸零，仍會按採集窗內真正峰值檢查 crest factor 過載。雙通道不具有可解析共同週期時不再回退到 CH1 週期而扭曲 CH2。

新實驗存檔保留明確存入的 AFG 記憶、DMM 設定、示波器 Setup／Ref／Limit Template。舊版 v1 檔案仍可載入。載入前完整驗證並試建電路；損壞的樣本、設定或複合模式保留現況。重新載入從新時間軸與零電容電荷開始，Single 重新等待，Limit／Logging 關閉；即時資料、先前觸發時間與復原歷史不跨次帶入。

## 有界近似與未支援範圍

此版提供可操作的教學模型，沒有宣稱所有原廠硬體均已模擬。Noise 為固定種子、4096 點、1 MSa/s 重複雜訊；Built-in ARB 為函數近似，未複製原廠 66 種 ROM。Pulse 最小寬度依手冊：低於／等於 100 kHz 還受週期的 1/4096 限制，所以 1 kHz 最小約 244.14 ns；20 ns 可在較高頻率設定。理想邊緣保留 20 ns 低平台為教學近似。Peak Detect、FFT、觸發濾波、Probe Hold 與電表積分／輸入阻抗使用文件中明示的教學模型。

AFG 的週期網格最多 64000 區段；雙通道及 MOD／Sweep／Burst 不能形成可用共同週期或超過工作量的設定會拒絕並保留原值。整比搜尋分母最多 1024，浮點容差只涵蓋計算捨入，不能把相近的不同頻率視為同頻。一般不能整比閉合的 Log Sweep 請用 Manual 單次掃描。外部調變、Gate／External trigger、Marker／Trigger TTL 實體端子沒有虛擬輸入；相關操作會說明限制。Manual Infinite Burst 在延遲後持續輸出，N Cycle 在真正截止點回到起始相位的閒置電壓。

有限時間窗的峰值按實際波形轉折、RC 模態極值與保護分段搜尋，教學容差為 0.2 ppm 加 0.1 nV。混合保護長窗的直接跳躍僅支援單節點、單動態接地電容；其他 hybrid 拓撲尚未穩定且跨越超過 64 個完整週期時明示量測不可用，不將保守上界當成實測峰值，也不拿目前的零輸出去忽略先前脈波。

Counter 的虛擬輸入是實驗台示波器 CH1 尖端，DSO Link 是與模擬 TDS 的教學橋接；均非實體 USB／GDS 連線。瀏覽器 USB 選項只匯出／載入檔案，不存取真儀器。Video trigger、硬體校正／Self Cal／韌體更新／PictBridge／遠端介面及未建模的電流探棒仍明示限制。原版 GPE 手冊沒有可確認的 OVP／OCP／OTP 可調閾值，因此未臆造 A 版保護設定。

TDS Data Logging 只收錄已完成的觸發紀錄，更新間隔為教學用 200 ms；Average 必須完成指定筆數後才入記錄。記錄最多 2000 筆並標示捨棄數，不模擬原廠 USB 磁碟容量及即時吞吐。Limit Template 使用兩組真實 2500 點上下界，非 FFT 模板；統計與動作依已完成的紀錄執行。

## 驗證

最終 `npm run check`：**387／387 模型測試通過**，190 列控制矩陣結構通過；`node scripts/check-control-matrix.test.mjs`：**12／12 負向案例通過**；完整 `npm run e2e`：**496／496 真 UI 檢查通過**。最後離線 HTML 重建後再跑有限窗峰值／RMS 的 10 個回歸，10／10 通過。

測試包括原有回歸、解析 RC／RMS、獨立數值 ODE、實際脈波結束時間、Manual 輸出截止、兩模態歷史、存檔拒絕及瀏覽器滑鼠／鍵盤／檔案下載載入。跨儀器審查由未寫該處程式的 agent 提供具體反例，再由實作方修復，審查者重跑原條件確認；不是獨立實機校驗。代表畫面在 `docs/screenshots/2026-10-04/`。測試證明所列教學規格；校機韌體、類比誤差與所有硬體功能未經實機驗證。
