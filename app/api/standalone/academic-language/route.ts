import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  parseStandaloneTransformBody,
  runStandaloneAcademicLanguage,
  standalonePublicError,
} from "@/lib/standalone-academic-language";
import { AcademicLanguageContractError } from "@/lib/academic-language-contract";
import { logError } from "@/lib/server-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const authenticated = await requireAuthenticatedUser();
    if (!authenticated.ok) return authenticated.response;
    const limited = await guardSensitiveAuthRateLimit({ scope: "standalone-academic-language:transform", identifier: authenticated.session.user.id, windowSeconds: 600, max: 12 });
    if (limited) return limited;
    const length = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(length) && length > 65_536) return json({ ok: false, code: "request_too_large", error: "內容過大。" }, 413);
    const text = await request.text();
    if (!text || Buffer.byteLength(text, "utf8") > 65_536) return json({ ok: false, code: text ? "request_too_large" : "invalid_request_body", error: text ? "內容過大。" : "要求內容無效。" }, text ? 413 : 400);
    let parsed: ReturnType<typeof parseStandaloneTransformBody>;
    try { parsed = parseStandaloneTransformBody(JSON.parse(text) as unknown); }
    catch (error) {
      if (error instanceof AcademicLanguageContractError) return json({ ok: false, code: error.code, error: `要求未通過老麥的固定資料契約（${error.code}）。` }, error.status ?? 400);
      return json({ ok: false, code: "invalid_json", error: "要求內容不是有效的 JSON。" }, 400);
    }
    const result = await runStandaloneAcademicLanguage({ userId: authenticated.session.user.id, body: parsed });
    return json({ ok: true, scratch: result });
  } catch (error) {
    const fallback = standalonePublicError(error);
    // 使用者要求不合規（例如不支援的引擎/任務）→ 400；設定層 → 503；其餘引擎/保全層 → 502
    const status = fallback.code === "deepl_task_not_supported" || fallback.code.startsWith("invalid_") || fallback.code === "unsupported_academic_language_operation"
      ? 400
      : (fallback.code === "standalone_language_unavailable" || fallback.code === "language_service_not_ready" ? 503 : 502);
    if (status >= 500) logError("standalone_language_route", error, { code: fallback.code, status });
    return json(fallback, status);
  }
}

export async function GET() {
  return json({ ok: true, mode: "standalone", note: "獨立翻譯與學術潤稿：不需研究專案；以 POST 傳送 STANDALONE_TRANSFORM。" });
}
