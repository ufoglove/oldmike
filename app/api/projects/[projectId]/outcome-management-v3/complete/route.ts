import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { buildOutcomeManagementSnapshot, intakeOutcomeWorkspace } from "@/lib/outcome-management-v3-service";
import { type SubmissionTrackingSnapshot } from "@/lib/submission-tracking-v3-contract";
import { type OutcomeRoute } from "@/lib/outcome-management-v3-contract";

export const OUTCOME_MANAGEMENT_V3_COMPLETE_CONTRACT_VERSION = "outcome-management-v3-complete/1.0.0" as const;

/** POST /api/projects/:projectId/outcome-management-v3/complete */
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
      if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, code: "STORAGE_UNAVAILABLE", error: "storage_unavailable" }, { status: 503 });
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
      return NextResponse.json({ ok: false, code: "OUTCOME_HANDOFF_REQUIRED", error: "缺少 U19 snapshot。", recoverable: true }, { status: 400 });
    }

    const intake = intakeOutcomeWorkspace({ snapshot });
    const outSnap = buildOutcomeManagementSnapshot({ workspaceId: tenant.workspaceId, projectId, sourceSnapshot: snapshot, route: (intake.route as OutcomeRoute) });

    let persistenceStatus: "PERSISTED" | "STORAGE_UNAVAILABLE" = "STORAGE_UNAVAILABLE";
    let completionRecordId: string | null = null;
    try {
      const rec = await StageOperationRepository.saveCompletionSnapshot({
        workspaceId: tenant.workspaceId,
        projectId,
        stageId: "outcome-management",
        snapshotData: outSnap,
        lockManifest: snapshot.limitations,
        handoffLimitations: snapshot.limitations,
        downstreamOpenRequirements: [],
        nextStageId: outSnap.nextStageId,
        userId: authenticated.session.user.id,
        idempotencyKey: `comp_om_${outSnap.snapshotId}`,
      });
      completionRecordId = rec.id;
      persistenceStatus = "PERSISTED";
    } catch (error) {
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (!isStorageError) throw error;
    }

    return NextResponse.json({
      ok: true,
      data: {
        snapshot: outSnap,
        persistence: { status: persistenceStatus, stageCompletionSnapshotId: completionRecordId, stageId: "outcome-management", nextStageId: outSnap.nextStageId },
        readiness: intake.ready,
        note: "誠實：網站測試通過≠真實成果已完成。僅接受/核定(源核) enable formal;否則 preparation-only。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "OUTCOME_COMPLETE_FAILED", error: `U20 完成保存失敗：${message}`, recoverable: true }, { status: 500 });
  }
}
