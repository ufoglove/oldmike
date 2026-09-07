import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildBlueprintPlanningSnapshot,
  runBlueprintLogicCheck,
} from "@/lib/blueprint-builder-service";
import { type BlueprintWorkspace } from "@/lib/blueprint-planning-contract";

const BLUEPRINT_COMPLETE_CONTRACT_VERSION = "blueprint-complete/1.0.0" as const;

/**
 * POST /api/projects/:projectId/blueprint/complete
 * Spec v3.4.0 (V3-U04-FULL) §6, §18, §20, §21
 *
 * Atomically baselines the Research Blueprint and writes an immutable
 * BlueprintPlanningSnapshot into stage_completion_snapshots for Stage 5 handoff.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";
    const body = (await request.json().catch(() => ({}))) as {
      workspace: BlueprintWorkspace;
      decisionOrigin?: "USER_MANUAL_ADOPTION" | "AUTO_PLANNING_BASELINE";
    };

    if (!body.workspace || !body.workspace.blueprintId) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_BLUEPRINT_PAYLOAD",
          error: "缺少有效的研究藍圖工作區資料。",
          recoverable: false,
        },
        { status: 400 }
      );
    }

    const { workspace, decisionOrigin = "USER_MANUAL_ADOPTION" } = body;

    // 1. Run Gate verification (spec §18)
    const findings = runBlueprintLogicCheck(workspace);
    const fatalFindings = findings.filter((f) => f.severity === "FATAL");

    if (fatalFindings.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "READINESS_BLOCKED",
          error: "研究藍圖存在阻礙完成的致命問題（FATAL），請先修正後再完成。",
          fatalFindings,
          recoverable: true,
        },
        { status: 422 }
      );
    }

    // 2. Build immutable BlueprintPlanningSnapshot
    const readinessSnapshotRef = `rd_${projectId}_${Date.now()}`;
    const planningSnapshot = buildBlueprintPlanningSnapshot({
      workspace,
      readinessSnapshotRef,
      decisionOrigin,
    });

    // 3. Atomically persist into stage_completion_snapshots
    const completionRecord = await StageOperationRepository.saveCompletionSnapshot({
      workspaceId,
      projectId,
      stageId: "blueprint",
      snapshotData: planningSnapshot,
      lockManifest: planningSnapshot.lockManifest,
      handoffLimitations: planningSnapshot.limitations,
      downstreamOpenRequirements: planningSnapshot.downstreamRequirements.map((r) => r.title),
      nextStageId: "gap-novelty",
      idempotencyKey: `comp_bp_${planningSnapshot.snapshotId}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        snapshot: planningSnapshot,
        completionRecordId: completionRecord.id,
        nextStageId: "gap-novelty",
        message: "研究藍圖規劃基線已成功保存，已就緒前進「文獻深化與Gap／新穎性驗證」。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "BLUEPRINT_COMPLETION_FAILED",
        error: `保存研究藍圖交接失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
