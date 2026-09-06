import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildStudyDesignWorkspaceFromTheory,
  runStudyDesignLogicCheck,
} from "@/lib/study-design-planning-service";
import { type TheoryMechanismSnapshot } from "@/lib/theory-mechanism-v3-contract";

export const STUDY_DESIGN_INITIALIZE_CONTRACT_VERSION = "study-design-initialize/1.0.0" as const;

/**
 * POST /api/projects/:projectId/study-design/initialize
 * Spec v3.4.0 (V3-U07-FULL) §3, §4, §27
 *
 * Idempotently initializes or restores a StudyDesignWorkspace from Stage 6's
 * TheoryMechanismSnapshot. Does NOT rerun paid LLM jobs if already baselined.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    // 1. Retrieve the latest completed Stage 6 TheoryMechanismSnapshot
    const theoryCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
      workspaceId,
      projectId,
      "theory-mechanism"
    );

    let theorySnapshot: TheoryMechanismSnapshot | null = null;
    if (theoryCompletion?.snapshotData) {
      theorySnapshot = theoryCompletion.snapshotData as TheoryMechanismSnapshot;
    }

    if (!theorySnapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "THEORY_HANDOFF_REQUIRED",
          error: "未找到第六階段「理論與機制」已保存之交接快照，請先完成理論模型規劃。",
          recoverable: true,
          nextAction: "GO_TO_THEORY_MECHANISM",
        },
        { status: 400 }
      );
    }

    // 2. Build or restore Study Design Workspace with zero re-entry
    const workspace = buildStudyDesignWorkspaceFromTheory({
      workspaceId,
      projectId,
      theorySnapshot,
    });

    // 3. Run non-blocking logic checks
    const findings = runStudyDesignLogicCheck(workspace);

    return NextResponse.json({
      ok: true,
      data: {
        workspace,
        logicFindings: findings,
        sourceTheorySnapshotId: theorySnapshot.snapshotId,
        primaryGoal: workspace.primaryGoal,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "STUDY_DESIGN_INITIALIZATION_FAILED",
        error: `研究設計與分析計畫初始化失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
