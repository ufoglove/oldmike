import assert from "node:assert/strict";
import {
  MAINTENANCE_REVIEW_CONTRACT_VERSION,
  type MaintenanceReviewSnapshot,
  R04_MAINTENANCE_GATES,
} from "../lib/maintenance-review-v3-contract";
import {
  createMaintenanceWorkOrder,
  evaluateMaintenanceGates,
  buildMaintenanceReviewSnapshot,
} from "../lib/maintenance-review-v3-service";
import { buildRealProjectDeliverySnapshot, createAdoptionWorkOrder } from "../lib/real-project-adoption-v3-service";
import { buildProductionLaunchSnapshot } from "../lib/production-launch-v3-service";
import { buildReleaseReadinessSnapshot, createReleaseScopeManifest } from "../lib/release-readiness-v3-service";

console.log("=== 執行 R04 Consumer Contract & Snapshot 冪等驗證 ===");

// 1. Contract version
assert.equal(MAINTENANCE_REVIEW_CONTRACT_VERSION, "maintenance-review/3.4.0");

// 2. R04 Gates
assert.equal(R04_MAINTENANCE_GATES.length, 4);
assert.deepEqual(R04_MAINTENANCE_GATES, [
  "R04_INPUT_SCOPE_AND_EVIDENCE_CHECKED",
  "R04_QUALITY_CONTROL_PLAN_VALIDATED",
  "R04_MAINTENANCE_REVIEW_RECORDED",
  "R04_ISSUES_DISPOSITIONED_AND_HANDOFF_SAVED",
]);

// 3. Upstream chain simulation
const r01Manifest = createReleaseScopeManifest({ targetEnvironment: "production-candidate" });
const r01Snapshot = buildReleaseReadinessSnapshot({
  commitSha: "commit_upstream_test",
  manifest: r01Manifest,
  issues: [],
});
const r02Snapshot = buildProductionLaunchSnapshot({
  r01Snapshot,
  environmentManifest: {
    environmentId: "zeabur_prod_001",
    targetEnvironment: "production",
    platformProjectId: "proj_zeabur_main",
    platformServiceId: "srv_web_portal",
    deploymentBranch: "main",
    publicDomain: "https://research.josephbb0105.com",
    isVolumeAttached: true,
    dbIdentityHash: "db_hash_v3_main",
    isProductionDualVerified: true,
    createdAt: new Date().toISOString(),
  },
  authorization: null,
});
const adoptionWorkOrder = createAdoptionWorkOrder({
  projectId: "proj_real_first",
  chosenGoal: "JOURNAL_SCI_SSCI",
  documentPurpose: "JOURNAL_INITIAL_SUBMISSION",
  deliveryIntent: "RESEARCH_PLANNING_BASELINE",
  sourceScope: ["lit_approved_v1"],
});
const r03Snapshot = buildRealProjectDeliverySnapshot({
  r02Snapshot,
  workOrder: adoptionWorkOrder,
  manifest: {
    manifestId: "fdm_test",
    workOrderId: adoptionWorkOrder.workOrderId,
    targetDeliverable: "RESEARCH_PLANNING_BASELINE",
    outputArtifacts: [],
    qualityStatus: "SCIENTIFICALLY_REVIEWED",
    userAcceptanceRecorded: true,
    unresolvedIssueCount: 0,
  },
  userAcceptanceRecorded: true,
  issues: [],
});

// 4. Build R04 Snapshot
const mwo = createMaintenanceWorkOrder({ owner: "operator_lead" });
const r04Snapshot: MaintenanceReviewSnapshot = buildMaintenanceReviewSnapshot({
  r03Snapshot,
  workOrder: mwo,
  patchStatus: "NO_CODE_CHANGE_REQUIRED",
});

// 5. Verify fields & safety flags
assert.equal(r04Snapshot.schemaVersion, "maintenance-review/3.4.0");
assert.equal(r04Snapshot.taskKey, "V3-R04");
assert.equal(r04Snapshot.engineeringProgressNotInResearchDenominator, true);
assert.equal(r04Snapshot.rawResearchFactMutationAuthorized, false);
assert.equal(r04Snapshot.submissionPaymentPublicationAuthorized, false);
assert.equal(r04Snapshot.unspecifiedProductionChangeAuthorized, false);
assert.equal(r04Snapshot.reviewDisposition, "MAINTENANCE_REVIEW_AND_CONTROL_HANDOFF_COMPLETE");
assert.equal(r04Snapshot.controlValidationStatus, "PASSED");
assert.equal(r04Snapshot.operatingHealthStatus, "WITHIN_CONFIRMED_TARGET");

// 6. Upstream evidence missing test
const missingGates = evaluateMaintenanceGates({
  upstreamR03Verified: false,
  qualityPlanValidated: true,
  maintenanceReviewRecorded: true,
  issuesDispositioned: true,
});
assert.equal(missingGates.disposition, "UPSTREAM_EVIDENCE_PENDING");

console.log("[PASS] R04 Consumer Contract & Snapshot 驗證全數通過！");
