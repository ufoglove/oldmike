import { NextResponse } from "next/server";
import { parseHorizonInput, parseHorizonResponse } from "@/lib/assist-contract";
import { horizonMessages } from "@/lib/assist-prompts";
import { callOpenClaw } from "@/lib/openclaw";
import { finalizeHorizon } from "@/lib/assist-finalize";
import { assistGatewayError, assistParseError, assistResponse, assistSourceBlocked, requireAssist } from "../_shared";

export async function POST(request: Request) {
  const required = await requireAssist(request);
  if (required instanceof NextResponse) return required;
  const parsed = parseHorizonInput(required.body);
  if (!parsed.ok) return NextResponse.json({ ok: false, code: "invalid_horizon_input", error: parsed.message }, { status: 400 });
  const result = await callOpenClaw(horizonMessages(parsed.value), "research-portal:assist:horizon", "M01_HORIZON");
  if (result.kind !== "success") return assistGatewayError(result);
  const data = parseHorizonResponse(result.content);
  if ("code" in data) return assistParseError(data.message);
  const finalized = await finalizeHorizon(data);
  return "kind" in finalized ? assistSourceBlocked(finalized.message) : assistResponse(finalized);
}
