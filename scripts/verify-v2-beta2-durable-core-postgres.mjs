import assert from "node:assert/strict";
import { Pool } from "pg";

import {
  V2_BETA2_CONTRACT_VERSION,
  beta2CanonicalJson,
  beta2Hash,
  createV2Beta2ConfirmedWorkspace,
  createV2Beta2ConfirmedWorkspacePayloadHash,
  createV2Beta2EventHash,
  createV2Beta2DurableSnapshot,
  createV2Beta2GenerationPayloadHash,
  createV2Beta2Material,
  createV2Beta2ReconciliationRequestHash,
  createV2Beta2ReceiptHash,
  createV2Beta2SelectionPayloadHash,
  createV2Beta2Source,
  createV2Beta2StageInstanceHash,
} from "../lib/v2-beta2/contracts.ts";
import { createV2Beta2Coordinator, V2Beta2SimulatedCrash } from "../lib/v2-beta2/coordinator.ts";
import { createDeterministicV2Beta2ProviderResult, DeterministicFakeV2Beta2Provider } from "../lib/v2-beta2/fake-provider.ts";
import { V2_BETA2_PROVIDER_PORT_VERSION } from "../lib/v2-beta2/provider-port.ts";
import { PostgresV2Beta2Repository, V2Beta2RepositoryError, validateV2Beta2DisposableDatabaseUrl } from "../lib/v2-beta2/repository.ts";
import { resolveResearchTenant } from "../lib/v2-beta2/tenant.ts";

if (process.env.DATABASE_URL !== undefined) throw new Error("beta2_ambient_database_url_forbidden");
const connectionString = validateV2Beta2DisposableDatabaseUrl(process.env.BETA2_DISPOSABLE_DATABASE_URL);
const pool = new Pool({ connectionString, max: 12 });
let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const ok = (actual, message) => { assertions += 1; assert.ok(actual, message); };
const context = (number) => ({ workspaceId: "beta2-workspace-01", projectId: `beta2-project-${String(number).padStart(2, "0")}`, userId: "beta2-user-01" });
const keyword = (suffix = "") => createV2Beta2Source({ entryMode: "KEYWORD", researchDirection: `生成式回饋的證據校準與高等教育自我調節學習${suffix}`, outputTarget: "SSCI", materials: [] });
const partial = createV2Beta2Source({ entryMode: "PARTIAL_MATERIAL", researchDirection: "整合生成式回饋材料檢驗證據校準與任務表現的作用機制", outputTarget: "SCI", materials: [
  createV2Beta2Material({ materialId: "beta2-abstract-01", kind: "ABSTRACT", title: "摘要", content: "  leading and trailing  " }),
  createV2Beta2Material({ materialId: "beta2-methods-01", kind: "METHODS", title: "方法", content: "LF\nline\n" }),
  createV2Beta2Material({ materialId: "beta2-results-01", kind: "RESULTS", title: "結果", content: "CRLF\r\nline\r\n" }),
  createV2Beta2Material({ materialId: "beta2-statistics-01", kind: "STATISTICS", title: "統計", content: "lone-CR\rline｜astral 😀｜combining e\u0301" }),
] });
const localProviderCapability = () => ({ portVersion: V2_BETA2_PROVIDER_PORT_VERSION, providerClass: "LOCAL_DETERMINISTIC_FIXTURE", submission: "AVAILABLE", lookup: "AVAILABLE", reasonCode: null });

async function requestFor(repository, projectNumber, source, suffix) {
  const tenant = context(projectNumber);
  const head = await repository.readProjectHead(tenant);
  return {
    tenant,
    request: {
      contractVersion: V2_BETA2_CONTRACT_VERSION,
      operation: "GENERATE_DURABLE_CORE",
      projectId: tenant.projectId,
      requestId: `beta2-request-${suffix}-0001`,
      idempotencyKey: `beta2-idempotency-${suffix}-0001`,
      baseRevision: head.revision,
      baseContentHash: head.contentHash,
      source,
    },
  };
}

async function rowCounts(projectId) {
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM beta2_generation_jobs WHERE project_id=$1) AS jobs,
    (SELECT count(*)::int FROM beta2_generation_receipts WHERE project_id=$1) AS receipts,
    (SELECT count(*)::int FROM beta2_project_snapshots WHERE project_id=$1) AS snapshots,
    (SELECT count(*)::int FROM beta2_project_events WHERE project_id=$1) AS events`, [projectId]);
  return result.rows[0];
}

async function truthAuthorityRows(projectId) {
  const [jobs, receipts, snapshots, events, intents] = await Promise.all([
    pool.query(`SELECT job_id,state,completion_class,provider_submission_count,provider_receipt_commitment,provider_result_hash,state_version
      FROM beta2_generation_jobs WHERE project_id=$1 ORDER BY job_id`, [projectId]),
    pool.query(`SELECT job_id,receipt_no,job_state_version,transition_xid,kind,completion_class,submission_count,provider_reference_commitment,result_hash,predecessor_receipt_hash,receipt_hash
      FROM beta2_generation_receipts WHERE project_id=$1 ORDER BY job_id,receipt_no`, [projectId]),
    pool.query(`SELECT revision,content_hash,source_job_id FROM beta2_project_snapshots WHERE project_id=$1 ORDER BY revision`, [projectId]),
    pool.query(`SELECT sequence,event_type,operation,idempotency_key,job_id,request_id,request_hash,from_revision,to_revision,snapshot_revision,predecessor_event_hash,event_hash
      FROM beta2_project_events WHERE project_id=$1 ORDER BY sequence`, [projectId]),
    pool.query(`SELECT operation,idempotency_key,request_id,request_hash,status,committed_revision,committed_content_hash,committed_event_hash,committed_response_authority
      FROM beta2_operation_intents WHERE project_id=$1 ORDER BY operation,request_id`, [projectId]),
  ]);
  return { jobs: jobs.rows, receipts: receipts.rows, snapshots: snapshots.rows, events: events.rows, intents: intents.rows };
}

async function rejectsWithoutTruthDelta(projectId, operation, expectedReason) {
  const before = await truthAuthorityRows(projectId);
  const reason = await operation().then(() => null, (error) => String(error?.message ?? error));
  equal(reason?.includes(expectedReason), true, `${expectedReason} rejected by exact database authority`);
  equal(await truthAuthorityRows(projectId), before, `${expectedReason} rejection is atomic with zero job receipt snapshot event delta`);
}

function selectionSuccessor(head, selectedDirectionId) {
  if (!head.snapshot) throw new Error("beta2_test_snapshot_required");
  return createV2Beta2DurableSnapshot({
    projectId: head.projectId,
    revision: head.revision + 1,
    source: head.snapshot.source,
    directions: head.snapshot.directions,
    recommendedDirectionId: head.snapshot.recommendedDirectionId,
    selectedDirectionId,
    stageId: head.snapshot.stageId,
    stageInstanceHash: head.snapshot.stageInstanceHash,
    jobId: head.snapshot.jobId,
    persistenceStatus: "SAVED",
  });
}

async function callSelectionCapability(tenant, request, snapshot, overrides = {}) {
  return pool.query(
    `SELECT out_replayed AS replayed FROM old_mike_beta2_private.save_direction_selection(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
    [tenant.workspaceId, tenant.projectId, tenant.userId, request.requestId, request.idempotencyKey,
      overrides.requestHash ?? createV2Beta2SelectionPayloadHash(request), overrides.revision ?? snapshot.revision,
      overrides.contentHash ?? snapshot.contentHash, overrides.schemaId ?? snapshot.schemaId,
      beta2CanonicalJson(overrides.payload ?? snapshot), overrides.sourceJobId ?? snapshot.jobId],
  );
}

function confirmedWorkspaceSuccessor(head, request) {
  if (!head.snapshot) throw new Error("beta2_test_snapshot_required");
  const selected = head.snapshot.directions.find((direction) => direction.directionId === request.selectedDirectionId);
  if (!selected) throw new Error("beta2_test_selected_direction_required");
  const confirmedWorkspace = createV2Beta2ConfirmedWorkspace({
    selectedDirectionId: request.selectedDirectionId,
    s0: request.s0Summary,
    appliedAssistOptionIds: request.appliedAssistOptionIds,
  }, selected);
  return createV2Beta2DurableSnapshot({
    projectId: head.projectId,
    revision: head.revision + 1,
    source: head.snapshot.source,
    directions: head.snapshot.directions,
    recommendedDirectionId: head.snapshot.recommendedDirectionId,
    selectedDirectionId: head.snapshot.selectedDirectionId,
    confirmedWorkspace,
    stageId: head.snapshot.stageId,
    stageInstanceHash: head.snapshot.stageInstanceHash,
    jobId: head.snapshot.jobId,
    persistenceStatus: "SAVED",
  });
}

async function callConfirmedWorkspaceCapability(tenant, request, snapshot, overrides = {}) {
  return pool.query(
    `SELECT out_replayed AS replayed FROM old_mike_beta2_private.save_confirmed_workspace(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb,$14::jsonb)`,
    [tenant.workspaceId, tenant.projectId, tenant.userId, request.requestId, request.idempotencyKey,
      overrides.requestHash ?? createV2Beta2ConfirmedWorkspacePayloadHash(request), overrides.revision ?? snapshot.revision,
      overrides.contentHash ?? snapshot.contentHash, overrides.schemaId ?? snapshot.schemaId,
      beta2CanonicalJson(overrides.payload ?? snapshot), overrides.sourceJobId ?? snapshot.jobId,
      request.selectedDirectionId, beta2CanonicalJson(overrides.s0Summary ?? request.s0Summary),
      beta2CanonicalJson(overrides.appliedAssistOptionIds ?? request.appliedAssistOptionIds)],
  );
}

try {
  const repository = new PostgresV2Beta2Repository(pool);
  equal((await resolveResearchTenant(pool, "beta2-user-01", "beta2-project-01"))?.workspaceId, "beta2-workspace-01", "existing user resolves exact active project");
  equal(await resolveResearchTenant(pool, "beta2-user-other", "beta2-project-01"), null, "tenant swap rejected");
  equal(await resolveResearchTenant(pool, "beta2-user-01", "beta2-project-other"), null, "project swap rejected");
  equal(await resolveResearchTenant(pool, "beta2-user-01", "beta2-project-inactive"), null, "legacy inactive project rejected");

  const basicProvider = new DeterministicFakeV2Beta2Provider();
  const basicCoordinator = createV2Beta2Coordinator({ repository, provider: basicProvider });
  const basic = await requestFor(repository, 1, keyword(), "basic");
  const generated = await basicCoordinator.generate(basic.tenant, basic.request);
  equal(generated.providerSubmissionDelta, 1, "one provider submission");
  equal(generated.snapshotAppendDelta, 1, "one snapshot append");
  equal(generated.eventAppendDelta, 1, "one event append");
  equal(generated.head.revision, 1, "revision advanced once");
  equal(generated.head.snapshot?.directions.length, 3, "three durable directions");
  equal(generated.head.stageOutcome?.status, "COMPLETE", "generation completion is retained as exact durable stage outcome");
  equal(generated.head.stageOutcome?.terminalEvent?.eventType, "GENERATION_COMPLETE", "generation terminal event type is retained");
  equal(generated.head.stageOutcome?.terminalEvent?.requestHash, createV2Beta2GenerationPayloadHash(basic.request), "generation terminal request hash is retained");
  equal(generated.head.snapshot?.directions.filter((item) => item.recommended).length, 1, "one recommendation");
  equal(generated.head.snapshot?.directions.every((item) => Object.keys(item.s0).length === 13), true, "thirteen S0 fields per direction");
  const replay = await basicCoordinator.generate(basic.tenant, basic.request);
  equal(replay.replayed, true, "same request replays original");
  equal(replay.providerSubmissionDelta, 0, "replay has zero provider delta");
  equal(basicProvider.submissionCount, 1, "provider called exactly once after replay");
  equal(await rowCounts(basic.tenant.projectId), { jobs: 1, receipts: 3, snapshots: 1, events: 1 }, "replay appends nothing");
  equal((await new PostgresV2Beta2Repository(pool).readProjectHead(basic.tenant)).stageOutcome, generated.head.stageOutcome, "fresh repository session resumes the exact complete stage outcome");
  const generationSuccessReconciliation = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: basic.tenant.projectId, requestId: "beta2-reconcile-generation-0001", jobId: generated.head.snapshot.jobId };
  await rejectsWithoutTruthDelta(basic.tenant.projectId, () => basicCoordinator.reconcile(basic.tenant, generationSuccessReconciliation), "beta2_reconciliation_not_available");
  equal(basicProvider.lookupCount, 0, "generation-success reconciliation rejects before provider lookup");
  const basicReceipts = await pool.query(`SELECT workspace_id AS "workspaceId", project_id AS "projectId", job_id AS "jobId",
    receipt_no AS "receiptNo", job_state_version AS "jobStateVersion", transition_xid AS "transitionXid", kind,
    completion_class AS "completionClass", submission_count AS "submissionCount",
    provider_reference_commitment AS "providerReferenceCommitment", result_hash AS "resultHash",
    predecessor_receipt_hash AS "predecessorReceiptHash", receipt_hash AS "receiptHash"
    FROM beta2_generation_receipts WHERE workspace_id=$1 AND project_id=$2 ORDER BY receipt_no`, [basic.tenant.workspaceId, basic.tenant.projectId]);
  equal(basicReceipts.rows.map((row) => Number(row.receiptNo)), [1, 2, 3], "receipt sequence is exact and non-skippable");
  equal(basicReceipts.rows.map((row) => Number(row.jobStateVersion)), [1, 2, 3], "every job state version has one matching receipt");
  equal(new Set(basicReceipts.rows.map((row) => String(row.transitionXid))).size, 3, "each state transition commits in a distinct transaction");
  for (const row of basicReceipts.rows) {
    equal(row.receiptHash, createV2Beta2ReceiptHash({
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      jobId: row.jobId,
      receiptNo: Number(row.receiptNo),
      jobStateVersion: Number(row.jobStateVersion),
      kind: row.kind,
      completionClass: row.completionClass,
      submissionCount: Number(row.submissionCount),
      providerReferenceCommitment: row.providerReferenceCommitment,
      resultHash: row.resultHash,
      predecessorReceiptHash: row.predecessorReceiptHash,
    }), `database and TypeScript receipt hash parity ${row.receiptNo}`);
  }
  const basicEvents = await pool.query(`SELECT workspace_id AS "workspaceId", project_id AS "projectId", sequence,
    event_type AS "eventType", operation, idempotency_key AS "idempotencyKey", job_id AS "jobId",
    request_id AS "requestId", request_hash AS "requestHash", from_revision AS "fromRevision",
    to_revision AS "toRevision", snapshot_revision AS "snapshotRevision",
    predecessor_event_hash AS "predecessorEventHash", event_hash AS "eventHash"
    FROM beta2_project_events WHERE workspace_id=$1 AND project_id=$2 ORDER BY sequence`, [basic.tenant.workspaceId, basic.tenant.projectId]);
  for (const row of basicEvents.rows) {
    equal(row.eventHash, createV2Beta2EventHash({
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      sequence: Number(row.sequence),
      eventType: row.eventType,
      operation: row.operation,
      idempotencyKey: row.idempotencyKey,
      jobId: row.jobId,
      requestId: row.requestId,
      requestHash: row.requestHash,
      fromRevision: Number(row.fromRevision),
      toRevision: Number(row.toRevision),
      snapshotRevision: row.snapshotRevision === null ? null : Number(row.snapshotRevision),
      predecessorEventHash: row.predecessorEventHash,
    }), `database and TypeScript event hash parity ${row.sequence}`);
  }

  await assert.rejects(() => basicCoordinator.generate(basic.tenant, { ...basic.request, source: keyword("不同內容") }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  await assert.rejects(() => basicCoordinator.generate(basic.tenant, { ...basic.request, requestId: "beta2-request-new-key-0001", idempotencyKey: "beta2-idempotency-new-key-0001" }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  equal(await rowCounts(basic.tenant.projectId), { jobs: 1, receipts: 3, snapshots: 1, events: 1 }, "rotated generation authority conflicts and appends nothing");
  equal(basicProvider.submissionCount, 1, "conflicts never call provider");

  const selectedDirectionId = generated.head.snapshot.directions[2].directionId;
  const crossOperationSelection = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: basic.tenant.projectId, requestId: "beta2-selection-cross-operation-0001", idempotencyKey: basic.request.idempotencyKey, baseRevision: generated.head.revision, baseContentHash: generated.head.contentHash, selectedDirectionId };
  await assert.rejects(() => basicCoordinator.saveSelection(basic.tenant, crossOperationSelection), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  await assert.rejects(() => basicCoordinator.saveSelection(basic.tenant, { ...crossOperationSelection, idempotencyKey: "beta2-selection-cross-operation-key-0001", requestId: basic.request.requestId }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  equal(await rowCounts(basic.tenant.projectId), { jobs: 1, receipts: 3, snapshots: 1, events: 1 }, "project-global key and requestId conflicts append no truth");
  const selection = await basicCoordinator.saveSelection(basic.tenant, { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: basic.tenant.projectId, requestId: "beta2-selection-basic-0001", idempotencyKey: "beta2-selection-key-0001", baseRevision: generated.head.revision, baseContentHash: generated.head.contentHash, selectedDirectionId });
  equal(selection.head.revision, 2, "selection creates one snapshot revision");
  equal(selection.head.snapshot?.selectedDirectionId, selectedDirectionId, "selection is durable");
  equal(selection.providerSubmissionDelta, 0, "selection never calls provider");
  equal(basicProvider.submissionCount, 1, "selection provider count unchanged");
  const selectionReplay = await basicCoordinator.saveSelection(basic.tenant, { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: basic.tenant.projectId, requestId: "beta2-selection-basic-0001", idempotencyKey: "beta2-selection-key-0001", baseRevision: generated.head.revision, baseContentHash: generated.head.contentHash, selectedDirectionId });
  equal(selectionReplay.replayed, true, "selection exact replay is idempotent");
  equal(selectionReplay.snapshotAppendDelta, 0, "selection replay appends zero snapshots");
  await assert.rejects(() => basicCoordinator.saveSelection(basic.tenant, { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: basic.tenant.projectId, requestId: "beta2-selection-basic-0001", idempotencyKey: "beta2-selection-key-0001", baseRevision: generated.head.revision, baseContentHash: generated.head.contentHash, selectedDirectionId: generated.head.snapshot.directions[0].directionId }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  await assert.rejects(() => basicCoordinator.saveSelection(basic.tenant, { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: basic.tenant.projectId, requestId: "beta2-selection-basic-0001", idempotencyKey: "beta2-selection-key-other-0001", baseRevision: generated.head.revision, baseContentHash: generated.head.contentHash, selectedDirectionId }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  const currentSelectionHead = await repository.readProjectHead(basic.tenant);
  const directSelectionRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: basic.tenant.projectId, requestId: "beta2-selection-direct-tamper-0001", idempotencyKey: "beta2-selection-direct-tamper-key-0001", baseRevision: currentSelectionHead.revision, baseContentHash: currentSelectionHead.contentHash, selectedDirectionId: currentSelectionHead.snapshot.directions[0].directionId };
  const directSelectionSnapshot = selectionSuccessor(currentSelectionHead, directSelectionRequest.selectedDirectionId);
  const tamperedSelectionCore = structuredClone(directSelectionSnapshot);
  tamperedSelectionCore.s0Summary.workingTitle = "caller-coordinated unauthorized projection";
  delete tamperedSelectionCore.contentHash;
  const coordinatedTamperedSnapshot = { ...tamperedSelectionCore, contentHash: beta2Hash(tamperedSelectionCore) };
  await rejectsWithoutTruthDelta(basic.tenant.projectId, () => callSelectionCapability(basic.tenant, directSelectionRequest, directSelectionSnapshot, { payload: coordinatedTamperedSnapshot, contentHash: coordinatedTamperedSnapshot.contentHash }), "beta2_selection_authority_invalid");
  await rejectsWithoutTruthDelta(basic.tenant.projectId, () => callSelectionCapability(basic.tenant, directSelectionRequest, directSelectionSnapshot, { requestHash: "0".repeat(64) }), "beta2_selection_authority_invalid");
  const reopenedRepository = new PostgresV2Beta2Repository(new Pool({ connectionString, max: 2 }));
  const reopened = await reopenedRepository.readProjectHead(basic.tenant);
  equal(reopened.contentHash, selection.head.contentHash, "new pool resumes exact snapshot");
  await reopenedRepository.pool.end();

  const partialProvider = new DeterministicFakeV2Beta2Provider();
  const partialCoordinator = createV2Beta2Coordinator({ repository, provider: partialProvider });
  const blankMaterialRequest = await requestFor(repository, 25, partial, "blank-material-db");
  const blankPayload = structuredClone(blankMaterialRequest.request);
  blankPayload.source.materials[0].content = "\u3000";
  blankPayload.source.materials[0].contentByteLength = new TextEncoder().encode(blankPayload.source.materials[0].content).byteLength;
  blankPayload.source.materials[0].contentHash = beta2Hash(blankPayload.source.materials[0].content);
  const blankSourceCore = structuredClone(blankPayload.source);
  delete blankSourceCore.sourceHash;
  blankPayload.source.sourceHash = beta2Hash(blankSourceCore);
  const blankStageHash = createV2Beta2StageInstanceHash({ workspaceId: blankMaterialRequest.tenant.workspaceId, projectId: blankMaterialRequest.tenant.projectId, baseRevision: blankPayload.baseRevision, baseContentHash: blankPayload.baseContentHash });
  await rejectsWithoutTruthDelta(blankMaterialRequest.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.reserve_generation_intent($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
    [blankMaterialRequest.tenant.workspaceId, blankMaterialRequest.tenant.projectId, blankMaterialRequest.tenant.userId, blankStageHash,
      blankPayload.idempotencyKey, blankPayload.requestId, "a".repeat(64), blankPayload.baseRevision, blankPayload.source.sourceHash, beta2CanonicalJson(blankPayload)],
  ), "beta2_job_request_authority_invalid");
  const partialRequest = await requestFor(repository, 2, partial, "partial");
  const partialResult = await partialCoordinator.generate(partialRequest.tenant, partialRequest.request);
  equal(partialResult.head.snapshot?.source.materials.map((item) => item.contentHash), partial.materials.map((item) => item.contentHash), "partial material byte hashes and order preserved");
  equal(partialResult.head.snapshot?.source.materials.map((item) => item.content), partial.materials.map((item) => item.content), "raw LF CRLF CR astral combining and whitespace bytes preserved");
  equal(partialResult.head.snapshot?.source.materials.map((item) => item.contentByteLength), partial.materials.map((item) => new TextEncoder().encode(item.content).byteLength), "raw material UTF-8 byte lengths preserved");
  equal(partialResult.head.snapshot?.source.materialCoverage, {
    ABSTRACT: "PROVIDED_UNVERIFIED",
    INTRODUCTION: "MISSING",
    METHODS: "PROVIDED_UNVERIFIED",
    RESULTS: "PROVIDED_UNVERIFIED",
    STATISTICS: "PROVIDED_UNVERIFIED",
  }, "partial material coverage records exact provided-unverified and missing states");
  const partialSelected = partialResult.head.snapshot.directions.find((direction) => direction.directionId === partialResult.head.snapshot.selectedDirectionId);
  ok(partialSelected, "partial selected direction exists");
  const partialAppliedAssistOptionIds = Object.fromEntries(Object.keys(partialSelected.s0).map((field) => [field, null]));
  const partialS0Summary = structuredClone(partialSelected.s0);
  const appliedMethodOption = partialSelected.fieldAssist.methodIdea[0];
  partialAppliedAssistOptionIds.methodIdea = appliedMethodOption.optionId;
  partialS0Summary.methodIdea = appliedMethodOption.applyValue;
  const partialConfirmationRequest = {
    contractVersion: V2_BETA2_CONTRACT_VERSION,
    operation: "SAVE_CONFIRMED_WORKSPACE",
    projectId: partialRequest.tenant.projectId,
    requestId: "beta2-confirmed-partial-request-0001",
    idempotencyKey: "beta2-confirmed-partial-key-0001",
    baseRevision: partialResult.head.revision,
    baseContentHash: partialResult.head.contentHash,
    selectedDirectionId: partialSelected.directionId,
    s0Summary: partialS0Summary,
    appliedAssistOptionIds: partialAppliedAssistOptionIds,
  };
  const partialConfirmed = await partialCoordinator.saveConfirmedWorkspace(partialRequest.tenant, partialConfirmationRequest);
  equal(partialConfirmed.head.revision, 2, "confirmed workspace advances one durable revision");
  equal(partialConfirmed.head.snapshot?.confirmedWorkspace?.s0, partialS0Summary, "confirmed S0 is durable and exact");
  equal(partialConfirmed.head.snapshot?.confirmedWorkspace?.appliedAssistOptionIds, partialAppliedAssistOptionIds, "confirmed Assist choices are durable and exact");
  equal(partialConfirmed.head.snapshot?.humanReadableArtifact.markdown.includes(partialS0Summary.methodIdea), true, "confirmed artifact renders visible effective S0");
  equal(partialConfirmed.head.snapshot?.humanReadableArtifact.artifactHash === partialSelected.humanReadableArtifact.artifactHash, false, "confirmed snapshot artifact changes while provider direction artifact remains immutable");
  equal(partialConfirmed.providerSubmissionDelta, 0, "confirmed workspace save never submits provider work");
  equal(partialProvider.submissionCount, 1, "confirmed workspace preserves one provider submission");
  const partialConfirmationReplay = await partialCoordinator.saveConfirmedWorkspace(partialRequest.tenant, partialConfirmationRequest);
  equal(partialConfirmationReplay.replayed, true, "confirmed workspace exact replay is idempotent");
  equal({ snapshots: partialConfirmationReplay.snapshotAppendDelta, events: partialConfirmationReplay.eventAppendDelta }, { snapshots: 0, events: 0 }, "confirmed workspace replay appends zero truth");
  const alternateMethodOption = partialSelected.fieldAssist.methodIdea[1];
  await assert.rejects(() => partialCoordinator.saveConfirmedWorkspace(partialRequest.tenant, {
    ...partialConfirmationRequest,
    s0Summary: { ...partialConfirmationRequest.s0Summary, methodIdea: alternateMethodOption.applyValue },
    appliedAssistOptionIds: { ...partialConfirmationRequest.appliedAssistOptionIds, methodIdea: alternateMethodOption.optionId },
  }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  const directConfirmedRequest = {
    ...partialConfirmationRequest,
    requestId: "beta2-confirmed-direct-tamper-0001",
    idempotencyKey: "beta2-confirmed-direct-tamper-key-0001",
    baseRevision: partialConfirmed.head.revision,
    baseContentHash: partialConfirmed.head.contentHash,
  };
  const directConfirmedSnapshot = confirmedWorkspaceSuccessor(partialConfirmed.head, directConfirmedRequest);
  const tamperedConfirmedCore = structuredClone(directConfirmedSnapshot);
  tamperedConfirmedCore.s0Summary.workingTitle = "caller-coordinated unauthorized confirmed projection";
  tamperedConfirmedCore.confirmedWorkspace.s0.workingTitle = tamperedConfirmedCore.s0Summary.workingTitle;
  delete tamperedConfirmedCore.confirmedWorkspace.confirmationHash;
  tamperedConfirmedCore.confirmedWorkspace.confirmationHash = beta2Hash(tamperedConfirmedCore.confirmedWorkspace);
  delete tamperedConfirmedCore.contentHash;
  const tamperedConfirmedSnapshot = { ...tamperedConfirmedCore, contentHash: beta2Hash(tamperedConfirmedCore) };
  await rejectsWithoutTruthDelta(partialRequest.tenant.projectId, () => callConfirmedWorkspaceCapability(partialRequest.tenant, directConfirmedRequest, directConfirmedSnapshot, { payload: tamperedConfirmedSnapshot, contentHash: tamperedConfirmedSnapshot.contentHash }), "beta2_workspace_confirmation_authority_invalid");
  await rejectsWithoutTruthDelta(partialRequest.tenant.projectId, () => callConfirmedWorkspaceCapability(partialRequest.tenant, directConfirmedRequest, directConfirmedSnapshot, { requestHash: "0".repeat(64) }), "beta2_workspace_confirmation_authority_invalid");
  equal(await rowCounts(partialRequest.tenant.projectId), { jobs: 1, receipts: 3, snapshots: 2, events: 2 }, "confirmed workspace exact replay and tamper attempts append no extra truth");
  const postConfirmationDirection = partialResult.head.snapshot.directions.find((direction) => direction.directionId !== partialSelected.directionId);
  const postConfirmationSelectionRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: partialRequest.tenant.projectId, requestId: "beta2-selection-after-confirmation-0001", idempotencyKey: "beta2-selection-after-confirmation-key-0001", baseRevision: partialConfirmed.head.revision, baseContentHash: partialConfirmed.head.contentHash, selectedDirectionId: postConfirmationDirection.directionId };
  const postConfirmationSelection = await partialCoordinator.saveSelection(partialRequest.tenant, postConfirmationSelectionRequest);
  equal(postConfirmationSelection.head.revision, 3, "later selection advances current head after confirmation");
  const historicalGeneration = await partialCoordinator.generate(partialRequest.tenant, partialRequest.request);
  equal(
    { revision: historicalGeneration.head.revision, contentHash: historicalGeneration.head.contentHash, snapshotHash: historicalGeneration.head.snapshot.contentHash },
    { revision: partialResult.head.revision, contentHash: partialResult.head.contentHash, snapshotHash: partialResult.head.snapshot.contentHash },
    "historical generation replay returns original revision-one committed result",
  );
  equal(historicalGeneration.providerSubmissionDelta, 0, "historical generation replay submits zero provider effects");
  const historicalConfirmation = await partialCoordinator.saveConfirmedWorkspace(partialRequest.tenant, partialConfirmationRequest);
  equal(
    { revision: historicalConfirmation.head.revision, contentHash: historicalConfirmation.head.contentHash, snapshotHash: historicalConfirmation.head.snapshot.contentHash },
    { revision: partialConfirmed.head.revision, contentHash: partialConfirmed.head.contentHash, snapshotHash: partialConfirmed.head.snapshot.contentHash },
    "historical confirmation replay returns original committed result after later revision",
  );
  equal({ snapshots: historicalConfirmation.snapshotAppendDelta, events: historicalConfirmation.eventAppendDelta }, { snapshots: 0, events: 0 }, "historical confirmation replay appends zero truth");
  const latestPartialHead = await repository.readProjectHead(partialRequest.tenant);
  equal(
    { revision: latestPartialHead.revision, contentHash: latestPartialHead.contentHash, snapshotHash: latestPartialHead.snapshot.contentHash },
    { revision: postConfirmationSelection.head.revision, contentHash: postConfirmationSelection.head.contentHash, snapshotHash: postConfirmationSelection.head.snapshot.contentHash },
    "resume remains on latest project head",
  );
  const partialReopenedPool = new Pool({ connectionString, max: 2 });
  const partialReopened = await new PostgresV2Beta2Repository(partialReopenedPool).readProjectHead(partialRequest.tenant);
  equal(partialReopened.snapshot?.source.materials, partial.materials, "new-process material bytes hashes and order resume exactly");
  equal(partialReopened.snapshot, postConfirmationSelection.head.snapshot, "new-process resume returns identical latest canonical confirmed workspace snapshot");
  await partialReopenedPool.end();

  const t1Provider = new DeterministicFakeV2Beta2Provider();
  const t1Coordinator = createV2Beta2Coordinator({ repository, provider: t1Provider });
  const t1 = await requestFor(repository, 3, keyword(" T1"), "t1");
  await assert.rejects(() => t1Coordinator.generate(t1.tenant, t1.request, { faultAt: "AFTER_T1" }), (error) => error instanceof V2Beta2SimulatedCrash && error.faultPoint === "AFTER_T1"); assertions += 1;
  equal(t1Provider.submissionCount, 0, "T1 crash precedes provider");
  equal((await t1Coordinator.generate(t1.tenant, t1.request)).head.revision, 1, "T1 retry uses same durable intent once");
  equal(t1Provider.submissionCount, 1, "T1 recovery one provider submission");

  const t2Provider = new DeterministicFakeV2Beta2Provider();
  const t2Repository = new PostgresV2Beta2Repository(pool, 0);
  const t2Coordinator = createV2Beta2Coordinator({ repository: t2Repository, provider: t2Provider });
  const t2 = await requestFor(t2Repository, 4, keyword(" T2"), "t2");
  await assert.rejects(() => t2Coordinator.generate(t2.tenant, t2.request, { faultAt: "AFTER_T2_BEFORE_IO" }), (error) => error instanceof V2Beta2SimulatedCrash && error.faultPoint === "AFTER_T2_BEFORE_IO"); assertions += 1;
  const t2FreshPool = new Pool({ connectionString, max: 2 });
  const t2FreshRepository = new PostgresV2Beta2Repository(t2FreshPool, 0);
  const t2FreshProvider = new DeterministicFakeV2Beta2Provider();
  const t2FreshCoordinator = createV2Beta2Coordinator({ repository: t2FreshRepository, provider: t2FreshProvider });
  const t2Resume = await t2FreshCoordinator.resume(t2.tenant);
  equal(t2Resume.head.reconciliation?.status, "RECONCILE_REQUIRED", "fresh process promotes stale T2 and exposes job");
  equal(t2Resume.eventAppendDelta, 1, "stale promotion records one unknown event");
  const t2ExactReplay = await t2FreshCoordinator.generate(t2.tenant, t2.request);
  equal(t2ExactReplay.head.reconciliation?.status, "RECONCILE_REQUIRED", "exact durable intent replay finds reconcile-required lineage");
  equal(t2ExactReplay.providerSubmissionDelta, 0, "fresh-process exact replay never resends");
  equal(t2FreshProvider.submissionCount, 0, "fresh-process provider remains untouched");
  await t2FreshPool.end();
  equal(t2Provider.submissionCount, 0, "T2 recovery never resends");
  equal((await t2Repository.getJob(t2.tenant, t2Resume.head.reconciliation.jobId))?.providerSubmissionCount, 1, "submission-started fence remains one");

  const ioProvider = new DeterministicFakeV2Beta2Provider();
  const ioCoordinator = createV2Beta2Coordinator({ repository, provider: ioProvider });
  const io = await requestFor(repository, 5, keyword(" IO"), "io");
  const ioResult = await ioCoordinator.generate(io.tenant, io.request, { faultAt: "DURING_IO" });
  equal(ioResult.head.reconciliation?.status, "RECONCILE_REQUIRED", "IO uncertainty blocks resend");
  equal((await ioCoordinator.generate(io.tenant, io.request)).providerSubmissionDelta, 0, "unknown replay has zero provider submission");

  const gapProvider = new DeterministicFakeV2Beta2Provider();
  const gapCoordinator = createV2Beta2Coordinator({ repository, provider: gapProvider });
  const gap = await requestFor(repository, 6, keyword(" GAP"), "gap");
  const gapUnknown = await gapCoordinator.generate(gap.tenant, gap.request, { faultAt: "AFTER_SUCCESS_BEFORE_TRUTH_COMMIT" });
  equal(gapUnknown.head.reconciliation?.status, "RECONCILE_REQUIRED", "success/commit gap is unknown");
  equal(gapProvider.submissionCount, 1, "success/commit gap submitted once");
  const gapJob = await repository.getJob(gap.tenant, gapUnknown.head.reconciliation.jobId);
  gapProvider.setLookupOutcome(gapJob.providerReceiptCommitment, gapJob.requestHash, { status: "COMPLETE", result: createDeterministicV2Beta2ProviderResult({ jobId: gapJob.jobId, stageInstanceHash: gapJob.stageInstanceHash, requestHash: gapJob.requestHash, receiptCommitment: gapJob.providerReceiptCommitment, source: gapJob.request.source }) });
  const gapReconciliationRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: gap.tenant.projectId, requestId: "beta2-reconcile-gap-0001", jobId: gapJob.jobId };
  const reconciled = await gapCoordinator.reconcile(gap.tenant, gapReconciliationRequest);
  equal(reconciled.head.revision, 1, "lookup-only reconciliation commits result");
  equal(reconciled.providerSubmissionDelta, 0, "reconciliation never generates");
  equal(gapProvider.submissionCount, 1, "reconciliation submission count remains one");
  equal(gapProvider.lookupCount, 1, "reconciliation performs one lookup");
  const gapTerminalEvent = await pool.query(`SELECT request_id AS "requestId",request_hash AS "requestHash" FROM beta2_project_events
    WHERE project_id=$1 AND event_type='RECONCILIATION_COMPLETE'`, [gap.tenant.projectId]);
  equal(gapTerminalEvent.rows[0], { requestId: gapReconciliationRequest.requestId, requestHash: createV2Beta2ReconciliationRequestHash(gapReconciliationRequest) }, "persisted reconciliation success binds canonical request identity and hash");
  const gapExactReplay = await gapCoordinator.reconcile(gap.tenant, gapReconciliationRequest);
  equal(gapExactReplay.replayed, true, "identical reconciliation request replays persisted terminal event");
  equal(gapExactReplay.snapshotAppendDelta, 0, "identical reconciliation replay appends zero snapshots");
  equal(gapExactReplay.eventAppendDelta, 0, "identical reconciliation replay appends zero events");
  equal(gapProvider.lookupCount, 1, "terminal success replay performs no second provider lookup");
  await rejectsWithoutTruthDelta(gap.tenant.projectId, () => gapCoordinator.reconcile(gap.tenant, { ...gapReconciliationRequest, requestId: "beta2-reconcile-gap-different-0001" }), "beta2_reconciliation_replay_conflict");
  equal(gapProvider.lookupCount, 1, "mismatched terminal success request performs no provider lookup");
  const gapSelectionRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: gap.tenant.projectId, requestId: "beta2-selection-after-reconcile-0001", idempotencyKey: "beta2-selection-after-reconcile-key-0001", baseRevision: reconciled.head.revision, baseContentHash: reconciled.head.contentHash, selectedDirectionId: reconciled.head.snapshot.directions[2].directionId };
  const gapSelection = await gapCoordinator.saveSelection(gap.tenant, gapSelectionRequest);
  equal(gapSelection.head.revision, 2, "selection may advance an exact completed reconciliation head");
  await rejectsWithoutTruthDelta(gap.tenant.projectId, () => gapCoordinator.reconcile(gap.tenant, gapReconciliationRequest), "beta2_reconciliation_replay_conflict");
  equal(gapProvider.lookupCount, 1, "reconciliation replay after head advance performs no provider lookup");

  const concurrentProvider = new DeterministicFakeV2Beta2Provider();
  const concurrentCoordinator = createV2Beta2Coordinator({ repository, provider: concurrentProvider });
  const concurrent = await requestFor(repository, 7, keyword(" concurrent"), "concurrent");
  const settled = await Promise.allSettled([concurrentCoordinator.generate(concurrent.tenant, concurrent.request), concurrentCoordinator.generate(concurrent.tenant, concurrent.request)]);
  const concurrentFulfilled = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
  equal(concurrentFulfilled.length >= 1, true, "at least one concurrent request completes");
  equal(concurrentFulfilled.reduce((sum, item) => sum + item.providerSubmissionDelta, 0), 1, "concurrent outcomes report one true provider delta");
  equal(concurrentFulfilled.reduce((sum, item) => sum + item.snapshotAppendDelta, 0), 1, "concurrent outcomes report one true snapshot delta");
  equal(concurrentFulfilled.reduce((sum, item) => sum + item.eventAppendDelta, 0), 1, "concurrent outcomes report one true event delta");
  equal(concurrentProvider.submissionCount, 1, "concurrent requests submit once");
  equal(await rowCounts(concurrent.tenant.projectId), { jobs: 1, receipts: 3, snapshots: 1, events: 1 }, "concurrent requests retain one exact durable chain");

  const staleProvider = new DeterministicFakeV2Beta2Provider();
  const staleCoordinator = createV2Beta2Coordinator({ repository, provider: staleProvider });
  const stale = await requestFor(repository, 8, keyword(" stale"), "stale");
  await assert.rejects(() => staleCoordinator.generate(stale.tenant, { ...stale.request, baseRevision: 1 }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_stale_project_head"); assertions += 1;
  equal(staleProvider.submissionCount, 0, "stale revision never calls provider");

  const submittingProvider = new DeterministicFakeV2Beta2Provider();
  const submittingCoordinator = createV2Beta2Coordinator({ repository, provider: submittingProvider });
  const submitting = await requestFor(repository, 9, keyword(" submitting"), "submitting");
  await assert.rejects(() => submittingCoordinator.generate(submitting.tenant, submitting.request, { faultAt: "AFTER_T2_BEFORE_IO" }), (error) => error instanceof V2Beta2SimulatedCrash); assertions += 1;
  await assert.rejects(() => submittingCoordinator.generate(submitting.tenant, { ...submitting.request, requestId: "beta2-request-submitting-new", idempotencyKey: "beta2-idempotency-submitting-new", source: keyword(" submitting changed") }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  equal(submittingProvider.submissionCount, 0, "SUBMITTING lineage blocks every source and key variant without provider IO");

  const reconcileFenceProvider = new DeterministicFakeV2Beta2Provider();
  const reconcileFenceCoordinator = createV2Beta2Coordinator({ repository, provider: reconcileFenceProvider });
  const reconcileFence = await requestFor(repository, 10, keyword(" reconcile fence"), "reconcile-fence");
  const reconcileFenceResult = await reconcileFenceCoordinator.generate(reconcileFence.tenant, reconcileFence.request, { faultAt: "DURING_IO" });
  equal(reconcileFenceResult.head.reconciliation?.status, "RECONCILE_REQUIRED", "provider uncertainty enters permanent reconcile fence");
  await assert.rejects(() => reconcileFenceCoordinator.generate(reconcileFence.tenant, { ...reconcileFence.request, requestId: "beta2-request-reconcile-new", idempotencyKey: "beta2-idempotency-reconcile-new", source: keyword(" reconcile changed") }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  equal(reconcileFenceProvider.submissionCount, 0, "RECONCILE_REQUIRED lineage blocks every source and key variant without second submit");
  const pendingReconciliationRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: reconcileFence.tenant.projectId, requestId: "beta2-reconcile-pending-0001", jobId: reconcileFenceResult.head.reconciliation.jobId };
  const pendingBefore = await rowCounts(reconcileFence.tenant.projectId);
  const pendingFirst = await reconcileFenceCoordinator.reconcile(reconcileFence.tenant, pendingReconciliationRequest);
  const pendingSecond = await reconcileFenceCoordinator.reconcile(reconcileFence.tenant, pendingReconciliationRequest);
  equal(pendingFirst.head.reconciliation?.jobId, pendingReconciliationRequest.jobId, "first nonterminal lookup retains reconciliation fence");
  equal(pendingSecond.head.reconciliation?.jobId, pendingReconciliationRequest.jobId, "sequential nonterminal repoll retains reconciliation fence");
  equal(pendingFirst.eventAppendDelta + pendingSecond.eventAppendDelta, 0, "sequential nonterminal repolls append zero events");
  equal(pendingFirst.snapshotAppendDelta + pendingSecond.snapshotAppendDelta, 0, "sequential nonterminal repolls append zero snapshots");
  equal(reconcileFenceProvider.lookupCount, 2, "sequential nonterminal repolls perform one lookup per request");
  equal(await rowCounts(reconcileFence.tenant.projectId), pendingBefore, "sequential nonterminal repolls preserve exact truth rows");

  const mismatchProvider = new DeterministicFakeV2Beta2Provider();
  const mismatchCoordinator = createV2Beta2Coordinator({ repository, provider: mismatchProvider });
  const mismatch = await requestFor(repository, 11, keyword(" lookup mismatch"), "lookup-mismatch");
  const mismatchUnknown = await mismatchCoordinator.generate(mismatch.tenant, mismatch.request, { faultAt: "AFTER_SUCCESS_BEFORE_TRUTH_COMMIT" });
  const mismatchJob = await repository.getJob(mismatch.tenant, mismatchUnknown.head.reconciliation.jobId);
  const invalidLookupCoordinator = createV2Beta2Coordinator({ repository, provider: {
    capability: localProviderCapability,
    async submit() { throw new Error("submit_not_expected"); },
    async lookup() { return { status: "NOT_FOUND", receiptCommitment: "0".repeat(64), requestHash: mismatchJob.requestHash }; },
  } });
  await assert.rejects(() => invalidLookupCoordinator.reconcile(mismatch.tenant, { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: mismatch.tenant.projectId, requestId: "beta2-reconcile-mismatch-0001", jobId: mismatchJob.jobId }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_reconciliation_authority_invalid"); assertions += 1;
  equal(mismatchProvider.submissionCount, 1, "lookup-authority mismatch never resubmits");
  const mismatchReconciliationRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: mismatch.tenant.projectId, requestId: "beta2-reconcile-mismatch-0002", jobId: mismatchJob.jobId };
  const originalMismatchLookup = mismatchProvider.lookup.bind(mismatchProvider);
  let releaseMismatchLookup;
  let announceMismatchLookup;
  const mismatchLookupStarted = new Promise((resolve) => { announceMismatchLookup = resolve; });
  const mismatchLookupRelease = new Promise((resolve) => { releaseMismatchLookup = resolve; });
  let firstMismatchLookup = true;
  mismatchProvider.lookup = async (input) => {
    if (firstMismatchLookup) {
      firstMismatchLookup = false;
      announceMismatchLookup();
      await mismatchLookupRelease;
    }
    return originalMismatchLookup(input);
  };
  const firstCompleteReconciliation = mismatchCoordinator.reconcile(mismatch.tenant, mismatchReconciliationRequest);
  await mismatchLookupStarted;
  const secondCompleteReconciliation = mismatchCoordinator.reconcile(mismatch.tenant, mismatchReconciliationRequest);
  const secondCompleteBeforeRelease = await Promise.race([secondCompleteReconciliation.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 75))]);
  releaseMismatchLookup();
  equal(secondCompleteBeforeRelease, false, "only one terminalizing reconciliation lookup is in flight");
  const completeSettled = await Promise.all([firstCompleteReconciliation, secondCompleteReconciliation]);
  equal(completeSettled.map((item) => item.replayed).sort(), [false, true], "concurrent complete reconciliation reports one append and one exact replay");
  equal(completeSettled.reduce((sum, item) => sum + item.snapshotAppendDelta, 0), 1, "concurrent complete reconciliation reports one snapshot append");
  equal(completeSettled.reduce((sum, item) => sum + item.eventAppendDelta, 0), 1, "concurrent complete reconciliation reports one event append");
  equal(mismatchProvider.lookupCount, 1, "concurrent terminalizing reconciliation performs one provider lookup total");
  equal(await rowCounts(mismatch.tenant.projectId), { jobs: 1, receipts: 4, snapshots: 1, events: 2 }, "concurrent complete reconciliation retains one exact durable terminal chain");
  await rejectsWithoutTruthDelta(mismatch.tenant.projectId, () => mismatchCoordinator.reconcile(mismatch.tenant, { ...mismatchReconciliationRequest, requestId: "beta2-reconcile-mismatch-different-0002" }), "beta2_reconciliation_replay_conflict");
  equal(mismatchProvider.lookupCount, 1, "mismatched complete replay performs no provider lookup");

  const intentProvider = new DeterministicFakeV2Beta2Provider();
  const intentCoordinator = createV2Beta2Coordinator({ repository, provider: intentProvider });
  const intent = await requestFor(repository, 12, keyword(" intent guard"), "intent-guard");
  await assert.rejects(() => intentCoordinator.generate(intent.tenant, intent.request, { faultAt: "AFTER_T1" }), (error) => error instanceof V2Beta2SimulatedCrash); assertions += 1;
  const submittingJobId = (await pool.query("SELECT job_id FROM beta2_generation_jobs WHERE project_id=$1", [submitting.tenant.projectId])).rows[0].job_id;
  const intentJobId = (await pool.query("SELECT job_id FROM beta2_generation_jobs WHERE project_id=$1", [intent.tenant.projectId])).rows[0].job_id;
  await rejectsWithoutTruthDelta(submitting.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.commit_provider_success($1,$2,$3,$4,1,$5,$6,'{}'::jsonb,'RECONCILIATION_COMPLETE',$7)`,
    [submitting.tenant.workspaceId, submitting.tenant.projectId, submittingJobId, "8".repeat(64), "7".repeat(64), "old-mike-v2-beta2/durable-snapshot/1", "beta2-swapped-reconcile-request-01"],
  ), "beta2_state_event_pair_invalid");
  await rejectsWithoutTruthDelta(reconcileFence.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.commit_provider_success($1,$2,$3,$4,1,$5,$6,'{}'::jsonb,'GENERATION_COMPLETE',NULL)`,
    [reconcileFence.tenant.workspaceId, reconcileFence.tenant.projectId, reconcileFenceResult.head.reconciliation.jobId, "8".repeat(64), "7".repeat(64), "old-mike-v2-beta2/durable-snapshot/1"],
  ), "beta2_state_event_pair_invalid");
  await rejectsWithoutTruthDelta(intent.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.mark_terminal_rejected($1,$2,$3,'SWAPPED_EVENT',$4)`,
    [intent.tenant.workspaceId, intent.tenant.projectId, intentJobId, "beta2-swapped-reconcile-request-02"],
  ), "beta2_state_event_pair_invalid");
  await rejectsWithoutTruthDelta(submitting.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.mark_terminal_rejected($1,$2,$3,'SWAPPED_EVENT',$4)`,
    [submitting.tenant.workspaceId, submitting.tenant.projectId, submittingJobId, "beta2-swapped-reconcile-request-03"],
  ), "beta2_state_event_pair_invalid");
  await rejectsWithoutTruthDelta(reconcileFence.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.mark_terminal_rejected($1,$2,$3,'SWAPPED_EVENT',NULL)`,
    [reconcileFence.tenant.workspaceId, reconcileFence.tenant.projectId, reconcileFenceResult.head.reconciliation.jobId],
  ), "beta2_state_event_pair_invalid");
  await rejectsWithoutTruthDelta(reconcileFence.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.mark_terminal_rejected($1,$2,$3,'SWAPPED_EVENT',$4)`,
    [reconcileFence.tenant.workspaceId, reconcileFence.tenant.projectId, reconcileFenceResult.head.reconciliation.jobId, "short"],
  ), "beta2_state_event_pair_invalid");
  const fabricatedIntentFailure = await pool.query(`UPDATE beta2_generation_jobs SET state='FAILED', completion_class='TERMINAL_REJECTED', provider_submission_count=1,
    provider_receipt_commitment=repeat('a',64), submit_started_at=clock_timestamp(), terminal_at=clock_timestamp(), sanitized_reason_code='FABRICATED', state_version=state_version+1
    WHERE workspace_id=$1 AND project_id=$2`, [intent.tenant.workspaceId, intent.tenant.projectId]).then(() => false, () => true);
  equal(fabricatedIntentFailure, true, "INTENT to FAILED count-one fabrication rejected");

  const appendOnly = await pool.query("UPDATE beta2_project_events SET predecessor_event_hash=repeat('0',64) WHERE project_id=$1", [basic.tenant.projectId]).then(() => false, () => true);
  equal(appendOnly, true, "event predecessor rewrite rejected");
  const receiptSplice = await pool.query("DELETE FROM beta2_generation_receipts WHERE project_id=$1", [basic.tenant.projectId]).then(() => false, () => true);
  equal(receiptSplice, true, "receipt splice rejected");
  const formalReadDenied = await pool.query("SELECT count(*) FROM research_documents").then(() => false, () => true);
  equal(formalReadDenied, true, "restricted app role cannot read formal research authority");
  const publicGrants = await pool.query("SELECT count(*)::int AS count FROM information_schema.role_table_grants WHERE grantee='PUBLIC' AND table_name LIKE 'beta2_%'");
  equal(publicGrants.rows[0].count, 0, "PUBLIC privileges zero");
  const illegalCount = await pool.query("UPDATE beta2_generation_jobs SET provider_submission_count=0 WHERE project_id=$1", [basic.tenant.projectId]).then(() => false, () => true);
  equal(illegalCount, true, "provider submission count never decreases");
  const commitmentRewrite = await pool.query("UPDATE beta2_generation_jobs SET provider_receipt_commitment=repeat('b',64), state_version=state_version+1 WHERE project_id=$1", [basic.tenant.projectId]).then(() => false, () => true);
  equal(commitmentRewrite, true, "provider receipt commitment cannot be rewritten");
  const receiptGap = await pool.query(`INSERT INTO beta2_generation_receipts
    (workspace_id,project_id,job_id,receipt_no,receipt_id,kind,completion_class,submission_count,provider_reference_commitment,result_hash,predecessor_receipt_hash,receipt_hash)
    SELECT workspace_id,project_id,job_id,max(receipt_no)+2,'beta2-receipt-malformed-gap','COMPLETION_OBSERVED','COMPLETE',1,max(provider_reference_commitment),max(result_hash),max(receipt_hash),repeat('c',64)
      FROM beta2_generation_receipts WHERE project_id=$1 GROUP BY workspace_id,project_id,job_id`, [basic.tenant.projectId]).then(() => false, () => true);
  equal(receiptGap, true, "receipt gap with coherently changed descendant hash rejected");
  const eventGap = await pool.query(`INSERT INTO beta2_project_events
    (workspace_id,project_id,sequence,event_id,event_type,operation,idempotency_key,job_id,request_id,request_hash,from_revision,to_revision,snapshot_revision,predecessor_event_hash,event_hash,created_by_user_id)
    SELECT workspace_id,project_id,sequence+2,'beta2-event-malformed-gap',event_type,operation,'beta2-idempotency-malformed-gap',job_id,'beta2-request-malformed-gap',request_hash,to_revision,to_revision,NULL,event_hash,repeat('d',64),created_by_user_id
      FROM beta2_project_events WHERE project_id=$1 ORDER BY sequence DESC LIMIT 1`, [reconcileFence.tenant.projectId]).then(() => false, () => true);
  equal(eventGap, true, "event sequence gap with coordinated descendant rehash rejected");
  const eventWrongPredecessor = await pool.query(`INSERT INTO beta2_project_events
    (workspace_id,project_id,sequence,event_id,event_type,operation,idempotency_key,job_id,request_id,request_hash,from_revision,to_revision,snapshot_revision,predecessor_event_hash,event_hash,created_by_user_id)
    SELECT workspace_id,project_id,sequence+1,'beta2-event-wrong-predecessor',event_type,operation,'beta2-idempotency-wrong-predecessor',job_id,'beta2-request-wrong-predecessor',request_hash,to_revision,to_revision,NULL,repeat('0',64),repeat('e',64),created_by_user_id
      FROM beta2_project_events WHERE project_id=$1 ORDER BY sequence DESC LIMIT 1`, [reconcileFence.tenant.projectId]).then(() => false, () => true);
  equal(eventWrongPredecessor, true, "wrong event predecessor rejected");
  const orphanReceipt = await pool.query(`INSERT INTO beta2_generation_receipts
    (workspace_id,project_id,job_id,receipt_no,receipt_id,kind,completion_class,submission_count,provider_reference_commitment,result_hash,predecessor_receipt_hash,receipt_hash)
    VALUES ('beta2-workspace-01','beta2-project-13','beta2-job-orphan',1,'beta2-receipt-orphan','INTENT_PERSISTED','PENDING',0,NULL,NULL,NULL,repeat('f',64))`).then(() => false, () => true);
  equal(orphanReceipt, true, "orphan receipt rejected");
  const malformedJob = await pool.query(`INSERT INTO beta2_generation_jobs
    (workspace_id,project_id,job_id,created_by_user_id,contract_version,stage_id,stage_instance_hash,idempotency_key,request_id,request_hash,source_revision,source_hash,request_payload,state,completion_class,provider_submission_count)
    VALUES ('beta2-workspace-01','beta2-project-13','beta2-job-malformed','beta2-user-01',$1,'DURABLE_CORE_GENERATION',repeat('1',64),'beta2-idempotency-malformed','beta2-request-malformed',repeat('2',64),0,repeat('3',64),'{}'::jsonb,'INTENT_RECORDED','PENDING',0)`, [V2_BETA2_CONTRACT_VERSION]).then(() => false, () => true);
  equal(malformedJob, true, "raw malformed job insert is rejected under the project lock");
  const crossTenantJob = await pool.query(`INSERT INTO beta2_generation_jobs
    (workspace_id,project_id,job_id,created_by_user_id,contract_version,stage_id,stage_instance_hash,idempotency_key,request_id,request_hash,source_revision,source_hash,request_payload,state,completion_class,provider_submission_count)
    VALUES ('beta2-workspace-other','beta2-project-other','beta2-job-cross-tenant','beta2-user-01',$1,'DURABLE_CORE_GENERATION',repeat('4',64),'beta2-idempotency-cross-tenant','beta2-request-cross-tenant',repeat('5',64),0,repeat('6',64),'{}'::jsonb,'INTENT_RECORDED','PENDING',0)`, [V2_BETA2_CONTRACT_VERSION]).then(() => false, () => true);
  equal(crossTenantJob, true, "raw cross-tenant job insert rejected");
  const malformedSnapshot = await pool.query(`INSERT INTO beta2_project_snapshots
    (workspace_id,project_id,revision,content_hash,contract_version,schema_id,snapshot_payload,source_job_id,created_by_user_id)
    SELECT workspace_id,project_id,3,repeat('7',64),contract_version,schema_id,snapshot_payload || '{"extra":true}'::jsonb,source_job_id,created_by_user_id
      FROM beta2_project_snapshots WHERE project_id=$1 AND revision=2`, [basic.tenant.projectId]).then(() => false, () => true);
  equal(malformedSnapshot, true, "raw malformed snapshot insert rejected under the project lock");
  for (const table of ["beta2_generation_jobs", "beta2_generation_receipts", "beta2_project_snapshots", "beta2_project_events", "beta2_operation_intents"]) {
    equal(await pool.query(`INSERT INTO ${table} SELECT * FROM ${table} WHERE false`).then(() => false, () => true), true, `${table} raw INSERT denied to app role`);
    equal(await pool.query(`UPDATE ${table} SET workspace_id=workspace_id WHERE false`).then(() => false, () => true), true, `${table} raw UPDATE denied to app role`);
    equal(await pool.query(`DELETE FROM ${table} WHERE false`).then(() => false, () => true), true, `${table} raw DELETE denied to app role`);
  }
  const controlledWriteFunctions = await pool.query(`SELECT p.proname AS name, p.proargnames AS "argNames",
    p.prosecdef AS "securityDefiner", r.rolname AS owner, p.proconfig AS config
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
    WHERE n.nspname='old_mike_beta2_private' AND p.proname IN
      ('reserve_generation_intent','mark_submission_started','mark_completion_unknown','commit_provider_success','mark_terminal_rejected','save_direction_selection')
    ORDER BY p.proname`);
  equal(controlledWriteFunctions.rows.length, 6, "app has exactly six controlled write capabilities");
  equal(controlledWriteFunctions.rows.every((row) => row.securityDefiner === true && row.owner === "old_mike_beta2_owner" && row.config?.includes("search_path=pg_catalog")), true, "controlled writes have fixed owner and search path");
  equal(controlledWriteFunctions.rows.every((row) => !row.argNames.some((name) => name === "p_receipt_hash" || name === "p_event_hash")), true, "caller cannot submit authoritative current receipt or event hash");
  equal(await pool.query(`SELECT old_mike_beta2_private.beta2_write_receipt('x','x','x','x')`).then(() => false, () => true), true, "app cannot execute private receipt writer helper");

  const folded = await requestFor(repository, 13, keyword(" folded transition"), "folded-transition");
  const foldedStageHash = createV2Beta2StageInstanceHash({ workspaceId: folded.tenant.workspaceId, projectId: folded.tenant.projectId, baseRevision: folded.request.baseRevision, baseContentHash: folded.request.baseContentHash });
  const foldedRequestHash = createV2Beta2GenerationPayloadHash(folded.request);
  const foldedClient = await pool.connect();
  let foldedRejected = false;
  try {
    await foldedClient.query("BEGIN");
    const reserved = await foldedClient.query(`SELECT out_job_id AS "jobId" FROM old_mike_beta2_private.reserve_generation_intent($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [folded.tenant.workspaceId, folded.tenant.projectId, folded.tenant.userId, foldedStageHash, folded.request.idempotencyKey, folded.request.requestId,
        foldedRequestHash, folded.request.baseRevision, folded.request.source.sourceHash, beta2CanonicalJson(folded.request)]);
    await foldedClient.query(`SELECT * FROM old_mike_beta2_private.mark_submission_started($1,$2,$3,$4)`,
      [folded.tenant.workspaceId, folded.tenant.projectId, reserved.rows[0].jobId, "a".repeat(64)]);
    await foldedClient.query("COMMIT");
  } catch {
    foldedRejected = true;
    await foldedClient.query("ROLLBACK").catch(() => undefined);
  } finally {
    foldedClient.release();
  }
  equal(foldedRejected, true, "INTENT to SUBMITTING cannot fold into one transaction without an independently committed receipt");
  equal(await rowCounts(folded.tenant.projectId), { jobs: 0, receipts: 0, snapshots: 0, events: 0 }, "folded transition rejection rolls back all authority rows");

  const rejectedProvider = new DeterministicFakeV2Beta2Provider();
  const rejectedCoordinator = createV2Beta2Coordinator({ repository, provider: rejectedProvider });
  const rejectedRequest = await requestFor(repository, 14, keyword(" rejected reconciliation"), "rejected-reconciliation");
  const rejectedUnknown = await rejectedCoordinator.generate(rejectedRequest.tenant, rejectedRequest.request, { faultAt: "AFTER_SUCCESS_BEFORE_TRUTH_COMMIT" });
  const rejectedJob = await repository.getJob(rejectedRequest.tenant, rejectedUnknown.head.reconciliation.jobId);
  rejectedProvider.setLookupOutcome(rejectedJob.providerReceiptCommitment, rejectedJob.requestHash, { status: "REJECTED" });
  const reconciliationRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: rejectedRequest.tenant.projectId, requestId: "beta2-reconcile-rejected-0001", jobId: rejectedJob.jobId };
  const originalRejectedLookup = rejectedProvider.lookup.bind(rejectedProvider);
  let releaseFirstLookup;
  let announceFirstLookup;
  const firstLookupStarted = new Promise((resolve) => { announceFirstLookup = resolve; });
  const firstLookupRelease = new Promise((resolve) => { releaseFirstLookup = resolve; });
  let firstLookup = true;
  rejectedProvider.lookup = async (input) => {
    if (firstLookup) {
      firstLookup = false;
      announceFirstLookup();
      await firstLookupRelease;
    }
    return originalRejectedLookup(input);
  };
  const firstRejectedReconciliation = rejectedCoordinator.reconcile(rejectedRequest.tenant, reconciliationRequest);
  await firstLookupStarted;
  const secondRejectedReconciliation = rejectedCoordinator.reconcile(rejectedRequest.tenant, reconciliationRequest);
  const secondCompletedBeforeRelease = await Promise.race([
    secondRejectedReconciliation.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 75)),
  ]);
  releaseFirstLookup();
  equal(secondCompletedBeforeRelease, false, "second reconciliation remains serialized before provider lookup while the first lookup is active");
  const rejectedSettled = await Promise.all([firstRejectedReconciliation, secondRejectedReconciliation]);
  equal(rejectedSettled.map((item) => item.replayed).sort(), [false, true], "concurrent rejected reconciliation reports one append and one exact replay");
  equal(rejectedSettled.reduce((sum, item) => sum + item.eventAppendDelta, 0), 1, "concurrent rejected reconciliation reports one true event delta");
  equal(rejectedSettled.reduce((sum, item) => sum + item.snapshotAppendDelta, 0), 0, "rejected reconciliation never appends a snapshot");
  equal(rejectedProvider.lookupCount, 1, "terminal rejected replay performs no second provider lookup");
  equal(rejectedSettled[0].head.stageOutcome?.status, "REJECTED", "reconciliation rejection is retained as durable rejected outcome");
  equal(rejectedSettled[0].head.stageOutcome?.terminalEvent?.eventType, "RECONCILIATION_TERMINAL_FAILURE", "reconciliation terminal event type is retained");
  equal(rejectedSettled[0].head.stageOutcome?.terminalEvent?.requestHash, createV2Beta2ReconciliationRequestHash(reconciliationRequest), "reconciliation terminal request hash is retained");
  equal((await new PostgresV2Beta2Repository(pool).readProjectHead(rejectedRequest.tenant)).stageOutcome, rejectedSettled[0].head.stageOutcome, "fresh repository session resumes the exact rejected stage outcome");
  equal(await rowCounts(rejectedRequest.tenant.projectId), { jobs: 1, receipts: 4, snapshots: 0, events: 2 }, "rejected reconciliation persists one terminal transition and event");
  await rejectsWithoutTruthDelta(rejectedRequest.tenant.projectId, () => rejectedCoordinator.reconcile(rejectedRequest.tenant, { ...reconciliationRequest, requestId: "beta2-reconcile-rejected-different-0001" }), "beta2_reconciliation_replay_conflict");
  equal(rejectedProvider.lookupCount, 1, "mismatched terminal rejection request performs no provider lookup");
  equal((await pool.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND granted=true")).rows[0].count, 0, "reconciliation lookup session lock is released after both outcomes");

  const generationRejectedProvider = new DeterministicFakeV2Beta2Provider();
  generationRejectedProvider.setNextOutcome("TERMINAL_REJECTED");
  const generationRejectedCoordinator = createV2Beta2Coordinator({ repository, provider: generationRejectedProvider });
  const generationRejectedRequest = await requestFor(repository, 15, keyword(" generation rejected"), "generation-rejected");
  const generationRejected = await generationRejectedCoordinator.generate(generationRejectedRequest.tenant, generationRejectedRequest.request);
  equal(generationRejected.head.revision, 0, "SUBMITTING terminal rejection does not advance snapshot truth");
  equal(generationRejected.head.stageOutcome?.status, "REJECTED", "generation rejection is not relabeled READY or SAVED");
  equal(generationRejected.head.stageOutcome?.terminalEvent?.eventType, "GENERATION_TERMINAL_FAILURE", "generation rejection retains generation terminal identity");
  equal(generationRejected.eventAppendDelta, 1, "SUBMITTING terminal rejection appends one generation failure event");
  equal((await pool.query("SELECT event_type FROM beta2_project_events WHERE project_id=$1", [generationRejectedRequest.tenant.projectId])).rows[0].event_type, "GENERATION_TERMINAL_FAILURE", "SUBMITTING binds only generation terminal event type");
  equal(await rowCounts(generationRejectedRequest.tenant.projectId), { jobs: 1, receipts: 3, snapshots: 0, events: 1 }, "SUBMITTING terminal rejection persists exact transition receipts and event");
  const generationRejectedJobId = (await pool.query("SELECT job_id FROM beta2_generation_jobs WHERE project_id=$1", [generationRejectedRequest.tenant.projectId])).rows[0].job_id;
  await rejectsWithoutTruthDelta(generationRejectedRequest.tenant.projectId, () => generationRejectedCoordinator.reconcile(generationRejectedRequest.tenant, { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: generationRejectedRequest.tenant.projectId, requestId: "beta2-reconcile-generation-failed-0001", jobId: generationRejectedJobId }), "beta2_reconciliation_not_available");
  equal(generationRejectedProvider.lookupCount, 0, "generation-failure reconciliation rejects before provider lookup");
  await rejectsWithoutTruthDelta(generationRejectedRequest.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.mark_terminal_rejected($1,$2,$3,'SWAPPED_REPLAY',$4)`,
    [generationRejectedRequest.tenant.workspaceId, generationRejectedRequest.tenant.projectId, generationRejectedJobId, "beta2-swapped-reconcile-replay-01"],
  ), "beta2_state_event_pair_invalid");
  await rejectsWithoutTruthDelta(rejectedRequest.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.mark_terminal_rejected($1,$2,$3,'SWAPPED_REPLAY',NULL)`,
    [rejectedRequest.tenant.workspaceId, rejectedRequest.tenant.projectId, rejectedJob.jobId],
  ), "beta2_state_event_pair_invalid");
  await rejectsWithoutTruthDelta(basic.tenant.projectId, () => pool.query(
    `SELECT * FROM old_mike_beta2_private.commit_provider_success($1,$2,$3,$4,1,$5,$6,'{}'::jsonb,'RECONCILIATION_COMPLETE',$7)`,
    [basic.tenant.workspaceId, basic.tenant.projectId, generated.head.snapshot.jobId, generated.head.snapshot.contentHash, generated.head.snapshot.contentHash, generated.head.snapshot.schemaId, "beta2-swapped-reconcile-replay-02"],
  ), "beta2_state_event_pair_invalid");

  const intentRejectedRequest = await requestFor(repository, 16, keyword(" intent rejected"), "intent-rejected");
  const intentRejectedStage = createV2Beta2StageInstanceHash({ workspaceId: intentRejectedRequest.tenant.workspaceId, projectId: intentRejectedRequest.tenant.projectId, baseRevision: intentRejectedRequest.request.baseRevision, baseContentHash: intentRejectedRequest.request.baseContentHash });
  const intentReservation = await repository.reserveGeneration(intentRejectedRequest.tenant, intentRejectedRequest.request, intentRejectedStage);
  await repository.markTerminalRejected(intentRejectedRequest.tenant, intentReservation.job.jobId, "PRE_SUBMISSION_REJECTED");
  equal((await pool.query("SELECT event_type FROM beta2_project_events WHERE project_id=$1", [intentRejectedRequest.tenant.projectId])).rows[0].event_type, "GENERATION_TERMINAL_FAILURE", "INTENT_RECORDED binds only generation terminal event type");
  equal(await rowCounts(intentRejectedRequest.tenant.projectId), { jobs: 1, receipts: 2, snapshots: 0, events: 1 }, "INTENT_RECORDED terminal rejection persists exact transition receipts and event");

  const invalidSubmit = await requestFor(repository, 17, keyword(" invalid submit envelope"), "invalid-submit-envelope");
  let invalidSubmitCount = 0;
  const invalidSubmitProvider = {
    capability: localProviderCapability,
    async submit(input) { invalidSubmitCount += 1; return { completionClass: "complete", receiptCommitment: input.receiptCommitment, requestHash: input.requestHash }; },
    async lookup() { throw new Error("lookup_not_expected"); },
  };
  const invalidSubmitCoordinator = createV2Beta2Coordinator({ repository, provider: invalidSubmitProvider });
  const invalidSubmitOutcome = await invalidSubmitCoordinator.generate(invalidSubmit.tenant, invalidSubmit.request);
  equal(invalidSubmitOutcome.head.stageOutcome?.status, "RECONCILE_REQUIRED", "invalid submit envelope becomes durable completion unknown after provider I/O");
  equal(invalidSubmitOutcome.head.stageOutcome?.reasonCode, "PROVIDER_IO_OR_COMMIT_UNKNOWN", "invalid submit envelope retains sanitized durable unknown reason");
  equal(invalidSubmitOutcome.snapshotAppendDelta, 0, "invalid submit envelope advances no snapshot truth");
  equal(invalidSubmitCount, 1, "invalid submit envelope performs at most one provider submission");
  const invalidSubmitReplay = await invalidSubmitCoordinator.generate(invalidSubmit.tenant, invalidSubmit.request);
  equal(invalidSubmitReplay.replayed, true, "invalid submit durable unknown replays without resend");
  equal(invalidSubmitCount, 1, "invalid submit durable unknown permanently forbids resend");

  const invalidLookup = await requestFor(repository, 18, keyword(" invalid lookup envelope"), "invalid-lookup-envelope");
  const invalidEnvelopeLookupProvider = new DeterministicFakeV2Beta2Provider();
  const invalidEnvelopeLookupCoordinator = createV2Beta2Coordinator({ repository, provider: invalidEnvelopeLookupProvider });
  const invalidLookupUnknown = await invalidEnvelopeLookupCoordinator.generate(invalidLookup.tenant, invalidLookup.request, { faultAt: "AFTER_SUCCESS_BEFORE_TRUTH_COMMIT" });
  const invalidLookupJobId = invalidLookupUnknown.head.reconciliation.jobId;
  invalidEnvelopeLookupProvider.lookup = async ({ receiptCommitment, requestHash }) => {
    invalidEnvelopeLookupProvider.lookupCount += 1;
    return { status: "complete", receiptCommitment, requestHash };
  };
  const invalidLookupRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: invalidLookup.tenant.projectId, requestId: "beta2-reconcile-invalid-envelope-0001", jobId: invalidLookupJobId };
  const invalidLookupBefore = await truthAuthorityRows(invalidLookup.tenant.projectId);
  const invalidLookupError = await invalidEnvelopeLookupCoordinator.reconcile(invalidLookup.tenant, invalidLookupRequest).then(() => null, (error) => error);
  equal(invalidLookupError instanceof V2Beta2RepositoryError && invalidLookupError.code === "beta2_provider_lookup_invalid" && invalidLookupError.status === 503, true, "invalid lookup envelope fails closed with exact 503 authority");
  equal(await truthAuthorityRows(invalidLookup.tenant.projectId), invalidLookupBefore, "invalid lookup envelope writes zero truth delta");
  equal((await repository.readProjectHead(invalidLookup.tenant)).stageOutcome?.status, "RECONCILE_REQUIRED", "invalid lookup preserves reconcile-required durable state");
  equal(invalidEnvelopeLookupProvider.lookupCount, 1, "invalid lookup performs exactly one provider lookup");
  equal((await pool.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND granted=true")).rows[0].count, 0, "invalid lookup releases reconciliation session lock");

  const pendingSelectionProvider = new DeterministicFakeV2Beta2Provider();
  const pendingSelectionCoordinator = createV2Beta2Coordinator({ repository, provider: pendingSelectionProvider });
  const pendingSelectionInitial = await requestFor(repository, 19, keyword(" selection pending baseline"), "selection-pending-baseline");
  const pendingSelectionBaseline = await pendingSelectionCoordinator.generate(pendingSelectionInitial.tenant, pendingSelectionInitial.request);
  const priorSelectionRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: pendingSelectionInitial.tenant.projectId, requestId: "beta2-selection-before-pending-0001", idempotencyKey: "beta2-selection-before-pending-key-0001", baseRevision: pendingSelectionBaseline.head.revision, baseContentHash: pendingSelectionBaseline.head.contentHash, selectedDirectionId: pendingSelectionBaseline.head.snapshot.directions[2].directionId };
  const priorSelection = await pendingSelectionCoordinator.saveSelection(pendingSelectionInitial.tenant, priorSelectionRequest);
  pendingSelectionProvider.setNextOutcome("COMPLETION_UNKNOWN");
  const pendingSelectionRequest = await requestFor(repository, 19, keyword(" selection pending stage"), "selection-pending-stage");
  const pendingSelectionOutcome = await pendingSelectionCoordinator.generate(pendingSelectionRequest.tenant, pendingSelectionRequest.request);
  equal(pendingSelectionOutcome.head.reconciliation?.status, "RECONCILE_REQUIRED", "pending source job retains last-good snapshot behind reconciliation fence");
  const priorSelectionReplayBefore = await truthAuthorityRows(pendingSelectionRequest.tenant.projectId);
  equal((await callSelectionCapability(pendingSelectionRequest.tenant, priorSelectionRequest, priorSelection.head.snapshot)).rows[0]?.replayed, true, "historical exact selection replay remains available behind a later pending stage");
  equal(await truthAuthorityRows(pendingSelectionRequest.tenant.projectId), priorSelectionReplayBefore, "historical selection replay has zero truth delta");
  const pendingSelectionBefore = await truthAuthorityRows(pendingSelectionRequest.tenant.projectId);
  const pendingSelectedDirectionId = pendingSelectionOutcome.head.snapshot.directions.find((item) => item.directionId !== pendingSelectionOutcome.head.snapshot.selectedDirectionId).directionId;
  await assert.rejects(() => pendingSelectionCoordinator.saveSelection(pendingSelectionRequest.tenant, { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: pendingSelectionRequest.tenant.projectId, requestId: "beta2-selection-pending-0001", idempotencyKey: "beta2-selection-pending-key-0001", baseRevision: pendingSelectionOutcome.head.revision, baseContentHash: pendingSelectionOutcome.head.contentHash, selectedDirectionId: pendingSelectedDirectionId }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_selection_not_available"); assertions += 1;
  equal(await truthAuthorityRows(pendingSelectionRequest.tenant.projectId), pendingSelectionBefore, "pending selection rejection appends zero snapshot/event truth");
  const pendingProviderCount = pendingSelectionProvider.submissionCount;
  const pendingEscapeRequest = await requestFor(repository, 19, keyword(" selection pending escape"), "selection-pending-escape");
  await assert.rejects(() => pendingSelectionCoordinator.generate(pendingEscapeRequest.tenant, pendingEscapeRequest.request), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  equal(pendingSelectionProvider.submissionCount, pendingProviderCount, "pending selection fence prevents a new stage from escaping reconciliation or submitting again");

  const rejectedSelectionProvider = new DeterministicFakeV2Beta2Provider();
  const rejectedSelectionCoordinator = createV2Beta2Coordinator({ repository, provider: rejectedSelectionProvider });
  const rejectedSelectionInitial = await requestFor(repository, 20, keyword(" selection rejected baseline"), "selection-rejected-baseline");
  await rejectedSelectionCoordinator.generate(rejectedSelectionInitial.tenant, rejectedSelectionInitial.request);
  rejectedSelectionProvider.setNextOutcome("TERMINAL_REJECTED");
  const rejectedSelectionRequest = await requestFor(repository, 20, keyword(" selection rejected stage"), "selection-rejected-stage");
  const rejectedSelectionOutcome = await rejectedSelectionCoordinator.generate(rejectedSelectionRequest.tenant, rejectedSelectionRequest.request);
  equal(rejectedSelectionOutcome.head.stageOutcome?.status, "REJECTED", "rejected source job retains exact terminal stage outcome beside last-good snapshot");
  const rejectedSelectionBefore = await truthAuthorityRows(rejectedSelectionRequest.tenant.projectId);
  const rejectedSelectedDirectionId = rejectedSelectionOutcome.head.snapshot.directions.find((item) => item.directionId !== rejectedSelectionOutcome.head.snapshot.selectedDirectionId).directionId;
  await assert.rejects(() => rejectedSelectionCoordinator.saveSelection(rejectedSelectionRequest.tenant, { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: rejectedSelectionRequest.tenant.projectId, requestId: "beta2-selection-rejected-0001", idempotencyKey: "beta2-selection-rejected-key-0001", baseRevision: rejectedSelectionOutcome.head.revision, baseContentHash: rejectedSelectionOutcome.head.contentHash, selectedDirectionId: rejectedSelectedDirectionId }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_selection_not_available"); assertions += 1;
  equal(await truthAuthorityRows(rejectedSelectionRequest.tenant.projectId), rejectedSelectionBefore, "rejected selection rejection appends zero snapshot/event truth");
  const rejectedProviderCount = rejectedSelectionProvider.submissionCount;
  const rejectedEscapeRequest = await requestFor(repository, 20, keyword(" selection rejected escape"), "selection-rejected-escape");
  await assert.rejects(() => rejectedSelectionCoordinator.generate(rejectedEscapeRequest.tenant, rejectedEscapeRequest.request), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_idempotency_conflict"); assertions += 1;
  equal(rejectedSelectionProvider.submissionCount, rejectedProviderCount, "rejected selection fence prevents a new provider submission from escaping terminal outcome");

  for (const [projectNumber, faultAt, label] of [[23, "AFTER_T1", "intent"], [24, "AFTER_T2_BEFORE_IO", "submitting"]]) {
    const globalFenceProvider = new DeterministicFakeV2Beta2Provider();
    const globalFenceCoordinator = createV2Beta2Coordinator({ repository, provider: globalFenceProvider });
    const globalFenceInitial = await requestFor(repository, projectNumber, keyword(` global ${label} baseline`), `global-${label}-baseline`);
    const globalFenceBaseline = await globalFenceCoordinator.generate(globalFenceInitial.tenant, globalFenceInitial.request);
    const oldSelectionRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: globalFenceInitial.tenant.projectId, requestId: `beta2-selection-global-${label}-0001`, idempotencyKey: `beta2-selection-global-${label}-key-0001`, baseRevision: globalFenceBaseline.head.revision, baseContentHash: globalFenceBaseline.head.contentHash, selectedDirectionId: globalFenceBaseline.head.snapshot.directions[2].directionId };
    const oldSelection = await globalFenceCoordinator.saveSelection(globalFenceInitial.tenant, oldSelectionRequest);
    const unresolvedRequest = await requestFor(repository, projectNumber, keyword(` global ${label} unresolved`), `global-${label}-unresolved`);
    await assert.rejects(() => globalFenceCoordinator.generate(unresolvedRequest.tenant, unresolvedRequest.request, { faultAt }), (error) => error instanceof V2Beta2SimulatedCrash && error.faultPoint === faultAt); assertions += 1;
    const historicalDirectBefore = await truthAuthorityRows(unresolvedRequest.tenant.projectId);
    equal((await callSelectionCapability(unresolvedRequest.tenant, oldSelectionRequest, oldSelection.head.snapshot)).rows[0]?.replayed, true, `historical ${label} direct replay succeeds`);
    equal(await truthAuthorityRows(unresolvedRequest.tenant.projectId), historicalDirectBefore, `historical ${label} direct replay has zero delta`);
    const historicalCoordinatorReplay = await globalFenceCoordinator.saveSelection(unresolvedRequest.tenant, oldSelectionRequest);
    equal(historicalCoordinatorReplay.replayed, true, `historical ${label} coordinator replay succeeds`);
    equal(historicalCoordinatorReplay.head, oldSelection.head, `historical ${label} replay returns original committed result`);
    equal(await truthAuthorityRows(unresolvedRequest.tenant.projectId), historicalDirectBefore, `historical ${label} coordinator replay has zero delta`);
    const unresolvedHead = await repository.readProjectHead(unresolvedRequest.tenant);
    const freshDirectionId = unresolvedHead.snapshot.directions.find((item) => item.directionId !== unresolvedHead.snapshot.selectedDirectionId).directionId;
    const freshSelectionRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: unresolvedRequest.tenant.projectId, requestId: `beta2-selection-global-${label}-fresh-0001`, idempotencyKey: `beta2-selection-global-${label}-fresh-key-0001`, baseRevision: unresolvedHead.revision, baseContentHash: unresolvedHead.contentHash, selectedDirectionId: freshDirectionId };
    const freshSnapshot = selectionSuccessor(unresolvedHead, freshDirectionId);
    await rejectsWithoutTruthDelta(unresolvedRequest.tenant.projectId, () => callSelectionCapability(unresolvedRequest.tenant, freshSelectionRequest, freshSnapshot), "beta2_selection_not_available");
  }

  const wrongSubmit = await requestFor(repository, 21, keyword(" wrong submit authority"), "wrong-submit-authority");
  let wrongSubmitCount = 0;
  const wrongSubmitCoordinator = createV2Beta2Coordinator({ repository, provider: {
    capability: localProviderCapability,
    async submit(input) { wrongSubmitCount += 1; return { completionClass: "COMPLETION_UNKNOWN", receiptCommitment: input.receiptCommitment, requestHash: "0".repeat(64) }; },
    async lookup() { throw new Error("lookup_not_expected"); },
  } });
  const wrongSubmitOutcome = await wrongSubmitCoordinator.generate(wrongSubmit.tenant, wrongSubmit.request);
  equal(wrongSubmitOutcome.head.stageOutcome?.status, "RECONCILE_REQUIRED", "correct-format wrong submit request authority fails closed to durable unknown");
  equal(wrongSubmitCount, 1, "wrong submit authority performs at most one provider I/O");

  const wrongLookup = await requestFor(repository, 22, keyword(" wrong lookup authority"), "wrong-lookup-authority");
  const wrongLookupProvider = new DeterministicFakeV2Beta2Provider();
  const wrongLookupCoordinator = createV2Beta2Coordinator({ repository, provider: wrongLookupProvider });
  const wrongLookupUnknown = await wrongLookupCoordinator.generate(wrongLookup.tenant, wrongLookup.request, { faultAt: "AFTER_SUCCESS_BEFORE_TRUTH_COMMIT" });
  const wrongLookupJob = await repository.getJob(wrongLookup.tenant, wrongLookupUnknown.head.reconciliation.jobId);
  const wrongLookupAuthorityCoordinator = createV2Beta2Coordinator({ repository, provider: {
    capability: localProviderCapability,
    async submit() { throw new Error("submit_not_expected"); },
    async lookup(input) { return { status: "PENDING", receiptCommitment: input.receiptCommitment, requestHash: "0".repeat(64) }; },
  } });
  const wrongLookupBefore = await truthAuthorityRows(wrongLookup.tenant.projectId);
  await assert.rejects(() => wrongLookupAuthorityCoordinator.reconcile(wrongLookup.tenant, { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: wrongLookup.tenant.projectId, requestId: "beta2-reconcile-wrong-request-0001", jobId: wrongLookupJob.jobId }), (error) => error instanceof V2Beta2RepositoryError && error.code === "beta2_reconciliation_authority_invalid"); assertions += 1;
  equal(await truthAuthorityRows(wrongLookup.tenant.projectId), wrongLookupBefore, "correct-format wrong lookup request authority writes zero truth delta");

  const deleteHistory = await pool.query("DELETE FROM beta2_project_events WHERE false").then(() => false, () => true);
  equal(deleteHistory, true, "restricted app role cannot delete history");
  const truncateHistory = await pool.query("TRUNCATE beta2_project_events").then(() => false, () => true);
  equal(truncateHistory, true, "restricted app role cannot truncate history");
  const mutateFormal = await pool.query("DELETE FROM research_documents WHERE false").then(() => false, () => true);
  equal(mutateFormal, true, "restricted app role cannot mutate formal research tables");
  const mutateBaseline = await pool.query("DELETE FROM workspace_members WHERE false").then(() => false, () => true);
  equal(mutateBaseline, true, "restricted app role cannot mutate baseline tenant tables");
  const roleAuthority = await pool.query("SELECT current_user AS user, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user");
  equal(roleAuthority.rows[0], { user: "old_mike_beta2_app_local", rolsuper: false, rolcreatedb: false, rolcreaterole: false }, "repository tests execute as real restricted non-owner login");

  console.log(JSON.stringify({ status: "PASS", contractVersion: V2_BETA2_CONTRACT_VERSION, groups: 44, assertions, restrictedRole: roleAuthority.rows[0].user, providerSubmissions: { basic: basicProvider.submissionCount, partial: partialProvider.submissionCount, t1: t1Provider.submissionCount, t2: t2Provider.submissionCount, io: ioProvider.submissionCount, gap: gapProvider.submissionCount, concurrent: concurrentProvider.submissionCount, submitting: submittingProvider.submissionCount, reconcileFence: reconcileFenceProvider.submissionCount, mismatch: mismatchProvider.submissionCount, rejected: rejectedProvider.submissionCount, generationRejected: generationRejectedProvider.submissionCount, invalidSubmit: invalidSubmitCount, pendingSelection: pendingSelectionProvider.submissionCount, rejectedSelection: rejectedSelectionProvider.submissionCount, wrongSubmit: wrongSubmitCount }, lookupSemantics: { terminalizingComplete: mismatchProvider.lookupCount, terminalizingRejected: rejectedProvider.lookupCount, sequentialNonterminal: reconcileFenceProvider.lookupCount, invalidEnvelope: invalidEnvelopeLookupProvider.lookupCount }, selectionFence: "DB_CAPABILITY_GLOBAL_UNRESOLVED_FENCE_DERIVED_SUCCESSOR_COMPLETE_CURRENT_STAGE_ONLY", confirmedWorkspace: "DB_DERIVED_S0_ASSIST_SUCCESSOR_EXACT_REPLAY_AND_TAMPER_REJECTION", durableOutcomeResume: "COMPLETE_RECONCILE_REQUIRED_REJECTED_EXACT_CURRENT_HEAD_JOB_ONLY", formalResearchWrites: 0 }));
} finally {
  await pool.end();
}
