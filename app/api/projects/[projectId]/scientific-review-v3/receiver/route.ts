import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildStage17ReceiverState,
} from "@/lib/scientific-review-v3-service";
import { type ScientificReviewSnapshot, type ScientificFinding } from "@/lib/scientific-review-v3-contract";

const SCIENTIFIC_REVIEW_V3_RECEIVER_CONTRACT_VERSION =
  "scientific-review-v3-receiver/1.0.0" as const;

/**
 * GET /api/projects/:projectId/scientific-review-v3/receiver
 *
 * Spec §7: "下一模組未建時提供真實接收頁，不跳空白頁；保存成功導航失敗
 * 可重開原交接，不重跑 AI。"
 *
 * Returns Stage17ReceiverState built from the latest persisted
 * ScientificReviewSnapshot. Non-empty fallback for Stage 17 (translation & polish).
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
        "scientific-review"
      );
    } catch (error) {
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (isStorageError) {
        return NextResponse.json(
          { ok: false, code: "STORAGE_UNAVAILABLE", error: "stage_operation_storage_unavailable", recoverable: true },
          { status: 503 }
        );
      }
      throw error;
    }

    if (!completionRecord?.snapshotData) {
      return NextResponse.json(
        {
          ok: false,
          code: "STAGE16_NOT_COMPLETED",
          error: "第十七階段接收頁需要先完成第十六階段（科學審查），尚未找到對應交接快照。",
          recoverable: true,
          navigation: { backTo: "scientific-review", action: "initialize" },
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as ScientificReviewSnapshot;

    // We persist finding-level detail only as refs/hashes in the snapshot per
    // spec §7 (只帶 ID／version／hash); for the receiver we do a faithful
    // metadata rendering. Findings are re-retrievable from the U16 workspace.
    const placeholderFindings: ScientificFinding[] = [];

    const receiver = buildStage17ReceiverState({ snapshot, findings: placeholderFindings });

    return NextResponse.json({
      ok: true,
      data: {
        receiver,
        receiverContractVersion: SCIENTIFIC_REVIEW_V3_RECEIVER_CONTRACT_VERSION,
        sourceSnapshot: {
          snapshotId: snapshot.snapshotId,
          schemaVersion: snapshot.schemaVersion,
          decision: snapshot.decision,
          decisionRationale: snapshot.decisionRationale,
          primaryGoal: snapshot.primaryGoal,
          reviewRound: snapshot.reviewRound,
          openFindingCount: snapshot.openFindingRefs.length,
          blockerFindingCount: snapshot.blockerFindingRefs.length,
          meaningConstraintCount: snapshot.meaningConstraintRefs.length,
          scope: snapshot.scope,
          limitations: snapshot.limitations,
        },
        navigation: {
          backToScientificReview: `/projects/${projectId}/scientific-review`,
        },
        warning:
          "快照僅攜帶 finding 引用與 hash（不內嵌完整 finding 內容，符合 §7 最小化）；完整 findings 可在 U16 工作區回看。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "SCIENTIFIC_REVIEW_V3_RECEIVER_FAILED",
        error: `第十七階段接收頁初始化失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}