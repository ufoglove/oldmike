import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { callOpenClaw, isPrivateGatewayUrl } from "@/lib/openclaw";
import { webResearchEnabled } from "@/lib/outbound-research-policy";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { readPublicWebContent, WebContentReaderError } from "@/lib/web-content-reader";
import {
  buildWebResearchMessages,
  parseWebResearchAnalysis,
  parseWebResearchInput,
  WEB_RESEARCH_MAX_REQUEST_BYTES,
  WebResearchContractError,
  webResearchResponseData,
} from "@/lib/web-research-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body: Record<string, unknown>, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

async function readJsonBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > WEB_RESEARCH_MAX_REQUEST_BYTES) {
    throw new WebResearchContractError("invalid_web_research_input", 413);
  }
  if (!request.body) throw new WebResearchContractError("invalid_web_research_input", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    if (!item.value?.byteLength) continue;
    total += item.value.byteLength;
    if (total > WEB_RESEARCH_MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new WebResearchContractError("invalid_web_research_input", 413);
    }
    chunks.push(item.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total).toString("utf8")) as unknown;
  } catch {
    throw new WebResearchContractError("invalid_web_research_input", 400);
  }
}

function gatewayPreflight() {
  const baseUrl = process.env.OPENCLAW_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl || !process.env.OPENCLAW_GATEWAY_TOKEN) {
    return noStoreJson({ ok: false, code: "gateway_not_configured", error: "老麥研究分析服務尚未完成設定。" }, 503);
  }
  if (!isPrivateGatewayUrl(baseUrl)) {
    return noStoreJson({ ok: false, code: "gateway_invalid_config", error: "老麥研究分析服務設定不符合私有連線政策。" }, 500);
  }
  return null;
}

export async function POST(request: Request) {
  if (!webResearchEnabled()) {
    return noStoreJson({ ok: false, code: "web_research_disabled", error: "公開網站研究預覽目前未啟用。" }, 503);
  }
  if (!originAllowed(request)) {
    return noStoreJson({ ok: false, code: "origin_rejected", error: "Request origin was rejected." }, 403);
  }

  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;

  let input;
  try {
    input = parseWebResearchInput(await readJsonBody(request));
  } catch (error) {
    if (error instanceof WebResearchContractError) {
      const code = error.status === 413 ? "request_too_large" : error.code;
      return noStoreJson({ ok: false, code, error: "公開網站研究請求格式不正確。" }, error.status);
    }
    return noStoreJson({ ok: false, code: "invalid_json", error: "公開網站研究請求不是有效 JSON。" }, 400);
  }

  const limited = await guardSensitiveAuthRateLimit({
    scope: "assist-web-preview",
    identifier: authenticated.session.user.id,
    windowSeconds: 600,
    max: 10,
  });
  if (limited) return limited;

  const unavailable = gatewayPreflight();
  if (unavailable) return unavailable;

  let source;
  try {
    source = await readPublicWebContent(input.url);
  } catch (error) {
    if (error instanceof WebContentReaderError) {
      return noStoreJson({ ok: false, code: error.code, error: "無法安全讀取指定的公開網站內容。" }, error.status);
    }
    return noStoreJson({ ok: false, code: "web_source_unavailable", error: "無法安全讀取指定的公開網站內容。" }, 502);
  }

  const pseudonymousUser = createHash("sha256").update(authenticated.session.user.id).digest("hex").slice(0, 32);
  const result = await callOpenClaw(
    buildWebResearchMessages(input, source),
    `research-portal:web-preview:${pseudonymousUser}:${randomUUID()}`,
    "M01_WEB_PREVIEW",
  );
  if (result.kind === "not-configured") {
    return noStoreJson({ ok: false, code: "gateway_not_configured", error: "老麥研究分析服務尚未完成設定。" }, 503);
  }
  if (result.kind === "invalid-config") {
    return noStoreJson({ ok: false, code: "gateway_invalid_config", error: "老麥研究分析服務設定不符合私有連線政策。" }, 500);
  }
  if (result.kind !== "success") {
    return noStoreJson({ ok: false, code: "gateway_unavailable", error: "老麥目前無法完成公開內容分析。" }, 502);
  }

  try {
    const analysis = parseWebResearchAnalysis(result.content);
    return noStoreJson({ ok: true, data: webResearchResponseData(source, analysis) }, 200);
  } catch (error) {
    if (error instanceof WebResearchContractError) {
      return noStoreJson({ ok: false, code: error.code, error: "老麥回應未通過固定輸出契約。" }, error.status);
    }
    return noStoreJson({ ok: false, code: "invalid_web_research_response", error: "老麥回應未通過固定輸出契約。" }, 502);
  }
}
