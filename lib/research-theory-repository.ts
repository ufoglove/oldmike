import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import {
  ALIGNMENT_CODES,
  CAUSAL_SOFT_WORDS,
  CAUSAL_STRONG_WORDS,
  FIT_DISCLAIMER,
  type AlignmentFinding,
  type CandidateStatus,
  type TheoryMechanismSectionEdit,
  theoryKeyFromName,
} from "./research-theory-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export class TheoryMechanismStorageUnavailable extends Error {
  constructor() { super("theory_mechanism_storage_unavailable"); this.name = "TheoryMechanismStorageUnavailable"; }
}
export class TheoryMechanismRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "TheoryMechanismRepositoryError"; this.code = code; this.status = status; }
}

function tenantWhere(alias = "") { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) { if (!pool) throw new TheoryMechanismStorageUnavailable(); const client = await pool.connect(); try { return await operation(client); } finally { client.release(); } }
async function lock(client: PoolClient, tenant: ResearchTenant, key: string) { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`tm:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function str(v: unknown, fb = ""): string { return typeof v === "string" && v.trim() ? v.trim() : fb; }
function int(v: unknown): number { return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0; }

async function audit(client: PoolClient, tenant: ResearchTenant, userId: string, action: string, artifactRefs?: unknown) {
  const event = { action, artifactRefs: artifactRefs ?? null, lifecycleContractVersion: "1.5.83" };
  await client.query(
    `INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,'S3_DESIGN','S3_DESIGN',$5,'1.5.83',$6::jsonb,$7)`,
    [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, action, JSON.stringify(artifactRefs ?? null), hash(event)],
  );
}

// ---------- 來源資料 ----------
type TheorySource = {
  blueprintVersion: number;
  blueprintVersionId: string | null;
  blueprintPayload: Record<string, unknown>;
  gapStatus: string;
  gapAnalysisId: string | null;
  projectTitle: string;
  theoryRoleLiterature: { literatureId: string; title: string; evidenceStatus: string; readingStatus: string; zoteroItemKey: string | null; citationSourceId: string | null }[];
};

async function loadSource(client: PoolClient, tenant: ResearchTenant): Promise<TheorySource> {
  const projectTitleResult = await client.query(`SELECT title FROM projects WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
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
  const gap = await client.query(`SELECT id, status FROM gap_novelty_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const theoryLiterature = await client.query(
    `SELECT i.id AS "literatureId", i.title, i.zotero_item_key AS "zoteroItemKey", l.evidence_status AS "evidenceStatus", l.reading_status AS "readingStatus", cs.id AS "citationSourceId"
     FROM project_literature_links l
     JOIN literature_items i ON i.workspace_id=l.workspace_id AND i.id=l.literature_id
     LEFT JOIN citation_sources cs ON cs.workspace_id=l.workspace_id AND cs.project_id=l.project_id AND cs.literature_id=l.literature_id
     WHERE l.workspace_id=$1 AND l.project_id=$2 AND l.reading_status <> 'EXCLUDED' AND l.role @> '["THEORY"]'::jsonb
     ORDER BY i.created_at DESC LIMIT 100`,
    [tenant.workspaceId, tenant.projectId],
  );
  return {
    blueprintVersion,
    blueprintVersionId,
    blueprintPayload,
    gapStatus: gap.rows[0] ? text((gap.rows[0] as Record<string, unknown>).status) : "MISSING",
    gapAnalysisId: gap.rows[0] ? text((gap.rows[0] as Record<string, unknown>).id) : null,
    projectTitle: projectTitleResult.rows[0] ? text((projectTitleResult.rows[0] as Record<string, unknown>).title) : "",
    theoryRoleLiterature: theoryLiterature.rows.map((r: Record<string, unknown>) => ({ literatureId: text(r.literatureId), title: text(r.title), evidenceStatus: text(r.evidenceStatus), readingStatus: text(r.readingStatus), zoteroItemKey: r.zoteroItemKey ? text(r.zoteroItemKey) : null, citationSourceId: r.citationSourceId ? text(r.citationSourceId) : null })),
  };
}

function sourceFingerprint(source: TheorySource): string {
  return hash({ blueprintVersion: source.blueprintVersion, gapStatus: source.gapStatus, gapAnalysisId: source.gapAnalysisId, projectTitle: source.projectTitle, blueprint: source.blueprintPayload });
}

// ---------- Analysis row ----------
async function ensureTheoryAnalysis(client: PoolClient, tenant: ResearchTenant, input: { userId: string; source: TheorySource }): Promise<{ id: string; status: string; existed: boolean }> {
  const existing = await client.query(`SELECT id, status, source_hash AS "sourceHash", source_blueprint_version AS "sourceVersion" FROM theory_mechanism_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const fingerprint = sourceFingerprint(input.source);
  if (existing.rows[0]) {
    const row = existing.rows[0] as Record<string, unknown>;
    const id = text(row.id);
    const status = text(row.status);
    if (status !== "LOCKED" && text(row.sourceHash) !== fingerprint) {
      // 重大來源變更（Validated Gap／RQ／Topic／Route／Core Theory）→ OUTDATED
      await client.query(`UPDATE theory_mechanism_analyses SET status='OUTDATED', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, id]);
      return { id, status: "OUTDATED", existed: true };
    }
    return { id, status, existed: true };
  }
  const id = `tma_${randomUUID()}`;
  const initialStatus = input.source.gapStatus === "VALIDATED" ? "DRAFT" : "LOCKED";
  const researchProject = await client.query(`SELECT id FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (!researchProject.rows[0]) throw new TheoryMechanismRepositoryError("research_project_required", 422);
  const researchProjectId = text((researchProject.rows[0] as Record<string, unknown>).id);
  await client.query(
    `INSERT INTO theory_mechanism_analyses (id,workspace_id,project_id,research_project_id,created_by_user_id,source_blueprint_version,source_blueprint_version_id,source_gap_analysis_id,status,primary_route,selection_mode,current_version_number,source_hash,created_at,updated_at)
     VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,0,$12,now(),now())`,
    [tenant.workspaceId, tenant.projectId, researchProjectId, id, input.userId, input.source.blueprintVersion, input.source.blueprintVersionId, input.source.gapAnalysisId, initialStatus, text((await client.query(`SELECT project_type AS "t" FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0]?.["t"]) || "GENERAL", initialStatus === "LOCKED" ? null : "FORMAL_THEORY", fingerprint],
  );
  return { id, status: initialStatus, existed: false };
}

// ---------- 候選理論池（由既有資料推導；不虛構理論） ----------
function buildCandidatePool(source: TheorySource): { theoryKey: string; theoryName: string; theoryType: string; originalDomain: string; coreConstructs: string[]; explanatoryMechanism: string; relatedRqKeys: string[]; relatedGapIds: string[]; fitBreakdown: Record<string, number>; fitScore: number; fitRationale: string; fulltextEvidenceStatus: string }[] {
  const bp = source.blueprintPayload;
  const theoryList = list(record(bp.conceptual_logic) ? (bp.conceptual_logic as Record<string, unknown>).theory : []).map((t) => str(t)).filter(Boolean);
  const variables = list(bp.variables).map((v) => str(record(v) ? (v as Record<string, unknown>).name : "", "")).filter(Boolean);
  const rqTexts = list(bp.questions).map((q) => str(record(q) ? (q as Record<string, unknown>).question : "", "")).filter(Boolean);
  const gapTexts = list(bp.gaps).map((g) => str(record(g) ? (g as Record<string, unknown>).statement : "", "")).filter(Boolean);
  const methodology = str(record(bp.method) ? (bp.method as Record<string, unknown>).direction : "", "");
  const title = str(record(bp.research_identity) ? (bp.research_identity as Record<string, unknown>).chineseTitle : "", "") || source.projectTitle;
  const hay = [title, ...rqTexts, ...gapTexts, ...variables].join(" ");
  const quantitative = /問卷|量表|實驗|RCT|隨機|對照|Likert|回歸|SEM|準實驗/iu.test(methodology) || /實驗|問卷|量表|測量/iu.test(hay);
  const evidByEvidence = (status: string) => source.theoryRoleLiterature.filter((l) => l.evidenceStatus === status).length;

  const candidates = theoryList.map((name, index) => {
    const key = theoryKeyFromName(name) || `theory_${index + 1}`;
    const mentionedInText = hay.includes(name) || rqTexts.some((r) => r.includes(name)) || gapTexts.some((g) => g.includes(name));
    const verified = evidByEvidence("VERIFIED") + evidByEvidence("SUPPORTED");
    const breakdown = {
      problem: mentionedInText ? 14 : 4,
      gap: mentionedInText ? 12 : 4,
      mechanism: 4,
      evidence: Math.min(15, verified * 5),
      constructs: Math.min(10, variables.filter((v) => name.includes(v) || v.includes(name)).length * 4),
      testability: quantitative ? 5 : 2,
      parsimony: 5,
      route: 4,
    };
    const fitScore = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));
    return {
      theoryKey: key,
      theoryName: name,
      theoryType: "EXPLICIT_INPUT",
      originalDomain: "由選題資料帶入（待人工確認）",
      coreConstructs: [],
      explanatoryMechanism: "待依理論文獻補充（PROVISIONAL）",
      relatedRqKeys: rqTexts.map((_, i) => `RQ${i + 1}`),
      relatedGapIds: [],
      fitBreakdown: breakdown,
      fitScore,
      fitRationale: `候選理論「${name}」${mentionedInText ? "名稱出現於題目/Gap/RQ 文字（Problem/Gap Fit 較高）。" : "名稱未直接出現在題目/Gap/RQ 文字，需人工評估實質契合。"} THEORY 角色文獻 ${verified} 篇已驗證/支持。`,
      fulltextEvidenceStatus: verified > 0 ? "SUPPORTED" : source.theoryRoleLiterature.length > 0 ? "UNVERIFIED" : "INSUFFICIENT_EVIDENCE",
    };
  });

  // 無正式理論時提供 CONCEPTUAL_FRAMEWORK_ONLY 選項（探索性／設計科學）
  if (candidates.length === 0) {
    candidates.push({
      theoryKey: "conceptual_framework_only",
      theoryName: "Conceptual Framework Only（不套用正式理論）",
      theoryType: "CONCEPTUAL_FRAMEWORK_ONLY",
      originalDomain: "N/A",
      coreConstructs: [],
      explanatoryMechanism: "以概念框架組織介入→過程→結果（探索性／設計科學適用）",
      relatedRqKeys: rqTexts.map((_, i) => `RQ${i + 1}`),
      relatedGapIds: [],
      fitBreakdown: { problem: 10, gap: 10, mechanism: 10, evidence: Math.min(15, evidByEvidence("VERIFIED") * 3), constructs: 6, testability: 4, parsimony: 5, route: 4 },
      fitScore: 0,
      fitRationale: "未在選題資料中找到正式理論。若本研究屬探索性／質性／設計科學／技術開發，可選此模式並說明理由；若屬確認性量化研究，請先補充 THEORY 角色文獻。",
      fulltextEvidenceStatus: source.theoryRoleLiterature.length ? "UNVERIFIED" : "INSUFFICIENT_EVIDENCE",
    });
  }
  return candidates;
}

// ---------- Alignment Checker ----------
export function runAlignmentCheck(payload: Record<string, unknown>, source: TheorySource): AlignmentFinding[] {
  const findings: AlignmentFinding[] = [];
  const core = record(payload.core_theory) ? payload.core_theory as Record<string, unknown> : {};
  const selectionMode = str(core.selectionMode, "FORMAL_THEORY");
  const conceptualOnly = selectionMode === "CONCEPTUAL_FRAMEWORK_ONLY";
  const supporting = list(payload.supporting_theories);
  const paths = list(record(payload.mechanism_model) ? (payload.mechanism_model as Record<string, unknown>).paths : []);
  const constructs = list(payload.construct_dictionary);
  const hypotheses = list(payload.hypotheses_or_propositions);
  const bp = source.blueprintPayload;
  const questions = list(bp.questions);
  const gaps = list(bp.gaps);
  const gapText = gaps.map((g) => str(record(g) ? (g as Record<string, unknown>).statement : "", "")).join(" ");
  const pathRqKeys = new Set(paths.map((p) => str(record(p) ? (p as Record<string, unknown>).relatedRqKey : "", "")).filter(Boolean));
  const pathTargets = new Set(paths.map((p) => str(record(p) ? (p as Record<string, unknown>).targetConstruct : "", "")).filter(Boolean));
  const pathSources = new Set(paths.map((p) => str(record(p) ? (p as Record<string, unknown>).sourceConstruct : "", "")).filter(Boolean));
  const constructNames = new Set(constructs.map((c) => str(record(c) ? (c as Record<string, unknown>).canonicalName : "", "")).filter(Boolean));

  if (!conceptualOnly && !str(core.theoryKey)) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "THEORY_NOT_LINKED_TO_GAP", chain: "Gap→Core Theory", description: "尚未設定核心理論；研究 Gap 未連結任何理論解釋。", suggestion: "從候選理論池選定核心理論，或正式選擇 Conceptual Framework Only 並說明理由。" });
  if (conceptualOnly && !str(core.reason)) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "THEORY_NOT_LINKED_TO_GAP", chain: "Gap→Core Theory", description: "選擇 Conceptual Framework Only 但未提供理由。", suggestion: "說明為何不套用正式理論（探索性／設計科學／現有理論無法解釋）。" });
  if (supporting.length > 2) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "EXCESSIVE_THEORY_STACKING", chain: "Core Theory→Supporting", description: `Supporting Theories 超過 2 個（${supporting.length}）。`, suggestion: "精簡至 0–2 個真正增加解釋價值的支持理論。" });
  const coreCount = list(payload.core_theory) ? 1 : 0;
  if (coreCount > 1) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "EXCESSIVE_THEORY_STACKING", chain: "Core Theory", description: "Core Theory 超過 1 個。", suggestion: "以 1 個為主（最多 2 個），避免理論堆疊。" });

  for (const c of constructs) {
    const row = record(c) ? c : {};
    if (!str(row.conceptualDefinition)) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "CONSTRUCT_WITHOUT_DEFINITION", chain: `Construct→Definition（${str(row.constructId, "?")}）`, description: `構念「${str(row.canonicalName, str(row.constructId, "?"))}」尚無概念定義。`, suggestion: "補上概念性定義（操作型定義留待研究工具階段）。" });
  }
  const nameCount = new Map<string, number>();
  for (const c of constructs) { const n = str(record(c) ? (c as Record<string, unknown>).canonicalName : "", ""); if (n) nameCount.set(n, (nameCount.get(n) ?? 0) + 1); }
  for (const [name, count] of nameCount) if (count > 1) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "DUPLICATED_CONSTRUCTS", chain: `Construct Dictionary`, description: `構念「${name}」重複 ${count} 次。`, suggestion: "合併同義構念並保留單一 canonical name。" });

  for (const p of paths) {
    const row = record(p) ? p : {};
    if (!conceptualOnly && !str(row.theoryKey)) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "MECHANISM_WITHOUT_THEORY", chain: `Mechanism（${str(row.pathId, "?")}）`, description: `機制路徑 ${str(row.pathId, "?")} 未連結任何理論。`, suggestion: "指定該路徑所依據的理論（或標示 CONCEPTUAL）。" });
    if (str(row.sourceConstruct) && !constructNames.has(str(row.sourceConstruct))) findings.push({ severity: "MINOR_ALIGNMENT_GAP", code: "CONSTRUCT_WITHOUT_DEFINITION", chain: `Mechanism（${str(row.pathId, "?")}）→${str(row.sourceConstruct)}`, description: `路徑來源構念「${str(row.sourceConstruct)}」不在構念字典中。`, suggestion: "在構念字典加入該構念。" });
  }
  for (const q of questions) {
    const row = record(q) ? q : {};
    const rqKey = str(row.rqKey, "?");
    const question = str(row.question, "");
    const linked = pathRqKeys.has(rqKey);
    const exploratory = /探索|explorat|質性|設計科學|develop|設計/iu.test(question) || hypotheses.some((h) => { const hr = record(h) ? h : {}; return str(hr.rqKey) === rqKey && str(hr.kind) === "PROPOSITION"; });
    if (!linked && !exploratory) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "RQ_WITHOUT_MECHANISM", chain: `RQ（${rqKey}）→Mechanism`, description: `${rqKey} 未連結任何作用機制路徑，也未標示為探索性目的。`, suggestion: "將該 RQ 連結至機制路徑，或標示為探索性 RQ（以 Proposition 處理）。" });
  }
  const outcomes = constructs.filter((c) => { const row = record(c) ? c : {}; return ["DEPENDENT_VARIABLE", "LEARNING_OUTCOME"].includes(str(row.role)); });
  for (const o of outcomes) {
    const row = record(o) ? o : {};
    const name = str(row.canonicalName, "");
    if (name && !pathTargets.has(name)) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "OUTCOME_NOT_EXPLAINED", chain: `Outcome→Mechanism（${name}）`, description: `結果構念「${name}」沒有機制路徑指向它，理論無法解釋該結果。`, suggestion: "新增以該構念為 target 的機制路徑（或標示為探索性觀察結果）。" });
  }
  if (/長期|保留|retention|追蹤|遷移|延宕/iu.test(gapText) && ![...pathTargets, ...pathSources].some((n) => /長期|保留|retention|追蹤|遷移|延宕/iu.test(n))) {
    findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "OUTCOME_NOT_EXPLAINED", chain: "Gap→Time Mechanism", description: "研究 Gap 強調長期保留/時間機制，但模型中沒有 Retention 或時間相關構念。", suggestion: "加入 retention／長期效果構念與對應機制路徑。" });
  }
  for (const h of hypotheses) {
    const row = record(h) ? h : {};
    const key = str(row.hypothesisKey, str(row.key, "?"));
    const kind = str(row.kind, "HYPOTHESIS");
    const statement = str(row.statement, "");
    if (kind === "HYPOTHESIS") {
      if (!str(row.coreTheoryKey) && !str(row.mechanismPathId)) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "HYPOTHESIS_WITHOUT_EVIDENCE", chain: `Hypothesis（${key}）`, description: `${key} 未連結核心理論或機制路徑。`, suggestion: "連結 core theory 與 mechanism path。" });
      const sup = list(row.supportingLiterature);
      if (sup.length === 0) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "HYPOTHESIS_WITHOUT_EVIDENCE", chain: `Hypothesis（${key}）`, description: `${key} 沒有 supporting literature。`, suggestion: "加入至少一筆既有文獻作為支持（不虛構文獻）。" });
    }
    if (CAUSAL_STRONG_WORDS.test(statement) && !CAUSAL_SOFT_WORDS.test(statement)) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "CAUSAL_CLAIM_UNSUPPORTED", chain: `Causal Language（${key}）`, description: `${key} 使用強因果語句（causes/leads to/導致…），但研究設計尚未確認因果推論能力。`, suggestion: "改為審慎語句：may influence／is associated with／is expected to affect／可能影響。" });
  }
  if (paths.length === 0 && !conceptualOnly) findings.push({ severity: "MAJOR_ALIGNMENT_GAP", code: "MECHANISM_WITHOUT_THEORY", chain: "Mechanism Model", description: "尚未建立任何作用機制路徑。", suggestion: "建立 Intervention→Process→Outcome 機制鏈。" });
  return findings;
}

// ---------- Gate checks ----------
const GATE_CHECKS: { key: string; label: string; check: (ctx: { payload: Record<string, unknown>; source: TheorySource; findings: AlignmentFinding[]; evidenceLinks: Record<string, unknown>[]; hasBlueprintV2Approved: boolean }) => { pass: boolean; detail: string } }[] = [
  { key: "core_theory_selected", label: "已選定核心理論或正式說明不套用理論", check: (c) => { const core = record(c.payload.core_theory) ? c.payload.core_theory as Record<string, unknown> : {}; const conceptual = str(core.selectionMode) === "CONCEPTUAL_FRAMEWORK_ONLY"; return { pass: Boolean(str(core.theoryKey)) || conceptual, detail: conceptual ? "已選擇 Conceptual Framework Only。" : str(core.theoryKey) ? `Core Theory：${str(core.theoryName)}` : "尚未選定。" }; } },
  { key: "core_theory_evidence", label: "核心理論有 Evidence 支持（全文閱讀為佳）", check: (c) => { if (str(record(c.payload.core_theory) ? (c.payload.core_theory as Record<string, unknown>).selectionMode : "") === "CONCEPTUAL_FRAMEWORK_ONLY") return { pass: true, detail: "Conceptual Framework Only 不要求正式理論文獻。" }; const coreLinks = c.evidenceLinks.filter((l) => str(l.targetType) === "THEORY" && str(l.targetRef) === str(record(c.payload.core_theory) ? (c.payload.core_theory as Record<string, unknown>).theoryKey : "")); const fulltext = coreLinks.filter((l) => str(l.readingStatus) === "FULLTEXT_REVIEWED"); return { pass: fulltext.length > 0, detail: `核心理論文獻 ${coreLinks.length} 筆（全文已讀 ${fulltext.length} 筆）。` }; } },
  { key: "mechanism_model_complete", label: "已建立完整 Mechanism Model", check: (c) => { const paths = list(record(c.payload.mechanism_model) ? (c.payload.mechanism_model as Record<string, unknown>).paths : []); return { pass: paths.length >= 1, detail: `機制路徑 ${paths.length} 條。` }; } },
  { key: "constructs_defined", label: "主要構念均有概念定義", check: (c) => { const constructs = list(c.payload.construct_dictionary); const missing = constructs.filter((x) => !str(record(x) ? (x as Record<string, unknown>).conceptualDefinition : "")); return { pass: constructs.length > 0 && missing.length === 0, detail: `構念 ${constructs.length} 個（缺定義 ${missing.length}）。` }; } },
  { key: "rq_mechanism_link", label: "每個 RQ 均連結機制或探索目的", check: (c) => { const questions = list(c.source.blueprintPayload.questions); const paths = list(record(c.payload.mechanism_model) ? (c.payload.mechanism_model as Record<string, unknown>).paths : []); const pathKeys = new Set(paths.map((p) => str(record(p) ? (p as Record<string, unknown>).relatedRqKey : "")).filter(Boolean)); const missing = questions.filter((q) => !pathKeys.has(str(record(q) ? (q as Record<string, unknown>).rqKey : "")) && !/探索|explorat|質性|設計科學|develop|設計/iu.test(str(record(q) ? (q as Record<string, unknown>).question : ""))); return { pass: missing.length === 0, detail: missing.length ? `${missing.length} 個 RQ 未連結機制。` : "全部 RQ 已連結。" }; } },
  { key: "hypotheses_linked", label: "每個假設均連結 Theory／Mechanism／Evidence", check: (c) => { const hypotheses = list(c.payload.hypotheses_or_propositions); const bad = hypotheses.filter((h) => { const row = record(h) ? h : {}; return str(row.kind) === "HYPOTHESIS" && (!str(row.coreTheoryKey) && !str(row.mechanismPathId) || list(row.supportingLiterature).length === 0); }); return { pass: bad.length === 0, detail: bad.length ? `${bad.length} 個假設未完整連結。` : "全部假設已連結。" }; } },
  { key: "competing_checked", label: "已檢查競爭解釋", check: (c) => { const comp = list(c.payload.competing_explanations); return { pass: comp.length >= 1, detail: `競爭解釋 ${comp.length} 項。` }; } },
  { key: "boundary_identified", label: "已識別主要 Boundary Conditions", check: (c) => { const b = list(c.payload.boundary_conditions); return { pass: b.length >= 1, detail: `邊界條件 ${b.length} 項。` }; } },
  { key: "alignment_clean", label: "Alignment Check 無 MAJOR 未處理", check: (c) => { const major = c.findings.filter((f) => f.severity === "MAJOR_ALIGNMENT_GAP"); return { pass: major.length === 0, detail: major.length ? `${major.length} 個 MAJOR 待處理。` : "無 MAJOR 斷鏈。" }; } },
  { key: "conceptual_model_v1", label: "已建立 Conceptual Model v1.0", check: (c) => { const m = record(c.payload.conceptual_model) ? c.payload.conceptual_model as Record<string, unknown> : {}; const nodes = list(m.nodes); return { pass: str(m.modelVersion) === "1.0" && nodes.length >= 1, detail: `Conceptual Model ${str(m.modelVersion, "—")}（節點 ${nodes.length}）。` }; } },
  { key: "blueprint_v2_approved", label: "已產生 Research Blueprint v2 Approved", check: (c) => ({ pass: c.hasBlueprintV2Approved, detail: c.hasBlueprintV2Approved ? "藍圖 v2 Approved 已回寫。" : "尚未回寫（請先執行「回寫研究藍圖」）。" }) },
  { key: "theory_literature_traceable", label: "核心理論文獻可在文獻中心/Zotero 追溯", check: (c) => { const core = record(c.payload.core_theory) ? c.payload.core_theory as Record<string, unknown> : {}; if (str(core.selectionMode) === "CONCEPTUAL_FRAMEWORK_ONLY") return { pass: true, detail: "Conceptual Framework Only。" }; const coreLinks = c.evidenceLinks.filter((l) => str(l.targetType) === "THEORY" && str(l.targetRef) === str(core.theoryKey)); const withLit = coreLinks.filter((l) => Boolean(l.literatureId)); const traceable = withLit.filter((l) => Boolean(l.zoteroItemKey) || Boolean(l.citationSourceId)); return { pass: withLit.length > 0, detail: traceable.length ? `核心理論文獻 ${withLit.length} 筆（${traceable.length} 筆已接 Zotero/CitationSource）。` : "核心理論已有文獻連結，但尚未接 Zotero/CitationSource。" }; } },
];

// ---------- 檢視 ----------
export type TheoryMechanismView = {
  ok: boolean;
  exists: boolean;
  locked: boolean;
  gapValidated: boolean;
  missingResearchProject?: boolean;
  analysis?: { id: string; status: string; selectionMode: string | null; currentVersion: number; versionLabel: string; primaryRoute: string | null; updatedAt: string; gateState: Record<string, unknown> };
  sections?: Record<string, unknown>;
  candidates?: Record<string, unknown>[];
  theoryEvidenceLinks?: Record<string, unknown>[];
  alignment?: { checkedAt?: string | null; findings: AlignmentFinding[] } | null;
  gatePreview?: { total: number; passed: number; failed: { key: string; label: string; detail: string }[] };
  missingInputs?: { key: string; label: string; affects: string }[];
  sourceInfo?: { blueprintVersion: number; gapStatus: string; projectTitle: string };
  versions?: { id: string; versionNumber: number; versionLabel: string; reason: string; createdAt: string }[];
};

export async function getTheoryMechanism(tenant: ResearchTenant, input: { userId: string }): Promise<TheoryMechanismView> {
  return withClient(async (client) => {
    const source = await loadSource(client, tenant);
    let ensured;
    try { ensured = await ensureTheoryAnalysis(client, tenant, { userId: input.userId, source }); }
    catch (error) {
      if (error instanceof TheoryMechanismRepositoryError && error.code === "research_project_required") {
        return { ok: true, exists: false, locked: false, gapValidated: source.gapStatus === "VALIDATED", missingResearchProject: true };
      }
      throw error;
    }
    const analysisRow = (await client.query(`SELECT id, status, selection_mode AS "selectionMode", current_version_number AS "currentVersion", primary_route AS "primaryRoute", gate_state AS "gateState", source_hash AS "sourceHash", updated_at AS "updatedAt" FROM theory_mechanism_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0] as Record<string, unknown> | undefined;
    if (!analysisRow) return { ok: true, exists: false, locked: false, gapValidated: source.gapStatus === "VALIDATED" };
    const analysisId = text(analysisRow.id);
    const latest = await client.query(`SELECT id, version_number AS "versionNumber", version_label AS "versionLabel", payload FROM theory_mechanism_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
    const latestVersion = latest.rows[0] as Record<string, unknown> | undefined;
    const payload = latestVersion && record(latestVersion.payload) ? latestVersion.payload as Record<string, unknown> : {};
    const sectionState = record(analysisRow.gateState) ? analysisRow.gateState : {};
    const alignment = record(sectionState.alignment) ? sectionState.alignment as { checkedAt?: string; findings: AlignmentFinding[] } : null;
    const findings = alignment?.findings ?? runAlignmentCheck(payload, source);
    const candidates = (await client.query(`SELECT theory_key AS "theoryKey", theory_name AS "theoryName", theory_type AS "theoryType", original_domain AS "originalDomain", core_constructs AS "coreConstructs", explanatory_mechanism AS "explanatoryMechanism", related_rq_keys AS "relatedRqKeys", related_gap_ids AS "relatedGapIds", fit_breakdown AS "fitBreakdown", fit_score AS "fitScore", fit_rationale AS "fitRationale", selection_status AS "selectionStatus", selection_reason AS "selectionReason", limitations, route_fit AS "routeFit", fulltext_evidence_status AS "fulltextEvidenceStatus" FROM theory_candidates WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY fit_score DESC NULLS LAST`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
    const evidenceLinks = (await client.query(`SELECT id, target_type AS "targetType", target_ref AS "targetRef", literature_id AS "literatureId", citation_source_id AS "citationSourceId", zotero_item_key AS "zoteroItemKey", source_location AS "sourceLocation", reading_status AS "readingStatus", verification_status AS "verificationStatus", note FROM theory_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
    const versions = (await client.query(`SELECT id, version_number AS "versionNumber", version_label AS "versionLabel", reason, created_at AS "createdAt" FROM theory_mechanism_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 50`, [tenant.workspaceId, tenant.projectId, analysisId])).rows.map((v: Record<string, unknown>) => ({ id: text(v.id), versionNumber: int(v.versionNumber), versionLabel: text(v.versionLabel), reason: text(v.reason), createdAt: text(v.createdAt) }));
    const hasBlueprintV2Approved = Boolean((await client.query(`SELECT id FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label='v3.0 Theory & Mechanism Approved' LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0]);
    const results = GATE_CHECKS.map((check) => ({ key: check.key, label: check.label, ...check.check({ payload, source, findings, evidenceLinks, hasBlueprintV2Approved }) }));
    const failed = results.filter((r) => !r.pass);
    const missingInputs: { key: string; label: string; affects: string }[] = [];
    if (!str(record(source.blueprintPayload.research_identity) ? (source.blueprintPayload.research_identity as Record<string, unknown>).chineseTitle : "")) missingInputs.push({ key: "approved_topic", label: "Approved Topic", affects: "核心理論與題目契合評估" });
    if (list(source.blueprintPayload.questions).length === 0) missingInputs.push({ key: "research_questions", label: "Research Questions", affects: "RQ→機制連結檢查" });
    if (list(source.blueprintPayload.gaps).length === 0 && source.gapStatus !== "VALIDATED") missingInputs.push({ key: "validated_gap", label: "Validated Research Gap", affects: "理論選擇（Gap Fit）" });
    if (source.theoryRoleLiterature.length === 0) missingInputs.push({ key: "theory_literature", label: "THEORY 角色文獻", affects: "核心理論 Evidence 支持" });
    const sections = {
      core_theory: payload.core_theory ?? null,
      supporting_theories: payload.supporting_theories ?? [],
      rejected_theories: payload.rejected_theories ?? [],
      competing_theories: payload.competing_theories ?? [],
      mechanism_model: payload.mechanism_model ?? { paths: [], note: "" },
      construct_dictionary: payload.construct_dictionary ?? [],
      hypotheses_or_propositions: payload.hypotheses_or_propositions ?? [],
      competing_explanations: payload.competing_explanations ?? [],
      boundary_conditions: payload.boundary_conditions ?? [],
      conceptual_model: payload.conceptual_model ?? { modelVersion: "0.0", nodes: [], edges: [], status: "DRAFT" },
      unresolved_theory_issues: payload.unresolved_theory_issues ?? [],
      causal_language_warnings: payload.causal_language_warnings ?? [],
    };
    return {
      ok: true,
      exists: true,
      locked: text(analysisRow.status) === "LOCKED",
      gapValidated: source.gapStatus === "VALIDATED",
      analysis: {
        id: analysisId, status: text(analysisRow.status), selectionMode: analysisRow.selectionMode ? text(analysisRow.selectionMode) : null,
        currentVersion: int(analysisRow.currentVersion), versionLabel: latestVersion ? text(latestVersion.versionLabel) : "v0（尚未建立）",
        primaryRoute: analysisRow.primaryRoute ? text(analysisRow.primaryRoute) : null, updatedAt: text(analysisRow.updatedAt),
        gateState: record(analysisRow.gateState) ? analysisRow.gateState : {},
      },
      sections,
      candidates: candidates.map((r) => ({ ...r, fitBreakdown: record(r.fitBreakdown) ? r.fitBreakdown : {}, fitScore: int(r.fitScore) })),
      theoryEvidenceLinks: evidenceLinks,
      alignment: { checkedAt: alignment?.checkedAt ?? null, findings },
      gatePreview: { total: results.length, passed: results.length - failed.length, failed },
      missingInputs,
      sourceInfo: { blueprintVersion: source.blueprintVersion, gapStatus: source.gapStatus, projectTitle: source.projectTitle },
      versions,
    };
  });
}

// ---------- 建立初版快照（draft） ----------
async function createVersion(client: PoolClient, tenant: ResearchTenant, analysisId: string, userId: string, payload: Record<string, unknown>, reason: string, label: string) {
  const latest = await client.query(`SELECT id, version_number AS "versionNumber" FROM theory_mechanism_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
  const versionNumber = latest.rows[0] ? int((latest.rows[0] as Record<string, unknown>).versionNumber) + 1 : 1;
  const versionId = `tmv_${randomUUID()}`;
  await client.query(
    `INSERT INTO theory_mechanism_versions (id,workspace_id,project_id,analysis_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
     VALUES ($4,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,now())`,
    [tenant.workspaceId, tenant.projectId, analysisId, versionId, versionNumber, latest.rows[0] ? text((latest.rows[0] as Record<string, unknown>).id) : null, label, reason, hash(payload), JSON.stringify(payload), userId],
  );
  await client.query(`UPDATE theory_mechanism_analyses SET current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, versionNumber, analysisId]);
  return versionId;
}

export async function draftCandidates(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, tenant, "theory-draft");
      const source = await loadSource(client, tenant);
      const ensured = await ensureTheoryAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new TheoryMechanismRepositoryError("theory_lab_locked", 423);
      const analysisId = ensured.id;
      const candidates = buildCandidatePool(source);
      for (const c of candidates) {
        await client.query(
          `INSERT INTO theory_candidates (id,workspace_id,project_id,analysis_id,theory_key,theory_name,theory_type,original_domain,core_constructs,explanatory_mechanism,related_rq_keys,related_gap_ids,fit_breakdown,fit_score,fit_rationale,selection_status,fulltext_evidence_status,created_at,updated_at)
           VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,'CANDIDATE',$16,now(),now())
           ON CONFLICT (analysis_id, theory_key) DO UPDATE SET theory_name=EXCLUDED.theory_name, fit_breakdown=EXCLUDED.fit_breakdown, fit_score=EXCLUDED.fit_score, fit_rationale=EXCLUDED.fit_rationale, fulltext_evidence_status=EXCLUDED.fulltext_evidence_status, updated_at=now()`,
          [tenant.workspaceId, tenant.projectId, analysisId, `tcan_${randomUUID()}`, c.theoryKey, c.theoryName.slice(0, 300), c.theoryType, c.originalDomain, JSON.stringify(c.coreConstructs), c.explanatoryMechanism.slice(0, 2000), JSON.stringify(c.relatedRqKeys), JSON.stringify(c.relatedGapIds), JSON.stringify(c.fitBreakdown), c.fitScore, c.fitRationale.slice(0, 3000), c.fulltextEvidenceStatus],
        );
      }
      const payload = { contractVersion: "theory-mechanism/1.0.0", fit_disclaimer: FIT_DISCLAIMER, candidate_pool_generated_at: new Date().toISOString(), core_theory: null, supporting_theories: [], rejected_theories: [], competing_theories: [], mechanism_model: { paths: [], note: "" }, construct_dictionary: [], hypotheses_or_propositions: [], competing_explanations: [], boundary_conditions: [], conceptual_model: { modelVersion: "0.0", nodes: [], edges: [], status: "DRAFT" }, unresolved_theory_issues: [], causal_language_warnings: [] };
      await createVersion(client, tenant, analysisId, input.userId, payload, "建立候選理論池（由既有選題/Gap/文獻推導，不虛構理論）", "v0.1 Candidate Pool");
      const nextStatus = source.theoryRoleLiterature.length === 0 && candidates.every((c) => c.fulltextEvidenceStatus === "INSUFFICIENT_EVIDENCE") ? "THEORY_SEARCH_REQUIRED" : "MODEL_IN_PROGRESS";
      await client.query(`UPDATE theory_mechanism_analyses SET status=$3, selection_mode=COALESCE(selection_mode, 'FORMAL_THEORY'), updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, nextStatus, analysisId]);
      await audit(client, tenant, input.userId, "THEORY_CANDIDATES_DRAFTED", { analysisId, count: candidates.length });
      await client.query("COMMIT");
      return { ok: true, count: candidates.length, status: nextStatus, candidates };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---------- 區塊編輯（陣列整筆取代／物件合併） ----------
async function syncChildren(client: PoolClient, tenant: ResearchTenant, analysisId: string, section: string, payload: Record<string, unknown>) {
  const where = `${tenantWhere()} AND analysis_id=$3`;
  const baseParams = [tenant.workspaceId, tenant.projectId, analysisId];
  if (section === "construct_dictionary") {
    await client.query(`DELETE FROM research_constructs WHERE ${where}`, baseParams);
    for (const item of list(payload._items)) {
      const r = record(item) ? item : {};
      await client.query(`INSERT INTO research_constructs (id,workspace_id,project_id,analysis_id,construct_id,canonical_name,chinese_name,english_name,conceptual_definition,role,theory_source,unit_of_analysis,temporal_position,related_rq_key,related_hypothesis_key,operationalization_status,measurement_status,definition_conflict,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now(),now())`, [tenant.workspaceId, tenant.projectId, analysisId, `rcon_${randomUUID()}`, str(r.constructId, `C${Math.floor(Math.random() * 99999)}`), str(r.canonicalName, "MISSING").slice(0, 300), r.chineseName ? str(r.chineseName).slice(0, 300) : null, r.englishName ? str(r.englishName).slice(0, 300) : null, r.conceptualDefinition ? str(r.conceptualDefinition).slice(0, 8000) : null, str(r.role, "PROCESS_VARIABLE"), r.theorySource ? str(r.theorySource).slice(0, 300) : null, r.unitOfAnalysis ? str(r.unitOfAnalysis).slice(0, 300) : null, r.temporalPosition ? str(r.temporalPosition).slice(0, 300) : null, r.relatedRqKey ? str(r.relatedRqKey).slice(0, 100) : null, r.relatedHypothesisKey ? str(r.relatedHypothesisKey).slice(0, 100) : null, str(r.operationalizationStatus, "MISSING"), str(r.measurementStatus, "NOT_SPECIFIED"), r.definitionConflict === true]);
    }
  } else if (section === "mechanism_model") {
    await client.query(`DELETE FROM mechanism_paths WHERE ${where}`, baseParams);
    for (const item of list(payload.paths)) {
      const r = record(item) ? item : {};
      await client.query(`INSERT INTO mechanism_paths (id,workspace_id,project_id,analysis_id,path_id,source_construct,target_construct,relationship_type,expected_direction,mechanism_explanation,theory_key,related_rq_key,supporting_evidence,conflicting_evidence,status,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,now(),now())`, [tenant.workspaceId, tenant.projectId, analysisId, `mp_${randomUUID()}`, str(r.pathId, `P${Math.floor(Math.random() * 99999)}`), str(r.sourceConstruct, "MISSING").slice(0, 300), str(r.targetConstruct, "MISSING").slice(0, 300), r.relationshipType ? str(r.relationshipType).slice(0, 100) : null, str(r.expectedDirection, "POSITIVE"), r.mechanismExplanation ? str(r.mechanismExplanation).slice(0, 4000) : null, r.theoryKey ? str(r.theoryKey).slice(0, 120) : null, r.relatedRqKey ? str(r.relatedRqKey).slice(0, 100) : null, JSON.stringify(list(r.supportingEvidence)), JSON.stringify(list(r.conflictingEvidence)), str(r.status, "PROPOSED")]);
    }
  } else if (section === "hypotheses_or_propositions") {
    await client.query(`DELETE FROM formal_hypotheses WHERE ${where}`, baseParams);
    for (const item of list(payload._items)) {
      const r = record(item) ? item : {};
      await client.query(`INSERT INTO formal_hypotheses (id,workspace_id,project_id,analysis_id,hypothesis_key,kind,statement,rq_key,objective_key,source_construct,target_construct,expected_direction,core_theory_key,mechanism_path_id,supporting_literature,conflicting_evidence,planned_test_status,hypothesis_not_required,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18,now(),now())`, [tenant.workspaceId, tenant.projectId, analysisId, `fh_${randomUUID()}`, str(r.hypothesisKey, str(r.key, `H${Math.floor(Math.random() * 999)}`)), str(r.kind, "HYPOTHESIS"), str(r.statement, "MISSING").slice(0, 6000), r.rqKey ? str(r.rqKey).slice(0, 100) : null, r.objectiveKey ? str(r.objectiveKey).slice(0, 100) : null, r.sourceConstruct ? str(r.sourceConstruct).slice(0, 300) : null, r.targetConstruct ? str(r.targetConstruct).slice(0, 300) : null, str(r.expectedDirection, "POSITIVE"), r.coreTheoryKey ? str(r.coreTheoryKey).slice(0, 120) : null, r.mechanismPathId ? str(r.mechanismPathId).slice(0, 120) : null, JSON.stringify(list(r.supportingLiterature)), JSON.stringify(list(r.conflictingEvidence)), str(r.plannedTestStatus, "PLANNED"), r.hypothesisNotRequired === true]);
    }
  } else if (section === "competing_explanations") {
    await client.query(`DELETE FROM competing_explanations WHERE ${where}`, baseParams);
    for (const item of list(payload._items)) {
      const r = record(item) ? item : {};
      await client.query(`INSERT INTO competing_explanations (id,workspace_id,project_id,analysis_id,explanation_key,explanation,related_outcome,supporting_basis,control_strategy_direction,unresolved_status,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,now(),now())`, [tenant.workspaceId, tenant.projectId, analysisId, `cex_${randomUUID()}`, str(r.explanationKey, `CE${Math.floor(Math.random() * 999)}`), str(r.explanation, "MISSING").slice(0, 4000), r.relatedOutcome ? str(r.relatedOutcome).slice(0, 1000) : null, r.supportingBasis ? str(r.supportingBasis).slice(0, 2000) : null, r.controlStrategyDirection ? str(r.controlStrategyDirection).slice(0, 2000) : null, str(r.unresolvedStatus, "UNRESOLVED")]);
    }
  } else if (section === "boundary_conditions") {
    await client.query(`DELETE FROM boundary_conditions WHERE ${where}`, baseParams);
    for (const item of list(payload._items)) {
      const r = record(item) ? item : {};
      await client.query(`INSERT INTO boundary_conditions (id,workspace_id,project_id,analysis_id,boundary_key,condition_type,condition_statement,implication,related_construct_keys,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9::jsonb,now(),now())`, [tenant.workspaceId, tenant.projectId, analysisId, `bnd_${randomUUID()}`, str(r.boundaryKey, `BC${Math.floor(Math.random() * 999)}`), r.conditionType ? str(r.conditionType).slice(0, 100) : null, str(r.conditionStatement, "MISSING").slice(0, 3000), r.implication ? str(r.implication).slice(0, 2000) : null, JSON.stringify(list(r.relatedConstructKeys))]);
    }
  } else if (section === "conceptual_model") {
    const modelVersion = str(payload.modelVersion, "1.0");
    const existing = await client.query(`SELECT id FROM conceptual_models WHERE ${where} AND model_version=$4`, [...baseParams, modelVersion]);
    if (existing.rows[0]) {
      await client.query(`UPDATE conceptual_models SET nodes=$4::jsonb, edges=$5::jsonb, feedback_loops=$6::jsonb, group_differences=$7::jsonb, time_points=$8::jsonb, status=$9, updated_at=now() WHERE id=$10 AND ${where}`, [tenant.workspaceId, tenant.projectId, analysisId, JSON.stringify(list(payload.nodes)), JSON.stringify(list(payload.edges)), JSON.stringify(list(payload.feedbackLoops)), JSON.stringify(list(payload.groupDifferences)), JSON.stringify(list(payload.timePoints)), str(payload.status, "DRAFT"), text(existing.rows[0].id)]);
    } else {
      await client.query(`INSERT INTO conceptual_models (id,workspace_id,project_id,analysis_id,model_version,model_label,nodes,edges,feedback_loops,group_differences,time_points,status,created_at,updated_at) VALUES ($4,$1,$2,$3,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,now(),now())`, [tenant.workspaceId, tenant.projectId, analysisId, `cm_${randomUUID()}`, modelVersion, str(payload.label, "Conceptual Model"), JSON.stringify(list(payload.nodes)), JSON.stringify(list(payload.edges)), JSON.stringify(list(payload.feedbackLoops)), JSON.stringify(list(payload.groupDifferences)), JSON.stringify(list(payload.timePoints)), str(payload.status, "DRAFT")]);
    }
  }
}

export async function editTheorySection(tenant: ResearchTenant, input: { userId: string; edit: TheoryMechanismSectionEdit }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const source = await loadSource(client, tenant);
      const ensured = await ensureTheoryAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new TheoryMechanismRepositoryError("theory_lab_locked", 423);
      const analysisId = ensured.id;
      const latest = await client.query(`SELECT payload FROM theory_mechanism_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : { contractVersion: "theory-mechanism/1.0.0" };
      const existingSection = payload[input.edit.section];
      if (input.edit.section === "mechanism_model") {
        payload.mechanism_model = { ...(record(existingSection) ? existingSection : {}), ...input.edit.payload, _updatedAt: new Date().toISOString() };
      } else if (Array.isArray(existingSection)) {
        const items = Array.isArray(input.edit.payload._items) ? input.edit.payload._items : Array.isArray(input.edit.payload.items) ? input.edit.payload.items : null;
        if (items) payload[input.edit.section] = items;
      } else if (input.edit.section === "core_theory") {
        const merged = { ...(record(existingSection) ? existingSection : {}), ...input.edit.payload };
        payload.core_theory = merged;
        const mode = str(merged.selectionMode, "");
        if (mode) await client.query(`UPDATE theory_mechanism_analyses SET selection_mode=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, mode === "CONCEPTUAL_FRAMEWORK_ONLY" ? "CONCEPTUAL_FRAMEWORK_ONLY" : "FORMAL_THEORY", analysisId]);
      } else {
        payload[input.edit.section] = { ...(record(existingSection) ? existingSection : {}), ...input.edit.payload, _updatedAt: new Date().toISOString() };
      }
      await syncChildren(client, tenant, analysisId, input.edit.section, input.edit.payload);
      await createVersion(client, tenant, analysisId, input.userId, payload, input.edit.reason || `編輯 ${input.edit.section}`, `v${int((await client.query(`SELECT current_version_number AS "n" FROM theory_mechanism_analyses WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, analysisId])).rows[0]?.["n"]) + 1} ${input.edit.section}`);
      if (ensured.status === "DRAFT" || ensured.status === "MODEL_IN_PROGRESS" || ensured.status === "THEORY_SEARCH_REQUIRED" || ensured.status === "EVIDENCE_INCOMPLETE" || ensured.status === "REVISION_REQUIRED" || ensured.status === "OUTDATED") {
        await client.query(`UPDATE theory_mechanism_analyses SET status='MODEL_IN_PROGRESS', updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, analysisId]);
      }
      await audit(client, tenant, input.userId, "THEORY_SECTION_EDITED", { analysisId, section: input.edit.section });
      await client.query("COMMIT");
      return { ok: true, analysisId };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---------- 候選理論狀態 ----------
export async function updateTheorySelection(tenant: ResearchTenant, input: { userId: string; theoryKey: string; selectionStatus: CandidateStatus; reason?: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const ensured = await ensureTheoryAnalysis(client, tenant, { userId: input.userId, source: await loadSource(client, tenant) });
      if (ensured.status === "LOCKED") throw new TheoryMechanismRepositoryError("theory_lab_locked", 423);
      const result = await client.query(`UPDATE theory_candidates SET selection_status=$4, selection_reason=$5, updated_at=now() WHERE ${tenantWhere()} AND analysis_id=$3 AND theory_key=$6`, [tenant.workspaceId, tenant.projectId, ensured.id, input.selectionStatus, input.reason ?? null, input.theoryKey]);
      if (!result.rowCount) throw new TheoryMechanismRepositoryError("theory_candidate_not_found", 404);
      await audit(client, tenant, input.userId, "THEORY_SELECTION_UPDATED", { analysisId: ensured.id, theoryKey: input.theoryKey, selectionStatus: input.selectionStatus });
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---------- 理論證據連結（僅 ID 關聯既有文獻） ----------
export async function linkTheoryEvidence(tenant: ResearchTenant, input: { userId: string; links: { targetType: string; targetRef: string; literatureId?: string; citationSourceId?: string; zoteroItemKey?: string; sourceLocation?: string; readingStatus?: string; verificationStatus?: string; note?: string }[] }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const ensured = await ensureTheoryAnalysis(client, tenant, { userId: input.userId, source: await loadSource(client, tenant) });
      if (ensured.status === "LOCKED") throw new TheoryMechanismRepositoryError("theory_lab_locked", 423);
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
          `INSERT INTO theory_evidence_links (id,workspace_id,project_id,analysis_id,target_type,target_ref,literature_id,citation_source_id,zotero_item_key,source_location,reading_status,verification_status,note,created_at)
           VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())`,
          [tenant.workspaceId, tenant.projectId, analysisId, `tel_${randomUUID()}`, link.targetType, link.targetRef, link.literatureId, link.citationSourceId ?? (citation.rows[0] ? text((citation.rows[0] as Record<string, unknown>).id) : null), link.zoteroItemKey ?? (lit.rows[0] ? text((lit.rows[0] as Record<string, unknown>).zoteroItemKey) : null), link.sourceLocation ?? null, link.readingStatus ?? "ABSTRACT_REVIEWED", link.verificationStatus ?? "UNVERIFIED", link.note ?? null],
        );
        linked += 1;
      }
      await audit(client, tenant, input.userId, "THEORY_EVIDENCE_LINKED", { analysisId, count: linked });
      await client.query("COMMIT");
      return { ok: true, linked };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---------- Alignment Check ----------
export async function runTheoryAlignment(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const source = await loadSource(client, tenant);
      const ensured = await ensureTheoryAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new TheoryMechanismRepositoryError("theory_lab_locked", 423);
      const analysisId = ensured.id;
      const latest = await client.query(`SELECT payload FROM theory_mechanism_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const findings = runAlignmentCheck(payload, source);
      const alignmentState = { checkedAt: new Date().toISOString(), findings };
      const existingGate = await client.query(`SELECT gate_state AS "g" FROM theory_mechanism_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      const gateState = existingGate.rows[0] && record((existingGate.rows[0] as Record<string, unknown>).g) ? (existingGate.rows[0] as Record<string, unknown>).g as Record<string, unknown> : {};
      await client.query(`UPDATE theory_mechanism_analyses SET gate_state=$3::jsonb, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify({ ...gateState, alignment: alignmentState }), analysisId]);
      await audit(client, tenant, input.userId, "THEORY_ALIGNMENT_CHECKED", { analysisId, major: findings.filter((f) => f.severity === "MAJOR_ALIGNMENT_GAP").length });
      await client.query("COMMIT");
      return { ok: true, checkedAt: alignmentState.checkedAt, findings };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---------- 回寫 Research Blueprint v2 Approved（不覆蓋 v1/v2 Draft） ----------
export async function writebackBlueprintApproved(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const source = await loadSource(client, tenant);
      const ensured = await ensureTheoryAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new TheoryMechanismRepositoryError("theory_lab_locked", 423);
      const analysisId = ensured.id;
      const latest = await client.query(`SELECT payload FROM theory_mechanism_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const blueprint = await client.query(`SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!blueprint.rows[0]) throw new TheoryMechanismRepositoryError("blueprint_required", 422);
      const blueprintId = text((blueprint.rows[0] as Record<string, unknown>).id);
      const latestBp = await client.query(`SELECT payload FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      const bpPayload = latestBp.rows[0] && record((latestBp.rows[0] as Record<string, unknown>).payload) ? (latestBp.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const theoryLinks = (await client.query(`SELECT target_type AS "targetType", target_ref AS "targetRef", literature_id AS "literatureId", citation_source_id AS "citationSourceId", zotero_item_key AS "zoteroItemKey", source_location AS "sourceLocation", reading_status AS "readingStatus", verification_status AS "verificationStatus" FROM theory_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, analysisId])).rows.map((r: Record<string, unknown>) => ({ targetType: text(r.targetType), targetRef: text(r.targetRef), literatureId: r.literatureId ? text(r.literatureId) : null, citationSourceId: r.citationSourceId ? text(r.citationSourceId) : null, zoteroItemKey: r.zoteroItemKey ? text(r.zoteroItemKey) : null, sourceLocation: r.sourceLocation ? text(r.sourceLocation) : null, readingStatus: text(r.readingStatus), verificationStatus: text(r.verificationStatus) }));
      const v2Payload: Record<string, unknown> = {
        ...bpPayload,
        validated_core_theory: payload.core_theory ?? null,
        supporting_theories: payload.supporting_theories ?? [],
        rejected_theories: payload.rejected_theories ?? [],
        mechanism_model: payload.mechanism_model ?? { paths: [], note: "" },
        construct_dictionary: payload.construct_dictionary ?? [],
        hypotheses_or_propositions: payload.hypotheses_or_propositions ?? [],
        competing_explanations: payload.competing_explanations ?? [],
        boundary_conditions: payload.boundary_conditions ?? [],
        conceptual_model_version: str(record(payload.conceptual_model) ? (payload.conceptual_model as Record<string, unknown>).modelVersion : "", "0.0"),
        theory_evidence_links: theoryLinks,
        unresolved_theory_issues: payload.unresolved_theory_issues ?? [],
        theory_mechanism: { approved_at: new Date().toISOString(), analysis_id: analysisId, fit_disclaimer: FIT_DISCLAIMER },
      };
      const bpLatest = await client.query(`SELECT id, version_number AS "versionNumber" FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
      const versionNumber = bpLatest.rows[0] ? int((bpLatest.rows[0] as Record<string, unknown>).versionNumber) + 1 : 1;
      const versionId = `rbpv_${randomUUID()}`;
      await client.query(
        `INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
         VALUES ($4,$1,$2,$3,$4,$5,$6,'v3.0 Theory & Mechanism Approved','由理論與機制實驗室回寫（不覆蓋 v1/v2 Draft）',$7,$8::jsonb,$9,now())`,
        [tenant.workspaceId, tenant.projectId, blueprintId, versionId, versionNumber, bpLatest.rows[0] ? text((bpLatest.rows[0] as Record<string, unknown>).id) : null, hash(v2Payload), JSON.stringify(v2Payload), input.userId],
      );
      await client.query(`UPDATE research_blueprints SET current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, versionNumber, blueprintId]);
      await audit(client, tenant, input.userId, "BLUEPRINT_V2_APPROVED_WRITTEN", { analysisId, blueprintVersionId: versionId, versionNumber });
      await client.query("COMMIT");
      return { ok: true, blueprintVersionId: versionId, versionNumber };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---------- 鎖定 Gate ----------
export async function lockTheoryModel(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const source = await loadSource(client, tenant);
      const ensured = await ensureTheoryAnalysis(client, tenant, { userId: input.userId, source });
      if (ensured.status === "LOCKED") throw new TheoryMechanismRepositoryError("theory_lab_locked", 423);
      const analysisId = ensured.id;
      const latest = await client.query(`SELECT payload FROM theory_mechanism_versions WHERE ${tenantWhere()} AND analysis_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, analysisId]);
      const payload = latest.rows[0] && record((latest.rows[0] as Record<string, unknown>).payload) ? (latest.rows[0] as Record<string, unknown>).payload as Record<string, unknown> : {};
      const findings = runAlignmentCheck(payload, source);
      const evidenceLinks = (await client.query(`SELECT target_type AS "targetType", target_ref AS "targetRef", literature_id AS "literatureId", citation_source_id AS "citationSourceId", zotero_item_key AS "zoteroItemKey", reading_status AS "readingStatus" FROM theory_evidence_links WHERE ${tenantWhere()} AND analysis_id=$3`, [tenant.workspaceId, tenant.projectId, analysisId])).rows as Record<string, unknown>[];
      const hasBlueprintV2Approved = Boolean((await client.query(`SELECT id FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label='v3.0 Theory & Mechanism Approved' LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0]);
      const results = GATE_CHECKS.map((check) => ({ key: check.key, label: check.label, ...check.check({ payload, source, findings, evidenceLinks, hasBlueprintV2Approved }) }));
      const failed = results.filter((r) => !r.pass);
      const gateState = { checkedAt: new Date().toISOString(), results };
      if (failed.length) {
        await client.query(`UPDATE theory_mechanism_analyses SET gate_state=$3::jsonb, status='REVISION_REQUIRED', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), analysisId]);
        await client.query("COMMIT");
        return { ok: false, status: "REVISION_REQUIRED", failed, gateState };
      }
      // 確保 v2 Approved 已回寫（Gate 12）
      let blueprintVersionId: string | null = null;
      if (!hasBlueprintV2Approved) {
        const writeback = await writebackBlueprintApproved(tenant, { userId: input.userId });
        blueprintVersionId = writeback.blueprintVersionId;
      } else {
        blueprintVersionId = text((await client.query(`SELECT id FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label='v3.0 Theory & Mechanism Approved' LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0]?.["id"]);
      }
      const gateId = `hg_${randomUUID()}`;
      await client.query(
        `INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
         VALUES ($4,$1,$2,$3,'THEORY_AND_MECHANISM_RELEASE','theory_mechanism_analysis',$5,$6,'APPROVED',$3,now(),now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.userId, gateId, analysisId, hash(gateState)],
      );
      await client.query(`UPDATE theory_mechanism_analyses SET gate_state=$3::jsonb, status='APPROVED', updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(gateState), analysisId]);
      await client.query(`INSERT INTO theory_mechanism_gates (id,workspace_id,project_id,analysis_id,analysis_version_id,checks,decision,human_gate_id,blueprint_v2_version_id,created_at) VALUES ($4,$1,$2,$3,$5,$6::jsonb,'LOCKED',$7,$8,now())`, [tenant.workspaceId, tenant.projectId, analysisId, `tmg_${randomUUID()}`, text((await client.query(`SELECT current_version_number AS "n" FROM theory_mechanism_analyses WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId])).rows[0]?.["n"]) || null, JSON.stringify(results), gateId, blueprintVersionId]);
      await audit(client, tenant, input.userId, "THEORY_AND_MECHANISM_LOCKED", { analysisId, humanGateId: gateId, blueprintVersionId });
      await client.query("COMMIT");
      return { ok: true, status: "APPROVED", humanGateId: gateId, gateState, blueprintVersionId };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---------- 版本比較 ----------
export async function compareTheoryVersions(tenant: ResearchTenant, input: { userId: string; fromVersion: number; toVersion: number }) {
  return withClient(async (client) => {
    const ensured = await ensureTheoryAnalysis(client, tenant, { userId: input.userId, source: await loadSource(client, tenant) });
    const rows = await client.query(`SELECT version_number AS "versionNumber", version_label AS "versionLabel", reason, payload FROM theory_mechanism_versions WHERE ${tenantWhere()} AND analysis_id=$3 AND version_number IN ($4,$5) ORDER BY version_number`, [tenant.workspaceId, tenant.projectId, ensured.id, input.fromVersion, input.toVersion]);
    if (rows.rows.length !== 2) throw new TheoryMechanismRepositoryError("theory_version_not_found", 404);
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
