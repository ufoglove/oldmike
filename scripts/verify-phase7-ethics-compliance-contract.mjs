import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getEthicsCenter,
  saveEthicsScopeItems,
  runEthicsScreening,
  saveEthicsDocument,
  saveInstitutionalEthicsDecision,
  savePreregistration,
  registerPreregistration,
} from "../lib/research-ethics-repository.ts";
import {
  getReviewCompliance,
  runReviewerSimulation,
  runComplianceCheck,
  updateComplianceItem,
  approveComplianceGate,
  saveEligibility,
} from "../lib/review-compliance-repository.ts";
import {
  getApplicationPackage,
  approvePackageGate,
} from "../lib/application-package-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") {
  console.log("PHASE7_DISPOSABLE=NOT_EXECUTED");
  console.log("REASON=EXPLICIT_DISPOSABLE_DATABASE_GATE_REQUIRED");
  process.exit(0);
}
const parsedUrl = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname));
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 60_000, application_name: "old-mike-v180-phase7-disposable" });
const migrations = [
  "0001_better_auth_core.up.sql", "0002_old_mike_tenant.up.sql", "0003_registration_invites.up.sql", "0004_registration_invite_revocation.up.sql",
  "0005_research_workflow_phase2.up.sql", "0006_admin_provisioned_accounts.up.sql", "0007_topic_lab_frontier_radar.up.sql", "0008_research_provenance.up.sql",
  "0009_submission_navigator.up.sql", "0010_submission_navigator_phase2.up.sql", "0011_submission_navigator_document_type.up.sql", "0012_research_project_foundation.up.sql",
  "0013_research_blueprint.up.sql", "0014_navigator_drafts.up.sql", "0015_gap_novelty_lab.up.sql", "0016_theory_mechanism_lab.up.sql",
  "0017_research_design_lab.up.sql", "0018_route_workspace.up.sql", "0019_zotero_connections_sync_status.up.sql", "0020_ethics_compliance_package.up.sql",
];
const migration = (name) => readFile(path.join(root, "database", "migrations", name), "utf8");
const q = (sql, values = []) => client.query(sql, values);
const h64 = (value) => requireHash(value);
function requireHash(value) {
  return Buffer.from(String(value)).toString("hex").padEnd(64, "0").slice(0, 64);
}
let retained = -1;

const run = [];
const pass = (name, detail = "") => { run.push({ name, ok: true, detail }); console.log(`${name}=PASS${detail ? ` (${detail})` : ""}`); };
const fail = (name, error) => { run.push({ name, ok: false, detail: String(error) }); console.log(`${name}=FAIL (${error})`); };

try {
  await client.connect();
  for (const name of migrations) await q(await migration(name));
  // fixtures：三個 tenant（JOURNAL / NSTC / MOE）
  await q(`INSERT INTO "user" (id,name,email) VALUES
    ('p7_u_a','A','p7-a@example.test'),('p7_u_b','B','p7-b@example.test'),('p7_u_c','C','p7-c@example.test');`);
  await q(`INSERT INTO workspaces (id,name,owner_user_id) VALUES ('p7_w_a','A','p7_u_a'),('p7_w_b','B','p7_u_b'),('p7_w_c','C','p7_u_c');`);
  await q(`INSERT INTO workspace_members (workspace_id,user_id,role) VALUES
    ('p7_w_a','p7_u_a','owner'),('p7_w_b','p7_u_b','owner'),('p7_w_c','p7_u_c','owner');`);
  await q(`INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES
    ('p7_p_a','p7_w_a','p7_u_a','JOURNAL','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
    ('p7_p_b','p7_w_b','p7_u_b','NSTC','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE'),
    ('p7_p_c','p7_w_c','p7_u_c','MOE','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');`);
  await q(`INSERT INTO research_projects (id,workspace_id,project_id,created_by_user_id,project_name,project_type,created_at,updated_at) VALUES
    ('p7_rp_a','p7_w_a','p7_p_a','p7_u_a','JOURNAL','JOURNAL_MANUSCRIPT',now(),now()),
    ('p7_rp_b','p7_w_b','p7_p_b','p7_u_b','NSTC','NSTC',now(),now()),
    ('p7_rp_c','p7_w_c','p7_p_c','p7_u_c','MOE','MOE_TEACHING_PRACTICE',now(),now());`);
  await q(`INSERT INTO research_blueprints (id,workspace_id,project_id,research_project_id,created_by_user_id,status,primary_route,current_version_number,created_at,updated_at) VALUES
    ('p7_bp_a','p7_w_a','p7_p_a','p7_rp_a','p7_u_a','APPROVED','JOURNAL',1,now(),now()),
    ('p7_bp_b','p7_w_b','p7_p_b','p7_rp_b','p7_u_b','APPROVED','NSTC',1,now(),now()),
    ('p7_bp_c','p7_w_c','p7_p_c','p7_rp_c','p7_u_c','APPROVED','MOE_TEACHING_PRACTICE',1,now(),now());`);
  const bpPayload = JSON.stringify({ research_identity: { primaryRoute: "JOURNAL" }, questions: [{ question: "測試 RQ" }] });
  await q(`INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES
    ('p7_bpv_a','p7_w_a','p7_p_a','p7_bp_a','p7_bp_a',1,'v1','fixture',${"'" + "0".repeat(64) + "'"},$1::jsonb,'p7_u_a',now()),
    ('p7_bpv_b','p7_w_b','p7_p_b','p7_bp_b','p7_bp_b',1,'v1','fixture',${"'" + "1".repeat(64) + "'"},$2::jsonb,'p7_u_b',now()),
    ('p7_bpv_c','p7_w_c','p7_p_c','p7_bp_c','p7_bp_c',1,'v1','fixture',${"'" + "2".repeat(64) + "'"},$3::jsonb,'p7_u_c',now());`, [bpPayload, bpPayload.replace("JOURNAL", "NSTC"), bpPayload.replace("JOURNAL", "MOE_TEACHING_PRACTICE")]);

  const tenantA = { userId: "p7_u_a", workspaceId: "p7_w_a", projectId: "p7_p_a", role: "owner" };
  const tenantB = { userId: "p7_u_b", workspaceId: "p7_w_b", projectId: "p7_p_b", role: "owner" };
  const tenantC = { userId: "p7_u_c", workspaceId: "p7_w_c", projectId: "p7_p_c", role: "owner" };

  // ---------- TEST 01：JOURNAL_RESEARCH_PLAN_APPROVED → 解鎖 Research Ethics Center ----------
  try {
    await q(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ('p7_gate_journal','p7_w_a','p7_p_a','p7_u_a','JOURNAL_RESEARCH_PLAN_RELEASE','route_workspace','p7_bpv_a','${h64("journal")}','APPROVED','p7_u_a',now(),now(),now());`);
    const ethics = await getEthicsCenter(tenantA, { userId: tenantA.userId });
    assert.equal(ethics.locked, false, "JOURNAL 路線應解鎖倫理中心");
    assert.equal(ethics.assessment.status, "NOT_STARTED");
    assert.equal(ethics.scopeItems.length, 25);
    assert.equal(ethics.riskItems.length, 15);
    assert.equal(ethics.documents.length, 20);
    pass("TEST_01_JOURNAL_ETHICS_UNLOCKED", "25 scope / 15 risk / 20 documents");
  } catch (e) { fail("TEST_01_JOURNAL_ETHICS_UNLOCKED", e); }

  // ---------- TEST 02：NSTC_PROPOSAL_DRAFT_COMPLETE → 解鎖 Reviewer 與 Compliance ----------
  try {
    await q(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ('p7_gate_nstc','p7_w_b','p7_p_b','p7_u_b','NSTC_PROPOSAL_DRAFT_RELEASE','route_workspace','p7_bpv_b','${h64("nstc")}','APPROVED','p7_u_b',now(),now(),now());`);
    const rc = await getReviewCompliance(tenantB, { userId: tenantB.userId, route: "NSTC_PROPOSAL" });
    assert.equal(rc.locked, false, "NSTC 路線應解鎖審查與合規");
    assert.equal(rc.reviewerTypes.length, 3);
    pass("TEST_02_NSTC_REVIEW_COMPLIANCE_UNLOCKED", "3 reviewer perspectives");
  } catch (e) { fail("TEST_02_NSTC_REVIEW_COMPLIANCE_UNLOCKED", e); }

  // ---------- TEST 03：MOE_TPR_PROPOSAL_DRAFT_COMPLETE → 解鎖 ----------
  try {
    await q(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ('p7_gate_moe','p7_w_c','p7_p_c','p7_u_c','MOE_TPR_PROPOSAL_DRAFT_RELEASE','route_workspace','p7_bpv_c','${h64("moe")}','APPROVED','p7_u_c',now(),now(),now());`);
    const rc = await getReviewCompliance(tenantC, { userId: tenantC.userId, route: "MOE_TPR_PROPOSAL" });
    assert.equal(rc.locked, false, "MOE 路線應解鎖審查與合規");
    assert.equal(rc.reviewerTypes.length, 3);
    pass("TEST_03_MOE_REVIEW_COMPLIANCE_UNLOCKED");
  } catch (e) { fail("TEST_03_MOE_REVIEW_COMPLIANCE_UNLOCKED", e); }

  // ---------- TEST 04：需要 IRB 但無正式核准紀錄 → 不得顯示 APPROVED ----------
  try {
    // 全部 NO（非人體研究）但嘗試直接標文件 APPROVED：應被拒絕
    await saveEthicsScopeItems(tenantA, { userId: tenantA.userId, items: [{ itemKey: "human_participants", answer: "NO" }, { itemKey: "identifiable_data", answer: "NO" }] });
    let rejected = false;
    try { await saveEthicsDocument(tenantA, { userId: tenantA.userId, documentType: "INFORMED_CONSENT", content: "測試內容", status: "APPROVED" }); } catch { rejected = true; }
    assert.equal(rejected, true, "無正式機構判定時不得標記 APPROVED");
    // 機構判定 APPROVED 但缺核對／核准號碼 → 拒絕
    const decision = await saveInstitutionalEthicsDecision(tenantA, { userId: tenantA.userId, decision: { institution: "測試機構", decisionType: "FULL_REVIEW", approvalStatus: "APPROVED", verifiedByUser: false } });
    assert.equal(decision.ok, false);
    pass("TEST_04_APPROVED_REQUIRES_OFFICIAL_RECORD");
  } catch (e) { fail("TEST_04_APPROVED_REQUIRES_OFFICIAL_RECORD", e); }

  // ---------- TEST 05：系統判斷可能豁免 → 顯示 INSTITUTIONAL_CONFIRMATION_REQUIRED ----------
  try {
    const allNo = [
      { itemKey: "human_participants", answer: "NO" }, { itemKey: "identifiable_data", answer: "YES" }, { itemKey: "students", answer: "NO" },
      { itemKey: "employees_subordinates", answer: "NO" }, { itemKey: "minors", answer: "NO" }, { itemKey: "vulnerable_groups", answer: "NO" },
      { itemKey: "health_data", answer: "NO" }, { itemKey: "psychological_stress", answer: "NO" }, { itemKey: "audio_recording", answer: "NO" },
      { itemKey: "video_recording", answer: "NO" }, { itemKey: "facial_recognition", answer: "NO" }, { itemKey: "eye_tracking", answer: "NO" },
      { itemKey: "wearable_sensors", answer: "NO" }, { itemKey: "location_tracking", answer: "NO" }, { itemKey: "lms_records", answer: "NO" },
      { itemKey: "social_network_data", answer: "NO" }, { itemKey: "secondary_data", answer: "NO" }, { itemKey: "public_data", answer: "NO" },
      { itemKey: "web_scraping", answer: "NO" }, { itemKey: "ai_training_data", answer: "YES" }, { itemKey: "cross_border_transfer", answer: "NO" },
      { itemKey: "third_party_cloud", answer: "NO" }, { itemKey: "conflict_of_interest", answer: "NO" }, { itemKey: "compensation", answer: "NO" },
      { itemKey: "adverse_events", answer: "NO" },
    ];
    await saveEthicsScopeItems(tenantA, { userId: tenantA.userId, items: allNo });
    const screening = await runEthicsScreening(tenantA, { userId: tenantA.userId });
    assert.equal(screening.judgment, "INSTITUTIONAL_CONFIRMATION_REQUIRED", "可能豁免必須顯示機構確認要求");
    pass("TEST_05_EXEMPTION_REQUIRES_INSTITUTIONAL_CONFIRMATION");
  } catch (e) { fail("TEST_05_EXEMPTION_REQUIRES_INSTITUTIONAL_CONFIRMATION", e); }

  // ---------- TEST 06：研究對象為本人學生 → TEACHER_STUDENT_POWER_RISK ----------
  try {
    await saveEthicsScopeItems(tenantA, { userId: tenantA.userId, items: [{ itemKey: "students", answer: "YES" }] });
    const screening = await runEthicsScreening(tenantA, { userId: tenantA.userId });
    assert.equal(screening.teacherPowerStatus, "TEACHER_STUDENT_POWER_RISK");
    assert.equal(screening.teacherPowerSeverity, "MAJOR");
    pass("TEST_06_TEACHER_STUDENT_POWER_RISK");
  } catch (e) { fail("TEST_06_TEACHER_STUDENT_POWER_RISK", e); }

  // ---------- TEST 06b：11 項師生權力檢查全部 YES → 解除風險；任一 NO → 仍為風險 ----------
  try {
    const { saveTeacherPowerAnswers } = await import("../lib/research-ethics-repository.ts");
    const allYes = ["non_teaching_recruiter", "free_refusal", "no_grade_impact", "data_grade_separation", "blind_after_grades", "alternative_activity", "no_undue_incentive", "teacher_not_see_refusers", "deidentification", "withdrawal_process", "course_research_separation"].map((key) => ({ key, answer: "YES" }));
    const cleared = await saveTeacherPowerAnswers(tenantA, { userId: tenantA.userId, items: allYes });
    assert.equal(cleared.teacherPowerStatus, "CLEARED");
    const withNo = await saveTeacherPowerAnswers(tenantA, { userId: tenantA.userId, items: [...allYes.slice(0, 10), { key: "course_research_separation", answer: "NO" }] });
    assert.equal(withNo.teacherPowerStatus, "TEACHER_STUDENT_POWER_RISK");
    pass("TEST_06B_TEACHER_POWER_CHECKLIST");
  } catch (e) { fail("TEST_06B_TEACHER_POWER_CHECKLIST", e); }

  // ---------- TEST 07：預註冊無正式 URL/ID → 不得 REGISTERED ----------
  try {
    await savePreregistration(tenantA, { userId: tenantA.userId, fields: { primaryOutcome: "測試主要結果", platformCandidate: "OSF" } });
    let rejected = false;
    try { await registerPreregistration(tenantA, { userId: tenantA.userId, registrationUrl: "not-a-url" }); } catch { rejected = true; }
    assert.equal(rejected, true, "非 URL 不得註冊");
    const ethics = await getEthicsCenter(tenantA, { userId: tenantA.userId });
    assert.notEqual(ethics.preregistration.status, "REGISTERED");
    pass("TEST_07_PREREGISTRATION_REQUIRES_REAL_URL");
  } catch (e) { fail("TEST_07_PREREGISTRATION_REQUIRES_REAL_URL", e); }

  // ---------- TEST 08：國科會新年度規則尚未公告 → PENDING_NEW_ANNOUNCEMENT ----------
  try {
    const compliance = await runComplianceCheck(tenantB, { userId: tenantB.userId, route: "NSTC_PROPOSAL", targetYear: 2026 });
    assert.ok(compliance.items.length >= 25, "NSTC 合規矩陣應建立");
    const pending = compliance.items.filter((i) => i.verificationStatus === "PENDING_NEW_ANNOUNCEMENT");
    assert.ok(pending.length > 0, "無官方快照時應為 PENDING_NEW_ANNOUNCEMENT");
    assert.ok(compliance.items.every((i) => i.currentStatus === "AWAITING_OFFICIAL_RULE"), "無官方規則時項目應為 AWAITING_OFFICIAL_RULE");
    pass("TEST_08_PENDING_NEW_ANNOUNCEMENT", `${pending.length}/${compliance.items.length} items`);
  } catch (e) { fail("TEST_08_PENDING_NEW_ANNOUNCEMENT", e); }

  // ---------- TEST 09：MOE Eligibility Fatal FAIL → ELIGIBILITY_BLOCKED ----------
  try {
    await saveEligibility(tenantC, { userId: tenantC.userId, items: [{ key: "own_course", status: "FAIL", evidence: "本學期未開課" }, { key: "pi_qualification", status: "PASS" }] });
    const blocked = await approveComplianceGate(tenantC, { userId: tenantC.userId, gateType: "MOE_TPR_ELIGIBILITY_PASSED" });
    assert.equal(blocked.ok, false, "Fatal FAIL 時 Eligibility Gate 必須阻斷");
    assert.match(String(blocked.error ?? ""), /ELIGIBILITY_BLOCKED/);
    pass("TEST_09_ELIGIBILITY_FATAL_BLOCKED");
  } catch (e) { fail("TEST_09_ELIGIBILITY_FATAL_BLOCKED", e); }

  // ---------- TEST 10：Reviewer 發現 Gap 證據不足 → 可導向文獻中心（SIMULATED） ----------
  try {
    const review = await runReviewerSimulation(tenantB, { userId: tenantB.userId, route: "NSTC_PROPOSAL", reviewerType: "DISCIPLINE_EXPERT", ai: false });
    assert.equal(review.ok, true);
    assert.equal(review.simulated, true);
    const finding = review.findings.find((f) => f.severity === "MAJOR" || f.severity === "FATAL");
    assert.ok(finding, "規則式審查應產生具體發現");
    assert.match(finding.evidence, /SIMULATED REVIEW/);
    assert.ok(finding.sectionId.length > 0, "發現應帶 section_id（可導向文獻與證據中心）");
    pass("TEST_10_REVIEWER_GAP_EVIDENCE_SIMULATED", `severity=${finding.severity} section=${finding.sectionId}`);
  } catch (e) { fail("TEST_10_REVIEWER_GAP_EVIDENCE_SIMULATED", e); }

  // ---------- TEST 11：Compliance FATAL Missing → Package 不得 Ready ----------
  try {
    // 將一個 FATAL 項目標為 MISSING
    const compliance = await runComplianceCheck(tenantB, { userId: tenantB.userId, route: "NSTC_PROPOSAL", targetYear: 2026 });
    const fatalItem = compliance.items.find((i) => i.severity === "FATAL");
    assert.ok(fatalItem, "應有 FATAL 合規項目");
    await updateComplianceItem(tenantB, { userId: tenantB.userId, itemId: fatalItem.id, currentStatus: "MISSING" });
    const gate = await approveComplianceGate(tenantB, { userId: tenantB.userId, gateType: "NSTC_COMPLIANCE_PASSED" });
    assert.equal(gate.ok, false, "FATAL MISSING 時合規 Gate 必須阻斷");
    const pkg = await approvePackageGate(tenantB, { userId: tenantB.userId, route: "NSTC_PROPOSAL" });
    assert.equal(pkg.ok, false, "FATAL MISSING 時申請包不得 Ready");
    pass("TEST_11_FATAL_COMPLIANCE_BLOCKS_PACKAGE");
  } catch (e) { fail("TEST_11_FATAL_COMPLIANCE_BLOCKS_PACKAGE", e); }

  // ---------- TEST 12：使用者未記錄正式送件 → Submission 保持 NOT_READY ----------
  try {
    const pkg = await getApplicationPackage(tenantC, { userId: tenantC.userId, route: "MOE_TPR_PROPOSAL" });
    assert.equal(pkg.locked, false);
    assert.equal(pkg.submission, null, "未記錄送件時不得自動出現送件狀態");
    pass("TEST_12_SUBMISSION_NOT_AUTO_MARKED");
  } catch (e) { fail("TEST_12_SUBMISSION_NOT_AUTO_MARKED", e); }

  // ---------- TEST 13：Research Design 修改 → Ethics Assessment 標示 OUTDATED ----------
  try {
    await q(`INSERT INTO research_design_analyses (id,workspace_id,project_id,research_project_id,created_by_user_id,source_blueprint_version,status,current_version_number,created_at,updated_at)
      VALUES ('p7_design_a','p7_w_a','p7_p_a','p7_rp_a','p7_u_a',1,'APPROVED',1,now(),now());`);
    const payloadV1 = JSON.stringify({ designType: "RCT", study_arms: [{ name: "A" }] });
    const payloadV2 = JSON.stringify({ designType: "QUASI_EXPERIMENT", study_arms: [{ name: "B" }, { name: "C" }] });
    await q(`INSERT INTO research_design_versions (id,workspace_id,project_id,analysis_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ('p7_dv_a1','p7_w_a','p7_p_a','p7_design_a','p7_design_a',1,'v1','fixture',${"'" + "a".repeat(64) + "'"},$1::jsonb,'p7_u_a',now());`, [payloadV1]);
    await q(`INSERT INTO research_design_versions (id,workspace_id,project_id,analysis_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ('p7_dv_a2','p7_w_a','p7_p_a','p7_design_a','p7_design_a',2,'v2','design change',${"'" + "b".repeat(64) + "'"},$1::jsonb,'p7_u_a',now());`, [payloadV2]);
    await q(`UPDATE research_design_analyses SET current_version_number=2 WHERE id='p7_design_a';`);
    const ethics = await getEthicsCenter(tenantA, { userId: tenantA.userId });
    assert.equal(ethics.assessment.status, "OUTDATED", "設計變更後倫理評估應標示 OUTDATED");
    pass("TEST_13_DESIGN_CHANGE_MARKS_OUTDATED");
  } catch (e) { fail("TEST_13_DESIGN_CHANGE_MARKS_OUTDATED", e); }

  // ---------- TEST 14：計畫修訂 → 原版本保持不變，建立新版本（append-only） ----------
  try {
    await savePreregistration(tenantA, { userId: tenantA.userId, fields: { primaryOutcome: "第二版主要結果" } });
    const versions = await q(`SELECT count(*)::int AS "count" FROM preregistration_versions WHERE workspace_id='p7_w_a' AND project_id='p7_p_a'`);
    assert.ok(versions.rows[0].count >= 2, "每次修訂應新增版本，原版本保留");
    const v1 = await q(`SELECT payload FROM preregistration_versions WHERE workspace_id='p7_w_a' AND project_id='p7_p_a' AND version_number=1`);
    assert.ok(v1.rows[0], "原始版本不得被覆蓋");
    pass("TEST_14_AMENDMENT_APPEND_ONLY", `versions=${versions.rows[0].count}`);
  } catch (e) { fail("TEST_14_AMENDMENT_APPEND_ONLY", e); }

  retained = 0;
  const failed = run.filter((r) => !r.ok);
  console.log("PHASE7_CONTRACT_TESTS=" + (failed.length === 0 ? "ALL_PASS" : `${failed.length}_FAILED`));
  console.log(`PHASE7_TEST_COUNT=${run.length}`);
  process.exitCode = failed.length === 0 ? 0 : 1;
} finally {
  await client.end().catch(() => undefined);
  console.log(`DISPOSABLE_RETAINED_ROWS=${retained}`);
}
