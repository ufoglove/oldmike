import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildTheoryMechanismSnapshot,
  runTheoryMechanismLogicCheck,
} from "@/lib/theory-mechanism-v3-service";
import { type TheoryWorkspace } from "@/lib/theory-mechanism-v3-contract";
import { type GapEvidenceSnapshot } from "@/lib/gap-novelty-v3-contract";

const THEORY_COMPLETE_CONTRACT_VERSION = "theory-complete/1.0.0" as const;

/**
 * POST /api/projects/:projectId/theory-mechanism/complete
 * Spec v3.4.0 (V3-U06-FULL) §23, §24, §25
 *
 * Atomically baselines the Theory & Mechanism Planning and writes an immutable
 * TheoryMechanismSnapshot into stage_completion_snapshots for Stage 7 handoff (study-design).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";
    const body = (await request.json().catch(() => ({}))) as {
      workspace: TheoryWorkspace;
      gapSnapshot?: GapEvidenceSnapshot;
    };

    if (!body.workspace || !body.workspace.workspaceId) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_THEORY_PAYLOAD",
          error: "缺少有效的理論與機制工作區資料。",
          recoverable: false,
        },
        { status: 400 }
      );
    }

    const { workspace } = body;

    // 1. Run Gate verification (spec §21 & §23)
    const findings = runTheoryMechanismLogicCheck(workspace);
    const fatalFindings = findings.filter((f) => f.severity === "FATAL");

    if (fatalFindings.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "READINESS_BLOCKED",
          error: "理論與機制規劃存在阻礙完成的致命問題（FATAL），請先修正後再完成。",
          fatalFindings,
          recoverable: true,
        },
        { status: 422 }
      );
    }

    // 2. Fetch or reuse source GapEvidenceSnapshot
    let gapSnapshot = body.gapSnapshot;
    if (!gapSnapshot) {
      const gapCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        workspaceId,
        projectId,
        "gap-novelty"
      );
      if (gapCompletion?.snapshotData) {
        gapSnapshot = gapCompletion.snapshotData as GapEvidenceSnapshot;
      }
    }

    if (!gapSnapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "GAP_SNAPSHOT_MISSING",
          error: "無法解析對應的文獻深化與 Gap 快照，無法建立不可變交接。",
          recoverable: false,
        },
        { status: 400 }
      );
    }

    // 3. Build immutable TheoryMechanismSnapshot
    const theorySnapshot = buildTheoryMechanismSnapshot({
      workspace,
      gapSnapshot,
    });

    // 4. Atomically persist into stage_completion_snapshots
    const completionRecord = await StageOperationRepository.saveCompletionSnapshot({
      workspaceId,
      projectId,
      stageId: "theory-mechanism",
      snapshotData: theorySnapshot,
      lockManifest: [],
      handoffLimitations: theorySnapshot.limitations,
      downstreamOpenRequirements: theorySnapshot.downstreamRequirements.map((r) => r.title),
      nextStageId: "study-design",
      idempotencyKey: `comp_theory_${theorySnapshot.snapshotId}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        snapshot: theorySnapshot,
        completionRecordId: completionRecord.id,
        nextStageId: "study-design",
        message: "理論與機制規劃基線已成功保存，已就緒前進第七階段「研究設計與分析計畫」。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "THEORY_COMPLETION_FAILED",
        error: `保存理論與機制交接失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
