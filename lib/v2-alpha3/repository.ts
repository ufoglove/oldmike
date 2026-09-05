import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

import {
  canonicalJson,
  createCustomDomainSelection,
  parseDomainSelection,
  sha256Canonical,
  validateCustomProfileContent,
  type V2Alpha3DomainSelection,
  type V2Alpha3InsightCard,
} from "./contracts.ts";

export type V2Alpha3Principal = { workspaceId: string; userId: string; projectId?: string | null };
type ProfileRow = { profileId: string; version: number; lifecycleState: "ACTIVE" | "ARCHIVED"; name: string; normalizedName: string; includedKeywords: string[]; excludedKeywords: string[]; contentHash: string };

export class V2Alpha3RepositoryError extends Error {
  readonly code: "TENANT_REJECTED" | "PROFILE_CONFLICT" | "PROFILE_NOT_FOUND" | "VERSION_CONFLICT" | "IDEMPOTENCY_CONFLICT" | "BINDING_CONFLICT" | "STORAGE_UNAVAILABLE";
  constructor(code: V2Alpha3RepositoryError["code"]) { super(code); this.name = "V2Alpha3RepositoryError"; this.code = code; }
}

function opaque(prefix: "dp" | "vc") { return `${prefix}_${randomUUID().replaceAll("-", "")}`; }
function payloadBytes(payload: Record<string, unknown>) {
  const encoded = canonicalJson(payload);
  const bytes = Buffer.byteLength(encoded, "utf8");
  if (bytes < 2 || bytes > 24_576) throw new Error("alpha3_payload_too_large");
  return { encoded, bytes };
}

export class V2Alpha3PostgresRepository {
  readonly databasePool: Pool;
  readonly principal: V2Alpha3Principal;

  constructor(databasePool: Pool, principal: V2Alpha3Principal) {
    this.databasePool = databasePool;
    this.principal = principal;
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>) {
    const client = await this.databasePool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  private async assertAuthority(client: PoolClient) {
    const membership = await client.query("SELECT 1 FROM workspace_members WHERE workspace_id=$1 AND user_id=$2", [this.principal.workspaceId, this.principal.userId]);
    if (membership.rowCount !== 1) throw new V2Alpha3RepositoryError("TENANT_REJECTED");
    if (this.principal.projectId) {
      const project = await client.query("SELECT 1 FROM projects WHERE workspace_id=$1 AND project_id=$2", [this.principal.workspaceId, this.principal.projectId]);
      if (project.rowCount !== 1) throw new V2Alpha3RepositoryError("TENANT_REJECTED");
    }
  }

  private async lockProfileNamespace(client: PoolClient) {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`alpha3-domain:${this.principal.workspaceId}:${this.principal.userId}`]);
  }

  private async latestProfiles(client: PoolClient) {
    return client.query<ProfileRow>(
      `SELECT DISTINCT ON (profile_id) profile_id AS "profileId",version,lifecycle_state AS "lifecycleState",name,normalized_name AS "normalizedName",included_keywords AS "includedKeywords",excluded_keywords AS "excludedKeywords",content_hash AS "contentHash"
       FROM research_domain_profiles WHERE workspace_id=$1 AND created_by_user_id=$2 ORDER BY profile_id,version DESC`,
      [this.principal.workspaceId, this.principal.userId],
    );
  }

  async createProfile(input: { name: string; includedKeywords?: string[]; excludedKeywords?: string[] }) {
    const content = validateCustomProfileContent(input);
    return this.transaction(async (client) => {
      await this.assertAuthority(client); await this.lockProfileNamespace(client);
      const latest = await this.latestProfiles(client);
      if (latest.rows.some((row) => row.lifecycleState === "ACTIVE" && row.normalizedName === content.normalizedName)) throw new V2Alpha3RepositoryError("PROFILE_CONFLICT");
      const profileId = opaque("dp");
      await client.query(
        `INSERT INTO research_domain_profiles(workspace_id,created_by_user_id,profile_id,version,lifecycle_state,name,normalized_name,included_keywords,excluded_keywords,content_hash,supersedes_version)
         VALUES($1,$2,$3,1,'ACTIVE',$4,$5,$6,$7,$8,NULL)`,
        [this.principal.workspaceId, this.principal.userId, profileId, content.name, content.normalizedName, content.includedKeywords, content.excludedKeywords, content.contentHash],
      );
      return createCustomDomainSelection({ profileId, version: 1, name: content.name, contentHash: content.contentHash });
    });
  }

  async reviseProfile(input: { profileId: string; expectedVersion: number; name: string; includedKeywords?: string[]; excludedKeywords?: string[] }) {
    const content = validateCustomProfileContent(input);
    return this.transaction(async (client) => {
      await this.assertAuthority(client); await this.lockProfileNamespace(client);
      const current = await client.query<ProfileRow>(
        `SELECT profile_id AS "profileId",version,lifecycle_state AS "lifecycleState",name,normalized_name AS "normalizedName",included_keywords AS "includedKeywords",excluded_keywords AS "excludedKeywords",content_hash AS "contentHash"
         FROM research_domain_profiles WHERE workspace_id=$1 AND created_by_user_id=$2 AND profile_id=$3 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
        [this.principal.workspaceId, this.principal.userId, input.profileId],
      );
      if (!current.rows[0]) throw new V2Alpha3RepositoryError("PROFILE_NOT_FOUND");
      if (current.rows[0].version !== input.expectedVersion || current.rows[0].lifecycleState !== "ACTIVE") throw new V2Alpha3RepositoryError("VERSION_CONFLICT");
      const latest = await this.latestProfiles(client);
      if (latest.rows.some((row) => row.profileId !== input.profileId && row.lifecycleState === "ACTIVE" && row.normalizedName === content.normalizedName)) throw new V2Alpha3RepositoryError("PROFILE_CONFLICT");
      const version = input.expectedVersion + 1;
      await client.query(
        `INSERT INTO research_domain_profiles(workspace_id,created_by_user_id,profile_id,version,lifecycle_state,name,normalized_name,included_keywords,excluded_keywords,content_hash,supersedes_version)
         VALUES($1,$2,$3,$4,'ACTIVE',$5,$6,$7,$8,$9,$10)`,
        [this.principal.workspaceId, this.principal.userId, input.profileId, version, content.name, content.normalizedName, content.includedKeywords, content.excludedKeywords, content.contentHash, input.expectedVersion],
      );
      return createCustomDomainSelection({ profileId: input.profileId, version, name: content.name, contentHash: content.contentHash });
    });
  }

  async archiveProfile(input: { profileId: string; expectedVersion: number }) {
    return this.transaction(async (client) => {
      await this.assertAuthority(client); await this.lockProfileNamespace(client);
      const current = await client.query<ProfileRow>(
        `SELECT profile_id AS "profileId",version,lifecycle_state AS "lifecycleState",name,normalized_name AS "normalizedName",included_keywords AS "includedKeywords",excluded_keywords AS "excludedKeywords",content_hash AS "contentHash"
         FROM research_domain_profiles WHERE workspace_id=$1 AND created_by_user_id=$2 AND profile_id=$3 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
        [this.principal.workspaceId, this.principal.userId, input.profileId],
      );
      const row = current.rows[0];
      if (!row) throw new V2Alpha3RepositoryError("PROFILE_NOT_FOUND");
      if (row.version !== input.expectedVersion || row.lifecycleState !== "ACTIVE") throw new V2Alpha3RepositoryError("VERSION_CONFLICT");
      const version = row.version + 1;
      const contentHash = sha256Canonical({ name: row.name, normalizedName: row.normalizedName, includedKeywords: row.includedKeywords, excludedKeywords: row.excludedKeywords, lifecycleState: "ARCHIVED", version });
      await client.query(
        `INSERT INTO research_domain_profiles(workspace_id,created_by_user_id,profile_id,version,lifecycle_state,name,normalized_name,included_keywords,excluded_keywords,content_hash,supersedes_version)
         VALUES($1,$2,$3,$4,'ARCHIVED',$5,$6,$7,$8,$9,$10)`,
        [this.principal.workspaceId, this.principal.userId, row.profileId, version, row.name, row.normalizedName, row.includedKeywords, row.excludedKeywords, contentHash, row.version],
      );
      return { profileId: row.profileId, version, lifecycleState: "ARCHIVED" as const, contentHash };
    });
  }

  async listProfileHistory() {
    const rows = await this.databasePool.query<ProfileRow>(
      `SELECT profile_id AS "profileId",version,lifecycle_state AS "lifecycleState",name,normalized_name AS "normalizedName",included_keywords AS "includedKeywords",excluded_keywords AS "excludedKeywords",content_hash AS "contentHash"
       FROM research_domain_profiles WHERE workspace_id=$1 AND created_by_user_id=$2 ORDER BY profile_id,version`,
      [this.principal.workspaceId, this.principal.userId],
    );
    return rows.rows;
  }

  async resolveDomainSelection(selection: V2Alpha3DomainSelection) {
    const parsed = parseDomainSelection(selection);
    if (parsed.kind === "BUILTIN") return parsed;
    const result = await this.databasePool.query<{ name: string; contentHash: string }>(
      `SELECT name,content_hash AS "contentHash" FROM research_domain_profiles WHERE workspace_id=$1 AND created_by_user_id=$2 AND profile_id=$3 AND version=$4`,
      [this.principal.workspaceId, this.principal.userId, parsed.profileId, parsed.profileVersion],
    );
    if (!result.rows[0] || result.rows[0].contentHash !== parsed.profileContentHash || result.rows[0].name !== parsed.label) throw new V2Alpha3RepositoryError("PROFILE_NOT_FOUND");
    return parsed;
  }

  async appendConversationEvent(input: { conversationRef?: string; eventNo: number; requestId: string; eventKind: "USER_MESSAGE" | "OLD_MIKE_INSIGHTS" | "PROMOTION_REQUEST" | "PROJECT_IMPORT_CONFIRMED"; domainSelection: V2Alpha3DomainSelection; payload: Record<string, unknown>; effectJobId?: string | null }) {
    const domain = await this.resolveDomainSelection(input.domainSelection);
    const payload = payloadBytes(input.payload);
    const requestHash = sha256Canonical({ eventKind: input.eventKind, domainSelectionHash: domain.selectionHash, payload: input.payload, effectJobId: input.effectJobId ?? null });
    return this.transaction(async (client) => {
      await this.assertAuthority(client);
      const prior = await client.query<{ id: string; requestHash: string; conversationRef: string }>("SELECT id::text,request_hash AS \"requestHash\",conversation_ref AS \"conversationRef\" FROM research_conversation_events WHERE workspace_id=$1 AND created_by_user_id=$2 AND request_id=$3 FOR UPDATE", [this.principal.workspaceId, this.principal.userId, input.requestId]);
      if (prior.rows[0]) {
        if (prior.rows[0].requestHash !== requestHash) throw new V2Alpha3RepositoryError("IDEMPOTENCY_CONFLICT");
        return { eventId: prior.rows[0].id, conversationRef: prior.rows[0].conversationRef, replayed: true };
      }
      const conversationRef = input.conversationRef ?? opaque("vc");
      const result = await client.query<{ id: string }>(
        `INSERT INTO research_conversation_events(workspace_id,created_by_user_id,conversation_ref,event_no,request_id,request_hash,event_kind,domain_kind,domain_id,domain_profile_id,domain_profile_version,domain_profile_content_hash,domain_selection_hash,payload,payload_hash,effect_job_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16) RETURNING id::text`,
        [this.principal.workspaceId, this.principal.userId, conversationRef, input.eventNo, input.requestId, requestHash, input.eventKind, domain.kind, domain.kind === "BUILTIN" ? domain.domainId : null, domain.kind === "CUSTOM" ? domain.profileId : null, domain.kind === "CUSTOM" ? domain.profileVersion : null, domain.kind === "CUSTOM" ? domain.profileContentHash : null, domain.selectionHash, payload.encoded, sha256Canonical(input.payload), input.effectJobId ?? null],
      );
      return { eventId: result.rows[0].id, conversationRef, replayed: false };
    });
  }

  async bindGenerationInput(input: { jobId: string; inputNo: number; inputKind: "DOMAIN_SELECTION" | "CHAT_INSIGHT" | "CONNECTOR_RESULT" | "SYNTHESIS_INPUT"; domainSelection: V2Alpha3DomainSelection; insightCard?: V2Alpha3InsightCard | null; payload: Record<string, unknown>; source?: { jobId: string; resultId: string; selectedItemHash: string } | null }) {
    const domain = await this.resolveDomainSelection(input.domainSelection);
    const payload = payloadBytes(input.payload);
    const inputHash = sha256Canonical({ inputKind: input.inputKind, domainSelectionHash: domain.selectionHash, insightCardHash: input.insightCard?.hash ?? null, payload: input.payload, source: input.source ?? null });
    return this.transaction(async (client) => {
      await this.assertAuthority(client);
      const job = await client.query("SELECT 1 FROM research_generation_jobs WHERE workspace_id=$1 AND created_by_user_id=$2 AND id=$3", [this.principal.workspaceId, this.principal.userId, input.jobId]);
      if (job.rowCount !== 1) throw new V2Alpha3RepositoryError("BINDING_CONFLICT");
      const inserted = await client.query(
        `INSERT INTO research_generation_job_inputs(workspace_id,created_by_user_id,job_id,input_no,input_kind,domain_selection_hash,insight_card_hash,source_workspace_id,source_created_by_user_id,source_job_id,source_result_id,source_selected_item_hash,input_payload,input_hash)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14) ON CONFLICT (workspace_id,created_by_user_id,job_id,input_hash) DO NOTHING`,
        [this.principal.workspaceId, this.principal.userId, input.jobId, input.inputNo, input.inputKind, domain.selectionHash, input.insightCard?.hash ?? null, input.source ? this.principal.workspaceId : null, input.source ? this.principal.userId : null, input.source?.jobId ?? null, input.source?.resultId ?? null, input.source?.selectedItemHash ?? null, payload.encoded, inputHash],
      );
      if (inserted.rowCount !== 1) {
        const prior = await client.query("SELECT 1 FROM research_generation_job_inputs WHERE workspace_id=$1 AND created_by_user_id=$2 AND job_id=$3 AND input_hash=$4", [this.principal.workspaceId, this.principal.userId, input.jobId, inputHash]);
        if (prior.rowCount !== 1) throw new V2Alpha3RepositoryError("BINDING_CONFLICT");
      }
      return { inputHash, replayed: inserted.rowCount === 0 };
    });
  }

  async getGenerationInputBindings(jobId: string) {
    const rows = await this.databasePool.query<{ inputKind: string; domainSelectionHash: string; insightCardHash: string | null; inputPayload: Record<string, unknown>; inputHash: string }>(
      `SELECT input_kind AS "inputKind",domain_selection_hash AS "domainSelectionHash",insight_card_hash AS "insightCardHash",input_payload AS "inputPayload",input_hash AS "inputHash"
       FROM research_generation_job_inputs WHERE workspace_id=$1 AND created_by_user_id=$2 AND job_id=$3 ORDER BY input_no`,
      [this.principal.workspaceId, this.principal.userId, jobId],
    );
    return rows.rows;
  }
}

let sharedPool: Pool | null = null;
export function createV2Alpha3Repository(principal: V2Alpha3Principal) {
  if (!process.env.DATABASE_URL) throw new V2Alpha3RepositoryError("STORAGE_UNAVAILABLE");
  sharedPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return new V2Alpha3PostgresRepository(sharedPool, principal);
}

export async function closeV2Alpha3RepositoryForDisposableTest() {
  if (process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") throw new V2Alpha3RepositoryError("STORAGE_UNAVAILABLE");
  await sharedPool?.end(); sharedPool = null;
}
