import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("manuscript_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function str(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value : fallback; }
function dt(value: unknown): string { if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString(); return typeof value === "string" ? value : ""; }
function int(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function hash(payload: unknown): string { return createHash("sha256").update(typeof payload === "string" ? payload : JSON.stringify(payload)).digest("hex"); }
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

const ARTICLE_TYPES = ["QUANTITATIVE_ORIGINAL_RESEARCH", "RANDOMIZED_TRIAL", "QUASI_EXPERIMENTAL_STUDY", "LONGITUDINAL_STUDY", "QUALITATIVE_RESEARCH", "MIXED_METHODS_RESEARCH", "DESIGN_SCIENCE_RESEARCH", "AI_MODEL_DEVELOPMENT_AND_VALIDATION", "HUMAN_AI_INTERACTION_STUDY", "EDUCATIONAL_INTERVENTION", "TEACHING_PRACTICE_RESEARCH", "OCCUPATIONAL_SAFETY_STUDY", "ENVIRONMENTAL_OR_FIELD_STUDY", "METHODS_OR_SYSTEM_PAPER", "SECONDARY_DATA_ANALYSIS"] as const;
const WRITING_MODES = ["GUIDED_WRITING", "CO_WRITING", "EVIDENCE_TO_DRAFT"] as const;
const STAGES = ["SCOPE_SETUP", "STORYLINE", "WRITING_PLAN", "STORYBOARD", "WRITING", "CONSISTENCY_CHECK", "VALIDATION_REQUIRED", "V1_SCIENTIFIC_DRAFT", "REVIEW_READY"] as const;
const SECTION_STATUSES = ["NOT_STARTED", "OUTLINE_READY", "EVIDENCE_ASSEMBLED", "DRAFT", "USER_REVIEW_REQUIRED", "APPROVED", "LOCKED"] as const;
const DEFAULT_SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ["abstract", "摘要"],
  ["introduction", "緒論"],
  ["methods", "方法"],
  ["results", "結果"],
  ["discussion", "討論"],
  ["conclusion", "結論與限制"],
] as const;

function approxWords(value: string): number {
  if (!value) return 0;
  const cjk = (value.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = value.replace(/[\u3400-\u9fff]/g, " ").split(/\s+/).filter(Boolean).length;
  return cjk + latin;
}

async function analysisPrerequisites(client: PoolClient, tenant: ResearchTenant): Promise<{ rawDataGate: boolean; datasetRegistered: boolean; lockedPlan: boolean; hasRuns: boolean }> {
  const gate = await one(client, `SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, "RAW_DATA_LOCKED_AND_HANDOFF_READY"]);
  const dataset = await one(client, `SELECT id FROM research_datasets WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const plan = await one(client, `SELECT id, locked_at FROM research_analysis_plans WHERE ${tenantWhere()} ORDER BY updated_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const run = await one(client, `SELECT id FROM research_analysis_runs WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  return { rawDataGate: Boolean(gate), datasetRegistered: Boolean(dataset), lockedPlan: Boolean(plan && plan.locked_at), hasRuns: Boolean(run) };
}

export async function getManuscriptCenter(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const pre = await analysisPrerequisites(client, tenant);
    const manuscript = await one(client, `SELECT id, manuscript_id, manuscript_name, working_title, article_type, writing_language, primary_route, central_research_question, primary_contribution, current_version, current_stage, status, writing_mode, created_at, updated_at FROM manuscript_projects WHERE ${tenantWhere()} ORDER BY updated_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    const sections = manuscript ? await many(client, `SELECT id, section_id, section_key, section_title, mode, body, status, word_target, current_word_count, updated_at FROM manuscript_sections WHERE ${tenantWhere()} AND manuscript_id=$3 ORDER BY created_at ASC`, [tenant.workspaceId, tenant.projectId, text(manuscript.manuscript_id)]) : [];
    const reasons: string[] = [];
    if (!pre.rawDataGate) reasons.push("尚未完成正式執行 Raw Data Lock；請先完成「正式研究與執行」並核准交接。");
    if (!pre.datasetRegistered) reasons.push("尚未註冊 Analysis Dataset；請先完成「資料治理與 Analysis Dataset」。");
    if (!pre.lockedPlan) reasons.push("尚未鎖定分析計畫；請先至「分析實驗室（12）」完成分析計畫。");
    if (!pre.hasRuns) reasons.push("尚無分析執行紀錄；請先至「分析實驗室（12）」建立並完成分析執行。");
    const locked = reasons.length > 0;
    const stage = str(manuscript?.current_stage, "SCOPE_SETUP");
    return {
      ok: true,
      locked,
      reasons,
      summary: {
        status: locked ? "MANUSCRIPT_STUDIO_LOCKED" : "MANUSCRIPT_ACTIVE",
        manuscriptId: text(manuscript?.manuscript_id),
        workingTitle: text(manuscript?.working_title),
        articleType: text(manuscript?.article_type),
        writingMode: text(manuscript?.writing_mode),
        currentStage: stage,
        sections: sections.length,
        completedSections: sections.filter((row) => text(row.status) === "APPROVED" || text(row.status) === "LOCKED").length,
        nextCenter: !pre.rawDataGate ? "execution" : !pre.datasetRegistered ? "governance" : "analysis-lab",
      },
      manuscript: manuscript ? { id: text(manuscript.id), manuscriptId: text(manuscript.manuscript_id), name: text(manuscript.manuscript_name), workingTitle: text(manuscript.working_title), articleType: text(manuscript.article_type), writingLanguage: text(manuscript.writing_language), primaryRoute: text(manuscript.primary_route), centralResearchQuestion: text(manuscript.central_research_question), primaryContribution: text(manuscript.primary_contribution), currentVersion: int(manuscript.current_version), currentStage: stage, status: text(manuscript.status), writingMode: text(manuscript.writing_mode), updatedAt: dt(manuscript.updated_at) } : null,
      sections: sections.map((row) => ({ id: text(row.id), sectionId: text(row.section_id), sectionKey: text(row.section_key), sectionTitle: text(row.section_title), mode: text(row.mode), body: text(row.body), status: text(row.status), wordTarget: int(row.word_target), currentWordCount: int(row.current_word_count), updatedAt: dt(row.updated_at) })),
    };
  });
}

export async function createManuscript(tenant: ResearchTenant, input: { userId: string; workingTitle: string; articleType?: string; writingMode?: string; primaryRoute?: string }) {
  const workingTitle = str(input.workingTitle).slice(0, 300);
  if (!workingTitle) return { ok: false, error: "manuscript_title_required" };
  const articleType = ARTICLE_TYPES.includes(str(input.articleType) as never) ? str(input.articleType) : "QUANTITATIVE_ORIGINAL_RESEARCH";
  const writingMode = WRITING_MODES.includes(str(input.writingMode) as never) ? str(input.writingMode) : "GUIDED_WRITING";
  const primaryRoute = str(input.primaryRoute, "JOURNAL").slice(0, 40);
  return withClient(async (client) => {
    const existing = await one(client, `SELECT id, manuscript_id FROM manuscript_projects WHERE ${tenantWhere()} AND status IN ('DRAFT','ACTIVE') ORDER BY updated_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (existing) return { ok: false, error: "manuscript_already_active", manuscriptId: text(existing.manuscript_id) };
    const id = `manu_${randomUUID()}`;
    const manuscriptId = `man_${randomUUID().slice(0, 12)}`;
    const rpRow = await one(client, `SELECT id FROM research_projects WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    const researchProjectId = text(rpRow?.id) || null;
    await client.query(`INSERT INTO manuscript_projects (id, workspace_id, project_id, manuscript_id, research_project_id, manuscript_name, working_title, article_type, writing_language, primary_route, current_version, current_stage, status, owner, writing_mode, created_by_user_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$6,$7,'zh-TW',$8,1,'SCOPE_SETUP','ACTIVE',$9,$10,$11,now(),now())`,
      [id, tenant.workspaceId, tenant.projectId, manuscriptId, researchProjectId, workingTitle, articleType, primaryRoute, input.userId, writingMode, input.userId]);
    for (const [sectionKey, sectionTitle] of DEFAULT_SECTIONS) {
      const sectionId = `mansec_${randomUUID().slice(0, 12)}`;
      await client.query(`INSERT INTO manuscript_sections (id, workspace_id, project_id, manuscript_id, section_id, section_key, section_title, mode, body, status, created_by_user_id, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'','NOT_STARTED',$9,now(),now())`,
        [`msect_${randomUUID()}`, tenant.workspaceId, tenant.projectId, manuscriptId, sectionId, sectionKey, sectionTitle, writingMode, input.userId]);
    }
    return { ok: true, manuscriptId, projectId: tenant.projectId };
  });
}

export async function saveManuscriptSettings(tenant: ResearchTenant, input: { userId: string; manuscriptId: string; workingTitle?: string; articleType?: string; writingMode?: string; currentStage?: string }) {
  return withClient(async (client) => {
    const row = await one(client, `SELECT id FROM manuscript_projects WHERE ${tenantWhere()} AND manuscript_id=$3`, [tenant.workspaceId, tenant.projectId, input.manuscriptId]);
    if (!row) return { ok: false, error: "manuscript_not_found" };
    const fields: string[] = [];
    const params: unknown[] = [tenant.workspaceId, tenant.projectId, input.manuscriptId];
    if (str(input.workingTitle)) { fields.push("working_title=$" + (params.length + 1)); params.push(str(input.workingTitle).slice(0, 300)); }
    if (ARTICLE_TYPES.includes(str(input.articleType) as never)) { fields.push("article_type=$" + (params.length + 1)); params.push(str(input.articleType)); }
    if (WRITING_MODES.includes(str(input.writingMode) as never)) { fields.push("writing_mode=$" + (params.length + 1)); params.push(str(input.writingMode)); }
    if (STAGES.includes(str(input.currentStage) as never)) { fields.push("current_stage=$" + (params.length + 1)); params.push(str(input.currentStage)); }
    if (!fields.length) return { ok: false, error: "manuscript_no_fields" };
    fields.push("updated_at=now()");
    await client.query(`UPDATE manuscript_projects SET ${fields.join(", ")} WHERE ${tenantWhere()} AND manuscript_id=$3`, params);
    return { ok: true, manuscriptId: input.manuscriptId };
  });
}

export async function saveManuscriptSection(tenant: ResearchTenant, input: { userId: string; manuscriptId: string; sectionId: string; body?: string; sectionTitle?: string; status?: string }) {
  return withClient(async (client) => {
    const section = await one(client, `SELECT id, section_title, status FROM manuscript_sections WHERE ${tenantWhere()} AND manuscript_id=$3 AND section_id=$4`, [tenant.workspaceId, tenant.projectId, input.manuscriptId, input.sectionId]);
    if (!section) return { ok: false, error: "manuscript_section_not_found" };
    const body = input.body === undefined ? text(section.body) : str(input.body).slice(0, 400_000);
    const sectionTitle = str(input.sectionTitle, text(section.section_title)).slice(0, 200);
    const status = input.status !== undefined && SECTION_STATUSES.includes(str(input.status) as never) ? str(input.status) : text(section.status);
    const words = approxWords(body);
    await client.query(`UPDATE manuscript_sections SET body=$3, section_title=$4, status=$5, current_word_count=$6, updated_at=now() WHERE ${tenantWhere()} AND manuscript_id=$7 AND section_id=$8`,
      [tenant.workspaceId, tenant.projectId, body, sectionTitle, status, words, input.manuscriptId, input.sectionId]);
    return { ok: true, sectionId: input.sectionId, currentWordCount: words, status };
  });
}

export async function setManuscriptSectionStatus(tenant: ResearchTenant, input: { userId: string; manuscriptId: string; sectionId: string; status: string }) {
  if (!SECTION_STATUSES.includes(str(input.status) as never)) return { ok: false, error: "manuscript_section_status_invalid" };
  return withClient(async (client) => {
    const section = await one(client, `SELECT id FROM manuscript_sections WHERE ${tenantWhere()} AND manuscript_id=$3 AND section_id=$4`, [tenant.workspaceId, tenant.projectId, input.manuscriptId, input.sectionId]);
    if (!section) return { ok: false, error: "manuscript_section_not_found" };
    await client.query(`UPDATE manuscript_sections SET status=$3, updated_at=now() WHERE ${tenantWhere()} AND manuscript_id=$4 AND section_id=$5`,
      [tenant.workspaceId, tenant.projectId, str(input.status), input.manuscriptId, input.sectionId]);
    return { ok: true, sectionId: input.sectionId, status: str(input.status) };
  });
}
