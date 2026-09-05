import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { EvidenceNoteRepositoryError, createEvidenceNote, deleteEvidenceNote, listEvidenceNotes, updateEvidenceNote } from "@/lib/evidence-note-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 32_000) return null;
  const body = await request.text();
  if (!body || Buffer.byteLength(body, "utf8") > 32_000) return null;
  try { return JSON.parse(body) as unknown; } catch { return null; }
}
const textOr = (value: unknown, max: number): string | null => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const readingLevel = (value: unknown): "ABSTRACT_LEVEL" | "FULLTEXT_LEVEL" => (value === "FULLTEXT_LEVEL" ? "FULLTEXT_LEVEL" : "ABSTRACT_LEVEL");

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  try {
    const tenant = await resolveResearchTenant(auth.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "project_not_found" }, 404);
    const url = new URL(request.url);
    const literatureId = url.searchParams.get("literatureId") ?? undefined;
    const notes = await listEvidenceNotes(tenant, { literatureId, limit: Number(url.searchParams.get("limit") ?? "50") || 50 });
    return json({ ok: true, notes });
  } catch (error) {
    if (error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "evidence_notes_unavailable" }, 503);
    return json({ ok: false, code: "evidence_notes_list_failed", error: "Evidence Notes 讀取失敗。" }, 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const { projectId } = await context.params;
  const body = await readBody(request);
  if (!record(body) || typeof body.action !== "string") return json({ ok: false, code: "invalid_evidence_note_request" }, 400);
  try {
    const tenant = await resolveResearchTenant(auth.session.user.id, projectId);
    if (!tenant) return json({ ok: false, code: "project_not_found" }, 404);
    const userId = auth.session.user.id;
    switch (body.action) {
      case "create": {
        const noteText = typeof body.noteText === "string" ? body.noteText : "";
        if (!noteText.trim()) return json({ ok: false, code: "evidence_note_empty", error: "筆記內容不能為空。" }, 400);
        const note = await createEvidenceNote(tenant, {
          userId,
          literatureId: textOr(body.literatureId, 200),
          citationSourceId: textOr(body.citationSourceId, 200),
          claimRef: textOr(body.claimRef, 200),
          rqRef: textOr(body.rqRef, 200),
          pageOrParagraph: textOr(body.pageOrParagraph, 300),
          researchPurpose: textOr(body.researchPurpose, 300),
          noteText,
          readingLevel: readingLevel(body.readingLevel),
        });
        return json({ ok: true, note }, 201);
      }
      case "update": {
        const noteId = textOr(body.noteId, 200);
        if (!noteId) return json({ ok: false, code: "invalid_note_id" }, 400);
        const note = await updateEvidenceNote(tenant, noteId, { userId, noteText: body.noteText !== undefined ? String(body.noteText) : undefined, researchPurpose: body.researchPurpose === null || body.researchPurpose === undefined ? (body.researchPurpose === null ? null : undefined) : String(body.researchPurpose), readingLevel: body.readingLevel === undefined ? undefined : readingLevel(body.readingLevel) });
        if (!note) return json({ ok: false, code: "evidence_note_not_found", error: "找不到可更新的筆記（僅限自己的筆記）。" }, 404);
        return json({ ok: true, note });
      }
      case "delete": {
        const noteId = textOr(body.noteId, 200);
        if (!noteId) return json({ ok: false, code: "invalid_note_id" }, 400);
        const removed = await deleteEvidenceNote(tenant, noteId, userId);
        if (!removed) return json({ ok: false, code: "evidence_note_not_found", error: "找不到可刪除的筆記（僅限自己的筆記）。" }, 404);
        return json({ ok: true, removed: true, noteId });
      }
      default:
        return json({ ok: false, code: "invalid_evidence_note_action" }, 422);
    }
  } catch (error) {
    if (error instanceof EvidenceNoteRepositoryError) return json({ ok: false, code: error.code, error: error.message }, error.status);
    if (error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "evidence_notes_unavailable" }, 503);
    return json({ ok: false, code: "evidence_note_failed", error: "Evidence Note 操作失敗。" }, 500);
  }
}
