import { NextResponse } from "next/server";
import { isCanonicalDomainValue } from "@/lib/assist-contract";
import { parseEvidenceResponse } from "@/lib/assist-contract";
import { evidenceMessages } from "@/lib/assist-prompts";
import { callOpenClaw } from "@/lib/openclaw";
import { finalizeEvidence } from "@/lib/assist-finalize";
import { assistGatewayError, assistParseError, assistResponse, assistSourceBlocked, requireAssist } from "../_shared";

export async function POST(request: Request) {
  const required = await requireAssist(request);
  if (required instanceof NextResponse) return required;
  const body = required.body && typeof required.body === "object" && !Array.isArray(required.body) ? required.body as Record<string, unknown> : null;
  const domain = body?.domain; const direction = typeof body?.direction === "string" ? body.direction.trim() : ""; const months = body?.months; const keywords = body?.keywords;
  if (!isCanonicalDomainValue(domain) || !direction || direction.length > 1000 || typeof months !== "number" || months < 24 || months > 36 || !Array.isArray(keywords) || keywords.length > 12 || keywords.some((item) => typeof item !== "string" || item.length > 100)) return NextResponse.json({ ok: false, code: "invalid_evidence_input", error: "證據查詢條件不正確" }, { status: 400 });
  const result = await callOpenClaw(evidenceMessages({ domain, direction, months, keywords }), "research-portal:assist:evidence", "M01_EVIDENCE");
  if (result.kind !== "success") return assistGatewayError(result);
  const data = parseEvidenceResponse(result.content);
  if ("code" in data) return assistParseError(data.message);
  const finalized = await finalizeEvidence(data);
  return "kind" in finalized ? assistSourceBlocked(finalized.message) : assistResponse(finalized);
}
