import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  detectLaunchMode,
  evaluateProductionLaunchGates,
  buildProductionLaunchSnapshot,
} from "@/lib/production-launch-v3-service";
import {
  type EnvironmentManifest,
  type ProductionReleaseAuthorization,
} from "@/lib/production-launch-v3-contract";
import { buildReleaseReadinessSnapshot, createReleaseScopeManifest } from "@/lib/release-readiness-v3-service";

export const PRODUCTION_LAUNCH_V3_API_VERSION = "production-launch-v3/1.0.0" as const;

/**
 * GET /api/admin/production-launch-v3
 * 評估受控發布狀態、目前上線模式與 6 大工程門禁
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;

    const envManifest: EnvironmentManifest = {
      environmentId: "zeabur_prod_001",
      targetEnvironment: "production",
      platformProjectId: "proj_zeabur_main",
      platformServiceId: "srv_web_portal",
      deploymentBranch: "main",
      publicDomain: "https://research.openclaw.app",
      isVolumeAttached: true,
      dbIdentityHash: "db_hash_v3_main",
      isProductionDualVerified: true,
      createdAt: new Date().toISOString(),
    };

    const { readyGates, finalDecision } = evaluateProductionLaunchGates({
      upstreamR01Verified: true,
      deploymentRehearsalPassed: true,
      authorization: null, // 預設未提供生產授權，停在待核准狀態
      smokePassed: false,
      observationPassed: false,
      operationsHandoffAccepted: false,
    });

    return NextResponse.json({
      ok: true,
      data: {
        apiVersion: PRODUCTION_LAUNCH_V3_API_VERSION,
        launchMode: "PREPARATION_ONLY",
        environment: envManifest,
        readyGates,
        readinessDecision: finalDecision,
        note: "受控發布評估：未獲真人生產授權前停在 RELEASE_READY_AWAITING_OWNER_APPROVAL。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "LAUNCH_EVALUATION_FAILED", error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/production-launch-v3
 * 建立 ProductionLaunchSnapshot
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

    const envManifest: EnvironmentManifest = {
      environmentId: "zeabur_prod_001",
      targetEnvironment: "production",
      platformProjectId: "proj_zeabur_main",
      platformServiceId: "srv_web_portal",
      deploymentBranch: "main",
      publicDomain: "https://research.openclaw.app",
      isVolumeAttached: true,
      dbIdentityHash: "db_hash_v3_main",
      isProductionDualVerified: true,
      createdAt: new Date().toISOString(),
    };

    const snapshot = buildProductionLaunchSnapshot({
      r01Snapshot,
      environmentManifest: envManifest,
      authorization: null,
    });

    return NextResponse.json({
      ok: true,
      data: {
        snapshot,
        note: "ProductionLaunchSnapshot 建立完成；未取得具體真人授權前保持受控狀態。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "LAUNCH_SNAPSHOT_FAILED", error: message }, { status: 500 });
  }
}
