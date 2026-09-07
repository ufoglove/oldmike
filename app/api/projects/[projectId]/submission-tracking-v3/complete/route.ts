import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  authorizeResubmission,
  buildSubmissionTrackingSnapshot,
  buildStage20ReceiverState,
} from "@/lib/submission-tracking-v3-service";
import { type SubmissionWorkOrder, type ExternalAttempt, type SubmissionEvent, type ReceiptVerification, type ExternalReview, type UpstreamRevisionRef } from "@/lib/submission-tracking-v3-contract";
import { type FinalSubmissionPackageSnapshot } from "@/lib/final-submission-v3-contract";

const SUBMISSION_TRACKING_V3_COMPLETE_CONTRACT_VERSION =
  "submission-tracking-v3-complete/1.0.0" as const;

/**
 * POST /api/projects/:projectId/submission-tracking-v3/complete
 *
 * 1. Resolves the Stage 18 package snapshot (body or DB).
 * 2. Builds the SubmissionTrackingSnapshot with real events/receipts/reviews.
 * 3. Optional R1 resubmission: requires new locked package + new authorization.
 * 4. Persists to stage_completion_snapshots (stage_id='submission-tracking').
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

    const body = (await request.json().catch(() => ({}))) as {
      packageSnapshot?: FinalSubmissionPackageSnapshot;
      workOrder?: SubmissionWorkOrder;
      attempts?: ExternalAttempt[];
      events?: SubmissionEvent[];
      receipts?: ReceiptVerification[];
      reviews?: ExternalReview[];
      upstreamRefs?: UpstreamRevisionRef[];
      decision?: any;
      rationale?: string;
      submissionExecutionAuthorized?: boolean;
      revisedPackageSnapshotId?: string;
      resubmissionAttempt?: ExternalAttempt;
      revisedPackageLocked?: boolean;
      newContentHash?: string;
    };

    let packageSnapshot: FinalSubmissionPackageSnapshot | null = body.packageSnapshot ?? null;
    if (!packageSnapshot) {
      const fcCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "final-compliance"
      );
      if (fcCompletion?.snapshotData) {
        packageSnapshot = fcCompletion.snapshotData as FinalSubmissionPackageSnapshot;
      }
    }
    if (!packageSnapshot || !packageSnapshot.snapshotId) {
      return NextResponse.json(
        { ok: false, code: "FINAL_PACKAGE_HANDOFF_REQUIRED", error: "無法解析第十八階段交接快照。" },
        { status: 400 }
      );
    }

    const workOrder: SubmissionWorkOrder = body.workOrder ?? {
      workOrderId: `wst_${projectId}`,
      projectId,
      packageSnapshotId: packageSnapshot.snapshotId,
      documentPurpose: packageSnapshot.documentPurpose,
      route: (packageSnapshot.primaryGoal === "JOURNAL_SCI_SSCI" ? "JOURNAL_SCI_SSCI" : packageSnapshot.primaryGoal === "NSTC_GENERAL" ? "NSTC_GENERAL" : "MOE_TPR") as any,
      target: "目標（依已確認）",
      round: 1,
      status: body.decision && body.decision !== "NOT_DECISIONED" ? "DECISIONED" : "UNDER_REVIEW",
    };

    const attempts = body.attempts ?? [];
    const events = body.events ?? [];
    const receipts = body.receipts ?? [];
    const reviews = body.reviews ?? [];
    const upstreamRefs = body.upstreamRefs ?? [];

    // Optional R1 resubmission
    let revisedPackageSnapshotId = body.revisedPackageSnapshotId;
    let resubmissionAttemptId: string | undefined = body.resubmissionAttempt?.attemptId;
    if (body.resubmissionAttempt || (body.newContentHash && body.revisedPackageLocked)) {
      const auth = authorizeResubmission({
        workOrder,
        revisedPackageLocked: body.revisedPackageLocked === true,
        newContentHash: body.newContentHash ?? "",
        authorizedBy: authenticated.session.user.id,
      });
      if (!auth.ok) {
        return NextResponse.json({ ok: false, code: auth.code, error: auth.reason, recoverable: true }, { status: 422 });
      }
      resubmissionAttemptId = auth.attempt.attemptId;
      revisedPackageSnapshotId = revisedPackageSnapshotId ?? `revised_${packageSnapshot.snapshotId}`;
    }

    const trackingSnapshot = buildSubmissionTrackingSnapshot({
      workspaceId,
      projectId,
      workOrderId: workOrder.workOrderId,
      sourcePackageSnapshot: packageSnapshot,
      workOrder,
      attempts,
      events,
      receipts,
      reviews,
      upstreamRefs,
      decision: body.decision ?? "NOT_DECISIONED",
      rationale: body.rationale ?? "等待真實官方來源；審查中屬正常狀態，不為亮燈捏造接受。",
      submissionExecutionAuthorized: body.submissionExecutionAuthorized === true,
      revisedPackageSnapshotId,
      resubmissionAttemptId,
    });
    const stage20Receiver = buildStage20ReceiverState({ snapshot: trackingSnapshot });

    let completionRecordId: string | null = null;
    let persistenceStatus: "PERSISTED" | "STORAGE_UNAVAILABLE" = "STORAGE_UNAVAILABLE";
    try {
      const completionRecord = await StageOperationRepository.saveCompletionSnapshot({
        workspaceId: tenant.workspaceId,
        projectId,
        stageId: "submission-tracking",
        snapshotData: trackingSnapshot,
        lockManifest: [],
        handoffLimitations: trackingSnapshot.limitations,
        downstreamOpenRequirements: trackingSnapshot.unresolvedIssueRefs,
        nextStageId: trackingSnapshot.nextStageId,
        userId: authenticated.session.user.id,
        idempotencyKey: `comp_st_${trackingSnapshot.snapshotId}`,
      });
      completionRecordId = completionRecord.id;
      persistenceStatus = "PERSISTED";
    } catch (error) {
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (!isStorageError) throw error;
      persistenceStatus = "STORAGE_UNAVAILABLE";
    }

    return NextResponse.json({
      ok: true,
      data: {
        snapshot: trackingSnapshot,
        stage20Receiver,
        persistence: {
          status: persistenceStatus,
          stageCompletionSnapshotId: completionRecordId,
          stageId: "submission-tracking",
          nextStageId: trackingSnapshot.nextStageId,
        },
        note: "沒有真實接受/核定，只能保存準備；U20 未建也提供可重開接收頁，不跳空白頁。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "SUBMISSION_TRACKING_COMPLETION_FAILED", error: `完成第十九階段交接快照失敗：${message}`, recoverable: true },
      { status: 500 }
    );
  }
}