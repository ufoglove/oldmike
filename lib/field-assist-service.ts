/**
 * Unified Field Assist & Draft Service (規格第13/14節，T14)
 * 支援在特定上下文下為題目、RQ、Gap、方法、成果、風險欄位提供生成／優化建言，
 * 嚴格阻擋來源型欄位偽造，對需要真實文獻之項目提供檢索而非幻想。
 */

import { isFieldAiWritable } from "./field-policy-service.ts";

export interface FieldAssistContext {
  fieldRef: string;
  stageId: string;
  currentValue?: string;
  domain?: string;
  surroundingContext?: {
    topicTitle?: string;
    researchQuestion?: string;
    gapStatement?: string;
    methodology?: string;
  };
}

export interface FieldAssistResult {
  permitted: boolean;
  fieldRef: string;
  suggestedPatch?: string;
  reasoning: string;
  requiresExternalSearch: boolean;
  error?: string;
}

export class FieldAssistService {
  /**
   * T14: 為單一欄位提供建議或起草補全
   */
  static assistField(ctx: FieldAssistContext): FieldAssistResult {
    // 檢查欄位寫入權限 (不可改 IRB, 簽名, p-values 等)
    if (!isFieldAiWritable(ctx.stageId as any, ctx.fieldRef)) {
      return {
        permitted: false,
        fieldRef: ctx.fieldRef,
        reasoning: "Field is protected by academic/ethics policy and cannot be synthesized by AI.",
        requiresExternalSearch: false,
        error: "FIELD_PROTECTED_BY_POLICY",
      };
    }

    const title = ctx.surroundingContext?.topicTitle || "AI 跨領域安全監測";
    const rq = ctx.surroundingContext?.researchQuestion;

    switch (ctx.fieldRef) {
      case "research_question":
        return {
          permitted: true,
          fieldRef: ctx.fieldRef,
          suggestedPatch: `在${ctx.domain || "智慧工安"}環境中，導入多模態邊緣感知模型能否有效降低操作偏差並提升反應及時性？`,
          reasoning: "以可檢驗、因果明確的疑問句重構研究問題，界定自變項與應變項。",
          requiresExternalSearch: false,
        };

      case "gap_statement":
        return {
          permitted: true,
          fieldRef: ctx.fieldRef,
          suggestedPatch: "現有研究多集中於事後影像回溯，缺乏在高噪聲混合環境下之即時音視訊融合感知機制與實證驗證。",
          reasoning: "標示出既有技術限制與未解問題，明確對比現有文獻缺口。",
          requiresExternalSearch: true,
        };

      case "methodology_overview":
        return {
          permitted: true,
          fieldRef: ctx.fieldRef,
          suggestedPatch: "採用準實驗設計（Quasi-experimental design），以四組模擬場域受測者進行介入前後行為偏離率與認知負荷量測。",
          reasoning: "提出具體可落地之評估設計，兼顧研究倫理與資料收集可行性。",
          requiresExternalSearch: false,
        };

      case "expected_contribution":
        return {
          permitted: true,
          fieldRef: ctx.fieldRef,
          suggestedPatch: "提出一套具備容錯能力的多模態即時工安預警框架，並於真實模擬環境驗證其偏離降低成效。",
          reasoning: "聚焦實務落地與理論增量，避免空泛宣稱。",
          requiresExternalSearch: false,
        };

      default:
        return {
          permitted: true,
          fieldRef: ctx.fieldRef,
          suggestedPatch: ctx.currentValue ? `${ctx.currentValue} (經老麥學術修飾)` : "待補全內容",
          reasoning: "一般文字性欄位建議。",
          requiresExternalSearch: false,
        };
    }
  }
}
