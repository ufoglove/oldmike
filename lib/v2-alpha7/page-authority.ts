export const V2_ALPHA7_ENTRY_OPTIONS = Object.freeze([
  { id: "ALPHA6_MANUSCRIPT", label: "從目前研究稿件開始" },
  { id: "PASTED_MANUSCRIPT", label: "貼上稿件" },
] as const);

export const V2_ALPHA7_PURPOSE_OPTIONS = Object.freeze([
  { id: "AUTHOR_PRE_SUBMISSION_REVIEW", label: "投稿前作者檢視" },
  { id: "AUTHOR_REVISION_AND_REVIEWER_RESPONSE", label: "修訂與審查意見回覆" },
  { id: "INDEPENDENT_REVIEWER_MODE", label: "獨立審稿模式（唯讀）" },
] as const);

export function alpha7PrototypeEnabled(environment: Record<string, string | undefined> = process.env) {
  return environment.NODE_ENV === "development" && environment.TEST_FIXTURE === "1" && environment.OLD_MIKE_V2_ALPHA7_LOCAL_PROTOTYPE === "1";
}
