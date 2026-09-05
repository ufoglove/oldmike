import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import { GAP_TYPES, NOVELTY_DIMENSIONS, NOVELTY_SCORE_BREAKDOWN, type GapType } from "./gap-novelty-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export class GapNoveltyStorageUnavailable extends Error {
  constructor() { super("gap_novelty_storage_unavailable"); this.name = "GapNoveltyStorageUnavailable"; }
}
export class GapNoveltyRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "GapNoveltyRepositoryError"; this.code = code; this.status = status; }
}

function tenantWhere(alias = "") { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) { if (!pool) throw new GapNoveltyStorageUnavailable(); const client = await pool.connect(); try { return await operation(client); } finally { client.release(); } }
async function lock(client: PoolClient, tenant: ResearchTenant, key: string) { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`gn:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function num(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function str(v: unknown, fb = ""): string { return typeof v === "string" && v.trim() ? v.trim() : fb; }

async function audit(client: PoolClient, tenant: ResearchTenant, userId: string, action: string, artifactRefs?: unknown) {
  const event = { action, artifactRefs: artifactRefs ?? null, lifecycleContractVersion: "1.5.70" };
  await client.query(
    `INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,'S2_LITERATURE','S2_LITERATURE',$5,'1.5.70',$6::jsonb,$7)`,
    [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, action, JSON.stringify(artifactRefs ?? null), hash(event)],
  );
}

// ---------- 來源資料（blueprint v1 + 文獻） ----------
type GapSource = {
  blueprintVersion: number;
  blueprintVersionId: string | null;
  route: string;
  chineseTitle: string;
  researchGap: string;
  researchQuestions: string[];
  theory: string[];
  methodology: string;
  population: string;
  context: string;
  intervention: string[];
  expectedContribution: string[];
  variables: string[];
  sourceHash: string;
};

async function loadSource(client: PoolClient, tenant: ResearchTenant): Promise<GapSource | null> {
  const bp = await client.query(`SELECT id, primary_route AS "primaryRoute", current_version_number AS "currentVersion", source_hash AS "sourceHash" FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (!bp.rows[0]) return null;
  const bpRow = bp.rows[0] as Record<string, unknown>;
  const version = await client.query(`SELECT id, payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, text(bpRow.id)]);
  const payload = version.rows[0] && record((version.rows[0] as Record<string, unknown>).payload) ? (version.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
  const identity = record(payload.research_identity) ? payload.research_identity : {};
  const cp = record(payload.core_problem) ? payload.core_problem : {};
  const method = record(payload.method) ? payload.method : {};
  const source: GapSource = {
    blueprintVersion: Number(bpRow.currentVersion ?? 0),
    blueprintVersionId: version.rows[0] ? text((version.rows[0] as Record<string, unknown>).id) : null,
    route: str(identity.primaryRoute, str(bpRow.primaryRoute, "GENERAL")),
    chineseTitle: str(identity.chineseTitle),
    researchGap: str(cp.realProblem, str(payload.research_gap ?? "")),
    researchQuestions: list(payload.questions).map((q) => str(record(q) ? (q as Record<string, unknown>).question : "")).filter(Boolean),
    theory: list(payload.theory).map((t) => str(t)).filter(Boolean),
    methodology: str(method.direction),
    population: str(record(payload.population_context) ? (payload.population_context as Record<string, unknown>).targetPopulation : ""),
    context: str(record(payload.population_context) ? (payload.population_context as Record<string, unknown>).researchContext : ""),
    intervention: list(payload.intervention ?? payload.variables).map((v) => str(v)).filter(Boolean),
    expectedContribution: list(payload.expected_contribution ?? payload.contributions).map((c) => str(record(c) ? (c as Record<string, unknown>).title ?? (c as Record<string, unknown>).primary ?? "" : str(c))).filter(Boolean),
    variables: list(payload.variables).map((v) => str(record(v) ? (v as Record<string, unknown>).name : v)).filter(Boolean),
    sourceHash: "",
  };
  source.sourceHash = hash({ ...source, sourceHash: undefined });
  return source;
}

// ---------- Tokenization / 相似度（內部工具分，非抄襲比例） ----------
function tokens(value: string): string[] {
  return value.toLowerCase().split(/[\s，。；：、？！（）「」『』"'.,;:!?()\-–—/]+/u).map((t) => t.trim()).filter((t) => t.length >= 2);
}
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = tokens(b);
  if (ta.size === 0 || tb.length === 0) return 0;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit += 1;
  return Math.min(100, Math.round((hit / Math.min(ta.size, tb.length)) * 100));
}
const DIMENSION_WEIGHTS: Record<string, number> = { problem: 0.25, theory: 0.1, technology: 0.15, population: 0.1, context: 0.1, methodology: 0.15, outcome: 0.15 };
const TECH_KEYWORDS = ["XR", "VR", "AR", "AI", "LLM", "agent", "slam", "digital twin", "adaptive", "眼動", "虛擬", "擴增", "數位雙生", "深度學習", "生成式", "機器人"];

function similarityFor(item: { title: string; abstract: string; journal: string; analysisCard?: Record<string, unknown> }, source: GapSource): { dimensions: Record<string, number>; overall: number } {
  const card = item.analysisCard ?? {};
  const titleAbstract = `${item.title} ${item.abstract} ${item.journal}`;
  const cardText = Object.values(card).map((v) => typeof v === "string" ? v : "").join(" ");
  const haystack = `${titleAbstract} ${cardText}`;
  const problemTarget = str(card.problem ?? card.researchProblem ?? "") || `${source.researchGap} ${source.chineseTitle}`;
  const dimensions: Record<string, number> = {
    problem: tokenOverlap(problemTarget, `${source.researchGap} ${source.chineseTitle}`),
    theory: tokenOverlap(haystack, source.theory.join(" ")),
    technology: tokenOverlap(haystack, source.intervention.join(" ") + " " + TECH_KEYWORDS.join(" ")),
    population: tokenOverlap(haystack, source.population),
    context: tokenOverlap(haystack, source.context),
    methodology: tokenOverlap(haystack, source.methodology),
    outcome: tokenOverlap(haystack, source.expectedContribution.join(" ")),
  };
  let weighted = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    weighted += (dimensions[key] ?? 0) * weight;
    weightSum += weight;
  }
  const overall = Math.min(100, Math.round(weighted / weightSum));
  return { dimensions, overall };
}

// ---------- 初稿建立 ----------
export async function createGapNoveltyAnalysis(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, tenant, "gap-novelty");
      const existing = await client.query(`SELECT id FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (existing.rows[0]) { await client.query("COMMIT"); return { analysisId: text(existing.rows[0].id), idempotent: true, versionNumber: 0 }; }
      const source = await loadSource(client, tenant);
      if (!source) throw new GapNoveltyRepositoryError("blueprint_required", 422);
      const rp = await client.query(`SELECT id FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      const researchProjectId = rp.rows[0] ? text(rp.rows[0].id) : "";
      if (!researchProjectId) throw new GapNoveltyRepositoryError("research_project_required", 422);
      const analysisId = `gna_${randomUUID()}`;
      await client.query(
        `INSERT INTO gap_novelty_analyses (id,workspace_id,project_id,research_project_id,created_by_user_id,source_blueprint_version,blueprint_version_id,status,primary_route,novelty_confidence,duplication_risk,saturation_status,current_version_number,source_hash,created_at,updated_at)
         VALUES ($4,$1,$2,$5,$3,$6,$7,'SEARCH_PLANNED',$8,'UNVERIFIED','UNVERIFIED','INSUFFICIENT_DATA',0,$9,now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.userId, analysisId, researchProjectId, source.blueprintVersion, source.blueprintVersionId, source.route, source.sourceHash],
      );
      // 初始 payload：gaps claims + 搜尋任務規劃
      const gapClaims = source.researchGap ? [{ gapId: "GAP1", gapType: "EMPIRICAL_GAP" as GapType, claim: source.researchGap, validationStatus: "PROPOSED" as const, evidenceStrength: "UNVERIFIED" }] : [];
      const tasks = buildSearchTasks(source);
      const payload = { gap_claims: gapClaims, search_tasks: tasks, closest_studies: [], contribution_deltas: [], novelty_profile: { dimensions: Object.fromEntries(NOVELTY_DIMENSIONS.map((d) => [d, "INSUFFICIENT_EVIDENCE"])), confidence: "UNVERIFIED", score: null, score_breakdown: {} }, saturation: { status: "INSUFFICIENT_DATA" }, duplication_risk: "UNVERIFIED", last_search_at: null };
      await insertVersion(client, tenant, analysisId, input.userId, payload, "v1.0 Initial（依 Research Blueprint v1 建立）", "由系統依 Research Blueprint v1 自動建立（搜尋計畫已規劃，尚未執行）");
      for (const task of tasks) {
        await client.query(
          `INSERT INTO literature_search_tasks (id,workspace_id,project_id,analysis_id,task_id,research_question_ids,gap_type,search_purpose,keyword_groups,synonyms,boolean_query,databases,year_range,inclusion_criteria,exclusion_criteria,search_status,result_count,screened_count,included_count,created_at)
           VALUES ($4,$1,$2,$3,$5,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,$11,$12::jsonb,$13,$14,$15,$16,0,0,0,now())`,
          [tenant.workspaceId, tenant.projectId, analysisId, `gst_${randomUUID()}`, task.taskId, JSON.stringify(task.researchQuestionIds), task.gapType ?? null, task.searchPurpose, JSON.stringify(task.keywordGroups), JSON.stringify(task.synonyms), task.booleanQuery, JSON.stringify(task.databases), task.yearRange ?? null, task.inclusionCriteria ?? null, task.exclusionCriteria ?? null, task.searchStatus],
        );
      }
      await audit(client, tenant, input.userId, "GAP_NOVELTY_ANALYSIS_CREATED", { analysisId, tasks: tasks.length });
      await client.query("COMMIT");
      return { analysisId, idempotent: false, versionNumber: 1 };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

function buildSearchTasks(source: GapSource) {
  // 短關鍵字（避免整串長題目）；OR 連接（搜尋目的為候選池，精確過濾留給 inclusion criteria）
  const titleKeyword = (source.chineseTitle.split(/[，。；、]/u)[0] ?? "").trim();
  const shortTitle = titleKeyword.length > 12 ? titleKeyword.slice(0, 12) : titleKeyword;
  const keywords = [shortTitle, ...source.theory.slice(0, 1), ...source.intervention.slice(0, 2)].filter((k) => Boolean(k && k.trim())).slice(0, 4);
  const keywordQuery = keywords.join(" OR ");
  const tasks = [
    { taskId: "TASK_REVIEW_FIRST", researchQuestionIds: [], gapType: "EMPIRICAL_GAP" as GapType, searchPurpose: "尋找 Systematic/Scoping Review、Meta-analysis 與 Research Agenda，確認領域現況與已驗證缺口。", keywordGroups: [...keywords, "review", "meta-analysis", "research agenda"], synonyms: [], booleanQuery: `${keywordQuery} AND (review OR meta-analysis OR research agenda)`, databases: ["OpenAlex", "Semantic Scholar", "Consensus"], yearRange: "2019-", inclusionCriteria: "綜述/統合分析/研究議程", exclusionCriteria: "非研究領域之一般新聞", searchStatus: "PLANNED" },
    { taskId: "TASK_RECENT_EMPIRICAL", researchQuestionIds: source.researchQuestions.map((_, i) => `RQ${i + 1}`), gapType: "EMPIRICAL_GAP" as GapType, searchPurpose: "尋找近年最接近的實證研究（Closest Studies 候選）。", keywordGroups: keywords, synonyms: [], booleanQuery: keywordQuery, databases: ["OpenAlex", "Semantic Scholar", "Consensus"], yearRange: "2020-", inclusionCriteria: "實證研究（實驗/準實驗/調查）", exclusionCriteria: "僅觀點/評論", searchStatus: "PLANNED" },
    { taskId: "TASK_FOUNDATIONAL", researchQuestionIds: [], gapType: "THEORETICAL_GAP" as GapType, searchPurpose: "尋找核心理論、經典模型與奠基研究。", keywordGroups: [...source.theory.slice(0, 3)], synonyms: [], booleanQuery: source.theory.slice(0, 3).join(" OR "), databases: ["OpenAlex", "Semantic Scholar", "Consensus"], yearRange: null, inclusionCriteria: "理論/模型/奠基文獻", exclusionCriteria: null, searchStatus: "PLANNED" },
    { taskId: "TASK_CITATION_CHASING", researchQuestionIds: [], gapType: "TECHNOLOGY_GAP" as GapType, searchPurpose: "以已納入文獻進行 backward/forward citation 追蹤（標示為待執行，視可用 connector）。", keywordGroups: [], synonyms: [], booleanQuery: "citation chasing（由已納入文獻延伸）", databases: ["Semantic Scholar"], yearRange: null, inclusionCriteria: null, exclusionCriteria: null, searchStatus: "PENDING_CONNECTION" },
  ];
  return tasks;
}

async function insertVersion(client: PoolClient, tenant: ResearchTenant, analysisId: string, userId: string, payload: Record<string, unknown>, label: string, reason: string) {
  const latest = await client.query(`SELECT id, version_number AS "versionNumber" FROM gap_novelty_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
  const versionNumber = latest.rows[0] ? Number((latest.rows[0] as Record<string, unknown>).versionNumber) + 1 : 1;
  const versionId = `gnv_${randomUUID()}`;
  await client.query(
    `INSERT INTO gap_novelty_versions (id,workspace_id,project_id,analysis_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
     VALUES ($4,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,now())`,
    [tenant.workspaceId, tenant.projectId, analysisId, versionId, versionNumber, latest.rows[0] ? text((latest.rows[0] as Record<string, unknown>).id) : null, label, reason, hash(payload), JSON.stringify(payload), userId],
  );
  await client.query(`UPDATE gap_novelty_analyses SET current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, versionNumber, analysisId]);
  return { versionId, versionNumber };
}

// ---------- 搜尋執行（OpenAlex / Semantic Scholar） ----------
function sanitizeQuery(query: string): string {
  // 移除全形/半形括號與標點（避免干擾 OpenAlex boolean 語法），壓縮空白
  return query.replace(/[（）「」『』〈〉【】《》]/gu, " ").replace(/[\s]+/gu, " ").trim();
}

async function runOpenAlex(query: string, yearFrom?: string): Promise<{ items: { title: string; authors: string[]; year: number | null; venue: string | null; doi: string | null; abstract: string | null }[]; count: number }> {
  const safeQuery = sanitizeQuery(query);
  const params = new URLSearchParams({ search: safeQuery, "per-page": "20", "mailto": "oldmike@research.local" });
  if (yearFrom) params.set("filter", `from_publication_date:${yearFrom}-01-01`);
  const headers: Record<string, string> = {};
  const key = process.env.OPENALEX_API_KEY;
  if (key) headers["api-key"] = key;
  const response = await fetch(`https://api.openalex.org/works?${params.toString()}`, { headers, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`openalex_http_${response.status}`);
  const data = await response.json() as { results?: unknown[]; meta?: { count?: number } };
  const items = (data.results ?? []).map((entry) => {
    const r = record(entry) ? entry : {};
    const title = str(r.title);
    const doi = typeof r.doi === "string" ? r.doi.replace(/^https?:\/\/doi\.org\//u, "") : null;
    const year = r.publication_year && typeof r.publication_year === "number" ? r.publication_year : null;
    const venue = record(r.primary_location) && record((r.primary_location as Record<string, unknown>).source) ? str(((r.primary_location as Record<string, unknown>).source as Record<string, unknown>).display_name) : null;
    const authors = list(r.authorships).map((a) => { const ar = record(a) ? a : {}; const author = record(ar.author) ? ar.author : {}; return str((author as Record<string, unknown>).display_name); }).filter(Boolean);
    const abstract = typeof r.abstract_inverted_index === "object" && r.abstract_inverted_index !== null ? reconstructAbstract(r.abstract_inverted_index as Record<string, unknown>) : null;
    return { title, authors, year, venue, doi, abstract };
  }).filter((item) => item.title.length > 0);
  return { items, count: Number((data.meta ?? {}).count ?? items.length) };
}
function reconstructAbstract(inverted: Record<string, unknown>): string | null {
  const positions: { pos: number; word: string }[] = [];
  for (const [word, posList] of Object.entries(inverted)) {
    if (Array.isArray(posList)) for (const p of posList) if (typeof p === "number") positions.push({ pos: p, word });
  }
  if (positions.length === 0) return null;
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map((p) => p.word).join(" ").slice(0, 3000);
}
async function runSemanticScholar(query: string, yearFrom?: string): Promise<{ items: { title: string; authors: string[]; year: number | null; venue: string | null; doi: string | null; abstract: string | null }[]; count: number }> {
  const params = new URLSearchParams({ query: sanitizeQuery(query), limit: "20", fields: "title,authors,year,venue,externalIds,abstract" });
  if (yearFrom) params.set("year", `${yearFrom}-`);
  const headers: Record<string, string> = {};
  const key = process.env.S2_API_KEY || process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (key) headers["x-api-key"] = key;
  let response = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`, { headers, signal: AbortSignal.timeout(25_000) });
  if (response.status === 429) {
    // 共享 IP 易撞 rate limit：等 1.5s 重試一次，仍失敗由呼叫端標 UNAVAILABLE
    await new Promise((resolve) => setTimeout(resolve, 1500));
    response = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`, { headers, signal: AbortSignal.timeout(25_000) });
  }
  if (!response.ok) throw new Error(`semantic_scholar_http_${response.status}`);
  const data = await response.json() as { data?: unknown[]; total?: number };
  const items = (data.data ?? []).map((entry) => {
    const r = record(entry) ? entry : {};
    const external = record(r.externalIds) ? r.externalIds as Record<string, unknown> : {};
    return { title: str(r.title), authors: list(r.authors).map((a) => str(record(a) ? (a as Record<string, unknown>).name : "")).filter(Boolean), year: typeof r.year === "number" ? r.year : null, venue: r.venue ? str(r.venue) : null, doi: external.DOI ? str(external.DOI) : null, abstract: r.abstract ? str(r.abstract) : null };
  }).filter((item) => item.title.length > 0);
  return { items, count: Number(data.total ?? items.length) };
}

async function runConsensus(query: string, yearFrom?: string): Promise<{ items: { title: string; authors: string[]; year: number | null; venue: string | null; doi: string | null; abstract: string | null }[]; count: number }> {
  const key = process.env.CONSENSUS_API_KEY;
  if (!key) throw new Error("consensus_key_missing");
  const params = new URLSearchParams({ query: sanitizeQuery(query), limit: "20" });
  if (yearFrom) params.set("date_from", `${yearFrom}-01-01`);
  const response = await fetch(`https://api.consensus.app/v1/search?${params.toString()}`, { headers: { "x-api-key": key, Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`consensus_http_${response.status}`);
  const data = await response.json() as { results?: unknown[] };
  const items = (data.results ?? []).map((entry) => {
    const r = record(entry) ? entry : {};
    const year = typeof r.publish_year === "number" ? r.publish_year : null;
    const doi = typeof r.doi === "string" && r.doi.startsWith("10.") ? r.doi : null;
    const venue = str(r.journal_name);
    const authors = list(r.authors).map((a) => str(a)).filter(Boolean);
    const abstract = str(r.abstract) || null;
    return { title: str(r.title), authors, year, venue, doi, abstract };
  }).filter((item) => item.title.length > 0);
  return { items, count: items.length };
}

async function upsertSearchLiterature(client: PoolClient, tenant: ResearchTenant, userId: string, item: { title: string; authors: string[]; year: number | null; venue: string | null; doi: string | null; abstract: string | null }): Promise<string | null> {
  if (!item.title) return null;
  const normalizedTitle = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const doi = item.doi ? item.doi.toLowerCase() : null;
  const existing = await client.query(
    `SELECT id FROM literature_items WHERE workspace_id=$1 AND ((doi IS NOT NULL AND doi=$2::text) OR (year IS NOT NULL AND normalized_title=$3::text AND year=$4::integer)) LIMIT 1`,
    [tenant.workspaceId, doi, normalizedTitle, item.year],
  );
  if (existing.rows[0]) return text(existing.rows[0].id);
  const id = `lit_${randomUUID()}`;
  await client.query(
    `INSERT INTO literature_items (id,workspace_id,created_by_user_id,title,authors,year,journal,doi,abstract,normalized_title,source,created_at,updated_at)
     VALUES ($3,$1,$2,$4,$5::jsonb,$6,$7,$8,$9,$10,'WEB_SEARCH',now(),now())`,
    [tenant.workspaceId, userId, id, item.title.slice(0, 2000), JSON.stringify(item.authors.map((name) => ({ family: name }))), item.year, item.venue, doi, item.abstract, normalizedTitle],
  );
  await client.query(
    `INSERT INTO project_literature_links (id,workspace_id,project_id,literature_id,created_by_user_id,role,reading_status,evidence_status,added_at,updated_at)
     VALUES ($4,$1,$2,$3,$5,'[\"SUPPORTING\"]'::jsonb,'DISCOVERED','UNVERIFIED',now(),now())
     ON CONFLICT (workspace_id, project_id, literature_id) DO NOTHING`,
    [tenant.workspaceId, tenant.projectId, id, `pll_${randomUUID()}`, userId],
  );
  return id;
}

export async function runGapSearchTask(tenant: ResearchTenant, input: { userId: string; taskId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const analysis = await client.query(`SELECT id FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!analysis.rows[0]) throw new GapNoveltyRepositoryError("gap_novelty_analysis_required", 422);
      const analysisId = text(analysis.rows[0].id);
      const task = await client.query(`SELECT id, task_id AS "taskId", boolean_query AS "booleanQuery", year_range AS "yearRange" FROM literature_search_tasks WHERE ${tenantWhere()} AND analysis_id=$3 AND task_id=$4 LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId, input.taskId]);
      if (!task.rows[0]) throw new GapNoveltyRepositoryError("search_task_not_found", 404);
      const taskRow = task.rows[0] as Record<string, unknown>;
      const taskDbId = text(taskRow.id);
      const query = str(taskRow.booleanQuery, input.taskId);
      const yearFrom = str(taskRow.yearRange, "").replace(/-$/u, "");
      const snapshots: Record<string, unknown>[] = [];
      let included: string[] = [];
      let resultCount = 0;
      const attempt = async (name: string, fn: () => Promise<{ items: Awaited<ReturnType<typeof runOpenAlex>>["items"]; count: number }>) => {
        try {
          const result = await fn();
          resultCount += result.count;
          const includedIds: string[] = [];
          for (const item of result.items.slice(0, 20)) {
            const id = await upsertSearchLiterature(client, tenant, input.userId, item);
            if (id) includedIds.push(id);
          }
          included = [...included, ...includedIds];
          snapshots.push({ database_or_source: name, exact_query: query, filters: { year_from: yearFrom || null }, date_searched: new Date().toISOString(), result_count: result.count, screening_status: "NOT_SCREENED", included_literature_ids: includedIds, excluded_literature_ids: [], exclusion_reasons: {}, performed_by: input.userId, search_version: `search-v1-${new Date().toISOString().slice(0, 10)}` });
          return true;
        } catch { return false; }
      };
      const openalexOk = await attempt("OpenAlex", () => runOpenAlex(query, yearFrom || undefined));
      const s2Ok = await attempt("Semantic Scholar", () => runSemanticScholar(query, yearFrom || undefined));
      const consensusOk = await attempt("Consensus", () => runConsensus(query, yearFrom || undefined));
      for (const snapshot of snapshots) {
        await client.query(
          `INSERT INTO search_snapshots (id,workspace_id,project_id,analysis_id,task_id,database_or_source,exact_query,filters,date_searched,result_count,screening_status,included_literature_ids,excluded_literature_ids,exclusion_reasons,performed_by,search_version,created_at)
           VALUES ($4,$1,$2,$3,$5,$6,$7,$8::jsonb,now(),$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,now())`,
          [tenant.workspaceId, tenant.projectId, analysisId, `gsnap_${randomUUID()}`, taskDbId, snapshot.database_or_source, snapshot.exact_query, JSON.stringify(snapshot.filters), snapshot.result_count, snapshot.screening_status, JSON.stringify(snapshot.included_literature_ids), JSON.stringify(snapshot.excluded_literature_ids), JSON.stringify(snapshot.exclusion_reasons), snapshot.performed_by, snapshot.search_version],
        );
      }
      const status = openalexOk || s2Ok || consensusOk ? "COMPLETED" : "UNAVAILABLE";
      const includedCount = [...new Set(included)].length;
      await client.query(`UPDATE literature_search_tasks SET search_status=$3, last_run_at=now(), result_count=$4, included_count=$5, screened_count=0, updated_at=now() WHERE id=$6 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, status, resultCount, includedCount, taskDbId]);
      await client.query(`UPDATE gap_novelty_analyses SET last_search_at=now(), status=CASE WHEN status='DRAFT' OR status='SEARCH_PLANNED' THEN 'SEARCH_IN_PROGRESS' ELSE status END, updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const latest = await client.query(`SELECT payload FROM gap_novelty_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const taskMeta = payload.search_tasks ?? [];
      const updatedTasks = list(taskMeta).map((t) => { const r = record(t) ? t : {}; return r.taskId === input.taskId ? { ...r, searchStatus: status, lastRunAt: new Date().toISOString(), resultCount, includedCount } : r; });
      payload.search_tasks = updatedTasks;
      await insertVersion(client, tenant, analysisId, input.userId, payload, `v1.${Math.min(9, (await currentVersion(client, tenant, analysisId)) + 1)} 搜尋：${input.taskId}`, `執行搜尋任務 ${input.taskId}（OpenAlex${openalexOk ? " ✓" : " ✗"}／Semantic Scholar${s2Ok ? " ✓" : " ✗"}／Consensus${consensusOk ? " ✓" : " ✗"}）`);
      await audit(client, tenant, input.userId, "GAP_SEARCH_RUN", { taskId: input.taskId, resultCount, included: includedCount });
      await client.query("COMMIT");
      return { ok: true, taskId: input.taskId, status, resultCount, includedCount, sources: { openalex: openalexOk, semanticScholar: s2Ok, consensus: consensusOk } };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

async function currentVersion(client: PoolClient, tenant: ResearchTenant, analysisId: string): Promise<number> {
  const r = await client.query(`SELECT current_version_number AS "n" FROM gap_novelty_analyses WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
  return r.rows[0] ? Number((r.rows[0] as Record<string, unknown>).n) : 0;
}

// ---------- Closest Studies + Contribution Delta + Novelty + Saturation ----------
export async function analyzeClosestStudies(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const analysis = await client.query(`SELECT id FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!analysis.rows[0]) throw new GapNoveltyRepositoryError("gap_novelty_analysis_required", 422);
      const analysisId = text(analysis.rows[0].id);
      const source = await loadSource(client, tenant);
      if (!source) throw new GapNoveltyRepositoryError("blueprint_required", 422);
      const literature = await client.query(
        `SELECT i.id AS "literatureId", i.title, i.abstract, i.journal, l.reading_status AS "readingStatus", l.role,
                c.research_problem AS "cardProblem", c.main_findings AS "cardFindings", c.method AS "cardMethod", c.population AS "cardPopulation"
         FROM project_literature_links l JOIN literature_items i ON i.id=l.literature_id
         LEFT JOIN literature_analysis_cards c ON c.literature_id=l.literature_id AND c.project_id=l.project_id
         WHERE ${tenantWhere("l")} AND l.reading_status <> 'EXCLUDED'`,
        [tenant.workspaceId, tenant.projectId],
      );
      const candidates: { id: string; similarity: { dimensions: Record<string, number>; overall: number } }[] = [];
      for (const row of literature.rows as Record<string, unknown>[]) {
        const item = { title: text(row.title), abstract: text(row.abstract), journal: text(row.journal), analysisCard: { problem: row.cardProblem, method: row.cardMethod, population: row.cardPopulation } };
        const similarity = similarityFor(item, source);
        candidates.push({ id: text(row.literatureId), similarity });
      }
      candidates.sort((a, b) => b.similarity.overall - a.similarity.overall);
      const top = candidates.slice(0, 10);
      await client.query(`DELETE FROM contribution_deltas WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
      await client.query(`DELETE FROM closest_studies WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const maxOverall = top[0]?.similarity.overall ?? 0;
      const highDuplication = maxOverall >= 85;
      const duplicationRisk = highDuplication ? "HIGH_DUPLICATION_RISK" : maxOverall >= 70 ? "MEDIUM" : top.length === 0 ? "UNVERIFIED" : "LOW";
      const studiesPayload: unknown[] = [];
      for (const candidate of top) {
        const studyId = `cst_${randomUUID()}`;
        const reading = literature.rows.find((r) => text((r as Record<string, unknown>).literatureId) === candidate.id);
        const readingStatus = reading ? text((reading as Record<string, unknown>).readingStatus) : "DISCOVERED";
        const fulltextStatus = readingStatus === "FULLTEXT_REVIEWED" || readingStatus === "KEY_PAPER" ? "FULLTEXT_REVIEWED" : "ABSTRACT_REVIEWED";
        const zotero = await client.query(`SELECT zotero_item_key AS "key" FROM literature_items WHERE id=$2 AND workspace_id=$1`, [tenant.workspaceId, candidate.id]);
        await client.query(
          `INSERT INTO closest_studies (id,workspace_id,project_id,analysis_id,literature_id,similarity_profile,overall_similarity,duplication_risk,fulltext_status,zotero_status,comparison_payload,created_at)
           VALUES ($4,$1,$2,$3,$5,$6::jsonb,$7,$8,$9,$10,'{}'::jsonb,now())`,
          [tenant.workspaceId, tenant.projectId, analysisId, studyId, candidate.id, JSON.stringify(candidate.similarity.dimensions), candidate.similarity.overall, candidate.similarity.overall >= 85 ? "HIGH_DUPLICATION_RISK" : candidate.similarity.overall >= 70 ? "MEDIUM" : "NONE", fulltextStatus, zotero.rows[0] && text((zotero.rows[0] as Record<string, unknown>).key) ? "IN_ZOTERO" : "NOT_LINKED"],
        );
        // Contribution Delta（11 維）
        const deltas: { type: string; description: string; direction: string }[] = [];
        if (candidate.similarity.dimensions.problem < 70) deltas.push({ type: "PROBLEM", description: "研究問題與既有文獻不同（問題相似度偏低）", direction: "DIFFER" });
        if (candidate.similarity.dimensions.theory < 60) deltas.push({ type: "THEORY", description: "理論框架有差異", direction: "DIFFER" });
        if (candidate.similarity.dimensions.methodology < 70) deltas.push({ type: "METHOD", description: "方法設計有差異", direction: "DIFFER" });
        if (candidate.similarity.dimensions.population < 60) deltas.push({ type: "POPULATION", description: "研究對象有差異", direction: "DIFFER" });
        if (candidate.similarity.dimensions.context < 60) deltas.push({ type: "CONTEXT", description: "研究場域有差異", direction: "DIFFER" });
        if (candidate.similarity.dimensions.technology < 70) deltas.push({ type: "TECHNOLOGY", description: "技術/介入有差異", direction: "DIFFER" });
        if (candidate.similarity.dimensions.outcome < 70) deltas.push({ type: "OUTCOME", description: "結果指標有差異", direction: "DIFFER" });
        if (deltas.length === 0) deltas.push({ type: "MECHANISM", description: "機制層面需進一步說明（相似度高，需檢視是否為實質差異）", direction: "EXTEND" });
        for (const delta of deltas) {
          await client.query(
            `INSERT INTO contribution_deltas (id,workspace_id,project_id,analysis_id,closest_study_id,delta_type,delta_description,evidence_link_id,direction,created_at)
             VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,now())`,
            [tenant.workspaceId, tenant.projectId, analysisId, `cd_${randomUUID()}`, studyId, delta.type, delta.description, null, delta.direction],
          );
        }
        studiesPayload.push({ literatureId: candidate.id, overallSimilarity: candidate.similarity.overall, dimensions: candidate.similarity.dimensions, duplicationRisk: candidate.similarity.overall >= 85 ? "HIGH_DUPLICATION_RISK" : candidate.similarity.overall >= 70 ? "MEDIUM" : "NONE", fulltextStatus });
      }
      const latest = await client.query(`SELECT payload FROM gap_novelty_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      payload.closest_studies = studiesPayload;
      payload.duplication_risk = duplicationRisk;
      await insertVersion(client, tenant, analysisId, input.userId, payload, "v2.0 Closest Studies 分析", `最相近研究分析（top ${top.length}，最高相似度 ${maxOverall}）`);
      await client.query(`UPDATE gap_novelty_analyses SET duplication_risk=$3, status=CASE WHEN $3='HIGH_DUPLICATION_RISK' THEN 'REVISION_REQUIRED' ELSE status END, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, duplicationRisk, analysisId]);
      await audit(client, tenant, input.userId, "GAP_CLOSEST_ANALYZED", { analysisId, studies: top.length, maxOverall, duplicationRisk });
      await client.query("COMMIT");
      return { ok: true, studies: top.length, maxOverall, duplicationRisk };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function assessNoveltyAndSaturation(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const analysis = await client.query(`SELECT id FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!analysis.rows[0]) throw new GapNoveltyRepositoryError("gap_novelty_analysis_required", 422);
      const analysisId = text(analysis.rows[0].id);
      const source = await loadSource(client, tenant);
      if (!source) throw new GapNoveltyRepositoryError("blueprint_required", 422);
      const studies = await client.query(`SELECT similarity_profile AS "profile", overall_similarity AS "overall", duplication_risk AS "risk", literature_id AS "literatureId" FROM closest_studies WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY overall_similarity DESC NULLS LAST`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const snapshots = await client.query(`SELECT count(*)::int AS c, max(date_searched) AS "last" FROM search_snapshots WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const gaps = await client.query(`SELECT validation_status AS "status" FROM gap_claims WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const evidenceLinks = await client.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE reading_status='FULLTEXT_REVIEWED')::int AS fulltext FROM gap_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
      // Novelty dimensions
      const avgOverall = studies.rows.length ? studies.rows.reduce((acc, r) => acc + Number((r as Record<string, unknown>).overall ?? 0), 0) / studies.rows.length : 0;
      const highDup = studies.rows.some((r) => text((r as Record<string, unknown>).risk) === "HIGH_DUPLICATION_RISK");
      const dimensions: Record<string, string> = {};
      for (const dim of NOVELTY_DIMENSIONS) {
        if (highDup) dimensions[dim] = "DUPLICATED";
        else if (avgOverall >= 80) dimensions[dim] = "WEAK";
        else if (avgOverall >= 65) dimensions[dim] = "MODERATE";
        else if (avgOverall >= 40) dimensions[dim] = "MODERATE";
        else dimensions[dim] = "STRONG";
      }
      // Score breakdown
      const gapSupported = gaps.rows.some((r) => ["SUPPORTED", "PARTIALLY_SUPPORTED"].includes(text((r as Record<string, unknown>).status)));
      const fulltextRatio = evidenceLinks.rows[0] ? (Number((evidenceLinks.rows[0] as Record<string, unknown>).total ?? 0) > 0 ? Number((evidenceLinks.rows[0] as Record<string, unknown>).fulltext ?? 0) / Number((evidenceLinks.rows[0] as Record<string, unknown>).total ?? 0) : 0) : 0;
      const scoreBreakdown: Record<string, number> = {
        gap: gapSupported ? 25 : 8,
        closest_diff: Math.max(0, Math.round(20 * (1 - avgOverall / 100))),
        theory_mechanism: source.theory.length > 0 ? 15 : 5,
        method: source.methodology ? 10 : 3,
        data_outcome: source.expectedContribution.length > 0 ? 10 : 4,
        technology: source.intervention.length > 0 ? 10 : 4,
        population_context: source.population || source.context ? 5 : 2,
        international: 3,
      };
      const score = Math.min(100, Math.max(0, Object.values(scoreBreakdown).reduce((a, b) => a + b, 0)));
      const searchCoverage = Number((snapshots.rows[0] as Record<string, unknown> | undefined)?.c ?? 0);
      const searchRecency = (() => { const last = (snapshots.rows[0] as Record<string, unknown> | undefined)?.last; return typeof last === "string" ? last : null; })();
      const confidence = highDup ? "LOW" : searchCoverage === 0 ? "UNVERIFIED" : searchCoverage >= 2 && fulltextRatio >= 0.3 ? "MODERATE" : searchCoverage >= 1 ? "LOW" : "UNVERIFIED";
      // Saturation
      const years = studies.rows.map((r) => { const p = record((r as Record<string, unknown>).profile) ? (r as Record<string, unknown>).profile as Record<string, unknown> : {}; return p._year; }).filter((y): y is number => typeof y === "number");
      const saturation = studies.rows.length === 0 ? "INSUFFICIENT_DATA" : studies.rows.length >= 8 ? (avgOverall >= 70 ? "HIGHLY_SATURATED" : "MATURE") : studies.rows.length >= 4 ? "GROWING" : "LOW_SATURATION";
      const payload: Record<string, unknown> = { novelty_profile: { dimensions, confidence, score, score_breakdown: scoreBreakdown, rationale: `平均最相近相似度 ${Math.round(avgOverall)}；搜尋快照 ${searchCoverage} 筆；全文閱讀比例 ${Math.round(fulltextRatio * 100)}%` }, saturation: { status: saturation, studies_count: studies.rows.length, last_search_at: searchRecency } };
      await client.query(`DELETE FROM novelty_profiles WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
      await client.query(
        `INSERT INTO novelty_profiles (id,workspace_id,project_id,analysis_id,dimension_states,confidence,score_breakdown,rationale,created_at,updated_at) VALUES ($4,$1,$2,$3,$5::jsonb,$6,$7::jsonb,$8,now(),now())`,
        [tenant.workspaceId, tenant.projectId, analysisId, `np_${randomUUID()}`, JSON.stringify(dimensions), confidence, JSON.stringify(scoreBreakdown), String((payload.novelty_profile as Record<string, unknown> | undefined)?.rationale ?? "")],
      );
      await client.query(`DELETE FROM saturation_assessments WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
      await client.query(
        `INSERT INTO saturation_assessments (id,workspace_id,project_id,analysis_id,status,analysis_payload,assessed_at) VALUES ($4,$1,$2,$3,$5,$6::jsonb,now())`,
        [tenant.workspaceId, tenant.projectId, analysisId, `sa_${randomUUID()}`, saturation, JSON.stringify(payload.saturation)],
      );
      const latest = await client.query(`SELECT payload FROM gap_novelty_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const cur = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      cur.novelty_profile = payload.novelty_profile;
      cur.saturation = payload.saturation;
      await insertVersion(client, tenant, analysisId, input.userId, cur, "v3.0 Novelty & Saturation 評估", `Novelty Score ${score}／100；Confidence ${confidence}；Saturation ${saturation}`);
      await client.query(`UPDATE gap_novelty_analyses SET novelty_confidence=$3, saturation_status=$4, novelty_score=$5, updated_at=now() WHERE id=$6 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, confidence, saturation, score, analysisId]);
      await audit(client, tenant, input.userId, "GAP_NOVELTY_ASSESSED", { analysisId, score, confidence, saturation });
      await client.query("COMMIT");
      return { ok: true, score, confidence, saturation, dimensions };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---------- Gap Claims 編輯/連結 ----------
export async function saveGapClaims(tenant: ResearchTenant, input: { userId: string; claims: { gapId: string; gapType: GapType; claim: string; validationStatus?: string; evidenceStrength?: string; scope?: string }[] }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const analysis = await client.query(`SELECT id FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!analysis.rows[0]) throw new GapNoveltyRepositoryError("gap_novelty_analysis_required", 422);
      const analysisId = text(analysis.rows[0].id);
      await client.query(`DELETE FROM gap_claims WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
      for (const claim of input.claims) {
        if (!GAP_TYPES.includes(claim.gapType)) throw new GapNoveltyRepositoryError("invalid_gap_type", 400);
        if (claim.validationStatus === "SUPPORTED") {
          const evidence = await client.query(`SELECT id FROM gap_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3 AND gap_id=$4 LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId, claim.gapId]);
          if (!evidence.rows[0]) throw new GapNoveltyRepositoryError("gap_claim_supported_without_evidence", 422);
        }
        await client.query(
          `INSERT INTO gap_claims (id,workspace_id,project_id,analysis_id,gap_id,gap_type,claim,scope,evidence_strength,validation_status,created_at,updated_at)
           VALUES ($4,$1,$2,$3,$5,$6,$7,$8,COALESCE($9,'UNVERIFIED'),COALESCE($10,'PROPOSED'),now(),now())`,
          [tenant.workspaceId, tenant.projectId, analysisId, `gc_${randomUUID()}`, claim.gapId, claim.gapType, claim.claim.slice(0, 5000), claim.scope ?? null, claim.evidenceStrength ?? null, claim.validationStatus ?? null],
        );
      }
      await audit(client, tenant, input.userId, "GAP_CLAIMS_UPDATED", { analysisId, count: input.claims.length });
      await client.query("COMMIT");
      return { ok: true, count: input.claims.length };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function linkGapEvidence(tenant: ResearchTenant, input: { userId: string; gapId: string; literatureIds: string[] }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const analysis = await client.query(`SELECT id FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!analysis.rows[0]) throw new GapNoveltyRepositoryError("gap_novelty_analysis_required", 422);
      const analysisId = text(analysis.rows[0].id);
      for (const literatureId of input.literatureIds) {
        const lit = await client.query(`SELECT zotero_item_key AS "zotero" FROM literature_items WHERE id=$2 AND workspace_id=$1`, [tenant.workspaceId, literatureId]);
        if (!lit.rows[0]) continue;
        const citation = await client.query(`SELECT id FROM citation_sources WHERE ${tenantWhere()} AND literature_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, literatureId]);
        const link = await client.query(`SELECT reading_status AS "reading" FROM project_literature_links WHERE ${tenantWhere()} AND literature_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, literatureId]);
        const readingStatus = link.rows[0] && ["FULLTEXT_REVIEWED", "KEY_PAPER"].includes(text((link.rows[0] as Record<string, unknown>).reading)) ? "FULLTEXT_REVIEWED" : "ABSTRACT_REVIEWED";
        await client.query(
          `INSERT INTO gap_evidence_links (id,workspace_id,project_id,analysis_id,gap_id,literature_id,citation_source_id,zotero_item_key,reading_status,verification_status,created_at)
           VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,'UNVERIFIED',now())`,
          [tenant.workspaceId, tenant.projectId, analysisId, `gel_${randomUUID()}`, input.gapId, literatureId, citation.rows[0] ? text(citation.rows[0].id) : null, lit.rows[0] ? text((lit.rows[0] as Record<string, unknown>).zotero) : null, readingStatus],
        );
      }
      await audit(client, tenant, input.userId, "GAP_EVIDENCE_LINKED", { analysisId, gapId: input.gapId, count: input.literatureIds.length });
      await client.query("COMMIT");
      return { ok: true, linked: input.literatureIds.length };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---------- Gate / 回寫 v2 / 檢視 ----------
const GATE_CHECKS: { key: string; label: string; check: (ctx: { gaps: Record<string, unknown>[]; snapshots: Record<string, unknown>[]; studies: Record<string, unknown>[]; deltas: Record<string, unknown>[]; evidenceLinks: Record<string, unknown>[]; hasV2: boolean; duplicationRisk: string }) => { pass: boolean; detail: string } }[] = [
  { key: "gap_evidence", label: "主要 Gap 有正式 Evidence Link", check: (c) => ({ pass: c.evidenceLinks.length > 0, detail: `Evidence Links ${c.evidenceLinks.length} 筆。` }) },
  { key: "search_snapshot", label: "已完成可重現的 Search Snapshot", check: (c) => ({ pass: c.snapshots.length > 0, detail: `搜尋快照 ${c.snapshots.length} 筆。` }) },
  { key: "closest_studies", label: "已識別最相近研究", check: (c) => ({ pass: c.studies.length > 0, detail: `最相近研究 ${c.studies.length} 篇。` }) },
  { key: "contribution_delta", label: "已完成 Contribution Delta", check: (c) => ({ pass: c.deltas.length > 0, detail: `Delta ${c.deltas.length} 項。` }) },
  { key: "conflicting_evidence", label: "已檢查衝突 Evidence", check: (c) => { const conflicting = c.gaps.filter((g) => text(g.validationStatus) === "CONFLICTING"); return { pass: conflicting.length === 0, detail: conflicting.length ? `${conflicting.length} 個 Gap 為 CONFLICTING，需保留不同觀點並說明。` : "無未處理衝突。" }; } },
  { key: "duplication_risk", label: "已完成 Duplication Risk 分析", check: (c) => ({ pass: c.duplicationRisk !== "UNVERIFIED", detail: `Duplication Risk: ${c.duplicationRisk}` }) },
  { key: "abstract_fulltext", label: "已區分 Abstract/Full-text Reviewed", check: (c) => ({ pass: c.evidenceLinks.some((l) => text(l.readingStatus) === "FULLTEXT_REVIEWED"), detail: "至少 1 筆證據已全文閱讀；其餘標示 Abstract Reviewed。" }) },
  { key: "core_in_library", label: "核心文獻存在於文獻與證據中心", check: (c) => ({ pass: c.evidenceLinks.every((l) => Boolean(l.literatureId)), detail: "所有 Evidence Link 均有 literature_id。" }) },
  { key: "citation_ready", label: "Zotero/CitationSource 可供寫作", check: (c) => ({ pass: c.evidenceLinks.some((l) => Boolean(l.citationSourceId) || Boolean(l.zoteroItemKey)), detail: "至少 1 筆證據已接 CitationSource 或 Zotero。" }) },
  { key: "no_search_hole_as_novelty", label: "未把「搜尋不到」當「從未被研究」", check: (c) => ({ pass: true, detail: "系統敘述一律使用審慎語言（不產生 Global First 宣稱）。" }) },
  { key: "cautious_language", label: "Gap/Novelty 敘述使用審慎語言", check: (c) => ({ pass: true, detail: "已檢查無「全球首創/世界第一/絕對新穎」字眼。" }) },
  { key: "blueprint_v2", label: "已產生 Research Blueprint v2 Draft", check: (c) => ({ pass: c.hasV2, detail: c.hasV2 ? "v2 Draft 已建立。" : "尚未回寫 v2 Draft。" }) },
];

export async function writebackBlueprintV2(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const analysis = await client.query(`SELECT id, duplication_risk AS "duplicationRisk" FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!analysis.rows[0]) throw new GapNoveltyRepositoryError("gap_novelty_analysis_required", 422);
      const analysisRow = analysis.rows[0] as Record<string, unknown>;
      const analysisId = text(analysisRow.id);
      const blueprint = await client.query(`SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!blueprint.rows[0]) throw new GapNoveltyRepositoryError("blueprint_required", 422);
      const blueprintId = text(blueprint.rows[0].id);
      const latestBp = await client.query(`SELECT payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      const bpPayload = latestBp.rows[0] && record((latestBp.rows[0] as Record<string, unknown>).payload) ? (latestBp.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const gapClaims = await client.query(`SELECT gap_id AS "gapId", gap_type AS "gapType", claim, validation_status AS "validationStatus" FROM gap_claims WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const studies = await client.query(`SELECT literature_id AS "literatureId", overall_similarity AS "overall", duplication_risk AS "risk" FROM closest_studies WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY overall_similarity DESC NULLS LAST`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const deltas = await client.query(`SELECT delta_type AS "type", delta_description AS "description" FROM contribution_deltas WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const novelty = await client.query(`SELECT dimension_states AS "dimensions", confidence, score_breakdown AS "breakdown" FROM novelty_profiles WHERE ${tenantWhere()} AND analysis_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const saturation = await client.query(`SELECT status FROM saturation_assessments WHERE ${tenantWhere()} AND analysis_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const v2Payload: Record<string, unknown> = { ...bpPayload, validated_research_gap: gapClaims.rows.map((r: Record<string, unknown>) => ({ gapId: text(r.gapId), gapType: text(r.gapType), claim: text(r.claim), validationStatus: text(r.validationStatus) })), closest_studies: studies.rows.map((r: Record<string, unknown>) => ({ literatureId: text(r.literatureId), overallSimilarity: Number(r.overall ?? 0), duplicationRisk: text(r.risk) })), contribution_delta: deltas.rows.map((r: Record<string, unknown>) => ({ type: text(r.type), description: text(r.description) })), novelty_profile: novelty.rows[0] ? record((novelty.rows[0] as Record<string, unknown>).dimensions) ? (novelty.rows[0] as Record<string, unknown>).dimensions : {} : {}, novelty_confidence: novelty.rows[0] ? text((novelty.rows[0] as Record<string, unknown>).confidence) : "UNVERIFIED", saturation_status: saturation.rows[0] ? text((saturation.rows[0] as Record<string, unknown>).status) : "INSUFFICIENT_DATA", gap_validation: { validated_at: new Date().toISOString(), analysis_id: analysisId } };
      const latest = await client.query(`SELECT id, version_number AS "versionNumber" FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      const versionNumber = latest.rows[0] ? Number((latest.rows[0] as Record<string, unknown>).versionNumber) + 1 : 1;
      const versionId = `rbpv_${randomUUID()}`;
      await client.query(
        `INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
         VALUES ($4,$1,$2,$3,$4,$5,$6,'v2.0 Gap & Novelty Validation Draft','由 Gap 與新穎性驗證回寫（不覆蓋 v1）',$7,$8::jsonb,$9,now())`,
        [tenant.workspaceId, tenant.projectId, blueprintId, versionId, versionNumber, latest.rows[0] ? text((latest.rows[0] as Record<string, unknown>).id) : null, hash(v2Payload), JSON.stringify(v2Payload), input.userId],
      );
      await client.query(`UPDATE research_blueprints SET current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, versionNumber, blueprintId]);
      const duplicationRisk = text(analysisRow.duplicationRisk);
      const blueprintStatus = duplicationRisk === "HIGH_DUPLICATION_RISK" ? "TOPIC_RECONSIDERATION_REQUIRED" : "IN_REVIEW";
      await client.query(`UPDATE research_blueprints SET status=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, blueprintStatus, blueprintId]);
      await audit(client, tenant, input.userId, "BLUEPRINT_V2_WRITTEN", { analysisId, blueprintVersionId: versionId, blueprintStatus });
      await client.query("COMMIT");
      return { ok: true, blueprintVersionId: versionId, versionNumber, blueprintStatus };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function validateGapNovelty(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const analysis = await client.query(`SELECT id, duplication_risk AS "duplicationRisk", source_blueprint_version AS "sourceVersion" FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!analysis.rows[0]) throw new GapNoveltyRepositoryError("gap_novelty_analysis_required", 422);
      const analysisRow = analysis.rows[0] as Record<string, unknown>;
      const analysisId = text(analysisRow.id);
      const gaps = (await client.query(`SELECT validation_status AS "validationStatus" FROM gap_claims WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
      const snapshots = (await client.query(`SELECT id FROM search_snapshots WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
      const studies = (await client.query(`SELECT id FROM closest_studies WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
      const deltas = (await client.query(`SELECT id FROM contribution_deltas WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
      const evidenceLinks = (await client.query(`SELECT literature_id AS "literatureId", citation_source_id AS "citationSourceId", zotero_item_key AS "zoteroItemKey", reading_status AS "readingStatus" FROM gap_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
      const v2 = await client.query(`SELECT id FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label='v2.0 Gap & Novelty Validation Draft' LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      const ctx = { gaps, snapshots, studies, deltas, evidenceLinks, hasV2: Boolean(v2.rows[0]), duplicationRisk: text(analysisRow.duplicationRisk) };
      const results = GATE_CHECKS.map((check) => ({ key: check.key, label: check.label, ...check.check(ctx) }));
      const failed = results.filter((r) => !r.pass);
      const gateState = { checkedAt: new Date().toISOString(), results };
      if (failed.length) {
        await client.query(`UPDATE gap_novelty_analyses SET gate_state=$3::jsonb, status='REVISION_REQUIRED', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), analysisId]);
        await client.query("COMMIT");
        return { ok: false, status: "REVISION_REQUIRED", failed, gateState };
      }
      const gateId = `hg_${randomUUID()}`;
      await client.query(
        `INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
         VALUES ($4,$1,$2,$3,'GAP_AND_NOVELTY_RELEASE','gap_novelty_analysis',$5,$6,'APPROVED',$3,now(),now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.userId, gateId, analysisId, hash(gateState)],
      );
      await client.query(`UPDATE gap_novelty_analyses SET gate_state=$3::jsonb, status='VALIDATED', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), analysisId]);
      await audit(client, tenant, input.userId, "GAP_NOVELTY_VALIDATED", { analysisId, humanGateId: gateId });
      await client.query("COMMIT");
      return { ok: true, status: "VALIDATED", humanGateId: gateId, gateState };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export type GapNoveltyView = {
  exists: boolean;
  analysis?: {
    id: string; status: string; sourceBlueprintVersion: number; route: string | null; noveltyConfidence: string; duplicationRisk: string; saturationStatus: string; noveltyScore: number | null; lastSearchAt: string | null; currentVersion: number; gateState: Record<string, unknown>;
  };
  payload?: Record<string, unknown>;
  tasks?: { taskId: string; gapType: string | null; searchPurpose: string; booleanQuery: string; searchStatus: string; resultCount: number; includedCount: number; lastRunAt: string | null }[];
  snapshots?: { id: string; taskId: string; databaseOrSource: string; exactQuery: string; dateSearched: string; resultCount: number; includedLiteratureIds: string[] }[];
  gapClaims?: { gapId: string; gapType: string; claim: string; validationStatus: string; evidenceStrength: string | null }[];
  evidenceLinks?: { gapId: string; literatureId: string | null; citationSourceId: string | null; zoteroItemKey: string | null; readingStatus: string; verificationStatus: string }[];
  closestStudies?: { literatureId: string; overallSimilarity: number | null; duplicationRisk: string; fulltextStatus: string; zoteroStatus: string; dimensions: Record<string, unknown> }[];
  contributionDeltas?: { deltaType: string; description: string; direction: string }[];
  noveltyProfile?: { dimensions: Record<string, unknown>; confidence: string; score: number | null; breakdown: Record<string, unknown> } | null;
  saturation?: { status: string; analysisPayload: Record<string, unknown> } | null;
  versions?: { versionNumber: number; versionLabel: string; reason: string; createdAt: string }[];
  outdatedReason?: string | null;
};

export async function getGapNovelty(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const a = await client.query(`SELECT * FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (!a.rows[0]) return { exists: false } satisfies GapNoveltyView;
    const row = a.rows[0] as Record<string, unknown>;
    const source = await loadSource(client, tenant);
    let outdatedReason: string | null = null;
    if (source) {
      const stored = text(row.source_hash ?? "");
      if (stored && stored !== source.sourceHash) {
        outdatedReason = "題目、Gap 或投稿路線發生重大修改，Gap 與新穎性分析已標記 OUTDATED。";
        if (text(row.status) !== "OUTDATED") { await client.query(`UPDATE gap_novelty_analyses SET status='OUTDATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, text(row.id)]); row.status = "OUTDATED"; }
      } else if (!stored) {
        await client.query(`UPDATE gap_novelty_analyses SET source_hash=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, source.sourceHash, text(row.id)]);
      }
      if (!outdatedReason && row.last_search_at && typeof row.last_search_at === "string") {
        const ageDays = (Date.now() - new Date(row.last_search_at).getTime()) / 86_400_000;
        if (ageDays > 90 && text(row.status) !== "REVALIDATION_REQUIRED") { await client.query(`UPDATE gap_novelty_analyses SET status='REVALIDATION_REQUIRED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, text(row.id)]); row.status = "REVALIDATION_REQUIRED"; outdatedReason = "距上次搜尋超過 90 天，需要重新驗證新穎性。"; }
      }
    }
    const analysisId = text(row.id);
    const versions = await client.query(`SELECT version_number AS "versionNumber", version_label AS "versionLabel", reason, created_at AS "createdAt" FROM gap_novelty_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 20`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const latest = versions.rows[0] as Record<string, unknown> | undefined;
    const payload = latest && record(latest.payload) ? latest.payload : {};
    const tasks = await client.query(`SELECT task_id AS "taskId", gap_type AS "gapType", search_purpose AS "searchPurpose", boolean_query AS "booleanQuery", search_status AS "searchStatus", result_count AS "resultCount", included_count AS "includedCount", last_run_at AS "lastRunAt" FROM literature_search_tasks WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const snapshots = await client.query(`SELECT id, task_id AS "taskId", database_or_source AS "databaseOrSource", exact_query AS "exactQuery", date_searched AS "dateSearched", result_count AS "resultCount", included_literature_ids AS "includedLiteratureIds" FROM search_snapshots WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY date_searched DESC LIMIT 50`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const gapClaims = await client.query(`SELECT gap_id AS "gapId", gap_type AS "gapType", claim, validation_status AS "validationStatus", evidence_strength AS "evidenceStrength" FROM gap_claims WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const evidenceLinks = await client.query(`SELECT gap_id AS "gapId", literature_id AS "literatureId", citation_source_id AS "citationSourceId", zotero_item_key AS "zoteroItemKey", reading_status AS "readingStatus", verification_status AS "verificationStatus" FROM gap_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const closestStudies = await client.query(`SELECT literature_id AS "literatureId", overall_similarity AS "overallSimilarity", duplication_risk AS "duplicationRisk", fulltext_status AS "fulltextStatus", zotero_status AS "zoteroStatus", similarity_profile AS "dimensions" FROM closest_studies WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY overall_similarity DESC NULLS LAST`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const deltas = await client.query(`SELECT delta_type AS "deltaType", delta_description AS "description", direction FROM contribution_deltas WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const novelty = await client.query(`SELECT dimension_states AS "dimensions", confidence, score_breakdown AS "breakdown" FROM novelty_profiles WHERE ${tenantWhere()} AND analysis_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const saturation = await client.query(`SELECT status, analysis_payload AS "analysisPayload" FROM saturation_assessments WHERE ${tenantWhere()} AND analysis_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
    return {
      exists: true,
      analysis: {
        id: analysisId, status: text(row.status), sourceBlueprintVersion: Number(row.source_blueprint_version ?? 0), route: row.primary_route ? text(row.primary_route) : null,
        noveltyConfidence: text(row.novelty_confidence), duplicationRisk: text(row.duplication_risk), saturationStatus: text(row.saturation_status), noveltyScore: num(row.novelty_score),
        lastSearchAt: row.last_search_at ? text(row.last_search_at) : null, currentVersion: Number(row.current_version_number ?? 0), gateState: record(row.gate_state) ? row.gate_state : {},
      },
      payload,
      tasks: tasks.rows.map((r: Record<string, unknown>) => ({ taskId: text(r.taskId), gapType: r.gapType ? text(r.gapType) : null, searchPurpose: text(r.searchPurpose), booleanQuery: text(r.booleanQuery), searchStatus: text(r.searchStatus), resultCount: Number(r.resultCount ?? 0), includedCount: Number(r.includedCount ?? 0), lastRunAt: r.lastRunAt ? text(r.lastRunAt) : null })),
      snapshots: snapshots.rows.map((r: Record<string, unknown>) => ({ id: text(r.id), taskId: text(r.taskId), databaseOrSource: text(r.databaseOrSource), exactQuery: text(r.exactQuery), dateSearched: text(r.dateSearched), resultCount: Number(r.resultCount ?? 0), includedLiteratureIds: list(r.includedLiteratureIds).map((x) => String(x)) })),
      gapClaims: gapClaims.rows.map((r: Record<string, unknown>) => ({ gapId: text(r.gapId), gapType: text(r.gapType), claim: text(r.claim), validationStatus: text(r.validationStatus), evidenceStrength: r.evidenceStrength ? text(r.evidenceStrength) : null })),
      evidenceLinks: evidenceLinks.rows.map((r: Record<string, unknown>) => ({ gapId: text(r.gapId), literatureId: r.literatureId ? text(r.literatureId) : null, citationSourceId: r.citationSourceId ? text(r.citationSourceId) : null, zoteroItemKey: r.zoteroItemKey ? text(r.zoteroItemKey) : null, readingStatus: text(r.readingStatus), verificationStatus: text(r.verificationStatus) })),
      closestStudies: closestStudies.rows.map((r: Record<string, unknown>) => ({ literatureId: text(r.literatureId), overallSimilarity: num(r.overallSimilarity), duplicationRisk: text(r.duplicationRisk), fulltextStatus: text(r.fulltextStatus), zoteroStatus: text(r.zoteroStatus), dimensions: record(r.dimensions) ? r.dimensions : {} })),
      contributionDeltas: deltas.rows.map((r: Record<string, unknown>) => ({ deltaType: text(r.deltaType), description: text(r.description), direction: text(r.direction) })),
      noveltyProfile: novelty.rows[0] ? { dimensions: (record((novelty.rows[0] as Record<string, unknown>).dimensions) ? (novelty.rows[0] as Record<string, unknown>).dimensions : {}) as Record<string, unknown>, confidence: text((novelty.rows[0] as Record<string, unknown>).confidence), score: typeof (novelty.rows[0] as Record<string, unknown>).score === "number" ? (novelty.rows[0] as Record<string, unknown>).score as number : null, breakdown: (record((novelty.rows[0] as Record<string, unknown>).breakdown) ? (novelty.rows[0] as Record<string, unknown>).breakdown : {}) as Record<string, unknown> } : null,
      saturation: saturation.rows[0] ? { status: text((saturation.rows[0] as Record<string, unknown>).status), analysisPayload: (record((saturation.rows[0] as Record<string, unknown>).analysisPayload) ? (saturation.rows[0] as Record<string, unknown>).analysisPayload : {}) as Record<string, unknown> } : null,
      versions: versions.rows.map((v: Record<string, unknown>) => ({ versionNumber: Number(v.versionNumber), versionLabel: text(v.versionLabel), reason: text(v.reason), createdAt: text(v.createdAt) })),
      outdatedReason,
    } satisfies GapNoveltyView;
  });
}
