import "server-only";

import { NextResponse } from "next/server";
import { requireAssist } from "../_shared";
import { parseTopicValidationRequest, TopicValidationContractError } from "@/lib/research-topic-validation-contract";
import { executeTopicValidation, TopicValidationError } from "@/lib/research-topic-validation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const required = await requireAssist(request);
  if (required instanceof NextResponse) return required;
  try {
    const parsed = parseTopicValidationRequest(required.body);
    const result = await executeTopicValidation(parsed, { signal: request.signal });
    return NextResponse.json({ ok: true, persistence: "NONE", ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TopicValidationContractError) {
      return NextResponse.json({ ok: false, code: error.code, error: "題目驗證要求未通過固定資料契約。" }, { status: error.status });
    }
    if (error instanceof TopicValidationError) {
      return NextResponse.json({ ok: false, code: error.code, stage: error.stage, recoverableFields: error.recoverableFields, error: `題目驗證未完成（${error.stage}）；尚未產生任何驗證判斷。` }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "topic_validation_unavailable", error: "老麥目前無法完成題目驗證。" }, { status: 503 });
  }
}
