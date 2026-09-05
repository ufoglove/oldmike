export const V2_ALPHA9_TRACK_OPTIONS = Object.freeze([
  {
    id: "JOURNAL_MANUSCRIPT",
    label: "國際期刊論文",
    detail: "承接半成品或既有稿件，一次完成完整性、證據、統計、表圖、期刊契合與學術表達總審。",
  },
  {
    id: "NSTC_PROPOSAL",
    label: "國科會研究計畫",
    detail: "承接 V2 臺灣計畫草稿，檢查問題、方法、資料、分析、倫理、時程、工作包、經費、KPI 與附件。",
  },
  {
    id: "MOE_PROPOSAL",
    label: "教育部教學實踐計畫",
    detail: "以課程問題、教學介入、學習成效、評量與實施忠實度為核心完成整份總審。",
  },
] as const);

export function alpha9PrototypeEnabled(environment: Record<string, string | undefined> = process.env) {
  return environment.NODE_ENV === "development"
    && environment.TEST_FIXTURE === "1"
    && environment.OLD_MIKE_V2_ALPHA9_LOCAL_PROTOTYPE === "1";
}
