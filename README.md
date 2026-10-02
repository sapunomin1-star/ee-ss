# electronics-lab-trainer：電子學實習儀器模擬器

在家練習學校四台儀器的前面板操作，讓操作習慣能轉移到校機：

- GW Instek AFG-2225 任意波形訊號產生器
- Tektronix TDS2001C 雙通道示波器
- Keysight 34460A 6½ 位數電表
- GW Instek GPE-4323 四路電源供應器（原版，不是 GPE-4323A）

這是獨立的新專案，不含也不修改任何 HFSS／ADS 練習程式。

## 怎麼打開

**直接用瀏覽器開 `dist/index.html`**（單一檔案、離線可用）。四台都能操作（I01–I06 自測完成），「實驗台」分頁可以接線做 AFG → RC → 示波器＋電表的實驗；上方分頁切換；點按鍵、拖曳旋鈕操作，旋鈕聚焦後也可用方向鍵。進度見 `docs/progress.md`。

改程式後重建：

```sh
npm install        # 第一次
npm run build      # 產生 dist/index.html
npm test           # 模型測試
npm run e2e        # 真滑鼠／鍵盤操作測試（用本機 Google Chrome）
```

## 目前狀態

2026-10-02 已修正最新六項審查反例及追加的獨立電容、觸發時序、高電壓充電邊界。模型 175 項、真 UI 265 項通過；原審查對話已完成程式版 `53b9d33` 複核，本輪指定範圍沒有殘留阻擋，詳見 [修正記錄](docs/reviews/2026-10-02-fixes.md)。含電容且 AFG／GPE 真正共同驅動的週期保護切換仍明確列為未支援。

**目前已有四台單機與實驗台（固定 RC 板＋可以自己插電阻、電容、跳線的麵包板；AFG、GPE 直流電源、示波器、電表都能接上）。** 2026-09-30 經兩輪外部審查並修正（第二輪：窄脈衝有效值、儀器負載、電容暫態、電表積分與峰值量程、示波器削頂／AC 耦合／BW Limit／方波 AutoSet／混疊），之後的修正後複核（長時間常數積分、電表畫面更新、已完成讀值、BW 邊緣、Single／Normal 擷取暫態）也已修正；麵包板與通用電路計算已經過一次複核並修正 8 項（電荷守恆、限流充電、電源灌入等），修正後待再複核。`npm run check` 與 `npm run e2e` 的最新結果見 `docs/progress.md`。可練習固定串聯 RC 的低通／高通、改 R/C、探棒接線與 DCV／ACV／斷電電阻量測。判斷與限制見 `docs/progress.md`；這不代表全部原廠功能或校機一致性已驗證。

I00 歷史：R1–R7 與 C1 已修正，原先正式文件審查的待辦紀錄仍保留。使用者之後授權本地連續實作，進度已推進到 RC 實驗台，不能再以 I00 舊紀錄推斷「還沒有應用程式」。審查原文與修正對照保留在 `docs/reviews/`。

## 文件

| 檔案 | 內容 |
|---|---|
| `docs/control-matrix.md` | 四台每個實體控制項的穩定 ID、照片位置、標籤、動作、回饋、範圍、來源頁、證據級別、狀態、所屬卡 |
| `docs/instrument-scope.md` | 四台核心功能與驗收規則、規格、未納入、資料缺口與暫定行為、來源差異；共通規則與暫定測試情境參數 |
| `docs/sources.md` | 來源 ID、版本、頁碼對照、證據分級，以及補查原廠手冊的紀錄 |
| `docs/I00-baseline.md` | 資料包完整性、Git 現場、可用工具、網路限制 |
| `docs/reviews/` | 每卡實作紀錄、自檢紀錄、給獨立 reviewer 的交接 |
| `docs/data/*.json` | 控制矩陣與範圍文件的唯一資料來源 |

## 規格文件工具

```sh
node scripts/render-i00-docs.mjs        # 由 docs/data/*.json 產生兩份矩陣文件
node scripts/check-control-matrix.mjs   # 矩陣結構與照片硬性數量自檢（不是功能測試）
node scripts/check-control-matrix.test.mjs  # 確認檢查器會擋下刻意破壞的矩陣
```

## 參考資料

規劃資料包（原廠手冊 PDF、校機照片）不放進這個 public repo，放法見 `reference/README.md`。
