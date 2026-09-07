import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildStage16ReceiverState,
  buildManuscriptEvidencePackage,
} from "@/lib/manuscript-writing-service";
import { type ManuscriptWritingSnapshot } from "@/lib/manuscript-writing-contract";
import { type AnalysisResultsSnapshot } from "@/lib/analysis-execution-contract";

const STAGE16_RECEIVER_CONTRACT_VERSION =
  "stage16-receiver/1.0.0" as const;

/**
 * GET /api/projects/:projectId/manuscript-writing/receiver
 *
 * Spec §30: "U16 若尚未建置，本輪提供可重開 receiver，顯示稿件、模式、
 * 範圍、QA、來源與待辦，能返回 U15，不生成假審查與空白頁。"
 *
 * Returns a Stage16ReceiverState built from the latest persisted
 * ManuscriptWritingSnapshot. The receiver page can use this to render a
 * non-empty fallback when Stage 16 has not been fully built.
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
        "results-writing"
      );
    } catch (error) {
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (isStorageError) {
        return NextResponse.json(
          {
            ok: false,
            code: "STORAGE_UNAVAILABLE",
            error: "stage_operation_storage_unavailable",
            recoverable: true,
            navigation: { backTo: "manuscript-writing", action: "initialize" },
          },
          { status: 503 }
        );
      }
      throw error;
    }

    if (!completionRecord?.snapshotData) {
      return NextResponse.json(
        {
          ok: false,
          code: "STAGE15_NOT_COMPLETED",
          error: "第十六階段接收頁需要先完成第十五階段（全文寫作），尚未找到對應交接快照。",
          recoverable: true,
          navigation: {
            backTo: "manuscript-writing",
            action: "initialize",
          },
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as ManuscriptWritingSnapshot;

    // Build a minimal workspace view from the snapshot for receiver construction.
    // The full section bodies are NOT carried in the persisted snapshot (we
    // persist refs/hashes per spec §30); the receiver therefore renders
    // metadata + manifest only and links back to /manuscript-writing to view
    // the live workspace. This is honest per spec §28 ("未支援格式如實標示").
    const arCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
      tenant.workspaceId,
      projectId,
      "analysis-execution"
    );
    const analysisSnapshot = (arCompletion?.snapshotData as AnalysisResultsSnapshot | undefined) ?? null;

    let evidencePackage;
    if (analysisSnapshot) {
      evidencePackage = buildManuscriptEvidencePackage({
        workspace: {
          workspaceId: snapshot.workspaceId,
          projectId: snapshot.projectId,
          manuscriptId: "",
          currentRevision: snapshot.manuscriptRevision,
          sourceAnalysisSnapshotId: snapshot.sourceAnalysisSnapshotId,
          primaryGoal: snapshot.primaryGoal,
          fundingIntent: snapshot.fundingIntent,
          publicationIntent: snapshot.publicationIntent,
          writingMode: snapshot.scope.writingMode,
          workOrder: {
            workOrderId: snapshot.workOrderId,
            projectId: snapshot.projectId,
            manuscriptId: "",
            targetJournalCategory: "TBD",
            writingMode: snapshot.scope.writingMode,
            formalWritingAllowed: true,
            includedRqRefs: [],
            authorizedAuthorshipRoles: [],
            budgetWordLimit: 0,
            status: "DRAFT_READY_FOR_REVIEW",
          },
          storyboardRows: [],
          sections: [],
          claimEvidenceLinks: [],
          embeddedTableRefs: snapshot.embeddedTableRefs,
          embeddedFigureRefs: snapshot.embeddedFigureRefs,
          downstreamRequirements: snapshot.downstreamRequirements,
          decision: (snapshot.decision as "MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW" | "MANUSCRIPT_CORE_DRAFT_ASSEMBLED" | "WRITING_SCOPE_AND_SOURCES_READY") ?? "MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW",
          decisionRationale: snapshot.decisionRationale,
          reviewState: "HUMAN_REVIEW_PENDING",
          isLocked: true,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.createdAt,
        },
        analysisSnapshot,
      });
    }

    const receiver = evidencePackage
      ? buildStage16ReceiverState({
          workspace: {
            workspaceId: snapshot.workspaceId,
            projectId: snapshot.projectId,
            manuscriptId: "",
            currentRevision: snapshot.manuscriptRevision,
            sourceAnalysisSnapshotId: snapshot.sourceAnalysisSnapshotId,
            primaryGoal: snapshot.primaryGoal,
            fundingIntent: snapshot.fundingIntent,
            publicationIntent: snapshot.publicationIntent,
            writingMode: snapshot.scope.writingMode,
            workOrder: {
              workOrderId: snapshot.workOrderId,
              projectId: snapshot.projectId,
              manuscriptId: "",
              targetJournalCategory: "TBD",
              writingMode: snapshot.scope.writingMode,
              formalWritingAllowed: true,
              includedRqRefs: [],
              authorizedAuthorshipRoles: [],
              budgetWordLimit: 0,
              status: "DRAFT_READY_FOR_REVIEW",
            },
            storyboardRows: [],
            sections: [],
            claimEvidenceLinks: [],
            embeddedTableRefs: snapshot.embeddedTableRefs,
            embeddedFigureRefs: snapshot.embeddedFigureRefs,
            downstreamRequirements: snapshot.downstreamRequirements,
            decision: (snapshot.decision as "MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW" | "MANUSCRIPT_CORE_DRAFT_ASSEMBLED" | "WRITING_SCOPE_AND_SOURCES_READY") ?? "MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW",
            decisionRationale: snapshot.decisionRationale,
            reviewState: "HUMAN_REVIEW_PENDING",
            isLocked: true,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.createdAt,
          },
          manuscriptWritingSnapshot: snapshot,
          evidencePackage,
        })
      : null;

    return NextResponse.json({
      ok: true,
      data: {
        receiver,
        receiverContractVersion: STAGE16_RECEIVER_CONTRACT_VERSION,
        sourceSnapshot: snapshot,
        navigation: {
          backToManuscriptWriting: `/projects/${projectId}/manuscript`,
        },
        warnings: evidencePackage
          ? []
          : ["找不到對應的分析結果快照，僅顯示 ManuscriptWritingSnapshot 摘要；請先完成 Stage 14 以取得 Evidence Package。"],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "STAGE16_RECEIVER_FAILED",
        error: `第十六階段接收頁初始化失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
