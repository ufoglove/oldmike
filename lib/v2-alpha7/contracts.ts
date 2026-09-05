import { createHash } from "node:crypto";

import {
  V2_ALPHA6_CLAIM_STATES,
  V2_ALPHA6_MANUSCRIPT_SECTION_KEYS,
  type V2Alpha6ClaimState,
  type V2Alpha6ManuscriptSectionKey,
} from "../v2-alpha6/contracts.ts";

export const V2_ALPHA7_CONTRACT_VERSION = "old-mike-v2-alpha7/1.0.0" as const;
export const V2_ALPHA7_MAX_PASTED_BYTES = 48_000 as const;
export const V2_ALPHA7_MAX_REVIEWER_COMMENTS = 24 as const;

export const V2_ALPHA7_ENTRY_MODES = Object.freeze(["ALPHA6_MANUSCRIPT", "PASTED_MANUSCRIPT"] as const);
export const V2_ALPHA7_PURPOSE_MODES = Object.freeze([
  "AUTHOR_PRE_SUBMISSION_REVIEW",
  "AUTHOR_REVISION_AND_REVIEWER_RESPONSE",
  "INDEPENDENT_REVIEWER_MODE",
] as const);
export const V2_ALPHA7_REVIEW_LENSES = Object.freeze([
  "EDITORIAL_CONTRIBUTION",
  "THEORY_ARGUMENT",
  "METHOD_RIGOR",
  "EVIDENCE_ANALYSIS",
  "CLARITY_ETHICS_REPORTING",
] as const);
export const V2_ALPHA7_SEVERITIES = Object.freeze(["CRITICAL", "MAJOR", "MINOR", "STRENGTH"] as const);
export const V2_ALPHA7_RESPONSE_DECISIONS = Object.freeze(["ACCEPT", "PARTIAL", "DECLINE"] as const);
export const V2_ALPHA7_EDITORIAL_RECOMMENDATIONS = Object.freeze(["READY", "MINOR", "MAJOR", "REDESIGN", "OUT_OF_SCOPE"] as const);
export const V2_ALPHA7_REVISION_STRATEGIES = Object.freeze([
  "EVIDENCE_CALIBRATED",
  "JOURNAL_CONCISE_RECOMMENDED",
  "NATURAL_SCHOLARLY",
] as const);

export type V2Alpha7EntryMode = (typeof V2_ALPHA7_ENTRY_MODES)[number];
export type V2Alpha7PurposeMode = (typeof V2_ALPHA7_PURPOSE_MODES)[number];
export type V2Alpha7ReviewLens = (typeof V2_ALPHA7_REVIEW_LENSES)[number];
export type V2Alpha7Severity = (typeof V2_ALPHA7_SEVERITIES)[number];
export type V2Alpha7ResponseDecision = (typeof V2_ALPHA7_RESPONSE_DECISIONS)[number];
export type V2Alpha7EditorialRecommendation = (typeof V2_ALPHA7_EDITORIAL_RECOMMENDATIONS)[number];
export type V2Alpha7RevisionStrategy = (typeof V2_ALPHA7_REVISION_STRATEGIES)[number];

export type V2Alpha7SourceSection = {
  key: V2Alpha6ManuscriptSectionKey;
  text: string;
  sectionHash: string;
};

export type V2Alpha7Source = {
  kind: V2Alpha7EntryMode;
  sourceHash: string;
  manuscriptHash: string | null;
  sourcePreserved: true;
  sections: V2Alpha7SourceSection[];
};

export type V2Alpha7ReviewerComment = {
  commentId: string;
  text: string;
  sourceSection: V2Alpha6ManuscriptSectionKey;
};

export type V2Alpha7StudioRequest = {
  contractVersion: typeof V2_ALPHA7_CONTRACT_VERSION;
  requestId: string;
  purpose: V2Alpha7PurposeMode;
  source: V2Alpha7Source;
  reviewerComments: V2Alpha7ReviewerComment[];
};

export type V2Alpha7RevisionAlternative = {
  alternativeId: string;
  strategy: V2Alpha7RevisionStrategy;
  recommended: boolean;
  sourceHash: string;
  revision: string;
  reason: string;
  risk: string;
  preservesFacts: true;
};

export type V2Alpha7Finding = {
  findingId: string;
  lens: V2Alpha7ReviewLens;
  severity: V2Alpha7Severity;
  claimState: V2Alpha6ClaimState;
  sectionKey: V2Alpha6ManuscriptSectionKey;
  startOffset: number;
  endOffset: number;
  sourceSpan: string;
  sourceSpanHash: string;
  problem: string;
  impact: string;
  requiredEvidence: string;
  action: string;
  alternatives: V2Alpha7RevisionAlternative[];
  recommendedAlternativeId: string;
};

export type V2Alpha7LensReport = {
  lens: V2Alpha7ReviewLens;
  independent: true;
  sourceHash: string;
  strengths: string[];
  findings: V2Alpha7Finding[];
  reportHash: string;
};

export type V2Alpha7CitationCheck = {
  citationId: string;
  existence: "PASS" | "FAIL" | "UNKNOWN";
  metadata: "PASS" | "NEEDS_FIX" | "UNKNOWN";
  context: "PASS" | "FAIL" | "UNKNOWN";
  authority: "INDEPENDENT_VERIFICATION_REQUIRED";
};

export type V2Alpha7ResponseItem = {
  commentId: string;
  interpretation: string;
  decision: V2Alpha7ResponseDecision;
  revisionLocation: string;
  before: string;
  after: string;
  evidence: string;
  responseText: string;
  unresolvedRisk: string;
};

export type V2Alpha7ReviewerReport = {
  readOnly: true;
  strengths: string[];
  majorConcerns: string[];
  minorConcerns: string[];
  methodQuestions: string[];
  ethicsReportingQuestions: string[];
  editorialRecommendation: V2Alpha7EditorialRecommendation;
  journalDecisionClaimed: false;
};

export type V2Alpha7Workspace = {
  contractVersion: typeof V2_ALPHA7_CONTRACT_VERSION;
  purpose: V2Alpha7PurposeMode;
  sourceHash: string;
  originalArtifactImmutable: true;
  sourceSections: V2Alpha7SourceSection[];
  lensReports: V2Alpha7LensReport[];
  prioritizedFindings: V2Alpha7Finding[];
  citationAudit: V2Alpha7CitationCheck[];
  responseMatrix: V2Alpha7ResponseItem[];
  reviewerReport: V2Alpha7ReviewerReport | null;
  editorialRecommendation: V2Alpha7EditorialRecommendation;
  canApplyAuthorRevision: boolean;
  humanGate: { required: true; scope: "WHOLE_ARTIFACT"; confirmed: false; contentHash: string };
  providerSubmissionCount: 1;
  formalResearchWriteCount: 0;
  externalSubmissionEnabled: false;
  externalMutationCount: 0;
};

export type V2Alpha7RevisionApplication = {
  sectionKey: V2Alpha6ManuscriptSectionKey;
  originalText: string;
  text: string;
  sourceHash: string;
  alternativeId: string;
};

type UnknownRecord = Record<string, unknown>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as UnknownRecord).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right, "en-US")).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function alpha7Hash(value: unknown) {
  return createHash("sha256").update(typeof value === "string" ? value : canonical(value), "utf8").digest("hex");
}

export function validateAlpha7Finding(finding: V2Alpha7Finding, sections: V2Alpha7SourceSection[]) {
  if (!V2_ALPHA7_REVIEW_LENSES.includes(finding.lens) || !V2_ALPHA7_SEVERITIES.includes(finding.severity) || !V2_ALPHA6_CLAIM_STATES.includes(finding.claimState)) throw new Error("alpha7_finding_enum_invalid");
  const section = sections.find((item) => item.key === finding.sectionKey);
  if (!section || finding.startOffset < 0 || finding.endOffset <= finding.startOffset || finding.endOffset > section.text.length) throw new Error("alpha7_source_binding_invalid");
  const span = section.text.slice(finding.startOffset, finding.endOffset);
  if (span !== finding.sourceSpan || alpha7Hash(span) !== finding.sourceSpanHash) throw new Error("alpha7_source_binding_invalid");
  if (finding.alternatives.length !== 3 || new Set(finding.alternatives.map((item) => item.strategy)).size !== 3 || V2_ALPHA7_REVISION_STRATEGIES.some((strategy) => !finding.alternatives.some((item) => item.strategy === strategy))) throw new Error("alpha7_revision_strategy_set_invalid");
  if (finding.alternatives.filter((item) => item.recommended).length !== 1 || !finding.alternatives.some((item) => item.alternativeId === finding.recommendedAlternativeId && item.recommended)) throw new Error("alpha7_revision_recommendation_invalid");
  if (new Set(finding.alternatives.map((item) => item.revision.trim())).size !== 3 || finding.alternatives.some((item) => item.sourceHash !== finding.sourceSpanHash || item.revision.includes(finding.sourceSpan) || !item.revision.trim() || !item.reason.trim() || !item.risk.trim())) throw new Error("alpha7_revision_materiality_invalid");
  return finding;
}

export function validateAlpha7Workspace(workspace: V2Alpha7Workspace) {
  if (workspace.contractVersion !== V2_ALPHA7_CONTRACT_VERSION || workspace.originalArtifactImmutable !== true || workspace.formalResearchWriteCount !== 0 || workspace.externalSubmissionEnabled !== false || workspace.externalMutationCount !== 0) throw new Error("alpha7_workspace_boundary_invalid");
  if (workspace.lensReports.length !== 5 || workspace.lensReports.map((item) => item.lens).join("|") !== V2_ALPHA7_REVIEW_LENSES.join("|") || workspace.lensReports.some((item) => item.independent !== true || item.sourceHash !== workspace.sourceHash)) throw new Error("alpha7_lens_independence_invalid");
  const reportFindings = workspace.lensReports.flatMap((item) => item.findings);
  if (reportFindings.length !== workspace.prioritizedFindings.length || new Set(reportFindings.map((item) => item.findingId)).size !== reportFindings.length) throw new Error("alpha7_synthesis_invented_or_missing_finding");
  reportFindings.forEach((finding) => validateAlpha7Finding(finding, workspace.sourceSections));
  if (workspace.purpose === "INDEPENDENT_REVIEWER_MODE" && (workspace.canApplyAuthorRevision || !workspace.reviewerReport?.readOnly || workspace.responseMatrix.length !== 0)) throw new Error("alpha7_reviewer_mode_boundary_invalid");
  if (workspace.purpose !== "INDEPENDENT_REVIEWER_MODE" && (!workspace.canApplyAuthorRevision || workspace.reviewerReport !== null)) throw new Error("alpha7_author_mode_boundary_invalid");
  if (workspace.purpose === "AUTHOR_REVISION_AND_REVIEWER_RESPONSE") {
    if (workspace.responseMatrix.length === 0 || new Set(workspace.responseMatrix.map((item) => item.commentId)).size !== workspace.responseMatrix.length || workspace.responseMatrix.some((item) => !V2_ALPHA7_RESPONSE_DECISIONS.includes(item.decision) || !item.revisionLocation || !item.responseText || (/^(thank|thanks|感謝)(\s|。|！|!)*$/iu.test(item.responseText.trim())) || (item.decision === "DECLINE" && !item.evidence))) throw new Error("alpha7_response_traceability_invalid");
    if (workspace.responseMatrix.some((item) => !workspace.prioritizedFindings.some((finding) => {
      const selected = finding.alternatives.find((option) => option.alternativeId === finding.recommendedAlternativeId);
      return finding.sectionKey === item.revisionLocation && finding.sourceSpan === item.before && selected?.revision === item.after;
    }))) throw new Error("alpha7_response_before_after_binding_invalid");
  }
  return workspace;
}

export function applyAlpha7Revision(input: { currentText: string; currentSourceHash: string; finding: V2Alpha7Finding; alternativeId: string; reviewerMode: boolean }): V2Alpha7RevisionApplication {
  if (input.reviewerMode) throw new Error("alpha7_reviewer_mode_read_only");
  const option = input.finding.alternatives.find((item) => item.alternativeId === input.alternativeId);
  if (!option) throw new Error("alpha7_revision_option_invalid");
  const boundSpan = input.currentText.slice(input.finding.startOffset, input.finding.endOffset);
  if (alpha7Hash(input.currentText) !== input.currentSourceHash || boundSpan !== input.finding.sourceSpan || alpha7Hash(boundSpan) !== input.finding.sourceSpanHash || option.sourceHash !== input.finding.sourceSpanHash) throw new Error("alpha7_stale_source_hash");
  const text = `${input.currentText.slice(0, input.finding.startOffset)}${option.revision}${input.currentText.slice(input.finding.endOffset)}`;
  return { sectionKey: input.finding.sectionKey, originalText: input.currentText, text, sourceHash: input.currentSourceHash, alternativeId: option.alternativeId };
}

export function undoAlpha7Revision(application: V2Alpha7RevisionApplication) {
  return { ...application, text: application.originalText };
}

export const V2_ALPHA7_FORMAL_BOUNDARY = Object.freeze({
  repository: "EXISTING_APPEND_ONLY_RESEARCH_DOCUMENTS_WORKFLOW_EVENTS",
  humanGate: "ONE_WHOLE_ARTIFACT_ONLY",
  localPreviewWrites: 0,
  formalResearchWrites: 0,
  externalSubmission: "DISABLED",
  migrationRequired: false,
});

export const V2_ALPHA7_SECTION_AUTHORITY: readonly V2Alpha6ManuscriptSectionKey[] = V2_ALPHA6_MANUSCRIPT_SECTION_KEYS;
