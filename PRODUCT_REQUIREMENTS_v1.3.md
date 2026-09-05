# Old Mike 智慧選題與研究啟動中心 - Product Requirements v1.3

## Version boundary

This is the local Portal/Workspace v1.3.2 security and usability candidate. Research OS remains 3.2.0. The last explicitly user-confirmed online Portal is 1.1.3; the current actual online version is pending read-only `/api/health` verification. This document does not authorize deployment.

## Product promise

A user may provide a formal domain, a rough direction or no idea. Old Mike can propose research directions, explain feasibility and risk, create an AI-proposed S0 draft and guide a researcher through human review. It must not promise novelty, funding approval, publication acceptance or a guaranteed result.

## Functional scope

- Quick Start supports the six canonical domains and NSTC, MOE, SCI and SSCI tracks.
- Topic Lab produces 3-5 comparable candidates with Chinese/English titles, questions, population, theory, methods, data, risks, track fit, novelty state, sources, unknowns and one next action.
- Horizon Radar defaults to a 24-36 month window and records keywords, synonyms, search log, source dates, contested evidence and unresolved opportunities.
- Evidence Center records search strategy, source list and claim-to-source ledger.
- Professional S0 provides field-level suggestions and one-click draft completion. Every generated value is `AI_PROPOSED` until accepted or edited by the researcher.
- A fresh preview and explicit Human Gate are required before `project-init`; assistance never writes a project.

## Evidence requirements

The model may return only `AI_PROPOSED`, `UNVERIFIED`, `CONTRADICTED` or `BLOCKED` source labels. The only fetchable research API is the fixed Crossref allowlist. `SOURCE_METADATA_VERIFIED` is reserved for server-side source identity metadata matching; it never establishes `CLAIM_VERIFIED`. Without a locator and reliable claim-to-source verification, claims remain `CLAIM_UNVERIFIED`. No genuine search capability results in a blocked Radar/Evidence state and the message `尚未連接真實來源檢索`.

## Non-scope

Full research design, statistical analysis, grant prose, journal submission and Reviewer Response remain later milestones. No fake progress, score or completion percentage may represent those modules.
