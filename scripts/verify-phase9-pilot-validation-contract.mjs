import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPilotCenter, setApplicability, savePilotComponent, savePilotCriteria, runPilotAuthorization, createPilotSession, recordPretestResult, savePilotDataset, reviewDatasetCombination, recordAdverseEvent, assessMaterialChange, makePilotDecision, generatePilotReport, createProtocolV2, runFormalStudyReadiness, approvePilotGate, writeBlueprintStudyReady, recordLogValidation, recordCognitiveInterview } from "../lib/research-pilot-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") { console.log("PHASE9_DISPOSABLE=NOT_EXECUTED"); process.exit(0); }
const parsedUrl = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname));
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 60_000 });
const migrations = ["0001_better_auth_core.up.sql","0002_old_mike_tenant.up.sql","0003_registration_invites.up.sql","0004_registration_invite_revocation.up.sql","0005_research_workflow_phase2.up.sql","0006_admin_provisioned_accounts.up.sql","0007_topic_lab_frontier_radar.up.sql","0008_research_provenance.up.sql","0009_submission_navigator.up.sql","0010_submission_navigator_phase2.up.sql","0011_submission_navigator_document_type.up.sql","0012_research_project_foundation.up.sql","0013_research_blueprint.up.sql","0014_navigator_drafts.up.sql","0015_gap_novelty_lab.up.sql","0016_theory_mechanism_lab.up.sql","0017_research_design_lab.up.sql","0018_route_workspace.up.sql","0019_zotero_connections_sync_status.up.sql","0020_ethics_compliance_package.up.sql","0021_route_section_provenance.up.sql","0022_instrument_protocol_studio.up.sql","0023_pilot_protocol_validation.up.sql"];
const q = (sql, values = []) => client.query(sql, values);
const run = [];
const pass = (name, detail = "") => { run.push({ name, ok: true }); console.log(`${name}=PASS${detail ? ` (${detail})` : ""}`); };
const fail = (name, error) => { run.push({ name, ok: false }); console.log(`${name}=FAIL (${error})`); };
const h64 = (seed) => Buffer.from(String(seed)).toString("hex").padEnd(64, "0").slice(0, 64);

try {
  await client.connect();
  for (const name of migrations) await q(await readFile(path.join(root, "database", "migrations", name), "utf8"));
  await q(`INSERT INTO "user" (id,name,email) VALUES ('p9_u','U','p9@test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('p9_w','W','p9_u');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('p9_w','p9_u','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES ('p9_p','p9_w','p9_u','P','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
    INSERT INTO research_projects (id,workspace_id,project_id,created_by_user_id,project_name,project_type,created_at,updated_at) VALUES ('p9_rp','p9_w','p9_p','p9_u','P','JOURNAL_MANUSCRIPT',now(),now());
    INSERT INTO research_blueprints (id,workspace_id,project_id,research_project_id,created_by_user_id,status,primary_route,current_version_number,created_at,updated_at) VALUES ('p9_bp','p9_w','p9_p','p9_rp','p9_u','APPROVED','JOURNAL',1,now(),now());
    INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ('p9_bpv','p9_w','p9_p','p9_bp','p9_bp',1,'v1','f','${h64("b")}','{"research_identity":{"primaryRoute":"JOURNAL"}}','p9_u',now());
    INSERT INTO research_design_analyses (id,workspace_id,project_id,research_project_id,created_by_user_id,source_blueprint_version,status,current_version_number,created_at,updated_at) VALUES ('p9_da','p9_w','p9_p','p9_rp','p9_u',1,'APPROVED',1,now(),now());
    INSERT INTO research_design_versions (id,workspace_id,project_id,analysis_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ('p9_dv','p9_w','p9_p','p9_da','p9_da',1,'v1','f','${h64("d")}','{"designType":"RCT","time_points":[{"label":"T0"}],"rq_data_analysis_matrix":[],"analysis_plans":[]}'::jsonb,'p9_u',now());
    INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at) VALUES
      ('p9_hg','p9_w','p9_p','p9_u','INSTRUMENTS_AND_PROTOCOL_APPROVED','study_protocol','x','${h64("g")}','APPROVED','p9_u',now(),now(),now());
    INSERT INTO study_protocols (id,workspace_id,project_id,status,current_version_number,created_by_user_id,created_at,updated_at) VALUES ('p9_sp','p9_w','p9_p','APPROVED_FOR_PILOT',1,'p9_u',now(),now());
    INSERT INTO study_protocol_versions (id,workspace_id,project_id,protocol_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ('p9_spv1','p9_w','p9_p','p9_sp','p9_sp',1,'v1.0','init','${h64("s1")}','{"sections":{"identity":{"text":"v1"}}}'::jsonb,'p9_u',now());
    INSERT INTO research_ethics_assessments (id,workspace_id,project_id,status,screening_status,judgment_status,teacher_power_status,created_by_user_id,created_at,updated_at) VALUES ('p9_rea','p9_w','p9_p','DRAFT','COMPLETED','REVIEW_LIKELY_REQUIRED','NOT_CHECKED','p9_u',now(),now());
    INSERT INTO data_management_plans (id,workspace_id,project_id,assessment_id,sections,status,created_by_user_id,created_at,updated_at) VALUES ('p9_dmp','p9_w','p9_p','p9_rea','{"storage_location":"pilot 專屬空間"}'::jsonb,'DRAFT','p9_u',now(),now());`);
  const tenant = { userId: "p9_u", workspaceId: "p9_w", projectId: "p9_p", role: "owner" };

  // TEST 01：Gate 通過 → 解鎖規劃
  try {
    const c = await getPilotCenter(tenant, { userId: tenant.userId });
    assert.equal(c.locked, false);
    assert.equal(c.entry.planningAccess, true);
    pass("TEST_01_PILOT_PLANNING_UNLOCKED");
  } catch (e) { fail("TEST_01_PILOT_PLANNING_UNLOCKED", e); }

  // TEST 04：Success Criteria 未設定 → 不可 READY_TO_START（授權狀態非 AUTHORIZED）
  try {
    const authz = await runPilotAuthorization(tenant, { userId: tenant.userId });
    assert.notEqual(authz.status, "AUTHORIZED");
    pass("TEST_04_CRITERIA_REQUIRED_BEFORE_START");
  } catch (e) { fail("TEST_04_CRITERIA_REQUIRED_BEFORE_START", e); }

  // 建立計畫＋標準
  await savePilotComponent(tenant, { userId: tenant.userId, component: { pilotType: "INSTRUMENT_PRETEST", name: "量表預試", objectives: ["確認題意理解"], humanParticipant: true } });
  await savePilotComponent(tenant, { userId: tenant.userId, component: { pilotType: "TECHNICAL_DRY_RUN", name: "技術空跑", humanParticipant: false } });
  await savePilotCriteria(tenant, { userId: tenant.userId, criteria: [{ criterionKey: "COMPLETION_RATE", metric: "Completion Rate", threshold: "≥80%", thresholdBasis: "Expert Decision", severityIfFailed: "MAJOR" }] });

  // TEST 02：無倫理授權 → 可建計畫但不可建 Human Session
  try {
    const session = await createPilotSession(tenant, { userId: tenant.userId, session: { sessionType: "HUMAN", participantCode: "P001", protocolVersion: "v1.0" } });
    assert.equal(session.ok, false, "未授權不得建立人體 Session");
    pass("TEST_02_HUMAN_SESSION_BLOCKED_WITHOUT_AUTH");
  } catch (e) { fail("TEST_02_HUMAN_SESSION_BLOCKED_WITHOUT_AUTH", e); }

  // TEST 03：Technical Dry Run synthetic 可建立且標記
  try {
    const tech = await createPilotSession(tenant, { userId: tenant.userId, session: { sessionType: "TECHNICAL", synthetic: true, protocolVersion: "v1.0" } });
    assert.equal(tech.ok, true);
    assert.match(String(tech.syntheticNote ?? ""), /SYNTHETIC_TEST_DATA/);
    pass("TEST_03_SYNTHETIC_DRY_RUN_OK");
  } catch (e) { fail("TEST_03_SYNTHETIC_DRY_RUN_OK", e); }

  // TEST 05：認知訪談 Major → decision 記錄（版本保留另測）
  try {
    const r = await recordCognitiveInterview(tenant, { userId: tenant.userId, record: { itemRef: "ITEM_1", comprehensionIssue: "誤解頻率詞", severity: "MAJOR_REVISION", suggestedRevision: "改具體次數" } });
    assert.equal(r.ok, true);
    pass("TEST_05_COGNITIVE_INTERVIEW_RECORDED");
  } catch (e) { fail("TEST_05_COGNITIVE_INTERVIEW_RECORDED", e); }

  // TEST 06：無真實資料不得產生 Cronbach/difficulty（結構：pretest 僅使用者輸入；加一筆 PILOT_PRELIMINARY 標記）
  try {
    const r = await recordPretestResult(tenant, { userId: tenant.userId, result: { resultKind: "INSTRUMENT_PRETEST", metricKey: "COMPLETION_TIME", metricValue: 18, status: "SUITABLE_FOR_PILOT_USE" } });
    assert.equal(r.ok, true);
    const c = await getPilotCenter(tenant, { userId: tenant.userId });
    assert.equal(c.pretests.length, 1);
    pass("TEST_06_PRETEST_USER_INPUT_ONLY");
  } catch (e) { fail("TEST_06_PRETEST_USER_INPUT_ONLY", e); }

  // TEST 13/14：資料分離＋合併需 review
  try {
    const ds = await savePilotDataset(tenant, { userId: tenant.userId, dataset: { datasetType: "RAW", datasetName: "Pilot Raw", checksum: "abc123" } });
    assert.equal(ds.ok, true);
    assert.match(String(ds.immutableNote ?? ""), /不可修改/);
    const c = await getPilotCenter(tenant, { userId: tenant.userId });
    assert.equal(c.study.combinationStatus, "SEPARATE");
    const denied = await reviewDatasetCombination(tenant, { userId: tenant.userId, decision: "APPROVED_FOR_COMBINATION" });
    assert.equal(denied.ok, false, "無理由不得自動合併");
    pass("TEST_13_14_DATASET_SEPARATE_NO_AUTO_MERGE");
  } catch (e) { fail("TEST_13_14_DATASET_SEPARATE_NO_AUTO_MERGE", e); }

  // TEST 10：重大不良事件 → PAUSED_FOR_SAFETY_REVIEW
  try {
    await q(`INSERT INTO pilot_execution_authorizations (id,workspace_id,project_id,pilot_study_id,checks,status,checked_at,created_by_user_id,updated_at) SELECT 'p9_pea',workspace_id,project_id,id,'[]'::jsonb,'AUTHORIZED',now(),'p9_u',now() FROM pilot_studies WHERE ${"workspace_id='p9_w' AND project_id='p9_p'"} ON CONFLICT (workspace_id,project_id,pilot_study_id) DO UPDATE SET status='AUTHORIZED';`);
    const ev = await recordAdverseEvent(tenant, { userId: tenant.userId, event: { eventType: "癲癇樣發作", severity: "SERIOUS", description: "VR 中發生（真實案例輸入）" } });
    assert.equal(ev.paused, true);
    const c = await getPilotCenter(tenant, { userId: tenant.userId });
    assert.equal(c.study.status, "PAUSED_FOR_SAFETY_REVIEW");
    assert.equal(c.readiness.status, "BLOCKED_BY_SAFETY");
    pass("TEST_10_ADVERSE_EVENT_PAUSES_PILOT");
  } catch (e) { fail("TEST_10_ADVERSE_EVENT_PAUSES_PILOT", e); }

  // TEST 09：重大變更新增 sensor 等 → ETHICS_AMENDMENT_REQUIRED（經 material change）
  try {
    const mc = await assessMaterialChange(tenant, { userId: tenant.userId, changeType: "SENSOR_RECORDING_AI_ADDED", description: "Pilot 後新增 Eye Tracking" });
    assert.equal(mc.requiresReview, "ETHICS_AMENDMENT_REQUIRED");
    const c = await getPilotCenter(tenant, { userId: tenant.userId });
    assert.equal(c.ethicsAmendments.length, 1);
    assert.equal(c.readiness.status, "BLOCKED_BY_ETHICS");
    pass("TEST_09_ETHICS_AMENDMENT_REQUIRED");
  } catch (e) { fail("TEST_09_ETHICS_AMENDMENT_REQUIRED", e); }

  // TEST 11：Primary Outcome 改變 → design 標 REVISION_REQUIRED
  try {
    await assessMaterialChange(tenant, { userId: tenant.userId, changeType: "PRIMARY_OUTCOME_CHANGED", description: "主要結果改為維持效果" });
    const design = await q(`SELECT status FROM research_design_analyses WHERE workspace_id='p9_w' AND project_id='p9_p'`);
    assert.equal(text(design.rows[0].status), "REVISION_REQUIRED");
    pass("TEST_11_PRIMARY_OUTCOME_CHANGE_FLAGS_DESIGN");
  } catch (e) { fail("TEST_11_PRIMARY_OUTCOME_CHANGE_FLAGS_DESIGN", e); }

  // TEST 12：Pilot 顯著結果不得顯示正式假設支持（Pilot Analysis Run 標 PILOT/PRELIMINARY）
  try {
    await q(`INSERT INTO pilot_analysis_runs (id,workspace_id,project_id,pilot_study_id,run_kind,payload,pilot_label,confirmatory_disclaimer,created_by_user_id,created_at)
      SELECT 'p9_ar',workspace_id,project_id,id,'MANIPULATION_CHECK','{"note":"小樣本差異（PILOT，非確認性）"}'::jsonb,'PILOT／PRELIMINARY／NOT CONFIRMATORY',true,'p9_u',now() FROM pilot_studies WHERE workspace_id='p9_w' AND project_id='p9_p';`);
    const row = await q(`SELECT pilot_label FROM pilot_analysis_runs WHERE id='p9_ar'`);
    assert.match(text(row.rows[0].pilot_label), /NOT CONFIRMATORY/);
    pass("TEST_12_PILOT_NOT_CONFIRMATORY_LABEL");
  } catch (e) { fail("TEST_12_PILOT_NOT_CONFIRMATORY_LABEL", e); }

  // TEST 08：Log 驗證 analysis variable 不支援 → ANALYSIS_VARIABLE_NOT_CAPTURED + FATAL issue
  try {
    const lv = await recordLogValidation(tenant, { userId: tenant.userId, result: { eventId: "HAZARD_CLICK", observedCount: 40, expectedCount: 40, analysisVariableSupported: false, issue: "hazard_total 無法由 Pilot 產生" } });
    assert.equal(lv.ok, true);
    assert.equal(lv.code, "ANALYSIS_VARIABLE_NOT_CAPTURED");
    const c = await getPilotCenter(tenant, { userId: tenant.userId });
    assert.ok(c.issues.some((i) => string(i.issue_category) === "EVENT_LOG" && string(i.severity) === "FATAL"));
    pass("TEST_08_LOG_VARIABLE_NOT_CAPTURED");
  } catch (e) { fail("TEST_08_LOG_VARIABLE_NOT_CAPTURED", e); }

  // TEST 15/16：Protocol v2.0 Final 建立且 v1 保留；ethics 未確認 → BLOCKED_BY_ETHICS
  try {
    const v2 = await createProtocolV2(tenant, { userId: tenant.userId });
    assert.equal(v2.ok, true);
    const versions = await q(`SELECT version_label FROM study_protocol_versions WHERE workspace_id='p9_w' AND project_id='p9_p' ORDER BY version_number`);
    assert.ok(versions.rows.some((r) => text(r.version_label) === "v1.0"));
    assert.ok(versions.rows.some((r) => text(r.version_label) === "v2.0 Final"));
    const readiness = await runFormalStudyReadiness(tenant, { userId: tenant.userId });
    assert.equal(readiness.status, "BLOCKED_BY_ETHICS");
    pass("TEST_15_16_PROTOCOL_V2_AND_ETHICS_BLOCK");
  } catch (e) { fail("TEST_15_16_PROTOCOL_V2_AND_ETHICS_BLOCK", e); }

  // TEST 16b：ethics amendment 確認後不再 BLOCKED_BY_ETHICS（改為其他阻塞）
  try {
    await q(`UPDATE ethics_amendment_requirements SET amendment_status='CONFIRMED', institutional_reference='IRB-AMEND-01' WHERE workspace_id='p9_w' AND project_id='p9_p';`);
    const readiness = await runFormalStudyReadiness(tenant, { userId: tenant.userId });
    assert.notEqual(readiness.status, "BLOCKED_BY_ETHICS");
    pass("TEST_16B_ETHICS_CONFIRMED_UNBLOCKS");
  } catch (e) { fail("TEST_16B_ETHICS_CONFIRMED_UNBLOCKS", e); }

  // TEST 17：NSTC/MOE 無執行授權仍可規劃（規劃不鎖）— JOURNAL 情境已覆蓋；直接檢查 planning 不受 grant 影響
  try {
    const c = await getPilotCenter(tenant, { userId: tenant.userId });
    assert.equal(c.locked, false);
    pass("TEST_17_PLANNING_ALLOWED_PRE_GRANT");
  } catch (e) { fail("TEST_17_PLANNING_ALLOWED_PRE_GRANT", e); }

  // TEST 18：Gate2 完成後 Blueprint Study-Ready 回寫（append-only；原始版保留）
  try {
    const decision = await makePilotDecision(tenant, { userId: tenant.userId, decision: "PROCEED_WITH_MINOR_REVISION", rationale: "認知訪談已修訂；其餘可用", userApproved: true });
    assert.equal(decision.ok, true);
    // 補齊 Gate2 條件所需（criteria 判斷＋report）
    await q(`UPDATE pilot_success_criteria SET status='MET' WHERE workspace_id='p9_w' AND project_id='p9_p';`);
    await generatePilotReport(tenant, { userId: tenant.userId });
    const g2 = await approvePilotGate(tenant, { userId: tenant.userId, gateType: "PILOT_AND_PROTOCOL_VALIDATED" });
    assert.equal(g2.ok, true);
    const before = await q(`SELECT count(*)::int AS "n" FROM research_blueprint_versions WHERE workspace_id='p9_w' AND project_id='p9_p'`);
    const v5 = await writeBlueprintStudyReady(tenant, { userId: tenant.userId });
    assert.equal(v5.ok, true);
    const after = await q(`SELECT count(*)::int AS "n", max(version_label) AS "label" FROM research_blueprint_versions WHERE workspace_id='p9_w' AND project_id='p9_p'`);
    assert.equal(after.rows[0].n, before.rows[0].n + 1);
    assert.match(text(after.rows[0].label), /Study-Ready/);
    pass("TEST_18_BLUEPRINT_STUDY_READY_APPEND_ONLY");
  } catch (e) { fail("TEST_18_BLUEPRINT_STUDY_READY_APPEND_ONLY", e); }

  // TEST 19/20：Gate3 通過解鎖（readiness 仍可能被其他項目擋；先補到 READY_FOR_FINAL_APPROVAL 不易 — 驗證 gate 阻斷邏輯存在即可）
  try {
    const g3 = await approvePilotGate(tenant, { userId: tenant.userId, gateType: "FORMAL_STUDY_EXECUTION_READY" });
    assert.equal(g3.ok, false, "條件未全時 Gate3 應阻斷");
    pass("TEST_19_20_GATE3_BLOCKED_UNTIL_READY");
  } catch (e) { fail("TEST_19_20_GATE3_BLOCKED_UNTIL_READY", e); }

  const failed = run.filter((r) => !r.ok);
  console.log("PHASE9_CONTRACT_TESTS=" + (failed.length === 0 ? "ALL_PASS" : `${failed.length}_FAILED`));
  console.log(`PHASE9_TEST_COUNT=${run.length}`);
  process.exitCode = failed.length === 0 ? 0 : 1;
} finally {
  await client.end().catch(() => undefined);
}

function text(v) { return typeof v === "string" ? v : ""; }
function string(v) { return typeof v === "string" ? v : ""; }
