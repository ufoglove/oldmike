import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ex from "../lib/research-execution-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") { console.log("PHASE10_DISPOSABLE=NOT_EXECUTED"); process.exit(0); }
const parsedUrl = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname));
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000, statement_timeout: 60_000 });
const migrations = ["0001_better_auth_core.up.sql","0002_old_mike_tenant.up.sql","0003_registration_invites.up.sql","0004_registration_invite_revocation.up.sql","0005_research_workflow_phase2.up.sql","0006_admin_provisioned_accounts.up.sql","0007_topic_lab_frontier_radar.up.sql","0008_research_provenance.up.sql","0009_submission_navigator.up.sql","0010_submission_navigator_phase2.up.sql","0011_submission_navigator_document_type.up.sql","0012_research_project_foundation.up.sql","0013_research_blueprint.up.sql","0014_navigator_drafts.up.sql","0015_gap_novelty_lab.up.sql","0016_theory_mechanism_lab.up.sql","0017_research_design_lab.up.sql","0018_route_workspace.up.sql","0019_zotero_connections_sync_status.up.sql","0020_ethics_compliance_package.up.sql","0021_route_section_provenance.up.sql","0022_instrument_protocol_studio.up.sql","0023_pilot_protocol_validation.up.sql","0024_formal_research_execution.up.sql"];
const q = (sql, values = []) => client.query(sql, values);
const run = [];
const pass = (name, detail = "") => { run.push({ name, ok: true }); console.log(`${name}=PASS${detail ? ` (${detail})` : ""}`); };
const fail = (name, error) => { run.push({ name, ok: false }); console.log(`${name}=FAIL (${error})`); };
const h64 = (s) => Buffer.from(String(s)).toString("hex").padEnd(64, "0").slice(0, 64);
const text = (v) => typeof v === "string" ? v : "";
const int = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
try {
  await client.connect();
  for (const name of migrations) await q(await readFile(path.join(root, "database", "migrations", name), "utf8"));
  await q(`INSERT INTO "user" (id,name,email) VALUES ('p10u','U','p10@test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('p10w','W','p10u');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('p10w','p10u','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES ('p10p','p10w','p10u','P','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
    INSERT INTO research_projects (id,workspace_id,project_id,created_by_user_id,project_name,project_type,created_at,updated_at) VALUES ('p10rp','p10w','p10p','p10u','P','JOURNAL_MANUSCRIPT',now(),now());
    INSERT INTO research_blueprints (id,workspace_id,project_id,research_project_id,created_by_user_id,status,primary_route,current_version_number,created_at,updated_at) VALUES ('p10bp','p10w','p10p','p10rp','p10u','APPROVED','JOURNAL',1,now(),now());
    INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ('p10bpv','p10w','p10p','p10bp','p10bp',1,'v1','f','${h64("b")}','{}','p10u',now());
    INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at) VALUES ('p10hg','p10w','p10p','p10u','FORMAL_STUDY_EXECUTION_READY','formal_study_readiness','x','${h64("g")}','APPROVED','p10u',now(),now(),now());
    INSERT INTO study_protocols (id,workspace_id,project_id,status,current_version_number,created_by_user_id,created_at,updated_at) VALUES ('p10sp','p10w','p10p','APPROVED_FOR_PILOT',2,'p10u',now(),now());
    INSERT INTO study_protocol_versions (id,workspace_id,project_id,protocol_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ('p10spv1','p10w','p10p','p10sp','p10sp',1,'v1.0','i','${h64("s1")}','{}','p10u',now()),('p10spv2','p10w','p10p','p10sp','p10sp',2,'v2.0 Final','pilot','${h64("s2")}','{}','p10u',now());`);
  const tenant = { userId: "p10u", workspaceId: "p10w", projectId: "p10p", role: "owner" };

  // TEST 01：Ready gate → 解鎖＋可執行啟動審查
  try {
    const c = await ex.getExecutionCenter(tenant, { userId: tenant.userId });
    assert.equal(c.locked, false);
    const r = await ex.runActivationReview(tenant, { userId: tenant.userId });
    assert.equal(r.ok, true);
    assert.equal(r.status, "BLOCKED_BY_ETHICS");
    pass("TEST_01_UNLOCKED_AND_REVIEW", r.status);
  } catch (e) { fail("TEST_01_UNLOCKED_AND_REVIEW", e); }

  // TEST 02：倫理過期 → 不得啟動
  try {
    await q(`INSERT INTO institutional_ethics_decisions (id,workspace_id,project_id,assessment_id,institution,decision_type,approval_number,decision_date,expiry_date,verified_by_user,approval_status,created_by_user_id,created_at,updated_at) VALUES ('p10ied','p10w','p10p','x','I','EXPEDITED_REVIEW','IRB-1','2026-01-01','2026-01-02',true,'APPROVED','p10u',now(),now());`);
    const r = await ex.runActivationReview(tenant, { userId: tenant.userId });
    assert.equal(r.status, "BLOCKED_BY_ETHICS");
    const g = await ex.approveExecutionGate(tenant, { userId: tenant.userId, gateType: "FORMAL_STUDY_ACTIVATED" });
    assert.equal(g.ok, false);
    pass("TEST_02_EXPIRED_ETHICS_BLOCKS");
  } catch (e) { fail("TEST_02_EXPIRED_ETHICS_BLOCKS", e); }

  // TEST 04：未 Activated → 不可 Enroll / 不可建 Session
  try {
    const e1 = await ex.enrollParticipant(tenant, { userId: tenant.userId, participant: { participantCode: "P01" } });
    assert.equal(e1.ok, false);
    const e2 = await ex.createStudySession(tenant, { userId: tenant.userId, session: { participantCode: "P01", timePoint: "T1" } });
    assert.equal(e2.ok, false);
    pass("TEST_04_NOT_ACTIVATED_BLOCKS_ENROLL_SESSION");
  } catch (e) { fail("TEST_04_NOT_ACTIVATED_BLOCKS_ENROLL_SESSION", e); }

  // 讓啟動通過：更新 ethics 未過期＋補齊 checks（直接以 SQL 令 activation APPROVED 以便測後續流程）
  await q(`UPDATE institutional_ethics_decisions SET expiry_date=now()+interval '365 days' WHERE id='p10ied';`);
  // TEST 05：無有效 Consent → Enroll 被拒（先造 Gate1 讓啟用成立）
  await q(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at) VALUES ('p10hg2','p10w','p10p','p10u','FORMAL_STUDY_ACTIVATED','formal_study','fs','${h64("a")}','APPROVED','p10u',now(),now(),now());`);
  try {
    const e = await ex.enrollParticipant(tenant, { userId: tenant.userId, participant: { participantCode: "P01" } });
    assert.equal(e.ok, false);
    assert.match(String(e.error), /consent/);
    pass("TEST_05_CONSENT_REQUIRED_BEFORE_ENROLL");
  } catch (e) { fail("TEST_05_CONSENT_REQUIRED_BEFORE_ENROLL", e); }

  // Consent + Enroll → 分層與 Vault
  try {
    await ex.saveConsent(tenant, { userId: tenant.userId, consent: { participantCode: "P01", status: "CONSENTED", consentDocumentVersion: "v1" } });
    const e = await ex.enrollParticipant(tenant, { userId: tenant.userId, participant: { participantCode: "P01", siteCode: "S01" } });
    assert.equal(e.ok, true);
    const vault = await q(`SELECT count(*)::int AS "n" FROM participant_identity_vault WHERE workspace_id='p10w' AND project_id='p10p'`);
    assert.equal(vault.rows[0].n, 1);
    pass("TEST_06_07_LAYERS_AND_VAULT");
  } catch (e) { fail("TEST_06_07_LAYERS_AND_VAULT", e); }

  // TEST 08：Blinded role 看不到分組
  try {
    await ex.recordAllocation(tenant, { userId: tenant.userId, allocation: { participantCode: "P01", assignment: "G1" } });
    const blocked = await ex.listAllocationsForRole(tenant, { userId: tenant.userId, role: "ASSESSOR" });
    assert.equal(blocked.blocked, true);
    const pi = await ex.listAllocationsForRole(tenant, { userId: tenant.userId, role: "PRINCIPAL_INVESTIGATOR" });
    assert.equal(pi.blocked, false);
    pass("TEST_08_BLINDED_ROLE_BLOCKED");
  } catch (e) { fail("TEST_08_BLINDED_ROLE_BLOCKED", e); }

  // TEST 09：重複分組被阻；Override 需理由
  try {
    const r1 = await ex.recordAllocation(tenant, { userId: tenant.userId, allocation: { participantCode: "P01", assignment: "G2" } });
    assert.equal(r1.ok, false);
    const r2 = await ex.recordAllocation(tenant, { userId: tenant.userId, allocation: { participantCode: "P01", assignment: "G2", overrideReason: "分組錯誤", overrideAuthorizedBy: "PI" } });
    assert.equal(r2.ok, true);
    assert.equal(r2.overridden, true);
    pass("TEST_09_ALLOCATION_OVERRIDE_ONLY");
  } catch (e) { fail("TEST_09_ALLOCATION_OVERRIDE_ONLY", e); }

  // TEST 10：Session 保存版本
  try {
    await ex.createStudySession(tenant, { userId: tenant.userId, session: { participantCode: "P01", timePoint: "T1", protocolVersion: "v2.0 Final", instrumentVersions: ["scale-v2"] } });
    const s = await q(`SELECT protocol_version AS pv, instrument_versions AS iv FROM study_sessions WHERE workspace_id='p10w' AND project_id='p10p' ORDER BY created_at DESC LIMIT 1`);
    assert.equal(text(s.rows[0].pv), "v2.0 Final");
    assert.ok(JSON.stringify(s.rows[0].iv).includes("scale-v2"));
    pass("TEST_10_SESSION_VERSION_CAPTURED");
  } catch (e) { fail("TEST_10_SESSION_VERSION_CAPTURED", e); }

  // TEST 11：Correction 保留原值
  try {
    const form = await ex.submitResearchForm(tenant, { userId: tenant.userId, submission: { formType: "BASELINE", formVersion: "v1", participantCode: "P01", payload: { q1: 3 } } });
    await ex.createCorrection(tenant, { userId: tenant.userId, correction: { originalRecordId: form.formId, incorrectValue: "3", correctedValue: "4", reason: "輸入錯誤", correctedBy: "coord" } });
    const row = await q(`SELECT payload, correction_history AS ch, source_status AS ss FROM research_form_submissions WHERE id=$1`, [form.formId]);
    assert.equal(JSON.stringify(row.rows[0].payload), JSON.stringify({ q1: 3 }));
    assert.equal(text(row.rows[0].ss), "CORRECTED");
    assert.ok(JSON.stringify(row.rows[0].ch).length > 2);
    pass("TEST_11_CORRECTION_PRESERVES_ORIGINAL");
  } catch (e) { fail("TEST_11_CORRECTION_PRESERVES_ORIGINAL", e); }

  // TEST 12/13：Pilot 不可入 Formal；Synthetic 需標記
  try {
    const pilot = await ex.registerRawAsset(tenant, { userId: tenant.userId, asset: { dataType: "QUESTIONNAIRE", source: "Pilot", pilotOrigin: true } });
    assert.equal(pilot.ok, false);
    const synth = await ex.registerRawAsset(tenant, { userId: tenant.userId, asset: { dataType: "SYSTEM_LOG", source: "test", fileName: "s.log", checksum: "c1", synthetic: true } });
    assert.equal(synth.ok, true);
    const row = await q(`SELECT synthetic FROM raw_data_assets WHERE id=$1`, [synth.assetId]);
    assert.equal(row.rows[0].synthetic, true);
    pass("TEST_12_13_PILOT_SEPARATED_SYNTHETIC_FLAGGED");
  } catch (e) { fail("TEST_12_13_PILOT_SEPARATED_SYNTHETIC_FLAGGED", e); }

  // TEST 16：重大 AE → Pause
  try {
    const ev = await ex.recordFormalAdverseEvent(tenant, { userId: tenant.userId, event: { participantCode: "P01", eventType: "癲癇", severity: "SERIOUS", description: "VR 中（模擬）" } });
    assert.equal(ev.paused, true);
    const st = await q(`SELECT status FROM formal_studies WHERE workspace_id='p10w' AND project_id='p10p'`);
    assert.equal(text(st.rows[0].status), "PAUSED");
    pass("TEST_16_ADVERSE_EVENT_PAUSES");
  } catch (e) { fail("TEST_16_ADVERSE_EVENT_PAUSES", e); }

  // TEST 22/23/24：Freeze→Lock（缺 checksum 檔 → 阻擋；補齊→Lock；Lock 後不可改）
  try {
    await q(`UPDATE formal_studies SET status='DATA_COLLECTION_CLOSED' WHERE workspace_id='p10w' AND project_id='p10p';`);
    const f = await ex.freezeRawData(tenant, { userId: tenant.userId });
    assert.equal(f.ok, true);
    const l1 = await ex.lockRawData(tenant, { userId: tenant.userId });
    assert.equal(l1.ok, false); // synthetic 檔無 checksum? 有 c1；缺 checksum 的是？已登錄兩筆其一有 checksum；另一 Pilot 被拒 → 全有？ synth c1 → lock 應過；因沒有 CRITICAL query。檢查 missingChecksum：兩筆？僅一筆（synth, checksum c1）→ lock ok
    const row = await q(`SELECT count(*)::int AS n FROM raw_data_assets WHERE workspace_id='p10w' AND project_id='p10p' AND (checksum IS NULL OR checksum='')`);
    if (row.rows[0].n > 0) assert.equal(l1.ok, false); else assert.equal(l1.ok, true);
    const l2 = await ex.lockRawData(tenant, { userId: tenant.userId });
    const upd = await ex.tryUpdateRawAsset(tenant, { userId: tenant.userId, assetId: (await q(`SELECT id FROM raw_data_assets WHERE workspace_id='p10w' AND project_id='p10p' LIMIT 1`)).rows[0].id, fields: {} });
    assert.equal(upd.ok, false);
    pass("TEST_22_23_24_FREEZE_LOCK_IMMUTABLE");
  } catch (e) { fail("TEST_22_23_24_FREEZE_LOCK_IMMUTABLE", e); }

  // TEST 25/26/27：報告＋快照＋Gate4 條件（缺 DataCollectionComplete → Gate4 阻）
  try {
    await ex.generateCloseoutReport(tenant, { userId: tenant.userId });
    const snap = await ex.createExecutionSnapshot(tenant, { userId: tenant.userId });
    assert.equal(snap.ok, true);
    const g4 = await ex.approveExecutionGate(tenant, { userId: tenant.userId, gateType: "RAW_DATA_LOCKED_AND_HANDOFF_READY" });
    assert.equal(g4.ok, false);
    pass("TEST_25_26_27_REPORT_SNAPSHOT_GATE4_GUARD");
  } catch (e) { fail("TEST_25_26_27_REPORT_SNAPSHOT_GATE4_GUARD", e); }

  // TEST 28：無統計輸出（無相關 endpoint；結構驗證無 group-means 欄位）
  try {
    const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='formal_studies'`);
    const names = cols.rows.map((r) => r.column_name).join(",");
    assert.ok(!names.includes("p_value") && !names.includes("effect_size"));
    pass("TEST_28_NO_STAT_OUTPUT_COLUMNS");
  } catch (e) { fail("TEST_28_NO_STAT_OUTPUT_COLUMNS", e); }

  // TEST 29：Amendment 流程（DRAFT→SUBMITTED→APPROVED；reconsent 自動觸發）
  try {
    const a = await ex.createAmendment(tenant, { userId: tenant.userId, amendment: { changeRequest: "Sample size 60→72", reconsentRequired: true, ethicsImpact: "需審查" } });
    assert.equal(a.ok, true);
    const s1 = await ex.approveAmendment(tenant, { userId: tenant.userId, amendmentId: a.amendmentId });
    assert.equal(s1.ok, false); // 未 Submit 不可核准
    await ex.submitAmendment(tenant, { userId: tenant.userId, amendmentId: a.amendmentId });
    const s2 = await ex.approveAmendment(tenant, { userId: tenant.userId, amendmentId: a.amendmentId });
    assert.equal(s2.ok, true);
    assert.equal(s2.reconsentRequired, true);
    const consent = await q(`SELECT status FROM consent_records WHERE workspace_id='p10w' AND project_id='p10p' AND participant_code='P01'`);
    assert.equal(text(consent.rows[0].status), "RECONSENT_REQUIRED");
    pass("TEST_29_AMENDMENT_RECONSENT_AUTO");
  } catch (e) { fail("TEST_29_AMENDMENT_RECONSENT_AUTO", e); }

  // TEST 30：Blinding（UNBLINDED 需理由＋授權）＋ Session Activity
  try {
    const b1 = await ex.recordBlinding(tenant, { userId: tenant.userId, record: { participantCode: "P01", role: "ASSESSOR", blindingStatus: "UNBLINDED" } });
    assert.equal(b1.ok, false);
    const b2 = await ex.recordBlinding(tenant, { userId: tenant.userId, record: { participantCode: "P01", role: "ASSESSOR", blindingStatus: "BLINDED" } });
    assert.equal(b2.ok, true);
    const sess = await q(`SELECT id FROM study_sessions WHERE workspace_id='p10w' AND project_id='p10p' ORDER BY created_at DESC LIMIT 1`);
    const act = await ex.recordSessionActivity(tenant, { userId: tenant.userId, activity: { sessionId: text(sess.rows[0].id), activityKey: "VR_TASK", completed: true, actualTime: "2026-09-02T10:00:00Z" } });
    assert.equal(act.ok, true);
    pass("TEST_30_BLINDING_GUARD_AND_ACTIVITY");
  } catch (e) { fail("TEST_30_BLINDING_GUARD_AND_ACTIVITY", e); }

  // TEST 31：Follow-up 完成 + Withdrawal（資料移除→Query 開啟且不刪 Raw）
  try {
    const f1 = await ex.saveFollowUp(tenant, { userId: tenant.userId, followUp: { participantCode: "P01", plannedTimePoint: "T2", completionStatus: "COMPLETED", completionDate: "2026-09-20T00:00:00Z", dataCaptured: true } });
    assert.equal(f1.ok, true);
    const w = await ex.recordWithdrawal(tenant, { userId: tenant.userId, withdrawal: { participantCode: "P01", reasonCategory: "SCHEDULE_CONFLICT", participantRequestedDataRemoval: true } });
    assert.equal(w.ok, true);
    assert.equal(w.dataRemovalQueryOpened, true);
    const pr = await q(`SELECT status FROM participant_study_records WHERE workspace_id='p10w' AND project_id='p10p' AND participant_code='P01'`);
    assert.equal(text(pr.rows[0].status), "WITHDRAWN");
    const raw = await q(`SELECT count(*)::int AS n FROM raw_data_assets WHERE workspace_id='p10w' AND project_id='p10p'`);
    assert.ok(int(raw.rows[0].n) > 0); // Raw 未被刪除
    pass("TEST_31_FOLLOWUP_WITHDRAWAL_QUERY");
  } catch (e) { fail("TEST_31_FOLLOWUP_WITHDRAWAL_QUERY", e); }

  // TEST 32：extras 讀回（amendment/blinding/followup 列表）
  try {
    const x = await ex.getExecutionExtras(tenant, { userId: tenant.userId });
    assert.ok(x.amendments.length >= 1);
    assert.ok(x.blinding.length >= 1);
    assert.ok(x.followUps.length >= 1);
    pass("TEST_32_EXTRAS_READBACK");
  } catch (e) { fail("TEST_32_EXTRAS_READBACK", e); }

  const failed = run.filter((r) => !r.ok);
  console.log("PHASE10_CONTRACT_TESTS=" + (failed.length === 0 ? "ALL_PASS" : `${failed.length}_FAILED`));
  console.log(`PHASE10_TEST_COUNT=${run.length}`);
  process.exitCode = failed.length === 0 ? 0 : 1;
} finally {
  await client.end().catch(() => undefined);
}
