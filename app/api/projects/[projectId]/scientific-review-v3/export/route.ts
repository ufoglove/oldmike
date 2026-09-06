import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { type ScientificReviewSnapshot } from "@/lib/scientific-review-v3-contract";

export const SCIENTIFIC_REVIEW_V3_EXPORT_CONTRACT_VERSION =
  "scientific-review-v3-export/1.0.0" as const;

const SUPPORTED = new Set(["json", "findings-manifest", "meaning-constraints", "qa-report", "markdown"]);

/**
 * GET /api/projects/:projectId/scientific-review-v3/export?format=…
 *
 * Real exports from the latest persisted ScientificReviewSnapshot.
 * - json: full snapshot
 * - findings-manifest: finding refs + counts (minimised, no full text in
 *   snapshot; full findings live in U16 workspace)
 * - meaning-constraints: constraint refs
 * - qa-report: mechanical QA summary
 * - markdown: manifest-level markdown
 * Unsupported formats → EXPORT_FORMAT_UNSUPPORTED (no fake downloads).
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
        "scientific-review"
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
          code: "STAGE16_NOT_COMPLETED",
          error: "尚未完成第十六階段科學審查，請先完成審查並保存交接。",
          recoverable: true,
        },
        { status: 409 }
      );
    }

    const snapshot = completionRecord.snapshotData as ScientificReviewSnapshot;
    const filenameDate = new Date().toISOString().replace(/[:.]/g, "-");

    switch (format) {
      case "json": {
        const body = JSON.stringify(snapshot, null, 2);
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="scientific-review-snapshot-${projectId}-${filenameDate}.json"`,
            "X-Snapshot-Id": snapshot.snapshotId,
            "X-Schema-Version": snapshot.schemaVersion,
            "X-Simulated": "true",
          },
        });
      }
      case "findings-manifest": {
        const body = JSON.stringify(
          {
            schema: "scientific-findings-manifest/1.0.0",
            source: snapshot.snapshotId,
            reviewRound: snapshot.reviewRound,
            decision: snapshot.decision,
            findingRefs: snapshot.findingRefs,
            openFindingRefs: snapshot.openFindingRefs,
            blockerFindingRefs: snapshot.blockerFindingRefs,
            resolvedFindingRefs: snapshot.resolvedFindingRefs,
            authorResponseMatrixRef: snapshot.authorResponseMatrixRef,
            allSimulated: snapshot.allSimulated,
            note: "finding 完整內容保留於 U16 工作區；快照僅攜帶 refs（§7 最小化）。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="findings-manifest-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "meaning-constraints": {
        const body = JSON.stringify(
          {
            schema: "meaning-constraints-manifest/1.0.0",
            source: snapshot.snapshotId,
            meaningConstraintRefs: snapshot.meaningConstraintRefs,
            meaningConstraintsHeld: snapshot.meaningConstraintsHeld,
            note: "保護值內容於 U16 工作區維護；語言階段不得更改受保護數值/方向/時點/因果邊界。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="meaning-constraints-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "qa-report": {
        const body = JSON.stringify(
          {
            schema: "scientific-mechanical-qa/1.0.0",
            source: snapshot.snapshotId,
            checks: {
              mechanicalQaPassed: snapshot.mechanicalQaPassed,
              reviewer2ChallengeProvided: snapshot.reviewer2ChallengeProvided,
              allSimulated: snapshot.allSimulated,
              noFabricatedFindings: snapshot.noFabricatedFindings,
              authorDisagreementRespectCount: snapshot.authorDisagreementRespectCount,
            },
            note: "機械 QA 不證明科學意義正確；語義風險與 Reviewer #2 挑戰屬模擬審查，仍需真人作者最終判斷。",
          },
          null,
          2
        );
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="scientific-qa-${projectId}-${filenameDate}.json"`,
          },
        });
      }
      case "markdown":
      default: {
        const lines: string[] = [];
        lines.push(`# Scientific Review Snapshot — ${snapshot.projectId}`);
        lines.push("");
        lines.push(`> **Snapshot ID**: \`${snapshot.snapshotId}\``);
        lines.push(`> **Schema**: \`${snapshot.schemaVersion}\``);
        lines.push(`> **Stage**: ${snapshot.stageKey} → ${snapshot.nextStageId}`);
        lines.push(`> **Decision**: ${snapshot.decision}`);
        lines.push(`> **Review Round**: ${snapshot.reviewRound}`);
        lines.push(`> **Primary Goal**: ${snapshot.primaryGoal}`);
        lines.push(`> **All AI Review Simulated**: ${snapshot.allSimulated}`);
        lines.push("");
        lines.push("## Scope");
        lines.push("");
        lines.push(`- **Working Title (ZH)**: ${snapshot.scope.workingTitleZh}`);
        lines.push(`- **Working Title (EN)**: ${snapshot.scope.workingTitleEn}`);
        lines.push(`- **Coverage Sections**: ${snapshot.scope.coverageSections.join(", ")}`);
        lines.push("");
        lines.push("## Findings");
        lines.push("");
        lines.push(`- Total findings: ${snapshot.findingRefs.length}`);
        lines.push(`- Open findings: ${snapshot.openFindingRefs.length}`);
        lines.push(`- Blocker findings: ${snapshot.blockerFindingRefs.length}`);
        lines.push(`- Resolved findings: ${snapshot.resolvedFindingRefs.length}`);
        lines.push("");
        lines.push("## Meaning Constraints");
        lines.push("");
        lines.push(`- Constraint count: ${snapshot.meaningConstraintRefs.length}`);
        lines.push(`- Constraints held: ${snapshot.meaningConstraintsHeld}`);
        lines.push("");
        lines.push("## Upstream / Re-review");
        lines.push("");
        lines.push(`- Upstream review requests: ${snapshot.upstreamRequestRefs.length}`);
        lines.push(`- Revision proposals: ${snapshot.revisionProposalRefs.length}`);
        lines.push("");
        lines.push(`*Manifest level — generated ${new Date().toISOString()}*`);
        lines.push("");
        lines.push("_Simulated review only — not a journal decision._");
        const body = lines.join("\n");
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="scientific-review-manifest-${projectId}-${filenameDate}.md"`,
            "X-Simulated": "true",
          },
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "EXPORT_FAILED", error: `第十六階段匯出失敗：${message}` },
      { status: 500 }
    );
  }
}