import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import {
  ACADEMIC_LANGUAGE_MAX_BODY_BYTES,
  AcademicLanguageContractError,
  academicLanguageHash,
  academicLanguageRequestHash,
  parseAcademicLanguageRequest,
} from "@/lib/academic-language-contract";
import { AcademicLanguageProviderError, transformAcademicLanguage } from "@/lib/academic-language-provider";
import { ModelRouteContractError, resolveModelRoute } from "@/lib/model-route-catalog";
import {
  AcademicLanguageRepositoryError,
  AcademicLanguageStorageUnavailable,
  approveLanguageDocument,
  getAcademicLanguageOverview,
  loadBoundGlossary,
  promoteLanguageDocument,
  replayLanguageRun,
  saveGlossaryVersion,
  saveLanguageRun,
} from "@/lib/academic-language-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > ACADEMIC_LANGUAGE_MAX_BODY_BYTES) throw new AcademicLanguageContractError("request_too_large", 413);
  const text = await request.text();
  if (!text || Buffer.byteLength(text, "utf8") > ACADEMIC_LANGUAGE_MAX_BODY_BYTES) throw new AcademicLanguageContractError(text ? "request_too_large" : "invalid_request_body", text ? 413 : 400);
  try { return JSON.parse(text) as unknown; } catch { throw new AcademicLanguageContractError("invalid_json", 400); }
}

function schemaUnavailable(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string" ? String((error as { code: string }).code) : "";
  return code === "42P01" || code === "42703" || code === "3D000";
}

function publicError(error: unknown) {
  if (error instanceof AcademicLanguageContractError) return json({ ok: false, code: error.code, error: "學術語言要求未通過老麥的固定資料契約。" }, error.status);
  if (error instanceof AcademicLanguageProviderError) return json({ ok: false, code: error.code, error: "老麥目前無法安全完成這項語言處理；原文未被覆寫。" }, error.status);
  if (error instanceof ModelRouteContractError) return json({ ok: false, code: error.code, error: "所選老麥模式目前不可用；原文未被覆寫。" }, error.status);
  if (error instanceof AcademicLanguageRepositoryError) return json({ ok: false, code: error.code, error: "操作未通過專案、版本或人工核准契約。" }, error.status);
  if (error instanceof AcademicLanguageStorageUnavailable || error instanceof ResearchStorageUnavailable || schemaUnavailable(error)) return json({ ok: false, code: "academic_language_storage_unavailable", error: "專案語言版本資料目前不可用；原文未被覆寫。" }, 503);
  return json({ ok: false, code: "academic_language_unavailable", error: "老麥目前無法完成這項操作；原文未被覆寫。" }, 503);
}

async function authorize(projectId: string) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return { response: authenticated.response } as const;
  const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
  if (!tenant) return { response: json({ ok: false, code: "academic_language_not_found" }, 404) } as const;
  return { authenticated, tenant } as const;
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const authorized = await authorize(projectId);
    if ("response" in authorized) return authorized.response;
    return json({ ok: true, workspace: await getAcademicLanguageOverview(authorized.tenant) });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authorized = await authorize(projectId);
    if ("response" in authorized) return authorized.response;
    const parsed = parseAcademicLanguageRequest(await readBody(request));
    const limited = await guardSensitiveAuthRateLimit({ scope: `academic-language:${parsed.operation}`, identifier: `${authorized.authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: parsed.operation === "TRANSFORM" || parsed.operation === "SCRATCH_TRANSFORM" ? 12 : 30 });
    if (limited) return limited;

    if (parsed.operation === "SAVE_GLOSSARY") {
      const glossary = await saveGlossaryVersion({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed });
      return json({ ok: true, glossary }, glossary.idempotent ? 200 : 201);
    }
    if (parsed.operation === "TRANSFORM") {
      const replay = await replayLanguageRun(authorized.tenant, parsed.idempotencyKey, academicLanguageRequestHash(parsed));
      if (replay) return json({ ok: true, document: replay });
      const glossary = parsed.glossaryVersionId && parsed.glossaryHash ? await loadBoundGlossary(authorized.tenant, parsed.glossaryVersionId, parsed.glossaryHash) : null;
      const route = resolveModelRoute({ modeProfile: parsed.modeProfile, operation: "ACADEMIC_LANGUAGE" });
      const result = await transformAcademicLanguage({ request: parsed, glossary, actorId: authorized.authenticated.session.user.id, route });
      const saved = await saveLanguageRun({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed, result });
      return json({ ok: true, document: saved }, saved.idempotent ? 200 : 201);
    }
    if (parsed.operation === "SCRATCH_TRANSFORM") {
      const glossary = parsed.glossaryVersionId && parsed.glossaryHash ? await loadBoundGlossary(authorized.tenant, parsed.glossaryVersionId, parsed.glossaryHash) : null;
      const route = resolveModelRoute({ modeProfile: parsed.modeProfile, operation: "ACADEMIC_LANGUAGE" });
      const result = await transformAcademicLanguage({ request: parsed, glossary, actorId: authorized.authenticated.session.user.id, route });
      return json({
        ok: true,
        scratch: {
          ...result,
          sourceHash: academicLanguageHash(parsed.sourceText),
          resultHash: academicLanguageHash(result),
          persistence: "NONE",
          humanGate: "NOT_APPLICABLE",
        },
      });
    }
    if (parsed.operation === "APPROVE_DOCUMENT") {
      const approval = await approveLanguageDocument({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, idempotencyKey: parsed.idempotencyKey, documentVersionId: parsed.documentVersionId, contentHash: parsed.contentHash, rationale: parsed.rationale });
      return json({ ok: true, approval }, approval.idempotent ? 200 : 201);
    }
    const promotion = await promoteLanguageDocument({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed });
    return json({ ok: true, promotion }, promotion.idempotent ? 200 : 201);
  } catch (error) {
    return publicError(error);
  }
}
