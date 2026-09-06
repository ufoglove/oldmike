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

## Six-Provider LIVE Connectivity Confirmation (2026-09-06, authorized probes)

Requested by user: 確認文獻相關 API 是否都上線，並且互助互補（Consensus, Semantic Scholar, OpenAlex, Zotero, arXiv, ai4scholar.net）。

| Provider | 端點 | 結果 | 備註 |
|---|---|---|---|
| Consensus | `https://api.consensus.app/v1/search` | ✅ **200** LIVE | prod 容器內既有 key；top-20、SJR=ranking preference；先前 1 次授權探針已裁決 |
| Semantic Scholar | `https://api.semanticscholar.org/graph/v1/paper/search` | ✅ **200** LIVE | prod 容器內 S2 key；total 43,013、含 citationCount |
| OpenAlex | `https://api.openalex.org/works` | ✅ **200** LIVE | 公開無 key；沙箱直連 200（19,538 筆） |
| Crossref | `https://api.crossref.org/works` | ✅ **200** LIVE | 公開無 key；沙箱直連 200（total 2,217,832） |
| arXiv | `https://export.arxiv.org/api/query` | ✅ **200** LIVE | 公開無 key；首次 503/429 為限流，退避 30s 後單一查詢 200（含 entry） |
| Zotero | `https://api.zotero.org/users/…/items` | ✅ **200** LIVE | prod 容器內 ZOTERO_API_KEY + USER_ID；v3 header；回傳 item key `7IFV86Z3` version 130 |
| ai4scholar.net | 網站 `https://ai4scholar.net/` | ✅ **200**（網站） | API key 存在於 prod env，但 repo 無 adapter、無官方端點契約 → **API live 狀態 UNKNOWN / NOT_RUN**（誠實標記，不冒充） |

### 互助互補功能（依規格 A8/A9 角色）
- **Consensus** = 研究問題導向檢索（支持/反證候選）→ 主問題探索
- **Semantic Scholar** = 論文/作者/引用關係與相近研究 → references/citations 補強
- **OpenAlex** = 可定義範圍的 group_by 聚合計量 → trend/aggregation 補強（唯一支援 aggregation 者）
- **Crossref** = DOI 與書目核對（出版/更新時間語義）→ 書目驗證層
- **arXiv** = 新興技術/預印本線索 → 前沿新穎訊號（保留與正式版 work family 關係）
- **Zotero** = 專案書目管理（collection 對應、引用輸出）→ 橫向書目管理，非搜尋引擎
- **Ai4Scholar** = 多源召回（中文/專利擴充）→ 待 adapter 化（BLOCKED/NOT_RUN 現況）

Canonical 去重：同一 DOI 多來源 → 1 canonical + N ProviderRecord（契約已驗證）；計量不跨 provider 相加。



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
