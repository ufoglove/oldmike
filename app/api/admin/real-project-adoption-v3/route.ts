import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  createAdoptionWorkOrder,
  evaluateAdoptionGates,
  buildRealProjectDeliverySnapshot,
} from "@/lib/real-project-adoption-v3-service";
import {
  type FirstDeliverableManifest,
  type R03RequirementIssue,
} from "@/lib/real-project-adoption-v3-contract";
import { buildProductionLaunchSnapshot } from "@/lib/production-launch-v3-service";
import { buildReleaseReadinessSnapshot, createReleaseScopeManifest } from "@/lib/release-readiness-v3-service";

const REAL_PROJECT_ADOPTION_V3_API_VERSION = "real-project-adoption-v3/1.0.0" as const;

/**
 * GET /api/admin/real-project-adoption-v3
 * 評估真實專案導入狀態、工作單與 6 大操作門禁
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;

    const workOrder = createAdoptionWorkOrder({
      projectId: "proj_real_first",
      chosenGoal: "JOURNAL_SCI_SSCI",
      documentPurpose: "JOURNAL_INITIAL_SUBMISSION",
      deliveryIntent: "RESEARCH_PLANNING_BASELINE",
      sourceScope: ["lit_approved_v1"],
    });

    const { readyGates, finalCompletionStatus } = evaluateAdoptionGates({
      operationalInputVerified: true,
      workScopeAuthorized: true,
      qualityChecked: true,
      userAccepted: false,
      highPriorityIssuesResolved: true,
      evidenceSaved: true,
    });

    return NextResponse.json({
      ok: true,
      data: {
        apiVersion: REAL_PROJECT_ADOPTION_V3_API_VERSION,
        workOrder,
        readyGates,
        completionStatus: finalCompletionStatus,
        note: "真實專案導入評估：未經真人確認前停在 DELIVERED_PENDING_ACCEPTANCE。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "ADOPTION_EVALUATION_FAILED", error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/real-project-adoption-v3
 * 建立 RealProjectDeliverySnapshot
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;

    const r01Manifest = createReleaseScopeManifest({ targetEnvironment: "production-candidate" });
    const r01Snapshot = buildReleaseReadinessSnapshot({
      commitSha: "head_candidate",
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

    const workOrder = createAdoptionWorkOrder({
      projectId: "proj_real_first",
      chosenGoal: "JOURNAL_SCI_SSCI",
      documentPurpose: "JOURNAL_INITIAL_SUBMISSION",
      deliveryIntent: "RESEARCH_PLANNING_BASELINE",
      sourceScope: ["lit_approved_v1"],
    });

    const manifest: FirstDeliverableManifest = {
      manifestId: "fdm_001",
      workOrderId: workOrder.workOrderId,
      targetDeliverable: "RESEARCH_PLANNING_BASELINE",
      outputArtifacts: [
        {
          filename: "research-blueprint-v1.md",
          format: "MARKDOWN",
          bytes: 1024,
          sha256: "hash_blueprint_md",
          storageRef: "storage/blueprint_v1.md",
        },
      ],
      qualityStatus: "SCIENTIFICALLY_REVIEWED",
      userAcceptanceRecorded: false,
      unresolvedIssueCount: 0,
    };

    const snapshot = buildRealProjectDeliverySnapshot({
      r02Snapshot,
      workOrder,
      manifest,
      userAcceptanceRecorded: false,
      issues: [],
    });

    return NextResponse.json({
      ok: true,
      data: {
        snapshot,
        note: "RealProjectDeliverySnapshot 建立完成；不加入科研進度分母。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "DELIVERY_SNAPSHOT_FAILED", error: message }, { status: 500 });
  }
}
