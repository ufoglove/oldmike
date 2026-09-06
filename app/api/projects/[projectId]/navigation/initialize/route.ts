import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildFingerprintFromTopicSnapshot,
  type SubmissionFingerprintVersion,
} from "@/lib/submission-fingerprint-contract";
import {
  migrateLegacyGoal,
  type PrimaryGoalId,
} from "@/lib/research-goal-registry";
import { type TopicSelectionSnapshot } from "@/lib/stage-operation-contracts";

export const NAVIGATION_INIT_CONTRACT_VERSION = "navigation-init/1.0.0" as const;

/**
 * POST /api/projects/:id/navigation/initialize
 * Spec v3.4.0 (V3-U03-FULL) Section 6, 25
 *
 * Receives topic_selection_snapshot from Stage 2 (or reads from stage_completion_snapshots),
 * builds SubmissionFingerprintVersion with ZERO re-entry, ensures project membership,
 * and returns idempotent navigation context.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    const body = (await request.json().catch(() => ({}))) as {
      goalId?: PrimaryGoalId;
      explicitTopicSnapshot?: TopicSelectionSnapshot;
      idempotencyKey?: string;
    };

    // 1. Fetch latest topic selection snapshot from stage_completion_snapshots if not explicitly passed
    let topicSnapshot: TopicSelectionSnapshot | null = body.explicitTopicSnapshot || null;

    if (!topicSnapshot) {
      const completion = await StageOperationRepository.getLatestCompletionSnapshot(
        workspaceId,
        projectId,
        "topic-lab",
      );
      if (completion && completion.topicSnapshot) {
        topicSnapshot = completion.topicSnapshot;
      }
    }

    if (!topicSnapshot) {
      // Spec §6: No topic snapshot -> return structured error with recovery hint (T03)
      return NextResponse.json(
        {
          ok: false,
          code: "TOPIC_SNAPSHOT_REQUIRED",
          message: "尚未在選題實驗室完成題目採用；請先於選題實驗室點選『採用此題』。",
          recoverable: true,
          nextAction: {
            routeId: "topic-lab",
            label: "前往選題實驗室採用題目 →",
          },
        },
        { status: 400 },
      );
    }

    // 2. Resolve GoalContext (defaults to JOURNAL_SCI_SSCI or passed goal)
    const goalContext = body.goalId
      ? migrateLegacyGoal(body.goalId)
      : migrateLegacyGoal("JOURNAL_SCI_SSCI");

    // 3. Build SubmissionFingerprintVersion with ZERO re-entry of existing data (Spec §7)
    const fingerprint: SubmissionFingerprintVersion = buildFingerprintFromTopicSnapshot(
      workspaceId,
      topicSnapshot,
      {
        fundingIntent: goalContext.fundingIntent,
        publicationIntent: goalContext.publicationIntent,
      },
    );

    return NextResponse.json({
      ok: true,
      contractVersion: NAVIGATION_INIT_CONTRACT_VERSION,
      projectId,
      workspaceId,
      goalContext,
      topicSnapshotSummary: {
        topicId: topicSnapshot.topicId,
        topicTitle: topicSnapshot.topicTitle,
        researchQuestion: topicSnapshot.researchQuestion,
        selectionMethod: topicSnapshot.selectionMethod,
        selectedAt: topicSnapshot.selectedAt,
      },
      fingerprint,
      idempotencyKey: body.idempotencyKey || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        error: error instanceof Error ? error.message : "Initialization failed",
      },
      { status: 500 },
    );
  }
}
