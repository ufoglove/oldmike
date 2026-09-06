import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { addSubmissionEvent, verifyReceipt } from "@/lib/submission-tracking-v3-service";

export const SUBMISSION_TRACKING_V3_EVENTS_CONTRACT_VERSION =
  "submission-tracking-v3-events/1.0.0" as const;

/**
 * POST /api/projects/:projectId/submission-tracking-v3/events
 *
 * Records timeline events / receipts from REAL sources only. USER_REPORTED /
 * DOCUMENT_CHECKED / PROVIDER_EVENT are never auto-verified as official receipt.
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
      workOrderId?: string;
      eventType?: any;
      sourceTier?: any;
      sourceRef?: string;
      description?: string;
      timestamp?: string;
      rawPayload?: string;
      // receipt mode
      receipt?: boolean;
      caseId?: string;
      verifiedAgainst?: any;
    };

    if (!body.workOrderId || !body.sourceTier || !body.sourceRef) {
      return NextResponse.json(
        { ok: false, code: "MISSING_EVENT_INPUT", error: "需提供 workOrderId、sourceTier、sourceRef。" },
        { status: 400 }
      );
    }

    if (body.receipt) {
      const receipt = verifyReceipt({
        workOrderId: body.workOrderId,
        caseId: body.caseId ?? body.sourceRef,
        receivedAt: body.timestamp ?? new Date().toISOString(),
        verifiedAgainst: body.verifiedAgainst ?? body.sourceTier,
        sourceRef: body.sourceRef,
      });
      return NextResponse.json({
        ok: true,
        data: { receipt, note: receipt.verified ? "官方來源核對通過。" : "非官方來源：不等於官方收件。" },
      });
    }

    const event = addSubmissionEvent({
      workOrderId: body.workOrderId,
      timestamp: body.timestamp ?? new Date().toISOString(),
      eventType: body.eventType ?? "STATUS_CHANGE",
      sourceTier: body.sourceTier,
      sourceRef: body.sourceRef,
      description: body.description ?? "",
      rawPayload: body.rawPayload,
    });

    return NextResponse.json({
      ok: true,
      data: { event, note: "事件已記錄；verified 僅在 OFFICIAL_RECEIPT/OFFICIAL_PORTAL_OBSERVATION 時為 true。" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "EVENT_RECORD_FAILED", error: `事件記錄失敗：${message}` },
      { status: 500 }
    );
  }
}