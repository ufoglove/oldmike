import "server-only";

import { S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import { createBuiltinDomainSelection, createInsightCard, type V2Alpha3InsightCard } from "../v2-alpha3/contracts.ts";
import type { V2Alpha3DomainSelection } from "../v2-alpha3/contracts.ts";
import {
  V2_BETA1_CONTRACT_VERSION,
  V2_BETA1_OPERATION,
  V2_BETA1_JOURNEY_OPERATION,
  V2_BETA1_PERSISTENCE_CLASS,
  beta1Hash,
  createProjectTruthSnapshot,
  normalizeBeta1StatisticalProse,
  parseV2Beta1ImportChatInsightRequest,
  parseV2Beta1JourneyRequest,
  validateProjectTruthSnapshot,
  type ProjectTruthSnapshot,
  type V2Beta1ImportChatInsightRequest,
  type V2Beta1EntryMode,
  type V2Beta1JourneyRequest,
  type V2Beta1MaterialKind,
  type V2Beta1OutputTarget,
} from "./contracts.ts";
import { createV2Beta1HistoryEntry, createV2Beta1HistoryIntent, validateV2Beta1AuthoritativeTransition } from "./history-authority.ts";
import { runV2Beta1ThinAdapters } from "./journey-adapters.ts";

export type V2Beta1ImportResult = { snapshot: ProjectTruthSnapshot; replayed: boolean; generatedArtifactHash: string | null };
export type V2Beta1EffectOutcome = "COMPLETE" | "UNKNOWN";
export type V2Beta1BeforeCommit = (input: Readonly<{ scope: string; request: V2Beta1ImportChatInsightRequest; requestHash: string }>) => Promise<V2Beta1EffectOutcome>;
export type V2Beta1BeforeJourneyCommit = (input: Readonly<{ scope: string; request: V2Beta1JourneyRequest; requestHash: string }>) => Promise<V2Beta1EffectOutcome>;

function normalizeScope(value: string) {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 319 || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(normalized)) throw new Error("beta1_scope_invalid");
  return normalized;
}

function initialS0(): Record<S0FieldName, string> {
  const values: Record<S0FieldName, string> = {
    workingTitle: "生成式智慧回饋、自我調節學習與任務表現：高等教育準實驗混合方法研究",
    domain: "AI應用於教育",
    outputTrack: "SSCI",
    problemContext: "高等教育已廣泛導入生成式智慧回饋，但回饋可操作性、證據校準與學習者自我調節之間的作用機制仍缺少情境化檢驗。",
    targetUsers: "高等教育課程中的學習者與授課教師；實際場域、樣本及資料權限仍須依研究現場確認。",
    expectedContribution: "建立連結回饋可操作性、證據校準、自我調節與任務表現的可反駁機制模型，並提出可重現的教學設計與評估原則。",
    existingData: normalizeBeta1StatisticalProse("合成示例的基準任務完成指標=82%；此數值只用於測試文體，不代表實際研究結果。"),
    availableData: "可規劃前後測、去識別化學習歷程、問卷與訪談資料；可得性與授權尚未建立。",
    methodIdea: "採準實驗混合方法設計，以量化模型檢驗主要關聯，再以訪談與學習歷程解釋作用機制及失效條件。",
    timeline: "先完成場域、資料與倫理可行性盤點，再形成先導研究、正式蒐集、分析與寫作四階段期程。",
    constraints: "樣本規模、資料品質、量測工具、研究人力與經費仍須確認，不以假設數值取代正式盤點。",
    ethicsPrivacyRisks: "需處理知情同意、師生權力關係、資料最小化、去識別化、存取權限與模型輔助揭露。",
    unresolvedItems: "樣本框、介入忠實度、主要結果指標、正式引用、目標期刊與倫理核准狀態仍待後續核對。",
  };
  if (Object.keys(values).length !== S0_FIELD_NAMES.length) throw new Error("beta1_initial_s0_incomplete");
  return values;
}

export function createSyntheticBeta1Insight(message = "生成式智慧回饋如何透過證據校準影響高等教育學習者的自我調節與任務表現？", domainSelection: V2Alpha3DomainSelection = createBuiltinDomainSelection("ai-education")): V2Alpha3InsightCard {
  const direction = message.replace(/\r\n?/gu, "\n").trim();
  if (direction.length < 2 || direction.length > 800) throw new Error("beta1_synthetic_insight_message_invalid");
  return createInsightCard({
    kind: "direction",
    title: `${direction.slice(0, 92)}：${domainSelection.label}的證據校準方向`,
    researchQuestion: direction,
    mechanism: `${domainSelection.label}脈絡中，「${direction.slice(0, 180)}」可能透過證據可見性、信任校準與策略選擇形成可檢驗機制。`,
    value: `把「${direction.slice(0, 180)}」轉化為可觀察、可反駁且能辨識${domainSelection.label}失效條件的研究。`,
    domainFit: `本洞見明確綁定${domainSelection.label}；對象、場域與跨域外推仍須由研究者核對。`,
    evidenceBoundary: "UNVERIFIED",
    assumptions: [`「${direction.slice(0, 120)}」目前為${domainSelection.label}的合成本機建議，尚未查詢外部文獻或正式資料。`],
    nextAction: `在${domainSelection.label}中核對「${direction.slice(0, 120)}」的量測構念、可用資料與最小可行設計。`,
  });
}

export function createSyntheticBeta1Project(scope: string): ProjectTruthSnapshot {
  const safeScope = normalizeScope(scope);
  return createProjectTruthSnapshot({
    contractVersion: V2_BETA1_CONTRACT_VERSION,
    projectId: `project-beta1-${beta1Hash(safeScope).slice(0, 16)}`,
    revision: 1,
    focusDomain: createBuiltinDomainSelection("ai-education"),
    s0Summary: initialS0(),
    stages: [
      { stageId: "DISCOVER", status: "COMPLETE" },
      { stageId: "BLUEPRINT", status: "ACTIVE" },
      { stageId: "EVIDENCE", status: "PENDING" },
      { stageId: "ANALYZE", status: "PENDING" },
      { stageId: "WRITE", status: "PENDING" },
      { stageId: "REVIEW_SUBMIT", status: "PENDING" },
    ],
    chatInsights: [],
    timeline: [],
    effectReceipts: [],
    journeys: [],
    journey: null,
    formalResearchWriteCount: 0,
    onlineDatabaseWriteCount: 0,
    externalMutationCount: 0,
    persistenceClass: V2_BETA1_PERSISTENCE_CLASS,
  });
}

function nextJourneySnapshot(scope: string, current: ProjectTruthSnapshot, request: V2Beta1JourneyRequest, requestHash: string, completionClass: V2Beta1EffectOutcome, generated: ReturnType<typeof runV2Beta1ThinAdapters>) {
  const intent = createV2Beta1HistoryIntent({ scope, request, selectedDirectionHash: generated.artifact.selectedDirectionHash, generatedArtifactHash: generated.artifact.artifactHash });
  if (intent.requestHash !== requestHash || intent.payloadHash !== generated.artifact.inputBundleHash) throw new Error("beta1_journey_lineage_authority_invalid");
  const { event: timelineEvent, receipt } = createV2Beta1HistoryEntry({ intent, completionClass, sequence: current.timeline.length + 1, predecessorCommitment: current.effectReceipts.at(-1)?.entryCommitment });
  const { contentHash: _previousContentHash, ...currentCore } = current;
  return createProjectTruthSnapshot({
    ...currentCore,
    revision: current.revision + 1,
    focusDomain: completionClass === "COMPLETE" ? generated.artifact.researchDomain : current.focusDomain,
    s0Summary: completionClass === "COMPLETE" ? generated.s0 : current.s0Summary,
    stages: completionClass === "COMPLETE" ? [
      { stageId: "DISCOVER", status: "COMPLETE" },
      { stageId: "BLUEPRINT", status: "COMPLETE" },
      { stageId: "EVIDENCE", status: "COMPLETE" },
      { stageId: "ANALYZE", status: "COMPLETE" },
      { stageId: "WRITE", status: "COMPLETE" },
      { stageId: "REVIEW_SUBMIT", status: "ACTIVE" },
    ] : current.stages,
    journey: completionClass === "COMPLETE" ? generated.artifact : current.journey,
    journeys: completionClass === "COMPLETE" ? [...current.journeys, generated.artifact] : current.journeys,
    timeline: [...current.timeline, timelineEvent],
    effectReceipts: [...current.effectReceipts, receipt],
  });
}

function nextSnapshot(scope: string, current: ProjectTruthSnapshot, request: V2Beta1ImportChatInsightRequest, requestHash: string, completionClass: V2Beta1EffectOutcome) {
  const intent = createV2Beta1HistoryIntent({ scope, request });
  if (intent.requestHash !== requestHash) throw new Error("beta1_import_lineage_authority_invalid");
  const { event: timelineEvent, receipt } = createV2Beta1HistoryEntry({ intent, completionClass, sequence: current.timeline.length + 1, predecessorCommitment: current.effectReceipts.at(-1)?.entryCommitment });
  const { contentHash: _previousContentHash, ...currentCore } = current;
  return createProjectTruthSnapshot({
    ...currentCore,
    revision: current.revision + 1,
    chatInsights: completionClass === "COMPLETE" ? [...current.chatInsights, request.insight] : [...current.chatInsights],
    timeline: [...current.timeline, timelineEvent],
    effectReceipts: [...current.effectReceipts, receipt],
  });
}

export function createV2Beta1Coordinator(options: { beforeCommit?: V2Beta1BeforeCommit; beforeJourneyCommit?: V2Beta1BeforeJourneyCommit } = {}) {
  const snapshots = new Map<string, ProjectTruthSnapshot>();
  const settled = new Map<string, { requestHash: string; snapshot: ProjectTruthSnapshot }>();
  const inflight = new Map<string, { requestHash: string; promise: Promise<V2Beta1ImportResult> }>();
  const lineageInflight = new Map<string, { idempotencyKey: string; requestHash: string }>();
  const scopeRevisionInflight = new Map<string, { idempotencyKey: string; requestHash: string }>();
  const beforeCommit = options.beforeCommit ?? (async () => "COMPLETE" as const);
  const beforeJourneyCommit = options.beforeJourneyCommit ?? (async () => "COMPLETE" as const);

  const read = (scope: string) => {
    const safeScope = normalizeScope(scope);
    const snapshot = snapshots.get(safeScope) ?? createSyntheticBeta1Project(safeScope);
    if (!snapshots.has(safeScope)) snapshots.set(safeScope, snapshot);
    return { safeScope, snapshot: validateProjectTruthSnapshot(structuredClone(snapshot), { trustedScope: safeScope }) };
  };

  return {
    persistenceClass: V2_BETA1_PERSISTENCE_CLASS,
    getSnapshot(scope: string): ProjectTruthSnapshot {
      return read(scope).snapshot;
    },
    async importInsight(raw: unknown, scope: string): Promise<V2Beta1ImportResult> {
      const { safeScope, snapshot: current } = read(scope);
      const request = parseV2Beta1ImportChatInsightRequest(raw);
      const requestHash = beta1Hash(request);
      const key = `${safeScope}:${request.idempotencyKey}`;
      const priorReceipt = current.effectReceipts.find((item) => item.idempotencyKey === request.idempotencyKey);
      if (priorReceipt) {
        if (priorReceipt.requestHash !== requestHash) throw new Error("beta1_idempotency_conflict");
        if (priorReceipt.completionClass === "UNKNOWN") throw new Error("beta1_completion_unknown_no_resend");
        const prior = settled.get(key);
        if (!prior || prior.requestHash !== requestHash) throw new Error("beta1_replay_snapshot_unavailable");
        return { snapshot: read(safeScope).snapshot, replayed: true, generatedArtifactHash: priorReceipt.generatedArtifactHash };
      }
      const active = inflight.get(key);
      if (active) {
        if (active.requestHash !== requestHash) throw new Error("beta1_idempotency_conflict");
        const result = await active.promise;
        return { snapshot: validateProjectTruthSnapshot(structuredClone(result.snapshot), { trustedScope: safeScope }), replayed: true, generatedArtifactHash: result.generatedArtifactHash };
      }
      const unresolvedLineage = current.effectReceipts.some((item) => item.operation === V2_BETA1_OPERATION
        && item.payloadHash === request.insight.hash
        && item.completionClass === "UNKNOWN");
      if (unresolvedLineage) throw new Error("beta1_completion_unknown_no_resend");
      if (request.projectId !== current.projectId) throw new Error("beta1_project_scope_mismatch");
      if (request.baseRevision !== current.revision) throw new Error("beta1_stale_revision");
      if (request.baseContentHash !== current.contentHash) throw new Error("beta1_stale_content_hash");
      if (current.chatInsights.some((item) => item.hash === request.insight.hash)) throw new Error("beta1_insight_already_imported");

      const lineageKey = `${safeScope}:${V2_BETA1_OPERATION}:${request.insight.hash}`;
      const activeLineage = lineageInflight.get(lineageKey);
      if (activeLineage) throw new Error("beta1_completion_unknown_no_resend");
      lineageInflight.set(lineageKey, { idempotencyKey: request.idempotencyKey, requestHash });
      const scopeRevisionKey = `${safeScope}:${request.baseRevision}:${request.baseContentHash}`;
      if (scopeRevisionInflight.has(scopeRevisionKey)) {
        lineageInflight.delete(lineageKey);
        throw new Error("beta1_concurrent_state_conflict");
      }
      scopeRevisionInflight.set(scopeRevisionKey, { idempotencyKey: request.idempotencyKey, requestHash });

      const promise = (async (): Promise<V2Beta1ImportResult> => {
        let outcome: V2Beta1EffectOutcome;
        try {
          outcome = await beforeCommit({ scope: safeScope, request: structuredClone(request), requestHash });
        } catch {
          outcome = "UNKNOWN";
        }
        if (outcome !== "COMPLETE" && outcome !== "UNKNOWN") throw new Error("beta1_effect_outcome_invalid");
        const latest = read(safeScope).snapshot;
        if (latest.revision !== request.baseRevision || latest.contentHash !== request.baseContentHash) throw new Error("beta1_concurrent_state_conflict");
        const updated = nextSnapshot(safeScope, latest, request, requestHash, outcome);
        validateV2Beta1AuthoritativeTransition({ trustedScope: safeScope, previousSnapshot: latest, submittedRequest: request, nextSnapshot: updated, completionClass: outcome, generatedArtifactHash: null });
        snapshots.set(safeScope, updated);
        if (outcome === "UNKNOWN") throw new Error("beta1_completion_unknown_no_resend");
        settled.set(key, { requestHash, snapshot: structuredClone(updated) });
        return { snapshot: validateProjectTruthSnapshot(structuredClone(updated), { trustedScope: safeScope }), replayed: false, generatedArtifactHash: null };
      })();
      inflight.set(key, { requestHash, promise });
      try {
        return await promise;
      } finally {
        inflight.delete(key);
        const ownedLineage = lineageInflight.get(lineageKey);
        if (ownedLineage?.idempotencyKey === request.idempotencyKey && ownedLineage.requestHash === requestHash) lineageInflight.delete(lineageKey);
        const ownedScope = scopeRevisionInflight.get(scopeRevisionKey);
        if (ownedScope?.idempotencyKey === request.idempotencyKey && ownedScope.requestHash === requestHash) scopeRevisionInflight.delete(scopeRevisionKey);
      }
    },
    async runJourney(raw: unknown, scope: string): Promise<V2Beta1ImportResult> {
      const { safeScope, snapshot: current } = read(scope);
      const request = parseV2Beta1JourneyRequest(raw, { trustedScope: safeScope });
      const requestHash = beta1Hash(request);
      const key = `${safeScope}:${request.idempotencyKey}`;
      const priorReceipt = current.effectReceipts.find((item) => item.idempotencyKey === request.idempotencyKey);
      if (priorReceipt) {
        if (priorReceipt.requestHash !== requestHash) throw new Error("beta1_idempotency_conflict");
        if (priorReceipt.completionClass === "UNKNOWN") throw new Error("beta1_completion_unknown_no_resend");
        const prior = settled.get(key);
        if (!prior || prior.requestHash !== requestHash) throw new Error("beta1_replay_snapshot_unavailable");
        return { snapshot: read(safeScope).snapshot, replayed: true, generatedArtifactHash: priorReceipt.generatedArtifactHash };
      }
      const active = inflight.get(key);
      if (active) {
        if (active.requestHash !== requestHash) throw new Error("beta1_idempotency_conflict");
        const result = await active.promise;
        return { snapshot: validateProjectTruthSnapshot(structuredClone(result.snapshot), { trustedScope: safeScope }), replayed: true, generatedArtifactHash: result.generatedArtifactHash };
      }
      if (request.projectId !== current.projectId) throw new Error("beta1_project_scope_mismatch");
      if (request.baseRevision !== current.revision) throw new Error("beta1_stale_revision");
      if (request.baseContentHash !== current.contentHash) throw new Error("beta1_stale_content_hash");
      const generated = runV2Beta1ThinAdapters(request, request.researchDomain);
      const lineageHash = generated.artifact.inputBundleHash;
      const unresolvedLineage = current.effectReceipts.some((item) => item.operation === V2_BETA1_JOURNEY_OPERATION && item.payloadHash === lineageHash && item.completionClass === "UNKNOWN");
      if (unresolvedLineage) throw new Error("beta1_completion_unknown_no_resend");
      if (current.journeys.some((item) => item.inputBundleHash === lineageHash)) throw new Error("beta1_journey_already_completed");
      const lineageKey = `${safeScope}:${V2_BETA1_JOURNEY_OPERATION}:${lineageHash}`;
      if (lineageInflight.has(lineageKey)) throw new Error("beta1_completion_unknown_no_resend");
      lineageInflight.set(lineageKey, { idempotencyKey: request.idempotencyKey, requestHash });
      const scopeRevisionKey = `${safeScope}:${request.baseRevision}:${request.baseContentHash}`;
      if (scopeRevisionInflight.has(scopeRevisionKey)) {
        lineageInflight.delete(lineageKey);
        throw new Error("beta1_concurrent_state_conflict");
      }
      scopeRevisionInflight.set(scopeRevisionKey, { idempotencyKey: request.idempotencyKey, requestHash });

      const promise = (async (): Promise<V2Beta1ImportResult> => {
        let outcome: V2Beta1EffectOutcome;
        try {
          outcome = await beforeJourneyCommit({ scope: safeScope, request: structuredClone(request), requestHash });
        } catch {
          outcome = "UNKNOWN";
        }
        if (outcome !== "COMPLETE" && outcome !== "UNKNOWN") throw new Error("beta1_effect_outcome_invalid");
        const latest = read(safeScope).snapshot;
        if (latest.revision !== request.baseRevision || latest.contentHash !== request.baseContentHash) throw new Error("beta1_concurrent_state_conflict");
        const updated = nextJourneySnapshot(safeScope, latest, request, requestHash, outcome, generated);
        validateV2Beta1AuthoritativeTransition({ trustedScope: safeScope, previousSnapshot: latest, submittedRequest: request, nextSnapshot: updated, completionClass: outcome, selectedDirectionHash: generated.artifact.selectedDirectionHash, generatedArtifactHash: generated.artifact.artifactHash });
        snapshots.set(safeScope, updated);
        if (outcome === "UNKNOWN") throw new Error("beta1_completion_unknown_no_resend");
        settled.set(key, { requestHash, snapshot: structuredClone(updated) });
        return { snapshot: validateProjectTruthSnapshot(structuredClone(updated), { trustedScope: safeScope }), replayed: false, generatedArtifactHash: generated.artifact.artifactHash };
      })();
      inflight.set(key, { requestHash, promise });
      try {
        return await promise;
      } finally {
        inflight.delete(key);
        const ownedLineage = lineageInflight.get(lineageKey);
        if (ownedLineage?.idempotencyKey === request.idempotencyKey && ownedLineage.requestHash === requestHash) lineageInflight.delete(lineageKey);
        const ownedScope = scopeRevisionInflight.get(scopeRevisionKey);
        if (ownedScope?.idempotencyKey === request.idempotencyKey && ownedScope.requestHash === requestHash) scopeRevisionInflight.delete(scopeRevisionKey);
      }
    },
  };
}

let fixtureCoordinator: ReturnType<typeof createV2Beta1Coordinator> | null = null;

export function getV2Beta1FixtureCoordinator() {
  fixtureCoordinator ??= createV2Beta1Coordinator();
  return fixtureCoordinator;
}

export function createV2Beta1ImportRequest(snapshot: ProjectTruthSnapshot, insight = createSyntheticBeta1Insight(), suffix = "0001"): V2Beta1ImportChatInsightRequest {
  return {
    contractVersion: V2_BETA1_CONTRACT_VERSION,
    operation: V2_BETA1_OPERATION,
    requestId: `beta1-import:${suffix}`,
    idempotencyKey: `beta1-import-key:${suffix}`,
    projectId: snapshot.projectId,
    baseRevision: snapshot.revision,
    baseContentHash: snapshot.contentHash,
    insight,
  };
}

export function createV2Beta1JourneyRequest(snapshot: ProjectTruthSnapshot, input: {
  suffix: string;
  entryMode: V2Beta1EntryMode;
  outputTarget: V2Beta1OutputTarget;
  researchDirection?: string;
  /** Compatibility input for checked-in fixture callers; the wire contract never emits this key. */
  keyword?: string | null;
  researchDomain?: V2Alpha3DomainSelection;
  materials: Array<{ materialId: string; kind: V2Beta1MaterialKind; title: string; content: string }>;
  observationConfirmation?: V2Beta1JourneyRequest["observationConfirmation"];
}): V2Beta1JourneyRequest {
  return {
    contractVersion: V2_BETA1_CONTRACT_VERSION,
    operation: V2_BETA1_JOURNEY_OPERATION,
    requestId: `beta1-journey:${input.suffix}`,
    idempotencyKey: `beta1-journey-key:${input.suffix}`,
    projectId: snapshot.projectId,
    baseRevision: snapshot.revision,
    baseContentHash: snapshot.contentHash,
    entryMode: input.entryMode,
    outputTarget: input.outputTarget,
    researchDirection: input.researchDirection ?? input.keyword ?? "整合研究者提供的多份材料，形成可驗證且不虛構結果的研究問題",
    researchDomain: input.researchDomain ?? snapshot.focusDomain,
    materials: input.materials,
    observationConfirmation: input.observationConfirmation ?? null,
  };
}
