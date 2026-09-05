import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import { buildSubmissionContext, type SubmissionContext, type ConfirmedTopic } from "./submission-navigator-context.ts";
import type { NavigatorOutput } from "./submission-navigator-provider.ts";
import type { NavigatorRunRequest } from "./submission-navigator-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export class SubmissionNavigatorV2StorageUnavailable extends Error {
  constructor() { super("submission_navigator_v2_storage_unavailable"); this.name = "SubmissionNavigatorV2StorageUnavailable"; }
}
export class SubmissionNavigatorV2RepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "SubmissionNavigatorV2RepositoryError"; this.code = code; this.status = status; }
}

function tenantWhere(alias = "") { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2 AND ${p}created_by_user_id=$3 AND EXISTS (SELECT 1 FROM workspace_members m09_access WHERE m09_access.workspace_id=$1 AND m09_access.user_id=$3 AND m09_access.role IN ('owner','member'))`; }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) { if (!pool) throw new SubmissionNavigatorV2StorageUnavailable(); const client = await pool.connect(); try { return await operation(client); } finally { client.release(); } }
async function lock(client: PoolClient, tenant: ResearchTenant, key: string) { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`m09:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

export async function resolveConfirmedTopic(tenant: ResearchTenant): Promise<ConfirmedTopic | null> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT p.run_id AS "runId", p.candidate_id AS "candidateId", p.candidate_hash AS "candidateHash", p.human_gate_id AS "humanGateId",
              s.id AS "studyVersionId", s.logical_id AS "logicalId", s.design_payload AS "designPayload"
       FROM research_topic_lab_promotions p
       JOIN research_studies s ON s.workspace_id=p.workspace_id AND s.project_id=p.project_id AND s.id=p.study_version_id
       WHERE ${tenantWhere("p")}
       ORDER BY p.created_at DESC LIMIT 1`,
      [tenant.workspaceId, tenant.projectId],
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0] as Record<string, unknown>;
    const designPayload = record(row.designPayload) ? row.designPayload : {};
    const candidate = record(designPayload.candidate) ? designPayload.candidate : {};
    const run = await client.query(`SELECT result_payload AS "resultPayload" FROM research_topic_lab_runs WHERE ${tenantWhere()} AND id=$3`, [tenant.workspaceId, tenant.projectId, String(row.runId)]);
    return {
      studyVersionId: String(row.studyVersionId),
      logicalId: String(row.logicalId),
      runId: String(row.runId),
      candidateHash: String(row.candidateHash),
      humanGateId: String(row.humanGateId),
      candidate,
      runResultPayload: record(run.rows[0]?.resultPayload) ? run.rows[0].resultPayload : null,
    };
  });
}

export type NavigatorRunRow = {
  id: string;
  runType: "QUICK" | "DEEP";
  targetYear: string;
  targetMode: string;
  status: string;
  topicSnapshot: SubmissionContext | Record<string, unknown> | null;
  fitSummary: Record<string, unknown>;
  createdAt: string;
};

function storedRun(row: Record<string, unknown>): NavigatorRunRow {
  return {
    id: String(row.id),
    runType: String(row.run_type) as NavigatorRunRow["runType"],
    targetYear: String(row.target_year),
    targetMode: String(row.target_mode),
    status: String(row.status),
    topicSnapshot: record(row.topic_snapshot) ? row.topic_snapshot as SubmissionContext : null,
    fitSummary: record(row.fit_summary) ? row.fit_summary : {},
    createdAt: String(row.created_at),
  };
}

export async function createSubmissionContextRun(input: { tenant: ResearchTenant; userId: string; targetYear: string; idempotencyKey: string }) {
  const confirmed = await resolveConfirmedTopic(input.tenant);
  if (!confirmed) throw new SubmissionNavigatorV2RepositoryError("confirmed_topic_not_found", 409);
  const context = buildSubmissionContext({ projectId: input.tenant.projectId, confirmedTopic: confirmed });
  return withClient(async (client) => {
    await lock(client, input.tenant, "context");
    const prior = await client.query(`SELECT id FROM submission_navigator_runs WHERE ${tenantWhere()} AND idempotency_key=$3 LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, input.idempotencyKey]);
    if (prior.rows[0]) return { id: String(prior.rows[0].id), context, idempotent: true };
    const id = `snrun_${randomUUID()}`;
    await client.query(
      `INSERT INTO submission_navigator_runs (id,workspace_id,project_id,created_by_user_id,run_type,target_year,target_mode,source_run_id,source_study_version_id,topic_snapshot,researcher_snapshot,fit_summary,status,idempotency_key) VALUES ($4,$1,$2,$3,'QUICK',$5,'auto',$6,$7,$8::jsonb,'{}'::jsonb,'{}'::jsonb,'PENDING',$9)`,
      [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.targetYear, confirmed.runId, confirmed.studyVersionId, JSON.stringify(context), input.idempotencyKey],
    );
    return { id, context, idempotent: false };
  });
}

export async function insertStructuredMatchRun(input: {
  tenant: ResearchTenant;
  userId: string;
  runType: "QUICK" | "DEEP";
  targetYear: string;
  targetMode: string;
  context: SubmissionContext | Record<string, unknown>;
  fitSummary: Record<string, unknown>;
  idempotencyKey: string;
  output: NavigatorOutput;
}) {
  const id = `snrun_${randomUUID()}`;
  const journalRows: Array<{ name: string; publisher: string; fit: number | null; risk: string; metrics: Record<string, unknown>; evidence: unknown[] }> = [];
  for (const item of list(((input.output.journal_analysis as Record<string, unknown> | undefined)?.candidate_journals as unknown[] | undefined) ?? [])) {
    const j = record(item) ? item : {};
    journalRows.push({
      name: text(j.journal_name) || "unknown_journal",
      publisher: text(j.publisher),
      fit: typeof j.fit_score === "number" ? Math.max(0, Math.min(100, Math.round(j.fit_score))) : null,
      risk: text(j.desk_reject_risk),
      metrics: { quartile_info: j.quartile_info ?? null, impact_factor: j.impact_factor ?? null, indexing: j.indexing ?? null, apc: j.apc ?? null, verification_status: j.verification_status ?? null },
      evidence: list(j.contribution_delta),
    });
  }
  const routeRows: Array<{ type: "NSTC" | "MOE_TPR"; name: string; fit: number | null; status: string; snapshot: Record<string, unknown> }> = [];
  for (const item of list(((input.output.nstc_analysis as Record<string, unknown> | undefined)?.routes as unknown[] | undefined) ?? [])) {
    const r = record(item) ? item : {};
    routeRows.push({ type: "NSTC", name: text(r.discipline) || text(r.route_name) || "未命名路線", fit: typeof r.fit_score === "number" ? Math.max(0, Math.min(100, Math.round(r.fit_score))) : null, status: text(r.category) || "PROPOSED", snapshot: { rationale: r.rationale ?? null, risks: r.risks ?? r.key_risks ?? [], strengths: r.strengths ?? [] } });
  }
  for (const item of list(((input.output.moe_tpr_analysis as Record<string, unknown> | undefined)?.routes as unknown[] | undefined) ?? [])) {
    const r = record(item) ? item : {};
    routeRows.push({ type: "MOE_TPR", name: text(r.discipline_or_project) || text(r.route_name) || "未命名路線", fit: typeof r.fit_score === "number" ? Math.max(0, Math.min(100, Math.round(r.fit_score))) : null, status: text(r.status) || "PROPOSED", snapshot: { rationale: r.rationale ?? null, condition: r.condition ?? null, risks: r.risks ?? [] } });
  }
  const complianceRows = list(input.output.compliance_matrix).map((item) => { const r = record(item) ? item : {}; return { route: text(r.route), requirementId: text(r.requirement_id), requirement: text(r.requirement), status: text(r.status), severity: text(r.severity), officialSource: text(r.official_source), missingItem: text(r.missing_item), requiredAction: text(r.required_action), verificationStatus: text(r.verification_status) }; });
  const ruleRows = list(input.output.rule_snapshots).map((item) => { const r = record(item) ? item : {}; return { authority: text(r.authority), targetYear: text(r.target_year), documentTitle: text(r.document_title), sourceUrl: text(r.source_url), sourceType: text(r.source_type), verificationStatus: text(r.verification_status), applicableRequirement: text(r.applicable_requirement), effectiveDate: text(r.effective_date), retrievedAt: text(r.retrieved_at), snapshot: r }; });
  const evidenceRows = list(input.output.evidence_ledger).map((item) => { const r = record(item) ? item : {}; return { route: "shared", evidenceId: text(r.claim).slice(0, 64) || `ev_${randomUUID()}`, sourceType: text(r.source_type), title: text(r.claim), authority: text(r.source_type), doi: "", url: text(r.source_url), retrievedAt: text(r.retrieved_at), usedFor: text(r.supports), verificationStatus: text(r.verification_status) }; });

  return withClient(async (client) => {
    await lock(client, input.tenant, `match:${input.targetMode}`);
    const prior = await client.query(`SELECT id FROM submission_navigator_runs WHERE ${tenantWhere()} AND idempotency_key=$3 LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, input.idempotencyKey]);
    if (prior.rows[0]) return { id: String(prior.rows[0].id), idempotent: true };
    await client.query(
      `INSERT INTO submission_navigator_runs (id,workspace_id,project_id,created_by_user_id,run_type,target_year,target_mode,topic_snapshot,researcher_snapshot,fit_summary,status,idempotency_key) VALUES ($4,$1,$2,$3,$5,$6,$7,$8::jsonb,'{}'::jsonb,$9::jsonb,'COMPLETED',$10)`,
      [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.runType, input.targetYear, input.targetMode, JSON.stringify(input.context), JSON.stringify(input.fitSummary), input.idempotencyKey],
    );
    for (const j of journalRows) {
      await client.query(`INSERT INTO submission_journal_candidates (id,workspace_id,project_id,run_id,journal_name,publisher,fit_score,desk_reject_risk,metrics_snapshot,evidence) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, `snjc_${randomUUID()}`, id, j.name, j.publisher, j.fit, j.risk, JSON.stringify(j.metrics), JSON.stringify(j.evidence)]);
    }
    for (const r of routeRows) {
      await client.query(`INSERT INTO submission_funding_routes (id,workspace_id,project_id,run_id,route_type,route_name,fit_score,status,snapshot) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9::jsonb)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, `snfr_${randomUUID()}`, id, r.type, r.name, r.fit, r.status, JSON.stringify(r.snapshot)]);
    }
    for (const c of complianceRows) {
      await client.query(`INSERT INTO submission_compliance_items (id,workspace_id,project_id,run_id,route,requirement_id,requirement,status,severity,official_source,missing_item,required_action,verification_status) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, `snci_${randomUUID()}`, id, c.route, c.requirementId, c.requirement, c.status, c.severity, c.officialSource, c.missingItem, c.requiredAction, c.verificationStatus]);
    }
    for (const e of evidenceRows) {
      await client.query(`INSERT INTO submission_evidence_items (id,workspace_id,project_id,run_id,route,evidence_id,source_type,title,authority,doi,url,retrieved_at,used_for,verification_status) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, `snev_${randomUUID()}`, id, e.route, e.evidenceId, e.sourceType, e.title, e.authority, e.doi, e.url, e.retrievedAt || null, e.usedFor, e.verificationStatus]);
    }
    for (const r of ruleRows) {
      if (!r.documentTitle) continue;
      const priorRule = await client.query(`SELECT 1 FROM submission_rule_snapshots WHERE ${tenantWhere()} AND run_id=$4 AND authority=$5 AND target_year=$6 AND document_title=$7 LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, r.authority, r.targetYear, r.documentTitle]);
      if (priorRule.rowCount) continue;
      await client.query(`INSERT INTO submission_rule_snapshots (id,workspace_id,project_id,run_id,authority,target_year,document_title,source_url,source_type,verification_status,applicable_requirement,effective_date,retrieved_at,snapshot) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, `snrs_${randomUUID()}`, id, r.authority, r.targetYear, r.documentTitle, r.sourceUrl, r.sourceType, r.verificationStatus || "unverified", r.applicableRequirement, r.effectiveDate || null, r.retrievedAt || null, JSON.stringify(r.snapshot)]);
    }
    return { id, idempotent: false };
  });
}

export async function getNavigatorStateV2(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const runsResult = await client.query(`SELECT id,run_type,target_year,target_mode,status,topic_snapshot,fit_summary,created_at FROM submission_navigator_runs WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 20`, [tenant.workspaceId, tenant.projectId]);
    const runs = runsResult.rows.map((row) => storedRun(row as Record<string, unknown>));
    const latest = runs.find((r) => r.status === "COMPLETED") ?? null;
    const contextRun = runs.find((r) => r.status === "PENDING") ?? null;
    if (!latest) return { runs, latest: null, context: contextRun?.topicSnapshot ?? null, journals: [], routes: [], compliance: [], evidence: [], versions: [], projects: [], fatalOpen: [] };
    const journals = (await client.query(`SELECT journal_name AS "journalName",publisher,fit_score AS "fitScore",desk_reject_risk AS "deskRejectRisk",metrics_snapshot AS "metricsSnapshot" FROM submission_journal_candidates WHERE ${tenantWhere()} AND run_id=$4 ORDER BY fit_score DESC NULLS LAST`, [tenant.workspaceId, tenant.projectId, tenant.userId, latest.id])).rows;
    const routes = (await client.query(`SELECT route_type AS "routeType",route_name AS "routeName",fit_score AS "fitScore",status,snapshot FROM submission_funding_routes WHERE ${tenantWhere()} AND run_id=$4 ORDER BY route_type,fit_score DESC NULLS LAST`, [tenant.workspaceId, tenant.projectId, tenant.userId, latest.id])).rows;
    const compliance = (await client.query(`SELECT route,requirement_id AS "requirementId",requirement,status,severity,official_source AS "officialSource",missing_item AS "missingItem",required_action AS "requiredAction",verification_status AS "verificationStatus" FROM submission_compliance_items WHERE ${tenantWhere()} AND run_id=$4 ORDER BY severity,requirement_id`, [tenant.workspaceId, tenant.projectId, tenant.userId, latest.id])).rows;
    const evidence = (await client.query(`SELECT route,evidence_id AS "evidenceId",source_type AS "sourceType",title,authority,doi,url,retrieved_at AS "retrievedAt",used_for AS "usedFor",verification_status AS "verificationStatus" FROM submission_evidence_items WHERE ${tenantWhere()} AND run_id=$4 ORDER BY created_at LIMIT 100`, [tenant.workspaceId, tenant.projectId, tenant.userId, latest.id])).rows;
    const versions = (await client.query(`SELECT id,version_key AS "versionKey",title_zh AS "titleZh",title_en AS "titleEn",gap,contribution,method,outcomes,abstract,keywords,created_at AS "createdAt" FROM topic_versions WHERE ${tenantWhere()} AND run_id=$4 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, tenant.userId, latest.id])).rows;
    const projects = (await client.query(`SELECT id,project_type AS "projectType",title,status,created_at AS "createdAt" FROM submission_projects WHERE ${tenantWhere()} AND run_id=$4 ORDER BY created_at`, [tenant.workspaceId, tenant.projectId, tenant.userId, latest.id])).rows;
    const ruleSnapshots = (await client.query(`SELECT id,authority,target_year AS "targetYear",document_title AS "documentTitle",source_url AS "sourceUrl",verification_status AS "verificationStatus",applicable_requirement AS "applicableRequirement",retrieved_at AS "retrievedAt",snapshot FROM submission_rule_snapshots WHERE ${tenantWhere()} AND run_id=$4 ORDER BY authority,target_year,created_at`, [tenant.workspaceId, tenant.projectId, tenant.userId, latest.id])).rows;
    const journalMarks = (await client.query(`SELECT journal_name AS "journalName",mark_type AS "markType" FROM submission_journal_marks WHERE ${tenantWhere()} AND run_id=$4`, [tenant.workspaceId, tenant.projectId, tenant.userId, latest.id])).rows;
    const journalDetails = (await client.query(`SELECT journal_name AS "journalName",detail,verification_status AS "verificationStatus",last_verified_at AS "lastVerifiedAt" FROM submission_journal_details WHERE ${tenantWhere()} AND run_id=$4 ORDER BY created_at DESC`, [tenant.workspaceId, tenant.projectId, tenant.userId, latest.id])).rows;
    const fatalOpen = compliance.filter((c) => text((c as Record<string, unknown>).severity) === "fatal" && text((c as Record<string, unknown>).status) !== "met" && text((c as Record<string, unknown>).status) !== "not_applicable");
    return { runs, latest, context: contextRun?.topicSnapshot ?? runs[0]?.topicSnapshot ?? null, journals, routes, compliance, evidence, versions, projects, ruleSnapshots, journalMarks, journalDetails, fatalOpen };
  });
}

export async function createTopicVersion(input: { tenant: ResearchTenant; userId: string; runId: string; versionKey: string; titleZh: string; titleEn: string | null; gap: string | null; contribution: string | null; method: string | null; outcomes: string[]; abstract: string | null; keywords: string[]; snapshot: Record<string, unknown> }) {
  const allowedKeys = ["ORIGINAL", "NSTC_V1", "MOE_TPR_V1", "JOURNAL_V1"];
  if (!allowedKeys.includes(input.versionKey)) throw new SubmissionNavigatorV2RepositoryError("invalid_version_key");
  return withClient(async (client) => {
    await lock(client, input.tenant, `version:${input.runId}:${input.versionKey}`);
    const prior = await client.query(`SELECT id FROM topic_versions WHERE ${tenantWhere()} AND run_id=$4 AND version_key=$5 LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, input.runId, input.versionKey]);
    if (prior.rows[0]) return { id: String(prior.rows[0].id), idempotent: true };
    const id = `tv_${randomUUID()}`;
    await client.query(`INSERT INTO topic_versions (id,workspace_id,project_id,run_id,version_key,title_zh,title_en,gap,contribution,method,outcomes,abstract,keywords,snapshot) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,$14::jsonb)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.runId, input.versionKey, input.titleZh, input.titleEn, input.gap, input.contribution, input.method, JSON.stringify(input.outcomes), input.abstract, JSON.stringify(input.keywords), JSON.stringify(input.snapshot)]);
    return { id, idempotent: false };
  });
}

export async function createSubmissionProject(input: { tenant: ResearchTenant; userId: string; runId: string; projectType: "NSTC" | "MOE_TEACHING_PRACTICE" | "JOURNAL_MANUSCRIPT"; title: string }) {
  return withClient(async (client) => {
    await lock(client, input.tenant, `project:${input.runId}:${input.projectType}`);
    const prior = await client.query(`SELECT id FROM submission_projects WHERE ${tenantWhere()} AND run_id=$4 AND project_type=$5 LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, input.runId, input.projectType]);
    if (prior.rows[0]) return { id: String(prior.rows[0].id), idempotent: true };
    const id = `sp_${randomUUID()}`;
    await client.query(`INSERT INTO submission_projects (id,workspace_id,project_id,run_id,project_type,title,status) VALUES ($4,$1,$2,$3,$5,$6,'PLANNED')`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.runId, input.projectType, input.title]);
    return { id, idempotent: false };
  });
}

export async function getRunTopicContext(tenant: ResearchTenant, runId: string): Promise<Record<string, unknown> | null> {
  return withClient(async (client) => {
    const result = await client.query(`SELECT topic_snapshot AS "topicSnapshot" FROM submission_navigator_runs WHERE ${tenantWhere()} AND id=$3 LIMIT 1`, [tenant.workspaceId, tenant.projectId, runId]);
    if (!result.rows[0]) return null;
    const snapshot = (result.rows[0] as Record<string, unknown>).topicSnapshot;
    return record(snapshot) ? snapshot : null;
  });
}

export async function saveJournalDetail(input: { tenant: ResearchTenant; userId: string; runId: string; journalName: string; detail: Record<string, unknown>; verificationStatus: string; lastVerifiedAt: string }) {
  return withClient(async (client) => {
    const id = `snjd_${randomUUID()}`;
    await client.query(`INSERT INTO submission_journal_details (id,workspace_id,project_id,run_id,journal_name,detail,verification_status,last_verified_at) VALUES ($4,$1,$2,$3,$5,$6::jsonb,$7,$8)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.runId, input.journalName, JSON.stringify(input.detail), input.verificationStatus, input.lastVerifiedAt]);
    return { id };
  });
}

export async function markJournal(input: { tenant: ResearchTenant; userId: string; runId: string; journalName: string; markType: "CANDIDATE" | "TARGET" | "COMPARE" }) {
  return withClient(async (client) => {
    const prior = await client.query(`SELECT id FROM submission_journal_marks WHERE ${tenantWhere()} AND run_id=$4 AND journal_name=$5 AND mark_type=$6 LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, input.runId, input.journalName, input.markType]);
    if (prior.rows[0]) return { id: String(prior.rows[0].id), idempotent: true };
    const id = `snjm_${randomUUID()}`;
    await client.query(`INSERT INTO submission_journal_marks (id,workspace_id,project_id,run_id,journal_name,mark_type) VALUES ($4,$1,$2,$3,$5,$6)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.runId, input.journalName, input.markType]);
    return { id, idempotent: false };
  });
}

export async function closeSubmissionNavigatorV2RepositoryForDisposableTest() {
  if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new SubmissionNavigatorV2StorageUnavailable();
  await pool?.end();
}
