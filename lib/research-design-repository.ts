import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import {
  DESIGN_FIT_DISCLAIMER,
  type DesignAlignmentFinding,
  type DesignCandidateStatus,
  type ResearchDesignSectionEdit,
} from "./research-design-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export class ResearchDesignStorageUnavailable extends Error {
  constructor() { super("research_design_storage_unavailable"); this.name = "ResearchDesignStorageUnavailable"; }
}
export class ResearchDesignRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "ResearchDesignRepositoryError"; this.code = code; this.status = status; }
}

function tenantWhere(alias = "") { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) { if (!pool) throw new ResearchDesignStorageUnavailable(); const client = await pool.connect(); try { return await operation(client); } finally { client.release(); } }
async function lock(client: PoolClient, tenant: ResearchTenant, key: string) { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`rd:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function str(v: unknown, fb = ""): string { return typeof v === "string" && v.trim() ? v.trim() : fb; }
function int(v: unknown): number { return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0; }

async function audit(client: PoolClient, tenant: ResearchTenant, userId: string, action: string, artifactRefs?: unknown) {
  const event = { action, artifactRefs: artifactRefs ?? null, lifecycleContractVersion: "1.5.91" };
  await client.query(
    `INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,'S4_DESIGN','S4_DESIGN',$5,'1.5.91',$6::jsonb,$7)`,
    [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, action, JSON.stringify(artifactRefs ?? null), hash(event)],
  );
}

// ---------- 來源資料 ----------
type DesignSource = {
  blueprintVersion: number;
  blueprintVersionId: string | null;
  blueprintPayload: Record<string, unknown>;
  theoryStatus: string;
  theoryAnalysisId: string | null;
  theoryPayload: Record<string, unknown>;
  projectTitle: string;
  primaryRoute: string;
  methodLiterature: { literatureId: string; title: string; evidenceStatus: string; readingStatus: string; zoteroItemKey: string | null; citationSourceId: string | null }[];
};

async function loadSource(client: PoolClient, tenant: ResearchTenant): Promise<DesignSource> {
  const projectTitleResult = await client.query(`SELECT title FROM projects WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const rp = await client.query(`SELECT project_type AS "projectType" FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const blueprint = await client.query(`SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const blueprintId = blueprint.rows[0] ? text((blueprint.rows[0] as Record<string, unknown>).id) : null;
  let blueprintVersion = 0; let blueprintVersionId: string | null = null; let blueprintPayload: Record<string, unknown> = {};
  if (blueprintId) {
    const latest = await client.query(`SELECT id, version_number AS "versionNumber", payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
    if (latest.rows[0]) {
      blueprintVersion = int((latest.rows[0] as Record<string, unknown>).versionNumber);
      blueprintVersionId = text((latest.rows[0] as Record<string, unknown>).id);
      const p = (latest.rows[0] as Record<string, unknown>).payload;
      if (record(p)) blueprintPayload = p;
    }
  }
  const theory = await client.query(`SELECT id, status, current_version_number AS "v" FROM theory_mechanism_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  let theoryPayload: Record<string, unknown> = {};
  if (theory.rows[0]) {
    const tv = await client.query(`SELECT payload FROM theory_mechanism_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, text((theory.rows[0] as Record<string, unknown>).id)]);
    if (tv.rows[0] && record((tv.rows[0] as Record<string, unknown>).payload)) theoryPayload = (tv.rows[0] as Record<string, unknown>).payload as Record<string, unknown>;
  }
  const methodLiterature = await client.query(
    `SELECT i.id AS "literatureId", i.title, i.zotero_item_key AS "zoteroItemKey", l.evidence_status AS "evidenceStatus", l.reading_status AS "readingStatus", cs.id AS "citationSourceId"
     FROM project_literature_links l
     JOIN literature_items i ON i.workspace_id=l.workspace_id AND i.id=l.literature_id
     LEFT JOIN citation_sources cs ON cs.workspace_id=l.workspace_id AND cs.project_id=l.project_id AND cs.literature_id=l.literature_id
     WHERE l.workspace_id=$1 AND l.project_id=$2 AND l.reading_status <> 'EXCLUDED' AND (l.role @> '["METHOD"]'::jsonb OR l.role @> '["MEASUREMENT"]'::jsonb OR l.role @> '["SIMILAR_STUDY"]'::jsonb OR l.role @> '["STATISTICAL_METHOD"]'::jsonb)
     ORDER BY i.created_at DESC LIMIT 100`,
    [tenant.workspaceId, tenant.projectId],
  );
  return {
    blueprintVersion,
    blueprintVersionId,
    blueprintPayload,
    theoryStatus: theory.rows[0] ? text((theory.rows[0] as Record<string, unknown>).status) : "MISSING",
    theoryAnalysisId: theory.rows[0] ? text((theory.rows[0] as Record<string, unknown>).id) : null,
    theoryPayload,
    projectTitle: projectTitleResult.rows[0] ? text((projectTitleResult.rows[0] as Record<string, unknown>).title) : "",
    primaryRoute: rp.rows[0] ? text((rp.rows[0] as Record<string, unknown>).projectType) : "GENERAL",
    methodLiterature: methodLiterature.rows.map((r: Record<string, unknown>) => ({ literatureId: text(r.literatureId), title: text(r.title), evidenceStatus: text(r.evidenceStatus), readingStatus: text(r.readingStatus), zoteroItemKey: r.zoteroItemKey ? text(r.zoteroItemKey) : null, citationSourceId: r.citationSourceId ? text(r.citationSourceId) : null })),
  };
}

function sourceFingerprint(source: DesignSource): string {
  return hash({ blueprintVersion: source.blueprintVersion, theoryStatus: source.theoryStatus, theoryAnalysisId: source.theoryAnalysisId, projectTitle: source.projectTitle, blueprint: source.blueprintPayload, theory: source.theoryPayload });
}

async function ensureDesignAnalysis(client: PoolClient, tenant: ResearchTenant, input: { userId: string; source: DesignSource }): Promise<{ id: string; status: string; existed: boolean }> {
  const existing = await client.query(`SELECT id, status, source_hash AS "sourceHash" FROM research_design_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const fingerprint = sourceFingerprint(input.source);
  if (existing.rows[0]) {
    const row = existing.rows[0] as Record<string, unknown>;
    const id = text(row.id);
    const status = text(row.status);
    if (status !== "LOCKED" && text(row.sourceHash) !== fingerprint) {
      await client.query(`UPDATE research_design_analyses SET status='OUTDATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, id]);
      return { id, status: "OUTDATED", existed: true };
    }
    return { id, status, existed: true };
  }
  const id = `rda_${randomUUID()}`;
  const initialStatus = input.source.theoryStatus === "APPROVED" ? "DRAFT" : "LOCKED";
  const researchProject = await client.query(`SELECT id FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (!researchProject.rows[0]) throw new ResearchDesignRepositoryError("research_project_required", 422);
  await client.query(
    `INSERT INTO research_design_analyses (id,workspace_id,project_id,research_project_id,created_by_user_id,source_blueprint_version,source_blueprint_version_id,source_theory_analysis_id,status,primary_route,current_version_number,source_hash,created_at,updated_at)
     VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,0,$11,now(),now())`,
    [tenant.workspaceId, tenant.projectId, text((researchProject.rows[0] as Record<string, unknown>).id), id, input.userId, input.source.blueprintVersion, input.source.blueprintVersionId, input.source.theoryAnalysisId, initialStatus, input.source.primaryRoute, fingerprint],
  );
  return { id, status: initialStatus, existed: false };
}

// ---------- 候選設計池（依 RQ/機制/方法方向推導；不虛構） ----------
function buildDesignCandidates(source: DesignSource): { designKey: string; designName: string; designType: string; answersRqKeys: string[]; cannotAnswerRqKeys: string[]; causalInferenceCapability: string; sampleAndSiteRequirements: string; requiredTime: string; executionDifficulty: string; ethicsRisks: string; dataRequirements: string; methodStrengths: string[]; methodLimitations: string[]; routeFit: string; methodEvidenceCount: number; fitBreakdown: Record<string, number>; fitScore: number; fitRationale: string }[] {
  const bp = source.blueprintPayload;
  const rqTexts = list(bp.questions).map((q) => str(record(q) ? (q as Record<string, unknown>).question : "", "")).filter(Boolean);
  const rqKeys = rqTexts.map((_, i) => `RQ${i + 1}`);
  const methodology = str(record(bp.method) ? (bp.method as Record<string, unknown>).direction : "", "");
  const hay = [str(record(bp.research_identity) ? (bp.research_identity as Record<string, unknown>).chineseTitle : "", ""), ...rqTexts, methodology, str(bp.research_gap, "")].join(" ");
  const isRct = /隨機|對照|RCT|實驗組|控制組|randomized|controlled/iu.test(hay);
  const isQuasi = /準實驗|前後測|比較|pre.?test|post.?test|介入組|實驗設計/iu.test(hay);
  const isSurvey = /問卷|量表|Likert|調查/iu.test(hay);
  const isQual = /訪談|焦點團體|質性|個案|case study|觀察/iu.test(hay);
  const isLongitudinal = /追蹤|長期|延宕|follow-?up|縱貫/iu.test(hay);
  const isAi = /AI|模型|機器學習|深度學習|預測|演算法|model/i.test(hay);
  const isMixed = /混合|mixed/iu.test(hay);
  const hasMediator = list(record(source.theoryPayload.construct_dictionary) ? source.theoryPayload.construct_dictionary : []).some((c) => str(record(c) ? (c as Record<string, unknown>).role : "") === "MEDIATOR");
  const methodCount = source.methodLiterature.length;
  const candidates: { designKey: string; designName: string; designType: string; answersRqKeys: string[]; cannotAnswerRqKeys: string[]; causalInferenceCapability: string; sampleAndSiteRequirements: string; requiredTime: string; executionDifficulty: string; ethicsRisks: string; dataRequirements: string; methodStrengths: string[]; methodLimitations: string[]; routeFit: string; methodEvidenceCount: number; fitBreakdown: Record<string, number>; fitScore: number; fitRationale: string }[] = [];

  const push = (c: typeof candidates[number]) => candidates.push(c);

  if (isRct) {
    push({
      designKey: "rct", designName: "隨機對照試驗（RCT）", designType: "Randomized Controlled Trial", answersRqKeys: rqKeys, cannotAnswerRqKeys: [],
      causalInferenceCapability: "高：隨機分配＋對照組可支持因果推論（前提：分配隱匿、盲法、ITT 分析）。",
      sampleAndSiteRequirements: "需具隨機分配能力之場域；樣本需求最大（見 Power Analysis）。", requiredTime: "長（招募＋介入＋追蹤）", executionDifficulty: "高",
      ethicsRisks: "控制組未接受介入之倫理考量；需知情同意與隨機化說明。", dataRequirements: "介入前後＋追蹤多時點資料",
      methodStrengths: ["因果推論最強", "符合 JOURAL 嚴格方法標準", "可處理混淆"], methodLimitations: ["成本高", "招募難", "外部效度受限"],
      routeFit: source.primaryRoute === "JOURNAL" ? "高（方法嚴格度符合國際期刊）" : source.primaryRoute === "NSTC" ? "中（可行性需評估）" : "中",
      methodEvidenceCount: methodCount,
      fitBreakdown: { rq: isRct ? 18 : 12, theoryMechanism: hasMediator ? 12 : 10, causal: 15, dataMeasurement: 8, feasibility: isRct ? 8 : 6, sampleAccess: 5, validityControl: 5, ethics: 3, route: source.primaryRoute === "JOURNAL" ? 5 : 3 },
      fitScore: 0, fitRationale: `候選方案：RCT。${isRct ? "選題/RQ 文字出現隨機對照語意，RQ Fit 高。" : ""}${hasMediator ? "構念字典含中介變數，可規劃中介分析。" : ""}`,
    });
  }
  if (isRct || isQuasi || (!isRct && !isSurvey && !isQual)) {
    push({
      designKey: "quasi", designName: "準實驗設計（前後測＋對照/追蹤）", designType: "Quasi-experimental Design", answersRqKeys: rqKeys, cannotAnswerRqKeys: [],
      causalInferenceCapability: "中：無隨機分配時需以控制變項/傾向分數降低混淆，因果主張需審慎。",
      sampleAndSiteRequirements: "現有班級/單位分組；場域可行。", requiredTime: "中", executionDifficulty: "中",
      ethicsRisks: "低-中；需避免教師/研究者效應。", dataRequirements: "前測/後測＋可選追蹤",
      methodStrengths: ["場域可行", "符合教學實踐/場域研究"], methodLimitations: ["選擇偏誤風險", "因果主張受限"],
      routeFit: source.primaryRoute === "MOE_TEACHING_PRACTICE" ? "高（課程內介入可行）" : source.primaryRoute === "JOURNAL" ? "中" : "高",
      methodEvidenceCount: methodCount,
      fitBreakdown: { rq: 14, theoryMechanism: 11, causal: 8, dataMeasurement: 8, feasibility: 13, sampleAccess: 8, validityControl: 4, ethics: 4, route: source.primaryRoute === "MOE_TEACHING_PRACTICE" ? 5 : 3 },
      fitScore: 0, fitRationale: "候選方案：準實驗（前後測＋對照/追蹤）。場域可行性高；因果語言需審慎（Alignment Check 會檢查）。",
    });
  }
  if (isSurvey) {
    push({
      designKey: "survey", designName: "橫斷面問卷調查", designType: "Cross-sectional Survey", answersRqKeys: rqKeys.filter((_, i) => /相關|關係|影響因素|中介|調節|態度|意圖|接受度|使用/iu.test(rqTexts[i] ?? "")), cannotAnswerRqKeys: rqKeys.filter((_, i) => /是否有效|能否提升|成效|因果/iu.test(rqTexts[i] ?? "")),
      causalInferenceCapability: "低：僅相關，不能支持因果（Alignment Check 會警告強因果語句）。",
      sampleAndSiteRequirements: "目標群體便利/分層抽樣；線上或紙本。", requiredTime: "短", executionDifficulty: "低",
      ethicsRisks: "低；注意共同方法變異與社會期許。", dataRequirements: "單一時點問卷資料",
      methodStrengths: ["成本低", "樣本易達", "可探測中介/調節"], methodLimitations: ["無因果", "共同方法變異風險"],
      routeFit: source.primaryRoute === "JOURNAL" ? "中（需與理論對話）" : "低",
      methodEvidenceCount: methodCount,
      fitBreakdown: { rq: 8, theoryMechanism: 8, causal: 3, dataMeasurement: 8, feasibility: 14, sampleAccess: 10, validityControl: 3, ethics: 4, route: 2 },
      fitScore: 0, fitRationale: "候選方案：橫斷面問卷。適合相關/中介/調節 RQ；成效型 RQ 因果能力不足。",
    });
  }
  if (isQual || isMixed) {
    push({
      designKey: "mixed", designName: "混合方法（量化＋質性）", designType: "Mixed Methods", answersRqKeys: rqKeys, cannotAnswerRqKeys: [],
      causalInferenceCapability: "中：量化部分視設計；質性補充機制解釋。",
      sampleAndSiteRequirements: "量化樣本＋質性次樣本（訪談/焦點團體）。", requiredTime: "長", executionDifficulty: "高",
      ethicsRisks: "中；質性資料識別與權力關係。", dataRequirements: "量化＋訪談/觀察",
      methodStrengths: ["機制解釋深", "可回答『為何』"], methodLimitations: ["整合成本高", "需 joint display 規劃"],
      routeFit: "高（教學實踐/質性取向期刊）",
      methodEvidenceCount: methodCount,
      fitBreakdown: { rq: 15, theoryMechanism: 13, causal: 6, dataMeasurement: 7, feasibility: 8, sampleAccess: 6, validityControl: 4, ethics: 3, route: 4 },
      fitScore: 0, fitRationale: "候選方案：混合方法。量化檢驗效果、質性解釋機制；需明確整合點。",
    });
  }
  if (isAi) {
    push({
      designKey: "ai_dev", designName: "AI 模型開發與實證評估", designType: "AI Model Development", answersRqKeys: rqKeys, cannotAnswerRqKeys: [],
      causalInferenceCapability: "不適用因果；為預測/評估型。",
      sampleAndSiteRequirements: "資料集（train/validation/test）；需外部驗證。", requiredTime: "中-長", executionDifficulty: "高",
      ethicsRisks: "資料偏差/公平性/可解釋性。", dataRequirements: "標註資料＋模型指標",
      methodStrengths: ["技術貢獻明確"], methodLimitations: ["需防資料洩漏", "只報最佳結果風險"],
      routeFit: "中-高（技術取向期刊）",
      methodEvidenceCount: methodCount,
      fitBreakdown: { rq: 12, theoryMechanism: 6, causal: 2, dataMeasurement: 9, feasibility: 9, sampleAccess: 6, validityControl: 4, ethics: 3, route: 4 },
      fitScore: 0, fitRationale: "候選方案：AI 模型開發。需明確定義標籤、分割與評估指標（不得用測試集調參）。",
    });
  }
  if (candidates.length === 0) {
    push({
      designKey: "exploratory", designName: "探索性研究（質性/設計科學）", designType: "Qualitative / Design Science", answersRqKeys: rqKeys, cannotAnswerRqKeys: [],
      causalInferenceCapability: "不適用因果；建立命題與機制理解。",
      sampleAndSiteRequirements: "立意取樣；訪談/觀察/個案。", requiredTime: "中", executionDifficulty: "中",
      ethicsRisks: "低-中。", dataRequirements: "訪談/觀察/文件",
      methodStrengths: ["適合探索性 RQ", "不需強制 Power Analysis"], methodLimitations: ["不提供統計檢定"],
      routeFit: "中（質性期刊/教學實踐）",
      methodEvidenceCount: methodCount,
      fitBreakdown: { rq: 14, theoryMechanism: 10, causal: 2, dataMeasurement: 6, feasibility: 13, sampleAccess: 8, validityControl: 4, ethics: 4, route: 3 },
      fitScore: 0, fitRationale: "候選方案：探索性研究。選題/方法未出現量化語意；不強制套用 Power Analysis（依規格）。",
    });
  }
  for (const c of candidates) {
    c.fitScore = Math.min(100, Object.values(c.fitBreakdown).reduce((a, b) => a + b, 0));
  }
  return candidates;
}

// ---------- Design Alignment Checker ----------

// ---------- Gate checks ----------
const GATE_CHECKS: { key: string; label: string; check: (ctx: { payload: Record<string, unknown>; source: DesignSource; findings: DesignAlignmentFinding[]; evidenceLinks: Record<string, unknown>[]; hasBlueprintV3: boolean }) => { pass: boolean; detail: string } }[] = [
  { key: "design_selected", label: "已選定正式研究設計", check: (c) => { const s = record(c.payload.selected_design) ? c.payload.selected_design as Record<string, unknown> : {}; return { pass: Boolean(str(s.designKey)), detail: str(s.designKey) ? `Selected：${str(s.designName)}` : "尚未選定。" }; } },
  { key: "rq_data_analysis", label: "每個 RQ 均有資料與分析對應", check: (c) => { const questions = list(c.source.blueprintPayload.questions); const matrix = list(c.payload.rq_data_analysis_matrix); const keys = new Set(matrix.map((m) => str(record(m) ? (m as Record<string, unknown>).rqKey : "")).filter(Boolean)); const missing = questions.filter((q) => !keys.has(str(record(q) ? (q as Record<string, unknown>).rqKey : ""))); return { pass: missing.length === 0, detail: missing.length ? `${missing.length} 個 RQ 無對應。` : "全部 RQ 已對應。" }; } },
  { key: "hypothesis_analysis", label: "每個假設均有檢驗方式", check: (c) => { const hypotheses = list(c.source.theoryPayload.hypotheses_or_propositions); const plans = list(c.payload.analysis_plans); const keys = new Set(plans.map((p) => str(record(p) ? (p as Record<string, unknown>).relatedHypothesis : "")).filter(Boolean)); const missing = hypotheses.filter((h) => { const r = record(h) ? h : {}; return str(r.kind) === "HYPOTHESIS" && !keys.has(str(r.hypothesisKey, str(r.key, ""))); }); return { pass: missing.length === 0, detail: missing.length ? `${missing.length} 個假設無分析。` : "全部假設已對應分析。" }; } },
  { key: "construct_measurement", label: "主要構念均有 Measurement Requirement", check: (c) => { const constructs = list(c.source.theoryPayload.construct_dictionary); const reqs = list(c.payload.measurement_requirements); const keys = new Set(reqs.map((r) => str(record(r) ? (r as Record<string, unknown>).constructId : "")).filter(Boolean)); const missing = constructs.filter((x) => { const r = record(x) ? x : {}; return ["INDEPENDENT_VARIABLE", "DEPENDENT_VARIABLE", "MEDIATOR", "MODERATOR", "LEARNING_OUTCOME"].includes(str(r.role)) && !keys.has(str(r.constructId)); }); return { pass: missing.length === 0, detail: missing.length ? `${missing.length} 個主要構念無測量需求。` : "全部主要構念已定義測量需求。" }; } },
  { key: "primary_outcome", label: "主要結果指標已明確", check: (c) => { const plans = list(c.payload.analysis_plans); const primary = plans.some((p) => str(record(p) ? (p as Record<string, unknown>).primaryOrSecondary : "") === "PRIMARY" && str(record(p) ? (p as Record<string, unknown>).primaryOutcome : "")); return { pass: primary, detail: primary ? "已定義 primary outcome。" : "尚未定義 primary outcome（需至少一個分析計畫標記 PRIMARY 且列出 outcome）。" }; } },
  { key: "arms_timepoints", label: "研究組別與時間點已定義", check: (c) => { const arms = list(c.payload.study_arms); const tps = list(c.payload.time_points); return { pass: arms.length >= 1 && tps.length >= 1, detail: `組別 ${arms.length}、時間點 ${tps.length}。` }; } },
  { key: "sampling_strategy", label: "樣本策略已建立", check: (c) => { const s = record(c.payload.sampling_plan) ? c.payload.sampling_plan as Record<string, unknown> : {}; return { pass: Boolean(str(s.samplingMethod)), detail: str(s.samplingMethod) || "抽樣方法未填。" }; } },
  { key: "power_analysis", label: "Power Analysis 完成或有可追溯樣本依據", check: (c) => { const s = record(c.payload.sampling_plan) ? c.payload.sampling_plan as Record<string, unknown> : {}; const status = str(s.powerStatus, "NOT_STARTED"); const hasBasis = str(s.effectSizeSource) !== "" && str(s.effectSizeSource) !== "UNVERIFIED"; const selected = str(record(c.payload.selected_design) ? (c.payload.selected_design as Record<string, unknown>).designKey : ""); if (["exploratory", "qualitative"].includes(selected)) return { pass: true, detail: "探索性/質性設計不強制 Power Analysis（依規格）。" }; return { pass: ["CALCULATED", "VERIFIED"].includes(status) || (hasBasis && Boolean(str(s.minimumRequiredN))), detail: `Power 狀態：${status}${hasBasis ? `；效果量來源：${str(s.effectSizeSource)}` : "（缺效果量來源）"}` }; } },
  { key: "missing_outlier", label: "Missing Data 與 Outlier 策略已建立", check: (c) => { const plans = list(c.payload.analysis_plans); const ok = plans.some((p) => { const r = record(p) ? p : {}; return Boolean(str(r.missingDataStrategy)) && Boolean(str(r.outlierStrategy)); }); return { pass: ok, detail: ok ? "已定義。" : "至少一個分析計畫需定義 missing data 與 outlier 策略。" }; } },
  { key: "effect_ci", label: "Effect Size 與 Confidence Interval 已規劃", check: (c) => { const plans = list(c.payload.analysis_plans); const ok = plans.some((p) => { const r = record(p) ? p : {}; const rep = record(r.plannedReporting) ? r.plannedReporting as Record<string, unknown> : {}; return Boolean(str(rep.effectSize)) || Boolean(str(r.effectSize)); }); return { pass: ok, detail: ok ? "已規劃。" : "需規劃 effect size 與 CI（不只 p-value）。" }; } },
  { key: "validity_checked", label: "已完成 Validity 與 Bias 檢查", check: (c) => { const items = list(c.payload.validity_bias_items); return { pass: items.length >= 1, detail: `Bias Register ${items.length} 項。` }; } },
  { key: "method_evidence", label: "方法選擇具有 Evidence", check: (c) => ({ pass: c.evidenceLinks.length > 0 || c.source.methodLiterature.length > 0, detail: `方法文獻：${c.source.methodLiterature.length} 筆（連結 ${c.evidenceLinks.length}）。` }) },
  { key: "no_major_alignment", label: "無重大 Design Alignment Gap", check: (c) => { const major = c.findings.filter((f) => f.severity === "MAJOR_DESIGN_GAP"); return { pass: major.length === 0, detail: major.length ? `${major.length} 個 MAJOR 待處理。` : "無重大斷鏈。" }; } },
  { key: "blueprint_v3", label: "已建立 Research Blueprint v3 Design-Locked", check: (c) => ({ pass: c.hasBlueprintV3, detail: c.hasBlueprintV3 ? "已回寫。" : "尚未回寫（請執行「回寫研究藍圖 v3」）。" }) },
  { key: "planned_only", label: "所有內容仍屬計畫資料（無虛構結果）", check: (c) => { const raw = JSON.stringify(c.payload); const hits = /FOUND|OBSERVED|SIGNIFICANT|SUPPORTED BY RESULTS/iu.exec(raw); return { pass: !hits, detail: hits ? `偵測到疑似結果字眼：${hits[0]}。` : "內容皆為 PLANNED/PROVISIONAL。" }; } },
];

function evaluateDesignAlignment(payload: Record<string, unknown>, source: DesignSource): DesignAlignmentFinding[] {
  const results = GATE_CHECKS.map((check) => {
    const out = check.check({ payload, source, findings: [], evidenceLinks: [], hasBlueprintV3: false });
    return { key: check.key, label: check.label, pass: out.pass, detail: out.detail };
  });
  return results.map((r) => ({ severity: (r.pass ? "MINOR_DESIGN_GAP" : "MAJOR_DESIGN_GAP") as "MAJOR_DESIGN_GAP" | "MINOR_DESIGN_GAP", code: r.key, chain: "design-alignment", description: r.detail, suggestion: "" }));
}

// ---------- 檢視 ----------
export type ResearchDesignView = {
  ok: boolean;
  exists: boolean;
  locked: boolean;
  theoryLocked: boolean;
  missingPrerequisites?: { key: string; label: string; affects: string }[];
  analysis?: { id: string; status: string; currentVersion: number; versionLabel: string; primaryRoute: string | null; updatedAt: string; gateState: Record<string, unknown> };
  sections?: Record<string, unknown>;
  candidates?: Record<string, unknown>[];
  designEvidenceLinks?: Record<string, unknown>[];
  alignment?: { checkedAt?: string | null; findings: DesignAlignmentFinding[] } | null;
  gatePreview?: { total: number; passed: number; failed: { key: string; label: string; detail: string }[] };
  missingInputs?: { key: string; label: string; affects: string }[];
  sourceInfo?: { blueprintVersion: number; theoryStatus: string; primaryRoute: string; projectTitle: string };
  versions?: { id: string; versionNumber: number; versionLabel: string; reason: string; createdAt: string }[];
};

export async function getResearchDesign(tenant: ResearchTenant, input: { userId: string }): Promise<ResearchDesignView> {
  return withClient(async (client) => {
    const source = await loadSource(client, tenant);
    let ensured;
    try { ensured = await ensureDesignAnalysis(client, tenant, { userId: input.userId, source }); }
    catch (error) {
      if (error instanceof ResearchDesignRepositoryError && error.code === "research_project_required") {
        return { ok: true, exists: false, locked: false, theoryLocked: source.theoryStatus !== "APPROVED" };
      }
      throw error;
    }
    const analysisRow = (await client.query(`SELECT id, status, current_version_number AS "currentVersion", primary_route AS "primaryRoute", gate_state AS "gateState", updated_at AS "updatedAt" FROM research_design_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0] as Record<string, unknown> | undefined;
    if (!analysisRow) return { ok: true, exists: false, locked: false, theoryLocked: source.theoryStatus !== "APPROVED" };
    const analysisId = text(analysisRow.id);
    const latest = await client.query(`SELECT id, version_number AS "versionNumber", version_label AS "versionLabel", payload FROM research_design_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const latestVersion = latest.rows[0] as Record<string, unknown> | undefined;
    const payload = latestVersion && record(latestVersion.payload) ? latestVersion.payload as Record<string, unknown> : {};
    const sectionState = record(analysisRow.gateState) ? analysisRow.gateState : {};
    const alignment = record(sectionState.alignment) ? sectionState.alignment as { checkedAt?: string; findings: DesignAlignmentFinding[] } : null;
    const findings = alignment?.findings ?? evaluateDesignAlignment(payload, source);
    const candidates = (await client.query(`SELECT design_key AS "designKey", design_name AS "designName", design_type AS "designType", answers_rq_keys AS "answersRqKeys", cannot_answer_rq_keys AS "cannotAnswerRqKeys", causal_inference_capability AS "causalInferenceCapability", sample_and_site_requirements AS "sampleAndSiteRequirements", required_time AS "requiredTime", execution_difficulty AS "executionDifficulty", ethics_risks AS "ethicsRisks", data_requirements AS "dataRequirements", method_strengths AS "methodStrengths", method_limitations AS "methodLimitations", route_fit AS "routeFit", method_evidence_count AS "methodEvidenceCount", fit_breakdown AS "fitBreakdown", fit_score AS "fitScore", fit_rationale AS "fitRationale", selection_status AS "selectionStatus", selection_reason AS "selectionReason" FROM design_candidates WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY fit_score DESC NULLS LAST`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
    const evidenceLinks = (await client.query(`SELECT id, target_type AS "targetType", target_ref AS "targetRef", literature_id AS "literatureId", citation_source_id AS "citationSourceId", zotero_item_key AS "zoteroItemKey", source_location AS "sourceLocation", reading_status AS "readingStatus", verification_status AS "verificationStatus", note FROM design_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
    const versions = (await client.query(`SELECT id, version_number AS "versionNumber", version_label AS "versionLabel", reason, created_at AS "createdAt" FROM research_design_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 50`, [tenant.workspaceId, tenant.projectId, analysisId])).rows.map((v: Record<string, unknown>) => ({ id: text(v.id), versionNumber: int(v.versionNumber), versionLabel: text(v.versionLabel), reason: text(v.reason), createdAt: text(v.createdAt) }));
    const hasBlueprintV3 = Boolean((await client.query(`SELECT id FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label='v4.0 Design-Locked' LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0]);
    const results = GATE_CHECKS.map((check) => ({ key: check.key, label: check.label, ...check.check({ payload, source, findings, evidenceLinks, hasBlueprintV3 }) }));
    const failed = results.filter((r) => !r.pass);
    const missingPrerequisites: { key: string; label: string; affects: string }[] = [];
    if (source.theoryStatus !== "APPROVED") {
      if (source.theoryStatus === "LOCKED") missingPrerequisites.push({ key: "theory_locked", label: "理論與機制尚未鎖定（THEORY_AND_MECHANISM_LOCKED 未通過）", affects: "研究設計進入條件" });
      if (source.theoryStatus === "OUTDATED") missingPrerequisites.push({ key: "theory_outdated", label: "理論與機制已 OUTDATED（來源變更）", affects: "研究設計一致性" });
      if (source.theoryStatus === "DRAFT" || source.theoryStatus === "MODEL_IN_PROGRESS") missingPrerequisites.push({ key: "theory_incomplete", label: "理論與機制仍在進行中", affects: "研究設計進入條件" });
    }
    const missingInputs: { key: string; label: string; affects: string }[] = [];
    if (list(source.blueprintPayload.questions).length === 0) missingInputs.push({ key: "research_questions", label: "Research Questions", affects: "RQ–Data–Analysis Matrix" });
    if (list(source.theoryPayload.construct_dictionary).length === 0) missingInputs.push({ key: "construct_dictionary", label: "Construct Dictionary", affects: "Measurement Requirements" });
    if (source.methodLiterature.length === 0) missingInputs.push({ key: "method_literature", label: "METHOD/MEASUREMENT 角色文獻", affects: "方法與效果量證據" });
    const sections = {
      selected_design: payload.selected_design ?? null,
      study_identity: payload.study_identity ?? null,
      population_plan: payload.population_plan ?? null,
      sampling_plan: payload.sampling_plan ?? { samplingMethod: "", powerStatus: "NOT_STARTED" },
      study_arms: payload.study_arms ?? [],
      allocation: payload.allocation ?? null,
      time_points: payload.time_points ?? [],
      intervention_spec: payload.intervention_spec ?? null,
      measurement_requirements: payload.measurement_requirements ?? [],
      rq_data_analysis_matrix: payload.rq_data_analysis_matrix ?? [],
      analysis_plans: payload.analysis_plans ?? [],
      analysis_plan_amendments: payload.analysis_plan_amendments ?? [],
      validity_bias_items: payload.validity_bias_items ?? [],
      unresolved_design_issues: payload.unresolved_design_issues ?? [],
    };
    return {
      ok: true,
      exists: true,
      locked: text(analysisRow.status) === "LOCKED",
      theoryLocked: source.theoryStatus !== "APPROVED",
      missingPrerequisites,
      analysis: {
        id: analysisId, status: text(analysisRow.status), currentVersion: int(analysisRow.currentVersion),
        versionLabel: latestVersion ? text(latestVersion.versionLabel) : "v0（尚未建立）",
        primaryRoute: analysisRow.primaryRoute ? text(analysisRow.primaryRoute) : null,
        updatedAt: text(analysisRow.updatedAt), gateState: record(analysisRow.gateState) ? analysisRow.gateState : {},
      },
      sections,
      candidates: candidates.map((r) => ({ ...r, fitBreakdown: record(r.fitBreakdown) ? r.fitBreakdown : {}, fitScore: int(r.fitScore), methodStrengths: list(r.methodStrengths), methodLimitations: list(r.methodLimitations) })),
      designEvidenceLinks: evidenceLinks,
      alignment: { checkedAt: alignment?.checkedAt ?? null, findings },
      gatePreview: { total: results.length, passed: results.length - failed.length, failed },
      missingInputs,
      sourceInfo: { blueprintVersion: source.blueprintVersion, theoryStatus: source.theoryStatus, primaryRoute: source.primaryRoute, projectTitle: source.projectTitle },
      versions,
    };
  });
}

async function createVersion(client: PoolClient, tenant: ResearchTenant, analysisId: string, userId: string, payload: Record<string, unknown>, reason: string, label: string) {
  const latest = await client.query(`SELECT id, version_number AS "versionNumber" FROM research_design_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
  const versionNumber = latest.rows[0] ? int((latest.rows[0] as Record<string, unknown>).versionNumber) + 1 : 1;
  const versionId = `rdv_${randomUUID()}`;
  await client.query(
    `INSERT INTO research_design_versions (id,workspace_id,project_id,analysis_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
     VALUES ($4,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,now())`,
    [tenant.workspaceId, tenant.projectId, analysisId, versionId, versionNumber, latest.rows[0] ? text((latest.rows[0] as Record<string, unknown>).id) : null, label, reason, hash(payload), JSON.stringify(payload), userId],
  );
  await client.query(`UPDATE research_design_analyses SET current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, versionNumber, analysisId]);
  return versionId;
}

export async function draftDesignCandidates(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, tenant, "design-draft");
      const source = await loadSource(client, tenant);
      const ensured = await ensureDesignAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new ResearchDesignRepositoryError("research_design_lab_locked", 423);
      const analysisId = ensured.id;
      const candidates = buildDesignCandidates(source);
      for (const c of candidates) {
        await client.query(
          `INSERT INTO design_candidates (id,workspace_id,project_id,analysis_id,design_key,design_name,design_type,answers_rq_keys,cannot_answer_rq_keys,causal_inference_capability,sample_and_site_requirements,required_time,execution_difficulty,ethics_risks,data_requirements,method_strengths,method_limitations,route_fit,method_evidence_count,fit_breakdown,fit_score,fit_rationale,selection_status,created_at,updated_at)
           VALUES ($4,$1,$2,$3,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18,$19,$20::jsonb,$21,$22,'CANDIDATE',now(),now())
           ON CONFLICT (analysis_id, design_key) DO UPDATE SET design_name=EXCLUDED.design_name, fit_breakdown=EXCLUDED.fit_breakdown, fit_score=EXCLUDED.fit_score, fit_rationale=EXCLUDED.fit_rationale, method_evidence_count=EXCLUDED.method_evidence_count, updated_at=now()`,
          [tenant.workspaceId, tenant.projectId, analysisId, `dcan_${randomUUID()}`, c.designKey, c.designName.slice(0, 200), c.designType, JSON.stringify(c.answersRqKeys), JSON.stringify(c.cannotAnswerRqKeys), c.causalInferenceCapability.slice(0, 500), c.sampleAndSiteRequirements.slice(0, 500), c.requiredTime.slice(0, 100), c.executionDifficulty.slice(0, 100), c.ethicsRisks.slice(0, 500), c.dataRequirements.slice(0, 300), JSON.stringify(c.methodStrengths), JSON.stringify(c.methodLimitations), c.routeFit.slice(0, 300), c.methodEvidenceCount, JSON.stringify(c.fitBreakdown), c.fitScore, c.fitRationale.slice(0, 2000)],
        );
      }
      const payload = { contractVersion: "research-design/1.0.0", fit_disclaimer: DESIGN_FIT_DISCLAIMER, selected_design: null, study_identity: null, population_plan: null, sampling_plan: { samplingMethod: "", powerStatus: "NOT_STARTED" }, study_arms: [], allocation: null, time_points: [], intervention_spec: null, measurement_requirements: [], rq_data_analysis_matrix: [], analysis_plans: [], analysis_plan_amendments: [], validity_bias_items: [], unresolved_design_issues: [] };
      await createVersion(client, tenant, analysisId, input.userId, payload, "建立研究設計候選方案池（由 RQ/機制/方法方向推導，不虛構）", "v0.1 Design Candidates");
      const nextStatus = source.methodLiterature.length === 0 ? "DESIGN_SEARCH_REQUIRED" : "MODEL_IN_PROGRESS";
      await client.query(`UPDATE research_design_analyses SET status=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, nextStatus, analysisId]);
      await audit(client, tenant, input.userId, "DESIGN_CANDIDATES_DRAFTED", { analysisId, count: candidates.length });
      await client.query("COMMIT");
      return { ok: true, count: candidates.length, status: nextStatus, candidates };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function editDesignSection(tenant: ResearchTenant, input: { userId: string; edit: ResearchDesignSectionEdit }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const source = await loadSource(client, tenant);
      const ensured = await ensureDesignAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new ResearchDesignRepositoryError("research_design_lab_locked", 423);
      const analysisId = ensured.id;
      const latest = await client.query(`SELECT payload FROM research_design_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : { contractVersion: "research-design/1.0.0" };
      const existingSection = payload[input.edit.section];
      if (Array.isArray(existingSection)) {
        const items = Array.isArray(input.edit.payload._items) ? input.edit.payload._items : Array.isArray(input.edit.payload.items) ? input.edit.payload.items : null;
        if (items) payload[input.edit.section] = items;
      } else if (input.edit.section === "selected_design") {
        const merged = { ...(record(existingSection) ? existingSection : {}), ...input.edit.payload };
        payload.selected_design = merged;
        const key = str(merged.designKey, "");
        if (key) await client.query(`UPDATE research_design_analyses SET selected_design_key=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, key, analysisId]);
      } else {
        payload[input.edit.section] = { ...(record(existingSection) ? existingSection : {}), ...input.edit.payload, _updatedAt: new Date().toISOString() };
      }
      await createVersion(client, tenant, analysisId, input.userId, payload, input.edit.reason || `編輯 ${input.edit.section}`, `v${int((await client.query(`SELECT current_version_number AS "n" FROM research_design_analyses WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, analysisId])).rows[0]?.["n"]) + 1} ${input.edit.section}`);
      if (["DRAFT", "MODEL_IN_PROGRESS", "DESIGN_SEARCH_REQUIRED", "EVIDENCE_INCOMPLETE", "REVISION_REQUIRED", "OUTDATED"].includes(ensured.status)) {
        await client.query(`UPDATE research_design_analyses SET status='MODEL_IN_PROGRESS', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, analysisId]);
      }
      await audit(client, tenant, input.userId, "DESIGN_SECTION_EDITED", { analysisId, section: input.edit.section });
      await client.query("COMMIT");
      return { ok: true, analysisId };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function updateDesignSelection(tenant: ResearchTenant, input: { userId: string; designKey: string; selectionStatus: DesignCandidateStatus; reason?: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const ensured = await ensureDesignAnalysis(client, tenant, { userId: input.userId, source: await loadSource(client, tenant) });
      if (ensured.status === "LOCKED") throw new ResearchDesignRepositoryError("research_design_lab_locked", 423);
      const result = await client.query(`UPDATE design_candidates SET selection_status=$4, selection_reason=$5, updated_at=now() WHERE ${tenantWhere()} AND analysis_id=$3 AND design_key=$6`, [tenant.workspaceId, tenant.projectId, ensured.id, input.selectionStatus, input.reason ?? null, input.designKey]);
      if (!result.rowCount) throw new ResearchDesignRepositoryError("design_candidate_not_found", 404);
      await audit(client, tenant, input.userId, "DESIGN_SELECTION_UPDATED", { analysisId: ensured.id, designKey: input.designKey, selectionStatus: input.selectionStatus });
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function linkDesignEvidence(tenant: ResearchTenant, input: { userId: string; links: { targetType: string; targetRef: string; literatureId?: string; citationSourceId?: string; zoteroItemKey?: string; sourceLocation?: string; readingStatus?: string; verificationStatus?: string; note?: string }[] }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const ensured = await ensureDesignAnalysis(client, tenant, { userId: input.userId, source: await loadSource(client, tenant) });
      if (ensured.status === "LOCKED") throw new ResearchDesignRepositoryError("research_design_lab_locked", 423);
      const analysisId = ensured.id;
      let linked = 0;
      for (const link of input.links) {
        if (!link.literatureId) continue;
        const lit = await client.query(`SELECT id, zotero_item_key AS "zoteroItemKey" FROM literature_items WHERE id=$2 AND workspace_id=$1`, [tenant.workspaceId, link.literatureId]);
        if (!lit.rows[0]) continue;
        const linkedInProject = await client.query(`SELECT 1 FROM project_literature_links WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, link.literatureId]);
        if (!linkedInProject.rowCount) continue;
        const citation = await client.query(`SELECT id FROM citation_sources WHERE ${tenantWhere()} AND literature_id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, link.literatureId]);
        await client.query(
          `INSERT INTO design_evidence_links (id,workspace_id,project_id,analysis_id,target_type,target_ref,literature_id,citation_source_id,zotero_item_key,source_location,reading_status,verification_status,note,created_at)
           VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())`,
          [tenant.workspaceId, tenant.projectId, analysisId, `del_${randomUUID()}`, link.targetType, link.targetRef, link.literatureId, link.citationSourceId ?? (citation.rows[0] ? text((citation.rows[0] as Record<string, unknown>).id) : null), link.zoteroItemKey ?? (lit.rows[0] ? text((lit.rows[0] as Record<string, unknown>).zoteroItemKey) : null), link.sourceLocation ?? null, link.readingStatus ?? "ABSTRACT_REVIEWED", link.verificationStatus ?? "UNVERIFIED", link.note ?? null],
        );
        linked += 1;
      }
      await audit(client, tenant, input.userId, "DESIGN_EVIDENCE_LINKED", { analysisId, count: linked });
      await client.query("COMMIT");
      return { ok: true, linked };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function runDesignAlignment(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const source = await loadSource(client, tenant);
      const ensured = await ensureDesignAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new ResearchDesignRepositoryError("research_design_lab_locked", 423);
      const analysisId = ensured.id;
      const latest = await client.query(`SELECT payload FROM research_design_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const findings = evaluateDesignAlignment(payload, source);
      const alignmentState = { checkedAt: new Date().toISOString(), findings };
      const existingGate = await client.query(`SELECT gate_state AS "g" FROM research_design_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      const gateState = existingGate.rows[0] && record((existingGate.rows[0] as Record<string, unknown>).g) ? (existingGate.rows[0] as Record<string, unknown>).g as Record<string, unknown> : {};
      await client.query(`UPDATE research_design_analyses SET gate_state=$3::jsonb, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify({ ...gateState, alignment: alignmentState }), analysisId]);
      await audit(client, tenant, input.userId, "DESIGN_ALIGNMENT_CHECKED", { analysisId, major: findings.filter((f) => f.severity === "MAJOR_DESIGN_GAP").length });
      await client.query("COMMIT");
      return { ok: true, checkedAt: alignmentState.checkedAt, findings };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function writebackBlueprintDesignLocked(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const source = await loadSource(client, tenant);
      const ensured = await ensureDesignAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new ResearchDesignRepositoryError("research_design_lab_locked", 423);
      const analysisId = ensured.id;
      const latest = await client.query(`SELECT payload FROM research_design_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const blueprint = await client.query(`SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!blueprint.rows[0]) throw new ResearchDesignRepositoryError("blueprint_required", 422);
      const blueprintId = text((blueprint.rows[0] as Record<string, unknown>).id);
      const latestBp = await client.query(`SELECT payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      const bpPayload = latestBp.rows[0] && record((latestBp.rows[0] as Record<string, unknown>).payload) ? (latestBp.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const evidenceLinks = (await client.query(`SELECT target_type AS "targetType", target_ref AS "targetRef", literature_id AS "literatureId", citation_source_id AS "citationSourceId", zotero_item_key AS "zoteroItemKey", source_location AS "sourceLocation", reading_status AS "readingStatus", verification_status AS "verificationStatus" FROM design_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, analysisId])).rows.map((r: Record<string, unknown>) => ({ targetType: text(r.targetType), targetRef: text(r.targetRef), literatureId: r.literatureId ? text(r.literatureId) : null, citationSourceId: r.citationSourceId ? text(r.citationSourceId) : null, zoteroItemKey: r.zoteroItemKey ? text(r.zoteroItemKey) : null, sourceLocation: r.sourceLocation ? text(r.sourceLocation) : null, readingStatus: text(r.readingStatus), verificationStatus: text(r.verificationStatus) }));
      const v3Payload: Record<string, unknown> = {
        ...bpPayload,
        selected_research_design: payload.selected_design ?? null,
        study_population: payload.population_plan ?? null,
        sampling_plan: payload.sampling_plan ?? null,
        target_sample_size: record(payload.sampling_plan) ? (payload.sampling_plan as Record<string, unknown>).minimumRequiredN ?? null : null,
        study_arms: payload.study_arms ?? [],
        allocation_method: payload.allocation ?? null,
        time_points: payload.time_points ?? [],
        intervention_direction: payload.intervention_spec ?? null,
        measurement_requirements: payload.measurement_requirements ?? [],
        rq_data_analysis_matrix: payload.rq_data_analysis_matrix ?? [],
        analysis_plan_version: payload.analysis_plans ? `Analysis Plan v1.0（${list(payload.analysis_plans).length} 項）` : null,
        validity_risks: payload.validity_bias_items ?? [],
        method_evidence_links: evidenceLinks,
        unresolved_design_issues: payload.unresolved_design_issues ?? [],
        research_design: { approved_at: new Date().toISOString(), analysis_id: analysisId, fit_disclaimer: DESIGN_FIT_DISCLAIMER },
      };
      const bpLatest = await client.query(`SELECT id, version_number AS "versionNumber" FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      const versionNumber = bpLatest.rows[0] ? int((bpLatest.rows[0] as Record<string, unknown>).versionNumber) + 1 : 1;
      const versionId = `rbpv_${randomUUID()}`;
      await client.query(
        `INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
         VALUES ($4,$1,$2,$3,$4,$5,$6,'v4.0 Design-Locked','由研究設計實驗室回寫（不覆蓋 v1/v2/v3）',$7,$8::jsonb,$9,now())`,
        [tenant.workspaceId, tenant.projectId, blueprintId, versionId, versionNumber, bpLatest.rows[0] ? text((bpLatest.rows[0] as Record<string, unknown>).id) : null, hash(v3Payload), JSON.stringify(v3Payload), input.userId],
      );
      await client.query(`UPDATE research_blueprints SET current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, versionNumber, blueprintId]);
      await audit(client, tenant, input.userId, "BLUEPRINT_V3_DESIGN_LOCKED_WRITTEN", { analysisId, blueprintVersionId: versionId, versionNumber });
      await client.query("COMMIT");
      return { ok: true, blueprintVersionId: versionId, versionNumber };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function lockResearchDesign(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const source = await loadSource(client, tenant);
      const ensured = await ensureDesignAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new ResearchDesignRepositoryError("research_design_lab_locked", 423);
      const analysisId = ensured.id;
      const latest = await client.query(`SELECT payload FROM research_design_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const findings = evaluateDesignAlignment(payload, source);
      const evidenceLinks = (await client.query(`SELECT target_type AS "targetType", target_ref AS "targetRef", literature_id AS "literatureId", citation_source_id AS "citationSourceId", zotero_item_key AS "zoteroItemKey", reading_status AS "readingStatus" FROM design_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
      const hasBlueprintV3 = Boolean((await client.query(`SELECT id FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label='v4.0 Design-Locked' LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0]);
      const results = GATE_CHECKS.map((check) => ({ key: check.key, label: check.label, ...check.check({ payload, source, findings, evidenceLinks, hasBlueprintV3 }) }));
      const failed = results.filter((r) => !r.pass);
      const gateState = { checkedAt: new Date().toISOString(), results };
      if (failed.length) {
        await client.query(`UPDATE research_design_analyses SET gate_state=$3::jsonb, status='REVISION_REQUIRED', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), analysisId]);
        await client.query("COMMIT");
        return { ok: false, status: "REVISION_REQUIRED", failed, gateState };
      }
      let blueprintVersionId: string | null = null;
      if (!hasBlueprintV3) {
        const writeback = await writebackBlueprintDesignLocked(tenant, { userId: input.userId });
        blueprintVersionId = writeback.blueprintVersionId;
      } else {
        blueprintVersionId = text((await client.query(`SELECT id FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label='v4.0 Design-Locked' LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0]?.["id"]);
      }
      const gateId = `hg_${randomUUID()}`;
      await client.query(
        `INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
         VALUES ($4,$1,$2,$3,'RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE','research_design_analysis',$5,$6,'APPROVED',$3,now(),now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.userId, gateId, analysisId, hash(gateState)],
      );
      await client.query(`UPDATE research_design_analyses SET gate_state=$3::jsonb, status='APPROVED', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), analysisId]);
      await client.query(`INSERT INTO research_design_gates (id,workspace_id,project_id,analysis_id,analysis_version_id,checks,decision,human_gate_id,blueprint_v3_version_id,created_at) VALUES ($4,$1,$2,$3,$5,$6::jsonb,'LOCKED',$7,$8,now())`, [tenant.workspaceId, tenant.projectId, analysisId, `rdg_${randomUUID()}`, text((await client.query(`SELECT current_version_number AS "n" FROM research_design_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0]?.["n"]) || null, JSON.stringify(results), gateId, blueprintVersionId]);
      await audit(client, tenant, input.userId, "RESEARCH_DESIGN_AND_ANALYSIS_PLAN_APPROVED", { analysisId, humanGateId: gateId, blueprintVersionId });
      await client.query("COMMIT");
      return { ok: true, status: "APPROVED", humanGateId: gateId, gateState, blueprintVersionId };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function compareDesignVersions(tenant: ResearchTenant, input: { userId: string; fromVersion: number; toVersion: number }) {
  return withClient(async (client) => {
    const ensured = await ensureDesignAnalysis(client, tenant, { userId: input.userId, source: await loadSource(client, tenant) });
    const rows = await client.query(`SELECT version_number AS "versionNumber", version_label AS "versionLabel", reason, payload FROM research_design_versions WHERE ${tenantWhere()} AND analysis_id=$3 AND version_number IN ($4,$5) ORDER BY version_number`, [tenant.workspaceId, tenant.projectId, ensured.id, input.fromVersion, input.toVersion]);
    if (rows.rows.length !== 2) throw new ResearchDesignRepositoryError("design_version_not_found", 404);
    const [a, b] = rows.rows as Record<string, unknown>[];
    const pa = record(a.payload) ? a.payload as Record<string, unknown> : {};
    const pb = record(b.payload) ? b.payload as Record<string, unknown> : {};
    const changed: string[] = [];
    for (const key of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
      if (JSON.stringify(pa[key] ?? null) !== JSON.stringify(pb[key] ?? null)) changed.push(key);
    }
    return { from: { versionNumber: int(a.versionNumber), versionLabel: text(a.versionLabel), reason: text(a.reason) }, to: { versionNumber: int(b.versionNumber), versionLabel: text(b.versionLabel), reason: text(b.reason) }, changedSections: changed };
  });
}
