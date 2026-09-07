import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildTheoryWorkspaceFromGapSnapshot,
  runTheoryMechanismLogicCheck,
} from "@/lib/theory-mechanism-v3-service";
import { type GapEvidenceSnapshot } from "@/lib/gap-novelty-v3-contract";

const THEORY_INITIALIZE_CONTRACT_VERSION = "theory-initialize/1.0.0" as const;

/**
 * POST /api/projects/:projectId/theory-mechanism/initialize
 * Spec v3.4.0 (V3-U06-FULL) §3, §4, §25
 *
 * Idempotently initializes or restores a TheoryWorkspace from Stage 5's
 * GapEvidenceSnapshot. Does NOT rerun paid LLM jobs if already baselined.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    // 1. Retrieve the latest completed Stage 5 GapEvidenceSnapshot
    const gapCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
      workspaceId,
      projectId,
      "gap-novelty"
    );

    let gapSnapshot: GapEvidenceSnapshot | null = null;
    if (gapCompletion?.snapshotData) {
      gapSnapshot = gapCompletion.snapshotData as GapEvidenceSnapshot;
    }

    if (!gapSnapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "GAP_HANDOFF_REQUIRED",
          error: "未找到第五階段「文獻深化與 Gap 驗證」已保存之交接快照，請先完成 Gap 評估。",
          recoverable: true,
          nextAction: "GO_TO_GAP_NOVELTY",
        },
        { status: 400 }
      );
    }

    // 2. Build or restore Theory Workspace with zero re-entry
    const workspace = buildTheoryWorkspaceFromGapSnapshot({
      workspaceId,
      projectId,
      gapSnapshot,
    });

    // 3. Run non-blocking logic checks
    const findings = runTheoryMechanismLogicCheck(workspace);

    return NextResponse.json({
      ok: true,
      data: {
        workspace,
        logicFindings: findings,
        sourceGapSnapshotId: gapSnapshot.snapshotId,
        primaryGoal: workspace.primaryGoal,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "THEORY_INITIALIZATION_FAILED",
        error: `理論與機制初始化失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
