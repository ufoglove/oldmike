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
| Consensus adapter (topic-lab) endpoint adjudication `/v1/search` vs `/v1/quick_search` | ⚠️ BLOCKED | official docs divergent (help article shows one, reference shows other; docs.consensus.app 403 to agent); requires authorized LIVE test with account key |
| Consensus LIVE search (min query) | ⚠️ BLOCKED | needs prod-env key + user authorization (consumes shared monthly pool; $0.10+/call per official page) |
| Ai4Scholar adapter | ❌ NOT_RUN | platform documented only; no adapter, no account contract test; key exists in prod env but not local |
| OpenAlex/Crossref/S2 capability snapshots | ✅ documented (from existing topic-lab adapters) | configured in topic-lab; NOT re-claimed live here |
| Quota ledger billing pool | ✅ contract present | billingPoolId; Consensus API+MCP share one monthly pool (help center verified 2026-09-06) |
| Daily digest scheduler | ⏸ deferred (needs separate authorization) | spec default: disabled until authorized |

## Capability matrix snapshot (documented-level truth, 2026-09-06)

Legend: D=documented, C=configured, U=unknown, X=unsupported, L=live_verified (none yet in this file)

| Capability | Consensus | Ai4Scholar | OpenAlex | Crossref | Semantic Scholar |
|---|---|---|---|---|---|
| search | D (top-20) | U | C | C | C |
| metadata | D | U | D | D | D |
| references | U | U | U | U | D |
| citations | U | U | D (cited_by_count) | D (is-referenced-by) | D |
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

1. **Consensus endpoint divergence**: spec Section D (丁篇) records help article example `/v1/search` vs reference `GET /v1/quick_search`. Agent's own fetch of docs.consensus.app → HTTP 403 (Cloudflare) on 2026-09-06. Existing topic-lab adapter uses `/v1/search` and was previously live-probed OK at infra level in Stage 02 (source connectivity), but **that probe verified reachability/keys, not response-shape contract for quick_search semantics**. Real adjudication needs an authorized LIVE call.
2. **Ai4Scholar**: no adapter file exists in repo (only v2-alpha catalog mention). Prod env has AI4SCHOLAR_API_KEY (name only checked). Contract test requires endpoint + auth docs from actual account → NOT_RUN.
3. **Local dev has no keys**: CONSENSUS_API_KEY / AI4SCHOLAR_API_KEY / OPENALEX_API_KEY / SEMANTIC_SCHOLAR_API_KEY / S2_API_KEY all unset locally (verified 2026-09-06). All LIVE provider queries therefore BLOCKED until user authorizes prod-container test or provides keys.

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
