import { createHash } from "node:crypto";

export const V2_ALPHA9_CONTRACT_VERSION = "old-mike-v2-alpha9/1.0.0" as const;

export const V2_ALPHA9_TRACKS = Object.freeze([
  "JOURNAL_MANUSCRIPT",
  "NSTC_PROPOSAL",
  "MOE_PROPOSAL",
] as const);

export const V2_ALPHA9_SECTION_KEYS = Object.freeze([
  "TITLE",
  "ABSTRACT",
  "KEYWORDS",
  "INTRODUCTION_OR_PROBLEM",
  "LITERATURE_OR_POLICY_CONTEXT",
  "RESEARCH_QUESTIONS_OR_AIMS",
  "METHODS_OR_IMPLEMENTATION",
  "RESULTS_OR_EXPECTED_OUTCOMES",
  "DISCUSSION_OR_SIGNIFICANCE",
  "CONCLUSION_OR_IMPACT",
  "LIMITATIONS_OR_RISKS",
  "REFERENCES",
  "DECLARATIONS_OR_ATTACHMENTS",
] as const);

export const V2_ALPHA9_REVISION_STRATEGIES = Object.freeze([
  "EVIDENCE_CALIBRATED",
  "STRUCTURE_RECOMMENDED",
  "CROSS_DISCIPLINARY_CLARITY",
] as const);

export const V2_ALPHA9_FINDING_CATEGORIES = Object.freeze([
  "COMPLETENESS",
  "EVIDENCE_INTEGRITY",
  "CITATION_INTEGRITY",
  "STATISTICAL_INTEGRITY",
  "VISUAL_INTEGRITY",
  "JOURNAL_OR_PROGRAM_FIT",
  "LANGUAGE_AND_COHERENCE",
] as const);

export type V2Alpha9Track = (typeof V2_ALPHA9_TRACKS)[number];
export type V2Alpha9SectionKey = (typeof V2_ALPHA9_SECTION_KEYS)[number];
export type V2Alpha9RevisionStrategy = (typeof V2_ALPHA9_REVISION_STRATEGIES)[number];
export type V2Alpha9FindingCategory = (typeof V2_ALPHA9_FINDING_CATEGORIES)[number];
export type V2Alpha9EvidenceState = "OBSERVED" | "UNVERIFIED" | "ASSUMPTION" | "MISSING" | "CONFLICT";

export type V2Alpha9CanonicalSection = {
  sectionKey: V2Alpha9SectionKey;
  text: string;
  mode: "SOURCE_PRESERVED" | "GENERATED" | "PLAN_ONLY" | "MISSING";
  evidenceState: V2Alpha9EvidenceState;
  sourceMaterialIds: string[];
  sourceStatisticIds: string[];
  sourceHashes: string[];
  unresolvedItems: string[];
  contentHash: string;
};

export type V2Alpha9CanonicalSections = readonly [
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
  V2Alpha9CanonicalSection,
];

export type V2Alpha9CitationDatabaseStatus = "PASS" | "ABSENT" | "NOT_APPLICABLE" | "UNKNOWN" | "CONFLICT";

export type V2Alpha9CitationLedgerEntry = {
  citationId: string;
  anchorSection: V2Alpha9SectionKey;
  anchorText: string;
  identifiers: { doi: string | null; arxiv: string | null; stableId: string | null };
  databaseVerification: {
    crossref: V2Alpha9CitationDatabaseStatus;
    openAlex: V2Alpha9CitationDatabaseStatus;
    semanticScholar: V2Alpha9CitationDatabaseStatus;
    arxiv: V2Alpha9CitationDatabaseStatus;
  };
  claimAlignment: "PASS" | "FAIL" | "UNKNOWN";
  verificationStatus: "VERIFIED_4_SOURCE" | "PARTIAL" | "UNVERIFIED" | "CONFLICT" | "NOT_APPLICABLE";
  sourceMaterialIds: string[];
  entryHash: string;
};

export type V2Alpha9StatisticLedgerEntry = {
  statisticId: string;
  anchorSection: V2Alpha9SectionKey;
  label: string;
  value: string;
  unit: string;
  denominator: string | null;
  analysisMethod: string | null;
  effectSize: string | null;
  confidenceInterval: string | null;
  exactPValue: string | null;
  sourceMaterialId: string;
  linkedVisualIds: string[];
  verificationStatus: "VERIFIED" | "NEEDS_CHECK" | "MISSING" | "CONFLICT" | "NOT_APPLICABLE";
  entryHash: string;
};

export type V2Alpha9VisualLedgerEntry = {
  visualId: string;
  kind: "TABLE" | "FIGURE";
  title: string;
  caption: string;
  calloutSections: V2Alpha9SectionKey[];
  sourceMaterialId: string;
  sourceDataHash: string | null;
  statisticIds: string[];
  unitsDeclared: boolean;
  sampleDeclared: boolean;
  uncertaintyDeclared: boolean;
  accessibilityText: string | null;
  verificationStatus: "VERIFIED" | "NEEDS_CHECK" | "MISSING_SOURCE" | "CONFLICT";
  entryHash: string;
};

export type V2Alpha9CanonicalManuscript = {
  schemaId: "old-mike-v2-alpha9/canonical-manuscript/1";
  track: "JOURNAL_MANUSCRIPT";
  sourceKind: "ALPHA8_WORKSPACE" | "ALPHA6_MANUSCRIPT" | "ALPHA7_REVISED_MANUSCRIPT" | "PASTED_DOCUMENT";
  sourceArtifactHash: string;
  sourceBundleHash: string;
  sourcePreserved: true;
  resultNarrativeAllowed: boolean;
  sections: V2Alpha9CanonicalSections;
  citationLedger: V2Alpha9CitationLedgerEntry[];
  statisticLedger: V2Alpha9StatisticLedgerEntry[];
  visualLedger: V2Alpha9VisualLedgerEntry[];
  artifactHash: string;
};

export type V2Alpha9RevisionOption = {
  optionId: string;
  strategy: V2Alpha9RevisionStrategy;
  recommended: boolean;
  sourceHash: string;
  revision: string;
  resultingMode: V2Alpha9CanonicalSection["mode"];
  reason: string;
  risk: string;
  preservesEvidence: true;
  optionHash: string;
};

export type V2Alpha9PriorityFinding = {
  findingId: string;
  rank: 1 | 2 | 3;
  category: V2Alpha9FindingCategory;
  severity: "CRITICAL" | "MAJOR" | "MINOR";
  sectionKey: V2Alpha9SectionKey;
  sourceHash: string;
  problem: string;
  impact: string;
  evidenceBoundary: string;
  options: readonly [V2Alpha9RevisionOption, V2Alpha9RevisionOption, V2Alpha9RevisionOption];
  recommendedOptionId: string;
  findingHash: string;
};

export type V2Alpha9CompletenessEntry = {
  sectionKey: V2Alpha9SectionKey;
  status: "PASS" | "PLAN_ONLY" | "MISSING" | "UNVERIFIED" | "CONFLICT";
  blocking: boolean;
  contentHash: string;
  issues: string[];
};

export type V2Alpha9CompletenessMatrix = {
  entries: readonly [
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
    V2Alpha9CompletenessEntry,
  ];
  passCount: number;
  blockingCount: number;
  matrixHash: string;
};

export type V2Alpha9PaperpalBoundary = {
  mode: "MANUAL_DOCX_EXPORT_IMPORT_UNCONFIGURED";
  status: "UNCONFIGURED";
  liveConnection: false;
  sourceMutation: "FORBIDDEN";
  importedCandidateMayUpgradeEvidence: false;
  trackedDocxSemanticMerge: "NOT_IMPLEMENTED";
};

export type V2Alpha9Workspace = {
  contractVersion: typeof V2_ALPHA9_CONTRACT_VERSION;
  track: "JOURNAL_MANUSCRIPT";
  sourceArtifactHash: string;
  sourcePreserved: true;
  sections: V2Alpha9CanonicalSections;
  citationLedger: V2Alpha9CitationLedgerEntry[];
  statisticLedger: V2Alpha9StatisticLedgerEntry[];
  visualLedger: V2Alpha9VisualLedgerEntry[];
  priorityFindings: readonly [V2Alpha9PriorityFinding, V2Alpha9PriorityFinding, V2Alpha9PriorityFinding];
  completenessMatrix: V2Alpha9CompletenessMatrix;
  integrityStatus: "FINAL_CONFIRMABLE" | "READY_WITH_GAPS" | "BLOCKED_EVIDENCE_OR_INTEGRITY";
  reviewDraft: V2Alpha9CanonicalSections;
  reviewDraftHash: string;
  paperpalBoundary: V2Alpha9PaperpalBoundary;
  humanGate: { required: true; scope: "WHOLE_ARTIFACT"; confirmed: false; contentHash: string };
  formalResearchWriteCount: 0;
  onlineDatabaseWriteCount: 0;
  networkCallCount: 0;
  externalMutationCount: 0;
  workspaceHash: string;
};

export type V2Alpha9ManuscriptWorkspace = V2Alpha9Workspace;

export type V2Alpha9FindingSelection = {
  findingId: string;
  optionId: string;
};

export type V2Alpha9ProposalFinalizationBoundary = {
  contractVersion: typeof V2_ALPHA9_CONTRACT_VERSION;
  track: "NSTC_PROPOSAL" | "MOE_PROPOSAL";
  sourceArtifactHash: string;
  sourcePreserved: true;
  officialSourceFreshness: "CURRENT" | "STALE" | "MISSING" | "MIXED_CYCLE";
  requirementMatrixHash: string;
  proposalReviewHash: string;
  paperpalBoundary: null;
  humanGate: { required: true; scope: "WHOLE_ARTIFACT"; confirmed: false; contentHash: string };
  formalResearchWriteCount: 0;
  onlineDatabaseWriteCount: 0;
  networkCallCount: 0;
  externalMutationCount: 0;
};

export type V2Alpha9FinalizeRequest =
  | {
      contractVersion: typeof V2_ALPHA9_CONTRACT_VERSION;
      requestId: string;
      idempotencyKey: string;
      track: "JOURNAL_MANUSCRIPT";
      sourceKind: V2Alpha9CanonicalManuscript["sourceKind"];
      sourceArtifactHash: string;
    }
  | {
      contractVersion: typeof V2_ALPHA9_CONTRACT_VERSION;
      requestId: string;
      idempotencyKey: string;
      track: "NSTC_PROPOSAL" | "MOE_PROPOSAL";
      sourceKind: "ALPHA5_PROPOSAL";
      sourceArtifactHash: string;
    };

export type V2Alpha9FinalizationWorkspace = V2Alpha9Workspace | V2Alpha9ProposalFinalizationBoundary;

export type V2Alpha9WholeArtifactApplication = {
  workspaceHash: string;
  sourceReviewDraftHash: string;
  selectedOptionIds: readonly [string, string, string];
  originalSections: V2Alpha9CanonicalSections;
  appliedSections: V2Alpha9CanonicalSections;
  originalHash: string;
  appliedHash: string;
  formalResearchWriteCount: 0;
  onlineDatabaseWriteCount: 0;
  networkCallCount: 0;
  externalMutationCount: 0;
};

type UnknownRecord = Record<string, unknown>;

export function alpha9CanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(alpha9CanonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as UnknownRecord)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${alpha9CanonicalJson((value as UnknownRecord)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function alpha9Hash(value: unknown) {
  return createHash("sha256").update(alpha9CanonicalJson(value), "utf8").digest("hex");
}

export function isAlpha9Hash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

export function createAlpha9Section(input: Omit<V2Alpha9CanonicalSection, "contentHash">): V2Alpha9CanonicalSection {
  const core = {
    ...input,
    text: input.text.replace(/\r\n?/gu, "\n"),
    sourceMaterialIds: [...input.sourceMaterialIds],
    sourceStatisticIds: [...input.sourceStatisticIds],
    sourceHashes: [...input.sourceHashes],
    unresolvedItems: [...input.unresolvedItems],
  };
  return { ...core, contentHash: alpha9Hash(core) };
}

export function alpha9SectionsHash(sections: readonly V2Alpha9CanonicalSection[]) {
  return alpha9Hash(sections.map(({ sectionKey, contentHash }) => ({ sectionKey, contentHash })));
}

export function validateAlpha9Sections(value: readonly V2Alpha9CanonicalSection[]): V2Alpha9CanonicalSections {
  if (value.length !== V2_ALPHA9_SECTION_KEYS.length) throw new Error("alpha9_section_count_invalid");
  const seen = new Set<string>();
  value.forEach((section, index) => {
    if (section.sectionKey !== V2_ALPHA9_SECTION_KEYS[index] || seen.has(section.sectionKey)) throw new Error("alpha9_section_authority_invalid");
    seen.add(section.sectionKey);
    if (section.text.length > 192_000 || !["SOURCE_PRESERVED", "GENERATED", "PLAN_ONLY", "MISSING"].includes(section.mode) || !["OBSERVED", "UNVERIFIED", "ASSUMPTION", "MISSING", "CONFLICT"].includes(section.evidenceState)) throw new Error("alpha9_section_shape_invalid");
    if (section.mode === "MISSING" && section.text !== "") throw new Error("alpha9_missing_section_text_invalid");
    if (section.mode !== "MISSING" && section.text.trim().length === 0) throw new Error("alpha9_section_text_invalid");
    const { contentHash, ...core } = section;
    if (!isAlpha9Hash(contentHash) || alpha9Hash(core) !== contentHash) throw new Error("alpha9_section_hash_mismatch");
  });
  return value as V2Alpha9CanonicalSections;
}

export const V2_ALPHA9_PAPERPAL_BOUNDARY = Object.freeze({
  mode: "MANUAL_DOCX_EXPORT_IMPORT_UNCONFIGURED",
  status: "UNCONFIGURED",
  liveConnection: false,
  sourceMutation: "FORBIDDEN",
  importedCandidateMayUpgradeEvidence: false,
  trackedDocxSemanticMerge: "NOT_IMPLEMENTED",
} satisfies V2Alpha9PaperpalBoundary);

export const V2_ALPHA9_RUNTIME_BOUNDARY = Object.freeze({
  sourceMutation: "FORBIDDEN",
  paperpal: "MANUAL_DOCX_EXPORT_IMPORT_UNCONFIGURED",
  formalResearchWrites: 0,
  onlineDatabaseWrites: 0,
  networkCalls: 0,
  externalMutations: 0,
});
