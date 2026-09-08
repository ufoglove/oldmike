# 能力矩陣 Capability Matrix — v4.0 整合規格 A-1

- 建立：2026-09-08 (UTC) | 依據：`02_OPENCLAW_IMPLEMENTATION_PROMPT---4.0` 第 2 節「現有能力清單：先證實，再接 UI」
- 原則：狀態逐項標註（configured / credential_scope_checked / operation_supported / connected / smoke_tested / workflow_bound / ui_bound / last_verified），不把多維度壓成 installed=true。
- 網站的正式 runtime 來源：`/home/node/dev/repo`（Next.js 16.3.1，package version 1.9.0，commit `992797b`，branch `maintenance/v3-r04-full`）。
- 本文件是**盤點證據**，不是「已安裝／已上線」宣稱；所有欄位只反映查證當下狀態。

## 狀態定義（沿用 v4.0 規格）

| 狀態 | 定義 |
|---|---|
| `configured` | 有程式碼路徑／設定入口，不一定可用 |
| `credential_scope_checked` | 憑證存在且有權限核對紀錄 |
| `operation_supported` | 該操作在契約層有定義 |
| `connected` | 實際連線成功（HTTP 2xx） |
| `smoke_tested` | 有真實非機密 smoke 執行證據 |
| `workflow_bound` | 已綁定到既有 Research Work Order / AgentJob |
| `ui_bound` | 前端 UI 已調用該能力 |
| `unknown / NOT_RUN / UNSUPPORTED / BLOCKED` | 依規格第 2 節明確分開 |

---

## 1. 文獻／引用 API（federated-literature-adapters.ts，快照 2026-09-06）

| Provider | search | metadata | citations | abstract | fulltext | write | 備註 |
|---|---|---|---|---|---|---|---|
| CONSENSUS | live_verified | live_verified | live_verified | documented (ABSTRACT only) | unsupported | unsupported | HTTP 200 2026-09-06；429 有 reset date；與 MCP 共用池 |
| AI4SCHOLAR | live_verified | live_verified | live_verified | unknown | unknown | unsupported | graph/v1 paper/search HTTP 200；credits plan B active 144/1906 |
| OPENALEX | configured | documented | documented | unknown (inverted index) | unsupported | unsupported | api.openalex.org/works |
| CROSSREF | (見 adapters) | documented | — | — | — | unsupported | allowlist 用於 FRESH_VERIFIED |
| SEMANTIC_SCHOLAR | (見 adapters) | — | — | — | — | unsupported | 依 AI4Scholar 聚合；未獨立 live 驗證 |

證據：`lib/federated-literature-adapters.ts` L22-160（capabilitySnapshots 含 response hash、樣本 fields、credits）。

## 2. 外部語言服務

| 能力 | 狀態 | 證據 |
|---|---|---|
| DeepL 客戶端 | `configured`（程式碼路徑存在）→ 是否有 key 需 `deepLConfigured()` 執行確認 | `lib/deepl-client.ts`；支援 :fx free suffix 判定；Translate/Write 分開 |
| 學術語言 provider | `workflow_bound`（U17） | `lib/academic-language-provider.ts` |
| Paperpal | 未在 repo 發現 client → `NOT_RUN` / `UNKNOWN` | 規格 §12 提及，repo 無對應 lib |

## 3. 寫作／計畫／審稿 provider

| 能力 | 狀態 | 證據 |
|---|---|---|
| research-generation-provider | workflow_bound | `lib/research-generation-provider.ts` |
| proposal-guidance-provider | workflow_bound | `lib/proposal-guidance-provider.ts` |
| review-studio-provider | workflow_bound | `lib/review-studio-provider.ts` |
| journal-submission-provider | workflow_bound | `lib/journal-submission-provider.ts` |
| research-ai-review | workflow_bound (U16) | `lib/research-ai-review.ts` |

## 4. 模型路由與 LLM

| 能力 | 狀態 | 證據 |
|---|---|---|
| model-route-catalog / model-mode-contract | documented | `lib/model-route-catalog.ts`、`lib/model-mode-contract.ts` |
| 外部模型鍵 | runtime env（OPENCLAW_BASE_URL、OPENCLAW_GATEWAY_TOKEN、OPENCLAW_MODEL、OPENCLAW_EXTERNAL_SEARCH） | 見 research-portal STATUS.md §2；值不回寫 |

## 5. Zotero

| 能力 | 狀態 | 證據 |
|---|---|---|
| Web API 整合（list / save / fulltext） | connected 條件式：需 `ZOTERO_API_KEY` + `ZOTERO_USER_ID`，缺則 503 `zotero_not_configured` | `lib/zotero-integration.ts` L146-151 |
| Desktop skill | 以 workspace `skills/claude-scholar/` 形態存在；**未驗證 runtime 載入** | 需 smoke 才可標 loaded |
| 綁定資料表 | `zotero-binding-repository.ts`（U01～U20 使用） | ✔ |

## 6. 排程／任務佇列

| 能力 | 狀態 | 證據 |
|---|---|---|
| AgentJob / scheduler runtime | workflow_bound + 契約測試存在（`test:scheduler-runtime:contract`） | `lib/agent-job-worker.ts`、`lib/agent-job-repository.ts` |
| 每日推薦排程 | 預設關閉（規格 §10）| 未發現啟用紀錄 → 保持關閉 |
| n8n | 存在於 Zeabur `OldMikeAutomation` 專案（STATUS.md）→ **未核對 license/credentials/用途** | `NOT_RUN` |

## 7. 資料層

| 能力 | 狀態 | 證據 |
|---|---|---|
| 正式 Postgres（tenant） | connected（staging 已達 migration 0035，本輪套用） | check-migrations：pending=0 |
| Neon `oldmike-automation-db` | 評估文件記載（新加坡區域）→ **未驗證是否為 app DSN** | `UNKNOWN` |
| tenant 隔離 | shared-table + workspace_id/RLS（TENANT_ISOLATION_MODEL.md）→ **非 literal database-per-tenant** | 規格 §7 需另提遷移方案 |
| artifact-request (0035) | connected + E2E PASS | scripts/verify-artifact-request-real.mjs |

## 8. Renderer / 匯出 / 計算引擎

| 能力 | 狀態 | 證據 |
|---|---|---|
| DOCX/PDF renderer | 未在 repo package.json 發現 docx/puppeteer/pdfkit → `UNKNOWN`（可能經 OpenClaw 端） | 需查證 |
| R | 環境無 `Rscript` | `NOT_RUN` |
| Python | 有 `/home/linuxbrew/.linuxbrew/bin/python3`（無 python 計算契約證據） | `UNKNOWN` |

## 9. 通知／Telegram

| 能力 | 狀態 | 證據 |
|---|---|---|
| Telegram 入口 | connected（本對話即經 Telegram；telegram:direct） | ✔ |
| 網站↔Telegram 同 job idempotency | 規格 §14/§16 要求；**目前未見雙端共用同一 work order 的實作證據** | `NOT_RUN` |
| 通知（Resend/Gmail/Calendar） | STATUS.md 提到 RESEND_API_KEY → 未 smoke | `NOT_RUN` |

## 10. OpenClaw runtime（本站 agent）

| 能力 | 狀態 | 證據 |
|---|---|---|
| OpenClaw agent runtime | connected（本 session） | agent=main |
| Workspace skills | 24 頂層；`auto-empirical/` 內含 77 個第三方子包 | 來源/授權逐項未完成 → 見 A-2 |
| Zeabur GraphQL `openClawSkills` | protocol mismatch → 不可用；skill 安裝走本機 skills/ | STATUS.md §3 |

## 11. 部署與版本

| 項目 | 證據 |
|---|---|
| repo 版本 | package 1.9.0；commit `992797b` |
| 部署版本 | STATUS.md 舊紀錄 v1.5.30（Zeabur ZIP，無 git 綁定） |
| 差異 | repo 領先部署；**未核對 Zeabur 現行 deployment commit/artifact** → A-3 |

---

## 已知缺口（對應 v4.0 24 案例）

| 缺口 | 對應案例 |
|---|---|
| 每 tenant literal DB（現為 shared-table+RLS） | #2, #3, #4 |
| AUTO_DRAFT_FINAL_REVIEW 模式未全面驗證（僅 generic-stage-adapter 有痕跡） | #5 |
| Zotero/Consensus live smoke 需在授權環境重跑 | #10, #11 |
| 網站↔Telegram 同一 job 冪等未見實作證據 | #19 |
| PDF/DOCX renderer、R/Python 計算契約未確認 | #18, #23 |
| 第三方 77 skill 包 license/commit/dependency 逐項未完成 | #13, #14 |

## 後續

- A-2：`registries/third-party-skill-sources.json`
- A-3：Zeabur 部署對齊調查（需 Zeabur token / 唯讀權限）
- A-4：PROJECT_STATE.md