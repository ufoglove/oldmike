import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { buildStage19ReceiverState } from "@/lib/final-submission-v3-service";
import { type FinalSubmissionPackageSnapshot } from "@/lib/final-submission-v3-contract";

const FINAL_SUBMISSION_V3_RECEIVER_CONTRACT_VERSION =
  "final-submission-v3-receiver/1.0.0" as const;

/**
 * GET /api/projects/:projectId/final-submission-v3/receiver
 *
 * Spec §7: "U19 未建時提供可重開 receiver：files、target、manifest、
 * 就緒種類、規則與待辦。保存成功跳轉失敗可重開原交接。"
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
        "final-compliance"
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
          code: "STAGE18_NOT_COMPLETED",
          error: "第十九階段接收頁需要先完成第十八階段（最終合規與成果包），尚未找到對應交接快照。",
          recoverable: true,
          navigation: { backTo: "final-compliance", action: "initialize" },
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as FinalSubmissionPackageSnapshot;
    const receiver = buildStage19ReceiverState({ snapshot });

    return NextResponse.json({
      ok: true,
      data: {
        receiver,
        receiverContractVersion: FINAL_SUBMISSION_V3_RECEIVER_CONTRACT_VERSION,
        sourceSnapshot: {
          snapshotId: snapshot.snapshotId,
          schemaVersion: snapshot.schemaVersion,
          decision: snapshot.decision,
          readiness: snapshot.decision,
          primaryGoal: snapshot.primaryGoal,
          route: snapshot.route,
          documentCount: snapshot.documents.length,
          packageLocked: snapshot.packageLocked,
          submissionExecutionAuthorized: snapshot.submissionExecutionAuthorized,
          pendingAuthorApprovals: snapshot.pendingAuthorApprovals,
          limitations: snapshot.limitations,
        },
        navigation: {
          backToFinalCompliance: `/projects/${projectId}/submission-gate`,
        },
        warning: "快照僅攜帶 refs 與摘要；完整文件 bytes 保留於 U18 工作區（最小化原則）。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "FINAL_SUBMISSION_RECEIVER_FAILED", error: `第十九階段接收頁初始化失敗：${message}`, recoverable: true },
      { status: 500 }
    );
  }
}