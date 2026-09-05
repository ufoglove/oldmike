import { NextResponse } from "next/server";
import { callOpenClaw, type OpenClawCallResult } from "@/lib/openclaw";
import { requireAuthenticatedUser } from "@/lib/request-auth";

export async function readAssistBody(request: Request): Promise<unknown | NextResponse> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 250000) return NextResponse.json({ ok: false, code: "request_too_large", error: "助理請求超過大小限制" }, { status: 413 });
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > 250000) return NextResponse.json({ ok: false, code: "invalid_body", error: "助理請求格式不正確" }, { status: 400 });
  try { return JSON.parse(raw) as unknown; } catch { return NextResponse.json({ ok: false, code: "invalid_json", error: "助理請求不是有效 JSON" }, { status: 400 }); }
}

export async function requireAssist(request: Request): Promise<{ body: unknown; userId: string } | NextResponse> {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const body = await readAssistBody(request);
  return body instanceof NextResponse ? body : { body, userId: authenticated.session.user.id };
}

export function assistGatewayError(result: OpenClawCallResult) {
  if (result.kind === "not-configured") return NextResponse.json({ ok: false, code: "gateway_not_configured", error: "目前尚未連接老麥；未產生假推薦或假證據。" }, { status: 503 });
  if (result.kind === "invalid-config") return NextResponse.json({ ok: false, code: "gateway_invalid_config", error: "安全設定錯誤：老麥服務必須使用私有網路位址。" }, { status: 500 });
  return NextResponse.json({ ok: false, code: "gateway_unavailable", error: "老麥目前無法完成查證；未產生假成功。" }, { status: 502 });
}

export function assistResponse(data: unknown) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (process.env.PORTAL_TEST_FIXTURE === "1") headers.set("X-Portal-Data-Status", "TEST_FIXTURE");
  return NextResponse.json({ ok: true, data }, { headers });
}
export function assistSourceBlocked(message: string) { return NextResponse.json({ ok: false, code: "source_verification_blocked", mode: "BLOCKED", error: message }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
export function assistParseError(message: string) { return NextResponse.json({ ok: false, code: "invalid_assist_response", error: message }, { status: 502 }); }
