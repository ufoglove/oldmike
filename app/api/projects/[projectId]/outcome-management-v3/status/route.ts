import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { type OutcomeManagementSnapshot } from "@/lib/outcome-management-v3-contract";

export const OUTCOME_MANAGEMENT_V3_STATUS_CONTRACT_VERSION = "outcome-management-v3-status/1.0.0" as const;

/** GET /api/projects/:projectId/outcome-management-v3/status */
export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    let tenant;
    try {
      tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    } catch (error) {
      if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, code: "STORAGE_UNAVAILABLE", error: "storage_unavailable" }, { status: 503 });
      throw error;
    }
    if (!tenant) return NextResponse.json({ ok: false, code: "PROJECT_FORBIDDEN", error: "forbidden" }, { status: 403 });

    const rec = await StageOperationRepository.getLatestCompletionSnapshot(tenant.workspaceId, projectId, "outcome-management").catch((e: unknown) => {
      if (e instanceof Error && /stage_operation_storage_unavailable/.test(e.message)) return null;
      throw e;
    });
    if (!rec?.snapshotData) {
      return NextResponse.json(
        { ok: false, code: "OUTCOME_NOT_COMPLETED", error: "尚未完成 U20（outcome-management）交接保存。", recoverable: true, navigation: { backTo: "outcome-management", action: "complete" } },
        { status: 409 }
      );
    }
    const om = rec.snapshotData as OutcomeManagementSnapshot;
    return NextResponse.json({
      ok: true,
      data: {
        snapshot: om,
        contractVersion: OUTCOME_MANAGEMENT_V3_STATUS_CONTRACT_VERSION,
        note: "成果總覽（Outcome Overview）僅依真實 decision/狀態；不得因亮綠燈宣稱出版/核結/款到或取消未來義務。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "OUTCOME_STATUS_FAILED", error: `U20 status 失敗：${message}`, recoverable: true }, { status: 500 });
  }
}
