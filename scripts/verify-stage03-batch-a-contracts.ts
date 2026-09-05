/**
 * Batch A contract tests: Federated Literature contracts (no keys, no network).
 * Run: node --experimental-strip-types scripts/verify-stage03-batch-a-contracts.ts
 * Covers: capability matrix shape, dedupe (DOI multi-provider merge, title-year fuzzy), quota pool flag.
 */
import { capabilitySnapshots, consensusCapabilitySnapshot, ai4ScholarCapabilitySnapshot, createPendingLiveAdapter } from "../lib/federated-literature-adapters.ts";
import { dedupeCandidatesIntoCanonical, type ProviderRecord } from "../lib/federated-literature-contract.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

function providerRecord(provider: ProviderRecord["retrievalProvider"], doi: string | null, upstreamId: string, retrievedAt: string): ProviderRecord {
  return {
    retrievalProvider: provider,
    providerEndpointVersion: "test/1.0.0",
    upstreamId,
    retrievedAt,
    publicationDate: "2024-01-01",
    publicationDatePrecision: "DAY",
    responseHash: "abc",
    rights: "OPEN_ACCESS",
    returnedFields: ["title", "doi"],
    upstreamDatabase: provider === "CONSENSUS" ? "consensus" : provider === "SEMANTIC_SCHOLAR" ? "s2" : provider === "AI4SCHOLAR" ? "ai4scholar-aggregated" : undefined,
  };
}

// 1. Capability matrix: every provider has all 13 keys with valid status
for (const snap of capabilitySnapshots()) {
  const keys = Object.keys(snap.capabilities);
  check(`capability_keys_13_${snap.provider}`, keys.length === 13, `got ${keys.length}`);
  const statuses = new Set(Object.values(snap.capabilities).map((c) => c.status));
  const valid = ["documented", "configured", "contract_tested", "live_verified", "unsupported", "scope_denied", "unknown"];
  check(`capability_statuses_valid_${snap.provider}`, [...statuses].every((s) => valid.includes(s)), [...statuses].join(","));
}

// Consensus: search/metadata/citations are live_verified ONLY for the authorized 2026-09-06 probe
const cs = consensusCapabilitySnapshot();
check("consensus_search_live_verified", cs.capabilities.search.status === "live_verified", cs.capabilities.search.status);
check("consensus_aggregation_unsupported", cs.capabilities.aggregation.status === "unsupported");
check("consensus_ranking_venue_documented", cs.capabilities.ranking_venue_preference.status === "documented");
check("consensus_billing_pool_set", typeof cs.billingPoolId === "string" && cs.billingPoolId.length > 0);
check("consensus_fulltext_still_unsupported", cs.capabilities.fulltext_or_chunks.status === "unsupported");
check("consensus_references_still_unknown", cs.capabilities.references.status === "unknown");
check("consensus_write_scope_unsupported", cs.capabilities.write_scope.status === "unsupported");

// Ai4Scholar: unknown only (no adapter contract test yet)
const ai4 = ai4ScholarCapabilitySnapshot();
check("ai4scholar_unknown_only", Object.values(ai4.capabilities).every((c) => c.status === "unknown"));

// 2. Dedup: same DOI from Consensus + Semantic Scholar + Ai4Scholar -> 1 canonical, 3 providerRecords
const ws = "ws_test";
const candidates = [
  { canonical: { doi: "10.1000/test.1", normalizedTitle: "the same study title", year: 2024, title: "The Same Study Title", authors: [], journalOrVenue: "J" }, providerRecord: providerRecord("CONSENSUS", "10.1000/test.1", "c1", "2026-01-01T00:00:00Z") },
  { canonical: { doi: "10.1000/test.1", normalizedTitle: "the same study title", year: 2024, title: "The Same Study Title", authors: [], journalOrVenue: "J" }, providerRecord: providerRecord("SEMANTIC_SCHOLAR", "10.1000/test.1", "s2-1", "2026-01-02T00:00:00Z") },
  { canonical: { doi: "10.1000/test.1", normalizedTitle: "the same study title", year: 2024, title: "The Same Study Title", authors: [], journalOrVenue: "J" }, providerRecord: providerRecord("AI4SCHOLAR", "10.1000/test.1", "a1", "2026-01-03T00:00:00Z") },
];
const { canonicals, mergedCount } = dedupeCandidatesIntoCanonical(ws, candidates as never);
check("dedup_doi_one_canonical", canonicals.length === 1, `got ${canonicals.length}`);
check("dedup_doi_three_provider_records", canonicals[0]?.providerRecords.length === 3, `got ${canonicals[0]?.providerRecords.length}`);
check("dedup_merged_count_2", mergedCount === 2, `got ${mergedCount}`);
check("dedup_strategy_doi_exact", canonicals[0]?.dedupeStrategy === "DOI_EXACT");

// 3. Same provider duplicate upstreamId not double-added
const dup = dedupeCandidatesIntoCanonical(ws, [
  { canonical: { doi: "10.1000/test.2", normalizedTitle: "t2", year: 2023, title: "T2" }, providerRecord: providerRecord("CONSENSUS", "10.1000/test.2", "same-upstream", "2026-01-01T00:00:00Z") },
  { canonical: { doi: "10.1000/test.2", normalizedTitle: "t2", year: 2023, title: "T2" }, providerRecord: providerRecord("CONSENSUS", "10.1000/test.2", "same-upstream", "2026-01-02T00:00:00Z") },
] as never);
check("dedup_same_provider_not_double", dup.canonicals[0]?.providerRecords.length === 1, `got ${dup.canonicals[0]?.providerRecords.length}`);

// 4. No-DOI fuzzy match same title+year -> merged as candidate; different year -> separate
const fuzzy = dedupeCandidatesIntoCanonical(ws, [
  { canonical: { doi: null, normalizedTitle: "fuzzy title match", year: 2020, title: "Fuzzy Title Match" }, providerRecord: providerRecord("CROSSREF", null, "x1", "2026-01-01T00:00:00Z") },
  { canonical: { doi: null, normalizedTitle: "fuzzy title match", year: 2020, title: "Fuzzy Title Match (errant suffix)" }, providerRecord: providerRecord("OPENALEX", null, "x2", "2026-01-02T00:00:00Z") },
  { canonical: { doi: null, normalizedTitle: "fuzzy title match", year: 2021, title: "Fuzzy Title Match later" }, providerRecord: providerRecord("CROSSREF", null, "x3", "2026-01-03T00:00:00Z") },
] as never);
check("dedup_fuzzy_same_merged", fuzzy.canonicals.length === 2, `got ${fuzzy.canonicals.length} (same title+year merged, diff year separate)`);

// 5. Pending live adapter refuses to fake results
const pending = createPendingLiveAdapter("CONSENSUS");
let threw = false;
try { await pending.search({ naturalLanguageQuery: "x" }); } catch (e) { threw = (e as Error).message.includes("LIVE_NOT_AUTHORIZED"); }
check("pending_adapter_no_fake_live", threw);

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
