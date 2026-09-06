import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { type FinalSubmissionPackageSnapshot } from "@/lib/final-submission-v3-contract";

export const FINAL_SUBMISSION_V3_EXPORT_CONTRACT_VERSION =
  "final-submission-v3-export/1.0.0" as const;

const SUPPORTED = new Set(["json", "package-manifest", "approval-subjects", "qa-report", "markdown"]);

/**
 * GET /api/projects/:projectId/final-submission-v3/export?format=…
 *
 * Real exports from the latest persisted FinalSubmissionPackageSnapshot.
 * Markdown/json are genuinely available; DOCX/PDF/LaTeX are UNSUPPORTED
 * (never claim a Markdown file is submission-ready for those targets).
 * Unsupported formats → EXPORT_FORMAT_UNSUPPORTED.
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
          error: `匯出格式 ${format} 不受支援；支援：${Array.from(SUPPORTED).join(", ")}。DOCX/PDF/LaTeX 未實作，如實標示 UNSUPPORTED，不以 Markdown 冒稱可送件。`,
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
        "final-compliance"
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
          code: "STAGE18_NOT_COMPLETED",
          error: "尚未完成第十八階段最終合規，請先完成成果包並保存交接。",
          recoverable: true,
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as FinalSubmissionPackageSnapshot;
    const filenameDate = new Date().toISOString().replace(/[:.]/g, "-");

    switch (format) {
      case "json": {
        const body = JSON.stringify(snapshot, null, 2);
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="final-submission-package-${projectId}-${filenameDate}.json"`,
            "X-Snapshot-Id": snapshot.snapshotId,
            "X-Schema-Version": snapshot.schemaVersion,
            "X-Submission-Authorized": String(snapshot.submissionExecutionAuthorized),
          },
        });
      }
      case "package-manifest": {
        const body = JSON.stringify(
          {
            schema: "final-submission-package-manifest/1.0.0",
            source: snapshot.snapshotId,
            decision: snapshot.decision,
            route: snapshot.route,
            packageLocked: snapshot.packageLocked,
            documents: snapshot.documents.map((d) => ({ documentId: d.documentId, kind: d.kind, filename: d.filename, contentHash: d.contentHash, byteSize: d.byteSize, format: d.format, status: d.status })),
            approvalSubjectManifestContentHash: snapshot.approvalSubjectManifest.contentHash,
            pendingAuthorApprovals: snapshot.pendingAuthorApprovals,
            note: "靜態 References 不冒充 Zotero Word 動態欄位；DOCX/PDF/LaTeX 未具備時 UNSUPPORTED。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="package-manifest-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "approval-subjects": {
        const body = JSON.stringify(
          {
            schema: "approval-subject-manifest/1.0.0",
            source: snapshot.snapshotId,
            manifest: snapshot.approvalSubjectManifest,
            approvals: snapshot.authorApprovals,
            note: "ApprovalSubjectManifest 不含 approval 事件（hash 無循環）；核准綁定具體文件 digest。通訊作者轉述不得冒充每位作者親自點擊。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="approval-subjects-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "qa-report": {
        const body = JSON.stringify(
          {
            schema: "final-compliance-qa/1.0.0",
            source: snapshot.snapshotId,
            checks: {
              anonymizationQaPassed: snapshot.anonymizationQaPassed,
              referencesQaPassed: snapshot.referencesQaPassed,
              renderQaPassed: snapshot.renderQaPassed,
              freezeConfirmed: snapshot.freezeConfirmed,
              packageLocked: snapshot.packageLocked,
              sensitiveContentExcluded: snapshot.sensitiveContentExcluded,
            },
            note: "機械 QA 不證明科學正確或官方核准；匿名化需掃 metadata/註解/修訂/表圖/附件，不只刪第一頁姓名。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="compliance-qa-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "markdown":
      default: {
        const lines: string[] = [];
        lines.push(`# Final Submission Package Snapshot — ${snapshot.projectId}`);
        lines.push("");
        lines.push(`> **Snapshot ID**: \`${snapshot.snapshotId}\``);
        lines.push(`> **Schema**: \`${snapshot.schemaVersion}\``);
        lines.push(`> **Stage**: ${snapshot.stageKey} → ${snapshot.nextStageId}`);
        lines.push(`> **Decision**: ${snapshot.decision}`);
        lines.push(`> **Route**: ${snapshot.route}`);
        lines.push(`> **Primary Goal**: ${snapshot.primaryGoal}`);
        lines.push(`> **Submission Execution Authorized**: ${snapshot.submissionExecutionAuthorized}`);
        lines.push("");
        lines.push("## Documents");
        lines.push("");
        for (const d of snapshot.documents) {
          lines.push(`- **${d.kind}** \`${d.filename}\` — ${d.status} (hash ${d.contentHash ? d.contentHash.slice(0, 12) : "(未 freeze)"})`);
        }
        lines.push("");
        lines.push("## QA");
        lines.push("");
        lines.push(`- Anonymization QA: ${snapshot.anonymizationQaPassed ? "PASS" : "FAIL"}`);
        lines.push(`- References QA: ${snapshot.referencesQaPassed ? "PASS" : "FAIL"}`);
        lines.push(`- Render QA: ${snapshot.renderQaPassed ? "PASS" : "FAIL"}`);
        lines.push(`- Package locked: ${snapshot.packageLocked}`);
        lines.push("");
        lines.push(`- Required approvals: ${snapshot.requiredAuthorApprovals}`);
        lines.push(`- Pending approvals: ${snapshot.pendingAuthorApprovals}`);
        lines.push("");
        lines.push(`*Manifest level — generated ${new Date().toISOString()}*`);
        lines.push("");
        lines.push("_READY ≠ SUBMITTED ≠ official approval. submission_execution_authorized=false._");
        const body = lines.join("\n");
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="final-submission-manifest-${projectId}-${filenameDate}.md"`,
            "X-Submission-Authorized": "false",
          },
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "EXPORT_FAILED", error: `第十八階段匯出失敗：${message}` },
      { status: 500 }
    );
  }
}