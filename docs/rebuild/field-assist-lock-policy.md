# Field Assist 鎖定政策（FieldAssist Lock Policy）

> 交付：2026-09-05（Phase-02，V3-U02-R1）
> 規格來源：`docs/stage02/spec-v3-1.0.md`（FieldPolicy allowlist 概念）
> 實作：`lib/field-policy-service.ts`（`isFieldAiWritable`）、`lib/field-assist-service.ts`（FieldAssistService）、`lib/generic-stage-adapter.ts`（批次模式）
> 資料：`field_locks`（migration 0034）

## 1. AI FieldPolicy allowlist：AI 可寫什麼

每個欄位由 `FieldPolicyRule` 定義（見 phase-02-data-contracts.md），核心判定函式為 `isFieldAiWritable()`：

- **AI 可寫（aiWritable = true）**：該欄位允許 AI 產出內容，但仍須遵守下列約束：
  - `requiresUserFact`：需要使用者事實輸入的欄位，AI 只能在有上下文/來源時草擬，不得自造事實。
  - `requiresEvidence`：需要證據的欄位，AI 產出必須帶來源引用（citation-affordance），不可自由生成（free-gen）。
  - `allowedAssistActions`：白名單（EXPLAIN / DRAFT_FROM_CONTEXT / POLISH / VERIFY_SOURCE / BATCH_FILL / FIND_GAP / CRITIQUE），AI 只能執行清單內動作。
- **AI 不可寫（aiWritable = false）**：AI 完全不寫入，僅人工可寫（或系統審計寫入）。

## 2. AI 嚴禁捏造的事實（strictly-protected facts）

下列事實類別為「受保護事實」：AI 不得以任何形式生成或填充（無論 allowlist 為何）：

1. **IRB 核准編號**（IRB approval numbers）——必須為真實核發紀錄，AI 無權生成。
2. **p 值**（p-values）——必須來自真實統計計算；AI 不得「推測」或「補上」p 值。
3. **作者簽名**（author signatures）——身份/簽名類事實，須人工認證。
4. **樣本結果**（sample results）——未執行的結果不得寫入 Results（AGENTS.md gate：無可驗證資料不得撰寫虛構 Results）。
5. **已驗證趨勢計數**（verified trend counts）——真實外部計數未經認證前，不得聲稱已驗證（見 phase-02-search-and-metrics.md）。

實務落地（design，與 migration CHECK 約束一致）：上述事實以「requiresUserFact / requiresEvidence 強制」與「來源引用要求」雙重防護；若欄位 dataNature 為 `HUMAN_ATTESTATION` 或 `SOURCE_VERIFIED`，AI 產出路徑會被 `isFieldAiWritable` 拒絕或要求引用。

## 3. 鎖定類型（Lock Types）

`lock_policy` 三態（migration 0034 CHECK 約束強制）：

| 類型 | 語意 | 誰可解除 |
|---|---|---|
| `MANUAL` | 人工顯式鎖定（使用者主動鎖定某欄位值） | 人工 UNLOCK（或具權限的系統操作） |
| `AUTOMATION_POLICY` | 由自動化政策鎖定（例如批次填寫後依政策鎖定） | 政策允許時可覆寫；須經 `assertFieldWritePermitted` |
| `SYSTEM_ENFORCED` | 系統強制鎖定（例如受保護事實欄位） | 一般路徑不可寫；即使 AI 或普通批次亦不可覆寫 |

## 4. 批次自動化模式（Batch Automation Modes）

`GenericStageAdapter` 提供三種批次模式，共同鐵律：**絕不覆寫已鎖定（locked）或 readonly-protected 的欄位**。

1. `FILL_BLANKS`：僅填補空白欄位；已有值或已鎖定欄位一律跳過。
2. `OPTIMIZE_UNLOCKED`：僅優化「未鎖定」欄位；任何 lock_policy 非空的欄位不觸碰。
3. `FILL_AND_LOCK`：填補空白後，依政策對該欄位上鎖（AUTOMATION_POLICY）——上鎖動作本身須通過伺服端檢查，且不影響已鎖定欄位。

> 設計意圖（design，非測試主張）：三種模式皆先以 `isFieldAiWritable` + `assertFieldWritePermitted` 過濾候選欄位，故「已鎖定 / readonly」欄位在任何模式下皆不會被批次寫入。此為政策設計，具體行為以代碼與 live 驗證用例為準。

## 5. 引用來源（citation-affordance）

- 需要證據（`requiresEvidence`）的欄位：AI 產出須伴隨 `sourceRefs` / `citationSourceIds` 等來源引用結構（見 AssistPatchProposal 與 TopicSelectionSnapshot 的 citation 欄位），提供「可查證的引用途徑」，而非憑空生成。
- 未帶來源的 AI 產出不得以「已驗證」標記。

## 6. 驗證依據（FACTS ledger）

- 鎖定/版本/寫入檢查經 API `stage-operation`（LOCK / UNLOCK / CHECK_WRITE / HANDOFF）與 live 腳本（batch-a/b/c）在隔離 PG15 驗證通過；`tsc --noEmit` 0 errors。
- 本輪未對「AI 生成受保護事實」做惡意注入測試的逐一計數；政策約束屬設計與 migration CHECK 之組合，未聲稱超出已驗證範圍。