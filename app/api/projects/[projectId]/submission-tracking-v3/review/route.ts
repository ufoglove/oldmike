import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  addExternalReview,
  addReviewItem,
  updateReviewItemResponse,
  createUpstreamRevisionRef,
  recordFormalDecision,
} from "@/lib/submission-tracking-v3-service";
import { type ExternalReview } from "@/lib/submission-tracking-v3-contract";

const SUBMISSION_TRACKING_V3_REVIEW_CONTRACT_VERSION =
  "submission-tracking-v3-review/1.0.0" as const;

/**
 * POST /api/projects/:projectId/submission-tracking-v3/review
 *
 * Records a real external review (isolated from U09/U16 simulated opinions),
 * adds review items, and routes upstream revision refs. Inbound payloads are
 * treated as DATA only — no send/shell/secret/arbitrary-URL capabilities.
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
      action?: "CREATE_REVIEW" | "ADD_ITEM" | "RESPOND" | "UPSTREAM_REF" | "DECISION";
      workOrderId?: string;
      round?: number;
      reviewerLabel?: string;
      receivedAt?: string;
      rawText?: string;
      sourceVerified?: boolean;
      review?: ExternalReview;
      itemId?: string;
      originalQuote?: string;
      locationRef?: string;
      category?: any;
      decision?: any;
      responseDraft?: string;
      actualChangeRef?: string;
      destinationStage?: any;
      changeRequestRef?: string;
      evidenceRef?: string;
    };

    switch (body.action) {
      case "CREATE_REVIEW": {
        const review = addExternalReview({
          workOrderId: body.workOrderId ?? "wst_unknown",
          round: body.round ?? 1,
          reviewerLabel: body.reviewerLabel ?? "未具名審查者（待驗證）",
          receivedAt: body.receivedAt ?? new Date().toISOString(),
          rawText: body.rawText ?? "",
          sourceVerified: body.sourceVerified === true,
        });
        return NextResponse.json({
          ok: true,
          data: { review, note: "真實外部審查已隔離記錄（≠ U09/U16 模擬）。原文 hash 已保存；來源未驗證不標 verified。" },
        });
      }
      case "ADD_ITEM": {
        if (!body.review || !body.originalQuote || !body.locationRef) {
          return NextResponse.json({ ok: false, code: "MISSING_ITEM_INPUT", error: "需提供 review、originalQuote、locationRef。" }, { status: 400 });
        }
        const updated = addReviewItem({ review: body.review, originalQuote: body.originalQuote, locationRef: body.locationRef, category: body.category ?? "OTHER" });
        return NextResponse.json({ ok: true, data: { review: updated } });
      }
      case "RESPOND": {
        if (!body.review || !body.itemId) return NextResponse.json({ ok: false, code: "MISSING_RESPOND_INPUT", error: "需提供 review、itemId。" }, { status: 400 });
        const result = updateReviewItemResponse({
          review: body.review,
          itemId: body.itemId,
          decision: body.decision ?? "REQUEST_CLARIFICATION",
          responseDraft: body.responseDraft ?? "",
          actualChangeRef: body.actualChangeRef,
          canDisagree: true,
        });
        if (!result.ok) return NextResponse.json({ ok: false, code: result.code, error: result.reason, recoverable: true }, { status: 422 });
        return NextResponse.json({
          ok: true,
          data: { review: result.review, note: "「已新增分析/文獻/修改」必須連到實際證據；沒有完成只能寫待辦，不假裝已執行。" },
        });
      }
      case "UPSTREAM_REF": {
        const ref = createUpstreamRevisionRef({
          destinationStage: body.destinationStage ?? "final-compliance",
          changeRequestRef: body.changeRequestRef ?? "",
          workOrderId: body.workOrderId ?? "wst_unknown",
        });
        return NextResponse.json({ ok: true, data: { upstreamRef: ref, note: "回 U14/U13/U15/U16/U17/U18 修訂；return locator 已保存。" } });
      }
      case "DECISION": {
        const result = recordFormalDecision({
          workOrder: { workOrderId: body.workOrderId ?? "wst_unknown", round: body.round ?? 1 } as any,
          decision: body.decision ?? "NOT_DECISIONED",
          evidenceRef: body.evidenceRef ?? "",
          sourceVerified: body.sourceVerified === true,
        });
        if (!result.ok) return NextResponse.json({ ok: false, code: result.code, error: result.reason, recoverable: true }, { status: 422 });
        return NextResponse.json({
          ok: true,
          data: { decision: result.decision, rationale: result.rationale, note: "Reviewer recommend accept ≠ editor accept；接受≠出版，核定≠款到或人體研究授權。" },
        });
      }
      default:
        return NextResponse.json({ ok: false, code: "UNKNOWN_REVIEW_ACTION", error: "需指定 action。" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "REVIEW_FAILED", error: `審查往返處理失敗：${message}` },
      { status: 500 }
    );
  }
}