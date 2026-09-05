import "server-only";

import { createHash } from "node:crypto";

import { executeDefaultOpenClawChatCompletion, type OpenClawChatCompletionProtocolResult } from "../openclaw.ts";
import { S0_FIELD_NAMES } from "../s0-fields.ts";
import type { V2Alpha2DirectionCard, V2Alpha2Operation } from "./contracts.ts";
import type { V2Alpha2WorkerProvider, V2Alpha2ProviderResult } from "./worker.ts";

type Message = { role: "system" | "user"; content: string };

const SYSTEM = [
  "你是老麥研究助手的伺服器端結構化草稿元件。",
  "只回傳要求的 JSON 物件；不得加入 prose、markdown 或額外外層。",
  "不可捏造引用、趨勢、統計、結果、正式規則或核准。未知事項要明示為待確認。",
  "公開輸出不得出現供應商、模型、端點或憑證資訊。",
].join("\n");

export const V2_ALPHA2_PROVIDER_OPERATION_AUTHORITY = Object.freeze({
  GENERATE_DIRECTIONS: "M01_RESEARCH_DIRECTIONS",
  EXPAND_SELECTED_S0: "M01_RESEARCH_S0_EXPAND",
  FIELD_ASSIST: "M01_FIELD",
} as const);

export function buildV2Alpha2ProviderMessages(operation: V2Alpha2Operation, payload: Record<string, unknown>): Message[] {
  if (operation === "GENERATE_DIRECTIONS") return [
    { role: "system", content: `${SYSTEM}\n輸出 schemaId=old-mike-v2-alpha2/directions/1，固定三 lane：EVIDENCE_FIRST、BALANCED_RECOMMENDED、FRONTIER_INNOVATION；推薦必須是 BALANCED_RECOMMENDED。` },
    { role: "user", content: JSON.stringify({ task: "產生三個可比較且實質不同的專業研究方向", consumed: { researchDirection: payload.researchDirection, sourceStrategy: "NONE" }, requiredCardFields: ["directionId", "lane", "workingTitle", "researchQuestion", "researchValue", "mechanismTheory", "targetContext", "methodSketch", "feasibilityRisk", "domain", "outputTrack", "unknowns", "nextAction"] }) },
  ];
  if (operation === "EXPAND_SELECTED_S0") return [
    { role: "system", content: `${SYSTEM}\n輸出 schemaId=old-mike-v2-alpha2/s0/1，sourceDirectionId 必須與選定方向一致，fields 必須且只能包含指定 13 欄且每欄非空。` },
    { role: "user", content: JSON.stringify({ task: "只擴寫已選定方向為完整可審查 S0，不建立正式專案", selectedDirection: payload.selectedDirection, researchDirection: payload.researchDirection, fields: S0_FIELD_NAMES }) },
  ];
  return [
    { role: "system", content: `${SYSTEM}\n輸出 schemaId=old-mike-v2-alpha2/field-assist/1，固定三 strategy 各一次：EVIDENCE_FIRST、BALANCED_RECOMMENDED、FRONTIER_INNOVATION。` },
    { role: "user", content: JSON.stringify({ task: "針對一個欄位提供三種可預覽建議", targetField: payload.targetField, currentValue: payload.currentValue, contextSnapshot: payload.contextSnapshot }) },
  ];
}

function parseStrictJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/iu.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  if (!fenced && (!candidate.startsWith("{") || !candidate.endsWith("}"))) throw new Error("OUTPUT_JSON");
  const value = JSON.parse(candidate) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("OUTPUT_SCHEMA");
  return value;
}

function mapProviderResult(result: OpenClawChatCompletionProtocolResult): V2Alpha2ProviderResult {
  if (result.kind === "success") {
    try { return { kind: "success", payload: parseStrictJson(result.content) }; }
    catch (error) { return { kind: "terminal-rejected", code: error instanceof Error && error.message === "OUTPUT_SCHEMA" ? "OUTPUT_SCHEMA" : "OUTPUT_JSON" }; }
  }
  if (result.kind === "proven-not-submitted") return { kind: "proven-not-submitted", code: "TRANSPORT" };
  if (result.kind === "terminal-rejected") return { kind: "terminal-rejected", code: result.code === "response_shape_invalid" ? "OUTPUT_SCHEMA" : "TRANSPORT" };
  return { kind: "completion-unknown", code: result.code === "provider_deadline" ? "TIMEOUT" : result.code === "caller_cancel" ? "COMPLETION_UNKNOWN" : "TRANSPORT" };
}

export function createV2Alpha2OldMikeProvider(): V2Alpha2WorkerProvider {
  const configured = typeof process.env.OPENCLAW_BASE_URL === "string" && process.env.OPENCLAW_BASE_URL.length > 0 && typeof process.env.OPENCLAW_GATEWAY_TOKEN === "string" && process.env.OPENCLAW_GATEWAY_TOKEN.length >= 16;
  if (process.env.OLD_MIKE_V2_ALPHA2_WORKER_ENABLED !== "1" || !configured) return Object.freeze({ capability: "DISABLED" as const, async submit() { return { kind: "proven-not-submitted" as const, code: "TRANSPORT" as const }; } });
  return Object.freeze({
    capability: "ENABLED" as const,
    async submit(input) {
      await input.markSubmissionPossible();
      const result = await executeDefaultOpenClawChatCompletion(
        buildV2Alpha2ProviderMessages(input.operation, input.requestPayload),
        `v2-alpha2:${createHash("sha256").update(input.requestHash).digest("hex").slice(0, 32)}`,
        V2_ALPHA2_PROVIDER_OPERATION_AUTHORITY[input.operation],
      );
      return mapProviderResult(result);
    },
  });
}

function directionCards(researchDirection: string): [V2Alpha2DirectionCard, V2Alpha2DirectionCard, V2Alpha2DirectionCard] {
  return [
    { directionId: "fixture-evidence", lane: "EVIDENCE_FIRST", workingTitle: `${researchDirection}的證據使用與決策機制`, researchQuestion: `哪些可觀察證據支持或反駁「${researchDirection}」的作用路徑？`, researchValue: "建立可反駁的證據—決策鏈結。", mechanismTheory: "證據校準影響專業判斷與行動。", targetContext: "高等教育教師與課程情境；場域仍待確認。", methodSketch: "文件分析結合半結構訪談。", feasibilityRisk: "可先盤點文件；樣本與權限仍未知。", domain: "高等教育", outputTrack: "學術論文", unknowns: ["樣本框", "資料權限"], nextAction: "確認可取得的文件與最小證據窗。" },
    { directionId: "fixture-balanced", lane: "BALANCED_RECOMMENDED", workingTitle: `${researchDirection}的作用機制與實務結果：情境化混合方法研究`, researchQuestion: `「${researchDirection}」透過哪些專業決策機制影響可觀察的實務結果？`, researchValue: "兼顧理論貢獻、方法可行性與實務用途。", mechanismTheory: "專業判斷與信任校準形成可檢驗中介路徑。", targetContext: "高等教育教師與課程實施情境；實際樣本待確認。", methodSketch: "先描繪關聯，再以訪談與文件解釋機制。", feasibilityRisk: "可分階段進行；量測工具仍待驗證。", domain: "教育科技", outputTrack: "學術論文", unknowns: ["量測工具"], nextAction: "確認主要構念與可用資料。" },
    { directionId: "fixture-frontier", lane: "FRONTIER_INNOVATION", workingTitle: `${researchDirection}的失效邊界與反直覺效果`, researchQuestion: `何種條件下「${researchDirection}」未產生預期效益？`, researchValue: "以失效條件與替代解釋提高原創性。", mechanismTheory: "認知卸載、過度信任與情境複雜度形成非線性邊界。", targetContext: "不同整合程度的高等教育課程；分層依據待確認。", methodSketch: "邊界案例抽樣與負向案例比較。", feasibilityRisk: "原創性較高；案例取得與替代解釋控制較難。", domain: "學習科學", outputTrack: "學術論文", unknowns: ["失效訊號", "替代機制"], nextAction: "界定可觀察的失效訊號。" },
  ];
}

export function createV2Alpha2SyntheticProvider(): V2Alpha2WorkerProvider {
  if (process.env.TEST_FIXTURE !== "1" || process.env.OLD_MIKE_V2_ALPHA2_SYNTHETIC_PROVIDER !== "1") return { capability: "DISABLED", async submit() { return { kind: "proven-not-submitted", code: "TRANSPORT" }; } };
  return {
    capability: "ENABLED",
    async submit(input) {
      await input.markSubmissionPossible();
      if (input.operation === "GENERATE_DIRECTIONS") {
        const researchDirection = String(input.requestPayload.researchDirection || "").trim();
        const directions = directionCards(researchDirection);
        return { kind: "success", payload: { schemaId: "old-mike-v2-alpha2/directions/1", researchDirection, directions, recommendedDirectionId: "fixture-balanced" } };
      }
      if (input.operation === "EXPAND_SELECTED_S0") {
        const selected = input.requestPayload.selectedDirection as V2Alpha2DirectionCard;
        const direction = String(input.requestPayload.researchDirection || "").trim();
        return { kind: "success", payload: { schemaId: "old-mike-v2-alpha2/s0/1", sourceDirectionId: selected.directionId, fields: {
          workingTitle: selected.workingTitle, domain: selected.domain, outputTrack: selected.outputTrack,
          problemContext: `${direction}。本草稿把問題、作用機制與可驗證結果整理成專業研究背景，並保留場域與證據尚待確認的界線。`,
          targetUsers: selected.targetContext, expectedContribution: "建立可檢驗的作用機制並說明其研究與實務貢獻。",
          existingData: "尚未盤點；不推定已有正式研究資料。", availableData: "可評估課程文件、訪談與去識別化紀錄；實際可得性待確認。",
          methodIdea: selected.methodSketch, timeline: "先完成證據與可行性盤點，再由研究者確認正式期程。",
          constraints: "樣本、資料權限、量測工具、人力與預算仍待確認。", ethicsPrivacyRisks: "需評估知情同意、資料最小化、去識別化與權力關係。",
          unresolvedItems: "樣本框、量測工具、資料取得、倫理審查、正式引用與目標期刊待確認。",
        } } };
      }
      const targetField = String(input.requestPayload.targetField || "workingTitle");
      const currentValue = String(input.requestPayload.currentValue || "目前內容");
      return { kind: "success", payload: { schemaId: "old-mike-v2-alpha2/field-assist/1", targetField, options: [
        { strategy: "EVIDENCE_FIRST", text: `${currentValue}（證據優先整理）`, rationale: "先標出可觀察證據與未知事項。", boundary: "UNVERIFIED" },
        { strategy: "BALANCED_RECOMMENDED", text: `${currentValue}（平衡建議稿）`, rationale: "兼顧研究價值、方法與可行性。", boundary: "ASSUMPTION" },
        { strategy: "FRONTIER_INNOVATION", text: `${currentValue}（前沿邊界稿）`, rationale: "加入可反駁的邊界條件。", boundary: "UNVERIFIED" },
      ] } };
    },
  };
}
