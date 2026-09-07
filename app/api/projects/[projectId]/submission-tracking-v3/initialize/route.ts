import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { buildSubmissionWorkspaceFromStage18 } from "@/lib/submission-tracking-v3-service";
import { type FinalSubmissionPackageSnapshot } from "@/lib/final-submission-v3-contract";

const SUBMISSION_TRACKING_V3_INITIALIZE_CONTRACT_VERSION =
  "submission-tracking-v3-initialize/1.0.0" as const;

/**
 * POST /api/projects/:projectId/submission-tracking-v3/initialize
 * Spec docs/stage19/spec-v3-4.0.md §1-2
 *
 * Idempotently initializes the Submission Tracking workspace from Stage 18's
 * FinalSubmissionPackageSnapshot (body or DB stage_completion_snapshots
 * stage_id='final-compliance'). Gate: FINAL_PACKAGE_LOCKED_AND_HANDOFF_READY.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    let tenant;
    try {
      tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    } catch (error) {
      if (error instanceof ResearchStorageUnavailable) {
        return NextResponse.json({ ok: false, code: "STORAGE_UNAVAILABLE", error: "storage_unavailable" }, { status: 503 });
      }
      throw error;
    }
    if (!tenant) {
      return NextResponse.json({ ok: false, code: "PROJECT_FORBIDDEN", error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { packageSnapshot?: FinalSubmissionPackageSnapshot };

    let snapshot: FinalSubmissionPackageSnapshot | null = body.packageSnapshot ?? null;
    if (!snapshot) {
      const fcCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "final-compliance"
      );
      if (fcCompletion?.snapshotData) {
        snapshot = fcCompletion.snapshotData as FinalSubmissionPackageSnapshot;
      }
    }

    if (!snapshot || !snapshot.snapshotId) {
      return NextResponse.json(
        {
          ok: false,
          code: "FINAL_PACKAGE_HANDOFF_REQUIRED",
          error: "未找到第十八階段「最終合規與成果包」已保存之交接快照，請先完成成果包。",
          recoverable: true,
          nextAction: "GO_TO_FINAL_COMPLIANCE",
        },
        { status: 400 }
      );
    }

    if (snapshot.projectId !== projectId) {
      return NextResponse.json({ ok: false, code: "PROJECT_ID_MISMATCH", error: "快照專案 ID 與當前路由不符" }, { status: 403 });
    }

    // Upstream gate: FINAL_PACKAGE_LOCKED_AND_HANDOFF_READY (package must be locked)
    if (!snapshot.packageLocked || snapshot.decision === "NOT_READY") {
      return NextResponse.json(
        {
          ok: false,
          code: "PACKAGE_NOT_LOCKED",
          error: "上游成果包尚未 lock（FINAL_PACKAGE_LOCKED_AND_HANDOFF_READY 未達成），不得進入送件追蹤。",
          recoverable: true,
        },
        { status: 422 }
      );
    }

    const stWs = buildSubmissionWorkspaceFromStage18({ workspaceId, projectId, packageSnapshot: snapshot });

    return NextResponse.json({
      ok: true,
      data: {
        workspace: stWs,
        note:
          "U19 為人工導引送件追蹤（GUIDED_MANUAL），無通用投稿 API 時不臆造 endpoint；submission_execution_authorized=false。已有真實投稿 reference 可接入追蹤，不重置或重送。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "SUBMISSION_TRACKING_INITIALIZATION_FAILED", error: `第十九階段送件追蹤初始化失敗：${message}`, recoverable: true },
      { status: 500 }
    );
  }
}