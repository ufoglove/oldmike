export const V2_ALPHA8_GOAL_OPTIONS = Object.freeze([
  { id: "JOURNAL_MANUSCRIPT", label: "國際期刊論文", detail: "本版專注把既有摘要、前言、方法、結果與資料接成可校閱的六段工作稿；國科會／教育部計畫沿用 V2 臺灣計畫工作區。" },
] as const);

export function alpha8PrototypeEnabled(environment: Record<string, string | undefined> = process.env) {
  return environment.NODE_ENV === "development"
    && environment.TEST_FIXTURE === "1"
    && environment.OLD_MIKE_V2_ALPHA8_LOCAL_PROTOTYPE === "1";
}
