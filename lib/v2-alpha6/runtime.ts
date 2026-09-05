import "server-only";

import { academicLanguageHash, preservationFingerprint } from "../academic-language-contract.ts";
import { S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import { createBuiltinDomainSelection, parseDomainSelection, parseNormalizedWork, sha256Canonical } from "../v2-alpha3/contracts.ts";
import { createTargetSelection } from "../v2-alpha4/contracts.ts";
import {
  parseJournalFitAssessment,
  parseJournalIdentityAuthority,
  parseJournalPolicySnapshot,
  parseS0Fields,
} from "../v2-alpha4/contracts.ts";
import { createSyntheticAlpha4Workspace } from "../v2-alpha4/runtime.ts";
import { createSyntheticZoteroBindings } from "../v2-alpha4-r1/zotero-contracts.ts";
import { findV2Alpha6R1SemanticFixture } from "../v2-alpha6-r1/semantic-language-fixtures.ts";
import {
  V2_ALPHA6_CLAIM_STATES,
  V2_ALPHA6_CONTRACT_VERSION,
  V2_ALPHA6_DECLARED_LANGUAGES,
  V2_ALPHA6_ENTRY_MODES,
  V2_ALPHA6_LANGUAGE_ALTERNATIVES,
  V2_ALPHA6_LANGUAGE_TASKS,
  V2_ALPHA6_MANUSCRIPT_SECTION_KEYS,
  V2_ALPHA6_MAX_PASTED_BYTES,
  V2_ALPHA6_NARRATIVE_STRATEGIES,
  type V2Alpha6Claim,
  type V2Alpha6DeclaredLanguage,
  type V2Alpha6JournalAuthority,
  type V2Alpha6LanguageApplication,
  type V2Alpha6LanguageAssistance,
  type V2Alpha6LanguageOption,
  type V2Alpha6LanguageTask,
  type V2Alpha6Manuscript,
  type V2Alpha6ManuscriptSection,
  type V2Alpha6ManuscriptSectionKey,
  type V2Alpha6NarrativeCard,
  type V2Alpha6ProjectSource,
  type V2Alpha6PastedSource,
  type V2Alpha6Workspace,
  type V2Alpha6WorkspaceRequest,
} from "./contracts.ts";

type UnknownRecord = Record<string, unknown>;
type CoordinatorInput = V2Alpha6WorkspaceRequest & { scope: string };
type Settled = { requestHash: string; result: V2Alpha6Workspace };

function record(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function text(value: unknown, code: string, minimum: number, maximum: number, preserveBytes = false) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = preserveBytes ? value : value.replace(/\r\n?/gu, "\n").trim();
  const size = Buffer.byteLength(normalized, "utf8");
  if (normalized.trim().length < minimum || size > maximum || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) throw new Error(code);
  return normalized;
}

function hex(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) throw new Error(code);
  return value;
}

function exactKeys(value: UnknownRecord, expected: readonly string[], code: string) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw new Error(code);
}

export function alpha6Hash(value: unknown) {
  return sha256Canonical(value);
}

function parseJournalAuthority(value: unknown): V2Alpha6JournalAuthority {
  const input = record(value, "alpha6_journal_authority_invalid");
  exactKeys(input, ["identity", "policy", "fit"], "alpha6_journal_authority_invalid");
  const identity = parseJournalIdentityAuthority(input.identity);
  const policy = parseJournalPolicySnapshot(input.policy);
  const fit = parseJournalFitAssessment(input.fit);
  if (identity.journalId !== policy.journalId || identity.journalId !== fit.journalId) throw new Error("alpha6_journal_binding_mismatch");
  return { identity, policy, fit };
}

function parseEvidenceBundle(value: unknown) {
  const input = record(value, "alpha6_evidence_bundle_invalid");
  exactKeys(input, ["coverage", "works", "limitations"], "alpha6_evidence_bundle_invalid");
  if (input.coverage !== "COMPLETE" && input.coverage !== "PARTIAL" && input.coverage !== "UNAVAILABLE") throw new Error("alpha6_evidence_coverage_invalid");
  if (!Array.isArray(input.works) || input.works.length > 100 || !Array.isArray(input.limitations) || input.limitations.length > 20) throw new Error("alpha6_evidence_bundle_invalid");
  const works = input.works.map(parseNormalizedWork);
  const limitations = input.limitations.map((item) => text(item, "alpha6_evidence_limitation_invalid", 1, 500));
  if (input.coverage !== "COMPLETE" && limitations.length === 0) throw new Error("alpha6_evidence_limitation_required");
  return { coverage: input.coverage, works, limitations } as V2Alpha6ProjectSource["evidenceBundle"];
}

function projectSourceCore(source: Omit<V2Alpha6ProjectSource, "sourceHash">) {
  return {
    kind: source.kind,
    researchIntentHash: source.researchIntentHash,
    domainSelection: source.domainSelection,
    s0: source.s0,
    s0Hash: source.s0Hash,
    evidenceBundle: source.evidenceBundle,
    evidenceBundleHash: source.evidenceBundleHash,
    analysisResult: source.analysisResult,
    analysisResultHash: source.analysisResultHash,
    journal: source.journal,
  };
}

function pastedSourceCore(source: Omit<V2Alpha6PastedSource, "sourceHash">, declaredLanguage: V2Alpha6DeclaredLanguage) {
  return { kind: source.kind, sourceText: source.sourceText, declaredLanguage, journal: source.journal };
}

function parseProjectSource(value: unknown): V2Alpha6ProjectSource {
  const input = record(value, "alpha6_project_source_invalid");
  exactKeys(input, ["kind", "sourceHash", "researchIntentHash", "domainSelection", "s0", "s0Hash", "evidenceBundle", "evidenceBundleHash", "analysisResult", "analysisResultHash", "journal"], "alpha6_project_source_invalid");
  if (input.kind !== "PROJECT_ARTIFACT") throw new Error("alpha6_project_source_invalid");
  const domainSelection = parseDomainSelection(input.domainSelection);
  const s0 = parseS0Fields(input.s0);
  const s0Hash = hex(input.s0Hash, "alpha6_s0_hash_invalid");
  if (alpha6Hash(s0) !== s0Hash) throw new Error("alpha6_s0_hash_mismatch");
  const evidenceBundle = parseEvidenceBundle(input.evidenceBundle);
  const evidenceBundleHash = hex(input.evidenceBundleHash, "alpha6_evidence_hash_invalid");
  if (alpha6Hash(evidenceBundle) !== evidenceBundleHash) throw new Error("alpha6_evidence_hash_mismatch");
  let analysisResult: V2Alpha6ProjectSource["analysisResult"] = null;
  let analysisResultHash: string | null = null;
  if (input.analysisResult !== null || input.analysisResultHash !== null) {
    const raw = record(input.analysisResult, "alpha6_analysis_result_invalid");
    exactKeys(raw, ["artifactHash", "verifiedResultData", "summary"], "alpha6_analysis_result_invalid");
    if (typeof raw.verifiedResultData !== "boolean") throw new Error("alpha6_analysis_result_invalid");
    analysisResult = { artifactHash: hex(raw.artifactHash, "alpha6_analysis_hash_invalid"), verifiedResultData: raw.verifiedResultData, summary: text(raw.summary, "alpha6_analysis_summary_invalid", 1, 2_000) };
    analysisResultHash = hex(input.analysisResultHash, "alpha6_analysis_hash_invalid");
    if (analysisResult.artifactHash !== analysisResultHash) throw new Error("alpha6_analysis_hash_mismatch");
  }
  const journal = parseJournalAuthority(input.journal);
  const source: Omit<V2Alpha6ProjectSource, "sourceHash"> = {
    kind: "PROJECT_ARTIFACT",
    researchIntentHash: hex(input.researchIntentHash, "alpha6_research_intent_hash_invalid"),
    domainSelection,
    s0,
    s0Hash,
    evidenceBundle,
    evidenceBundleHash,
    analysisResult,
    analysisResultHash,
    journal,
  };
  const sourceHash = hex(input.sourceHash, "alpha6_source_hash_invalid");
  if (alpha6Hash(projectSourceCore(source)) !== sourceHash) throw new Error("alpha6_source_hash_mismatch");
  return { ...source, sourceHash };
}

function parsePastedSource(value: unknown, declaredLanguage: V2Alpha6DeclaredLanguage): V2Alpha6PastedSource {
  const input = record(value, "alpha6_pasted_source_invalid");
  exactKeys(input, ["kind", "sourceHash", "sourceText", "journal"], "alpha6_pasted_source_invalid");
  if (input.kind !== "PASTED_DRAFT") throw new Error("alpha6_pasted_source_invalid");
  const sourceText = text(input.sourceText, "alpha6_pasted_source_invalid", 20, V2_ALPHA6_MAX_PASTED_BYTES, true);
  const journal = input.journal === null ? null : parseJournalAuthority(input.journal);
  const source: Omit<V2Alpha6PastedSource, "sourceHash"> = { kind: "PASTED_DRAFT", sourceText, journal };
  const sourceHash = hex(input.sourceHash, "alpha6_source_hash_invalid");
  if (alpha6Hash(pastedSourceCore(source, declaredLanguage)) !== sourceHash) throw new Error("alpha6_source_hash_mismatch");
  return { ...source, sourceHash };
}

export function parseAlpha6WorkspaceRequest(value: unknown): V2Alpha6WorkspaceRequest {
  const input = record(value, "alpha6_request_shape_invalid");
  exactKeys(input, ["contractVersion", "requestId", "entryMode", "declaredLanguage", "source"], "alpha6_request_shape_invalid");
  if (input.contractVersion !== V2_ALPHA6_CONTRACT_VERSION || !V2_ALPHA6_ENTRY_MODES.includes(input.entryMode as never) || !V2_ALPHA6_DECLARED_LANGUAGES.includes(input.declaredLanguage as never)) throw new Error("alpha6_request_shape_invalid");
  const requestId = text(input.requestId, "alpha6_request_id_invalid", 8, 160);
  const entryMode = input.entryMode as V2Alpha6WorkspaceRequest["entryMode"];
  const declaredLanguage = input.declaredLanguage as V2Alpha6DeclaredLanguage;
  const source = entryMode === "PROJECT_ARTIFACT" ? parseProjectSource(input.source) : parsePastedSource(input.source, declaredLanguage);
  if (source.kind !== entryMode) throw new Error("alpha6_entry_source_mismatch");
  return { contractVersion: V2_ALPHA6_CONTRACT_VERSION, requestId, entryMode, declaredLanguage, source };
}

function syntheticAlpha4Authority(journalFreshness: "CURRENT" | "STALE" = "CURRENT") {
  const domainSelection = createBuiltinDomainSelection("ai-education");
  const targetSelection = createTargetSelection("SSCI");
  const alpha4 = createSyntheticAlpha4Workspace({ domainSelection, targetSelection, researchDirection: "證據邊界如何影響高等教育教師的課程決策" });
  const journal = alpha4.journals[0];
  return {
    domainSelection,
    researchIntentHash: alpha4.researchIntentHash,
    s0: alpha4.s0.fields,
    journal: {
      identity: journal.identity,
      policy: { ...journal.policy, freshness: journalFreshness },
      fit: journal.fit,
    } as V2Alpha6JournalAuthority,
  };
}

export function createSyntheticAlpha6ProjectRequest(requestId: string, options: { journalFreshness?: "CURRENT" | "STALE" } = {}): V2Alpha6WorkspaceRequest & { source: V2Alpha6ProjectSource } {
  const authority = syntheticAlpha4Authority(options.journalFreshness ?? "CURRENT");
  const evidenceBundle = {
    coverage: "PARTIAL" as const,
    works: [parseNormalizedWork({ source: "OPENALEX", sourceDate: "2026-08-25", doi: "10.5555/alpha6.fixture", stableSourceId: "W-ALPHA6-FIXTURE", title: "Evidence boundaries in documented teacher decisions", year: 2025, firstAuthor: "Lin", citationCount: 4, confidence: "MEDIUM", evidenceClass: "OBSERVED" })],
    limitations: ["本機 metadata fixture 只證明契約與引用邊界，不代表完整文獻覆蓋。"],
  };
  const sourceWithoutHash: Omit<V2Alpha6ProjectSource, "sourceHash"> = {
    kind: "PROJECT_ARTIFACT",
    researchIntentHash: authority.researchIntentHash,
    domainSelection: authority.domainSelection,
    s0: authority.s0,
    s0Hash: alpha6Hash(authority.s0),
    evidenceBundle,
    evidenceBundleHash: alpha6Hash(evidenceBundle),
    analysisResult: null,
    analysisResultHash: null,
    journal: authority.journal,
  };
  const source = { ...sourceWithoutHash, sourceHash: alpha6Hash(projectSourceCore(sourceWithoutHash)) };
  return { contractVersion: V2_ALPHA6_CONTRACT_VERSION, requestId, entryMode: "PROJECT_ARTIFACT", declaredLanguage: "ZH_TW", source };
}

export function createSyntheticAlpha6PastedRequest(requestId: string, sourceText = "This draft may explain how evidence boundaries shape teacher decisions across two documented stages [7]. The methods and result data remain incomplete.", declaredLanguage: V2Alpha6DeclaredLanguage = "EN"): V2Alpha6WorkspaceRequest & { source: V2Alpha6PastedSource } {
  const authority = syntheticAlpha4Authority("CURRENT");
  const sourceWithoutHash: Omit<V2Alpha6PastedSource, "sourceHash"> = { kind: "PASTED_DRAFT", sourceText, journal: authority.journal };
  const source = { ...sourceWithoutHash, sourceHash: alpha6Hash(pastedSourceCore(sourceWithoutHash, declaredLanguage)) };
  return { contractVersion: V2_ALPHA6_CONTRACT_VERSION, requestId, entryMode: "PASTED_DRAFT", declaredLanguage, source };
}

function narrativeSeed(input: V2Alpha6WorkspaceRequest) {
  if (input.source.kind === "PROJECT_ARTIFACT") {
    return {
      title: input.source.s0.workingTitle,
      problem: input.source.s0.problemContext,
      context: input.source.s0.targetUsers,
      contribution: input.source.s0.expectedContribution,
      method: input.source.s0.methodIdea,
      evidence: input.source.evidenceBundle,
      domain: input.source.s0.domain,
      outputTrack: input.source.s0.outputTrack,
    };
  }
  const first = input.source.sourceText.split(/(?<=[.!?。！？])\s+/u)[0]?.trim() ?? input.source.sourceText.slice(0, 240);
  return {
    title: input.source.journal ? `Evidence-bound manuscript: ${first}`.slice(0, 240) : `Academic manuscript: ${first}`.slice(0, 240),
    problem: first,
    context: "The pasted draft defines the source boundary; population and setting remain to be confirmed.",
    contribution: "The manuscript will distinguish source statements, assumptions, and missing evidence without expanding factual scope.",
    method: "The design and analysis contract remain subject to source-supported revision.",
    evidence: { coverage: "UNAVAILABLE" as const, works: [], limitations: ["No project evidence bundle was bound to this pasted-draft entry."] },
    domain: "Declared by the author in the source draft",
    outputTrack: input.source.journal?.identity.targetId ?? "UNSELECTED",
  };
}

function createNarrativeStrategies(seed: ReturnType<typeof narrativeSeed>): V2Alpha6NarrativeCard[] {
  const rows = [
    {
      strategy: "EVIDENCE_FIRST_CONSERVATIVE" as const,
      title: "證據優先・保守論證",
      framing: `從可查核證據與「${seed.problem}」的明確缺口起筆，僅提出目前資料可支撐的主張。`,
      argumentArchitecture: "證據現況 → 可辯護缺口 → 受限研究問題 → 方法與反證 → 邊界化貢獻",
      evidenceBurden: "所有實質主張須有來源 hash 或明確標成未驗證；寧可保留缺口，不補造連接語。",
      risk: "論述可能較保守，但能降低過度推論與引用錯置。",
    },
    {
      strategy: "BALANCED_JOURNAL_FIT_RECOMMENDED" as const,
      title: "期刊契合・平衡推薦",
      framing: `以${seed.context}的問題張力為主軸，將機制、方法與${seed.outputTrack}讀者需求整合為可反駁敘事。`,
      argumentArchitecture: "實務張力 → 理論機制 → 證據缺口 → 方法契約 → 結果邊界 → 期刊貢獻",
      evidenceBurden: "兼顧現有證據、方法透明度與期刊政策；未知事實維持待確認。",
      risk: "若期刊政策或資料狀態變動，必須重新核對後才能進入投稿準備。",
    },
    {
      strategy: "FRONTIER_THEORY_BUILDING" as const,
      title: "前沿理論・機制建構",
      framing: `把${seed.problem}視為可挑戰既有解釋的邊界案例，提出新機制與失效條件。`,
      argumentArchitecture: "反直覺現象 → 競爭解釋 → 新機制 → 關鍵判別證據 → 高風險檢驗",
      evidenceBurden: "需更強反證、替代解釋與外部效度檢驗；前沿主張一律標成假設。",
      risk: "新穎性較高但證據負擔最大；若關鍵資料不可得，方案必須降階。",
    },
  ];
  return rows.map((row) => ({ ...row, recommended: row.strategy === "BALANCED_JOURNAL_FIT_RECOMMENDED", strategyHash: alpha6Hash(row) }));
}

function createClaimLedger(input: V2Alpha6WorkspaceRequest, seed: ReturnType<typeof narrativeSeed>): V2Alpha6Claim[] {
  const sourceHashes = input.source.kind === "PROJECT_ARTIFACT" && input.source.evidenceBundle.works.length > 0 ? [input.source.evidenceBundleHash] : [];
  const rows: Array<Omit<V2Alpha6Claim, "claimHash">> = [
    { claimId: "claim-verified-source", text: "The workspace retains an exact hash binding to the supplied source artifact.", state: "VERIFIED", evidenceBoundary: "Verified only as source-integrity metadata, not as a research finding.", sourceHashes: [input.source.sourceHash] },
    { claimId: "claim-unverified-gap", text: `The literature gap around ${seed.domain} remains to be independently audited.`, state: "UNVERIFIED", evidenceBoundary: "Synthetic metadata does not establish exhaustive literature coverage.", sourceHashes },
    { claimId: "claim-assumption-mechanism", text: "The proposed mechanism is a testable assumption rather than an observed effect.", state: "ASSUMPTION", evidenceBoundary: "Requires design-specific measurement and competing-explanation tests.", sourceHashes: [] },
    { claimId: "claim-missing-results", text: "Verified result data are not available in this local fixture.", state: "MISSING", evidenceBoundary: "Results must remain planned until an exact verified analysis artifact is bound.", sourceHashes: [] },
  ];
  return rows.map((row) => ({ ...row, claimHash: alpha6Hash(row) }));
}

function section(textValue: string, claimRefs: string[] = [], resultState: V2Alpha6ManuscriptSection["resultState"] = "NOT_APPLICABLE", requiredDataChecklist: string[] = []): V2Alpha6ManuscriptSection {
  return { text: textValue, claimRefs, resultState, requiredDataChecklist };
}

function createManuscript(input: V2Alpha6WorkspaceRequest, seed: ReturnType<typeof narrativeSeed>, strategy: V2Alpha6NarrativeCard, claims: V2Alpha6Claim[]): V2Alpha6Manuscript {
  const hasVerifiedResults = input.source.kind === "PROJECT_ARTIFACT" && input.source.analysisResult?.verifiedResultData === true;
  const identityHash = input.source.journal?.identity.snapshotHash ?? null;
  const policyHash = input.source.journal?.policy.snapshotHash ?? null;
  const sections: Record<V2Alpha6ManuscriptSectionKey, V2Alpha6ManuscriptSection> = {
    title: section(seed.title, ["claim-verified-source"]),
    abstract: section(`This manuscript frames ${seed.problem} through an evidence-bounded account of mechanism, method, and uncertainty. It does not report findings that have not been verified.`, ["claim-verified-source", "claim-missing-results"]),
    keywords: section(`${seed.domain}; evidence boundary; mechanism; research design; ${seed.outputTrack}`, ["claim-verified-source"]),
    introduction: section(`${seed.problem} ${seed.context} The opening argument separates documented source material from the still-unverified literature gap and proposed mechanism.`, ["claim-unverified-gap", "claim-assumption-mechanism"]),
    literatureReviewOrTheoreticalFramework: section(`The framework treats evidence visibility, calibrated trust, and professional judgement as competing but connected explanations. Available metadata are partial, so the claimed gap remains UNVERIFIED until an independent citation audit confirms existence, metadata, and contextual support.`, ["claim-unverified-gap", "claim-assumption-mechanism"]),
    methods: section(`${seed.method} The study must predefine sampling, measures, ethics, missing-data handling, analysis, and falsification criteria before any result claim is made.`, ["claim-assumption-mechanism"]),
    resultsOrPlannedResults: hasVerifiedResults
      ? section(`Results are bound only to the verified analysis artifact ${input.source.kind === "PROJECT_ARTIFACT" ? input.source.analysisResult?.artifactHash : ""}; interpretation remains limited to its documented scope.`, ["claim-verified-source"], "VERIFIED_DATA_BOUND")
      : section("Planned results section: report participant flow, data quality, preregistered primary and secondary analyses, uncertainty intervals, robustness checks, null findings, and deviations only after verified result data are available.", ["claim-missing-results"], "PLANNED", ["Verified analysis artifact hash", "Participant or unit flow and exclusion record", "Primary and sensitivity analysis outputs", "Table and figure values with provenance"]),
    discussion: section("The discussion will compare supported, unsupported, and ambiguous mechanisms against the preregistered expectations. It must not convert planned results or Zotero metadata into findings.", ["claim-assumption-mechanism", "claim-missing-results"]),
    conclusion: section("The conclusion remains provisional: contribution claims will be narrowed to the evidence actually verified after analysis and citation audit.", ["claim-unverified-gap", "claim-missing-results"]),
    limitations: section("Current limitations include partial literature coverage, unverified contextual assumptions, missing result data, and dependence on current journal-policy snapshots.", ["claim-unverified-gap", "claim-assumption-mechanism", "claim-missing-results"]),
    tableSpecifications: section("Planned table specifications only: sample/setting description; variable definitions; data-quality checks; primary estimates with uncertainty; sensitivity analyses. No numeric table values are generated.", ["claim-missing-results"], "PLANNED", ["Exact data dictionary", "Verified analysis outputs", "Suppression and disclosure rules"]),
    figureSpecifications: section("Planned figure specifications only: conceptual mechanism map; participant or data flow; effect estimates with uncertainty when available. No plotted findings are generated.", ["claim-missing-results"], "PLANNED", ["Verified numeric series", "Axis units and uncertainty definition", "Accessible caption and source note"]),
    declarations: section("Authorship roles, ethics approval/consent, data availability, funding, conflicts of interest, and Old Mike assistance disclosure all require author confirmation before submission.", ["claim-missing-results"]),
  };
  if (Object.keys(sections).length !== V2_ALPHA6_MANUSCRIPT_SECTION_KEYS.length || V2_ALPHA6_MANUSCRIPT_SECTION_KEYS.some((key) => !sections[key].text.trim())) throw new Error("alpha6_manuscript_schema_invalid");
  const core = { schemaId: "old-mike-v2-alpha6/manuscript/1" as const, sourceHash: input.source.sourceHash, researchIntentHash: input.source.kind === "PROJECT_ARTIFACT" ? input.source.researchIntentHash : alpha6Hash({ sourceHash: input.source.sourceHash, journal: identityHash }), strategyHash: strategy.strategyHash, journalIdentityHash: identityHash, journalPolicyHash: policyHash, sections, formalWriteCount: 0 as const };
  return { ...core, manuscriptHash: alpha6Hash(core) };
}

function terms(value: string) {
  return [...value.matchAll(/\b[A-Z][A-Z0-9_-]{1,20}\b/gu)].map((match) => match[0].replace(/[-_]+$/u, "")).filter(Boolean).sort();
}

function semanticCautionProfile(value: string) {
  const normalized = value.toLocaleLowerCase("en-US");
  const uncertainty = [...normalized.matchAll(/\b(?:unverified|uncertain)\b|has not been verified|尚未驗證|未驗證|不確定/gu)].length;
  const withoutUncertainty = normalized.replace(/\b(?:unverified|uncertain)\b|has not been verified|尚未驗證|未驗證|不確定/gu, " ");
  const possibility = [...withoutUncertainty.matchAll(/\b(?:may|might|could|possibly)\b|可能|或許|可望/gu)].length;
  const negation = [...withoutUncertainty.matchAll(/\b(?:not|no|cannot|fail|fails|failed|prevent|prevents|prevented)\b|尚未|未能|並未|不能|無法|未/gu)].length;
  return { possibility, uncertainty, negation };
}

function multisetEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function languageRevision(task: V2Alpha6LanguageTask, strategy: V2Alpha6LanguageOption["strategy"], source: string) {
  const fixture = findV2Alpha6R1SemanticFixture(task, source);
  if (!fixture) throw new Error("alpha6_fixture_input_unsupported");
  return fixture.outputs[strategy];
}

function assertLanguagePreservation(source: string, revision: string) {
  const before = preservationFingerprint(source);
  const after = preservationFingerprint(revision);
  for (const key of ["citations", "numbers", "units", "formulas"] as const) if (!multisetEqual(before[key], after[key])) throw new Error(`alpha6_${key}_preservation_failed`);
  if (!multisetEqual(terms(source), terms(revision)) || JSON.stringify(semanticCautionProfile(source)) !== JSON.stringify(semanticCautionProfile(revision))) throw new Error("alpha6_semantic_preservation_failed");
  const paragraphCount = (value: string) => value.split(/\n{2,}/u).length;
  if (paragraphCount(source) !== paragraphCount(revision)) throw new Error("alpha6_paragraph_preservation_failed");
}

export function createAlpha6LanguageAssistance(taskValue: string, sourceValue: string): V2Alpha6LanguageAssistance {
  if (!V2_ALPHA6_LANGUAGE_TASKS.includes(taskValue as never)) throw new Error("alpha6_language_task_invalid");
  const task = taskValue as V2Alpha6LanguageTask;
  const source = text(sourceValue, "alpha6_language_source_invalid", 2, 12_000, true);
  const fixture = findV2Alpha6R1SemanticFixture(task, source);
  if (!fixture) throw new Error("alpha6_fixture_input_unsupported");
  const sourceHash = academicLanguageHash(source);
  const options = V2_ALPHA6_LANGUAGE_ALTERNATIVES.map((strategy) => {
    const authored = languageRevision(task, strategy, source);
    const revision = authored.revision;
    assertLanguagePreservation(source, revision);
    const core = { strategy, task, sourceHash, revision };
    return {
      optionId: `alpha6-option-${academicLanguageHash(core).slice(0, 24)}`,
      strategy,
      recommended: strategy === "PRECISE_JOURNAL_FORMAL",
      source,
      sourceHash,
      revision,
      reason: authored.reason,
      risk: authored.risk,
      preservation: { citations: true, numbers: true, units: true, formulas: true, terminology: true, hedging: true, paragraphBoundaries: true },
    } satisfies V2Alpha6LanguageOption;
  });
  const recommended = options.find((item) => item.recommended)!;
  return { contractVersion: V2_ALPHA6_CONTRACT_VERSION, task, options, recommendedOptionId: recommended.optionId, providerSubmissionCount: 1, formalResearchWriteCount: 0 };
}

export function applyAlpha6LanguageRevision(input: { currentText: string; expectedSourceHash: string; suggestion: V2Alpha6LanguageOption }): V2Alpha6LanguageApplication {
  const currentText = text(input.currentText, "alpha6_apply_source_invalid", 1, 12_000, true);
  const expected = hex(input.expectedSourceHash, "alpha6_apply_hash_invalid");
  if (academicLanguageHash(currentText) !== expected || input.suggestion.sourceHash !== expected || input.suggestion.source !== currentText) throw new Error("alpha6_apply_stale_source");
  assertLanguagePreservation(currentText, input.suggestion.revision);
  return { text: input.suggestion.revision, originalText: currentText, sourceHash: expected, suggestionId: input.suggestion.optionId };
}

export function undoAlpha6LanguageRevision(application: V2Alpha6LanguageApplication) {
  return { ...application, text: application.originalText };
}

export function createSyntheticAlpha6Workspace(raw: V2Alpha6WorkspaceRequest): V2Alpha6Workspace {
  const input = parseAlpha6WorkspaceRequest(raw);
  const seed = narrativeSeed(input);
  const strategies = createNarrativeStrategies(seed);
  if (strategies.map((item) => item.strategy).join("|") !== V2_ALPHA6_NARRATIVE_STRATEGIES.join("|") || strategies.filter((item) => item.recommended).length !== 1) throw new Error("alpha6_strategy_contract_invalid");
  const balanced = strategies.find((item) => item.strategy === "BALANCED_JOURNAL_FIT_RECOMMENDED")!;
  const claimLedger = createClaimLedger(input, seed);
  if (new Set(claimLedger.map((claim) => claim.state)).size !== V2_ALPHA6_CLAIM_STATES.length) throw new Error("alpha6_claim_state_contract_invalid");
  const manuscript = createManuscript(input, seed, balanced, claimLedger);
  const journalAuthority = input.source.journal;
  const zotero = createSyntheticZoteroBindings({ projectRefHash: input.source.sourceHash, collectionLabel: "04_已引用" });
  const submissionReadiness = !journalAuthority ? "BLOCKED" : journalAuthority.identity.freshness !== "CURRENT" || journalAuthority.policy.freshness !== "CURRENT" ? "STALE" : "NEEDS_FIX";
  const humanGateCore = { sourceHash: input.source.sourceHash, manuscriptHash: manuscript.manuscriptHash, scope: "WHOLE_ARTIFACT" as const };
  return {
    contractVersion: V2_ALPHA6_CONTRACT_VERSION,
    entryMode: input.entryMode,
    sourceHash: input.source.sourceHash,
    sourcePreserved: true,
    strategies,
    recommendedStrategy: "BALANCED_JOURNAL_FIT_RECOMMENDED",
    selectedStrategy: "BALANCED_JOURNAL_FIT_RECOMMENDED",
    manuscript,
    claimLedger,
    journalAuthority,
    zoteroEvidence: [{ itemKey: zotero.item.itemKey, metadataHash: zotero.item.normalizedMetadataHash, citationSnapshot: zotero.item.citationSnapshot.metadata, cannotUpgradeClaimState: true, attachmentPolicy: "METADATA_ONLY" }],
    submissionReadiness,
    humanGate: { required: true, scope: "WHOLE_ARTIFACT", confirmed: false, contentHash: alpha6Hash(humanGateCore) },
    providerSubmissionCount: 1,
    cardSwitchProviderSubmissionCount: 0,
    formalResearchWriteCount: 0,
    onlineDatabaseWriteCount: 0,
    externalMutationCount: 0,
  };
}

export function createV2Alpha6Coordinator(generate: (request: V2Alpha6WorkspaceRequest) => Promise<V2Alpha6Workspace> = async (request) => createSyntheticAlpha6Workspace(request)) {
  const settled = new Map<string, Settled>();
  const pending = new Map<string, { requestHash: string; promise: Promise<V2Alpha6Workspace> }>();
  return {
    async run(raw: CoordinatorInput) {
      const { scope, ...requestValue } = raw;
      const request = parseAlpha6WorkspaceRequest(requestValue);
      const boundedScope = text(scope, "alpha6_scope_invalid", 3, 300);
      const key = `${boundedScope}:${request.requestId}`;
      const requestHash = alpha6Hash(request);
      const prior = settled.get(key);
      if (prior) {
        if (prior.requestHash !== requestHash) throw new Error("alpha6_idempotency_conflict");
        return { result: prior.result, replayed: true };
      }
      const active = pending.get(key);
      if (active) {
        if (active.requestHash !== requestHash) throw new Error("alpha6_idempotency_conflict");
        return { result: await active.promise, replayed: true };
      }
      const promise = generate(request);
      pending.set(key, { requestHash, promise });
      try {
        const result = await promise;
        settled.set(key, { requestHash, result });
        return { result, replayed: false };
      } finally {
        pending.delete(key);
      }
    },
  };
}

export const V2_ALPHA6_FORMAL_REPOSITORY_BOUNDARY = Object.freeze({
  researchDocuments: "APPEND_ONLY_EXISTING_AUTHORITY",
  researchWorkflowEvents: "APPEND_ONLY_EXISTING_AUTHORITY",
  researchHumanGates: "WHOLE_ARTIFACT_EXACT_HASH_REQUIRED",
  academicLanguageProvider: "SERVER_ONLY_EXISTING_CONTRACT_REUSED",
  academicLanguageRepository: "NOT_CALLED_BY_LOCAL_PROTOTYPE",
  modelOverride: "NONE",
  migrationRequired: false,
});

export const V2_ALPHA6_S0_FIELD_AUTHORITY: readonly S0FieldName[] = S0_FIELD_NAMES;
