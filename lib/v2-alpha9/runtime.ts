import "server-only";

import { parseProposalDraft, type ProposalDraft } from "../proposal-studio-contract.ts";
import { createBuiltinDomainSelection } from "../v2-alpha3/contracts.ts";
import { V2_ALPHA5_CONTRACT_VERSION, type V2Alpha5Workspace } from "../v2-alpha5/contracts.ts";
import { createSyntheticOfficialSourceBundle } from "../v2-alpha5/official-source-bundle.ts";
import { createSyntheticAlpha5Workspace } from "../v2-alpha5/runtime.ts";
import { V2_ALPHA8_CONTRACT_VERSION } from "../v2-alpha8/contracts.ts";
import { createSyntheticV2Alpha8Workspace } from "../v2-alpha8/runtime.ts";
import { fromAlpha8Workspace } from "./adapters.ts";
import {
  V2_ALPHA9_CONTRACT_VERSION,
  V2_ALPHA9_PAPERPAL_BOUNDARY,
  V2_ALPHA9_REVISION_STRATEGIES,
  V2_ALPHA9_SECTION_KEYS,
  alpha9Hash,
  isAlpha9Hash,
  type V2Alpha9CanonicalSection,
  type V2Alpha9PaperpalBoundary,
  type V2Alpha9SectionKey,
  type V2Alpha9Track,
} from "./contracts.ts";
import {
  applyV2Alpha9WholeArtifactReview,
  createV2Alpha9ManuscriptReview,
  validateV2Alpha9ManuscriptWorkspace,
} from "./manuscript-review.ts";
import { reviewAlpha9TaiwanProposal } from "./taiwan-review.ts";

export const V2_ALPHA9_REQUEST_MAX_BYTES = 16_384;

export const V2_ALPHA9_FIXTURE_SEEDS = Object.freeze({
  JOURNAL_MANUSCRIPT: "alpha8-journal-handoff",
  NSTC_PROPOSAL: "alpha5-nstc-handoff",
  MOE_PROPOSAL: "alpha5-moe-handoff",
} as const satisfies Record<V2Alpha9Track, string>);

export type V2Alpha9LocalFinalizeRequest = {
  contractVersion: typeof V2_ALPHA9_CONTRACT_VERSION;
  requestId: string;
  idempotencyKey: string;
  track: V2Alpha9Track;
  fixtureSeed: (typeof V2_ALPHA9_FIXTURE_SEEDS)[V2Alpha9Track];
};

export type V2Alpha9Snapshot = {
  title: string;
  sections: Record<V2Alpha9SectionKey, string>;
};

export type V2Alpha9UiAlternative = {
  alternativeId: string;
  strategy: string;
  label: string;
  text: string;
  recommended: boolean;
};

export type V2Alpha9UiPriorityIssue = {
  issueId: string;
  location: V2Alpha9SectionKey;
  title: string;
  reason: string;
  recommendedAlternativeId: string;
  alternatives: readonly [V2Alpha9UiAlternative, V2Alpha9UiAlternative, V2Alpha9UiAlternative];
};

export type V2Alpha9UiWorkspace = {
  contractVersion: typeof V2_ALPHA9_CONTRACT_VERSION;
  requestId: string;
  track: V2Alpha9Track;
  status: string;
  sourceArtifactHash: string;
  sourceSnapshot: V2Alpha9Snapshot;
  proposedSnapshot: V2Alpha9Snapshot;
  priorityIssues: readonly [V2Alpha9UiPriorityIssue, V2Alpha9UiPriorityIssue, V2Alpha9UiPriorityIssue];
  completedCount: number;
  gapCount: number;
  officialComplianceStatus: string | null;
  humanGate: { required: true; scope: "WHOLE_ARTIFACT"; confirmed: false; contentHash: string };
  paperpalBoundary: V2Alpha9PaperpalBoundary | null;
  formalResearchWriteCount: 0;
};

type UnknownRecord = Record<string, unknown>;
type CoordinatorResult = { workspace: V2Alpha9UiWorkspace; replayed: boolean };

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: UnknownRecord, keys: readonly string[], code: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(code);
}

function safeIdentifier(value: unknown, code: string, minimum: number, maximum: number) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(normalized)) throw new Error(code);
  return normalized;
}

export function parseV2Alpha9LocalFinalizeRequest(value: unknown): V2Alpha9LocalFinalizeRequest {
  if (!isRecord(value)) throw new Error("alpha9_request_invalid");
  exactKeys(value, ["contractVersion", "requestId", "idempotencyKey", "track", "fixtureSeed"], "alpha9_request_invalid");
  if (value.contractVersion !== V2_ALPHA9_CONTRACT_VERSION) throw new Error("alpha9_request_authority_invalid");
  if (value.track !== "JOURNAL_MANUSCRIPT" && value.track !== "NSTC_PROPOSAL" && value.track !== "MOE_PROPOSAL") throw new Error("alpha9_track_invalid");
  if (value.fixtureSeed !== V2_ALPHA9_FIXTURE_SEEDS[value.track]) throw new Error("alpha9_fixture_binding_invalid");
  return {
    contractVersion: V2_ALPHA9_CONTRACT_VERSION,
    requestId: safeIdentifier(value.requestId, "alpha9_request_id_invalid", 8, 150),
    idempotencyKey: safeIdentifier(value.idempotencyKey, "alpha9_idempotency_key_invalid", 16, 150),
    track: value.track,
    fixtureSeed: value.fixtureSeed as V2Alpha9LocalFinalizeRequest["fixtureSeed"],
  };
}

function journalFixtureRequest(request: V2Alpha9LocalFinalizeRequest) {
  return {
    contractVersion: V2_ALPHA8_CONTRACT_VERSION,
    requestId: `alpha8-${request.requestId}`,
    idempotencyKey: `alpha8-${request.idempotencyKey}`,
    focusDomain: { kind: "BUILTIN" as const, domainId: "ai-education", label: "AI應用於教育" },
    goal: "JOURNAL_MANUSCRIPT" as const,
    resultReadiness: "OBSERVED_RESULTS_AVAILABLE" as const,
    materials: [
      { materialId: "alpha9-abstract", kind: "ABSTRACT" as const, title: "摘要半成品", content: "本研究探討智慧回饋如何影響高等教育學習者的自我調節與任務表現，並以可追溯資料限制推論範圍。" },
      { materialId: "alpha9-introduction", kind: "INTRODUCTION" as const, title: "前言半成品", content: "既有研究多關注工具使用成效，對回饋機制、學習策略與情境條件之間的關聯仍缺少整合檢驗。" },
      { materialId: "alpha9-methods", kind: "METHODS" as const, title: "方法半成品", content: "採準實驗混合方法設計，蒐集前後測、學習歷程與訪談資料；樣本與排除規則仍須依原始紀錄完成最終核對。" },
      { materialId: "alpha9-results", kind: "RESULTS" as const, title: "結果半成品", content: "使用者提供的結果摘要顯示介入組任務完成率為 82%，但正式推論仍須核對樣本分母、資料版本與完整分析輸出。" },
      { materialId: "alpha9-discussion", kind: "DISCUSSION" as const, title: "討論半成品", content: "初步材料支持以回饋可操作性與自我調節作為可能機制，但替代解釋與跨場域適用性仍待驗證。" },
      { materialId: "alpha9-survey", kind: "SURVEY_DATA" as const, title: "問卷統計摘要", content: "問卷資料包含回饋可用性、自我調節與學習投入構面；目前只保留已報告的彙整值。" },
      { materialId: "alpha9-table", kind: "TABLE" as const, title: "表一 任務完成率摘要", content: "介入組任務完成率 82%；表格來源與樣本分母待終稿前核對。" },
      { materialId: "alpha9-citations", kind: "CITATION_LIBRARY" as const, title: "文獻管理資料摘要", content: "已提供與智慧回饋、自我調節及高等教育相關的引用 metadata；引用真實性與主張對齊尚未完成四來源核驗。" },
    ],
    statistics: [
      { statisticId: "alpha9-stat-completion", label: "介入組任務完成率", value: "82", unit: "%", sourceMaterialId: "alpha9-table", consistency: "CONSISTENT_REPORTED" as const, note: "此數值只代表使用者提供的描述性摘要，仍須核對分母與分析資料。" },
    ],
  };
}

function sectionsRecord(entries: readonly { sectionKey: V2Alpha9SectionKey; text: string }[]) {
  const values = Object.fromEntries(entries.map((entry) => [entry.sectionKey, entry.text])) as Record<V2Alpha9SectionKey, string>;
  if (Object.keys(values).length !== V2_ALPHA9_SECTION_KEYS.length || V2_ALPHA9_SECTION_KEYS.some((key) => !(key in values))) throw new Error("alpha9_snapshot_section_invalid");
  return values;
}

function normalizePresentationText(value: string) {
  return value
    .normalize("NFC")
    .replace(/AI應用於教育的作用機制與實務成效：基於現有半成品的整合研究/gu, "智慧回饋、自我調節學習與高等教育任務表現：一項準實驗混合方法研究")
    .replace(/研究以現有半成品為基礎/gu, "研究整合既有稿件、方法、資料與統計紀錄")
    .replace(/基於現有半成品/gu, "依據既有研究材料")
    .replace(/現有半成品/gu, "既有研究材料")
    .replace(/目前可引用的使用者提供描述值為/gu, "現有研究紀錄所載的描述性結果為")
    .replace(/使用者提供的結果摘要/gu, "現有研究紀錄中的結果摘要")
    .replace(/使用者提供材料/gu, "現有研究紀錄")
    .replace(/使用者提供的?/gu, "現有研究紀錄中的")
    .replace(/本機概念模式中/gu, "目前")
    .replace(/本機草稿/gu, "本草案")
    .replace(/本機合成來源未經人工確認/gu, "相關規範仍須依適用年度官方來源核對")
    .replace(/本機合成敘事/gu, "現階段研究敘事")
    .replace(/目前僅有合成證據參照/gu, "目前僅有待核驗的初步證據")
    .replace(/本機/gu, "目前")
    .replace(/Zotero metadata/giu, "文獻書目資料")
    .replace(/Zotero 證據/giu, "文獻管理資料")
    .replace(/Zotero 僅保存/giu, "文獻管理系統僅保存")
    .replace(/引用 metadata/giu, "引用書目資料")
    .replace(/citation、statistic 或 visual ledger/giu, "引用、統計或表圖紀錄")
    .replace(/citation、statistic、visual ledger/giu, "引用、統計與表圖紀錄")
    .replace(/Human Gate/giu, "研究者最終確認")
    .replace(/ZOTERO-ALPHA5-\d+/gu, "候選文獻")
    .replace(/EVIDENCE_ONLY_NOT_OFFICIAL_RULE_OR_BUDGET/gu, "僅作研究證據，不代表官方規範或經費依據")
    .replace(/\bBACKGROUND\b/gu, "研究背景")
    .replace(/\bUNKNOWN\b/gu, "尚待核對")
    .replace(/\bOPERATING\b/gu, "業務費")
    .replace(/\bTWD\b/gu, "元")
    .replace(/\bwp-001\b/gu, "工作包一")
    .replace(/\bwp-002\b/gu, "工作包二")
    .replace(/BUDGET snapshot fixture/giu, "預算草案")
    .replace(/snapshot fixture/giu, "草案")
    .replace(/fixture/giu, "")
    .replace(/合成引用/gu, "候選文獻資料")
    .replace(/所有預期影響均屬建議，不是已證實成果/gu, "預期影響將於計畫執行後依證據評估，現階段不視為已證實成果")
    .replace(/研究整合既有稿件、方法、資料與統計紀錄，整合稿件、方法、資料與統計材料/gu, "研究整合既有稿件、方法、資料與統計紀錄")
    .replace(/上述內容僅代表現有研究紀錄中的觀察紀錄/gu, "上述內容僅代表現有研究紀錄中的描述性觀察")
    .replace(/目標期刊或計畫年度規範尚未在目前查證/gu, "目標期刊規範尚待依官方來源核對")
    .replace(/把\s+文獻書目資料/gu, "把文獻書目資料")
    .replace(/引用書目資料\s+與/gu, "引用書目資料與")
    .replace(/經\s+研究者最終確認/gu, "經研究者最終確認")
    .replace(/研究者最終確認\s+雜湊/gu, "研究者確認紀錄")
    .replace(/[ \t]+([，。；：])/gu, "$1")
    .replace(/([，。；：！？]) +/gu, "$1")
    .replace(/([。！？])；/gu, "$1")
    .replace(/([\p{Script=Han}]) +(?=[\p{Script=Han}])/gu, "$1")
    .replace(/；\s*。|。\s*；/gu, "。")
    .replace(/。。+/gu, "。")
    .replace(/；；+/gu, "；")
    .replace(/；\s*\n/gu, "\n")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function normalizeSnapshotSections(sections: Record<V2Alpha9SectionKey, string>) {
  const normalized = Object.fromEntries(V2_ALPHA9_SECTION_KEYS.map((key) => [key, normalizePresentationText(sections[key])])) as Record<V2Alpha9SectionKey, string>;
  if (/研究對象與實施場域|正式納入排除條件|樣本框/gu.test(normalized.KEYWORDS)) {
    normalized.KEYWORDS = "人工智慧教育；智慧回饋；自我調節學習；學習歷程分析；準實驗研究";
  }
  return normalized;
}

function manuscriptReplacement(section: V2Alpha9CanonicalSection, strategy: string) {
  const source = normalizePresentationText(section.text);
  if (section.sectionKey === "KEYWORDS") {
    if (strategy === "EVIDENCE_CALIBRATED") return "智慧回饋；自我調節學習；任務完成率；高等教育；準實驗設計";
    if (strategy === "STRUCTURE_RECOMMENDED") return "人工智慧教育；智慧回饋；自我調節學習；學習歷程分析；準實驗研究";
    return "人工智慧教育；人機協作；自我調節學習；跨域學習；情境適用性";
  }
  if (section.sectionKey === "REFERENCES") {
    if (strategy === "EVIDENCE_CALIBRATED") return `候選文獻範圍：${source}\n\n引用識別碼、書目資料與主張對齊尚未完成交叉核驗；核驗前不列為正式參考文獻。`;
    if (strategy === "STRUCTURE_RECOMMENDED") return `正式參考文獻暫不列示。現有候選資料聚焦智慧回饋、自我調節與高等教育，但仍須逐筆完成識別碼、書目一致性及主張對齊核驗。`;
    return `跨領域候選文獻目前涵蓋智慧回饋、自我調節與高等教育。後續須分為核心理論、研究方法及跨域轉譯三組完成核驗，通過後才能納入正式書目。`;
  }
  if (section.sectionKey === "LITERATURE_OR_POLICY_CONTEXT") {
    if (strategy === "EVIDENCE_CALIBRATED") return `現有材料將智慧回饋、自我調節與高等教育列為主要文獻軸線。候選書目尚未完成引用真實性與主張對齊核驗，因此本稿暫不據此宣稱特定研究缺口或趨勢。`;
    if (strategy === "STRUCTURE_RECOMMENDED") return `本研究的文獻脈絡依序聚焦智慧回饋的設計特徵、自我調節學習機制與高等教育任務表現。正式論證將逐項連結可核驗文獻；在交叉核驗完成前，研究缺口維持待證狀態。`;
    return `跨領域文獻脈絡將教育科技、人機互動與學習科學並置，檢視智慧回饋如何經由自我調節機制影響任務表現。跨域新穎性與適用邊界仍須由核驗後文獻支持。`;
  }
  if (section.sectionKey === "RESULTS_OR_EXPECTED_OUTCOMES") {
    if (strategy === "EVIDENCE_CALIBRATED") return "現有研究紀錄顯示，介入組任務完成率為 82%。由於樣本分母、資料版本、缺失值處理與模型設定尚未完成核對，本節僅報告此描述性結果，不進行因果、顯著性或外部推廣性推論；相關表圖須在來源資料、樣本數與單位確認後納入終稿。";
    if (strategy === "STRUCTURE_RECOMMENDED") return "介入組任務完成率為 82%。終稿將依序呈現樣本與資料版本、描述統計、主要分析、敏感度分析及對應表圖；在分母、模型設定與不確定性核實前，82% 僅視為描述性觀察，不作因果或顯著性解釋。";
    return "在本研究情境中，現有紀錄顯示介入組任務完成率為 82%。此結果可作為智慧回饋與任務表現關聯的初步觀察，但其跨場域適用性須待樣本分母、資料品質、分析設定及表圖來源完成核對後再行判定。";
  }
  if (section.sectionKey === "DECLARATIONS_OR_ATTACHMENTS") {
    if (strategy === "EVIDENCE_CALIBRATED") return "知情同意、倫理審查、資料可用性、二次利用授權與利益衝突狀態均須與原始研究紀錄核對；在核對完成前，本稿不宣稱已取得倫理核准或資料再利用授權。";
    if (strategy === "STRUCTURE_RECOMMENDED") return "倫理與同意：依原始研究紀錄核對審查機構、核准編號、知情同意及豁免條件。\n\n資料治理：說明資料最小化、去識別化、存取權限、保存期限與資料可用性。\n\n其他聲明：逐項確認利益衝突、資助來源、作者貢獻與必要附件；未核實項目維持待補，不作完成宣稱。";
    return "本研究須以一致且可查核的方式揭露倫理審查與知情同意、資料治理與可用性、二次利用授權、研究者權力關係及利益衝突。各聲明只採用原始研究紀錄可支持的內容，並明列尚待取得的核准資訊或附件。";
  }
  if (strategy === "EVIDENCE_CALIBRATED") return `${source}\n\n本節只保留可追溯材料支持的敘述；未驗證、衝突或缺漏內容不轉寫為研究發現。`;
  if (strategy === "STRUCTURE_RECOMMENDED") return `${source}\n\n本節依研究問題、方法、證據與限制的順序呈現，使每一項結論均可回溯至相應材料。`;
  return `${source}\n\n跨領域詮釋限於已界定的研究情境，並明列概念定義、適用條件與不可外推的邊界。`;
}

function manuscriptWorkspace(request: V2Alpha9LocalFinalizeRequest): V2Alpha9UiWorkspace {
  const alpha8 = createSyntheticV2Alpha8Workspace(journalFixtureRequest(request));
  const review = validateV2Alpha9ManuscriptWorkspace(createV2Alpha9ManuscriptReview(fromAlpha8Workspace(alpha8)));
  const application = applyV2Alpha9WholeArtifactReview(
    review,
    review.reviewDraft,
    review.reviewDraftHash,
    review.priorityFindings.map((finding) => ({ findingId: finding.findingId, optionId: finding.recommendedOptionId })),
  );
  const sourceSections = normalizeSnapshotSections(sectionsRecord(review.reviewDraft));
  const issues = review.priorityFindings.map((finding): V2Alpha9UiPriorityIssue => ({
    issueId: finding.findingId,
    location: finding.sectionKey,
    title: finding.problem,
    reason: normalizePresentationText(`${finding.impact} ${finding.evidenceBoundary}`),
    recommendedAlternativeId: finding.recommendedOptionId,
    alternatives: finding.options.map((option) => ({
      alternativeId: option.optionId,
      strategy: option.strategy,
      label: option.strategy === "EVIDENCE_CALIBRATED" ? "證據校準版" : option.strategy === "STRUCTURE_RECOMMENDED" ? "老麥推薦結構版" : "跨領域清晰版",
      text: normalizePresentationText(manuscriptReplacement(review.reviewDraft.find((section) => section.sectionKey === finding.sectionKey)!, option.strategy)),
      recommended: option.recommended,
    })) as [V2Alpha9UiAlternative, V2Alpha9UiAlternative, V2Alpha9UiAlternative],
  })) as [V2Alpha9UiPriorityIssue, V2Alpha9UiPriorityIssue, V2Alpha9UiPriorityIssue];
  if (application.formalResearchWriteCount !== 0 || application.networkCallCount !== 0 || application.onlineDatabaseWriteCount !== 0 || application.externalMutationCount !== 0) throw new Error("alpha9_workspace_effect_boundary_invalid");
  const proposedSections = structuredClone(sourceSections);
  issues.forEach((issue) => {
    const recommended = issue.alternatives.find((item) => item.alternativeId === issue.recommendedAlternativeId);
    if (!recommended) throw new Error("alpha9_ui_recommendation_invalid");
    proposedSections[issue.location] = recommended.text;
  });
  if (V2_ALPHA9_SECTION_KEYS.some((key) => !proposedSections[key].trim())) throw new Error("alpha9_proposed_snapshot_incomplete");
  const title = sourceSections.TITLE.trim() || "國際期刊論文終稿";
  const proposedTitle = proposedSections.TITLE.trim();
  const sourceSnapshot = { title, sections: sourceSections };
  const proposedSnapshot = { title: proposedTitle, sections: proposedSections };
  return {
    contractVersion: V2_ALPHA9_CONTRACT_VERSION,
    requestId: request.requestId,
    track: request.track,
    status: review.integrityStatus,
    sourceArtifactHash: review.sourceArtifactHash,
    sourceSnapshot,
    proposedSnapshot,
    priorityIssues: issues,
    completedCount: review.completenessMatrix.passCount,
    gapCount: review.completenessMatrix.entries.filter((entry) => entry.status !== "PASS").length,
    officialComplianceStatus: null,
    humanGate: { required: true, scope: "WHOLE_ARTIFACT", confirmed: false, contentHash: alpha9Hash({ sourceArtifactHash: review.sourceArtifactHash, proposedSnapshot, issueIds: issues.map((issue) => issue.issueId), officialComplianceStatus: null }) },
    paperpalBoundary: review.paperpalBoundary,
    formalResearchWriteCount: 0,
  };
}

function proposalFixture(request: V2Alpha9LocalFinalizeRequest) {
  const targetId = request.track === "NSTC_PROPOSAL" ? "NSTC" as const : "MOE" as const;
  const domainSelection = createBuiltinDomainSelection("ai-education");
  const sourceBundle = createSyntheticOfficialSourceBundle({ targetId, cycleYear: 2027, domainSelection, variant: "MIXED_FRESHNESS" });
  return createSyntheticAlpha5Workspace({
    contractVersion: V2_ALPHA5_CONTRACT_VERSION,
    requestId: `alpha5-${request.requestId}`,
    domainSelection,
    targetId,
    researchDirection: targetId === "NSTC"
      ? "智慧回饋支持跨域研究能力與可驗證學習機制"
      : "智慧回饋促進大學課程自我調節學習與教學實踐改善",
    sourceBundle,
  });
}

function proposalSections(proposal: ProposalDraft, workspace: V2Alpha5Workspace): Record<V2Alpha9SectionKey, string> {
  const modeText = proposal.modeSpecific.kind === "NSTC_RESEARCH"
    ? [proposal.modeSpecific.cm03Narrative, proposal.modeSpecific.preliminaryEvidence, proposal.modeSpecific.feasibility, ...proposal.modeSpecific.expectedOutputs].join("\n")
    : [proposal.modeSpecific.courseContext, proposal.modeSpecific.teachingProblem, proposal.modeSpecific.intervention, ...proposal.modeSpecific.learningOutcomes, proposal.modeSpecific.evaluationDesign, proposal.modeSpecific.implementationFidelity, ...proposal.modeSpecific.teachingArtifacts, proposal.modeSpecific.reflectionPlan].join("\n");
  const workPackages = proposal.workPackages.map((item) => `${item.title}（第 ${item.startMonth}–${item.endMonth} 月）：${item.objective}；${item.methods}`).join("\n");
  const budget = proposal.budget.items.map((item, index) => {
    const category = item.category === "OPERATING" ? "業務費" : normalizePresentationText(item.category);
    const workPackage = index === 0 ? "工作包一" : index === 1 ? "工作包二" : `工作包${index + 1}`;
    return `${category}暫估 ${item.subtotalTwd.toLocaleString("zh-TW")} 元，用於${workPackage}的研究執行與成果整理；實際編列須依適用年度規則核對。`;
  }).join("\n");
  const references = workspace.zoteroEvidence.length
    ? workspace.zoteroEvidence.map((item, index) => `候選文獻 ${index + 1}：目前僅作研究背景與方法線索，須完成識別資訊、書目一致性及主張對齊核驗後才能列入正式參考文獻。`).join("\n")
    : "尚未提供可核驗的文獻管理資料；不得自行補造引用。";
  return normalizeSnapshotSections({
    TITLE: proposal.bilingual.titleZhTw,
    ABSTRACT: proposal.bilingual.abstractZhTw,
    KEYWORDS: proposal.bilingual.keywordsZhTw.join("、"),
    INTRODUCTION_OR_PROBLEM: [proposal.narrative.problem, proposal.narrative.background].join("\n\n"),
    LITERATURE_OR_POLICY_CONTEXT: proposal.narrative.literatureGap,
    RESEARCH_QUESTIONS_OR_AIMS: [...proposal.narrative.aims, ...proposal.narrative.researchQuestions, ...proposal.narrative.hypotheses].join("\n"),
    METHODS_OR_IMPLEMENTATION: [proposal.narrative.methods, proposal.narrative.sample, proposal.narrative.data, proposal.narrative.analysis, modeText, workPackages].join("\n\n"),
    RESULTS_OR_EXPECTED_OUTCOMES: [proposal.narrative.expectedImpact, ...proposal.kpis.map((item) => `${item.measure}：${item.target}；證據：${item.evidencePlan}`)].join("\n"),
    DISCUSSION_OR_SIGNIFICANCE: [proposal.narrative.innovation, proposal.narrative.significance].join("\n\n"),
    CONCLUSION_OR_IMPACT: [proposal.narrative.expectedImpact, ...proposal.resources].join("\n"),
    LIMITATIONS_OR_RISKS: [...proposal.narrative.risks, ...proposal.narrative.alternatives, ...proposal.unresolvedIssues, budget].join("\n"),
    REFERENCES: references,
    DECLARATIONS_OR_ATTACHMENTS: [proposal.narrative.ethics, proposal.narrative.privacy, ...proposal.attachments.map((item) => `${item.label}：${item.status}；${item.evidence}`)].join("\n"),
  });
}

function proposalAlternative(
  issueId: string,
  strategy: "EVIDENCE_CALIBRATED" | "STRUCTURE_RECOMMENDED" | "CROSS_DISCIPLINARY_CLARITY",
  label: string,
  text: string,
  recommended: boolean,
): V2Alpha9UiAlternative {
  return { alternativeId: `${issueId}-${strategy.toLocaleLowerCase("en-US").replaceAll("_", "-")}`, strategy, label, text: normalizePresentationText(text), recommended };
}

function proposalPriorityIssues(workspace: V2Alpha5Workspace, sections: Record<V2Alpha9SectionKey, string>) {
  const sourceConcern = workspace.reviewerConcerns.find((item) => item.concernId === "concern-source");
  const evidenceConcern = workspace.reviewerConcerns.find((item) => item.concernId === "concern-evidence");
  const unknownFacts = workspace.officialFacts.filter((item) => item.status === "UNKNOWN");
  if (!sourceConcern || !evidenceConcern || unknownFacts.length === 0) throw new Error("alpha9_proposal_genuine_issue_authority_missing");

  const sourceIssueId = "alpha9-proposal-official-source";
  const evidenceIssueId = "alpha9-proposal-evidence";
  const scheduleIssueId = "alpha9-proposal-deadline-budget";
  const focus = normalizePresentationText(sections.TITLE.replace(/的跨域整合：從機制證據到可採用設計$/u, ""));
  const issues: [V2Alpha9UiPriorityIssue, V2Alpha9UiPriorityIssue, V2Alpha9UiPriorityIssue] = [
    {
      issueId: sourceIssueId,
      location: "DECLARATIONS_OR_ATTACHMENTS",
      title: "當年度官方規範尚未形成可核實權威",
      reason: normalizePresentationText(sourceConcern.text),
      recommendedAlternativeId: `${sourceIssueId}-structure-recommended`,
      alternatives: [
        proposalAlternative(sourceIssueId, "EVIDENCE_CALIBRATED", "規範界線版", `本計畫涉及人類參與者或可識別資料時，將在資料蒐集前完成適用的倫理審查，並以目的限制、資料最小化、分權存取及明確保存期限管理資料。申請資格、截止日期、經費規則、表單與附件須以適用年度官方公告逐項核對；核對完成前不宣稱已符合送件規範。`, false),
        proposalAlternative(sourceIssueId, "STRUCTURE_RECOMMENDED", "老麥推薦核對版", `研究倫理與資料治理：涉及人類參與者或可識別資料時，於資料蒐集前完成適用倫理審查，並落實知情同意、去識別化、最小權限與保存期限管理。\n\n送件規範與附件：依適用年度公告逐項核對申請資格、截止日期、經費規則、審查準則、表單版本及必要附件。\n\n完成標準：只有在每一項均連結同年度官方來源後，才標示為可送件。`, true),
        proposalAlternative(sourceIssueId, "CROSS_DISCIPLINARY_CLARITY", "跨域研究優先版", `本計畫先以${focus}形成可審查的研究問題、方法、資料、倫理與預期影響閉環；跨領域構念均須界定操作定義與適用邊界。行政規範僅列入已由適用年度官方公告核實的項目，其餘送件格式、經費與附件維持待核對，不影響研究內容的專業完整性。`, false),
      ],
    },
    {
      issueId: evidenceIssueId,
      location: "LITERATURE_OR_POLICY_CONTEXT",
      title: "研究缺口仍缺少可核驗文獻證據",
      reason: normalizePresentationText(evidenceConcern.text),
      recommendedAlternativeId: `${evidenceIssueId}-structure-recommended`,
      alternatives: [
        proposalAlternative(evidenceIssueId, "EVIDENCE_CALIBRATED", "證據校準版", `現有文獻管理資料可支持將${focus}列為候選研究脈絡，但尚不足以證明特定研究缺口或趨勢。正式計畫只採用已完成識別資訊、書目一致性與主張對齊核驗的文獻；其餘資料僅作待查線索。`, false),
        proposalAlternative(evidenceIssueId, "STRUCTURE_RECOMMENDED", "老麥推薦證據版", `本計畫的文獻論證依四層建立：先界定${focus}的研究背景，再比較既有研究未能解釋的機制或情境，接續連結本研究的方法選擇，最後說明預期貢獻與失效邊界。每一項核心主張均須對應可核驗文獻；未完成核驗的內容不作為研究缺口或政策成效的正式依據。`, true),
        proposalAlternative(evidenceIssueId, "CROSS_DISCIPLINARY_CLARITY", "跨域脈絡版", `本計畫以教育科技、學習科學與研究場域的實務問題建立跨領域文獻架構，聚焦${focus}如何連結設計特徵、作用機制與可觀察結果。跨域新穎性只在各領域文獻均可核對且概念定義一致時成立；目前證據不足之處明列為待驗證命題。`, false),
      ],
    },
    {
      issueId: scheduleIssueId,
      location: "LIMITATIONS_OR_RISKS",
      title: "期限與經費規則仍為未知",
      reason: normalizePresentationText(`目前仍有 ${unknownFacts.map((item) => item.label).join("、")} 未取得可核實值，不能直接作為送件依據。`),
      recommendedAlternativeId: `${scheduleIssueId}-structure-recommended`,
      alternatives: [
        proposalAlternative(scheduleIssueId, "EVIDENCE_CALIBRATED", "未知項保留版", `本計畫的主要風險為跨域構念失焦、樣本或資料不足，以及年度行政規則尚待核實。研究執行將以共同定義、先導檢核與停止準則降低方法風險；截止日期、經費上限、編列比例及附件版本在取得同年度官方來源前均維持待核對，不以估計值代替官方事實。`, false),
        proposalAlternative(scheduleIssueId, "STRUCTURE_RECOMMENDED", "老麥推薦風險版", `風險一，跨域構念無法穩定對齊：以操作定義、邊界條件與負向案例檢查控制，必要時退回核心領域方案。\n\n風險二，樣本或資料不足：先執行先導研究、縮小主要問題並保留可重現分析。\n\n風險三，送件規則尚待核實：於送件前逐項確認官方與校內截止日、經費規則、表單及附件版本，任何未完成項目均不得標示為已符合。`, true),
        proposalAlternative(scheduleIssueId, "CROSS_DISCIPLINARY_CLARITY", "跨域資源彈性版", `執行策略分為「問題、證據與方法契約」及「執行、分析與成果整合」兩個工作階段，各階段均設定可調整範圍與停止條件。資源依工作包的實際需求編列；在年度規則核實前，不承諾尚未確認的金額、比例或日期，並保留縮小場域、調整樣本及分期取得資料的替代路徑。`, false),
      ],
    },
  ];
  return issues;
}

function proposalWorkspace(request: V2Alpha9LocalFinalizeRequest): V2Alpha9UiWorkspace {
  const alpha5 = proposalFixture(request);
  const review = reviewAlpha9TaiwanProposal(alpha5);
  const proposal = parseProposalDraft(alpha5.proposalsByDirection[review.directionId]);
  const sourceSections = proposalSections(proposal, alpha5);
  const issues = proposalPriorityIssues(alpha5, sourceSections);
  const proposedSections = structuredClone(sourceSections);
  issues.forEach((issue) => {
    const recommended = issue.alternatives.find((item) => item.alternativeId === issue.recommendedAlternativeId);
    if (!recommended) throw new Error("alpha9_proposal_recommendation_invalid");
    proposedSections[issue.location] = recommended.text;
  });
  if (V2_ALPHA9_SECTION_KEYS.some((key) => !sourceSections[key].trim() || !proposedSections[key].trim())) throw new Error("alpha9_proposal_snapshot_incomplete");
  const sourceSnapshot = { title: proposal.bilingual.titleZhTw, sections: sourceSections };
  const proposedSnapshot = { title: proposedSections.TITLE, sections: proposedSections };
  const gapSections = new Set(issues.map((issue) => issue.location));
  return {
    contractVersion: V2_ALPHA9_CONTRACT_VERSION,
    requestId: request.requestId,
    track: request.track,
    status: review.reviewStatus,
    sourceArtifactHash: review.proposalHash,
    sourceSnapshot,
    proposedSnapshot,
    priorityIssues: issues,
    completedCount: V2_ALPHA9_SECTION_KEYS.filter((sectionKey) => !gapSections.has(sectionKey)).length,
    gapCount: gapSections.size,
    officialComplianceStatus: review.officialComplianceStatus,
    humanGate: { required: true, scope: "WHOLE_ARTIFACT", confirmed: false, contentHash: alpha9Hash({ sourceArtifactHash: review.proposalHash, proposedSnapshot, issueIds: issues.map((issue) => issue.issueId), officialComplianceStatus: review.officialComplianceStatus }) },
    paperpalBoundary: null,
    formalResearchWriteCount: 0,
  };
}

export function createSyntheticV2Alpha9UiWorkspace(request: V2Alpha9LocalFinalizeRequest): V2Alpha9UiWorkspace {
  const parsed = parseV2Alpha9LocalFinalizeRequest(request);
  return validateV2Alpha9UiWorkspace(parsed.track === "JOURNAL_MANUSCRIPT" ? manuscriptWorkspace(parsed) : proposalWorkspace(parsed), parsed);
}

function validateSnapshot(value: unknown, proposed: boolean): V2Alpha9Snapshot {
  if (!isRecord(value)) throw new Error("alpha9_snapshot_invalid");
  exactKeys(value, ["title", "sections"], "alpha9_snapshot_invalid");
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 4_000 || !isRecord(value.sections)) throw new Error("alpha9_snapshot_invalid");
  const rawSections = value.sections;
  exactKeys(rawSections, V2_ALPHA9_SECTION_KEYS, "alpha9_snapshot_section_invalid");
  const sections = Object.fromEntries(V2_ALPHA9_SECTION_KEYS.map((key) => {
    const text = rawSections[key];
    if (typeof text !== "string" || text.length > 192_000 || (proposed && !text.trim())) throw new Error("alpha9_snapshot_section_invalid");
    return [key, text];
  })) as Record<V2Alpha9SectionKey, string>;
  if (!proposed && !Object.values(sections).some((text) => text.trim())) throw new Error("alpha9_snapshot_section_invalid");
  return { title: value.title, sections };
}

function validateUiIssue(value: unknown, locations: ReadonlySet<string>): V2Alpha9UiPriorityIssue {
  if (!isRecord(value)) throw new Error("alpha9_ui_issue_invalid");
  exactKeys(value, ["issueId", "location", "title", "reason", "recommendedAlternativeId", "alternatives"], "alpha9_ui_issue_invalid");
  const issueId = safeIdentifier(value.issueId, "alpha9_ui_issue_invalid", 3, 180);
  if (!locations.has(String(value.location)) || typeof value.title !== "string" || !value.title.trim() || typeof value.reason !== "string" || !value.reason.trim() || !Array.isArray(value.alternatives) || value.alternatives.length !== 3) throw new Error("alpha9_ui_issue_invalid");
  const alternatives = value.alternatives.map((candidate): V2Alpha9UiAlternative => {
    if (!isRecord(candidate)) throw new Error("alpha9_ui_alternative_invalid");
    exactKeys(candidate, ["alternativeId", "strategy", "label", "text", "recommended"], "alpha9_ui_alternative_invalid");
    if (typeof candidate.strategy !== "string" || !candidate.strategy.trim() || typeof candidate.label !== "string" || !candidate.label.trim() || typeof candidate.text !== "string" || !candidate.text.trim() || typeof candidate.recommended !== "boolean") throw new Error("alpha9_ui_alternative_invalid");
    return {
      alternativeId: safeIdentifier(candidate.alternativeId, "alpha9_ui_alternative_invalid", 3, 240),
      strategy: candidate.strategy,
      label: candidate.label,
      text: candidate.text,
      recommended: candidate.recommended,
    };
  }) as [V2Alpha9UiAlternative, V2Alpha9UiAlternative, V2Alpha9UiAlternative];
  if (new Set(alternatives.map((item) => item.alternativeId)).size !== 3 || new Set(alternatives.map((item) => item.strategy)).size !== 3 || V2_ALPHA9_REVISION_STRATEGIES.some((strategy) => !alternatives.some((item) => item.strategy === strategy)) || new Set(alternatives.map((item) => item.label)).size !== 3 || new Set(alternatives.map((item) => item.text)).size !== 3) throw new Error("alpha9_ui_alternative_invalid");
  const recommended = alternatives.filter((item) => item.recommended);
  if (recommended.length !== 1 || recommended[0].alternativeId !== value.recommendedAlternativeId) throw new Error("alpha9_ui_recommendation_invalid");
  return {
    issueId,
    location: value.location as V2Alpha9SectionKey,
    title: value.title,
    reason: value.reason,
    recommendedAlternativeId: recommended[0].alternativeId,
    alternatives,
  };
}

export function validateV2Alpha9UiWorkspace(value: unknown, expected: Pick<V2Alpha9LocalFinalizeRequest, "requestId" | "track">): V2Alpha9UiWorkspace {
  if (!isRecord(value)) throw new Error("alpha9_workspace_contract_invalid");
  exactKeys(value, ["contractVersion", "requestId", "track", "status", "sourceArtifactHash", "sourceSnapshot", "proposedSnapshot", "priorityIssues", "completedCount", "gapCount", "officialComplianceStatus", "humanGate", "paperpalBoundary", "formalResearchWriteCount"], "alpha9_workspace_contract_invalid");
  if (value.contractVersion !== V2_ALPHA9_CONTRACT_VERSION || value.requestId !== expected.requestId || value.track !== expected.track || typeof value.status !== "string" || !value.status.trim() || !isAlpha9Hash(value.sourceArtifactHash)) throw new Error("alpha9_workspace_contract_invalid");
  const validStatus = expected.track === "JOURNAL_MANUSCRIPT"
    ? ["FINAL_CONFIRMABLE", "READY_WITH_GAPS", "BLOCKED_EVIDENCE_OR_INTEGRITY"].includes(value.status)
    : ["READY", "READY_WITH_GAPS", "NOT_READY"].includes(value.status);
  if (!validStatus) throw new Error("alpha9_workspace_status_invalid");
  const sourceSnapshot = validateSnapshot(value.sourceSnapshot, false);
  const proposedSnapshot = validateSnapshot(value.proposedSnapshot, true);
  if (!Array.isArray(value.priorityIssues) || value.priorityIssues.length !== 3) throw new Error("alpha9_ui_issue_cardinality_invalid");
  const priorityIssues = value.priorityIssues.map((item) => validateUiIssue(item, new Set(V2_ALPHA9_SECTION_KEYS))) as [V2Alpha9UiPriorityIssue, V2Alpha9UiPriorityIssue, V2Alpha9UiPriorityIssue];
  if (new Set(priorityIssues.map((item) => item.issueId)).size !== 3 || new Set(priorityIssues.map((item) => item.location)).size !== 3) throw new Error("alpha9_ui_issue_cardinality_invalid");
  if (!Number.isSafeInteger(value.completedCount) || Number(value.completedCount) < 0 || !Number.isSafeInteger(value.gapCount) || Number(value.gapCount) < 0 || Number(value.completedCount) + Number(value.gapCount) !== V2_ALPHA9_SECTION_KEYS.length) throw new Error("alpha9_ui_count_invalid");
  if ((expected.track === "JOURNAL_MANUSCRIPT") !== (value.officialComplianceStatus === null)) throw new Error("alpha9_official_compliance_boundary_invalid");
  if (value.officialComplianceStatus !== null && (typeof value.officialComplianceStatus !== "string" || !["PASS_OFFICIAL_CURRENT", "BLOCKED_SOURCE_AUTHORITY", "BLOCKED_SOURCE_FRESHNESS"].includes(value.officialComplianceStatus))) throw new Error("alpha9_official_compliance_boundary_invalid");
  if (!isRecord(value.humanGate)) throw new Error("alpha9_ui_human_gate_invalid");
  exactKeys(value.humanGate, ["required", "scope", "confirmed", "contentHash"], "alpha9_ui_human_gate_invalid");
  if (value.humanGate.required !== true || value.humanGate.scope !== "WHOLE_ARTIFACT" || value.humanGate.confirmed !== false || !isAlpha9Hash(value.humanGate.contentHash)) throw new Error("alpha9_ui_human_gate_invalid");
  const expectedHumanGateHash = alpha9Hash({ sourceArtifactHash: value.sourceArtifactHash, proposedSnapshot, issueIds: priorityIssues.map((issue) => issue.issueId), officialComplianceStatus: value.officialComplianceStatus });
  if (value.humanGate.contentHash !== expectedHumanGateHash) throw new Error("alpha9_ui_human_gate_binding_invalid");
  if (expected.track === "JOURNAL_MANUSCRIPT") {
    if (!isRecord(value.paperpalBoundary) || alpha9Hash(value.paperpalBoundary) !== alpha9Hash(V2_ALPHA9_PAPERPAL_BOUNDARY)) throw new Error("alpha9_paperpal_boundary_invalid");
  } else if (value.paperpalBoundary !== null) throw new Error("alpha9_paperpal_boundary_invalid");
  if (value.formalResearchWriteCount !== 0) throw new Error("alpha9_workspace_effect_boundary_invalid");
  return {
    contractVersion: V2_ALPHA9_CONTRACT_VERSION,
    requestId: expected.requestId,
    track: expected.track,
    status: value.status,
    sourceArtifactHash: value.sourceArtifactHash,
    sourceSnapshot,
    proposedSnapshot,
    priorityIssues,
    completedCount: Number(value.completedCount),
    gapCount: Number(value.gapCount),
    officialComplianceStatus: value.officialComplianceStatus as string | null,
    humanGate: { required: true, scope: "WHOLE_ARTIFACT", confirmed: false, contentHash: value.humanGate.contentHash },
    paperpalBoundary: value.paperpalBoundary as V2Alpha9PaperpalBoundary | null,
    formalResearchWriteCount: 0,
  };
}

export function createV2Alpha9Coordinator(
  generate: (request: V2Alpha9LocalFinalizeRequest) => Promise<V2Alpha9UiWorkspace> = async (request) => createSyntheticV2Alpha9UiWorkspace(request),
) {
  const settled = new Map<string, { requestHash: string; workspace: V2Alpha9UiWorkspace }>();
  const pending = new Map<string, { requestHash: string; promise: Promise<V2Alpha9UiWorkspace> }>();
  const uncertain = new Map<string, string>();
  return {
    persistenceClass: "PROCESS_LOCAL_LOCAL_PROTOTYPE" as const,
    async run(raw: unknown, scope: string): Promise<CoordinatorResult> {
      const safeScope = safeIdentifier(scope, "alpha9_scope_invalid", 3, 319);
      const request = parseV2Alpha9LocalFinalizeRequest(raw);
      const requestHash = alpha9Hash(request);
      const key = `${safeScope}:${request.idempotencyKey}`;
      const unknownHash = uncertain.get(key);
      if (unknownHash) {
        if (unknownHash !== requestHash) throw new Error("alpha9_idempotency_conflict");
        throw new Error("alpha9_completion_unknown_no_resend");
      }
      const prior = settled.get(key);
      if (prior) {
        if (prior.requestHash !== requestHash) throw new Error("alpha9_idempotency_conflict");
        return { workspace: structuredClone(prior.workspace), replayed: true };
      }
      const active = pending.get(key);
      if (active) {
        if (active.requestHash !== requestHash) throw new Error("alpha9_idempotency_conflict");
        return { workspace: structuredClone(await active.promise), replayed: true };
      }
      const promise = generate(structuredClone(request));
      pending.set(key, { requestHash, promise });
      try {
        const workspace = validateV2Alpha9UiWorkspace(await promise, request);
        settled.set(key, { requestHash, workspace: structuredClone(workspace) });
        return { workspace, replayed: false };
      } catch (error) {
        if (error instanceof Error && error.message === "alpha9_completion_unknown") uncertain.set(key, requestHash);
        throw error;
      } finally {
        pending.delete(key);
      }
    },
  };
}

export const V2_ALPHA9_LOCAL_RUNTIME_BOUNDARY = Object.freeze({
  tracks: ["JOURNAL_MANUSCRIPT", "NSTC_PROPOSAL", "MOE_PROPOSAL"],
  fixtureOnly: true,
  persistence: "PROCESS_LOCAL_LOCAL_PROTOTYPE",
  idempotency: "REPLAY_SAME_CONFLICT_DIFFERENT_COMPLETION_UNKNOWN_NO_RESEND",
  externalNetworkCalls: 0,
  databaseConnections: 0,
  formalResearchWrites: 0,
  externalMutations: 0,
});
