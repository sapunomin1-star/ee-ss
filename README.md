# electronics-lab-trainer：電子學實習儀器模擬器

在家練習學校四台儀器的前面板操作，讓操作習慣能轉移到校機：

- GW Instek AFG-2225 任意波形訊號產生器
- Tektronix TDS2001C 雙通道示波器
- Keysight 34460A 6½ 位數電表
- GW Instek GPE-4323 四路電源供應器（原版，不是 GPE-4323A）

這是獨立的新專案，不含也不修改任何 HFSS／ADS 練習程式。

## 目前狀態

**I00 來源與基線核定：第 1 次獨立審查 REVIEW FAIL（R1–R7），已完成同卡修正，待第 2 次獨立審查。** 還沒有應用程式，也還沒有任何 REVIEW PASS。審查原文與修正對照見 `docs/reviews/I00-review-1.md`、`docs/reviews/I00-fix-1.md`。
卡片順序：I00 → I01 共用框架 → I02 AFG → I03 示波器 → I04 電源 → I05 電表 → I06 單機整合。每張卡都要全新 context 的獨立 reviewer 判 PASS 才進下一張。
接線與波形計算（J01–J03）要等 I06 通過、使用者另行啟動。

## 文件

| 檔案 | 內容 |
|---|---|
| `docs/control-matrix.md` | 四台每個實體控制項的穩定 ID、照片位置、標籤、動作、回饋、範圍、來源頁、證據級別、狀態、所屬卡 |
| `docs/instrument-scope.md` | 四台核心功能與驗收規則、規格、未納入、資料缺口與暫定行為、來源差異；共通規則與暫定測試情境參數 |
| `docs/sources.md` | 來源 ID、版本、頁碼對照、證據分級，以及補查原廠手冊的紀錄 |
| `docs/I00-baseline.md` | 資料包完整性、Git 現場、可用工具、網路限制 |
| `docs/reviews/` | 每卡實作紀錄、自檢紀錄、給獨立 reviewer 的交接 |
| `docs/data/*.json` | 控制矩陣與範圍文件的唯一資料來源 |

## 指令（目前只有文件工具，Node 22、沒有相依套件）

```sh
node scripts/render-i00-docs.mjs        # 由 docs/data/*.json 產生兩份矩陣文件
node scripts/check-control-matrix.mjs   # 矩陣結構與照片硬性數量自檢（不是功能測試）
node scripts/check-control-matrix.test.mjs  # 確認檢查器會擋下刻意破壞的矩陣
```

`npm run build`／`check`／`e2e` 會在 I01 建立。

## 參考資料

規劃資料包（原廠手冊 PDF、校機照片）不放進這個 public repo，放法見 `reference/README.md`。
