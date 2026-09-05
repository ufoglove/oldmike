"use client";

import { useCallback, useEffect, useState } from "react";

type ScopeItem = { itemKey: string; question: string; answer: string; status: string; evidence: string | null; riskLevel: string; requiredAction: string | null; unresolvedQuestion: string | null };
type RiskItem = { riskKey: string; riskTitle: string; likelihood: string; severity: string; affectedPopulation: string | null; mitigation: string | null; monitoring: string | null; responsiblePerson: string | null; residualRisk: string; status: string };
type EthicsDocument = { documentType: string; title: string; content: string; status: string; version: number; createdAt: string; updatedAt: string };
type Decision = { id: string; institution: string; decisionType: string; applicationNumber: string | null; approvalNumber: string | null; decisionDate: string | null; expiryDate: string | null; approvedDocuments: unknown[]; conditions: unknown[]; verifiedByUser: boolean; fileReference: string | null; approvalStatus: string };
type Preregistration = { id: string; designType: string; registrationType: string | null; platformCandidate: string | null; primaryOutcome: string | null; secondaryOutcomes: unknown[]; hypotheses: unknown[]; samplePlan: string | null; exclusionRules: string | null; stoppingRule: string | null; missingDataStrategy: string | null; outlierStrategy: string | null; mainAnalysis: string | null; exploratoryAnalysis: string | null; status: string; registrationUrl: string | null; registrationId: string | null; registeredAt: string | null; version: number };
type ReadinessItem = { key: string; label: string; status: string; note: string };
const TEACHER_POWER_QUESTIONS = [
  { key: "non_teaching_recruiter", question: "是否由非授課教師協助招募？" }, { key: "free_refusal", question: "是否明確說明可自由拒絕？" }, { key: "no_grade_impact", question: "是否不影響成績與權益？" }, { key: "data_grade_separation", question: "是否將研究資料與成績資料分離？" }, { key: "blind_after_grades", question: "是否於成績確定後才進行資料解盲？" }, { key: "alternative_activity", question: "是否有替代學習活動？" }, { key: "no_undue_incentive", question: "是否避免不當加分誘因？" }, { key: "teacher_not_see_refusers", question: "是否避免教師直接得知拒絕者？" }, { key: "deidentification", question: "是否對學生資料去識別化？" }, { key: "withdrawal_process", question: "是否有退出研究流程？" }, { key: "course_research_separation", question: "是否說明課程參與與研究參與不同？" },
];
type EthicsResponse = {
  ok?: boolean; locked?: boolean; entry?: { allowed: boolean; reason: string[] };
  assessment?: { id: string; status: string; screeningStatus: string; judgmentStatus: string; teacherPowerStatus: string; teacherPowerSeverity: string | null; summary: Record<string, unknown>; gateState: Record<string, unknown> } | null;
  scopeItems?: ScopeItem[]; riskItems?: RiskItem[]; documents?: EthicsDocument[]; decisions?: Decision[];
  dmp?: { sections: Record<string, string>; status: string; version: number } | null;
  preregistration?: Preregistration | null; preregistrationVersions?: { id: string; version: number; versionLabel: string; reason: string; createdAt: string }[];
  preregistrationAmendments?: { id: string; reason: string; changes: unknown[]; createdAt: string }[];
  journalReadiness?: { items: ReadinessItem[]; overall: string; version: string } | null;
  teacherPower?: { answers?: Record<string, { answer: string; note: string }>; answeredCount?: number; status?: string } | null;
  source?: { primaryRoute: string };
  error?: string;
};

const JUDGMENT_LABELS: Record<string, string> = {
  REVIEW_LIKELY_REQUIRED: "很可能需要倫理審查", EXEMPTION_MAY_APPLY: "可能符合豁免（需機構確認）", NON_HUMAN_RESEARCH: "非人體研究", SECONDARY_DATA_REVIEW_REQUIRED: "需二手資料倫理審查", INSTITUTIONAL_CONFIRMATION_REQUIRED: "需機構確認", INSUFFICIENT_INFORMATION: "資訊不足，無法判定",
};
const STATUS_LABELS: Record<string, string> = { NOT_STARTED: "尚未開始", DRAFT: "草稿", USER_REVIEW_REQUIRED: "需研究者審閱", INSTITUTION_REVIEW_REQUIRED: "需機構審閱", SUBMITTED: "已送審", REVISION_REQUIRED: "需修正", APPROVED: "已核准", EXPIRED: "已過期" };
const SCOPE_ANSWERS: Record<string, string> = { YES: "是", NO: "否", UNKNOWN: "未確定" };

type Tab = "screening" | "judgment" | "risk" | "documents" | "decision" | "dmp" | "preregistration" | "readiness" | "gate";

export default function EthicsCenter({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [data, setData] = useState<EthicsResponse | null>(null);
  const [tab, setTab] = useState<Tab>("screening");
  const [scopeDraft, setScopeDraft] = useState<Record<string, ScopeItem>>({});
  const [riskDraft, setRiskDraft] = useState<Record<string, RiskItem>>({});
  const [docDrafts, setDocDrafts] = useState<Record<string, string>>({});
  const [activeDoc, setActiveDoc] = useState("");
  const [preregDraft, setPreregDraft] = useState<Record<string, string>>({});
  const [readinessDraft, setReadinessDraft] = useState<Record<string, { status: string; note: string }>>({});
  const [dmpDrafts, setDmpDrafts] = useState<Record<string, string>>({});
  const [decisionDraft, setDecisionDraft] = useState<Record<string, string>>({});
  const [teacherPowerDraft, setTeacherPowerDraft] = useState<Record<string, { answer: string; note: string }>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ethics-center`, { cache: "no-store" });
      const json = await res.json() as EthicsResponse;
      if (!res.ok || json.ok === false) throw new Error(json.error || "無法載入倫理中心。");
      setData(json);
      if (json.scopeItems) setScopeDraft(Object.fromEntries(json.scopeItems.map((i) => [i.itemKey, i])));
      if (json.riskItems) setRiskDraft(Object.fromEntries(json.riskItems.map((i) => [i.riskKey, i])));
      if (json.journalReadiness) setReadinessDraft(Object.fromEntries(json.journalReadiness.items.map((i) => [i.key, { status: i.status, note: i.note }])));
      if (json.teacherPower?.answers) setTeacherPowerDraft(Object.fromEntries(Object.entries(json.teacherPower.answers).map(([k, v]) => [k, { answer: v.answer, note: v.note }])));
      if (json.dmp) setDmpDrafts(json.dmp.sections ?? {});
      if (json.preregistration) {
        const p = json.preregistration;
        setPreregDraft({ designType: p.designType, registrationType: p.registrationType ?? "", platformCandidate: p.platformCandidate ?? "", primaryOutcome: p.primaryOutcome ?? "", secondaryOutcomes: Array.isArray(p.secondaryOutcomes) ? p.secondaryOutcomes.join("\n") : "", hypotheses: Array.isArray(p.hypotheses) ? p.hypotheses.join("\n") : "", samplePlan: p.samplePlan ?? "", exclusionRules: p.exclusionRules ?? "", stoppingRule: p.stoppingRule ?? "", missingDataStrategy: p.missingDataStrategy ?? "", outlierStrategy: p.outlierStrategy ?? "", mainAnalysis: p.mainAnalysis ?? "", exploratoryAnalysis: p.exploratoryAnalysis ?? "" });
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "載入失敗。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function action(name: string, body: Record<string, unknown>, success?: string) {
    setError(""); setBusy(name);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ethics-center`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const payload = await res.json() as { ok?: boolean; error?: string; failed?: { key: string; label: string; detail?: string }[] };
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "操作失敗。");
      if (success) setNotice(success);
      await load();
      return payload;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); return null; }
    finally { setBusy(""); }
  }

  if (loading) return <div className="v13-panel" style={{ marginTop: 10 }}><p className="v13-muted" role="status">載入中…</p></div>;
  if (!data) return <div className="v13-panel" style={{ marginTop: 10 }}><p className="v13-error" role="alert">倫理中心載入失敗。</p></div>;
  if (data.locked) {
    return (
      <div className="v13-panel" style={{ marginTop: 10 }}>
        <div className="v13-panel-head"><div><p className="section-kicker">研究倫理審查中心 · 07</p><h3>研究倫理／IRB 中心</h3></div></div>
        <div className="v13-empty"><strong>ROUTE_REVIEW_AND_ETHICS_LOCKED</strong><p>此模組依研究路線解鎖；請先完成前驅 Gate：</p><ul>{(data.entry?.reason ?? []).map((r) => <li key={r}>{r}</li>)}</ul></div>
      </div>
    );
  }

  const assessment = data?.assessment;
  const judgment = assessment?.judgmentStatus ?? "";
  const tabs: { id: Tab; label: string }[] = [
    { id: "screening", label: "倫理範圍初篩" }, { id: "judgment", label: "倫理判斷" }, { id: "risk", label: "風險登記" }, { id: "documents", label: "IRB 文件" }, { id: "decision", label: "機構判定" }, { id: "dmp", label: "資料管理計畫" }, { id: "preregistration", label: "預註冊" }, { id: "readiness", label: "Journal Readiness" }, { id: "gate", label: "Gate" },
  ];

  return (
    <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">研究倫理審查中心 · 07</p><h3>研究倫理／IRB 中心</h3></div><p className="v13-panel-note">全站唯一倫理管理中心：範圍初篩、風險登記、IRB 文件、資料管理、預註冊與研究前 Readiness。正式判定與核准只在使用者上傳或輸入機構文件後記錄；本系統不會自行宣布「已核准」。</p></div>
      {error && <p className="v13-error" role="alert">{error}</p>}
      {notice && <p className="v13-notice" role="status">{notice}</p>}
      {assessment && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <span className="v13-badge" style={{ background: assessment.status === "OUTDATED" ? "#f5e6ce" : "#e7ebe7", color: assessment.status === "OUTDATED" ? "#9b5d16" : "var(--muted)" }}>狀態：{assessment.status}</span>
        <span className="v13-badge">Screening：{assessment.screeningStatus}</span>
        <span className="v13-badge" style={{ background: judgment === "REVIEW_LIKELY_REQUIRED" ? "#f5e6ce" : "#e7ebe7", color: judgment === "REVIEW_LIKELY_REQUIRED" ? "#9b5d16" : "var(--muted)" }}>判斷：{JUDGMENT_LABELS[judgment] ?? judgment}</span>
        {assessment.teacherPowerStatus === "TEACHER_STUDENT_POWER_RISK" && <span className="v13-badge" style={{ background: "#f5e6ce", color: "#9b5d16" }}>⚠ 師生權力風險（MAJOR）</span>}
      </div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>{tabs.map((t) => <button key={t.id} type="button" className={tab === t.id ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>

      {tab === "screening" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>依 25 項範圍問題作答（是／否／未確定）；「未確定」不會被當成「否」。</p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{(data?.scopeItems ?? []).map((item) => {
            const draft = scopeDraft[item.itemKey] ?? item;
            return <div key={item.itemKey} className="v13-panel" style={{ padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><strong style={{ fontSize: 12 }}>{item.question}</strong><span className="v13-muted" style={{ fontSize: 10 }}>{item.itemKey}</span></div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {Object.entries(SCOPE_ANSWERS).map(([value, label]) => <label key={value} className="v13-choice" style={{ padding: "2px 8px", fontSize: 11 }}><input type="radio" name={`scope-${item.itemKey}`} value={value} checked={draft.answer === value} onChange={() => setScopeDraft((d) => ({ ...d, [item.itemKey]: { ...draft, answer: value } }))} /><span>{label}</span></label>)}
              </div>
              <textarea rows={1} style={{ width: "100%", marginTop: 6, fontSize: 11 }} placeholder="Evidence 佐證（來源／說明）" value={draft.evidence ?? ""} onChange={(e) => setScopeDraft((d) => ({ ...d, [item.itemKey]: { ...draft, evidence: e.target.value } }))} />
            </div>;
          })}</div>
          <div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="primary-button" disabled={busy === "save-scope"} onClick={() => void action("save-scope", { items: Object.values(scopeDraft).map((i) => ({ itemKey: i.itemKey, answer: i.answer, evidence: i.evidence ?? "", requiredAction: i.requiredAction ?? "", unresolvedQuestion: i.unresolvedQuestion ?? "" })) }, "範圍初篩已儲存。")}>儲存範圍初篩</button><button type="button" className="secondary-button" disabled={busy === "run-screening"} onClick={() => void action("run-screening", {}, "倫理判斷已重新計算（系統不自行宣布核准；正式判定需機構文件）。")}>執行倫理判斷</button></div>
        </div>
      )}

      {tab === "judgment" && (
        <div className="v13-panel" style={{ padding: 12 }}>
          <p className="section-kicker">倫理判定狀態</p>
          <h3 style={{ margin: "0 0 6px" }}>倫理判斷狀態：{JUDGMENT_LABELS[judgment] ?? judgment ?? "尚未判定"}</h3>
          <p className="v13-muted" style={{ fontSize: 11 }}>系統只能提供初步判斷；以下狀態不得由網站自行宣布為正式結果：</p>
          <ul style={{ fontSize: 12, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
            <li>REVIEW_LIKELY_REQUIRED — 很可能需要正式倫理審查</li>
            <li>EXEMPTION_MAY_APPLY — 可能豁免，但正式判定需機構確認（顯示 INSTITUTIONAL_CONFIRMATION_REQUIRED）</li>
            <li>NON_HUMAN_RESEARCH — 非人體研究（仍需保留紀錄）</li>
            <li>SECONDARY_DATA_REVIEW_REQUIRED — 二手資料需確認原始授權／倫理狀態</li>
            <li>INSUFFICIENT_INFORMATION — 資訊不足，先補齊範圍問題</li>
          </ul>
          <div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="secondary-button" onClick={() => setTab("screening")}>← 回去補齊範圍初篩</button><button type="button" className="secondary-button" onClick={() => void action("run-screening", {}, "判斷已重新計算。")}>重新執行判斷</button></div>
          {assessment?.teacherPowerStatus === "TEACHER_STUDENT_POWER_RISK" && <div style={{ marginTop: 14, borderTop: "1px solid #eef2ef", paddingTop: 10 }}>
            <p className="section-kicker">TEACHER–STUDENT POWER CHECK · 11 項</p>
            <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>教師與學生研究專屬檢查</h3>
            <p className="v13-muted" style={{ fontSize: 11 }}>研究對象包含主持人本人授課學生時自動檢查（TEACHER_STUDENT_POWER_RISK = MAJOR）。每一項皆為正向問題，全部 11 項 YES 才可解除風險。</p>
            <div style={{ display: "grid", gap: 6, marginTop: 6 }}>{TEACHER_POWER_QUESTIONS.map((item) => {
              const draft = teacherPowerDraft[item.key] ?? { answer: "UNKNOWN", note: "" };
              return <div key={item.key} className="v13-panel" style={{ padding: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><span style={{ fontSize: 12 }}>{item.question}</span><select style={{ fontSize: 11 }} value={draft.answer} onChange={(e) => setTeacherPowerDraft((d) => ({ ...d, [item.key]: { answer: e.target.value, note: draft.note } }))}>{["YES", "NO", "UNKNOWN"].map((v) => <option key={v} value={v}>{v === "YES" ? "是" : v === "NO" ? "否" : "未確定"}</option>)}</select></div>
                {draft.answer === "NO" && <textarea rows={1} style={{ width: "100%", marginTop: 4, fontSize: 11 }} placeholder="補救措施說明" value={draft.note} onChange={(e) => setTeacherPowerDraft((d) => ({ ...d, [item.key]: { answer: draft.answer, note: e.target.value } }))} />}
              </div>;
            })}</div>
            <div className="research-actions" style={{ marginTop: 8 }}><button type="button" className="primary-button" disabled={busy === "save-teacher-power"} onClick={() => void action("save-teacher-power", { items: TEACHER_POWER_QUESTIONS.map((q) => { const d = teacherPowerDraft[q.key] ?? { answer: "UNKNOWN", note: "" }; return { key: q.key, answer: d.answer, note: d.note }; }) }, "師生權力檢查已儲存（全部 YES 才解除風險）。")}>儲存師生權力檢查</button></div>
          </div>}
        </div>
      )}

      {tab === "risk" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>倫理風險登記（15 類）：評估可能性、嚴重度、受影響族群與緩解措施。</p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{(data?.riskItems ?? []).map((item) => {
            const draft = riskDraft[item.riskKey] ?? item;
            return <div key={item.riskKey} className="v13-panel" style={{ padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><strong style={{ fontSize: 12 }}>{item.riskTitle}</strong><span className="v13-muted" style={{ fontSize: 10 }}>{draft.likelihood} / {draft.severity}</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6, marginTop: 6 }}>
                <label style={{ fontSize: 11 }}>可能性<select style={{ width: "100%", fontSize: 11 }} value={draft.likelihood} onChange={(e) => setRiskDraft((d) => ({ ...d, [item.riskKey]: { ...draft, likelihood: e.target.value } }))}>{["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
                <label style={{ fontSize: 11 }}>嚴重度<select style={{ width: "100%", fontSize: 11 }} value={draft.severity} onChange={(e) => setRiskDraft((d) => ({ ...d, [item.riskKey]: { ...draft, severity: e.target.value } }))}>{["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "SEVERE"].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
              </div>
              <textarea rows={1} style={{ width: "100%", marginTop: 6, fontSize: 11 }} placeholder="Mitigation 緩解措施" value={draft.mitigation ?? ""} onChange={(e) => setRiskDraft((d) => ({ ...d, [item.riskKey]: { ...draft, mitigation: e.target.value } }))} />
              <textarea rows={1} style={{ width: "100%", marginTop: 6, fontSize: 11 }} placeholder="Monitoring／Responsible Person" value={`${draft.monitoring ?? ""}${draft.responsiblePerson ? `／${draft.responsiblePerson}` : ""}`} onChange={(e) => setRiskDraft((d) => { const parts = e.target.value.split("／"); return { ...d, [item.riskKey]: { ...draft, monitoring: parts[0], responsiblePerson: parts[1] ?? draft.responsiblePerson } }; })} />
            </div>;
          })}</div>
          <div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="primary-button" disabled={busy === "save-risk"} onClick={() => void action("save-risk", { items: Object.values(riskDraft).map((i) => ({ riskKey: i.riskKey, likelihood: i.likelihood, severity: i.severity, affectedPopulation: i.affectedPopulation ?? "", mitigation: i.mitigation ?? "", monitoring: i.monitoring ?? "", responsiblePerson: i.responsiblePerson ?? "", residualRisk: i.residualRisk, status: i.status })) }, "風險登記已儲存。")}>儲存風險登記</button></div>
        </div>
      )}

      {tab === "documents" && (
        <div>
          <div className="research-actions" style={{ flexWrap: "wrap", marginBottom: 8 }}>
            <button type="button" className="secondary-button" disabled={busy === "ai-draft-documents"} onClick={() => void action("ai-draft-documents", { documentTypes: (data?.documents ?? []).filter((d) => !d.content.trim()).map((d) => d.documentType).slice(0, 5) }, "AI 草稿已產生（PROVISIONAL，需研究者審閱；未宣稱送審或核准）。")}>老麥 AI 草稿（未填寫文件，最多 5 份）</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{(data?.documents ?? []).map((doc) => <button key={doc.documentType} type="button" className={activeDoc === doc.documentType ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => { setActiveDoc(doc.documentType); setDocDrafts((d) => ({ ...d, [doc.documentType]: d[doc.documentType] ?? doc.content })); }}>{doc.status !== "NOT_STARTED" ? "✓ " : ""}{doc.title}</button>)}</div>
          {(() => {
            const doc = (data?.documents ?? []).find((d) => d.documentType === activeDoc);
            if (!doc) return <p className="v13-muted">請選擇文件類型開始撰寫草稿。</p>;
            const content = docDrafts[doc.documentType] ?? doc.content;
            return <div className="v13-panel" style={{ padding: 12 }}>
              <p className="section-kicker">{doc.documentType} · v{doc.version}</p>
              <h3 style={{ margin: "0 0 4px" }}>{doc.title}</h3>
              <p className="v13-muted" style={{ fontSize: 11 }}>狀態：{STATUS_LABELS[doc.status] ?? doc.status}。SUBMITTED 需使用者明確記錄送件；APPROVED 需正式機構判定紀錄存在。</p>
              <textarea rows={10} style={{ width: "100%", marginTop: 6, fontSize: 12 }} value={content} onChange={(e) => setDocDrafts((d) => ({ ...d, [doc.documentType]: e.target.value }))} placeholder="撰寫草稿…（不得虛構 IRB 判定／核准號碼／核准日期；未確認資訊標示【待研究者確認】）" />
              <div className="research-actions" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="primary-button" disabled={busy === "save-document"} onClick={() => void action("save-document", { documentType: doc.documentType, content }, "文件草稿已儲存。")}>儲存草稿</button>
                {["DRAFT", "USER_REVIEW_REQUIRED", "REVISION_REQUIRED"].includes(doc.status) && <button type="button" className="secondary-button" onClick={() => void action("save-document", { documentType: doc.documentType, content, status: "USER_REVIEW_REQUIRED" }, "已標記：需研究者審閱。")}>標記需研究者審閱</button>}
                {(doc.status === "USER_REVIEW_REQUIRED" || doc.status === "DRAFT") && <button type="button" className="secondary-button" onClick={() => void action("save-document", { documentType: doc.documentType, content, status: "INSTITUTION_REVIEW_REQUIRED" }, "已標記：需機構審閱（尚未送審）。")}>標記需機構審閱</button>}
                {doc.status === "INSTITUTION_REVIEW_REQUIRED" && <button type="button" className="secondary-button" onClick={() => void action("save-document", { documentType: doc.documentType, content, status: "SUBMITTED" }, "已記錄送審（使用者確認）。")}>記錄已送審</button>}
                {doc.status === "SUBMITTED" && <button type="button" className="secondary-button" onClick={() => void action("save-document", { documentType: doc.documentType, content, status: "REVISION_REQUIRED" }, "已標記：需修正。")}>標記需修正</button>}
              </div>
            </div>;
          })()}
        </div>
      )}

      {tab === "decision" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>正式機構倫理判定：只有上傳或輸入真實機構文件後才記錄。無正式文件時 approval_status 不得為 APPROVED。</p>
          <div className="v13-panel" style={{ padding: 12 }}>
            <p className="section-kicker">機構倫理決策</p>
            <div style={{ display: "grid", gap: 6 }}>
              <input style={{ fontSize: 12 }} placeholder="機構名稱（Institution）" value={decisionDraft.institution ?? ""} onChange={(e) => setDecisionDraft((d) => ({ ...d, institution: e.target.value }))} />
              <input style={{ fontSize: 12 }} placeholder="申請編號（Application Number）" value={decisionDraft.applicationNumber ?? ""} onChange={(e) => setDecisionDraft((d) => ({ ...d, applicationNumber: e.target.value }))} />
              <input style={{ fontSize: 12 }} placeholder="核准編號（Approval Number）" value={decisionDraft.approvalNumber ?? ""} onChange={(e) => setDecisionDraft((d) => ({ ...d, approvalNumber: e.target.value }))} />
              <input style={{ fontSize: 12 }} placeholder="決議日期（YYYY-MM-DD）" value={decisionDraft.decisionDate ?? ""} onChange={(e) => setDecisionDraft((d) => ({ ...d, decisionDate: e.target.value }))} />
              <label style={{ fontSize: 11 }}><input type="checkbox" checked={decisionDraft.verified === "1"} onChange={(e) => setDecisionDraft((d) => ({ ...d, verified: e.target.checked ? "1" : "" }))} /> 我已核對並上傳機構文件（verified_by_user）</label>
            </div>
            <div className="research-actions" style={{ marginTop: 8 }}>
              <button type="button" className="primary-button" disabled={busy === "save-decision"} onClick={() => void action("save-decision", { decision: { institution: decisionDraft.institution ?? "", decisionType: "OTHER", applicationNumber: decisionDraft.applicationNumber ?? "", approvalNumber: decisionDraft.approvalNumber ?? "", decisionDate: decisionDraft.decisionDate || undefined, verifiedByUser: decisionDraft.verified === "1", approvalStatus: decisionDraft.verified === "1" && decisionDraft.approvalNumber && decisionDraft.decisionDate ? "APPROVED" : "PENDING" } }, "機構判定已記錄。")}>儲存機構判定</button>
              <span className="v13-muted" style={{ fontSize: 10 }}>APPROVED 僅在「已核對＋核准編號＋決議日期」齊備時成立</span>
            </div>
          </div>
          {(data?.decisions ?? []).length > 0 && <div style={{ marginTop: 8 }}>{(data?.decisions ?? []).map((d) => <div key={d.id} className="v13-panel" style={{ padding: 10, marginBottom: 6 }}><strong style={{ fontSize: 12 }}>{d.institution}</strong><span className="v13-badge" style={{ marginLeft: 8 }}>{d.approvalStatus}</span><p className="v13-muted" style={{ fontSize: 11, margin: "4px 0 0" }}>申請編號：{d.applicationNumber ?? "—"} ｜ 核准編號：{d.approvalNumber ?? "—"} ｜ 決議日期：{d.decisionDate ?? "—"}{d.verifiedByUser ? " ｜ 已核對" : ""}</p></div>)}</div>}
        </div>
      )}

      {tab === "dmp" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>Research Data Management Plan：需與研究設計、測量需求與分析計畫一致。</p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {["data_types", "data_sources", "personal_identifiers", "de_identification_method", "coding_key_location", "access_control", "encryption", "storage_location", "backup", "data_transfer", "third_party_services", "retention_period", "destruction_method", "data_sharing_plan", "repository_plan", "sensitive_data_restrictions", "dataset_versioning", "audit_log", "responsible_person"].map((key) => (
              <div key={key} className="v13-panel" style={{ padding: 8 }}><label style={{ fontSize: 11, display: "block", marginBottom: 4 }}>{key.replace(/_/g, " ")}</label><textarea rows={1} style={{ width: "100%", fontSize: 11 }} value={dmpDrafts[key] ?? ""} onChange={(e) => setDmpDrafts((d) => ({ ...d, [key]: e.target.value }))} placeholder={`填寫 ${key}…`} /></div>
            ))}
          </div>
          <div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="primary-button" disabled={busy === "save-dmp"} onClick={() => void action("save-dmp", { sections: dmpDrafts }, "資料管理計畫已儲存。")}>儲存 DMP</button></div>
        </div>
      )}

      {tab === "preregistration" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>預註冊工作區：REGISTERED 需正式 URL／ID（不虛構）。修改會建立 Amendment，不覆蓋原始版本。</p>
          <div className="v13-panel" style={{ padding: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              {[["designType", "設計類型（CONFIRMATORY_EXPERIMENT/RCT/QUASI_EXPERIMENT/LONGITUDINAL/SURVEY_CONFIRMATORY/REGISTERED_REPORT/AI_ML_BENCHMARK/OTHER/NOT_APPLICABLE）"], ["platformCandidate", "平台候選"], ["primaryOutcome", "Primary Outcome"], ["secondaryOutcomes", "Secondary Outcomes（一行一個）"], ["hypotheses", "假設（一行一個）"], ["samplePlan", "樣本計畫"], ["exclusionRules", "排除規則"], ["stoppingRule", "停止規則"], ["missingDataStrategy", "缺漏資料策略"], ["outlierStrategy", "離群值策略"], ["mainAnalysis", "主要分析"], ["exploratoryAnalysis", "探索性分析"]].map(([key, label]) => <textarea key={key} rows={key === "secondaryOutcomes" || key === "hypotheses" ? 2 : 1} style={{ width: "100%", fontSize: 12 }} placeholder={label} value={preregDraft[key] ?? ""} onChange={(e) => setPreregDraft((d) => ({ ...d, [key]: e.target.value }))} />)}
            </div>
            <div className="research-actions" style={{ marginTop: 8 }}>
              <button type="button" className="primary-button" disabled={busy === "save-preregistration"} onClick={() => void action("save-preregistration", { fields: { designType: preregDraft.designType ?? "OTHER", platformCandidate: preregDraft.platformCandidate ?? "", primaryOutcome: preregDraft.primaryOutcome ?? "", secondaryOutcomes: (preregDraft.secondaryOutcomes ?? "").split("\n").map((s) => s.trim()).filter(Boolean), hypotheses: (preregDraft.hypotheses ?? "").split("\n").map((s) => s.trim()).filter(Boolean), samplePlan: preregDraft.samplePlan ?? "", exclusionRules: preregDraft.exclusionRules ?? "", stoppingRule: preregDraft.stoppingRule ?? "", missingDataStrategy: preregDraft.missingDataStrategy ?? "", outlierStrategy: preregDraft.outlierStrategy ?? "", mainAnalysis: preregDraft.mainAnalysis ?? "", exploratoryAnalysis: preregDraft.exploratoryAnalysis ?? "" } }, "預註冊內容已儲存（新版本）。")}>儲存預註冊內容</button>
            </div>
            {(data?.preregistration?.status ?? "") === "REGISTERED" ? (
              <p className="v13-muted" style={{ marginTop: 8, fontSize: 11 }}>已註冊：{data.preregistration?.registrationUrl}（ID：{data.preregistration?.registrationId ?? "—"}）</p>
            ) : (
              <div className="research-actions" style={{ marginTop: 8, gap: 6 }}>
                <input style={{ fontSize: 11, flex: 1, minWidth: 180 }} placeholder="正式註冊 URL（https://…）" value={preregDraft._regUrl ?? ""} onChange={(e) => setPreregDraft((d) => ({ ...d, _regUrl: e.target.value }))} />
                <input style={{ fontSize: 11, flex: 1, minWidth: 120 }} placeholder="註冊 ID（選填）" value={preregDraft._regId ?? ""} onChange={(e) => setPreregDraft((d) => ({ ...d, _regId: e.target.value }))} />
                <button type="button" className="primary-button" disabled={busy === "register-preregistration" || !(preregDraft._regUrl ?? "").startsWith("http")} onClick={() => void action("register-preregistration", { registrationUrl: preregDraft._regUrl, registrationId: preregDraft._regId || undefined }, "已記錄正式預註冊（REGISTERED）。")}>記錄正式註冊</button>
              </div>
            )}
            {(data?.preregistrationVersions ?? []).length > 0 && <div style={{ marginTop: 8 }}><p className="v13-muted" style={{ fontSize: 11 }}>版本：{(data?.preregistrationVersions ?? []).map((v) => `${v.versionLabel}（${v.reason}）`).join(" ｜ ")}</p></div>}
            {(data?.preregistrationAmendments ?? []).length > 0 && <div style={{ marginTop: 4 }}><p className="v13-muted" style={{ fontSize: 11 }}>Amendments：{(data?.preregistrationAmendments ?? []).map((a) => a.reason).join(" ｜ ")}</p></div>}
          </div>
        </div>
      )}

      {tab === "readiness" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>Journal Pre-study Readiness Review：此階段不是正式論文投稿審查；不生成假 Results／Discussion／投稿成功機率。</p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{(data?.journalReadiness?.items ?? []).map((item) => {
            const draft = readinessDraft[item.key] ?? { status: item.status, note: item.note };
            return <div key={item.key} className="v13-panel" style={{ padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><strong style={{ fontSize: 12 }}>{item.label}</strong><select style={{ fontSize: 11 }} value={draft.status} onChange={(e) => setReadinessDraft((d) => ({ ...d, [item.key]: { status: e.target.value, note: draft.note } }))}>{["NOT_STARTED", "IN_PROGRESS", "READY", "NOT_APPLICABLE"].map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
              <textarea rows={1} style={{ width: "100%", marginTop: 6, fontSize: 11 }} placeholder="Note" value={draft.note} onChange={(e) => setReadinessDraft((d) => ({ ...d, [item.key]: { status: draft.status, note: e.target.value } }))} />
            </div>;
          })}</div>
          <div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="primary-button" disabled={busy === "save-readiness"} onClick={() => void action("save-readiness", { items: Object.entries(readinessDraft).map(([key, v]) => ({ key, status: v.status, note: v.note })) }, "Readiness 已儲存。")}>儲存 Readiness</button></div>
        </div>
      )}

      {tab === "gate" && (
        <div className="v13-panel" style={{ padding: 12 }}>
          <p className="section-kicker">倫理門檻</p>
          <h3 style={{ margin: "0 0 6px" }}>Stage Gates（依路線）</h3>
          <p className="v13-muted" style={{ fontSize: 11 }}>JOURNAL 路線：ETHICS_SCOPE_DETERMINED → ETHICS_PACKAGE_PREPARED（解鎖研究工具與 Study Protocol Draft；若需審查而尚未核准，Pilot 與正式資料蒐集維持 LOCKED）。NSTC／MOE 路線：倫理規劃已於計畫書內建立即可。</p>
          <div className="research-actions" style={{ marginTop: 10, gap: 8 }}>
            <button type="button" className="primary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", { gateType: "ETHICS_SCOPE_DETERMINED" }, "ETHICS_SCOPE_DETERMINED 已核准（Gate 全過）。")}>核准 ETHICS_SCOPE_DETERMINED</button>
            <button type="button" className="secondary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", { gateType: "ETHICS_PACKAGE_PREPARED" }, "ETHICS_PACKAGE_PREPARED 已核准（Gate 全過）。")}>核准 ETHICS_PACKAGE_PREPARED</button>
          </div>
        </div>
      )}
    </div>
  );
}
