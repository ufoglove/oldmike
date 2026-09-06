import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  authorizeSubmissionAttempt,
  markAttemptDispatched,
  markAttemptOutcomeUnknown,
  verifyAttemptReceipt,
} from "@/lib/submission-tracking-v3-service";
import { type SubmissionWorkOrder } from "@/lib/submission-tracking-v3-contract";

export const SUBMISSION_TRACKING_V3_ATTEMPT_CONTRACT_VERSION =
  "submission-tracking-v3-attempt/1.0.0" as const;

/**
 * POST /api/projects/:projectId/submission-tracking-v3/attempt
 *
 * Creates an external submission attempt with reservation. Actual dispatch is
 * human-guided (GUIDED_MANUAL). Timeout → OUTCOME_UNKNOWN (no auto re-dispatch).
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
      workOrder?: SubmissionWorkOrder;
      packageLocked?: boolean;
      contentHash?: string;
      validUntil?: string;
      action?: "DISPATCH" | "OUTCOME_UNKNOWN" | "VERIFY_RECEIPT";
      attempt?: any;
      receiptReference?: string;
    };

    const { workOrder } = body;
    if (!workOrder) {
      return NextResponse.json({ ok: false, code: "MISSING_WORK_ORDER", error: "需提供 workOrder。" }, { status: 400 });
    }

    switch (body.action) {
      case "DISPATCH": {
        if (!body.attempt) {
          return NextResponse.json({ ok: false, code: "ATTEMPT_NOT_RESERVED", error: "需先建立 reservation 才有 attempt。" }, { status: 400 });
        }
        const dispatched = markAttemptDispatched({ attempt: body.attempt, dispatchedAt: new Date().toISOString() });
        return NextResponse.json({ ok: true, data: { attempt: dispatched, note: "已標派送；等待真實回執。timeout 記 OUTCOME_UNKNOWN 而非自動重送。" } });
      }
      case "OUTCOME_UNKNOWN": {
        if (!body.attempt) return NextResponse.json({ ok: false, code: "ATTEMPT_MISSING", error: "需提供 attempt。" }, { status: 400 });
        return NextResponse.json({ ok: true, data: { attempt: markAttemptOutcomeUnknown({ attempt: body.attempt }), note: "timeout/取消後可能已送出；先對帳，不自動重送。" } });
      }
      case "VERIFY_RECEIPT": {
        if (!body.attempt) return NextResponse.json({ ok: false, code: "ATTEMPT_MISSING", error: "需提供 attempt。" }, { status: 400 });
        const verified = verifyAttemptReceipt({ attempt: body.attempt, receiptReference: body.receiptReference ?? "" });
        if (!verified.ok) {
          return NextResponse.json({ ok: false, code: verified.code, error: verified.reason, recoverable: true }, { status: 422 });
        }
        return NextResponse.json({ ok: true, data: { attempt: verified.attempt, note: "回執經官方來源核對才標 RECEIPT_VERIFIED。" } });
      }
      default: {
        const authorized = authorizeSubmissionAttempt({
          workOrder,
          packageLocked: body.packageLocked === true,
          contentHash: body.contentHash ?? "",
          authorizedBy: authenticated.session.user.id,
          validUntil: body.validUntil ?? new Date(Date.now() + 7 * 86400_000).toISOString(),
        });
        if (!authorized.ok) {
          return NextResponse.json({ ok: false, code: authorized.code, error: authorized.reason, recoverable: true }, { status: 422 });
        }
        return NextResponse.json({
          ok: true,
          data: { attempt: authorized.attempt, note: "Attempt 已 reservation；派送為人工導引（GUIDED_MANUAL）。" },
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "ATTEMPT_FAILED", error: `送件 attempt 失敗：${message}` },
      { status: 500 }
    );
  }
}