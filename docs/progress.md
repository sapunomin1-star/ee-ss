# 進度（簡短版）

## 怎麼打開

直接用瀏覽器開 `dist/index.html`（離線可用，不必架站）。改了程式要重建：`npm install` 一次，之後 `npm run build`。

## 2026-09-30

**完成**
- I01 共用框架：四台面板依照片座標與矩陣穩定 ID 繪製；按鍵可點、可 Tab 聚焦後按 Enter；旋鈕可拖曳（往上／往右＝順時針），聚焦後可用方向鍵，不吃滑鼠滾輪；OUT 鍵只在儀器外說明「本輪未納入」；近似行為以虛線框標示；四台切換、縮放、單台／全部重設、儀器外提示列、繁中教學側欄。
- I02 AFG：波形（Sine／Square／Ramp＋SYM）、頻率、幅度（VPP／mVPP／VRMS／mVRMS／dBm，先判定未捨入值再格式化顯示）、DC Offset、聯合限制、◀▶＋旋鈕微調、CH1/CH2、Load 50 Ω／High Z、Output、Preset、Return、電源。未納入的鍵（ARB／MOD／Sweep／Burst／UTIL、Pulse、Noise、Phase、DSO Link、Duty）只提示不改狀態。

**測過**
- `npm test`：AFG 模型 18 項（AFG-F06 驗收 a–h、聯合限制、Load、Preset、SYM、未納入鍵）全過。
- `npm run e2e`：AFG 真滑鼠／鍵盤 17 項全過（含拖曳旋鈕、鍵盤調旋鈕、拒絕後保留原值、電源）。
- `node scripts/check-control-matrix.mjs`：矩陣結構照舊通過。

## 2026-09-30（續）I03–I06

**完成**
- I03 TDS2001C：每次採集一份紀錄（2500 點），波形、Measure、Cursor、AutoSet 都從同一份資料算；CH1/CH2、V/div、Position、Coupling（DC／AC／Ground）、Probe（與實際探棒分開，錯配會按比例錯讀）、s/div、水平位置、Edge 觸發（Level、Slope、Auto／Normal、Single、Force Trig、Set To 50%）、Run/Stop、AutoSet（含 Position 歸零後備規則）、Measure（Freq、Period、Pk-Pk、Mean、Cyc RMS）、Cursor（時間／振幅，1/25 div）、Default Setup、電源。測試情境 S1、S2（實際探棒 10×／1×）、S3a–c。
- I04 GPE-4323：六顆旋鈕設 V／I、On/Off 一次開關四路、CV／CC（L1 負載情境）、CH1/CH4、CH2/CH3 切顯示、Set View、長按 2 秒 Lock、Series／Parallel（換模式四路自動 OFF、重新 ON 才恢復）、電源。
- I05 34460A：DCV、ACV、Ω 2W、Cont、Shift→DCI／ACI、Auto／手動量程、Null（每功能各自保存）、超量程中性記號、導通 OPEN、不相容輸入不顯示讀值、電源；D1 測試情境 8 種。操作手冊未取得，推論的流程都在儀器外標「近似」。
- I06：四台在同一頁操作，換分頁狀態不串台、單台關機不影響別台、全部重設、錯誤輸入後可繼續。

**測過**
- `npm test`：75 項（AFG 18、TDS 24、GPE 16、DMM 17）全過。
- `npm run e2e`：147 項真滑鼠／鍵盤（AFG 17、TDS 44、GPE 34、DMM 37、I06 15）全過。
- 代表畫面：`docs/screenshots/afg.png`、`tds.png`、`gpe.png`、`dmm.png`、`i06.png`。

**剩下**
- 各台都是自測完成，尚未由獨立 reviewer 驗收。

## 2026-09-30（續）J 階段：實驗台接線 AFG → RC → 示波器＋電表

**完成**
- 新分頁「實驗台」：點導線端（AFG 紅／黑夾、示波器 CH1／CH2 探棒尖端與接地夾、電表 HI／LO）再點電路板接點 A／B／G 就接上；選取後再點一次＝拔掉。可選 R、C、接法（低通：B＝電容電壓；高通：B＝電阻電壓）、探棒 1×／10× 開關；三台的即時小螢幕點一下切到該台。
- 電路計算：AFG＝EMF 串 50 Ω 內阻（Load 設定只是顯示參照，所以 50 Ω 設定下接 RC 會看到約 2 倍電壓）；示波器接地夾＝大地（夾錯點會把該點短路）；電表浮接量 HI−LO。正弦、方波、Ramp 都算週期穩態。
- 示波器改用「實驗台接線」情境後，波形、Measure、Cursor 都來自電路；電表可量 DCV、ACV，電路沒通電時可量電阻；探棒或測試線一接上就自動切換。
- 警告：接地夾夾在非接地點、沒有接回地、AFG 輸出 OFF、紅夾接地。側欄有理論值（τ、fc、振幅比、相位）可自我檢查。

**最短操作路徑（RC 低通，1 kHz）**
1. 開 `dist/index.html` → 「實驗台」→ 按「示範接線」（或自己一條條接：AFG 紅→A、黑→G；示波器 CH1 尖端→A、CH2 尖端→B、接地夾→G；電表 HI→B、LO→G）。
2. 「AFG-2225」：Preset → CH1/CH2 按兩下 → F1 Load → F2 High Z → AMPL 2、F5 VPP → FREQ/Rate 1、F4 kHz → OUTPUT。
3. 「TDS2001C」：Auto Set → 兩條正弦（藍色較小、落後）→ Measure → OPT1 → OPT2 按 4 次（Pk-Pk）→ OPT5；Cursor 量時間差算相位差。
4. 「34460A」：按 ACV → 讀電容電壓有效值（約 0.590 V）。

**測過**
- `npm test`：83 項（含電路 8 項：低通／高通振幅與相位、方波 τ、直流偏移、接錯線後果）全過。
- `npm run e2e`：162 項全過；實驗台 15 項是用滑鼠一條條點擊接線，示波器 CH1／CH2 Pk-Pk（1.97／1.67 V）與電表 ACV（0.5902 V）都和理論值相符，並測接地夾夾錯與量電阻。
- 畫面：`docs/screenshots/bench-wiring.png`、`bench-scope.png`、`bench-square.png`。

**剩下／限制**
- 電路板只有串聯 RC（低通／高通），不是自由麵包板；電表在實驗台上還不能量電流；GPE 還沒接進實驗台。
- 探棒與電表的輸入阻抗忽略；示波器 AC 耦合對電路訊號只去掉直流（不模擬低頻傾斜）；方波時 AutoSet 側選單仍顯示 sine 選項（近似）。
- 全部是自測，尚未由獨立 reviewer 驗收；只在本機 commit，沒有 push。

**下一步**：依使用者需要擴充電路元件（二極體、運算放大器…）或讓 GPE 當直流電源接進實驗台。
