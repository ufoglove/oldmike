"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./v2-alpha3.module.css";

type DomainSelection = { kind: "BUILTIN" | "CUSTOM"; domainId: string | null; label: string; profileId: string | null; profileVersion: number | null; profileContentHash: string | null; selectionHash: string };
type ProfileHistory = { profileId: string; version: number; lifecycleState: "ACTIVE" | "ARCHIVED"; name: string; contentHash: string };
type Insight = { kind: "question" | "gap" | "mechanism" | "method" | "direction"; title: string; researchQuestion: string; mechanism: string; value: string; domainFit: string; evidenceBoundary: string; assumptions: string[]; nextAction: string; hash: string };
type Literature = { synthesis: { observed: { coverage: string; works: Array<{ title: string; year: number; firstAuthor: string; doi: string | null; confidence: string }>; limitations: string[] }; forecasts: Array<{ horizon: string; confidence: string; statement: string; assumptions: string[]; invalidationConditions: string[] }> }; connectorCoverage: Record<string, string>; manualGoogleScholarLink: string; dedupe: { exactDuplicateCount: number; possibleDuplicateReviewCount: number } };
type Alpha2Snapshot = { journey: { state: string; stageA: null | { directions: Array<{ directionId: string; lane: string; workingTitle: string; researchQuestion: string; methodSketch: string }>; recommendedDirectionId: string }; stageB: null | { sourceDirectionId: string; fields: Record<string, string> } }; bindingGate: "PASS" | "PENDING"; domainSelectionHash: string };

const WORKSPACE = "fixture-workspace-v2";

async function localRequest(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(path, { ...init, headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": WORKSPACE, ...init?.headers }, signal: controller.signal, cache: "no-store" });
  } finally { window.clearTimeout(timer); }
}

const laneLabel = (lane: string) => lane === "EVIDENCE_FIRST" ? "證據優先" : lane === "BALANCED_RECOMMENDED" ? "平衡推薦" : "前沿創新";

export function V2Alpha3Workspace() {
  const [builtins, setBuiltins] = useState<DomainSelection[]>([]);
  const [customSelections, setCustomSelections] = useState<DomainSelection[]>([]);
  const [profiles, setProfiles] = useState<ProfileHistory[]>([]);
  const [domain, setDomain] = useState<DomainSelection | null>(null);
  const [message, setMessage] = useState("");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [conversationRef, setConversationRef] = useState<string | null>(null);
  const [literature, setLiterature] = useState<Literature | null>(null);
  const [journeyRef, setJourneyRef] = useState<string | null>(null);
  const [alpha2, setAlpha2] = useState<Alpha2Snapshot | null>(null);
  const [busy, setBusy] = useState<"CHAT" | "LITERATURE" | "PROMOTION" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [includeKeywords, setIncludeKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [importCard, setImportCard] = useState<Insight | null>(null);
  const [importConfirmed, setImportConfirmed] = useState(false);
  const customTrigger = useRef<HTMLButtonElement | null>(null);
  const customDialog = useRef<HTMLDivElement | null>(null);
  const customNameInput = useRef<HTMLInputElement | null>(null);
  const chatLog = useRef<HTMLDivElement | null>(null);

  const profileVersionCount = useMemo(() => profiles.length, [profiles]);

  async function loadDomains(preselect?: DomainSelection) {
    const response = await localRequest("/api/v2-alpha3/domain-profiles");
    const body = await response.json() as { ok?: boolean; builtins?: DomainSelection[]; customSelections?: DomainSelection[]; history?: ProfileHistory[] };
    if (!response.ok || !body.ok || !body.builtins || !body.customSelections || !body.history) throw new Error("domain_load_failed");
    setBuiltins(body.builtins); setCustomSelections(body.customSelections); setProfiles(body.history);
    setDomain(preselect ?? domain ?? body.builtins[0]);
  }

  useEffect(() => { void loadDomains().catch(() => setError("目前無法載入研究領域；尚未送出任何研究內容。")); }, []);
  useEffect(() => { chatLog.current?.scrollTo({ top: chatLog.current.scrollHeight, behavior: "smooth" }); }, [insights, literature, alpha2]);
  useEffect(() => {
    if (!showCustom) return;
    const focusable = customDialog.current?.querySelectorAll<HTMLElement>("button,input,[tabindex]:not([tabindex='-1'])") ?? [];
    customNameInput.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeCustom(); return; }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [showCustom]);
  useEffect(() => {
    if (!journeyRef) return;
    let disposed = false;
    const poll = async () => {
      const response = await localRequest(`/api/v2-alpha3/promotions/${encodeURIComponent(journeyRef)}`);
      const body = await response.json() as Alpha2Snapshot & { ok?: boolean };
      if (!response.ok || !body.ok) throw new Error("promotion_poll_failed");
      if (!disposed) {
        setAlpha2(body);
        if (body.bindingGate === "PASS") { setBusy(null); setAnnouncement("推薦方向的完整 S0 已完成，等待您的整體審閱。所有領域綁定均一致。"); }
      }
    };
    void poll().catch(() => setError("暫時無法更新方向進度；已完成內容仍保留。"));
    const interval = window.setInterval(() => { void poll().catch(() => undefined); }, 350);
    return () => { disposed = true; window.clearInterval(interval); };
  }, [journeyRef]);

  function closeCustom() { setShowCustom(false); window.setTimeout(() => customTrigger.current?.focus(), 0); }
  function splitKeywords(value: string) { return value.split(/[，,]/u).map((item) => item.trim()).filter(Boolean); }

  async function createCustomProfile() {
    try {
      const response = await localRequest("/api/v2-alpha3/domain-profiles", { method: "POST", body: JSON.stringify({ action: "CREATE", name: customName, includedKeywords: splitKeywords(includeKeywords), excludedKeywords: splitKeywords(excludeKeywords) }) });
      const body = await response.json() as { ok?: boolean; selection?: DomainSelection };
      if (response.status !== 201 || !body.ok || !body.selection) throw new Error("profile_create_failed");
      await loadDomains(body.selection); closeCustom(); setCustomName(""); setIncludeKeywords(""); setExcludeKeywords(""); setAnnouncement(`已新增並選取研究領域：${body.selection.label}`);
    } catch { setError("自訂領域未建立；請檢查名稱是否重複，現有選擇保持不變。"); }
  }

  function chooseDomain(value: string) {
    if (value === "__create__") { setShowCustom(true); return; }
    const selection = [...builtins, ...customSelections].find((item) => item.selectionHash === value);
    if (selection) { setDomain(selection); setInsights([]); setLiterature(null); setAlpha2(null); setJourneyRef(null); }
  }

  async function sendChat() {
    const normalized = message.trim();
    if (!domain || !normalized) { setError("請先選擇本次研究重心，並輸入一個研究關鍵字或問題。"); return; }
    setBusy("CHAT"); setError(null);
    try {
      const response = await localRequest("/api/v2-alpha3/chat", { method: "POST", body: JSON.stringify({ requestId: `chat:${crypto.randomUUID()}`, domainSelection: domain, message: normalized }) });
      const body = await response.json() as { ok?: boolean; conversationRef?: string; insights?: Insight[]; domainSelectionHash?: string };
      if (!response.ok || !body.ok || !body.conversationRef || !body.insights || body.domainSelectionHash !== domain.selectionHash) throw new Error("chat_failed");
      setConversationRef(body.conversationRef); setInsights(body.insights); setMessage(""); setAnnouncement(`老麥已整理 ${body.insights.length} 張研究洞見卡；尚未建立正式研究資料。`);
    } catch { setError("老麥這次沒有完成整理；您的輸入仍保留，沒有自動重送。"); }
    finally { setBusy(null); }
  }

  async function loadLiterature() {
    if (!domain) return;
    setBusy("LITERATURE"); setError(null);
    try {
      const query = insights[0]?.researchQuestion ?? "本領域的核心研究問題";
      const response = await localRequest("/api/v2-alpha3/literature", { method: "POST", body: JSON.stringify({ domainSelection: domain, query }) });
      const body = await response.json() as Literature & { ok?: boolean; domainSelectionHash?: string };
      if (!response.ok || !body.ok || body.domainSelectionHash !== domain.selectionHash) throw new Error("literature_failed");
      setLiterature(body); setAnnouncement("已顯示本機合成文獻 metadata 與三段預測；來源覆蓋限制保持可見。");
    } catch { setError("本機文獻整理未完成；研究啟動仍可繼續，不依賴外部快取或排程。 "); }
    finally { setBusy(null); }
  }

  async function promote(card: Insight) {
    if (!domain) return;
    setBusy("PROMOTION"); setError(null);
    try {
      const response = await localRequest("/api/v2-alpha3/promotions", { method: "POST", body: JSON.stringify({ requestId: `alpha3-promotion:${crypto.randomUUID()}`, domainSelection: domain, domainSelectionHash: domain.selectionHash, insightCard: card, insightCardHash: card.hash }) });
      const body = await response.json() as { ok?: boolean; journeyRef?: string; domainSelectionHash?: string };
      if (response.status !== 202 || !body.ok || !body.journeyRef || body.domainSelectionHash !== domain.selectionHash) throw new Error("promotion_failed");
      setJourneyRef(body.journeyRef); setAnnouncement("已把洞見卡送入耐久研究方向流程；正式研究寫入仍為零。");
    } catch { setBusy(null); setError("未能發展研究方向；洞見卡與原始輸入仍保留，沒有自動重送。 "); }
  }

  async function confirmImport() {
    if (!domain || !importCard || !conversationRef) return;
    try {
      const response = await localRequest("/api/v2-alpha3/project-import", { method: "POST", body: JSON.stringify({ requestId: `project-import:${crypto.randomUUID()}`, conversationRef, eventNo: 3, projectId: "fixture-project-v2", domainSelection: domain, insightCard: importCard, confirmed: true }) });
      const body = await response.json() as { ok?: boolean; formalWriteCount?: number };
      if (!response.ok || !body.ok || body.formalWriteCount !== 0) throw new Error("import_failed");
      setImportConfirmed(true); setAnnouncement("已記錄明確匯入意圖；Alpha3 沒有寫入正式研究文件，仍須經整體 Human Gate。 ");
    } catch { setError("目前無法記錄匯入意圖；沒有寫入正式專案。 "); }
  }

  return <main className={styles.shell} data-testid="alpha3-workspace" data-formal-write-count="0">
    <header className={styles.header}><div className={styles.brand}><span>老麥</span><small>Research OS · Alpha3 本機原型</small></div><div className={styles.boundary}>正式研究寫入 0 · 外部來源呼叫 0</div></header>
    <div className={styles.layout}>
      <aside className={styles.domainRail} aria-labelledby="domain-title">
        <p className={styles.eyebrow}>Domain first</p><h1 id="domain-title">先選定研究邊界</h1><p>一次只選一個主要研究重心。歷史標籤保持原樣，這裡使用 V2 穩定識別。</p>
        <label htmlFor="alpha3-domain">本次研究重心</label>
        <div className={styles.selectRow}>
          <select id="alpha3-domain" required value={domain?.selectionHash ?? ""} onChange={(event) => chooseDomain(event.target.value)}>
            <optgroup label="內建領域">{builtins.map((item) => <option key={item.selectionHash} value={item.selectionHash}>{item.label}</option>)}</optgroup>
            <optgroup label="我的自訂領域">{customSelections.map((item) => <option key={item.selectionHash} value={item.selectionHash}>{item.label}</option>)}</optgroup>
            <option value="__create__">新增自訂研究領域</option>
          </select>
          <button ref={customTrigger} type="button" onClick={() => setShowCustom(true)} aria-haspopup="dialog" aria-expanded={showCustom} aria-controls="alpha3-custom-domain">新增研究領域</button>
        </div>
        <div className={styles.domainNote}><strong>{domain?.label ?? "正在載入…"}</strong><span>此綁定會隨聊天、證據、方向、推薦與 S0 一路驗證。自訂歷史版本：{profileVersionCount}</span></div>
        <nav aria-label="Alpha3 工作階段"><a href="#chat">對話探索</a><a href="#literature">文獻情報</a><a href="#directions">方向與藍圖</a></nav>
      </aside>

      <section className={styles.canvas}>
        <section id="chat" className={styles.chat} aria-labelledby="chat-title">
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>老麥對話</p><h2 id="chat-title">在領域內把問題說清楚</h2></div><span>每回合最多 3 張洞見卡</span></div>
          <div className={styles.chatLog} ref={chatLog} role="log" aria-live="polite" aria-relevant="additions text">
            <article className={styles.oldMikeMessage}><strong>老麥</strong><p>說一個關鍵字、矛盾或研究問題。我會先釐清問題、機制與證據邊界，不會假裝已查過文獻。</p></article>
            {insights.length > 0 && <div className={styles.insightGrid}>{insights.map((card) => <article className={styles.insightCard} key={card.hash} data-testid="alpha3-insight-card">
              <div><span>{card.kind === "question" ? "研究問題" : card.kind === "mechanism" ? "作用機制" : card.kind === "method" ? "方法路徑" : "研究洞見"}</span><em>{card.evidenceBoundary === "OBSERVED_PARTIAL" ? "部分觀察" : "尚未驗證"}</em></div>
              <h3>{card.title}</h3><p>{card.researchQuestion}</p><dl><dt>機制</dt><dd>{card.mechanism}</dd><dt>價值</dt><dd>{card.value}</dd><dt>領域適配</dt><dd>{card.domainFit}</dd></dl>
              <small>{card.assumptions.join("；")}</small>
              <div className={styles.cardActions}><button type="button" onClick={() => void promote(card)}>發展成三個研究方向</button><button type="button" className={styles.ghost} onClick={() => { setImportCard(card); setImportConfirmed(false); }}>匯入目前專案</button></div>
            </article>)}</div>}
          </div>
          <div className={styles.composer}><label className={styles.srOnly} htmlFor="alpha3-message">研究關鍵字或問題</label><textarea id="alpha3-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={3} placeholder="例如：教師在何種證據下會修正 AI 輔助的課程決策？" onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void sendChat(); }} /><button type="button" disabled={busy !== null || !domain} onClick={() => void sendChat()}>{busy === "CHAT" ? "老麥整理中…" : "送出給老麥"}</button></div>
          <p className={styles.hint}>Ctrl / ⌘ + Enter 送出。聊天內容不送往公開學術來源；本機 fixture 不保留完整原文。</p>
        </section>

        <section id="literature" className={styles.literature} aria-labelledby="literature-title">
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Literature intelligence</p><h2 id="literature-title">觀察證據與未來推估分開看</h2></div><button type="button" onClick={() => void loadLiterature()} disabled={!domain || busy !== null}>{busy === "LITERATURE" ? "整理中…" : "載入本機證據示範"}</button></div>
          {!literature ? <p className={styles.emptyState}>OpenAlex 與 Semantic Scholar 目前只驗證唯讀合約；Consensus 尚未證明授權與成本，Google Scholar 僅提供手動搜尋與 DOI/BibTeX/RIS 匯入。</p> : <>
            <div className={styles.coverage}><strong>來源覆蓋：部分</strong><span>精確重複 {literature.dedupe.exactDuplicateCount} · 疑似重複待核對 {literature.dedupe.possibleDuplicateReviewCount}</span></div>
            <div className={styles.workList}>{literature.synthesis.observed.works.map((work) => <article key={`${work.title}:${work.year}`}><strong>{work.title}</strong><span>{work.firstAuthor} · {work.year} · 信心 {work.confidence}</span><small>{work.doi ? `DOI ${work.doi}` : "穩定來源識別（無 DOI）"}</small></article>)}</div>
            <ul className={styles.limitations}>{literature.synthesis.observed.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
            <div className={styles.forecasts}>{literature.synthesis.forecasts.map((item) => <article key={item.horizon}><span>{item.horizon === "YEARS_1_3" ? "1–3 年" : item.horizon === "YEARS_4_6" ? "4–6 年" : "7–10 年"}</span><strong>{item.statement}</strong><small>信心 {item.confidence} · 假設：{item.assumptions.join("；")} · 失效條件：{item.invalidationConditions.join("；")}</small></article>)}</div>
            <a className={styles.manualLink} href={literature.manualGoogleScholarLink} target="_blank" rel="noopener noreferrer">開啟手動 Google Scholar 搜尋（不由本站抓取）</a>
          </>}
        </section>

        {alpha2?.journey.stageA && <section id="directions" className={styles.directions} aria-labelledby="directions-title"><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Promotion handoff</p><h2 id="directions-title">三個耐久研究方向</h2></div><span>{alpha2.bindingGate === "PASS" ? "領域／推薦／S0 綁定通過" : "正在完成推薦藍圖"}</span></div><div className={styles.directionGrid}>{alpha2.journey.stageA.directions.map((item) => <article key={item.directionId}><span>{laneLabel(item.lane)}</span><h3>{item.workingTitle}</h3><p>{item.researchQuestion}</p><small>{item.methodSketch}</small></article>)}</div>{alpha2.journey.stageB && <div className={styles.s0}><strong>推薦方案 S0 已完成 13/13</strong><p>{alpha2.journey.stageB.fields.workingTitle}</p><span>本機草稿仍須整體 Human Gate；沒有逐欄核准或正式寫入。</span></div>}</section>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>
    </div>

    <p className={styles.live} aria-live="polite" role="status">{announcement}</p>

    {showCustom && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeCustom(); }}><div id="alpha3-custom-domain" className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="custom-title" ref={customDialog}><div className={styles.dialogHead}><div><p className={styles.eyebrow}>我的自訂領域</p><h2 id="custom-title">新增研究領域</h2></div><button type="button" onClick={closeCustom} aria-label="關閉新增研究領域">關閉</button></div><label htmlFor="custom-name">領域名稱（必填）</label><input ref={customNameInput} id="custom-name" value={customName} maxLength={120} onChange={(event) => setCustomName(event.target.value)} /><label htmlFor="custom-include">納入範圍關鍵字（選填，以逗號分隔）</label><input id="custom-include" value={includeKeywords} onChange={(event) => setIncludeKeywords(event.target.value)} /><label htmlFor="custom-exclude">排除範圍關鍵字（選填，以逗號分隔）</label><input id="custom-exclude" value={excludeKeywords} onChange={(event) => setExcludeKeywords(event.target.value)} /><p>建立後會自動選取；未來編輯會建立新版本，封存也不刪除歷史。</p><button type="button" className={styles.primary} onClick={() => void createCustomProfile()} disabled={!customName.trim()}>建立並選取</button></div></div>}

    {importCard && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setImportCard(null); }}><div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="import-title"><div className={styles.dialogHead}><div><p className={styles.eyebrow}>明確匯入界線</p><h2 id="import-title">確認匯入目前專案？</h2></div><button type="button" onClick={() => setImportCard(null)}>關閉</button></div><p><strong>{importCard.title}</strong></p><p>只記錄這張卡片的 hash-bound 匯入意圖；不建立正式研究文件、不繞過 Human Gate。</p>{importConfirmed ? <p role="status">已記錄意圖，正式研究寫入仍為 0。</p> : <button type="button" className={styles.primary} onClick={() => void confirmImport()}>確認匯入意圖</button>}</div></div>}
  </main>;
}
