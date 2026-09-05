import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { authConfiguration } from "./auth-config.ts";
import {
  ACADEMIC_LANGUAGE_CONTRACT_VERSION,
  academicLanguageHash,
  academicLanguageRequestHash,
  academicLanguageResultHash,
  type AcademicProviderResult,
  type PromoteLanguageRequest,
  type SaveGlossaryRequest,
  type TransformLanguageRequest,
} from "./academic-language-contract.ts";
import type { BoundGlossary } from "./academic-language-provider.ts";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
const GLOSSARY_STAGE = "S7_M02_GLOSSARY_DRAFT";
const LANGUAGE_STAGE = "S7_M02_LANGUAGE_DRAFT";

type GlossaryEnvelope = {
  contractVersion: typeof ACADEMIC_LANGUAGE_CONTRACT_VERSION;
  kind: "GLOSSARY_VERSION";
  requestHash: string;
  glossary: Pick<SaveGlossaryRequest, "tonePreset" | "entries" | "bannedTerms">;
  provenance: { method: "老麥術語契約"; appendOnly: true; humanReviewRequired: true };
};

type LanguageEnvelope = {
  contractVersion: typeof ACADEMIC_LANGUAGE_CONTRACT_VERSION;
  kind: "LANGUAGE_RUN";
  requestHash: string;
  resultHash: string;
  input: Pick<TransformLanguageRequest, "task" | "scope" | "tonePreset" | "sourceText" | "methodParameters" | "glossaryVersionId" | "glossaryHash">;
  result: AcademicProviderResult;
  provenance: { method: "老麥學術語言契約"; appendOnly: true; sourceHash: string; glossaryHash: string | null; humanReviewRequired: true };
};

type StoredDocument = {
  id: string;
  logicalId: string;
  versionNumber: number;
  contentHash: string;
  title: string;
  body: string;
  stageDetail: string;
  lockedAt: string | null;
};

export class AcademicLanguageStorageUnavailable extends Error {
  constructor() { super("academic_language_storage_unavailable"); }
}

export class AcademicLanguageRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 409) {
    super(code);
    this.name = "AcademicLanguageRepositoryError";
    this.code = code;
    this.status = status;
  }
}

function assertTenant(alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return `${prefix}workspace_id = $1 AND ${prefix}project_id = $2 AND ${prefix}created_by_user_id = $3 AND EXISTS (SELECT 1 FROM workspace_members m02_access WHERE m02_access.workspace_id = $1 AND m02_access.user_id = $3)`;
}

async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool || !authConfiguration().ready) throw new AcademicLanguageStorageUnavailable();
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}

function deterministicId(prefix: string, tenant: ResearchTenant, idempotencyKey: string) {
  const digest = createHash("sha256").update(`${ACADEMIC_LANGUAGE_CONTRACT_VERSION}\0${tenant.workspaceId}\0${tenant.projectId}\0${tenant.userId}\0${idempotencyKey}`, "utf8").digest("hex");
  return `${prefix}_${digest.slice(0, 40)}`;
}

function storedDocument(row: Record<string, unknown>): StoredDocument {
  return {
    id: String(row.id),
    logicalId: String(row.logicalId),
    versionNumber: Number(row.versionNumber),
    contentHash: String(row.contentHash),
    title: String(row.title),
    body: String(row.body),
    stageDetail: String(row.stageDetail),
    lockedAt: row.lockedAt ? String(row.lockedAt) : null,
  };
}

function parseEnvelope<T extends GlossaryEnvelope | LanguageEnvelope>(body: string, kind: T["kind"]): T {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { throw new AcademicLanguageRepositoryError("stored_document_shape_invalid", 503); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || (parsed as { kind?: unknown }).kind !== kind || (parsed as { contractVersion?: unknown }).contractVersion !== ACADEMIC_LANGUAGE_CONTRACT_VERSION) throw new AcademicLanguageRepositoryError("stored_document_shape_invalid", 503);
  return parsed as T;
}

async function loadById(client: PoolClient, tenant: ResearchTenant, id: string, lock = false) {
  const result = await client.query(
    `SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", title, body, stage_detail AS "stageDetail", locked_at AS "lockedAt"
     FROM research_documents WHERE id = $3 AND ${assertTenant()} ${lock ? "FOR SHARE" : ""}`,
    [tenant.workspaceId, tenant.projectId, id],
  );
  return result.rows[0] ? storedDocument(result.rows[0]) : null;
}

async function latestForLogicalId(client: PoolClient, tenant: ResearchTenant, logicalId: string) {
  const result = await client.query<{ id: string; versionNumber: number }>(
    `SELECT id, version_number AS "versionNumber" FROM research_documents WHERE ${assertTenant()} AND logical_id = $4 ORDER BY version_number DESC LIMIT 1 FOR UPDATE`,
    [tenant.workspaceId, tenant.projectId, tenant.userId, logicalId],
  );
  return result.rows[0] ?? null;
}

async function serialized(client: PoolClient, tenant: ResearchTenant, key: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`m02:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]);
}

function publicLanguageDocument(document: StoredDocument, envelope: LanguageEnvelope, approval: { id: string } | null = null) {
  return {
    documentVersionId: document.id,
    logicalId: document.logicalId,
    versionNumber: document.versionNumber,
    title: document.title,
    contentHash: document.contentHash,
    sourceHash: envelope.provenance.sourceHash,
    resultHash: envelope.resultHash,
    task: envelope.input.task,
    scope: envelope.input.scope,
    tonePreset: envelope.input.tonePreset,
    methodParameters: envelope.input.methodParameters,
    glossaryBinding: envelope.input.glossaryVersionId ? { versionId: envelope.input.glossaryVersionId, contentHash: envelope.input.glossaryHash } : null,
    paragraphs: envelope.result.paragraphs,
    uncertainties: envelope.result.uncertainties,
    humanGate: approval ? { status: "APPROVED" as const, id: approval.id } : { status: "REQUIRED" as const, id: null },
    appendOnly: true,
  };
}

export async function findAcademicLanguageDocumentByIdempotency(tenant: ResearchTenant, idempotencyKey: string, prefix: "glossary" | "language") {
  return withClient(async (client) => loadById(client, tenant, deterministicId(`document_m02_${prefix}`, tenant, idempotencyKey)));
}

export async function replayLanguageRun(tenant: ResearchTenant, idempotencyKey: string, requestHash: string) {
  return withClient(async (client) => {
    const document = await loadById(client, tenant, deterministicId("document_m02_language", tenant, idempotencyKey));
    if (!document) return null;
    if (document.stageDetail !== LANGUAGE_STAGE) throw new AcademicLanguageRepositoryError("stored_document_shape_invalid", 503);
    const envelope = parseEnvelope<LanguageEnvelope>(document.body, "LANGUAGE_RUN");
    if (envelope.requestHash !== requestHash) throw new AcademicLanguageRepositoryError("idempotency_payload_conflict");
    const gate = await client.query<{ id: string }>(`SELECT id FROM research_human_gates WHERE workspace_id = $1 AND project_id = $2 AND created_by_user_id = $3 AND gate_type = 'DOCUMENT_RELEASE' AND artifact_type = 'document' AND artifact_version_id = $4 AND approved_content_hash = $5 AND decision = 'APPROVED' LIMIT 1`, [tenant.workspaceId, tenant.projectId, tenant.userId, document.id, document.contentHash]);
    return { ...publicLanguageDocument(document, envelope, gate.rows[0] ?? null), idempotent: true };
  });
}

export async function getAcademicLanguageOverview(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const documents = await client.query(
      `SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", title, body, stage_detail AS "stageDetail", locked_at AS "lockedAt"
       FROM research_documents WHERE ${assertTenant()} AND stage_detail IN ($3,$4) ORDER BY created_at DESC LIMIT 80`,
      [tenant.workspaceId, tenant.projectId, GLOSSARY_STAGE, LANGUAGE_STAGE],
    );
    const glossaryDocuments: Array<Record<string, unknown>> = [];
    const languageDocuments: StoredDocument[] = [];
    for (const row of documents.rows) {
      const document = storedDocument(row);
      if (document.stageDetail === GLOSSARY_STAGE) {
        const envelope = parseEnvelope<GlossaryEnvelope>(document.body, "GLOSSARY_VERSION");
        glossaryDocuments.push({ versionId: document.id, logicalId: document.logicalId, versionNumber: document.versionNumber, title: document.title, contentHash: document.contentHash, tonePreset: envelope.glossary.tonePreset, entries: envelope.glossary.entries, bannedTerms: envelope.glossary.bannedTerms, appendOnly: true });
      } else if (document.stageDetail === LANGUAGE_STAGE) languageDocuments.push(document);
    }
    const approvals = languageDocuments.length ? await client.query<{ id: string; artifactVersionId: string }>(
      `SELECT id, artifact_version_id AS "artifactVersionId" FROM research_human_gates WHERE workspace_id = $1 AND project_id = $2 AND created_by_user_id = $3 AND gate_type = 'DOCUMENT_RELEASE' AND artifact_type = 'document' AND decision = 'APPROVED' AND artifact_version_id = ANY($4::text[])`,
      [tenant.workspaceId, tenant.projectId, tenant.userId, languageDocuments.map((item) => item.id)],
    ) : { rows: [] };
    const approvalByDocument = new Map(approvals.rows.map((row) => [row.artifactVersionId, { id: row.id }]));
    return {
      contractVersion: ACADEMIC_LANGUAGE_CONTRACT_VERSION,
      glossaries: glossaryDocuments,
      documents: languageDocuments.map((document) => publicLanguageDocument(document, parseEnvelope<LanguageEnvelope>(document.body, "LANGUAGE_RUN"), approvalByDocument.get(document.id) ?? null)),
    };
  });
}

export async function loadBoundGlossary(tenant: ResearchTenant, versionId: string, contentHash: string): Promise<BoundGlossary> {
  return withClient(async (client) => {
    const document = await loadById(client, tenant, versionId);
    if (!document || document.stageDetail !== GLOSSARY_STAGE || document.contentHash !== contentHash) throw new AcademicLanguageRepositoryError("glossary_binding_not_found", 404);
    const envelope = parseEnvelope<GlossaryEnvelope>(document.body, "GLOSSARY_VERSION");
    return { versionId: document.id, contentHash: document.contentHash, entries: envelope.glossary.entries, bannedTerms: envelope.glossary.bannedTerms };
  });
}

export async function saveGlossaryVersion(input: { tenant: ResearchTenant; userId: string; request: SaveGlossaryRequest }) {
  if (input.tenant.userId !== input.userId) throw new AcademicLanguageRepositoryError("tenant_identity_mismatch", 404);
  const requestHash = academicLanguageRequestHash(input.request);
  const envelope: GlossaryEnvelope = { contractVersion: ACADEMIC_LANGUAGE_CONTRACT_VERSION, kind: "GLOSSARY_VERSION", requestHash, glossary: { tonePreset: input.request.tonePreset, entries: input.request.entries, bannedTerms: input.request.bannedTerms }, provenance: { method: "老麥術語契約", appendOnly: true, humanReviewRequired: true } };
  const body = JSON.stringify(envelope);
  const contentHash = academicLanguageHash(envelope);
  const id = deterministicId("document_m02_glossary", input.tenant, input.request.idempotencyKey);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await serialized(client, input.tenant, input.request.logicalId);
      const existing = await loadById(client, input.tenant, id, true);
      if (existing) {
        const stored = parseEnvelope<GlossaryEnvelope>(existing.body, "GLOSSARY_VERSION");
        if (stored.requestHash !== requestHash) throw new AcademicLanguageRepositoryError("idempotency_payload_conflict");
        await client.query("COMMIT");
        return { versionId: existing.id, versionNumber: existing.versionNumber, contentHash: existing.contentHash, idempotent: true };
      }
      const latest = await latestForLogicalId(client, input.tenant, input.request.logicalId);
      if (Number(latest?.versionNumber || 0) !== input.request.expectedVersion) throw new AcademicLanguageRepositoryError("version_conflict");
      const versionNumber = Number(latest?.versionNumber || 0) + 1;
      await client.query(
        `INSERT INTO research_documents (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail)
         VALUES ($4,$5,$6,$7,$1,$2,$3,'MANUSCRIPT',$8,$9,$10,$11)`,
        [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.request.logicalId, versionNumber, latest?.id || null, input.request.title, body, contentHash, GLOSSARY_STAGE],
      );
      await client.query("COMMIT");
      return { versionId: id, versionNumber, contentHash, idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function saveLanguageRun(input: { tenant: ResearchTenant; userId: string; request: TransformLanguageRequest; result: AcademicProviderResult }) {
  if (input.tenant.userId !== input.userId) throw new AcademicLanguageRepositoryError("tenant_identity_mismatch", 404);
  const requestHash = academicLanguageRequestHash(input.request);
  const resultHash = academicLanguageResultHash(input.result);
  const envelope: LanguageEnvelope = {
    contractVersion: ACADEMIC_LANGUAGE_CONTRACT_VERSION,
    kind: "LANGUAGE_RUN",
    requestHash,
    resultHash,
    input: { task: input.request.task, scope: input.request.scope, tonePreset: input.request.tonePreset, sourceText: input.request.sourceText, methodParameters: input.request.methodParameters, glossaryVersionId: input.request.glossaryVersionId, glossaryHash: input.request.glossaryHash },
    result: input.result,
    provenance: { method: "老麥學術語言契約", appendOnly: true, sourceHash: academicLanguageHash(input.request.sourceText), glossaryHash: input.request.glossaryHash, humanReviewRequired: true },
  };
  const body = JSON.stringify(envelope);
  const contentHash = academicLanguageHash(envelope);
  const id = deterministicId("document_m02_language", input.tenant, input.request.idempotencyKey);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await serialized(client, input.tenant, input.request.logicalId);
      const existing = await loadById(client, input.tenant, id, true);
      if (existing) {
        const stored = parseEnvelope<LanguageEnvelope>(existing.body, "LANGUAGE_RUN");
        if (stored.requestHash !== requestHash) throw new AcademicLanguageRepositoryError("idempotency_payload_conflict");
        const gate = await client.query<{ id: string }>(`SELECT id FROM research_human_gates WHERE workspace_id = $1 AND project_id = $2 AND created_by_user_id = $3 AND gate_type = 'DOCUMENT_RELEASE' AND artifact_type = 'document' AND artifact_version_id = $4 AND approved_content_hash = $5 AND decision = 'APPROVED' LIMIT 1`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, existing.id, existing.contentHash]);
        await client.query("COMMIT");
        return { ...publicLanguageDocument(existing, stored, gate.rows[0] ?? null), idempotent: true };
      }
      const latest = await latestForLogicalId(client, input.tenant, input.request.logicalId);
      if (Number(latest?.versionNumber || 0) !== input.request.expectedVersion) throw new AcademicLanguageRepositoryError("version_conflict");
      const versionNumber = Number(latest?.versionNumber || 0) + 1;
      await client.query(
        `INSERT INTO research_documents (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail)
         VALUES ($4,$5,$6,$7,$1,$2,$3,'MANUSCRIPT',$8,$9,$10,$11)`,
        [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.request.logicalId, versionNumber, latest?.id || null, input.request.title, body, contentHash, LANGUAGE_STAGE],
      );
      const document: StoredDocument = { id, logicalId: input.request.logicalId, versionNumber, contentHash, title: input.request.title, body, stageDetail: LANGUAGE_STAGE, lockedAt: null };
      await client.query("COMMIT");
      return { ...publicLanguageDocument(document, envelope), idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function approveLanguageDocument(input: { tenant: ResearchTenant; userId: string; idempotencyKey: string; documentVersionId: string; contentHash: string; rationale: string }) {
  if (input.tenant.userId !== input.userId) throw new AcademicLanguageRepositoryError("tenant_identity_mismatch", 404);
  const gateId = deterministicId("gate_m02_document", input.tenant, input.idempotencyKey);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await serialized(client, input.tenant, input.documentVersionId);
      const document = await loadById(client, input.tenant, input.documentVersionId, true);
      if (!document || document.stageDetail !== LANGUAGE_STAGE || document.contentHash !== input.contentHash) throw new AcademicLanguageRepositoryError("language_document_not_found", 404);
      parseEnvelope<LanguageEnvelope>(document.body, "LANGUAGE_RUN");
      const prior = await client.query<{ id: string }>(`SELECT id FROM research_human_gates WHERE id = $4 AND workspace_id = $1 AND project_id = $2 AND created_by_user_id = $3`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, gateId]);
      if (prior.rows[0]) {
        const exact = await client.query(`SELECT 1 FROM research_human_gates WHERE id = $4 AND workspace_id = $1 AND project_id = $2 AND created_by_user_id = $3 AND gate_type = 'DOCUMENT_RELEASE' AND artifact_type = 'document' AND artifact_version_id = $5 AND approved_content_hash = $6 AND decision = 'APPROVED'`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, gateId, document.id, document.contentHash]);
        if (!exact.rowCount) throw new AcademicLanguageRepositoryError("idempotency_payload_conflict");
        await client.query("COMMIT");
        return { humanGateId: gateId, documentVersionId: document.id, contentHash: document.contentHash, idempotent: true };
      }
      if (!document.lockedAt) await client.query(`UPDATE research_documents SET locked_at = now(), locked_by_user_id = $3 WHERE id = $4 AND ${assertTenant()} AND content_hash = $5 AND locked_at IS NULL`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, document.id, document.contentHash]);
      await client.query(
        `INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,rationale)
         VALUES ($4,$1,$2,$3,'DOCUMENT_RELEASE','document',$5,$6,'APPROVED',$3,now(),$7)`,
        [input.tenant.workspaceId, input.tenant.projectId, input.userId, gateId, document.id, document.contentHash, input.rationale],
      );
      await client.query("COMMIT");
      return { humanGateId: gateId, documentVersionId: document.id, contentHash: document.contentHash, idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function promoteLanguageDocument(input: { tenant: ResearchTenant; userId: string; request: PromoteLanguageRequest }) {
  if (input.tenant.userId !== input.userId) throw new AcademicLanguageRepositoryError("tenant_identity_mismatch", 404);
  const promotedId = deterministicId("document_m02_promoted", input.tenant, input.request.idempotencyKey);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await serialized(client, input.tenant, input.request.targetLogicalId);
      const prior = await loadById(client, input.tenant, promotedId, true);
      if (prior) {
        const provenance = await client.query(`SELECT 1 FROM research_workflow_events WHERE workspace_id = $1 AND project_id = $2 AND created_by_user_id = $3 AND artifact_refs @> $4::jsonb`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, JSON.stringify([{ promotedDocumentVersionId: promotedId, sourceDocumentVersionId: input.request.documentVersionId, humanGateId: input.request.humanGateId }])]);
        if (!provenance.rowCount) throw new AcademicLanguageRepositoryError("idempotency_payload_conflict");
        await client.query("COMMIT");
        return { promotedDocumentVersionId: prior.id, versionNumber: prior.versionNumber, contentHash: prior.contentHash, idempotent: true };
      }
      const source = await loadById(client, input.tenant, input.request.documentVersionId, true);
      if (!source || source.stageDetail !== LANGUAGE_STAGE || source.contentHash !== input.request.contentHash) throw new AcademicLanguageRepositoryError("language_document_not_found", 404);
      const envelope = parseEnvelope<LanguageEnvelope>(source.body, "LANGUAGE_RUN");
      const gate = await client.query(`SELECT 1 FROM research_human_gates WHERE id = $4 AND workspace_id = $1 AND project_id = $2 AND created_by_user_id = $3 AND gate_type = 'DOCUMENT_RELEASE' AND artifact_type = 'document' AND artifact_version_id = $5 AND approved_content_hash = $6 AND decision = 'APPROVED'`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, input.request.humanGateId, source.id, source.contentHash]);
      if (!gate.rowCount || !source.lockedAt) throw new AcademicLanguageRepositoryError("document_human_gate_required");
      const latest = await latestForLogicalId(client, input.tenant, input.request.targetLogicalId);
      if (Number(latest?.versionNumber || 0) !== input.request.expectedVersion) throw new AcademicLanguageRepositoryError("version_conflict");
      const body = envelope.result.paragraphs.map((paragraph) => paragraph.revised).join("\n\n");
      const contentHash = academicLanguageHash({ title: input.request.title, body, sourceDocumentVersionId: source.id, sourceContentHash: source.contentHash, humanGateId: input.request.humanGateId });
      const versionNumber = Number(latest?.versionNumber || 0) + 1;
      await client.query(
        `INSERT INTO research_documents (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail,locked_at,locked_by_user_id)
         VALUES ($4,$5,$6,$7,$1,$2,$3,'MANUSCRIPT',$8,$9,$10,'S7_DOCUMENT_DRAFT',now(),$3)`,
        [input.tenant.workspaceId, input.tenant.projectId, input.userId, promotedId, input.request.targetLogicalId, versionNumber, latest?.id || null, input.request.title, body, contentHash],
      );
      const refs = [{ promotedDocumentVersionId: promotedId, sourceDocumentVersionId: source.id, sourceContentHash: source.contentHash, humanGateId: input.request.humanGateId }];
      const eventPayload = { fromStage: "S7_DOCUMENT_DRAFT", toStage: "S7_DOCUMENT_DRAFT", stageDetail: "M02_HUMAN_APPROVED_PROMOTION", artifactRefs: refs, humanGateId: input.request.humanGateId, lifecycleContractVersion: "1.5.27" };
      await client.query(
        `INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,human_gate_id,event_hash)
         VALUES ($4,$1,$2,$3,'S7_DOCUMENT_DRAFT','S7_DOCUMENT_DRAFT','M02_HUMAN_APPROVED_PROMOTION','1.5.27',$5::jsonb,$6,$7)`,
        [input.tenant.workspaceId, input.tenant.projectId, input.userId, `wfe_${randomUUID()}`, JSON.stringify(refs), input.request.humanGateId, academicLanguageHash(eventPayload)],
      );
      await client.query("COMMIT");
      return { promotedDocumentVersionId: promotedId, versionNumber, contentHash, idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function closeAcademicLanguageRepositoryForDisposableTest() {
  if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new AcademicLanguageStorageUnavailable();
  await pool?.end();
}
