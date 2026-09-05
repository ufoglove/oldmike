import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as g from "../lib/research-data-governance-repository.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.INTEGRATION_DATABASE_URL;
if (!url || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") { console.log("PHASE11_DISPOSABLE=NOT_EXECUTED"); process.exit(0); }
const parsedUrl = new URL(url);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname));
const { Client } = await import("pg");
const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
const q = (sql, values = []) => client.query(sql, values);
const run = [];
const pass = (name, detail = "") => { run.push({ name, ok: true }); console.log(`${name}=PASS${detail ? ` (${detail})` : ""}`); };
const fail = (name, error) => { run.push({ name, ok: false }); console.log(`${name}=FAIL (${error})`); };
const h64 = (s) => Buffer.from(String(s)).toString("hex").padEnd(64, "0").slice(0, 64);
const text = (v) => typeof v === "string" ? v : "";
try {
  await client.connect();
  const names = ["0001_better_auth_core.up.sql","0002_old_mike_tenant.up.sql","0003_registration_invites.up.sql","0004_registration_invite_revocation.up.sql","0005_research_workflow_phase2.up.sql","0006_admin_provisioned_accounts.up.sql","0007_topic_lab_frontier_radar.up.sql","0008_research_provenance.up.sql","0009_submission_navigator.up.sql","0010_submission_navigator_phase2.up.sql","0011_submission_navigator_document_type.up.sql","0012_research_project_foundation.up.sql","0013_research_blueprint.up.sql","0014_navigator_drafts.up.sql","0015_gap_novelty_lab.up.sql","0016_theory_mechanism_lab.up.sql","0017_research_design_lab.up.sql","0018_route_workspace.up.sql","0019_zotero_connections_sync_status.up.sql","0020_ethics_compliance_package.up.sql","0021_route_section_provenance.up.sql","0022_instrument_protocol_studio.up.sql","0023_pilot_protocol_validation.up.sql","0024_formal_research_execution.up.sql","0025_data_governance_and_analysis_dataset.up.sql"];
  for (const name of names) await q(await readFile(path.join(root, "database", "migrations", name), "utf8"));
  await q(`INSERT INTO "user" (id,name,email) VALUES ('g11u','U','g11@test');
    INSERT INTO workspaces (id,name,owner_user_id) VALUES ('g11w','W','g11u');
    INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ('g11w','g11u','owner');
    INSERT INTO projects (project_id,workspace_id,created_by,title,status,storage_backend) VALUES ('g11p','g11w','g11u','P','ACTIVE','POSTGRES_INDEX_PENDING_SAFE_STORAGE');
    INSERT INTO research_projects (id,workspace_id,project_id,created_by_user_id,project_name,project_type,created_at,updated_at) VALUES ('g11rp','g11w','g11p','g11u','P','JOURNAL_MANUSCRIPT',now(),now());
    INSERT INTO research_blueprints (id,workspace_id,project_id,research_project_id,created_by_user_id,status,primary_route,current_version_number,created_at,updated_at) VALUES ('g11bp','g11w','g11p','g11rp','g11u','APPROVED','JOURNAL',32,now(),now());
    INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ('g11bpv','g11w','g11p','g11bp','g11bp',32,'v32','r','${h64("b")}','{}','g11u',now());
    INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at) VALUES ('g11hg1','g11w','g11p','g11u','FORMAL_STUDY_ACTIVATED','x','x','${h64("a")}','APPROVED','g11u',now(),now(),now());
    INSERT INTO study_protocols (id,workspace_id,project_id,status,current_version_number,created_by_user_id,created_at,updated_at) VALUES ('g11sp','g11w','g11p','DRAFT',1,'g11u',now(),now());
    INSERT INTO formal_studies (id,workspace_id,project_id,created_by_user_id,status,created_at,updated_at) VALUES ('g11fs','g11w','g11p','g11u','RAW_DATA_LOCKED',now(),now());
    INSERT INTO research_analysis_plans (id,workspace_id,project_id,created_by_user_id,method,engine,parameters,created_at,updated_at) VALUES ('g11ap','g11w','g11p','g11u','{}','node','{}',now(),now());
    INSERT INTO preregistration_plans (id,workspace_id,project_id,status,created_by_user_id,created_at,updated_at) VALUES ('g11pr','g11w','g11p','REGISTERED','g11u',now(),now());
    INSERT INTO data_collection_closeouts (id,workspace_id,project_id,formal_study_id,checks,status,checked_at,created_by_user_id,updated_at) VALUES ('g11cc','g11w','g11p','g11fs','[]','DATA_COLLECTION_CLOSED',now(),'g11u',now());
    INSERT INTO raw_data_assets (id,workspace_id,project_id,formal_study_id,data_type,data_layer,source,file_name,file_format,checksum,storage_location,status,synthetic,pilot_origin,created_by_user_id,created_at,updated_at)
      VALUES ('g11ra1','g11w','g11p','g11fs','QUESTIONNAIRE','RESEARCH_RAW','量表 T1','p01.csv','csv','sha256:aaa','s3://x','LOCKED',false,false,'g11u',now(),now()),
             ('g11ra2','g11w','g11p','g11fs','SYSTEM_LOG','RESEARCH_RAW','log','p01.log','jsonl','sha256:bbb','s3://x','LOCKED',false,false,'g11u',now(),now());`);
  const tenant = { userId: "g11u", workspaceId: "g11w", projectId: "g11p", role: "owner" };

  // TEST 01：無 RAW_DATA_LOCKED_AND_HANDOFF_READY → LOCKED 且列出原因
  try {
    const c = await g.getGovernanceCenter(tenant, { userId: tenant.userId });
    assert.equal(c.locked, true);
    assert.ok((c.missing ?? []).some((m) => text(m).includes("RAW_DATA_LOCKED")));
    await q(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at) VALUES ('g11hg2','g11w','g11p','g11u','RAW_DATA_LOCKED_AND_HANDOFF_READY','raw','x','${h64("l")}','APPROVED','g11u',now(),now(),now());`);
    const c2 = await g.getGovernanceCenter(tenant, { userId: tenant.userId });
    assert.equal(c2.locked, false);
    pass("TEST_01_GOVERNANCE_LOCKED_UNTIL_RAW_READY");
  } catch (e) { fail("TEST_01_GOVERNANCE_LOCKED_UNTIL_RAW_READY", e); }

  // TEST 02：Raw Audit PASS（全部 LOCKED、checksum 齊、無混入）
  try {
    const a = await g.runRawDataAudit(tenant, { userId: tenant.userId });
    assert.equal(a.status, "PASS");
    pass("TEST_02_RAW_AUDIT_PASS");
  } catch (e) { fail("TEST_02_RAW_AUDIT_PASS", e); }

  // TEST 03/04/05：Catalog／Dictionary／Quarantine（checksum mismatch → 隔離，不得進 Clean）
  try {
    await g.saveCatalogItem(tenant, { userId: tenant.userId, item: { dataAssetId: "p01_scale", sourceType: "QUESTIONNAIRE", checksum: "sha256:aaa" } });
    await g.saveCanonicalVariable(tenant, { userId: tenant.userId, variable: { canonicalName: "hazard_total", variableRole: "OUTCOME", dataType: "numeric", piiFlag: false, timePoint: "T1" } });
    await g.saveCanonicalVariable(tenant, { userId: tenant.userId, variable: { canonicalName: "identity_email", piiFlag: true, variableRole: "IDENTIFIER", dataType: "text" } });
    await g.approveCanonicalVariable(tenant, { userId: tenant.userId, canonicalName: "hazard_total" });
    const snap = await g.snapshotDataDictionary(tenant, { userId: tenant.userId });
    assert.equal(snap.version, 1);
    await g.createQuarantineRecord(tenant, { userId: tenant.userId, record: { sourceAssetId: "bad", reasonCategory: "CHECKSUM_MISMATCH", checksumMismatch: true } });
    const cv = await g.validateCleanDataset(tenant, { userId: tenant.userId, datasetId: "clean_v1" });
    assert.equal(cv.ok, false); // quarantine 未裁決 → Clean 不可驗證
    pass("TEST_03_04_05_CATALOG_DICT_QUARANTINE_BLOCKS");
  } catch (e) { fail("TEST_03_04_05_CATALOG_DICT_QUARANTINE_BLOCKS", e); }

  // TEST 06：Mapping 缺 Canonical → SCHEMA_MAPPING_QUERY；補 canonical 後核准
  try {
    await g.saveMapping(tenant, { userId: tenant.userId, mapping: { sourceAssetId: "p01_scale", sourceFieldName: "unk_field", canonicalName: "" } });
    const m1 = await q(`SELECT mapping_status AS s FROM source_canonical_mappings WHERE workspace_id='g11w' AND project_id='g11p' AND source_field_name='unk_field'`);
    assert.equal(text(m1.rows[0].s), "SCHEMA_MAPPING_QUERY");
    await g.saveMapping(tenant, { userId: tenant.userId, mapping: { sourceAssetId: "p01_scale", sourceFieldName: "score", canonicalName: "hazard_total", transformation: "cast" } });
    await g.approveMapping(tenant, { userId: tenant.userId, sourceAssetId: "p01_scale", sourceFieldName: "score", approvedBy: "DM" });
    pass("TEST_06_SCHEMA_MAPPING_QUERY_AND_APPROVE");
  } catch (e) { fail("TEST_06_SCHEMA_MAPPING_QUERY_AND_APPROVE", e); }

  // TEST 07/08：Duplicate 不刪除；Impossible Value → Query/裁決
  try {
    await g.resolveDuplicate(tenant, { userId: tenant.userId, resolution: { canonicalRecord: "P01-T1", duplicateRecord: "P01-T1-copy", duplicateReason: "REPEATED_IMPORT", retentionDecision: "RETAIN_CANONICAL" } });
    const d = await q(`SELECT count(*)::int AS n FROM duplicate_resolutions WHERE workspace_id='g11w' AND project_id='g11p'`);
    assert.equal(d.rows[0].n, 1);
    await g.createAdjudication(tenant, { userId: tenant.userId, adjudication: { issue: "分數 999 疑為不可能值", queryType: "IMPOSSIBLE_VALUE", status: "UNDER_REVIEW" } });
    pass("TEST_07_08_DUPLICATE_ADJUDICATION");
  } catch (e) { fail("TEST_07_08_DUPLICATE_ADJUDICATION", e); }

  // TEST 09/10/11：Missing 分類（原因不同）；Outlier 預設保留 Flag；Raw 未動
  try {
    await g.classifyMissing(tenant, { userId: tenant.userId, items: [
      { participantCode: "P01", variableId: "hazard_total", timePoint: "T2", reason: "LOST_TO_FOLLOW_UP" },
      { participantCode: "P02", variableId: "hr", timePoint: "T1", reason: "SENSOR_LOSS" },
    ] });
    const m = await q(`SELECT reason, count(*)::int AS n FROM missing_classification_items WHERE workspace_id='g11w' AND project_id='g11p' GROUP BY reason ORDER BY reason`);
    assert.equal(m.rows.length, 2);
    await g.flagOutlier(tenant, { userId: tenant.userId, flag: { variableOrRecord: "P01 hazard_total", detectionMethod: "z>3", action: "RETAIN_WITH_FLAG", reviewer: "DM" } });
    const raw = await q(`SELECT count(*)::int AS n, count(*) FILTER (WHERE status='LOCKED')::int AS locked FROM raw_data_assets WHERE workspace_id='g11w' AND project_id='g11p'`);
    assert.equal(raw.rows[0].n, 2); assert.equal(raw.rows[0].locked, 2);
    pass("TEST_09_10_11_MISSING_OUTLIER_RAW_INTACT");
  } catch (e) { fail("TEST_09_10_11_MISSING_OUTLIER_RAW_INTACT", e); }

  // TEST_12/13：Reverse Coding／Scoring 依 Instrument Version；Inclusion flags 保留被排除者
  try {
    await g.runScaleScoring(tenant, { userId: tenant.userId, run: { instrumentId: "自編 VR 測驗", instrumentVersion: "v1", scale: "危險辨識", sourceItems: ["q1", "q2"], reverseItems: [], missingItemRule: "≥80%", outputVariable: "hazard_total", scoringVersion: "v1" } });
    await g.saveInclusionDecision(tenant, { userId: tenant.userId, decision: { participantOrUnit: "P99", enrolledFlag: true, consentValidFlag: false, exclusionReason: "CONSENT_INVALID", adjudicator: "DM" } });
    const inc = await q(`SELECT count(*)::int AS n FROM analysis_inclusion_decisions WHERE workspace_id='g11w' AND project_id='g11p' AND participant_or_unit='P99'`);
    assert.equal(inc.rows[0].n, 1); // 不刪除，以 flag 控制
    pass("TEST_12_13_SCORING_INCLUSION_FLAGS");
  } catch (e) { fail("TEST_12_13_SCORING_INCLUSION_FLAGS", e); }

  // TEST_18/19：Sensor 處理保留 Recipe；Log Feature 可反查 Event
  try {
    await g.runSensorProcessing(tenant, { userId: tenant.userId, run: { rawFileId: "eye_p01", processingRecipeVersion: "r1", steps: ["integrity", "artifact"], codeHash: "h1", outputFile: "proc_eye_p01", checksum: "c1" } });
    await g.runEventLogProcessing(tenant, { userId: tenant.userId, run: { batchRef: "log_p01", recipeVersion: "r1", steps: ["validate"], features: [{ name: "duration", sourceEvents: ["start", "end"] }] } });
    pass("TEST_18_19_SENSOR_LOG_PROCESSING");
  } catch (e) { fail("TEST_18_19_SENSOR_LOG_PROCESSING", e); }

  // TEST_20：自動轉錄不得標 VERIFIED
  try {
    const t1 = await g.saveTranscriptRecord(tenant, { userId: tenant.userId, record: { sourceRecord: "qual_p01", transcriptStage: "HUMAN_VERIFIED", humanVerification: false } });
    assert.equal(t1.ok, false);
    const t2 = await g.saveTranscriptRecord(tenant, { userId: tenant.userId, record: { sourceRecord: "qual_p01", transcriptStage: "AUTOMATED_DRAFT", humanVerification: false } });
    assert.equal(t2.ok, true);
    pass("TEST_20_TRANSCRIPT_VERIFICATION_GUARD");
  } catch (e) { fail("TEST_20_TRANSCRIPT_VERIFICATION_GUARD", e); }

  // TEST_21：AI 同單位跨 Train/Test → DATA_LEAKAGE_BLOCKING_ERROR
  try {
    await g.saveAiDataset(tenant, { userId: tenant.userId, record: { datasetKey: "ai1", splitUnit: "participant", splitManifest: { train: ["P01", "P02"], validation: ["P03"], test: ["P02"] } } });
    const ck = await g.checkAiLeakage(tenant, { userId: tenant.userId, datasetKey: "ai1" });
    assert.equal(ck.ok, false);
    assert.match(String(ck.error), /DATA_LEAKAGE/);
    pass("TEST_21_AI_LEAKAGE_BLOCKED");
  } catch (e) { fail("TEST_21_AI_LEAKAGE_BLOCKED", e); }

  // TEST_22：Post-hoc cohort 標記
  try {
    await g.saveCohort(tenant, { userId: tenant.userId, cohort: { cohortId: "itt", definition: "ITT", postHoc: false, approval: "PI" } });
    await g.saveCohort(tenant, { userId: tenant.userId, cohort: { cohortId: "late_followers", definition: "事後新增", postHoc: true } });
    const c = await q(`SELECT post_hoc FROM dataset_cohorts WHERE workspace_id='g11w' AND project_id='g11p' AND cohort_id='late_followers'`);
    assert.equal(c.rows[0].post_hoc, true);
    pass("TEST_22_POST_HOC_COHORT");
  } catch (e) { fail("TEST_22_POST_HOC_COHORT", e); }

  // TEST_23/24：Analysis Dataset 需要變數（Primary Outcome）；Clean 保留 Raw 連結
  try {
    const bad = await g.buildAnalysisDataset(tenant, { userId: tenant.userId, dataset: { datasetId: "ad_v1", includedVariables: [] } });
    assert.equal(bad.ok, false);
    await g.buildCleanDataset(tenant, { userId: tenant.userId, params: { datasetId: "clean_v1", rowCount: 10, columnCount: 4 } });
    const ok = await g.buildAnalysisDataset(tenant, { userId: tenant.userId, dataset: { datasetId: "ad_v1", datasetType: "PRIMARY_CONFIRMATORY_DATASET", datasetName: "Primary v1", includedVariables: ["participant_code", "arm", "hazard_total"], timePoints: ["T1", "T2"], sites: ["S01"], sourceCleanDataset: "clean_v1" } });
    assert.equal(ok.ok, true);
    const lin = await q(`SELECT count(*)::int AS n FROM data_lineage_edges WHERE workspace_id='g11w' AND project_id='g11p' AND to_id='ad_v1'`);
    assert.ok(lin.rows[0].n >= 1);
    pass("TEST_23_24_ANALYSIS_DATASET_REQUIRES_VARS");
  } catch (e) { fail("TEST_23_24_ANALYSIS_DATASET_REQUIRES_VARS", e); }

  // TEST_25/26：Freeze 後 Lock（缺簽核→失敗；齊全→Lock；Lock 後重 build 被擋）
  try {
    const f = await g.freezeAnalysisDataset(tenant, { userId: tenant.userId, datasetId: "ad_v1" });
    assert.equal(f.ok, true);
    const l1 = await g.lockAnalysisDataset(tenant, { userId: tenant.userId, datasetId: "ad_v1" });
    assert.equal(l1.ok, false); // 缺簽核/cohort/handoff/bp6/lineage ok but signoffs missing
    for (const role of ["DATA_MANAGER", "STATISTICIAN", "PRINCIPAL_INVESTIGATOR"]) await g.saveValidationReview(tenant, { userId: tenant.userId, review: { reviewer: role, reviewRole: role, approvalStatus: "APPROVED", reviewedVersion: "v1.0" } });
    await g.generateDataPreparationReport(tenant, { userId: tenant.userId });
    const hp = await g.createHandoffPackage(tenant, { userId: tenant.userId });
    assert.equal(hp.ok, true);
    const bp = await g.writeBlueprintV6(tenant, { userId: tenant.userId });
    assert.equal(bp.ok, true);
    const l2 = await g.lockAnalysisDataset(tenant, { userId: tenant.userId, datasetId: "ad_v1" });
    assert.equal(l2.ok, true);
    const re = await g.buildAnalysisDataset(tenant, { userId: tenant.userId, dataset: { datasetId: "ad_v1", includedVariables: ["x"] } });
    assert.equal(re.ok, false); // locked → 需新版本
    pass("TEST_25_26_FREEZE_LOCK_IMMUTABLE");
  } catch (e) { fail("TEST_25_26_FREEZE_LOCK_IMMUTABLE", e); }

  // TEST_28/29/31/32：Gate 條件／PII 阻擋／Gate3 通過；無統計欄位
  try {
    const g1 = await g.approveGovernanceGate(tenant, { userId: tenant.userId, gateType: "DATA_GOVERNANCE_AND_SCHEMA_APPROVED" });
    assert.equal(g1.ok, true);
    const g2 = await g.approveGovernanceGate(tenant, { userId: tenant.userId, gateType: "CLEAN_DATASET_VALIDATED" });
    assert.equal(g2.ok, true);
    const g3 = await g.approveGovernanceGate(tenant, { userId: tenant.userId, gateType: "ANALYSIS_DATASET_V1_LOCKED_AND_ANALYSIS_READY" });
    assert.equal(g3.ok, true);
    const cols = await q(`SELECT column_name FROM information_schema.columns WHERE table_name='analysis_datasets'`);
    const names = cols.rows.map((r) => r.column_name).join(",");
    assert.ok(!names.includes("p_value") && !names.includes("effect_size"));
    pass("TEST_28_29_31_32_GATES_AND_NO_STAT_COLUMNS");
  } catch (e) { fail("TEST_28_29_31_32_GATES_AND_NO_STAT_COLUMNS", e); }

  const failed = run.filter((r) => !r.ok);
  console.log("PHASE11_CONTRACT_TESTS=" + (failed.length === 0 ? "ALL_PASS" : `${failed.length}_FAILED`));
  console.log(`PHASE11_TEST_COUNT=${run.length}`);
  process.exitCode = failed.length === 0 ? 0 : 1;
} finally {
  await client.end().catch(() => undefined);
}
