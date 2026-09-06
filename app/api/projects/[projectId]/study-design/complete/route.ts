import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildDesignAnalysisPlanningSnapshot,
  runStudyDesignLogicCheck,
} from "@/lib/study-design-planning-service";
import { type StudyDesignWorkspace } from "@/lib/study-design-planning-contract";
import { type TheoryMechanismSnapshot } from "@/lib/theory-mechanism-v3-contract";

export const STUDY_DESIGN_COMPLETE_CONTRACT_VERSION = "study-design-complete/1.0.0" as const;

/**
 * POST /api/projects/:projectId/study-design/complete
 * Spec v3.4.0 (V3-U07-FULL) §25, §26, §27
 *
 * Atomically baselines the Study Design & Analysis Planning and writes an immutable
 * DesignAnalysisPlanningSnapshot into stage_completion_snapshots for Stage 8 handoff (route-studio).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";
    const body = (await request.json().catch(() => ({}))) as {
      workspace: StudyDesignWorkspace;
      theorySnapshot?: TheoryMechanismSnapshot;
    };

    if (!body.workspace || !body.workspace.workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_STUDY_DESIGN_PAYLOAD",
          error: "缺少有效之研究設計與分析工作區資料。",
          recoverable: false,
        },
        { status: 400 }
      );
    }

    const { workspace } = body;

    // 1. Run Gate verification (spec §23 & §25)
    const findings = runStudyDesignLogicCheck(workspace);
    const fatalFindings = findings.filter((f) => f.severity === "FATAL");

    if (fatalFindings.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "READINESS_BLOCKED",
          error: "研究設計與分析規劃存在阻礙完成的致命問題（FATAL），請先修正後再完成。",
          fatalFindings,
          recoverable: true,
        },
        { status: 422 }
      );
    }

    // 2. Fetch or reuse source TheoryMechanismSnapshot
    let theorySnapshot = body.theorySnapshot;
    if (!theorySnapshot) {
      const theoryCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        workspaceId,
        projectId,
        "theory-mechanism"
      );
      if (theoryCompletion?.snapshotData) {
        theorySnapshot = theoryCompletion.snapshotData as TheoryMechanismSnapshot;
      }
    }

    if (!theorySnapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "THEORY_SNAPSHOT_MISSING",
          error: "無法解析對應的理論與機制快照，無法建立不可變交接。",
          recoverable: false,
        },
        { status: 400 }
      );
    }

    // 3. Build immutable DesignAnalysisPlanningSnapshot
    const designSnapshot = buildDesignAnalysisPlanningSnapshot({
      workspace,
      theorySnapshot,
    });

    // 4. Atomically persist into stage_completion_snapshots
    const completionRecord = await StageOperationRepository.saveCompletionSnapshot({
      workspaceId,
      projectId,
      stageId: "study-design",
      snapshotData: designSnapshot,
      lockManifest: [],
      handoffLimitations: designSnapshot.limitations,
      downstreamOpenRequirements: designSnapshot.downstreamRequirements.map((r) => r.title),
      nextStageId: "route-studio",
      idempotencyKey: `comp_design_${designSnapshot.snapshotId}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        snapshot: designSnapshot,
        completionRecordId: completionRecord.id,
        nextStageId: "route-studio",
        message: "研究設計與分析規劃基線已成功保存，已就緒前進第八階段「三路線研究與計畫工作室」。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "STUDY_DESIGN_COMPLETION_FAILED",
        error: `保存研究設計與分析交接失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
