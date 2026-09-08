/**
 * Batch Automation & Concentrated Review Contract (v4.0 Spec §5)
 *
 * 定位：落實 AUTO_DRAFT_FINAL_REVIEW 模式，以一次性授權連續推進可自動化之研究產物，
 * 取消逐段/逐欄之重複彈窗，改為最後集中呈現內容、修改前後差異與例外報告（缺失/阻擋）。
 *
 * 護欄：
 * 1. 絕不覆蓋 HUMAN_APPROVED 或 FIELD_LOCKED 之欄位。
 * 2. 產物與修訂標記為 AUTO_ADOPTED_DRAFT 或 AUTOMATION_POLICY_LOCKED，絕不冒充真人核准。
 * 3. 缺少核心資料時誠實列入 unresolvedExceptions，直達導航，絕不虛構研究事實。
 */

export const CONCENTRATED_REVIEW_CONTRACT = "concentrated-review/1.0.0" as const;

export type AutomationReviewMode =
  | "AUTO_DRAFT_FINAL_REVIEW" // v4.0 核心一鍵模式：連續生成，最後集中審閱
  | "INTERACTIVE_STEP_BY_STEP"; // 傳統逐段模式

export type ConcentratedReviewExceptionSeverity =
  | "FATAL_DATA_MISSING" // 缺少真實研究事實，不可自動補全
  | "POLICY_PROTECTED_FIELD" // IRB、真實實驗數據等嚴禁 AI 寫入欄位
  | "BUDGET_OR_RATE_LIMIT" // 超出預算或 API 限流
  | "OPTIONAL_ENHANCEMENT_SKIPPED";

export type ConcentratedReviewException = {
  exceptionId: string;
  stageId: string;
  fieldRef?: string;
  severity: ConcentratedReviewExceptionSeverity;
  reason: string;
  recommendedHumanAction: string;
  deepLinkPath: string;
};

export type ConcentratedReviewReport = {
  reviewId: string;
  workOrderId: string;
  projectId: string;
  mode: AutomationReviewMode;
  evaluatedAt: string;
  totalStagesScanned: number;
  totalFieldsUpdated: number;
  totalFieldsLocked: number;
  totalFieldsProtected: number;
  exceptionsCount: number;
  exceptions: ConcentratedReviewException[];
  draftCandidates: Array<{
    stageId: string;
    fieldRef: string;
    previousValue: string | null;
    candidateValue: string;
    lockStatus: "UNLOCKED" | "AUTO_ADOPTED_DRAFT" | "AUTOMATION_POLICY_LOCKED";
    rationale: string;
    evidenceHash?: string;
  }>;
  finalHandoffReady: boolean;
};

/**
 * 評估集中審查狀態：若無 FATAL 缺失且至少有產出，允許進入最終研究者簽核階段
 */
export function evaluateConcentratedReviewReadiness(report: ConcentratedReviewReport): {
  isReadyForHumanReview: boolean;
  blockers: string[];
} {
  const fatalExceptions = report.exceptions.filter(
    (e) => e.severity === "FATAL_DATA_MISSING" || e.severity === "POLICY_PROTECTED_FIELD",
  );
  if (fatalExceptions.length > 0) {
    return {
      isReadyForHumanReview: false,
      blockers: fatalExceptions.map((e) => `[${e.stageId}] ${e.reason} (${e.recommendedHumanAction})`),
    };
  }
  return {
    isReadyForHumanReview: report.draftCandidates.length > 0,
    blockers: report.draftCandidates.length === 0 ? ["尚未生成任何候選草稿"] : [],
  };
}
