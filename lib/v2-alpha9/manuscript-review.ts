import {
  V2_ALPHA9_CONTRACT_VERSION,
  V2_ALPHA9_PAPERPAL_BOUNDARY,
  V2_ALPHA9_REVISION_STRATEGIES,
  V2_ALPHA9_SECTION_KEYS,
  alpha9Hash,
  alpha9SectionsHash,
  createAlpha9Section,
  isAlpha9Hash,
  validateAlpha9Sections,
  type V2Alpha9CanonicalManuscript,
  type V2Alpha9CanonicalSection,
  type V2Alpha9CanonicalSections,
  type V2Alpha9CitationLedgerEntry,
  type V2Alpha9CompletenessEntry,
  type V2Alpha9CompletenessMatrix,
  type V2Alpha9EvidenceState,
  type V2Alpha9FindingCategory,
  type V2Alpha9FindingSelection,
  type V2Alpha9PriorityFinding,
  type V2Alpha9RevisionOption,
  type V2Alpha9SectionKey,
  type V2Alpha9StatisticLedgerEntry,
  type V2Alpha9VisualLedgerEntry,
  type V2Alpha9WholeArtifactApplication,
  type V2Alpha9Workspace,
} from "./contracts.ts";

const RESULT_DEPENDENT_SECTIONS = new Set<V2Alpha9SectionKey>([
  "ABSTRACT",
  "RESULTS_OR_EXPECTED_OUTCOMES",
  "DISCUSSION_OR_SIGNIFICANCE",
  "CONCLUSION_OR_IMPACT",
]);

const EVIDENCE_RANK: Readonly<Record<V2Alpha9EvidenceState, number>> = Object.freeze({
  OBSERVED: 0,
  UNVERIFIED: 1,
  ASSUMPTION: 2,
  MISSING: 3,
  CONFLICT: 4,
});

function cloneSections(sections: V2Alpha9CanonicalSections): V2Alpha9CanonicalSections {
  return validateAlpha9Sections(sections.map((section) => ({
    ...section,
    sourceMaterialIds: [...section.sourceMaterialIds],
    sourceStatisticIds: [...section.sourceStatisticIds],
    sourceHashes: [...section.sourceHashes],
    unresolvedItems: [...section.unresolvedItems],
  })));
}

function verifyEntryHash<T extends { entryHash: string }>(entry: T, code: string) {
  const { entryHash, ...core } = entry;
  if (!isAlpha9Hash(entryHash) || alpha9Hash(core) !== entryHash) throw new Error(code);
}

function validateCitationLedger(entries: readonly V2Alpha9CitationLedgerEntry[]) {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.citationId.trim() || ids.has(entry.citationId)) throw new Error("alpha9_citation_ledger_invalid");
    ids.add(entry.citationId);
    verifyEntryHash(entry, "alpha9_citation_ledger_hash_mismatch");
    const databaseStates = Object.values(entry.databaseVerification);
    if (entry.verificationStatus === "VERIFIED_4_SOURCE" && (databaseStates.length !== 4 || databaseStates.some((state) => state !== "PASS") || entry.claimAlignment !== "PASS")) {
      throw new Error("alpha9_citation_verification_overclaim");
    }
  }
}

function validateStatisticLedger(entries: readonly V2Alpha9StatisticLedgerEntry[]) {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.statisticId.trim() || ids.has(entry.statisticId) || !entry.sourceMaterialId.trim()) throw new Error("alpha9_statistic_ledger_invalid");
    ids.add(entry.statisticId);
    verifyEntryHash(entry, "alpha9_statistic_ledger_hash_mismatch");
    if (entry.verificationStatus === "VERIFIED" && (!entry.value.trim() || !entry.unit.trim())) throw new Error("alpha9_statistic_verification_overclaim");
  }
}

function validateVisualLedger(entries: readonly V2Alpha9VisualLedgerEntry[], statistics: readonly V2Alpha9StatisticLedgerEntry[]) {
  const statisticIds = new Set(statistics.map((entry) => entry.statisticId));
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.visualId.trim() || ids.has(entry.visualId) || entry.statisticIds.some((id) => !statisticIds.has(id))) throw new Error("alpha9_visual_ledger_invalid");
    ids.add(entry.visualId);
    verifyEntryHash(entry, "alpha9_visual_ledger_hash_mismatch");
    if (entry.verificationStatus === "VERIFIED" && (!isAlpha9Hash(entry.sourceDataHash) || !entry.unitsDeclared || !entry.sampleDeclared || !entry.uncertaintyDeclared || !entry.accessibilityText?.trim())) {
      throw new Error("alpha9_visual_verification_overclaim");
    }
  }
}

export function validateV2Alpha9CanonicalManuscript(value: V2Alpha9CanonicalManuscript): V2Alpha9CanonicalManuscript {
  if (value.schemaId !== "old-mike-v2-alpha9/canonical-manuscript/1" || value.track !== "JOURNAL_MANUSCRIPT" || value.sourcePreserved !== true) throw new Error("alpha9_manuscript_authority_invalid");
  if (!isAlpha9Hash(value.sourceArtifactHash) || !isAlpha9Hash(value.sourceBundleHash) || !isAlpha9Hash(value.artifactHash)) throw new Error("alpha9_manuscript_hash_invalid");
  const sections = validateAlpha9Sections(value.sections);
  if (!value.resultNarrativeAllowed && sections.some((section) => RESULT_DEPENDENT_SECTIONS.has(section.sectionKey) && section.mode !== "PLAN_ONLY")) {
    throw new Error("alpha9_results_boundary_invalid");
  }
  validateCitationLedger(value.citationLedger);
  validateStatisticLedger(value.statisticLedger);
  validateVisualLedger(value.visualLedger, value.statisticLedger);
  const { artifactHash, ...core } = value;
  if (alpha9Hash(core) !== artifactHash) throw new Error("alpha9_manuscript_artifact_hash_mismatch");
  return value;
}

function completenessStatus(section: V2Alpha9CanonicalSection): V2Alpha9CompletenessEntry["status"] {
  if (section.mode === "MISSING" || section.evidenceState === "MISSING") return "MISSING";
  if (section.evidenceState === "CONFLICT") return "CONFLICT";
  if (section.mode === "PLAN_ONLY") return "PLAN_ONLY";
  if (section.evidenceState === "UNVERIFIED" || section.evidenceState === "ASSUMPTION") return "UNVERIFIED";
  return "PASS";
}

function createCompletenessMatrix(sections: V2Alpha9CanonicalSections): V2Alpha9CompletenessMatrix {
  const entries = sections.map((section): V2Alpha9CompletenessEntry => {
    const status = completenessStatus(section);
    const issues = [...section.unresolvedItems];
    if (status !== "PASS" && issues.length === 0) issues.push(`本節狀態為 ${status}，尚未達到可確認終稿。`);
    return {
      sectionKey: section.sectionKey,
      status,
      blocking: status === "MISSING" || status === "PLAN_ONLY" || status === "CONFLICT",
      contentHash: section.contentHash,
      issues,
    };
  }) as unknown as V2Alpha9CompletenessMatrix["entries"];
  const core = {
    entries,
    passCount: entries.filter((entry) => entry.status === "PASS").length,
    blockingCount: entries.filter((entry) => entry.blocking).length,
  };
  return { ...core, matrixHash: alpha9Hash(core) };
}

function ledgerIssueSections(manuscript: V2Alpha9CanonicalManuscript) {
  const scores = new Map<V2Alpha9SectionKey, number>();
  const add = (sectionKey: V2Alpha9SectionKey, score: number) => scores.set(sectionKey, (scores.get(sectionKey) ?? 0) + score);
  manuscript.citationLedger.forEach((entry) => add(entry.anchorSection, entry.verificationStatus === "CONFLICT" ? 90 : entry.verificationStatus === "VERIFIED_4_SOURCE" || entry.verificationStatus === "NOT_APPLICABLE" ? 0 : 45));
  manuscript.statisticLedger.forEach((entry) => add(entry.anchorSection, entry.verificationStatus === "CONFLICT" ? 100 : entry.verificationStatus === "VERIFIED" || entry.verificationStatus === "NOT_APPLICABLE" ? 0 : 70));
  manuscript.visualLedger.forEach((entry) => entry.calloutSections.forEach((sectionKey) => add(sectionKey, entry.verificationStatus === "CONFLICT" ? 100 : entry.verificationStatus === "VERIFIED" ? 0 : 65)));
  return scores;
}

function categoryFor(sectionKey: V2Alpha9SectionKey, manuscript: V2Alpha9CanonicalManuscript): V2Alpha9FindingCategory {
  if (manuscript.citationLedger.some((entry) => entry.anchorSection === sectionKey && entry.verificationStatus !== "VERIFIED_4_SOURCE" && entry.verificationStatus !== "NOT_APPLICABLE")) return "CITATION_INTEGRITY";
  if (manuscript.statisticLedger.some((entry) => entry.anchorSection === sectionKey && entry.verificationStatus !== "VERIFIED" && entry.verificationStatus !== "NOT_APPLICABLE")) return "STATISTICAL_INTEGRITY";
  if (manuscript.visualLedger.some((entry) => entry.calloutSections.includes(sectionKey) && entry.verificationStatus !== "VERIFIED")) return "VISUAL_INTEGRITY";
  if (sectionKey === "TITLE" || sectionKey === "ABSTRACT" || sectionKey === "DISCUSSION_OR_SIGNIFICANCE") return "JOURNAL_OR_PROGRAM_FIT";
  if (sectionKey === "REFERENCES") return "CITATION_INTEGRITY";
  return "COMPLETENESS";
}

function selectFindingSections(manuscript: V2Alpha9CanonicalManuscript, matrix: V2Alpha9CompletenessMatrix): [V2Alpha9SectionKey, V2Alpha9SectionKey, V2Alpha9SectionKey] {
  const ledgerScores = ledgerIssueSections(manuscript);
  const sectionRisk = new Map<V2Alpha9SectionKey, number>([
    ["RESULTS_OR_EXPECTED_OUTCOMES", 60],
    ["DECLARATIONS_OR_ATTACHMENTS", 45],
    ["METHODS_OR_IMPLEMENTATION", 40],
    ["REFERENCES", 30],
    ["LIMITATIONS_OR_RISKS", 25],
    ["ABSTRACT", 15],
    ["LITERATURE_OR_POLICY_CONTEXT", 10],
    ["TITLE", 8],
    ["KEYWORDS", 0],
  ]);
  const issueFamily = (sectionKey: V2Alpha9SectionKey) => {
    if (manuscript.statisticLedger.some((entry) => entry.anchorSection === sectionKey && entry.verificationStatus !== "VERIFIED" && entry.verificationStatus !== "NOT_APPLICABLE")
      || manuscript.visualLedger.some((entry) => entry.calloutSections.includes(sectionKey) && entry.verificationStatus !== "VERIFIED")) return "RESULT_INTEGRITY";
    if (manuscript.citationLedger.some((entry) => entry.anchorSection === sectionKey && entry.verificationStatus !== "VERIFIED_4_SOURCE" && entry.verificationStatus !== "NOT_APPLICABLE")
      || sectionKey === "REFERENCES" || sectionKey === "LITERATURE_OR_POLICY_CONTEXT") return "CITATION_INTEGRITY";
    return sectionKey;
  };
  const ordered = [...matrix.entries]
    .sort((a, b) => {
      const statusScore = (entry: V2Alpha9CompletenessEntry) => entry.status === "CONFLICT" ? 100 : entry.status === "MISSING" ? 90 : entry.status === "PLAN_ONLY" ? 80 : entry.status === "UNVERIFIED" ? 25 : 0;
      const score = (entry: V2Alpha9CompletenessEntry) => statusScore(entry) + (ledgerScores.get(entry.sectionKey) ?? 0) + (sectionRisk.get(entry.sectionKey) ?? 0);
      return score(b) - score(a);
    })
    .map((entry) => entry.sectionKey);
  const selected: V2Alpha9SectionKey[] = [];
  const selectedFamilies = new Set<string>();
  for (const sectionKey of ordered) {
    const family = issueFamily(sectionKey);
    if (selectedFamilies.has(family)) continue;
    selected.push(sectionKey);
    selectedFamilies.add(family);
    if (selected.length === 3) break;
  }
  if (selected.length < 3) throw new Error("alpha9_finding_section_cardinality_invalid");
  return [selected[0], selected[1], selected[2]];
}

function safeSourceText(section: V2Alpha9CanonicalSection) {
  return section.text
    .trim()
    .replace(/；。|。；/gu, "。")
    .replace(/。。+/gu, "。");
}

function materialRewrite(source: string, replacements: readonly [RegExp, string][]) {
  let rewritten = source;
  for (const [pattern, replacement] of replacements) rewritten = rewritten.replace(pattern, replacement);
  if (rewritten === source) {
    rewritten = source.includes("，")
      ? source.replace("，", "；同時，")
      : source.replace(/。$/u, "，並明確界定適用條件與推論範圍。");
  }
  return rewritten;
}

function plannedRevision(section: V2Alpha9CanonicalSection, strategy: V2Alpha9RevisionOption["strategy"]) {
  const target = section.sectionKey === "RESULTS_OR_EXPECTED_OUTCOMES"
    ? "實際樣本、分析輸出、效果量、不確定性與對應表圖"
    : section.sectionKey === "REFERENCES"
      ? "可核對識別碼、書目資料、主張對應位置與多來源驗證結果"
      : section.sectionKey === "DECLARATIONS_OR_ATTACHMENTS"
        ? "倫理核准、同意程序、資料可用性、利益衝突與必要附件"
        : "可追溯來源、核心主張、適用情境、限制與尚待完成項目";
  if (strategy === "EVIDENCE_CALIBRATED") return `目前沒有足以支持本區段的可核對材料。終稿將在取得${target}後撰寫；在此之前不填入推測性的研究結果、數值、引用或合規結論。`;
  if (strategy === "STRUCTURE_RECOMMENDED") return `本區段先保留為研究計畫：依序補入${target}，逐項連回來源紀錄，再完成與全文問題、方法及結論的一致性核對。`;
  return `本區段將以跨領域讀者可判讀的方式補入${target}，並分開呈現直接證據、合理解釋與仍待驗證的假設。`;
}

function revisionText(section: V2Alpha9CanonicalSection, strategy: V2Alpha9RevisionOption["strategy"]) {
  const source = safeSourceText(section);
  if (!source) return plannedRevision(section, strategy);
  if (strategy === "EVIDENCE_CALIBRATED") {
    const rewritten = materialRewrite(source, [
      [/本研究聚焦於/gu, "本研究旨在釐清"],
      [/目前可引用的使用者提供描述值為/gu, "依現有研究紀錄可核對的描述值包括"],
      [/初步觀察支持/gu, "現有觀察顯示"],
      [/最終貢獻在於/gu, "本研究的預期貢獻為"],
      [/仍待核對/gu, "尚待後續資料核對"],
    ]);
    return `${rewritten}\n\n所有推論均限於目前可追溯材料；未驗證、衝突或缺漏資訊不作為研究結果、因果效果或外部推廣依據。`;
  }
  if (strategy === "STRUCTURE_RECOMMENDED") {
    const rewritten = materialRewrite(source, [
      [/AI應用於教育的作用機制與實務成效：基於現有半成品的整合研究/gu, "教育情境中證據校準式人工智慧的作用機制與實務成效：一項混合方法研究"],
      [/基於此，本研究將問題收斂為/gu, "據此，本研究聚焦於"],
      [/研究設計以/gu, "本研究採用"],
      [/現有材料可支持的討論重點，是/gu, "本研究的討論聚焦於"],
      [/在現有材料邊界內，本研究可形成/gu, "綜合目前可核對材料，本研究形成"],
    ]);
    return `${rewritten}\n\n全文將依「問題與目的—方法與資料—結果或預期成果—限制與意涵」的順序收斂，並使引用、統計與表圖各自連回可核對來源。`;
  }
  const rewritten = materialRewrite(source, [
    [/AI應用於教育/gu, "教育情境中的人工智慧應用"],
    [/作用機制/gu, "可檢驗的影響機制"],
    [/實務成效/gu, "可觀察的教學成效"],
    [/可重現分析/gu, "可由不同領域研究者重現的分析"],
    [/適用邊界/gu, "可轉移條件與適用界線"],
  ]);
  return `${rewritten}\n\n為利跨領域判讀，核心概念、研究情境、可觀察指標與可轉移條件均採明確定義；證據強度與不確定性維持原有等級。`;
}

function createRevisionOption(section: V2Alpha9CanonicalSection, strategy: V2Alpha9RevisionOption["strategy"], findingId: string): V2Alpha9RevisionOption {
  const resultingMode = section.mode === "MISSING" ? "PLAN_ONLY" : section.mode;
  const core = {
    optionId: `${findingId}-${strategy.toLocaleLowerCase("en-US")}`,
    strategy,
    recommended: strategy === "STRUCTURE_RECOMMENDED",
    sourceHash: section.contentHash,
    revision: revisionText(section, strategy),
    resultingMode,
    reason: strategy === "EVIDENCE_CALIBRATED"
      ? "優先消除研究結果、引用或統計的過度推論。"
      : strategy === "STRUCTURE_RECOMMENDED"
        ? "在不提高證據等級的前提下，建立可直接校閱的論證順序。"
        : "降低跨領域讀者理解成本，同時保留適用邊界。",
    risk: section.mode === "MISSING" || section.mode === "PLAN_ONLY"
      ? "此選項仍是規劃稿；缺少材料時不得視為完成研究結果。"
      : "套用前仍須核對全文脈絡、引用、統計與目標期刊規範。",
    preservesEvidence: true as const,
  };
  return { ...core, optionHash: alpha9Hash(core) };
}

function createFinding(section: V2Alpha9CanonicalSection, rank: 1 | 2 | 3, manuscript: V2Alpha9CanonicalManuscript): V2Alpha9PriorityFinding {
  const findingId = `alpha9-finding-${rank}-${section.sectionKey.toLocaleLowerCase("en-US")}`;
  const options = V2_ALPHA9_REVISION_STRATEGIES.map((strategy) => createRevisionOption(section, strategy, findingId)) as unknown as V2Alpha9PriorityFinding["options"];
  const category = categoryFor(section.sectionKey, manuscript);
  const core = {
    findingId,
    rank,
    category,
    severity: (section.mode === "MISSING" || section.evidenceState === "CONFLICT" ? "CRITICAL" : rank < 3 ? "MAJOR" : "MINOR") as V2Alpha9PriorityFinding["severity"],
    sectionKey: section.sectionKey,
    sourceHash: section.contentHash,
    problem: section.unresolvedItems[0] ?? `本節為 ${section.mode}/${section.evidenceState}，需要完成終稿一致性校閱。`,
    impact: "若未處理，完整性、證據可追溯性或讀者理解可能不足。",
    evidenceBoundary: "修訂不得新增未由 citation、statistic 或 visual ledger 支持的事實、數值或研究結果。",
    options,
    recommendedOptionId: options[1].optionId,
  };
  return { ...core, findingHash: alpha9Hash(core) };
}

function hasLedgerBlocker(manuscript: V2Alpha9CanonicalManuscript) {
  return manuscript.citationLedger.some((entry) => entry.verificationStatus === "CONFLICT")
    || manuscript.statisticLedger.some((entry) => entry.verificationStatus === "CONFLICT" || entry.verificationStatus === "MISSING")
    || manuscript.visualLedger.some((entry) => entry.verificationStatus === "CONFLICT" || entry.verificationStatus === "MISSING_SOURCE");
}

export function createV2Alpha9ManuscriptReview(raw: V2Alpha9CanonicalManuscript): V2Alpha9Workspace {
  const before = alpha9Hash(raw);
  const manuscript = validateV2Alpha9CanonicalManuscript(raw);
  const sections = cloneSections(manuscript.sections);
  const completenessMatrix = createCompletenessMatrix(sections);
  const findingSections = selectFindingSections(manuscript, completenessMatrix);
  const priorityFindings = findingSections.map((sectionKey, index) => {
    const section = sections.find((item) => item.sectionKey === sectionKey);
    if (!section) throw new Error("alpha9_finding_section_missing");
    return createFinding(section, (index + 1) as 1 | 2 | 3, manuscript);
  }) as unknown as V2Alpha9Workspace["priorityFindings"];
  const reviewDraft = cloneSections(sections);
  const reviewDraftHash = alpha9SectionsHash(reviewDraft);
  const integrityStatus: V2Alpha9Workspace["integrityStatus"] = completenessMatrix.blockingCount > 0 || hasLedgerBlocker(manuscript)
    ? "BLOCKED_EVIDENCE_OR_INTEGRITY"
    : completenessMatrix.passCount < V2_ALPHA9_SECTION_KEYS.length
      ? "READY_WITH_GAPS"
      : "FINAL_CONFIRMABLE";
  const core = {
    contractVersion: V2_ALPHA9_CONTRACT_VERSION,
    track: "JOURNAL_MANUSCRIPT" as const,
    sourceArtifactHash: manuscript.artifactHash,
    sourcePreserved: true as const,
    sections,
    citationLedger: manuscript.citationLedger.map((entry) => structuredClone(entry)),
    statisticLedger: manuscript.statisticLedger.map((entry) => structuredClone(entry)),
    visualLedger: manuscript.visualLedger.map((entry) => structuredClone(entry)),
    priorityFindings,
    completenessMatrix,
    integrityStatus,
    reviewDraft,
    reviewDraftHash,
    paperpalBoundary: V2_ALPHA9_PAPERPAL_BOUNDARY,
    humanGate: { required: true as const, scope: "WHOLE_ARTIFACT" as const, confirmed: false as const, contentHash: reviewDraftHash },
    formalResearchWriteCount: 0 as const,
    onlineDatabaseWriteCount: 0 as const,
    networkCallCount: 0 as const,
    externalMutationCount: 0 as const,
  };
  const workspace = { ...core, workspaceHash: alpha9Hash(core) };
  if (alpha9Hash(raw) !== before) throw new Error("alpha9_manuscript_source_mutated");
  return workspace;
}

function validateOption(option: V2Alpha9RevisionOption, section: V2Alpha9CanonicalSection) {
  const { optionHash, ...core } = option;
  const expectedMode = section.mode === "MISSING" ? "PLAN_ONLY" : section.mode;
  if (!isAlpha9Hash(optionHash) || alpha9Hash(core) !== optionHash || option.sourceHash !== section.contentHash || !option.revision.trim() || /^(?:證據校準|建議結構|跨領域清晰)版[｜|]/u.test(option.revision) || option.preservesEvidence !== true || option.resultingMode !== expectedMode) throw new Error("alpha9_revision_option_invalid");
}

export function validateV2Alpha9ManuscriptWorkspace(value: V2Alpha9Workspace): V2Alpha9Workspace {
  if (value.contractVersion !== V2_ALPHA9_CONTRACT_VERSION || value.track !== "JOURNAL_MANUSCRIPT" || value.sourcePreserved !== true) throw new Error("alpha9_workspace_authority_invalid");
  if (!isAlpha9Hash(value.sourceArtifactHash) || !isAlpha9Hash(value.workspaceHash)) throw new Error("alpha9_workspace_hash_invalid");
  if (value.formalResearchWriteCount !== 0 || value.onlineDatabaseWriteCount !== 0 || value.networkCallCount !== 0 || value.externalMutationCount !== 0) throw new Error("alpha9_workspace_effect_boundary_invalid");
  const sections = validateAlpha9Sections(value.sections);
  const reviewDraft = validateAlpha9Sections(value.reviewDraft);
  if (alpha9SectionsHash(reviewDraft) !== value.reviewDraftHash || value.humanGate.required !== true || value.humanGate.confirmed !== false || value.humanGate.scope !== "WHOLE_ARTIFACT" || value.humanGate.contentHash !== value.reviewDraftHash) throw new Error("alpha9_human_gate_invalid");
  if (alpha9SectionsHash(sections) !== alpha9SectionsHash(reviewDraft)) throw new Error("alpha9_review_draft_binding_invalid");
  if (value.paperpalBoundary.mode !== "MANUAL_DOCX_EXPORT_IMPORT_UNCONFIGURED" || value.paperpalBoundary.status !== "UNCONFIGURED" || value.paperpalBoundary.liveConnection !== false || value.paperpalBoundary.sourceMutation !== "FORBIDDEN" || value.paperpalBoundary.importedCandidateMayUpgradeEvidence !== false || value.paperpalBoundary.trackedDocxSemanticMerge !== "NOT_IMPLEMENTED") throw new Error("alpha9_paperpal_boundary_invalid");
  if (value.priorityFindings.length !== 3 || new Set(value.priorityFindings.map((finding) => finding.findingId)).size !== 3 || new Set(value.priorityFindings.map((finding) => finding.sectionKey)).size !== 3) throw new Error("alpha9_finding_cardinality_invalid");
  value.priorityFindings.forEach((finding, index) => {
    const section = reviewDraft.find((item) => item.sectionKey === finding.sectionKey);
    if (!section || finding.rank !== index + 1 || finding.sourceHash !== section.contentHash || finding.options.length !== 3 || new Set(finding.options.map((option) => option.strategy)).size !== 3 || new Set(finding.options.map((option) => option.revision)).size !== 3) throw new Error("alpha9_finding_invalid");
    finding.options.forEach((option) => validateOption(option, section));
    const recommended = finding.options.filter((option) => option.recommended);
    if (recommended.length !== 1 || recommended[0].optionId !== finding.recommendedOptionId || recommended[0].strategy !== "STRUCTURE_RECOMMENDED") throw new Error("alpha9_finding_recommendation_invalid");
    const { findingHash, ...core } = finding;
    if (!isAlpha9Hash(findingHash) || alpha9Hash(core) !== findingHash) throw new Error("alpha9_finding_hash_mismatch");
  });
  if (value.completenessMatrix.entries.length !== 13 || value.completenessMatrix.entries.some((entry, index) => entry.sectionKey !== V2_ALPHA9_SECTION_KEYS[index] || entry.contentHash !== reviewDraft[index].contentHash)) throw new Error("alpha9_completeness_matrix_invalid");
  const derivedMatrix = createCompletenessMatrix(reviewDraft);
  if (value.completenessMatrix.passCount !== derivedMatrix.passCount || value.completenessMatrix.blockingCount !== derivedMatrix.blockingCount || value.completenessMatrix.matrixHash !== derivedMatrix.matrixHash) throw new Error("alpha9_completeness_matrix_mismatch");
  const { matrixHash, ...matrixCore } = value.completenessMatrix;
  if (!isAlpha9Hash(matrixHash) || alpha9Hash(matrixCore) !== matrixHash) throw new Error("alpha9_completeness_matrix_hash_mismatch");
  validateCitationLedger(value.citationLedger);
  validateStatisticLedger(value.statisticLedger);
  validateVisualLedger(value.visualLedger, value.statisticLedger);
  const expectedIntegrity: V2Alpha9Workspace["integrityStatus"] = derivedMatrix.blockingCount > 0
    || value.citationLedger.some((entry) => entry.verificationStatus === "CONFLICT")
    || value.statisticLedger.some((entry) => entry.verificationStatus === "CONFLICT" || entry.verificationStatus === "MISSING")
    || value.visualLedger.some((entry) => entry.verificationStatus === "CONFLICT" || entry.verificationStatus === "MISSING_SOURCE")
    ? "BLOCKED_EVIDENCE_OR_INTEGRITY"
    : derivedMatrix.passCount < 13
      ? "READY_WITH_GAPS"
      : "FINAL_CONFIRMABLE";
  if (value.integrityStatus !== expectedIntegrity) throw new Error("alpha9_integrity_status_mismatch");
  const { workspaceHash, ...core } = value;
  if (!isAlpha9Hash(workspaceHash) || alpha9Hash(core) !== workspaceHash) throw new Error("alpha9_workspace_hash_mismatch");
  return value;
}

export function applyV2Alpha9WholeArtifactReview(
  workspace: V2Alpha9Workspace,
  currentSections: V2Alpha9CanonicalSections,
  currentHash: string,
  selections: readonly V2Alpha9FindingSelection[],
): V2Alpha9WholeArtifactApplication {
  validateV2Alpha9ManuscriptWorkspace(workspace);
  const current = validateAlpha9Sections(currentSections);
  const calculatedCurrentHash = alpha9SectionsHash(current);
  if (currentHash !== calculatedCurrentHash || currentHash !== workspace.reviewDraftHash) throw new Error("alpha9_stale_candidate");
  if (selections.length !== 3 || new Set(selections.map((selection) => selection.findingId)).size !== 3) throw new Error("alpha9_selection_cardinality_invalid");
  const selectedOptions = workspace.priorityFindings.map((finding) => {
    const selection = selections.find((item) => item.findingId === finding.findingId);
    const option = selection ? finding.options.find((item) => item.optionId === selection.optionId) : undefined;
    if (!option) throw new Error("alpha9_selection_invalid");
    return { finding, option };
  });
  const applied = current.map((section) => {
    const selected = selectedOptions.find(({ finding }) => finding.sectionKey === section.sectionKey);
    if (!selected) return section;
    if (selected.finding.sourceHash !== section.contentHash || selected.option.sourceHash !== section.contentHash) throw new Error("alpha9_stale_candidate");
    return createAlpha9Section({
      sectionKey: section.sectionKey,
      text: selected.option.revision,
      mode: selected.option.resultingMode,
      evidenceState: section.evidenceState,
      sourceMaterialIds: [...section.sourceMaterialIds],
      sourceStatisticIds: [...section.sourceStatisticIds],
      sourceHashes: [...new Set([...section.sourceHashes, section.contentHash, selected.option.optionHash])],
      unresolvedItems: [...section.unresolvedItems],
    });
  });
  const appliedSections = validateAlpha9Sections(applied);
  const originalSections = cloneSections(current);
  return {
    workspaceHash: workspace.workspaceHash,
    sourceReviewDraftHash: workspace.reviewDraftHash,
    selectedOptionIds: selectedOptions.map(({ option }) => option.optionId) as [string, string, string],
    originalSections,
    appliedSections,
    originalHash: calculatedCurrentHash,
    appliedHash: alpha9SectionsHash(appliedSections),
    formalResearchWriteCount: 0,
    onlineDatabaseWriteCount: 0,
    networkCallCount: 0,
    externalMutationCount: 0,
  };
}

export function undoV2Alpha9WholeArtifactReview(application: V2Alpha9WholeArtifactApplication, currentAppliedHash: string) {
  if (currentAppliedHash !== application.appliedHash || alpha9SectionsHash(application.appliedSections) !== application.appliedHash || alpha9SectionsHash(application.originalSections) !== application.originalHash) throw new Error("alpha9_undo_stale_candidate");
  return { sections: cloneSections(application.originalSections), hash: application.originalHash };
}

export const V2_ALPHA9_MANUSCRIPT_REVIEW_BOUNDARY = Object.freeze({
  exactSectionCount: 13,
  priorityFindingCount: 3,
  revisionOptionCountPerFinding: 3,
  recommendedOptionCountPerFinding: 1,
  applicationScope: "WHOLE_ARTIFACT_ATOMIC_SNAPSHOT",
  staleCandidate: "FAIL_CLOSED",
  paperpal: "MANUAL_DOCX_EXPORT_IMPORT_UNCONFIGURED",
  evidenceUpgrade: "FORBIDDEN",
  formalResearchWrites: 0,
  onlineDatabaseWrites: 0,
  networkCalls: 0,
  externalMutations: 0,
});
