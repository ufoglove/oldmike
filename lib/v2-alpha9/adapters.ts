import type {
  V2Alpha8ContinuedSection,
  V2Alpha8MaterialRecord,
  V2Alpha8Workspace,
} from "../v2-alpha8/contracts.ts";
import { validateV2Alpha8Workspace } from "../v2-alpha8/contracts.ts";
import {
  V2_ALPHA9_SECTION_KEYS,
  alpha9Hash,
  createAlpha9Section,
  validateAlpha9Sections,
  type V2Alpha9CanonicalManuscript,
  type V2Alpha9CanonicalSection,
  type V2Alpha9CitationLedgerEntry,
  type V2Alpha9StatisticLedgerEntry,
  type V2Alpha9VisualLedgerEntry,
} from "./contracts.ts";

const ALPHA8_SECTION_MAP = Object.freeze({
  ABSTRACT: "ABSTRACT",
  INTRODUCTION: "INTRODUCTION_OR_PROBLEM",
  METHODS: "METHODS_OR_IMPLEMENTATION",
  RESULTS: "RESULTS_OR_EXPECTED_OUTCOMES",
  DISCUSSION: "DISCUSSION_OR_SIGNIFICANCE",
  CONCLUSION: "CONCLUSION_OR_IMPACT",
} as const);

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function alpha8MaterialHashes(materialIds: readonly string[], materials: readonly V2Alpha8MaterialRecord[]) {
  const authority = new Map(materials.map((item) => [item.materialId, item.contentHash]));
  return materialIds.map((id) => {
    const hash = authority.get(id);
    if (!hash) throw new Error("alpha9_alpha8_material_reference_invalid");
    return hash;
  });
}

function continuedSection(section: V2Alpha8ContinuedSection, workspace: V2Alpha8Workspace): V2Alpha9CanonicalSection {
  const sectionKey = ALPHA8_SECTION_MAP[section.sectionId];
  const mode = section.mode === "PRESERVED"
    ? "SOURCE_PRESERVED"
    : section.mode === "PLAN_ONLY"
      ? "PLAN_ONLY"
      : "GENERATED";
  return createAlpha9Section({
    sectionKey,
    text: section.text,
    mode,
    evidenceState: section.evidenceState,
    sourceMaterialIds: [...section.sourceMaterialIds],
    sourceStatisticIds: [...section.statisticIds],
    sourceHashes: unique([
      section.contentHash,
      ...alpha8MaterialHashes(section.sourceMaterialIds, workspace.materials),
    ]),
    unresolvedItems: [...section.unresolvedItems],
  });
}

function generatedSection(
  sectionKey: V2Alpha9CanonicalSection["sectionKey"],
  text: string,
  sourceHash: string,
  evidenceState: V2Alpha9CanonicalSection["evidenceState"] = "UNVERIFIED",
  unresolvedItems: string[] = [],
) {
  return createAlpha9Section({
    sectionKey,
    text,
    mode: text.trim() ? "GENERATED" : "MISSING",
    evidenceState: text.trim() ? evidenceState : "MISSING",
    sourceMaterialIds: [],
    sourceStatisticIds: [],
    sourceHashes: text.trim() ? [sourceHash] : [],
    unresolvedItems,
  });
}

function materialSection(
  sectionKey: V2Alpha9CanonicalSection["sectionKey"],
  materials: readonly V2Alpha8MaterialRecord[],
  kinds: readonly V2Alpha8MaterialRecord["kind"][],
  missingIssue: string,
) {
  const selected = materials.filter((item) => kinds.includes(item.kind));
  if (selected.length === 0) return generatedSection(sectionKey, "", "", "MISSING", [missingIssue]);
  return createAlpha9Section({
    sectionKey,
    text: selected.map((item) => item.content).join("\n\n"),
    mode: "SOURCE_PRESERVED",
    evidenceState: "UNVERIFIED",
    sourceMaterialIds: selected.map((item) => item.materialId),
    sourceStatisticIds: [],
    sourceHashes: selected.map((item) => item.contentHash),
    unresolvedItems: ["來源內容已保留，但引用或主張仍需逐筆核驗。"],
  });
}

function createCitationLedger(workspace: V2Alpha8Workspace): V2Alpha9CitationLedgerEntry[] {
  return workspace.materials
    .filter((item) => item.kind === "CITATION_LIBRARY")
    .map((material, index) => {
      const core = {
        citationId: `alpha8-citation-source-${index + 1}`,
        anchorSection: "REFERENCES" as const,
        anchorText: material.title,
        identifiers: { doi: null, arxiv: null, stableId: null },
        databaseVerification: {
          crossref: "UNKNOWN" as const,
          openAlex: "UNKNOWN" as const,
          semanticScholar: "UNKNOWN" as const,
          arxiv: "UNKNOWN" as const,
        },
        claimAlignment: "UNKNOWN" as const,
        verificationStatus: "UNVERIFIED" as const,
        sourceMaterialIds: [material.materialId],
      };
      return { ...core, entryHash: alpha9Hash(core) };
    });
}

function createVisualLedger(workspace: V2Alpha8Workspace): V2Alpha9VisualLedgerEntry[] {
  return workspace.materials
    .filter((item) => item.kind === "TABLE" || item.kind === "FIGURE")
    .map((material, index) => {
      const core = {
        visualId: `alpha8-${material.kind.toLocaleLowerCase("en-US")}-${index + 1}`,
        kind: material.kind as "TABLE" | "FIGURE",
        title: material.title,
        caption: material.title,
        calloutSections: ["RESULTS_OR_EXPECTED_OUTCOMES" as const],
        sourceMaterialId: material.materialId,
        sourceDataHash: null,
        statisticIds: workspace.statistics.filter((item) => item.sourceMaterialId === material.materialId).map((item) => item.statisticId),
        unitsDeclared: false,
        sampleDeclared: false,
        uncertaintyDeclared: false,
        accessibilityText: null,
        verificationStatus: "MISSING_SOURCE" as const,
      };
      return { ...core, entryHash: alpha9Hash(core) };
    });
}

function createStatisticLedger(workspace: V2Alpha8Workspace, visuals: readonly V2Alpha9VisualLedgerEntry[]): V2Alpha9StatisticLedgerEntry[] {
  return workspace.statistics.map((statistic) => {
    const verificationStatus: V2Alpha9StatisticLedgerEntry["verificationStatus"] = statistic.consistency === "CONSISTENT_REPORTED"
      ? "NEEDS_CHECK"
      : statistic.consistency === "CONFLICT_REPORTED"
        ? "CONFLICT"
        : "NEEDS_CHECK";
    const core = {
      statisticId: statistic.statisticId,
      anchorSection: "RESULTS_OR_EXPECTED_OUTCOMES" as const,
      label: statistic.label,
      value: statistic.value,
      unit: statistic.unit,
      denominator: null,
      analysisMethod: null,
      effectSize: null,
      confidenceInterval: null,
      exactPValue: null,
      sourceMaterialId: statistic.sourceMaterialId,
      linkedVisualIds: visuals.filter((item) => item.sourceMaterialId === statistic.sourceMaterialId).map((item) => item.visualId),
      verificationStatus,
    };
    return { ...core, entryHash: alpha9Hash(core) };
  });
}

export function fromAlpha8Workspace(raw: V2Alpha8Workspace): V2Alpha9CanonicalManuscript {
  const before = alpha9Hash(raw);
  const workspace = validateV2Alpha8Workspace(raw);
  if (workspace.goal !== "JOURNAL_MANUSCRIPT") throw new Error("alpha9_alpha8_track_invalid");

  const resultsDependent = new Set(["ABSTRACT", "RESULTS", "DISCUSSION", "CONCLUSION"]);
  if (!workspace.stageB.resultsNarrativeAllowed && workspace.stageB.continuedDraft.some((section) => resultsDependent.has(section.sectionId) && section.mode !== "PLAN_ONLY")) {
    throw new Error("alpha9_alpha8_results_boundary_invalid");
  }

  const continued = new Map<V2Alpha9CanonicalSection["sectionKey"], V2Alpha9CanonicalSection>(workspace.stageB.continuedDraft.map((item) => [ALPHA8_SECTION_MAP[item.sectionId], continuedSection(item, workspace)]));
  const direction = workspace.stageA.directions.find((item) => item.directionId === workspace.stageB.selectedDirectionId);
  if (!direction) throw new Error("alpha9_alpha8_direction_binding_invalid");
  const s0 = workspace.stageB.s0;
  const sections = validateAlpha9Sections(V2_ALPHA9_SECTION_KEYS.map((sectionKey) => {
    const existing = continued.get(sectionKey);
    if (existing) return existing;
    switch (sectionKey) {
      case "TITLE":
        return generatedSection(sectionKey, s0.workingTitle.value || direction.title, workspace.stageB.artifactHash, s0.workingTitle.evidenceState);
      case "KEYWORDS":
        return generatedSection(sectionKey, unique([workspace.focusDomain.label, s0.domain.value, s0.targetUsers.value]).join("；"), workspace.stageB.artifactHash, "ASSUMPTION", ["關鍵詞尚未依目標期刊詞彙表核對。"]);
      case "LITERATURE_OR_POLICY_CONTEXT":
        return materialSection(sectionKey, workspace.materials, ["CITATION_LIBRARY"], "尚未提供可核對的文獻或引用筆記。");
      case "RESEARCH_QUESTIONS_OR_AIMS":
        return generatedSection(sectionKey, direction.researchQuestion, direction.contentHash, "UNVERIFIED", [...direction.limitations]);
      case "LIMITATIONS_OR_RISKS":
        return generatedSection(sectionKey, unique([...direction.limitations, ...workspace.stageB.blockedReasons]).join("\n"), direction.contentHash, "UNVERIFIED");
      case "REFERENCES":
        return materialSection(sectionKey, workspace.materials, ["CITATION_LIBRARY"], "參考文獻帳本尚未建立。");
      case "DECLARATIONS_OR_ATTACHMENTS":
        return generatedSection(sectionKey, s0.ethicsPrivacyRisks.value, workspace.stageB.artifactHash, s0.ethicsPrivacyRisks.evidenceState, ["倫理、資料可用性與利益衝突聲明仍需正式核對。"]);
      default:
        return generatedSection(sectionKey, "", "", "MISSING", ["Alpha8 未提供此終稿區塊。"]);
    }
  }));

  const visualLedger = createVisualLedger(workspace);
  const statisticLedger = createStatisticLedger(workspace, visualLedger);
  const citationLedger = createCitationLedger(workspace);
  const sourceArtifactHash = alpha9Hash({
    contractVersion: workspace.contractVersion,
    sourceBundleHash: workspace.sourceBundleHash,
    stageAArtifactHash: workspace.stageA.artifactHash,
    stageBArtifactHash: workspace.stageB.artifactHash,
  });
  const core = {
    schemaId: "old-mike-v2-alpha9/canonical-manuscript/1" as const,
    track: "JOURNAL_MANUSCRIPT" as const,
    sourceKind: "ALPHA8_WORKSPACE" as const,
    sourceArtifactHash,
    sourceBundleHash: workspace.sourceBundleHash,
    sourcePreserved: true as const,
    resultNarrativeAllowed: workspace.stageB.resultsNarrativeAllowed,
    sections,
    citationLedger,
    statisticLedger,
    visualLedger,
  };
  const result = { ...core, artifactHash: alpha9Hash(core) };
  if (alpha9Hash(raw) !== before) throw new Error("alpha9_alpha8_source_mutated");
  return result;
}

export const V2_ALPHA9_ALPHA8_ADAPTER_BOUNDARY = Object.freeze({
  acceptedTrack: "JOURNAL_MANUSCRIPT",
  planOnlyPreserved: true,
  resultsNarrativeAuthority: "ALPHA8_STAGE_B_ONLY",
  sourceMutation: "FORBIDDEN",
  citationUpgrade: "FORBIDDEN",
  statisticUpgrade: "FORBIDDEN",
  visualSourceInference: "FORBIDDEN",
  formalResearchWrites: 0,
  onlineDatabaseWrites: 0,
  networkCalls: 0,
  externalMutations: 0,
});
