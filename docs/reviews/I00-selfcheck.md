# I00 實作者自檢紀錄（不是獨立審查）

> 本檔記錄 I00 **第一次送審前**的實作者自檢。第一次獨立審查判 REVIEW FAIL（`I00-review-1.md`），之後的同卡修正見 `I00-fix-1.md`；本檔內容不再更新。

> 這份是 **實作者端** 的自檢過程與裁決紀錄。所有「驗證者」「批評者」都是實作者在同一個 session 派出的子代理，
> 雖然每個子代理是新的 context，但仍屬實作者自檢，**不能**當作 06 要求的獨立 REVIEW PASS。

## 1. 流程

| 步驟 | 做法 | 產物 |
|---|---|---|
| 1. 抽取 | 每台儀器一個代理，只准引用本次實際讀過的照片位置與手冊頁；不確定一律標 UN／PD | 各台結構化資料（控制、選單、規格、核心、未納入、缺口、差異） |
| 2. 反向核對 | 每台一個新 context 驗證者，預設懷疑，自己重開照片與手冊頁逐條核對 | 每台問題清單（error／warn）＋自述未核對範圍 |
| 3. 裁決 | 實作者逐條回原文核對後採納或駁回，並寫入 `docs/data/*.json` | 下方第 2 節裁決表 |
| 4. 結構自檢 | `node scripts/check-control-matrix.mjs`：表頭、欄數、唯一 ID、代碼、CORE 需有 PH／OT／DS、照片硬性數量 | 通過；另以 4 個刻意破壞的副本確認會失敗（第 3 節） |
| 5. 完整性批評 | 兩個新 context 批評者：需求覆蓋、交叉引用與測試情境一致性 | 第 4 節 |
| 6. 官方手冊搜尋 | 一個代理用 WebSearch 找同型號原廠文件與版本；原廠網域被封鎖，只記 IX | `docs/sources.md` §3 |

## 2. 反向核對結果與裁決

### AFG-2225：驗證者 1 error、10 warn；實作者另修 0 項

| 編號 | 等級 | 問題 | 裁決 |
|---|---|---|---|
| V-AFG-01 | error | Burst 軟鍵 Gate 位置 | 採納：p.121 原文確認 F2 Gate，已改控制列與選單列 |
| V-AFG-02 | warn | FREQ 單位軟鍵誤引 p.34 | 採納：改引 p.32（Hz=F3）與 p.61 截圖 |
| V-AFG-03 | warn | Trigger OUT 適用範圍矛盾 | 採納：function 改寫並新增 discrepancy |
| V-AFG-04 | warn | 幅度範圍標題「1 Hz–20 MHz」無來源 | 採納：改為「20 MHz 以下」 |
| V-AFG-05 | warn | Vmax 被寫成手冊公式的一部分 | 採納：標為 p.289 推定（OT+PD） |
| V-AFG-06 | warn | 把「Load 不在 UTIL」寫成事實 | 採納：改寫為衝突並新增 GAP-AFG-17 |
| V-AFG-07 | warn | SYM 預設與保留標成 OT | 採納：改 OT+PD，與 GAP-07／GAP-16 一致 |
| V-AFG-08 | warn | AFG-F06 驗收值 3.536 Vrms 會超出 10 Vpp | 採納：改驗收值為 3.535 Vrms，並明訂先捨入再檢查（PD） |
| V-AFG-09 | warn | 缺「換波形時 Vrms／dBm 保留何者」 | 採納：新增 GAP-AFG-18 |
| V-AFG-10 | warn | Preset 表不完整 | 採納：補齊 p.52–53 全表 |
| V-AFG-11 | warn | GAP-06 引用不足 | 採納：補 p.53、p.127，開機基本設定仍 UN |

**驗證者自述未核對：** 沒有逐頁讀完：MOD、Sweep、Burst、ARB 各章正文（p.66–108、p.110–119、p.122–126、p.128–131、p.149–181，只查了頂層軟鍵與 grep 行）；p.184–198 與 p.218–273 的其餘 SCPI 命令；p.282–287、p.293–305。照片座標只用目視與原圖抽查，沒有逐一量測像素。原廠下載網址與「Ver.B、2020-03-13」版本資訊沒有連網核對（網路封鎖），只核對了本地 hash 與 DOWNLOAD_SOURCES.json。01、05 只 grep 了 AFG、端子、descriptor 相關行。校機實際行為（CH1/CH2 鍵語義、Return 提交、旋鈕越界、High Z 顯示、開機記憶）無法由本次資料驗證，維持 UN。

### TDS2001C：驗證者 0 error、8 warn；實作者另修 2 項

| 編號 | 等級 | 問題 | 裁決 |
|---|---|---|---|
| L-TDS-01 | lead | 結構自檢：端子 ID 命名與「同…」來源 | 主控修正：CH1_INPUT/CH2_INPUT 改為 CH1_IN/CH2_IN；「同 X」展開為實際頁碼；PH 列補 P2 |
| V-TDS-01 | warn | 內插門檻用了通用句 | 採納：改標 OT+PD，補 p.110 誤植差異 |
| V-TDS-02 | warn | AutoSet 自動量測與 out_of_scope 矛盾 | 採納（選 b）：Mean／Cyc RMS 列 APPROX 有限例外，新增 TDS-F21，改寫 out_of_scope |
| V-TDS-03 | warn | AutoSet 化簡被寫成手冊事實 | 採納：化簡標 PD，specs 補 Display type |
| V-TDS-04 | warn | Stop 時觸發頻率讀值應持續更新 | 採納：F13／F14 加例外，驗收區分 Measure 欄與觸發頻率讀值 |
| V-TDS-05 | warn | 游標缺「通道需顯示」前提 | 採納：F17 加規則與反例 |
| V-TDS-06 | warn | 「10 div」標成 OT | 採納：改 OT+PD |
| V-TDS-07 | warn | 「無側選單」標成 OT | 採納：改 OT+PD+UN |
| V-TDS-08 | warn | LED 列 CORE 未宣告例外 | 採納（選 a）：維持 CORE，並把指示燈分類規則寫進讀法 |
| L-TDS-02 | lead | 電源鍵與後面板 USB 一致性；LCD 語言 | 主控：電源鍵改 APPROX（p.20 開機回復上次設定）；後面板 USB 改 OUT；新增 GAP-TDS-25（開機可選語言） |

**驗證者自述未核對：** 沒有逐頁重做 M-TDS-11 的圖頁像素比對與文字雜湊，只做全文 diff 與兩版頁碼偏移腳本，未逐一開 M-TDS-11 的 PDF 圖頁。沒有核對 pages_read 的閱讀紀錄是否屬實。沒有開 M-TDS-13 PDF 13–21、27、52–53、69–71、73–75、78–79、81–86、89–90、94–96、117–118、138–146、149–150、153–161；其中 FFT（p.55–62）、Video 範例、USB 細節、探棒附錄只抽看少數頁。p.32、p.36–37 的螢幕圖只看了文字抽取，沒有轉圖目視。Probe Comp 上片為訊號、下片為接地，只依照片與 p.9 面板圖的符號順序判斷，照片解析度不足以直接看出接片與符號的對應。照片中文貼字已在約 6–7 倍放大下核對，但原圖只有 768×1024，個別筆畫（例如『設置為零』的『置』）只能確認字形大致相符。GAP 的暫定值（例如 Auto 等待時間公式、25 px/div、游標步進）屬規劃推論，我只核對它們有標 PD，沒有評估數值是否合適。01、03（I03 以外）、05、06、07 與其他三台儀器的手冊不在本次範圍。

### GPE-4323：驗證者 0 error、9 warn；實作者另修 0 項

| 編號 | 等級 | 問題 | 裁決 |
|---|---|---|---|
| V-GPE-01 | warn | 端子寫成紅／黑／綠色接線柱 | 採納：改為白色端子帽＋色環 |
| V-GPE-02 | warn | LCD Set/Out 屬 GPE-1326 被寫成手冊明示 | 採納：改為推論（PD），Set 段亮法 UN |
| V-GPE-03 | warn | Lock 兩派原文不完整、低估 p.19 | 採納：兩派原文分列補齊，rationale 改為「p.27 是唯一有步驟的段落」 |
| V-GPE-04 | warn | 「右鍵彈起＝Independent」寫成手冊事實 | 採納：第四組合改標 PD |
| V-GPE-05 | warn | 缺 master/slave 原文與 p.37 vs p.38/40 衝突 | 採納：補引 p.11/p.37/p.41，新增 discrepancy |
| V-GPE-06 | warn | 缺「換模式時顯示通道」gap | 採納：新增 GAP-GPE-15（定案暫定：自動回 ①②） |
| V-GPE-07 | warn | 多個 gap 暫定規格仍有多選項 | 採納：GAP-01/02/05/09/10 各定一個值 |
| V-GPE-08 | warn | GAP-03 把 02 的話算成手冊 | 採納：改寫出處 |
| V-GPE-09 | warn | p.31 誤引 | 採納：改為原文 |

**驗證者自述未核對：** M-GPE p.21–24、28–30、35–39、41、43–49 只核對抽出的文字，沒有目視渲染圖（p.20 例外，看過）；p.33–34、36、40、42 以低解析度目視。照片座標只抽查旋鈕、按鍵、端子、圖例框、標頭（誤差約 ±10 px），沒有逐項精量藍帶的實際範圍（照片中只見約 x270–385 一段，其餘被端子遮住，data 以手冊範圍 x250–470 概略標示）。沒有驗證作者 pages_read 所列的自製裁切圖內容；規劃文件 05、06、07 只以 grep 檢查 GPE 相關列，沒有全文細讀。04 的原廠索引日期「F.,EN 2019-10-02」受網路封鎖無法外部核對，只核對了 DOWNLOAD_SOURCES.json 內容。需要實機才能判定的行為（Lock 實際範圍、Set View 返回時機、旋鈕步進與上限、開機記憶、模式鍵是否機械自鎖、CH3/CH4 CC 門檻、LCD 數字格式）本次無法驗證，只確認資料已誠實標為 UN／PD。

### 34460A：驗證者 2 error、12 warn；實作者另修 0 項

| 編號 | 等級 | 問題 | 裁決 |
|---|---|---|---|
| V-DMM-01 | error | 3 A 保險絲位置寫成未知 | 採納：主控放大 p.24 34460A 後面板照確認「Current Input 3.15A (500V)」在後面板 |
| V-DMM-02 | warn | 圓形件推論為保險絲座 | 採納：p.24 排除此推論，改以 10 A 位置封蓋推論（PD） |
| V-DMM-03 | error | data logging 被寫成機型欄證實不具備 | 採納：移出「DS 證實」清單，改為 UN＋範圍決策，新增 GAP-DMM-23 |
| V-DMM-04 | warn | 軟鍵標籤／LCD 版面標成 DS | 採納：降為 PD（行銷合成照），儀器外註明 |
| V-DMM-05 | warn | p.21 Overload ranging 被套到 DC 功能 | 採納：限縮為 AC 依據，DC 改引 p.24 並標 PD |
| V-DMM-06 | warn | Auto 落檔預期標成 DS | 採納：F02／F03／F06 加註依 GAP-DMM-05 暫定規則（PD） |
| V-DMM-07 | warn | 料號 34460-90901 無來源 | 採納：改註出處為本次 WebSearch（IX，sources.md §3.1） |
| V-DMM-08 | warn | Freq／Temp action 自相矛盾 | 採納：改為「按下（無次標籤）」 |
| V-DMM-09 | warn | Local 被當成 Shift 次功能 | 採納：移出次功能清單，只在 Shift 列註記 |
| V-DMM-10 | warn | 500 Vpk 漏引 p.22 | 採納：補引 p.22，證據 PH+DS+PD |
| V-DMM-11 | warn | 外部觸發漏寫 3446LANU 條件 | 採納：補 p.27 |
| V-DMM-12 | warn | Input HI 括號內容無來源 | 採納：括號內容標 PD |
| V-DMM-13 | warn | DCI 原文頁碼錯 | 採納：來源補 p.3 |
| V-DMM-14 | warn | 未記錄 IX 線索 | 採納：GAP-02／08／22 補 IX 線索，證據仍為 PD／UN |

**驗證者自述未核對：** 1) D-DMM PDF 13–20（34461A/34465A/34470A 規格頁）只用 grep 查了 ACAL、digitizing、1 µA、overrange、10 A 等關鍵字，沒有逐頁全文閱讀；p.5–10 行銷文字只粗讀。2) controls 的原圖像素座標只抽查主要項目（LCD、軟鍵、功能鍵、方向鍵、端子、圓／橢圓件），沒有逐一量測每個座標。3) 沒有下載或閱讀 WebSearch 找到的第三方 Operating and Service Guide 副本（依指示不下載），所以所有操作流程仍然無法以正文核對；IX 摘要只記為線索。4) 規劃文件只讀了 02、03（I00、I05、共用契約）、04、DOWNLOAD_SOURCES.json、PHOTO_ORIGINS.json；00、01、05、06、07 沒讀。5) 沒有核對作者 pages_read 自述的閱讀範圍是否屬實。6) P1 解析度有限（768×1024 手機衍生檔），極淡的印字（例如 Freq 上方可能有褪色的電容符號）無法百分之百排除；同樣光線下 Cont 上方的符號清楚可見，所以判定為沒有。7) 沒有驗證 DS 產品照的軟鍵列本身是否為合成（只確認數字畫面與 p.4 示意圖相同）。

合計：驗證者 3 個 error、39 個 warn，全部採納（逐條回原文或照片核對後才改）；實作者另外修正 2 項。沒有駁回任何一條。

## 3. 結構自檢

```text
$ node scripts/check-control-matrix.mjs
control-matrix: 190 rows in docs/control-matrix.md
  AFG: 46 (CORE=28 APPROX=2 OUT=13 STATIC=3)
  TDS: 53 (CORE=27 APPROX=3 OUT=11 STATIC=12)
  GPE: 47 (CORE=24 APPROX=5 OUT=4 STATIC=14)
  DMM: 44 (CORE=10 APPROX=2 OUT=16 STATIC=16)
OK: structure, IDs, codes, sources and photo-derived facts pass. This is NOT an instrument behaviour test.
(exit 0)
```

負向測試（`node scripts/check-control-matrix.test.mjs`）：把真正的矩陣刻意改壞，每一種都必須被擋下。

```text
✓ 刪掉一顆 GPE 旋鈕 → 硬性檢查失敗：GPE.KNOB.* 應正好是 {CH1_VOLTAGE, CH1_CURRENT, CH4_VOLTAGE, CH2_VOLTAGE, CH2_CURRENT, CH3_VOLTAGE}，實得 {CH1_VOLTAGE, CH1_CURRENT, CH4_VOLTAGE, CH2_VOLTAGE, CH2_CURRENT}
✓ GPE 旋鈕改成 CH3 電流旋鈕 → 硬性檢查失敗：GPE.KNOB.* 應正好是 {CH1_VOLTAGE, CH1_CURRENT, CH4_VOLTAGE, CH2_VOLTAGE, CH2_CURRENT, CH3_VOLTAGE}，實得 {CH1_VOLTAGE, CH1_CURRENT, CH4_VOLTAGE, CH2_VOLTAGE, CH2_CURRENT, CH3_CURRENT}
✓ GPE 端子順序對調 → 硬性檢查失敗：GPE.TERM.* 表內順序應依照片由左到右：CH4_POS → CH4_NEG → CH1_POS → CH1_NEG → GND → CH2_POS → CH2_NEG → CH3_POS → CH3_NEG
✓ 重複 ID → L191 TDS.KEY.AUTOSET: ID 與 L178 重複
✓ 刪掉 TDS CH2 選單鍵 → 硬性檢查失敗：缺少必要列 TDS.KEY.CH2_MENU
✓ 儀器前綴打錯 → L185 TDZ.KEY.HELP: ID 格式或儀器前綴不符
✓ 加入 10 A 端子 → 硬性檢查失敗：DMM.TERM.* 應正好是 {SENSE_HI, SENSE_LO, INPUT_HI, INPUT_LO, I_3A}，實得 {SENSE_HI, SENSE_LO, INPUT_HI, INPUT_LO, I_10A}
✓ 34460A 端子標籤寫 10 A → L571 DMM.TERM.I_3A: 34460A 端子標籤不可出現 10 A
✓ 非法狀態 → L540 DMM.KEY.NULL: 狀態「DONE」不合法
✓ 引用未取得的 M-DMM 當來源 → L540 DMM.KEY.NULL: 來源 ID「M-DMM」不在白名單（M-DMM 只能寫成「M-DMM 未取得」）
✓ CORE 列只有 PD 證據 → L99 AFG.KEY.PRESET: CORE 列至少要有 PH/OT/DS 證據
✓ TDS 出現 CH3 → 硬性檢查失敗：缺少必要列 TDS.TERM.EXT_TRIG
12/12 negative cases rejected as expected
(exit 0)
```

## 4. 完整性批評（兩個新 context 批評者）與第二輪修正

需求覆蓋批評者回報 10 條、一致性批評者回報 16 條（合計 must-fix 5、should-fix 21，兩者有重疊）。全部採納，合併成下列修正：

| 編號 | 等級 | 問題 | 修正 |
|---|---|---|---|
| R2-01 | must-fix | TDS 電源鍵兩套規格 | 統一為 APPROX：回復關機前設定、清除採集；改 out_of_scope、GAP-TDS-19、差異列與共通 0.1 |
| R2-03 | should-fix | Measure 可選類型三處不一致 | 選單列與 MEASURE 列改為 3 CORE＋2 APPROX＋11 OUT，與 TDS-F21 一致 |
| R2-04 | should-fix | 02 與 p.112 的偏離未記錄 | 新增差異列，寫明新舊行為、影響 I03-6 與理由 |
| R2-05 | should-fix | LCD 上的無來源字樣與共通規則衝突 | 共通規則改為三級；GAP-DMM-06 改中性記號、OPEN 列為 IX 級、Shift 指示移到儀器外、GPE「---」註明級別 |
| R2-08 | should-fix | 繁中手冊未查、GAP-TDS-25 會提供無來源中文 | 已 WebSearch（未找到）；刪除重複的 GAP-TDS-25 併入 GAP-TDS-01，不提供中文用語 |
| R2-09 | should-fix | A 版新聞稿的 VR 線索沒進 GAP-GPE-03 | 補 IX 線索與網址；暫定模型改為有端點的絕對角度旋鈕（PD） |
| R2-10 | should-fix | 共通規則說 GPE／34460A 手冊沒寫開機記憶；韌體列交叉引用不完整；蜂鳴器規則與導通提示音衝突 | 改寫三處 |
| R2-12 | should-fix | AutoSet s/div 規則有兩解；S2 游標容差未定 | 定為「至少 2 週期的最快檔」（1 kHz→250 µs/div）；游標驗收寫明時基與 ±10 µs |
| R2-13 | should-fix | TDS-F04 驗收方向寫反 | 已改 |
| R2-14 | should-fix | 多條驗收依賴未定的 fixture 參數 | 共通新增 0.4 節暫定參數表（PD），並改寫 DMM-F04／F05／F07、GPE-F09／F10、TDS-F08 驗收 |
| R2-15 | should-fix | GPE-F11 與 GAP-GPE-05 的開機模式矛盾 | 統一為兩模式鍵彈起，F11 補 V-set／I-set 值 |
| R2-16 | should-fix | OUT 鍵的 LCD 行為與共通規則不一致 | 共通規則寫明 LCD 不變；36 列 OUT 的可見回饋改寫為「模擬器／原廠」兩段；AFG-F15、out_of_scope 同步 |
| R2-17 | should-fix | FREQ 選單備註仍留誤引 | 改寫，只引 p.60、p.27、p.32、p.61 |
| R2-18 | should-fix | AFG-F04 驗收缺前提 | 加 Preset 前提與 10 Vpp 反例 |
| R2-20 | should-fix | TDS-F03 範圍沒乘探棒倍率 | 已改寫 |
| R2-02 | must-fix | 交接單指向不存在的 `I00-record.md` | 新增 `docs/reviews/I00-record.md`（待審 commit、檔案 SHA-256、I00-1～5 案例表） |
| R2-06 | should-fix | `sources.md` 沒有頁碼欄、IX 網址被截斷或缺漏 | §3 重寫：加頁碼欄，所有網址寫全，查不到的寫「URL 未記錄」 |
| R2-07 | should-fix | 把「不下載第三方副本」寫成規則；第三方網域沒實測 | 改寫為實作者決策（PD）並引用 04 原文；實測 batronix、docs.rs-online 等 6 個網域，全部 403 |
| R2-11 | should-fix | 檢查器只數數量、會放過錯誤矩陣 | 改為比對確切集合與照片順序、必要列、前綴、來源白名單；新增 12 個負向案例（第 3 節） |

**批評者自述未核對：**

- 需求覆蓋批評者：- **Photos:** I did not open or zoom into P1 or P2. Control positions, counts, labels and coordinates are taken from the implementer's JSON photo_checks.<br>- **Page citations:** I did not check every cited page line by line; I only spot-checked the quotes listed. I did not look at the rendered manual pages to confirm text-layer versus glyph differences, such as the TDS 500 ms default.<br>- **Web:** I did not open any IX or external URL, and made no web requests.<br>- **New commit:** I did not review docs/reviews/I00-selfcheck.md, which the new HEAD 5948b9f adds.<br>- **Other aspects:** I did not re-verify the numeric correctness of each spec item (for example the AFG 20–25 MHz boundary or the TDS horizontal-position table) or the design quality of individual provisional algorithms. This pass covered requirements coverage and internal consistency only.
- 一致性批評者：- 沒有開照片 P1、P2，面板座標、中文貼字、端子顏色都沒有目視核對。<br>- 沒有渲染任何 PDF 頁面，例如 AFG p.289 offset 準確度的字形是 10 mV 還是 20 mV、各頁截圖內容。<br>- 沒有逐條核對所有頁碼引用，只抽查 AFG p.32、34、288、289，TDS p.1、20、89、112，GPE p.42、45，D-DMM p.11、12、21。<br>- 沒有核對 menus 表中 GPE、DMM 各列相對手冊的完整性。<br>- pages_read 的自述閱讀範圍沒有驗證。<br>- 01、05 沒有讀；06、00 只讀到與 I00 相關的部分。<br>- sources.md 裡的官方網址、版次無法連網驗證（網域被封鎖）。<br>- I00-selfcheck.md 屬於 d2ab3a7 之後的 commit，只略讀，用來判斷問題的成因。<br>- AFG 非正弦 Vrms／dBm 公式、TDS Auto 等待時間公式這類 PD 數值是否合適，沒有評估，只檢查了是否自洽。

## 5. 仍然存在的限制（誠實列出）

- 所有核對都是對手冊文字與兩張照片；**沒有接觸任何校機**，也還沒有應用程式。
- 34460A 的操作手冊（M-DMM）沒有取得：軟鍵頁、Shift 流程、Null 保存策略、超量程字樣都是 PD／UN，只在 I05 以近似實作並標示。
- GPE Lock 的原廠說法互相矛盾，只能暫採 p.27 並標近似；GPE 旋鈕型式只有 IX 線索。
- 驗證者與批評者都是實作者派出的子代理；這份紀錄不是 06 要求的獨立 REVIEW。
