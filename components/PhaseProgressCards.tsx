"use client";

import { useCallback, useEffect, useState } from "react";

type Row = Record<string, unknown>;
const text = (v: unknown, fallback = ""): string => typeof v === "string" && v ? v : fallback;

const CENTERS: Array<{ key: string; label: string; tag: string; icon: string }> = [
  { key: "execution", label: "正式研究與執行", tag: "PHASE 10", icon: "chart" },
  { key: "governance", label: "資料治理與 Analysis Dataset", tag: "PHASE 11", icon: "shield" },
  { key: "analysis-lab", label: "分析實驗室", tag: "PHASE 12", icon: "chart" },
  { key: "manuscript", label: "全文寫作工作室", tag: "PHASE 13", icon: "file" },
];

export default function PhaseProgressCards({ projectId, onNavigate }: { projectId: string | null; onNavigate?: (navId: string) => void }) {
  const [states, setStates] = useState<Record<string, { locked: boolean; status: string; loaded: boolean }>>({});

  const loadAll = useCallback(async () => {
    if (!projectId) { setStates({}); return; }
    const next: Record<string, { locked: boolean; status: string; loaded: boolean }> = {};
    await Promise.all(CENTERS.map(async (center) => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/${center.key === "analysis-lab" ? "analysis-lab" : center.key === "governance" ? "data-governance" : center.key === "manuscript" ? "manuscript" : "formal-execution"}`, { cache: "no-store" });
        const json = (await res.json()) as Row;
        next[center.key] = { locked: json.locked === true, status: text((json.summary as Row | null)?.status), loaded: res.status === 200 };
      } catch { next[center.key] = { locked: true, status: "", loaded: false }; }
    }));
    setStates(next);
  }, [projectId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  if (!projectId) return null;
  return <PanelBox states={states} onNavigate={onNavigate} />;
}

function PanelBox({ states, onNavigate }: { states: Record<string, { locked: boolean; status: string; loaded: boolean }>; onNavigate?: (navId: string) => void }) {
  return <section className="v13-panel"><div className="v13-panel-head"><p className="section-kicker">執行至全文進度（10–13）</p><h2>正式執行至全文寫作進度</h2></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      {CENTERS.map((center) => {
        const state = states[center.key];
        const locked = !state || state.locked;
        return <div key={center.key} className="v13-list-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          <strong><span style={{ color: "#666", fontWeight: 500 }}>{center.tag} · </span>{center.label}</strong>
          {state?.loaded ? <span>{locked ? "前置鏈未完成（LOCKED）" : `狀態：${text(state.status)}`}</span> : <span>載入中…</span>}
          {locked && <small style={{ color: "#8a5a00" }}>缺失項目請至對應中心補齊</small>}
          {onNavigate && <button type="button" className="secondary-button" onClick={() => onNavigate(center.key)}>前往中心</button>}
        </div>;
      })}
    </div>
  </section>;
}
