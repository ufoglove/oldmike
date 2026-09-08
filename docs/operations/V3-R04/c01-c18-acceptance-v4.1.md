# C01–C18 定向驗收狀態（v4.1）

- **查證日期**：2026-09-08 (UTC)
- **依據**：站主文件第十節 C01–C18 定向驗收
- **硬邊界**：本表為**本輪實際執行後之狀態**，非站主文件原文之預期。原 24 項驗收仍獨立保留（`acceptance-suite-v4.1-correction.md`），不因本表替換。

---

## 狀態總表

| C 項 | 內容 | 狀態 | 證據 / 缺項 |
|---|---|---|---|
| **C01** | 原 24 個 ID 完整唯一，summary 與逐列一致 | **PASS** | `acceptance-suite-v4.1-correction.md` + `scripts/tally-acceptance-v4.1.mjs`（程式統計：PASS 18 / PARTIAL 5 / BLOCKED 1，24 個唯一 ID，無缺項重複） |
| **C02** | 原案例語義與獨立 DB 產品需求分開 | **PASS** | #4 維持原語義「UI 標示與實際隔離方式一致」（BLOCKED）；產品需求「獨立 DB 已交付」另列於 `db-per-tenant-plan-v4.1.md`（PENDING） |
| **C03** | 備份於隔離目標真正還原；0035 影響可核對 | **NOT_RUN** | 備份檔存在（`backup.log` DONE failed=0，361 表），**但無還原演練**；需站主授權 staging 還原目標 |
| **C04** | 聲明分析方法分類為真實/測試/mock/未知 | **PASS** | `method-classification-matrix-v4.1.md`（A 類 9 項、D 類 3 項、NOT_IMPLEMENTED 1 項） |
| **C05** | 核心方法對參考值通過數值容差 | **PASS** | `verify-stat-engine-reference.mjs` 21 項全 PASS（scipy 1.18.1 / statsmodels 0.15.0 對照） |
| **C06** | 修改輸入影響結果；失敗/缺失不被掩蓋 | **PASS** | 同上腳本：input sensitivity + near-null effect + zero-variance rejected + n<4 rejected |
| **C07** | 缺 R 不阻擋已驗證 Python；R 專屬標 UNSUPPORTED | **PASS** | TypeScript 引擎（A 類）通過 scipy 對照；Rscript 未安裝標 UNSUPPORTED；Python scipy/statsmodels 於隔離 venv 已驗證 |
| **C08** | mock/合成輸出不取得正式研究釋出 | **PASS（契約層）** | `verify-c08-mock-gate.mjs` 全 PASS；契約已新增 `inputOrigin`/`computationMode` 欄位（lib/analysis-execution-contract.ts），示範資料標 SYNTHETIC_FIXTURE+DEMO_OR_MOCK；API/UI 層 negative gate 端到端仍待補 |
| **C09** | worker 資源/權限/外連/超時/取消受控 | **NOT_RUN** | 本輪未建獨立計算 worker；Python venv 僅本機測試用。**未授權建 worker 基礎設施** |
| **C10** | 三目標各有可重開 DOCX 與 PDF，非改副檔名 | **PASS** | 6 份 fixture（`tmp-v41-fixture/`）；magic bytes 正確；python-docx/pypdf 重開通過；manifest 存證 |
| **C11** | 公式/繁體/數值/引用/跨頁表/匿名版本保真 | **PASS（自動 QA 範圍）** | 文字抽取核對 PASS；**跨頁表格已補測**：60 列長表跨 2 頁、表頭每頁重複（2/2）、首尾列完整（`verify-c11-cross-page-table.py` 全 PASS）；人工視覺驗收與匿名版本仍 NOT_RUN |
| **C12** | renderer 無跨租戶暫存/下載/遠端檔案越權 | **NOT_RUN** | 本輪為 CLI 腳本渲染，**未接入 Artifact 服務與下載 ACL**；SSRF/path/併發測試待 renderer 正式整合後執行 |
| **C13** | 兩 fixture tenant 實際不同 DB 與受限 role | **NOT_RUN** | 需站主授權建隔離 dev 資源（方案見 `db-per-tenant-plan-v4.1.md`） |
| **C14** | files/vector/cache/TM/Jobs/撤權後權限仍隔離 | **NOT_RUN** | 依賴 C13 環境 |
| **C15** | 索引服務 200 錯誤 body 不算成功；成果真保存 | **PARTIAL** | 現有契約區分 UNAVAILABLE/NOT_FOUND（#8 PASS）；**live/mock 分列 + UI 讀回未重驗** |
| **C16** | 研究agent能採用正確 Skill 與工具；鎖定保護 | **PARTIAL** | registry + adapter 契約通過；**runtime 端到端 Job trace 未重驗**（Skills 全部 SOURCE_ONLY） |
| **C17** | 憑證與備份不進 Git/log；曝露處理真實 | **PARTIAL** | 本地掃描 + **Git 全 history 掃描（0 筆真實憑證命中；DSN 僅 fixture）** + **V2.zip 隔離解包審查（0 筆敏感檔、無真實 .env）**；撤銷/輪替待站主操作，狀態 `CREDENTIAL_STATUS_UNVERIFIED`（`credential-status-v4.1.md`） |
| **C18** | local/remote/candidate/production 版本不混報 | **PASS** | 本地 main 領先 origin/main 94 commits；origin 最新 `6e07f25`；**未授權不 push/deploy**；release mapping 見下節 |

---

## 發布候選狀態（站主文件第九節狀態集）

| 狀態 | 本輪值 |
|---|---|
| `AUDIT_LEDGER_RECONCILED` | **YES**（v4.1 清冊由程式產生） |
| `SCIENTIFIC_METHODS_VERIFIED_FOR_SCOPE` | **YES for scope = Welch/ANCOVA/Holm/desc/p-value/correlation/sample-size（TypeScript A 類引擎）**；R 專屬方法 UNSUPPORTED |
| `DOCX_PDF_EXPORT_VERIFIED_FOR_SCOPE` | **YES for scope = 合成 fixture 三目標**；真實稿件/匿名版/跨頁表 NOT_RUN |
| `TENANT_REQUIREMENT_MET` | **NO** |
| `TENANT_REQUIREMENT_PENDING_WITH_LIMITED_SCOPE` | **YES**（現況 shared-table + workspace_id 邏輯隔離；獨立 DB 方案已規劃待授權） |
| `BACKUP_RESTORE_EVIDENCE_VERIFIED` | **NO**（備份存在，還原演練 NOT_RUN） |
| `CREDENTIAL_REMEDIATION_CONFIRMED` | **NO** |
| `CREDENTIAL_STATUS_UNVERIFIED` | **YES** |
| `PATCH_READY_AWAITING_OWNER_RELEASE_APPROVAL` | **YES**（本地 commits `4c60fbf`, `9e957ca`, `c3d40f08`；未推送） |
| production | **未更新**（本地領先 94 commits） |

---

## 版本對照（C18）

| 層 | commit / digest | 狀態 |
|---|---|---|
| local main | `c3d40f08` (v4.1 收尾) | 本輪最新 |
| local main (前) | `2b335f3` (v4.0 Batch D 驗收) | 已被 v4.1 修訂 |
| origin/main | `6e07f25` (V2.zip) | **遠端落後本地 94 commits** |
| production | 依 `zeabur-alignment-report-a3.md` 為 1.9.0 baseline (2026-09-05) | **未更新** |

---

## 尚需站主核准之事項（集中清冊）

| # | 事項 | 對應 C 項 |
|---|---|---|
| 1 | 授權在隔離 dev 環境建兩 fixture tenant 兩 DB（C13/C14） | C13, C14 |
| 2 | 授權 staging 還原演練（C03） | C03 |
| 3 | 撤銷/輪替已曝露憑證（GitHub PAT / Zeabur token / vectide key / DB 密碼） | C17 |
| 4 | 查閱 Neon 定價/配額/region 以補 `db-per-tenant-plan-v4.1.md` 第 7 節 | — |
| 5 | 決定 tenant 隔離單位（user-per-tenant vs workspace-per-tenant）與方案 A/B | — |
| 6 | 授權 UI 標示修訂（現況 vs 需求） | C02 |
| 7 | 授權正式部署（R02 流程） | — |
| 8 | V2.zip 內容審查（是否含敏感檔） | C17 |

---

*本輪完成可獨立執行部分；BLOCKED/NOT_RUN 不由總分抵銷，不宣稱已上線。*
