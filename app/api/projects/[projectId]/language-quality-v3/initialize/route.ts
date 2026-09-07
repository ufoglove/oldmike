import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildLanguageWorkspaceFromStage16,
  assertLanguageScopeAuthorized,
  segmentByParagraphs,
  runFidelityChecks,
  runTerminologyCheck,
  buildProviderCapabilityManifest,
  runLanguageQa,
} from "@/lib/language-quality-v3-service";
import { type ScientificReviewSnapshot } from "@/lib/scientific-review-v3-contract";

const LANGUAGE_QUALITY_V3_INITIALIZE_CONTRACT_VERSION =
  "language-quality-v3-initialize/1.0.0" as const;

/**
 * POST /api/projects/:projectId/language-quality-v3/initialize
 * Spec docs/stage17/spec-v3-4.0.md §1-3
 *
 * Idempotently initializes the Language Quality workspace from Stage 16's
 * ScientificReviewSnapshot. Source priority: body → DB
 * (stage_completion_snapshots stage_id='scientific-review').
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

    const body = (await request.json().catch(() => ({}))) as { scientificReviewSnapshot?: ScientificReviewSnapshot };

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
        {
          ok: false,
          code: "SCIENTIFIC_REVIEW_HANDOFF_REQUIRED",
          error: "未找到第十六階段「科學審查」已保存之交接快照，請先完成科學審查。",
          recoverable: true,
          nextAction: "GO_TO_SCIENTIFIC_REVIEW",
        },
        { status: 400 }
      );
    }

    if (snapshot.projectId !== projectId) {
      return NextResponse.json({ ok: false, code: "PROJECT_ID_MISMATCH", error: "快照專案 ID 與當前路由不符" }, { status: 403 });
    }

    // Upstream gate: SCIENTIFIC_REVISION_READY_FOR_LANGUAGE (mapped).
    // If the review itself is not approved for language, we still allow intake
    // but scope is restricted; if release says USE_BLOCKED we block entirely.
    if (snapshot.scientificReleaseState === "USE_BLOCKED" || snapshot.scientificReleaseState === "SOURCE_STALE") {
      return NextResponse.json(
        {
          ok: false,
          code: "SCIENTIFIC_RELEASE_BLOCKED",
          error: `上游科學釋出狀態為 ${snapshot.scientificReleaseState}，不得進行語言處理。`,
          recoverable: true,
        },
        { status: 422 }
      );
    }

    const langWs = buildLanguageWorkspaceFromStage16({ workspaceId, projectId, scientificReviewSnapshot: snapshot });

    // Build segments from the snapshot's section refs (full section bodies are
    // re-fetched by the caller; here we build a partial-segment scaffold only
    // for the allowed scope). Empty sections produce zero segments — the UI
    // must supply real text via /segments before QA.
    const scopeCheck = assertLanguageScopeAuthorized({
      workOrder: langWs.workOrder,
      sectionRef: snapshot.scope.coverageSections[0] ?? "RESULTS",
    });

    const capabilities = buildProviderCapabilityManifest();

    return NextResponse.json({
      ok: true,
      data: {
        workspace: langWs,
        scopeCheck,
        providerCapabilities: capabilities,
        note:
          "本輪語言處理僅限 language_allowed_scope_refs 內章節；partial 稿不得自動升級整稿。外部 provider 狀態如實標示（LIVE/MOCK/BLOCKED/NOT_CONFIGURED）。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "LANGUAGE_QUALITY_INITIALIZATION_FAILED", error: `第十七階段語言品質初始化失敗：${message}`, recoverable: true },
      { status: 500 }
    );
  }
}