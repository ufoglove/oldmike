import { classifyZoteroDuplicates, sha256Zotero, type CitationMetadata } from "../v2-alpha4-r1/zotero-contracts.ts";
import {
  moeRequirementCategories,
  nstcRequirementCategories,
  parseProposalDraft,
  type ProposalDraft,
} from "../proposal-studio-contract.ts";
import { parseDomainSelection } from "../v2-alpha3/contracts.ts";
import {
  V2_ALPHA5_CONTRACT_VERSION,
  V2_ALPHA5_DIRECTION_LANES,
  V2_ALPHA5_DIRECTION_LIMIT,
  V2_ALPHA5_PROPOSAL_SCHEMA_ID,
  type V2Alpha5Direction,
  type V2Alpha5Workspace,
  type V2Alpha5WorkspaceRequest,
} from "./contracts.ts";
import { alpha5Hash, createAlpha5TargetSelection, parseOfficialSourceBundle } from "./official-source-bundle.ts";

type CoordinatorInput = V2Alpha5WorkspaceRequest & { scope: string };
type Settled = { requestHash: string; result: V2Alpha5Workspace };

const text = (value: unknown, code: string, min: number, max: number) => {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (normalized.length < min || normalized.length > max) throw new Error(code);
  return normalized;
};

export function parseAlpha5WorkspaceRequest(value: unknown): V2Alpha5WorkspaceRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("alpha5_request_shape_invalid");
  const input = value as Record<string, unknown>;
  const allowed = new Set(["contractVersion", "requestId", "domainSelection", "targetId", "researchDirection", "sourceBundle"]);
  if (Object.keys(input).some((key) => !allowed.has(key)) || input.contractVersion !== V2_ALPHA5_CONTRACT_VERSION) throw new Error("alpha5_request_shape_invalid");
  const requestId = text(input.requestId, "alpha5_request_id_invalid", 8, 160);
  const researchDirection = text(input.researchDirection, "alpha5_direction_invalid", 2, V2_ALPHA5_DIRECTION_LIMIT);
  const domainSelection = parseDomainSelection(input.domainSelection);
  if (input.targetId !== "NSTC" && input.targetId !== "MOE") throw new Error("alpha5_target_invalid");
  const sourceBundle = parseOfficialSourceBundle(input.sourceBundle, { targetId: input.targetId, domainSelectionHash: domainSelection.selectionHash });
  return { contractVersion: V2_ALPHA5_CONTRACT_VERSION, requestId, domainSelection, targetId: input.targetId, researchDirection, sourceBundle };
}

function createDirections(direction: string, domainLabel: string): V2Alpha5Direction[] {
  const seeds = [
    {
      lane: "DISCIPLINE_CORE_HIGH_FEASIBILITY" as const,
      title: `${domainLabel}中的${direction}：核心機制與可行性研究`,
      question: `在可取得資料與既有場域限制下，${direction}如何透過可檢驗機制改善核心問題？`,
      value: "優先建立可重現、可在計畫期程內驗證的領域核心證據。",
      mechanism: "以領域理論鏈結介入、機制與可觀察結果，避免把相關性當成因果。",
      context: `以${domainLabel}的可接近場域與明確對象為界，細節仍待研究者確認。`,
      method: "採分階段混合方法：先界定構念與可行性，再以對照或準實驗設計驗證。",
      contribution: "提供可重現的核心機制證據與可落地的實施條件。",
      risk: "場域取得與樣本數仍未知；以先導研究、功效評估與替代資料源降低風險。",
    },
    {
      lane: "CROSS_DOMAIN_BALANCED_RECOMMENDED" as const,
      title: `${direction}的跨域整合：從機制證據到可採用設計`,
      question: `${direction}在${domainLabel}與相鄰領域之間，哪些跨域機制能兼顧效益、可行性與公平性？`,
      value: "在理論新意、政策或實務價值與執行可行性之間取得平衡。",
      mechanism: "整合領域知識、使用情境與行為採用機制，建立可被反駁的跨域解釋。",
      context: `聚焦${domainLabel}，並以一個相鄰領域作為比較或轉譯情境。`,
      method: "採共創式設計、前後測與質性機制追蹤，使用預先登錄的整合分析計畫。",
      contribution: "產出可轉移的跨域設計原則、證據邊界與實施路徑。",
      risk: "跨域構念可能失焦；以共同定義、邊界條件與停止準則維持可解釋性。",
    },
    {
      lane: "EMERGING_FORWARD_HIGH_INNOVATION" as const,
      title: `${direction}的前瞻情境：新興方法、失效條件與治理框架`,
      question: `若新興方法被導入${domainLabel}的${direction}情境，其價值、失效條件與治理需求為何？`,
      value: "探索高不確定但可能改變研究與實務路徑的前瞻命題。",
      mechanism: "以情境推演、原型驗證與反事實測試區分可觀察證據與未驗證預測。",
      context: `以${domainLabel}的受控前瞻情境為界，不宣稱已形成趨勢或已證實效益。`,
      method: "採設計科學、情境實驗與敏感度分析，明列假設、信心與失效訊號。",
      contribution: "建立新興路徑的可檢驗原型、風險地圖與後續證據計畫。",
      risk: "外部效度與技術成熟度不確定；以分段停止點與基準方案避免過度投入。",
    },
  ];
  return seeds.map((seed, index) => {
    const base = {
      directionId: `direction-${index + 1}`,
      lane: seed.lane,
      workingTitle: seed.title,
      researchQuestion: seed.question,
      researchValue: seed.value,
      mechanismTheory: seed.mechanism,
      targetContext: seed.context,
      methodDesign: seed.method,
      expectedContribution: seed.contribution,
      feasibilityRisk: seed.risk,
      assumptions: ["研究對象、樣本規模與資料可得性尚待研究者確認。"],
      unresolvedItems: ["依當年度官方來源確認申請資格、期限與預算規則。"],
      recommended: seed.lane === "CROSS_DOMAIN_BALANCED_RECOMMENDED",
    };
    return { ...base, directionHash: alpha5Hash(base) };
  });
}

function createProposal(input: V2Alpha5WorkspaceRequest, direction: V2Alpha5Direction): ProposalDraft {
  const mode = input.targetId === "NSTC" ? "NSTC_RESEARCH" : "MOE_TEACHING_PRACTICE";
  const categories = mode === "NSTC_RESEARCH" ? nstcRequirementCategories : moeRequirementCategories;
  const budgetSource = input.sourceBundle.sources.find((item) => item.kind === "BUDGET");
  const operating = typeof budgetSource?.facts.operatingUnitCostTwd === "number" ? budgetSource.facts.operatingUnitCostTwd : 0;
  const material = typeof budgetSource?.facts.teachingMaterialUnitCostTwd === "number" ? budgetSource.facts.teachingMaterialUnitCostTwd : 0;
  const sourceUrl = mode === "NSTC_RESEARCH" ? "https://fixtures.invalid/nstc/alpha5" : "https://fixtures.invalid/moe/alpha5";
  const proposal: ProposalDraft = {
    mode,
    callProgram: { programName: `${input.targetId} Alpha5 本機合成申請週期（非官方）`, programCode: null, effectiveYear: input.sourceBundle.cycleYear },
    officialSource: { sourceUrl, authorityClass: mode === "NSTC_RESEARCH" ? "NSTC_OFFICIAL" : "MOE_OFFICIAL", retrievedAt: "2026-08-25T00:00:00.000Z", effectiveYear: input.sourceBundle.cycleYear, sourceHash: input.sourceBundle.bundleHash, humanVerified: false },
    bilingual: {
      titleZhTw: direction.workingTitle,
      titleEn: `A proposal on ${input.researchDirection} with explicit evidence boundaries`,
      abstractZhTw: `本計畫以「${input.researchDirection}」為研究者原始方向，依${direction.lane === "CROSS_DOMAIN_BALANCED_RECOMMENDED" ? "跨域平衡" : direction.lane === "DISCIPLINE_CORE_HIGH_FEASIBILITY" ? "領域核心" : "前瞻創新"}路徑建立可檢驗問題、方法、資料與風險契約。所有官方規則、期限及預算上限均維持未知，須於正式送件前依同一申請週期來源核對。`,
      abstractEn: "This local synthetic draft develops a testable research question, method, data plan, and risk boundary. Official rules, deadlines, and budget limits remain unknown until independently verified for the same application cycle.",
      keywordsZhTw: [input.researchDirection, input.domainSelection.label, "證據邊界"],
      keywordsEn: ["research design", "evidence boundary", "feasibility"],
    },
    narrative: {
      problem: `研究者原始方向為「${input.researchDirection}」。目前需要把此方向轉為可驗證的問題，並區分既有事實、待蒐集證據與方法假設。`,
      background: `${direction.targetContext}${direction.researchValue} 本段不主張尚未驗證的現況數據或政策效果。`,
      literatureGap: `Zotero 證據僅能支持背景、缺口、方法與討論；目前合成引用不足以證明缺口，需後續獨立引用稽核。`,
      aims: [`釐清${direction.mechanismTheory}`, "建立可重現的方法與資料品質檢查。", "界定結果可轉移的條件與失效情境。"],
      researchQuestions: [direction.researchQuestion],
      hypotheses: ["若核心機制成立，主要結果應呈現方向一致且可由預先指定資料指標檢驗的變化；此為待驗證假設。"],
      innovation: direction.lane === "EMERGING_FORWARD_HIGH_INNOVATION" ? "以前瞻情境與失效條件共同界定創新，避免把模型建議當成趨勢證據。" : "將機制、實施條件與證據邊界整合為可稽核研究契約。",
      significance: direction.researchValue,
      expectedImpact: `${direction.expectedContribution} 所有預期影響均屬建議，不是已證實成果。`,
      methods: direction.methodDesign,
      sample: "樣本來源、納入排除準則與規模須由研究者依場域與功效分析確認；目前不虛構人數。",
      data: "建立最小必要資料字典、來源授權、品質規則與缺失資料處理；不得把 Zotero metadata 當研究結果。",
      analysis: "預先指定主要與次要結果、模型假設、敏感度分析與質性編碼稽核，保留可重現版本。",
      ethics: "涉及人類參與者或可識別資料時，資料蒐集釋出前須經適用倫理審查；本草案不宣稱核准。",
      privacy: "採目的限制、資料最小化、分權存取與保存期限；正式方案須由研究者核定。",
      risks: [direction.feasibilityRisk, "官方規則與附件尚未人工核對，正式送件前不得標記完成。"],
      alternatives: ["若樣本或資料不足，先執行先導研究並縮小主要問題。", "若跨域構念無法對齊，退回領域核心方案。"],
    },
    modeSpecific: mode === "NSTC_RESEARCH" ? {
      kind: "NSTC_RESEARCH",
      cm03Narrative: "依研究問題、背景、缺口、目的、方法、可行性與預期產出組織的本機合成敘事；不宣稱符合當年度固定頁數或格式。",
      preliminaryEvidence: "目前僅有合成證據參照；初步資料與引用需由研究者補入並獨立核對。",
      feasibility: direction.feasibilityRisk,
      expectedOutputs: ["可稽核的研究設計與分析計畫", "經 Human Gate 核定的完整申請草案"],
    } : {
      kind: "MOE_TEACHING_PRACTICE",
      courseContext: `${input.domainSelection.label}課程或訓練場域，課程層級、修課人數與既有教學安排待確認。`,
      teachingProblem: direction.researchQuestion,
      intervention: "以可重現教學設計、實施紀錄與對照條件建立介入契約。",
      learningOutcomes: ["與教學問題對齊的可觀察學習成果", "可解釋的歷程與實施忠實度證據"],
      evaluationDesign: direction.methodDesign,
      implementationFidelity: "以課堂紀錄、活動完成度與偏離原因追蹤實施忠實度。",
      teachingArtifacts: ["教學活動設計與評量規準", "去識別化分析與反思紀錄"],
      reflectionPlan: "按里程碑比較預期與觀察結果，記錄未支持假設與下一輪修正。",
    },
    workPackages: [
      { workPackageId: "wp-001", title: "問題、證據與方法契約", objective: direction.researchQuestion, methods: "完成證據地圖、構念定義、場域與倫理可行性查核。", startMonth: 1, endMonth: 4 },
      { workPackageId: "wp-002", title: "執行、分析與成果整合", objective: direction.expectedContribution, methods: direction.methodDesign, startMonth: 5, endMonth: 12 },
    ],
    milestones: [
      { milestoneId: "milestone-001", workPackageId: "wp-001", dueMonth: 4, deliverable: "可稽核研究契約與風險清單" },
      { milestoneId: "milestone-002", workPackageId: "wp-002", dueMonth: 12, deliverable: "分析結果、限制與成果草案" },
    ],
    kpis: [
      { kpiId: "kpi-001", workPackageId: "wp-001", measure: "研究問題與證據邊界對齊", target: "所有核心主張均有證據狀態與失效條件", evidencePlan: "版本化證據地圖與 Human Gate 雜湊" },
      { kpiId: "kpi-002", workPackageId: "wp-002", measure: "方法與分析可重現性", target: "主要分析、敏感度分析與限制均可追溯", evidencePlan: "分析規格、輸出與版本紀錄" },
    ],
    team: [{ roleId: "role-001", role: "計畫主持人", responsibility: "核對研究問題、方法、官方要求與 Human Gate。", contribution: "維持整體學術與倫理責任。" }],
    resources: ["既有場域與設備可用性待研究者確認", "Zotero 僅保存引用 metadata 與選定筆記"],
    budget: {
      currency: "TWD",
      items: [
        { itemId: "budget-001", category: "OPERATING", unit: "批", quantity: 1, unitCostTwd: operating, subtotalTwd: operating, justification: "數值直接取自本機 BUDGET snapshot fixture，正式用途與規則仍為 UNKNOWN；支援 wp-001 的證據與方法契約。", workPackageId: "wp-001", ruleEvidenceStatus: "UNKNOWN" },
        { itemId: "budget-002", category: "OPERATING", unit: "批", quantity: 1, unitCostTwd: material, subtotalTwd: material, justification: "數值直接取自同週期 BUDGET snapshot fixture，非硬編碼官方上限；支援 wp-002 的執行與成果整合。", workPackageId: "wp-002", ruleEvidenceStatus: "UNKNOWN" },
      ],
      totalTwd: operating + material,
    },
    requirements: categories.map((category) => ({ category, status: "UNKNOWN", officialRule: `${category} 必須依 source bundle 中同申請週期的官方來源核對；目前不建立常青數值或期限。`, evidence: "LOCAL_SYNTHETIC_UNVERIFIED；不是現行官方事實。", remediation: "提交前取得當年度官方來源並由研究者核對。", sourceHash: input.sourceBundle.bundleHash })),
    attachments: [{ attachmentId: "attachment-001", label: "當年度官方附件清單（待來源核對）", required: true, status: "UNKNOWN", evidence: "本機合成來源未經人工確認。" }],
    unresolvedIssues: ["官方與校內截止日仍為 UNKNOWN。", "預算上限、比例與附件版本仍須同週期人工核對。", ...direction.unresolvedItems],
  };
  return parseProposalDraft(proposal);
}

function zoteroEvidence(intentHash: string) {
  const first: CitationMetadata = { title: "Synthetic evidence for proposal design", year: 2025, firstAuthor: "Lin", authors: ["Lin"], journal: "Synthetic Journal", doi: "10.5555/alpha5.fixture", pmid: null, arxiv: null, isbn: null };
  const duplicate = classifyZoteroDuplicates({ ...first, title: "Changed title with same DOI" }, [first]);
  return [{
    itemKey: "ZOTERO-ALPHA5-001",
    metadataHash: sha256Zotero(first),
    doi: first.doi,
    stableId: null,
    role: "BACKGROUND" as const,
    duplicateClass: duplicate.classification === "POSSIBLE_DUPLICATE_REVIEW" ? "POSSIBLE_REVIEW" as const : "EXACT" as const,
    authorityBoundary: "EVIDENCE_ONLY_NOT_OFFICIAL_RULE_OR_BUDGET" as const,
    intentHash,
  }].map(({ intentHash: _intentHash, ...item }) => item);
}

export function createSyntheticAlpha5Workspace(raw: V2Alpha5WorkspaceRequest): V2Alpha5Workspace {
  const input = parseAlpha5WorkspaceRequest(raw);
  const targetSelection = createAlpha5TargetSelection(input.targetId);
  const researchIntentHash = alpha5Hash({ domainSelectionHash: input.domainSelection.selectionHash, targetSelectionHash: targetSelection.selectionHash, sourceBundleHash: input.sourceBundle.bundleHash, researchDirection: input.researchDirection });
  const directions = createDirections(input.researchDirection, input.domainSelection.label);
  if (directions.length !== 3 || new Set(directions.map((item) => item.lane)).size !== 3 || directions.filter((item) => item.recommended).length !== 1 || V2_ALPHA5_DIRECTION_LANES.some((lane) => !directions.some((item) => item.lane === lane))) throw new Error("alpha5_directions_contract_invalid");
  const proposalsByDirection = Object.fromEntries(directions.map((direction) => [direction.directionId, createProposal(input, direction)]));
  const recommended = directions.find((item) => item.recommended)!;
  const humanGateContentHash = alpha5Hash({ researchIntentHash, recommendedDirectionId: recommended.directionId, proposal: proposalsByDirection[recommended.directionId] });
  return {
    contractVersion: V2_ALPHA5_CONTRACT_VERSION,
    proposalSchemaId: V2_ALPHA5_PROPOSAL_SCHEMA_ID,
    researchIntentHash,
    domainSelection: input.domainSelection,
    targetSelection,
    sourceBundle: input.sourceBundle,
    directions,
    recommendedDirectionId: recommended.directionId,
    selectedDirectionId: recommended.directionId,
    proposalsByDirection,
    officialFacts: [
      { label: "官方截止日", ...input.sourceBundle.officialDeadline },
      { label: "校內截止日", ...input.sourceBundle.institutionalDeadline },
      { label: "預算規則", status: "UNKNOWN", value: null, sourceHash: input.sourceBundle.sources.find((item) => item.kind === "BUDGET")?.sourceHash ?? null },
    ],
    historicalObservations: [{ text: "歷史申請經驗僅供規劃參考，不代表本年度規則或審查偏好。", boundary: "HISTORICAL_NOT_CURRENT_RULE" }],
    oldMikeRecommendations: [{ text: "先完成可行性與來源核對，再由研究者決定是否進入正式版本。", boundary: "RECOMMENDATION_NOT_OFFICIAL_FACT" }],
    reviewerConcerns: [
      { concernId: "concern-source", text: "官方來源仍含未知、缺失或過期項目，正式提交前必須逐一核對。", severity: "BLOCKING_UNKNOWN" },
      { concernId: "concern-evidence", text: "背景與缺口目前只有本機合成 Zotero metadata 參照，不足以支持事實主張。", severity: "NEEDS_REVIEW" },
    ],
    zoteroEvidence: zoteroEvidence(researchIntentHash),
    humanGate: { required: true, scope: "WHOLE_ARTIFACT", confirmed: false, contentHash: humanGateContentHash },
    providerSubmissionCount: 1,
    cardSwitchProviderSubmissionCount: 0,
    formalResearchWriteCount: 0,
    onlineDatabaseWriteCount: 0,
    externalMutationCount: 0,
  };
}

export function createV2Alpha5Coordinator(generate: (input: V2Alpha5WorkspaceRequest) => Promise<V2Alpha5Workspace> = async (input) => createSyntheticAlpha5Workspace(input)) {
  const settled = new Map<string, Settled>();
  const pending = new Map<string, { requestHash: string; promise: Promise<V2Alpha5Workspace> }>();
  return {
    async run(raw: CoordinatorInput) {
      const { scope, ...request } = raw;
      const input = parseAlpha5WorkspaceRequest(request);
      const key = `${text(scope, "alpha5_scope_invalid", 3, 300)}:${input.requestId}`;
      const requestHash = alpha5Hash(input);
      const previous = settled.get(key);
      if (previous) {
        if (previous.requestHash !== requestHash) throw new Error("alpha5_idempotency_conflict");
        return { result: previous.result, replayed: true };
      }
      const inFlight = pending.get(key);
      if (inFlight) {
        if (inFlight.requestHash !== requestHash) throw new Error("alpha5_idempotency_conflict");
        return { result: await inFlight.promise, replayed: true };
      }
      const promise = generate(input);
      pending.set(key, { requestHash, promise });
      try {
        const result = await promise;
        settled.set(key, { requestHash, result });
        return { result, replayed: false };
      } finally { pending.delete(key); }
    },
  };
}
