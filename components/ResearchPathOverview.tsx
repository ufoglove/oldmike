"use client";

import { useCallback, useEffect, useState } from "react";

type Milestone = {
  key: string;
  label: string;
  stageTag: string;
  navId: string;
  note: string;
  cta: string;
  done: boolean;
};
type OverviewProgressResponse = {
  ok?: boolean;
  milestones?: Milestone[];
  doneCount?: number;
  totalCount?: number;
  nextKey?: string | null;
  projectExists?: boolean;
  error?: string;
};

const QUICK_ENTRIES: Array<{ navId: string; label: string; hint: string }> = [
  { navId: "radar", label: "前沿雷達", hint: "探索升溫方向" },
  { navId: "one-click", label: "一鍵靈感", hint: "老麥依專業與趨勢給 Ideas" },
  { navId: "topic-validation", label: "題目驗證", hint: "解構題目並深度驗證" },
  { navId: "topic-lab", label: "選題實驗室", hint: "比較候選方向" },
  { navId: "quick-start", label: "智慧建立專案", hint: "把方向變成正式專案" },
];

const CHIP_STYLE: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" };

export default function ResearchPathOverview({ projectId, onNavigate }: { projectId: string | null; onNavigate?: (navId: string) => void }) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: OverviewProgressResponse | null }>({ loading: Boolean(projectId), error: "", data: null });

  const load = useCallback(async () => {
    if (!projectId) { setState({ loading: false, error: "", data: null }); return; }
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/overview-progress`, { cache: "no-store" });
      const json = (await res.json()) as OverviewProgressResponse;
      if (!res.ok || json.ok === false || !Array.isArray(json.milestones)) throw new Error(json.error || "路徑進度讀取失敗。");
      setState({ loading: false, error: "", data: json });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "路徑進度讀取失敗。", data: null });
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const data = state.data;
  const milestones = data?.milestones ?? [];
  const doneCount = data?.doneCount ?? 0;
  const totalCount = data?.totalCount ?? (milestones.length || 14);
  const next = milestones.find((m) => !m.done) ?? null;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (!projectId) {
    return <section className="v13-panel"><div className="v13-panel-head"><p className="section-kicker">研究路徑流程總覽</p><h2>還沒建立專案？先從這裡開始</h2></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {QUICK_ENTRIES.map((entry) => <div key={entry.navId} className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          <strong>{entry.label}</strong><small>{entry.hint}</small>
          {onNavigate && <button type="button" className={entry.navId === "quick-start" ? "primary-button" : "secondary-button"} onClick={() => onNavigate(entry.navId)}>開始使用</button>}
        </div>)}
      </div>
    </section>;
  }

  return <section className="v13-panel">
    <div className="v13-panel-head"><p className="section-kicker">研究路徑流程總覽 · 目前進行進度</p><h2>研究路徑與目前進行進度</h2><p className="v13-muted">依實際資料顯示每一站的完成狀態；缺什麼會直接帶你去那一站補齊。</p></div>

    {state.loading && <p role="status" className="v13-muted">正在讀取路徑進度…</p>}
    {!state.loading && state.error && <div className="v13-error" role="alert">{state.error}</div>}

    {!state.loading && !state.error && data && <>
      <div style={{ margin: "8px 0 14px" }} role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={totalCount}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><strong style={{ fontSize: 14 }}>已完成 {doneCount} / {totalCount} 個里程碑</strong><span style={{ fontSize: 13, color: "var(--ink-soft, #5b6b63)" }}>{progress}%</span></div>
        <div style={{ height: 10, borderRadius: 999, background: "#e6ede9", overflow: "hidden" }}><div style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: "linear-gradient(90deg,#0f7a3d,#22a35a)", transition: "width .4s ease" }} /></div>
      </div>

      {next && <div style={{ border: "1px solid #e2b93b", background: "#fff8e1", borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: "1 1 320px" }}><strong style={{ display: "block", marginBottom: 4 }}>⚠️ 目前的缺口：{next.label}（{next.stageTag}）</strong><span style={{ fontSize: 13, color: "#5b4a1e" }}>{next.note}</span></div>
        {onNavigate && <button type="button" className="primary-button" onClick={() => onNavigate(next.navId)}>{next.cta} →</button>}
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
        {milestones.map((m, index) => {
          const isNext = next?.key === m.key;
          const done = m.done;
          const chip: React.CSSProperties = done
            ? { ...CHIP_STYLE, background: "#e5f4ea", color: "#0f7a3d", border: "1px solid #b5dfc6" }
            : isNext
              ? { ...CHIP_STYLE, background: "#fff4d6", color: "#8a5a00", border: "1px solid #e2b93b" }
              : { ...CHIP_STYLE, background: "#eef1ef", color: "#6b7a72", border: "1px solid #d8e0db" };
          return <div key={m.key} className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8, borderLeft: done ? "4px solid #0f7a3d" : isNext ? "4px solid #e2b93b" : "4px solid #d8e0db" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 8 }}>
              <strong style={{ fontSize: 13 }}><span style={{ color: "#66756d", fontWeight: 600 }}>{String(index + 1).padStart(2, "0")} · {m.stageTag}</span><br />{m.label}</strong>
              <span style={chip}>{done ? "✓ 已完成" : isNext ? "下一步" : "待完成"}</span>
            </div>
            <small style={{ color: "#5b6b63" }}>{done ? "已通過里程碑；可前往檢視或繼續下一站。" : m.note}</small>
            {onNavigate && (done
              ? <button type="button" className="secondary-button" onClick={() => onNavigate(m.navId)}>前往查看 →</button>
              : isNext
                ? <button type="button" className="primary-button" onClick={() => onNavigate(m.navId)}>{m.cta} →</button>
                : <button type="button" className="secondary-button" disabled onClick={() => onNavigate(m.navId)}>依序完成前項後開放</button>)}
          </div>;
        })}
      </div>

      <details style={{ marginTop: 14 }}><summary style={{ cursor: "pointer", fontSize: 13, color: "#0f7a3d" }}>還沒有特定想法？試試這些免費起點</summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 10 }}>
          {QUICK_ENTRIES.slice(0, 4).map((entry) => <div key={entry.navId} className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
            <strong style={{ fontSize: 13 }}>{entry.label}</strong><small style={{ color: "#5b6b63" }}>{entry.hint}</small>
            {onNavigate && <button type="button" className="secondary-button" onClick={() => onNavigate(entry.navId)}>開始使用</button>}
          </div>)}
        </div>
      </details>
    </>}
  </section>;
}
