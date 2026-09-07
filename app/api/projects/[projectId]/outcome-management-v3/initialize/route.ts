import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { intakeOutcomeWorkspace } from "@/lib/outcome-management-v3-service";
import { type SubmissionTrackingSnapshot } from "@/lib/submission-tracking-v3-contract";

export const OUTCOME_MANAGEMENT_V3_INITIALIZE_CONTRACT_VERSION = "outcome-management-v3-initialize/1.0.0" as const;

/** POST /api/projects/:projectId/outcome-management-v3/initialize
 * 承接 U19 SubmissionTrackingSnapshot；Gate DECISION_VERIFIED_AND_OUTCOME_HANDOFF_READY。
 * 非正式接受/核定：只 allowPreparation，不自動升 formal。 */
export async function POST(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
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
    if (!tenant) return NextResponse.json({ ok: false, code: "PROJECT_FORBIDDEN", error: "forbidden" }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as { snapshot?: SubmissionTrackingSnapshot };

    let snapshot: SubmissionTrackingSnapshot | null = body.snapshot ?? null;
    if (!snapshot) {
      const rec = await StageOperationRepository.getLatestCompletionSnapshot(tenant.workspaceId, projectId, "submission-tracking").catch((e: unknown) => {
        if (e instanceof Error && /stage_operation_storage_unavailable/.test(e.message)) return null;
        throw e;
      });
      if (rec?.snapshotData) snapshot = rec.snapshotData as SubmissionTrackingSnapshot;
    }
    if (!snapshot || !snapshot.snapshotId) {
      return NextResponse.json(
        { ok: false, code: "OUTCOME_HANDOFF_REQUIRED", error: "未找到第十九階段（送件追蹤）已保存之交接收快照；請先完成 submit-tracking。", recoverable: true, navigation: { backTo: "submission-tracking" } },
        { status: 400 }
      );
    }
    if (snapshot.stageKey !== "V3-U19" || snapshot.nextStageId !== "post-acceptance") {
      return NextResponse.json({ ok: false, code: "HANDOFF_SCHEMA_UNSUPPORTED", error: "上游非 submission-tracking v1.1/next=post-acceptance", recoverable: true }, { status: 422 });
    }

    const intake = intakeOutcomeWorkspace({ snapshot });
    return NextResponse.json({
      ok: true,
      data: {
        intake: { route: intake.route, ready: intake.ready, decision: intake.decision },
        note: "只有接受/核定(源核)才 allowPostAcceptance；其餘 allowPreparation，不自動升正式。submission/付款/公開授權一律需另行重新授權。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "OUTCOME_INIT_FAILED", error: `U20 初始化失敗：${message}`, recoverable: true }, { status: 500 });
  }
}
