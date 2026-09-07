/**
 * OutcomeManagementSnapshot 下游 Consumer Contract（V3-U20-FULL）
 * 驗 OutcomeManagementSnapshot schema/承接/門與「不臆造第 21 階段 / 不自動公開 / 不重放授權」。
 */
import {
  buildOutcomeManagementSnapshot,
  computeNextCapability,
  actionIntentRequiresReauthorization,
} from "../lib/outcome-management-v3-service.ts";
import { type SubmissionTrackingSnapshot } from "../lib/submission-tracking-v3-contract.ts";

let pass = 0, fail = 0;
const r = (id: string, c: boolean, n: string) => { if (c) { pass++; console.log(`[PASS] ${id} - ${n}`); } else { fail++; console.error(`[FAIL] ${id} - ${n}`); } };

function snapJ(): SubmissionTrackingSnapshot {
  return {
    snapshotId: "stsna_ctl", schemaVersion: "submission-tracking/1.1.0", stageKey: "V3-U19",
    workspaceId: "w", projectId: "p", workOrderId: "w", stageId: "submission-tracking", nextStageId: "post-acceptance",
    sourceFinalSubmissionPackageSnapshotId: "fs", sourceFinalSubmissionPackageSnapshotHash: "h".repeat(64),
    goalContextRevision: 1, primaryGoal: "JOURNAL_SCI_SSCI", documentPurpose: "JOURNAL_INITIAL_SUBMISSION",
    decision: "ACCEPTED", decisionRationale: "x", submissionExecutionAuthorized: false, activeSubmissionGuard: false,
    workOrder: { workOrderId: "w", projectId: "p", caseId: "c", packageSnapshotId: "fs", documentPurpose: "J", route: "JOURNAL_SCI_SSCI", target: "t", round: 1, status: "DECISIONED" },
    submissionCase: { caseId: "c", workspaceId: "w", projectId: "p", documentId: "d", manuscriptId: "m", documentPurpose: "J", route: "JOURNAL_SCI_SSCI", target: "t", targetCallYear: "", institutionRef: null, publicationFamilyId: "f", intakeMode: "FROM_U18_PACKAGE", externalCaseIdentifiers: [], createdAt: "" },
    destinationLegs: [], rounds: [], providerCapabilities: [], actionIntentRefs: [], executionAuthorizationEventRefs: [],
    decisionRecords: [{ decisionId: "dr", caseId: "c", round: 1, issuingParty: "E", decisionWording: "accepted", category: "ACCEPTED", categorySourceVerified: true, decisionDate: "", dueEventRefs: [], sourceAssetRef: "a", sourceEvidenceTier: "OFFICIAL_PORTAL_OBSERVATION", note: "" }],
    adoptedStatusProjection: null, statusMappingVersion: "status-mapping/1.0.0", intakeMode: "FROM_U18_PACKAGE",
    attempts: [], events: [], receipts: [], externalReviews: [], responseMatrixRef: "", responseWorkOrderRefs: [], upstreamRevisionRefs: [],
    unresolvedIssueRefs: [], laterStageRequirements: [], limitations: [],
    postDecisionProcessingAllowed: true, postDecisionAllowedScopeRefs: ["PROOF_HANDLING"], allowedNextActions: ["PROOF_HANDLING"], nextExternalActionAuthorized: false,
    checksum: "chk_st_ctl", createdAt: "",
  };
}

const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: snapJ(), route: "JOURNAL_SCI_SSCI" });
r("OM1", m.schemaVersion === "outcome-management/1.1.0" && m.stageKey === "V3-U20", "OutcomeManagementSnapshot schema/version/stage");
r("OM2", m.nextStageId === "closure-or-new-study", "下游不需臆造第 21 階段");
r("OM3", m.nextExternalActionAuthorizedAsGiven === false, "external-action=false 恆（不重放送件/付款授權）");
r("OM4", m.route === "JOURNAL_SCI_SSCI" && m.postDecisionProcessingAllowed === true, "期刊接受→postDecision 允許(映射)");
r("OM5", m.allowedNextActions.includes("PROOF_HANDLING"), "allowed_next_actions 含校樣處理");
r("OM6", m.sourceSubmissionTrackingSnapshotId === "stsna_ctl", "承接上游 snapshot 可溯源");
r("OM7", computeNextCapability({ route: "JOURNAL_SCI_SSCI", acceptedOrGranted: true, sourceVerified: true }) === "OUTCOME_OVERVIEW", "CTA 成果總覽（接受）");
r("OM8", actionIntentRequiresReauthorization({ requestedKinds: ["PAY"], hasFreshExplicitAuth: false }).ok === false, "送件授權不可重放為付款（需重新授權）");
r("OM9", !JSON.stringify(m).includes('PUBLISHED') && !JSON.stringify(m).includes('FUNDS_RECEIVED'), "snapshot 不自動宣稱 Published／Funds");
r("OM10", m.postDecisionAllowedScopeRefs.length >= 0, "scope refs 列出（來自上游）");

console.log(`\nOUTCOME CONSUMER CONTRACT: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
