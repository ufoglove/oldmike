import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { freezeDocuments } from "@/lib/final-submission-v3-service";
import { type PackageDocument } from "@/lib/final-submission-v3-contract";

const FINAL_SUBMISSION_V3_FREEZE_CONTRACT_VERSION =
  "final-submission-v3-freeze/1.0.0" as const;

/**
 * POST /api/projects/:projectId/final-submission-v3/freeze
 *
 * Freezes candidate documents by hashing their exact content. After freeze,
 * approval records bind to these digests (no hash cycle). Missing content ⇒
 * DOCUMENT_HASH_MISMATCH.
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
      documents?: PackageDocument[];
      contentByDocumentId?: Record<string, string>;
    };

    if (!body.documents || !body.contentByDocumentId) {
      return NextResponse.json(
        { ok: false, code: "MISSING_FREEZE_INPUT", error: "需提供 documents 與 contentByDocumentId。" },
        { status: 400 }
      );
    }

    const result = freezeDocuments({ documents: body.documents, contentByDocumentId: body.contentByDocumentId });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, error: `以下文件缺少 freeze 內容：${result.missing.join(", ")}。`, recoverable: true },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        frozenDocuments: result.documents,
        note: "已 freeze（含 digest）；freeze 後才收 approval，避免 hash 循環。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "FREEZE_FAILED", error: `候選文件 freeze 失敗：${message}` },
      { status: 500 }
    );
  }
}