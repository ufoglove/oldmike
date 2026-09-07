import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  runFidelityChecks,
  runTerminologyCheck,
  runLanguageQa,
} from "@/lib/language-quality-v3-service";
import { type LanguageWorkOrder, type TermBinding } from "@/lib/language-quality-v3-contract";

const LANGUAGE_QUALITY_V3_CHECK_CONTRACT_VERSION =
  "language-quality-v3-check/1.0.0" as const;

/**
 * POST /api/projects/:projectId/language-quality-v3/check
 *
 * Runs the deterministic fidelity + terminology + QA on a single segment
 * (sourceText → targetText). Fidelity goes beyond token counts:
 * subject/group/timepoint/denominator/scale/unit/direction/negation/
 * causal strength/confirmatory-exploratory/limitation/citation ownership.
 * Provider translate/write calls are separate operations (see §4); this
 * route is the QA gate the UI must pass before adoption.
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
      sectionRef?: string;
      paragraphRef?: string;
      sourceText?: string;
      targetText?: string;
      termBindings?: TermBinding[];
    };

    if (!body.workOrder || typeof body.sourceText !== "string" || typeof body.targetText !== "string") {
      return NextResponse.json(
        { ok: false, code: "MISSING_CHECK_INPUT", error: "需提供 workOrder、sourceText 與 targetText。" },
        { status: 400 }
      );
    }

    const sectionRef = body.sectionRef ?? "RESULTS";
    // scope enforcement
    const allowed = body.workOrder.fullManuscriptLanguageAllowed || body.workOrder.languageAllowedScopeRefs.includes(sectionRef);
    if (!allowed) {
      return NextResponse.json(
        {
          ok: false,
          code: "LANGUAGE_SCOPE_NOT_AUTHORIZED",
          error: `章節 ${sectionRef} 不在語言准用 scope 內（fullManuscriptLanguageAllowed=false）。`,
          recoverable: true,
        },
        { status: 422 }
      );
    }

    const fidelity = runFidelityChecks({
      sectionRef,
      paragraphRef: body.paragraphRef,
      sourceText: body.sourceText,
      targetText: body.targetText,
    });
    const terminology = body.termBindings
      ? runTerminologyCheck({ termBindings: body.termBindings, targetText: body.targetText })
      : { issues: [], passed: true };

    const qa = runLanguageQa({
      fidelityIssues: fidelity.issues,
      terminologyIssues: terminology.issues,
      numericTokensHeld: !fidelity.issues.some((i) => (i.kind === "TOKEN_MODIFIED" || i.kind === "COMPARISON_DIRECTION_CHANGED" || i.kind === "DENOMINATOR_CHANGED") && i.severity === "FATAL"),
      citationRefsHeld: true,
    });

    return NextResponse.json({
      ok: true,
      data: {
        fidelityIssues: fidelity.issues,
        terminologyIssues: terminology.issues,
        qa,
        adoptedAllowed: qa.openFatalCount === 0,
        note:
          "保真檢查不限 token 數量：主語/群組/時點/分母/尺度/單位/方向/否定/因果強度/確認探索/限制皆受保護。回譯或第二引擎僅為輔助，不等於真人獨立驗證。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "CHECK_FAILED", error: `語言保真檢查失敗：${message}` },
      { status: 500 }
    );
  }
}