import "server-only";

import { createHash } from "node:crypto";

export const SCHOLARLY_FIXTURE_CONTRACT_VERSION = "topic-lab-scholarly-fixtures/1.0.0" as const;
export const scholarlyProviders = ["OPENALEX", "CROSSREF", "SEMANTIC_SCHOLAR"] as const;
export type ScholarlyProvider = (typeof scholarlyProviders)[number];
export type TrendLane = "CURRENT_HOT" | "EMERGING";

export type ScholarlyObservation = {
  provider: ScholarlyProvider;
  sourceKey: string;
  doi: string | null;
  title: string;
  publishedAt: string;
  citedByCount: number | null;
  observationWindow: { from: string; to: string };
  sampleSize: number;
  retrievedAt: string;
  confidence: "LOW" | "MEDIUM";
  evidenceLabel: "FIXTURE_ONLY_UNVERIFIED";
  contentHash: string;
};

export type ScholarlyFixtureEnvelope = {
  contractVersion: typeof SCHOLARLY_FIXTURE_CONTRACT_VERSION;
  provider: ScholarlyProvider;
  mode: "FIXTURE_ONLY";
  observationWindow: { from: string; to: string };
  sampleSize: number;
  retrievedAt: string;
  confidence: "LOW" | "MEDIUM";
  records: unknown[];
};

export class ScholarlyFixtureContractError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "ScholarlyFixtureContractError";
    this.code = code;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value: unknown) {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function text(value: unknown, code: string, max = 500) {
  if (typeof value !== "string") throw new ScholarlyFixtureContractError(code);
  const clean = value.normalize("NFKC").trim();
  if (!clean || clean.length > max || /[\u0000-\u001f\u007f]/.test(clean)) throw new ScholarlyFixtureContractError(code);
  return clean;
}

function date(value: unknown, code: string) {
  const clean = text(value, code, 10);
  const parsed = new Date(`${clean}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== clean) throw new ScholarlyFixtureContractError(code);
  return clean;
}

function timestamp(value: unknown, code: string) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) throw new ScholarlyFixtureContractError(code);
  return value;
}

function count(value: unknown, code: string, nullable = false) {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 10_000_000) throw new ScholarlyFixtureContractError(code);
  return Number(value);
}

function doi(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new ScholarlyFixtureContractError("invalid_doi");
  const normalized = value.trim().toLocaleLowerCase("en-US").replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");
  if (!/^10\.\d{4,9}\/[A-Za-z0-9._;()/:+-]+$/i.test(normalized) || normalized.length > 255) throw new ScholarlyFixtureContractError("invalid_doi");
  return normalized;
}

function crossrefPublished(value: unknown) {
  if (!record(value) || !Array.isArray(value["date-parts"]) || !Array.isArray(value["date-parts"][0])) throw new ScholarlyFixtureContractError("invalid_crossref_date");
  const [year, month = 1, day = 1] = value["date-parts"][0] as unknown[];
  if (![year, month, day].every(Number.isSafeInteger)) throw new ScholarlyFixtureContractError("invalid_crossref_date");
  return date(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, "invalid_crossref_date");
}

function observationWindow(value: unknown) {
  if (!record(value)) throw new ScholarlyFixtureContractError("invalid_observation_window");
  const from = date(value.from, "invalid_observation_from");
  const to = date(value.to, "invalid_observation_to");
  if (from > to) throw new ScholarlyFixtureContractError("invalid_observation_window");
  return { from, to };
}

function parseProviderRecord(provider: ScholarlyProvider, value: unknown) {
  if (!record(value)) throw new ScholarlyFixtureContractError("invalid_provider_record");
  if (provider === "OPENALEX") {
    const sourceKey = text(value.id, "invalid_openalex_id", 200);
    return { sourceKey, doi: doi(value.doi), title: text(value.display_name, "invalid_openalex_title"), publishedAt: date(value.publication_date, "invalid_openalex_date"), citedByCount: count(value.cited_by_count, "invalid_openalex_citations", true) };
  }
  if (provider === "CROSSREF") {
    const sourceDoi = doi(value.DOI);
    if (!sourceDoi || !Array.isArray(value.title) || value.title.length < 1) throw new ScholarlyFixtureContractError("invalid_crossref_record");
    return { sourceKey: sourceDoi, doi: sourceDoi, title: text(value.title[0], "invalid_crossref_title"), publishedAt: crossrefPublished(value.published), citedByCount: count(value["is-referenced-by-count"], "invalid_crossref_citations", true) };
  }
  const sourceKey = text(value.paperId, "invalid_semantic_scholar_id", 200);
  if (!record(value.externalIds)) throw new ScholarlyFixtureContractError("invalid_semantic_scholar_external_ids");
  return { sourceKey, doi: doi(value.externalIds.DOI), title: text(value.title, "invalid_semantic_scholar_title"), publishedAt: date(value.publicationDate, "invalid_semantic_scholar_date"), citedByCount: count(value.citationCount, "invalid_semantic_scholar_citations", true) };
}

export function normalizeScholarlyFixture(value: unknown): ScholarlyObservation[] {
  if (!record(value) || value.contractVersion !== SCHOLARLY_FIXTURE_CONTRACT_VERSION || !scholarlyProviders.includes(value.provider as ScholarlyProvider) || value.mode !== "FIXTURE_ONLY" || !Array.isArray(value.records) || value.records.length > 100) throw new ScholarlyFixtureContractError("invalid_scholarly_fixture_envelope");
  const provider = value.provider as ScholarlyProvider;
  const window = observationWindow(value.observationWindow);
  const sampleSize = count(value.sampleSize, "invalid_sample_size") as number;
  if (sampleSize !== value.records.length) throw new ScholarlyFixtureContractError("sample_size_mismatch");
  const retrievedAt = timestamp(value.retrievedAt, "invalid_retrieved_at");
  if (value.confidence !== "LOW" && value.confidence !== "MEDIUM") throw new ScholarlyFixtureContractError("invalid_confidence");
  return value.records.map((item) => {
    const parsed = parseProviderRecord(provider, item);
    if (parsed.publishedAt < window.from || parsed.publishedAt > window.to) throw new ScholarlyFixtureContractError("record_outside_observation_window");
    const body = { provider, ...parsed, observationWindow: window, sampleSize, retrievedAt, confidence: value.confidence as "LOW" | "MEDIUM", evidenceLabel: "FIXTURE_ONLY_UNVERIFIED" as const };
    return { ...body, contentHash: digest(body) };
  });
}

export function dedupeScholarlyObservations(observations: ScholarlyObservation[]) {
  const seen = new Set<string>();
  const kept: ScholarlyObservation[] = [];
  const duplicates: Array<{ contentHash: string; reason: "DUPLICATE_DOI" | "DUPLICATE_SOURCE" }> = [];
  for (const observation of observations) {
    const key = observation.doi ? `doi:${observation.doi}` : `source:${observation.provider}:${observation.sourceKey}`;
    if (seen.has(key)) duplicates.push({ contentHash: observation.contentHash, reason: observation.doi ? "DUPLICATE_DOI" : "DUPLICATE_SOURCE" });
    else { seen.add(key); kept.push(observation); }
  }
  return { kept, duplicates };
}

export function buildDistinctTrendLanes(observations: ScholarlyObservation[]) {
  const { kept, duplicates } = dedupeScholarlyObservations(observations);
  const currentHot = kept.filter((item) => item.citedByCount !== null && item.citedByCount >= 20);
  const emerging = kept.filter((item) => !currentHot.includes(item) && item.publishedAt >= item.observationWindow.to.slice(0, 4) + "-01-01");
  return {
    CURRENT_HOT: { lane: "CURRENT_HOT" as const, observationHashes: currentHot.map((item) => item.contentHash), sampleSize: kept.length, confidence: "LOW" as const, evidenceLabel: "FIXTURE_ONLY_UNVERIFIED" as const },
    EMERGING: { lane: "EMERGING" as const, observationHashes: emerging.map((item) => item.contentHash), sampleSize: kept.length, confidence: "LOW" as const, evidenceLabel: "FIXTURE_ONLY_UNVERIFIED" as const },
    duplicates,
  };
}
