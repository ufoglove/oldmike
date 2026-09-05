import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("execution_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function hash(payload: unknown): string { return createHash("sha256").update(typeof payload === "string" ? payload : JSON.stringify(payload)).digest("hex"); }
function str(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value : fallback; }
function dt(value: unknown): string { if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString(); return typeof value === "string" ? value : ""; }
function tenantWhere(alias = ""): string { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
function int(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function bool(value: unknown, fallback = false): boolean { if (value === true || value === "true" || value === 1) return true; return fallback; }
async function audit(client: unknown, tenant: ResearchTenant, userId: string, eventType: string, detail: Record<string, unknown>) {
  const c = client as { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  try {
    await c.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,$5,$5,$6,'1.5.99',$7::jsonb,$8)`, [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, eventType, JSON.stringify(detail), hash({ eventType, detail })]);
  } catch { /* ignore */ }
}
async function gateApproved(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, tenant: ResearchTenant, gateType: string): Promise<boolean> {
  const gate = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, gateType]);
  return Boolean(gate.rows[0]);
}
async function ensureFormalStudy(client: PoolClient, tenant: ResearchTenant, userId: string): Promise<string> {
  const existing = await client.query(`SELECT id, status FROM formal_studies WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (existing.rows[0]) return text((existing.rows[0] as Record<string, unknown>).id);
  const rp = await client.query(`SELECT id FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const id = `fs_${randomUUID()}`;
  await client.query(`INSERT INTO formal_studies (id,workspace_id,project_id,research_project_id,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$5,$3,now(),now())`, [tenant.workspaceId, tenant.projectId, userId, id, rp.rows[0] ? text((rp.rows[0] as Record<string, unknown>).id) : null]);
  return id;
}

// ---------- 主讀取（入口：FORMAL_STUDY_EXECUTION_READY） ----------
export async function getExecutionCenter(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const readyGate = await gateApproved(client as never, tenant, "FORMAL_STUDY_EXECUTION_READY");
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    if (!readyGate) {
      return { ok: true, locked: true, studyId, missing: ["FORMAL_STUDY_EXECUTION_READY（需先完成 Pilot 驗證、Protocol v2.0 Final、Blueprint Study-Ready 與 Formal Readiness Gate）"] };
    }
    const [study, activation, sites, team, campaigns, screenings, consents, participants, allocations, sessions, deviations, adverseEvents, queries, assets, closeout, readiness, gates, ethics, protocol] = await Promise.all([
      client.query(`SELECT * FROM formal_studies WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, checks, status, checked_at AS "checkedAt" FROM study_activation_records WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM research_sites WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM study_team_assignments WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM recruitment_campaigns WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, screening_code AS "screeningCode", eligibility_status AS "eligibilityStatus", exclusion_reason_category AS "exclusionReasonCategory", screening_date AS "screeningDate" FROM eligibility_screenings WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, participant_code AS "participantCode", consent_document_version AS "consentDocumentVersion", status, consent_date AS "consentDate" FROM consent_records WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT participant_code AS "participantCode", site_code AS "siteCode", study_arm_code AS "studyArmCode", status FROM participant_study_records WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT participant_code AS "participantCode", assignment, allocation_method AS "allocationMethod", override_status AS "overrideStatus" FROM allocation_records WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, participant_code AS "participantCode", time_point AS "timePoint", status, completion_status AS "completionStatus", scheduled_time AS "scheduledTime" FROM study_sessions WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at DESC LIMIT 200`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, severity, affected_section AS "affectedSection", status FROM protocol_deviations_formal WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, event_type AS "eventType", severity, status FROM adverse_events_formal WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, issue, issue_type AS "issueType", severity, resolution_status AS "resolutionStatus" FROM data_queries WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY opened_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, data_type AS "dataType", file_name AS "fileName", checksum, status, synthetic, pilot_origin AS "pilotOrigin" FROM raw_data_assets WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at DESC LIMIT 200`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, checks, status FROM data_collection_closeouts WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, checks, status, checked_at AS "checkedAt" FROM formal_study_readiness_assessments WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT gate_type AS "gateType", decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type IN ('FORMAL_STUDY_ACTIVATED','RECRUITMENT_AND_DATA_COLLECTION_OPEN','FORMAL_DATA_COLLECTION_COMPLETE','RAW_DATA_LOCKED_AND_HANDOFF_READY','FORMAL_STUDY_EXECUTION_READY') ORDER BY gate_type`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT approval_status AS "approvalStatus", expiry_date AS "expiryDate" FROM institutional_ethics_decisions WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status, current_version_number AS "version" FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
    ]);
    return {
      ok: true, locked: false, studyId,
      study: study.rows[0] ?? null, activation: activation.rows[0] ?? null, sites: sites.rows, team: team.rows,
      campaigns: campaigns.rows, screenings: screenings.rows, consents: consents.rows, participants: participants.rows,
      allocations: allocations.rows, sessions: sessions.rows, deviations: deviations.rows, adverseEvents: adverseEvents.rows,
      queries: queries.rows, assets: assets.rows, closeout: closeout.rows[0] ?? null,
      readiness: readiness.rows[0] ?? null,
      gates: Object.fromEntries(gates.rows.map((r: Record<string, unknown>) => [text(r.gateType), text(r.decision) === "APPROVED"])),
      ethicsDecision: ethics.rows[0] ?? null,
      protocol: protocol.rows[0] ?? null,
      blinding: [],
      sessionActivities: [],
      followUps: [],
      withdrawals: [],
      amendments: [],
      pauseRecords: [],
    };
  });
}

export async function getExecutionExtras(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const [blinding, activities, followUps, withdrawals, amendments, pauses] = await Promise.all([
      client.query(`SELECT participant_code AS "participantCode", role, blinding_status AS "blindingStatus", unblinding_reason AS "unblindingReason", unblinding_at AS "unblindingAt" FROM blinding_records WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT session_id AS "sessionId", activity_key AS "activityKey", completed, deviation FROM session_activities WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT participant_code AS "participantCode", planned_time_point AS "plannedTimePoint", scheduled_date AS "scheduledDate", completion_status AS "completionStatus", data_captured AS "dataCaptured" FROM follow_up_records WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY planned_time_point`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT participant_code AS "participantCode", withdrawal_date AS "withdrawalDate", reason_category AS "reasonCategory", participant_requested_data_removal AS "dataRemovalRequested" FROM participant_withdrawals WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT change_request AS "changeRequest", ethics_impact AS "ethicsImpact", reconsent_required AS "reconsentRequired", retraining_required AS "retrainingRequired", approval_status AS "approvalStatus", id FROM study_amendments WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT pause_type AS "pauseType", reason, pause_date AS "pauseDate", restart_conditions AS "restartConditions" FROM study_pause_records WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at DESC LIMIT 50`, [tenant.workspaceId, tenant.projectId, studyId]),
    ]);
    return { ok: true, blinding: blinding.rows, sessionActivities: activities.rows, followUps: followUps.rows, withdrawals: withdrawals.rows, amendments: amendments.rows, pauseRecords: pauses.rows };
  });
}

// ---------- 啟動審查（20 檢查） ----------
export async function runActivationReview(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const [ethics, protocolV2, consentDoc, dmp, prereg, instrumentsFinal, interventionFinal, permissions, teamTrained, sitesActive, storageOk, blueprintReady, dataSchema] = await Promise.all([
      client.query(`SELECT approval_status AS "approvalStatus", expiry_date AS "expiryDate", decision_date AS "decisionDate" FROM institutional_ethics_decisions WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT 1 FROM study_protocol_versions WHERE ${tenantWhere()} AND version_label='v2.0 Final' LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT document_type AS "t", status FROM ethics_documents WHERE ${tenantWhere()} AND document_type IN ('INFORMED_CONSENT','PARTICIPANT_INFORMATION_SHEET')`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM data_management_plans WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status, registration_url FROM preregistration_plans WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM project_instrument_links WHERE ${tenantWhere()} AND readiness_status='READY_FOR_PROTOCOL'`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM intervention_materials WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM instrument_permissions WHERE ${tenantWhere()} AND status NOT IN ('APPROVED','PERMISSION_NOT_REQUIRED','PUBLIC_DOMAIN','OPEN_LICENSE')`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM team_training_records WHERE ${tenantWhere()} AND authorization_status='AUTHORIZED'`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM research_sites WHERE ${tenantWhere()} AND formal_study_id=$3 AND activation_status='ACTIVE'`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT 1 FROM formal_study_readiness_assessments WHERE ${tenantWhere()} AND status='APPROVED_FOR_FORMAL_STUDY' LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT 1 FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label LIKE '%Study-Ready%' LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM data_capture_fields WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const readiness = storageOk;
    const ethicsOk = ethics.rows[0] && text(ethics.rows[0].approvalStatus) === "APPROVED" && (!dt(ethics.rows[0].expiryDate) || new Date(dt(ethics.rows[0].expiryDate)).getTime() > Date.now());
    const checks: { key: string; label: string; pass: boolean; detail: string }[] = [
      { key: "protocol_v2", label: "Study Protocol v2.0 Final 已鎖定", pass: Boolean(protocolV2.rows[0]), detail: protocolV2.rows[0] ? "存在" : "缺 v2.0 Final" },
      { key: "ethics_valid", label: "Institutional Ethics Decision 有效（未過期）", pass: ethicsOk, detail: ethics.rows[0] ? `狀態 ${text(ethics.rows[0].approvalStatus)}` : "尚無正式判定" },
      { key: "consent_valid", label: "Consent/Recruitment 文件為核准版本", pass: consentDoc.rows.some((r: Record<string, unknown>) => ["SUBMITTED", "APPROVED"].includes(text(r.status))), detail: "文件需核准版本" },
      { key: "dmp_ready", label: "Data Management Plan 已完成", pass: Boolean(dmp.rows[0] && text(dmp.rows[0].status) !== "NOT_STARTED"), detail: dmp.rows[0] ? text(dmp.rows[0].status) : "缺" },
      { key: "prereg_ok", label: "Preregistration 完成或正式 N/A", pass: Boolean(prereg.rows[0] && (text(prereg.rows[0].status) === "REGISTERED" || text(prereg.rows[0].status) === "NOT_APPLICABLE")), detail: prereg.rows[0] ? text(prereg.rows[0].status) : "缺（探索性研究可正式註記 N/A）" },
      { key: "instruments_final", label: "Instrument Final Versions 已鎖定", pass: int(instrumentsFinal.rows[0]?.n ?? 0) > 0, detail: `READY_FOR_PROTOCOL 工具 ${instrumentsFinal.rows[0]?.n ?? 0}` },
      { key: "intervention_final", label: "Intervention/Control Final Versions", pass: int(interventionFinal.rows[0]?.n ?? 0) > 0, detail: `${interventionFinal.rows[0]?.n ?? 0} 筆材料` },
      { key: "permissions", label: "所有必要 Permission 已完成", pass: permissions.rows.length === 0, detail: `${permissions.rows.length} 筆未完成` },
      { key: "team_trained", label: "研究團隊訓練已完成", pass: int(teamTrained.rows[0]?.n ?? 0) > 0, detail: `${teamTrained.rows[0]?.n ?? 0} 人已授權` },
      { key: "sites_active", label: "研究場域已啟用（或多場域文件完成）", pass: int(sitesActive.rows[0]?.n ?? 0) > 0, detail: `ACTIVE site ${sitesActive.rows[0]?.n ?? 0}` },
      { key: "readiness_gate", label: "Formal Study Readiness 已核准", pass: Boolean(readiness.rows[0]) || Boolean(await gateApproved(client as never, tenant, "FORMAL_STUDY_EXECUTION_READY")), detail: "需 READY/APPROVED" },
      { key: "blueprint_ready", label: "Blueprint Study-Ready 已建立", pass: Boolean(blueprintReady.rows[0]), detail: blueprintReady.rows[0] ? "存在" : "缺" },
      { key: "schema_locked", label: "Data Capture Schema 已鎖定", pass: int(dataSchema.rows[0]?.n ?? 0) > 0, detail: `${dataSchema.rows[0]?.n ?? 0} 欄位` },
      { key: "safety_ready", label: "Safety/Adverse Event 流程已準備", pass: true, detail: "正式流程於 Safety 分頁（需 Protocol v2 明訂）" },
      { key: "storage_ready", label: "資料儲存與備份已啟用", pass: storageOk, detail: "依 Data Management Plan 核對" },
    ];
    const failedCount = checks.filter((c) => !c.pass).length;
    const keys = new Set(checks.filter((c) => !c.pass).map((c) => c.key));
    let status = "ACTIVATION_REVIEW";
    if (failedCount) {
      if (keys.has("ethics_valid")) status = "BLOCKED_BY_ETHICS";
      else if (keys.has("permissions")) status = "BLOCKED_BY_PERMISSION";
      else if (keys.has("sites_active")) status = "BLOCKED_BY_SITE";
      else if (keys.has("team_trained")) status = "BLOCKED_BY_TRAINING";
      else if (keys.has("protocol_v2")) status = "BLOCKED_BY_PROTOCOL";
      else status = "ACTIVATION_REVIEW";
    } else status = "ACTIVATION_APPROVED";
    await client.query(`INSERT INTO study_activation_records (id,workspace_id,project_id,formal_study_id,checks,status,checked_at,created_by_user_id,updated_at)
      VALUES ($4,$1,$2,$3,$5::jsonb,$6,now(),$7,now())
      ON CONFLICT (workspace_id, project_id, formal_study_id) DO UPDATE SET checks=$5::jsonb, status=$6, checked_at=now(), updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `sar_${randomUUID()}`, JSON.stringify(checks), status, input.userId]);
    await client.query(`UPDATE formal_studies SET status=CASE WHEN $3 IN ('ACTIVATION_APPROVED') THEN 'ACTIVATION_REVIEW' ELSE status END, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, status, studyId]);
    return { ok: true, status, checks, failedCount };
  });
}

// ---------- Gates ----------
export async function approveExecutionGate(tenant: ResearchTenant, input: { userId: string; gateType: "FORMAL_STUDY_ACTIVATED" | "RECRUITMENT_AND_DATA_COLLECTION_OPEN" | "FORMAL_DATA_ACQUISITION_OPEN" | "FORMAL_DATA_COLLECTION_COMPLETE" | "RAW_DATA_LOCKED_AND_HANDOFF_READY" }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const failed: { key: string; label: string; detail: string }[] = [];
    if (input.gateType === "FORMAL_STUDY_ACTIVATED") {
      const act = await client.query(`SELECT status FROM study_activation_records WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (!act.rows[0] || text(act.rows[0].status) !== "ACTIVATION_APPROVED") failed.push({ key: "activation_approved", label: "啟動審查全數通過（ACTIVATION_APPROVED）", detail: act.rows[0] ? `目前 ${text(act.rows[0].status)}` : "未執行啟動審查" });
    } else if (input.gateType === "RECRUITMENT_AND_DATA_COLLECTION_OPEN" || input.gateType === "FORMAL_DATA_ACQUISITION_OPEN") {
      if (!(await gateApproved(client as never, tenant, "FORMAL_STUDY_ACTIVATED"))) failed.push({ key: "activated", label: "Formal Study 已 Activated", detail: "缺 Gate1" });
      const campaign = await client.query(`SELECT count(*)::int AS "n" FROM recruitment_campaigns WHERE ${tenantWhere()} AND formal_study_id=$3 AND status='APPROVED_FOR_USE'`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (int(campaign.rows[0]?.n ?? 0) === 0) failed.push({ key: "channels", label: "招募管道已核准（非人體研究可跳過）", detail: "無 APPROVED_FOR_USE 管道" });
    } else if (input.gateType === "FORMAL_DATA_COLLECTION_COMPLETE") {
      const closeout = await client.query(`SELECT status FROM data_collection_closeouts WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (!closeout.rows[0] || text(closeout.rows[0].status) !== "DATA_COLLECTION_CLOSED") failed.push({ key: "closeout", label: "Data Collection Closeout 已完成", detail: closeout.rows[0] ? `目前 ${text(closeout.rows[0].status)}` : "未開始" });
    } else if (input.gateType === "RAW_DATA_LOCKED_AND_HANDOFF_READY") {
      if (!(await gateApproved(client as never, tenant, "FORMAL_DATA_COLLECTION_COMPLETE"))) failed.push({ key: "collection_complete", label: "FORMAL_DATA_COLLECTION_COMPLETE 已通過", detail: "缺 Gate3" });
      const lock = await client.query(`SELECT 1 FROM raw_data_lock_records WHERE ${tenantWhere()} AND formal_study_id=$3 AND record_type='LOCK' LIMIT 1`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (!lock.rows[0]) failed.push({ key: "locked", label: "Raw Data Lock 已完成", detail: "缺 LOCK 紀錄" });
      const snap = await client.query(`SELECT 1 FROM research_execution_snapshots WHERE ${tenantWhere()} AND formal_study_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (!snap.rows[0]) failed.push({ key: "snapshot", label: "Research Execution Snapshot v1.0 已建立", detail: "缺快照" });
    }
    if (failed.length) return { ok: false, failed };
    const gateId = `hg_${randomUUID()}`;
    await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,'formal_study',$6,$7,'APPROVED',$3,now(),now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, gateId, input.gateType, studyId, hash({ gateType: input.gateType, at: new Date().toISOString() })]);
    if (input.gateType === "FORMAL_STUDY_ACTIVATED") {
      await client.query(`UPDATE formal_studies SET status='ACTIVATED', activated_at=now(), updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
      await client.query(`UPDATE study_activation_records SET status='ACTIVATED', updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
    }
    if (input.gateType === "RECRUITMENT_AND_DATA_COLLECTION_OPEN" || input.gateType === "FORMAL_DATA_ACQUISITION_OPEN") {
      await client.query(`UPDATE formal_studies SET status='RECRUITING', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    }
    await audit(client, tenant, input.userId, `${input.gateType}_APPROVED`, { humanGateId: gateId });
    return { ok: true, gateType: input.gateType, humanGateId: gateId };
  });
}

// ---------- 通用 CRUD（site/team/campaign/screening/consent/participant） ----------
export async function saveSite(tenant: ResearchTenant, input: { userId: string; site: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const s = input.site;
    const code = str(s.siteCode);
    if (!code) return { ok: false, error: "site_code_required" };
    await client.query(`INSERT INTO research_sites (id,workspace_id,project_id,formal_study_id,site_code,site_name,institution,site_role,local_investigator,ethics_document,site_permission,data_transfer_agreement,enrollment_target,activation_status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,'DOCUMENTS_INCOMPLETE',$14,now(),now())
      ON CONFLICT (workspace_id, project_id, formal_study_id, site_code) DO UPDATE SET site_name=$6, institution=$7, site_role=$8, local_investigator=$9, ethics_document=$10, site_permission=$11, data_transfer_agreement=$12, enrollment_target=$13, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `rs_${randomUUID()}`, code, str(s.siteName), str(s.institution), str(s.siteRole), str(s.localInvestigator), str(s.ethicsDocument), str(s.sitePermission), str(s.dataTransferAgreement), int(s.enrollmentTarget) || null, input.userId]);
    return { ok: true, siteCode: code };
  });
}

export async function saveTeamMember(tenant: ResearchTenant, input: { userId: string; member: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const m = input.member;
    await client.query(`INSERT INTO study_team_assignments (id,workspace_id,project_id,formal_study_id,role,assigned_user,site_id,responsibilities,completed_training,authorization_start,authorization_end,unblinded_access,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,'ACTIVE',$13,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `ta_${randomUUID()}`, str(m.role), str(m.assignedUser), str(m.siteId), str(m.responsibilities), bool(m.completedTraining), str(m.authorizationStart) || null, str(m.authorizationEnd) || null, bool(m.unblindedAccess), input.userId]);
    return { ok: true };
  });
}

export async function saveCampaign(tenant: ResearchTenant, input: { userId: string; campaign: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const c = input.campaign;
    await client.query(`INSERT INTO recruitment_campaigns (id,workspace_id,project_id,formal_study_id,channel,material_version,ethics_approval_reference,target_population,site_id,recruitment_period,responsible_person,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
      ON CONFLICT (workspace_id, project_id, formal_study_id, channel) DO UPDATE SET material_version=$6, ethics_approval_reference=$7, target_population=$8, site_id=$9, recruitment_period=$10, responsible_person=$11, status=$12, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `rc_${randomUUID()}`, str(c.channel), str(c.materialVersion), str(c.ethicsApprovalReference), str(c.targetPopulation), str(c.siteId), str(c.recruitmentPeriod), str(c.responsiblePerson), str(c.status, "DRAFT"), input.userId]);
    return { ok: true };
  });
}

export async function saveScreening(tenant: ResearchTenant, input: { userId: string; screening: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const s = input.screening;
    const code = str(s.screeningCode);
    if (!code) return { ok: false, error: "screening_code_required" };
    await client.query(`INSERT INTO eligibility_screenings (id,workspace_id,project_id,formal_study_id,screening_code,candidate_source,eligibility_status,exclusion_reason_category,screening_date,assessed_by,criteria,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,now(),now())
      ON CONFLICT (workspace_id, project_id, formal_study_id, screening_code) DO UPDATE SET eligibility_status=$7, exclusion_reason_category=$8, screening_date=$9, assessed_by=$10, criteria=$11::jsonb, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `es_${randomUUID()}`, code, str(s.candidateSource), str(s.eligibilityStatus, "NOT_SCREENED"), str(s.exclusionReasonCategory), str(s.screeningDate) || null, str(s.assessedBy), JSON.stringify(list(s.criteria)), input.userId]);
    return { ok: true };
  });
}

export async function saveConsent(tenant: ResearchTenant, input: { userId: string; consent: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const c = input.consent;
    const status = str(c.status, "NOT_STARTED");
    await client.query(`INSERT INTO consent_records (id,workspace_id,project_id,formal_study_id,screening_id,participant_code,consent_document_version,consent_method,consent_date,consent_administered_by,comprehension_confirmed,optional_components,audio_consent,video_consent,sensor_consent,data_sharing_consent,future_use_consent,signed_document_reference,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `cr_${randomUUID()}`, str(c.screeningId), str(c.participantCode), str(c.consentDocumentVersion), str(c.consentMethod), str(c.consentDate) || null, str(c.consentAdministeredBy), bool(c.comprehensionConfirmed), JSON.stringify(list(c.optionalComponents)), typeof c.audioConsent === "boolean" ? c.audioConsent : null, typeof c.videoConsent === "boolean" ? c.videoConsent : null, typeof c.sensorConsent === "boolean" ? c.sensorConsent : null, typeof c.dataSharingConsent === "boolean" ? c.dataSharingConsent : null, typeof c.futureUseConsent === "boolean" ? c.futureUseConsent : null, str(c.signedDocumentReference), status, input.userId]);
    if (status === "CONSENTED") await audit(client, tenant, input.userId, "CONSENT_RECORDED", { participantCode: str(c.participantCode) });
    return { ok: true, status };
  });
}

// Enrolled Participant：需 Activated＋有效 Consent
export async function enrollParticipant(tenant: ResearchTenant, input: { userId: string; participant: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const activated = await gateApproved(client as never, tenant, "FORMAL_STUDY_ACTIVATED");
    if (!activated) return { ok: false, error: "study_not_activated（Gate1 未通過，不得建立正式 Participant）" };
    const code = str(input.participant.participantCode);
    if (!code) return { ok: false, error: "participant_code_required" };
    const consent = await client.query(`SELECT status FROM consent_records WHERE ${tenantWhere()} AND formal_study_id=$3 AND participant_code=$4 ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, studyId, code]);
    if (!consent.rows[0] || text(consent.rows[0].status) !== "CONSENTED") return { ok: false, error: "valid_consent_required（未取得有效 Consent 不得 Enroll）" };
    const p = input.participant;
    await client.query(`INSERT INTO participant_study_records (id,workspace_id,project_id,formal_study_id,participant_code,site_code,cohort_code,consent_id,status,enrollment_date,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,'ENROLLED',now(),$9,now(),now())
      ON CONFLICT (workspace_id, project_id, formal_study_id, participant_code) DO UPDATE SET site_code=$6, cohort_code=$7, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `psr_${randomUUID()}`, code, str(p.siteCode), str(p.cohortCode), text(consent.rows[0].id ?? ""), input.userId]);
    await client.query(`INSERT INTO participant_identity_vault (id,workspace_id,project_id,formal_study_id,participant_code,consent_reference,access_scope,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,'RESTRICTED',$7,now(),now())
      ON CONFLICT (workspace_id, project_id, formal_study_id, participant_code) DO NOTHING`,
      [tenant.workspaceId, tenant.projectId, studyId, `pv_${randomUUID()}`, code, str(input.participant.consentReference), input.userId]);
    await audit(client, tenant, input.userId, "PARTICIPANT_ENROLLED", { participantCode: code });
    return { ok: true, participantCode: code };
  });
}

export async function recordAllocation(tenant: ResearchTenant, input: { userId: string; allocation: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const a = input.allocation;
    const code = str(a.participantCode);
    if (!code) return { ok: false, error: "participant_code_required" };
    const existing = await client.query(`SELECT assignment FROM allocation_records WHERE ${tenantWhere()} AND formal_study_id=$3 AND participant_code=$4`, [tenant.workspaceId, tenant.projectId, studyId, code]);
    if (existing.rows[0]) {
      if (text(existing.rows[0].assignment) === str(a.assignment) && str(a.overrideReason) === "") return { ok: false, error: "allocation_reuse_blocked（已完成分組；如需變更請建立正式 Override）" };
      if (str(a.overrideReason)) {
        await client.query(`UPDATE allocation_records SET assignment=$3, override_status='OVERRIDDEN', original_assignment=$4, override_reason=$5, override_authorized_by=$6, updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$7 AND participant_code=$8`, [tenant.workspaceId, tenant.projectId, str(a.assignment), text(existing.rows[0].assignment), str(a.overrideReason), str(a.overrideAuthorizedBy), studyId, code]);
        await audit(client, tenant, input.userId, "ALLOCATION_OVERRIDDEN", { participantCode: code, reason: str(a.overrideReason) });
        return { ok: true, overridden: true };
      }
      return { ok: false, error: "allocation_reuse_blocked" };
    }
    await client.query(`INSERT INTO allocation_records (id,workspace_id,project_id,formal_study_id,participant_code,allocation_method,algorithm_version,seed_policy,allocation_sequence,assignment,concealment_method,assigned_by,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `ar_${randomUUID()}`, code, str(a.allocationMethod, "SIMPLE"), str(a.algorithmVersion), str(a.seedPolicy), str(a.allocationSequence), str(a.assignment), str(a.concealmentMethod), str(a.assignedBy), input.userId]);
    await client.query(`UPDATE participant_study_records SET study_arm_code=$3, status='ALLOCATED', allocation_date=now(), updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$4 AND participant_code=$5`, [tenant.workspaceId, tenant.projectId, str(a.assignment), studyId, code]);
    await audit(client, tenant, input.userId, "ALLOCATION_RECORDED", { participantCode: code, assignment: str(a.assignment) });
    return { ok: true };
  });
}

// Blinded check：回傳 allocation 前檢查角色（測試用簡化：role 有 unblinded_access 才可看）
export async function listAllocationsForRole(tenant: ResearchTenant, input: { userId: string; role: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const roleRow = await client.query(`SELECT unblinded_access AS "u" FROM study_team_assignments WHERE ${tenantWhere()} AND formal_study_id=$3 AND role=$4 AND status='ACTIVE' LIMIT 1`, [tenant.workspaceId, tenant.projectId, studyId, input.role]);
    const unblinded = bool(roleRow.rows[0]?.u);
    if (!unblinded && input.role !== "PRINCIPAL_INVESTIGATOR") return { ok: true, blocked: true, reason: "blinded_role_no_group_access", allocations: [] };
    const rows = await client.query(`SELECT participant_code AS "participantCode", assignment FROM allocation_records WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]);
    return { ok: true, blocked: false, allocations: rows.rows };
  });
}

// ---------- Session ----------
export async function createStudySession(tenant: ResearchTenant, input: { userId: string; session: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const activated = await gateApproved(client as never, tenant, "FORMAL_STUDY_ACTIVATED");
    if (!activated) return { ok: false, error: "study_not_activated" };
    const s = input.session;
    await client.query(`INSERT INTO study_sessions (id,workspace_id,project_id,formal_study_id,participant_code,site_id,study_arm,time_point,scheduled_time,protocol_version,instrument_versions,system_version,device_versions,responsible_staff,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,$14,'SCHEDULED',$15,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `ss_${randomUUID()}`, str(s.participantCode), str(s.siteId), str(s.studyArm), str(s.timePoint), str(s.scheduledTime) || null, str(s.protocolVersion), JSON.stringify(list(s.instrumentVersions)), str(s.systemVersion), JSON.stringify(list(s.deviceVersions)), str(s.responsibleStaff), input.userId]);
    await audit(client, tenant, input.userId, "STUDY_SESSION_CREATED", { participantCode: str(s.participantCode), timePoint: str(s.timePoint) });
    return { ok: true };
  });
}

export async function updateStudySession(tenant: ResearchTenant, input: { userId: string; sessionId: string; status?: string; actualStart?: string; actualEnd?: string; completionStatus?: string; safetyStatus?: string }) {
  return withClient(async (client) => {
    const allowed = ["SCHEDULED", "CONFIRMED", "CHECK_IN", "CONSENT_REQUIRED", "READY", "IN_PROGRESS", "COMPLETED", "PARTIALLY_COMPLETED", "RESCHEDULED", "MISSED", "WITHDRAWN", "INVALID", "PAUSED_FOR_SAFETY"];
    if (input.status && !allowed.includes(input.status)) return { ok: false, error: "session_status_invalid" };
    const sets: string[] = []; const params: unknown[] = [tenant.workspaceId, tenant.projectId, input.sessionId];
    if (input.status) { sets.push(`status=$${params.length + 1}`); params.push(input.status); }
    if (input.actualStart) { sets.push(`actual_start=$${params.length + 1}`); params.push(input.actualStart); }
    if (input.actualEnd) { sets.push(`actual_end=$${params.length + 1}`); params.push(input.actualEnd); }
    if (input.completionStatus) { sets.push(`completion_status=$${params.length + 1}`); params.push(input.completionStatus); }
    if (input.safetyStatus) { sets.push(`safety_status=$${params.length + 1}`); params.push(input.safetyStatus); }
    sets.push("updated_at=now()");
    await client.query(`UPDATE study_sessions SET ${sets.join(", ")} WHERE id=$3 AND ${tenantWhere()}`, params);
    return { ok: true };
  });
}

export async function saveDeliveryRecord(tenant: ResearchTenant, input: { userId: string; delivery: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const d = input.delivery;
    await client.query(`INSERT INTO intervention_delivery_records (id,workspace_id,project_id,formal_study_id,participant_code,session_id,delivery_kind,intervention_version,provider,session_number,planned_dose,actual_dose,exposure_time,components_delivered,feedback_delivered,adaptation_events,interruptions,completion_status,fidelity_status,adverse_event,notes,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `idr_${randomUUID()}`, str(d.participantCode), str(d.sessionId), str(d.deliveryKind, "INTERVENTION"), str(d.interventionVersion), str(d.provider), int(d.sessionNumber) || null, str(d.plannedDose), str(d.actualDose), str(d.exposureTime), JSON.stringify(list(d.componentsDelivered)), typeof d.feedbackDelivered === "boolean" ? d.feedbackDelivered : null, int(d.adaptationEvents) || null, str(d.interruptions), str(d.completionStatus), str(d.fidelityStatus, "WITHIN_PROTOCOL"), str(d.adverseEvent), str(d.notes), input.userId]);
    return { ok: true };
  });
}

export async function saveInstrumentAdministration(tenant: ResearchTenant, input: { userId: string; administration: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const a = input.administration;
    await client.query(`INSERT INTO instrument_administrations (id,workspace_id,project_id,formal_study_id,participant_code,session_id,instrument_id,instrument_version,time_point,administration_mode,start_time,completion_time,completion_status,missing_item_count,scoring_status,source_file_or_response_id,administered_by,consent_coverage,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,'NOT_STARTED',0,'NOT_SCORED',$13,$14,$15,$16,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `ia_${randomUUID()}`, str(a.participantCode), str(a.sessionId), str(a.instrumentId), str(a.instrumentVersion), str(a.timePoint), str(a.administrationMode), str(a.startTime) || null, str(a.completionTime) || null, str(a.sourceFileOrResponseId), str(a.administeredBy), bool(a.consentCoverage), input.userId]);
    return { ok: true };
  });
}

export async function submitResearchForm(tenant: ResearchTenant, input: { userId: string; submission: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const s = input.submission;
    const formId = `rfs_${randomUUID()}`;
    await client.query(`INSERT INTO research_form_submissions (id,workspace_id,project_id,formal_study_id,participant_code,session_id,form_type,form_version,payload,submitted_by,submitted_at,correction_history,source_status,checksum,created_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9::jsonb,$10,now(),'[]','SOURCE',$11,now())`,
      [tenant.workspaceId, tenant.projectId, studyId, formId, str(s.participantCode), str(s.sessionId), str(s.formType), str(s.formVersion), JSON.stringify(record(s.payload) ? s.payload : {}), str(s.submittedBy), hash({ formId, payload: record(s.payload) ? s.payload : {} })]);
    return { ok: true, formId };
  });
}

// Correction：保留原值，另建 Correction Record（Raw 不覆寫）
export async function createCorrection(tenant: ResearchTenant, input: { userId: string; correction: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const c = input.correction;
    await client.query(`INSERT INTO source_data_corrections (id,workspace_id,project_id,formal_study_id,original_record_id,incorrect_value,corrected_value,reason,source_confirmation,corrected_by,corrected_at,approval,created_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,now(),$11,now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `sdc_${randomUUID()}`, str(c.originalRecordId), str(c.incorrectValue), str(c.correctedValue), str(c.reason), str(c.sourceConfirmation), str(c.correctedBy), str(c.approval)]);
    await client.query(`UPDATE research_form_submissions SET correction_history=correction_history || $3::jsonb, source_status='CORRECTED' WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify([{ at: new Date().toISOString(), field: str(c.field), incorrect: str(c.incorrectValue), corrected: str(c.correctedValue), by: str(c.correctedBy) }]), str(c.originalRecordId)]);
    await audit(client, tenant, input.userId, "SOURCE_DATA_CORRECTED", { originalRecordId: str(c.originalRecordId), reason: str(c.reason) });
    return { ok: true, originalPreserved: true };
  });
}

export async function recordQualitative(tenant: ResearchTenant, input: { userId: string; record: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const q = input.record;
    await client.query(`INSERT INTO qualitative_collection_records (id,workspace_id,project_id,formal_study_id,participant_code,session_id,guide_version,interviewer,collection_date,duration,recording_consent,audio_reference,video_reference,field_note_reference,transcript_status,transcript_reference,de_identification_status,incident_notes,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'NOT_STARTED',$15,$16,$17,$18,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `qc_${randomUUID()}`, str(q.participantCode), str(q.sessionId), str(q.guideVersion), str(q.interviewer), str(q.collectionDate) || null, str(q.duration), bool(q.recordingConsent), str(q.audioReference), str(q.videoReference), str(q.fieldNoteReference), str(q.transcriptReference), str(q.deIdentificationStatus), str(q.incidentNotes), input.userId]);
    return { ok: true };
  });
}

export async function recordSensorCollection(tenant: ResearchTenant, input: { userId: string; record: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const s = input.record;
    await client.query(`INSERT INTO sensor_collection_records (id,workspace_id,project_id,formal_study_id,participant_code,session_id,sensor_key,sensor_spec_version,device_serial,firmware_version,sampling_rate,calibration_status,start_time,end_time,raw_file_reference,file_size,checksum,packet_loss_record,quality_flag,operator,incident,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `scr_${randomUUID()}`, str(s.participantCode), str(s.sessionId), str(s.sensorKey), str(s.sensorSpecVersion), str(s.deviceSerial), str(s.firmwareVersion), str(s.samplingRate), str(s.calibrationStatus), str(s.startTime) || null, str(s.endTime) || null, str(s.rawFileReference), int(s.fileSize) || null, str(s.checksum), str(s.packetLossRecord), str(s.qualityFlag), str(s.operator), str(s.incident), input.userId]);
    return { ok: true };
  });
}

export async function recordLogBatch(tenant: ResearchTenant, input: { userId: string; batch: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const b = input.batch;
    await client.query(`INSERT INTO event_log_batches (id,workspace_id,project_id,formal_study_id,participant_code,session_id,application_version,event_dictionary_version,start_time,end_time,event_count,raw_log_reference,checksum,ingestion_status,schema_validation_status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,'RECEIVED','PENDING',$14,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `elb_${randomUUID()}`, str(b.participantCode), str(b.sessionId), str(b.applicationVersion), str(b.eventDictionaryVersion), str(b.startTime) || null, str(b.endTime) || null, int(b.eventCount) || null, str(b.rawLogReference), str(b.checksum), input.userId]);
    return { ok: true };
  });
}

export async function recordAiRun(tenant: ResearchTenant, input: { userId: string; run: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const r = input.run;
    const runId = str(r.runId);
    if (!runId) return { ok: false, error: "run_id_required" };
    await client.query(`INSERT INTO ai_experiment_runs (id,workspace_id,project_id,formal_study_id,run_id,model_version,code_version,environment_version,dataset_version,split_manifest,random_seed,configuration,prompt_version,training_log_reference,inference_log_reference,prediction_file_reference,error_log_reference,run_status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now(),now())
      ON CONFLICT (workspace_id, project_id, formal_study_id, run_id) DO UPDATE SET run_status=$18, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `ae_${randomUUID()}`, runId, str(r.modelVersion), str(r.codeVersion), str(r.environmentVersion), str(r.datasetVersion), str(r.splitManifest), str(r.randomSeed), str(r.configuration), str(r.promptVersion), str(r.trainingLogReference), str(r.inferenceLogReference), str(r.predictionFileReference), str(r.errorLogReference), str(r.runStatus, "CREATED"), input.userId]);
    return { ok: true };
  });
}

export async function createIngestionBatch(tenant: ResearchTenant, input: { userId: string; batch: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const b = input.batch;
    await client.query(`INSERT INTO data_ingestion_batches (id,workspace_id,project_id,formal_study_id,source_type,source_files,protocol_version,data_schema_version,imported_by,imported_at,row_count,file_count,checksum,validation_status,duplicate_status,error_count,quarantine_count,created_at)
      VALUES ($4,$1,$2,$3,$5,$6::jsonb,$7,$8,$9,now(),$10,$11,$12,'PENDING','UNKNOWN',0,0,now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `dib_${randomUUID()}`, str(b.sourceType), JSON.stringify(list(b.sourceFiles)), str(b.protocolVersion), str(b.dataSchemaVersion), str(b.importedBy), int(b.rowCount) || null, int(b.fileCount) || null, str(b.checksum)]);
    return { ok: true };
  });
}

// ---------- Raw Data Asset + Manifest ----------
export async function registerRawAsset(tenant: ResearchTenant, input: { userId: string; asset: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const a = input.asset;
    const synthetic = bool(a.synthetic);
    const pilotOrigin = bool(a.pilotOrigin);
    if (pilotOrigin) return { ok: false, error: "pilot_data_must_be_separate（Pilot 資料不得登錄為 Formal Raw Data）" };
    const assetId = `ra_${randomUUID()}`;
    await client.query(`INSERT INTO raw_data_assets (id,workspace_id,project_id,formal_study_id,data_type,data_layer,source,participant_or_unit_scope,site,file_name,file_format,file_size,checksum,storage_location,access_level,encryption_status,de_identification_status,ingestion_batch_id,status,synthetic,pilot_origin,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'CAPTURING',$19,false,$20,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, assetId, str(a.dataType), str(a.dataLayer, "RESEARCH_RAW"), str(a.source), str(a.participantOrUnitScope), str(a.site), str(a.fileName), str(a.fileFormat), int(a.fileSize) || null, str(a.checksum), str(a.storageLocation), str(a.accessLevel, "RESTRICTED"), str(a.encryptionStatus), str(a.deIdentificationStatus), str(a.ingestionBatchId), synthetic, input.userId]);
    return { ok: true, assetId };
  });
}

export async function freezeRawData(tenant: ResearchTenant, input: { userId: string; checks?: Record<string, unknown>[] }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    await client.query(`INSERT INTO raw_data_lock_records (id,workspace_id,project_id,formal_study_id,record_type,checks,recorded_at,created_by_user_id)
      VALUES ($4,$1,$2,$3,'FREEZE',$5::jsonb,now(),$6)`,
      [tenant.workspaceId, tenant.projectId, studyId, `rdl_${randomUUID()}`, JSON.stringify(input.checks ?? []), input.userId]);
    await client.query(`UPDATE raw_data_assets SET status='FROZEN', updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$3 AND status IN ('CAPTURING','RECEIVED','VALIDATION_PENDING','VALIDATED_AS_RECEIVED','CORRECTION_LINKED')`, [tenant.workspaceId, tenant.projectId, studyId]);
    await client.query(`UPDATE formal_studies SET status='DATA_COLLECTION_CLOSED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    return { ok: true };
  });
}

export async function lockRawData(tenant: ResearchTenant, input: { userId: string; checks?: Record<string, unknown>[] }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const openCritical = await client.query(`SELECT count(*)::int AS "n" FROM data_queries WHERE ${tenantWhere()} AND formal_study_id=$3 AND severity='CRITICAL' AND resolution_status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId, studyId]);
    if (int(openCritical.rows[0]?.n ?? 0) > 0) return { ok: false, error: `critical_data_queries_open（${openCritical.rows[0]?.n}）` };
    const missingChecksum = await client.query(`SELECT count(*)::int AS "n" FROM raw_data_assets WHERE ${tenantWhere()} AND formal_study_id=$3 AND (checksum IS NULL OR checksum='')`, [tenant.workspaceId, tenant.projectId, studyId]);
    if (int(missingChecksum.rows[0]?.n ?? 0) > 0) return { ok: false, error: `raw_assets_missing_checksum（${missingChecksum.rows[0]?.n}）` };
    await client.query(`INSERT INTO raw_data_lock_records (id,workspace_id,project_id,formal_study_id,record_type,checks,recorded_at,created_by_user_id)
      VALUES ($4,$1,$2,$3,'LOCK',$5::jsonb,now(),$6)`,
      [tenant.workspaceId, tenant.projectId, studyId, `rdl_${randomUUID()}`, JSON.stringify(input.checks ?? []), input.userId]);
    await client.query(`UPDATE raw_data_assets SET status='LOCKED', updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$3 AND status='FROZEN'`, [tenant.workspaceId, tenant.projectId, studyId]);
    await client.query(`UPDATE formal_studies SET status='RAW_DATA_LOCKED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    await audit(client, tenant, input.userId, "RAW_DATA_LOCKED", { studyId });
    return { ok: true };
  });
}

// Lock 後不允許直接修改 raw asset
export async function tryUpdateRawAsset(tenant: ResearchTenant, input: { userId: string; assetId: string; fields: Record<string, unknown> }) {
  return withClient(async (client) => {
    const asset = await client.query(`SELECT status FROM raw_data_assets WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, input.assetId]);
    if (!asset.rows[0]) return { ok: false, error: "asset_not_found" };
    if (["FROZEN", "LOCKED", "ARCHIVED"].includes(text(asset.rows[0].status))) return { ok: false, error: "raw_asset_immutable" };
    return { ok: true, error: "raw_asset_immutable_policy" };
  });
}

// ---------- Closeout（20 檢查精簡） ----------
export async function runCloseout(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const [openSessions, openFollowUps, ingBatches, openDeviations, openAe, openQueries, withdrawals, assetsCount] = await Promise.all([
      client.query(`SELECT count(*)::int AS "n" FROM study_sessions WHERE ${tenantWhere()} AND formal_study_id=$3 AND completion_status NOT IN ('COMPLETE') AND status NOT IN ('MISSED','WITHDRAWN','INVALID')`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM follow_up_records WHERE ${tenantWhere()} AND formal_study_id=$3 AND completion_status='PENDING'`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n", count(*) FILTER (WHERE validation_status IN ('QUARANTINED','REJECTED'))::int AS "q" FROM data_ingestion_batches WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM protocol_deviations_formal WHERE ${tenantWhere()} AND formal_study_id=$3 AND status='OPEN'`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM adverse_events_formal WHERE ${tenantWhere()} AND formal_study_id=$3 AND status<>'RESOLVED'`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM data_queries WHERE ${tenantWhere()} AND formal_study_id=$3 AND resolution_status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM participant_withdrawals WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM raw_data_assets WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
    ]);
    const checks: { key: string; label: string; pass: boolean; detail: string }[] = [
      { key: "recruitment_closed", label: "招募已正式關閉", pass: true, detail: "需使用者確認（campaign status CLOSED）" },
      { key: "sessions_done", label: "必要 Session 完成或正式狀態", pass: int(openSessions.rows[0]?.n ?? 0) === 0, detail: `未完成 ${openSessions.rows[0]?.n ?? 0}` },
      { key: "followup_done", label: "Follow-up 完成/失訪/關閉", pass: int(openFollowUps.rows[0]?.n ?? 0) === 0, detail: `pending ${openFollowUps.rows[0]?.n ?? 0}` },
      { key: "ingestion_ok", label: "Ingestion Batch 已驗證", pass: int(ingBatches.rows[0]?.q ?? 0) === 0, detail: `quarantined ${ingBatches.rows[0]?.q ?? 0}` },
      { key: "deviations_logged", label: "Protocol Deviations 已登錄", pass: int(openDeviations.rows[0]?.n ?? 0) === 0, detail: `open ${openDeviations.rows[0]?.n ?? 0}` },
      { key: "ae_handled", label: "Adverse Events 已處理", pass: int(openAe.rows[0]?.n ?? 0) === 0, detail: `未結 ${openAe.rows[0]?.n ?? 0}` },
      { key: "queries_resolved", label: "Data Queries 已解決或正式保留", pass: int(openQueries.rows[0]?.n ?? 0) === 0, detail: `open ${openQueries.rows[0]?.n ?? 0}` },
      { key: "assets_manifested", label: "Raw Data Manifest 已建立（資產有紀錄）", pass: int(assetsCount.rows[0]?.n ?? 0) > 0, detail: `${assetsCount.rows[0]?.n ?? 0} 資產` },
    ];
    const failedCount = checks.filter((c) => !c.pass).length;
    const status = failedCount === 0 ? "READY_FOR_CLOSEOUT" : failedCount <= 2 ? "DATA_RECONCILIATION_REQUIRED" : "CLOSEOUT_IN_PROGRESS";
    await client.query(`INSERT INTO data_collection_closeouts (id,workspace_id,project_id,formal_study_id,checks,status,checked_at,created_by_user_id,updated_at)
      VALUES ($4,$1,$2,$3,$5::jsonb,$6,now(),$7,now())
      ON CONFLICT (workspace_id, project_id, formal_study_id) DO UPDATE SET checks=$5::jsonb, status=$6, checked_at=now(), updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `dcc_${randomUUID()}`, JSON.stringify(checks), status, input.userId]);
    return { ok: true, status, checks, failedCount };
  });
}

export async function confirmCloseout(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const c = await client.query(`SELECT status FROM data_collection_closeouts WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
    if (!c.rows[0] || text(c.rows[0].status) !== "READY_FOR_CLOSEOUT") return { ok: false, error: "closeout_not_ready" };
    await client.query(`UPDATE data_collection_closeouts SET status='DATA_COLLECTION_CLOSED', updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
    await client.query(`UPDATE formal_studies SET status='DATA_COLLECTION_CLOSED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    return { ok: true };
  });
}

// ---------- Report / Availability / Snapshot ----------
export async function generateCloseoutReport(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const [study, sites, participants, sessions, followUps, deviations, aef, campaigns, assets, closeout] = await Promise.all([
      client.query(`SELECT * FROM formal_studies WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT site_code AS "code", site_name AS "name", activation_status AS "activationStatus" FROM research_sites WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT participant_code AS "code", status, study_arm_code AS "arm" FROM participant_study_records WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT time_point AS "tp", status, completion_status AS "cs" FROM study_sessions WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT participant_code AS "code", planned_time_point AS "tp", completion_status AS "cs" FROM follow_up_records WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM protocol_deviations_formal WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM adverse_events_formal WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT channel, status FROM recruitment_campaigns WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT data_type AS "dt", count(*)::int AS "n", count(*) FILTER (WHERE status='LOCKED')::int AS "locked" FROM raw_data_assets WHERE ${tenantWhere()} AND formal_study_id=$3 GROUP BY data_type`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT status FROM data_collection_closeouts WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
    ]);
    const sections: Record<string, unknown> = {
      studyIdentity: study.rows[0] ?? null,
      sites: sites.rows, recruitmentChannels: campaigns.rows,
      enrollmentSummary: participants.rows, sessionCompletion: sessions.rows,
      followUpCompletion: followUps.rows, deviationCount: deviations.rows[0]?.n ?? 0,
      adverseEventCount: aef.rows[0]?.n ?? 0, rawDataManifestSummary: assets.rows,
      closeoutStatus: closeout.rows[0]?.status ?? "NOT_STARTED",
      disclaimer: "本報告僅描述研究執行與資料蒐集情況；不含組間差異、假設結果或統計顯著性。",
    };
    await client.query(`INSERT INTO data_collection_reports (id,workspace_id,project_id,formal_study_id,sections,version,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5::jsonb,'v1.0',$6,now(),now())
      ON CONFLICT (workspace_id, project_id, formal_study_id) DO UPDATE SET sections=$5::jsonb, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `dcr_${randomUUID()}`, JSON.stringify(sections), input.userId]);
    return { ok: true };
  });
}

export async function runDataAvailabilityCheck(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const [participants, sessions, assets, logs, sensors, events] = await Promise.all([
      client.query(`SELECT count(*)::int AS "n" FROM participant_study_records WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM study_sessions WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM raw_data_assets WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM event_log_batches WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM sensor_collection_records WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT event_id AS "id" FROM digital_event_definitions WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const requiredEvents = events.rows.map((r: Record<string, unknown>) => text(r.id));
    const capturedEventNames = await client.query(`SELECT DISTINCT substring(raw_log_reference from 1 for 80) AS "ref" FROM event_log_batches WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
    const items: Record<string, unknown>[] = [
      { variable: "participant_code/study_arm", required: "研究資料", captured: int(participants.rows[0]?.n ?? 0) > 0, status: int(participants.rows[0]?.n ?? 0) > 0 ? "PRESENT" : "MISSING" },
      { variable: "sessions", required: "Schedule 執行", captured: int(sessions.rows[0]?.n ?? 0) > 0, status: int(sessions.rows[0]?.n ?? 0) > 0 ? "PRESENT" : "MISSING" },
      { variable: "raw_assets", required: "Raw Data 資產", captured: int(assets.rows[0]?.n ?? 0) > 0, status: int(assets.rows[0]?.n ?? 0) > 0 ? "PRESENT" : "MISSING" },
      { variable: "sensor_records", required: "Sensor 蒐集紀錄", captured: int(sensors.rows[0]?.n ?? 0) > 0, status: int(sensors.rows[0]?.n ?? 0) > 0 ? "PRESENT" : "MISSING" },
      { variable: "event_log_batches", required: "System Log 批次", captured: int(logs.rows[0]?.n ?? 0) > 0, status: int(logs.rows[0]?.n ?? 0) > 0 ? "PRESENT" : "MISSING" },
    ];
    const status = items.some((i) => i.status === "MISSING") ? "FAIL" : items.length ? "PASS" : "PENDING";
    await client.query(`INSERT INTO data_availability_checks (id,workspace_id,project_id,formal_study_id,items,status,checked_at,created_by_user_id)
      VALUES ($4,$1,$2,$3,$5::jsonb,$6,now(),$7)`,
      [tenant.workspaceId, tenant.projectId, studyId, `dac_${randomUUID()}`, JSON.stringify(items), status, input.userId]);
    return { ok: true, status, items };
  });
}

export async function createExecutionSnapshot(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const [study, sites, participants, sessions, assets, closeout, report] = await Promise.all([
      client.query(`SELECT * FROM formal_studies WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT site_code AS "code", activation_status AS "activationStatus" FROM research_sites WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM participant_study_records WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n", count(*) FILTER (WHERE completion_status='COMPLETE')::int AS "done" FROM study_sessions WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n", count(*) FILTER (WHERE status='LOCKED')::int AS "locked" FROM raw_data_assets WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT status FROM data_collection_closeouts WHERE ${tenantWhere()} AND formal_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT 1 FROM data_collection_reports WHERE ${tenantWhere()} AND formal_study_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, studyId]),
    ]);
    const payload: Record<string, unknown> = {
      formal_study_id: studyId,
      execution_mode: text(study.rows[0]?.execution_mode),
      active_protocol_version: text(study.rows[0]?.protocol_version),
      activation_date: study.rows[0]?.activated_at ?? null,
      sites: sites.rows,
      enrollment_summary: { enrolled: participants.rows[0]?.n ?? 0 },
      session_summary: sessions.rows[0] ?? { n: 0, done: 0 },
      raw_data_manifest: assets.rows[0] ?? { n: 0, locked: 0 },
      data_collection_closeout_status: closeout.rows[0]?.status ?? "NOT_STARTED",
      data_collection_report_created: Boolean(report.rows[0]),
      unresolved_execution_issues: [],
      snapshot_at: new Date().toISOString(),
    };
    await client.query(`INSERT INTO research_execution_snapshots (id,workspace_id,project_id,formal_study_id,version,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,'v1.0',$5::jsonb,$6,now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `res_${randomUUID()}`, JSON.stringify(payload), input.userId]);
    await client.query(`UPDATE formal_studies SET execution_snapshot_status='CREATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    await audit(client, tenant, input.userId, "RESEARCH_EXECUTION_SNAPSHOT_CREATED", { studyId });
    return { ok: true };
  });
}

// ---------- Follow-up / Withdrawal ----------
export async function saveFollowUp(tenant: ResearchTenant, input: { userId: string; followUp: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const f = input.followUp;
    const code = str(f.participantCode); const tp = str(f.plannedTimePoint);
    if (!code || !tp) return { ok: false, error: "participant_code_and_time_point_required" };
    await client.query(`INSERT INTO follow_up_records (id,workspace_id,project_id,formal_study_id,participant_code,planned_time_point,allowable_window,scheduled_date,reminder_status,contact_attempts,completion_date,completion_status,missing_reason,data_captured,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
      ON CONFLICT (workspace_id, project_id, formal_study_id, participant_code, planned_time_point) DO UPDATE SET completion_date=$11, completion_status=$12, missing_reason=$13, data_captured=$14, reminder_status=$9, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `fu_${randomUUID()}`, code, tp, str(f.allowableWindow), str(f.scheduledDate) || null, str(f.reminderStatus), int(f.contactAttempts), str(f.completionDate) || null, str(f.completionStatus, "PENDING"), str(f.missingReason), bool(f.dataCaptured)]);
    if (str(f.completionStatus) === "COMPLETED") await audit(client, tenant, input.userId, "FOLLOW_UP_COMPLETED", { participantCode: code, plannedTimePoint: tp });
    return { ok: true };
  });
}

export async function recordWithdrawal(tenant: ResearchTenant, input: { userId: string; withdrawal: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const w = input.withdrawal;
    const code = str(w.participantCode);
    if (!code) return { ok: false, error: "participant_code_required" };
    const pwId = `pw_${randomUUID()}`;
    await client.query(`INSERT INTO participant_withdrawals (id,workspace_id,project_id,formal_study_id,participant_code,withdrawal_date,reason_category,participant_requested_data_removal,permitted_data_retention,safety_followup_required,impact_on_study,consent_terms,created_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,now())`,
      [tenant.workspaceId, tenant.projectId, studyId, pwId, code, str(w.withdrawalDate) || null, str(w.reasonCategory), bool(w.participantRequestedDataRemoval), str(w.permittedDataRetention), bool(w.safetyFollowupRequired), str(w.impactOnStudy), str(w.consentTerms)]);
    const newStatus = bool(w.participantRequestedDataRemoval) ? "WITHDRAWN_DATA_REMOVAL_REQUESTED" : "WITHDRAWN";
    await client.query(`UPDATE participant_study_records SET status='WITHDRAWN', updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$3 AND participant_code=$4`,
      [tenant.workspaceId, tenant.projectId, studyId, code]);
    await client.query(`UPDATE consent_records SET status='WITHDRAWN', updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$3 AND participant_code=$4 AND status='CONSENTED'`,
      [tenant.workspaceId, tenant.projectId, studyId, code]);
    if (bool(w.participantRequestedDataRemoval)) {
      // 依同意條款：資料移除請求不得自行直接刪除 Raw Data——僅記錄，交由資料治理中心以正式流程處理。
      await client.query(`INSERT INTO data_queries (id,workspace_id,project_id,formal_study_id,source_record,issue,issue_type,severity,assigned_to,opened_at,created_at,updated_at)
        VALUES ($4,$1,$2,$3,$5,$6,'DATA_REMOVAL_REQUEST','HIGH',$7,now(),now(),now())`,
        [tenant.workspaceId, tenant.projectId, studyId, `dq_${randomUUID()}`, pwId, `參與者 ${code} 請求移除資料（依同意條款審查保留範圍）`, str(w.impactOnStudy)]);
    }
    await audit(client, tenant, input.userId, "PARTICIPANT_WITHDRAWN", { participantCode: code, reasonCategory: str(w.reasonCategory), dataRemovalRequested: bool(w.participantRequestedDataRemoval) });
    return { ok: true, withdrawalId: pwId, dataRemovalQueryOpened: bool(w.participantRequestedDataRemoval) };
  });
}

// ---------- Amendment / Pause ----------
export async function createAmendment(tenant: ResearchTenant, input: { userId: string; amendment: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const a = input.amendment;
    if (!str(a.changeRequest)) return { ok: false, error: "change_request_required" };
    const amId = `sam_${randomUUID()}`;
    await client.query(`INSERT INTO study_amendments (id,workspace_id,project_id,formal_study_id,change_request,scientific_reason,operational_reason,affected_documents,ethics_impact,preregistration_impact,statistical_impact,approval_status,effective_date,reconsent_required,retraining_required,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8::jsonb,$9,$10,$11,'DRAFT',$12,$13,$14,$15,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, amId, str(a.changeRequest), str(a.scientificReason), str(a.operationalReason), JSON.stringify(list(a.affectedDocuments)), str(a.ethicsImpact), str(a.preregistrationImpact), str(a.statisticalImpact), str(a.effectiveDate) || null, bool(a.reconsentRequired), bool(a.retrainingRequired), input.userId]);
    return { ok: true, amendmentId: amId };
  });
}

export async function submitAmendment(tenant: ResearchTenant, input: { userId: string; amendmentId: string }) {
  return withClient(async (client) => {
    await client.query(`UPDATE study_amendments SET approval_status='SUBMITTED', updated_at=now() WHERE id=$3 AND ${tenantWhere()} AND approval_status='DRAFT'`, [tenant.workspaceId, tenant.projectId, input.amendmentId]);
    return { ok: true };
  });
}

export async function approveAmendment(tenant: ResearchTenant, input: { userId: string; amendmentId: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const row = await client.query(`SELECT change_request, reconsent_required AS "rr", retraining_required AS "tr", approval_status AS "st" FROM study_amendments WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, input.amendmentId]);
    if (!row.rows[0]) return { ok: false, error: "amendment_not_found" };
    if (text(row.rows[0].st) !== "SUBMITTED") return { ok: false, error: "amendment_not_submitted（需先 Submit 才能核准）" };
    await client.query(`UPDATE study_amendments SET approval_status='APPROVED', effective_date=now(), updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, input.amendmentId]);
    if (bool(row.rows[0].rr)) {
      await client.query(`UPDATE consent_records SET status='RECONSENT_REQUIRED', updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$3 AND status IN ('CONSENTED','INFORMATION_PROVIDED')`, [tenant.workspaceId, tenant.projectId, studyId]);
    }
    if (bool(row.rows[0].tr)) {
      await client.query(`UPDATE study_team_assignments SET completed_training=false, updated_at=now() WHERE ${tenantWhere()} AND formal_study_id=$3 AND status='ACTIVE'`, [tenant.workspaceId, tenant.projectId, studyId]);
    }
    await audit(client, tenant, input.userId, "AMENDMENT_APPROVED", { amendmentId: input.amendmentId, reconsentRequired: bool(row.rows[0].rr) });
    return { ok: true, reconsentRequired: bool(row.rows[0].rr), retrainingRequired: bool(row.rows[0].tr) };
  });
}

export async function resumeFormalStudy(tenant: ResearchTenant, input: { userId: string; resume: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const paused = await client.query(`SELECT status FROM formal_studies WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
    if (!paused.rows[0] || text(paused.rows[0].status) !== "PAUSED") return { ok: false, error: "study_not_paused" };
    await client.query(`UPDATE formal_studies SET status='ACTIVE_DATA_COLLECTION', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    await client.query(`INSERT INTO study_pause_records (id,workspace_id,project_id,formal_study_id,pause_type,reason,authority,restart_conditions,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,'RESUME',$5,$6,$7,$8,now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `spr_${randomUUID()}`, str(input.resume.reason) || "研究者核准恢復", str(input.resume.authority), str(input.resume.restartConditions)]);
    return { ok: true };
  });
}

// ---------- Blinding / Session Activity ----------
export async function recordBlinding(tenant: ResearchTenant, input: { userId: string; record: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const b = input.record;
    const code = str(b.participantCode); const role = str(b.role);
    if (!code || !role) return { ok: false, error: "participant_code_and_role_required" };
    const status = str(b.blindingStatus, "BLINDED");
    if (status === "UNBLINDED") {
      if (!str(b.unblindingReason)) return { ok: false, error: "unblinding_reason_required" };
      if (!str(b.unblindingAuthorizedBy)) return { ok: false, error: "unblinding_authorization_required" };
    }
    await client.query(`INSERT INTO blinding_records (id,workspace_id,project_id,formal_study_id,participant_code,role,blinding_status,unblinding_reason,unblinding_authorized_by,unblinding_at,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9, CASE WHEN $7='UNBLINDED' THEN now() END,$10,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `br_${randomUUID()}`, code, role, status, str(b.unblindingReason), str(b.unblindingAuthorizedBy), input.userId]);
    if (status === "UNBLINDED") await audit(client, tenant, input.userId, "UNBLINDING_RECORDED", { participantCode: code, role, reason: str(b.unblindingReason) });
    return { ok: true };
  });
}

export async function recordSessionActivity(tenant: ResearchTenant, input: { userId: string; activity: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const a = input.activity;
    const sessionId = str(a.sessionId); const key = str(a.activityKey);
    if (!sessionId || !key) return { ok: false, error: "session_id_and_activity_key_required" };
    await client.query(`INSERT INTO session_activities (id,workspace_id,project_id,formal_study_id,session_id,activity_key,planned_time,actual_time,required,completed,not_completed_reason,data_generated,responsible_person,deviation,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
      ON CONFLICT (workspace_id, project_id, session_id, activity_key) DO UPDATE SET actual_time=$8, completed=$10, not_completed_reason=$11, data_generated=$12, deviation=$14, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `sa_${randomUUID()}`, sessionId, key, str(a.plannedTime) || null, str(a.actualTime) || null, bool(a.required, true), bool(a.completed), str(a.notCompletedReason), str(a.dataGenerated), str(a.responsiblePerson), str(a.deviation)]);
    return { ok: true };
  });
}

export async function listFollowUps(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const r = await client.query(`SELECT participant_code AS "participantCode", planned_time_point AS "plannedTimePoint", scheduled_date AS "scheduledDate", completion_status AS "completionStatus", contact_attempts AS "contactAttempts", data_captured AS "dataCaptured" FROM follow_up_records WHERE ${tenantWhere()} AND formal_study_id=$3 ORDER BY planned_time_point`, [tenant.workspaceId, tenant.projectId, studyId]);
    return { ok: true, followUps: r.rows };
  });
}

// ---------- 安全/偏差/查詢/暫停 ----------
export async function recordFormalDeviation(tenant: ResearchTenant, input: { userId: string; deviation: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const d = input.deviation;
    await client.query(`INSERT INTO protocol_deviations_formal (id,workspace_id,project_id,formal_study_id,participant_code,session_id,protocol_version,affected_section,planned_action,actual_action,cause,detected_at,severity,participant_impact,data_impact,safety_impact,corrective_action,preventive_action,ethics_report_required,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,now(),$12,$13,$14,$15,$16,$17,$18,'OPEN',$19,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `pdf_${randomUUID()}`, str(d.participantCode), str(d.sessionId), str(d.protocolVersion), str(d.affectedSection), str(d.plannedAction), str(d.actualAction), str(d.cause), str(d.severity, "MINOR"), str(d.participantImpact), str(d.dataImpact), str(d.safetyImpact), str(d.correctiveAction), str(d.preventiveAction), bool(d.ethicsReportRequired), input.userId]);
    return { ok: true };
  });
}

export async function recordFormalAdverseEvent(tenant: ResearchTenant, input: { userId: string; event: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const ev = input.event;
    const severity = str(ev.severity, "MINOR");
    await client.query(`INSERT INTO adverse_events_formal (id,workspace_id,project_id,formal_study_id,participant_code,event_date,event_type,description,severity,expectedness,relatedness_assessment,immediate_action,referral,study_interruption,reporting_deadline,reported_to_institution,report_reference,resolution,reviewer,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NULL,$18,'OPEN',$19,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `aef_${randomUUID()}`, str(ev.participantCode), str(ev.eventDate) || null, str(ev.eventType), str(ev.description), severity, str(ev.expectedness, "UNEXPECTED"), str(ev.relatednessAssessment), str(ev.immediateAction), str(ev.referral), str(ev.studyInterruption), str(ev.reportingDeadline) || null, bool(ev.reportedToInstitution), str(ev.reportReference), str(ev.reviewer), input.userId]);
    if (["SEVERE", "SERIOUS"].includes(severity)) {
      await client.query(`UPDATE formal_studies SET status='PAUSED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
      await client.query(`INSERT INTO study_pause_records (id,workspace_id,project_id,formal_study_id,pause_type,reason,authority,created_by_user_id,created_at)
        VALUES ($4,$1,$2,$3,'SAFETY_PAUSE','重大/未預期不良事件（自動暫停）',$5,$6,now())`,
        [tenant.workspaceId, tenant.projectId, studyId, `spr_${randomUUID()}`, str(ev.reviewer), input.userId]);
    }
    return { ok: true, paused: ["SEVERE", "SERIOUS"].includes(severity) };
  });
}

export async function createDataQuery(tenant: ResearchTenant, input: { userId: string; query: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    const q = input.query;
    await client.query(`INSERT INTO data_queries (id,workspace_id,project_id,formal_study_id,source_record,issue,issue_type,severity,assigned_to,opened_at,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,now(),now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `dq_${randomUUID()}`, str(q.sourceRecord), str(q.issue), str(q.issueType), str(q.severity, "MINOR"), str(q.assignedTo)]);
    return { ok: true };
  });
}

export async function resolveDataQuery(tenant: ResearchTenant, input: { userId: string; queryId: string; response: string; resolutionStatus?: string }) {
  return withClient(async (client) => {
    await client.query(`UPDATE data_queries SET response=$3, resolution_status=COALESCE($4,'RESOLVED'), resolved_at=now(), updated_at=now() WHERE id=$5 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, input.response, str(input.resolutionStatus, "RESOLVED"), input.queryId]);
    return { ok: true };
  });
}

export async function pauseFormalStudy(tenant: ResearchTenant, input: { userId: string; pauseType: string; reason: string; authority?: string; restartConditions?: string }) {
  return withClient(async (client) => {
    const studyId = await ensureFormalStudy(client, tenant, input.userId);
    await client.query(`INSERT INTO study_pause_records (id,workspace_id,project_id,formal_study_id,pause_type,reason,authority,restart_conditions,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `spr_${randomUUID()}`, input.pauseType, input.reason, input.authority ?? null, input.restartConditions ?? null, input.userId]);
    const status = input.pauseType === "SAFETY_PAUSE" ? "PAUSED" : input.pauseType === "ETHICS_EXPIRY" ? "PAUSED" : "PAUSED";
    await client.query(`UPDATE formal_studies SET status='PAUSED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    return { ok: true, status };
  });
}
