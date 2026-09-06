"use client";

import { useEffect, useRef, useState } from "react";

import {
  RESEARCH_GOAL_DEFINITIONS,
  PRIMARY_GOAL_IDS,
} from "@/lib/research-goal-registry";
import { type ResearchGoalId } from "@/lib/one-click-inspiration-contract";

// Formal goals directly mapped from ResearchGoalRegistry (spec v3.3.0 Section 2/4)
const GOALS: { id: ResearchGoalId; label: string }[] = [
  { id: "AUTO", label: "自動判斷" },
  { id: "JOURNAL_SCI_SSCI", label: RESEARCH_GOAL_DEFINITIONS.JOURNAL_SCI_SSCI.labelZh },
  { id: "NSTC_GENERAL", label: RESEARCH_GOAL_DEFINITIONS.NSTC_GENERAL.labelZh },
  { id: "MOE_TPR", label: RESEARCH_GOAL_DEFINITIONS.MOE_TPR.labelZh },
  { id: "THREE_YEAR", label: "三年研究主軸（長程規劃）" },
];
const RESEARCH_DOMAINS = [
  "AI跨領域應用，AI應用於教育，AI應用於職業安全與教育訓練，AI應用於環境工程與環境資源管理，AI應用於能源管理，VR/AR/XR跨領域應用於職業安全教育訓練與教育應用",
];

type Candidate = {
  candidateId: string; ideaType: "CORE_EXTENSION" | "CROSS_DOMAIN" | "FRONTIER"; titleZh: string; titleEn: string; researchQuestion: string;
  whyWorthwhile: string; primaryGap: string; secondaryGap: string; innovation: string; theory: string; population: string; method: string;
  variables: string; dataSources: string; expectedContribution: string; feasibility: string; difficulty: "LOW" | "MEDIUM" | "HIGH";
  potential: "LOW" | "MEDIUM" | "HIGH"; venue: string; evidenceStatus: "SUPPORTED" | "PROVISIONAL" | "UNVERIFIED"; score: number;
};
type Top3Entry = { candidateId: string; role: "PRIORITY" | "FASTEST" | "PROJECT_SCALE"; reason: string; pros: string[]; risks: string[] };
type ResultData = { judgment: string; evidenceStatus: string; evidenceNote: string; candidates: Candidate[]; top3: Top3Entry[]; sourceCapability?: string };

const PROGRESS_STEPS = ["分析專業與近期文獻", "找到近期研究趨勢", "發現可能的研究缺口", "產生 10 個候選題目", "完成 100 分評分", "推薦 Top 3"];
const ROLE_LABELS: Record<Top3Entry["role"], string> = { PRIORITY: "Top 1 · 最值得優先執行", FASTEST: "Top 2 · 最快可以完成", PROJECT_SCALE: "Top 3 · 最適合發展大型計畫" };
const IDEA_TYPE_LABELS: Record<Candidate["ideaType"], string> = { CORE_EXTENSION: "核心延伸", CROSS_DOMAIN: "跨域拓展", FRONTIER: "前沿突破" };
const LEVEL_LABELS: Record<"LOW" | "MEDIUM" | "HIGH", string> = { LOW: "低", MEDIUM: "中", HIGH: "高" };
const EVIDENCE_LABELS: Record<Candidate["evidenceStatus"], string> = { SUPPORTED: "Supported", PROVISIONAL: "Provisional", UNVERIFIED: "待驗證" };
const LIBRARY_KEY = "oldmik…rary";
const COMPARE_KEY = "oldmik…ueue";

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `inspiration:${crypto.randomUUID()}`;
  return `inspiration:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export default function OneClickInspiration(props: {
  onAdoptCandidate?: (candidate: { titleZh: string; researchQuestion: string }) => void;
  onOpenTopicLab?: (direction: string) => void;
  onSendToTopicLab?: (ideas: Candidate[]) => void;
  radarContext?: { opportunityId: string; title: string; radarScore: number; generatedAt: string } | null;
}) {
  const [researchFocus, setResearchFocus] = useState(props.radarContext ? props.radarContext.title : "");
  const [researchGoal, setResearchGoal] = useState<ResearchGoalId>("AUTO");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultData | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(LIBRARY_KEY); if (raw) setSavedIds(JSON.parse(raw) as string[]); } catch { /* ignore */ }
  }, []);
  useEffect(() => () => { if (stepTimer.current) clearInterval(stepTimer.current); }, []);

  function startSteps() {
    setStepIndex(0);
    if (stepTimer.current) clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => setStepIndex((current) => (current >= PROGRESS_STEPS.length - 1 ? current : current + 1)), 9000);
  }
  function stopSteps() { if (stepTimer.current) { clearInterval(stepTimer.current); stepTimer.current = null; } }

  async function run(regenerate: boolean) {
    setLoading(true); setError("");
    if (!regenerate) { setResult(null); setSelectedIds([]); }
    startSteps();
    try {
      const response = await fetch("/api/assist/one-click-inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "GENERATE_INSPIRATIONS", idempotencyKey: makeIdempotencyKey(), researchFocus, researchGoal, researchDomains: RESEARCH_DOMAINS, radarContext: props.radarContext || undefined }),
      });
      const data = await response.json() as { ok?: boolean; code?: string; error?: string; candidates?: Candidate[]; top3?: Top3Entry[]; judgment?: string; evidenceStatus?: string; evidenceNote?: string; sourceCapability?: string };
      if (!response.ok || !data.ok || !data.candidates) throw new Error(data.error || "一鍵靈感未完成。");
      setResult({ judgment: data.judgment || "", evidenceStatus: data.evidenceStatus || "UNVERIFIED", evidenceNote: data.evidenceNote || "", candidates: data.candidates, top3: data.top3 || [], sourceCapability: data.sourceCapability });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "一鍵靈感失敗。");
    } finally {
      setLoading(false); stopSteps();
    }
  }

  function saveToLibrary(candidate: Candidate) {
    try {
      const existing = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]") as unknown[];
      const item = { candidateId: candidate.candidateId, ideaType: candidate.ideaType, titleZh: candidate.titleZh, titleEn: candidate.titleEn, researchQuestion: candidate.researchQuestion, score: candidate.score, evidenceStatus: candidate.evidenceStatus, savedAt: new Date().toISOString() };
      const next = [...existing.filter((e) => !(typeof e === "object" && e !== null && (e as { candidateId?: string }).candidateId === candidate.candidateId)), item];
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
      setSavedIds(next.map((e) => (e as { candidateId: string }).candidateId));
    } catch { /* ignore */ }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function sendToTopicLab() {
    if (!result) return;
    const selected = result.candidates.filter((c) => selectedIds.includes(c.candidateId));
    if (selected.length === 0) return;
    try {
      const queue = JSON.parse(localStorage.getItem(COMPARE_KEY) || "[]") as unknown[];
      const items = selected.map((c) => ({ candidateId: c.candidateId, ideaType: c.ideaType, titleZh: c.titleZh, researchQuestion: c.researchQuestion, score: c.score, sentAt: new Date().toISOString() }));
      localStorage.setItem(COMPARE_KEY, JSON.stringify([...queue, ...items]));
    } catch { /* ignore */ }
    props.onSendToTopicLab?.(selected);
  }

  function adopt(candidate: Candidate, mode: "project" | "blueprint") {
    const payload = { titleZh: candidate.titleZh, researchQuestion: candidate.researchQuestion };
    if (mode === "blueprint") { props.onOpenTopicLab?.(`${candidate.titleZh}。${candidate.researchQuestion}`); return; }
    props.onAdoptCandidate?.(payload);
  }

  const roleByCandidate = new Map((result?.top3 || []).map((t) => [t.candidateId, t]));

  return (
    <section className="v13-inspiration" aria-labelledby="v13-inspiration-title">
      <Panel kicker="老麥 · 一鍵靈感泉源" title="老麥・一鍵靈感泉源">
        <p className="v13-muted">從前沿趨勢、文獻缺口與個人優勢，生成可執行的期刊與計畫研究方向。所有題目皆為 AI 提案（UNVERIFIED），引用文獻需經查證後才能正式使用。</p>
        {props.radarContext && <p className="v13-radar-origin" role="status">來源：前沿雷達機會 <strong>{props.radarContext.title}</strong>（機會分數 {props.radarContext.radarScore}/100）已自動帶入；產生的 Ideas 會保留此來源鏈。</p>}
        <form className="v13-form inspiration-form" onSubmit={(event) => { event.preventDefault(); void run(false); }} aria-busy={loading}>
          <label className="v13-field"><span>本次想研究的方向 <em>（可不填；留空則由老麥從你的專業中選交叉領域）</em></span>
            <textarea value={researchFocus} onChange={(event) => setResearchFocus(event.target.value)} maxLength={200} rows={3} placeholder="例如：生成式 AI 輔助個人化學習對自主學習的影響" />
          </label>
          <label className="v13-field"><span>本次目標</span>
            <select value={researchGoal} onChange={(event) => setResearchGoal(event.target.value as ResearchGoalId)}>
              {GOALS.map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}
            </select>
          </label>
          <button type="submit" className="primary-button" disabled={loading}>{loading ? "老麥正在產生靈感…" : "啟動一鍵靈感"}<Icon name="spark" size={15} /></button>
        </form>
        {error && <p className="v13-error" role="alert">{error}</p>}
        {loading && <div className="inspiration-progress" role="status" aria-live="polite"><p className="section-kicker">執行中</p><ol>{PROGRESS_STEPS.map((step, index) => <li key={step} className={index < stepIndex ? "done" : index === stepIndex ? "active" : ""}>{index < stepIndex ? "✓ " : ""}{step}</li>)}</ol></div>}
      </Panel>

      {result && !loading && <>
        <Panel kicker="1 · 老麥本次判斷" title="目前值得研究的趨勢" note="判斷基於近期文獻觀察與研究缺口訊號，仍屬 AI 提案，引用前需查證。">
          <p className="inspiration-judgment">{result.judgment}</p>
          <div className="v13-inline-tags"><SourceBadge value={result.evidenceStatus === "UNVERIFIED" ? "UNVERIFIED" : "NEEDS_VERIFICATION"} /><span className="v13-muted">{result.evidenceNote || "待文獻驗證：不得宣稱全球首創或使用未查證數據。"}</span></div>
        </Panel>

        <Panel kicker={`2 · 十個候選題目（已選 ${selectedIds.length} 題）`} title="10 個候選靈感（AI 自評分數 0–100）" note="5 題核心延伸、3 題跨域拓展、2 題前沿突破；每題 Gap、機制、對象、場域、技術、方法、成果皆不同。">
          {selectedIds.length > 0 && <div className="inspiration-compare-bar"><button type="button" className="primary-button" onClick={sendToTopicLab}>送入選題實驗室比較（{selectedIds.length} 題）</button><span className="v13-muted">勾選多題可一起比較。</span></div>}
          <div className="inspiration-grid">
            {result.candidates.map((candidate) => { const top = roleByCandidate.get(candidate.candidateId); const isSaved = savedIds.includes(candidate.candidateId); const isSelected = selectedIds.includes(candidate.candidateId); const isOpen = expandedId === candidate.candidateId;
              return (
                <article className={`inspiration-card ${top ? "top3" : ""} ${isSelected ? "selected" : ""}`} key={candidate.candidateId}>
                  <label className="inspiration-check"><input type="checkbox" checked={isSelected} onChange={() => toggleSelected(candidate.candidateId)} aria-label={`選擇 ${candidate.titleZh}`} /><span>比較</span></label>
                  <header>
                    <span className="inspiration-type">{IDEA_TYPE_LABELS[candidate.ideaType]}</span>
                    <strong>{candidate.titleZh}</strong>
                    {top && <span className="inspiration-top-badge">{ROLE_LABELS[top.role]}</span>}
                    <small>{candidate.titleEn}</small>
                  </header>
                  <dl>
                    <div><dt>研究問題</dt><dd>{candidate.researchQuestion}</dd></div>
                    <div><dt>核心Gap</dt><dd>{candidate.primaryGap}</dd></div>
                    <div><dt>主要創新</dt><dd>{candidate.innovation}</dd></div>
                    <div><dt>可行性／難度</dt><dd>{candidate.feasibility}（{LEVEL_LABELS[candidate.difficulty]}）</dd></div>
                    <div><dt>潛力／投稿</dt><dd>{LEVEL_LABELS[candidate.potential]} 潛力；{candidate.venue}</dd></div>
                  </dl>
                  <div className="inspiration-score" title="AI 自評分數，非錄取保證"><strong>{candidate.score}</strong><small>／100</small></div>
                  <span className={`inspiration-evidence evidence-${candidate.evidenceStatus.toLowerCase()}`}>Evidence：{EVIDENCE_LABELS[candidate.evidenceStatus]}</span>
                  {isOpen && <div className="inspiration-detail"><dl>
                    <div><dt>為什麼值得研究</dt><dd>{candidate.whyWorthwhile}</dd></div>
                    <div><dt>次要Gap</dt><dd>{candidate.secondaryGap}</dd></div>
                    <div><dt>推薦理論</dt><dd>{candidate.theory}</dd></div>
                    <div><dt>研究對象</dt><dd>{candidate.population}</dd></div>
                    <div><dt>研究方法</dt><dd>{candidate.method}</dd></div>
                    <div><dt>主要變數</dt><dd>{candidate.variables}</dd></div>
                    <div><dt>可能資料</dt><dd>{candidate.dataSources}</dd></div>
                    <div><dt>預期貢獻</dt><dd>{candidate.expectedContribution}</dd></div>
                  </dl></div>}
                  <footer>
                    <button type="button" className="text-button" onClick={() => setExpandedId(isOpen ? null : candidate.candidateId)}>{isOpen ? "收起詳細" : "查看詳細"}</button>
                    <button type="button" className="text-button" onClick={() => saveToLibrary(candidate)}>{isSaved ? "已儲存 ✓" : "加入靈感庫"}</button>
                    <button type="button" className="text-button" onClick={() => adopt(candidate, "blueprint")}>送入選題實驗室</button>
                    <button type="button" className="secondary-button" onClick={() => adopt(candidate, "project")}>建立研究專案</button>
                  </footer>
                </article>
              ); })}
          </div>
        </Panel>

        <Panel kicker="3 · Top 3 推薦" title="老麥推薦優先順序" note="推薦理由、優點與執行風險均為 AI 提案。">
          <div className="inspiration-top3">
            {result.top3.map((entry) => { const candidate = result.candidates.find((c) => c.candidateId === entry.candidateId);
              return <article className="inspiration-top3-card" key={entry.role}><h4>{ROLE_LABELS[entry.role]}</h4><strong>{candidate?.titleZh}</strong><p>{entry.reason}</p><div className="v13-list"><p><b>優點</b>{entry.pros.join("；")}</p><p><b>風險</b>{entry.risks.join("；")}</p></div></article>; })}
          </div>
          <div className="inspiration-actions"><button type="button" className="primary-button" onClick={() => void run(true)}>重新發想</button></div>
        </Panel>
      </>}
    </section>
  );
}

function Panel(props: { kicker: string; title: string; note?: string; children: React.ReactNode }) {
  return <section className="v13-panel" style={{ marginTop: 18 }}><p className="section-kicker">{props.kicker}</p><h3>{props.title}</h3>{props.note && <p className="v13-muted">{props.note}</p>}{props.children}</section>;
}

function SourceBadge(props: { value: string }) {
  return <span className="v13-badge">{props.value}</span>;
}

function Icon(props: { name: string; size?: number }) {
  return <span aria-hidden="true" style={{ display: "inline-block", width: props.size || 14, textAlign: "center" }}>{props.name === "spark" ? "✦" : "→"}</span>;
}
