import { beta1CanonicalJson, beta1Hash, isBeta1Hash } from "./canonical-hash.ts";
import { hasV2Beta1ExactRevisionKeys, requiresV2Beta1CompleteEvidenceClausePreservation, validateV2Beta1RevisionAnchors } from "./evidence-anchors.ts";
import { parseV2Beta1HistoryOrNull, validateV2Beta1CompletedJourneyHistory, validateV2Beta1ReplayConsistency, validateV2Beta1SameOriginTransition } from "./history-authority.ts";
import { createV2Beta1EvidenceAuthority, createV2Beta1HumanDraftAuthority, createV2Beta1ProfessionalProjection, validateV2Beta1EvidenceAuthority, validateV2Beta1HumanDraftAuthority, validateV2Beta1ProfessionalProjection, type V2Beta1EvidenceAuthority } from "./professional-projection.ts";
import { createV2Beta1CitationCatalog, createV2Beta1ResearchIntegrityGraph, validateV2Beta1ResearchIntegrityGraph, type V2Beta1CitationCatalog } from "./research-integrity.ts";
import { deriveEvidenceProjectionBundle } from "./selection-authority.ts";
import { V2_BETA1_CONTRACT_VERSION as CONTRACT_VERSION, V2_BETA1_CONTINUATION_SECTIONS as CONTINUATION, V2_BETA1_DIRECTION_LANES as LANES, V2_BETA1_PROPOSAL_SECTIONS as PROPOSAL_SECTIONS, V2_BETA1_REVIEW_STRATEGIES as STRATEGIES, createV2Beta1AssistOptions, deriveV2Beta1AssistOptionId, isV2Beta1DirectAssistValue, parseV2Beta1ProjectId, validateV2Beta1AssistOptionAgainstParent, validateV2Beta1AssistOptionContent, validateV2Beta1ExpectedRecommendedLaneBinding, type V2Beta1AssistParentAuthority } from "./shared-authority.ts";
import type { V2Beta1ObservationConfirmationAuthority } from "./typed-observation-authority.ts";
import { parseV2Beta1SnapshotDomain, parseV2Beta1SnapshotInsight, parseV2Beta1SnapshotS0, validateV2Beta1DeepJourneyArtifact } from "./contracts.ts";
import type {
  ProjectTruthSnapshot,
  V2Beta1AssistOption,
  V2Beta1AnalysisWorkPackage,
  V2Beta1ContinuationSection,
  V2Beta1Direction,
  V2Beta1EvidenceGap,
  V2Beta1JourneyArtifact,
  V2Beta1ImportChatInsightRequest,
  V2Beta1JourneyRequest,
  V2Beta1MaterialKind,
  V2Beta1PriorityFinding,
} from "./contracts.ts";

export const V2_BETA1_CLIENT_CONTRACT_VERSION = CONTRACT_VERSION;
const PERSISTENCE_CLASS = "PROCESS_LOCAL_LOCAL_PROTOTYPE" as const;
const S0_FIELDS = ["workingTitle", "domain", "outputTrack", "problemContext", "targetUsers", "expectedContribution", "existingData", "availableData", "methodIdea", "timeline", "constraints", "ethicsPrivacyRisks", "unresolvedItems"] as const;
const STAGE_IDS = ["DISCOVER", "BLUEPRINT", "EVIDENCE", "ANALYZE", "WRITE", "REVIEW_SUBMIT"] as const;
const OUTPUT_TARGETS = ["SCI", "SSCI", "NSTC", "MOE"] as const;
const MATERIAL_KINDS: readonly V2Beta1MaterialKind[] = ["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "QUESTIONNAIRE", "STATISTICS", "FIGURE", "TABLE", "CITATION", "NOTE"];

type UnknownRecord = Record<string, unknown>;
export type V2Beta1Snapshot = ProjectTruthSnapshot;
export type V2Beta1Journey = V2Beta1JourneyArtifact;
export type V2Beta1Insight = ProjectTruthSnapshot["chatInsights"][number];
export type V2Beta1StageId = ProjectTruthSnapshot["stages"][number]["stageId"];
export type V2Beta1StageStatus = ProjectTruthSnapshot["stages"][number]["status"];
export type V2Beta1GetResponse = { trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY"; snapshot: V2Beta1Snapshot; previewInsight: V2Beta1Insight; effectSubmissionCount: 0; liveProviderCallCount: 0 };
export type V2Beta1PostResponse = { trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY"; generatedArtifactHash: string | null; snapshot: V2Beta1Snapshot; replayed: boolean; effectSubmissionCount: 0 | 1; liveProviderCallCount: 0 };
export type V2Beta1PostValidationContext = { trustedScope: string; previousSnapshot: V2Beta1Snapshot; submittedRequest: V2Beta1ImportChatInsightRequest | V2Beta1JourneyRequest; selectedDirectionHash?: string };

function record(value: unknown): UnknownRecord | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null; }
function text(value: unknown) { return typeof value === "string" && value.trim().length > 0 ? value : null; }
function textArray(value: unknown) { return Array.isArray(value) && value.every((item) => text(item)) ? value as string[] : null; }
function exactKeys(value: UnknownRecord, expected: readonly string[]) { return beta1CanonicalJson(Object.keys(value).sort()) === beta1CanonicalJson([...expected].sort()); }
function exactOuterKeys(value: UnknownRecord, expected: readonly string[]) {
  const keys = Object.keys(value);
  if (keys.some((key) => !expected.includes(key) && key !== "extensions")) return false;
  return !Object.hasOwn(value, "extensions") || record(value.extensions) !== null;
}

function readDomain(value: unknown): ProjectTruthSnapshot["focusDomain"] | null {
  try { return parseV2Beta1SnapshotDomain(value); } catch { return null; }
}

function readInsight(value: unknown): V2Beta1Insight | null {
  try { return parseV2Beta1SnapshotInsight(value); } catch { return null; }
}

function readS0(value: unknown) {
  try { return parseV2Beta1SnapshotS0(value); } catch { return null; }
}

function readAssistOption(value: unknown, strategy: typeof STRATEGIES[number], field: typeof S0_FIELDS[number], parent: V2Beta1AssistParentAuthority): V2Beta1AssistOption | null {
  const context = { field, directionHash: parent.direction.directionHash, inputBundleHash: parent.direction.inputBundleHash, domainSelectionHash: parent.domain.selectionHash, outputTarget: parent.outputTarget, lane: parent.direction.lane };
  const input = record(value); if (!input || !validateV2Beta1AssistOptionContent(input, { ...context, strategy }) || !validateV2Beta1AssistOptionAgainstParent(input, parent) || input.strategy !== strategy || input.field !== context.field || input.directionHash !== context.directionHash || input.inputBundleHash !== context.inputBundleHash || input.domainSelectionHash !== context.domainSelectionHash || input.outputTarget !== context.outputTarget || input.lane !== context.lane || !text(input.optionId) || !text(input.text) || !text(input.applyValue) || !text(input.rationale) || !text(input.risk) || typeof input.recommended !== "boolean" || !isBeta1Hash(input.optionHash)) return null;
  const expectedOptionId = deriveV2Beta1AssistOptionId({ ...context, strategy });
  if (input.optionId !== expectedOptionId) return null;
  const core = { optionId: input.optionId, strategy, ...context, text: input.text, applyValue: input.applyValue, rationale: input.rationale, risk: input.risk, recommended: input.recommended };
  const candidate = { ...core, optionHash: input.optionHash };
  const expected = createV2Beta1AssistOptions(parent, field).find((item) => item.strategy === strategy);
  return validateV2Beta1AssistOptionContent(candidate, { ...context, strategy }) && validateV2Beta1AssistOptionAgainstParent(candidate, parent) && beta1CanonicalJson(candidate) === beta1CanonicalJson(expected) ? candidate as V2Beta1AssistOption : null;
}

function readDirection(value: unknown, target: V2Beta1Journey["outputTarget"], domain: ProjectTruthSnapshot["focusDomain"], researchDirection: string, materials: ReadonlyArray<V2Beta1Journey["sourceMaterials"][number]>, observationAuthority: V2Beta1ObservationConfirmationAuthority | null, evidenceAuthority: V2Beta1EvidenceAuthority, materialIds: ReadonlySet<string>, sourceBundleHash: string, officialSourceBundleHash: string | null): V2Beta1Direction | null {
  const input = record(value); if (!input || !exactKeys(input, ["directionId", "lane", "title", "researchQuestion", "mechanism", "contribution", "method", "evidenceBoundary", "unknowns", "recommended", "directionHash", "inputBundleHash", "professionalProjection", "s0", "preview", "fieldAssist", "selectionArtifact"]) || !text(input.directionId) || !LANES.includes(input.lane as typeof LANES[number]) || !text(input.title) || !text(input.researchQuestion) || !text(input.mechanism) || !text(input.contribution) || !text(input.method) || input.evidenceBoundary !== "UNVERIFIED" || typeof input.recommended !== "boolean" || !isBeta1Hash(input.directionHash) || !isBeta1Hash(input.inputBundleHash)) return null;
  const unknowns = textArray(input.unknowns); if (!unknowns?.length) return null;
  const projectionParent = { outputTarget: target, lane: input.lane as V2Beta1Direction["lane"], domain: { label: domain.label, selectionHash: domain.selectionHash }, researchDirection, materials, observationAuthority, evidenceAuthority };
  if (!validateV2Beta1ProfessionalProjection(input.professionalProjection, projectionParent)) return null;
  const professionalProjection = createV2Beta1ProfessionalProjection(projectionParent);
  const base = { directionId: input.directionId, lane: input.lane, title: input.title, researchQuestion: input.researchQuestion, mechanism: input.mechanism, contribution: input.contribution, method: input.method, evidenceBoundary: "UNVERIFIED", unknowns, recommended: input.recommended, professionalProjection };
  if (input.title !== professionalProjection.title || input.researchQuestion !== professionalProjection.researchQuestion || input.mechanism !== professionalProjection.mechanism || input.contribution !== professionalProjection.contribution || input.method !== professionalProjection.method || beta1CanonicalJson(unknowns) !== beta1CanonicalJson(professionalProjection.unknowns)) return null;
  if (beta1Hash(base) !== input.directionHash) return null;
  const s0 = readS0(input.s0); if (!s0 || beta1CanonicalJson(s0) !== beta1CanonicalJson(professionalProjection.s0)) return null;
  const previewInput = record(input.preview); const sectionsInput = previewInput ? record(previewInput.sections) : null; const expectedKind = target === "SCI" || target === "SSCI" ? "JOURNAL_MANUSCRIPT" : "TAIWAN_PROPOSAL";
  if (!previewInput || !exactKeys(previewInput, ["kind", "title", "sections", "contentHash"]) || previewInput.kind !== expectedKind || !text(previewInput.title) || !sectionsInput || !exactKeys(sectionsInput, CONTINUATION) || CONTINUATION.some((key) => !text(sectionsInput[key])) || !isBeta1Hash(previewInput.contentHash)) return null;
  const previewCore = { kind: expectedKind, title: previewInput.title, sections: Object.fromEntries(CONTINUATION.map((key) => [key, sectionsInput[key]])) };
  if (beta1Hash(previewCore) !== previewInput.contentHash || beta1CanonicalJson({ ...previewCore, contentHash: previewInput.contentHash }) !== beta1CanonicalJson(professionalProjection.preview)) return null;
  const assistParent: V2Beta1AssistParentAuthority = { direction: { lane: base.lane as V2Beta1Direction["lane"], directionHash: input.directionHash as string, inputBundleHash: input.inputBundleHash as string, title: base.title as string, researchQuestion: base.researchQuestion as string, mechanism: base.mechanism as string, contribution: base.contribution as string, method: base.method as string, s0 }, domain: { label: domain.label, selectionHash: domain.selectionHash }, outputTarget: target };
  const assistInput = record(input.fieldAssist); if (!assistInput || Object.keys(assistInput).length !== S0_FIELDS.length) return null;
  const fieldAssist = Object.fromEntries(S0_FIELDS.map((field) => {
    const raw = assistInput[field]; if (!Array.isArray(raw) || raw.length !== 3) return [field, null];
    const options = STRATEGIES.map((strategy, index) => readAssistOption(raw[index], strategy, field, assistParent));
    if (options.some((item) => !item) || options.filter((item) => item?.recommended).length !== 1 || !options[1]?.recommended || new Set(options.map((item) => item?.text)).size !== 3) return [field, null];
    if (field === "domain" && options.some((item) => item?.applyValue !== domain.label)) return [field, null];
    if (field === "outputTrack" && options.some((item) => item?.applyValue !== target)) return [field, null];
    if (field !== "domain" && field !== "outputTrack" && (new Set(options.map((item) => item?.applyValue)).size !== 3 || options.some((item) => !item || !isV2Beta1DirectAssistValue(field, item.applyValue)))) return [field, null];
    return [field, options];
  }));
  if (Object.values(fieldAssist).some((item) => item === null)) return null;
  const directionCore = { ...base, directionHash: input.directionHash, inputBundleHash: input.inputBundleHash, s0, preview: { ...previewCore, contentHash: previewInput.contentHash }, fieldAssist } as Omit<V2Beta1Direction, "selectionArtifact">;
  const selectionArtifact = readDirectionSelection(input.selectionArtifact, directionCore, target, domain, materials, evidenceAuthority, officialSourceBundleHash);
  return selectionArtifact ? { ...directionCore, selectionArtifact } as V2Beta1Direction : null;
}

function readSnapshotArtifact(value: unknown) {
  const input = record(value); const sections = input ? record(input.sections) : null; if (!input || !text(input.title) || !sections || Object.keys(sections).length < 6 || Object.values(sections).some((item) => !text(item)) || !isBeta1Hash(input.contentHash)) return null;
  const core = { title: input.title, sections: Object.fromEntries(Object.entries(sections).map(([key, item]) => [key, item])) };
  return beta1Hash(core) === input.contentHash ? { ...core, contentHash: input.contentHash } : null;
}

function readFinding(value: unknown, expectedSourceText: string, citationCatalog: V2Beta1CitationCatalog, ownDataBinding: boolean): V2Beta1PriorityFinding | null {
  const input = record(value); if (!input || !exactKeys(input, ["findingId", "location", "title", "reason", "sourceText", "recommendedRevisionId", "revisions"])) return null;
  const findingId = text(input.findingId); const location = text(input.location); const title = text(input.title); const reason = text(input.reason); const sourceText = text(input.sourceText); const recommendedRevisionId = text(input.recommendedRevisionId);
  if (!findingId || !location || !title || !reason || !sourceText || !recommendedRevisionId || !Array.isArray(input.revisions) || input.revisions.length !== 3) return null;
  const rawRevisions = input.revisions as unknown[];
  const revisions = STRATEGIES.map((strategy, index) => {
    const row = record(rawRevisions[index]); if (!row || !hasV2Beta1ExactRevisionKeys(row) || row.strategy !== strategy || typeof row.recommended !== "boolean" || !isBeta1Hash(row.revisionHash)) return null;
    const revisionId = text(row.revisionId); const revisionText = text(row.text); const rationale = text(row.rationale); const risk = text(row.risk);
    if (!revisionId || !revisionText || !rationale || !risk) return null;
    const graphInput = { findingId, sourceText: expectedSourceText, revisionText, citationCatalog, ownDataBinding };
    if (!validateV2Beta1ResearchIntegrityGraph(row.researchIntegrity, graphInput)) return null;
    const researchIntegrity = createV2Beta1ResearchIntegrityGraph(graphInput);
    if (!researchIntegrity.completeCoverage || !researchIntegrity.semanticEquivalent || !researchIntegrity.citationValid || !researchIntegrity.proseValid) return null;
    const core = { revisionId, strategy, text: revisionText, rationale, risk, recommended: row.recommended, researchIntegrity };
    return beta1Hash(core) === row.revisionHash ? { ...core, revisionHash: row.revisionHash } : null;
  });
  const source = sourceText; if (source !== expectedSourceText) return null;
  const completeClauseRequired = requiresV2Beta1CompleteEvidenceClausePreservation(source);
  const [firstRevision, balancedRevision, frontierRevision] = revisions; if (!firstRevision || !balancedRevision || !frontierRevision) return null;
  const validRevisions: V2Beta1PriorityFinding["revisions"] = [firstRevision, balancedRevision, frontierRevision];
  if (validRevisions.filter((item) => item.recommended).length !== 1 || !balancedRevision.recommended || recommendedRevisionId !== balancedRevision.revisionId || validRevisions.some((item) => item.text === source || (source.length >= 12 && item.text.includes(source) && !completeClauseRequired) || !validateV2Beta1RevisionAnchors(source, item.text)) || new Set(validRevisions.map((item) => item.text)).size !== 3) return null;
  return { findingId, location, title, reason, sourceText, recommendedRevisionId, revisions: validRevisions };
}

function readJournal(value: unknown, target: V2Beta1Journey["outputTarget"], materials: ReadonlyArray<V2Beta1Journey["sourceMaterials"][number]>, evidenceAuthority: V2Beta1EvidenceAuthority): V2Beta1Journey["journal"] | null {
  if (value === null) return null; const input = record(value); if (!input || (input.target !== "SCI" && input.target !== "SSCI") || input.target !== target || input.verificationCollection !== (input.target === "SCI" ? "SCIE" : "SSCI") || !["FINAL_CONFIRMABLE", "READY_WITH_GAPS", "BLOCKED_EVIDENCE_OR_INTEGRITY"].includes(String(input.reviewStatus)) || typeof input.publicationUsable !== "boolean" || !Array.isArray(input.priorityFindings) || input.priorityFindings.length !== 3) return null;
  const sourceSnapshot = readSnapshotArtifact(input.sourceSnapshot); const proposedSnapshot = readSnapshotArtifact(input.proposedSnapshot); if (!sourceSnapshot || !proposedSnapshot) return null;
  const citationCatalog = createV2Beta1CitationCatalog(materials);
  const priorityFindings = input.priorityFindings.map((item) => { const row = record(item); const location = row ? text(row.location) : null; if (!location) return null; const source = sourceSnapshot.sections[location]; return typeof source === "string" ? readFinding(item, source, citationCatalog, ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(location)) : null; });
  const [firstFinding, secondFinding, thirdFinding] = priorityFindings; if (!firstFinding || !secondFinding || !thirdFinding) return null; const validFindings = [firstFinding, secondFinding, thirdFinding];
  const resultGraphReady = validFindings.filter((finding) => ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(finding.location)).every((finding) => finding.revisions.every((revision) => revision.researchIntegrity.publicationUsable));
  const expectedReviewStatus = evidenceAuthority.summary.reviewStatus;
  const expectedPublicationUsable = evidenceAuthority.summary.publicationUsable && resultGraphReady;
  if (validFindings.some((finding) => proposedSnapshot.sections[finding.location] !== finding.revisions.find((revision) => revision.revisionId === finding.recommendedRevisionId)?.text) || input.reviewStatus !== expectedReviewStatus || input.publicationUsable !== expectedPublicationUsable) return null;
  return { target: input.target, verificationCollection: input.verificationCollection, sourceSnapshot, proposedSnapshot, reviewStatus: input.reviewStatus, priorityFindings: validFindings, publicationUsable: input.publicationUsable } as V2Beta1Journey["journal"];
}

function readTaiwan(value: unknown, target: V2Beta1Journey["outputTarget"]): V2Beta1Journey["taiwanProposal"] | null {
  if (value === null) return null; const input = record(value); const narratives = input ? record(input.narrativeSections) : null; const budget = input ? record(input.budget) : null;
  if (!input || (input.targetId !== "NSTC" && input.targetId !== "MOE") || input.targetId !== target || !text(input.proposalTitle) || !narratives || PROPOSAL_SECTIONS.some((key) => !text(narratives[key])) || !Array.isArray(input.workPackages) || !input.workPackages.length || !Array.isArray(input.kpis) || !input.kpis.length || !Array.isArray(input.attachments) || !input.attachments.length || !Array.isArray(input.priorityFindings) || input.priorityFindings.length !== 3 || !budget || budget.currency !== "TWD" || !Number.isSafeInteger(budget.totalTwd) || Number(budget.totalTwd) <= 0 || budget.authority !== "LOCAL_SYNTHETIC_UNVERIFIED" || !Array.isArray(budget.allocations) || !["READY", "READY_WITH_GAPS", "NOT_READY"].includes(String(input.finalReviewStatus)) || input.officialFactsState !== "UNKNOWN_OR_STALE" || !isBeta1Hash(input.officialSourceBundleHash)) return null;
  const objectArray = (value: unknown, keys: string[]) => Array.isArray(value) && value.every((item) => { const row = record(item); return row && keys.every((key) => text(row[key])); }) ? value : null;
  const workPackages = objectArray(input.workPackages, ["workPackageId", "title", "objective"]); const kpis = objectArray(input.kpis, ["kpiId", "workPackageId", "measure", "target"]); const attachments = objectArray(input.attachments, ["attachmentId", "label", "status"]); const sourceSnapshot = readSnapshotArtifact(input.sourceSnapshot); const proposedSnapshot = readSnapshotArtifact(input.proposedSnapshot); if (!sourceSnapshot || !proposedSnapshot) return null; const citationCatalog = createV2Beta1CitationCatalog([]); const findings = input.priorityFindings.map((item) => { const row = record(item); const location = row ? text(row.location) : null; if (!location) return null; const source = sourceSnapshot.sections[location]; return typeof source === "string" ? readFinding(item, source, citationCatalog, false) : null; });
  const [firstFinding, secondFinding, thirdFinding] = findings; if (!workPackages || !kpis || !attachments || !firstFinding || !secondFinding || !thirdFinding) return null; const validFindings = [firstFinding, secondFinding, thirdFinding];
  if (validFindings.some((finding) => proposedSnapshot.sections[finding.location] !== finding.revisions.find((revision) => revision.revisionId === finding.recommendedRevisionId)?.text)) return null;
  const workPackageIds = new Set(workPackages.map((item) => (item as { workPackageId: string }).workPackageId));
  if (kpis.some((item) => !workPackageIds.has((item as { workPackageId: string }).workPackageId))) return null;
  const allocations = budget.allocations.map((item) => { const row = record(item); return row && text(row.workPackageId) && workPackageIds.has(row.workPackageId as string) && Number.isSafeInteger(row.amountTwd) && Number(row.amountTwd) > 0 ? { workPackageId: row.workPackageId as string, amountTwd: Number(row.amountTwd) } : null; });
  if (allocations.some((item) => !item) || new Set(allocations.map((item) => item?.workPackageId)).size !== workPackages.length || allocations.reduce((sum, item) => sum + (item?.amountTwd ?? 0), 0) !== Number(budget.totalTwd)) return null;
  return { targetId: input.targetId, proposalTitle: input.proposalTitle, narrativeSections: Object.fromEntries(PROPOSAL_SECTIONS.map((key) => [key, narratives[key]])), workPackages, kpis, budget: { currency: "TWD", totalTwd: budget.totalTwd, authority: "LOCAL_SYNTHETIC_UNVERIFIED", allocations }, attachments, sourceSnapshot, proposedSnapshot, priorityFindings: validFindings, finalReviewStatus: input.finalReviewStatus, officialFactsState: "UNKNOWN_OR_STALE", officialSourceBundleHash: input.officialSourceBundleHash } as V2Beta1Journey["taiwanProposal"];
}

function readEvidenceGap(value: unknown, materialIds: ReadonlySet<string>): V2Beta1EvidenceGap | null {
  const row = record(value); const refs = row ? textArray(row.sourceMaterialIds) : null;
  const gapId = row ? text(row.gapId) : null; const statement = row ? text(row.statement) : null;
  const state = row && ["OBSERVED", "UNVERIFIED", "MISSING", "CONFLICT"].includes(String(row.state)) ? row.state as V2Beta1EvidenceGap["state"] : null;
  return gapId && statement && state && refs && refs.every((id) => materialIds.has(id)) ? { gapId, statement, state, sourceMaterialIds: refs } : null;
}

function readWorkPackage(value: unknown, materialIds: ReadonlySet<string>): V2Beta1AnalysisWorkPackage | null {
  const row = record(value); const steps = row ? textArray(row.steps) : null; const deliverables = row ? textArray(row.deliverables) : null; const refs = row ? textArray(row.sourceMaterialIds) : null;
  const workPackageId = row ? text(row.workPackageId) : null; const title = row ? text(row.title) : null; const objective = row ? text(row.objective) : null;
  const claimPolicy = row && ["OBSERVED_ONLY", "ANALYSIS_PLAN_ONLY", "RECONCILIATION_ONLY"].includes(String(row.claimPolicy)) ? row.claimPolicy as V2Beta1AnalysisWorkPackage["claimPolicy"] : null;
  return workPackageId && title && objective && steps?.length && deliverables?.length && refs && refs.every((id) => materialIds.has(id)) && claimPolicy ? { workPackageId, title, objective, steps, deliverables, sourceMaterialIds: refs, claimPolicy } : null;
}

function readContinuation(value: unknown, expected: typeof CONTINUATION[number], materialIds: ReadonlySet<string>): V2Beta1ContinuationSection | null {
  const row = record(value); const refs = row ? textArray(row.sourceMaterialIds) : null;
  const sectionText = row ? text(row.text) : null;
  const evidenceState = row && ["OBSERVED", "UNVERIFIED", "ASSUMPTION", "MISSING"].includes(String(row.evidenceState)) ? row.evidenceState as V2Beta1ContinuationSection["evidenceState"] : null;
  if (!row || row.sectionId !== expected || !sectionText || !evidenceState || !refs || refs.some((id) => !materialIds.has(id)) || !isBeta1Hash(row.contentHash)) return null;
  const core = { sectionId: expected, text: sectionText, evidenceState, sourceMaterialIds: refs };
  return beta1Hash(core) === row.contentHash ? { ...core, contentHash: row.contentHash } : null;
}

function readDirectionSelection(value: unknown, direction: Omit<V2Beta1Direction, "selectionArtifact">, target: V2Beta1Journey["outputTarget"], domain: ProjectTruthSnapshot["focusDomain"], materials: ReadonlyArray<V2Beta1Journey["sourceMaterials"][number]>, evidenceAuthority: V2Beta1EvidenceAuthority, officialSourceBundleHash: string | null): V2Beta1Direction["selectionArtifact"] | null {
  try {
    const expected = deriveEvidenceProjectionBundle({ outputTarget: target, researchDomainHash: domain.selectionHash, officialSourceBundleHash, direction, materials, evidenceAuthority });
    return beta1CanonicalJson(value) === beta1CanonicalJson(expected) ? expected : null;
  } catch { return null; }
}

function readJourney(value: unknown): V2Beta1Journey | null {
  if (value === null) return null;
  try { return validateV2Beta1DeepJourneyArtifact(value); } catch { return null; }
}

function readSnapshot(value: unknown, trustedScope?: string): V2Beta1Snapshot | null {
  const input = record(value); const domain = input ? readDomain(input.focusDomain) : null; const s0 = input ? readS0(input.s0Summary) : null;
  if (!input || !exactKeys(input, ["contractVersion", "projectId", "revision", "contentHash", "focusDomain", "s0Summary", "stages", "chatInsights", "timeline", "effectReceipts", "journeys", "journey", "formalResearchWriteCount", "onlineDatabaseWriteCount", "externalMutationCount", "persistenceClass"]) || input.contractVersion !== CONTRACT_VERSION || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1 || !isBeta1Hash(input.contentHash) || !domain || !s0 || !Array.isArray(input.stages) || input.stages.length !== STAGE_IDS.length || !Array.isArray(input.chatInsights) || !Array.isArray(input.timeline) || !Array.isArray(input.effectReceipts) || input.timeline.length !== input.effectReceipts.length || input.revision !== input.timeline.length + 1 || !Array.isArray(input.journeys) || input.formalResearchWriteCount !== 0 || input.onlineDatabaseWriteCount !== 0 || input.externalMutationCount !== 0 || input.persistenceClass !== PERSISTENCE_CLASS) return null;
  let projectId: string; try { projectId = parseV2Beta1ProjectId(input.projectId); } catch { return null; }
  const stages = input.stages.map((item, index) => { const row = record(item); return row && exactKeys(row, ["stageId", "status"]) && row.stageId === STAGE_IDS[index] && ["COMPLETE", "ACTIVE", "PENDING"].includes(String(row.status)) ? { stageId: row.stageId, status: row.status } : null; }); if (stages.some((item) => !item)) return null;
  const chatInsights = input.chatInsights.map(readInsight); if (chatInsights.some((item) => !item) || new Set(chatInsights.map((item) => item?.hash)).size !== chatInsights.length) return null;
  const history = parseV2Beta1HistoryOrNull({ projectId, revision: input.revision as number, timeline: input.timeline, effectReceipts: input.effectReceipts, ...(trustedScope ? { trustedScope } : {}) }); if (!history) return null;
  const timeline = history.timeline; const receipts = history.effectReceipts;
  const insightHistory = timeline.filter((event, index) => receipts[index]?.operation === "IMPORT_CHAT_INSIGHT" && event?.completionClass === "COMPLETE").map((event) => event?.payloadHash); if (beta1CanonicalJson(insightHistory) !== beta1CanonicalJson(chatInsights.map((item) => item?.hash))) return null;
  const journeys = input.journeys.map(readJourney); const journey = readJourney(input.journey); if (journeys.some((item) => !item) || (input.journey !== null && !journey) || (journeys.length === 0) !== (journey === null) || (journey && journeys.at(-1)?.artifactHash !== journey.artifactHash)) return null;
  try { validateV2Beta1CompletedJourneyHistory({ effectReceipts: receipts, journeys: journeys as V2Beta1Journey[] }); } catch { return null; }
  if (journey && (journey.outputTarget !== s0.outputTrack || journey.researchDomain.selectionHash !== domain.selectionHash || beta1CanonicalJson(journey.directions.find((item) => item.recommended)?.s0) !== beta1CanonicalJson(s0))) return null;
  const core = { contractVersion: CONTRACT_VERSION, projectId, revision: input.revision, focusDomain: domain, s0Summary: s0, stages, chatInsights, timeline, effectReceipts: receipts, journeys, journey, formalResearchWriteCount: 0, onlineDatabaseWriteCount: 0, externalMutationCount: 0, persistenceClass: PERSISTENCE_CLASS };
  return beta1Hash(core) === input.contentHash ? { ...core, contentHash: input.contentHash } as unknown as V2Beta1Snapshot : null;
}

function common(value: unknown, trustedScope?: string) {
  const input = record(value); if (!input || input.ok !== true || input.contractVersion !== CONTRACT_VERSION || input.liveProviderCallCount !== 0 || input.formalResearchWriteCount !== 0 || input.onlineDatabaseWriteCount !== 0 || input.externalMutationCount !== 0) return null;
  const snapshot = readSnapshot(input.snapshot, trustedScope); return snapshot ? { input, snapshot } : null;
}
export function parseV2Beta1GetResponse(value: unknown): V2Beta1GetResponse | null {
  const parsed = common(value); if (!parsed || !exactOuterKeys(parsed.input, ["ok", "contractVersion", "trustClass", "snapshot", "previewInsight", "effectSubmissionCount", "liveProviderCallCount", "formalResearchWriteCount", "onlineDatabaseWriteCount", "externalMutationCount"]) || parsed.input.trustClass !== "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY" || parsed.input.effectSubmissionCount !== 0) return null; const previewInsight = readInsight(parsed.input.previewInsight); return previewInsight ? { trustClass: "STRUCTURAL_INTERNAL_CONSISTENCY_ONLY", snapshot: parsed.snapshot, previewInsight, effectSubmissionCount: 0, liveProviderCallCount: 0 } : null;
}
export function parseV2Beta1PostResponse(value: unknown, context: V2Beta1PostValidationContext): V2Beta1PostResponse | null {
  const parsed = common(value, context.trustedScope); if (!parsed || !exactOuterKeys(parsed.input, ["ok", "contractVersion", "trustClass", "generatedArtifactHash", "snapshot", "replayed", "effectSubmissionCount", "liveProviderCallCount", "formalResearchWriteCount", "onlineDatabaseWriteCount", "externalMutationCount"]) || parsed.input.trustClass !== "SAME_ORIGIN_TRANSITION_CONSISTENCY" || typeof parsed.input.replayed !== "boolean") return null; const expected = parsed.input.replayed ? 0 : 1;
  if (parsed.input.effectSubmissionCount !== expected) return null;
  const generatedArtifactHash = parsed.input.generatedArtifactHash === null ? null : isBeta1Hash(parsed.input.generatedArtifactHash) ? parsed.input.generatedArtifactHash : undefined;
  if (generatedArtifactHash === undefined || (context.submittedRequest.operation === "IMPORT_CHAT_INSIGHT" && generatedArtifactHash !== null) || (context.submittedRequest.operation === "RUN_RESEARCH_JOURNEY" && generatedArtifactHash === null)) return null;
  try {
    if (parsed.input.replayed) {
      validateV2Beta1ReplayConsistency({ trustedScope: context.trustedScope, previousSnapshot: context.previousSnapshot, submittedRequest: context.submittedRequest, nextSnapshot: parsed.snapshot, generatedArtifactHash });
    } else {
      validateV2Beta1SameOriginTransition({ trustedScope: context.trustedScope, previousSnapshot: context.previousSnapshot, submittedRequest: context.submittedRequest, nextSnapshot: parsed.snapshot, completionClass: "COMPLETE", generatedArtifactHash, ...(context.selectedDirectionHash ? { selectedDirectionHash: context.selectedDirectionHash } : {}) });
    }
  } catch { return null; }
  return { trustClass: "SAME_ORIGIN_TRANSITION_CONSISTENCY", generatedArtifactHash, snapshot: parsed.snapshot, replayed: parsed.input.replayed, effectSubmissionCount: expected, liveProviderCallCount: 0 };
}
