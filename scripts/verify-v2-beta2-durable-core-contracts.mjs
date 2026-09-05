import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import { S0_FIELD_NAMES, S0_TEXT_FIELD_NAMES } from "../lib/s0-fields.ts";
import {
  V2_BETA2_CONTRACT_VERSION,
  V2_BETA2_DURABILITY_CLASS,
  V2_BETA2_TRUST_CLASS,
  beta2Hash,
  createV2Beta2ConfirmedWorkspace,
  createV2Beta2Direction,
  createV2Beta2DurableSnapshot,
  createV2Beta2GenerationPayloadHash,
  createV2Beta2InitialHead,
  createV2Beta2Material,
  createV2Beta2ProviderResult,
  createV2Beta2RequestAuthority,
  createV2Beta2ReconciliationRequestHash,
  createV2Beta2Source,
  createV2Beta2StageInstanceHash,
  createV2Beta2StageOutcome,
  parseV2Beta2DurableSnapshot,
  parseV2Beta2MutationRequest,
  parseV2Beta2ProviderResult,
  parseV2Beta2ProviderLookupOutcome,
  parseV2Beta2ProviderSubmitOutcome,
  parseV2Beta2SuccessEnvelope,
} from "../lib/v2-beta2/contracts.ts";
import { validateV2Beta2DisposableDatabaseUrl, v2Beta2FakeProviderEnabled, v2Beta2LocalFixtureEnabled } from "../lib/v2-beta2/environment.ts";
import { DeterministicFakeV2Beta2Provider } from "../lib/v2-beta2/fake-provider.ts";

let assertions = 0;
const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };
const rejects = (operation, code) => {
  assertions += 1;
  assert.throws(operation, (error) => error instanceof Error && error.message === code);
};

const partialMaterials = [
  createV2Beta2Material({ materialId: "beta2-material-results", kind: "RESULTS", title: "結果", content: "目前觀察到描述性差異；因果、顯著性與外推仍待驗證。" }),
  createV2Beta2Material({ materialId: "beta2-material-statistics", kind: "STATISTICS", title: "統計", content: "主要指標為 82%；分母、估計量與不確定性仍待核對。" }),
];
const source = createV2Beta2Source({
  entryMode: "PARTIAL_MATERIAL",
  researchDirection: "整合生成式回饋材料檢驗證據校準與任務表現的作用機制",
  outputTarget: "SCI",
  materials: partialMaterials,
});
const initial = createV2Beta2InitialHead("beta2-project-01");
const stageInstanceHash = createV2Beta2StageInstanceHash({ workspaceId: "beta2-workspace-01", projectId: "beta2-project-01", baseRevision: initial.revision, baseContentHash: initial.contentHash });
const receiptCommitment = beta2Hash({ namespace: "contract-receipt", stageInstanceHash });
const provider = new DeterministicFakeV2Beta2Provider();
const providerOutcome = await provider.submit({ jobId: `beta2-job-${stageInstanceHash.slice(0, 32)}`, stageInstanceHash, requestHash: beta2Hash({ source }), receiptCommitment, source });
check(providerOutcome.completionClass === "COMPLETE", "fake provider must complete by default");
check(parseV2Beta2ProviderSubmitOutcome(providerOutcome).completionClass === "COMPLETE", "runtime submit parser accepts exact complete envelope");
const providerResult = parseV2Beta2ProviderResult(providerOutcome.result);
check(provider.submissionCount === 1, "fake provider submission count");
check(providerResult.directions.length === 3, "exactly three directions");
check(providerResult.directions.filter((item) => item.recommended).length === 1, "exactly one recommendation");
check(providerResult.recommendedDirectionId === providerResult.directions[1].directionId, "balanced lane is recommended");
check(providerResult.directions.every((item) => Object.keys(item.s0).length === 13 && S0_FIELD_NAMES.every((field) => item.s0[field].length > 0)), "all directions contain complete S0");
check(providerResult.directions.reduce((sum, item) => sum + S0_FIELD_NAMES.reduce((fieldSum, field) => fieldSum + item.fieldAssist[field].length, 0), 0) === 117, "117 Field Assist options");
check(providerResult.directions.every((item) => S0_TEXT_FIELD_NAMES.every((field) => item.fieldAssist[field].every((option) => option.text === option.applyValue))), "editable text/apply parity");
check(providerResult.directions.every((item) => item.humanReadableArtifact.markdown.endsWith("\n")), "human-readable artifact is complete text");
check(source.materials.map((item) => item.materialId).join("|") === "beta2-material-results|beta2-material-statistics", "material order preserved");
check(source.materialCoverage.RESULTS === "PROVIDED_UNVERIFIED" && source.materialCoverage.STATISTICS === "PROVIDED_UNVERIFIED", "provided material remains explicitly unverified");
check(source.materialCoverage.ABSTRACT === "MISSING" && source.materialCoverage.INTRODUCTION === "MISSING" && source.materialCoverage.METHODS === "MISSING", "missing core sections remain explicit typed gaps");
const rawMaterialInputs = ["  leading/trailing  ", "LF\nline\n", "CRLF\r\nline\r\n", "lone-CR\rline", "astral 😀", "combining e\u0301"];
const rawMaterialKinds = ["ABSTRACT", "METHODS", "RESULTS", "STATISTICS", "ABSTRACT", "METHODS"];
const rawMaterials = rawMaterialInputs.map((content, index) => createV2Beta2Material({ materialId: `beta2-material-raw-${index}`, kind: rawMaterialKinds[index], title: `Raw ${index}`, content }));
check(rawMaterials.every((material, index) => material.content === rawMaterialInputs[index]), "material content preserves exact JS strings");
check(rawMaterials.every((material) => material.contentByteLength === new TextEncoder().encode(material.content).byteLength), "material authority binds exact UTF-8 byte lengths");
for (const [index, content] of [" ", "\t\r\n", "\u00a0", "\u1680\u2009\u202f", "\u3000", "\ufeff"] .entries()) {
  rejects(() => createV2Beta2Material({ materialId: `beta2-material-blank-${index}`, kind: "ABSTRACT", title: `Blank ${index}`, content }), "beta2_material_content_invalid");
}

const snapshot = parseV2Beta2DurableSnapshot({
  schemaId: "old-mike-v2-beta2/durable-snapshot/1",
  contractVersion: V2_BETA2_CONTRACT_VERSION,
  durabilityClass: V2_BETA2_DURABILITY_CLASS,
  projectId: "beta2-project-01",
  revision: 1,
  source,
  directions: providerResult.directions,
  recommendedDirectionId: providerResult.recommendedDirectionId,
  selectedDirectionId: providerResult.selectedDirectionId,
  s0Summary: providerResult.directions[1].s0,
  fieldAssist: providerResult.directions[1].fieldAssist,
  humanReadableArtifact: providerResult.directions[1].humanReadableArtifact,
  confirmedWorkspace: null,
  stageId: "DURABLE_CORE_GENERATION",
  stageInstanceHash,
  jobId: `beta2-job-${stageInstanceHash.slice(0, 32)}`,
  providerSubmissionCount: 1,
  persistenceStatus: "SAVED",
  formalResearchWriteCount: 0,
  contentHash: beta2Hash({
    schemaId: "old-mike-v2-beta2/durable-snapshot/1",
    contractVersion: V2_BETA2_CONTRACT_VERSION,
    durabilityClass: V2_BETA2_DURABILITY_CLASS,
    projectId: "beta2-project-01",
    revision: 1,
    source,
    directions: providerResult.directions,
    recommendedDirectionId: providerResult.recommendedDirectionId,
    selectedDirectionId: providerResult.selectedDirectionId,
    s0Summary: providerResult.directions[1].s0,
    fieldAssist: providerResult.directions[1].fieldAssist,
    humanReadableArtifact: providerResult.directions[1].humanReadableArtifact,
    confirmedWorkspace: null,
    stageId: "DURABLE_CORE_GENERATION",
    stageInstanceHash,
    jobId: `beta2-job-${stageInstanceHash.slice(0, 32)}`,
    providerSubmissionCount: 1,
    persistenceStatus: "SAVED",
    formalResearchWriteCount: 0,
  }),
}, { projectId: "beta2-project-01" });
check(snapshot.contentHash.length === 64, "durable snapshot canonical hash");

const responseGenerationRequest = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-contract-generation-0001", idempotencyKey: "beta2-contract-generation-key-0001", baseRevision: 0, baseContentHash: initial.contentHash, source };
const generationRequestId = responseGenerationRequest.requestId;
const generationRequestHash = createV2Beta2GenerationPayloadHash(responseGenerationRequest);
const stageOutcome = createV2Beta2StageOutcome("beta2-project-01", {
  jobId: snapshot.jobId,
  stageInstanceHash,
  generationRequestId,
  generationRequestHash,
  status: "COMPLETE",
  completionClass: "COMPLETE",
  providerSubmissionCount: 1,
  providerReceiptCommitment: receiptCommitment,
  providerResultHash: providerResult.resultHash,
  reasonCode: null,
  terminalEvent: { eventType: "GENERATION_COMPLETE", operation: "GENERATE_DURABLE_CORE", requestId: generationRequestId, requestHash: generationRequestHash },
});

const envelope = parseV2Beta2SuccessEnvelope({
  ok: true,
  contractVersion: V2_BETA2_CONTRACT_VERSION,
  trustClass: V2_BETA2_TRUST_CLASS,
  durabilityClass: V2_BETA2_DURABILITY_CLASS,
  operation: "RESUME",
  requestAuthority: null,
  project: { projectId: "beta2-project-01", revision: 1, contentHash: snapshot.contentHash, snapshot, reconciliation: null, stageOutcome },
  replayed: true,
  providerSubmissionDelta: 0,
  snapshotAppendDelta: 0,
  eventAppendDelta: 0,
  formalResearchWriteCount: 0,
  liveProviderCallCount: 0,
}, { projectId: "beta2-project-01", request: null });
check(envelope.project.snapshot?.contentHash === snapshot.contentHash, "success envelope validates durable snapshot");
const confirmedDirection = snapshot.directions.find((direction) => direction.directionId === snapshot.selectedDirectionId);
assert.ok(confirmedDirection);
const appliedAssistOptionIds = Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, null]));
const confirmedS0 = { ...confirmedDirection.s0 };
const confirmedOption = confirmedDirection.fieldAssist.workingTitle[0];
appliedAssistOptionIds.workingTitle = confirmedOption.optionId;
confirmedS0.workingTitle = confirmedOption.applyValue;
const confirmedWorkspace = createV2Beta2ConfirmedWorkspace({ selectedDirectionId: confirmedDirection.directionId, s0: confirmedS0, appliedAssistOptionIds }, confirmedDirection);
const responseRequests = {
  GENERATE_DURABLE_CORE: responseGenerationRequest,
  SAVE_DIRECTION_SELECTION: { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_DIRECTION_SELECTION", projectId: "beta2-project-01", requestId: "beta2-response-selection-0001", idempotencyKey: "beta2-response-selection-key-0001", baseRevision: 1, baseContentHash: snapshot.contentHash, selectedDirectionId: snapshot.directions[0].directionId },
  SAVE_CONFIRMED_WORKSPACE: { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "SAVE_CONFIRMED_WORKSPACE", projectId: "beta2-project-01", requestId: "beta2-response-workspace-0001", idempotencyKey: "beta2-response-workspace-key-0001", baseRevision: 1, baseContentHash: snapshot.contentHash, selectedDirectionId: confirmedDirection.directionId, s0Summary: confirmedS0, appliedAssistOptionIds },
  RECONCILE_UNKNOWN: { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: "beta2-project-01", requestId: "beta2-response-reconcile-0001", jobId: snapshot.jobId },
};
const selectionSnapshot = createV2Beta2DurableSnapshot({
  projectId: snapshot.projectId,
  revision: 2,
  source: snapshot.source,
  directions: snapshot.directions,
  recommendedDirectionId: snapshot.recommendedDirectionId,
  selectedDirectionId: responseRequests.SAVE_DIRECTION_SELECTION.selectedDirectionId,
  stageId: snapshot.stageId,
  stageInstanceHash: snapshot.stageInstanceHash,
  jobId: snapshot.jobId,
  persistenceStatus: "SAVED",
});
const selectionProject = { projectId: snapshot.projectId, revision: 2, contentHash: selectionSnapshot.contentHash, snapshot: selectionSnapshot, reconciliation: null, stageOutcome };
const confirmedSnapshot = createV2Beta2DurableSnapshot({
  projectId: snapshot.projectId,
  revision: 2,
  source: snapshot.source,
  directions: snapshot.directions,
  recommendedDirectionId: snapshot.recommendedDirectionId,
  selectedDirectionId: snapshot.selectedDirectionId,
  confirmedWorkspace,
  stageId: snapshot.stageId,
  stageInstanceHash: snapshot.stageInstanceHash,
  jobId: snapshot.jobId,
  persistenceStatus: "SAVED",
});
check(confirmedSnapshot.s0Summary.workingTitle === confirmedS0.workingTitle, "confirmed snapshot binds effective S0");
check(confirmedSnapshot.humanReadableArtifact.markdown.includes(confirmedS0.workingTitle), "confirmed artifact renders effective S0");
check(confirmedSnapshot.humanReadableArtifact.artifactHash !== confirmedDirection.humanReadableArtifact.artifactHash, "confirmed artifact changes without mutating provider direction artifact");
const confirmedProject = { projectId: snapshot.projectId, revision: 2, contentHash: confirmedSnapshot.contentHash, snapshot: confirmedSnapshot, reconciliation: null, stageOutcome };
const reconciliationRequestHash = createV2Beta2ReconciliationRequestHash(responseRequests.RECONCILE_UNKNOWN);
const reconciliationStageOutcome = createV2Beta2StageOutcome(snapshot.projectId, {
  jobId: snapshot.jobId,
  stageInstanceHash,
  generationRequestId,
  generationRequestHash,
  status: "COMPLETE",
  completionClass: "COMPLETE",
  providerSubmissionCount: 1,
  providerReceiptCommitment: receiptCommitment,
  providerResultHash: providerResult.resultHash,
  reasonCode: null,
  terminalEvent: { eventType: "RECONCILIATION_COMPLETE", operation: "RECONCILE_UNKNOWN", requestId: responseRequests.RECONCILE_UNKNOWN.requestId, requestHash: reconciliationRequestHash },
});
const reconciliationProject = { projectId: snapshot.projectId, revision: 1, contentHash: snapshot.contentHash, snapshot, reconciliation: null, stageOutcome: reconciliationStageOutcome };
const correlated = (operation, delta) => {
  const request = operation === "RESUME" ? null : responseRequests[operation];
  const project = operation === "SAVE_DIRECTION_SELECTION" ? selectionProject : operation === "SAVE_CONFIRMED_WORKSPACE" ? confirmedProject : operation === "RECONCILE_UNKNOWN" ? reconciliationProject : envelope.project;
  return { value: { ...envelope, operation, requestAuthority: request === null ? null : createV2Beta2RequestAuthority(request), project, ...delta }, expectation: { projectId: "beta2-project-01", request } };
};
for (const semanticControl of [
  correlated("GENERATE_DURABLE_CORE", { replayed: false, providerSubmissionDelta: 1, snapshotAppendDelta: 1, eventAppendDelta: 1 }),
  correlated("GENERATE_DURABLE_CORE", { replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }),
  correlated("SAVE_DIRECTION_SELECTION", { replayed: false, providerSubmissionDelta: 0, snapshotAppendDelta: 1, eventAppendDelta: 1 }),
  correlated("SAVE_DIRECTION_SELECTION", { replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }),
  correlated("SAVE_CONFIRMED_WORKSPACE", { replayed: false, providerSubmissionDelta: 0, snapshotAppendDelta: 1, eventAppendDelta: 1 }),
  correlated("SAVE_CONFIRMED_WORKSPACE", { replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }),
  correlated("RECONCILE_UNKNOWN", { replayed: false, providerSubmissionDelta: 0, snapshotAppendDelta: 1, eventAppendDelta: 1 }),
  correlated("RECONCILE_UNKNOWN", { replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }),
]) check(parseV2Beta2SuccessEnvelope(semanticControl.value, semanticControl.expectation).operation === semanticControl.value.operation, `success semantic matrix accepts exact ${semanticControl.value.operation} tuple`);
for (const semanticTamper of [
  correlated("RESUME", { snapshotAppendDelta: 1 }),
  correlated("RECONCILE_UNKNOWN", { providerSubmissionDelta: 1 }),
  { ...correlated("GENERATE_DURABLE_CORE", { replayed: false, providerSubmissionDelta: 1, snapshotAppendDelta: 0, eventAppendDelta: 1 }), value: { ...correlated("GENERATE_DURABLE_CORE", {}).value, project: initial, replayed: false, providerSubmissionDelta: 1, snapshotAppendDelta: 0, eventAppendDelta: 1 } },
  correlated("SAVE_DIRECTION_SELECTION", { providerSubmissionDelta: 1 }),
  correlated("SAVE_CONFIRMED_WORKSPACE", { providerSubmissionDelta: 1 }),
]) rejects(() => parseV2Beta2SuccessEnvelope(semanticTamper.value, semanticTamper.expectation), "beta2_response_invalid");
const rotatedGeneration = { ...responseRequests.GENERATE_DURABLE_CORE, requestId: "beta2-response-generate-rotated", idempotencyKey: "beta2-response-generate-key-rotated" };
const rotatedEnvelope = correlated("GENERATE_DURABLE_CORE", { replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }).value;
rejects(() => parseV2Beta2SuccessEnvelope(rotatedEnvelope, { projectId: rotatedGeneration.projectId, request: rotatedGeneration }), "beta2_request_authority_invalid");
const wrongKeyGeneration = { ...rotatedGeneration, idempotencyKey: "beta2-response-generate-key-wrong" };
rejects(() => parseV2Beta2SuccessEnvelope({ ...rotatedEnvelope, requestAuthority: createV2Beta2RequestAuthority(wrongKeyGeneration) }, { projectId: rotatedGeneration.projectId, request: rotatedGeneration }), "beta2_request_authority_invalid");
const wrongEffectGeneration = { ...rotatedGeneration, source: createV2Beta2Source({ entryMode: "KEYWORD", researchDirection: "不同 effect payload 不得借用 durable origin", outputTarget: "SCI", materials: [] }) };
rejects(() => parseV2Beta2SuccessEnvelope({ ...rotatedEnvelope, requestAuthority: createV2Beta2RequestAuthority(wrongEffectGeneration) }, { projectId: wrongEffectGeneration.projectId, request: wrongEffectGeneration }), "beta2_response_invalid");
const falseFreshRotatedEnvelope = {
  ...rotatedEnvelope,
  requestAuthority: createV2Beta2RequestAuthority(rotatedGeneration),
  replayed: false,
  providerSubmissionDelta: 1,
  snapshotAppendDelta: 1,
  eventAppendDelta: 1,
};
rejects(() => parseV2Beta2SuccessEnvelope(falseFreshRotatedEnvelope, { projectId: rotatedGeneration.projectId, request: rotatedGeneration }), "beta2_response_invalid");
const mismatchedSelectionRequest = { ...responseRequests.SAVE_DIRECTION_SELECTION, selectedDirectionId: snapshot.directions[2].directionId };
const mismatchedSelectionEnvelope = {
  ...correlated("SAVE_DIRECTION_SELECTION", { replayed: false, providerSubmissionDelta: 0, snapshotAppendDelta: 1, eventAppendDelta: 1 }).value,
  requestAuthority: createV2Beta2RequestAuthority(mismatchedSelectionRequest),
};
rejects(() => parseV2Beta2SuccessEnvelope(mismatchedSelectionEnvelope, { projectId: mismatchedSelectionRequest.projectId, request: mismatchedSelectionRequest }), "beta2_response_invalid");
const mismatchedReconciliationRequest = { ...responseRequests.RECONCILE_UNKNOWN, jobId: "beta2-job-unrelated-0001" };
const mismatchedReconciliationEnvelope = {
  ...correlated("RECONCILE_UNKNOWN", { replayed: true, providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 }).value,
  requestAuthority: createV2Beta2RequestAuthority(mismatchedReconciliationRequest),
};
rejects(() => parseV2Beta2SuccessEnvelope(mismatchedReconciliationEnvelope, { projectId: mismatchedReconciliationRequest.projectId, request: mismatchedReconciliationRequest }), "beta2_response_invalid");

const exactUnknownSubmit = { completionClass: "COMPLETION_UNKNOWN", receiptCommitment, requestHash: generationRequestHash };
const exactRejectedSubmit = { completionClass: "TERMINAL_REJECTED", receiptCommitment, requestHash: generationRequestHash, reasonCode: "FAKE_PROVIDER_REJECTED" };
check(parseV2Beta2ProviderSubmitOutcome(exactUnknownSubmit).completionClass === "COMPLETION_UNKNOWN", "runtime submit parser accepts exact unknown envelope");
check(parseV2Beta2ProviderSubmitOutcome(exactRejectedSubmit).completionClass === "TERMINAL_REJECTED", "runtime submit parser accepts exact rejected envelope");
for (const malformed of [
  null,
  [],
  { ...exactUnknownSubmit, completionClass: "complete" },
  { ...exactUnknownSubmit, completionClass: " COMPLETE " },
  { ...exactUnknownSubmit, completionClass: null },
  { completionClass: "COMPLETION_UNKNOWN", receiptCommitment },
  { ...exactUnknownSubmit, receiptCommitment: 1 },
  { ...exactUnknownSubmit, requestHash: "0".repeat(63) },
  { ...exactUnknownSubmit, requestHash: "A".repeat(64) },
  { ...exactUnknownSubmit, result: providerResult },
  { ...providerOutcome, extra: true },
  { ...providerOutcome, result: { ...providerResult, resultHash: "0".repeat(64) } },
]) rejects(() => parseV2Beta2ProviderSubmitOutcome(malformed), "beta2_provider_submit_invalid");

for (const status of ["NOT_FOUND", "PENDING", "REJECTED", "UNKNOWN"]) {
  const lookup = parseV2Beta2ProviderLookupOutcome({ status, receiptCommitment, requestHash: generationRequestHash });
  check(lookup.status === status, `runtime lookup parser accepts exact ${status} envelope`);
}
check(parseV2Beta2ProviderLookupOutcome({ status: "COMPLETE", receiptCommitment, requestHash: generationRequestHash, result: providerResult }).status === "COMPLETE", "runtime lookup parser accepts exact complete envelope");
for (const malformed of [
  null,
  [],
  { status: "complete", receiptCommitment, requestHash: generationRequestHash },
  { status: " PENDING", receiptCommitment, requestHash: generationRequestHash },
  { status: null, receiptCommitment, requestHash: generationRequestHash },
  { status: "PENDING", receiptCommitment },
  { status: "PENDING", receiptCommitment: {}, requestHash: generationRequestHash },
  { status: "PENDING", receiptCommitment, requestHash: generationRequestHash, result: providerResult },
  { status: "COMPLETE", receiptCommitment, requestHash: generationRequestHash },
  { status: "COMPLETE", receiptCommitment, requestHash: generationRequestHash, result: { ...providerResult, extra: true } },
  { status: "UNKNOWN", receiptCommitment, requestHash: "f".repeat(63) },
  { status: "UNKNOWN", receiptCommitment, requestHash: "F".repeat(64) },
  { status: "UNKNOWN", receiptCommitment, requestHash: generationRequestHash, extra: true },
]) rejects(() => parseV2Beta2ProviderLookupOutcome(malformed), "beta2_provider_lookup_invalid");

const malformedDirections = structuredClone(providerResult);
malformedDirections.directions.pop();
malformedDirections.resultHash = beta2Hash({ ...malformedDirections, resultHash: undefined });
rejects(() => parseV2Beta2ProviderResult(malformedDirections), "beta2_direction_set_invalid");
rejects(() => createV2Beta2ProviderResult({ ...providerResult, directions: [...providerResult.directions, providerResult.directions[0]] }), "beta2_direction_set_invalid");
const recreateDirection = (direction, recommended) => createV2Beta2Direction({ directionId: direction.directionId, lane: direction.lane, recommended, title: direction.title, researchQuestion: direction.researchQuestion, mechanism: direction.mechanism, method: direction.method, contribution: direction.contribution, s0: direction.s0, domain: direction.domain, outputTarget: direction.outputTarget, inputBundleHash: direction.inputBundleHash });
rejects(() => createV2Beta2ProviderResult({ ...providerResult, directions: providerResult.directions.map((direction) => recreateDirection(direction, false)) }), "beta2_recommendation_invalid");
rejects(() => createV2Beta2ProviderResult({ ...providerResult, directions: providerResult.directions.map((direction, index) => recreateDirection(direction, index > 0)) }), "beta2_recommendation_invalid");
const missingS0 = structuredClone(providerResult);
delete missingS0.directions[0].s0.timeline;
rejects(() => parseV2Beta2ProviderResult(missingS0), "beta2_s0_invalid");
const driftedMaterial = structuredClone(source);
driftedMaterial.materials[0].content += "竄改";
rejects(() => parseV2Beta2MutationRequest({ contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-00000001", idempotencyKey: "beta2-idempotency-0001", baseRevision: 0, baseContentHash: initial.contentHash, source: driftedMaterial }), "beta2_material_invalid");
const driftedCoverage = structuredClone(source);
driftedCoverage.materialCoverage.ABSTRACT = "PROVIDED_UNVERIFIED";
rejects(() => parseV2Beta2MutationRequest({ contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-coverage-0001", idempotencyKey: "beta2-idempotency-coverage-0001", baseRevision: 0, baseContentHash: initial.contentHash, source: driftedCoverage }), "beta2_source_invalid");
rejects(() => createV2Beta2ConfirmedWorkspace({ ...confirmedWorkspace, appliedAssistOptionIds: { ...confirmedWorkspace.appliedAssistOptionIds, workingTitle: "beta2-assist-unknown" } }, confirmedDirection), "beta2_confirmed_workspace_invalid");
const mismatchedConfirmedRequest = { ...responseRequests.SAVE_CONFIRMED_WORKSPACE, s0Summary: { ...responseRequests.SAVE_CONFIRMED_WORKSPACE.s0Summary, workingTitle: confirmedDirection.s0.workingTitle } };
rejects(() => parseV2Beta2SuccessEnvelope({ ...correlated("SAVE_CONFIRMED_WORKSPACE", { replayed: false, providerSubmissionDelta: 0, snapshotAppendDelta: 1, eventAppendDelta: 1 }).value, requestAuthority: createV2Beta2RequestAuthority(mismatchedConfirmedRequest) }, { projectId: mismatchedConfirmedRequest.projectId, request: mismatchedConfirmedRequest }), "beta2_response_invalid");
rejects(() => parseV2Beta2MutationRequest({ contractVersion: "old-mike-v2-beta2/2.0.0-alpha.2", operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-00000001", idempotencyKey: "beta2-idempotency-0001", baseRevision: 0, baseContentHash: initial.contentHash, source }), "beta2_contract_or_operation_invalid");
rejects(() => parseV2Beta2MutationRequest({ contractVersion: "old-mike-v2-beta2/2.0.0-alpha.3", operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-00000001", idempotencyKey: "beta2-idempotency-0001", baseRevision: 0, baseContentHash: initial.contentHash, source }), "beta2_contract_or_operation_invalid");
rejects(() => parseV2Beta2MutationRequest({ contractVersion: "old-mike-v2-beta2/2.0.0-alpha.4", operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-00000001", idempotencyKey: "beta2-idempotency-0001", baseRevision: 0, baseContentHash: initial.contentHash, source }), "beta2_contract_or_operation_invalid");
rejects(() => parseV2Beta2MutationRequest({ contractVersion: "old-mike-v2-beta2/2.0.0-alpha.5", operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-00000001", idempotencyKey: "beta2-idempotency-0001", baseRevision: 0, baseContentHash: initial.contentHash, source }), "beta2_contract_or_operation_invalid");
rejects(() => parseV2Beta2MutationRequest({ contractVersion: "old-mike-v2-beta2/2.0.0-alpha.6", operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-00000001", idempotencyKey: "beta2-idempotency-0001", baseRevision: 0, baseContentHash: initial.contentHash, source }), "beta2_contract_or_operation_invalid");
rejects(() => parseV2Beta2MutationRequest({ contractVersion: "old-mike-v2-beta2/2.0.0-alpha.7", operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-00000001", idempotencyKey: "beta2-idempotency-0001", baseRevision: 0, baseContentHash: initial.contentHash, source }), "beta2_contract_or_operation_invalid");
rejects(() => parseV2Beta2MutationRequest({ contractVersion: "old-mike-v2-beta2/2.0.0-alpha.8", operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-00000001", idempotencyKey: "beta2-idempotency-0001", baseRevision: 0, baseContentHash: initial.contentHash, source }), "beta2_contract_or_operation_invalid");
rejects(() => parseV2Beta2MutationRequest({ contractVersion: "old-mike-v2-beta2/2.0.0-alpha.9", operation: "GENERATE_DURABLE_CORE", projectId: "beta2-project-01", requestId: "beta2-request-00000001", idempotencyKey: "beta2-idempotency-0001", baseRevision: 0, baseContentHash: initial.contentHash, source }), "beta2_contract_or_operation_invalid");
rejects(() => parseV2Beta2MutationRequest({ contractVersion: "old-mike-v2-beta1/1.7.20", operation: "GENERATE_DURABLE_CORE" }), "beta2_contract_or_operation_invalid");
rejects(() => parseV2Beta2SuccessEnvelope({ ...envelope, liveProviderCallCount: 1 }, { projectId: "beta2-project-01", request: null }), "beta2_response_invalid");
rejects(() => parseV2Beta2SuccessEnvelope({ ...envelope, extra: true }, { projectId: "beta2-project-01", request: null }), "beta2_response_invalid");

const disposableUrl = "postgresql://old_mike_beta2_app_local@127.0.0.1:55432/old_mike_beta2_disposable_contract?application_name=old_mike_beta2_disposable";
check(validateV2Beta2DisposableDatabaseUrl(disposableUrl).startsWith("postgresql://"), "loopback disposable URL accepted");
for (const bad of [
  "postgresql://old_mike_beta2_app_local@example.com/old_mike_beta2_disposable_contract?application_name=old_mike_beta2_disposable",
  "postgresql://old_mike_beta2_app_local@127.0.0.1/production?application_name=old_mike_beta2_disposable",
  "postgresql://postgres@127.0.0.1:55432/old_mike_beta2_disposable_contract?application_name=old_mike_beta2_disposable",
]) rejects(() => validateV2Beta2DisposableDatabaseUrl(bad), "beta2_disposable_database_url_invalid");
const passwordBearingUrl = new URL(disposableUrl);
passwordBearingUrl.password = ["not", "allowed"].join("-");
rejects(() => validateV2Beta2DisposableDatabaseUrl(passwordBearingUrl.toString()), "beta2_disposable_database_url_invalid");
const fixtureEnv = { NODE_ENV: "development", INTEGRATION_TEST_MODE: "1", TEST_FIXTURE: "1", OLD_MIKE_V2_BETA2_ENABLED: "1", OLD_MIKE_V2_BETA2_FAKE_AUTH: "1", OLD_MIKE_V2_BETA2_FAKE_PROVIDER: "1", BETA2_DISPOSABLE_DATABASE_URL: disposableUrl };
check(v2Beta2LocalFixtureEnabled(fixtureEnv), "exact local fixture profile enabled");
check(!v2Beta2LocalFixtureEnabled({ ...fixtureEnv, OLD_MIKE_V2_BETA2_ENABLED: "0" }), "feature-off profile rejected");
check(!v2Beta2LocalFixtureEnabled({ ...fixtureEnv, DATABASE_URL: disposableUrl }), "ambient DATABASE_URL rejected");
check(!v2Beta2LocalFixtureEnabled({ ...fixtureEnv, OLD_MIKE_V2_BETA2_LIVE_PROVIDER_ENABLED: "1" }), "live provider capability rejected");
const realAuthFakeProviderEnv = { NODE_ENV: "development", INTEGRATION_TEST_MODE: "1", TEST_FIXTURE: "1", OLD_MIKE_V2_BETA2_ENABLED: "1", OLD_MIKE_V2_BETA2_FAKE_PROVIDER: "1", BETA2_DISPOSABLE_DATABASE_URL: disposableUrl };
check(v2Beta2FakeProviderEnabled(realAuthFakeProviderEnv), "real-session local fake provider profile enabled");
check(!v2Beta2FakeProviderEnabled({ ...realAuthFakeProviderEnv, OLD_MIKE_V2_BETA2_LIVE_PROVIDER_ENABLED: "1" }), "fake provider rejects live capability");

const reconciliationHashFixture = { contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId: "beta2-project-01", requestId: "beta2-reconcile-hash-0001", jobId: "beta2-job-hash-0001" };
const reconciliationHashBytes = '{"jobId":"beta2-job-hash-0001","operation":"RECONCILE_UNKNOWN","requestId":"beta2-reconcile-hash-0001"}';
check(createV2Beta2ReconciliationRequestHash(reconciliationHashFixture) === createHash("sha256").update(reconciliationHashBytes, "utf8").digest("hex"), "reconciliation request hash matches independent canonical literal");

const descriptor = JSON.parse(await readFile("database/proposals/v2-beta2-durable-core.descriptor.json", "utf8"));
check(descriptor.contractVersion === V2_BETA2_CONTRACT_VERSION, "descriptor contract matches shared Alpha.9 authority");
const descriptorLeaves = [...descriptor.baselineMigrations, descriptor.proposal.up, descriptor.proposal.verify, descriptor.proposal.down];
for (const leaf of descriptorLeaves) {
  const bytes = await readFile(leaf.path);
  const metadata = await stat(leaf.path);
  check(metadata.size === leaf.size && createHash("sha256").update(bytes).digest("hex") === leaf.sha256, `descriptor leaf authority ${leaf.path}`);
}
check(descriptor.executionBoundary.forbiddenEnvironmentName === "DATABASE_URL" && descriptor.executionBoundary.loopbackOnly === true, "descriptor disposable boundary");

console.log(JSON.stringify({ status: "PASS", contractVersion: V2_BETA2_CONTRACT_VERSION, groups: 12, assertions, directions: 3, s0FieldsPerDirection: 13, fieldAssistOptions: 117, materialCoverageStates: 5, confirmedWorkspaceOperations: 1, runtimeSubmitEnvelopeVariants: 3, runtimeLookupEnvelopeVariants: 5, migrationLeaves: descriptorLeaves.length, formalResearchWrites: 0, liveProviderCalls: 0 }));
