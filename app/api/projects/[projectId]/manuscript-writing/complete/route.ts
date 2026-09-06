import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  runManuscriptWritingGateCheck,
  buildManuscriptEvidencePackage,
  buildManuscriptWritingSnapshot,
  buildStage16ReceiverState,
} from "@/lib/manuscript-writing-service";
import { type ManuscriptWorkspace } from "@/lib/manuscript-writing-contract";
import { type AnalysisResultsSnapshot } from "@/lib/analysis-execution-contract";

export const MANUSCRIPT_WRITING_COMPLETE_CONTRACT_VERSION =
  "manuscript-writing-complete/1.0.0" as const;

/**
 * POST /api/projects/:projectId/manuscript-writing/complete
 * Spec v3.4.0 (V3-U15-FULL) §29, §30
 *
 * 1. Validates the workspace against the manuscript-writing gate.
 * 2. Resolves the source AnalysisResultsSnapshot (body or DB).
 * 3. Builds the ManuscriptEvidencePackage (spec §30) + ManuscriptWritingSnapshot.
 * 4. Builds the Stage 16 receiver state (non-empty fallback per spec §30).
 * 5. Atomically persists the snapshot to stage_completion_snapshots with
 *    idempotency key derived from snapshot id.
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
      workspace?: ManuscriptWorkspace;
      analysisSnapshot?: AnalysisResultsSnapshot;
    };
    const { workspace, analysisSnapshot } = body;

    if (!workspace) {
      return NextResponse.json(
        { ok: false, code: "MISSING_WORKSPACE", error: "必須提供完整的 ManuscriptWorkspace" },
        { status: 400 }
      );
    }
    if (workspace.projectId !== projectId) {
      return NextResponse.json(
        { ok: false, code: "PROJECT_ID_MISMATCH", error: "工作區專案 ID 與當前路由不符" },
        { status: 403 }
      );
    }

    // 1. Gate verification
    const issues = runManuscriptWritingGateCheck(workspace);
    const fatalIssues = issues.filter((i) => i.severity === "FATAL");

    if (fatalIssues.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "FATAL_MANUSCRIPT_GATE_ERRORS",
          error: "存在重大數值或寫作違規（如未綁定事實或 Discussion 出現幽靈數字），無法完成交接",
          fatalIssues,
          recoverable: true,
        },
        { status: 422 }
      );
    }

    // 2. Resolve source AnalysisResultsSnapshot (body or DB)
    let resolvedAnalysisSnapshot: AnalysisResultsSnapshot | null = analysisSnapshot ?? null;
    if (!resolvedAnalysisSnapshot) {
      const arCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "analysis-execution"
      );
      if (arCompletion?.snapshotData) {
        resolvedAnalysisSnapshot = arCompletion.snapshotData as AnalysisResultsSnapshot;
      }
    }
    if (!resolvedAnalysisSnapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "ANALYSIS_HANDOFF_REQUIRED",
          error: "無法解析對應的第十四階段 AnalysisResultsSnapshot，無法建立不可變交接。",
          recoverable: false,
        },
        { status: 400 }
      );
    }

    // 3. Build evidence package, snapshot, Stage 16 receiver state
    const evidencePackage = buildManuscriptEvidencePackage({
      workspace,
      analysisSnapshot: resolvedAnalysisSnapshot,
    });
    const snapshot = buildManuscriptWritingSnapshot({
      workspace,
      analysisSnapshot: resolvedAnalysisSnapshot,
      evidencePackage,
    });
    const stage16Receiver = buildStage16ReceiverState({
      workspace,
      manuscriptWritingSnapshot: snapshot,
      evidencePackage,
    });

    // 4. Atomically persist snapshot to stage_completion_snapshots
    let completionRecordId: string | null = null;
    let persistenceStatus: "PERSISTED" | "STORAGE_UNAVAILABLE" = "STORAGE_UNAVAILABLE";
    try {
      const completionRecord = await StageOperationRepository.saveCompletionSnapshot({
        workspaceId: tenant.workspaceId,
        projectId,
        stageId: "results-writing",
        snapshotData: snapshot,
        lockManifest: workspace.sections.map((s) => ({
          sectionId: s.sectionId,
          isLocked: s.isLocked,
        })),
        handoffLimitations: snapshot.limitations,
        downstreamOpenRequirements: snapshot.downstreamRequirements.map((r) => r.title),
        nextStageId: snapshot.nextStageId,
        userId: authenticated.session.user.id,
        idempotencyKey: `comp_mw_${snapshot.snapshotId}`,
      });
      completionRecordId = completionRecord.id;
      persistenceStatus = "PERSISTED";
    } catch (error) {
      // Snapshot persistence is a non-blocking warning when DB is unavailable in
      // isolated/local development — the snapshot still ships to Stage 16 as
      // part of the response so navigation is non-empty. The persistence status
      // is reported honestly per spec §28 ("不生成假下載或假成功").
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (!isStorageError) throw error;
      persistenceStatus = "STORAGE_UNAVAILABLE";
    }

    return NextResponse.json({
      ok: true,
      data: {
        snapshot,
        evidencePackage,
        stage16Receiver,
        persistence: {
          status: persistenceStatus,
          stageCompletionSnapshotId: completionRecordId,
          stageId: "results-writing",
          nextStageId: snapshot.nextStageId,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "MANUSCRIPT_WRITING_COMPLETION_FAILED",
        error: `完成第十五階段交接快照失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
