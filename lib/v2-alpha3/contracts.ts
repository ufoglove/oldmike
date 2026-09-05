import { createHash } from "node:crypto";

export const V2_ALPHA3_CONTRACT_VERSION = "old-mike-v2-alpha3/1.0.0" as const;
export const V2_ALPHA3_BUILTIN_DOMAINS = Object.freeze([
  { id: "ai-cross-disciplinary", label: "AI跨領域應用", aliases: ["人工智慧跨領域應用"] },
  { id: "ai-education", label: "AI應用於教育", aliases: ["人工智慧於教育之應用"] },
  { id: "ai-occupational-safety-training", label: "AI應用於職業安全與教育訓練", aliases: ["人工智慧於職業安全與教育訓練之應用"] },
  { id: "ai-environment-resource-management", label: "AI應用於環境工程與環境資源管理", aliases: ["人工智慧於環境工程與資源管理之應用"] },
  { id: "ai-energy-management", label: "AI應用於能源管理", aliases: ["人工智慧於能源管理之應用"] },
  { id: "xr-cross-disciplinary", label: "VR/AR/XR跨領域應用", aliases: ["VR/AR/XR於教育之應用", "VR/AR/XR於職業安全與教育訓練之應用"] },
] as const);

export type V2Alpha3BuiltinDomainId = (typeof V2_ALPHA3_BUILTIN_DOMAINS)[number]["id"];
export type V2Alpha3LegacyFacet = "EDUCATION" | "OCCUPATIONAL_SAFETY_TRAINING" | null;
export type V2Alpha3InsightKind = "question" | "gap" | "mechanism" | "method" | "direction";
export type V2Alpha3EvidenceSource = "OPENALEX" | "SEMANTIC_SCHOLAR" | "DOI_IMPORT" | "BIBTEX_IMPORT" | "RIS_IMPORT";
export type V2Alpha3ForecastHorizon = "YEARS_1_3" | "YEARS_4_6" | "YEARS_7_10";
type UnknownRecord = Record<string, unknown>;

export type V2Alpha3DomainSelection =
  | { kind: "BUILTIN"; domainId: V2Alpha3BuiltinDomainId; label: string; profileId: null; profileVersion: null; profileContentHash: null; selectionHash: string }
  | { kind: "CUSTOM"; domainId: null; label: string; profileId: string; profileVersion: number; profileContentHash: string; selectionHash: string };

export type V2Alpha3InsightCard = {
  kind: V2Alpha3InsightKind;
  title: string;
  researchQuestion: string;
  mechanism: string;
  value: string;
  domainFit: string;
  evidenceBoundary: "UNVERIFIED" | "OBSERVED_PARTIAL" | "ASSUMPTION";
  assumptions: string[];
  nextAction: string;
  hash: string;
};

export type V2Alpha3NormalizedWork = {
  source: V2Alpha3EvidenceSource;
  sourceDate: string;
  doi: string | null;
  stableSourceId: string | null;
  title: string;
  year: number;
  firstAuthor: string;
  citationCount: number | null;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidenceClass: "OBSERVED";
};

export type V2Alpha3LiteratureSynthesis = {
  observed: { coverage: "COMPLETE" | "PARTIAL" | "UNAVAILABLE"; works: V2Alpha3NormalizedWork[]; limitations: string[] };
  forecasts: Array<{ horizon: V2Alpha3ForecastHorizon; confidence: "LOW" | "MEDIUM" | "HIGH"; assumptions: string[]; invalidationConditions: string[]; statement: string }>;
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

function lowerHex(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(code);
  return value;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as UnknownRecord).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as UnknownRecord)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Canonical(value: unknown) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function mapLegacyDomainAlias(rawLabel: string) {
  const label = text(rawLabel, 160, "legacy_domain_label_invalid");
  for (const domain of V2_ALPHA3_BUILTIN_DOMAINS) {
    if (domain.label === label || domain.aliases.some((alias) => alias === label)) {
      const legacyFacet: V2Alpha3LegacyFacet = label === "VR/AR/XR於教育之應用"
        ? "EDUCATION"
        : label === "VR/AR/XR於職業安全與教育訓練之應用"
          ? "OCCUPATIONAL_SAFETY_TRAINING"
          : null;
      return { domainId: domain.id, rawLabel: label, legacyFacet };
    }
  }
  return null;
}

export function createBuiltinDomainSelection(domainId: string): V2Alpha3DomainSelection {
  const domain = V2_ALPHA3_BUILTIN_DOMAINS.find((item) => item.id === domainId);
  if (!domain) throw new Error("domain_selection_invalid");
  const binding = { kind: "BUILTIN" as const, domainId: domain.id, label: domain.label, profileId: null, profileVersion: null, profileContentHash: null };
  return { ...binding, selectionHash: sha256Canonical(binding) };
}

export function createCustomDomainSelection(input: { profileId: string; version: number; name: string; contentHash: string }): V2Alpha3DomainSelection {
  const binding = {
    kind: "CUSTOM" as const,
    domainId: null,
    label: text(input.name, 120, "custom_domain_name_invalid"),
    profileId: text(input.profileId, 120, "custom_domain_profile_id_invalid"),
    profileVersion: input.version,
    profileContentHash: lowerHex(input.contentHash, "custom_domain_content_hash_invalid"),
  };
  if (!Number.isInteger(binding.profileVersion) || binding.profileVersion < 1) throw new Error("custom_domain_version_invalid");
  return { ...binding, selectionHash: sha256Canonical(binding) };
}

export function parseDomainSelection(value: unknown): V2Alpha3DomainSelection {
  const input = record(value, "domain_selection_invalid");
  const parsed = input.kind === "BUILTIN"
    ? createBuiltinDomainSelection(text(input.domainId, 120, "domain_selection_invalid"))
    : input.kind === "CUSTOM"
      ? createCustomDomainSelection({ profileId: text(input.profileId, 120, "custom_domain_profile_id_invalid"), version: input.profileVersion as number, name: text(input.label, 120, "custom_domain_name_invalid"), contentHash: lowerHex(input.profileContentHash, "custom_domain_content_hash_invalid") })
      : null;
  if (!parsed || parsed.selectionHash !== input.selectionHash) throw new Error("domain_selection_hash_invalid");
  return parsed;
}

export function normalizeProfileName(value: string) {
  return text(value, 120, "custom_domain_name_invalid").normalize("NFKC").toLocaleLowerCase("zh-TW").replace(/\s+/gu, " ");
}

export function validateCustomProfileContent(value: unknown) {
  const input = record(value, "custom_domain_profile_invalid");
  const name = text(input.name, 120, "custom_domain_name_invalid");
  const list = (raw: unknown, code: string) => {
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || raw.length > 12) throw new Error(code);
    return raw.map((item) => text(item, 80, code));
  };
  const includedKeywords = list(input.includedKeywords, "custom_domain_included_invalid");
  const excludedKeywords = list(input.excludedKeywords, "custom_domain_excluded_invalid");
  if (new Set([...includedKeywords, ...excludedKeywords].map((item) => item.normalize("NFKC").toLocaleLowerCase("zh-TW"))).size !== includedKeywords.length + excludedKeywords.length) throw new Error("custom_domain_keyword_duplicate");
  const content = { name, normalizedName: normalizeProfileName(name), includedKeywords, excludedKeywords };
  return { ...content, contentHash: sha256Canonical(content) };
}

function insightWithoutHash(value: unknown): Omit<V2Alpha3InsightCard, "hash"> {
  const input = record(value, "insight_card_invalid");
  const kinds: readonly V2Alpha3InsightKind[] = ["question", "gap", "mechanism", "method", "direction"];
  if (!kinds.includes(input.kind as V2Alpha3InsightKind)) throw new Error("insight_kind_invalid");
  if (input.evidenceBoundary !== "UNVERIFIED" && input.evidenceBoundary !== "OBSERVED_PARTIAL" && input.evidenceBoundary !== "ASSUMPTION") throw new Error("insight_evidence_boundary_invalid");
  if (!Array.isArray(input.assumptions) || input.assumptions.length > 4) throw new Error("insight_assumptions_invalid");
  return {
    kind: input.kind as V2Alpha3InsightKind,
    title: text(input.title, 240, "insight_title_invalid"),
    researchQuestion: text(input.researchQuestion, 600, "insight_question_invalid"),
    mechanism: text(input.mechanism, 800, "insight_mechanism_invalid"),
    value: text(input.value, 800, "insight_value_invalid"),
    domainFit: text(input.domainFit, 500, "insight_domain_fit_invalid"),
    evidenceBoundary: input.evidenceBoundary as V2Alpha3InsightCard["evidenceBoundary"],
    assumptions: input.assumptions.map((item) => text(item, 240, "insight_assumption_invalid")),
    nextAction: text(input.nextAction, 400, "insight_next_action_invalid"),
  };
}

export function parseInsightCard(value: unknown): V2Alpha3InsightCard {
  const input = record(value, "insight_card_invalid");
  const card = insightWithoutHash(input);
  const hash = lowerHex(input.hash, "insight_hash_invalid");
  if (sha256Canonical(card) !== hash) throw new Error("insight_hash_mismatch");
  return { ...card, hash };
}

export function createInsightCard(value: Omit<V2Alpha3InsightCard, "hash">): V2Alpha3InsightCard {
  const card = insightWithoutHash(value);
  return { ...card, hash: sha256Canonical(card) };
}

export function parseChatTurnResult(value: unknown) {
  const input = record(value, "chat_result_invalid");
  if (input.schemaId !== "old-mike-v2-alpha3/chat-insights/1") throw new Error("chat_schema_invalid");
  const domainSelection = parseDomainSelection(input.domainSelection);
  if (!Array.isArray(input.insights) || input.insights.length < 1 || input.insights.length > 3) throw new Error("insight_count_invalid");
  const insights: V2Alpha3InsightCard[] = [];
  const issues: Array<{ index: number; code: "INSIGHT_INVALID" | "INSIGHT_DUPLICATE" }> = [];
  input.insights.forEach((raw, index) => {
    try {
      const parsed = parseInsightCard(raw);
      if (insights.some((card) => card.hash === parsed.hash)) issues.push({ index, code: "INSIGHT_DUPLICATE" });
      else insights.push(parsed);
    } catch { issues.push({ index, code: "INSIGHT_INVALID" }); }
  });
  if (insights.length === 0) throw new Error("insight_zero_valid");
  return { schemaId: "old-mike-v2-alpha3/chat-insights/1" as const, domainSelection, insights, issues, completionClass: input.completionClass === "COMPLETE" ? "COMPLETE" as const : (() => { throw new Error("chat_completion_invalid"); })() };
}

export function normalizeDoi(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const doi = text(value, 240, "evidence_doi_invalid").replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "").toLocaleLowerCase("en-US");
  if (!/^10\.\d{4,9}\/[\S]+$/u.test(doi)) throw new Error("evidence_doi_invalid");
  return doi;
}

export function parseNormalizedWork(value: unknown): V2Alpha3NormalizedWork {
  const input = record(value, "evidence_work_invalid");
  const sources: readonly V2Alpha3EvidenceSource[] = ["OPENALEX", "SEMANTIC_SCHOLAR", "DOI_IMPORT", "BIBTEX_IMPORT", "RIS_IMPORT"];
  if (!sources.includes(input.source as V2Alpha3EvidenceSource)) throw new Error("evidence_source_invalid");
  const doi = normalizeDoi(input.doi);
  const stableSourceId = input.stableSourceId === null || input.stableSourceId === undefined ? null : text(input.stableSourceId, 180, "evidence_source_id_invalid");
  if (!doi && !stableSourceId) throw new Error("evidence_identifier_missing");
  if (stableSourceId && /^(?:https?:\/\/|www\.)/iu.test(stableSourceId)) throw new Error("evidence_raw_url_forbidden");
  if (input.evidenceClass !== "OBSERVED") throw new Error("evidence_class_invalid");
  if (input.confidence !== "LOW" && input.confidence !== "MEDIUM" && input.confidence !== "HIGH") throw new Error("evidence_confidence_invalid");
  if (!Number.isInteger(input.year) || (input.year as number) < 1800 || (input.year as number) > 2200) throw new Error("evidence_year_invalid");
  if (input.citationCount !== null && (!Number.isInteger(input.citationCount) || (input.citationCount as number) < 0)) throw new Error("evidence_citation_count_invalid");
  return {
    source: input.source as V2Alpha3EvidenceSource,
    sourceDate: text(input.sourceDate, 32, "evidence_source_date_invalid"),
    doi,
    stableSourceId,
    title: text(input.title, 500, "evidence_title_invalid"),
    year: input.year as number,
    firstAuthor: text(input.firstAuthor, 160, "evidence_author_invalid"),
    citationCount: input.citationCount as number | null,
    confidence: input.confidence,
    evidenceClass: "OBSERVED",
  };
}

function titleKey(work: V2Alpha3NormalizedWork) {
  return `${work.title.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim()}|${work.year}|${work.firstAuthor.normalize("NFKC").toLocaleLowerCase("en-US")}`;
}

export function dedupeNormalizedWorks(values: unknown[]) {
  const accepted: V2Alpha3NormalizedWork[] = [];
  const exactDuplicates: Array<{ duplicateIndex: number; keptIndex: number; authority: "DOI" | "STABLE_SOURCE_ID" }> = [];
  const possibleDuplicates: Array<{ leftIndex: number; rightIndex: number; authority: "TITLE_YEAR_FIRST_AUTHOR_REVIEW" }> = [];
  const doi = new Map<string, number>();
  const stable = new Map<string, number>();
  const titles = new Map<string, number>();
  values.map(parseNormalizedWork).forEach((work, inputIndex) => {
    const doiMatch = work.doi === null ? undefined : doi.get(work.doi);
    if (doiMatch !== undefined) { exactDuplicates.push({ duplicateIndex: inputIndex, keptIndex: doiMatch, authority: "DOI" }); return; }
    const stableKey = work.stableSourceId ? `${work.source}:${work.stableSourceId}` : null;
    const stableMatch = stableKey ? stable.get(stableKey) : undefined;
    if (stableMatch !== undefined) { exactDuplicates.push({ duplicateIndex: inputIndex, keptIndex: stableMatch, authority: "STABLE_SOURCE_ID" }); return; }
    const acceptedIndex = accepted.length;
    const potential = titles.get(titleKey(work));
    if (potential !== undefined) possibleDuplicates.push({ leftIndex: potential, rightIndex: acceptedIndex, authority: "TITLE_YEAR_FIRST_AUTHOR_REVIEW" });
    accepted.push(work);
    if (work.doi) doi.set(work.doi, acceptedIndex);
    if (stableKey) stable.set(stableKey, acceptedIndex);
    titles.set(titleKey(work), acceptedIndex);
  });
  return { accepted, exactDuplicates, possibleDuplicates };
}

export function parseLiteratureConnectorBatch(value: unknown, expectedSource: "OPENALEX" | "SEMANTIC_SCHOLAR") {
  const input = record(value, "connector_batch_invalid");
  const expectedSchema = expectedSource === "OPENALEX" ? "old-mike-v2-alpha3/openalex-result/1" : "old-mike-v2-alpha3/semantic-scholar-result/1";
  if (input.schemaId !== expectedSchema) throw new Error("connector_schema_invalid");
  if (input.coverage !== "COMPLETE" && input.coverage !== "PARTIAL" && input.coverage !== "UNAVAILABLE") throw new Error("connector_coverage_invalid");
  if (!Array.isArray(input.works) || input.works.length > 100 || !Array.isArray(input.limitations)) throw new Error("connector_batch_invalid");
  const works: V2Alpha3NormalizedWork[] = [];
  const issues: Array<{ index: number; code: "WORK_INVALID" }> = [];
  input.works.forEach((raw, index) => {
    try {
      const parsed = parseNormalizedWork(raw);
      if (parsed.source !== expectedSource) throw new Error("connector_source_invalid");
      works.push(parsed);
    } catch { issues.push({ index, code: "WORK_INVALID" }); }
  });
  const limitations = input.limitations.map((item) => text(item, 400, "connector_limitation_invalid"));
  if ((input.coverage !== "COMPLETE" || issues.length > 0) && limitations.length === 0) throw new Error("connector_limitation_required");
  if (input.coverage === "COMPLETE" && works.length === 0) throw new Error("connector_complete_empty");
  return { schemaId: expectedSchema, source: expectedSource, coverage: input.coverage as "COMPLETE" | "PARTIAL" | "UNAVAILABLE", works, issues, limitations, rawBodyRetained: false as const };
}

export function parseLiteratureSynthesis(value: unknown): V2Alpha3LiteratureSynthesis {
  const input = record(value, "literature_synthesis_invalid");
  const observed = record(input.observed, "literature_observed_invalid");
  if (observed.coverage !== "COMPLETE" && observed.coverage !== "PARTIAL" && observed.coverage !== "UNAVAILABLE") throw new Error("literature_coverage_invalid");
  if (!Array.isArray(observed.works) || !Array.isArray(observed.limitations)) throw new Error("literature_observed_invalid");
  const works = observed.works.map(parseNormalizedWork);
  const limitations = observed.limitations.map((item) => text(item, 400, "literature_limitation_invalid"));
  if (observed.coverage !== "COMPLETE" && limitations.length === 0) throw new Error("literature_partial_boundary_missing");
  if (!Array.isArray(input.forecasts) || input.forecasts.length !== 3) throw new Error("forecast_count_invalid");
  const horizons: readonly V2Alpha3ForecastHorizon[] = ["YEARS_1_3", "YEARS_4_6", "YEARS_7_10"];
  const forecasts = input.forecasts.map((raw, index) => {
    const item = record(raw, "forecast_invalid");
    if (item.horizon !== horizons[index]) throw new Error("forecast_horizon_invalid");
    if (item.confidence !== "LOW" && item.confidence !== "MEDIUM" && item.confidence !== "HIGH") throw new Error("forecast_confidence_invalid");
    if (!Array.isArray(item.assumptions) || item.assumptions.length === 0 || !Array.isArray(item.invalidationConditions) || item.invalidationConditions.length === 0) throw new Error("forecast_boundary_invalid");
    return { horizon: item.horizon as V2Alpha3ForecastHorizon, confidence: item.confidence as "LOW" | "MEDIUM" | "HIGH", assumptions: item.assumptions.map((part) => text(part, 300, "forecast_assumption_invalid")), invalidationConditions: item.invalidationConditions.map((part) => text(part, 300, "forecast_invalidation_invalid")), statement: text(item.statement, 700, "forecast_statement_invalid") };
  });
  return { observed: { coverage: observed.coverage, works, limitations }, forecasts };
}

export function validateAlpha2PromotionRequest(value: unknown) {
  const input = record(value, "promotion_invalid");
  const domainSelection = parseDomainSelection(input.domainSelection);
  const insight = parseInsightCard(input.insightCard);
  if (input.domainSelectionHash !== domainSelection.selectionHash) throw new Error("promotion_domain_hash_invalid");
  if (input.insightCardHash !== insight.hash) throw new Error("promotion_card_hash_invalid");
  return { contractVersion: "old-mike-v2-alpha3/alpha2-promotion/1" as const, domainSelection, domainSelectionHash: domainSelection.selectionHash, insightCard: insight, insightCardHash: insight.hash, requestId: text(input.requestId, 160, "promotion_request_id_invalid") };
}

export function verifyAlpha2PromotionResult(input: { domainSelectionHash: string; insightCardHash: string; selectedDirectionHash: string; stageADomainSelectionHash: string; stageB: { sourceDirectionHash: string; domainSelectionHash: string }; fieldAssistDomainSelectionHash?: string }) {
  const domainHash = lowerHex(input.domainSelectionHash, "promotion_domain_hash_invalid");
  lowerHex(input.insightCardHash, "promotion_card_hash_invalid");
  const selectedHash = lowerHex(input.selectedDirectionHash, "promotion_direction_hash_invalid");
  if (input.stageADomainSelectionHash !== domainHash || input.stageB.domainSelectionHash !== domainHash) throw new Error("promotion_domain_binding_mismatch");
  if (input.stageB.sourceDirectionHash !== selectedHash) throw new Error("promotion_s0_direction_binding_mismatch");
  if (input.fieldAssistDomainSelectionHash !== undefined && input.fieldAssistDomainSelectionHash !== domainHash) throw new Error("field_assist_domain_binding_mismatch");
  return true;
}

export const V2_ALPHA3_CONNECTOR_CAPABILITIES = Object.freeze({
  OPENALEX: { state: "LOCAL_CONTRACT_ONLY", readonly: true },
  SEMANTIC_SCHOLAR: { state: "LOCAL_CONTRACT_ONLY", readonly: true },
  CONSENSUS: { state: "DISABLED_AUTH_AND_COST_UNPROVEN", readonly: true },
  GOOGLE_SCHOLAR: { state: "MANUAL_LINK_AND_IMPORT_ONLY", scraping: false },
});

export const V2_ALPHA3_NEON_CACHE_CONTRACT = Object.freeze({
  authority: "DEIDENTIFIED_PUBLIC_METADATA_CACHE_ONLY",
  tables: ["normalized_work_versions", "search_snapshots", "search_snapshot_items", "connector_receipts"],
  forbidden: ["tenantId", "userId", "projectId", "rawQuery", "chat", "prompt", "manuscript", "dataset", "abstract", "fulltext", "rawUrl", "rawHttpBody", "providerBody", "token"],
  onDemand: { freshHours: 24, staleDays: 7, purgeDays: 30 },
  weeklyRadar: { freshDays: 7, staleDays: 30, purgeDays: 90 },
  synchronousResearchStartDependency: false,
});

export const V2_ALPHA3_N8N_TEMPLATE_CONTRACTS = Object.freeze([
  { templateId: "weekly-domain-refresh", state: "INACTIVE_EXPORT_ONLY", input: "opaqueBucketHash", concurrency: 1, sourcePolling: false },
  { templateId: "daily-retention", state: "INACTIVE_EXPORT_ONLY", input: "retentionClass", concurrency: 1, sourcePolling: false },
]);
