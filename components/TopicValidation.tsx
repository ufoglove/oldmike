"use client";

import { useEffect, useRef, useState } from "react";

type GapRow = { gap: string; status: string; note: string };
type DecompItem = { label: string; value: string; status: string };
type LedgerEntry = { claim: string; sourceTitle: string; provider: string; year: string | null; doi: string | null; relationship: string; verificationStatus: string };
type Reviewer2 = { question: string; answer: string; severity: string };
type ValidationResult = {
  validationId: string; version: number; decomposition: DecompItem[]; evidence: { ledger: LedgerEntry[]; note: string };
  gapMatrix: GapRow[]; novelty: { level: string; closestStudies: { title: string; year: string | null; doi: string | null }[]; contributionDelta: string[]; answer: string };
  score: { total: number; grade: string }; reviewer2: Reviewer2[]; recommendedNextStep: string; evidenceStatus: string;
};

const GAP_LABELS: Record<string, string> = {
  TECHNOLOGY_GAP: "Technology", POPULATION_GAP: "Population", CONTEXT_GAP: "Context", THEORY_GAP: "Theory", METHOD_GAP: "Method",
  TEMPORAL_GAP: "Temporal", DATA_GAP: "Data", HUMAN_AI_GAP: "Human-AI", IMPLEMENTATION_GAP: "Implementation", CROSS_DOMAIN_GAP: "Cross-domain",
};
const GAP_STATUS_LABELS: Record<string, string> = { CONFIRMED: "Confirmed", LIKELY: "Likely", WEAK: "Weak", NOT_SUPPORTED: "Not Supported", UNVERIFIED: "Unverified" };
const DECOMP_STATUS: Record<string, string> = { PROVIDED: "已確定", INFERRED: "可推論", SUGGESTED: "建議補充", MISSING: "缺少" };
const NOVELTY_LABELS: Record<string, string> = { HIGH: "High Novelty", MODERATE: "Moderate Novelty", LOW: "Low Novelty", POTENTIAL_DUPLICATE: "Potential Duplicate", INSUFFICIENT_EVIDENCE: "Insufficient Evidence" };
const SCORE_GRADES: Record<string, string> = { STRONG_RECOMMEND: "強烈推薦", RECOMMEND: "推薦", CONDITIONAL: "有條件", WEAK: "弱" };
const HISTORY_KEY = "***";

export default function TopicValidation(props: { onAdopt?: (candidate: { titleZh: string; researchQuestion: string }) => void; initialTopic?: { titleZh: string; researchQuestion: string } | null }) {
  const [topic, setTopic] = useState(props.initialTopic?.titleZh || "");
  const [question, setQuestion] = useState(props.initialTopic?.researchQuestion || "");
  const [innovation, setInnovation] = useState("BALANCED");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [duration, setDuration] = useState("1Y");
  const [output, setOutput] = useState("NSTC");
  const [design, setDesign] = useState("QUASI");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [history, setHistory] = useState<{ validationId: string; topic: string; version: number; total: number; grade: string; at: string }[]>([]);
  const versionRef = useRef(1);

  useEffect(() => {
    try { const raw = localStorage.getItem(HISTORY_KEY); if (raw) setHistory(JSON.parse(raw) as typeof history); } catch { /* ignore */ }
  }, []);

  async function validate(optimize: boolean) {
    if (!topic.trim()) { setError("請先輸入研究題目。"); return; }
    setLoading(true); setError("");
    const version = optimize ? versionRef.current + 1 : 1;
    try {
      const response = await fetch("/api/assist/topic-validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "VALIDATE_TOPIC", idempotencyKey: `tv:${Date.now()}:${Math.random().toString(36).slice(2)}`,
          topicTitle: topic, researchQuestion: question || undefined,
          parameters: { innovation, difficulty, duration, output, design },
        }),
      });
      const data = await response.json() as { ok?: boolean; code?: string; error?: string; validationId?: string; version?: number; decomposition?: DecompItem[]; evidence?: ValidationResult["evidence"]; gapMatrix?: GapRow[]; novelty?: ValidationResult["novelty"]; score?: { total: number; grade: string }; reviewer2?: Reviewer2[]; recommendedNextStep?: string; evidenceStatus?: string };
      if (!response.ok || !data.ok || !data.decomposition) throw new Error(data.error || "題目驗證未完成。");
      versionRef.current = data.version || version;
      const next = { validationId: data.validationId || "", topic, version: data.version || version, total: data.score?.total || 0, grade: data.score?.grade || "", at: new Date().toISOString() };
      setResult({ validationId: data.validationId || "", version: data.version || version, decomposition: data.decomposition, evidence: data.evidence || { ledger: [], note: "" }, gapMatrix: data.gapMatrix || [], novelty: data.novelty || { level: "", closestStudies: [], contributionDelta: [], answer: "" }, score: { total: data.score?.total || 0, grade: data.score?.grade || "" }, reviewer2: data.reviewer2 || [], recommendedNextStep: data.recommendedNextStep || "", evidenceStatus: data.evidenceStatus || "UNVERIFIED" });
      try {
        const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as typeof history;
        const merged = [next, ...existing.filter((h) => h.topic !== topic || h.version !== next.version)].slice(0, 12);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
        setHistory(merged);
      } catch { /* ignore */ }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "題目驗證失敗。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="v13-validation" aria-labelledby="v13-validation-title">
      <Panel kicker="老麥 · 研究決策引擎" title="老麥・選題實驗室（深度驗證）" note="對單一候選題目做嚴格驗證：題目解構→文獻驗證→Gap Matrix→Novelty Check→100 分選題評分→Reviewer #2。所有判斷皆為 AI 自評（UNVERIFIED），不得宣稱已驗證。">
        <form className="v13-form validation-form" onSubmit={(event) => { event.preventDefault(); void validate(false); }} aria-busy={loading}>
          <label className="v13-field"><span>研究題目 <em>（必填）</em></span><textarea value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={500} rows={3} placeholder="例如：多模態 AI 驅動的 XR 職業安全訓練對技能遷移的影響" /></label>
          <label className="v13-field"><span>研究問題 <em>（可留空）</em></span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={800} rows={2} placeholder="例如：多模態適應訓練是否優於固定內容訓練？" /></label>
          <div className="validation-params">
            <label className="v13-field"><span>創新程度</span><select value={innovation} onChange={(e) => setInnovation(e.target.value)}><option value="CONSERVATIVE">保守</option><option value="BALANCED">均衡</option><option value="FRONTIER">前沿</option></select></label>
            <label className="v13-field"><span>執行難度</span><select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option value="LOW">低</option><option value="MEDIUM">中</option><option value="HIGH">高</option></select></label>
            <label className="v13-field"><span>研究時間</span><select value={duration} onChange={(e) => setDuration(e.target.value)}><option value="3M">3 個月</option><option value="6M">6 個月</option><option value="1Y">1 年</option><option value="3Y">3 年</option></select></label>
            <label className="v13-field"><span>研究成果</span><select value={output} onChange={(e) => setOutput(e.target.value)}><option value="JOURNAL">快速期刊</option><option value="SSCI">SSCI</option><option value="SCI">SCI</option><option value="Q1Q2">Q1-Q2</option><option value="NSTC">科技部計畫</option><option value="THREE_YEAR">三年計畫</option></select></label>
            <label className="v13-field"><span>研究類型</span><select value={design} onChange={(e) => setDesign(e.target.value)}><option value="SURVEY">Survey</option><option value="EXPERIMENT">Experiment</option><option value="RCT">RCT</option><option value="QUASI">Quasi-experiment</option><option value="LONGITUDINAL">Longitudinal</option><option value="MIXED">Mixed Methods</option><option value="SEM">SEM</option><option value="MULTIMODAL">Multimodal</option><option value="AI_DEV">AI Development</option><option value="FIELD">Field Study</option></select></label>
          </div>
          <button type="submit" className="primary-button" disabled={loading}>{loading ? "老麥正在驗證…" : "執行深度驗證"}</button>
        </form>
        {error && <p className="v13-error" role="alert">{error}</p>}
        {loading && <p className="v13-muted" role="status">正在收集文獻觀察 → 題目解構 → Gap Matrix → Novelty Check → 100 分評分 → Reviewer #2…</p>}
      </Panel>

      {result && !loading && <>
        <Panel kicker={`驗證 ${result.validationId} · v${result.version}`} title="驗證結果">
          <div className="validation-score"><strong>{result.score.total}</strong><small>/100 · {SCORE_GRADES[result.score.grade] || result.score.grade} · {result.evidenceStatus}</small></div>
          {result.recommendedNextStep && <p className="v13-muted"><b>建議下一步：</b>{result.recommendedNextStep}</p>}
          <div className="validation-actions"><button type="button" className="primary-button" onClick={() => void validate(true)}>重新最佳化題目（v{result.version + 1}）</button>{props.onAdopt && <button type="button" className="secondary-button" onClick={() => props.onAdopt?.({ titleZh: topic, researchQuestion: question })}>建立研究專案</button>}</div>
        </Panel>

        <Panel kicker="1 · 題目解構" title="Problem → Population → Variables → Method">
          <div className="validation-decomp">{result.decomposition.map((item) => <div key={item.label} className={`decomp-${item.status.toLowerCase()}`}><dt>{item.label}</dt><dd>{item.value || "（缺少，未自行填補）"}</dd><small>{DECOMP_STATUS[item.status] || item.status}</small></div>)}</div>
        </Panel>

        <Panel kicker="2 · 文獻驗證" title="Evidence Ledger" note={result.evidence.note || "待驗證：不得宣稱已完成搜尋。"}>
          {result.evidence.ledger.length === 0 ? <p className="v13-muted">尚無可追溯的文獻觀察。</p> : <ul className="validation-ledger">{result.evidence.ledger.map((e, i) => <li key={i}><b>{e.relationship}</b> {e.claim} — {e.sourceTitle}{e.year ? `（${e.year}）` : ""} <small>{e.provider} · UNVERIFIED</small></li>)}</ul>}
        </Panel>

        <Panel kicker="3 · Research Gap Matrix" title="10 種 Gap × 證據狀態" note="「沒有搜尋到」≠「世界上沒有人做過」；不足即標 Unverified。">
          <div className="validation-gaps">{result.gapMatrix.map((row) => <div key={row.gap} className={`gap-${row.status.toLowerCase()}`}><strong>{GAP_LABELS[row.gap] || row.gap}</strong><span>{GAP_STATUS_LABELS[row.status] || row.status}</span><p>{row.note}</p></div>)}</div>
        </Panel>

        <Panel kicker="4 · Novelty Check" title={`新穎性：${NOVELTY_LABELS[result.novelty.level] || result.novelty.level}`}>
          <p className="v13-muted"><b>與最相近研究之差異（Contribution Delta）：</b></p>
          {result.novelty.closestStudies.length > 0 && <ul className="validation-ledger">{result.novelty.closestStudies.map((s, i) => <li key={i}>{s.title}{s.year ? `（${s.year}）` : ""}{s.doi ? ` · doi:${s.doi}` : ""}</li>)}</ul>}
          {result.novelty.contributionDelta.length > 0 && <ul className="validation-ledger">{result.novelty.contributionDelta.map((d, i) => <li key={i}>△ {d}</li>)}</ul>}
          <p className="v13-muted">{result.novelty.answer}</p>
        </Panel>

        <Panel kicker="5 · Reviewer #2 Challenge" title="10 道嚴格審查">
          <div className="validation-reviewer">{result.reviewer2.map((r, i) => <div key={i} className={`rv-${r.severity.toLowerCase()}`}><strong>Q{i + 1}. {r.question}</strong><p>{r.answer}</p><small>{r.severity}</small></div>)}</div>
        </Panel>
      </>}

      {history.length > 0 && <Panel kicker="版本歷史" title="驗證版本歷史（本機）"><ul className="validation-history">{history.map((h) => <li key={`${h.validationId}-${h.version}`}><button type="button" className="text-button" onClick={() => { setTopic(h.topic); }}>v{h.version} · {h.total}/100 · {h.grade} · {h.topic.slice(0, 36)}</button></li>)}</ul></Panel>}
    </section>
  );
}

function Panel(props: { kicker: string; title: string; note?: string; children: React.ReactNode }) {
  return <section className="v13-panel" style={{ marginTop: 18 }}><p className="section-kicker">{props.kicker}</p><h3>{props.title}</h3>{props.note && <p className="v13-muted">{props.note}</p>}{props.children}</section>;
}
