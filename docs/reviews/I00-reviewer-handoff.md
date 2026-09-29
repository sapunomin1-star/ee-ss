# I00 交給獨立 reviewer 的資料（第 2 次審查：修正後重審）

實作者不能自己寫 REVIEW PASS。請開一個**全新 context** 的對話（不要沿用實作者的 session，也不要沿用第 1 次審查的 context），交下列資料。

## 1. 要附上的東西

| 項目 | 內容 |
|---|---|
| 規劃資料包 | 同一份 `電子學儀器模擬_Opus交接包_20260929.zip`，SHA-256 `c447853c04780d274e3fddab16bbcb7ffcc962b3bf5427cd70a062c2ddfa3a83`。解壓後先跑 `python3 verify_bundle.py` |
| 待審版本 | GitHub `sapunomin1-star/ee-ss`，分支 `claude/new-session-24ecn6`。`docs/reviews/I00-record.md` 第 1 節寫明本次的「成品 commit」與「紀錄 commit」：後者只比前者多改紀錄檔本身，可用 `git diff --stat <成品 commit> <紀錄 commit>` 確認。**不要**審 dirty 工作樹或更新的 commit |
| 第 1 次審查 | `docs/reviews/I00-review-1.md`（reviewer 原文，REVIEW FAIL，必改 R1–R7）；當次被審版本為成品 `c668ce3`／紀錄 `9f8a083` |
| 修正對照 | `docs/reviews/I00-fix-1.md`：R1–R7 每項「原規則 → 修後規則 → 證據／反例 → 受影響欄位」、其他機型同類問題的自查，以及修正複核指出的 AFG 捨入矛盾 |
| 實作紀錄 | `docs/reviews/I00-record.md` |
| 本卡成品 | `docs/control-matrix.md`、`docs/instrument-scope.md`、`docs/sources.md`、`docs/I00-baseline.md`、`docs/data/*.json`、`docs/reviews/I00-selfcheck.md`、`scripts/check-control-matrix.mjs`、`scripts/check-control-matrix.test.mjs`、`scripts/render-i00-docs.mjs`（各檔 SHA-256 見紀錄第 3 節） |
| Reviewer 指令 | 包內 `06_獨立Reviewer提示詞.md` 的「可直接貼上的通用指令」，再加下面第 2 節 |

repo 是 public，所以原廠 PDF 與校機照片**不在 repo 裡**，reviewer 要從資料包取得（放到 `reference/` 即可，見 `reference/README.md`）。

## 2. 貼在通用指令後面的 I00 補充（第 2 次審查）

```text
本卡：I00 來源與基線核定（純文件卡，沒有應用程式，免跑 e2e）。這是第 1 次 REVIEW FAIL 之後的同卡修正重審。
待審 commit：<貼上 I00-record.md 第 1 節的「紀錄 commit」>，分支 claude/new-session-24ecn6。
第 1 次審查原文：docs/reviews/I00-review-1.md；實作者的修正對照：docs/reviews/I00-fix-1.md。

請先逐項核對 R1–R7 是否真的解決，不要只讀實作者的對照表：
- R1：AFG 的 +/- 與 dBm——文件是否一致描述「面板輸入 −10 dBm 得到 0.200 Vpp 等效值」，而非法聯合峰值（例如 offset +4 V 時 +13 dBm）仍被拒絕；Vpp／Vrms 仍須為正；High Z 不可用 dBm。另依修正複核：幅度合法性一律用未捨入的換算值判定，再格式化顯示（23.98 dBm＝10.00069 Vpp 拒絕、23.979 dBm 接受）；見 I00-fix-1.md「修正複核」一節。
- R2：TDS 游標——不再要求不可表示的精確值；容差有解析度依據；1/25 div 游標步進標為 PD。
- R3：GPE——換模式時四路（含 CH3／CH4）全 Output OFF、設定保留、重新 ON 同負載才恢復讀回；驗收有「ON→換模式→全 OFF→再 ON」。
- R4：DMM——Shift 只在儀器外指示，沒有殘留的 LCD Shift 敘述。
- R5：DMM 11 列與其他機型——「原廠：」子句不再把模擬器提示說成原廠行為。
- R6：GPE GAP-GPE-15——p.18 模式鍵顯示句已列為 OT，只把真正未寫的細節留 PD。
- R7：TDS AutoSet——有「找不到刻度先把 Position 歸零」的 PD 後備規則，並有 Position +5 div 的恢復案例。
再用 git diff 9f8a083 <紀錄 commit> 看是否有 R1–R7 以外的改動，並抽查受影響的跨文件引用。
第 1 次審查已接受的四點（導通 10 Ω 為 DS、TDS 停止時觸發頻率計仍更新、GPE Lock 依 p.27 近似、TDS 英文 LCD 暫定）不應被改回。

另請實際跑：
  node scripts/check-control-matrix.mjs
  node scripts/check-control-matrix.test.mjs
  node scripts/render-i00-docs.mjs && git diff --exit-code docs/
確認文件由 JSON 產生、結構自檢通過、檢查器會擋下刻意破壞的矩陣（這些命令只驗結構，不是功能驗收）。
實作者的自檢（I00-selfcheck.md、I00-fix-1.md 的檢查）都是實作者端，不是獨立審查，請自己重新核對。
```

## 3. 判決之後

- **REVIEW PASS**：把 reviewer 回覆原文存成 `docs/reviews/I00-review-2.md` 並提交，才開始 I01。
- **REVIEW FAIL**：回同一張 I00 修正，修完產生新的待審 commit，再交全新 context reviewer。這會是 I00 第 2 次 FAIL；第 3 次 FAIL 就停下來報告使用者。
