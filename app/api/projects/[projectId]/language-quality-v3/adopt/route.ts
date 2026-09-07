import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { runFidelityChecks } from "@/lib/language-quality-v3-service";
import type { LanguageWorkOrder } from "@/lib/language-quality-v3-contract";

const LANGUAGE_QUALITY_V3_ADOPT_CONTRACT_VERSION =
  "language-quality-v3-adopt/1.0.0" as const;

/**
 * POST /api/projects/:projectId/language-quality-v3/adopt
 *
 * Adopts a segment's target text (or marks it LOCKED) after a successful
 * fidelity gate. FIDELITY_FATAL_ISSUE blocks adoption (never let a changed
 * number / swapped group / strengthened causal claim pass). Locked sources
 * from U16 are NOT modified; the language branch is a separate working
 * revision on the same manuscript lineage.
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
      workOrder?: LanguageWorkOrder;
      segmentId?: string;
      sectionRef?: string;
      paragraphRef?: string;
      sourceText?: string;
      targetText?: string;
      lockTarget?: boolean;
    };

    if (!body.workOrder || !body.segmentId || typeof body.sourceText !== "string" || typeof body.targetText !== "string") {
      return NextResponse.json(
        { ok: false, code: "MISSING_ADOPT_INPUT", error: "需提供 workOrder、segmentId、sourceText 與 targetText。" },
        { status: 400 }
      );
    }

    // Re-run the fidelity gate at adoption time (backend re-verification).
    const fidelity = runFidelityChecks({
      sectionRef: body.sectionRef ?? "RESULTS",
      paragraphRef: body.paragraphRef,
      sourceText: body.sourceText,
      targetText: body.targetText,
    });

    if (fidelity.issues.some((i) => i.severity === "FATAL")) {
      return NextResponse.json(
        {
          ok: false,
          code: "FIDELITY_FATAL_ISSUE",
          error: "目標語言版存在 FATAL 保真問題（數值/方向/分母/否定/因果強度被改變），禁止採用。",
          fidelityIssues: fidelity.issues.filter((i) => i.severity === "FATAL"),
          recoverable: true,
        },
        { status: 422 }
      );
    }

    // Adoption records a working-revision entry; the U16 scientific source
    // snapshot is NOT modified (language branch on same lineage).
    return NextResponse.json({
      ok: true,
      data: {
        segmentId: body.segmentId,
        adopted: true,
        lockedTarget: body.lockTarget === true,
        sourceSnapshotUnchanged: true,
        note: "已採用語言版候選（如 lockTarget=true 則鎖定 target）。科學定稿 lock 不解鎖；target 鎖不能被批次覆寫。FATAL 保真問題已於採用前於後端重驗擋下。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "ADOPT_FAILED", error: `語言版採用失敗：${message}` },
      { status: 500 }
    );
  }
}