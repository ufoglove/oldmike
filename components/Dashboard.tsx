"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Icon from "./Icons";
import ResearchWorkflow from "./ResearchWorkflow";
import { canonicalDomains, outputTracks, stages, type OutputTrackId } from "@/lib/research-config";
import { CONFIRMATION_PHRASE, type FieldErrors, type ProjectPreview, type ProjectStage, type ProjectSummary, type S0Intake } from "@/lib/project-contract";

type Message = { role: "user" | "assistant"; content: string };
type SourceState = "loading" | "demo" | "live" | "error";
type CompatibilityWarning = { projectId: string; code: "LEGACY_STATUS_NORMALIZED"; fields: Array<{ field: string; original: string; canonical: string; reason: string }> };

const initialIntake: S0Intake = {
  workingTitle: "",
  domain: canonicalDomains[0],
  outputTrack: "NSTC",
  problemContext: "",
  targetUsers: "",
  expectedContribution: "",
  existingData: "目前沒有已確認資料",
  availableData: "",
  methodIdea: "",
  timeline: "",
  constraints: "",
  ethicsPrivacyRisks: "尚未完成正式倫理、隱私與授權審查",
  unresolvedItems: "",
};

const stepTitles = ["研究定位", "問題與貢獻", "資料與執行", "風險與預覽"];
const stepFields: Array<Array<keyof S0Intake>> = [
  ["workingTitle", "domain", "outputTrack"],
  ["problemContext", "targetUsers", "expectedContribution", "methodIdea"],
  ["existingData", "availableData", "timeline", "constraints"],
  ["ethicsPrivacyRisks", "unresolvedItems"],
];

function stageNumber(stage?: ProjectStage) {
  const match = stage?.match(/^S(\d+)/);
  return match ? Number(match[1]) : 0;
}

function stageTitle(stage?: ProjectStage) {
  const id = stage?.slice(0, 2) || "S0";
  return stages.find((item) => item.id === id)?.title || "研究定位";
}

function statusLabel(value: string) {
  if (value === "VERIFIED") return "已驗證";
  if (value === "SUPPORTED") return "有支持";
  if (value === "BLOCKED") return "受阻";
  if (value === "REQUIRED") return "需要人工確認";
  if (value === "CLEAR") return "目前無阻塞";
  return "尚未驗證";
}

function TextField({ field, label, value, error, onChange, multiline = true, maxLength = 4000 }: { field: keyof S0Intake; label: string; value: string; error?: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number }) {
  const inputId = "intake-" + field;
  return (
    <div className={"intake-field " + (error ? "has-error" : "")}>
      <label htmlFor={inputId}>{label}<span aria-hidden="true"> *</span></label>
      {multiline ? <textarea id={inputId} value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} aria-invalid={Boolean(error)} aria-describedby={error ? inputId + "-error" : undefined} rows={4} /> : <input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} aria-invalid={Boolean(error)} aria-describedby={error ? inputId + "-error" : undefined} />}
      <small>{value.length}/{maxLength}</small>
      {error && <p id={inputId + "-error"} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

function StatusCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return <div className={"status-card " + (tone || "")}><span>{label}</span><strong>{statusLabel(value)}</strong><small>{value}</small></div>;
}

export default function Dashboard({ displayName = "使用者" }: { displayName?: string }) {
  const safeDisplayName = displayName.trim() || "使用者";
  const displayInitial = Array.from(safeDisplayName)[0] || "麥";
  const [mobileNav, setMobileNav] = useState(false);
  const [activeNav, setActiveNav] = useState("overview");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectSummary | null>(null);
  const [sourceState, setSourceState] = useState<SourceState>("loading");
  const [dashboardError, setDashboardError] = useState("");
  const [compatibilityWarnings, setCompatibilityWarnings] = useState<CompatibilityWarning[]>([]);
  const [successProject, setSuccessProject] = useState<ProjectSummary | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<S0Intake>(initialIntake);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [preview, setPreview] = useState<ProjectPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [intakeLoading, setIntakeLoading] = useState(false);
  const [intakeError, setIntakeError] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const conversationId = useRef("portal-" + Date.now());
  const composerRef = useRef<HTMLTextAreaElement>(null);

  async function loadProjects() {
    setSourceState("loading");
    setDashboardError("");
    setCompatibilityWarnings([]);
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; demo?: boolean; projects?: ProjectSummary[]; compatibilityWarnings?: CompatibilityWarning[]; error?: string };
      if (response.status === 401) { location.href = "/login"; return; }
      if (!response.ok || !data.ok) throw new Error(data.error || "無法取得專案");
      const nextProjects = Array.isArray(data.projects) ? data.projects : [];
      setProjects(nextProjects);
      setCompatibilityWarnings(Array.isArray(data.compatibilityWarnings) ? data.compatibilityWarnings : []);
      setSourceState(data.demo ? "demo" : "live");
      setCurrentProject((current) => current && nextProjects.find((project) => project.projectId === current.projectId) || nextProjects[0] || null);
    } catch (error) {
      setSourceState("error");
      setDashboardError(error instanceof Error ? error.message : "無法取得專案");
    }
  }

  useEffect(() => { void loadProjects(); }, []);

  useEffect(() => {
    conversationId.current = "portal-" + (currentProject?.projectId || "no-project") + "-" + Date.now();
    setMessages([{ role: "assistant", content: currentProject ? "已載入正式專案 " + currentProject.projectId + "。後續對話固定使用 Portal 授權的 PostgreSQL 專案脈絡。" : "目前尚未選取正式專案。請先建立專案，才能讓後續對話固定帶入安全 Project ID。" }]);
  }, [currentProject?.projectId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setChatOpen(false); setIntakeOpen(false); } };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => { if (chatOpen) composerRef.current?.focus(); }, [chatOpen]);

  function openIntake() {
    setActiveNav("new");
    setIntake(initialIntake);
    setStep(0);
    setPreview(null);
    setConfirmed(false);
    setFieldErrors({});
    setIntakeError("");
    setIntakeOpen(true);
  }

  function updateField(field: keyof S0Intake, value: string) {
    setIntake((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateStep() {
    const errors: FieldErrors = {};
    for (const field of stepFields[step]) {
      if (!intake[field].trim()) errors[field] = "此欄位為必填，若尚未知道請明確填寫「尚未確定」。";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function createPreview(event?: FormEvent) {
    event?.preventDefault();
    if (!validateStep()) return;
    setIntakeLoading(true);
    setIntakeError("");
    try {
      const response = await fetch("/api/projects/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake }) });
      const data = await response.json() as { ok?: boolean; preview?: ProjectPreview; error?: string; fieldErrors?: FieldErrors };
      if (!response.ok || !data.ok || !data.preview) { setFieldErrors(data.fieldErrors || {}); throw new Error(data.error || "無法產生預覽"); }
      setPreview(data.preview);
      setConfirmed(false);
      setIntakeError("");
    } catch (error) {
      setIntakeError(error instanceof Error ? error.message : "無法產生預覽");
    } finally { setIntakeLoading(false); }
  }

  async function confirmCreate() {
    if (!preview || !confirmed) return;
    setIntakeLoading(true);
    setIntakeError("");
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake, projectId: preview.projectId, previewHash: preview.previewHash, confirmed: true, confirmationText: CONFIRMATION_PHRASE }) });
      const data = await response.json() as { ok?: boolean; project?: ProjectSummary; compatibilityWarnings?: CompatibilityWarning[]; error?: string };
      if (!response.ok || !data.ok || !data.project) throw new Error(data.error || "正式專案建立失敗");
      const createdProject = data.project;
      setCurrentProject(createdProject);
      setProjects((current) => [createdProject, ...current.filter((project) => project.projectId !== createdProject.projectId)]);
      setSuccessProject(createdProject);
      setCompatibilityWarnings(Array.isArray(data.compatibilityWarnings) ? data.compatibilityWarnings : []);
      setIntakeOpen(false);
      setSourceState("live");
    } catch (error) {
      setIntakeError(error instanceof Error ? error.message : "正式專案建立失敗；未顯示假成功");
    } finally { setIntakeLoading(false); }
  }

  async function sendMessage(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const content = (preset || input).trim().slice(0, 8000);
    if (!content || chatLoading) return;
    if (!currentProject) { setMessages((current) => [...current, { role: "assistant", content: "請先選取正式專案；老麥不會在沒有 Project ID 時讀取或推測專案脈絡。" }]); return; }
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setChatLoading(true);
    setChatOpen(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: currentProject.projectId, message: content, idempotencyKey: `${conversationId.current}:${nextMessages.length}` }) });
      const data = await response.json() as { content?: string; error?: string };
      setMessages((current) => [...current, { role: "assistant", content: data.content || data.error || "暫時無法取得回覆。" }]);
    } catch { setMessages((current) => [...current, { role: "assistant", content: "連線失敗；未取得可驗證的老麥回覆。" }]); }
    finally { setChatLoading(false); }
  }

async function logout() { await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json", Origin: location.origin }, body: "{}" }); location.href = "/login"; }

  const currentStage = stageNumber(currentProject?.currentStage);
  const activeStageId = currentProject?.currentStage.slice(0, 2) || "S0";

  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobileNav ? "open" : "")}>
        <div className="sidebar-head"><div className="brand-mark"><span>麥</span></div><div><strong>老麥</strong><small>科研工作台</small></div><button type="button" className="icon-button mobile-only" onClick={() => setMobileNav(false)} aria-label="關閉選單"><Icon name="close" /></button></div>
        <nav aria-label="研究工作台導覽">
          <p className="nav-label">研究工作台</p>
          <button type="button" className={activeNav === "overview" ? "active" : ""} onClick={() => { setActiveNav("overview"); setMobileNav(false); }}><Icon name="grid" /><span>專案總覽</span></button>
          <button type="button" className={activeNav === "new" ? "active" : ""} onClick={() => { openIntake(); setMobileNav(false); }}><Icon name="plus" /><span>建立新專案</span></button>
          <button type="button" onClick={() => void sendMessage(undefined, "請依目前正式專案檔案，整理目前 stage、證據狀態、阻塞項與唯一下一步。若沒有正式專案，請明確說明未建立。")}><Icon name="folder" /><span>專案協作</span></button>
          <button type="button" onClick={() => void sendMessage(undefined, "請檢查目前正式專案的 evidence、risk 與 human gate，列出不能直接往下走的項目。")}><Icon name="shield" /><span>研究誠信</span></button>
          <p className="nav-label second">資料邊界</p>
          <div className="sidebar-note"><span className={"source-dot " + sourceState} />{sourceState === "live" ? "正式專案資料" : sourceState === "demo" ? "展示資料／未建立專案" : sourceState === "loading" ? "正在讀取專案" : "資料來源暫不可用"}</div>
        </nav>
        <div className="sidebar-foot"><div className="identity-dot" aria-hidden="true">{displayInitial}</div><div className="sidebar-identity"><strong>{safeDisplayName}</strong><small>個人工作區</small></div><button type="button" className="icon-button" onClick={() => void logout()} title="登出" aria-label={`登出 ${safeDisplayName}`}><Icon name="logout" size={18} /></button></div>
      </aside>

      <main className="workspace">
        <header className="topbar"><button type="button" className="icon-button mobile-only" onClick={() => setMobileNav(true)} aria-label="開啟選單"><Icon name="menu" /></button><div><p className="breadcrumb">研究工作台 <span>/</span> {currentProject ? "正式專案" : "尚未建立專案"}</p><h1>{currentProject ? "把研究狀態變成可追溯的專案" : "先建立你的第一個科研專案"}</h1></div><div className="top-actions"><div className={"verified-pill " + (sourceState === "live" ? "real" : "demo")}><span />{sourceState === "live" ? "正式專案資料" : "展示／未驗證"}</div><button type="button" className="primary-button" onClick={openIntake}><Icon name="plus" size={18} /> 建立研究專案</button></div></header>

        {successProject && <section className="success-banner" aria-live="polite"><div className="success-icon">✓</div><div><p className="section-kicker">專案已建立 · 已驗證來源</p><h2>正式專案已建立：{successProject.projectId}</h2><p>已由專案建立流程回傳可解析成功狀態，正式路徑為 <code>{successProject.path}/</code>。後續聊天會固定帶入此 Project ID。</p></div><button type="button" className="secondary-button" onClick={() => setSuccessProject(null)}>關閉提示</button></section>}
        {dashboardError && <div className="inline-error" role="alert">{dashboardError}<button type="button" onClick={() => void loadProjects()}>重新讀取</button></div>}
        {compatibilityWarnings.length > 0 && <section className="compatibility-banner" role="status" aria-live="polite"><div className="compatibility-icon">!</div><div><p className="section-kicker">舊版相容 · 已驗證來源</p><h2>舊版專案狀態已保守轉換，尚未修改原始專案</h2><p>Risk：BLOCKED／高風險待處理；Human Gate：REQUIRED／需要人工確認；Evidence：UNVERIFIED。這些狀態只在老麥回應層正規化，不會寫回正式專案。</p><ul>{compatibilityWarnings.flatMap((warning) => warning.fields.map((field) => <li key={warning.projectId + field.field}><code>{field.field}</code>：{field.original} → {field.canonical}（{field.reason}）</li>))}</ul></div></section>}

        <section className={"hero-card " + (currentProject ? "real-project" : "empty-project")}>
          <div><p className="section-kicker">{currentProject ? "ACTIVE PROJECT · 正式資料" : "NO ACTIVE PROJECT · 展示資料"}</p><h2>{currentProject ? currentProject.workingTitle : "從 S0 Intake 開始，建立唯一研究真相來源"}</h2><p>{currentProject ? "這張摘要卡只呈現老麥正式專案資料回傳的狀態；證據、風險與人工 gate 不會被展示數字取代。" : "目前沒有正式專案，頁面不會把展示內容冒充研究證據。完成 Intake、預覽並人工確認後，才會由老麥建立正式專案。"}</p>{currentProject ? <div className="project-id-line"><span>Project ID</span><code>{currentProject.projectId}</code><span className="source-tag real">正式來源</span></div> : <div className="project-id-line"><span>正式資料狀態</span><strong>尚未建立</strong><span className="source-tag demo">DEMO ONLY</span></div>}</div>
          <div className="hero-action">{currentProject ? <><div className="stage-badge"><span>{activeStageId}</span><strong>{stageTitle(currentProject.currentStage)}</strong><small>目前研究階段</small></div><button type="button" onClick={() => setChatOpen(true)}>開啟專案對話 <Icon name="arrow" size={17} /></button></> : <><div className="empty-ring"><strong>S0</strong><small>INTAKE</small></div><button type="button" onClick={openIntake}>開始 S0 Intake <Icon name="arrow" size={17} /></button></>}</div>
        </section>

        {currentProject && <ResearchWorkflow projectId={currentProject.projectId} />}
        {currentProject && <section className="gate-card"><div><p className="section-kicker">下一個人工門檻</p><h2>{currentProject.nextGate}</h2><p>{currentProject.recommendedAction}</p></div><button type="button" className="primary-button" onClick={() => setChatOpen(true)}>交給老麥檢查 <Icon name="arrow" size={16} /></button></section>}

        <section className="section-block"><div className="section-heading"><div><p className="section-kicker">專案系統</p><h2>研究專案</h2></div><p className="section-note">老麥正式專案資料是唯一真相來源；瀏覽器不保存正式專案。</p></div>{projects.length ? <div className="project-grid">{projects.map((project) => <button type="button" className={"project-card " + (currentProject?.projectId === project.projectId ? "selected" : "")} key={project.projectId} onClick={() => setCurrentProject(project)}><div><span className="source-tag real">正式來源</span><h3>{project.workingTitle}</h3><code>{project.projectId}</code></div><div className="project-card-meta"><span>{project.domain}</span><span>{project.outputTrack}</span><strong>{project.currentStage.slice(0, 2)} · {stageTitle(project.currentStage)}</strong></div></button>)}</div> : <div className="empty-list"><Icon name="folder" /><div><strong>{sourceState === "demo" ? "目前是展示模式，尚無正式專案" : "尚無可回傳的正式專案"}</strong><span>{sourceState === "demo" ? "完成部署環境設定後，建立流程會寫入正式專案目錄。" : "建立第一個專案後，重新整理仍會從正式來源取回。"}</span></div><button type="button" className="secondary-button" onClick={openIntake}>建立新專案</button></div>}</section>

        <section className="section-block"><div className="section-heading"><div><p className="section-kicker">研究生命週期</p><h2>研究生命週期與目前 Stage</h2></div><p className="section-note">Stage 不能由文字宣稱跳過；每次轉移都要有 project artifact 與 human gate。</p></div><div className="pipeline">{stages.map((stage, index) => { const number = Number(stage.id.slice(1)); const state = currentProject ? number < currentStage ? "done" : number === currentStage ? "active" : "locked" : index === 0 ? "active" : "locked"; return <div className={"stage " + state + (activeStageId === stage.id ? " selected" : "")} key={stage.id}><span className="stage-index">{state === "done" ? "✓" : stage.short}</span><span className="stage-copy"><small>{stage.id}</small><strong>{stage.title}</strong></span>{index < stages.length - 1 && <i />}</div>; })}</div></section>

        <section className="content-grid"><div className="panel"><div className="panel-head"><div><p className="section-kicker">證據／風險／人工門檻</p><h3>狀態不是展示分數</h3></div></div><div className="status-grid">{currentProject ? <><StatusCard label="Evidence" value={currentProject.evidenceStatus} tone="teal" /><StatusCard label="Risk" value={currentProject.riskStatus} tone="amber" /><StatusCard label="Human Gate" value={currentProject.humanGateStatus} tone="rust" /></> : <><StatusCard label="Evidence" value="UNVERIFIED" /><StatusCard label="Risk" value="UNVERIFIED" /><StatusCard label="Human Gate" value="REQUIRED" /></>}</div><p className="panel-note">{currentProject ? "狀態來自老麥回傳的 project artifact 摘要；未驗證不會被渲染成已完成。" : "展示介面沒有真實 evidence、risk 或 gate 數值。"}</p></div><div className="panel"><div className="panel-head"><div><p className="section-kicker">可追溯交接</p><h3>已知、未知與風險</h3></div></div><div className="handoff-list"><div><b>已知</b><span>{currentProject?.known[0] || "尚未建立正式專案"}</span></div><div><b>未知</b><span>{currentProject?.unknown[0] || "研究問題與證據尚未建立"}</span></div><div><b>風險</b><span>{currentProject?.risks[0] || "倫理、隱私與授權尚未審查"}</span></div></div><button type="button" className="text-button" onClick={() => setChatOpen(true)}>查看 project handoff <Icon name="arrow" size={16} /></button></div></section>

        <section className="section-block quick-section"><div className="section-heading"><div><p className="section-kicker">WORK WITH 老麥</p><h2>{currentProject ? "固定在這個 Project ID 上協作" : "先建立，再開始專案化協作"}</h2></div></div><div className="prompt-grid"><button type="button" onClick={openIntake}><span><Icon name="plus" /></span><strong>建立新研究專案</strong><small>完成 S0 Intake、預覽與人工確認</small><Icon name="arrow" size={17} /></button><button type="button" onClick={() => void sendMessage(undefined, "請讀取目前正式專案的 PROJECT.md、STATE.yaml、OPEN_QUESTIONS.md 與 HANDOFF.md，回傳目前 stage、已知、未知、風險與唯一建議行動。")}><span><Icon name="folder" /></span><strong>讀取專案狀態</strong><small>只從正式專案資料整理</small><Icon name="arrow" size={17} /></button><button type="button" onClick={() => void sendMessage(undefined, "請檢查目前正式專案是否具備進入下一個 stage gate 的條件；若不足，列出阻塞與需人工確認事項，不得跳過。")}><span><Icon name="shield" /></span><strong>檢查下一個 Gate</strong><small>保留 evidence、risk、human gate</small><Icon name="arrow" size={17} /></button></div></section>
      </main>

      <button type="button" className="assistant-fab" onClick={() => setChatOpen(true)} aria-label="開啟老麥專案對話"><span><Icon name="spark" size={22} /></span><div><strong>問老麥</strong><small>{currentProject ? currentProject.projectId : "尚無 Project ID"}</small></div></button>
      {chatOpen && <div className="chat-backdrop" onClick={() => setChatOpen(false)} />}
      <aside className={"chat-drawer " + (chatOpen ? "open" : "")} role="dialog" aria-modal="true" aria-label="老麥專案對話" aria-hidden={!chatOpen}><header><div className="assistant-avatar"><Icon name="spark" /></div><div><strong>老麥</strong><small><span /> {currentProject ? "Project " + currentProject.projectId : "未綁定正式專案"}</small></div><button type="button" className="icon-button" onClick={() => setChatOpen(false)} aria-label="關閉研究協作"><Icon name="close" /></button></header><div className="chat-context"><span>{currentProject ? "PROJECT-FIRST MEMORY · VERIFIED SOURCE" : "DEMO / UNVERIFIED WORKSPACE"}</span><b>{currentProject ? currentProject.domain + " · " + currentProject.currentStage.slice(0, 2) + " · " + currentProject.outputTrack : "建立專案後才會固定帶入 Project ID"}</b></div><div className="messages" role="log" aria-live="polite" aria-label="老麥專案訊息">{messages.map((message, index) => <div key={index} className={"message " + message.role}><span>{message.role === "assistant" ? "麥" : "你"}</span><p>{message.content}</p></div>)}{chatLoading && <div className="message assistant"><span>麥</span><p className="typing"><i /><i /><i /></p></div>}</div><form className="composer" onSubmit={(event) => void sendMessage(event)}><textarea ref={composerRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={currentProject ? "針對 " + currentProject.projectId + " 提問…" : "建立正式專案後開始提問…"} rows={3} maxLength={8000} aria-label="輸入專案問題" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} /><div><small>{input.length}/8000 · AI 產出仍需研究者確認</small><button type="submit" disabled={chatLoading || !input.trim()} aria-label="送出訊息"><Icon name="send" size={18} /></button></div></form></aside>

      {intakeOpen && <div className="modal-backdrop" onClick={() => !intakeLoading && setIntakeOpen(false)}><section className="intake-modal" role="dialog" aria-modal="true" aria-labelledby="intake-title" onClick={(event) => event.stopPropagation()}><header className="modal-head"><div><p className="section-kicker">S0 起步 · 專案優先</p><h2 id="intake-title">建立正式研究專案</h2><p>先整理研究需求與限制，再預覽；只有人工確認後才會呼叫 project-init。</p></div><button type="button" className="icon-button" onClick={() => setIntakeOpen(false)} aria-label="關閉建立專案視窗"><Icon name="close" /></button></header><div className="stepper" aria-label="S0 Intake 步驟">{stepTitles.map((title, index) => <div className={index <= step ? "active" : ""} key={title}><span>{index + 1}</span><strong>{title}</strong></div>)}</div>{!preview ? <form onSubmit={(event) => { event.preventDefault(); if (step < 3) { if (validateStep()) setStep((current) => current + 1); } else void createPreview(event); }}><div className="modal-body">{step === 0 && <div className="form-stack"><TextField field="workingTitle" label="暫定研究題目" value={intake.workingTitle} error={fieldErrors.workingTitle} onChange={(value) => updateField("workingTitle", value)} multiline={false} maxLength={160} /><fieldset className="choice-fieldset"><legend>六大專業領域 <span aria-hidden="true">*</span></legend><div className="choice-grid">{canonicalDomains.map((domain) => <label className={"choice-card " + (intake.domain === domain ? "selected" : "")} key={domain}><input type="radio" name="domain" value={domain} checked={intake.domain === domain} onChange={() => updateField("domain", domain)} /><span>{domain}</span></label>)}</div>{fieldErrors.domain && <p className="field-error" role="alert">{fieldErrors.domain}</p>}</fieldset><fieldset className="choice-fieldset"><legend>主成果路徑 <span aria-hidden="true">*</span></legend><div className="track-choice-grid">{outputTracks.map((track) => <label className={"choice-card " + (intake.outputTrack === track.id ? "selected" : "")} key={track.id}><input type="radio" name="outputTrack" value={track.id} checked={intake.outputTrack === track.id} onChange={() => updateField("outputTrack", track.id as OutputTrackId)} /><span><strong>{track.title}</strong><small>{track.subtitle}</small></span></label>)}</div>{fieldErrors.outputTrack && <p className="field-error" role="alert">{fieldErrors.outputTrack}</p>}</fieldset></div>}{step === 1 && <div className="form-stack"><TextField field="problemContext" label="問題背景" value={intake.problemContext} error={fieldErrors.problemContext} onChange={(value) => updateField("problemContext", value)} maxLength={4000} /><TextField field="targetUsers" label="目標使用者或研究對象" value={intake.targetUsers} error={fieldErrors.targetUsers} onChange={(value) => updateField("targetUsers", value)} maxLength={2000} /><TextField field="expectedContribution" label="預期研究貢獻" value={intake.expectedContribution} error={fieldErrors.expectedContribution} onChange={(value) => updateField("expectedContribution", value)} maxLength={4000} /><TextField field="methodIdea" label="方法或技術構想" value={intake.methodIdea} error={fieldErrors.methodIdea} onChange={(value) => updateField("methodIdea", value)} maxLength={4000} /></div>}{step === 2 && <div className="form-stack"><TextField field="existingData" label="已有資料" value={intake.existingData} error={fieldErrors.existingData} onChange={(value) => updateField("existingData", value)} maxLength={4000} /><TextField field="availableData" label="可取得資料" value={intake.availableData} error={fieldErrors.availableData} onChange={(value) => updateField("availableData", value)} maxLength={4000} /><TextField field="timeline" label="執行期限" value={intake.timeline} error={fieldErrors.timeline} onChange={(value) => updateField("timeline", value)} maxLength={500} /><TextField field="constraints" label="預算／設備／人力限制" value={intake.constraints} error={fieldErrors.constraints} onChange={(value) => updateField("constraints", value)} maxLength={2000} /></div>}{step === 3 && <div className="form-stack"><TextField field="ethicsPrivacyRisks" label="倫理、隱私與授權風險" value={intake.ethicsPrivacyRisks} error={fieldErrors.ethicsPrivacyRisks} onChange={(value) => updateField("ethicsPrivacyRisks", value)} maxLength={4000} /><TextField field="unresolvedItems" label="使用者尚未確定的事項" value={intake.unresolvedItems} error={fieldErrors.unresolvedItems} onChange={(value) => updateField("unresolvedItems", value)} maxLength={4000} /><div className="contract-note"><Icon name="shield" /><p><strong>安全資料契約</strong><span>所有欄位會在 server 端再次驗證。此階段只產生預覽，不會寫入 projects/active/。</span></p></div></div>}</div><footer className="modal-actions">{step > 0 && <button type="button" className="secondary-button" onClick={() => setStep((current) => current - 1)}>上一步</button>}<span className="action-spacer" />{step < 3 ? <button type="submit" className="primary-button">下一步 <Icon name="arrow" size={16} /></button> : <button type="submit" className="primary-button" disabled={intakeLoading}>{intakeLoading ? "產生預覽中…" : "產生預覽"} <Icon name="arrow" size={16} /></button>}</footer></form> : <div className="preview-view"><div className="preview-summary"><p className="section-kicker">PREVIEW ONLY · 尚未寫入</p><h3>{preview.workingTitle}</h3><div className="preview-meta"><span>{preview.domain}</span><span>{preview.outputTrack}</span><code>{preview.projectId}</code></div><p>預計正式路徑：<code>{preview.path}/</code></p></div><div className="review-grid">{[["已知", preview.known, "known"], ["未知", preview.unknown, "unknown"], ["假設", preview.assumptions, "assumption"], ["風險", preview.risks, "risk"]].map(([label, items, tone]) => <div className={"review-card " + tone} key={String(label)}><strong>{label}</strong><ul>{(items as string[]).map((item) => <li key={item}>{item}</li>)}</ul></div>)}</div><div className="human-confirm"><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> <span>我已閱讀上述預覽，確認資料仍需研究者核對，並同意在不覆蓋既有專案的前提下呼叫 <code>project-init</code> 建立正式專案。</span></label><p>確認文字：{CONFIRMATION_PHRASE}</p></div><footer className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setPreview(null); setConfirmed(false); }}>返回修改</button><span className="action-spacer" /><button type="button" className="primary-button" disabled={!confirmed || intakeLoading} onClick={() => void confirmCreate()}>{intakeLoading ? "建立並驗證中…" : "確認建立正式專案"} <Icon name="arrow" size={16} /></button></footer></div>}{intakeError && <p className="inline-error modal-error" role="alert">{intakeError}</p>}</section></div>}
    </div>
  );
}
