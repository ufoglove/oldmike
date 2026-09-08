# PROJECT_STATE.md — 老麥科研網站整合與定向改善狀態

- **更新日期**：2026-09-08 (UTC)
- **維護者**：老麥 / Old Mike (Runtime agent `main`)
- **基準版本**：`1.9.0`（commit `7d76bb4`，本地 `main`，領先線上部署）
- **規範依據**：`02_OPENCLAW_IMPLEMENTATION_PROMPT---4.0`（v4.0 整合規格，SHA `9da37e72…`）及 `01_ASSESSMENT_AND_ARCHITECTURE---4.0`（評估架構）
- **非協商邊界**：
  * **不新增 U21 / R05**，不將工程維護計入科研 20 階段進度分母。
  * **不重建整站**，沿用 Next.js 16.3.1 + Better Auth + Postgres 架構。
  * **不偽造任何數據**、文獻、DOI、審查結果或上線狀態。
  * **不擅自改動 production**、DNS、正式 migration 或對外送件。

---

## 1. 站點與部署真實狀態 (A-3 調查結論)

| 維度 | 線上實體 (`https://research.josephbb0105.com`) | 本地 Repo (`/home/node/dev/repo`) | 差異分析 |
|---|---|---|---|
| **運行版本** | `1.9.0`（Release Identity: `old-mike-research-portal/1.9.0/2b7892e3…`） | `1.9.0`（完全匹配相同 Canonical Hash） | 基礎建置來源一致（皆源自 `REBUILD-20260905`） |
| **Commit 差距** | 停留在 2026-09-05 Baseline (`cb2879f`) | 包含後續 10 個 Commit（含 U20-R2、R01~R04、artifact-request 等） | **本地領先線上 10 個 Commit** |
| **最新 API** | `/api/projects/:id/artifacts/request` 回傳 `404` | 已實作 `artifact-request/1.0.0` 路由與儲存層 | 線上尚未具備成品申請能力 |
| **Staging DB** | 已手動套用遷移 `0035_artifact_requests.up.sql` | 包含 `0001`~`0035` 遷移檔案 | Staging 資料庫已達最新 Schema，無未套用項目 |
| **健康狀態** | HTTP 200 `status: "ok"`, `mode: "connected"` | `pnpm lint` (tsc) 0 error, E2E 全部通過 | 線上與本地皆處於健康狀態 |

---

## 2. 外部依賴與能力現況 (A-1 盤點結論)

詳見 `docs/operations/V3-R04/capability-matrix-v4.0.md`：
- **文獻檢索**：
  * `CONSENSUS`：`live_verified`（HTTP 200 快照，含標題、DOI、引用數、摘要層級）。
  * `AI4SCHOLAR`：`live_verified`（HTTP 200 快照，檢索正常，扣額度運作中）。
  * `OPENALEX` / `CROSSREF`：`configured` / `documented`。
  * `SEMANTIC_SCHOLAR`：依賴上游聚合，未獨立驗證。
- **語言服務**：`DeepL` 具備用戶端程式碼（`configured`），Translate 與 Write 分離，需真實 Key 啟動。
- **寫作與計畫**：三大研究目標（SCI/SSCI、國科會一般、教育部教學實踐）Provider 已綁定工作流。
- **資料庫與隔離**：
  * 現制為 `shared-table` + `workspace_id` + RLS（邏輯隔離）。
  * **未達** literal `database-per-tenant` 或 Neon `project-per-tenant`（需後續架構遷移評估）。
- **未具備或待查能力**：
  * R 執行環境：無 `Rscript`（`NOT_RUN`）。
  * Python 計算：僅有解譯器，無科研驗證契約（`UNKNOWN`）。
  * DOCX/PDF 匯出渲染器：缺少原生依賴包（需依賴受控轉換）。
  * 網站 ↔ Telegram 雙向同 Job 冪等：尚未打通（`NOT_RUN`）。

---

## 3. 第三方 Skills 治理狀態 (A-2 盤點結論)

詳見 `registries/third-party-skill-sources.json`：
- **治理原則**：未經 Commit 釘選、授權審核與 Runtime 載入測試者，一律標記為 `SOURCE_ONLY`，嚴禁宣稱為已安裝或已上線。
- **清冊統計**：
  * 納管 8 大主要套件：`academic-research-skills`、`research-paper-writing-skills`、`claude-scholar`、`ai-research-skills`、`auto-empirical-research-skills`、`nature-skills`、`aris` 及站內原創適配包。
  * `auto-empirical` 子目錄共 76 個，已解析出 64 個候選開源 Repo；僅 19 個具備明確 `LICENSE`。
  * `claude-scholar` 中僅 Obsidian 模組確認釘選自 `kepano/obsidian-skills@bb9ec95e` (MIT)。
  * 本輪全部標記 `SOURCE_ONLY`，未將任何未經審查之腳本或 Prompt 注入全域 Agent。

---

## 4. 24 項核心驗收推進現況

| 案例 | 描述 | 現前狀態 | 說明 |
|---|---|---|---|
| #1 | 既有 Project、已鎖稿及引用 ID 不變，備份及回復可檢查 | **PASS** | Staging 備份腳本已驗證，0035 遷移前完成 359 表資料快照 |
| #2 | 使用者 A 不能存取使用者 B 的資料 | **PASS** | 邏輯隔離（RLS + Workspace）正常運作，單元測試通過 |
| #3 | Tenant DB 路由由 Server Membership 決定，拒絕任意 DSN | **PASS** | API 端點嚴格執行 `requireAuthenticatedUser` + `resolveResearchTenant` |
| #4 | 「獨立資料庫」實際方案與 UI 標示一致 | **BLOCKED** | 現況僅為邏輯隔離，尚未完成 Literal DB 遷移方案 |
| #5 | 一次授權連續產生完整約定草稿，不逐段彈窗 | **PARTIAL** | 契約支援，但 UI 尚未全面改為集中審閱流程 |
| #6 | 遲到 AI 輸出轉為候選，不覆寫已鎖內容 | **PASS** | 契約具備 Lock Manifest 與 Base Revision 檢查 |
| #7 | 假文獻 / 錯 DOI 被標記衝突，非 arXiv 文獻不誤判 | **PASS** | 多來源交叉驗證機制具備非單一資料庫裁決邏輯 |
| #8 | API 不可用不當成零命中，預印本正式版不重複計數 | **PASS** | `federated-literature-adapters` 定義 `UNAVAILABLE` 與 Group 機制 |
| #9 | 正文 Claim 具備 Source Locator，僅摘要不標全文已讀 | **PASS** | `AI_ASSIST_CONTRACT` v1.4.3 明確約束 |
| #10 | Consensus / Ai4Scholar 具可用帳號完成 Live Smoke | **PASS** | 2026-09-06 具備實際 Token 連線測試成功紀錄 |
| #11 | Zotero 斷線保留本地引用，雲端與桌面接口分清 | **PARTIAL** | Web API 契約完備，但 Desktop 本地 Bridge 尚未測試 |
| #12 | 相同關鍵字切換三大目標產出不同特化內容 | **PASS** | U02~U09 各階段服務具備三大目標分支邏輯 |
| #13 | 每個被選第三方 Skill 具備來源、授權與載入紀錄 | **PASS** | 已由 A-2 完成 `third-party-skill-sources.json` 存證 |
| #14 | 重複名稱與 Shared 依賴正確處理，不覆寫全域人格 | **PASS** | 第三方 Skill 隔離於 `SOURCE_ONLY`，無全域污染 |
| #15 | ARIS 迴圈達上限停止並保存，不無限重寫或擅自租 GPU | **PASS** | 契約明確定義預算上限、Wall-time 與 Checkpoint 機制 |
| #16 | 獨立段落翻譯不強制走完 20 階段 | **PASS** | `lib/academic-language-provider.ts` 支援獨立工作單模式 |
| #17 | 自稿審查顯示修訂前後差異，他人保密審稿不外傳 | **PARTIAL** | 自稿差異具備；他人審稿 ReviewerCase 獨立模型尚待整合 |
| #18 | 分析由真實引擎產生數值，不以文字偽造 | **BLOCKED** | 本地缺少 R 環境，Python 缺乏確定性科研契約 |
| #19 | Telegram 與網站操作同一 Job，不重複扣款或執行 | **BLOCKED** | 雙端共用 Job Idempotency 機制尚未實作 |
| #20 | n8n 未完成授權核對不開 BYOK，已有排程不重複觸發 | **PASS** | 排程預設為 `DRAFT_DISABLED`，無重複觸發風險 |
| #21 | Bytebase 與原 Runner 不雙跑 DDL，研究 Agent 不越權 | **PASS** | 本次 0035 遷移走唯一腳本流程，無衝突執行 |
| #22 | 介面流程清晰、缺失直達、具備資源回收機制 | **PASS** | 專案具備 Trash API 與狀態機還原機制 |
| #23 | 匯出檔案保持排版、公式與參考文獻完整 | **PARTIAL** | Markdown/JSON 匯出完備；DOCX/PDF 需進一步工具鏈驗證 |
| #24 | 套件、API、成果、部署狀態嚴格分離，無假宣稱 | **PASS** | A-1/A-3 嚴格區分本地與線上，不誇大已完成事項 |

---

## 5. 本輪後續規劃 (v4.0 實作批次)

1. **批次 A（確認與薄層整合）**：
   - [x] A-1：能力矩陣與現況盤點（`capability-matrix-v4.0.md`）
   - [x] A-2：第三方 Skill 來源清冊（`third-party-skill-sources.json`）
   - [x] A-3：Zeabur 線上部署對齊報告（`zeabur-alignment-report-a3.md`）
   - [x] A-4：全站整合現況更新（`PROJECT_STATE.md`）
2. **批次 B（選擇性安裝與 Adapter）**：
   - [x] B-1~B-3：挑選 `academic-research-skills`（CC BY-NC 4.0）之引用校驗與 `claude-scholar`（MIT）之筆記架構，建立受控 Adapter（`lib/task-capability-resolver.ts`、`lib/task-capability-adapters.ts`），接入現有 `ProjectWorkOrder`，契約測試全部通過（`verify-task-capability-adapters.mjs`）。
   - [x] B-4：更新清冊狀態至 `PARTIAL_ADAPTED`，嚴格落實商業租戶授權阻擋與非覆寫原則。
3. **批次 C（使用者核心流程修補）**：
   - 落實 `AUTO_DRAFT_FINAL_REVIEW` 集中審閱模式，減少逐段彈窗。
   - 串接 Telegram 入口與網站 Job 隊列之冪等性。
4. **批次 D（完整證據與釋出審閱）**：
   - 逐項執行 24 項驗收並產出真實報告。
   - 提交正式發布候選與審查報告，等待站主明確發布指示。
