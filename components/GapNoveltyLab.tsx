"use client";

import { useCallback, useEffect, useState } from "react";

type Row = Record<string, unknown>;
const text = (value: unknown, fallback = ""): string => (typeof value === "string" && value ? value : fallback);
const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : Number.isNaN(Number(value)) ? 0 : Number(value));

const GAP_TYPES: Array<{ value: string; label: string }> = [
  { value: "THEORETICAL_GAP", label: "理論缺口" },
  { value: "EMPIRICAL_GAP", label: "實證缺口" },
  { value: "METHODOLOGICAL_GAP", label: "方法缺口" },
  { value: "POPULATION_GAP", label: "對象缺口" },
  { value: "CONTEXT_GAP", label: "情境缺口" },
  { value: "TECHNOLOGY_GAP", label: "技術缺口" },
  { value: "DATA_GAP", label: "資料缺口" },
  { value: "TEMPORAL_GAP", label: "時間缺口" },
  { value: "MEASUREMENT_GAP", label: "測量缺口" },
  { value: "IMPLEMENTATION_GAP", label: "實施缺口" },
  { value: "HUMAN_AI_GAP", label: "人機協作缺口" },
  { value: "REPLICATION_GAP", label: "複製缺口" },
  { value: "POLICY_PRACTICE_GAP", label: "政策實務缺口" },
  { value: "TEACHING_PRACTICE_GAP", label: "教學實務缺口" },
  { value: "CROSS_DOMAIN_GAP", label: "跨域缺口" },
];
const VALIDATION_STATUS: Array<{ value: string; label: string }> = [
  { value: "PROPOSED", label: "提議中（PROPOSED）" },
  { value: "PARTIALLY_SUPPORTED", label: "部分支持（PARTIALLY_SUPPORTED）" },
  { value: "SUPPORTED", label: "有支持（SUPPORTED）" },
  { value: "CONFLICTING", label: "證據衝突（CONFLICTING）" },
  { value: "NOT_SUPPORTED", label: "不支持（NOT_SUPPORTED）" },
  { value: "UNVERIFIED", label: "未驗證（UNVERIFIED）" },
];
const EVIDENCE_STRENGTH: Array<{ value: string; label: string }> = [
  { value: "STRONG", label: "強" },
  { value: "MODERATE", label: "中" },
  { value: "WEAK", label: "弱" },
  { value: "UNVERIFIED", label: "未評" },
];
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿", SEARCH_PLANNED: "搜尋已規劃", SEARCH_IN_PROGRESS: "搜尋進行中", EVIDENCE_INCOMPLETE: "證據不足", UNDER_REVIEW: "審查中",
  REVISION_REQUIRED: "需修訂", VALIDATED: "已驗證", OUTDATED: "已過時", REVALIDATION_REQUIRED: "需重新驗證",
};
const CONFIDENCE_LABEL: Record<string, string> = { HIGH: "高", MODERATE: "中", LOW: "低", UNVERIFIED: "未評" };
const RISK_LABEL: Record<string, string> = { NONE: "無", LOW: "低", MEDIUM: "中", HIGH_DUPLICATION_RISK: "高度重複風險", UNVERIFIED: "未評" };
const SATURATION_LABEL: Record<string, string> = { LOW_SATURATION: "低飽和", EMERGING: "湧現中", GROWING: "成長中", MATURE: "成熟", HIGHLY_SATURATED: "高度飽和", INSUFFICIENT_DATA: "資料不足" };

type GapTask = { taskId: string; gapType: string | null; searchPurpose: string; booleanQuery: string; searchStatus: string; resultCount: number; includedCount: number; lastRunAt: string | null };
type GapClaim = { gapId: string; gapType: string; claim: string; validationStatus: string; evidenceStrength: string | null };
type GapEvidence = { gapId: string; literatureId: string | null; citationSourceId: string | null; zoteroItemKey: string | null; readingStatus: string; verificationStatus: string };
type LiteratureItem = { literatureId: string; zoteroItemKey?: string | null; readingStatus?: string; evidenceStatus?: string };

type GapView = {
  exists: boolean;
  analysis?: { id: string; status: string; sourceBlueprintVersion: number; route: string | null; noveltyConfidence: string; duplicationRisk: string; saturationStatus: string; noveltyScore: number | null; lastSearchAt: string | null; currentVersion: number; gateState: Row };
  tasks?: GapTask[];
  gapClaims?: GapClaim[];
  evidenceLinks?: GapEvidence[];
  closestStudies?: Array<{ literatureId: string; overallSimilarity: number | null; duplicationRisk: string; fulltextStatus: string; zoteroStatus: string }>;
  contributionDeltas?: Array<{ deltaType: string; description: string; direction: string }>;
  noveltyProfile?: { dimensions: Row; confidence: string; score: number | null } | null;
  saturation?: { status: string } | null;
  versions?: Array<{ versionNumber: number; versionLabel: string; reason: string; createdAt: string }>;
  outdatedReason?: string | null;
};

function gateFailed(gateState: Row | undefined): Array<{ key: string; label: string; detail: string }> {
  if (!gateState) return [];
  const results = gateState.results;
  if (!Array.isArray(results)) return [];
  return results.filter((item) => {
    const row = item as Row;
    return row.pass !== true;
  }).map((item) => {
    const row = item as Row;
    return { key: text(row.key, "item"), label: text(row.label, "項目"), detail: text(row.detail, "") };
  });
}

export default function GapNoveltyLab({ projectId, onNavigate, onOpenEvidence }: {
  projectId: string;
  onNavigate?: (navId: string) => void;
  onOpenEvidence?: (role?: string) => void;
}) {
  const [data, setData] = useState<GapView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [literature, setLiterature] = useState<LiteratureItem[]>([]);
  const [picker, setPicker] = useState<string | null>(null); // gapId being linked
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [draftClaims, setDraftClaims] = useState<Array<GapClaim & { dirty?: boolean }>>([]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/gap-novelty`, { cache: "no-store" });
      const json = (await res.json()) as GapView & { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error || "Gap 與新穎性讀取失敗。");
      setData(json);
      if (Array.isArray(json.gapClaims)) setDraftClaims(json.gapClaims.map((claim) => ({ ...claim, dirty: false })));
      setNotice("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gap 與新穎性讀取失敗。");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const loadLiterature = useCallback(async () => {
    if (!projectId || picker === null) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/literature`, { cache: "no-store" });
      const json = (await res.json()) as { ok?: boolean; items?: LiteratureItem[]; error?: string };
      if (res.ok && json.ok !== false && Array.isArray(json.items)) {
        setLiterature(json.items);
        setSelected((current) => {
          const next: Record<string, boolean> = {};
          for (const item of json.items ?? []) next[item.literatureId] = Boolean(current[item.literatureId]);
          return next;
        });
      } else {
        setError(json.error || "文獻清單讀取失敗；請先到文獻與證據中心建立專案文獻。");
      }
    } catch {
      setError("文獻清單讀取失敗。");
    }
  }, [projectId, picker]);

  useEffect(() => { void loadLiterature(); }, [loadLiterature]);

  async function act(action: string, body?: Row, successNote?: string, extra?: { failOk?: boolean }) {
    if (!projectId || busy) return;
    setBusy(action); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/gap-novelty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(body ?? {}) }),
      });
      const json = (await res.json()) as Row & { failed?: Array<{ label: string; detail: string }>; error?: string };
      if (!res.ok || json.ok !== true) {
        const failed = Array.isArray(json.failed) && json.failed.length ? ` Gate 未過（${json.failed.length} 項）：${json.failed.map((f) => f.label).slice(0, 3).join("、")}…。` : "";
        if (extra?.failOk) setError(`${json.error || "操作未通過。"}${failed}`);
        else throw new Error(`${json.error || "操作失敗。"}${failed}`);
        if (extra?.failOk) return;
      }
      if (successNote) setNotice(successNote);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "操作失敗。");
    } finally {
      setBusy("");
    }
  }

  function updateClaim(index: number, patch: Partial<GapClaim>) {
    setDraftClaims((current) => current.map((claim, i) => (i === index ? { ...claim, ...patch, dirty: true } : claim)));
  }

  function addClaim() {
    const gapId = `gc_${Date.now().toString(36)}`;
    setDraftClaims((current) => [...current, { gapId, gapType: "EMPIRICAL_GAP", claim: "", validationStatus: "PROPOSED", evidenceStrength: "UNVERIFIED", dirty: true }]);
  }

  async function saveClaims() {
    const claims = draftClaims.filter((claim) => claim.claim.trim());
    if (!claims.length) { setError("尚未填寫任何 Gap Claim（需 gapId＋gapType＋claim）。"); return; }
    await act("save-gap-claims", { claims }, `Gap Claims 已儲存（${claims.length} 筆）。`);
  }

  const analysis = data?.analysis;
  const failedGates = analysis ? gateFailed(analysis.gateState) : [];
  const validated = analysis?.status === "VALIDATED";
  const outdated = Boolean(data?.outdatedReason);
  const hasVersion = (data?.versions?.length ?? 0) > 0;
  const evidenceByGap = new Map<string, GapEvidence[]>();
  for (const evidence of data?.evidenceLinks ?? []) {
    const list = evidenceByGap.get(evidence.gapId) ?? [];
    list.push(evidence);
    evidenceByGap.set(evidence.gapId, list);
  }

  return <section className="v13-panel-stack" data-testid="gap-novelty-lab">
    <div className="v13-panel">
      <div className="v13-panel-head"><div><p className="section-kicker">Gap 與新穎性實驗室</p><h2>Gap 與新穎性</h2><p className="v13-muted">將選題的初步 Gap，透過正式文獻搜尋、最相近研究比較與證據驗證，轉為可追溯的 Validated Gap、Contribution Delta 與 Novelty Profile。</p></div></div>
      {loading && <p role="status" className="v13-muted">載入中…</p>}
      {error && <div className="v13-error" role="alert">{error}</div>}
      {notice && <p className="v13-notice" role="status">{notice}</p>}
      {!loading && data && !data.exists && (
        <div className="v13-empty">
          <strong>尚未建立 Gap 與新穎性分析</strong>
          <p>需先有正式研究專案＋研究藍圖 v1。按下方的按鈕會依研究藍圖建立搜尋計畫（Gap Search Tasks）。</p>
          <div className="research-actions" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void act("draft", undefined, "Gap 與新穎性分析已建立，並依研究藍圖產生搜尋任務。")}>根據研究藍圖建立搜尋計畫</button>
            {onOpenEvidence && <button type="button" className="secondary-button" onClick={() => onOpenEvidence("gap")}>前往文獻與證據中心</button>}
            {onNavigate && <button type="button" className="secondary-button" onClick={() => onNavigate("evidence")}>前往文獻與證據中心（補充文獻）</button>}
          </div>
        </div>
      )}
      {!loading && data?.exists && (
        <>
          {outdated && data.outdatedReason && <div className="v13-error" role="alert">{data.outdatedReason} 請執行搜尋任務並重新驗證後更新。</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "6px 0 10px" }}>
            <span className="v13-badge">{STATUS_LABEL[text(analysis?.status)] ?? text(analysis?.status, "狀態")}</span>
            <span className="v13-badge">藍圖 v{num(analysis?.sourceBlueprintVersion) || 1}</span>
            {analysis?.route ? <span className="v13-badge">{analysis.route}</span> : null}
            <span className="v13-badge">新穎信心：{CONFIDENCE_LABEL[text(analysis?.noveltyConfidence)] ?? "—"}</span>
            <span className="v13-badge">重複風險：{RISK_LABEL[text(analysis?.duplicationRisk)] ?? "—"}</span>
            {analysis?.saturationStatus ? <span className="v13-badge">飽和度：{SATURATION_LABEL[text(analysis?.saturationStatus)] ?? analysis.saturationStatus}</span> : null}
            {analysis?.noveltyScore !== null && analysis?.noveltyScore !== undefined ? <span className="v13-badge">Novelty：{num(analysis?.noveltyScore)}</span> : null}
            {analysis?.lastSearchAt ? <span className="v13-badge">上次搜尋：{String(analysis.lastSearchAt).slice(0, 10)}</span> : null}
            {analysis?.currentVersion ? <span className="v13-badge">分析版本 v{analysis.currentVersion}</span> : null}
          </div>

          {analysis?.duplicationRisk === "HIGH_DUPLICATION_RISK" && (
            <div className="v13-panel" style={{ border: "1px solid #b42318", background: "#fff7f5", marginBottom: 10 }}>
              <strong style={{ color: "#b42318" }}>⚠️ 高度重複風險：題目可能需要重新考量。</strong>
              <p className="v13-muted" style={{ marginTop: 4 }}>請參閱「最相近研究」清單；若確認與既有研究高度重疊，應回到選題／藍圖修訂題目後重新驗證（Blueprint 會標記 TOPIC_RECONSIDERATION_REQUIRED，不會強行判定新穎）。</p>
            </div>
          )}

          <div className="v13-panel">
            <div className="v13-panel-head"><div><p className="section-kicker">搜尋任務</p><h3>文獻搜尋計畫</h3></div></div>
            {!data.tasks?.length && <p className="v13-muted">尚無搜尋任務。</p>}
            <div style={{ display: "grid", gap: 8 }}>
              {(data.tasks ?? []).map((task) => (
                <div key={task.taskId} className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13 }}>{task.searchPurpose || "（未命名目的）"} <span className="v13-badge">{task.gapType ?? "GENERAL"}</span></strong>
                    <span className={`v13-badge ${task.searchStatus === "COMPLETED" ? "approved" : task.searchStatus === "FAILED" ? "rejected" : ""}`}>{task.searchStatus}</span>
                  </div>
                  <code style={{ fontSize: 12, color: "#5b6b63", wordBreak: "break-all" }}>{task.booleanQuery || "（尚無查詢）"}</code>
                  <small style={{ color: "#5b6b63" }}>結果 {task.resultCount ?? 0} 筆／納入 {task.includedCount ?? 0} 筆{task.lastRunAt ? `；上次執行 ${String(task.lastRunAt).slice(0, 16)}` : "；尚未執行"}</small>
                  {(task.searchStatus === "PENDING" || task.searchStatus === "FAILED" || task.searchStatus === "NOT_STARTED" || !task.lastRunAt) && (
                    <button type="button" className="secondary-button" disabled={busy !== ""} onClick={() => void act("search-run", { taskId: task.taskId }, `搜尋任務已完成：${task.searchPurpose || ""}`)}>執行此搜尋任務</button>
                  )}
                </div>
              ))}
            </div>
            {(data.tasks ?? []).length > 0 && (data.tasks ?? []).some((task) => task.searchStatus === "COMPLETED" || task.searchStatus === "PENDING") && (
              <div className="research-actions" style={{ marginTop: 10 }}>
                <button type="button" className="secondary-button" disabled={busy !== ""} onClick={() => void act("analyze-closest", undefined, "最相近研究分析完成。")}>分析最相近研究</button>
                <button type="button" className="secondary-button" disabled={busy !== ""} onClick={() => void act("assess-novelty", undefined, "Novelty 與 Saturation 評估完成。")}>評估 Novelty 與 Saturation</button>
              </div>
            )}
          </div>

          <div className="v13-panel">
            <div className="v13-panel-head"><div><p className="section-kicker">Gap Claims</p><h3>正式 Gap 分類</h3><p className="v13-muted">填寫後按「儲存 Gap Claims」才會寫入；標記 SUPPORTED 前必須至少連結一筆證據。</p></div></div>
            <div style={{ display: "grid", gap: 10 }}>
              {draftClaims.map((claim, index) => (
                <div key={claim.gapId} className="v13-list-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select aria-label="Gap 類型" style={{ fontSize: 12, flex: "0 1 170px" }} value={claim.gapType} onChange={(event) => updateClaim(index, { gapType: event.target.value })}>
                      {GAP_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                    <select aria-label="驗證狀態" style={{ fontSize: 12, flex: "0 1 190px" }} value={claim.validationStatus} onChange={(event) => updateClaim(index, { validationStatus: event.target.value })}>
                      {VALIDATION_STATUS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                    </select>
                    <select aria-label="證據強度" style={{ fontSize: 12, flex: "0 1 110px" }} value={claim.evidenceStrength ?? "UNVERIFIED"} onChange={(event) => updateClaim(index, { evidenceStrength: event.target.value })}>
                      {EVIDENCE_STRENGTH.map((strength) => <option key={strength.value} value={strength.value}>證據：{strength.label}</option>)}
                    </select>
                    {claim.dirty && <span className="v13-badge">未儲存</span>}
                  </div>
                  <textarea aria-label="Gap Claim 內容" value={claim.claim} placeholder="以一段話描述此 Gap Claim（例：現有 VR 安全訓練研究缺乏對高風險作業人員的長期行為留存測量）" style={{ minHeight: 54 }} onChange={(event) => updateClaim(index, { claim: event.target.value })} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <button type="button" className="secondary-button" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => setPicker((current) => current === claim.gapId ? null : claim.gapId)}>連結證據（{evidenceByGap.get(claim.gapId)?.length ?? 0}）</button>
                    {picker === claim.gapId && (
                      <button type="button" className="secondary-button" style={{ padding: "3px 10px", fontSize: 12 }} disabled={!Object.values(selected).some(Boolean) || busy !== ""}
                        onClick={() => void act("link-evidence", { gapId: claim.gapId, literatureIds: Object.entries(selected).filter(([, on]) => on).map(([id]) => id) }, `證據已連結至 ${claim.gapId}。`)}>套用勾選的文獻</button>
                    )}
                    {claim.validationStatus === "SUPPORTED" && !(evidenceByGap.get(claim.gapId)?.length) && <small style={{ color: "#8a5a00" }}>SUPPORTED 需先連結證據，否則儲存/驗證會被擋。</small>}
                    {!claim.claim.trim() && <small style={{ color: "#8a5a00" }}>空白 Claim 不會儲存。</small>}
                  </div>
                  {picker === claim.gapId && (
                    <div style={{ border: "1px solid #d8e0db", borderRadius: 8, padding: 8, maxHeight: 180, overflow: "auto" }}>
                      {!literature.length && <p className="v13-muted" style={{ fontSize: 12 }}>無可用文獻。{onOpenEvidence ? <button type="button" className="secondary-button" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => onOpenEvidence("gap")}>前往文獻與證據中心建立</button> : null}</p>}
                      {literature.map((item) => (
                        <label key={item.literatureId} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "2px 0" }}>
                          <input type="checkbox" checked={Boolean(selected[item.literatureId])} onChange={(event) => setSelected((current) => ({ ...current, [item.literatureId]: event.target.checked }))} />
                          <span style={{ wordBreak: "break-all" }}>{item.literatureId}{item.zoteroItemKey ? `（Zotero：${item.zoteroItemKey}）` : ""}{item.readingStatus ? `｜閱讀：${item.readingStatus}` : ""}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <small style={{ color: "#5b6b63", fontSize: 12 }}>已連結證據：{(evidenceByGap.get(claim.gapId) ?? []).map((evidence) => `${evidence.literatureId ?? evidence.citationSourceId ?? "來源"}${evidence.zoteroItemKey ? `（${evidence.zoteroItemKey}）` : ""}｜${evidence.readingStatus ?? ""}${evidence.verificationStatus ? `｜${evidence.verificationStatus}` : ""}`).join("；") || "尚未連結"}</small>
                </div>
              ))}
            </div>
            <div className="research-actions" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" className="secondary-button" disabled={busy !== ""} onClick={addClaim}>＋ 新增 Gap Claim</button>
              <button type="button" className="primary-button" disabled={busy !== "" || draftClaims.length === 0} onClick={() => void saveClaims()}>儲存 Gap Claims</button>
            </div>
          </div>

          <div className="v13-panel">
            <div className="v13-panel-head"><div><p className="section-kicker">最相近研究與貢獻差異</p><h3>Closest Study Matrix · Contribution Delta</h3></div></div>
            {!data.closestStudies?.length && !data.contributionDeltas?.length && <p className="v13-muted">尚未分析。請先完成搜尋任務後按「分析最相近研究」。</p>}
            {!!data.closestStudies?.length && <div style={{ display: "grid", gap: 6 }}>{data.closestStudies.map((study) => (
              <div key={study.literatureId} className="v13-list-item" style={{ flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-all" }}>{study.literatureId}</span>
                <span className="v13-badge">相似度 {study.overallSimilarity !== null && study.overallSimilarity !== undefined ? `${Math.round(num(study.overallSimilarity) * 100)}%` : "—"}</span>
                <span className="v13-badge">{study.fulltextStatus ?? ""}</span>
                <span className="v13-badge">重複：{RISK_LABEL[study.duplicationRisk] ?? study.duplicationRisk}</span>
              </div>
            ))}</div>}
            {!!data.contributionDeltas?.length && <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{data.contributionDeltas.map((delta, index) => (
              <div key={`${delta.deltaType}-${index}`} className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                <strong style={{ fontSize: 13 }}>{delta.deltaType} · {delta.direction}</strong>
                <small style={{ color: "#5b6b63" }}>{delta.description}</small>
              </div>
            ))}</div>}
            {!!data.noveltyProfile && <div style={{ marginTop: 10 }}><strong style={{ fontSize: 13 }}>Novelty Profile：{CONFIDENCE_LABEL[data.noveltyProfile.confidence] ?? data.noveltyProfile.confidence}{data.noveltyProfile.score !== null && data.noveltyProfile.score !== undefined ? `（${data.noveltyProfile.score}）` : ""}</strong>{data.saturation?.status ? <span className="v13-badge">飽和：{SATURATION_LABEL[data.saturation.status] ?? data.saturation.status}</span> : null}</div>}
          </div>

          <div className="v13-panel" style={{ border: validated ? "1px solid #b5dfc6" : failedGates.length ? "1px solid #b45309" : "1px solid #d8e0db", background: validated ? "#f4fbf6" : failedGates.length ? "rgba(180,83,9,0.06)" : undefined }} data-testid="gap-gate-preview">
            <div className="v13-panel-head"><div><p className="section-kicker">GAP VALIDATION · 驗證 Gate</p><h3>{validated ? "已驗證（VALIDATED）" : failedGates.length ? `Gate 未通過（${failedGates.length} 項）` : analysis?.status ? `目前狀態：${STATUS_LABEL[text(analysis?.status)] ?? analysis?.status}` : "尚未驗證"}</h3></div></div>
            {!validated && failedGates.length > 0 && <div style={{ display: "grid", gap: 6, marginTop: 6 }}>{failedGates.map((failed) => <div key={failed.key} className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}><strong style={{ fontSize: 13 }}>{failed.label}</strong>{failed.detail ? <small style={{ color: "#5b6b63" }}>{failed.detail}</small> : null}</div>)}</div>}
            {!validated && <p className="v13-muted" style={{ marginTop: 6 }}>{failedGates.length ? "請依上列缺口補齊後再驗證。未通過時不會產生 Blueprint v2，也不會解鎖理論與機制實驗室。" : "完成搜尋、Gap Claims＋證據、最相近研究與 Novelty 評估後，按下方驗證。"}</p>}
            {validated && <p className="v13-notice">✅ 驗證通過。已建立 Research Blueprint v2 Draft（未覆蓋 v1）。</p>}
            <div className="research-actions" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" className="primary-button" disabled={busy !== "" || !data.exists} onClick={() => void act("validate", undefined, "Gap 驗證完成。", { failOk: true })}>驗證 Gap 與新穎性</button>
              {validated && !hasVersion && <button type="button" className="secondary-button" disabled={busy !== ""} onClick={() => void act("writeback-v2", undefined, "已回寫 Research Blueprint v2（Draft）。")}>回寫 Research Blueprint v2</button>}
              {validated && onNavigate && <button type="button" className="primary-button" style={{ background: "linear-gradient(90deg,#0f7a3d,#22a35a)" }} onClick={() => onNavigate("theory")}>下一步：前往理論與機制 →</button>}
            </div>
          </div>

          {!!data.versions?.length && <details style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", fontSize: 13, color: "#0f7a3d" }}>版本與歷程（{data.versions.length}）</summary>
            <div style={{ display: "grid", gap: 4, marginTop: 6 }}>{data.versions.map((version) => <small key={version.versionNumber} style={{ color: "#5b6b63" }}>v{version.versionNumber}｜{version.versionLabel}｜{version.reason}｜{String(version.createdAt).slice(0, 16)}</small>)}</div>
          </details>}
        </>
      )}
    </div>
  </section>;
}
