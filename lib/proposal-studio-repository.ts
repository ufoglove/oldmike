import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import {
  PROPOSAL_STUDIO_CONTRACT_VERSION,
  PROPOSAL_STUDIO_MAX_BODY_BYTES,
  ProposalStudioContractError,
  assertProposalPromotable,
  buildProposalMarkdown,
  parseProposalDraft,
  proposalRequestHash,
  proposalStudioHash,
  proposalValidationSummary,
  type ApproveProposalRequest,
  type ExportProposalPreviewRequest,
  type ProposalDraft,
  type RequestProposalGuidanceRequest,
  type SaveProposalVersionRequest,
} from "./proposal-studio-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
const PROPOSAL_STAGE = "S5_M05_PROPOSAL_DRAFT";

type StoredDocument = { id: string; logicalId: string; versionNumber: number; contentHash: string; title: string; body: string; stageDetail: string; lockedAt: string | null; createdAt: string };
type ProposalEnvelope = {
  contractVersion: typeof PROPOSAL_STUDIO_CONTRACT_VERSION;
  kind: "PROPOSAL_VERSION";
  requestHash: string;
  sourceDocument: { documentVersionId: string; contentHash: string } | null;
  proposal: ProposalDraft;
  validation: ReturnType<typeof proposalValidationSummary>;
  provenance: { appendOnly: true; structuredEnvelope: true; sourceOverwritten: false; officialSourceRequired: true; humanGateRequired: true };
};

export class ProposalStudioStorageUnavailable extends Error { constructor() { super("proposal_studio_storage_unavailable"); this.name = "ProposalStudioStorageUnavailable"; } }
export class ProposalStudioRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "ProposalStudioRepositoryError"; this.code = code; this.status = status; }
}

function tenantWhere(alias = "") { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2 AND ${p}created_by_user_id=$3 AND EXISTS (SELECT 1 FROM workspace_members m05_access WHERE m05_access.workspace_id=$1 AND m05_access.user_id=$3 AND m05_access.role IN ('owner','member'))`; }
function stored(row: Record<string, unknown>): StoredDocument { return { id: String(row.id), logicalId: String(row.logicalId), versionNumber: Number(row.versionNumber), contentHash: String(row.contentHash), title: String(row.title), body: String(row.body), stageDetail: String(row.stageDetail), lockedAt: row.lockedAt ? String(row.lockedAt) : null, createdAt: String(row.createdAt) }; }
function deterministicId(prefix: string, tenant: ResearchTenant, idempotencyKey: string) { return `${prefix}_${proposalStudioHash({ workspaceId: tenant.workspaceId, projectId: tenant.projectId, userId: tenant.userId, idempotencyKey }).slice(0, 40)}`; }
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) { if (!pool) throw new ProposalStudioStorageUnavailable(); const client = await pool.connect(); try { return await operation(client); } finally { client.release(); } }
async function lock(client: PoolClient, tenant: ResearchTenant, key: string) { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`m05:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]); }
async function loadById(client: PoolClient, tenant: ResearchTenant, id: string, forUpdate = false) { const result = await client.query(`SELECT id,logical_id AS "logicalId",version_number AS "versionNumber",content_hash AS "contentHash",title,body,stage_detail AS "stageDetail",locked_at AS "lockedAt",created_at AS "createdAt" FROM research_documents WHERE ${tenantWhere()} AND id=$3${forUpdate ? " FOR UPDATE" : ""}`, [tenant.workspaceId, tenant.projectId, id]); return result.rows[0] ? stored(result.rows[0]) : null; }
async function latest(client: PoolClient, tenant: ResearchTenant, logicalId: string) { const result = await client.query(`SELECT id,logical_id AS "logicalId",version_number AS "versionNumber",content_hash AS "contentHash",title,body,stage_detail AS "stageDetail",locked_at AS "lockedAt",created_at AS "createdAt" FROM research_documents WHERE ${tenantWhere()} AND logical_id=$3 AND stage_detail=$4 ORDER BY version_number DESC LIMIT 1 FOR UPDATE`, [tenant.workspaceId, tenant.projectId, logicalId, PROPOSAL_STAGE]); return result.rows[0] ? stored(result.rows[0]) : null; }

function parseEnvelope(document: StoredDocument): ProposalEnvelope {
  let value: unknown;
  try { value = JSON.parse(document.body); } catch { throw new ProposalStudioRepositoryError("proposal_envelope_invalid"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProposalStudioRepositoryError("proposal_envelope_invalid");
  const row = value as Record<string, unknown>; const expected = ["contractVersion", "kind", "requestHash", "sourceDocument", "proposal", "validation", "provenance"];
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(expected.sort()) || row.contractVersion !== PROPOSAL_STUDIO_CONTRACT_VERSION || row.kind !== "PROPOSAL_VERSION" || typeof row.requestHash !== "string" || !/^[a-f0-9]{64}$/.test(row.requestHash)) throw new ProposalStudioRepositoryError("proposal_envelope_invalid");
  const proposal = parseProposalDraft(row.proposal); const validation = proposalValidationSummary(proposal, new Date(document.createdAt));
  if (proposalStudioHash(validation) !== proposalStudioHash(row.validation)) throw new ProposalStudioRepositoryError("proposal_validation_binding_invalid");
  const sourceDocument = row.sourceDocument === null ? null : row.sourceDocument as Record<string, unknown>;
  if (sourceDocument && (Object.keys(sourceDocument).sort().join(",") !== "contentHash,documentVersionId" || typeof sourceDocument.documentVersionId !== "string" || typeof sourceDocument.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(sourceDocument.contentHash))) throw new ProposalStudioRepositoryError("proposal_source_binding_invalid");
  const provenance = row.provenance as Record<string, unknown> | null;
  if (!provenance || Object.keys(provenance).sort().join(",") !== ["appendOnly", "humanGateRequired", "officialSourceRequired", "sourceOverwritten", "structuredEnvelope"].sort().join(",") || provenance.appendOnly !== true || provenance.structuredEnvelope !== true || provenance.sourceOverwritten !== false || provenance.officialSourceRequired !== true || provenance.humanGateRequired !== true) throw new ProposalStudioRepositoryError("proposal_provenance_invalid");
  return { contractVersion: PROPOSAL_STUDIO_CONTRACT_VERSION, kind: "PROPOSAL_VERSION", requestHash: row.requestHash, sourceDocument: sourceDocument ? { documentVersionId: String(sourceDocument.documentVersionId), contentHash: String(sourceDocument.contentHash) } : null, proposal, validation, provenance: { appendOnly: true, structuredEnvelope: true, sourceOverwritten: false, officialSourceRequired: true, humanGateRequired: true } };
}

function proposalPublic(document: StoredDocument, envelope: ProposalEnvelope, gate: { id: string } | null = null) {
  return { documentVersionId: document.id, logicalId: document.logicalId, versionNumber: document.versionNumber, title: document.title, contentHash: document.contentHash, createdAt: document.createdAt, proposal: envelope.proposal, validation: proposalValidationSummary(envelope.proposal), sourceDocument: envelope.sourceDocument, appendOnly: true as const, sourceOverwritten: false as const, humanGate: { status: gate ? "APPROVED" as const : "REQUIRED" as const, id: gate?.id ?? null } };
}

export async function saveProposalVersion(input: { tenant: ResearchTenant; userId: string; request: SaveProposalVersionRequest; now?: Date }) {
  const id = deterministicId("document_m05", input.tenant, input.request.idempotencyKey); const requestHash = proposalRequestHash(input.request); const now = input.now ?? new Date();
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, input.tenant, input.request.logicalId);
      const prior = await loadById(client, input.tenant, id, true);
      if (prior) { const envelope = parseEnvelope(prior); if (envelope.requestHash !== requestHash) throw new ProposalStudioRepositoryError("idempotency_payload_conflict", 409); await client.query("COMMIT"); return { ...proposalPublic(prior, envelope), idempotent: true }; }
      if (input.request.sourceDocumentVersionId) {
        const source = await loadById(client, input.tenant, input.request.sourceDocumentVersionId, true);
        if (!source || source.contentHash !== input.request.sourceContentHash || source.stageDetail === PROPOSAL_STAGE) throw new ProposalStudioRepositoryError("proposal_source_document_not_found", 404);
      }
      const latestDocument = await latest(client, input.tenant, input.request.logicalId); if (Number(latestDocument?.versionNumber ?? 0) !== input.request.expectedVersion) throw new ProposalStudioRepositoryError("version_conflict", 409);
      const proposal = parseProposalDraft(input.request.proposal); const validation = proposalValidationSummary(proposal, now);
      const envelope: ProposalEnvelope = { contractVersion: PROPOSAL_STUDIO_CONTRACT_VERSION, kind: "PROPOSAL_VERSION", requestHash, sourceDocument: input.request.sourceDocumentVersionId ? { documentVersionId: input.request.sourceDocumentVersionId, contentHash: input.request.sourceContentHash! } : null, proposal, validation, provenance: { appendOnly: true, structuredEnvelope: true, sourceOverwritten: false, officialSourceRequired: true, humanGateRequired: true } };
      const body = JSON.stringify(envelope); if (Buffer.byteLength(body, "utf8") > PROPOSAL_STUDIO_MAX_BODY_BYTES) throw new ProposalStudioRepositoryError("proposal_too_large", 413); const contentHash = proposalStudioHash(envelope); const versionNumber = Number(latestDocument?.versionNumber ?? 0) + 1;
      await client.query(`INSERT INTO research_documents (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail,created_at,updated_at) VALUES ($4,$5,$6,$7,$1,$2,$3,'RESEARCH_PLAN',$8,$9,$10,$11,$12,$12)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.request.logicalId, versionNumber, latestDocument?.id ?? null, input.request.title, body, contentHash, PROPOSAL_STAGE, now.toISOString()]);
      const refs = [{ documentVersionId: id, logicalId: input.request.logicalId, versionNumber, contentHash, proposalMode: proposal.mode, sourceHash: proposal.officialSource.sourceHash }]; const event = { fromStage: "S4_M04_READY", toStage: "S5_M05_PROPOSAL_DRAFT", stageDetail: "M05_PROPOSAL_VERSION_SAVED", lifecycleContractVersion: "1.5.30", artifactRefs: refs };
      await client.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash,created_at,updated_at) VALUES ($4,$1,$2,$3,'S4_M04_READY','S5_M05_PROPOSAL_DRAFT','M05_PROPOSAL_VERSION_SAVED','1.5.30',$5::jsonb,$6,$7,$7)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, `wfe_${randomUUID()}`, JSON.stringify(refs), proposalStudioHash(event), now.toISOString()]);
      const document: StoredDocument = { id, logicalId: input.request.logicalId, versionNumber, contentHash, title: input.request.title, body, stageDetail: PROPOSAL_STAGE, lockedAt: null, createdAt: now.toISOString() };
      await client.query("COMMIT"); return { ...proposalPublic(document, envelope), idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function resolveProposalForGuidance(tenant: ResearchTenant, request: RequestProposalGuidanceRequest) {
  return withClient(async (client) => { const document = await loadById(client, tenant, request.documentVersionId); if (!document || document.stageDetail !== PROPOSAL_STAGE || document.contentHash !== request.contentHash) throw new ProposalStudioRepositoryError("proposal_document_not_found", 404); const envelope = parseEnvelope(document); return { documentVersionId: document.id, contentHash: document.contentHash, mode: envelope.proposal.mode, proposalHash: proposalStudioHash(envelope.proposal), proposal: envelope.proposal }; });
}

export async function approveProposalVersion(input: { tenant: ResearchTenant; userId: string; request: ApproveProposalRequest; now?: Date }) {
  const gateId = deterministicId("gate_m05", input.tenant, input.request.idempotencyKey); const now = input.now ?? new Date();
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, input.tenant, input.request.documentVersionId); const document = await loadById(client, input.tenant, input.request.documentVersionId, true);
      if (!document || document.stageDetail !== PROPOSAL_STAGE || document.contentHash !== input.request.contentHash) throw new ProposalStudioRepositoryError("proposal_document_not_found", 404);
      const envelope = parseEnvelope(document); try { assertProposalPromotable(envelope.proposal, now); } catch (error) { if (error instanceof ProposalStudioContractError) throw new ProposalStudioRepositoryError(error.code, error.status); throw error; }
      const prior = await client.query<{ artifactVersionId: string; approvedContentHash: string; rationale: string | null }>(`SELECT artifact_version_id AS "artifactVersionId",approved_content_hash AS "approvedContentHash",rationale FROM research_human_gates WHERE id=$3 AND ${tenantWhere()}`, [input.tenant.workspaceId, input.tenant.projectId, gateId]);
      if (prior.rowCount) { const row = prior.rows[0]; if (row.artifactVersionId !== document.id || row.approvedContentHash !== document.contentHash || row.rationale !== input.request.rationale) throw new ProposalStudioRepositoryError("idempotency_payload_conflict", 409); await client.query("COMMIT"); return { humanGateId: gateId, documentVersionId: document.id, contentHash: document.contentHash, idempotent: true }; }
      await client.query(`UPDATE research_documents SET locked_at=$5,locked_by_user_id=$3 WHERE id=$4 AND ${tenantWhere()} AND content_hash=$6 AND locked_at IS NULL`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, document.id, now.toISOString(), document.contentHash]);
      await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,rationale,created_at,updated_at) VALUES ($4,$1,$2,$3,'DOCUMENT_RELEASE','document',$5,$6,'APPROVED',$3,$7,$8,$7,$7)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, gateId, document.id, document.contentHash, now.toISOString(), input.request.rationale]);
      const refs = [{ documentVersionId: document.id, contentHash: document.contentHash, humanGateId: gateId }]; const event = { fromStage: "S5_M05_PROPOSAL_DRAFT", toStage: "S5_M05_PROPOSAL_RELEASE", stageDetail: "M05_PROPOSAL_HUMAN_GATE_APPROVED", lifecycleContractVersion: "1.5.30", artifactRefs: refs, humanGateId: gateId };
      await client.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,human_gate_id,event_hash,created_at,updated_at) VALUES ($4,$1,$2,$3,'S5_M05_PROPOSAL_DRAFT','S5_M05_PROPOSAL_RELEASE','M05_PROPOSAL_HUMAN_GATE_APPROVED','1.5.30',$5::jsonb,$6,$7,$8,$8)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, `wfe_${randomUUID()}`, JSON.stringify(refs), gateId, proposalStudioHash(event), now.toISOString()]);
      await client.query("COMMIT"); return { humanGateId: gateId, documentVersionId: document.id, contentHash: document.contentHash, idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function exportProposalPreview(input: { tenant: ResearchTenant; request: ExportProposalPreviewRequest }) {
  return withClient(async (client) => {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      const document = await loadById(client, input.tenant, input.request.documentVersionId); if (!document || document.stageDetail !== PROPOSAL_STAGE || document.contentHash !== input.request.contentHash) throw new ProposalStudioRepositoryError("proposal_document_not_found", 404); const envelope = parseEnvelope(document);
      const gate = await client.query(`SELECT 1 FROM research_human_gates WHERE id=$3 AND ${tenantWhere()} AND gate_type='DOCUMENT_RELEASE' AND artifact_type='document' AND artifact_version_id=$4 AND approved_content_hash=$5 AND decision='APPROVED'`, [input.tenant.workspaceId, input.tenant.projectId, input.request.humanGateId, document.id, document.contentHash]); if (!gate.rowCount) throw new ProposalStudioRepositoryError("proposal_human_gate_required", 422);
      const body = input.request.format === "JSON" ? JSON.stringify({ contractVersion: PROPOSAL_STUDIO_CONTRACT_VERSION, kind: "PROPOSAL_PREVIEW", title: document.title, contentHash: document.contentHash, proposal: envelope.proposal, onlineSubmission: false }, null, 2) : buildProposalMarkdown(document.title, envelope.proposal);
      if (Buffer.byteLength(body, "utf8") > PROPOSAL_STUDIO_MAX_BODY_BYTES) throw new ProposalStudioRepositoryError("proposal_export_too_large", 413); await client.query("ROLLBACK"); return { format: input.request.format, contentHash: proposalStudioHash(body), body, onlineSubmission: false as const };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function getProposalStudioOverview(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const [documentsResult, sourceResult] = await Promise.all([
      client.query(`SELECT id,logical_id AS "logicalId",version_number AS "versionNumber",content_hash AS "contentHash",title,body,stage_detail AS "stageDetail",locked_at AS "lockedAt",created_at AS "createdAt" FROM research_documents WHERE ${tenantWhere()} AND stage_detail=$3 ORDER BY created_at DESC,id DESC LIMIT 120`, [tenant.workspaceId, tenant.projectId, PROPOSAL_STAGE]),
      client.query(`SELECT id AS "documentVersionId",logical_id AS "logicalId",version_number AS "versionNumber",content_hash AS "contentHash",title,stage_detail AS "stageDetail" FROM research_documents WHERE ${tenantWhere()} AND document_type='RESEARCH_PLAN' AND stage_detail<>$4 ORDER BY created_at DESC,id DESC LIMIT 80`, [tenant.workspaceId, tenant.projectId, tenant.userId, PROPOSAL_STAGE]),
    ]);
    const proposals = documentsResult.rows.map((row) => { const document = stored(row); return { document, envelope: parseEnvelope(document) }; });
    const approvals = proposals.length ? await client.query<{ id: string; artifactVersionId: string }>(`SELECT id,artifact_version_id AS "artifactVersionId" FROM research_human_gates WHERE workspace_id=$1 AND project_id=$2 AND created_by_user_id=$3 AND gate_type='DOCUMENT_RELEASE' AND artifact_type='document' AND decision='APPROVED' AND artifact_version_id=ANY($4::text[])`, [tenant.workspaceId, tenant.projectId, tenant.userId, proposals.map((item) => item.document.id)]) : { rows: [] };
    const gateByDocument = new Map(approvals.rows.map((row) => [row.artifactVersionId, { id: row.id }]));
    return { contractVersion: PROPOSAL_STUDIO_CONTRACT_VERSION, modes: ["NSTC_RESEARCH", "MOE_TEACHING_PRACTICE"] as const, sources: sourceResult.rows, proposals: proposals.map((item) => proposalPublic(item.document, item.envelope, gateByDocument.get(item.document.id) ?? null)), providerState: process.env.OPENCLAW_BASE_URL && process.env.OPENCLAW_GATEWAY_TOKEN ? "ENABLED_CHAT_COMPLETIONS" as const : "DISABLED_LOCAL_FIXTURE_ONLY" as const, onlineSubmission: false as const };
  });
}

export async function closeProposalStudioRepositoryForDisposableTest() { if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new ProposalStudioStorageUnavailable(); await pool?.end(); }
