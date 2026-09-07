import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildManuscriptWorkspaceFromStage14,
} from "@/lib/manuscript-writing-service";
import { type AnalysisResultsSnapshot } from "@/lib/analysis-execution-contract";

const MANUSCRIPT_WRITING_INITIALIZE_CONTRACT_VERSION =
  "manuscript-writing-initialize/1.0.0" as const;

/**
 * POST /api/projects/:projectId/manuscript-writing/initialize
 * Spec v3.4.0 (V3-U15-FULL) §3, §4, §25
 *
 * Idempotently initializes or restores a ManuscriptWorkspace from Stage 14's
 * AnalysisResultsSnapshot. Does NOT rerun paid LLM jobs if already baselined.
 *
 * Source priority:
 *   1. Body-supplied analysisSnapshot (caller passes the snapshot explicitly)
 *   2. Latest stage_completion_snapshots row for stage_id='analysis-execution'
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    // Auth + tenant resolution (consistent with neighbouring stages)
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

    // 1. Resolve the Stage 14 AnalysisResultsSnapshot
    const body = (await request.json().catch(() => ({}))) as {
      analysisSnapshot?: AnalysisResultsSnapshot;
      workspaceId?: string;
    };

    let analysisSnapshot: AnalysisResultsSnapshot | null = body.analysisSnapshot ?? null;
    if (!analysisSnapshot) {
      const arCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "analysis-execution"
      );
      if (arCompletion?.snapshotData) {
        analysisSnapshot = arCompletion.snapshotData as AnalysisResultsSnapshot;
      }
    }

    if (!analysisSnapshot || !analysisSnapshot.snapshotId) {
      return NextResponse.json(
        {
          ok: false,
          code: "ANALYSIS_HANDOFF_REQUIRED",
          error: "未找到第十四階段「分析實驗室」已保存之交接快照，請先完成分析結果與圖表。",
          recoverable: true,
          nextAction: "GO_TO_ANALYSIS_EXECUTION",
        },
        { status: 400 }
      );
    }

    if (analysisSnapshot.projectId !== projectId) {
      return NextResponse.json(
        { ok: false, code: "PROJECT_ID_MISMATCH", error: "快照專案 ID 與當前路由不符" },
        { status: 403 }
      );
    }

    // 2. Build or restore Manuscript Workspace with zero re-entry
    const effectiveWorkspaceId = body.workspaceId || `ws_ms_${projectId}`;
    const workspace = buildManuscriptWorkspaceFromStage14({
      workspaceId: effectiveWorkspaceId,
      projectId,
      analysisSnapshot,
      userId: authenticated.session.user.id,
    });

    return NextResponse.json({
      ok: true,
      data: {
        workspace,
        sourceAnalysisSnapshotId: analysisSnapshot.snapshotId,
        primaryGoal: workspace.primaryGoal,
        writingMode: workspace.writingMode,
        decision: workspace.decision,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "MANUSCRIPT_WRITING_INITIALIZATION_FAILED",
        error: `第十五階段全文寫作初始化失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
