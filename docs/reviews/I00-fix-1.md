# I00 第一次獨立審查（REVIEW FAIL）的修正回覆

| 項目 | 內容 |
|---|---|
| 審查報告 | `docs/reviews/I00-review-1.md`（reviewer 原文，SHA-256 `95685810367f226202a1ee8071fca0674c03fb8395de961706da85addb61a09e`，與審查包 `SHA256.json` 相符） |
| 被審版本 | 成品 `c668ce316cf36f7ab4b62a256551a0dcbbc36802`／紀錄 `9f8a0833b301e58313a50270a641d5b08a3582ab` |
| 判決 | REVIEW FAIL，必改 R1–R7 |
| 次數 | I00 第 1 次獨立 FAIL。實作者內部的抽取、反向核對、批評回合都不算獨立審查次數 |
| 本次範圍 | 只修 R1–R7 與同一條規則的交叉引用；不開始 I01、不擴充功能、不重做整包研究；不合併 main、不部署、不啟動 J 階段 |
| 保持不變 | reviewer 已接受的四點：34460A 導通門檻固定 10 Ω（DS）、TDS 停止時觸發頻率計仍更新（p.112）、GPE Lock 依 p.27 明示近似、TDS 英文 LCD 暫定 |
| 新版本 | 見 `docs/reviews/I00-record.md` 第 1 節 |

修改只在 `docs/data/*.json`（唯一資料來源），再由 `node scripts/render-i00-docs.mjs` 重產 `docs/control-matrix.md` 與 `docs/instrument-scope.md`。逐欄差異可用 `git diff 9f8a083 <新成品 commit> -- docs/data/` 查看。

## R1–R7：原規則 → 修後規則 → 證據／反例 → 受影響欄位

| R | 原規則 | 修後規則 | 證據／反例 | 受影響欄位 |
|---|---|---|---|---|
| **R1** AFG 正負號與負 dBm | `+/-` 鍵「用於 DC Offset 負值」「只對可為負的參數有意義」；GAP-AFG-12「不可為負的參數在提交時拒絕」。照字面會把 −10 dBm 當成「幅度不能負」而拒絕 | dBm 可為負或 0；合法與否依**換算後的 Vpp**，再套幅度範圍與 AFG-F08 聯合限制，不因負號拒絕。Vpp／Vrms 必須大於 0（0 或負值拒絕、保留原值）。High Z 不可用 dBm。`+/-` 的實機提交語義仍為 PD。另新增規格列「dBm 可輸入範圍」：Sine、50 Ω 為 −56.02～+23.979 dBm（上限對應 10 Vpp；20–25 MHz 上限 +17.958 dBm＝5 Vpp） | M-AFG p.62「Unit Vpp, Vrms, dBm」、p.288「Units Vpp, Vrms, dBm」；p.215「If the output termination is set to high impedance, dBm units cannot be used.」<br>**正例：** 50 Ω、Sine、offset 0 V，−10 dBm＝0.1 mW＝0.07071 Vrms＝**0.200 Vpp**，接受。<br>**反例：** offset +4.00 V 時輸入 +13 dBm ≈ 2.825 Vpp，峰值 4.00＋1.41＝5.41 V > 5 V，拒絕。<br>既有 AFG-F11 的 13.52 dBm＝3 Vpp 與同一公式一致 | `AFG.NUM.PLUS_MINUS`（function、range、notes）；`AFG.KEY.AMPL`（range、evidence 改 PH+OT+PD）；GAP-AFG-12（impact、provisional、verify_method）；AFG-F06（rule、acceptance）；選單「AMPL」（notes）；規格新增「dBm 可輸入範圍（由 Vpp 範圍換算）」 |
| **R2** TDS 游標步進與 S2 驗收 | TDS-F17 驗收：「手動 50 µs/div（步進 2 µs）下應**精確**量到 125 µs」；共通 §0.4 S2 同句；TDS-F17 證據只標 OT | 游標步進**暫定** 1/25 div（PD，GAP-TDS-15），讀值容差＝**±1 個游標步進**：AutoSet 後 250 µs/div → 125 ± 10 µs；手動 50 µs/div → 125 ± 2 µs（格點上最接近 124／126 µs）。寫明容差理由：兩條游標各自最多偏離交越點半步，差值最多一步；取樣間隔（s/div ÷ 250）比游標步進細，不另增誤差。TDS-F17 證據改為 OT+PD | M-TDS-13 p.110 (PDF 134)「The resolution of the horizontal position time is 1/25 of a horizontal division.」——這是**水平位置**解析度，手冊沒寫游標解析度，借用同一數值屬 PD。<br>**反例：** 50 µs/div 時兩游標差必為 2 µs 的整數倍，125 µs 不可達（最近 124／126）；250 µs/div 時最近 120／130 | TDS-F17（rule、evidence、acceptance）；GAP-TDS-15（provisional、rationale）；共通 §0.4 S2 列 |
| **R3** GPE 換模式時 CH3／CH4 的輸出 | GPE-F10「Series/Parallel 不改變其設定**或輸出**」，驗收「切換模式前後 CH3/CH4 設定**與讀回**不變」；F07／F08「CH3/CH4 不受影響」，F07 驗收「CH3/CH4 設定與輸出不變」 | **設定值**跨模式保留；**換模式當下四路（含 CH3／CH4）全部 Output OFF**；重新按 On/Off、同樣負載下，CH3／CH4 的讀回才恢復。F10 驗收加完整步驟：ON（CH3 5.00 V／0.050 A、CV）→ 進 Series → 四路全 OFF（OFF 圖示、CV/CC 熄；LCD 顯示的是設定值不是讀回）→ 再 ON → 讀回恢復。F07／F08 的驗收改成先重新 ON 再檢查 | M-GPE p.25：Output 鍵「turn on all outputs in each channel」，自動關閉條件第一條「Change the operation mode between independent / series tracking / parallel tracking」；p.33「CH3 doesn’t have series/parallel tracking mode. Also, the CH3 output is not affected by the CH1 and CH2 modes.」與 p.35 同義句，字面上和 p.25 有張力；依 reviewer 的 R3 採 p.25，p.33／p.35 解讀為設定與輸出值不被 tracking 組合改變（PD），已新增來源差異列並在 CH3／CH4 旋鈕列加註。<br>**反例：** CH3 5 V、100 Ω、ON 時讀回 0.050 A；切 Series 後不能再宣稱 CH3 仍有相同有效輸出 | GPE-F10（rule、source、evidence、acceptance）；GPE-F07（rule、acceptance）；GPE-F08（rule、acceptance）；`GPE.KNOB.CH3_VOLTAGE`、`GPE.KNOB.CH4_VOLTAGE`（function）；GAP-GPE-15（gap、provisional：tracking 模式下切 ③④）；來源差異新增「CH3／CH4 輸出是否受換模式影響」；共通 §0.4 L1-CH3/4 列 |
| **R4** DMM Shift 指示位置 | `DMM.LCD.MAIN` 回饋列有「Shift 暫定指示」；GAP-DMM-02「按 Shift → LCD 暫定指示」；但 `DMM.KEY.SHIFT`、DMM-F12、共通 §0.2-5 已定為只在儀器外顯示——兩套互斥 | 統一為：**Shift 狀態只在儀器外狀態列顯示，LCD 不加字樣**。GAP-DMM-02 的驗證方法改成「到校看原廠怎麼指示」。`DMM.LCD.MAIN` 回饋同時寫清楚超量程用中性記號、無相容輸入時讀值欄留空（沿用已定的 GAP-DMM-06、DMM-F10） | P1 LCD 全暗；M-DMM 未取得；D-DMM 沒有 Shift 指示的說明；共通 §0.2-5 第 (3) 級（沒有字樣來源時不在 LCD 放文字） | `DMM.LCD.MAIN`（feedback）；GAP-DMM-02（provisional、verify_method）；規格「超量程顯示字樣」 |
| **R5** OUT 列把模擬器提示寫成原廠行為 | DMM 11 列可見回饋寫「原廠：按下顯示『本輪未納入』說明」 | 改為「模擬器：按下只在儀器外顯示範圍說明，LCD 與狀態不變。**原廠回饋：未取得（M-DMM 未取得）**」；Freq、Temp 另註「D-DMM 只證明功能存在」。**自查其他機型**另找到 5 列同類問題一併修正（見下一節）。共通 §0.2-3 補規則：「原廠：」只寫手冊或 datasheet 有依據的行為，查不到寫「原廠回饋：未取得」 | M-DMM 未取得，沒有任何原廠按鍵回饋可引用；「本輪未納入」是本專案的範圍提示 | `DMM.KEY.FREQ`、`TEMP`、`RUN_STOP`、`SINGLE`、`DISPLAY`、`ACQUIRE`、`UP`、`DOWN`、`LEFT`、`RIGHT`、`SELECT`（feedback）；另見下一節 5 列；共通 §0.2 第 3 條 |
| **R6** GPE 模式鍵的顯示依據 | GAP-GPE-15 寫「p.18 Parallel/Series Keys 只說 activates tracking；p.19 Set View 的『The corresponding channel will be displayed』不是在講模式鍵」，把顯示行為全部列為 PD | 補回 p.18 正文（OT）：模式鍵作用時 **LCD 顯示相應通道**。只把真正沒寫的留為 PD：原本顯示 ③／④ 時是否兩列都回 ①②、Series／Parallel 下每列的精確內容、切回 Independent 時的顯示（暫定：兩列回 ①②，切回時維持 ①②）。模式鍵兩列的回饋欄同步引用 p.18 | M-GPE p.18 (PDF 18) Parallel/Series Keys：「Activates parallel/series tracking operation. For details, see page 37. **The corresponding channel will be displayed on the LCD display.**」<br>這個錯誤是實作者在第二輪修正時自己寫錯的（第一輪 GPE 驗證者原本引用正確） | GAP-GPE-15（gap、provisional、rationale）；`GPE.KEY.TRACK_LEFT`（feedback）；`GPE.KEY.TRACK_RIGHT`（feedback、sources） |
| **R7** AutoSet 找不到合法刻度 | GAP-TDS-10「V/div 取最小的 1-2-5 檔，使整個波形在 ±4 div 內 …… 垂直位置不改」。Position 已在 +5 div 時沒有任何解 | 新增明示的**後備規則（PD）**：所有檔都放不下時，先把該通道 Position 歸零（0 div）再重選；Position 0 時最大檔仍放不下就用最大檔、量測顯示 ?。垂直位置只在後備規則觸發時歸零，否則不改。TDS-F15 規則與驗收加**恢復案例**：S2、實際與儀器都 10×，CH1 Position 調到 +5.00 div → AutoSet → CH1 Position 0 div、500 mV/div，波形回到 ±2 div 內；CH2 位置不變 | M-TDS-13 p.79 (PDF 103)：AutoSet「adjusts controls to produce a usable display of the input signal」；p.79–80 設定表沒有列垂直位置，所以後備規則屬 PD。<br>**反例：** Position +5 div 時任一 V/div＝s，最高點 5＋1/s > 4 div，10× 的 11 個 1-2-5 檔（20 mV～50 V/div）全部不合格；歸零後最小合格檔 500 mV/div（200 mV/div 會到 ±5 div） | GAP-TDS-10（provisional、verify_method）；GAP-TDS-11（provisional）；TDS-F15（rule、acceptance）；`TDS.KEY.AUTOSET`（notes） |

## R5 延伸：其他機型同類問題的自查結果

reviewer 要求「檢查其他機型有沒有同樣歸屬錯誤」。逐列掃描四台所有 OUT 列的「原廠：」子句，另外找到 5 列：

| 列 | 原本 | 問題 | 修後 |
|---|---|---|---|
| `GPE.LCD.ROW1_OVP_OCP`、`GPE.LCD.ROW2_OVP_OCP` | 「模擬器：按下只在儀器外顯示範圍說明…原廠：本輪保持熄滅。」 | 「本輪保持熄滅」是模擬器行為；而且 LCD 顯示段不能「按下」 | 「模擬器：顯示段本輪保持熄滅，不可操作。原廠：OVP 圖示在 Output ON 時表示 OVP 狀態（p.17），OVP 觸發會自動關輸出（p.25）；OVP 設定方法與門檻、OCP 都沒有正文（UN）」 |
| `GPE.LCD.OTP_ICON` | 同上 | 同上 | 「模擬器：顯示段本輪保持熄滅，不可操作。原廠：p.16 狀態區列出 OTP 圖示，觸發條件沒有正文（UN）」 |
| `GPE.LCD.CH3_FIXED_ROW` | 「…原廠：GPE-4323 本輪保持熄滅。」 | 同上 | 「模擬器：顯示段本輪保持熄滅，不可操作。原廠：此區是 GPE-3323 的 CH3 顯示（p.15、p.18）；GPE-4323 實機 LCD 是否有這些段未證實（UN）」 |
| `AFG.PORT.USB_DEVICE` | 「模擬器：按下只在儀器外顯示範圍說明…」 | 後面板連接埠不能「按下」 | 「模擬器：後面板不繪製，沒有操作。原廠：遠端連線時面板鍵除 F5 外都鎖住（p.183）」 |

另外，DMM 軟鍵 S2–S6 原本寫「原廠：LCD 最下列對應位置的標籤／狀態（P1 LCD 全暗，無法確認）」，雖然不是把模擬器行為說成原廠，但依新定的共通 §0.2-3 改成「原廠回饋：未取得——datasheet 行銷照只看得到 DCV 畫面的軟鍵標籤（PD）…」；`GPE.LCD.CH3_FIXED_ROW` 的證據由 OT 改為 OT+UN，與它回饋欄的 UN 敘述一致。

其他 OUT 列的「原廠：」子句（例如 AFG 的「LCD 軟鍵換成 ARB 選單」、TDS 的「右側選單」）都有手冊依據，保留不改。

這兩類錯誤都是實作者第二輪批量改寫 OUT 列時造成的，不是原始抽取的問題。

## 沒有改的部分

- reviewer 接受的四點照舊，沒有改回舊規則。
- reviewer 的非阻擋建議 4（儀器外的中文教學說明可標「教學翻譯」，不必全面禁止中文對照）：本次只修 R1–R7，**沒有**改 GAP-TDS-01。這一點留到 I03 做 TDS 面板時再依使用者意見決定。
- 沒有新增功能、沒有刪除核心項目、沒有放寬任何驗收條件。

## 內部對抗檢查後的補充修正

修完 R1–R7 後，實作者另派一個全新 context 的子代理做對抗檢查（仍屬實作者端，不算獨立審查）。它確認 R1–R7 都已處理，並找到下列殘留，已一併修正：

| 屬於 | 殘留 | 修正 |
|---|---|---|
| R3 | `GPE.KNOB.CH3_VOLTAGE`／`CH4_VOLTAGE` 仍無條件引用 p.33／p.35「output is not affected by the CH1 and CH2 modes」，與 p.25 全部自動 OFF 衝突；本檔 R3 列也誤寫 p.33／p.35「只說沒有 tracking」 | 兩列加註 p.25；新增來源差異列；GPE-F10 證據改 OT+PD；本檔 R3 列更正 |
| R3 | GPE-F10、F07 的驗收步驟沒有先把 LCD 切到 ③／④，照 GAP-GPE-15 回到 ①② 後看不到 CH3／CH4 | 驗收加「按 CH2/CH3 切到 ③、CH1/CH4 切到 ④」；GAP-GPE-15 補「tracking 模式下能否切到 ③④ 未寫，暫定可以（PD）」 |
| R1 | `AFG.KEY.AMPL` 的範圍欄含換算出的 dBm 範圍，證據卻只標 PH+OT；+23.98 dBm 四捨五入後換算約 10.0007 Vpp，超過上限；AFG-F06 的「offset +4.00 V」步驟沒寫前提 | 證據改 PH+OT+PD；上限改為精確的 +23.979 dBm（+17.958 dBm）；驗收寫成連續步驟（先 −10 dBm，再設 offset +4.00 V，峰值 4.10 V 合法）；GAP-AFG-12 補「其他參數輸入負值依各自範圍規則拒絕」 |
| R4 | `DMM.LCD.MAIN` 的「超量程顯示中性記號」與導通開路顯示 OPEN 未交代；規格「超量程顯示字樣」仍寫「以模擬器近似字樣」 | 兩處都寫明：一般超量程用中性記號、導通開路例外顯示 OPEN（GAP-DMM-06、GAP-DMM-08） |
| R5 | DMM 軟鍵 S2–S6 的「原廠：」寫法與新定規則不一致；`GPE.LCD.CH3_FIXED_ROW` 證據與回饋欄不一致 | 見上一節最後一段 |
| R7 | TDS-F15「確保一定能帶回可視區」與「最大檔仍放不下時顯示 ?」矛盾；少一個句號；Position 在 ±4 div 內但接近邊緣時波形會被壓扁，沒有交代 | 改為「輸入超出最大檔時例外」；補句號；GAP-TDS-10 加「已知限制」與到校驗證步驟 |

## 修正複核（同一審查脈絡）後的補充：AFG 幅度判定的捨入

使用者轉來第 1 次審查脈絡對 `51d9b17` 的**修正複核**結果（依轉述，這不算一次新的全新 context 獨立 FAIL）：前次 7 項已處理，但還有 1 項規則矛盾，建議補完再進 I01。複核的完整報告與交接包存在使用者的 Mac，本 session 無法開啟，所以只依轉述內容修正，也沒有記錄那兩個檔案的雜湊。

| 項目 | 原規則 | 修後規則 | 證據／反例 | 受影響欄位 |
|---|---|---|---|---|
| AFG 幅度合法性與捨入 | AFG-F06「單位換算後先依顯示解析度（1 mV **或** 3 位有效數字）捨入，再做範圍與聯合限制檢查（PD）」——兩種捨入會得到相反判定 | **先用未捨入的換算值判定，再格式化顯示**（模擬器暫定規則，PD）：通過後保存未捨入值，LCD 依 GAP-AFG-13 四捨五入顯示；格式化只影響畫面。手冊 p.288「Resolution 1mV or 3 digits」是儀器規格，不當判定前的捨入規則 | **反例：** 23.98 dBm＝10.00069 Vpp——捨入到 1 mV 得 10.001（拒絕）、捨入到 3 位有效數字得 10.0（接受）。<br>**修後：** 依未捨入值 10.00069 > 10 → 拒絕；23.979 dBm＝9.99954 Vpp → 接受，LCD 顯示 10.000 VPP；3.536 VRMS＝10.00132 Vpp → 拒絕 | AFG-F06（rule、acceptance 加三個邊界案例）；AFG-F08（rule：判定用未捨入值）；GAP-AFG-13（provisional：顯示四捨五入且不影響判定）；來源差異「遠端 APPLy 的 offset 參數 vs 面板 offset 範圍」（4.9995 V 合法，顯示為 5.00 VDC） |

這條「先捨入再檢查」的規則是實作者在第一輪裁決 V-AFG-08 時自己加的（見已凍結的 `I00-selfcheck.md`），本次以上表取代。

## 檢查結果

見 `docs/reviews/I00-record.md` 第 8 節（結構自檢、12 個負向案例、重產後 `git diff`、殘留舊規則字樣搜尋、數值複算）。
