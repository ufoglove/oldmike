"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./v2-alpha5.module.css";

type DomainOption = { id: string; label: string; selection: { kind: "BUILTIN" | "CUSTOM"; domainId: string | null; label: string; profileId: string | null; profileVersion: number | null; profileContentHash: string | null; selectionHash: string } };
type Target = { id: "NSTC" | "MOE"; label: string; proposalMode: string };
type Direction = { directionId: string; lane: string; workingTitle: string; researchQuestion: string; researchValue: string; mechanismTheory: string; targetContext: string; methodDesign: string; expectedContribution: string; feasibilityRisk: string; recommended: boolean };
type Proposal = {
  mode: string;
  bilingual: { titleZhTw: string; abstractZhTw: string; keywordsZhTw: string[] };
  narrative: { problem: string; background: string; literatureGap: string; aims: string[]; researchQuestions: string[]; innovation: string; significance: string; expectedImpact: string; methods: string; sample: string; data: string; analysis: string; ethics: string; privacy: string; risks: string[]; alternatives: string[] };
  workPackages: Array<{ workPackageId: string; title: string; objective: string; startMonth: number; endMonth: number }>;
  milestones: Array<{ milestoneId: string; workPackageId: string; dueMonth: number; deliverable: string }>;
  budget: { totalTwd: number; items: Array<{ itemId: string; category: string; quantity: number; unitCostTwd: number; subtotalTwd: number; workPackageId: string; ruleEvidenceStatus: string; justification: string }> };
  requirements: Array<{ category: string; status: string; officialRule: string }>;
  attachments: Array<{ attachmentId: string; label: string; status: string }>;
  unresolvedIssues: string[];
};
type Workspace = {
  directions: Direction[];
  recommendedDirectionId: string;
  proposalsByDirection: Record<string, Proposal>;
  sourceBundle: { freshness: string; officialDeadline: { status: string }; institutionalDeadline: { status: string }; sources: Array<{ kind: string; freshness: string }> };
  officialFacts: Array<{ label: string; status: string; value: string | null }>;
  historicalObservations: Array<{ text: string }>;
  oldMikeRecommendations: Array<{ text: string }>;
  reviewerConcerns: Array<{ concernId: string; text: string; severity: string }>;
  zoteroEvidence: Array<{ itemKey: string; doi: string | null; role: string; duplicateClass: string; authorityBoundary: string }>;
  humanGate: { contentHash: string };
  providerSubmissionCount: number;
  cardSwitchProviderSubmissionCount: number;
  formalResearchWriteCount: number;
};

const laneLabels: Record<string, string> = {
  DISCIPLINE_CORE_HIGH_FEASIBILITY: "領域核心・高可行性",
  CROSS_DOMAIN_BALANCED_RECOMMENDED: "跨域平衡・推薦",
  EMERGING_FORWARD_HIGH_INNOVATION: "新興前瞻・高創新",
};
const sourceLabels: Record<string, string> = { ANNOUNCEMENT: "公告", RULES: "規則", FORMS: "表單", ATTACHMENTS: "附件", BUDGET: "預算", REVIEW_CRITERIA: "審查準則", TIMELINE: "時程" };
const statusLabel = (status: string) => status === "CURRENT" ? "本機快照完整（仍未人工核對）" : status === "STALE" ? "可能過期" : status === "MISSING" ? "缺少來源" : status === "UNKNOWN" ? "待核對" : status;

export function V2Alpha5ProposalWorkspace({ domains, targets }: { domains: readonly DomainOption[]; targets: readonly Target[] }) {
  const [domainId, setDomainId] = useState("");
  const [targetId, setTargetId] = useState<"" | "NSTC" | "MOE">("");
  const [direction, setDirection] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gateChecked, setGateChecked] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const resultRef = useRef<HTMLHeadingElement>(null);
  const requestIdRef = useRef("");
  const selectedDomain = domains.find((item) => item.id === domainId);
  const selectedProposal = workspace?.proposalsByDirection[selectedDirectionId] ?? null;
  const selectedDirection = workspace?.directions.find((item) => item.directionId === selectedDirectionId) ?? null;
  const budgetArithmetic = useMemo(() => selectedProposal ? selectedProposal.budget.items.reduce((sum, item) => sum + item.quantity * item.unitCostTwd, 0) : 0, [selectedProposal]);

  useEffect(() => {
    if (workspace) resultRef.current?.focus();
  }, [workspace]);

  async function generate() {
    if (!selectedDomain || !targetId || direction.trim().length < 2) return;
    setBusy(true); setError(""); setAnnouncement("老麥正在整理三個方向與完整申請草案。");
    if (!requestIdRef.current) requestIdRef.current = `alpha5-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch("/api/v2-alpha5/workspace", { method: "POST", headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": "fixture-workspace-v2" }, body: JSON.stringify({ requestId: requestIdRef.current, domainSelection: selectedDomain.selection, targetId, researchDirection: direction }), signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as { ok?: boolean; code?: string; workspace?: Workspace };
        if (!response.ok || !payload.ok || !payload.workspace) throw new Error(payload.code ?? "alpha5_request_failed");
        setWorkspace(payload.workspace);
        setSelectedDirectionId(payload.workspace.recommendedDirectionId);
        setGateChecked(false);
        setAnnouncement("三個研究方向與完整申請草案已備妥；推薦方案已選取，請整體預覽後再確認。");
      } finally { window.clearTimeout(timer); }
    } catch {
      setError("草案暫時無法完成。你目前的研究方向已保留，請稍後由你主動再試一次。");
      setAnnouncement("草案未完成；目前輸入與既有草案均已保留。");
    } finally { setBusy(false); }
  }

  function switchCard(directionId: string) {
    setSelectedDirectionId(directionId);
    setGateChecked(false);
    setAnnouncement("已切換比較方向；沒有送出新的老麥請求。完整草案已在本機切換。");
  }

  return <main className={styles.shell} data-testid="alpha5-workspace">
    <header className={styles.masthead}>
      <div><p className={styles.kicker}>老麥科研作業系統 · ALPHA 5 本機原型</p><h1>一個方向，完成可審查的國家型計畫草案。</h1><p>先選研究重心與申請目標，再讓老麥整理三條真正不同的路徑。官方規則、預算與期限永遠依同一年度來源核對。</p></div>
      <span className={styles.localSeal}>本機合成原型・不送件</span>
    </header>

    <section className={styles.entry} aria-labelledby="entry-title">
      <div><span className={styles.folio}>01 / ONE SIMPLE START</span><h2 id="entry-title">今天要準備哪一份計畫？</h2><p>只需一個研究方向。進階事實與年度規則在草案內明確標成待核對。</p></div>
      <div className={styles.entryFields}>
        <label>本次研究重心<select data-testid="alpha5-domain" value={domainId} onChange={(event) => { setDomainId(event.target.value); requestIdRef.current = ""; }}><option value="">請選擇</option>{domains.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>本次成果目標<select data-testid="alpha5-target" value={targetId} onChange={(event) => { setTargetId(event.target.value as typeof targetId); requestIdRef.current = ""; }}><option value="">請選擇</option>{targets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className={styles.directionField}>關鍵字或簡短研究方向<textarea data-testid="alpha5-direction" rows={4} maxLength={500} value={direction} onChange={(event) => { setDirection(event.target.value); requestIdRef.current = ""; }} placeholder="例如：以情境式學習改善職業安全風險辨識" /></label>
        <button className={styles.primary} data-testid="alpha5-generate" disabled={busy || !selectedDomain || !targetId || direction.trim().length < 2} onClick={generate}>{busy ? "老麥正在整理…" : "老麥產生 3 個方向與完整草案"}</button>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </section>

    {workspace && <>
      <section className={styles.directions} aria-labelledby="directions-title">
        <div className={styles.sectionHead}><div><span className={styles.folio}>02 / DIVERGE THEN CONVERGE</span><h2 id="directions-title" tabIndex={-1} ref={resultRef}>三個可比較的研究方向</h2></div><p>卡片切換只改本機預覽，不會再次呼叫老麥。</p></div>
        <div className={styles.cardGrid}>{workspace.directions.map((item) => <button type="button" className={`${styles.directionCard} ${selectedDirectionId === item.directionId ? styles.selected : ""}`} aria-pressed={selectedDirectionId === item.directionId} key={item.directionId} onClick={() => switchCard(item.directionId)} data-testid={`alpha5-card-${item.directionId}`}>
          <span>{laneLabels[item.lane]}</span>{item.recommended && <b>推薦</b>}<h3>{item.workingTitle}</h3><p>{item.researchQuestion}</p><small>{item.researchValue}</small>
        </button>)}</div>
        <p className={styles.localNotice}>目前選取：<strong>{selectedDirection?.workingTitle}</strong><span>切換新增請求：0</span></p>
      </section>

      {selectedProposal && <section className={styles.draft} aria-labelledby="draft-title">
        <div className={styles.sectionHead}><div><span className={styles.folio}>03 / COMPLETE DRAFT</span><h2 id="draft-title">完整申請草案</h2></div><p>{selectedProposal.mode === "NSTC_RESEARCH" ? "國科會研究計畫" : "教育部教學實踐研究計畫"} · 全件預覽，非逐欄核准。</p></div>
        <article className={styles.heroDraft}><span>暫定題目</span><h3>{selectedProposal.bilingual.titleZhTw}</h3><p>{selectedProposal.bilingual.abstractZhTw}</p><ul>{selectedProposal.bilingual.keywordsZhTw.map((item) => <li key={item}>{item}</li>)}</ul></article>
        <div className={styles.narrativeGrid}>
          <article><h3>問題、背景與缺口</h3><p>{selectedProposal.narrative.problem}</p><p>{selectedProposal.narrative.background}</p><p>{selectedProposal.narrative.literatureGap}</p></article>
          <article><h3>方法、資料與分析</h3><p>{selectedProposal.narrative.methods}</p><p>{selectedProposal.narrative.data}</p><p>{selectedProposal.narrative.analysis}</p></article>
          <article><h3>倫理、隱私與替代方案</h3><p>{selectedProposal.narrative.ethics}</p><p>{selectedProposal.narrative.privacy}</p><ul>{selectedProposal.narrative.alternatives.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
      </section>}

      {selectedProposal && <section className={styles.audit} aria-labelledby="audit-title">
        <div className={styles.sectionHead}><div><span className={styles.folio}>04 / RULES, BUDGET & EVIDENCE</span><h2 id="audit-title">查核桌</h2></div><p>官方事實、歷史觀察與老麥建議分開呈現。</p></div>
        <div className={styles.auditGrid}>
          <article><h3>同週期官方來源</h3><p className={styles.warning}>總體狀態：{statusLabel(workspace.sourceBundle.freshness)}</p><ul>{workspace.sourceBundle.sources.map((item) => <li key={item.kind}><span>{sourceLabels[item.kind] ?? item.kind}</span><strong>{statusLabel(item.freshness)}</strong></li>)}</ul>{workspace.officialFacts.map((fact) => <p key={fact.label}><b>{fact.label}</b>：{statusLabel(fact.status)}</p>)}</article>
          <article><h3>工作包與預算</h3>{selectedProposal.workPackages.map((wp) => <p key={wp.workPackageId}><b>{wp.title}</b><br />{wp.objective} · 第 {wp.startMonth}–{wp.endMonth} 月</p>)}<table><caption>預算算術與工作包連結</caption><thead><tr><th>項目</th><th>小計</th><th>工作包</th><th>規則</th></tr></thead><tbody>{selectedProposal.budget.items.map((item) => <tr key={item.itemId}><td>{item.category}</td><td>{item.subtotalTwd.toLocaleString("zh-TW")}</td><td>{item.workPackageId}</td><td>{statusLabel(item.ruleEvidenceStatus)}</td></tr>)}</tbody><tfoot><tr><th>合計</th><td>{selectedProposal.budget.totalTwd.toLocaleString("zh-TW")}</td><td colSpan={2}>{budgetArithmetic === selectedProposal.budget.totalTwd ? "算術一致" : "需修正"}</td></tr></tfoot></table></article>
          <article><h3>Zotero 證據參照</h3><p>Zotero 僅支援背景、缺口、方法、討論與引用；不作官方規則或預算權威。</p>{workspace.zoteroEvidence.map((item) => <p key={item.itemKey}><b>{item.role}</b> · DOI {item.doi ?? "無"} · {item.duplicateClass}</p>)}<h4>模擬審查關切</h4><ul>{workspace.reviewerConcerns.map((item) => <li key={item.concernId}>{item.text}</li>)}</ul></article>
        </div>
        <div className={styles.boundaryGrid}><article><h3>歷史觀察</h3>{workspace.historicalObservations.map((item) => <p key={item.text}>{item.text}</p>)}</article><article><h3>老麥建議</h3>{workspace.oldMikeRecommendations.map((item) => <p key={item.text}>{item.text}</p>)}</article><article><h3>附件與規則</h3><p>{selectedProposal.attachments[0]?.label}：{statusLabel(selectedProposal.attachments[0]?.status ?? "UNKNOWN")}</p><p>{selectedProposal.requirements.filter((item) => item.status === "UNKNOWN").length} 項規則待同週期核對。</p></article></div>
      </section>}

      <section className={styles.gate} aria-labelledby="gate-title"><div><span className={styles.folio}>05 / WHOLE-ARTIFACT HUMAN GATE</span><h2 id="gate-title">最後再確認整份草案</h2><p>此核取只證明你已預覽本機草案；不會建立正式研究文件、送件或寫入線上資料庫。</p></div><label><input type="checkbox" checked={gateChecked} onChange={(event) => setGateChecked(event.target.checked)} />我已檢視方向、官方來源缺口、預算與證據邊界。</label><button type="button" disabled={!gateChecked} onClick={() => setAnnouncement("全件 Human Gate 預覽完成；正式寫入仍為零。")}>確認全件預覽</button><p>正式研究寫入：{workspace.formalResearchWriteCount}</p></section>
    </>}
    <p className={styles.live} role="status" aria-live="polite">{announcement}</p>
  </main>;
}
