// Gap & Novelty Lab — disposable database verification（TEST 01–12，DB/API 層）
// 使用方式：
//   INTEGRATION_DATABASE_URL=postgres://127.0.0.1:5432/<disposable> INTEGRATION_DATABASE_DISPOSABLE=1 \
//     node --experimental-strip-types --experimental-loader ./scripts/gap-novelty-disposable-loader.mjs \
//     scripts/verify-gap-novelty-disposable.mjs
// 未設定 disposable gate 時直接跳過（exit 0）。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1") {
  console.log("DISPOSABLE_DATABASE=NOT_EXECUTED");
  console.log("REASON=EXPLICIT_DISPOSABLE_DATABASE_GATE_REQUIRED");
  process.exit(0);
}
const parsed = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsed.hostname), "disposable DB 必須是本機");

process.env.DATABASE_URL = url; // repository pool 共用同一 disposable DB
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 20_000, application_name: "old-mike-gap-novelty-disposable" });
const migration = (name) => readFile(path.join(root, "database", "migrations", `${name}.up.sql`), "utf8");
const q = (sql, values = []) => client.query(sql, values);
const sha = (text) => createHash("sha256").update(text).digest("hex");

const MIGRATIONS = [
  "0001_better_auth_core", "0002_old_mike_tenant", "0003_registration_invites", "0004_registration_invite_revocation",
  "0005_research_workflow_phase2", "0006_admin_provisioned_accounts", "0007_topic_lab_frontier_radar",
  "0008_research_provenance", "0009_submission_navigator", "0010_submission_navigator_phase2",
  "0011_submission_navigator_document_type", "0012_research_project_foundation", "0013_research_blueprint",
  "0014_navigator_drafts", "0015_gap_novelty_lab",
];

const blueprintPayloadV1 = {
  research_identity: { chineseTitle: "多模態 AI 適性 XR 安全訓練對危害辨識與 30 天保留之影響", primaryRoute: "JOURNAL" },
  core_problem: { realProblem: "現有安全訓練缺乏即時、證據導向的回饋，且危害辨識行為成效與長期保留未被充分驗證" },
  questions: [{ question: "多模態 AI 適性 XR 訓練能否提升新進勞工危害辨識能力？" }, { question: "RAG 證據導向回饋是否改善 30 天保留？" }],
  theory: ["情境學習理論", "多媒體學習認知理論"],
  method: { direction: "準實驗設計" },
  population_context: { targetPopulation: "製造業新進勞工", researchContext: "工廠安全訓練" },
  intervention: ["XR", "多模態 AI 適性", "RAG 證據導向回饋"],
  expected_contribution: [{ title: "行為危害辨識指標" }, { title: "30 天保留評估" }],
  variables: [{ name: "危害辨識正確率" }, { name: "30 天保留率" }],
};

async function seedTenant(client, { userId, workspaceId, projectId, projectTitle }) {
  await q(`INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [userId, userId, `${userId}@example.test`]);
  await q(`INSERT INTO workspaces (id,name,owner_user_id) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [workspaceId, workspaceId, userId]);
  await q(`INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING`, [workspaceId, userId]);
  await q(`INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES ($1,$2,$3,$4,'ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE') ON CONFLICT (workspace_id,project_id) DO NOTHING`, [projectId, workspaceId, userId, projectTitle]);
}

async function seedResearchProject(client, { workspaceId, projectId, userId, researchProjectId, blueprintId, route = "JOURNAL", payload = blueprintPayloadV1, blueprintStatus = "APPROVED" }) {
  await q(`INSERT INTO research_projects (id,workspace_id,project_id,created_by_user_id,project_name,project_type,current_stage,status) VALUES ($1,$2,$3,$4,$5,'JOURNAL_MANUSCRIPT','LITERATURE','ACTIVE') ON CONFLICT (id) DO NOTHING`, [researchProjectId, workspaceId, projectId, userId, `研究專案 ${projectId}`]);
  await q(`INSERT INTO research_blueprints (id,workspace_id,project_id,research_project_id,created_by_user_id,status,primary_route,current_version_number,evidence_readiness,source_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,1,'UNVERIFIED',$8) ON CONFLICT (workspace_id,project_id) DO NOTHING`, [blueprintId, workspaceId, projectId, researchProjectId, userId, blueprintStatus, route, "0".repeat(64)]);
  const payloadText = JSON.stringify(payload);
  const contentHash = await sha(payloadText);
  await q(`INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
           VALUES ($1,$2,$3,$4,'primary',1,NULL,'v1.0 初始藍圖','由系統建立',$5,$6::jsonb,$7,now()) ON CONFLICT DO NOTHING`, [`${blueprintId}_v1`, workspaceId, projectId, blueprintId, contentHash, payloadText, userId]);
  await q(`UPDATE research_blueprints SET source_hash=$1 WHERE id=$2 AND workspace_id=$3`, [contentHash, blueprintId, workspaceId]);
}

let passed = 0;
function ok(name) { passed += 1; console.log(`  ✓ ${name}`); }

try {
  await client.connect();
  for (const name of MIGRATIONS) await q(await migration(name));

  const tenantA = { userId: "u_a", workspaceId: "w_a", projectId: "p_a", role: "owner" };
  await seedTenant(client, { userId: "u_a", workspaceId: "w_a", projectId: "p_a", projectTitle: "主流程專案" });
  await seedResearchProject(client, { workspaceId: "w_a", projectId: "p_a", userId: "u_a", researchProjectId: "rp_a", blueprintId: "rbp_a" });

  const repo = await import("../lib/gap-novelty-repository.ts");

  // ---------- TEST 01：Blueprint v1 → 自動建立 Gap Search Tasks ----------
  console.log("TEST 01（Blueprint v1 → 搜尋任務）");
  const created = await repo.createGapNoveltyAnalysis(tenantA, { userId: "u_a" });
  assert.equal(created.idempotent, false);
  const tasks = await q(`SELECT task_id AS "taskId", search_status AS "searchStatus", gap_type AS "gapType" FROM literature_search_tasks WHERE workspace_id='w_a' AND project_id='p_a' ORDER BY created_at`);
  assert.equal(tasks.rows.length, 4);
  assert.deepEqual(new Set(tasks.rows.map((r) => r.searchStatus)), new Set(["PLANNED", "PENDING_CONNECTION"]));
  assert.ok(tasks.rows.some((r) => r.taskId === "TASK_REVIEW_FIRST" && r.gapType === "EMPIRICAL_GAP"));
  assert.ok(tasks.rows.some((r) => r.taskId === "TASK_CITATION_CHASING" && r.searchStatus === "PENDING_CONNECTION"), "citation chasing 未設定 connector 時應標 PENDING_CONNECTION，不假裝完成");
  ok("4 個搜尋任務已建立（Review-first／Recent Empirical／Foundational／Citation Chasing）");

  // ---------- TEST 02／03／04：文獻中心串接、Evidence Link 與閱讀狀態區分 ----------
  console.log("TEST 03／04（Evidence Link：canonical 文獻＋Citation＋Zotero；Abstract ≠ Fulltext）");
  await q(`INSERT INTO literature_items (id,workspace_id,created_by_user_id,title,authors,year,journal,doi,abstract,normalized_title,source,zotero_item_key)
           VALUES ('lit_1','w_a','u_a','多模態 AI 適性 XR 安全訓練','[{"family":"Smith","given":"A"}]',2023,'Safety Science','10.1000/gap1','XR 安全訓練危害辨識','multimodal ai xr safety training','MANUAL','ZOTKEY1')`);
  await q(`INSERT INTO literature_items (id,workspace_id,created_by_user_id,title,authors,year,journal,doi,abstract,normalized_title,source)
           VALUES ('lit_abs','w_a','u_a','VR 訓練回饋文獻','[{"family":"Lee","given":"B"}]',2021,'Computers & Education','10.1000/gap2','VR 回饋與學習','vr training feedback','MANUAL')`);
  await q(`INSERT INTO project_literature_links (id,workspace_id,project_id,literature_id,created_by_user_id,role,reading_status,evidence_status)
           VALUES ('pll_1','w_a','p_a','lit_1','u_a','["SUPPORTING"]','FULLTEXT_REVIEWED','VERIFIED'),
                  ('pll_2','w_a','p_a','lit_abs','u_a','["SUPPORTING"]','DISCOVERED','UNVERIFIED')`);
  await q(`INSERT INTO citation_sources (id,workspace_id,project_id,literature_id,zotero_item_key,citation_key,doi,citation_status)
           VALUES ('cs_1','w_a','p_a','lit_1','ZOTKEY1','smith2023','10.1000/gap1','CITED')`);
  await repo.saveGapClaims(tenantA, { userId: "u_a", claims: [{ gapId: "GAP1", gapType: "EMPIRICAL_GAP", claim: "現有安全訓練缺乏證據導向回饋且長期保留未驗證", validationStatus: "PROPOSED" }] });
  await repo.linkGapEvidence(tenantA, { userId: "u_a", gapId: "GAP1", literatureIds: ["lit_1", "lit_abs"] });
  const links = (await q(`SELECT gap_id AS "gapId", literature_id AS "literatureId", citation_source_id AS "citationSourceId", zotero_item_key AS "zoteroItemKey", reading_status AS "readingStatus" FROM gap_evidence_links WHERE workspace_id='w_a' AND project_id='p_a' ORDER BY literature_id`)).rows;
  assert.equal(links.length, 2);
  const full = links.find((r) => r.literatureId === "lit_1");
  const abs = links.find((r) => r.literatureId === "lit_abs");
  assert.equal(full.readingStatus, "FULLTEXT_REVIEWED");
  assert.equal(full.citationSourceId, "cs_1");
  assert.equal(full.zoteroItemKey, "ZOTKEY1");
  assert.equal(abs.readingStatus, "ABSTRACT_REVIEWED");
  ok("linkGapEvidence 帶回 literature_id／citation_source_id／zotero_item_key；FULLTEXT 與 ABSTRACT 嚴格區分（TEST 04）");

  // ---------- TEST 05：Gap 無 Evidence 不得標 SUPPORTED ----------
  console.log("TEST 05（無 Evidence 不得標記 SUPPORTED）");
  await assert.rejects(
    repo.saveGapClaims(tenantA, { userId: "u_a", claims: [{ gapId: "GAP_NEW", gapType: "EMPIRICAL_GAP", claim: "沒有證據的宣稱", validationStatus: "SUPPORTED" }] }),
    (error) => error?.code === "gap_claim_supported_without_evidence",
  );
  const supported = await repo.saveGapClaims(tenantA, { userId: "u_a", claims: [{ gapId: "GAP1", gapType: "EMPIRICAL_GAP", claim: "現有安全訓練缺乏證據導向回饋且長期保留未驗證", validationStatus: "SUPPORTED", evidenceStrength: "MODERATE" }] });
  assert.equal(supported.ok, true);
  ok("SUPPORTED 需先有 Evidence Link（服務層防護）");

  // ---------- TEST 06：高度相似 → HIGH_DUPLICATION_RISK ----------
  console.log("TEST 06（高度相似研究 → HIGH_DUPLICATION_RISK）");
  const highSimText = [blueprintPayloadV1.core_problem.realProblem, blueprintPayloadV1.research_identity.chineseTitle, ...blueprintPayloadV1.theory, blueprintPayloadV1.population_context.targetPopulation, blueprintPayloadV1.population_context.researchContext, blueprintPayloadV1.method.direction, ...blueprintPayloadV1.expected_contribution.map((c) => c.title)].join(" ");
  await q(`INSERT INTO literature_items (id,workspace_id,created_by_user_id,title,authors,year,journal,doi,abstract,normalized_title,source)
           VALUES ('lit_high','w_a','u_a',$1,'[{"family":"Chen","given":"C"}]',2024,'Safety Science','10.1000/gap3',$2,'multimodal ai xr safety training duplicate','MANUAL')`, [blueprintPayloadV1.research_identity.chineseTitle, highSimText]);
  await q(`INSERT INTO project_literature_links (id,workspace_id,project_id,literature_id,created_by_user_id,role,reading_status,evidence_status)
           VALUES ('pll_3','w_a','p_a','lit_high','u_a','["SUPPORTING"]','FULLTEXT_REVIEWED','VERIFIED')`);
  const closest = await repo.analyzeClosestStudies(tenantA, { userId: "u_a" });
  assert.equal(closest.duplicationRisk, "HIGH_DUPLICATION_RISK");
  const analysisStatus = (await q(`SELECT status FROM gap_novelty_analyses WHERE workspace_id='w_a' AND project_id='p_a'`)).rows[0].status;
  assert.equal(analysisStatus, "REVISION_REQUIRED");
  const highRow = (await q(`SELECT overall_similarity AS "overall", duplication_risk AS "risk" FROM closest_studies WHERE workspace_id='w_a' AND project_id='p_a' AND literature_id='lit_high'`)).rows[0];
  assert.ok(Number(highRow.overall) >= 85 && highRow.risk === "HIGH_DUPLICATION_RISK");
  ok("相似度 ≥85 → HIGH_DUPLICATION_RISK 且分析標 REVISION_REQUIRED");

  // ---------- TEST 08：Contribution Delta 可反查 Closest Study ----------
  console.log("TEST 08（Contribution Delta 可反查）");
  const deltas = (await q(`SELECT cd.delta_type AS "type", cd.closest_study_id AS "studyId", cs.literature_id AS "literatureId" FROM contribution_deltas cd JOIN closest_studies cs ON cs.id=cd.closest_study_id WHERE cd.workspace_id='w_a' AND cd.project_id='p_a'`)).rows;
  assert.ok(deltas.length >= 1);
  assert.ok(deltas.every((r) => r.studyId && r.literatureId));
  ok(`${deltas.length} 筆 Contribution Delta 均可反查 Closest Study 與文獻`);

  // ---------- TEST 07：搜尋失敗/無結果 → 不製造「全球首創」、不自動 HIGH ----------
  console.log("TEST 07（搜尋不可用 → UNAVAILABLE，不假裝完成、不宣稱首創）");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network_blocked_for_test"); };
  let searchResult;
  try {
    searchResult = await repo.runGapSearchTask(tenantA, { userId: "u_a", taskId: "TASK_RECENT_EMPIRICAL" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(searchResult.status, "UNAVAILABLE");
  assert.equal(searchResult.resultCount, 0);
  const taskRow = (await q(`SELECT search_status AS "status", result_count AS "count" FROM literature_search_tasks WHERE workspace_id='w_a' AND project_id='p_a' AND task_id='TASK_RECENT_EMPIRICAL'`)).rows[0];
  assert.equal(taskRow.status, "UNAVAILABLE");
  assert.equal(taskRow.count, 0);
  const analysisRow = (await q(`SELECT novelty_confidence AS "confidence", status AS "status" FROM gap_novelty_analyses WHERE workspace_id='w_a' AND project_id='p_a'`)).rows[0];
  assert.equal(analysisRow.confidence, "UNVERIFIED");
  const versionTexts = await q(`SELECT payload::text AS "payload" FROM gap_novelty_versions WHERE workspace_id='w_a' AND project_id='p_a'`);
  for (const row of versionTexts.rows) {
    assert.doesNotMatch(row.payload, /全球首創|世界第一|完全無人研究|絕對新穎/u, "不得產生 Global First 宣稱");
  }
  ok("無結果搜尋標 UNAVAILABLE；novelty 保持 UNVERIFIED；無 Global First 宣稱");

  // ---------- TEST 12（前半）：Gate 未通過 → 理論與機制保持鎖定 ----------
  console.log("TEST 12（Gate 未通過 → 不建立 human gate、不 VALIDATED）");
  const earlyValidation = await repo.validateGapNovelty(tenantA, { userId: "u_a" });
  assert.equal(earlyValidation.ok, false);
  assert.ok(earlyValidation.failed.length > 0);
  const earlyGates = (await q(`SELECT count(*)::int AS c FROM research_human_gates WHERE workspace_id='w_a' AND project_id='p_a' AND gate_type='GAP_AND_NOVELTY_RELEASE'`)).rows[0].c;
  assert.equal(earlyGates, 0);
  const earlyStatus = (await q(`SELECT status FROM gap_novelty_analyses WHERE workspace_id='w_a' AND project_id='p_a'`)).rows[0].status;
  assert.equal(earlyStatus, "REVISION_REQUIRED");
  ok("Gate 失敗 → status REVISION_REQUIRED、無 GAP_AND_NOVELTY_RELEASE human gate（理論與機制維持 Locked）");

  // ---------- TEST 09：回寫 Blueprint v2，v1 不變 ----------
  console.log("TEST 09（回寫 Research Blueprint v2 Draft，v1 保持不變）");
  const v1Before = (await q(`SELECT payload::text AS "payload" FROM research_blueprint_versions WHERE workspace_id='w_a' AND project_id='p_a' AND blueprint_id='rbp_a' AND version_number=1`)).rows[0].payload;
  const writeback = await repo.writebackBlueprintV2(tenantA, { userId: "u_a" });
  assert.equal(writeback.versionNumber, 2);
  assert.equal(writeback.blueprintStatus, "TOPIC_RECONSIDERATION_REQUIRED", "高度重複 → blueprint 標 TOPIC_RECONSIDERATION_REQUIRED");
  const v1After = (await q(`SELECT payload::text AS "payload" FROM research_blueprint_versions WHERE workspace_id='w_a' AND project_id='p_a' AND blueprint_id='rbp_a' AND version_number=1`)).rows[0].payload;
  assert.equal(v1After, v1Before, "v1 payload 不得被覆蓋");
  const v2Row = (await q(`SELECT version_label AS "label" FROM research_blueprint_versions WHERE workspace_id='w_a' AND project_id='p_a' AND blueprint_id='rbp_a' AND version_number=2`)).rows[0];
  assert.match(v2Row.label, /^v2\.0/u);
  const bpRow = (await q(`SELECT current_version_number AS "v" FROM research_blueprints WHERE workspace_id='w_a' AND project_id='p_a' AND id='rbp_a'`)).rows[0];
  assert.equal(bpRow.v, 2);
  ok("Blueprint v2 Draft 建立（版本 2），v1 payload 不變；高度重複 → TOPIC_RECONSIDERATION_REQUIRED");

  // 補一筆可重現 snapshot（模擬真實搜尋成功）供 Gate 通過
  const taskDbId = (await q(`SELECT id FROM literature_search_tasks WHERE workspace_id='w_a' AND project_id='p_a' AND task_id='TASK_REVIEW_FIRST'`)).rows[0].id;
  const analysisDbId = (await q(`SELECT id FROM gap_novelty_analyses WHERE workspace_id='w_a' AND project_id='p_a'`)).rows[0].id;
  await q(`INSERT INTO search_snapshots (id,workspace_id,project_id,analysis_id,task_id,database_or_source,exact_query,filters,date_searched,result_count,screening_status,included_literature_ids,excluded_literature_ids,exclusion_reasons,performed_by,search_version)
           VALUES ('gsnap_manual','w_a','p_a',$1,$2,'OpenAlex','xr AND safety AND review','{}',now(),5,'NOT_SCREENED','["lit_1"]','[]','{}','u_a','search-v1-2026-08-30')`, [analysisDbId, taskDbId]);

  // ---------- TEST 12（後半）：Gate 通過 → VALIDATED + human gate ----------
  console.log("TEST 12（後半：Gate 通過 → VALIDATED）");
  const finalValidation = await repo.validateGapNovelty(tenantA, { userId: "u_a" });
  assert.equal(finalValidation.ok, true);
  assert.equal(finalValidation.status, "VALIDATED");
  const finalGates = (await q(`SELECT count(*)::int AS c FROM research_human_gates WHERE workspace_id='w_a' AND project_id='p_a' AND gate_type='GAP_AND_NOVELTY_RELEASE' AND decision='APPROVED'`)).rows[0].c;
  assert.equal(finalGates, 1);
  ok("Gate 通過 → VALIDATED＋GAP_AND_NOVELTY_RELEASE human gate（下一階段可解鎖理論與機制）");

  // ---------- TEST 11：Canonical Literature 單一記錄 ----------
  console.log("TEST 11（同一文獻供多 Project 使用 → canonical 只有一份）");
  await seedTenant(client, { userId: "u_a", workspaceId: "w_a", projectId: "p_a2", projectTitle: "第二專案" });
  await q(`INSERT INTO project_literature_links (id,workspace_id,project_id,literature_id,created_by_user_id,role,reading_status,evidence_status)
           VALUES ('pll_cross','w_a','p_a2','lit_1','u_a','["SUPPORTING"]','ABSTRACT_REVIEWED','UNVERIFIED')`);
  const canonicalCount = (await q(`SELECT count(*)::int AS c FROM literature_items WHERE workspace_id='w_a' AND id='lit_1'`)).rows[0].c;
  const linkCount = (await q(`SELECT count(*)::int AS c FROM project_literature_links WHERE workspace_id='w_a' AND literature_id='lit_1'`)).rows[0].c;
  assert.equal(canonicalCount, 1);
  assert.equal(linkCount, 2);
  await assert.rejects(
    q(`INSERT INTO literature_items (id,workspace_id,created_by_user_id,title,authors,year,normalized_title,source,doi) VALUES ('lit_dup','w_a','u_a','重複 DOI','[]',2023,'duplicate doi','MANUAL','10.1000/gap1')`),
    /duplicate key/u,
  );
  ok("canonical literature_items 只有一份（workspace+doi 唯一）；多專案以 link 關聯");

  // ---------- TEST 10：題目修改 → OUTDATED ----------
  console.log("TEST 10（題目修改 → OUTDATED）");
  await seedResearchProject(client, { workspaceId: "w_a", projectId: "p_a2", userId: "u_a", researchProjectId: "rp_a2", blueprintId: "rbp_a2" });
  const tenantA2 = { userId: "u_a", workspaceId: "w_a", projectId: "p_a2", role: "owner" };
  await repo.createGapNoveltyAnalysis(tenantA2, { userId: "u_a" });
  // 模擬真實編輯：append-only 新增 v1.1（題目重大修改），Blueprint current_version 提升
  const modifiedPayload = structuredClone(blueprintPayloadV1);
  modifiedPayload.research_identity.chineseTitle = "生成式 AI 學徒制安全訓練（題目已重大修改）";
  modifiedPayload.core_problem.realProblem = "研究問題已重寫：聚焦生成式回饋的現場判斷遷移";
  const modifiedText = JSON.stringify(modifiedPayload);
  const modifiedHash = await sha(modifiedText);
  await q(`INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
           VALUES ($1,$2,$3,$4,'primary',2,$5,'v1.1 題目重大修改','使用者修改題目與研究問題',$6,$7::jsonb,'u_a',now())`, [`rbp_a2_v11`, "w_a", "p_a2", "rbp_a2", "rbp_a2_v1", modifiedHash, modifiedText]);
  await q(`UPDATE research_blueprints SET current_version_number=2, source_hash=$1 WHERE workspace_id='w_a' AND project_id='p_a2' AND id='rbp_a2'`, [modifiedHash]);
  const view = await repo.getGapNovelty(tenantA2);
  assert.ok(view.exists);
  assert.equal(view.outdatedReason, "題目、Gap 或投稿路線發生重大修改，Gap 與新穎性分析已標記 OUTDATED。");
  assert.equal(view.analysis?.status, "OUTDATED");
  ok("題目/路線修改 → Gap 分析自動標記 OUTDATED（投稿前需重新驗證）");

  await client.end();
  console.log(JSON.stringify({ status: "PASS", phase: "gap-novelty-phase3-disposable", tests: 12, checks: passed }));
} catch (error) {
  try { await client.end(); } catch { /* ignore */ }
  console.error(error);
  process.exit(1);
}
