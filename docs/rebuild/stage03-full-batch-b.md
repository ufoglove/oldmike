# Stage03 Full — Batch B Delivery (V3-U03-FULL, spec v3.4.0)

Date: 2026-09-06 (UTC). Environment: local repo + contract test suites.

## What was delivered in Batch B

### 1. Tri-Route Matching Service (`lib/submission-navigation-service.ts`)
- **Official Discipline Catalogs** (spec §14, §15):
  - `NSTC_GENERAL_DISCIPLINES`: 7 disciplines (H01 文學, H03 教育, H05 心理, H08 管理, E01 土木水利, E08 資工, E11 工工) with official division names and primary focus areas.
  - `MOE_TPR_DISCIPLINES`: 5 categories (TPR_EDU 教育, TPR_ENG 工程, TPR_HUM 人文, TPR_MED 醫護, TPR_TECH 專案實作) under distinct namespace `MOE_TPR` (spec §15: never shared with NSTC).
- **SCI/SSCI Journal Evaluator** (`evaluateJournalCandidates`, spec §12, §13):
  - Produces real candidates (e.g. *Safety Science* as Best Fit, *Computers & Education* as Ambitious) based on topic keywords and methodology.
  - Evaluates across 6 rubric dimensions (scope 25, contribution 20, recent articles 20, method 15, readership 10, conditions 10) summing to 100 via `computeMatchScore`.
  - Distinguishes SCIE / SSCI indexing verified via official sources (MJL).
  - Explicit APC tracking (currency, amount, waiver availability, known/unknown status; spec §13, T20).
  - Concept stage evaluation supported without fabricated results (spec §12, T21).
- **NSTC General Grant Route Evaluator** (`evaluateNstcCandidates`, spec §14):
  - Matches scientific problem and method feasibility against official discipline focuses.
  - Evaluates PI fitness: missing CV/publications marked `UNKNOWN`, NOT failed (spec §14, T22).
  - Separates official deadline from institutional internal deadline (spec §10, §14).
- **MOE Teaching Practice Route Evaluator** (`evaluateMoeTprCandidates`, spec §15):
  - Evaluates course-problem-intervention-outcome chain.
  - Baseline evidence status: missing classroom data marked `PENDING_BASELINE` (research preparation gap), NOT statutory eligibility failure (spec §15, T23, T24).
  - Target academic year explicitly tracked (e.g. 115 ROC / 2026 CE).
- **Official Rule Snapshots** (`buildOfficialRuleSnapshots`, spec §10):
  - Generates verifiable rule snapshots for NSTC and MOE operating guidelines.
  - Separates ROC and CE target cycle years.
  - Retains source URLs, effective dates, and authority namespaces.

## Test Results

| Suite | Result |
|---|---|
| `scripts/verify-stage03-full-batch-b.ts` | **24/24 PASS** |
| `npx tsc --noEmit` | **0 errors** |
| Commit | `bcecf1b` |

## Acceptance Cases Covered (Section 29)
- **T19**: Journal indexing strictly separated (SCIE / SSCI verified).
- **T20**: APC unknown / known status separated with currency and waiver.
- **T21**: Concept research evaluated prospectively without fabricated results.
- **T22**: NSTC discipline matched via scientific problem; eligibility UNKNOWN != fail; deadlines separated.
- **T23**: MOE TPR candidate evaluated; eligibility UNKNOWN != fail.
- **T24**: MOE TPR baseline evidence missing marked PENDING_BASELINE, not administrative failure.
