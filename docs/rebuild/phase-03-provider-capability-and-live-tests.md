# Phase 03 Provider Capability & Live Tests (Batch A)

Spec: v3.2.0 (V3-U03-R1) — docs/stage03/spec-v3-3.2.0.md
Verified date: 2026-09-06 (UTC). Environment: local repo + isolated logic tests. **No keys in local dev env.**

## Scope & honest status summary

| Item | Status | Notes |
|---|---|---|
| Federated capability matrix contract (13 keys × 7 statuses) | ✅ LIVE (contract test) | lib/federated-literature-contract.ts |
| ProviderRecord provenance contract | ✅ LIVE (contract test) | upstream DB / publisher / retrieved_at / response_hash / rights / returned_fields / source_request_id / metric_system |
| Canonical dedup (DOI multi-provider → 1 canonical + N provider records) | ✅ LIVE (contract test) | 23/23 mock tests PASS |
| Work/Study family fields | ✅ contract present | workFamilyId / studyFamilyId defined; persistence pending Batch C |
| Consensus adapter (topic-lab) endpoint adjudication `/v1/search` vs `/v1/quick_search` | ✅ LIVE (2026-09-06) | `/v1/search` returned HTTP 200 (top-20, 53.9KB); production-code endpoint live-valid; `/v1/quick_search` not needed → no extra spend |
| Consensus LIVE search (min query) | ✅ LIVE (2026-09-06) | authorized 1 call in prod container with existing CONSENSUS_API_KEY; read-only, no DB writes; response_hash f5720104287604b1 |
| Ai4Scholar adapter | ❌ NOT_RUN | platform documented only; no adapter, no account contract test; key exists in prod env but not local |
| OpenAlex/Crossref/S2 capability snapshots | ✅ documented (from existing topic-lab adapters) | configured in topic-lab; NOT re-claimed live here |
| Quota ledger billing pool | ✅ contract present | billingPoolId; Consensus API+MCP share one monthly pool (help center verified 2026-09-06) |
| Daily digest scheduler | ⏸ deferred (needs separate authorization) | spec default: disabled until authorized |

## Capability matrix snapshot (documented-level truth, 2026-09-06)

Legend: D=documented, C=configured, U=unknown, X=unsupported, L=live_verified (Consensus search/metadata/citations L after authorized 2026-09-06 probe)

| Capability | Consensus | Ai4Scholar | OpenAlex | Crossref | Semantic Scholar |
|---|---|---|---|---|---|
| search | **L** (`/v1/search` 200, top-20) | U | C | C | C |
| metadata | **L** (doi/title/authors/url) | U | D | D | D |
| references | U | U | U | U | D |
| citations | **L** (citation_count + influential) | U | D (cited_by_count) | D (is-referenced-by) | D |
| abstract | U (tier-dependent) | U | U (inverted index) | U (varies) | U |
| fulltext_or_chunks | X | U | X | X | X |
| publication_filter | D (year_min/max) | U | D | D (dates distinct semantics) | D (year range) |
| study_type_filter | D | U | U | U | U |
| exact_venue_filter | U | U | D | D (ISSN/container) | U |
| ranking_venue_preference | D (journal param is ranking) | U | X | X | X |
| aggregation | X (search ≠ metrics) | U | D (group_by) | U | U |
| usage_reporting | D (429 w/ reset date, shared pool) | U | U | U | U |
| write_scope | X | U | X | X | X |

Key non-negotiable mappings enforced:
- Consensus SJR-typed field → `metricSystem: "SJR"`; NEVER mapped to JCR Q1 / SCIE / SSCI.
- Journal-name parameter in Consensus = ranking preference, not exact venue filter.
- Search top-k ≠ global field growth metric; aggregation only from sources supporting group_by/enumerable scope.
- Abstract/fulltext access is tier-dependent; no claim of "full text read" from search API.

## Evidence for BLOCKED items (no fabrication)

1. ~~**Consensus endpoint divergence**~~ → RESOLVED by authorized LIVE probe 2026-09-06: `/v1/search` HTTP 200. (Historical note: spec Section D records help-article example `/v1/search` vs reference `GET /v1/quick_search`; docs.consensus.app returned 403 to agent on 2026-09-06. Real adjudication was completed with the authorized live call — production endpoint is live-valid.)
2. **Ai4Scholar**: no adapter file exists in repo (only v2-alpha catalog mention). Prod env has AI4SCHOLAR_API_KEY (name only checked). Contract test requires endpoint + auth docs from actual account → NOT_RUN.
3. **Local dev has no keys** (still true for future local runs): all scholarly keys unset locally. The authorized LIVE probe ran in the prod container using prod env keys.

## Live probe provenance (2026-09-06, authorized)

- Endpoint: `GET https://api.consensus.app/v1/search`
- Query: "generative AI virtual reality occupational safety training effectiveness", limit=5, year 2020–2026
- Result: HTTP 200, application/json, 53,929 bytes, **20 results** (Consensus returns top-20 regardless of limit), 3,153 ms
- response_hash: `f5720104287604b1`
- Observed item keys: doi, title, authors, citation_count, influential_citation_count, abstract, journal_name, publish_date, publish_year, study_type, sjr_best_quartile, takeaway, is_preprint, institutions, url, publisher_name, pages, volume
- Sample: doi 10.1016/j.autcon.2024.105315, 2024-04-01, citation_count 99
- **Key contract findings**: (1) SJR field is `sjr_best_quartile` → must be stored `metricSystem: "SJR"`, never mapped to JCR/SCIE; (2) `study_type` present → study_type_filter feasible; (3) `takeaway`/`abstract` are provider extractions at ABSTRACT level, NOT full-text read; (4) journal_name is present but treated as ranking preference, not exact venue proof.
- Capability snapshot updated: consensus search/metadata/citations = live_verified (1.0.1); fulltext/references/write_scope remain unsupported/unknown.

## How to run contract tests

```bash
cd /home/node/dev/repo
node --experimental-strip-types scripts/verify-stage03-batch-a-contracts.ts   # 23 PASS, no network
npx tsc --noEmit   # 0 errors
```

## Commit

- `9bb019e` feat(stage03): batch A federated literature contracts + capability matrix

## Next (Batch A remainder / Batch B)

- Authorized LIVE Consensus contract test (endpoint adjudication + provenance save) — needs user OK to run in prod container with existing key (consumes pool) OR a dev key.
- Ai4Scholar adapter contract + minimal query after account docs review.
- Wire `usage_observation`/QuotaLedger into AgentJob usage reporting.
