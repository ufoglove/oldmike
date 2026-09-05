import "server-only";

import { ServerOnlyTaskGateway, assertContinuation, type TaskAdapterResult, type TaskProviderAdapter } from "./task-gateway.ts";
import { TASK_GATEWAY_CONTRACT_VERSION, taskGatewayHash, type SanitizedExecutionReceipt, type TaskEnvelope, type TaskHumanGate } from "./task-gateway-contract.ts";

const fixtureRetrievedAt = "2026-08-23T00:00:00.000Z";

function topicOutput(envelope: TaskEnvelope) {
  if (envelope.payload.kind !== "TOPIC_KEYWORDS") throw new Error("mock_payload_mismatch");
  const subject = envelope.payload.keywords.join("、");
  const candidates = [
    { lane: "CURRENT_HOT", title: `${subject}的現況差異與可測量成效`, evidenceLabel: "FIXTURE_ONLY_UNVERIFIED", confidence: "LOW", sampleSize: 3, observationWindow: envelope.payload.observationWindow, retrievedAt: fixtureRetrievedAt, unsupportedBigDataClaim: false },
    { lane: "EMERGING", title: `${subject}的早期訊號、機制與時間順序`, evidenceLabel: "FIXTURE_ONLY_UNVERIFIED", confidence: "LOW", sampleSize: 3, observationWindow: envelope.payload.observationWindow, retrievedAt: fixtureRetrievedAt, unsupportedBigDataClaim: false },
    { lane: "OPTIONAL_CONTRARIAN_GAP", title: `${subject}的失效條件與異質性`, evidenceLabel: "FIXTURE_ONLY_UNVERIFIED", confidence: "LOW", sampleSize: 3, observationWindow: envelope.payload.observationWindow, retrievedAt: fixtureRetrievedAt, unsupportedBigDataClaim: false },
  ].map((candidate) => ({ ...candidate, candidateHash: taskGatewayHash(candidate) }));
  return { status: "老麥建議・尚未驗證", sourceMode: "LOCAL_FIXTURE_ONLY", candidateCount: 3, candidates, nextAction: "REQUIRE_RESEARCH_DIRECTION_HUMAN_GATE" };
}

function draftOutput(envelope: TaskEnvelope) {
  if (envelope.payload.kind !== "PAPER_DRAFT_STAGE") throw new Error("mock_payload_mismatch");
  const stages = {
    OUTLINE: { stage: "OUTLINE", sections: ["研究問題", "理論與機制", "方法與倫理", "證據限制"], nextAction: "REQUIRE_METHOD_AND_ETHICS_HUMAN_GATE" },
    METHOD_PLAN: { stage: "METHOD_PLAN", sections: ["研究設計候選", "最小資料需求", "偏誤與倫理風險", "分析前提"], nextAction: "REQUIRE_EVIDENCE_AND_CLAIMS_HUMAN_GATE" },
    EVIDENCE_LEDGER: { stage: "EVIDENCE_LEDGER", sections: ["主張", "證據狀態", "反證與未知", "引用占位"], nextAction: "REQUIRE_DOCUMENT_RELEASE_HUMAN_GATE" },
    DOCUMENT_DRAFT: { stage: "DOCUMENT_DRAFT", sections: ["尚未授權建立正式版本"], nextAction: "BLOCKED_FORMAL_PROMOTION_REQUIRED" },
  } as const;
  return { status: "老麥建議・尚未驗證", formalRecordMutation: "NONE", submission: "NOT_EXECUTED", unsupportedBigDataClaim: false, ...stages[envelope.payload.stage] };
}

const stageGates: Record<string, TaskHumanGate> = {
  TOPIC_GOLDEN_PATH: "RESEARCH_DIRECTION",
  OUTLINE: "METHOD_AND_ETHICS",
  METHOD_PLAN: "EVIDENCE_AND_CLAIMS",
  EVIDENCE_LEDGER: "DOCUMENT_RELEASE",
};

export class GoldenPathMockAdapter implements TaskProviderAdapter {
  readonly adapterKind = "LOCAL_MOCK" as const;
  readonly supportedOperations = ["TOPIC_GOLDEN_PATH", "PAPER_DRAFT_STAGE"] as const;

  async execute(envelope: TaskEnvelope, signal: AbortSignal): Promise<TaskAdapterResult> {
    if (signal.aborted) throw new Error("mock_canceled");
    const output = envelope.operation === "TOPIC_GOLDEN_PATH" ? topicOutput(envelope) : draftOutput(envelope);
    const key = envelope.operation === "TOPIC_GOLDEN_PATH" ? envelope.operation : envelope.payload.kind === "PAPER_DRAFT_STAGE" ? envelope.payload.stage : "";
    const humanGate = stageGates[key] ?? null;
    return { status: humanGate ? "WAITING_HUMAN" : "MOCK_COMPLETE", output, outputHash: taskGatewayHash(output), humanGate, dataEgress: "NONE" };
  }
}

type GoldenPathInput = {
  actionId: string;
  tenantId: string;
  projectId: string;
  keywords: string[];
  observationWindow: { from: string; to: string };
  approvedGates: TaskHumanGate[];
  createdAt: string;
};

export type GoldenPathTrace = {
  mode: "LOCAL_MOCK_ONLY";
  receipts: SanitizedExecutionReceipt[];
  outputs: unknown[];
  finalState: "WAITING_HUMAN";
  finalGate: TaskHumanGate;
  formalRecordMutations: 0;
  submissions: 0;
};

function baseEnvelope(input: GoldenPathInput): TaskEnvelope {
  return {
    contractVersion: TASK_GATEWAY_CONTRACT_VERSION,
    actionId: input.actionId,
    taskId: `${input.actionId}:topic`,
    tenantId: input.tenantId,
    projectId: input.projectId,
    operation: "TOPIC_GOLDEN_PATH",
    idempotencyKey: `${input.actionId}:topic-keywords`,
    createdAt: input.createdAt,
    payload: { kind: "TOPIC_KEYWORDS", keywords: input.keywords, observationWindow: input.observationWindow },
    skillIds: ["scientific-brainstorming", "scientific-critical-thinking"],
    toolIds: ["FIXTURE_SCHOLARLY_METADATA"],
    continuation: null,
  };
}

const continuationStages = ["OUTLINE", "METHOD_PLAN", "EVIDENCE_LEDGER"] as const;

export async function runMockGoldenPath(input: GoldenPathInput): Promise<GoldenPathTrace> {
  const gateway = new ServerOnlyTaskGateway({ featureState: "LOCAL_MOCK_ONLY", adapter: new GoldenPathMockAdapter() });
  const receipts: SanitizedExecutionReceipt[] = [];
  const outputs: unknown[] = [];
  let envelope = baseEnvelope(input);
  let result = await gateway.execute(envelope);
  receipts.push(result.receipt); outputs.push(result.output);

  for (const stage of continuationStages) {
    const gate = result.receipt.humanGate;
    if (!gate || !input.approvedGates.includes(gate)) break;
    const child: TaskEnvelope = {
      ...envelope,
      taskId: `${input.actionId}:${stage.toLowerCase()}`,
      operation: "PAPER_DRAFT_STAGE",
      idempotencyKey: `${input.actionId}:${stage.toLowerCase()}`,
      createdAt: new Date(Date.parse(envelope.createdAt) + receipts.length * 1_000).toISOString(),
      payload: { kind: "PAPER_DRAFT_STAGE", stage, selectedCandidateHash: taskGatewayHash(outputs[0]), formalDocumentHash: null },
      skillIds: stage === "EVIDENCE_LEDGER" ? ["citation-management", "scientific-critical-thinking"] : ["scientific-writing", "scientific-critical-thinking"],
      toolIds: ["PORTAL_FORMAL_DATA_READ"],
      continuation: { parentTaskId: result.receipt.taskId, parentReceiptHash: result.receipt.receiptHash, approvedGate: gate, approvalHash: taskGatewayHash({ actionId: input.actionId, gate, decision: "APPROVED_BY_FIXTURE_USER" }) },
    };
    assertContinuation(result.receipt, child);
    envelope = child;
    result = await gateway.execute(envelope);
    receipts.push(result.receipt); outputs.push(result.output);
  }

  const final = receipts.at(-1);
  if (!final || final.state !== "WAITING_HUMAN" || !final.humanGate) throw new Error("golden_path_did_not_pause");
  return { mode: "LOCAL_MOCK_ONLY", receipts, outputs, finalState: "WAITING_HUMAN", finalGate: final.humanGate, formalRecordMutations: 0, submissions: 0 };
}
