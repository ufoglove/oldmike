"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { canonicalDomains, outputTrackIds, type CanonicalDomain, type OutputTrackId } from "@/lib/research-config";
import { RESEARCH_DIRECTION_MAX_LENGTH, RESEARCH_PLAN_LANES, type ResearchPlanLane, type ResearchSourceStrategy } from "@/lib/research-start-contract";
import type { TopicLabAnalysis, TopicLabCandidate } from "@/lib/topic-lab-contract";
import { OldMikeAssistGroupControl } from "./OldMikeAssistControl";

type TopicLabProviderState = "READY" | "EMPTY" | "DISABLED" | "TIMED_OUT" | "CANCELLED" | "RATE_LIMITED" | "UPSTREAM_ERROR" | "INVALID_RESPONSE";
type TopicLabSourceCapability = "NOT_REQUESTED" | "SCHOLARLY_DISABLED" | "SCHOLARLY_READY" | "SCHOLARLY_PARTIAL" | "SCHOLARLY_UNAVAILABLE" | "MANUAL_PUBLIC_HTTPS" | "MANUAL_DISABLED";

type TopicLabResponse = {
  ok?: boolean; code?: string; stage?: string; recoverableFields?: string[]; error?: string; sourceCapability?: string;
  providerStates?: Record<string, TopicLabProviderState>;
  runId?: string; versionNumber?: number; resultHash?: string; analysis?: TopicLabAnalysis;
  humanGateId?: string; promotionId?: string; studyVersionId?: string;
};

export type TopicLabInitialConditions = Partial<{
  researchDirection: string; domain: CanonicalDomain; outputTrack: OutputTrackId; professionalField: string;
  population: string; context: string; methodPreferences: string; time: string; data: string; ethics: string;
}>;

const LANE_LABELS: Record<ResearchPlanLane, string> = {
  CURRENT_PRACTICE_VALUE: "現行實務價值",
  EMERGING_FRONTIER: "新興前沿機制",
  HIGH_VALUE_GAP_OR_CONTRARIAN: "高價值缺口／反向邊界",
};
const SIGNAL_LABELS: Record<keyof TopicLabCandidate["signals"], string> = {
  recency: "近期性", momentum: "動能", evidenceVolume: "觀測量", sourceDiversity: "來源多樣性", noveltyProxy: "新穎性 proxy", feasibility: "可行性 proxy", saturationRisk: "飽和風險",
};

const PROVIDER_LABELS: Record<string, string> = {
  OPENALEX: "OpenAlex", CROSSREF: "Crossref", SEMANTIC_SCHOLAR: "Semantic Scholar", CONSENSUS: "Consensus", MANUAL_PUBLIC_HTTPS: "手動來源",
};
const PROVIDER_STATE_LABELS: Record<TopicLabProviderState, string> = {
  READY: "正常", EMPTY: "無結果", DISABLED: "未啟用", TIMED_OUT: "逾時", CANCELLED: "已取消", RATE_LIMITED: "限流", UPSTREAM_ERROR: "上游錯誤", INVALID_RESPONSE: "回應異常",
};
const PROVIDER_STATE_CLASS: Record<TopicLabProviderState, string> = {
  READY: "ps-ready", EMPTY: "ps-empty", DISABLED: "ps-disabled", TIMED_OUT: "ps-warn", CANCELLED: "ps-warn", RATE_LIMITED: "ps-warn", UPSTREAM_ERROR: "ps-error", INVALID_RESPONSE: "ps-error",
};
const CAPABILITY_LABELS: Record<TopicLabSourceCapability, string> = {
  NOT_REQUESTED: "概念模式（未請求外部來源）", SCHOLARLY_DISABLED: "學術搜尋未啟用", SCHOLARLY_READY: "學術搜尋正常", SCHOLARLY_PARTIAL: "學術搜尋部分可用", SCHOLARLY_UNAVAILABLE: "學術搜尋不可用", MANUAL_PUBLIC_HTTPS: "手動公開來源", MANUAL_DISABLED: "手動來源未啟用",
};

// 快速靈感：每領域提供示範方向，純本機常數，不呼叫模型或外部 API
const QUICK_IDEAS: Record<string, string[]> = {
  "AI × 教育": ["生成式 AI 輔助個人化學習對大學生自主學習動機與學習成效的影響", "AI 寫作回饋工具對研究生學術寫作自我效能的作用機制"],
  "AI × 職業安全與教育訓練": ["生成式 AI 虛擬教練在高風險作業人員安全訓練中的知識保留效果", "AI 風險辨識輔助系統對新進員工危害認知移轉的影響"],
  "AI × 環境工程與環境資源管理": ["AI 預測模型在水資源管理中的決策支援與不確定性溝通", "深度學習影像辨識在廢棄物分類與循環經濟中的應用成效"],
  "AI × 能源跨領域應用": ["AI 能源預測模型對再生能源調度的可靠度評估", "智慧電網中 AI 負載預測的信任與人機協作研究"],
  "AR/VR/XR × 教育": ["沉浸式 VR 情境模擬對醫護學生臨床判斷能力之長期保留效果", "擴增實境在實驗室安全操作訓練中的即時引導成效"],
  "AR/VR/XR × 職業安全與教育訓練": ["沉浸式 VR 訓練對高風險作業人員危害辨識與行為遷移的效果", "虛擬實境消防演訓中的壓力情境設計與決策品質研究"],
};

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
function defaultWindow() { const to = new Date(); const from = new Date(Date.UTC(to.getUTCFullYear() - 3, to.getUTCMonth(), to.getUTCDate())); return { from: isoDate(from), to: isoDate(to) }; }
function newKey(prefix: string) { const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; return `${prefix}:${id}`; }
function signalText(candidate: TopicLabCandidate, key: keyof TopicLabCandidate["signals"]) { const signal = candidate.signals[key]; if (signal.value === null) return "不可用"; return key === "evidenceVolume" || key === "sourceDiversity" ? String(signal.value) : `${signal.value}/1000`; }

export default function TopicLabFrontierRadar({
  projectId,
  initialView = "lab",
  initialConditions = {},
  initialAnalysis = null,
  initialSourceCapability = "",
  onDraftCandidate,
  onPromoted,
  onSendToNavigator,
}: {
  projectId?: string;
  initialView?: "lab" | "radar";
  initialConditions?: TopicLabInitialConditions;
  initialAnalysis?: TopicLabAnalysis | null;
  initialSourceCapability?: string;
  onDraftCandidate?: (candidate: TopicLabCandidate) => void;
  onPromoted?: () => void;
  onSendToNavigator?: (selected: TopicLabCandidate) => void;
}) {
  const [view, setView] = useState<"lab" | "radar">(initialAnalysis ? "radar" : initialView);
  const [researchDirection, setResearchDirection] = useState(initialConditions.researchDirection || initialConditions.context || "");
  const [domain, setDomain] = useState<CanonicalDomain | "">(initialConditions.domain || (canonicalDomains.includes(initialConditions.professionalField as CanonicalDomain) ? initialConditions.professionalField as CanonicalDomain : ""));
  const [outputTrack, setOutputTrack] = useState<OutputTrackId | "">(initialConditions.outputTrack || "");
  const [population, setPopulation] = useState(initialConditions.population || "");
  const [context, setContext] = useState(initialConditions.context || "");
  const [method, setMethod] = useState(initialConditions.methodPreferences || "");
  const [timeline, setTimeline] = useState(initialConditions.time || "");
  const [data, setData] = useState(initialConditions.data || "");
  const [ethics, setEthics] = useState(initialConditions.ethics || "");
  const [window, setWindow] = useState(defaultWindow);
  const [sourceStrategy, setSourceStrategy] = useState<ResearchSourceStrategy>("NONE");
  const [sourceUrls, setSourceUrls] = useState("");
  const [analysis, setAnalysis] = useState<TopicLabAnalysis | null>(initialAnalysis);
  const [runId, setRunId] = useState("");
  const [versionNumber, setVersionNumber] = useState<number | null>(null);
  const [sourceCapability, setSourceCapability] = useState(initialSourceCapability);
  const [providerStates, setProviderStates] = useState<Record<string, TopicLabProviderState> | null>(null);
  const [selected, setSelected] = useState<TopicLabCandidate | null>(() => initialAnalysis?.candidates.find((item) => item.candidateId === initialAnalysis.recommendedCandidateId) || null);
  const [humanConfirmed, setHumanConfirmed] = useState(false);
  const [rationale, setRationale] = useState("");
  const [humanGateId, setHumanGateId] = useState("");
  const [promotion, setPromotion] = useState("");
  const [zoteroSaving, setZoteroSaving] = useState(false);
  const [zoteroError, setZoteroError] = useState("");
  const [zoteroSavedCount, setZoteroSavedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(Boolean(projectId));
  const [error, setError] = useState("");
  const [recoverableFields, setRecoverableFields] = useState<string[]>([]);
  const [hasNavigatorRuns, setHasNavigatorRuns] = useState<boolean | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialAnalysis) return;
    setAnalysis(initialAnalysis); setSourceCapability(initialSourceCapability); setSelected(initialAnalysis.candidates.find((item) => item.candidateId === initialAnalysis.recommendedCandidateId) || initialAnalysis.candidates[0] || null); setView("radar");
  }, [initialAnalysis, initialSourceCapability]);

  useEffect(() => {
    if (!projectId) { setLoadingLatest(false); return; }
    let active = true; setLoadingLatest(true);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/topic-lab`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() as { ok?: boolean; run?: { runId: string; versionNumber: number; analysis: TopicLabAnalysis } | null; error?: string } }))
      .then(({ response, data: responseData }) => {
        if (!active) return;
        if (!response.ok || !responseData.ok) throw new Error(responseData.error || "無法讀取選題實驗室版本。");
        if (responseData.run) { setRunId(responseData.run.runId); setVersionNumber(responseData.run.versionNumber); setAnalysis(responseData.run.analysis); setSelected(responseData.run.analysis.candidates.find((item) => item.candidateId === responseData.run?.analysis.recommendedCandidateId) || responseData.run.analysis.candidates[0] || null); }
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "無法讀取選題實驗室版本。"); })
      .finally(() => { if (active) setLoadingLatest(false); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => { if (!initialAnalysis) setView(initialView); }, [initialView, initialAnalysis]);
  useEffect(() => { if (error || analysis) statusRef.current?.focus(); }, [error, analysis]);

  useEffect(() => {
    if (!projectId) { setHasNavigatorRuns(null); return; }
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/submission-navigator`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ ok?: boolean; navigatorV2?: { runs?: unknown[] } }>)
      .then((data) => { if (active) setHasNavigatorRuns(Boolean(data.ok && data.navigatorV2?.runs && data.navigatorV2.runs.length > 0)); })
      .catch(() => { if (active) setHasNavigatorRuns(false); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) { setHasNavigatorRuns(null); return; }
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/submission-navigator`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ ok?: boolean; navigatorV2?: { runs?: unknown[] } }>)
      .then((data) => { if (active) setHasNavigatorRuns(Boolean(data.ok && data.navigatorV2?.runs && data.navigatorV2.runs.length > 0)); })
      .catch(() => { if (active) setHasNavigatorRuns(false); });
    return () => { active = false; };
  }, [projectId]);

  async function request(body: Record<string, unknown>) {
    const endpoint = projectId ? `/api/projects/${encodeURIComponent(projectId)}/topic-lab` : "/api/assist/topic-lab";
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const responseData = await response.json() as TopicLabResponse;
    if (!response.ok || !responseData.ok) {
      setRecoverableFields(responseData.recoverableFields || []);
      throw new Error(responseData.error || `老麥研究方案未完成${responseData.stage ? `（${responseData.stage}）` : ""}。`);
    }
    return responseData;
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!researchDirection.trim()) { setError("請先輸入一句研究方向。"); return; }
    setError(""); setRecoverableFields([]); setPromotion(""); setHumanGateId(""); setSelected(null); setHumanConfirmed(false);
    const urls = sourceUrls.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
    if (sourceStrategy === "MANUAL_PUBLIC_HTTPS" && urls.length === 0) { setError("手動公開來源模式需要至少一個 HTTPS 來源。"); return; }
    setLoading(true);
    try {
      const responseData = await request({
        operation: "ANALYZE", idempotencyKey: newKey("research-start"), researchDirection,
        advanced: { domain: domain || null, outputTrack: outputTrack || null, population, context, method, data, timeline, ethics },
        evidenceWindow: window, sourceStrategy, sourceUrls: sourceStrategy === "MANUAL_PUBLIC_HTTPS" ? urls : [],
      });
      if (!responseData.analysis || (projectId && !responseData.runId)) throw new Error("選題結果缺少固定版本資料。");
      setAnalysis(responseData.analysis); setRunId(responseData.runId || ""); setVersionNumber(responseData.versionNumber ?? null); setSourceCapability(responseData.sourceCapability || ""); setProviderStates(responseData.providerStates || null);
      setSelected(responseData.analysis.candidates.find((item) => item.candidateId === responseData.analysis?.recommendedCandidateId) || responseData.analysis.candidates[0] || null); setView("radar");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "老麥目前無法完成這項選題操作；目前輸入已保留。"); }
    finally { setLoading(false); }
  }

  async function approve() {
    if (!selected || !runId || !humanConfirmed || !rationale.trim()) return;
    setLoading(true); setError(""); setPromotion("");
    try { const responseData = await request({ operation: "APPROVE_CANDIDATE", idempotencyKey: newKey("topic-gate"), runId, candidateId: selected.candidateId, candidateHash: selected.candidateHash, rationale: rationale.trim() }); if (!responseData.humanGateId) throw new Error("Human Gate 未回傳精確版本識別。"); setHumanGateId(responseData.humanGateId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Human Gate 建立失敗。"); }
    finally { setLoading(false); }
  }

  async function promote() {
    if (!selected || !runId || !humanGateId) return;
    setLoading(true); setError("");
    try { const responseData = await request({ operation: "PROMOTE_CANDIDATE", idempotencyKey: newKey("topic-promotion"), runId, candidateId: selected.candidateId, candidateHash: selected.candidateHash, humanGateId }); if (!responseData.studyVersionId) throw new Error("S1 草稿版本未建立。"); setPromotion("已建立 S1 設計草稿；後續正式階段轉移仍須依 S0–S9 契約完成。"); onPromoted?.(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "候選題目無法安全提升至 S1 草稿。"); }
    finally { setLoading(false); }
  }

  function choose(candidate: TopicLabCandidate) { setSelected(candidate); setHumanConfirmed(false); setRationale(""); setHumanGateId(""); setPromotion(""); }

  async function exportToZotero() {
    if (!analysis || analysis.observations.length === 0) return;
    setZoteroSaving(true); setZoteroError("");
    try {
      const response = await fetch("/api/zotero", { method: "GET", headers: { "Content-Type": "application/json" }, cache: "no-store" });
      const data = await response.json() as { ok?: boolean; collections?: { key: string; name: string; numItems: number }[]; error?: string; code?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "無法讀取 Zotero collections。");
      const collections = data.collections || [];
      let collectionKey = collections.find((item) => item.name === "01_核心證據")?.key || collections[0]?.key;
      if (!collectionKey) {
        const createResponse = await fetch("/api/zotero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CREATE_COLLECTION", name: "01_核心證據" }) });
        const createData = await createResponse.json() as { ok?: boolean; collectionKey?: string; error?: string };
        if (!createResponse.ok || !createData.ok || !createData.collectionKey) throw new Error(createData.error || "無法建立 Zotero collection。");
        collectionKey = createData.collectionKey;
      }
      const items = analysis.observations.map((source) => ({ title: source.title, doi: source.doi, url: source.doi ? `https://doi.org/${source.doi}` : null, publishedAt: source.publishedAt, citationCount: source.citationCount, provider: source.provider }));
      const saveResponse = await fetch("/api/zotero", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SAVE_ITEMS", collectionKey, items }) });
      const saveData = await saveResponse.json() as { ok?: boolean; successful?: unknown[]; failed?: unknown[]; error?: string };
      if (!saveResponse.ok || !saveData.ok) throw new Error(saveData.error || "存入 Zotero 失敗。");
      const saved = (saveData.successful || []).length;
      const failed = (saveData.failed || []).length;
      setZoteroSavedCount(saved);
      setZoteroError(failed > 0 ? `成功 ${saved} 筆、失敗 ${failed} 筆（請至 Zotero 檢查重複或格式）。` : "");
    } catch (reason) { setZoteroError(reason instanceof Error ? reason.message : "Zotero 整合目前無法使用。"); }
    finally { setZoteroSaving(false); }
  }

  return <section className="topic-radar-shell" aria-labelledby="topic-radar-title" data-testid="topic-lab-frontier-radar">
    <header className="topic-radar-hero"><div><p className="section-kicker">{projectId ? "PROJECT-SCOPED" : "DRAFT · ZERO FORMAL WRITES"} · TOPIC LAB / FRONTIER RADAR</p><h2 id="topic-radar-title">三方案選題實驗室／前沿雷達</h2><p>三個 requested lane 始終分開；觀測分類不足時只顯示 UNVERIFIED 概念，不把模型記憶稱為熱門或新穎。{projectId ? "選定後仍需精確 candidate hash Human Gate。" : "尚未建立 Project，不會持久化任何候選。"}</p></div><div className="topic-radar-tabs" role="tablist" aria-label="選題實驗室檢視"><button type="button" role="tab" aria-selected={view === "lab"} onClick={() => setView("lab")}>研究方向</button><button type="button" role="tab" aria-selected={view === "radar"} onClick={() => setView("radar")}>三方案比較</button></div></header>

    <div ref={statusRef} tabIndex={-1} className="topic-radar-status" aria-live="polite">{loadingLatest && <p>正在讀取目前專案的選題版本…</p>}{error && <div className="inline-error" role="alert"><p>{error}</p>{recoverableFields.length > 0 && <p>可修正欄位：{recoverableFields.join("、")}</p>}</div>}{analysis && <p><strong>已載入上次選題版本</strong> · v{versionNumber ?? "—"} · {analysis.status} · scoring {analysis.scoringVersion}{sourceCapability ? ` · source ${CAPABILITY_LABELS[sourceCapability as TopicLabSourceCapability] || sourceCapability}` : ""}</p>}{providerStates && Object.keys(providerStates).length > 0 && <div className="topic-provider-states" aria-label="學術資料源狀態">{Object.entries(providerStates).map(([provider, state]) => <span key={provider} className={`provider-state-badge ${PROVIDER_STATE_CLASS[state] || "ps-disabled"}`} title={`${PROVIDER_LABELS[provider] || provider}：${PROVIDER_STATE_LABELS[state] || state}`}>{PROVIDER_LABELS[provider] || provider}<em>{PROVIDER_STATE_LABELS[state] || state}</em></span>)}</div>}{promotion && <p className="research-notice" role="status">{promotion}</p>}</div>

    {view === "lab" && <form className="topic-radar-form" onSubmit={analyze} aria-busy={loading}>
      <label className="topic-research-direction">一句研究方向<span aria-hidden="true"> *</span><textarea required rows={4} maxLength={RESEARCH_DIRECTION_MAX_LENGTH} value={researchDirection} onChange={(event) => setResearchDirection(event.target.value)} placeholder="例如：改善高風險作業人員在沉浸式訓練後的危害辨識移轉" /><small>{researchDirection.length}/{RESEARCH_DIRECTION_MAX_LENGTH}；只需這一欄即可開始</small></label>
      <div className="topic-quick-ideas" aria-label="快速靈感示範方向"><span className="topic-quick-ideas-label">沒有方向？點一下試試靈感</span><div className="topic-quick-ideas-list">{(QUICK_IDEAS[domain] || QUICK_IDEAS[canonicalDomains[0]]).map((idea) => <button type="button" key={idea} className="topic-quick-idea-chip" onClick={() => setResearchDirection(idea)}>{idea}</button>)}</div></div>
      <details className="topic-advanced-settings"><summary>進階設定（可選；留白時由老麥提出待確認建議）</summary><div className="topic-radar-form-grid">
        <label>專業領域<select value={domain} onChange={(event) => setDomain(event.target.value as CanonicalDomain | "")}><option value="">由老麥提出</option>{canonicalDomains.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>成果路徑<select value={outputTrack} onChange={(event) => setOutputTrack(event.target.value as OutputTrackId | "")}><option value="">由老麥提出</option>{outputTrackIds.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>研究族群<input maxLength={500} value={population} onChange={(event) => setPopulation(event.target.value)} /></label>
        <label>研究場域<input maxLength={500} value={context} onChange={(event) => setContext(event.target.value)} /></label>
        <label className="wide">方法偏好<input maxLength={500} value={method} onChange={(event) => setMethod(event.target.value)} /></label>
        <label>期程<input maxLength={500} value={timeline} onChange={(event) => setTimeline(event.target.value)} /></label>
        <label>可用資料<input maxLength={1000} value={data} onChange={(event) => setData(event.target.value)} /></label>
        <label className="wide">倫理／隱私限制<textarea rows={2} maxLength={1000} value={ethics} onChange={(event) => setEthics(event.target.value)} /></label>
      </div>
      {projectId && <OldMikeAssistGroupControl projectId={projectId} surface="M01_TOPIC_CONDITIONS" groupId="m01-conditions" value={{ professionalField: domain, population, context, methodPreferences: method, time: timeline, data, ethics }} onApply={(value) => { if (canonicalDomains.includes(value.professionalField as CanonicalDomain)) setDomain(value.professionalField as CanonicalDomain); setPopulation(value.population); setContext(value.context); setMethod(value.methodPreferences); setTimeline(value.time); setData(value.data); setEthics(value.ethics); }} />}
      <div className="topic-window"><label>證據窗起日<input type="date" required value={window.from} onChange={(event) => setWindow((current) => ({ ...current, from: event.target.value }))} /></label><label>證據窗迄日<input type="date" required value={window.to} onChange={(event) => setWindow((current) => ({ ...current, to: event.target.value }))} /></label></div></details>
      <fieldset className="topic-source-policy"><legend>方案來源</legend><label><input type="radio" name="topic-source-strategy" checked={sourceStrategy === "NONE"} onChange={() => setSourceStrategy("NONE")} />概念模式（預設，不傳送研究方向至外部學術來源）</label><label><input type="radio" name="topic-source-strategy" checked={sourceStrategy === "SCHOLARLY_AUTO"} onChange={() => setSourceStrategy("SCHOLARLY_AUTO")} />公開學術搜尋（啟用後會把研究方向與日期範圍送至 OpenAlex／Crossref；請勿輸入秘密或個人資料）</label><label><input type="radio" name="topic-source-strategy" checked={sourceStrategy === "MANUAL_PUBLIC_HTTPS"} onChange={() => setSourceStrategy("MANUAL_PUBLIC_HTTPS")} />手動公開 HTTPS 來源</label></fieldset>
      {sourceStrategy === "NONE" && <p className="v13-muted">概念模式：三個方案均為待驗證概念，不代表熱門、新興或新穎性證據。</p>}
      {sourceStrategy === "SCHOLARLY_AUTO" && <p className="v13-muted">若伺服器尚未另行啟用公開學術搜尋，會安全降為概念模式，不會假稱趨勢。</p>}
      {sourceStrategy === "MANUAL_PUBLIC_HTTPS" && <label className="topic-source-urls">公開 HTTPS 來源（每行一個，最多 8 個）<textarea rows={4} value={sourceUrls} onChange={(event) => setSourceUrls(event.target.value)} /><small>請勿輸入秘密或個人資料；只保留正規化來源欄位與 URL hash，不保留 raw body。</small></label>}
      <button type="submit" className="primary-button" disabled={loading}>{loading ? "老麥正在產生三個方案…" : "老麥分析並產生 3 個完整研究方案"}</button>
    </form>}

    {view === "radar" && <div className="topic-radar-results">{!analysis ? <div className="v13-empty"><div><strong>尚無方案</strong><p>只輸入一句研究方向即可產生三個完整、可比較的 S0 草稿。</p></div></div> : <>
      <section className="topic-evidence-summary" aria-labelledby="topic-evidence-summary-title"><h3 id="topic-evidence-summary-title">推薦與證據邊界</h3><dl><div><dt>{analysis.status === "INSUFFICIENT_EVIDENCE" ? "老麥概念優先序（待驗證）" : "老麥推薦"}</dt><dd>{analysis.recommendationRationale}</dd></div><div><dt>Evidence date / window</dt><dd>{analysis.evidenceDate} · {analysis.evidenceWindow}</dd></div><div><dt>方法</dt><dd>{analysis.method}</dd></div><div><dt>不確定性</dt><dd>{analysis.uncertainty}</dd></div></dl></section>
      {selected && onSendToNavigator && (
        <section className="topic-path-bar" aria-labelledby="topic-path-bar-title" style={{ border: "1px solid var(--border, #d8dde6)", borderRadius: 12, padding: "12px 16px", margin: "0 0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="section-kicker">RESEARCH PATH · 流程路徑</p>
            <h3 id="topic-path-bar-title" style={{ margin: 0 }}>選題實驗室 ✓ → 投稿導航 → 研究藍圖</h3>
            <p className="v13-muted" style={{ margin: "4px 0 0" }}>已選定方向：{selected.workingTitle}</p>
          </div>
          <button type="button" className="primary-button" data-testid="topic-to-navigator-bar" onClick={() => onSendToNavigator(selected)}>確認此題並進入投稿導航 →</button>
        </section>
      )}
      <div className="topic-candidate-grid c2r4-three-plans">{RESEARCH_PLAN_LANES.map((lane) => {
        const candidate = analysis.candidates.find((item) => item.requestedLane === lane);
        if (!candidate) return null;
        const isSelected = selected?.candidateId === candidate.candidateId;
        const momentum = candidate.signals.momentum.value;
        const novelty = candidate.signals.noveltyProxy.value;
        const volume = candidate.signals.evidenceVolume.value;
        const saturation = candidate.signals.saturationRisk.value;
        const observed = candidate.observedClassification === "INSUFFICIENT_EVIDENCE";
        let trendBadge: { label: string; className: string } | null = null;
        if (!observed && momentum !== null && novelty !== null && volume !== null && saturation !== null) {
          if (momentum >= 600 && novelty >= 600) trendBadge = { label: "新興前沿訊號", className: "trend-emerging" };
          else if (volume >= 600 && saturation <= 400) trendBadge = { label: "熱門領域訊號", className: "trend-hot" };
          else if (saturation >= 700) trendBadge = { label: "飽和風險訊號", className: "trend-saturated" };
        }
        return <article key={lane} className={isSelected ? "selected" : ""} data-testid={`research-plan-${lane}`}><div className="topic-candidate-meta"><span>{candidate.observedClassification === "INSUFFICIENT_EVIDENCE" ? `${LANE_LABELS[lane]}（概念 lane）` : LANE_LABELS[lane]}</span><span>{candidate.observedClassification === "INSUFFICIENT_EVIDENCE" ? "概念優先序／待驗證" : candidate.observedClassification}</span><span>UNVERIFIED</span>{candidate.recommended && <span>{candidate.observedClassification === "INSUFFICIENT_EVIDENCE" ? "老麥概念優先序" : "老麥推薦"}</span>}{trendBadge && <span className={`trend-badge ${trendBadge.className}`}>{trendBadge.label}</span>}</div><h3>{candidate.workingTitle}</h3><dl><div><dt>研究問題</dt><dd>{candidate.researchQuestion}</dd></div><div><dt>研究價值／貢獻</dt><dd>{candidate.researchValue} {candidate.contribution}</dd></div><div><dt>機制／理論</dt><dd>{candidate.mechanismTheory}</dd></div><div><dt>對象／情境</dt><dd>{candidate.targetContext}</dd></div><div><dt>方法／資料</dt><dd>{candidate.methodDesign}<br />{candidate.dataPlan}</dd></div><div><dt>可行性／風險</dt><dd>{candidate.feasibility}<br />{candidate.riskEthics}</dd></div><div><dt>未決事項</dt><dd><ul>{candidate.unresolvedItems.map((item) => <li key={item}>{item}</li>)}</ul></dd></div></dl><div className="topic-signal-grid" aria-label="固定版本趨勢訊號">{(Object.keys(candidate.signals) as Array<keyof TopicLabCandidate["signals"]>).map((key) => <div key={key}><span>{SIGNAL_LABELS[key]}</span><strong>{signalText(candidate, key)}</strong><small>{candidate.signals[key].basis}</small></div>)}</div><button type="button" className={isSelected ? "primary-button" : "secondary-button"} aria-pressed={isSelected} onClick={() => choose(candidate)}>{isSelected ? "已選擇此方案" : "選擇此方案"}</button></article>;
      })}</div>
      {selected && !projectId && <section className="topic-selected-preview" aria-live="polite"><h3>已選擇：{selected.workingTitle}</h3><p>完整 13 欄 S0 已在本次回覆中準備完成；切換方案不會再呼叫模型。</p><div className="research-actions"><button type="button" className="primary-button" data-testid="topic-adopt" onClick={() => onDraftCandidate?.(selected)}>預覽所選完整 S0 草稿</button><button type="button" className="secondary-button" data-testid="topic-to-navigator" onClick={() => onSendToNavigator?.(selected)}>送往投稿與計畫導航</button></div></section>}
      <section className="topic-provenance" aria-labelledby="topic-provenance-title"><h3 id="topic-provenance-title">正規化來源觀測 · 全部 UNVERIFIED</h3>{analysis.observations.length === 0 ? <p>來源不可用或未啟用；三個 lane 保留，但所有趨勢值為不可用。</p> : <ul>{analysis.observations.map((source) => <li key={source.observationId}><strong>{source.title}</strong><span>{source.provider} · {source.publishedAt || "日期不可用"} · {source.exclusionReason}</span></li>)}</ul>}{analysis.observations.length > 0 && <div className="topic-zotero-export"><button type="button" className="secondary-button" disabled={zoteroSaving} onClick={() => void exportToZotero()}>{zoteroSaving ? "正在存入 Zotero…" : zoteroSavedCount > 0 ? `已存入 ${zoteroSavedCount} 筆至 Zotero` : "將來源存入 Zotero"}</button>{zoteroError && <p className="v13-muted" role="alert">{zoteroError}</p>}</div>}</section>
    </>}<button type="button" className="secondary-button" onClick={() => setView("lab")}>修改研究方向</button></div>}

    {projectId && selected && <section className="topic-human-gate" aria-labelledby="topic-human-gate-title"><p className="section-kicker">S0 / S1 人工門檻</p><h3 id="topic-human-gate-title">人工確認後才可建立正式 S1 設計草稿</h3><p>{selected.workingTitle}</p><label>核准理由<textarea rows={3} maxLength={1000} value={rationale} onChange={(event) => { setRationale(event.target.value); setHumanGateId(""); }} /></label><label className="v13-check"><input type="checkbox" checked={humanConfirmed} onChange={(event) => { setHumanConfirmed(event.target.checked); setHumanGateId(""); }} />我已核對候選內容、UNVERIFIED 來源狀態與不確定性，理解 Human Gate 綁定 exact candidate hash。</label><div className="research-actions"><button type="button" className="secondary-button" disabled={loading || !humanConfirmed || !rationale.trim()} onClick={() => void approve()}>{humanGateId ? "Human Gate 已建立" : "核准精確候選版本"}</button><button type="button" className="primary-button" disabled={loading || !humanGateId} onClick={() => void promote()}>建立 S1 設計草稿</button></div></section>}
  </section>;
}
