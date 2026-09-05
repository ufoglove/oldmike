import type { V2Alpha3DomainSelection, V2Alpha3NormalizedWork } from "../v2-alpha3/contracts.ts";
import type { JournalFitAssessment, JournalIdentityAuthority, JournalPolicySnapshot } from "../v2-alpha4/contracts.ts";
import type { CitationMetadata } from "../v2-alpha4-r1/zotero-contracts.ts";
import type { S0FieldName } from "../s0-fields.ts";

export const V2_ALPHA6_CONTRACT_VERSION = "old-mike-v2-alpha6/1.0.0" as const;
export const V2_ALPHA6_MAX_PASTED_BYTES = 48_000 as const;

export const V2_ALPHA6_ENTRY_MODES = Object.freeze(["PROJECT_ARTIFACT", "PASTED_DRAFT"] as const);
export const V2_ALPHA6_DECLARED_LANGUAGES = Object.freeze(["ZH_TW", "EN"] as const);
export const V2_ALPHA6_NARRATIVE_STRATEGIES = Object.freeze([
  "EVIDENCE_FIRST_CONSERVATIVE",
  "BALANCED_JOURNAL_FIT_RECOMMENDED",
  "FRONTIER_THEORY_BUILDING",
] as const);
export const V2_ALPHA6_LANGUAGE_TASKS = Object.freeze([
  "ZH_TW_TO_EN",
  "EN_TO_ZH_TW",
  "ACADEMIC_EN_EDIT",
  "NATURAL_SCHOLARLY_STYLE",
] as const);
export const V2_ALPHA6_LANGUAGE_ALTERNATIVES = Object.freeze([
  "FAITHFUL",
  "PRECISE_JOURNAL_FORMAL",
  "NATURAL_SCHOLARLY",
] as const);
export const V2_ALPHA6_CLAIM_STATES = Object.freeze(["VERIFIED", "UNVERIFIED", "ASSUMPTION", "MISSING"] as const);
export const V2_ALPHA6_MANUSCRIPT_SECTION_KEYS = Object.freeze([
  "title",
  "abstract",
  "keywords",
  "introduction",
  "literatureReviewOrTheoreticalFramework",
  "methods",
  "resultsOrPlannedResults",
  "discussion",
  "conclusion",
  "limitations",
  "tableSpecifications",
  "figureSpecifications",
  "declarations",
] as const);

export type V2Alpha6EntryMode = (typeof V2_ALPHA6_ENTRY_MODES)[number];
export type V2Alpha6DeclaredLanguage = (typeof V2_ALPHA6_DECLARED_LANGUAGES)[number];
export type V2Alpha6NarrativeStrategy = (typeof V2_ALPHA6_NARRATIVE_STRATEGIES)[number];
export type V2Alpha6LanguageTask = (typeof V2_ALPHA6_LANGUAGE_TASKS)[number];
export type V2Alpha6LanguageAlternative = (typeof V2_ALPHA6_LANGUAGE_ALTERNATIVES)[number];
export type V2Alpha6ClaimState = (typeof V2_ALPHA6_CLAIM_STATES)[number];
export type V2Alpha6ManuscriptSectionKey = (typeof V2_ALPHA6_MANUSCRIPT_SECTION_KEYS)[number];

export type V2Alpha6JournalAuthority = {
  identity: JournalIdentityAuthority;
  policy: JournalPolicySnapshot;
  fit: JournalFitAssessment;
};

export type V2Alpha6ProjectSource = {
  kind: "PROJECT_ARTIFACT";
  sourceHash: string;
  researchIntentHash: string;
  domainSelection: V2Alpha3DomainSelection;
  s0: Record<S0FieldName, string>;
  s0Hash: string;
  evidenceBundle: { coverage: "COMPLETE" | "PARTIAL" | "UNAVAILABLE"; works: V2Alpha3NormalizedWork[]; limitations: string[] };
  evidenceBundleHash: string;
  analysisResult: null | { artifactHash: string; verifiedResultData: boolean; summary: string };
  analysisResultHash: string | null;
  journal: V2Alpha6JournalAuthority;
};

export type V2Alpha6PastedSource = {
  kind: "PASTED_DRAFT";
  sourceHash: string;
  sourceText: string;
  journal: V2Alpha6JournalAuthority | null;
};

export type V2Alpha6WorkspaceRequest = {
  contractVersion: typeof V2_ALPHA6_CONTRACT_VERSION;
  requestId: string;
  entryMode: V2Alpha6EntryMode;
  declaredLanguage: V2Alpha6DeclaredLanguage;
  source: V2Alpha6ProjectSource | V2Alpha6PastedSource;
};

export type V2Alpha6NarrativeCard = {
  strategy: V2Alpha6NarrativeStrategy;
  title: string;
  framing: string;
  argumentArchitecture: string;
  evidenceBurden: string;
  risk: string;
  recommended: boolean;
  strategyHash: string;
};

export type V2Alpha6Claim = {
  claimId: string;
  text: string;
  state: V2Alpha6ClaimState;
  evidenceBoundary: string;
  sourceHashes: string[];
  claimHash: string;
};

export type V2Alpha6ManuscriptSection = {
  text: string;
  claimRefs: string[];
  resultState: "NOT_APPLICABLE" | "VERIFIED_DATA_BOUND" | "PLANNED" | "MISSING";
  requiredDataChecklist: string[];
};

export type V2Alpha6Manuscript = {
  schemaId: "old-mike-v2-alpha6/manuscript/1";
  sourceHash: string;
  researchIntentHash: string;
  strategyHash: string;
  journalIdentityHash: string | null;
  journalPolicyHash: string | null;
  sections: Record<V2Alpha6ManuscriptSectionKey, V2Alpha6ManuscriptSection>;
  manuscriptHash: string;
  formalWriteCount: 0;
};

export type V2Alpha6LanguageOption = {
  optionId: string;
  strategy: V2Alpha6LanguageAlternative;
  recommended: boolean;
  source: string;
  sourceHash: string;
  revision: string;
  reason: string;
  risk: string;
  preservation: {
    citations: true;
    numbers: true;
    units: true;
    formulas: true;
    terminology: true;
    hedging: true;
    paragraphBoundaries: true;
  };
};

export type V2Alpha6LanguageAssistance = {
  contractVersion: typeof V2_ALPHA6_CONTRACT_VERSION;
  task: V2Alpha6LanguageTask;
  options: V2Alpha6LanguageOption[];
  recommendedOptionId: string;
  providerSubmissionCount: 1;
  formalResearchWriteCount: 0;
};

export type V2Alpha6Workspace = {
  contractVersion: typeof V2_ALPHA6_CONTRACT_VERSION;
  entryMode: V2Alpha6EntryMode;
  sourceHash: string;
  sourcePreserved: true;
  strategies: V2Alpha6NarrativeCard[];
  recommendedStrategy: "BALANCED_JOURNAL_FIT_RECOMMENDED";
  selectedStrategy: "BALANCED_JOURNAL_FIT_RECOMMENDED";
  manuscript: V2Alpha6Manuscript;
  claimLedger: V2Alpha6Claim[];
  journalAuthority: V2Alpha6JournalAuthority | null;
  zoteroEvidence: Array<{
    itemKey: string;
    metadataHash: string;
    citationSnapshot: CitationMetadata;
    cannotUpgradeClaimState: true;
    attachmentPolicy: "METADATA_ONLY";
  }>;
  submissionReadiness: "NEEDS_FIX" | "STALE" | "BLOCKED";
  humanGate: { required: true; scope: "WHOLE_ARTIFACT"; confirmed: false; contentHash: string };
  providerSubmissionCount: 1;
  cardSwitchProviderSubmissionCount: 0;
  formalResearchWriteCount: 0;
  onlineDatabaseWriteCount: 0;
  externalMutationCount: 0;
};

export type V2Alpha6LanguageApplication = {
  text: string;
  originalText: string;
  sourceHash: string;
  suggestionId: string;
};
