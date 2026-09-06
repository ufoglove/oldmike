import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import {
  generateReviewer2Challenges,
  deduplicateFindings,
  buildMeaningConstraints,
} from "@/lib/scientific-review-v3-service";
import { type ManuscriptWritingSnapshot } from "@/lib/manuscript-writing-contract";

export const SCIENTIFIC_REVIEW_V3_REVIEWER2_CONTRACT_VERSION =
  "scientific-review-v3-reviewer2/1.0.0" as const;

/**
 * POST /api/projects/:projectId/scientific-review-v3/reviewer2
 *
 * Generates Reviewer #2 constructive challenges from the Stage 15 snapshot.
 * All findings are SIMULATED REVIEW; each has evidence basis, alternative
 * explanation, and minimal revision path. Deterministic — no LLM calls.
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

    const body = (await request.json().catch(() => ({}))) as { manuscriptWritingSnapshot?: ManuscriptWritingSnapshot };

    let snapshot: ManuscriptWritingSnapshot | null = body.manuscriptWritingSnapshot ?? null;
    if (!snapshot) {
      const mwCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "results-writing"
      );
      if (mwCompletion?.snapshotData) {
        snapshot = mwCompletion.snapshotData as ManuscriptWritingSnapshot;
      }
    }
    if (!snapshot || !snapshot.snapshotId) {
      return NextResponse.json(
        { ok: false, code: "MANUSCRIPT_HANDOFF_REQUIRED", error: "未找到第十五階段交接快照。" },
        { status: 400 }
      );
    }

    const raw = generateReviewer2Challenges({ snapshot });
    const deduped = deduplicateFindings({ findings: raw.map((f) => ({ ...f, findingId: "tmp", reviewRunId: "tmp", createdAt: "", updatedAt: "", decision: "OPEN" as const, authorResponse: "", authorCanDisagreeWithReason: true })) as any });
    const constraints = buildMeaningConstraints({ snapshot });

    return NextResponse.json({
      ok: true,
      data: {
        simulated: true,
        note: "以下為 SIMULATED REVIEW：多角色為多角度模擬，不是多名真人獨立驗證。",
        findings: deduped.map((f) => ({ ...f, findingId: undefined, reviewRunId: undefined })),
        constraints,
        mechanicalQa: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "REVIEWER2_GENERATION_FAILED", error: `Reviewer #2 挑戰生成失敗：${message}` },
      { status: 500 }
    );
  }
}