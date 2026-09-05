import "server-only";

import { S0_FIELD_LIMITS, S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import {
  V2_ALPHA8_CONTRACT_VERSION,
  V2_ALPHA8_CORE_SECTIONS,
  alpha8Hash,
  parseV2Alpha8CreateRequest,
  validateV2Alpha8StageA,
  validateV2Alpha8StageB,
  validateV2Alpha8Workspace,
  type V2Alpha8AnalysisWorkPackage,
  type V2Alpha8ContinuedSection,
  type V2Alpha8CreateRequest,
  type V2Alpha8Direction,
  type V2Alpha8MaterialInput,
  type V2Alpha8MaterialRecord,
  type V2Alpha8S0Entry,
  type V2Alpha8S0Alternative,
  type V2Alpha8StageAArtifact,
  type V2Alpha8StageBArtifact,
  type V2Alpha8Workspace,
} from "./contracts.ts";
import { deriveAlpha8ResearchFrame, normalizeAlpha8PublicationText } from "./semantic-grounding.ts";

function materialRecords(materials: V2Alpha8MaterialInput[]): V2Alpha8MaterialRecord[] {
  return materials.map((material) => ({ ...material, contentHash: alpha8Hash(material.content), evidenceState: "OBSERVED" }));
}

function compact(value: string, maximum = 360) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, Math.max(1, maximum - 1)).trimEnd()}…`;
}

function materialByKind(materials: V2Alpha8MaterialRecord[], kinds: string[]) {
  return materials.filter((material) => kinds.includes(material.kind));
}

function materialIds(materials: V2Alpha8MaterialRecord[], kinds?: string[]) {
  const selected = kinds ? materialByKind(materials, kinds) : materials;
  return selected.map((material) => material.materialId);
}

function firstMaterial(materials: V2Alpha8MaterialRecord[], kinds: string[]) {
  return materialByKind(materials, kinds)[0] ?? materials[0];
}

function goalLabel(goal: V2Alpha8CreateRequest["goal"]) {
  void goal;
  return "國際期刊論文";
}

function createDirection(input: Omit<V2Alpha8Direction, "contentHash">): V2Alpha8Direction {
  const normalized = {
    ...input,
    title: normalizeAlpha8PublicationText(input.title),
    researchQuestion: normalizeAlpha8PublicationText(input.researchQuestion),
    rationale: normalizeAlpha8PublicationText(input.rationale),
    methodOptimization: normalizeAlpha8PublicationText(input.methodOptimization),
    expectedContribution: normalizeAlpha8PublicationText(input.expectedContribution),
    limitations: input.limitations.map(normalizeAlpha8PublicationText),
  };
  return { ...normalized, contentHash: alpha8Hash(normalized) };
}

function createStageA(request: V2Alpha8CreateRequest, materials: V2Alpha8MaterialRecord[], sourceBundleHash: string): V2Alpha8StageAArtifact {
  const allMaterialIds = materialIds(materials);
  const safeStatisticIds = request.statistics.filter((item) => item.consistency === "CONSISTENT_REPORTED").map((item) => item.statisticId);
  const target = goalLabel(request.goal);
  const methods = materialByKind(materials, ["METHODS", "EXPERIMENT_DATA", "SURVEY_DATA"])[0];
  const evidence = firstMaterial(materials, ["RESULTS", "EXPERIMENT_DATA", "SURVEY_DATA", "TABLE", "ABSTRACT", "INTRODUCTION"]);
  const frame = deriveAlpha8ResearchFrame(materials);
  const methodLabel = frame.methodLabel ?? "研究設計與分析策略";
  const methodDetail = frame.methodDetail ?? "研究設計尚待依研究問題、資料來源與可行樣本具體化";
  const balancedTitle = frame.methodLabel ? `${frame.titleStem}：${frame.methodLabel}` : `${frame.titleStem}：作用機制與證據邊界`;
  const directions = [
    createDirection({
      directionId: "alpha8-evidence-first",
      lane: "EVIDENCE_FIRST",
      title: `${frame.titleStem}：證據一致性、可重現性與效應邊界`,
      researchQuestion: `採用${methodLabel}時，「${frame.titleStem}」的觀察證據能否由資料版本、樣本與量測紀錄重現，哪些推論仍缺乏直接支持？`,
      rationale: `此方向以「${evidence.title}」${methods ? `與「${methods.title}」` : ""}所載的${frame.titleStem}為主題，優先修復證據、統計與文字的對應，再形成可投稿的論證。`,
      methodOptimization: `${methodDetail}；另建立變項字典、樣本權威、統計重現步驟與結果—表圖—主張對照表。`,
      expectedContribution: `針對「${frame.titleStem}」建立可稽核證據鏈與清楚推論邊界，判定「${frame.outcomeSummary}」可支持的主張範圍。`,
      evidenceMaterialIds: allMaterialIds,
      evidenceStatisticIds: safeStatisticIds,
      limitations: ["目前未執行外部文獻檢索，研究新穎性仍待後續核對。", "使用者提供的數值維持觀察狀態，不能自動升級為已驗證結果。"],
      recommended: false,
    }),
    createDirection({
      directionId: "alpha8-balanced",
      lane: "BALANCED_RECOMMENDED",
      title: balancedTitle,
      researchQuestion: `在${methodLabel}所界定的樣本與資料條件下，「${frame.titleStem}」是否獲得一致支持，其作用機制與適用邊界為何？`,
      rationale: `此方向直接保留${frame.titleStem}的核心主題，以${methodLabel}銜接研究問題、方法與結果，最適合發展為完整${target}。`,
      methodOptimization: `${methodDetail}；依序固定樣本與變項、建立分析決策表、執行主要與敏感度分析，並整合定量與質性證據。`,
      expectedContribution: `釐清「${frame.titleStem}」的可反駁作用機制，並以「${frame.outcomeSummary}」作為待核對觀察，連結研究設計、分析與實務建議。`,
      evidenceMaterialIds: allMaterialIds,
      evidenceStatisticIds: safeStatisticIds,
      limitations: ["正式效果量、顯著性與因果解釋必須以可重現分析為準。", "目標期刊或計畫年度規範尚未在本機概念模式中查證。"],
      recommended: true,
    }),
    createDirection({
      directionId: "alpha8-frontier",
      lane: "FRONTIER_INNOVATION",
      title: `${frame.titleStem}：情境異質性、失效條件與跨場域可遷移性`,
      researchQuestion: `在${methodLabel}基礎上，「${frame.titleStem}」於不同對象或場域中何時失效，「${frame.outcomeSummary}」是否呈現可解釋的異質性，並可由哪些後續資料反駁？`,
      rationale: `此方向以${frame.titleStem}為固定主題，從負向案例、異質效果與跨域條件重新組織研究問題，原創性較高但證據負擔也較高。`,
      methodOptimization: `${methodDetail}；再加入邊界案例取樣、替代機制比較與異質性分析。未來情境與趨勢敘述均維持待文獻核驗。`,
      expectedContribution: `把「${frame.titleStem}」提升為可檢驗的邊界理論，界定「${frame.outcomeSummary}」可成立與不可外推的條件。`,
      evidenceMaterialIds: allMaterialIds,
      evidenceStatisticIds: safeStatisticIds,
      limitations: ["前沿性是材料推導而非已證實趨勢。", "跨場域外推需要新增樣本與獨立驗證。"],
      recommended: false,
    }),
  ] as V2Alpha8StageAArtifact["directions"];
  const core = {
    schemaId: "old-mike-v2-alpha8/stage-a/1" as const,
    sourceBundleHash,
    directions,
    recommendedDirectionId: "alpha8-balanced",
  };
  return validateV2Alpha8StageA({ ...core, artifactHash: alpha8Hash(core) }, sourceBundleHash, new Set(allMaterialIds), new Set(safeStatisticIds));
}

function s0Entry(value: string, materialIdsValue: string[], statisticIds: string[] = [], evidenceState: V2Alpha8S0Entry["evidenceState"] = "OBSERVED"): V2Alpha8S0Entry {
  return { value: normalizeAlpha8PublicationText(value), evidenceState, materialIds: materialIdsValue, statisticIds };
}

function createS0(request: V2Alpha8CreateRequest, materials: V2Alpha8MaterialRecord[], stageA: V2Alpha8StageAArtifact): Record<S0FieldName, V2Alpha8S0Entry> {
  const direction = stageA.directions.find((item) => item.directionId === stageA.recommendedDirectionId)!;
  const all = materialIds(materials);
  const data = materialIds(materials, ["RESULTS", "EXPERIMENT_DATA", "SURVEY_DATA", "TABLE", "FIGURE"]);
  const safeStats = request.statistics.filter((item) => item.consistency === "CONSISTENT_REPORTED").map((item) => item.statisticId);
  const map: Record<S0FieldName, V2Alpha8S0Entry> = {
    workingTitle: s0Entry(direction.title, all),
    domain: s0Entry(request.focusDomain.label, all),
    outputTrack: s0Entry("學術論文", all),
    problemContext: s0Entry(`現有半成品已提供${materials.map((item) => item.title).join("、")}，但仍需把研究問題、作用機制、分析與成果敘述整理為一致的專業研究脈絡。`, all),
    targetUsers: s0Entry("研究對象與實施場域以現有方法與資料材料為準；正式納入排除條件、樣本框及權力關係仍需從原始研究紀錄確認。", materialIds(materials, ["METHODS", "EXPERIMENT_DATA", "SURVEY_DATA"]).length ? materialIds(materials, ["METHODS", "EXPERIMENT_DATA", "SURVEY_DATA"]) : all, [], "UNVERIFIED"),
    expectedContribution: s0Entry(direction.expectedContribution, all),
    existingData: s0Entry(`目前已盤點 ${materials.length} 類材料與 ${request.statistics.length} 筆結構化統計摘要；原始內容保持不變。`, all, request.statistics.map((item) => item.statisticId)),
    availableData: s0Entry(data.length ? "可用資料包括已提供的結果、實驗、問卷、表格或圖形摘要；仍需確認原始檔、欄位字典與缺失值規則。" : "尚未提供足以形成研究結果的資料；目前只可建立資料需求與分析規格。", data.length ? data : all, [], data.length ? "OBSERVED" : "MISSING"),
    methodIdea: s0Entry(direction.methodOptimization, materialIds(materials, ["METHODS", "EXPERIMENT_DATA", "SURVEY_DATA"]).length ? materialIds(materials, ["METHODS", "EXPERIMENT_DATA", "SURVEY_DATA"]) : all, safeStats),
    timeline: s0Entry("先完成材料與統計一致性盤點，再依資料可用性執行分析、補寫六個核心章節、進行終稿校閱與投稿／計畫規範檢查。", [], [], "ASSUMPTION"),
    constraints: s0Entry("目前限制包括資料版本、樣本權威、量測品質、缺失值處理、文獻新穎性與目標規範尚未全部核對。", all),
    ethicsPrivacyRisks: s0Entry("後續需確認知情同意、資料最小化、去識別化、敏感欄位、二次利用授權與研究者權力關係；本機草稿不推定已取得倫理核准。", all, [], "UNVERIFIED"),
    unresolvedItems: s0Entry("正式文獻核驗、資料字典、樣本與排除規則、統計重現、效果量、目標期刊／計畫年度規範及倫理核准狀態仍待確認。", all, request.statistics.map((item) => item.statisticId), "UNVERIFIED"),
  };
  if (Object.keys(map).length !== S0_FIELD_NAMES.length) throw new Error("alpha8_s0_internal_invalid");
  return map;
}

function createS0Alternatives(s0: Record<S0FieldName, V2Alpha8S0Entry>): V2Alpha8StageBArtifact["s0Alternatives"] {
  const output = {} as V2Alpha8StageBArtifact["s0Alternatives"];
  const fit = (value: string, field: S0FieldName) => compact(value, S0_FIELD_LIMITS[field]);
  const domain = s0.domain.value;
  const title = compact(s0.workingTitle.value, 96);
  const alternatives: Record<S0FieldName, [string, string, string]> = {
    workingTitle: [
      fit(`${domain}既有材料之證據鏈重建、作用機制與適用邊界研究`, "workingTitle"),
      s0.workingTitle.value,
      fit(`${domain}跨場域機制、失效條件與可移轉性之前瞻研究`, "workingTitle"),
    ],
    domain: [
      fit(`${domain}實證設計與證據整合`, "domain"),
      s0.domain.value,
      fit(`${domain}跨域機制與未來治理`, "domain"),
    ],
    outputTrack: ["實證研究論文", s0.outputTrack.value, "跨域前瞻論文"],
    problemContext: [
      fit(`以現有材料可直接支持的問題為起點，先釐清樣本、變項、資料版本與可反駁主張，再建立「${title}」的研究缺口；不以尚未核驗的熱門性取代研究問題。`, "problemContext"),
      s0.problemContext.value,
      fit(`把現有半成品中的局部問題重構為跨情境機制問題：哪些條件使「${title}」成立、失效或產生非預期結果，並據此界定未來十年可被實證檢驗的研究路線。`, "problemContext"),
    ],
    targetUsers: [
      fit("只納入現有方法、資料或研究紀錄能明確辨識的研究對象與場域；在樣本框、納排條件及權力關係完成核對前，不擴張母群推論。", "targetUsers"),
      s0.targetUsers.value,
      fit("以既有核心研究對象為主樣本，另規劃一個具理論理由的比較場域或次群體，用來檢驗機制可移轉性與失效邊界；新增對象須另行確認招募與倫理可行性。", "targetUsers"),
    ],
    expectedContribution: [
      fit("建立一套可由原始材料、統計摘要與章節主張逐項回溯的證據鏈，明確區分觀察、解釋與尚待驗證假設，並提供可重現的分析與寫作基準。", "expectedContribution"),
      s0.expectedContribution.value,
      fit(`提出可跨場域檢驗的${domain}作用機制與失效條件模型，連結方法創新、實務決策與後續縱向研究，同時把未經文獻驗證的新穎性保留為待檢證假設。`, "expectedContribution"),
    ],
    existingData: [
      fit("先把已提供的稿件段落、資料摘要、統計值、表圖與引用建立版本清單，逐一標示來源、內容雜湊、可支持主張及衝突狀態；未列入清單者不作為結果依據。", "existingData"),
      s0.existingData.value,
      fit("在不改動原始材料的前提下，將文字、問卷／實驗資料、表圖與引用整理為可互相核對的多模態研究資產，為後續跨資料來源三角驗證預留結構。", "existingData"),
    ],
    availableData: [
      fit("僅把已取得且可確認版本、欄位、樣本分母與授權狀態的資料列為可用；其餘項目改列資料需求，不以預期資料生成研究結果。", "availableData"),
      s0.availableData.value,
      fit("除現有資料外，規劃最小增補資料集與一項外部效度檢核資料；是否蒐集取決於倫理、授權、成本與研究問題增益，不把尚未取得資料描述為現況。", "availableData"),
    ],
    methodIdea: [
      fit("採證據鏈優先的序列分析：先固定資料版本與變項字典，再執行資料品質、主要模型、假設檢查與敏感度分析，最後以表圖—數值—文字三方核對形成結果。", "methodIdea"),
      s0.methodIdea.value,
      fit("採機制導向的混合方法與失效邊界分析：以主要定量模型回答核心問題，再用質性或次群體證據檢驗替代解釋、情境差異與不可移轉條件。", "methodIdea"),
    ],
    timeline: [
      fit("第一階段完成材料、資料與統計權威盤點；第二階段執行可重現分析及表圖；第三階段續寫六個章節、核對引用並完成投稿前校閱。", "timeline"),
      s0.timeline.value,
      fit("並行推進證據盤點與機制模型設計，設置資料凍結、結果核對、完整初稿與投稿規格四個里程碑；任一前置證據未通過即不提前撰寫結果主張。", "timeline"),
    ],
    constraints: [
      fit("優先使用現有人力、設備與既有資料完成最小可發表研究；將樣本權威、資料清理、統計重現與引用核驗列為不可刪減工作，其餘擴充按研究增益排序。", "constraints"),
      s0.constraints.value,
      fit("把跨場域資料、進階量測與外部工具列為選配工作包，先設定停止條件、成本上限與替代方法，避免前瞻設計使時程或資源失控。", "constraints"),
    ],
    ethicsPrivacyRisks: [
      fit("研究啟動前逐項核對知情同意、二次利用授權、資料最小化、去識別化、敏感欄位與保存期限；缺少核准證據時，只能形成研究計畫而不得宣稱可直接執行。", "ethicsPrivacyRisks"),
      s0.ethicsPrivacyRisks.value,
      fit("除既有隱私與授權外，另評估跨資料連結造成的再識別、演算法偏誤、弱勢群體不利影響、XR／智慧介入負擔及跨場域治理責任。", "ethicsPrivacyRisks"),
    ],
    unresolvedItems: [
      fit("優先結清會改變研究結論的核心缺口：正式文獻核驗、資料版本與字典、樣本分母、納排規則、統計重現、效果量及倫理核准；未完成者保留明確阻擋狀態。", "unresolvedItems"),
      s0.unresolvedItems.value,
      fit("除核心證據缺口外，另驗證跨領域新穎性、未來趨勢依據、比較場域可行性、目標期刊契合度與可移轉性；這些項目在外部來源核驗前均屬研究假設。", "unresolvedItems"),
    ],
  };
  for (const field of S0_FIELD_NAMES) {
    const entry = s0[field];
    const values = alternatives[field];
    const strategies = ["EVIDENCE_CALIBRATED", "BALANCED_RECOMMENDED", "FRONTIER_REFRAME"] as const;
    const rationales = [
      "優先收斂到目前材料能直接支持的內容，減少過度推論。",
      "在研究價值、可行性與證據邊界之間取得平衡，作為老麥推薦版本。",
      "保留既有材料，同時提高跨域原創性與未來研究延展性；新穎性仍待文獻核驗。",
    ];
    output[field] = strategies.map((strategy, index) => {
      const core: Omit<V2Alpha8S0Alternative, "contentHash"> = {
        alternativeId: `alpha8-s0-${field}-${strategy.toLocaleLowerCase("en-US").replaceAll("_", "-")}`,
        strategy,
        value: normalizeAlpha8PublicationText(values[index]),
        rationale: rationales[index],
        evidenceState: strategy === "FRONTIER_REFRAME" ? "ASSUMPTION" : entry.evidenceState,
        materialIds: [...entry.materialIds],
        statisticIds: [...entry.statisticIds],
        recommended: strategy === "BALANCED_RECOMMENDED",
      };
      return { ...core, contentHash: alpha8Hash(core) };
    }) as V2Alpha8StageBArtifact["s0Alternatives"][S0FieldName];
  }
  return output;
}

function createWorkPackages(request: V2Alpha8CreateRequest, materials: V2Alpha8MaterialRecord[], conflictIds: string[], uncheckedIds: string[], resultsAvailable: boolean): V2Alpha8AnalysisWorkPackage[] {
  const all = materialIds(materials);
  const packages: V2Alpha8AnalysisWorkPackage[] = [{
    workPackageId: "alpha8-wp-evidence-map",
    title: "材料、變項與主張證據地圖",
    objective: "將現有文字、資料、統計、表圖與引用逐一綁定到研究問題與六個核心章節。",
    inputMaterialIds: all,
    inputStatisticIds: request.statistics.filter((item) => item.consistency === "CONSISTENT_REPORTED").map((item) => item.statisticId),
    steps: ["建立材料與版本清單，標示每項資料可支持的主張。", "建立變項字典、樣本權威與結果—表圖—文字對照表。", "標示缺口、矛盾與不得推論的內容。"],
    deliverables: ["證據地圖", "資料與變項字典", "缺口及矛盾清單"],
    claimPolicy: "OBSERVED_ONLY",
    blockedReasons: [],
  }];
  if (conflictIds.length) packages.push({
    workPackageId: "alpha8-wp-reconcile",
    title: "統計與資料版本調和",
    objective: "在撰寫結果前，釐清相互衝突的數值及其資料版本、排除規則與計算程序。",
    inputMaterialIds: all,
    inputStatisticIds: conflictIds,
    steps: ["追溯每個衝突值的來源材料與資料版本。", "重算樣本數、分母、缺失值與分析納入規則。", "形成唯一可稽核的結果表後才解鎖結果敘述。"],
    deliverables: ["統計調和紀錄", "唯一結果權威表"],
    claimPolicy: "RECONCILIATION_ONLY",
    blockedReasons: ["STATISTICAL_CONFLICT_REQUIRES_RESOLUTION"],
  });
  if (!resultsAvailable || uncheckedIds.length) packages.push({
    workPackageId: "alpha8-wp-analysis-plan",
    title: "可重現分析與表圖規格",
    objective: "在不虛構研究發現的前提下，將可用資料轉為可執行分析步驟與預定輸出。",
    inputMaterialIds: all,
    inputStatisticIds: uncheckedIds,
    steps: ["確認研究問題、主要／次要變項與分析單位。", "定義資料清理、假設檢查、主要分析、敏感度分析及表圖規格。", "分析完成後才依實際產物撰寫結果、討論與結論。"],
    deliverables: ["分析決策表", "表圖規格", "結果撰寫檢核表"],
    claimPolicy: "ANALYSIS_PLAN_ONLY",
    blockedReasons: [
      ...(!resultsAvailable ? ["RESULTS_MISSING_ANALYSIS_PLAN_ONLY"] : []),
      ...(uncheckedIds.length ? ["STATISTICS_UNCHECKED_REQUIRES_VALIDATION"] : []),
    ],
  });
  return packages;
}

function createSection(input: Omit<V2Alpha8ContinuedSection, "contentHash">): V2Alpha8ContinuedSection {
  const normalized = { ...input, text: normalizeAlpha8PublicationText(input.text) };
  return { ...normalized, contentHash: alpha8Hash(normalized) };
}

function createContinuedDraft(request: V2Alpha8CreateRequest, materials: V2Alpha8MaterialRecord[], stageA: V2Alpha8StageAArtifact, resultsAllowed: boolean): V2Alpha8StageBArtifact["continuedDraft"] {
  const direction = stageA.directions.find((item) => item.directionId === stageA.recommendedDirectionId)!;
  const relevant = (kinds: string[]) => materialByKind(materials, kinds);
  const refs = (kinds: string[]) => relevant(kinds).map((item) => item.materialId);
  const snippets = (kinds: string[]) => relevant(kinds)
    .map((item) => normalizeAlpha8PublicationText(compact(item.content, 260)).replace(/[。；]+$/u, ""))
    .filter(Boolean)
    .join("；");
  const all = materialIds(materials);
  const statisticIds = request.statistics.filter((item) => item.consistency === "CONSISTENT_REPORTED").map((item) => item.statisticId);
  const stats = request.statistics.filter((item) => item.consistency === "CONSISTENT_REPORTED").map((item) => `${item.label}=${item.value}${item.unit}`).join("；");
  const plan = (sectionId: V2Alpha8ContinuedSection["sectionId"], objective: string) => createSection({
    sectionId,
    mode: "PLAN_ONLY",
    text: `本節暫不撰寫研究發現。${objective}；完成資料版本、分析與證據核對後，再依實際結果形成可投稿文字。`,
    evidenceState: "MISSING",
    sourceMaterialIds: [],
    statisticIds: [],
    unresolvedItems: ["需要可重現分析產物", "不得以計畫或預期取代實際結果"],
  });
  const abstractRefs = refs(["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "EXPERIMENT_DATA", "SURVEY_DATA"]);
  const introductionRefs = refs(["INTRODUCTION", "ABSTRACT", "CITATION_LIBRARY", "NOTE"]);
  const methodRefs = refs(["METHODS", "EXPERIMENT_DATA", "SURVEY_DATA"]);
  const resultRefs = refs(["RESULTS", "EXPERIMENT_DATA", "SURVEY_DATA", "TABLE", "FIGURE"]);
  const discussionRefs = refs(["DISCUSSION", "RESULTS", "TABLE", "FIGURE", "CITATION_LIBRARY"]);
  return [
    resultsAllowed ? createSection({
      sectionId: "ABSTRACT",
      mode: "GENERATED",
      text: `本研究聚焦於「${direction.title}」，目的在釐清「${request.focusDomain.label}」情境中的作用機制、可觀察成效與適用邊界。研究整合研究目的、方法、結果與統計紀錄，並以可重現分析和證據校準限制推論範圍。${stats ? `描述性結果顯示：${stats}；` : "結果敘述仍須由分析產物逐項核對；"}本研究將形成研究問題、方法、結果與實務意涵一致的專業論證。`,
      evidenceState: "OBSERVED",
      sourceMaterialIds: abstractRefs.length ? abstractRefs : all,
      statisticIds,
      unresolvedItems: ["正式效果量與推論統計須以重現分析為準", "引用與新穎性待文獻核驗"],
    }) : plan("ABSTRACT", "先保留研究背景、目的與方法，結果及結論只建立補寫規格"),
    createSection({
      sectionId: "INTRODUCTION",
      mode: "REVISED",
      text: `${request.focusDomain.label}的研究價值不只在於是否產生表面成效，更在於釐清作用機制、情境條件與可被反駁的失效邊界。研究背景與初步紀錄顯示：${snippets(["INTRODUCTION", "ABSTRACT", "NOTE"]) || compact(materials[0].content, 320)}。因此，本研究問題為：${direction.researchQuestion} 本研究只在證據可支持的範圍內提出貢獻；尚未經外部文獻核驗的熱門或新興判斷，均維持待驗證狀態。`,
      evidenceState: "OBSERVED",
      sourceMaterialIds: introductionRefs.length ? introductionRefs : all,
      statisticIds: [],
      unresolvedItems: ["需以 OpenAlex、Semantic Scholar、Crossref 與 arXiv 核對文獻定位"],
    }),
    methodRefs.length ? createSection({
      sectionId: "METHODS",
      mode: "REVISED",
      text: `${snippets(["METHODS", "EXPERIMENT_DATA", "SURVEY_DATA"])}。在此設計基礎上，分析前將固定樣本與排除規則、變項字典、量測品質及缺失值處理，接續執行主要分析、敏感度分析與結果—表圖核對；倫理與隱私處理須依原始研究紀錄呈現，核准資訊未齊備時列為未解事項。`,
      evidenceState: "OBSERVED",
      sourceMaterialIds: methodRefs,
      statisticIds: [],
      unresolvedItems: ["樣本框與排除規則", "量測品質", "倫理與資料授權"],
    }) : plan("METHODS", "先依研究問題、資料來源與可行樣本補齊研究設計、量測與分析規格"),
    resultsAllowed ? createSection({
      sectionId: "RESULTS",
      mode: "GENERATED",
      text: `依據研究結果、資料與表圖紀錄，描述性資訊為：${stats || snippets(["RESULTS", "TABLE", "FIGURE", "EXPERIMENT_DATA", "SURVEY_DATA"])}。上述內容僅代表研究紀錄中的描述性觀察；在完成資料版本、樣本分母、缺失值、模型設定與敏感度分析核對前，不延伸為因果、顯著性或外部可推廣性主張。`,
      evidenceState: "OBSERVED",
      sourceMaterialIds: resultRefs,
      statisticIds,
      unresolvedItems: ["需由可重現分析確認所有數值與表圖", "不得將描述值自動解讀為因果效果"],
    }) : plan("RESULTS", "先完成資料清理、統計調和、主要與敏感度分析及表圖產出"),
    resultsAllowed ? createSection({
      sectionId: "DISCUSSION",
      mode: "REVISED",
      text: `討論將依據研究問題檢視作用機制與情境：${direction.researchQuestion} ${snippets(["DISCUSSION", "RESULTS"]) || "討論內容仍須與實際分析結果逐項對照"}。研究意涵將區分資料直接支持的觀察、仍待驗證的機制解釋與未來研究假設，並檢查替代解釋、負向案例、量測偏誤及跨場域外推限制。`,
      evidenceState: "UNVERIFIED",
      sourceMaterialIds: discussionRefs.length ? discussionRefs : resultRefs,
      statisticIds,
      unresolvedItems: ["機制解釋仍需證據核對", "外部效度與替代解釋待檢查"],
    }) : plan("DISCUSSION", "待實際結果完成後，再區分直接觀察、可能機制、替代解釋與限制"),
    resultsAllowed ? createSection({
      sectionId: "CONCLUSION",
      mode: "GENERATED",
      text: `本研究形成一條從「${request.focusDomain.label}」的實務問題、作用機制與研究設計連結至可觀察結果的研究路徑。其主要價值在於${direction.expectedContribution}。最終結論只保留經資料與引用核對的主張，並把未解問題明確列為限制與後續研究方向。`,
      evidenceState: "UNVERIFIED",
      sourceMaterialIds: all,
      statisticIds,
      unresolvedItems: ["終稿結論須與已驗證結果及引用逐項一致"],
    }) : plan("CONCLUSION", "待結果與討論完成後，再依證據形成限制明確的結論"),
  ];
}

function createStageB(request: V2Alpha8CreateRequest, materials: V2Alpha8MaterialRecord[], sourceBundleHash: string, stageA: V2Alpha8StageAArtifact): V2Alpha8StageBArtifact {
  const conflictIds = request.statistics.filter((item) => item.consistency === "CONFLICT_REPORTED").map((item) => item.statisticId);
  const uncheckedIds = request.statistics.filter((item) => item.consistency === "UNCHECKED").map((item) => item.statisticId);
  const resultMaterials = materialByKind(materials, ["RESULTS", "TABLE", "FIGURE"]);
  const resultsAvailable = request.resultReadiness === "OBSERVED_RESULTS_AVAILABLE" && resultMaterials.length > 0;
  const resultsNarrativeAllowed = resultsAvailable && conflictIds.length === 0 && uncheckedIds.length === 0;
  const blockedReasons = [
    ...(!resultsAvailable ? ["RESULTS_MISSING_ANALYSIS_PLAN_ONLY"] : []),
    ...(conflictIds.length ? ["STATISTICAL_CONFLICT_REQUIRES_RESOLUTION"] : []),
    ...(uncheckedIds.length ? ["STATISTICS_UNCHECKED_REQUIRES_VALIDATION"] : []),
  ];
  const s0 = createS0(request, materials, stageA);
  const core = {
    schemaId: "old-mike-v2-alpha8/stage-b/1" as const,
    sourceBundleHash,
    stageAArtifactHash: stageA.artifactHash,
    selectedDirectionId: stageA.recommendedDirectionId,
    s0,
    s0Alternatives: createS0Alternatives(s0),
    analysisWorkPackages: createWorkPackages(request, materials, conflictIds, uncheckedIds, resultsAvailable),
    continuedDraft: createContinuedDraft(request, materials, stageA, resultsNarrativeAllowed),
    resultsNarrativeAllowed,
    blockedReasons,
  };
  return validateV2Alpha8StageB(
    { ...core, artifactHash: alpha8Hash(core) },
    sourceBundleHash,
    stageA,
    new Set(materials.map((item) => item.materialId)),
    new Set(request.statistics.map((item) => item.statisticId)),
    conflictIds,
    uncheckedIds,
    resultsAvailable,
  );
}

export function createSyntheticV2Alpha8Workspace(raw: unknown): V2Alpha8Workspace {
  const request = parseV2Alpha8CreateRequest(raw);
  const materials = materialRecords(request.materials);
  const sourceBundleHash = alpha8Hash({ focusDomain: request.focusDomain, goal: request.goal, resultReadiness: request.resultReadiness, materials, statistics: request.statistics });
  const stageA = createStageA(request, materials, sourceBundleHash);
  const stageB = createStageB(request, materials, sourceBundleHash, stageA);
  return validateV2Alpha8Workspace({
    contractVersion: V2_ALPHA8_CONTRACT_VERSION,
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    requestHash: alpha8Hash(request),
    focusDomain: request.focusDomain,
    goal: request.goal,
    resultReadiness: request.resultReadiness,
    sourceBundleHash,
    sourcePreserved: true,
    materials,
    statistics: request.statistics,
    stageA,
    stageB,
    status: stageB.blockedReasons.length ? "READY_WITH_GAPS" : "READY",
    syntheticGenerationStageCount: 2,
    liveProviderSubmissionCount: 0,
    cardSwitchProviderSubmissionCount: 0,
    formalResearchWriteCount: 0,
    onlineDatabaseWriteCount: 0,
    externalMutationCount: 0,
    persistenceClass: "PROCESS_LOCAL_LOCAL_PROTOTYPE",
    humanGate: { required: true, scope: "WHOLE_ARTIFACT_HANDOFF", confirmed: false, contentHash: alpha8Hash({ stageA: stageA.artifactHash, stageB: stageB.artifactHash }) },
  });
}

export function createV2Alpha8Coordinator(generate: (request: V2Alpha8CreateRequest) => Promise<V2Alpha8Workspace> = async (request) => createSyntheticV2Alpha8Workspace(request)) {
  const settled = new Map<string, { requestHash: string; result: V2Alpha8Workspace }>();
  const pending = new Map<string, { requestHash: string; promise: Promise<V2Alpha8Workspace> }>();
  const uncertain = new Map<string, string>();
  return {
    persistenceClass: "PROCESS_LOCAL_LOCAL_PROTOTYPE" as const,
    async run(raw: unknown, scope: string) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,319}$/u.test(scope)) throw new Error("alpha8_scope_invalid");
      const request = parseV2Alpha8CreateRequest(raw);
      const expectedRequest = structuredClone(request);
      const key = `${scope}:${expectedRequest.idempotencyKey}`;
      const requestHash = alpha8Hash(expectedRequest);
      const unknownHash = uncertain.get(key);
      if (unknownHash) {
        if (unknownHash !== requestHash) throw new Error("alpha8_idempotency_conflict");
        throw new Error("alpha8_completion_unknown_no_resend");
      }
      const prior = settled.get(key);
      if (prior) {
        if (prior.requestHash !== requestHash) throw new Error("alpha8_idempotency_conflict");
        return { workspace: structuredClone(prior.result), replayed: true, syntheticGenerationStagesAdded: 0 as const, liveProviderSubmissionsAdded: 0 as const };
      }
      const active = pending.get(key);
      if (active) {
        if (active.requestHash !== requestHash) throw new Error("alpha8_idempotency_conflict");
        return { workspace: structuredClone(await active.promise), replayed: true, syntheticGenerationStagesAdded: 0 as const, liveProviderSubmissionsAdded: 0 as const };
      }
      const promise = generate(structuredClone(expectedRequest)).then((result) => validateV2Alpha8Workspace(result, expectedRequest));
      pending.set(key, { requestHash, promise });
      try {
        const result = await promise;
        settled.set(key, { requestHash, result: structuredClone(result) });
        return { workspace: result, replayed: false, syntheticGenerationStagesAdded: 2 as const, liveProviderSubmissionsAdded: 0 as const };
      } catch (error) {
        if (error instanceof Error && error.message === "alpha8_completion_unknown") uncertain.set(key, requestHash);
        throw error;
      } finally {
        pending.delete(key);
      }
    },
  };
}

export function alpha8DraftProjection(stageB: V2Alpha8StageBArtifact) {
  return Object.fromEntries(stageB.continuedDraft.map((section) => [section.sectionId, section.text])) as Record<(typeof V2_ALPHA8_CORE_SECTIONS)[number], string>;
}

export function applyAlpha8ContinuedDraft(current: Record<(typeof V2_ALPHA8_CORE_SECTIONS)[number], string>, currentHash: string, stageB: V2Alpha8StageBArtifact) {
  if (alpha8Hash(current) !== currentHash) throw new Error("alpha8_stale_draft_hash");
  return { original: structuredClone(current), applied: alpha8DraftProjection(stageB), sourceHash: currentHash, suggestionHash: stageB.artifactHash };
}

export function undoAlpha8ContinuedDraft(application: ReturnType<typeof applyAlpha8ContinuedDraft>) {
  return structuredClone(application.original);
}

export const V2_ALPHA8_RUNTIME_BOUNDARY = Object.freeze({
  transport: "LOCAL_SYNTHETIC_TWO_STAGE_ONLY",
  syntheticGenerationStagesPerNewRequest: 2,
  liveProviderSubmissionsPerNewRequest: 0,
  cardSwitchProviderSubmissions: 0,
  sourceMutation: "FORBIDDEN",
  formalResearchWrites: 0,
  onlineDatabaseWrites: 0,
  externalMutations: 0,
  productionRoute: "HARD_404",
});
