import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildScientificReviewWorkspaceFromStage15,
  runScientificMechanicalQa,
} from "@/lib/scientific-review-v3-service";
import { type ManuscriptWritingSnapshot } from "@/lib/manuscript-writing-contract";

const SCIENTIFIC_REVIEW_V3_INITIALIZE_CONTRACT_VERSION =
  "scientific-review-v3-initialize/1.0.0" as const;

/**
 * POST /api/projects/:projectId/scientific-review-v3/initialize
 * Spec docs/stage16/spec-v3-4.0.md §1
 *
 * Idempotently initializes the Scientific Review workspace from Stage 15's
 * ManuscriptWritingSnapshot. Source priority: body snapshot → DB
 * (stage_completion_snapshots stage_id='results-writing').
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

    const body = (await request.json().catch(() => ({}))) as { manuscriptWritingSnapshot?: ManuscriptWritingSnapshot };

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
        {
          ok: false,
          code: "MANUSCRIPT_HANDOFF_REQUIRED",
          error: "未找到第十五階段「全文寫作」已保存之交接快照，請先完成科學內容初稿。",
          recoverable: true,
          nextAction: "GO_TO_MANUSCRIPT_WRITING",
        },
        { status: 400 }
      );
    }

    if (snapshot.projectId !== projectId) {
      return NextResponse.json(
        { ok: false, code: "PROJECT_ID_MISMATCH", error: "快照專案 ID 與當前路由不符" },
        { status: 403 }
      );
    }

    // Upstream gate mapping: accept MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW
    // or PARTIAL_EVIDENCE_DRAFT (review_scope carried separately); do not require
    // a fixed v1 string. If snapshot says planning-only, block formal review.
    const decision = snapshot.decision ?? "";
    const planningOnly = decision === "WRITING_SCOPE_AND_SOURCES_READY" || decision === "PLANNING_OUTLINE";
    if (planningOnly) {
      return NextResponse.json(
        {
          ok: false,
          code: "FORMAL_WRITING_NOT_ALLOWED",
          error: "上游為規劃模式，尚無科學內容初稿可審查；請先完成正式或部分證據初稿。",
          recoverable: true,
        },
        { status: 422 }
      );
    }

    const workspace = buildScientificReviewWorkspaceFromStage15({
      workspaceId,
      projectId,
      manuscriptWritingSnapshot: snapshot,
    });

    const mechanicalQa = runScientificMechanicalQa({ snapshot });

    return NextResponse.json({
      ok: true,
      data: {
        workspace,
        sourceManuscriptWritingSnapshotId: snapshot.snapshotId,
        sourceDecision: snapshot.decision,
        mechanicalQa,
        primaryGoal: workspace.primaryGoal,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "SCIENTIFIC_REVIEW_V3_INITIALIZATION_FAILED",
        error: `第十六階段科學審查初始化失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}