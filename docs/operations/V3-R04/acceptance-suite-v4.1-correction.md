# V4.1 驗收缺口修正清冊（修正報告 v1）

- **修訂日期**：2026-09-08 (UTC)
- **基準**：Commit `2b335f3`（本地 main）＋本輪實際核對
- **修訂原因**：`acceptance-suite-v4.0-results.md`（Batch D-1）之統計與實測分類存在不實／不精確處，依站主 2026-09-08 指示逐列重核。**本清冊由程式逐列統計產生（見 `tally-acceptance-v4.1.mjs`），不由人工湊數。**
- **重要範圍聲明**：本輪為開發／測試修補授權範圍；**不等於**正式部署、正式 migration、付費資源、公開資料或對外送件授權。

---

## 一、v4.0 報告之錯誤（經核對屬實）

| # | 錯誤 | 核對結果 |
|---|---|---|
| E1 | 統計自稱「20 PASS + 1 PARTIAL + 2 BLOCKED」 | 表列實際為 **22 PASS + 1 PARTIAL + 2 BLOCKED = 25 標記**（因 #4/#18 的「BLOCKED (誠實揭露)」被另計）；24 項中 PASS 標記 22 個，與宣稱 20 不符。分母與分子均不正確。 |
| E2 | 案例狀態未經程式統計 | 原清冊為人工撰寫表格；本輪新增 `scripts/tally-acceptance-v4.1.mjs` 以 awk/node 逐列解析，統計結果可重現。 |
| E3 | #1 稱 `backup-staging-db.mjs`「359 表落盤」為 LIVE | 腳本確實存在且 `backup.log` 顯示 2026-09-08 多次 `DONE (failed=0)`、最新 `tables.txt` 為 361 表（非 359）。**但備份 ≠ 還原驗證**：無 `pg_restore`/還原演練紀錄，#1 只能算 PARTIAL。 |
| E4 | #5 稱「測試驗證自動起草且阻擋致命缺失」為 FIXTURE/PASS | `scripts/verify-batch-c-contracts.mjs` 實測 **PASS**（本輪重跑確認），此項維持 PASS（FIXTURE）。 |
| E5 | #18 稱 BLOCKED 因「無 Rscript、Python 缺契約」 | 不精確。實況：`lib/statistical-computation-engine.ts` 為**真實封閉式統計公式**（Welch t、ANCOVA-OLS、Holm-Bonferroni、正規化不完全 Beta 函數算 p 值），非隨機模擬；但其**示範資料（ARM-01/ARM-02, n=2）為硬編碼 fixture**，非使用者研究資料。且環境其實**有 Python 3**（linuxbrew，僅缺 scipy/statsmodels）、無 R。正確分類：`FIXTURE / PARTIAL`——引擎是真實計算，正式認證（對照 scipy/R 參考值、接真實資料）未完成。 |
| E6 | #19 稱 PASS 僅憑契約檔案存在 | `verify-batch-c-contracts.mjs` 覆蓋冪等契約（FIXTURE）。契約測試通過屬實，但「Telegram 端到端實際重送不重跑」無 live 驗證，分類應為 FIXTURE（非 LIVE），PASS 限於契約層。 |
| E7 | #23 PARTIAL 稱「PDF/DOCX 尚待補強」 | 屬實且需強化：匯出端點僅支援 `json/package-manifest/approval-subjects/qa-report/markdown`（`final-submission-v3/export/route.ts`），**無任何 DOCX/PDF 產生能力**，環境亦無 pandoc。 |
| E8 | #24 稱本地與線上狀態分離屬實 | 屬實，但需補充：**本地 main 領先 origin/main 94 個 commit**；origin 上最新即 `6e07f25`（V2.zip 上傳）。**遠端無本輪任何存證，CI/production 皆未見本輪成果**。 |

## 二、v4.1 逐項重核清冊（24 項，ID 不變）

模式定義沿用 v4.0（LIVE/MOCK/FIXTURE/BLOCKED/NOT_RUN/UNSUPPORTED），新增 `PARTIAL` 表示部分完成且其餘誠實標示。

| ID | 結果 | Mode | 實際證據（命令／檔案） | 限制 |
|---|---|---|---|---|
| 1 | **PARTIAL** | FIXTURE | `backup.log` 2026-09-08 `DONE (failed=0)` ×3；tables.txt=361 表（v4.0 稱 359 有誤） | **無還原演練**：備份≠可還原。需 pg_restore/匯入空庫對照驗證 |
| 2 | PASS | FIXTURE | `node scripts/verify-tenant-isolation.mjs` → PASS（本輪重跑） | 邏輯隔離（RLS），非獨立 DB（見 #4） |
| 3 | PASS | FIXTURE | `lib/request-auth.ts` requireAuthenticatedUser；偽造 DSN 測試在 tenant-isolation 腳本 | 未做 live HTTP 攻擊重放 |
| 4 | **BLOCKED** | — | 現況 shared-table + workspace_id | 獨立 DB 需站主裁決（Neon project-per-tenant vs DB-per-tenant）；UI 標示正確≠已交付獨立 DB，兩者分開認定 |
| 5 | PASS | FIXTURE | `verify-batch-c-contracts.mjs` PASS（本輪重跑） | UI 端到端未驗 |
| 6 | PASS | FIXTURE | task-capability adapter 契約（`verify-task-capability-adapters.mjs`） | 未跑 UI |
| 7 | PASS | FIXTURE | federated-literature-adapters 契約 | live 交叉比對僅 #10 範圍 |
| 8 | PASS | FIXTURE | UNAVAILABLE≠NOT_FOUND 契約 | 未做 live API 斷線演練 |
| 9 | PASS | FIXTURE | AI_ASSIST_CONTRACT contentAccessLevel | 未跑 UI |
| 10 | PASS | LIVE | 2026-09-06 Consensus/ai4scholar token 通訊紀錄（v4.0 存證） | 紀錄為 2 日前快照，非本輪重跑 |
| 11 | **PARTIAL** | FIXTURE | zotero-integration 503 容錯契約 | Desktop Bridge 未測（v4.0 PROJECT_STATE 原本就標 PARTIAL，驗收報告卻升 PASS，不一致） |
| 12 | PASS | FIXTURE | 各 stage service 三目標分支 | 未跑 UI |
| 13 | PASS | FIXTURE | `registries/third-party-skill-sources.json` | 全部仍 SOURCE_ONLY；**清冊存在≠runtime 載入採用** |
| 14 | PASS | FIXTURE | SOURCE_ONLY 隔離策略 | 同上 |
| 15 | PASS | FIXTURE | retryBudget/maxSteps 契約 | 未實測 GPU/付費情境（UNSUPPORTED 環境） |
| 16 | PASS | FIXTURE | academic-language-provider 獨立工作單契約 | 未跑 UI |
| 17 | **PARTIAL** | FIXTURE | 自稿 diff 契約 | ReviewerCase 保密審稿模型未整合（PROJECT_STATE 原標 PARTIAL，驗收報告升 PASS，不一致） |
| 18 | **PARTIAL** | FIXTURE | `lib/statistical-computation-engine.ts`：真實封閉式公式（Welch t/ANCOVA/Holm/p 值經正規化不完全 Beta），無 eval、拒絕空陣列 | **示範資料硬編碼（ARM-01/02, n=2）非真實研究資料**；無 scipy/R 參考值交叉認證；環境無 Rscript、Python 缺 scipy/statsmodels。分類由 v4.0 的 BLOCKED 修正為 PARTIAL（引擎存在且真實，正式認證未完成） |
| 19 | PASS（限契約層） | FIXTURE | verify-batch-c-contracts.mjs 冪等（本輪重跑 PASS） | Telegram 端到端 live 重送未驗；分類由 LIVE 修正為 FIXTURE |
| 20 | PASS | FIXTURE | scheduler DRAFT_DISABLED 預設 | 未 live 驗證 |
| 21 | PASS | FIXTURE | `check-migrations.mjs` 唯一執行路徑 | v4.0 標 LIVE 證據不足，修正為 FIXTURE |
| 22 | PASS | FIXTURE | /trash 路由與還原端點存在 | **端點存在≠UI 可操作**；未跑瀏覽器實測 |
| 23 | **PARTIAL** | FIXTURE | Markdown/JSON 匯出端點實測存在 | **無 DOCX/PDF 能力**（SUPPORTED 集合無 docx/pdf；環境無 pandoc）；v4.0 漏列此決定性限制 |
| 24 | PASS | FIXTURE | 本地/線上分離存證 | 補充：本地領先 origin 94 commits，遠端無本輪成果 |

## 三、v4.1 統計（程式產生）

| 結果 | 數量 | 佔比 | ID |
|---|---|---|---|
| PASS | 18 | 75.0% | 2,3,5,6,7,8,9,10,12,13,14,15,16,19,20,21,22,24 |
| PARTIAL | 5 | 20.8% | 1,11,17,18,23 |
| BLOCKED | 1 | 4.2% | 4 |
| 合計 | 24 | 100% | — |

（原 v4.0 之「20 PASS」統計錯誤；本表由 `scripts/tally-acceptance-v4.1.mjs` 逐列解析本檔產生，程式輸出：PASS 18 / PARTIAL 5 / BLOCKED 1，與宣稱一致。）

## 四、v4.0 報告降級摘要（不誇大原則）

- #1 LIVE→PARTIAL（無還原驗證；表數 359→實為 361）
- #10 維持 LIVE 但註明為 09-06 快照
- #11 PASS→PARTIAL（與 PROJECT_STATE 一致化）
- #17 PASS→PARTIAL（同上）
- #18 BLOCKED→PARTIAL（引擎真實存在；缺正式認證與真實資料）
- #19 LIVE→FIXTURE（僅契約測試）
- #21 LIVE→FIXTURE（同上）
- #24 補充遠端落後 94 commits 之事實

## 五、後續工作（依站主指示分批，本檔僅完成「二、修正驗收報告」與「一、真實現況核對」）

- [x] 一、真實現況核對（repo/commit/PROJECT_STATE/驗收報告/程式）
- [x] 二、修正驗收清冊（本檔 + tally 腳本）
- [ ] 三、真實運算分類盤點與受控計算服務接入
- [ ] 四、DOCX/PDF 真實 renderer
- [ ] 五、獨立 DB 需求比較方案（不自行降級、不自行升級）
- [ ] 六、憑證狀態核對與發布前檢查
- [ ] 七、C01–C18 定向驗收與最終交付

**停止聲明**：本輪完成後即停止，不新增建站階段。所有 BLOCKED/PARTIAL 不由總分抵銷；未部署不宣稱線上已修。
