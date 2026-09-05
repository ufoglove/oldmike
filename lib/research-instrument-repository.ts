import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import { callOpenClaw, type OpenClawMessage } from "./openclaw.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("instrument_studio_storage_unavailable");
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
function bool(value: unknown): boolean { return value === true || value === "true" || value === 1; }

async function audit(client: unknown, tenant: ResearchTenant, userId: string, eventType: string, detail: Record<string, unknown>) {
  const c = client as { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };
  try {
    await c.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,$5,$5,$6,'1.5.90',$7::jsonb,$8)`, [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, eventType, JSON.stringify(detail), hash({ eventType, detail })]);
  } catch { /* audit 失敗不阻擋主流程 */ }
}

async function gateApproved(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, tenant: ResearchTenant, gateType: string): Promise<boolean> {
  const gate = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, gateType]);
  return Boolean(gate.rows[0]);
}

// ---------- 來源載入：設計／矩陣／構念／RQ／倫理／路線 ----------
async function loadStudioSources(client: PoolClient, tenant: ResearchTenant) {
  const design = await client.query(`SELECT d.current_version_number AS "version", v.id AS "versionId", v.payload AS "payload" FROM research_design_analyses d LEFT JOIN research_design_versions v ON v.analysis_id=d.id AND v.version_number=d.current_version_number WHERE ${tenantWhere("d")} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const designPayload = design.rows[0] && record(design.rows[0].payload) ? design.rows[0].payload as Record<string, unknown> : {};
  const constructs = await client.query(`SELECT construct_id AS "constructId", canonical_name AS "canonicalName", chinese_name AS "chineseName", role, related_rq_key AS "relatedRqKey", related_hypothesis_key AS "relatedHypothesisKey" FROM research_constructs WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]);
  const questions = await client.query(`SELECT rq_key AS "rqKey", question FROM research_blueprint_questions WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]);
  const blueprint = await client.query(`SELECT b.id, v.payload AS "payload" FROM research_blueprints b LEFT JOIN research_blueprint_versions v ON v.blueprint_id=b.id AND v.version_number=b.current_version_number WHERE ${tenantWhere("b")} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const bpPayload = blueprint.rows[0] && record(blueprint.rows[0].payload) ? blueprint.rows[0].payload as Record<string, unknown> : {};
  const ethics = await client.query(`SELECT judgment_status AS "judgment", teacher_power_status AS "teacherPower", summary FROM research_ethics_assessments WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const ethicsSummary = ethics.rows[0] && record(ethics.rows[0].summary) ? ethics.rows[0].summary as Record<string, unknown> : {};
  const identity = record(bpPayload.research_identity) ? bpPayload.research_identity as Record<string, unknown> : {};
  const route = str(identity.primaryRoute, "");
  const analysisPlans = list(designPayload.analysis_plans);
  const matrix = list(designPayload.rq_data_analysis_matrix);
  const requirements = list(designPayload.measurement_requirements);
  return { design, designPayload, constructs: constructs.rows, questions: questions.rows, bpPayload, ethics: ethics.rows[0] as Record<string, unknown> | null, ethicsSummary, route, analysisPlans, matrix, requirements, matrixRows: matrix, designVersion: int(design.rows[0]?.version ?? 0), designVersionId: design.rows[0] ? text(design.rows[0].versionId) : null };
}
type StudioSources = Awaited<ReturnType<typeof loadStudioSources>>;

// ---------- 進入條件 ----------
async function entryChecks(client: PoolClient, tenant: ResearchTenant, source: StudioSources) {
  const designApproved = await gateApproved(client as never, tenant, "RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE");
  const ethicsScope = await gateApproved(client as never, tenant, "ETHICS_SCOPE_DETERMINED");
  const ethicsPackage = await gateApproved(client as never, tenant, "ETHICS_PACKAGE_PREPARED");
  const nstcReady = await gateApproved(client as never, tenant, "NSTC_APPLICATION_PACKAGE_READY");
  const moeReady = await gateApproved(client as never, tenant, "MOE_TPR_APPLICATION_PACKAGE_READY");
  const missing: string[] = [];
  if (!designApproved) missing.push("RESEARCH_DESIGN_AND_ANALYSIS_PLAN_APPROVED（研究設計需先核准）");
  if (!ethicsScope) missing.push("ETHICS_SCOPE_DETERMINED（需先完成倫理範圍判斷）");
  const route = source.route;
  let planningAccess = true;
  let executionAccess = false;
  let accessNote = "";
  if (route === "JOURNAL") {
    planningAccess = true;
    executionAccess = ethicsPackage;
    accessNote = ethicsPackage ? "JOURNAL：ETHICS_PACKAGE_PREPARED 已通過 → execution access。" : "JOURNAL：尚未通過 ETHICS_PACKAGE_PREPARED；可先做工具規劃草稿（planning access），不得啟動 Pilot。";
  } else if (route === "NSTC") {
    planningAccess = nstcReady;
    if (!nstcReady) missing.push("NSTC_APPLICATION_PACKAGE_READY（國科會申請包需先 Ready 才能做工具規劃）");
    accessNote = nstcReady ? "NSTC：PRE_AWARD_INSTRUMENT_PLANNING（尚未核定）——可建立工具與 Protocol 草稿，不得啟動 Pilot 或正式資料蒐集。" : "NSTC：申請包尚未 Ready。";
  } else if (route === "MOE_TEACHING_PRACTICE") {
    planningAccess = moeReady;
    if (!moeReady) missing.push("MOE_TPR_APPLICATION_PACKAGE_READY（教學實踐申請包需先 Ready 才能做工具規劃）");
    accessNote = moeReady ? "MOE：PRE_AWARD_INSTRUMENT_PLANNING（尚未核定）——可建立課程工具與 Protocol 草稿，不得把課程研究標示為已正式開始。" : "MOE：申請包尚未 Ready。";
  } else {
    accessNote = "路線未明（GENERAL）：以自我經費研究路徑提供工具規劃（planning access）；execution 需 ETHICS_PACKAGE_PREPARED。";
    executionAccess = ethicsPackage;
  }
  const entryOk = designApproved && ethicsScope;
  return {
    entryOk,
    missing,
    route,
    planningAccess: entryOk && planningAccess,
    executionAccess: entryOk && executionAccess,
    accessNote,
    ethics: source.ethics ? { judgment: str(source.ethics.judgment), teacherPower: str(source.ethics.teacherPower) } : null,
    grants: { nstcPackageReady: nstcReady, moePackageReady: moeReady, ethicsPackagePrepared: ethicsPackage },
  };
}

async function ensureProtocol(client: PoolClient, tenant: ResearchTenant, userId: string): Promise<string> {
  const existing = await client.query(`SELECT id FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  if (existing.rows[0]) return text((existing.rows[0] as Record<string, unknown>).id);
  const id = `sp_${randomUUID()}`;
  await client.query(`INSERT INTO study_protocols (id,workspace_id,project_id,status,current_version_number,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,'NOT_STARTED',0,$3,now(),now())`, [tenant.workspaceId, tenant.projectId, userId, id]);
  return id;
}

// ---------- 主讀取 ----------
export async function getInstrumentStudio(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const source = await loadStudioSources(client, tenant);
    const entry = await entryChecks(client, tenant, source);
    if (!entry.entryOk || !entry.planningAccess) {
      return { ok: true, locked: true, entry, sources: { designVersion: source.designVersion, route: source.route }, detail: null };
    }
    await ensureProtocol(client, tenant, input.userId);
    const [links, permissions, translations, scorings, catalog, blueprints, skills, qual, events, sensors, annotations, interventions, fidelities, schedules, fields, protocols, alignments, readiness] = await Promise.all([
      client.query(`SELECT id, catalog_item_id AS "catalogItemId", instrument_name AS "instrumentName", instrument_type AS "instrumentType", is_custom AS "isCustom", construct_id AS "constructId", construct_name AS "constructName", requirement_id AS "requirementId", rq_id AS "rqId", hypothesis_id AS "hypothesisId", variable_role AS "variableRole", purpose, language, time_points AS "timePoints", data_type AS "dataType", objective_or_subjective AS "objectiveOrSubjective", primary_or_secondary AS "primaryOrSecondary", readiness_status AS "readinessStatus", permission_status AS "permissionStatus", translation_status AS "translationStatus", scoring_status AS "scoringStatus", fit, status, notes FROM project_instrument_links WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM instrument_permissions WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM instrument_translations WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM instrument_scoring_specs WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT id, catalog_key AS "catalogKey", name, instrument_type AS "instrumentType", authors, year, doi, original_source AS "originalSource", instrument_status AS "instrumentStatus" FROM instrument_catalog_items WHERE workspace_id=$1 ORDER BY created_at`, [tenant.workspaceId]),
      client.query(`SELECT * FROM test_blueprints WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM skill_assessments WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM qualitative_instruments WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM digital_event_definitions WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM sensor_specifications WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM annotation_guidelines WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM intervention_materials WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM fidelity_plans WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM measurement_schedules WHERE ${tenantWhere()} ORDER BY sequence NULLS LAST, created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT * FROM data_capture_fields WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT id, status, current_version_number AS "currentVersion" FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT id, protocol_id AS "protocolId", version_number AS "version", version_label AS "versionLabel", reason, created_at AS "createdAt" FROM study_protocol_versions WHERE ${tenantWhere()} ORDER BY version_number DESC LIMIT 8`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT id, check_type AS "checkType", results, fatal_count AS "fatalCount", major_count AS "majorCount", status, checked_at AS "checkedAt" FROM protocol_alignment_results WHERE ${tenantWhere()} ORDER BY checked_at DESC LIMIT 4`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT id, items, overall, version FROM pilot_readiness_packages WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const latestProtocolVersion = await client.query(`SELECT id, version_number AS "version", payload, created_at AS "createdAt" FROM study_protocol_versions WHERE ${tenantWhere()} ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    const protocolVersionRows = await client.query(`SELECT id, protocol_id AS "protocolId", version_number AS "version", version_label AS "versionLabel", reason, created_at AS "createdAt" FROM study_protocol_versions WHERE ${tenantWhere()} ORDER BY version_number DESC LIMIT 8`, [tenant.workspaceId, tenant.projectId]);
    return {
      ok: true, locked: false, entry, sources: {
        designVersion: source.designVersion,
        designVersionId: source.designVersionId,
        route: source.route,
        questions: source.questions.map((r: Record<string, unknown>) => ({ rqKey: text(r.rqKey), question: text(r.question) })),
        matrixRows: source.matrixRows.map((r) => record(r) ? r as Record<string, unknown> : {}),
        requirementCount: source.requirements.length,
        analysisPlanCount: source.analysisPlans.length,
      },
      links: links.rows, permissions: permissions.rows, translations: translations.rows, scorings: scorings.rows,
      catalog: catalog.rows, blueprints: blueprints.rows, skills: skills.rows, qualitative: qual.rows,
      events: events.rows, sensors: sensors.rows, annotations: annotations.rows,
      interventions: interventions.rows, fidelities: fidelities.rows, schedules: schedules.rows,
      fields: fields.rows,
      protocol: protocols.rows[0] ?? null,
      protocolVersions: protocolVersionRows.rows,
      latestProtocol: latestProtocolVersion.rows[0] ?? null,
      readiness: readiness.rows[0] ?? null,
      alignmentResults: alignments.rows,
    };
  });
}

// ---------- Measurement Requirement Map 產生（依 RQ／矩陣；不虛構構念） ----------
export async function generateMeasurementMap(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const source = await loadStudioSources(client, tenant);
    const existing = await client.query(`SELECT rq_id AS "rqId", requirement_id AS "requirementId" FROM project_instrument_links WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    const haveRqs = new Set(existing.rows.map((r: Record<string, unknown>) => `${text(r.rqId)}|${text(r.requirementId)}`));
    // 來源 1：設計 measurement_requirements
    const requirementRows = list(source.designPayload.measurement_requirements).map((r) => record(r) ? r as Record<string, unknown> : {});
    // 來源 2：矩陣列（每個 RQ 至少一條路徑）
    const matrixRows = source.matrixRows.map((r) => record(r) ? r as Record<string, unknown> : {});
    const questionsByRq = new Map(source.questions.map((r: Record<string, unknown>) => [text(r.rqKey), text(r.question)]));
    const constructByRq = new Map<string, Record<string, unknown>>();
    for (const c of source.constructs as Record<string, unknown>[]) {
      const rq = str(c.relatedRqKey);
      if (rq && !constructByRq.has(rq)) constructByRq.set(rq, c);
    }
    let created = 0;
    const insertLink = async (linkId: string, rqId: string, requirementId: string, constructId: string | null, constructName: string, hypothesisId: string, variableRole: string, dataType: string, objectiveOrSubjective: string | null, primaryOrSecondary: string) => {
      await client.query(`INSERT INTO project_instrument_links (id,workspace_id,project_id,instrument_name,instrument_type,is_custom,construct_id,construct_name,requirement_id,rq_id,hypothesis_id,variable_role,data_type,objective_or_subjective,primary_or_secondary,readiness_status,status,created_by_user_id,created_at,updated_at)
        VALUES ($4,$1,$2,'（待選定工具）','STANDARDIZED_SCALE',true,$5,$6,$7,$8,$9,$10,$11,$12,$13,'REQUIREMENT_DEFINED','REQUIREMENT_ONLY',$3,now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.userId, linkId, constructId, constructName, requirementId, rqId, hypothesisId, variableRole, dataType, objectiveOrSubjective, primaryOrSecondary]);
    };
    for (const req of requirementRows) {
      const rqId = str(req.rqId, str(req.rqKey, `RQ_${created}`));
      const requirementId = str(req.requirementId, str(req.measurementRequirementId, `MR_${created + 1}`));
      if (haveRqs.has(`${rqId}|${requirementId}`)) continue;
      await insertLink(`pil_${randomUUID()}`, rqId, requirementId, str(req.constructId) || null, str(req.constructName), str(req.hypothesisId), str(req.variableRole), str(req.dataType), str(req.objectiveOrSubjective), str(req.primaryOrSecondary, "PRIMARY"));
      created += 1;
    }
    // 每個 RQ 若尚無任何 requirement 行 → 由矩陣建立一條（構念未知時誠實標 UNKNOWN）
    for (const row of matrixRows) {
      const rqId = str(row.rqId, str(row.rqKey));
      if (!rqId) continue;
      const requirementId = str(row.measurementRequirementId, `MR_${rqId}`);
      if (haveRqs.has(`${rqId}|${requirementId}`)) continue;
      const constructRow = constructByRq.get(rqId);
      await insertLink(`pil_${randomUUID()}`, rqId, requirementId, constructRow ? str(constructRow.constructId) : null, constructRow ? str(constructRow.canonicalName, str(constructRow.chineseName)) : "（構念待確認）", str(row.hypothesisOrPropositionId), str(row.constructId), str(row.dataType, "mixed"), null, str(row.primaryOrSecondary, "PRIMARY"));
      created += 1;
    }
    await audit(client, tenant, input.userId, "MEASUREMENT_MAP_GENERATED", { created, questions: questionsByRq.size });
    return { ok: true, created };
  });
}

// ---------- 候選工具：建立 catalog（workspace canonical）＋project link ----------
export async function addInstrumentCandidate(tenant: ResearchTenant, input: { userId: string; candidate: Record<string, unknown>; targetLinkId?: string }) {
  return withClient(async (client) => {
    const c = input.candidate;
    const name = str(c.name);
    if (!name) return { ok: false, error: "instrument_name_required" };
    const catalogKey = `ci_${hash({ name, authors: list(c.authors), year: int(c.year) }).slice(0, 16)}`;
    let catalogId = text((await client.query(`SELECT id FROM instrument_catalog_items WHERE workspace_id=$1 AND catalog_key=$2`, [tenant.workspaceId, catalogKey])).rows[0]?.id ?? "");
    if (!catalogId) {
      catalogId = `ici_${randomUUID()}`;
      const payload = { name, type: str(c.type, "STANDARDIZED_SCALE"), authors: list(c.authors), year: int(c.year) || null, originalSource: str(c.originalSource), doi: str(c.doi), sourceUrl: str(c.sourceUrl) };
      await client.query(`INSERT INTO instrument_catalog_items (id,workspace_id,catalog_key,name,instrument_type,authors,year,original_source,source_url,doi,instrument_status,metadata,created_by_user_id,created_at,updated_at)
        VALUES ($3,$1,$2,$4,$5,$6::jsonb,$7,$8,$9,$10,'DRAFT','{}',$11,now(),now())`, [tenant.workspaceId, catalogKey, catalogId, name, str(c.type, "STANDARDIZED_SCALE"), JSON.stringify(list(c.authors)), int(c.year) || null, str(c.originalSource), str(c.sourceUrl), str(c.doi), input.userId]);
      const versionPayload = { ...payload, version: 1 };
      await client.query(`INSERT INTO instrument_catalog_versions (id,workspace_id,catalog_item_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at) VALUES ($4,$1,$2,$2,1,'v1.0','候選工具建立',$3,$5::jsonb,$6,now())`, [tenant.workspaceId, catalogId, hash(versionPayload), `icv_${randomUUID()}`, JSON.stringify(versionPayload), input.userId]);
    }
    // link：新增或更新目標 link
    if (input.targetLinkId) {
      await client.query(`UPDATE project_instrument_links SET catalog_item_id=$3, instrument_name=$4, instrument_type=$5, is_custom=false, readiness_status='CANDIDATE_FOUND', status='CANDIDATE', updated_at=now() WHERE id=$6 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, catalogId, name, str(c.type, "STANDARDIZED_SCALE"), input.targetLinkId]);
      return { ok: true, catalogItemId: catalogId, linkId: input.targetLinkId, created: false };
    }
    // 若沒有目標 link：建立新的候選 link（construct/rq 由呼叫方帶入）
    const linkId = `pil_${randomUUID()}`;
    await client.query(`INSERT INTO project_instrument_links (id,workspace_id,project_id,catalog_item_id,instrument_name,instrument_type,is_custom,construct_id,construct_name,requirement_id,rq_id,hypothesis_id,variable_role,data_type,readiness_status,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,false,$7,$8,$9,$10,$11,$12,$13,'CANDIDATE_FOUND','CANDIDATE',$14,now(),now())`,
      [tenant.workspaceId, tenant.projectId, catalogId, linkId, name, str(c.type, "STANDARDIZED_SCALE"), str(c.constructId), str(c.constructName), str(c.requirementId), str(c.rqId), str(c.hypothesisId), str(c.variableRole), str(c.dataType), input.userId]);
    await audit(client, tenant, input.userId, "INSTRUMENT_CANDIDATE_ADDED", { catalogItemId: catalogId, linkId });
    return { ok: true, catalogItemId: catalogId, linkId, created: true };
  });
}

// ---------- 工具比較（內部 100 分比較；含聲明） ----------
export const FIT_WEIGHTS = [
  { key: "construct_fit", label: "Construct Fit", weight: 20 }, { key: "population_fit", label: "Population Fit", weight: 15 },
  { key: "context_fit", label: "Context Fit", weight: 10 }, { key: "reliability_evidence", label: "Reliability Evidence", weight: 10 },
  { key: "validity_evidence", label: "Validity Evidence", weight: 15 }, { key: "sensitivity", label: "Sensitivity／Responsiveness", weight: 10 },
  { key: "administration", label: "Administration Feasibility", weight: 5 }, { key: "language_cultural", label: "Language／Cultural Fit", weight: 5 },
  { key: "permission_cost", label: "Permission and Cost", weight: 5 }, { key: "analysis_compatibility", label: "Analysis Compatibility", weight: 5 },
] as const;

export const FIT_DISCLAIMER = "此分數為網站內部工具選擇比較分數，不代表該工具已在本研究樣本中完成信效度驗證。";

export async function compareCandidates(tenant: ResearchTenant, input: { userId: string; scores: { linkId: string; scores: Record<string, number> }[] }) {
  return withClient(async (client) => {
    const results: { linkId: string; total: number; breakdown: Record<string, number> }[] = [];
    for (const item of input.scores) {
      let total = 0; const breakdown: Record<string, number> = {};
      for (const w of FIT_WEIGHTS) {
        const score = Math.max(0, Math.min(100, Number(item.scores[w.key] ?? 0)));
        breakdown[w.key] = score;
        total += score * (w.weight / 100);
      }
      const rounded = Math.round(total * 10) / 10;
      results.push({ linkId: item.linkId, total: rounded, breakdown });
      await client.query(`UPDATE project_instrument_links SET fit=jsonb_set(jsonb_set(fit,'{total}',$3::jsonb,true),'{breakdown}',$4::jsonb,true), updated_at=now() WHERE id=$5 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify(rounded), JSON.stringify(breakdown), item.linkId]);
    }
    const sorted = [...results].sort((a, b) => b.total - a.total);
    const ranked = sorted.map((r, i) => ({ ...r, rank: i + 1, recommendation: i === 0 ? "Recommended Instrument" : i === 1 ? "Alternative Instrument" : "Not Recommended Instrument" }));
    await audit(client, tenant, input.userId, "INSTRUMENT_COMPARISON_RUN", { compared: ranked.length });
    return { ok: true, disclaimer: FIT_DISCLAIMER, ranked };
  });
}

export async function selectInstrument(tenant: ResearchTenant, input: { userId: string; linkId: string }) {
  return withClient(async (client) => {
    const link = await client.query(`SELECT id, rq_id AS "rqId", requirement_id AS "requirementId", instrument_name AS "name", permission_status AS "permissionStatus", translation_status AS "translationStatus" FROM project_instrument_links WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, input.linkId]);
    if (!link.rows[0]) return { ok: false, error: "instrument_link_required" };
    const row = link.rows[0] as Record<string, unknown>;
    // 同 RQ／Requirement 的其他候選取消 SELECTED
    await client.query(`UPDATE project_instrument_links SET status='CANDIDATE', readiness_status=CASE WHEN readiness_status='SELECTED' OR readiness_status='READY_FOR_PROTOCOL' THEN 'CANDIDATE_FOUND' ELSE readiness_status END, updated_at=now() WHERE ${tenantWhere()} AND rq_id=$3 AND id <> $4`, [tenant.workspaceId, tenant.projectId, text(row.rqId), input.linkId]);
    const permissionStatus = text(row.permissionStatus) === "APPROVED" ? "SELECTED" : text(row.permissionStatus) === "UNKNOWN" ? "PERMISSION_PENDING" : text(row.permissionStatus);
    const readiness = permissionStatus === "SELECTED" && text(row.translationStatus) === "NOT_REQUIRED" ? "READY_FOR_PROTOCOL" : permissionStatus === "PERMISSION_PENDING" ? "PERMISSION_REQUIRED" : "SELECTED";
    await client.query(`UPDATE project_instrument_links SET status='SELECTED', readiness_status=$3, permission_status=$4, updated_at=now() WHERE id=$5 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, readiness, permissionStatus, input.linkId]);
    // append-only link 版本
    const payload = { action: "SELECTED", linkId: input.linkId, instrumentName: text(row.name), selectedAt: new Date().toISOString() };
    const version = int((await client.query(`SELECT count(*)::int AS "n" FROM project_instrument_versions WHERE ${tenantWhere()} AND link_id=$3`, [tenant.workspaceId, tenant.projectId, input.linkId])).rows[0]?.n ?? 0) + 1;
    await client.query(`INSERT INTO project_instrument_versions (id,workspace_id,project_id,link_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,$5,'v'||$5,'選定工具',$6,$7::jsonb,$8,now())`, [tenant.workspaceId, tenant.projectId, input.linkId, `piv_${randomUUID()}`, version, hash(payload), JSON.stringify(payload), input.userId]);
    await audit(client, tenant, input.userId, "INSTRUMENT_SELECTED", { linkId: input.linkId });
    return { ok: true, linkId: input.linkId, readiness, permissionStatus };
  });
}

// ---------- Permission Center ----------
export async function saveInstrumentPermission(tenant: ResearchTenant, input: { userId: string; linkId: string; permission: Record<string, unknown> }) {
  return withClient(async (client) => {
    const status = str(input.permission.status, "UNKNOWN");
    if (!["UNKNOWN", "PUBLIC_DOMAIN", "OPEN_LICENSE", "PERMISSION_NOT_REQUIRED", "PERMISSION_REQUIRED", "REQUESTED", "APPROVED", "REJECTED", "EXPIRED", "RESTRICTION_APPLIES"].includes(status)) return { ok: false, error: "permission_status_invalid" };
    if (status === "APPROVED" && !str(input.permission.permissionDocument)) return { ok: false, error: "permission_approved_requires_document" };
    const existing = await client.query(`SELECT id FROM instrument_permissions WHERE ${tenantWhere()} AND link_id=$3`, [tenant.workspaceId, tenant.projectId, input.linkId]);
    const p = input.permission;
    if (existing.rows[0]) {
      await client.query(`UPDATE instrument_permissions SET copyright_owner=$3, license_type=$4, permission_required=$5, permitted_uses=$6::jsonb, prohibited_uses=$7::jsonb, modification_allowed=$8, translation_allowed=$9, digital_administration_allowed=$10, commercial_use_allowed=$11, fee=$12, request_date=$13, response_date=$14, permission_document=$15, expiry_date=$16, status=$17, updated_at=now() WHERE id=$18 AND ${tenantWhere()}`,
        [tenant.workspaceId, tenant.projectId, str(p.copyrightOwner), str(p.licenseType), bool(p.permissionRequired) !== false, JSON.stringify(list(p.permittedUses)), JSON.stringify(list(p.prohibitedUses)), typeof p.modificationAllowed === "boolean" ? p.modificationAllowed : null, typeof p.translationAllowed === "boolean" ? p.translationAllowed : null, typeof p.digitalAllowed === "boolean" ? p.digitalAllowed : null, typeof p.commercialAllowed === "boolean" ? p.commercialAllowed : null, str(p.fee), str(p.requestDate) || null, str(p.responseDate) || null, str(p.permissionDocument), str(p.expiryDate) || null, status, text((existing.rows[0] as Record<string, unknown>).id)]);
    } else {
      await client.query(`INSERT INTO instrument_permissions (id,workspace_id,project_id,link_id,copyright_owner,license_type,permission_required,permitted_uses,prohibited_uses,modification_allowed,translation_allowed,digital_administration_allowed,commercial_use_allowed,fee,request_date,response_date,permission_document,expiry_date,status,created_by_user_id,created_at,updated_at)
        VALUES ($4,$1,$2,$3,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.linkId, `iperm_${randomUUID()}`, str(p.copyrightOwner), str(p.licenseType), bool(p.permissionRequired) !== false, JSON.stringify(list(p.permittedUses)), JSON.stringify(list(p.prohibitedUses)), typeof p.modificationAllowed === "boolean" ? p.modificationAllowed : null, typeof p.translationAllowed === "boolean" ? p.translationAllowed : null, typeof p.digitalAllowed === "boolean" ? p.digitalAllowed : null, typeof p.commercialAllowed === "boolean" ? p.commercialAllowed : null, str(p.fee), str(p.requestDate) || null, str(p.responseDate) || null, str(p.permissionDocument), str(p.expiryDate) || null, status, input.userId]);
    }
    // 同步 link permission_status
    const linkPermissionStatus = status === "APPROVED" || status === "PERMISSION_NOT_REQUIRED" || status === "PUBLIC_DOMAIN" || status === "OPEN_LICENSE" ? "APPROVED" : status === "REQUESTED" ? "REQUESTED" : status === "REJECTED" || status === "EXPIRED" || status === "RESTRICTION_APPLIES" ? "RESTRICTED" : "UNKNOWN";
    await client.query(`UPDATE project_instrument_links SET permission_status=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, linkPermissionStatus, input.linkId]);
    await audit(client, tenant, input.userId, "INSTRUMENT_PERMISSION_SAVED", { linkId: input.linkId, status });
    return { ok: true, status, linkPermissionStatus };
  });
}

// ---------- 翻譯工作流 ----------
export async function saveInstrumentTranslation(tenant: ResearchTenant, input: { userId: string; linkId: string; translation: Record<string, unknown> }) {
  return withClient(async (client) => {
    const t = input.translation;
    const status = str(t.status, "IN_PROGRESS");
    const machine = bool(t.machineTranslated);
    if (machine && (status === "FINALIZED" || status === "VALIDATION_PENDING")) return { ok: false, error: "machine_translation_cannot_be_validated" };
    const existing = await client.query(`SELECT id FROM instrument_translations WHERE ${tenantWhere()} AND link_id=$3`, [tenant.workspaceId, tenant.projectId, input.linkId]);
    if (existing.rows[0]) {
      await client.query(`UPDATE instrument_translations SET source_version=$3, translator_role=$4, forward_a=$5, forward_b=$6, reconciliation=$7, back_translation=$8, cultural_changes=$9::jsonb, item_mapping=$10::jsonb, status=$11, version=$12, user_approval=$13, machine_translated=$14, updated_at=now() WHERE id=$15 AND ${tenantWhere()}`,
        [tenant.workspaceId, tenant.projectId, str(t.sourceVersion), str(t.translatorRole), str(t.forwardA), str(t.forwardB), str(t.reconciliation), str(t.backTranslation), JSON.stringify(list(t.culturalChanges)), JSON.stringify(list(t.itemMapping)), status, str(t.version, "v0.1"), bool(t.userApproval), machine, text((existing.rows[0] as Record<string, unknown>).id)]);
    } else {
      await client.query(`INSERT INTO instrument_translations (id,workspace_id,project_id,link_id,source_version,translator_role,forward_a,forward_b,reconciliation,back_translation,cultural_changes,item_mapping,status,version,user_approval,machine_translated,created_by_user_id,created_at,updated_at)
        VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.linkId, `itr_${randomUUID()}`, str(t.sourceVersion), str(t.translatorRole), str(t.forwardA), str(t.forwardB), str(t.reconciliation), str(t.backTranslation), JSON.stringify(list(t.culturalChanges)), JSON.stringify(list(t.itemMapping)), status, str(t.version, "v0.1"), bool(t.userApproval), machine, input.userId]);
    }
    const linkTranslationStatus = status === "FINALIZED" ? "FINALIZED" : status === "DRAFT_COMPLETE" || status === "VALIDATION_PENDING" ? "VALIDATION_PENDING" : status === "NOT_REQUIRED" ? "NOT_REQUIRED" : "IN_PROGRESS";
    await client.query(`UPDATE project_instrument_links SET translation_status=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, linkTranslationStatus, input.linkId]);
    await audit(client, tenant, input.userId, "INSTRUMENT_TRANSLATION_SAVED", { linkId: input.linkId, status, machine });
    return { ok: true, status, linkTranslationStatus };
  });
}

// ---------- 計分規格 ----------
export async function saveInstrumentScoring(tenant: ResearchTenant, input: { userId: string; linkId: string; scoring: Record<string, unknown> }) {
  return withClient(async (client) => {
    const s = input.scoring;
    const payload = { ...s };
    const contentHash = hash(payload);
    const status = str(s.status, "DRAFT");
    await client.query(`INSERT INTO instrument_scoring_specs (id,workspace_id,project_id,link_id,payload,min_score,max_score,missing_item_rule,completion_threshold,higher_score_meaning,interpretation_limit,analysis_variable_name,status,content_hash,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now(),now())
      ON CONFLICT (workspace_id, project_id, link_id) DO UPDATE SET payload=$5::jsonb, min_score=$6, max_score=$7, missing_item_rule=$8, completion_threshold=$9, higher_score_meaning=$10, interpretation_limit=$11, analysis_variable_name=$12, status=$13, content_hash=$14, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.linkId, `isc_${randomUUID()}`, JSON.stringify(payload), Number(s.minScore) || null, Number(s.maxScore) || null, str(s.missingItemRule), str(s.completionThreshold), str(s.higherScoreMeaning), str(s.interpretationLimit), str(s.analysisVariableName), status, contentHash, input.userId]);
    await client.query(`UPDATE project_instrument_links SET scoring_status=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, status === "FINALIZED" ? "FINALIZED" : "DRAFT", input.linkId]);
    await audit(client, tenant, input.userId, "INSTRUMENT_SCORING_SAVED", { linkId: input.linkId, status });
    return { ok: true, status };
  });
}

// ---------- 通用 Builder 儲存（test/skill/qual/event/sensor/annotation/intervention/fidelity/schedule/field） ----------

export async function saveTestBlueprint(tenant: ResearchTenant, input: { userId: string; blueprint: Record<string, unknown>; items?: Record<string, unknown>[] }) {
  return withClient(async (client) => {
    const b = input.blueprint;
    const id = str(b.id) || `tb_${randomUUID()}`;
    await client.query(`INSERT INTO test_blueprints (id,workspace_id,project_id,link_id,name,table_of_specifications,supported_item_types,related_rq,related_outcome,status,version,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6::jsonb,$7::jsonb,$8,$9,$10,1,$11,now(),now())
      ON CONFLICT (workspace_id, project_id, id) DO UPDATE SET name=$5, table_of_specifications=$6::jsonb, supported_item_types=$7::jsonb, related_rq=$8, related_outcome=$9, status=$10, version=test_blueprints.version+1, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, str(b.linkId), id, str(b.name), JSON.stringify(list(b.tableOfSpecifications)), JSON.stringify(list(b.supportedItemTypes)), str(b.relatedRq), str(b.relatedOutcome), str(b.status, "DRAFT"), input.userId]);
    if (Array.isArray(input.items)) {
      for (const item of input.items) {
        const itemKey = str(item.itemKey);
        if (!itemKey) continue;
        await client.query(`INSERT INTO assessment_items (id,workspace_id,project_id,blueprint_id,item_key,payload,difficulty_status,discrimination_status,content_validity_status,exposure_risk,version,created_by_user_id,created_at,updated_at)
          VALUES ($4,$1,$2,$3,$5,$6::jsonb,'NOT_YET_TESTED','NOT_YET_TESTED',COALESCE(NULLIF($7,''),'NOT_REVIEWED'),$8,1,$9,now(),now())
          ON CONFLICT (workspace_id, project_id, blueprint_id, item_key) DO UPDATE SET payload=$6::jsonb, content_validity_status=COALESCE(NULLIF($7,''),'NOT_REVIEWED'), exposure_risk=$8, version=assessment_items.version+1, updated_at=now()`,
          [tenant.workspaceId, tenant.projectId, id, `ai_${randomUUID()}`, itemKey, JSON.stringify(item), str(item.contentValidityStatus), str(item.exposureRisk, "LOW"), input.userId]);
      }
    }
    await audit(client, tenant, input.userId, "TEST_BLUEPRINT_SAVED", { id, items: list(input.items).length });
    return { ok: true, id };
  });
}

export async function saveSkillAssessment(tenant: ResearchTenant, input: { userId: string; skill: Record<string, unknown> }) {
  return withClient(async (client) => {
    const s = input.skill;
    const id = str(s.id) || `sa_${randomUUID()}`;
    await client.query(`INSERT INTO skill_assessments (id,workspace_id,project_id,link_id,name,task,criteria,assessor_role,assessor_training,blinding,scoring_rule,inter_rater_plan,evidence_source,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,now(),now())
      ON CONFLICT (workspace_id, project_id, id) DO UPDATE SET name=$5, task=$6, criteria=$7::jsonb, assessor_role=$8, assessor_training=$9, blinding=$10, scoring_rule=$11, inter_rater_plan=$12, evidence_source=$13, status=$14, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, str(s.linkId), id, str(s.name), str(s.task), JSON.stringify(list(s.criteria)), str(s.assessorRole), str(s.assessorTraining), str(s.blinding), str(s.scoringRule), str(s.interRaterPlan), str(s.evidenceSource), str(s.status, "DRAFT"), input.userId]);
    return { ok: true, id };
  });
}

export async function saveQualitativeInstrument(tenant: ResearchTenant, input: { userId: string; instrument: Record<string, unknown> }) {
  return withClient(async (client) => {
    const qi = input.instrument;
    const id = str(qi.id) || `qi_${randomUUID()}`;
    const sensitive = list(qi.guide).filter((g) => record(g) && bool((g as Record<string, unknown>).sensitiveFlag)).map((g) => str((g as Record<string, unknown>).questionId));
    await client.query(`INSERT INTO qualitative_instruments (id,workspace_id,project_id,link_id,kind,title,guide,templates,sensitive_item_ids,ethics_note,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,now(),now())
      ON CONFLICT (workspace_id, project_id, id) DO UPDATE SET kind=$5, title=$6, guide=$7::jsonb, templates=$8::jsonb, sensitive_item_ids=$9::jsonb, ethics_note=$10, status=$11, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, str(qi.linkId), id, str(qi.kind, "INTERVIEW_GUIDE"), str(qi.title), JSON.stringify(list(qi.guide)), JSON.stringify(record(qi.templates) ? qi.templates : {}), JSON.stringify(sensitive), str(qi.ethicsNote), str(qi.status, "DRAFT"), input.userId]);
    if (sensitive.length) await audit(client, tenant, input.userId, "QUALITATIVE_SENSITIVE_ITEMS_FLAGGED", { id, sensitive: sensitive.length });
    return { ok: true, id, sensitiveCount: sensitive.length };
  });
}

export async function saveDigitalEvent(tenant: ResearchTenant, input: { userId: string; event: Record<string, unknown> }) {
  return withClient(async (client) => {
    const e = input.event;
    const eventId = str(e.eventId);
    if (!eventId) return { ok: false, error: "event_id_required" };
    await client.query(`INSERT INTO digital_event_definitions (id,workspace_id,project_id,link_id,event_id,event_name,definition,trigger_condition,source_system,participant_id_policy,timestamp_format,value_type,unit,valid_range,missing_rule,related_construct,related_rq,time_point,privacy_level,retention_policy,planned_analysis,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'DRAFT',$22,now(),now())
      ON CONFLICT (workspace_id, project_id, event_id) DO UPDATE SET event_name=$6, definition=$7, trigger_condition=$8, source_system=$9, participant_id_policy=$10, timestamp_format=$11, value_type=$12, unit=$13, valid_range=$14, missing_rule=$15, related_construct=$16, related_rq=$17, time_point=$18, privacy_level=$19, retention_policy=$20, planned_analysis=$21, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, str(e.linkId), `ded_${randomUUID()}`, eventId, str(e.eventName), str(e.definition), str(e.trigger), str(e.sourceSystem), str(e.participantIdPolicy), str(e.timestampFormat), str(e.valueType), str(e.unit), str(e.validRange), str(e.missingRule), str(e.relatedConstruct), str(e.relatedRq), str(e.timePoint), str(e.privacyLevel, "LOW"), str(e.retentionPolicy), str(e.plannedAnalysis), input.userId]);
    return { ok: true, eventId };
  });
}

export async function saveSensorSpecification(tenant: ResearchTenant, input: { userId: string; sensor: Record<string, unknown> }) {
  return withClient(async (client) => {
    const s = input.sensor;
    const sensorKey = str(s.sensorKey);
    if (!sensorKey) return { ok: false, error: "sensor_key_required" };
    const deviceStatus = str(s.deviceStatus, "PLANNED");
    if (!["PLANNED", "PROCURED", "TESTED", "READY", "RETIRED"].includes(deviceStatus)) return { ok: false, error: "device_status_invalid" };
    await client.query(`INSERT INTO sensor_specifications (id,workspace_id,project_id,link_id,sensor_key,device,manufacturer,model,measured_signal,sampling_rate,unit,sensor_placement,calibration,sync_method,timestamp_reference,baseline_period,collection_duration,artifact_sources,quality_threshold,missing_signal_rule,preprocessing_direction,safety_requirement,participant_burden,related_rq,related_construct,device_status,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25,$26,'DRAFT',$27,now(),now())
      ON CONFLICT (workspace_id, project_id, sensor_key) DO UPDATE SET device=$6, manufacturer=$7, model=$8, measured_signal=$9, sampling_rate=$10, unit=$11, sensor_placement=$12, calibration=$13, sync_method=$14, timestamp_reference=$15, baseline_period=$16, collection_duration=$17, artifact_sources=$18::jsonb, quality_threshold=$19, missing_signal_rule=$20, preprocessing_direction=$21, safety_requirement=$22, participant_burden=$23, related_rq=$24, related_construct=$25, device_status=$26, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, str(s.linkId), `ss_${randomUUID()}`, sensorKey, str(s.device), str(s.manufacturer), str(s.model), str(s.measuredSignal), str(s.samplingRate), str(s.unit), str(s.placement), str(s.calibration), str(s.syncMethod), str(s.timestampReference), str(s.baselinePeriod), str(s.collectionDuration), JSON.stringify(list(s.artifactSources)), str(s.qualityThreshold), str(s.missingSignalRule), str(s.preprocessing), str(s.safetyRequirement), str(s.participantBurden), str(s.relatedRq), str(s.relatedConstruct), deviceStatus, input.userId]);
    return { ok: true, sensorKey, deviceStatus };
  });
}

export async function saveAnnotationGuideline(tenant: ResearchTenant, input: { userId: string; guideline: Record<string, unknown> }) {
  return withClient(async (client) => {
    const g = input.guideline;
    const id = str(g.id) || `ag_${randomUUID()}`;
    await client.query(`INSERT INTO annotation_guidelines (id,workspace_id,project_id,name,payload,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$4::jsonb,$5,$6,now(),now())
      ON CONFLICT (workspace_id, project_id, id) DO UPDATE SET name=$3, payload=$4::jsonb, status=$5, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, id, str(g.name), JSON.stringify(record(g.payload) ? g.payload : {}), str(g.status, "DRAFT"), input.userId]);
    return { ok: true, id };
  });
}

export async function saveInterventionMaterial(tenant: ResearchTenant, input: { userId: string; material: Record<string, unknown> }) {
  return withClient(async (client) => {
    const m = input.material;
    const id = str(m.id) || `im_${randomUUID()}`;
    const materialType = str(m.materialType, "INTERVENTION");
    const controlKind = str(m.controlKind);
    const confoundingRisk = materialType === "CONTROL" && !controlKind ? "CONTROL_CONDITION_CONFOUNDING_RISK" : str(m.confoundingRisk, "NONE");
    await client.query(`INSERT INTO intervention_materials (id,workspace_id,project_id,material_type,name,objective,theoretical_mechanism,components,session_count,duration,delivery_method,instructor_role,technology,participant_task,feedback,adaptation_rule,fidelity_measure,prohibited_co_intervention,related_rq,related_outcome,control_kind,confounding_risk,version,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25,now(),now())
      ON CONFLICT (id) DO UPDATE SET material_type=$3, name=$5, objective=$6, theoretical_mechanism=$7, components=$8::jsonb, session_count=$9, duration=$10, delivery_method=$11, instructor_role=$12, technology=$13, participant_task=$14, feedback=$15, adaptation_rule=$16, fidelity_measure=$17, prohibited_co_intervention=$18::jsonb, related_rq=$19, related_outcome=$20, control_kind=$21, confounding_risk=$22, version=$23, status=$24, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, materialType, id, str(m.name), str(m.objective), str(m.mechanism), JSON.stringify(list(m.components)), int(m.sessionCount) || null, str(m.duration), str(m.deliveryMethod), str(m.instructorRole), str(m.technology), str(m.participantTask), str(m.feedback), str(m.adaptationRule), str(m.fidelityMeasure), JSON.stringify(list(m.prohibitedCoIntervention)), str(m.relatedRq), str(m.relatedOutcome), controlKind, confoundingRisk, str(m.version, "v1.0"), str(m.status, "DRAFT"), input.userId]);
    if (confoundingRisk === "CONTROL_CONDITION_CONFOUNDING_RISK") await audit(client, tenant, input.userId, "CONTROL_CONDITION_CONFOUNDING_RISK", { id, controlKind: controlKind || "UNSPECIFIED" });
    return { ok: true, id, confoundingRisk };
  });
}

export async function saveFidelityPlan(tenant: ResearchTenant, input: { userId: string; materialId: string; plan: Record<string, unknown> }) {
  return withClient(async (client) => {
    const p = input.plan;
    await client.query(`INSERT INTO fidelity_plans (id,workspace_id,project_id,material_id,intervention_manual,instructor_training,delivery_checklist,session_record,adherence_measure,dosage,exposure,contamination_check,deviation_rule,fidelity_threshold,corrective_action,moe_course_checks,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7::jsonb,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16::jsonb,$17,$18,now(),now())
      ON CONFLICT (workspace_id, project_id, material_id) DO UPDATE SET intervention_manual=$5, instructor_training=$6, delivery_checklist=$7::jsonb, session_record=$8, adherence_measure=$9, dosage=$10::jsonb, exposure=$11::jsonb, contamination_check=$12, deviation_rule=$13, fidelity_threshold=$14, corrective_action=$15, moe_course_checks=$16::jsonb, status=$17, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.materialId, `fp_${randomUUID()}`, str(p.interventionManual), str(p.instructorTraining), JSON.stringify(list(p.deliveryChecklist)), str(p.sessionRecord), str(p.adherenceMeasure), JSON.stringify(record(p.dosage) ? p.dosage : {}), JSON.stringify(record(p.exposure) ? p.exposure : {}), str(p.contaminationCheck), str(p.deviationRule), str(p.fidelityThreshold), str(p.correctiveAction), JSON.stringify(record(p.moeChecks) ? p.moeChecks : {}), str(p.status, "DRAFT"), input.userId]);
    return { ok: true, materialId: input.materialId };
  });
}

export async function saveScheduleRow(tenant: ResearchTenant, input: { userId: string; row: Record<string, unknown> }) {
  return withClient(async (client) => {
    const r = input.row;
    const activityId = str(r.activityId, str(r.activity, `act_${Date.now()}`));
    await client.query(`INSERT INTO measurement_schedules (id,workspace_id,project_id,activity_id,activity,study_arm,time_point,instrument_link_id,responsible_role,duration,data_generated,ethics_requirement,participant_burden,completion_rule,sequence,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now(),now())
      ON CONFLICT (workspace_id, project_id, activity_id) DO UPDATE SET activity=$5, study_arm=$6, time_point=$7, instrument_link_id=$8, responsible_role=$9, duration=$10, data_generated=$11, ethics_requirement=$12, participant_burden=$13, completion_rule=$14, sequence=$15, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, `ms_${randomUUID()}`, activityId, str(r.activity), str(r.studyArm), str(r.timePoint), str(r.instrumentLinkId), str(r.responsibleRole), str(r.duration), str(r.dataGenerated), str(r.ethicsRequirement), str(r.participantBurden), str(r.completionRule), int(r.sequence) || null, input.userId]);
    return { ok: true, activityId };
  });
}

export async function saveDataCaptureField(tenant: ResearchTenant, input: { userId: string; field: Record<string, unknown> }) {
  return withClient(async (client) => {
    const variableName = str(input.field.variableName);
    if (!variableName) return { ok: false, error: "variable_name_required" };
    const f = input.field;
    await client.query(`INSERT INTO data_capture_fields (id,workspace_id,project_id,variable_name,label,source_instrument,item_or_event_id,construct,data_type,unit,valid_range,coding,missing_code,time_point,study_arm,personally_identifiable,sensitive_data,de_identification_rule,storage_location,analysis_plan_link,version,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,1,$21,now(),now())
      ON CONFLICT (workspace_id, project_id, variable_name) DO UPDATE SET label=$5, source_instrument=$6, item_or_event_id=$7, construct=$8, data_type=$9, unit=$10, valid_range=$11, coding=$12, missing_code=$13, time_point=$14, study_arm=$15, personally_identifiable=$16, sensitive_data=$17, de_identification_rule=$18, storage_location=$19, analysis_plan_link=$20, version=data_capture_fields.version+1, mapping_history=data_capture_fields.mapping_history || jsonb_build_array(jsonb_build_object('changedAt', now(), 'by', $21)), updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, `dcf_${randomUUID()}`, variableName, str(f.label), str(f.sourceInstrument), str(f.itemOrEventId), str(f.construct), str(f.dataType), str(f.unit), str(f.validRange), str(f.coding), str(f.missingCode), str(f.timePoint), str(f.studyArm), bool(f.personallyIdentifiable), bool(f.sensitiveData), str(f.deIdentificationRule), str(f.storageLocation), str(f.analysisPlanLink), input.userId]);
    return { ok: true, variableName };
  });
}

// ---------- 授權後可加入的 evidence 連結 ----------
export async function linkInstrumentEvidence(tenant: ResearchTenant, input: { userId: string; linkId: string; literatureId?: string; citationSourceId?: string; zoteroItemKey?: string; role?: string; supportedClaim?: string }) {
  return withClient(async (client) => {
    if (!input.literatureId && !input.citationSourceId && !input.zoteroItemKey) return { ok: false, error: "evidence_source_required" };
    await client.query(`INSERT INTO instrument_evidence_links (id,workspace_id,project_id,link_id,literature_id,citation_source_id,zotero_item_key,role,supported_claim,verification_status,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,'UNVERIFIED',$10,now())`,
      [tenant.workspaceId, tenant.projectId, input.linkId, `iel_${randomUUID()}`, input.literatureId ?? null, input.citationSourceId ?? null, input.zoteroItemKey ?? null, str(input.role, "MEASUREMENT"), str(input.supportedClaim), input.userId]);
    await audit(client, tenant, input.userId, "INSTRUMENT_EVIDENCE_LINKED", { linkId: input.linkId, literatureId: input.literatureId ?? null, zoteroItemKey: input.zoteroItemKey ?? null });
    return { ok: true };
  });
}

// ---------- Study Protocol：section 編輯（append-only 工作版本） ----------
const PROTOCOL_SECTIONS = ["identity", "background", "objectives", "design", "population", "recruitment_consent", "arms_allocation", "intervention_control", "measurements", "schedule", "data_capture", "outcomes", "sample_size", "analysis", "data_management", "privacy_security", "adverse_events", "withdrawal", "deviation_qa", "fidelity", "ethics_status", "preregistration", "dissemination", "appendices"] as const;

export async function saveProtocolSection(tenant: ResearchTenant, input: { userId: string; sectionId: string; content: Record<string, unknown> | string; reason?: string }) {
  return withClient(async (client) => {
    if (!(PROTOCOL_SECTIONS as readonly string[]).includes(input.sectionId)) return { ok: false, error: "protocol_section_unknown" };
    const protocolId = await ensureProtocol(client, tenant, input.userId);
    const latest = await client.query(`SELECT payload, version_number AS "version" FROM study_protocol_versions WHERE ${tenantWhere()} AND protocol_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, protocolId]);
    const current: Record<string, unknown> = {};
    let version = 0;
    if (latest.rows[0]) {
      const p = latest.rows[0].payload;
      if (record(p)) Object.assign(current, p);
      version = int(latest.rows[0].version);
    }
    if (typeof current.sections !== "object" || current.sections === null) current.sections = {};
    const sections = record(current.sections) ? current.sections as Record<string, unknown> : {};
    sections[input.sectionId] = typeof input.content === "string" ? { text: input.content, updatedAt: new Date().toISOString() } : { ...input.content, updatedAt: new Date().toISOString() };
    current.sections = sections;
    current.references = current.references ?? {};
    const nextVersion = version + 1;
    await client.query(`INSERT INTO study_protocol_versions (id,workspace_id,project_id,protocol_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,$5,NULL,$8,$6,$7,$9::jsonb,$10,now())`,
      [tenant.workspaceId, tenant.projectId, protocolId, `spv_${randomUUID()}`, nextVersion, input.reason ?? `區塊 ${input.sectionId} 更新`, hash(current), JSON.stringify(current), input.userId, `v${nextVersion}`]);
    await client.query(`UPDATE study_protocols SET status=CASE WHEN status='NOT_STARTED' THEN 'DRAFT' ELSE status END, current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, nextVersion, protocolId]);
    await audit(client, tenant, input.userId, "PROTOCOL_SECTION_SAVED", { sectionId: input.sectionId, version: nextVersion });
    return { ok: true, version: nextVersion };
  });
}

export async function generateProtocolDraft(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const source = await loadStudioSources(client, tenant);
    const protocolId = await ensureProtocol(client, tenant, input.userId);
    const content: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      title: text(record(source.bpPayload) ? (source.bpPayload.research_identity as Record<string, unknown> | undefined)?.chineseTitle : ""),
      references: {
        researchDesignVersion: `Design v${source.designVersion}`,
        analysisPlanCount: source.analysisPlans.length,
        ethicsScope: "請在 Ethics 區塊確認",
      },
      sections: {},
    };
    // 僅自動填可安全衍生的區塊（不虛構）；其餘留待研究者
    const identity = record(source.bpPayload.research_identity) ? source.bpPayload.research_identity as Record<string, unknown> : {};
    const questions = source.questions.map((r: Record<string, unknown>) => ({ rqKey: text(r.rqKey), question: text(r.question) }));
    content.sections = {
      identity: { text: `研究題目（待研究者確認後填寫）：${str(identity.chineseTitle, "（未填）")}`, updatedAt: new Date().toISOString() },
      objectives: { text: `由藍圖目標與 ${questions.length} 個研究問題驅動（問題清單見附錄）。`, updatedAt: new Date().toISOString() },
      design: { text: `設計與組別請對照 Research Design v${source.designVersion}（本 Protocol 不複製設計資料）。`, updatedAt: new Date().toISOString() },
    };
    await client.query(`INSERT INTO study_protocol_versions (id,workspace_id,project_id,protocol_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,1,'v1.0','自動草稿（僅安全可衍生區塊；其餘待研究者填寫）',$5,$6::jsonb,$7,now())`,
      [tenant.workspaceId, tenant.projectId, protocolId, `spv_${randomUUID()}`, hash(content), JSON.stringify(content), input.userId]);
    await client.query(`UPDATE study_protocols SET status='DRAFT', current_version_number=1, updated_at=now() WHERE id=$3 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, protocolId]);
    return { ok: true, version: 1 };
  });
}

// ---------- Ethics Alignment ----------
export async function runEthicsAlignment(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const source = await loadStudioSources(client, tenant);
    const [links, sensors, qual, interventions, schedules, docs, dmp] = await Promise.all([
      client.query(`SELECT id, instrument_name AS "name", rq_id AS "rqId", permission_status AS "permissionStatus" FROM project_instrument_links WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT sensor_key AS "sensorKey" FROM sensor_specifications WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT title, sensitive_item_ids AS "sensitiveItemIds", kind FROM qualitative_instruments WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT id, name, material_type AS "materialType", control_kind AS "controlKind", confounding_risk AS "confoundingRisk" FROM intervention_materials WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT activity, time_point FROM measurement_schedules WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT document_type AS "documentType", status FROM ethics_documents WHERE ${tenantWhere()} AND document_type IN ('PARTICIPANT_INFORMATION_SHEET','INFORMED_CONSENT','PRIVACY_NOTICE')`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT sections FROM data_management_plans WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const dmpSections = dmp.rows[0] && record(dmp.rows[0].sections) ? dmp.rows[0].sections as Record<string, unknown> : {};
    const sensorKeys = sensors.rows.map((r: Record<string, unknown>) => text(r.sensorKey));
    const sensitive = qual.rows.filter((r: Record<string, unknown>) => list(r.sensitiveItemIds).length > 0);
    const findings: { code: string; severity: "FATAL" | "MAJOR" | "MINOR"; message: string; related: string }[] = [];
    const hasSensors = sensorKeys.length > 0;
    if (hasSensors) {
      const dmpCoverage = sensorKeys.every((key) => JSON.stringify(dmpSections).includes(key) || JSON.stringify(dmpSections).toLowerCase().includes("sensor") || JSON.stringify(dmpSections).toLowerCase().includes("穿戴"));
      if (!dmpCoverage) findings.push({ code: "SENSOR_NOT_IN_DATA_PLAN", severity: "FATAL", message: `新增感測器（${sensorKeys.join("、")}）但 Data Management Plan 未涵蓋。`, related: sensorKeys.join(",") });
    }
    if (sensitive.length) {
      const consentReady = docs.rows.some((r: Record<string, unknown>) => ["SUBMITTED", "APPROVED"].includes(text(r.status)));
      findings.push({ code: "SENSITIVE_ITEM_NOT_IN_CONSENT", severity: consentReady ? "FATAL" : "MAJOR", message: `訪談/觀察工具含敏感問題（${sensitive.map((r: Record<string, unknown>) => text(r.title)).join("、")}），需確認 Consent 涵蓋。`, related: sensitive.map((r: Record<string, unknown>) => text(r.title)).join(",") });
      if (consentReady) findings.push({ code: "ETHICS_AMENDMENT_REQUIRED", severity: "FATAL", message: "正式倫理文件已核准後新增敏感工具內容：不得直接覆蓋，需 ETHICS_AMENDMENT_REQUIRED。", related: "ethics_documents" });
    }
    const audioVisual = qual.rows.some((r: Record<string, unknown>) => ["INTERVIEW_GUIDE", "FOCUS_GROUP_GUIDE", "OBSERVATION_PROTOCOL"].includes(text(r.kind)));
    if (audioVisual && !docs.rows.some((r: Record<string, unknown>) => ["SUBMITTED", "APPROVED"].includes(text(r.status)))) {
      findings.push({ code: "RECORDING_NOT_IN_CONSENT", severity: "MAJOR", message: "含錄音/錄影型工具但 Consent 文件尚未就緒（SUBMITTED/APPROVED）。", related: "INFORMED_CONSENT" });
    }
    const controlMissing = interventions.rows.filter((r: Record<string, unknown>) => text(r.materialType) === "CONTROL" && !text(r.controlKind));
    if (controlMissing.length) findings.push({ code: "CONTROL_CONDITION_CONFOUNDING_RISK", severity: "MAJOR", message: "控制組未定義控制類型（usual_practice/active/waitlist/…），實驗與控制組差異不明。", related: controlMissing.map((r: Record<string, unknown>) => text(r.name)).join(",") });
    if (source.ethics && text(source.ethics.teacherPower) === "TEACHER_STUDENT_POWER_RISK") findings.push({ code: "TEACHER_STUDENT_POWER_IMBALANCE", severity: "FATAL", message: "倫理中心偵測師生權力風險尚未解除（11 項檢查未全 YES）。", related: "research_ethics_assessments" });
    const results = { checkedAt: new Date().toISOString(), findings };
    const fatalCount = findings.filter((f) => f.severity === "FATAL").length;
    const majorCount = findings.filter((f) => f.severity === "MAJOR").length;
    const status = fatalCount > 0 ? "FAIL" : majorCount > 0 ? "WARN" : "PASS";
    await client.query(`INSERT INTO protocol_alignment_results (id,workspace_id,project_id,check_type,results,fatal_count,major_count,status,created_by_user_id,checked_at) VALUES ($4,$1,$2,'ETHICS',$3::jsonb,$5,$6,$7,$8,now())`,
      [tenant.workspaceId, tenant.projectId, `par_${randomUUID()}`, JSON.stringify(results), fatalCount, majorCount, status, input.userId]);
    await audit(client, tenant, input.userId, "PROTOCOL_ETHICS_ALIGNMENT_RUN", { status, fatalCount, majorCount });
    return { ok: true, status, fatalCount, majorCount, findings };
  });
}

// ---------- Analysis Alignment ----------
export async function runAnalysisAlignment(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const source = await loadStudioSources(client, tenant);
    const [links, fields, scorings, sensors, interventions, schedules, events] = await Promise.all([
      client.query(`SELECT id, instrument_name AS "name", rq_id AS "rqId", construct_id AS "constructId", readiness_status AS "readinessStatus", scoring_status AS "scoringStatus", time_points AS "timePoints" FROM project_instrument_links WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT variable_name, analysis_plan_link FROM data_capture_fields WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT link_id AS "linkId", analysis_variable_name AS "analysisVariableName", status FROM instrument_scoring_specs WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT sensor_key, related_rq FROM sensor_specifications WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT id, name, material_type AS "materialType", control_kind AS "controlKind" FROM intervention_materials WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT activity_id FROM measurement_schedules WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT event_id FROM digital_event_definitions WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const findings: { code: string; severity: "FATAL" | "MAJOR" | "MINOR"; message: string; related: string }[] = [];
    const linkRows = links.rows as Record<string, unknown>[];
    const fieldNames = new Set(fields.rows.map((r: Record<string, unknown>) => text(r.variable_name)));
    const fieldAnalysis = new Set(fields.rows.map((r: Record<string, unknown>) => text(r.analysis_plan_link)).filter(Boolean));
    const rqs = source.matrixRows.map((r) => record(r) ? r : {}).map((r) => str(r.rqId, str(r.rqKey))).filter(Boolean);
    const uniqueRqs = [...new Set(rqs)];
    for (const rq of uniqueRqs) {
      const hasInstrument = linkRows.some((l) => text(l.rqId) === rq && text(l.readinessStatus) !== "REQUIREMENT_DEFINED");
      if (!hasInstrument) findings.push({ code: "RQ_WITHOUT_INSTRUMENT", severity: "FATAL", message: `RQ ${rq} 沒有可執行 Measurement Instrument。`, related: rq });
    }
    const noConstruct = linkRows.filter((l) => !text(l.constructId) && !text(l.constructName) && text(l.instrumentName) !== "（待選定工具）");
    if (noConstruct.length) findings.push({ code: "INSTRUMENT_WITHOUT_CONSTRUCT", severity: "MAJOR", message: `${noConstruct.length} 個工具未連結構念。`, related: noConstruct.map((l) => text(l.name)).join(",") });
    // MOE：只測滿意度／TAM 而無學習成果測量
    if (source.route === "MOE_TEACHING_PRACTICE") {
      const learningLinks = linkRows.filter((l) => { const role = `${text(l.variable_role)}|${text(l.primary_or_secondary)}`.toLowerCase(); return role.includes("learning_outcome") || role.includes("outcome") || (text(l.constructName) + text(l.instrumentName)).includes("學習"); });
      const satisfactionOnly = linkRows.length > 0 && !learningLinks.length;
      if (satisfactionOnly) findings.push({ code: "STUDENT_LEARNING_OUTCOME_MISSING", severity: "MAJOR", message: "教學實踐路線僅有滿意度/TAM 類測量，缺少學生學習成果測量（每個成果需有評量）。", related: "project_instrument_links" });
    }
    const noScoring = linkRows.filter((l) => text(l.readinessStatus) === "SELECTED" || text(l.readinessStatus) === "READY_FOR_PROTOCOL" || text(l.status === "SELECTED" ? "x" : "") === "" && text(l.scoringStatus) === "NOT_DEFINED");
    if (noScoring.length) findings.push({ code: "SCORE_NOT_DEFINED", severity: "MAJOR", message: `${noScoring.length} 個已選定工具尚未定義計分規格。`, related: noScoring.map((l) => text(l.name)).join(",") });
    // 分析計畫所需變數 vs Data Capture Schema
    const analysisPlans = source.analysisPlans;
    const missingAnalysisVars: string[] = [];
    for (const plan of analysisPlans) {
      const p = record(plan) ? plan as Record<string, unknown> : {};
      const outcome = str(p.primaryOutcome);
      const varName = str(p.analysisVariableName ?? p.variableName ?? p.primaryOutcome);
      if (varName && !fieldNames.has(varName) && !fieldNames.has(outcome)) missingAnalysisVars.push(varName || outcome);
    }
    if (missingAnalysisVars.length) findings.push({ code: "ANALYSIS_VARIABLE_NOT_CAPTURED", severity: "FATAL", message: `Analysis Plan 需要但 Data Capture Schema 未定義的變數：${[...new Set(missingAnalysisVars)].join("、")}。`, related: [...new Set(missingAnalysisVars)].join(",") });
    const hasRCT = JSON.stringify(source.designPayload).includes("RCT") || JSON.stringify(source.designPayload).toLowerCase().includes("隨機");
    if (hasRCT) {
      const hasControl = interventions.rows.some((r: Record<string, unknown>) => text(r.materialType) === "CONTROL");
      if (!hasControl) findings.push({ code: "CONTROL_CONDITION_NOT_DEFINED", severity: "FATAL", message: "因果設計需要 Control Condition，尚未定義。", related: "intervention_materials" });
      const fidelity = await client.query(`SELECT 1 FROM fidelity_plans WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!fidelity.rows[0]) findings.push({ code: "FIDELITY_PLAN_MISSING", severity: "MAJOR", message: "介入研究缺少 Intervention Fidelity Plan。", related: "fidelity_plans" });
    }
    if (!events.rows.length && JSON.stringify(source.designPayload).toLowerCase().includes("log")) findings.push({ code: "EVENT_LOG_NOT_DEFINED", severity: "MAJOR", message: "設計提及系統/行為紀錄但 Digital Event Dictionary 為空。", related: "digital_event_definitions" });
    const scheduleByRq = new Set(schedules.rows.map((r: Record<string, unknown>) => text(r.activity_id)));
    const retentionRq = source.matrixRows.filter((r) => record(r) && /retention|保留|維持|follow|追蹤|T2|T3/iu.test(JSON.stringify(r)));
    if (retentionRq.length && ![...scheduleByRq].some((a) => /follow|追蹤|T2|T3|retention/i.test(a))) {
      findings.push({ code: "MEASUREMENT_TIMEPOINT_MISSING", severity: "MAJOR", message: "存在 Retention／Follow-up 需求（30 天以上）但 Schedule 無追蹤時點。", related: "measurement_schedules" });
    }
    const results = { checkedAt: new Date().toISOString(), findings };
    const fatalCount = findings.filter((f) => f.severity === "FATAL").length;
    const majorCount = findings.filter((f) => f.severity === "MAJOR").length;
    const status = fatalCount > 0 ? "FAIL" : majorCount > 0 ? "WARN" : "PASS";
    await client.query(`INSERT INTO protocol_alignment_results (id,workspace_id,project_id,check_type,results,fatal_count,major_count,status,created_by_user_id,checked_at) VALUES ($4,$1,$2,'ANALYSIS',$3::jsonb,$5,$6,$7,$8,now())`,
      [tenant.workspaceId, tenant.projectId, `par_${randomUUID()}`, JSON.stringify(results), fatalCount, majorCount, status, input.userId]);
    await audit(client, tenant, input.userId, "PROTOCOL_ANALYSIS_ALIGNMENT_RUN", { status, fatalCount, majorCount });
    return { ok: true, status, fatalCount, majorCount, findings };
  });
}

// ---------- Pilot Readiness ----------
export async function runPilotReadiness(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const source = await loadStudioSources(client, tenant);
    const entry = await entryChecks(client, tenant, source);
    const [links, permissions, sensors, protocol] = await Promise.all([
      client.query(`SELECT id, readiness_status AS "readinessStatus", permission_status AS "permissionStatus" FROM project_instrument_links WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM instrument_permissions WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT device_status AS "deviceStatus" FROM sensor_specifications WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT id, status, current_version_number AS "v" FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const selected = links.rows.filter((r: Record<string, unknown>) => text(r.readinessStatus) === "SELECTED" || text(r.readinessStatus) === "READY_FOR_PROTOCOL");
    const protocolApproved = text(protocol.rows[0]?.status ?? "") === "APPROVED_FOR_PILOT";
    const items: { key: string; label: string; status: "OK" | "PENDING" | "BLOCKED"; detail: string }[] = [
      { key: "design_approved", label: "Research Design 核准", status: "OK", detail: "已核准" },
      { key: "ethics_scope", label: "倫理範圍判斷", status: entry.ethics ? "OK" : "BLOCKED", detail: entry.ethics ? `判斷：${entry.ethics.judgment}` : "尚未完成 ETHICS_SCOPE_DETERMINED" },
      { key: "instruments_selected", label: "主要工具已選定", status: selected.length > 0 ? "OK" : "PENDING", detail: `已選定 ${selected.length}/${links.rows.length} 個工具` },
      { key: "permissions", label: "工具授權確認", status: permissions.rows.every((r: Record<string, unknown>) => ["APPROVED", "PERMISSION_NOT_REQUIRED", "PUBLIC_DOMAIN", "OPEN_LICENSE"].includes(text(r.status))) ? "OK" : "PENDING", detail: `授權狀態：${permissions.rows.length} 筆（需 APPROVED 或確定不需授權）` },
      { key: "protocol_locked", label: "Study Protocol 鎖定", status: protocolApproved ? "OK" : "BLOCKED", detail: protocolApproved ? "APPROVED_FOR_PILOT" : "Protocol 尚未核准" },
      { key: "sensors_ready", label: "感測器設備狀態", status: sensors.rows.length === 0 || sensors.rows.every((r: Record<string, unknown>) => ["TESTED", "READY"].includes(text(r.deviceStatus))) ? "OK" : "PENDING", detail: sensors.rows.length ? "感測器需 TESTED/READY 才能執行" : "無感測器（不適用）" },
      { key: "ethics_approval", label: "正式倫理核准（執行用）", status: entry.executionAccess ? "OK" : "PENDING", detail: entry.accessNote },
      { key: "grant_activation", label: "計畫核定／專案啟動", status: source.route === "JOURNAL" ? "OK" : entry.grants.nstcPackageReady || entry.grants.moePackageReady ? "PENDING" : "PENDING", detail: source.route === "JOURNAL" ? "自我經費路線：不需外部核定" : "PRE_AWARD：尚未核定 → 不得啟動" },
    ];
    const blocked = items.filter((i) => i.status === "BLOCKED").length;
    const pending = items.filter((i) => i.status === "PENDING").length;
    const overall = blocked > 0 ? "BLOCKED" : pending === 0 ? "READY" : entry.executionAccess ? "CONDITIONAL" : "READY_PENDING_ETHICS";
    await client.query(`INSERT INTO pilot_readiness_packages (id,workspace_id,project_id,items,overall,version,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3::jsonb,$5,1,$6,now(),now())
      ON CONFLICT (workspace_id, project_id) DO UPDATE SET items=$3::jsonb, overall=$5, version=pilot_readiness_packages.version+1, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, `prp_${randomUUID()}`, JSON.stringify(items), overall, input.userId]);
    await audit(client, tenant, input.userId, "PILOT_READINESS_RUN", { overall, blocked, pending });
    return { ok: true, overall, items, blocked, pending };
  });
}

// ---------- Gate：INSTRUMENTS_AND_PROTOCOL_APPROVED ----------
export async function approveInstrumentsGate(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const source = await loadStudioSources(client, tenant);
    const [links, permissions, schedules, fields, protocol, ethicsResult, analysisResult, interventions, fidelity] = await Promise.all([
      client.query(`SELECT id, instrument_name AS "name", rq_id AS "rqId", readiness_status AS "readinessStatus", permission_status AS "permissionStatus" FROM project_instrument_links WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM instrument_permissions WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM measurement_schedules WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT count(*)::int AS "n" FROM data_capture_fields WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status, current_version_number AS "v" FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM protocol_alignment_results WHERE ${tenantWhere()} AND check_type='ETHICS' ORDER BY checked_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status FROM protocol_alignment_results WHERE ${tenantWhere()} AND check_type='ANALYSIS' ORDER BY checked_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT material_type AS "materialType" FROM intervention_materials WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT 1 FROM fidelity_plans WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const rows = links.rows as Record<string, unknown>[];
    const primaryRqs = [...new Set(source.matrixRows.map((r) => record(r) ? r : {}).map((r) => str(r.rqId, str(r.rqKey))).filter(Boolean))];
    const failed: { key: string; label: string; detail: string }[] = [];
    for (const rq of primaryRqs) {
      const ready = rows.some((l) => text(l.rqId) === rq && ["SELECTED", "READY_FOR_PROTOCOL"].includes(text(l.readinessStatus)));
      if (!ready) failed.push({ key: `rq_instrument_${rq}`, label: `RQ ${rq} 已有可執行工具`, detail: "需 SELECTED／READY_FOR_PROTOCOL" });
    }
    const hasPrimaryOutcome = rows.some((l) => text(l.primaryOrSecondary) === "PRIMARY" && ["SELECTED", "READY_FOR_PROTOCOL"].includes(text(l.readinessStatus)));
    if (!hasPrimaryOutcome) failed.push({ key: "primary_outcome", label: "Primary Outcome 已明確定義並有工具", detail: "需至少一個 PRIMARY 工具已選定" });
    const noEvidence = rows.filter((l) => !["REQUIREMENT_DEFINED", "CANDIDATE_NEEDED", "BLOCKED"].includes(text(l.readinessStatus)));
    if (noEvidence.length) failed.push({ key: "evidence_sources", label: "每項工具均有 Evidence 來源（文獻/授權）", detail: "請為每個工具連結文獻或授權紀錄" });
    const permOk = permissions.rows.every((r: Record<string, unknown>) => ["APPROVED", "PERMISSION_NOT_REQUIRED", "PUBLIC_DOMAIN", "OPEN_LICENSE"].includes(text(r.status)));
    if (permissions.rows.length > 0 && !permOk) failed.push({ key: "permissions", label: "工具授權狀態已確認", detail: "尚有未確認授權（UNKNOWN/REQUESTED）" });
    if (int(schedules.rows[0]?.n ?? 0) < 4) failed.push({ key: "schedule", label: "Schedule of Activities 已完成", detail: `目前 ${schedules.rows[0]?.n ?? 0} 項活動` });
    if (int(fields.rows[0]?.n ?? 0) === 0) failed.push({ key: "data_schema", label: "Data Capture Schema 已完成", detail: "尚無資料欄位" });
    const hasControl = interventions.rows.some((r: Record<string, unknown>) => text(r.materialType) === "CONTROL");
    const hasIntervention = interventions.rows.some((r: Record<string, unknown>) => text(r.materialType) === "INTERVENTION");
    if (hasIntervention && !hasControl) failed.push({ key: "control_condition", label: "Study Arms 與 Control Condition 已明確", detail: "介入存在但無控制組" });
    if (hasIntervention && !fidelity.rows[0]) failed.push({ key: "fidelity", label: "Intervention Fidelity Plan 已建立", detail: "缺 Fidelity Plan" });
    const protocolStatus = text(protocol.rows[0]?.status ?? "NOT_STARTED");
    if (protocolStatus !== "APPROVED_FOR_PILOT" && !(protocol.rows[0] && int((protocol.rows[0] as Record<string, unknown>).v) >= 1)) failed.push({ key: "protocol", label: "Study Protocol v1.0 已建立", detail: `Protocol 狀態：${protocolStatus}` });
    if (text(ethicsResult.rows[0]?.status ?? "") === "FAIL") failed.push({ key: "ethics_alignment", label: "Protocol 與 Ethics Documents 一致", detail: "Ethics Alignment 有 FATAL" });
    if (text(analysisResult.rows[0]?.status ?? "") === "FAIL") failed.push({ key: "analysis_alignment", label: "Instrument 與 Analysis Plan 一致", detail: "Analysis Alignment 有 FATAL" });
    if (failed.length) {
      await client.query(`UPDATE study_protocols SET status='INSTRUMENTS_INCOMPLETE', updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
      return { ok: false, failed, status: "INSTRUMENTS_INCOMPLETE" };
    }
    const gateId = `hg_${randomUUID()}`;
    await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ($4,$1,$2,$3,'INSTRUMENTS_AND_PROTOCOL_APPROVED','study_protocol',$5,$6,'APPROVED',$3,now(),now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, gateId, protocol.rows[0] ? text((protocol.rows[0] as Record<string, unknown>).id) : "", hash({ gateType: "INSTRUMENTS_AND_PROTOCOL_APPROVED", at: new Date().toISOString() })]);
    await client.query(`UPDATE study_protocols SET status='APPROVED_FOR_PILOT', updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    await audit(client, tenant, input.userId, "INSTRUMENTS_AND_PROTOCOL_APPROVED", { humanGateId: gateId });
    return { ok: true, gateType: "INSTRUMENTS_AND_PROTOCOL_APPROVED", humanGateId: gateId };
  });
}

// ---------- Research Blueprint v4 Protocol-Ready 回寫（append-only，不覆蓋） ----------
export async function writeBlueprintV4(tenant: ResearchTenant, input: { userId: string; protocolVersionId?: string }) {
  return withClient(async (client) => {
    const blueprint = await client.query(`SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (!blueprint.rows[0]) return { ok: false, error: "blueprint_required" };
    const blueprintId = text((blueprint.rows[0] as Record<string, unknown>).id);
    const latestBp = await client.query(`SELECT payload, version_number AS "v", id FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3 ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, blueprintId]);
    const bpPayload = latestBp.rows[0] && record(latestBp.rows[0].payload) ? latestBp.rows[0].payload as Record<string, unknown> : {};
    const [links, schedules, fields, scorings, interventions, sensors, protocol] = await Promise.all([
      client.query(`SELECT instrument_name AS "name", instrument_type AS "type", construct_name AS "construct", rq_id AS "rqId", readiness_status AS "readiness", permission_status AS "permission", fit->>'total' AS "fitTotal" FROM project_instrument_links WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT activity, time_point, instrument_link_id FROM measurement_schedules WHERE ${tenantWhere()} ORDER BY sequence NULLS LAST`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT variable_name, data_type, construct, time_point FROM data_capture_fields WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT link_id AS "linkId", analysis_variable_name AS "analysisVariableName", status FROM instrument_scoring_specs WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT name, material_type AS "materialType", control_kind AS "controlKind", version, confounding_risk AS "confoundingRisk" FROM intervention_materials WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT sensor_key, device_status AS "deviceStatus", related_construct FROM sensor_specifications WHERE ${tenantWhere()} ORDER BY created_at`, [tenant.workspaceId, tenant.projectId]),
      client.query(`SELECT status, current_version_number AS "v" FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const v4Payload: Record<string, unknown> = {
      ...bpPayload,
      protocol_ready: {
        written_at: new Date().toISOString(),
        study_protocol_version: protocol.rows[0] ? `Protocol v${int((protocol.rows[0] as Record<string, unknown>).v)}（${text((protocol.rows[0] as Record<string, unknown>).status)}）` : null,
        selected_instruments: links.rows,
        measurement_schedule: schedules.rows,
        scoring_specifications: scorings.rows,
        intervention_version: interventions.rows.find((r: Record<string, unknown>) => text(r.materialType) === "INTERVENTION") ?? null,
        control_condition: interventions.rows.find((r: Record<string, unknown>) => text(r.materialType) === "CONTROL") ?? null,
        sensor_specifications: sensors.rows,
        data_capture_schema: fields.rows,
        instrument_permission_status: "見 Instrument Permission Center（不虛構）",
        ethics_alignment_status: "見 Protocol Ethics Alignment",
        analysis_alignment_status: "見 Protocol Analysis Alignment",
        pilot_readiness_status: "見 Pilot Readiness Package",
        unresolved_protocol_issues: [],
      },
    };
    const versionNumber = latestBp.rows[0] ? int((latestBp.rows[0] as Record<string, unknown>).v) + 1 : 1;
    const versionId = `rbpv_${randomUUID()}`;
    await client.query(`INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,supersedes_version_id,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,$5,$6,'v5.0 Protocol-Ready','由 Instrument & Protocol Studio 回寫（不覆蓋既有版本）',$7,$8::jsonb,$9,now())`,
      [tenant.workspaceId, tenant.projectId, blueprintId, versionId, versionNumber, latestBp.rows[0] ? text((latestBp.rows[0] as Record<string, unknown>).id) : null, hash(v4Payload), JSON.stringify(v4Payload), input.userId]);
    await client.query(`UPDATE research_blueprints SET current_version_number=$3, updated_at=now() WHERE id=$4 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, versionNumber, blueprintId]);
    await audit(client, tenant, input.userId, "BLUEPRINT_V4_PROTOCOL_READY_WRITTEN", { blueprintVersionId: versionId, versionNumber });
    return { ok: true, blueprintVersionId: versionId, versionNumber };
  });
}

// ---------- AI 草稿（候選工具比較與題項草稿；PROVISIONAL；不產生真實信效度） ----------
export async function aiDraftInstrumentContent(tenant: ResearchTenant, input: { userId: string; kind: "CANDIDATE_SEARCH" | "ITEM_DRAFT" | "PROTOCOL_SECTION"; payload: Record<string, unknown> }) {
  return withClient(async (client) => {
    const source = await loadStudioSources(client, tenant);
    const messages: OpenClawMessage[] = [
      { role: "system", content: "你是老麥（Old Mike）的測量工具研究助手。輸出必須是單一 JSON 物件（不前言、不 markdown code fence 外文字）。禁止虛構量表名稱、作者、題項、DOI、信效度、授權狀態或翻譯版本；未經搜尋驗證的資訊一律標 UNVERIFIED；受著作權保護的完整量表題項不得生成（只能給 Metadata 與使用決策建議）。所有輸出為 PROVISIONAL 草稿供研究者審閱。" },
      { role: "user", content: JSON.stringify({ kind: input.kind, request: input.payload, projectContext: { route: source.route, questions: source.questions.slice(0, 20), designVersion: source.designVersion, analysisPlanCount: source.analysisPlans.length } }) },
    ];
    const result = await callOpenClaw(messages, `instrument:${tenant.workspaceId}:${tenant.projectId}:${input.kind}`, "ASSIST_ROUTE_SECTION", undefined);
    if (result.kind !== "success") return { ok: false, error: "AI 草稿目前無法執行；請稍後重試（未產生內容）。" };
    return { ok: true, content: result.content };
  });
}

// ---------- OUTDATED（供上游變更串接） ----------
export async function markInstrumentProtocolOutdated(tenant: ResearchTenant, input: { userId: string; reason: string; sourceTable: string; sourceId?: string }) {
  return withClient(async (client) => {
    const links = await client.query(`UPDATE project_instrument_links SET status='OUTDATED', updated_at=now() WHERE ${tenantWhere()} AND status IN ('SELECTED','DRAFT','READY_FOR_PILOT','FINALIZED','PERMISSION_PENDING','TRANSLATION_PENDING') RETURNING id`, [tenant.workspaceId, tenant.projectId]);
    const protocol = await client.query(`UPDATE study_protocols SET status='OUTDATED', updated_at=now() WHERE ${tenantWhere()} AND status NOT IN ('NOT_STARTED','OUTDATED') RETURNING id`, [tenant.workspaceId, tenant.projectId]);
    await audit(client, tenant, input.userId, "INSTRUMENTS_PROTOCOL_MARKED_OUTDATED", { sourceTable: input.sourceTable, sourceId: input.sourceId ?? null, reason: input.reason, links: links.rowCount ?? 0, protocols: protocol.rowCount ?? 0 });
    return { ok: true, markedLinks: links.rowCount ?? 0, markedProtocols: protocol.rowCount ?? 0 };
  });
}
