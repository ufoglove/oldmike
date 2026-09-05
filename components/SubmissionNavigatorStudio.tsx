"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type NavigatorMode = "auto" | "journal" | "nstc" | "moe_tpr" | "compare_all";
type NavigatorStage = "concept" | "proposal" | "data_collection" | "results" | "manuscript";
type TabId = "overview" | "journal" | "nstc" | "moe" | "positioning" | "reviewer" | "evidence";

export type NavigatorInitialTopic = Partial<{
  titleZh: string; titleEn: string; abstract: string; researchGap: string;
  researchQuestions: string[]; theory: string[]; coreProblem: string; primaryContribution: string;
  secondaryContributions: string[]; intervention: string[]; population: string; context: string;
  method: string; variables: string[]; plannedData: string; expectedOutcomes: string[]; noveltyAnalysis: string;
}>;

type RunResponse = {
  state?: StateV2 | null;
  ok?: boolean; code?: string; error?: string; runId?: string; versionNumber?: number; schemaValidated?: boolean;
  output?: Record<string, unknown>; workspace?: { runs: unknown[]; latest: unknown; latestOutput?: Record<string, unknown> | null };
  navigatorV2?: StateV2; context?: Record<string, unknown>; confirmedTopic?: { studyVersionId: string; runId: string; candidate: Record<string, unknown> } | null;
};

type StateV2 = {
  runs: Array<{ id: string; runType: string; targetYear: string; targetMode: string; status: string; createdAt: string }>;
  latest: { id: string; runType: string; targetYear: string; targetMode: string; createdAt: string } | null;
  context: Record<string, unknown> | null;
  journals: Array<Record<string, unknown>>; routes: Array<Record<string, unknown>>; compliance: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>; versions: Array<Record<string, unknown>>; projects: Array<Record<string, unknown>>;
  fatalOpen: Array<Record<string, unknown>>;
};

const MODE_LABELS: Record<NavigatorMode, string> = { auto: "自動判斷（跨路線比較）", journal: "國際期刊選刊", nstc: "國科會計畫選門", moe_tpr: "教學實踐研究選門", compare_all: "全路線比較" };
const STAGE_LABELS: Record<NavigatorStage, string> = { concept: "概念（concept）", proposal: "計畫書（proposal）", data_collection: "資料蒐集中", results: "已有結果", manuscript: "稿件完成" };
const TAB_LABELS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "① 總覽" }, { id: "journal", label: "② 國際期刊" }, { id: "nstc", label: "③ 國科會" },
  { id: "moe", label: "④ 教學實踐" }, { id: "positioning", label: "⑤ 一題三種定位" }, { id: "reviewer", label: "⑥ Reviewer" }, { id: "evidence", label: "⑦ Evidence" },
];
const CONTRIBUTION_LABELS: Record<string, string> = {
  scientific_knowledge: "科學知識", theoretical_contribution: "理論貢獻", methodological_contribution: "方法貢獻", technical_system: "技術系統",
  educational_mechanism: "教育機制", teaching_improvement: "教學改善", professional_practice: "專業實務", policy_or_social_impact: "政策／社會影響",
};

const emptyForm = {
  targetYear: String(new Date().getUTCFullYear() + 1), targetMode: "auto" as NavigatorMode, researchStage: "proposal" as NavigatorStage,
  titleZh: "", titleEn: "", abstract: "", researchGap: "", coreProblem: "", researchQuestions: "", theory: "", intervention: "",
  population: "", context: "", method: "", variables: "", plannedData: "", expectedOutcomes: "", noveltyAnalysis: "",
  primaryContribution: "", secondaryContributions: "",
  position: "", academicExpertise: "", recentPapers: "", recentGrants: "", teachingExpertise: "", teachingOutcomes: "", activeGrants: "",
  journalTier: "", indexRequirement: "", maxAPC: "", projectYears: "", budgetCeiling: "", excludedJournals: "",
  courseName: "", department: "", required: false, teachingProblem: "", plannedInterventionCourse: "", learningOutcomes: "", assessments: "",
  manuscriptTitle: "", articleType: "", methods: "", sample: "", results: "", contribution: "", wordCount: "", ethicsApproval: "", aiToolDisclosure: "",
};
type FormState = typeof emptyForm;

function splitLines(value: string) { return value.split(/\n|；|;|，|,/).map((item) => item.trim()).filter(Boolean).slice(0, 20); }
function requiredList(value: string, fallback: string[] = []): string[] { const list = splitLines(value); return list.length ? list : fallback; }
function newKey(prefix: string) { return `${prefix}:${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function row(value: unknown): Record<string, any> { return record(value) ? (value as Record<string, any>) : {}; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

function contextField(context: Record<string, unknown> | null, key: string): { value: unknown; status: string } {
  const field = context?.[key];
  return record(field) ? { value: field.value, status: text(field.status) } : { value: null, status: "MISSING" };
}

export default function SubmissionNavigatorStudio({ projectId, initialTopic = null, onNavigate }: { projectId: string; initialTopic?: NavigatorInitialTopic | null; onNavigate?: (navId: string) => void }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [stateV2, setStateV2] = useState<StateV2 | null>(null);
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [confirmedTopic, setConfirmedTopic] = useState<RunResponse["confirmedTopic"]>(null);

  useEffect(() => {
    if (initialTopic) {
      setForm((current) => ({
        ...current,
        titleZh: initialTopic.titleZh ?? current.titleZh, titleEn: initialTopic.titleEn ?? current.titleEn,
        abstract: initialTopic.abstract ?? current.abstract, researchGap: initialTopic.researchGap ?? current.researchGap,
        coreProblem: initialTopic.coreProblem ?? current.coreProblem,
        researchQuestions: (initialTopic.researchQuestions ?? []).join("\n") || current.researchQuestions,
        theory: (initialTopic.theory ?? []).join("\n") || current.theory,
        intervention: (initialTopic.intervention ?? []).join("\n") || current.intervention,
        population: initialTopic.population ?? current.population, context: initialTopic.context ?? current.context,
        method: initialTopic.method ?? current.method, variables: (initialTopic.variables ?? []).join("\n") || current.variables,
        plannedData: initialTopic.plannedData ?? current.plannedData,
        expectedOutcomes: (initialTopic.expectedOutcomes ?? []).join("\n") || current.expectedOutcomes,
        noveltyAnalysis: initialTopic.noveltyAnalysis ?? current.noveltyAnalysis,
        primaryContribution: initialTopic.primaryContribution ?? current.primaryContribution,
        secondaryContributions: (initialTopic.secondaryContributions ?? []).join("\n") || current.secondaryContributions,
      }));
    }
  }, [initialTopic]);

  // 草稿還原：伺服器端自動儲存的表單優先；其次從最新 run 的 topic snapshot 還原（不用重跑分析）
  const draftRestoredRef = useRef(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 表單自動儲存：停止輸入 1.5 秒後寫入伺服器草稿（重新整理/換頁不遺失）
  useEffect(() => {
    if (!draftRestoredRef.current) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      void fetch(`/api/projects/${encodeURIComponent(projectId)}/navigator-draft`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form }) }).catch(() => undefined);
    }, 1500);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, projectId]);
  function runTopicToForm(snapshot: Record<string, unknown>): Partial<FormState> {
    const val = (key: string) => record(snapshot[key]) ? (snapshot[key] as Record<string, unknown>).value : null;
    const arr = (key: string) => { const v = val(key); return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : []; };
    const str = (key: string) => { const v = val(key); return typeof v === "string" ? v : ""; };
    return {
      titleZh: str("chinese_title"), titleEn: str("english_title"), abstract: str("concept_abstract"),
      researchGap: str("research_gap"), researchQuestions: arr("research_questions").join("\n"),
      theory: arr("theory").join("\n"), intervention: arr("intervention").join("\n"),
      population: str("population"), context: str("context"), method: str("methodology"),
      variables: arr("variables").join("\n"), expectedOutcomes: arr("expected_contribution").join("\n"),
      noveltyAnalysis: str("novelty_analysis"),
    };
  }

  async function load() {
    setError(""); setLoading(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/submission-navigator`, { cache: "no-store" });
      const data = await response.json() as RunResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "無法載入投稿導航。");
      if (data.workspace?.latestOutput) setResult({ ok: true, output: data.workspace.latestOutput, schemaValidated: true });
      if (data.navigatorV2) setStateV2(data.navigatorV2);
      setContext(data.navigatorV2?.context ?? null);
      setConfirmedTopic(data.confirmedTopic ?? null);
      if (data.navigatorV2 && data.navigatorV2.runs.length === 0 && data.confirmedTopic) {
        await ensureContext(data.confirmedTopic.runId);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "無法載入投稿導航。"); }
    finally { setLoading(false); }
  }

  async function ensureContext(runId: string) {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/submission-navigator/context`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetYear: String(new Date().getUTCFullYear() + 1), idempotencyKey: newKey("navigator-context") }) });
      const data = await response.json() as RunResponse;
      if (response.ok && data.ok) {
        if (data.context) setContext(data.context);
        if (data.state) setStateV2(data.state);
      }
    } catch { /* 保留原狀態 */ }
  }

  useEffect(() => { void load(); }, [projectId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }

  function buildPayload() {
    return {
      targetYear: form.targetYear, targetMode: form.targetMode, researchStage: form.researchStage,
      topicProfile: {
        titleZh: form.titleZh.trim(), titleEn: form.titleEn.trim(), abstract: form.abstract.trim(), researchGap: form.researchGap.trim(),
        researchQuestions: requiredList(form.researchQuestions), theory: requiredList(form.theory),
        coreProblem: form.coreProblem.trim() || form.abstract.trim(), primaryContribution: form.primaryContribution || null,
        secondaryContributions: requiredList(form.secondaryContributions), intervention: requiredList(form.intervention),
        population: form.population.trim(), context: form.context.trim(), method: form.method.trim(),
        variables: requiredList(form.variables), plannedData: form.plannedData.trim(),
        expectedOutcomes: requiredList(form.expectedOutcomes), noveltyAnalysis: form.noveltyAnalysis.trim(),
      },
      researcherProfile: {
        position: form.position.trim() || "待確認（missing）", academicExpertise: requiredList(form.academicExpertise),
        teachingExpertise: requiredList(form.teachingExpertise), recentPapers: requiredList(form.recentPapers),
        recentGrants: requiredList(form.recentGrants), teachingOutcomes: requiredList(form.teachingOutcomes),
        techOutcomes: [], availableEquipment: [], availableData: [], collaborators: [], activeGrants: requiredList(form.activeGrants), pastGrants: [],
      },
      courseProfile: form.courseName.trim() || form.teachingProblem.trim() ? {
        courseName: form.courseName.trim() || "待確認", credits: "", required: form.required, department: form.department.trim() || "待確認",
        semester: "", instructor: "待確認", studentLevel: "", enrollment: null, objectives: [], content: [], currentMethods: [],
        teachingProblem: form.teachingProblem.trim() || "待確認（missing）", problemEvidence: [],
        plannedIntervention: form.plannedInterventionCourse.trim() || "待確認（missing）",
        learningOutcomes: requiredList(form.learningOutcomes), assessments: requiredList(form.assessments), syllabus: "",
      } : null,
      manuscriptProfile: form.manuscriptTitle.trim() ? {
        articleType: form.articleType.trim() || "Original Research", title: form.manuscriptTitle.trim(), abstract: form.abstract.trim(),
        keywords: [], methods: form.methods.trim() || "待確認（missing）", sample: form.sample.trim() || "待確認（missing）",
        results: form.results.trim() || "待確認（missing）", contribution: form.contribution.trim() || "待確認（missing）",
        wordCount: Number.parseInt(form.wordCount, 10) || null, tablesFigures: "", ethicsApproval: form.ethicsApproval.trim() || "待確認（missing）",
        dataAvailability: "待確認（missing）", codeAvailability: "待確認（missing）", funding: "待確認（missing）",
        conflictOfInterest: "待確認（missing）", aiToolDisclosure: form.aiToolDisclosure.trim() || "待確認（missing）",
      } : null,
      institutionProfile: null,
      userConstraints: {
        journalTier: form.journalTier.trim() || null, indexRequirement: form.indexRequirement.trim() || null,
        maxAPC: form.maxAPC.trim() || null, reviewSpeed: null, projectYears: Number.parseInt(form.projectYears, 10) || null,
        budgetCeiling: form.budgetCeiling.trim() || null, sampleAccess: null, methods: null,
        excludedJournals: requiredList(form.excludedJournals), excludedDisciplines: null,
      },
      idempotencyKey: newKey("navigator-run"),
    };
  }


  async function createResearchProject() {
    setBusy("research-project");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/submission-navigator`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...buildPayload(), targetMode: form.targetMode ?? "journal", action: "CREATE_FROM_NAVIGATOR" }) });
      const data = await response.json() as RunResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "建立失敗。");
      setNotice("已依投稿導航內容建立研究專案草稿。");
    } catch (error) { setError(error instanceof Error ? error.message : "建立失敗。"); }
    finally { setBusy(""); }
  }

  async function runMatch(mode: NavigatorMode) {
    if (!form.titleZh.trim()) { setError("請先確認研究題目（可從選題實驗室帶入）。"); return; }
    setError(""); setNotice(""); setBusy(mode);
    try {
      const payload = { ...buildPayload(), targetMode: mode };
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/submission-navigator`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as RunResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "分析失敗。");
      setResult(data);
      if (data.navigatorV2) { setStateV2(data.navigatorV2); setContext(data.navigatorV2.context ?? context); }
      setNotice(`「${MODE_LABELS[mode]}」分析完成；結果已存入專案（schema 驗證 ${data.schemaValidated ? "通過" : "未驗證"}）。`);
      setTab(mode === "journal" ? "journal" : mode === "nstc" ? "nstc" : mode === "moe_tpr" ? "moe" : "overview");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "分析失敗。"); }
    finally { setBusy(""); }
  }

  const output = result?.output;
  const v2 = stateV2;
  const contextPresent = context ? Object.entries(context).filter(([key, field]) => key !== "contractVersion" && key !== "created_at" && record(field) && text(field.status) === "PRESENT").length : 0;
  const contextMissing = context ? Object.entries(context).filter(([key, field]) => key !== "contractVersion" && key !== "created_at" && record(field) && text(field.status) === "MISSING").length : 0;

  const funding = record(output?.funding_route_decision) ? output.funding_route_decision : null;
  const nstc = record(output?.nstc_analysis) ? output.nstc_analysis : null;
  const moe = record(output?.moe_tpr_analysis) ? output.moe_tpr_analysis : null;
  const journal = record(output?.journal_analysis) ? output.journal_analysis : null;
  const strategy = record(output?.final_strategy) ? output.final_strategy : null;
  const rewriting = record(output?.rewriting_package) ? output.rewriting_package : null;
  const compliance = list(output?.compliance_matrix);
  const gates = list(output?.eligibility_gates);
  const evidenceLedger = list(output?.evidence_ledger);
  const ruleSnapshots = list(output?.rule_snapshots);
  const limitations = list(output?.limitations);

  const fatalOpen = useMemo(() => {
    const fromMatrix = compliance.filter((item) => text(row(item).severity) === "fatal" && text(row(item).status) !== "met" && text(row(item).status) !== "not_applicable").map((item) => text(row(item).requirement_id));
    const fromGates = gates.filter((item) => text(row(item).severity) === "fatal" && text(row(item).status) !== "pass" && text(row(item).status) !== "not_applicable").map((item) => `Gate：${text(row(item).item)}`);
    return [...fromMatrix, ...fromGates];
  }, [compliance, gates]);
  const submissionReady = output ? fatalOpen.length === 0 : false;
  const quickJournal = v2?.journals?.[0] ?? null;
  const quickNstc = v2?.routes?.find((r) => text(r.routeType) === "NSTC") ?? null;
  const quickMoe = v2?.routes?.find((r) => text(r.routeType) === "MOE_TPR") ?? null;

  if (loading) {
    return <section className="v13-panel-stack" data-testid="submission-navigator"><div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">投稿與計畫導航</p><h2>投稿導航</h2></div><p className="v13-panel-note">載入專案與選題狀態…</p></div><p className="v13-muted" role="status">正在讀取選題實驗室結果與既有分析紀錄。</p></div></section>;
  }

  return (
    <section className="v13-panel-stack" data-testid="submission-navigator">
      <div className="v13-panel">
        <div className="v13-panel-head"><div><p className="section-kicker">SUBMISSION NAVIGATOR · 讓正確的研究，送到正確的審查者面前</p><h2>投稿導航</h2></div><p className="v13-panel-note">依研究問題、方法、貢獻、主持人專長與最新官方規定，快速匹配期刊及研究計畫。Fit Score 為系統內部適配度，不代表期刊接受率或計畫通過率。</p></div>
        {confirmedTopic && <div className="v13-list"><p><b>已承接正式選題</b><span>來源：選題實驗室 promotion（study {text(confirmedTopic.studyVersionId).slice(0, 12)}…）</span><span>Submission Context：{contextPresent} 欄位已帶入，{contextMissing} 欄位標 missing（不造假，可於下方表單補充）</span></p></div>}
        {!confirmedTopic && !form.titleZh.trim() && <div className="v13-list"><p><b>尚未承接選題</b><span>請先到「選題實驗室」完成並核准候選題目，再回到這裡；或直接於下方輸入研究資料。</span></p></div>}
      </div>

      <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">CURRENT TOPIC · 目前研究題目</p><h3>研究題目摘要</h3></div></div>
        <div className="v13-list">
          <p><b>中文</b>{form.titleZh || text(row(context?.chinese_title).value) || "尚未帶入"}</p>
          <p><b>英文</b>{form.titleEn || text(row(context?.english_title).value) || "尚未帶入"}</p>
          <p><b>Research Gap</b>{form.researchGap || text(row(context?.research_gap).value) || "尚未帶入"}</p>
          <p><b>主要研究貢獻</b>{form.expectedOutcomes.split("\n")[0] || text(row(context?.expected_contribution).value) || "尚未帶入"}</p>
          {form.primaryContribution && <p><b>貢獻類型</b>{CONTRIBUTION_LABELS[form.primaryContribution] ?? form.primaryContribution}</p>}
        </div>
        <div className="research-actions">
          {onNavigate && <button type="button" className="secondary-button" onClick={() => onNavigate("topic-lab")}>返回選題實驗室</button>}
        </div>
      </div>

      <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">QUICK MATCH · 快速分析</p><h3>這題接下來最適合走哪一條路？</h3></div><p className="v13-panel-note">三分鐘內先看方向；三條路線不互斥（可先申請計畫 → 執行研究 → 再投期刊）。</p></div>
        <div className="v13-path-scroll">
          <div className="v13-path-station"><strong>期</strong><span>國際期刊</span><small>Publication Route{quickJournal ? ` · 最佳適配 ${text(row(quickJournal).journalName)}` : " · 尚未分析"}</small><em style={{ fontSize: 9, color: "var(--teal)" }}>{text(row(quickJournal).deskRejectRisk) || ""}</em><button type="button" className="secondary-button" disabled={busy === "journal"} onClick={() => void runMatch("journal")}>{busy === "journal" ? "分析中…" : output ? "重新分析" : "分析期刊"}</button></div>
          <div className="v13-path-station"><strong>國</strong><span>國科會一般研究計畫</span><small>Funding Route{quickNstc ? ` · ${text(row(quickNstc).routeName)}` : " · 尚未分析"}</small><em style={{ fontSize: 9, color: "var(--teal)" }}>{typeof row(quickNstc).fitScore === "number" ? `Fit ${row(quickNstc).fitScore}/100` : ""}</em><button type="button" className="secondary-button" disabled={busy === "nstc"} onClick={() => void runMatch("nstc")}>{busy === "nstc" ? "分析中…" : output ? "重新分析" : "分析學門"}</button></div>
          <div className="v13-path-station"><strong>教</strong><span>教育部教學實踐</span><small>{text(row(quickMoe).routeName) || "Eligibility 待分析"}</small><em style={{ fontSize: 9, color: "var(--teal)" }}>{typeof row(quickMoe).fitScore === "number" ? `Fit ${row(quickMoe).fitScore}/100` : ""}</em><button type="button" className="secondary-button" disabled={busy === "moe_tpr"} onClick={() => void runMatch("moe_tpr")}>{busy === "moe_tpr" ? "分析中…" : output ? "重新分析" : "分析教學實踐"}</button></div>
        </div>
        {notice && <p className="v13-muted" role="status">{notice}</p>}
        {error && <p className="v13-error" role="alert">{error}</p>}
      </div>

      <div className="v13-tabs" role="tablist" aria-label="投稿導航分頁">
        {TAB_LABELS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={`v13-tab ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </div>

      {tab === "overview" && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">總覽</p><h3>總覽</h3></div></div>
        {!output && <div className="v13-empty"><div><strong>尚未執行分析</strong><p>點上方任一 Quick Match 卡片開始；或先展開下方「輸入資料」確認題目與主持人資料。</p></div></div>}
        {output && <><div className="v13-status-grid">
          <div><small>輸入完整度</small><strong>{text(row(output.input_audit).completeness_score)} / 100</strong></div>
          <div><small>Fatal open items</small><strong>{fatalOpen.length}</strong></div>
          <div><small>送件條件</small><strong>{submissionReady ? "具備（仍需人工確認）" : "尚未具備"}</strong></div>
        </div>
        {funding && <div className="v13-list"><p><b>資助路線建議</b>{text(funding.recommended_route)}<span>備選：{text(funding.alternative_route) || "無"}</span><span>不建議：{list(funding.not_recommended_route).join("、") || "無"}</span></p><p>{text(funding.reason)}</p>{text(funding.duplicate_funding_risk) && <p><b>重複補助風險：</b>{text(funding.duplicate_funding_risk)}</p>}</div>}
        {strategy && <div className="v13-list"><p><b>最終策略</b><span>資助：{text(strategy.funding_route)}</span><span>期刊：{text(strategy.publication_route)}</span></p><p>{text(strategy.main_reason)}</p><p><b>下一步：</b>{text(strategy.next_action)}</p></div>}
        {fatalOpen.length > 0 && <div className="v13-list"><p><b>未通過的 fatal 項目</b>{fatalOpen.map((item) => <span key={item}>{item}</span>)}</p></div>}
        </>}
      </div>}

      {tab === "journal" && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">JOURNAL · 國際期刊</p><h3>{text(row(journal).recommendation_stage) === "formal_submission_selection" ? "正式選刊" : "前瞻期刊布局（反推未來研究設計，尚非最終投稿）"}</h3></div><p className="v13-panel-note">Fit Score 為內部選刊分數，不代表接受率。未驗證的 APC／分區顯示「目前尚未驗證」。</p></div>
        {!output && <div className="v13-empty"><div><strong>尚未分析期刊</strong><p>點擊 Quick Match「國際期刊」卡片。</p></div></div>}
        {output && <div className="v13-table-wrap"><table><thead><tr><th>期刊</th><th>出版商</th><th>Fit</th><th>Desk Reject Risk</th><th>分區／指標</th><th>APC</th><th>主要風險</th></tr></thead><tbody>{list(row(journal).candidate_journals).map((item, index) => { const j = row(item); const metric = [text(j.quartile_info), text(j.impact_factor)].filter(Boolean).join("；"); const risk = text(j.major_risk) || text(j.contribution_delta)?.slice(0, 120); return <tr key={`${text(j.journal_name)}-${index}`}><td>{text(j.journal_name)}</td><td>{text(j.publisher)}</td><td>{typeof j.fit_score === "number" ? j.fit_score : "—"}</td><td>{text(j.desk_reject_risk)}</td><td>{metric || "目前尚未驗證"}</td><td>{text(j.apc) || "目前尚未驗證"}</td><td>{risk}</td></tr>; })}</tbody></table></div>}
        {record(row(journal).top_3) && <div className="v13-list"><p><b>Top 3</b><span>Best Fit：{text(row(row(journal).top_3.best_fit).journal_name) || "—"}</span><span>Ambitious：{text(row(row(journal).top_3.ambitious_choice).journal_name) || "—"}</span><span>Practical：{text(row(row(journal).top_3.practical_choice).journal_name) || "—"}</span></p></div>}
      </div>}

      {tab === "nstc" && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">NSTC · 國科會一般專題研究計畫</p><h3>學門導航</h3></div><p className="v13-panel-note">依問題、方法、貢獻與主持人績效分析學門，非只看關鍵詞。年度規則以官方公告為準；新年度未公告時顯示 pending。</p></div>
        {!output && <div className="v13-empty"><div><strong>尚未分析國科會學門</strong><p>點擊 Quick Match「國科會」卡片。</p></div></div>}
        {output && <div className="v13-table-wrap"><table><thead><tr><th>路線</th><th>代碼</th><th>Fit</th><th>優勢／理由</th><th>主要風險</th></tr></thead><tbody>{list(row(nstc).routes).map((route, index) => { const r = row(route); const name = text(r.discipline) || text(r.route_name); const strengths = list(r.strengths).length ? list(r.strengths) : (text(r.rationale) ? [text(r.rationale)] : []); const risks = list(r.risks).length ? list(r.risks) : list(r.key_risks); return <tr key={`${text(r.route_id)}-${index}`}><td>{name}</td><td>{text(r.discipline_code) || "—"}</td><td>{typeof r.fit_score === "number" ? r.fit_score : "—"}</td><td>{strengths.join("；")}</td><td>{risks.join("；")}</td></tr>; })}</tbody></table></div>}
        {list(row(nstc).routes).length === 0 && output && <p className="v13-muted">此模式未產生路線（例如僅執行期刊分析）。</p>}
      </div>}

      {tab === "moe" && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">MOE TPR · 教育部教學實踐研究</p><h3>Eligibility Gate 與學門導航</h3></div><p className="v13-panel-note">先檢查硬性資格（主授課程、正式學分、研究對象）；硬性 FAIL 時顯示「目前尚不符合正式申請條件」，不給假性分數。</p></div>
        {!output && <div className="v13-empty"><div><strong>尚未分析教學實踐</strong><p>點擊 Quick Match「教學實踐」卡片；缺少課程資料時會標 Conditional。</p></div></div>}
        {output && <div className="v13-table-wrap"><table><thead><tr><th>學門／專案</th><th>Fit</th><th>優勢／理由</th><th>風險／條件</th><th>審查委員可能疑問</th></tr></thead><tbody>{list(row(moe).routes).map((route, index) => { const r = row(route); const name = text(r.discipline_or_project) || text(r.route_name); const strengths = list(r.strengths).length ? list(r.strengths) : (text(r.rationale) ? [text(r.rationale)] : []); const risks = list(r.risks).length ? list(r.risks) : (text(r.condition) ? [text(r.condition)] : []); return <tr key={`${text(r.route_id)}-${index}`}><td>{name}</td><td>{typeof r.fit_score === "number" ? r.fit_score : "—"}</td><td>{strengths.join("；")}</td><td>{risks.join("；")}</td><td>{list(r.reviewer_questions).join("；")}</td></tr>; })}</tbody></table></div>}
        {record(row(moe).course_research_alignment) && <div className="v13-list"><p><b>教學實踐邏輯鏈</b>{text(row(moe).course_research_alignment.teaching_problem)} → {text(row(moe).course_research_alignment.intervention)} → {text(row(moe).course_research_alignment.learning_mechanism)} → {text(row(moe).course_research_alignment.learning_outcome)} → {text(row(moe).course_research_alignment.assessment)}<span>邏輯鏈連續：{row(moe).course_research_alignment.evidence_chain_continuous === true ? "是" : "否"}</span></p></div>}
      </div>}

      {tab === "positioning" && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">一題三種定位</p><h3>一題三種定位</h3></div><p className="v13-panel-note">同一研究 Idea 在不同投稿目的下的重新定位；原始題目永不覆蓋。</p></div>
        {!output && <div className="v13-empty"><div><strong>尚未分析</strong><p>先執行任一分析以產生改寫包。</p></div></div>}
        {output && <>
          {list(row(rewriting).nstc_versions).map((item, index) => { const r = row(item); const sell = text(r.sell_point) || text(r.note) || text(r.abstract_angle); return <div className="v13-list" key={`nstc-${index}`}><p><b>國科會版本：{text(r.title_zh)}</b><span>{text(r.title_en) || text(r.abstract_angle)}</span><span>定位：{sell}</span></p></div>; })}
          {list(row(rewriting).moe_tpr_versions).map((item, index) => { const r = row(item); const sell = text(r.sell_point) || text(r.note); return <div className="v13-list" key={`moe-${index}`}><p><b>教學實踐版本：{text(r.title_zh)}</b><span>{text(r.title_en) || text(r.abstract_angle)}</span><span>定位：{sell}</span></p></div>; })}
          {list(row(rewriting).journal_versions).map((item, index) => { const r = row(item); const sell = text(r.sell_point) || text(r.angle); return <div className="v13-list" key={`journal-${index}`}><p><b>國際期刊版本：{text(r.journal) || text(r.title_en)}</b><span>{text(r.title_en)}</span><span>定位：{sell}</span></p></div>; })}
          {list(row(rewriting).nstc_versions).length === 0 && list(row(rewriting).moe_tpr_versions).length === 0 && list(row(rewriting).journal_versions).length === 0 && <p className="v13-muted">目前輸出未包含改寫包（可能尚未執行完整比較分析）。</p>}
        </>}
      </div>}

      {tab === "reviewer" && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">審稿模擬</p><h3>三種審查者檢視</h3></div><p className="v13-panel-note">固定輸出優勢、疑慮、最大退件風險與最需修改的三件事；不只稱讚。</p></div>
        {!output && <div className="v13-empty"><div><strong>尚未分析</strong><p>先執行任一分析。</p></div></div>}
        {output && <>
          {record(row(journal).editor_simulation) && <div className="v13-list"><p><b>Journal Editor</b><span>最大 Desk Reject 原因：{text(row(journal).editor_simulation.max_desk_reject_reason)}</span><span>修改方向：{text(row(journal).editor_simulation.required_revisions)}</span></p></div>}
          {record(row(nstc).reviewer_simulation) && <div className="v13-list"><p><b>NSTC Reviewer</b><span>最大不通過原因：{text(row(nstc).reviewer_simulation.max_failure_reason)}</span></p></div>}
          {record(row(moe).reviewer_simulation) && <div className="v13-list"><p><b>教學實踐 Reviewer</b><span>最大不通過原因：{text(row(moe).reviewer_simulation.max_failure_reason)}</span></p></div>}
        </>}
      </div>}

      {tab === "evidence" && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">EVIDENCE LEDGER · 共用證據帳本</p><h3>證據與規定快照</h3></div></div>
        {!output && <div className="v13-empty"><div><strong>尚無證據</strong><p>先執行分析。</p></div></div>}
        {output && <>
          {ruleSnapshots.length > 0 && <div className="v13-table-wrap"><table><thead><tr><th>來源</th><th>文件</th><th>年度</th><th>狀態</th><th>查證時間</th></tr></thead><tbody>{ruleSnapshots.map((item, index) => { const r = row(item); return <tr key={index}><td>{text(r.authority)}</td><td>{text(r.document_title)}</td><td>{text(r.target_year)}</td><td>{text(r.verification_status)}</td><td>{text(r.retrieved_at)}</td></tr>; })}</tbody></table></div>}
          {evidenceLedger.length > 0 && <div className="v13-table-wrap"><table><thead><tr><th>主張</th><th>來源類型</th><th>狀態</th><th>查證時間</th></tr></thead><tbody>{evidenceLedger.map((item, index) => { const r = row(item); return <tr key={index}><td>{text(r.claim)}</td><td>{text(r.source_type)}</td><td>{text(r.verification_status)}</td><td>{text(r.retrieved_at)}</td></tr>; })}</tbody></table></div>}
          {limitations.length > 0 && <div className="v13-list"><p><b>不確定性</b>{limitations.map((item, index) => <span key={index}>{text(item)}</span>)}</p></div>}
        </>}
      </div>}

      {output && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">合規矩陣</p><h3>規定對照與缺漏檢查</h3></div></div>
        <div className="v13-table-wrap"><table><thead><tr><th>ID</th><th>路線</th><th>規定</th><th>官方來源</th><th>狀態</th><th>嚴重度</th><th>缺漏</th><th>需採取行動</th></tr></thead><tbody>{compliance.map((item, index) => { const c = row(item); return <tr key={`${text(c.requirement_id)}-${index}`} className={text(c.severity) === "fatal" ? "compliance-fatal" : ""}><td>{text(c.requirement_id)}</td><td>{text(c.route)}</td><td>{text(c.requirement)}</td><td>{text(c.official_source)}</td><td>{text(c.status)}</td><td>{text(c.severity)}</td><td>{text(c.missing_item)}</td><td>{text(c.required_action)}</td></tr>; })}</tbody></table></div>
        {submissionReady ? <p className="v13-muted" role="status">符合老麥導航器的正式送件條件；仍須使用者最終確認。</p> : <p className="v13-error" role="status">尚未具備正式送件條件。</p>}
      </div>}

      <details className="v13-details"><summary>輸入資料（選題實驗室已帶入；可在此補強主持人／課程／稿件資料）</summary>
        <div className="research-two-columns">
          <label className="research-field">目標年度<input value={form.targetYear} maxLength={4} onChange={(event) => update("targetYear", event.target.value)} /></label>
          <label className="research-field">研究階段<select value={form.researchStage} onChange={(event) => update("researchStage", event.target.value as NavigatorStage)}>{(Object.keys(STAGE_LABELS) as NavigatorStage[]).map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}</select></label>
        </div>
        <div className="research-two-columns">
          <label className="research-field">中文題目<input value={form.titleZh} maxLength={200} onChange={(event) => update("titleZh", event.target.value)} /></label>
          <label className="research-field">英文題目<input value={form.titleEn} maxLength={300} onChange={(event) => update("titleEn", event.target.value)} /></label>
        </div>
        <label className="research-field">Concept Abstract<textarea rows={2} maxLength={6000} value={form.abstract} onChange={(event) => update("abstract", event.target.value)} /></label>
        <label className="research-field">Research Gap<textarea rows={2} maxLength={4000} value={form.researchGap} onChange={(event) => update("researchGap", event.target.value)} /></label>
        <label className="research-field">研究方法<textarea rows={2} value={form.method} onChange={(event) => update("method", event.target.value)} /></label>
        <div className="research-two-columns">
          <label className="research-field">主持人現職與資格<input value={form.position} maxLength={500} onChange={(event) => update("position", event.target.value)} placeholder="缺欄會標 missing；不造假" /></label>
          <label className="research-field">近五年論文（每行一篇）<textarea rows={2} value={form.recentPapers} onChange={(event) => update("recentPapers", event.target.value)} /></label>
        </div>
        <div className="research-two-columns">
          <label className="research-field">近五年計畫<textarea rows={2} value={form.recentGrants} onChange={(event) => update("recentGrants", event.target.value)} /></label>
          <label className="research-field">限制條件（期刊等級/APC/排除）<input value={form.journalTier} onChange={(event) => update("journalTier", event.target.value)} placeholder="例：SSCI Q1；APC ≤ USD 3000" /></label>
        </div>
        <label className="v13-check"><input type="checkbox" checked={form.required} onChange={(event) => update("required", event.target.checked)} />課程為正式畢業學分課程（教學實踐需要）</label>
        <label className="research-field">教學現場問題<textarea rows={2} value={form.teachingProblem} onChange={(event) => update("teachingProblem", event.target.value)} /></label>
      </details>

      <div className="research-actions">
        <button type="button" className="primary-button" disabled={busy === "compare_all" || !form.titleZh.trim()} onClick={() => void runMatch("compare_all")}>{busy === "compare_all" ? "深度分析中…" : "深度分析（全路線）"}</button>
        <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void createResearchProject()}>{busy === "research-project" ? "建立中…" : "建立研究專案"}</button>
        <button type="button" className="secondary-button" disabled={!output} onClick={() => setNotice((current) => current || "目前狀態已保存在專案內；重新進入投稿導航會自動還原。")}>儲存</button>
        <button type="button" className="secondary-button" disabled={!stateV2?.latest?.id || busy !== ""} onClick={() => { setNotice("建立投稿專案：目前記錄為 PLANNED；正式研究專案請用「智慧建立專案」接續。"); }}>建立投稿專案</button>
        {onNavigate && <button type="button" className="secondary-button" onClick={() => onNavigate("topic-lab")}>返回選題實驗室</button>}
      </div>
    </section>
  );
}
