/**
 * Translation, Academic Polishing, Terminology & Language Quality Contract (V3-U17-FULL)
 * Spec: docs/stage17/spec-v3-4.0.md
 *
 * Implements (spec sections 1-9):
 * 1. Intake of Stage 16 ScientificReviewSnapshot (zero re-entry)
 * 2. Language Work Order + source/scope/external-permission check
 * 3. Scientific-meaning, typed Fact, citation & terminology protection
 * 4. Safe segmentation & alignment
 * 5. Translation (when applicable) / same-language correction / selective academic rewrite
 * 6. Numeric / citation / terminology / semantic QA (fidelity beyond token counts)
 * 7. Adoption, revision, lock & whole-manuscript confirmation
 * 8. Real language version & QA export
 * 9. LanguageQualitySnapshot immutable handoff for Stage 18
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type ScientificReviewSnapshot } from "./scientific-review-v3-contract.ts";

export const LANGUAGE_QUALITY_CONTRACT_VERSION = "language-quality/1.0.0" as const;

// -------------------------------------------------------------
// §1-2 Language Work Order & scope
// -------------------------------------------------------------
export type LanguageTask =
  | "TRANSLATE_ZH_EN"
  | "TRANSLATE_EN_ZH_TW"
  | "SAME_LANGUAGE_CORRECTION"
  | "SELECTIVE_ACADEMIC_REWRITE";

export type LanguageWorkOrder = {
  workOrderId: string;
  projectId: string;
  reviewRunId: string;
  task: LanguageTask;
  sourceLanguage: string; // e.g. zh-TW / en-US
  targetLanguage: string; // e.g. en-US / en-GB / zh-TW
  fullManuscriptLanguageAllowed: boolean;
  languageAllowedScopeRefs: string[]; // semanticSectionIds
  budget: number;
  status: "AUTHORIZED" | "IN_PROGRESS" | "QUALITY_QA_DONE" | "LANGUAGE_READY";
};

// -------------------------------------------------------------
// §5 Fidelity check (not just token counts)
// -------------------------------------------------------------
export type FidelityCheckKind =
  | "TOKEN_LOST"
  | "TOKEN_DUPLICATED"
  | "TOKEN_MODIFIED"
  | "SUBJECT_SWAPPED"
  | "GROUP_SWAPPED"
  | "TIMEPOINT_CHANGED"
  | "DENOMINATOR_CHANGED"
  | "SCALE_OR_UNIT_CHANGED"
  | "COMPARISON_DIRECTION_CHANGED"
  | "NEGATION_CHANGED"
  | "CAUSAL_STRENGTH_CHANGED"
  | "CONFIRMATORY_OR_EXPLORATORY_CHANGED"
  | "LIMITATION_REMOVED"
  | "CITATION_OWNERSHIP_CHANGED"
  | "TERMINOLOGY_MISMATCH";

export type FidelityIssue = {
  issueId: string;
  kind: FidelityCheckKind;
  sectionRef: string;
  paragraphRef?: string;
  protectedValue: string;
  sourceValue: string;
  targetValue: string;
  severity: "FATAL" | "MAJOR" | "MINOR";
  description: string;
  blocksAdoption: boolean;
};

// -------------------------------------------------------------
// §6 Terminology & Translation Memory
// -------------------------------------------------------------
export type TermBinding = {
  termId: string;
  canonicalId: string; // canonical construct ID
  sourceTerm: string;
  targetTerm: string;
  sourceLanguage: string;
  targetLanguage: string;
  isLocked: boolean;
  note: string;
};

// -------------------------------------------------------------
// §7 Provider capability & cost
// -------------------------------------------------------------
export type ProviderCapabilityStatus = "LIVE" | "MOCK" | "BLOCKED" | "NOT_CONFIGURED" | "UNSUPPORTED";
export type ProviderCapability = {
  providerId: "DEEPL_TRANSLATE" | "DEEPL_WRITE" | "OLD_MIKE_SEMANTIC" | "LANGUAGETOOL" | "GOOGLE_FALLBACK" | "AZURE_FALLBACK";
  status: ProviderCapabilityStatus;
  note: string;
};

// -------------------------------------------------------------
// §9 LanguageQualitySnapshot (immutable handoff to Stage 18)
// -------------------------------------------------------------
export type LanguageQualitySnapshot = {
  snapshotId: string;
  schemaVersion: "language-quality/1.0.0";
  stageKey: "V3-U17";
  workspaceId: string;
  projectId: string;
  reviewRunId: string;
  workOrderId: string;
  stageId: "translation-polish";
  nextStageId: "final-compliance"; // Stage 18: 目標期刊/計畫最終合規、送件文件與成果包
  sourceScientificReviewSnapshotId: string;
  sourceScientificReviewSnapshotHash: string;
  sourceScientificReviewDecision: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;

  decision: "LANGUAGE_READY" | "REVISION_REQUIRED" | "BLOCKED";
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    sourceLanguage: string;
    targetLanguage: string;
    task: LanguageTask;
    fullManuscriptLanguageAllowed: boolean;
    languageAllowedScopeRefs: string[];
    totalSegments: number;
    totalSegmentsTranslatedOrEdited: number;
  };

  // Fidelity & QA
  fidelityIssues: FidelityIssue[];
  openFidelityIssueCount: number;
  fatalFidelityIssueCount: number;
  terminologyMismatchCount: number;
  numericQaPassed: boolean;
  citationQaPassed: boolean;
  terminologyQaPassed: boolean;
  semanticQaPassed: boolean;

  // Content references
  termBindingRefs: string[];
  meaningConstraintRefs: string[];
  providerCapabilityRefs: string[];
  alignmentRef: string;
  languageRevisionRef: string;
  qaReportRef: string;
  aiAssistanceAuditRef: string;
  sourceManifestHash: string;

  limitations: string[];
  checksum: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §9 Stage 18 receiver state
// -------------------------------------------------------------
export type Stage18ReceiverState = {
  receiverVersion: "final-compliance-receiver/1.0.0";
  stageKey: "V3-U18-RECEIVER";
  workspaceId: string;
  projectId: string;
  sourceLanguageQualitySnapshotId: string;
  sourceSchemaVersion: string;
  primaryGoal: PrimaryGoalId;
  decision: string;
  languageScopeRefs: string[];
  totalSegments: number;
  translatedSegments: number;
  fatalFidelityIssueCount: number;
  readyForCompliance: boolean;
  receiverNotes: string[];
  reEntryPoint: { route: "translation-polish"; action: "initialize"; snapshotId: string };
  createdAt: string;
};

// -------------------------------------------------------------
// §4 LanguageSegment (safe segmentation with UTF-8 bytes)
// -------------------------------------------------------------
export type LanguageSegment = {
  segmentId: string;
  sectionRef: string;
  paragraphRef?: string;
  sourceText: string;
  sourceUtf8Bytes: number;
  targetText: string;
  status: "PENDING" | "TRANSLATED" | "EDITED" | "ADOPTED" | "LOCKED";
};

// -------------------------------------------------------------
// §9 Error codes
// -------------------------------------------------------------
export const LANGUAGE_QUALITY_ERROR_CODES = [
  "HANDOFF_SCHEMA_UNSUPPORTED",
  "UPSTREAM_REFERENCE_MISSING",
  "SOURCE_HASH_MISMATCH",
  "LANGUAGE_SCOPE_NOT_AUTHORIZED",
  "FULL_MANUSCRIPT_LANGUAGE_NOT_ALLOWED",
  "PROJECT_ACCESS_DENIED",
  "SOURCE_STALE",
  "LOCKED_CONTENT",
  "REVISION_CONFLICT",
  "UNKNOWN_FACT_OR_CITATION",
  "READ_ONLY_RESULT_FACT",
  "QUOTE_USE_NOT_AUTHORIZED",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_BLOCKED",
  "BUDGET_LIMIT_REACHED",
  "EXPORT_FORMAT_UNSUPPORTED",
  "HANDOFF_SAVE_FAILED",
  "FIDELITY_FATAL_ISSUE",
] as const;

export type LanguageQualityErrorCode = (typeof LANGUAGE_QUALITY_ERROR_CODES)[number];
