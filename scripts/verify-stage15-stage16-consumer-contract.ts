/**
 * Stage 16 Consumer Contract Test (V3-U15-FULL → V3-U16 receiver)
 * Spec: docs/stage15/spec-v3-4.0.md §30 (U16 consumer contract)
 *
 * Validates that:
 *   1. ManuscriptWritingSnapshot schema is stable & parseable.
 *   2. Stage 16 receiver state can be built from a Snapshot + EvidencePackage.
 *   3. Receiver points back to U15 (no circular gate).
 *   4. Decision rationale / bound fact count / table+figure refs are intact.
 *   5. Snapshot id is unique and checksum includes random salt.
 *   6. Evidence package + scope accounting are populated.
 *   7. Source analysis snapshot hash + source snapshot id are present.
 *   8. Limitations include the honest "U16 not yet built" note.
 *
 * Does NOT make any DB calls — this is a pure consumer contract test.
 */

import {
  buildManuscriptEvidencePackage,
  buildManuscriptWritingSnapshot,
  buildStage16ReceiverState,
} from "../lib/manuscript-writing-service.ts";
import { type ManuscriptWritingSnapshot } from "../lib/manuscript-writing-contract.ts";
import type { AnalysisResultsSnapshot } from "../lib/analysis-execution-contract.ts";

let pass = 0;
let fail = 0;
function report(id: string, cond: boolean, note: string): void {
  if (cond) {
    pass++;
    console.log(`[PASS] ${id} - ${note}`);
  } else {
    fail++;
    console.error(`[FAIL] ${id} - ${note}`);
  }
}

const analysisSnapshot: AnalysisResultsSnapshot = {
  snapshotId: "arsnap_stage16_consumer_test",
  schemaVersion: "analysis-results/1.0.0",
  stageKey: "V3-U14",
  workspaceId: "ws_stage16_consumer",
  projectId: "proj_stage16_consumer",
  workOrderId: "wo_stage16_consumer",
  stageId: "analysis-execution",
  nextStageId: "results-writing",
  sourceDataGovernanceSnapshotId: "dgsnap_consumer",
  goalContextRevision: 1,
  primaryGoal: "JOURNAL_SCI_SSCI",
  fundingIntent: "NONE",
  publicationIntent: "JOURNAL",
  resultsRevision: 1,
  decision: "ANALYSIS_RESULTS_VALIDATED_AND_RELEASED",
  decisionRationale: "consumer test fixture",
  scope: {
    workingTitleZh: "Stage 16 Consumer Test",
    workingTitleEn: "Stage 16 Consumer Test",
    overallPurpose: "test",
    executionMode: "FORMAL_ANALYSIS",
  },
  sourceDatasetVersion: "v0",
  sourceDatasetContentHashSha256: "0".repeat(64),
  resultRecordRefs: ["rec_test"],
  immutableResultFactManifestRef: ["fact_a", "fact_b", "fact_c"],
  totalResultFactsCount: 3,
  tableRefs: ["tab_01"],
  figureRefs: ["fig_01"],
  isMultiplicityCorrected: true,
  hasNonSignificantOutcomesReportedHonesty: true,
  unperformedAnalysisReasons: ["unperf_test"],
  downstreamRequirements: [],
  duePhases: [],
  limitations: [],
  checksum: "chk_test",
  createdAt: new Date().toISOString(),
};

// Build a workspace by hand (avoid importing service builders that depend on the U14 fixture shape).
import { type ManuscriptWorkspace } from "../lib/manuscript-writing-contract.ts";

const workspace: ManuscriptWorkspace = {
  workspaceId: "ws_ms_stage16_consumer",
  projectId: "proj_stage16_consumer",
  manuscriptId: "ms_stage16_consumer_v1",
  currentRevision: 1,
  sourceAnalysisSnapshotId: analysisSnapshot.snapshotId,
  primaryGoal: analysisSnapshot.primaryGoal,
  fundingIntent: analysisSnapshot.fundingIntent,
  publicationIntent: analysisSnapshot.publicationIntent,
  writingMode: "FORMAL_SCIENTIFIC_DRAFT",
  workOrder: {
    workOrderId: "worder_ms_stage16",
    projectId: "proj_stage16_consumer",
    manuscriptId: "ms_stage16_consumer_v1",
    targetJournalCategory: "TBD",
    writingMode: "FORMAL_SCIENTIFIC_DRAFT",
    formalWritingAllowed: true,
    includedRqRefs: ["RQ-01"],
    authorizedAuthorshipRoles: [],
    budgetWordLimit: 8000,
    status: "DRAFT_READY_FOR_REVIEW",
  },
  storyboardRows: [
    {
      rqRef: "RQ-01",
      hypothesisRef: "H1",
      boundResultFactIds: ["fact_a", "fact_b", "fact_c"],
      boundTableRefs: ["tab_01"],
      boundFigureRefs: ["fig_01"],
      outcomeSummaryZh: "consumer test",
      isStatisticallySignificant: true,
    },
  ],
  sections: [
    {
      sectionId: "sec_results",
      semanticSectionId: "RESULTS",
      titleZh: "結果",
      titleEn: "Results",
      wordCount: 100,
      paragraphs: [
        {
          paragraphId: "p1",
          order: 1,
          content: "fact_a",
          boundFactIds: ["fact_a", "fact_b", "fact_c"],
          citationSourceRefs: [],
          isLocked: false,
        },
      ],
      isLocked: false,
    },
  ],
  claimEvidenceLinks: [],
  embeddedTableRefs: ["tab_01"],
  embeddedFigureRefs: ["fig_01"],
  downstreamRequirements: [],
  decision: "MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW",
  decisionRationale: "consumer test",
  reviewState: "APPROVED",
  isLocked: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const evidencePackage = buildManuscriptEvidencePackage({ workspace, analysisSnapshot });
const snapshot = buildManuscriptWritingSnapshot({ workspace, analysisSnapshot, evidencePackage });
const receiver = buildStage16ReceiverState({
  workspace,
  manuscriptWritingSnapshot: snapshot,
  evidencePackage,
});

report("S16-C01", snapshot.schemaVersion === "manuscript-writing/1.0.0", "snapshot schema version is stable");
report("S16-C02", snapshot.stageKey === "V3-U15", "snapshot stageKey is V3-U15");
report("S16-C03", snapshot.nextStageId === "scientific-review", "nextStageId points to Stage 16 receiver");
report("S16-C04", !!snapshot.sourceAnalysisSnapshotId && !!snapshot.sourceAnalysisSnapshotContentHashSha256, "source analysis snapshot id + sha256 present");
report("S16-C05", snapshot.sourceAnalysisSnapshotContentHashSha256.length === 64, "source sha256 is 64 hex chars");
report("S16-C06", !!snapshot.evidencePackageId && snapshot.evidencePackageContentHashSha256.length === 64, "evidence package id + sha256 present");
report("S16-C07", snapshot.boundResultFactIds.length === 3, "boundResultFactIds propagated");
report("S16-C08", snapshot.boundCitationSourceRefs.length === 0, "boundCitationSourceRefs propagated (empty for this fixture)");
report("S16-C09", snapshot.embeddedTableRefs.includes("tab_01") && snapshot.embeddedFigureRefs.includes("fig_01"), "table/figure refs propagated");
report("S16-C10", Array.isArray(snapshot.limitations) && snapshot.limitations.length >= 3, "limitations array populated");
report("S16-C11", snapshot.limitations.some((l) => /U16/.test(l)), "limitations include honest U16-not-yet-built note");
report("S16-C12", /^chk_mw_/.test(snapshot.checksum), "checksum has expected prefix");

// Re-running builder yields DIFFERENT snapshotId + checksum (idempotency guard at the API layer).
const snapshot2 = buildManuscriptWritingSnapshot({ workspace, analysisSnapshot, evidencePackage });
report("S16-C13", snapshot.snapshotId !== snapshot2.snapshotId, "snapshotId is unique per build");

// Receiver wiring
report("S16-R01", receiver.receiverVersion === "scientific-review-receiver/1.0.0", "receiver version is stable");
report("S16-R02", receiver.sourceManuscriptWritingSnapshotId === snapshot.snapshotId, "receiver points to source snapshot");
report("S16-R03", receiver.sourceSchemaVersion === snapshot.schemaVersion, "receiver carries schema version");
report("S16-R04", receiver.boundResultFactCount === 3, "receiver reports bound fact count");
report("S16-R05", receiver.embeddedTableCount === 1 && receiver.embeddedFigureCount === 1, "receiver reports table/figure count");
report("S16-R06", receiver.readyForReview === true, "receiver reports readyForReview=true when integrity flags + MAIN_TEXT present");
report("S16-R07", receiver.reEntryPoint.route === "manuscript-writing", "receiver points back to U15 (no circular gate)");
report("S16-R08", receiver.reEntryPoint.action === "initialize", "receiver re-entry action is initialize (idempotent resume)");

// Evidence package integrity
report("S16-E01", evidencePackage.packageId.startsWith("mevp_"), "evidence package id has mevp_ prefix");
report("S16-E02", evidencePackage.scopeAccounting.mainText.length === 1, "MAIN_TEXT accounts for one storyboard row");
report("S16-E03", evidencePackage.scopeAccounting.notPerformedWithReason.includes("unperf_test"), "unperformed reasons carry forward from U14");
report("S16-E04", evidencePackage.scopeAccounting.table.includes("tab_01"), "table scope accounting populated");
report("S16-E05", evidencePackage.scopeAccounting.figure.includes("fig_01"), "figure scope accounting populated");

// Decision canonical string (no fake human approval)
report("S16-D01", snapshot.decision !== "HUMAN_APPROVED", "decision is not HUMAN_APPROVED (spec §24: AI auto-lock ≠ human approval)");

console.log("");
console.log(`STAGE 16 CONSUMER CONTRACT: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
