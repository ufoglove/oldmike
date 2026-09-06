import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { decideReReview } from "@/lib/scientific-review-v3-service";
import { type ScientificFinding } from "@/lib/scientific-review-v3-contract";

export const SCIENTIFIC_REVIEW_V3_REREVIEW_CONTRACT_VERSION =
  "scientific-review-v3-rereview/1.0.0" as const;

/**
 * POST /api/projects/:projectId/scientific-review-v3/re-review
 *
 * Re-review decision: if the round reaches the cap with unresolved blockers,
 * the run is CLOSED_WITH_UNRESOLVED (issues preserved, no forced PASS).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;

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
      findings?: ScientificFinding[];
      round?: number;
      maxRounds?: number;
    };

    const findings = body.findings ?? [];
    const round = Math.max(1, body.round ?? 1);
    const maxRounds = Math.max(1, body.maxRounds ?? 3);

    const result = decideReReview({ findings, round, maxRounds });

    return NextResponse.json({
      ok: true,
      data: {
        reReviewDecision: result,
        note:
          result.decision === "CLOSED_WITH_UNRESOLVED"
            ? "已達重審上限，未解問題如實保留，不強制 PASS；作者可續修或接受限制（需真人理由）。"
            : "重審裁決完成。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "REREVIEW_DECISION_FAILED", error: `重審裁決失敗：${message}` },
      { status: 500 }
    );
  }
}