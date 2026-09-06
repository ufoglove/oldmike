import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildComplianceWorkspaceFromStage17,
  assertComplianceScopeAuthorized,
  buildRuleSnapshots,
  buildDerivedDocuments,
  rendererCapabilities,
} from "@/lib/final-submission-v3-service";
import { type LanguageQualitySnapshot } from "@/lib/language-quality-v3-contract";

export const FINAL_SUBMISSION_V3_INITIALIZE_CONTRACT_VERSION =
  "final-submission-v3-initialize/1.0.0" as const;

/**
 * POST /api/projects/:projectId/final-submission-v3/initialize
 * Spec docs/stage18/spec-v3-4.0.md §1-3
 *
 * Idempotently initializes the Final Compliance workspace from Stage 17's
 * LanguageQualitySnapshot. Source priority: body → DB
 * (stage_completion_snapshots stage_id='translation-polish').
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

    const body = (await request.json().catch(() => ({}))) as { languageQualitySnapshot?: LanguageQualitySnapshot };

    let snapshot: LanguageQualitySnapshot | null = body.languageQualitySnapshot ?? null;
    if (!snapshot) {
      const lqCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "translation-polish"
      );
      if (lqCompletion?.snapshotData) {
        snapshot = lqCompletion.snapshotData as LanguageQualitySnapshot;
      }
    }

    if (!snapshot || !snapshot.snapshotId) {
      return NextResponse.json(
        {
          ok: false,
          code: "LANGUAGE_QUALITY_HANDOFF_REQUIRED",
          error: "未找到第十七階段「翻譯與學術潤稿」已保存之交接快照，請先完成語言品質。",
          recoverable: true,
          nextAction: "GO_TO_TRANSLATION_POLISH",
        },
        { status: 400 }
      );
    }

    if (snapshot.projectId !== projectId) {
      return NextResponse.json({ ok: false, code: "PROJECT_ID_MISMATCH", error: "快照專案 ID 與當前路由不符" }, { status: 403 });
    }

    // Upstream gate: LANGUAGE_EDITION_READY_FOR_FINAL_COMPLIANCE (mapped).
    if (snapshot.languageReleaseState === "USE_BLOCKED" || snapshot.languageReleaseState === "SOURCE_STALE") {
      return NextResponse.json(
        {
          ok: false,
          code: "LANGUAGE_RELEASE_BLOCKED",
          error: `上游語言釋出狀態為 ${snapshot.languageReleaseState}，不得進行最終合規。`,
          recoverable: true,
        },
        { status: 422 }
      );
    }

    const fcWs = buildComplianceWorkspaceFromStage17({ workspaceId, projectId, languageQualitySnapshot: snapshot });
    const rules = buildRuleSnapshots({ route: fcWs.route });
    const documents = buildDerivedDocuments({
      route: fcWs.route,
      profile: fcWs.profile,
      anonymizationRequired: fcWs.route === "JOURNAL_SCI_SSCI",
    });
    const renderers = rendererCapabilities();

    // Scope gate: partial/standalone language may only pre-check
    const scopeCheck = assertComplianceScopeAuthorized({
      formalComplianceAllowed: fcWs.formalComplianceAllowed,
      sectionRef: snapshot.scope.task,
    });

    return NextResponse.json({
      ok: true,
      data: {
        workspace: fcWs,
        rules,
        documents,
        renderers,
        scopeCheck,
        note:
          "formal_compliance_allowed=false 時僅可做相應預檢，不自動變完整科學核准；submission_execution_authorized=false（本輪不送件）。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "FINAL_SUBMISSION_INITIALIZATION_FAILED", error: `第十八階段最終合規初始化失敗：${message}`, recoverable: true },
      { status: 500 }
    );
  }
}