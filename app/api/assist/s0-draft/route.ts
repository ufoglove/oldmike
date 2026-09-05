import { NextResponse } from "next/server";
import { parseS0DraftInput } from "@/lib/assist-contract";
import { s0DraftMessages } from "@/lib/assist-prompts";
import { callOpenClaw, type OpenClawCallResult } from "@/lib/openclaw";
import { composeCandidateIntake, runS0Composer, type S0CandidateInput } from "@/lib/s0-composer";
import { S0_FIELD_NAMES, isS0FieldName } from "@/lib/s0-fields";
import { assistGatewayError, assistResponse, requireAssist } from "../_shared";

export async function POST(request: Request) {
  const required = await requireAssist(request);
  if (required instanceof NextResponse) return required;
  const body = required.body && typeof required.body === "object" && !Array.isArray(required.body) ? required.body as Record<string, unknown> : null;
  const normalized = parseS0DraftInput(body?.intake);
  if (!normalized.ok) return NextResponse.json({ ok: false, code: "invalid_s0_draft_input", error: normalized.message }, { status: 400 });
  if (!normalized.value.domain || !normalized.value.outputTrack) return NextResponse.json({ ok: false, code: "invalid_s0_draft_input", error: "S0 草稿缺少研究領域或成果路徑" }, { status: 400 });
  const candidate = body?.candidate && typeof body.candidate === "object" && !Array.isArray(body.candidate) ? body.candidate as S0CandidateInput : undefined;
  const requestedUserFields = Array.isArray(body?.userProvidedFields) && body.userProvidedFields.length <= S0_FIELD_NAMES.length && body.userProvidedFields.every(isS0FieldName)
    ? [...new Set(body.userProvidedFields)]
    : S0_FIELD_NAMES.filter((field) => Boolean(normalized.value[field]));
  const composed = composeCandidateIntake({
    currentIntake: normalized.value,
    candidate,
    selectedDomain: normalized.value.domain,
    selectedOutputTrack: normalized.value.outputTrack,
    userProvidedFields: requestedUserFields,
  });
  let gatewayFailure: Exclude<OpenClawCallResult, { kind: "success" }> | null = null;
  let result;
  try {
    result = await runS0Composer({
      intake: composed.intake,
      fieldStatus: composed.fieldStatus,
      candidate,
      invoke: async ({ intake, candidate: selectedCandidate, targetFields }) => {
        const upstream = await callOpenClaw(s0DraftMessages(intake, selectedCandidate, targetFields), "research-portal:assist:s0-draft", "M01_S0_DRAFT");
        if (upstream.kind !== "success") {
          gatewayFailure = upstream;
          throw new Error("s0_gateway_failed");
        }
        return upstream.content;
      },
    });
  } catch {
    if (gatewayFailure) return assistGatewayError(gatewayFailure);
    return NextResponse.json({ ok: false, code: "s0_composer_failed", error: "老麥目前無法建立可審查的 S0 草稿" }, { status: 502 });
  }
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      code: result.code,
      error: "老麥回覆未通過 S0 草稿契約檢查",
      parserStage: result.stage,
      parserStages: result.bitmap,
      upstreamCount: result.upstreamCount,
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  return assistResponse({ status: "success", mode: "AI_PROPOSED", ...result });
}
