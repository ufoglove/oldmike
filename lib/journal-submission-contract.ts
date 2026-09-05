import { createHash } from "node:crypto";
import { parseModelModeProfile, type ModelModeProfile } from "./model-mode-contract.ts";

export const JOURNAL_SUBMISSION_CONTRACT_VERSION = "journal-submission-studio/1.0.0";
export const JOURNAL_SUBMISSION_MAX_BODY_BYTES = 131_072;
export const JOURNAL_SUBMISSION_MAX_TEXT_BYTES = 64_000;

export const requirementCategories = [
  "ARTICLE_TYPE",
  "TITLE_ABSTRACT_KEYWORDS",
  "SECTION_ORDER",
  "WORD_LIMITS",
  "REFERENCES_STYLE",
  "FIGURES_TABLES_SUPPLEMENTS",
  "REPORTING_GUIDELINE",
  "ETHICS_CONSENT",
  "DATA_CODE_AVAILABILITY",
  "FUNDING_CONFLICTS",
  "AUTHOR_CONTRIBUTIONS",
  "ORCID",
  "FILE_PACKAGE_REQUIREMENTS",
] as const;
export const requirementStatuses = ["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"] as const;
export const authorityClasses = ["PUBLISHER", "JOURNAL"] as const;
export const extractionStatuses = ["MANUAL_ENTRY", "LOCAL_SNAPSHOT", "EXTRACTION_FAILED"] as const;
export const humanVerificationStates = ["UNVERIFIED", "VERIFIED", "REJECTED"] as const;
export const heuristicFitStates = ["STRONG", "POSSIBLE", "WEAK", "UNKNOWN"] as const;
export const heuristicDimensions = ["SCOPE", "AUDIENCE", "ARTICLE_TYPE", "METHOD_FIT", "EDITORIAL_FIT"] as const;

export type RequirementCategory = (typeof requirementCategories)[number];
export type RequirementStatus = (typeof requirementStatuses)[number];
export type HumanVerificationState = (typeof humanVerificationStates)[number];
export type ClaimSupportKind = "MANUSCRIPT_PARAGRAPH" | "PROJECT_FACT";

export type OfficialRequirementSource = {
  sourceUrl: string;
  authorityClass: (typeof authorityClasses)[number];
  checkedAt: string;
  effectiveDate: string | null;
  sourceHash: string;
  extractionStatus: (typeof extractionStatuses)[number];
  humanVerificationState: HumanVerificationState;
};

export type RequirementRule = {
  category: RequirementCategory;
  rule: string;
  applicable: boolean;
};

export type ProjectFact = {
  factId: string;
  text: string;
  contentHash: string;
  verificationState: "VERIFIED_PROJECT_FACT" | "USER_ASSERTED_UNVERIFIED";
};

export type RunSubmissionCheckRequest = {
  operation: "RUN_SUBMISSION_CHECK";
  idempotencyKey: string;
  logicalId: string;
  expectedVersion: number;
  title: string;
  sourceDocumentVersionId: string;
  sourceContentHash: string;
  targetJournal: { journalName: string; publisherName: string; articleType: string };
  officialSource: OfficialRequirementSource;
  requirements: RequirementRule[];
  projectFacts: ProjectFact[];
  integrityConfirmed: true;
  modeProfile: ModelModeProfile;
};

export type ClaimLedgerEntry = {
  claimId: string;
  supportKind: ClaimSupportKind;
  supportId: string;
  supportHash: string;
  claimText: string;
  risk: string;
};

export type SaveCoverLetterRequest = {
  operation: "SAVE_COVER_LETTER";
  idempotencyKey: string;
  analysisDocumentVersionId: string;
  analysisContentHash: string;
  logicalId: string;
  expectedVersion: number;
  title: string;
  coverLetterBody: string;
  claimLedger: ClaimLedgerEntry[];
  editRationale: string;
};

export type ApproveSubmissionRequest = {
  operation: "APPROVE_SUBMISSION";
  idempotencyKey: string;
  analysisDocumentVersionId: string;
  analysisContentHash: string;
  coverLetterDocumentVersionId: string;
  coverLetterContentHash: string;
  acceptedUnknowns: RequirementCategory[];
  rationale: string;
};

export type FinalizeSubmissionRequest = {
  operation: "FINALIZE_SUBMISSION";
  idempotencyKey: string;
  analysisDocumentVersionId: string;
  analysisContentHash: string;
  coverLetterDocumentVersionId: string;
  coverLetterContentHash: string;
  humanGateId: string;
  targetLogicalId: string;
  expectedVersion: number;
  title: string;
};

export type JournalSubmissionRequest = RunSubmissionCheckRequest | SaveCoverLetterRequest | ApproveSubmissionRequest | FinalizeSubmissionRequest;
export type ResolvedRunSubmissionCheckRequest = RunSubmissionCheckRequest & { manuscriptText: string };

export type JournalSubmissionProviderResult = {
  contractVersion: typeof JOURNAL_SUBMISSION_CONTRACT_VERSION;
  status: "SUCCESS";
  manuscriptHash: string;
  factualFit: Array<{ category: RequirementCategory; status: RequirementStatus; evidence: string; remediation: string; risk: string }>;
  heuristicFit: Array<{ dimension: (typeof heuristicDimensions)[number]; fit: (typeof heuristicFitStates)[number]; rationale: string; uncertainty: string }>;
  coverLetterDraft: string;
  claimLedger: ClaimLedgerEntry[];
  uncertainties: string[];
};

export class JournalSubmissionContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = "JournalSubmissionContractError"; this.code = code; this.status = status; }
}

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function exact(value: Record<string, unknown>, keys: readonly string[]) { return Object.keys(value).sort().join("\0") === [...keys].sort().join("\0"); }
function enumValue<T extends string>(value: unknown, values: readonly T[], code: string): T { if (typeof value !== "string" || !values.includes(value as T)) throw new JournalSubmissionContractError(code); return value as T; }
function identifier(value: unknown, code: string) { if (typeof value !== "string" || value.length < 8 || value.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(value)) throw new JournalSubmissionContractError(code); return value; }
function digest(value: unknown, code: string) { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new JournalSubmissionContractError(code); return value; }
function integer(value: unknown, code: string, min = 0) { if (!Number.isSafeInteger(value) || Number(value) < min) throw new JournalSubmissionContractError(code); return Number(value); }
function text(value: unknown, code: string, max: number, min = 1) {
  if (typeof value !== "string") throw new JournalSubmissionContractError(code);
  const normalized = value.replace(/\r\n?/g, "\n");
  if (normalized.trim().length < min || Buffer.byteLength(normalized, "utf8") > max || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) throw new JournalSubmissionContractError(code);
  return normalized;
}
function timestamp(value: unknown, code: string) { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw new JournalSubmissionContractError(code); return value; }

export function journalSubmissionHash(value: unknown) {
  const canonical = (item: unknown): string => Array.isArray(item) ? `[${item.map(canonical).join(",")}]` : item && typeof item === "object" ? `{${Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`).join(",")}}` : JSON.stringify(item);
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

export function journalSubmissionRequestHash(value: RunSubmissionCheckRequest | ResolvedRunSubmissionCheckRequest) {
  const { manuscriptText: _manuscriptText, ...request } = value as ResolvedRunSubmissionCheckRequest;
  return journalSubmissionHash(request);
}

export function assertOfficialSourceUrl(value: unknown) {
  const sourceUrl = text(value, "invalid_official_source_url", 2_000);
  let parsed: URL;
  try { parsed = new URL(sourceUrl); } catch { throw new JournalSubmissionContractError("invalid_official_source_url"); }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash || host === "localhost" || host.endsWith(".local") || /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$)/.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) throw new JournalSubmissionContractError("official_source_network_policy_rejected");
  return parsed.toString();
}

function parseOfficialSource(value: unknown): OfficialRequirementSource {
  const row = record(value); const keys = ["sourceUrl", "authorityClass", "checkedAt", "effectiveDate", "sourceHash", "extractionStatus", "humanVerificationState"];
  if (!row || !exact(row, keys)) throw new JournalSubmissionContractError("invalid_official_source_shape");
  const effectiveDate = row.effectiveDate === null ? null : text(row.effectiveDate, "invalid_effective_date", 32);
  if (effectiveDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new JournalSubmissionContractError("invalid_effective_date");
  return { sourceUrl: assertOfficialSourceUrl(row.sourceUrl), authorityClass: enumValue(row.authorityClass, authorityClasses, "invalid_authority_class"), checkedAt: timestamp(row.checkedAt, "invalid_checked_at"), effectiveDate, sourceHash: digest(row.sourceHash, "invalid_source_hash"), extractionStatus: enumValue(row.extractionStatus, extractionStatuses, "invalid_extraction_status"), humanVerificationState: enumValue(row.humanVerificationState, humanVerificationStates, "invalid_human_verification_state") };
}

function parseRequirement(value: unknown): RequirementRule {
  const row = record(value); if (!row || !exact(row, ["category", "rule", "applicable"]) || typeof row.applicable !== "boolean") throw new JournalSubmissionContractError("invalid_requirement_shape");
  return { category: enumValue(row.category, requirementCategories, "invalid_requirement_category"), rule: text(row.rule, "invalid_requirement_rule", 3_000), applicable: row.applicable };
}

function parseProjectFact(value: unknown): ProjectFact {
  const row = record(value); if (!row || !exact(row, ["factId", "text", "contentHash", "verificationState"])) throw new JournalSubmissionContractError("invalid_project_fact_shape");
  const factText = text(row.text, "invalid_project_fact", 2_000);
  const contentHash = digest(row.contentHash, "invalid_project_fact_hash");
  if (contentHash !== journalSubmissionHash(factText)) throw new JournalSubmissionContractError("project_fact_hash_mismatch");
  return { factId: identifier(row.factId, "invalid_fact_id"), text: factText, contentHash, verificationState: enumValue(row.verificationState, ["VERIFIED_PROJECT_FACT", "USER_ASSERTED_UNVERIFIED"] as const, "invalid_project_fact_verification") };
}

function parseClaim(value: unknown): ClaimLedgerEntry {
  const row = record(value); if (!row || !exact(row, ["claimId", "supportKind", "supportId", "supportHash", "claimText", "risk"])) throw new JournalSubmissionContractError("invalid_claim_ledger_shape");
  const supportKind = enumValue(row.supportKind, ["MANUSCRIPT_PARAGRAPH", "PROJECT_FACT"] as const, "invalid_claim_support_kind");
  const supportId = supportKind === "MANUSCRIPT_PARAGRAPH" && typeof row.supportId === "string" && /^p-[0-9]{3}$/.test(row.supportId) ? row.supportId : identifier(row.supportId, "invalid_claim_support_id");
  return { claimId: identifier(row.claimId, "invalid_claim_id"), supportKind, supportId, supportHash: digest(row.supportHash, "invalid_claim_support_hash"), claimText: text(row.claimText, "invalid_claim_text", 2_000), risk: text(row.risk, "invalid_claim_risk", 800) };
}

function parseRun(row: Record<string, unknown>): RunSubmissionCheckRequest {
  const keys = ["operation", "idempotencyKey", "logicalId", "expectedVersion", "title", "sourceDocumentVersionId", "sourceContentHash", "targetJournal", "officialSource", "requirements", "projectFacts", "integrityConfirmed", "modeProfile"];
  if (!exact(row, keys) || row.integrityConfirmed !== true) throw new JournalSubmissionContractError("invalid_run_submission_shape");
  const target = record(row.targetJournal);
  if (!target || !exact(target, ["journalName", "publisherName", "articleType"])) throw new JournalSubmissionContractError("invalid_target_journal_shape");
  if (!Array.isArray(row.requirements) || row.requirements.length !== requirementCategories.length) throw new JournalSubmissionContractError("requirements_matrix_incomplete");
  const requirements = row.requirements.map(parseRequirement);
  if (new Set(requirements.map((item) => item.category)).size !== requirementCategories.length || requirementCategories.some((item) => !requirements.some((rule) => rule.category === item))) throw new JournalSubmissionContractError("requirements_matrix_incomplete");
  if (!Array.isArray(row.projectFacts) || row.projectFacts.length > 40) throw new JournalSubmissionContractError("invalid_project_facts");
  const projectFacts = row.projectFacts.map(parseProjectFact);
  if (new Set(projectFacts.map((item) => item.factId)).size !== projectFacts.length) throw new JournalSubmissionContractError("duplicate_project_fact");
  return { operation: "RUN_SUBMISSION_CHECK", idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"), logicalId: identifier(row.logicalId, "invalid_logical_id"), expectedVersion: integer(row.expectedVersion, "invalid_expected_version"), title: text(row.title, "invalid_title", 240), sourceDocumentVersionId: identifier(row.sourceDocumentVersionId, "invalid_source_document_id"), sourceContentHash: digest(row.sourceContentHash, "invalid_source_content_hash"), targetJournal: { journalName: text(target.journalName, "invalid_journal_name", 240), publisherName: text(target.publisherName, "invalid_publisher_name", 240), articleType: text(target.articleType, "invalid_article_type", 160) }, officialSource: parseOfficialSource(row.officialSource), requirements, projectFacts, integrityConfirmed: true, modeProfile: parseModelModeProfile(row.modeProfile) };
}

export function parseJournalSubmissionRequest(value: unknown): JournalSubmissionRequest {
  const row = record(value); if (!row || typeof row.operation !== "string") throw new JournalSubmissionContractError("invalid_journal_submission_shape");
  if (row.operation === "RUN_SUBMISSION_CHECK") return parseRun(row);
  if (row.operation === "SAVE_COVER_LETTER") {
    if (!exact(row, ["operation", "idempotencyKey", "analysisDocumentVersionId", "analysisContentHash", "logicalId", "expectedVersion", "title", "coverLetterBody", "claimLedger", "editRationale"]) || !Array.isArray(row.claimLedger) || row.claimLedger.length > 80) throw new JournalSubmissionContractError("invalid_save_cover_letter_shape");
    const claimLedger = row.claimLedger.map(parseClaim); if (new Set(claimLedger.map((item) => item.claimId)).size !== claimLedger.length) throw new JournalSubmissionContractError("duplicate_claim");
    return { operation: "SAVE_COVER_LETTER", idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"), analysisDocumentVersionId: identifier(row.analysisDocumentVersionId, "invalid_analysis_document_id"), analysisContentHash: digest(row.analysisContentHash, "invalid_analysis_content_hash"), logicalId: identifier(row.logicalId, "invalid_logical_id"), expectedVersion: integer(row.expectedVersion, "invalid_expected_version"), title: text(row.title, "invalid_title", 240), coverLetterBody: text(row.coverLetterBody, "invalid_cover_letter", 24_000), claimLedger, editRationale: text(row.editRationale, "invalid_edit_rationale", 2_000, 8) };
  }
  if (row.operation === "APPROVE_SUBMISSION") {
    if (!exact(row, ["operation", "idempotencyKey", "analysisDocumentVersionId", "analysisContentHash", "coverLetterDocumentVersionId", "coverLetterContentHash", "acceptedUnknowns", "rationale"]) || !Array.isArray(row.acceptedUnknowns)) throw new JournalSubmissionContractError("invalid_submission_approval_shape");
    const acceptedUnknowns = row.acceptedUnknowns.map((item) => enumValue(item, requirementCategories, "invalid_requirement_category")); if (new Set(acceptedUnknowns).size !== acceptedUnknowns.length) throw new JournalSubmissionContractError("duplicate_accepted_unknown");
    return { operation: "APPROVE_SUBMISSION", idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"), analysisDocumentVersionId: identifier(row.analysisDocumentVersionId, "invalid_analysis_document_id"), analysisContentHash: digest(row.analysisContentHash, "invalid_analysis_content_hash"), coverLetterDocumentVersionId: identifier(row.coverLetterDocumentVersionId, "invalid_cover_letter_document_id"), coverLetterContentHash: digest(row.coverLetterContentHash, "invalid_cover_letter_content_hash"), acceptedUnknowns, rationale: text(row.rationale, "invalid_rationale", 2_000, 8) };
  }
  if (row.operation === "FINALIZE_SUBMISSION") {
    if (!exact(row, ["operation", "idempotencyKey", "analysisDocumentVersionId", "analysisContentHash", "coverLetterDocumentVersionId", "coverLetterContentHash", "humanGateId", "targetLogicalId", "expectedVersion", "title"])) throw new JournalSubmissionContractError("invalid_finalize_submission_shape");
    return { operation: "FINALIZE_SUBMISSION", idempotencyKey: identifier(row.idempotencyKey, "invalid_idempotency_key"), analysisDocumentVersionId: identifier(row.analysisDocumentVersionId, "invalid_analysis_document_id"), analysisContentHash: digest(row.analysisContentHash, "invalid_analysis_content_hash"), coverLetterDocumentVersionId: identifier(row.coverLetterDocumentVersionId, "invalid_cover_letter_document_id"), coverLetterContentHash: digest(row.coverLetterContentHash, "invalid_cover_letter_content_hash"), humanGateId: identifier(row.humanGateId, "invalid_human_gate_id"), targetLogicalId: identifier(row.targetLogicalId, "invalid_target_logical_id"), expectedVersion: integer(row.expectedVersion, "invalid_expected_version"), title: text(row.title, "invalid_title", 240) };
  }
  throw new JournalSubmissionContractError("unsupported_journal_submission_operation");
}

export function splitSubmissionParagraphs(value: string) {
  const paragraphs = value.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((textValue, index) => ({ paragraphId: `p-${String(index + 1).padStart(3, "0")}`, text: textValue.trim() })).filter((item) => item.text);
  if (!paragraphs.length || paragraphs.length > 100 || paragraphs.some((item) => Buffer.byteLength(item.text, "utf8") > 8_000)) throw new JournalSubmissionContractError("manuscript_bounds_exceeded", 413);
  return paragraphs;
}

export function parseJournalSubmissionProviderResult(value: unknown, request: ResolvedRunSubmissionCheckRequest): JournalSubmissionProviderResult {
  const row = record(value); const keys = ["contractVersion", "status", "manuscriptHash", "factualFit", "heuristicFit", "coverLetterDraft", "claimLedger", "uncertainties"];
  if (!row || !exact(row, keys) || row.contractVersion !== JOURNAL_SUBMISSION_CONTRACT_VERSION || row.status !== "SUCCESS" || row.manuscriptHash !== request.sourceContentHash) throw new JournalSubmissionContractError("invalid_submission_result_shape", 502);
  if (!Array.isArray(row.factualFit) || row.factualFit.length !== requirementCategories.length) throw new JournalSubmissionContractError("factual_fit_incomplete", 502);
  const factualFit = row.factualFit.map((valueItem) => { const item = record(valueItem); if (!item || !exact(item, ["category", "status", "evidence", "remediation", "risk"])) throw new JournalSubmissionContractError("invalid_factual_fit_shape", 502); return { category: enumValue(item.category, requirementCategories, "invalid_requirement_category"), status: enumValue(item.status, requirementStatuses, "invalid_requirement_status"), evidence: text(item.evidence, "invalid_requirement_evidence", 3_000, 0), remediation: text(item.remediation, "invalid_requirement_remediation", 2_000, 0), risk: text(item.risk, "invalid_requirement_risk", 1_000, 0) }; });
  if (new Set(factualFit.map((item) => item.category)).size !== requirementCategories.length || requirementCategories.some((category) => !factualFit.some((item) => item.category === category))) throw new JournalSubmissionContractError("factual_fit_incomplete", 502);
  if (request.officialSource.humanVerificationState !== "VERIFIED" && factualFit.some((item) => item.status === "PASS" || item.status === "FAIL")) throw new JournalSubmissionContractError("unverified_source_cannot_produce_factual_decision", 502);
  if (!Array.isArray(row.heuristicFit) || row.heuristicFit.length !== heuristicDimensions.length) throw new JournalSubmissionContractError("heuristic_fit_incomplete", 502);
  const heuristicFit = row.heuristicFit.map((valueItem) => { const item = record(valueItem); if (!item || !exact(item, ["dimension", "fit", "rationale", "uncertainty"])) throw new JournalSubmissionContractError("invalid_heuristic_fit_shape", 502); return { dimension: enumValue(item.dimension, heuristicDimensions, "invalid_heuristic_dimension"), fit: enumValue(item.fit, heuristicFitStates, "invalid_heuristic_fit"), rationale: text(item.rationale, "invalid_heuristic_rationale", 1_500), uncertainty: text(item.uncertainty, "invalid_heuristic_uncertainty", 1_000) }; });
  if (new Set(heuristicFit.map((item) => item.dimension)).size !== heuristicDimensions.length) throw new JournalSubmissionContractError("heuristic_fit_incomplete", 502);
  const paragraphs = new Map(splitSubmissionParagraphs(request.manuscriptText).map((item) => [item.paragraphId, journalSubmissionHash(item.text)]));
  const facts = new Map(request.projectFacts.map((item) => [item.factId, item]));
  if (!Array.isArray(row.claimLedger) || row.claimLedger.length > 80) throw new JournalSubmissionContractError("invalid_claim_ledger", 502);
  const claimLedger = row.claimLedger.map(parseClaim);
  for (const claim of claimLedger) {
    if (claim.supportKind === "MANUSCRIPT_PARAGRAPH" && paragraphs.get(claim.supportId) !== claim.supportHash) throw new JournalSubmissionContractError("claim_support_binding_mismatch", 502);
    if (claim.supportKind === "PROJECT_FACT" && (facts.get(claim.supportId)?.contentHash !== claim.supportHash || facts.get(claim.supportId)?.verificationState !== "VERIFIED_PROJECT_FACT")) throw new JournalSubmissionContractError("claim_support_binding_mismatch", 502);
  }
  if (new Set(claimLedger.map((item) => item.claimId)).size !== claimLedger.length) throw new JournalSubmissionContractError("duplicate_claim", 502);
  if (!Array.isArray(row.uncertainties) || row.uncertainties.length > 40) throw new JournalSubmissionContractError("invalid_submission_uncertainties", 502);
  return { contractVersion: JOURNAL_SUBMISSION_CONTRACT_VERSION, status: "SUCCESS", manuscriptHash: request.sourceContentHash, factualFit, heuristicFit, coverLetterDraft: text(row.coverLetterDraft, "invalid_cover_letter", 24_000), claimLedger, uncertainties: row.uncertainties.map((item) => text(item, "invalid_submission_uncertainty", 1_000)) };
}

export function assertSubmissionFinalizable(input: { source: OfficialRequirementSource; factualFit: JournalSubmissionProviderResult["factualFit"]; acceptedUnknowns: RequirementCategory[] }) {
  if (input.source.humanVerificationState !== "VERIFIED") throw new JournalSubmissionContractError("official_source_human_verification_required", 422);
  const accepted = new Set(input.acceptedUnknowns);
  const blocking = input.factualFit.filter((item) => item.status === "FAIL" || (item.status === "UNKNOWN" && !accepted.has(item.category)));
  if (blocking.length) throw new JournalSubmissionContractError("submission_requirements_unresolved", 422);
  return true;
}
