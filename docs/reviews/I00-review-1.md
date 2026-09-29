# I00 第一次獨立審查

**判決：REVIEW FAIL，回 I00 修正文檔後重審；先不進 I01。**

日期：2026-09-29。這次審查的是實際 GitHub 內容，不只是實作者的進度回報。問題集中在幾條互相矛盾的規格、無法達成的驗收，以及來源歸屬；不要求重做整包研究或擴充功能。

## 固定版本與審查界線

- Repository：https://github.com/sapunomin1-star/ee-ss
- 分支：`claude/new-session-24ecn6`
- 成品 commit：`c668ce316cf36f7ab4b62a256551a0dcbbc36802`
- 待審紀錄 commit／本次 HEAD：`9f8a0833b301e58313a50270a641d5b08a3582ab`
- 在隔離的本機 checkout 審查，未修改產品規格、未 commit、未 push、未開 PR、未合併 main。
- 本卡沒有應用程式，App／真 UI／離線 HTML 測試不適用。沒有接觸校機、韌體或探棒。
- 機型分別交由全新 context reviewer 核對，彙整者再查關鍵正文、跨文件規則、版本與可重建性。這些 reviewer 沒參與 Opus 的實作／自檢。

## 本次親自重跑的檢查

| 項目 | 結果 |
|---|---|
| 待審 HEAD、工作樹 | 指定 `9f8a0833…`，乾淨 |
| 成品與紀錄 commit 差異 | 只新增 `docs/reviews/I00-record.md`，117 行 |
| 紀錄列出的成品 SHA-256 | 17／17 相符 |
| `node scripts/check-control-matrix.mjs` | 190 列，exit 0 |
| `node scripts/check-control-matrix.test.mjs` | 12／12 刻意破壞案例遭拒，exit 0 |
| 重新 render 後 `git diff --exit-code -- docs/` | 完全一致，exit 0 |
| 三本主要操作手冊＋DMM datasheet＋兩張照片 | 6／6 SHA-256 與原交接來源一致 |
| 文件數值反例 | 負 dBm 換算、2 μs 游標格點已獨立計算 |

命令、環境、雜湊與完整輸出見同資料夾 `verification.json`、`verification.log`。結構檢查器驗不了語義是否正確，因此以上通過不抵銷下列問題。

原交接 ZIP 已不在先前桌面位置，本輪沒有重新執行整包 `verify_bundle.py`。改用先前下載的 AFG／GPE 原廠檔、重新從原廠取得且 hash 完全相同的 TDS／DMM PDF，以及使用者原照片核對。TDS 2011 副本的整份 diff、雲端網路封鎖與其 Linux／Playwright 環境仍屬實作者紀錄，未冒稱在本機重新驗證。

## 必改清單

### R1／P2：AFG 的正負號規則漏掉合法負 dBm

位置：[afg.json:317](https://github.com/sapunomin1-star/ee-ss/blob/9f8a0833b301e58313a50270a641d5b08a3582ab/docs/data/afg.json#L317)、第 319／324 行與 GAP-AFG-12；生成文件 `control-matrix.md:64`、`instrument-scope.md:147`。

目前 ± 的用途只列 Offset，並說不可負參數會在提交時拒絕。但 AMPL 的 dBm 已在核心功能中：Sine、50 Ω、1 kHz、零 offset 時，−10 dBm＝0.1 mW，Vrms≈0.07071 V，Vpp＝0.200 V，符合幅度限制。若照目前文字實作成「幅度不能負」，學生會無法輸入合法的低功率設定。

**來源：**M-AFG p.15、61–62、215、288；同檔既有 dBm 換算也支持此反例。

**最小修正：**同步 ± 控制、GAP-AFG-12、AMPL 輸入驗收：dBm 可以是負值或 0；合法性檢查依單位換算後的幅度及 offset／峰值限制決定。Vpp／Vrms 仍遵守自身正值與範圍規則。High Z 不接受 dBm。± 的精確實機提交語義仍可保留 PD。

**重審條件：**文件能一致描述由面板輸入 −10 dBm 後得到 0.200 Vpp 等效值；非法聯合峰值仍拒絕。I00 只需修規格與例子，不要求先寫 AFG App。

### R2／P2：S2 游標驗收要求不可表示的精確數值

位置：[tds.json:1513](https://github.com/sapunomin1-star/ee-ss/blob/9f8a0833b301e58313a50270a641d5b08a3582ab/docs/data/tds.json#L1513)、`common.json` 的 0.4 S2；生成文件 `instrument-scope.md:46`、`:198`；相關 GAP-TDS-15。

文件同時規定游標步進為 1/25 div，及在 50 μs/div 時「精確量到 125 μs」。此時步進為 2 μs，兩游標在同一格點系統上的差值也是 2 μs 的整數倍，最近是 124 或 126 μs；125 μs 不可精確表示。這會使遵守規格的實作被錯退，或迫使實作者偷偷跳過量化。

**最小修正（二選一）：**保留 50 μs/div 並使用有解析度依據的容差；或改成 25 μs/div、1 μs 步進，另把水平位置設到兩個對應交越點皆在畫面內。不能只把「精確」改成另一個仍無法達成的等值斷言。同步修改 common、TDS-F17 與生成文件，交代取樣／游標容差。

**來源界線：**手冊 p.110 的 1/25 div 是水平位置解析度，將同數值用作游標步進是本專案 PD；不能升格成原廠已確認的游標解析度。TDS-F17 的證據欄也要涵蓋這個 PD，不宜只列 OT。

### R3／P2：GPE 切模式時 CH3／CH4 的有效輸出規則互相矛盾

位置：[gpe.json:1142](https://github.com/sapunomin1-star/ee-ss/blob/9f8a0833b301e58313a50270a641d5b08a3582ab/docs/data/gpe.json#L1142)、第 1145 行，並核對 F07／F08 的相關句子；生成文件 `instrument-scope.md:347`。

GPE-F10 要求切換模式前後 CH3／CH4「設定與讀回不變」，但 F05／F06 和原廠 p.25 都明定切換模式會關閉全部 Output。「不參與 tracking」不能解讀成避開這個總關閉。

**文件反例：**CH3 設 5 V、100 Ω 負載、Output ON 時讀回約 0.050 A；切到 Series 後所有輸出應 OFF，不可仍宣稱 CH3 有相同有效輸出。LCD 若改顯示設定值，也要和讀回分開。

**最小修正：**設定值跨模式保留；切換當下四路全 OFF；重新 ON、同樣負載後，CH3／CH4 的讀回才與原先一致。同步 core rule／acceptance，補「ON→換模式→全 OFF→再 ON」的後續 UI 驗收步驟。

**來源：**M-GPE p.25 的總 Output／自動關閉，及 p.33、35 的 CH3／CH4 不參與 tracking。

### R4／P2：DMM Shift 指示位置有兩套互斥規格

位置：[dmm.json:1296](https://github.com/sapunomin1-star/ee-ss/blob/9f8a0833b301e58313a50270a641d5b08a3582ab/docs/data/dmm.json#L1296)、第 14 行，與第 350／1161 行衝突；生成文件 `control-matrix.md:507`、`instrument-scope.md:529`。

部分段落要求在 LCD 顯示 Shift，其他段落與共同規則要求只在儀器外提示。這會使 I05 實作與 reviewer 選到不同判定規則。P1 是暗螢幕，datasheet 也不足以確認該 LCD 指示。

**最小修正：**沿用已選定的「儀器外顯示 Shift 狀態」即可，同步兩處殘留 LCD 敘述並重產文件。不需為此補完整手冊，也不要求添加新功能。

### R5／P2：DMM 的 11 個 OUT 列把本專案提示誤稱原廠行為

位置：[dmm.json:222](https://github.com/sapunomin1-star/ee-ss/blob/9f8a0833b301e58313a50270a641d5b08a3582ab/docs/data/dmm.json#L222)、254、270、286、318、334、366、382、398、414、430；生成文件從 `control-matrix.md:535` 等列帶入。

文字寫「原廠：按下顯示『本輪未納入』說明」。這是模擬器的功能範圍提示，不能歸給原廠；其中有些列又明說原廠操作定義未取得。

**最小修正：**移除這 11 個錯誤原廠子句，或明寫原廠回饋未取得。保留目前一致的模擬器 OUT 行為：LCD／儀器狀態不變，在儀器外說明。檢查其他機型有沒有同樣歸屬錯誤；不必重寫所有控制列。

### R6／P2：GPE 模式鍵顯示行為的缺口描述漏讀正文

位置：[gpe.json:1336](https://github.com/sapunomin1-star/ee-ss/blob/9f8a0833b301e58313a50270a641d5b08a3582ab/docs/data/gpe.json#L1336) 的 GAP-GPE-15；生成文件 `instrument-scope.md:415`。

目前宣稱 p.18 Parallel/Series Keys 只說啟動 tracking、沒有顯示說明。然而同段還明寫相應通道會顯示在 LCD；這句並非只有 p.19 Set View 才有。

**最小修正：**補回 p.18 已確認的模式鍵顯示依據，把缺口限縮成真正未解之處，例如從③④是否兩列皆強制回①②、切回 Independent 如何顯示。這些精確細節仍可採清楚標示的 PD，不需改成「全部已證實」。

### R7／P2：AutoSet 的暫定演算法可能找不到任何合法刻度

位置：[tds.json:1717](https://github.com/sapunomin1-star/ee-ss/blob/9f8a0833b301e58313a50270a641d5b08a3582ab/docs/data/tds.json#L1717) 的 GAP-TDS-10，搭配第 1725 行 GAP-TDS-11；生成文件 `instrument-scope.md:294`、`:295`。

目前要求 AutoSet 選最小 V/div，使整個波形落在 ±4 div，同時又要求「垂直位置不改」，而位置以格數保存。合法反例：S2 的 2 Vpp、0 V DC 正弦、10× 探棒匹配，先把 Position 調成 +5 div。任何正的 V/div＝s 都會得到最高點 `5＋1/s > 4 div`；全部刻度都不能滿足規格。+5 div 本身在文件給定的合法位置範圍內，也不會靠切刻度自動夾回可視區。

這會使學生把波形移出畫面後，按核心恢復鍵 AutoSet 仍找不到符合規格的結果；與矩陣的可讀畫面要求及原廠 p.79 所述 AutoSet 目的矛盾。

**最小修正：**保留既有演算法，但新增明確 PD 後備規則：沒有可用刻度時，先將該通道 Position 歸零或合理置中，再選刻度。同步 AutoSet 核心規則與驗收，加入「S2→Position +5 div→AutoSet→波形回到可視區」案例。這不是要求還原廠商完整 AutoSet 演算法。

## 接受的來源修正，不要求改回舊規劃


1. **34460A 導通門檻 10 Ω：接受。**D-DMM p.21 明列固定門檻，可以把「門檻數值本身」從近似改為 DS。≤／<、提示聲設定、OPEN 分界、選單等不能因此全部升格；目前文件有分開，保留即可。
2. **TDS 停止時 trigger-frequency counter 仍可更新：接受。**M-TDS-13 p.112 明確涵蓋停止採集與 Single 完成後。只限獨立的觸發頻率讀值；波形與 Measure 欄仍基於原採集，且 counter 仍受可計數訊號條件限制。這是必要的精確化，不是凍結功能失效。
3. **GPE Lock 採 p.27 作明示近似：接受。**保留原廠段落差異；Output 不受鎖、解鎖關閉 Output 的規則已有依據。其餘未證實控制的鎖定行為仍是 PD。
4. **TDS 英文 LCD：可接受暫定。**不需等繁中手冊才能完成 I00；固定面板標籤仍照照片。儀器外的中文教學解釋可以標「教學翻譯」，不必把未知原廠中文用詞擴成禁止所有中文對照的全局限制。此點為非阻擋建議。

## I00 案例結論與下一步

| 案例 | 本次判定 |
|---|---|
| I00-1 機型、面板與數量 | 本次照片／手冊抽查及結構檢查相符 |
| I00-2 證據分級 | R5／R6 需修正 |
| I00-3 核心功能與未納入 | 核心覆蓋已有；R1／R3 語義需修正 |
| I00-4 暫定規格與驗收 | R2／R4／R7 需統一並改成可達成條件 |
| I00-5 版本、來源與環境 | 固定版本、17 個檔案 hash、6 份來源及本機文件工具已查；原雲端環境保留為實作者證據 |

只在 **I00** 修改 `docs/data/*.json` 的責任欄位並重新生成兩份文件，更新自檢／待審紀錄與新 commit/hash。保留完整來源及已核定範圍，不刪核心、不鬆掉驗收以掩蓋問題。

重審先逐項查 R1–R7，再跑既有結構／負向／重產檢查與受影響跨文件核對。這次不要求新增 App、I01 UI、接線引擎、完整 DMM 手冊或新一輪全面研究。修完再交全新 context reviewer；通過後才進 I01。
