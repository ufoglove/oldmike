"use client";

import { useCallback, useEffect, useState } from "react";

type PilotData = {
  ok?: boolean; locked?: boolean; missing?: string[];
  study?: { id: string; status: string; applicability: Record<string, unknown>; combinationStatus: string; version: number } | null;
  components?: Record<string, unknown>[]; criteria?: Record<string, unknown>[];
  authorization?: { id: string; checks: Record<string, unknown>[]; status: string; checkedAt: string } | null;
  sessions?: Record<string, unknown>[]; datasets?: Record<string, unknown>[];
  interviews?: Record<string, unknown>[]; pretests?: Record<string, unknown>[]; technical?: Record<string, unknown>[];
  sensors?: Record<string, unknown>[]; logs?: Record<string, unknown>[]; ai?: Record<string, unknown>[]; interventions?: Record<string, unknown>[];
  recruitment?: Record<string, unknown> | null; deviations?: Record<string, unknown>[]; adverseEvents?: Record<string, unknown>[];
  issues?: Record<string, unknown>[]; revisionTasks?: Record<string, unknown>[]; materialChanges?: Record<string, unknown>[];
  ethicsAmendments?: Record<string, unknown>[]; decision?: { id: string; decision: string; rationale: string | null; userApproved: boolean; approvedAt: string | null } | null;
  report?: { id: string; sections: Record<string, unknown>; version: string } | null;
  validationItems?: Record<string, unknown>[]; readiness?: { id: string; checks: Record<string, unknown>[]; status: string } | null;
  training?: Record<string, unknown>[]; gates?: Record<string, boolean>; protocol?: { id: string; status: string; version: number } | null;
  error?: string;
};

const string = (v: unknown, fb = ""): string => typeof v === "string" ? v : fb;
const num = (v: unknown, fb = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

const STATUS_LABELS: Record<string, string> = { NOT_STARTED: "未開始", PLANNING: "規劃中", AUTHORIZATION_REQUIRED: "需授權", READY_TO_START: "可開始", IN_PROGRESS: "執行中", PAUSED: "暫停", PAUSED_FOR_SAFETY_REVIEW: "安全審查暫停", DATA_REVIEW: "資料檢視", REVISION_REQUIRED: "需修訂", REPEAT_REQUIRED: "需重複", COMPLETED: "已完成", WAIVED: "豁免", CANCELLED: "取消", OUTDATED: "過期" };

type Tab = "overview" | "applicability" | "plan" | "authorization" | "execute" | "results" | "data" | "issues" | "decision" | "protocol" | "readiness" | "report";

export default function PilotValidationCenter({ projectId, onOpenEvidence }: { projectId: string; onOpenEvidence?: (role?: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [data, setData] = useState<PilotData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/pilot-protocol-validation`, { cache: "no-store" });
      const json = await res.json() as PilotData;
      if (!res.ok || json.ok === false) throw new Error(json.error || "無法載入 Pilot 中心。");
      setData(json);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "載入失敗。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function action(name: string, body: Record<string, unknown>, success?: string) {
    setError(""); setBusy(name);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/pilot-protocol-validation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const payload = await res.json() as { ok?: boolean; error?: string; failed?: { key: string; label: string; detail?: string }[]; checks?: Record<string, unknown>[] };
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "操作失敗。");
      if (success) setNotice(success);
      await load();
      return payload;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); return null; }
    finally { setBusy(""); }
  }

  if (loading) return <div className="v13-panel" style={{ marginTop: 10 }}><p className="v13-muted" role="status">載入中…</p></div>;
  if (data?.locked) {
    return <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">前導研究與方案驗證 · 09</p><h3>Pilot 與 Protocol 驗證中心</h3></div></div>
      <div className="v13-empty"><strong>PILOT_CENTER_LOCKED</strong><ul>{(data.missing ?? []).map((m) => <li key={m}>{m}</li>)}</ul><p>正式執行 Pilot 前另需通過 PILOT_EXECUTION_AUTHORIZED；不得因 Protocol 完成即允許招募。</p></div>
    </div>;
  }

  const study = data?.study;
  const gates = data?.gates ?? {};
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "總覽" }, { id: "applicability", label: "Pilot 適用性" }, { id: "plan", label: "計畫與成功標準" },
    { id: "authorization", label: "執行授權" }, { id: "execute", label: "Session／紀錄" }, { id: "results", label: "預試與技術結果" },
    { id: "data", label: "Pilot 資料" }, { id: "issues", label: "Issue／Safety" }, { id: "decision", label: "Pilot Decision" },
    { id: "protocol", label: "Protocol v2" }, { id: "readiness", label: "Formal Readiness" }, { id: "report", label: "Pilot Report" },
  ];

  return (
    <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">前導研究與方案驗證 · 09</p><h3>Pilot 與 Protocol 驗證中心</h3></div><p className="v13-panel-note">核心是確認工具能用、流程跑得動、資料收得到、參與者理解、系統穩定；Pilot 結果只用於可行性與工具品質判斷，<strong>不得宣稱正式研究效果成立</strong>。所有結果標 PILOT／PRELIMINARY／NOT CONFIRMATORY。</p></div>
      {error && <p className="v13-error" role="alert">{error}</p>}
      {notice && <p className="v13-notice" role="status">{notice}</p>}
      {study && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <span className="v13-badge" style={{ background: study.status === "PAUSED_FOR_SAFETY_REVIEW" ? "#f5e6ce" : "#e7ebe7", color: study.status === "PAUSED_FOR_SAFETY_REVIEW" ? "#9b5d16" : "var(--muted)" }}>Pilot：{STATUS_LABELS[study.status] ?? study.status}</span>
        <span className="v13-badge">資料合併：{study.combinationStatus}</span>
        <span className="v13-badge" style={{ background: gates.PILOT_EXECUTION_AUTHORIZED ? "#e0efe5" : "#e7ebe7", color: gates.PILOT_EXECUTION_AUTHORIZED ? "#2f6f4f" : "var(--muted)" }}>執行授權：{gates.PILOT_EXECUTION_AUTHORIZED ? "AUTHORIZED ✓" : "未核准"}</span>
        <span className="v13-badge" style={{ background: gates.PILOT_AND_PROTOCOL_VALIDATED ? "#e0efe5" : "#e7ebe7", color: gates.PILOT_AND_PROTOCOL_VALIDATED ? "#2f6f4f" : "var(--muted)" }}>驗證 Gate：{gates.PILOT_AND_PROTOCOL_VALIDATED ? "✓" : "—"}</span>
        <span className="v13-badge">Protocol：{data?.protocol?.status ?? "—"} v{num(data?.protocol?.version)}</span>
        <span className="v13-badge" style={{ background: data?.readiness?.status === "APPROVED_FOR_FORMAL_STUDY" ? "#e0efe5" : "#e7ebe7" }}>Formal Readiness：{data?.readiness?.status ?? "NOT_READY"}</span>
      </div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>{tabs.map((t) => <button key={t.id} type="button" className={tab === t.id ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>

      {tab === "overview" && <div style={{ display: "grid", gap: 6 }}>
        <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">存取</p><strong>planning_access：{gates.PILOT_EXECUTION_AUTHORIZED ? "完整（可執行）" : "規劃（可建計畫/標準，不可招募）"}</strong><p className="v13-muted" style={{ fontSize: 11 }}>進入本階段需 INSTRUMENTS_AND_PROTOCOL_APPROVED；正式執行需 PILOT_EXECUTION_AUTHORIZED。Human-participant Pilot Session 未授權時系統直接拒絕建立。</p>
          <div className="research-actions" style={{ marginTop: 6 }}><button type="button" className="secondary-button" onClick={() => { setTab("authorization"); }}>檢查執行授權 →</button><button type="button" className="secondary-button" onClick={() => setTab("plan")}>建立 Pilot 計畫 →</button></div>
        </div>
        <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">摘要</p><div className="v13-progress-grid">
          <div><small>Components</small><strong>{(data?.components ?? []).length}</strong></div>
          <div><small>Success Criteria</small><strong>{(data?.criteria ?? []).length}</strong></div>
          <div><small>Sessions</small><strong>{(data?.sessions ?? []).length}</strong></div>
          <div><small>Datasets</small><strong>{(data?.datasets ?? []).length}（分離保存）</strong></div>
          <div><small>Open Issues</small><strong>{(data?.issues ?? []).filter((i) => string(i.status) === "OPEN").length}</strong></div>
          <div><small>Deviations</small><strong>{(data?.deviations ?? []).length}</strong></div>
          <div><small>Adverse Events</small><strong>{(data?.adverseEvents ?? []).length}</strong></div>
          <div><small>Pilot Decision</small><strong>{data?.decision ? `${data.decision.decision}${data.decision.userApproved ? "（已核准）" : ""}` : "—"}</strong></div>
        </div></div>
        <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">下一步</p><div className="research-actions" style={{ gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="secondary-button" onClick={() => void action("generate-report", {}, "Pilot Report 已產生（只彙整既有資料，不虛構）。")}>產生 Pilot Report</button>
          <button type="button" className="secondary-button" onClick={() => void action("create-protocol-v2", {}, "Study Protocol v2.0 Final 已建立（v1.0 保留）。")}>建立 Study Protocol v2.0</button>
          <button type="button" className="secondary-button" onClick={() => void action("run-readiness", {}, "Formal Study Readiness 已檢查。")}>執行 Formal Readiness Check</button>
          <button type="button" className="secondary-button" onClick={() => void action("write-blueprint-study-ready", {}, "Blueprint Study-Ready 已回寫（新版本，不覆蓋）。")}>回寫 Blueprint Study-Ready</button>
        </div>
        </div>
        <p className="v13-muted" style={{ fontSize: 11, marginTop: 6 }}>Gate：PILOT_EXECUTION_AUTHORIZED → PILOT_AND_PROTOCOL_VALIDATED → FORMAL_STUDY_EXECUTION_READY（通過後解鎖「正式研究與資料蒐集」，不代表研究已開始）。</p>
        <div className="research-actions" style={{ gap: 6, marginTop: 4 }}>
          {!gates.PILOT_EXECUTION_AUTHORIZED && <button type="button" className="primary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", { gateType: "PILOT_EXECUTION_AUTHORIZED" }, "PILOT_EXECUTION_AUTHORIZED 已核准（Gate 全過）。")}>核准 Gate 1：PILOT_EXECUTION_AUTHORIZED</button>}
          {gates.PILOT_EXECUTION_AUTHORIZED && !gates.PILOT_AND_PROTOCOL_VALIDATED && <button type="button" className="primary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", { gateType: "PILOT_AND_PROTOCOL_VALIDATED" }, "PILOT_AND_PROTOCOL_VALIDATED 已核准（Gate 全過）。")}>核准 Gate 2：PILOT_AND_PROTOCOL_VALIDATED</button>}
          {gates.PILOT_AND_PROTOCOL_VALIDATED && <button type="button" className="primary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", { gateType: "FORMAL_STUDY_EXECUTION_READY" }, "FORMAL_STUDY_EXECUTION_READY 已核准 → 解鎖正式研究（不代表已開始蒐集）。")}>核准 Gate 3：FORMAL_STUDY_EXECUTION_READY</button>}
        </div>
      </div>}

      {tab === "applicability" && <div>
        <p className="v13-muted" style={{ fontSize: 11 }}>Pilot Applicability Assessment：依研究內容判斷各類 Pilot 需要程度（不強迫相同 Pilot；豁免須有科學理由，不得只用「時間不足」）。</p>
        <textarea rows={5} style={{ width: "100%", marginTop: 8, fontSize: 11 }} placeholder='{"INSTRUMENT_PRETEST": "REQUIRED（新編工具需預試）", "KNOWLEDGE_TEST_PRETEST": "RECOMMENDED", "TECHNICAL_DRY_RUN": "REQUIRED", "COGNITIVE_INTERVIEW": "REQUIRED", "SENSOR_CALIBRATION_PILOT": "OPTIONAL", "WAIVER_JUSTIFICATION": ""}' value={string(drafts.applicability)} onChange={(e) => setDrafts((d) => ({ ...d, applicability: e.target.value }))} />
        <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => { try { void action("set-applicability", { applicability: JSON.parse(string(drafts.applicability) || "{}") }, "Pilot 適用性已儲存。"); } catch { setError("JSON 格式錯誤"); } }}>判斷 Pilot 適用性</button>
      </div>}

      {tab === "plan" && <div>
        <p className="v13-muted" style={{ fontSize: 11 }}>建立 Pilot 計畫組件（不自動套用固定樣本數；樣本規劃需依目的/工具/風險/文獻/專家判斷說明）。Human-participant 組件執行需授權。</p>
        <div className="v13-panel" style={{ padding: 12, marginTop: 6 }}>
          <select style={{ fontSize: 11 }} value={string(drafts.pilotType, "INSTRUMENT_PRETEST")} onChange={(e) => setDrafts((d) => ({ ...d, pilotType: e.target.value }))}>{["COGNITIVE_INTERVIEW", "EXPERT_CONTENT_REVIEW", "INSTRUMENT_PRETEST", "KNOWLEDGE_TEST_PRETEST", "SKILL_RUBRIC_PRETEST", "INTERVIEW_GUIDE_PRETEST", "USABILITY_PILOT", "TECHNICAL_DRY_RUN", "SENSOR_CALIBRATION_PILOT", "SYSTEM_LOG_VALIDATION", "DATA_PIPELINE_VALIDATION", "INTERVENTION_FEASIBILITY_PILOT", "CONTROL_CONDITION_PILOT", "MANIPULATION_CHECK_PILOT", "FIDELITY_PILOT", "RECRUITMENT_PILOT", "PARTICIPANT_BURDEN_PILOT", "AI_MODEL_PIPELINE_PILOT", "COURSE_IMPLEMENTATION_PILOT", "OTHER"].map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <input style={{ fontSize: 11, width: "100%", marginTop: 4 }} placeholder="組件名稱" value={string(drafts.name)} onChange={(e) => setDrafts((d) => ({ ...d, name: e.target.value }))} />
          <textarea rows={3} style={{ width: "100%", marginTop: 4, fontSize: 11 }} placeholder='objectives（明確目標 JSON 陣列，例如 [\"確認學生是否理解量表題意\"]）' value={string(drafts.objectives)} onChange={(e) => setDrafts((d) => ({ ...d, objectives: e.target.value }))} />
          <textarea rows={2} style={{ width: "100%", marginTop: 4, fontSize: 11 }} placeholder="sampleRationale 樣本規劃說明" value={string(drafts.sampleRationale)} onChange={(e) => setDrafts((d) => ({ ...d, sampleRationale: e.target.value }))} />
          <textarea rows={2} style={{ width: "100%", marginTop: 4, fontSize: 11 }} placeholder="procedures 程序說明" value={string(drafts.procedures)} onChange={(e) => setDrafts((d) => ({ ...d, procedures: e.target.value }))} />
          <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => { try { void action("save-component", { component: { pilotType: drafts.pilotType, name: drafts.name, objectives: JSON.parse(string(drafts.objectives) || "[]"), sampleRationale: drafts.sampleRationale, procedures: drafts.procedures } }, "Pilot 組件已儲存。"); } catch { setError("objectives JSON 格式錯誤"); } }}>儲存組件</button>
        </div>
        <p className="v13-muted" style={{ fontSize: 11, marginTop: 8 }}>Success Criteria Registry（threshold_basis 無依據時為 PROVISIONAL_THRESHOLD）：</p>
        <textarea rows={3} style={{ width: "100%", fontSize: 11 }} placeholder='[{ "criterionKey": "COMPLETION_RATE", "pilotObjective": "確認流程可完成", "metric": "Completion Rate", "threshold": "≥80%", "thresholdBasis": "Expert Decision", "severityIfFailed": "MAJOR" }, { "criterionKey": "SESSION_DURATION", "metric": "Session Duration", "threshold": "≤60 分鐘", "thresholdBasis": "PROVISIONAL_THRESHOLD" }]' value={string(drafts.criteria)} onChange={(e) => setDrafts((d) => ({ ...d, criteria: e.target.value }))} />
        <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => { try { void action("save-criteria", { criteria: JSON.parse(string(drafts.criteria) || "[]") }, "Success Criteria 已儲存（執行前定義）。"); } catch { setError("JSON 格式錯誤"); } }}>設定 Success Criteria</button>
      </div>}

      {tab === "authorization" && <div>
        <div className="research-actions" style={{ gap: 6, marginBottom: 8 }}><button type="button" className="primary-button" disabled={busy === "run-authorization"} onClick={() => void action("run-authorization", {}, "Pilot 執行授權檢查完成。")}>檢查 Pilot 執行授權（15 項）</button></div>
        {data?.authorization && <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">AUTHORIZATION：{data.authorization.status}</p>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>{(data.authorization.checks ?? []).map((c, idx) => <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, padding: "3px 0", borderBottom: "1px solid #eef2ef" }}><span><strong>[{c.pass ? "✓" : "✗"}]</strong> {string(c.label)}</span><span className="v13-muted">{string(c.detail)}</span></div>)}</div>
        </div>}
      </div>}

      {tab === "execute" && <div>
        <p className="v13-muted" style={{ fontSize: 11 }}>建立 Pilot Session：Human-participant 需 PILOT_EXECUTION_AUTHORIZED（未授權時系統拒絕）；Technical Dry Run 可用 Synthetic Data（標記 SYNTHETIC_TEST_DATA，不得與真實資料混合）。</p>
        <div className="v13-panel" style={{ padding: 12, marginTop: 6 }}>
          <select style={{ fontSize: 11 }} value={string(drafts.sessionType, "HUMAN")} onChange={(e) => setDrafts((d) => ({ ...d, sessionType: e.target.value }))}><option value="HUMAN">HUMAN（人體參與者）</option><option value="TECHNICAL">TECHNICAL（技術/合成）</option></select>
          <label style={{ fontSize: 11, marginLeft: 8 }}><input type="checkbox" checked={drafts.synthetic === true} onChange={(e) => setDrafts((d) => ({ ...d, synthetic: e.target.checked }))} /> Synthetic Test Data（SYNTHETIC_TEST_DATA）</label>
          <input style={{ fontSize: 11, width: "100%", marginTop: 4 }} placeholder="participantCode（人體 Pilot 用匿名代碼；不存直接識別資料）" value={string(drafts.participantCode)} onChange={(e) => setDrafts((d) => ({ ...d, participantCode: e.target.value }))} />
          <input style={{ fontSize: 11, width: "100%", marginTop: 4 }} placeholder="protocolVersion（例：v1.0）" value={string(drafts.protocolVersion)} onChange={(e) => setDrafts((d) => ({ ...d, protocolVersion: e.target.value }))} />
          <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => void action("create-session", { session: { sessionType: drafts.sessionType, synthetic: drafts.synthetic === true, participantCode: drafts.synthetic === true ? undefined : drafts.participantCode, protocolVersion: drafts.protocolVersion } }, "Pilot Session 已建立（SCHEDULED）。")}>建立 Pilot Session</button>
        </div>
        <p className="v13-muted" style={{ fontSize: 11, marginTop: 8 }}>現有 Sessions：{(data?.sessions ?? []).length === 0 ? "無" : (data?.sessions ?? []).map((s) => `${string(s.id).slice(0, 8)} ${string(s.sessionType)}${s.synthetic ? "（SYNTHETIC）" : ""} ${string(s.status)}`).join(" ｜ ")}</p>
      </div>}

      {tab === "results" && <div>
        <div className="v13-panel" style={{ padding: 12 }}>
          <p className="section-kicker">認知訪談／預試／技術／Sensor／Log 紀錄（全部必須來自真實輸入）</p>
          <select style={{ fontSize: 11 }} value={string(drafts.recordKind, "INTERVIEW")} onChange={(e) => setDrafts((d) => ({ ...d, recordKind: e.target.value }))}><option value="INTERVIEW">認知訪談</option><option value="PRETEST">工具/測驗預試</option><option value="TECHNICAL">系統/可用性測試</option><option value="SENSOR">Sensor 測試</option><option value="LOG">Event Log 驗證</option><option value="INTERVENTION">介入/忠實度</option><option value="AI">AI 系統</option></select>
          <textarea rows={3} style={{ width: "100%", marginTop: 4, fontSize: 11 }} placeholder={string(drafts.recordKind) === "INTERVIEW" ? '{"itemRef": "ITEM_1", "comprehensionIssue": "學生誤解「常常」頻率", "severity": "MAJOR_REVISION", "suggestedRevision": "改為具體次數"}' : string(drafts.recordKind) === "PRETEST" ? '{"resultKind": "INSTRUMENT_PRETEST", "metricKey": "COMPLETION_TIME", "metricValue": 18, "status": "SUITABLE_FOR_PILOT_USE"}' : string(drafts.recordKind) === "TECHNICAL" ? '{"testCase": "登入流程", "expectedBehavior": "30 秒內可登入", "observedBehavior": "正常", "passStatus": "PASS"}' : string(drafts.recordKind) === "SENSOR" ? '{"sensorKey": "EYE_TRACKING_1", "metricKey": "SAMPLE_RATE", "expectedValue": "120Hz", "observedValue": "119Hz", "passStatus": "PASS"}' : string(drafts.recordKind) === "LOG" ? '{"eventId": "HAZARD_CLICK", "observedCount": 45, "expectedCount": 45, "analysisVariableSupported": true, "status": "PASS"}' : string(drafts.recordKind) === "INTERVENTION" ? '{"resultKind": "INTERVENTION_FEASIBILITY", "sessionDurationOk": true, "status": "PASS"}' : '{"modelVersion": "v1", "metricKey": "LATENCY", "metricValue": 350, "humanReviewStatus": "REVIEWED"}'} value={string(drafts.recordJson)} onChange={(e) => setDrafts((d) => ({ ...d, recordJson: e.target.value }))} />
          <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => { try { const parsed = JSON.parse(string(drafts.recordJson) || "{}"); const kind = drafts.recordKind; const call = kind === "INTERVIEW" ? ["record-interview", { record: parsed }] : kind === "PRETEST" ? ["record-pretest", { result: parsed }] : kind === "TECHNICAL" ? ["record-technical", { run: parsed }] : kind === "SENSOR" ? ["record-sensor", { result: parsed }] : kind === "LOG" ? ["record-log", { result: parsed }] : kind === "INTERVENTION" ? ["record-intervention", { result: parsed }] : ["record-ai", { result: parsed }]; void action(call[0] as string, call[1] as Record<string, unknown>, "已記錄（PILOT／PRELIMINARY）。"); } catch { setError("JSON 格式錯誤"); } }}>記錄結果</button>
        </div>
        <p className="v13-muted" style={{ fontSize: 11, marginTop: 6 }}>已記錄：認知訪談 {(data?.interviews ?? []).length}｜預試 {(data?.pretests ?? []).length}｜技術 {(data?.technical ?? []).length}｜Sensor {(data?.sensors ?? []).length}｜Log {(data?.logs ?? []).length}｜介入 {(data?.interventions ?? []).length}｜AI {(data?.ai ?? []).length}。難度/鑑別度/信度只來自真實 Pilot 資料；無資料時保持 NOT_YET_TESTED。</p>
      </div>}

      {tab === "data" && <div>
        <p className="v13-muted" style={{ fontSize: 11 }}>Pilot 資料與正式研究分離（RAW 不可修改；RAW→CLEAN→ANALYSIS；Synthetic 標記）。預設 PILOT_DATA_SEPARATE；合併需 Combination Eligibility Review＋使用者核准＋完整 Audit Trail，不得自動合併。</p>
        <div className="v13-panel" style={{ padding: 12, marginTop: 6 }}>
          <select style={{ fontSize: 11 }} value={string(drafts.datasetType, "RAW")} onChange={(e) => setDrafts((d) => ({ ...d, datasetType: e.target.value }))}><option value="RAW">Pilot Raw Data（不可修改）</option><option value="CLEAN">Pilot Clean Data</option><option value="ANALYSIS">Pilot Analysis Data</option></select>
          <label style={{ fontSize: 11, marginLeft: 8 }}><input type="checkbox" checked={drafts.synthetic === true} onChange={(e) => setDrafts((d) => ({ ...d, synthetic: e.target.checked }))} /> Synthetic（SYNTHETIC_TEST_DATA）</label>
          <input style={{ fontSize: 11, width: "100%", marginTop: 4 }} placeholder="datasetName＋storageLocation（檔案 reference）" value={string(drafts.datasetName)} onChange={(e) => setDrafts((d) => ({ ...d, datasetName: e.target.value }))} />
          <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => void action("save-dataset", { dataset: { datasetType: drafts.datasetType, datasetName: drafts.datasetName, synthetic: drafts.synthetic === true, storageLocation: "server-side（見 Data Management Plan）" } }, "Pilot 資料集已登錄（分離保存；RAW 鎖定）。")}>登錄 Pilot 資料集</button>
        </div>
        <div className="v13-panel" style={{ padding: 12, marginTop: 6 }}><p className="section-kicker">COMBINATION（合併正式研究）目前：{study?.combinationStatus}</p>
          <div className="research-actions" style={{ gap: 6, marginTop: 4 }}>{["ELIGIBLE_FOR_COMBINATION_REVIEW", "APPROVED_FOR_COMBINATION", "NOT_ELIGIBLE", "SEPARATE"].map((d) => <button key={d} type="button" className="secondary-button" style={{ fontSize: 10 }} onClick={() => void action("combination-review", { decision: d, rationale: d === "APPROVED_FOR_COMBINATION" ? "使用者確認 10 項合併條件（見規格 §26）" : undefined }, `合併狀態：${d}`)}>{d}</button>)}</div>
          <p className="v13-muted" style={{ fontSize: 10, marginTop: 4 }}>合併條件：Protocol 無重大修改、Inclusion/Intervention/Measurement 一致、Ethics/Consent 允許、Analysis Plan 與 Preregistration 預先揭露、無已知偏差、使用者核准＋Audit Trail。</p>
        </div>
      </div>}

      {tab === "issues" && <div>
        <p className="v13-muted" style={{ fontSize: 11 }}>Protocol Deviation（MINOR/MAJOR/CRITICAL）與 Adverse Event（SEVERE/SERIOUS 自動 PAUSED_FOR_SAFETY_REVIEW＋Formal Study 鎖定）。重大事件不自動判定醫療因果。</p>
        <div className="v13-panel" style={{ padding: 12 }}>
          <textarea rows={2} style={{ width: "100%", fontSize: 11 }} placeholder='偏差或事件 JSON：{"type": "deviation", "protocolSection": "Consent", "severity": "MAJOR", "description": "…"} 或 {"type": "adverse", "eventType": "頭暈", "severity": "MODERATE", "description": "…"}' value={string(drafts.eventJson)} onChange={(e) => setDrafts((d) => ({ ...d, eventJson: e.target.value }))} />
          <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => { try { const parsed = JSON.parse(string(drafts.eventJson) || "{}"); if (parsed.type === "adverse") void action("record-adverse-event", { event: parsed }); else void action("record-deviation", { deviation: parsed }); } catch { setError("JSON 格式錯誤"); } }}>記錄偏差／不良事件</button>
        </div>
        <div style={{ display: "grid", gap: 4, marginTop: 8 }}>{(data?.deviations ?? []).map((dv) => <div key={string(dv.id)} style={{ fontSize: 11 }}>[{string(dv.severity)}] {string(dv.protocolSection)}｜{string(dv.status)}</div>)}</div>
        {(data?.adverseEvents ?? []).length > 0 && <div className="v13-error" style={{ marginTop: 6 }}>不良事件：{(data?.adverseEvents ?? []).map((e) => `${string(e.eventType)}(${string(e.severity)})`).join("、")} —— Pilot 狀態：{study?.status}</div>}
        <p className="v13-muted" style={{ fontSize: 11, marginTop: 8 }}>Material Change 分類（Primary Outcome／設計／介入等重大變更 → 上游重新檢查）：</p>
        <select style={{ fontSize: 11 }} value={string(drafts.changeType, "PRIMARY_OUTCOME_CHANGED")} onChange={(e) => setDrafts((d) => ({ ...d, changeType: e.target.value }))}>{["PRIMARY_OUTCOME_CHANGED", "RESEARCH_QUESTION_CHANGED", "CORE_CONSTRUCT_CHANGED", "DESIGN_CHANGED", "STUDY_ARM_CHANGED", "CONTROL_CHANGED", "TIMEPOINT_CHANGED", "POPULATION_CHANGED", "INTERVENTION_CHANGED", "ANALYSIS_MODEL_CHANGED", "SENSITIVE_DATA_ADDED", "SENSOR_RECORDING_AI_ADDED", "RISK_INCREASED"].map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <textarea rows={1} style={{ width: "100%", fontSize: 11, marginTop: 4 }} placeholder="變更描述" value={string(drafts.changeDesc)} onChange={(e) => setDrafts((d) => ({ ...d, changeDesc: e.target.value }))} />
        <button type="button" className="secondary-button" style={{ marginTop: 4 }} onClick={() => void action("assess-material-change", { changeType: drafts.changeType, description: drafts.changeDesc || "（待填）" }, "Material Change 已分類；上游模組已標記（不覆蓋版本）。")}>分類重大變更</button>
      </div>}

      {tab === "decision" && <div>
        <p className="v13-muted" style={{ fontSize: 11 }}>Pilot Decision 依預先定義 Success Criteria、Safety、工具品質、資料完整性、技術穩定、招募可行性、負擔、忠實度、偏差與分析就緒度判斷；不由總分自動決定，最終決策需使用者核准。</p>
        <select style={{ fontSize: 11 }} value={string(drafts.pilotDecision, "PROCEED_WITH_MINOR_REVISION")} onChange={(e) => setDrafts((d) => ({ ...d, pilotDecision: e.target.value }))}>{["PROCEED_WITHOUT_CHANGE", "PROCEED_WITH_MINOR_REVISION", "MAJOR_REVISION_REQUIRED", "REPEAT_PILOT_REQUIRED", "PARTIAL_PILOT_REPEAT_REQUIRED", "STOP_AND_REDESIGN", "PILOT_INCONCLUSIVE", "PILOT_WAIVED_WITH_JUSTIFICATION"].map((d) => <option key={d} value={d}>{d}</option>)}</select>
        <textarea rows={3} style={{ width: "100%", fontSize: 11, marginTop: 4 }} placeholder="理由（核准必填）" value={string(drafts.decisionRationale)} onChange={(e) => setDrafts((d) => ({ ...d, decisionRationale: e.target.value }))} />
        <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => void action("make-decision", { decision: drafts.pilotDecision, rationale: drafts.decisionRationale, userApproved: true }, "Pilot Decision 已由使用者核准。")}>核准 Pilot Decision</button>
        {data?.decision && <p className="v13-muted" style={{ marginTop: 6 }}>現況：{data.decision.decision}{data.decision.userApproved ? "（已核准）" : ""}</p>}
      </div>}

      {tab === "protocol" && <div>
        <p className="v13-muted" style={{ fontSize: 11 }}>Pilot 完成後建立 Study Protocol v2.0 Final（複製最新草案為新版本＋finalization 標記；v1.0 保留）。修改最終 Protocol → Readiness 自動 OUTDATED 需重查（上游變更時 mark-outdated）。</p>
        <div className="research-actions" style={{ gap: 6, marginTop: 6 }}><button type="button" className="primary-button" onClick={() => void action("create-protocol-v2", {}, "Study Protocol v2.0 Final 已建立。")}>建立 Study Protocol v2.0 Final</button><button type="button" className="secondary-button" onClick={() => void action("mark-outdated", { reason: "最終 Protocol 修改", sourceTable: "study_protocol_versions" }, "已標記 OUTDATED：需重新檢查。")}>修改後標記 OUTDATED</button></div>
        <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
          <p className="v13-muted" style={{ fontSize: 11 }}>Protocol Validation Matrix（每列：Component｜Evidence｜Status｜Issue｜Revision）：</p>
          {["Recruitment", "Consent", "Baseline", "Intervention", "Control", "Measurements", "Follow-up", "Sensor Setup", "Event Logs", "Scoring", "Data Capture", "Data Transfer", "Safety", "Withdrawal", "Fidelity", "Session Duration", "Analysis Variable Availability"].map((key) => { const existing = (data?.validationItems ?? []).find((v) => string(v.component_key) === key); return <div key={key} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, padding: "2px 0" }}><strong style={{ minWidth: 180 }}>{key}</strong><select style={{ fontSize: 10, flex: 1 }} value={string(existing?.status, "NOT_APPLICABLE")} onChange={(e) => void action("save-validation-item", { item: { componentKey: key, status: e.target.value, pilotEvidence: string(existing?.pilot_evidence) } })}>{["VALIDATED_FOR_FORMAL_STUDY", "VALIDATED_WITH_REVISION", "RETEST_REQUIRED", "NOT_VALIDATED", "NOT_APPLICABLE", "INSUFFICIENT_EVIDENCE"].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>; })}
        </div>
      </div>}

      {tab === "readiness" && <div>
        <div className="research-actions" style={{ gap: 6, marginBottom: 8 }}><button type="button" className="primary-button" disabled={busy === "run-readiness"} onClick={() => void action("run-readiness", {}, "Formal Study Readiness 已檢查。")}>執行 Formal Study Readiness Check（15 項）</button><button type="button" className="secondary-button" onClick={() => void action("write-blueprint-study-ready", {}, "Blueprint Study-Ready 已回寫。")}>回寫 Blueprint Study-Ready</button></div>
        <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">READINESS：{data?.readiness?.status ?? "NOT_READY"}</p><p className="v13-muted" style={{ fontSize: 11 }}>APPROVED_FOR_FORMAL_STUDY 不代表研究已開始或資料已蒐集；正式研究仍須符合各項執行條件。</p>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>{(data?.readiness?.checks ?? []).map((c, idx) => <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, padding: "3px 0", borderBottom: "1px solid #eef2ef" }}><span><strong>[{c.pass ? "✓" : "✗"}]</strong> {string(c.label)}</span><span className="v13-muted">{string(c.detail)}</span></div>)}</div>
        </div>
      </div>}

      {tab === "report" && <div>
        <div className="research-actions" style={{ gap: 6, marginBottom: 8 }}><button type="button" className="primary-button" onClick={() => void action("generate-report", {}, "Pilot Report v1.0 已產生（只彙整既有資料）。")}>產生 Pilot Study Report v1.0</button></div>
        {data?.report && <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">PILOT STUDY REPORT · {data.report.version}</p>
          <div style={{ fontSize: 11, lineHeight: 1.8 }}>{Object.entries(data.report.sections).map(([k, v]) => <p key={k}><strong>{k}：</strong>{typeof v === "string" ? v : JSON.stringify(v).slice(0, 400)}</p>)}</div>
          <p className="v13-muted" style={{ marginTop: 6 }}>本報告不得寫成正式研究 Results／Discussion。</p>
        </div>}
        {(data?.pretests ?? []).length > 0 && <p className="v13-muted" style={{ fontSize: 11 }}>預試結果：{(data?.pretests ?? []).map((p) => `${string(p.metric_key)}(${string(p.status)})`).join("、")}</p>}
      </div>}
    </div>
  );
}
