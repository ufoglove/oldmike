import type { S0Intake } from "../project-contract.ts";

export const V2_GLOBAL_NAV = [
  { id: "HOME", label: "Home", zhLabel: "首頁" },
  { id: "PROJECTS", label: "My Projects", zhLabel: "我的專案" },
  { id: "LITERATURE", label: "Literature Library", zhLabel: "文獻庫" },
  { id: "QUICK_TOOLS", label: "Quick Tools", zhLabel: "快速工具" },
  { id: "SETTINGS", label: "Settings", zhLabel: "設定" },
] as const;

export const V2_PROJECT_STAGES = [
  { id: "DISCOVER", label: "探索", english: "Discover", summary: "把一個方向整理成可比較的研究機會" },
  { id: "BLUEPRINT", label: "藍圖", english: "Blueprint", summary: "形成完整 S0、研究設計與申請架構" },
  { id: "EVIDENCE", label: "證據", english: "Evidence", summary: "管理文獻、主張、引用與不確定性" },
  { id: "ANALYZE", label: "分析", english: "Analyze", summary: "規劃可重現分析與圖表規格" },
  { id: "WRITE", label: "寫作", english: "Write", summary: "完成論文與雙語學術稿件" },
  { id: "REVIEW_SUBMIT", label: "審查與投稿", english: "Review & Submit", summary: "唯讀審查、修訂與輸出套件" },
] as const;

export type V2StageId = (typeof V2_PROJECT_STAGES)[number]["id"];

export const V2_CAPABILITIES = [
  { id: "TOPIC_DIRECTIONS", stage: "DISCOVER", label: "研究方向探索", tasks: ["三種研究方向", "跨領域可行性與風險"], state: "PROTOTYPE" },
  { id: "LITERATURE_DISCOVERY", stage: "DISCOVER", label: "文獻探索與前沿雷達", tasks: ["當前證據／動能", "未來情境與失效條件"], state: "DESIGN_ONLY" },
  { id: "S0_BLUEPRINT", stage: "BLUEPRINT", label: "研究藍圖與 S0", tasks: ["完整 13 欄 S0", "方法、樣本與倫理設計"], state: "PROTOTYPE" },
  { id: "PROPOSAL_DESIGN", stage: "BLUEPRINT", label: "國家計畫架構", tasks: ["NSTC 研究計畫", "MOE 教學實踐研究計畫"], state: "DESIGN_ONLY" },
  { id: "EVIDENCE_SYNTHESIS", stage: "EVIDENCE", label: "證據綜整與主張校準", tasks: ["文獻綜整", "主張／假設／反證條件"], state: "DESIGN_ONLY" },
  { id: "CITATION_MANAGEMENT", stage: "EVIDENCE", label: "引用與 DOI 管理", tasks: ["書目與 DOI 去重", "引用完整性與來源狀態"], state: "DESIGN_ONLY" },
  { id: "ANALYSIS_PLANNING", stage: "ANALYZE", label: "分析計畫與結果邊界", tasks: ["統計／質性分析計畫", "結果與不確定性邊界"], state: "DESIGN_ONLY" },
  { id: "SCIENTIFIC_VISUALIZATION", stage: "ANALYZE", label: "可重現圖表規格", tasks: ["數據圖表", "資料雜湊／腳本／替代文字"], state: "DESIGN_ONLY" },
  { id: "MANUSCRIPT_DRAFTING", stage: "WRITE", label: "論文與章節草稿", tasks: ["結構化論文撰寫", "結果、討論與限制"], state: "DESIGN_ONLY" },
  { id: "TRANSLATE_HUMANIZE", stage: "WRITE", label: "翻譯、改寫與文風校準", tasks: ["中英雙向翻譯", "學術語氣與人性化校訂"], state: "DESIGN_ONLY" },
  { id: "READ_ONLY_REVIEW", stage: "REVIEW_SUBMIT", label: "唯讀多視角審查", tasks: ["Reviewer 模式", "審查意見回覆"], state: "DESIGN_ONLY" },
  { id: "SUBMISSION_PACKAGE", stage: "REVIEW_SUBMIT", label: "投稿與計畫輸出套件", tasks: ["期刊規格與附件", "Cover Letter 與提交前檢核"], state: "DESIGN_ONLY" },
] as const satisfies readonly { id: string; stage: V2StageId; label: string; tasks: readonly string[]; state: "PROTOTYPE" | "DESIGN_ONLY" }[];

export const V2_DIRECTION_LANES = ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"] as const;
export type V2DirectionLane = (typeof V2_DIRECTION_LANES)[number];

export type V2DirectionCard = {
  id: string;
  lane: V2DirectionLane;
  label: string;
  workingTitle: string;
  researchQuestion: string;
  researchValue: string;
  mechanismTheory: string;
  targetContext: string;
  methodSketch: string;
  feasibilityRisk: string;
  assumptions: string[];
  nextAction: string;
  recommended: boolean;
};

export type V2PrototypeWorkspace = {
  researchDirection: string;
  directions: V2DirectionCard[];
  recommendedDirectionId: string;
  s0Draft: S0Intake;
  generationEffectCount: 1;
  formalWriteCount: 0;
};

function normalizeDirection(value: string) {
  const normalized = value.replace(/\s+/gu, " ").trim().slice(0, 240);
  return normalized || "大學教師採用生成式工具的教學決策與學習成效";
}

function buildDirections(researchDirection: string): V2DirectionCard[] {
  const shared = {
    targetContext: "高等教育教師與課程實施情境；實際場域、樣本與資料權限仍待確認",
    assumptions: ["目前未連接外部文獻來源", "所有趨勢與成效主張均待正式證據驗證"],
  };
  return [
    {
      ...shared,
      id: "direction-evidence-first",
      lane: "EVIDENCE_FIRST",
      label: "證據優先",
      workingTitle: `${researchDirection}：現況證據、決策機制與可驗證差異`,
      researchQuestion: `現有可觀察證據如何支持或反駁「${researchDirection}」的作用路徑？`,
      researchValue: "先建立主張、來源與反證條件，降低把推測寫成結果的風險。",
      mechanismTheory: "證據使用、專業判斷與課程決策之間的可檢驗鏈結。",
      methodSketch: "先行範疇檢視，接續多來源文件編碼與教師訪談的序列混合方法。",
      feasibilityRisk: "優點是可先用既有文件啟動；風險是來源可得性與代表性尚未確認。",
      nextAction: "確認可取得的文件、訪談對象與最小證據窗。",
      recommended: false,
    },
    {
      ...shared,
      id: "direction-balanced-recommended",
      lane: "BALANCED_RECOMMENDED",
      label: "平衡方案",
      workingTitle: `${researchDirection}的作用機制與學習成效：一項情境化混合方法研究`,
      researchQuestion: `「${researchDirection}」透過哪些教師決策機制影響可觀察的課程與學習結果？`,
      researchValue: "同時保留理論貢獻、可行方法與實務可用性，適合作為第一版完整藍圖。",
      mechanismTheory: "教師專業判斷、工具信任校準與教學設計品質的中介路徑。",
      methodSketch: "以問卷或行為紀錄描繪關聯，再以訪談與課程文件解釋機制。",
      feasibilityRisk: "可分階段執行；但量測工具、樣本與倫理程序仍需研究者確認。",
      nextAction: "確認主要構念、可用資料與一個可反駁的核心假設。",
      recommended: true,
    },
    {
      ...shared,
      id: "direction-frontier-innovation",
      lane: "FRONTIER_INNOVATION",
      label: "前沿創新",
      workingTitle: `${researchDirection}的邊界條件與反直覺效果：跨階段比較研究`,
      researchQuestion: `在何種條件下「${researchDirection}」未帶來預期效益，甚至改變教師判斷與學生參與？`,
      researchValue: "以失效邊界與替代解釋建立更具原創性的可反駁問題。",
      mechanismTheory: "認知卸載、過度信任與情境複雜度可能形成非線性邊界。",
      methodSketch: "採邊界案例抽樣、跨階段比較與負向案例分析。",
      feasibilityRisk: "原創性較高；但需較嚴格的案例選擇與替代解釋控制。",
      nextAction: "界定可觀察的失效訊號與至少一項替代機制。",
      recommended: false,
    },
  ];
}

export function buildV2PrototypeWorkspace(rawDirection: string): V2PrototypeWorkspace {
  const researchDirection = normalizeDirection(rawDirection);
  const directions = buildDirections(researchDirection);
  const recommended = directions[1];
  const s0Draft: S0Intake = {
    workingTitle: recommended.workingTitle,
    domain: "AI × 教育",
    outputTrack: "SSCI",
    problemContext: `${researchDirection}。此題目前仍缺少正式文獻檢索與場域資料；本草稿先把教師決策、課程設計與學習結果之間的作用機制整理為可驗證問題，不把推測寫成已知事實。`,
    targetUsers: recommended.targetContext,
    expectedContribution: "建立可區分證據、假設與反證條件的作用機制框架，並說明其對教學設計與研究方法的可檢驗貢獻。",
    existingData: "尚未盤點。保留為研究者確認事項，不推定已有問卷、成績、訪談或平台紀錄。",
    availableData: "可優先評估課程文件、教師訪談與去識別化學習活動紀錄；實際可得性與授權仍待確認。",
    methodIdea: recommended.methodSketch,
    timeline: "先完成證據與可行性盤點，再由研究者確認期程；目前不填入未經授權的截止日。",
    constraints: "樣本、資料權限、量測工具、研究人力與預算均尚未確認；不得以假設值替代。",
    ethicsPrivacyRisks: "需評估知情同意、學生與教師權力關係、資料最小化、去識別化與模型輔助揭露。",
    unresolvedItems: "主要構念操作化、樣本框、資料取得、倫理審查、目標期刊與正式引用均待人工確認。",
  };
  return { researchDirection, directions, recommendedDirectionId: recommended.id, s0Draft, generationEffectCount: 1, formalWriteCount: 0 };
}

export type V2FactGuidance = { id: string; label: string; status: "ASSUMPTION"; guidance: string; invalidation: string };

export function createFactBoundGuidance(kind: "sample" | "budget" | "date" | "doi" | "numeric", context: string): V2FactGuidance[] {
  return [
    { id: `${kind}-minimum`, label: "最小可行", status: "ASSUMPTION", guidance: `${context}；先列出可取得資料與最低驗證條件，不填入推測值。`, invalidation: "正式資料盤點顯示最低條件仍不可達。" },
    { id: `${kind}-balanced`, label: "平衡規劃", status: "ASSUMPTION", guidance: `${context}；以主要研究問題、可行資源與審查需求共同界定。`, invalidation: "研究問題或可用資源發生實質改變。" },
    { id: `${kind}-expanded`, label: "擴充情境", status: "ASSUMPTION", guidance: `${context}；僅列出需要新增的資料、資源與驗證步驟。`, invalidation: "新增資源未獲確認或無法維持資料品質。" },
  ];
}

export const V2_SUGGESTION_STRATEGIES = ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"] as const;
export type V2SuggestionStrategy = (typeof V2_SUGGESTION_STRATEGIES)[number];
export type V2SuggestionOption = { strategy: V2SuggestionStrategy; text: string; rationale: string; boundary: "UNVERIFIED" | "ASSUMPTION" | "MISSING_DATA" };

export function parseV2SuggestionEnvelope(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("v2_suggestion_envelope_invalid");
  const input = value as Record<string, unknown>;
  if (input.contractVersion !== "old-mike-v2-suggestion/1.0.0") throw new Error("v2_suggestion_contract_version_invalid");
  if (input.completionClass !== "COMPLETE" && input.completionClass !== "PARTIAL_REVIEW_REQUIRED") throw new Error("v2_suggestion_completion_class_invalid");
  if (!Array.isArray(input.options) || input.options.length !== 3) throw new Error("v2_suggestion_option_count_invalid");
  const options = input.options as unknown[];
  const validOptions: V2SuggestionOption[] = [];
  const invalidOptionIndexes: number[] = [];
  options.forEach((option, index) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) { invalidOptionIndexes.push(index); return; }
    const item = option as Record<string, unknown>;
    const valid = V2_SUGGESTION_STRATEGIES.includes(item.strategy as V2SuggestionStrategy)
      && typeof item.text === "string" && item.text.trim().length > 0 && item.text.length <= 4_000
      && typeof item.rationale === "string" && item.rationale.trim().length > 0 && item.rationale.length <= 1_000
      && (item.boundary === "UNVERIFIED" || item.boundary === "ASSUMPTION" || item.boundary === "MISSING_DATA");
    if (!valid) { invalidOptionIndexes.push(index); return; }
    validOptions.push({ strategy: item.strategy as V2SuggestionStrategy, text: item.text as string, rationale: item.rationale as string, boundary: item.boundary as V2SuggestionOption["boundary"] });
  });
  if (!validOptions.length) throw new Error("v2_suggestion_no_valid_option");
  return { completionClass: input.completionClass as "COMPLETE" | "PARTIAL_REVIEW_REQUIRED", options, validOptions, invalidOptionIndexes };
}
