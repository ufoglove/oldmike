"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import styles from "./v2-alpha6.module.css";

type EntryMode = "PROJECT_ARTIFACT" | "PASTED_DRAFT";
type DeclaredLanguage = "ZH_TW" | "EN";
type LanguageTask = "ZH_TW_TO_EN" | "EN_TO_ZH_TW" | "ACADEMIC_EN_EDIT" | "NATURAL_SCHOLARLY_STYLE";
type EntryOption = { id: EntryMode; label: string; detail: string };
type LanguageOption = { id: DeclaredLanguage; label: string };
type ProjectOption = { id: string; label: string; detail: string };
type Strategy = { strategy: string; title: string; framing: string; argumentArchitecture: string; evidenceBurden: string; risk: string; recommended: boolean; strategyHash: string };
type Section = { text: string; claimRefs: string[]; resultState: string; requiredDataChecklist: string[] };
type Suggestion = { optionId: string; strategy: string; recommended: boolean; source: string; sourceHash: string; revision: string; reason: string; risk: string };
type Workspace = {
  sourceHash: string;
  sourcePreserved: true;
  strategies: Strategy[];
  recommendedStrategy: string;
  manuscript: { manuscriptHash: string; sections: Record<string, Section>; formalWriteCount: number };
  claimLedger: Array<{ claimId: string; text: string; state: string; evidenceBoundary: string; claimHash: string }>;
  journalAuthority: null | { identity: { title: string; verifiedCollection: string; freshness: string }; policy: { freshness: string } };
  zoteroEvidence: Array<{ itemKey: string; metadataHash: string; cannotUpgradeClaimState: true; attachmentPolicy: string }>;
  submissionReadiness: string;
  humanGate: { required: true; scope: "WHOLE_ARTIFACT"; confirmed: false; contentHash: string };
  providerSubmissionCount: number;
  cardSwitchProviderSubmissionCount: number;
  formalResearchWriteCount: number;
};
type Assistance = { task: LanguageTask; options: Suggestion[]; recommendedOptionId: string };

const sectionOrder = ["title", "abstract", "keywords", "introduction", "literatureReviewOrTheoreticalFramework", "methods", "resultsOrPlannedResults", "discussion", "conclusion", "limitations", "tableSpecifications", "figureSpecifications", "declarations"] as const;
const sectionLabels: Record<(typeof sectionOrder)[number], string> = {
  title: "題目",
  abstract: "摘要",
  keywords: "關鍵字",
  introduction: "前言",
  literatureReviewOrTheoreticalFramework: "文獻回顧／理論架構",
  methods: "方法",
  resultsOrPlannedResults: "結果／預定結果",
  discussion: "討論",
  conclusion: "結論",
  limitations: "限制",
  tableSpecifications: "表格規格",
  figureSpecifications: "圖表規格",
  declarations: "聲明",
};
const strategyLabels: Record<string, string> = {
  EVIDENCE_FIRST_CONSERVATIVE: "證據優先・保守論證",
  BALANCED_JOURNAL_FIT_RECOMMENDED: "期刊契合・平衡推薦",
  FRONTIER_THEORY_BUILDING: "前沿理論・機制建構",
};
const optionLabels: Record<string, string> = { FAITHFUL: "忠實保留", PRECISE_JOURNAL_FORMAL: "精準期刊正式", NATURAL_SCHOLARLY: "自然學者語氣" };
const claimLabels: Record<string, string> = { VERIFIED: "已驗證", UNVERIFIED: "未驗證", ASSUMPTION: "假設", MISSING: "缺少" };
const readinessLabel = (value: string) => value === "STALE" ? "期刊快照需更新" : value === "BLOCKED" ? "尚未綁定目標期刊" : "稿件可繼續編修，尚未具備投稿條件";

async function sha256Text(value: string) {
  // academicLanguageHash canonicalizes a string as its JSON string literal.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function V2Alpha6ManuscriptWorkspace({ entries, languages, projects }: { entries: readonly EntryOption[]; languages: readonly LanguageOption[]; projects: readonly ProjectOption[] }) {
  const [entryMode, setEntryMode] = useState<EntryMode | "">("");
  const [declaredLanguage, setDeclaredLanguage] = useState<DeclaredLanguage | "">("");
  const [projectSourceId, setProjectSourceId] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [undoSnapshots, setUndoSnapshots] = useState<Record<string, string>>({});
  const [selectedStrategy, setSelectedStrategy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [gateChecked, setGateChecked] = useState(false);
  const [drawerSection, setDrawerSection] = useState<string | null>(null);
  const [sectionTasks, setSectionTasks] = useState<Record<string, LanguageTask>>({});
  const [assistance, setAssistance] = useState<Assistance | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistError, setAssistError] = useState("");
  const generationRequestId = useRef("");
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const drawerHeadingRef = useRef<HTMLHeadingElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedCard = useMemo(() => workspace?.strategies.find((item) => item.strategy === selectedStrategy) ?? null, [workspace, selectedStrategy]);
  const selectedSuggestion = assistance?.options.find((item) => item.optionId === selectedOptionId) ?? null;

  useEffect(() => { if (workspace) resultHeadingRef.current?.focus(); }, [workspace]);
  useEffect(() => {
    if (!drawerSection) return;
    drawerHeadingRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerSection]);

  function invalidateGeneration() {
    generationRequestId.current = "";
  }

  function closeDrawer() {
    setDrawerSection(null);
    setAssistance(null);
    setAssistError("");
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  }

  async function generate() {
    if (!entryMode || !declaredLanguage || (entryMode === "PROJECT_ARTIFACT" ? !projectSourceId : sourceText.trim().length < 20)) return;
    setBusy(true);
    setError("");
    setAnnouncement("老麥正在整理三種論證策略與完整稿件。");
    if (!generationRequestId.current) generationRequestId.current = `alpha6-${Date.now()}-${crypto.randomUUID()}`;
    const body = entryMode === "PROJECT_ARTIFACT"
      ? { operation: "GENERATE_WORKSPACE", requestId: generationRequestId.current, entryMode, declaredLanguage, projectSourceId }
      : { operation: "GENERATE_WORKSPACE", requestId: generationRequestId.current, entryMode, declaredLanguage, sourceText };
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch("/api/v2-alpha6/workspace", { method: "POST", headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": "fixture-workspace-v2" }, body: JSON.stringify(body), signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as { ok?: boolean; code?: string; workspace?: Workspace };
        if (!response.ok || !payload.ok || !payload.workspace) throw new Error(payload.code ?? "alpha6_request_failed");
        setWorkspace(payload.workspace);
        setSelectedStrategy(payload.workspace.recommendedStrategy);
        setSections(Object.fromEntries(sectionOrder.map((key) => [key, payload.workspace!.manuscript.sections[key].text])));
        setUndoSnapshots({});
        setGateChecked(false);
        setAnnouncement("三種論證策略與完整稿件已備妥；平衡方案已推薦，所有結果缺口仍清楚標示。");
      } finally { window.clearTimeout(timer); }
    } catch {
      setError("稿件暫時無法完成。原始輸入與上一版稿件都已保留，請由你主動再試一次。");
      setAnnouncement("稿件未完成；原始輸入與既有稿件均已保留。");
    } finally { setBusy(false); }
  }

  function switchStrategy(strategy: string) {
    setSelectedStrategy(strategy);
    setAnnouncement("已在本機切換論證策略；沒有新增老麥請求，完整稿仍保留平衡推薦版本。");
  }

  async function openAssist(sectionKey: string, trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    setDrawerSection(sectionKey);
    setAssistance(null);
    setSelectedOptionId("");
    setAssistError("");
    setAssistBusy(true);
    const currentText = sections[sectionKey] ?? "";
    const selectedTask = sectionTasks[sectionKey] ?? "ACADEMIC_EN_EDIT";
    try {
      const sourceHash = await sha256Text(currentText);
      const requestId = `alpha6-assist-${Date.now()}-${crypto.randomUUID()}`;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch("/api/v2-alpha6/workspace", { method: "POST", headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": "fixture-workspace-v2" }, body: JSON.stringify({ operation: "LANGUAGE_ASSIST", requestId, task: selectedTask, sourceText: currentText, sourceHash }), signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as { ok?: boolean; code?: string; assistance?: Assistance };
        if (!response.ok || !payload.ok || !payload.assistance) throw new Error(payload.code ?? "alpha6_assist_failed");
        setAssistance(payload.assistance);
        setSelectedOptionId(payload.assistance.recommendedOptionId);
        setAnnouncement(`${sectionLabels[sectionKey as keyof typeof sectionLabels]}已有三個可預覽版本；尚未套用。`);
      } finally { window.clearTimeout(timer); }
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "alpha6_assist_failed";
      setAssistError(code === "alpha6_fixture_input_unsupported"
        ? "這段文字不在目前本機語義驗證範圍；原稿已完整保留。"
        : "這一段的三個版本暫時無法完成；目前文字沒有改動。");
      setAnnouncement("語言建議未完成；目前文字已保留。");
    } finally { setAssistBusy(false); }
  }

  async function applySuggestion() {
    if (!drawerSection || !selectedSuggestion) return;
    const current = sections[drawerSection] ?? "";
    if (await sha256Text(current) !== selectedSuggestion.sourceHash) {
      setAssistError("原文已變更，這組建議已過期；請重新取得三個版本。");
      return;
    }
    setUndoSnapshots((previous) => ({ ...previous, [drawerSection]: current }));
    setSections((previous) => ({ ...previous, [drawerSection]: selectedSuggestion.revision }));
    setGateChecked(false);
    setAnnouncement(`${sectionLabels[drawerSection as keyof typeof sectionLabels]}已套用「${optionLabels[selectedSuggestion.strategy]}」；可立即復原。`);
  }

  function undoSection(sectionKey: string) {
    const snapshot = undoSnapshots[sectionKey];
    if (snapshot === undefined) return;
    setSections((previous) => ({ ...previous, [sectionKey]: snapshot }));
    setUndoSnapshots((previous) => { const next = { ...previous }; delete next[sectionKey]; return next; });
    setGateChecked(false);
    setAnnouncement(`${sectionLabels[sectionKey as keyof typeof sectionLabels]}已復原到套用前版本。`);
  }

  return <main className={styles.shell} data-testid="alpha6-workspace" style={{ "--copper": "#844522" } as CSSProperties}>
    <header className={styles.masthead}>
      <div><p className={styles.eyebrow}>老麥寫作室 · 本機原型</p><h1>從研究骨架，到一篇不越過證據的完整稿件。</h1><p>選一份專案 S0，或貼上既有稿件。老麥先提供三種論證路徑，再完成可逐段編修的平衡推薦稿。</p></div>
      <aside><span>原稿不覆寫</span><span>正式寫入 0</span><span>送出功能關閉</span></aside>
    </header>

    <section className={styles.entry} aria-labelledby="alpha6-entry-title">
      <div className={styles.sectionIntro}><span>01 · 選擇起點</span><h2 id="alpha6-entry-title">今天從哪份材料開始？</h2><p>只選來源與語言；研究事實、結果與引用仍由可查核 artifact 決定。</p></div>
      <fieldset className={styles.modeChooser}><legend>稿件來源</legend>{entries.map((entry) => <label key={entry.id} className={entryMode === entry.id ? styles.modeActive : ""}><input type="radio" name="entry-mode" value={entry.id} checked={entryMode === entry.id} onChange={() => { setEntryMode(entry.id); setDeclaredLanguage(entry.id === "PROJECT_ARTIFACT" ? "ZH_TW" : "EN"); invalidateGeneration(); }} /><span><b>{entry.label}</b><small>{entry.detail}</small></span></label>)}</fieldset>
      <div className={styles.entryFields}>
        {entryMode === "PROJECT_ARTIFACT" && <label>選擇專案研究骨架<select data-testid="alpha6-project" value={projectSourceId} onChange={(event) => { setProjectSourceId(event.target.value); invalidateGeneration(); }}><option value="">請選擇</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select><small>{projects.find((project) => project.id === projectSourceId)?.detail}</small></label>}
        {entryMode === "PASTED_DRAFT" && <label className={styles.sourceField}>貼上既有稿件<textarea data-testid="alpha6-source-text" rows={8} maxLength={48_000} value={sourceText} onChange={(event) => { setSourceText(event.target.value); invalidateGeneration(); }} placeholder="貼上需要整理的稿件；原文會保留，不會靜默覆寫。" /></label>}
        {entryMode && <label>原稿主要語言<select data-testid="alpha6-language" value={declaredLanguage} onChange={(event) => { setDeclaredLanguage(event.target.value as DeclaredLanguage); invalidateGeneration(); }}>{languages.map((language) => <option key={language.id} value={language.id}>{language.label}</option>)}</select></label>}
        <button type="button" className={styles.primary} data-testid="alpha6-generate" onClick={generate} disabled={busy || !entryMode || !declaredLanguage || (entryMode === "PROJECT_ARTIFACT" ? !projectSourceId : sourceText.trim().length < 20)}>{busy ? "老麥正在整理…" : "老麥建立三種論證與完整稿件"}</button>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </section>

    {workspace && <>
      <section className={styles.strategies} aria-labelledby="alpha6-strategy-title">
        <div className={styles.sectionIntro}><span>02 · 先發散，再收斂</span><h2 id="alpha6-strategy-title" tabIndex={-1} ref={resultHeadingRef}>三種專業論證策略</h2><p>比較卡片只改本機閱讀焦點；不會送出第二次請求。</p></div>
        <div className={styles.strategyGrid}>{workspace.strategies.map((strategy) => <button type="button" key={strategy.strategy} data-testid={`alpha6-strategy-${strategy.strategy}`} className={`${styles.strategyCard} ${selectedStrategy === strategy.strategy ? styles.strategySelected : ""}`} aria-pressed={selectedStrategy === strategy.strategy} onClick={() => switchStrategy(strategy.strategy)}><span>{strategyLabels[strategy.strategy]}</span>{strategy.recommended && <b>推薦</b>}<h3>{strategy.title}</h3><p>{strategy.framing}</p><small>{strategy.argumentArchitecture}</small></button>)}</div>
        {selectedCard && <article className={styles.strategyDetail}><div><span>證據負擔</span><p>{selectedCard.evidenceBurden}</p></div><div><span>主要風險</span><p>{selectedCard.risk}</p></div><strong>切換新增請求：0</strong></article>}
      </section>

      <section className={styles.manuscript} aria-labelledby="alpha6-manuscript-title">
        <div className={styles.sectionIntro}><span>03 · 完整平衡推薦稿</span><h2 id="alpha6-manuscript-title">十三個稿件區塊，逐段可預覽與復原</h2><p>{readinessLabel(workspace.submissionReadiness)}。沒有資料的結果只會列出計畫與必要資料。</p></div>
        <div className={styles.readiness}><div><span>目標期刊</span><strong>{workspace.journalAuthority?.identity.title ?? "尚未選擇"}</strong></div><div><span>收錄與政策</span><strong>{workspace.journalAuthority ? `${workspace.journalAuthority.identity.verifiedCollection} · ${workspace.journalAuthority.policy.freshness === "CURRENT" ? "目前快照" : "需更新"}` : "待綁定"}</strong></div><div><span>稿件完整度</span><strong>{sectionOrder.filter((key) => sections[key]?.trim()).length} / {sectionOrder.length}</strong></div></div>
        <div className={styles.sectionList}>{sectionOrder.map((sectionKey, index) => {
          const section = workspace.manuscript.sections[sectionKey];
          return <article className={styles.manuscriptSection} key={sectionKey} data-testid={`alpha6-section-${sectionKey}`}>
            <header><div><span>{String(index + 1).padStart(2, "0")}</span><h3>{sectionLabels[sectionKey]}</h3></div><div className={styles.sectionActions}><select data-testid={`alpha6-task-${sectionKey}`} aria-label={`${sectionLabels[sectionKey]}語言任務`} value={sectionTasks[sectionKey] ?? "ACADEMIC_EN_EDIT"} onChange={(event) => setSectionTasks((previous) => ({ ...previous, [sectionKey]: event.target.value as LanguageTask }))}><option value="ZH_TW_TO_EN">中譯英</option><option value="EN_TO_ZH_TW">英譯繁中</option><option value="ACADEMIC_EN_EDIT">學術英文精修</option><option value="NATURAL_SCHOLARLY_STYLE">自然學者語氣</option></select><button type="button" aria-haspopup="dialog" aria-expanded={drawerSection === sectionKey} aria-controls="alpha6-suggestion-drawer" data-testid={`alpha6-assist-${sectionKey}`} onClick={(event) => openAssist(sectionKey, event.currentTarget)}>老麥三案</button>{undoSnapshots[sectionKey] !== undefined && <button type="button" onClick={() => undoSection(sectionKey)} data-testid={`alpha6-undo-${sectionKey}`}>復原</button>}</div></header>
            <textarea data-testid={`alpha6-section-input-${sectionKey}`} aria-label={`${sectionLabels[sectionKey]}內容`} value={sections[sectionKey] ?? ""} onChange={(event) => { setSections((previous) => ({ ...previous, [sectionKey]: event.target.value })); setGateChecked(false); }} rows={sectionKey === "title" || sectionKey === "keywords" ? 2 : 6} />
            {section.resultState === "PLANNED" && <aside className={styles.planned}><b>尚無已驗證結果：目前只建立寫作規格</b><ul>{section.requiredDataChecklist.map((item) => <li key={item}>{item}</li>)}</ul></aside>}
          </article>;
        })}</div>
      </section>

      <section className={styles.evidenceDesk} aria-labelledby="alpha6-evidence-title"><div className={styles.sectionIntro}><span>04 · 證據與主張帳本</span><h2 id="alpha6-evidence-title">每個實質主張都有狀態</h2><p>Zotero metadata 只協助引用；不能把主張升級成「已驗證」。</p></div><div className={styles.claimGrid}>{workspace.claimLedger.map((claim) => <article key={claim.claimId}><span className={styles[`claim${claim.state}`]}>{claimLabels[claim.state]}</span><p>{claim.text}</p><small>{claim.evidenceBoundary}</small></article>)}</div><p className={styles.zoteroBoundary}>Zotero 綁定：metadata only · 不含 PDF／全文 · 不變更主張狀態</p></section>

      <section className={styles.gate} aria-labelledby="alpha6-gate-title"><div><span>05 · 全件 Human Gate</span><h2 id="alpha6-gate-title">最後只確認整份稿件一次</h2><p>逐段套用只是本機草稿編修；此界線也不會建立正式文件或外部投稿。</p></div><label><input type="checkbox" checked={gateChecked} onChange={(event) => setGateChecked(event.target.checked)} />我已檢視證據狀態、結果缺口、期刊快照與整份稿件。</label><button type="button" disabled={!gateChecked} onClick={() => setAnnouncement("全件預覽完成；正式研究寫入與外部投稿仍為零。")}>確認全件預覽</button><strong>正式研究寫入：{workspace.formalResearchWriteCount}</strong></section>
    </>}

    {drawerSection && <aside id="alpha6-suggestion-drawer" className={styles.drawer} role="dialog" aria-modal="false" aria-labelledby="alpha6-drawer-title">
      <header><div><span>老麥 · 三案預覽</span><h2 id="alpha6-drawer-title" tabIndex={-1} ref={drawerHeadingRef}>{sectionLabels[drawerSection as keyof typeof sectionLabels]}</h2></div><button type="button" aria-label="關閉三案預覽" onClick={closeDrawer}>關閉</button></header>
      {assistBusy && <p role="status" aria-live="polite">正在整理三個版本…</p>}
      {assistError && <p role="alert" className={styles.error}>{assistError}</p>}
      {assistance && <><ul className={styles.optionList}>{assistance.options.map((option) => <li key={option.optionId}><button type="button" className={selectedOptionId === option.optionId ? styles.optionSelected : ""} aria-pressed={selectedOptionId === option.optionId} onClick={() => setSelectedOptionId(option.optionId)}><span>{optionLabels[option.strategy]}</span>{option.recommended && <b>推薦</b>}<p>{option.revision}</p><small>{option.reason}</small><em>風險：{option.risk}</em></button></li>)}</ul><div className={styles.drawerActions}><button type="button" onClick={applySuggestion} disabled={!selectedSuggestion} data-testid="alpha6-apply-suggestion">套用此版本</button><button type="button" onClick={closeDrawer}>保留原文</button></div></>}
    </aside>}
    <p className={styles.liveRegion} role="status" aria-live="polite" data-testid="alpha6-live-region">{announcement}</p>
  </main>;
}
