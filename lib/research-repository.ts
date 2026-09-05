import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { authConfiguration } from "@/lib/auth-config";
import { isWorkflowTransitionAllowed, LIFECYCLE_CONTRACT_VERSION, normalizeAnalysisParameters, sha256Canonical } from "@/lib/research-contract";
import { ANALYSIS_ENGINE, ANALYSIS_ENGINE_VERSION, runDeterministicAnalysis, type DeterministicAnalysisInput } from "@/lib/research-analysis";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export class ResearchStorageUnavailable extends Error { constructor() { super("research_storage_not_ready"); } }
export class ResearchContractViolation extends Error { constructor(public readonly code: string) { super(code); } }

export type ResearchTenant = { userId: string; workspaceId: string; projectId: string; role: "owner" | "member" };

export async function resolveResearchTenant(userId: string, projectId: string): Promise<ResearchTenant | null> {
  if (!pool || !authConfiguration().ready) throw new ResearchStorageUnavailable();
  const result = await pool.query<ResearchTenant>(
    `SELECT wm.user_id AS "userId", wm.workspace_id AS "workspaceId", p.project_id AS "projectId", wm.role
     FROM workspace_members wm
     JOIN projects p ON p.workspace_id = wm.workspace_id
     WHERE wm.user_id = $1 AND p.project_id = $2 AND p.legacy = false
       AND EXISTS (SELECT 1 FROM workspace_members member_check WHERE member_check.user_id = $1 AND member_check.workspace_id = p.workspace_id)
     LIMIT 1`, [userId, projectId],
  );
  return result.rows[0] ?? null;
}

function assertTenant(tableAlias = "") {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  return `${prefix}workspace_id = $1 AND ${prefix}project_id = $2 AND EXISTS (` +
    `SELECT 1 FROM workspace_members research_access ` +
    `WHERE research_access.workspace_id = $1 AND research_access.user_id = $3)`;
}

async function withTenant<T>(tenant: ResearchTenant, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!pool) throw new ResearchStorageUnavailable();
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}

export async function getResearchOverview(tenant: ResearchTenant) {
  return withTenant(tenant, async (client) => {
    const values = [tenant.workspaceId, tenant.projectId, tenant.userId];
    const [workflow, studies, plans, runs, datasets, evidence, claims, documents, gates] = await Promise.all([
      client.query(`SELECT from_stage AS "fromStage", to_stage AS "toStage", stage_detail AS "stageDetail", lifecycle_contract_version AS "lifecycleContractVersion", created_at AS "createdAt" FROM research_workflow_events WHERE ${assertTenant()} ORDER BY created_at ASC`, values),
      client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", stage_detail AS "stageDetail", locked_at AS "lockedAt" FROM research_studies WHERE ${assertTenant()} ORDER BY logical_id, version_number DESC`, values),
      client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", method, engine, engine_version AS "engineVersion", locked_at AS "lockedAt" FROM research_analysis_plans WHERE ${assertTenant()} ORDER BY logical_id, version_number DESC`, values),
      client.query(`SELECT method, result_hash AS "resultHash", engine, engine_version AS "engineVersion", status, created_at AS "createdAt" FROM research_analysis_runs WHERE ${assertTenant()} ORDER BY created_at DESC`, values),
      client.query(`SELECT id, artifact_id AS "artifactId", artifact_path AS "artifactPath", sha256, media_type AS "mediaType", byte_size AS "byteSize", registered_at AS "registeredAt" FROM research_datasets WHERE ${assertTenant()} ORDER BY registered_at DESC`, values),
      client.query(`SELECT id, source_identity_status AS "sourceIdentityStatus", source_version AS "sourceVersion", source_hash AS "sourceHash", verification_method AS "verificationMethod" FROM research_evidence_sources WHERE ${assertTenant()} ORDER BY created_at DESC`, values),
      client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", claim_support_status AS "claimSupportStatus", locked_at AS "lockedAt" FROM research_claims WHERE ${assertTenant()} ORDER BY logical_id, version_number DESC`, values),
      client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", document_type AS "documentType", title, locked_at AS "lockedAt" FROM research_documents WHERE ${assertTenant()} ORDER BY logical_id, version_number DESC`, values),
      client.query(`SELECT id, gate_type AS "gateType", artifact_type AS "artifactType", artifact_version_id AS "artifactVersionId", approved_content_hash AS "approvedContentHash", decision, approved_at AS "approvedAt" FROM research_human_gates WHERE ${assertTenant()} ORDER BY approved_at DESC`, values),
    ]);
    return { lifecycleContractVersion: LIFECYCLE_CONTRACT_VERSION, workflow: workflow.rows, studies: studies.rows, analysisPlans: plans.rows, analysisRuns: runs.rows, datasets: datasets.rows, evidence: evidence.rows, claims: claims.rows, documents: documents.rows, humanGates: gates.rows };
  });
}

export async function transitionResearch(tenant: ResearchTenant, input: { fromStage: string; toStage: string; stageDetail?: string; artifactRefs?: unknown[]; humanGateId?: string }) {
  if (!isWorkflowTransitionAllowed(input.fromStage, input.toStage)) throw new ResearchContractViolation("illegal_workflow_transition");
  const gateRequired = ["S0_RESEARCH_DIRECTION_HUMAN_GATE", "S6_RESULTS_HUMAN_GATE", "S8_RELEASE_HUMAN_GATE", "S9_ARCHIVED"].includes(input.toStage);
  if (gateRequired && !input.humanGateId) throw new ResearchContractViolation("human_gate_required");
  return withTenant(tenant, async (client) => {
    await client.query("BEGIN");
    try {
      if (input.humanGateId) {
        const gate = await client.query(`SELECT id, artifact_version_id AS "artifactVersionId", approved_content_hash AS "approvedContentHash" FROM research_human_gates WHERE id = $3 AND ${assertTenant()} AND decision = 'APPROVED'`, [tenant.workspaceId, tenant.projectId, input.humanGateId]);
        if (!gate.rowCount) throw new ResearchContractViolation("human_gate_required");
        const refs = Array.isArray(input.artifactRefs) ? input.artifactRefs : [];
        const exactBinding = refs.some((reference) => reference && typeof reference === "object" &&
          (reference as Record<string, unknown>).artifactVersionId === gate.rows[0].artifactVersionId &&
          (reference as Record<string, unknown>).contentHash === gate.rows[0].approvedContentHash);
        if (!exactBinding) throw new ResearchContractViolation("human_gate_hash_binding_invalid");
      }
      const event = { fromStage: input.fromStage, toStage: input.toStage, stageDetail: input.stageDetail ?? null, artifactRefs: input.artifactRefs ?? [], humanGateId: input.humanGateId ?? null, lifecycleContractVersion: LIFECYCLE_CONTRACT_VERSION };
      const id = `wfe_${randomUUID()}`; const eventHash = sha256Canonical(event);
      await client.query(`INSERT INTO research_workflow_events (id, workspace_id, project_id, created_by_user_id, from_stage, to_stage, stage_detail, lifecycle_contract_version, artifact_refs, human_gate_id, event_hash) VALUES ($4, $1, $2, $3, $5, $6, $7, $8, $9::jsonb, $10, $11)`, [tenant.workspaceId, tenant.projectId, tenant.userId, id, input.fromStage, input.toStage, input.stageDetail ?? null, LIFECYCLE_CONTRACT_VERSION, JSON.stringify(input.artifactRefs ?? []), input.humanGateId ?? null, eventHash]);
      await client.query("COMMIT");
      return { id, eventHash, ...event };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function createResearchVersion(tenant: ResearchTenant, input: { kind: "study" | "analysisPlan" | "document" | "claim"; logicalId: string; payload: Record<string, unknown>; contentHash: string; userId: string; expectedVersion?: number; method?: string; engine?: string; engineVersion?: string; documentType?: string; claimStatus?: string; sourceIdentityStatus?: string; stageDetail?: string }) {
  if (tenant.userId !== input.userId) throw new ResearchContractViolation("tenant_identity_mismatch");
  const hashPayload = input.kind === "analysisPlan" ? { method: input.method, parameters: input.payload } : input.payload;
  if (sha256Canonical(hashPayload) !== input.contentHash) throw new ResearchContractViolation("content_hash_mismatch");
  return withTenant(tenant, async (client) => {
    await client.query("BEGIN");
    try {
      const table = input.kind === "study" ? "research_studies" : input.kind === "analysisPlan" ? "research_analysis_plans" : input.kind === "document" ? "research_documents" : "research_claims";
      const latest = await client.query<{ versionNumber: number; id: string }>(`SELECT version_number AS "versionNumber", id FROM ${table} WHERE ${assertTenant()} AND logical_id = $3 ORDER BY version_number DESC LIMIT 1 FOR UPDATE`, [tenant.workspaceId, tenant.projectId, input.logicalId]);
      const latestVersion = latest.rows[0]?.versionNumber ?? 0;
      if (input.expectedVersion !== undefined && input.expectedVersion !== latestVersion) throw new ResearchContractViolation("version_conflict");
      const versionNumber = latestVersion + 1;
      const id = `${input.kind}_${randomUUID()}`;
      if (input.kind === "study") await client.query(`INSERT INTO research_studies (id, logical_id, version_number, supersedes_version_id, workspace_id, project_id, created_by_user_id, content_hash, stage_detail, design_payload) VALUES ($4,$5,$6,$7,$1,$2,$3,$8,$9,$10::jsonb)`, [tenant.workspaceId, tenant.projectId, tenant.userId, id, input.logicalId, versionNumber, latest.rows[0]?.id ?? null, input.contentHash, input.stageDetail ?? "S1_DESIGN_DRAFT", JSON.stringify(input.payload)]);
    if (input.kind === "analysisPlan") await client.query(`INSERT INTO research_analysis_plans (id, logical_id, version_number, supersedes_version_id, workspace_id, project_id, created_by_user_id, method, parameters, content_hash, engine, engine_version) VALUES ($4,$5,$6,$7,$1,$2,$3,$8,$9::jsonb,$10,$11,$12)`, [tenant.workspaceId, tenant.projectId, tenant.userId, id, input.logicalId, versionNumber, latest.rows[0]?.id ?? null, input.method, JSON.stringify(input.payload), input.contentHash, input.engine ?? ANALYSIS_ENGINE, input.engineVersion ?? ANALYSIS_ENGINE_VERSION]);
      if (input.kind === "document") await client.query(`INSERT INTO research_documents (id, logical_id, version_number, supersedes_version_id, workspace_id, project_id, created_by_user_id, document_type, title, body, content_hash, stage_detail) VALUES ($4,$5,$6,$7,$1,$2,$3,$8,$9,$10,$11,$12)`, [tenant.workspaceId, tenant.projectId, tenant.userId, id, input.logicalId, versionNumber, latest.rows[0]?.id ?? null, input.documentType ?? "MANUSCRIPT", String(input.payload.title ?? ""), String(input.payload.body ?? ""), input.contentHash, input.stageDetail ?? "S7_DOCUMENT_DRAFT"]);
      if (input.kind === "claim") await client.query(`INSERT INTO research_claims (id, logical_id, version_number, supersedes_version_id, workspace_id, project_id, created_by_user_id, claim_text, content_hash, source_identity_status, claim_support_status) VALUES ($4,$5,$6,$7,$1,$2,$3,$8,$9,$10,$11)`, [tenant.workspaceId, tenant.projectId, tenant.userId, id, input.logicalId, versionNumber, latest.rows[0]?.id ?? null, String(input.payload.claimText ?? ""), input.contentHash, input.sourceIdentityStatus ?? "UNVERIFIED", input.claimStatus ?? "AI_PROPOSED"]);
      await client.query("COMMIT");
      return { id, versionNumber, supersedesVersionId: latest.rows[0]?.id ?? null, contentHash: input.contentHash };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function registerDataset(tenant: ResearchTenant, input: { artifactId: string; artifactPath: string; sha256: string; mediaType: string; byteSize: number; schemaSummary: unknown }) {
  return withTenant(tenant, async (client) => {
    const result = await client.query(`INSERT INTO research_datasets (id, workspace_id, project_id, created_by_user_id, artifact_id, artifact_path, sha256, media_type, byte_size, schema_summary) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10::jsonb) RETURNING id, artifact_id AS "artifactId", sha256`, [tenant.workspaceId, tenant.projectId, tenant.userId, `dataset_${randomUUID()}`, input.artifactId, input.artifactPath, input.sha256, input.mediaType, input.byteSize, JSON.stringify(input.schemaSummary)]);
    return result.rows[0];
  });
}

export async function runAnalysis(tenant: ResearchTenant, input: DeterministicAnalysisInput & { datasetId: string; analysisPlanId: string; idempotencyKey: string }) {
  return withTenant(tenant, async (client) => {
    await client.query("BEGIN");
    try {
      const existing = await client.query(`SELECT method, provenance, result_payload AS "resultPayload", result_hash AS "resultHash", input_hash AS "inputHash", engine, engine_version AS "engineVersion" FROM research_analysis_runs WHERE workspace_id = $1 AND project_id = $2 AND created_by_user_id = $3 AND idempotency_key = $4`, [tenant.workspaceId, tenant.projectId, tenant.userId, input.idempotencyKey]);
      if (existing.rowCount) {
        const row = existing.rows[0];
        await client.query("COMMIT");
        return { method: row.method, parameters: row.provenance.parameters, payload: row.resultPayload, resultHash: row.resultHash, inputHash: row.inputHash, engine: row.engine, engineVersion: row.engineVersion };
      }
      const dataset = await client.query(`SELECT sha256 FROM research_datasets WHERE id = $3 AND ${assertTenant()}`, [tenant.workspaceId, tenant.projectId, input.datasetId]);
      const plan = await client.query(`SELECT content_hash AS "contentHash", method, parameters, engine, engine_version AS "engineVersion", locked_at AS "lockedAt" FROM research_analysis_plans WHERE id = $3 AND ${assertTenant()}`, [tenant.workspaceId, tenant.projectId, input.analysisPlanId]);
      const normalizedInput = normalizeAnalysisParameters(input.method, input.parameters ?? {});
      const normalizedPlan = plan.rowCount ? normalizeAnalysisParameters(plan.rows[0].method, plan.rows[0].parameters) : null;
      const planHash = normalizedPlan ? sha256Canonical({ method: plan.rows[0].method, parameters: normalizedPlan }) : "";
      if (!dataset.rowCount || !plan.rowCount || dataset.rows[0].sha256 !== input.datasetSha256 || plan.rows[0].contentHash !== input.analysisPlanHash || planHash !== plan.rows[0].contentHash || sha256Canonical(normalizedInput) !== sha256Canonical(normalizedPlan) || plan.rows[0].method !== input.method || plan.rows[0].engine !== ANALYSIS_ENGINE || plan.rows[0].engineVersion !== ANALYSIS_ENGINE_VERSION || !plan.rows[0].lockedAt) throw new ResearchContractViolation("analysis_input_binding_failed");
      const result = runDeterministicAnalysis(input);
      const inserted = await client.query(`INSERT INTO research_analysis_runs (id, workspace_id, project_id, created_by_user_id, dataset_id, analysis_plan_id, idempotency_key, input_hash, method, engine, engine_version, result_hash, result_payload, provenance, status) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,'COMPLETED') ON CONFLICT (workspace_id, project_id, idempotency_key) DO NOTHING RETURNING method, provenance, result_payload AS "resultPayload", result_hash AS "resultHash", input_hash AS "inputHash", engine, engine_version AS "engineVersion"`, [tenant.workspaceId, tenant.projectId, tenant.userId, `analysis_run_${randomUUID()}`, input.datasetId, input.analysisPlanId, input.idempotencyKey, result.inputHash, result.method, result.engine, result.engineVersion, result.resultHash, JSON.stringify(result.payload), JSON.stringify({ parameters: result.parameters, datasetSha256: input.datasetSha256, analysisPlanHash: input.analysisPlanHash })]);
      if (!inserted.rowCount) {
        const concurrent = await client.query(`SELECT method, provenance, result_payload AS "resultPayload", result_hash AS "resultHash", input_hash AS "inputHash", engine, engine_version AS "engineVersion" FROM research_analysis_runs WHERE workspace_id = $1 AND project_id = $2 AND created_by_user_id = $3 AND idempotency_key = $4`, [tenant.workspaceId, tenant.projectId, tenant.userId, input.idempotencyKey]);
        if (!concurrent.rowCount) throw new ResearchContractViolation("analysis_idempotency_retry_failed");
        const row = concurrent.rows[0];
        await client.query("COMMIT");
        return { method: row.method, parameters: row.provenance.parameters, payload: row.resultPayload, resultHash: row.resultHash, inputHash: row.inputHash, engine: row.engine, engineVersion: row.engineVersion };
      }
      await client.query("COMMIT");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function lockResearchVersion(tenant: ResearchTenant, input: { kind: "study" | "analysisPlan" | "document" | "claim"; id: string; contentHash: string }) {
  const table = input.kind === "study" ? "research_studies" : input.kind === "analysisPlan" ? "research_analysis_plans" : input.kind === "document" ? "research_documents" : "research_claims";
  return withTenant(tenant, async (client) => {
    const result = await client.query(`SELECT id, content_hash AS "contentHash", locked_at AS "lockedAt" FROM ${table} WHERE id = $3 AND ${assertTenant()}`, [tenant.workspaceId, tenant.projectId, input.id]);
    const row = result.rows[0];
    if (!row || row.contentHash !== input.contentHash) throw new ResearchContractViolation("version_not_found_or_hash_mismatch");
    if (row.lockedAt) return { id: row.id, locked: true };
    await client.query(`UPDATE ${table} SET locked_at = now(), locked_by_user_id = $3 WHERE id = $4 AND ${assertTenant()} AND content_hash = $5 AND locked_at IS NULL`, [tenant.workspaceId, tenant.projectId, tenant.userId, input.id, input.contentHash]);
    return { id: input.id, locked: true };
  });
}

export async function registerEvidence(tenant: ResearchTenant, input: { sourceIdentity: string; sourceVersion: string; sourceHash: string; verificationMethod: string; retrievedAt: string; excerpt: string; locator: string; verificationActor: string; identityStatus: "UNVERIFIED" | "VERIFIED" | "REJECTED" }) {
  return withTenant(tenant, async (client) => {
    const result = await client.query(`INSERT INTO research_evidence_sources (id, workspace_id, project_id, created_by_user_id, source_identity_status, source_identity, source_version, source_hash, verification_method, retrieved_at, excerpt, page_section_locator, verification_actor) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, source_identity_status AS "sourceIdentityStatus"`, [tenant.workspaceId, tenant.projectId, tenant.userId, `evidence_${randomUUID()}`, input.identityStatus, input.sourceIdentity, input.sourceVersion, input.sourceHash, input.verificationMethod, input.retrievedAt, input.excerpt, input.locator, input.verificationActor]);
    return result.rows[0];
  });
}

export async function attachClaimEvidence(tenant: ResearchTenant, input: { claimVersionId: string; evidenceSourceId: string; supportStatus: "UNVERIFIED" | "AI_PROPOSED" | "SUPPORTED" | "UNSUPPORTED" }) {
  return withTenant(tenant, async (client) => {
    const result = await client.query(`INSERT INTO research_claim_evidence (id, workspace_id, project_id, created_by_user_id, claim_version_id, evidence_source_id, support_status) SELECT $4,$1,$2,$3,c.id,e.id,$5 FROM research_claims c JOIN research_evidence_sources e ON e.id = $6 WHERE c.id = $7 AND e.id = $6 AND ${assertTenant("c")} AND e.workspace_id = $1 AND e.project_id = $2 RETURNING id, support_status AS "supportStatus"`, [tenant.workspaceId, tenant.projectId, tenant.userId, `claim_evidence_${randomUUID()}`, input.supportStatus, input.evidenceSourceId, input.claimVersionId]);
    if (!result.rowCount) throw new ResearchContractViolation("claim_or_evidence_not_found");
    return result.rows[0];
  });
}

export async function createHumanGate(tenant: ResearchTenant, input: { gateType: "EVIDENCE_VERIFICATION" | "CLAIM_SUPPORT" | "RESULTS_RELEASE" | "DOCUMENT_RELEASE" | "ARCHIVE_RELEASE"; artifactType: string; artifactVersionId: string; approvedContentHash: string; decision: "APPROVED" | "REJECTED" | "REVOKED"; rationale?: string }) {
  return withTenant(tenant, async (client) => {
    const artifactTable = input.artifactType === "study" ? "research_studies" : input.artifactType === "analysisPlan" ? "research_analysis_plans" : input.artifactType === "document" ? "research_documents" : input.artifactType === "claim" ? "research_claims" : input.artifactType === "evidence" ? "research_evidence_sources" : null;
    if (!artifactTable) throw new ResearchContractViolation("unsupported_gate_artifact");
    if (input.gateType === "EVIDENCE_VERIFICATION" && input.artifactType !== "evidence") throw new ResearchContractViolation("gate_artifact_type_mismatch");
    if (input.gateType === "CLAIM_SUPPORT" && input.artifactType !== "claim") throw new ResearchContractViolation("gate_artifact_type_mismatch");
    const hashColumn = artifactTable === "research_evidence_sources" ? "source_hash" : "content_hash";
    const lockColumn = artifactTable === "research_evidence_sources" ? "NULL::timestamptz" : "locked_at";
    const artifact = await client.query(`SELECT id, ${lockColumn} AS "lockedAt" FROM ${artifactTable} WHERE id = $3 AND ${assertTenant()} AND ${hashColumn} = $4`, [tenant.workspaceId, tenant.projectId, input.artifactVersionId, input.approvedContentHash]);
    if (!artifact.rowCount) throw new ResearchContractViolation("human_gate_hash_mismatch");
    if (input.decision === "APPROVED" && input.artifactType !== "evidence" && !artifact.rows[0].lockedAt) throw new ResearchContractViolation("human_gate_requires_locked_artifact");
    const result = await client.query(`INSERT INTO research_human_gates (id, workspace_id, project_id, created_by_user_id, gate_type, artifact_type, artifact_version_id, approved_content_hash, decision, approver_user_id, approved_at, rationale) VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$3,now(),$10) RETURNING id, decision, approved_at AS "approvedAt"`, [tenant.workspaceId, tenant.projectId, tenant.userId, `gate_${randomUUID()}`, input.gateType, input.artifactType, input.artifactVersionId, input.approvedContentHash, input.decision, input.rationale ?? null]);
    return result.rows[0];
  });
}

export async function verifyEvidence(tenant: ResearchTenant, input: { evidenceSourceId: string; humanGateId: string }) {
  return withTenant(tenant, async (client) => {
    await client.query("BEGIN");
    try {
      const source = await client.query(`SELECT source_identity, source_version, source_hash, verification_method, retrieved_at, excerpt, page_section_locator FROM research_evidence_sources WHERE id = $3 AND ${assertTenant()} AND source_identity_status = 'UNVERIFIED'`, [tenant.workspaceId, tenant.projectId, input.evidenceSourceId]);
      if (!source.rowCount) throw new ResearchContractViolation("evidence_not_found_or_already_reviewed");
      const gate = await client.query(`SELECT 1 FROM research_human_gates WHERE id = $3 AND ${assertTenant()} AND gate_type = 'EVIDENCE_VERIFICATION' AND artifact_type = 'evidence' AND artifact_version_id = $4 AND approved_content_hash = $5 AND decision = 'APPROVED'`, [tenant.workspaceId, tenant.projectId, input.humanGateId, input.evidenceSourceId, source.rows[0].source_hash]);
      if (!gate.rowCount) throw new ResearchContractViolation("evidence_verification_gate_required");
      const id = `evidence_${randomUUID()}`;
      await client.query(`INSERT INTO research_evidence_sources (id, workspace_id, project_id, created_by_user_id, source_identity_status, source_identity, source_version, source_hash, verification_method, retrieved_at, excerpt, page_section_locator, verification_actor) VALUES ($4,$1,$2,$3,'VERIFIED',$5,$6,$7,$8,$9,$10,$11,$3)`, [tenant.workspaceId, tenant.projectId, tenant.userId, id, source.rows[0].source_identity, source.rows[0].source_version, source.rows[0].source_hash, source.rows[0].verification_method, source.rows[0].retrieved_at, source.rows[0].excerpt, source.rows[0].page_section_locator]);
      await client.query("COMMIT");
      return { id, sourceIdentityStatus: "VERIFIED" as const };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function supportClaim(tenant: ResearchTenant, input: { claimVersionId: string; evidenceSourceId: string; humanGateId: string }) {
  return withTenant(tenant, async (client) => {
    await client.query("BEGIN");
    try {
      const prior = await client.query(`SELECT id FROM research_claims WHERE supersedes_version_id = $3 AND ${assertTenant()} AND claim_support_status = 'SUPPORTED'`, [tenant.workspaceId, tenant.projectId, input.claimVersionId]);
      if (prior.rowCount) { await client.query("COMMIT"); return { id: prior.rows[0].id, claimSupportStatus: "SUPPORTED" as const }; }
      const claim = await client.query(`SELECT logical_id, version_number, claim_text, content_hash, locked_at FROM research_claims WHERE id = $3 AND ${assertTenant()}`, [tenant.workspaceId, tenant.projectId, input.claimVersionId]);
      const evidence = await client.query(`SELECT id FROM research_evidence_sources WHERE id = $3 AND ${assertTenant()} AND source_identity_status = 'VERIFIED'`, [tenant.workspaceId, tenant.projectId, input.evidenceSourceId]);
      if (!claim.rowCount || !claim.rows[0].locked_at || !evidence.rowCount) throw new ResearchContractViolation("claim_support_binding_invalid");
      const gate = await client.query(`SELECT 1 FROM research_human_gates WHERE id = $3 AND ${assertTenant()} AND gate_type = 'CLAIM_SUPPORT' AND artifact_type = 'claim' AND artifact_version_id = $4 AND approved_content_hash = $5 AND decision = 'APPROVED'`, [tenant.workspaceId, tenant.projectId, input.humanGateId, input.claimVersionId, claim.rows[0].content_hash]);
      if (!gate.rowCount) throw new ResearchContractViolation("claim_support_gate_required");
      const id = `claim_${randomUUID()}`;
      await client.query(`INSERT INTO research_claims (id,logical_id,version_number,supersedes_version_id,workspace_id,project_id,created_by_user_id,claim_text,content_hash,source_identity_status,claim_support_status,locked_at,locked_by_user_id) VALUES ($4,$5,$6,$7,$1,$2,$3,$8,$9,'VERIFIED','SUPPORTED',now(),$3)`, [tenant.workspaceId, tenant.projectId, tenant.userId, id, claim.rows[0].logical_id, Number(claim.rows[0].version_number) + 1, input.claimVersionId, claim.rows[0].claim_text, claim.rows[0].content_hash]);
      await client.query(`INSERT INTO research_claim_evidence (id,workspace_id,project_id,created_by_user_id,claim_version_id,evidence_source_id,support_status) VALUES ($4,$1,$2,$3,$5,$6,'SUPPORTED')`, [tenant.workspaceId, tenant.projectId, tenant.userId, `claim_evidence_${randomUUID()}`, id, input.evidenceSourceId]);
      await client.query("COMMIT");
      return { id, claimSupportStatus: "SUPPORTED" as const };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function assertClaimPublishable(tenant: ResearchTenant, claimVersionId: string) {
  return withTenant(tenant, async (client) => {
    const claim = await client.query(`SELECT content_hash AS "contentHash", claim_support_status AS "claimSupportStatus" FROM research_claims WHERE id = $3 AND ${assertTenant()}`, [tenant.workspaceId, tenant.projectId, claimVersionId]);
    const evidence = await client.query(`SELECT 1 FROM research_claim_evidence WHERE claim_version_id = $3 AND ${assertTenant()} AND support_status = 'SUPPORTED' LIMIT 1`, [tenant.workspaceId, tenant.projectId, claimVersionId]);
    const gate = claim.rowCount ? await client.query(`SELECT 1 FROM research_human_gates WHERE artifact_type = 'claim' AND artifact_version_id = $3 AND approved_content_hash = $4 AND ${assertTenant()} AND decision = 'APPROVED' LIMIT 1`, [tenant.workspaceId, tenant.projectId, claimVersionId, claim.rows[0].contentHash]) : { rowCount: 0 };
    if (!claim.rowCount || claim.rows[0].claimSupportStatus !== "SUPPORTED" || !evidence.rowCount || !gate.rowCount) throw new ResearchContractViolation("claim_publish_requires_supported_evidence_and_gate");
    return { claimVersionId, publishable: true };
  });
}

export async function exportResearchArchive(tenant: ResearchTenant) {
  return withTenant(tenant, async (client) => {
    const values = [tenant.workspaceId, tenant.projectId, tenant.userId];
    const [studies, plans, runs, datasets, claims, evidence, gates, events, documents] = await Promise.all([
      client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash" FROM research_studies WHERE ${assertTenant()} ORDER BY logical_id, version_number`, values),
      client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", method, engine, engine_version AS "engineVersion" FROM research_analysis_plans WHERE ${assertTenant()} ORDER BY logical_id, version_number`, values),
      client.query(`SELECT method, input_hash AS "inputHash", result_hash AS "resultHash", result_payload AS "resultPayload", provenance, engine, engine_version AS "engineVersion", status FROM research_analysis_runs WHERE ${assertTenant()} ORDER BY created_at, id`, values),
      client.query(`SELECT id, artifact_id AS "artifactId", artifact_path AS "artifactPath", sha256, media_type AS "mediaType", byte_size AS "byteSize", schema_summary AS "schemaSummary", registered_at AS "registeredAt" FROM research_datasets WHERE ${assertTenant()} ORDER BY id`, values),
      client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", claim_support_status AS "claimSupportStatus" FROM research_claims WHERE ${assertTenant()} ORDER BY logical_id, version_number`, values),
      client.query(`SELECT id, source_identity AS "sourceIdentity", source_identity_status AS "sourceIdentityStatus", source_version AS "sourceVersion", source_hash AS "sourceHash", verification_method AS "verificationMethod", retrieved_at AS "retrievedAt", excerpt, page_section_locator AS "locator", verification_actor AS "verificationActor" FROM research_evidence_sources WHERE ${assertTenant()} ORDER BY id`, values),
      client.query(`SELECT gate_type AS "gateType", artifact_type AS "artifactType", artifact_version_id AS "artifactVersionId", approved_content_hash AS "approvedContentHash", decision, approved_at AS "approvedAt", rationale FROM research_human_gates WHERE ${assertTenant()} ORDER BY approved_at, id`, values),
      client.query(`SELECT from_stage AS "fromStage", to_stage AS "toStage", stage_detail AS "stageDetail", event_hash AS "eventHash", created_at AS "createdAt" FROM research_workflow_events WHERE ${assertTenant()} ORDER BY created_at, id`, values),
      client.query(`SELECT id, logical_id AS "logicalId", version_number AS "versionNumber", content_hash AS "contentHash", document_type AS "documentType" FROM research_documents WHERE ${assertTenant()} ORDER BY logical_id, version_number`, values),
    ]);
    const evidenceReferences = evidence.rows.map(({ verificationActor, sourceIdentity, excerpt, ...row }) => ({
      ...row,
      sourceIdentityCommitment: createHash("sha256").update(`old-mike-archive-source:${sourceIdentity}`, "utf8").digest("hex"),
      excerptCommitment: createHash("sha256").update(`old-mike-archive-excerpt:${excerpt}`, "utf8").digest("hex"),
      verificationActorCommitment: createHash("sha256").update(`old-mike-archive-actor:${verificationActor}`, "utf8").digest("hex"),
    }));
  return { schemaVersion: "1.5.6", workspaceId: tenant.workspaceId, projectId: tenant.projectId, studies: studies.rows, analysisPlans: plans.rows, analysisRuns: runs.rows, datasets: datasets.rows, claims: claims.rows, evidenceReferences, humanGates: gates.rows, workflowEvents: events.rows, documents: documents.rows };
  });
}
