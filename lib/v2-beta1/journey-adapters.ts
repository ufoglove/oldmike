import "server-only";

import { S0_FIELD_NAMES, type S0FieldName } from "../s0-fields.ts";
import type { V2Alpha3DomainSelection } from "../v2-alpha3/contracts.ts";
import {
  V2_BETA1_DIRECTION_LANES,
  beta1Hash,
  parseV2Beta1JourneyArtifact,
  type V2Beta1Direction,
  type V2Beta1JourneyArtifact,
  type V2Beta1JourneyRequest,
  type V2Beta1SourceMaterial,
} from "./contracts.ts";
import type { V2Beta1ResultEvidenceClass } from "./evidence-classifier.ts";
import { deriveV2Beta1JourneyInputBundleHash } from "./journey-lineage.ts";
import { createV2Beta1EvidenceAuthority, createV2Beta1ProfessionalProjection, type V2Beta1EvidenceAuthority } from "./professional-projection.ts";
import { deriveEvidenceProjectionBundle } from "./selection-authority.ts";
import { createV2Beta1AssistOptions } from "./shared-authority.ts";
import { deriveV2Beta1ObservationEffectLineageHash } from "./typed-observation-authority.ts";

const LANE_COPY = Object.freeze({
  EVIDENCE_FIRST: {
    suffix: "證據校準與可反駁機制",
    question: "在已提供材料的界線內，哪些可觀察機制成立，哪些替代解釋仍須排除？",
    mechanism: "以證據可見性、測量一致性與替代解釋排除連結介入、機制與結果。",
    contribution: "建立可重現、可反駁且不超越材料的證據鏈與最小充分研究設計。",
    method: "採序列式混合方法，先稽核構念與資料品質，再檢驗主要關聯並辨識失效條件。",
  },
  BALANCED_RECOMMENDED: {
    suffix: "作用機制、實作成效與情境差異",
    question: "核心機制如何影響結果，並在不同對象、場域與實作忠實度下產生差異？",
    mechanism: "以機制檢驗、實作忠實度與情境調節共同解釋成效及可移轉性。",
    contribution: "在理論辨識、方法可行性與實務價值之間形成平衡且可審查的貢獻。",
    method: "採準實驗或縱貫混合方法，結合主要結果、機制變項、歷程與情境比較。",
  },
  FRONTIER_INNOVATION: {
    suffix: "跨域理論、邊界條件與前瞻驗證",
    question: "跨域理論能提出哪些可否證的新機制，且哪些主張仍只能視為假設？",
    mechanism: "透過跨域構念對照、邊界條件與反事實比較，探索高增益但可驗證的新解釋。",
    contribution: "提出高創新且明列假設、風險與否證條件的理論延伸，不宣稱未觀察趨勢。",
    method: "採分階段探索與驗證設計，先以先導資料評估可行性，再進行預先界定的比較與敏感度分析。",
  },
} as const);

const REQUIRED_MANUSCRIPT_SECTIONS = ["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"] as const;

function clip(value: string, maximum: number) {
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1)}…`;
}

function sourceMaterials(request: V2Beta1JourneyRequest): V2Beta1SourceMaterial[] {
  return request.materials.map((item) => ({ ...item, contentHash: beta1Hash(item.content), evidenceState: "OBSERVED" as const }));
}

function sourceBundleHash(materials: readonly V2Beta1SourceMaterial[]) {
  return beta1Hash(materials.map(({ materialId, kind, title, contentHash }) => ({ materialId, kind, title, contentHash })));
}

function s0For(input: { title: string; target: V2Beta1JourneyRequest["outputTarget"]; domain: V2Alpha3DomainSelection; direction: string; lane: keyof typeof LANE_COPY; contribution: string; method: string; materials: readonly V2Beta1SourceMaterial[]; resultState: V2Beta1ResultEvidenceClass }) {
  const providedKinds = input.materials.map((item) => item.kind).join("、") || "尚無材料";
  return {
    workingTitle: input.title,
    domain: input.domain.label,
    outputTrack: input.target,
    problemContext: `研究者明確提出「${clip(input.direction, 500)}」。本方案在${input.domain.label}脈絡中界定問題，並區分已提供材料、待驗證假設與不可推定結果。`,
    targetUsers: `${input.domain.label}相關研究對象、實作者與決策者；真實樣本、場域及納入排除條件仍須確認。`,
    expectedContribution: input.contribution,
    existingData: `已提供材料類型：${providedKinds}。材料按原順序與位元組保留；未提供的結果、引用與官方規則不視為證據。`,
    availableData: `可依「${clip(input.direction, 160)}」規劃量化結果、歷程、問卷、訪談與文件證據；權限、品質與可得性待確認。`,
    methodIdea: input.method,
    timeline: `先盤點${input.domain.label}場域與資料，再進行先導驗證、正式蒐集分析及整合寫作；確切期程待人力與審查條件確認。`,
    constraints: `「${clip(input.direction, 140)}」所需樣本、量測、資料品質、人力、預算與官方時程尚未證實，正式執行前須逐項核對。`,
    ethicsPrivacyRisks: `${input.domain.label}脈絡需評估知情同意、權力關係、資料最小化、去識別化、存取控制、二次利用與工具協助揭露。`,
    unresolvedItems: `「${clip(input.direction, 140)}」仍待確認樣本框、主要結果、效應估計、正式引用、資料權限與失效條件；目前結果狀態為${input.resultState === "OBSERVED" ? "已有一致且可追溯的觀察材料" : input.resultState === "CONFLICT" ? "數據或敘述不一致" : input.resultState === "PLANNED" ? "僅有規劃內容" : "缺少結果"}。`,
  } satisfies Record<S0FieldName, string>;
}

function directionPreview(title: string, s0: Record<S0FieldName, string>, target: V2Beta1JourneyRequest["outputTarget"], resultState: V2Beta1ResultEvidenceClass, lane: keyof typeof LANE_COPY) {
  const core = {
    kind: target === "SCI" || target === "SSCI" ? "JOURNAL_MANUSCRIPT" as const : "TAIWAN_PROPOSAL" as const,
    title,
    sections: {
      ABSTRACT: `${s0.problemContext} ${s0.expectedContribution}`,
      INTRODUCTION: `${s0.problemContext} ${LANE_COPY[lane].mechanism}`,
      METHODS: `${s0.methodIdea} ${s0.ethicsPrivacyRisks}`,
      RESULTS: resultState === "OBSERVED" ? `${lane}方向已辨識一致且可追溯的結果材料；仍需核對估計程序、不確定性與可重現性。` : resultState === "CONFLICT" ? `${lane}方向的結果材料存在矛盾；完成一致性處理前不得形成結果主張。` : resultState === "PLANNED" ? `${lane}方向只有規劃結果；不把預期或未完成分析改寫成觀察發現。` : `${lane}方向尚無驗證結果；只保留資料與分析檢核，不虛構發現。`,
      DISCUSSION: `${s0.expectedContribution} 外推受${s0.constraints}`,
      CONCLUSION: `${s0.workingTitle}為可審查草稿；正式結論須等待證據、倫理與成果規格核對。`,
    },
  };
  return { ...core, contentHash: beta1Hash(core) };
}

function buildDirectionBases(request: V2Beta1JourneyRequest, materials: V2Beta1SourceMaterial[], evidenceAuthority: V2Beta1EvidenceAuthority): Array<Omit<V2Beta1Direction, "selectionArtifact">> {
  const observationEffectLineageHash = deriveV2Beta1ObservationEffectLineageHash(request.observationConfirmation);
  return V2_BETA1_DIRECTION_LANES.map((lane, index) => {
    const professionalProjection = createV2Beta1ProfessionalProjection({ outputTarget: request.outputTarget, lane, domain: { label: request.researchDomain.label, selectionHash: request.researchDomain.selectionHash }, researchDirection: request.researchDirection, materials, observationAuthority: request.observationConfirmation, evidenceAuthority });
    const { title, contribution, method, researchQuestion, mechanism, unknowns, s0, preview } = professionalProjection;
    const base = {
      directionId: `direction:${beta1Hash({ entryMode: request.entryMode, outputTarget: request.outputTarget, researchDirection: request.researchDirection, researchDomainHash: request.researchDomain.selectionHash, materials: materials.map(({ materialId, kind, title, contentHash }) => ({ materialId, kind, title, contentHash })), observationEffectLineageHash, lane }).slice(0, 32)}`,
      lane,
      title,
      researchQuestion,
      mechanism,
      contribution,
      method,
      evidenceBoundary: "UNVERIFIED" as const,
      unknowns,
      recommended: index === 1,
      professionalProjection,
    };
    const directionHash = beta1Hash(base);
    const inputBundleHash = deriveV2Beta1JourneyInputBundleHash({ entryMode: request.entryMode, outputTarget: request.outputTarget, researchDirection: request.researchDirection, researchDomain: request.researchDomain, materials, observationEffectLineageHash, selectedLane: lane }, directionHash);
    const assistParent = { direction: { lane, directionHash, inputBundleHash, title, researchQuestion: base.researchQuestion, mechanism: base.mechanism, contribution, method, s0 }, domain: { label: request.researchDomain.label, selectionHash: request.researchDomain.selectionHash }, outputTarget: request.outputTarget };
    const fieldAssist = Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, createV2Beta1AssistOptions(assistParent, field)])) as V2Beta1Direction["fieldAssist"];
    return { ...base, directionHash, inputBundleHash, s0, preview, fieldAssist };
  });
}

function completeArtifact(core: Omit<V2Beta1JourneyArtifact, "humanGate" | "artifactHash">): V2Beta1JourneyArtifact {
  const selected = core.directions.find((item) => item.directionId === core.selectedDirectionId)!;
  const humanGate = { required: true as const, scope: "WHOLE_ARTIFACT" as const, confirmed: false as const, contentHash: selected.selectionArtifact.humanGateHash };
  const withGate = { ...core, humanGate };
  return parseV2Beta1JourneyArtifact({ ...withGate, artifactHash: beta1Hash(withGate) });
}

export function runV2Beta1ThinAdapters(request: V2Beta1JourneyRequest, _legacyFocusDomain?: V2Alpha3DomainSelection) {
  const materials = sourceMaterials(request);
  const evidenceAuthority = createV2Beta1EvidenceAuthority(materials, request.outputTarget, request.observationConfirmation);
  const state = evidenceAuthority.summary.resultState;
  const bases = buildDirectionBases(request, materials, evidenceAuthority);
  const officialSourceBundleHash = request.outputTarget === "NSTC" || request.outputTarget === "MOE" ? beta1Hash({ authority: "LOCAL_SYNTHETIC_OFFICIAL_SOURCE_BUNDLE", target: request.outputTarget, cycleYear: 2026, domainSelectionHash: request.researchDomain.selectionHash, freshness: "UNKNOWN_OR_STALE" }) : null;
  const directions = bases.map((direction) => ({ ...direction, selectionArtifact: deriveEvidenceProjectionBundle({ outputTarget: request.outputTarget, researchDomainHash: request.researchDomain.selectionHash, officialSourceBundleHash, direction, materials, evidenceAuthority }) })) as V2Beta1JourneyArtifact["directions"];
  const selected = directions[1];
  const projection = selected.selectionArtifact;
  const artifact = completeArtifact({
    schemaId: "old-mike-v2-beta1/journey/4",
    kind: projection.kind,
    entryMode: request.entryMode,
    outputTarget: request.outputTarget,
    researchDirection: request.researchDirection,
    researchDomain: request.researchDomain,
    inputBundleHash: selected.inputBundleHash,
    officialSourceBundleHash,
    sourceMaterials: materials,
    observationAuthority: request.observationConfirmation,
    resultEvidenceClass: state,
    evidenceAuthority,
    directions,
    recommendedDirectionId: selected.directionId,
    selectedDirectionId: selected.directionId,
    selectedDirectionHash: selected.directionHash,
    evidenceGapMap: projection.evidenceGapMap,
    analysisWorkPackages: projection.analysisWorkPackages,
    continuationSections: projection.continuationSections,
    journal: projection.journal,
    taiwanProposal: projection.taiwanProposal,
  });
  return { artifact, s0: selected.s0 };
}

export const V2_BETA1_THIN_ADAPTER_BOUNDARY = Object.freeze({ sourceMutation: "FORBIDDEN", cardSwitchEffects: 0, liveProviderCalls: 0, scholarlyCalls: 0, zoteroCalls: 0, onlineDatabaseConnections: 0, formalResearchWrites: 0, externalMutations: 0 });
