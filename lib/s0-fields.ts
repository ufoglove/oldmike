export const S0_FIELDS = [
  { name: "workingTitle", label: "暫定研究題目", kind: "TEXT", maxLength: 160, reviewLength: 8 },
  { name: "domain", label: "研究領域", kind: "DOMAIN", maxLength: 80, reviewLength: 1 },
  { name: "outputTrack", label: "主成果路徑", kind: "OUTPUT_TRACK", maxLength: 10, reviewLength: 1 },
  { name: "problemContext", label: "問題背景", kind: "TEXT", maxLength: 4000, reviewLength: 16 },
  { name: "targetUsers", label: "目標使用者或研究對象", kind: "TEXT", maxLength: 2000, reviewLength: 8 },
  { name: "expectedContribution", label: "預期研究貢獻", kind: "TEXT", maxLength: 4000, reviewLength: 16 },
  { name: "existingData", label: "已有資料", kind: "TEXT", maxLength: 4000, reviewLength: 8 },
  { name: "availableData", label: "可取得資料", kind: "TEXT", maxLength: 4000, reviewLength: 8 },
  { name: "methodIdea", label: "方法或技術構想", kind: "TEXT", maxLength: 4000, reviewLength: 8 },
  { name: "timeline", label: "執行期限", kind: "TEXT", maxLength: 500, reviewLength: 4 },
  { name: "constraints", label: "預算／設備／人力限制", kind: "TEXT", maxLength: 2000, reviewLength: 8 },
  { name: "ethicsPrivacyRisks", label: "倫理、隱私與授權風險", kind: "TEXT", maxLength: 4000, reviewLength: 8 },
  { name: "unresolvedItems", label: "尚未確定的事項", kind: "TEXT", maxLength: 4000, reviewLength: 8 },
] as const;

export type S0FieldName = (typeof S0_FIELDS)[number]["name"];
export type S0TextFieldName = Extract<(typeof S0_FIELDS)[number], { kind: "TEXT" }>["name"];

export const S0_TEXT_FIELDS = S0_FIELDS.filter((field): field is Extract<(typeof S0_FIELDS)[number], { kind: "TEXT" }> => field.kind === "TEXT");
export const S0_FIELD_NAMES = S0_FIELDS.map((field) => field.name) as readonly S0FieldName[];
export const S0_TEXT_FIELD_NAMES = S0_TEXT_FIELDS.map((field) => field.name) as readonly S0TextFieldName[];
export const S0_FIELD_LIMITS = Object.freeze(Object.fromEntries(S0_FIELDS.map((field) => [field.name, field.maxLength])) as Record<S0FieldName, number>);
export const S0_FIELD_LABELS = Object.freeze(Object.fromEntries(S0_FIELDS.map((field) => [field.name, field.label])) as Record<S0FieldName, string>);

export function isS0FieldName(value: unknown): value is S0FieldName {
  return typeof value === "string" && S0_FIELD_NAMES.includes(value as S0FieldName);
}

export function isS0TextFieldName(value: unknown): value is S0TextFieldName {
  return typeof value === "string" && S0_TEXT_FIELD_NAMES.includes(value as S0TextFieldName);
}
