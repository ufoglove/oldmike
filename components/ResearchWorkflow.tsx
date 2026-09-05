"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import OldMikeAssistControl, { OldMikeAssistGroupControl } from "./OldMikeAssistControl";

type WorkflowProps = { projectId: string };
type VersionRow = { id: string; logicalId: string; versionNumber: number; contentHash: string; lockedAt?: string | null };
type ResearchState = {
  lifecycleContractVersion: string;
  workflow: Array<{ fromStage: string; toStage: string; stageDetail?: string | null }>;
  studies: VersionRow[];
  analysisPlans: Array<VersionRow & { method: string; engine: string; engineVersion: string }>;
  analysisRuns: Array<{ method: string; resultHash: string; engine: string; engineVersion: string; status: string }>;
  datasets: Array<{ id: string; artifactId: string; artifactPath: string; sha256: string; mediaType: string; byteSize: number }>;
  evidence: Array<{ id: string; sourceIdentityStatus: string; sourceVersion: string; sourceHash: string }>;
  claims: Array<VersionRow & { claimSupportStatus: string }>;
  documents: Array<VersionRow & { documentType: string; title: string }>;
  humanGates: Array<{ id: string; gateType: string; artifactType: string; artifactVersionId: string; approvedContentHash: string; decision: string }>;
};

const STAGES = ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"];
const DETAILS = [
  "S0_RESEARCH_DIRECTION_HUMAN_GATE", "S1_DESIGN_DRAFT", "S1_DESIGN_LOCKED",
  "S2_DATASET_REGISTERED", "S2_EVIDENCE_REGISTERED", "S3_ANALYSIS_PLAN_LOCKED",
  "S4_ANALYSIS_COMPLETED", "S5_EVIDENCE_SCREENED", "S6_RESULTS_HUMAN_GATE",
  "S7_DOCUMENT_DRAFT", "S8_RELEASE_HUMAN_GATE", "S9_ARCHIVED",
];

function canonical(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? (Object.is(value, -0) ? 0 : value) : null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object") return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]));
  return null;
}

async function hashPayload(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical(value))));
  return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function numericList(value: string) {
  const parsed = value.split(",").map((item) => item.trim()).filter(Boolean).map(Number);
  if (!parsed.length || parsed.some((item) => !Number.isFinite(item))) throw new Error("analysis_values_invalid");
  return parsed;
}

export default function ResearchWorkflow({ projectId }: WorkflowProps) {
  const [research, setResearch] = useState<ResearchState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const [design, setDesign] = useState({ title: "", objective: "" });
  const [dataset, setDataset] = useState({ artifactId: "", artifactPath: "", sha256: "", mediaType: "text/csv", byteSize: "" });
  const [plan, setPlan] = useState({ method: "DESCRIPTIVE_STATISTICS", alpha: "0.05", precision: "6" });
  const [analysisValues, setAnalysisValues] = useState({ primary: "", secondary: "", idempotencyKey: "" });
  const [evidence, setEvidence] = useState({ sourceIdentity: "", sourceVersion: "", sourceHash: "", verificationMethod: "human-source-check", excerpt: "", locator: "" });
  const [claim, setClaim] = useState("");
  const [document, setDocument] = useState({ title: "", body: "", documentType: "MANUSCRIPT" });
  const [gate, setGate] = useState({ gateType: "RESULTS_RELEASE", artifactType: "analysisPlan", artifactVersionId: "", approvedContentHash: "", rationale: "" });
  const [transition, setTransition] = useState({ fromStage: "S0", toStage: "S1", stageDetail: "S1_DESIGN_DRAFT", humanGateId: "", artifactVersionId: "", contentHash: "" });
  const [archiveHash, setArchiveHash] = useState("");

  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/research`;
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.json() as { ok?: boolean; research?: ResearchState; code?: string };
    if (!response.ok || !body.ok || !body.research) throw new Error(body.code || "research_unavailable");
    setResearch(body.research);
  }, [endpoint]);

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "research_unavailable")); }, [load]);

  async function operate(operation: string, payload: Record<string, unknown>, success: string) {
    setWorking(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, ...payload }) });
      const body = await response.json().catch(() => ({})) as { code?: string; archiveHash?: string };
      if (!response.ok) throw new Error(body.code || `${operation}_blocked`);
      if (body.archiveHash) setArchiveHash(body.archiveHash);
      setNotice(success);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : `${operation}_blocked`); }
    finally { setWorking(false); }
  }

  const latestDesign = research?.studies[0];
  const latestPlan = research?.analysisPlans[0];
  const latestDataset = research?.datasets[0];
  const latestEvidence = research?.evidence[0];
  const verifiedEvidence = research?.evidence.find((item) => item.sourceIdentityStatus === "VERIFIED");
  const latestClaim = research?.claims[0];
  const evidenceGate = latestEvidence && research?.humanGates.find((item) => item.gateType === "EVIDENCE_VERIFICATION" && item.artifactVersionId === latestEvidence.id && item.approvedContentHash === latestEvidence.sourceHash && item.decision === "APPROVED");
  const claimGate = latestClaim && research?.humanGates.find((item) => item.gateType === "CLAIM_SUPPORT" && item.artifactVersionId === latestClaim.id && item.approvedContentHash === latestClaim.contentHash && item.decision === "APPROVED");
  const counts = useMemo(() => ({
    versions: (research?.studies.length ?? 0) + (research?.analysisPlans.length ?? 0) + (research?.documents.length ?? 0),
    evidence: research?.evidence.length ?? 0,
    analyses: research?.analysisRuns.length ?? 0,
  }), [research]);

  async function createDesign() {
    if (!design.title.trim() || !design.objective.trim()) return setError("design_fields_required");
    const payload = { title: design.title.trim(), objective: design.objective.trim(), assumptions: [], preregistration: false };
    await operate("design.create", { logicalId: "primary-design", payload, contentHash: await hashPayload(payload), expectedVersion: latestDesign?.versionNumber ?? 0, stageDetail: "S1_DESIGN_DRAFT" }, "研究設計新版本已建立。鎖定後才能作為 Human Gate 依據。");
  }

  async function createPlan() {
    const parameters = { pairing: "UNPAIRED", tail: "TWO_SIDED", alpha: Number(plan.alpha), missingValuePolicy: "COMPLETE_CASE", precision: Number(plan.precision), rounding: "HALF_EVEN", correlation: "PEARSON", test: "WELCH" };
    await operate("analysis-plan.create", { logicalId: "primary-analysis-plan", method: plan.method, parameters, contentHash: await hashPayload({ method: plan.method, parameters }), expectedVersion: latestPlan?.versionNumber ?? 0 }, "分析計畫新版本已建立；執行前必須鎖定。");
  }

  async function runAnalysis() {
    if (!latestDataset || !latestPlan?.lockedAt) return setError("locked_plan_and_dataset_required");
    const parameters = { pairing: "UNPAIRED", tail: "TWO_SIDED", alpha: Number(plan.alpha), missingValuePolicy: "COMPLETE_CASE", precision: Number(plan.precision), rounding: "HALF_EVEN", correlation: "PEARSON", test: "WELCH" };
    const primary = numericList(analysisValues.primary);
    const secondary = analysisValues.secondary.trim() ? numericList(analysisValues.secondary) : [];
    const values: Record<string, unknown> = { values: primary };
    if (latestPlan.method === "CORRELATION") Object.assign(values, { x: primary, y: secondary });
    if (latestPlan.method === "TWO_GROUP_COMPARISON") Object.assign(values, { groupA: primary, groupB: secondary });
    await operate("analysis.run", { datasetId: latestDataset.id, datasetSha256: latestDataset.sha256, analysisPlanId: latestPlan.id, analysisPlanHash: latestPlan.contentHash, idempotencyKey: analysisValues.idempotencyKey || `analysis-${latestDataset.sha256.slice(0, 12)}-${latestPlan.contentHash.slice(0, 12)}`, method: latestPlan.method, parameters, ...values }, "Allowlist 統計分析已完成；重複相同輸入會回傳同一結果。");
  }

  return <section className="section-block research-workflow" aria-labelledby="research-workflow-title" data-runtime-contract="old-mike-research-workflow-runtime-v1.5.6">
    <div className="section-heading"><div><p className="section-kicker">S0–S9 研究流程</p><h2 id="research-workflow-title">可操作、可重現的研究工作流</h2></div><p className="section-note">所有正式資料同時綁定目前使用者、Workspace 與 Project；鎖定版本、Human Gate、Evidence First 與非法轉移一律 fail closed。</p></div>
    {error && <p className="inline-error" role="alert">操作被阻擋：{error}</p>}
    {notice && <p className="research-notice" role="status">{notice}</p>}
    <div className="status-grid">
      <div className="status-card teal"><span>Lifecycle contract</span><strong>{research?.lifecycleContractVersion || "1.5.4"}</strong><small>S0–S9 append-only</small></div>
      <div className="status-card"><span>Versioned artifacts</span><strong>{counts.versions}</strong><small>locked versions immutable</small></div>
      <div className="status-card"><span>Evidence / analyses</span><strong>{counts.evidence} / {counts.analyses}</strong><small>Evidence First</small></div>
    </div>

    <div className="research-panel-grid">
      <article className="research-panel"><h3>S1 研究設計</h3><p>建立 append-only 設計版本；鎖定後不可覆寫。</p>
        <label className="research-field">標題<input value={design.title} onChange={(event) => setDesign({ ...design, title: event.target.value })} /></label>
        <label className="research-field">研究目標<textarea rows={3} value={design.objective} onChange={(event) => setDesign({ ...design, objective: event.target.value })} /></label>
        <OldMikeAssistGroupControl projectId={projectId} surface="RESEARCH_DESIGN" groupId="research-design" value={design} onApply={(value) => setDesign({ title: value.title, objective: value.objective })} />
        <div className="research-actions"><button className="primary-button" disabled={working} onClick={() => void createDesign()}>建立設計版本</button><button className="secondary-button" disabled={working || !latestDesign || Boolean(latestDesign.lockedAt)} onClick={() => latestDesign && void operate("version.lock", { kind: "study", id: latestDesign.id, contentHash: latestDesign.contentHash }, "研究設計版本已鎖定。")}>鎖定最新版</button></div>
      </article>

      <article className="research-panel"><h3>S2 Dataset 登錄</h3><p>只保存 immutable artifact reference 與 SHA-256，不把大型原始資料寫入資料庫。</p>
        <label className="research-field">Artifact ID<input value={dataset.artifactId} onChange={(event) => setDataset({ ...dataset, artifactId: event.target.value })} /></label>
        <label className="research-field">私有 artifact path<input value={dataset.artifactPath} onChange={(event) => setDataset({ ...dataset, artifactPath: event.target.value })} /></label>
        <label className="research-field">SHA-256<input inputMode="text" maxLength={64} value={dataset.sha256} onChange={(event) => setDataset({ ...dataset, sha256: event.target.value.toLowerCase() })} /></label>
        <div className="research-two-columns"><label className="research-field">Media type<input value={dataset.mediaType} onChange={(event) => setDataset({ ...dataset, mediaType: event.target.value })} /></label><label className="research-field">Bytes<input inputMode="numeric" value={dataset.byteSize} onChange={(event) => setDataset({ ...dataset, byteSize: event.target.value })} /></label></div>
        <button className="primary-button" disabled={working} onClick={() => void operate("dataset.register", { ...dataset, byteSize: Number(dataset.byteSize), schemaSummary: { contract: "user-reviewed" } }, "Dataset metadata 已綁定目前 Project。")}>登錄 Dataset</button>
      </article>

      <article className="research-panel"><h3>S3–S4 分析計畫與執行</h3><p>只允許 descriptive、missing summary、correlation、two-group comparison。</p>
        <label className="research-field">方法<select value={plan.method} onChange={(event) => setPlan({ ...plan, method: event.target.value })}><option value="DESCRIPTIVE_STATISTICS">Descriptive statistics</option><option value="MISSING_VALUE_SUMMARY">Missing-value summary</option><option value="CORRELATION">Pearson correlation</option><option value="TWO_GROUP_COMPARISON">Welch two-group comparison</option></select></label>
        <div className="research-two-columns"><label className="research-field">Alpha<input value={plan.alpha} onChange={(event) => setPlan({ ...plan, alpha: event.target.value })} /></label><label className="research-field">Precision<input value={plan.precision} onChange={(event) => setPlan({ ...plan, precision: event.target.value })} /></label></div>
        <div className="research-actions"><button className="primary-button" disabled={working} onClick={() => void createPlan()}>建立計畫版本</button><button className="secondary-button" disabled={working || !latestPlan || Boolean(latestPlan.lockedAt)} onClick={() => latestPlan && void operate("version.lock", { kind: "analysisPlan", id: latestPlan.id, contentHash: latestPlan.contentHash }, "分析計畫已鎖定。")}>鎖定最新版</button></div>
        <label className="research-field">主要數值（逗號分隔）<textarea rows={2} value={analysisValues.primary} onChange={(event) => setAnalysisValues({ ...analysisValues, primary: event.target.value })} /></label>
        <label className="research-field">第二組／Y（需要時）<textarea rows={2} value={analysisValues.secondary} onChange={(event) => setAnalysisValues({ ...analysisValues, secondary: event.target.value })} /></label>
        <label className="research-field">Idempotency key<input value={analysisValues.idempotencyKey} onChange={(event) => setAnalysisValues({ ...analysisValues, idempotencyKey: event.target.value })} /></label>
        <button className="primary-button" disabled={working} onClick={() => void runAnalysis()}>執行可重現分析</button>
      </article>

      <article className="research-panel"><h3>S2／S5 Evidence First</h3><p>AI 只能建立 UNVERIFIED；VERIFIED 必須由精確 hash 綁定的 Human Gate 產生新證據版本。</p>
        <label className="research-field">Source identity<input value={evidence.sourceIdentity} onChange={(event) => setEvidence({ ...evidence, sourceIdentity: event.target.value })} /></label>
        <div className="research-two-columns"><label className="research-field">Source version<input value={evidence.sourceVersion} onChange={(event) => setEvidence({ ...evidence, sourceVersion: event.target.value })} /></label><label className="research-field">Source SHA-256<input maxLength={64} value={evidence.sourceHash} onChange={(event) => setEvidence({ ...evidence, sourceHash: event.target.value.toLowerCase() })} /></label></div>
        <label className="research-field">Excerpt<textarea rows={2} value={evidence.excerpt} onChange={(event) => setEvidence({ ...evidence, excerpt: event.target.value })} /></label>
        <label className="research-field">Page／section／locator<input value={evidence.locator} onChange={(event) => setEvidence({ ...evidence, locator: event.target.value })} /></label>
        <div className="research-actions"><button className="primary-button" disabled={working} onClick={() => void operate("evidence.register", { ...evidence, retrievedAt: new Date().toISOString() }, "Evidence 已以 UNVERIFIED 登錄，尚不可當作已驗證來源。")}>登錄未驗證 Evidence</button><button className="secondary-button" disabled={working || !latestEvidence || latestEvidence.sourceIdentityStatus !== "UNVERIFIED"} onClick={() => latestEvidence && setGate({ gateType: "EVIDENCE_VERIFICATION", artifactType: "evidence", artifactVersionId: latestEvidence.id, approvedContentHash: latestEvidence.sourceHash, rationale: "Human source identity verification" })}>準備驗證 Gate</button></div>
        <button className="secondary-button" disabled={working || !latestEvidence || !evidenceGate || latestEvidence.sourceIdentityStatus !== "UNVERIFIED"} onClick={() => latestEvidence && evidenceGate && void operate("evidence.verify", { evidenceSourceId: latestEvidence.id, humanGateId: evidenceGate.id }, "已依精確 source hash 建立 append-only VERIFIED evidence。")}>依已核准 Gate 驗證 Evidence</button>
      </article>

      <article className="research-panel"><h3>S5 Claims</h3><p>Claim 預設為「老麥建議・尚未驗證」；缺少已驗證證據、有支持關係與精確 Human Gate 時不得發布。</p>
        <label className="research-field">Claim<textarea rows={4} value={claim} onChange={(event) => setClaim(event.target.value)} /></label>
        <OldMikeAssistControl projectId={projectId} surface="RESEARCH_CLAIM" targetId="claim" currentValue={claim} onApply={(value) => setClaim(value)} />
        <div className="research-actions"><button className="primary-button" disabled={working || !claim.trim()} onClick={() => void (async () => { const payload = { claimText: claim.trim() }; await operate("claim.create", { logicalId: "primary-claim", claimText: claim.trim(), contentHash: await hashPayload(payload) }, "Claim 已建立為老麥建議・尚未驗證。") })()}>建立 Claim 版本</button><button className="secondary-button" disabled={working || !latestClaim || Boolean(latestClaim.lockedAt)} onClick={() => latestClaim && void operate("version.lock", { kind: "claim", id: latestClaim.id, contentHash: latestClaim.contentHash }, "Claim 版本已鎖定。")}>鎖定最新版</button></div>
        <div className="research-actions"><button className="secondary-button" disabled={working || !latestClaim?.lockedAt} onClick={() => latestClaim && setGate({ gateType: "CLAIM_SUPPORT", artifactType: "claim", artifactVersionId: latestClaim.id, approvedContentHash: latestClaim.contentHash, rationale: "Human claim-support decision" })}>準備支持 Gate</button><button className="secondary-button" disabled={working || !latestClaim?.lockedAt || !verifiedEvidence || !claimGate} onClick={() => latestClaim && verifiedEvidence && claimGate && void operate("claim.support", { claimVersionId: latestClaim.id, evidenceSourceId: verifiedEvidence.id, humanGateId: claimGate.id }, "已建立 append-only SUPPORTED claim 版本。")}>建立 SUPPORTED 版本</button></div>
        <button className="secondary-button" disabled={working || latestClaim?.claimSupportStatus !== "SUPPORTED"} onClick={() => latestClaim && void operate("claim.publish", { claimVersionId: latestClaim.id }, "Claim 已通過 evidence 與 Human Gate 發布閘門。")}>驗證可發布狀態</button>
      </article>

      <article className="research-panel"><h3>S6／S8 Human Gate</h3><p>批准永遠綁定單一 artifact/version ID 與 approved content hash；hash 改變即失效。</p>
        <label className="research-field">Gate type<select value={gate.gateType} onChange={(event) => setGate({ ...gate, gateType: event.target.value })}><option>RESULTS_RELEASE</option><option>DOCUMENT_RELEASE</option><option>ARCHIVE_RELEASE</option><option>EVIDENCE_VERIFICATION</option><option>CLAIM_SUPPORT</option><option>RESEARCH_DIRECTION</option></select></label>
        <label className="research-field">Artifact type<select value={gate.artifactType} onChange={(event) => setGate({ ...gate, artifactType: event.target.value })}><option value="analysisPlan">analysisPlan</option><option value="study">study</option><option value="document">document</option><option value="claim">claim</option><option value="evidence">evidence</option></select></label>
        <label className="research-field">Artifact version ID<input value={gate.artifactVersionId} onChange={(event) => setGate({ ...gate, artifactVersionId: event.target.value })} /></label>
        <label className="research-field">Approved content hash<input maxLength={64} value={gate.approvedContentHash} onChange={(event) => setGate({ ...gate, approvedContentHash: event.target.value.toLowerCase() })} /></label>
        <label className="research-field">Rationale<textarea rows={2} value={gate.rationale} onChange={(event) => setGate({ ...gate, rationale: event.target.value })} /></label>
        <button className="primary-button" disabled={working} onClick={() => void operate("human-gate.create", { ...gate, decision: "APPROVED" }, "Human Gate 已記錄；內容變更後不會沿用。")}>核准精確版本</button>
      </article>

      <article className="research-panel"><h3>S7 計畫／論文撰寫</h3><p>文件採 append-only versions；鎖定後只能建立 superseding version。</p>
        <label className="research-field">文件類型<select value={document.documentType} onChange={(event) => setDocument({ ...document, documentType: event.target.value })}><option>MANUSCRIPT</option><option>PROTOCOL</option><option>ANALYSIS_REPORT</option></select></label>
        <label className="research-field">標題<input value={document.title} onChange={(event) => setDocument({ ...document, title: event.target.value })} /></label>
        <label className="research-field">內容<textarea rows={6} value={document.body} onChange={(event) => setDocument({ ...document, body: event.target.value })} /></label>
        <OldMikeAssistGroupControl projectId={projectId} surface="RESEARCH_DOCUMENT" groupId="research-document" value={{ title: document.title, body: document.body }} onApply={(value) => setDocument((current) => ({ ...current, title: value.title, body: value.body }))} />
        <button className="primary-button" disabled={working} onClick={() => void (async () => { const payload = { title: document.title, body: document.body }; await operate("document.create", { logicalId: "primary-document", ...document, contentHash: await hashPayload(payload), stageDetail: "S7_DOCUMENT_DRAFT" }, "文件新版本已建立。") })()}>建立文件版本</button>
      </article>

      <article className="research-panel"><h3>S0–S9 狀態轉移</h3><p>非法轉移、缺少前置 artifact 或缺少精確 Human Gate 時不寫入 event ledger。</p>
        <div className="research-two-columns"><label className="research-field">From<select value={transition.fromStage} onChange={(event) => setTransition({ ...transition, fromStage: event.target.value })}>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label><label className="research-field">To<select value={transition.toStage} onChange={(event) => setTransition({ ...transition, toStage: event.target.value })}>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label></div>
        <label className="research-field">Stage detail<select value={transition.stageDetail} onChange={(event) => setTransition({ ...transition, stageDetail: event.target.value })}>{DETAILS.map((detail) => <option key={detail}>{detail}</option>)}</select></label>
        <label className="research-field">Human Gate ID（需要時）<input value={transition.humanGateId} onChange={(event) => setTransition({ ...transition, humanGateId: event.target.value })} /></label>
        <div className="research-two-columns"><label className="research-field">Approved artifact ID<input value={transition.artifactVersionId} onChange={(event) => setTransition({ ...transition, artifactVersionId: event.target.value })} /></label><label className="research-field">Approved content hash<input value={transition.contentHash} onChange={(event) => setTransition({ ...transition, contentHash: event.target.value })} /></label></div>
        <button className="primary-button" disabled={working} onClick={() => void (async () => {
          if (transition.fromStage === "S0" && transition.toStage === "S1" && transition.stageDetail.startsWith("S1_DESIGN")) {
            try {
              const gateResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}/submission-navigator`, { cache: "no-store" });
              const gateData = await gateResponse.json() as { ok?: boolean; workspace?: { latest?: unknown } };
              if (!gateResponse.ok || !gateData.ok || !gateData.workspace?.latest) {
                setNotice(""); setError("尚未執行投稿與計畫導航：未鎖定路線不得進入研究設計（S1）。請先到「投稿與計畫導航」執行並鎖定路線。");
                return;
              }
            } catch {
              setNotice(""); setError("無法驗證導航器狀態；維持 fail-closed，暫不允許 S1 轉移。");
              return;
            }
          }
          await operate("workflow.transition", { fromStage: transition.fromStage, toStage: transition.toStage, stageDetail: transition.stageDetail, humanGateId: transition.humanGateId || undefined, artifactRefs: transition.artifactVersionId && transition.contentHash ? [{ artifactVersionId: transition.artifactVersionId, contentHash: transition.contentHash }] : [] }, "Append-only workflow event 已建立。");
        })()}>執行合法轉移</button>
      </article>

      <article className="research-panel research-panel-wide"><h3>S9 可驗證封存</h3><p>固定排序與 canonical serialization；封存只包含目前 tenant 的 provenance、hash、workflow events、Human Gates、evidence references 與 analysis engine/version。</p>
        <button className="primary-button" disabled={working} onClick={() => void operate("archive.export", {}, "Archive manifest 已以 deterministic contract 產生。")}>產生封存 manifest</button>
        {archiveHash && <code className="research-hash">Archive SHA-256: {archiveHash}</code>}
      </article>
    </div>

    <div className="handoff-list" aria-label="Recent workflow events">{research?.workflow.length ? research.workflow.slice(-10).map((event, index) => <div key={`${event.fromStage}-${event.toStage}-${index}`}><b>{event.fromStage} → {event.toStage}</b><span>{event.stageDetail || "formal stage transition"}</span></div>) : <div><b>S0</b><span>尚無正式轉移；Human Gate 與所需產物未具備時維持 fail closed。</span></div>}</div>
  </section>;
}
