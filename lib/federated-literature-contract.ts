import { randomUUID } from "node:crypto";

/**
 * Federated Literature Search & Scholarly Source Capability Contracts
 * Spec: v3.2.0 (V3-U03-R1) Section A8, A9, A10, A14
 * 
 * Defines:
 * 1. Provider capability matrix (search, metadata, references, citations, abstract, fulltext/chunks,
 *    publication_filter, study_type_filter, exact_venue_filter, ranking_venue_preference, aggregation, usage_reporting, write_scope)
 * 2. Capability verification status: documented | configured | contract_tested | live_verified | unsupported | scope_denied | unknown
 * 3. Canonical Literature Record deduplication contracts (DOI, Title+Authors+Year, WorkFamily, StudyFamily)
 * 4. ProviderRecord provenance tracking (upstream DB, publisher, retrieved_at, response_hash, rights)
 * 5. Billing account pool & Quota Ledger schema
 */

/**
 * OFFICIAL SOURCE NOTES (verified 2026-09-06, do not treat as immutable):
 * - Consensus homepage: each quick search API query returns top 20 results, with relevance score,
 *   paper metadata (citation count, publish date), advanced filters (study designs etc.).
 * - Consensus Help Center (help.consensus.app/en/articles/16516328): API usage and Consensus MCP
 *   usage SHARE the same monthly pool of calls; 429 body includes reset date; paid users may enable
 *   additional usage from the API & MCP Dashboard (never auto-enable over-quota spend here).
 * - Endpoint divergence: some official pages show /v1/search, the current reference shows
 *   GET /v1/quick_search. docs.consensus.app returned 403 to this agent on 2026-09-06.
 *   Real adjudication requires a LIVE account test -> capability status stays "unknown"/"documented"
 *   until a live contract test is authorized and run. Never hardcode a guessed endpoint as verified.
 * - SJR-typed fields must be recorded as metricSystem=SJR; never map to JCR Q1/SCIE/SSCI.
 */

export const FEDERATED_LITERATURE_CONTRACT_VERSION = "federated-literature/1.0.0" as const;

export const SCHOLARLY_PROVIDERS = [
  "CONSENSUS",
  "AI4SCHOLAR",
  "SEMANTIC_SCHOLAR",
  "CROSSREF",
  "OPENALEX",
  "PUBMED",
  "ARXIV",
  "ZOTERO",
] as const;
export type ScholarlyProviderId = (typeof SCHOLARLY_PROVIDERS)[number];

export const CAPABILITY_KEYS = [
  "search",
  "metadata",
  "references",
  "citations",
  "abstract",
  "fulltext_or_chunks",
  "publication_filter",
  "study_type_filter",
  "exact_venue_filter",
  "ranking_venue_preference",
  "aggregation",
  "usage_reporting",
  "write_scope",
] as const;
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export const CAPABILITY_STATUSES = [
  "documented",
  "configured",
  "contract_tested",
  "live_verified",
  "unsupported",
  "scope_denied",
  "unknown",
] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

export type ProviderCapabilityDetail = {
  status: CapabilityStatus;
  notes?: string;
  verifiedAt?: string;
  endpoint?: string;
};

export type ProviderCapabilitySnapshot = {
  provider: ScholarlyProviderId;
  snapshotVersion: string;
  checkedAt: string;
  capabilities: Record<CapabilityKey, ProviderCapabilityDetail>;
  billingPoolId?: string;
  rateLimitPerMinute?: number;
};

export type QuerySpec = {
  naturalLanguageQuery: string;
  keywords?: string[];
  evidenceWindow?: { fromYear: number; toYear: number };
  studyTypes?: Array<"meta-analysis" | "systematic-review" | "rct" | "quasi-experimental" | "observational" | "case-study">;
  venuePreference?: string[];
  exactVenueFilter?: string[];
  limit?: number;
};

export type ProviderRecord = {
  retrievalProvider: ScholarlyProviderId;
  providerEndpointVersion: string;
  upstreamDatabase?: string;
  upstreamId?: string;
  publisherSource?: string;
  retrievedAt: string;
  publicationDate: string | null;
  publicationDatePrecision: "YEAR" | "MONTH" | "DAY" | "UNKNOWN";
  indexUpdatedAt?: string | null;
  responseHash: string;
  rights: "OPEN_ACCESS" | "PAYWALLED" | "RESTRICTED" | "UNKNOWN";
  returnedFields: string[];
  sourceRequestId?: string;
  metricSystem?: "SJR" | "JIF" | "CITESCORE" | "NONE";
  reportedCitationCount?: number | null;
  landingPageUrl?: string;
  excerptSnippet?: string;
  studyTypeLabel?: string;
};

export type CanonicalLiteratureRecord = {
  canonicalId: string;
  workspaceId: string;
  doi: string | null;
  pmid: string | null;
  arxivId: string | null;
  title: string;
  normalizedTitle: string;
  authors: Array<{ name: string; sequence?: "first" | "additional" }>;
  year: number | null;
  journalOrVenue: string | null;
  abstract: string | null;
  workFamilyId?: string;
  studyFamilyId?: string;
  providerRecords: ProviderRecord[];
  dedupeStrategy: "DOI_EXACT" | "PMID_EXACT" | "ARXIV_EXACT" | "TITLE_AUTHORS_YEAR_FUZZY";
  firstRetrievedAt: string;
  lastRetrievedAt: string;
};

export type QuotaLedgerEntry = {
  billingPoolId: string;
  provider: ScholarlyProviderId;
  recordedAt: string;
  requestCount: number;
  consumedUnits?: number;
  costEstimateCents?: number;
  status: "OK" | "WARNING_NEAR_LIMIT" | "EXHAUSTED" | "RATE_LIMITED";
  circuitBreakerActive: boolean;
  cooldownUntil?: string;
};

export interface FederatedLiteratureAdapter {
  readonly providerId: ScholarlyProviderId;
  getCapabilities(): ProviderCapabilitySnapshot;
  search(spec: QuerySpec, signal?: AbortSignal): Promise<{ records: ProviderRecord[]; canonicalCandidates: Partial<CanonicalLiteratureRecord>[] }>;
  fetchMetadata?(providerRecordId: string, signal?: AbortSignal): Promise<ProviderRecord | null>;
  fetchEvidenceExcerpt?(providerRecordId: string, purpose: string, signal?: AbortSignal): Promise<{ excerpt: string; pageOrLocation?: string } | null>;
  fetchCitationEdges?(providerRecordId: string, direction: "INCOMING" | "OUTGOING", signal?: AbortSignal): Promise<Array<{ targetDoi?: string; targetTitle?: string }>>;
  observeUsage?(): Promise<QuotaLedgerEntry>;
}

export function dedupeCandidatesIntoCanonical(
  workspaceId: string,
  rawCandidates: Array<{ canonical: Partial<CanonicalLiteratureRecord>; providerRecord: ProviderRecord }>,
  existingCanonical: Map<string, CanonicalLiteratureRecord> = new Map(),
): { canonicals: CanonicalLiteratureRecord[]; mergedCount: number } {
  const result = new Map<string, CanonicalLiteratureRecord>(existingCanonical);
  let mergedCount = 0;

  for (const { canonical, providerRecord } of rawCandidates) {
    const doi = canonical.doi?.toLowerCase().trim() || null;
    let matchKey: string | null = null;

    if (doi) {
      matchKey = `doi:${doi}`;
    } else if (canonical.normalizedTitle && canonical.year) {
      matchKey = `title_year:${canonical.normalizedTitle}:${canonical.year}`;
    }

    if (matchKey && result.has(matchKey)) {
      const existing = result.get(matchKey)!;
      const alreadyHasProvider = existing.providerRecords.some(
        (p) => p.retrievalProvider === providerRecord.retrievalProvider && p.upstreamId === providerRecord.upstreamId,
      );
      if (!alreadyHasProvider) {
        existing.providerRecords.push(providerRecord);
      }
      existing.lastRetrievedAt = providerRecord.retrievedAt;
      mergedCount++;
    } else {
      const newKey = matchKey || `gen_${randomUUID()}`;
      const canonicalRecord: CanonicalLiteratureRecord = {
        canonicalId: canonical.canonicalId || `canon_${randomUUID().slice(0, 16)}`,
        workspaceId,
        doi,
        pmid: canonical.pmid || null,
        arxivId: canonical.arxivId || null,
        title: canonical.title || "",
        normalizedTitle: canonical.normalizedTitle || canonical.title?.toLowerCase().replace(/[^a-z0-9]/gu, "") || "",
        authors: canonical.authors || [],
        year: canonical.year ?? null,
        journalOrVenue: canonical.journalOrVenue ?? null,
        abstract: canonical.abstract ?? null,
        workFamilyId: canonical.workFamilyId,
        studyFamilyId: canonical.studyFamilyId,
        providerRecords: [providerRecord],
        dedupeStrategy: doi ? "DOI_EXACT" : "TITLE_AUTHORS_YEAR_FUZZY",
        firstRetrievedAt: providerRecord.retrievedAt,
        lastRetrievedAt: providerRecord.retrievedAt,
      };
      result.set(newKey, canonicalRecord);
    }
  }

  return { canonicals: Array.from(result.values()), mergedCount };
}
