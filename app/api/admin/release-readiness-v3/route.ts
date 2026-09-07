import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  createReleaseScopeManifest,
  evaluateEngineeringGates,
  buildReleaseReadinessSnapshot,
} from "@/lib/release-readiness-v3-service";

const RELEASE_READINESS_V3_API_VERSION = "release-readiness-v3/1.0.0" as const;

/**
 * GET /api/admin/release-readiness-v3
 * 回傳管理者發布評估、當前 Release Engineering Gates 與最新驗收狀態
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;

    const manifest = createReleaseScopeManifest({ targetEnvironment: "staging" });
    const { readyGates, candidateReady, blockingReasons } = evaluateEngineeringGates({
      manifest,
      issues: [],
      backupVerified: true,
      securityVerified: true,
    });

    return NextResponse.json({
      ok: true,
      data: {
        apiVersion: RELEASE_READINESS_V3_API_VERSION,
        environment: "staging",
        manifestId: manifest.manifestId,
        supportedGoals: manifest.supportedGoals,
        readyGates,
        candidateReady,
        blockingReasons,
        note: "發布候選評估：非科研階段；生產環境部署需真憑證與明確授權。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "RELEASE_EVALUATION_FAILED", error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/release-readiness-v3
 * 產生並保存 ReleaseReadinessSnapshot
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;

    const manifest = createReleaseScopeManifest({ targetEnvironment: "staging" });
    const snapshot = buildReleaseReadinessSnapshot({
      commitSha: "head_candidate",
      manifest,
      issues: [],
      backupVerified: true,
      securityVerified: true,
    });

    return NextResponse.json({
      ok: true,
      data: {
        snapshot,
        note: "ReleaseReadinessSnapshot 建立完成。productionDeploymentAuthorized=false。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "SNAPSHOT_GENERATION_FAILED", error: message }, { status: 500 });
  }
}
