import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("language_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function str(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value : fallback; }
function dt(value: unknown): string { if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString(); return typeof value === "string" ? value : ""; }
function int(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function tenantWhere(alias = ""): string { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
type Row = Record<string, unknown>;
async function one(client: PoolClient, sql: string, params: unknown[]): Promise<Row | null> {
  const r = await client.query(sql, params);
  return (r.rows[0] as Row) ?? null;
}
async function many(client: PoolClient, sql: string, params: unknown[]): Promise<Row[]> {
  const r = await client.query(sql, params);
  return r.rows as Row[];
}

const SERVICE_MODES = ["ZH_TO_EN_SCIENTIFIC_TRANSLATION", "EN_TO_ZH_ACADEMIC_TRANSLATION", "ENGLISH_ACADEMIC_POLISHING", "CHINESE_ACADEMIC_POLISHING", "BILINGUAL_PARALLEL_EDITING", "TARGET_JOURNAL_LANGUAGE_ADAPTATION", "TITLE_ABSTRACT_KEYWORD_OPTIMIZATION", "TABLE_FIGURE_CAPTION_EDITING", "PROPOSAL_CHINESE_POLISHING", "CUSTOM_LANGUAGE_WORKFLOW"] as const;
const ROUTE_MODES = ["JOURNAL_MANUSCRIPT", "NSTC_PROPOSAL_CHINESE", "MOE_TPR_PROPOSAL_CHINESE"] as const;
const DEPTHS = ["CONSERVATIVE", "BALANCED", "SUBSTANTIVE_LANGUAGE_EDIT", "JOURNAL_STYLE_ADAPTATION"] as const;
const RISKS = ["NONE", "LOW", "MEDIUM", "HIGH", "SCIENTIFIC_MEANING_CHANGE"] as const;
const FINDING_STATUSES = ["OPEN", "ACCEPTED", "REJECTED", "VERIFIED_RESOLVED", "OUTDATED"] as const;
const QA_KINDS = ["SEMANTIC_EQUIVALENCE", "NUMERICAL_INTEGRITY", "CITATION_INTEGRITY", "TERMINOLOGY_CONSISTENCY", "CAUSAL_LANGUAGE", "CERTAINTY_CALIBRATION", "INCLUSIVE_LANGUAGE", "ACCESSIBILITY", "HYPOTHESIS_STATUS"] as const;

async function manuscriptAndReview(client: PoolClient, tenant: ResearchTenant): Promise<{ manuscriptId: string; manuscriptVersion: number; scientificallyApproved: boolean; sections: Array<{ sectionId: string; sectionTitle: string; sectionKey: string; status: string }> }> {
  const man = await one(client, `SELECT manuscript_id, current_version FROM manuscript_projects WHERE ${tenantWhere()} AND status IN ('DRAFT','ACTIVE') ORDER BY updated_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const manuscriptId = text(man?.manuscript_id);
  const sections = manuscriptId ? await many(client, `SELECT section_id, section_title, section_key, status FROM manuscript_sections WHERE ${tenantWhere()} AND manuscript_id=$3 ORDER BY created_at ASC`, [tenant.workspaceId, tenant.projectId, manuscriptId]) : [];
  const approvedRun = await one(client, `SELECT review_run_id FROM scientific_review_runs WHERE ${tenantWhere()} AND status='SCIENTIFICALLY_APPROVED' ORDER BY completed_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  return { manuscriptId, manuscriptVersion: int(man?.current_version), scientificallyApproved: Boolean(approvedRun), sections: sections.map((row) => ({ sectionId: text(row.section_id), sectionTitle: text(row.section_title), sectionKey: text(row.section_key), status: text(row.status) })) };
}

export async function getLanguageCenter(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const state = await manuscriptAndReview(client, tenant);
    const workOrder = await one(client, `SELECT work_order_id, manuscript_id, source_manuscript_version, service_mode, route_mode, requested_depth, target_journal, selected_sections, status, created_at, updated_at FROM language_work_orders WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    const workOrderId = text(workOrder?.work_order_id);
    const findings = workOrderId ? await many(client, `SELECT finding_id, reviewer_role, manuscript_section, issue_type, original_text, suggested_text, rationale, scientific_meaning_risk, severity, user_decision, status, created_at FROM language_findings WHERE ${tenantWhere()} AND work_order_id=$3 ORDER BY created_at ASC LIMIT 200`, [tenant.workspaceId, tenant.projectId, workOrderId]) : [];
    const qa = workOrderId ? await many(client, `SELECT check_kind, status, issues, checked_at FROM language_qa_results WHERE ${tenantWhere()} AND work_order_id=$3 ORDER BY checked_at DESC NULLS LAST LIMIT 30`, [tenant.workspaceId, tenant.projectId, workOrderId]) : [];
    const disclosure = workOrderId ? await one(client, `SELECT tool_category, purpose, sections_affected, translation_or_polishing, human_review_performed, scientific_content_changed, final_responsibility, disclosure_required, disclosure_draft, status FROM language_assistance_disclosures WHERE ${tenantWhere()} AND work_order_id=$3 ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, workOrderId]) : null;
    const reasons: string[] = [];
    if (!state.manuscriptId) reasons.push("尚未建立全文稿件；請先至「全文寫作工作室（13）」建立並核准章節。");
    else if (!state.scientificallyApproved) reasons.push("科學審查尚未核准（需 SCIENTIFICALLY_APPROVED）；語言潤稿不得先於科學審查，避免以潤稿取代科學修正。");
    const locked = reasons.length > 0;
    return {
      ok: true,
      locked,
      reasons,
      declaration: "語言潤稿僅處理表達層次；不得以潤稿取代科學修正。所有 AI 輔助輸出皆為 AI_PROPOSED 草稿，正式版本須研究者核准並揭露使用情形。",
      summary: {
        status: locked ? "LANGUAGE_CENTER_LOCKED" : workOrder ? text(workOrder.status) : "LANGUAGE_NOT_STARTED",
        manuscriptVersion: state.manuscriptVersion,
        workOrder: workOrder ? text(workOrder.work_order_id) : null,
        workOrderStatus: text(workOrder?.status),
        serviceMode: text(workOrder?.service_mode),
        findings: findings.length,
        openFindings: findings.filter((row) => text(row.status) === "OPEN" || text(row.status) === "ACCEPTED").length,
        qa: qa.length,
        disclosureRequired: Boolean(disclosure),
        nextCenter: state.manuscriptId && !state.scientificallyApproved ? "scientific-review" : "manuscript",
      },
      manuscript: { manuscriptId: state.manuscriptId, version: state.manuscriptVersion, sections: state.sections },
      workOrder: workOrder ? { workOrderId: text(workOrder.work_order_id), manuscriptId: text(workOrder.manuscript_id), serviceMode: text(workOrder.service_mode), routeMode: text(workOrder.route_mode), requestedDepth: text(workOrder.requested_depth), targetJournal: text(workOrder.target_journal), selectedSections: text(workOrder.selected_sections), status: text(workOrder.status), updatedAt: dt(workOrder.updated_at) } : null,
      findings: findings.map((row) => ({ findingId: text(row.finding_id), reviewerRole: text(row.reviewer_role), section: text(row.manuscript_section), issueType: text(row.issue_type), originalText: text(row.original_text), suggestedText: text(row.suggested_text), rationale: text(row.rationale), risk: text(row.scientific_meaning_risk), severity: text(row.severity), userDecision: text(row.user_decision), status: text(row.status), createdAt: dt(row.created_at) })),
      qaResults: qa.map((row) => ({ checkKind: text(row.check_kind), status: text(row.status), issues: text(row.issues), checkedAt: dt(row.checked_at) })),
      disclosure: disclosure ? { toolCategory: text(disclosure.tool_category), purpose: text(disclosure.purpose), sectionsAffected: text(disclosure.sections_affected), translationOrPolishing: text(disclosure.translation_or_polishing), humanReviewPerformed: text(disclosure.human_review_performed), scientificContentChanged: text(disclosure.scientific_content_changed), finalResponsibility: text(disclosure.final_responsibility), disclosureRequired: text(disclosure.disclosure_required), disclosureDraft: text(disclosure.disclosure_draft), status: text(disclosure.status) } : null,
    };
  });
}

export async function createLanguageWorkOrder(tenant: ResearchTenant, input: { userId: string; serviceMode: string; routeMode?: string; requestedDepth?: string; targetJournal?: string; selectedSections?: string[] }) {
  if (!SERVICE_MODES.includes(str(input.serviceMode) as never)) return { ok: false, error: "language_service_mode_invalid" };
  const routeMode = ROUTE_MODES.includes(str(input.routeMode) as never) ? str(input.routeMode) : "JOURNAL_MANUSCRIPT";
  const depth = DEPTHS.includes(str(input.requestedDepth) as never) ? str(input.requestedDepth) : "BALANCED";
  return withClient(async (client) => {
    const state = await manuscriptAndReview(client, tenant);
    if (!state.manuscriptId) return { ok: false, error: "language_requires_manuscript" };
    if (!state.scientificallyApproved) return { ok: false, error: "language_requires_scientific_approval" };
    const active = await one(client, `SELECT work_order_id FROM language_work_orders WHERE ${tenantWhere()} AND status IN ('READY','IN_PROGRESS','HUMAN_REVIEW','QA_PENDING','SOURCE_VALIDATION_REQUIRED') ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (active) return { ok: false, error: "language_work_order_active", workOrderId: text(active.work_order_id) };
    const sections = Array.isArray(input.selectedSections) && input.selectedSections.length ? input.selectedSections.filter((id) => state.sections.some((section) => section.sectionId === id)) : state.sections.map((section) => section.sectionId);
    if (!sections.length) return { ok: false, error: "language_no_sections" };
    const workOrderId = `lwo_${randomUUID().slice(0, 12)}`;
    const snapshotId = `lsnap_${randomUUID().slice(0, 12)}`;
    await client.query(`INSERT INTO language_work_orders (id, workspace_id, project_id, work_order_id, manuscript_id, source_manuscript_version, service_mode, route_mode, requested_depth, target_journal, selected_sections, status, created_by_user_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'READY',$12,now(),now())`,
      [randomUUID(), tenant.workspaceId, tenant.projectId, workOrderId, state.manuscriptId, state.manuscriptVersion, str(input.serviceMode), routeMode, depth, str(input.targetJournal).slice(0, 200), JSON.stringify(sections), input.userId]);
    await client.query(`INSERT INTO language_source_snapshots (id, workspace_id, project_id, work_order_id, snapshot_id, manuscript_version, sections, scientific_review_decision, content_hash, created_by_user_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'SCIENTIFICALLY_APPROVED',$8,$9,now())`,
      [randomUUID(), tenant.workspaceId, tenant.projectId, workOrderId, snapshotId, state.manuscriptVersion, JSON.stringify(sections), randomUUID().slice(0, 32), input.userId]);
    return { ok: true, workOrderId };
  });
}

export async function saveLanguageFinding(tenant: ResearchTenant, input: { userId: string; workOrderId: string; section: string; issueType: string; originalText: string; suggestedText: string; rationale?: string; risk?: string; severity?: string }) {
  const originalText = str(input.originalText).slice(0, 8000);
  if (!originalText) return { ok: false, error: "language_finding_original_required" };
  const risk = RISKS.includes(str(input.risk) as never) ? str(input.risk) : "NONE";
  const severity = str(input.severity) === "BLOCKER" || str(input.severity) === "CRITICAL" || str(input.severity) === "MAJOR" || str(input.severity) === "MINOR" || str(input.severity) === "SUGGESTION" ? str(input.severity) : "SUGGESTION";
  return withClient(async (client) => {
    const order = await one(client, `SELECT work_order_id FROM language_work_orders WHERE ${tenantWhere()} AND work_order_id=$3`, [tenant.workspaceId, tenant.projectId, input.workOrderId]);
    if (!order) return { ok: false, error: "language_work_order_not_found" };
    const findingId = `lf_${randomUUID().slice(0, 12)}`;
    await client.query(`INSERT INTO language_findings (id, workspace_id, project_id, work_order_id, finding_id, reviewer_role, manuscript_section, issue_type, original_text, suggested_text, rationale, scientific_meaning_risk, severity, user_decision, status, created_by_user_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,'REVIEWER_AI',$6,$7,$8,$9,$10,$11,$12,'PENDING','OPEN',$13,now(),now())`,
      [randomUUID(), tenant.workspaceId, tenant.projectId, input.workOrderId, findingId, str(input.section).slice(0, 120), str(input.issueType).slice(0, 60), originalText, str(input.suggestedText).slice(0, 8000), str(input.rationale).slice(0, 4000), risk, severity, input.userId]);
    return { ok: true, findingId, workOrderId: input.workOrderId };
  });
}

export async function updateLanguageFindingDecision(tenant: ResearchTenant, input: { userId: string; workOrderId: string; findingId: string; decision: string }) {
  const decision = ["PENDING", "ACCEPT", "REJECT", "DEFER"].includes(str(input.decision)) ? str(input.decision) : "PENDING";
  const status = decision === "ACCEPT" ? "ACCEPTED" : decision === "REJECT" ? "REJECTED" : "OPEN";
  return withClient(async (client) => {
    const finding = await one(client, `SELECT id FROM language_findings WHERE ${tenantWhere()} AND work_order_id=$3 AND finding_id=$4`, [tenant.workspaceId, tenant.projectId, input.workOrderId, input.findingId]);
    if (!finding) return { ok: false, error: "language_finding_not_found" };
    await client.query(`UPDATE language_findings SET user_decision=$3, status=$4, updated_at=now() WHERE ${tenantWhere()} AND work_order_id=$5 AND finding_id=$6`, [tenant.workspaceId, tenant.projectId, decision, status, input.workOrderId, input.findingId]);
    return { ok: true, findingId: input.findingId, decision };
  });
}

export async function saveLanguageQaResult(tenant: ResearchTenant, input: { userId: string; workOrderId: string; checkKind: string; status: string; issues?: string }) {
  if (!QA_KINDS.includes(str(input.checkKind) as never)) return { ok: false, error: "language_qa_kind_invalid" };
  const status = ["PASS", "PASS_WITH_WARNINGS", "FAIL", "PENDING"].includes(str(input.status)) ? str(input.status) : "PENDING";
  return withClient(async (client) => {
    const order = await one(client, `SELECT work_order_id FROM language_work_orders WHERE ${tenantWhere()} AND work_order_id=$3`, [tenant.workspaceId, tenant.projectId, input.workOrderId]);
    if (!order) return { ok: false, error: "language_work_order_not_found" };
    await client.query(`INSERT INTO language_qa_results (id, workspace_id, project_id, work_order_id, check_kind, issues, status, checked_at, created_by_user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8)`,
      [randomUUID(), tenant.workspaceId, tenant.projectId, input.workOrderId, str(input.checkKind), str(input.issues).slice(0, 4000), status, input.userId]);
    return { ok: true, checkKind: str(input.checkKind), status };
  });
}

export async function saveLanguageDisclosure(tenant: ResearchTenant, input: { userId: string; workOrderId: string; toolCategory: string; purpose?: string; sectionsAffected?: string; disclosureDraft?: string }) {
  return withClient(async (client) => {
    const order = await one(client, `SELECT work_order_id FROM language_work_orders WHERE ${tenantWhere()} AND work_order_id=$3`, [tenant.workspaceId, tenant.projectId, input.workOrderId]);
    if (!order) return { ok: false, error: "language_work_order_not_found" };
    const toolCategory = str(input.toolCategory, "AI 輔助語言工具（老麥）").slice(0, 120);
    await client.query(`INSERT INTO language_assistance_disclosures (id, workspace_id, project_id, work_order_id, tool_category, purpose, sections_affected, translation_or_polishing, human_review_performed, scientific_content_changed, final_responsibility, disclosure_required, disclosure_draft, status, created_by_user_id, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'true',$12,'DRAFT',$13,now())`,
      [randomUUID(), tenant.workspaceId, tenant.projectId, input.workOrderId, toolCategory, str(input.purpose, "學術語言潤稿／翻譯之 AI 輔助揭露").slice(0, 2000), str(input.sectionsAffected).slice(0, 1000), "TRANSLATION_OR_POLISHING", "PENDING", "NO_SCIENTIFIC_CONTENT_CHANGE", "研究作者負最終責任", str(input.disclosureDraft, "（草稿待補）").slice(0, 8000), input.userId]);
    return { ok: true, workOrderId: input.workOrderId };
  });
}

export async function approveLanguageWorkOrder(tenant: ResearchTenant, input: { userId: string; workOrderId: string }) {
  return withClient(async (client) => {
    const order = await one(client, `SELECT work_order_id FROM language_work_orders WHERE ${tenantWhere()} AND work_order_id=$3`, [tenant.workspaceId, tenant.projectId, input.workOrderId]);
    if (!order) return { ok: false, error: "language_work_order_not_found" };
    const openFindings = await one(client, `SELECT count(*)::int AS n FROM language_findings WHERE ${tenantWhere()} AND work_order_id=$3 AND status IN ('OPEN','ACCEPTED')`, [tenant.workspaceId, tenant.projectId, input.workOrderId]);
    const qaFail = await one(client, `SELECT count(*)::int AS n FROM language_qa_results WHERE ${tenantWhere()} AND work_order_id=$3 AND status='FAIL'`, [tenant.workspaceId, tenant.projectId, input.workOrderId]);
    if (int(openFindings?.n) > 0 || int(qaFail?.n) > 0) return { ok: false, error: "language_approval_blocked", openFindings: int(openFindings?.n), qaFailures: int(qaFail?.n) };
    await client.query(`UPDATE language_work_orders SET status='APPROVED', approved_by=$3, updated_at=now() WHERE ${tenantWhere()} AND work_order_id=$4`, [tenant.workspaceId, tenant.projectId, input.userId, input.workOrderId]);
    return { ok: true, workOrderId: input.workOrderId, status: "APPROVED" };
  });
}
