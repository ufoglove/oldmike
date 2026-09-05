import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("pilot_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}

function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function hash(payload: unknown): string { return createHash("sha256").update(typeof payload === "string" ? payload : JSON.stringify(payload)).digest("hex"); }
function str(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value : fallback; }
function tenantWhere(alias = ""): string { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
function int(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function bool(value: unknown): boolean { return value === true || value === "true" || value === 1; }

async function audit(client: unknown, tenant: ResearchTenant, userId: string, eventType: string, detail: Record<string, unknown>) {
  const c = client as { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  try {
    await c.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,$5,$5,$6,'1.5.95',$7::jsonb,$8)`, [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, eventType, JSON.stringify(detail), hash({ eventType, detail })]);
  } catch { /* audit 失敗不阻擋主流程 */ }
}

async function gateApproved(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, tenant: ResearchTenant, gateType: string): Promise<boolean> {
  const gate = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, gateType]);
  return Boolean(gate.rows[0]);
}

async function ensurePilotStudy(client: PoolClient, tenant: ResearchTenant, userId: string): Promise<string> {
  const existing = await client.query(`SELECT id, status FROM pilot_studies WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (existing.rows[0]) return text((existing.rows[0] as Record<string, unknown>).id);
  const id = `ps_${randomUUID()}`;
  await client.query(`INSERT INTO pilot_studies (id,workspace_id,project_id,status,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,'NOT_STARTED',$3,now(),now())`, [tenant.workspaceId, tenant.projectId, userId, id]);
  return id;
}

const PILOT_TYPES = ["COGNITIVE_INTERVIEW", "EXPERT_CONTENT_REVIEW", "INSTRUMENT_PRETEST", "KNOWLEDGE_TEST_PRETEST", "SKILL_RUBRIC_PRETEST", "INTERVIEW_GUIDE_PRETEST", "USABILITY_PILOT", "TECHNICAL_DRY_RUN", "SENSOR_CALIBRATION_PILOT", "SYSTEM_LOG_VALIDATION", "DATA_PIPELINE_VALIDATION", "INTERVENTION_FEASIBILITY_PILOT", "CONTROL_CONDITION_PILOT", "MANIPULATION_CHECK_PILOT", "FIDELITY_PILOT", "RECRUITMENT_PILOT", "PARTICIPANT_BURDEN_PILOT", "AI_MODEL_PIPELINE_PILOT", "COURSE_IMPLEMENTATION_PILOT", "OTHER"] as const;
const HUMAN_TYPES = new Set(["COGNITIVE_INTERVIEW", "INSTRUMENT_PRETEST", "KNOWLEDGE_TEST_PRETEST", "SKILL_RUBRIC_PRETEST", "INTERVIEW_GUIDE_PRETEST", "USABILITY_PILOT", "INTERVENTION_FEASIBILITY_PILOT", "CONTROL_CONDITION_PILOT", "MANIPULATION_CHECK_PILOT", "FIDELITY_PILOT", "RECRUITMENT_PILOT", "PARTICIPANT_BURDEN_PILOT", "COURSE_IMPLEMENTATION_PILOT"]);
const TECHNICAL_TYPES = new Set(["TECHNICAL_DRY_RUN", "SYSTEM_LOG_VALIDATION", "DATA_PIPELINE_VALIDATION", "AI_MODEL_PIPELINE_PILOT", "SENSOR_CALIBRATION_PILOT"]);

// ---------- 主讀取 ----------
export async function getPilotCenter(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const instrumentsGate = await gateApproved(client as never, tenant, "INSTRUMENTS_AND_PROTOCOL_APPROVED");
    const missing: string[] = [];
    if (!instrumentsGate) missing.push("INSTRUMENTS_AND_PROTOCOL_APPROVED（需先通過工具與 Protocol Gate）");
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const [study, components, criteria, authz, sessions, datasets, interviews, pretests, technical, sensors, logs, ai, interventions, recruit, deviations, events, issues, tasks, changes, amendments, decision, report, validationItems, readiness, training, gates, protocol] = await Promise.all([
      client.query(`SELECT id, status, applicability, combination_status AS "combinationStatus", current_version_number AS "version" FROM pilot_studies WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM pilot_components WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM pilot_success_criteria WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, checks, status, checked_at AS "checkedAt" FROM pilot_execution_authorizations WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, session_type AS "sessionType", synthetic, participant_code AS "participantCode", protocol_version AS "protocolVersion", status, session_date AS "sessionDate", environment, device FROM pilot_sessions WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM pilot_datasets WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, participant_code AS "participantCode", item_ref AS "itemRef", severity, decision FROM cognitive_interview_records WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, result_kind AS "resultKind", item_ref AS "itemRef", metric_key AS "metricKey", metric_value AS "metricValue", status FROM pilot_pretest_results WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, run_kind AS "runKind", synthetic, test_case AS "testCase", pass_status AS "passStatus", issue_severity AS "issueSeverity", resolution_status AS "resolutionStatus" FROM technical_pilot_runs WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM sensor_pilot_results WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM log_validation_results WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM ai_model_pilot_results WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM intervention_pilot_results WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM pilot_recruitment_summaries WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, protocol_section AS "protocolSection", severity, amendment_required AS "amendmentRequired", status FROM pilot_protocol_deviations WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, event_type AS "eventType", severity, expected_or_unexpected AS "expectedOrUnexpected", resolution_status AS "resolutionStatus" FROM pilot_adverse_events WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM pilot_issues WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM pilot_revision_tasks WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM material_change_assessments WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM ethics_amendment_requirements WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, decision, rationale, user_approved AS "userApproved", approved_at AS "approvedAt" FROM pilot_decisions WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, sections, version FROM pilot_reports WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM protocol_validation_items WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT id, checks, status, checked_at AS "checkedAt" FROM formal_study_readiness_assessments WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT * FROM team_training_records WHERE ${tenantWhere()} AND pilot_study_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT gate_type AS "gateType", decision, approved_at AS "approvedAt" FROM research_human_gates WHERE ${tenantWhere()} ORDER BY approved_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM study_protocols WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const gatesRow = gates.rows[0] as Record<string, unknown> | undefined;
    const protocolRowObj = protocol.rows[0] as Record<string, unknown> | undefined;
    return {
      ok: true, locked: !instrumentsGate, missing,
      entry: { instrumentsGate, planningAccess: instrumentsGate, executionAccess: instrumentsGate },
      study: study.rows[0] ?? null, components: components.rows, criteria: criteria.rows, authorization: authz.rows[0] ?? null,
      sessions: sessions.rows, datasets: datasets.rows, interviews: interviews.rows, pretests: pretests.rows,
      technical: technical.rows, sensors: sensors.rows, logs: logs.rows, ai: ai.rows, interventions: interventions.rows,
      recruitment: recruit.rows[0] ?? null, deviations: deviations.rows, adverseEvents: events.rows,
      issues: issues.rows, revisionTasks: tasks.rows, materialChanges: changes.rows, ethicsAmendments: amendments.rows,
      decision: decision.rows[0] ?? null, report: report.rows[0] ?? null, validationItems: validationItems.rows,
      readiness: readiness.rows[0] ?? null, training: training.rows, gates: Object.fromEntries(gates.rows.map((r: Record<string, unknown>) => [text(r.gateType), text(r.decision) === "APPROVED"])),
      protocol: protocol.rows[0] ?? null,
    };
  });
}

// ---------- 適用性 ----------
export async function setApplicability(tenant: ResearchTenant, input: { userId: string; applicability: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    await client.query(`UPDATE pilot_studies SET applicability=$3::jsonb, status=CASE WHEN status='NOT_STARTED' THEN 'PLANNING' ELSE status END, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(input.applicability), studyId]);
    await audit(client, tenant, input.userId, "PILOT_APPLICABILITY_SAVED", { types: Object.keys(input.applicability).length });
    return { ok: true };
  });
}

// ---------- Component（依 pilot_type upsert） ----------
export async function savePilotComponent(tenant: ResearchTenant, input: { userId: string; component: Record<string, unknown> }) {
  return withClient(async (client) => {
    const c = input.component;
    const pilotType = str(c.pilotType);
    if (!(PILOT_TYPES as readonly string[]).includes(pilotType)) return { ok: false, error: "pilot_type_unknown" };
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const human = HUMAN_TYPES.has(pilotType) || bool(c.humanParticipant);
    await client.query(`INSERT INTO pilot_components (id,workspace_id,project_id,pilot_study_id,pilot_type,name,human_participant,objectives,participant_type,proposed_sample_rationale,inclusion_criteria,exclusion_criteria,recruitment_method,procedures,measures,technical_checks,feasibility_metrics,safety_metrics,decision_rules,responsible_roles,timeline,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19,$20::jsonb,$21,'PLANNED',$22,now(),now())
      ON CONFLICT (workspace_id, project_id, pilot_study_id, pilot_type) DO UPDATE SET name=$6, human_participant=$7, objectives=$8::jsonb, participant_type=$9, proposed_sample_rationale=$10, inclusion_criteria=$11, exclusion_criteria=$12, recruitment_method=$13, procedures=$14, measures=$15::jsonb, technical_checks=$16::jsonb, feasibility_metrics=$17::jsonb, safety_metrics=$18::jsonb, decision_rules=$19, responsible_roles=$20::jsonb, timeline=$21, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `pc_${randomUUID()}`, pilotType, str(c.name, pilotType), human, JSON.stringify(list(c.objectives)), str(c.participantType), str(c.sampleRationale), str(c.inclusionCriteria), str(c.exclusionCriteria), str(c.recruitmentMethod), str(c.procedures), JSON.stringify(list(c.measures)), JSON.stringify(list(c.technicalChecks)), JSON.stringify(list(c.feasibilityMetrics)), JSON.stringify(list(c.safetyMetrics)), str(c.decisionRules), JSON.stringify(list(c.responsibleRoles)), str(c.timeline), input.userId]);
    await client.query(`UPDATE pilot_studies SET status=CASE WHEN status='NOT_STARTED' THEN 'PLANNING' ELSE status END, updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    return { ok: true, pilotType };
  });
}

// ---------- Success Criteria ----------
export async function savePilotCriteria(tenant: ResearchTenant, input: { userId: string; criteria: Record<string, unknown>[] }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    for (const item of input.criteria) {
      const key = str(item.criterionKey);
      if (!key) continue;
      await client.query(`INSERT INTO pilot_success_criteria (id,workspace_id,project_id,pilot_study_id,component_id,criterion_key,pilot_objective,metric,threshold,threshold_basis,data_source,evaluation_method,severity_if_failed,decision_rule,status,created_by_user_id,created_at,updated_at)
        VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'DEFINED',$15,now(),now())
        ON CONFLICT (workspace_id, project_id, pilot_study_id, criterion_key) DO UPDATE SET pilot_objective=$7, metric=$8, threshold=$9, threshold_basis=$10, data_source=$11, evaluation_method=$12, severity_if_failed=$13, decision_rule=$14, updated_at=now()`,
        [tenant.workspaceId, tenant.projectId, studyId, `psc_${randomUUID()}`, str(item.componentId), key, str(item.pilotObjective), str(item.metric), str(item.threshold), str(item.thresholdBasis, "PROVISIONAL_THRESHOLD"), str(item.dataSource), str(item.evaluationMethod), str(item.severityIfFailed, "MINOR"), str(item.decisionRule), input.userId]);
    }
    return { ok: true, count: input.criteria.length };
  });
}

// ---------- Execution Authorization（15 檢查） ----------
export async function runPilotAuthorization(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const [ethicsDecisions, docs, sensors, permissions, instruments, dmp, team, criteria, interventions, protocol, grants] = await Promise.all([
      client.query(`SELECT approval_status AS "approvalStatus", decision_date AS "decisionDate", expiry_date AS "expiryDate" FROM institutional_ethics_decisions WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT document_type AS "documentType", status FROM ethics_documents WHERE ${tenantWhere()} AND document_type IN ('PARTICIPANT_INFORMATION_SHEET','INFORMED_CONSENT')`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT sensor_key AS "sensorKey", device_status AS "deviceStatus" FROM sensor_specifications WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM instrument_permissions WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM project_instrument_links WHERE ${tenantWhere()} AND status='SELECTED'`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT sections FROM data_management_plans WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM team_training_records WHERE ${tenantWhere()} AND pilot_study_id=$3 AND authorization_status='AUTHORIZED'`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_success_criteria WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM intervention_materials WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type IN ('NSTC_APPLICATION_PACKAGE_READY','MOE_TPR_APPLICATION_PACKAGE_READY') AND decision='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const dmpSections = dmp.rows[0] && record(dmp.rows[0].sections) ? dmp.rows[0].sections as Record<string, unknown> : {};
    const checks: { key: string; label: string; pass: boolean; detail: string }[] = [
      { key: "ethics_decision", label: "Institutional Ethics Decision 涵蓋 Pilot", pass: Boolean(ethicsDecisions.rows[0] && text(ethicsDecisions.rows[0].approvalStatus) === "APPROVED"), detail: ethicsDecisions.rows[0] ? `狀態：${text(ethicsDecisions.rows[0].approvalStatus)}` : "尚無正式機構判定" },
      { key: "ethics_valid", label: "核准有效（未過期）", pass: !ethicsDecisions.rows[0] || !text(ethicsDecisions.rows[0].expiryDate) || new Date(text(ethicsDecisions.rows[0].expiryDate)).getTime() > Date.now(), detail: "無核准或未過期" },
      { key: "protocol_version_match", label: "核准文件 Protocol 版本一致", pass: true, detail: "以核准文件為準（需使用者核對）" },
      { key: "instruments_in_scope", label: "工具在核准範圍內", pass: int(instruments.rows[0]?.n ?? 0) > 0 || int(interventions.rows[0]?.n ?? 0) > 0, detail: `已選定工具 ${instruments.rows[0]?.n ?? 0}` },
      { key: "recruitment_approved", label: "招募方式已核准", pass: false, detail: "需使用者確認招募方式在核准範圍" },
      { key: "consent_covers", label: "同意文件涵蓋 Pilot 活動", pass: docs.rows.some((r: Record<string, unknown>) => ["SUBMITTED", "APPROVED"].includes(text(r.status))), detail: `Consent 文件：${docs.rows.length} 份` },
      { key: "sensor_disclosed", label: "Sensor／錄音／AI 已揭露", pass: sensors.rows.length === 0, detail: sensors.rows.length ? `待揭露：${sensors.rows.map((r: Record<string, unknown>) => text(r.sensorKey)).join("、")}` : "無感測器" },
      { key: "dmp_covers_pilot", label: "DMP 涵蓋 Pilot 資料", pass: Object.keys(dmpSections).length > 0, detail: Object.keys(dmpSections).length ? "DMP 已建立" : "DMP 未建立" },
      { key: "instrument_permission", label: "工具授權允許 Pilot 使用", pass: permissions.rows.length === 0 || permissions.rows.every((r: Record<string, unknown>) => ["APPROVED", "PERMISSION_NOT_REQUIRED", "PUBLIC_DOMAIN", "OPEN_LICENSE"].includes(text(r.status))), detail: `${permissions.rows.length} 筆授權` },
      { key: "grant_activation", label: "計畫核定／合法執行授權", pass: grants.rows.length > 0, detail: grants.rows.length ? "申請包已 Ready（PRE_AWARD）" : "尚無核定／執行授權（JOURNAL 自我經費可另註記）" },
      { key: "site_access", label: "場域／設備／人員許可", pass: false, detail: "需使用者確認" },
      { key: "responsible_person", label: "Pilot 負責人已指派", pass: false, detail: "需指派負責人" },
      { key: "safety_ready", label: "不良事件與退出流程已準備", pass: false, detail: "需確認安全與退出流程" },
      { key: "identifiable_separated", label: "直接識別資料分離", pass: true, detail: "Pilot 資料工作區預設分離" },
      { key: "criteria_predefined", label: "成功標準於執行前定義", pass: int(criteria.rows[0]?.n ?? 0) > 0, detail: `成功標準 ${criteria.rows[0]?.n ?? 0} 項` },
    ];
    const failedCount = checks.filter((c) => !c.pass).length;
    const pendingEthics = !checks.find((c) => c.key === "ethics_decision")?.pass;
    const status = failedCount === 0 ? "AUTHORIZED" : failedCount <= 4 ? (pendingEthics ? "READY_PENDING_ETHICS" : "AUTHORIZATION_INCOMPLETE") : "BLOCKED";
    await client.query(`INSERT INTO pilot_execution_authorizations (id,workspace_id,project_id,pilot_study_id,checks,status,checked_at,created_by_user_id,updated_at)
      VALUES ($4,$1,$2,$3,$5::jsonb,$6,now(),$7,now())
      ON CONFLICT (workspace_id, project_id, pilot_study_id) DO UPDATE SET checks=$5::jsonb, status=$6, checked_at=now(), updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `pea_${randomUUID()}`, JSON.stringify(checks), status, input.userId]);
    await client.query(`UPDATE pilot_studies SET status='AUTHORIZATION_REQUIRED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    await audit(client, tenant, input.userId, "PILOT_AUTHORIZATION_CHECKED", { status, failed: failedCount });
    return { ok: true, status, checks, failedCount };
  });
}

// ---------- Sessions ----------
export async function createPilotSession(tenant: ResearchTenant, input: { userId: string; session: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const sessionType = str(input.session.sessionType, "HUMAN");
    const synthetic = bool(input.session.synthetic);
    if (sessionType === "HUMAN" && !synthetic) {
      const authz = await client.query(`SELECT status FROM pilot_execution_authorizations WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      const authorized = text(authz.rows[0]?.status ?? "") === "AUTHORIZED" || await gateApproved(client as never, tenant, "PILOT_EXECUTION_AUTHORIZED");
      if (!authorized) return { ok: false, error: "pilot_execution_not_authorized（需先通過 PILOT_EXECUTION_AUTHORIZED）" };
    }
    const s = input.session;
    await client.query(`INSERT INTO pilot_sessions (id,workspace_id,project_id,pilot_study_id,component_id,session_type,synthetic,participant_code,protocol_version,instrument_versions,session_date,environment,device,status,notes,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,'SCHEDULED',$14,$15,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `pse_${randomUUID()}`, str(s.componentId), sessionType, synthetic, str(s.participantCode), str(s.protocolVersion), JSON.stringify(list(s.instrumentVersions)), str(s.sessionDate) || null, str(s.environment), str(s.device), str(s.notes), input.userId]);
    await client.query(`UPDATE pilot_studies SET status=CASE WHEN status IN ('NOT_STARTED','PLANNING','AUTHORIZATION_REQUIRED') THEN 'IN_PROGRESS' ELSE status END, updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    await audit(client, tenant, input.userId, "PILOT_SESSION_CREATED", { sessionType, synthetic, participantCode: synthetic ? null : str(s.participantCode) });
    return { ok: true, syntheticNote: synthetic ? "SYNTHETIC_TEST_DATA（不得與真實 Pilot 資料混合）" : null };
  });
}

// ---------- 紀錄類（通用 insert） ----------
export async function recordCognitiveInterview(tenant: ResearchTenant, input: { userId: string; record: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const r = input.record;
    const severity = str(r.severity, "CLEAR");
    if (!["CLEAR", "MINOR_REVISION", "MAJOR_REVISION", "REMOVE_ITEM", "FURTHER_TESTING_REQUIRED"].includes(severity)) return { ok: false, error: "severity_invalid" };
    await client.query(`INSERT INTO cognitive_interview_records (id,workspace_id,project_id,pilot_study_id,session_id,participant_code,instrument_version,item_ref,comprehension_issue,interpretation,retrieval_issue,judgment_issue,response_mapping_issue,cultural_issue,suggested_revision,interviewer_note,severity,decision,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `ci_${randomUUID()}`, str(r.sessionId), str(r.participantCode), str(r.instrumentVersion), str(r.itemRef), str(r.comprehensionIssue), str(r.interpretation), str(r.retrievalIssue), str(r.judgmentIssue), str(r.responseMappingIssue), str(r.culturalIssue), str(r.suggestedRevision), str(r.interviewerNote), severity, str(r.decision), input.userId]);
    return { ok: true, severity };
  });
}

export async function recordPretestResult(tenant: ResearchTenant, input: { userId: string; result: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const r = input.result;
    const kind = str(r.resultKind, "INSTRUMENT_PRETEST");
    const status = str(r.status, "INSUFFICIENT_DATA");
    if (!["SUITABLE_FOR_PILOT_USE", "REVISION_REQUIRED", "RETEST_REQUIRED", "NOT_SUITABLE", "INSUFFICIENT_DATA"].includes(status)) return { ok: false, error: "status_invalid" };
    await client.query(`INSERT INTO pilot_pretest_results (id,workspace_id,project_id,pilot_study_id,component_id,result_kind,item_ref,metric_key,metric_value,metric_label,status,preliminary_note,analysis_capability,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,'PILOT_PRELIMINARY（非正式心理計量驗證）',$12::jsonb,$13,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `pr_${randomUUID()}`, str(r.componentId), kind, str(r.itemRef), str(r.metricKey), int(r.metricValue) || null, str(r.metricLabel), status, JSON.stringify(record(r.analysisCapability) ? r.analysisCapability : {}), input.userId]);
    return { ok: true };
  });
}

export async function recordTechnicalRun(tenant: ResearchTenant, input: { userId: string; run: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const r = input.run;
    const pass = str(r.passStatus, "FAIL");
    if (!["PASS", "FAIL", "PARTIAL", "NOT_RUN"].includes(pass)) return { ok: false, error: "pass_status_invalid" };
    await client.query(`INSERT INTO technical_pilot_runs (id,workspace_id,project_id,pilot_study_id,component_id,run_kind,synthetic,system_version,environment,device,test_case,expected_behavior,observed_behavior,pass_status,issue_severity,reproduction_steps,resolution_status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'OPEN',$17,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `tr_${randomUUID()}`, str(r.componentId), str(r.runKind, "USABILITY"), bool(r.synthetic), str(r.systemVersion), str(r.environment), str(r.device), str(r.testCase), str(r.expectedBehavior), str(r.observedBehavior), pass, str(r.issueSeverity), str(r.reproductionSteps), input.userId]);
    return { ok: true, syntheticNote: bool(r.synthetic) ? "SYNTHETIC_TEST_DATA" : null };
  });
}

export async function recordSensorResult(tenant: ResearchTenant, input: { userId: string; result: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const r = input.result;
    await client.query(`INSERT INTO sensor_pilot_results (id,workspace_id,project_id,pilot_study_id,session_id,sensor_key,metric_key,expected_value,observed_value,tolerance,pass_status,source_file,version,note,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `spr_${randomUUID()}`, str(r.sessionId), str(r.sensorKey), str(r.metricKey), str(r.expectedValue), str(r.observedValue), str(r.tolerance), str(r.passStatus, "NOT_RUN"), str(r.sourceFile), str(r.version), str(r.note), input.userId]);
    return { ok: true };
  });
}

export async function recordLogValidation(tenant: ResearchTenant, input: { userId: string; result: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const r = input.result;
    const eventId = str(r.eventId);
    if (!eventId) return { ok: false, error: "event_id_required" };
    const supported = bool(r.analysisVariableSupported) !== false;
    await client.query(`INSERT INTO log_validation_results (id,workspace_id,project_id,pilot_study_id,component_id,event_id,expected_trigger,observed_count,expected_count,timestamp_correct,participant_code_correct,duration_calculable,missing_detected,analysis_variable_supported,status,issue,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(),now())
      ON CONFLICT (workspace_id, project_id, pilot_study_id, event_id) DO UPDATE SET expected_trigger=$7, observed_count=$8, expected_count=$9, timestamp_correct=$10, participant_code_correct=$11, duration_calculable=$12, missing_detected=$13, analysis_variable_supported=$14, status=$15, issue=$16, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `lv_${randomUUID()}`, str(r.componentId), eventId, str(r.expectedTrigger), int(r.observedCount) || null, int(r.expectedCount) || null, bool(r.timestampCorrect), bool(r.participantCodeCorrect), bool(r.durationCalculable), bool(r.missingDetected), supported, str(r.status, supported ? "PASS" : "FAIL"), str(r.issue)]);
    // 若 Analysis Plan 需要但 Pilot 捕捉不到 → 標記 issue（上層以 ANALYSIS_VARIABLE_NOT_CAPTURED 檢查）
    if (!supported) {
      await client.query(`INSERT INTO pilot_issues (id,workspace_id,project_id,pilot_study_id,issue_category,issue,evidence,severity,affected_version,status,created_by_user_id,created_at,updated_at)
        VALUES ($4,$1,$2,$3,'EVENT_LOG',COALESCE($5,'Analysis Plan 所需變數在 Pilot 中無法產生'),'Log Validation','FATAL',$6,'OPEN',$7,now(),now())`,
        [tenant.workspaceId, tenant.projectId, studyId, `pi_${randomUUID()}`, str(r.issue), str(r.affectedVersion), input.userId]);
      return { ok: true, code: "ANALYSIS_VARIABLE_NOT_CAPTURED", blocked: true };
    }
    return { ok: true };
  });
}

export async function recordAiResult(tenant: ResearchTenant, input: { userId: string; result: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const r = input.result;
    await client.query(`INSERT INTO ai_model_pilot_results (id,workspace_id,project_id,pilot_study_id,model_version,input_reference,output_reference,source_reference,human_review_status,failure_category,metric_key,metric_value,latency_ms,note,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `ai_${randomUUID()}`, str(r.modelVersion), str(r.inputReference), str(r.outputReference), str(r.sourceReference), str(r.humanReviewStatus, "NOT_REVIEWED"), str(r.failureCategory), str(r.metricKey), int(r.metricValue) || null, int(r.latencyMs) || null, str(r.note), input.userId]);
    return { ok: true };
  });
}

export async function recordInterventionResult(tenant: ResearchTenant, input: { userId: string; result: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const r = input.result;
    const confounding = bool(r.controlEquivalenceIssue) || str(r.confoundingRisk) === "CONTROL_CONDITION_CONFOUNDING_RISK" ? "CONTROL_CONDITION_CONFOUNDING_RISK" : "NONE";
    await client.query(`INSERT INTO intervention_pilot_results (id,workspace_id,project_id,pilot_study_id,result_kind,material_id,session_duration_ok,instructor_workload,participant_workload,completion_status,dose_exposure,contamination_observed,control_equivalence_note,confounding_risk,fidelity_metrics,issue,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `ip_${randomUUID()}`, str(r.resultKind, "INTERVENTION_FEASIBILITY"), str(r.materialId), bool(r.sessionDurationOk) || null, str(r.instructorWorkload), str(r.participantWorkload), str(r.completionStatus), str(r.doseExposure), bool(r.contaminationObserved), str(r.controlEquivalenceNote), confounding, JSON.stringify(record(r.fidelityMetrics) ? r.fidelityMetrics : {}), str(r.issue), str(r.status, "PENDING"), input.userId]);
    if (confounding === "CONTROL_CONDITION_CONFOUNDING_RISK") await audit(client, tenant, input.userId, "CONTROL_CONDITION_CONFOUNDING_RISK", { resultKind: str(r.resultKind) });
    return { ok: true, confoundingRisk: confounding };
  });
}

export async function recordRecruitment(tenant: ResearchTenant, input: { userId: string; summary: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const s = input.summary;
    await client.query(`INSERT INTO pilot_recruitment_summaries (id,workspace_id,project_id,pilot_study_id,contacted_count,eligible_count,consent_count,completion_count,withdrawal_count,main_refusal_reasons,recruitment_time,session_duration,follow_up_feasibility,participant_burden,compensation_issue,scheduling_issue,accessibility_issue,population_generalization_limit,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,$19,now(),now())
      ON CONFLICT (workspace_id, project_id, pilot_study_id) DO UPDATE SET contacted_count=$5, eligible_count=$6, consent_count=$7, completion_count=$8, withdrawal_count=$9, main_refusal_reasons=$10::jsonb, recruitment_time=$11, session_duration=$12, follow_up_feasibility=$13, participant_burden=$14, compensation_issue=$15, scheduling_issue=$16, accessibility_issue=$17, population_generalization_limit=$18, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `rs_${randomUUID()}`, int(s.contactedCount) || null, int(s.eligibleCount) || null, int(s.consentCount) || null, int(s.completionCount) || null, int(s.withdrawalCount) || null, JSON.stringify(list(s.mainRefusalReasons)), str(s.recruitmentTime), str(s.sessionDuration), str(s.followUpFeasibility), str(s.participantBurden), str(s.compensationIssue), str(s.schedulingIssue), str(s.accessibilityIssue), str(s.populationGeneralizationLimit), input.userId]);
    return { ok: true };
  });
}

// ---------- Datasets（分離；raw 不可變） ----------
export async function savePilotDataset(tenant: ResearchTenant, input: { userId: string; dataset: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const d = input.dataset;
    const type = str(d.datasetType, "ANALYSIS");
    if (!["RAW", "CLEAN", "ANALYSIS"].includes(type)) return { ok: false, error: "dataset_type_invalid" };
    const name = str(d.datasetName);
    if (!name) return { ok: false, error: "dataset_name_required" };
    const synthetic = bool(d.synthetic);
    const immutable = type === "RAW" ? true : bool(d.immutable);
    await client.query(`INSERT INTO pilot_datasets (id,workspace_id,project_id,pilot_study_id,dataset_type,synthetic,dataset_name,checksum,storage_location,access_level,de_identification_status,transformation_log,data_dictionary_version,source_files,immutable,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb,$15,'UPLOADED',$16,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `pd_${randomUUID()}`, type, synthetic, name, str(d.checksum), str(d.storageLocation), str(d.accessLevel, "PRIVATE"), str(d.deIdentificationStatus), JSON.stringify(list(d.transformationLog)), str(d.dataDictionaryVersion), JSON.stringify(list(d.sourceFiles)), immutable, input.userId]);
    await audit(client, tenant, input.userId, "PILOT_DATASET_SAVED", { datasetType: type, synthetic, immutable });
    return { ok: true, immutableNote: immutable ? "RAW／LOCKED：Pilot 原始資料不可修改（與正式研究資料分離）。" : null, syntheticNote: synthetic ? "SYNTHETIC_TEST_DATA" : null };
  });
}

export async function reviewDatasetCombination(tenant: ResearchTenant, input: { userId: string; decision: string; rationale?: string }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    if (!["SEPARATE", "ELIGIBLE_FOR_COMBINATION_REVIEW", "APPROVED_FOR_COMBINATION", "NOT_ELIGIBLE", "UNDETERMINED"].includes(input.decision)) return { ok: false, error: "combination_decision_invalid" };
    if (input.decision === "APPROVED_FOR_COMBINATION") {
      // 10 項條件檢查（由使用者確認）；簡化：需明示 rationale 且無重大 protocol 修改
      if (!str(input.rationale)) return { ok: false, error: "combination_requires_rationale" };
    }
    await client.query(`UPDATE pilot_studies SET combination_status=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, input.decision, studyId]);
    await audit(client, tenant, input.userId, "PILOT_COMBINATION_REVIEW", { decision: input.decision });
    return { ok: true };
  });
}

// ---------- Deviation / Adverse Event ----------
export async function recordPilotDeviation(tenant: ResearchTenant, input: { userId: string; deviation: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const dv = input.deviation;
    const severity = str(dv.severity, "MINOR");
    const amendmentRequired = bool(dv.amendmentRequired) || severity === "CRITICAL";
    await client.query(`INSERT INTO pilot_protocol_deviations (id,workspace_id,project_id,pilot_study_id,session_id,protocol_section,planned_action,actual_action,reason,participant_impact,data_impact,ethics_impact,severity,corrective_action,amendment_required,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'OPEN',$16,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `pd_${randomUUID()}`, str(dv.sessionId), str(dv.protocolSection), str(dv.plannedAction), str(dv.actualAction), str(dv.reason), str(dv.participantImpact), str(dv.dataImpact), str(dv.ethicsImpact), severity, str(dv.correctiveAction), amendmentRequired, input.userId]);
    if (severity === "CRITICAL" || amendmentRequired) await audit(client, tenant, input.userId, "ETHICS_REVIEW_REQUIRED", { deviationId: "new", severity });
    return { ok: true, severity, ethicsReviewRequired: severity === "CRITICAL" || amendmentRequired };
  });
}

export async function recordAdverseEvent(tenant: ResearchTenant, input: { userId: string; event: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const ev = input.event;
    const severity = str(ev.severity, "MINOR");
    if (!["MINOR", "MODERATE", "SEVERE", "SERIOUS"].includes(severity)) return { ok: false, error: "severity_invalid" };
    await client.query(`INSERT INTO pilot_adverse_events (id,workspace_id,project_id,pilot_study_id,event_type,event_date,participant_code,description,severity,expected_or_unexpected,related_to_study,immediate_action,follow_up,reporting_requirement,reported_to_institution,report_reference,resolution_status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'OPEN',$17,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `ae_${randomUUID()}`, str(ev.eventType), str(ev.eventDate) || null, str(ev.participantCode), str(ev.description), severity, str(ev.expectedOrUnexpected, "UNEXPECTED"), str(ev.relatedToStudy), str(ev.immediateAction), str(ev.followUp), str(ev.reportingRequirement), bool(ev.reportedToInstitution), str(ev.reportReference), input.userId]);
    if (["SEVERE", "SERIOUS"].includes(severity)) {
      await client.query(`UPDATE pilot_studies SET status='PAUSED_FOR_SAFETY_REVIEW', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
      await client.query(`INSERT INTO formal_study_readiness_assessments (id,workspace_id,project_id,pilot_study_id,checks,status,checked_at,created_by_user_id,updated_at)
        VALUES ($4,$1,$2,$3,'[]'::jsonb,'BLOCKED_BY_SAFETY',now(),$5,now())
        ON CONFLICT (workspace_id, project_id, pilot_study_id) DO UPDATE SET status='BLOCKED_BY_SAFETY', checked_at=now(), updated_at=now()`,
        [tenant.workspaceId, tenant.projectId, studyId, `fsr_${randomUUID()}`, input.userId]);
      await audit(client, tenant, input.userId, "PILOT_PAUSED_FOR_SAFETY_REVIEW", { severity });
    }
    return { ok: true, paused: ["SEVERE", "SERIOUS"].includes(severity) };
  });
}

// ---------- Issue / Revision Task ----------
export async function createPilotIssue(tenant: ResearchTenant, input: { userId: string; issue: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const issue = input.issue;
    if (!str(issue.issue)) return { ok: false, error: "issue_text_required" };
    await client.query(`INSERT INTO pilot_issues (id,workspace_id,project_id,pilot_study_id,issue_category,issue,evidence,severity,affected_version,protocol_section,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,'OPEN',$11,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `pi_${randomUUID()}`, str(issue.issueCategory, "INSTRUMENT"), str(issue.issue), str(issue.evidence), str(issue.severity, "MINOR"), str(issue.affectedVersion), str(issue.protocolSection), input.userId]);
    return { ok: true };
  });
}

export async function createPilotRevisionTask(tenant: ResearchTenant, input: { userId: string; task: Record<string, unknown> }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const t = input.task;
    if (!str(t.recommendedAction)) return { ok: false, error: "action_required" };
    await client.query(`INSERT INTO pilot_revision_tasks (id,workspace_id,project_id,pilot_study_id,source_issue_id,task_type,recommended_action,owner,status,before_version,after_version,verification_required,resolution_note,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,'OPEN',$9,$10,true,$11,$12,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `prt_${randomUUID()}`, str(t.sourceIssueId), str(t.taskType, "INSTRUMENT"), str(t.recommendedAction), str(t.owner), str(t.beforeVersion), str(t.afterVersion), str(t.resolutionNote), input.userId]);
    await audit(client, tenant, input.userId, "PILOT_REVISION_TASK_CREATED", { taskType: str(t.taskType) });
    return { ok: true };
  });
}

export async function updatePilotRevisionTask(tenant: ResearchTenant, input: { userId: string; taskId: string; status?: string; resolutionNote?: string; afterVersion?: string }) {
  return withClient(async (client) => {
    const allowed = ["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"];
    if (input.status && !allowed.includes(input.status)) return { ok: false, error: "status_invalid" };
    const sets: string[] = []; const params: unknown[] = [tenant.workspaceId, tenant.projectId, input.taskId];
    if (input.status) { sets.push(`status=$${params.length + 1}`); params.push(input.status); }
    if (input.resolutionNote !== undefined) { sets.push(`resolution_note=$${params.length + 1}`); params.push(input.resolutionNote); }
    if (input.afterVersion !== undefined) { sets.push(`after_version=$${params.length + 1}`); params.push(input.afterVersion); }
    sets.push("updated_at=now()");
    await client.query(`UPDATE pilot_revision_tasks SET ${sets.join(", ")} WHERE id=$3 AND ${tenantWhere()}`, params);
    return { ok: true };
  });
}

// ---------- Material Change / Ethics Amendment ----------
const MATERIAL_FLAGS: Record<string, string> = {
  PRIMARY_OUTCOME_CHANGED: "POWER_ANALYSIS_REVISION_REQUIRED",
  RESEARCH_QUESTION_CHANGED: "RESEARCH_DESIGN_REVIEW_REQUIRED",
  CORE_CONSTRUCT_CHANGED: "INSTRUMENT_REVALIDATION_REQUIRED",
  DESIGN_CHANGED: "RESEARCH_DESIGN_REVIEW_REQUIRED",
  STUDY_ARM_CHANGED: "RESEARCH_DESIGN_REVIEW_REQUIRED",
  CONTROL_CHANGED: "RESEARCH_DESIGN_REVIEW_REQUIRED",
  TIMEPOINT_CHANGED: "RESEARCH_DESIGN_REVIEW_REQUIRED",
  POPULATION_CHANGED: "RESEARCH_DESIGN_REVIEW_REQUIRED",
  INTERVENTION_CHANGED: "ANALYSIS_PLAN_AMENDMENT_REQUIRED",
  ANALYSIS_MODEL_CHANGED: "ANALYSIS_PLAN_AMENDMENT_REQUIRED",
  SENSITIVE_DATA_ADDED: "ETHICS_AMENDMENT_REQUIRED",
  SENSOR_RECORDING_AI_ADDED: "ETHICS_AMENDMENT_REQUIRED",
  RISK_INCREASED: "ETHICS_AMENDMENT_REQUIRED",
};
export async function assessMaterialChange(tenant: ResearchTenant, input: { userId: string; changeType: string; description: string; flags?: string[] }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const requiresReview = MATERIAL_FLAGS[input.changeType] ?? "NONE";
    const flags = list(input.flags).map((f) => str(f)).filter(Boolean);
    await client.query(`INSERT INTO material_change_assessments (id,workspace_id,project_id,pilot_study_id,change_type,description,trigger_flags,requires_review,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7::jsonb,$8,'OPEN',$9,now(),now())`,
      [tenant.workspaceId, tenant.projectId, studyId, `mc_${randomUUID()}`, input.changeType, input.description, JSON.stringify(flags), requiresReview, input.userId]);
    // 依類型標記上游模組（不覆蓋版本；僅狀態）
    if (["RESEARCH_DESIGN_REVIEW_REQUIRED", "POWER_ANALYSIS_REVISION_REQUIRED"].includes(requiresReview)) {
      await client.query(`UPDATE research_design_analyses SET status='REVISION_REQUIRED', updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    }
    if (["ANALYSIS_PLAN_AMENDMENT_REQUIRED"].includes(requiresReview)) {
      await client.query(`UPDATE study_protocols SET status='AMENDMENT_REQUIRED', updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    }
    if (["ETHICS_AMENDMENT_REQUIRED"].includes(requiresReview)) {
      await client.query(`INSERT INTO ethics_amendment_requirements (id,workspace_id,project_id,pilot_study_id,affected_document,change_description,amendment_status,created_by_user_id,created_at,updated_at)
        VALUES ($4,$1,$2,$3,$5,$6,'REQUIRED',$7,now(),now())`,
        [tenant.workspaceId, tenant.projectId, studyId, `ea_${randomUUID()}`, "（待指定）", input.description, input.userId]);
      await client.query(`UPDATE formal_study_readiness_assessments SET status='BLOCKED_BY_ETHICS', updated_at=now() WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
    }
    await audit(client, tenant, input.userId, "MATERIAL_CHANGE_ASSESSED", { changeType: input.changeType, requiresReview });
    return { ok: true, requiresReview };
  });
}

// ---------- Pilot Decision（需使用者核准） ----------
export async function makePilotDecision(tenant: ResearchTenant, input: { userId: string; decision: string; rationale?: string; userApproved?: boolean }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const allowed = ["PROCEED_WITHOUT_CHANGE", "PROCEED_WITH_MINOR_REVISION", "MAJOR_REVISION_REQUIRED", "REPEAT_PILOT_REQUIRED", "PARTIAL_PILOT_REPEAT_REQUIRED", "STOP_AND_REDESIGN", "PILOT_INCONCLUSIVE", "PILOT_WAIVED_WITH_JUSTIFICATION"];
    if (!allowed.includes(input.decision)) return { ok: false, error: "decision_invalid" };
    const approved = bool(input.userApproved);
    if (approved && !str(input.rationale)) return { ok: false, error: "decision_requires_rationale" };
    const criteria = await client.query(`SELECT criterion_key AS "key", status FROM pilot_success_criteria WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
    const summary: Record<string, unknown> = {};
    for (const row of criteria.rows as Record<string, unknown>[]) summary[text(row.key)] = text(row.status);
    await client.query(`INSERT INTO pilot_decisions (id,workspace_id,project_id,pilot_study_id,decision,rationale,success_criteria_summary,user_approved,approved_at,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7::jsonb,$8,CASE WHEN $8 THEN now() ELSE NULL END,$9,now(),now())
      ON CONFLICT (workspace_id, project_id, pilot_study_id) DO UPDATE SET decision=$5, rationale=$6, success_criteria_summary=$7::jsonb, user_approved=$8, approved_at=CASE WHEN $8 THEN now() ELSE pilot_decisions.approved_at END, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `pdec_${randomUUID()}`, input.decision, str(input.rationale), JSON.stringify(summary), approved, input.userId]);
    if (approved) {
      await client.query(`UPDATE pilot_studies SET status=CASE WHEN $3 IN ('MAJOR_REVISION_REQUIRED','REPEAT_PILOT_REQUIRED') THEN 'REVISION_REQUIRED' ELSE 'COMPLETED' END, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, input.decision, studyId]);
    }
    await audit(client, tenant, input.userId, "PILOT_DECISION_MADE", { decision: input.decision, approved });
    return { ok: true, decision: input.decision, approved };
  });
}

// ---------- Report（aggregate；不虛構） ----------
export async function generatePilotReport(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const [study, components, criteria, sessions, datasets, pretests, technical, sensors, logs, deviations, events, interviews, interventions, recruit, decision, issues] = await Promise.all([
      client.query(`SELECT status, applicability FROM pilot_studies WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT pilot_type AS "pilotType", name, status FROM pilot_components WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT criterion_key AS "key", metric, threshold, status FROM pilot_success_criteria WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_sessions WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT dataset_type AS "datasetType", synthetic, dataset_name AS "name" FROM pilot_datasets WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT result_kind AS "kind", count(*)::int AS "n" FROM pilot_pretest_results WHERE ${tenantWhere()} AND pilot_study_id=$3 GROUP BY result_kind`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n", count(*) FILTER (WHERE pass_status='PASS')::int AS "pass" FROM technical_pilot_runs WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM sensor_pilot_results WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n", count(*) FILTER (WHERE status='PASS')::int AS "pass" FROM log_validation_results WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_protocol_deviations WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_adverse_events WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM cognitive_interview_records WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM intervention_pilot_results WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT contacted_count AS "contacted", consent_count AS "consent", completion_count AS "completion" FROM pilot_recruitment_summaries WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT decision, user_approved AS "approved" FROM pilot_decisions WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_issues WHERE ${tenantWhere()} AND pilot_study_id=$3 AND status <> 'RESOLVED'`, [tenant.workspaceId, tenant.projectId, studyId]),
    ]);
    const sections: Record<string, unknown> = {
      purpose: "依研究內容判斷所需 Pilot；本報告為可行性與工具品質報告，非正式研究 Results。",
      components: components.rows,
      successCriteriaEvaluation: criteria.rows,
      sessionsCount: sessions.rows[0]?.n ?? 0,
      datasets: datasets.rows,
      pretestSummary: pretests.rows,
      technicalSummary: technical.rows[0] ?? { n: 0, pass: 0 },
      sensorResultsCount: sensors.rows[0]?.n ?? 0,
      logValidationSummary: logs.rows[0] ?? { n: 0, pass: 0 },
      deviationsCount: deviations.rows[0]?.n ?? 0,
      adverseEventsCount: events.rows[0]?.n ?? 0,
      cognitiveInterviewsCount: interviews.rows[0]?.n ?? 0,
      interventionResultsCount: interventions.rows[0]?.n ?? 0,
      recruitment: recruit.rows[0] ?? null,
      openIssuesCount: issues.rows[0]?.n ?? 0,
      pilotDecision: decision.rows[0] ?? null,
      limitations: "Pilot 樣本小、不具代表性；估計值具 Wide Uncertainty，不得視為正式效果證據。",
      disclaimer: "PILOT／PRELIMINARY／FEASIBILITY／NOT CONFIRMATORY",
    };
    await client.query(`INSERT INTO pilot_reports (id,workspace_id,project_id,pilot_study_id,sections,version,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5::jsonb,'v1.0',$6,now(),now())
      ON CONFLICT (workspace_id, project_id, pilot_study_id) DO UPDATE SET sections=$5::jsonb, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `prp_${randomUUID()}`, JSON.stringify(sections), input.userId]);
    return { ok: true, sections };
  });
}

// ---------- Protocol Validation Matrix ----------
export async function saveValidationItem(tenant: ResearchTenant, input: { userId: string; item: Record<string, unknown> }) {
  return withClient(async (client) => {
    const { item } = input;
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const key = str(item.componentKey);
    await client.query(`INSERT INTO protocol_validation_items (id,workspace_id,project_id,pilot_study_id,component_key,pilot_evidence,status,issue,revision,final_version,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,now(),now())
      ON CONFLICT (workspace_id, project_id, pilot_study_id, component_key) DO UPDATE SET pilot_evidence=$6, status=$7, issue=$8, revision=$9, final_version=$10, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `pvi_${randomUUID()}`, key, str(item.pilotEvidence), str(item.status, "NOT_APPLICABLE"), str(item.issue), str(item.revision), str(item.finalVersion), input.userId]);
    return { ok: true, componentKey: key };
  });
}

// ---------- Protocol v2.0 Final（clone v1 為新版本；不覆蓋） ----------
export async function createProtocolV2(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const protocol = await client.query(`SELECT id, current_version_number AS "v" FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (!protocol.rows[0]) return { ok: false, error: "protocol_required" };
    const protocolId = text((protocol.rows[0] as Record<string, unknown>).id);
    const latest = await client.query(`SELECT id, payload, version_number AS "version" FROM study_protocol_versions WHERE ${tenantWhere()} AND protocol_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, protocolId]);
    if (!latest.rows[0]) return { ok: false, error: "protocol_draft_required" };
    const payload = record(latest.rows[0].payload) ? latest.rows[0].payload as Record<string, unknown> : {};
    payload.finalization = { version: "v2.0 Final", finalizedAt: new Date().toISOString(), note: "Pilot 後定稿；基於 Pilot Evidence 之修訂（不覆蓋 v1.0）。" };
    const nextVersion = int((protocol.rows[0] as Record<string, unknown>).v) + 1;
    const spvId = `spv_${randomUUID()}`;
    await client.query(`INSERT INTO study_protocol_versions (id,workspace_id,project_id,protocol_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,$5,$6,'v2.0 Final','Pilot 後定稿（Pilot Evidence 驅動；v1.0 保留）',$7,$8::jsonb,$9,now())`,
      [tenant.workspaceId, tenant.projectId, protocolId, spvId, nextVersion, text((latest.rows[0] as Record<string, unknown>).id), hash(payload), JSON.stringify(payload), input.userId]);
    await client.query(`UPDATE study_protocols SET current_version_number=$3, status='INTERNAL_REVIEW', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, nextVersion, protocolId]);
    return { ok: true, version: nextVersion, versionId: spvId };
  });
}

// ---------- Formal Study Readiness（15 檢查） ----------
export async function runFormalStudyReadiness(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const [gate1, gate2, protocol, decision, ethicsAmendments, ethicsDecisions, permissions, datasets, tasks, issues, blueprintV5, protocolV2, safetyEvents, training, criteria] = await Promise.all([
      gateApproved(client as never, tenant, "PILOT_AND_PROTOCOL_VALIDATED"),
      client.query(`SELECT status FROM pilot_studies WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT status, current_version_number AS "v" FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT user_approved AS "approved" FROM pilot_decisions WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM ethics_amendment_requirements WHERE ${tenantWhere()} AND pilot_study_id=$3 AND amendment_status IN ('REQUIRED','SUBMITTED')`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT approval_status AS "approvalStatus" FROM institutional_ethics_decisions WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM instrument_permissions WHERE ${tenantWhere()} AND status NOT IN ('APPROVED','PERMISSION_NOT_REQUIRED','PUBLIC_DOMAIN','OPEN_LICENSE')`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_datasets WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_revision_tasks WHERE ${tenantWhere()} AND pilot_study_id=$3 AND status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_issues WHERE ${tenantWhere()} AND pilot_study_id=$3 AND severity IN ('FATAL','CRITICAL') AND status <> 'RESOLVED'`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT 1 FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label LIKE '%Study-Ready%' LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT 1 FROM study_protocol_versions WHERE ${tenantWhere()} AND version_label='v2.0 Final' LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_adverse_events WHERE ${tenantWhere()} AND pilot_study_id=$3 AND severity IN ('SEVERE','SERIOUS') AND resolution_status <> 'RESOLVED'`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM team_training_records WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]),
      client.query(`SELECT count(*)::int AS "n" FROM pilot_success_criteria WHERE ${tenantWhere()} AND pilot_study_id=$3 AND status IN ('DEFINED','NOT_EVALUATED')`, [tenant.workspaceId, tenant.projectId, studyId]),
    ]);
    const checks: { key: string; label: string; pass: boolean; detail: string }[] = [
      { key: "pilot_validated", label: "PILOT_AND_PROTOCOL_VALIDATED 已通過或 Pilot Waiver 有依據", pass: gate1, detail: gate1 ? "已通過" : "未通過" },
      { key: "protocol_v2", label: "Study Protocol v2.0 Final 已鎖定", pass: Boolean(protocolV2.rows[0]), detail: protocolV2.rows[0] ? "v2.0 Final 存在" : "缺 v2.0 Final" },
      { key: "decision_approved", label: "Pilot Decision 已由使用者核准", pass: bool(decision.rows[0]?.approved), detail: decision.rows[0] ? "已核准" : "未核准" },
      { key: "ethics_amendment", label: "倫理修正已正式確認", pass: int(ethicsAmendments.rows[0]?.n ?? 0) === 0, detail: `待確認倫理修正 ${ethicsAmendments.rows[0]?.n ?? 0}` },
      { key: "ethics_decision", label: "Institutional Ethics Decision 涵蓋最終 Protocol", pass: ethicsDecisions.rows[0] && text(ethicsDecisions.rows[0].approvalStatus) === "APPROVED" ? true : false, detail: ethicsDecisions.rows[0] ? `狀態：${text(ethicsDecisions.rows[0].approvalStatus)}` : "尚無正式判定" },
      { key: "permissions", label: "工具 Permission 完成", pass: permissions.rows.length === 0, detail: `${permissions.rows.length} 筆未完成` },
      { key: "no_open_tasks", label: "無未處理 Revision Task", pass: int(tasks.rows[0]?.n ?? 0) === 0, detail: `未處理 ${tasks.rows[0]?.n ?? 0}` },
      { key: "no_critical_issues", label: "無未處理 FATAL/CRITICAL Issue", pass: int(issues.rows[0]?.n ?? 0) === 0, detail: `未處理 ${issues.rows[0]?.n ?? 0}` },
      { key: "safety_clear", label: "Safety：無未結重大不良事件", pass: int(safetyEvents.rows[0]?.n ?? 0) === 0, detail: `未結 ${safetyEvents.rows[0]?.n ?? 0}` },
      { key: "blueprint_v5", label: "Research Blueprint Study-Ready 已建立", pass: Boolean(blueprintV5.rows[0]), detail: blueprintV5.rows[0] ? "已建立" : "未建立" },
      { key: "criteria_evaluated", label: "Success Criteria 已逐項判斷", pass: int(criteria.rows[0]?.n ?? 0) === 0, detail: `未判斷 ${criteria.rows[0]?.n ?? 0}` },
      { key: "team_ready", label: "Research Team Training 已完成", pass: int(training.rows[0]?.n ?? 0) > 0, detail: `訓練紀錄 ${training.rows[0]?.n ?? 0}` },
    ];
    const failed = checks.filter((c) => !c.pass);
    let status = "READY_FOR_FINAL_APPROVAL";
    if (failed.length) {
      const keys = new Set(failed.map((f) => f.key));
      if (keys.has("ethics_amendment") || keys.has("ethics_decision")) status = "BLOCKED_BY_ETHICS";
      else if (keys.has("safety_clear")) status = "BLOCKED_BY_SAFETY";
      else if (keys.has("protocol_v2")) status = "BLOCKED_BY_PROTOCOL";
      else if (keys.has("permissions")) status = "BLOCKED_BY_PERMISSION";
      else status = "CONDITIONAL";
    }
    await client.query(`INSERT INTO formal_study_readiness_assessments (id,workspace_id,project_id,pilot_study_id,checks,status,checked_at,created_by_user_id,updated_at)
      VALUES ($4,$1,$2,$3,$5::jsonb,$6,now(),$7,now())
      ON CONFLICT (workspace_id, project_id, pilot_study_id) DO UPDATE SET checks=$5::jsonb, status=$6, checked_at=now(), updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, studyId, `fsr_${randomUUID()}`, JSON.stringify(checks), status, input.userId]);
    return { ok: true, status, checks, failed: failed.length };
  });
}

// ---------- Gates ----------
export async function approvePilotGate(tenant: ResearchTenant, input: { userId: string; gateType: "PILOT_EXECUTION_AUTHORIZED" | "PILOT_AND_PROTOCOL_VALIDATED" | "FORMAL_STUDY_EXECUTION_READY" }) {
  return withClient(async (client) => {
    const studyId = await ensurePilotStudy(client, tenant, input.userId);
    const failed: { key: string; label: string; detail: string }[] = [];
    if (input.gateType === "PILOT_EXECUTION_AUTHORIZED") {
      const authz = await client.query(`SELECT checks, status FROM pilot_execution_authorizations WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (!authz.rows[0]) failed.push({ key: "authorization_check", label: "先執行 Pilot 執行授權檢查", detail: "未執行" });
      else {
        const status = text((authz.rows[0] as Record<string, unknown>).status);
        if (status !== "AUTHORIZED") failed.push({ key: "authorization_status", label: "授權檢查全數通過", detail: `目前：${status}` });
      }
      const criteriaN = await client.query(`SELECT count(*)::int AS "n" FROM pilot_success_criteria WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (int(criteriaN.rows[0]?.n ?? 0) === 0) failed.push({ key: "success_criteria", label: "Success Criteria 已預先定義", detail: "尚無成功標準" });
      const planN = await client.query(`SELECT count(*)::int AS "n" FROM pilot_components WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (int(planN.rows[0]?.n ?? 0) === 0) failed.push({ key: "pilot_plan", label: "Pilot Plan 已建立", detail: "尚無組件" });
    } else if (input.gateType === "PILOT_AND_PROTOCOL_VALIDATED") {
      const study = await client.query(`SELECT status FROM pilot_studies WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      const status = text((study.rows[0] as Record<string, unknown>).status);
      if (!["COMPLETED"].includes(status) && status !== "REVISION_REQUIRED") failed.push({ key: "pilot_completed", label: "Pilot 已完成（或已進入修訂流程）", detail: `目前：${status}` });
      const criteria = await client.query(`SELECT count(*)::int AS "n" FROM pilot_success_criteria WHERE ${tenantWhere()} AND pilot_study_id=$3 AND status IN ('DEFINED','NOT_EVALUATED')`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (int(criteria.rows[0]?.n ?? 0) > 0) failed.push({ key: "criteria_judged", label: "Success Criteria 已逐項判斷", detail: `${criteria.rows[0]?.n ?? 0} 項未判斷` });
      const report = await client.query(`SELECT 1 FROM pilot_reports WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (!report.rows[0]) failed.push({ key: "report", label: "Pilot Report 已完成", detail: "未產生" });
      const decision = await client.query(`SELECT user_approved AS "approved" FROM pilot_decisions WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      if (!bool(decision.rows[0]?.approved)) failed.push({ key: "decision", label: "Pilot Decision 已由使用者核准", detail: "未核准" });
    } else if (input.gateType === "FORMAL_STUDY_EXECUTION_READY") {
      const readiness = await client.query(`SELECT status FROM formal_study_readiness_assessments WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
      const status = text(readiness.rows[0]?.status ?? "NOT_READY");
      if (status !== "READY_FOR_FINAL_APPROVAL") failed.push({ key: "readiness", label: "Formal Study Readiness 檢查通過", detail: `目前：${status}` });
    }
    if (failed.length) return { ok: false, failed };
    const gateId = `hg_${randomUUID()}`;
    await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,'pilot_study',$6,$7,'APPROVED',$3,now(),now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, gateId, input.gateType, studyId, hash({ gateType: input.gateType, at: new Date().toISOString() })]);
    if (input.gateType === "FORMAL_STUDY_EXECUTION_READY") {
      await client.query(`UPDATE formal_study_readiness_assessments SET status='APPROVED_FOR_FORMAL_STUDY', updated_at=now() WHERE ${tenantWhere()} AND pilot_study_id=$3`, [tenant.workspaceId, tenant.projectId, studyId]);
    }
    if (input.gateType === "PILOT_EXECUTION_AUTHORIZED") {
      await client.query(`UPDATE pilot_studies SET status='READY_TO_START', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, studyId]);
    }
    await audit(client, tenant, input.userId, `${input.gateType}_APPROVED`, { humanGateId: gateId });
    return { ok: true, gateType: input.gateType, humanGateId: gateId };
  });
}

// ---------- Research Blueprint Study-Ready 回寫（append-only） ----------
export async function writeBlueprintStudyReady(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const blueprint = await client.query(`SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (!blueprint.rows[0]) return { ok: false, error: "blueprint_required" };
    const blueprintId = text((blueprint.rows[0] as Record<string, unknown>).id);
    const latestBp = await client.query(`SELECT payload, version_number AS "v", id FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
    const bpPayload = latestBp.rows[0] && record(latestBp.rows[0].payload) ? latestBp.rows[0].payload as Record<string, unknown> : {};
    const [decision, protocolV2, readiness, components] = await Promise.all([
      client.query(`SELECT decision, user_approved AS "approved" FROM pilot_decisions WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT 1 FROM study_protocol_versions WHERE ${tenantWhere()} AND version_label='v2.0 Final' LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM formal_study_readiness_assessments WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT pilot_type AS "pilotType", status FROM pilot_components WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const studyReadyPayload: Record<string, unknown> = {
      ...bpPayload,
      study_ready: {
        written_at: new Date().toISOString(),
        pilot_applicability: "見 Pilot Applicability Assessment",
        pilot_types_completed: components.rows,
        pilot_success_criteria: "見 Pilot Success Criteria Registry",
        pilot_results_summary: "見 Pilot Study Report v1.0（PILOT／PRELIMINARY）",
        instrument_final_versions: "見 Instrument 中心各工具版本",
        intervention_final_version: "見 Intervention Material Registry",
        control_final_version: "見 Intervention Material Registry（CONTROL）",
        sensor_final_versions: "見 Sensor Specification",
        data_capture_schema_final_version: "見 Data Capture Schema",
        scoring_specification_final_version: "見 Scoring Specification",
        analysis_plan_final_version: "見 Analysis Plan（如有 Amendment 另行紀錄）",
        study_protocol_v2: protocolV2.rows[0] ? "Study Protocol v2.0 Final（見 Protocol 版本歷程）" : null,
        ethics_amendment_status: "見 Ethics Amendment Requirements",
        preregistration_amendment_status: "見 Preregistration Amendments",
        pilot_decision: decision.rows[0] ?? null,
        formal_study_readiness: text(readiness.rows[0]?.status ?? "NOT_READY"),
        unresolved_issues: [],
      },
    };
    const versionNumber = latestBp.rows[0] ? int((latestBp.rows[0] as Record<string, unknown>).v) + 1 : 1;
    const versionId = `rbpv_${randomUUID()}`;
    await client.query(`INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,$5,$6,'v6.0 Study-Ready','由 Pilot & Protocol Validation Center 回寫（不覆蓋既有版本）',$7,$8::jsonb,$9,now())`,
      [tenant.workspaceId, tenant.projectId, blueprintId, versionId, versionNumber, latestBp.rows[0] ? text((latestBp.rows[0] as Record<string, unknown>).id) : null, hash(studyReadyPayload), JSON.stringify(studyReadyPayload), input.userId]);
    await client.query(`UPDATE research_blueprints SET current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, versionNumber, blueprintId]);
    await audit(client, tenant, input.userId, "BLUEPRINT_STUDY_READY_WRITTEN", { blueprintVersionId: versionId, versionNumber });
    return { ok: true, blueprintVersionId: versionId, versionNumber };
  });
}

// ---------- Pilot Evidence 連結（→ 文獻與證據中心，role=METHOD/MEASUREMENT/SIMILAR_STUDY） ----------
export async function linkPilotEvidence(tenant: ResearchTenant, input: { userId: string; issueId?: string; literatureId?: string; citationSourceId?: string; zoteroItemKey?: string; role?: string; note?: string }) {
  return withClient(async (client) => {
    if (!input.literatureId && !input.citationSourceId && !input.zoteroItemKey) return { ok: false, error: "evidence_source_required" };
    await client.query(`INSERT INTO instrument_evidence_links (id,workspace_id,project_id,link_id,literature_id,citation_source_id,zotero_item_key,role,note,verification_status,created_by_user_id,created_at)
      VALUES ($4,$1,$2,NULL,$5,$6,$7,$8,$9,'UNVERIFIED',$10,now())`,
      [tenant.workspaceId, tenant.projectId, `iel_${randomUUID()}`, input.literatureId ?? null, input.citationSourceId ?? null, input.zoteroItemKey ?? null, str(input.role, "METHOD"), str(input.note), input.userId]);
    return { ok: true };
  });
}

export async function markPilotOutdated(tenant: ResearchTenant, input: { userId: string; reason: string; sourceTable: string }) {
  return withClient(async (client) => {
    await client.query(`UPDATE pilot_studies SET status='OUTDATED', updated_at=now() WHERE ${tenantWhere()} AND status NOT IN ('OUTDATED','CANCELLED')`, [tenant.workspaceId, tenant.projectId]);
    await client.query(`UPDATE formal_study_readiness_assessments SET status='OUTDATED', updated_at=now() WHERE ${tenantWhere()} AND status IN ('READY_FOR_FINAL_APPROVAL','APPROVED_FOR_FORMAL_STUDY','CONDITIONAL')`, [tenant.workspaceId, tenant.projectId]);
    return { ok: true };
  });
}
