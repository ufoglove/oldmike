import { S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import { beta1CanonicalJson, beta1Hash, isBeta1Hash } from "./canonical-hash.ts";
import { classifyV2Beta1ClauseResultState, contextualizeV2Beta1ResultProposition, extractV2Beta1StructuredEvidenceRecords, reduceV2Beta1ResultPropositionStates, tokenizeV2Beta1ResultPropositions } from "./evidence-anchors.ts";
import { assessV2Beta1PublicationReadiness, classifyV2Beta1ResultEvidence } from "./evidence-classifier.ts";
import { parseV2Beta1ObservationAuthorityStructural, renderV2Beta1TypedObservationRecord, type V2Beta1ObservationConfirmationAuthority } from "./typed-observation-authority.ts";

export const V2_BETA1_PROFESSIONAL_PROJECTION_VERSION = "old-mike-v2-beta1/professional-projection/1" as const;
export const V2_BETA1_EVIDENCE_AUTHORITY_VERSION = "old-mike-v2-beta1/evidence-authority/3" as const;
export const V2_BETA1_HUMAN_DRAFT_PROJECTION_VERSION = "old-mike-v2-beta1/human-draft/1" as const;

export type V2Beta1ProjectionTarget = "SCI" | "SSCI" | "NSTC" | "MOE";
export type V2Beta1ProjectionLane = "EVIDENCE_FIRST" | "BALANCED_RECOMMENDED" | "FRONTIER_INNOVATION";
export type V2Beta1ProjectionMaterialKind = "ABSTRACT" | "INTRODUCTION" | "METHODS" | "RESULTS" | "QUESTIONNAIRE" | "STATISTICS" | "FIGURE" | "TABLE" | "CITATION" | "NOTE";
export type V2Beta1EvidenceClauseState = "OBSERVED" | "PLANNED" | "MISSING" | "UNRESOLVED";
export type V2Beta1EvidenceProvenance = "PROVIDED_RESULT_MATERIAL" | "PROVIDED_NONRESULT_MATERIAL" | "MISSING_SECTION_NO_SOURCE_MATERIAL" | "SYNTHETIC_PLAN";

export type V2Beta1ProjectionMaterial = {
  materialId: string;
  kind: V2Beta1ProjectionMaterialKind;
  title: string;
  content: string;
  contentHash: string;
};

export type V2Beta1EvidenceClauseAuthority = {
  clauseId: string;
  materialId: string;
  kind: V2Beta1ProjectionMaterialKind;
  rawHash: string;
  startByte: number;
  endByte: number;
  state: V2Beta1EvidenceClauseState;
  observationKey: string | null;
  consistencyProven: boolean;
  traceable: boolean;
  publicationUsable: boolean;
  reviewStatus: "FINAL_CONFIRMABLE" | "READY_WITH_GAPS" | "BLOCKED_EVIDENCE_OR_INTEGRITY";
  provenance: V2Beta1EvidenceProvenance;
};

export type V2Beta1EvidenceAuthority = {
  authorityVersion: typeof V2_BETA1_EVIDENCE_AUTHORITY_VERSION;
  outputTarget: V2Beta1ProjectionTarget;
  sourceBundleHash: string;
  observationAuthorityHash: string | null;
  materialBindings: Array<{ materialId: string; kind: V2Beta1ProjectionMaterialKind; titleHash: string; contentBytes: number; contentHash: string }>;
  clauses: V2Beta1EvidenceClauseAuthority[];
  recordBindings: Array<{ recordId: string; recordHash: string; claimId: string; materialId: string; clauseId: string; renderedClaimText: string; renderedClaimHash: string; revisionText: string; revisionTextHash: string; revisionBindingHash: string }>;
  summary: {
    resultState: "MISSING" | "PLANNED" | "OBSERVED" | "CONFLICT";
    consistencyProven: boolean;
    traceable: boolean;
    publicationUsable: boolean;
    reviewStatus: "FINAL_CONFIRMABLE" | "READY_WITH_GAPS" | "BLOCKED_EVIDENCE_OR_INTEGRITY";
  };
  authorityHash: string;
};

export type V2Beta1ProfessionalProjectionParent = {
  outputTarget: V2Beta1ProjectionTarget;
  lane: V2Beta1ProjectionLane;
  domain: { label: string; selectionHash: string };
  researchDirection: string;
  materials: readonly V2Beta1ProjectionMaterial[];
  observationAuthority: V2Beta1ObservationConfirmationAuthority | null;
  evidenceAuthority: V2Beta1EvidenceAuthority;
};

export type V2Beta1ProfessionalProjection = {
  projectionVersion: typeof V2_BETA1_PROFESSIONAL_PROJECTION_VERSION;
  contextHash: string;
  outputTarget: V2Beta1ProjectionTarget;
  targetLabel: string;
  lane: V2Beta1ProjectionLane;
  laneLabel: string;
  domainLabel: string;
  researchDirection: string;
  materialSummary: string;
  evidenceAuthorityHash: string;
  trackFields: Record<string, string>;
  title: string;
  researchQuestion: string;
  mechanism: string;
  method: string;
  contribution: string;
  unknowns: string[];
  s0: Record<S0FieldName, string>;
  preview: { kind: "JOURNAL_MANUSCRIPT" | "TAIWAN_PROPOSAL"; title: string; sections: Record<"ABSTRACT" | "INTRODUCTION" | "METHODS" | "RESULTS" | "DISCUSSION" | "CONCLUSION", string>; contentHash: string };
  authorityHash: string;
};

export type V2Beta1HumanDraftAuthority = {
  projectionVersion: typeof V2_BETA1_HUMAN_DRAFT_PROJECTION_VERSION;
  humanDraft: string;
  projectionHash: string;
};

const RESULT_KINDS = new Set<V2Beta1ProjectionMaterialKind>(["RESULTS", "STATISTICS", "TABLE", "FIGURE"]);
const FORBIDDEN_HUMAN_ENUM = /(?:EVIDENCE_FIRST|CAUSAL_MECHANISM|FRONTIER_INNOVATION|BALANCED_RECOMMENDED)/u;
const MALFORMED_PUNCTUATION = /(?:：：|；；|，，|。。|、、|,,|;;|::)/u;

const TARGET_LABELS: Record<V2Beta1ProjectionTarget, string> = {
  SCI: "SCI／SCIE 期刊研究",
  SSCI: "SSCI 社會科學期刊研究",
  NSTC: "國科會研究計畫",
  MOE: "教育部教學實踐計畫",
};
const LANE_LABELS: Record<V2Beta1ProjectionLane, string> = {
  EVIDENCE_FIRST: "證據校準",
  BALANCED_RECOMMENDED: "平衡整合",
  FRONTIER_INNOVATION: "前沿驗證",
};
const LANE_AUTHORITY: Record<V2Beta1ProjectionLane, { question: string; mechanism: string; method: string; contribution: string }> = {
  EVIDENCE_FIRST: {
    question: "哪些主張已由來源支持，哪些替代解釋與失效條件必須優先排除？",
    mechanism: "先建立來源、構念、量測與結果之間的最小可反駁證據鏈，再限制因果與外推。",
    method: "先執行來源與資料品質稽核，預先界定主要分析及反證檢核，未通過者維持缺失或待確認。",
    contribution: "建立保守、可重現且不超越材料的最低充分證據標準。",
  },
  BALANCED_RECOMMENDED: {
    question: "核心機制如何影響結果，且對象、場域與執行條件如何改變效果與可移轉性？",
    mechanism: "把主要機制、實作條件與情境差異放在同一條可審查論證鏈中。",
    method: "以主要比較結合機制、歷程與情境分析，在理論辨識、可行性與實務價值間取得平衡。",
    contribution: "形成兼顧理論、方法可行性與成果路徑的平衡專業方案。",
  },
  FRONTIER_INNOVATION: {
    question: "哪些跨域機制可形成高價值的新解釋，且要用何種否證條件區分創新假設與已知證據？",
    mechanism: "以跨域構念、邊界條件與反事實比較提出前沿機制，但不把尚未觀察的關係寫成發現。",
    method: "採探索後驗證的分階段設計，先確認構念可比性，再以高證據負擔檢驗新機制與邊界條件。",
    contribution: "提出具創新張力但明列風險、證據負擔與否證準則的前沿方案。",
  },
};
const FIELD_LABELS: Record<S0FieldName, string> = {
  workingTitle: "研究題目", domain: "研究領域", outputTrack: "成果目標", problemContext: "問題背景", targetUsers: "對象與情境",
  expectedContribution: "預期貢獻", existingData: "既有資料", availableData: "可用資料", methodIdea: "方法構想", timeline: "期程",
  constraints: "限制條件", ethicsPrivacyRisks: "倫理與隱私", unresolvedItems: "待確認事項",
};
const STRATEGY_LABELS = ["證據校準", "平衡精修（推薦）", "自然學術"] as const;
const CONTINUATION_LABELS = { ABSTRACT: "摘要", INTRODUCTION: "前言", METHODS: "方法", RESULTS: "結果", DISCUSSION: "討論", CONCLUSION: "結論" } as const;
const PROPOSAL_LABELS = { PROBLEM_AND_OBJECTIVES: "問題與目標", THEORY_AND_EVIDENCE: "理論與證據", METHOD_AND_DESIGN: "方法與設計", WORK_PLAN: "工作計畫", EXPECTED_OUTCOMES: "預期成果", ETHICS_AND_RISK: "倫理與風險" } as const;
const MATERIAL_LABELS: Record<V2Beta1ProjectionMaterialKind, string> = { ABSTRACT: "摘要", INTRODUCTION: "前言", METHODS: "方法", RESULTS: "結果", QUESTIONNAIRE: "問卷", STATISTICS: "統計", FIGURE: "圖", TABLE: "表", CITATION: "引用", NOTE: "筆記" };

function bytes(value: string) { return new TextEncoder().encode(value).byteLength; }
function normalized(value: string) { return value.replace(/\r\n?/gu, "\n").trim(); }
function clip(value: string, maximum: number) { const text = normalized(value); return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`; }
function sourceBundleHash(materials: readonly V2Beta1ProjectionMaterial[]) { return beta1Hash(materials.map(({ materialId, kind, title, contentHash }) => ({ materialId, kind, title, contentHash }))); }
function observationKey(value: string): string | null {
  const metric = value.match(/(?:metricId|指標ID)\s*[:=：]\s*([\p{L}\p{N}._-]+)/iu)?.[1]
    ?? value.match(/(?:^|[。；;\n]\s*)([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9 _-]{1,30}?)(?:實際(?:觀察|測得)(?:為|到)?|觀察值為|結果(?:顯示|指出)?為|提升|下降|增加|減少|\s*=|為)\s*[+\-−–—]?(?:\d+(?:\.\d+)?|\.\d+)\s*(?:%|％|分|點|秒|分鐘|小時|days?|hours?|points?)/iu)?.[1];
  if (!metric) return null;
  const cohort = value.match(/(?:cohortId|群組ID)\s*[:=：]\s*([\p{L}\p{N}._-]+)/iu)?.[1] ?? "all";
  const timepoint = value.match(/(?:timepoint|時間點)\s*[:=：]\s*([\p{L}\p{N}._-]+)/iu)?.[1] ?? "unspecified";
  const analysis = value.match(/(?:analysisId|分析ID)\s*[:=：]\s*([\p{L}\p{N}._-]+)/iu)?.[1] ?? "primary";
  return [metric, cohort, timepoint, analysis].map((item) => item.normalize("NFKC").toLocaleLowerCase("en-US")).join("|");
}
function clauseState(kind: V2Beta1ProjectionMaterialKind, value: string): V2Beta1EvidenceClauseState {
  const sharedState = classifyV2Beta1ClauseResultState(value);
  if (sharedState !== null) return sharedState;
  if (RESULT_KINDS.has(kind)) return "UNRESOLVED";
  return "OBSERVED";
}
export function createV2Beta1EvidenceAuthority(materials: readonly V2Beta1ProjectionMaterial[], outputTarget: V2Beta1ProjectionTarget, rawObservationAuthority: V2Beta1ObservationConfirmationAuthority | null = null): V2Beta1EvidenceAuthority {
  if (!["SCI", "SSCI", "NSTC", "MOE"].includes(outputTarget)) throw new Error("beta1_evidence_target_invalid");
  if (new Set(materials.map((item) => item.materialId)).size !== materials.length || materials.some((item) => !item.materialId || !item.title || !item.content || !isBeta1Hash(item.contentHash) || beta1Hash(item.content) !== item.contentHash)) throw new Error("beta1_evidence_material_invalid");
  const materialBindings = materials.map((item) => ({ materialId: item.materialId, kind: item.kind, titleHash: beta1Hash(item.title), contentBytes: bytes(item.content), contentHash: item.contentHash }));
  const legacy = classifyV2Beta1ResultEvidence(materials as Parameters<typeof classifyV2Beta1ResultEvidence>[0]);
  const readiness = assessV2Beta1PublicationReadiness(materials as Parameters<typeof assessV2Beta1PublicationReadiness>[0]);
  const observationAuthority = rawObservationAuthority === null ? null : parseV2Beta1ObservationAuthorityStructural(rawObservationAuthority, materials);
  const provisional = materials.flatMap((material) => tokenizeV2Beta1ResultPropositions(material.content).map((clause, index) => ({ material, clause, index, state: clauseState(material.kind, clause.raw) })));
  const resultRows = provisional.filter((item) => RESULT_KINDS.has(item.material.kind));
  const conflict = legacy.classification === "CONFLICT";
  const reduction = reduceV2Beta1ResultPropositionStates(resultRows.map((item) => item.state), conflict);
  const resultState: V2Beta1EvidenceAuthority["summary"]["resultState"] = reduction.resultState;
  const clauses: V2Beta1EvidenceClauseAuthority[] = provisional.map(({ material, clause, index, state }) => {
    const record = extractV2Beta1StructuredEvidenceRecords(contextualizeV2Beta1ResultProposition(clause)).records.find((item) => item.structured);
    const core = {
      clauseId: `clause:${beta1Hash({ materialId: material.materialId, index, rawHash: beta1Hash(clause.raw) }).slice(0, 32)}`,
      materialId: material.materialId,
      kind: material.kind,
      rawHash: beta1Hash(clause.raw),
      startByte: clause.startByte,
      endByte: clause.endByte,
      state,
      observationKey: record?.observationKey ? [record.observationKey.metricId, record.observationKey.cohortId, record.observationKey.timepoint, record.observationKey.analysisId].join("|") : RESULT_KINDS.has(material.kind) ? observationKey(clause.raw) : null,
      consistencyProven: false,
      traceable: false,
      publicationUsable: false,
      reviewStatus: "READY_WITH_GAPS" as const,
      provenance: RESULT_KINDS.has(material.kind) ? "PROVIDED_RESULT_MATERIAL" as const : "PROVIDED_NONRESULT_MATERIAL" as const,
    };
    return core;
  });
  if (!materials.length) {
    const missingRaw = "尚未提供可核對的結果材料。"; const planRaw = outputTarget === "MOE" ? "教學設計、學習評量與反思迭代目前僅為本機規劃草稿。" : outputTarget === "NSTC" ? "理論、假設、先導與主要研究目前僅為本機規劃草稿。" : "研究方法、結果與引用目前僅為本機規劃草稿。";
    clauses.push({ clauseId: `clause:${beta1Hash(missingRaw).slice(0, 32)}`, materialId: "missing:results", kind: "RESULTS", rawHash: beta1Hash(missingRaw), startByte: 0, endByte: bytes(missingRaw), state: "MISSING", observationKey: null, consistencyProven: false, traceable: false, publicationUsable: false, reviewStatus: "READY_WITH_GAPS", provenance: "MISSING_SECTION_NO_SOURCE_MATERIAL" });
    clauses.push({ clauseId: `clause:${beta1Hash(planRaw).slice(0, 32)}`, materialId: "synthetic:plan", kind: "NOTE", rawHash: beta1Hash(planRaw), startByte: 0, endByte: bytes(planRaw), state: "PLANNED", observationKey: null, consistencyProven: false, traceable: false, publicationUsable: false, reviewStatus: "READY_WITH_GAPS", provenance: "SYNTHETIC_PLAN" });
  }
  const recordBindings = (observationAuthority?.records ?? []).map((record) => {
    const clause = clauses.find((item) => item.materialId === record.materialId && item.startByte <= record.startByte && item.endByte >= record.endByte);
    if (!clause) throw new Error("beta1_observation_claim_binding_invalid");
    const rendered = renderV2Beta1TypedObservationRecord(record);
    const revisionText = rendered.renderedClaimText;
    const revisionTextHash = beta1Hash(revisionText);
    return { recordId: record.recordId, recordHash: record.recordHash, claimId: rendered.claimId, materialId: record.materialId, clauseId: clause.clauseId, renderedClaimText: rendered.renderedClaimText, renderedClaimHash: rendered.renderedClaimHash, revisionText, revisionTextHash, revisionBindingHash: beta1Hash({ recordHash: record.recordHash, claimId: rendered.claimId, clauseId: clause.clauseId, rawHash: clause.rawHash, renderedClaimHash: rendered.renderedClaimHash, revisionTextHash, inference: "ASSOCIATION_ONLY" }) };
  });
  if (new Set(recordBindings.map((item) => item.claimId)).size !== recordBindings.length || new Set(recordBindings.map((item) => item.revisionTextHash)).size !== recordBindings.length) throw new Error("beta1_observation_claim_bijection_invalid");
  const coveredClauses = new Set(recordBindings.map((item) => item.clauseId));
  const hasConfirmedObservation = Boolean(recordBindings.length);
  const exactClauseCoverage = resultRows.length > 0 && resultRows.every(({ material, clause, state, index }) => state === "OBSERVED" && coveredClauses.has(`clause:${beta1Hash({ materialId: material.materialId, index, rawHash: beta1Hash(clause.raw) }).slice(0, 32)}`));
  const consistencyProven = hasConfirmedObservation && exactClauseCoverage && resultState === "OBSERVED" && legacy.classification === "OBSERVED" && legacy.consistencyProven;
  const traceable = hasConfirmedObservation && exactClauseCoverage ? true : legacy.traceable;
  const publicationUsable = resultState === "OBSERVED" && consistencyProven && traceable && readiness.requiredSectionsComplete && !readiness.hasBlockingMarker;
  const reviewStatus = resultState === "CONFLICT" ? "BLOCKED_EVIDENCE_OR_INTEGRITY" as const : publicationUsable ? "FINAL_CONFIRMABLE" as const : "READY_WITH_GAPS" as const;
  for (const clause of clauses) if (RESULT_KINDS.has(clause.kind)) { clause.consistencyProven = consistencyProven; clause.traceable = traceable; clause.publicationUsable = publicationUsable; clause.reviewStatus = reviewStatus; }
  const core: Omit<V2Beta1EvidenceAuthority, "authorityHash"> = { authorityVersion: V2_BETA1_EVIDENCE_AUTHORITY_VERSION, outputTarget, sourceBundleHash: sourceBundleHash(materials), observationAuthorityHash: observationAuthority?.authorityHash ?? null, materialBindings, clauses, recordBindings, summary: { resultState, consistencyProven, traceable, publicationUsable, reviewStatus } };
  return { ...core, authorityHash: beta1Hash(core) };
}

export function validateV2Beta1EvidenceAuthority(value: unknown, materials: readonly V2Beta1ProjectionMaterial[], outputTarget: V2Beta1ProjectionTarget, observationAuthority: V2Beta1ObservationConfirmationAuthority | null = null) {
  try { return beta1CanonicalJson(value) === beta1CanonicalJson(createV2Beta1EvidenceAuthority(materials, outputTarget, observationAuthority)); } catch { return false; }
}

function trackAuthority(parent: V2Beta1ProfessionalProjectionParent): Record<string, string> {
  const focus = clip(parent.researchDirection, 180); const domain = parent.domain.label;
  if (parent.outputTarget === "SSCI") return {
    population: `${domain}中直接受「${focus}」影響的群體與制度參與者。`, sample: "以分層場域與明確納入排除條件形成可比較樣本；樣本數與代表性仍待材料或先導研究確認。", construct: "核心構念包含介入、主要機制、結果與情境差異，須建立操作定義並避免把規劃值當成觀察。", measurement: "以多來源量測連結構念、行為與情境，量表來源、信效度及測量恆等性須逐項核對。", validity: "同時檢查構念效度、內部效度、情境效度與外推界線。", primaryMechanism: `檢驗「${focus}」如何透過主要機制影響結果，並比較替代解釋與情境調節。`, context: `${domain}的制度、文化、資源與實作忠實度構成必要情境邊界。` };
  if (parent.outputTarget === "SCI") return {
    sample: `依「${focus}」界定樣本來源、比較單位、納入排除與功效需求。`, comparison: "預先界定主要比較、基準條件與替代解釋，不以事後分組取代研究設計。", operationalization: "把介入、量測時間點、主要結果與分析單位寫成可重現操作定義。", instrumentQuality: "報告儀器校正、量測誤差、信效度與資料品質門檻。", effect: "保留效應方向、估計值與單位；未提供時明確標示待補。", confidenceInterval: "效應估計須連結信賴區間或其他不確定性範圍；目前缺漏不得推定。", sensitivity: "以替代規格、缺失資料與異常值分析檢查結果穩健性。", reproducibility: "固定資料處理、分析版本、參數與重現步驟。" };
  if (parent.outputTarget === "NSTC") return {
    theory: `由「${focus}」建立可否證理論機制與邊界條件。`, hypotheses: "區分主要假設、替代假設與否證結果，不把預期方向寫成發現。", pilot: "先導階段核對構念、量測、招募、資料品質與分析可行性。", mainStudy: "主要研究依先導結果執行預先界定的蒐集、比較與敏感度分析。", workPackages: "工作包依序連結理論建模、先導驗證、主要研究與成果整合。", milestones: "里程碑以可稽核交付物與停止條件管理，不虛構官方期限。", reproducibleAnalysis: "保留資料字典、分析規格、版本與可重現成果包。" };
  return {
    course: `由「${focus}」界定課程脈絡、教學痛點與可改善的學習任務。`, learners: "明確描述修課者、先備能力、班級情境與需要支持的學習差異。", intervention: "把教學介入內容、頻率、教師行動與學習者活動寫成可執行設計。", fidelity: "記錄介入是否依設計執行、課堂調整與影響成效解讀的偏差。", learningAssessment: "連結學習目標、形成性評量、總結性評量與可追溯作品證據。", effectAnalysis: "區分描述性變化、比較效果與不確定性；未提供結果時只保留分析計畫。", reflectionIteration: "以教師反思、學習回饋與成效證據規劃下一輪課程修正。" };
}

function evidenceSummary(authority: V2Beta1EvidenceAuthority) {
  if (authority.summary.resultState === "OBSERVED") return authority.summary.consistencyProven && authority.summary.traceable ? "結果材料已形成一致且可追溯的觀察；仍須保留限制與重現條件。" : "已提供觀察材料，但一致性、引用或不確定性尚未完整，因此不得標示為可出版終稿。";
  if (authority.summary.resultState === "CONFLICT") return "相同觀察鍵下的結果不一致；完成來源與分析核對前不得形成結果主張。";
  if (authority.summary.resultState === "PLANNED") return "目前內容是目標、預期或待分析計畫，不是已觀察結果。";
  return "尚未提供可驗證結果；所有效果、官方事實與結論維持缺失或待確認。";
}

export function createV2Beta1ProfessionalProjection(parent: V2Beta1ProfessionalProjectionParent): V2Beta1ProfessionalProjection {
  if (!isBeta1Hash(parent.domain.selectionHash) || !validateV2Beta1EvidenceAuthority(parent.evidenceAuthority, parent.materials, parent.outputTarget, parent.observationAuthority) || !parent.researchDirection.trim()) throw new Error("beta1_projection_parent_invalid");
  const laneLabel = LANE_LABELS[parent.lane]; const laneAuthority = LANE_AUTHORITY[parent.lane]; const targetLabel = TARGET_LABELS[parent.outputTarget]; const focus = clip(parent.researchDirection, 220); const trackFields = trackAuthority(parent);
  const materialSummary = parent.materials.length ? parent.materials.map((item, index) => `材料 ${index + 1}「${clip(item.title, 80)}」（${MATERIAL_LABELS[item.kind]}，${bytes(item.content)} 位元組）`).join("；") : "目前沒有來源材料；以下內容均為待核對的研究規劃。";
  const title = clip(`${focus}：${laneLabel}的${targetLabel}方案`, 160);
  const targetQuestion = parent.outputTarget === "MOE" ? `在${parent.domain.label}課程情境中，「${focus}」如何影響學習歷程與成果？` : parent.outputTarget === "NSTC" ? `在${parent.domain.label}中，「${focus}」的理論機制與可否證假設為何？` : `在${parent.domain.label}中，「${focus}」透過哪些可測量機制影響主要結果？`;
  const researchQuestion = `${targetQuestion} ${laneAuthority.question}`;
  const targetMechanism = parent.outputTarget === "SCI" ? "把可操作化介入、比較條件、量測品質與效應估計連成可重現機制鏈。" : parent.outputTarget === "SSCI" ? "把構念、主要機制、制度情境與群體差異連成可檢驗解釋。" : parent.outputTarget === "NSTC" ? "以理論、假設、先導與主要研究逐步辨識機制及失效條件。" : "以課程介入、執行忠實度、學習評量與反思迭代辨識教學機制。";
  const mechanism = `${laneLabel}取徑${targetMechanism} ${laneAuthority.mechanism}`;
  const targetMethod = parent.outputTarget === "SCI" ? "建立樣本與比較契約，明確操作化變項、檢查儀器品質，估計效果與信賴區間，並執行敏感度及重現性分析。" : parent.outputTarget === "SSCI" ? "界定母群與樣本，檢驗構念與量測效度，以主要機制和情境比較回答研究問題，並限制外推。" : parent.outputTarget === "NSTC" ? "先完成理論與假設，經先導研究修正後執行主要研究；工作包、里程碑與可重現分析逐項對齊。" : "界定課程與學習者，執行教學介入並記錄忠實度，以學習評量、效果分析及反思迭代形成教學證據。";
  const method = `${targetMethod} ${laneAuthority.method}`;
  const contribution = `${laneAuthority.contribution} 專業貢獻在於將「${focus}」轉化為${targetLabel}可審查的問題、方法、證據與成果鏈，並明確保留未知、限制與反證條件。`;
  const summary = evidenceSummary(parent.evidenceAuthority);
  const s0 = {
    workingTitle: title,
    domain: parent.domain.label,
    outputTrack: parent.outputTarget,
    problemContext: `研究者提出「${focus}」。本方案在${parent.domain.label}中界定可回答問題，並以${targetLabel}的專業要求區分來源材料、規劃內容與可觀察證據。`,
    targetUsers: parent.outputTarget === "MOE" ? trackFields.learners : parent.outputTarget === "SSCI" ? trackFields.population : parent.outputTarget === "SCI" ? trackFields.sample : "參與先導與主要研究的研究對象、場域夥伴及成果使用者；實際樣本與權限仍待確認。",
    expectedContribution: contribution,
    existingData: `${materialSummary} ${summary}`,
    availableData: parent.materials.length ? `可用資料僅限上述已提供材料；新增樣本、量測、引用或官方資訊均須另行取得並核對。` : "目前沒有可用來源資料；樣本、量測、引用、結果及官方資訊皆為待補。",
    methodIdea: method,
    timeline: parent.outputTarget === "NSTC" ? `${trackFields.pilot} ${trackFields.mainStudy} ${trackFields.milestones}` : parent.outputTarget === "MOE" ? `${trackFields.intervention} ${trackFields.fidelity} ${trackFields.reflectionIteration}` : "依序完成來源稽核、樣本與量測確認、分析規格、正式執行、敏感度檢查及整合寫作。",
    constraints: `材料完整度、樣本可得性、量測品質、資料權限與場域條件限制本方案；${summary}`,
    ethicsPrivacyRisks: "採知情同意、用途限制、資料最小化、去識別、最小權限與可追溯治理；未完成倫理與權限確認前不得進入正式執行。",
    unresolvedItems: `${summary} 尚待確認樣本框、量測效度、分析規格、正式引用、資料權限、官方規則與停止條件。`,
  } satisfies Record<S0FieldName, string>;
  const renderedClaims = parent.evidenceAuthority.recordBindings.map((binding) => binding.revisionText);
  const previewCore = { kind: parent.outputTarget === "SCI" || parent.outputTarget === "SSCI" ? "JOURNAL_MANUSCRIPT" as const : "TAIWAN_PROPOSAL" as const, title, sections: { ABSTRACT: `${s0.problemContext} ${contribution}`, INTRODUCTION: `${researchQuestion} ${mechanism}`, METHODS: `${method} ${s0.ethicsPrivacyRisks}`, RESULTS: renderedClaims.length ? `${summary}\n${renderedClaims.join("\n")}` : summary, DISCUSSION: `${contribution} 推論必須受材料、情境與${s0.constraints}`, CONCLUSION: `${title}目前為人工作業草稿；完成證據、倫理與成果規格核對前，不形成正式結論。` } };
  const preview = { ...previewCore, contentHash: beta1Hash(previewCore) };
  const contextCore = { projectionVersion: V2_BETA1_PROFESSIONAL_PROJECTION_VERSION, outputTarget: parent.outputTarget, lane: parent.lane, domainSelectionHash: parent.domain.selectionHash, researchDirection: normalized(parent.researchDirection), materialBindings: parent.evidenceAuthority.materialBindings, evidenceAuthorityHash: parent.evidenceAuthority.authorityHash };
  const core = { projectionVersion: V2_BETA1_PROFESSIONAL_PROJECTION_VERSION, contextHash: beta1Hash(contextCore), outputTarget: parent.outputTarget, targetLabel, lane: parent.lane, laneLabel, domainLabel: parent.domain.label, researchDirection: normalized(parent.researchDirection), materialSummary, evidenceAuthorityHash: parent.evidenceAuthority.authorityHash, trackFields, title, researchQuestion, mechanism, method, contribution, unknowns: [summary, "正式引用、資料權限、倫理條件與外部規則仍須由人員核對。"], s0, preview };
  return { ...core, authorityHash: beta1Hash(core) };
}

export function validateV2Beta1ProfessionalProjection(value: unknown, parent: V2Beta1ProfessionalProjectionParent) {
  try { return beta1CanonicalJson(value) === beta1CanonicalJson(createV2Beta1ProfessionalProjection(parent)); } catch { return false; }
}

function stateLabel(value: string) { return value === "OBSERVED" ? "已觀察" : value === "PLANNED" ? "規劃中" : value === "CONFLICT" ? "有衝突" : value === "MISSING" ? "缺少" : "尚待釐清"; }
function reviewLabel(value: string) { return value === "FINAL_CONFIRMABLE" ? "可進入最終人工確認" : value === "BLOCKED_EVIDENCE_OR_INTEGRITY" ? "證據或一致性阻擋" : "仍有缺口"; }

export function createV2Beta1HumanDraftAuthority(input: {
  projection: V2Beta1ProfessionalProjection;
  evidenceAuthority: V2Beta1EvidenceAuthority;
  fieldAssist: Record<S0FieldName, ReadonlyArray<{ text: string; rationale: string; risk: string }>>;
  evidenceGapMap: ReadonlyArray<{ statement: string; state: string }>;
  analysisWorkPackages: ReadonlyArray<{ title: string; objective: string; steps: readonly string[]; deliverables: readonly string[] }>;
  continuationSections: ReadonlyArray<{ sectionId: keyof typeof CONTINUATION_LABELS; text: string }>;
  journal: null | { reviewStatus: string; publicationUsable: boolean; priorityFindings: ReadonlyArray<{ title: string; reason: string; revisions: ReadonlyArray<{ text: string; rationale: string; risk: string }> }> };
  taiwanProposal: null | { targetId: "NSTC" | "MOE"; narrativeSections: Record<string, string>; workPackages: ReadonlyArray<{ title: string; objective: string }>; kpis: ReadonlyArray<{ measure: string; target: string }>; budget: { totalTwd: number }; attachments: ReadonlyArray<{ label: string; status: string }>; priorityFindings: ReadonlyArray<{ title: string; reason: string; revisions: ReadonlyArray<{ text: string; rationale: string; risk: string }> }> };
}): V2Beta1HumanDraftAuthority {
  const { projection, evidenceAuthority } = input;
  const lines = [`# ${projection.title}`, "", `成果路徑：${projection.targetLabel}`, `研究領域：${projection.domainLabel}`, `專業取徑：${projection.laneLabel}`, "", "## 研究定位", projection.researchQuestion, "", "### 作用機制", projection.mechanism, "", "### 方法", projection.method, "", "### 預期貢獻", projection.contribution, "", "## 13 欄研究摘要"];
  for (const field of S0_FIELD_NAMES) lines.push(`### ${FIELD_LABELS[field]}`, projection.s0[field], "");
  lines.push("## 老麥三案協作");
  for (const field of S0_FIELD_NAMES) {
    lines.push(`### ${FIELD_LABELS[field]}`);
    input.fieldAssist[field].forEach((option, index) => lines.push(`- ${STRATEGY_LABELS[index]}：${option.text}`, `  理由：${option.rationale}`, `  風險：${option.risk}`));
  }
  lines.push("", "## 證據權威", `結果狀態：${stateLabel(evidenceAuthority.summary.resultState)}`, `審查狀態：${reviewLabel(evidenceAuthority.summary.reviewStatus)}`, evidenceSummary(evidenceAuthority), "", "### 證據與缺口");
  input.evidenceGapMap.forEach((item) => lines.push(`- ${stateLabel(item.state)}：${item.statement}`));
  lines.push("", "## 分析工作包"); input.analysisWorkPackages.forEach((item) => lines.push(`### ${item.title}`, item.objective, `步驟：${item.steps.join("；")}`, `交付物：${item.deliverables.join("；")}`, ""));
  lines.push("## 六段成果草稿"); input.continuationSections.forEach((item) => lines.push(`### ${CONTINUATION_LABELS[item.sectionId]}`, item.text, ""));
  if (input.journal) {
    lines.push("## 期刊終審", `審查狀態：${reviewLabel(input.journal.reviewStatus)}`, input.journal.publicationUsable ? "目前通過結構與證據下限，仍須最終人工確認。" : "目前不得標示為出版可用終稿。", "");
    input.journal.priorityFindings.forEach((finding) => { lines.push(`### ${finding.title}`, finding.reason); finding.revisions.forEach((revision, index) => lines.push(`- ${STRATEGY_LABELS[index]}：${revision.text}`, `  理由：${revision.rationale}`, `  風險：${revision.risk}`)); });
  }
  if (input.taiwanProposal) {
    lines.push("## 臺灣計畫總審"); for (const [key, value] of Object.entries(input.taiwanProposal.narrativeSections)) lines.push(`### ${PROPOSAL_LABELS[key as keyof typeof PROPOSAL_LABELS] ?? "計畫內容"}`, value, "");
    lines.push("### 工作包"); input.taiwanProposal.workPackages.forEach((item) => lines.push(`- ${item.title}：${item.objective}`));
    lines.push("### 成效指標"); input.taiwanProposal.kpis.forEach((item) => lines.push(`- ${item.measure}；規劃門檻：${item.target}`));
    lines.push("### 規劃預算與附件", `本機合成規劃預算：新臺幣 ${input.taiwanProposal.budget.totalTwd.toLocaleString("en-US")} 元。此數值不是現行官方上限或核定金額。`); input.taiwanProposal.attachments.forEach((item) => lines.push(`- ${item.label}：${item.status === "UNKNOWN_OR_STALE" ? "官方狀態未知或可能過期" : "需要人工核對"}`));
  }
  lines.push("", "## 最終人工關卡", "本草稿只供整體預覽、套用與復原。正式研究寫入、外部送出、官方事實確認與專業品質判斷仍由人員負責。", "");
  const humanDraft = lines.join("\n").replace(/\n{3,}/gu, "\n\n").trimEnd() + "\n";
  if (FORBIDDEN_HUMAN_ENUM.test(humanDraft) || MALFORMED_PUNCTUATION.test(humanDraft) || humanDraft.trimStart().startsWith("{") || humanDraft.includes('"schemaId"')) throw new Error("beta1_human_draft_content_invalid");
  return { projectionVersion: V2_BETA1_HUMAN_DRAFT_PROJECTION_VERSION, humanDraft, projectionHash: beta1Hash(`${V2_BETA1_HUMAN_DRAFT_PROJECTION_VERSION}${humanDraft}`) };
}

export function validateV2Beta1HumanDraftAuthority(value: unknown, input: Parameters<typeof createV2Beta1HumanDraftAuthority>[0]) {
  try { return beta1CanonicalJson(value) === beta1CanonicalJson(createV2Beta1HumanDraftAuthority(input)); } catch { return false; }
}
