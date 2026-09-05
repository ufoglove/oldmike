import { NextResponse } from "next/server";
import { parseOldMikeAssistRequest } from "@/lib/old-mike-assist-contract";
import { executeOldMikeAssist } from "@/lib/old-mike-assist-server";
import { sha256Canonical } from "@/lib/research-contract";
import { assistGatewayError, assistResponse, requireAssist } from "../_shared";

export async function POST(request: Request) {
  const required = await requireAssist(request);
  if (required instanceof NextResponse) return required;
  const parsed = parseOldMikeAssistRequest(required.body, "PRE_PROJECT");
  if (!parsed.ok) return NextResponse.json({ ok: false, code: parsed.code, error: "S0 老麥協助請求未通過固定欄位契約。" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const contextHash = sha256Canonical({ scope: "PRE_PROJECT", surface: parsed.value.surface, targetKind: parsed.value.targetKind, schemaId: parsed.value.schemaId, sourceHash: parsed.value.sourceHash });
  const userScope = sha256Canonical({ scope: "PRE_PROJECT", userId: required.userId });
  const result = await executeOldMikeAssist({ request: parsed.value, context: { scope: "PRE_PROJECT", formalProjectContext: false, snapshot: parsed.value.contextSnapshot }, contextHash, sessionKey: `assist:${userScope.slice(0, 32)}`, signal: request.signal });
  if (result.kind === "gateway-failed") return assistGatewayError(result.failure);
  if (result.kind === "parse-failed") return NextResponse.json({ ok: false, code: result.code, stage: "ASSIST_RESPONSE_CONTRACT", recoverableFields: [parsed.value.schemaId], error: `老麥建議未通過 ASSIST_RESPONSE_CONTRACT（${result.code}）；目前輸入已保留。` }, { status: 502, headers: { "Cache-Control": "no-store" } });
  return assistResponse(result.value);
}
