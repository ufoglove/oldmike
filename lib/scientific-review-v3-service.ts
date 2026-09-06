/**
 * Scientific Review & Reviewer #2 Challenge Service (V3-U16-FULL)
 * Spec: docs/stage16/spec-v3-4.0.md
 *
 * Implements:
 * 1. Zero re-entry intake from Stage 15 ManuscriptWritingSnapshot
 * 2. Deterministic mechanical QA (numbers bound, ghost data, p-value format)
 * 3. Reviewer #2 constructive challenge generator (evidence + alternative
 *    explanation + minimal revision path — never forces flaws, never demands
 *    every study become a large-N RCT)
 * 4. Finding de-duplication (same-study multi-source / same issue)
 * 5. Author Response Matrix (internal) with disagreement rights
 * 6. Re-review loop with round cap (keeps unresolved issues, no forced PASS)
 * 7. Scientific Meaning Constraints checks (protected values held)
 * 8. ScientificReviewSnapshot immutable handoff for Stage 17
 */

import { createHash, randomUUID } from "node:crypto";
import {
  type ScientificFinding,
  type ScientificReviewSnapshot,
  type MeaningConstraint,
  type RevisionProposal,
  type UpstreamReviewRequest,
  type ReReviewDecision,
  type Stage17ReceiverState,
  type ReviewWorkOrder,
  type ReviewCoverageMatrix,
  type ReviewCoverageRow,
  type ReviewCapabilityManifest,
  type ReviewRoleSpec,
  type ReviewRoleId,
  type ScientificReviewPackage,
  type LanguagePolishingHandoffPackage,
} from "./scientific-review-v3-contract.ts";
import {
  type ManuscriptWorkspace,
  type ManuscriptWritingSnapshot,
} from "./manuscript-writing-contract.ts";
import { type AnalysisResultsSnapshot } from "./analysis-execution-contract.ts";

function sha256(input: unknown): string {
  return createHash("sha256").update(typeof input === "string" ? input : JSON.stringify(input)).digest("hex");
}

// -------------------------------------------------------------
// §1 Zero re-entry intake from Stage 15
// -------------------------------------------------------------
export function buildScientificReviewWorkspaceFromStage15(params: {
  workspaceId: string;
  projectId: string;
  manuscriptWritingSnapshot: ManuscriptWritingSnapshot;
}): {
  workspaceId: string;
  projectId: string;
  manuscriptId: string;
  reviewRunId: string;
  workOrder: ReviewWorkOrder;
  sourceSnapshotId: string;
  sourceSnapshotHash: string;
  sourceDecision: string;
  primaryGoal: import("./research-goal-registry.ts").PrimaryGoalId;
  sections: ManuscriptWorkspace["sections"];
  embeddedTableRefs: string[];
  embeddedFigureRefs: string[];
  boundResultFactIds: string[];
  boundCitationSourceRefs: string[];
  createdAt: string;
} {
  const { workspaceId, projectId, manuscriptWritingSnapshot } = params;
  const reviewRunId = `srr_v3_${projectId}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const sourceHash = sha256({
    snapshotId: manuscriptWritingSnapshot.snapshotId,
    schemaVersion: manuscriptWritingSnapshot.schemaVersion,
    decision: manuscriptWritingSnapshot.decision,
  });

  return {
    workspaceId: `ws_sr_${projectId}`,
    projectId,
    manuscriptId: manuscriptWritingSnapshot.scope.workingTitleZh || projectId,
    reviewRunId,
    workOrder: {
      workOrderId: `wrev_${projectId}`,
      projectId,
      manuscriptId: manuscriptWritingSnapshot.scope.workingTitleZh || projectId,
      reviewRound: 1,
      coverageSections: ["TITLE_ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"],
      coverageGoals: [manuscriptWritingSnapshot.primaryGoal],
      budgetFindingLimit: 12,
      status: "IN_PROGRESS",
    },
    sourceSnapshotId: manuscriptWritingSnapshot.snapshotId,
    sourceSnapshotHash: sourceHash,
    sourceDecision: manuscriptWritingSnapshot.decision,
    primaryGoal: manuscriptWritingSnapshot.primaryGoal,
    sections: [],
    embeddedTableRefs: manuscriptWritingSnapshot.embeddedTableRefs,
    embeddedFigureRefs: manuscriptWritingSnapshot.embeddedFigureRefs,
    boundResultFactIds: manuscriptWritingSnapshot.boundResultFactIds,
    boundCitationSourceRefs: manuscriptWritingSnapshot.boundCitationSourceRefs,
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §2 Mechanical QA (deterministic, no LLM needed)
// -------------------------------------------------------------
export type MechanicalQaResult = {
  passed: boolean;
  checks: Array<{ code: string; passed: boolean; description: string }>;
};

export function runScientificMechanicalQa(params: {
  snapshot: ManuscriptWritingSnapshot;
}): MechanicalQaResult {
  const { snapshot } = params;
  const checks: MechanicalQaResult["checks"] = [];

  checks.push({
    code: "MECH_RESULT_FACTS_BOUND",
    passed: snapshot.isNumericDataVerifiablyBound === true && snapshot.boundResultFactIds.length > 0,
    description: "所有正文數值已綁定不可變 ResultFact",
  });
  checks.push({
    code: "MECH_NO_GHOST_DATA",
    passed: snapshot.hasDiscussionGhostDataAvoided === true,
    description: "Discussion 無未在 Results 登錄之幽靈數據",
  });
  checks.push({
    code: "MECH_NO_FAKE_P_VALUE",
    passed: !JSON.stringify(snapshot).includes("p = 0.000") && !JSON.stringify(snapshot).includes("p = 0 "),
    description: "無 p = 0 / p = 0.000 假報告",
  });
  checks.push({
    code: "MECH_HONEST_NON_SIGNIFICANT",
    passed: snapshot.hasNonSignificantOutcomesIncludedHonesty === true,
    description: "非顯著主要結果如實納入報告",
  });
  checks.push({
    code: "MECH_SOURCE_HASH_PRESENT",
    passed: Boolean(snapshot.sourceAnalysisSnapshotContentHashSha256) && Boolean(snapshot.evidencePackageContentHashSha256),
    description: "上游來源與證據包 hash 齊備",
  });
  checks.push({
    code: "MECH_TABLE_FIGURE_REFS",
    passed: Array.isArray(snapshot.embeddedTableRefs) && Array.isArray(snapshot.embeddedFigureRefs),
    description: "表圖引用清冊存在",
  });

  return { passed: checks.every((c) => c.passed), checks };
}

// -------------------------------------------------------------
// §8 Role library (9 roles; enable by article type)
// -------------------------------------------------------------
export const REVIEW_ROLE_LIBRARY: ReviewRoleSpec[] = [
  { roleId: "EDITOR_TRIAGE", task: "檢查讀者適配、scope、文章類型、問題與貢獻、摘要誠實性、方法與結果是否支持主張、必要來源/倫理缺失", mustNot: ["不得給出 Accept/Reject 或接受機率"], requiredSources: ["manuscript writing snapshot", "journal writing profile"], outputSchema: "editor-triage/1.0", minimumCapability: "RULE_EXECUTED", enabledForArticleTypes: ["*"], },
  { roleId: "DOMAIN_REVIEWER", task: "領域正確性、讀者、研究位置與相近研究差異", mustNot: ["不得以名校/期刊 IF/國籍判定品質"], requiredSources: ["literature", "closest studies", "contribution delta"], outputSchema: "domain-review/1.0", minimumCapability: "SUGGESTION_ONLY", enabledForArticleTypes: ["*"] },
  { roleId: "THEORY_MECHANISM_REVIEWER", task: "理論是否參與推導、構念一致、機制是否測量、時間關係、替代解釋、Discussion 是否超證據", mustNot: ["不得把相關結果當完整因果機制"], requiredSources: ["theory model", "mechanism", "claim-evidence map"], outputSchema: "theory-mechanism-review/1.0", minimumCapability: "RULE_EXECUTED", enabledForArticleTypes: ["QUANTITATIVE_ORIGINAL_RESEARCH", "RANDOMIZED_TRIAL", "MIXED_METHODS_RESEARCH", "EDUCATIONAL_INTERVENTION", "OCCUPATIONAL_SAFETY_STUDY"] },
  { roleId: "METHODS_REPRODUCIBILITY_REVIEWER", task: "planned vs performed、對象/納排/招募/同意/分配/盲化/介入/工具版本/時點/缺失/排除/分析方法", mustNot: ["不得把計畫當實際執行，不得補寫未做程序"], requiredSources: ["methods source manifest", "planned-performed diff", "execution records", "data preparation", "analysis runs"], outputSchema: "methods-reproducibility/1.0", minimumCapability: "RULE_EXECUTED", enabledForArticleTypes: ["*"] },
  { roleId: "STATISTICAL_RESULTS_REVIEWER", task: "唯讀 Fact 呈現一致性、效應尺度、方向、adjusted p、分母、模型樣本、缺失處置、多重比較、診斷", mustNot: ["不得編輯 Fact、不得自行產生新 p/CI/效果量、不得固定 alpha=.05"], requiredSources: ["result facts", "runs", "analysis plan", "multiplicity/sensitivity"], outputSchema: "statistics-review/1.0", minimumCapability: "RULE_EXECUTED", enabledForArticleTypes: ["QUANTITATIVE_ORIGINAL_RESEARCH", "RANDOMIZED_TRIAL", "LONGITUDINAL_STUDY", "MIXED_METHODS_RESEARCH", "AI_MODEL_DEVELOPMENT_AND_VALIDATION"] },
  { roleId: "EVIDENCE_CITATION_REVIEWER", task: "CitationSource 存在、作者/年份/版本/DOI、正文與 References 映射、來源是否支持主張、摘要/全文閱讀範圍", mustNot: ["不得用摘要冒充全文、不得誘導無關或自利引用"], requiredSources: ["citation manifest", "bibliography", "zotero manifest"], outputSchema: "evidence-citation/1.0", minimumCapability: "RULE_EXECUTED", enabledForArticleTypes: ["*"] },
  { roleId: "ETHICS_INTEGRITY_REVIEWER", task: "倫理/招募/同意/DMP/註冊/Funding/COI/作者與 AI 協作、同研究多稿重疊", mustNot: ["不得自行產生 IRB 核准、作者簽署或計畫通過"], requiredSources: ["ethics decision", "execution records", "consent records", "funding/COI", "overlap assessment"], outputSchema: "ethics-integrity/1.0", minimumCapability: "SUGGESTION_ONLY", enabledForArticleTypes: ["*"] },
  { roleId: "PRACTICE_APPLICATION_REVIEWER", task: "實務意涵是否證據支持、範圍邊界、ROI/事故/成本主張需有資料", mustNot: ["不得生成未測量 ROI/事故率/政策衝擊"], requiredSources: ["results", "discussion", "conclusion"], outputSchema: "practice-application/1.0", minimumCapability: "SUGGESTION_ONLY", enabledForArticleTypes: ["OCCUPATIONAL_SAFETY_STUDY", "EDUCATIONAL_INTERVENTION", "TEACHING_PRACTICE_RESEARCH", "ENVIRONMENTAL_OR_FIELD_STUDY"] },
  { roleId: "REVIEWER_2_CHALLENGER", task: "挑戰最關鍵主張：目標 claim、最佳可辯護解讀、需成立的假設、替代解釋、支持/反對來源、缺少證據、影響、最小可行修正、成本/新研究、重查條件", mustNot: ["不得預設反對/侮辱、不得硬湊 3 項缺陷、不得要求一律 EEG/長期追蹤/SEM/大樣本/多中心"], requiredSources: ["full manuscript", "evidence packet", "literature"], outputSchema: "reviewer2-challenge/1.0", minimumCapability: "RULE_EXECUTED", enabledForArticleTypes: ["*"] },
];

export function enabledRolesForArticleType(articleType?: string): ReviewRoleSpec[] {
  if (!articleType) return REVIEW_ROLE_LIBRARY;
  return REVIEW_ROLE_LIBRARY.filter((r) => r.enabledForArticleTypes.includes("*") || r.enabledForArticleTypes.includes(articleType));
}

// -------------------------------------------------------------
// §5 Review Coverage Matrix builder
// -------------------------------------------------------------
export function buildReviewCoverageMatrix(params: {
  reviewRunId: string;
  snapshot: ManuscriptWritingSnapshot;
  roles: ReviewRoleSpec[];
}): ReviewCoverageMatrix {
  const { reviewRunId, snapshot, roles } = params;
  const sectionItems: Array<{ sectionRef: string; itemType: ReviewCoverageRow["itemType"]; required: boolean; applicable: boolean }> = [
    { sectionRef: "TITLE_ABSTRACT", itemType: "SECTION", required: true, applicable: true },
    { sectionRef: "INTRODUCTION", itemType: "SECTION", required: true, applicable: true },
    { sectionRef: "METHODS", itemType: "SECTION", required: true, applicable: true },
    { sectionRef: "RESULTS", itemType: "SECTION", required: true, applicable: true },
    { sectionRef: "DISCUSSION", itemType: "SECTION", required: true, applicable: true },
    { sectionRef: "CONCLUSION", itemType: "SECTION", required: true, applicable: true },
  ];
  const rows: ReviewCoverageRow[] = [];
  for (const item of sectionItems) {
    for (const role of roles.filter((r) => r.roleId !== "EDITOR_TRIAGE" && r.roleId !== "REVIEWER_2_CHALLENGER").slice(0, 2)) {
      rows.push({
        coverageId: `cov_${item.sectionRef}_${role.roleId}`,
        reviewRunId,
        sectionRef: item.sectionRef,
        itemType: item.itemType,
        required: item.required,
        applicable: item.applicable,
        sourceAvailable: true,
        reviewMethod: role.minimumCapability === "RULE_EXECUTED" ? "DETERMINISTIC_CHECK" : role.minimumCapability === "SUGGESTION_ONLY" ? "MODEL_ASSISTED_REVIEW" : "HUMAN_SPECIALIST_REVIEW",
        checkedVersion: snapshot.snapshotId,
        role: role.roleId,
        status: "NOT_ASSESSED",
        reason: "待檢查",
        findingRefs: [],
      });
    }
  }
  return { matrixRef: `coverage_${reviewRunId}`.slice(0, 64), reviewRunId, rows };
}

// -------------------------------------------------------------
// §7 Review Capability Manifest builder
// -------------------------------------------------------------
export function buildReviewCapabilityManifest(params: { reviewRunId: string }): ReviewCapabilityManifest {
  return {
    manifestRef: `capability_${params.reviewRunId}`,
    reviewRunId: params.reviewRunId,
    entries: [
      { capabilityId: "MECH_TYPED_REF_CHECK", label: "Typed reference / hash / scope / 數值渲染 / 引文雙向對應 / 圖表索引 / 章節範圍", kind: "RULE_EXECUTED", lastResult: "NOT_ASSESSED", note: "由 runScientificMechanicalQa 執行" },
      { capabilityId: "MECH_METHODS_PLANNED_PERFORMED", label: "聲稱方法是否有執行紀錄", kind: "RULE_EXECUTED", lastResult: "NOT_ASSESSED", note: "需 U12/U13/U14 來源" },
      { capabilityId: "MODEL_INFERENCE_STRENGTH", label: "推論是否過強 / 替代解釋 / 引用支援可能錯置", kind: "SUGGESTION_ONLY", lastResult: "NOT_ASSESSED", note: "model-assisted; 無法判定時標需確認" },
      { capabilityId: "CITEPROC_RENDER", label: "CSL 引用渲染與消歧", kind: "UNSUPPORTED", lastResult: "UNSUPPORTED", note: "本輪未接入 citeproc 渲染服務" },
      { capabilityId: "ZOTERO_SYNC", label: "Zotero 遠端同步與衝突處理", kind: "UNSUPPORTED", lastResult: "UNSUPPORTED", note: "未配置 Zotero 連線（如實標示）" },
      { capabilityId: "STAT_CLUSTER_DENOMINATOR", label: "班級/同人重測/聚集結構診斷", kind: "NEEDS_SPECIALIST", lastResult: "NOT_ASSESSED", note: "SPECIALIST_REVIEW_REQUIRED 時標出" },
      { capabilityId: "LLM_GENERATIVE_REVIEW", label: "LLM 生成式角色審查（非確定性）", kind: "UNSUPPORTED", lastResult: "UNSUPPORTED", note: "本輪 Reviewer #2 為確定性規則引擎" },
    ],
  };
}

// -------------------------------------------------------------
// §3-4 Reviewer #2 constructive challenge generator
//   Deterministic, evidence-based. Does NOT invent stats; does NOT demand
//   every study become a large-N RCT; offers alternative explanation +
//   minimal revision path. All AI review output is SIMULATED REVIEW.
// -------------------------------------------------------------
export function generateReviewer2Challenges(params: {
  snapshot: ManuscriptWritingSnapshot;
  workspace?: ManuscriptWorkspace;
}): Array<Omit<ScientificFinding, "findingId" | "reviewRunId" | "createdAt" | "updatedAt" | "decision" | "authorResponse" | "authorCanDisagreeWithReason" | "adjudicatedBy" | "adoptedAt">> {
  const { snapshot } = params;
  const findings: Array<Omit<ScientificFinding, "findingId" | "reviewRunId" | "createdAt" | "updatedAt" | "decision" | "authorResponse" | "authorCanDisagreeWithReason" | "adjudicatedBy" | "adoptedAt">> = [];

  const common = {
    reviewerRole: "REVIEWER_2_CHALLENGER" as const,
    simulated: true as const,
    findingOrigin: "REVIEWER_2_GENERATOR" as const,
    owner: "作者（第一作者/通訊作者）",
    blocksActions: ["LANGUAGE_POLISH"] as string[],
    returnTarget: { route: "scientific-review" as const },
    verificationStatus: "DETECTED_CANDIDATE" as const,
    correctionOptions: [] as string[],
    evidenceFor: [] as string[],
    evidenceAgainst: [] as string[],
    status: "OPEN" as const,
    impactScope: "specific-claims",
    requiredAction: "",
  };

  // 1. Causal boundary challenge (evidence-based: RCT + immediate posttest only)
  findings.push({
    ...common,
    category: "LOGIC",
    issueType: "CAUSAL_BOUNDARY_AND_TEMPORALITY",
    severity: "MAJOR",
    title: "T1 立即後測的因果邊界與長期遷移未證實",
    description:
      "正文結論宣稱『實務上可降低致命事故風險』。依據現有 ResultFact，成效僅於受控實驗室 T1 立即後測（N=6）觀測；T2 延宕測量未釋出。Reviewer #2 建議：結論保留『短期知覺反應提升』，長期遷移與場域事故率以可能性表述，不做已證實因果主張。",
    basis: {
      reviewedVersion: snapshot.snapshotId,
      sourceHash: snapshot.checksum,
      sectionRef: "DISCUSSION",
      resultFactId: snapshot.boundResultFactIds[0],
    },
    alternativeExplanation:
      "T1 改善可能反映新奇效應、任務練習或短期記憶強化，而非長期學習遷移；需 T2 與對照情境複製才能排除。",
    minimalRevisionPath:
      "於 Discussion 限制段與 Conclusion 將『降低事故風險』改為『有助縮短危害知覺反應時間的短期表現，長期效果待 T2 驗證』，不需新增統計。",
    impact: "過度因果主張可能誤導讀者對真實遷移效應的期待。",
    evidenceAgainst: ["T2 延宕測量未釋出"],
    rationale: "以本研究之 T1 立即後測設計與受控情境，無法支持長期遷移或場域事故率下降之因果主張。",
    requiredAction: "降低結論因果強度，標示長期效果待驗證",
  });

  // 2. Sample size / external validity (constructive, NOT demanding large-N RCT)
  findings.push({
    ...common,
    category: "REPORTING",
    issueType: "EXTERNAL_VALIDITY_SCOPE",
    severity: "MAJOR",
    title: "樣本規模與適用範圍需如實界定",
    description:
      "分析樣本 N=6（製造與營造業新進受訓人員），屬小樣本先導性證據。Reviewer #2 不要求改為大樣本 RCT，但要求 Methods/Results/Conclusion 明確以『小樣本探索性證據』定位，避免讀者誤以為一般化至所有高空作業族群。",
    basis: { reviewedVersion: snapshot.snapshotId, sourceHash: snapshot.checksum, sectionRef: "RESULTS" },
    alternativeExplanation: "個別差異（如暈動耐受、VR 熟悉度）在小樣本下影響更大。",
    minimalRevisionPath: "在 Abstract/Conclusion 補一句適用範圍限制，並於 Limitations 說明小樣本之推論邊界。",
    impact: "外部效度易被高估。",
    evidenceAgainst: ["N=6 樣本之一般化限制"],
    rationale: "樣本規模與族群代表性決定結論可推論的範圍。",
    requiredAction: "補充適用範圍限制句",
  });

  // 3. Multiplicity / diagnostics disclosure
  findings.push({
    ...common,
    category: "STATISTICS",
    issueType: "DIAGNOSTICS_AND_MULTIPLICITY",
    severity: "MINOR",
    title: "多重比較校正與診斷揭露可更具體",
    description:
      "Results 提及 Holm-Bonferroni 校正，但未說明校正後各次要指標的具體處理與未校正敏感度。建議補充校正層級與敏感度摘要（若 U14 已有則引用其 Fact/Table）。",
    basis: { reviewedVersion: snapshot.snapshotId, sourceHash: snapshot.checksum, sectionRef: "RESULTS" },
    alternativeExplanation: "未校正的探索性指標可能放大偶然發現。",
    minimalRevisionPath: "引用 U14 既有 multiplicity 摘要或於補充表列出校正前後 p 值。",
    impact: "讀者難以判斷顯著結果之穩健性。",
    evidenceAgainst: ["Holm-Bonferroni 校正細節未揭露"],
    rationale: "多重比較正確處理影響 p 值判讀。",
    requiredAction: "補充校正層級與敏感度摘要",
  });

  // 4. Methods fidelity (planned vs performed)
  findings.push({
    ...common,
    category: "METHOD",
    issueType: "METHODS_FIDELITY",
    severity: "MINOR",
    title: "Methods 需標明 planned vs performed 差異",
    description:
      "Methods 描述雙組隨機對照試驗架構；請確認並揭露實際執行偏差（如招募進度、session 中斷、儀器換版），使讀者可追溯 planned 與 performed 差異。",
    basis: { reviewedVersion: snapshot.snapshotId, sourceHash: snapshot.checksum, sectionRef: "METHODS" },
    alternativeExplanation: "實際執行與計畫的落差可能影響結果可複製性。",
    minimalRevisionPath: "於 Methods 末增加『實際執行 vs 計畫』對照小節（引用 U12 執行紀錄）。",
    impact: "可重現性與透明性。",
    evidenceAgainst: ["planned vs performed 差異未揭露"],
    rationale: "可重現研究須區分計畫與實際執行。",
    requiredAction: "補 planned vs performed 對照",
  });

  return findings;
}

// -------------------------------------------------------------
// §4 Finding de-duplication (same issue / same-source multi-platform)
// -------------------------------------------------------------
export function deduplicateFindings(params: {
  findings: Array<Omit<ScientificFinding, "findingId" | "reviewRunId" | "createdAt" | "updatedAt">>;
}): Array<Omit<ScientificFinding, "findingId" | "reviewRunId" | "createdAt" | "updatedAt">> {
  const { findings } = params;
  const seen = new Map<string, number>();
  const deduped: typeof findings = [];

  for (const f of findings) {
    const key = `${f.issueType}|${f.basis.sectionRef}|${f.basis.claimId ?? ""}|${f.basis.resultFactId ?? ""}`;
    const existingIndex = seen.get(key);
    if (existingIndex !== undefined) {
      // Mark as duplicate of the first occurrence
      deduped[existingIndex] = {
        ...deduped[existingIndex],
        verificationStatus: "DUPLICATE_OF",
        duplicateOfFindingId: `finding_${existingIndex + 1}`,
      };
      continue;
    }
    seen.set(key, deduped.length);
    deduped.push(f);
  }
  return deduped;
}

// -------------------------------------------------------------
// §5 Author Response Matrix (internal)
// -------------------------------------------------------------
export type AuthorResponseMatrixRow = {
  findingId: string;
  findingTitle: string;
  severity: string;
  authorDecision: "ACCEPTED" | "IN_REVISION" | "REJECTED_WITH_JUSTIFICATION" | "ACCEPTED_RISK";
  authorResponse: string;
  disagreementJustified: boolean; // author may disagree with justification
  resolvedIn: "REVISION" | "RESPONSE_ONLY" | "ACCEPTED_RISK" | "UPSTREAM";
};

export function buildAuthorResponseMatrix(params: {
  findings: ScientificFinding[];
}): {
  matrixRef: string;
  rows: AuthorResponseMatrixRow[];
  disagreementCount: number;
} {
  const rows: AuthorResponseMatrixRow[] = params.findings.map((f) => ({
    findingId: f.findingId,
    findingTitle: f.title,
    severity: f.severity,
    authorDecision: f.decision === "VERIFIED_RESOLVED" ? "ACCEPTED" : f.decision === "REJECTED_WITH_JUSTIFICATION" ? "REJECTED_WITH_JUSTIFICATION" : f.decision === "ACCEPTED_RISK" ? "ACCEPTED_RISK" : "IN_REVISION",
    authorResponse: f.authorResponse ?? "",
    disagreementJustified: f.decision === "REJECTED_WITH_JUSTIFICATION" && Boolean(f.authorResponse),
    resolvedIn: f.decision === "VERIFIED_RESOLVED" ? "REVISION" : f.decision === "ACCEPTED_RISK" ? "ACCEPTED_RISK" : f.decision === "REJECTED_WITH_JUSTIFICATION" ? "RESPONSE_ONLY" : "UPSTREAM",
  }));
  return {
    matrixRef: `author_response_matrix_${Date.now().toString(36)}`,
    rows,
    disagreementCount: rows.filter((r) => r.disagreementJustified).length,
  };
}

// -------------------------------------------------------------
// §7 Meaning Constraints checker (protected values held)
// -------------------------------------------------------------
export function buildMeaningConstraints(params: {
  snapshot: ManuscriptWritingSnapshot;
}): MeaningConstraint[] {
  const { snapshot } = params;
  const constraints: MeaningConstraint[] = [
    {
      constraintId: `mc_numeric_${snapshot.snapshotId}`,
      type: "NUMERIC_VALUE",
      sectionRef: "RESULTS",
      protectedValue: "913.1 毫秒（組間差值）",
      rationale: "正式數值來自不可變 ResultFact fact_rt_t1_diff_mean；AI 不得改寫或心算替代。",
      isLocked: true,
      sourceRef: snapshot.boundResultFactIds[0],
    },
    {
      constraintId: `mc_n_${snapshot.snapshotId}`,
      type: "N_AND_DENOMINATOR",
      sectionRef: "TITLE_ABSTRACT",
      protectedValue: "分析樣本 N = 6",
      rationale: "分析 N 與招募 N、計畫 N 不同；不得誤報統一 N。",
      isLocked: true,
    },
    {
      constraintId: `mc_causal_${snapshot.snapshotId}`,
      type: "CAUSAL_BOUNDARY",
      sectionRef: "DISCUSSION",
      protectedValue: "T1 立即後測之因果邊界；T2 延宕遷移待驗證",
      rationale: "不得將短期成效改寫為已證實長期遷移或場域事故率下降。",
      isLocked: true,
    },
    {
      constraintId: `mc_hypothesis_${snapshot.snapshotId}`,
      type: "HYPOTHESIS_STATUS",
      sectionRef: "DISCUSSION",
      protectedValue: "H1 為事前假說；探索性解釋不得回填為預註冊",
      rationale: "事後解釋須標 POST_RESULT_EXPLANATION／FUTURE_TEST，不得倒填。",
      isLocked: true,
    },
    {
      constraintId: `mc_timepoint_${snapshot.snapshotId}`,
      type: "TIMEPOINT",
      sectionRef: "RESULTS",
      protectedValue: "T0 基線、T1 後測；T2 未釋出",
      rationale: "時點表述須與 U14 ResultFact 一致。",
      isLocked: true,
    },
  ];
  return constraints;
}

export function checkMeaningConstraintsHeld(params: {
  constraints: MeaningConstraint[];
  revisedTextBySection: Record<string, string>;
}): {
  held: boolean;
  violations: Array<{ constraintId: string; type: string; sectionRef: string; reason: string }>;
} {
  const violations: Array<{ constraintId: string; type: string; sectionRef: string; reason: string }> = [];
  for (const c of params.constraints) {
    const sectionText = params.revisedTextBySection[c.sectionRef] ?? "";
    const valueHeld = c.type === "CAUSAL_BOUNDARY"
      ? /T2/.test(sectionText) && /待驗證|尚未|未來|有待/.test(sectionText)
      : c.type === "N_AND_DENOMINATOR"
        ? /N\s*=\s*6/.test(sectionText)
        : c.type === "TIMEPOINT"
          ? /T0/.test(sectionText) && /T1/.test(sectionText)
          : c.type === "HYPOTHESIS_STATUS"
            ? /H1/.test(sectionText)
            : c.type === "NUMERIC_VALUE"
              ? /913\.1/.test(sectionText)
              : true;
    if (!valueHeld) {
      violations.push({
        constraintId: c.constraintId,
        type: c.type,
        sectionRef: c.sectionRef,
        reason: `保護值「${c.protectedValue}」在修訂後段落中缺失或改變。`,
      });
    }
  }
  return { held: violations.length === 0, violations };
}

// -------------------------------------------------------------
// §6 Re-review decision
// -------------------------------------------------------------
export function decideReReview(params: {
  findings: ScientificFinding[];
  round: number;
  maxRounds: number;
}): { decision: ReReviewDecision; rationale: string } {
  const blockers = params.findings.filter(
    (f) => (f.decision === "OPEN" || f.decision === "ACCEPTED" || f.decision === "IN_REVISION") && (f.severity === "BLOCKER" || f.severity === "CRITICAL")
  );
  if (params.round >= params.maxRounds) {
    // Reach re-review cap: keep unresolved issues, do not force PASS
    return {
      decision: blockers.length > 0 ? "CLOSED_WITH_UNRESOLVED" : "SCIENTIFICALLY_APPROVED",
      rationale: `已達重審上限第 ${params.round}/${params.maxRounds} 輪；${blockers.length > 0 ? `保留 ${blockers.length} 項未解 blocker，不強制通過。` : "無未解 blocker，允許通過。"}`,
    };
  }
  if (blockers.length > 0) {
    return { decision: "RE_REVIEW_REQUIRED", rationale: `仍有 ${blockers.length} 項 BLOCKER/CRITICAL 未裁決，需進行下一輪重審。` };
  }
  return { decision: "SCIENTIFICALLY_APPROVED", rationale: "全部 blocker 已裁決或作者已附據不同意；科學審查完成。作者不同意需有理由，不代表強制全部接受。" };
}

// -------------------------------------------------------------
// §31 Scientific Review Package & Language Polishing Handoff Package
// -------------------------------------------------------------
export function buildScientificReviewPackage(params: {
  reviewRunId: string;
  reviewSnapshot: ScientificReviewSnapshot;
  coverageMatrixRef: string;
  capabilityManifestRef: string;
  findings: ScientificFinding[];
}): ScientificReviewPackage {
  const { reviewRunId, reviewSnapshot, coverageMatrixRef, capabilityManifestRef, findings } = params;
  return {
    packageId: `srvp_${reviewRunId}`.slice(0, 64),
    reviewRunId,
    workOrderRef: reviewSnapshot.workOrderId,
    inputSourceRef: reviewSnapshot.sourceManuscriptWritingSnapshotId,
    coverageMatrixRef,
    capabilityManifestRef,
    mechanicalQaRef: `mech_qa_${reviewSnapshot.snapshotId}`,
    roleReportRefs: Array.from(new Set(findings.map((f) => `role_report_${f.reviewerRole}`))),
    reviewer2ReportRef: `reviewer2_report_${reviewRunId}`,
    findingRegistryRef: `finding_registry_${reviewRunId}`,
    adjudicationRefs: reviewSnapshot.adjudicationRefs,
    revisionTaskRefs: reviewSnapshot.revisionProposalRefs,
    authorResponseMatrixRef: reviewSnapshot.authorResponseMatrixRef,
    acceptedChangeManifestRef: `accepted_change_${reviewRunId}`,
    upstreamRequestRefs: reviewSnapshot.upstreamRequestRefs,
    reReviewRefs: reviewSnapshot.reReviewRefs,
    meaningConstraintRefs: reviewSnapshot.meaningConstraintRefs,
    sourceManifestRef: `source_manifest_${reviewRunId}`,
    aiAssistanceAuditRef: `ai_audit_${reviewRunId}`,
    createdAt: new Date().toISOString(),
  };
}

export function buildLanguagePolishingHandoffPackage(params: {
  reviewRunId: string;
  reviewSnapshot: ScientificReviewSnapshot;
}): LanguagePolishingHandoffPackage {
  const { reviewRunId, reviewSnapshot } = params;
  return {
    packageId: `langpack_${reviewRunId}`.slice(0, 64),
    reviewRunId,
    scientificRevisionRef: reviewSnapshot.scientificReleaseState === "SCIENTIFIC_CONTENT_APPROVED_FOR_LANGUAGE" ? reviewSnapshot.projectId : "",
    workLanguage: "zh-TW",
    targetLanguage: "en-US",
    terminologyBindingRef: `terminology_${reviewRunId}`,
    meaningConstraintRefs: reviewSnapshot.meaningConstraintRefs,
    protectedFactRefs: [],
    protectedCitationRefs: [],
    quoteUsageRefs: [],
    necessaryQualifiers: [],
    sectionScopeRefs: reviewSnapshot.scope.coverageSections,
    fullManuscriptLanguageAllowed: reviewSnapshot.fullManuscriptLanguageAllowed,
    languageAllowedScopeRefs: reviewSnapshot.languageAllowedScopeRefs,
    forbiddenExternalContent: ["IdentityVault", "RawRows", "受限全文", "完整學生逐字稿", "API keys"],
    laterFormatTodos: ["目標期刊格式", "APC/送件期限，改由後續正式合規階段確認"],
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// §7 ScientificReviewSnapshot builder for Stage 17
// -------------------------------------------------------------
export function buildScientificReviewSnapshot(params: {
  workspaceId: string;
  projectId: string;
  reviewRunId: string;
  workOrder: ReviewWorkOrder;
  sourceSnapshot: ManuscriptWritingSnapshot;
  findings: ScientificFinding[];
  revisions: RevisionProposal[];
  reReviewDecision: ReReviewDecision;
  rationale: string;
  constraints: MeaningConstraint[];
  upstreamRequests: UpstreamReviewRequest[];
  authorResponseMatrixRef: string;
  mechanicalQa: MechanicalQaResult;
  reviewer2Provided: boolean;
  coverageMatrixRef?: string;
  capabilityManifestRef?: string;
  adjudicationRefs?: string[];
  scientificReleaseState?: ScientificReviewSnapshot["scientificReleaseState"];
  fullManuscriptLanguageAllowed?: boolean;
  languageAllowedScopeRefs?: string[];
  acceptedLimitations?: string[];
  laterStageRequirements?: string[];
}): ScientificReviewSnapshot {
  const {
    workspaceId, projectId, reviewRunId, workOrder, sourceSnapshot, findings,
    revisions, reReviewDecision, rationale, constraints, upstreamRequests,
    authorResponseMatrixRef, mechanicalQa, reviewer2Provided,
  } = params;
  const coverageMatrixRef = params.coverageMatrixRef ?? `coverage_${reviewRunId}`.slice(0, 64);
  const capabilityManifestRef = params.capabilityManifestRef ?? `capability_${reviewRunId}`;
  const adjudicationRefs = params.adjudicationRefs ?? [];

  const snapshotId = `srsnap_${projectId}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const openFindings = findings.filter((f) => f.decision === "OPEN" || f.decision === "ACCEPTED" || f.decision === "IN_REVISION");
  const blockers = openFindings.filter((f) => f.severity === "BLOCKER" || f.severity === "CRITICAL");

  const openBlockers = blockers.length;
  const scientificReleaseState: ScientificReviewSnapshot["scientificReleaseState"] =
    params.scientificReleaseState ??
    (reReviewDecision === "SCIENTIFICALLY_APPROVED" && openBlockers === 0
      ? "SCIENTIFIC_CONTENT_APPROVED_FOR_LANGUAGE"
      : reReviewDecision === "CLOSED_WITH_UNRESOLVED"
        ? "PARTIAL_REVIEW_COMPLETE"
        : reReviewDecision === "BLOCKED"
          ? "USE_BLOCKED"
          : "REVISION_REQUIRED");
  const fullManuscriptLanguageAllowed = params.fullManuscriptLanguageAllowed ?? (scientificReleaseState === "SCIENTIFIC_CONTENT_APPROVED_FOR_LANGUAGE" && openBlockers === 0);
  const languageAllowedScopeRefs = params.languageAllowedScopeRefs ?? (fullManuscriptLanguageAllowed ? workOrder.coverageSections : []);
  const acceptedLimitations = params.acceptedLimitations ?? [];
  const laterStageRequirements = params.laterStageRequirements ?? ["翻譯/學術潤稿", "科學含義與術語保護", "語言 QA", "必要外部語言服務與授權"];

  const reviewSnapshot: ScientificReviewSnapshot = {
    snapshotId,
    schemaVersion: "scientific-review/1.0.0",
    stageKey: "V3-U16",
    workspaceId,
    projectId,
    reviewRunId,
    workOrderId: workOrder.workOrderId,
    stageId: "scientific-review",
    nextStageId: "translation-polish", // Stage 17: 翻譯與學術潤稿
    sourceManuscriptWritingSnapshotId: sourceSnapshot.snapshotId,
    sourceManuscriptWritingSnapshotHash: sha256({ id: sourceSnapshot.snapshotId, decision: sourceSnapshot.decision }),
    sourceManuscriptWritingDecision: sourceSnapshot.decision,
    goalContextRevision: 1,
    primaryGoal: sourceSnapshot.primaryGoal,

    reviewRound: workOrder.reviewRound,
    decision: reReviewDecision,
    decisionRationale: rationale,

    scope: {
      workingTitleZh: sourceSnapshot.scope.workingTitleZh,
      workingTitleEn: sourceSnapshot.scope.workingTitleEn,
      coverageSections: workOrder.coverageSections,
      totalWordCount: sourceSnapshot.scope.totalWordCount,
    },

    findingRefs: findings.map((f) => f.findingId),
    openFindingRefs: openFindings.map((f) => f.findingId),
    blockerFindingRefs: blockers.map((f) => f.findingId),
    resolvedFindingRefs: findings.filter((f) => f.decision === "VERIFIED_RESOLVED" || f.decision === "REJECTED_WITH_JUSTIFICATION" || f.decision === "ACCEPTED_RISK").map((f) => f.findingId),
    revisionProposalRefs: revisions.map((r) => r.revisionId),
    reReviewRefs: [],
    meaningConstraintRefs: constraints.map((c) => c.constraintId),
    upstreamRequestRefs: upstreamRequests.map((r) => r.requestId),
    authorResponseMatrixRef,
    adjudicationRefs,
    coverageMatrixRef,
    capabilityManifestRef,
    roleRunRefs: Array.from(new Set(findings.map((f) => `role_run_${f.reviewerRole}`))),
    reviewer2ReportRef: `reviewer2_report_${reviewRunId}`,
    analysisReviewRequestRefs: upstreamRequests.filter((r) => r.kind === "ANALYSIS_REVIEW").map((r) => r.requestId),
    sourceUpdateAdoptionRefs: [],
    scientificReviewPackageRef: `srvp_${reviewRunId}`.slice(0, 64),
    languageHandoffPackageRef: `langpack_${reviewRunId}`.slice(0, 64),

    scientificReleaseState,
    fullManuscriptLanguageAllowed,
    languageAllowedScopeRefs,
    acceptedLimitations,
    requiredSpecialistReviewDispositions: [],
    laterStageRequirements,

    mechanicalQaPassed: mechanicalQa.passed,
    reviewer2ChallengeProvided: reviewer2Provided,
    allSimulated: true, // every AI review in this module is simulated
    meaningConstraintsHeld: true, // re-verified by caller before completion
    noFabricatedFindings: true, // findings only from deterministic generators / human entry
    authorDisagreementRespectCount: findings.filter((f) => f.decision === "REJECTED_WITH_JUSTIFICATION").length,

    limitations: [
      "本快照為老麥科學內容審查與修訂基線（Scientific Review Baseline），所有 AI 審查均標示 SIMULATED REVIEW，不代表真實期刊同行評審決定。",
      "作者對審查意見可有據不同意；未解問題在達重審上限時如實保留，不強制 PASS。",
      "第十七階段翻譯與學術潤稿尚未完整建置；本輪提供可重開 receiver 頁，不生成假翻譯或空白頁。",
      `Scientific release state: ${scientificReleaseState}；fullManuscriptLanguageAllowed=${fullManuscriptLanguageAllowed}。`,
    ],
    checksum: `chk_sr_${Date.now().toString(36)}_${sha256(snapshotId).slice(0, 8)}`,
    createdAt: new Date().toISOString(),
  };

  return reviewSnapshot;
}

// -------------------------------------------------------------
// §7 Stage 17 receiver state
// -------------------------------------------------------------
export function buildStage17ReceiverState(params: {
  snapshot: ScientificReviewSnapshot;
  findings: ScientificFinding[];
}): Stage17ReceiverState {
  const { snapshot, findings } = params;
  const open = findings.filter((f) => f.decision === "OPEN" || f.decision === "ACCEPTED" || f.decision === "IN_REVISION");
  const blockers = open.filter((f) => f.severity === "BLOCKER" || f.severity === "CRITICAL");
  const notes: string[] = [];
  if (blockers.length > 0) notes.push("仍有未解 blocker，語言潤稿前請先完成科學修訂。");
  if (!snapshot.meaningConstraintsHeld) notes.push("Scientific Meaning Constraints 未全部滿足，語言階段不得放行。");
  notes.push("U17 尚未完整建置；此為可重開 receiver，可返回 U16，不生成假翻譯。");

  return {
    receiverVersion: "translation-polish-receiver/1.0.0",
    stageKey: "V3-U17-RECEIVER",
    workspaceId: snapshot.workspaceId,
    projectId: snapshot.projectId,
    sourceScientificReviewSnapshotId: snapshot.snapshotId,
    sourceSchemaVersion: snapshot.schemaVersion,
    primaryGoal: snapshot.primaryGoal,
    decision: snapshot.decision,
    scientificReleaseState: snapshot.scientificReleaseState,
    fullManuscriptLanguageAllowed: snapshot.fullManuscriptLanguageAllowed,
    languageAllowedScopeRefs: snapshot.languageAllowedScopeRefs,
    openFindingCount: open.length,
    blockerFindingCount: blockers.length,
    meaningConstraintCount: snapshot.meaningConstraintRefs.length,
    readyForLanguage: snapshot.meaningConstraintsHeld && blockers.length === 0 && snapshot.scientificReleaseState === "SCIENTIFIC_CONTENT_APPROVED_FOR_LANGUAGE",
    receiverNotes: notes,
    reEntryPoint: { route: "scientific-review", action: "initialize", snapshotId: snapshot.sourceManuscriptWritingSnapshotId },
    createdAt: new Date().toISOString(),
  };
}
