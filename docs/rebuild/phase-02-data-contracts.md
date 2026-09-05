# Phase-02 資料契約（Data Contracts）與 DB 對映

> 交付：2026-09-05（Phase-02，V3-U02-R1）
> 實作：`lib/stage-operation-contracts.ts`（typed contracts）、`lib/stage-operation-repository.ts`（持久化）
> DB：migration `0034_stage_operation_layer.up.sql`（隔離 PG15 已應用）

## 1. 契約清單（lib/stage-operation-contracts.ts）

| 契約 | 用途 |
|---|---|
| `RequirementIssue` | 單一需求缺失/衝突問題，含 deep-link 目的地 |
| `FieldLockRecord` | 欄位鎖定紀錄（樂觀鎖版本、政策、stale 狀態） |
| `StageReadinessSnapshot` | stage 就緒度總覽（blocking / non-blocking issues） |
| `StageCompletionSnapshot` | stage 完成快照（三態 + 交接欄位） |
| `TopicSelectionSnapshot` | 主題選擇交接快照（含 handoff 限制/下游需求/鎖清單） |
| `AssistPatch`（AssistPatchProposal / AssistApplyResult） | 輔助寫入提案與套用結果（衝突/政策拒絕狀態） |

輔助型別：`StageId`、`DataNature`、`AssistActionType`、`FieldPolicyRule`、`IssueStatus`、`RequirementIssueDestination`、`LockPolicy`。

## 2. RequirementIssue

```ts
{ issueId, projectId, stageId, requirementId, entityId, fieldRef,
  status, blocksTransition, message, expectedRevision?,
  destination: { routeId, tabId?, anchor?, fieldRef?, entityId? },
  assistActions[], requiresUserFact, returnContextId?, evaluatedAt }
```

- `status`：`MISSING | STALE | INVALID | CONFLICT | SATISFIED`。
- `destination.routeId` 為 deep-link 導航必填；`anchor` 為頁內錨點。

**DB 對映（requirement_issues）**：`id`（iss_ 前綴，gen_random_uuid）→ issueId；`requirement_id`→requirementId；`status` CHECK 五態與契約一致；`blocks_transition`→blocksTransition；`expected_revision`→expectedRevision；`destination jsonb`→destination；`assist_actions text[]`→assistActions；`requires_user_fact`→requiresUserFact；`return_context_id`→returnContextId；`evaluated_at`→evaluatedAt。唯一約束 `(workspace_id, project_id, stage_id, requirement_id, entity_id)`。

## 3. FieldLockRecord

```ts
{ id, workspaceId, projectId, stageId, entityId, fieldRef,
  lockedValue, lockVersion, lockedByUserId?, lockReason?,
  lockPolicy, sourceVersionId?, isStale, staleReason?, createdAt, updatedAt }
```

**DB 對映（field_locks）**：`id`（flk_ 前綴）；`entity_id` DEFAULT 'default'；`locked_value jsonb`→lockedValue；`lock_version int DEFAULT 1`→lockVersion（樂觀鎖，寫入時遞增）；`locked_by_user_id`→lockedByUserId；`lock_reason`→lockReason；`lock_policy` CHECK（MANUAL / AUTOMATION_POLICY / SYSTEM_ENFORCED）→lockPolicy；`source_version_id`→sourceVersionId；`is_stale`→isStale；`stale_reason`→staleReason。唯一約束 `(workspace_id, project_id, stage_id, entity_id, field_ref)`；索引 `(workspace_id, project_id, stage_id)`。

## 4. StageReadinessSnapshot

```ts
{ stageId, projectId, isReady, canProceed,
  totalRequirements, satisfiedRequirements,
  blockingIssues: RequirementIssue[], nonBlockingIssues: RequirementIssue[],
  nextStageId?, nextStageLabel?, evaluatedAt }
```

**DB 對映**：為計算/查詢結果，不直接落單表；`blockingIssues`/`nonBlockingIssues` 由 `requirement_issues` 依 `blocks_transition` 分組產生（design：分組方式以 repository/readiness 服務實作為準）。

## 5. StageCompletionSnapshot

```ts
{ id, workspaceId, projectId, stageId,
  status: "COMPLETED" | "HANDOFF_READY" | "SUPERSEDED",
  snapshotData, topicSnapshot?, lockManifest[], handoffLimitations[],
  downstreamOpenRequirements[], nextStageId?, createdByUserId?, idempotencyKey?, createdAt }
```

**DB 對映（stage_completion_snapshots）**：`id`（scs_ 前綴）；`status` CHECK 三態與契約一致；`snapshot_data jsonb`→snapshotData；`topic_snapshot jsonb`→topicSnapshot（可含完整 TopicSelectionSnapshot）；`lock_manifest jsonb DEFAULT '[]'`→lockManifest；`handoff_limitations jsonb DEFAULT '[]'`→handoffLimitations；`downstream_open_requirements jsonb DEFAULT '[]'`→downstreamOpenRequirements；`next_stage_id`→nextStageId；`created_by_user_id`→createdByUserId；`idempotency_key`→idempotencyKey；`created_at`→createdAt。唯一約束 `(workspace_id, project_id, stage_id, idempotency_key)`；索引 `(workspace_id, project_id, stage_id, created_at DESC)`。

## 6. TopicSelectionSnapshot

```ts
{ projectId, topicId, topicTitle, topicTitleEn?, conceptAbstract?,
  researchQuestion, gapStatement, methodologyOverview,
  targetPopulation?, expectedContribution, minimumViableStudy?,
  resourceRequirements?, knownLimitations[], assumptions[], risks[],
  literatureIds[], citationSourceIds[], sourceSnapshotIds[],
  selectedBy, selectionMethod: "MANUAL_ADOPTION" | "AUTO_SELECTED_DRAFT",
  selectedAt, handoffLimitations[], downstreamOpenRequirements[],
  lockManifest: { fieldRef, lockVersion }[] }
```

- `selectionMethod`：`MANUAL_ADOPTION`（人工採用既有候選）或 `AUTO_SELECTED_DRAFT`（自動選取草稿）。
- 交接三欄位：
  - `handoffLimitations`：交接到下游時已知限制。
  - `downstreamOpenRequirements`：下游仍需完成的開放需求。
  - `lockManifest`：隨主題交接的鎖定清單（fieldRef + lockVersion），下游據此延續鎖定語意。

**DB 對映**：不落獨立表；作為 `stage_completion_snapshots.topic_snapshot`（jsonb）內嵌；由 `GenericStageAdapter.buildTopicSelectionSnapshot` 建構（見 phase-02-integrated-scope-and-reuse.md 的 lib 清單）。

## 7. AssistPatch（AssistPatchProposal / AssistApplyResult）

```ts
// 提案
{ fieldRef, entityId?, baseRevision?, expectedLockRevision?,
  proposedValue, sourceRefs?, assumptions?, changeReason? }
// 結果
{ fieldRef, status: "APPLIED" | "CONFLICT_LOCKED" | "CONFLICT_STALE" | "POLICY_DENIED" | "FAILED",
  message, appliedValue?, newVersion? }
```

- 寫入路徑：提案 → 伺服端 `assertFieldWritePermitted`（比對 `expectedLockRevision` 與現行 `lock_version`）→ 通過才 APPLIED；版本不符→`CONFLICT_STALE`；已鎖定→`CONFLICT_LOCKED`；政策不允許→`POLICY_DENIED`。
- **DB 對映**：結果不落獨立表；成功 APPLIED 的寫入反映於 `field_locks.lock_version` 遞增與目標欄位值。sourceRefs/assumptions 由 FieldAssist 於產出時帶入（citation-affordance，見 field-assist-lock-policy.md）。

## 8. 驗證依據

- 三張表皆於 migration 0034 建立並於隔離 PG15 應用；220+ 表包含此三表。
- live 驗證（batch-a/b/c）通過；`tsc --noEmit` 0 errors。
- 未臆造任何測試計數或來源指紋；契約欄位對映以上述 migration SQL 與 contracts.ts 實際內容為準。