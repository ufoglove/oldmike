import { createHash } from "node:crypto";

import { S0_FIELD_LIMITS, S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import { parseDomainSelection, type V2Alpha3DomainSelection } from "../v2-alpha3/contracts.ts";
import {
  V2_ALPHA4_CONTRACT_VERSION,
  V2_ALPHA4_REVIEW_LENSES,
  V2_ALPHA4_SOURCE_CONTRACTS,
  V2_ALPHA4_STAGE_RAIL,
  V2_ALPHA4_STATUS_VALUES,
  V2_ALPHA4_TARGET_CATALOG_VERSION,
  V2_ALPHA4_TARGETS,
  type V2Alpha4EnabledTargetId,
  type V2Alpha4Status,
} from "./catalog.ts";

export { V2_ALPHA4_CONTRACT_VERSION, V2_ALPHA4_REVIEW_LENSES, V2_ALPHA4_SOURCE_CONTRACTS, V2_ALPHA4_STAGE_RAIL, V2_ALPHA4_STATUS_VALUES, V2_ALPHA4_TARGET_CATALOG_VERSION, V2_ALPHA4_TARGETS } from "./catalog.ts";

type UnknownRecord = Record<string, unknown>;
type Freshness = "CURRENT" | "STALE" | "MISSING";
type Confidence = "LOW" | "MEDIUM" | "HIGH";

export type V2Alpha4TargetSelection = {
  targetId: V2Alpha4EnabledTargetId;
  label: string;
  catalogVersion: typeof V2_ALPHA4_TARGET_CATALOG_VERSION;
  verificationCollection: "SCIE" | "SSCI";
  selectionHash: string;
};

export type V2Alpha4ResearchIntentBinding = {
  contractVersion: typeof V2_ALPHA4_CONTRACT_VERSION;
  domainSelectionHash: string;
  outputTargetId: V2Alpha4EnabledTargetId;
  outputTargetCatalogVersion: typeof V2_ALPHA4_TARGET_CATALOG_VERSION;
  targetSelectionHash: string;
  researchIntentHash: string;
};

export type JournalIdentityAuthority = {
  schemaId: "old-mike-v2-alpha4/journal-identity/1";
  journalId: string;
  title: string;
  issn: string[];
  issnL: string;
  verifiedCollection: "SCIE" | "SSCI";
  verifiedAt: string;
  sourceDate: string;
  snapshotHash: string;
  freshness: Freshness;
  targetId: V2Alpha4EnabledTargetId;
};

export type JournalPolicySnapshot = {
  schemaId: "old-mike-v2-alpha4/journal-policy/1";
  journalId: string;
  scope: string[];
  articleTypes: string[];
  authorGuide: Record<string, string>;
  ethicsPolicy: string;
  aiPolicy: string;
  dataPolicy: string;
  feeAndOa: string;
  submissionChecklist: string[];
  verifiedAt: string;
  sourceDate: string;
  snapshotHash: string;
  freshness: Freshness;
};

export type JournalRecentCorpus = {
  schemaId: "old-mike-v2-alpha4/journal-recent-corpus/1";
  journalId: string;
  publicLabel: "近期已發表內容的可觀察模式";
  period: { from: string; to: string };
  itemCount: number;
  observedTopics: string[];
  observedMethods: string[];
  observedPopulations: string[];
  observedArticleTypes: string[];
  officialIssueCount: number;
  officialSpecialCollections: string[];
  officialCalls: string[];
  sourceDate: string;
  snapshotHash: string;
  freshness: Freshness;
  confidence: Confidence;
  counterEvidence: string[];
};

export type JournalFitAssessment = {
  schemaId: "old-mike-v2-alpha4/journal-fit/1";
  researchIntentHash: string;
  directionId: string;
  journalId: string;
  status: V2Alpha4Status;
  recommended: boolean;
  blueprint: {
    audienceScopeFit: string;
    contribution: string;
    theoryMechanism: string;
    methodsReportingGuideline: string;
    dataAnalysis: string;
    expectedResultEmphasis: string;
    exactAdaptations: string[];
    deskRejectRisks: string[];
    assumptions: string[];
    invalidationConditions: string[];
    closestFitAlternatives: string[];
  };
};

export type ManuscriptArtifact = {
  schemaId: "old-mike-v2-alpha4/manuscript/1";
  researchIntentHash: string;
  manuscriptHash: string;
  title: string;
  sections: Record<string, string>;
  statements: { authorship: string; ethics: string; dataAvailability: string; aiDisclosure: string; conflictOfInterest: string; funding: string };
  formalWriteCount: 0;
};

export type CitationAudit = {
  schemaId: "old-mike-v2-alpha4/citation-audit/1";
  entries: Array<{ citationId: string; existence: "PASS" | "FAIL" | "UNKNOWN"; metadata: "PASS" | "NEEDS_FIX" | "UNKNOWN"; context: "PASS" | "FAIL" | "UNKNOWN"; sourceSnapshotHash: string; note: string }>;
  status: V2Alpha4Status;
};

export type ReviewResponseLedger = {
  schemaId: "old-mike-v2-alpha4/review-response/1";
  items: Array<{ findingId: string; response: string; changeLocation: string; disposition: "CHANGED" | "EVIDENCE_BASED_DISAGREEMENT" | "ACKNOWLEDGED_LIMITATION" }>;
  allCommentsAccountedFor: true;
};

export type SubmissionAudit = {
  schemaId: "old-mike-v2-alpha4/submission-audit/1";
  journalIdentityFreshness: Freshness;
  policyFreshness: Freshness;
  evidenceAnalysisComplete: boolean;
  fatalReviewerFindingCount: number;
  citationAuditStatus: V2Alpha4Status;
  mandatoryStatementsComplete: boolean;
  coverLetterClaimsTraceable: boolean;
  reviewCommentsAccountedFor: boolean;
  revisionLoopCount: number;
  humanGateConfirmed: boolean;
  externalSubmissionEnabled: false;
  status?: V2Alpha4Status;
};

export type CrossrefDoiMetadata = {
  schemaId: "old-mike-v2-alpha4/crossref-doi/1";
  doi: string;
  title: string;
  issuedYear: number;
  containerTitle: string;
  metadataStatus: "MATCH" | "DRIFT" | "UNKNOWN";
  sourceDate: string;
  snapshotHash: string;
};

function record(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function text(value: unknown, maximum: number, code: string) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (!normalized || normalized.length > maximum) throw new Error(code);
  return normalized;
}

function exactHex(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(code);
  return value;
}

function iso(value: unknown, code: string) {
  const parsed = text(value, 40, code);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(code);
  return parsed;
}

function date(value: unknown, code: string) {
  const parsed = text(value, 10, code);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(parsed)) throw new Error(code);
  return parsed;
}

function list(value: unknown, maximumItems: number, maximumText: number, code: string) {
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(code);
  return value.map((item) => text(item, maximumText, code));
}

export function canonicalAlpha4Json(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalAlpha4Json).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as UnknownRecord).sort().map((key) => `${JSON.stringify(key)}:${canonicalAlpha4Json((value as UnknownRecord)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function sha256Alpha4(value: unknown) {
  return createHash("sha256").update(canonicalAlpha4Json(value), "utf8").digest("hex");
}

export function createTargetSelection(targetId: string): V2Alpha4TargetSelection {
  const target = V2_ALPHA4_TARGETS.find((item) => item.id === targetId);
  if (!target) throw new Error("target_selection_invalid");
  if (!target.enabled || !target.verificationCollection) throw new Error("target_upcoming_alpha5");
  const binding = { targetId: target.id as V2Alpha4EnabledTargetId, label: target.label, catalogVersion: V2_ALPHA4_TARGET_CATALOG_VERSION, verificationCollection: target.verificationCollection };
  return { ...binding, selectionHash: sha256Alpha4(binding) };
}

export function parseTargetSelection(value: unknown): V2Alpha4TargetSelection {
  const input = record(value, "target_selection_invalid");
  const selection = createTargetSelection(text(input.targetId, 8, "target_selection_invalid"));
  if (selection.selectionHash !== input.selectionHash || selection.label !== input.label || selection.catalogVersion !== input.catalogVersion) throw new Error("target_selection_hash_invalid");
  return selection;
}

export function createResearchIntentBinding(input: { domainSelection: V2Alpha3DomainSelection; targetSelection: V2Alpha4TargetSelection }): V2Alpha4ResearchIntentBinding {
  const domainSelection = parseDomainSelection(input.domainSelection);
  const targetSelection = parseTargetSelection(input.targetSelection);
  const base = {
    contractVersion: V2_ALPHA4_CONTRACT_VERSION,
    domainSelectionHash: domainSelection.selectionHash,
    outputTargetId: targetSelection.targetId,
    outputTargetCatalogVersion: targetSelection.catalogVersion,
    targetSelectionHash: targetSelection.selectionHash,
  };
  return { ...base, researchIntentHash: sha256Alpha4(base) };
}

export function parseJournalIdentityAuthority(value: unknown): JournalIdentityAuthority {
  const input = record(value, "journal_identity_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4/journal-identity/1") throw new Error("journal_identity_schema_invalid");
  if (input.targetId !== "SCI" && input.targetId !== "SSCI") throw new Error("journal_target_invalid");
  const expected = input.targetId === "SCI" ? "SCIE" : "SSCI";
  if (input.verifiedCollection !== expected) throw new Error("journal_collection_target_mismatch");
  if (input.freshness !== "CURRENT" && input.freshness !== "STALE" && input.freshness !== "MISSING") throw new Error("journal_freshness_invalid");
  const issn = list(input.issn, 4, 9, "journal_issn_invalid");
  if (issn.some((item) => !/^\d{4}-[\dX]{4}$/u.test(item))) throw new Error("journal_issn_invalid");
  return {
    schemaId: "old-mike-v2-alpha4/journal-identity/1",
    journalId: text(input.journalId, 120, "journal_id_invalid"), title: text(input.title, 300, "journal_title_invalid"), issn,
    issnL: text(input.issnL, 9, "journal_issnl_invalid"), verifiedCollection: input.verifiedCollection as "SCIE" | "SSCI", verifiedAt: iso(input.verifiedAt, "journal_verified_at_invalid"),
    sourceDate: date(input.sourceDate, "journal_source_date_invalid"), snapshotHash: exactHex(input.snapshotHash, "journal_snapshot_hash_invalid"), freshness: input.freshness, targetId: input.targetId,
  };
}

export function parseJournalPolicySnapshot(value: unknown): JournalPolicySnapshot {
  const input = record(value, "journal_policy_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4/journal-policy/1") throw new Error("journal_policy_schema_invalid");
  if (input.freshness !== "CURRENT" && input.freshness !== "STALE" && input.freshness !== "MISSING") throw new Error("journal_policy_freshness_invalid");
  const guide = record(input.authorGuide, "journal_author_guide_invalid");
  const authorGuide = Object.fromEntries(Object.entries(guide).map(([key, value]) => [text(key, 80, "journal_author_guide_invalid"), text(value, 400, "journal_author_guide_invalid")]));
  return {
    schemaId: "old-mike-v2-alpha4/journal-policy/1", journalId: text(input.journalId, 120, "journal_id_invalid"), scope: list(input.scope, 20, 300, "journal_scope_invalid"),
    articleTypes: list(input.articleTypes, 12, 120, "journal_article_types_invalid"), authorGuide, ethicsPolicy: text(input.ethicsPolicy, 1000, "journal_ethics_policy_invalid"),
    aiPolicy: text(input.aiPolicy, 1000, "journal_ai_policy_invalid"), dataPolicy: text(input.dataPolicy, 1000, "journal_data_policy_invalid"), feeAndOa: text(input.feeAndOa, 1000, "journal_fee_policy_invalid"),
    submissionChecklist: list(input.submissionChecklist, 30, 200, "journal_checklist_invalid"), verifiedAt: iso(input.verifiedAt, "journal_policy_verified_at_invalid"), sourceDate: date(input.sourceDate, "journal_policy_source_date_invalid"),
    snapshotHash: exactHex(input.snapshotHash, "journal_policy_hash_invalid"), freshness: input.freshness,
  };
}

export function parseJournalRecentCorpus(value: unknown): JournalRecentCorpus {
  const input = record(value, "journal_corpus_invalid");
  if (Object.hasOwn(input, "privateEditorialPreference") || Object.hasOwn(input, "acceptanceProbability") || Object.keys(input).some((key) => /acceptance|editorialPreference/iu.test(key))) throw new Error("journal_corpus_semantic_extra_key");
  if (input.schemaId !== "old-mike-v2-alpha4/journal-recent-corpus/1") throw new Error("journal_corpus_schema_invalid");
  if (input.publicLabel !== "近期已發表內容的可觀察模式") throw new Error("journal_corpus_label_invalid");
  const period = record(input.period, "journal_corpus_period_invalid");
  if (!Number.isInteger(input.itemCount) || (input.itemCount as number) < 1 || (input.itemCount as number) > 500) throw new Error("journal_corpus_count_invalid");
  if (!Number.isInteger(input.officialIssueCount) || (input.officialIssueCount as number) < 1 || (input.officialIssueCount as number) > 120) throw new Error("journal_corpus_issue_count_invalid");
  if (input.freshness !== "CURRENT" && input.freshness !== "STALE" && input.freshness !== "MISSING") throw new Error("journal_corpus_freshness_invalid");
  if (input.confidence !== "LOW" && input.confidence !== "MEDIUM" && input.confidence !== "HIGH") throw new Error("journal_corpus_confidence_invalid");
  return {
    schemaId: "old-mike-v2-alpha4/journal-recent-corpus/1", journalId: text(input.journalId, 120, "journal_id_invalid"), publicLabel: input.publicLabel,
    period: { from: date(period.from, "journal_corpus_period_invalid"), to: date(period.to, "journal_corpus_period_invalid") }, itemCount: input.itemCount as number,
    observedTopics: list(input.observedTopics, 24, 200, "journal_corpus_topics_invalid"), observedMethods: list(input.observedMethods, 24, 200, "journal_corpus_methods_invalid"),
    observedPopulations: list(input.observedPopulations, 24, 200, "journal_corpus_populations_invalid"), observedArticleTypes: list(input.observedArticleTypes, 24, 200, "journal_corpus_types_invalid"),
    officialIssueCount: input.officialIssueCount as number, officialSpecialCollections: list(input.officialSpecialCollections, 12, 300, "journal_corpus_collections_invalid"), officialCalls: list(input.officialCalls, 12, 300, "journal_corpus_calls_invalid"),
    sourceDate: date(input.sourceDate, "journal_corpus_source_date_invalid"), snapshotHash: exactHex(input.snapshotHash, "journal_corpus_hash_invalid"), freshness: input.freshness,
    confidence: input.confidence, counterEvidence: list(input.counterEvidence, 12, 300, "journal_corpus_counter_evidence_invalid"),
  };
}

export function parseCrossrefDoiMetadata(value: unknown): CrossrefDoiMetadata {
  const input = record(value, "crossref_metadata_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4/crossref-doi/1") throw new Error("crossref_schema_invalid");
  const doi = text(input.doi, 240, "crossref_doi_invalid").replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "").toLocaleLowerCase("en-US");
  if (!/^10\.\d{4,9}\/\S+$/u.test(doi)) throw new Error("crossref_doi_invalid");
  if (!Number.isInteger(input.issuedYear) || (input.issuedYear as number) < 1800 || (input.issuedYear as number) > 2200) throw new Error("crossref_year_invalid");
  if (input.metadataStatus !== "MATCH" && input.metadataStatus !== "DRIFT" && input.metadataStatus !== "UNKNOWN") throw new Error("crossref_status_invalid");
  return { schemaId: "old-mike-v2-alpha4/crossref-doi/1", doi, title: text(input.title, 500, "crossref_title_invalid"), issuedYear: input.issuedYear as number, containerTitle: text(input.containerTitle, 300, "crossref_container_invalid"), metadataStatus: input.metadataStatus, sourceDate: date(input.sourceDate, "crossref_source_date_invalid"), snapshotHash: exactHex(input.snapshotHash, "crossref_hash_invalid") };
}

export function parseJournalFitAssessment(value: unknown): JournalFitAssessment {
  const input = record(value, "journal_fit_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4/journal-fit/1" || !V2_ALPHA4_STATUS_VALUES.includes(input.status as V2Alpha4Status) || typeof input.recommended !== "boolean") throw new Error("journal_fit_shape_invalid");
  const blueprint = record(input.blueprint, "journal_fit_blueprint_invalid");
  return {
    schemaId: "old-mike-v2-alpha4/journal-fit/1", researchIntentHash: exactHex(input.researchIntentHash, "journal_fit_intent_invalid"), directionId: text(input.directionId, 120, "journal_fit_direction_invalid"), journalId: text(input.journalId, 120, "journal_fit_journal_invalid"), status: input.status as V2Alpha4Status, recommended: input.recommended,
    blueprint: { audienceScopeFit: text(blueprint.audienceScopeFit, 1200, "journal_fit_blueprint_invalid"), contribution: text(blueprint.contribution, 1200, "journal_fit_blueprint_invalid"), theoryMechanism: text(blueprint.theoryMechanism, 1200, "journal_fit_blueprint_invalid"), methodsReportingGuideline: text(blueprint.methodsReportingGuideline, 1200, "journal_fit_blueprint_invalid"), dataAnalysis: text(blueprint.dataAnalysis, 1200, "journal_fit_blueprint_invalid"), expectedResultEmphasis: text(blueprint.expectedResultEmphasis, 1200, "journal_fit_blueprint_invalid"), exactAdaptations: list(blueprint.exactAdaptations, 20, 400, "journal_fit_blueprint_invalid"), deskRejectRisks: list(blueprint.deskRejectRisks, 20, 400, "journal_fit_blueprint_invalid"), assumptions: list(blueprint.assumptions, 20, 400, "journal_fit_blueprint_invalid"), invalidationConditions: list(blueprint.invalidationConditions, 20, 400, "journal_fit_blueprint_invalid"), closestFitAlternatives: list(blueprint.closestFitAlternatives, 8, 300, "journal_fit_blueprint_invalid") },
  };
}

export function parseManuscriptArtifact(value: unknown): ManuscriptArtifact {
  const input = record(value, "manuscript_artifact_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4/manuscript/1" || input.formalWriteCount !== 0) throw new Error("manuscript_artifact_shape_invalid");
  const sections = record(input.sections, "manuscript_sections_invalid");
  const statements = record(input.statements, "manuscript_statements_invalid");
  const requiredSections = ["results", "discussion", "methods", "introduction", "abstract"];
  const requiredStatements = ["authorship", "ethics", "dataAvailability", "aiDisclosure", "conflictOfInterest", "funding"];
  if (!requiredSections.every((key) => Object.hasOwn(sections, key)) || !requiredStatements.every((key) => Object.hasOwn(statements, key))) throw new Error("manuscript_required_content_invalid");
  return { schemaId: "old-mike-v2-alpha4/manuscript/1", researchIntentHash: exactHex(input.researchIntentHash, "manuscript_intent_invalid"), manuscriptHash: exactHex(input.manuscriptHash, "manuscript_hash_invalid"), title: text(input.title, 300, "manuscript_title_invalid"), sections: Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, text(value, 12000, "manuscript_section_invalid")])), statements: { authorship: text(statements.authorship, 2000, "manuscript_statement_invalid"), ethics: text(statements.ethics, 2000, "manuscript_statement_invalid"), dataAvailability: text(statements.dataAvailability, 2000, "manuscript_statement_invalid"), aiDisclosure: text(statements.aiDisclosure, 2000, "manuscript_statement_invalid"), conflictOfInterest: text(statements.conflictOfInterest, 2000, "manuscript_statement_invalid"), funding: text(statements.funding, 2000, "manuscript_statement_invalid") }, formalWriteCount: 0 };
}

export function parseCitationAudit(value: unknown): CitationAudit {
  const input = record(value, "citation_audit_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4/citation-audit/1" || !Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 200) throw new Error("citation_audit_shape_invalid");
  const entries = input.entries.map((raw) => {
    const item = record(raw, "citation_entry_invalid");
    if (!["PASS", "FAIL", "UNKNOWN"].includes(String(item.existence)) || !["PASS", "NEEDS_FIX", "UNKNOWN"].includes(String(item.metadata)) || !["PASS", "FAIL", "UNKNOWN"].includes(String(item.context))) throw new Error("citation_axis_invalid");
    return { citationId: text(item.citationId, 120, "citation_id_invalid"), existence: item.existence as "PASS" | "FAIL" | "UNKNOWN", metadata: item.metadata as "PASS" | "NEEDS_FIX" | "UNKNOWN", context: item.context as "PASS" | "FAIL" | "UNKNOWN", sourceSnapshotHash: exactHex(item.sourceSnapshotHash, "citation_source_hash_invalid"), note: text(item.note, 800, "citation_note_invalid") };
  });
  const status: V2Alpha4Status = entries.some((entry) => entry.existence === "FAIL" || entry.context === "FAIL") ? "BLOCKED" : entries.some((entry) => entry.existence === "UNKNOWN" || entry.context === "UNKNOWN") ? "BLOCKED" : entries.some((entry) => entry.metadata === "NEEDS_FIX" || entry.metadata === "UNKNOWN") ? "NEEDS_FIX" : "READY";
  return { schemaId: "old-mike-v2-alpha4/citation-audit/1", entries, status };
}

export function parseFiveLensReview(value: unknown) {
  const input = record(value, "five_lens_review_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4/five-lens-review/1" || input.readOnly !== true || !Array.isArray(input.reports) || input.reports.length !== 5) throw new Error("five_lens_review_shape_invalid");
  const reports = input.reports.map((raw) => {
    const report = record(raw, "review_report_invalid");
    if (!V2_ALPHA4_REVIEW_LENSES.includes(report.lens as (typeof V2_ALPHA4_REVIEW_LENSES)[number]) || !Array.isArray(report.findings)) throw new Error("review_lens_invalid");
    const findings = report.findings.map((rawFinding) => {
      const finding = record(rawFinding, "review_finding_invalid");
      if (!['CRITICAL', 'MAJOR', 'MINOR'].includes(String(finding.severity))) throw new Error("review_severity_invalid");
      return { findingId: text(finding.findingId, 120, "review_finding_id_invalid"), severity: finding.severity as "CRITICAL" | "MAJOR" | "MINOR", title: text(finding.title, 240, "review_finding_title_invalid"), evidenceAnchor: text(finding.evidenceAnchor, 500, "review_evidence_anchor_invalid"), recommendation: text(finding.recommendation, 800, "review_recommendation_invalid") };
    });
    return { lens: report.lens as (typeof V2_ALPHA4_REVIEW_LENSES)[number], reportHash: exactHex(report.reportHash, "review_report_hash_invalid"), findings };
  });
  if (new Set(reports.map((report) => report.lens)).size !== 5) throw new Error("review_lens_duplicate");
  if (!Array.isArray(input.daCriticalAdjudications)) throw new Error("da_critical_adjudication_invalid");
  const adjudications = input.daCriticalAdjudications.map((raw) => {
    const item = record(raw, "da_critical_adjudication_invalid");
    if (item.status !== "RESOLVED" && item.status !== "REJECTED_WITH_RATIONALE" && item.status !== "UNRESOLVED") throw new Error("da_critical_status_invalid");
    return { findingId: text(item.findingId, 120, "da_critical_id_invalid"), status: item.status as "RESOLVED" | "REJECTED_WITH_RATIONALE" | "UNRESOLVED", rationale: text(item.rationale, 800, "da_critical_rationale_invalid") };
  });
  const criticalIds = reports.find((report) => report.lens === "DEVILS_ADVOCATE")?.findings.filter((finding) => finding.severity === "CRITICAL").map((finding) => finding.findingId) ?? [];
  if (criticalIds.some((id) => !adjudications.some((item) => item.findingId === id))) throw new Error("da_critical_unadjudicated");
  return { schemaId: "old-mike-v2-alpha4/five-lens-review/1" as const, readOnly: true as const, reports, daCriticalAdjudications: adjudications };
}

export function parseReviewResponseLedger(value: unknown): ReviewResponseLedger {
  const input = record(value, "review_response_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4/review-response/1" || !Array.isArray(input.items) || input.items.length < 1) throw new Error("review_response_shape_invalid");
  const items = input.items.map((raw) => {
    const item = record(raw, "review_response_item_invalid");
    if (item.disposition !== "CHANGED" && item.disposition !== "EVIDENCE_BASED_DISAGREEMENT" && item.disposition !== "ACKNOWLEDGED_LIMITATION") throw new Error("review_response_disposition_invalid");
    return { findingId: text(item.findingId, 120, "review_response_id_invalid"), response: text(item.response, 1200, "review_response_text_invalid"), changeLocation: text(item.changeLocation, 240, "review_change_location_invalid"), disposition: item.disposition as ReviewResponseLedger["items"][number]["disposition"] };
  });
  if (new Set(items.map((item) => item.findingId)).size !== items.length || input.allCommentsAccountedFor !== true) throw new Error("review_response_completeness_invalid");
  return { schemaId: "old-mike-v2-alpha4/review-response/1", items, allCommentsAccountedFor: true };
}

export function evaluateReadyForHumanSubmission(value: unknown) {
  const input = record(value, "submission_audit_invalid");
  if (input.schemaId !== "old-mike-v2-alpha4/submission-audit/1" || input.externalSubmissionEnabled !== false) throw new Error("submission_audit_shape_invalid");
  if (!Number.isInteger(input.revisionLoopCount) || (input.revisionLoopCount as number) < 0 || (input.revisionLoopCount as number) > 2) throw new Error("revision_loop_limit_exceeded");
  if (input.status === "READY" && input.coverLetterClaimsTraceable !== true) throw new Error("cover_letter_traceability_invalid");
  const stale = input.journalIdentityFreshness !== "CURRENT" || input.policyFreshness !== "CURRENT";
  const blocked = (input.fatalReviewerFindingCount as number) > 0 || input.citationAuditStatus === "BLOCKED";
  const incomplete = input.evidenceAnalysisComplete !== true || input.citationAuditStatus !== "READY" || input.mandatoryStatementsComplete !== true || input.coverLetterClaimsTraceable !== true || input.reviewCommentsAccountedFor !== true;
  const status: V2Alpha4Status = blocked ? "BLOCKED" : stale ? "STALE" : incomplete ? "NEEDS_FIX" : "READY";
  return { status, readyForHumanSubmission: status === "READY", humanGateRequired: true as const, humanGateConfirmed: input.humanGateConfirmed === true, externalSubmissionEnabled: false as const };
}

export function parseS0Fields(value: unknown) {
  const input = record(value, "alpha4_s0_fields_invalid");
  if (Object.keys(input).length !== S0_FIELD_NAMES.length || !S0_FIELD_NAMES.every((field) => Object.hasOwn(input, field))) throw new Error("alpha4_s0_field_set_invalid");
  const fields = {} as Record<S0FieldName, string>;
  for (const field of S0_FIELD_NAMES) fields[field] = text(input[field], S0_FIELD_LIMITS[field], `alpha4_s0_field_invalid:${field}`);
  return fields;
}

export function assertResearchIntentPropagation(workspace: UnknownRecord, researchIntentHash: string) {
  const expected = exactHex(researchIntentHash, "research_intent_hash_invalid");
  const artifacts: unknown[] = [workspace.chat, workspace.evidenceRequest, workspace.recommendation, workspace.selectedJournal, workspace.s0, workspace.manuscript, workspace.coverLetter, workspace.futureProjectImport];
  if (Array.isArray(workspace.directions)) artifacts.push(...workspace.directions);
  if (Array.isArray(workspace.journals)) artifacts.push(...workspace.journals);
  if (artifacts.some((artifact) => record(artifact, "research_intent_artifact_invalid").researchIntentHash !== expected)) throw new Error("research_intent_propagation_mismatch");
  return true;
}
