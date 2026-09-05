/**
 * Federated Literature Adapters & Provider Capability Snapshots
 * Spec v3.2.0 (V3-U03-R1) A8/A9/A10 — Batch A
 *
 * Rule: capability snapshots record DOCUMENTED facts with verifiedAt timestamps.
 * Nothing here claims live_verified until an authorized live contract test runs.
 * Endpoints come from trusted config/schema (see note in federated-literature-contract.ts):
 * endpoint divergence between official Consensus pages is unresolved -> status "unknown".
 */
import {
  type CapabilityKey,
  type FederatedLiteratureAdapter,
  type ProviderCapabilitySnapshot,
  type QuerySpec,
  type ScholarlyProviderId,
} from "./federated-literature-contract.ts";

function cap(status: ProviderCapabilitySnapshot["capabilities"][CapabilityKey]["status"], notes?: string) {
  return { status, ...(notes ? { notes } : {}) };
}

export const FEDERATED_CAPABILITY_CHECKED_AT = "2026-09-06T00:00:00.000Z";

/** Consensus: documented from official homepage + help center 2026-09-06. */
export function consensusCapabilitySnapshot(): ProviderCapabilitySnapshot {
  return {
    provider: "CONSENSUS",
    snapshotVersion: "consensus/1.0.1",
    checkedAt: FEDERATED_CAPABILITY_CHECKED_AT,
    billingPoolId: "consensus_account_pool",
    capabilities: {
      search: cap("live_verified", "GET /v1/search HTTP 200 2026-09-06 (1 authorized call); returns top-20 results; response_hash f5720104287604b1"),
      metadata: cap("live_verified", "doi/title/authors/publish_date/publish_year/journal_name/publisher_name/url confirmed in live payload"),
      references: cap("unknown"),
      citations: cap("live_verified", "citation_count + influential_citation_count present in live payload (99 for sample)"),
      abstract: cap("documented", "abstract key present in live payload; content access level ABSTRACT not FULLTEXT"),
      fulltext_or_chunks: cap("unsupported", "do not claim full-text read from search API"),
      publication_filter: cap("documented", "year_min/year_max present in existing adapter"),
      study_type_filter: cap("documented", "study_type key present in live payload; advanced filters incl. study designs per official pages"),
      exact_venue_filter: cap("unknown", "journal-name param documented as ranking preference, not exact filter"),
      ranking_venue_preference: cap("documented", "journal name param is a sorting preference"),
      aggregation: cap("unsupported", "search ranking is not field-level aggregation"),
      usage_reporting: cap("documented", "429 body includes reset date; shared pool with MCP"),
      write_scope: cap("unsupported"),
    },
  };
}

/** Ai4Scholar: no adapter or account contract test yet — documented platform existence only. */
export function ai4ScholarCapabilitySnapshot(): ProviderCapabilitySnapshot {
  return {
    provider: "AI4SCHOLAR",
    snapshotVersion: "ai4scholar/0.0.0",
    checkedAt: FEDERATED_CAPABILITY_CHECKED_AT,
    capabilities: {
      search: cap("unknown", "platform lists multi-source search; no contract test run"),
      metadata: cap("unknown"),
      references: cap("unknown"),
      citations: cap("unknown"),
      abstract: cap("unknown"),
      fulltext_or_chunks: cap("unknown"),
      publication_filter: cap("unknown"),
      study_type_filter: cap("unknown"),
      exact_venue_filter: cap("unknown"),
      ranking_venue_preference: cap("unknown"),
      aggregation: cap("unknown"),
      usage_reporting: cap("unknown"),
      write_scope: cap("unknown"),
    },
  };
}

/** OpenAlex: documented (group_by aggregation, filters). Existing topic-lab adapter is configured. */
export function openAlexCapabilitySnapshot(): ProviderCapabilitySnapshot {
  return {
    provider: "OPENALEX",
    snapshotVersion: "openalex/1.0.0",
    checkedAt: FEDERATED_CAPABILITY_CHECKED_AT,
    capabilities: {
      search: cap("configured", "topic-lab adapter uses api.openalex.org/works"),
      metadata: cap("documented"),
      references: cap("unknown"),
      citations: cap("documented", "cited_by_count present in existing adapter"),
      abstract: cap("unknown", "inverted index requires reconstruction; not treated as plain abstract"),
      fulltext_or_chunks: cap("unsupported"),
      publication_filter: cap("documented", "publication_date filter"),
      study_type_filter: cap("unknown"),
      exact_venue_filter: cap("documented", "filter by venue/ISSN supported by API docs"),
      ranking_venue_preference: cap("unsupported"),
      aggregation: cap("documented", "group_by per OpenAlex grouping guide"),
      usage_reporting: cap("unknown"),
      write_scope: cap("unsupported"),
    },
  };
}

/** Crossref: documented (bibliographic verification, date semantics). */
export function crossrefCapabilitySnapshot(): ProviderCapabilitySnapshot {
  return {
    provider: "CROSSREF",
    snapshotVersion: "crossref/1.0.0",
    checkedAt: FEDERATED_CAPABILITY_CHECKED_AT,
    capabilities: {
      search: cap("configured", "topic-lab adapter uses api.crossref.org/works"),
      metadata: cap("documented", "DOI + bibliographic verification"),
      references: cap("unknown"),
      citations: cap("documented", "is-referenced-by-count present in existing adapter"),
      abstract: cap("unknown", "abstract presence varies by publisher deposit"),
      fulltext_or_chunks: cap("unsupported"),
      publication_filter: cap("documented", "published/issued dates; created/updated/indexed are NOT interchangeable"),
      study_type_filter: cap("unknown"),
      exact_venue_filter: cap("documented", "ISSN/container-title filters"),
      ranking_venue_preference: cap("unsupported"),
      aggregation: cap("unknown"),
      usage_reporting: cap("unknown"),
      write_scope: cap("unsupported"),
    },
  };
}

/** Semantic Scholar: documented (papers/authors/citations/venue). */
export function semanticScholarCapabilitySnapshot(): ProviderCapabilitySnapshot {
  return {
    provider: "SEMANTIC_SCHOLAR",
    snapshotVersion: "semantic-scholar/1.0.0",
    checkedAt: FEDERATED_CAPABILITY_CHECKED_AT,
    capabilities: {
      search: cap("configured", "topic-lab adapter uses api.semanticscholar.org/graph/v1/paper/search"),
      metadata: cap("documented"),
      references: cap("documented", "references endpoint documented by API"),
      citations: cap("documented", "citations endpoint + citationCount in existing adapter"),
      abstract: cap("unknown", "abstract availability varies"),
      fulltext_or_chunks: cap("unsupported"),
      publication_filter: cap("documented", "year range in existing adapter"),
      study_type_filter: cap("unknown"),
      exact_venue_filter: cap("unknown"),
      ranking_venue_preference: cap("unsupported"),
      aggregation: cap("unknown"),
      usage_reporting: cap("unknown"),
      write_scope: cap("unsupported"),
    },
  };
}

export function capabilitySnapshots(): ProviderCapabilitySnapshot[] {
  return [
    consensusCapabilitySnapshot(),
    ai4ScholarCapabilitySnapshot(),
    openAlexCapabilitySnapshot(),
    crossrefCapabilitySnapshot(),
    semanticScholarCapabilitySnapshot(),
  ];
}

/**
 * Not-yet-live adapter factory: returns an adapter whose search() throws a typed error
 * until an authorized live contract test binds a real endpoint. This keeps callers honest:
 * no fabricated LIVE results; the UI/report must show BLOCKED / NOT_RUN.
 */
export function createPendingLiveAdapter(providerId: ScholarlyProviderId): FederatedLiteratureAdapter {
  return {
    providerId,
    getCapabilities() {
      return capabilitySnapshots().find((s) => s.provider === providerId) ?? {
        provider: providerId,
        snapshotVersion: `${providerId.toLowerCase()}/0.0.0`,
        checkedAt: FEDERATED_CAPABILITY_CHECKED_AT,
        capabilities: Object.fromEntries(
          (["search", "metadata", "references", "citations", "abstract", "fulltext_or_chunks", "publication_filter", "study_type_filter", "exact_venue_filter", "ranking_venue_preference", "aggregation", "usage_reporting", "write_scope"] as const).map((k) => [k, cap("unknown")]),
        ) as ProviderCapabilitySnapshot["capabilities"],
      };
    },
    async search(_spec: QuerySpec, _signal?: AbortSignal) {
      throw new Error(`LIVE_NOT_AUTHORIZED:${providerId}:capability not live_verified; run contract test in authorized env first`);
    },
  };
}
