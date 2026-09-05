import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import { derivePrimaryRoute, deriveSecondaryRoute, type BlueprintRoute, type CoverageStatus, type LogicFinding, type SectionEdit } from "./research-blueprint-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export class ResearchBlueprintStorageUnavailable extends Error {
  constructor() { super("research_blueprint_storage_unavailable"); this.name = "ResearchBlueprintStorageUnavailable"; }
}
export class ResearchBlueprintRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "ResearchBlueprintRepositoryError"; this.code = code; this.status = status; }
}

function tenantWhere(alias = "") { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) { if (!pool) throw new ResearchBlueprintStorageUnavailable(); const client = await pool.connect(); try { return await operation(client); } finally { client.release(); } }
async function lock(client: PoolClient, tenant: ResearchTenant, key: string) { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`bp:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function int(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0; }
function str(v: unknown, fb = ""): string { return typeof v === "string" && v.trim() ? v.trim() : fb; }

async function audit(client: PoolClient, tenant: ResearchTenant, userId: string, action: string, artifactRefs?: unknown) {
  const event = { action, artifactRefs: artifactRefs ?? null, lifecycleContractVersion: "1.5.65" };
  await client.query(
    `INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,'S1_BLUEPRINT','S1_BLUEPRINT',$5,'1.5.65',$6::jsonb,$7)`,
    [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, action, JSON.stringify(artifactRefs ?? null), hash(event)],
  );
}

// ---------- 來源資料 ----------
type BlueprintSource = {
  chineseTitle: string; englishTitle: string; projectType: string; researchGap: string;
  researchQuestions: string[]; theory: string[]; conceptualFramework: string | null; methodology: string;
  population: string; context: string; variables: string[]; expectedContribution: string[];
  targetJournals: { journalName: string; publisher: string | null; fitScore: number | null }[];
  nstcRoute: { routeName: string; fitScore: number | null; status: string } | null;
  moeRoute: { routeName: string; fitScore: number | null; status: string } | null;
  researcherProfile: Record<string, unknown> | null;
  sourceHash: string;
};

async function loadSource(client: PoolClient, tenant: ResearchTenant): Promise<BlueprintSource | null> {
  const projectResult = await client.query(`SELECT project_type AS "projectType", blueprint_payload AS "blueprintPayload" FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const row = projectResult.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  // 專案標題 fallback：建立研究專案未帶入標題時，至少繼承 projects.title（避免整份藍圖無題目）
  const titleResult = await client.query(`SELECT title FROM projects WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const projectTitle = titleResult.rows[0] ? str(titleResult.rows[0].title) : "";
  const b = record(row.blueprintPayload) ? row.blueprintPayload : {};
  const journals = list(b.target_journals).map((entry) => { const r = record(entry) ? entry : {}; return { journalName: str(r.journalName), publisher: r.publisher ? str(r.publisher) : null, fitScore: typeof r.fitScore === "number" ? r.fitScore : null }; });
  const nstc = record(b.nstc_route) ? b.nstc_route : null;
  const moe = record(b.teaching_practice_route) ? b.teaching_practice_route : null;
  const rawTitle = str(b.chinese_title);
  const source: BlueprintSource = {
    chineseTitle: rawTitle && rawTitle !== "待確認（missing）" ? rawTitle : (projectTitle || "MISSING"),
    englishTitle: str(b.english_title, "MISSING"),
    projectType: str(row.projectType, "GENERAL"),
    researchGap: str(b.research_gap, "MISSING"),
    researchQuestions: list(b.research_questions).map((q) => str(q)).filter(Boolean),
    theory: list(b.theory).map((t) => str(t)).filter(Boolean),
    conceptualFramework: b.conceptual_framework ? str(b.conceptual_framework) : null,
    methodology: str(b.methodology, "MISSING"),
    population: str(b.population, "MISSING"),
    context: str(b.context, "MISSING"),
    variables: list(b.variables).map((v) => str(v)).filter(Boolean),
    expectedContribution: list(b.expected_contribution).map((c) => str(c)).filter(Boolean),
    targetJournals: journals,
    nstcRoute: nstc ? { routeName: str(nstc.routeName, "MISSING"), fitScore: typeof nstc.fitScore === "number" ? nstc.fitScore : null, status: str(nstc.status, "MISSING") } : null,
    moeRoute: moe ? { routeName: str(moe.routeName, "MISSING"), fitScore: typeof moe.fitScore === "number" ? moe.fitScore : null, status: str(moe.status, "MISSING") } : null,
    researcherProfile: record(b.researcher_profile_snapshot) ? b.researcher_profile_snapshot : null,
    sourceHash: "",
  };
  source.sourceHash = hash({ ...source, sourceHash: undefined });
  return source;
}

// ---------- Evidence Coverage ----------
const COVERAGE_ROLE_MAP: Record<string, string[]> = {
  PROBLEM_IMPORTANCE: ["CORE"],
  GAP: ["GAP"],
  THEORY: ["THEORY"],
  METHOD: ["METHOD"],
  MEASUREMENT: ["MEASUREMENT"],
  SIMILAR_STUDY: ["SIMILAR_STUDY"],
  CONTRIBUTION: ["CORE", "SUPPORTING"],
  TEACHING_PROBLEM: ["GAP", "SUPPORTING"],
};

export async function computeEvidenceCoverage(client: PoolClient, tenant: ResearchTenant): Promise<Record<string, { status: CoverageStatus; count: number }>> {
  const result = await client.query(
    `SELECT l.role, l.evidence_status AS "evidenceStatus", count(*)::int AS c
     FROM project_literature_links l
     WHERE ${tenantWhere("l")} AND l.reading_status <> 'EXCLUDED'
     GROUP BY l.role, l.evidence_status`,
    [tenant.workspaceId, tenant.projectId],
  );
  const byRole = new Map<string, { verified: number; total: number; conflicting: boolean }>();
  for (const row of result.rows as Record<string, unknown>[]) {
    const roles = list(row.role).filter((r): r is string => typeof r === "string");
    const status = text(row.evidenceStatus);
    const count = Number(row.c ?? 0);
    for (const role of roles) {
      const entry = byRole.get(role) ?? { verified: 0, total: 0, conflicting: false };
      entry.total += count;
      if (status === "VERIFIED" || status === "SUPPORTED") entry.verified += count;
      byRole.set(role, entry);
    }
  }
  const coverage: Record<string, { status: CoverageStatus; count: number }> = {};
  for (const [target, roles] of Object.entries(COVERAGE_ROLE_MAP)) {
    let total = 0; let verified = 0;
    for (const role of roles) { const entry = byRole.get(role); if (entry) { total += entry.total; verified += entry.verified; } }
    const status: CoverageStatus = total === 0 ? "MISSING" : verified === 0 ? "UNVERIFIED" : verified >= total * 0.5 ? (verified === total ? "SUPPORTED" : "PARTIALLY_SUPPORTED") : "PARTIALLY_SUPPORTED";
    coverage[target] = { status, count: total };
  }
  return coverage;
}

function coverageReadiness(coverage: Record<string, { status: CoverageStatus; count: number }>): CoverageStatus {
  const statuses = Object.values(coverage).map((entry) => entry.status);
  if (statuses.every((s) => s === "SUPPORTED")) return "SUPPORTED";
  if (statuses.some((s) => s === "MISSING")) return "MISSING";
  if (statuses.some((s) => s === "PARTIALLY_SUPPORTED" || s === "UNVERIFIED")) return "PARTIALLY_SUPPORTED";
  return "UNVERIFIED";
}

// ---------- Logic Alignment Checker ----------
export function runLogicChecker(payload: Record<string, unknown>): LogicFinding[] {
  const findings: LogicFinding[] = [];
  const questions = list(payload.questions);
  const objectives = list(payload.objectives);
  const hypotheses = list(payload.hypotheses);
  const variables = list(payload.variables);
  const gaps = list(payload.gaps);
  const method = record(payload.method) ? payload.method : {};
  const objectiveKeys = new Set(objectives.map((o) => str(record(o) ? (o as Record<string, unknown>).objectiveKey : "", "MISSING")));
  const variableKeys = new Set(variables.map((v) => str(record(v) ? (v as Record<string, unknown>).variableKey : "", "MISSING")));
  const questionKeys = new Set(questions.map((q) => str(record(q) ? (q as Record<string, unknown>).rqKey : "", "MISSING")));

  for (const q of questions) {
    const row = record(q) ? q : {};
    const rqKey = str(row.rqKey, "MISSING");
    const objectiveKey = str(row.objectiveKey, "");
    const expectedData = str(row.expectedData, "");
    const proposedAnalysis = str(row.proposedAnalysis, "");
    if (!objectiveKey || !objectiveKeys.has(objectiveKey)) {
      findings.push({ severity: "LOGIC_GAP", chain: `${rqKey}→Objective`, description: objectiveKey ? `${rqKey} 對應的 Objective ${objectiveKey} 不存在。` : `${rqKey} 尚未對應任何 Objective。`, suggestion: "將 RQ 連結到已建立的 Objective。" });
    }
    if (!expectedData || expectedData === "MISSING") {
      findings.push({ severity: "LOGIC_GAP", chain: `${rqKey}→Expected Data`, description: `${rqKey} 未規劃 expected_data。`, suggestion: "補上初步資料規劃（可標 PROVISIONAL）。" });
    }
    if (!proposedAnalysis || proposedAnalysis === "MISSING") {
      findings.push({ severity: "LOGIC_GAP", chain: `${rqKey}→Proposed Analysis`, description: `${rqKey} 未規劃 proposed_analysis。`, suggestion: "補上初步分析方法（可標 PROVISIONAL）。" });
    }
    const needsLongitudinal = /追蹤|延宕|長期|follow-?up|縱貫|時間點/iu.test(`${expectedData} ${str(row.question, "")}`);
    if (needsLongitudinal && !/追蹤|延宕|長期|follow-?up|縱貫|時間點|重複測量|多波/iu.test(expectedData)) {
      findings.push({ severity: "MAJOR_LOGIC_GAP", chain: `${rqKey}→Expected Data`, description: `${rqKey} 需要長期/追蹤資料，但資料規劃未含 follow-up 時間點。`, suggestion: "在 expected_data 加入追蹤時間點（PROVISIONAL）。" });
    }
  }
  for (const h of hypotheses) {
    const row = record(h) ? h : {};
    if (str(row.status, "") === "NOT_APPLICABLE") continue;
    const hKey = str(row.hypothesisKey, "MISSING");
    const rqKey = str(row.rqKey, "");
    const vars = list(row.variables).map((v) => str(v)).filter(Boolean);
    if (rqKey && !questionKeys.has(rqKey)) findings.push({ severity: "LOGIC_GAP", chain: `${hKey}→RQ`, description: `${hKey} 連結的 RQ ${rqKey} 不存在。`, suggestion: "修正假設的 RQ 連結。" });
    for (const v of vars) {
      if (!variableKeys.has(v)) findings.push({ severity: "LOGIC_GAP", chain: `${hKey}→Variable`, description: `${hKey} 使用的變數 ${v} 未列入 Variables。`, suggestion: "在 Variables 區塊加入該變數。" });
    }
  }
  if (gaps.length === 0) findings.push({ severity: "LOGIC_GAP", chain: "Problem→Gap", description: "尚未定義 Research Gap。", suggestion: "在問題與 Gap 區塊建立至少一個 Gap。" });
  if (objectives.length === 0) findings.push({ severity: "LOGIC_GAP", chain: "Purpose→Objective", description: "尚未建立 Research Objectives。", suggestion: "依 Research Purpose 拆解 Objectives。" });
  if (questions.length === 0) findings.push({ severity: "LOGIC_GAP", chain: "Objective→RQ", description: "尚未建立 Research Questions。", suggestion: "每個 Objective 對應至少一個 RQ。" });
  if (!str(record(payload.core_problem) ? (payload.core_problem as Record<string, unknown>).realProblem : "", "") || str(record(payload.core_problem) ? (payload.core_problem as Record<string, unknown>).realProblem : "", "") === "MISSING") {
    findings.push({ severity: "LOGIC_GAP", chain: "Problem", description: "Core Research Problem 未定義。", suggestion: "先定義真實問題與場域。" });
  }
  if (str(method.direction, "") === "MISSING" || !str(method.direction, "")) {
    findings.push({ severity: "LOGIC_GAP", chain: "RQ→Method", description: "初步方法方向未建立。", suggestion: "選定高層級方法方向並說明為何可回答 RQ。" });
  }
  // MOE 路線：Teaching Problem 技能不足但 Learning Outcome 只有滿意度
  const route = str(payload.primary_route, "");
  if (route === "MOE_TEACHING_PRACTICE") {
    const teaching = str(record(payload.core_problem) ? (payload.core_problem as Record<string, unknown>).teachingProblem : "", "");
    const outcomes = list(record(payload.outputs) ? (payload.outputs as Record<string, unknown>).learning_outcomes : []).map((o) => str(o)).join(" ");
    const skillProblem = /技能|能力|辨識|操作|行為/iu.test(teaching);
    const satisfactionOnly = outcomes && !/技能|能力|辨識|操作|行為|學習成效|測驗/iu.test(outcomes) && /滿意度|感受|態度/iu.test(outcomes);
    if (skillProblem && satisfactionOnly) findings.push({ severity: "OUTCOME_MISALIGNMENT", chain: "Teaching Problem→Learning Outcome", description: "教學問題是技能不足，但 Learning Outcome 只有滿意度。", suggestion: "加入可評估的技能/行為學習成果。" });
  }
  return findings;
}

// ---------- 標準風險（供初稿與修復建議共用；不虛構風險等級） ----------
function buildStandardRisks(coverage: Record<string, { status: CoverageStatus; count: number }>): Record<string, unknown>[] {
  return [
    { riskKey: "RISK_LIT", riskType: "LITERATURE", riskLevel: "UNVERIFIED", reason: coverage.GAP.status === "MISSING" ? "Research Gap 尚無核心文獻支持。" : null, mitigation: "補充 Gap 核心實證文獻（PROVISIONAL）。", owner: null, status: "PROVISIONAL" },
    { riskKey: "RISK_SAMPLE", riskType: "SAMPLE", riskLevel: "UNVERIFIED", reason: "樣本可取得性尚未確認（不自行生成樣本數）。", mitigation: "確認 recruitment 管道與 access 狀態（PROVISIONAL）。", owner: null, status: "PROVISIONAL" },
    { riskKey: "RISK_DATA", riskType: "DATA", riskLevel: "UNVERIFIED", reason: "資料規劃尚未定案。", mitigation: "在 RQ 層級補 expected_data（PROVISIONAL）。", owner: null, status: "PROVISIONAL" },
    { riskKey: "RISK_TIMELINE", riskType: "TIMELINE", riskLevel: "UNVERIFIED", reason: "時程尚未規劃。", mitigation: "建立工作項目與里程碑（PROVISIONAL）。", owner: null, status: "PROVISIONAL" },
    { riskKey: "RISK_SUBMISSION", riskType: "SUBMISSION", riskLevel: "UNVERIFIED", reason: "投稿/申請路線尚未確認。", mitigation: "依導航結果確認 primary/secondary route。", owner: null, status: "PROVISIONAL" },
  ];
}

// ---------- Blueprint 組裝 ----------
function buildDraftPayload(source: BlueprintSource, primary: BlueprintRoute, secondary: BlueprintRoute | null, coverage: Record<string, { status: CoverageStatus; count: number }>): Record<string, unknown> {
  const rqList = source.researchQuestions.length ? source.researchQuestions : ["MISSING（選題時未提供研究問題）"];
  const questions = rqList.map((q, index) => ({ rqKey: `RQ${index + 1}`, question: q, objectiveKey: null, gapKey: null, expectedData: "MISSING（PROVISIONAL）", proposedAnalysis: "MISSING（PROVISIONAL）", status: "PROVISIONAL" }));
  const objectives = source.expectedContribution.length ? source.expectedContribution.map((c, index) => ({ objectiveKey: `OBJ${index + 1}`, title: c.slice(0, 200), description: null, rqKeys: index < questions.length ? [`RQ${index + 1}`] : [], workpackageKeys: [], evidenceLinkIds: [], status: "PROVISIONAL" })) : [{ objectiveKey: "OBJ1", title: "MISSING（待依 Research Purpose 拆解）", description: null, rqKeys: ["RQ1"], workpackageKeys: [], evidenceLinkIds: [], status: "PROVISIONAL" }];
  const gaps = [{ gapKey: "GAP1", type: "Empirical", statement: source.researchGap === "MISSING" ? "MISSING（選題時未提供研究缺口）" : source.researchGap, evidence_link_ids: [] }];
  const variables = source.variables.map((v, index) => ({ variableKey: `V${index + 1}`, name: v, role: "CONSTRUCT", operationalDefinitionStatus: "MISSING", relatedRqKeys: [] }));
  const methodDirection = source.methodology === "MISSING" ? "MISSING（PROVISIONAL）" : source.methodology;
  const outputs: unknown[] = [];
  if (primary === "JOURNAL" || secondary === "JOURNAL") outputs.push({ outputKey: "OUT_J1", route: "JOURNAL", type: "Journal Manuscript", description: null, status: "PLANNED" }, { outputKey: "OUT_J2", route: "JOURNAL", type: "Conference Paper", description: null, status: "PLANNED" });
  if (primary === "NSTC") outputs.push({ outputKey: "OUT_N1", route: "NSTC", type: "年度研究成果", description: null, status: "PLANNED" }, { outputKey: "OUT_N2", route: "NSTC", type: "SSCI/SCI 論文", description: null, status: "PLANNED" }, { outputKey: "OUT_N3", route: "NSTC", type: "人才培育", description: null, status: "PLANNED" });
  if (primary === "MOE_TEACHING_PRACTICE") outputs.push({ outputKey: "OUT_M1", route: "MOE_TEACHING_PRACTICE", type: "課程設計與教材", description: null, status: "PLANNED" }, { outputKey: "OUT_M2", route: "MOE_TEACHING_PRACTICE", type: "教學研究論文", description: null, status: "PLANNED" }, { outputKey: "OUT_M3", route: "MOE_TEACHING_PRACTICE", type: "學習成果證據", description: null, status: "PLANNED" });
  const risks = buildStandardRisks(coverage);
  const workpackages = primary === "NSTC" ? [{ wpKey: "WP1", year: 1, title: "第一年：核心問題與資料整備", objectiveKey: "OBJ1", methodDirection: null, milestoneKeys: [], dependency: [], riskKeys: [] }, { wpKey: "WP2", year: 2, title: "第二年：主體研究與資料收集", objectiveKey: null, methodDirection: null, milestoneKeys: [], dependency: [], riskKeys: [] }, { wpKey: "WP3", year: 3, title: "第三年：成果整合與發表", objectiveKey: null, methodDirection: null, milestoneKeys: [], dependency: [], riskKeys: [] }] : [{ wpKey: "WP1", year: null, title: "核心工作項目（待拆解）", objectiveKey: "OBJ1", methodDirection: null, milestoneKeys: [], dependency: [], riskKeys: [] }];
  const milestones = workpackages.map((wp: Record<string, unknown>, index) => ({ milestoneKey: `M${index + 1}`, title: `里程碑 ${index + 1}（${str(wp.title)}）`, dueYear: typeof wp.year === "number" ? wp.year : null, dueQuarter: null, status: "PLANNED" }));
  const nextAction = coverage.GAP.status === "MISSING" || Number(coverage.GAP.count) < 2
    ? { action: `目前 Research Gap 只有 ${coverage.GAP.count} 篇支持文獻，建議補充 Gap 核心實證研究。`, reason: "Gap Evidence 不足，影響選題正當性與 Introduction。" }
    : Number(coverage.METHOD.count) < 2
      ? { action: "缺少 Method/Measurement 文獻，建議先補充方法學與測量工具來源。", reason: "方法選擇需要文獻支持。" }
      : { action: "文獻基礎足夠；建議確認 RQ 的 expected_data 與 proposed_analysis（PROVISIONAL）。", reason: "下一步為研究設計。" };
  return {
    research_identity: { chineseTitle: source.chineseTitle, englishTitle: source.englishTitle, projectType: source.projectType, primaryRoute: primary, secondaryRoute: secondary, targetLabel: primary === "JOURNAL" ? source.targetJournals[0]?.journalName ?? "MISSING" : primary === "NSTC" ? source.nstcRoute?.routeName ?? "MISSING" : primary === "MOE_TEACHING_PRACTICE" ? source.moeRoute?.routeName ?? "MISSING" : "MISSING", currentStage: "BLUEPRINT", researcherFit: source.researcherProfile ? "待評估（快照已帶入）" : "MISSING" },
    core_problem: { realProblem: source.researchGap === "MISSING" ? "MISSING" : source.researchGap, populationSite: source.population === "MISSING" ? "MISSING" : `${source.population}${source.context && source.context !== "MISSING" ? `／${source.context}` : ""}`, importance: "MISSING（PROVISIONAL）", whyCurrentInsufficient: "MISSING（PROVISIONAL）" },
    gaps, purpose: { statement: "MISSING（PROVISIONAL）" }, objectives, questions,
    hypotheses: [{ hypothesisKey: "H1", statement: null, status: "NOT_APPLICABLE", rqKey: null, theoryRef: null, variables: [], expectedDirection: null, supportingLiterature: [] }],
    conceptual_logic: { chain: ["Research Problem", "Research Gap", "Theory", "Intervention/Technology", "Mechanism", "Outcome", "Contribution"], theory: source.theory[0] ?? "MISSING（PROVISIONAL）" },
    variables, population_context: { targetPopulation: source.population, inclusion: "MISSING（PROVISIONAL）", researchContext: source.context, researchSite: "MISSING", availableSample: "MISSING", accessStatus: "UNVERIFIED", recruitmentRisk: "UNVERIFIED" },
    method: { direction: methodDirection, rationale: "MISSING（PROVISIONAL：此方法為何可能回答目前 RQ）", status: "PROVISIONAL" },
    contributions: { primary: source.expectedContribution[0] ?? "MISSING（PROVISIONAL）", secondary: source.expectedContribution.slice(1), types: [] },
    outputs, risks, workpackages, milestones,
    next_best_action: nextAction,
    evidence_coverage: coverage,
  };
}

// ---------- 主要操作 ----------
export type BlueprintView = {
  exists: boolean;
  blueprint?: {
    id: string; status: string; primaryRoute: string | null; secondaryRoute: string | null;
    currentVersion: number; versionLabel: string; evidenceReadiness: string; updatedAt: string;
    gateState: Record<string, unknown>;
  };
  sections?: Record<string, unknown>;
  logicFindings?: LogicFinding[];
  coverage?: Record<string, { status: CoverageStatus; count: number }>;
  gatePreview?: GatePreview;
  versions?: { id: string; versionNumber: number; versionLabel: string; reason: string; createdAt: string }[];
  nextBestAction?: { action: string; reason: string };
  outdatedReason?: string | null;
};

async function ensureBlueprintRow(client: PoolClient, tenant: ResearchTenant, userId: string): Promise<{ blueprintId: string; researchProjectId: string; source: BlueprintSource; primary: BlueprintRoute; secondary: BlueprintRoute | null }> {
  const source = await loadSource(client, tenant);
  if (!source) throw new ResearchBlueprintRepositoryError("research_project_required", 422);
  const primary = derivePrimaryRoute(source, source.projectType);
  const secondary = deriveSecondaryRoute(source, primary);
  let result = await client.query(`SELECT id, research_project_id AS "researchProjectId" FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (!result.rows[0]) {
    const rp = await client.query(`SELECT id FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    const researchProjectId = rp.rows[0] ? text(rp.rows[0].id) : "";
    if (!researchProjectId) throw new ResearchBlueprintRepositoryError("research_project_not_found", 404);
    const id = `rbp_${randomUUID()}`;
    await client.query(
      `INSERT INTO research_blueprints (id,workspace_id,project_id,research_project_id,created_by_user_id,status,primary_route,secondary_publication_route,current_version_number,evidence_readiness,section_state,gate_state,created_at,updated_at)
       VALUES ($4,$1,$2,$5,$3,'DRAFT',$6,$7,0,'UNVERIFIED','{}','{}',now(),now())`,
      [tenant.workspaceId, tenant.projectId, userId, id, researchProjectId, primary, secondary],
    );
    result = await client.query(`SELECT id, research_project_id AS "researchProjectId" FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  }
  return { blueprintId: text(result.rows[0].id), researchProjectId: text(result.rows[0].researchProjectId), source, primary, secondary };
}

export async function getBlueprint(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const b = await client.query(`SELECT * FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (!b.rows[0]) return { exists: false } satisfies BlueprintView;
    const row = b.rows[0] as Record<string, unknown>;
    const source = await loadSource(client, tenant);
    // OUTDATED 檢查：來源資料 hash 變動（topic/route 重大修改）
    let outdatedReason: string | null = null;
    if (source) {
      const stored = text(row.source_hash ?? "");
      const storedHash = stored || "";
      if (storedHash && storedHash !== source.sourceHash) {
        outdatedReason = "Topic 或 Submission Route 發生重大修改，Blueprint 已標記 OUTDATED。";
        if (text(row.status) !== "OUTDATED") {
          await client.query(`UPDATE research_blueprints SET status='OUTDATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, text(row.id)]);
          row.status = "OUTDATED";
        }
      } else if (!storedHash) {
        await client.query(`UPDATE research_blueprints SET source_hash=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, source.sourceHash, text(row.id)]);
      }
    }
    const versions = await client.query(`SELECT id, version_number AS "versionNumber", version_label AS "versionLabel", reason, created_at AS "createdAt", payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 20`, [tenant.workspaceId, tenant.projectId, text(row.id)]);
    const latest = versions.rows[0] as Record<string, unknown> | undefined;
    const latestPayload = latest ? latest.payload : null;
    const payload: Record<string, unknown> = record(latestPayload) ? latestPayload : {};
    // 標題 fallback：建立研究專案未帶入標題時，至少顯示專案標題（不寫 DB，僅呈現層）
    const sections = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    const rid = record(sections.research_identity) ? sections.research_identity as Record<string, unknown> : null;
    if (rid) {
      const titleResult = await client.query(`SELECT title FROM projects WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      const projectTitle = titleResult.rows[0] ? text(titleResult.rows[0].title) : "";
      const raw = typeof rid.chineseTitle === "string" ? rid.chineseTitle : "";
      if (projectTitle && (!raw || raw === "待確認（missing）" || raw === "MISSING")) rid.chineseTitle = projectTitle;
    }
    const findings = runLogicChecker(payload);
    const coverage = await computeEvidenceCoverage(client, tenant);
    const gatePreview = computeGatePreview(payload, coverage, source, findings);
    // routeStale：藍圖路線仍為 GENERAL，但研究專案已帶導航路線資料（期刊/國科會/教學實踐），
    // 或 workspace 內有最近的 COMPLETED 導航 run 可繼承 → UI 顯示「從最近導航分析繼承」按鈕
    const currentRoute = row.primary_route ? text(row.primary_route) : (rid && typeof rid.primaryRoute === "string" ? rid.primaryRoute : "");
    let hasRecentRun = false;
    if (currentRoute === "GENERAL") {
      const recentRun = await client.query(`SELECT 1 FROM submission_navigator_runs WHERE workspace_id=$1 AND status='COMPLETED' ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId]);
      hasRecentRun = (recentRun.rowCount ?? 0) > 0;
    }
    const routeStale = Boolean(source) && currentRoute === "GENERAL" && (Boolean(source && source.targetJournals.length > 0) || Boolean(source && source.nstcRoute) || Boolean(source && source.moeRoute) || hasRecentRun);
    return {
      exists: true,
      blueprint: {
        id: text(row.id), status: text(row.status), primaryRoute: row.primary_route ? text(row.primary_route) : null, secondaryRoute: row.secondary_publication_route ? text(row.secondary_publication_route) : null,
        currentVersion: Number(row.current_version_number ?? 0), versionLabel: latest ? text(latest.versionLabel) : "", evidenceReadiness: text(row.evidence_readiness), updatedAt: text(row.updated_at),
        gateState: record(row.gate_state) ? row.gate_state : {},
      },
      sections,
      logicFindings: findings,
      coverage,
      gatePreview,
      versions: versions.rows.map((v: Record<string, unknown>) => ({ id: text(v.id), versionNumber: Number(v.versionNumber), versionLabel: text(v.versionLabel), reason: text(v.reason), createdAt: text(v.createdAt) })),
      nextBestAction: record(payload.next_best_action) ? payload.next_best_action as { action: string; reason: string } : undefined,
      outdatedReason,
    } satisfies BlueprintView;
  });
}

export async function createBlueprintDraft(tenant: ResearchTenant, input: { userId: string }, options?: { force?: boolean }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, tenant, "blueprint");
      const existing = await client.query(`SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (existing.rows[0] && !options?.force) {
        await client.query("COMMIT");
        return { blueprintId: text(existing.rows[0].id), idempotent: true, versionNumber: 0 };
      }
      const { blueprintId, source, primary, secondary } = await ensureBlueprintRow(client, tenant, input.userId);
      const coverage = await computeEvidenceCoverage(client, tenant);
      const payload = buildDraftPayload(source, primary, secondary, coverage);
      const isRebuild = Boolean(existing.rows[0]);
      let versionId = `rbpv_${randomUUID()}`;
      let versionNumber = 1;
      let label = "v1.0 Initial Draft";
      let supersedes: string | null = null;
      if (isRebuild) {
        const latest = await client.query(`SELECT id, version_number AS "versionNumber" FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
        versionNumber = latest.rows[0] ? int((latest.rows[0] as Record<string, unknown>).versionNumber) + 1 : 1;
        supersedes = latest.rows[0] ? text((latest.rows[0] as Record<string, unknown>).id) : null;
        versionId = `rbpv_${randomUUID()}`;
        label = `v${versionNumber} Rebuild（繼承導航資料後重建）`;
      }
      const contentHash = hash(payload);
      await client.query(
        `INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
         VALUES ($4,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,now())`,
        [tenant.workspaceId, tenant.projectId, blueprintId, versionId, versionNumber, supersedes, label, isRebuild ? "導航 run 補上後重建（不覆蓋前版）" : "由系統依既有資料自動建立（PROVISIONAL/MISSING 標示）", contentHash, JSON.stringify(payload), input.userId],
      );
      const status = coverageReadiness(coverage) === "SUPPORTED" ? "DRAFT" : "EVIDENCE_INCOMPLETE";
      await client.query(`UPDATE research_blueprints SET status=$3, primary_route=$4, secondary_publication_route=$5, current_version_number=$6, evidence_readiness=$7, source_hash=$8, updated_at=now() WHERE id=$9 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, status, primary, secondary, versionNumber, coverageReadiness(coverage), source.sourceHash, blueprintId]);
      await audit(client, tenant, input.userId, isRebuild ? "BLUEPRINT_REBUILT_FROM_NAVIGATOR" : "BLUEPRINT_DRAFT_CREATED", { blueprintId, versionId, versionNumber });
      await client.query("COMMIT");
      return { blueprintId, idempotent: false, versionNumber };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

async function nextVersion(client: PoolClient, tenant: ResearchTenant, blueprintId: string, userId: string, payload: Record<string, unknown>, label: string, reason: string) {
  const latest = await client.query(`SELECT id, version_number AS "versionNumber" FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
  const priorNumber = latest.rows[0] ? Number((latest.rows[0] as Record<string, unknown>).versionNumber) : 0;
  const versionNumber = priorNumber + 1;
  const versionId = `rbpv_${randomUUID()}`;
  await client.query(
    `INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
     VALUES ($4,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,now())`,
    [tenant.workspaceId, tenant.projectId, blueprintId, versionId, versionNumber, latest.rows[0] ? text((latest.rows[0] as Record<string, unknown>).id) : null, label, reason, hash(payload), JSON.stringify(payload), userId],
  );
  await client.query(`UPDATE research_blueprints SET current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, versionNumber, blueprintId]);
  return { versionId, versionNumber };
}

export async function editBlueprintSection(tenant: ResearchTenant, input: { userId: string; edit: SectionEdit }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, tenant, "blueprint");
      const { blueprintId, source, primary, secondary } = await ensureBlueprintRow(client, tenant, input.userId);
      const latest = await client.query(`SELECT payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const sectionState = record((await client.query(`SELECT section_state AS "sectionState" FROM research_blueprints WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, blueprintId])).rows[0]?.sectionState) ? (await client.query(`SELECT section_state AS "sectionState" FROM research_blueprints WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, blueprintId])).rows[0].sectionState as Record<string, unknown> : {};
      const approvedSection = str(sectionState[`${input.edit.section}:approved`], "");
      if (input.edit.approvedOnly && approvedSection && approvedSection !== "false" && approvedSection !== input.edit.reason) {
        await client.query("COMMIT");
        throw new ResearchBlueprintRepositoryError("blueprint_section_approved_locked", 409);
      }
      const existingSection = payload[input.edit.section];
      if (Array.isArray(existingSection)) {
        // 陣列型區塊（gaps/questions/objectives/variables/risks/outputs/workpackages/milestones…）：以 _items 整筆取代，避免 {...array} 造成結構破壞
        const items = Array.isArray(input.edit.payload._items) ? input.edit.payload._items : Array.isArray(input.edit.payload.items) ? input.edit.payload.items : null;
        if (items) payload[input.edit.section] = items;
      } else {
        payload[input.edit.section] = { ...(record(existingSection) ? existingSection : {}), ...input.edit.payload, _updatedAt: new Date().toISOString() };
      }
      // 若為結構化區塊，同步 child table（questions/objectives/variables…）
      await syncChildSections(client, tenant, blueprintId, input.edit.section, input.edit.payload);
      const version = await nextVersion(client, tenant, blueprintId, input.userId, payload, `v1.${input.edit.section === "questions" ? "2" : "1"} ${input.edit.section} 編輯`, input.edit.reason || `手動編輯區塊 ${input.edit.section}`);
      sectionState[`${input.edit.section}:approved`] = sectionState[`${input.edit.section}:approved`] || "false";
      await client.query(`UPDATE research_blueprints SET section_state=$4::jsonb, updated_at=now() WHERE id=$5 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, blueprintId, JSON.stringify(sectionState), blueprintId]);
      await audit(client, tenant, input.userId, "BLUEPRINT_SECTION_EDITED", { blueprintId, section: input.edit.section, versionNumber: version.versionNumber });
      await client.query("COMMIT");
      return { ok: true, versionNumber: version.versionNumber };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

async function syncChildSections(client: PoolClient, tenant: ResearchTenant, blueprintId: string, section: string, payload: Record<string, unknown>) {
  const del = async (table: string) => { await client.query(`DELETE FROM ${table} WHERE ${tenantWhere()} AND blueprint_id=$3`, [tenant.workspaceId, tenant.projectId, blueprintId]); };
  const ins = async (table: string, columns: string, values: unknown[]) => {
    const columnValues = values.slice(3);
    const placeholders = columnValues.map((_, i) => `$${i + 5}`).join(",");
    await client.query(`INSERT INTO ${table} (id,workspace_id,project_id,blueprint_id,${columns}) VALUES ($1,$2,$3,$4,${placeholders})`, [`rbe_${randomUUID()}`, tenant.workspaceId, tenant.projectId, blueprintId, ...columnValues]);
  };
  if (section === "questions") {
    await del("research_blueprint_questions");
    for (const q of list(payload.questions)) {
      const row = record(q) ? q : {};
      await ins("research_blueprint_questions", "rq_key,question,objective_key,gap_key,expected_data,proposed_analysis,status", [tenant.workspaceId, tenant.projectId, blueprintId, str(row.rqKey, "RQ"), str(row.question, "MISSING"), row.objectiveKey ? str(row.objectiveKey) : null, row.gapKey ? str(row.gapKey) : null, row.expectedData ? str(row.expectedData) : null, row.proposedAnalysis ? str(row.proposedAnalysis) : null, str(row.status, "PROVISIONAL")]);
    }
  }
  if (section === "objectives") {
    await del("research_blueprint_objectives");
    for (const o of list(payload.objectives)) {
      const row = record(o) ? o : {};
      await ins("research_blueprint_objectives", "objective_key,title,description,rq_keys,workpackage_keys,evidence_link_ids,status", [tenant.workspaceId, tenant.projectId, blueprintId, str(row.objectiveKey, "OBJ"), str(row.title, "MISSING"), row.description ? str(row.description) : null, JSON.stringify(list(row.rqKeys)), JSON.stringify(list(row.workpackageKeys)), JSON.stringify(list(row.evidenceLinkIds)), str(row.status, "PLANNED")]);
    }
  }
  if (section === "variables") {
    await del("research_blueprint_variables");
    for (const v of list(payload.variables)) {
      const row = record(v) ? v : {};
      await ins("research_blueprint_variables", "variable_key,name,role,operational_definition_status,related_rq_keys", [tenant.workspaceId, tenant.projectId, blueprintId, str(row.variableKey, "V"), str(row.name, "MISSING"), str(row.role, "CONSTRUCT"), str(row.operationalDefinitionStatus, "MISSING"), JSON.stringify(list(row.relatedRqKeys))]);
    }
  }
}

export async function regenerateBlueprintSection(tenant: ResearchTenant, input: { userId: string; section: SectionEdit["section"] }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, tenant, "blueprint");
      const { blueprintId, source, primary, secondary } = await ensureBlueprintRow(client, tenant, input.userId);
      const latest = await client.query(`SELECT payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : buildDraftPayload(source, primary, secondary, await computeEvidenceCoverage(client, tenant));
      const fresh = buildDraftPayload(source, primary, secondary, await computeEvidenceCoverage(client, tenant));
      // 只重建指定區塊；其他區塊（含已核准）不覆蓋
      if (fresh[input.section] !== undefined) payload[input.section] = fresh[input.section];
      const version = await nextVersion(client, tenant, blueprintId, input.userId, payload, `v1.${input.section === "gaps" ? "1" : "3"} ${input.section} 重新分析`, `重新分析區塊 ${input.section}（不覆蓋其他已核准區塊）`);
      await audit(client, tenant, input.userId, "BLUEPRINT_SECTION_REGENERATED", { blueprintId, section: input.section, versionNumber: version.versionNumber });
      await client.query("COMMIT");
      return { ok: true, versionNumber: version.versionNumber };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function verifyBlueprint(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const { blueprintId } = await ensureBlueprintRow(client, tenant, input.userId);
      const latest = await client.query(`SELECT payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const findings = runLogicChecker(payload);
      const status = findings.length === 0 ? "IN_REVIEW" : "REVISION_REQUIRED";
      await client.query(`UPDATE research_blueprints SET status=$4, updated_at=now() WHERE id=$5 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, blueprintId, status, blueprintId]);
      await audit(client, tenant, input.userId, "BLUEPRINT_VERIFIED", { blueprintId, findings: findings.length });
      await client.query("COMMIT");
      return { ok: true, status, findings };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

const GATE_CHECKS: { key: string; label: string; check: (payload: Record<string, unknown>, coverage: Record<string, { status: CoverageStatus; count: number }>) => { pass: boolean; detail: string } }[] = [
  { key: "topic_confirmed", label: "題目已正式確認", check: (p) => ({ pass: str(record(p.research_identity) ? (p.research_identity as Record<string, unknown>).chineseTitle : "", "") !== "MISSING" && str(record(p.research_identity) ? (p.research_identity as Record<string, unknown>).chineseTitle : "", "") !== "", detail: "中文題目已帶入。" }) },
  { key: "route_confirmed", label: "投稿/申請路線已確認", check: (p) => { const identity = record(p.research_identity) ? p.research_identity : {}; const route = str(identity.primaryRoute, ""); return { pass: route !== "" && route !== "GENERAL", detail: `primary_route 已設定（${route || "MISSING"}）。` }; } },
  { key: "core_problem", label: "Core Problem 已定義", check: (p) => { const cp = record(p.core_problem) ? p.core_problem : {}; return { pass: str(cp.realProblem, "") !== "" && str(cp.realProblem, "") !== "MISSING", detail: "真實問題已定義。" }; } },
  { key: "gap_evidence", label: "Research Gap 有 Evidence", check: (_p, c) => ({ pass: c.GAP.status === "SUPPORTED" || c.GAP.status === "PARTIALLY_SUPPORTED", detail: `Gap Evidence: ${c.GAP.status}（${c.GAP.count} 篇）。` }) },
  { key: "purpose", label: "Research Purpose 已建立", check: (p) => ({ pass: str(record(p.purpose) ? (p.purpose as Record<string, unknown>).statement : "", "") !== "MISSING" && str(record(p.purpose) ? (p.purpose as Record<string, unknown>).statement : "", "") !== "", detail: "總研究目的已建立。" }) },
  { key: "rq_objective", label: "每個 RQ 對應 Objective", check: (p) => { const questions = list(p.questions); const missing = questions.filter((q) => !str(record(q) ? (q as Record<string, unknown>).objectiveKey : "", "")); return { pass: missing.length === 0, detail: missing.length ? `${missing.length} 個 RQ 未對應 Objective。` : "全數對應。" }; } },
  { key: "variables", label: "主要變數/構念已識別", check: (p) => ({ pass: list(p.variables).length > 0, detail: `已識別 ${list(p.variables).length} 個變數/構念。` }) },
  { key: "method_fits", label: "初步方法能回答 RQ", check: (p) => { const m = record(p.method) ? p.method : {}; return { pass: str(m.direction, "") !== "MISSING" && str(m.direction, "") !== "", detail: "方法方向已選定。" }; } },
  { key: "contribution", label: "預期貢獻已區分", check: (p) => { const c = record(p.contributions) ? p.contributions : {}; return { pass: str(c.primary, "") !== "MISSING" && str(c.primary, "") !== "", detail: "Primary Contribution 已指定。" }; } },
  { key: "risks", label: "主要風險已識別", check: (p) => ({ pass: list(p.risks).length > 0, detail: `已識別 ${list(p.risks).length} 項風險。` }) },
  { key: "no_fabrication", label: "無虛構結果或文獻", check: (p) => { const statuses = JSON.stringify(p); const forbidden = /FOUND|OBSERVED|SIGNIFICANT|APPROVED/iu.test(statuses); return { pass: !forbidden, detail: forbidden ? "偵測到疑似已定案字眼（FOUND/SIGNIFICANT/APPROVED）。" : "未偵測到虛構表述。" }; } },
  { key: "logic_clean", label: "Logic Checker 無 MAJOR 斷鏈", check: (p) => { const findings = runLogicChecker(p); const major = findings.filter((f) => f.severity !== "LOGIC_GAP"); return { pass: major.length === 0, detail: major.length ? `${major.length} 個重大斷鏈待修。` : "邏輯鏈無重大斷鏈。" }; } },
];

export function runGateChecks(payload: Record<string, unknown>, coverage: Record<string, { status: CoverageStatus; count: number }>, precomputedFindings?: LogicFinding[]): { key: string; label: string; pass: boolean; detail: string }[] {
  return GATE_CHECKS.map((check) => {
    if (check.key === "logic_clean" && precomputedFindings) {
      const major = precomputedFindings.filter((f) => f.severity !== "LOGIC_GAP");
      return { key: check.key, label: check.label, pass: major.length === 0, detail: major.length ? `${major.length} 個重大斷鏈待修。` : "邏輯鏈無重大斷鏈。" };
    }
    return { key: check.key, label: check.label, ...check.check(payload, coverage) };
  });
}

// ---------- 核准 Gate 修復指引（老麥建議：由既有資料推導，不虛構文獻/數據） ----------
export type GateFixKind = "edit" | "module";
export type GateFix = {
  kind: GateFixKind;
  tab?: string;
  section?: string;
  fields?: string[];
  module?: "navigator" | "evidence";
  role?: string;
  note: string;
  autoFill?: { section: string; payload: Record<string, unknown>; label: string; provisional: boolean };
};
export type GateGuide = { key: string; label: string; pass: boolean; detail: string; fix?: GateFix };

export type GatePreview = { checkedAt: string; total: number; passed: number; failed: GateGuide[] };

export function tabForSection(section: string): string {
  switch (section) {
    case "identity": return "總覽";
    case "core_problem": case "gaps": return "問題與Gap";
    case "purpose": case "objectives": case "questions": return "目的與RQ";
    case "hypotheses": case "variables": return "假設與變數";
    case "conceptual_logic": case "population_context": case "method": return "初步架構";
    case "workpackages": case "milestones": return "工作與時程";
    case "contributions": case "outputs": return "預期成果";
    default: return "風險";
  }
}

function firstGapStatement(payload: Record<string, unknown>): string {
  for (const g of list(payload.gaps)) {
    const row = record(g) ? g : {};
    const s = str(row.statement, "");
    if (s && s !== "MISSING" && !s.startsWith("MISSING（")) return s;
  }
  return "";
}

function forbiddenWordSections(payload: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (key === "next_best_action" || key === "evidence_coverage") continue;
    if (/FOUND|OBSERVED|SIGNIFICANT|APPROVED/iu.test(JSON.stringify(value))) out.push(key);
  }
  return out;
}

function deriveVariablesFromRq(payload: Record<string, unknown>): { variableKey: string; name: string; role: string; operationalDefinitionStatus: string; relatedRqKeys: string[] }[] {
  const questions = list(payload.questions);
  const seen = new Set<string>();
  const out: { variableKey: string; name: string; role: string; operationalDefinitionStatus: string; relatedRqKeys: string[] }[] = [];
  const STOP = /^(研究|本研究|調查|實驗|比較|分析|評估|探討|了解|理解|發展|設計|建構|應用|驗證|影響|關係|差異|作用|為何|如何|是否|什麼|哪些)$/u;
  for (const q of questions) {
    const row = record(q) ? q : {};
    const rqKey = str(row.rqKey, "");
    const question = str(row.question, "");
    if (!question) continue;
    const segments = question.split(/[\s，。？?、,；;：:－—]+|對|之|的|與|及|和|於|在|如何|是否|什麼|哪些|為何|探討|影響|關係|差異|作用|能否/u).map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 20 && !STOP.test(s));
    for (const seg of segments) {
      const name = seg.replace(/^(是否|如何|什麼|哪些|為何|探討|影響|比較|分析|評估|研究|了解|理解|發展|設計|建構|應用|驗證)/u, "").trim();
      if (name.length < 2 || name.length > 16 || seen.has(name)) continue;
      seen.add(name);
      out.push({ variableKey: `V${out.length + 1}`, name, role: "CONSTRUCT", operationalDefinitionStatus: "MISSING", relatedRqKeys: rqKey ? [rqKey] : [] });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

function deriveMethodDirection(source: BlueprintSource | null, payload: Record<string, unknown>): string | null {
  const existing = str(record(payload.method) ? (payload.method as Record<string, unknown>).direction : "", "");
  if (existing && existing !== "MISSING" && existing !== "MISSING（PROVISIONAL）") return null;
  if (source && source.methodology && source.methodology !== "MISSING") return source.methodology;
  const hay = [source?.chineseTitle ?? "", source?.researchGap ?? "", ...(source?.researchQuestions ?? [])].filter(Boolean).join(" ");
  if (/隨機|對照|RCT|實驗組|控制組/iu.test(hay)) return "隨機對照試驗（RCT）（PROVISIONAL）";
  if (/問卷|量表|李克特|Likert/iu.test(hay)) return "問卷調查法（PROVISIONAL）";
  if (/訪談|焦點團體/iu.test(hay)) return "訪談／質性研究（PROVISIONAL）";
  if (/\bVR\b|\bAR\b|\bXR\b|虛擬實境|擴增實境|沉浸/iu.test(hay)) return "XR 介入之（準）實驗設計（PROVISIONAL）";
  if (/\bAI\b|深度學習|機器學習|模型|預測/iu.test(hay)) return "模型開發與實證評估（PROVISIONAL）";
  return null;
}

function derivePurposeStatement(source: BlueprintSource | null, payload: Record<string, unknown>): string | null {
  const gap = firstGapStatement(payload) || (source && source.researchGap && source.researchGap !== "MISSING" ? source.researchGap : "");
  if (!gap) return null;
  const method = deriveMethodDirection(source, payload) ?? "適當的研究方法";
  return `本研究旨在回應「${gap.slice(0, 80)}」之研究缺口，透過${method}提出可驗證的研究設計與實證基礎（PROVISIONAL）。`;
}

function deriveContributionPrimary(source: BlueprintSource | null, payload: Record<string, unknown>): string | null {
  const c = record(payload.contributions) ? payload.contributions : {};
  const existing = str(c.primary, "");
  if (existing && existing !== "MISSING" && existing !== "MISSING（PROVISIONAL）") return null;
  if (source && source.expectedContribution[0]) return source.expectedContribution[0];
  const gap = firstGapStatement(payload) || (source && source.researchGap && source.researchGap !== "MISSING" ? source.researchGap : "");
  if (gap) return `針對「${gap.slice(0, 60)}」提供實證基礎與可操作的研究設計貢獻（PROVISIONAL）`;
  return null;
}

function fixFor(key: string, payload: Record<string, unknown>, coverage: Record<string, { status: CoverageStatus; count: number }>, source: BlueprintSource | null, findings: LogicFinding[]): GateFix | undefined {
  switch (key) {
    case "topic_confirmed": {
      const title = str(record(payload.research_identity) ? (payload.research_identity as Record<string, unknown>).chineseTitle : "", "");
      const fallback = source && source.chineseTitle && source.chineseTitle !== "MISSING" ? source.chineseTitle : "";
      return {
        kind: "edit", tab: "總覽", section: "identity", fields: ["chineseTitle"],
        note: fallback ? "系統有可用的專案題目可帶入；若仍不正確，請到「投稿導航／選題實驗室」重新確認題目後再建立研究專案。" : "題目尚未確認：請到選題實驗室或投稿導航確認題目，或直接在「總覽」手動填寫中文題目。",
        ...(fallback ? { autoFill: { section: "identity", payload: { chineseTitle: fallback }, label: `以既有題目填入：${fallback.slice(0, 40)}`, provisional: false } } : {}),
      };
    }
    case "route_confirmed":
      return { kind: "module", module: "navigator", note: "請前往投稿導航完成分析，確認投稿／申請路線（期刊／NSTC／教學實踐）後按「建立研究專案」，路線會自動帶入藍圖。老麥不會代為指定路線。" };
    case "core_problem": {
      const gap = firstGapStatement(payload) || (source && source.researchGap && source.researchGap !== "MISSING" ? source.researchGap : "");
      return {
        kind: "edit", tab: "問題與Gap", section: "core_problem", fields: ["realProblem"],
        note: gap ? "以既有 Research Gap 陳述作為「真實問題」填入（仍是你的原始文字，非新生成）。" : "請定義真實問題與場域（為什麼這個問題值得研究、現況哪裡不足）。",
        ...(gap ? { autoFill: { section: "core_problem", payload: { realProblem: gap.slice(0, 300) }, label: `以 Gap 陳述填入（${gap.slice(0, 30)}…）`, provisional: false } } : {}),
      };
    }
    case "gap_evidence":
      return { kind: "module", module: "evidence", role: "GAP", note: `目前 Gap 文獻：${coverage.GAP.status}（${coverage.GAP.count} 篇）。請到文獻與證據中心以「Gap」角色加入至少 2 篇核心實證文獻、標記閱讀狀態並驗證。老麥不會虛構文獻。` };
    case "purpose": {
      const derived = derivePurposeStatement(source, payload);
      return {
        kind: "edit", tab: "目的與RQ", section: "purpose", fields: ["statement"],
        note: derived ? "依既有 Gap 與方法方向推導目的陳述（PROVISIONAL，請確認後儲存）。" : "請依 Research Purpose 填寫總研究目的。",
        ...(derived ? { autoFill: { section: "purpose", payload: { statement: derived }, label: derived.slice(0, 60) + "…", provisional: true } } : {}),
      };
    }
    case "rq_objective": {
      const questions = list(payload.questions);
      const objectiveCount = list(payload.objectives).length || 1;
      const mapped = questions.map((q, index) => {
        const row = record(q) ? q : {};
        const rqKey = str(row.rqKey, `RQ${index + 1}`);
        const objectiveKey = str(row.objectiveKey, "");
        if (objectiveKey) return { ...row };
        return { ...row, rqKey, objectiveKey: `OBJ${Math.min(index + 1, objectiveCount)}` };
      });
      return {
        kind: "edit", tab: "目的與RQ", section: "questions", fields: ["objectiveKey"],
        note: "依順序為未對應的 RQ 補上 Objective 連結（RQ1→OBJ1、RQ2→OBJ2…）。",
        autoFill: { section: "questions", payload: { _items: mapped }, label: "自動建立 RQ→Objective 對應（依序）", provisional: false },
      };
    }
    case "variables": {
      const derived = deriveVariablesFromRq(payload);
      return {
        kind: "edit", tab: "假設與變數", section: "variables", fields: ["name"],
        note: derived.length ? "從你的 RQ 文字中抽出候選構念（老麥推導，非文獻宣稱；請確認角色與命名）。" : "請依 RQ 手動列出主要變數／構念與操作型定義。",
        ...(derived.length ? { autoFill: { section: "variables", payload: { _items: derived }, label: `從 RQ 推導 ${derived.length} 個候選構念（PROVISIONAL）`, provisional: true } } : {}),
      };
    }
    case "method_fits": {
      const derived = deriveMethodDirection(source, payload);
      return {
        kind: "edit", tab: "初步架構", section: "method", fields: ["direction"],
        note: derived ? "依選題資料／題目關鍵字推導高層級方法方向（PROVISIONAL，請確認）。" : "請選定高層級方法方向，並說明為何可回答 RQ。",
        ...(derived ? { autoFill: { section: "method", payload: { direction: derived, status: "PROVISIONAL" }, label: `填入方法方向：${derived}`, provisional: true } } : {}),
      };
    }
    case "contribution": {
      const derived = deriveContributionPrimary(source, payload);
      return {
        kind: "edit", tab: "預期成果", section: "contributions", fields: ["primary"],
        note: derived ? "依既有預期貢獻／Gap 推導主要貢獻（PROVISIONAL，請確認）。" : "請填寫主要貢獻（可依 Gap 與預期成果拆解）。",
        ...(derived ? { autoFill: { section: "contributions", payload: { primary: derived }, label: derived.slice(0, 60) + "…", provisional: true } } : {}),
      };
    }
    case "risks": {
      const risks = buildStandardRisks(coverage);
      return {
        kind: "edit", tab: "風險", section: "risks", fields: ["riskKey"],
        note: "帶入系統標準風險清單（文獻／樣本／資料／時程／投稿；皆 UNVERIFIED＋PROVISIONAL，不虛構風險等級）。",
        autoFill: { section: "risks", payload: { _items: risks }, label: `帶入 ${risks.length} 項標準風險（PROVISIONAL）`, provisional: true },
      };
    }
    case "no_fabrication": {
      const hits = forbiddenWordSections(payload);
      const section = hits[0] ?? "core_problem";
      return { kind: "edit", tab: tabForSection(section), section, note: `偵測到疑似已定案字眼（FOUND／OBSERVED／SIGNIFICANT／APPROVED）於：${hits.join("、") || "（位置待查）"}。請改為 PROVISIONAL／待驗證表述，避免假確認。` };
    }
    case "logic_clean": {
      const major = findings.filter((f) => f.severity !== "LOGIC_GAP");
      if (!major.length) return undefined;
      const chains = major.map((f) => f.chain).join("、");
      const suggestions = major.map((f) => f.suggestion).join("；");
      const longitudinal = major.find((f) => f.severity === "MAJOR_LOGIC_GAP" && f.chain.endsWith("Expected Data"));
      if (longitudinal) {
        const questions = list(payload.questions).map((q) => {
          const row = record(q) ? q : {};
          const rqKey = str(row.rqKey, "");
          const ed = str(row.expectedData, "");
          if (longitudinal.chain.startsWith(rqKey) && !/追蹤|延宕|長期|follow-?up|縱貫|時間點|重複測量|多波/iu.test(ed)) {
            return { ...row, expectedData: `${ed}；追蹤時間點（如 T0/T1/T2，PROVISIONAL）` };
          }
          return { ...row };
        });
        return { kind: "edit", tab: "目的與RQ", section: "questions", fields: ["expectedData"], note: `重大邏輯斷鏈：${chains}。${suggestions}`, autoFill: { section: "questions", payload: { _items: questions }, label: "為需追蹤的 RQ 補上追蹤時間點（PROVISIONAL）", provisional: true } };
      }
      const first = major[0];
      const section = first.chain.startsWith("Teaching Problem") ? "outputs" : first.chain.includes("Method") ? "method" : first.chain.includes("Variable") ? "variables" : first.chain.includes("Gap") ? "gaps" : "questions";
      return { kind: "edit", tab: tabForSection(section), section, note: `重大邏輯斷鏈：${chains}。${suggestions}` };
    }
    default:
      return undefined;
  }
}

export function buildFixGuide(payload: Record<string, unknown>, coverage: Record<string, { status: CoverageStatus; count: number }>, source: BlueprintSource | null, precomputedFindings?: LogicFinding[]): GateGuide[] {
  const findings = precomputedFindings ?? runLogicChecker(payload);
  return runGateChecks(payload, coverage, findings).map((r) => ({ ...r, fix: r.pass ? undefined : fixFor(r.key, payload, coverage, source, findings) }));
}

export function computeGatePreview(payload: Record<string, unknown>, coverage: Record<string, { status: CoverageStatus; count: number }>, source: BlueprintSource | null, precomputedFindings?: LogicFinding[]): GatePreview {
  const guides = buildFixGuide(payload, coverage, source, precomputedFindings);
  const failed = guides.filter((g) => !g.pass);
  return { checkedAt: new Date().toISOString(), total: guides.length, passed: guides.length - failed.length, failed };
}

export async function approveBlueprint(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const { blueprintId } = await ensureBlueprintRow(client, tenant, input.userId);
      const latest = await client.query(`SELECT id, version_number AS "versionNumber", content_hash AS "contentHash" FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      if (!latest.rows[0]) throw new ResearchBlueprintRepositoryError("blueprint_version_missing", 404);
      const versionRow = latest.rows[0] as Record<string, unknown>;
      const latestVersion = await client.query(`SELECT payload FROM research_blueprint_versions WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, text(versionRow.id)]);
      const payload = latestVersion.rows[0] && record((latestVersion.rows[0] as Record<string, unknown>).payload) ? (latestVersion.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const coverage = await computeEvidenceCoverage(client, tenant);
      const results = GATE_CHECKS.map((check) => ({ key: check.key, label: check.label, ...check.check(payload, coverage) }));
      const failed = results.filter((r) => !r.pass);
      const gateState = { checkedAt: new Date().toISOString(), results };
      if (failed.length) {
        await client.query(`UPDATE research_blueprints SET gate_state=$4::jsonb, status='REVISION_REQUIRED', updated_at=now() WHERE id=$5 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, blueprintId, JSON.stringify(gateState), blueprintId]);
        await client.query("COMMIT");
        return { ok: false, status: "REVISION_REQUIRED", failed, gateState };
      }
      // 核准 + human gate 記錄
      const gateId = `hg_${randomUUID()}`;
      await client.query(
        `INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
         VALUES ($4,$1,$2,$3,'BLUEPRINT_RELEASE','research_blueprint',$5,$6,'APPROVED',$3,now(),now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.userId, gateId, text(versionRow.id), text(versionRow.contentHash)],
      );
      await client.query(`UPDATE research_blueprints SET gate_state=$4::jsonb, status='APPROVED', updated_at=now() WHERE id=$5 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, blueprintId, JSON.stringify(gateState), blueprintId]);
      await audit(client, tenant, input.userId, "BLUEPRINT_APPROVED", { blueprintId, versionId: text(versionRow.id), humanGateId: gateId });
      await client.query("COMMIT");
      return { ok: true, status: "APPROVED", humanGateId: gateId, gateState };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function linkBlueprintEvidence(tenant: ResearchTenant, input: { userId: string; links: { targetType: string; targetRef?: string; literatureId?: string; supportedSection?: string; supportedClaim?: string }[] }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const { blueprintId } = await ensureBlueprintRow(client, tenant, input.userId);
      for (const link of input.links) {
        if (!link.literatureId) continue;
        const lit = await client.query(`SELECT id, zotero_item_key AS "zoteroItemKey" FROM literature_items WHERE id=$2 AND workspace_id=$1`, [tenant.workspaceId, link.literatureId]);
        if (!lit.rows[0]) continue;
        const linked = await client.query(`SELECT 1 FROM project_literature_links WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, link.literatureId]);
        if (!linked.rowCount) continue;
        const citation = await client.query(`SELECT id FROM citation_sources WHERE ${tenantWhere()} AND literature_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, link.literatureId]);
        await client.query(
          `INSERT INTO research_blueprint_evidence_links (id,workspace_id,project_id,blueprint_id,evidence_link_id,target_type,target_ref,literature_id,citation_source_id,zotero_item_key,supported_section,supported_claim,citation_status,created_at)
           VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,'PLANNED',now())`,
          [tenant.workspaceId, tenant.projectId, blueprintId, `rbel_${randomUUID()}`, link.targetType, link.targetRef ?? null, link.literatureId, citation.rows[0] ? text(citation.rows[0].id) : null, lit.rows[0] ? text((lit.rows[0] as Record<string, unknown>).zoteroItemKey) : null, link.supportedSection ?? null, link.supportedClaim ?? null],
        );
      }
      await audit(client, tenant, input.userId, "BLUEPRINT_EVIDENCE_LINKED", { blueprintId, count: input.links.length });
      await client.query("COMMIT");
      return { ok: true, linked: input.links.filter((l) => Boolean(l.literatureId)).length };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function compareBlueprintVersions(tenant: ResearchTenant, input: { userId: string; fromVersion: number; toVersion: number }) {
  return withClient(async (client) => {
    const rows = await client.query(`SELECT version_number AS "versionNumber", version_label AS "versionLabel", reason, payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_number IN ($3,$4) ORDER BY version_number`, [tenant.workspaceId, tenant.projectId, input.fromVersion, input.toVersion]);
    if (rows.rows.length !== 2) throw new ResearchBlueprintRepositoryError("blueprint_version_not_found", 404);
    const [a, b] = rows.rows as Record<string, unknown>[];
    const pa = record(a.payload) ? a.payload as Record<string, unknown> : {};
    const pb = record(b.payload) ? b.payload as Record<string, unknown> : {};
    const changed: string[] = [];
    for (const key of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
      if (JSON.stringify(pa[key] ?? null) !== JSON.stringify(pb[key] ?? null)) changed.push(key);
    }
    return { from: { versionNumber: Number(a.versionNumber), versionLabel: text(a.versionLabel), reason: text(a.reason) }, to: { versionNumber: Number(b.versionNumber), versionLabel: text(b.versionLabel), reason: text(b.reason) }, changedSections: changed };
  });
}
