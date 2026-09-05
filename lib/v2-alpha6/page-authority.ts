export const V2_ALPHA6_PROJECT_OPTIONS = Object.freeze([
  {
    id: "project-s0-alpha6-local",
    label: "證據邊界與教師決策（本機 S0 fixture）",
    detail: "已綁定 S0、部分證據 metadata 與目前期刊快照；不含正式研究寫入。",
  },
] as const);

export const V2_ALPHA6_ENTRY_OPTIONS = Object.freeze([
  { id: "PROJECT_ARTIFACT", label: "從專案 S0 開始", detail: "沿用已選專案的研究問題、證據與期刊邊界。" },
  { id: "PASTED_DRAFT", label: "貼上既有稿件", detail: "保留原文 bytes，只建立可預覽的本機修訂稿。" },
] as const);

export const V2_ALPHA6_LANGUAGE_OPTIONS = Object.freeze([
  { id: "ZH_TW", label: "繁體中文" },
  { id: "EN", label: "英文" },
] as const);

export function alpha6PrototypeEnabled(environment: Record<string, string | undefined> = process.env) {
  return environment.NODE_ENV === "development"
    && environment.TEST_FIXTURE === "1"
    && environment.OLD_MIKE_V2_ALPHA6_LOCAL_PROTOTYPE === "1";
}
