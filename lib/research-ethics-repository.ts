import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import { callOpenClaw, type OpenClawMessage } from "./openclaw.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("ethics_storage_unavailable");
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

async function audit(client: unknown, tenant: ResearchTenant, userId: string, eventType: string, detail: Record<string, unknown>) {
  const c = client as { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  try {
    await c.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,$5,$5,$6,'1.5.6',$7::jsonb,$8)`, [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, eventType, JSON.stringify(detail), hash({ eventType, detail })]);
  } catch { /* audit 失敗不阻擋主流程 */ }
}

// ---------- Ethics Scope Screening 規格（25 項） ----------
export const ETHICS_SCOPE_ITEMS: { key: string; question: string; critical?: boolean }[] = [
  { key: "human_participants", question: "是否涉及人體參與者？" },
  { key: "identifiable_data", question: "是否涉及可識別個人資料？" },
  { key: "students", question: "是否涉及學生？" },
  { key: "employees_subordinates", question: "是否涉及員工或從屬關係？" },
  { key: "minors", question: "是否涉及未成年人？", critical: true },
  { key: "vulnerable_groups", question: "是否涉及弱勢或敏感群體？", critical: true },
  { key: "health_data", question: "是否涉及醫療或健康資料？", critical: true },
  { key: "psychological_stress", question: "是否涉及心理壓力或高風險情境？", critical: true },
  { key: "audio_recording", question: "是否涉及錄音？" },
  { key: "video_recording", question: "是否涉及錄影？" },
  { key: "facial_recognition", question: "是否涉及影像辨識？" },
  { key: "eye_tracking", question: "是否涉及 Eye Tracking？" },
  { key: "wearable_sensors", question: "是否涉及 EDA、EEG、HRV 或穿戴式裝置？" },
  { key: "location_tracking", question: "是否涉及位置、軌跡或行為紀錄？" },
  { key: "lms_records", question: "是否涉及學習平台紀錄？" },
  { key: "social_network_data", question: "是否涉及社群或網路資料？" },
  { key: "secondary_data", question: "是否使用既有二手資料？" },
  { key: "public_data", question: "是否使用公開資料？" },
  { key: "web_scraping", question: "是否進行網站抓取？" },
  { key: "ai_training_data", question: "是否涉及 AI 模型訓練資料？" },
  { key: "cross_border_transfer", question: "是否涉及跨境資料傳輸？" },
  { key: "third_party_cloud", question: "是否涉及第三方雲端服務？" },
  { key: "conflict_of_interest", question: "是否存在利益衝突？" },
  { key: "compensation", question: "是否提供酬勞、獎勵或課程加分？" },
  { key: "adverse_events", question: "是否可能產生不良事件？" },
];

// ---------- Ethics Risk Register 規格（15 類） ----------
export const ETHICS_RISK_ITEMS: { key: string; title: string }[] = [
  { key: "physical", title: "Physical Risk 身體風險" },
  { key: "psychological", title: "Psychological Risk 心理風險" },
  { key: "privacy", title: "Privacy Risk 隱私風險" },
  { key: "data_security", title: "Data Security Risk 資料安全風險" },
  { key: "social", title: "Social Risk 社會風險" },
  { key: "academic", title: "Academic Risk 學術風險" },
  { key: "employment", title: "Employment Risk 就業風險" },
  { key: "teacher_student_power", title: "Teacher–Student Power Imbalance 師生權力不對等" },
  { key: "undue_influence", title: "Undue Influence 不當影響" },
  { key: "re_identification", title: "Re-identification Risk 再識別風險" },
  { key: "algorithmic_bias", title: "Algorithmic Bias 演算法偏誤" },
  { key: "ai_misclassification", title: "AI Misclassification Risk AI 誤分類風險" },
  { key: "third_party_platform", title: "Third-party Platform Risk 第三方平台風險" },
  { key: "international_data_transfer", title: "International Data Transfer Risk 跨境傳輸風險" },
  { key: "adverse_event", title: "Adverse Event Risk 不良事件風險" },
];

// ---------- 教師與學生研究專屬檢查（11 項） ----------
export const TEACHER_POWER_ITEMS: { key: string; question: string }[] = [
  { key: "non_teaching_recruiter", question: "是否由非授課教師協助招募？" },
  { key: "free_refusal", question: "是否明確說明可自由拒絕？" },
  { key: "no_grade_impact", question: "是否不影響成績與權益？" },
  { key: "data_grade_separation", question: "是否將研究資料與成績資料分離？" },
  { key: "blind_after_grades", question: "是否於成績確定後才進行資料解盲？" },
  { key: "alternative_activity", question: "是否有替代學習活動？" },
  { key: "no_undue_incentive", question: "是否避免不當加分誘因？" },
  { key: "teacher_not_see_refusers", question: "是否避免教師直接得知拒絕者？" },
  { key: "deidentification", question: "是否對學生資料去識別化？" },
  { key: "withdrawal_process", question: "是否有退出研究流程？" },
  { key: "course_research_separation", question: "是否說明課程參與與研究參與不同？" },
];

// ---------- IRB／倫理文件類型（20 類） ----------
export const ETHICS_DOCUMENT_TYPES: { type: string; title: string }[] = [
  { type: "IRB_APPLICATION_SUMMARY", title: "IRB／倫理申請摘要" },
  { type: "RESEARCH_PROTOCOL_SUMMARY", title: "Research Protocol Summary" },
  { type: "PARTICIPANT_INFORMATION_SHEET", title: "Participant Information Sheet" },
  { type: "INFORMED_CONSENT", title: "Informed Consent Draft" },
  { type: "PARENTAL_CONSENT", title: "Parental Consent Draft" },
  { type: "MINOR_ASSENT", title: "Minor Assent Draft" },
  { type: "RECRUITMENT_NOTICE", title: "Recruitment Notice" },
  { type: "EMAIL_INVITATION", title: "Email Invitation" },
  { type: "DEBRIEFING_STATEMENT", title: "Debriefing Statement" },
  { type: "WITHDRAWAL_PROCEDURE", title: "Withdrawal Procedure" },
  { type: "COMPENSATION_STATEMENT", title: "Compensation Statement" },
  { type: "PRIVACY_NOTICE", title: "Privacy Notice" },
  { type: "DATA_MANAGEMENT_PLAN_DOC", title: "Data Management Plan" },
  { type: "DATA_SECURITY_PLAN", title: "Data Security Plan" },
  { type: "DATA_RETENTION_DESTRUCTION", title: "Data Retention and Destruction Plan" },
  { type: "ADVERSE_EVENT_PLAN", title: "Adverse Event Plan" },
  { type: "CONFLICT_OF_INTEREST_DISCLOSURE", title: "Conflict of Interest Disclosure" },
  { type: "AUDIO_VIDEO_CONSENT", title: "Audio／Video Consent" },
  { type: "SENSOR_DATA_CONSENT", title: "Sensor Data Consent" },
  { type: "AI_AUTOMATED_DECISION_DISCLOSURE", title: "AI／Automated Decision Disclosure" },
];

// ---------- DMP 段落 ----------
export const DMP_SECTIONS: { key: string; title: string }[] = [
  { key: "data_types", title: "Data Types 資料類型" },
  { key: "data_sources", title: "Data Sources 資料來源" },
  { key: "personal_identifiers", title: "Personal Identifiers 個人識別資料" },
  { key: "de_identification_method", title: "De-identification Method 去識別化方法" },
  { key: "coding_key_location", title: "Coding Key Location 編碼鑰位置" },
  { key: "access_control", title: "Access Control 存取控制" },
  { key: "encryption", title: "Encryption 加密" },
  { key: "storage_location", title: "Storage Location 儲存位置" },
  { key: "backup", title: "Backup 備份" },
  { key: "data_transfer", title: "Data Transfer 資料傳輸" },
  { key: "third_party_services", title: "Third-party Services 第三方服務" },
  { key: "retention_period", title: "Retention Period 保留期限" },
  { key: "destruction_method", title: "Destruction Method 銷毀方法" },
  { key: "data_sharing_plan", title: "Data Sharing Plan 分享計畫" },
  { key: "repository_plan", title: "Repository Plan 存放庫計畫" },
  { key: "sensitive_data_restrictions", title: "Sensitive Data Restrictions 敏感資料限制" },
  { key: "dataset_versioning", title: "Dataset Versioning 資料集版本" },
  { key: "audit_log", title: "Audit Log 稽核紀錄" },
  { key: "responsible_person", title: "Responsible Person 負責人" },
];

// ---------- Journal Pre-study Readiness 檢查（13 項） ----------
export const JOURNAL_READINESS_ITEMS: { key: string; label: string }[] = [
  { key: "target_journal_alignment", label: "Target Journal Alignment" },
  { key: "research_design_alignment", label: "Research Design Alignment" },
  { key: "reporting_guideline_plan", label: "Reporting Guideline Plan" },
  { key: "preregistration_status", label: "Preregistration Status" },
  { key: "ethics_status", label: "Ethics Status" },
  { key: "data_management_plan", label: "Data Management Plan" },
  { key: "open_science_plan", label: "Open Science Plan" },
  { key: "authorship_plan", label: "Authorship Plan" },
  { key: "primary_outcome", label: "Primary Outcome" },
  { key: "analysis_plan", label: "Analysis Plan" },
  { key: "study_materials_plan", label: "Study Materials Plan" },
  { key: "reproducibility_plan", label: "Reproducibility Plan" },
  { key: "desk_reject_risk", label: "Potential Desk Reject Risk" },
];

// ---------- 來源載入（倫理指紋） ----------
type EthicsSource = { projectTitle: string; primaryRoute: string; blueprintVersion: number; blueprintVersionId: string | null; blueprintPayload: Record<string, unknown>; designVersionId: string | null; designVersion: number; designPayload: Record<string, unknown>; analysisPlanPresent: boolean; includesOwnStudents: boolean | null };

async function loadEthicsSource(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, tenant: ResearchTenant): Promise<EthicsSource> {
  const projectTitleResult = await client.query(`SELECT title FROM projects WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const blueprint = await client.query(`SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  let blueprintVersion = 0; let blueprintVersionId: string | null = null; let blueprintPayload: Record<string, unknown> = {};
  if (blueprint.rows[0]) {
    const latest = await client.query(`SELECT id, version_number AS "versionNumber", payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, text(blueprint.rows[0].id)]);
    if (latest.rows[0]) {
      blueprintVersion = int(latest.rows[0].versionNumber);
      blueprintVersionId = text(latest.rows[0].id);
      const p = latest.rows[0].payload;
      if (record(p)) blueprintPayload = p;
    }
  }
  const design = await client.query(`SELECT d.current_version_number AS "n", v.id AS "versionId", v.payload AS "payload" FROM research_design_analyses d LEFT JOIN research_design_versions v ON v.analysis_id=d.id AND v.version_number=d.current_version_number WHERE ${tenantWhere("d")} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const designPayload = design.rows[0] && record(design.rows[0].payload) ? design.rows[0].payload as Record<string, unknown> : {};
  const analysis = await client.query(`SELECT 1 FROM research_design_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const identity = record(blueprintPayload.research_identity) ? blueprintPayload.research_identity as Record<string, unknown> : {};
  const bp = blueprintPayload;
  const method = record(bp.method) ? bp.method as Record<string, unknown> : {};
  const cp = record(bp.core_problem) ? bp.core_problem as Record<string, unknown> : {};
  return {
    projectTitle: projectTitleResult.rows[0] ? text(projectTitleResult.rows[0].title) : "",
    primaryRoute: str(identity.primaryRoute, ""),
    blueprintVersion,
    blueprintVersionId,
    blueprintPayload,
    designVersionId: design.rows[0] ? text(design.rows[0].versionId) : null,
    designVersion: design.rows[0] ? int(design.rows[0].n) : 0,
    designPayload,
    analysisPlanPresent: list(designPayload.analysis_plans).length > 0,
    includesOwnStudents: null,
  };
}

function ethicsSourceFingerprint(source: EthicsSource): string {
  // 只 hash「影響倫理判斷的實質內容」：題目／路線／RQ／設計內容／分析計畫存在與否
  const bp = source.blueprintPayload;
  const design = source.designPayload;
  return hash({
    projectTitle: source.projectTitle,
    primaryRoute: source.primaryRoute,
    questions: list(bp.questions).map((q) => str(record(q) ? (q as Record<string, unknown>).question : "")).filter(Boolean),
    theory: list(bp.theory).map((t) => str(t)).filter(Boolean),
    population: str(record(bp.population) ? (bp.population as Record<string, unknown>).description : ""),
    methodology: str(record(bp.method) ? (bp.method as Record<string, unknown>).direction : ""),
    designType: str(design.designType ?? design.design_type),
    arms: list(design.study_arms).map((a) => str(record(a) ? (a as Record<string, unknown>).name : a)).filter(Boolean),
    dataSources: list(design.data_sources ?? design.dataSources).map((d) => str(record(d) ? (d as Record<string, unknown>).source : d)).filter(Boolean),
    analysisPlanPresent: source.analysisPlanPresent,
  });
}

// ---------- 進入條件（依路線） ----------
async function routeGateApproved(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, tenant: ResearchTenant, gateType: string): Promise<{ approved: boolean }> {
  const gate = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, gateType]);
  return { approved: Boolean(gate.rows[0]) };
}

// ---------- Assessment row（idempotent） ----------
async function ensureEthicsAssessment(client: PoolClient, tenant: ResearchTenant, input: { userId: string; source: EthicsSource }): Promise<{ id: string; status: string; existed: boolean }> {
  const existing = await client.query(`SELECT id, status, source_fingerprint AS "sourceFingerprint" FROM research_ethics_assessments WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const fingerprint = ethicsSourceFingerprint(input.source);
  if (existing.rows[0]) {
    const row = existing.rows[0] as Record<string, unknown>;
    const id = text(row.id);
    const status = text(row.status);
    if (status !== "NOT_STARTED" && !text(row.sourceFingerprint)) {
      await client.query(`UPDATE research_ethics_assessments SET source_fingerprint=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, fingerprint, id]);
      return { id, status, existed: true };
    }
    if (status !== "NOT_STARTED" && text(row.sourceFingerprint) !== fingerprint && status !== "OUTDATED") {
      await client.query(`UPDATE research_ethics_assessments SET status='OUTDATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, id]);
      return { id, status: "OUTDATED", existed: true };
    }
    return { id, status, existed: true };
  }
  const id = `rea_${randomUUID()}`;
  const rp = await client.query(`SELECT id FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  await client.query(
    `INSERT INTO research_ethics_assessments (id,workspace_id,project_id,research_project_id,created_by_user_id,status,source_fingerprint,created_at,updated_at)
     VALUES ($4,$1,$2,$5,$3,'NOT_STARTED',$6,now(),now())`,
    [tenant.workspaceId, tenant.projectId, input.userId, id, rp.rows[0] ? text((rp.rows[0] as Record<string, unknown>).id) : null, fingerprint],
  );
  // 初始化 25 項 scope、15 項 risk、20 份文件、DMP、預註冊（JOURNAL 才需要）、readiness
  for (const item of ETHICS_SCOPE_ITEMS) {
    await client.query(`INSERT INTO ethics_scope_items (id,workspace_id,project_id,assessment_id,item_key,question,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,now(),now())`, [tenant.workspaceId, tenant.projectId, id, `esi_${randomUUID()}`, item.key, item.question]);
  }
  for (const item of ETHICS_RISK_ITEMS) {
    await client.query(`INSERT INTO ethics_risk_items (id,workspace_id,project_id,assessment_id,risk_key,risk_title,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,now(),now())`, [tenant.workspaceId, tenant.projectId, id, `eri_${randomUUID()}`, item.key, item.title]);
  }
  for (const doc of ETHICS_DOCUMENT_TYPES) {
    await client.query(`INSERT INTO ethics_documents (id,workspace_id,project_id,assessment_id,document_type,title,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,now(),now())`, [tenant.workspaceId, tenant.projectId, id, `ed_${randomUUID()}`, doc.type, doc.title, input.userId]);
  }
  await client.query(`INSERT INTO data_management_plans (id,workspace_id,project_id,assessment_id,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,now(),now())`, [tenant.workspaceId, tenant.projectId, id, `dmp_${randomUUID()}`, input.userId]);
  await client.query(`INSERT INTO preregistration_plans (id,workspace_id,project_id,assessment_id,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,now(),now())`, [tenant.workspaceId, tenant.projectId, id, `pp_${randomUUID()}`, input.userId]);
  await client.query(`INSERT INTO journal_study_readiness_reviews (id,workspace_id,project_id,assessment_id,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,now(),now())`, [tenant.workspaceId, tenant.projectId, id, `jsrr_${randomUUID()}`, input.userId]);
  return { id, status: "NOT_STARTED", existed: false };
}

// ---------- 教師與學生研究專屬檢查（11 項作答與狀態） ----------
export async function saveTeacherPowerAnswers(tenant: ResearchTenant, input: { userId: string; items: { key: string; answer: string; note?: string }[] }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const assessment = await client.query(`SELECT id, summary, teacher_power_status AS "teacherPowerStatus" FROM research_ethics_assessments WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]);
    if (!assessment.rows[0]) throw new Error("ethics_assessment_required");
    const row = assessment.rows[0] as Record<string, unknown>;
    const summary = record(row.summary) ? row.summary as Record<string, unknown> : {};
    const answers: Record<string, { answer: string; note: string }> = {};
    for (const item of input.items) {
      if (!TEACHER_POWER_ITEMS.some((spec) => spec.key === item.key)) continue;
      answers[item.key] = { answer: item.answer, note: item.note ?? "" };
    }
    const answeredCount = Object.keys(answers).length;
    const hasNo = Object.values(answers).some((a) => a.answer === "NO");
    const hasUnknown = Object.values(answers).some((a) => a.answer === "UNKNOWN");
    // 全部 11 項皆 YES → CLEARED；任一 NO／UNKNOWN → 風險（MAJOR）
    const cleared = answeredCount === TEACHER_POWER_ITEMS.length && !hasNo && !hasUnknown;
    const teacherPowerStatus = cleared ? "CLEARED" : answeredCount > 0 ? "TEACHER_STUDENT_POWER_RISK" : "NOT_CHECKED";
    summary.teacher_power = { answers, checkedAt: new Date().toISOString(), answeredCount, status: teacherPowerStatus };
    await client.query(`UPDATE research_ethics_assessments SET summary=$3::jsonb, teacher_power_status=$4, teacher_power_severity=$5, updated_at=now() WHERE id=$6 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(summary), teacherPowerStatus, teacherPowerStatus === "CLEARED" ? null : "MAJOR", text(row.id)]);
    await audit(client, tenant, input.userId, "TEACHER_POWER_CHECK_SAVED", { answeredCount, teacherPowerStatus });
    return { ok: true, teacherPowerStatus, answeredCount, total: TEACHER_POWER_ITEMS.length };
  });
}

// ---------- 主讀取：getEthicsCenter ----------
export async function getEthicsCenter(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    // 進入條件依路線：JOURNAL→JOURNAL_RESEARCH_PLAN_RELEASE；NSTC/MOE→提案書初稿 Gate
    const [journalGate, nstcGate, moeGate] = await Promise.all([
      routeGateApproved(client as never, tenant, "JOURNAL_RESEARCH_PLAN_RELEASE"),
      routeGateApproved(client as never, tenant, "NSTC_PROPOSAL_DRAFT_RELEASE"),
      routeGateApproved(client as never, tenant, "MOE_TPR_PROPOSAL_DRAFT_RELEASE"),
    ]);
    const primaryRoute = source.primaryRoute || (source.blueprintPayload && record(source.blueprintPayload.research_identity) ? str((source.blueprintPayload.research_identity as Record<string, unknown>).primaryRoute, "") : "");
    const entry: { allowed: boolean; reason: string[] } = (() => {
      if (primaryRoute === "JOURNAL") return journalGate.approved ? { allowed: true, reason: [] } : { allowed: false, reason: ["JOURNAL_RESEARCH_PLAN_APPROVED：需先完成國際期刊研究規劃並核准（研究路線工作室）"] };
      if (primaryRoute === "NSTC") return nstcGate.approved ? { allowed: true, reason: [] } : { allowed: false, reason: ["NSTC_PROPOSAL_DRAFT_COMPLETE：需先完成國科會計畫書初稿（研究路線工作室）"] };
      if (primaryRoute === "MOE_TEACHING_PRACTICE") return moeGate.approved ? { allowed: true, reason: [] } : { allowed: false, reason: ["MOE_TPR_PROPOSAL_DRAFT_COMPLETE：需先完成教學實踐計畫書初稿（研究路線工作室）"] };
      return { allowed: false, reason: ["ROUTE_REVIEW_AND_ETHICS_LOCKED：尚未確認投稿／申請路線（primary_route）"] };
    })();
    if (!entry.allowed) {
      return { ok: true, locked: true, entry, assessment: null, scopeItems: [], riskItems: [], documents: [], decisions: [], dmp: null, preregistration: null, journalReadiness: null, source: { primaryRoute } };
    }
    const [scope, risks, docs, decisions, dmp, prereg, preregVersions, preregAmendments, readiness] = await Promise.all([
      client.query(`SELECT item_key AS "itemKey", question, answer, status, evidence, risk_level AS "riskLevel", required_action AS "requiredAction", unresolved_question AS "unresolvedQuestion" FROM ethics_scope_items WHERE ${tenantWhere()} AND assessment_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT risk_key AS "riskKey", risk_title AS "riskTitle", likelihood, severity, affected_population AS "affectedPopulation", mitigation, monitoring, responsible_person AS "responsiblePerson", residual_risk AS "residualRisk", status FROM ethics_risk_items WHERE ${tenantWhere()} AND assessment_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT document_type AS "documentType", title, content, status, version_number AS "version", created_at AS "createdAt", updated_at AS "updatedAt" FROM ethics_documents WHERE ${tenantWhere()} AND assessment_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT id, institution, decision_type AS "decisionType", application_number AS "applicationNumber", approval_number AS "approvalNumber", decision_date AS "decisionDate", expiry_date AS "expiryDate", approved_documents AS "approvedDocuments", conditions, verified_by_user AS "verifiedByUser", file_reference AS "fileReference", approval_status AS "approvalStatus" FROM institutional_ethics_decisions WHERE ${tenantWhere()} AND assessment_id=$3 ORDER BY created_at DESC`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT sections, status, version_number AS "version" FROM data_management_plans WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT id, design_type AS "designType", registration_type AS "registrationType", platform_candidate AS "platformCandidate", primary_outcome AS "primaryOutcome", secondary_outcomes AS "secondaryOutcomes", hypotheses, sample_plan AS "samplePlan", exclusion_rules AS "exclusionRules", stopping_rule AS "stoppingRule", missing_data_strategy AS "missingDataStrategy", outlier_strategy AS "outlierStrategy", main_analysis AS "mainAnalysis", exploratory_analysis AS "exploratoryAnalysis", status, registration_url AS "registrationUrl", registration_id AS "registrationId", registered_at AS "registeredAt", current_version_number AS "version" FROM preregistration_plans WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT id, version_number AS "version", version_label AS "versionLabel", reason, created_at AS "createdAt" FROM preregistration_versions WHERE ${tenantWhere()} AND plan_id=$3 ORDER BY version_number DESC LIMIT 10`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT id, reason, changes, created_at AS "createdAt" FROM preregistration_amendments WHERE ${tenantWhere()} AND plan_id=$3 ORDER BY created_at DESC LIMIT 10`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT items, overall, version FROM journal_study_readiness_reviews WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]),
    ]);
    const assessment = await client.query(`SELECT id, status, screening_status AS "screeningStatus", judgment_status AS "judgmentStatus", teacher_power_status AS "teacherPowerStatus", teacher_power_severity AS "teacherPowerSeverity", summary, gate_state AS "gateState" FROM research_ethics_assessments WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]);
    return {
      ok: true,
      locked: false,
      entry,
      assessment: assessment.rows[0] ? assessment.rows[0] : null,
      scopeItems: scope.rows,
      riskItems: risks.rows,
      documents: docs.rows,
      decisions: decisions.rows,
      dmp: dmp.rows[0] ? dmp.rows[0] : null,
      preregistration: prereg.rows[0] ? prereg.rows[0] : null,
      preregistrationVersions: preregVersions.rows,
      preregistrationAmendments: preregAmendments.rows,
      journalReadiness: readiness.rows[0] ? readiness.rows[0] : null,
      teacherPower: (() => {
        const a = assessment.rows[0] ? assessment.rows[0] as Record<string, unknown> : null;
        const summary = a && record(a.summary) ? a.summary as Record<string, unknown> : {};
        return record(summary.teacher_power) ? summary.teacher_power as Record<string, unknown> : null;
      })(),
      source: { primaryRoute },
    };
  });
}

// ---------- 儲存 Scope Items ----------
export async function saveEthicsScopeItems(tenant: ResearchTenant, input: { userId: string; items: { itemKey: string; answer?: string; evidence?: string; requiredAction?: string; unresolvedQuestion?: string }[] }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    let answered = 0;
    for (const item of input.items) {
      const answer = item.answer && ["YES", "NO", "UNKNOWN"].includes(item.answer) ? item.answer : "UNKNOWN";
      const status = answer === "UNKNOWN" ? "NEEDS_RESEARCHER" : "ANSWERED";
      if (status === "ANSWERED") answered += 1;
      await client.query(`UPDATE ethics_scope_items SET answer=$3, status=$4, evidence=$5, required_action=$6, unresolved_question=$7, updated_at=now() WHERE ${tenantWhere()} AND assessment_id=$8 AND item_key=$9`, [tenant.workspaceId, tenant.projectId, answer, status, item.evidence ?? null, item.requiredAction ?? null, item.unresolvedQuestion ?? null, ensured.id, item.itemKey]);
    }
    const screeningStatus = answered === ETHICS_SCOPE_ITEMS.length ? "COMPLETED" : answered > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    await client.query(`UPDATE research_ethics_assessments SET screening_status=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, screeningStatus, ensured.id]);
    await audit(client, tenant, input.userId, "ETHICS_SCOPE_ITEMS_SAVED", { answered, screeningStatus });
    return { ok: true, answered, total: ETHICS_SCOPE_ITEMS.length, screeningStatus };
  });
}

// ---------- 判斷狀態（規則式；系統不自行宣布核准） ----------
function deriveJudgment(items: { itemKey: string; answer: string }[]): { judgment: string; reasons: string[] } {
  const byKey = new Map(items.map((i) => [i.itemKey, i.answer]));
  const get = (key: string) => byKey.get(key) ?? "UNKNOWN";
  const reasons: string[] = [];
  const criticalYes = ETHICS_SCOPE_ITEMS.filter((i) => i.critical && get(i.key) === "YES").map((i) => i.key);
  if (criticalYes.length) {
    reasons.push(`偵測到高風險項目（${criticalYes.join("、")}）為 YES：需正式倫理審查判定`);
    return { judgment: "REVIEW_LIKELY_REQUIRED", reasons };
  }
  if (get("human_participants") === "NO" && get("identifiable_data") === "NO" && get("ai_training_data") !== "YES") {
    reasons.push("無人體參與者且無可識別個人資料");
    return { judgment: "NON_HUMAN_RESEARCH", reasons };
  }
  if (get("secondary_data") === "YES" && get("human_participants") !== "YES") {
    reasons.push("僅使用既有二手資料：需確認原始資料之倫理／授權狀態");
    return { judgment: "SECONDARY_DATA_REVIEW_REQUIRED", reasons };
  }
  if (Object.values(ETHICS_SCOPE_ITEMS).some((i) => get(i.key) === "UNKNOWN")) {
    reasons.push("仍有項目未回答（UNKNOWN）");
    return { judgment: "INSUFFICIENT_INFORMATION", reasons };
  }
  if (get("human_participants") === "YES" || get("students") === "YES" || get("employees_subordinates") === "YES") {
    reasons.push("涉及參與者／學生／從屬關係：可能需 IRB 或機構判定");
    return { judgment: "REVIEW_LIKELY_REQUIRED", reasons };
  }
  reasons.push("初步判斷可能符合豁免條件，但正式判定需機構確認");
  return { judgment: "EXEMPTION_MAY_APPLY", reasons };
}

export async function runEthicsScreening(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const scope = await client.query(`SELECT item_key AS "itemKey", answer FROM ethics_scope_items WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]);
    const items = scope.rows.map((r: Record<string, unknown>) => ({ itemKey: text(r.itemKey), answer: text(r.answer) }));
    const { judgment, reasons } = deriveJudgment(items);
    // 教師與學生權力檢查：研究對象為主持人本人授課學生
    const includesOwnStudents = await getIncludesOwnStudents(client, tenant, ensured.id);
    let teacherPowerStatus = "NOT_CHECKED";
    let teacherPowerSeverity: string | null = null;
    if (includesOwnStudents) {
      teacherPowerStatus = "TEACHER_STUDENT_POWER_RISK";
      teacherPowerSeverity = "MAJOR";
    }
    const summary = { judgment, reasons, includesOwnStudents, teacherPowerStatus, judgedAt: new Date().toISOString() };
    const effectiveJudgment = judgment === "EXEMPTION_MAY_APPLY" ? "INSTITUTIONAL_CONFIRMATION_REQUIRED" : judgment;
    await client.query(`UPDATE research_ethics_assessments SET judgment_status=$3, teacher_power_status=$4, teacher_power_severity=$5, summary=$6::jsonb, status=$7, updated_at=now() WHERE id=$8 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, effectiveJudgment, teacherPowerStatus, teacherPowerSeverity, JSON.stringify(summary), ensured.status === "NOT_STARTED" ? "DRAFT" : ensured.status, ensured.id]);
    await audit(client, tenant, input.userId, "ETHICS_SCREENING_RUN", { judgment: effectiveJudgment, teacherPowerStatus });
    return { ok: true, judgment: effectiveJudgment, reasons, teacherPowerStatus, teacherPowerSeverity, includesOwnStudents };
  });
}

async function getIncludesOwnStudents(client: PoolClient, tenant: ResearchTenant, assessmentId: string): Promise<boolean> {
  const students = await client.query(`SELECT answer FROM ethics_scope_items WHERE ${tenantWhere()} AND assessment_id=$3 AND item_key='students'`, [tenant.workspaceId, tenant.projectId, assessmentId]);
  return students.rows[0] ? text((students.rows[0] as Record<string, unknown>).answer) === "YES" : false;
}

// ---------- 儲存 Risk Register ----------
export async function saveEthicsRiskItems(tenant: ResearchTenant, input: { userId: string; items: { riskKey: string; likelihood?: string; severity?: string; affectedPopulation?: string; mitigation?: string; monitoring?: string; responsiblePerson?: string; residualRisk?: string; status?: string }[] }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    for (const item of input.items) {
      await client.query(`UPDATE ethics_risk_items SET likelihood=$3, severity=$4, affected_population=$5, mitigation=$6, monitoring=$7, responsible_person=$8, residual_risk=$9, status=$10, updated_at=now() WHERE ${tenantWhere()} AND assessment_id=$11 AND risk_key=$12`, [tenant.workspaceId, tenant.projectId, item.likelihood ?? "UNLIKELY", item.severity ?? "MINOR", item.affectedPopulation ?? null, item.mitigation ?? null, item.monitoring ?? null, item.responsiblePerson ?? null, item.residualRisk ?? "UNASSESSED", item.status ?? "OPEN", ensured.id, item.riskKey]);
    }
    await audit(client, tenant, input.userId, "ETHICS_RISK_REGISTER_SAVED", { count: input.items.length });
    return { ok: true, count: input.items.length };
  });
}

// ---------- IRB 文件（狀態受控） ----------
export async function saveEthicsDocument(tenant: ResearchTenant, input: { userId: string; documentType: string; content?: string; status?: string }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const doc = await client.query(`SELECT id, content, status, version_number AS "version" FROM ethics_documents WHERE ${tenantWhere()} AND assessment_id=$3 AND document_type=$4`, [tenant.workspaceId, tenant.projectId, ensured.id, input.documentType]);
    if (!doc.rows[0]) throw new Error("ethics_document_type_unknown");
    const row = doc.rows[0] as Record<string, unknown>;
    const allowedStatuses = ["NOT_STARTED", "DRAFT", "USER_REVIEW_REQUIRED", "INSTITUTION_REVIEW_REQUIRED", "SUBMITTED", "REVISION_REQUIRED", "APPROVED", "EXPIRED"];
    const nextStatus = input.status && allowedStatuses.includes(input.status) ? input.status : (input.content?.trim() ? "DRAFT" : "NOT_STARTED");
    // SUBMITTED／APPROVED 必須使用者明確操作（前端傳 status）或正式決策存在
    if ((nextStatus === "SUBMITTED" || nextStatus === "APPROVED") && !input.status) throw new Error("ethics_status_requires_explicit_action");
    if (nextStatus === "APPROVED") {
      const decision = await client.query(`SELECT 1 FROM institutional_ethics_decisions WHERE ${tenantWhere()} AND assessment_id=$3 AND approval_status='APPROVED' AND verified_by_user=true LIMIT 1`, [tenant.workspaceId, tenant.projectId, ensured.id]);
      if (!decision.rows[0]) throw new Error("ethics_approval_requires_official_decision");
    }
    const content = typeof input.content === "string" ? input.content : text(row.content);
    const nextVersion = int(row.version) + (content !== text(row.content) || nextStatus !== text(row.status) ? 1 : 0);
    const contentHash = hash({ documentType: input.documentType, content, status: nextStatus, version: nextVersion });
    await client.query(`UPDATE ethics_documents SET content=$3, status=$4, version_number=$5, source_hash=$6, updated_at=now() WHERE id=$7 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, content, nextStatus, nextVersion, contentHash, text(row.id)]);
    await audit(client, tenant, input.userId, "ETHICS_DOCUMENT_UPDATED", { documentType: input.documentType, status: nextStatus, version: nextVersion });
    return { ok: true, documentType: input.documentType, status: nextStatus, version: nextVersion };
  });
}

// ---------- Institutional Ethics Decision（正式判定） ----------
export async function saveInstitutionalEthicsDecision(tenant: ResearchTenant, input: { userId: string; decision: { id?: string; institution: string; decisionType: string; applicationNumber?: string; approvalNumber?: string; decisionDate?: string; expiryDate?: string; approvedDocuments?: unknown[]; conditions?: unknown[]; fileReference?: string; verifiedByUser?: boolean; approvalStatus?: string } }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const approvalStatus = input.decision.approvalStatus && ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "WITHDRAWN"].includes(input.decision.approvalStatus) ? input.decision.approvalStatus : "PENDING";
    // 沒有正式文件 → 不得 APPROVED
    if (approvalStatus === "APPROVED" && !(input.decision.verifiedByUser && input.decision.approvalNumber && input.decision.decisionDate)) {
      return { ok: false, error: "ethics_approval_requires_official_document" };
    }
    if (input.decision.id) {
      await client.query(`UPDATE institutional_ethics_decisions SET institution=$3, decision_type=$4, application_number=$5, approval_number=$6, decision_date=$7, expiry_date=$8, approved_documents=$9::jsonb, conditions=$10::jsonb, verified_by_user=$11, file_reference=$12, approval_status=$13, updated_at=now() WHERE id=$14 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, input.decision.institution, input.decision.decisionType, input.decision.applicationNumber ?? null, input.decision.approvalNumber ?? null, input.decision.decisionDate ?? null, input.decision.expiryDate ?? null, JSON.stringify(input.decision.approvedDocuments ?? []), JSON.stringify(input.decision.conditions ?? []), Boolean(input.decision.verifiedByUser), input.decision.fileReference ?? null, approvalStatus, input.decision.id]);
    } else {
      await client.query(`INSERT INTO institutional_ethics_decisions (id,workspace_id,project_id,assessment_id,institution,decision_type,application_number,approval_number,decision_date,expiry_date,approved_documents,conditions,verified_by_user,file_reference,approval_status,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,now(),now())`, [tenant.workspaceId, tenant.projectId, ensured.id, `ied_${randomUUID()}`, input.decision.institution, input.decision.decisionType, input.decision.applicationNumber ?? null, input.decision.approvalNumber ?? null, input.decision.decisionDate ?? null, input.decision.expiryDate ?? null, JSON.stringify(input.decision.approvedDocuments ?? []), JSON.stringify(input.decision.conditions ?? []), Boolean(input.decision.verifiedByUser), input.decision.fileReference ?? null, approvalStatus, input.userId]);
    }
    await audit(client, tenant, input.userId, "INSTITUTIONAL_ETHICS_DECISION_SAVED", { institution: input.decision.institution, approvalStatus });
    return { ok: true, approvalStatus };
  });
}

// ---------- Data Management Plan ----------
export async function saveDmp(tenant: ResearchTenant, input: { userId: string; sections: Record<string, string>; status?: string }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const existing = await client.query(`SELECT version_number AS "version" FROM data_management_plans WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]);
    const version = int(existing.rows[0]?.version ?? 0) + 1;
    const status = input.status && ["NOT_STARTED", "DRAFT", "REVIEW_REQUIRED", "COMPLETE", "OUTDATED"].includes(input.status) ? input.status : "DRAFT";
    const fingerprint = hash({ sections: input.sections, status });
    await client.query(`UPDATE data_management_plans SET sections=$3::jsonb, status=$4, version_number=$5, source_fingerprint=$6, updated_at=now() WHERE ${tenantWhere()} AND assessment_id=$7`, [tenant.workspaceId, tenant.projectId, JSON.stringify(input.sections), status, version, fingerprint, ensured.id]);
    await audit(client, tenant, input.userId, "DATA_MANAGEMENT_PLAN_SAVED", { version });
    return { ok: true, version, status };
  });
}

// ---------- Preregistration（append-only） ----------
export async function savePreregistration(tenant: ResearchTenant, input: { userId: string; fields: Record<string, unknown> }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const plan = await client.query(`SELECT id, current_version_number AS "version", status, registration_url AS "registrationUrl", registration_id AS "registrationId" FROM preregistration_plans WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]);
    const planId = text((plan.rows[0] as Record<string, unknown>).id);
    const version = int((plan.rows[0] as Record<string, unknown>).version ?? 0) + 1;
    const payload: Record<string, unknown> = { ...input.fields, savedAt: new Date().toISOString() };
    const contentHash = hash(payload);
    await client.query(`INSERT INTO preregistration_versions (id,workspace_id,project_id,plan_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ($4,$1,$2,$3,$3,$5,NULL,$9,'預註冊內容更新',$6,$7::jsonb,$8,now())`, [tenant.workspaceId, tenant.projectId, planId, `prv_${randomUUID()}`, version, contentHash, JSON.stringify(payload), input.userId, `v${version}`]);
    // 對應欄位寫入（白名單）
    const allowed = ["designType", "registrationType", "platformCandidate", "primaryOutcome", "secondaryOutcomes", "hypotheses", "samplePlan", "exclusionRules", "stoppingRule", "missingDataStrategy", "outlierStrategy", "mainAnalysis", "exploratoryAnalysis"];
    const sets: string[] = []; const params: unknown[] = [tenant.workspaceId, tenant.projectId, planId];
    allowed.forEach((key) => { if (input.fields[key] !== undefined) { sets.push(`${snake(key)}=$${params.length + 1}`); params.push(input.fields[key]); } });
    sets.push(`current_version_number=$${params.length + 1}`); params.push(version);
    await client.query(`UPDATE preregistration_plans SET ${sets.join(", ")}, updated_at=now() WHERE ${tenantWhere()} AND id=$3`, params);
    const currentStatus = text((plan.rows[0] as Record<string, unknown>).status);
    const nextStatus = currentStatus === "NOT_STARTED" ? "PLANNED" : currentStatus;
    await client.query(`UPDATE preregistration_plans SET current_version_number=$3, status=$4, updated_at=now() WHERE ${tenantWhere()} AND id=$5`, [tenant.workspaceId, tenant.projectId, version, nextStatus, planId]);
    await audit(client, tenant, input.userId, "PREREGISTRATION_SAVED", { version });
    return { ok: true, version, status: nextStatus };
  });
}

export async function registerPreregistration(tenant: ResearchTenant, input: { userId: string; registrationUrl: string; registrationId?: string }) {
  return withClient(async (client) => {
    if (!/^https?:\/\//.test(input.registrationUrl)) throw new Error("preregistration_url_invalid");
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const plan = await client.query(`SELECT id FROM preregistration_plans WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]);
    if (!plan.rows[0]) throw new Error("preregistration_plan_required");
    const planId = text((plan.rows[0] as Record<string, unknown>).id);
    await client.query(`UPDATE preregistration_plans SET registration_url=$3, registration_id=$4, status='REGISTERED', registered_at=now(), updated_at=now() WHERE ${tenantWhere()} AND id=$5`, [tenant.workspaceId, tenant.projectId, input.registrationUrl, input.registrationId ?? null, planId]);
    await audit(client, tenant, input.userId, "PREREGISTRATION_REGISTERED", { registrationUrl: input.registrationUrl, registrationId: input.registrationId ?? null });
    return { ok: true, status: "REGISTERED" };
  });
}

export async function amendPreregistration(tenant: ResearchTenant, input: { userId: string; reason: string; changes: unknown[] }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const plan = await client.query(`SELECT id, current_version_number AS "version", status FROM preregistration_plans WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]);
    if (!plan.rows[0]) throw new Error("preregistration_plan_required");
    const row = plan.rows[0] as Record<string, unknown>;
    const planId = text(row.id);
    const version = int(row.version ?? 0) + 1;
    const payload = { reason: input.reason, changes: input.changes, amendedAt: new Date().toISOString() };
    const contentHash = hash(payload);
    const versionId = `prv_${randomUUID()}`;
    await client.query(`INSERT INTO preregistration_versions (id,workspace_id,project_id,plan_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ($4,$1,$2,$3,$3,$5,NULL,$9,$6,$7,$8::jsonb,$10,now())`, [tenant.workspaceId, tenant.projectId, planId, versionId, version, input.reason, contentHash, JSON.stringify(payload), `v${version} amendment`, input.userId]);
    await client.query(`INSERT INTO preregistration_amendments (id,workspace_id,project_id,plan_id,from_version_id,to_version_id,reason,changes,created_by_user_id,created_at) VALUES ($4,$1,$2,$3,NULL,$5,$6,$7::jsonb,$8,now())`, [tenant.workspaceId, tenant.projectId, planId, `pram_${randomUUID()}`, versionId, input.reason, JSON.stringify(input.changes), input.userId]);
    await client.query(`UPDATE preregistration_plans SET current_version_number=$3, status='AMENDED', updated_at=now() WHERE ${tenantWhere()} AND id=$4`, [tenant.workspaceId, tenant.projectId, version, planId]);
    await audit(client, tenant, input.userId, "PREREGISTRATION_AMENDED", { version, reason: input.reason });
    return { ok: true, version, status: "AMENDED" };
  });
}

// ---------- Journal Pre-study Readiness ----------
export async function saveJournalReadiness(tenant: ResearchTenant, input: { userId: string; items: { key: string; status: string; note?: string }[] }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const items = JOURNAL_READINESS_ITEMS.map((spec) => {
      const found = input.items.find((i) => i.key === spec.key);
      return { key: spec.key, label: spec.label, status: found?.status ?? "NOT_STARTED", note: found?.note ?? "" };
    });
    const notReady = items.filter((i) => i.status !== "READY" && i.status !== "NOT_APPLICABLE").length;
    const overall = notReady === 0 ? "READY" : items.some((i) => i.status !== "NOT_STARTED") ? "IN_PROGRESS" : "NOT_STARTED";
    const fingerprint = hash({ items, overall });
    await client.query(`UPDATE journal_study_readiness_reviews SET items=$3::jsonb, overall=$4, version='v1.0', source_fingerprint=$5, updated_at=now() WHERE ${tenantWhere()} AND assessment_id=$6`, [tenant.workspaceId, tenant.projectId, JSON.stringify(items), overall, fingerprint, ensured.id]);
    await audit(client, tenant, input.userId, "JOURNAL_READINESS_SAVED", { overall, notReady });
    return { ok: true, overall, notReady };
  });
}

// ---------- Gate：ETHICS_SCOPE_DETERMINED / ETHICS_PACKAGE_PREPARED ----------
const ETHICS_SCOPE_CHECKS: { key: string; label: string; check: (ctx: Record<string, unknown>) => { pass: boolean; detail: string } }[] = [
  { key: "screening_completed", label: "已完成 Ethics Scope Screening（25 項）", check: (ctx) => ({ pass: ctx.screeningStatus === "COMPLETED", detail: `已答 ${ctx.answered ?? 0}/25 項` }) },
  { key: "judgment_determined", label: "已確認是否可能需要 IRB", check: (ctx) => ({ pass: Boolean(ctx.judgment) && ctx.judgment !== "INSUFFICIENT_INFORMATION", detail: `判定：${ctx.judgment ?? "尚未判定"}` }) },
  { key: "risk_register", label: "已建立倫理風險清單", check: (ctx) => ({ pass: Boolean(ctx.riskRegisterCount && Number(ctx.riskRegisterCount) >= 15), detail: `風險項目 ${ctx.riskRegisterCount ?? 0}/15` }) },
  { key: "dmp_created", label: "已建立 Data Management Plan", check: (ctx) => ({ pass: Boolean(ctx.dmpStatus) && ctx.dmpStatus !== "NOT_STARTED", detail: `DMP 狀態：${ctx.dmpStatus ?? "尚未建立"}` }) },
  { key: "preregistration_planned", label: "已建立預註冊規劃", check: (ctx) => ({ pass: Boolean(ctx.preregistrationStatus) && ctx.preregistrationStatus !== "NOT_STARTED", detail: `預註冊：${ctx.preregistrationStatus ?? "尚未建立"}` }) },
  { key: "readiness_reviewed", label: "已完成 Journal Pre-study Readiness Review", check: (ctx) => ({ pass: Boolean(ctx.readinessOverall) && ctx.readinessOverall !== "NOT_STARTED", detail: `Readiness：${ctx.readinessOverall ?? "尚未執行"}` }) },
];

export async function approveEthicsGate(tenant: ResearchTenant, input: { userId: string; gateType: "ETHICS_SCOPE_DETERMINED" | "ETHICS_PACKAGE_PREPARED"; payload?: Record<string, unknown> }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const assessment = await client.query(`SELECT status, screening_status AS "screeningStatus", judgment_status AS "judgment", summary FROM research_ethics_assessments WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]);
    if (!assessment.rows[0]) throw new Error("ethics_assessment_required");
    const row = assessment.rows[0] as Record<string, unknown>;
    const [scopeCount, riskCount, dmpStatus, preregStatus, readinessOverall] = await Promise.all([
      client.query(`SELECT count(*)::int AS "n" FROM ethics_scope_items WHERE ${tenantWhere()} AND assessment_id=$3 AND status='ANSWERED'`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT count(*)::int AS "n" FROM ethics_risk_items WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT status FROM data_management_plans WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT status FROM preregistration_plans WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]),
      client.query(`SELECT overall FROM journal_study_readiness_reviews WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, ensured.id]),
    ]);
    const ctx: Record<string, unknown> = {
      screeningStatus: text(row.screeningStatus),
      answered: scopeCount.rows[0]?.n ?? 0,
      judgment: text(row.judgment),
      riskRegisterCount: riskCount.rows[0]?.n ?? 0,
      dmpStatus: dmpStatus.rows[0] ? text(dmpStatus.rows[0].status) : "NOT_STARTED",
      preregistrationStatus: preregStatus.rows[0] ? text(preregStatus.rows[0].status) : "NOT_STARTED",
      readinessOverall: readinessOverall.rows[0] ? text(readinessOverall.rows[0].overall) : "NOT_STARTED",
      route: source.primaryRoute,
      ...(input.payload ?? {}),
    };
    // 預註冊與 Journal Readiness 僅 JOURNAL 路線需要；NSTC／MOE 以提案書內倫理規劃為主
    const routeChecks = ETHICS_SCOPE_CHECKS.filter((check) => check.key !== "preregistration_planned" && check.key !== "readiness_reviewed" || source.primaryRoute === "JOURNAL");
    const results = routeChecks.map((check) => ({ key: check.key, label: check.label, ...check.check(ctx) }));
    const failed = results.filter((r) => !r.pass);
    const gateState = { checkedAt: new Date().toISOString(), results };
    if (failed.length) {
      await client.query(`UPDATE research_ethics_assessments SET gate_state=$3::jsonb, status='DRAFT', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), ensured.id]);
      return { ok: false, failed, gateState, status: "DRAFT" };
    }
    // Lock：寫入 human gate
    const gateId = `hg_${randomUUID()}`;
    await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,'research_ethics_assessment',$6,$7,'APPROVED',$3,now(),now(),now())`, [tenant.workspaceId, tenant.projectId, input.userId, gateId, input.gateType, ensured.id, hash(gateState)]);
    await client.query(`UPDATE research_ethics_assessments SET gate_state=$3::jsonb, status='DRAFT', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), ensured.id]);
    await audit(client, tenant, input.userId, `${input.gateType}_APPROVED`, { assessmentId: ensured.id, humanGateId: gateId });
    return { ok: true, gateType: input.gateType, humanGateId: gateId, gateState, status: "DRAFT" };
  });
}

// ---------- OUTDATED 標記 ----------
export async function markEthicsOutdated(tenant: ResearchTenant, input: { userId: string; reason: string; sourceTable: string; sourceId?: string }) {
  return withClient(async (client) => {
    const rows = await client.query(`SELECT id FROM research_ethics_assessments WHERE ${tenantWhere()} AND status <> 'NOT_STARTED'`, [tenant.workspaceId, tenant.projectId]);
    for (const row of rows.rows) {
      const id = text((row as Record<string, unknown>).id);
      await client.query(`UPDATE research_ethics_assessments SET status='OUTDATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, id]);
      await client.query(`UPDATE data_management_plans SET status='OUTDATED', updated_at=now() WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, id]);
      await client.query(`UPDATE journal_study_readiness_reviews SET overall='OUTDATED', updated_at=now() WHERE ${tenantWhere()} AND assessment_id=$3`, [tenant.workspaceId, tenant.projectId, id]);
    }
    await audit(client, tenant, input.userId, "ETHICS_MARKED_OUTDATED", { sourceTable: input.sourceTable, sourceId: input.sourceId ?? null, reason: input.reason });
    return { ok: true, marked: rows.rows.length };
  });
}

// ---------- AI 草稿（文件內容，PROVISIONAL；不產生判定） ----------
export async function aiDraftEthicsDocuments(tenant: ResearchTenant, input: { userId: string; documentTypes: string[]; projectTitle?: string; designSummary?: string }) {
  return withClient(async (client) => {
    const source = await loadEthicsSource(client as never, tenant);
    const ensured = await ensureEthicsAssessment(client, tenant, { userId: input.userId, source });
    const types = input.documentTypes.filter((t) => ETHICS_DOCUMENT_TYPES.some((d) => d.type === t));
    if (!types.length) return { ok: false, error: "ethics_document_type_unknown" };
    const messages: OpenClawMessage[] = [
      { role: "system", content: "你是老麥（Old Mike），嚴謹的科研倫理文件助手。輸出必須是 JSON（不加前言、不用 markdown），只使用提供的資料，不得虛構 IRB 判定、核准號碼、核准日期、機構名稱或任何已定案事實；所有內容標示 PROVISIONAL（草稿供研究者審閱）。輸出格式：{ \"documents\": { \"<TYPE>\": { \"content\": string, \"notes\": string } } }。" },
      { role: "user", content: `專案題目：${input.projectTitle || source.projectTitle}\n研究設計摘要：${input.designSummary || "（未提供）"}\n請為以下文件類型各產生一版草稿：${types.join("、")}。不得宣稱已送審或已核准；未確認資訊一律標示【待研究者確認】。` },
    ];
    const result = await callOpenClaw(messages, `ethics:${tenant.workspaceId}:${tenant.projectId}`, "ASSIST_ETHICS_DRAFT", undefined);
    if (result.kind !== "success") return { ok: false, error: result.kind === "demo" ? "目前為展示模式，AI 草稿未實際執行。" : "AI 草稿目前無法執行；請稍後重試。" };
    const parsed = tryParseJson(result.content);
    const docs = record(parsed?.documents) ? parsed.documents as Record<string, unknown> : {};
    let written = 0;
    for (const type of types) {
      const entry = record(docs[type]) ? docs[type] as Record<string, unknown> : null;
      const content = entry ? str(entry.content) : "";
      if (!content) continue;
      const doc = await client.query(`SELECT id, content FROM ethics_documents WHERE ${tenantWhere()} AND assessment_id=$3 AND document_type=$4`, [tenant.workspaceId, tenant.projectId, ensured.id, type]);
      if (!doc.rows[0]) continue;
      await client.query(`UPDATE ethics_documents SET content=$3, status='DRAFT', version_number=version_number+1, source_hash=$4, updated_at=now() WHERE id=$5 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, content, hash({ type, content, status: "DRAFT" }), text((doc.rows[0] as Record<string, unknown>).id)]);
      written += 1;
    }
    await audit(client, tenant, input.userId, "ETHICS_AI_DRAFT_GENERATED", { documentTypes: types, written });
    return { ok: true, written, total: types.length };
  });
}

function snake(value: string): string { return value.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`); }
function tryParseJson(textValue: string): Record<string, unknown> | null {
  const cleaned = textValue.replace(/,\s*([}\]])/g, "$1").replace(/'/g, '"').replace(/([{,}\s])(\w+)\s*:/g, "$1\"$2\":");
  try { const parsed = JSON.parse(cleaned); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>; } catch { /* ignore */ }
  const fenced = textValue.match(/```(?:json)?\s*([\s\S]*?)```/u);
  if (fenced) { try { const parsed = JSON.parse(fenced[1]); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>; } catch { /* ignore */ } }
  return null;
}
