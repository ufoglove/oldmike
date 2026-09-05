import { beta1CanonicalJson, beta1Hash, isBeta1Hash } from "./canonical-hash.ts";
import { extractV2Beta1StructuredEvidenceRecords, isV2Beta1EvidenceBearingRecord } from "./evidence-anchors.ts";
import { createV2Beta1HumanDraftAuthority, type V2Beta1EvidenceAuthority } from "./professional-projection.ts";
import { createV2Beta1CitationCatalog, createV2Beta1ResearchIntegrityGraph, type V2Beta1CitationCatalog } from "./research-integrity.ts";
import { V2_BETA1_CONTINUATION_SECTIONS, V2_BETA1_REVIEW_STRATEGIES } from "./shared-authority.ts";
import type {
  V2Beta1AnalysisWorkPackage,
  V2Beta1ContinuationSection,
  V2Beta1Direction,
  V2Beta1DirectionSelectionArtifact,
  V2Beta1EvidenceGap,
  V2Beta1PriorityFinding,
  V2Beta1SourceMaterial,
  V2Beta1TaiwanProposalArtifact,
} from "./contracts.ts";

export const V2_BETA1_SELECTION_AUTHORITY_VERSION = "old-mike-v2-beta1/evidence-projection-bundle/1" as const;

export type V2Beta1EvidenceProjectionParent = {
  outputTarget: "SCI" | "SSCI" | "NSTC" | "MOE";
  researchDomainHash: string;
  officialSourceBundleHash: string | null;
  direction: Omit<V2Beta1Direction, "selectionArtifact">;
  materials: readonly V2Beta1SourceMaterial[];
  evidenceAuthority: V2Beta1EvidenceAuthority;
};

const REQUIRED_MANUSCRIPT_SECTIONS = ["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"] as const;

function clip(value: string, maximum: number) {
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1)}…`;
}

function sourceBundleHash(materials: readonly V2Beta1SourceMaterial[]) {
  return beta1Hash(materials.map(({ materialId, kind, title, contentHash }) => ({ materialId, kind, title, contentHash })));
}

function continuation(input: Omit<V2Beta1ContinuationSection, "contentHash">): V2Beta1ContinuationSection {
  return { ...input, contentHash: beta1Hash(input) };
}

function evidenceNarrative(source: string, subject: string) {
  const records = extractV2Beta1StructuredEvidenceRecords(source).records.filter(isV2Beta1EvidenceBearingRecord);
  if (!records.length) return `材料對${subject}只支持有限描述；未形成完整觀察鍵時，不得提高因果或結果確定性`;
  return records.map((record) => {
    if (!record.structured) return `${record.raw} 尚未形成完整觀察鍵，因此對${subject}只支持有限描述。`;
    const context = record.observationKeySpans.join("；");
    const effects = record.effects.map((effect) => `${effect.raw}${effect.scopeSpans.length ? `，其相鄰證據範圍指出${effect.scopeSpans.join("，")}` : "，其方向與估計維持原始證據界線"}`).join("；而");
    const details = [...record.sampleSizeSpans, ...record.probabilitySpans, ...record.confidenceIntervalSpans, ...record.citationSpans].join("、");
    return `在${context}所界定的觀察中，${effects}；${details ? `${details}共同界定樣本、估計、區間與引用依據，` : ""}因此對${subject}只形成可追溯且可反駁的有限命題`;
  }).join("；");
}

function reviewAlternatives(findingId: string, sourceText: string, subject: string, citationCatalog: V2Beta1CitationCatalog, ownDataBinding: boolean): V2Beta1PriorityFinding["revisions"] {
  const narrative = evidenceNarrative(sourceText, subject);
  const texts = [
    `就${subject}而言，${narrative}；本文把推論限定於可觀察關聯，並以替代解釋與失效條件限制外推。`,
    `${narrative}；這項精簡論證連結${subject}的研究問題、作用機制與必要限制，且不提高既有證據強度。`,
    `${narrative}；這項結果使${subject}形成可檢驗張力，後續須比較機制與情境解釋，並以反證條件約束結論。`,
  ];
  const rationales = ["重組主張與證據順序，優先排除超出來源的推論。", "以精簡論證連結來源觀察、機制、證據與限制。", "改用問題張力與反證結構，保留作者語氣但不提高確定性。"];
  const risks = ["較保守，需另在貢獻段補足研究價值。", "需確認每個來源錨點在正文可追溯。", "敘事張力較高，須防止讀者誤認為結果已獲驗證。"];
  return V2_BETA1_REVIEW_STRATEGIES.map((strategy, index) => {
    const text = texts[index];
    const researchIntegrity = createV2Beta1ResearchIntegrityGraph({ findingId, sourceText, revisionText: text, citationCatalog, ownDataBinding });
    const core = { revisionId: `revision:${beta1Hash({ findingId, strategy, sourceText }).slice(0, 36)}`, strategy, text, rationale: rationales[index], risk: risks[index], recommended: index === 1, researchIntegrity };
    return { ...core, revisionHash: beta1Hash(core) };
  }) as V2Beta1PriorityFinding["revisions"];
}

function finding(id: string, location: string, title: string, reason: string, sourceText: string, subject: string, citationCatalog: V2Beta1CitationCatalog, ownDataBinding = false): V2Beta1PriorityFinding {
  const revisions = reviewAlternatives(id, sourceText, subject, citationCatalog, ownDataBinding);
  return { findingId: id, location, title, reason, sourceText, recommendedRevisionId: revisions[1].revisionId, revisions };
}

function snapshot(title: string, sections: Record<string, string>) {
  const core = { title, sections };
  return { ...core, contentHash: beta1Hash(core) };
}

function logicalSectionMaterial(section: typeof REQUIRED_MANUSCRIPT_SECTIONS[number], materials: readonly V2Beta1SourceMaterial[]) {
  if (section === "DISCUSSION") return materials.find((item) => item.kind === "NOTE" && /discussion|討論/iu.test(`${item.materialId} ${item.title} ${item.content.slice(0, 24)}`));
  if (section === "CONCLUSION") return materials.find((item) => item.kind === "NOTE" && /conclusion|結論/iu.test(`${item.materialId} ${item.title} ${item.content.slice(0, 24)}`));
  return materials.find((item) => item.kind === section);
}

function manuscriptSourceSections(materials: readonly V2Beta1SourceMaterial[]) {
  const sections: Record<string, string> = {};
  for (const section of REQUIRED_MANUSCRIPT_SECTIONS) sections[section] = logicalSectionMaterial(section, materials)?.content ?? `MISSING: ${section}`;
  materials.forEach((item, index) => { sections[`SOURCE_${String(index + 1).padStart(2, "0")}_${item.kind}`] = item.content; });
  return sections;
}

function journalArtifact(target: "SCI" | "SSCI", selected: Omit<V2Beta1Direction, "selectionArtifact">, evidenceAuthority: V2Beta1EvidenceAuthority, materials: readonly V2Beta1SourceMaterial[]) {
  const sourceSections = manuscriptSourceSections(materials);
  const citationCatalog = createV2Beta1CitationCatalog(materials);
  const findings = [
    finding(`finding:journal:${selected.directionHash.slice(0, 12)}:argument`, "INTRODUCTION", "論證鏈需由來源支持", "研究問題、機制與貢獻必須維持材料可支持的界線。", sourceSections.INTRODUCTION, "研究問題與機制的證據鏈", citationCatalog),
    finding(`finding:journal:${selected.directionHash.slice(0, 12)}:method`, "METHODS", "方法需排除替代解釋", "設計需連結樣本、量測、分析與主要替代解釋。", sourceSections.METHODS, "方法、量測與替代解釋", citationCatalog),
    finding(`finding:journal:${selected.directionHash.slice(0, 12)}:results`, "RESULTS", "結果狀態不可被誤寫", "結果必須依原始材料呈現，缺失、矛盾或規劃內容不得變成發現。", sourceSections.RESULTS, "結果方向與不確定性", citationCatalog, true),
  ] as NonNullable<V2Beta1DirectionSelectionArtifact["journal"]>["priorityFindings"];
  const proposedSections = { ...sourceSections, INTRODUCTION: findings[0].revisions[1].text, METHODS: findings[1].revisions[1].text, RESULTS: findings[2].revisions[1].text };
  const reviewStatus = evidenceAuthority.summary.reviewStatus;
  return { target, verificationCollection: target === "SCI" ? "SCIE" as const : "SSCI" as const, sourceSnapshot: snapshot(selected.title, sourceSections), proposedSnapshot: snapshot(selected.title, proposedSections), reviewStatus, priorityFindings: findings, publicationUsable: evidenceAuthority.summary.publicationUsable && findings[2].revisions.every((revision) => revision.researchIntegrity.publicationUsable) };
}

const TAIWAN_COPY = Object.freeze({
  NSTC: { framing: "以可累積理論貢獻、可否證機制與跨年度研究節點形成國科會研究計畫架構。", packages: [["理論構念與證據鏈建模", "建立可反駁機制、替代解釋與量測契約。"], ["先導驗證與正式研究", "完成先導修正後執行主要研究與敏感度分析。"], ["整合分析與學術成果", "形成可重現分析、理論邊界與國際期刊成果包。"]], kpis: ["理論與量測契約通過完整性檢核", "先導與主要分析均有可追溯紀錄", "形成可重現成果與限制說明"], budget: [360000, 540000, 300000], attachments: ["研究計畫內容與參考文獻", "人力、設備與研究材料估算", "倫理與資料治理檢核"] },
  MOE: { framing: "以教學現場問題、課程介入、學習成效與反思迭代形成教育部教學實踐計畫架構。", packages: [["教學問題與學習需求診斷", "界定課程痛點、學習者需求與可觀察基準。"], ["教學介入與課堂迭代", "執行可行的教學設計、忠實度紀錄與形成性修正。"], ["成效評估與教學分享", "整合學習證據、教師反思與可移轉教學資源。"]], kpis: ["完成課程問題與基準證據盤點", "完成教學介入與形成性修正紀錄", "形成可供教學社群審查的成果包"], budget: [120000, 210000, 120000], attachments: ["教學場域與課程設計說明", "學習成效與評量工具草案", "倫理、同意與教學成果分享檢核"] },
} as const);

function evidenceBoundaryText(authority: V2Beta1EvidenceAuthority) {
  if (authority.summary.resultState === "OBSERVED") return authority.summary.consistencyProven && authority.summary.traceable ? "已提供一致且可追溯的觀察材料。" : "已提供觀察材料，但一致性、引用或不確定性仍待核對。";
  if (authority.summary.resultState === "CONFLICT") return "相同觀察身分下的材料互相衝突，完成核對前不得形成結果主張。";
  if (authority.summary.resultState === "PLANNED") return "材料只描述預期或待分析結果，不構成已觀察發現。";
  return "尚無可驗證結果材料，所有效果與官方事實均維持待確認。";
}

function taiwanArtifact(target: "NSTC" | "MOE", selected: Omit<V2Beta1Direction, "selectionArtifact">, officialSourceBundleHash: string, evidenceAuthority: V2Beta1EvidenceAuthority) {
  const targetCopy = TAIWAN_COPY[target]; const citationCatalog = createV2Beta1CitationCatalog([]); const boundary = evidenceBoundaryText(evidenceAuthority);
  const sourceSections = { PROBLEM_AND_OBJECTIVES: selected.s0.problemContext, THEORY_AND_EVIDENCE: `${targetCopy.framing} ${selected.mechanism} ${boundary}`, METHOD_AND_DESIGN: selected.s0.methodIdea, WORK_PLAN: `${selected.s0.timeline} ${targetCopy.packages.map(([title]) => title).join("、")}。`, EXPECTED_OUTCOMES: `${selected.s0.expectedContribution} ${targetCopy.kpis.join("；")}。${boundary}`, ETHICS_AND_RISK: selected.s0.ethicsPrivacyRisks };
  const findings = [
    finding(`finding:proposal:${selected.directionHash.slice(0, 12)}:problem`, "PROBLEM_AND_OBJECTIVES", "問題與目標需可稽核", "問題背景、目標與衡量結果須維持同一邏輯。", sourceSections.PROBLEM_AND_OBJECTIVES, `${target}問題、目標與可衡量結果`, citationCatalog),
    finding(`finding:proposal:${selected.directionHash.slice(0, 12)}:method`, "METHOD_AND_DESIGN", "方法需連結工作包", "方法、工作包、KPI 與風險需要可追溯。", sourceSections.METHOD_AND_DESIGN, `${target}方法、工作包與KPI`, citationCatalog),
    finding(`finding:proposal:${selected.directionHash.slice(0, 12)}:rules`, "WORK_PLAN", "官方規則仍未知", "期限、預算與附件不可由記憶或建議取代同週期官方來源。", sourceSections.WORK_PLAN, `${target}時程與官方規則未知狀態`, citationCatalog),
  ] as V2Beta1PriorityFinding[];
  const proposed = { ...sourceSections, PROBLEM_AND_OBJECTIVES: findings[0].revisions[1].text, METHOD_AND_DESIGN: findings[1].revisions[1].text, WORK_PLAN: findings[2].revisions[1].text };
  const workPackages = targetCopy.packages.map(([title, objective], index) => ({ workPackageId: `wp:${target.toLowerCase()}:${index + 1}`, title, objective }));
  const kpis = targetCopy.kpis.map((measure, index) => ({ kpiId: `kpi:${target.toLowerCase()}:${index + 1}`, workPackageId: workPackages[index].workPackageId, measure, target: "以本機合成完整性檢核為規劃值，正式門檻須待官方與場域確認" }));
  const allocations = targetCopy.budget.map((amountTwd, index) => ({ workPackageId: workPackages[index].workPackageId, amountTwd }));
  return { targetId: target, proposalTitle: selected.title, narrativeSections: proposed, workPackages, kpis, budget: { currency: "TWD" as const, totalTwd: allocations.reduce((sum, item) => sum + item.amountTwd, 0), authority: "LOCAL_SYNTHETIC_UNVERIFIED" as const, allocations }, attachments: targetCopy.attachments.map((label, index) => ({ attachmentId: `attachment:${target.toLowerCase()}:${index + 1}`, label, status: index === 0 ? "UNKNOWN_OR_STALE" : "REQUIRES_HUMAN_REVIEW" })), sourceSnapshot: snapshot(selected.title, sourceSections), proposedSnapshot: snapshot(selected.title, proposed), priorityFindings: findings as V2Beta1TaiwanProposalArtifact["priorityFindings"], finalReviewStatus: "READY_WITH_GAPS" as const, officialFactsState: "UNKNOWN_OR_STALE" as const, officialSourceBundleHash };
}

function evidenceGapMap(materials: readonly V2Beta1SourceMaterial[], authority: V2Beta1EvidenceAuthority, direction: Omit<V2Beta1Direction, "selectionArtifact">): V2Beta1EvidenceGap[] {
  const resultStatement = authority.summary.resultState === "OBSERVED" ? authority.summary.consistencyProven && authority.summary.traceable ? "已提供一致且可追溯的觀察材料；仍須核對估計程序與重現條件。" : "已提供觀察材料，但樣本、估計、不確定性、一致性或引用仍有缺口。" : authority.summary.resultState === "CONFLICT" ? "相同觀察身分下的數值或結果敘述衝突，必須先完成一致性處理。" : authority.summary.resultState === "PLANNED" ? "結果只屬規劃或預期，尚未形成可驗證觀察。" : "未提供可驗證結果；結果維持缺失或尚待釐清。";
  const resultState: V2Beta1EvidenceGap["state"] = authority.summary.resultState === "OBSERVED" ? "OBSERVED" : authority.summary.resultState === "CONFLICT" ? "CONFLICT" : "MISSING";
  const base: V2Beta1EvidenceGap[] = [
    { gapId: `gap:source:${direction.directionHash.slice(0, 12)}`, statement: materials.length ? `${direction.professionalProjection.laneLabel}方向受已提供材料約束；來源脈絡與資料品質仍待獨立核對。` : `${direction.professionalProjection.laneLabel}方向沒有可核對材料；機制、資料與結果均維持未驗證或缺失。`, state: materials.length ? "UNVERIFIED" : "MISSING", sourceMaterialIds: materials.map((item) => item.materialId) },
    { gapId: `gap:results:${direction.directionHash.slice(0, 12)}`, statement: resultStatement, state: resultState, sourceMaterialIds: materials.filter((item) => ["RESULTS", "STATISTICS", "TABLE", "FIGURE"].includes(item.kind)).map((item) => item.materialId) },
  ];
  const clauseGaps = authority.clauses.filter((clause) => clause.state !== "OBSERVED").map((clause) => ({ gapId: `gap:clause:${clause.clauseId.slice(-20)}`, statement: clause.state === "UNRESOLVED" ? "一段結果材料無法可靠解析，維持尚待釐清，不視為發現。" : clause.state === "PLANNED" ? "一段材料描述規劃或預期結果，不視為已觀察證據。" : "一段材料明確缺少必要資訊。", state: clause.state === "UNRESOLVED" ? "UNVERIFIED" as const : "MISSING" as const, sourceMaterialIds: materials.some((item) => item.materialId === clause.materialId) ? [clause.materialId] : [] }));
  return [...base, ...clauseGaps];
}

function analysisWorkPackages(materials: readonly V2Beta1SourceMaterial[], direction: Omit<V2Beta1Direction, "selectionArtifact">): V2Beta1AnalysisWorkPackage[] {
  return [
    { workPackageId: `analysis:${direction.directionHash.slice(0, 12)}:01`, title: `${direction.professionalProjection.laneLabel}證據與資料品質稽核`, objective: `依「${clip(direction.researchQuestion, 180)}」區分觀察材料、未知與矛盾。`, steps: ["核對材料位元組與來源", "確認構念與結果可操作化", "記錄缺失及矛盾"], deliverables: ["證據缺口圖", "資料品質紀錄"], sourceMaterialIds: materials.map((item) => item.materialId), claimPolicy: "RECONCILIATION_ONLY" },
    { workPackageId: `analysis:${direction.directionHash.slice(0, 12)}:02`, title: `${direction.professionalProjection.laneLabel}機制與分析規格`, objective: "把研究問題、機制、資料、分析與可否證條件對齊。", steps: ["界定主要與替代解釋", "預先列出分析規格", "設定敏感度與失效檢核"], deliverables: ["分析工作包", "結果解讀界線"], sourceMaterialIds: materials.map((item) => item.materialId), claimPolicy: "ANALYSIS_PLAN_ONLY" },
  ];
}

export function v2Beta1WholeArtifactValue(direction: Pick<V2Beta1Direction, "s0" | "preview">, selection: Omit<V2Beta1DirectionSelectionArtifact, "wholeArtifactHash" | "humanGateHash">) {
  return { ...selection, s0: direction.s0, preview: direction.preview };
}

export function deriveEvidenceProjectionBundle(parent: V2Beta1EvidenceProjectionParent): V2Beta1DirectionSelectionArtifact {
  const { outputTarget, researchDomainHash, officialSourceBundleHash, direction, materials, evidenceAuthority } = parent;
  if (!isBeta1Hash(researchDomainHash) || evidenceAuthority.outputTarget !== outputTarget || (outputTarget === "SCI" || outputTarget === "SSCI" ? officialSourceBundleHash !== null : !isBeta1Hash(officialSourceBundleHash))) throw new Error("beta1_selection_parent_invalid");
  const gaps = evidenceGapMap(materials, evidenceAuthority, direction);
  const packages = analysisWorkPackages(materials, direction);
  const continuationSections = V2_BETA1_CONTINUATION_SECTIONS.map((sectionId) => continuation({ sectionId, text: direction.preview.sections[sectionId], evidenceState: sectionId === "RESULTS" ? evidenceAuthority.summary.resultState === "OBSERVED" ? "OBSERVED" : "MISSING" : "ASSUMPTION", sourceMaterialIds: materials.map((item) => item.materialId) })) as V2Beta1DirectionSelectionArtifact["continuationSections"];
  const journal = outputTarget === "SCI" || outputTarget === "SSCI" ? journalArtifact(outputTarget, direction, evidenceAuthority, materials) : null;
  const taiwanProposal = outputTarget === "NSTC" || outputTarget === "MOE" ? taiwanArtifact(outputTarget, direction, officialSourceBundleHash!, evidenceAuthority) : null;
  const core = { schemaId: "old-mike-v2-beta1/direction-selection/2" as const, kind: journal ? "JOURNAL" as const : "TAIWAN_PROPOSAL" as const, outputTarget, researchDomainHash, selectedDirectionHash: direction.directionHash, inputBundleHash: direction.inputBundleHash, sourceBundleHash: sourceBundleHash(materials), officialSourceBundleHash, observationAuthorityHash: evidenceAuthority.observationAuthorityHash, evidenceAuthority, evidenceGapMap: gaps, analysisWorkPackages: packages, continuationSections, journal, taiwanProposal };
  const humanDraft = createV2Beta1HumanDraftAuthority({ projection: direction.professionalProjection, evidenceAuthority, fieldAssist: direction.fieldAssist, evidenceGapMap: gaps, analysisWorkPackages: packages, continuationSections, journal, taiwanProposal });
  const completeCore = { ...core, humanDraft, projectionHash: humanDraft.projectionHash };
  const wholeArtifactHash = beta1Hash(v2Beta1WholeArtifactValue(direction, completeCore));
  return { ...completeCore, wholeArtifactHash, humanGateHash: beta1Hash({ scope: "WHOLE_ARTIFACT", wholeArtifactHash, projectionHash: humanDraft.projectionHash }) };
}

export function validateEvidenceProjectionBundle(value: unknown, parent: V2Beta1EvidenceProjectionParent) {
  try { return beta1CanonicalJson(value) === beta1CanonicalJson(deriveEvidenceProjectionBundle(parent)); } catch { return false; }
}
