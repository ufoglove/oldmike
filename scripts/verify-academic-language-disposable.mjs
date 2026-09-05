import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAcademicLanguageRequest, parseAcademicProviderResult } from "../lib/academic-language-contract.ts";
import {
  approveLanguageDocument,
  closeAcademicLanguageRepositoryForDisposableTest,
  getAcademicLanguageOverview,
  loadBoundGlossary,
  promoteLanguageDocument,
  replayLanguageRun,
  saveGlossaryVersion,
  saveLanguageRun,
} from "../lib/academic-language-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") {
  console.log("ACADEMIC_LANGUAGE_DISPOSABLE=NOT_EXECUTED");
  console.log("REASON=EXPLICIT_DISPOSABLE_DATABASE_GATE_REQUIRED");
  process.exit(0);
}
const parsedUrl = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname));
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 20_000, application_name: "old-mike-v1527-m02-disposable" });
const migrations = ["0001_better_auth_core.up.sql", "0002_old_mike_tenant.up.sql", "0003_registration_invites.up.sql", "0004_registration_invite_revocation.up.sql", "0005_research_workflow_phase2.up.sql", "0006_admin_provisioned_accounts.up.sql"];
const migration = (name) => readFile(path.join(root, "database", "migrations", name), "utf8");
const q = (sql, values = []) => client.query(sql, values);
let retained = -1;

try {
  await client.connect();
  for (const name of migrations) await q(await migration(name));
  assert.equal((await q("SELECT to_regclass('public.research_topic_lab_runs') IS NULL AS absent")).rows[0].absent, true, "M02 must run on schema 0006 without 0007 objects");
  await q(`
    INSERT INTO "user" (id,name,email) VALUES ('m02_u_a','A','m02-a@example.test'),('m02_u_b','B','m02-b@example.test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('m02_w_a','A','m02_u_a'),('m02_w_b','B','m02_u_b');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('m02_w_a','m02_u_a','owner'),('m02_w_b','m02_u_b','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES
      ('m02_p_a','m02_w_a','m02_u_a','A','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
      ('m02_p_b','m02_w_b','m02_u_b','B','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
  `);
  const tenantA = { userId: "m02_u_a", workspaceId: "m02_w_a", projectId: "m02_p_a", role: "owner" };
  const tenantB = { userId: "m02_u_b", workspaceId: "m02_w_b", projectId: "m02_p_b", role: "owner" };
  const glossaryRequest = parseAcademicLanguageRequest({ operation: "SAVE_GLOSSARY", idempotencyKey: "m02-glossary:disposable-0001", logicalId: "m02-glossary-main", expectedVersion: 0, title: "專案術語庫", tonePreset: "JOURNAL_FORMAL", entries: [{ sourceTerm: "教學實踐研究", targetTerm: "Teaching Practice Research", kind: "FIXED_TRANSLATION", caseSensitive: false }], bannedTerms: [{ term: "prove", replacement: "suggest" }] });
  assert.equal(glossaryRequest.operation, "SAVE_GLOSSARY");
  const glossaries = await Promise.all([
    saveGlossaryVersion({ tenant: tenantA, userId: tenantA.userId, request: glossaryRequest }),
    saveGlossaryVersion({ tenant: tenantA, userId: tenantA.userId, request: glossaryRequest }),
  ]);
  assert.equal(new Set(glossaries.map((item) => item.versionId)).size, 1);
  assert.deepEqual(new Set(glossaries.map((item) => item.idempotent)), new Set([false, true]));
  await assert.rejects(() => loadBoundGlossary(tenantB, glossaries[0].versionId, glossaries[0].contentHash), /glossary_binding_not_found/);
  const bound = await loadBoundGlossary(tenantA, glossaries[0].versionId, glossaries[0].contentHash);

  const transformRequest = parseAcademicLanguageRequest({ operation: "TRANSFORM", idempotencyKey: "m02-language:disposable-0001", logicalId: "m02-language-main", expectedVersion: 0, title: "學術語言草稿", task: "TRANSLATE_ZH_EN", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "教學實踐研究納入 42 participants [1]，劑量為 5 mg。$x=1$", glossaryVersionId: bound.versionId, glossaryHash: bound.contentHash, methodParameters: { preserveCitations: true, preserveNumbers: true, preserveUnits: true, preserveFormulas: true, explainChanges: true } });
  assert.equal(transformRequest.operation, "TRANSFORM");
  const result = parseAcademicProviderResult({ contractVersion: "academic-language/1.0.0", status: "SUCCESS", task: "TRANSLATE_ZH_EN", tonePreset: "JOURNAL_FORMAL", paragraphs: [{ index: 0, source: transformRequest.sourceText, revised: "Teaching Practice Research included 42 participants [1] at a dose of 5 mg. $x=1$", changes: [{ kind: "TRANSLATION", original: "教學實踐研究納入", revised: "Teaching Practice Research included", reason: "採用固定術語並保留原意。" }] }], uncertainties: ["研究者仍需確認專業語境。"] }, transformRequest);
  const documents = await Promise.all([
    saveLanguageRun({ tenant: tenantA, userId: tenantA.userId, request: transformRequest, result }),
    saveLanguageRun({ tenant: tenantA, userId: tenantA.userId, request: transformRequest, result }),
  ]);
  assert.equal(new Set(documents.map((item) => item.documentVersionId)).size, 1);
  assert.deepEqual(new Set(documents.map((item) => item.idempotent)), new Set([false, true]));
  assert.equal((await getAcademicLanguageOverview(tenantB)).documents.length, 0);
  assert.equal((await getAcademicLanguageOverview(tenantA)).documents.length, 1);
  const replay = await replayLanguageRun(tenantA, transformRequest.idempotencyKey, (await import("../lib/academic-language-contract.ts")).academicLanguageRequestHash(transformRequest));
  assert.equal(replay?.documentVersionId, documents[0].documentVersionId);

  await assert.rejects(() => promoteLanguageDocument({ tenant: tenantA, userId: tenantA.userId, request: parseAcademicLanguageRequest({ operation: "PROMOTE_DOCUMENT", idempotencyKey: "m02-promotion:before-gate", documentVersionId: documents[0].documentVersionId, contentHash: documents[0].contentHash, humanGateId: "gate_m02_missing", targetLogicalId: "m02-formal-manuscript", expectedVersion: 0, title: "正式草稿" }) }), /document_human_gate_required/);
  const approvals = await Promise.all([
    approveLanguageDocument({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "m02-approval:disposable-0001", documentVersionId: documents[0].documentVersionId, contentHash: documents[0].contentHash, rationale: "已人工逐段核對內容與固定術語。" }),
    approveLanguageDocument({ tenant: tenantA, userId: tenantA.userId, idempotencyKey: "m02-approval:disposable-0001", documentVersionId: documents[0].documentVersionId, contentHash: documents[0].contentHash, rationale: "已人工逐段核對內容與固定術語。" }),
  ]);
  assert.equal(new Set(approvals.map((item) => item.humanGateId)).size, 1);
  const promotionRequest = parseAcademicLanguageRequest({ operation: "PROMOTE_DOCUMENT", idempotencyKey: "m02-promotion:disposable-0001", documentVersionId: documents[0].documentVersionId, contentHash: documents[0].contentHash, humanGateId: approvals[0].humanGateId, targetLogicalId: "m02-formal-manuscript", expectedVersion: 0, title: "正式草稿" });
  assert.equal(promotionRequest.operation, "PROMOTE_DOCUMENT");
  const promotions = await Promise.all([
    promoteLanguageDocument({ tenant: tenantA, userId: tenantA.userId, request: promotionRequest }),
    promoteLanguageDocument({ tenant: tenantA, userId: tenantA.userId, request: promotionRequest }),
  ]);
  assert.equal(new Set(promotions.map((item) => item.promotedDocumentVersionId)).size, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_documents WHERE workspace_id='m02_w_a' AND project_id='m02_p_a'")).rows[0].count, 3);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_human_gates WHERE workspace_id='m02_w_a' AND project_id='m02_p_a' AND gate_type='DOCUMENT_RELEASE'")).rows[0].count, 1);
  assert.equal((await q("SELECT count(*)::int AS count FROM research_workflow_events WHERE workspace_id='m02_w_a' AND project_id='m02_p_a' AND stage_detail='M02_HUMAN_APPROVED_PROMOTION'")).rows[0].count, 1);
  const appendOnlyRejected = await q("UPDATE research_documents SET body='changed' WHERE id=$1", [documents[0].documentVersionId]).then(() => false, () => true);
  assert.equal(appendOnlyRejected, true);
  retained = 0;
  console.log("M02_ON_SCHEMA_0006=PASS");
  console.log("TENANT_ISOLATION=PASS");
  console.log("IDEMPOTENCY_CONCURRENCY=PASS");
  console.log("APPEND_ONLY_VERSIONS=PASS");
  console.log("HUMAN_GATE_PROMOTION=PASS");
  console.log("ACADEMIC_LANGUAGE_DISPOSABLE=PASS");
} catch (error) {
  console.log("ACADEMIC_LANGUAGE_DISPOSABLE=FAIL");
  console.log(`ERROR_CATEGORY=${typeof error?.code === "string" ? error.code : "ASSERTION_OR_RUNTIME"}`);
  process.exitCode = 2;
} finally {
  console.log(`DISPOSABLE_RETAINED_ROWS=${retained}`);
  await closeAcademicLanguageRepositoryForDisposableTest().catch(() => undefined);
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;").catch(() => undefined);
  await client.end().catch(() => undefined);
}
