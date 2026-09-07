import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildGapReviewWorkspaceFromBlueprint,
  runGapNoveltyLogicCheck,
} from "@/lib/gap-novelty-v3-service";
import { type BlueprintPlanningSnapshot } from "@/lib/blueprint-planning-contract";

const GAP_INITIALIZE_CONTRACT_VERSION = "gap-initialize/1.0.0" as const;

/**
 * POST /api/projects/:projectId/gap-novelty/initialize
 * Spec v3.4.0 (V3-U05-FULL) §3, §4, §25
 *
 * Idempotently initializes or restores a GapReviewWorkspace from Stage 4's
 * BlueprintPlanningSnapshot. Does NOT rerun paid LLM jobs if already baselined.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    // 1. Retrieve the latest completed Stage 4 BlueprintPlanningSnapshot
    const bpCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
      workspaceId,
      projectId,
      "blueprint"
    );

    let blueprintSnapshot: BlueprintPlanningSnapshot | null = null;
    if (bpCompletion?.snapshotData) {
      blueprintSnapshot = bpCompletion.snapshotData as BlueprintPlanningSnapshot;
    }

    if (!blueprintSnapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "BLUEPRINT_HANDOFF_REQUIRED",
          error: "未找到第四階段「研究藍圖」已保存之交接快照，請先完成研究藍圖規劃基線。",
          recoverable: true,
          nextAction: "GO_TO_RESEARCH_BLUEPRINT",
        },
        { status: 400 }
      );
    }

    // 2. Build or restore Gap Review Workspace with zero re-entry
    const workspace = buildGapReviewWorkspaceFromBlueprint({
      workspaceId,
      projectId,
      blueprintSnapshot,
    });

    // 3. Run non-blocking logic checks
    const findings = runGapNoveltyLogicCheck(workspace);

    return NextResponse.json({
      ok: true,
      data: {
        workspace,
        logicFindings: findings,
        sourceBlueprintSnapshotId: blueprintSnapshot.snapshotId,
        primaryGoal: workspace.primaryGoal,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "GAP_INITIALIZATION_FAILED",
        error: `文獻深化與 Gap 評估初始化失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
