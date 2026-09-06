"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Icon from "./Icons";
import ModelModePicker from "./ModelModePicker";
import SubmissionNavigatorStudio, { type NavigatorInitialTopic } from "./SubmissionNavigatorStudio";
import TheoryMechanismLab from "./TheoryMechanismLab";
import GapNoveltyLab from "./GapNoveltyLab";
import ResearchDesignLab from "./ResearchDesignLab";
import RouteWorkspaceStudio from "./RouteWorkspaceStudio";
import InstrumentProtocolStudio from "./InstrumentProtocolStudio";
import PilotValidationCenter from "./PilotValidationCenter";
import FormalExecutionCenter from "./FormalExecutionCenter";
import DataGovernanceCenter from "./DataGovernanceCenter";
import AnalysisLabCenter from "./AnalysisLabCenter";
import ManuscriptStudio from "./ManuscriptStudio";
import ScientificReviewCenter from "./ScientificReviewCenter";
import LanguageCenter from "./LanguageCenter";
import ResearchBlueprintStudio from "./ResearchBlueprintStudio";
import EthicsCenter from "./EthicsCenter";
import SubmissionGate from "./SubmissionGate";
import AcademicLanguageStudio from "./AcademicLanguageStudio";
import StandaloneLanguageTool from "./StandaloneLanguageTool";
import JournalSubmissionStudio from "./JournalSubmissionStudio";
import ProposalStudio from "./ProposalStudio";
import ReviewStudio from "./ReviewStudio";
import ResearchWorkflow from "./ResearchWorkflow";
import TopicLabFrontierRadar from "./TopicLabFrontierRadar";
import OneClickInspiration from "./OneClickInspiration";
import TopicValidation from "./TopicValidation";
import ReviewComplianceWorkspace from "./ReviewComplianceWorkspace";
import ApplicationPackageStudio from "./ApplicationPackageStudio";
import ProjectTrashCenter from "./ProjectTrashCenter";
import OldMikeAssistControl, { OldMikeAssistWholeS0Control } from "./OldMikeAssistControl";
import Home2WorkbenchOverview from "./home2/Home2WorkbenchOverview";
import ResearchWorkflowLightPanel from "./ResearchWorkflowLightPanel";
import ResearchPathRoadmap from "./ResearchPathRoadmap";
import { PRIMARY_GOAL_IDS, type PrimaryGoalId } from "@/lib/research-goal-registry";
import { canonicalDomains, outputTrackIds, researchPathStations, stageDefinitions, stageNumberFromKey, type CanonicalDomain, type OutputTrackId } from "@/lib/research-config";
import { CONFIRMATION_PHRASE, normalizeS0Intake, type FieldErrors, type ProjectPreview, type ProjectSummary, type S0Intake } from "@/lib/project-contract";
import type { EvidenceCenterResponse } from "@/lib/assist-contract";
import type { S0FieldStatus } from "@/lib/s0-composer";
import { S0_FIELDS, S0_FIELD_LABELS, S0_FIELD_LIMITS, S0_FIELD_NAMES, S0_TEXT_FIELD_NAMES, type S0FieldName } from "@/lib/s0-fields";
import type { TopicLabAnalysis, TopicLabCandidate as DomainTopicLabCandidate } from "@/lib/topic-lab-contract";
import { RESEARCH_DIRECTION_MAX_LENGTH, type ResearchSourceStrategy } from "@/lib/research-start-contract";
import { RESEARCH_START_STAGE_BROWSER_TIMEOUT_MS, RESEARCH_START_TWO_STAGE_CONTRACT_VERSION, type ResearchDirectionCard, type ResearchDirectionSet, type ResearchStartAdvanced } from "@/lib/research-start-two-stage-contract";
import type { ModelModeProfile } from "@/lib/model-mode-contract";

type NavId = "overview" | "quick-start" | "topic-lab" | "radar" | "web-preview" | "evidence" | "academic-language" | "gap" | "theory" | "design" | "route-workspace" | "instruments-protocol" | "pilot-protocol-validation" | "execution" | "governance" | "analysis-lab" | "manuscript" | "scientific-review" | "language-center" | "analysis" | "outputs" | "proposals" | "journals" | "reviewer" | "integrity" | "memory" | "navigator" | "submission-gate" | "blueprint" | "standalone-language" | "one-click" | "topic-validation" | "ethics-center" | "review-compliance" | "application-package" | "trash";
type SourceState = "loading" | "demo" | "fixture" | "live" | "error";
type Message = { role: "user" | "assistant"; content: string };
type ActiveOverlay = "NONE" | "MOBILE_NAV" | "CHAT";
type WebPreviewResult = {
  source: {
    title: string;
    finalUrl: string;
    retrievedAt: string;
    contentHash: string;
    bytes: number;
    status: "UNVERIFIED";
    limitations: string[];
  };
  summary: string;
  feasibleSuggestions: string[];
  unknowns: string[];
};
type CompatibilityWarning = {
  projectId: string;
  code: "LEGACY_STATUS_NORMALIZED";
  fields: Array<{
    field: "evidence_status" | "risk_status" | "human_gate_status";
    original: string;
    canonical: string;
    reason: string;
  }>;
};
type IndexedProject = Partial<ProjectSummary> & { projectId: string; title?: string };
type QuickResearchStart = { researchDirection: string; domain: CanonicalDomain | ""; outputTrack: OutputTrackId | ""; setting: string; method: string; timeline: string; availableData: string; ethics: string; sourceStrategy: ResearchSourceStrategy; sourceUrls: string };
type ResearchStartUiState = "IDLE" | "STEP_1_COMPARING_DIRECTIONS" | "DIRECTIONS_READY" | "STEP_2_COMPLETING_SELECTED_S0" | "READY_FOR_HUMAN_REVIEW";
type ResearchStartRootContext = { rootIntentId: string; rootIntentHash: string; researchDirection: string; advanced: ResearchStartAdvanced };
type StageAResponse = { ok?: boolean; state?: "DIRECTIONS_READY"; rootIntentHash?: string; directionSet?: ResearchDirectionSet; providerSubmissionCount?: number; error?: string; stage?: string; completionClass?: string; recoverableFields?: string[] };
type StageBResponse = { ok?: boolean; state?: "READY_FOR_HUMAN_REVIEW"; selectedCardId?: string; s0Draft?: S0Intake; s0Hash?: string; providerSubmissionCount?: number; error?: string; stage?: string; completionClass?: string; recoverableFields?: string[] };

const navGroups: Array<{ label: string; items: Array<{ id: NavId; icon: string; label: string; public: boolean }> }> = [
  { label: "開始", items: [{ id: "overview", icon: "grid", label: "研究總覽", public: true }, { id: "quick-start", icon: "plus", label: "智慧建立專案", public: true }, { id: "trash", icon: "folder", label: "回收筒", public: true }] },
  { label: "選題與導航", items: [{ id: "topic-lab", icon: "spark", label: "選題實驗室", public: true }, { id: "one-click", icon: "spark", label: "一鍵靈感", public: true }, { id: "topic-validation", icon: "check", label: "題目驗證", public: true }, { id: "radar", icon: "search", label: "前沿雷達", public: true }, { id: "web-preview", icon: "book", label: "網站閱讀", public: true }, { id: "navigator", icon: "compass", label: "投稿與計畫導航", public: false }] },
  { label: "研究與寫作", items: [{ id: "blueprint", icon: "route", label: "研究藍圖", public: false }, { id: "evidence", icon: "book", label: "文獻與證據中心", public: false }, { id: "language-center", icon: "file", label: "翻譯與學術潤稿（15）", public: false }, { id: "gap", icon: "search", label: "Gap 與新穎性", public: false }, { id: "theory", icon: "flask", label: "理論與機制", public: false }, { id: "design", icon: "flask", label: "研究設計", public: false }, { id: "route-workspace", icon: "route", label: "研究路線工作室", public: false }, { id: "proposals", icon: "file", label: "臺灣計畫書工作室", public: false }] },
  { label: "正式研究與執行", items: [{ id: "instruments-protocol", icon: "flask", label: "工具與量表 Protocol", public: false }, { id: "pilot-protocol-validation", icon: "shield", label: "前導驗證（Pilot）", public: false }, { id: "execution", icon: "chart", label: "正式研究與執行", public: false }, { id: "governance", icon: "shield", label: "資料治理與 Analysis Dataset", public: false }, { id: "analysis-lab", icon: "chart", label: "分析實驗室（12）", public: false }, { id: "manuscript", icon: "file", label: "全文寫作工作室（13）", public: false }, { id: "scientific-review", icon: "shield", label: "老麥科學審查（14）", public: false }] },
  { label: "審查與送件", items: [{ id: "ethics-center", icon: "shield", label: "研究倫理／IRB 中心", public: false }, { id: "review-compliance", icon: "check", label: "NSTC／MOE 審查與合規", public: false }, { id: "application-package", icon: "file", label: "計畫申請包", public: false }, { id: "reviewer", icon: "book", label: "審稿工作室", public: false }, { id: "journals", icon: "file", label: "期刊選擇與投稿", public: false }, { id: "submission-gate", icon: "check", label: "正式送件", public: false }] },
  { label: "獨立工具", items: [{ id: "standalone-language", icon: "file", label: "獨立翻譯與學術潤稿", public: true }] },
];

const initialIntake: S0Intake = {
  workingTitle: "", domain: canonicalDomains[0], outputTrack: "NSTC", problemContext: "", targetUsers: "", expectedContribution: "", existingData: "目前沒有已確認資料", availableData: "", methodIdea: "", timeline: "", constraints: "", ethicsPrivacyRisks: "尚未完成正式倫理、隱私與授權審查", unresolvedItems: "",
};
const fieldLabels: Record<keyof S0Intake, string> = S0_FIELD_LABELS;
const textFields: Array<keyof S0Intake> = [...S0_TEXT_FIELD_NAMES];
const fieldLimits: Record<keyof S0Intake, number> = S0_FIELD_LIMITS;
const initialS0FieldStatus = Object.freeze(Object.fromEntries(S0_FIELDS.map((field) => [
  field.name,
  field.name === "domain" || field.name === "outputTrack" ? "USER_PROVIDED" : initialIntake[field.name] ? "UNVERIFIED" : "RESEARCHER_INPUT_REQUIRED",
])) as Record<S0FieldName, S0FieldStatus>);

function statusText(value: string) { return value === "VERIFIED" ? "已驗證" : value === "SUPPORTED" ? "有支持" : value === "BLOCKED" ? "受阻" : value === "REQUIRED" ? "需要人工確認" : value === "AI_PROPOSED" ? "老麥建議・尚未驗證" : value === "AI_CONCEPT" ? "老麥概念模式" : value === "FRESH_VERIFIED" ? "即時查證模式" : "尚未驗證"; }
function stageTitle(key?: string) { return stageDefinitions.find((stage) => stage.key === key)?.title || "研究定位"; }
function ErrorMessage({ message }: { message: string }) { return message ? <div className="v13-error" role="alert">{message}</div> : null; }
function SourceBadge({ value }: { value: string }) { return <span className={`v13-badge ${value.toLowerCase()}`}>{statusText(value)}</span>; }

function Panel({ kicker, title, children, note }: { kicker?: string; title: string; children: React.ReactNode; note?: string }) {
  return <section className="v13-panel"><div className="v13-panel-head"><div>{kicker && <p className="section-kicker">{kicker}</p>}<h2>{title}</h2></div>{note && <p className="v13-panel-note">{note}</p>}</div>{children}</section>;
}

function LockedModule({ title }: { title: string }) { return <Panel kicker="專案門檻" title={title}><div className="v13-locked"><Icon name="shield" size={28} /><div><strong>需要先建立正式 Project ID</strong><p>此模組只讀取老麥的正式專案資料；目前不會用展示資料或假完成度代替研究狀態。</p></div></div></Panel>; }

function ChoiceGroup({ label, value, options, onChange, testId }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; testId: string }) {
  return <fieldset className="v13-fieldset" data-testid={testId}><legend>{label}<span aria-hidden="true"> *</span></legend><div className="v13-choice-grid">{options.map((option) => <label key={option} className={`v13-choice ${value === option ? "selected" : ""}`}><input type="radio" name={testId} value={option} checked={value === option} onChange={() => onChange(option)} required aria-required="true" /><span>{statusText(option) === "尚未驗證" ? option : statusText(option)}</span></label>)}</div></fieldset>;
}

function FieldEditor({ field, value, error, ai, assist, inputRef, onChange, onClear }: { field: keyof S0Intake; value: string; error?: string; ai?: boolean; assist: React.ReactNode; inputRef?: React.Ref<HTMLTextAreaElement>; onChange: (value: string) => void; onClear: () => void }) {
  const id = `s0-${field}`; const errorId = `${id}-error`; const helpId = `${id}-help`;
  return <div className={`v13-field ${error ? "invalid" : ""}`}><div className="v13-field-label"><label htmlFor={id}>{fieldLabels[field]}<span aria-hidden="true"> *</span></label>{ai && <SourceBadge value="AI_PROPOSED" />}</div><textarea ref={inputRef} id={id} value={value} onChange={(event) => onChange(event.target.value)} maxLength={fieldLimits[field]} required aria-required="true" aria-invalid={Boolean(error)} aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`} rows={field === "workingTitle" || field === "timeline" ? 2 : 3} /><div className="v13-field-foot"><small id={helpId}>{value.length}/{fieldLimits[field]} 字元；內容需由研究者確認</small><div className="v13-field-actions"><button type="button" onClick={onClear}>清除／復原</button></div></div>{assist}{error && <p id={errorId} className="v13-field-error">{error}</p>}</div>;
}

function CompatibilityWarningPanel({ warnings }: { warnings: CompatibilityWarning[] }) {
  if (warnings.length === 0) return null;
  return <section className="v13-compatibility-warning" role="status" aria-live="polite" aria-labelledby="v13-compatibility-warning-title">
    <div className="v13-compatibility-warning-icon" aria-hidden="true">!</div>
    <div>
      <p className="section-kicker">舊版相容 · 已驗證來源</p>
      <h2 id="v13-compatibility-warning-title">舊版專案狀態已保守轉換，尚未修改原始專案</h2>
      <p>老麥只在讀取時轉換已知舊版狀態；原始專案資料沒有被寫回。</p>
      <ul>
        {warnings.flatMap((warning) => warning.fields.map((field) => <li key={`${warning.projectId}-${field.field}`}><span>{field.field}</span>：<code>{field.original}</code> → <strong>{field.canonical}</strong></li>))}
      </ul>
    </div>
  </section>;
}

export default function GuidedResearchCenter({ displayName, fixtureMode = false, fixtureProject = true }: { displayName: string; fixtureMode?: boolean; fixtureProject?: boolean }) {
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>("NONE"); const [activeNav, setActiveNav] = useState<NavId>("overview");
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [projects, setProjects] = useState<IndexedProject[]>([]); const [currentProject, setCurrentProject] = useState<IndexedProject | null>(null); const [sourceState, setSourceState] = useState<SourceState>("loading"); const [pageError, setPageError] = useState(""); const [compatibilityWarnings, setCompatibilityWarnings] = useState<CompatibilityWarning[]>([]); const [workflowGoalView, setWorkflowGoalView] = useState<PrimaryGoalId>("JOURNAL_SCI_SSCI");
  const [quick, setQuick] = useState<QuickResearchStart>({ researchDirection: "", domain: "", outputTrack: "", setting: "", method: "", timeline: "", availableData: "", ethics: "", sourceStrategy: "NONE", sourceUrls: "" }); const [topicLoading, setTopicLoading] = useState(false);
  const [quickAnalysis, setQuickAnalysis] = useState<TopicLabAnalysis | null>(null); const [quickSourceCapability, setQuickSourceCapability] = useState(""); const [selectedResearchCandidate, setSelectedResearchCandidate] = useState<DomainTopicLabCandidate | null>(null);
  const [researchStartState, setResearchStartState] = useState<ResearchStartUiState>("IDLE"); const [directionSet, setDirectionSet] = useState<ResearchDirectionSet | null>(null); const [selectedDirectionCard, setSelectedDirectionCard] = useState<ResearchDirectionCard | null>(null); const [researchStartRoot, setResearchStartRoot] = useState<ResearchStartRootContext | null>(null); const [expandedS0, setExpandedS0] = useState<Record<string, S0Intake>>({});
  const [evidence, setEvidence] = useState<EvidenceCenterResponse | null>(null); const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [resetArmed, setResetArmed] = useState(false); const [resetBusy, setResetBusy] = useState(false); const [resetError, setResetError] = useState(""); const [resetResult, setResetResult] = useState("");
  const [webUrl, setWebUrl] = useState(""); const [webPurpose, setWebPurpose] = useState(""); const [webPreview, setWebPreview] = useState<WebPreviewResult | null>(null); const [webLoading, setWebLoading] = useState(false); const [webError, setWebError] = useState("");
  const [intake, setIntake] = useState<S0Intake>(initialIntake); const [fieldStatus, setFieldStatus] = useState<Record<S0FieldName, S0FieldStatus>>({ ...initialS0FieldStatus }); const [previousIntake, setPreviousIntake] = useState<S0Intake | null>(null); const [previousFieldStatus, setPreviousFieldStatus] = useState<Record<S0FieldName, S0FieldStatus> | null>(null); const [compareDraft, setCompareDraft] = useState(false); const [s0DraftSummary, setS0DraftSummary] = useState(""); const [intakeErrors, setIntakeErrors] = useState<FieldErrors>({}); const [intakeError, setIntakeError] = useState(""); const [preview, setPreview] = useState<ProjectPreview | null>(null); const [previewLoading, setPreviewLoading] = useState(false); const [confirmed, setConfirmed] = useState(false); const [createLoading, setCreateLoading] = useState(false);
  const [chatInput, setChatInput] = useState(""); const [messages, setMessages] = useState<Message[]>([]); const [chatLoading, setChatLoading] = useState(false); const [focusedField, setFocusedField] = useState<keyof S0Intake | "">(""); const firstErrorRef = useRef<HTMLTextAreaElement | null>(null); const composerRef = useRef<HTMLTextAreaElement>(null); const researchStartSubmittingRef = useRef(false); const researchStartAbortRef = useRef<AbortController | null>(null); const researchStartStatusRef = useRef<HTMLDivElement | null>(null);
  const [designSummary, setDesignSummary] = useState<{ exists: boolean; locked: boolean; status: string | null; gatePassed: number; gateTotal: number } | null>(null);
  const [phase7Summary, setPhase7Summary] = useState<{ primaryRoute: string; ethics: { status: string | null; locked: boolean; judgment: string | null; teacherPower: string | null } | null; compliance: Record<string, { locked: boolean; fatalMissing: number; completedRuns: number }>; packageReady: Record<string, boolean> } | null>(null);
  const [instrumentsSummary, setInstrumentsSummary] = useState<{ locked: boolean; missing: string[]; protocolStatus: string | null; protocolVersion: number; readiness: string | null; instrumentCount: number; selectedCount: number; readyForProtocolCount: number } | null>(null);
  const [navigatorRunId, setNavigatorRunId] = useState<string | null>(null);
  const [autoCreateError, setAutoCreateError] = useState("");
  const [gapSummary, setGapSummary] = useState<{ exists: boolean; status: string | null; gatePassed: number; gateTotal: number; noveltyConfidence: string; duplicationRisk: string; outdatedReason: string | null; searchCount: number; fulltextCount: number; literatureCount: number } | null>(null);
  const [theorySummary, setTheorySummary] = useState<{ exists: boolean; locked: boolean; status: string | null; gatePassed: number; gateTotal: number } | null>(null);
  const [pilotSummary, setPilotSummary] = useState<{ locked: boolean; status: string | null; authz: string | null; readiness: string | null; decision: string | null; openIssues: number } | null>(null);
  const [executionSummary, setExecutionSummary] = useState<{ locked: boolean; gates: Record<string, boolean>; status: string | null; snapshot: string | null } | null>(null);
  const [governanceSummary, setGovernanceSummary] = useState<{ locked: boolean; status: string | null; datasetStatus: string | null; lockStatus: string | null } | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<{ locked: boolean; authorizationStatus: string | null; resultsFreezeStatus: string | null; writingReadiness: string | null; runs: number; facts: number } | null>(null);
  const [manuscriptSummary, setManuscriptSummary] = useState<{ locked: boolean; count: number; stage: string | null } | null>(null);
  const [validationTopic, setValidationTopic] = useState<{ titleZh: string; researchQuestion: string } | null>(null);
  const [navigatorTopic, setNavigatorTopic] = useState<NavigatorInitialTopic | null>(null);
  const [fromNavigatorFlow, setFromNavigatorFlow] = useState(false);
  const [pendingNavigatorAfterCreate, setPendingNavigatorAfterCreate] = useState(false);
  const [evidenceFilterRole, setEvidenceFilterRole] = useState<string | null>(null);
  const [blueprintStatus, setBlueprintStatus] = useState<{ status: string; version: number; label: string } | null>(null);
  const [modeProfile, setModeProfile] = useState<ModelModeProfile>("AUTO");
  const sidebarRef = useRef<HTMLElement | null>(null); const chatRef = useRef<HTMLDivElement | null>(null); const navCloseRef = useRef<HTMLButtonElement | null>(null); const chatCloseRef = useRef<HTMLButtonElement | null>(null); const returnFocusRef = useRef<HTMLElement | null>(null);
  const chatConversationId = useRef(`portal-chat-${Date.now()}`);

  async function loadProjects() { setSourceState("loading"); setPageError(""); setCompatibilityWarnings([]); if (fixtureMode) { const fixture: IndexedProject = { projectId: "fixture-project-0001", title: "C2 版面測試專案", currentStage: "S0_INTAKE", humanGateStatus: "REQUIRED" }; setProjects(fixtureProject ? [fixture] : []); setCurrentProject(fixtureProject ? fixture : null); setSourceState("fixture"); return; } try { const response = await fetch("/api/projects", { cache: "no-store" }); const data = await response.json() as { ok?: boolean; demo?: boolean; projects?: IndexedProject[]; compatibilityWarnings?: CompatibilityWarning[]; error?: string }; if (response.status === 401) { location.href = "/login"; return; } if (!response.ok || !data.ok) throw new Error(data.error || "無法取得專案"); const next = Array.isArray(data.projects) ? data.projects.filter((item) => item && typeof item.projectId === "string") : []; setProjects(next); setSourceState(data.demo ? "demo" : "live"); setCompatibilityWarnings(data.demo ? [] : Array.isArray(data.compatibilityWarnings) ? data.compatibilityWarnings : []); setCurrentProject((current) => current && next.find((item) => item.projectId === current.projectId) || next[0] || null); } catch (error) { setSourceState("error"); setPageError(error instanceof Error ? error.message : "無法取得專案"); } }
  useEffect(() => { void loadProjects(); }, [fixtureMode, fixtureProject]);
  useEffect(() => { chatConversationId.current = `portal-chat-${currentProject?.projectId || "none"}-${Date.now()}`; setMessages([{ role: "assistant", content: currentProject ? `已載入正式專案 ${currentProject.projectId}。此對話只使用 Portal 授權的 PostgreSQL 專案脈絡。` : "目前尚無正式 Project ID；先完成選題與人工確認，才能進入專案化對話。" }]); }, [currentProject?.projectId]);
  useEffect(() => {
    if (!currentProject) { setBlueprintStatus(null); return; }
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(currentProject.projectId)}/blueprint`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ ok?: boolean; blueprint?: { status: string; currentVersion: number; versionLabel: string } }>)
      .then((json) => { if (active && json.ok && json.blueprint) setBlueprintStatus({ status: json.blueprint.status, version: json.blueprint.currentVersion, label: json.blueprint.versionLabel }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [currentProject]);
  useEffect(() => {
    if (!currentProject) { setGapSummary(null); setTheorySummary(null); return; }
    let active = true;
    const projectId = currentProject.projectId;
    async function loadGapSummary() {
      try {
        const [gapRes, litRes] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(projectId)}/gap-novelty`, { cache: "no-store" }),
          fetch(`/api/projects/${encodeURIComponent(projectId)}/literature`, { cache: "no-store" }),
        ]);
        const gapJson = await gapRes.json() as { ok?: boolean; exists?: boolean; analysis?: { status: string; gateState: Record<string, unknown>; noveltyConfidence: string; duplicationRisk: string }; tasks?: { searchStatus: string }[]; outdatedReason?: string | null };
        const litJson = await litRes.json() as { ok?: boolean; items?: { readingStatus: string }[] };
        if (!active) return;
        const literatureItems = Array.isArray(litJson.items) ? litJson.items : [];
        const fulltextCount = literatureItems.filter((item) => item.readingStatus === "FULLTEXT_REVIEWED").length;
        if (gapRes.ok && gapJson.ok !== false && gapJson.exists && gapJson.analysis) {
          const results = Array.isArray(gapJson.analysis.gateState?.results) ? gapJson.analysis.gateState.results as { pass?: boolean }[] : [];
          setGapSummary({ exists: true, status: gapJson.analysis.status ?? "DRAFT", gatePassed: results.filter((r) => r.pass === true).length, gateTotal: results.length, noveltyConfidence: gapJson.analysis.noveltyConfidence ?? "UNVERIFIED", duplicationRisk: gapJson.analysis.duplicationRisk ?? "UNVERIFIED", outdatedReason: gapJson.outdatedReason ?? null, searchCount: (gapJson.tasks ?? []).filter((task) => task.searchStatus === "COMPLETED").length, fulltextCount, literatureCount: literatureItems.length });
        } else {
          setGapSummary({ exists: false, status: null, gatePassed: 0, gateTotal: 0, noveltyConfidence: "UNVERIFIED", duplicationRisk: "UNVERIFIED", outdatedReason: null, searchCount: 0, fulltextCount, literatureCount: literatureItems.length });
        }
      } catch { if (active) setGapSummary(null); }
    }
    void loadGapSummary();
    async function loadTheorySummary() {
      try {
        const theoryRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/theory-mechanism`, { cache: "no-store" });
        const theoryJson = await theoryRes.json() as { ok?: boolean; exists?: boolean; locked?: boolean; analysis?: { status: string }; gatePreview?: { passed: number; total: number } };
        if (!active) return;
        if (theoryRes.ok && theoryJson.ok !== false && theoryJson.exists) setTheorySummary({ exists: true, locked: Boolean(theoryJson.locked), status: theoryJson.analysis?.status ?? "DRAFT", gatePassed: theoryJson.gatePreview?.passed ?? 0, gateTotal: theoryJson.gatePreview?.total ?? 0 });
        else setTheorySummary(null);
      } catch { if (active) setTheorySummary(null); }
    }
    void loadTheorySummary();
    return () => { active = false; };
  }, [currentProject]);
  useEffect(() => { const media = window.matchMedia("(max-width: 820px)"); const update = () => setIsMobileLayout(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  useEffect(() => {
    if (!focusedField || activeNav !== "quick-start") return;
    const frame = window.requestAnimationFrame(() => firstErrorRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [activeNav, focusedField]);
  useEffect(() => {
    if (researchStartState === "IDLE") return;
    const frame = window.requestAnimationFrame(() => researchStartStatusRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [researchStartState]);
  useEffect(() => {
    if (activeOverlay === "NONE") return;
    const root = activeOverlay === "MOBILE_NAV" ? sidebarRef.current : chatRef.current;
    const initial = activeOverlay === "MOBILE_NAV" ? navCloseRef.current : chatCloseRef.current;
    if (!root || !initial) return;
    const inertTargets = [document.querySelector<HTMLElement>(".account-toolbar"), activeOverlay === "CHAT" ? sidebarRef.current : null].filter((item): item is HTMLElement => Boolean(item));
    const previousInert = inertTargets.map((element) => ({ element, inert: element.inert }));
    inertTargets.forEach((element) => { element.inert = true; });
    document.documentElement.classList.add("overlay-open");
    const frame = window.requestAnimationFrame(() => initial.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeOverlay(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((element) => !element.inert && element.offsetParent !== null);
      if (!focusable.length) { event.preventDefault(); initial.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener("keydown", onKeyDown); document.documentElement.classList.remove("overlay-open"); previousInert.forEach(({ element, inert }) => { element.inert = inert; }); };
  }, [activeOverlay]);

  function openOverlay(next: Exclude<ActiveOverlay, "NONE">, trigger: HTMLElement) { returnFocusRef.current = trigger; setActiveOverlay(next); }
  function closeOverlay() { const trigger = returnFocusRef.current; returnFocusRef.current = null; setActiveOverlay("NONE"); window.setTimeout(() => trigger?.focus(), 0); }
  function go(nav: NavId) {
    // 已有專案時，進選題實驗室自動帶入專案題目（避免研究方向空白）
    if (nav === "topic-lab" && currentProject) {
      setQuick((current) => ({
        ...current,
        researchDirection: current.researchDirection || currentProject.title || "",
      }));
    }
    setActiveNav(nav); if (activeOverlay !== "NONE") closeOverlay();
  }
  function updateQuick<K extends keyof QuickResearchStart>(key: K, value: QuickResearchStart[K]) { setQuick((current) => ({ ...current, [key]: value })); }
  function quickAdvanced(): ResearchStartAdvanced { return { domain: quick.domain || null, outputTrack: quick.outputTrack || null, population: quick.setting, context: quick.setting, method: quick.method, data: quick.availableData, timeline: quick.timeline, ethics: quick.ethics }; }
  async function postResearchStartStage<T>(body: Record<string, unknown>) {
    const controller = new AbortController(); researchStartAbortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort("RESEARCH_START_STAGE_DEADLINE"), RESEARCH_START_STAGE_BROWSER_TIMEOUT_MS);
    try {
      const response = await fetch("/api/assist/topic-lab", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
      const data = await response.json() as T & { ok?: boolean; error?: string; stage?: string; completionClass?: string; recoverableFields?: string[] };
      if (!response.ok || !data.ok) throw new Error(data.error || `老麥研究啟動未完成${data.stage ? `（${data.stage}）` : ""}${data.completionClass ? `；${data.completionClass}` : ""}${data.recoverableFields?.length ? `；請檢查 ${data.recoverableFields.join("、")}` : ""}。`);
      return data;
    } finally {
      window.clearTimeout(timer);
      if (researchStartAbortRef.current === controller) researchStartAbortRef.current = null;
    }
  }
  function applyResearchStartDraft(card: ResearchDirectionCard, value: S0Intake) {
    const userProvided = new Set<S0FieldName>(["problemContext"]);
    if (quick.domain) userProvided.add("domain"); if (quick.outputTrack) userProvided.add("outputTrack"); if (quick.setting) userProvided.add("targetUsers"); if (quick.method) userProvided.add("methodIdea"); if (quick.timeline) userProvided.add("timeline"); if (quick.availableData) userProvided.add("availableData"); if (quick.ethics) userProvided.add("ethicsPrivacyRisks");
    const nextStatus = Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, userProvided.has(field) ? "USER_PROVIDED" : "AI_PROPOSED"])) as Record<S0FieldName, S0FieldStatus>;
    setPreviousIntake(intake); setPreviousFieldStatus(fieldStatus); setCompareDraft(false); setIntake(value); setFieldStatus(nextStatus); setSelectedResearchCandidate(null); setSelectedDirectionCard(card); setS0DraftSummary("推薦方向已完成 13 欄 S0；所有老麥建議仍需人工確認後才能建立正式專案。"); setPreview(null); setConfirmed(false); setIntakeErrors({}); setIntakeError("");
  }
  async function completeDirectionCard(card: ResearchDirectionCard, root: ResearchStartRootContext, idempotencyKey: string) {
    setResearchStartState("STEP_2_COMPLETING_SELECTED_S0");
    const data = await postResearchStartStage<StageBResponse>({
      contractVersion: RESEARCH_START_TWO_STAGE_CONTRACT_VERSION,
      operation: "EXPAND_SELECTED_S0",
      rootIntentId: root.rootIntentId,
      rootIntentHash: root.rootIntentHash,
      idempotencyKey,
      researchDirection: root.researchDirection,
      advanced: root.advanced,
      sourceStrategy: "NONE",
      selectedCard: card,
    });
    if (data.state !== "READY_FOR_HUMAN_REVIEW" || data.selectedCardId !== card.cardId || !data.s0Draft || data.providerSubmissionCount !== 1) throw new Error("老麥 S0 回覆未通過固定資料契約；三個方向與原始輸入已保留。");
    setExpandedS0((current) => ({ ...current, [card.cardId]: data.s0Draft as S0Intake }));
    applyResearchStartDraft(card, data.s0Draft);
    setResearchStartState("READY_FOR_HUMAN_REVIEW");
  }
  async function runTopicLab(event?: FormEvent) {
    event?.preventDefault();
    if (researchStartSubmittingRef.current) return;
    if (!quick.researchDirection.trim()) { setPageError("請先輸入一句研究方向。"); return; }
    researchStartSubmittingRef.current = true; setTopicLoading(true); setPageError(""); setQuickAnalysis(null); setSelectedResearchCandidate(null); setDirectionSet(null); setSelectedDirectionCard(null); setExpandedS0({}); setResearchStartRoot(null); setResearchStartState("STEP_1_COMPARING_DIRECTIONS");
    const rootIntentId = `research-root:${crypto.randomUUID()}`;
    const advanced = quickAdvanced();
    try {
      const stageA = await postResearchStartStage<StageAResponse>({ contractVersion: RESEARCH_START_TWO_STAGE_CONTRACT_VERSION, operation: "GENERATE_DIRECTIONS", rootIntentId, idempotencyKey: `${rootIntentId}:stage-a:${crypto.randomUUID()}`, researchDirection: quick.researchDirection, advanced, sourceStrategy: "NONE" });
      if (stageA.state !== "DIRECTIONS_READY" || !stageA.rootIntentHash || !stageA.directionSet || stageA.directionSet.cards.length !== 3 || stageA.providerSubmissionCount !== 1) throw new Error("老麥方向卡未通過固定資料契約；目前輸入已保留。");
      const recommended = stageA.directionSet.cards.find((card) => card.cardId === stageA.directionSet?.recommendedCardId);
      if (!recommended) throw new Error("老麥推薦方向未通過固定綁定；目前輸入已保留。");
      const root = { rootIntentId, rootIntentHash: stageA.rootIntentHash, researchDirection: quick.researchDirection, advanced };
      setDirectionSet(stageA.directionSet); setSelectedDirectionCard(recommended); setResearchStartRoot(root); setResearchStartState("DIRECTIONS_READY");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      try { await completeDirectionCard(recommended, root, `${rootIntentId}:stage-b:${crypto.randomUUID()}`); }
      catch (error) { setResearchStartState("DIRECTIONS_READY"); setPageError(error instanceof Error ? error.message : "老麥 S0 未完成；三個方向與目前輸入已保留。"); }
    } catch (error) { setResearchStartState("IDLE"); setPageError(error instanceof Error ? error.message : "老麥研究方向未完成；目前輸入已保留。"); }
    finally { researchStartSubmittingRef.current = false; setTopicLoading(false); }
  }
  async function expandSelectedDirection() {
    if (!selectedDirectionCard || !researchStartRoot || researchStartSubmittingRef.current) return;
    researchStartSubmittingRef.current = true; setTopicLoading(true); setPageError("");
    try { await completeDirectionCard(selectedDirectionCard, researchStartRoot, `${researchStartRoot.rootIntentId}:stage-b:${crypto.randomUUID()}`); }
    catch (error) { setResearchStartState("DIRECTIONS_READY"); setPageError(error instanceof Error ? error.message : "老麥 S0 未完成；三個方向與目前輸入已保留。"); }
    finally { researchStartSubmittingRef.current = false; setTopicLoading(false); }
  }
  function cancelResearchStart() { researchStartAbortRef.current?.abort("USER_CANCEL"); }
  async function runEvidence() { setEvidenceLoading(true); setPageError(""); try { const response = await fetch("/api/assist/evidence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: quick.domain || canonicalDomains[0], direction: quick.researchDirection, months: 36, keywords: quick.researchDirection.split(/[，,\s]+/).filter(Boolean).slice(0, 12) }) }); const data = await response.json() as { ok?: boolean; data?: EvidenceCenterResponse; mode?: string; error?: string }; if (!response.ok) { setEvidence({ status: "blocked", mode: "BLOCKED", searchStrategy: "尚未連接真實來源檢索", sources: [], ledger: [], message: data.error || "尚未連接真實來源檢索" }); go("evidence"); return; } if (!data.ok || !data.data) throw new Error(data.error || "尚未取得可驗證來源"); setEvidence(data.data); go("evidence"); } catch (error) { setPageError(error instanceof Error ? error.message : "證據查證失敗；未顯示假來源"); } finally { setEvidenceLoading(false); } }

  async function runWebPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWebError("");
    setWebPreview(null);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webUrl.trim());
    } catch {
      setWebError("請輸入完整的 HTTPS 網址。");
      return;
    }
    if (parsedUrl.protocol !== "https:") {
      setWebError("網站閱讀只接受 HTTPS 網址。");
      return;
    }
    if (!webPurpose.trim()) {
      setWebError("請說明研究目的或想改善的內容。");
      return;
    }

    setWebLoading(true);
    try {
      const response = await fetch("/api/assist/web-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parsedUrl.toString(), purpose: webPurpose.trim() }),
      });
      const data = await response.json() as { ok?: boolean; data?: WebPreviewResult; error?: string };
      if (!response.ok || !data.ok || !data.data) throw new Error(data.error || "老麥目前無法安全讀取這個網站。");
      setWebPreview(data.data);
    } catch (error) {
      setWebError(error instanceof Error ? error.message : "老麥目前無法安全讀取這個網站。");
    } finally {
      setWebLoading(false);
    }
  }

  function openProfessional() { setActiveNav("quick-start"); setPreviousIntake(null); setPreviousFieldStatus(null); setCompareDraft(false); setS0DraftSummary(""); setPreview(null); setConfirmed(false); setIntakeErrors({}); setIntakeError(""); }
  async function resetCurrentProject() {
    if (!currentProject || resetBusy) return;
    setResetBusy(true); setResetError(""); setResetResult("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(currentProject.projectId)}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "RESET_PROJECT" }) });
      const data = await response.json() as { ok?: boolean; deleted?: { projects: number; artifacts: number; children: number }; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "專案重置失敗。");
      setProjects((current) => current.filter((item) => item.projectId !== currentProject.projectId));
      setCurrentProject((current) => current ? null : current);
      setResetArmed(false);
      setResetResult(`專案已重置：${currentProject.projectId}（已刪除專案 ${data.deleted?.projects ?? 0}、artifacts ${data.deleted?.artifacts ?? 0}、關聯資料 ${data.deleted?.children ?? 0} 筆）。`);
    } catch (error) { setResetError(error instanceof Error ? error.message : "專案重置失敗。"); }
    finally { setResetBusy(false); }
  }
  function adoptTopicLabDraft(candidate: DomainTopicLabCandidate) {
    const next = { ...candidate.s0Draft };
    const userProvided = new Set<S0FieldName>(["problemContext"]);
    if (quick.domain) userProvided.add("domain");
    if (quick.outputTrack) userProvided.add("outputTrack");
    if (quick.setting) userProvided.add("targetUsers");
    if (quick.method) userProvided.add("methodIdea");
    if (quick.timeline) userProvided.add("timeline");
    if (quick.availableData) userProvided.add("availableData");
    if (quick.ethics) userProvided.add("ethicsPrivacyRisks");
    const nextStatus = Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, userProvided.has(field) ? "USER_PROVIDED" : "AI_PROPOSED"])) as Record<S0FieldName, S0FieldStatus>;
    setPreviousIntake(intake); setPreviousFieldStatus(fieldStatus); setCompareDraft(false); setIntake(next); setFieldStatus(nextStatus); setSelectedResearchCandidate(candidate); setS0DraftSummary("完整 13 欄已帶入；所有老麥建議仍需人工確認後才能建立正式專案。"); setPreview(null); setConfirmed(false); setIntakeErrors({}); setIntakeError(""); setActiveNav("quick-start");
  }
  function updateField(field: keyof S0Intake, value: string) { setIntake((current) => ({ ...current, [field]: value })); setFieldStatus((current) => ({ ...current, [field]: value.trim() ? "USER_PROVIDED" : "RESEARCHER_INPUT_REQUIRED" })); setIntakeErrors((current) => ({ ...current, [field]: undefined })); setPreview(null); setConfirmed(false); setS0DraftSummary(""); }
  function applyFieldSuggestion(field: keyof S0Intake, value: string, provenance: "AI_PROPOSED" | "USER_PROVIDED") { setPreviousIntake(intake); setPreviousFieldStatus(fieldStatus); setIntake((current) => ({ ...current, [field]: value })); setFieldStatus((current) => ({ ...current, [field]: value.trim() ? provenance : "RESEARCHER_INPUT_REQUIRED" })); setPreview(null); setConfirmed(false); }
  function applyWholeS0Suggestion(value: S0Intake) { setPreviousIntake(intake); setPreviousFieldStatus(fieldStatus); setIntake(value); setFieldStatus(Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, "AI_PROPOSED"])) as Record<S0FieldName, S0FieldStatus>); setS0DraftSummary("完整 13 欄已原子套用；所有欄位仍需人工確認。"); setPreview(null); setConfirmed(false); }
  function clearField(field: keyof S0Intake) { if (previousIntake && previousIntake[field] !== intake[field]) { setIntake((current) => ({ ...current, [field]: previousIntake[field] })); setFieldStatus((current) => ({ ...current, [field]: previousFieldStatus?.[field] || (previousIntake[field] ? "USER_PROVIDED" : "RESEARCHER_INPUT_REQUIRED") })); return; } setIntake((current) => ({ ...current, [field]: "" })); setFieldStatus((current) => ({ ...current, [field]: "RESEARCHER_INPUT_REQUIRED" })); setPreview(null); setConfirmed(false); }
  function validateIntake() { const pending = S0_FIELD_NAMES.filter((field) => fieldStatus[field] === "RESEARCHER_INPUT_REQUIRED"); if (pending.length) { const pendingErrors = Object.fromEntries(pending.map((field) => [field, `${fieldLabels[field]}仍需研究者確認`])) as FieldErrors; setIntakeErrors(pendingErrors); setIntakeError(`仍有 ${pending.length} 欄需確認，尚未建立正式 Project preview。`); setFocusedField(pending[0]); window.setTimeout(() => firstErrorRef.current?.focus(), 0); return false; } const result = normalizeS0Intake(intake); if (!result.ok) { setIntakeErrors(result.fieldErrors); setIntakeError(result.error); const first = Object.keys(result.fieldErrors)[0] as keyof S0Intake | undefined; if (first) { setFocusedField(first); window.setTimeout(() => firstErrorRef.current?.focus(), 0); } return false; } setIntakeErrors({}); setIntakeError(""); return true; }
  async function createPreview(event?: FormEvent) { event?.preventDefault(); if (!validateIntake()) return; setPreviewLoading(true); try { const response = await fetch("/api/projects/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake }) }); const data = await response.json() as { ok?: boolean; preview?: ProjectPreview; error?: string; fieldErrors?: FieldErrors }; if (!response.ok || !data.ok || !data.preview) { setIntakeErrors(data.fieldErrors || {}); throw new Error(data.error || "無法產生預覽"); } setPreview(data.preview); setConfirmed(false); } catch (error) { setIntakeError(error instanceof Error ? error.message : "無法產生預覽"); } finally { setPreviewLoading(false); } }
  async function confirmCreate() { if (!preview || !confirmed || !validateIntake()) return; setCreateLoading(true); setIntakeError(""); try { const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intake, projectId: preview.projectId, previewHash: preview.previewHash, confirmed: true, confirmationText: CONFIRMATION_PHRASE }) }); const data = await response.json() as { ok?: boolean; project?: ProjectSummary; compatibilityWarnings?: CompatibilityWarning[]; error?: string }; if (!response.ok || !data.ok || !data.project) throw new Error(data.error || "正式專案建立失敗；未顯示假成功"); setCurrentProject(data.project); setProjects((current) => [data.project as ProjectSummary, ...current.filter((item) => item.projectId !== data.project?.projectId)]); setCompatibilityWarnings(Array.isArray(data.compatibilityWarnings) ? data.compatibilityWarnings : []); setSourceState("live"); setPreview(null); setConfirmed(false); setIntakeError(""); if (fromNavigatorFlow) { try { const rpResponse = await fetch(`/api/projects/${encodeURIComponent(data.project.projectId)}/research-project`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(navigatorRunId ? { navigatorRunId } : {}), projectName: intake.workingTitle, projectType: intake.outputTrack === "NSTC" ? "NSTC" : intake.outputTrack === "MOE" ? "MOE_TEACHING_PRACTICE" : "JOURNAL_MANUSCRIPT", intakeOverride: { titleZh: intake.workingTitle, population: intake.targetUsers, context: intake.problemContext, methodology: intake.methodIdea, expectedContribution: intake.expectedContribution } }) }); const rpJson = await rpResponse.json() as { ok?: boolean; error?: string }; if (!rpResponse.ok || !rpJson.ok) setAutoCreateError(rpJson.error || "研究專案自動建立失敗；請到研究藍圖按「根據目前資料建立初稿」重試。"); } catch { setAutoCreateError("研究專案自動建立失敗；請到研究藍圖按「根據目前資料建立初稿」重試。"); } } setFromNavigatorFlow(false); setNavigatorRunId(null); const destination = pendingNavigatorAfterCreate ? "navigator" : "blueprint"; setPendingNavigatorAfterCreate(false); setActiveNav(destination); } catch (error) { setCompatibilityWarnings([]); setIntakeError(error instanceof Error ? error.message : "正式專案建立失敗；未顯示假成功"); } finally { setCreateLoading(false); } }
  async function sendChat(event?: FormEvent) { event?.preventDefault(); const content = chatInput.trim().slice(0, 8000); if (!content || chatLoading || !currentProject) return; const next = [...messages, { role: "user" as const, content }]; setMessages(next); setChatInput(""); setChatLoading(true); try { const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: currentProject.projectId, message: content, idempotencyKey: `${chatConversationId.current}:${next.length}`, modeProfile }) }); const data = await response.json() as { content?: string; error?: string }; setMessages((current) => [...current, { role: "assistant", content: data.content || data.error || "未取得可驗證回覆。" }]); } catch { setMessages((current) => [...current, { role: "assistant", content: "連線失敗；未取得可驗證回覆。" }]); } finally { setChatLoading(false); } }
async function logout() { await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json", Origin: location.origin }, body: "{}" }); location.href = "/login"; }

  const safeDisplayName = displayName.trim() || "使用者";
  const displayInitial = Array.from(safeDisplayName)[0] || "麥";
  const sourceLabel = sourceState === "live" ? "正式專案資料" : sourceState === "demo" ? "展示／未驗證" : sourceState === "error" ? "來源錯誤" : "讀取中";
  function candidateToNavigatorTopic(candidate: DomainTopicLabCandidate): NavigatorInitialTopic {
    const splitContext = candidate.targetContext.split(/／|、|\/|\n/).map((item) => item.trim()).filter(Boolean);
    return {
      titleZh: candidate.workingTitle,
      titleEn: "",
      abstract: candidate.researchQuestion,
      researchGap: candidate.researchValue,
      researchQuestions: [candidate.researchQuestion],
      theory: candidate.mechanismTheory ? [candidate.mechanismTheory] : [],
      coreProblem: candidate.researchQuestion,
      intervention: candidate.methodDesign ? [candidate.methodDesign] : [],
      population: splitContext[0] ?? "",
      context: splitContext[1] ?? "",
      method: [candidate.methodDesign, candidate.dataPlan].filter(Boolean).join("\n"),
      plannedData: candidate.dataPlan,
      expectedOutcomes: candidate.contribution ? [candidate.contribution] : [],
      noveltyAnalysis: candidate.novelty,
      secondaryContributions: [],
    };
  }
  function handleProjectTrashed(projectId: string) { setProjects((current) => current.filter((item) => item.projectId !== projectId)); setCurrentProject((current) => (current && current.projectId === projectId ? null : current)); setActiveNav("overview"); }
  function renderOverview() {
    const currentStage = currentProject?.currentStage || "S0_INTAKE";
    const workingTitle = currentProject?.workingTitle || currentProject?.title || "未命名研究專案";
    const nextGate = currentProject?.nextGate || "RESEARCH_DIRECTION Human Gate 待確認";
    const humanGateStatus = currentProject?.humanGateStatus || "REQUIRED";
    const navId = (id: string): NavId => id as NavId;
    const switchProject = (nextId: string) => {
      const next = projects.find((item) => item.projectId === nextId);
      if (next) { setCurrentProject(next); setActiveNav("overview"); }
    };
    return <>
      {/* V3-U03-R2 研究路徑 Roadmap（首屏前排，使用者指定樣式：生命週期時間軸＋串聯路徑） */}
      <ResearchPathRoadmap
        goalId={(currentProject && PRIMARY_GOAL_IDS.includes(currentProject.outputTrack as PrimaryGoalId) ? currentProject.outputTrack : workflowGoalView) as PrimaryGoalId}
        currentStage={currentProject?.currentStage || "S0_INTAKE"}
        currentStationKey={null}
        onNavigate={(id) => go(navId(id))}
        showGoalSwitcher
        onGoalChange={setWorkflowGoalView}
      />
      {/* V3-HOME-02 研究工作台首頁：資訊架構、意圖入口、六群導航與功能說明 */}
      <Home2WorkbenchOverview
        currentProject={currentProject}
        projects={projects}
        onSwitchProject={switchProject}
        onNewProject={() => go("quick-start")}
        onNavigate={(id) => go(navId(id))}
        onTrashed={handleProjectTrashed}
      />
      {/* V3-U03-R2 研究流程與完成燈號：綠燈只由後端有效 completion snapshot 決定（非開頁/儲存/鎖定）
          無專案時亦顯示（目標切換為本地檢視，不持久化、不觸發付費任務） */}
      <ResearchWorkflowLightPanel
        goalId={(currentProject && PRIMARY_GOAL_IDS.includes(currentProject.outputTrack as PrimaryGoalId) ? currentProject.outputTrack : workflowGoalView) as PrimaryGoalId}
        progress={[]}
        onGoalChange={setWorkflowGoalView}
        onNavigate={(nodeId) => {
          if (!currentProject) { go("quick-start"); return; }
          const station = researchPathStations.find((s) => s.key === nodeId || s.navId === nodeId);
          if (station) go(navId(station.navId));
        }}
      />
      {/* 保留：狀態不是展示分數 + 已知/未知/風險交接（既有模組化 panel，不回歸） */}
      <div className="v13-two-col"><Panel kicker="證據／風險／人工門檻" title="狀態不是展示分數"><div className="v13-status-grid"><div><small>Evidence</small><strong>{statusText(currentProject?.evidenceStatus || "UNVERIFIED")}</strong><SourceBadge value={currentProject?.evidenceStatus || "UNVERIFIED"} /></div><div><small>Risk</small><strong>{statusText(currentProject?.riskStatus || "UNVERIFIED")}</strong><SourceBadge value={currentProject?.riskStatus || "UNVERIFIED"} /></div><div><small>Human Gate</small><strong>{statusText(humanGateStatus)}</strong><SourceBadge value={humanGateStatus} /></div></div><p className="v13-muted">缺少正式 metadata 時只顯示保守的未驗證與待人工確認狀態，不推定研究內容或完成度。</p></Panel><Panel kicker="可追溯交接" title="已知、未知與風險"><div className="v13-list"><p><b>已知</b>{currentProject?.known?.[0] || (currentProject ? "已確認 DB-backed Project ID 與 tenant scope" : "尚未建立正式專案")}</p><p><b>未知</b>{currentProject?.unknown?.[0] || "研究問題與外部證據尚未 fresh verification"}</p><p><b>風險</b>{currentProject?.risks?.[0] || "倫理、隱私、授權與資料治理尚未審查"}</p></div><button type="button" className="text-button" onClick={() => go(currentProject ? "evidence" : "topic-lab")}>{currentProject ? "查看 evidence ledger" : "先進入選題實驗室"} <Icon name="arrow" size={13} /></button></Panel></div>
    </>;
  }

  function renderQuickStart() {
    const selectedDraft = selectedDirectionCard ? expandedS0[selectedDirectionCard.cardId] : undefined;
    const stateText: Record<ResearchStartUiState, string> = {
      IDLE: "尚未開始",
      STEP_1_COMPARING_DIRECTIONS: "步驟 1／2：老麥正在整理三個研究方向",
      DIRECTIONS_READY: "三個方向已就緒；可比較、切換或明確要求完成所選 S0",
      STEP_2_COMPLETING_SELECTED_S0: "步驟 2／2：正在完成所選方向的 13 欄 S0",
      READY_FOR_HUMAN_REVIEW: "推薦方向 S0 已完成，等待人工預覽與確認",
    };
    return <>
      <Panel kicker="一鍵研究啟動 · 兩階段" title="只要一個研究方向，先比較三張方向卡，再完成一份 S0" note="一次點擊依序執行方向比較與推薦 S0；每階段最多一次送出。切換卡片只改本機狀態，不會再次呼叫老麥。">
        <form onSubmit={runTopicLab} className="v13-form" data-testid="quick-start" aria-busy={topicLoading}>
          <div className="v13-field topic-research-direction"><label htmlFor="quick-direction">研究方向<span aria-hidden="true"> *</span></label><textarea id="quick-direction" value={quick.researchDirection} onChange={(event) => updateQuick("researchDirection", event.target.value)} maxLength={RESEARCH_DIRECTION_MAX_LENGTH} aria-describedby="quick-direction-help" rows={4} required aria-required="true" placeholder="例如：如何提升高風險產業新進人員的安全訓練移轉與現場判斷？" /><small id="quick-direction-help">{quick.researchDirection.length}/{RESEARCH_DIRECTION_MAX_LENGTH}；問題、對象或想改善的情境任一項即可開始</small></div>
          <div className="v13-field topic-source-policy"><label htmlFor="quick-source-strategy">方案來源</label><select id="quick-source-strategy" value="NONE" disabled aria-describedby="quick-source-help"><option value="NONE">概念模式（不傳送至外部學術來源）</option></select><small id="quick-source-help">本次固定為概念模式：學術來源傳輸為 0，不宣稱熱門、新興或新穎性。即時學術搜尋需另行核准。</small></div>
          <details className="topic-advanced-settings"><summary>進階設定（選填，可由老麥提出待確認建議）</summary><div className="v13-three-col"><div className="v13-field"><label htmlFor="quick-domain">專業領域</label><select id="quick-domain" value={quick.domain} onChange={(event) => updateQuick("domain", event.target.value as CanonicalDomain | "")}><option value="">由老麥依方向建議</option>{canonicalDomains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select></div><div className="v13-field"><label htmlFor="quick-track">成果路徑</label><select id="quick-track" value={quick.outputTrack} onChange={(event) => updateQuick("outputTrack", event.target.value as OutputTrackId | "")}><option value="">由老麥依方向建議</option>{outputTrackIds.map((track) => <option key={track} value={track}>{track}</option>)}</select></div><div className="v13-field"><label htmlFor="quick-setting">對象／情境</label><input id="quick-setting" value={quick.setting} maxLength={500} onChange={(event) => updateQuick("setting", event.target.value)} /></div><div className="v13-field"><label htmlFor="quick-method">方法偏好</label><input id="quick-method" value={quick.method} maxLength={500} onChange={(event) => updateQuick("method", event.target.value)} /></div><div className="v13-field"><label htmlFor="quick-timeline">時程</label><input id="quick-timeline" value={quick.timeline} maxLength={500} onChange={(event) => updateQuick("timeline", event.target.value)} /></div><div className="v13-field"><label htmlFor="quick-data">可用資料</label><input id="quick-data" value={quick.availableData} maxLength={1000} onChange={(event) => updateQuick("availableData", event.target.value)} /></div><div className="v13-field"><label htmlFor="quick-ethics">倫理／隱私限制</label><input id="quick-ethics" value={quick.ethics} maxLength={1000} onChange={(event) => updateQuick("ethics", event.target.value)} /></div></div></details>
          <div className="v13-actions"><button type="submit" className="primary-button" data-testid="research-start-submit" disabled={topicLoading}>{topicLoading ? "老麥正在分階段整理…" : "老麥分析 3 個方向並完成推薦 S0"}<Icon name="arrow" size={15} /></button>{topicLoading && <button type="button" className="secondary-button" onClick={cancelResearchStart}>取消並保留目前內容</button>}<button type="button" className="secondary-button" onClick={() => go("topic-lab")}>查看選題實驗室</button></div>
        </form>
        <div ref={researchStartStatusRef} tabIndex={-1} className="research-start-progress" role="status" aria-live="polite" data-testid="research-start-state" data-state={researchStartState}><strong>{stateText[researchStartState]}</strong><span>正式研究寫入：0；Human Gate 前僅為本機草稿。</span></div>
        {directionSet && <section className="research-direction-results" aria-labelledby="research-direction-results-title"><div className="topic-evidence-summary"><h3 id="research-direction-results-title">三個專業方向</h3><p>{directionSet.recommendationRationale}</p><small>固定概念 lanes，全部待驗證；卡片切換不送出任何請求。</small></div><div className="topic-candidate-grid c2r4-three-plans">{directionSet.cards.map((card) => { const selected = selectedDirectionCard?.cardId === card.cardId; const expanded = Boolean(expandedS0[card.cardId]); return <article key={card.cardId} className={selected ? "selected" : ""} data-testid={`br4-direction-${card.lane}`}><div className="topic-candidate-meta"><span>{card.lane}</span><span>概念方向・待驗證</span>{card.cardId === directionSet.recommendedCardId && <span>老麥推薦</span>}</div><h3>{card.workingTitle}</h3><dl><div><dt>研究問題</dt><dd>{card.researchQuestion}</dd></div><div><dt>研究價值</dt><dd>{card.researchValue}</dd></div><div><dt>機制／理論</dt><dd>{card.mechanismTheory}</dd></div><div><dt>對象／情境</dt><dd>{card.targetContext}</dd></div><div><dt>方法草圖</dt><dd>{card.methodSketch}</dd></div><div><dt>可行性／風險</dt><dd>{card.feasibilityRisk}</dd></div><div><dt>未知事項</dt><dd><ul>{card.unknowns.map((item) => <li key={item}>{item}</li>)}</ul></dd></div></dl><button type="button" className={selected ? "primary-button" : "secondary-button"} aria-pressed={selected} onClick={() => setSelectedDirectionCard(card)}>{selected ? "已選擇此方向" : "比較此方向"}</button>{expanded && <span className="v13-badge">S0 已完成</span>}</article>; })}</div></section>}
        {selectedDirectionCard && directionSet && <section className="topic-selected-preview" aria-live="polite"><h3>目前選擇：{selectedDirectionCard.workingTitle}</h3>{selectedDraft ? <><p>此方向已有完整 13 欄 S0，可在下方預覽；套用只更新本機草稿。</p><button type="button" className="primary-button" data-testid="br4-preview-selected" onClick={() => applyResearchStartDraft(selectedDirectionCard, selectedDraft)}>預覽所選完整 S0</button></> : <><p>此非推薦方向尚未展開 S0。只有你的明確操作才會新增一次 Stage B intent。</p><button type="button" className="primary-button" data-testid="br4-expand-selected" disabled={topicLoading} onClick={() => void expandSelectedDirection()}>完成此方向的 S0</button></>}</section>}
        {pageError && <ErrorMessage message={pageError} />}
      </Panel>
      <Panel kicker="專業模式" title="完整 S0 Intake 草稿"><p className="v13-muted">推薦方向完成後會帶入一份 13 欄草稿；其他方向只有明確要求時才展開。老麥建議不會自動成為正式資料。</p><button type="button" className="primary-button" onClick={openProfessional}>開啟完整 S0 Intake</button></Panel>
      {renderIntakeEditor()}
    </>;
  }



  function renderWebPreview() {
    return <Panel kicker="唯讀網站預覽" title="網站閱讀" note="登入後即可使用；不需要 Project，也不會自動保存為正式證據。">
      <div className="v13-web-intro">
        <Icon name="book" size={24} />
        <div><strong>讓老麥先讀公開網頁，再依你的研究目的整理重點</strong><p>來源內容一律標示為尚未驗證；重要主張仍需回到原始資料與人工確認。</p></div>
      </div>
      <form className="v13-web-form" onSubmit={runWebPreview} data-testid="web-preview-form" aria-busy={webLoading}>
        <div className="v13-field">
          <label htmlFor="web-preview-url">HTTPS 網址<span aria-hidden="true"> *</span></label>
          <input id="web-preview-url" type="url" inputMode="url" autoComplete="url" required maxLength={2048} value={webUrl} onChange={(event) => setWebUrl(event.target.value)} aria-describedby="web-preview-url-help" placeholder="https://example.org/article" />
          <small id="web-preview-url-help">只接受公開 HTTPS 網址；不支援登入、付費牆或私人頁面。</small>
        </div>
        <div className="v13-field">
          <label htmlFor="web-preview-purpose">研究目的／想改善的內容<span aria-hidden="true"> *</span></label>
          <textarea id="web-preview-purpose" required rows={4} maxLength={800} value={webPurpose} onChange={(event) => setWebPurpose(event.target.value)} aria-describedby="web-preview-purpose-help" placeholder="例如：整理研究缺口，並評估這個方法是否適合我的研究設計。" />
          <small id="web-preview-purpose-help">{webPurpose.length}/2000；請勿輸入密碼、token 或未授權個資。</small>
        </div>
        <div className="v13-actions"><button type="submit" className="primary-button" disabled={webLoading}>{webLoading ? "安全讀取中…" : "請老麥閱讀"}<Icon name="arrow" size={15} /></button></div>
      </form>
      {webError && <div className="v13-web-error" role="alert">{webError}</div>}
      {webLoading && <div className="v13-empty" role="status" aria-live="polite"><Icon name="search" size={25} /><div><strong>正在安全讀取公開內容</strong><p>老麥正在確認最終網址、來源限制與可用內容。</p></div></div>}
      {webPreview && <article className="v13-web-result" aria-live="polite" data-testid="web-preview-result">
        <header><div><p className="section-kicker">來源快照</p><h3>{webPreview.source.title}</h3></div><SourceBadge value="UNVERIFIED" /></header>
        <dl className="v13-web-meta">
          <div><dt>最終網址</dt><dd><a href={webPreview.source.finalUrl} target="_blank" rel="noreferrer">{webPreview.source.finalUrl}</a></dd></div>
          <div><dt>讀取時間</dt><dd>{webPreview.source.retrievedAt}</dd></div>
          <div><dt>內容大小</dt><dd>{webPreview.source.bytes.toLocaleString("zh-TW")} bytes</dd></div>
          <div><dt>內容雜湊</dt><dd><code>{webPreview.source.contentHash}</code></dd></div>
        </dl>
        <section className="v13-web-summary" aria-labelledby="web-preview-summary-title"><h4 id="web-preview-summary-title">老麥摘要</h4><p>{webPreview.summary}</p></section>
        <div className="v13-web-columns">
          <section><h4>可行建議</h4>{webPreview.feasibleSuggestions.length > 0 ? <ul>{webPreview.feasibleSuggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul> : <p>目前沒有足夠資訊提出可行建議。</p>}</section>
          <section><h4>不可確認事項</h4>{webPreview.unknowns.length > 0 ? <ul>{webPreview.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul> : <p>仍應由研究者核對來源與適用情境。</p>}</section>
        </div>
        <section className="v13-web-limitations"><h4>來源限制</h4>{webPreview.source.limitations.length > 0 ? <ul>{webPreview.source.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul> : <p>尚未提供限制說明；不得視為來源已驗證。</p>}</section>
      </article>}
    </Panel>;
  }

  function renderEvidence() { return <><Panel kicker="文獻與證據中心" title="文獻與證據中心" note="第一版只做可追溯的查詢、驗證與 ledger，不替研究者宣稱結論。"><div className="v13-actions"><button type="button" className="primary-button" onClick={() => void runEvidence()} disabled={evidenceLoading}>{evidenceLoading ? "查證中…" : "更新 evidence ledger"}</button></div>{!evidence ? <div className="v13-empty"><Icon name="book" size={25} /><div><strong>尚未取得可驗證來源</strong><p>先執行前沿雷達或以目前快速條件更新證據中心。</p></div></div> : <><div className="v13-evidence-contract"><p><b>檢索策略：</b>{evidence.searchStrategy}</p><p><b>來源數量：</b>{evidence.sources.length}；最後查證日期由每筆來源記錄</p></div>{evidence.sources.length === 0 ? <div className="v13-blocked"><SourceBadge value="BLOCKED" /><p>尚未取得可驗證來源</p></div> : <div className="v13-table-wrap"><table><caption className="sr-only">Claim-to-source evidence ledger</caption><thead><tr><th>Claim</th><th>Source</th><th>關係</th><th>狀態／日期</th></tr></thead><tbody>{evidence.ledger.map((row) => <tr key={`${row.claim}-${row.url}`}><td>{row.claim}</td><td><a href={row.url} target="_blank" rel="noreferrer">{row.sourceTitle}</a></td><td>{row.relationship}</td><td><SourceBadge value={row.sourceIdentityStatus} /><SourceBadge value={row.claimSupportStatus} /><small>{row.retrievedAt || "尚未查證"}</small></td></tr>)}</tbody></table></div>}</>}</Panel></>; }

  function renderIntakeEditor() {
    const pendingCount = S0_FIELD_NAMES.filter((field) => fieldStatus[field] === "RESEARCHER_INPUT_REQUIRED").length;
    const selectedContext = selectedResearchCandidate
      ? { candidateId: selectedResearchCandidate.candidateId, lane: selectedResearchCandidate.lane, workingTitle: selectedResearchCandidate.workingTitle, researchQuestion: selectedResearchCandidate.researchQuestion, researchValue: selectedResearchCandidate.researchValue, mechanismTheory: selectedResearchCandidate.mechanismTheory, targetContext: selectedResearchCandidate.targetContext, contribution: selectedResearchCandidate.contribution, methodDesign: selectedResearchCandidate.methodDesign, dataPlan: selectedResearchCandidate.dataPlan, assumptions: selectedResearchCandidate.assumptions, unresolvedItems: selectedResearchCandidate.unresolvedItems }
      : selectedDirectionCard
        ? { candidateId: selectedDirectionCard.cardId, lane: selectedDirectionCard.lane, workingTitle: selectedDirectionCard.workingTitle, researchQuestion: selectedDirectionCard.researchQuestion, researchValue: selectedDirectionCard.researchValue, mechanismTheory: selectedDirectionCard.mechanismTheory, targetContext: selectedDirectionCard.targetContext, contribution: intake.expectedContribution || selectedDirectionCard.researchValue, methodDesign: selectedDirectionCard.methodSketch, dataPlan: intake.availableData, assumptions: selectedDirectionCard.unknowns, unresolvedItems: selectedDirectionCard.unknowns }
        : null;
    const s0AssistContext = { researchDirection: quick.researchDirection, selectedCandidate: selectedContext, domain: intake.domain, outputTrack: intake.outputTrack, s0: intake, fieldStatus };
    return <Panel kicker="S0 起步 · 專案優先" title="完整專業模式：逐欄接受、修改或重寫" note="改動任何欄位都會讓舊 previewHash 失效。">
      <form onSubmit={createPreview} className="v13-form" data-testid="s0-draft-apply">
        <ChoiceGroup label="六大正式領域" value={intake.domain} options={canonicalDomains} onChange={(value) => updateField("domain", value)} testId="s0-domain" />
        <ChoiceGroup label="主成果路徑" value={intake.outputTrack} options={["NSTC", "MOE", "SCI", "SSCI"]} onChange={(value) => updateField("outputTrack", value)} testId="s0-track" />
        {s0DraftSummary && <p className="v13-assist-summary" role="status" aria-live="polite">{s0DraftSummary}</p>}
        <div className="v13-intake-grid">{textFields.map((field) => <FieldEditor key={field} field={field} value={intake[field]} error={intakeErrors[field]} ai={fieldStatus[field] === "AI_PROPOSED"} inputRef={focusedField === field ? firstErrorRef : undefined} onChange={(value) => updateField(field, value)} onClear={() => clearField(field)} assist={<OldMikeAssistControl surface="S0_RESEARCH_TEXT" targetId={field} currentValue={intake[field]} contextSnapshot={s0AssistContext} currentProvenance={fieldStatus[field] === "AI_PROPOSED" ? "AI_PROPOSED" : "USER_PROVIDED"} onApply={(value, provenance) => applyFieldSuggestion(field, value, provenance)} label={`老麥協助：${fieldLabels[field]}`} />} />)}</div>
        <div className="v13-actions">
          <button type="submit" className="primary-button" data-testid="s0-preview" disabled={previewLoading || pendingCount > 0}>{previewLoading ? "產生預覽中…" : "產生 S0 預覽"}<Icon name="arrow" size={15} /></button>
          <OldMikeAssistWholeS0Control value={intake} contextSnapshot={s0AssistContext} onApply={applyWholeS0Suggestion} />
          <button type="button" className="secondary-button" onClick={() => { setIntake(initialIntake); setFieldStatus({ ...initialS0FieldStatus }); setSelectedResearchCandidate(null); setPreview(null); setPreviousIntake(null); setPreviousFieldStatus(null); setCompareDraft(false); setS0DraftSummary(""); }}>清除草稿</button>
          {previousIntake && <button type="button" className="secondary-button" onClick={() => setCompareDraft((current) => !current)}>{compareDraft ? "關閉前後版本" : "比較前後版本"}</button>}
        </div>
        {pendingCount > 0 && <p className="v13-muted">仍有 {pendingCount} 欄需確認；完成前不會產生正式 Project preview。</p>}
        {intakeError && <ErrorMessage message={intakeError} />}
      </form>
      {previousIntake && compareDraft && <div className="v13-draft-diff" aria-live="polite"><strong>前後版本比較</strong>{textFields.filter((field) => previousIntake[field] !== intake[field]).map((field) => <p key={field}><b>{fieldLabels[field]}</b><span>前：{previousIntake[field] || "（空白）"}</span><span>後：{intake[field] || "（空白）"}</span></p>)}</div>}
      {preview && <div className="v13-preview" aria-live="polite"><div><SourceBadge value="PREVIEW_ONLY" /><h3>{preview.workingTitle}</h3><p>{preview.domain} · {preview.outputTrack} · <code>{preview.projectId}</code></p></div><div className="v13-review-grid"><div><strong>已知</strong>{preview.known.map((item) => <p key={item}>{item}</p>)}</div><div><strong>未知</strong>{preview.unknown.map((item) => <p key={item}>{item}</p>)}</div><div><strong>假設</strong>{preview.assumptions.map((item) => <p key={item}>{item}</p>)}</div><div><strong>風險</strong>{preview.risks.map((item) => <p key={item}>{item}</p>)}</div></div><label className="v13-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required aria-required="true" />我已閱讀上述預覽，確認內容仍需研究者核對，並同意以 Portal PostgreSQL 交易建立正式專案且不覆蓋既有專案。</label><button type="button" className="primary-button" data-testid="project-confirm" disabled={!confirmed || createLoading} onClick={() => void confirmCreate()}>{createLoading ? "建立中…" : "確認建立正式專案"}<Icon name="arrow" size={15} /></button></div>}
    </Panel>;
  }

  function renderLocked() { const current = navGroups.flatMap((group) => group.items).find((item) => item.id === activeNav); return <LockedModule title={current?.label || "研究模組"} />; }
  function renderPage() { const topicConditions = { researchDirection: quick.researchDirection, domain: quick.domain || undefined, outputTrack: quick.outputTrack || undefined, population: quick.setting, context: quick.setting, methodPreferences: quick.method, time: quick.timeline, data: quick.availableData, ethics: quick.ethics }; const topicProjectId = quickAnalysis ? undefined : currentProject?.projectId; if (activeNav === "overview") return renderOverview(); if (activeNav === "quick-start") return renderQuickStart(); if (activeNav === "one-click") return <OneClickInspiration onOpenTopicLab={(direction) => { if (direction) updateQuick("researchDirection", direction); go("topic-lab"); }} onSendToTopicLab={(ideas) => { if (ideas && ideas.length > 0) { const first = ideas[0]; updateQuick("researchDirection", `${first.titleZh}。${first.researchQuestion}`); } go("topic-lab"); }} />; if (activeNav === "topic-validation") return <TopicValidation />; if (activeNav === "topic-lab") return <TopicLabFrontierRadar projectId={topicProjectId} initialView="lab" initialConditions={topicConditions} initialAnalysis={quickAnalysis} initialSourceCapability={quickSourceCapability} onDraftCandidate={adoptTopicLabDraft} onNavigateToInspiration={() => go("one-click")} />; if (activeNav === "radar") return <TopicLabFrontierRadar projectId={topicProjectId} initialView="radar" initialConditions={topicConditions} initialAnalysis={quickAnalysis} initialSourceCapability={quickSourceCapability} onDraftCandidate={adoptTopicLabDraft} onNavigateToInspiration={() => go("one-click")} />; if (activeNav === "web-preview") return renderWebPreview(); if (activeNav === "evidence") return currentProject ? renderEvidence() : renderLocked(); if (activeNav === "language-center") return currentProject ? <LanguageCenter projectId={currentProject.projectId} onNavigate={(navId) => go(navId as NavId)} /> : renderLocked(); if (activeNav === "academic-language") return currentProject ? <AcademicLanguageStudio projectId={currentProject.projectId} /> : renderLocked(); if (activeNav === "reviewer") return currentProject ? <ReviewStudio projectId={currentProject.projectId} /> : renderLocked(); if (activeNav === "proposals") return currentProject ? <ProposalStudio projectId={currentProject.projectId} /> : renderLocked(); if (activeNav === "navigator") return currentProject ? <SubmissionNavigatorStudio projectId={currentProject.projectId} initialTopic={navigatorTopic} onNavigate={(navId) => go(navId as NavId)} /> : renderLocked(); if (activeNav === "submission-gate") return currentProject ? <SubmissionGate projectId={currentProject.projectId} onNavigate={(navId) => go(navId as NavId)} /> : renderLocked();    if (activeNav === "blueprint") return currentProject ? <ResearchBlueprintStudio projectId={currentProject.projectId} onNavigate={(navId) => go(navId as NavId)} onOpenEvidence={() => go("evidence")} /> : renderLocked(); if (activeNav === "ethics-center") return currentProject ? <EthicsCenter projectId={currentProject.projectId} /> : renderLocked(); if (activeNav === "review-compliance") return currentProject ? <ReviewComplianceWorkspace projectId={currentProject.projectId} onOpenEvidence={() => go("evidence")} /> : renderLocked(); if (activeNav === "application-package") return currentProject ? <ApplicationPackageStudio projectId={currentProject.projectId} /> : renderLocked(); if (activeNav === "journals") return currentProject ? <JournalSubmissionStudio projectId={currentProject.projectId} /> : renderLocked(); if (activeNav === "theory") return currentProject ? <TheoryMechanismLab projectId={currentProject.projectId} onOpenEvidence={() => go("evidence")} onOpenBlueprint={() => go("evidence")} onOpenDesign={() => go("design")} /> : renderLocked(); if (activeNav === "design") return currentProject ? <ResearchDesignLab projectId={currentProject.projectId} onOpenEvidence={() => go("evidence")} onOpenBlueprint={() => go("evidence")} onOpenRouteWorkspace={() => go("route-workspace")} /> : renderLocked(); if (activeNav === "route-workspace") return currentProject ? <RouteWorkspaceStudio projectId={currentProject.projectId} onOpenEvidence={() => go("evidence")} onOpenEthics={() => go("ethics-center")} /> : renderLocked(); if (activeNav === "instruments-protocol") return currentProject ? <InstrumentProtocolStudio projectId={currentProject.projectId} onOpenEvidence={() => go("evidence")} /> : renderLocked(); if (activeNav === "pilot-protocol-validation") return currentProject ? <PilotValidationCenter projectId={currentProject.projectId} onOpenEvidence={() => go("evidence")} /> : renderLocked(); if (activeNav === "execution") return currentProject ? <FormalExecutionCenter projectId={currentProject.projectId} onNavigate={(navId) => go(navId as NavId)} /> : renderLocked(); if (activeNav === "governance") return currentProject ? <DataGovernanceCenter projectId={currentProject.projectId} onNavigate={(navId) => go(navId as NavId)} /> : renderLocked(); if (activeNav === "analysis-lab") return currentProject ? <AnalysisLabCenter projectId={currentProject.projectId} onNavigate={(navId) => go(navId as NavId)} /> : renderLocked(); if (activeNav === "manuscript") return currentProject ? <ManuscriptStudio projectId={currentProject.projectId} onNavigate={(navId) => go(navId as NavId)} /> : renderLocked(); if (activeNav === "scientific-review") return currentProject ? <ScientificReviewCenter projectId={currentProject.projectId} onNavigate={(navId) => go(navId as NavId)} /> : renderLocked(); if (activeNav === "gap") return currentProject ? <GapNoveltyLab projectId={currentProject.projectId} onNavigate={(navId) => go(navId as NavId)} onOpenEvidence={() => go("evidence")} /> : renderLocked(); if (currentProject && ["analysis", "outputs", "integrity", "memory"].includes(activeNav)) return <ResearchWorkflow projectId={currentProject.projectId} />; if (activeNav === "trash") return <ProjectTrashCenter onRestored={() => { void loadProjects(); setActiveNav("overview"); }} />; if (activeNav === "standalone-language") return <StandaloneLanguageTool />; return renderLocked(); }

  const mobileNavOpen = activeOverlay === "MOBILE_NAV";
  const chatOpen = activeOverlay === "CHAT";

  return <div className="app-shell" data-active-overlay={activeOverlay}>
    {activeOverlay !== "NONE" && <button type="button" className="overlay-backdrop" tabIndex={-1} aria-label="關閉目前面板" onClick={closeOverlay} />}
    <aside ref={sidebarRef} id="mobile-navigation-overlay" className={`sidebar ${mobileNavOpen ? "open" : ""}`} role={isMobileLayout && mobileNavOpen ? "dialog" : undefined} aria-modal={isMobileLayout && mobileNavOpen ? "true" : undefined} aria-labelledby="mobile-navigation-title" inert={chatOpen || (isMobileLayout && !mobileNavOpen) ? true : undefined}>
      <div className="sidebar-head">
        <div className="brand-mark"><span>麥</span></div>
        <div><strong id="mobile-navigation-title">老麥</strong><small>科研工作台</small></div>
        <button ref={navCloseRef} type="button" className="icon-button mobile-only" onClick={closeOverlay} aria-label="關閉選單"><Icon name="close" /></button>
      </div>
      <nav aria-label="研究工作台導覽">{navGroups.map((group) => <div key={group.label}><p className="nav-label">{group.label}</p>{group.items.map((item) => <button type="button" key={item.id} data-testid={`nav-${item.id}`} className={activeNav === item.id ? "active" : ""} onClick={() => go(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{!item.public && !currentProject && <small className="nav-lock">需 Project</small>}</button>)}</div>)}</nav>
      <div className="sidebar-source"><span className={`source-dot ${sourceState === "live" ? "live" : sourceState === "demo" ? "demo" : sourceState === "error" ? "error" : ""}`} />{sourceLabel}</div>
      <div className="sidebar-foot">
        <div className="identity-dot" aria-hidden="true">{displayInitial}</div>
        <div className="sidebar-identity"><strong data-testid="sidebar-display-name">{safeDisplayName}</strong><small>個人工作區</small></div>
        <button type="button" className="logout-button" onClick={() => void logout()} aria-label={`登出 ${safeDisplayName}`}><Icon name="logout" size={15} /></button>
      </div>
    </aside>
    <main className="workspace" inert={activeOverlay !== "NONE" ? true : undefined}>
      <header className="topbar"><button type="button" className="icon-button mobile-only" onClick={(event) => openOverlay("MOBILE_NAV", event.currentTarget)} aria-label="開啟選單" aria-expanded={mobileNavOpen} aria-controls="mobile-navigation-overlay"><Icon name="menu" /></button><div><p className="breadcrumb">研究總覽 / {projects.length >= 1 ? <select aria-label="切換專案" value={currentProject?.projectId ?? ""} onChange={(event) => { const next = projects.find((item) => item.projectId === event.target.value); if (next) { setCurrentProject(next); setActiveNav("overview"); } }} style={{ fontSize: 13, padding: "2px 6px", borderRadius: 6, border: "1px solid #dbe5df", background: "#fff", color: "var(--ink)", maxWidth: 260 }}>{projects.map((item) => <option key={item.projectId} value={item.projectId}>{item.title || item.projectId}{currentProject?.projectId === item.projectId ? "（目前）" : ""}</option>)}</select> : currentProject ? currentProject.projectId : "尚未建立專案"}</p><h1>{currentProject ? "繼續把研究問題做深。" : "先把方向變成可查證的研究題目。"}</h1></div><div className="top-actions"><span className={`verified-pill ${sourceState === "live" ? "real" : "demo"}`}><span />{sourceLabel}</span><button type="button" className="primary-button" onClick={() => { setPendingNavigatorAfterCreate(false); go("quick-start"); }}><Icon name="plus" size={15} />建立研究專案</button></div></header>
      {pageError && <ErrorMessage message={pageError} />}<CompatibilityWarningPanel warnings={compatibilityWarnings} />{renderPage()}
      <button type="button" className="v13-chat-fab" onClick={(event) => openOverlay("CHAT", event.currentTarget)} aria-label="開啟老麥專案對話" aria-expanded={chatOpen} aria-controls="project-chat-overlay"><Icon name="spark" size={19} /><span>問老麥</span></button>
    </main>
    {chatOpen && <div ref={chatRef} id="project-chat-overlay" className="v13-chat" role="dialog" aria-modal="true" aria-labelledby="project-chat-title"><div className="v13-chat-head"><div><strong id="project-chat-title">老麥專案對話</strong><small>{currentProject ? `Project ID · ${currentProject.projectId}` : "尚無正式 Project ID"}</small></div><button ref={chatCloseRef} type="button" className="icon-button" onClick={closeOverlay} aria-label="關閉對話"><Icon name="close" /></button></div><ModelModePicker operation="PROJECT_CHAT" value={modeProfile} onChange={setModeProfile} testId="project-chat-model-mode" /><div className="v13-chat-body" role="log" aria-live="polite" aria-relevant="additions text">{messages.map((message, index) => <div className={`v13-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "麥" : "你"}</span><p>{message.content}</p></div>)}</div><form className="v13-chat-compose" onSubmit={sendChat}>{currentProject ? <><textarea ref={composerRef} value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={8000} placeholder="針對目前 Project ID 提問…" aria-label="對老麥的訊息" /><button type="submit" disabled={chatLoading || !chatInput.trim()} aria-label="送出訊息"><Icon name="send" /></button></> : <p>建立正式專案後，這裡才會固定帶入 Project ID 並開始專案化對話。</p>}</form></div>}
  </div>;
}