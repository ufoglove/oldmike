import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  buildSubmissionNavigationSnapshot,
  type JournalCandidate,
  type MoeTprRouteCandidate,
  type NstcRouteCandidate,
  type OfficialRuleSnapshot,
  type SubmissionNavigationSnapshot,
} from "@/lib/submission-navigation-engines-contract";
import { type FundingIntent, type PublicationIntent, type SubmissionFingerprintVersion } from "@/lib/submission-fingerprint-contract";

export const NAVIGATION_COMPLETE_CONTRACT_VERSION = "navigation-complete/1.0.0" as const;

/**
 * POST /api/projects/:id/navigation/complete
 * Spec v3.4.0 (V3-U03-FULL) Section 23, 24, 25
 *
 * Saves immutable SubmissionNavigationSnapshot and records stage completion in
 * stage_completion_snapshots, enabling zero-gap handoff to Research Blueprint (Stage 4).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    const body = (await request.json().catch(() => ({}))) as {
      fingerprint: SubmissionFingerprintVersion;
      fundingIntent: FundingIntent;
      publicationIntent: PublicationIntent;
      selectedJournal?: JournalCandidate;
      selectedNstc?: NstcRouteCandidate;
      selectedMoeTpr?: MoeTprRouteCandidate;
      ruleSnapshots?: OfficialRuleSnapshot[];
      handoffLimitations?: string[];
      downstreamRequirements?: string[];
      decisionOrigin?: "USER_MANUAL_SELECTION" | "AUTO_SELECTED_PROVISIONAL";
      idempotencyKey?: string;
    };

    if (!body.fingerprint || !body.fingerprint.fingerprintId) {
      return NextResponse.json(
        {
          ok: false,
          code: "FINGERPRINT_REQUIRED",
          message: "導航完成前需有有效的投稿指紋版本。",
        },
        { status: 400 },
      );
    }

    // 1. Build immutable SubmissionNavigationSnapshot
    const navigationSnapshot: SubmissionNavigationSnapshot = buildSubmissionNavigationSnapshot({
      workspaceId,
      projectId,
      fingerprint: body.fingerprint,
      fundingIntent: body.fundingIntent,
      publicationIntent: body.publicationIntent,
      selectedJournal: body.selectedJournal,
      selectedNstc: body.selectedNstc,
      selectedMoeTpr: body.selectedMoeTpr,
      ruleSnapshots: body.ruleSnapshots,
      handoffLimitations: body.handoffLimitations,
      downstreamRequirements: body.downstreamRequirements,
      decisionOrigin: body.decisionOrigin || "USER_MANUAL_SELECTION",
    });

    // 2. Persist to stage_completion_snapshots for the "navigator" stage
    const completion = await StageOperationRepository.saveCompletionSnapshot({
      workspaceId,
      projectId,
      stageId: "navigator",
      nextStageId: "blueprint",
      snapshotData: {
        navigationSnapshot,
        planningStatus: navigationSnapshot.planningStatus,
        decisionOrigin: navigationSnapshot.decisionOrigin,
        selectedRoutes: {
          journal: navigationSnapshot.selectedJournalCandidate?.journalName || null,
          nstc: navigationSnapshot.selectedNstcCandidate?.disciplineName || null,
          moe: navigationSnapshot.selectedMoeTprCandidate?.disciplineOrProgramName || null,
        },
      },
      lockManifest: [],
      handoffLimitations: navigationSnapshot.handoffLimitations,
      downstreamOpenRequirements: navigationSnapshot.downstreamRequirements,
      idempotencyKey: body.idempotencyKey || `complete:${navigationSnapshot.snapshotId}`,
    });

    return NextResponse.json({
      ok: true,
      contractVersion: NAVIGATION_COMPLETE_CONTRACT_VERSION,
      snapshotId: navigationSnapshot.snapshotId,
      completionRecordId: completion.id,
      planningStatus: navigationSnapshot.planningStatus,
      nextStageId: "blueprint",
      navigationSnapshot,
      handoffReady: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        error: error instanceof Error ? error.message : "Completion failed",
      },
      { status: 500 },
    );
  }
}
