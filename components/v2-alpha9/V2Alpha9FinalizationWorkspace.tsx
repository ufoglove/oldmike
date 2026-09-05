"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./v2-alpha9.module.css";

type Track = "JOURNAL_MANUSCRIPT" | "NSTC_PROPOSAL" | "MOE_PROPOSAL";
type Snapshot = { title: string; sections: Record<string, string> };
type Alternative = {
  alternativeId: string;
  strategy: string;
  label: string;
  text: string;
  recommended: boolean;
};
type PriorityIssue = {
  issueId: string;
  location: string;
  title: string;
  reason: string;
  recommendedAlternativeId: string;
  alternatives: [Alternative, Alternative, Alternative];
};
type FinalizationWorkspace = {
  contractVersion: "old-mike-v2-alpha9/1.0.0";
  requestId: string;
  track: Track;
  status: string;
  sourceArtifactHash: string;
  sourceSnapshot: Snapshot;
  proposedSnapshot: Snapshot;
  priorityIssues: [PriorityIssue, PriorityIssue, PriorityIssue];
  completedCount: number;
  gapCount: number;
  officialComplianceStatus: string | null;
  humanGate: { required: true; confirmed: false; scope: "WHOLE_ARTIFACT"; contentHash: string };
  paperpalBoundary: unknown;
  formalResearchWriteCount: 0;
};

type MobileTab = "FINAL" | "CHANGES" | "GAPS";

const CONTRACT_VERSION = "old-mike-v2-alpha9/1.0.0" as const;
const SECTION_KEYS = [
  "TITLE",
  "ABSTRACT",
  "KEYWORDS",
  "INTRODUCTION_OR_PROBLEM",
  "LITERATURE_OR_POLICY_CONTEXT",
  "RESEARCH_QUESTIONS_OR_AIMS",
  "METHODS_OR_IMPLEMENTATION",
  "RESULTS_OR_EXPECTED_OUTCOMES",
  "DISCUSSION_OR_SIGNIFICANCE",
  "CONCLUSION_OR_IMPACT",
  "LIMITATIONS_OR_RISKS",
  "REFERENCES",
  "DECLARATIONS_OR_ATTACHMENTS",
] as const;
const REVISION_STRATEGIES = ["EVIDENCE_CALIBRATED", "STRUCTURE_RECOMMENDED", "CROSS_DISCIPLINARY_CLARITY"] as const;
const JOURNAL_STATUSES = ["FINAL_CONFIRMABLE", "READY_WITH_GAPS", "BLOCKED_EVIDENCE_OR_INTEGRITY"] as const;
const PROPOSAL_STATUSES = ["READY", "READY_WITH_GAPS", "NOT_READY"] as const;
const COMPLIANCE_STATUSES = ["PASS_OFFICIAL_CURRENT", "BLOCKED_SOURCE_AUTHORITY", "BLOCKED_SOURCE_FRESHNESS"] as const;
const TRACKS: ReadonlyArray<{ id: Track; label: string; detail: string; fixtureSeed: string }> = [
  { id: "JOURNAL_MANUSCRIPT", label: "國際期刊論文", detail: "接續半成品或完整稿，檢查論證、方法統計、引用、圖表、期刊契合與語言。", fixtureSeed: "alpha8-journal-handoff" },
  { id: "NSTC_PROPOSAL", label: "國科會研究計畫", detail: "總審研究問題、方法、工作包、KPI、預算、附件與當年度規範狀態。", fixtureSeed: "alpha5-nstc-handoff" },
  { id: "MOE_PROPOSAL", label: "教育部教學實踐研究計畫", detail: "總審教學問題、介入、評量、工作包、經費、附件與當年度規範狀態。", fixtureSeed: "alpha5-moe-handoff" },
] as const;

const SECTION_LABELS: Record<string, string> = {
  TITLE: "題目",
  ABSTRACT: "摘要",
  KEYWORDS: "關鍵字",
  INTRODUCTION_OR_PROBLEM: "前言與問題",
  LITERATURE_OR_POLICY_CONTEXT: "文獻或政策脈絡",
  RESEARCH_QUESTIONS_OR_AIMS: "研究問題與目標",
  METHODS_OR_IMPLEMENTATION: "方法或執行方案",
  RESULTS_OR_EXPECTED_OUTCOMES: "結果或預期成果",
  DISCUSSION_OR_SIGNIFICANCE: "討論與重要性",
  CONCLUSION_OR_IMPACT: "結論與影響",
  LIMITATIONS_OR_RISKS: "限制與風險",
  REFERENCES: "參考文獻",
  DECLARATIONS_OR_ATTACHMENTS: "聲明或附件",
};

const TRACK_LABELS: Record<Track, string> = Object.fromEntries(TRACKS.map((item) => [item.id, item.label])) as Record<Track, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readSnapshot(value: unknown, proposed: boolean): Snapshot | null {
  if (!isRecord(value) || !nonEmptyString(value.title) || !isRecord(value.sections)) return null;
  const entries = Object.entries(value.sections);
  if (entries.length === 0 || entries.some(([key, text]) => !nonEmptyString(key) || typeof text !== "string")) return null;
  if (proposed && entries.some(([, text]) => !(text as string).trim())) return null;
  if (!proposed && !entries.some(([, text]) => (text as string).trim())) return null;
  return { title: value.title, sections: Object.fromEntries(entries) as Record<string, string> };
}

function readIssue(value: unknown): PriorityIssue | null {
  if (!isRecord(value) || !nonEmptyString(value.issueId) || !nonEmptyString(value.location) || !nonEmptyString(value.title) || !nonEmptyString(value.reason) || !nonEmptyString(value.recommendedAlternativeId) || !Array.isArray(value.alternatives) || value.alternatives.length !== 3) return null;
  const alternatives = value.alternatives.map((candidate) => {
    if (!isRecord(candidate) || !nonEmptyString(candidate.alternativeId) || !nonEmptyString(candidate.strategy) || !nonEmptyString(candidate.label) || !nonEmptyString(candidate.text) || typeof candidate.recommended !== "boolean") return null;
    return { alternativeId: candidate.alternativeId, strategy: candidate.strategy, label: candidate.label, text: candidate.text, recommended: candidate.recommended } satisfies Alternative;
  });
  if (alternatives.some((candidate) => candidate === null)) return null;
  const typed = alternatives as [Alternative, Alternative, Alternative];
  if (new Set(typed.map((candidate) => candidate.alternativeId)).size !== 3) return null;
  if (new Set(typed.map((candidate) => candidate.strategy)).size !== 3 || REVISION_STRATEGIES.some((strategy) => !typed.some((candidate) => candidate.strategy === strategy)) || new Set(typed.map((candidate) => candidate.label)).size !== 3) return null;
  const recommended = typed.filter((candidate) => candidate.recommended);
  if (recommended.length !== 1 || recommended[0].alternativeId !== value.recommendedAlternativeId) return null;
  if (new Set(typed.map((candidate) => candidate.text.trim())).size !== 3) return null;
  return { issueId: value.issueId, location: value.location, title: value.title, reason: value.reason, recommendedAlternativeId: value.recommendedAlternativeId, alternatives: typed };
}

function parseWorkspace(value: unknown, expectedTrack: Track, expectedRequestId: string): FinalizationWorkspace | null {
  if (!isRecord(value) || value.contractVersion !== CONTRACT_VERSION || value.requestId !== expectedRequestId || value.track !== expectedTrack || !nonEmptyString(value.status) || typeof value.sourceArtifactHash !== "string" || !/^[0-9a-f]{64}$/u.test(value.sourceArtifactHash)) return null;
  if (expectedTrack === "JOURNAL_MANUSCRIPT" ? !JOURNAL_STATUSES.includes(value.status as (typeof JOURNAL_STATUSES)[number]) : !PROPOSAL_STATUSES.includes(value.status as (typeof PROPOSAL_STATUSES)[number])) return null;
  const sourceSnapshot = readSnapshot(value.sourceSnapshot, false);
  const proposedSnapshot = readSnapshot(value.proposedSnapshot, true);
  if (!sourceSnapshot || !proposedSnapshot || !Array.isArray(value.priorityIssues) || value.priorityIssues.length !== 3) return null;
  const sourceKeys = Object.keys(sourceSnapshot.sections);
  const proposedKeys = Object.keys(proposedSnapshot.sections);
  if (sourceKeys.length !== SECTION_KEYS.length || proposedKeys.length !== SECTION_KEYS.length || sourceKeys.some((key, index) => key !== SECTION_KEYS[index]) || proposedKeys.some((key, index) => key !== SECTION_KEYS[index])) return null;
  const issues = value.priorityIssues.map(readIssue);
  if (issues.some((issue) => issue === null) || new Set(issues.map((issue) => issue?.issueId)).size !== 3 || new Set(issues.map((issue) => issue?.location)).size !== 3) return null;
  if (issues.some((issue) => !issue || !SECTION_KEYS.includes(issue.location as (typeof SECTION_KEYS)[number]))) return null;
  if (!Number.isInteger(value.completedCount) || (value.completedCount as number) < 0 || !Number.isInteger(value.gapCount) || (value.gapCount as number) < 0) return null;
  if ((value.completedCount as number) + (value.gapCount as number) !== SECTION_KEYS.length) return null;
  if (expectedTrack === "JOURNAL_MANUSCRIPT" ? value.officialComplianceStatus !== null : !COMPLIANCE_STATUSES.includes(value.officialComplianceStatus as (typeof COMPLIANCE_STATUSES)[number])) return null;
  if (!isRecord(value.humanGate) || value.humanGate.required !== true || value.humanGate.confirmed !== false || value.humanGate.scope !== "WHOLE_ARTIFACT" || typeof value.humanGate.contentHash !== "string" || !/^[0-9a-f]{64}$/u.test(value.humanGate.contentHash)) return null;
  const paperpalBoundaryValid = expectedTrack === "JOURNAL_MANUSCRIPT"
    ? isRecord(value.paperpalBoundary)
      && value.paperpalBoundary.mode === "MANUAL_DOCX_EXPORT_IMPORT_UNCONFIGURED"
      && value.paperpalBoundary.status === "UNCONFIGURED"
      && value.paperpalBoundary.liveConnection === false
      && value.paperpalBoundary.sourceMutation === "FORBIDDEN"
      && value.paperpalBoundary.importedCandidateMayUpgradeEvidence === false
      && value.paperpalBoundary.trackedDocxSemanticMerge === "NOT_IMPLEMENTED"
    : value.paperpalBoundary === null;
  if (!paperpalBoundaryValid || value.formalResearchWriteCount !== 0) return null;
  return {
    contractVersion: CONTRACT_VERSION,
    requestId: value.requestId,
    track: expectedTrack,
    status: value.status,
    sourceArtifactHash: value.sourceArtifactHash,
    sourceSnapshot,
    proposedSnapshot,
    priorityIssues: issues as [PriorityIssue, PriorityIssue, PriorityIssue],
    completedCount: value.completedCount as number,
    gapCount: value.gapCount as number,
    officialComplianceStatus: value.officialComplianceStatus as string | null,
    humanGate: value.humanGate as FinalizationWorkspace["humanGate"],
    paperpalBoundary: value.paperpalBoundary,
    formalResearchWriteCount: 0,
  };
}

function copySnapshot(snapshot: Snapshot): Snapshot {
  return { title: snapshot.title, sections: { ...snapshot.sections } };
}

function statusLabel(status: string) {
  if (status.includes("BLOCKED") || status.includes("NOT_READY")) return "仍有必要缺口";
  if (status.includes("GAP")) return "可完成，仍需核對";
  return "已形成可校閱成果";
}

function complianceLabel(status: string | null) {
  if (!status) return "不適用";
  if (status.includes("PASS") || status.includes("CURRENT")) return "已有當年度來源，可進行最終人工核對";
  if (status.includes("FRESHNESS") || status.includes("STALE") || status.includes("MIXED")) return "來源年度或時效仍需更新";
  return "尚待可信的當年度官方來源核對";
}

export function V2Alpha9FinalizationWorkspace() {
  const [track, setTrack] = useState<Track>("JOURNAL_MANUSCRIPT");
  const [workspace, setWorkspace] = useState<FinalizationWorkspace | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [workingSnapshot, setWorkingSnapshot] = useState<Snapshot | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("請選擇成果類型，老麥會載入既有材料並完成一次總審。");
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [mobileTab, setMobileTab] = useState<MobileTab>("FINAL");
  const [previewUsesWorking, setPreviewUsesWorking] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const requestIdentity = useRef<{ requestId: string; idempotencyKey: string; track: Track } | null>(null);

  useEffect(() => {
    if (workspace) resultHeading.current?.focus();
  }, [workspace]);

  useEffect(() => {
    if (currentStep === 4) previewHeading.current?.focus();
  }, [currentStep]);

  const stagedSnapshot = useMemo(() => {
    if (!workspace) return null;
    const next = copySnapshot(workspace.proposedSnapshot);
    workspace.priorityIssues.forEach((issue) => {
      const selectedId = selectedOptions[issue.issueId] ?? issue.recommendedAlternativeId;
      const option = issue.alternatives.find((candidate) => candidate.alternativeId === selectedId);
      if (option && Object.prototype.hasOwnProperty.call(next.sections, issue.location)) next.sections[issue.location] = option.text;
    });
    return next;
  }, [selectedOptions, workspace]);

  const previewSnapshot = previewUsesWorking ? workingSnapshot : stagedSnapshot;

  function resetForTrack(nextTrack: Track) {
    setTrack(nextTrack);
    setWorkspace(null);
    setSelectedOptions({});
    setWorkingSnapshot(null);
    setUndoSnapshot(null);
    setError("");
    setCurrentStep(1);
    setMobileTab("FINAL");
    setPreviewUsesWorking(false);
    requestIdentity.current = null;
    setAnnouncement(`已選擇${TRACK_LABELS[nextTrack]}；尚未開始總審。`);
  }

  async function runFinalization() {
    const authority = TRACKS.find((item) => item.id === track)!;
    const identity = requestIdentity.current?.track === track
      ? requestIdentity.current
      : { requestId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), track };
    requestIdentity.current = identity;
    setBusy(true);
    setError("");
    setCurrentStep(2);
    setAnnouncement("老麥正在整合來源並完成一次總審；目前內容不會被覆寫。");
    try {
      const response = await fetch("/api/v2-alpha9/finalize", {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-old-mike-v2-workspace": "fixture-workspace-v2",
        },
        body: JSON.stringify({ contractVersion: CONTRACT_VERSION, requestId: identity.requestId, idempotencyKey: identity.idempotencyKey, track, fixtureSeed: authority.fixtureSeed }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(body) || body.ok !== true) {
        const code = isRecord(body) && typeof body.code === "string" ? body.code : `HTTP_${response.status}`;
        throw new Error(code);
      }
      const parsed = parseWorkspace(body.workspace, track, identity.requestId);
      if (!parsed) throw new Error("FINALIZATION_RESPONSE_CONTRACT_INVALID");
      const defaults = Object.fromEntries(parsed.priorityIssues.map((issue) => [issue.issueId, issue.recommendedAlternativeId]));
      setWorkspace(parsed);
      setSelectedOptions(defaults);
      setWorkingSnapshot(copySnapshot(parsed.sourceSnapshot));
      setUndoSnapshot(null);
      setPreviewUsesWorking(false);
      setCurrentStep(3);
      setAnnouncement("總審完成。已列出三項優先修正，預設採用老麥推薦；目前尚未套用。" );
    } catch (caught) {
      setCurrentStep(1);
      setError(caught instanceof Error ? `這次總審未完成（${caught.message}）；目前內容已完整保留。` : "這次總審未完成；目前內容已完整保留。");
      setAnnouncement("總審未完成，沒有套用或寫入任何內容。" );
    } finally {
      setBusy(false);
    }
  }

  function chooseAlternative(issue: PriorityIssue, alternative: Alternative) {
    if (undoSnapshot) {
      setWorkingSnapshot(copySnapshot(undoSnapshot));
      setUndoSnapshot(null);
    }
    setSelectedOptions((current) => ({ ...current, [issue.issueId]: alternative.alternativeId }));
    setPreviewUsesWorking(false);
    setAnnouncement(`「${issue.title}」已切換為${alternative.label}，只更新整份預覽，尚未套用。`);
  }

  function openPreview() {
    setCurrentStep(4);
    setAnnouncement("已開啟整份成果預覽；可一次套用，原稿可完整復原。" );
  }

  function applyWholeArtifact() {
    if (!stagedSnapshot || !workingSnapshot || undoSnapshot) return;
    setUndoSnapshot(copySnapshot(workingSnapshot));
    setWorkingSnapshot(copySnapshot(stagedSnapshot));
    setPreviewUsesWorking(true);
    setAnnouncement("老麥推薦已套用到本機工作副本；來源原稿仍保留，可完整復原。" );
  }

  function undoWholeArtifact() {
    if (!undoSnapshot) return;
    setWorkingSnapshot(copySnapshot(undoSnapshot));
    setUndoSnapshot(null);
    setPreviewUsesWorking(true);
    setAnnouncement("已完整復原套用前的工作稿。" );
  }

  function renderPaper(snapshot: Snapshot, mobile = false) {
    return <article className={styles.paper} data-testid={mobile ? "alpha9-mobile-paper" : "alpha9-paper"}>
      <h3>{snapshot.title}</h3>
      {Object.entries(snapshot.sections).map(([key, text]) => <section id={mobile ? undefined : `alpha9-section-${key}`} key={key} data-section-key={key}>
        <h4>{SECTION_LABELS[key] ?? key}</h4>
        <p>{text || "尚待補齊"}</p>
      </section>)}
    </article>;
  }

  function renderChangeRail() {
    if (!workspace) return null;
    return <aside className={styles.changeRail} data-testid="alpha9-change-rail">
      <strong>本次優先修正</strong>
      <ul>{workspace.priorityIssues.map((issue) => {
        const selected = issue.alternatives.find((item) => item.alternativeId === (selectedOptions[issue.issueId] ?? issue.recommendedAlternativeId));
        return <li key={issue.issueId}><b>{issue.title}</b><br />{selected?.label ?? "老麥推薦"}</li>;
      })}</ul>
      {workspace.track !== "JOURNAL_MANUSCRIPT" && <div className={styles.compliance}>當年度官方規範：{complianceLabel(workspace.officialComplianceStatus)}</div>}
      {workspace.track === "JOURNAL_MANUSCRIPT" && <div className={styles.compliance}>外部校閱：目前僅保留手動匯出／回匯邊界，不會自動連線或覆寫原稿。</div>}
    </aside>;
  }

  const selectedTrack = TRACKS.find((item) => item.id === track)!;
  const stepLabels = ["成果與來源", "一次總審", "優先修正", "整份預覽"];

  return <main className={styles.shell} data-testid="alpha9-workspace" data-formal-write-count={workspace?.formalResearchWriteCount ?? 0}>
    <header className={styles.topbar}>
      <div className={styles.brand}><strong>老麥科研作業系統</strong><span>終稿收斂工作台</span></div>
      <span className={styles.boundary}>本機預覽 · 原稿保留</span>
    </header>

    <section className={styles.hero}>
      <p className={styles.eyebrow}>One research truth · one final review</p>
      <h1>把現有成果，收斂成一份可專業校閱的完整成品。</h1>
      <p>不必重貼內容。老麥會接續既有研究材料，一次找出最重要的三項修正，再讓你整份預覽、套用或完整復原。</p>
    </section>

    <ol className={styles.steps} aria-label="終稿收斂進度">{stepLabels.map((label, index) => {
      const step = (index + 1) as 1 | 2 | 3 | 4;
      return <li key={label} className={step === currentStep ? styles.active : step < currentStep ? styles.done : undefined} aria-current={step === currentStep ? "step" : undefined}><span>{step < currentStep ? "✓" : step}</span>{label}</li>;
    })}</ol>

    <section className={styles.panel} aria-labelledby="alpha9-start-title">
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>01 · Continue from existing work</p><h2 id="alpha9-start-title">這次要完成哪一份成果？</h2><p>工作台會從既有本機成果載入，不要求重新整理或貼上內容。</p></div><span className={styles.counter}>只需選擇一次</span></div>
      <div className={styles.sourceGrid}>
        <label className={styles.trackField}>成果類型
          <select data-testid="alpha9-track" value={track} onChange={(event) => resetForTrack(event.target.value as Track)} disabled={busy}>
            {TRACKS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <small>{selectedTrack.detail}</small>
        </label>
        <article className={styles.sourceCard}><span>已準備載入</span><strong>{track === "JOURNAL_MANUSCRIPT" ? "半成品、研究藍圖與分析狀態" : "計畫草稿、工作包與經費資料"}</strong><small>來源會以內容雜湊綁定。總審不會直接改動原始成果。</small></article>
      </div>
      {!workspace && <button className={styles.primary} data-testid="alpha9-finalize" type="button" disabled={busy} onClick={() => void runFinalization()}>{busy ? "老麥正在完成總審…" : "由老麥一次完成總審"}</button>}
      {error && <p className={styles.error} role="alert" data-testid="alpha9-error">{error}</p>}
    </section>

    {workspace && <section className={styles.result} aria-labelledby="alpha9-result-title" data-testid="alpha9-result">
      <div className={styles.sectionHead}><div><p className={styles.eyebrow}>02 · Final review summary</p><h2 id="alpha9-result-title" tabIndex={-1} ref={resultHeading}>老麥已完成整體判讀</h2><p>先看結論，再處理最重要的三項修正。底層檢查已整合，不需要逐項操作審查工具。</p></div><span className={styles.counter}>{TRACK_LABELS[workspace.track]}</span></div>
      <div className={styles.summary}>
        <article><span>整體狀態</span><strong>{statusLabel(workspace.status)}</strong><p>來源原稿已保留；目前正式研究寫入為 {workspace.formalResearchWriteCount}。</p></article>
        <article><span>正文區段已完成</span><strong>{workspace.completedCount} / 13</strong><small>可直接進入整份校閱的內容區段</small></article>
        <article><span>正文區段待核對</span><strong>{workspace.gapCount} / 13</strong><small>與總審維度、官方規範狀態分開計算</small></article>
        <article><span>優先修正</span><strong>{workspace.priorityIssues.length}</strong><small>只先處理最影響品質的問題</small></article>
      </div>

      <section aria-labelledby="alpha9-issues-title">
        <div className={styles.sectionHead}><div><p className={styles.eyebrow}>03 · Three priorities only</p><h3 id="alpha9-issues-title">先完成三項最重要修正</h3><p>預設只顯示老麥推薦；想比較時才展開另外兩案，避免每欄同時出現大量選項。</p></div></div>
        <div className={styles.issues}>{workspace.priorityIssues.map((issue, index) => {
          const selectedId = selectedOptions[issue.issueId] ?? issue.recommendedAlternativeId;
          const selected = issue.alternatives.find((candidate) => candidate.alternativeId === selectedId)!;
          const otherOptions = issue.alternatives.filter((candidate) => candidate.alternativeId !== selectedId);
          return <article className={styles.issue} key={issue.issueId} data-testid="alpha9-priority-issue">
            <header><span className={styles.rank}>{index + 1}</span><div><h4>{issue.title}</h4><p>{issue.reason}</p></div></header>
            <div className={styles.recommendation}><span>{selected.recommended ? "老麥推薦" : "目前比較版本"} · {selected.label}</span><p>{selected.text}</p></div>
            <details className={styles.alternatives}><summary>比較其他 2 個專業版本</summary><div className={styles.optionList}>{otherOptions.map((alternative) => <article className={styles.option} key={alternative.alternativeId}><strong>{alternative.label}</strong><p>{alternative.text}</p><button className={styles.optionButton} type="button" onClick={() => chooseAlternative(issue, alternative)}>改用這個版本</button></article>)}</div></details>
          </article>;
        })}</div>
        {currentStep < 4 && <button type="button" className={styles.primary} data-testid="alpha9-open-preview" onClick={openPreview}>檢視整份成果</button>}
      </section>

      {currentStep === 4 && stagedSnapshot && previewSnapshot && <section aria-labelledby="alpha9-preview-title" data-testid="alpha9-preview">
        <div className={styles.sectionHead}><div><p className={styles.eyebrow}>04 · Whole artifact preview</p><h3 id="alpha9-preview-title" tabIndex={-1} ref={previewHeading}>整份成果預覽</h3><p>一次套用到本機工作副本；原始來源不變，並可完整復原。</p></div><span className={styles.counter}>{Object.keys(previewSnapshot.sections).length} 個內容區段</span></div>

        <div className={`${styles.previewShell} ${styles.desktopPreview}`}>
          <nav className={styles.toc} aria-label="成果章節"><strong>內容目錄</strong>{Object.keys(previewSnapshot.sections).map((key) => <button key={key} type="button" onClick={() => document.getElementById(`alpha9-section-${key}`)?.scrollIntoView({ block: "start" })}>{SECTION_LABELS[key] ?? key}</button>)}</nav>
          {renderPaper(previewSnapshot)}
          {renderChangeRail()}
        </div>

        <div className={styles.mobileTabs}>
          <div className={styles.tabList} role="tablist" aria-label="整份成果檢視">
            {(["FINAL", "CHANGES", "GAPS"] as const).map((tab) => <button id={`alpha9-tab-${tab}`} aria-controls="alpha9-mobile-tabpanel" key={tab} type="button" role="tab" aria-selected={mobileTab === tab} className={mobileTab === tab ? styles.tabActive : undefined} onClick={() => setMobileTab(tab)}>{tab === "FINAL" ? "終稿" : tab === "CHANGES" ? "本次修改" : "待核對"}</button>)}
          </div>
          <div id="alpha9-mobile-tabpanel" className={styles.mobilePane} role="tabpanel" aria-labelledby={`alpha9-tab-${mobileTab}`}>
            {mobileTab === "FINAL" && renderPaper(previewSnapshot, true)}
            {mobileTab === "CHANGES" && renderChangeRail()}
            {mobileTab === "GAPS" && <aside className={styles.changeRail}><strong>仍待核對</strong>{workspace.gapCount === 0 ? <p>目前沒有結構性缺口。</p> : <p>仍有 {workspace.gapCount} 項缺口；老麥已保留在成果中，不會補成未經證實的事實。</p>}{workspace.officialComplianceStatus && <div className={styles.compliance}>官方規範狀態：{complianceLabel(workspace.officialComplianceStatus)}</div>}</aside>}
          </div>
        </div>

        <div className={styles.actionDock} data-testid="alpha9-action-dock"><p>只更新本機工作副本；不會投稿、送件或寫入正式研究資料。</p>{undoSnapshot ? <button type="button" className={styles.quiet} data-testid="alpha9-undo" onClick={undoWholeArtifact}>完整復原</button> : <button type="button" className={styles.primary} data-testid="alpha9-apply" onClick={applyWholeArtifact}>套用全部推薦</button>}</div>
      </section>}
    </section>}

    <p className={styles.live} role="status" aria-live="polite" aria-atomic="true" data-testid="alpha9-live">{announcement}</p>
  </main>;
}
