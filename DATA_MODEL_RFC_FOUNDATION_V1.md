# Research OS Foundation Data Model RFC v1

Status: `RECORDED_NOT_APPROVED_FOR_MIGRATION`  
Migration in this action: `NOT_REQUIRED / NOT_EXECUTED`
MIGRATION_REQUIRED=NO

## Reuse first

- Formal text and derived formal artifacts remain append-only `research_documents` versions.
- State/audit transitions remain `research_workflow_events`.
- Human approvals remain `research_human_gates`, bound to exact content hashes.
- Existing evidence/source structures remain source identity and claim-support authority.

## Future bounded entities

| Entity | Minimum fields | Formal authority / retention |
|---|---|---|
| user_model_profiles | user/workspace scope, label, route policy, encrypted credential-reference id, enabled state, version/hash | Portal/PostgreSQL; no raw key; migration + BYOK approval required |
| execution_receipts | task/action/project commitments, state/timestamps, input/output/idempotency hashes, gate, sanitized status | Portal/PostgreSQL; no raw prompts/provider output/model name in normal API |
| trend_observations | provider/source commitments, DOI, window/sample/retrievedAt/confidence, dedupe status | Portal/PostgreSQL evidence layer; observations unverified by default |
| proposal_matrices | mode, criteria/budget cells, source document hashes, version | append-only research document payload; M05 only |
| research_artifacts | kind, content hash, provenance, immutable storage reference, release gate | existing append-only document/event path where possible |
| bibliography | canonical DOI/source metadata, retrieval/hash/verification state | existing evidence/source path where possible |
| review_reports | source document hash, lens/severity/span/rationale/risk/action, version | existing M03 research document versions |

## Non-negotiable checks

Every future migration must preserve tenant keys, append-only versioning, content hashes, origin/rate limits, Human Gate binding, server-only secret references and row-level authorization in the DAL. Manuscripts/datasets never enter n8n/Neon execution tables. Bytebase is the only proposed migration plane; no role/GRANT, online DDL or schema assumption is authorized by this RFC.
