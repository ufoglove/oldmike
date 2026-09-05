import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { createHumanGate, lockResearchVersion, type ResearchTenant } from "./research-repository.ts";
import {
  SUBMISSION_NAVIGATOR_CONTRACT_VERSION,
  SUBMISSION_NAVIGATOR_DOCUMENT_TYPE,
  SUBMISSION_NAVIGATOR_STAGE,
  type NavigatorRunRequest,
} from "./submission-navigator-contract.ts";
import type { NavigatorOutput } from "./submission-navigator-provider.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export class SubmissionNavigatorStorageUnavailable extends Error {
  constructor() { super("submission_navigator_storage_unavailable"); this.name = "SubmissionNavigatorStorageUnavailable"; }
}
export class SubmissionNavigatorRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "SubmissionNavigatorRepositoryError"; this.code = code; this.status = status; }
}

type StoredDocument = { id: string; logicalId: string; versionNumber: number; contentHash: string; title: string; body: string; stageDetail: string; lockedAt: string | null; createdAt: string };

type NavigatorEnvelope = {
  contractVersion: typeof SUBMISSION_NAVIGATOR_CONTRACT_VERSION;
  kind: "NAVIGATOR_RUN";
  requestHash: string;
  idempotencyKey: string;
  input: NavigatorRunRequest;
  output: NavigatorOutput;
  provenance: { appendOnly: true; structuredEnvelope: true; sourceOverwritten: false; officialSourceRequired: true; humanGateRequired: false; fitScoresAreInternal: true };
};

function tenantWhere(alias = "") { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2 AND ${p}created_by_user_id=$3 AND EXISTS (SELECT 1 FROM workspace_members m06_access WHERE m06_access.workspace_id=$1 AND m06_access.user_id=$3 AND m06_access.role IN ('owner','member'))`; }
function stored(row: Record<string, unknown>): StoredDocument {
  return { id: String(row.id), logicalId: String(row.logicalId), versionNumber: Number(row.versionNumber), contentHash: String(row.contentHash), title: String(row.title), body: String(row.body), stageDetail: String(row.stageDetail), lockedAt: row.lockedAt ? String(row.lockedAt) : null, createdAt: String(row.createdAt) };
}
function navigatorHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function envelopeHash(envelope: NavigatorEnvelope) { return navigatorHash({ contractVersion: envelope.contractVersion, kind: envelope.kind, requestHash: envelope.requestHash, idempotencyKey: envelope.idempotencyKey, output: envelope.output }); }
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) { if (!pool) throw new SubmissionNavigatorStorageUnavailable(); const client = await pool.connect(); try { return await operation(client); } finally { client.release(); } }
async function lock(client: PoolClient, tenant: ResearchTenant, key: string) { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`m06:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]); }

function parseEnvelope(body: string): NavigatorEnvelope | null {
  try {
    const value = JSON.parse(body) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (row.contractVersion !== SUBMISSION_NAVIGATOR_CONTRACT_VERSION || row.kind !== "NAVIGATOR_RUN" || typeof row.requestHash !== "string" || !/^[a-f0-9]{64}$/.test(row.requestHash)) return null;
    return row as unknown as NavigatorEnvelope;
  } catch { return null; }
}

export type NavigatorRunSummary = {
  documentVersionId: string;
  logicalId: string;
  versionNumber: number;
  contentHash: string;
  title: string;
  createdAt: string;
  lockedAt: string | null;
  targetYear: string;
  targetMode: string;
  researchStage: string;
  fundingRoute: string;
  publicationRoute: string;
  submissionReady: boolean;
};

function summaryOf(document: StoredDocument, envelope: NavigatorEnvelope): NavigatorRunSummary {
  const strategy = envelope.output.final_strategy;
  const readiness = readinessFromOutput(envelope.output);
  return {
    documentVersionId: document.id,
    logicalId: document.logicalId,
    versionNumber: document.versionNumber,
    contentHash: document.contentHash,
    title: document.title,
    createdAt: document.createdAt,
    lockedAt: document.lockedAt,
    targetYear: envelope.input.targetYear,
    targetMode: envelope.input.targetMode,
    researchStage: envelope.input.researchStage,
    fundingRoute: typeof strategy?.funding_route === "string" ? strategy.funding_route : "",
    publicationRoute: typeof strategy?.publication_route === "string" ? strategy.publication_route : "",
    submissionReady: readiness.submissionReady,
  };
}

export function readinessFromOutput(output: NavigatorOutput) {
  const fatalOpen: string[] = [];
  const majorOpen: string[] = [];
  const matrix = Array.isArray(output.compliance_matrix) ? output.compliance_matrix : [];
  for (const item of matrix) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const status = String(row.status ?? "");
    const severity = String(row.severity ?? "");
    const id = String(row.requirement_id ?? "");
    if (severity === "fatal" && status !== "met" && status !== "not_applicable") fatalOpen.push(id || "compliance_fatal_open");
    if (severity === "major" && status !== "met" && status !== "not_applicable") majorOpen.push(id || "compliance_major_open");
  }
  const gates = Array.isArray(output.eligibility_gates) ? output.eligibility_gates : [];
  for (const item of gates) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const status = String(row.status ?? "");
    const severity = String(row.severity ?? "");
    const name = String(row.item ?? "");
    if (severity === "fatal" && status !== "pass" && status !== "not_applicable") fatalOpen.push(`gate:${name || "fatal_gate_open"}`);
  }
  const ruleSnapshots = Array.isArray(output.rule_snapshots) ? output.rule_snapshots : [];
  const officialDeadlineVerified = ruleSnapshots.some((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    return String(row.verification_status ?? "") === "verified_current" && String(row.applicable_requirement ?? "").includes("截止");
  });
  return {
    submissionReady: fatalOpen.length === 0,
    fatalOpen,
    majorOpen,
    officialDeadlineVerified,
  };
}

export async function saveNavigatorRun(input: {
  tenant: ResearchTenant;
  userId: string;
  request: NavigatorRunRequest;
  output: NavigatorOutput;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return withClient(async (client) => {
    await lock(client, input.tenant, `navigator:${input.request.targetMode}`);
    const logicalId = `m06-navigator-${input.request.targetMode}`;
    const latestResult = await client.query<{ version_number: number; id: string }>(
      `SELECT version_number AS "version_number", id FROM research_documents WHERE ${tenantWhere()} AND logical_id=$4 AND stage_detail=$5 ORDER BY version_number DESC LIMIT 1 FOR UPDATE`,
      [input.tenant.workspaceId, input.tenant.projectId, input.userId, logicalId, SUBMISSION_NAVIGATOR_STAGE],
    );
    const latestVersion = latestResult.rows[0] ? Number(latestResult.rows[0].version_number) : 0;
    const idempotent = latestResult.rows[0] && latestResult.rows[0].id ? (await client.query<{ body: string }>(`SELECT body FROM research_documents WHERE id=$4 AND ${tenantWhere()}`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, latestResult.rows[0].id])).rows[0]?.body : null;
    if (idempotent) {
      const existingEnvelope = parseEnvelope(idempotent);
      if (existingEnvelope && existingEnvelope.idempotencyKey === input.request.idempotencyKey) {
        return { documentVersionId: latestResult.rows[0].id, versionNumber: latestVersion, contentHash: envelopeHash(existingEnvelope), idempotent: true, envelope: existingEnvelope };
      }
    }
    const envelope: NavigatorEnvelope = {
      contractVersion: SUBMISSION_NAVIGATOR_CONTRACT_VERSION,
      kind: "NAVIGATOR_RUN",
      requestHash: navigatorHash(input.request),
      idempotencyKey: input.request.idempotencyKey,
      input: input.request,
      output: input.output,
      provenance: { appendOnly: true, structuredEnvelope: true, sourceOverwritten: false, officialSourceRequired: true, humanGateRequired: false, fitScoresAreInternal: true },
    };
    const contentHash = envelopeHash(envelope);
    const id = `m06run_${randomUUID()}`;
    const title = `投稿與計畫導航 ${input.request.targetMode} / ${input.request.targetYear}（${now.toISOString().slice(0, 10)}）`;
    await client.query(
      `INSERT INTO research_documents (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail,created_at,updated_at) VALUES ($4,$5,$6,$7,$1,$2,$3,'${SUBMISSION_NAVIGATOR_DOCUMENT_TYPE}',$8,$9,$10,$11,$12,$12)`,
      [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, logicalId, latestVersion + 1, latestResult.rows[0]?.id ?? null, title, JSON.stringify(envelope), contentHash, SUBMISSION_NAVIGATOR_STAGE, now.toISOString()],
    );
    const eventHash = navigatorHash({ fromStage: "S0_INTAKE", toStage: "S1_NAVIGATOR_RUN", stageDetail: SUBMISSION_NAVIGATOR_STAGE, runId: id });
    await client.query(
      `INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash,created_at,updated_at) VALUES ($4,$1,$2,$3,'S0_INTAKE','S1_NAVIGATOR_RUN','${SUBMISSION_NAVIGATOR_STAGE}','1.6.0',$5::jsonb,$6,$7,$7)`,
      [input.tenant.workspaceId, input.tenant.projectId, input.userId, `wfe_${randomUUID()}`, JSON.stringify([{ documentVersionId: id, contentHash }]), eventHash, now.toISOString()],
    );
    return { documentVersionId: id, versionNumber: latestVersion + 1, contentHash, idempotent: false, envelope };
  });
}

export async function confirmNavigatorRelease(input: {
  tenant: ResearchTenant;
  userId: string;
  documentVersionId: string;
  contentHash: string;
  rationale: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return withClient(async (client) => {
    const row = await client.query<Record<string, unknown>>(`SELECT id,content_hash AS "contentHash" FROM research_documents WHERE id=$4 AND ${tenantWhere()} AND content_hash=$5`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, input.documentVersionId, input.contentHash]);
    if (!row.rowCount) throw new SubmissionNavigatorRepositoryError("submission_gate_artifact_not_found", 404);
    await lockResearchVersion(input.tenant, { kind: "document", id: input.documentVersionId, contentHash: input.contentHash });
    const gate = await createHumanGate(input.tenant, { gateType: "DOCUMENT_RELEASE", artifactType: "document", artifactVersionId: input.documentVersionId, approvedContentHash: input.contentHash, decision: "APPROVED", rationale: input.rationale });
    const eventHash = navigatorHash({ fromStage: "S7_SUBMIT", toStage: "S8_RELEASE", stageDetail: "S8_RELEASE_HUMAN_GATE", gateId: gate.id });
    await client.query(
      `INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,human_gate_id,event_hash,created_at,updated_at) VALUES ($4,$1,$2,$3,'S7_SUBMIT','S8_RELEASE','S8_RELEASE_HUMAN_GATE','1.6.0',$5::jsonb,$6,$7,$8,$8)`,
      [input.tenant.workspaceId, input.tenant.projectId, input.userId, `wfe_${randomUUID()}`, JSON.stringify([{ documentVersionId: input.documentVersionId, contentHash: input.contentHash }]), gate.id, eventHash, now.toISOString()],
    );
    return { gateId: gate.id, approvedAt: gate.approvedAt };
  });
}

export async function getNavigatorOverview(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const documents = await client.query<Record<string, unknown>>(
      `SELECT id,logical_id AS "logicalId",version_number AS "versionNumber",content_hash AS "contentHash",title,body,stage_detail AS "stageDetail",locked_at AS "lockedAt",created_at AS "createdAt" FROM research_documents WHERE ${tenantWhere()} AND stage_detail=$4 ORDER BY created_at DESC,id DESC LIMIT 30`,
      [tenant.workspaceId, tenant.projectId, tenant.userId, SUBMISSION_NAVIGATOR_STAGE],
    );
    const runs: NavigatorRunSummary[] = [];
    for (const row of documents.rows) {
      const document = stored(row);
      const envelope = parseEnvelope(document.body);
      if (envelope) runs.push(summaryOf(document, envelope));
    }
    const latest = runs[0] ?? null;
    const latestEnvelope = latest ? parseEnvelope(stored(documents.rows[0]).body) : null;
    return { runs, latest, latestOutput: latestEnvelope?.output ?? null };
  });
}

export async function closeSubmissionNavigatorRepositoryForDisposableTest() {
  if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new SubmissionNavigatorStorageUnavailable();
  await pool?.end();
}
