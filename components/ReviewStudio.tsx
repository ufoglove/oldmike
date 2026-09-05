"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Icon from "./Icons";
import ModelModePicker from "./ModelModePicker";
import { OldMikeAssistGroupControl } from "./OldMikeAssistControl";
import type { ReviewDecisionAction, ReviewLens, ReviewSeverity } from "@/lib/review-studio-contract";
import type { ModelModeProfile } from "@/lib/model-mode-contract";

type SourceDocument = { documentVersionId: string; logicalId: string; versionNumber: number; contentHash: string; title: string; stageDetail: string };
type Finding = { findingId: string; lens: ReviewLens; severity: ReviewSeverity; paragraphId: string; startOffset: number; endOffset: number; sourceSpanHash: string; suggestedRevision: string; rationale: string; risk: string; uncertainty: string; action: string };
type Review = { reviewDocumentVersionId: string; logicalId: string; versionNumber: number; title: string; contentHash: string; stage: "REVIEW" | "RE_REVIEW"; cycle: number; sourceDocumentVersionId: string | null; sourceContentHash: string; sourceText: string; resultHash: string; lenses: ReviewLens[]; journalProfile: string; findings: Finding[]; uncertainties: string[]; qualityDelta: number; earlyStopEligible: boolean; maxRevisionLoops: number; appendOnly: true };
type Revision = { documentVersionId: string; logicalId: string; versionNumber: number; title: string; contentHash: string; reviewDocumentVersionId: string; cycle: number; sourceHash: string; resultHash: string; sourceText: string; revisedText: string; paragraphs: Array<{ paragraphId: string; source: string; revised: string }>; decisions: Array<{ findingId: string; action: ReviewDecisionAction; editedText: string | null }>; humanGate: { status: "REQUIRED" | "APPROVED"; id: string | null }; appendOnly: true; sourceOverwritten: false };
type Workspace = { contractVersion: string; maxRevisionLoops: number; sources: SourceDocument[]; reviews: Review[]; revisions: Revision[] };
type DecisionDraft = { action: ReviewDecisionAction; editedText: string };

const lensLabels: Record<ReviewLens, string> = {
  ARGUMENT_STRUCTURE: "論證與結構", METHOD: "方法", EVIDENCE_CLAIM_SUPPORT: "證據與主張支持", CLARITY: "清晰度", TERMINOLOGY: "術語", JOURNAL_FIT: "期刊契合", ETHICS_REPRODUCIBILITY: "倫理與可重現性",
};
const reviewLenses: ReviewLens[] = ["ARGUMENT_STRUCTURE", "METHOD", "EVIDENCE_CLAIM_SUPPORT", "CLARITY", "TERMINOLOGY", "JOURNAL_FIT", "ETHICS_REPRODUCIBILITY"];
const severityLabels: Record<ReviewSeverity, string> = { P0: "P0 阻擋", P1: "P1 實質", P2: "P2 改善" };
const methodParameters = { preserveCitations: true, preserveNumbers: true, preserveUnits: true, preserveFormulas: true, preserveParagraphIdentity: true, explainRecommendations: true, prohibitInventedEvidence: true } as const;

function requestKey(prefix: string) { return `${prefix}:${crypto.randomUUID()}`; }
function paragraphMap(text: string) { return new Map(text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean).map((item, index) => [`p-${String(index + 1).padStart(3, "0")}`, item])); }

export default function ReviewStudio({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [sourceMode, setSourceMode] = useState<"PASTED_TEXT" | "DOCUMENT_VERSION">("PASTED_TEXT"); const [sourceText, setSourceText] = useState(""); const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [title, setTitle] = useState("審稿工作室草稿"); const [journalProfile, setJournalProfile] = useState("目標期刊尚待研究者確認；以審慎、可追溯的學術寫作規範檢視。");
  const [lenses, setLenses] = useState<ReviewLens[]>([...reviewLenses]); const [activeReviewId, setActiveReviewId] = useState(""); const [activeRevisionId, setActiveRevisionId] = useState("");
  const [modeProfile, setModeProfile] = useState<ModelModeProfile>("AUTO");
  const [decisions, setDecisions] = useState<Record<string, DecisionDraft>>({}); const [reviewConfirmed, setReviewConfirmed] = useState(false); const [rationale, setRationale] = useState("");

  const activeReview = useMemo(() => workspace?.reviews.find((item) => item.reviewDocumentVersionId === activeReviewId) || workspace?.reviews[0] || null, [workspace, activeReviewId]);
  const activeRevision = useMemo(() => workspace?.revisions.find((item) => item.documentVersionId === activeRevisionId) || workspace?.revisions[0] || null, [workspace, activeRevisionId]);
  const convergenceReview = useMemo(() => activeRevision ? workspace?.reviews.find((item) => item.sourceDocumentVersionId === activeRevision.documentVersionId && item.cycle === activeRevision.cycle) || null : null, [workspace, activeRevision]);
  const selectedSource = workspace?.sources.find((item) => item.documentVersionId === sourceDocumentId) || null;
  const reviewVersion = Math.max(0, ...(workspace?.reviews.filter((item) => item.logicalId === "m03-review-main").map((item) => item.versionNumber) || [0]));
  const revisionVersion = Math.max(0, ...(workspace?.revisions.filter((item) => item.logicalId === "m03-revision-main").map((item) => item.versionNumber) || [0]));
  const spans = activeReview ? paragraphMap(activeReview.sourceText) : new Map<string, string>();

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/review-studio`, { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; workspace?: Workspace; error?: string };
      if (!response.ok || !data.ok || !data.workspace) throw new Error(data.error || "無法載入審稿版本。");
      setWorkspace(data.workspace); setSourceDocumentId((current) => current || data.workspace?.sources[0]?.documentVersionId || ""); setActiveReviewId((current) => current || data.workspace?.reviews[0]?.reviewDocumentVersionId || ""); setActiveRevisionId((current) => current || data.workspace?.revisions[0]?.documentVersionId || "");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "無法載入審稿版本。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [projectId]);
  useEffect(() => {
    if (!activeReview) return;
    setDecisions(Object.fromEntries(activeReview.findings.map((finding) => [finding.findingId, { action: "REJECT", editedText: "" }])));
  }, [activeReview?.reviewDocumentVersionId]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/review-studio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as { ok?: boolean; error?: string; [key: string]: unknown };
    if (!response.ok || !data.ok) throw new Error(data.error || "操作未通過固定契約。");
    return data;
  }

  async function runInitialReview(event: FormEvent) {
    event.preventDefault(); setBusy("review"); setError(""); setNotice("");
    try {
      const source = sourceMode === "PASTED_TEXT" ? { kind: "PASTED_TEXT", text: sourceText } : selectedSource ? { kind: "DOCUMENT_VERSION", documentVersionId: selectedSource.documentVersionId, contentHash: selectedSource.contentHash } : null;
      if (!source) throw new Error("請選擇既有正式草稿或貼上文字。");
      const data = await post({ operation: "RUN_REVIEW", idempotencyKey: requestKey("m03-review"), logicalId: "m03-review-main", expectedVersion: reviewVersion, title, stage: "REVIEW", cycle: 0, previousReviewDocumentVersionId: null, source, lenses, journalProfile, methodParameters, modeProfile });
      const review = data.review as Review; await load(); setActiveReviewId(review.reviewDocumentVersionId); setNotice("審稿建議已新增為唯讀版本；來源與正式文件均未被覆寫。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "審稿未完成。"); } finally { setBusy(""); }
  }

  function updateDecision(findingId: string, patch: Partial<DecisionDraft>) { setDecisions((current) => ({ ...current, [findingId]: { ...current[findingId], ...patch } })); }

  async function saveRevision() {
    if (!activeReview) return; setBusy("revise"); setError(""); setNotice("");
    try {
      const payload = activeReview.findings.map((finding) => { const decision = decisions[finding.findingId]; if (!decision) throw new Error("每一項建議都必須選擇接受、編輯或拒絕。"); return { findingId: finding.findingId, action: decision.action, editedText: decision.action === "EDIT" ? decision.editedText : null }; });
      const data = await post({ operation: "SAVE_REVISION", idempotencyKey: requestKey("m03-revision"), reviewDocumentVersionId: activeReview.reviewDocumentVersionId, reviewContentHash: activeReview.contentHash, logicalId: "m03-revision-main", expectedVersion: revisionVersion, title: `${title} · 修訂 ${activeReview.cycle + 1}`, decisions: payload });
      const revision = data.revision as Revision; await load(); setActiveRevisionId(revision.documentVersionId); setNotice("已建立 append-only 修訂版本；原始內容未被覆寫。請重新審查後再進入 Human Gate。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "修訂版本未建立。"); } finally { setBusy(""); }
  }

  async function reReview() {
    if (!activeRevision) return; setBusy("re-review"); setError(""); setNotice("");
    try {
      const data = await post({ operation: "RUN_REVIEW", idempotencyKey: requestKey("m03-re-review"), logicalId: "m03-review-main", expectedVersion: reviewVersion, title: `${activeRevision.title} · 重新審查`, stage: "RE_REVIEW", cycle: activeRevision.cycle, previousReviewDocumentVersionId: activeRevision.reviewDocumentVersionId, source: { kind: "DOCUMENT_VERSION", documentVersionId: activeRevision.documentVersionId, contentHash: activeRevision.contentHash }, lenses, journalProfile, methodParameters, modeProfile });
      const review = data.review as Review; await load(); setActiveReviewId(review.reviewDocumentVersionId); setNotice(review.earlyStopEligible ? "重新審查符合 delta＜3 且無 P0；可進入 Human Gate。" : "重新審查完成；仍需處理建議，且最多只允許兩輪修訂。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "重新審查未完成。"); } finally { setBusy(""); }
  }

  async function approve() {
    if (!activeRevision || !convergenceReview || !reviewConfirmed) return; setBusy("approve"); setError(""); setNotice("");
    try {
      await post({ operation: "APPROVE_DOCUMENT", idempotencyKey: requestKey("m03-approval"), documentVersionId: activeRevision.documentVersionId, contentHash: activeRevision.contentHash, reviewDocumentVersionId: convergenceReview.reviewDocumentVersionId, reviewContentHash: convergenceReview.contentHash, rationale });
      setReviewConfirmed(false); setRationale(""); await load(); setNotice("Human Gate 已綁定修訂版本、審稿版本與內容雜湊。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Human Gate 未完成。"); } finally { setBusy(""); }
  }

  async function promote() {
    if (!activeRevision?.humanGate.id) return; setBusy("promote"); setError(""); setNotice("");
    try {
      await post({ operation: "PROMOTE_DOCUMENT", idempotencyKey: requestKey("m03-promotion"), documentVersionId: activeRevision.documentVersionId, contentHash: activeRevision.contentHash, humanGateId: activeRevision.humanGate.id, targetLogicalId: "m03-formal-manuscript", expectedVersion: 0, title: "審稿後正式草稿" });
      setNotice("已新增至正式研究文件；來源與所有歷史版本保持不變。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "正式文件版本未建立。"); } finally { setBusy(""); }
  }

  if (loading) return <section className="v13-panel m03-studio" aria-busy="true"><p>正在載入審稿工作室…</p></section>;
  return <section className="v13-panel m03-studio" aria-labelledby="m03-title">
    <div className="v13-panel-head"><div><p className="section-kicker">M03 · 審查 → 修改 → 再審</p><h2 id="m03-title">審稿工作室</h2></div><p className="v13-panel-note">文字優先、最多兩輪修訂；建議不會直接改寫正式文件。</p></div>
    <ModelModePicker operation="REVIEW_STUDIO" value={modeProfile} onChange={setModeProfile} testId="m03-model-mode" />
    <div className="m03-notice">老麥只提出可追溯建議。不得虛構證據、引文或結果，也不以規避檢測為目標。所有正式推進均需 Human Gate。</div>
    {error && <div className="v13-error" role="alert">{error}</div>}{notice && <div className="v13-success" role="status">{notice}</div>}
    <form className="m03-review-form" onSubmit={runInitialReview}>
      <div className="m03-source-card"><header><div><small>REVIEW INPUT</small><h3>選擇審稿來源</h3></div><Icon name="book" /></header>
        <div className="m03-choice-row"><label><input type="radio" name="m03-source" checked={sourceMode === "PASTED_TEXT"} onChange={() => setSourceMode("PASTED_TEXT")} />貼上文字</label><label><input type="radio" name="m03-source" checked={sourceMode === "DOCUMENT_VERSION"} onChange={() => setSourceMode("DOCUMENT_VERSION")} />既有 Portal 草稿</label></div>
        {sourceMode === "PASTED_TEXT" ? <label>原稿<textarea data-testid="m03-source-text" value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={12} maxLength={48_000} required /></label> : <label>既有版本<select value={sourceDocumentId} onChange={(event) => setSourceDocumentId(event.target.value)} required><option value="">請選擇</option>{workspace?.sources.map((item) => <option key={item.documentVersionId} value={item.documentVersionId}>{item.title} · v{item.versionNumber}</option>)}</select></label>}
        <label>標題<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} required /></label><label>期刊語境<textarea value={journalProfile} onChange={(event) => setJournalProfile(event.target.value)} rows={3} maxLength={1000} required /></label>
        <OldMikeAssistGroupControl projectId={projectId} surface="M03_JOURNAL_PROFILE" groupId="m03-journal-profile" value={{ titleContext: title, journalProfile }} contextOnlyFields={["titleContext"]} modeProfile={modeProfile} onApply={(value) => setJournalProfile(value.journalProfile)} />
      </div>
      <fieldset className="m03-lenses"><legend>審查鏡頭</legend>{reviewLenses.map((lens) => <label key={lens}><input type="checkbox" checked={lenses.includes(lens)} onChange={(event) => setLenses((current) => event.target.checked ? [...current, lens] : current.filter((item) => item !== lens))} />{lensLabels[lens]}</label>)}</fieldset>
      <button type="submit" className="primary-button" data-testid="m03-run-review" disabled={busy !== "" || lenses.length === 0}>{busy === "review" ? "審查中…" : "建立唯讀審稿版本"}</button>
    </form>

    <section className="m03-findings" aria-labelledby="m03-findings-title"><div className="m03-section-head"><div><p className="section-kicker">精確片段發現</p><h3 id="m03-findings-title">建議、風險與處理決策</h3></div>{workspace?.reviews.length ? <select aria-label="審稿版本" value={activeReview?.reviewDocumentVersionId || ""} onChange={(event) => setActiveReviewId(event.target.value)}>{workspace.reviews.map((item) => <option key={item.reviewDocumentVersionId} value={item.reviewDocumentVersionId}>{item.title} · cycle {item.cycle}</option>)}</select> : null}</div>
      {!activeReview ? <div className="v13-empty"><Icon name="book" /><div><strong>尚無審稿版本</strong><p>完成一次審查後，這裡會顯示精確來源範圍、理由、風險與行動。</p></div></div> : <>
        <div className="m03-meta"><span>循環 {activeReview.cycle}/{activeReview.maxRevisionLoops}</span><span>delta {activeReview.qualityDelta}</span><span className={`v13-badge ${activeReview.earlyStopEligible ? "approved" : "required"}`}>{activeReview.earlyStopEligible ? "可提早停止" : "仍需修訂或重審"}</span><span>來源 {activeReview.sourceContentHash.slice(0, 12)}…</span></div>
        {activeReview.findings.length === 0 ? <p className="m03-clear">本輪沒有固定審稿發現；仍需研究者完成完整性核對。</p> : <ol className="m03-finding-list">{activeReview.findings.map((finding) => { const paragraph = spans.get(finding.paragraphId) || ""; const sourceSpan = paragraph.slice(finding.startOffset, finding.endOffset); const decision = decisions[finding.findingId] || { action: "REJECT" as const, editedText: "" }; return <li key={finding.findingId} className={`severity-${finding.severity.toLowerCase()}`}><div className="m03-finding-head"><span className="m03-severity">{severityLabels[finding.severity]}</span><strong>{lensLabels[finding.lens]}</strong><code>{finding.paragraphId}:{finding.startOffset}-{finding.endOffset}</code></div><blockquote>{sourceSpan}</blockquote><dl><div><dt>建議</dt><dd>{finding.suggestedRevision || "（建議刪除）"}</dd></div><div><dt>理由</dt><dd>{finding.rationale}</dd></div><div><dt>風險／不確定性</dt><dd>{finding.risk}；{finding.uncertainty}</dd></div><div><dt>行動</dt><dd>{finding.action}</dd></div></dl><div className="m03-decision"><label>處理<select value={decision.action} onChange={(event) => updateDecision(finding.findingId, { action: event.target.value as ReviewDecisionAction, editedText: "" })}><option value="ACCEPT">接受建議</option><option value="EDIT">編輯後採用</option><option value="REJECT">拒絕</option></select></label>{decision.action === "EDIT" && <label>研究者版本<textarea value={decision.editedText} onChange={(event) => updateDecision(finding.findingId, { editedText: event.target.value })} rows={3} maxLength={6000} required /></label>}</div></li>; })}</ol>}
        {activeReview.cycle < activeReview.maxRevisionLoops && <button type="button" className="primary-button" data-testid="m03-save-revision" onClick={() => void saveRevision()} disabled={busy !== "" || Object.values(decisions).some((item) => item.action === "EDIT" && !item.editedText)}>{busy === "revise" ? "建立修訂中…" : "依選擇建立 append-only 修訂"}</button>}
      </>}
    </section>

    <section className="m03-revisions" aria-labelledby="m03-revisions-title"><div className="m03-section-head"><div><p className="section-kicker">並排與差異</p><h3 id="m03-revisions-title">原文、修訂與差異</h3></div>{workspace?.revisions.length ? <select aria-label="修訂版本" value={activeRevision?.documentVersionId || ""} onChange={(event) => setActiveRevisionId(event.target.value)}>{workspace.revisions.map((item) => <option key={item.documentVersionId} value={item.documentVersionId}>{item.title} · v{item.versionNumber}</option>)}</select> : null}</div>
      {!activeRevision ? <div className="v13-empty"><Icon name="file" /><div><strong>尚無修訂版本</strong><p>接受、編輯或拒絕建議後，才會建立新的 append-only 文件版本。</p></div></div> : <>
        {activeRevision.paragraphs.map((paragraph) => <article className="m03-paragraph" key={paragraph.paragraphId}><h4>{paragraph.paragraphId}</h4><div className="m03-side-by-side"><section><h5>原文</h5><p>{paragraph.source}</p></section><section><h5>修訂後</h5><p>{paragraph.revised}</p></section><section><h5>差異</h5>{paragraph.source === paragraph.revised ? <p>未變更</p> : <p><del>{paragraph.source}</del><ins>{paragraph.revised}</ins></p>}</section></div></article>)}
        <div className="m03-actions"><button type="button" className="secondary-button" data-testid="m03-re-review" onClick={() => void reReview()} disabled={busy !== "" || activeRevision.cycle > (workspace?.maxRevisionLoops || 2)}>{busy === "re-review" ? "重新審查中…" : "重新審查此版本"}</button></div>
        <div className="m03-human-gate"><div><h4>Human Gate</h4><p>只有此修訂版本的最新重新審查符合 delta＜3 且無 P0，才可鎖定內容雜湊並新增到正式文件。</p></div>{activeRevision.humanGate.status === "REQUIRED" ? <div><p>{convergenceReview?.earlyStopEligible ? "審查收斂條件已通過。" : "尚未通過收斂條件；不得正式推進。"}</p><label>核准理由<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} maxLength={2000} /></label><label className="v13-check"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />我已核對主張、方法、引文、數字、單位、公式與段落身分。</label><button type="button" className="primary-button" onClick={() => void approve()} disabled={busy !== "" || !convergenceReview?.earlyStopEligible || !reviewConfirmed || rationale.trim().length < 8}>{busy === "approve" ? "核准中…" : "核准此固定版本"}</button></div> : <div><p className="m03-approved"><Icon name="shield" />此版本已通過 Human Gate。</p><button type="button" className="secondary-button" onClick={() => void promote()} disabled={busy !== ""}>{busy === "promote" ? "新增中…" : "新增至正式文件（不覆寫）"}</button></div>}</div>
      </>}
    </section>
  </section>;
}
