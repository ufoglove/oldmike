import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { StageOperationRepository } from "@/lib/stage-operation-repository";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { requireAuthenticatedUser } from "@/lib/request-auth";

export const OUTCOME_MANAGEMENT_V3_EXPORT_CONTRACT_VERSION = "outcome-management-v3-export/1.0.0" as const;

/** GET /api/projects/:projectId/outcome-management-v3/export?format=json|markdown */
export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const format = request.nextUrl.searchParams.get("format") || "json";
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    let tenant;
    try {
      tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
    } catch (error) {
      if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, code: "STORAGE_UNAVAILABLE", error: "storage_unavailable" }, { status: 503 });
      throw error;
    }
    if (!tenant) return NextResponse.json({ ok: false, code: "PROJECT_FORBIDDEN", error: "forbidden" }, { status: 403 });

    const rec = await StageOperationRepository.getLatestCompletionSnapshot(tenant.workspaceId, projectId, "outcome-management").catch((e: unknown) => {
      if (e instanceof Error && /stage_operation_storage_unavailable/.test(e.message)) return null;
      throw e;
    });
    if (!rec?.snapshotData) return NextResponse.json({ ok: false, code: "NO_SNAPSHOT", error: "無 U20 outcome snapshot 可匯出。" }, { status: 409 });

    if (format !== "json" && format !== "markdown") {
      return NextResponse.json({ ok: false, code: "EXPORT_FORMAT_UNSUPPORTED", error: `不支援 ${format}；支援 json|markdown` }, { status: 422 });
    }
    const payload = format === "json" ? rec.snapshotData : objectToMarkdown(rec.snapshotData);
    const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    const digest = createHash("sha256").update(body).digest("hex");
    return NextResponse.json({ ok: true, data: { format, bytes: Buffer.byteLength(body), hash: digest, content: body, generatedAt: new Date().toISOString(), aclCheck: "需登入+project owner", note: "真實匯出附 bytes/hash；敏感內容依 ACL 水印限用。" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "UNKNOWN";
    return NextResponse.json({ ok: false, code: "EXPORT_FAILED", error: msg }, { status: 500 });
  }
}

function objectToMarkdown(o: unknown): string {
  const lines: string[] = [];
  const walk = (prefix: string, v: unknown): void => {
    if (v === null || v === undefined || typeof v === "string" || typeof v === "boolean" || typeof v === "number") { lines.push(`- ${prefix}: ${String(v)}`); return; }
    if (Array.isArray(v)) { if (v.length === 0) { lines.push(`- ${prefix}: []`); return; } v.forEach((x, i) => walk(`${prefix}[${i}]`, x)); return; }
    if (typeof v === "object") { const e = v as Record<string, unknown>; for (const k of Object.keys(e)) walk(`${prefix}.${k}`, e[k]); return; }
  };
  walk("om", o);
  return lines.join("\n");
}
