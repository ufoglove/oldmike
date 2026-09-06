import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  segmentByParagraphs,
  assertLanguageScopeAuthorized,
  runFidelityChecks,
  runTerminologyCheck,
  runLanguageQa,
  buildProviderCapabilityManifest,
} from "@/lib/language-quality-v3-service";
import { type LanguageWorkOrder, type TermBinding } from "@/lib/language-quality-v3-contract";

export const LANGUAGE_QUALITY_V3_SEGMENTS_CONTRACT_VERSION =
  "language-quality-v3-segments/1.0.0" as const;

/**
 * POST /api/projects/:projectId/language-quality-v3/segments
 *
 * Registers source segments (real UTF-8 text from the caller / existing
 * manuscript body) scoped to language_allowed_scope_refs, and runs the
 * deterministic fidelity + terminology checks on the CURRENT target text
 * (if any). Provider translate calls remain separate (see /check).
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
      sections?: Array<{ sectionRef: string; paragraphRef?: string; text: string }>;
      termBindings?: TermBinding[];
    };

    const { workOrder, sections, termBindings } = body;
    if (!workOrder || !sections || sections.length === 0) {
      return NextResponse.json(
        { ok: false, code: "MISSING_SEGMENTS", error: "需提供 workOrder 與至少一個章節段落。" },
        { status: 400 }
      );
    }

    // Scope enforcement: drop sections outside language_allowed_scope_refs
    const allowedSections: typeof sections = [];
    const rejectedSections: string[] = [];
    for (const s of sections) {
      const scopeCheck = assertLanguageScopeAuthorized({ workOrder, sectionRef: s.sectionRef });
      if (scopeCheck.ok) allowedSections.push(s);
      else rejectedSections.push(s.sectionRef);
    }

    const { segments, overLimitSegments } = segmentByParagraphs({ sections: allowedSections });

    // Fidelity + terminology on current target text (targetText may be empty → no issues)
    const allFidelity: Array<Awaited<ReturnType<typeof runFidelityChecks>>["issues"][number]> = [];
    const allTerminology: typeof allFidelity = [];
    for (const seg of segments) {
      const f = runFidelityChecks({ sectionRef: seg.sectionRef, paragraphRef: seg.paragraphRef, sourceText: seg.sourceText, targetText: seg.targetText });
      allFidelity.push(...f.issues);
      if (termBindings) {
        const t = runTerminologyCheck({ termBindings, targetText: seg.targetText });
        allTerminology.push(...t.issues);
      }
    }

    const qa = runLanguageQa({
      fidelityIssues: allFidelity,
      terminologyIssues: allTerminology,
      numericTokensHeld: allFidelity.filter((i) => i.kind === "TOKEN_MODIFIED").length === 0,
      citationRefsHeld: true, // citation nodes handled by /check (renderer layer)
    });

    return NextResponse.json({
      ok: true,
      data: {
        segments,
        overLimitSegments,
        rejectedSections,
        fidelityIssues: allFidelity,
        terminologyIssues: allTerminology,
        qa,
        providerCapabilities: buildProviderCapabilityManifest(),
        note: "段以 UTF-8 bytes 計量（不以中文字數當 bytes）；scope 外章節已拒絕。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "SEGMENTS_FAILED", error: `語言分段失敗：${message}` },
      { status: 500 }
    );
  }
}