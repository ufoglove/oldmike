import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import { callOpenClaw, type OpenClawMessage } from "./openclaw.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("compliance_storage_unavailable");
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

// ---------- Reviewer 視角規格 ----------
export const NSTC_REVIEWER_TYPES: { key: string; label: string; focus: string[] }[] = [
  { key: "DISCIPLINE_EXPERT", label: "學門專業 Reviewer", focus: ["學門歸屬", "科學問題重要性", "Gap 是否成立", "理論或技術創新", "是否只是技術應用", "國內外研究現況完整性"] },
  { key: "METHODS_FEASIBILITY", label: "方法與可行性 Reviewer", focus: ["Research Design", "Sampling", "Power Analysis", "Measures", "Analysis Plan", "Timeline", "Risk 與替代方案", "Equipment 與 Resources"] },
  { key: "PI_AND_OUTPUTS", label: "主持人與成果 Reviewer", focus: ["PI Expertise", "Past Publications", "Prior Projects", "Preliminary Work", "Team Complementarity", "Expected Outputs", "Budget–Outcome Alignment"] },
];

export const MOE_REVIEWER_TYPES: { key: string; label: string; focus: string[] }[] = [
  { key: "TEACHING_PROBLEM", label: "教學問題 Reviewer", focus: ["教學問題是否真實", "是否有基線證據", "問題是否來自本人課程", "問題是否具體且可改善", "是否只是一般課程活動"] },
  { key: "TEACHING_DESIGN_LEARNING", label: "教學設計與學生學習 Reviewer", focus: ["Root Cause", "Teaching Intervention", "Learning Mechanism", "Student Learning Outcome", "Assessment", "Course–Research Alignment", "是否只測滿意度或TAM", "是否能證明學生真正學會"] },
  { key: "METHODS_FEASIBILITY", label: "研究方法與可行性 Reviewer", focus: ["Research Question", "Study Design", "Sample", "Time Points", "Measurement", "Analysis Plan", "Course Schedule", "Teacher Workload", "Ethics and Student Rights", "Budget"] },
];

// ---------- 官方合規規則模板（年度規定存於 official_rule_snapshots；模板僅為檢查清單，非規定內容） ----------
export const NSTC_COMPLIANCE_RULES: { key: string; requirement: string; severity: string }[] = [
  { key: "applicant_eligibility", requirement: "申請資格", severity: "FATAL" },
  { key: "project_type", requirement: "計畫類型", severity: "MAJOR" },
  { key: "project_duration", requirement: "計畫年限", severity: "MAJOR" },
  { key: "department", requirement: "處別", severity: "MINOR" },
  { key: "discipline", requirement: "學門", severity: "MAJOR" },
  { key: "discipline_code", requirement: "學門代碼", severity: "MAJOR" },
  { key: "application_deadline", requirement: "申請期限", severity: "FATAL" },
  { key: "internal_deadline", requirement: "校內期限", severity: "FATAL" },
  { key: "document_format", requirement: "文件格式", severity: "MAJOR" },
  { key: "page_limit", requirement: "頁數限制", severity: "MAJOR" },
  { key: "abstract_requirements", requirement: "摘要要求", severity: "MINOR" },
  { key: "keywords", requirement: "關鍵詞", severity: "MINOR" },
  { key: "attachments", requirement: "附件要求", severity: "MAJOR" },
  { key: "pi_profile", requirement: "主持人資料", severity: "MINOR" },
  { key: "co_pi_profile", requirement: "共同主持人資料", severity: "MINOR" },
  { key: "research_ethics", requirement: "研究倫理", severity: "FATAL" },
  { key: "academic_ethics", requirement: "學術倫理", severity: "FATAL" },
  { key: "budget_items", requirement: "經費項目", severity: "MAJOR" },
  { key: "equipment_fee", requirement: "設備費", severity: "MINOR" },
  { key: "personnel_fee", requirement: "人力費", severity: "MINOR" },
  { key: "travel_fee", requirement: "差旅", severity: "MINOR" },
  { key: "international_collaboration", requirement: "國際合作", severity: "MINOR" },
  { key: "duplicate_funding_disclosure", requirement: "重複補助揭露", severity: "FATAL" },
  { key: "ongoing_projects_disclosure", requirement: "執行中計畫揭露", severity: "MAJOR" },
  { key: "conflict_of_interest", requirement: "利益衝突", severity: "MAJOR" },
  { key: "data_management", requirement: "資料管理", severity: "MINOR" },
  { key: "other_annual_requirements", requirement: "其他當年度要求", severity: "MAJOR" },
];

export const MOE_COMPLIANCE_RULES: { key: string; requirement: string; severity: string }[] = [
  { key: "discipline", requirement: "學門", severity: "FATAL" },
  { key: "project_category", requirement: "專案類別", severity: "MAJOR" },
  { key: "applicant_eligibility", requirement: "申請資格", severity: "FATAL" },
  { key: "project_duration", requirement: "計畫年限", severity: "MAJOR" },
  { key: "page_limit", requirement: "頁數", severity: "MAJOR" },
  { key: "proposal_format", requirement: "計畫書格式", severity: "MAJOR" },
  { key: "abstract", requirement: "摘要", severity: "MINOR" },
  { key: "course_syllabus", requirement: "授課計畫書", severity: "MAJOR" },
  { key: "review_criteria", requirement: "審查評分項目", severity: "MINOR" },
  { key: "budget_cap", requirement: "經費上限", severity: "MAJOR" },
  { key: "allowable_items", requirement: "可編列項目", severity: "MINOR" },
  { key: "disallowed_items", requirement: "不可編列項目", severity: "MINOR" },
  { key: "research_ethics_docs", requirement: "研究倫理文件", severity: "FATAL" },
  { key: "conflict_of_interest", requirement: "利益衝突", severity: "MAJOR" },
  { key: "ai_tool_disclosure", requirement: "AI工具揭露", severity: "MINOR" },
  { key: "internal_deadline", requirement: "校內期限", severity: "FATAL" },
  { key: "official_deadline", requirement: "官方期限", severity: "FATAL" },
  { key: "other_attachments", requirement: "其他附件", severity: "MINOR" },
];

// ---------- MOE Eligibility 檢查（12 項） ----------
export const MOE_ELIGIBILITY_ITEMS: { key: string; question: string; fatal?: boolean }[] = [
  { key: "pi_qualification", question: "主持人資格（符合教學實踐計畫申請資格）", fatal: true },
  { key: "own_course", question: "本人主授課程", fatal: true },
  { key: "credit_course", question: "正式學分課程", fatal: true },
  { key: "course_offered", question: "執行期間實際開課", fatal: true },
  { key: "student_population", question: "學生對象明確" },
  { key: "application_limit", question: "每年申請件數限制", fatal: true },
  { key: "discipline_selection", question: "學門／專案選擇" },
  { key: "internal_procedure", question: "校內程序" },
  { key: "course_data_completeness", question: "課程資料完整性" },
  { key: "duplicate_application", question: "重複申請" },
  { key: "research_ethics", question: "研究倫理" },
  { key: "teacher_student_power", question: "教師學生權力關係" },
];

// ---------- 進入條件 ----------
async function routeGateApproved(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, tenant: ResearchTenant, gateType: string): Promise<boolean> {
  const gate = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, gateType]);
  return Boolean(gate.rows[0]);
}

type RouteKey = "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL";
const ROUTE_META: Record<RouteKey, { gateType: string; label: string }> = {
  NSTC_PROPOSAL: { gateType: "NSTC_PROPOSAL_DRAFT_RELEASE", label: "國科會" },
  MOE_TPR_PROPOSAL: { gateType: "MOE_TPR_PROPOSAL_DRAFT_RELEASE", label: "教學實踐" },
};

async function ensureReviewRuns(client: PoolClient, tenant: ResearchTenant, route: RouteKey, userId: string) {
  const types = route === "NSTC_PROPOSAL" ? NSTC_REVIEWER_TYPES : MOE_REVIEWER_TYPES;
  const existing = await client.query(`SELECT reviewer_type AS "reviewerType" FROM route_review_runs WHERE ${tenantWhere()} AND route=$3`, [tenant.workspaceId, tenant.projectId, route]);
  const have = new Set(existing.rows.map((r: Record<string, unknown>) => text(r.reviewerType)));
  for (const t of types) {
    if (have.has(t.key)) continue;
    await client.query(`INSERT INTO route_review_runs (id,workspace_id,project_id,route,reviewer_type,status,simulated,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,'NOT_STARTED',true,$6,now(),now())`, [tenant.workspaceId, tenant.projectId, route, `rrr_${randomUUID()}`, t.key, userId]);
  }
}

// ---------- 來源上下文（供 Reviewer 模擬） ----------
async function loadReviewContext(client: PoolClient, tenant: ResearchTenant): Promise<Record<string, unknown>> {
  const projectTitleResult = await client.query(`SELECT title FROM projects WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const blueprint = await client.query(`SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  let blueprintPayload: Record<string, unknown> = {};
  if (blueprint.rows[0]) {
    const latest = await client.query(`SELECT payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, text((blueprint.rows[0] as Record<string, unknown>).id)]);
    const p = latest.rows[0]?.payload;
    if (record(p)) blueprintPayload = p;
  }
  const design = await client.query(`SELECT v.payload AS "payload" FROM research_design_analyses d LEFT JOIN research_design_versions v ON v.analysis_id=d.id AND v.version_number=d.current_version_number WHERE ${tenantWhere("d")} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const sections = await client.query(`SELECT section_id AS "sectionId", draft_content AS "draftContent", status FROM route_workspace_sections WHERE ${tenantWhere()} AND status <> 'NOT_STARTED' ORDER BY section_id`, [tenant.workspaceId, tenant.projectId]);
  const literature = await client.query(`SELECT count(*)::int AS "n" FROM literature_items WHERE workspace_id=$1`, [tenant.workspaceId]);
  const evidenceLinks = await client.query(`SELECT count(*)::int AS "n" FROM gap_evidence_links WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
  const identity = record(blueprintPayload.research_identity) ? blueprintPayload.research_identity as Record<string, unknown> : {};
  const gap = record(blueprintPayload.core_problem) ? blueprintPayload.core_problem as Record<string, unknown> : {};
  return {
    projectTitle: projectTitleResult.rows[0] ? text((projectTitleResult.rows[0] as Record<string, unknown>).title) : "",
    primaryRoute: str(identity.primaryRoute, ""),
    researchGap: str(gap.realProblem),
    questions: list(blueprintPayload.questions).map((q) => str(record(q) ? (q as Record<string, unknown>).question : "")).filter(Boolean),
    theory: list(blueprintPayload.theory).map((t) => str(t)).filter(Boolean),
    designPayload: design.rows[0] && record(design.rows[0].payload) ? design.rows[0].payload as Record<string, unknown> : {},
    sections: sections.rows.map((r: Record<string, unknown>) => ({ sectionId: text(r.sectionId), status: text(r.status), draftLength: text(r.draftContent).length })),
    literatureCount: literature.rows[0]?.n ?? 0,
    evidenceLinkCount: evidenceLinks.rows[0]?.n ?? 0,
    fingerprint: reviewSourceFingerprint(blueprintPayload, design.rows[0] && record(design.rows[0].payload) ? design.rows[0].payload as Record<string, unknown> : {}),
  };
}

function reviewSourceFingerprint(blueprintPayload: Record<string, unknown>, designPayload: Record<string, unknown>): string {
  // Reviewer 結果的來源指紋：題目／RQ／Gap／理論／設計內容（排除版本號）
  const identity = record(blueprintPayload.research_identity) ? blueprintPayload.research_identity as Record<string, unknown> : {};
  const gap = record(blueprintPayload.core_problem) ? blueprintPayload.core_problem as Record<string, unknown> : {};
  return hash({
    projectTitle: str(identity.chineseTitle),
    primaryRoute: str(identity.primaryRoute),
    researchGap: str(gap.realProblem),
    questions: list(blueprintPayload.questions).map((q) => str(record(q) ? (q as Record<string, unknown>).question : "")).filter(Boolean),
    theory: list(blueprintPayload.theory).map((t) => str(t)).filter(Boolean),
    designType: str(designPayload.designType ?? designPayload.design_type),
    arms: list(designPayload.study_arms).map((a) => str(record(a) ? (a as Record<string, unknown>).name : a)).filter(Boolean),
  });
}

// ---------- 規則式 Reviewer Findings（AI 不可用時的誠實後備；simulated=true） ----------
function ruleBasedFindings(route: RouteKey, ctx: Record<string, unknown>): { sectionId: string; issue: string; severity: "FATAL" | "MAJOR" | "MINOR" | "SUGGESTION"; rationale: string; requiredRevision: string }[] {
  const findings: { sectionId: string; issue: string; severity: "FATAL" | "MAJOR" | "MINOR" | "SUGGESTION"; rationale: string; requiredRevision: string }[] = [];
  const design = record(ctx.designPayload) ? ctx.designPayload as Record<string, unknown> : {};
  const sampling = record(design.sampling_plan) ? design.sampling_plan as Record<string, unknown> : {};
  if (text(sampling.status) !== "COMPLETE" && text(sampling.status) !== "APPROVED") findings.push({ sectionId: "method", issue: "Sampling／Power Analysis 未完成（樣本數無可追溯依據）", severity: "MAJOR", rationale: "方法可行性 Reviewer 無法確認樣本規模是否足以回答研究問題。", requiredRevision: "完成樣本數計算並註明效果量來源（不虛構）" });
  if (!list(design.planned_analyses).length) findings.push({ sectionId: "method", issue: "Analysis Plan 尚未建立", severity: "MAJOR", rationale: "缺乏分析計畫將無法評估統計方法與研究問題的對應。", requiredRevision: "建立與 RQ／假設對應的分析計畫" });
  if (ctx.literatureCount === 0) findings.push({ sectionId: "background", issue: "國內外研究現況文獻不足（0 筆文獻）", severity: "MAJOR", rationale: "學門專業 Reviewer 無法確認 Gap 是否成立及創新性。", requiredRevision: "於文獻與證據中心補齊文獻並連結證據" });
  if (route === "NSTC_PROPOSAL") {
    if (!list(ctx.sections).some((s) => record(s) && text((s as Record<string, unknown>).sectionId) === "ethics" && int((s as Record<string, unknown>).draftLength) > 0)) findings.push({ sectionId: "ethics", issue: "研究倫理與資料管理規劃段落未撰寫", severity: "MAJOR", rationale: "國科會計畫要求倫理規劃；缺漏可能影響審查。", requiredRevision: "撰寫倫理規劃（不虛構 IRB 號）" });
    if (!list(ctx.sections).some((s) => record(s) && text((s as Record<string, unknown>).sectionId) === "budget" && int((s as Record<string, unknown>).draftLength) > 0)) findings.push({ sectionId: "budget", issue: "經費規劃未撰寫", severity: "MINOR", rationale: "經費–成果一致性無法評估。", requiredRevision: "建立經費規劃（不虛構官方額度）" });
  }
  if (route === "MOE_TPR_PROPOSAL") {
    if (!list(ctx.sections).some((s) => record(s) && text((s as Record<string, unknown>).sectionId) === "teaching-problem" && int((s as Record<string, unknown>).draftLength) > 0)) findings.push({ sectionId: "teaching-problem", issue: "教學問題與基線證據未撰寫", severity: "FATAL", rationale: "教學實踐計畫若無真實教學問題與基線證據，計畫無法成立。", requiredRevision: "撰寫教學問題並標註基線證據來源（SOURCE/YEAR/匿名化）" });
    if (!list(ctx.sections).some((s) => record(s) && text((s as Record<string, unknown>).sectionId) === "outcomes" && int((s as Record<string, unknown>).draftLength) > 0)) findings.push({ sectionId: "outcomes", issue: "學生學習成果與評量方式未定義", severity: "MAJOR", rationale: "只測滿意度或 TAM 無法證明學生真正學會。", requiredRevision: "每個學習成果搭配可驗證評量" });
  }
  if (!findings.length) findings.push({ sectionId: "overview", issue: "無重大缺漏（規則式初檢）", severity: "SUGGESTION", rationale: "規則式檢查未發現明顯缺漏；仍建議以正式審查視角完整檢視。", requiredRevision: "無" });
  return findings;
}

// ---------- 執行 Reviewer 模擬（AI 或規則式；皆 SIMULATED） ----------
export async function runReviewerSimulation(tenant: ResearchTenant, input: { userId: string; route: RouteKey; reviewerType: string; ai?: boolean }) {
  return withClient(async (client) => {
    const types = input.route === "NSTC_PROPOSAL" ? NSTC_REVIEWER_TYPES : MOE_REVIEWER_TYPES;
    const meta = types.find((t) => t.key === input.reviewerType);
    if (!meta) return { ok: false, error: "reviewer_type_unknown" };
    const ctx = await loadReviewContext(client, tenant);
    let findings: { sectionId: string; issue: string; severity: "FATAL" | "MAJOR" | "MINOR" | "SUGGESTION"; rationale: string; requiredRevision: string }[] = [];
    let source = "RULE_BASED";
    if (input.ai) {
      const messages: OpenClawMessage[] = [
        { role: "system", content: "你是老麥（Old Mike）的 SIMULATED REVIEW 助手：模擬研究計畫審查人，產出內部模擬審查意見供研究者自我檢視。輸出必須是 JSON，只使用提供的資料；不得虛構文獻、數據、經費數字或官方規定；不得冒充國科會／教育部正式審查意見；每項發現標示 severity（FATAL/MAJOR/MINOR/SUGGESTION）與 requiredRevision。格式：{ \"findings\": [ { \"sectionId\": string, \"issue\": string, \"severity\": string, \"rationale\": string, \"requiredRevision\": string } ] }。" },
        { role: "user", content: `模擬審查視角：${meta.label}\n審查重點：${meta.focus.join("、")}\n專案題目：${ctx.projectTitle}\n路線：${ctx.primaryRoute}\nResearch Gap：${ctx.researchGap}\nRQ：${JSON.stringify(ctx.questions)}\n理論：${JSON.stringify(ctx.theory)}\n研究設計：${JSON.stringify(ctx.designPayload).slice(0, 3000)}\n計畫段落狀態：${JSON.stringify(ctx.sections)}\n文獻筆數：${ctx.literatureCount}；Gap 證據連結：${ctx.evidenceLinkCount}\n請以 SIMULATED REVIEW 產生具體、可執行的審查發現（不得只給正面評語）。` },
      ];
      const result = await callOpenClaw(messages, `review:${tenant.workspaceId}:${tenant.projectId}:${input.reviewerType}`, "ASSIST_REVIEWER_SIMULATION", undefined);
      if (result.kind === "success") {
        const parsed = parseJson(result.content);
        const raw = list(record(parsed) ? (parsed as Record<string, unknown>).findings : []);
        const valid = raw.map((f) => record(f) ? f as Record<string, unknown> : null).filter((f): f is Record<string, unknown> => f !== null && str(f.issue).length > 0).map((f) => ({
          sectionId: str(f.sectionId, "overview"),
          issue: str(f.issue),
          severity: ["FATAL", "MAJOR", "MINOR", "SUGGESTION"].includes(text(f.severity)) ? text(f.severity) as "FATAL" | "MAJOR" | "MINOR" | "SUGGESTION" : "SUGGESTION",
          rationale: str(f.rationale),
          requiredRevision: str(f.requiredRevision),
        }));
        if (valid.length) { findings = valid; source = "AI_SIMULATED"; }
      }
    }
    if (!findings.length) findings = ruleBasedFindings(input.route, ctx);
    // 覆寫該 reviewer 既有 findings（append 版本：先刪舊的再寫新的是破壞性——改為以 run 版本隔離）
    await ensureReviewRuns(client, tenant, input.route, input.userId);
    const run = await client.query(`SELECT id, version_number AS "version" FROM route_review_runs WHERE ${tenantWhere()} AND route=$3 AND reviewer_type=$4`, [tenant.workspaceId, tenant.projectId, input.route, input.reviewerType]);
    const runId = text((run.rows[0] as Record<string, unknown>).id);
    const version = int((run.rows[0] as Record<string, unknown>).version ?? 0) + 1;
    // 舊 finding 保留（歷史），僅標記為 SUPERSEDED；新增新 finding 到新 run 版本
    await client.query(`UPDATE reviewer_findings SET status='ACCEPTED_RISK', updated_at=now() WHERE ${tenantWhere()} AND review_run_id=$3`, [tenant.workspaceId, tenant.projectId, runId]);
    for (const f of findings) {
      await client.query(`INSERT INTO reviewer_findings (id,workspace_id,project_id,review_run_id,reviewer_type,section_id,issue,severity,rationale,evidence,required_revision,status,simulated,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,'OPEN',true,now(),now())`, [tenant.workspaceId, tenant.projectId, runId, `rf_${randomUUID()}`, input.reviewerType, f.sectionId, f.issue, f.severity, f.rationale, `SIMULATED REVIEW（${source}）`, f.requiredRevision]);
    }
    const counts: Record<string, number> = { FATAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0 };
    findings.forEach((f) => { counts[f.severity] += 1; });
    await client.query(`UPDATE route_review_runs SET status='COMPLETE', version_number=$3, summary=$4::jsonb, severity_counts=$5::jsonb, updated_at=now() WHERE id=$6 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, version, JSON.stringify({ source, simulated: true, ranAt: new Date().toISOString(), fingerprint: ctx.fingerprint }), JSON.stringify(counts), runId]);
    await audit(client, tenant, input.userId, "REVIEWER_SIMULATION_RUN", { route: input.route, reviewerType: input.reviewerType, source, findings: findings.length });
    return { ok: true, route: input.route, reviewerType: input.reviewerType, source, simulated: true, findings: findings.map((f) => ({ ...f, evidence: `SIMULATED REVIEW（${source}）` })), severityCounts: counts };
  });
}

// ---------- Finding 狀態 / Revision Task ----------
export async function setFindingStatus(tenant: ResearchTenant, input: { userId: string; findingId: string; status: string }) {
  return withClient(async (client) => {
    if (!["OPEN", "ACKNOWLEDGED", "RESOLVED", "ACCEPTED_RISK"].includes(input.status)) return { ok: false, error: "finding_status_invalid" };
    await client.query(`UPDATE reviewer_findings SET status=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, input.status, input.findingId]);
    return { ok: true, findingId: input.findingId, status: input.status };
  });
}

export async function createRevisionTask(tenant: ResearchTenant, input: { userId: string; findingId: string; requiredAction: string; severity?: string; owner?: string; dueDate?: string }) {
  return withClient(async (client) => {
    const finding = await client.query(`SELECT severity FROM reviewer_findings WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, input.findingId]);
    if (!finding.rows[0]) return { ok: false, error: "reviewer_finding_required" };
    const severity = input.severity ?? text((finding.rows[0] as Record<string, unknown>).severity);
    const taskId = `rt_${randomUUID()}`;
    await client.query(`INSERT INTO revision_tasks (id,workspace_id,project_id,source_reviewer_finding_id,severity,required_action,owner,due_date,status,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,'OPEN',$9,now(),now())`, [tenant.workspaceId, tenant.projectId, input.findingId, taskId, severity, input.requiredAction, input.owner ?? null, input.dueDate ?? null, input.userId]);
    await audit(client, tenant, input.userId, "REVISION_TASK_CREATED", { findingId: input.findingId, severity });
    return { ok: true, taskId, severity };
  });
}

export async function updateRevisionTask(tenant: ResearchTenant, input: { userId: string; taskId: string; status?: string; resolutionNote?: string; afterVersion?: string }) {
  return withClient(async (client) => {
    const allowed = ["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"];
    const status = input.status && allowed.includes(input.status) ? input.status : undefined;
    if (!status && input.resolutionNote === undefined && input.afterVersion === undefined) return { ok: false, error: "nothing_to_update" };
    const sets: string[] = []; const params: unknown[] = [tenant.workspaceId, tenant.projectId, input.taskId];
    if (status) { sets.push(`status=$${params.length + 1}`); params.push(status); }
    if (input.resolutionNote !== undefined) { sets.push(`resolution_note=$${params.length + 1}`); params.push(input.resolutionNote); }
    if (input.afterVersion !== undefined) { sets.push(`after_version=$${params.length + 1}`); params.push(input.afterVersion); }
    sets.push("updated_at=now()");
    await client.query(`UPDATE revision_tasks SET ${sets.join(", ")} WHERE id=$3 AND ${tenantWhere()}`, params);
    return { ok: true, taskId: input.taskId, status: status ?? null };
  });
}

// ---------- MOE Eligibility ----------
export async function saveEligibility(tenant: ResearchTenant, input: { userId: string; items: { key: string; status: string; evidence?: string; note?: string }[] }) {
  return withClient(async (client) => {
    for (const item of input.items) {
      if (!MOE_ELIGIBILITY_ITEMS.some((i) => i.key === item.key)) continue;
      // 以 ethics/assessment summary 暫存（正式欄位為 jsonb）
      const assessment = await client.query(`SELECT id, summary FROM research_ethics_assessments WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!assessment.rows[0]) return { ok: false, error: "ethics_assessment_required_first" };
      const summary = record(assessment.rows[0].summary) ? assessment.rows[0].summary as Record<string, unknown> : {};
      const eligibility = record(summary.eligibility) ? summary.eligibility as Record<string, unknown> : {};
      eligibility[item.key] = { status: item.status, evidence: item.evidence ?? "", note: item.note ?? "", updatedAt: new Date().toISOString() };
      await client.query(`UPDATE research_ethics_assessments SET summary=jsonb_set(summary,'{eligibility}', $3::jsonb, true), updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(eligibility), text((assessment.rows[0] as Record<string, unknown>).id)]);
    }
    const result = await computeEligibility(client, tenant);
    return { ok: true, ...result };
  });
}

async function computeEligibility(client: PoolClient, tenant: ResearchTenant): Promise<{ overall: "PASS" | "CONDITIONAL" | "FAIL" | "UNKNOWN"; fatalFailures: string[]; answered: number }> {
  const assessment = await client.query(`SELECT summary FROM research_ethics_assessments WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const summary = assessment.rows[0] && record(assessment.rows[0].summary) ? assessment.rows[0].summary as Record<string, unknown> : {};
  const eligibility = record(summary.eligibility) ? summary.eligibility as Record<string, unknown> : {};
  const fatalFailures: string[] = [];
  let answered = 0;
  for (const spec of MOE_ELIGIBILITY_ITEMS) {
    const entry = record(eligibility[spec.key]) ? eligibility[spec.key] as Record<string, unknown> : null;
    if (!entry || !text(entry.status)) continue;
    answered += 1;
    const status = text(entry.status);
    if (status === "FAIL" && spec.fatal) fatalFailures.push(spec.key);
  }
  if (answered === 0) return { overall: "UNKNOWN", fatalFailures, answered };
  if (fatalFailures.length) return { overall: "FAIL", fatalFailures, answered };
  const hasFail = MOE_ELIGIBILITY_ITEMS.some((spec) => { const entry = record(eligibility[spec.key]) ? eligibility[spec.key] as Record<string, unknown> : null; return entry && text(entry.status) === "FAIL"; });
  return { overall: hasFail ? "CONDITIONAL" : "PASS", fatalFailures, answered };
}

// ---------- Official Rule Snapshot ----------
export async function saveOfficialRuleSnapshot(tenant: ResearchTenant, input: { userId: string; authority: "NSTC" | "MOE_TPR"; targetYear: number; documentTitle: string; requirement: string; sourceUrl?: string; verificationStatus?: string; effectiveDate?: string; notes?: string }) {
  return withClient(async (client) => {
    const verificationStatus = input.verificationStatus && ["VERIFIED_CURRENT", "VERIFIED_PREVIOUS_YEAR", "PENDING_NEW_ANNOUNCEMENT", "CONFLICTING", "UNVERIFIED"].includes(input.verificationStatus) ? input.verificationStatus : "UNVERIFIED";
    if (verificationStatus === "VERIFIED_CURRENT" && !/^https?:\/\//.test(input.sourceUrl ?? "")) return { ok: false, error: "verified_rule_requires_source_url" };
    const contentHash = hash({ authority: input.authority, targetYear: input.targetYear, documentTitle: input.documentTitle, requirement: input.requirement, sourceUrl: input.sourceUrl ?? "", verificationStatus, effectiveDate: input.effectiveDate ?? null, notes: input.notes ?? "" });
    await client.query(`INSERT INTO official_rule_snapshots (id,workspace_id,project_id,authority,target_year,document_title,requirement,effective_date,source_url,retrieved_at,verification_status,notes,content_hash,created_by_user_id,created_at) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,now(),$10,$11,$12,$13,now())`, [tenant.workspaceId, tenant.projectId, `ors_${randomUUID()}`, input.authority, input.targetYear, input.documentTitle, input.requirement, input.effectiveDate ?? null, input.sourceUrl ?? null, verificationStatus, input.notes ?? null, contentHash, input.userId]);
    await audit(client, tenant, input.userId, "OFFICIAL_RULE_SNAPSHOT_SAVED", { authority: input.authority, targetYear: input.targetYear, verificationStatus });
    return { ok: true, verificationStatus };
  });
}

// ---------- Compliance Check ----------
export async function runComplianceCheck(tenant: ResearchTenant, input: { userId: string; route: RouteKey; targetYear: number }) {
  return withClient(async (client) => {
    const templates = input.route === "NSTC_PROPOSAL" ? NSTC_COMPLIANCE_RULES : MOE_COMPLIANCE_RULES;
    const snapshot = await client.query(`SELECT id, verification_status AS "vs", source_url AS "url", document_title AS "title" FROM official_rule_snapshots WHERE ${tenantWhere()} AND authority=$3 AND target_year=$4 ORDER BY retrieved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, input.route === "NSTC_PROPOSAL" ? "NSTC" : "MOE_TPR", input.targetYear]);
    const snap = snapshot.rows[0] as Record<string, unknown> | undefined;
    const verification = snap ? text(snap.vs) : "PENDING_NEW_ANNOUNCEMENT";
    let created = 0;
    for (const rule of templates) {
      await client.query(`INSERT INTO compliance_items (id,workspace_id,project_id,route,target_year,authority,requirement,official_source,current_status,severity,verification_status,checked_at,source_snapshot_id,created_by_user_id,created_at,updated_at)
        VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,now(),$12,$13,now(),now())
        ON CONFLICT (workspace_id, project_id, route, target_year, requirement) DO UPDATE SET verification_status=$11, official_source=$8, source_snapshot_id=$12, checked_at=now(), updated_at=now()`,
        [tenant.workspaceId, tenant.projectId, input.route, `ci_${randomUUID()}`, input.targetYear, input.route === "NSTC_PROPOSAL" ? "NSTC" : "MOE_TPR", rule.requirement, snap ? text(snap.title) : null, verification === "VERIFIED_CURRENT" || verification === "VERIFIED_PREVIOUS_YEAR" ? "UNVERIFIED" : "AWAITING_OFFICIAL_RULE", rule.severity, verification, snap ? text(snap.id) : null, input.userId]);
      created += 1;
    }
    // 若官方規則尚未公告：所有項目標 AWAITING_OFFICIAL_RULE（除 FATAL 資格類項目仍標 UNVERIFIED 需人工確認）
    const result = await getComplianceState(client, tenant, input.route, input.targetYear);
    await audit(client, tenant, input.userId, "COMPLIANCE_CHECK_RUN", { route: input.route, targetYear: input.targetYear, verification, items: created });
    return { ok: true, ...result };
  });
}

async function getComplianceState(client: PoolClient, tenant: ResearchTenant, route: RouteKey, targetYear: number) {
  const items = await client.query(`SELECT id, requirement, current_status AS "currentStatus", evidence, missing_item AS "missingItem", required_action AS "requiredAction", severity, verification_status AS "verificationStatus", official_source AS "officialSource", checked_at AS "checkedAt" FROM compliance_items WHERE ${tenantWhere()} AND route=$3 AND target_year=$4 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, route, targetYear]);
  // FATAL 項目只有在「已確認符合或正式不適用」時才不阻斷（含 AWAITING_OFFICIAL_RULE／UNVERIFIED）
  const fatalMissing = items.rows.filter((r: Record<string, unknown>) => text(r.severity) === "FATAL" && !["MET", "NOT_APPLICABLE"].includes(text(r.currentStatus)));
  const snapshots = await client.query(`SELECT id, authority, target_year AS "targetYear", document_title AS "documentTitle", requirement, effective_date AS "effectiveDate", source_url AS "sourceUrl", retrieved_at AS "retrievedAt", verification_status AS "verificationStatus", notes FROM official_rule_snapshots WHERE ${tenantWhere()} AND authority=$3 AND target_year=$4 ORDER BY retrieved_at DESC`, [tenant.workspaceId, tenant.projectId, route === "NSTC_PROPOSAL" ? "NSTC" : "MOE_TPR", targetYear]);
  return { items: items.rows, fatalMissing: fatalMissing.length, snapshots: snapshots.rows };
}

export async function updateComplianceItem(tenant: ResearchTenant, input: { userId: string; itemId: string; currentStatus?: string; evidence?: string; requiredAction?: string; missingItem?: string }) {
  return withClient(async (client) => {
    const allowed = ["MET", "PARTIAL", "MISSING", "NOT_APPLICABLE", "AWAITING_OFFICIAL_RULE", "UNVERIFIED"];
    const status = input.currentStatus && allowed.includes(input.currentStatus) ? input.currentStatus : undefined;
    if (!status && input.evidence === undefined && input.requiredAction === undefined && input.missingItem === undefined) return { ok: false, error: "nothing_to_update" };
    const sets: string[] = []; const params: unknown[] = [tenant.workspaceId, tenant.projectId, input.itemId];
    if (status) { sets.push(`current_status=$${params.length + 1}`); params.push(status); }
    if (input.evidence !== undefined) { sets.push(`evidence=$${params.length + 1}`); params.push(input.evidence); }
    if (input.requiredAction !== undefined) { sets.push(`required_action=$${params.length + 1}`); params.push(input.requiredAction); }
    if (input.missingItem !== undefined) { sets.push(`missing_item=$${params.length + 1}`); params.push(input.missingItem); }
    sets.push("checked_at=now()", "updated_at=now()");
    await client.query(`UPDATE compliance_items SET ${sets.join(", ")} WHERE id=$3 AND ${tenantWhere()}`, params);
    return { ok: true, itemId: input.itemId, currentStatus: status ?? null };
  });
}

// ---------- Gate 檢查 ----------
const INTERNAL_REVIEW_CHECKS: { key: string; label: string; check: (ctx: Record<string, unknown>) => { pass: boolean; detail: string } }[] = [
  { key: "all_review_runs_complete", label: "三種審查視角皆已執行（SIMULATED REVIEW）", check: (ctx) => ({ pass: ctx.completedRuns === 3, detail: `已完成 ${ctx.completedRuns ?? 0}/3 種視角` }) },
  { key: "no_open_fatal", label: "無未處理 FATAL 發現", check: (ctx) => ({ pass: (ctx.openFatal ?? 0) === 0, detail: `未處理 FATAL：${ctx.openFatal ?? 0}` }) },
  { key: "revision_tasks_managed", label: "MAJOR 發現已轉為修訂任務或已處理", check: (ctx) => ({ pass: (ctx.openMajor ?? 0) === 0, detail: `未處理 MAJOR：${ctx.openMajor ?? 0}` }) },
];

export async function approveComplianceGate(tenant: ResearchTenant, input: { userId: string; gateType: "NSTC_INTERNAL_REVIEW_PASSED" | "NSTC_COMPLIANCE_PASSED" | "MOE_TPR_ELIGIBILITY_PASSED" | "MOE_TPR_INTERNAL_REVIEW_PASSED" | "MOE_TPR_COMPLIANCE_PASSED" }) {
  return withClient(async (client) => {
    const route: RouteKey = input.gateType.startsWith("NSTC") ? "NSTC_PROPOSAL" : "MOE_TPR_PROPOSAL";
    const targetYear = new Date().getUTCFullYear();
    if (input.gateType.endsWith("ELIGIBILITY_PASSED")) {
      const eligibility = await computeEligibility(client, tenant);
      if (eligibility.overall !== "PASS") return { ok: false, error: `ELIGIBILITY_BLOCKED（${eligibility.overall}）`, failed: eligibility.fatalFailures.map((k) => ({ key: k, label: MOE_ELIGIBILITY_ITEMS.find((i) => i.key === k)?.question ?? k })) };
    } else if (input.gateType.endsWith("INTERNAL_REVIEW_PASSED")) {
      const runs = await client.query(`SELECT count(*)::int AS "n" FROM route_review_runs WHERE ${tenantWhere()} AND route=$3 AND status='COMPLETE'`, [tenant.workspaceId, tenant.projectId, route]);
      const openFindings = await client.query(`SELECT count(*)::int AS "n" FROM reviewer_findings WHERE ${tenantWhere()} AND reviewer_type IN (SELECT reviewer_type FROM route_review_runs WHERE ${tenantWhere()} AND route=$3) AND status IN ('OPEN','ACKNOWLEDGED') AND severity IN ('FATAL','MAJOR')`, [tenant.workspaceId, tenant.projectId, route]);
      const ctx = { completedRuns: runs.rows[0]?.n ?? 0, openFatal: 0, openMajor: openFindings.rows[0]?.n ?? 0 };
      const results = INTERNAL_REVIEW_CHECKS.map((check) => ({ key: check.key, label: check.label, ...check.check(ctx) }));
      const failed = results.filter((r) => !r.pass);
      if (failed.length) return { ok: false, failed };
    } else if (input.gateType.endsWith("COMPLIANCE_PASSED")) {
      const state = await getComplianceState(client, tenant, route, targetYear);
      if (state.fatalMissing > 0) return { ok: false, error: `compliance_has_fatal_missing（${state.fatalMissing} 項）`, failed: state.items.filter((r: Record<string, unknown>) => text(r.severity) === "FATAL" && !["MET", "NOT_APPLICABLE"].includes(text(r.currentStatus))).map((r: Record<string, unknown>) => ({ key: text(r.id), label: text(r.requirement) })) };
    }
    const gateId = `hg_${randomUUID()}`;
    await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,'route_compliance',$6,$7,'APPROVED',$3,now(),now(),now())`, [tenant.workspaceId, tenant.projectId, input.userId, gateId, input.gateType, route, hash({ gateType: input.gateType, approvedAt: new Date().toISOString() })]);
    await audit(client, tenant, input.userId, `${input.gateType}_APPROVED`, { route, humanGateId: gateId });
    return { ok: true, gateType: input.gateType, humanGateId: gateId };
  });
}

// ---------- 主讀取：getReviewCompliance ----------
export async function getReviewCompliance(tenant: ResearchTenant, input: { userId: string; route: RouteKey }) {
  return withClient(async (client) => {
    const meta = ROUTE_META[input.route];
    const gateApproved = await routeGateApproved(client as never, tenant, meta.gateType);
    if (!gateApproved) {
      return { ok: true, locked: true, route: input.route, lockedReason: [`${meta.gateType}：需先完成${meta.label}計畫書初稿（研究路線工作室）`] };
    }
    await ensureReviewRuns(client, tenant, input.route, input.userId);
    const ctx = await loadReviewContext(client, tenant);
    // 來源（RQ／Gap／理論／設計）變更 → COMPLETE run 標 OUTDATED
    const runs = await client.query(`SELECT id, status, summary FROM route_review_runs WHERE ${tenantWhere()} AND route=$3 AND status='COMPLETE'`, [tenant.workspaceId, tenant.projectId, input.route]);
    for (const runRow of runs.rows) {
      const rr = runRow as Record<string, unknown>;
      const summary = record(rr.summary) ? rr.summary as Record<string, unknown> : {};
      if (text(summary.fingerprint) && text(summary.fingerprint) !== ctx.fingerprint) {
        await client.query(`UPDATE route_review_runs SET status='OUTDATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, text(rr.id)]);
      }
    }
    const runs2 = await client.query(`SELECT reviewer_type AS "reviewerType", status, version_number AS "version", simulated, summary, severity_counts AS "severityCounts", created_at AS "createdAt", updated_at AS "updatedAt" FROM route_review_runs WHERE ${tenantWhere()} AND route=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, input.route]);
    const findings = await client.query(`SELECT id, reviewer_type AS "reviewerType", section_id AS "sectionId", issue, severity, rationale, evidence, required_revision AS "requiredRevision", status, simulated, created_at AS "createdAt" FROM reviewer_findings WHERE ${tenantWhere()} AND review_run_id IN (SELECT id FROM route_review_runs WHERE ${tenantWhere()} AND route=$3) ORDER BY created_at DESC LIMIT 200`, [tenant.workspaceId, tenant.projectId, input.route]);
    const tasks = await client.query(`SELECT id, source_reviewer_finding_id AS "sourceFindingId", affected_section AS "affectedSection", severity, required_action AS "requiredAction", owner, due_date AS "dueDate", status, before_version AS "beforeVersion", after_version AS "afterVersion", resolution_note AS "resolutionNote", created_at AS "createdAt" FROM revision_tasks WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]);
    const targetYear = new Date().getUTCFullYear();
    const compliance = await getComplianceState(client, tenant, input.route, targetYear);
    const gateStates: Record<string, unknown> = {};
    for (const gateType of [meta.gateType === "NSTC_PROPOSAL_DRAFT_RELEASE" ? "NSTC_INTERNAL_REVIEW_PASSED" : "MOE_TPR_INTERNAL_REVIEW_PASSED", meta.gateType === "NSTC_PROPOSAL_DRAFT_RELEASE" ? "NSTC_COMPLIANCE_PASSED" : "MOE_TPR_COMPLIANCE_PASSED", meta.gateType === "NSTC_PROPOSAL_DRAFT_RELEASE" ? "NSTC_APPLICATION_PACKAGE_READY" : "MOE_TPR_APPLICATION_PACKAGE_READY"]) {
      const g = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, gateType]);
      gateStates[gateType] = Boolean(g.rows[0]);
    }
    const eligibility = input.route === "MOE_TPR_PROPOSAL" ? await computeEligibility(client, tenant) : null;
    const reviewerTypes = input.route === "NSTC_PROPOSAL" ? NSTC_REVIEWER_TYPES : MOE_REVIEWER_TYPES;
    return { ok: true, locked: false, route: input.route, reviewerTypes, runs: runs.rows, findings: findings.rows, revisionTasks: tasks.rows, compliance: { targetYear, ...compliance }, gateStates, eligibility, simulatedNotice: "所有審查意見皆為 SIMULATED REVIEW（內部模擬），非國科會／教育部正式審查意見。" };
  });
}

// ---------- OUTDATED 標記 ----------
export async function markComplianceOutdated(tenant: ResearchTenant, input: { userId: string; reason: string; sourceTable: string; sourceId?: string }) {
  return withClient(async (client) => {
    const runs = await client.query(`UPDATE route_review_runs SET status='OUTDATED', updated_at=now() WHERE ${tenantWhere()} AND status='COMPLETE' RETURNING id`, [tenant.workspaceId, tenant.projectId]);
    await audit(client, tenant, input.userId, "REVIEW_COMPLIANCE_MARKED_OUTDATED", { sourceTable: input.sourceTable, sourceId: input.sourceId ?? null, reason: input.reason, runs: runs.rowCount });
    return { ok: true, marked: runs.rowCount ?? 0 };
  });
}

function parseJson(value: string): Record<string, unknown> | null {
  const cleaned = value.replace(/,\s*([}\]])/g, "$1").replace(/'/g, '"').replace(/([{,}\s])(\w+)\s*:/g, "$1\"$2\":");
  try { const parsed = JSON.parse(cleaned); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>; } catch { /* ignore */ }
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/u);
  if (fenced) { try { const parsed = JSON.parse(fenced[1]); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>; } catch { /* ignore */ } }
  return null;
}
