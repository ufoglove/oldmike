import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  runAnonymizationQa,
  runReferencesQa,
  runRenderQa,
  rendererCapabilities,
} from "@/lib/final-submission-v3-service";

export const FINAL_SUBMISSION_V3_CHECK_CONTRACT_VERSION =
  "final-submission-v3-check/1.0.0" as const;

/**
 * POST /api/projects/:projectId/final-submission-v3/check
 *
 * Runs deterministic compliance QA on candidate package content:
 * anonymization (metadata/comments/track changes, not just first page),
 * references integrity, and render capability gate. None of these prove
 * scientific correctness — that was handled upstream.
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
      candidateText?: string;
      metadataSample?: string;
      referenceBlock?: string;
      format?: string;
    };

    const anonymizationQa = runAnonymizationQa({
      candidateText: body.candidateText ?? "",
      metadataSample: body.metadataSample ?? "",
    });
    const referencesQa = runReferencesQa({ referenceBlock: body.referenceBlock ?? "" });

    const format = body.format ?? "markdown";
    const renderer = rendererCapabilities().find((r) => r.format === format);
    const renderQa = renderQaFor(renderer);

    return NextResponse.json({
      ok: true,
      data: {
        anonymizationQa,
        referencesQa,
        renderQa,
        renderers: rendererCapabilities(),
        note:
          "匿名化需掃 metadata、註解、修訂、表圖及附件，不只刪第一頁姓名；靜態 References 不冒充 Zotero Word 可刷新欄位。QA 通過不代表科學正確。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "COMPLIANCE_CHECK_FAILED", error: `最終合規 QA 失敗：${message}` },
      { status: 500 }
    );
  }
}

function renderQaFor(renderer: { format: string; available: boolean } | undefined) {
  if (!renderer) return runRenderQa({ hasRenderer: false, format: "unknown" });
  return runRenderQa({ hasRenderer: renderer.available, format: renderer.format });
}