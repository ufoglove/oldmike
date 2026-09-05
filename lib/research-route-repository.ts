import "server-only";

import { randomUUID, createHash } from "crypto";
import type { ResearchTenant } from "./research-repository.ts";
import { ROUTE_SECTION_DEFS, type RouteSectionRouteKey } from "./route-section-catalog.ts";



import { Pool, type PoolClient } from "pg";
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new Error("research_route_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}

function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function hash(payload: unknown): string { return createHash("sha256").update(typeof payload === "string" ? payload : JSON.stringify(payload)).digest("hex"); }
function tenantWhere(alias = ""): string { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }

async function audit(client: unknown, tenant: ResearchTenant, userId: string, eventType: string, detail: Record<string, unknown>) {
  const c = client as { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  try {
    await c.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,$5,$5,$6,'1.5.65',$7::jsonb,$8)`, [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, eventType, JSON.stringify(detail), hash({ eventType, detail })]);
  } catch { /* audit 失敗不阻擋主流程 */ }
}

export type RouteWorkspaceStatus = "LOCKED" | "NOT_STARTED" | "DRAFT" | "EVIDENCE_INCOMPLETE" | "INTERNAL_REVIEW_READY" | "REVISION_REQUIRED" | "APPROVED" | "OUTDATED";

// ---------- 進入條件：研究設計 Gate 是否核准 ----------
async function designGateApproved(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, tenant: ResearchTenant): Promise<{ approved: boolean; missing: string[] }> {
  const gate = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type='RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (gate.rows[0] && text(gate.rows[0].decision) === "APPROVED") return { approved: true, missing: [] };
  const missing: string[] = [];
  const design = await client.query(`SELECT status, gate_state FROM research_design_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (!design.rows[0]) missing.push("Research Design 尚未建立");
  else {
    if (text(design.rows[0].status) !== "APPROVED") missing.push("Research Design 尚未核准");
    const gs = record(design.rows[0].gate_state) ? design.rows[0].gate_state as Record<string, unknown> : {};
    const results = list(gs.results);
    if (results.length && results.some((r) => record(r) && (r as Record<string, unknown>).pass === false)) missing.push("RQ–Data–Analysis Matrix 仍有缺漏");
    const payload = await client.query(`SELECT payload FROM research_design_versions WHERE ${tenantWhere()} ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    const p = record(payload.rows[0]?.payload) ? payload.rows[0].payload as Record<string, unknown> : {};
    const sampling = record(p.sampling_plan) ? p.sampling_plan as Record<string, unknown> : {};
    if (text(sampling.status) !== "COMPLETE" && text(sampling.status) !== "APPROVED") missing.push("Sampling/Power Analysis 尚未完成");
    const measurement = Array.isArray(p.measurement_requirements) ? p.measurement_requirements as unknown[] : [];
    if (!measurement.length) missing.push("主要 Measurement Requirement 尚未定義");
    if (!list(p.planned_analyses).length) missing.push("Analysis Plan 尚未完成");
  }
  return { approved: false, missing };
}

// ---------- OUTDATED 偵測：上游重大變更 ----------
async function detectOutdated(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, tenant: ResearchTenant, workspace: { source_design_version_id: string | null; source_design_version: number }): Promise<boolean> {
  const designVersion = await client.query(`SELECT id, version_number AS "n", created_at FROM research_design_versions WHERE ${tenantWhere()} ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (!designVersion.rows[0]) return true;
  const currentDesignId = text(designVersion.rows[0].id);
  if (workspace.source_design_version_id && currentDesignId !== workspace.source_design_version_id) return true;
  return false;
}

// ---------- 主表讀取：getRouteWorkspace ----------
export async function getRouteWorkspace(tenant: ResearchTenant, input: { userId: string; route: "JOURNAL_PLANNING" | "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL" }) {
  return withClient(async (client) => {
    const gate = await designGateApproved(client as never, tenant);
    // 既有 workspace
    const ws = await client.query(`SELECT id, route, workspace_role AS "workspaceRole", status, source_design_version AS "sourceDesignVersion", source_design_version_id AS "sourceDesignVersionId", current_version_number AS "currentVersion", source_hash AS "sourceHash", gate_state AS "gateState", created_at AS "createdAt", updated_at AS "updatedAt" FROM route_workspaces WHERE ${tenantWhere()} AND route=$3`, [tenant.workspaceId, tenant.projectId, input.route]);
    let row = ws.rows[0] ? ws.rows[0] as Record<string, unknown> : null;
    const existed = Boolean(row);
    if (row) {
      const wsId = text(row.id);
      await ensureRouteSections(client, tenant, wsId, input.route, input.userId);
      const outdated = await detectOutdated(client as never, tenant, { source_design_version_id: row.sourceDesignVersionId ? text(row.sourceDesignVersionId) : null, source_design_version: Number(row.sourceDesignVersion ?? 0) });
      if (outdated && text(row.status) !== "OUTDATED") {
        await client.query(`UPDATE route_workspaces SET status='OUTDATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, text(row.id)]);
        row = { ...row, status: "OUTDATED" };
      }
    }
    const sections = await client.query(`SELECT section_id AS "sectionId", title, objective, outline, draft_content AS "draftContent", evidence_links AS "evidenceLinks", citation_sources AS "citationSources", zotero_items AS "zoteroItems", status, user_approved AS "userApproved", provenance, version_number AS "version", updated_at AS "updatedAt" FROM route_workspace_sections WHERE ${tenantWhere()} AND route_workspace_id=$3 ORDER BY section_id`, [tenant.workspaceId, tenant.projectId, row ? text(row.id) : "none"]);
    const gates = await client.query(`SELECT gate_type AS "gateType", decision, checks, created_at AS "createdAt" FROM route_workspace_gates WHERE ${tenantWhere()} AND route_workspace_id=$3 ORDER BY created_at DESC`, [tenant.workspaceId, tenant.projectId, row ? text(row.id) : "none"]);
    const cra = await client.query(`SELECT id, course_objective AS "courseObjective", teaching_problem AS "teachingProblem", intervention, learning_outcome AS "learningOutcome", assessment, research_question AS "researchQuestion", status FROM course_research_alignment_items WHERE ${tenantWhere()} AND route_workspace_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, row ? text(row.id) : "none"]);
    return {
      ok: true,
      designGate: { approved: gate.approved, missing: gate.missing },
      locked: !gate.approved,
      workspace: row ? { ...row, sections: sections.rows, gates: gates.rows, courseResearchAlignment: cra.rows } : null,
      existed,
      lockedReason: gate.approved ? [] : gate.missing,
    };
  });
}

// ---------- 建立 workspace（設計 Gate 通過後） ----------
export async function createRouteWorkspace(tenant: ResearchTenant, input: { userId: string; route: "JOURNAL_PLANNING" | "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL"; role: "PRIMARY" | "SECONDARY" | "FUTURE_OUTPUT" | "NOT_SELECTED"; reason?: string }) {
  return withClient(async (client) => {
    const gate = await designGateApproved(client as never, tenant);
    if (!gate.approved) return { ok: false, locked: true, missing: gate.missing, error: "研究設計尚未核准；無法建立路線工作室。請先完成研究設計 Gate。" };
    const design = await client.query(`SELECT d.id, d.current_version_number AS "n", v.id AS "versionId" FROM research_design_analyses d LEFT JOIN research_design_versions v ON v.analysis_id=d.id AND v.version_number=d.current_version_number WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    const designId = design.rows[0] ? text(design.rows[0].id) : null;
    const designVersionId = design.rows[0] ? text(design.rows[0].versionId) : null;
    const designVersionN = design.rows[0] ? Number(design.rows[0].n ?? 0) : 0;
    const existing = await client.query(`SELECT id, status FROM route_workspaces WHERE ${tenantWhere()} AND route=$3`, [tenant.workspaceId, tenant.projectId, input.route]);
    if (existing.rows[0]) return { ok: false, error: "該路線工作室已存在；請使用既有工作區（不覆蓋）。", workspaceId: text(existing.rows[0].id) };
    const wsId = `rw_${randomUUID()}`;
    const payload = { route: input.route, role: input.role, designVersionId, designVersion: designVersionN, createdAt: new Date().toISOString() };
    await client.query(`INSERT INTO route_workspaces (id,workspace_id,project_id,research_project_id,route,workspace_role,status,source_design_version,source_design_version_id,current_version_number,source_hash,gate_state,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,'NOT_STARTED',$8,$9,1,$10,'{}',$3,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, wsId, await resolveResearchProjectId(client as never, tenant), input.route, input.role, designVersionN, designVersionId, hash(payload)]);
    await client.query(`INSERT INTO route_workspace_versions (id,workspace_id,project_id,route_workspace_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,1,NULL,'v1.0 Workspace Created',$5,$6,$7::jsonb,$8,now())`,
      [tenant.workspaceId, tenant.projectId, wsId, `rwv_${randomUUID()}`, input.reason ?? "route workspace 建立（設計已核准）", hash(payload), JSON.stringify(payload), input.userId]);
    await ensureRouteSections(client, tenant, wsId, input.route, input.userId);
    await audit(client, tenant, input.userId, "ROUTE_WORKSPACE_CREATED", { route: input.route, role: input.role, designVersionId, sections: ROUTE_SECTION_DEFS[input.route].length });
    return { ok: true, workspaceId: wsId, designVersionId, designVersion: designVersionN, locked: false };
  });
}

async function resolveResearchProjectId(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, tenant: ResearchTenant): Promise<string> {
  const rp = await client.query(`SELECT id FROM research_projects WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (rp.rows[0]) return text(rp.rows[0].id);
  throw new Error("research_project_required");
}

// ---------- Section 列 idempotent seed（workspace 建立／讀取／更新前確保既有列存在） ----------
async function ensureRouteSections(client: PoolClient, tenant: ResearchTenant, wsId: string, route: RouteSectionRouteKey, userId: string) {
  const defs = ROUTE_SECTION_DEFS[route];
  const existing = await client.query(`SELECT section_id AS "sectionId" FROM route_workspace_sections WHERE ${tenantWhere()} AND route_workspace_id=$3`, [tenant.workspaceId, tenant.projectId, wsId]);
  const have = new Set(existing.rows.map((r: Record<string, unknown>) => text(r.sectionId)));
  for (const def of defs) {
    if (have.has(def.id)) continue;
    await client.query(`INSERT INTO route_workspace_sections (id,workspace_id,project_id,route_workspace_id,section_id,title,objective,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,now(),now())`, [tenant.workspaceId, tenant.projectId, wsId, `rws_${randomUUID()}`, def.id, def.title, def.objective, userId]);
  }
}

// ---------- Section 更新（append-only，不覆蓋使用者核准版） ----------
export async function updateRouteSection(tenant: ResearchTenant, input: { userId: string; route: "JOURNAL_PLANNING" | "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL"; sectionId: string; title?: string; objective?: string; draftContent?: string; outline?: unknown[]; evidenceLinks?: unknown[]; citationSources?: unknown[]; zoteroItems?: unknown[]; userApproved?: boolean; status?: string; provenance?: "USER_PROVIDED" | "AI_PROPOSED" | "USER_REVIEWED" }) {
  return withClient(async (client) => {
    const ws = await client.query(`SELECT id, current_version_number AS "n" FROM route_workspaces WHERE ${tenantWhere()} AND route=$3`, [tenant.workspaceId, tenant.projectId, input.route]);
    if (!ws.rows[0]) throw new Error("route_workspace_required");
    const wsId = text(ws.rows[0].id);
    await ensureRouteSections(client, tenant, wsId, input.route, input.userId);
    const sec = await client.query(`SELECT id, draft_content AS "draftContent", user_approved AS "userApproved", provenance, version_number AS "version" FROM route_workspace_sections WHERE ${tenantWhere()} AND route_workspace_id=$3 AND section_id=$4`, [tenant.workspaceId, tenant.projectId, wsId, input.sectionId]);
    if (!sec.rows[0]) throw new Error("route_section_required");
    const secRow = sec.rows[0] as Record<string, unknown>;
    if (input.userApproved === false && Boolean(secRow.userApproved) === true) throw new Error("route_section_approved_locked");
    const prevProvenance = text(secRow.provenance);
    const nextProvenance = input.provenance ?? prevProvenance;
    const prevContent = text(secRow.draftContent);
    const newContent = typeof input.draftContent === "string" ? input.draftContent : prevContent;
    const nextVersion = Number(secRow.version ?? 0) + 1;
    const payload: Record<string, unknown> = {
      sectionId: input.sectionId,
      title: input.title ?? "",
      objective: input.objective ?? "",
      outline: input.outline ?? [],
      draftContent: newContent,
      evidenceLinks: input.evidenceLinks ?? [],
      citationSources: input.citationSources ?? [],
      zoteroItems: input.zoteroItems ?? [],
      status: input.status ?? "DRAFT",
      userApproved: input.userApproved ?? false,
      provenance: nextProvenance,
      version: nextVersion,
    };
    const contentHash = hash(payload);
    await client.query(`INSERT INTO route_workspace_section_versions (id,workspace_id,project_id,section_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,$5,NULL,$10,$6,$7,$8::jsonb,$9,now())`,
      [tenant.workspaceId, tenant.projectId, text(secRow.id), `rws_${randomUUID()}`, nextVersion, `section 更新（v${nextVersion}）`, contentHash, JSON.stringify(payload), input.userId, `v${nextVersion}`]);
    const newStatus = input.userApproved ? "APPROVED" : (input.status ?? "DRAFT");
    await client.query(`UPDATE route_workspace_sections SET draft_content=$3, outline=$4::jsonb, evidence_links=$5::jsonb, citation_sources=$6::jsonb, zotero_items=$7::jsonb, status=$8, user_approved=$9, provenance=$10, version_number=$11, source_hash=$12, updated_at=now() WHERE id=$13 AND ${tenantWhere()}`,
      [tenant.workspaceId, tenant.projectId, newContent, JSON.stringify(input.outline ?? []), JSON.stringify(input.evidenceLinks ?? []), JSON.stringify(input.citationSources ?? []), JSON.stringify(input.zoteroItems ?? []), newStatus, Boolean(input.userApproved), nextProvenance, nextVersion, contentHash, text(secRow.id)]);
    await audit(client, tenant, input.userId, "ROUTE_SECTION_UPDATED", { route: input.route, sectionId: input.sectionId, version: nextVersion, status: newStatus, provenance: nextProvenance });
    return { ok: true, sectionId: input.sectionId, version: nextVersion, status: newStatus };
  });
}

// ---------- Gate 檢查（三路線共用；依 route 不同 checks） ----------
const JOURNAL_CHECKS = [
  { key: "journal_family_or_target", label: "已確認目標期刊或期刊家族", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.targetJournal || ctx.journalFamily), detail: ctx.targetJournal ? `目標期刊：${ctx.targetJournal}` : "使用 JOURNAL_FAMILY_PLANNING（TARGET_JOURNAL_NOT_FINALIZED）" }) },
  { key: "positioning_profile", label: "期刊定位 Profile 已建立", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.positioning), detail: ctx.positioning ? "已建立" : "需建立 Target Audience／Contribution Delta／Theory Positioning" }) },
  { key: "alignment_matrix", label: "Journal–Research Alignment Matrix 已檢查", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(list(ctx.alignmentMatrix).length), detail: `已檢查 ${list(ctx.alignmentMatrix).length} 項（Aims/Article Type/Theory/Rigor…）` }) },
  { key: "manuscript_blueprint", label: "Manuscript Blueprint 已建立", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.manuscriptBlueprint), detail: ctx.manuscriptBlueprint ? "結構已建立（Results=NOT YET AVAILABLE）" : "需建立 Abstract Shell／Introduction／Theory／Methods／Results Placeholder／Discussion" }) },
  { key: "no_fake_results", label: "無虛構研究結果", check: (ctx: Record<string, unknown>) => ({ pass: !ctx.hasFakeResults, detail: ctx.hasFakeResults ? "偵測到疑似假結果；Results 必須為 NOT YET AVAILABLE" : "Results 保持 NOT YET AVAILABLE" }) },
  { key: "reporting_guideline", label: "Reporting Guideline 已規劃", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.reportingGuideline), detail: ctx.reportingGuideline ? `${ctx.reportingGuideline}` : "需依設計選定（RCT/Observational/Systematic Review/Mixed/AI…）" }) },
  { key: "preregistration_plan", label: "Preregistration/Open Science 已規劃", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.preregistrationPlan), detail: ctx.preregistrationPlan ? "已規劃（未假裝完成）" : "需規劃 Registration Platform／Timing／Data Sharing" }) },
  { key: "authorship_plan", label: "Authorship & Contribution 已規劃", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.authorshipPlan), detail: ctx.authorshipPlan ? "已規劃（PLANNED）" : "需規劃角色與 CRediT 分工" }) },
];

const NSTC_CHECKS = [
  { key: "nstc_basics", label: "計畫基本資料已建立", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.basics), detail: ctx.basics ? "已建立" : "需中文/英文題目、計畫類型、處別學門、關鍵詞" }) },
  { key: "abstract_skeleton", label: "中英文摘要骨架已建立", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.abstractSkeleton), detail: ctx.abstractSkeleton ? "已建立" : "需摘要骨架" }) },
  { key: "gap_linked", label: "Validated Gap 已連結", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.gapLinked), detail: ctx.gapLinked ? "已連結" : "需連結 Validated Research Gap" }) },
  { key: "method_plan", label: "研究方法/樣本/分析計畫已建立", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.methodPlan), detail: ctx.methodPlan ? "已建立" : "需研究方法、樣本與資料來源、分析計畫" }) },
  { key: "work_packages", label: "年度工作包已建立", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.workPackages), detail: ctx.workPackages ? "已建立" : "需依藍圖建立 Year 工作包" }) },
  { key: "evidence_coverage", label: "Evidence Coverage 已檢查", check: (ctx: Record<string, unknown>) => ({ pass: !ctx.citationNeeded, detail: ctx.citationNeeded ? "部分段落 CITATION_NEEDED；請補文獻" : "證據覆蓋完整" }) },
  { key: "ethics_plan", label: "研究倫理與資料管理已規劃", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.ethicsPlan), detail: ctx.ethicsPlan ? "已規劃（未宣稱核准）" : "需倫理與資料管理規劃（不虛構 IRB 號）" }) },
  { key: "no_fake_approval", label: "無虛構核定/送件狀態", check: (ctx: Record<string, unknown>) => ({ pass: !ctx.fakeApproval, detail: ctx.fakeApproval ? "偵測到疑似虛構核定" : "狀態保持 DRAFT（非 READY_FOR_SUBMISSION）" }) },
];

const MOE_CHECKS = [
  { key: "eligibility", label: "資格檢查已讀取", check: (ctx: Record<string, unknown>) => ({ pass: ctx.eligibility !== "BLOCKED", detail: ctx.eligibility === "BLOCKED" ? "ELIGIBILITY_BLOCKED（非主授課程/非學分課程/課程未開設/對象不符）" : "資格檢查完成" }) },
  { key: "teaching_problem", label: "教學問題已定義", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.teachingProblem), detail: ctx.teachingProblem ? "已定義（非僅技術新穎）" : "需定義：學生學不會什麼／課堂證據／現有教學不足" }) },
  { key: "baseline_evidence", label: "教學問題基線證據", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.baselineEvidence), detail: ctx.baselineEvidence ? "有基線證據（標註來源/年度/匿名化）" : "需基線證據（不得把主觀感覺當已證實）" }) },
  { key: "intervention_mechanism", label: "教學介入與學習機制", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.intervention), detail: ctx.intervention ? "已建立（介入→機制→學習成果→評量）" : "需介入設計＋學習機制" }) },
  { key: "course_research_alignment", label: "課程—研究一致性矩陣", check: (ctx: Record<string, unknown>) => ({ pass: !ctx.alignmentIssue, detail: ctx.alignmentIssue === "STUDENT_LEARNING_OUTCOME_MISSING" ? "學習成果缺評量；勿只用量表/TAM" : ctx.alignmentIssue === "COURSE_RESEARCH_MISALIGNMENT" ? "課程目標與研究結果無關" : "矩陣已檢查" }) },
  { key: "ethics_students", label: "研究倫理與學生權益", check: (ctx: Record<string, unknown>) => ({ pass: Boolean(ctx.ethicsPlan), detail: ctx.ethicsPlan ? "已規劃" : "需倫理與學生權益規劃（降低權力關係風險）" }) },
  { key: "evidence_coverage", label: "Evidence Coverage 已檢查", check: (ctx: Record<string, unknown>) => ({ pass: !ctx.citationNeeded, detail: ctx.citationNeeded ? "部分段落 CITATION_NEEDED" : "證據覆蓋完整" }) },
  { key: "no_fake_course_data", label: "無虛構課程資料/結果", check: (ctx: Record<string, unknown>) => ({ pass: !ctx.fakeCourseData, detail: ctx.fakeCourseData ? "偵測到疑似虛構課程/學生資料" : "課程資料保持真實（SOURCE/YEAR/匿名化）" }) },
];

// ---------- Gate 檢查：從已儲存 Section 導出內容脈絡（避免空 payload 造成永遠無法通過） ----------
async function buildGateSectionContext(client: PoolClient, tenant: ResearchTenant, wsId: string, route: RouteSectionRouteKey): Promise<Record<string, unknown>> {
  const sections = await client.query(`SELECT section_id AS "sectionId", draft_content AS "draftContent", evidence_links AS "evidenceLinks", status, user_approved AS "userApproved" FROM route_workspace_sections WHERE ${tenantWhere()} AND route_workspace_id=$3`, [tenant.workspaceId, tenant.projectId, wsId]);
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of sections.rows as Record<string, unknown>[]) byId.set(text(row.sectionId), row);
  const approved = (id: string) => { const r = byId.get(id); return Boolean(r && (r.userApproved === true || text(r.status) === "APPROVED")); };
  const content = (id: string) => { const r = byId.get(id); return text(r?.draftContent ?? ""); };
  const evidenceCount = (id: string) => { const r = byId.get(id); const links = Array.isArray(r?.evidenceLinks) ? r.evidenceLinks as unknown[] : []; return links.length; };
  const citationNeeded = sections.rows.some((r: Record<string, unknown>) => text(r.status) === "CITATION_NEEDED");
  const ctx: Record<string, unknown> = {};
  if (route === "JOURNAL_PLANNING") {
    // journal family／target：由使用者 payload 提供（journalFamily）；定位＋Alignment 已核准時視為 JOURNAL_FAMILY_PLANNING 脈絡
    ctx.positioning = approved("positioning") ? content("positioning") : "";
    ctx.manuscriptBlueprint = approved("manuscript-blueprint");
    ctx.alignmentMatrix = approved("alignment") ? [{ section: "alignment", status: "APPROVED" }] : [];
    ctx.reportingGuideline = approved("reporting-guideline") ? (content("reporting-guideline") || "REPORTING_GUIDELINE_PLANNED") : "";
    ctx.preregistrationPlan = approved("preregistration");
    ctx.authorshipPlan = approved("authorship");
    ctx.hasFakeResults = content("manuscript-blueprint").includes("NOT YET AVAILABLE") ? false : Boolean(byId.get("manuscript-blueprint") && !content("manuscript-blueprint").includes("NOT YET AVAILABLE") && content("manuscript-blueprint").length > 0 && /(?:顯著|p\s*[<＝<]|效果量|significant)/iu.test(content("manuscript-blueprint")));
    ctx.journalFamilyApprovedContext = approved("positioning") && approved("alignment");
  } else if (route === "NSTC_PROPOSAL") {
    ctx.basics = approved("basics");
    ctx.abstractSkeleton = approved("abstract");
    ctx.gapLinked = approved("problem") || (approved("background") && evidenceCount("background") > 0);
    ctx.methodPlan = approved("method");
    ctx.workPackages = approved("workplan");
    ctx.ethicsPlan = approved("ethics");
    ctx.citationNeeded = citationNeeded;
    ctx.fakeApproval = false;
  } else {
    ctx.teachingProblem = approved("teaching-problem");
    ctx.baselineEvidence = approved("teaching-problem") && evidenceCount("teaching-problem") > 0;
    ctx.intervention = approved("intervention");
    ctx.ethicsPlan = approved("ethics");
    ctx.citationNeeded = citationNeeded;
    ctx.fakeCourseData = false;
    // 課程—研究一致性：讀取 CRA items；學習成果缺評量 → alignmentIssue
    const cra = await client.query(`SELECT status FROM course_research_alignment_items WHERE ${tenantWhere()} AND route_workspace_id=$3`, [tenant.workspaceId, tenant.projectId, wsId]);
    if (cra.rows.some((r: Record<string, unknown>) => text(r.status) === "STUDENT_LEARNING_OUTCOME_MISSING")) ctx.alignmentIssue = "STUDENT_LEARNING_OUTCOME_MISSING";
    else if (approved("outcomes")) ctx.alignmentIssue = "";
  }
  return ctx;
}

export async function runRouteGate(tenant: ResearchTenant, input: { userId: string; route: "JOURNAL_PLANNING" | "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL"; payload: Record<string, unknown>; lock?: boolean }) {
  return withClient(async (client) => {
    const ws = await client.query(`SELECT id, current_version_number AS "n" FROM route_workspaces WHERE ${tenantWhere()} AND route=$3`, [tenant.workspaceId, tenant.projectId, input.route]);
    if (!ws.rows[0]) return { ok: false, error: "route_workspace_required", locked: true };
    const wsId = text(ws.rows[0].id);
    await ensureRouteSections(client, tenant, wsId, input.route, input.userId);
    const checks = input.route === "JOURNAL_PLANNING" ? JOURNAL_CHECKS : input.route === "NSTC_PROPOSAL" ? NSTC_CHECKS : MOE_CHECKS;
    const sectionCtx = await buildGateSectionContext(client, tenant, wsId, input.route);
    const ctx: Record<string, unknown> = { ...sectionCtx, ...(input.payload ?? {}) };
    // JOURNAL：目標期刊／家族由使用者提供（journalFamily）或定位＋Alignment 已核准（JOURNAL_FAMILY_PLANNING）
    if (input.route === "JOURNAL_PLANNING") {
      if (!text(ctx.targetJournal ?? "") && !text(ctx.journalFamily ?? "") && ctx.journalFamilyApprovedContext === true) ctx.journalFamily = "JOURNAL_FAMILY_PLANNING";
    }
    const results = checks.map((check) => ({ key: check.key, label: check.label, ...check.check(ctx) }));
    const failed = results.filter((r) => !r.pass);
    const gateState = { checkedAt: new Date().toISOString(), results };
    if (failed.length) {
      await client.query(`UPDATE route_workspaces SET gate_state=$3::jsonb, status='REVISION_REQUIRED', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), wsId]);
      return { ok: false, status: "REVISION_REQUIRED", failed, gateState };
    }
    if (!input.lock) {
      await client.query(`UPDATE route_workspaces SET gate_state=$3::jsonb, status='INTERNAL_REVIEW_READY', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), wsId]);
      return { ok: true, status: "INTERNAL_REVIEW_READY", failed: [], gateState };
    }
    // Lock：寫入 human gate + route_workspace_gates
    const gateType = input.route === "JOURNAL_PLANNING" ? "JOURNAL_RESEARCH_PLAN_RELEASE" : input.route === "NSTC_PROPOSAL" ? "NSTC_PROPOSAL_DRAFT_RELEASE" : "MOE_TPR_PROPOSAL_DRAFT_RELEASE";
    const gateId = `hg_${randomUUID()}`;
    const versionId = `rwv_${randomUUID()}`;
    const versionN = Number(ws.rows[0].n ?? 0) + 1;
    const versionPayload = { ...input.payload, gateType, lockedAt: new Date().toISOString() };
    await client.query(`INSERT INTO route_workspace_versions (id,workspace_id,project_id,route_workspace_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,$5,NULL,$9, 'route gate 核准', $6, $7::jsonb, $8, now())`, [tenant.workspaceId, tenant.projectId, wsId, versionId, versionN, hash(versionPayload), JSON.stringify(versionPayload), input.userId, `v${versionN} lock`]);
    await client.query(`UPDATE route_workspaces SET gate_state=$3::jsonb, status='APPROVED', current_version_number=$4, source_hash=$5, updated_at=now() WHERE id=$6 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), versionN, hash(versionPayload), wsId]);
    await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,'route_workspace',$6,$7,'APPROVED',$3,now(),now(),now())`, [tenant.workspaceId, tenant.projectId, input.userId, gateId, gateType, versionId, hash(gateState)]);
    await client.query(`INSERT INTO route_workspace_gates (id,workspace_id,project_id,route_workspace_id,route_workspace_version_id,gate_type,checks,decision,human_gate_id,created_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7::jsonb,'APPROVED',$8,now())`, [tenant.workspaceId, tenant.projectId, wsId, `rwg_${randomUUID()}`, versionId, gateType, JSON.stringify(results), gateId]);
    await audit(client, tenant, input.userId, `${gateType}_APPROVED`, { routeWorkspaceId: wsId, versionId });
    return { ok: true, status: "APPROVED", failed: [], gateState, gateType, humanGateId: gateId, versionId };
  });
}

// ---------- Course–Research Alignment 管理（MOE） ----------
export async function saveCourseResearchAlignment(tenant: ResearchTenant, input: { userId: string; items: { id?: string; courseObjective: string; teachingProblem?: string; intervention?: string; learningOutcome?: string; assessment?: string; researchQuestion?: string }[] }) {
  return withClient(async (client) => {
    const ws = await client.query(`SELECT id FROM route_workspaces WHERE ${tenantWhere()} AND route='MOE_TPR_PROPOSAL'`, [tenant.workspaceId, tenant.projectId]);
    if (!ws.rows[0]) return { ok: false, error: "route_workspace_required" };
    const wsId = text(ws.rows[0].id);
    for (const item of input.items) {
      const missingAssessment = item.learningOutcome && !item.assessment;
      const status = missingAssessment ? "STUDENT_LEARNING_OUTCOME_MISSING" : (!item.learningOutcome || !item.courseObjective) ? "DRAFT" : "ALIGNED";
      if (item.id) {
        await client.query(`UPDATE course_research_alignment_items SET course_objective=$3, teaching_problem=$4, intervention=$5, learning_outcome=$6, assessment=$7, research_question=$8, status=$9, updated_at=now() WHERE id=$10 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, item.courseObjective, item.teachingProblem ?? null, item.intervention ?? null, item.learningOutcome ?? null, item.assessment ?? null, item.researchQuestion ?? null, status, item.id]);
      } else {
        await client.query(`INSERT INTO course_research_alignment_items (id,workspace_id,project_id,route_workspace_id,course_objective,teaching_problem,intervention,learning_outcome,assessment,research_question,status,created_by_user_id,created_at,updated_at)
          VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())`, [tenant.workspaceId, tenant.projectId, wsId, `cra_${randomUUID()}`, item.courseObjective, item.teachingProblem ?? null, item.intervention ?? null, item.learningOutcome ?? null, item.assessment ?? null, item.researchQuestion ?? null, status, input.userId]);
      }
    }
    await audit(client, tenant, input.userId, "COURSE_RESEARCH_ALIGNMENT_SAVED", { count: input.items.length });
    return { ok: true, count: input.items.length };
  });
}

// ---------- 標記 OUTDATED（供上游變更時呼叫） ----------
export async function markRouteWorkspacesOutdated(tenant: ResearchTenant, input: { userId: string; reason: string; sourceTable: string; sourceId?: string }) {
  return withClient(async (client) => {
    const ws = await client.query(`SELECT id FROM route_workspaces WHERE ${tenantWhere()} AND status <> 'LOCKED'`, [tenant.workspaceId, tenant.projectId]);
    for (const row of ws.rows) {
      const id = text((row as Record<string, unknown>).id);
      await client.query(`UPDATE route_workspaces SET status='OUTDATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, id]);
      await client.query(`INSERT INTO route_workspace_outdated_marks (id,workspace_id,project_id,route_workspace_id,source_table,source_id,reason,created_at) VALUES ($4,$1,$2,$3,$5,$6,$7,now())`, [tenant.workspaceId, tenant.projectId, id, `rwom_${randomUUID()}`, input.sourceTable, input.sourceId ?? null, input.reason]);
    }
    return { ok: true, marked: ws.rows.length };
  });
}

