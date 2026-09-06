import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  buildComplianceWorkspaceFromStage17,
  buildRuleSnapshots,
  buildDerivedDocuments,
  runAnonymizationQa,
  runReferencesQa,
  runRenderQa,
  buildApprovalSubjectManifest,
  freezeDocuments,
  buildFinalSubmissionPackageSnapshot,
  buildStage19ReceiverState,
} from "@/lib/final-submission-v3-service";
import { type PackageDocument, type AuthorApprovalRecord } from "@/lib/final-submission-v3-contract";
import { type LanguageQualitySnapshot } from "@/lib/language-quality-v3-contract";

export const FINAL_SUBMISSION_V3_COMPLETE_CONTRACT_VERSION =
  "final-submission-v3-complete/1.0.0" as const;

/**
 * POST /api/projects/:projectId/final-submission-v3/complete
 *
 * 1. Resolves the Stage 17 LanguageQualitySnapshot (body or DB).
 * 2. Builds route profile, rules, derived documents.
 * 3. Runs anonymization / references / render QA.
 * 4. Freezes content, collects approvals (digest-bound), locks package.
 * 5. Builds FinalSubmissionPackageSnapshot + Stage 19 receiver.
 * 6. Persists to stage_completion_snapshots (stage_id='final-compliance').
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await context.params;
    const workspaceId = request.headers.get("x-workspace-id") || "ws_default";

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
      languageQualitySnapshot?: LanguageQualitySnapshot;
      contentByDocumentId?: Record<string, string>;
      metadataSample?: string;
      referenceBlock?: string;
      approvals?: AuthorApprovalRecord[];
      humanConfirmed?: boolean;
      requiredApprovals?: number;
      format?: string;
    };

    let snapshot: LanguageQualitySnapshot | null = body.languageQualitySnapshot ?? null;
    if (!snapshot) {
      const lqCompletion = await StageOperationRepository.getLatestCompletionSnapshot(
        tenant.workspaceId,
        projectId,
        "translation-polish"
      );
      if (lqCompletion?.snapshotData) {
        snapshot = lqCompletion.snapshotData as LanguageQualitySnapshot;
      }
    }
    if (!snapshot || !snapshot.snapshotId) {
      return NextResponse.json(
        { ok: false, code: "LANGUAGE_QUALITY_HANDOFF_REQUIRED", error: "無法解析第十七階段交接快照。" },
        { status: 400 }
      );
    }

    const fcWs = buildComplianceWorkspaceFromStage17({ workspaceId, projectId, languageQualitySnapshot: snapshot });
    const rules = buildRuleSnapshots({ route: fcWs.route });
    let documents: PackageDocument[] = buildDerivedDocuments({
      route: fcWs.route,
      profile: fcWs.profile,
      anonymizationRequired: fcWs.route === "JOURNAL_SCI_SSCI",
    });

    // Freeze content
    const frozen = freezeDocuments({ documents, contentByDocumentId: body.contentByDocumentId ?? {} });
    if (!frozen.ok) {
      return NextResponse.json(
        { ok: false, code: frozen.code, error: `缺少 freeze 內容：${frozen.missing.join(", ")}。`, recoverable: true },
        { status: 422 }
      );
    }
    documents = frozen.documents;

    // QA
    const anonymizationQa = runAnonymizationQa({ candidateText: body.contentByDocumentId?.doc_main ?? "", metadataSample: body.metadataSample ?? "" });
    const referencesQa = runReferencesQa({ referenceBlock: body.referenceBlock ?? "" });
    const format = body.format ?? "markdown";
    const renderQa = format === "markdown" || format === "json"
      ? runRenderQa({ hasRenderer: true, format })
      : runRenderQa({ hasRenderer: false, format });

    // Approval subject manifest (hash without approval events) + approvals
    const manifest = buildApprovalSubjectManifest({ projectId, documents, createdBy: authenticated.session.user.id });
    const approvals = body.approvals ?? [];
    const requiredApprovals = body.requiredApprovals ?? 0;
    const freezeConfirmed = body.humanConfirmed === true;

    // Lock requires all approvals + human confirmation
    let packageLocked = false;
    if (freezeConfirmed && approvals.length >= requiredApprovals && requiredApprovals > 0) {
      packageLocked = true;
    }

    const packageSnapshot = buildFinalSubmissionPackageSnapshot({
      workspaceId: fcWs.workspaceId,
      projectId,
      workOrderId: fcWs.workOrderId,
      sourceSnapshot: snapshot,
      route: fcWs.route,
      profile: fcWs.profile,
      rules,
      documents,
      manifest,
      approvals,
      requiredApprovals,
      anonymizationQa,
      referencesQa,
      renderQa,
      freezeConfirmed,
      packageLocked,
    });
    const stage19Receiver = buildStage19ReceiverState({ snapshot: packageSnapshot });

    let completionRecordId: string | null = null;
    let persistenceStatus: "PERSISTED" | "STORAGE_UNAVAILABLE" = "STORAGE_UNAVAILABLE";
    try {
      const completionRecord = await StageOperationRepository.saveCompletionSnapshot({
        workspaceId: tenant.workspaceId,
        projectId,
        stageId: "final-compliance",
        snapshotData: packageSnapshot,
        lockManifest: documents.map((d) => ({ documentId: d.documentId, status: d.status })),
        handoffLimitations: packageSnapshot.limitations,
        downstreamOpenRequirements: packageSnapshot.unresolvedIssueRefs,
        nextStageId: packageSnapshot.nextStageId,
        userId: authenticated.session.user.id,
        idempotencyKey: `comp_fs_${packageSnapshot.snapshotId}`,
      });
      completionRecordId = completionRecord.id;
      persistenceStatus = "PERSISTED";
    } catch (error) {
      const isStorageError = error instanceof Error && /stage_operation_storage_unavailable/.test(error.message);
      if (!isStorageError) throw error;
      persistenceStatus = "STORAGE_UNAVAILABLE";
    }

    return NextResponse.json({
      ok: true,
      data: {
        snapshot: packageSnapshot,
        stage19Receiver,
        persistence: {
          status: persistenceStatus,
          stageCompletionSnapshotId: completionRecordId,
          stageId: "final-compliance",
          nextStageId: packageSnapshot.nextStageId,
        },
        note: "submission_execution_authorized=false；所有 READY 不等於 SUBMITTED 或官方核准。",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { ok: false, code: "FINAL_SUBMISSION_COMPLETION_FAILED", error: `完成第十八階段交接快照失敗：${message}`, recoverable: true },
      { status: 500 }
    );
  }
}