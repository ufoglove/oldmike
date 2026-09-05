import { S0_FIELD_LIMITS, S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import { beta1CanonicalJson, beta1Hash, isBeta1Hash } from "./canonical-hash.ts";

export const V2_BETA1_CONTRACT_VERSION = "old-mike-v2-beta1/1.7.20" as const;

export function parseV2Beta1ProjectId(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(value)) {
    throw new Error("beta1_project_id_invalid");
  }
  return value;
}
export const V2_BETA1_DIRECTION_LANES = Object.freeze(["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"] as const);
export const V2_BETA1_EXPECTED_RECOMMENDED_LANE = V2_BETA1_DIRECTION_LANES[1];
export const V2_BETA1_REVIEW_STRATEGIES = Object.freeze(["EVIDENCE_CALIBRATED", "JOURNAL_CONCISE_RECOMMENDED", "NATURAL_SCHOLARLY"] as const);
export const V2_BETA1_CONTINUATION_SECTIONS = Object.freeze(["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"] as const);
export const V2_BETA1_PROPOSAL_SECTIONS = Object.freeze(["PROBLEM_AND_OBJECTIVES", "THEORY_AND_EVIDENCE", "METHOD_AND_DESIGN", "WORK_PLAN", "EXPECTED_OUTCOMES", "ETHICS_AND_RISK"] as const);
export const V2_BETA1_ASSIST_OPTION_KEYS = Object.freeze(["optionId", "strategy", "field", "directionHash", "inputBundleHash", "domainSelectionHash", "outputTarget", "lane", "text", "applyValue", "rationale", "risk", "recommended", "optionHash"] as const);
export const V2_BETA1_DOMAIN_SELECTION_KEYS = Object.freeze(["kind", "domainId", "label", "profileId", "profileVersion", "profileContentHash", "selectionHash"] as const);
export const V2_BETA1_INSIGHT_CARD_KEYS = Object.freeze(["kind", "title", "researchQuestion", "mechanism", "value", "domainFit", "evidenceBoundary", "assumptions", "nextAction", "hash"] as const);
export const V2_BETA1_MATERIAL_CONTENT_MAX_BYTES = 24_000 as const;
export const V2_BETA1_MATERIAL_TOTAL_MAX_BYTES = 96_000 as const;
export const V2_BETA1_REQUEST_MAX_BYTES = 131_072 as const;
export const V2_BETA1_MATERIAL_MAX_COUNT = 12 as const;

const V2_BETA1_META_ASSIST = /(?:本欄|為基礎|只保留|重組為|建立跨域邊界|(?:建議|請)(?:補|加入|改寫|列出)|可加入|可改為|應(?:補充|加入|改寫)|請研究者)/u;
const V2_BETA1_MIXED_ASSIST_PUNCTUATION = /(?:。，|。；|；，|，。|，；)/u;
const DIRECT_FIELD_SHAPE: Partial<Record<S0FieldName, RegExp>> = {
  workingTitle: /(?:：|:|與|之|對|在)/u,
  problemContext: /(?:問題|脈絡|張力|不足|缺口|尚未)/u,
  targetUsers: /(?:對象|使用者|學習者|實作者|決策者|樣本|群體)/u,
  expectedContribution: /(?:貢獻|建立|提出|釐清|辨識|驗證)/u,
  existingData: /(?:資料|材料|來源|數據|紀錄|未提供)/u,
  availableData: /(?:資料|量化|質性|問卷|訪談|歷程|文件)/u,
  methodIdea: /(?:方法|設計|分析|檢驗|估計|比較|量測)/u,
  timeline: /(?:階段|里程碑|先|後|完成|期程|盤點)/u,
  constraints: /(?:限制|風險|可行性|資源|樣本|資料品質|權限)/u,
  ethicsPrivacyRisks: /(?:倫理|同意|隱私|資料最小化|去識別|權力|治理)/u,
  unresolvedItems: /(?:待|未知|未|尚|確認|缺口)/u,
};

export type V2Beta1AssistContext = {
  field: S0FieldName;
  directionHash: string;
  inputBundleHash: string;
  domainSelectionHash: string;
  outputTarget: "SCI" | "SSCI" | "NSTC" | "MOE";
  strategy: (typeof V2_BETA1_REVIEW_STRATEGIES)[number];
  lane: (typeof V2_BETA1_DIRECTION_LANES)[number];
};

export type V2Beta1AssistOptionAuthority = V2Beta1AssistContext & {
  optionId: string;
  text: string;
  applyValue: string;
  rationale: string;
  risk: string;
  recommended: boolean;
  optionHash: string;
};

export type V2Beta1AssistParentAuthority = {
  direction: {
    lane: V2Beta1AssistContext["lane"];
    directionHash: string;
    inputBundleHash: string;
    title: string;
    researchQuestion: string;
    mechanism: string;
    contribution: string;
    method: string;
    s0: Record<S0FieldName, string>;
  };
  domain: { label: string; selectionHash: string };
  outputTarget: V2Beta1AssistContext["outputTarget"];
};

export type V2Beta1RecommendedLaneBinding = {
  directions: readonly {
    lane: (typeof V2_BETA1_DIRECTION_LANES)[number];
    recommended: boolean;
    directionId: string;
    directionHash: string;
    inputBundleHash: string;
  }[];
  recommendedDirectionId: string;
  selectedDirectionId: string;
  selectedDirectionHash: string;
  inputBundleHash: string;
};

export function validateV2Beta1ExpectedRecommendedLaneBinding(input: V2Beta1RecommendedLaneBinding) {
  if (input.directions.length !== V2_BETA1_DIRECTION_LANES.length) return false;
  if (input.directions.some((direction) => !V2_BETA1_DIRECTION_LANES.includes(direction.lane))) return false;
  if (new Set(input.directions.map((direction) => direction.lane)).size !== V2_BETA1_DIRECTION_LANES.length) return false;
  if (input.directions.some((direction) => direction.recommended !== (direction.lane === V2_BETA1_EXPECTED_RECOMMENDED_LANE))) return false;
  const expected = input.directions.find((direction) => direction.lane === V2_BETA1_EXPECTED_RECOMMENDED_LANE);
  return !!expected
    && input.recommendedDirectionId === expected.directionId
    && input.selectedDirectionId === expected.directionId
    && input.selectedDirectionHash === expected.directionHash
    && input.inputBundleHash === expected.inputBundleHash;
}

function hasExactKeys(value: unknown, expected: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return Object.keys(input).length === expected.length && expected.every((key) => Object.hasOwn(input, key));
}

export function hasV2Beta1ExactDomainSelectionKeys(value: unknown) {
  if (!hasExactKeys(value, V2_BETA1_DOMAIN_SELECTION_KEYS)) return false;
  const kind = (value as Record<string, unknown>).kind;
  return kind === "BUILTIN" || kind === "CUSTOM";
}

export function hasV2Beta1ExactInsightCardKeys(value: unknown) {
  return hasExactKeys(value, V2_BETA1_INSIGHT_CARD_KEYS);
}

const FIELD_LABELS: Record<S0FieldName, string> = {
  workingTitle: "研究題目", domain: "研究領域", outputTrack: "成果目標", problemContext: "問題背景", targetUsers: "對象與情境",
  expectedContribution: "預期貢獻", existingData: "既有資料", availableData: "可用資料", methodIdea: "方法構想", timeline: "期程",
  constraints: "限制條件", ethicsPrivacyRisks: "倫理與隱私", unresolvedItems: "待確認事項",
};

function normalizeAssistSegment(value: string) {
  return value.replace(/\r\n?/gu, "\n").trim();
}

function completeAssistValue(field: S0FieldName, candidate: string, standalone: string) {
  const normalizedCandidate = normalizeAssistSegment(candidate);
  const normalizedStandalone = normalizeAssistSegment(standalone);
  const selected = normalizedCandidate.length <= S0_FIELD_LIMITS[field] ? normalizedCandidate : normalizedStandalone;
  if (!selected || selected.length > S0_FIELD_LIMITS[field]) throw new Error("beta1_assist_value_exceeds_field_limit");
  return selected;
}

function directAssistValues(parent: V2Beta1AssistParentAuthority): Record<S0FieldName, [string, string, string]> {
  const { direction, domain, outputTarget } = parent;
  const focus = normalizeAssistSegment(direction.title);
  const domainFocus = normalizeAssistSegment(domain.label);
  const question = normalizeAssistSegment(direction.researchQuestion);
  const existing = normalizeAssistSegment(direction.s0.existingData);
  return {
    workingTitle: [
      completeAssistValue("workingTitle", `${focus}：證據界線與可反駁機制`, "證據界線、作用機制與可反駁條件的研究"),
      completeAssistValue("workingTitle", `${focus}：作用機制、成效與情境差異`, "作用機制、研究成效與情境差異的整合研究"),
      completeAssistValue("workingTitle", `${focus}：跨域理論與邊界條件`, "跨域理論、可否證機制與邊界條件的研究"),
    ],
    domain: [
      `以${domainFocus}作為證據與構念的穩健框架。`,
      `以${domainFocus}平衡理論、方法與成果路徑。`,
      `以${domainFocus}探索跨域機制，但不改變本次研究領域權威。`,
    ],
    outputTrack: [
      `以${outputTarget}的證據完整度檢核成果範圍。`,
      `以${outputTarget}平衡論證、可行性與審查需求。`,
      `以${outputTarget}探索前沿貢獻，但不改變本次成果目標權威。`,
    ],
    problemContext: [
      completeAssistValue("problemContext", `${domainFocus}中的研究問題「${question}」尚缺可追溯證據，以辨識機制、替代解釋與外推界線。`, "研究問題仍缺可追溯證據，須辨識機制、替代解釋與外推界線。"),
      completeAssistValue("problemContext", `${domainFocus}的問題、機制與實作情境仍有張力；「${question}」須由可行設計與證據共同回答。`, "問題、機制與實作情境仍有張力，須由可行設計與證據共同回答。"),
      completeAssistValue("problemContext", `${domainFocus}的研究問題可用「${question}」建立跨域框架，但新機制在取得相符證據前仍是可否證假設。`, "研究問題可建立跨域框架，但新機制在取得相符證據前仍是可否證假設。"),
    ],
    targetUsers: [
      completeAssistValue("targetUsers", `${domainFocus}中直接面對研究問題的對象與實作者；納入排除條件、樣本框與場域權限須先核對。`, "直接面對研究問題的對象與實作者；納入排除條件、樣本框與場域權限須先核對。"),
      completeAssistValue("targetUsers", `${domainFocus}相關對象、實作者與決策者；抽樣須兼顧代表性、招募可行性與情境比較。`, "相關對象、實作者與決策者；抽樣須兼顧代表性、招募可行性與情境比較。"),
      completeAssistValue("targetUsers", `${domainFocus}核心對象及可比群體；跨域樣本只檢驗邊界條件，不預設可得性或等同性。`, "核心對象及可比群體；跨域樣本只檢驗邊界條件，不預設可得性或等同性。"),
    ],
    expectedContribution: [
      completeAssistValue("expectedContribution", `建立「${focus}」的最小充分證據鏈，釐清可重現觀察、替代解釋與現有材料不能支持的結論。`, "建立最小充分證據鏈，釐清可重現觀察、替代解釋與現有材料不能支持的結論。"),
      completeAssistValue("expectedContribution", `以「${focus}」連結問題、方法、資料與${outputTarget}成果，使理論貢獻與實作價值可共同審查。`, `連結問題、方法、資料與${outputTarget}成果，使理論貢獻與實作價值可共同審查。`),
      completeAssistValue("expectedContribution", `提出「${focus}」的跨域機制與可否證邊界，以證據負擔約束創新主張，避免把假設寫成發現。`, "提出跨域機制與可否證邊界，以證據負擔約束創新主張，避免把假設寫成發現。"),
    ],
    existingData: [
      completeAssistValue("existingData", `既有資料以「${existing}」為權威，只承認可追溯內容，並保留缺漏、矛盾與未核對引用。`, "既有資料只承認可追溯內容，並保留缺漏、矛盾與未核對引用。"),
      completeAssistValue("existingData", `整合「${existing}」時，須標示資料品質、缺漏、相互支持關係與不確定性。`, "整合既有資料時，須標示資料品質、缺漏、相互支持關係與不確定性。"),
      completeAssistValue("existingData", `既有資料仍以「${existing}」為界；跨域連結只形成待驗證假設，不會成為已觀察資料。`, "既有資料的跨域連結只形成待驗證假設，不會成為已觀察資料。"),
    ],
    availableData: [
      completeAssistValue("availableData", `可用資料以支持「${focus}」主要問題的最小充分集合為原則，優先核對量測、主要結果、資料權限與缺失機制。`, "可用資料以主要問題的最小充分集合為原則，優先核對量測、主要結果、資料權限與缺失機制。"),
      completeAssistValue("availableData", `可規劃量化結果、質性說明與歷程資料共同回答「${focus}」，但各來源的可得性、品質與授權須另行確認。`, "可規劃量化結果、質性說明與歷程資料共同回答研究問題，但各來源的可得性、品質與授權須另行確認。"),
      completeAssistValue("availableData", `可探索檢驗「${focus}」跨域邊界的歷程或多模態資料；完成授權、偏誤與重現性盤點前不得視為可用證據。`, "可探索檢驗跨域邊界的歷程或多模態資料；完成授權、偏誤與重現性盤點前不得視為可用證據。"),
    ],
    methodIdea: [
      completeAssistValue("methodIdea", `採預先界定的比較設計檢驗「${focus}」，先核對量測與資料品質，再估計關聯並以敏感度分析檢查替代解釋。`, "採預先界定的比較設計，先核對量測與資料品質，再估計關聯並以敏感度分析檢查替代解釋。"),
      completeAssistValue("methodIdea", `以「${focus}」的主要結果、機制變項、實作忠實度與情境差異建立同一分析契約。`, "以主要結果、機制變項、實作忠實度與情境差異建立同一分析契約。"),
      completeAssistValue("methodIdea", `採分階段設計檢驗「${focus}」的構念可比性、機制與邊界條件，並預先界定否證準則。`, "採分階段設計檢驗構念可比性、機制與邊界條件，並預先界定否證準則。"),
    ],
    timeline: [
      completeAssistValue("timeline", `「${focus}」依序完成證據、權限與倫理盤點，接續先導量測、正式蒐集分析及重現寫作檢核。`, "依序完成證據、權限與倫理盤點，接續先導量測、正式蒐集分析及重現寫作檢核。"),
      completeAssistValue("timeline", `「${focus}」設場域確認、先導研究、正式蒐集、整合分析與修訂五個里程碑，逐階檢查品質與可行性。`, "設場域確認、先導研究、正式蒐集、整合分析與修訂五個里程碑，逐階檢查品質與可行性。"),
      completeAssistValue("timeline", `「${focus}」先完成核心設計，再加入可比性先導與敏感度分析；創新步驟不得壓縮倫理、量測及重現性檢核。`, "先完成核心設計，再加入可比性先導與敏感度分析；創新步驟不得壓縮倫理、量測及重現性檢核。"),
    ],
    constraints: [
      completeAssistValue("constraints", `「${focus}」受樣本代表性、量測效度、資料品質與權限限制；任一條件不足時，推論範圍須同步收斂。`, "研究受樣本代表性、量測效度、資料品質與權限限制；任一條件不足時，推論範圍須同步收斂。"),
      completeAssistValue("constraints", `「${focus}」的限制包括場域可行性、招募、介入忠實度、分析資源與期程；可管理風險與不可控制條件須分開記錄。`, "限制包括場域可行性、招募、介入忠實度、分析資源與期程；可管理風險與不可控制條件須分開記錄。"),
      completeAssistValue("constraints", `「${focus}」的跨域設計增加構念不等值、資料偏誤、資源與期程風險；創新性不能抵銷證據不足。`, "跨域設計增加構念不等值、資料偏誤、資源與期程風險；創新性不能抵銷證據不足。"),
    ],
    ethicsPrivacyRisks: [
      completeAssistValue("ethicsPrivacyRisks", `「${focus}」採資料最小化、用途限制、去識別化與最小權限；知情同意、退出機制及二次利用均須可追溯。`, "採資料最小化、用途限制、去識別化與最小權限；知情同意、退出機制及二次利用均須可追溯。"),
      completeAssistValue("ethicsPrivacyRisks", `「${focus}」須處理場域權力關係、參與者揭露、資料治理、存取控制與工具協助揭露，不得降低原有不確定性。`, "須處理場域權力關係、參與者揭露、資料治理、存取控制與工具協助揭露，不得降低原有不確定性。"),
      completeAssistValue("ethicsPrivacyRisks", `「${focus}」若涉及新技術或跨域資料，須檢查偏誤、再識別、群體傷害、輸出內容與治理責任。`, "涉及新技術或跨域資料時，須檢查偏誤、再識別、群體傷害、輸出內容與治理責任。"),
    ],
    unresolvedItems: [
      completeAssistValue("unresolvedItems", `尚待確認「${focus}」的樣本框、主要結果、量測效度、資料權限、正式引用及會阻斷有效推論的失效條件。`, "尚待確認樣本框、主要結果、量測效度、資料權限、正式引用及會阻斷有效推論的失效條件。"),
      completeAssistValue("unresolvedItems", `依研究價值與可行性排序後，「${focus}」仍須確認場域、樣本、機制變項、資料品質、分析規格與成果要求。`, "依研究價值與可行性排序後，仍須確認場域、樣本、機制變項、資料品質、分析規格與成果要求。"),
      completeAssistValue("unresolvedItems", `「${focus}」的跨域機會仍須取得構念可比性、額外資料、治理權限與反證條件；未完成前維持假設或未知。`, "跨域機會仍須取得構念可比性、額外資料、治理權限與反證條件；未完成前維持假設或未知。"),
    ],
  };
}

export function isV2Beta1DirectAssistValue(field: string, value: string) {
  if (field === "domain" || field === "outputTrack") return value.trim().length > 0;
  if (!S0_FIELD_NAMES.includes(field as S0FieldName)) return false;
  const minimum = field === "workingTitle" ? 12 : 24;
  const normalized = value.trim();
  const pattern = DIRECT_FIELD_SHAPE[field as S0FieldName];
  return normalized.length >= minimum && normalized.length <= S0_FIELD_LIMITS[field as S0FieldName] && !V2_BETA1_META_ASSIST.test(normalized) && !V2_BETA1_MIXED_ASSIST_PUNCTUATION.test(normalized) && Boolean(pattern?.test(normalized));
}

export function deriveV2Beta1AssistOptionId(context: V2Beta1AssistContext) {
  return `assist:${beta1Hash(context).slice(0, 32)}`;
}

export function v2Beta1AssistOptionCore(option: Omit<V2Beta1AssistOptionAuthority, "optionHash">) {
  return {
    optionId: option.optionId,
    strategy: option.strategy,
    field: option.field,
    directionHash: option.directionHash,
    inputBundleHash: option.inputBundleHash,
    domainSelectionHash: option.domainSelectionHash,
    outputTarget: option.outputTarget,
    lane: option.lane,
    text: option.text,
    applyValue: option.applyValue,
    rationale: option.rationale,
    risk: option.risk,
    recommended: option.recommended,
  };
}

export function createV2Beta1AssistOptions(parent: V2Beta1AssistParentAuthority, field: S0FieldName): [V2Beta1AssistOptionAuthority, V2Beta1AssistOptionAuthority, V2Beta1AssistOptionAuthority] {
  if (!S0_FIELD_NAMES.includes(field) || !V2_BETA1_DIRECTION_LANES.includes(parent.direction.lane) || !isBeta1Hash(parent.direction.directionHash) || !isBeta1Hash(parent.direction.inputBundleHash) || !isBeta1Hash(parent.domain.selectionHash) || !["SCI", "SSCI", "NSTC", "MOE"].includes(parent.outputTarget)) throw new Error("beta1_assist_parent_invalid");
  if (S0_FIELD_NAMES.some((name) => typeof parent.direction.s0[name] !== "string" || !parent.direction.s0[name].trim() || normalizeAssistSegment(parent.direction.s0[name]).length > S0_FIELD_LIMITS[name])) throw new Error("beta1_assist_parent_s0_invalid");
  if ([parent.direction.title, parent.direction.researchQuestion, parent.direction.mechanism, parent.direction.contribution, parent.direction.method].some((value) => typeof value !== "string" || !normalizeAssistSegment(value))) throw new Error("beta1_assist_parent_invalid");
  const values = directAssistValues(parent)[field];
  return V2_BETA1_REVIEW_STRATEGIES.map((strategy, index) => {
    const fieldLabel = FIELD_LABELS[field];
    const strategyLabel = index === 0 ? "證據校準" : index === 1 ? "平衡精修" : "前沿探索";
    const applyValue = field === "domain" ? parent.domain.label : field === "outputTrack" ? parent.outputTarget : values[index];
    const rationale = `${fieldLabel}採${strategyLabel}取徑，直接對齊「${normalizeAssistSegment(parent.direction.title)}」的問題、方法與${parent.outputTarget}成果需求。`;
    const risk = index === 0
      ? `${fieldLabel}若過度收斂，可能遺漏具有解釋力的替代機制；須保留反證、情境差異與推論限制。`
      : index === 1
        ? `${fieldLabel}的平衡表述仍受材料完整度與場域可行性限制；未核對內容不得提高確定性。`
        : `${fieldLabel}的前沿表述增加理論負擔與偏誤風險；必須以額外證據、停止條件及失效邊界約束。`;
    const context: V2Beta1AssistContext = {
      field,
      directionHash: parent.direction.directionHash,
      inputBundleHash: parent.direction.inputBundleHash,
      domainSelectionHash: parent.domain.selectionHash,
      outputTarget: parent.outputTarget,
      strategy,
      lane: parent.direction.lane,
    };
    const core = v2Beta1AssistOptionCore({ ...context, optionId: deriveV2Beta1AssistOptionId(context), text: values[index], applyValue, rationale, risk, recommended: index === 1 });
    return { ...core, optionHash: beta1Hash(core) };
  }) as [V2Beta1AssistOptionAuthority, V2Beta1AssistOptionAuthority, V2Beta1AssistOptionAuthority];
}

export function validateV2Beta1AssistOptionAgainstParent(value: unknown, parent: V2Beta1AssistParentAuthority) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const option = value as Record<string, unknown>;
  if (!S0_FIELD_NAMES.includes(option.field as S0FieldName) || !V2_BETA1_REVIEW_STRATEGIES.includes(option.strategy as V2Beta1AssistContext["strategy"])) return false;
  try {
    const expected = createV2Beta1AssistOptions(parent, option.field as S0FieldName).find((item) => item.strategy === option.strategy);
    return Boolean(expected) && beta1CanonicalJson(value) === beta1CanonicalJson(expected);
  } catch {
    return false;
  }
}

export function validateV2Beta1AssistOptionContent(value: unknown, expected?: Partial<V2Beta1AssistContext>) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const option = value as Record<string, unknown>;
  if (Object.keys(option).length !== V2_BETA1_ASSIST_OPTION_KEYS.length || V2_BETA1_ASSIST_OPTION_KEYS.some((key) => !Object.hasOwn(option, key))) return false;
  const field = option.field as S0FieldName;
  const strategy = option.strategy as V2Beta1AssistContext["strategy"];
  const lane = option.lane as V2Beta1AssistContext["lane"];
  const outputTarget = option.outputTarget as V2Beta1AssistContext["outputTarget"];
  if (!S0_FIELD_NAMES.includes(field) || !V2_BETA1_REVIEW_STRATEGIES.includes(strategy) || !V2_BETA1_DIRECTION_LANES.includes(lane) || !["SCI", "SSCI", "NSTC", "MOE"].includes(outputTarget)) return false;
  if (!isBeta1Hash(option.directionHash) || !isBeta1Hash(option.inputBundleHash) || !isBeta1Hash(option.domainSelectionHash) || !isBeta1Hash(option.optionHash) || typeof option.recommended !== "boolean") return false;
  for (const [key, authority] of Object.entries(expected ?? {})) if (option[key] !== authority) return false;
  const text = typeof option.text === "string" ? option.text.trim() : "";
  const applyValue = typeof option.applyValue === "string" ? option.applyValue.trim() : "";
  const rationale = typeof option.rationale === "string" ? option.rationale.trim() : "";
  const risk = typeof option.risk === "string" ? option.risk.trim() : "";
  const editable = field !== "domain" && field !== "outputTrack";
  const textMaximum = editable ? S0_FIELD_LIMITS[field] : 800;
  if (text.length < 12 || text.length > textMaximum || applyValue.length < 1 || applyValue.length > S0_FIELD_LIMITS[field] || rationale.length < 24 || rationale.length > 800 || risk.length < 24 || risk.length > 800 || V2_BETA1_MIXED_ASSIST_PUNCTUATION.test(text) || V2_BETA1_META_ASSIST.test(rationale) || V2_BETA1_META_ASSIST.test(risk)) return false;
  if (editable && text !== applyValue) return false;
  if (field !== "domain" && field !== "outputTrack" && !isV2Beta1DirectAssistValue(field, applyValue)) return false;
  const context: V2Beta1AssistContext = { field, directionHash: option.directionHash as string, inputBundleHash: option.inputBundleHash as string, domainSelectionHash: option.domainSelectionHash as string, outputTarget, strategy, lane };
  if (option.optionId !== deriveV2Beta1AssistOptionId(context)) return false;
  const core = v2Beta1AssistOptionCore({ ...context, optionId: option.optionId as string, text, applyValue, rationale, risk, recommended: option.recommended as boolean });
  return beta1Hash(core) === option.optionHash;
}
