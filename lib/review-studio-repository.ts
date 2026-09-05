import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { authConfiguration } from "./auth-config.ts";
import {
  REVIEW_STUDIO_CONTRACT_VERSION,
  REVIEW_STUDIO_MAX_REVISION_LOOPS,
  ReviewStudioContractError,
  applyReviewDecisions,
  reviewEarlyStopEligible,
  reviewRequestHash,
  reviewStudioHash,
  splitReviewParagraphs,
  type ApproveReviewDocumentRequest,
  type PromoteReviewDocumentRequest,
  type ResolvedRunReviewRequest,
  type ReviewProviderResult,
  type RunReviewRequest,
  type SaveRevisionRequest,
} from "./review-studio-contract.ts";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
const REVIEW_STAGE = "S7_M03_REVIEW_RESULT";
const REVISION_STAGE = "S7_M03_REVISED_DRAFT";

type ReviewEnvelope = {
  contractVersion: typeof REVIEW_STUDIO_CONTRACT_VERSION;
  kind: "REVIEW_RESULT";
  requestHash: string;
  resultHash: string;
  stage: RunReviewRequest["stage"];
  cycle: number;
  source: { documentVersionId: string | null; documentContentHash: string | null; sourceHash: string; text: string };
  previousReviewDocumentVersionId: string | null;
  lenses: RunReviewRequest["lenses"];
  journalProfile: string;
  methodParameters: RunReviewRequest["methodParameters"];
  result: ReviewProviderResult;
  earlyStopEligible: boolean;
  provenance: { method: "老麥審稿契約"; reviewOnly: true; appendOnly: true; humanReviewRequired: true };
};

type RevisionEnvelope = {
  contractVersion: typeof REVIEW_STUDIO_CONTRACT_VERSION;
  kind: "REVIEW_REVISION";
  requestHash: string;
  reviewDocumentVersionId: string;
  reviewContentHash: string;
  cycle: number;
  sourceHash: string;
  resultHash: string;
  sourceText: string;
  revisedText: string;
  paragraphs: Array<{ paragraphId: string; source: string; revised: string }>;
  decisions: SaveRevisionRequest["decisions"];
  provenance: { method: "老麥人工選擇修訂契約"; appendOnly: true; sourceOverwritten: false; humanReviewRequired: true };
};

type StoredDocument = { id: string; logicalId: string; versionNumber: number; contentHash: string; title: string; body: string; stageDetail: string; lockedAt: string | null };

export class ReviewStudioStorageUnavailable extends Error { constructor() { super("review_studio_storage_unavailable"); } }
export class ReviewStudioRepositoryError extends Error {
  readonly code: string; readonly status: number;
  constructor(code: string, status = 409) { super(code); this.name = "ReviewStudioRepositoryError"; this.code = code; this.status = status; }
}

function tenantWhere(alias = "") {
  const p = alias ? `${alias}.` : "";
  return `${p}workspace_id = $1 AND ${p}project_id = $2 AND ${p}created_by_user_id = $3 AND EXISTS (SELECT 1 FROM workspace_members m03_access WHERE m03_access.workspace_id = $1 AND m03_access.user_id = $3)`;
}

async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool || !authConfiguration().ready) throw new ReviewStudioStorageUnavailable();
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}

function deterministicId(prefix: string, tenant: ResearchTenant, idempotencyKey: string) {
  const digest = createHash("sha256").update(`${REVIEW_STUDIO_CONTRACT_VERSION}\0${tenant.workspaceId}\0${tenant.projectId}\0${tenant.userId}\0${idempotencyKey}`, "utf8").digest("hex");
  return `${prefix}_${digest.slice(0, 40)}`;
}

function stored(row: Record<string, unknown>): StoredDocument {
  return { id: String(row.id), logicalId: String(row.logicalId), versionNumber: Number(row.versionNumber), contentHash: String(row.contentHash), title: String(row.title), body: String(row.body), stageDetail: String(row.stageDetail), lockedAt: row.lockedAt ? String(row.lockedAt) : null };
}

function parseEnvelope<T extends ReviewEnvelope | RevisionEnvelope>(body: string, kind: T["kind"]): T {
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new ReviewStudioRepositoryError("stored_review_shape_invalid", 503); }
  if (!value || typeof value !== "object" || Array.isArray(value) || (value as { contractVersion?: unknown }).contractVersion !== REVIEW_STUDIO_CONTRACT_VERSION || (value as { kind?: unknown }).kind !== kind) throw new ReviewStudioRepositoryError("stored_review_shape_invalid", 503);
  return value as T;
}

async function loadById(client: PoolClient, tenant: ResearchTenant, id: string, lock = false) {
  const result = await client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", title, body, stage_detail AS "stageDetail", locked_at AS "lockedAt" FROM research_documents WHERE id = $3 AND ${tenantWhere()} ${lock ? "FOR SHARE" : ""}`, [tenant.workspaceId, tenant.projectId, id]);
  return result.rows[0] ? stored(result.rows[0]) : null;
}

async function latest(client: PoolClient, tenant: ResearchTenant, logicalId: string) {
  const result = await client.query<{ id: string; versionNumber: number }>(`SELECT id, version_number AS "versionNumber" FROM research_documents WHERE ${tenantWhere()} AND logical_id = $4 ORDER BY version_number DESC LIMIT 1 FOR UPDATE`, [tenant.workspaceId, tenant.projectId, tenant.userId, logicalId]);
  return result.rows[0] ?? null;
}

async function lock(client: PoolClient, tenant: ResearchTenant, key: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`m03:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]);
}

function reviewPublic(document: StoredDocument, envelope: ReviewEnvelope) {
  return {
    reviewDocumentVersionId: document.id, logicalId: document.logicalId, versionNumber: document.versionNumber, title: document.title, contentHash: document.contentHash,
    stage: envelope.stage, cycle: envelope.cycle, sourceDocumentVersionId: envelope.source.documentVersionId, sourceContentHash: envelope.source.sourceHash,
    sourceText: envelope.source.text, resultHash: envelope.resultHash, lenses: envelope.lenses, journalProfile: envelope.journalProfile,
    findings: envelope.result.findings, uncertainties: envelope.result.uncertainties, qualityDelta: envelope.result.qualityDelta,
    earlyStopEligible: envelope.earlyStopEligible, maxRevisionLoops: REVIEW_STUDIO_MAX_REVISION_LOOPS, appendOnly: true as const,
  };
}

function revisionPublic(document: StoredDocument, envelope: RevisionEnvelope, approval: { id: string } | null = null) {
  return {
    documentVersionId: document.id, logicalId: document.logicalId, versionNumber: document.versionNumber, title: document.title, contentHash: document.contentHash,
    reviewDocumentVersionId: envelope.reviewDocumentVersionId, cycle: envelope.cycle, sourceHash: envelope.sourceHash, resultHash: envelope.resultHash,
    sourceText: envelope.sourceText, revisedText: envelope.revisedText, paragraphs: envelope.paragraphs, decisions: envelope.decisions,
    humanGate: approval ? { status: "APPROVED" as const, id: approval.id } : { status: "REQUIRED" as const, id: null }, appendOnly: true as const, sourceOverwritten: false as const,
  };
}

function extractDocumentText(document: StoredDocument) {
  if (document.stageDetail === REVISION_STAGE) return parseEnvelope<RevisionEnvelope>(document.body, "REVIEW_REVISION").revisedText;
  if (document.stageDetail === "S7_DOCUMENT_DRAFT") return document.body;
  if (document.stageDetail === "S7_M02_LANGUAGE_DRAFT") {
    let value: unknown;
    try { value = JSON.parse(document.body); } catch { throw new ReviewStudioRepositoryError("review_source_document_shape_invalid", 422); }
    const paragraphs = (value as { result?: { paragraphs?: unknown } })?.result?.paragraphs;
    if (!Array.isArray(paragraphs) || paragraphs.some((item) => !item || typeof item !== "object" || typeof (item as { revised?: unknown }).revised !== "string")) throw new ReviewStudioRepositoryError("review_source_document_shape_invalid", 422);
    return paragraphs.map((item) => (item as { revised: string }).revised).join("\n\n");
  }
  throw new ReviewStudioRepositoryError("review_source_stage_not_allowed", 422);
}

export async function resolveReviewSource(tenant: ResearchTenant, request: RunReviewRequest): Promise<ResolvedRunReviewRequest> {
  return withClient(async (client) => {
    let sourceText: string;
    let sourceDocumentVersionId: string | null = null;
    let sourceDocumentContentHash: string | null = null;
    if (request.source.kind === "PASTED_TEXT") sourceText = request.source.text;
    else {
      const document = await loadById(client, tenant, request.source.documentVersionId);
      if (!document || document.contentHash !== request.source.contentHash) throw new ReviewStudioRepositoryError("review_source_document_not_found", 404);
      sourceText = extractDocumentText(document);
      sourceDocumentVersionId = document.id;
      sourceDocumentContentHash = document.contentHash;
    }
    splitReviewParagraphs(sourceText);
    if (request.stage === "RE_REVIEW") {
      const previous = await loadById(client, tenant, request.previousReviewDocumentVersionId!);
      if (!previous || previous.stageDetail !== REVIEW_STAGE) throw new ReviewStudioRepositoryError("previous_review_not_found", 404);
      const previousEnvelope = parseEnvelope<ReviewEnvelope>(previous.body, "REVIEW_RESULT");
      if (previousEnvelope.cycle !== request.cycle - 1 || sourceDocumentVersionId === null) throw new ReviewStudioRepositoryError("review_state_transition_invalid");
      const sourceDocument = await loadById(client, tenant, sourceDocumentVersionId);
      if (!sourceDocument || sourceDocument.stageDetail !== REVISION_STAGE) throw new ReviewStudioRepositoryError("re_review_source_invalid");
      const revision = parseEnvelope<RevisionEnvelope>(sourceDocument.body, "REVIEW_REVISION");
      if (revision.reviewDocumentVersionId !== previous.id || revision.cycle !== previousEnvelope.cycle + 1) throw new ReviewStudioRepositoryError("review_state_transition_invalid");
    }
    return { ...request, sourceText, sourceDocumentVersionId, sourceContentHash: reviewStudioHash(sourceText), source: request.source.kind === "PASTED_TEXT" ? request.source : { kind: "DOCUMENT_VERSION", documentVersionId: sourceDocumentVersionId!, contentHash: sourceDocumentContentHash! } };
  });
}

export async function replayReviewRun(tenant: ResearchTenant, idempotencyKey: string, requestHash: string) {
  return withClient(async (client) => {
    const document = await loadById(client, tenant, deterministicId("document_m03_review", tenant, idempotencyKey));
    if (!document) return null;
    if (document.stageDetail !== REVIEW_STAGE) throw new ReviewStudioRepositoryError("stored_review_shape_invalid", 503);
    const envelope = parseEnvelope<ReviewEnvelope>(document.body, "REVIEW_RESULT");
    if (envelope.requestHash !== requestHash) throw new ReviewStudioRepositoryError("idempotency_payload_conflict");
    return { ...reviewPublic(document, envelope), idempotent: true };
  });
}

export async function saveReviewRun(input: { tenant: ResearchTenant; userId: string; request: ResolvedRunReviewRequest; result: ReviewProviderResult }) {
  if (input.tenant.userId !== input.userId) throw new ReviewStudioRepositoryError("tenant_identity_mismatch", 404);
  const requestHash = reviewRequestHash(input.request);
  const resultHash = reviewStudioHash(input.result);
  const envelope: ReviewEnvelope = {
    contractVersion: REVIEW_STUDIO_CONTRACT_VERSION, kind: "REVIEW_RESULT", requestHash, resultHash, stage: input.request.stage, cycle: input.request.cycle,
    source: { documentVersionId: input.request.sourceDocumentVersionId, documentContentHash: input.request.source.kind === "DOCUMENT_VERSION" ? input.request.source.contentHash : null, sourceHash: input.request.sourceContentHash, text: input.request.sourceText },
    previousReviewDocumentVersionId: input.request.previousReviewDocumentVersionId, lenses: input.request.lenses, journalProfile: input.request.journalProfile,
    methodParameters: input.request.methodParameters, result: input.result, earlyStopEligible: reviewEarlyStopEligible(input.result),
    provenance: { method: "老麥審稿契約", reviewOnly: true, appendOnly: true, humanReviewRequired: true },
  };
  const body = JSON.stringify(envelope); const contentHash = reviewStudioHash(envelope); const id = deterministicId("document_m03_review", input.tenant, input.request.idempotencyKey);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, input.tenant, input.request.logicalId);
      const prior = await loadById(client, input.tenant, id, true);
      if (prior) {
        const storedEnvelope = parseEnvelope<ReviewEnvelope>(prior.body, "REVIEW_RESULT");
        if (storedEnvelope.requestHash !== requestHash) throw new ReviewStudioRepositoryError("idempotency_payload_conflict");
        await client.query("COMMIT"); return { ...reviewPublic(prior, storedEnvelope), idempotent: true };
      }
      const latestDocument = await latest(client, input.tenant, input.request.logicalId);
      if (Number(latestDocument?.versionNumber || 0) !== input.request.expectedVersion) throw new ReviewStudioRepositoryError("version_conflict");
      const versionNumber = Number(latestDocument?.versionNumber || 0) + 1;
      await client.query(`INSERT INTO research_documents (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail) VALUES ($4,$5,$6,$7,$1,$2,$3,'MANUSCRIPT',$8,$9,$10,$11)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.request.logicalId, versionNumber, latestDocument?.id || null, input.request.title, body, contentHash, REVIEW_STAGE]);
      const document: StoredDocument = { id, logicalId: input.request.logicalId, versionNumber, contentHash, title: input.request.title, body, stageDetail: REVIEW_STAGE, lockedAt: null };
      await client.query("COMMIT"); return { ...reviewPublic(document, envelope), idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function saveReviewRevision(input: { tenant: ResearchTenant; userId: string; request: SaveRevisionRequest }) {
  if (input.tenant.userId !== input.userId) throw new ReviewStudioRepositoryError("tenant_identity_mismatch", 404);
  const requestHash = reviewRequestHash(input.request); const id = deterministicId("document_m03_revision", input.tenant, input.request.idempotencyKey);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, input.tenant, input.request.logicalId);
      const prior = await loadById(client, input.tenant, id, true);
      if (prior) {
        const storedEnvelope = parseEnvelope<RevisionEnvelope>(prior.body, "REVIEW_REVISION");
        if (storedEnvelope.requestHash !== requestHash) throw new ReviewStudioRepositoryError("idempotency_payload_conflict");
        await client.query("COMMIT"); return { ...revisionPublic(prior, storedEnvelope), idempotent: true };
      }
      const reviewDocument = await loadById(client, input.tenant, input.request.reviewDocumentVersionId, true);
      if (!reviewDocument || reviewDocument.stageDetail !== REVIEW_STAGE || reviewDocument.contentHash !== input.request.reviewContentHash) throw new ReviewStudioRepositoryError("review_document_not_found", 404);
      const review = parseEnvelope<ReviewEnvelope>(reviewDocument.body, "REVIEW_RESULT");
      if (review.cycle >= REVIEW_STUDIO_MAX_REVISION_LOOPS) throw new ReviewStudioRepositoryError("revision_loop_limit_reached", 422);
      const applied = applyReviewDecisions(review.source.text, review.result.findings, input.request.decisions);
      const resultHash = reviewStudioHash(applied.revisedText);
      const envelope: RevisionEnvelope = { contractVersion: REVIEW_STUDIO_CONTRACT_VERSION, kind: "REVIEW_REVISION", requestHash, reviewDocumentVersionId: reviewDocument.id, reviewContentHash: reviewDocument.contentHash, cycle: review.cycle + 1, sourceHash: review.source.sourceHash, resultHash, sourceText: review.source.text, revisedText: applied.revisedText, paragraphs: applied.paragraphs, decisions: input.request.decisions, provenance: { method: "老麥人工選擇修訂契約", appendOnly: true, sourceOverwritten: false, humanReviewRequired: true } };
      const body = JSON.stringify(envelope); const contentHash = reviewStudioHash(envelope);
      const latestDocument = await latest(client, input.tenant, input.request.logicalId);
      if (Number(latestDocument?.versionNumber || 0) !== input.request.expectedVersion) throw new ReviewStudioRepositoryError("version_conflict");
      const versionNumber = Number(latestDocument?.versionNumber || 0) + 1;
      await client.query(`INSERT INTO research_documents (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail) VALUES ($4,$5,$6,$7,$1,$2,$3,'MANUSCRIPT',$8,$9,$10,$11)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, id, input.request.logicalId, versionNumber, latestDocument?.id || null, input.request.title, body, contentHash, REVISION_STAGE]);
      const refs = [{ reviewDocumentVersionId: reviewDocument.id, revisedDocumentVersionId: id, sourceHash: review.source.sourceHash, resultHash }];
      const event = { fromStage: "S7_DOCUMENT_DRAFT", toStage: "S7_DOCUMENT_DRAFT", stageDetail: "M03_REVISION_SAVED", artifactRefs: refs, lifecycleContractVersion: "1.5.28" };
      await client.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,'S7_DOCUMENT_DRAFT','S7_DOCUMENT_DRAFT','M03_REVISION_SAVED','1.5.28',$5::jsonb,$6)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, `wfe_${randomUUID()}`, JSON.stringify(refs), reviewStudioHash(event)]);
      const document: StoredDocument = { id, logicalId: input.request.logicalId, versionNumber, contentHash, title: input.request.title, body, stageDetail: REVISION_STAGE, lockedAt: null };
      await client.query("COMMIT"); return { ...revisionPublic(document, envelope), idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function getReviewStudioOverview(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const [result, sourceResult] = await Promise.all([
      client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", title, body, stage_detail AS "stageDetail", locked_at AS "lockedAt" FROM research_documents WHERE ${tenantWhere()} AND stage_detail IN ($3,$4) ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId, REVIEW_STAGE, REVISION_STAGE]),
      client.query(`SELECT id AS "documentVersionId", logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", title, stage_detail AS "stageDetail" FROM research_documents WHERE ${tenantWhere()} AND stage_detail IN ('S7_DOCUMENT_DRAFT','S7_M02_LANGUAGE_DRAFT',$3) ORDER BY created_at DESC LIMIT 100`, [tenant.workspaceId, tenant.projectId, REVISION_STAGE]),
    ]);
    const reviews: Array<{ document: StoredDocument; envelope: ReviewEnvelope }> = []; const revisions: Array<{ document: StoredDocument; envelope: RevisionEnvelope }> = [];
    for (const row of result.rows) { const document = stored(row); if (document.stageDetail === REVIEW_STAGE) reviews.push({ document, envelope: parseEnvelope<ReviewEnvelope>(document.body, "REVIEW_RESULT") }); else revisions.push({ document, envelope: parseEnvelope<RevisionEnvelope>(document.body, "REVIEW_REVISION") }); }
    const approvals = revisions.length ? await client.query<{ id: string; artifactVersionId: string }>(`SELECT id, artifact_version_id AS "artifactVersionId" FROM research_human_gates WHERE workspace_id=$1 AND project_id=$2 AND created_by_user_id=$3 AND gate_type='DOCUMENT_RELEASE' AND artifact_type='document' AND decision='APPROVED' AND artifact_version_id=ANY($4::text[])`, [tenant.workspaceId, tenant.projectId, tenant.userId, revisions.map((item) => item.document.id)]) : { rows: [] };
    const byDocument = new Map(approvals.rows.map((row) => [row.artifactVersionId, { id: row.id }]));
    return { contractVersion: REVIEW_STUDIO_CONTRACT_VERSION, maxRevisionLoops: REVIEW_STUDIO_MAX_REVISION_LOOPS, sources: sourceResult.rows, reviews: reviews.map((item) => reviewPublic(item.document, item.envelope)), revisions: revisions.map((item) => revisionPublic(item.document, item.envelope, byDocument.get(item.document.id) ?? null)) };
  });
}

export async function approveReviewDocument(input: { tenant: ResearchTenant; userId: string; request: ApproveReviewDocumentRequest }) {
  if (input.tenant.userId !== input.userId) throw new ReviewStudioRepositoryError("tenant_identity_mismatch", 404);
  const gateId = deterministicId("gate_m03_document", input.tenant, input.request.idempotencyKey);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, input.tenant, input.request.documentVersionId);
      const document = await loadById(client, input.tenant, input.request.documentVersionId, true);
      const reviewDocument = await loadById(client, input.tenant, input.request.reviewDocumentVersionId, true);
      if (!document || document.stageDetail !== REVISION_STAGE || document.contentHash !== input.request.contentHash) throw new ReviewStudioRepositoryError("review_revision_not_found", 404);
      if (!reviewDocument || reviewDocument.stageDetail !== REVIEW_STAGE || reviewDocument.contentHash !== input.request.reviewContentHash) throw new ReviewStudioRepositoryError("review_document_not_found", 404);
      const revision = parseEnvelope<RevisionEnvelope>(document.body, "REVIEW_REVISION"); const review = parseEnvelope<ReviewEnvelope>(reviewDocument.body, "REVIEW_RESULT");
      if (review.source.documentVersionId !== document.id || review.cycle !== revision.cycle || !review.earlyStopEligible) throw new ReviewStudioRepositoryError("review_convergence_gate_required", 422);
      const prior = await client.query(`SELECT 1 FROM research_human_gates WHERE id=$4 AND workspace_id=$1 AND project_id=$2 AND created_by_user_id=$3`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, gateId]);
      if (prior.rowCount) { await client.query("COMMIT"); return { humanGateId: gateId, documentVersionId: document.id, contentHash: document.contentHash, idempotent: true }; }
      await client.query(`UPDATE research_documents SET locked_at=now(), locked_by_user_id=$3 WHERE id=$4 AND ${tenantWhere()} AND content_hash=$5 AND locked_at IS NULL`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, document.id, document.contentHash]);
      await client.query(`INSERT INTO research_human_gates (id,workspace_id,project_id,created_by_user_id,gate_type,artifact_type,artifact_version_id,approved_content_hash,decision,approver_user_id,approved_at,rationale) VALUES ($4,$1,$2,$3,'DOCUMENT_RELEASE','document',$5,$6,'APPROVED',$3,now(),$7)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, gateId, document.id, document.contentHash, input.request.rationale]);
      await client.query("COMMIT"); return { humanGateId: gateId, documentVersionId: document.id, contentHash: document.contentHash, idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function promoteReviewDocument(input: { tenant: ResearchTenant; userId: string; request: PromoteReviewDocumentRequest }) {
  if (input.tenant.userId !== input.userId) throw new ReviewStudioRepositoryError("tenant_identity_mismatch", 404);
  const promotedId = deterministicId("document_m03_promoted", input.tenant, input.request.idempotencyKey);
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, input.tenant, input.request.targetLogicalId);
      const prior = await loadById(client, input.tenant, promotedId, true);
      if (prior) { await client.query("COMMIT"); return { promotedDocumentVersionId: prior.id, versionNumber: prior.versionNumber, contentHash: prior.contentHash, idempotent: true }; }
      const source = await loadById(client, input.tenant, input.request.documentVersionId, true);
      if (!source || source.stageDetail !== REVISION_STAGE || source.contentHash !== input.request.contentHash) throw new ReviewStudioRepositoryError("review_revision_not_found", 404);
      const revision = parseEnvelope<RevisionEnvelope>(source.body, "REVIEW_REVISION");
      const gate = await client.query(`SELECT 1 FROM research_human_gates WHERE id=$4 AND workspace_id=$1 AND project_id=$2 AND created_by_user_id=$3 AND gate_type='DOCUMENT_RELEASE' AND artifact_type='document' AND artifact_version_id=$5 AND approved_content_hash=$6 AND decision='APPROVED'`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, input.request.humanGateId, source.id, source.contentHash]);
      if (!gate.rowCount || !source.lockedAt) throw new ReviewStudioRepositoryError("document_human_gate_required");
      const latestDocument = await latest(client, input.tenant, input.request.targetLogicalId);
      if (Number(latestDocument?.versionNumber || 0) !== input.request.expectedVersion) throw new ReviewStudioRepositoryError("version_conflict");
      const versionNumber = Number(latestDocument?.versionNumber || 0) + 1; const contentHash = reviewStudioHash({ title: input.request.title, body: revision.revisedText, sourceDocumentVersionId: source.id, sourceContentHash: source.contentHash, humanGateId: input.request.humanGateId });
      await client.query(`INSERT INTO research_documents (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,document_type,title,body,content_hash,stage_detail,locked_at,locked_by_user_id) VALUES ($4,$5,$6,$7,$1,$2,$3,'MANUSCRIPT',$8,$9,$10,'S7_DOCUMENT_DRAFT',now(),$3)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, promotedId, input.request.targetLogicalId, versionNumber, latestDocument?.id || null, input.request.title, revision.revisedText, contentHash]);
      const refs = [{ promotedDocumentVersionId: promotedId, sourceDocumentVersionId: source.id, sourceContentHash: source.contentHash, humanGateId: input.request.humanGateId }];
      const event = { fromStage: "S7_DOCUMENT_DRAFT", toStage: "S7_DOCUMENT_DRAFT", stageDetail: "M03_HUMAN_APPROVED_PROMOTION", artifactRefs: refs, humanGateId: input.request.humanGateId, lifecycleContractVersion: "1.5.28" };
      await client.query(`INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,human_gate_id,event_hash) VALUES ($4,$1,$2,$3,'S7_DOCUMENT_DRAFT','S7_DOCUMENT_DRAFT','M03_HUMAN_APPROVED_PROMOTION','1.5.28',$5::jsonb,$6,$7)`, [input.tenant.workspaceId, input.tenant.projectId, input.userId, `wfe_${randomUUID()}`, JSON.stringify(refs), input.request.humanGateId, reviewStudioHash(event)]);
      await client.query("COMMIT"); return { promotedDocumentVersionId: promotedId, versionNumber, contentHash, idempotent: false };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function closeReviewStudioRepositoryForDisposableTest() {
  if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new ReviewStudioStorageUnavailable();
  await pool?.end();
}
