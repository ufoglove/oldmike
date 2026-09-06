import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildAuthorResponseMatrix,
  decideReReview,
  buildScientificReviewSnapshot,
  buildStage17ReceiverState,
  runScientificMechanicalQa,
  buildMeaningConstraints,
  checkMeaningConstraintsHeld,
} from "@/lib/scientific-review-v3-service";
import {
  type ScientificFinding,
  type RevisionProposal,
  type UpstreamReviewRequest,
} from "@/lib/scientific-review-v3-contract";
import { type ManuscriptWritingSnapshot } from "@/lib/manuscript-writing-contract";

export const SCIENTIFIC_REVIEW_V3_COMPLETE_CONTRACT_VERSION =
  "scientific-review-v3-complete/1.0.0" as const;

/**
 * POST /api/projects/:projectId/scientific-review-v3/complete
 *
 * 1. Re-verifies mechanical QA on the source snapshot.
 * 2. Builds the Author Response Matrix (internal) with disagreement rights.
 * 3. Runs the re-review decision (round cap keeps unresolved, no forced PASS).
 * 4. Verifies Scientific Meaning Constraints against revised text.
 * 5. Builds ScientificReviewSnapshot + Stage 17 receiver state.
 * 6. Persists to stage_completion_snapshots (stage_id='scientific-review').
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
      manuscriptWritingSnapshot?: ManuscriptWritingSnapshot;
      findings?: ScientificFinding[];
      revisions?: RevisionProposal[];
      upstreamRequests?: UpstreamReviewRequest[];
      revisedTextBySection?: Record<string, string>;
      reviewRound?: number;
      maxRounds?: number;
    };

    let snapshot: ManuscriptWritingSnapshot | null = body.manuscriptWritingSnapshot ?? null;
    if (!snapshot) {
      const mwCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "results-writing"
      );
      if (mwCompletion?.snapshotData) {
        snapshot = mwCompletion.snapshotData as ManuscriptWritingSnapshot;
      }
    }
    if (!snapshot || !snapshot.snapshotId) {
      return NextResponse.json(
        { ok: false, code: "MANUSCRIPT_HANDOFF_REQUIRED", error: "無法解析第十五階段交接快照。" },
        { status: 400 }
      );
    }

    const findings = body.findings ?? [];
    const revisions = body.revisions ?? [];
    const upstreamRequests = body.upstreamRequests ?? [];
    const revisedTextBySection = body.revisedTextBySection ?? {};
    const reviewRound = Math.max(1, body.reviewRound ?? 1);
    const maxRounds = Math.max(1, body.maxRounds ?? 3);

    // 1. Mechanical QA
    const mechanicalQa = runScientificMechanicalQa({ snapshot });

    // 2. Author Response Matrix
    const matrix = buildAuthorResponseMatrix({ findings });

    // 3. Re-review decision
    const reReview = decideReReview({ findings, round: reviewRound, maxRounds });

    // 4. Meaning constraints
    const constraints = buildMeaningConstraints({ snapshot });
    const meaningCheck = checkMeaningConstraintsHeld({ constraints, revisedTextBySection });
    if (!meaningCheck.held) {
      // Non-blocking for review completion (spec §6: 保留未解問題，不強制 PASS),
      // but blocks full SCIENTIFICALLY_APPROVED unless all constraints held.
      if (reReview.decision === "SCIENTIFICALLY_APPROVED" && !meaningCheck.held) {
        return NextResponse.json(
          {
            ok: false,
            code: "MEANING_CONSTRAINTS_VIOLATED",
            error: "Scientific Meaning Constraints 未全部滿足（保護值在修訂後段落缺失或改變），不得放行為 SCIENTIFICALLY_APPROVED。",
            violations: meaningCheck.violations,
            recoverable: true,
          },
          { status: 422 }
        );
      }
    }

    const workspaceView = {
      workspaceId: `ws_sr_${projectId}`,
      projectId,
      reviewRunId: `srr_v3_${projectId}_complete`,
      workOrder: {
        workOrderId: `wrev_${projectId}`,
        projectId,
        manuscriptId: snapshot.scope.workingTitleZh || projectId,
        reviewRound,
        coverageSections: ["TITLE_ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"],
        coverageGoals: [snapshot.primaryGoal],
        budgetFindingLimit: 12,
        status: reReview.decision === "SCIENTIFICALLY_APPROVED" ? ("SCIENTIFICALLY_APPROVED" as const) : ("RE_REVIEW_REQUIRED" as const),
      },
    };

    const reviewSnapshot = buildScientificReviewSnapshot({
      workspaceId: workspaceView.workspaceId,
      projectId,
      reviewRunId: workspaceView.reviewRunId,
      workOrder: workspaceView.workOrder,
      sourceSnapshot: snapshot,
      findings,
      revisions,
      reReviewDecision: reReview.decision,
      rationale: reReview.rationale,
      constraints,
      upstreamRequests,
      authorResponseMatrixRef: matrix.matrixRef,
      mechanicalQa,
      reviewer2Provided: findings.some((f) => f.reviewerRole === "REVIEWER_2_CHALLENGER"),
    });

    const stage17Receiver = buildStage17ReceiverState({ snapshot: reviewSnapshot, findings });

    // 5. Persist
    let completionRecordId: string | null = null;
    let persistenceStatus: "PERSISTED" | "STORAGE_UNAVAILABLE" = "STORAGE_UNAVAILABLE";
    try {
      const completionRecord = await StageOperationRepository.saveCompletionSnapshot({
        workspaceId: tenant.workspaceId,
        projectId,
        stageId: "scientific-review",
        snapshotData: reviewSnapshot,
        lockManifest: [],
        handoffLimitations: reviewSnapshot.limitations,
        downstreamOpenRequirements: reviewSnapshot.openFindingRefs,
        nextStageId: reviewSnapshot.nextStageId,
        userId: authenticated.session.user.id,
        idempotencyKey: `comp_sr_${reviewSnapshot.snapshotId}`,
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
        snapshot: reviewSnapshot,
        authorResponseMatrix: matrix,
        reReviewDecision: reReview,
        meaningConstraintsCheck: meaningCheck,
        stage17Receiver,
        persistence: {
          status: persistenceStatus,
          stageCompletionSnapshotId: completionRecordId,
          stageId: "scientific-review",
          nextStageId: reviewSnapshot.nextStageId,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "SCIENTIFIC_REVIEW_V3_COMPLETION_FAILED",
        error: `完成第十六階段交接快照失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}