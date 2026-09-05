"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SummaryJob = {
  jobId: string;
  taskType: string;
  status: "QUEUED" | "RUNNING" | "PARTIAL" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REQUIRES_ACTION";
  inputSnapshot: Record<string, unknown>;
  resultReference?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
};

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELLED", "REQUIRES_ACTION"]);
const STATUS_LABEL: Record<string, string> = { QUEUED: "排隊中", RUNNING: "老麥整理中…", PARTIAL: "部分完成", SUCCEEDED: "已完成", FAILED: "失敗", CANCELLED: "已取消", REQUIRES_ACTION: "需要處理" };

export default function ResearchStartSummaryCard({ projectId, inputSnapshot, onNavigate }: {
  projectId: string;
  inputSnapshot: Record<string, unknown>;
  onNavigate?: (navId: string) => void;
}) {
  const [job, setJob] = useState<SummaryJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => { if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; } }, []);

  const loadLatest = useCallback(async (silent = false) => {
    if (!projectId) return;
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent-jobs?taskType=RESEARCH_START_SUMMARY&limit=1`, { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; jobs?: SummaryJob[]; error?: string };
      if (!response.ok || data.ok === false) throw new Error(data.error || "摘要任務讀取失敗。");
      const latest = data.jobs?.[0] ?? null;
      setJob(latest);
      if (latest && !TERMINAL.has(latest.status)) startPolling(latest.jobId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "摘要任務讀取失敗。");
    } finally {
      setLoading(false);
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    pollTimer.current = setInterval(() => {
      fetch(`/api/projects/${encodeURIComponent(projectId)}/agent-jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" })
        .then((response) => response.json() as Promise<{ ok?: boolean; job?: SummaryJob; error?: string }>)
        .then((data) => {
          if (data.ok && data.job) {
            setJob(data.job);
            if (TERMINAL.has(data.job.status)) stopPolling();
          }
        })
        .catch(() => { /* 下次輪詢再試；不顯示假錯誤 */ });
    }, 2500);
  }, [projectId, stopPolling]);

  useEffect(() => { void loadLatest(); return stopPolling; }, [loadLatest, stopPolling]);

  async function createJob() {
    if (!projectId || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: "RESEARCH_START_SUMMARY", inputSnapshot, idempotencyKey: `start-summary:${projectId}:${JSON.stringify(inputSnapshot).slice(0, 120)}` }),
      });
      const data = (await response.json()) as { ok?: boolean; job?: SummaryJob; error?: string };
      if (!response.ok || data.ok === false || !data.job) throw new Error(data.error || "摘要任務建立失敗。");
      setJob(data.job);
      if (!TERMINAL.has(data.job.status)) startPolling(data.job.jobId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "摘要任務建立失敗。");
    } finally {
      setBusy(false);
    }
  }

  const summary = job?.status === "SUCCEEDED" ? (job.resultReference?.summary as Record<string, unknown> | undefined) : null;
  const artifact = job?.status === "SUCCEEDED" ? (job.resultReference?.artifact as Record<string, unknown> | undefined) : null;

  return <section className="v13-panel" data-testid="research-start-summary-card">
    <div className="v13-panel-head"><div><p className="section-kicker">研究啟動摘要</p><h2>老麥整理研究方向</h2><p className="v13-muted">只依你提供的輸入整理問題、方向、已知條件與下一步；不會冒充已完成統計、Gap 驗證或研究結果。AI 建議值會標示 SUGGESTED 與理由。</p></div></div>
    {loading && <p role="status" className="v13-muted">讀取摘要狀態…</p>}
    {error && <div className="v13-error" role="alert">{error} <button type="button" className="secondary-button" style={{ padding: "2px 8px" }} onClick={() => void loadLatest(true)}>重試</button></div>}
    {!loading && job && <p className="v13-muted" role="status">任務狀態：<strong>{STATUS_LABEL[job.status] ?? job.status}</strong>（job_id：{job.jobId}）</p>}
    {job?.status === "FAILED" && <div className="v13-error" role="alert"><strong>{job.errorCode ?? "job_failed"}</strong>：{job.errorMessage ?? "任務失敗；未寫入正式欄位。"} <button type="button" className="secondary-button" style={{ padding: "2px 8px" }} onClick={() => void createJob()}>重試</button></div>}
    {job?.status === "REQUIRES_ACTION" && <div className="v13-error" role="alert">此任務需要人工處理：{job.errorMessage ?? "未知"}</div>}
    {!job && !loading && (
      <div className="research-actions" style={{ marginTop: 6, flexWrap: "wrap" }}>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void createJob()}>{busy ? "送出中…" : "老麥整理研究方向（一鍵）"}</button>
        {onNavigate && <button type="button" className="secondary-button" onClick={() => onNavigate("quick-start")}>先補齊研究起點欄位</button>}
      </div>
    )}
    {summary && <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      <div className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}><small className="v13-muted">建議題目（title_suggestion · 建議值）</small><strong>{String(summary.title_suggestion ?? "")}</strong></div>
      <div className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}><small className="v13-muted">研究聚焦（research_focus）</small><p style={{ margin: 0, fontSize: 14 }}>{String(summary.research_focus ?? "")}</p></div>
      {Array.isArray(summary.provided_facts) && summary.provided_facts.length > 0 && <div className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}><small className="v13-muted">你提供的已知條件（provided_facts）</small><ul style={{ margin: 0, paddingLeft: 18 }}>{summary.provided_facts.map((fact, index) => <li key={index} style={{ fontSize: 13 }}>{String(fact)}</li>)}</ul></div>}
      {Array.isArray(summary.proposed_questions) && summary.proposed_questions.length > 0 && <div className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}><small className="v13-muted">建議研究問題（proposed_questions）</small><ul style={{ margin: 0, paddingLeft: 18 }}>{summary.proposed_questions.map((question, index) => <li key={index} style={{ fontSize: 13 }}>{String(question)}</li>)}</ul></div>}
      {Array.isArray(summary.unknowns) && summary.unknowns.length > 0 && <div className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}><small className="v13-muted">尚未確定（unknowns）</small><ul style={{ margin: 0, paddingLeft: 18 }}>{summary.unknowns.map((item, index) => <li key={index} style={{ fontSize: 13 }}>{String(item)}</li>)}</ul></div>}
      {Array.isArray(summary.evidence_needed) && summary.evidence_needed.length > 0 && <div className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}><small className="v13-muted">需要的證據／檢索（evidence_needed）</small><ul style={{ margin: 0, paddingLeft: 18 }}>{summary.evidence_needed.map((item, index) => <li key={index} style={{ fontSize: 13 }}>{String(item)}</li>)}</ul></div>}
      <div className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}><small className="v13-muted">下一步（next_action）</small><p style={{ margin: 0, fontSize: 13 }}>{String(summary.next_action ?? "")}</p></div>
      {artifact && <p className="v13-notice" role="status">✅ 已保存新版本：{String(artifact.logicalId ?? "")} v{String(artifact.versionNumber ?? "")}（append-only，未覆蓋舊版）。</p>}
      {onNavigate && summary && <div className="research-actions" style={{ flexWrap: "wrap" }}><button type="button" className="primary-button" onClick={() => onNavigate("evidence")}>下一步：前往文獻與證據中心 →</button></div>}
    </div>}
    {!summary && job?.status === "SUCCEEDED" && <p className="v13-error">結果缺少必要欄位；請重試。</p>}
  </section>;
}
