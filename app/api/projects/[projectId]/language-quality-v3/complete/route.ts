import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildLanguageWorkspaceFromStage16,
  segmentByParagraphs,
  runFidelityChecks,
  runTerminologyCheck,
  runLanguageQa,
  buildProviderCapabilityManifest,
  buildLanguageQualitySnapshot,
  buildStage18ReceiverState,
} from "@/lib/language-quality-v3-service";
import {
  type LanguageWorkOrder,
  type TermBinding,
  type LanguageSegment,
} from "@/lib/language-quality-v3-contract";
import { type ScientificReviewSnapshot } from "@/lib/scientific-review-v3-contract";

export const LANGUAGE_QUALITY_V3_COMPLETE_CONTRACT_VERSION =
  "language-quality-v3-complete/1.0.0" as const;

/**
 * POST /api/projects/:projectId/language-quality-v3/complete
 *
 * 1. Re-resolves the Stage 16 ScientificReviewSnapshot (body or DB).
 * 2. Builds segments from provided section texts (scope-enforced).
 * 3. Runs fidelity + terminology + QA (deterministic, local).
 * 4. Builds LanguageQualitySnapshot + Stage 18 receiver state.
 * 5. Persists to stage_completion_snapshots (stage_id='translation-polish').
 *    DB unavailable ⇒ honest STORAGE_UNAVAILABLE status.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    let tenant;
    try {
      tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    } catch (error) {
      if (error instanceof ResearchStorageUnavailable) {
        return NextResponse.json({ ok: false, code: "STORAGE_UNAVAILABLE", error: "storage_unavailable" }, { status: 503 });
      }
      throw error;
    }
    if (!tenant) {
      return NextResponse.json({ ok: false, code: "PROJECT_FORBIDDEN", error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      scientificReviewSnapshot?: ScientificReviewSnapshot;
      sections?: Array<{ sectionRef: string; paragraphRef?: string; text: string; targetText?: string }>;
      termBindings?: TermBinding[];
    };

    let snapshot: ScientificReviewSnapshot | null = body.scientificReviewSnapshot ?? null;
    if (!snapshot) {
      const srCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "scientific-review"
      );
      if (srCompletion?.snapshotData) {
        snapshot = srCompletion.snapshotData as ScientificReviewSnapshot;
      }
    }
    if (!snapshot || !snapshot.snapshotId) {
      return NextResponse.json(
        { ok: false, code: "SCIENTIFIC_REVIEW_HANDOFF_REQUIRED", error: "無法解析第十六階段交接快照。" },
        { status: 400 }
      );
    }

    const langWs = buildLanguageWorkspaceFromStage16({ workspaceId, projectId, scientificReviewSnapshot: snapshot });
    const sections = (body.sections ?? []).filter((s) =>
      langWs.fullManuscriptLanguageAllowed || langWs.languageAllowedScopeRefs.includes(s.sectionRef)
    );

    const { segments, overLimitSegments } = segmentByParagraphs({
      sections: sections.map((s) => ({ sectionRef: s.sectionRef, paragraphRef: s.paragraphRef, text: s.text })),
    });

    // Attach target texts and status from the caller
    const sectionsByKey = new Map<string, (typeof sections)[number]>();
    for (const s of sections) sectionsByKey.set(`${s.sectionRef}|${s.paragraphRef ?? ""}`, s);
    for (const seg of segments) {
      const key = `${seg.sectionRef}|${seg.paragraphRef ?? ""}`;
      const src = sectionsByKey.get(key);
      if (src?.targetText) {
        seg.targetText = src.targetText;
        seg.status = "TRANSLATED";
      }
    }

    const termBindings = body.termBindings ?? [];
    const allFidelity: Array<Awaited<ReturnType<typeof runFidelityChecks>>["issues"][number]> = [];
    const allTerminology: typeof allFidelity = [];
    for (const seg of segments) {
      const f = runFidelityChecks({ sectionRef: seg.sectionRef, paragraphRef: seg.paragraphRef, sourceText: seg.sourceText, targetText: seg.targetText });
      allFidelity.push(...f.issues);
      const t = runTerminologyCheck({ termBindings, targetText: seg.targetText });
      allTerminology.push(...t.issues);
    }

    const qa = runLanguageQa({
      fidelityIssues: allFidelity,
      terminologyIssues: allTerminology,
      numericTokensHeld: !allFidelity.some((i) => (i.kind === "TOKEN_MODIFIED" || i.kind === "COMPARISON_DIRECTION_CHANGED" || i.kind === "DENOMINATOR_CHANGED") && i.severity === "FATAL"),
      citationRefsHeld: true,
    });

    const providerCapabilities = buildProviderCapabilityManifest();
    const lqSnapshot = buildLanguageQualitySnapshot({
      workspaceId: langWs.workspaceId,
      projectId,
      reviewRunId: langWs.reviewRunId,
      workOrder: langWs.workOrder,
      sourceSnapshot: snapshot,
      segments,
      fidelityIssues: allFidelity,
      terminologyIssues: allTerminology,
      termBindings,
      providerCapabilities,
      qa,
    });
    const stage18Receiver = buildStage18ReceiverState({ snapshot: lqSnapshot });

    let completionRecordId: string | null = null;
    let persistenceStatus: "PERSISTED" | "STORAGE_UNAVAILABLE" = "STORAGE_UNAVAILABLE";
    try {
      const completionRecord = await StageOperationRepository.saveCompletionSnapshot({
        workspaceId: tenant.workspaceId,
        projectId,
        stageId: "translation-polish",
        snapshotData: lqSnapshot,
        lockManifest: [],
        handoffLimitations: lqSnapshot.limitations,
        downstreamOpenRequirements: lqSnapshot.scope.languageAllowedScopeRefs.length > 0 ? [`scope:${lqSnapshot.scope.task}`] : [],
        nextStageId: lqSnapshot.nextStageId,
        userId: authenticated.session.user.id,
        idempotencyKey: `comp_lq_${lqSnapshot.snapshotId}`,
      });
      completionRecordId = completionRecord.id;
      persistenceStatus = "PERSISTED";
    } catch (error) {
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (!isStorageError) throw error;
      persistenceStatus = "STORAGE_UNAVAILABLE";
    }

    return NextResponse.json({
      ok: true,
      data: {
        snapshot: lqSnapshot,
        stage18Receiver,
        fidelityIssues: allFidelity,
        terminologyIssues: allTerminology,
        qa,
        providerCapabilities,
        overLimitSegments,
        persistence: {
          status: persistenceStatus,
          stageCompletionSnapshotId: completionRecordId,
          stageId: "translation-polish",
          nextStageId: lqSnapshot.nextStageId,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "LANGUAGE_QUALITY_COMPLETION_FAILED", error: `完成第十七階段交接快照失敗：${message}`, recoverable: true },
      { status: 500 }
    );
  }
}