"use client";

import { useCallback, useEffect, useState } from "react";

type AnyRow = Record<string, unknown>;
type Data = AnyRow & {
  ok?: boolean; locked?: boolean; missing?: string[];
  study?: { id: string; status: string; protocol_version: string | null } | null;
  activation?: { status: string; checks: AnyRow[] } | null;
  sites?: AnyRow[]; team?: AnyRow[]; campaigns?: AnyRow[]; screenings?: AnyRow[]; consents?: AnyRow[]; participants?: AnyRow[];
  allocations?: AnyRow[]; sessions?: AnyRow[]; deviations?: AnyRow[]; adverseEvents?: AnyRow[]; queries?: AnyRow[];
  assets?: AnyRow[]; closeout?: { status: string } | null; gates?: Record<string, boolean>;
  ethicsDecision?: { approvalStatus: string; expiryDate: string | null } | null; protocol?: { status: string; version: number } | null;
};
type Extras = AnyRow & { ok?: boolean; blinding?: AnyRow[]; sessionActivities?: AnyRow[]; followUps?: AnyRow[]; withdrawals?: AnyRow[]; amendments?: AnyRow[]; pauseRecords?: AnyRow[] };
const string = (v: unknown, fb = ""): string => typeof v === "string" ? v : fb;
const bool = (v: unknown): boolean => v === true || v === "true";
const count = (rows?: AnyRow[]): number => rows?.length ?? 0;
const STATUS_LABELS: Record<string, string> = { NOT_ACTIVATED: "未啟動", ACTIVATION_REVIEW: "啟動審查中", ACTIVATED: "已啟動", RECRUITING: "招募中", ACTIVE_DATA_COLLECTION: "資料蒐集中", FOLLOW_UP: "追蹤期", PAUSED: "已暫停", SUSPENDED: "中止", DATA_COLLECTION_CLOSING: "結案中", DATA_COLLECTION_CLOSED: "已結案", RAW_DATA_FROZEN: "Raw 已 Freeze", RAW_DATA_LOCKED: "Raw 已 Lock", TERMINATED_EARLY: "提前終止", ARCHIVED: "已封存" };
type Tab = "overview" | "activation" | "sites" | "team" | "recruitment" | "screening" | "consent" | "enroll" | "allocation" | "sessions" | "delivery" | "administration" | "forms" | "qualitative" | "sensors" | "ingestion" | "raw" | "fidelity" | "followup" | "safety" | "amendments" | "closeout";

export default function FormalExecutionCenter({ projectId, onNavigate }: { projectId: string; onNavigate?: (navId: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const setD = (key: string, value: unknown) => setDrafts((d) => ({ ...d, [key]: value }));

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/formal-execution`, { cache: "no-store" });
      const json = await res.json() as Data;
      if (!res.ok || json.ok === false) throw new Error(String(json.error || "無法載入正式研究執行中心。"));
      setData(json);
      if (!json.locked) {
        const er = await fetch(`/api/projects/${encodeURIComponent(projectId)}/formal-execution`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "extras" }) });
        const ej = await er.json() as Extras;
        if (er.ok && ej.ok !== false) setExtras(ej);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "載入失敗。"); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  async function action(name: string, body: Record<string, unknown>, success?: string) {
    setError(""); setBusy(name);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/formal-execution`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const payload = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "操作失敗。");
      if (success) setNotice(success);
      await load();
      return payload;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); return null; } finally { setBusy(""); }
  }
  function parseJson(key: string): Record<string, unknown> | null { try { const v = JSON.parse(string(drafts[key])); if (v && typeof v === "object" && !Array.isArray(v)) return v; setError("請輸入 JSON 物件"); return null; } catch { setError("JSON 格式錯誤"); return null; } }
  function parseList(key: string): unknown[] | null { try { const v = JSON.parse(string(drafts[key])); if (Array.isArray(v)) return v; setError("請輸入 JSON 陣列"); return null; } catch { setError("JSON 格式錯誤"); return null; } }

  if (loading) return <div className="v13-panel" style={{ marginTop: 10 }}><p className="v13-muted">載入中…</p></div>;
  if (data?.locked) {
    return <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">正式研究與執行 · 10</p><h3>正式研究執行、招募與資料蒐集中心</h3></div></div>
      <div className="v13-empty"><strong>FORMAL_EXECUTION_LOCKED</strong><ul>{(data.missing ?? []).map((m) => <li key={m}>{m}</li>)}</ul><p>正式研究啟動需先通過 Pilot 驗證鏈（真實 Pilot、機構倫理、Protocol v2.0 Final、Blueprint Study-Ready、FORMAL_STUDY_EXECUTION_READY）。</p>{onNavigate ? <button type="button" className="primary-button" style={{ marginTop: 10 }} onClick={() => onNavigate("pilot")}>前往 Pilot 與 Protocol 驗證 →</button> : null}</div>
    </div>;
  }
  const study = data?.study; const gates = data?.gates ?? {};
  const runStatus: string = string(study?.status);
  const live = ["ACTIVATED", "RECRUITING", "ACTIVE_DATA_COLLECTION", "FOLLOW_UP"].includes(runStatus);
  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "overview", label: "總覽" }, { id: "activation", label: "啟動" }, { id: "sites", label: "場域" }, { id: "team", label: "團隊" },
    { id: "recruitment", label: "招募" }, { id: "screening", label: "篩選" }, { id: "consent", label: "同意" }, { id: "enroll", label: "Enroll" },
    { id: "allocation", label: "分組/盲性" }, { id: "sessions", label: "Session" }, { id: "delivery", label: "介入" }, { id: "administration", label: "施測" },
    { id: "forms", label: "表單/更正" }, { id: "qualitative", label: "質性" }, { id: "sensors", label: "Sensor/Log/AI" }, { id: "ingestion", label: "Ingestion" },
    { id: "raw", label: "Raw Data" }, { id: "fidelity", label: "Fidelity" }, { id: "followup", label: "追蹤/退出" }, { id: "safety", label: "偏差/AE/Query" },
    { id: "amendments", label: "修正/暫停" }, { id: "closeout", label: "結案/快照" },
  ];
  const TabBar = <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "8px 0" }}>{TABS.map((t) => <button key={t.id} type="button" className={tab === t.id ? "primary-button" : "secondary-button"} style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => setTab(t.id)}>{t.label}{t.badge ? `(${t.badge})` : ""}</button>)}</div>;
  const sub = (title: string, children: React.ReactNode) => <div className="v13-subsection"><p className="section-kicker">{title}</p>{children}</div>;
  const hint = (t: string) => <p className="v13-muted" style={{ fontSize: 10, margin: "2px 0" }}>{t}</p>;
  const jsonBox = (key: string, placeholder: string, rows = 2) => <textarea rows={rows} style={{ width: "100%", fontSize: 11 }} placeholder={placeholder} value={string(drafts[key])} onChange={(e) => setD(key, e.target.value)} />;
  const smallInput = (key: string, placeholder: string, width = 140) => <input style={{ fontSize: 11, width }} placeholder={placeholder} value={string(drafts[key])} onChange={(e) => setD(key, e.target.value)} />;
  const cta = (label: string, fn: () => void, primary = true) => <button type="button" className={primary ? "primary-button" : "secondary-button"} onClick={fn}>{label}</button>;
  const join = (rows: AnyRow[] | undefined, keys: string[], empty = "無"): string => (rows ?? []).map((r) => keys.map((k) => string(r[k])).filter(Boolean).join("@")).join(" ｜ ") || empty;

  return (
    <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">正式研究與執行 · 10</p><h3>正式研究執行、招募與資料蒐集中心</h3></div><p className="v13-panel-note">執行品質管理（招募/完成度/完整性/Fidelity/Safety）。不顯示組間效果或 p-value；Raw Data 不可直接修改。</p></div>
      {error && <p className="v13-error">{error}</p>}{notice && <p className="v13-notice">{notice}</p>}
      {study && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        <span className="v13-badge" style={live ? { background: "#e0efe5", color: "#2f6f4f" } : {}}>Study：{STATUS_LABELS[runStatus] ?? runStatus}</span>
        <span className="v13-badge">Protocol：{string(study.protocol_version) || "—"}</span>
        <span className="v13-badge">Ethics：{data?.ethicsDecision ? string(data.ethicsDecision.approvalStatus) : "尚無正式判定"}</span>
        <span className="v13-badge">Enrolled：{count(data?.participants)}</span>
        <span className="v13-badge">Sessions：{count(data?.sessions)}</span>
        <span className="v13-badge">Consent：{count(data?.consents)}</span>
        <span className="v13-badge">Raw Assets：{count(data?.assets)}</span>
      </div>}
      {TabBar}

      {tab === "overview" && <div style={{ display: "grid", gap: 6 }}>
        {sub("STAGE GATES（由主持人本人核准）", <div className="research-actions" style={{ gap: 6, flexWrap: "wrap" }}>
          {!gates.FORMAL_STUDY_ACTIVATED && cta("核准 Gate1：正式啟動", () => void action("approve-gate", { gateType: "FORMAL_STUDY_ACTIVATED" }, "Gate1 已核准。"))}
          {gates.FORMAL_STUDY_ACTIVATED && !gates.RECRUITMENT_AND_DATA_COLLECTION_OPEN && cta("核准 Gate2：開啟招募與蒐集", () => void action("approve-gate", { gateType: "RECRUITMENT_AND_DATA_COLLECTION_OPEN" }, "Gate2 已核准。"))}
          {gates.RECRUITMENT_AND_DATA_COLLECTION_OPEN && !gates.FORMAL_DATA_COLLECTION_COMPLETE && cta("核准 Gate3：資料蒐集完成", () => void action("approve-gate", { gateType: "FORMAL_DATA_COLLECTION_COMPLETE" }, "Gate3 已核准。"))}
          {gates.FORMAL_DATA_COLLECTION_COMPLETE && !gates.RAW_DATA_LOCKED_AND_HANDOFF_READY && cta("核准 Gate4：Raw Lock 完成", () => void action("approve-gate", { gateType: "RAW_DATA_LOCKED_AND_HANDOFF_READY" }, "Gate4 已核准。"))}
        </div>)}
        {sub("OPERATIONAL DASHBOARD（僅執行品質）", <div className="v13-progress-grid">
          <div><small>招募管道</small><strong>{count(data?.campaigns)}</strong></div><div><small>篩選</small><strong>{count(data?.screenings)}</strong></div>
          <div><small>Consented</small><strong>{(data?.consents ?? []).filter((c) => string(c.status) === "CONSENTED").length}</strong></div>
          <div><small>Session 完成</small><strong>{(data?.sessions ?? []).filter((s) => string(s.completionStatus) === "COMPLETE").length}/{count(data?.sessions)}</strong></div>
          <div><small>Deviations</small><strong>{count(data?.deviations)}</strong></div><div><small>Adverse Events</small><strong>{count(data?.adverseEvents)}</strong></div>
          <div><small>Open Queries</small><strong>{(data?.queries ?? []).filter((q) => ["OPEN", "IN_PROGRESS"].includes(string(q.resolutionStatus))).length}</strong></div>
          <div><small>Raw Assets</small><strong>{count(data?.assets)}</strong></div>
          <div><small>Follow-up</small><strong>{count(extras?.followUps)}</strong></div><div><small>Amendments</small><strong>{count(extras?.amendments)}</strong></div>
        </div>)}
        <p className="v13-muted" style={{ fontSize: 10 }}>不顯示 Group Means／p-value／Effect Size／Hypothesis Support。</p>
      </div>}

      {tab === "activation" && <div>{sub("正式啟動條件檢查（15 項核心）", <div className="research-actions" style={{ gap: 6 }}>{cta("執行啟動審查", () => void action("run-activation", {}, "啟動條件檢查完成。"))}</div>)}
        {data?.activation && sub(`ACTIVATION：${string(data.activation.status)}`, <div style={{ display: "grid", gap: 4, marginTop: 4 }}>{(data.activation.checks ?? []).map((c, idx) => <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11 }}><span><strong>[{c.pass ? "✓" : "✗"}]</strong> {string(c.label)}</span><span className="v13-muted">{string(c.detail)}</span></div>)}</div>)}
        <p className="v13-muted" style={{ fontSize: 11, marginTop: 6 }}>系統不得自動標 ACTIVATED——Gate1 核准代表主持人確認。</p>
      </div>}

      {tab === "sites" && <div>{sub("研究場域（Multi-site 每場域：Institutional Permission／Local Etc／DTA／Activation）", <div>
        {jsonBox("sitesJson", '[{ "siteCode": "S01", "siteName": "主場域", "institution": "機構名", "localInvestigator": "主持人", "ethicsDocument": "…", "sitePermission": "…", "enrollmentTarget": 60 }]')}
        <div style={{ marginTop: 4 }}>{cta("建立/更新場域", () => { const l = parseList("sitesJson"); if (l) for (const s of l) void action("save-site", { site: s }); setNotice("場域批次已儲存。"); }, false)}</div>
        {hint(`已建立：${join(data?.sites, ["site_code", "activation_status"])}`)}
      </div>)}
        {sub("Site Activation 狀態流", <p style={{ fontSize: 11, margin: 0 }}><code>NOT_STARTED → DOCUMENTS_INCOMPLETE → TRAINING_REQUIRED → READY_FOR_ACTIVATION → ACTIVE</code>（PAUSED／CLOSED／EXPIRED）；文件齊全且團隊訓練完成才可 ACTIVE。</p>)}
      </div>}

      {tab === "team" && <div>{sub("研究團隊（最小權限：Blinded 角色看不到分組；training 未完不可 ACTIVE）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {smallInput("teamRole", "角色（PI/ASSESSOR/…）", 200)} {smallInput("teamUser", "assignedUser", 170)}
        <label style={{ fontSize: 11 }}><input type="checkbox" checked={bool(drafts.teamUnblinded)} onChange={(e) => setD("teamUnblinded", e.target.checked)} /> unblinded</label>
        {cta("加入成員", () => void action("save-team", { member: { role: drafts.teamRole, assignedUser: drafts.teamUser, unblindedAccess: bool(drafts.teamUnblinded), completedTraining: bool(drafts.teamTrained) } }, "團隊成員已加入。"), false)}
      </div>)}
        {hint(`成員：${join(data?.team, ["role", "assigned_user", "status"])}`)}
        <div className="v13-subsection-divider" /><p className="v13-muted" style={{ fontSize: 10 }}>Team Training：正式執行前所有接觸參與者之人員需完成訓練並留存紀錄（Authorization）。</p>
      </div>}

      {tab === "recruitment" && <div>{sub("招募管道（需核准版本才可 ACTIVE；結束後 CLOSED）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {smallInput("campChannel", "channel（EMAIL_INVITATION/…）", 210)}
        <select style={{ fontSize: 11 }} value={string(drafts.campStatus, "DRAFT")} onChange={(e) => setD("campStatus", e.target.value)}>{["DRAFT", "APPROVAL_REQUIRED", "APPROVED_FOR_USE", "ACTIVE", "PAUSED", "CLOSED"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
        {cta("儲存管道", () => void action("save-campaign", { campaign: { channel: drafts.campChannel, status: drafts.campStatus, ethicsApprovalReference: "依核准文件", materialVersion: string(drafts.campMat) || "v1" } }, "招募管道已儲存。"), false)}
      </div>)}
        {hint(`管道：${join(data?.campaigns, ["channel", "status"])}`)}
        {sub("Recruitment Target 追蹤", <p style={{ fontSize: 11, margin: 0 }}>Enrolled {count(data?.participants)} 人 vs Enrollment Target（場域設定）——不足時回到篩選/招募補強。</p>)}
      </div>}

      {tab === "screening" && <div>{sub("資格篩選（候選人層級：未同意不入正式庫）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {smallInput("screenCode", "screeningCode", 160)} {smallInput("screenSource", "candidateSource", 180)}
        <select style={{ fontSize: 11 }} value={string(drafts.screenStatus, "NOT_SCREENED")} onChange={(e) => setD("screenStatus", e.target.value)}>{["NOT_SCREENED", "SCREENING_IN_PROGRESS", "ELIGIBLE", "INELIGIBLE", "PENDING_CONFIRMATION", "WITHDRAWN_BEFORE_ENROLLMENT"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select style={{ fontSize: 11 }} value={string(drafts.screenExcl)} onChange={(e) => setD("screenExcl", e.target.value)}><option value="">exclusion（無）</option><option>AGE</option><option>LANGUAGE</option><option>VISION_HEALTH</option><option>CONFLICT</option><option>OTHER</option></select>
        {cta("儲存篩選", () => void action("save-screening", { screening: { screeningCode: drafts.screenCode, candidateSource: drafts.screenSource, eligibilityStatus: drafts.screenStatus, exclusionReasonCategory: drafts.screenExcl } }, "篩選紀錄已存。"), false)}
      </div>)}
        {hint(`篩選：${join(data?.screenings, ["screeningCode", "eligibilityStatus"])}`)}
      </div>}

      {tab === "consent" && <div>{sub("知情同意（未 CONSENTED 不得 Enroll；重大修改觸發 RECONSENT_REQUIRED）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {smallInput("consentCode", "participantCode", 150)} {smallInput("consentVer", "doc version", 110)}
        <select style={{ fontSize: 11 }} value={string(drafts.consentStatus, "NOT_STARTED")} onChange={(e) => setD("consentStatus", e.target.value)}>{["NOT_STARTED", "INFORMATION_PROVIDED", "QUESTIONS_PENDING", "CONSENTED", "DECLINED", "WITHDRAWN", "RECONSENT_REQUIRED", "INVALID", "EXPIRED"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
        {cta("儲存同意", () => void action("save-consent", { consent: { participantCode: drafts.consentCode, consentDocumentVersion: drafts.consentVer || "依核准版", status: drafts.consentStatus, comprehensionConfirmed: drafts.consentStatus === "CONSENTED" } }, "同意紀錄已存。"), false)}
      </div>)}
        {hint(`同意：${join(data?.consents, ["participantCode", "status"])}`)}
        {sub("Consent 選項（optional components 以 JSON 保存）", <p style={{ fontSize: 11, margin: 0 }}>audio／video／sensor／data_sharing／future_use——未同意之模組不得蒐集對應資料。</p>)}
      </div>}

      {tab === "enroll" && <div>{sub("Enroll（需 Gate1＋有效 Consent；Identity Vault 與研究資料分離）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {smallInput("enrollCode", "participantCode（禁身分證/學號/Email）", 250)} {smallInput("enrollSite", "siteCode", 100)}
        {cta("建立正式 Participant", () => void action("enroll", { participant: { participantCode: drafts.enrollCode, siteCode: drafts.enrollSite } }, "已 Enroll。"))}
      </div>)}
        {sub("Participant Code 規則", <p style={{ fontSize: 11, margin: 0 }}>Research Dataset 只保存 <code>participant_code / site_code / cohort_code / study_arm_code / session_code</code>；Identity Mapping Key 加密＋限權＋獨立 Audit Log，不得匯入分析資料或傳送非必要外部服務。</p>)}
        {hint(`已 Enroll：${join(data?.participants, ["participantCode", "status", "studyArmCode"])}`)}
      </div>}

      {tab === "allocation" && <div>{sub("分組／隨機化（完成後不可重生成；變更需 Override＋理由＋授權）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {smallInput("allocCode", "participantCode", 140)} {smallInput("allocArm", "G1 自適應 / G2 固定", 140)}
        {cta("執行分組", () => void action("allocate", { allocation: { participantCode: drafts.allocCode, assignment: drafts.allocArm, allocationMethod: "SIMPLE", assignedBy: "系統（模擬）" } }, "分組已記錄（重複會被擋）。"), false)}
        {cta("Blinded 角色試看（應被擋）", () => void action("list-allocations", { role: "ASSESSOR" }, "Blinded 角色檢查完成。"), false)}
      </div>)}
        {sub("Blinding（角色→參與者層級；Unblind 需理由＋授權＋審計）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {smallInput("blindCode", "participantCode", 140)} {smallInput("blindRole", "role", 140)}
          <select style={{ fontSize: 11 }} value={string(drafts.blindStatus, "BLINDED")} onChange={(e) => setD("blindStatus", e.target.value)}>{["BLINDED", "UNBLINDED", "PARTIAL", "OPEN_LABEL", "NOT_APPLICABLE"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          {smallInput("blindReason", "unblinding_reason", 220)} {smallInput("blindAuth", "authorized_by", 150)}
          {cta("記錄 Blinding", () => void action("record-blinding", { record: { participantCode: drafts.blindCode, role: drafts.blindRole, blindingStatus: drafts.blindStatus, unblindingReason: drafts.blindReason, unblindingAuthorizedBy: drafts.blindAuth } }, "Blinding 紀錄已存。"), false)}
        </div>)}
        {hint(`Blinding：${join(extras?.blinding, ["participantCode", "role", "blindingStatus"])}`)}
      </div>}

      {tab === "sessions" && <div>{sub("Study Session（保存 Protocol/Instrument/System/Sensor 版本）", <div>
        {jsonBox("sessionJson", '{ "participantCode": "P01", "timePoint": "T1", "protocolVersion": "v2.0 Final", "instrumentVersions": ["量表 v2"], "scheduledTime": "2026-09-10T09:00:00Z" }')}
        <div style={{ marginTop: 4 }}>{cta("建立 Session", () => { const o = parseJson("sessionJson"); if (o) void action("create-session", { session: o }, "Session 已建立。"); }, false)}</div>
        {hint(`Session：${join(data?.sessions?.slice(0, 10), ["participantCode", "timePoint", "status"])}${count(data?.sessions) > 10 ? "…" : ""}`)}
      </div>)}
        {sub("Session 內活動（Activity Checklist：required/completed/deviation）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {smallInput("saSession", "session_id", 220)} {smallInput("saKey", "activity_key（ConsentCheck/VR/Scale…）", 180)}
          <label style={{ fontSize: 11 }}><input type="checkbox" checked={bool(drafts.saDone)} onChange={(e) => setD("saDone", e.target.checked)} /> completed</label>
          {cta("記錄活動", () => void action("record-session-activity", { activity: { sessionId: drafts.saSession, activityKey: drafts.saKey, completed: bool(drafts.saDone), required: true } }, "活動已記錄。"), false)}
        </div>)}
      </div>}

      {tab === "delivery" && <div>{sub("介入／對照執行（版本＋劑量＋Fidelity 標記）", <div>
        {jsonBox("deliveryJson", '{ "participantCode": "P01", "sessionId": "ss_…", "deliveryKind": "INTERVENTION", "interventionVersion": "v2", "sessionNumber": 1, "plannedDose": "25min", "actualDose": "24min", "fidelityStatus": "WITHIN_PROTOCOL" }')}
        <div style={{ marginTop: 4 }}>{cta("記錄 Delivery", () => { const o = parseJson("deliveryJson"); if (o) void action("save-delivery", { delivery: o }, "Delivery 已記錄。"); }, false)}</div>
      </div>)}
        {sub("Intervention／Control Final Versions", <p style={{ fontSize: 11, margin: 0 }}>每場 Delivery 必須引用已鎖定版本；自適應組（G1）的 Adaptation Events／Interruptions 一併記錄。</p>)}
      </div>}

      {tab === "administration" && <div>{sub("Instrument Administration（版本＋時間點＋完成度）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {smallInput("admCode", "participantCode", 130)} {smallInput("admInst", "instrument_id", 200)} {smallInput("admVer", "instrument_version", 110)} {smallInput("admTp", "timePoint（T1/T2）", 90)}
        {cta("建立施測", () => void action("save-administration", { administration: { participantCode: drafts.admCode, instrumentId: drafts.admInst, instrumentVersion: drafts.admVer, timePoint: drafts.admTp, administrationMode: "SELF_REPORT", consentCoverage: true } }, "施測已建立。"), false)}
      </div>)}
        {hint("完成後需逐題檢查 Missing Items；未納入 Consent 覆蓋之工具不得施測。")}
      </div>}

      {tab === "forms" && <div>{sub("電子表單提交（Source Data 不覆寫）", <div>
        {jsonBox("formJson", '{ "formType": "BASELINE", "formVersion": "v1", "participantCode": "P01", "sessionId": "", "payload": { "q1": 3 } }', 3)}
        <div style={{ marginTop: 4 }}>{cta("提交表單", () => { const o = parseJson("formJson"); if (o) void action("submit-form", { submission: o }, "表單已提交（SOURCE）。"); }, false)}</div>
      </div>)}
        {sub("Correction Record（原始值保留，Addendum＋來源確認）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {smallInput("corrId", "original_record_id", 220)} {smallInput("corrBad", "incorrect_value", 110)} {smallInput("corrGood", "corrected_value", 110)} {smallInput("corrWhy", "reason", 180)}
          {cta("建立更正", () => void action("create-correction", { correction: { originalRecordId: drafts.corrId, incorrectValue: drafts.corrBad, correctedValue: drafts.corrGood, reason: drafts.corrWhy, correctedBy: "coordinator", sourceConfirmation: "待確認" } }, "更正已記錄（原值保留）。"), false)}
        </div>)}
      </div>}

      {tab === "qualitative" && <div>{sub("訪談／觀察／質性蒐集（逐字稿去識別狀態追蹤）", <div>
        {jsonBox("qualJson", '{ "participantCode": "P01", "sessionId": "", "guideVersion": "v1", "interviewer": "R1", "recordingConsent": true, "audioReference": "audio/…", "fieldNoteReference": "notes/…" }')}
        <div style={{ marginTop: 4 }}>{cta("記錄質性蒐集", () => { const o = parseJson("qualJson"); if (o) void action("record-qualitative", { record: o }, "質性蒐集已記錄。"); }, false)}</div>
      </div>)}
        <p className="v13-muted" style={{ fontSize: 10 }}>Transcript：NOT_STARTED→IN_PROGRESS→COMPLETE；De-identification 完成前不得匯入分析資料集。</p>
      </div>}

      {tab === "sensors" && <div>{sub("Sensor 蒐集（眼動/HR/加速度…逐檔 metadata＋checksum）", <div>
        {jsonBox("sensorJson", '{ "participantCode": "P01", "sessionId": "", "sensorKey": "EYE_TRACKING_1", "deviceSerial": "EYE-001", "samplingRate": "60Hz", "calibrationStatus": "CALIBRATED", "rawFileReference": "sensors/…", "checksum": "sha256:…", "qualityFlag": "OK" }')}
        <div style={{ marginTop: 4 }}>{cta("記錄 Sensor 蒐集", () => { const o = parseJson("sensorJson"); if (o) void action("record-sensor", { record: o }, "Sensor 已記錄。"); }, false)}</div>
      </div>)}
        {sub("System Log Batch（Event Dictionary 版本＋event_count）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {smallInput("logCode", "participantCode", 130)} {smallInput("logRef", "raw_log_reference", 220)} {smallInput("logVer", "event_dictionary_version", 150)}
          {cta("記錄 Log Batch", () => void action("record-log-batch", { batch: { participantCode: drafts.logCode, rawLogReference: drafts.logRef, eventDictionaryVersion: drafts.logVer || "v1", eventCount: 0 } }, "Log Batch 已接收。"), false)}
        </div>)}
        {sub("AI Experiment Run（模型/程式/資料版本＋split＋seed）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {smallInput("aiRun", "run_id", 220)} {smallInput("aiModel", "model_version", 180)}
          {cta("註冊 AI Run", () => void action("record-ai-run", { run: { runId: drafts.aiRun, modelVersion: drafts.aiModel, runStatus: "CREATED" } }, "AI Run 已註冊。"), false)}
        </div>)}
      </div>}

      {tab === "ingestion" && <div>{sub("Data Ingestion Batch（不可為匯入成功而改寫原始內容）", <div>
        {jsonBox("ingestJson", '{ "sourceType": "CSV_EXPORT", "sourceFiles": ["forms/p01.csv"], "protocolVersion": "v2.0 Final", "dataSchemaVersion": "v1", "importedBy": "dm" }')}
        <div style={{ marginTop: 4 }}>{cta("建立 Ingestion Batch", () => { const o = parseJson("ingestJson"); if (o) void action("create-ingestion", { batch: o }, "Ingestion Batch 已建立。"); }, false)}</div>
      </div>)}
        <p className="v13-muted" style={{ fontSize: 10 }}>驗證失敗→QUARANTINE；不得自動修改原始內容以符合 schema。Secondary／Field Data 亦由此路徑進入（附 protocol/schema 版本）。</p>
      </div>}

      {tab === "raw" && <div>{sub("Raw Data Asset 登錄（Pilot/Synthetic 不得混入；逐檔 checksum）", <div>
        {jsonBox("assetJson", '{ "dataType": "QUESTIONNAIRE", "dataLayer": "RESEARCH_RAW", "source": "量表 T1", "participantOrUnitScope": "P01", "fileName": "p01_t1_scale.csv", "fileFormat": "csv", "checksum": "sha256:…", "storageLocation": "…" }')}
        <div style={{ marginTop: 4 }}>{cta("登錄 Raw Asset", () => { const o = parseJson("assetJson"); if (o) void action("register-asset", { asset: o }, "Raw 資產已登錄（CAPTURING）。"); }, false)}</div>
      </div>)}
        {sub("Freeze／Lock（兩階段保護）", <div className="research-actions" style={{ gap: 6 }}>
          {cta("Freeze Raw Data", () => void action("freeze-raw", {}, "Raw 已 Freeze。"))}
          {cta("Lock Raw Data（不可再修改）", () => void action("lock-raw", {}, "Raw 已 Lock。"), false)}
        </div>)}
        {hint(`資產：${join(data?.assets, ["data_type", "status"])}`)}
        <p className="v13-muted" style={{ fontSize: 10 }}>10 層分層：Identity／Research Raw／Sensor／System Log／Qualitative／Field 環境／AI Output／Administrative／Consent & Ethics／Operational Monitoring——Pilot 與 Formal 使用不同 dataset_type／storage_path／access_policy／manifest，不得混合。</p>
      </div>}

      {tab === "fidelity" && <div>{sub("Fidelity Monitoring（介入忠實度＋Session 活動完成＋偏差掛勾）", <p style={{ fontSize: 11, margin: 0 }}>fidelity_status ∈ WITHIN_PROTOCOL／MINOR_DEVIATION／MAJOR_DEVIATION／UNACCEPTABLE；MAJOR 以上需連動 Protocol Deviation 紀錄。完成度：Session {count(data?.sessions)}、活動 {count(extras?.sessionActivities)}、Deviation {count(data?.deviations)}。</p>)}
        <div className="v13-subsection-divider" />
        {sub("完成度缺口導向", <ul style={{ fontSize: 11, margin: 0, paddingLeft: 16 }}>{(data?.sessions ?? []).filter((s) => string(s.completionStatus) !== "COMPLETE" && !["MISSED", "WITHDRAWN", "INVALID"].includes(string(s.status))).length > 0 ? <li>有未完成 Session → 到 Session 分頁補齊或標 MISSED</li> : <li>✓ 無未完成 Session</li>}{count(data?.assets) === 0 ? <li>尚無 Raw Asset → 到 Raw Data 分頁登錄</li> : <li>✓ Raw 資產已登錄</li>}</ul>)}
      </div>}

      {tab === "followup" && <div>{sub("Follow-up（時間點＋window＋完成/失訪）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {smallInput("fuCode", "participantCode", 130)} {smallInput("fuTp", "planned_time_point（T2）", 130)} {smallInput("fuWin", "allowable_window", 130)} {smallInput("fuDate", "completion_date", 160)}
        <select style={{ fontSize: 11 }} value={string(drafts.fuStatus, "PENDING")} onChange={(e) => setD("fuStatus", e.target.value)}>{["PENDING", "COMPLETED", "MISSED", "RESCHEDULED", "WITHDRAWN"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
        {cta("儲存 Follow-up", () => void action("save-follow-up", { followUp: { participantCode: drafts.fuCode, plannedTimePoint: drafts.fuTp, allowableWindow: drafts.fuWin, completionDate: drafts.fuDate, completionStatus: drafts.fuStatus, dataCaptured: drafts.fuStatus === "COMPLETED" } }, "Follow-up 已儲存。"), false)}
      </div>)}
        {sub("Withdrawal（資料移除請求→正式 Data Query，不自行刪除 Raw）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {smallInput("wdCode", "participantCode", 130)} {smallInput("wdReason", "reason_category", 200)}
          <label style={{ fontSize: 11 }}><input type="checkbox" checked={bool(drafts.wdRemove)} onChange={(e) => setD("wdRemove", e.target.checked)} /> 請求移除資料</label>
          {cta("記錄退出", () => void action("record-withdrawal", { withdrawal: { participantCode: drafts.wdCode, reasonCategory: drafts.wdReason, participantRequestedDataRemoval: bool(drafts.wdRemove), safetyFollowupRequired: true } }, "退出已記錄（狀態→WITHDRAWN）。"), false)}
        </div>)}
        {hint(`Follow-up：${join(extras?.followUps, ["participantCode", "plannedTimePoint", "completionStatus"])}｜退出：${join(extras?.withdrawals, ["participantCode", "reasonCategory"])}`)}
      </div>}

      {tab === "safety" && <div>{sub("Protocol Deviation／Adverse Event（重大 AE 自動 Pause）", <div>
        {jsonBox("safetyJson", '{ "kind": "deviation", "participantCode": "P01", "affectedSection": "Consent", "severity": "MAJOR", "plannedAction": "…", "actualAction": "…" } 或 { "kind": "ae", "participantCode": "P01", "eventType": "頭暈", "severity": "SEVERE", "description": "…" }')}
        <div style={{ marginTop: 4 }}>{cta("記錄偏差／不良事件", () => { const o = parseJson("safetyJson"); if (!o) return; if (o.kind === "ae") void action("record-adverse-event", { event: o }); else void action("record-deviation", { deviation: o }); }, false)}</div>
      </div>)}
        {sub("Data Query（不得直接改 Raw 來消除 Query）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {smallInput("qIssue", "issue", 260)} {smallInput("qRec", "source_record", 200)}
          <select style={{ fontSize: 11 }} value={string(drafts.qSev, "MINOR")} onChange={(e) => setD("qSev", e.target.value)}>{["MINOR", "MODERATE", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          {cta("建立 Query", () => void action("create-query", { query: { issue: drafts.qIssue, sourceRecord: drafts.qRec, issueType: "DATA_ISSUE", severity: drafts.qSev } }, "Query 已建立。"), false)}
        </div>)}
        {hint(`Adverse：${join(data?.adverseEvents, ["event_type", "severity"])}｜Deviation：${count(data?.deviations)}｜Query：${(data?.queries ?? []).filter((qq) => ["OPEN", "IN_PROGRESS"].includes(string(qq.resolutionStatus))).length} open`)}
      </div>}

      {tab === "amendments" && <div>{sub("Amendment（重大變更→Submit→Approve；reconsent/retraining 自動觸發）", <div>
        {jsonBox("amJson", '{ "changeRequest": "Sample Size 變更 60→72", "scientificReason": "…", "operationalReason": "…", "ethicsImpact": "需倫理審查變更", "affectedDocuments": ["Protocol v2.0"], "reconsentRequired": true, "retrainingRequired": false }')}
        <div style={{ marginTop: 4 }}>{cta("建立 Amendment（DRAFT）", () => { const o = parseJson("amJson"); if (o) void action("create-amendment", { amendment: o }, "Amendment 草稿已建立。"); }, false)}</div>
      </div>)}
        {extras?.amendments && extras.amendments.length > 0 && sub("Amendment 清單", <div style={{ display: "grid", gap: 4, fontSize: 11 }}>{extras.amendments.map((a) => <div key={string(a.id)} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{string(a.changeRequest)} <span className="v13-muted">({string(a.approvalStatus)}{bool(a.reconsentRequired) ? "／需重同意" : ""})</span></span>
          <span>{string(a.approvalStatus) === "DRAFT" ? cta("Submit", () => void action("submit-amendment", { amendmentId: string(a.id) }, "已送出審核。"), false) : string(a.approvalStatus) === "SUBMITTED" ? cta("核准", () => void action("approve-amendment", { amendmentId: string(a.id) }, "Amendment 已核准（重同意/再訓練已自動標記）。"), false) : null}</span></div>)}</div>)}
        {sub("Pause／Resume（SAFETY_PAUSE 或研究者發起）", <div className="research-actions" style={{ gap: 6 }}>
          {cta("暫停研究", () => void action("pause-study", { pauseType: "SAFETY_PAUSE", reason: "研究者發起暫停" }, "研究已暫停。"), false)}
          {cta("恢復研究", () => void action("resume-study", { resume: { reason: "研究者核准恢復", authority: "PI" } }, "研究已恢復。"), false)}
        </div>)}
        {hint(`Pause 紀錄：${join(extras?.pauseRecords, ["pauseType", "reason"])}`)}
      </div>}

      {tab === "closeout" && <div>{sub("DATA COLLECTION CLOSEOUT｜REPORT｜SNAPSHOT｜AVAILABILITY", <div className="research-actions" style={{ gap: 6, flexWrap: "wrap" }}>
        {cta("Closeout 檢查", () => void action("run-closeout", {}, "Closeout 檢查完成。"), false)}
        {cta("確認結案", () => void action("confirm-closeout", {}, "DATA_COLLECTION_CLOSED。"), false)}
        {cta("Formal Report v1.0", () => void action("generate-report", {}, "報告已建立（僅執行描述）。"), false)}
        {cta("Availability 檢查", () => void action("run-availability", {}, "Availability 檢查完成。"), false)}
        {cta("Execution Snapshot", () => void action("create-snapshot", {}, "Research Execution Snapshot v1.0 已建立。"))}
      </div>)}
        <p className="v13-muted" style={{ fontSize: 10, marginTop: 4 }}>Closeout：{data?.closeout?.status ?? "CLOSEOUT_NOT_STARTED"}。報告不含組間差異或統計結論；Availability 對照 Analysis Plan 必要變數。</p>
        <div className="v13-subsection-divider" />
        {sub("Phase 10 完成檢查清單（系統只導向、不代答）", <ul style={{ fontSize: 11, margin: 0, paddingLeft: 16 }}>
          <li>Recruitment 已 CLOSED 且記錄最終數字</li><li>所有 Session 完成或正式狀態（MISSED/WITHDRAWN/INVALID）</li>
          <li>Follow-up 完成或失訪已記錄</li><li>Raw Data Manifest 完整（checksum 齊）</li>
          <li>Data Queries 全部解決或正式保留（無 CRITICAL open）</li><li>PI 及 Data Manager 核准 Raw Data Lock（Gate4）</li>
          <li>Research Execution Snapshot v1.0 已建立</li>
        </ul>)}
        {gates.RAW_DATA_LOCKED_AND_HANDOFF_READY && onNavigate && <div style={{ marginTop: 8 }}>{cta("→ 前往資料治理與 Analysis Dataset 中心（下一階段）", () => onNavigate("governance"), true)}</div>}
      </div>}
    </div>
  );
}
