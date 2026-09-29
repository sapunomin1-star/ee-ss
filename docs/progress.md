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

**剩下**
- I03 示波器、I04 電源、I05 電表：面板已可看，行為還是占位（按了只提示「開發中」）。
- I06 整合與實際練習。

**下一步**：I03、I04、I05 平行實作。
