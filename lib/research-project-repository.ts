import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";
import {
  normalizedTitleKey,
  type AnalysisCardInput,
  type CitationSourceInput,
  type LiteratureItemInput,
  type LiteratureLinkInput,
  type ResearchProjectCreateInput,
  type RqLinkInput,
  type ZoteroConnectionInput,
  type ZoteroSyncStatus,
} from "./research-project-contract.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export class ResearchProjectStorageUnavailable extends Error {
  constructor() { super("research_project_storage_unavailable"); this.name = "ResearchProjectStorageUnavailable"; }
}
export class ResearchProjectRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "ResearchProjectRepositoryError"; this.code = code; this.status = status; }
}

function tenantWhere(alias = "") { const p = alias ? `${alias}.` : ""; return `${p}workspace_id=$1 AND ${p}project_id=$2`; }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) { if (!pool) throw new ResearchProjectStorageUnavailable(); const client = await pool.connect(); try { return await operation(client); } finally { client.release(); } }
async function lock(client: PoolClient, tenant: ResearchTenant, key: string) { await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`rp:${tenant.workspaceId}:${tenant.projectId}:${tenant.userId}:${key}`]); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function int(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null; }

// ---- credentials encryption (server-side only; never stored plaintext) ----
function credentialSecret(): string {
  const secret = process.env.ZOTERO_CREDENTIAL_SECRET || process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET || "";
  if (secret.length < 16) throw new ResearchProjectRepositoryError("zotero_credential_secret_missing", 503);
  return secret;
}
function encryptCredentials(value: string): string {
  const secret = credentialSecret();
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}
function decryptCredentials(value: string | null): string | null {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new ResearchProjectRepositoryError("zotero_credential_invalid", 422);
  const key = createHash("sha256").update(credentialSecret()).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64"));
  decipher.setAuthTag(Buffer.from(parts[2], "base64"));
  try {
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64")), decipher.final()]).toString("utf8");
  } catch { throw new ResearchProjectRepositoryError("zotero_credential_invalid", 422); }
}

// ---- audit ----
async function audit(client: PoolClient, tenant: ResearchTenant, userId: string, action: string, artifactRefs?: unknown) {
  const event = { action, artifactRefs: artifactRefs ?? null, lifecycleContractVersion: "1.5.65" };
  const stage = action.startsWith("RESEARCH_PROJECT") || action.startsWith("BLUEPRINT") ? "S1_BLUEPRINT" : "S2_LITERATURE";
  await client.query(
    `INSERT INTO research_workflow_events (id,workspace_id,project_id,created_by_user_id,from_stage,to_stage,stage_detail,lifecycle_contract_version,artifact_refs,event_hash) VALUES ($4,$1,$2,$3,$5,$5,$6,'1.5.65',$7::jsonb,$8)`,
    [tenant.workspaceId, tenant.projectId, userId, `wfe_${randomUUID()}`, stage, action, JSON.stringify(artifactRefs ?? null), hash(event)],
  );
}

// ---- research project ----
export type ResearchProjectView = {
  id: string;
  projectName: string;
  projectType: string;
  topicId: string | null;
  topicVersion: string | null;
  submissionNavigatorId: string | null;
  currentStage: string;
  status: string;
  blueprint: Record<string, unknown>;
  zotero: { libraryType: string | null; libraryId: string | null; collectionKey: string | null; lastSyncedAt: string | null; syncStatus: string };
  createdAt: string;
  updatedAt: string;
};

function projectRowToView(row: Record<string, unknown>): ResearchProjectView {
  return {
    id: text(row.id),
    projectName: text(row.project_name),
    projectType: text(row.project_type),
    topicId: row.topic_id ? text(row.topic_id) : null,
    topicVersion: row.topic_version ? text(row.topic_version) : null,
    submissionNavigatorId: row.submission_navigator_id ? text(row.submission_navigator_id) : null,
    currentStage: text(row.current_stage),
    status: text(row.status),
    blueprint: record(row.blueprint_payload) ? row.blueprint_payload : {},
    zotero: {
      libraryType: row.zotero_library_type ? text(row.zotero_library_type) : null,
      libraryId: row.zotero_library_id ? text(row.zotero_library_id) : null,
      collectionKey: row.zotero_collection_key ? text(row.zotero_collection_key) : null,
      lastSyncedAt: row.last_synced_at ? text(row.last_synced_at) : null,
      syncStatus: text(row.zotero_sync_status),
    },
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export async function getResearchProject(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const result = await client.query(`SELECT * FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    if (!result.rows[0]) return null;
    return projectRowToView(result.rows[0] as Record<string, unknown>);
  });
}

/**
 * 自動補匯入導航文獻：research project 已綁定 submission_navigator_id，
 * 但該專案尚無任何文獻連結（例如早期 bug 導致 import 失敗的專案）時，
 * 打開文獻與證據中心時自動補跑 importNavigatorOutputLiterature（upsert 語意，重跑安全）。
 */
export async function ensureNavigatorLiteratureImported(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const rp = await client.query(`SELECT submission_navigator_id AS "runId" FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
    const runId = rp.rows[0] ? text((rp.rows[0] as Record<string, unknown>).runId) : "";
    if (!runId) return { ok: true, imported: false, reason: "no_navigator_run" };
    const links = await client.query(`SELECT count(*)::int AS c FROM project_literature_links WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    if ((links.rows[0]?.c ?? 0) > 0) return { ok: true, imported: false, reason: "already_imported" };
    const ev = await client.query(`SELECT count(*)::int AS c FROM submission_evidence_items WHERE workspace_id=$1 AND run_id=$2`, [tenant.workspaceId, runId]);
    if ((ev.rows[0]?.c ?? 0) === 0) return { ok: true, imported: false, reason: "run_has_no_evidence" };
    const result = await importNavigatorOutputLiterature(tenant, { userId: input.userId, runId });
    return { ok: true, ...result };
  });
}

export async function createResearchProjectFromRun(tenant: ResearchTenant, input: { userId: string; request: ResearchProjectCreateInput }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await lock(client, tenant, "research-project");
      // 專案標題 fallback：建立研究專案未帶入標題時，至少繼承 projects.title
      const titleResult = await client.query(`SELECT title FROM projects WHERE ${tenantWhere()} LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      const projectTitle = titleResult.rows[0] ? text(titleResult.rows[0].title) : "";
      // 模式一：有導航 run → 從 run snapshot 繼承；模式二：無 run → 從表單 topicProfile 建立（run 可選）
      let blueprint: Record<string, unknown>;
      let runId: string | null = null;
      if (input.request.navigatorRunId) {
        const runIdValue = input.request.navigatorRunId;
        // 先以本專案 scope 查；找不到時回退到同 workspace（同使用者）跨專案繼承：
        // 「建立研究專案」會以 intake 建立新 projectId，但導航 run 屬於原專案（run 以 project_id 綁定）
        let runResult = await client.query(`SELECT id, target_mode AS "targetMode", target_year AS "targetYear", topic_snapshot AS "topicSnapshot", researcher_snapshot AS "researcherSnapshot", fit_summary AS "fitSummary" FROM submission_navigator_runs WHERE ${tenantWhere()} AND id=$3 ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId, runIdValue]);
        let run = runResult.rows[0] as Record<string, unknown> | undefined;
        let crossProject = false;
        if (!run) {
          runResult = await client.query(`SELECT id, target_mode AS "targetMode", target_year AS "targetYear", topic_snapshot AS "topicSnapshot", researcher_snapshot AS "researcherSnapshot", fit_summary AS "fitSummary" FROM submission_navigator_runs WHERE workspace_id=$1 AND id=$2 ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, runIdValue]);
          run = runResult.rows[0] as Record<string, unknown> | undefined;
          crossProject = Boolean(run);
        }
        if (!run) throw new ResearchProjectRepositoryError("submission_navigator_run_not_found", 404);
        runId = text(run.id);
        // 子表（期刊/證據/路線）以 run_id 為自然鍵；跨專案繼承時以 workspace+run_id 查
        const runChildWhere = crossProject ? "workspace_id=$1 AND run_id=$2" : `${tenantWhere()} AND run_id=$3`;
        const runChildParams = crossProject ? [tenant.workspaceId, runId] : [tenant.workspaceId, tenant.projectId, runId];
        const candidates = await client.query(`SELECT journal_name AS "journalName", publisher, fit_score AS "fitScore", desk_reject_risk AS "deskRejectRisk" FROM submission_journal_candidates WHERE ${runChildWhere} ORDER BY fit_score DESC NULLS LAST LIMIT 10`, runChildParams);
        const evidenceItems = await client.query(`SELECT title, doi, url, source_type AS "sourceType", verification_status AS "verificationStatus", used_for AS "usedFor" FROM submission_evidence_items WHERE ${runChildWhere} LIMIT 100`, runChildParams);
        const fundingRoutes = await client.query(`SELECT route_type AS "routeType", route_name AS "routeName", fit_score AS "fitScore", status FROM submission_funding_routes WHERE ${runChildWhere} ORDER BY fit_score DESC NULLS LAST LIMIT 20`, runChildParams);
        const nstcRoute = fundingRoutes.rows.find((row: Record<string, unknown>) => text(row.routeType) === "NSTC");
        const moeRoute = fundingRoutes.rows.find((row: Record<string, unknown>) => text(row.routeType) === "MOE_TPR");
        const topic = record(run.topicSnapshot) ? run.topicSnapshot : {};
        const val = (key: string) => record(topic[key]) ? (topic[key] as Record<string, unknown>).value : null;
        const arr = (key: string) => { const v = val(key); return Array.isArray(v) ? v : []; };
        const str = (key: string, fb: string | null = "待確認（missing）") => { const v = val(key); return typeof v === "string" && v.trim() ? v.trim() : (fb ?? ""); };
        const researcher = record(run.researcherSnapshot) ? run.researcherSnapshot : {};
        const profileSnapshot = record(researcher.profile) ? researcher.profile : researcher;
        const targetJournals = candidates.rows.map((row: Record<string, unknown>) => ({ journalName: text(row.journalName), publisher: text(row.publisher), fitScore: int(row.fitScore), deskRejectRisk: text(row.deskRejectRisk) }));
        const importedEvidence = evidenceItems.rows.map((row: Record<string, unknown>) => ({ title: text(row.title), doi: text(row.doi) || null, url: text(row.url) || null, sourceType: text(row.sourceType), verificationStatus: text(row.verificationStatus), usedFor: text(row.usedFor) }));
        blueprint = {
          contractVersion: "research-project/1.0.0",
          inheritedFrom: { navigatorRunId: runId, targetMode: text(run.targetMode), targetYear: text(run.targetYear), ...(crossProject ? { crossProject: true } : {}) },
          chinese_title: str("chinese_title"),
          english_title: str("english_title"),
          research_gap: str("research_gap"),
          research_questions: arr("research_questions"),
          theory: arr("theory"),
          conceptual_framework: str("conceptual_framework", null),
          methodology: str("methodology"),
          population: str("population"),
          context: str("context"),
          variables: arr("variables"),
          expected_contribution: arr("expected_contribution"),
          target_journals: targetJournals,
          nstc_route: nstcRoute ? { routeName: text(nstcRoute.routeName), fitScore: int(nstcRoute.fitScore), status: text(nstcRoute.status) } : null,
          teaching_practice_route: moeRoute ? { routeName: text(moeRoute.routeName), fitScore: int(moeRoute.fitScore), status: text(moeRoute.status) } : null,
          researcher_profile_snapshot: profileSnapshot,
          imported_evidence: importedEvidence,
        };
      } else {
        const tp = input.request.topicProfile ?? {};
        const s = (v: unknown, fb = "待確認（missing）") => typeof v === "string" && v.trim() ? v.trim() : fb;
        const sl = (v: unknown) => Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
        const tpTitle = s(tp.titleZh, "");
        blueprint = {
          contractVersion: "research-project/1.0.0",
          inheritedFrom: null,
          chinese_title: tpTitle && tpTitle !== "待確認（missing）" ? tpTitle : projectTitle,
          english_title: s(tp.titleEn),
          research_gap: s(tp.researchGap),
          research_questions: sl(tp.researchQuestions),
          theory: sl(tp.theory),
          conceptual_framework: null,
          methodology: s(tp.method),
          population: s(tp.population),
          context: s(tp.context),
          variables: [],
          expected_contribution: sl(tp.expectedOutcomes),
          target_journals: [],
          nstc_route: null,
          teaching_practice_route: null,
          researcher_profile_snapshot: null,
          imported_evidence: [],
        };
      }
      // intakeOverride（建立表單的確認值）優先於導航/選題快照；兩種模式都套用
      const override = input.request.intakeOverride;
      if (override) {
        if (override.titleZh) blueprint.chinese_title = override.titleZh;
        if (override.population) blueprint.population = override.population;
        if (override.context) blueprint.context = override.context;
        if (override.methodology) blueprint.methodology = override.methodology;
        if (override.expectedContribution) blueprint.expected_contribution = [override.expectedContribution];
      }
      if (!blueprint.chinese_title || blueprint.chinese_title === "待確認（missing）") blueprint.chinese_title = projectTitle;
            if (!blueprint.chinese_title || blueprint.chinese_title === "待確認（missing）") blueprint.chinese_title = projectTitle;

      // upsert researcher profile (user-level) from the snapshot if present
      let researcherProfileId: string | null = null;
      const profileSnapshot = record(blueprint.researcher_profile_snapshot) ? blueprint.researcher_profile_snapshot : null;
      const position = profileSnapshot && typeof (profileSnapshot as Record<string, unknown>).position === "string" ? text((profileSnapshot as Record<string, unknown>).position) : "";
      if (position) {
        const existing = await client.query(`SELECT id FROM researcher_profiles WHERE workspace_id=$1 AND user_id=$2`, [tenant.workspaceId, input.userId]);
        if (existing.rows[0]) {
          researcherProfileId = text(existing.rows[0].id);
          await client.query(`UPDATE researcher_profiles SET position=$2, updated_at=now() WHERE id=$1`, [researcherProfileId, position]);
        } else {
          researcherProfileId = `rprof_${randomUUID()}`;
          await client.query(`INSERT INTO researcher_profiles (id,workspace_id,user_id,position,created_at,updated_at) VALUES ($1,$2,$3,$4,now(),now())`, [researcherProfileId, tenant.workspaceId, input.userId, position]);
        }
      }

      const existingProject = await client.query(`SELECT id, submission_navigator_id AS "existingRunId" FROM research_projects WHERE ${tenantWhere()} ORDER BY created_at DESC LIMIT 1`, [tenant.workspaceId, tenant.projectId]);
      if (existingProject.rows[0]) {
        const existingRunId = existingProject.rows[0].existingRunId ? text(existingProject.rows[0].existingRunId) : null;
        await client.query(`UPDATE research_projects SET submission_navigator_id=COALESCE($3, submission_navigator_id), blueprint_payload=$4::jsonb, updated_at=now() WHERE id=$5 AND ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId, runId, JSON.stringify(blueprint), text(existingProject.rows[0].id)]);
        await client.query("COMMIT");
        // runAdded：原本無導航 run，這次補上 → 前端應重新匯入文獻並重建藍圖（primary route 會更新）
        return { id: text(existingProject.rows[0].id), idempotent: true, runAdded: Boolean(runId) && !existingRunId };
      }

      const id = `rproj_${randomUUID()}`;
      const overrideTitle = input.request.intakeOverride?.titleZh;
      const blueprintTitle = typeof blueprint.chinese_title === "string" && blueprint.chinese_title.trim() ? blueprint.chinese_title.trim() : "";
      const projectName = input.request.projectName || overrideTitle || blueprintTitle || projectTitle || "未命名研究專案";
      const projectType = input.request.projectType || "GENERAL";
      await client.query(
        `INSERT INTO research_projects (id,workspace_id,project_id,created_by_user_id,project_name,project_type,topic_id,topic_version,submission_navigator_id,researcher_profile_id,current_stage,status,blueprint_payload,created_at,updated_at)
         VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,'BLUEPRINT','ACTIVE',$11::jsonb,now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.userId, id, projectName.slice(0, 300), projectType, null, null, runId, researcherProfileId, JSON.stringify(blueprint)],
      );
      await audit(client, tenant, input.userId, "RESEARCH_PROJECT_CREATED", { researchProjectId: id, navigatorRunId: runId });
      await client.query("COMMIT");
      return { id, idempotent: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function updateResearchProjectStage(tenant: ResearchTenant, input: { userId: string; stage: string }) {
  return withClient(async (client) => {
    const result = await client.query(`UPDATE research_projects SET current_stage=$3, updated_at=now() WHERE ${tenantWhere()} RETURNING id`, [tenant.workspaceId, tenant.projectId, input.stage]);
    if (!result.rowCount) throw new ResearchProjectRepositoryError("research_project_not_found", 404);
    await audit(client, tenant, input.userId, "RESEARCH_PROJECT_STAGE_CHANGED", { stage: input.stage });
    return { ok: true };
  });
}

// ---- literature ----
export async function upsertCanonicalLiterature(client: PoolClient, tenant: ResearchTenant, userId: string, input: LiteratureItemInput): Promise<string> {
  const normalizedTitle = normalizedTitleKey(input.title);
  const existing = await client.query(
    `SELECT id FROM literature_items
     WHERE workspace_id=$1 AND (
       (doi IS NOT NULL AND doi=$2::text) OR
       (zotero_item_key IS NOT NULL AND zotero_item_key=$3::text) OR
       (year IS NOT NULL AND normalized_title=$4::text AND year=$5::integer)
     ) ORDER BY created_at DESC LIMIT 1`,
    [tenant.workspaceId, input.doi, input.zoteroItemKey, normalizedTitle, input.year],
  );
  if (existing.rows[0]) {
    const id = text(existing.rows[0].id);
    await client.query(
      `UPDATE literature_items SET title=$2, authors=$3::jsonb, journal=$4, abstract=$5, item_type=$6, url=$7, tags=$8::jsonb, citation_count=$9, updated_at=now() WHERE id=$10 AND workspace_id=$1`,
      [tenant.workspaceId, input.title.slice(0, 2000), JSON.stringify(input.authors), input.journal, input.abstract, input.itemType, input.url, JSON.stringify(input.tags), input.citationCount, id],
    );
    return id;
  }
  const id = `lit_${randomUUID()}`;
  await client.query(
    `INSERT INTO literature_items (id,workspace_id,created_by_user_id,title,authors,year,journal,doi,abstract,item_type,url,tags,citation_count,zotero_item_key,zotero_collection_key,zotero_library_type,zotero_library_id,normalized_title,source,created_at,updated_at)
     VALUES ($3,$1,$2,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,now(),now())`,
    [tenant.workspaceId, userId, id, input.title.slice(0, 2000), JSON.stringify(input.authors), input.year, input.journal, input.doi, input.abstract, input.itemType, input.url, JSON.stringify(input.tags), input.citationCount, input.zoteroItemKey, input.zoteroCollectionKey, input.zoteroLibraryType, input.zoteroLibraryId, normalizedTitle, input.source],
  );
  return id;
}

async function ensureLink(client: PoolClient, tenant: ResearchTenant, userId: string, literatureId: string, link?: LiteratureLinkInput) {
  const existing = await client.query(`SELECT id FROM project_literature_links WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, literatureId]);
  if (existing.rows[0]) {
    const id = text(existing.rows[0].id);
    const sets: string[] = [];
    const values: unknown[] = [];
    let next = 1;
    if (link?.role && link.role.length) { sets.push(`role=$${next++}::jsonb`); values.push(JSON.stringify(link.role)); }
    if (link?.priority !== undefined && link.priority !== null) { sets.push(`priority=$${next++}`); values.push(link.priority); }
    if (link?.readingStatus) { sets.push(`reading_status=$${next++}`); values.push(link.readingStatus); }
    if (link?.evidenceStatus) { sets.push(`evidence_status=$${next++}`); values.push(link.evidenceStatus); }
    if (link?.relevanceScore !== undefined && link.relevanceScore !== null) { sets.push(`relevance_score=$${next++}`); values.push(link.relevanceScore); }
    if (link?.notes !== undefined && link.notes !== null) { sets.push(`notes=$${next++}`); values.push(link.notes); }
    if (sets.length) await client.query(`UPDATE project_literature_links SET ${sets.join(", ")}, updated_at=now() WHERE id=$${next++} AND workspace_id=$${next++} AND project_id=$${next++}`, [...values, id, tenant.workspaceId, tenant.projectId]);
    return id;
  }
  const id = `pll_${randomUUID()}`;
  await client.query(
    `INSERT INTO project_literature_links (id,workspace_id,project_id,literature_id,created_by_user_id,role,priority,reading_status,evidence_status,relevance_score,notes,added_at,updated_at)
     VALUES ($4,$1,$2,$3,$5,$6::jsonb,$7,$8,$9,$10,$11,now(),now())`,
    [tenant.workspaceId, tenant.projectId, literatureId, id, userId, JSON.stringify(link?.role ?? []), link?.priority ?? null, link?.readingStatus ?? "DISCOVERED", link?.evidenceStatus ?? "UNVERIFIED", link?.relevanceScore ?? null, link?.notes ?? null],
  );
  return id;
}


export async function importNavigatorOutputLiterature(tenant: ResearchTenant, input: { userId: string; runId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const evidenceItems = await client.query(`SELECT title, doi, url, source_type AS "sourceType", verification_status AS "verificationStatus", used_for AS "usedFor" FROM submission_evidence_items WHERE ${tenantWhere()} AND run_id=$3 LIMIT 100`, [tenant.workspaceId, tenant.projectId, input.runId]);
      const candidates = await client.query(`SELECT journal_name AS "journalName", publisher, fit_score AS "fitScore", desk_reject_risk AS "deskRejectRisk" FROM submission_journal_candidates WHERE ${tenantWhere()} AND run_id=$3 LIMIT 10`, [tenant.workspaceId, tenant.projectId, input.runId]);
      let imported = 0;
      let deduped = 0;
      for (const row of evidenceItems.rows as Record<string, unknown>[]) {
        const title = text(row.title);
        if (!title) continue;
        const verification = text(row.verificationStatus);
        const item: LiteratureItemInput = {
          title,
          doi: row.doi ? text(row.doi) : null,
          url: row.url ? text(row.url) : null,
          source: "NAVIGATOR_IMPORT",
          tags: [],
        };
        const existing = await client.query(`SELECT id FROM literature_items WHERE workspace_id=$1 AND doi=$2 AND doi IS NOT NULL LIMIT 1`, [tenant.workspaceId, item.doi]);
        let literatureId: string;
        if (existing.rows[0]) { literatureId = text(existing.rows[0].id); deduped += 1; }
        else { literatureId = await upsertCanonicalLiterature(client, tenant, input.userId, item); imported += 1; }
        await ensureLink(client, tenant, input.userId, literatureId, {
          readingStatus: "DISCOVERED",
          evidenceStatus: /verified/iu.test(verification) ? "VERIFIED" : "UNVERIFIED",
          notes: row.usedFor ? `導航用途：${text(row.usedFor)}` : null,
        });
      }
      for (const row of candidates.rows as Record<string, unknown>[]) {
        const journalName = text(row.journalName);
        if (!journalName) continue;
        const item: LiteratureItemInput = {
          title: journalName,
          journal: journalName,
          source: "NAVIGATOR_IMPORT",
          tags: [],
        };
        const literatureId = await upsertCanonicalLiterature(client, tenant, input.userId, item);
        await ensureLink(client, tenant, input.userId, literatureId, {
          readingStatus: "DISCOVERED",
          evidenceStatus: "UNVERIFIED",
          priority: int(row.fitScore) && Number(int(row.fitScore)) >= 70 ? 1 : null,
          notes: row.publisher ? `出版社：${text(row.publisher)}` : null,
        });
        imported += 1;
      }
      await audit(client, tenant, input.userId, "LITERATURE_IMPORTED_FROM_NAVIGATOR", { runId: input.runId, imported, deduped });
      await client.query("COMMIT");
      return { imported, deduped };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function addLiteratureToProject(tenant: ResearchTenant, input: { userId: string; item: LiteratureItemInput; link?: LiteratureLinkInput; auditAction?: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const literatureId = await upsertCanonicalLiterature(client, tenant, input.userId, input.item);
      const linkId = await ensureLink(client, tenant, input.userId, literatureId, input.link);
      await audit(client, tenant, input.userId, input.auditAction ?? "LITERATURE_ADDED", { literatureId, linkId });
      await client.query("COMMIT");
      return { literatureId, linkId, canonical: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function updateLiteratureLink(tenant: ResearchTenant, input: { userId: string; literatureId: string; link: LiteratureLinkInput }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const existing = await client.query(`SELECT id, role FROM project_literature_links WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, input.literatureId]);
      if (!existing.rows[0]) throw new ResearchProjectRepositoryError("literature_not_linked", 404);
      const currentRole = list((existing.rows[0] as Record<string, unknown>).role).filter((entry): entry is string => typeof entry === "string");
      const mergedRole = input.link.role && input.link.role.length ? [...new Set([...currentRole, ...input.link.role])] : currentRole;
      await client.query(
        `UPDATE project_literature_links SET role=$4::jsonb, priority=COALESCE($5, priority), reading_status=COALESCE($6, reading_status), evidence_status=COALESCE($7, evidence_status), relevance_score=COALESCE($8, relevance_score), notes=COALESCE($9, notes), updated_at=now() WHERE ${tenantWhere()} AND literature_id=$3`,
        [tenant.workspaceId, tenant.projectId, input.literatureId, JSON.stringify(mergedRole), input.link.priority ?? null, input.link.readingStatus ?? null, input.link.evidenceStatus ?? null, input.link.relevanceScore ?? null, input.link.notes ?? null],
      );
      if (input.link.readingStatus) await audit(client, tenant, input.userId, "READING_STATUS_CHANGED", { literatureId: input.literatureId, readingStatus: input.link.readingStatus });
      if (input.link.evidenceStatus) await audit(client, tenant, input.userId, "EVIDENCE_UPDATED", { literatureId: input.literatureId, evidenceStatus: input.link.evidenceStatus });
      if (input.link.role?.length) await audit(client, tenant, input.userId, "ROLE_CHANGED", { literatureId: input.literatureId, role: input.link.role });
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function removeLiteratureFromProject(tenant: ResearchTenant, input: { userId: string; literatureId: string }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await client.query(`DELETE FROM project_literature_links WHERE ${tenantWhere()} AND literature_id=$3 RETURNING id`, [tenant.workspaceId, tenant.projectId, input.literatureId]);
      if (!result.rowCount) throw new ResearchProjectRepositoryError("literature_not_linked", 404);
      await audit(client, tenant, input.userId, "REMOVED_FROM_PROJECT", { literatureId: input.literatureId });
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export type LiteratureView = {
  literatureId: string;
  linkId: string | null;
  title: string;
  authors: { given?: string; family?: string }[];
  year: number | null;
  journal: string | null;
  doi: string | null;
  url: string | null;
  source: string;
  citationCount: number | null;
  tags: string[];
  zoteroItemKey: string | null;
  zoteroCollectionKey: string | null;
  role: string[];
  readingStatus: string;
  evidenceStatus: string;
  relevanceScore: number | null;
  priority: number | null;
  notes: string | null;
  rqLinks: { rqKey: string; relationship: string }[];
  analysisCard: Record<string, unknown> | null;
  zoteroSyncStatus: string;
};

export async function listProjectLiterature(tenant: ResearchTenant, filter?: { role?: string; readingStatus?: string; evidenceStatus?: string; zotero?: string }) {
  return withClient(async (client) => {
    const rows = await client.query(
      `SELECT i.id AS "literatureId", l.id AS "linkId", i.title, i.authors, i.year, i.journal, i.doi, i.url, i.source, i.citation_count AS "citationCount", i.tags, i.zotero_item_key AS "zoteroItemKey", i.zotero_collection_key AS "zoteroCollectionKey",
              l.role, l.reading_status AS "readingStatus", l.evidence_status AS "evidenceStatus", l.relevance_score AS "relevanceScore", l.priority, l.notes,
              COALESCE(jsonb_agg(DISTINCT jsonb_build_object('rqKey', r.rq_key, 'relationship', r.relationship)) FILTER (WHERE r.id IS NOT NULL), '[]') AS "rqLinks",
              c.id AS "cardId", c.research_problem AS "cardResearchProblem", c.main_findings AS "cardMainFindings"
       FROM literature_items i
       JOIN project_literature_links l ON l.workspace_id=i.workspace_id AND l.literature_id=i.id AND ${tenantWhere("l")}
       LEFT JOIN literature_rq_links r ON r.workspace_id=i.workspace_id AND r.literature_id=i.id AND r.project_id=l.project_id
       LEFT JOIN literature_analysis_cards c ON c.workspace_id=i.workspace_id AND c.literature_id=i.id AND c.project_id=l.project_id
       WHERE i.workspace_id=$1 AND l.project_id=$2
       GROUP BY i.id, l.id, c.id
       ORDER BY l.relevance_score DESC NULLS LAST, i.created_at DESC LIMIT 500`,
      [tenant.workspaceId, tenant.projectId],
    );
    const items = (rows.rows as Record<string, unknown>[]).map((row) => {
      const zoteroItemKey = row.zoteroItemKey ? text(row.zoteroItemKey) : null;
      const zoteroCollectionKey = row.zoteroCollectionKey ? text(row.zoteroCollectionKey) : null;
      const zoteroSyncStatus = zoteroItemKey ? (zoteroCollectionKey ? "SYNCED" : "IN_ZOTERO") : "NOT_LINKED";
      return {
        literatureId: text(row.literatureId),
        linkId: row.linkId ? text(row.linkId) : null,
        title: text(row.title),
        authors: Array.isArray(row.authors) ? row.authors : [],
        year: int(row.year),
        journal: row.journal ? text(row.journal) : null,
        doi: row.doi ? text(row.doi) : null,
        url: row.url ? text(row.url) : null,
        source: text(row.source) || "MANUAL",
        citationCount: int(row.citationCount),
        tags: Array.isArray(row.tags) ? row.tags : [],
        zoteroItemKey,
        zoteroCollectionKey,
        role: Array.isArray(row.role) ? row.role.filter((entry): entry is string => typeof entry === "string") : [],
        readingStatus: text(row.readingStatus),
        evidenceStatus: text(row.evidenceStatus),
        relevanceScore: int(row.relevanceScore),
        priority: int(row.priority),
        notes: row.notes ? text(row.notes) : null,
        rqLinks: Array.isArray(row.rqLinks) ? row.rqLinks : [],
        analysisCard: row.cardId ? { id: text(row.cardId), researchProblem: row.cardResearchProblem ? text(row.cardResearchProblem) : null, mainFindings: row.cardMainFindings ? text(row.cardMainFindings) : null } : null,
        zoteroSyncStatus,
      } satisfies LiteratureView;
    });
    if (!filter) return items;
    return items.filter((item) => {
      if (filter.role && !item.role.includes(filter.role)) return false;
      if (filter.readingStatus && item.readingStatus !== filter.readingStatus) return false;
      if (filter.evidenceStatus && item.evidenceStatus !== filter.evidenceStatus) return false;
      if (filter.zotero === "SYNCED" && item.zoteroSyncStatus !== "SYNCED") return false;
      if (filter.zotero === "NOT_LINKED" && item.zoteroSyncStatus !== "NOT_LINKED") return false;
      return true;
    });
  });
}

export async function getEvidenceMatrix(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const rows = await client.query(
      `SELECT i.title, l.role, i.year, l.evidence_status AS "evidenceStatus", l.reading_status AS "readingStatus",
              c.main_findings AS "mainFindings", c.limitations, c.research_gap AS "researchGap",
              COALESCE(jsonb_agg(DISTINCT jsonb_build_object('rqKey', r.rq_key, 'relationship', r.relationship)) FILTER (WHERE r.id IS NOT NULL), '[]') AS "rqLinks"
       FROM project_literature_links l
       JOIN literature_items i ON i.id=l.literature_id
       LEFT JOIN literature_analysis_cards c ON c.literature_id=l.literature_id AND c.project_id=l.project_id
       LEFT JOIN literature_rq_links r ON r.literature_id=l.literature_id AND r.project_id=l.project_id
       WHERE ${tenantWhere("l")}
       GROUP BY i.title, l.role, i.year, l.evidence_status, l.reading_status, c.main_findings, c.limitations, c.research_gap
       ORDER BY i.year DESC NULLS LAST, i.title LIMIT 500`,
      [tenant.workspaceId, tenant.projectId],
    );
    return rows.rows as Record<string, unknown>[];
  });
}

export async function getLiteratureSummary(tenant: ResearchTenant) {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE l.role ? 'CORE') AS core,
              count(*) FILTER (WHERE l.role ? 'GAP') AS gap,
              count(*) FILTER (WHERE l.role ? 'THEORY') AS theory,
              count(*) FILTER (WHERE l.role ? 'METHOD') AS method,
              count(*) FILTER (WHERE l.reading_status IN ('FULLTEXT_REVIEWED','KEY_PAPER')) AS fulltextReviewed,
              count(*) FILTER (WHERE l.evidence_status IN ('VERIFIED','SUPPORTED')) AS verified,
              count(*) FILTER (WHERE i.zotero_item_key IS NOT NULL) AS zoteroSynced,
              count(*) FILTER (WHERE l.reading_status='DISCOVERED') AS unread
       FROM project_literature_links l JOIN literature_items i ON i.id=l.literature_id
       WHERE ${tenantWhere("l")}`,
      [tenant.workspaceId, tenant.projectId],
    );
    return result.rows[0] as Record<string, unknown>;
  });
}

export function computeNextBestAction(summary: Record<string, unknown>, matrix: Record<string, unknown>[]): { action: string; reason: string } {
  const core = Number(summary.core ?? 0);
  const gap = Number(summary.gap ?? 0);
  const theory = Number(summary.theory ?? 0);
  const method = Number(summary.method ?? 0);
  const unread = Number(summary.unread ?? 0);
  const total = Number(summary.total ?? 0);
  const rqCovered = new Set<string>();
  for (const row of matrix) {
    const links = Array.isArray(row.rqLinks) ? row.rqLinks : [];
    for (const link of links) {
      if (record(link) && typeof link.rqKey === "string") rqCovered.add(link.rqKey);
    }
  }
  if (total === 0) return { action: "先匯入或搜尋第一批文獻（可從投稿導航的證據清單與候選期刊自動帶入，或連線 Zotero 同步）。", reason: "專案尚未有任何文獻關聯。" };
  if (gap < 2) return { action: `目前 Research Gap 只有 ${gap} 篇核心證據，建議先補充 Gap 文獻（標記 role=GAP）。`, reason: "研究缺口證據不足，影響 Introduction 與選題正當性。" };
  if (theory < 2) return { action: `缺少 Theory 文獻（目前 ${theory} 篇），建議以 role=THEORY 標記理論框架來源。`, reason: "理論與機制章節需要至少 2 篇理論依據。" };
  if (method < 2) return { action: `缺少 Method/Measurement 文獻（目前 ${method} 篇），建議補方法學與測量工具來源。`, reason: "方法與測量工具需要文獻支持。" };
  if (unread > 0) return { action: `尚有 ${unread} 篇未讀（DISCOVERED），建議先讀摘要並更新閱讀狀態，避免把「看過摘要」當成「已完整閱讀」。`, reason: "閱讀狀態需誠實記錄。" };
  if (rqCovered.size < 1) return { action: "建立文獻 ↔ RQ 連結（每篇標示 Supports/Theory/Method 對應哪個研究問題）。", reason: "RQ 連結是未來全文寫作引用管線的基礎。" };
  return { action: "文獻基礎已足夠（Gap/Theory/Method 齊備），可進入研究設計階段。", reason: "Next Best Action：研究架構與設計。" };
}

export async function saveAnalysisCard(tenant: ResearchTenant, input: { userId: string; literatureId: string; card: AnalysisCardInput }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const linked = await client.query(`SELECT 1 FROM project_literature_links WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, input.literatureId]);
      if (!linked.rowCount) throw new ResearchProjectRepositoryError("literature_not_linked", 404);
      const existing = await client.query(`SELECT id FROM literature_analysis_cards WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, input.literatureId]);
      if (existing.rows[0]) {
        await client.query(
          `UPDATE literature_analysis_cards SET research_problem=COALESCE($4,research_problem), theory=COALESCE($5,theory), population=COALESCE($6,population), method=COALESCE($7,method), variables=COALESCE($8,variables), main_findings=COALESCE($9,main_findings), limitations=COALESCE($10,limitations), future_research=COALESCE($11,future_research), research_gap=COALESCE($12,research_gap), supports_my_project=COALESCE($13,supports_my_project), differs_from_my_project=COALESCE($14,differs_from_my_project), useful_for_sections=COALESCE($15::jsonb,useful_for_sections), user_notes=COALESCE($16,user_notes), updated_at=now() WHERE id=$17 AND workspace_id=$1 AND project_id=$2 AND literature_id=$3`,
          [tenant.workspaceId, tenant.projectId, input.literatureId, input.card.researchProblem, input.card.theory, input.card.population, input.card.method, input.card.variables, input.card.mainFindings, input.card.limitations, input.card.futureResearch, input.card.researchGap, input.card.supportsMyProject, input.card.differsFromMyProject, JSON.stringify(input.card.usefulForSections ?? []), input.card.userNotes, text(existing.rows[0].id)],
        );
        await audit(client, tenant, input.userId, "ANALYSIS_CARD_UPDATED", { literatureId: input.literatureId });
        await client.query("COMMIT");
        return { ok: true };
      }
      const id = `lac_${randomUUID()}`;
      await client.query(
        `INSERT INTO literature_analysis_cards (id,workspace_id,project_id,literature_id,created_by_user_id,research_problem,theory,population,method,variables,main_findings,limitations,future_research,research_gap,supports_my_project,differs_from_my_project,useful_for_sections,user_notes,created_at,updated_at)
         VALUES ($4,$1,$2,$3,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,now(),now())`,
        [tenant.workspaceId, tenant.projectId, input.literatureId, id, input.userId, input.card.researchProblem, input.card.theory, input.card.population, input.card.method, input.card.variables, input.card.mainFindings, input.card.limitations, input.card.futureResearch, input.card.researchGap, input.card.supportsMyProject, input.card.differsFromMyProject, JSON.stringify(input.card.usefulForSections ?? []), input.card.userNotes],
      );
      await audit(client, tenant, input.userId, "ANALYSIS_CARD_CREATED", { literatureId: input.literatureId });
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function setRqLinks(tenant: ResearchTenant, input: { userId: string; literatureId: string; links: RqLinkInput[] }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const linked = await client.query(`SELECT 1 FROM project_literature_links WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, input.literatureId]);
      if (!linked.rowCount) throw new ResearchProjectRepositoryError("literature_not_linked", 404);
      await client.query(`DELETE FROM literature_rq_links WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, input.literatureId]);
      for (const link of input.links) {
        await client.query(
          `INSERT INTO literature_rq_links (id,workspace_id,project_id,literature_id,rq_key,relationship,created_at) VALUES ($4,$1,$2,$3,$5,$6,now())`,
          [tenant.workspaceId, tenant.projectId, input.literatureId, `lrl_${randomUUID()}`, link.rqKey, link.relationship],
        );
      }
      await audit(client, tenant, input.userId, "RQ_LINKS_UPDATED", { literatureId: input.literatureId, links: input.links });
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

export async function upsertCitationSource(tenant: ResearchTenant, input: { userId: string; citation: CitationSourceInput }) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const linked = await client.query(`SELECT 1 FROM project_literature_links WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, input.citation.literatureId]);
      if (!linked.rowCount) throw new ResearchProjectRepositoryError("literature_not_linked", 404);
      const existing = await client.query(`SELECT id FROM citation_sources WHERE ${tenantWhere()} AND literature_id=$3`, [tenant.workspaceId, tenant.projectId, input.citation.literatureId]);
      if (existing.rows[0]) {
        await client.query(
          `UPDATE citation_sources SET zotero_item_key=COALESCE($4,zotero_item_key), citation_key=COALESCE($5,citation_key), doi=COALESCE($6,doi), used_in_sections=COALESCE($7::jsonb,used_in_sections), supporting_claims=COALESCE($8::jsonb,supporting_claims), citation_status='PLANNED' WHERE id=$9 AND workspace_id=$1 AND project_id=$2 AND literature_id=$3`,
          [tenant.workspaceId, tenant.projectId, input.citation.literatureId, input.citation.zoteroItemKey, input.citation.citationKey, input.citation.doi, JSON.stringify(input.citation.usedInSections ?? []), JSON.stringify(input.citation.supportingClaims ?? []), text(existing.rows[0].id)],
        );
        await client.query("COMMIT");
        return { ok: true };
      }
      await client.query(
        `INSERT INTO citation_sources (id,workspace_id,project_id,literature_id,zotero_item_key,citation_key,doi,used_in_sections,supporting_claims,citation_status,created_at)
         VALUES ($4,$1,$2,$3,$5,$6,$7,$8::jsonb,$9::jsonb,'PLANNED',now())`,
        [tenant.workspaceId, tenant.projectId, input.citation.literatureId, `cit_${randomUUID()}`, input.citation.zoteroItemKey, input.citation.citationKey, input.citation.doi, JSON.stringify(input.citation.usedInSections ?? []), JSON.stringify(input.citation.supportingClaims ?? [])],
      );
      await audit(client, tenant, input.userId, "CITATION_SOURCE_CREATED", { literatureId: input.citation.literatureId });
      await client.query("COMMIT");
      return { ok: true };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  });
}

// ---- zotero connection ----
export async function getZoteroConnection(tenant: ResearchTenant, userId: string) {
  return withClient(async (client) => {
    const result = await client.query(`SELECT id, library_type AS "libraryType", library_id AS "libraryId", collection_key AS "collectionKey", collection_name AS "collectionName", auth_method AS "authMethod", credentials_enc AS "credentialsEnc", last_synced_at AS "lastSyncedAt", sync_status AS "syncStatus" FROM zotero_connections WHERE workspace_id=$1 AND user_id=$2 LIMIT 1`, [tenant.workspaceId, userId]);
    if (!result.rows[0]) return null;
    const row = result.rows[0] as Record<string, unknown>;
    // env 模式（留空連線）時 credentials_enc 為 NULL：退回網站預設帳號的 ZOTERO_API_KEY，讓 Sync/Export 對使用者可用。
    const apiKey = row.credentialsEnc ? decryptCredentials(text(row.credentialsEnc)) : (process.env.ZOTERO_API_KEY || null);
    return {
      id: text(row.id),
      libraryType: text(row.libraryType),
      libraryId: text(row.libraryId),
      collectionKey: row.collectionKey ? text(row.collectionKey) : null,
      collectionName: row.collectionName ? text(row.collectionName) : null,
      authMethod: text(row.authMethod),
      apiKey,
      lastSyncedAt: row.lastSyncedAt ? text(row.lastSyncedAt) : null,
      syncStatus: text(row.syncStatus),
    };
  });
}

export async function saveZoteroConnection(tenant: ResearchTenant, input: { userId: string; connection: ZoteroConnectionInput }) {
  return withClient(async (client) => {
    const existing = await client.query(`SELECT id FROM zotero_connections WHERE workspace_id=$1 AND user_id=$2`, [tenant.workspaceId, input.userId]);
    const credentialsEnc = input.connection.apiKey ? encryptCredentials(input.connection.apiKey) : null;
    if (existing.rows[0]) {
      await client.query(
        `UPDATE zotero_connections SET library_type=$3, library_id=$4, collection_key=$5, collection_name=$6, auth_method=$7, credentials_enc=COALESCE($8,credentials_enc), sync_status='CONNECTED', updated_at=now() WHERE id=$9`,
        [tenant.workspaceId, input.userId, input.connection.libraryType, input.connection.libraryId, input.connection.collectionKey, input.connection.collectionName, input.connection.authMethod, credentialsEnc, text(existing.rows[0].id)],
      );
      return { ok: true };
    }
    await client.query(
      `INSERT INTO zotero_connections (id,workspace_id,user_id,library_type,library_id,collection_key,collection_name,auth_method,credentials_enc,sync_status,created_at,updated_at)
       VALUES ($4,$1,$2,$5,$6,$7,$8,$9,$10,'CONNECTED',now(),now())`,
      [tenant.workspaceId, input.userId, `zconn_${randomUUID()}`, input.connection.libraryType, input.connection.libraryId, input.connection.collectionKey, input.connection.collectionName, input.connection.authMethod, credentialsEnc],
    );
    return { ok: true };
  });
}

export async function clearZoteroConnection(tenant: ResearchTenant, input: { userId: string }) {
  return withClient(async (client) => {
    const result = await client.query(`DELETE FROM zotero_connections WHERE workspace_id=$1 AND user_id=$2 RETURNING id`, [tenant.workspaceId, input.userId]);
    // 斷開只刪連線與憑證；不刪 literature_items / links（網站資料獨立於 Zotero）
    await client.query(`UPDATE research_projects SET zotero_sync_status='NOT_LINKED', zotero_library_type=NULL, zotero_library_id=NULL, zotero_collection_key=NULL, last_synced_at=NULL, updated_at=now() WHERE ${tenantWhere()}`, [tenant.workspaceId, tenant.projectId]);
    await audit(client, tenant, input.userId, "ZOTERO_DISCONNECTED", {});
    return { ok: true, removed: Boolean(result.rowCount) };
  });
}

export async function markZoteroSynced(tenant: ResearchTenant, input: { userId: string; status: ZoteroSyncStatus; libraryType?: string; libraryId?: string; collectionKey?: string; collectionName?: string }) {
  return withClient(async (client) => {
    await client.query(
      `UPDATE research_projects SET zotero_sync_status=$3, zotero_library_type=COALESCE($4,zotero_library_type), zotero_library_id=COALESCE($5,zotero_library_id), zotero_collection_key=COALESCE($6,zotero_collection_key), last_synced_at=now(), updated_at=now() WHERE ${tenantWhere()}`,
      [tenant.workspaceId, tenant.projectId, input.status, input.libraryType ?? null, input.libraryId ?? null, input.collectionKey ?? null],
    );
    await client.query(`UPDATE zotero_connections SET sync_status=$3, last_synced_at=now(), updated_at=now() WHERE workspace_id=$1 AND user_id=$2`, [tenant.workspaceId, input.userId, input.status]);
    await audit(client, tenant, input.userId, "ZOTERO_SYNCED", { status: input.status });
    return { ok: true };
  });
}
