import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("governance_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function str(value: unknown, fallback = ""): string { return typeof value === "string" && value.trim() ? value : fallback; }
function dt(value: unknown): string { if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString(); return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function int(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function bool(value: unknown, fallback = false): boolean { if (value === true || value === "true" || value === 1) return true; return fallback; }
function hash(payload: unknown): string { return createHash("sha256").update(typeof payload === "string" ? payload : JSON.stringify(payload)).digest("hex"); }
function tenantWhere(alias = ""): string { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
async function audit(client: PoolClient, tenant: ResearchTenant, userId: string, eventType: string, detail: Record<string, unknown>) {
  try {
    await client.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash)
      VALUES ($4,$1,$2,$3,'S1','S1',$5,'1.5.99',$6::jsonb,$7)`,
      [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, JSON.stringify({ eventType, ...detail }), JSON.stringify([]), hash({ eventType, detail })]);
  } catch { /* ignore */ }
}
async function gateApproved(client: PoolClient, tenant: ResearchTenant, gateType: string): Promise<boolean> {
  const gate = await client.query(`SELECT decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type=$3 AND decision='APPROVED' ORDER BY approved_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, gateType]);
  return Boolean(gate.rows[0]);
}
async function ensureWorkspace(client: PoolClient, tenant: ResearchTenant, userId: string): Promise<string> {
  const existing = await client.query(`SELECT id FROM data_governance_workspaces WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
  if (existing.rows[0]) return text((existing.rows[0] as Record<string, unknown>).id);
  const fs = await client.query(`SELECT id FROM formal_studies WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
  const id = `dgw_${randomUUID()}`;
  await client.query(`INSERT INTO data_governance_workspaces (id,workspace_id,project_id,formal_study_id,created_by_user_id,created_at,updated_at) VALUES ($4,$1,$2,$5,$3,now(),now())`,
    [tenant.workspaceId, tenant.projectId, userId, id, fs.rows[0] ? text((fs.rows[0] as Record<string, unknown>).id) : null]);
  return id;
}
type Row = Record<string, unknown>;
async function one(client: PoolClient, sql: string, params: unknown[]): Promise<Row | null> {
  const r = await client.query(sql, params);
  return (r.rows[0] as Row) ?? null;
}
async function many(client: PoolClient, sql: string, params: unknown[]): Promise<Row[]> {
  const r = await client.query(sql, params);
  return r.rows as Row[];
}

// ================= 主讀取 =================
export async function getGovernanceCenter(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const ready = await gateApproved(client, tenant, "RAW_DATA_LOCKED_AND_HANDOFF_READY");
    const wsId = await ensureWorkspace(client, tenant, input.userId);
    const [accessPolicies, cleaningRules] = await Promise.all([
      many(client, `SELECT zone, policy_version AS "policyVersion", status, approved_by AS "approvedBy", approved_at AS "approvedAt", role_matrix AS "roleMatrix" FROM data_access_policies WHERE ${tenantWhere()} ORDER BY zone`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT rule_id AS "ruleId", rule_name AS "ruleName", rule_type AS "ruleType", severity, status, automatic_or_manual AS "auto", variable_scope AS "scope" FROM data_cleaning_rules WHERE ${tenantWhere()} ORDER BY rule_id`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const reasons: string[] = [];
    if (!ready) {
      const assets = await one(client, `SELECT count(*)::int AS n FROM raw_data_assets WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
      const lock = await one(client, `SELECT count(*)::int AS n FROM raw_data_lock_records WHERE ${tenantWhere()} AND record_type='LOCK'`, [tenant.workspaceId, tenant.projectId]);
      const manifest = await one(client, `SELECT count(*)::int AS n FROM raw_data_assets WHERE ${tenantWhere()} AND checksum IS NOT NULL`, [tenant.workspaceId, tenant.projectId]);
      const closeout = await one(client, `SELECT count(*)::int AS n FROM data_collection_closeouts WHERE ${tenantWhere()} AND status='DATA_COLLECTION_CLOSED'`, [tenant.workspaceId, tenant.projectId]);
      if (int(assets?.n) === 0) reasons.push("Raw Data Manifest 未完成（無 Raw Data Asset）");
      if (int(lock?.n) === 0) reasons.push("Raw Data 尚未 Lock（無 LOCK 紀錄）");
      if (int(manifest?.n) === 0) reasons.push("Raw File 缺少 Checksum");
      if (int(closeout?.n) === 0) reasons.push("Data Collection Closeout 尚未完成");
      reasons.unshift("RAW_DATA_LOCKED_AND_HANDOFF_READY 未通過（正式資料治理需在 Raw Data Lock 之後才能啟動）");
      return { ok: true, locked: true, governanceWorkspaceId: wsId, missing: reasons, status: "LOCKED", accessPolicies, cleaningRules };
    }
    const [ws, study, protocol, analysisPlans, prereg, gates, openQueries, quarantine, assets, catalog, variables, mappings, cleanDs, analysisDs, quality] = await Promise.all([
      one(client, `SELECT * FROM data_governance_workspaces WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT id, status, protocol_version FROM formal_studies WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT status, current_version_number AS "version" FROM study_protocols WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT id, version_number AS "version" FROM research_analysis_plans WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 3`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT status FROM preregistration_plans WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT gate_type AS "gateType", decision FROM research_human_gates WHERE ${tenantWhere()} AND gate_type IN ('DATA_GOVERNANCE_AND_SCHEMA_APPROVED','CLEAN_DATASET_VALIDATED','ANALYSIS_DATASET_V1_LOCKED_AND_ANALYSIS_READY') ORDER BY gate_type`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_queries WHERE ${tenantWhere()} AND severity='CRITICAL' AND resolution_status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM quarantine_records WHERE ${tenantWhere()} AND status='QUARANTINED'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM raw_data_assets WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_catalog_items WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n, count(*) FILTER (WHERE status='APPROVED')::int AS approved FROM canonical_variables WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n, count(*) FILTER (WHERE mapping_status='APPROVED')::int AS approved FROM source_canonical_mappings WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT status FROM clean_datasets WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT status FROM analysis_datasets WHERE ${tenantWhere()} AND dataset_type='PRIMARY_CONFIRMATORY_DATASET' LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT total_score, status FROM data_quality_assessments WHERE ${tenantWhere()} ORDER BY checked_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const gatesMap: Record<string, boolean> = {};
    for (const g of gates) gatesMap[text(g.gateType)] = text(g.decision) === "APPROVED";
    return {
      ok: true, locked: false, governanceWorkspaceId: wsId,
      status: str(ws?.status, "NOT_STARTED"), zoneConfig: (ws?.zone_config as Record<string, unknown>) ?? {},
      study: study ?? null, protocol: protocol ?? null, analysisPlans, preregistration: prereg ?? null,
      gates: gatesMap, openCriticalQueries: int(openQueries?.n), quarantineCount: int(quarantine?.n),
      rawAssetCount: int(assets?.n), catalogCount: int(catalog?.n),
      dictionary: { total: int(variables?.n), approved: int(variables?.approved) },
      mappings: { total: int(mappings?.n), approved: int(mappings?.approved) },
      cleanDatasetStatus: str(cleanDs?.status, "NOT_CREATED"),
      analysisDatasetStatus: str(analysisDs?.status, "NOT_CREATED"),
      quality: quality ?? null,
      accessPolicies, cleaningRules,
    };
  });
}

// ================= Data Access Policy & Cleaning Rule 複核（AI_PROPOSED 草稿→核准） =================
export async function approveDataAccessPolicy(tenant: ResearchTenant, input: { userId: string; zone: string }) {
  return withClient(async (client) => {
    const zone = text(input.zone);
    if (!zone) return { ok: false, error: "zone_required" };
    const res = await client.query(`UPDATE data_access_policies SET status='APPROVED', approved_by=$3, approved_at=now(), updated_at=now() WHERE ${tenantWhere()} AND zone=$3 AND status='DRAFT'`, [tenant.workspaceId, tenant.projectId, zone]);
    if (!res.rowCount) {
      const existing = await client.query(`SELECT status FROM data_access_policies WHERE ${tenantWhere()} AND zone=$3`, [tenant.workspaceId, tenant.projectId, zone]);
      return { ok: false, error: existing.rows[0] ? `policy_not_approvable（status=${text((existing.rows[0] as Record<string, unknown>).status)}）` : "policy_zone_not_found" };
    }
    await client.query(`INSERT INTO data_access_audit_log (id,workspace_id,project_id,actor_role,action_type,zone,dataset_ref,detail,created_by_user_id,created_at) VALUES ($4,$1,$2,$5,$6,$7,NULL,$8::jsonb,$3,now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `daal_${randomUUID()}`, "PRINCIPAL_INVESTIGATOR", "POLICY_APPROVED", zone, JSON.stringify({ policyVersion: "v1", status: "APPROVED", provenance: "USER_REVIEWED", note: "研究者核准 AI_PROPOSED 草稿（Data Access 角色矩陣）" })]);
    return { ok: true, zone };
  });
}
export async function approveCleaningRule(tenant: ResearchTenant, input: { userId: string; ruleId: string }) {
  return withClient(async (client) => {
    const ruleId = text(input.ruleId);
    if (!ruleId) return { ok: false, error: "rule_id_required" };
    const res = await client.query(`UPDATE data_cleaning_rules SET status='ACTIVE', updated_at=now() WHERE ${tenantWhere()} AND rule_id=$3 AND status='DRAFT'`, [tenant.workspaceId, tenant.projectId, ruleId]);
    if (!res.rowCount) {
      const existing = await client.query(`SELECT status FROM data_cleaning_rules WHERE ${tenantWhere()} AND rule_id=$3`, [tenant.workspaceId, tenant.projectId, ruleId]);
      return { ok: false, error: existing.rows[0] ? `rule_not_approvable（status=${text((existing.rows[0] as Record<string, unknown>).status)}）` : "rule_not_found" };
    }
    await client.query(`INSERT INTO data_access_audit_log (id,workspace_id,project_id,actor_role,action_type,zone,dataset_ref,detail,created_by_user_id,created_at) VALUES ($4,$1,$2,$5,$6,NULL,$7,$8::jsonb,$3,now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `daal_${randomUUID()}`, "PRINCIPAL_INVESTIGATOR", "CLEANING_RULE_APPROVED", ruleId, JSON.stringify({ status: "ACTIVE", provenance: "USER_REVIEWED", note: "研究者核准 AI_PROPOSED 草稿（Cleaning Rule）" })]);
    return { ok: true, ruleId };
  });
}

// ================= Raw Data Audit =================
export async function runRawDataAudit(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const [assets, locked, pilotAssets, queries] = await Promise.all([
      many(client, `SELECT id, data_type AS "dataType", file_name AS "fileName", checksum, status, pilot_origin AS "pilotOrigin", synthetic FROM raw_data_assets WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM raw_data_lock_records WHERE ${tenantWhere()} AND record_type='LOCK'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM raw_data_assets WHERE ${tenantWhere()} AND (pilot_origin=true OR synthetic=true)`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_queries WHERE ${tenantWhere()} AND severity='CRITICAL' AND resolution_status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const checks: { key: string; label: string; pass: boolean; detail: string }[] = [
      { key: "assets_exist", label: "Raw Data Assets 已登錄", pass: assets.length > 0, detail: `${assets.length} 資產` },
      { key: "locked", label: "Raw Data Lock 紀錄存在", pass: int(locked?.n) > 0, detail: `LOCK ${locked?.n ?? 0}` },
      { key: "all_locked", label: "所有 Raw Asset 狀態為 LOCKED", pass: assets.length > 0 && assets.every((a) => text(a.status) === "LOCKED"), detail: assets.filter((a) => text(a.status) !== "LOCKED").length ? `${assets.filter((a) => text(a.status) !== "LOCKED").length} 筆未 LOCKED` : "全部 LOCKED" },
      { key: "checksums", label: "Checksum 齊全", pass: assets.every((a) => text(a.checksum) !== ""), detail: assets.filter((a) => text(a.checksum) === "").length ? `${assets.filter((a) => text(a.checksum) === "").length} 缺` : "齊全" },
      { key: "no_pilot_mix", label: "無 Pilot/Synthetic 混入 Formal Raw", pass: int(pilotAssets?.n) === 0, detail: `混入 ${pilotAssets?.n ?? 0}` },
      { key: "no_critical_query", label: "無未處理 CRITICAL Data Query", pass: int(queries?.n) === 0, detail: `open ${queries?.n ?? 0}` },
    ];
    const failedCount = checks.filter((c) => !c.pass).length;
    const status = failedCount === 0 ? "PASS" : failedCount <= 2 ? "REVIEW_REQUIRED" : "FAIL";
    await client.query(`INSERT INTO raw_data_audits (id,workspace_id,project_id,checks,status,checked_at,created_by_user_id,updated_at)
      VALUES ($1,$2,$3,$4::jsonb,$5,now(),$6,now())
      ON CONFLICT (id) DO NOTHING`,
      [`rda_${randomUUID()}`, tenant.workspaceId, tenant.projectId, JSON.stringify(checks), status, input.userId]);
    await client.query(`UPDATE data_governance_workspaces SET status='RAW_AUDIT', data_quality_status=CASE WHEN $3='PASS' THEN 'RAW_AUDIT_PASS' ELSE 'RAW_AUDIT_'||$3 END, updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, status]);
    return { ok: true, status, checks, failedCount };
  });
}

// ================= Catalog =================
export async function saveCatalogItem(tenant: ResearchTenant, input: { userId: string; item: Record<string, unknown> }) {
  return withClient(async (client) => {
    const wsId = await ensureWorkspace(client, tenant, input.userId);
    const it = input.item;
    const assetId = str(it.dataAssetId);
    if (!assetId) return { ok: false, error: "data_asset_id_required" };
    await client.query(`INSERT INTO data_catalog_items (id,workspace_id,project_id,formal_study_id,data_asset_id,source_type,source_system,source_record,raw_manifest_id,raw_file_reference,format,encoding,file_size,checksum,row_count,column_count,date_range,site_scope,participant_or_unit_scope,protocol_version,instrument_or_system_version,schema_version,sensitivity_classification,access_level,de_identification_status,ingestion_status,owner,steward,retention_rule,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,now(),now())
      ON CONFLICT (workspace_id, project_id, data_asset_id) DO UPDATE SET source_type=$6, source_system=$7, raw_file_reference=$10, format=$11, checksum=$14, row_count=$15, column_count=$16, date_range=$17::jsonb, sensitivity_classification=$23, access_level=$24, de_identification_status=$25, ingestion_status=$26, owner=$27, steward=$28, retention_rule=$29, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, wsId, `dci_${randomUUID()}`, assetId, str(it.sourceType, "OTHER"), str(it.sourceSystem), str(it.sourceRecord), str(it.rawManifestId), str(it.rawFileReference), str(it.format), str(it.encoding), int(it.fileSize) || null, str(it.checksum), int(it.rowCount) || null, int(it.columnCount) || null, JSON.stringify(record(it.dateRange) ? it.dateRange : {}), str(it.siteScope), str(it.participantOrUnitScope), str(it.protocolVersion), str(it.instrumentOrSystemVersion), str(it.schemaVersion), str(it.sensitivityClassification, "INTERNAL"), str(it.accessLevel, "RESTRICTED"), str(it.deIdentificationStatus, "NOT_STARTED"), str(it.ingestionStatus, "PENDING"), str(it.owner), str(it.steward), str(it.retentionRule), input.userId]);
    return { ok: true, dataAssetId: assetId };
  });
}

// ================= Data Dictionary =================
export async function saveCanonicalVariable(tenant: ResearchTenant, input: { userId: string; variable: Record<string, unknown> }) {
  return withClient(async (client) => {
    const v = input.variable;
    const name = str(v.canonicalName);
    if (!name) return { ok: false, error: "canonical_name_required" };
    await client.query(`INSERT INTO canonical_variables (id,workspace_id,project_id,variable_id,canonical_name,display_label,description,source_asset,source_field,source_instrument,source_item_or_event,construct_id,research_question_ids,hypothesis_ids,variable_role,data_type,unit,allowed_values,valid_range,coding,missing_codes,structural_missing_rule,not_applicable_rule,time_point,study_arm_relevance,site_relevance,sensitive_flag,pii_flag,de_identification_rule,scoring_rule,derivation_rule,analysis_plan_link,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16,$17,$18,$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$3,now(),now())
      ON CONFLICT (workspace_id, project_id, canonical_name) DO UPDATE SET display_label=$7, description=$8, source_asset=$9, source_field=$10, construct_id=$13, variable_role=$16, data_type=$17, unit=$18, allowed_values=$19::jsonb, valid_range=$20::jsonb, coding=$21::jsonb, missing_codes=$22::jsonb, pii_flag=$29, de_identification_rule=$30, scoring_rule=$31, derivation_rule=$32, analysis_plan_link=$33, status='DRAFT', updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `cv_${randomUUID()}`, str(v.variableId) || name, name, str(v.displayLabel), str(v.description), str(v.sourceAsset), str(v.sourceField), str(v.sourceInstrument), str(v.sourceItemOrEvent), str(v.constructId), JSON.stringify(list(v.researchQuestionIds)), JSON.stringify(list(v.hypothesisIds)), str(v.variableRole), str(v.dataType), str(v.unit), JSON.stringify(list(v.allowedValues)), JSON.stringify(record(v.validRange) ? v.validRange : {}), JSON.stringify(record(v.coding) ? v.coding : {}), JSON.stringify(list(v.missingCodes)), str(v.structuralMissingRule), str(v.notApplicableRule), str(v.timePoint), str(v.studyArmRelevance), str(v.siteRelevance), bool(v.sensitiveFlag), bool(v.piiFlag), str(v.deIdentificationRule), str(v.scoringRule), str(v.derivationRule), str(v.analysisPlanLink), str(v.status, "DRAFT")]);
    return { ok: true, canonicalName: name };
  });
}
export async function approveCanonicalVariable(tenant: ResearchTenant, input: { userId: string; canonicalName: string }) {
  return withClient(async (client) => {
    await client.query(`UPDATE canonical_variables SET status='APPROVED', version=version+1, updated_at=now() WHERE ${tenantWhere()} AND canonical_name=$3`, [tenant.workspaceId, tenant.projectId, input.canonicalName]);
    return { ok: true };
  });
}
export async function snapshotDataDictionary(tenant: ResearchTenant, input: { userId: string; reason?: string }) {
  return withClient(async (client) => {
    const rows = await many(client, `SELECT canonical_name AS "canonicalName", variable_role AS "role", data_type AS "dataType", source_asset AS "sourceAsset", source_field AS "sourceField", status, pii_flag AS "pii" FROM canonical_variables WHERE ${tenantWhere()} ORDER BY canonical_name`, [tenant.workspaceId, tenant.projectId]);
    const vcount = await one(client, `SELECT count(*)::int AS n FROM data_dictionary_version_snapshots WHERE ${tenantWhere()} AND logical_id='data-dictionary'`, [tenant.workspaceId, tenant.projectId]);
    const version = int(vcount?.n ?? 0) + 1;
    const payload = { variables: rows, generatedAt: new Date().toISOString() };
    await client.query(`INSERT INTO data_dictionary_version_snapshots (id,workspace_id,project_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($1,$2,$3,'data-dictionary',$4,$5,$6,$7,$8::jsonb,$9,now())`,
      [`ddvs_${randomUUID()}`, tenant.workspaceId, tenant.projectId, version, `v1.${version}`, str(input.reason, "字典核對快照"), hash(payload), JSON.stringify(payload), input.userId]);
    return { ok: true, version };
  });
}

// ================= Mapping =================
export async function saveMapping(tenant: ResearchTenant, input: { userId: string; mapping: Record<string, unknown> }) {
  return withClient(async (client) => {
    const m = input.mapping;
    const src = str(m.sourceAssetId); const field = str(m.sourceFieldName);
    if (!src || !field) return { ok: false, error: "source_asset_and_field_required" };
    const canonicalId = await one(client, `SELECT id FROM canonical_variables WHERE ${tenantWhere()} AND canonical_name=$3`, [tenant.workspaceId, tenant.projectId, str(m.canonicalName)]);
    if (!canonicalId && str(m.canonicalName)) return { ok: false, error: "canonical_variable_not_found（先建立 Canonical Variable）" };
    await client.query(`INSERT INTO source_canonical_mappings (id,workspace_id,project_id,source_asset_id,source_field_name,canonical_variable_id,source_data_type,target_data_type,transformation,code_mapping,unit_conversion,time_zone_conversion,locale_conversion,parsing_rule,conflict_rule,mapping_status,verified_by,verified_at,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18,now(),$3,now(),now())
      ON CONFLICT (workspace_id, project_id, source_asset_id, source_field_name) DO UPDATE SET canonical_variable_id=$7, source_data_type=$8, target_data_type=$9, transformation=$10, code_mapping=$11::jsonb, unit_conversion=$12, time_zone_conversion=$13, locale_conversion=$14, parsing_rule=$15, conflict_rule=$16, mapping_status=$17, verified_by=$18, verified_at=now(), updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `scm_${randomUUID()}`, src, field, canonicalId ? text(canonicalId.id) : null, str(m.sourceDataType), str(m.targetDataType), str(m.transformation), JSON.stringify(record(m.codeMapping) ? m.codeMapping : {}), str(m.unitConversion), str(m.timeZoneConversion), str(m.localeConversion), str(m.parsingRule), str(m.conflictRule), str(m.mappingStatus, "DRAFT"), str(m.verifiedBy)]);
    if (!canonicalId) await client.query(`UPDATE source_canonical_mappings SET mapping_status='SCHEMA_MAPPING_QUERY' WHERE ${tenantWhere()} AND source_asset_id=$3 AND source_field_name=$4`, [tenant.workspaceId, tenant.projectId, src, field]);
    return { ok: true };
  });
}
export async function approveMapping(tenant: ResearchTenant, input: { userId: string; sourceAssetId: string; sourceFieldName: string; approvedBy: string }) {
  return withClient(async (client) => {
    await client.query(`UPDATE source_canonical_mappings SET mapping_status='APPROVED', verified_by=$3, verified_at=now() WHERE ${tenantWhere()} AND source_asset_id=$4 AND source_field_name=$5`, [tenant.workspaceId, tenant.projectId, str(input.approvedBy), input.sourceAssetId, input.sourceFieldName]);
    return { ok: true };
  });
}

// ================= De-identification =================
export async function saveDeidPlan(tenant: ResearchTenant, input: { userId: string; plan: Record<string, unknown> }) {
  return withClient(async (client) => {
    await client.query(`INSERT INTO deidentification_plans (id,workspace_id,project_id,strategy,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5::jsonb,$6,$3,now(),now())
      ON CONFLICT (workspace_id, project_id) DO UPDATE SET strategy=$5::jsonb, status=$6, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `dp_${randomUUID()}`, JSON.stringify(record(input.plan.strategy) ? input.plan.strategy : {}), str(input.plan.status, "IN_PROGRESS")]);
    return { ok: true };
  });
}
export async function runDeidentification(tenant: ResearchTenant, input: { userId: string; run: Record<string, unknown> }) {
  return withClient(async (client) => {
    const r = input.run;
    if (!str(r.method)) return { ok: false, error: "method_required" };
    await client.query(`INSERT INTO deidentification_runs (id,workspace_id,project_id,method,fields_affected,transformation_version,risk_before,risk_after,reviewer,approval,residual_risk,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$3,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `dr_${randomUUID()}`, str(r.method), JSON.stringify(list(r.fieldsAffected)), str(r.transformationVersion), str(r.riskBefore), str(r.riskAfter), str(r.reviewer), str(r.approval), str(r.residualRisk), str(r.status, "IN_PROGRESS")]);
    if (str(r.status) === "APPROVED_FOR_INTERNAL_ANALYSIS" || str(r.status) === "APPROVED_FOR_SHARING") {
      await client.query(`UPDATE deidentification_plans SET status=$3, updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, str(r.status)]);
    }
    await audit(client, tenant, input.userId, "DEIDENTIFICATION_RUN", { method: str(r.method), status: str(r.status, "IN_PROGRESS") });
    return { ok: true };
  });
}

// ================= Cleaning Rules =================
export async function saveCleaningRule(tenant: ResearchTenant, input: { userId: string; rule: Record<string, unknown> }) {
  return withClient(async (client) => {
    const r = input.rule;
    const ruleId = str(r.ruleId);
    if (!ruleId) return { ok: false, error: "rule_id_required" };
    await client.query(`INSERT INTO data_cleaning_rules (id,workspace_id,project_id,rule_id,rule_name,data_source,variable_scope,rule_type,condition,action,severity,source_basis,protocol_reference,analysis_plan_reference,instrument_manual_reference,literature_evidence_link,automatic_or_manual,reviewer_required,version,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$3,now(),now())
      ON CONFLICT (workspace_id, project_id, rule_id) DO UPDATE SET rule_name=$6, data_source=$7, variable_scope=$8::jsonb, rule_type=$9, condition=$10, action=$11, severity=$12, source_basis=$13, protocol_reference=$14, analysis_plan_reference=$15, instrument_manual_reference=$16, literature_evidence_link=$17, automatic_or_manual=$18, reviewer_required=$19, status=$21, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `dcr_${randomUUID()}`, ruleId, str(r.ruleName), str(r.dataSource), JSON.stringify(list(r.variableScope)), str(r.ruleType), str(r.condition), str(r.action), str(r.severity, "MINOR"), str(r.sourceBasis), str(r.protocolReference), str(r.analysisPlanReference), str(r.instrumentManualReference), str(r.literatureEvidenceLink), str(r.automaticOrManual, "MANUAL"), bool(r.reviewerRequired), str(r.version, "v1"), str(r.status, "DRAFT")]);
    return { ok: true, ruleId };
  });
}

// ================= Pipeline & Quarantine & Adjudication & Duplicates & Missing & Outlier =================
export async function runPipeline(tenant: ResearchTenant, input: { userId: string; pipelineKey: string; params?: Record<string, unknown> }) {
  return withClient(async (client) => {
    const runId = `pr_${randomUUID()}`;
    const steps = [
      { step: 1, name: "Raw Asset Verification", status: "PENDING" }, { step: 2, name: "Checksum Verification", status: "PENDING" },
      { step: 3, name: "Schema Validation", status: "PENDING" }, { step: 4, name: "Participant Code Validation", status: "PENDING" },
      { step: 5, name: "Consent & Eligibility Check", status: "PENDING" }, { step: 6, name: "Duplicate Detection", status: "PENDING" },
      { step: 7, name: "Correction Application", status: "PENDING" }, { step: 8, name: "Type Conversion & Range Check", status: "PENDING" },
      { step: 9, name: "Logic & Temporal Check", status: "PENDING" }, { step: 10, name: "Missingness Classification", status: "PENDING" },
      { step: 11, name: "Outlier Flagging", status: "PENDING" }, { step: 12, name: "Reverse Coding & Scoring", status: "PENDING" },
      { step: 13, name: "Longitudinal & Multi-site", status: "PENDING" }, { step: 14, name: "Dataset Validation", status: "PENDING" },
    ];
    await client.query(`INSERT INTO pipeline_runs (id,workspace_id,project_id,pipeline_key,input_dataset_version,step_log,parameters,output_dataset_version,row_count_before,row_count_after,variables_added,variables_modified,records_flagged,records_quarantined,log_reference,performed_by,status,started_at,created_by_user_id)
      VALUES ($4,$1,$2,$5,$6,$7::jsonb,$8::jsonb,NULL,NULL,NULL,$9::jsonb,$10::jsonb,NULL,NULL,NULL,$11,'RUNNING',now(),$3)`,
      [tenant.workspaceId, tenant.projectId, input.userId, runId, input.pipelineKey, str(input.params?.inputVersion), JSON.stringify(steps), JSON.stringify(record(input.params) ? input.params : {}), JSON.stringify([]), JSON.stringify([]), str(input.params?.performedBy)]);
    return { ok: true, runId };
  });
}
export async function createQuarantineRecord(tenant: ResearchTenant, input: { userId: string; record: Record<string, unknown> }) {
  return withClient(async (client) => {
    const qr = input.record;
    await client.query(`INSERT INTO quarantine_records (id,workspace_id,project_id,source_asset_id,source_record,reason_category,reason_detail,checksum_mismatch,schema_mismatch,consent_incomplete,unresolved_query,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12,'QUARANTINED',$3,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `qr_${randomUUID()}`, str(qr.sourceAssetId), str(qr.sourceRecord), str(qr.reasonCategory), str(qr.reasonDetail), bool(qr.checksumMismatch), bool(qr.schemaMismatch), bool(qr.consentIncomplete), bool(qr.unresolvedQuery)]);
    return { ok: true };
  });
}
export async function createAdjudication(tenant: ResearchTenant, input: { userId: string; adjudication: Record<string, unknown> }) {
  return withClient(async (client) => {
    const a = input.adjudication;
    if (!str(a.issue)) return { ok: false, error: "issue_required" };
    await client.query(`INSERT INTO data_adjudications (id,workspace_id,project_id,source_query_id,issue,affected_record,evidence,query_type,proposed_resolution,adjudicator,resolution,resolution_basis,correction_record_id,exclusion_flag,resolved_at,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$3,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `da_${randomUUID()}`, str(a.sourceQueryId), str(a.issue), str(a.affectedRecord), str(a.evidence), str(a.queryType), str(a.proposedResolution), str(a.adjudicator), str(a.resolution), str(a.resolutionBasis), str(a.correctionRecordId), str(a.exclusionFlag), str(a.resolvedAt) || null, str(a.status, "OPEN")]);
    if (str(a.status).startsWith("RESOLVED")) await audit(client, tenant, input.userId, "DATA_ADJUDICATED", { issue: str(a.issue), status: str(a.status) });
    return { ok: true };
  });
}
export async function resolveDuplicate(tenant: ResearchTenant, input: { userId: string; resolution: Record<string, unknown> }) {
  return withClient(async (client) => {
    const d = input.resolution;
    if (!str(d.canonicalRecord) || !str(d.duplicateRecord)) return { ok: false, error: "canonical_and_duplicate_required" };
    await client.query(`INSERT INTO duplicate_resolutions (id,workspace_id,project_id,canonical_record,duplicate_record,duplicate_reason,detection_basis,retention_decision,exclusion_flag,adjudicator,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$3,now())
      ON CONFLICT (workspace_id, project_id, duplicate_record) DO UPDATE SET canonical_record=$5, duplicate_reason=$7, retention_decision=$9, exclusion_flag=$10, adjudicator=$11`,
      [tenant.workspaceId, tenant.projectId, input.userId, `dr_${randomUUID()}`, str(d.canonicalRecord), str(d.duplicateRecord), str(d.duplicateReason), str(d.detectionBasis), str(d.retentionDecision), str(d.exclusionFlag), str(d.adjudicator)]);
    return { ok: true };
  });
}
export async function classifyMissing(tenant: ResearchTenant, input: { userId: string; items: Record<string, unknown>[] }) {
  return withClient(async (client) => {
    for (const it of list(input.items)) {
      if (!record(it)) continue;
      const reason = str(it.reason);
      const allowed = ["TRUE_MISSING", "NOT_APPLICABLE", "NOT_ASKED", "STRUCTURAL_MISSING", "PARTICIPANT_SKIPPED", "TECHNICAL_FAILURE", "LOST_TO_FOLLOW_UP", "WITHDRAWN", "DATA_NOT_YET_RELEASED", "OUT_OF_WINDOW", "SENSOR_LOSS", "LOGGING_FAILURE", "SOURCE_UNAVAILABLE", "UNKNOWN"];
      if (!allowed.includes(reason)) continue;
      await client.query(`INSERT INTO missing_classification_items (id,workspace_id,project_id,participant_code,variable_id,time_point,reason,pattern,related_deviation,related_technical_issue,status,created_by_user_id,created_at)
        VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,'CLASSIFIED',$3,now())`,
        [tenant.workspaceId, tenant.projectId, input.userId, `mci_${randomUUID()}`, str(it.participantCode), str(it.variableId), str(it.timePoint), reason, str(it.pattern), str(it.relatedDeviation), str(it.relatedTechnicalIssue)]);
    }
    return { ok: true, classified: list(input.items).length };
  });
}
export async function flagOutlier(tenant: ResearchTenant, input: { userId: string; flag: Record<string, unknown> }) {
  return withClient(async (client) => {
    const f = input.flag;
    if (!str(f.variableOrRecord)) return { ok: false, error: "variable_or_record_required" };
    await client.query(`INSERT INTO outlier_flags (id,workspace_id,project_id,variable_or_record,detection_method,threshold,threshold_basis,severity,contextual_review,technical_explanation,participant_explanation,action,exclusion_status,reviewer,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$3,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `of_${randomUUID()}`, str(f.variableOrRecord), str(f.detectionMethod), str(f.threshold), str(f.thresholdBasis), str(f.severity, "MINOR"), str(f.contextualReview), str(f.technicalExplanation), str(f.participantExplanation), str(f.action, "RETAIN_WITH_FLAG"), str(f.exclusionStatus), str(f.reviewer)]);
    return { ok: true };
  });
}
export async function saveInclusionDecision(tenant: ResearchTenant, input: { userId: string; decision: Record<string, unknown> }) {
  return withClient(async (client) => {
    const d = input.decision;
    const unit = str(d.participantOrUnit);
    if (!unit) return { ok: false, error: "participant_or_unit_required" };
    await client.query(`INSERT INTO analysis_inclusion_decisions (id,workspace_id,project_id,participant_or_unit,enrolled_flag,consent_valid_flag,eligibility_valid_flag,primary_outcome_available,protocol_population_flag,intention_to_treat_flag,per_protocol_flag,safety_population_flag,qualitative_population_flag,sensor_population_flag,exclusion_reason,decision_basis,adjudicator,decision_date,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now(),$3,now(),now())
      ON CONFLICT (workspace_id, project_id, participant_or_unit) DO UPDATE SET enrolled_flag=$6, consent_valid_flag=$7, eligibility_valid_flag=$8, primary_outcome_available=$9, protocol_population_flag=$10, intention_to_treat_flag=$11, per_protocol_flag=$12, safety_population_flag=$13, qualitative_population_flag=$14, sensor_population_flag=$15, exclusion_reason=$16, decision_basis=$17, adjudicator=$18, decision_date=now(), updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `aid_${randomUUID()}`, unit, bool(d.enrolledFlag), bool(d.consentValidFlag), bool(d.eligibilityValidFlag), bool(d.primaryOutcomeAvailable), bool(d.protocolPopulationFlag), bool(d.intentionToTreatFlag), bool(d.perProtocolFlag), bool(d.safetyPopulationFlag), bool(d.qualitativePopulationFlag), bool(d.sensorPopulationFlag), str(d.exclusionReason), str(d.decisionBasis), str(d.adjudicator)]);
    return { ok: true, participantOrUnit: unit };
  });
}

// ================= Scoring & Derived =================
export async function runScaleScoring(tenant: ResearchTenant, input: { userId: string; run: Record<string, unknown> }) {
  return withClient(async (client) => {
    const r = input.run;
    if (!str(r.instrumentId)) return { ok: false, error: "instrument_id_required" };
    await client.query(`INSERT INTO scale_scoring_runs (id,workspace_id,project_id,instrument_id,instrument_version,scale,subscale,source_items,reverse_items,reverse_coding_rule,missing_item_rule,minimum_valid_items,raw_score_formula,transformed_score_formula,output_variable,scoring_version,quality_flags,log,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20,$3,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `ssr_${randomUUID()}`, str(r.instrumentId), str(r.instrumentVersion), str(r.scale), str(r.subscale), JSON.stringify(list(r.sourceItems)), JSON.stringify(list(r.reverseItems)), str(r.reverseCodingRule), str(r.missingItemRule), int(r.minimumValidItems) || null, str(r.rawScoreFormula), str(r.transformedScoreFormula), str(r.outputVariable), str(r.scoringVersion, "v1"), JSON.stringify(list(r.qualityFlags)), JSON.stringify(list(r.log)), str(r.status, "PENDING")]);
    return { ok: true };
  });
}
export async function saveDerivedVariable(tenant: ResearchTenant, input: { userId: string; variable: Record<string, unknown> }) {
  return withClient(async (client) => {
    const v = input.variable;
    const name = str(v.variableName);
    if (!name) return { ok: false, error: "variable_name_required" };
    await client.query(`INSERT INTO derived_variables (id,workspace_id,project_id,variable_name,description,source_variables,formula_or_code,unit,time_window,aggregation_method,normalization,missing_rule,rationale,related_rq,related_analysis,version,validation_status,exploratory,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$3,now(),now())
      ON CONFLICT (workspace_id, project_id, variable_name) DO UPDATE SET description=$6, source_variables=$7::jsonb, formula_or_code=$8, unit=$9, time_window=$10, aggregation_method=$11, normalization=$12, missing_rule=$13, rationale=$14, related_rq=$15, related_analysis=$16, exploratory=$19, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `dv_${randomUUID()}`, name, str(v.description), JSON.stringify(list(v.sourceVariables)), str(v.formulaOrCode), str(v.unit), str(v.timeWindow), str(v.aggregationMethod), str(v.normalization), str(v.missingRule), str(v.rationale), str(v.relatedRq), str(v.relatedAnalysis), str(v.version, "v1"), str(v.validationStatus, "UNVALIDATED"), bool(v.exploratory)]);
    return { ok: true, variableName: name };
  });
}

// ================= Longitudinal / Multi-site / Sensor / Log / Transcript / AI =================
export async function saveLongitudinalLink(tenant: ResearchTenant, input: { userId: string; link: Record<string, unknown> }) {
  return withClient(async (client) => {
    const l = input.link;
    const recId = str(l.longitudinalRecordId);
    if (!recId) return { ok: false, error: "longitudinal_record_id_required" };
    await client.query(`INSERT INTO longitudinal_links (id,workspace_id,project_id,longitudinal_record_id,participant_code,time_point,expected_date,actual_date,window_status,linked_session_id,completeness,deviation,inclusion_flag,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$3,now())
      ON CONFLICT (workspace_id, project_id, longitudinal_record_id) DO UPDATE SET window_status=$10, actual_date=$9, linked_session_id=$11, completeness=$12, deviation=$13, inclusion_flag=$14`,
      [tenant.workspaceId, tenant.projectId, input.userId, `ll_${randomUUID()}`, recId, str(l.participantCode), str(l.timePoint), str(l.expectedDate) || null, str(l.actualDate) || null, str(l.windowStatus, "UNKNOWN"), str(l.linkedSessionId), str(l.completeness), str(l.deviation), bool(l.inclusionFlag, true)]);
    return { ok: true };
  });
}
export async function saveHarmonizationRule(tenant: ResearchTenant, input: { userId: string; rule: Record<string, unknown> }) {
  return withClient(async (client) => {
    const r = input.rule;
    if (!str(r.site) || !str(r.sourceField)) return { ok: false, error: "site_and_source_field_required" };
    await client.query(`INSERT INTO site_harmonization_rules (id,workspace_id,project_id,site,source_field,canonical_field,conversion,unresolved_difference,comparability_flag,reviewer,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12,$3,now(),now())
      ON CONFLICT (workspace_id, project_id, site, source_field) DO UPDATE SET canonical_field=$7, conversion=$8, unresolved_difference=$9, comparability_flag=$10, reviewer=$11, status=$12, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `shr_${randomUUID()}`, str(r.site), str(r.sourceField), str(r.canonicalField), str(r.conversion), str(r.unresolvedDifference), str(r.comparabilityFlag, "COMPARABLE"), str(r.reviewer), str(r.status, "DRAFT")]);
    return { ok: true };
  });
}
export async function runSensorProcessing(tenant: ResearchTenant, input: { userId: string; run: Record<string, unknown> }) {
  return withClient(async (client) => {
    const r = input.run;
    if (!str(r.rawFileId)) return { ok: false, error: "raw_file_id_required" };
    await client.query(`INSERT INTO sensor_processing_runs (id,workspace_id,project_id,raw_file_id,processing_recipe_version,steps,code_hash,parameters,output_file,checksum,quality_report,reviewer,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12::jsonb,$13,$14,$3,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `spr_${randomUUID()}`, str(r.rawFileId), str(r.processingRecipeVersion), JSON.stringify(list(r.steps)), str(r.codeHash), JSON.stringify(record(r.parameters) ? r.parameters : {}), str(r.outputFile), str(r.checksum), JSON.stringify(record(r.qualityReport) ? r.qualityReport : {}), str(r.reviewer), str(r.status, "RUNNING")]);
    return { ok: true };
  });
}
export async function runEventLogProcessing(tenant: ResearchTenant, input: { userId: string; run: Record<string, unknown> }) {
  return withClient(async (client) => {
    const r = input.run;
    await client.query(`INSERT INTO event_log_processing_runs (id,workspace_id,project_id,batch_ref,recipe_version,steps,features,code_hash,output_checksum,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$3,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `elpr_${randomUUID()}`, str(r.batchRef), str(r.recipeVersion), JSON.stringify(list(r.steps)), JSON.stringify(list(r.features)), str(r.codeHash), str(r.outputChecksum), str(r.status, "RUNNING")]);
    return { ok: true };
  });
}
export async function saveTranscriptRecord(tenant: ResearchTenant, input: { userId: string; record: Record<string, unknown> }) {
  return withClient(async (client) => {
    const t = input.record;
    if (!str(t.sourceRecord)) return { ok: false, error: "source_record_required" };
    const stage = str(t.transcriptStage, "AUTOMATED_DRAFT");
    if (stage === "HUMAN_VERIFIED" && !bool(t.humanVerification)) return { ok: false, error: "human_verified_requires_verification（自動轉錄不得直接標示 VERIFIED）" };
    if (stage === "VERIFIED_TRANSLATION" && !bool(t.translationVerified)) return { ok: false, error: "verified_translation_requires_verification" };
    await client.query(`INSERT INTO transcript_preparation_records (id,workspace_id,project_id,source_record,guide_version,transcript_stage,transcription_method,human_verification,de_identification_status,translation_status,speaker_labels,timestamp_alignment,redaction_log,quality_status,version,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$3,now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `tpr_${randomUUID()}`, str(t.sourceRecord), str(t.guideVersion), stage, str(t.transcriptionMethod), bool(t.humanVerification), str(t.deIdentificationStatus), str(t.translationStatus), bool(t.speakerLabels), bool(t.timestampAlignment), JSON.stringify(list(t.redactionLog)), str(t.qualityStatus), str(t.version, "v1")]);
    return { ok: true };
  });
}
export async function saveAiDataset(tenant: ResearchTenant, input: { userId: string; record: Record<string, unknown> }) {
  return withClient(async (client) => {
    const r = input.record;
    const key = str(r.datasetKey);
    if (!key) return { ok: false, error: "dataset_key_required" };
    if (!str(r.splitUnit)) return { ok: false, error: "split_unit_required（同一單位不得跨 Train/Test 造成 Leakage）" };
    await client.query(`INSERT INTO ai_dataset_governance_records (id,workspace_id,project_id,dataset_key,dataset_purpose,label_definition,annotation_version,split_unit,split_manifest,split_method,random_seed,stratification,group_constraint,leakage_checks,dataset_card,checksum,locked_status,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,'UNLOCKED',$18,$3,now(),now())
      ON CONFLICT (workspace_id, project_id, dataset_key) DO UPDATE SET dataset_purpose=$6, label_definition=$7, annotation_version=$8, split_unit=$9, split_manifest=$10::jsonb, split_method=$11, random_seed=$12, stratification=$13, group_constraint=$14, leakage_checks=$15::jsonb, dataset_card=$16::jsonb, checksum=$17, status=$18, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `ai_${randomUUID()}`, key, str(r.datasetPurpose), str(r.labelDefinition), str(r.annotationVersion), str(r.splitUnit), JSON.stringify(record(r.splitManifest) ? r.splitManifest : {}), str(r.splitMethod), str(r.randomSeed), str(r.stratification), str(r.groupConstraint), JSON.stringify(list(r.leakageChecks)), JSON.stringify(record(r.datasetCard) ? r.datasetCard : {}), str(r.checksum), str(r.status, "DRAFT")]);
    return { ok: true, datasetKey: key };
  });
}
export async function checkAiLeakage(tenant: ResearchTenant, input: { userId: string; datasetKey: string }) {
  return withClient(async (client) => {
    const rec = await one(client, `SELECT split_manifest AS "m", split_unit AS "u" FROM ai_dataset_governance_records WHERE ${tenantWhere()} AND dataset_key=$3`, [tenant.workspaceId, tenant.projectId, input.datasetKey]);
    if (!rec) return { ok: false, error: "ai_dataset_not_found" };
    const manifest = record(rec.m) ? (rec.m as Record<string, unknown>) : {};
    const units = (["train", "validation", "test"] as const).map((k) => Array.isArray(manifest[k]) ? (manifest[k] as unknown[]) : []);
    const overlap: string[] = [];
    if (units[0].length && units[1].length) for (const u of units[0]) if (units[1].includes(u)) overlap.push(String(u));
    if (units[0].length && units[2].length) for (const u of units[0]) if (units[2].includes(u)) overlap.push(String(u));
    if (units[1].length && units[2].length) for (const u of units[1]) if (units[2].includes(u)) overlap.push(String(u));
    const uniqueOverlap = [...new Set(overlap)];
    await client.query(`UPDATE ai_dataset_governance_records SET leakage_checks = leakage_checks || $3::jsonb, status=CASE WHEN $4::text[] <> '{}' THEN 'REVIEW_REQUIRED' ELSE status END, updated_at=now() WHERE ${tenantWhere()} AND dataset_key=$5`,
      [tenant.workspaceId, tenant.projectId, JSON.stringify([{ check: "TRAIN_VAL_TEST_OVERLAP", blocked: uniqueOverlap.length > 0, overlap: uniqueOverlap.slice(0, 20), checkedAt: new Date().toISOString() }]), uniqueOverlap, input.datasetKey]);
    if (uniqueOverlap.length > 0) return { ok: false, error: "DATA_LEAKAGE_BLOCKING_ERROR（同一 split unit 出現在多個 split）", overlap: uniqueOverlap.slice(0, 20) };
    return { ok: true };
  });
}
export async function saveCohort(tenant: ResearchTenant, input: { userId: string; cohort: Record<string, unknown> }) {
  return withClient(async (client) => {
    const c = input.cohort;
    const id = str(c.cohortId);
    if (!id) return { ok: false, error: "cohort_id_required" };
    await client.query(`INSERT INTO dataset_cohorts (id,workspace_id,project_id,cohort_id,definition,inclusion_rules,exclusion_rules,source_fields,protocol_reference,analysis_plan_reference,preregistration_reference,participant_count,excluded_count,reason_summary,version,post_hoc,approval,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$3,now(),now())
      ON CONFLICT (workspace_id, project_id, cohort_id) DO UPDATE SET definition=$6, inclusion_rules=$7::jsonb, exclusion_rules=$8::jsonb, source_fields=$9::jsonb, participant_count=$13, excluded_count=$14, reason_summary=$15, post_hoc=$17, approval=$18, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `dc_${randomUUID()}`, id, str(c.definition), JSON.stringify(list(c.inclusionRules)), JSON.stringify(list(c.exclusionRules)), JSON.stringify(list(c.sourceFields)), str(c.protocolReference), str(c.analysisPlanReference), str(c.preregistrationReference), int(c.participantCount) || null, int(c.excludedCount) || null, str(c.reasonSummary), str(c.version, "v1"), bool(c.postHoc), str(c.approval)]);
    return { ok: true, cohortId: id };
  });
}

// ================= Clean Dataset =================
export async function buildCleanDataset(tenant: ResearchTenant, input: { userId: string; params?: Record<string, unknown> }) {
  return withClient(async (client) => {
    const p = input.params ?? {};
    const [assets, corrections, resolvedQueries, quarantined, inclusionRows, scoredRuns] = await Promise.all([
      one(client, `SELECT count(*)::int AS n FROM raw_data_assets WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM source_data_corrections WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_queries WHERE ${tenantWhere()} AND resolution_status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM quarantine_records WHERE ${tenantWhere()} AND status='QUARANTINED'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM analysis_inclusion_decisions WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM scale_scoring_runs WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const dsId = str(p.datasetId, "clean_v1");
    const datasetId = `cds_${randomUUID()}`;
    await client.query(`INSERT INTO clean_datasets (id,workspace_id,project_id,dataset_id,current_version,input_raw_manifest,pipeline_version,row_count,column_count,participant_or_unit_count,sites,time_points,variables,excluded_from_clean_count,quarantined_count,query_summary,checksum,validation_status,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,'v1.0',$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,0,$14,$15::jsonb,$16,'VALIDATION_REQUIRED','BUILDING',$3,now(),now())
      ON CONFLICT (workspace_id, project_id, dataset_id) DO UPDATE SET row_count=$8, column_count=$9, participant_or_unit_count=$10, quarantined_count=$14, validation_status='VALIDATION_REQUIRED', status='BUILDING', updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, datasetId, dsId, str(p.inputRawManifest) || "依 Raw Manifest", str(p.pipelineVersion, "pipeline-v1"), int(p.rowCount) ?? int(assets?.n ?? 0), int(p.columnCount) ?? null, int(p.participantCount) ?? null, JSON.stringify(list(p.sites)), JSON.stringify(list(p.timePoints)), JSON.stringify(list(p.variables)), int(quarantined?.n ?? 0), JSON.stringify({ openQueries: int(resolvedQueries?.n ?? 0), correctionsApplied: int(corrections?.n ?? 0), inclusionDecisions: int(inclusionRows?.n ?? 0), scoringRuns: int(scoredRuns?.n ?? 0) }), str(p.checksum)]);
    await client.query(`UPDATE data_governance_workspaces SET status='CLEAN_DATA_READY', updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    return { ok: true, datasetId: dsId };
  });
}
export async function validateCleanDataset(tenant: ResearchTenant, input: { userId: string; datasetId: string; reviewer?: string }) {
  return withClient(async (client) => {
    const [openCritical, quarantined, rawUntouched] = await Promise.all([
      one(client, `SELECT count(*)::int AS n FROM data_queries WHERE ${tenantWhere()} AND severity='CRITICAL' AND resolution_status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM quarantine_records WHERE ${tenantWhere()} AND status='QUARANTINED'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM raw_data_assets WHERE ${tenantWhere()} AND status<>'LOCKED'`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const failed: { key: string; label: string; detail: string }[] = [];
    if (int(openCritical?.n) > 0) failed.push({ key: "critical_queries", label: "無未處理 CRITICAL Query", detail: `${openCritical?.n} open` });
    if (int(quarantined?.n) > 0) failed.push({ key: "quarantine", label: "Quarantine 已裁決", detail: `${quarantined?.n} 筆` });
    if (int(rawUntouched?.n) > 0) failed.push({ key: "raw_untouched", label: "Raw Data 未被修改（全數 LOCKED）", detail: `${rawUntouched?.n} 筆非 LOCKED` });
    if (failed.length) return { ok: false, failed };
    await client.query(`UPDATE clean_datasets SET validation_status='VALIDATED', status='VALIDATED', updated_at=now() WHERE ${tenantWhere()} AND dataset_id=$3`, [tenant.workspaceId, tenant.projectId, input.datasetId]);
    await audit(client, tenant, input.userId, "CLEAN_DATASET_VALIDATED", { datasetId: input.datasetId, reviewer: str(input.reviewer) });
    return { ok: true };
  });
}

// ================= Analysis Dataset =================
export async function buildAnalysisDataset(tenant: ResearchTenant, input: { userId: string; dataset: Record<string, unknown> }) {
  return withClient(async (client) => {
    const d = input.dataset;
    const dsId = str(d.datasetId);
    if (!dsId) return { ok: false, error: "dataset_id_required" };
    const vars = list(d.includedVariables);
    if (vars.length === 0) return { ok: false, error: "included_variables_required（Analysis Plan 所需變數不存在時 Gate 失敗）" };
    const type = str(d.datasetType, "PRIMARY_CONFIRMATORY_DATASET");
    const exists = await one(client, `SELECT id, status, lock_status AS "lockStatus" FROM analysis_datasets WHERE ${tenantWhere()} AND dataset_id=$3`, [tenant.workspaceId, tenant.projectId, dsId]);
    if (exists && text(exists.lockStatus) === "LOCKED") return { ok: false, error: "analysis_dataset_locked（修正需建立新版本）" };
    if (exists && text(exists.lockStatus) === "FROZEN") return { ok: false, error: "analysis_dataset_frozen（需 Dataset Correction Request 後建立新版本）" };
    const id = `ad_${randomUUID()}`;
    await client.query(`INSERT INTO analysis_datasets (id,workspace_id,project_id,dataset_id,dataset_type,dataset_name,dataset_purpose,analysis_plan_version,cohort_definition,source_clean_dataset,included_variables,derived_variables,scoring_versions,time_points,sites,masked_group_status,missingness_status,outlier_flags,imputation_status,weighting_status,transformation_manifest,row_count,participant_or_unit_count,checksum,code_version,lock_status,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19::jsonb,$20,$21,$22,$23,$24,$25,$26,'UNLOCKED','VALIDATION_REQUIRED',$3,now(),now())
      ON CONFLICT (workspace_id, project_id, dataset_id) DO UPDATE SET dataset_type=$6, dataset_name=$7, dataset_purpose=$8, analysis_plan_version=$9, cohort_definition=$10, source_clean_dataset=$11, included_variables=$12::jsonb, derived_variables=$13::jsonb, scoring_versions=$14::jsonb, time_points=$15::jsonb, sites=$16::jsonb, masked_group_status=$17, missingness_status=$18, outlier_flags=$19::jsonb, imputation_status=$20, weighting_status=$21, transformation_manifest=$22, row_count=$23, participant_or_unit_count=$24, checksum=$25, code_version=$26, status='VALIDATION_REQUIRED', updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, id, dsId, type, str(d.datasetName, dsId), str(d.datasetPurpose), str(d.analysisPlanVersion), str(d.cohortDefinition), str(d.sourceCleanDataset), JSON.stringify(vars), JSON.stringify(list(d.derivedVariables)), JSON.stringify(list(d.scoringVersions)), JSON.stringify(list(d.timePoints)), JSON.stringify(list(d.sites)), str(d.maskedGroupStatus), str(d.missingnessStatus), JSON.stringify(list(d.outlierFlags)), str(d.imputationStatus, "NOT_REQUIRED"), str(d.weightingStatus, "NOT_REQUIRED"), str(d.transformationManifest), int(d.rowCount) || null, int(d.participantCount) || null, str(d.checksum), str(d.codeVersion)]);
    for (const v of vars) {
      const vName = text(v);
      await client.query(`INSERT INTO data_lineage_edges (id,workspace_id,project_id,from_type,from_id,to_type,to_id,dataset_version,created_by_user_id,created_at)
        VALUES ($4,$1,$2,'RAW_OR_DERIVED',$5,'ANALYSIS_DATASET',$6,$7,$3,now())
        ON CONFLICT DO NOTHING`,
        [tenant.workspaceId, tenant.projectId, input.userId, `dle_${randomUUID()}`, vName, dsId, "v1.0"]);
    }
    await client.query(`UPDATE data_governance_workspaces SET status='ANALYSIS_DATA_BUILDING', updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    return { ok: true, datasetId: dsId };
  });
}
export async function freezeAnalysisDataset(tenant: ResearchTenant, input: { userId: string; datasetId: string }) {
  return withClient(async (client) => {
    const rec = await one(client, `SELECT lock_status AS "lockStatus", status FROM analysis_datasets WHERE ${tenantWhere()} AND dataset_id=$3`, [tenant.workspaceId, tenant.projectId, input.datasetId]);
    if (!rec) return { ok: false, error: "dataset_not_found" };
    if (text(rec.lockStatus) === "LOCKED") return { ok: false, error: "already_locked" };
    await client.query(`UPDATE analysis_datasets SET lock_status='FROZEN', status='VALIDATION_REQUIRED', updated_at=now() WHERE ${tenantWhere()} AND dataset_id=$3`, [tenant.workspaceId, tenant.projectId, input.datasetId]);
    await client.query(`INSERT INTO analysis_dataset_lock_records (id,workspace_id,project_id,dataset_id,record_type,checks,recorded_at,created_by_user_id) VALUES ($4,$1,$2,$3,'FREEZE','[]',now(),$5)`, [tenant.workspaceId, tenant.projectId, input.datasetId, `adlr_${randomUUID()}`, input.userId]);
    return { ok: true, frozen: true };
  });
}
export async function lockAnalysisDataset(tenant: ResearchTenant, input: { userId: string; datasetId: string; checks?: Record<string, unknown>[] }) {
  return withClient(async (client) => {
    const rec = await one(client, `SELECT lock_status AS "lockStatus", status FROM analysis_datasets WHERE ${tenantWhere()} AND dataset_id=$3`, [tenant.workspaceId, tenant.projectId, input.datasetId]);
    if (!rec) return { ok: false, error: "dataset_not_found" };
    if (text(rec.lockStatus) !== "FROZEN") return { ok: false, error: "must_freeze_first（需先 Freeze）" };
    const [cleanValidated, cohortApproved, reviews, piiIncluded, criticalQueries, lineageCount, handoffDone, blueprintV6] = await Promise.all([
      one(client, `SELECT validation_status FROM clean_datasets WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM dataset_cohorts WHERE ${tenantWhere()} AND approval IS NOT NULL`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT review_role AS "role", approval_status AS "status" FROM dataset_validation_reviews WHERE ${tenantWhere()} AND reviewed_version='v1.0'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM canonical_variables WHERE ${tenantWhere()} AND pii_flag=true AND status='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_queries WHERE ${tenantWhere()} AND severity='CRITICAL' AND resolution_status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_lineage_edges WHERE ${tenantWhere()} AND to_type='ANALYSIS_DATASET' AND to_id=$3`, [tenant.workspaceId, tenant.projectId, input.datasetId]),
      one(client, `SELECT count(*)::int AS n FROM handoff_packages WHERE ${tenantWhere()} AND version='v1.0'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM research_blueprint_versions WHERE ${tenantWhere()} AND version_label LIKE '%v6%'`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const neededRoles = ["DATA_MANAGER", "STATISTICIAN", "PRINCIPAL_INVESTIGATOR"];
    const approvedRoles = reviews.filter((r) => text(r.status) === "APPROVED").map((r) => text(r.role));
    const failed: { key: string; label: string; detail: string }[] = [];
    if (text(cleanValidated?.validation_status) !== "VALIDATED") failed.push({ key: "clean_validated", label: "Clean Dataset 已驗證", detail: String(cleanValidated?.validation_status) });
    if (int(cohortApproved?.n) === 0) failed.push({ key: "cohort", label: "Analysis Cohorts 已核准", detail: "無已核准 Cohort" });
    for (const role of neededRoles) if (!approvedRoles.includes(role)) failed.push({ key: `signoff_${role}`, label: `${role} 已簽核`, detail: "缺簽核" });
    if (int(piiIncluded?.n) > 0) failed.push({ key: "no_pii", label: "PII 未進入 Analysis Dataset", detail: `${piiIncluded?.n} 個 PII 變數 APPROVED` });
    if (int(criticalQueries?.n) > 0) failed.push({ key: "no_critical", label: "無未處理 CRITICAL Query", detail: `${criticalQueries?.n} open` });
    if (int(lineageCount?.n) === 0) failed.push({ key: "lineage", label: "Raw-to-Analysis Lineage 完整", detail: "無 lineage edge" });
    if (int(handoffDone?.n) === 0) failed.push({ key: "handoff", label: "Analysis Data Handoff Package 完成", detail: "缺 v1.0" });
    if (int(blueprintV6?.n) === 0) failed.push({ key: "bp_v6", label: "Research Blueprint v6 Analysis-Ready 已建立", detail: "缺 v6" });
    if (failed.length) return { ok: false, failed };
    await client.query(`UPDATE analysis_datasets SET lock_status='LOCKED', status='LOCKED', updated_at=now() WHERE ${tenantWhere()} AND dataset_id=$3`, [tenant.workspaceId, tenant.projectId, input.datasetId]);
    await client.query(`INSERT INTO analysis_dataset_lock_records (id,workspace_id,project_id,dataset_id,record_type,checks,recorded_at,created_by_user_id) VALUES ($4,$1,$2,$3,'LOCK',$5::jsonb,now(),$6)`,
      [tenant.workspaceId, tenant.projectId, input.datasetId, `adlr_${randomUUID()}`, JSON.stringify(input.checks ?? []), input.userId]);
    await client.query(`UPDATE data_governance_workspaces SET status='LOCKED_FOR_ANALYSIS', updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    await audit(client, tenant, input.userId, "ANALYSIS_DATASET_LOCKED", { datasetId: input.datasetId });
    return { ok: true, locked: true };
  });
}

// ================= Quality / Lineage / Report / Handoff / Snapshot =================
export async function runQualityAssessment(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const [assets, variables, mappings, deid, queries, missing, outliers, scorings, deriv, lineage, cleanDs, pipelineRuns] = await Promise.all([
      one(client, `SELECT count(*)::int AS n, count(*) FILTER (WHERE status='LOCKED')::int AS locked FROM raw_data_assets WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n, count(*) FILTER (WHERE status='APPROVED')::int AS approved FROM canonical_variables WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n, count(*) FILTER (WHERE mapping_status='APPROVED')::int AS approved FROM source_canonical_mappings WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n, count(*) FILTER (WHERE status IN ('APPROVED_FOR_INTERNAL_ANALYSIS','APPROVED_FOR_SHARING'))::int AS approved FROM deidentification_runs WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_queries WHERE ${tenantWhere()} AND resolution_status NOT IN ('RESOLVED_WITH_CORRECTION','RESOLVED_WITH_FLAG','RESOLVED_AS_VALID')`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM missing_classification_items WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM outlier_flags WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM scale_scoring_runs WHERE ${tenantWhere()} AND status='COMPLETED'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM derived_variables WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_lineage_edges WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT validation_status FROM clean_datasets WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM pipeline_runs WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const totalRaw = int(assets?.n ?? 0);
    const score = {
      rawIntegrity: totalRaw > 0 && int(assets?.locked) === totalRaw ? 15 : totalRaw > 0 ? 10 : 0,
      schemaAndMapping: variables && int(variables.n) > 0 ? Math.min(10, Math.round((int(variables.approved) / int(variables.n)) * 10)) : 0,
      consentEligibility: 5,
      deidentification: deid && int(deid.n) > 0 ? (int(deid.approved) > 0 ? 10 : 5) : 0,
      queryResolution: int(queries?.n ?? 0) === 0 ? 10 : Math.max(0, 10 - int(queries?.n ?? 0)),
      missingnessDocumentation: int(missing?.n ?? 0) > 0 ? 10 : 2,
      scoringAndDerived: (int(scorings?.n ?? 0) + int(deriv?.n ?? 0)) > 0 ? 10 : 0,
      longitudinalSiteHarmonization: 10,
      sensorLogQualitativeReadiness: 5,
      reproducibilityAndLineage: int(lineage?.n ?? 0) > 0 && int(pipelineRuns?.n ?? 0) > 0 ? 10 : 0,
    };
    const total = Object.values(score).reduce((a, b) => a + (b as number), 0);
    const fatal: string[] = [];
    if (totalRaw > 0 && int(assets?.locked) !== totalRaw) fatal.push("Raw Data 未全數 LOCKED");
    if (mappings && int(mappings.n) > 0 && int(mappings.approved) === 0) fatal.push("Canonical Mapping 未核准");
    if (text(cleanDs?.validation_status) === "QUERY_OPEN") fatal.push("Clean Dataset 有 Open Query");
    const status = fatal.length > 0 ? "FAIL" : total >= 80 ? "PASS" : "REVIEW_REQUIRED";
    await client.query(`INSERT INTO data_quality_assessments (id,workspace_id,project_id,score,total_score,fatal_issues,status,checked_at,created_by_user_id,updated_at)
      VALUES ($4,$1,$2,$5::jsonb,$6,$7::jsonb,$8,now(),$3,now())
      ON CONFLICT (id) DO NOTHING`,
      [tenant.workspaceId, tenant.projectId, input.userId, `dqa_${randomUUID()}`, JSON.stringify(score), total, JSON.stringify(fatal), status]);
    await client.query(`UPDATE data_governance_workspaces SET quality_score=$3::jsonb, data_quality_status=$4, updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, JSON.stringify({ total, score, fatal }), status]);
    return { ok: true, total, score, fatal, status };
  });
}
export async function generateDataPreparationReport(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const [ws, assets, variables, mappings, corrections, queries, missing, outliers, scorings, derived, cohorts, cleanDs, analysisDs, quality, deid, quarantine] = await Promise.all([
      one(client, `SELECT * FROM data_governance_workspaces WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM raw_data_assets WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM canonical_variables WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM source_canonical_mappings WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM source_data_corrections WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_queries WHERE ${tenantWhere()} AND resolution_status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM missing_classification_items WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM outlier_flags WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM scale_scoring_runs WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM derived_variables WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM dataset_cohorts WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT * FROM clean_datasets WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT * FROM analysis_datasets WHERE ${tenantWhere()} AND dataset_type='PRIMARY_CONFIRMATORY_DATASET' LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT total_score FROM data_quality_assessments WHERE ${tenantWhere()} ORDER BY checked_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n, count(*) FILTER (WHERE status IN ('APPROVED_FOR_INTERNAL_ANALYSIS','APPROVED_FOR_SHARING'))::int AS approved FROM deidentification_runs WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM quarantine_records WHERE ${tenantWhere()} AND status='QUARANTINED'`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const sections: Record<string, unknown> = {
      identity: { governanceStatus: ws?.status ?? null, rawAssetCount: int(assets?.n), dataQualityTotal: quality?.total_score ?? null },
      sources: { catalogEntries: int(assets?.n) },
      dictionary: { variables: int(variables?.n) },
      mapping: { mappings: int(mappings?.n) },
      corrections: { applied: int(corrections?.n) },
      queries: { open: int(queries?.n) },
      missingness: { classified: int(missing?.n) },
      outliers: { flagged: int(outliers?.n) },
      scoring: { runs: int(scorings?.n) },
      derived: { variables: int(derived?.n) },
      cohorts: { defined: int(cohorts?.n) },
      deidentification: { runs: int(deid?.n), approved: int(deid?.approved) },
      quarantine: { active: int(quarantine?.n) },
      cleanDataset: cleanDs ? { datasetId: cleanDs.dataset_id, version: cleanDs.current_version, validationStatus: cleanDs.validation_status, rowCount: cleanDs.row_count } : null,
      analysisDataset: analysisDs ? { datasetId: analysisDs.dataset_id, status: analysisDs.status, lockStatus: analysisDs.lock_status } : null,
      disclaimer: "本報告僅描述資料準備與治理情況；不含組間差異、p-value、Effect Size 或任何研究結論。",
    };
    await client.query(`INSERT INTO data_preparation_reports (id,workspace_id,project_id,version,sections,disclaimer,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,'v1.0',$5::jsonb,$6,$3,now(),now())
      ON CONFLICT (workspace_id, project_id, version) DO UPDATE SET sections=$5::jsonb, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `dpr_${randomUUID()}`, JSON.stringify(sections), "僅描述資料準備；無統計結果。"]);
    return { ok: true };
  });
}
export async function createHandoffPackage(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const [analysisDs, cleanDs, report, quality, reviews, lineage, dictionary] = await Promise.all([
      one(client, `SELECT dataset_id AS "datasetId", status, lock_status AS "lockStatus", checksum FROM analysis_datasets WHERE ${tenantWhere()} AND dataset_type='PRIMARY_CONFIRMATORY_DATASET' ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT dataset_id AS "datasetId", current_version AS "version" FROM clean_datasets WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT 1 FROM data_preparation_reports WHERE ${tenantWhere()} AND version='v1.0' LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT total_score AS "total", status FROM data_quality_assessments WHERE ${tenantWhere()} ORDER BY checked_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT review_role AS "role", approval_status AS "status" FROM dataset_validation_reviews WHERE ${tenantWhere()} AND reviewed_version='v1.0'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_lineage_edges WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_dictionary_version_snapshots WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
    ]);
    if (!analysisDs) return { ok: false, error: "analysis_dataset_required" };
    const lockStatus = text(analysisDs.lockStatus);
    if (!["FROZEN", "LOCKED"].includes(lockStatus)) return { ok: false, error: "analysis_dataset_must_be_frozen_or_locked" };
    const contents = ["ANALYSIS_DATASET_V1", "DATASET_MANIFEST", "DATA_DICTIONARY", "COHORT_DEFINITIONS", "SCORING_SPECIFICATIONS", "DERIVED_VARIABLE_DEFINITIONS", "MISSING_DATA_REPORT", "OUTLIER_REGISTRY", "PROTOCOL_DEVIATION_FLAGS", "SITE_HARMONIZATION_NOTES", "SENSOR_LOG_PROCESSING_NOTES", "QUALITATIVE_CORPUS_MANIFEST", "AI_SPLIT_MANIFEST", "TRANSFORMATION_PIPELINE", "ENVIRONMENT_DEPENDENCY_LOCK", "DATA_QUALITY_REPORT", "VALIDATION_SIGNOFFS", "KNOWN_LIMITATIONS", "ACCESS_INSTRUCTIONS", "CHECKSUM", "LOCK_RECORD"];
    const checksum = hash({ datasetId: text(analysisDs.datasetId), version: "v1.0", quality: quality?.total ?? null, lineage: int(lineage?.n), dictionaryVersions: int(dictionary?.n) });
    const missing: string[] = [];
    if (text(cleanDs?.datasetId) === "") missing.push("clean_dataset");
    if (!report) missing.push("data_preparation_report");
    if (int(dictionary?.n) === 0) missing.push("data_dictionary_version");
    if (reviews.filter((r) => text(r.status) === "APPROVED").length < 3) missing.push("validation_signoffs");
    const status = missing.length === 0 ? "COMPLETE" : "REVISION_REQUIRED";
    await client.query(`INSERT INTO handoff_packages (id,workspace_id,project_id,version,contents,checksum,lock_record_ref,status,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,'v1.0',$5::jsonb,$6,$7,$8,$3,now(),now())
      ON CONFLICT (workspace_id, project_id, version) DO UPDATE SET contents=$5::jsonb, checksum=$6, status=$8, updated_at=now()`,
      [tenant.workspaceId, tenant.projectId, input.userId, `hp_${randomUUID()}`, JSON.stringify(contents), checksum, text(analysisDs.datasetId), status]);
    return { ok: true, status, missing };
  });
}
export async function saveValidationReview(tenant: ResearchTenant, input: { userId: string; review: Record<string, unknown> }) {
  return withClient(async (client) => {
    const r = input.review;
    const role = str(r.reviewRole);
    if (!role || !str(r.reviewer)) return { ok: false, error: "reviewer_and_role_required" };
    await client.query(`INSERT INTO dataset_validation_reviews (id,workspace_id,project_id,reviewer,review_role,reviewed_version,findings,severity,required_action,approval_status,signed_at,created_by_user_id,created_at,updated_at)
      VALUES ($4,$1,$2,$5,$6,$7,$8::jsonb,$9,$10,$11, CASE WHEN $11='APPROVED' THEN now() END,$3,now(),now())
      ON CONFLICT (id) DO NOTHING`,
      [tenant.workspaceId, tenant.projectId, input.userId, `dvr_${randomUUID()}`, str(r.reviewer), role, str(r.reviewedVersion, "v1.0"), JSON.stringify(list(r.findings)), str(r.severity), str(r.requiredAction), str(r.approvalStatus, "PENDING")]);
    return { ok: true };
  });
}
export async function createResearchSnapshot(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const [cleanDs, analysisDs, cohorts, deid, quality, quarantines, openQueries, outliers, missing] = await Promise.all([
      one(client, `SELECT dataset_id AS "id", current_version AS "version", validation_status AS "status" FROM clean_datasets WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT dataset_id AS "id", status, lock_status AS "lock" FROM analysis_datasets WHERE ${tenantWhere()} AND dataset_type='PRIMARY_CONFIRMATORY_DATASET' ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM dataset_cohorts WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n, count(*) FILTER (WHERE status IN ('APPROVED_FOR_INTERNAL_ANALYSIS','APPROVED_FOR_SHARING'))::int AS approved FROM deidentification_runs WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT total_score AS "total", status FROM data_quality_assessments WHERE ${tenantWhere()} ORDER BY checked_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM quarantine_records WHERE ${tenantWhere()} AND status='QUARANTINED'`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM data_queries WHERE ${tenantWhere()} AND resolution_status IN ('OPEN','IN_PROGRESS')`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM outlier_flags WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM missing_classification_items WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const payload: Record<string, unknown> = {
      clean_dataset: cleanDs ?? null,
      analysis_dataset: analysisDs ?? null,
      cohort_count: int(cohorts?.n),
      deidentification: { runs: int(deid?.n), approved: int(deid?.approved) },
      quality: quality ?? null,
      quarantine_active: int(quarantines?.n),
      open_queries: int(openQueries?.n),
      outlier_flags: int(outliers?.n),
      missing_classified: int(missing?.n),
      snapshot_at: new Date().toISOString(),
    };
    await client.query(`INSERT INTO research_data_preparation_snapshots (id,workspace_id,project_id,version,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,'v1.0',$5::jsonb,$3,now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, `rdps_${randomUUID()}`, JSON.stringify(payload)]);
    return { ok: true };
  });
}
export async function writeBlueprintV6(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const bp = await one(client, `SELECT id FROM research_blueprints WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (!bp) return { ok: false, error: "blueprint_not_found" };
    const bpId = text(bp.id);
    const vcount = await one(client, `SELECT max(version_number)::int AS n FROM research_blueprint_versions WHERE ${tenantWhere()} AND blueprint_id=$3`, [tenant.workspaceId, tenant.projectId, bpId]);
    const version = (int(vcount?.n) || 32) + 1;
    const [cleanDs, analysisDs, quality, variables] = await Promise.all([
      one(client, `SELECT dataset_id AS "id", current_version AS "version", validation_status AS "status" FROM clean_datasets WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT dataset_id AS "id", status, lock_status AS "lock" FROM analysis_datasets WHERE ${tenantWhere()} AND dataset_type='PRIMARY_CONFIRMATORY_DATASET' ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT total_score AS "total" FROM data_quality_assessments WHERE ${tenantWhere()} ORDER BY checked_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]),
      one(client, `SELECT count(*)::int AS n FROM canonical_variables WHERE ${tenantWhere()} AND status='APPROVED'`, [tenant.workspaceId, tenant.projectId]),
    ]);
    const payload: Record<string, unknown> = {
      stage: "DATA_PREPARATION_COMPLETE",
      clean_dataset_version: cleanDs?.version ?? null,
      analysis_dataset_version: analysisDs ? `${text(analysisDs.id)}:${text(analysisDs.status)}` : null,
      canonical_data_dictionary: { approvedVariables: int(variables?.n) },
      data_quality_total: quality?.total ?? null,
      unresolved_data_issues: [],
      note: "AI_PROPOSED 草稿回寫：Research Blueprint v6 Analysis-Ready（Analysis Lab Execution Mode 前置）",
    };
    await client.query(`INSERT INTO research_blueprint_versions (id,workspace_id,project_id,blueprint_id,logical_id,version_number,version_label,reason,content_hash,payload,created_by_user_id,created_at)
      VALUES ($4,$1,$2,$3,$3,$5,'v6.0','Analysis-Ready 資料治理回寫',$6,$7::jsonb,$8,now())`,
      [tenant.workspaceId, tenant.projectId, bpId, `bpv_${randomUUID()}`, version, hash(payload), JSON.stringify(payload), input.userId]);
    return { ok: true, version };
  });
}

// ================= Gates =================
export async function approveGovernanceGate(tenant: ResearchTenant, input: { userId: string; gateType: "DATA_GOVERNANCE_AND_SCHEMA_APPROVED" | "CLEAN_DATASET_VALIDATED" | "ANALYSIS_DATASET_V1_LOCKED_AND_ANALYSIS_READY" }) {
  return withClient(async (client) => {
    const failed: { key: string; label: string; detail: string }[] = [];
    const cat = (n: number, label: string, key: string) => { if (n === 0) failed.push({ key, label, detail: "缺資料" }); };
    if (input.gateType === "DATA_GOVERNANCE_AND_SCHEMA_APPROVED") {
      if (!(await gateApproved(client, tenant, "RAW_DATA_LOCKED_AND_HANDOFF_READY"))) failed.push({ key: "raw_ready", label: "RAW_DATA_LOCKED_AND_HANDOFF_READY 已通過", detail: "未通過" });
      const catalog = await one(client, `SELECT count(*)::int AS n FROM data_catalog_items WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
      cat(int(catalog?.n), "Data Catalog 已完成", "catalog");
      const vars = await one(client, `SELECT count(*)::int AS n FROM canonical_variables WHERE ${tenantWhere()} AND status='APPROVED'`, [tenant.workspaceId, tenant.projectId]);
      cat(int(vars?.n), "Canonical Data Dictionary 已建立（APPROVED 變數）", "dictionary");
      const deid = await one(client, `SELECT count(*)::int AS n FROM deidentification_runs WHERE ${tenantWhere()} AND status IN ('APPROVED_FOR_INTERNAL_ANALYSIS','APPROVED_FOR_SHARING')`, [tenant.workspaceId, tenant.projectId]);
      cat(int(deid?.n), "De-identification 策略已確認", "deid");
      const rules = await one(client, `SELECT count(*)::int AS n FROM data_cleaning_rules WHERE ${tenantWhere()} AND status='ACTIVE'`, [tenant.workspaceId, tenant.projectId]);
      cat(int(rules?.n), "Cleaning Rule Registry 已建立（ACTIVE）", "rules");
    } else if (input.gateType === "CLEAN_DATASET_VALIDATED") {
      const clean = await one(client, `SELECT validation_status FROM clean_datasets WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (text(clean?.validation_status) !== "VALIDATED") failed.push({ key: "clean", label: "Clean Dataset 已 VALIDATED", detail: String(clean?.validation_status) });
      const raw = await one(client, `SELECT count(*)::int AS n FROM raw_data_assets WHERE ${tenantWhere()} AND status<>'LOCKED'`, [tenant.workspaceId, tenant.projectId]);
      if (int(raw?.n) > 0) failed.push({ key: "raw", label: "Raw Data 未被修改", detail: `${raw?.n} 非 LOCKED` });
    } else {
      const ad = await one(client, `SELECT lock_status AS "l", status FROM analysis_datasets WHERE ${tenantWhere()} AND dataset_type='PRIMARY_CONFIRMATORY_DATASET' ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (!ad || text(ad.l) !== "LOCKED") failed.push({ key: "locked", label: "Analysis Dataset v1.0 已 LOCKED", detail: ad ? String(ad.l) : "缺" });
    }
    if (failed.length) return { ok: false, failed };
    const gateId = `hg_${randomUUID()}`;
    await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,created_at,updated_at)
      VALUES ($4,$1,$2,$3,$5,'governance','gov-v1',$6,'APPROVED',$3,now(),now(),now())`,
      [tenant.workspaceId, tenant.projectId, input.userId, gateId, input.gateType, hash({ gateType: input.gateType, at: new Date().toISOString() })]);
    await audit(client, tenant, input.userId, `${input.gateType}_APPROVED`, { humanGateId: gateId });
    if (input.gateType === "ANALYSIS_DATASET_V1_LOCKED_AND_ANALYSIS_READY") {
      await client.query(`UPDATE data_governance_workspaces SET status='LOCKED_FOR_ANALYSIS', updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    }
    return { ok: true, gateType: input.gateType };
  });
}

// ================= 列表（供 UI） =================
export async function getGovernanceLists(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const [catalog, variables, mappings, deidRuns, rules, quarantines, adjudications, duplicates, missing, outliers, inclusions, scorings, derived, longitudinal, harmonization, sensorRuns, logRuns, transcripts, aiDatasets, cohorts, cleanDsRows, analysisDsRows, lockRecs, lineage, qualityRuns, reports, handoffs, snapshots, reviews, accessAudit] = await Promise.all([
      many(client, `SELECT data_asset_id AS "dataAssetId", source_type AS "sourceType", source_system AS "sourceSystem", format, checksum, row_count AS "rowCount", de_identification_status AS "deid" FROM data_catalog_items WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 200`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT canonical_name AS "canonicalName", variable_role AS "role", data_type AS "dataType", pii_flag AS "pii", status FROM canonical_variables WHERE ${tenantWhere()} ORDER BY canonical_name LIMIT 300`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT source_asset_id AS "sourceAsset", source_field_name AS "sourceField", mapping_status AS "status", verified_by AS "verifiedBy" FROM source_canonical_mappings WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 300`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT method, status, reviewer, risk_before AS "riskBefore", risk_after AS "riskAfter" FROM deidentification_runs WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT rule_id AS "ruleId", rule_name AS "ruleName", rule_type AS "ruleType", severity, status FROM data_cleaning_rules WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 300`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT source_asset_id AS "asset", source_record AS "record", reason_category AS "reason", status FROM quarantine_records WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 200`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT issue, affected_record AS "record", status, adjudicator FROM data_adjudications WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 200`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT canonical_record AS "canonical", duplicate_record AS "duplicate", retention_decision AS "decision" FROM duplicate_resolutions WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT participant_code AS "code", variable_id AS "var", reason FROM missing_classification_items WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 300`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT variable_or_record AS "target", detection_method AS "method", action, severity FROM outlier_flags WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 200`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT participant_or_unit AS "unit", protocol_population_flag AS "pp", intention_to_treat_flag AS "itt", per_protocol_flag AS "ppFlag", exclusion_reason AS "reason" FROM analysis_inclusion_decisions WHERE ${tenantWhere()} ORDER BY participant_or_unit LIMIT 400`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT instrument_id AS "instrument", instrument_version AS "version", output_variable AS "output", status FROM scale_scoring_runs WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT variable_name AS "name", exploratory, validation_status AS "validation" FROM derived_variables WHERE ${tenantWhere()} ORDER BY variable_name LIMIT 300`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT longitudinal_record_id AS "id", participant_code AS "code", time_point AS "tp", window_status AS "window", inclusion_flag AS "included" FROM longitudinal_links WHERE ${tenantWhere()} ORDER BY participant_code, time_point LIMIT 400`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT site, source_field AS "field", canonical_field AS "canonical", comparability_flag AS "flag" FROM site_harmonization_rules WHERE ${tenantWhere()} ORDER BY site LIMIT 300`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT raw_file_id AS "file", processing_recipe_version AS "recipe", status, reviewer FROM sensor_processing_runs WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT batch_ref AS "batch", recipe_version AS "recipe", status FROM event_log_processing_runs WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT source_record AS "source", transcript_stage AS "stage", human_verification AS "verified", de_identification_status AS "deid" FROM transcript_preparation_records WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT dataset_key AS "key", split_unit AS "unit", status, locked_status AS "locked" FROM ai_dataset_governance_records WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT cohort_id AS "id", definition, participant_count AS "count", post_hoc AS "postHoc", approval FROM dataset_cohorts WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT dataset_id AS "id", current_version AS "version", validation_status AS "status" FROM clean_datasets WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 20`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT dataset_id AS "id", dataset_type AS "type", status, lock_status AS "lock" FROM analysis_datasets WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 50`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT dataset_id AS "id", record_type AS "type", recorded_at AS "at" FROM analysis_dataset_lock_records WHERE ${tenantWhere()} ORDER BY recorded_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT from_type AS "fromType", from_id AS "fromId", to_type AS "toType", to_id AS "toId" FROM data_lineage_edges WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 500`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT total_score AS "total", status, checked_at AS "at" FROM data_quality_assessments WHERE ${tenantWhere()} ORDER BY checked_at DESC LIMIT 20`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT version, status FROM data_preparation_reports WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 20`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT version, status, checksum FROM handoff_packages WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 20`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT version, created_at AS "at" FROM research_data_preparation_snapshots WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 20`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT reviewer, review_role AS "role", approval_status AS "status", signed_at AS "signedAt" FROM dataset_validation_reviews WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
      many(client, `SELECT actor_role AS "role", action_type AS "action", zone, created_at AS "at" FROM data_access_audit_log WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId]),
    ]);
    return { ok: true, catalog, variables, mappings, deidRuns, rules, quarantines, adjudications, duplicates, missing, outliers, inclusions, scorings, derived, longitudinal, harmonization, sensorRuns, logRuns, transcripts, aiDatasets, cohorts, cleanDatasets: cleanDsRows, analysisDatasets: analysisDsRows, lockRecords: lockRecs, lineage, qualityRuns, reports, handoffs, snapshots, reviews };
  });
}
