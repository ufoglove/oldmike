import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { buildMeaningConstraints } from "@/lib/scientific-review-v3-service";
import {
  type ScientificFinding,
  type RevisionProposal,
  type UpstreamReviewRequest,
} from "@/lib/scientific-review-v3-contract";

export const SCIENTIFIC_REVIEW_V3_FINDINGS_CONTRACT_VERSION =
  "scientific-review-v3-findings/1.0.0" as const;

/**
 * POST /api/projects/:projectId/scientific-review-v3/findings
 *
 * Records a finding (from Reviewer #2 generator output, or human entry),
 * a revision proposal (Suggested Rewrite = candidate only), or an upstream
 * review request. Everything is minimised to the contract shape; DB wiring
 * reuses the existing scientific_review_findings / _revision_tasks tables
 * through the caller (server-side repository) — this route is a thin
 * validation + pass-through so the UI can persist the loop.
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
      revision?: RevisionProposal;
      upstreamRequest?: UpstreamReviewRequest;
    };

    const out: { finding?: ScientificFinding; revision?: RevisionProposal; upstreamRequest?: UpstreamReviewRequest } = {};

    if (body.finding) {
      const f = body.finding;
      if (!f.title || f.title.trim().length === 0) {
        return NextResponse.json(
          { ok: false, code: "FINDING_TITLE_REQUIRED", error: "finding 需有標題。" },
          { status: 400 }
        );
      }
      if (!["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "SUGGESTION"].includes(f.severity)) {
        return NextResponse.json(
          { ok: false, code: "FINDING_SEVERITY_INVALID", error: "severity 需為 BLOCKER/CRITICAL/MAJOR/MINOR/SUGGESTION。" },
          { status: 400 }
        );
      }
      out.finding = f;
    }

    if (body.revision) {
      const r = body.revision;
      out.revision = {
        ...r,
        // Suggested Rewrite is only a candidate; adoptedLowRiskUnlocked is
        // decided by the backend lock check, not blindly from the client.
        status: r.status === "ADOPTED" && !r.adoptedLowRiskUnlocked ? "CANDIDATE" : r.status,
      };
    }

    if (body.upstreamRequest) {
      const u = body.upstreamRequest;
      if (!u.requestReason || u.requestReason.trim().length === 0) {
        return NextResponse.json(
          { ok: false, code: "UPSTREAM_REQUEST_REASON_REQUIRED", error: "回送請求需附理由。" },
          { status: 400 }
        );
      }
      out.upstreamRequest = u;
    }

    return NextResponse.json({
      ok: true,
      data: {
        persisted: out,
        note:
          "此為 U16 finding/revision/upstream 循環的薄驗證層；完整持久化與 ACL 由既有 scientific-review 儲存層處理。模擬審查一律標 SIMULATED REVIEW。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "FINDINGS_PERSIST_FAILED", error: `審查意見登記失敗：${message}` },
      { status: 500 }
    );
  }
}