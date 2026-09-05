import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("package_storage_unavailable");
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

type RouteKey = "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL";

// ---------- 申請包檔案規格（依 Route） ----------
export const NSTC_PACKAGE_FILES: { fileType: string; title: string }[] = [
  { fileType: "PROPOSAL_MAIN", title: "Proposal Main Document 計畫書主文" },
  { fileType: "ABSTRACT_ZH", title: "Chinese Abstract 中文摘要" },
  { fileType: "ABSTRACT_EN", title: "English Abstract 英文摘要" },
  { fileType: "KEYWORDS", title: "Keywords 關鍵詞" },
  { fileType: "RESEARCHER_CHECKLIST", title: "Researcher Information Checklist 主持人資料檢查表" },
  { fileType: "PI_FIT_STATEMENT", title: "PI Fit Statement 主持人適任性說明" },
  { fileType: "WORK_PACKAGE_TABLE", title: "Work Package Table 工作包表" },
  { fileType: "TIMELINE", title: "Timeline 時程表" },
  { fileType: "MILESTONES", title: "Milestones 里程碑" },
  { fileType: "EXPECTED_OUTPUTS", title: "Expected Outputs 預期成果" },
  { fileType: "BUDGET_SHEET", title: "Budget Planning Sheet 經費規劃表" },
  { fileType: "EQUIPMENT_RESOURCES", title: "Equipment and Resource List 設備與資源清單" },
  { fileType: "ETHICS_STATEMENT", title: "Ethics Planning Statement 倫理規劃聲明" },
  { fileType: "DATA_MANAGEMENT_STATEMENT", title: "Data Management Statement 資料管理聲明" },
  { fileType: "DUPLICATE_FUNDING_DISCLOSURE", title: "Duplicate Funding Disclosure 重複補助揭露" },
  { fileType: "ATTACHMENTS_CHECKLIST", title: "Required Attachments Checklist 附件檢查表" },
  { fileType: "OFFICIAL_COMPLIANCE_REPORT", title: "Official Compliance Report 官方合規報告" },
  { fileType: "REVIEWER_FINDINGS_REPORT", title: "Reviewer Findings Report 模擬審查發現報告" },
];

export const MOE_PACKAGE_FILES: { fileType: string; title: string }[] = [
  { fileType: "PROPOSAL_MAIN", title: "Proposal Main Document 計畫書主文" },
  { fileType: "ABSTRACT", title: "Abstract 摘要" },
  { fileType: "COURSE_PROFILE", title: "Course Profile 課程資料" },
  { fileType: "SYLLABUS_CHECKLIST", title: "Syllabus Checklist 授課計畫檢查表" },
  { fileType: "TEACHING_PROBLEM_EVIDENCE", title: "Teaching Problem Evidence 教學問題證據" },
  { fileType: "COURSE_RESEARCH_ALIGNMENT", title: "Course–Research Alignment Matrix 課程—研究一致性矩陣" },
  { fileType: "TEACHING_INTERVENTION_PLAN", title: "Teaching Intervention Plan 教學介入計畫" },
  { fileType: "LEARNING_OUTCOME_MATRIX", title: "Student Learning Outcome Matrix 學習成果矩陣" },
  { fileType: "ASSESSMENT_PLAN", title: "Assessment Plan 評量計畫" },
  { fileType: "RESEARCH_METHOD", title: "Research Method 研究方法" },
  { fileType: "ETHICS_STUDENT_RIGHTS", title: "Ethics and Student Rights Plan 倫理與學生權益計畫" },
  { fileType: "BUDGET_SHEET", title: "Budget Planning Sheet 經費規劃表" },
  { fileType: "DISSEMINATION_PLAN", title: "Dissemination Plan 推廣計畫" },
  { fileType: "ATTACHMENTS_CHECKLIST", title: "Required Attachments Checklist 附件檢查表" },
  { fileType: "OFFICIAL_COMPLIANCE_REPORT", title: "Official Compliance Report 官方合規報告" },
  { fileType: "REVIEWER_FINDINGS_REPORT", title: "Reviewer Findings Report 模擬審查發現報告" },
];

const FILE_SPECS: Record<RouteKey, { fileType: string; title: string }[]> = {
  NSTC_PROPOSAL: NSTC_PACKAGE_FILES,
  MOE_TPR_PROPOSAL: MOE_PACKAGE_FILES,
};

// ---------- 進入條件：提案書 Gate＋合規 Gate ----------
async function gateApproved(client: PoolClient, tenant: ResearchTenant, gateType: string): Promise<boolean> {
  const gate = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, gateType]);
  return Boolean(gate.rows[0]);
}

// ---------- Package row（idempotent） ----------
async function ensurePackage(client: PoolClient, tenant: ResearchTenant, route: RouteKey, userId: string): Promise<{ id: string; existed: boolean }> {
  const existing = await client.query(`SELECT id FROM proposal_application_packages WHERE ${tenantWhere()} AND route=$3`, [tenant.workspaceId, tenant.projectId, route]);
  if (existing.rows[0]) return { id: text((existing.rows[0] as Record<string, unknown>).id), existed: true };
  const id = `pap_${randomUUID()}`;
  await client.query(`INSERT INTO proposal_application_packages (id,workspace_id,project_id,route,status,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,'NOT_STARTED',$5,now(),now())`, [tenant.workspaceId, tenant.projectId, route, id, userId]);
  for (const spec of FILE_SPECS[route]) {
    await client.query(`INSERT INTO proposal_package_files (id,workspace_id,project_id,package_id,file_type,title,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,now(),now())`, [tenant.workspaceId, tenant.projectId, id, `ppf_${randomUUID()}`, spec.fileType, spec.title, userId]);
  }
  return { id, existed: false };
}

// ---------- 主讀取 ----------
export async function getApplicationPackage(tenant: ResearchTenant, input: { userId: string; route: RouteKey }) {
  return withClient(async (client) => {
    const route = input.route;
    const draftGateType = route === "NSTC_PROPOSAL" ? "NSTC_PROPOSAL_DRAFT_RELEASE" : "MOE_TPR_PROPOSAL_DRAFT_RELEASE";
    const draftApproved = await gateApproved(client, tenant, draftGateType);
    if (!draftApproved) {
      return { ok: true, locked: true, route, lockedReason: [`${draftGateType}：需先完成計畫書初稿（研究路線工作室）`] };
    }
    const { id } = await ensurePackage(client, tenant, route, input.userId);
    // 補齊缺失檔案列（既有 package 升級用）＋聚合報告自動生成
    const existingFiles = await client.query(`SELECT file_type AS "fileType", content FROM proposal_package_files WHERE ${tenantWhere()} AND package_id=$3`, [tenant.workspaceId, tenant.projectId, id]);
    const haveTypes = new Set(existingFiles.rows.map((r: Record<string, unknown>) => text(r.fileType)));
    for (const spec of FILE_SPECS[route]) {
      if (haveTypes.has(spec.fileType)) continue;
      await client.query(`INSERT INTO proposal_package_files (id,workspace_id,project_id,package_id,file_type,title,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,now(),now())`, [tenant.workspaceId, tenant.projectId, id, `ppf_${randomUUID()}`, spec.fileType, spec.title, input.userId]);
    }
    const aggregateTypes = ["OFFICIAL_COMPLIANCE_REPORT", "REVIEWER_FINDINGS_REPORT"];
    for (const aggregateType of aggregateTypes) {
      const existing = existingFiles.rows.find((r: Record<string, unknown>) => text(r.fileType) === aggregateType);
      const content = existing ? text(existing.content) : "";
      if (content.trim()) continue;
      const synthesized = aggregateType === "OFFICIAL_COMPLIANCE_REPORT" ? await synthesizeComplianceReport(client, tenant, route) : await synthesizeReviewerReport(client, tenant, route);
      if (!synthesized) continue;
      await client.query(`UPDATE proposal_package_files SET content=$3, status='DRAFT', generated_at=now(), updated_at=now() WHERE ${tenantWhere()} AND package_id=$4 AND file_type=$5`, [tenant.workspaceId, tenant.projectId, synthesized, id, aggregateType]);
    }
    const packageRow = await client.query(`SELECT id, status, version_number AS "version", source_fingerprint AS "sourceFingerprint", updated_at AS "updatedAt" FROM proposal_application_packages WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, id]);
    const files = await client.query(`SELECT id, file_type AS "fileType", title, content, version, generated_at AS "generatedAt", approved_by_user AS "approvedByUser", source_sections AS "sourceSections", evidence_links AS "evidenceLinks", status, updated_at AS "updatedAt" FROM proposal_package_files WHERE ${tenantWhere()} AND package_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, id]);
    const submission = await client.query(`SELECT id, route, status, evidence, updated_by_user_id AS "updatedByUserId", created_at AS "createdAt", updated_at AS "updatedAt" FROM proposal_submission_records WHERE ${tenantWhere()} AND route=$3`, [tenant.workspaceId, tenant.projectId, route]);
    const decisions = await client.query(`SELECT id, route, authority, decision, decision_date AS "decisionDate", amount, application_number AS "applicationNumber", conditions, file_reference AS "fileReference", verified_by_user AS "verifiedByUser", created_at AS "createdAt" FROM grant_decision_records WHERE ${tenantWhere()} AND route=$3 ORDER BY created_at DESC`, [tenant.workspaceId, tenant.projectId, route]);
    // Gate 狀態
    const internalGate = route === "NSTC_PROPOSAL" ? "NSTC_INTERNAL_REVIEW_PASSED" : "MOE_TPR_INTERNAL_REVIEW_PASSED";
    const complianceGate = route === "NSTC_PROPOSAL" ? "NSTC_COMPLIANCE_PASSED" : "MOE_TPR_COMPLIANCE_PASSED";
    const packageGate = route === "NSTC_PROPOSAL" ? "NSTC_APPLICATION_PACKAGE_READY" : "MOE_TPR_APPLICATION_PACKAGE_READY";
    const [internalApproved, complianceApproved, packageApproved] = await Promise.all([
      gateApproved(client, tenant, internalGate),
      gateApproved(client, tenant, complianceGate),
      gateApproved(client, tenant, packageGate),
    ]);
    const approvedFiles = files.rows.filter((r: Record<string, unknown>) => Boolean(r.approvedByUser));
    const ready = Boolean(internalApproved) && Boolean(complianceApproved) && approvedFiles.length === FILE_SPECS[route].length;
    return {
      ok: true,
      locked: false,
      route,
      package: packageRow.rows[0] ? { ...packageRow.rows[0], files: files.rows } : null,
      submission: submission.rows[0] ?? null,
      grantDecisions: decisions.rows,
      gates: { internalApproved, complianceApproved, packageApproved, ready },
      fileSpecs: FILE_SPECS[route],
      lockedReason: [],
    };
  });
}

// ---------- 儲存檔案內容 ----------
export async function savePackageFile(tenant: ResearchTenant, input: { userId: string; route: RouteKey; fileType: string; content: string; sourceSections?: unknown[]; evidenceLinks?: unknown[] }) {
  return withClient(async (client) => {
    const { id } = await ensurePackage(client, tenant, input.route, input.userId);
    const file = await client.query(`SELECT id, content, status, approved_by_user AS "approvedByUser" FROM proposal_package_files WHERE ${tenantWhere()} AND package_id=$3 AND file_type=$4`, [tenant.workspaceId, tenant.projectId, id, input.fileType]);
    if (!file.rows[0]) return { ok: false, error: "package_file_type_unknown" };
    const row = file.rows[0] as Record<string, unknown>;
    if (Boolean(row.approvedByUser) && input.content !== text(row.content)) return { ok: false, error: "package_file_approved_locked" };
    const nextStatus = input.content.trim() ? "DRAFT" : "NOT_STARTED";
    await client.query(`UPDATE proposal_package_files SET content=$3, source_sections=$4::jsonb, evidence_links=$5::jsonb, status=$6, generated_at=now(), updated_at=now() WHERE id=$7 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, input.content, JSON.stringify(input.sourceSections ?? []), JSON.stringify(input.evidenceLinks ?? []), nextStatus, text(row.id)]);
    const version = await client.query(`SELECT version_number AS "version" FROM proposal_application_packages WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, id]);
    await client.query(`UPDATE proposal_application_packages SET status='DRAFT', version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, int(version.rows[0]?.version ?? 0) + 1, id]);
    await audit(client, tenant, input.userId, "PACKAGE_FILE_SAVED", { route: input.route, fileType: input.fileType, status: nextStatus });
    return { ok: true, fileType: input.fileType, status: nextStatus };
  });
}

export async function approvePackageFile(tenant: ResearchTenant, input: { userId: string; route: RouteKey; fileType: string }) {
  return withClient(async (client) => {
    const { id } = await ensurePackage(client, tenant, input.route, input.userId);
    const file = await client.query(`SELECT id, content FROM proposal_package_files WHERE ${tenantWhere()} AND package_id=$3 AND file_type=$4`, [tenant.workspaceId, tenant.projectId, id, input.fileType]);
    if (!file.rows[0]) return { ok: false, error: "package_file_type_unknown" };
    const content = text((file.rows[0] as Record<string, unknown>).content);
    if (!content.trim()) return { ok: false, error: "package_file_empty" };
    await client.query(`UPDATE proposal_package_files SET approved_by_user=true, status='APPROVED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, text((file.rows[0] as Record<string, unknown>).id)]);
    await audit(client, tenant, input.userId, "PACKAGE_FILE_APPROVED", { route: input.route, fileType: input.fileType });
    return { ok: true, fileType: input.fileType, status: "APPROVED" };
  });
}

// ---------- 聚合報告（只彙整既有資料，不虛構） ----------
async function synthesizeComplianceReport(client: PoolClient, tenant: ResearchTenant, route: RouteKey): Promise<string | null> {
  const targetYear = new Date().getUTCFullYear();
  const items = await client.query(`SELECT requirement, current_status AS "currentStatus", severity, verification_status AS "verificationStatus", evidence FROM compliance_items WHERE ${tenantWhere()} AND route=$3 AND target_year=$4 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, route, targetYear]);
  const snapshots = await client.query(`SELECT document_title AS "documentTitle", source_url AS "sourceUrl", verification_status AS "verificationStatus", retrieved_at AS "retrievedAt" FROM official_rule_snapshots WHERE ${tenantWhere()} AND authority=$3 AND target_year=$4 ORDER BY retrieved_at DESC`, [tenant.workspaceId, tenant.projectId, route === "NSTC_PROPOSAL" ? "NSTC" : "MOE_TPR", targetYear]);
  if (!items.rows.length && !snapshots.rows.length) return null;
  const lines: string[] = [`# Official Compliance Report（自動彙整 ${targetYear} 年度）`, `產生時間：${new Date().toISOString()}`, "", "⚠ 本報告僅彙整系統內記錄；年度規則未經官方來源驗證時以 PENDING_NEW_ANNOUNCEMENT 標示，不得宣稱符合新年度正式規範。", "", "## 官方規則來源快照", ...snapshots.rows.map((r: Record<string, unknown>) => `- ${text(r.documentTitle)}（${text(r.verificationStatus)}）${text(r.sourceUrl) ? `：${text(r.sourceUrl)}` : ""} ｜ 取得時間 ${text(r.retrievedAt)}`) , "", "## Compliance Matrix 現況", ...(items.rows.length ? items.rows.map((r: Record<string, unknown>) => `- [${text(r.currentStatus)}]${text(r.severity) === "FATAL" ? "（FATAL）" : ""} ${text(r.requirement)} ｜ 驗證：${text(r.verificationStatus)}${text(r.evidence) ? ` ｜ 佐證：${text(r.evidence)}` : ""}`) : ["（尚無合規項目記錄）"])];
  return lines.join("\n");
}

async function synthesizeReviewerReport(client: PoolClient, tenant: ResearchTenant, route: RouteKey): Promise<string | null> {
  const findings = await client.query(`SELECT f.reviewer_type AS "reviewerType", f.section_id AS "sectionId", f.issue, f.severity, f.status, f.required_revision AS "requiredRevision" FROM reviewer_findings f JOIN route_review_runs r ON r.id=f.review_run_id WHERE r.workspace_id=$1 AND r.project_id=$2 AND r.route=$3 AND f.status <> 'ACCEPTED_RISK' ORDER BY f.created_at DESC LIMIT 200`, [tenant.workspaceId, tenant.projectId, route]);
  if (!findings.rows.length) return null;
  const lines: string[] = [`# Reviewer Findings Report（SIMULATED REVIEW 彙整）`, `產生時間：${new Date().toISOString()}`, "", "⚠ 全部審查意見皆為內部模擬（SIMULATED REVIEW），非國科會／教育部正式審查意見。", "", ...findings.rows.map((r: Record<string, unknown>) => `- [${text(r.severity)}][${text(r.status)}]（${text(r.reviewerType)}／${text(r.sectionId)}）${text(r.issue)}${text(r.requiredRevision) ? ` → ${text(r.requiredRevision)}` : ""}`)];
  return lines.join("\n");
}

// ---------- 申請包 Gate：READY（需內部審查＋合規＋全檔案核准） ----------
export async function approvePackageGate(tenant: ResearchTenant, input: { userId: string; route: RouteKey }) {
  return withClient(async (client) => {
    const internalGate = input.route === "NSTC_PROPOSAL" ? "NSTC_INTERNAL_REVIEW_PASSED" : "MOE_TPR_INTERNAL_REVIEW_PASSED";
    const complianceGate = input.route === "NSTC_PROPOSAL" ? "NSTC_COMPLIANCE_PASSED" : "MOE_TPR_COMPLIANCE_PASSED";
    const packageGate = input.route === "NSTC_PROPOSAL" ? "NSTC_APPLICATION_PACKAGE_READY" : "MOE_TPR_APPLICATION_PACKAGE_READY";
    const failed: { key: string; label: string; detail: string }[] = [];
    if (!(await gateApproved(client, tenant, internalGate))) failed.push({ key: "internal_review", label: "內部審查 Gate 未通過", detail: "需先完成 Reviewer 模擬並通過 NSTC/MOE 內部審查 Gate" });
    if (!(await gateApproved(client, tenant, complianceGate))) failed.push({ key: "compliance", label: "官方合規 Gate 未通過", detail: "需先完成官方規範檢查並通過合規 Gate（FATAL 不得為 MISSING）" });
    const { id } = await ensurePackage(client, tenant, input.route, input.userId);
    const files = await client.query(`SELECT file_type AS "fileType", approved_by_user AS "approvedByUser" FROM proposal_package_files WHERE ${tenantWhere()} AND package_id=$3`, [tenant.workspaceId, tenant.projectId, id]);
    const required = FILE_SPECS[input.route].length;
    const approved = files.rows.filter((r: Record<string, unknown>) => Boolean(r.approvedByUser)).length;
    if (approved < required) failed.push({ key: "files", label: `申請包檔案未全部核准（${approved}/${required}）`, detail: "需逐檔檢視並標記核准" });
    if (failed.length) {
      await client.query(`UPDATE proposal_application_packages SET status='DRAFT', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, id]);
      return { ok: false, failed };
    }
    const gateId = `hg_${randomUUID()}`;
    await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,'proposal_application_package',$6,$7,'APPROVED',$3,now(),now(),now())`, [tenant.workspaceId, tenant.projectId, input.userId, gateId, packageGate, id, hash({ packageGate, approvedAt: new Date().toISOString() })]);
    await client.query(`UPDATE proposal_application_packages SET status='READY_FOR_INSTITUTIONAL_SUBMISSION', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, id]);
    await audit(client, tenant, input.userId, `${packageGate}_APPROVED`, { packageId: id, humanGateId: gateId });
    return { ok: true, gateType: packageGate, humanGateId: gateId };
  });
}

// ---------- Submission Record（狀態機器；需使用者操作） ----------
const SUBMISSION_STATUSES = ["NOT_READY", "INTERNAL_REVIEW", "READY_FOR_INSTITUTIONAL_SUBMISSION", "SUBMITTED_TO_INSTITUTION", "SUBMITTED_TO_AUTHORITY", "UNDER_REVIEW", "REVISION_REQUESTED", "APPROVED", "NOT_APPROVED", "WITHDRAWN"] as const;

export async function updateSubmissionRecord(tenant: ResearchTenant, input: { userId: string; route: RouteKey; status: string; evidence: string }) {
  return withClient(async (client) => {
    if (!(SUBMISSION_STATUSES as readonly string[]).includes(input.status)) return { ok: false, error: "submission_status_invalid" };
    // SUBMITTED_* 以上狀態必須有可驗證紀錄（evidence 必填）
    if (["SUBMITTED_TO_INSTITUTION", "SUBMITTED_TO_AUTHORITY", "UNDER_REVIEW", "REVISION_REQUESTED", "APPROVED", "NOT_APPROVED"].includes(input.status) && !input.evidence.trim()) {
      return { ok: false, error: "submission_requires_evidence" };
    }
    // APPROVED 需要 grant_decision_record 佐證
    if (input.status === "APPROVED") {
      const decision = await client.query(`SELECT 1 FROM grant_decision_records WHERE ${tenantWhere()} AND route=$3 AND decision='APPROVED' AND verified_by_user=true LIMIT 1`, [tenant.workspaceId, tenant.projectId, input.route]);
      if (!decision.rows[0]) return { ok: false, error: "submission_approved_requires_grant_record" };
    }
    const existing = await client.query(`SELECT id FROM proposal_submission_records WHERE ${tenantWhere()} AND route=$3`, [tenant.workspaceId, tenant.projectId, input.route]);
    if (existing.rows[0]) {
      await client.query(`UPDATE proposal_submission_records SET status=$3, evidence=$4, updated_by_user_id=$5, updated_at=now() WHERE id=$6 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, input.status, input.evidence, input.userId, text((existing.rows[0] as Record<string, unknown>).id)]);
    } else {
      await client.query(`INSERT INTO proposal_submission_records (id,workspace_id,project_id,route,status,evidence,updated_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,now(),now())`, [tenant.workspaceId, tenant.projectId, input.route, `psr_${randomUUID()}`, input.status, input.evidence, input.userId]);
    }
    await audit(client, tenant, input.userId, "SUBMISSION_RECORD_UPDATED", { route: input.route, status: input.status });
    return { ok: true, route: input.route, status: input.status };
  });
}

// ---------- Grant Decision Record（正式核定；需使用者輸入真實文件） ----------
export async function saveGrantDecision(tenant: ResearchTenant, input: { userId: string; route: RouteKey; authority: string; decision: string; decisionDate?: string; amount?: number; applicationNumber?: string; conditions?: unknown[]; fileReference?: string; verifiedByUser?: boolean }) {
  return withClient(async (client) => {
    if (!["APPROVED", "NOT_APPROVED", "PENDING", "REVISION_REQUESTED", "WITHDRAWN"].includes(input.decision)) return { ok: false, error: "grant_decision_invalid" };
    if (input.decision === "APPROVED" && !(input.verifiedByUser && input.decisionDate && input.applicationNumber)) {
      return { ok: false, error: "grant_approval_requires_official_document" };
    }
    await client.query(`INSERT INTO grant_decision_records (id,workspace_id,project_id,route,authority,decision,decision_date,amount,application_number,conditions,file_reference,verified_by_user,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.route, `gdr_${randomUUID()}`, input.authority, input.decision, input.decisionDate ?? null, input.amount ?? null, input.applicationNumber ?? null, JSON.stringify(input.conditions ?? []), input.fileReference ?? null, Boolean(input.verifiedByUser), input.userId]);
    await audit(client, tenant, input.userId, "GRANT_DECISION_SAVED", { route: input.route, decision: input.decision, authority: input.authority });
    return { ok: true, decision: input.decision };
  });
}

// ---------- OUTDATED ----------
export async function markPackagesOutdated(tenant: ResearchTenant, input: { userId: string; reason: string; sourceTable: string; sourceId?: string }) {
  return withClient(async (client) => {
    const rows = await client.query(`UPDATE proposal_application_packages SET status='OUTDATED', updated_at=now() WHERE ${tenantWhere()} AND status IN ('NOT_STARTED','DRAFT','INTERNAL_REVIEW','READY_FOR_INSTITUTIONAL_SUBMISSION') RETURNING id`, [tenant.workspaceId, tenant.projectId]);
    await audit(client, tenant, input.userId, "PACKAGES_MARKED_OUTDATED", { sourceTable: input.sourceTable, sourceId: input.sourceId ?? null, reason: input.reason, packages: rows.rowCount });
    return { ok: true, marked: rows.rowCount ?? 0 };
  });
}
