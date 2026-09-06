import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildGapEvidenceSnapshot,
  runGapNoveltyLogicCheck,
} from "@/lib/gap-novelty-v3-service";
import { type GapReviewWorkspace } from "@/lib/gap-novelty-v3-contract";
import { type BlueprintPlanningSnapshot } from "@/lib/blueprint-planning-contract";

export const GAP_COMPLETE_CONTRACT_VERSION = "gap-complete/1.0.0" as const;

/**
 * POST /api/projects/:projectId/gap-novelty/complete
 * Spec v3.4.0 (V3-U05-FULL) §22, §24, §25
 *
 * Atomically baselines the Literature & Gap Review and writes an immutable
 * GapEvidenceSnapshot into stage_completion_snapshots for Stage 6 handoff (theory-mechanism).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";
    const body = (await request.json().catch(() => ({}))) as {
      workspace: GapReviewWorkspace;
      blueprintSnapshot?: BlueprintPlanningSnapshot;
    };

    if (!body.workspace || !body.workspace.reviewId) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_GAP_PAYLOAD",
          error: "缺少有效的文獻深化與 Gap 工作區資料。",
          recoverable: false,
        },
        { status: 400 }
      );
    }

    const { workspace } = body;

    // 1. Run Gate verification (spec §22)
    const findings = runGapNoveltyLogicCheck(workspace);
    const fatalFindings = findings.filter((f) => f.severity === "FATAL");

    if (fatalFindings.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "READINESS_BLOCKED",
          error: "文獻深化與 Gap 評估存在阻礙完成的致命問題（FATAL），請先修正後再完成。",
          fatalFindings,
          recoverable: true,
        },
        { status: 422 }
      );
    }

    // 2. Fetch or reuse source BlueprintPlanningSnapshot
    let blueprintSnapshot = body.blueprintSnapshot;
    if (!blueprintSnapshot) {
      const bpCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        workspaceId,
        projectId,
        "blueprint"
      );
      if (bpCompletion?.snapshotData) {
        blueprintSnapshot = bpCompletion.snapshotData as BlueprintPlanningSnapshot;
      }
    }

    if (!blueprintSnapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "BLUEPRINT_SNAPSHOT_MISSING",
          error: "無法解析對應的研究藍圖快照，無法建立不可變交接。",
          recoverable: false,
        },
        { status: 400 }
      );
    }

    // 3. Build immutable GapEvidenceSnapshot
    const gapSnapshot = buildGapEvidenceSnapshot({
      workspace,
      blueprintSnapshot,
    });

    // 4. Atomically persist into stage_completion_snapshots
    const completionRecord = await StageOperationRepository.saveCompletionSnapshot({
      workspaceId,
      projectId,
      stageId: "gap-novelty",
      snapshotData: gapSnapshot,
      lockManifest: [],
      handoffLimitations: gapSnapshot.limitations,
      downstreamOpenRequirements: gapSnapshot.downstreamRequirements.map((r) => r.title),
      nextStageId: "theory-mechanism",
      idempotencyKey: `comp_gap_${gapSnapshot.snapshotId}`,
    });

    return NextResponse.json({
      ok: true,
      data: {
        snapshot: gapSnapshot,
        completionRecordId: completionRecord.id,
        nextStageId: "theory-mechanism",
        message: "文獻深化與 Gap／新穎性評估基線已成功保存，已就緒前進第六階段「理論與機制」。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "GAP_COMPLETION_FAILED",
        error: `保存文獻深化與 Gap 交接失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
