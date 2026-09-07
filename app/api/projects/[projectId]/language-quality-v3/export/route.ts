import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { type LanguageQualitySnapshot } from "@/lib/language-quality-v3-contract";

const LANGUAGE_QUALITY_V3_EXPORT_CONTRACT_VERSION =
  "language-quality-v3-export/1.0.0" as const;

const SUPPORTED = new Set(["json", "fidelity-report", "qa-report", "alignment", "markdown"]);

/**
 * GET /api/projects/:projectId/language-quality-v3/export?format=…
 *
 * Real exports from the latest persisted LanguageQualitySnapshot.
 * Unsupported formats → EXPORT_FORMAT_UNSUPPORTED (no fake downloads).
 * Static references are NOT Zotero Word live fields (transparent).
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
          error: `匯出格式 ${format} 不受支援；支援：${Array.from(SUPPORTED).join(", ")}。DOCX/PDF/LaTeX/Live Fields 未實作，如實標示 UNSUPPORTED。`,
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
        "translation-polish"
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
          code: "STAGE17_NOT_COMPLETED",
          error: "尚未完成第十七階段語言品質，請先完成語言處理並保存交接。",
          recoverable: true,
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as LanguageQualitySnapshot;
    const filenameDate = new Date().toISOString().replace(/[:.]/g, "-");

    switch (format) {
      case "json": {
        const body = JSON.stringify(snapshot, null, 2);
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="language-quality-snapshot-${projectId}-${filenameDate}.json"`,
            "X-Snapshot-Id": snapshot.snapshotId,
            "X-Schema-Version": snapshot.schemaVersion,
          },
        });
      }
      case "fidelity-report": {
        const body = JSON.stringify(
          {
            schema: "language-fidelity-report/1.0.0",
            source: snapshot.snapshotId,
            decision: snapshot.decision,
            openFidelityIssueCount: snapshot.openFidelityIssueCount,
            fatalFidelityIssueCount: snapshot.fatalFidelityIssueCount,
            terminologyMismatchCount: snapshot.terminologyMismatchCount,
            fidelityIssues: snapshot.fidelityIssues,
            note: "保真檢查涵蓋數值/單位/方向/否定/因果強度/確認探索/限制/引用歸屬，不限 token 數量。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="fidelity-report-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "qa-report": {
        const body = JSON.stringify(
          {
            schema: "language-qa-report/1.0.0",
            source: snapshot.snapshotId,
            checks: {
              numericQaPassed: snapshot.numericQaPassed,
              citationQaPassed: snapshot.citationQaPassed,
              terminologyQaPassed: snapshot.terminologyQaPassed,
              semanticQaPassed: snapshot.semanticQaPassed,
              fatalFidelityIssueCount: snapshot.fatalFidelityIssueCount,
            },
            providerCapabilityRefs: snapshot.providerCapabilityRefs,
            note: "機械 QA 不證明語言品質完美；外部 provider 狀態如實標示，回譯僅為輔助不等於真人獨立驗證。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="language-qa-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "alignment": {
        const body = JSON.stringify(
          {
            schema: "language-alignment/1.0.0",
            source: snapshot.snapshotId,
            alignmentRef: snapshot.alignmentRef,
            targetLanguage: snapshot.scope.targetLanguage,
            totalSegments: snapshot.scope.totalSegments,
            translatedSegments: snapshot.scope.totalSegmentsTranslatedOrEdited,
            languageAllowedScopeRefs: snapshot.scope.languageAllowedScopeRefs,
            fullManuscriptLanguageAllowed: snapshot.scope.fullManuscriptLanguageAllowed,
            note: "對齊資料（逐段 source↔target 映射）保留於 U17 工作區；此檔為來源與 scope 摘要。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="alignment-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "markdown":
      default: {
        const lines: string[] = [];
        lines.push(`# Language Quality Snapshot — ${snapshot.projectId}`);
        lines.push("");
        lines.push(`> **Snapshot ID**: \`${snapshot.snapshotId}\``);
        lines.push(`> **Schema**: \`${snapshot.schemaVersion}\``);
        lines.push(`> **Stage**: ${snapshot.stageKey} → ${snapshot.nextStageId}`);
        lines.push(`> **Decision**: ${snapshot.decision}`);
        lines.push(`> **Primary Goal**: ${snapshot.primaryGoal}`);
        lines.push(`> **Task**: ${snapshot.scope.task} (${snapshot.scope.sourceLanguage} → ${snapshot.scope.targetLanguage})`);
        lines.push("");
        lines.push("## Scope");
        lines.push("");
        lines.push(`- **Full manuscript language allowed**: ${snapshot.scope.fullManuscriptLanguageAllowed}`);
        lines.push(`- **Allowed scope refs**: ${snapshot.scope.languageAllowedScopeRefs.join(", ") || "(none)"}`);
        lines.push(`- **Segments**: ${snapshot.scope.totalSegmentsTranslatedOrEdited} / ${snapshot.scope.totalSegments}`);
        lines.push("");
        lines.push("## Fidelity & QA");
        lines.push("");
        lines.push(`- Open fidelity issues: ${snapshot.openFidelityIssueCount}`);
        lines.push(`- FATAL fidelity issues: ${snapshot.fatalFidelityIssueCount}`);
        lines.push(`- Terminology mismatches: ${snapshot.terminologyMismatchCount}`);
        lines.push(`- Numeric QA: ${snapshot.numericQaPassed ? "PASS" : "FAIL"}`);
        lines.push(`- Citation QA: ${snapshot.citationQaPassed ? "PASS" : "FAIL"}`);
        lines.push(`- Terminology QA: ${snapshot.terminologyQaPassed ? "PASS" : "FAIL"}`);
        lines.push(`- Semantic QA: ${snapshot.semanticQaPassed ? "PASS" : "FAIL"}`);
        lines.push("");
        lines.push("## Providers");
        lines.push("");
        lines.push(`- Provider capability refs: ${snapshot.providerCapabilityRefs.join(", ")}`);
        lines.push("");
        lines.push(`*Manifest level — generated ${new Date().toISOString()}*`);
        lines.push("");
        lines.push("_Language ready ≠ formal submission, all-author consent, or journal acceptance._");
        const body = lines.join("\n");
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="language-quality-manifest-${projectId}-${filenameDate}.md"`,
          },
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "EXPORT_FAILED", error: `第十七階段匯出失敗：${message}` },
      { status: 500 }
    );
  }
}