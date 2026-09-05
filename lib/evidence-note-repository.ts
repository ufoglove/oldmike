import "server-only";

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ResearchTenant } from "./research-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("evidence_note_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function tenantWhere(): string { return "workspace_id=$1 AND project_id=$2"; }
type Row = Record<string, unknown>;

export type EvidenceNote = {
  id: string;
  literatureId: string | null;
  citationSourceId: string | null;
  claimRef: string | null;
  rqRef: string | null;
  pageOrParagraph: string | null;
  researchPurpose: string | null;
  noteText: string;
  readingLevel: string;
  analyzedByUserId: string | null;
  analyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const NOTE_COLUMNS = `id, literature_id AS "literatureId", citation_source_id AS "citationSourceId", claim_ref AS "claimRef", rq_ref AS "rqRef", page_or_paragraph AS "pageOrParagraph", research_purpose AS "researchPurpose", note_text AS "noteText", reading_level AS "readingLevel", analyzed_by_user_id AS "analyzedByUserId", analyzed_at AS "analyzedAt", created_at AS "createdAt", updated_at AS "updatedAt"`;

function rowToNote(row: Row): EvidenceNote {
  const at = (value: unknown): string | null => (value ? (value instanceof Date ? value.toISOString() : text(value)) : null);
  return {
    id: text(row.id),
    literatureId: row.literatureId ? text(row.literatureId) : null,
    citationSourceId: row.citationSourceId ? text(row.citationSourceId) : null,
    claimRef: row.claimRef ? text(row.claimRef) : null,
    rqRef: row.rqRef ? text(row.rqRef) : null,
    pageOrParagraph: row.pageOrParagraph ? text(row.pageOrParagraph) : null,
    researchPurpose: row.researchPurpose ? text(row.researchPurpose) : null,
    noteText: text(row.noteText),
    readingLevel: text(row.readingLevel),
    analyzedByUserId: row.analyzedByUserId ? text(row.analyzedByUserId) : null,
    analyzedAt: at(row.analyzedAt),
    createdAt: at(row.createdAt) ?? "",
    updatedAt: at(row.updatedAt) ?? "",
  };
}

export class EvidenceNoteRepositoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 422) { super(code); this.name = "EvidenceNoteRepositoryError"; this.code = code; this.status = status; }
}

export async function listEvidenceNotes(tenant: ResearchTenant, filter: { literatureId?: string; limit?: number } = {}): Promise<EvidenceNote[]> {
  return withClient(async (client) => {
    const params: unknown[] = [tenant.workspaceId, tenant.projectId];
    let where = tenantWhere();
    if (filter.literatureId) { params.push(filter.literatureId); where += ` AND literature_id=$${params.length}`; }
    params.push(Math.min(Math.max(filter.limit ?? 50, 1), 200));
    const rows = (await client.query(`SELECT ${NOTE_COLUMNS} FROM evidence_notes WHERE ${where} ORDER BY updated_at DESC LIMIT $${params.length}`, params)).rows as Row[];
    return rows.map(rowToNote);
  });
}

export async function createEvidenceNote(tenant: ResearchTenant, input: {
  userId: string;
  literatureId?: string | null;
  citationSourceId?: string | null;
  claimRef?: string | null;
  rqRef?: string | null;
  pageOrParagraph?: string | null;
  researchPurpose?: string | null;
  noteText: string;
  readingLevel: "ABSTRACT_LEVEL" | "FULLTEXT_LEVEL";
  analyzedAt?: Date | null;
}): Promise<EvidenceNote> {
  return withClient(async (client) => {
    const noteText = input.noteText.trim().slice(0, 8000);
    if (!noteText) throw new EvidenceNoteRepositoryError("evidence_note_empty", 400);
    const id = `en_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const row = (await client.query(
      `INSERT INTO evidence_notes (id, workspace_id, project_id, literature_id, citation_source_id, claim_ref, rq_ref, page_or_paragraph, research_purpose, note_text, reading_level, analyzed_by_user_id, analyzed_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now(),now())
       RETURNING ${NOTE_COLUMNS}`,
      [id, tenant.workspaceId, tenant.projectId, input.literatureId ?? null, input.citationSourceId ?? null, input.claimRef ? String(input.claimRef).slice(0, 200) : null,
        input.rqRef ? String(input.rqRef).slice(0, 200) : null, input.pageOrParagraph ? String(input.pageOrParagraph).slice(0, 300) : null,
        input.researchPurpose ? String(input.researchPurpose).slice(0, 300) : null, noteText, input.readingLevel, input.userId, input.analyzedAt ?? null],
    )).rows[0] as Row;
    return rowToNote(row);
  });
}

export async function updateEvidenceNote(tenant: ResearchTenant, noteId: string, input: {
  userId: string;
  noteText?: string;
  researchPurpose?: string | null;
  readingLevel?: "ABSTRACT_LEVEL" | "FULLTEXT_LEVEL";
}): Promise<EvidenceNote | null> {
  return withClient(async (client) => {
    const sets: string[] = [];
    const params: unknown[] = [tenant.workspaceId, tenant.projectId, noteId]; // $1..$3
    let cursor = 4;
    if (input.noteText !== undefined) {
      const noteText = input.noteText.trim().slice(0, 8000);
      if (!noteText) throw new EvidenceNoteRepositoryError("evidence_note_empty", 400);
      params.push(noteText); sets.push(`note_text=$${cursor}`); cursor += 1;
    }
    if (input.researchPurpose !== undefined) { params.push(input.researchPurpose ? String(input.researchPurpose).slice(0, 300) : null); sets.push(`research_purpose=$${cursor}`); cursor += 1; }
    if (input.readingLevel !== undefined) { params.push(input.readingLevel); sets.push(`reading_level=$${cursor}`); cursor += 1; }
    if (!sets.length) throw new EvidenceNoteRepositoryError("evidence_note_no_changes", 400);
    params.push(input.userId);
    sets.push(`analyzed_by_user_id=$${cursor}`, "updated_at=now()");
    const result = await client.query(`UPDATE evidence_notes SET ${sets.join(", ")} WHERE ${tenantWhere()} AND id=$3 RETURNING ${NOTE_COLUMNS}`, params);
    const row = result.rows[0] as Row | undefined;
    return row ? rowToNote(row) : null;
  });
}

export async function deleteEvidenceNote(tenant: ResearchTenant, noteId: string, userId: string): Promise<boolean> {
  return withClient(async (client) => {
    const result = await client.query(`DELETE FROM evidence_notes WHERE ${tenantWhere()} AND id=$3 AND analyzed_by_user_id=$4`, [tenant.workspaceId, tenant.projectId, noteId, userId]);
    return (result.rowCount ?? 0) > 0;
  });
}
