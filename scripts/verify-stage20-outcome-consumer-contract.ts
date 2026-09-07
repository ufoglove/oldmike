/**
 * OutcomeManagementSnapshot v2 Consumer Contract（V3-U20-FULL R2 -> 成果總覽/回流）
 * 驗 OutcomeManagementSnapshot v2 schema 承接/Gate/回流與「不臆造第21階段/不自動公開/不重放授權」。
 */
import {
  buildOutcomeManagementSnapshot,
  intakeOutcomeWorkspace,
  readyGatesFor,
  nextActionDefault,
  evaluateGate,
  isSameSnapshot,
  newAuthorizationRequired,
  publicReleasePreflight,
  registerOutput,
  registerProofRoundEntity,
  proposeProofIssue,
} from "../lib/outcome-management-v3-service.ts";
import { OUTCOME_GATES, type OutcomeGate, type OutcomeStageFlags } from "../lib/outcome-management-v3-contract.ts";
import { type SubmissionTrackingSnapshot } from "../lib/submission-tracking-v3-contract.ts";

let pass = 0, fail = 0;
const r = (id: string, c: boolean, n: string) => { if (c) { pass++; console.log(`[PASS] ${id} - ${n}`); } else { fail++; console.error(`[FAIL] ${id} - ${n}`); } };

function snapJ(): SubmissionTrackingSnapshot {
  return {
    snapshotId: "stsna_ctl", schemaVersion: "submission-tracking/1.1.0", stageKey: "V3-U19",
    workspaceId: "w", projectId: "p", workOrderId: "w", stageId: "submission-tracking", nextStageId: "post-acceptance",
    sourceFinalSubmissionPackageSnapshotId: "fs", sourceFinalSubmissionPackageSnapshotHash: "h".repeat(64),
    goalContextRevision: 1, primaryGoal: "JOURNAL_SCI_SSCI" as any, documentPurpose: "JOURNAL_INITIAL_SUBMISSION",
    decision: "ACCEPTED", decisionRationale: "", submissionExecutionAuthorized: false, activeSubmissionGuard: false,
    workOrder: { workOrderId: "w", projectId: "p", packageSnapshotId: "fs", documentPurpose: "J", route: "JOURNAL_SCI_SSCI" as any, target: "t", round: 1, status: "DECISIONED" },
    submissionCase: { caseId: "c", workspaceId: "w", projectId: "p", documentId: "doc", manuscriptId: "m", documentPurpose: "J", route: "JOURNAL_SCI_SSCI" as any, target: "t", targetCallYear: "", institutionRef: null, publicationFamilyId: "fam", intakeMode: "FROM_U18_PACKAGE", externalCaseIdentifiers: [], createdAt: "" },
    destinationLegs: [], rounds: [], providerCapabilities: [], actionIntentRefs: [], executionAuthorizationEventRefs: [],
    decisionRecords: [{ decisionId: "dr", caseId: "c", round: 1, issuingParty: "E", decisionWording: "accepted", category: "ACCEPTED", categorySourceVerified: true, decisionDate: "", sourceAssetRef: "s", sourceEvidenceTier: "OFFICIAL_PORTAL_OBSERVATION", dueEventRefs: [], note: "" }],
    adoptedStatusProjection: null, statusMappingVersion: "status-mapping/1.0.0", intakeMode: "FROM_U18_PACKAGE", attempts: [], events: [], receipts: [], externalReviews: [], responseMatrixRef: "", responseWorkOrderRefs: [], upstreamRevisionRefs: [],
    unresolvedIssueRefs: [], laterStageRequirements: [], limitations: [],
    postDecisionProcessingAllowed: true, postDecisionAllowedScopeRefs: ["PROOF_HANDLING"], allowedNextActions: ["PROOF_HANDLING"], nextExternalActionAuthorized: false,
    checksum: "chk_st_ctl", createdAt: "",
  } as SubmissionTrackingSnapshot;
}
const snap = snapJ();
const intake = intakeOutcomeWorkspace({ snapshot: snap, allowedScope: null });
const flags: OutcomeStageFlags = { acceptance: "ACCEPTED", production: "NOT_PRODUCTION", visibility: "NOT_VISIBLE", indexing: "UNVERIFIED", funding: "NOT_AWARDED" };
const gates: OutcomeGate[] = readyGatesFor({ route: "JOURNAL_SCI_SSCI", intake: intake.intakeGatePassed, baseline: true, proofReady: false, execReady: false, reportReady: false, outputVerified: false, releaseReady: false, closureReady: false, archiveVerified: false });
const m = buildOutcomeManagementSnapshot({ workspaceId: "w", projectId: "p", sourceSnapshot: snap, route: "JOURNAL_SCI_SSCI", flags, readyGates: gates, nextAction: nextActionDefault({ route: "JOURNAL_SCI_SSCI", intakeGate: intake.intakeGatePassed }) });

r("C01", m.schemaVersion === "outcome-management/2.0.0" && m.stageKey === "V3-U20", "OutcomeManagementSnapshot v2 schema");
r("C02", m.nextAction.route !== ("V3-U21" as unknown as string), "nextAction 只取真實 route（不臆造第 21 段）");
r("C03", m.nextExternalActionAuthorized === false, "external=false 恆（不重放送件/付款）");
r("C04", intake.intakeGatePassed === true && m.flags.acceptance === "ACCEPTED", "期刊接受→intake Gate+flags");

r("C05", m.inputSubmissionTrackingSnapshotRefs.length >= 1 && m.inputSubmissionTrackingSnapshotHashes.length >= 1, "承接上游 snapshot id/hash ref（無損）");
r("C06", m.flags.production === "NOT_PRODUCTION" && m.flags.funding === "NOT_AWARDED", "accept≠production/funding（先不預設）");

// Gate predicate
const gateEval = evaluateGate({ gate: "POST_DECISION_INTAKE_VERIFIED", conditions: { verified: true }, unresolvedIssues: [] });
r("C07", gateEval.passed === true, "Gate 為具版本 predicate（server 條件構成）");
r("C08", evaluateGate({ gate: "OUTCOME_SCOPE_CLOSURE_READY", conditions: { external: true }, unresolvedIssues: ["open-embargo"] }).passed === false, "未解 issue 阻擋 closure Gate，不因 AI/綠燈放行");

// Authorization cannot be inherited
r("C09", newAuthorizationRequired({ previousWasSubmissionAuth: true, requestedActions: ["proof-return"], freshAuthGiven: false }).ok === false, "送件授權不可重放為 proof/付款/公開");

// Embargo default not auto-release
const out = registerOutput({ familyId: "f", kind: "REPORT", visibility: "PRIVATE" });
r("C10", publicReleasePreflight({ output: out, rightsResolved: true, embargoOver: false, secretsOrPii: false, audienceOk: true }).ok === false, "embargo 未到期不自動公開");

// Proof science bug → route U14/16
const pf = registerProofRoundEntity({ caseId: "c", round: 1, source: "PDF", bytesDigest: "d", acceptedVersionRef: "v1" });
const iss = proposeProofIssue({ proof: pf, original: "x", proposed: "y", location: "M", reason: "r", changesScience: true });
r("C11", iss.ok === true && iss.data.status === "RETURN_TO_U14_16", "科學重大變更標回 U14/U16（不可 proof 直寫）");

// idempotency
r("C12", isSameSnapshot({ existingHash: "a", incomingHash: "a" }) === true && isSameSnapshot({ existingHash: "a", incomingHash: "b" }) === false, "快照冪等：同 hash 重用、異 hash 拒絕");

// gates list integrity
r("C13", OUTCOME_GATES.length === 9 && gates[0] === "POST_DECISION_INTAKE_VERIFIED", "9 Gates 連續（POST_DECISION_INTAKE first）");
r("C14", m.readyGates.includes("POST_DECISION_INTAKE_VERIFIED") && !m.readyGates.includes("OUTCOME_SCOPE_CLOSURE_READY"), "readyGates 反映真實（intake 亮、closure 未亮）");

console.log(`\nOUTCOME CONSUMER v2 : ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
export { };
