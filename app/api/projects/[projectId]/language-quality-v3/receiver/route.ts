import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildStage18ReceiverState,
} from "@/lib/language-quality-v3-service";
import { type LanguageQualitySnapshot } from "@/lib/language-quality-v3-contract";

export const LANGUAGE_QUALITY_V3_RECEIVER_CONTRACT_VERSION =
  "language-quality-v3-receiver/1.0.0" as const;

/**
 * GET /api/projects/:projectId/language-quality-v3/receiver
 *
 * Spec §8: "U18 未建時提供真實可重開接收頁，保存語言版、scope、
 * constraints、QA 與待辦；保存成功導航失敗可重開原交接，不重新翻譯扣費。"
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
        "translation-polish"
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
          code: "STAGE17_NOT_COMPLETED",
          error: "第十八階段接收頁需要先完成第十七階段（語言品質），尚未找到對應交接快照。",
          recoverable: true,
          navigation: { backTo: "translation-polish", action: "initialize" },
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as LanguageQualitySnapshot;
    const receiver = buildStage18ReceiverState({ snapshot });

    return NextResponse.json({
      ok: true,
      data: {
        receiver,
        receiverContractVersion: LANGUAGE_QUALITY_V3_RECEIVER_CONTRACT_VERSION,
        sourceSnapshot: {
          snapshotId: snapshot.snapshotId,
          schemaVersion: snapshot.schemaVersion,
          decision: snapshot.decision,
          primaryGoal: snapshot.primaryGoal,
          scope: snapshot.scope,
          fatalFidelityIssueCount: snapshot.fatalFidelityIssueCount,
          openFidelityIssueCount: snapshot.openFidelityIssueCount,
          providerCapabilityRefs: snapshot.providerCapabilityRefs,
          limitations: snapshot.limitations,
        },
        navigation: {
          backToTranslationPolish: `/projects/${projectId}/language-center`,
        },
        warning: "快照僅攜帶 refs 與摘要；完整語言版本與對齊資料保留於 U17 工作區（最小化原則）。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "LANGUAGE_QUALITY_RECEIVER_FAILED", error: `第十八階段接收頁初始化失敗：${message}`, recoverable: true },
      { status: 500 }
    );
  }
}