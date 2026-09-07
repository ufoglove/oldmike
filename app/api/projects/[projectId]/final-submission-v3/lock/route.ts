import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { confirmFreezeAndLock } from "@/lib/final-submission-v3-service";
import { type PackageDocument } from "@/lib/final-submission-v3-contract";

const FINAL_SUBMISSION_V3_LOCK_CONTRACT_VERSION =
  "final-submission-v3-lock/1.0.0" as const;

/**
 * POST /api/projects/:projectId/final-submission-v3/lock
 *
 * Locks the package after human confirmation on the fixed file version and
 * all required approvals collected. FREEZE_NOT_CONFIRMED if the human gate
 * is not met; APPROVAL_NOT_VERIFIED if approvals are pending. AI lock ≠
 * author consent or package lock.
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
      humanConfirmed?: boolean;
      pendingApprovals?: number;
    };

    if (!body.documents) {
      return NextResponse.json(
        { ok: false, code: "MISSING_LOCK_INPUT", error: "需提供 documents。" },
        { status: 400 }
      );
    }

    const result = confirmFreezeAndLock({
      documents: body.documents,
      humanConfirmed: body.humanConfirmed === true,
      pendingApprovals: body.pendingApprovals ?? 0,
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
        lockedDocuments: result.documents,
        packageLocked: result.packageLocked,
        note: "Package Lock 已完成（固定檔案版本、真人確認、核准齊備）。AI 自動鎖草稿 ≠ 作者同意或成果包正式鎖定。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "LOCK_FAILED", error: `成果包鎖定失敗：${message}` },
      { status: 500 }
    );
  }
}