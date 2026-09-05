"use client";

import { useMemo, useRef, useState } from "react";

import styles from "./v2-alpha4.module.css";

type DomainSelection = { kind: "BUILTIN"; domainId: string; label: string; profileId: null; profileVersion: null; profileContentHash: null; selectionHash: string };
type TargetSelection = { targetId: "SCI" | "SSCI"; label: string; catalogVersion: string; verificationCollection: "SCIE" | "SSCI"; selectionHash: string };
type Target = { id: "SCI" | "SSCI" | "NSTC" | "MOE"; label: string; enabled: boolean; verificationCollection: "SCIE" | "SSCI" | null; availability: "ALPHA4" | "UPCOMING_ALPHA5"; selection: TargetSelection | null };
type Direction = { researchIntentHash: string; directionId: string; lane: string; workingTitle: string; researchQuestion: string; researchValue: string; mechanismTheory: string; targetContext: string; methodDesign: string; contribution: string; recommended: boolean; hash: string };
type Journal = { researchIntentHash: string; directionId: string; journalId: string; title: string; recommended: boolean; status: "READY" | "NEEDS_FIX" | "BLOCKED" | "STALE"; identity: { issn: string[]; issnL: string; verifiedCollection: string; verifiedAt: string; sourceDate: string; snapshotHash: string; freshness: string }; policy: { freshness: string; articleTypes: string[] }; corpus: { publicLabel: string; period: { from: string; to: string }; itemCount: number; observedTopics: string[]; observedMethods: string[]; observedPopulations: string[]; observedArticleTypes: string[]; officialIssueCount: number; officialSpecialCollections: string[]; officialCalls: string[]; sourceDate: string; snapshotHash: string; freshness: string; confidence: string; counterEvidence: string[] }; fit: { blueprint: { audienceScopeFit: string; contribution: string; theoryMechanism: string; methodsReportingGuideline: string; dataAnalysis: string; expectedResultEmphasis: string; exactAdaptations: string[]; deskRejectRisks: string[]; assumptions: string[]; invalidationConditions: string[] } } };
type Workspace = {
  researchIntentHash: string;
  directions: Direction[];
  journals: Journal[];
  journalSets: Array<{ directionId: string; journals: Journal[] }>;
  recommendation: { directionId: string; journalId: string; rationale: string };
  s0: { sourceDirectionId: string; selectedJournalId: string; completeFieldCount: number; fields: Record<string, string> };
  review: { readOnly: true; reports: Array<{ lens: string; findings: Array<{ findingId: string; severity: string; title: string; evidenceAnchor: string }> }>; daCriticalAdjudications: Array<{ findingId: string; status: string; rationale: string }> };
  citationAudit: { status: string; entries: Array<{ citationId: string; existence: string; metadata: string; context: string }> };
  responseLedger: { items: Array<{ findingId: string; response: string; changeLocation: string; disposition: string }> };
  submissionAudit: { revisionLoopCount: number; externalSubmissionEnabled: false };
  formalResearchWriteCount: 0;
  externalSubmissionCount: 0;
};

const WORKSPACE = "fixture-workspace-v2";
const stages = [
  ["適配", "READY"], ["證據", "READY"], ["研究契約", "READY"], ["稿件", "READY"], ["五鏡審查", "READY"], ["修訂", "READY"],
  ["引用", "READY"], ["政策", "READY"], ["Cover Letter", "READY"], ["提交套件", "NEEDS_FIX"], ["審查回覆", "READY"],
] as const;
const laneLabel = (lane: string) => lane === "EVIDENCE_FIRST" ? "證據優先" : lane === "BALANCED_RECOMMENDED" ? "平衡推薦" : "前沿創新";
const lensLabel = (lens: string) => ({ EIC: "主編視角", METHODOLOGY: "方法學", DOMAIN: "領域專家", PERSPECTIVE: "跨域觀點", DEVILS_ADVOCATE: "反方挑戰" }[lens] ?? lens);
const fieldLabels: Record<string, string> = { workingTitle: "暫定研究題目", domain: "研究領域", outputTrack: "成果目標", problemContext: "問題背景", targetUsers: "研究對象", expectedContribution: "預期貢獻", existingData: "已有資料", availableData: "可取得資料", methodIdea: "方法構想", timeline: "時程", constraints: "限制", ethicsPrivacyRisks: "倫理與隱私", unresolvedItems: "尚待確認" };

async function postWorkspace(body: unknown) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch("/api/v2-alpha4/workspace", { method: "POST", headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": WORKSPACE }, body: JSON.stringify(body), signal: controller.signal, cache: "no-store" });
    const payload = await response.json() as { ok?: boolean; code?: string; workspace?: Workspace; providerSubmissionCount?: number };
    if (!response.ok || !payload.ok || !payload.workspace) throw new Error(payload.code ?? "alpha4_request_failed");
    return payload;
  } finally { window.clearTimeout(timer); }
}

export function V2Alpha4JournalWorkspace({ domains, targets }: { domains: DomainSelection[]; targets: Target[] }) {
  const [domainHash, setDomainHash] = useState("");
  const [targetId, setTargetId] = useState("");
  const [direction, setDirection] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [compareDirectionId, setCompareDirectionId] = useState<string | null>(null);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [humanReviewed, setHumanReviewed] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement | null>(null);
  const domain = domains.find((item) => item.selectionHash === domainHash) ?? null;
  const target = targets.find((item) => item.id === targetId) ?? null;
  const currentJournals = useMemo(() => workspace?.journalSets.find((set) => set.directionId === compareDirectionId)?.journals ?? workspace?.journals ?? [], [workspace, compareDirectionId]);
  const currentJournal = currentJournals.find((item) => item.journalId === journalId) ?? currentJournals[0] ?? null;
  const selectedDirection = workspace?.directions.find((item) => item.directionId === compareDirectionId) ?? null;

  async function start() {
    if (!domain || !target?.enabled || !target.selection || !direction.trim()) return;
    setBusy(true); setError(null); setAnnouncement("老麥正在整理研究方向、期刊適配與提交生命週期。");
    try {
      const payload = await postWorkspace({ requestId: crypto.randomUUID(), domainSelection: domain, targetSelection: target.selection, researchDirection: direction.trim() });
      const result = payload.workspace!;
      setWorkspace(result);
      setCompareDirectionId(result.recommendation.directionId);
      setJournalId(result.recommendation.journalId);
      setHumanReviewed(false);
      setAnnouncement("三個研究方向與每個方向的三本候選期刊已完成；推薦方案 S0 為 13/13。切換卡片不會再次送出請求。");
      window.setTimeout(() => resultHeading.current?.focus(), 0);
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === "AbortError" ? "本機示範逾時；目前輸入已保留，未重送。" : "老麥目前無法完成這個本機示範；輸入已保留。" );
      setAnnouncement("本機示範未完成，輸入已保留。" );
    } finally { setBusy(false); }
  }

  function chooseDirection(id: string) {
    setCompareDirectionId(id);
    const journals = workspace?.journalSets.find((set) => set.directionId === id)?.journals ?? [];
    setJournalId(journals.find((item) => item.recommended)?.journalId ?? journals[0]?.journalId ?? null);
    setAnnouncement("已在本機切換研究方向與期刊候選，沒有送出新請求。" );
  }

  return <main className={styles.shell} data-testid="alpha4-workspace" data-formal-write-count={workspace?.formalResearchWriteCount ?? 0}>
    <header className={styles.masthead}>
      <div><p className={styles.kicker}>OLD MIKE · JOURNAL STUDY</p><h1>從研究意圖，到可交付的期刊稿件</h1><p>一次選定研究重心與成果目標；老麥把期刊適配、稿件、審查、引用與提交前查核放在同一張學術工作桌。</p></div>
      <span className={styles.localSeal}>Alpha4 本機合成官方來源示範</span>
    </header>

    <section className={styles.entry} aria-labelledby="entry-heading">
      <div><span className={styles.folio}>01</span><h2 id="entry-heading">定義這次研究</h2><p>兩個必要選擇，沒有預設。NSTC／MOE 清楚標示為 Alpha5 即將推出。</p></div>
      <div className={styles.entryFields}>
        <label>本次研究重心<select required value={domainHash} onChange={(event) => setDomainHash(event.target.value)}><option value="">請選擇研究重心</option>{domains.map((item) => <option key={item.selectionHash} value={item.selectionHash}>{item.label}</option>)}</select></label>
        <label>本次成果目標<select required value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">請選擇成果目標</option>{targets.map((item) => <option key={item.id} value={item.id} disabled={!item.enabled}>{item.label}{item.enabled ? "" : "｜Alpha5 即將推出"}</option>)}</select></label>
        <label className={styles.directionField}>研究關鍵字或方向<textarea value={direction} maxLength={1000} rows={4} onChange={(event) => setDirection(event.target.value)} placeholder="例如：生成式工具如何影響教師以證據修正課程決策" /></label>
        <button className={styles.primary} type="button" disabled={!domain || !target?.enabled || !direction.trim() || busy} onClick={() => void start()}>{busy ? "老麥整理中…" : "建立三個方向與期刊工作區"}</button>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
    </section>

    {workspace && <>
      <nav className={styles.stageRail} aria-label="期刊稿件生命週期">{stages.map(([label, status], index) => <a data-testid="alpha4-stage" key={label} href={`#stage-${index + 1}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong><em data-status={status}>{status}</em></a>)}</nav>

      <section className={styles.directions} id="stage-1" aria-labelledby="directions-heading">
        <div className={styles.sectionHead}><div><span className={styles.folio}>02</span><h2 ref={resultHeading} tabIndex={-1} id="directions-heading">三個可辯護方向</h2></div><p>推薦方案有完整 13 欄 S0；比較切換只改本機畫面。</p></div>
        <div className={styles.cardGrid}>{workspace.directions.map((item) => <button type="button" data-testid="alpha4-direction-card" key={item.directionId} className={`${styles.directionCard} ${compareDirectionId === item.directionId ? styles.selected : ""}`} aria-pressed={compareDirectionId === item.directionId} onClick={() => chooseDirection(item.directionId)}><span>{laneLabel(item.lane)}</span>{item.recommended && <b>推薦</b>}<h3>{item.workingTitle}</h3><p>{item.researchQuestion}</p><small>{item.methodDesign}</small></button>)}</div>
        {selectedDirection && <aside className={styles.comparisonNote}><strong>目前比較：</strong>{selectedDirection.workingTitle}<span>本機切換 · 0 新效果</span></aside>}
      </section>

      <section className={styles.journalDesk} aria-labelledby="journal-heading">
        <div className={styles.sectionHead}><div><span className={styles.folio}>03</span><h2 id="journal-heading">三本期刊，一個可追溯推薦</h2></div><p>SCI 只接受當期 SCIE；SSCI 只接受當期 SSCI。ESCI 或 JIF 不能替代收錄驗證。</p></div>
        <div className={styles.journalLayout}><div className={styles.journalList}>{currentJournals.map((item, index) => <button type="button" data-testid="alpha4-journal-card" key={item.journalId} aria-pressed={currentJournal?.journalId === item.journalId} onClick={() => { setJournalId(item.journalId); setAnnouncement("已在本機切換期刊，沒有送出新請求。" ); }}><span>#{index + 1} · {item.identity.verifiedCollection}</span><h3>{item.title}</h3><p>ISSN-L {item.identity.issnL}</p><em data-status={item.status}>{item.status}</em></button>)}</div>
          {currentJournal && <article className={styles.journalSheet} data-testid="alpha4-journal-detail"><div className={styles.sheetTitle}><span>{currentJournal.recommended ? "老麥推薦" : "比較候選"}</span><h3>{currentJournal.title}</h3><p>{currentJournal.identity.verifiedCollection} · ISSN {currentJournal.identity.issn.join(", ")} · ISSN-L {currentJournal.identity.issnL}</p><p>查核時間 {currentJournal.identity.verifiedAt} · 來源日期 {currentJournal.identity.sourceDate} · 快照 {currentJournal.identity.snapshotHash.slice(0, 12)}… · {currentJournal.identity.freshness}</p></div><h4>JournalFitBlueprint</h4><p>{currentJournal.fit.blueprint.audienceScopeFit}</p><dl><div><dt>貢獻定位</dt><dd>{currentJournal.fit.blueprint.contribution}</dd></div><div><dt>方法與報告</dt><dd>{currentJournal.fit.blueprint.methodsReportingGuideline}</dd></div><div><dt>Desk-reject 風險</dt><dd>{currentJournal.fit.blueprint.deskRejectRisks.join("；")}</dd></div></dl><div className={styles.corpus}><strong>{currentJournal.corpus.publicLabel}</strong><p>{currentJournal.corpus.period.from}—{currentJournal.corpus.period.to} · n={currentJournal.corpus.itemCount} · 官方期數 {currentJournal.corpus.officialIssueCount} · 信心 {currentJournal.corpus.confidence}</p><p>主題：{currentJournal.corpus.observedTopics.join("、")}；方法：{currentJournal.corpus.observedMethods.join("、")}；研究對象：{currentJournal.corpus.observedPopulations.join("、")}</p><p>特刊：{currentJournal.corpus.officialSpecialCollections.join("；")}；徵稿：{currentJournal.corpus.officialCalls.join("；")}</p><small>反證：{currentJournal.corpus.counterEvidence.join("；")}</small></div></article>}
        </div>
      </section>

      <section className={styles.s0Desk} id="stage-3" aria-labelledby="s0-heading"><div className={styles.sectionHead}><div><span className={styles.folio}>04</span><h2 id="s0-heading">推薦方案研究藍圖 · 13/13</h2></div><p>完整 S0 綁定原始 researchIntent；若只比較其他卡片，不會偷偷改寫這份草稿。</p></div><div className={styles.s0Grid}>{Object.entries(workspace.s0.fields).map(([key, value]) => <label data-testid="alpha4-s0-field" key={key}>{fieldLabels[key] ?? key}<textarea defaultValue={value} rows={key === "workingTitle" || key === "domain" || key === "outputTrack" ? 2 : 5} /></label>)}</div></section>

      <section className={styles.reviewDesk} id="stage-5" aria-labelledby="review-heading"><div className={styles.sectionHead}><div><span className={styles.folio}>05</span><h2 id="review-heading">五鏡獨立審查</h2></div><p>審查報告唯讀；修訂另行留痕，最多兩輪。</p></div><div className={styles.reviewGrid}>{workspace.review.reports.map((report) => <article data-testid="alpha4-review-lens" key={report.lens}><span>{lensLabel(report.lens)}</span>{report.findings.map((finding) => <div key={finding.findingId}><strong>{finding.severity}</strong><h3>{finding.title}</h3><p>{finding.evidenceAnchor}</p></div>)}</article>)}</div><div className={styles.adjudication}><strong>Devil’s Advocate CRITICAL 裁定</strong>{workspace.review.daCriticalAdjudications.map((item) => <p key={item.findingId}>{item.status} · {item.rationale}</p>)}</div></section>

      <section className={styles.auditDesk} id="stage-7" aria-labelledby="audit-heading"><div className={styles.sectionHead}><div><span className={styles.folio}>06</span><h2 id="audit-heading">引用與提交前完整性</h2></div><p>存在、metadata、語境三軸分開；語境錯誤直接 BLOCKED。</p></div><div className={styles.auditGrid}><article><h3>引用三軸</h3>{workspace.citationAudit.entries.map((entry) => <dl key={entry.citationId}><div><dt>存在</dt><dd>{entry.existence}</dd></div><div><dt>Metadata</dt><dd>{entry.metadata}</dd></div><div><dt>語境</dt><dd>{entry.context}</dd></div></dl>)}</article><article><h3>必要聲明</h3><ul><li>CRediT authorship</li><li>Ethics / consent</li><li>Data availability</li><li>AI assistance disclosure</li><li>Conflict of interest</li><li>Funding</li></ul></article><article><h3>逐點回覆</h3><p>{workspace.responseLedger.items.length} / {workspace.responseLedger.items.length} 意見已建立回覆與精確變更位置。</p><p>修訂輪次：{workspace.submissionAudit.revisionLoopCount} / 2</p></article></div></section>

      <section className={styles.gate} id="stage-10" aria-labelledby="gate-heading"><div><span className={styles.folio}>07</span><h2 id="gate-heading">READY FOR HUMAN SUBMISSION</h2><p>這是本機合成 fixture 的契約狀態，不代表期刊接受，也不會自動提交。實際提交前必須重新查核 MJL 與官方政策。</p></div><label><input type="checkbox" checked={humanReviewed} onChange={(event) => { setHumanReviewed(event.target.checked); setAnnouncement(event.target.checked ? "已標記為完成人類檢閱；仍未執行外部提交。" : "已取消人類檢閱標記。" ); }} />我已檢閱稿件、引用、官方政策與聲明，理解外部提交仍停用。</label><button type="button" disabled>外部提交（Alpha4 停用）</button><p>Human Gate：{humanReviewed ? "已檢閱，等待未來另行授權" : "尚未確認"} · 外部提交 0</p></section>
    </>}
    <p className={styles.live} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
  </main>;
}
