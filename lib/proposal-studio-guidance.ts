import "server-only";

import {
  TASK_GATEWAY_CONTRACT_VERSION,
  parseTaskEnvelope,
  taskGatewayHash,
  type TaskEnvelope,
} from "./task-gateway-contract.ts";
import { ServerOnlyTaskGateway, type TaskAdapterResult, type TaskProviderAdapter } from "./task-gateway.ts";
import type { GuidanceFocus, ProposalDraft, ProposalMode } from "./proposal-studio-contract.ts";
import type { ModelModeProfile } from "./model-mode-contract.ts";
import type { ResolvedModelRoute } from "./model-route-catalog.ts";
import { runProposalGuidanceWithOpenClaw, type ProposalGuidanceOutput } from "./proposal-guidance-provider.ts";

class ProposalGuidanceMockAdapter implements TaskProviderAdapter {
  readonly adapterKind = "LOCAL_MOCK" as const;
  readonly supportedOperations = ["PROPOSAL_GUIDANCE"] as const;
  async execute(envelope: TaskEnvelope, signal: AbortSignal): Promise<TaskAdapterResult> {
    if (signal.aborted || envelope.operation !== "PROPOSAL_GUIDANCE" || envelope.payload.kind !== "PROPOSAL_GUIDANCE") throw new Error("proposal_guidance_fixture_rejected");
    const focus = envelope.payload.focus;
    const output: ProposalGuidanceOutput = {
      label: "老麥建議・尚未驗證", factualAuthority: "NONE", officialSourceMutation: false, formalRecordMutation: false,
      suggestions: [
        { suggestionId: "guidance-alignment-001", focus, explanation: "逐項檢查問題、目標、方法、工作包、里程碑與預算理由是否形成可追溯鏈。", risk: "此建議不代表年度徵件規則或審查結論。", action: "由研究者依當年度官方來源逐項核對並編輯。" },
        { suggestionId: "guidance-evidence-002", focus, explanation: "把每項主張與初步證據、資料來源或待補證據狀態分開記錄。", risk: "未提供的證據不得推定存在。", action: "保留 UNKNOWN，直到正式證據與 Human Gate 完成。" },
        { suggestionId: "guidance-budget-003", focus, explanation: "確認每筆經費都能連回一個工作包、數量、單價、小計與必要性。", risk: "合成範例不是官方預算規則。", action: "用當年度官方規範更新要求矩陣後再核准。" },
      ],
    };
    return { status: "MOCK_COMPLETE", output, outputHash: taskGatewayHash(output), humanGate: null, dataEgress: "NONE" };
  }
}

export class ProposalGuidanceUnavailable extends Error { readonly code = "proposal_guidance_disabled"; readonly status = 503; constructor() { super("proposal_guidance_disabled"); this.name = "ProposalGuidanceUnavailable"; } }

export async function runProposalGuidance(input: { tenantId: string; projectId: string; userId: string; idempotencyKey: string; proposalHash: string; proposal: ProposalDraft; mode: ProposalMode; focus: GuidanceFocus; modeProfile: ModelModeProfile; route: ResolvedModelRoute; now?: Date }, environment: Readonly<Record<string, string | undefined>> = process.env) {
  if (environment.OLD_MIKE_PROPOSAL_GUIDANCE_MODE === "LOCAL_FIXTURE" && environment.TEST_FIXTURE === "1") {
    const opaque = (value: string) => taskGatewayHash(value).slice(0, 32); const now = input.now ?? new Date();
    const envelope = parseTaskEnvelope({ contractVersion: TASK_GATEWAY_CONTRACT_VERSION, actionId: "m05-proposal-guidance", taskId: `m05-task-${opaque(`${input.idempotencyKey}:${input.proposalHash}`)}`, tenantId: `tenant-${opaque(input.tenantId)}`, projectId: `project-${opaque(input.projectId)}`, operation: "PROPOSAL_GUIDANCE", idempotencyKey: input.idempotencyKey, createdAt: now.toISOString(), payload: { kind: "PROPOSAL_GUIDANCE", proposalHash: input.proposalHash, mode: input.mode, focus: input.focus, modeProfile: input.modeProfile }, skillIds: ["research-grants"], toolIds: [], continuation: null }, new Set(["research-grants"]));
    const gateway = new ServerOnlyTaskGateway({ featureState: "LOCAL_MOCK_ONLY", adapter: new ProposalGuidanceMockAdapter() }); const result = await gateway.execute(envelope);
    return { receipt: result.receipt, guidance: result.output as ProposalGuidanceOutput };
  }
  if (environment.OPENCLAW_BASE_URL && environment.OPENCLAW_GATEWAY_TOKEN) {
    const guidance = await runProposalGuidanceWithOpenClaw({ proposal: input.proposal, mode: input.mode, focus: input.focus, actorId: input.userId, route: input.route });
    return { receipt: null, guidance };
  }
  throw new ProposalGuidanceUnavailable();
}
