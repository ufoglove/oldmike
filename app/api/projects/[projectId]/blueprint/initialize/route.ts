import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildBlueprintWorkspaceFromNavigation,
  runBlueprintLogicCheck,
} from "@/lib/blueprint-builder-service";
import { type SubmissionNavigationSnapshot } from "@/lib/submission-navigation-engines-contract";

export const BLUEPRINT_INITIALIZE_CONTRACT_VERSION = "blueprint-initialize/1.0.0" as const;

/**
 * POST /api/projects/:projectId/blueprint/initialize
 * Spec v3.4.0 (V3-U04-FULL) §3, §4, §21
 *
 * Idempotently initializes or restores a BlueprintWorkspace from Stage 3's
 * SubmissionNavigationSnapshot. Does NOT rerun paid LLM jobs if already baselined.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";
    // 1. Retrieve the latest completed Stage 3 SubmissionNavigationSnapshot
    const navCompletion = await StageOperationRepository.getLatestCompletionSnapshot(workspaceId, projectId, "navigator");

    let navSnapshot: SubmissionNavigationSnapshot | null = null;
    if (navCompletion?.snapshotData) {
      navSnapshot = navCompletion.snapshotData as SubmissionNavigationSnapshot;
    }

    if (!navSnapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "NAVIGATION_HANDOFF_REQUIRED",
          error: "未找到第三階段「投稿與計畫導航」的已保存交接快照，請先完成投稿導航。",
          recoverable: true,
          nextAction: "GO_TO_SUBMISSION_NAVIGATOR",
        },
        { status: 400 }
      );
    }

    // 2. Build or restore Blueprint Workspace with zero re-entry
    const workspace = buildBlueprintWorkspaceFromNavigation({
      workspaceId,
      projectId,
      navigationSnapshot: navSnapshot,
    });

    // 3. Run non-blocking logic checks
    const findings = runBlueprintLogicCheck(workspace);

    return NextResponse.json({
      ok: true,
      data: {
        workspace,
        logicFindings: findings,
        sourceNavigationSnapshotId: navSnapshot.snapshotId,
        primaryGoal: workspace.primaryGoal,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "BLUEPRINT_INITIALIZATION_FAILED",
        error: `研究藍圖初始化失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
