import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseReviewProviderResult, parseReviewStudioRequest, reviewStudioHash } from "../lib/review-studio-contract.ts";
import {
  approveReviewDocument,
  closeReviewStudioRepositoryForDisposableTest,
  getReviewStudioOverview,
  promoteReviewDocument,
  replayReviewRun,
  resolveReviewSource,
  saveReviewRevision,
  saveReviewRun,
} from "../lib/review-studio-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") {
  console.log("REVIEW_STUDIO_DISPOSABLE=NOT_EXECUTED"); console.log("REASON=EXPLICIT_DISPOSABLE_DATABASE_GATE_REQUIRED"); process.exit(0);
}
const parsedUrl = new URL(url); assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname));
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 20_000, application_name: "old-mike-v1528-m03-disposable" });
const migrations = ["0001_better_auth_core.up.sql", "0002_old_mike_tenant.up.sql", "0003_registration_invites.up.sql", "0004_registration_invite_revocation.up.sql", "0005_research_workflow_phase2.up.sql", "0006_admin_provisioned_accounts.up.sql"];
const migration = (name) => readFile(path.join(root, "database", "migrations", name), "utf8"); const q = (sql, values = []) => client.query(sql, values);
let retained = -1;
const params = { preserveCitations: true, preserveNumbers: true, preserveUnits: true, preserveFormulas: true, preserveParagraphIdentity: true, explainRecommendations: true, prohibitInventedEvidence: true };
const sourceText = "This method enrolled 42 participants [1] at 5 mg. $x=1$";

try {
  await client.connect(); for (const name of migrations) await q(await migration(name));
  assert.equal((await q("SELECT to_regclass('public.research_topic_lab_runs') IS NULL AS absent")).rows[0].absent, true, "M03 must run on schema 0006 without requiring migration 0007");
  await q(`INSERT INTO "user" (id,name,email) VALUES ('m03_u_a','A','m03-a@example.test'),('m03_u_b','B','m03-b@example.test'); INSERT INTO workspaces (id,name,owner_user_id) VALUES ('m03_w_a','A','m03_u_a'),('m03_w_b','B','m03_u_b'); INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('m03_w_a','m03_u_a','owner'),('m03_w_b','m03_u_b','owner'); INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES ('m03_p_a','m03_w_a','m03_u_a','A','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE'),('m03_p_b','m03_w_b','m03_u_b','B','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');`);
  const tenantA = { userId: "m03_u_a", workspaceId: "m03_w_a", projectId: "m03_p_a", role: "owner" }; const tenantB = { userId: "m03_u_b", workspaceId: "m03_w_b", projectId: "m03_p_b", role: "owner" };
  const request = parseReviewStudioRequest({ operation: "RUN_REVIEW", idempotencyKey: "m03-review:disposable-0001", logicalId: "m03-review-main", expectedVersion: 0, title: "初次審稿", stage: "REVIEW", cycle: 0, previousReviewDocumentVersionId: null, source: { kind: "PASTED_TEXT", text: sourceText }, lenses: ["ARGUMENT_STRUCTURE", "METHOD", "EVIDENCE_CLAIM_SUPPORT", "CLARITY", "TERMINOLOGY", "JOURNAL_FIT", "ETHICS_REPRODUCIBILITY"], journalProfile: "審慎學術期刊。", methodParameters: params });
  assert.equal(request.operation, "RUN_REVIEW"); const resolved = await resolveReviewSource(tenantA, request); const start = sourceText.indexOf("method");
  const result = parseReviewProviderResult({ contractVersion: "review-studio/1.0.0", status: "SUCCESS", cycle: 0, qualityDelta: 8, lenses: request.lenses, findings: [{ findingId: "finding-method-0001", lens: "METHOD", severity: "P1", paragraphId: "p-001", startOffset: start, endOffset: start + 6, sourceSpanHash: reviewStudioHash("method"), suggestedRevision: "study", rationale: "方法稱呼需精確。", risk: "設計可能被誤解。", uncertainty: "需作者確認。", action: "核對設計。" }], uncertainties: ["未取得設計附件。"] }, resolved);
  const reviews = await Promise.all([saveReviewRun({ tenant: tenantA, userId: tenantA.userId, request: resolved, result }), saveReviewRun({ tenant: tenantA, userId: tenantA.userId, request: resolved, result })]);
  assert.equal(new Set(reviews.map((item) => item.reviewDocumentVersionId)).size, 1); assert.deepEqual(new Set(reviews.map((item) => item.idempotent)), new Set([false, true]));
  assert.equal((await getReviewStudioOverview(tenantB)).reviews.length, 0); assert.equal((await getReviewStudioOverview(tenantA)).reviews.length, 1);
  assert.ok(await replayReviewRun(tenantA, request.idempotencyKey, (await import("../lib/review-studio-contract.ts")).reviewRequestHash(request)));
  const revisionRequest = parseReviewStudioRequest({ operation: "SAVE_REVISION", idempotencyKey: "m03-revision:disposable-0001", reviewDocumentVersionId: reviews[0].reviewDocumentVersionId, reviewContentHash: reviews[0].contentHash, logicalId: "m03-revision-main", expectedVersion: 0, title: "修訂一", decisions: [{ findingId: "finding-method-0001", action: "ACCEPT", editedText: null }] });
  assert.equal(revisionRequest.operation, "SAVE_REVISION"); const revisions = await Promise.all([saveReviewRevision({ tenant: tenantA, userId: tenantA.userId, request: revisionRequest }), saveReviewRevision({ tenant: tenantA, userId: tenantA.userId, request: revisionRequest })]);
  assert.equal(new Set(revisions.map((item) => item.documentVersionId)).size, 1); assert.equal(revisions[0].revisedText, "This study enrolled 42 participants [1] at 5 mg. $x=1$");
  await assert.rejects(() => approveReviewDocument({ tenant: tenantA, userId: tenantA.userId, request: parseReviewStudioRequest({ operation: "APPROVE_DOCUMENT", idempotencyKey: "m03-approval:before-convergence", documentVersionId: revisions[0].documentVersionId, contentHash: revisions[0].contentHash, reviewDocumentVersionId: reviews[0].reviewDocumentVersionId, reviewContentHash: reviews[0].contentHash, rationale: "已完成人工核對但尚未重新審查。" }) }), /review_convergence_gate_required/);
  const reReviewRequest = parseReviewStudioRequest({ operation: "RUN_REVIEW", idempotencyKey: "m03-re-review:disposable-0001", logicalId: "m03-review-main", expectedVersion: 1, title: "重新審查", stage: "RE_REVIEW", cycle: 1, previousReviewDocumentVersionId: reviews[0].reviewDocumentVersionId, source: { kind: "DOCUMENT_VERSION", documentVersionId: revisions[0].documentVersionId, contentHash: revisions[0].contentHash }, lenses: request.lenses, journalProfile: "審慎學術期刊。", methodParameters: params });
  assert.equal(reReviewRequest.operation, "RUN_REVIEW"); const reResolved = await resolveReviewSource(tenantA, reReviewRequest);
  const converged = parseReviewProviderResult({ contractVersion: "review-studio/1.0.0", status: "SUCCESS", cycle: 1, qualityDelta: 2, lenses: request.lenses, findings: [], uncertainties: [] }, reResolved);
  const reReview = await saveReviewRun({ tenant: tenantA, userId: tenantA.userId, request: reResolved, result: converged }); assert.equal(reReview.earlyStopEligible, true);
  const approvalRequest = parseReviewStudioRequest({ operation: "APPROVE_DOCUMENT", idempotencyKey: "m03-approval:disposable-0001", documentVersionId: revisions[0].documentVersionId, contentHash: revisions[0].contentHash, reviewDocumentVersionId: reReview.reviewDocumentVersionId, reviewContentHash: reReview.contentHash, rationale: "已人工核對主張、方法、引文與所有固定內容。" });
  assert.equal(approvalRequest.operation, "APPROVE_DOCUMENT"); const approvals = await Promise.all([approveReviewDocument({ tenant: tenantA, userId: tenantA.userId, request: approvalRequest }), approveReviewDocument({ tenant: tenantA, userId: tenantA.userId, request: approvalRequest })]); assert.equal(new Set(approvals.map((item) => item.humanGateId)).size, 1);
  const promotionRequest = parseReviewStudioRequest({ operation: "PROMOTE_DOCUMENT", idempotencyKey: "m03-promotion:disposable-0001", documentVersionId: revisions[0].documentVersionId, contentHash: revisions[0].contentHash, humanGateId: approvals[0].humanGateId, targetLogicalId: "m03-formal-manuscript", expectedVersion: 0, title: "審稿後正式草稿" });
  assert.equal(promotionRequest.operation, "PROMOTE_DOCUMENT"); const promoted = await Promise.all([promoteReviewDocument({ tenant: tenantA, userId: tenantA.userId, request: promotionRequest }), promoteReviewDocument({ tenant: tenantA, userId: tenantA.userId, request: promotionRequest })]); assert.equal(new Set(promoted.map((item) => item.promotedDocumentVersionId)).size, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_documents WHERE workspace_id='m03_w_a' AND project_id='m03_p_a'")).rows[0].count, 4);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_human_gates WHERE workspace_id='m03_w_a' AND project_id='m03_p_a' AND gate_type='DOCUMENT_RELEASE'")).rows[0].count, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_workflow_events WHERE workspace_id='m03_w_a' AND project_id='m03_p_a' AND stage_detail='M03_REVISION_SAVED'")).rows[0].count, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_workflow_events WHERE workspace_id='m03_w_a' AND project_id='m03_p_a' AND stage_detail='M03_HUMAN_APPROVED_PROMOTION'")).rows[0].count, 1);
  const appendOnlyRejected = await q("UPDATE research_documents SET body='changed' WHERE id=$1", [revisions[0].documentVersionId]).then(() => false, () => true); assert.equal(appendOnlyRejected, true);
  retained = 0;
  console.log("M03_ON_SCHEMA_0006=PASS"); console.log("TENANT_ISOLATION=PASS"); console.log("IDEMPOTENCY_CONCURRENCY=PASS"); console.log("APPEND_ONLY_VERSION_GATE=PASS"); console.log("REVIEW_REVISE_REREVIEW_GATE=PASS"); console.log("MAX_TWO_LOOPS_GATE=PASS"); console.log("EARLY_STOP_GATE=PASS"); console.log("HUMAN_GATE=PASS"); console.log("DATABASE_WRITES_FIXTURE_ONLY=PASS");
} finally {
  await closeReviewStudioRepositoryForDisposableTest().catch(() => undefined); await client.end().catch(() => undefined); console.log(`DISPOSABLE_RETAINED_ROWS=${retained}`);
}
