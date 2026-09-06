import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { type SubmissionTrackingSnapshot } from "@/lib/submission-tracking-v3-contract";

export const SUBMISSION_TRACKING_V3_EXPORT_CONTRACT_VERSION =
  "submission-tracking-v3-export/1.0.0" as const;

const SUPPORTED = new Set(["json", "timeline", "response-matrix", "qa-report", "markdown"]);

/**
 * GET /api/projects/:projectId/submission-tracking-v3/export?format=…
 *
 * Real exports from the latest persisted SubmissionTrackingSnapshot.
 * Unsupported → EXPORT_FORMAT_UNSUPPORTED (no fake downloads).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";
    const format = (request.nextUrl.searchParams.get("format") || "json").toLowerCase();

    if (!SUPPORTED.has(format)) {
      return NextResponse.json(
        {
          ok: false,
          code: "EXPORT_FORMAT_UNSUPPORTED",
          error: `匯出格式 ${format} 不受支援；支援：${Array.from(SUPPORTED).join(", ")}。DOCX/PDF/LaTeX 未實作，如實標示 UNSUPPORTED。`,
          recoverable: true,
        },
        { status: 400 }
      );
    }

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

    let completionRecord;
    try {
      completionRecord = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "submission-tracking"
      );
    } catch (error) {
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (isStorageError) {
        return NextResponse.json({ ok: false, code: "STORAGE_UNAVAILABLE", error: "storage_unavailable", recoverable: true }, { status: 503 });
      }
      throw error;
    }

    if (!completionRecord?.snapshotData) {
      return NextResponse.json(
        {
          ok: false,
          code: "STAGE19_NOT_COMPLETED",
          error: "尚未完成第十九階段送件追蹤，請先完成交接。",
          recoverable: true,
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as SubmissionTrackingSnapshot;
    const filenameDate = new Date().toISOString().replace(/[:.]/g, "-");

    switch (format) {
      case "json": {
        const body = JSON.stringify(snapshot, null, 2);
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="submission-tracking-${projectId}-${filenameDate}.json"`,
            "X-Snapshot-Id": snapshot.snapshotId,
            "X-Schema-Version": snapshot.schemaVersion,
            "X-Submission-Authorized": String(snapshot.submissionExecutionAuthorized),
          },
        });
      }
      case "timeline": {
        const body = JSON.stringify(
          {
            schema: "submission-timeline/1.0.0",
            source: snapshot.snapshotId,
            workOrderId: snapshot.workOrderId,
            round: snapshot.workOrder.round,
            events: snapshot.events.map((e) => ({ eventId: e.eventId, timestamp: e.timestamp, eventType: e.eventType, sourceTier: e.sourceTier, verified: e.verified, description: e.description })),
            receipts: snapshot.receipts,
            note: "verified 僅在官方來源時為 true；USER_REPORTED 不等於官方收件。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="timeline-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "response-matrix": {
        const body = JSON.stringify(
          {
            schema: "external-response-matrix/1.0.0",
            source: snapshot.snapshotId,
            responseMatrixRef: snapshot.responseMatrixRef,
            reviews: snapshot.externalReviews.map((r) => ({
              reviewId: r.reviewId,
              round: r.round,
              sourceVerified: r.sourceVerified,
              itemCount: r.items.length,
              items: r.items.map((i) => ({ itemId: i.itemId, category: i.category, decision: i.decision, status: i.status, actualChangeRef: i.actualChangeRef ?? null })),
            })),
            note: "「已新增分析/文獻/修改」必須連到實際證據；沒有完成只能寫待辦。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="response-matrix-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "qa-report": {
        const body = JSON.stringify(
          {
            schema: "submission-tracking-qa/1.0.0",
            source: snapshot.snapshotId,
            checks: {
              decision: snapshot.decision,
              activeSubmissionGuard: snapshot.activeSubmissionGuard,
              submissionExecutionAuthorized: snapshot.submissionExecutionAuthorized,
              attemptCount: snapshot.attempts.length,
              eventCount: snapshot.events.length,
              verifiedReceiptCount: snapshot.receipts.filter((r) => r.verified).length,
              reviewCount: snapshot.externalReviews.length,
              revisedPackageSnapshotId: snapshot.revisedPackageSnapshotId ?? null,
            },
            note: "機械 QA 不證明官方決定；等待審查是正常狀態，不為亮綠燈捏造接受。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="submission-qa-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "markdown":
      default: {
        const lines: string[] = [];
        lines.push(`# Submission Tracking Snapshot — ${snapshot.projectId}`);
        lines.push("");
        lines.push(`> **Snapshot ID**: \`${snapshot.snapshotId}\``);
        lines.push(`> **Schema**: \`${snapshot.schemaVersion}\``);
        lines.push(`> **Stage**: ${snapshot.stageKey} → ${snapshot.nextStageId}`);
        lines.push(`> **Decision**: ${snapshot.decision}`);
        lines.push(`> **Round**: ${snapshot.workOrder.round}`);
        lines.push(`> **Primary Goal**: ${snapshot.primaryGoal}`);
        lines.push(`> **Submission Execution Authorized**: ${snapshot.submissionExecutionAuthorized}`);
        lines.push(`> **Active Submission Guard**: ${snapshot.activeSubmissionGuard}`);
        lines.push("");
        lines.push("## Timeline");
        lines.push("");
        for (const e of snapshot.events.slice(-10)) {
          lines.push(`- ${e.timestamp} [${e.eventType}] (${e.sourceTier}, verified=${e.verified}) ${e.description}`);
        }
        if (snapshot.events.length === 0) lines.push("_（尚無事件）_");
        lines.push("");
        lines.push("## Reviews & Response");
        lines.push("");
        for (const r of snapshot.externalReviews) {
          lines.push(`- Review ${r.round} (verified=${r.sourceVerified}) — ${r.items.length} items`);
        }
        if (snapshot.externalReviews.length === 0) lines.push("_（尚無外部審查）_");
        lines.push("");
        lines.push(`*Manifest level — generated ${new Date().toISOString()}*`);
        lines.push("");
        lines.push("_等待審查是正常狀態；接受≠出版，核定≠款到或人體研究授權。_");
        const body = lines.join("\n");
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="submission-tracking-manifest-${projectId}-${filenameDate}.md"`,
            "X-Submission-Authorized": String(snapshot.submissionExecutionAuthorized),
          },
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "EXPORT_FAILED", error: `第十九階段匯出失敗：${message}` },
      { status: 500 }
    );
  }
}