"use client";

import { useCallback, useEffect, useState } from "react";
import { OldMikeAssistGroupControl } from "./OldMikeAssistControl";

type Row = Record<string, unknown>;
type Data = Row & { ok?: boolean; locked?: boolean; reasons?: string[]; summary?: Row; gate?: Row; datasets?: Row[]; plans?: Row[]; runs?: Row[]; draft?: Row | null };
const text = (v: unknown, fallback = ""): string => typeof v === "string" && v ? v : fallback;
const num = (v: unknown): number => Number(v) || 0;

function zhStatus(v: string): string {
  if (v === "LOCKED" || v === "FROZEN") return "已鎖定";
  if (v === "PLANNED") return "已規劃";
  if (v === "AI_PROPOSED") return "老麥建議・尚未驗證";
  if (v === "USER_DRAFT") return "研究者草稿";
  return v || "尚未驗證";
}

export default function AnalysisLabCenter({ projectId, onNavigate }: { projectId: string; onNavigate?: (navId: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("overview");
  const [planMethod, setPlanMethod] = useState("DESCRIPTIVE");
  const [planParams, setPlanParams] = useState("");
  const [runDatasetId, setRunDatasetId] = useState("");
  const [runPlanId, setRunPlanId] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftMode, setDraftMode] = useState("USER_DRAFT");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/analysis-lab`, { cache: "no-store" });
      const json = (await res.json()) as Data;
      setData(json);
      if (json.draft) {
        setDraftTitle(text(json.draft.title));
        setDraftBody(text(json.draft.body));
        const detail = json.draft.stageDetail as Row | null;
        setDraftMode(text(detail?.mode, "USER_DRAFT"));
      }
    } catch (e) { setError(String(e)); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const action = useCallback(async (name: string, body: Record<string, unknown>, successText?: string) => {
    setBusy(name); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/analysis-lab`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const j = (await res.json()) as Row;
      if (!j.ok) { setError(text(j.error, "操作失敗")); return j; }
      if (successText) setNotice(successText);
      await load();
      return j;
    } catch (e) { setError(String(e)); return { ok: false }; }
    finally { setBusy(""); }
  }, [projectId, load]);

  const savePlan = async () => {
    if (!planMethod.trim()) { setError("請填寫分析方法"); return; }
    let parameters: Record<string, unknown> = {};
    if (planParams.trim()) { try { parameters = JSON.parse(planParams); } catch { setError("參數須為合法 JSON"); return; } }
    const r = await action("save-plan", { method: planMethod.trim(), parameters, engine: "manual" }, planParams.trim() ? "分析計畫已更新" : "分析計畫已建立");
    if (r.ok) { setPlanMethod("DESCRIPTIVE"); setPlanParams(""); }
  };

  const saveDraft = async (mode: string) => {
    if (!draftBody.trim()) { setError("請先撰寫結果草稿內容"); return; }
    await action("save-draft", { title: draftTitle.trim() || "分析結果草稿", body: draftBody, mode }, mode === "AI_PROPOSED" ? "AI 草稿已存（待你確認）" : "草稿已存");
  };

  if (!data) return <section className="v13-panel"><div className="v13-panel-head"><p className="section-kicker">分析實驗室 · 第 12 階段</p><h2>分析實驗室</h2></div><p>{error || "載入中…"}</p></section>;

  const locked = data.locked === true;
  const reasons = Array.isArray(data.reasons) ? data.reasons : [];
  const summary = data.summary ?? {};
  const datasets = Array.isArray(data.datasets) ? data.datasets : [];
  const plans = Array.isArray(data.plans) ? data.plans : [];
  const runs = Array.isArray(data.runs) ? data.runs : [];
  const nextCenter = text(summary.nextCenter);

  const cta = (label: string, target: string) => onNavigate ? <button type="button" className="primary-button" onClick={() => onNavigate(target)}>{label}</button> : null;
  const tabButton = (key: string, label: string) => <button type="button" className={tab === key ? "secondary-button" : "link-button"} style={tab === key ? { fontWeight: 700 } : undefined} onClick={() => setTab(key)}>{label}</button>;

  return <section className="v13-panel">
    <div className="v13-panel-head"><p className="section-kicker">分析實驗室 · 第 12 階段</p><h2>分析實驗室</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {tabButton("overview", "總覽")}
        {tabButton("datasets", `資料集（${datasets.length}）`)}
        {tabButton("plans", `分析計畫（${plans.length}）`)}
        {tabButton("runs", `執行紀錄（${runs.length}）`)}
        {tabButton("draft", "結果草稿")}
      </div>
    </div>
    {notice && <p role="status" style={{ color: "#146c43" }}>{notice}</p>}
    {error && <p role="alert" className="v13-error">{error}</p>}

    {tab === "overview" && (locked ? (
      <div className="v13-locked">
        <div><strong>ANALYSIS_EXECUTION_LOCKED</strong>
          <p>前置鏈尚未完成，無法進入正式分析；以下項目需先至對應中心補齊。</p>
          <ul>{reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {nextCenter === "execution" ? cta("前往「正式研究與執行」", "execution") : cta("前往「資料治理與 Analysis Dataset」", "governance")}
            {nextCenter === "governance" && cta("前往「正式研究與執行」", "execution")}
          </div>
        </div>
      </div>
    ) : (
      <div>
        <p>分析前置鏈已就緒：Raw Data Lock ✅ · Analysis Dataset ✅</p>
        <p>狀態：{text(summary.status)}；資料集 {num(summary.datasets)}、計畫 {num(summary.plans)}、執行紀錄 {num(summary.runs)}、凍結 {num(summary.frozen)}。</p>
        {num(summary.frozen) > 0 && <p>結果已就緒，可撰寫結果草稿並進行後續審查。</p>}
      </div>
    ))}

    {tab === "datasets" && (datasets.length === 0 ? <p>尚未註冊 Analysis Dataset（請先完成資料治理與資料集註冊）。</p> : datasets.map((row) => (
      <div key={text(row.id)} className="v13-list-item"><strong>{text(row.artifactId, text(row.id))}</strong><span>{zhStatus(text(row.mediaType))} · {num(row.byteSize)} bytes</span><code style={{ wordBreak: "break-all" }}>{text(row.sha256).slice(0, 24)}…</code></div>
    )))}

    {tab === "plans" && (
      <div>
        <div className="v13-field"><label>分析方法（method）</label><input value={planMethod} onChange={(e) => setPlanMethod(e.target.value)} maxLength={120} placeholder="例：DESCRIPTIVE / REGRESSION / RCT 分析契約" /></div>
        <div className="v13-field"><label>參數（JSON，可留空）</label><textarea value={planParams} onChange={(e) => setPlanParams(e.target.value)} rows={3} placeholder='{"note": "…"}' /></div>
        <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void savePlan()}>{busy === "save-plan" ? "儲存中…" : "建立／更新分析計畫"}</button>
        {plans.map((row) => {
          const lockedFlag = text(row.locked) === "true" || Boolean(row.lockedAt);
          return <div key={text(row.id)} className="v13-list-item"><strong>{text(row.method)}</strong><span>v{num(row.versionNumber)} · {zhStatus(lockedFlag ? "LOCKED" : "DRAFT")}</span>
            {!lockedFlag && <button type="button" className="secondary-button" disabled={busy !== ""} onClick={() => void action("lock-plan", { planId: text(row.id) }, "分析計畫已鎖定")}>鎖定計畫</button>}
          </div>;
        })}
      </div>
    )}

    {tab === "runs" && (
      <div>
        <div className="v13-field"><label>資料集</label>
          <select value={runDatasetId} onChange={(e) => setRunDatasetId(e.target.value)}>{datasets.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.artifactId, text(row.id))}</option>)}</select>
        </div>
        <div className="v13-field"><label>分析計畫</label>
          <select value={runPlanId} onChange={(e) => setRunPlanId(e.target.value)}>{plans.map((row) => <option key={text(row.id)} value={text(row.id)}>{text(row.method)} (v{num(row.versionNumber)})</option>)}</select>
        </div>
        <button type="button" className="primary-button" disabled={busy !== "" || !runDatasetId || !runPlanId} onClick={() => void action("register-run", { datasetId: runDatasetId, analysisPlanId: runPlanId }, "執行紀錄已建立（PLANNED）")}>建立執行紀錄</button>
        {runs.map((row) => <div key={text(row.id)} className="v13-list-item"><strong>{text(row.method)}</strong><span>{zhStatus(text(row.status))} · {text(row.engine)}</span><span>{text(row.createdAt).slice(0, 16).replace("T", " ")}</span></div>)}
      </div>
    )}

    {tab === "draft" && (
      <div>
        <p>結果草稿僅為擬稿（AI_PROPOSED 標示尚未驗證）；正式 Result 須連結 Immutable Result Fact 並通過一致性檢查，不會以草稿取代正式結果。</p>
        <OldMikeAssistGroupControl
          projectId={projectId}
          surface="RESEARCH_DOCUMENT"
          groupId="research-document"
          value={{ title: draftTitle, body: draftBody }}
          label="老麥協助：整理分析結果草稿"
          onApply={(value, provenance) => { setDraftTitle(text(value.title)); setDraftBody(text(value.body)); setDraftMode(provenance); }}
        />
        <div className="v13-field"><label>草稿標題</label><input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} maxLength={240} /></div>
        <div className="v13-field"><label>草稿內容</label><textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} rows={12} /></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void saveDraft(draftMode === "AI_PROPOSED" ? "AI_PROPOSED" : "USER_DRAFT")}>儲存草稿（{draftMode === "AI_PROPOSED" ? "AI 草稿・待確認" : "研究者草稿"}）</button>
          {nextCenter === "governance" && cta("前往資料治理中心", "governance")}
        </div>
      </div>
    )}
  </section>;
}
