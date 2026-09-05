"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { beta1CanonicalJson, beta1Hash } from "../../lib/v2-beta1/canonical-hash";
import {
  parseV2Beta1GetResponse,
  parseV2Beta1PostResponse,
  type V2Beta1Insight,
  type V2Beta1Journey,
  type V2Beta1Snapshot,
  type V2Beta1StageId,
  type V2Beta1StageStatus,
} from "../../lib/v2-beta1/client-contract";
import {
  V2_BETA1_MATERIAL_CONTENT_MAX_BYTES,
  V2_BETA1_CONTRACT_VERSION,
  V2_BETA1_MATERIAL_MAX_COUNT,
  V2_BETA1_MATERIAL_TOTAL_MAX_BYTES,
  V2_BETA1_REQUEST_MAX_BYTES,
} from "../../lib/v2-beta1/shared-authority";
import type { V2Beta1ImportChatInsightRequest, V2Beta1JourneyRequest } from "../../lib/v2-beta1/contracts";
import { V2_BETA1_LOCAL_TRUSTED_SCOPE, V2_BETA1_LOCAL_WORKSPACE_AUTHORITY } from "../../lib/v2-beta1/scope-authority";
import { V2_BETA1_OBSERVATION_UNITS, V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION, createV2Beta1ObservationConfirmationAuthority, createV2Beta1TypedObservationRecord, deriveV2Beta1ObservationCandidates, parseV2Beta1TypedObservationRecord, type V2Beta1ObservationCandidate, type V2Beta1TypedObservationRecord } from "../../lib/v2-beta1/typed-observation-authority";
import styles from "./v2-beta1.module.css";

type ApiState = { snapshot: V2Beta1Snapshot; previewInsight: V2Beta1Insight | null };
type MobilePanel = "CONTENT" | "NAV" | "CHAT";
type EntryMode = "KEYWORD" | "CHAT_INSIGHT" | "PARTIAL_MATERIAL";
type OutputTarget = "SCI" | "SSCI" | "NSTC" | "MOE";
type MaterialKind = "ABSTRACT" | "INTRODUCTION" | "METHODS" | "RESULTS" | "QUESTIONNAIRE" | "STATISTICS" | "FIGURE" | "TABLE" | "CITATION" | "NOTE";
type MaterialDraft = { localId: string; kind: MaterialKind; title: string; content: string };
type RequestIdentity = { payloadHash: string; requestId: string; idempotencyKey: string };
type ObservationDecision = "UNREVIEWED" | "CONFIRMED" | "CORRECTING" | "CORRECTED" | "EXCLUDED";
type ObservationCorrection = { metricId: string; cohortId: string; timepoint: string; analysisId: string; effectId: string; estimate: string; unit: string; direction: "NEGATIVE" | "ZERO" | "POSITIVE"; sampleSize: string; pComparator: "<" | "<=" | "=" | ">=" | ">"; pValue: string; ci95Lower: string; ci95Upper: string; citationKind: "OWN_DATA" | "LITERATURE"; identityKind: "DOI" | "ARXIV" | "AUTHOR_YEAR_TITLE"; identity: string };

const CONTRACT_VERSION = V2_BETA1_CONTRACT_VERSION;
const WORKSPACE_AUTHORITY = V2_BETA1_LOCAL_WORKSPACE_AUTHORITY;
const S0_FIELDS = ["workingTitle", "domain", "outputTrack", "problemContext", "targetUsers", "expectedContribution", "existingData", "availableData", "methodIdea", "timeline", "constraints", "ethicsPrivacyRisks", "unresolvedItems"] as const;
const S0_PROJECTION_FIELDS = ["domain", "outputTrack", "targetUsers", "expectedContribution", "methodIdea", "unresolvedItems"] as const;
const NAV_ITEMS: Array<{ id: string; label: string; stage: V2Beta1StageId; description: string }> = [
  { id: "start", label: "開始研究", stage: "DISCOVER", description: "從研究焦點、材料與完整研究藍圖開始。" },
  { id: "evidence", label: "證據與文獻", stage: "EVIDENCE", description: "整理可驗證證據、來源邊界與待核對項目。" },
  { id: "design", label: "設計與分析", stage: "ANALYZE", description: "連結研究問題、方法、資料與分析工作包。" },
  { id: "paper", label: "論文", stage: "WRITE", description: "以同一專案真相承接期刊稿與修訂。" },
  { id: "taiwan", label: "臺灣計畫", stage: "BLUEPRINT", description: "把同一研究藍圖投影為國科會或教育部計畫。" },
  { id: "submit", label: "終稿與投稿", stage: "REVIEW_SUBMIT", description: "彙整終審、整體預覽與最後人工關卡。" },
];
const S0_LABELS: Record<(typeof S0_FIELDS)[number], string> = {
  workingTitle: "研究題目", domain: "研究領域", outputTrack: "成果目標", problemContext: "問題背景", targetUsers: "對象與情境",
  expectedContribution: "預期貢獻", existingData: "既有資料", availableData: "可用資料", methodIdea: "方法構想", timeline: "期程",
  constraints: "限制條件", ethicsPrivacyRisks: "倫理與隱私", unresolvedItems: "待確認事項",
};
const DIRECTION_LABELS = { EVIDENCE_FIRST: "證據優先", BALANCED_RECOMMENDED: "平衡推薦", FRONTIER_INNOVATION: "前沿創新" } as const;
const STRATEGY_LABELS = { EVIDENCE_CALIBRATED: "證據校準", JOURNAL_CONCISE_RECOMMENDED: "平衡精修（推薦）", NATURAL_SCHOLARLY: "自然學術" } as const;
const SECTION_LABELS: Record<string, string> = { ABSTRACT: "摘要", INTRODUCTION: "前言", METHODS: "方法", RESULTS: "結果", DISCUSSION: "討論", CONCLUSION: "結論" };
const PROPOSAL_SECTION_LABELS: Record<string, string> = { PROBLEM_AND_OBJECTIVES: "問題與目標", THEORY_AND_EVIDENCE: "理論與證據", METHOD_AND_DESIGN: "方法與設計", WORK_PLAN: "工作計畫", EXPECTED_OUTCOMES: "預期成果", ETHICS_AND_RISK: "倫理與風險" };
const MATERIAL_KINDS: ReadonlyArray<readonly [MaterialKind, string]> = [
  ["ABSTRACT", "摘要"], ["INTRODUCTION", "前言"], ["METHODS", "方法"], ["RESULTS", "結果"], ["QUESTIONNAIRE", "問卷"], ["STATISTICS", "統計"], ["FIGURE", "圖"], ["TABLE", "表"], ["CITATION", "引用"], ["NOTE", "研究筆記"],
];
const BUILTIN_DOMAINS = [
  ["ai-cross-disciplinary", "AI跨領域應用"],
  ["ai-education", "AI應用於教育"],
  ["ai-occupational-safety-training", "AI應用於職業安全與教育訓練"],
  ["ai-environment-resource-management", "AI應用於環境工程與環境資源管理"],
  ["ai-energy-management", "AI應用於能源管理"],
  ["xr-cross-disciplinary", "VR/AR/XR跨領域應用"],
] as const;

function stageLabel(status: V2Beta1StageStatus) { return status === "COMPLETE" ? "已完成" : status === "ACTIVE" ? "進行中" : "待開始"; }
function bytes(value: string) { return new TextEncoder().encode(value).byteLength; }
function createBuiltinDomain(domainId: string) {
  const found = BUILTIN_DOMAINS.find(([id]) => id === domainId) ?? BUILTIN_DOMAINS[1];
  const core = { kind: "BUILTIN" as const, domainId: found[0], label: found[1], profileId: null, profileVersion: null, profileContentHash: null };
  return { ...core, selectionHash: beta1Hash(core) };
}
function createCustomDomain(name: string) {
  const label = name.trim(); const contentHash = beta1Hash({ name: label });
  const core = { kind: "CUSTOM" as const, domainId: null, label, profileId: `profile:${contentHash.slice(0, 32)}`, profileVersion: 1, profileContentHash: contentHash };
  return { ...core, selectionHash: beta1Hash(core) };
}
function createChatPreview(base: V2Beta1Insight, input: string, domainLabel: string): V2Beta1Insight {
  const direction = input.replace(/\r\n?/gu, "\n").trim();
  const core = { kind: "direction" as const, title: `${direction.slice(0, 76)}：${domainLabel}研究洞見`, researchQuestion: direction, mechanism: `${domainLabel}脈絡中，「${direction.slice(0, 180)}」可能透過證據可見性、行動選擇與情境條件形成可檢驗機制。`, value: `把「${direction.slice(0, 180)}」轉化為可觀察、可反駁且能辨識失效條件的${domainLabel}研究。`, domainFit: `本洞見綁定${domainLabel}；跨域外推與真實場域仍待核對。`, evidenceBoundary: "UNVERIFIED" as const, assumptions: [`「${direction.slice(0, 120)}」目前沒有外部來源或正式資料支持，仍維持未驗證。`, ...base.assumptions.slice(0, 1)], nextAction: `先核對${domainLabel}中的量測構念、可用資料與「${direction.slice(0, 100)}」的最小可行設計。` };
  return { ...core, hash: beta1Hash(core) };
}
function newMaterial(index: number): MaterialDraft { return { localId: crypto.randomUUID(), kind: index === 0 ? "ABSTRACT" : "NOTE", title: index === 0 ? "摘要" : `研究材料 ${index + 1}`, content: "" }; }
function correctionFor(candidate: V2Beta1ObservationCandidate): ObservationCorrection {
  const record = candidate.suggestedRecord;
  return { metricId: record?.metricId ?? "", cohortId: record?.cohortId ?? "", timepoint: record?.timepoint ?? "", analysisId: record?.analysisId ?? "", effectId: record?.effectId ?? "", estimate: record?.estimate ?? "", unit: record?.unit ?? "%", direction: record?.direction ?? "POSITIVE", sampleSize: record ? String(record.sampleSize) : "", pComparator: record?.pComparator ?? "<=", pValue: record?.pValue ?? "", ci95Lower: record?.ci95Lower ?? "", ci95Upper: record?.ci95Upper ?? "", citationKind: record?.citation.kind ?? "OWN_DATA", identityKind: record?.citation.kind === "LITERATURE" ? record.citation.identityKind : "DOI", identity: record?.citation.kind === "LITERATURE" ? record.citation.identity : "" };
}

function ReviewRationaleRisk({ rationale, risk }: { rationale: string; risk: string }) {
  return <small data-testid="beta1-review-boundary"><span data-testid="beta1-review-rationale">{rationale}</span><br aria-hidden="true" /><span>風險：</span><span data-testid="beta1-review-risk">{risk}</span></small>;
}

export function V2Beta1ResearchOS() {
  const [state, setState] = useState<ApiState | null>(null);
  const [selectedNav, setSelectedNav] = useState("start");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("CONTENT");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("正在載入專案工作區。");
  const [chatInput, setChatInput] = useState("請整理生成式回饋如何透過證據校準影響學習者自我調節");
  const [chatPreview, setChatPreview] = useState<V2Beta1Insight | null>(null);
  const [importIdentity, setImportIdentity] = useState<RequestIdentity | null>(null);
  const [chatStopped, setChatStopped] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>("KEYWORD");
  const [outputTarget, setOutputTarget] = useState<OutputTarget>("SSCI");
  const [domainId, setDomainId] = useState("ai-education");
  const [customDomain, setCustomDomain] = useState("");
  const [researchDirection, setResearchDirection] = useState("生成式回饋的證據校準與高等教育自我調節學習");
  const [materials, setMaterials] = useState<MaterialDraft[]>([newMaterial(0)]);
  const [observationDecisions, setObservationDecisions] = useState<Record<string, ObservationDecision>>({});
  const [observationCorrections, setObservationCorrections] = useState<Record<string, ObservationCorrection>>({});
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [journeyIdentity, setJourneyIdentity] = useState<RequestIdentity | null>(null);
  const [journeyStopped, setJourneyStopped] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [undoText, setUndoText] = useState<string | null>(null);
  const [s0Draft, setS0Draft] = useState<Record<string, string>>({});
  const [s0Undo, setS0Undo] = useState<Record<string, string>>({});
  const [confirmedGateHash, setConfirmedGateHash] = useState<string | null>(null);
  const navPanel = useRef<HTMLElement>(null);
  const chatPanel = useRef<HTMLElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const focusJourneyResult = useRef(false);
  const activeMobileTrigger = useRef<HTMLButtonElement>(null);

  const activeItem = useMemo(() => NAV_ITEMS.find((item) => item.id === selectedNav) ?? NAV_ITEMS[0], [selectedNav]);
  const activeStage = state?.snapshot.stages.find((item) => item.stageId === activeItem.stage);
  const journey = state?.snapshot.journey ?? null;
  const selectedDirection = journey?.directions.find((item) => item.directionId === selectedDirectionId) ?? journey?.directions.find((item) => item.recommended) ?? null;
  const selectedArtifact = selectedDirection?.selectionArtifact ?? null;
  const activeDomain = domainId === "CUSTOM" ? createCustomDomain(customDomain || "自訂研究領域") : createBuiltinDomain(domainId);
  const imported = Boolean(chatPreview && state?.snapshot.chatInsights.some((item) => item.hash === chatPreview.hash));
  const chatReconcile = Boolean(chatPreview && state?.snapshot.timeline.some((event) => event.operation === "IMPORT_CHAT_INSIGHT" && event.payloadHash === chatPreview.hash && event.completionClass === "UNKNOWN"));
  const canonicalWholeDraft = selectedArtifact?.humanDraft.humanDraft ?? "";
  const selectedGateHash = selectedDirection && selectedArtifact && beta1CanonicalJson(s0Draft) === beta1CanonicalJson(selectedDirection.s0) && draftText === canonicalWholeDraft ? selectedArtifact.humanGateHash : null;
  const observationCandidates = useMemo(() => entryMode === "PARTIAL_MATERIAL" ? deriveV2Beta1ObservationCandidates(requestMaterials()) : [], [entryMode, materials]);
  const observationReviewComplete = observationCandidates.every((candidate) => ["CONFIRMED", "CORRECTED", "EXCLUDED"].includes(observationDecisions[candidate.candidateId] ?? "UNREVIEWED"));

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setBusy(true);
      try {
        const response = await fetch("/api/v2-beta1/project", { headers: { "x-old-mike-v2-workspace": WORKSPACE_AUTHORITY }, cache: "no-store", signal: controller.signal });
        const raw = await response.json(); const payload = parseV2Beta1GetResponse(raw);
        if (response.status !== 200 || !payload) throw new Error("snapshot_contract_invalid");
        setState({ snapshot: payload.snapshot, previewInsight: payload.previewInsight });
        const selected = payload.snapshot.journey?.directions.find((item) => item.recommended) ?? null;
        setSelectedDirectionId(selected?.directionId ?? ""); setS0Draft(selected ? { ...selected.s0 } : {});
        setAnnouncement(`專案已載入，目前版本 ${payload.snapshot.revision}。`);
      } catch (caught) {
        if (!controller.signal.aborted) { setError(caught instanceof Error && caught.message === "snapshot_contract_invalid" ? "專案資料格式未通過檢查，現有畫面沒有被覆寫。" : "目前無法載入專案，內容沒有變更。"); setAnnouncement("專案載入失敗，內容沒有變更。"); }
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void load(); return () => controller.abort();
  }, []);

  useEffect(() => { if (mobilePanel === "NAV") navPanel.current?.focus(); if (mobilePanel === "CHAT") chatPanel.current?.focus(); }, [mobilePanel]);
  useEffect(() => { function close(event: KeyboardEvent) { if (event.key === "Escape" && mobilePanel !== "CONTENT") { setMobilePanel("CONTENT"); activeMobileTrigger.current?.focus(); } } document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close); }, [mobilePanel]);
  useEffect(() => { if (focusJourneyResult.current && selectedDirection) { focusJourneyResult.current = false; resultHeading.current?.focus(); } }, [selectedDirection]);

  function explicitJourneyEdit() { setJourneyIdentity(null); setObservationDecisions({}); setObservationCorrections({}); if (journeyStopped) setJourneyStopped(false); setError(""); setConfirmedGateHash(null); }
  function decideObservation(candidate: V2Beta1ObservationCandidate, decision: ObservationDecision) {
    setObservationDecisions((current) => ({ ...current, [candidate.candidateId]: decision }));
    if (decision === "CORRECTING") setObservationCorrections((current) => ({ ...current, [candidate.candidateId]: current[candidate.candidateId] ?? correctionFor(candidate) }));
    setJourneyIdentity(null); setError(""); setConfirmedGateHash(null);
  }
  function updateObservationCorrection(candidateId: string, patch: Partial<ObservationCorrection>) {
    const candidate = observationCandidates.find((item) => item.candidateId === candidateId); if (!candidate) return;
    setObservationCorrections((current) => ({ ...current, [candidateId]: { ...(current[candidateId] ?? correctionFor(candidate)), ...patch } }));
    setObservationDecisions((current) => ({ ...current, [candidateId]: "CORRECTING" }));
    setJourneyIdentity(null); setError(""); setConfirmedGateHash(null);
  }
  function confirmObservationCorrection(candidate: V2Beta1ObservationCandidate) {
    try {
      const record = observationRecordFor(candidate, "CORRECTED");
      const authorityMaterials = requestMaterials().map((material) => ({ ...material, contentHash: beta1Hash(material.content), evidenceState: "OBSERVED" as const }));
      parseV2Beta1TypedObservationRecord(record, authorityMaterials);
      setObservationDecisions((current) => ({ ...current, [candidate.candidateId]: "CORRECTED" }));
      setJourneyIdentity(null); setError(""); setConfirmedGateHash(null);
      setAnnouncement(`觀察候選 ${candidate.candidateId} 的目前修正值已由本機使用者明確確認；這不是外部獨立驗證。`);
    } catch {
      setObservationDecisions((current) => ({ ...current, [candidate.candidateId]: "CORRECTING" }));
      setError("修正值尚未通過逐欄型別、數值與來源定位檢查，尚未確認。");
      setAnnouncement("觀察候選修正值尚未確認，研究旅程仍停用。");
    }
  }
  function showInsight() {
    if (!state?.previewInsight || chatInput.trim().length < 2) return;
    const next = createChatPreview(state.previewInsight, chatInput, activeDomain.label); setChatPreview(next); setImportIdentity(null); setChatStopped(false);
    setAnnouncement("老麥已依你的對話整理洞見；請預覽後選擇匯入或發展成研究方向。");
  }
  function promoteChat() {
    if (!chatPreview) return; setEntryMode("CHAT_INSIGHT"); setResearchDirection(chatPreview.researchQuestion); setMobilePanel("CONTENT"); setSelectedNav("start"); explicitJourneyEdit();
    setAnnouncement("洞見已帶入研究入口；按一次主要動作即可建立三個方向。");
    queueMicrotask(() => resultHeading.current?.focus());
  }

  async function importInsight() {
    if (!state || !chatPreview || imported || chatStopped || chatReconcile) return;
    const payloadCore = { projectId: state.snapshot.projectId, baseRevision: state.snapshot.revision, baseContentHash: state.snapshot.contentHash, insight: chatPreview };
    const payloadHash = beta1Hash(payloadCore); const identity = importIdentity?.payloadHash === payloadHash ? importIdentity : { payloadHash, requestId: `beta1-import:${crypto.randomUUID()}`, idempotencyKey: `beta1-import-key:${crypto.randomUUID()}` };
    setImportIdentity(identity); setBusy(true); setError(""); let terminalBeforeEffect = false;
    try {
      const request = { contractVersion: CONTRACT_VERSION, operation: "IMPORT_CHAT_INSIGHT", requestId: identity.requestId, idempotencyKey: identity.idempotencyKey, ...payloadCore } satisfies V2Beta1ImportChatInsightRequest;
      const response = await fetch("/api/v2-beta1/project", { method: "POST", headers: { "content-type": "application/json", "x-old-mike-v2-workspace": WORKSPACE_AUTHORITY }, body: JSON.stringify(request) });
      const raw = await response.json(); terminalBeforeEffect = [400, 403, 409, 413].includes(response.status); const parsed = parseV2Beta1PostResponse(raw, { trustedScope: V2_BETA1_LOCAL_TRUSTED_SCOPE, previousSnapshot: state.snapshot, submittedRequest: request });
      if (response.status !== 200 || !parsed) throw new Error(response.status === 503 ? "completion_unknown" : "import_contract_invalid");
      setState({ snapshot: parsed.snapshot, previewInsight: state.previewInsight }); setImportIdentity(null); setAnnouncement("洞見已匯入目前專案，時間線新增一筆事件。"); queueMicrotask(() => resultHeading.current?.focus());
    } catch (caught) {
      const uncertain = !terminalBeforeEffect; setChatStopped(uncertain); setError(uncertain ? "結果尚未確認，系統不會自動重送；洞見與目前專案均已保留。" : "洞見未能匯入；修正內容後可開始新的明確動作。"); setAnnouncement(uncertain ? "匯入結果待核對，沒有自動重送。" : "匯入在送出效果前被拒絕，現有內容已保留。");
    } finally { setBusy(false); }
  }

  function requestMaterials() {
    return entryMode === "PARTIAL_MATERIAL" ? materials.map((item, index) => ({ materialId: `material-user-${String(index + 1).padStart(3, "0")}`, kind: item.kind, title: item.title, content: item.content })) : [];
  }
  function observationRecordFor(candidate: V2Beta1ObservationCandidate, decision: ObservationDecision): V2Beta1TypedObservationRecord | null {
    if (decision === "EXCLUDED") return null;
    if (decision === "CONFIRMED") {
      if (!candidate.suggestedRecord) throw new Error("beta1_observation_candidate_incomplete");
      return createV2Beta1TypedObservationRecord(candidate.suggestedRecord);
    }
    if (decision !== "CORRECTED") throw new Error("beta1_observation_decision_incomplete");
    const draft = observationCorrections[candidate.candidateId] ?? correctionFor(candidate);
    const citation = draft.citationKind === "OWN_DATA"
      ? { kind: "OWN_DATA" as const, materialId: candidate.materialId, startByte: candidate.startByte, endByte: candidate.endByte, spanHash: candidate.spanHash }
      : candidate.suggestedRecord?.citation.kind === "LITERATURE" && candidate.suggestedRecord.citation.identityKind === draft.identityKind && candidate.suggestedRecord.citation.identity === draft.identity ? candidate.suggestedRecord.citation : (() => { throw new Error("beta1_observation_citation_locator_required"); })();
    return createV2Beta1TypedObservationRecord({ materialId: candidate.materialId, materialContentHash: candidate.materialContentHash, startByte: candidate.startByte, endByte: candidate.endByte, spanHash: candidate.spanHash, metricId: draft.metricId, cohortId: draft.cohortId, timepoint: draft.timepoint, analysisId: draft.analysisId, effectId: draft.effectId, estimate: draft.estimate, unit: draft.unit, direction: draft.direction, sampleSize: Number(draft.sampleSize), pComparator: draft.pComparator, pValue: draft.pValue, ci95Lower: draft.ci95Lower, ci95Upper: draft.ci95Upper, citation, resultState: "OBSERVED", assertion: "AFFIRMED", inference: "ASSOCIATION_ONLY", rendererVersion: V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION });
  }
  async function runJourney() {
    if (!state || researchDirection.trim().length < 2 || journeyStopped || (domainId === "CUSTOM" && !customDomain.trim())) return;
    const selectedMaterials = requestMaterials();
    if (selectedMaterials.some((item) => !item.title.trim() || !item.content.trim() || bytes(item.content) > V2_BETA1_MATERIAL_CONTENT_MAX_BYTES) || selectedMaterials.reduce((sum, item) => sum + bytes(item.content), 0) > V2_BETA1_MATERIAL_TOTAL_MAX_BYTES) { setError("材料超過 UTF-8 位元組上限或仍有空白欄位；原始草稿已保留。"); setAnnouncement("材料尚未通過大小與完整性檢查。"); return; }
    let observationConfirmation: V2Beta1JourneyRequest["observationConfirmation"] = null;
    try {
      if (!observationReviewComplete) throw new Error("beta1_observation_review_incomplete");
      if (entryMode === "PARTIAL_MATERIAL" && observationCandidates.length) {
        const records = observationCandidates.map((candidate) => observationRecordFor(candidate, observationDecisions[candidate.candidateId] ?? "UNREVIEWED")).filter((record): record is V2Beta1TypedObservationRecord => record !== null);
        const recordByCandidate = new Map(observationCandidates.map((candidate) => { const decision = observationDecisions[candidate.candidateId] ?? "UNREVIEWED"; return [candidate.candidateId, observationRecordFor(candidate, decision)]; }));
        const decisions = observationCandidates.map((candidate) => { const decision = observationDecisions[candidate.candidateId] ?? "UNREVIEWED"; const record = recordByCandidate.get(candidate.candidateId); return { candidateId: candidate.candidateId, decision: decision === "EXCLUDED" ? "EXCLUDED" as const : decision === "CONFIRMED" ? "CONFIRMED" as const : "CORRECTED" as const, recordHash: record?.recordHash ?? null }; });
        observationConfirmation = createV2Beta1ObservationConfirmationAuthority({ projectId: state.snapshot.projectId, baseRevision: state.snapshot.revision, baseContentHash: state.snapshot.contentHash, outputTarget, researchDirection: researchDirection.replace(/\r\n?/gu, "\n").trim(), researchDomainHash: activeDomain.selectionHash, trustedScope: V2_BETA1_LOCAL_TRUSTED_SCOPE, materials: selectedMaterials }, decisions, records);
      }
    } catch { setError("每筆觀察候選都必須確認、修正或排除；修正值也必須能由顯示的原始位元組逐項核對。"); setAnnouncement("觀察候選尚未完成明確審查，沒有送出請求。"); return; }
    const payloadCore = { projectId: state.snapshot.projectId, baseRevision: state.snapshot.revision, baseContentHash: state.snapshot.contentHash, entryMode, outputTarget, researchDirection: researchDirection.replace(/\r\n?/gu, "\n").trim(), researchDomain: activeDomain, materials: selectedMaterials, observationConfirmation };
    const payloadHash = beta1Hash(payloadCore); const identity = journeyIdentity?.payloadHash === payloadHash ? journeyIdentity : { payloadHash, requestId: `beta1-journey:${crypto.randomUUID()}`, idempotencyKey: `beta1-journey-key:${crypto.randomUUID()}` };
    const request = { contractVersion: CONTRACT_VERSION, operation: "RUN_RESEARCH_JOURNEY", requestId: identity.requestId, idempotencyKey: identity.idempotencyKey, ...payloadCore } satisfies V2Beta1JourneyRequest;
    const body = JSON.stringify(request);
    if (bytes(body) > V2_BETA1_REQUEST_MAX_BYTES) { setError("整體請求超過位元組上限；請分批整理材料，原始草稿已保留。"); return; }
    setJourneyIdentity(identity); setBusy(true); setError(""); let terminalBeforeEffect = false;
    try {
      const response = await fetch("/api/v2-beta1/project", { method: "POST", headers: { "content-type": "application/json", "x-old-mike-v2-workspace": WORKSPACE_AUTHORITY }, body });
      const raw = await response.json(); terminalBeforeEffect = [400, 403, 409, 413].includes(response.status); const parsed = parseV2Beta1PostResponse(raw, { trustedScope: V2_BETA1_LOCAL_TRUSTED_SCOPE, previousSnapshot: state.snapshot, submittedRequest: request });
      if (response.status !== 200 || !parsed?.snapshot.journey) throw new Error(response.status === 503 ? "completion_unknown" : "journey_contract_invalid");
      const selected = parsed.snapshot.journey.directions.find((item) => item.recommended)!;
      focusJourneyResult.current = true; setState({ snapshot: parsed.snapshot, previewInsight: state.previewInsight }); setSelectedDirectionId(selected.directionId); setS0Draft({ ...selected.s0 }); setS0Undo({}); setDraftText(""); setUndoText(null); setJourneyIdentity(null); setConfirmedGateHash(null); setObservationDecisions({}); setObservationCorrections({});
      setAnnouncement("完整研究旅程已加入同一份專案真相；三張卡可在本機切換，不會增加效果。");
    } catch {
      const uncertain = !terminalBeforeEffect; setJourneyStopped(uncertain); setError(uncertain ? "結果尚未確認，系統不會自動重送；原始輸入與最後可信成果已保留。" : "研究旅程在效果前被拒絕；修正內容即可開始新的明確動作。"); setAnnouncement(uncertain ? "研究旅程待核對，沒有自動重送。" : "研究旅程未送出效果，草稿已保留。");
    } finally { setBusy(false); }
  }

  function selectDirection(direction: V2Beta1Journey["directions"][number]) {
    setSelectedDirectionId(direction.directionId); setS0Draft({ ...direction.s0 }); setS0Undo({}); setDraftText(""); setUndoText(null); setConfirmedGateHash(null);
    setAnnouncement(`已在本機切換為「${direction.title}」；沒有新增效果。`);
  }
  function applyJourneyDraft() { if (!selectedDirection) return; setUndoText(draftText); setDraftText(canonicalWholeDraft); setConfirmedGateHash(null); setAnnouncement("已套用含來源、13 欄、審查、修訂、證據與工作包的整份成果；尚未正式寫入，可完整復原。"); }
  function undoJourneyDraft() { if (undoText === null) return; setDraftText(undoText); setUndoText(null); setConfirmedGateHash(null); setAnnouncement("已逐位元組復原套用前的本機草稿；如需確認，必須再次明確確認。"); }
  function applyAssist(field: typeof S0_FIELDS[number], applyValue: string) { setS0Undo((current) => ({ ...current, [field]: s0Draft[field] })); setS0Draft((current) => ({ ...current, [field]: applyValue })); setConfirmedGateHash(null); setAnnouncement(field === "domain" || field === "outputTrack" ? `${S0_LABELS[field]}為權威欄位；老麥建議已保留，但沒有改變本次權威。` : `${S0_LABELS[field]}已套用至本機預覽；整份成果須更新或復原後才能重新確認。`); }
  function undoAssist(field: typeof S0_FIELDS[number]) { const prior = s0Undo[field]; if (prior === undefined) return; setS0Draft((current) => ({ ...current, [field]: prior })); setS0Undo((current) => { const next = { ...current }; delete next[field]; return next; }); setConfirmedGateHash(null); setAnnouncement(`${S0_LABELS[field]}已逐位元組復原；整份成果仍須再次明確確認。`); }

  return (
    <div className={styles.app} data-testid="beta1-research-os" data-formal-write-count={state?.snapshot.formalResearchWriteCount ?? 0} data-live-provider-call-count="0">
      <a className={styles.skipLink} href="#beta1-main">跳至主要內容</a>
      <header className={styles.topbar}><div className={styles.wordmark}><span>老麥</span><strong>研究作業系統</strong></div><div className={styles.projectMeta}><span>{state?.snapshot.focusDomain.label ?? "專案載入中"}</span><strong data-testid="beta1-revision">{state ? `版本 ${state.snapshot.revision}` : "—"}</strong></div></header>
      <div className={styles.workspace}>
        <nav ref={navPanel} tabIndex={-1} id="beta1-nav-panel" aria-label="研究工作區" className={`${styles.sidebar} ${mobilePanel === "NAV" ? styles.mobileOpen : styles.mobileHidden}`}>
          <p className={styles.navEyebrow}>專案六站</p><ul>{NAV_ITEMS.map((item, index) => { const status = state?.snapshot.stages.find((stage) => stage.stageId === item.stage)?.status ?? "PENDING"; return <li key={item.id}><button type="button" className={selectedNav === item.id ? styles.navActive : ""} aria-current={selectedNav === item.id ? "page" : undefined} onClick={() => { setSelectedNav(item.id); setMobilePanel("CONTENT"); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><small>{stageLabel(status)}</small></button></li>; })}</ul>
          <div className={styles.identity}><span aria-hidden="true">研</span><div><strong>研究者</strong><small>本機專案工作區</small></div></div>
        </nav>
        <main id="beta1-main" className={`${styles.main} ${mobilePanel === "CONTENT" ? styles.mobileOpen : styles.mobileHidden}`}>
          <section className={styles.hero} aria-labelledby="beta1-title"><p className={styles.eyebrow}>同一份專案真相</p><h1 id="beta1-title">{activeItem.label}</h1><p>{activeItem.description}</p><div className={styles.stagePill}><span>{activeStage ? stageLabel(activeStage.status) : "待載入"}</span><strong>{state ? "13 欄完整研究摘要" : "載入中"}</strong></div></section>
          {busy && !state ? <p className={styles.loading} role="status">正在準備研究工作區…</p> : null}{error ? <p className={styles.error} role="alert">{error}</p> : null}
          {state ? <>
            {selectedNav === "start" ? <section className={styles.startCard} aria-labelledby="journey-start-heading">
              <div className={styles.sectionHead}><div><p className={styles.eyebrow}>一個入口，完整續作</p><h2 id="journey-start-heading">建立研究旅程</h2></div><span>一次明確動作</span></div>
              <fieldset className={styles.choiceGroup}><legend>從哪裡開始？</legend>{(["KEYWORD", "CHAT_INSIGHT", "PARTIAL_MATERIAL"] as EntryMode[]).map((mode) => <label key={mode}><input type="radio" name="entry-mode" checked={entryMode === mode} onChange={() => { setEntryMode(mode); explicitJourneyEdit(); }} /> {mode === "KEYWORD" ? "關鍵字或短方向" : mode === "CHAT_INSIGHT" ? "老麥洞見" : "多份既有材料"}</label>)}</fieldset>
              <div className={styles.formGrid}>
                <label>本次研究重心<select data-testid="beta1-domain" value={domainId} onChange={(event) => { setDomainId(event.target.value); explicitJourneyEdit(); }}>{BUILTIN_DOMAINS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}<option value="CUSTOM">我的自訂領域</option></select></label>
                <label>成果路徑<select data-testid="beta1-output-target" value={outputTarget} onChange={(event) => { setOutputTarget(event.target.value as OutputTarget); explicitJourneyEdit(); }}><option value="SCI">SCI／SCIE 期刊</option><option value="SSCI">SSCI 期刊</option><option value="NSTC">國科會研究計畫</option><option value="MOE">教育部教學實踐</option></select></label>
              </div>
              {domainId === "CUSTOM" ? <label className={styles.inputLabel}>自訂研究領域<input data-testid="beta1-custom-domain" value={customDomain} onChange={(event) => { setCustomDomain(event.target.value); explicitJourneyEdit(); }} maxLength={120} /></label> : null}
              <label className={styles.inputLabel} htmlFor="beta1-research-direction">研究關鍵字或短方向</label><textarea id="beta1-research-direction" data-testid="beta1-research-input" value={researchDirection} onChange={(event) => { setResearchDirection(event.target.value); explicitJourneyEdit(); }} rows={3} maxLength={1_600} />
              {entryMode === "PARTIAL_MATERIAL" ? <div className={styles.materialStack} data-testid="beta1-materials"><div className={styles.sectionHead}><h3>按原順序加入材料</h3><button type="button" disabled={materials.length >= V2_BETA1_MATERIAL_MAX_COUNT} onClick={() => { setMaterials((current) => [...current, newMaterial(current.length)]); explicitJourneyEdit(); }}>新增材料</button></div>{materials.map((material, index) => <fieldset key={material.localId} className={styles.materialCard} data-testid={`beta1-material-${index}`}><legend>材料 {index + 1}</legend><div className={styles.formGrid}><label>類型<select data-testid={`beta1-material-kind-${index}`} value={material.kind} onChange={(event) => { setMaterials((current) => current.map((item) => item.localId === material.localId ? { ...item, kind: event.target.value as MaterialKind } : item)); explicitJourneyEdit(); }}>{MATERIAL_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>標題<input data-testid={`beta1-material-title-${index}`} value={material.title} onChange={(event) => { setMaterials((current) => current.map((item) => item.localId === material.localId ? { ...item, title: event.target.value } : item)); explicitJourneyEdit(); }} maxLength={240} /></label></div><label>原始內容<textarea data-testid={`beta1-material-content-${index}`} value={material.content} onChange={(event) => { setMaterials((current) => current.map((item) => item.localId === material.localId ? { ...item, content: event.target.value } : item)); explicitJourneyEdit(); }} rows={5} /></label><p>{bytes(material.content).toLocaleString()} / {V2_BETA1_MATERIAL_CONTENT_MAX_BYTES.toLocaleString()} bytes</p>{materials.length > 1 ? <button type="button" onClick={() => { setMaterials((current) => current.filter((item) => item.localId !== material.localId)); explicitJourneyEdit(); }}>移除此材料</button> : null}</fieldset>)}</div> : null}
              {entryMode === "PARTIAL_MATERIAL" && observationCandidates.length ? <section className={styles.observationReview} aria-labelledby="beta1-observation-review-heading" data-testid="beta1-observation-review"><div><p className={styles.eyebrow}>明確使用者確認</p><h3 id="beta1-observation-review-heading">逐筆審查觀察候選</h3><p>候選只是不具權威的建議。每筆都要確認、修正或排除，才會隨同一次研究旅程 POST 送出。</p></div>{observationCandidates.map((candidate, index) => { const decision = observationDecisions[candidate.candidateId] ?? "UNREVIEWED"; const draft = observationCorrections[candidate.candidateId] ?? correctionFor(candidate); const suggested = candidate.suggestedRecord; return <fieldset key={candidate.candidateId} className={styles.observationCard} data-testid={`beta1-observation-candidate-${index}`}><legend>觀察候選 {index + 1} · UNCONFIRMED_ADVISORY</legend><blockquote>{candidate.rawExcerpt}</blockquote><dl className={styles.observationMeta}><div><dt>材料</dt><dd>{candidate.materialId}</dd></div><div><dt>材料雜湊</dt><dd>{candidate.materialContentHash}</dd></div><div><dt>UTF-8 位元組範圍</dt><dd>{candidate.startByte}–{candidate.endByte}</dd></div><div><dt>片段雜湊</dt><dd>{candidate.spanHash}</dd></div><div><dt>指標／群組／時間／分析</dt><dd>{suggested ? `${suggested.metricId} / ${suggested.cohortId} / ${suggested.timepoint} / ${suggested.analysisId}` : "待明確修正或排除"}</dd></div><div><dt>效果／估計／單位／方向</dt><dd>{suggested ? `${suggested.effectId} / ${suggested.estimate} ${suggested.unit} / ${suggested.direction}` : "待明確修正或排除"}</dd></div><div><dt>N／p／95% CI</dt><dd>{suggested ? `${suggested.sampleSize} / p ${suggested.pComparator} ${suggested.pValue} / [${suggested.ci95Lower}, ${suggested.ci95Upper}]` : "待明確修正或排除"}</dd></div><div><dt>來源身分</dt><dd>{suggested ? suggested.citation.kind === "OWN_DATA" ? "OWN_DATA" : `${suggested.citation.identityKind}: ${suggested.citation.identity}` : "待明確修正或排除"}</dd></div><div><dt>斷言界線</dt><dd>OBSERVED · AFFIRMED · ASSOCIATION_ONLY</dd></div></dl><div className={styles.choiceGroup}><label><input data-testid={`beta1-observation-confirm-${index}`} type="radio" name={`observation-${index}`} checked={decision === "CONFIRMED"} disabled={!suggested} onChange={() => decideObservation(candidate, "CONFIRMED")} /> 確認顯示值</label><label><input data-testid={`beta1-observation-correct-${index}`} type="radio" name={`observation-${index}`} checked={decision === "CORRECTING" || decision === "CORRECTED"} onChange={() => decideObservation(candidate, "CORRECTING")} /> 修正後確認</label><label><input data-testid={`beta1-observation-exclude-${index}`} type="radio" name={`observation-${index}`} checked={decision === "EXCLUDED"} onChange={() => decideObservation(candidate, "EXCLUDED")} /> 排除</label></div>{decision === "CORRECTING" || decision === "CORRECTED" ? <div className={styles.correctionGrid} data-testid={`beta1-observation-correction-${index}`}><label>metricId<input value={draft.metricId} onChange={(event) => updateObservationCorrection(candidate.candidateId, { metricId: event.target.value })} /></label><label>cohortId<input value={draft.cohortId} onChange={(event) => updateObservationCorrection(candidate.candidateId, { cohortId: event.target.value })} /></label><label>timepoint<input value={draft.timepoint} onChange={(event) => updateObservationCorrection(candidate.candidateId, { timepoint: event.target.value })} /></label><label>analysisId<input value={draft.analysisId} onChange={(event) => updateObservationCorrection(candidate.candidateId, { analysisId: event.target.value })} /></label><label>effectId<input value={draft.effectId} onChange={(event) => updateObservationCorrection(candidate.candidateId, { effectId: event.target.value })} /></label><label>估計值<input value={draft.estimate} onChange={(event) => updateObservationCorrection(candidate.candidateId, { estimate: event.target.value })} /></label><label>單位<input value={draft.unit} onChange={(event) => updateObservationCorrection(candidate.candidateId, { unit: event.target.value })} /></label><label>方向<select value={draft.direction} onChange={(event) => updateObservationCorrection(candidate.candidateId, { direction: event.target.value as ObservationCorrection["direction"] })}><option value="NEGATIVE">NEGATIVE</option><option value="ZERO">ZERO</option><option value="POSITIVE">POSITIVE</option></select></label><label>樣本 N<input inputMode="numeric" value={draft.sampleSize} onChange={(event) => updateObservationCorrection(candidate.candidateId, { sampleSize: event.target.value })} /></label><label>p 比較子<select value={draft.pComparator} onChange={(event) => updateObservationCorrection(candidate.candidateId, { pComparator: event.target.value as ObservationCorrection["pComparator"] })}><option value="<">&lt;</option><option value="<=">≤</option><option value="=">=</option><option value=">=">≥</option><option value=">">&gt;</option></select></label><label>p 值<input value={draft.pValue} onChange={(event) => updateObservationCorrection(candidate.candidateId, { pValue: event.target.value })} /></label><label>CI 下界<input value={draft.ci95Lower} onChange={(event) => updateObservationCorrection(candidate.candidateId, { ci95Lower: event.target.value })} /></label><label>CI 上界<input value={draft.ci95Upper} onChange={(event) => updateObservationCorrection(candidate.candidateId, { ci95Upper: event.target.value })} /></label><label>來源類型<select value={draft.citationKind} onChange={(event) => updateObservationCorrection(candidate.candidateId, { citationKind: event.target.value as ObservationCorrection["citationKind"] })}><option value="OWN_DATA">OWN_DATA</option><option value="LITERATURE">LITERATURE</option></select></label>{draft.citationKind === "LITERATURE" ? <><label>文獻身分類型<select value={draft.identityKind} onChange={(event) => updateObservationCorrection(candidate.candidateId, { identityKind: event.target.value as ObservationCorrection["identityKind"] })}><option value="DOI">DOI</option><option value="ARXIV">ARXIV</option><option value="AUTHOR_YEAR_TITLE">AUTHOR_YEAR_TITLE</option></select></label><label>文獻身分<input value={draft.identity} onChange={(event) => updateObservationCorrection(candidate.candidateId, { identity: event.target.value })} /></label></> : null}<button type="button" data-testid={`beta1-observation-confirm-correction-${index}`} disabled={decision === "CORRECTED"} onClick={() => confirmObservationCorrection(candidate)}>{decision === "CORRECTED" ? "目前修正值已確認" : "明確確認目前修正值"}</button></div> : null}</fieldset>; })}</section> : null}
              <p className={styles.inputHint}>材料按順序與位元組保留；觀察結果、未知與規劃內容分開呈現。切換方向不會再次送出。</p>
              {journeyStopped ? <p role="status" data-testid="beta1-reconcile-notice">目前動作結果待核對；不提供重送。請保留此畫面查看目前進度，或變更輸入開始明確的新動作。</p> : null}
              <button data-testid="beta1-run-journey" className={styles.primaryAction} type="button" disabled={busy || journeyStopped || researchDirection.trim().length < 2 || (domainId === "CUSTOM" && !customDomain.trim()) || !observationReviewComplete} onClick={() => void runJourney()}>{busy ? "老麥正在整理…" : "老麥建立三個方向與完整研究藍圖"}</button>
            </section> : null}

            {journey && selectedDirection ? <section className={styles.journeyCard} aria-labelledby="directions-heading" data-testid="beta1-journey-artifact">
              <div className={styles.sectionHead}><div><p className={styles.eyebrow}>三個專業方向</p><h2 ref={resultHeading} tabIndex={-1} id="directions-heading">比較並完成成果</h2></div><span>{journey.kind === "JOURNAL" ? "期刊終審" : "臺灣計畫總審"}</span></div>
              <p className={styles.inputHint}>每張卡都有完整 13 欄與成果預覽；切換只改變本機選擇，效果數維持不變。</p>
              <ul className={styles.directionGrid}>{journey.directions.map((item) => <li key={item.directionId}><button type="button" data-testid={`beta1-direction-${item.lane}`} aria-pressed={selectedDirection.directionId === item.directionId} onClick={() => selectDirection(item)}><span>{DIRECTION_LABELS[item.lane]}{item.recommended ? " · 推薦" : ""}</span><strong>{item.title}</strong><small>{item.researchQuestion}</small></button></li>)}</ul>
              <article className={styles.directionDetail} data-testid="beta1-selected-direction" data-whole-artifact-hash={selectedArtifact?.wholeArtifactHash} data-human-gate-hash={selectedArtifact?.humanGateHash}><h3>{selectedDirection.title}</h3><dl><div><dt>研究問題</dt><dd>{selectedDirection.researchQuestion}</dd></div><div><dt>作用機制</dt><dd>{selectedDirection.mechanism}</dd></div><div><dt>方法</dt><dd>{selectedDirection.method}</dd></div><div><dt>預期貢獻</dt><dd>{selectedDirection.contribution}</dd></div></dl></article>
              <details className={styles.assistPanel} open><summary>13 欄老麥三案協作</summary>{S0_FIELDS.map((field) => <article key={field} data-testid={`beta1-assist-${field}`}><div><h3>{S0_LABELS[field]}</h3><p>{s0Draft[field] ?? selectedDirection.s0[field]}</p>{s0Undo[field] !== undefined ? <button type="button" onClick={() => undoAssist(field)}>復原此欄</button> : null}</div><ul>{selectedDirection.fieldAssist[field].map((option) => <li key={option.optionId} data-testid="beta1-assist-option"><strong>{STRATEGY_LABELS[option.strategy]}</strong><p data-testid="beta1-assist-text">{option.text}</p><ReviewRationaleRisk rationale={option.rationale} risk={option.risk} /><button type="button" onClick={() => applyAssist(field, option.applyValue)}>{field === "domain" || field === "outputTrack" ? "保留為權威建議" : "套用至預覽"}</button></li>)}</ul></article>)}</details>
              <div className={styles.artifactGrid}><article><h3>證據與缺口</h3><ul>{selectedArtifact?.evidenceGapMap.map((item) => <li key={item.gapId}><strong>{item.state === "OBSERVED" ? "已觀察" : item.state === "CONFLICT" ? "有衝突" : item.state === "MISSING" ? "缺少" : "待驗證"}</strong>{item.statement}</li>)}</ul></article><article><h3>分析工作包</h3><ul>{selectedArtifact?.analysisWorkPackages.map((item) => <li key={item.workPackageId}><strong>{item.title}</strong>{item.objective}</li>)}</ul></article></div>
              <article className={styles.finalArtifact}><h3>{selectedDirection.preview.title}</h3><ol className={styles.sectionList}>{Object.entries(selectedDirection.preview.sections).map(([section, text]) => <li key={section}><strong>{SECTION_LABELS[section] ?? "成果段落"}</strong><p>{text}</p></li>)}</ol></article>
              {selectedArtifact?.journal ? <section className={styles.reviewPanel} data-testid="beta1-journal-review"><h3>期刊終審：來源與建議稿</h3><p>{selectedArtifact.journal.publicationUsable ? "內容已具備出版可用完整性，仍須通過人工關卡。" : "目前仍有缺少、矛盾或待驗證內容，不得標示為出版可用終稿。"}</p>{selectedArtifact.journal.priorityFindings.map((finding) => <article key={finding.findingId}><h4>{finding.title}</h4><p>{finding.reason}</p><ul>{finding.revisions.map((revision) => <li key={revision.revisionId} data-testid="beta1-journal-revision"><strong>{STRATEGY_LABELS[revision.strategy]}</strong><p>{revision.text}</p><ReviewRationaleRisk rationale={revision.rationale} risk={revision.risk} /></li>)}</ul></article>)}</section> : null}
              {selectedArtifact?.taiwanProposal ? <section className={styles.reviewPanel} data-testid="beta1-taiwan-review"><h3>臺灣計畫完整總審</h3><dl>{Object.entries(selectedArtifact.taiwanProposal.narrativeSections).map(([key, value]) => <div key={key}><dt>{PROPOSAL_SECTION_LABELS[key] ?? "計畫內容"}</dt><dd>{value}</dd></div>)}</dl><p>規劃預算 {selectedArtifact.taiwanProposal.budget.totalTwd.toLocaleString()} 元，僅為本機合成未驗證；官方規則未知或可能過期。</p>{selectedArtifact.taiwanProposal.priorityFindings.map((finding) => <article key={finding.findingId}><h4>{finding.title}</h4><p>{finding.reason}</p><ul>{finding.revisions.map((revision) => <li key={revision.revisionId}><strong>{STRATEGY_LABELS[revision.strategy]}</strong><p>{revision.text}</p></li>)}</ul></article>)}</section> : null}
              {selectedArtifact ? <article className={styles.finalArtifact} data-testid="beta1-human-draft"><h3>整份人讀成果草稿</h3><pre className={styles.humanDraft} tabIndex={0} aria-label="整份人讀成果草稿內容">{selectedArtifact.humanDraft.humanDraft}</pre></article> : null}
              <label className={styles.inputLabel} htmlFor="beta1-local-draft">整份成果本機草稿</label><textarea id="beta1-local-draft" data-testid="beta1-local-draft" value={draftText} onChange={(event) => { setDraftText(event.target.value); setConfirmedGateHash(null); }} rows={8} /><div className={styles.previewActions}><button type="button" data-testid="beta1-apply" onClick={applyJourneyDraft}>套用整份成果</button><button type="button" data-testid="beta1-undo" disabled={undoText === null} onClick={undoJourneyDraft}>完整復原</button></div>
              <div className={styles.humanGate} data-testid="beta1-human-gate"><strong>整體人工關卡</strong><p>只在最後確認來源、13 欄、審查、修訂、證據、工作包與附件的整份成果；正式研究寫入仍為 0。</p><button type="button" data-testid="beta1-confirm-gate" disabled={!selectedGateHash} onClick={() => { if (selectedGateHash) { setConfirmedGateHash(selectedGateHash); setAnnouncement("整份成果已依伺服器核發的完整成果雜湊確認；正式寫入與外部送出仍未啟用。"); } }}>{confirmedGateHash && confirmedGateHash === selectedGateHash ? "已確認整份本機成果" : selectedGateHash ? "確認整份成果預覽" : "請先套用或復原為完整成果"}</button></div>
            </section> : null}

            <section className={styles.truthCard} aria-labelledby="truth-heading"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>專案真相</p><h2 id="truth-heading">同一份研究摘要</h2></div><span className={styles.zeroWrite}>正式寫入 0</span></div><h3>{state.snapshot.s0Summary.workingTitle}</h3><p className={styles.lead}>{state.snapshot.s0Summary.problemContext}</p><dl className={styles.truthGrid}>{S0_PROJECTION_FIELDS.map((key) => <div key={key}><dt>{S0_LABELS[key]}</dt><dd>{state.snapshot.s0Summary[key]}</dd></div>)}</dl><details className={styles.allFields}><summary>查看完整 13 欄研究摘要</summary><dl>{S0_FIELDS.map((key) => <div key={key}><dt>{S0_LABELS[key]}</dt><dd>{state.snapshot.s0Summary[key]}</dd></div>)}</dl></details></section>
            <section className={styles.timelineCard} aria-labelledby="timeline-heading"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>不可覆寫時間線</p><h2 id="timeline-heading">專案時間線</h2></div><span>{state.snapshot.timeline.length} 筆</span></div>{state.snapshot.timeline.length === 0 ? <p className={styles.empty}>尚無效果事件；所有內容先預覽，再由你決定是否加入。</p> : <ol className={styles.timeline}>{state.snapshot.timeline.map((event) => <li key={event.sequence}><span>{event.sequence}</span><div><strong>{event.eventType === "CHAT_INSIGHT_IMPORTED" ? "洞見已匯入專案" : event.eventType === "RESEARCH_JOURNEY_COMPLETED" ? "研究旅程已建立" : "結果待核對"}</strong><small>版本已更新；最後可信內容仍可讀取。</small></div></li>)}</ol>}</section>
          </> : null}
        </main>
        <aside ref={chatPanel} tabIndex={-1} id="beta1-chat-panel" aria-labelledby="chat-heading" className={`${styles.chat} ${mobilePanel === "CHAT" ? styles.mobileOpen : styles.mobileHidden}`}><div className={styles.chatHead}><div><span aria-hidden="true">麥</span><div><strong id="chat-heading">老麥</strong><small>隨專案同行</small></div></div><button className={styles.closeMobile} type="button" onClick={() => { setMobilePanel("CONTENT"); activeMobileTrigger.current?.focus(); }} aria-label="關閉老麥">×</button></div><div className={styles.messages}><article className={styles.mikeMessage}><p>告訴我你的想法。我會讓對話內容實際影響預覽；只有你的明確動作才會更新專案。</p></article>{chatPreview ? <article className={styles.insight} data-testid="beta1-insight-preview"><p className={styles.eyebrow}>洞見預覽 · 尚未匯入</p><h3>{chatPreview.title}</h3><p>{chatPreview.researchQuestion}</p><dl><div><dt>作用機制</dt><dd>{chatPreview.mechanism}</dd></div><div><dt>證據邊界</dt><dd>尚待正式證據核對</dd></div></dl>{chatReconcile || chatStopped ? <p role="status">先前結果仍待核對；不會重新送出。</p> : null}<button data-testid="beta1-import" className={styles.primary} type="button" disabled={busy || imported || chatStopped || chatReconcile} onClick={() => void importInsight()}>{imported ? "已匯入目前專案" : chatStopped || chatReconcile ? "查看目前進度" : "匯入目前專案"}</button><button data-testid="beta1-promote-chat" className={styles.secondary} type="button" onClick={promoteChat}>發展成三個研究方向</button></article> : null}</div><div className={styles.composer}><label htmlFor="beta1-chat-input">想請老麥整理什麼？</label><textarea id="beta1-chat-input" data-testid="beta1-chat-input" value={chatInput} onChange={(event) => { setChatInput(event.target.value); setChatStopped(false); setImportIdentity(null); }} rows={3} maxLength={500} /><button data-testid="beta1-preview" type="button" onClick={showInsight} disabled={!state?.previewInsight || chatInput.trim().length < 2}>整理成可匯入洞見</button></div></aside>
      </div>
      <nav className={styles.mobileDock} aria-label="行動版工作區切換"><button type="button" aria-controls="beta1-nav-panel" aria-expanded={mobilePanel === "NAV"} onClick={(event) => { activeMobileTrigger.current = event.currentTarget; setMobilePanel("NAV"); }}>功能</button><button type="button" aria-controls="beta1-main" aria-current={mobilePanel === "CONTENT" ? "page" : undefined} onClick={() => setMobilePanel("CONTENT")}>專案</button><button type="button" aria-controls="beta1-chat-panel" aria-expanded={mobilePanel === "CHAT"} onClick={(event) => { activeMobileTrigger.current = event.currentTarget; setMobilePanel("CHAT"); }}>老麥</button></nav>
      <p className={styles.live} role="status" aria-live="polite" aria-atomic="true" data-testid="beta1-live">{announcement}</p>
    </div>
  );
}
