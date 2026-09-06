# Phase 03 Route Data Contracts (Batch C)

Spec: v3.2.0 (V3-U03-R1) — docs/stage03/spec-v3-3.2.0.md
Verified date: 2026-09-06 (UTC). Environment: local repo + isolated logic tests.

## Tri-Route Engines & Data Contracts

### 1. SubmissionFingerprintVersion (`lib/submission-fingerprint-contract.ts`)
- **Zero re-entry** (spec §3): `buildFingerprintFromTopicSnapshot()` directly carries `titleZh`, `titleEn`, `conceptAbstract`, `researchQuestion`, `gapStatement`, `methodologyOverview`, `expectedContribution`, `minimumViableStudy`, `knownLimitations`, `assumptions`, `risks`, `literatureIds`, `citationSourceIds` from `TopicSelectionSnapshot`.
- **Two independent decision axes** (spec §4):
  - `funding_intent`: `NSTC_GENERAL` | `MOE_TPR` | `NONE` | `UNDECIDED`
  - `publication_intent`: `JOURNAL` | `DEFERRED` | `NONE`
  - A project can pursue NSTC funding while maintaining international journal publication plans.
- **Evidence origin**: `researcherProfileRefs` status defaults to `UNKNOWN` (never inferred from Old Mike persona or user interests).

### 2. Match Score Rubrics (`lib/submission-fingerprint-contract.ts`)
- `computeMatchScore()` enforces spec §13:
  - Total weight = 100.
  - `observed_points = Σ(weight × rating / 5)` for assessed dimensions only.
  - `UNKNOWN` is NOT 0 and NOT fake 100.
  - `coverage = assessedWeight / totalWeight` explicitly displayed.
  - Partial coverage shows e.g. `已評 59 分（已評權重 70；覆蓋 70%）`.
  - Complete coverage (1.0) shows `76 / 100`.

### 3. OfficialRuleSnapshot (`lib/submission-navigation-engines-contract.ts`)
- 7 statuses: `VERIFIED_APPLICABLE` | `REFERENCE_ONLY` | `TARGET_CYCLE_UNVERIFIED` | `NOT_LOCATED_IN_SEARCH` | `PENDING_ANNOUNCEMENT` | `CONFLICTING_SOURCES` | `UNVERIFIED`.
- Cycle distinction: ROC (民國年) and CE (西元年) preserved separately (e.g. 115年度 / 2026).
- Authority separation: NSTC / MOE / PUBLISHER / INSTITUTION.
- Institutional deadline separated from official deadline (other schools' deadlines cannot be used).

### 4. Tri-Route Candidate Models (`lib/submission-navigation-engines-contract.ts`)
- **International Journals**: `JournalCandidate` with `fitScore`, `fitCoverage`, `indexingVerified` (SCIE/SSCI/SCOPUS/EI), `apcKnown` (currency/amount/waiver/status: KNOWN/UNKNOWN), `recentArticlesSample`, `primaryRisk`.
- **NSTC General Grant**: `NstcRouteCandidate` with `divisionName`, `disciplineCode` (e.g. H03), `disciplineName`, `eligibilityStatus` (PASS/FAIL/UNKNOWN), `deadlines` (official vs institutional).
- **MOE Teaching Practice**: `MoeTprRouteCandidate` with `disciplineOrProgramName`, `targetAcademicYearRoc` (e.g. 115), `courseFit` (`isInstructorVerified`, `creditsKnown`, `baselineEvidenceStatus`).

### 5. SubmissionNavigationSnapshot (`lib/submission-navigation-engines-contract.ts`)
- Immutable handoff to research blueprint (spec §20).
- `planningStatus`: `ROUTE_PLAN_READY` (when candidates chosen) vs `PROVISIONAL_ROUTE_PLAN_READY` (when provisional).
- `decisionOrigin`: `USER_MANUAL_SELECTION` vs `AUTO_SELECTED_PROVISIONAL`.
- Preserves `ruleSnapshots`, `handoffLimitations`, `downstreamRequirements`.

## Verification

- `scripts/verify-stage03-batch-c-contracts.ts`: **22/22 PASS**.
- `npx tsc --noEmit`: **0 errors**.
- Commit: `36c68d2`.
