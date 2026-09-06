import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildApprovalSubjectManifest,
  approveDocument,
} from "@/lib/final-submission-v3-service";
import { type PackageDocument } from "@/lib/final-submission-v3-contract";

export const FINAL_SUBMISSION_V3_APPROVE_CONTRACT_VERSION =
  "final-submission-v3-approve/1.0.0" as const;

/**
 * POST /api/projects/:projectId/final-submission-v3/approve
 *
 * Approves a specific frozen document by digest. The ApprovalSubjectManifest
 * is hashed WITHOUT approval events (no hash cycle); approvals bind to the
 * frozen document digest. Corresponding-author relay does NOT impersonate
 * each author's personal click.
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
      documentId?: string;
      verifiedOfflineRef?: string;
    };

    if (!body.documents || !body.documentId) {
      return NextResponse.json(
        { ok: false, code: "MISSING_APPROVAL_INPUT", error: "需提供 documents 與 documentId。" },
        { status: 400 }
      );
    }

    const manifest = buildApprovalSubjectManifest({
      projectId,
      documents: body.documents,
      createdBy: authenticated.session.user.id,
    });

    const result = approveDocument({
      manifest,
      documentId: body.documentId,
      verifiedOfflineRef: body.verifiedOfflineRef ?? `user:${authenticated.session.user.id}`,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, error: result.reason, recoverable: true },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        approval: result.record,
        subjectManifestId: manifest.manifestId,
        contentHash: manifest.contentHash,
        note: "核准綁定具體檔案 digest；文稿/附件/作者/聲明改動後舊核准不得沿用新 bytes。通訊作者轉述不得冒充每位作者親自點擊。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "APPROVAL_FAILED", error: `核准登記失敗：${message}` },
      { status: 500 }
    );
  }
}