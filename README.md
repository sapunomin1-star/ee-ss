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

最新「2026.10.04 驗收修正版」修正示波器真實後觸發採集與歷史濾波、電表 Single 歷史及背景採集、AFG 波形限制與 Manual Burst 相位；補上示波器 Setup 檔案叫回及電表顯示選項。詳見 [第二輪驗收報告](docs/reviews/2026-10-04-quality-pass.md)。

2026-10-04 四台儀器功能補強：AFG 新增 Pulse／Noise／ARB 編輯與波形檔、Phase／Duty、十組記憶、Dual Channel、Counter／DSO Link，以及實際 AM／FM／FSK／PM／SUM／Sweep／Burst。TDS 新增 Math／FFT、XY、Peak／Average、Persistence、Pulse Trigger／Holdoff／Trig View、AutoRange、Setup／Ref、Limit Test、Data Logging 與檔案匯出。DMM 新增四線電阻／電容／頻率週期／溫度、NPLC／Single、Ratio／dB、Histogram／Probe Hold／統計／Limits、記憶及自訂開機設定；GPE 補上開機 Output 與顯示位數設定。兩種實驗台都有獨立 Sense HI／LO。操作入口、驗證與硬體限制見 [功能補強報告](docs/reviews/2026-10-04-instrument-functions.md)。

新存檔保留明確存入的儀器記憶、Setup／Ref／Limit Template，兼容舊 v1 檔案；重開仍從零電容電荷與新的採集時間軸開始。以下日期段落為各輪歷史，不代表最新版本仍缺上面已補的功能。

2026-10-02 電流、復原與保護補強：實驗台新增 `I 3A` 表筆，可拆開迴路串入 I–LO，量 DCI／ACI；量程對應的等效分流負載會實際影響電路。麵包板「電流串接」示範可直接練習。兩種板子可復原／重做接線、元件與改值，每塊板保留 100 步；按鈕或 Ctrl／Cmd+Z、Ctrl／Cmd+Shift+Z 均可操作。含電容的 AFG／GPE 共同驅動網路新增單一／同頻率 AFG 的 CV／CC／逆灌開路切換，電容電壓及量測時間窗連續。驗證與使用限制見 [本輪補強報告](docs/reviews/2026-10-02-current-undo-protection.md)。

2026-10-02 該輪完整回歸：模型 261／261、真 UI 373／373；190 列控制矩陣及 12 項負向檢查通過。極端高頻與多電容長暫態的首次計算仍可能需數秒，詳見報告。

接線、元件、探棒與四台儀器設定會自動保存在同一瀏覽器，可用上方「匯出實驗／載入實驗」攜帶 JSON 實驗檔。載入後重新開始模擬，電容從 0 V 開始，不保存舊波形、電荷或復原歷史；瀏覽器不允許自動保存時仍可匯出。此前的儀器操作與保存補強，模型 225 項、真 UI 301 項全過，詳見 [居家練習複核](docs/reviews/2026-10-02-home-lab.md)。

歷史修正：2026-10-02 已修正六項審查反例及追加的獨立電容、觸發時序、高電壓充電邊界。當時模型 175 項、真 UI 265 項通過；原審查對話已完成程式版 `53b9d33` 複核，該輪指定範圍沒有殘留阻擋，詳見 [修正記錄](docs/reviews/2026-10-02-fixes.md)。該報告中的電流、復原與含電容週期保護待辦，已由本輪在上述範圍補上。

**目前已有四台單機與實驗台（固定 RC 板＋可以自己插電阻、電容、跳線的麵包板；AFG、GPE 直流電源、示波器、電表都能接上）。** 可練習電阻串並聯與分壓、RC 低通／高通、充放電、探棒接線與 DCV／ACV／DCI／ACI／斷電電阻量測。最新驗證及剩餘限制見 `docs/progress.md`。這不代表全部原廠功能或校機一致性已驗證。

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
