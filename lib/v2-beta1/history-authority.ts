import { beta1CanonicalJson, beta1Hash, isBeta1Hash } from "./canonical-hash.ts";
import { deriveV2Beta1JourneyInputBundleHash } from "./journey-lineage.ts";
import { parseV2Beta1ProjectId, validateV2Beta1ExpectedRecommendedLaneBinding } from "./shared-authority.ts";
import { deriveV2Beta1ObservationEffectLineageHash } from "./typed-observation-authority.ts";
import { parseV2Beta1ImportChatInsightRequest, parseV2Beta1JourneyRequest, validateProjectTruthSnapshot, validateV2Beta1DeepJourneyArtifact, type ProjectTruthSnapshot, type V2Beta1EffectReceipt, type V2Beta1ImportChatInsightRequest, type V2Beta1JourneyRequest, type V2Beta1Operation, type V2Beta1TimelineEvent } from "./contracts.ts";

export type V2Beta1CompletionClass = "COMPLETE" | "UNKNOWN";
export type V2Beta1HistoryEventType = V2Beta1TimelineEvent["eventType"];
export type V2Beta1HistoryIntent = {
  scope: string;
  projectId: string;
  operation: V2Beta1Operation;
  requestId: string;
  idempotencyKey: string;
  requestHash: string;
  payloadHash: string;
  generatedArtifactHash: string | null;
  observationAuthorityHash: string | null;
  baseRevision: number;
  baseContentHash: string;
};
type HistoryEntryInput = { intent: V2Beta1HistoryIntent; completionClass: V2Beta1CompletionClass; sequence: number; predecessorCommitment?: string };

const MAPPING: Record<V2Beta1Operation, Record<V2Beta1CompletionClass, V2Beta1HistoryEventType>> = {
  IMPORT_CHAT_INSIGHT: { COMPLETE: "CHAT_INSIGHT_IMPORTED", UNKNOWN: "CHAT_INSIGHT_COMPLETION_UNKNOWN" },
  RUN_RESEARCH_JOURNEY: { COMPLETE: "RESEARCH_JOURNEY_COMPLETED", UNKNOWN: "RESEARCH_JOURNEY_COMPLETION_UNKNOWN" },
};
const RECEIPT_KEYS = ["sequence", "effectId", "scope", "scopeAuthority", "scopeHash", "projectId", "operation", "requestId", "idempotencyKey", "requestHash", "payloadHash", "generatedArtifactHash", "observationAuthorityHash", "baseRevision", "baseContentHash", "completionClass", "resultRevision", "effectLineageHash", "lineageHash", "predecessorCommitment", "entryCommitment", "receiptHash"] as const;
const EVENT_KEYS = ["sequence", "eventId", "eventType", "receiptId", "scope", "scopeAuthority", "scopeHash", "projectId", "operation", "requestId", "idempotencyKey", "requestHash", "payloadHash", "generatedArtifactHash", "observationAuthorityHash", "fromRevision", "toRevision", "completionClass", "effectLineageHash", "lineageHash", "predecessorCommitment", "entryCommitment", "eventHash"] as const;

function assertText(value: unknown, code: string) { if (typeof value !== "string" || !value.trim()) throw new Error(code); return value.trim(); }
function exactKeys(value: Record<string, unknown>, expected: readonly string[], code: string) { const keys = Object.keys(value).sort(); const authority = [...expected].sort(); if (keys.length !== authority.length || keys.some((key, index) => key !== authority[index])) throw new Error(code); }
function record(value: unknown, code: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code); return value as Record<string, unknown>; }
function canonicalScope(value: unknown) { const scope = assertText(value, "beta1_history_scope_invalid"); if (scope.length < 3 || scope.length > 319 || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(scope)) throw new Error("beta1_history_scope_invalid"); return scope; }

export function v2Beta1EventType(operation: V2Beta1Operation, completionClass: V2Beta1CompletionClass) { return MAPPING[operation]?.[completionClass]; }

export function createV2Beta1HistoryIntent(input: { scope: string; request: V2Beta1ImportChatInsightRequest | V2Beta1JourneyRequest; selectedDirectionHash?: string; generatedArtifactHash?: string | null }): V2Beta1HistoryIntent {
  const scope = canonicalScope(input.scope);
  const request = input.request;
  const payloadHash = request.operation === "IMPORT_CHAT_INSIGHT"
    ? request.insight.hash
    : deriveV2Beta1JourneyInputBundleHash({ ...request, observationEffectLineageHash: deriveV2Beta1ObservationEffectLineageHash(request.observationConfirmation), selectedLane: "BALANCED_RECOMMENDED" }, assertText(input.selectedDirectionHash, "beta1_journey_lineage_direction_invalid"));
  const generatedArtifactHash = request.operation === "IMPORT_CHAT_INSIGHT" ? null : input.generatedArtifactHash;
  if (request.operation === "IMPORT_CHAT_INSIGHT" && input.generatedArtifactHash != null) throw new Error("beta1_import_generated_artifact_invalid");
  if (request.operation === "RUN_RESEARCH_JOURNEY" && !isBeta1Hash(generatedArtifactHash)) throw new Error("beta1_journey_generated_artifact_invalid");
  return {
    scope,
    projectId: request.projectId,
    operation: request.operation,
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    requestHash: beta1Hash(request),
    payloadHash,
    generatedArtifactHash: generatedArtifactHash ?? null,
    observationAuthorityHash: request.operation === "RUN_RESEARCH_JOURNEY" ? request.observationConfirmation?.authorityHash ?? null : null,
    baseRevision: request.baseRevision,
    baseContentHash: request.baseContentHash,
  };
}

export function createV2Beta1HistoryEntry(input: HistoryEntryInput): { receipt: V2Beta1EffectReceipt; event: V2Beta1TimelineEvent } {
  const intent = input.intent;
  const observationAuthorityHash = intent.observationAuthorityHash ?? null;
  const scope = canonicalScope(intent.scope); const projectId = parseV2Beta1ProjectId(intent.projectId); const requestId = assertText(intent.requestId, "beta1_history_request_invalid"); const idempotencyKey = assertText(intent.idempotencyKey, "beta1_history_idempotency_invalid");
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1 || intent.baseRevision !== input.sequence || !isBeta1Hash(intent.requestHash) || !isBeta1Hash(intent.payloadHash) || !isBeta1Hash(intent.baseContentHash)) throw new Error("beta1_history_input_invalid");
  if ((intent.operation === "IMPORT_CHAT_INSIGHT" && intent.generatedArtifactHash !== null) || (intent.operation === "RUN_RESEARCH_JOURNEY" && !isBeta1Hash(intent.generatedArtifactHash))) throw new Error("beta1_history_generated_artifact_invalid");
  if ((intent.operation === "IMPORT_CHAT_INSIGHT" && observationAuthorityHash !== null) || (observationAuthorityHash !== null && !isBeta1Hash(observationAuthorityHash))) throw new Error("beta1_history_observation_authority_invalid");
  const eventType = v2Beta1EventType(intent.operation, input.completionClass); if (!eventType) throw new Error("beta1_history_mapping_invalid");
  const scopeAuthority = beta1Hash({ authority: "PROJECT_TRUTH_SCOPE", scope, projectId });
  const scopeHash = beta1Hash({ scopeAuthority, scope, projectId });
  const effectLineageHash = beta1Hash({ scopeHash, projectId, operation: intent.operation, payloadHash: intent.payloadHash });
  const lineageHash = beta1Hash({ effectLineageHash, requestId, idempotencyKey, requestHash: intent.requestHash, baseRevision: intent.baseRevision, baseContentHash: intent.baseContentHash });
  const predecessorCommitment = input.predecessorCommitment ?? beta1Hash({ scopeHash, projectId, genesisRevision: intent.baseRevision, genesisContentHash: intent.baseContentHash });
  if (!isBeta1Hash(predecessorCommitment)) throw new Error("beta1_history_predecessor_invalid");
  const effectId = `effect:${beta1Hash({ lineageHash, sequence: input.sequence }).slice(0, 40)}`;
  const eventId = `event:${beta1Hash({ lineageHash, sequence: input.sequence, effectId }).slice(0, 40)}`;
  const entryCommitment = beta1Hash({ predecessorCommitment, scopeHash, effectLineageHash, lineageHash, effectId, eventId, eventType, requestHash: intent.requestHash, payloadHash: intent.payloadHash, generatedArtifactHash: intent.generatedArtifactHash, observationAuthorityHash, baseContentHash: intent.baseContentHash, sequence: input.sequence, completionClass: input.completionClass });
  const receiptCore = { sequence: input.sequence, effectId, scope, scopeAuthority, scopeHash, projectId, operation: intent.operation, requestId, idempotencyKey, requestHash: intent.requestHash, payloadHash: intent.payloadHash, generatedArtifactHash: intent.generatedArtifactHash, observationAuthorityHash, baseRevision: intent.baseRevision, baseContentHash: intent.baseContentHash, completionClass: input.completionClass, resultRevision: intent.baseRevision + 1, effectLineageHash, lineageHash, predecessorCommitment, entryCommitment };
  const eventCore = { sequence: input.sequence, eventId, eventType, receiptId: effectId, scope, scopeAuthority, scopeHash, projectId, operation: intent.operation, requestId, idempotencyKey, requestHash: intent.requestHash, payloadHash: intent.payloadHash, generatedArtifactHash: intent.generatedArtifactHash, observationAuthorityHash, fromRevision: intent.baseRevision, toRevision: intent.baseRevision + 1, completionClass: input.completionClass, effectLineageHash, lineageHash, predecessorCommitment, entryCommitment };
  return { receipt: { ...receiptCore, receiptHash: beta1Hash(receiptCore) }, event: { ...eventCore, eventHash: beta1Hash(eventCore) } };
}

export function validateV2Beta1HistoryInternalConsistency(input: { projectId: string; revision: number; timeline: unknown[]; effectReceipts: unknown[]; trustedScope?: string }) {
  const rootProjectId = parseV2Beta1ProjectId(input.projectId);
  if (input.timeline.length !== input.effectReceipts.length || input.revision !== input.timeline.length + 1) throw new Error("beta1_history_length_invalid");
  const trustedScope = input.trustedScope === undefined ? null : canonicalScope(input.trustedScope);
  const receipts: V2Beta1EffectReceipt[] = []; const timeline: V2Beta1TimelineEvent[] = []; const semanticEffects = new Map<string, V2Beta1CompletionClass>(); const idempotencyAuthority = new Map<string, string>(); let historyScope: string | null = null; let previousCommitment: string | undefined;
  for (let index = 0; index < input.timeline.length; index += 1) {
    const receiptRaw = record(input.effectReceipts[index], "beta1_receipt_invalid"); const eventRaw = record(input.timeline[index], "beta1_timeline_invalid"); exactKeys(receiptRaw, RECEIPT_KEYS, "beta1_receipt_invalid"); exactKeys(eventRaw, EVENT_KEYS, "beta1_timeline_invalid");
    const operation = receiptRaw.operation as V2Beta1Operation; const completionClass = receiptRaw.completionClass as V2Beta1CompletionClass; if (!MAPPING[operation]?.[completionClass]) throw new Error("beta1_history_mapping_invalid");
    const generatedArtifactHash = receiptRaw.generatedArtifactHash === null ? null : String(receiptRaw.generatedArtifactHash);
    if ((operation === "IMPORT_CHAT_INSIGHT" && generatedArtifactHash !== null) || (operation === "RUN_RESEARCH_JOURNEY" && !isBeta1Hash(generatedArtifactHash))) throw new Error("beta1_history_generated_artifact_invalid");
    const observationAuthorityHash = receiptRaw.observationAuthorityHash === null ? null : String(receiptRaw.observationAuthorityHash);
    const intent: V2Beta1HistoryIntent = { scope: canonicalScope(receiptRaw.scope), projectId: parseV2Beta1ProjectId(receiptRaw.projectId), operation, requestId: assertText(receiptRaw.requestId, "beta1_history_request_invalid"), idempotencyKey: assertText(receiptRaw.idempotencyKey, "beta1_history_idempotency_invalid"), requestHash: String(receiptRaw.requestHash), payloadHash: String(receiptRaw.payloadHash), generatedArtifactHash, observationAuthorityHash, baseRevision: index + 1, baseContentHash: String(receiptRaw.baseContentHash) };
    if (historyScope === null) historyScope = intent.scope;
    if (intent.scope !== historyScope || (trustedScope !== null && intent.scope !== trustedScope) || eventRaw.scope !== intent.scope || eventRaw.scopeAuthority !== receiptRaw.scopeAuthority || eventRaw.scopeHash !== receiptRaw.scopeHash) throw new Error("beta1_history_scope_authority_invalid");
    const priorRequestHash = idempotencyAuthority.get(intent.idempotencyKey);
    if (priorRequestHash !== undefined) throw new Error(priorRequestHash === intent.requestHash ? "beta1_history_idempotency_duplicate" : "beta1_history_idempotency_conflict");
    idempotencyAuthority.set(intent.idempotencyKey, intent.requestHash);
    const canonical = createV2Beta1HistoryEntry({ intent, completionClass, sequence: index + 1, ...(previousCommitment ? { predecessorCommitment: previousCommitment } : {}) });
    if (receiptRaw.projectId !== rootProjectId || eventRaw.projectId !== rootProjectId || eventRaw.observationAuthorityHash !== observationAuthorityHash) throw new Error("beta1_history_project_invalid");
    if (beta1CanonicalJson(receiptRaw) !== beta1CanonicalJson(canonical.receipt) || beta1CanonicalJson(eventRaw) !== beta1CanonicalJson(canonical.event)) throw new Error("beta1_history_derived_invalid");
    const priorSemanticEffect = semanticEffects.get(canonical.receipt.effectLineageHash);
    if (priorSemanticEffect !== undefined) throw new Error(priorSemanticEffect === "UNKNOWN" ? "beta1_history_unknown_no_resend" : "beta1_history_effect_duplicate");
    semanticEffects.set(canonical.receipt.effectLineageHash, completionClass);
    previousCommitment = canonical.receipt.entryCommitment; receipts.push(canonical.receipt); timeline.push(canonical.event);
  }
  return { timeline, effectReceipts: receipts, scope: historyScope, trustClass: trustedScope === null ? "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY" as const : "TRUSTED_SCOPE_FULL_HISTORY" as const };
}

export const validateV2Beta1History = validateV2Beta1HistoryInternalConsistency;
export function parseV2Beta1HistoryOrNull(input: { projectId: string; revision: number; timeline: unknown[]; effectReceipts: unknown[]; trustedScope?: string }) { try { return validateV2Beta1HistoryInternalConsistency(input); } catch { return null; } }

export function validateV2Beta1FullHistory(input: { projectId: string; revision: number; timeline: unknown[]; effectReceipts: unknown[]; journeys?: readonly unknown[]; trustedScope?: string }) {
  const history = validateV2Beta1HistoryInternalConsistency(input);
  if (input.journeys !== undefined) {
    const journeys = input.journeys.map(validateV2Beta1DeepJourneyArtifact);
    validateV2Beta1CompletedJourneyHistory({ effectReceipts: history.effectReceipts, journeys });
  }
  return history;
}

export function validateV2Beta1CompletedJourneyHistory(input: {
  effectReceipts: readonly Pick<V2Beta1EffectReceipt, "operation" | "completionClass" | "payloadHash" | "generatedArtifactHash" | "observationAuthorityHash">[];
  journeys: readonly Pick<ProjectTruthSnapshot["journeys"][number], "artifactHash" | "inputBundleHash" | "observationAuthority">[];
}) {
  const completed = input.effectReceipts.filter((receipt) => receipt.operation === "RUN_RESEARCH_JOURNEY" && receipt.completionClass === "COMPLETE");
  if (completed.length !== input.journeys.length) throw new Error("beta1_journey_history_length_mismatch");
  const artifactHashes = new Set<string>();
  const payloadHashes = new Set<string>();
  input.journeys.forEach((journey, index) => {
    const receipt = completed[index];
    if (receipt.generatedArtifactHash !== journey.artifactHash) throw new Error("beta1_journey_history_artifact_mismatch");
    if (receipt.payloadHash !== journey.inputBundleHash) throw new Error("beta1_journey_history_payload_mismatch");
    if (receipt.observationAuthorityHash !== (journey.observationAuthority?.authorityHash ?? null)) throw new Error("beta1_journey_history_observation_mismatch");
    if (artifactHashes.has(journey.artifactHash) || payloadHashes.has(journey.inputBundleHash)) throw new Error("beta1_journey_history_duplicate");
    artifactHashes.add(journey.artifactHash);
    payloadHashes.add(journey.inputBundleHash);
  });
  return { status: "PASS" as const };
}

function withoutContentHash(snapshot: ProjectTruthSnapshot) {
  const { contentHash: _contentHash, ...core } = snapshot;
  return core;
}

const COMPLETE_JOURNEY_STAGES: ProjectTruthSnapshot["stages"] = [
  { stageId: "DISCOVER", status: "COMPLETE" },
  { stageId: "BLUEPRINT", status: "COMPLETE" },
  { stageId: "EVIDENCE", status: "COMPLETE" },
  { stageId: "ANALYZE", status: "COMPLETE" },
  { stageId: "WRITE", status: "COMPLETE" },
  { stageId: "REVIEW_SUBMIT", status: "ACTIVE" },
];

type TransitionInput = {
  trustedScope: string;
  previousSnapshot: ProjectTruthSnapshot;
  submittedRequest: V2Beta1ImportChatInsightRequest | V2Beta1JourneyRequest;
  nextSnapshot: ProjectTruthSnapshot;
  completionClass: V2Beta1CompletionClass;
  generatedArtifactHash: string | null;
  selectedDirectionHash?: string;
};

function validateTransition(input: TransitionInput, trustClass: "SERVER_AUTHORITATIVE_TRANSITION" | "SAME_ORIGIN_TRANSITION_CONSISTENCY") {
  const { trustedScope, submittedRequest: request, completionClass, generatedArtifactHash } = input;
  const previous = validateProjectTruthSnapshot(input.previousSnapshot, { trustedScope });
  const next = validateProjectTruthSnapshot(input.nextSnapshot, { trustedScope });
  validateV2Beta1FullHistory({ projectId: previous.projectId, revision: previous.revision, timeline: previous.timeline, effectReceipts: previous.effectReceipts, journeys: previous.journeys, trustedScope });
  validateV2Beta1FullHistory({ projectId: next.projectId, revision: next.revision, timeline: next.timeline, effectReceipts: next.effectReceipts, journeys: next.journeys, trustedScope });
  if (request.projectId !== previous.projectId || request.baseRevision !== previous.revision || request.baseContentHash !== previous.contentHash || next.projectId !== previous.projectId || next.revision !== previous.revision + 1) throw new Error("beta1_transition_authority_invalid");
  if (next.timeline.length !== previous.timeline.length + 1 || next.effectReceipts.length !== previous.effectReceipts.length + 1 || beta1CanonicalJson(next.timeline.slice(0, -1)) !== beta1CanonicalJson(previous.timeline) || beta1CanonicalJson(next.effectReceipts.slice(0, -1)) !== beta1CanonicalJson(previous.effectReceipts)) throw new Error("beta1_transition_history_invalid");
  if ((request.operation === "IMPORT_CHAT_INSIGHT" && generatedArtifactHash !== null) || (request.operation === "RUN_RESEARCH_JOURNEY" && !isBeta1Hash(generatedArtifactHash))) throw new Error("beta1_transition_generated_artifact_invalid");
  if (request.operation === "RUN_RESEARCH_JOURNEY" && completionClass === "COMPLETE" && next.journey?.artifactHash !== generatedArtifactHash) throw new Error("beta1_transition_generated_artifact_invalid");
  let selectedDirectionHash: string | undefined;
  if (request.operation === "RUN_RESEARCH_JOURNEY") selectedDirectionHash = input.selectedDirectionHash ?? (completionClass === "COMPLETE" ? next.journey?.selectedDirectionHash : undefined);
  if (request.operation === "RUN_RESEARCH_JOURNEY" && !selectedDirectionHash) throw new Error("beta1_transition_journey_lineage_invalid");
  const intent = createV2Beta1HistoryIntent({ scope: trustedScope, request, generatedArtifactHash, ...(selectedDirectionHash ? { selectedDirectionHash } : {}) });
  const canonical = createV2Beta1HistoryEntry({ intent, completionClass, sequence: previous.timeline.length + 1, predecessorCommitment: previous.effectReceipts.at(-1)?.entryCommitment });
  if (beta1CanonicalJson(next.effectReceipts.at(-1)) !== beta1CanonicalJson(canonical.receipt) || beta1CanonicalJson(next.timeline.at(-1)) !== beta1CanonicalJson(canonical.event)) throw new Error("beta1_transition_history_authority_invalid");
  const previousCore = withoutContentHash(previous);
  let expectedCore: Omit<ProjectTruthSnapshot, "contentHash">;
  if (request.operation === "IMPORT_CHAT_INSIGHT") {
    const expectedInsights = completionClass === "COMPLETE" ? [...previous.chatInsights, request.insight] : previous.chatInsights;
    expectedCore = { ...previousCore, revision: previous.revision + 1, chatInsights: expectedInsights, timeline: [...previous.timeline, canonical.event], effectReceipts: [...previous.effectReceipts, canonical.receipt] };
  } else if (completionClass === "COMPLETE") {
    const artifact = next.journey; if (!artifact || artifact.artifactHash !== generatedArtifactHash || artifact.entryMode !== request.entryMode || artifact.outputTarget !== request.outputTarget || artifact.researchDirection !== request.researchDirection || artifact.researchDomain.selectionHash !== request.researchDomain.selectionHash || artifact.inputBundleHash !== intent.payloadHash || beta1CanonicalJson(artifact.observationAuthority) !== beta1CanonicalJson(request.observationConfirmation)) throw new Error("beta1_transition_journey_projection_invalid");
    if (!validateV2Beta1ExpectedRecommendedLaneBinding(artifact)) throw new Error("beta1_transition_recommended_lane_invalid");
    const materialAuthority = request.materials.map((item) => ({ materialId: item.materialId, kind: item.kind, title: item.title, contentHash: beta1Hash(item.content) }));
    if (beta1CanonicalJson(artifact.sourceMaterials.map(({ materialId, kind, title, contentHash }) => ({ materialId, kind, title, contentHash }))) !== beta1CanonicalJson(materialAuthority)) throw new Error("beta1_transition_journey_material_invalid");
    const selected = artifact.directions.find((direction) => direction.directionHash === artifact.selectedDirectionHash);
    if (!selected) throw new Error("beta1_transition_journey_projection_invalid");
    expectedCore = {
      ...previousCore,
      revision: previous.revision + 1,
      focusDomain: artifact.researchDomain,
      s0Summary: selected.s0,
      stages: COMPLETE_JOURNEY_STAGES,
      journeys: [...previous.journeys, artifact],
      journey: artifact,
      timeline: [...previous.timeline, canonical.event],
      effectReceipts: [...previous.effectReceipts, canonical.receipt],
    };
  } else {
    expectedCore = { ...previousCore, revision: previous.revision + 1, timeline: [...previous.timeline, canonical.event], effectReceipts: [...previous.effectReceipts, canonical.receipt] };
  }
  if (beta1CanonicalJson(withoutContentHash(next)) !== beta1CanonicalJson(expectedCore) || next.contentHash !== beta1Hash(expectedCore)) throw new Error("beta1_transition_projection_invalid");
  return { status: "PASS" as const, trustClass, intent, receipt: canonical.receipt, event: canonical.event };
}

export function validateV2Beta1AuthoritativeTransition(input: TransitionInput) {
  return validateTransition(input, "SERVER_AUTHORITATIVE_TRANSITION");
}

export function validateV2Beta1SameOriginTransition(input: TransitionInput) {
  return validateTransition(input, "SAME_ORIGIN_TRANSITION_CONSISTENCY");
}

export function validateV2Beta1ReplayConsistency(input: {
  trustedScope: string;
  previousSnapshot: ProjectTruthSnapshot;
  submittedRequest: V2Beta1ImportChatInsightRequest | V2Beta1JourneyRequest;
  nextSnapshot: ProjectTruthSnapshot;
  generatedArtifactHash: string | null;
}) {
  const trustedScope = canonicalScope(input.trustedScope);
  const previous = validateProjectTruthSnapshot(input.previousSnapshot, { trustedScope });
  const next = validateProjectTruthSnapshot(input.nextSnapshot, { trustedScope });
  const request = input.submittedRequest.operation === "RUN_RESEARCH_JOURNEY" ? parseV2Beta1JourneyRequest(input.submittedRequest, { trustedScope }) : parseV2Beta1ImportChatInsightRequest(input.submittedRequest);
  if (request.projectId !== previous.projectId || next.projectId !== previous.projectId || next.revision < previous.revision) throw new Error("beta1_replay_revision_invalid");
  if (next.revision === previous.revision) {
    if (beta1CanonicalJson(next) !== beta1CanonicalJson(previous)) throw new Error("beta1_replay_same_revision_invalid");
  } else if (beta1CanonicalJson(next.timeline.slice(0, previous.timeline.length)) !== beta1CanonicalJson(previous.timeline) || beta1CanonicalJson(next.effectReceipts.slice(0, previous.effectReceipts.length)) !== beta1CanonicalJson(previous.effectReceipts) || beta1CanonicalJson(next.journeys.slice(0, previous.journeys.length)) !== beta1CanonicalJson(previous.journeys) || beta1CanonicalJson(next.chatInsights.slice(0, previous.chatInsights.length)) !== beta1CanonicalJson(previous.chatInsights)) throw new Error("beta1_replay_prefix_invalid");
  const matching = next.effectReceipts.map((receipt, index) => ({ receipt, index })).filter(({ receipt }) => receipt.idempotencyKey === request.idempotencyKey);
  if (matching.length !== 1) throw new Error("beta1_replay_receipt_invalid");
  const { receipt, index } = matching[0];
  if (receipt.scope !== trustedScope || receipt.projectId !== request.projectId || receipt.requestId !== request.requestId || receipt.requestHash !== beta1Hash(request) || receipt.baseRevision !== request.baseRevision || receipt.baseContentHash !== request.baseContentHash || receipt.generatedArtifactHash !== input.generatedArtifactHash || receipt.completionClass !== "COMPLETE") throw new Error("beta1_replay_receipt_invalid");
  const selectedDirectionHash = request.operation === "RUN_RESEARCH_JOURNEY" ? next.journeys.find((journey) => journey.artifactHash === receipt.generatedArtifactHash)?.selectedDirectionHash : undefined;
  const intent = createV2Beta1HistoryIntent({ scope: trustedScope, request, generatedArtifactHash: input.generatedArtifactHash, ...(selectedDirectionHash ? { selectedDirectionHash } : {}) });
  const canonical = createV2Beta1HistoryEntry({ intent, completionClass: "COMPLETE", sequence: index + 1, ...(index > 0 ? { predecessorCommitment: next.effectReceipts[index - 1].entryCommitment } : {}) });
  if (beta1CanonicalJson(receipt) !== beta1CanonicalJson(canonical.receipt) || beta1CanonicalJson(next.timeline[index]) !== beta1CanonicalJson(canonical.event)) throw new Error("beta1_replay_receipt_invalid");
  return { status: "PASS" as const, trustClass: "SAME_ORIGIN_REPLAY_CONSISTENCY" as const };
}
