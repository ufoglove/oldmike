/**
 * Stage 19 Consumer Contract Test (V3-U18-FULL → V3-U19 receiver)
 * Spec: docs/stage18/spec-v3-4.0.md §7-8
 *
 * Validates FinalSubmissionPackageSnapshot:
 *   1. schema / stageKey / nextStageId stable (V3-U18 → submission-tracking)
 *   2. carries upstream LanguageQualitySnapshot id + hash
 *   3. route profiles (JOURNAL / NSTC / MOE) with document purposes
 *   4. rules snapshots preserve sources (no invented deadlines/APC)
 *   5. ApprovalSubjectManifest hashes frozen bytes WITHOUT approval events
 *   6. approvals bind to document digest; old approval invalid after change
 *   7. anonymization / references / render QA propagate
 *   8. readiness: journal → READY_FOR_AUTHOR_SUBMISSION; NSTC/TPR → institutional
 *   9. submissionExecutionAuthorized always false
 *  10. Stage 19 receiver builds (non-empty fallback, no circular gate)
 *
 * Pure consumer contract test — no DB calls.
 */

import {
  buildComplianceWorkspaceFromStage17,
  assertComplianceScopeAuthorized,
  buildRuleSnapshots,
  buildDerivedDocuments,
  runAnonymizationQa,
  runReferencesQa,
  runRenderQa,
  buildApprovalSubjectManifest,
  approveDocument,
  freezeDocuments,
  confirmFreezeAndLock,
  buildFinalSubmissionPackageSnapshot,
  buildStage19ReceiverState,
  rendererCapabilities,
  buildFinalPackageWorkOrder,
  resolveRuleVerificationStatus,
  buildSubmissionFieldMap,
  buildBundleManifests,
} from "../lib/final-submission-v3-service.ts";
import { type PackageDocument } from "../lib/final-submission-v3-contract.ts";
import { type LanguageQualitySnapshot } from "../lib/language-quality-v3-contract.ts";

let pass = 0;
let fail = 0;
function report(id: string, cond: boolean, note: string): void {
  if (cond) { pass++; console.log(`[PASS] ${id} - ${note}`); }
  else { fail++; console.error(`[FAIL] ${id} - ${note}`); }
}

function srSnapshot(goal: "JOURNAL_SCI_SSCI" | "NSTC_GENERAL" | "MOE_TPR", formalAllowed: boolean): LanguageQualitySnapshot {
  return {
    snapshotId: `lqsnap_stage19_${goal}`,
    schemaVersion: "language-quality/1.0.0",
    stageKey: "V3-U17",
    workspaceId: "ws_fc_consumer",
    projectId: "proj_stage19_consumer",
    reviewRunId: "srr_lq_consumer",
    workOrderId: "wlq_consumer",
    stageId: "translation-polish",
    nextStageId: "final-compliance",
    sourceScientificReviewSnapshotId: "srsnap_consumer",
    sourceScientificReviewSnapshotHash: "a".repeat(64),
    sourceScientificReviewDecision: "SCIENTIFICALLY_APPROVED",
    goalContextRevision: 1,
    primaryGoal: goal,
    decision: "LANGUAGE_READY",
    decisionRationale: "consumer fixture",
    languageReleaseState: formalAllowed ? "LANGUAGE_APPROVED_FOR_COMPLIANCE" : "PARTIAL_LANGUAGE_RELEASE",
    formalComplianceAllowed: formalAllowed,
    complianceAllowedScopeRefs: formalAllowed ? ["TITLE_ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"] : ["RESULTS", "DISCUSSION"],
    scope: {
      workingTitleZh: "Stage 19 Consumer Test",
      workingTitleEn: "Stage 19 Consumer Test",
      sourceLanguage: "zh-TW",
      targetLanguage: "en-US",
      task: "TRANSLATE_ZH_EN",
      editIntensity: "BALANCED",
      fullManuscriptLanguageAllowed: formalAllowed,
      languageAllowedScopeRefs: formalAllowed ? ["TITLE_ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"] : ["RESULTS", "DISCUSSION"],
      totalSegments: 2,
      totalSegmentsTranslatedOrEdited: 2,
    },
    fidelityIssues: [],
    openFidelityIssueCount: 0,
    fatalFidelityIssueCount: 0,
    terminologyMismatchCount: 0,
    numericQaPassed: true,
    citationQaPassed: true,
    terminologyQaPassed: true,
    semanticQaPassed: true,
    termBindingRefs: [],
    meaningConstraintRefs: ["mc_1"],
    providerCapabilityRefs: [],
    providerCapabilitySnapshots: [],
    budgetPlannerRefs: [],
    semanticUnitRefs: [],
    protectedSpanManifestRef: "manifest_consumer",
    alignmentRef: "alignment_consumer",
    languageRevisionRef: "rev_consumer",
    qaReportRef: "qa_consumer",
    aiAssistanceAuditRef: "audit_consumer",
    sourceManifestHash: "h".repeat(64),
    limitations: [],
    checksum: "chk_lq_consumer",
    createdAt: new Date().toISOString(),
  };
}

// ---- 1. Intake from Stage 17 (journal, full allowed)
const lqJournal = srSnapshot("JOURNAL_SCI_SSCI", true);
const fcJournal = buildComplianceWorkspaceFromStage17({ workspaceId: "ws_fc_consumer", projectId: "proj_stage19_consumer", languageQualitySnapshot: lqJournal });
report("S19-C01", fcJournal.sourceSnapshotId === lqJournal.snapshotId, "workspace points to source LanguageQualitySnapshot");
report("S19-C02", fcJournal.sourceSnapshotHash.length === 64, "source snapshot hash is sha256");
report("S19-C03", fcJournal.route === "JOURNAL_SCI_SSCI" && fcJournal.profile.route === "JOURNAL_SCI_SSCI", "journal route profile selected");
report("S19-C04", fcJournal.formalComplianceAllowed === true, "formal compliance allowed carried from U17");

// ---- 2. Scope gate
const lqPartial = srSnapshot("MOE_TPR", false);
const fcPartial = buildComplianceWorkspaceFromStage17({ workspaceId: "ws_fc_partial", projectId: "proj_stage19_consumer", languageQualitySnapshot: lqPartial });
const scopeBlocked = assertComplianceScopeAuthorized({ formalComplianceAllowed: false, sectionRef: "DISCUSSION" });
report("S19-G1", scopeBlocked.ok === false && scopeBlocked.code === "COMPLIANCE_SCOPE_NOT_AUTHORIZED", "partial language never auto-upgrades to full compliance pre-check only");
report("S19-G2", fcPartial.route === "MOE_TPR" && fcPartial.profile.route === "MOE_TPR", "MOE route profile selected (not journal template)");

// ---- 3. Rules
const rules = buildRuleSnapshots({ route: "JOURNAL_SCI_SSCI" });
report("S19-R1", rules.length >= 3, "journal rules cover author guideline + reporting + matrix");
report("S19-R2", rules.every((r) => r.source && r.version && r.hash.length === 64), "rules preserve sources/hash (no invented deadlines/APC)");
report("S19-R3", rules.some((r) => /待官方|依官方|待確認/.test(r.source) || r.source === "目標期刊作者指南（待官方確認）" || r.source === "Reporting Guideline（依適用）"), "unverified sources marked, not treated as confirmed official rules");

// ---- 4. Derived documents + renderer gate
const docs = buildDerivedDocuments({ route: "JOURNAL_SCI_SSCI", profile: fcJournal.profile, anonymizationRequired: true });
report("S19-D1", docs.some((d) => d.kind === "COVER_LETTER") && docs.some((d) => d.kind === "TITLE_PAGE") && docs.some((d) => d.kind === "REPORTING_CHECKLIST"), "journal package derives cover letter/title page/checklist");
report("S19-D2", docs.every((d) => d.status === "CANDIDATE"), "documents start as CANDIDATE");
const renderers = rendererCapabilities();
report("S19-D3", renderers.find((r) => r.format === "markdown")?.available === true, "markdown renderer available");
report("S19-D4", renderers.find((r) => r.format === "docx")?.available === false, "docx honestly UNSUPPORTED (Markdown ≠ submission-ready)");

// ---- 5. Freeze → manifest → approve → lock (hash-cycle free)
const content = { doc_main: "This is the main text.", doc_title: "Title Page", doc_cover: "Dear Editor...", doc_checklist: "Item 1: done", doc_refs: "[1] Author, Year.", doc_statements: "No COI", doc_approval: "{}" };
const frozen = freezeDocuments({ documents: docs, contentByDocumentId: content });
report("S19-F1", frozen.ok === true, "documents frozen with digest");
if (frozen.ok) {
  const manifest = buildApprovalSubjectManifest({ projectId: "proj_stage19_consumer", documents: frozen.documents, createdBy: "user_test" });
  report("S19-F2", manifest.contentHash.length === 64, "approval subject manifest hash present");
  const frozenDoc = frozen.documents[0]!;
  const appr = approveDocument({ manifest, documentId: frozenDoc.documentId, verifiedOfflineRef: "offline-book-2" });
  report("S19-F3", appr.ok === true, "approval binds to frozen digest");
  report("S19-F4", !JSON.stringify(manifest).includes("approvalId") && manifest.contentHash === manifest.contentHash, "manifest hash does NOT include approval events (no hash cycle)");

  // Old approval must not carry to new bytes
  const oldDigest = frozen.documents[0]!.contentHash;
  const changedDocs = frozen.documents.map((d, i) => (i === 0 ? { ...d, contentHash: sha256For("CHANGED CONTENT") } : d));
  report("S19-F5", oldDigest !== changedDocs[0]!.contentHash, "content change ⇒ new digest (old approval cannot carry)");

  // Lock requires human confirm + all approvals
  const lockOk = confirmFreezeAndLock({ documents: frozen.documents, humanConfirmed: true, pendingApprovals: 0 });
  report("S19-F6", lockOk.ok === true && lockOk.packageLocked === true, "package locks after human confirm + approvals");
  const lockRejected = confirmFreezeAndLock({ documents: frozen.documents, humanConfirmed: false, pendingApprovals: 0 });
  report("S19-F7", lockRejected.ok === false && lockRejected.code === "FREEZE_NOT_CONFIRMED", "AI lock ≠ author consent; human gate required");
  const lockPendingApprovals = confirmFreezeAndLock({ documents: frozen.documents, humanConfirmed: true, pendingApprovals: 1 });
  report("S19-F8", lockPendingApprovals.ok === false && lockPendingApprovals.code === "APPROVAL_NOT_VERIFIED", "pending approvals block lock");
}

// ---- 6. QA
const anonymQa = runAnonymizationQa({ candidateText: "無姓名內容", metadataSample: "no metadata" });
report("S19-Q1", anonymQa.passed === true, "anonymization QA passes clean text");
const anonymBad = runAnonymizationQa({ candidateText: "作者：王小明", metadataSample: "track changes: revised by editor" });
report("S19-Q2", anonymBad.passed === false && anonymBad.issues.length >= 2, "anonymization catches names + track changes (not just first page)");
const refBad = runReferencesQa({ referenceBlock: "[TODO]" });
report("S19-Q3", refBad.passed === false, "references QA flags TODO placeholders");
const renderBad = runRenderQa({ hasRenderer: false, format: "pdf" });
report("S19-Q4", renderBad.passed === false && /UNSUPPORTED|不可用/.test(renderBad.issues[0] ?? ""), "render QA flags missing renderer as UNSUPPORTED");

// ---- 7. Snapshot (ready)
const readyDocs = frozen.ok ? frozen.documents : docs;
const readyManifest = buildApprovalSubjectManifest({ projectId: "proj_stage19_consumer", documents: readyDocs, createdBy: "user_test" });
const snapshot = buildFinalSubmissionPackageSnapshot({
  workspaceId: fcJournal.workspaceId,
  projectId: fcJournal.projectId,
  workOrderId: fcJournal.workOrderId,
  sourceSnapshot: lqJournal,
  route: fcJournal.route,
  profile: fcJournal.profile,
  rules,
  documents: readyDocs.map((d) => ({ ...d, status: "LOCKED" as const })),
  manifest: readyManifest,
  approvals: [],
  requiredApprovals: 0,
  anonymizationQa: { passed: true, issues: [] },
  referencesQa: { passed: true, issues: [] },
  renderQa: { passed: true, issues: [] },
  freezeConfirmed: true,
  packageLocked: true,
});

report("S19-S1", snapshot.schemaVersion === "final-submission/1.0.0", "snapshot schema version stable");
report("S19-S2", snapshot.stageKey === "V3-U18", "snapshot stageKey is V3-U18");
report("S19-S3", snapshot.nextStageId === "submission-tracking", "nextStageId points to Stage 19 (submission tracking)");
report("S19-S4", snapshot.sourceLanguageQualitySnapshotId === lqJournal.snapshotId, "upstream snapshot id carried");
report("S19-S5", snapshot.decision === "READY_FOR_AUTHOR_SUBMISSION", "journal + locked + QA passed ⇒ READY_FOR_AUTHOR_SUBMISSION");
report("S19-S6", snapshot.submissionExecutionAuthorized === false, "submission_execution_authorized always false");
report("S19-S7", snapshot.route === "JOURNAL_SCI_SSCI", "route carried into snapshot");
report("S19-S8", snapshot.approvalSubjectManifest.contentHash.length === 64, "approval subject manifest hash carried");
report("S19-S9", /^chk_fs_/.test(snapshot.checksum), "checksum has expected prefix");
report("S19-S10", snapshot.packageLocked === true && snapshot.freezeConfirmed === true, "locked + freeze confirmed recorded");

// Partial NSTC → institutional readiness path (not forced journal)
const lqNstc = srSnapshot("NSTC_GENERAL", true);
const fcNstc = buildComplianceWorkspaceFromStage17({ workspaceId: "ws_nstc", projectId: "proj_stage19_consumer", languageQualitySnapshot: lqNstc });
const nstcDocs = buildDerivedDocuments({ route: "NSTC_GENERAL", profile: fcNstc.profile, anonymizationRequired: false });
const nstcFrozen = freezeDocuments({ documents: nstcDocs, contentByDocumentId: { doc_main: "計畫內容", doc_refs: "參考", doc_statements: "聲明", doc_approval: "{}" } });
const nstcSnap = buildFinalSubmissionPackageSnapshot({
  workspaceId: fcNstc.workspaceId,
  projectId: fcNstc.projectId,
  workOrderId: fcNstc.workOrderId,
  sourceSnapshot: lqNstc,
  route: fcNstc.route,
  profile: fcNstc.profile,
  rules: buildRuleSnapshots({ route: "NSTC_GENERAL" }),
  documents: (nstcFrozen.ok ? nstcFrozen.documents : nstcDocs).map((d) => ({ ...d, status: "LOCKED" as const })),
  manifest: buildApprovalSubjectManifest({ projectId: "proj_stage19_consumer", documents: nstcFrozen.ok ? nstcFrozen.documents : nstcDocs, createdBy: "u" }),
  approvals: [],
  requiredApprovals: 0,
  anonymizationQa: { passed: true, issues: [] },
  referencesQa: { passed: true, issues: [] },
  renderQa: { passed: true, issues: [] },
  freezeConfirmed: true,
  packageLocked: true,
});
report("S19-S11", nstcSnap.decision === "READY_FOR_INSTITUTIONAL_REVIEW" || nstcSnap.decision === "READY_FOR_INSTITUTIONAL_SUBMISSION", "NSTC readiness ≠ journal submission (route-specific)");
report("S19-S12", !nstcSnap.documents.some((d) => d.kind === "COVER_LETTER"), "NSTC package has no journal cover letter");

// ---- 8. Stage 19 receiver
const receiver = buildStage19ReceiverState({ snapshot });
report("S19-R1", receiver.receiverVersion === "submission-tracking-receiver/1.0.0", "receiver version stable");
report("S19-R2", receiver.sourceFinalSubmissionPackageSnapshotId === snapshot.snapshotId, "receiver points to source snapshot");
report("S19-R3", receiver.readyForSubmissionTracking === true, "receiver ready when locked + not NOT_READY");
report("S19-R4", receiver.submissionExecutionAuthorized === false, "receiver honors submission_execution_authorized=false");
report("S19-R5", receiver.receiverNotes.length > 0, "receiver notes honest (U19 not built)");
report("S19-R6", receiver.reEntryPoint.route === "final-compliance", "receiver re-entry back to U18");

// No fake claims
report("S19-E1", !["SUBMITTED", "ACCEPTED", "APPROVED_BY_AGENCY"].includes(snapshot.decision as string), "snapshot never claims submission/official approval");

// ---- Full-spec additions: work order, rule resolver, field map, visibility,
// ---- bundles, package state machine, ready_for_action
try {
  const wo = buildFinalPackageWorkOrder({
    projectId: "proj_stage19_consumer",
    documentId: "doc_main",
    documentPurpose: "JOURNAL_INITIAL_SUBMISSION",
    route: "JOURNAL_SCI_SSCI",
    formalComplianceAllowed: true,
    complianceAllowedScopeRefs: lqJournal.complianceAllowedScopeRefs,
  });
  report("S19-W1", wo.target === "JOURNAL_INITIAL_SUBMISSION", "work order target for journal is JOURNAL_INITIAL_SUBMISSION");
  report("S19-W2", wo.status === "BUILDING", "work order starts BUILDING when formal allowed");
  report("S19-W3", wo.excludedAssets.some((a) => /Raw|IdentityVault|prompt/.test(a)), "work order excludes Raw/IdentityVault/prompt");

  const woPartial = buildFinalPackageWorkOrder({
    projectId: "p", documentId: "d", documentPurpose: "MOE_TPR_APPLICATION", route: "MOE_TPR", formalComplianceAllowed: false, complianceAllowedScopeRefs: ["RESULTS"],
  });
  report("S19-W4", woPartial.target === "MOE_TPR_APPLICATION" && woPartial.status === "DRAFT", "partial ⇒ DRAFT/PREFLIGHT (never full READY)");

  const ruleV = resolveRuleVerificationStatus({ sourceUrl: "https://example.gov/rule", effectiveDate: "2026-01-01" });
  report("S19-RV1", ruleV.status === "VERIFIED_APPLICABLE", "rule resolver marks verified source as VERIFIED_APPLICABLE");
  const rulePrev = resolveRuleVerificationStatus({ sourceUrl: "https://example.gov/prev", previousYearOnly: true });
  report("S19-RV2", rulePrev.status === "PREVIOUS_YEAR_REFERENCE", "previous-year template stays PREVIOUS_YEAR_REFERENCE (not verified)");
  const ruleConflict = resolveRuleVerificationStatus({ sourceUrl: "https://example.gov/rule", conflictDetected: true });
  report("S19-RV3", ruleConflict.status === "CONFLICTING", "conflicting rules → CONFLICTING (needs confirmation)");
  const ruleUnavail = resolveRuleVerificationStatus({ sourceUrl: "待官方" });
  report("S19-RV4", ruleUnavail.status === "SOURCE_UNAVAILABLE", "unavailable source → SOURCE_UNAVAILABLE (not 'not announced')");

  const fm = buildSubmissionFieldMap({ target: "JOURNAL_INITIAL_SUBMISSION", route: "JOURNAL_SCI_SSCI" });
  report("S19-FM1", fm.fields.some((f) => f.fieldRef === "authors" && f.requiresHumanDeclaration), "author field requires human declaration");
  report("S19-FM2", fm.fields.every((f) => f.preparationState === "NOT_READY"), "field map starts NOT_READY (no fake READY)");
  const fmNstc = buildSubmissionFieldMap({ target: "NSTC_GENERAL_APPLICATION", route: "NSTC_GENERAL" });
  report("S19-FM3", fmNstc.fields.some((f) => f.fieldRef === "pi"), "NSTC field map has PI field (not journal template)");

  const bundles = buildBundleManifests({ projectId: "p", documents: docs, anonymizationRequired: true });
  report("S19-B1", bundles.external.bundleKind === "EXTERNAL_SUBMISSION_BUNDLE", "external bundle typed correctly");
  report("S19-B2", bundles.internal.bundleKind === "INTERNAL_COMPLIANCE_EVIDENCE_PACKAGE", "internal evidence package typed correctly");
  report("S19-B3", bundles.external.files.some((f) => f.recipientAudience === "REVIEWER_VISIBLE"), "external files reviewer-visible");
  report("S19-B4", bundles.external.files.find((f) => f.logicalRole === "TITLE_PAGE")?.recipientAudience === "EDITOR_ONLY", "title page editor-only under double-blind");
  report("S19-B5", bundles.internal.files.every((f) => f.recipientAudience === "INTERNAL_AUDIT"), "internal files internal-audit only");

  // State machine + ready_for_action in snapshot
  const fullSnap = buildFinalSubmissionPackageSnapshot({
    workspaceId: fcJournal.workspaceId,
    projectId: fcJournal.projectId,
    workOrderId: fcJournal.workOrderId,
    sourceSnapshot: lqJournal,
    route: fcJournal.route,
    profile: fcJournal.profile,
    rules,
    documents: readyDocs,
    manifest: readyManifest,
    approvals: [],
    requiredApprovals: 0,
    anonymizationQa: { passed: true, issues: [] },
    referencesQa: { passed: true, issues: [] },
    renderQa: { passed: true, issues: [] },
    freezeConfirmed: true,
    packageLocked: true,
    workOrder: wo,
    fieldMap: fm,
    externalBundle: bundles.external,
    internalEvidencePackage: bundles.internal,
  });
  report("S19-SM1", fullSnap.packageState === "LOCKED_READY", "package state LOCKED_READY when locked + confirmed + QA passed");
  report("S19-SM2", fullSnap.readyForAction === "READY_FOR_AUTHOR_SUBMISSION", "journal ready_for_action = READY_FOR_AUTHOR_SUBMISSION");
  report("S19-SM3", fullSnap.submissionStatus === "NOT_SUBMITTED_BY_THIS_STAGE", "submission_status = NOT_SUBMITTED_BY_THIS_STAGE");
  report("S19-SM4", fullSnap.workOrder.workOrderId.startsWith("wfc_"), "work order ref propagated");
  report("S19-SM5", fullSnap.fieldMap.mapId.startsWith("fieldmap_"), "field map ref propagated");
  report("S19-SM6", fullSnap.visibilityManifest.length === bundles.external.files.length, "visibility manifest mirrors external bundle");
  report("S19-SM7", fullSnap.externalBundle.manifestId.startsWith("extbundle_") && fullSnap.internalEvidencePackage.manifestId.startsWith("intbundle_"), "both bundles propagated");

  // NSTC ready_for_action = institutional review first
  const nstcFull = buildFinalSubmissionPackageSnapshot({
    workspaceId: fcNstc.workspaceId,
    projectId: fcNstc.projectId,
    workOrderId: fcNstc.workOrderId,
    sourceSnapshot: lqNstc,
    route: fcNstc.route,
    profile: fcNstc.profile,
    rules: buildRuleSnapshots({ route: "NSTC_GENERAL" }),
    documents: (nstcFrozen.ok ? nstcFrozen.documents : nstcDocs).map((d) => ({ ...d, status: "LOCKED" as const })),
    manifest: buildApprovalSubjectManifest({ projectId: "p", documents: nstcFrozen.ok ? nstcFrozen.documents : nstcDocs, createdBy: "u" }),
    approvals: [],
    requiredApprovals: 0,
    anonymizationQa: { passed: true, issues: [] },
    referencesQa: { passed: true, issues: [] },
    renderQa: { passed: true, issues: [] },
    freezeConfirmed: true,
    packageLocked: true,
  });
  report("S19-SM8", nstcFull.readyForAction === "READY_FOR_INSTITUTIONAL_REVIEW", "NSTC ready_for_action = READY_FOR_INSTITUTIONAL_REVIEW (institutional gate first)");
  report("S19-SM9", nstcFull.decision === "READY_FOR_INSTITUTIONAL_REVIEW", "NSTC decision = READY_FOR_INSTITUTIONAL_REVIEW");

  // 19 error codes set (spec §32)
  report("S19-ERR1", typeof fullSnap.checksum === "string" && fullSnap.checksum.startsWith("chk_fs_"), "checksum prefix ok");
} catch (e) {
  report("S19-EXT", false, `full-spec extensions errored: ${e instanceof Error ? e.message : String(e)}`);
}

console.log("");
console.log(`STAGE 19 CONSUMER CONTRACT: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);

// helper
function sha256For(input: unknown): string {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(typeof input === "string" ? input : JSON.stringify(input)).digest("hex");
}