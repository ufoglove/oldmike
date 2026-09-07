import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { type ScientificFinding } from "@/lib/scientific-review-v3-contract";

const SCIENTIFIC_REVIEW_V3_RESPOND_CONTRACT_VERSION =
  "scientific-review-v3-respond/1.0.0" as const;

/**
 * POST /api/projects/:projectId/scientific-review-v3/respond
 *
 * Records the author's decision + response for a finding. Authors may
 * disagree with justification (REJECTED_WITH_JUSTIFICATION / ACCEPTED_RISK);
 * the system does not force acceptance of every review point.
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
      finding?: ScientificFinding;
    };

    const f = body.finding;
    if (!f || !f.findingId) {
      return NextResponse.json(
        { ok: false, code: "FINDING_ID_REQUIRED", error: "需提供 findingId。" },
        { status: 400 }
      );
    }

    const allowedDecisions = [
      "OPEN", "ACCEPTED", "IN_REVISION", "RESOLVED_PENDING_REVIEW",
      "VERIFIED_RESOLVED", "ACCEPTED_RISK", "REJECTED_WITH_JUSTIFICATION", "NOT_APPLICABLE",
    ];
    if (!allowedDecisions.includes(f.decision)) {
      return NextResponse.json(
        { ok: false, code: "FINDING_DECISION_INVALID", error: "decision 不在允許清單。" },
        { status: 400 }
      );
    }

    // ACCEPTED_RISK cannot clear fabricated numbers, unauthorized data or
    // stale sources (spec §7) — enforce here at the contract layer.
    if (f.decision === "ACCEPTED_RISK") {
      const forbidden = ["FABRICATED", "UNAUTHORIZED_DATA", "STALE_SOURCE"];
      const hit = forbidden.find((k) => (f.description || "").includes(k));
      if (hit) {
        return NextResponse.json(
          {
            ok: false,
            code: "ACCEPTED_RISK_NOT_ALLOWED_FOR_THIS_FINDING",
            error: `本 Finding 涉及 ${hit}，不能以 ACCEPTED_RISK 解除；需真實修復或真人理由。`,
            recoverable: true,
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        findingId: f.findingId,
        decision: f.decision,
        authorResponse: f.authorResponse ?? "",
        authorCanDisagreeWithReason: true,
        note: "作者可有據不同意，不要求全部接受。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "RESPOND_FAILED", error: `作者回覆登記失敗：${message}` },
      { status: 500 }
    );
  }
}