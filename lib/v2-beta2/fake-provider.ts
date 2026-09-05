import "server-only";

import { S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import {
  V2_BETA2_STAGE_ID,
  beta2Hash,
  createV2Beta2Direction,
  createV2Beta2DomainAuthority,
  createV2Beta2ProviderResult,
  parseV2Beta2ProviderResult,
  type V2Beta2ProviderLookupOutcome,
  type V2Beta2ProviderResult,
  type V2Beta2ProviderSubmitOutcome,
  type V2Beta2Source,
} from "./contracts.ts";
import { V2_BETA2_PROVIDER_PORT_VERSION, parseV2Beta2ProviderLookupRequest, parseV2Beta2ProviderSubmission, type V2Beta2ProviderPort, type V2Beta2ProviderSubmission } from "./provider-port.ts";

export type V2Beta2ProviderOutcome = V2Beta2ProviderSubmitOutcome;
export type V2Beta2ProviderLookup = V2Beta2ProviderLookupOutcome;

function s0For(source: V2Beta2Source, lane: "EVIDENCE_FIRST" | "BALANCED_RECOMMENDED" | "FRONTIER_INNOVATION") {
  const direction = source.researchDirection;
  const boundedFocus = direction.length <= 96 ? direction : "使用者指定的完整研究方向";
  const materialSummary = source.materials.length
    ? `依序保留 ${source.materials.map((item) => `${item.kind}:${item.title}`).join("、")}；原始位元組與雜湊不得改寫。缺口：${Object.entries(source.materialCoverage).filter(([, state]) => state === "MISSING").map(([kind]) => kind).join("、") || "無"}；提供內容仍屬未驗證材料，不提升為已觀察證據。`
    : "目前只有研究關鍵字，尚未提供結果材料；所有成效主張維持待驗證。";
  const laneLabel = lane === "EVIDENCE_FIRST" ? "證據校準" : lane === "BALANCED_RECOMMENDED" ? "平衡機制" : "前沿邊界";
  const values: Record<S0FieldName, string> = {
    workingTitle: `${boundedFocus}：${laneLabel}與可反駁研究設計`,
    domain: "AI應用於教育",
    outputTrack: source.outputTarget,
    problemContext: `針對「${direction}」，目前仍須釐清研究問題、作用機制、替代解釋與情境外推界線。`,
    targetUsers: "高等教育情境中的學習者、授課者與研究實作者；樣本框、場域與納入排除條件仍待核對。",
    expectedContribution: `以${laneLabel}取徑建立可重現、可反駁且不超出材料證據的研究貢獻。`,
    existingData: materialSummary,
    availableData: "可規劃前後測、問卷、訪談與去識別化學習歷程；實際可得性、品質與權限均須另行確認。",
    methodIdea: lane === "EVIDENCE_FIRST"
      ? "先完成量測、資料品質與證據界線檢核，再以預先界定的比較與敏感度分析辨識關聯及替代解釋。"
      : lane === "BALANCED_RECOMMENDED"
        ? "採混合方法比較設計，同步檢驗主要結果、機制變項、實作忠實度與情境差異，並保留失效條件。"
        : "以分階段先導與正式研究檢驗跨域機制及邊界條件，所有創新主張都綁定額外證據負擔與停止準則。",
    timeline: "依序完成場域與倫理盤點、先導量測、正式蒐集分析、重現性檢核及人工作品審查。",
    constraints: "樣本代表性、量測效度、資料品質、場域權限、人力與期程均可能限制推論範圍。",
    ethicsPrivacyRisks: "採資料最小化、知情同意、去識別化、用途限制與最小權限；不得以模型輸出取代正式倫理或授權判斷。",
    unresolvedItems: "樣本框、主要結果、量測工具、資料權限、正式引用、分析規格與失效條件仍待確認。",
  };
  if (Object.keys(values).length !== S0_FIELD_NAMES.length) throw new Error("beta2_fake_s0_incomplete");
  return values;
}

export function createDeterministicV2Beta2ProviderResult(input: V2Beta2ProviderSubmission) {
  const domain = createV2Beta2DomainAuthority();
  const lanes = ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"] as const;
  const boundedFocus = input.source.researchDirection.length <= 96 ? input.source.researchDirection : "使用者指定的完整研究方向";
  const directions = lanes.map((lane, index) => createV2Beta2Direction({
    directionId: `beta2-direction-${index + 1}-${input.stageInstanceHash.slice(0, 16)}`,
    lane,
    recommended: lane === "BALANCED_RECOMMENDED",
    title: `${boundedFocus}：${lane === "EVIDENCE_FIRST" ? "證據校準" : lane === "BALANCED_RECOMMENDED" ? "機制與可行性平衡" : "跨域邊界探索"}`,
    researchQuestion: `在明確證據界線下，${boundedFocus}如何影響可觀察的研究結果，且哪些情境會使此關聯失效？`,
    mechanism: lane === "EVIDENCE_FIRST"
      ? "證據可見性與量測品質先約束推論，再辨識可能的作用機制與替代解釋。"
      : lane === "BALANCED_RECOMMENDED"
        ? "研究設計同時連結主要結果、機制、實作忠實度與情境差異，避免理論或可行性單邊失衡。"
        : "跨域構念形成可否證的新機制，但在額外證據與邊界檢驗完成前只維持為假設。",
    method: s0For(input.source, lane).methodIdea,
    contribution: s0For(input.source, lane).expectedContribution,
    s0: s0For(input.source, lane),
    domain,
    outputTarget: input.source.outputTarget,
    inputBundleHash: input.source.sourceHash,
  }));
  return createV2Beta2ProviderResult({
    stageInstanceHash: input.stageInstanceHash,
    sourceHash: input.source.sourceHash,
    directions,
    recommendedDirectionId: directions[1].directionId,
    selectedDirectionId: directions[1].directionId,
  });
}

export class DeterministicFakeV2Beta2Provider implements V2Beta2ProviderPort {
  submissionCount = 0;
  lookupCount = 0;
  private nextOutcome: "COMPLETE" | "COMPLETION_UNKNOWN" | "TERMINAL_REJECTED" = "COMPLETE";
  private readonly lookupOutcomes = new Map<string, V2Beta2ProviderLookup>();

  capability() {
    return {
      portVersion: V2_BETA2_PROVIDER_PORT_VERSION,
      providerClass: "LOCAL_DETERMINISTIC_FIXTURE",
      submission: "AVAILABLE",
      lookup: "AVAILABLE",
      reasonCode: null,
    } as const;
  }

  setNextOutcome(outcome: "COMPLETE" | "COMPLETION_UNKNOWN" | "TERMINAL_REJECTED") {
    this.nextOutcome = outcome;
  }

  setLookupOutcome(receiptCommitment: string, requestHash: string, outcome: Omit<V2Beta2ProviderLookup, "receiptCommitment" | "requestHash">) {
    this.lookupOutcomes.set(receiptCommitment, { ...outcome, receiptCommitment, requestHash } as V2Beta2ProviderLookup);
  }

  async submit(input: V2Beta2ProviderSubmission): Promise<V2Beta2ProviderOutcome> {
    input = parseV2Beta2ProviderSubmission(input);
    if (input.source.sourceStrategy !== "NONE" || !/^[0-9a-f]{64}$/u.test(input.stageInstanceHash) || input.requestHash.length !== 64 || V2_BETA2_STAGE_ID !== "DURABLE_CORE_GENERATION") throw new Error("beta2_fake_provider_input_invalid");
    this.submissionCount += 1;
    const receiptCommitment = input.receiptCommitment;
    if (!/^[0-9a-f]{64}$/u.test(receiptCommitment)) throw new Error("beta2_fake_provider_receipt_invalid");
    const outcome = this.nextOutcome;
    this.nextOutcome = "COMPLETE";
    if (outcome === "TERMINAL_REJECTED") {
      this.lookupOutcomes.set(receiptCommitment, { status: "REJECTED", receiptCommitment, requestHash: input.requestHash });
      return { completionClass: "TERMINAL_REJECTED", receiptCommitment, requestHash: input.requestHash, reasonCode: "FAKE_PROVIDER_REJECTED" };
    }
    const result = parseV2Beta2ProviderResult(createDeterministicV2Beta2ProviderResult(input));
    if (outcome === "COMPLETION_UNKNOWN") {
      this.lookupOutcomes.set(receiptCommitment, { status: "UNKNOWN", receiptCommitment, requestHash: input.requestHash });
      return { completionClass: "COMPLETION_UNKNOWN", receiptCommitment, requestHash: input.requestHash };
    }
    this.lookupOutcomes.set(receiptCommitment, { status: "COMPLETE", receiptCommitment, requestHash: input.requestHash, result });
    return { completionClass: "COMPLETE", receiptCommitment, requestHash: input.requestHash, result };
  }

  async lookup(input: { receiptCommitment: string; requestHash: string }): Promise<V2Beta2ProviderLookup> {
    input = parseV2Beta2ProviderLookupRequest(input);
    this.lookupCount += 1;
    const prior = this.lookupOutcomes.get(input.receiptCommitment);
    if (prior) return prior;
    return { status: "NOT_FOUND", receiptCommitment: input.receiptCommitment, requestHash: input.requestHash };
  }
}
