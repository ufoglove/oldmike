import { NextResponse } from "next/server";
import { parseQuickStartInput } from "@/lib/assist-contract";
import { parseTopicLabRequest, TopicLabContractError, type TopicLabAnalyzeRequest } from "@/lib/topic-lab-contract";
import { executeTopicLabAnalysis } from "@/lib/topic-lab-service";
import { TopicLabGenerationError } from "@/lib/topic-lab-service";
import { TopicLabSourceProviderError } from "@/lib/topic-lab-source-provider";
import { normalizeResearchStartStageARequest, normalizeResearchStartStageBRequest, ResearchStartTwoStageContractError } from "@/lib/research-start-two-stage-contract";
import { executeResearchStartStageA, executeResearchStartStageB, ResearchStartTwoStageError } from "@/lib/research-start-two-stage-service";
import { requireAssist } from "../_shared";

function dateWindow(now = new Date()) {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth(), now.getUTCDate()));
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function compatibilityRequest(value: unknown): TopicLabAnalyzeRequest {
  try {
    const parsed = parseTopicLabRequest(value);
    if (parsed.operation !== "ANALYZE") throw new TopicLabContractError("preproject_topic_lab_analyze_only", 422);
    return parsed;
  } catch (error) {
    if (!(error instanceof TopicLabContractError)) throw error;
    const quick = parseQuickStartInput(value);
    if (!quick.ok) throw error;
    return parseTopicLabRequest({
      operation: "ANALYZE",
      idempotencyKey: `topic-draft:${crypto.randomUUID()}`,
      researchDirection: quick.value.direction,
      advanced: { domain: quick.value.domain, outputTrack: quick.value.outputTrack, population: quick.value.setting || "", context: quick.value.setting || "", method: "", data: quick.value.availableData || "", timeline: quick.value.timeline || "", ethics: "" },
      evidenceWindow: dateWindow(),
      sourceStrategy: "NONE",
      sourceUrls: [],
    }) as TopicLabAnalyzeRequest;
  }
}

export async function POST(request: Request) {
  const required = await requireAssist(request);
  if (required instanceof NextResponse) return required;
  try {
    const operation = required.body && typeof required.body === "object" && !Array.isArray(required.body) && "operation" in required.body
      ? (required.body as { operation?: unknown }).operation
      : undefined;
    if (operation === "GENERATE_DIRECTIONS") {
      const parsed = normalizeResearchStartStageARequest(required.body);
      const executed = await executeResearchStartStageA(parsed, { scope: required.userId, signal: request.signal });
      return NextResponse.json({ ok: true, persistence: "NONE", ...executed }, { headers: { "Cache-Control": "no-store" } });
    }
    if (operation === "EXPAND_SELECTED_S0") {
      const parsed = normalizeResearchStartStageBRequest(required.body);
      const executed = await executeResearchStartStageB(parsed, { scope: required.userId, signal: request.signal });
      return NextResponse.json({ ok: true, persistence: "NONE", ...executed }, { headers: { "Cache-Control": "no-store" } });
    }
    const parsed = compatibilityRequest(required.body);
    const executed = await executeTopicLabAnalysis(parsed, { signal: request.signal });
    return NextResponse.json({ ok: true, draft: true, persistence: "NONE", sourceCapability: executed.sourceCapability, providerStates: executed.providerStates, providerSubmissionCount: executed.providerSubmissionCount, analysis: executed.analysis }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ResearchStartTwoStageError) return NextResponse.json({ ok: false, code: error.code, stage: error.stage, completionClass: error.completionClass, providerAttemptClass: error.providerAttemptClass, providerSubmissionCount: error.providerSubmissionCount, recoverableFields: error.recoverableFields, error: `老麥研究啟動未完成（${error.stage}）；已保留目前輸入與完成階段。` }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    if (error instanceof ResearchStartTwoStageContractError) return NextResponse.json({ ok: false, code: error.code, stage: "AUTH_VALIDATE", completionClass: "PROVEN_NOT_SUBMITTED", providerAttemptClass: "NOT_SUBMITTED", providerSubmissionCount: 0, recoverableFields: error.recoverableFields, error: "研究啟動請求未通過固定資料契約；尚未送出老麥請求。" }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    if (error instanceof TopicLabGenerationError) return NextResponse.json({ ok: false, code: error.code, stage: error.stage, reasonEnum: error.reasonEnum, elapsedBucket: error.elapsedBucket, providerAttemptClass: error.providerAttemptClass, recoverableFields: error.recoverableFields, error: `老麥研究方案未完成（${error.stage}）；目前輸入已保留。` }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    if (error instanceof TopicLabContractError) return NextResponse.json({ ok: false, code: error.code, error: "選題草稿未通過固定資料契約。" }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    if (error instanceof TopicLabSourceProviderError) return NextResponse.json({ ok: false, code: error.code, error: "公開來源未通過受控讀取政策。" }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: false, code: "topic_lab_draft_unavailable", error: "老麥目前無法建立選題草稿。" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
