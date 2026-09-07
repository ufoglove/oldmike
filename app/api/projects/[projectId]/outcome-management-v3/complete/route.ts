import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildOutcomeManagementSnapshot,
  intakeOutcomeWorkspace,
  readyGatesFor,
  nextActionDefault,
} from "@/lib/outcome-management-v3-service";
import { type SubmissionTrackingSnapshot } from "@/lib/submission-tracking-v3-contract";
import { type OutcomeStageFlags, type OutcomeRoute, type OutcomeGate } from "@/lib/outcome-management-v3-contract";

export const OUTCOME_MANAGEMENT_V3_COMPLETE_CONTRACT_VERSION = "outcome-management-v3-complete/1.0.0" as const;

/** POST /api/projects/:projectId/outcome-management-v3/complete
 * 承接 U19 → 建立 OutcomeManagementSnapshot（stageId=outcome-management）並持久化。 */
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
    if (snapshot.stageKey !== "V3-U19") {
      return NextResponse.json({ ok: false, code: "HANDOFF_SCHEMA_UNSUPPORTED", error: "上游非 submission-tracking v1.1。", recoverable: true }, { status: 422 });
    }

    const intake = intakeOutcomeWorkspace({ snapshot, allowedScope: null });
    const route = intake.route as OutcomeRoute;
    // 起始 flags（均未正式核實，不預設任何出版/款項完成）
    const flags: OutcomeStageFlags = {
      acceptance: snapshot.decision === "ACCEPTED" ? "ACCEPTED" : "NOT_ACCEPTED",
      production: "NOT_PRODUCTION",
      visibility: "NOT_VISIBLE",
      indexing: "UNVERIFIED",
      funding: snapshot.decision === "GRANTED" ? "AWARD_VERIFIED" : "NOT_AWARDED",
    };
    const gates: OutcomeGate[] = readyGatesFor({
      route, intake: intake.intakeGatePassed,
      baseline: intake.baselineOnly === false,
      proofReady: false, execReady: false, reportReady: false,
      outputVerified: false, releaseReady: false, closureReady: false, archiveVerified: false,
    });
    const outSnap = buildOutcomeManagementSnapshot({
      workspaceId: tenant.workspaceId,
      projectId,
      sourceSnapshot: snapshot,
      route,
      flags,
      readyGates: gates,
      nextAction: nextActionDefault({ route, intakeGate: intake.intakeGatePassed }),
    });

    let persistenceStatus: "PERSISTED" | "STORAGE_UNAVAILABLE" = "STORAGE_UNAVAILABLE";
    let completionRecordId: string | null = null;
    try {
      const rec = await StageOperationRepository.saveCompletionSnapshot({
        workspaceId: tenant.workspaceId,
        projectId,
        stageId: "outcome-management",
        snapshotData: outSnap,
        lockManifest: [],
        handoffLimitations: [],
        downstreamOpenRequirements: snapshot.unresolvedIssueRefs ?? [],
        nextStageId: "closure-or-new-study",
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
        persistence: { status: persistenceStatus, stageCompletionSnapshotId: completionRecordId, stageId: "outcome-management", nextAction: outSnap.nextAction },
        intake: { intakeGatePassed: intake.intakeGatePassed, baselineOnly: intake.baselineOnly, decision: intake.decision },
        flags,
        readyGates: gates,
        note: "誠實：僅接受/核定(源核) enable 某些 Gate；其餘 baseline-only。不預設出版/款到。next_external_action_authorized=false。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "OUTCOME_COMPLETE_FAILED", error: `U20 完成保存失敗：${message}`, recoverable: true }, { status: 500 });
  }
}
