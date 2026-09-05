import "server-only";

import { Pool, type PoolClient } from "pg";
import { authConfiguration } from "./auth-config.ts";
import { sha256Canonical } from "./research-contract.ts";
import type { ResearchTenant } from "./research-repository.ts";
import {
  candidateFromAnalysis,
  topicLabCandidateArtifactId,
  type TopicLabAnalysis,
  type TopicLabAnalyzeRequest,
} from "./topic-lab-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
export const TOPIC_LAB_LOGICAL_ID = "topic-lab-analysis:main";
export const TOPIC_LAB_STAGE_DETAIL = "M01_TOPIC_LAB_ANALYSIS";
const TOPIC_LAB_DOCUMENT_TYPE = "RESEARCH_PLAN";
const TOPIC_LAB_CONTRACT = "topic-lab-formal-envelope/1.0.0";

export class TopicLabStorageUnavailable extends Error {
  constructor() { super("topic_lab_storage_unavailable"); }
}

export class TopicLabRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 409) {
    super(code);
    this.name = "TopicLabRepositoryError";
    this.code = code;
    this.status = status;
  }
}

type TopicLabEnvelope = {
  contractVersion: typeof TOPIC_LAB_CONTRACT;
  kind: "TOPIC_LAB_ANALYSIS";
  idempotencyKey: string;
  requestHash: string;
  resultHash: string;
  request: TopicLabAnalyzeRequest;
  analysis: TopicLabAnalysis;
  provenance: { sourceStatus: "UNVERIFIED"; appendOnly: true; migrationAuthority: "0005_0006" };
};

type StoredRun = {
  id: string;
  versionNumber: number;
  inputHash: string;
  resultHash: string;
  resultPayload: TopicLabAnalysis;
  idempotencyKey: string;
};

function stableId(prefix: string, value: unknown) {
  return `${prefix}_${sha256Canonical(value).slice(0, 40)}`;
}

function runId(tenant: ResearchTenant, idempotencyKey: string) {
  return stableId("document_topic", { workspaceId: tenant.workspaceId, projectId: tenant.projectId, idempotencyKey });
}

function gateId(tenant: ResearchTenant, idempotencyKey: string) {
  return stableId("gate_topic", { workspaceId: tenant.workspaceId, projectId: tenant.projectId, idempotencyKey });
}

function studyId(tenant: ResearchTenant, idempotencyKey: string) {
  return stableId("study_topic", { workspaceId: tenant.workspaceId, projectId: tenant.projectId, idempotencyKey });
}

function eventId(studyVersionId: string) {
  return stableId("wfe_topic", { studyVersionId, kind: "M01_TOPIC_LAB_CANDIDATE_PROMOTED" });
}

function assertTenant(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}workspace_id = $1 AND ${prefix}project_id = $2`;
}

async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool || !authConfiguration().ready) throw new TopicLabStorageUnavailable();
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}

function parseEnvelope(value: unknown): TopicLabEnvelope {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed) as unknown; } catch { throw new TopicLabRepositoryError("topic_lab_envelope_invalid", 500); }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TopicLabRepositoryError("topic_lab_envelope_invalid", 500);
  const envelope = parsed as Partial<TopicLabEnvelope>;
  if (envelope.contractVersion !== TOPIC_LAB_CONTRACT || envelope.kind !== "TOPIC_LAB_ANALYSIS" || typeof envelope.idempotencyKey !== "string" || typeof envelope.requestHash !== "string" || typeof envelope.resultHash !== "string" || !envelope.request || !envelope.analysis || envelope.provenance?.sourceStatus !== "UNVERIFIED" || envelope.provenance.appendOnly !== true || envelope.provenance.migrationAuthority !== "0005_0006") throw new TopicLabRepositoryError("topic_lab_envelope_invalid", 500);
  return envelope as TopicLabEnvelope;
}

function storedRun(row: Record<string, unknown>): StoredRun {
  const envelope = parseEnvelope(row.body);
  if (String(row.contentHash) !== sha256Canonical(envelope) || envelope.requestHash !== envelope.analysis.inputHash || envelope.resultHash !== envelope.analysis.resultHash) throw new TopicLabRepositoryError("topic_lab_envelope_hash_invalid", 500);
  return {
    id: String(row.id),
    versionNumber: Number(row.versionNumber),
    inputHash: envelope.requestHash,
    resultHash: envelope.resultHash,
    resultPayload: envelope.analysis,
    idempotencyKey: envelope.idempotencyKey,
  };
}

const RUN_SELECT = `SELECT id, version_number AS "versionNumber", body, content_hash AS "contentHash"
  FROM research_documents`;

export async function findTopicLabRunByIdempotency(tenant: ResearchTenant, idempotencyKey: string) {
  return withClient(async (client) => {
    const result = await client.query(`${RUN_SELECT} WHERE ${assertTenant()} AND id = $3 AND document_type = '${TOPIC_LAB_DOCUMENT_TYPE}' AND stage_detail = '${TOPIC_LAB_STAGE_DETAIL}' LIMIT 1`, [tenant.workspaceId, tenant.projectId, runId(tenant, idempotencyKey)]);
    return result.rows[0] ? storedRun(result.rows[0]) : null;
  });
}

export async function getLatestTopicLabRun(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const result = await client.query(`${RUN_SELECT} WHERE ${assertTenant()} AND logical_id = $3 AND document_type = '${TOPIC_LAB_DOCUMENT_TYPE}' AND stage_detail = '${TOPIC_LAB_STAGE_DETAIL}' ORDER BY version_number DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, TOPIC_LAB_LOGICAL_ID]);
    return result.rows[0] ? storedRun(result.rows[0]) : null;
  });
}

export async function saveTopicLabAnalysis(input: { tenant: ResearchTenant; userId: string; request: TopicLabAnalyzeRequest; analysis: TopicLabAnalysis }) {
  if (input.tenant.userId !== input.userId) throw new TopicLabRepositoryError("tenant_identity_mismatch", 404);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${input.tenant.workspaceId}:${input.tenant.projectId}:${TOPIC_LAB_LOGICAL_ID}`]);
      const id = runId(input.tenant, input.request.idempotencyKey);
      const existing = await client.query(`${RUN_SELECT} WHERE ${assertTenant()} AND id = $3 LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, id]);
      if (existing.rows[0]) {
        const replay = storedRun(existing.rows[0]);
        if (replay.inputHash !== input.analysis.inputHash || replay.resultHash !== input.analysis.resultHash) throw new TopicLabRepositoryError("idempotency_payload_conflict");
        await client.query("COMMIT");
        return { ...replay, idempotent: true };
      }
      const latest = await client.query<{ id: string; versionNumber: number }>(`SELECT id, version_number AS "versionNumber" FROM research_documents WHERE ${assertTenant()} AND logical_id = $3 ORDER BY version_number DESC LIMIT 1 FOR UPDATE`, [input.tenant.workspaceId, input.tenant.projectId, TOPIC_LAB_LOGICAL_ID]);
      const envelope: TopicLabEnvelope = {
        contractVersion: TOPIC_LAB_CONTRACT,
        kind: "TOPIC_LAB_ANALYSIS",
        idempotencyKey: input.request.idempotencyKey,
        requestHash: input.analysis.inputHash,
        resultHash: input.analysis.resultHash,
        request: input.request,
        analysis: input.analysis,
        provenance: { sourceStatus: "UNVERIFIED", appendOnly: true, migrationAuthority: "0005_0006" },
      };
      const contentHash = sha256Canonical(envelope);
      const versionNumber = Number(latest.rows[0]?.versionNumber || 0) + 1;
      await client.query(`INSERT INTO research_documents (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail) VALUES ($4,$5,$6,$7,$1,$2,$3,'${TOPIC_LAB_DOCUMENT_TYPE}',$8,$9,$10,'${TOPIC_LAB_STAGE_DETAIL}')`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, TOPIC_LAB_LOGICAL_ID, versionNumber, latest.rows[0]?.id || null, "Topic Lab analysis · UNVERIFIED", JSON.stringify(envelope), contentHash]);
      await client.query("COMMIT");
      return { id, versionNumber, inputHash: input.analysis.inputHash, resultHash: input.analysis.resultHash, resultPayload: input.analysis, idempotencyKey: input.request.idempotencyKey, idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

async function loadRunForUpdate(client: PoolClient, tenant: ResearchTenant, id: string) {
  const result = await client.query(`${RUN_SELECT} WHERE ${assertTenant()} AND id = $3 AND document_type = '${TOPIC_LAB_DOCUMENT_TYPE}' AND stage_detail = '${TOPIC_LAB_STAGE_DETAIL}' FOR SHARE`, [tenant.workspaceId, tenant.projectId, id]);
  if (!result.rows[0]) throw new TopicLabRepositoryError("topic_lab_run_not_found", 404);
  return storedRun(result.rows[0]);
}

export async function approveTopicLabCandidate(input: { tenant: ResearchTenant; userId: string; idempotencyKey: string; runId: string; candidateId: string; candidateHash: string; rationale: string }) {
  if (input.tenant.userId !== input.userId) throw new TopicLabRepositoryError("tenant_identity_mismatch", 404);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const run = await loadRunForUpdate(client, input.tenant, input.runId);
      candidateFromAnalysis(run.resultPayload, input.candidateId, input.candidateHash);
      const artifactVersionId = topicLabCandidateArtifactId(input.runId, input.candidateId);
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${input.tenant.workspaceId}:${input.tenant.projectId}:${artifactVersionId}`]);
      const id = gateId(input.tenant, input.idempotencyKey);
      const prior = await client.query(`SELECT id,artifact_version_id AS "artifactVersionId",approved_content_hash AS "candidateHash",rationale FROM research_human_gates WHERE ${assertTenant()} AND gate_type='DOCUMENT_RELEASE' AND artifact_type='topic_lab_candidate' AND (id=$3 OR (artifact_version_id=$4 AND approved_content_hash=$5 AND decision='APPROVED')) ORDER BY approved_at ASC LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, id, artifactVersionId, input.candidateHash]);
      if (prior.rows[0]) {
        const row = prior.rows[0];
        if (row.artifactVersionId !== artifactVersionId || row.candidateHash !== input.candidateHash || (row.id === id && row.rationale !== input.rationale)) throw new TopicLabRepositoryError("idempotency_payload_conflict");
        await client.query("COMMIT");
        return { id: row.id, artifactVersionId, candidateHash: input.candidateHash, idempotent: true };
      }
      await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,rationale) VALUES ($4,$1,$2,$3,'DOCUMENT_RELEASE','topic_lab_candidate',$5,$6,'APPROVED',$3,now(),$7)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, artifactVersionId, input.candidateHash, input.rationale]);
      await client.query("COMMIT");
      return { id, artifactVersionId, candidateHash: input.candidateHash, idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function promoteTopicLabCandidate(input: { tenant: ResearchTenant; userId: string; idempotencyKey: string; runId: string; candidateId: string; candidateHash: string; humanGateId: string }) {
  if (input.tenant.userId !== input.userId) throw new TopicLabRepositoryError("tenant_identity_mismatch", 404);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`${input.tenant.workspaceId}:${input.tenant.projectId}:${input.runId}:${input.candidateId}`]);
      const id = studyId(input.tenant, input.idempotencyKey);
      const existing = await client.query(`SELECT id,design_payload AS "designPayload",content_hash AS "studyHash" FROM research_studies WHERE ${assertTenant()} AND id=$3 LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, id]);
      if (existing.rows[0]) {
        const provenance = existing.rows[0].designPayload?.provenance;
        if (!provenance || provenance.runId !== input.runId || provenance.candidateId !== input.candidateId || provenance.candidateHash !== input.candidateHash || provenance.humanGateId !== input.humanGateId) throw new TopicLabRepositoryError("idempotency_payload_conflict");
        await client.query("COMMIT");
        return { id: eventId(id), studyVersionId: id, studyHash: existing.rows[0].studyHash, idempotent: true };
      }
      const run = await loadRunForUpdate(client, input.tenant, input.runId);
      const candidate = candidateFromAnalysis(run.resultPayload, input.candidateId, input.candidateHash);
      const artifactVersionId = topicLabCandidateArtifactId(input.runId, input.candidateId);
      const gate = await client.query(`SELECT id FROM research_human_gates WHERE id=$3 AND ${assertTenant()} AND gate_type='DOCUMENT_RELEASE' AND artifact_type='topic_lab_candidate' AND artifact_version_id=$4 AND approved_content_hash=$5 AND decision='APPROVED' LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, input.humanGateId, artifactVersionId, input.candidateHash]);
      if (!gate.rowCount) throw new TopicLabRepositoryError("document_release_human_gate_required", 422);
      const logicalId = `topic-lab-design:${input.candidateId}`;
      const priorCandidate = await client.query(`SELECT id,version_number AS "versionNumber",design_payload AS "designPayload",content_hash AS "studyHash" FROM research_studies WHERE ${assertTenant()} AND logical_id=$3 ORDER BY version_number DESC LIMIT 1 FOR UPDATE`, [input.tenant.workspaceId, input.tenant.projectId, logicalId]);
      if (priorCandidate.rows[0]?.designPayload?.provenance?.candidateHash === input.candidateHash) {
        await client.query("COMMIT");
        return { id: eventId(priorCandidate.rows[0].id), studyVersionId: priorCandidate.rows[0].id, studyHash: priorCandidate.rows[0].studyHash, idempotent: true };
      }
      const designPayload = {
        contractVersion: "topic-lab-s1-promotion/1.0.0",
        origin: "M01_TOPIC_LAB_ANALYSIS",
        candidate,
        provenance: { runId: input.runId, candidateId: input.candidateId, candidateHash: input.candidateHash, resultHash: run.resultHash, scoringVersion: run.resultPayload.scoringVersion, sourceStatus: "UNVERIFIED", humanGateId: input.humanGateId, approvalUpgradesSourceStatus: false },
      };
      const studyHash = sha256Canonical(designPayload);
      const versionNumber = Number(priorCandidate.rows[0]?.versionNumber || 0) + 1;
      await client.query(`INSERT INTO research_studies (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,content_hash,stage_detail,design_payload) VALUES ($4,$5,$6,$7,$1,$2,$3,$8,'S1_DESIGN_DRAFT',$9::jsonb)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, logicalId, versionNumber, priorCandidate.rows[0]?.id || null, studyHash, JSON.stringify(designPayload)]);
      const refs = [{ artifactType: "topic_lab_candidate", artifactVersionId, contentHash: input.candidateHash, studyVersionId: id, studyHash }];
      const event = { fromStage: "S0_INTAKE", toStage: "S1_DESIGN", stageDetail: "M01_TOPIC_LAB_CANDIDATE_PROMOTED", artifactRefs: refs, humanGateId: input.humanGateId, lifecycleContractVersion: "1.5.30" };
      const promotionId = eventId(id);
      await client.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,human_gate_id,event_hash) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9::jsonb,$10,$11)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, promotionId, event.fromStage, event.toStage, event.stageDetail, event.lifecycleContractVersion, JSON.stringify(refs), input.humanGateId, sha256Canonical(event)]);
      await client.query("COMMIT");
      return { id: promotionId, studyVersionId: id, studyHash, idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function closeTopicLabRepositoryForDisposableTest() {
  if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new TopicLabStorageUnavailable();
  await pool?.end();
}
