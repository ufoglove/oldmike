"use client";

import { useCallback, useEffect, useState } from "react";

type Row = Record<string, unknown>;
type Finding = Row & { findingId?: string; severity?: string; title?: string; description?: string; authorDecision?: string; status?: string };
type Data = Row & { ok?: boolean; locked?: boolean; reasons?: string[]; summary?: Row; runs?: Row[]; findings?: Finding[]; tasks?: Row[] };
const text = (v: unknown, fallback = ""): string => typeof v === "string" && v ? v : fallback;
const num = (v: unknown): number => Number(v) || 0;

function zhStatus(v: string): string {
  const map: Record<string, string> = { "BLOCKER": "阻擋", "CRITICAL": "嚴重", "MAJOR": "主要", "MINOR": "次要", "SUGGESTION": "建議", "OPEN": "開啟", "ACCEPTED": "已接受", "IN_REVISION": "修改中", "RESOLVED_PENDING_REVIEW": "待複核", "VERIFIED_RESOLVED": "已驗證解決", "ACCEPTED_RISK": "接受風險", "REJECTED_WITH_JUSTIFICATION": "有理據拒絕", "NOT_APPLICABLE": "不適用", "REVIEW_IN_PROGRESS": "審查中", "FINDINGS_READY": "發現就緒", "SCIENTIFICALLY_APPROVED": "科學審查通過", "RE_REVIEW_REQUIRED": "需再審", "OUTDATED": "已過時", "SIMULATED": "模擬（老麥）" };
  return map[v] ?? v;
}

const SEVERITY_OPTIONS = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "SUGGESTION"];
const DECISION_OPTIONS = ["OPEN", "ACCEPTED", "IN_REVISION", "RESOLVED_PENDING_REVIEW", "VERIFIED_RESOLVED", "ACCEPTED_RISK", "REJECTED_WITH_JUSTIFICATION", "NOT_APPLICABLE"];

export default function ScientificReviewCenter({ projectId, onNavigate }: { projectId: string; onNavigate?: (navId: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("overview");
  const [fSeverity, setFSeverity] = useState("MAJOR");
  const [fIssueType, setFIssueType] = useState("SCIENTIFIC_VALIDITY");
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fAction, setFAction] = useState("");
  const [fModule, setFModule] = useState("manuscript");
  const [decision, setDecision] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/scientific-review`, { cache: "no-store" });
      const json = (await res.json()) as Data;
      setData(json);
    } catch (e) { setError(String(e)); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const action = useCallback(async (name: string, body: Record<string, unknown>, successText?: string) => {
    setBusy(name); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/scientific-review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const j = (await res.json()) as Row;
      if (!j.ok) { setError(j.error === "scientific_review_has_open_blockers" ? "尚有未解決的阻擋/嚴重發現或任務，無法核准（已標示需再審）。" : text(j.error, "操作失敗")); return j; }
      if (successText) setNotice(successText);
      await load();
      return j;
    } catch (e) { setError(String(e)); return { ok: false }; }
    finally { setBusy(""); }
  }, [projectId, load]);

  const addFinding = async () => {
    if (!fTitle.trim()) { setError("請填寫發現標題"); return; }
    const runId = text((data?.runs ?? [])[0]?.reviewRunId);
    if (!runId) { setError("請先開始一輪科學審查"); return; }
    const r = await action("add-finding", { reviewRunId: runId, severity: fSeverity, issueType: fIssueType, title: fTitle.trim(), description: fDesc, recommendedAction: fAction, destinationModule: fModule }, "發現已登錄");
    if (r.ok) { setFTitle(""); setFDesc(""); setFAction(""); }
  };

  if (!data) return <section className="v13-panel"><div className="v13-panel-head"><p className="section-kicker">科學審查 · 第 14 階段</p><h2>老麥科學審查</h2></div><p>{error || "載入中…"}</p></section>;

  const locked = data.locked === true;
  const reasons = Array.isArray(data.reasons) ? data.reasons : [];
  const runs = data.runs ?? [];
  const findings = data.findings ?? [];
  const tasks = data.tasks ?? [];
  const summary = data.summary ?? {};
  const cta = (label: string, target: string) => onNavigate ? <button type="button" className="primary-button" onClick={() => onNavigate(target)}>{label}</button> : null;
  const tabButton = (key: string, label: string) => <button type="button" className={tab === key ? "secondary-button" : "link-button"} style={tab === key ? { fontWeight: 700 } : undefined} onClick={() => setTab(key)}>{label}</button>;

  return <section className="v13-panel">
    <div className="v13-panel-head"><p className="section-kicker">科學審查 · 第 14 階段</p><h2>老麥科學審查</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {tabButton("overview", "總覽")}
        {tabButton("runs", `審查輪次（${runs.length}）`)}
        {tabButton("findings", `發現（${findings.length}）`)}
        {tabButton("tasks", `修正任務（${tasks.length}）`)}
      </div>
    </div>
    {notice && <p role="status" style={{ color: "#146c43" }}>{notice}</p>}
    {error && <p role="alert" className="v13-error">{error}</p>}

    {tab === "overview" && (locked ? (
      <div className="v13-locked"><div><strong>SCIENTIFIC_REVIEW_CENTER_LOCKED</strong>
        <p>科學審查需先有已核准章節的全文稿件（V1 科學草稿）。</p>
        <ul>{reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
        {cta("前往「全文寫作工作室（13）」", "manuscript")}
      </div></div>
    ) : (
      <div>
        <p>狀態：{zhStatus(text(summary.status))}；輪次 {num(summary.runs)}、發現 {num(summary.findings)}（開啟 {num(summary.openFindings)}、阻擋 {num(summary.blockers)}）、任務 {num(summary.tasks)}。</p>
        {num(summary.simulated) > 0 && <p><span style={{ color: "#b45309" }}>SIMULATED：老麥科學審查以模擬方式產出發現與建議；正式科學決策須研究者核准，不得以模擬取代真實審查。</span></p>}
        {runs.length === 0 && <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void action("start-review", {}, "審查輪次已開始（模擬）")}>{busy === "start-review" ? "開始中…" : "開始老麥科學審查（模擬）"}</button>}
        {runs.length > 0 && <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void action("complete-review", { reviewRunId: text((runs[0] as Row).reviewRunId) }, "已送出核准判定")}>{busy === "complete-review" ? "判定中…" : "判定：可科學核准"}</button>}
      </div>
    ))}

    {tab === "runs" && (runs.length === 0 ? <p>尚無審查輪次。</p> : runs.map((row) => (
      <div key={text(row.reviewRunId)} className="v13-list-item"><strong>{text(row.reviewRunId)}</strong><span>{zhStatus(text(row.status))} · v{num(row.reviewVersion)}/{num(row.manuscriptVersion)}</span>{row.simulated === true || text(row.simulated) === "true" ? <span style={{ color: "#b45309" }}>SIMULATED（老麥）</span> : null}</div>
    )))}

    {tab === "findings" && (
      <div>
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>登錄發現</strong>
          <div className="v13-field"><label>嚴重度</label><select value={fSeverity} onChange={(e) => setFSeverity(e.target.value)}>{SEVERITY_OPTIONS.map((o) => <option key={o} value={o}>{zhStatus(o)}</option>)}</select></div>
          <div className="v13-field"><label>類型</label><input value={fIssueType} onChange={(e) => setFIssueType(e.target.value)} maxLength={60} /></div>
          <div className="v13-field"><label>標題</label><input value={fTitle} onChange={(e) => setFTitle(e.target.value)} maxLength={240} /></div>
          <div className="v13-field"><label>描述（科學依據）</label><textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={3} /></div>
          <div className="v13-field"><label>建議修正</label><textarea value={fAction} onChange={(e) => setFAction(e.target.value)} rows={2} /></div>
          <div className="v13-field"><label>目的模組</label><input value={fModule} onChange={(e) => setFModule(e.target.value)} maxLength={80} /></div>
          <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void addFinding()}>登錄發現</button>
        </div>
        {findings.map((row) => (
          <div key={text(row.findingId)} className="v13-list-item" style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>{text(row.title)}</strong><span>{zhStatus(text(row.severity))} · {zhStatus(text(row.status))}</span></div>
            <p style={{ margin: "4px 0" }}>{text(row.description)}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={decision[text(row.findingId)] ?? "OPEN"} onChange={(e) => setDecision((d) => ({ ...d, [text(row.findingId)]: e.target.value }))}>{DECISION_OPTIONS.map((o) => <option key={o} value={o}>{zhStatus(o)}</option>)}</select>
              <button type="button" className="secondary-button" disabled={busy !== ""} onClick={() => void action("update-decision", { reviewRunId: text((runs[0] as Row)?.reviewRunId), findingId: text(row.findingId), decision: decision[text(row.findingId)] ?? "OPEN", response: response[text(row.findingId)] ?? "" }, "決策已更新")}>套用決策</button>
              <button type="button" className="link-button" disabled={busy !== ""} onClick={() => void action("create-task", { reviewRunId: text((runs[0] as Row)?.reviewRunId), findingId: text(row.findingId), title: `修正：${text(row.title)}`, requiredAction: text(row.description).slice(0, 2000), destinationModule: text(row.destinationModule) || "manuscript", severity: text(row.severity) }, "修正任務已建立")}>建立修正任務</button>
            </div>
          </div>
        ))}
      </div>
    )}

    {tab === "tasks" && (tasks.length === 0 ? <p>尚無修正任務。</p> : tasks.map((row) => (
      <div key={text(row.taskId)} className="v13-list-item"><strong>{text(row.title)}</strong><span>{zhStatus(text(row.severity))} · {zhStatus(text(row.status))}</span><span>{text(row.destinationModule)}</span></div>
    )))}
  </section>;
}
