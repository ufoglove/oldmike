import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { type ManuscriptWritingSnapshot } from "@/lib/manuscript-writing-contract";

const MANUSCRIPT_WRITING_EXPORT_CONTRACT_VERSION =
  "manuscript-writing-export/1.0.0" as const;

const text = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * GET /api/projects/:projectId/manuscript-writing/export?format=markdown|json|references|fact-manifest
 *
 * Spec §28 minimum real exports: Markdown full text, structured JSON,
 * References list, Citation / Fact / Table / Figure manifests, mechanical QA
 * report. Per spec §28, downloads must actually have file bytes and checksum;
 * we DO NOT generate fake download URLs.
 *
 * Source: latest stage_completion_snapshots row for stage_id='results-writing'
 * (per Stage 15 init DB persistence pattern). If unavailable, return 409 so
 * the UI can prompt the user to complete Stage 15 first.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";
    const format = (request.nextUrl.searchParams.get("format") || "markdown").toLowerCase();

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
        "results-writing"
      );
    } catch (error) {
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (isStorageError) {
        return NextResponse.json(
          {
            ok: false,
            code: "STORAGE_UNAVAILABLE",
            error: "storage_unavailable",
            recoverable: true,
          },
          { status: 503 }
        );
      }
      throw error;
    }

    if (!completionRecord?.snapshotData) {
      return NextResponse.json(
        {
          ok: false,
          code: "STAGE15_NOT_COMPLETED",
          error: "尚未完成第十五階段交接，請先完成全文寫作並完成 Stage 15。",
          recoverable: true,
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as ManuscriptWritingSnapshot;
    // We don't have sections inside the snapshot; for §28 we provide the
    // minimal structured manifests we DO have. To get full sections the UI
    // can POST /manuscript-writing/initialize again with the snapshot and then
    // call /export?format=… with workspace=… (future work). For this round
    // we emit the snapshot-level exports only — and we mark them so in the
    // filename header per spec §28 ("不生成假下載或假成功").
    const filenameDate = new Date().toISOString().replace(/[:.]/g, "-");

    switch (format) {
      case "json": {
        const body = JSON.stringify(snapshot, null, 2);
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="manuscript-snapshot-${projectId}-${filenameDate}.json"`,
            "X-Snapshot-Id": snapshot.snapshotId,
            "X-Schema-Version": snapshot.schemaVersion,
            "X-Note": "snapshot-level export; sections not inlined (per spec §28 transparency)",
          },
        });
      }
      case "references": {
        // Minimal references manifest: pull citation_source_refs into a CSL-JSON
        // scaffold with provenance pointer (we do NOT fabricate authors/DOIs).
        const items = (snapshot.boundCitationSourceRefs || []).map((id) => ({
          id,
          type: "article",
          title: `[Citation source ref: ${id}]`,
          "container-title": "",
          author: [],
          issued: { "date-parts": [[]] },
          note: "Placeholder — populate from Zotero / CitationSource render layer before journal submission. No DOI or page numbers were invented.",
        }));
        const body = JSON.stringify({ schema: "csl-json-bridge/1.0", items }, null, 2);
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="references-${projectId}-${filenameDate}.json"`,
            "X-Note": "static citation export (STATIC_CITATION_EXPORT); Word Live Fields not supported in this build (spec §28 transparency)",
          },
        });
      }
      case "fact-manifest": {
        const body = JSON.stringify(
          {
            schema: "fact-usage-manifest/1.0.0",
            source: snapshot.snapshotId,
            boundResultFactIds: snapshot.boundResultFactIds,
            embeddedTableRefs: snapshot.embeddedTableRefs,
            embeddedFigureRefs: snapshot.embeddedFigureRefs,
            note: "boundResultFactIds 與表圖引用來自 ManuscriptWritingSnapshot；下游 Evidence Package 含完整 scope accounting 與 out_of_scope 處置。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="fact-manifest-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "qa-report": {
        const body = JSON.stringify(
          {
            schema: "mechanical-qa-report/1.0.0",
            source: snapshot.snapshotId,
            checks: {
              isNumericDataVerifiablyBound: snapshot.isNumericDataVerifiablyBound,
              hasDiscussionGhostDataAvoided: snapshot.hasDiscussionGhostDataAvoided,
              hasNonSignificantOutcomesIncludedHonesty: snapshot.hasNonSignificantOutcomesIncludedHonesty,
              boundResultFactCount: snapshot.boundResultFactIds.length,
              boundCitationSourceCount: snapshot.boundCitationSourceRefs.length,
              embeddedTableCount: snapshot.embeddedTableRefs.length,
              embeddedFigureCount: snapshot.embeddedFigureRefs.length,
            },
            evidencePackageId: snapshot.evidencePackageId,
            evidencePackageContentHashSha256: snapshot.evidencePackageContentHashSha256,
            sourceAnalysisSnapshotId: snapshot.sourceAnalysisSnapshotId,
            sourceAnalysisSnapshotContentHashSha256: snapshot.sourceAnalysisSnapshotContentHashSha256,
            note: "機械 QA 不證明科學意義正確；語義風險交由第十六階段獨立科學審查處理（spec §25）。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="qa-report-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "markdown":
      default: {
        // Markdown full text scaffold derived from snapshot-level metadata.
        // We do NOT include sections because the snapshot we persist at
        // complete-time carries only refs/hashes; the live editable workspace
        // should be POSTed again to /initialize + section bodies serialized
        // client-side. This is honestly labelled "metadata + manifest" markdown
        // per spec §28 transparency.
        const lines: string[] = [];
        lines.push(`# Manuscript Snapshot — ${snapshot.projectId}`);
        lines.push("");
        lines.push(`> **Snapshot ID**: \`${snapshot.snapshotId}\``);
        lines.push(`> **Schema**: \`${snapshot.schemaVersion}\``);
        lines.push(`> **Stage**: ${snapshot.stageKey} → ${snapshot.nextStageId}`);
        lines.push(`> **Primary Goal**: ${snapshot.primaryGoal}`);
        lines.push(`> **Decision**: ${snapshot.decision}`);
        lines.push("");
        lines.push("## Scope");
        lines.push("");
        lines.push(`- **Working Title (ZH)**: ${snapshot.scope.workingTitleZh}`);
        lines.push(`- **Working Title (EN)**: ${snapshot.scope.workingTitleEn}`);
        lines.push(`- **Purpose**: ${snapshot.scope.overallPurpose}`);
        lines.push(`- **Writing Mode**: ${snapshot.scope.writingMode}`);
        lines.push(`- **Total Word Count**: ${snapshot.scope.totalWordCount}`);
        lines.push("");
        lines.push("## Integrity");
        lines.push("");
        lines.push(`- Numeric data bound: ${snapshot.isNumericDataVerifiablyBound}`);
        lines.push(`- Discussion ghost data avoided: ${snapshot.hasDiscussionGhostDataAvoided}`);
        lines.push(`- Non-significant outcomes included: ${snapshot.hasNonSignificantOutcomesIncludedHonesty}`);
        lines.push("");
        lines.push("## Evidence");
        lines.push("");
        lines.push(`- **Evidence Package**: \`${snapshot.evidencePackageId}\``);
        lines.push(`- **Evidence Package SHA-256**: \`${snapshot.evidencePackageContentHashSha256}\``);
        lines.push(`- **Source Analysis Snapshot**: \`${snapshot.sourceAnalysisSnapshotId}\``);
        lines.push(`- **Source Snapshot SHA-256**: \`${snapshot.sourceAnalysisSnapshotContentHashSha256}\``);
        lines.push("");
        lines.push("## References");
        lines.push("");
        lines.push("_(Full sections and rendered References require POST /manuscript-writing/initialize with the workspace body; spec §28 Markdown full-text export of sections is pending UI work.)_");
        lines.push("");
        lines.push(`*Manifest level — generated ${new Date().toISOString()}*`);

        const body = lines.join("\n");
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="manuscript-manifest-${projectId}-${filenameDate}.md"`,
            "X-Note": "manifest-level markdown; full section body requires workspace round-trip (spec §28 transparency)",
          },
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        ok: false,
        code: "EXPORT_FAILED",
        error: `第十五階段匯出失敗：${message}`,
        recoverable: true,
      },
      { status: 500 }
    );
  }
}
