import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { buildStage20ReceiverState } from "@/lib/submission-tracking-v3-service";
import { type SubmissionTrackingSnapshot } from "@/lib/submission-tracking-v3-contract";

export const SUBMISSION_TRACKING_V3_RECEIVER_CONTRACT_VERSION =
  "submission-tracking-v3-receiver/1.0.0" as const;

/**
 * GET /api/projects/:projectId/submission-tracking-v3/receiver
 *
 * Spec §9: "U20 未建也要可重開接收頁，不跳空白頁。" Shows decision, round,
 * events/reviews counts, guards, and next steps based on real facts.
 */
export async function GET(
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

    let completionRecord;
    try {
      completionRecord = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "submission-tracking"
      );
    } catch (error) {
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (isStorageError) {
        return NextResponse.json({ ok: false, code: "STORAGE_UNAVAILABLE", error: "stage_operation_storage_unavailable", recoverable: true }, { status: 503 });
      }
      throw error;
    }

    if (!completionRecord?.snapshotData) {
      return NextResponse.json(
        {
          ok: false,
          code: "STAGE19_NOT_COMPLETED",
          error: "第二十階段接收頁需要先完成第十九階段（送件追蹤），尚未找到對應交接快照。",
          recoverable: true,
          navigation: { backTo: "submission-tracking", action: "initialize" },
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as SubmissionTrackingSnapshot;
    const receiver = buildStage20ReceiverState({ snapshot });

    return NextResponse.json({
      ok: true,
      data: {
        receiver,
        receiverContractVersion: SUBMISSION_TRACKING_V3_RECEIVER_CONTRACT_VERSION,
        sourceSnapshot: {
          snapshotId: snapshot.snapshotId,
          schemaVersion: snapshot.schemaVersion,
          decision: snapshot.decision,
          primaryGoal: snapshot.primaryGoal,
          round: snapshot.workOrder.round,
          eventCount: snapshot.events.length,
          reviewCount: snapshot.externalReviews.length,
          activeSubmissionGuard: snapshot.activeSubmissionGuard,
          submissionExecutionAuthorized: snapshot.submissionExecutionAuthorized,
          limitations: snapshot.limitations,
        },
        navigation: {
          backToSubmissionTracking: `/projects/${projectId}/submission-gate`,
        },
        warning: "快照僅攜帶 refs 與摘要；完整 events/receipts/reviews 保留於 U19 工作區（最小化原則）。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "SUBMISSION_TRACKING_RECEIVER_FAILED", error: `第二十階段接收頁初始化失敗：${message}`, recoverable: true },
      { status: 500 }
    );
  }
}