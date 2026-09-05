// 臨時真實搜尋驗證 v2（三來源，驗證後刪除）
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
process.env.DATABASE_URL = url;
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 60_000 });
const migration = (name) => readFile(path.join(root, "database", "migrations", `${name}.up.sql`), "utf8");
const q = (sql, values = []) => client.query(sql, values);
const { createHash } = await import("node:crypto");
const sha = (text) => createHash("sha256").update(text).digest("hex");

const MIGRATIONS = ["0001_better_auth_core","0002_old_mike_tenant","0003_registration_invites","0004_registration_invite_revocation","0005_research_workflow_phase2","0006_admin_provisioned_accounts","0007_topic_lab_frontier_radar","0008_research_provenance","0009_submission_navigator","0010_submission_navigator_phase2","0011_submission_navigator_document_type","0012_research_project_foundation","0013_research_blueprint","0014_navigator_drafts","0015_gap_novelty_lab"];
const payload = {
  research_identity: { chineseTitle: "多模態 AI 適性 XR 安全訓練對危害辨識與 30 天保留之影響", primaryRoute: "JOURNAL" },
  core_problem: { realProblem: "現有安全訓練缺乏即時、證據導向的回饋，且危害辨識行為成效與長期保留未被充分驗證" },
  questions: [{ question: "多模態 AI 適性 XR 訓練能否提升新進勞工危害辨識能力？" }],
  theory: ["情境學習理論"],
  method: { direction: "準實驗設計" },
  population_context: { targetPopulation: "製造業新進勞工", researchContext: "工廠安全訓練" },
  intervention: ["XR", "RAG 證據導向回饋"],
  expected_contribution: [{ title: "行為危害辨識指標" }],
  variables: [{ name: "危害辨識正確率" }],
};
try {
  await client.connect();
  for (const name of MIGRATIONS) await q(await migration(name));
  await q(`INSERT INTO "user" (id,name,email) VALUES ('u_a','A','a@example.test')`);
  await q(`INSERT INTO workspaces (id,name,owner_user_id) VALUES ('w_a','A','u_a')`);
  await q(`INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('w_a','u_a','owner')`);
  await q(`INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES ('p_a','w_a','u_a','T','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE')`);
  await q(`INSERT INTO research_projects (id,workspace_id,project_id,created_by_user_id,project_name,project_type,current_stage,status) VALUES ('rp_a','w_a','p_a','u_a','T','JOURNAL_MANUSCRIPT','LITERATURE','ACTIVE')`);
  const payloadText = JSON.stringify(payload);
  const contentHash = sha(payloadText);
  await q(`INSERT INTO research_blueprints (id,workspace_id,project_id,research_project_id,created_by_user_id,status,primary_route,current_version_number,evidence_readiness,source_hash) VALUES ('rbp_a','w_a','p_a','rp_a','u_a','APPROVED','JOURNAL',1,'UNVERIFIED',$1)`, [contentHash]);
  await q(`INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id) VALUES ('rbp_a_v1','w_a','p_a','rbp_a','primary',1,'v1.0','init',$1,$2::jsonb,'u_a')`, [contentHash, payloadText]);

  const repo = await import("../lib/gap-novelty-repository.ts");
  const tenant = { userId: "u_a", workspaceId: "w_a", projectId: "p_a", role: "owner" };
  await repo.createGapNoveltyAnalysis(tenant, { userId: "u_a" });

  for (const taskId of ["TASK_REVIEW_FIRST", "TASK_RECENT_EMPIRICAL"]) {
    const t0 = Date.now();
    const r = await repo.runGapSearchTask(tenant, { userId: "u_a", taskId });
    console.log(`${taskId}: [${Date.now() - t0}ms] status=${r.status} resultCount=${r.resultCount} included=${r.includedCount} sources=${JSON.stringify(r.sources)}`);
    assert.equal(r.status, "COMPLETED");
  }
  const snapshots = (await q(`SELECT database_or_source AS "db", result_count AS "count" FROM search_snapshots WHERE workspace_id='w_a' AND project_id='p_a' ORDER BY date_searched`)).rows;
  console.log("Snapshots:", snapshots.map((s) => `${s.db}(${s.count})`).join(" / "));
  const lit = (await q(`SELECT count(*)::int AS c FROM literature_items WHERE workspace_id='w_a'`)).rows[0].c;
  console.log(`literature_items（canonical）: ${lit}`);
  const closest = await repo.analyzeClosestStudies(tenant, { userId: "u_a" });
  console.log(`Closest: top ${closest.studies}, maxSimilarity=${closest.maxOverall}, risk=${closest.duplicationRisk}`);
  console.log(JSON.stringify({ status: "PASS", phase: "gap-novelty-real-search-3sources", snapshots: snapshots.length, literatureUpserted: lit }));
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}
