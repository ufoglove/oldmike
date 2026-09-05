"use client";

import { useEffect, useRef, useState } from "react";

type Opportunity = {
  opportunityId: string; title: string; trend: string; maturity: string; researchHeat: number; growthSpeed: number; researcherFit: number;
  researchGapLevel: string; saturationLevel: string; opportunityScore: number; grade: string; summary: string; signals: string[];
  relatedTechnologies: string[]; relatedDomains: string[]; gapSignals: string[];
  evidence: { sourceId: string; provider: string; year: string | null; title: string; doi: string | null }[];
  evidenceStatus: string;
};
type RadarResult = { scanId: string; generatedAt: string; focus: string; capability: string; evidenceNote: string; myOpportunities: Opportunity[]; globalOpportunities: Opportunity[] };

const GRADE_LABELS: Record<string, string> = { PRIORITY: "Priority Opportunity", STRONG: "Strong Opportunity", WATCH: "Watch", LOW: "Low Priority" };
const SIGNAL_LABELS: Record<string, string> = { HOT_TREND: "高熱度", RISING_TREND: "成長中", WEAK_SIGNAL: "弱訊號", EMERGING_TECHNOLOGY: "新技術", CONVERGENCE: "交叉", GAP_SIGNAL: "缺口", SATURATION_WARNING: "飽和警示", OPPORTUNITY: "機會" };
const TRACK_KEY = "***";

export default function OpportunityRadar(props: { onSendToInspiration?: (opportunity: Opportunity) => void }) {
  const [view, setView] = useState<"mine" | "global">("mine");
  const [focus, setFocus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RadarResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tracked, setTracked] = useState<string[]>([]);

  useEffect(() => {
    try { const raw = localStorage.getItem(TRACK_KEY); if (raw) setTracked(JSON.parse(raw) as string[]); } catch { /* ignore */ }
  }, []);

  async function scan() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/assist/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "SCAN_OPPORTUNITIES", idempotencyKey: `radar:${Date.now()}:${Math.random().toString(36).slice(2)}`, focus }),
      });
      const data = await response.json() as { ok?: boolean; code?: string; error?: string; scanId?: string; generatedAt?: string; capability?: string; evidenceNote?: string; myOpportunities?: Opportunity[]; globalOpportunities?: Opportunity[] };
      if (!response.ok || !data.ok || !data.myOpportunities) throw new Error(data.error || "前沿掃描未完成。");
      setResult({ scanId: data.scanId || "", generatedAt: data.generatedAt || "", focus, capability: data.capability || "", evidenceNote: data.evidenceNote || "", myOpportunities: data.myOpportunities, globalOpportunities: data.globalOpportunities || [] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "前沿掃描失敗。");
    } finally {
      setLoading(false);
    }
  }

  function toggleTrack(opportunity: Opportunity) {
    try {
      const existing = JSON.parse(localStorage.getItem(TRACK_KEY) || "[]") as unknown[];
      const next = existing.some((e) => (e as { opportunityId?: string }).opportunityId === opportunity.opportunityId)
        ? existing.filter((e) => (e as { opportunityId?: string }).opportunityId !== opportunity.opportunityId)
        : [...existing, { opportunityId: opportunity.opportunityId, title: opportunity.title, radarScore: opportunity.opportunityScore, trackedAt: new Date().toISOString() }];
      localStorage.setItem(TRACK_KEY, JSON.stringify(next));
      setTracked(next.map((e) => (e as { opportunityId: string }).opportunityId));
    } catch { /* ignore */ }
  }

  const list = view === "mine" ? result?.myOpportunities || [] : result?.globalOpportunities || [];

  return (
    <section aria-labelledby="radar-title">
      <Panel kicker="老麥 · 前沿機會雷達" title="老麥・前沿雷達" note="Signal Discovery Engine：只根據實際收集的近期文獻觀察判斷「現在與未來什麼值得研究」。所有訊號與分數皆為 AI 自評（UNVERIFIED），引用前需查證。">
        <div className="radar-tabs" role="tablist" aria-label="前沿視圖">
          <button type="button" role="tab" aria-selected={view === "mine"} className={view === "mine" ? "active" : ""} onClick={() => setView("mine")}>我的前沿</button>
          <button type="button" role="tab" aria-selected={view === "global"} className={view === "global" ? "active" : ""} onClick={() => setView("global")}>全球前沿</button>
        </div>
        <form className="v13-form radar-form" onSubmit={(event) => { event.preventDefault(); void scan(); }} aria-busy={loading}>
          <label className="v13-field"><span>掃描焦點 <em>（可留空：依你的專業自動掃描）</em></span>
            <input value={focus} onChange={(event) => setFocus(event.target.value)} maxLength={300} placeholder="例如：Multimodal AI × XR × 職業安全" />
          </label>
          <button type="submit" className="primary-button" disabled={loading}>{loading ? "老麥正在掃描前沿訊號…" : "開始掃描"}<Icon name="spark" size={15} /></button>
        </form>
        {error && <p className="v13-error" role="alert">{error}</p>}
        {loading && <p className="v13-muted" role="status">正在收集近三年文獻觀察（OpenAlex／Crossref／Semantic Scholar／Consensus）→ 偵測趨勢、缺口、飽和與交叉訊號 → 計算 100 分機會分數…</p>}
        {result && !loading && <p className="radar-meta" role="status">掃描 #{result.scanId} · {result.generatedAt.slice(0, 16).replace("T", " ")} UTC · 來源：{result.capability} · {result.evidenceNote || "待驗證：不得宣稱已完成的搜尋。"}</p>}
      </Panel>

      {result && !loading && <div className="radar-grid">
        {list.map((opportunity) => {
          const isTracked = tracked.includes(opportunity.opportunityId);
          const isOpen = expanded === opportunity.opportunityId;
          return (
            <article className={`radar-card ${opportunity.grade === "PRIORITY" ? "priority" : ""}`} key={opportunity.opportunityId}>
              <header>
                <strong>{opportunity.title}</strong>
                <span className="radar-trend">{opportunity.trend}</span>
                <small className="radar-grade">{GRADE_LABELS[opportunity.grade] || opportunity.grade}</small>
              </header>
              <p className="radar-summary">{opportunity.summary}</p>
              <dl className="radar-metrics">
                <div><dt>成熟度</dt><dd>{opportunity.maturity}</dd></div>
                <div><dt>研究熱度</dt><dd>{opportunity.researchHeat}/100</dd></div>
                <div><dt>成長速度</dt><dd>{opportunity.growthSpeed}/100</dd></div>
                <div><dt>與我的專業吻合</dt><dd>{opportunity.researcherFit}/100</dd></div>
                <div><dt>研究缺口</dt><dd>{opportunity.researchGapLevel}</dd></div>
                <div><dt>飽和度</dt><dd>{opportunity.saturationLevel}</dd></div>
              </dl>
              <div className="radar-score"><strong>{opportunity.opportunityScore}</strong><small>/100 機會分數</small></div>
              {opportunity.signals.length > 0 && <div className="radar-signals">{opportunity.signals.map((s) => <span key={s}>{SIGNAL_LABELS[s] || s}</span>)}</div>}
              {opportunity.gapSignals.length > 0 && <p className="radar-gaps"><b>Gap 訊號：</b>{opportunity.gapSignals.join("；")}</p>}
              <footer>
                <button type="button" className="text-button" onClick={() => setExpanded(isOpen ? null : opportunity.opportunityId)}>{isOpen ? "收起證據" : `查看證據（${opportunity.evidence.length}）`}</button>
                <button type="button" className="text-button" onClick={() => toggleTrack(opportunity)}>{isTracked ? "已追蹤 ✓" : "加入追蹤"}</button>
                <button type="button" className="secondary-button" onClick={() => props.onSendToInspiration?.(opportunity)}>送入一鍵靈感</button>
              </footer>
              {isOpen && <div className="radar-evidence"><p className="section-kicker">證據 · 未驗證</p><ul>{opportunity.evidence.slice(0, 8).map((e, i) => <li key={i}>{e.year ? `[${e.year}] ` : ""}{e.title}{e.doi ? ` · doi:${e.doi}` : ""} <small>({e.provider})</small></li>)}</ul></div>}
            </article>
          );
        })}
        {list.length === 0 && <p className="v13-muted">尚無機會；請先執行掃描。</p>}
      </div>}
    </section>
  );
}

function Panel(props: { kicker: string; title: string; note?: string; children: React.ReactNode }) {
  return <section className="v13-panel"><p className="section-kicker">{props.kicker}</p><h3>{props.title}</h3>{props.note && <p className="v13-muted">{props.note}</p>}{props.children}</section>;
}

function Icon(props: { name: string; size?: number }) {
  return <span aria-hidden="true" style={{ display: "inline-block", width: props.size || 14, textAlign: "center" }}>{props.name === "spark" ? "✦" : "→"}</span>;
}
