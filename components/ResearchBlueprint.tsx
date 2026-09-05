"use client";

import { useCallback, useEffect, useState } from "react";

type BlueprintData = {
  ok: boolean; exists?: boolean; error?: string;
  project?: {
    id: string; projectName: string; projectType: string; currentStage: string; status: string;
    submissionNavigatorId: string | null;
    blueprint: Record<string, unknown>;
    zotero: { libraryType: string | null; collectionKey: string | null; lastSyncedAt: string | null; syncStatus: string };
  };
  literatureSummary?: Record<string, unknown>;
  nextBestAction?: { action: string; reason: string };
};

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function row(value: unknown): Record<string, unknown> { return record(value) ? value : {}; }

const READINESS_DEFS: { key: string; label: string; stage: "ready" | "progress" | "none" }[] = [
  { key: "topic", label: "選題", stage: "ready" },
  { key: "navigator", label: "投稿導航", stage: "ready" },
  { key: "literature", label: "文獻證據", stage: "progress" },
  { key: "framework", label: "研究架構", stage: "none" },
  { key: "design", label: "研究設計", stage: "none" },
  { key: "ethics", label: "研究倫理", stage: "none" },
  { key: "data", label: "資料", stage: "none" },
  { key: "statistics", label: "統計", stage: "none" },
  { key: "manuscript", label: "全文", stage: "none" },
];

export default function ResearchBlueprint({ projectId, onNavigate }: { projectId: string; onNavigate?: (navId: string) => void }) {
  const [data, setData] = useState<BlueprintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError(""); setLoading(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/research-project`, { cache: "no-store" });
      const json = await response.json() as BlueprintData;
      if (!response.ok || !json.ok) throw new Error(text(json.error) || "無法載入研究藍圖。");
      setData(json);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "無法載入研究藍圖。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <section className="v13-panel-stack"><div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">研究藍圖</p><h2>研究藍圖</h2></div></div><p className="v13-muted" role="status">載入中…</p></div></section>;

  if (!data?.exists || !data.project) {
    return (
      <section className="v13-panel-stack" data-testid="research-blueprint">
        <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">研究藍圖</p><h2>研究藍圖</h2></div><p className="v13-panel-note">先到「投稿導航」完成任一分析（Quick Match 或深度分析），再點「建立研究專案」。</p></div>
          {error && <p className="v13-error" role="alert">{error}</p>}
          <div className="v13-empty"><strong>尚未建立研究專案</strong><p>研究藍圖會在建立後自動帶入選題與導航資料，不需重新輸入。</p></div>
        </div>
      </section>
    );
  }

  const b = row(data.project.blueprint);
  const readiness: Record<string, "ready" | "progress" | "none"> = {
    topic: text(b.chinese_title) ? "ready" : "none",
    navigator: data.project.submissionNavigatorId ? "ready" : "none",
    literature: Number(data.literatureSummary?.total ?? 0) > 0 ? "progress" : "none",
    framework: "none", design: "none", ethics: "none", data: "none", statistics: "none", manuscript: "none",
  };
  const s = data.literatureSummary ?? {};
  const targetJournals = list(b.target_journals).slice(0, 5).map((entry) => row(entry));
  const nstcRoute = row(b.nstc_route);
  const moeRoute = row(b.teaching_practice_route);

  return (
    <section className="v13-panel-stack" data-testid="research-blueprint">
      <div className="v13-panel">
        <div className="v13-panel-head">
          <div><p className="section-kicker">RESEARCH BLUEPRINT · 研究藍圖</p><h2>{text(b.chinese_title) || data.project.projectName}</h2></div>
          <p className="v13-panel-note">繼承自選題實驗室與投稿導航；不需要重新輸入。</p>
        </div>
        {error && <p className="v13-error" role="alert">{error}</p>}

        <div className="v13-inline-tags" style={{ marginBottom: 12 }}>
          <span className="v13-badge">{data.project.projectType}</span>
          <span className="v13-badge">Stage {data.project.currentStage}</span>
          <span className="v13-badge">Zotero {text(row(data.project.zotero).syncStatus) || "NOT_LINKED"}</span>
        </div>

        <h3 style={{ margin: "14px 0 8px" }}>基本研究資訊</h3>
        <dl className="v13-details">
          <div><dt>英文題目</dt><dd>{text(b.english_title) || "待確認（missing）"}</dd></div>
          <div><dt>Research Gap</dt><dd>{text(b.research_gap) || "待確認（missing）"}</dd></div>
          <div><dt>Research Questions</dt><dd><ul>{list(b.research_questions).map((q, i) => <li key={i}>{text(q)}</li>)}</ul></dd></div>
          <div><dt>Theory</dt><dd><ul>{list(b.theory).map((t, i) => <li key={i}>{text(t)}</li>)}</ul></dd></div>
          <div><dt>研究對象</dt><dd>{text(b.population) || "待確認（missing）"}</dd></div>
          <div><dt>初步方法</dt><dd>{text(b.methodology) || "待確認（missing）"}</dd></div>
          <div><dt>主要貢獻</dt><dd><ul>{list(b.expected_contribution).map((c, i) => <li key={i}>{text(c)}</li>)}</ul></dd></div>
        </dl>

        <h3 style={{ margin: "14px 0 8px" }}>Target</h3>
        <div className="v13-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <div className="v13-path-station"><strong>期</strong><span>Journal</span><small>{targetJournals.length ? targetJournals.map((j) => text(j.journalName)).join("、").slice(0, 120) : "待深度分析"}</small></div>
          <div className="v13-path-station"><strong>國</strong><span>NSTC</span><small>{text(nstcRoute.routeName) || "待深度分析"}{text(nstcRoute.status) ? ` · ${text(nstcRoute.status)}` : ""}</small></div>
          <div className="v13-path-station"><strong>教</strong><span>教學實踐</span><small>{text(moeRoute.routeName) || "待深度分析"}{text(moeRoute.status) ? ` · ${text(moeRoute.status)}` : ""}</small></div>
        </div>

        <h3 style={{ margin: "14px 0 8px" }}>Research Readiness</h3>
        <div className="v13-readiness" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8 }}>
          {READINESS_DEFS.map((def) => {
            const stage = readiness[def.key] ?? def.stage;
            return <div key={def.key} className="v13-path-station" style={{ opacity: stage === "none" ? 0.55 : 1 }}><strong>{stage === "ready" ? "✓" : stage === "progress" ? "△" : "○"}</strong><span>{def.label}</span><small>{stage === "ready" ? "Ready" : stage === "progress" ? "In Progress" : "Not Started"}</small></div>;
          })}
        </div>

        <h3 style={{ margin: "14px 0 8px" }}>文獻與證據</h3>
        <div className="v13-evidence-contract">
          <p>總文獻：{Number(s.total ?? 0)} ｜ Core：{Number(s.core ?? 0)} ｜ Gap：{Number(s.gap ?? 0)} ｜ Theory：{Number(s.theory ?? 0)} ｜ Method：{Number(s.method ?? 0)}</p>
          <p>Full-text Reviewed：{Number(s.fulltextReviewed ?? 0)} ｜ Verified Evidence：{Number(s.verified ?? 0)} ｜ Zotero Synced：{Number(s.zoteroSynced ?? 0)}</p>
        </div>
        {data.nextBestAction && <div className="v13-panel" style={{ marginTop: 10 }}><div className="v13-panel-head"><div><p className="section-kicker">下一步最佳行動</p><h3>建議下一步</h3></div></div><p className="v13-muted">{text(data.nextBestAction.action)}<br /><small>{text(data.nextBestAction.reason)}</small></p></div>}

        <div className="research-actions" style={{ marginTop: 14 }}>
          <button type="button" className="primary-button" onClick={() => onNavigate?.("evidence")}>開啟本專案文獻</button>
          <button type="button" className="secondary-button" onClick={() => void load()}>重新整理</button>
          {onNavigate && <button type="button" className="secondary-button" onClick={() => onNavigate("navigator")}>返回投稿導航</button>}
        </div>
      </div>
    </section>
  );
}
