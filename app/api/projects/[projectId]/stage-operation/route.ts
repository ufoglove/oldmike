import { NextRequest, NextResponse } from "next/server";
import { StageReadinessService } from "@/lib/stage-readiness-service";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { getFieldPolicy, isFieldAiWritable } from "@/lib/field-policy-service";
import { StageId } from "@/lib/stage-operation-contracts";

/**
 * GET /api/projects/[projectId]/stage-operation/readiness?stageId=xxx
 * Evaluate current readiness & issues for a given stage
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const stageId = (searchParams.get("stageId") || "topic-lab") as StageId;

    // Hardcoded workspace for isolated run/dev
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    if (stageId === "topic-lab" || stageId === "radar" || stageId === "one-click") {
      const readiness = await StageReadinessService.evaluateTopicLabReadiness(
        workspaceId,
        projectId
      );
      const locks = await StageOperationRepository.getFieldLocks(
        workspaceId,
        projectId,
        stageId
      );
      return NextResponse.json({ success: true, readiness, locks });
    }

    return NextResponse.json({
      success: true,
      readiness: {
        stageId,
        projectId,
        isReady: true,
        canProceed: true,
        totalRequirements: 0,
        satisfiedRequirements: 0,
        blockingIssues: [],
        nonBlockingIssues: [],
        evaluatedAt: new Date().toISOString(),
      },
      locks: [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to evaluate readiness" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/stage-operation/lock
 * Acquire or release a field lock
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const {
      action,
      stageId,
      fieldRef,
      entityId,
      lockedValue,
      lockPolicy,
      lockReason,
      expectedLockVersion,
    } = body;

    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    if (action === "LOCK") {
      const lock = await StageOperationRepository.acquireFieldLock({
        workspaceId,
        projectId,
        stageId,
        entityId,
        fieldRef,
        lockedValue,
        lockPolicy: lockPolicy || "MANUAL",
        lockReason,
      });
      return NextResponse.json({ success: true, lock });
    }

    if (action === "UNLOCK") {
      const released = await StageOperationRepository.releaseFieldLock(
        workspaceId,
        projectId,
        stageId,
        fieldRef,
        entityId
      );
      return NextResponse.json({ success: true, released });
    }

    if (action === "CHECK_WRITE") {
      // Backend write protection check
      const check = await StageOperationRepository.assertFieldWritePermitted({
        workspaceId,
        projectId,
        stageId,
        fieldRef,
        entityId,
        expectedLockVersion,
      });
      return NextResponse.json({ success: true, ...check });
    }

    if (action === "HANDOFF") {
      // Save stage completion handoff snapshot
      const snapshot = await StageOperationRepository.saveCompletionSnapshot({
        workspaceId,
        projectId,
        stageId,
        snapshotData: body.snapshotData || {},
        topicSnapshot: body.topicSnapshot,
        lockManifest: body.lockManifest || [],
        handoffLimitations: body.handoffLimitations || [],
        downstreamOpenRequirements: body.downstreamOpenRequirements || [],
        nextStageId: body.nextStageId,
        idempotencyKey: body.idempotencyKey,
      });
      return NextResponse.json({ success: true, snapshot });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process lock operation" },
      { status: 500 }
    );
  }
}
