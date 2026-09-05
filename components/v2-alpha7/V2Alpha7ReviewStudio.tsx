"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { V2_ALPHA7_ENTRY_OPTIONS, V2_ALPHA7_PURPOSE_OPTIONS } from "@/lib/v2-alpha7/page-authority";

import styles from "./v2-alpha7.module.css";

type EntryMode = "ALPHA6_MANUSCRIPT" | "PASTED_MANUSCRIPT";
type Purpose = "AUTHOR_PRE_SUBMISSION_REVIEW" | "AUTHOR_REVISION_AND_REVIEWER_RESPONSE" | "INDEPENDENT_REVIEWER_MODE";
type Section = { key: string; text: string; sectionHash: string };
type Alternative = { alternativeId: string; strategy: string; recommended: boolean; revision: string; reason: string; risk: string };
type Finding = {
  findingId: string;
  lens: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "STRENGTH";
  claimState: string;
  sectionKey: string;
  startOffset: number;
  endOffset: number;
  sourceSpan: string;
  sourceSpanHash: string;
  problem: string;
  impact: string;
  requiredEvidence: string;
  action: string;
  alternatives: Alternative[];
  recommendedAlternativeId: string;
};
type Workspace = {
  purpose: Purpose;
  sourceHash: string;
  originalArtifactImmutable: true;
  sourceSections: Section[];
  lensReports: Array<{ lens: string; strengths: string[]; findings: Finding[] }>;
  prioritizedFindings: Finding[];
  responseMatrix: Array<{ commentId: string; interpretation: string; decision: string; revisionLocation: string; before: string; after: string; evidence: string; responseText: string; unresolvedRisk: string }>;
  reviewerReport: null | { strengths: string[]; majorConcerns: string[]; minorConcerns: string[]; methodQuestions: string[]; ethicsReportingQuestions: string[]; editorialRecommendation: string };
  editorialRecommendation: string;
  canApplyAuthorRevision: boolean;
  humanGate: { required: true; scope: "WHOLE_ARTIFACT"; confirmed: false; contentHash: string };
  formalResearchWriteCount: 0;
};
type ApiPayload = { ok: boolean; workspace?: Workspace; code?: string; replayed?: boolean; providerSubmissionCount?: number };

const lensLabels: Record<string, string> = {
  EDITORIAL_CONTRIBUTION: "編輯與貢獻",
  THEORY_ARGUMENT: "理論與論證",
  METHOD_RIGOR: "方法嚴謹度",
  EVIDENCE_ANALYSIS: "證據與分析",
  CLARITY_ETHICS_REPORTING: "清晰、倫理與報告",
};
const severityLabels = { CRITICAL: "關鍵", MAJOR: "重要", MINOR: "次要", STRENGTH: "優點" } as const;
const claimLabels: Record<string, string> = { VERIFIED: "已由稿件內容支持", UNVERIFIED: "尚待核對", ASSUMPTION: "假設", MISSING: "缺少資料" };
const optionLabels: Record<string, string> = { EVIDENCE_CALIBRATED: "證據校準", JOURNAL_CONCISE_RECOMMENDED: "期刊精簡", NATURAL_SCHOLARLY: "自然學術語氣" };
const recommendationLabels: Record<string, string> = { READY: "已可進入人工判斷", MINOR: "小幅修訂", MAJOR: "重大修訂", REDESIGN: "需重新設計", OUT_OF_SCOPE: "超出目前範圍" };
const sectionLabels: Record<string, string> = {
  title: "題目", abstract: "摘要", keywords: "關鍵詞", introduction: "前言", literatureReviewOrTheoreticalFramework: "文獻與理論", methods: "方法", resultsOrPlannedResults: "結果或規劃結果", discussion: "討論", conclusion: "結論", limitations: "限制", tableSpecifications: "表格規格", figureSpecifications: "圖形規格", declarations: "聲明",
};

const defaultDraft = "Evidence calibration may improve teacher decisions in two documented stages [7]. The proposed comparison uses 36 classrooms and reports uncertainty rather than claiming a verified effect. Method, ethics, and data-sharing details remain incomplete.";

export function V2Alpha7ReviewStudio() {
  const [entryMode, setEntryMode] = useState<EntryMode>("ALPHA6_MANUSCRIPT");
  const [purpose, setPurpose] = useState<Purpose>("AUTHOR_PRE_SUBMISSION_REVIEW");
  const [sourceText, setSourceText] = useState(defaultDraft);
  const [reviewerComments, setReviewerComments] = useState("Clarify how the comparison isolates the proposed mechanism.\nTemper the contribution claim until evidence is independently verified.\nExplain why unsupported subgroup analysis is not adopted.");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [draftSections, setDraftSections] = useState<Record<string, string>>({});
  const [undoSections, setUndoSections] = useState<Record<string, string>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("請選擇檢視目的後開始。結果只會形成本機預覽。");
  const [gateRequested, setGateRequested] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  const criticalCount = useMemo(() => workspace?.prioritizedFindings.filter((item) => item.severity === "CRITICAL").length ?? 0, [workspace]);
  const responseRows = useMemo(() => workspace?.responseMatrix.map((item) => {
    const finding = workspace.prioritizedFindings.find((candidate) => candidate.sectionKey === item.revisionLocation && candidate.sourceSpan === item.before);
    const selectedId = finding ? selectedOptions[finding.findingId] ?? finding.recommendedAlternativeId : null;
    const selected = finding?.alternatives.find((option) => option.alternativeId === selectedId);
    return selected ? { ...item, after: selected.revision } : item;
  }) ?? [], [selectedOptions, workspace]);

  useEffect(() => setHydrated(true), []);

  async function runStudio() {
    if (busy || (entryMode === "PASTED_MANUSCRIPT" && sourceText.trim().length < 20) || (purpose === "AUTHOR_REVISION_AND_REVIEWER_RESPONSE" && !reviewerComments.trim())) return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setBusy(true);
    setError("");
    setGateRequested(false);
    setAnnouncement("老麥正在以五個獨立角度檢視稿件。原稿保持不變。");
    requestSequence.current += 1;
    const requestId = `alpha7-ui-${Date.now()}-${requestSequence.current}`;
    const body: Record<string, unknown> = { operation: "RUN_REVIEW_STUDIO", requestId, entryMode, purpose };
    if (entryMode === "ALPHA6_MANUSCRIPT") body.sourceArtifactId = "alpha6-manuscript-alpha7-local";
    else body.sourceText = sourceText;
    if (purpose === "AUTHOR_REVISION_AND_REVIEWER_RESPONSE") body.reviewerComments = reviewerComments.split(/\r?\n/gu).map((item) => item.trim()).filter(Boolean).slice(0, 24);
    try {
      const response = await fetch("/api/v2-alpha7/studio", { method: "POST", headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": "fixture-workspace-v2" }, body: JSON.stringify(body), signal: controller.signal, cache: "no-store" });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.ok || !payload.workspace) throw new Error("studio_unavailable");
      setWorkspace(payload.workspace);
      setDraftSections(Object.fromEntries(payload.workspace.sourceSections.map((section) => [section.key, section.text])));
      setUndoSections({});
      setSelectedOptions(Object.fromEntries(payload.workspace.prioritizedFindings.map((finding) => [finding.findingId, finding.recommendedAlternativeId])));
      setAnnouncement(`檢視完成：五個角度已整合，共 ${payload.workspace.prioritizedFindings.length} 項；尚未套用或正式寫入。`);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") setAnnouncement("已取消本次檢視；原稿與先前預覽均保留。");
      else {
        setError("老麥目前無法完成檢視。原稿與先前內容都沒有被更動，請稍後以新的操作再試一次。");
        setAnnouncement("檢視未完成；原稿保持不變。");
      }
    } finally {
      setBusy(false);
      requestAnimationFrame(() => primaryButtonRef.current?.focus());
    }
  }

  function applyRevision(finding: Finding) {
    if (!workspace?.canApplyAuthorRevision) return;
    const option = finding.alternatives.find((item) => item.alternativeId === selectedOptions[finding.findingId]);
    if (!option) return;
    const current = draftSections[finding.sectionKey];
    const original = workspace.sourceSections.find((item) => item.key === finding.sectionKey)?.text;
    if (current !== original) {
      setError("此段已變更。請先復原，再由目前原稿重新選擇修訂。");
      setAnnouncement("偵測到稿件已變更，未套用新的建議。");
      return;
    }
    const boundSpan = current.slice(finding.startOffset, finding.endOffset);
    if (boundSpan !== finding.sourceSpan) {
      setError("此修訂位置已變更。請先復原，再由目前原稿重新檢視。");
      setAnnouncement("修訂位置已變更，未套用新的建議。");
      return;
    }
    const next = `${current.slice(0, finding.startOffset)}${option.revision}${current.slice(finding.endOffset)}`;
    setUndoSections((previous) => ({ ...previous, [finding.sectionKey]: current }));
    setDraftSections((previous) => ({ ...previous, [finding.sectionKey]: next }));
    setError("");
    setAnnouncement(`${sectionLabels[finding.sectionKey] ?? finding.sectionKey}已套用本機預覽；原稿仍保持不變，可立即復原。`);
  }

  function undoRevision(sectionKey: string) {
    const snapshot = undoSections[sectionKey];
    if (snapshot === undefined) return;
    setDraftSections((previous) => ({ ...previous, [sectionKey]: snapshot }));
    setUndoSections((previous) => { const next = { ...previous }; delete next[sectionKey]; return next; });
    setAnnouncement(`${sectionLabels[sectionKey] ?? sectionKey}已復原到套用前內容。`);
  }

  function requestWholeArtifactReview() {
    if (!workspace || workspace.purpose === "INDEPENDENT_REVIEWER_MODE") return;
    setGateRequested(true);
    setAnnouncement("整份稿件已準備交由人員最後判斷；尚未正式寫入或送出。這不是逐項核准。");
  }

  return <main className={styles.shell} data-testid="alpha7-studio" data-hydrated={hydrated ? "true" : "false"}>
    <header className={styles.masthead}>
      <div>
        <p className={styles.eyebrow}>老麥 · Review Studio</p>
        <h1>把稿件變成可行動的審查與修訂計畫</h1>
        <p>五個獨立視角先讀原稿，再整合優先順序、三種修訂方案與可追溯回覆。所有套用都只發生在本機草稿。</p>
      </div>
      <div className={styles.seal} aria-label="目前邊界：本機預覽，零正式寫入"><span>原稿不動</span><strong>零正式寫入</strong></div>
    </header>

    <section className={styles.intake} aria-labelledby="alpha7-start-title">
      <div className={styles.stepMark}>01</div>
      <div className={styles.intakeBody}>
        <h2 id="alpha7-start-title">這次要怎麼檢視？</h2>
        <div className={styles.controlGrid}>
          <label>稿件來源
            <select value={entryMode} onChange={(event) => setEntryMode(event.target.value as EntryMode)} data-testid="alpha7-entry-mode">
              {V2_ALPHA7_ENTRY_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>目的
            <select value={purpose} onChange={(event) => setPurpose(event.target.value as Purpose)} data-testid="alpha7-purpose">
              {V2_ALPHA7_PURPOSE_OPTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>
        {entryMode === "PASTED_MANUSCRIPT" ? <label className={styles.fullField}>稿件內容
          <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={7} data-testid="alpha7-source-text" />
          <span>{sourceText.length.toLocaleString("zh-TW")} 字；來源位元組會保留，不會被靜默覆寫。</span>
        </label> : <div className={styles.sourceNote} data-testid="alpha7-alpha6-source">已綁定目前 Alpha6 稿件與 13 個段落的內容雜湊；原始版本保持不可變。</div>}
        {purpose === "AUTHOR_REVISION_AND_REVIEWER_RESPONSE" ? <label className={styles.fullField}>審查意見（每行一則）
          <textarea value={reviewerComments} onChange={(event) => setReviewerComments(event.target.value)} rows={4} data-testid="alpha7-reviewer-comments" />
        </label> : null}
        <div className={styles.actions}>
          <button ref={primaryButtonRef} type="button" className={styles.primary} onClick={runStudio} disabled={busy} data-testid="alpha7-run">
            {busy ? "正在整合五個視角…" : purpose === "INDEPENDENT_REVIEWER_MODE" ? "產生獨立唯讀審稿" : "由老麥產生優先審查與修訂方案"}
          </button>
          {busy ? <button type="button" className={styles.quiet} onClick={() => requestController.current?.abort()}>取消</button> : null}
        </div>
        <div className={styles.live} role="status" aria-live="polite" data-testid="alpha7-live">{announcement}</div>
        {error ? <p className={styles.error} role="alert" data-testid="alpha7-error">{error}</p> : null}
      </div>
    </section>

    {workspace ? <>
      <section className={styles.summary} aria-labelledby="alpha7-summary-title" data-testid="alpha7-summary">
        <div><p className={styles.eyebrow}>整合判讀</p><h2 id="alpha7-summary-title">{recommendationLabels[workspace.editorialRecommendation]}</h2><p>關鍵問題 {criticalCount} 項；這是修訂優先順序，不是期刊決定或接受機率。</p></div>
        <dl><div><dt>獨立視角</dt><dd>{workspace.lensReports.length}/5</dd></div><div><dt>可追溯發現</dt><dd>{workspace.prioritizedFindings.length}</dd></div><div><dt>正式寫入</dt><dd>{workspace.formalResearchWriteCount}</dd></div></dl>
      </section>

      <section className={styles.reviewGrid} aria-label="五個獨立審查視角" data-testid="alpha7-lenses">
        {workspace.lensReports.map((report, index) => <article className={styles.lens} key={report.lens} data-testid={`alpha7-lens-${index + 1}`}>
          <span>{String(index + 1).padStart(2, "0")}</span><h3>{lensLabels[report.lens]}</h3><p>{report.strengths[0]}</p>
        </article>)}
      </section>

      {workspace.reviewerReport ? <section className={styles.readOnlyReport} data-testid="alpha7-reviewer-report">
        <div><p className={styles.eyebrow}>獨立審稿 · 唯讀</p><h2>{recommendationLabels[workspace.reviewerReport.editorialRecommendation]}</h2></div>
        <p>本模式只交付優點、重大與次要疑慮、方法問題及倫理／報告問題；不替作者套用修訂，也不冒充作者回覆。</p>
        <ul>{workspace.reviewerReport.majorConcerns.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
      </section> : null}

      <section className={styles.findings} aria-labelledby="alpha7-findings-title">
        <div className={styles.sectionHeading}><div className={styles.stepMark}>02</div><div><p className={styles.eyebrow}>依風險排序</p><h2 id="alpha7-findings-title">逐項修訂工作臺</h2></div></div>
        {workspace.prioritizedFindings.map((finding, index) => <article className={styles.finding} key={finding.findingId} data-testid={`alpha7-finding-${index + 1}`}>
          <header><div><span className={`${styles.badge} ${styles[finding.severity.toLowerCase()]}`}>{severityLabels[finding.severity]}</span><span className={styles.claim}>{claimLabels[finding.claimState]}</span></div><p>{lensLabels[finding.lens]} · {sectionLabels[finding.sectionKey] ?? finding.sectionKey}</p></header>
          <h3>{finding.problem}</h3>
          <blockquote>「{finding.sourceSpan}」</blockquote>
          <div className={styles.findingMeta}><p><strong>影響</strong>{finding.impact}</p><p><strong>需要的證據</strong>{finding.requiredEvidence}</p><p><strong>行動</strong>{finding.action}</p></div>
          {workspace.canApplyAuthorRevision ? <div className={styles.alternatives} role="group" aria-label={`${sectionLabels[finding.sectionKey] ?? finding.sectionKey}的三種修訂方案`}>
            {finding.alternatives.map((option) => <label className={selectedOptions[finding.findingId] === option.alternativeId ? styles.optionSelected : styles.option} key={option.alternativeId}>
              <input type="radio" name={`finding-${finding.findingId}`} value={option.alternativeId} checked={selectedOptions[finding.findingId] === option.alternativeId} onChange={() => setSelectedOptions((previous) => ({ ...previous, [finding.findingId]: option.alternativeId }))} />
              <span><strong>{optionLabels[option.strategy]}{option.recommended ? " · 建議" : ""}</strong><small>{option.reason}</small><em>風險：{option.risk}</em></span>
            </label>)}
            <details><summary>預覽選定修訂</summary><p>{finding.alternatives.find((item) => item.alternativeId === selectedOptions[finding.findingId])?.revision}</p></details>
            <div className={styles.inlineActions}><button type="button" onClick={() => applyRevision(finding)} data-testid={`alpha7-apply-${index + 1}`}>套用到本機草稿</button>{undoSections[finding.sectionKey] !== undefined ? <button type="button" className={styles.quiet} onClick={() => undoRevision(finding.sectionKey)} data-testid={`alpha7-undo-${index + 1}`}>復原</button> : null}</div>
          </div> : <p className={styles.readOnlyBoundary}>唯讀模式：修訂方案供審稿判斷，不提供作者套用操作。</p>}
        </article>)}
      </section>

      {workspace.responseMatrix.length ? <section className={styles.responses} aria-labelledby="alpha7-response-title" data-testid="alpha7-response-matrix">
        <div className={styles.sectionHeading}><div className={styles.stepMark}>03</div><div><p className={styles.eyebrow}>Point-by-point</p><h2 id="alpha7-response-title">審查意見回覆矩陣</h2></div></div>
        <div className={styles.responseScroll}><table><thead><tr><th>意見</th><th>決策</th><th>位置</th><th>回覆與依據</th><th>未解風險</th></tr></thead><tbody>{responseRows.map((item) => <tr key={item.commentId}><td>{item.interpretation}</td><td>{item.decision}</td><td>{sectionLabels[item.revisionLocation] ?? item.revisionLocation}</td><td><p>{item.responseText}</p><small>{item.evidence}</small><details><summary>查看精確變更</summary><p><strong>變更前：</strong>{item.before}</p><p><strong>變更後：</strong>{item.after}</p></details></td><td>{item.unresolvedRisk}</td></tr>)}</tbody></table></div>
      </section> : null}

      <section className={styles.draft} aria-labelledby="alpha7-draft-title" data-testid="alpha7-draft">
        <div className={styles.sectionHeading}><div className={styles.stepMark}>{workspace.responseMatrix.length ? "04" : "03"}</div><div><p className={styles.eyebrow}>本機工作副本</p><h2 id="alpha7-draft-title">修訂後稿件預覽</h2></div></div>
        <div className={styles.draftPaper}>{workspace.sourceSections.map((section) => <section key={section.key}><h3>{sectionLabels[section.key] ?? section.key}</h3><p>{draftSections[section.key]}</p></section>)}</div>
        {workspace.purpose !== "INDEPENDENT_REVIEWER_MODE" ? <div className={styles.gate}>
          <div><strong>整份稿件人工界線</strong><p>只有這裡需要一次整體判斷；不做逐項核准，也不會對外送出。</p></div>
          <button type="button" className={styles.primary} onClick={requestWholeArtifactReview} disabled={gateRequested} data-testid="alpha7-human-gate">{gateRequested ? "已準備人工判斷" : "送交整體人工審查"}</button>
        </div> : null}
      </section>
    </> : null}
  </main>;
}
