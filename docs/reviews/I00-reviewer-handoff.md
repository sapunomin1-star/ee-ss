# I00 交給獨立 reviewer 的資料

實作者不能自己寫 REVIEW PASS。請開一個**全新 context** 的對話（不要沿用實作者的 session），交下列資料。

## 1. 要附上的東西

| 項目 | 內容 |
|---|---|
| 規劃資料包 | 同一份 `電子學儀器模擬_Opus交接包_20260929.zip`，SHA-256 `c447853c04780d274e3fddab16bbcb7ffcc962b3bf5427cd70a062c2ddfa3a83`。解壓後先跑 `python3 verify_bundle.py` |
| 待審版本 | GitHub `sapunomin1-star/ee-ss`，分支 `claude/new-session-24ecn6`。`docs/reviews/I00-record.md` 第 1 節寫明「成品 commit」與「紀錄 commit」：後者只比前者多改紀錄檔本身，可用 `git diff --stat <成品 commit> <紀錄 commit>` 確認。**不要**審 dirty 工作樹或更新的 commit |
| 實作紀錄 | `docs/reviews/I00-record.md` |
| 本卡成品 | `docs/control-matrix.md`、`docs/instrument-scope.md`、`docs/sources.md`、`docs/I00-baseline.md`、`docs/data/*.json`、`docs/reviews/I00-selfcheck.md`、`scripts/check-control-matrix.mjs`、`scripts/check-control-matrix.test.mjs`、`scripts/render-i00-docs.mjs`（各檔 SHA-256 見紀錄第 3 節） |
| Reviewer 指令 | 包內 `06_獨立Reviewer提示詞.md` 的「可直接貼上的通用指令」，再加下面第 2 節 |

repo 是 public，所以原廠 PDF 與校機照片**不在 repo 裡**，reviewer 要從資料包取得（放到 `reference/` 即可，見 `reference/README.md`）。

## 2. 貼在通用指令後面的 I00 補充

```text
本卡：I00 來源與基線核定（純文件卡，沒有應用程式，免跑 e2e）。
待審 commit：<貼上 I00-record.md 第 1 節的「紀錄 commit」>，分支 claude/new-session-24ecn6。
請自己開 P1／P2 照片與原廠手冊頁核對，不要只讀實作者結論。重點：

1. I00-1：照片機型與矩陣相符；TDS 只有 CH1／CH2＋Ext Trig；GPE 正好 6 顆旋鈕、沒有 CH3／CH4 電流旋鈕、端子順序 CH4±、CH1±、GND、CH2±、CH3±；34460A 沒有 10 A 孔與 Front/Rear。
2. I00-2：PH／OT／DS／IX／PD／UN 分級是否誠實。34460A 完整手冊未取得（原廠網域被環境封鎖，只有搜尋定位），精確選單不可被寫成已核對；GPE Lock 的原廠說法歧義仍要保留。
3. I00-3：每台核心控制與未納入清單對照 02；沒有擅自取消核心功能、沒有塞入高階型號（34461A/65A/70A、GPE-4323A、TDS 四通道）功能。
4. I00-4：韌體、LCD 語言、開機記憶等未提供資料有暫定規格、理由與驗證方式。
5. I00-5：repo／分支、Node／Chromium 可用性、原始資料 hash；HFSS／ADS 沒被動到。
抽查方式建議：每台至少挑 5 列 CORE、3 列 APPROX／OUT、所有 specs 中的範圍數字各 2 條，打開引用頁逐字核對；另請實際跑
  node scripts/check-control-matrix.mjs
  node scripts/check-control-matrix.test.mjs
  node scripts/render-i00-docs.mjs && git diff --exit-code docs/
確認文件由 JSON 產生、結構自檢通過、檢查器會擋下刻意破壞的矩陣（這些命令只驗結構，不是功能驗收）。
實作者的自檢過程與全部裁決在 docs/reviews/I00-selfcheck.md；那是實作者端自檢，不是獨立審查，請自己重新核對。
```

## 3. 判決之後

- **REVIEW PASS**：把 reviewer 回覆原文存成 `docs/reviews/I00-review-1.md` 並提交，才開始 I01。
- **REVIEW FAIL**：回同一張 I00 修正，修完產生新的待審 commit，再交全新 context reviewer。第三次 FAIL 就停下來報告使用者。
