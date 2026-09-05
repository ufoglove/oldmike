"use client";

import { useCallback, useEffect, useState } from "react";

type RouteKey = "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL";
type Finding = { id: string; reviewerType: string; sectionId: string; issue: string; severity: string; rationale: string; evidence: string; requiredRevision: string; status: string; simulated: boolean; createdAt: string };
type ReviewRun = { reviewerType: string; status: string; version: number; simulated: boolean; summary: Record<string, unknown>; severityCounts: Record<string, number>; createdAt: string; updatedAt: string };
type ComplianceItem = { id: string; requirement: string; currentStatus: string; evidence: string | null; missingItem: string | null; requiredAction: string | null; severity: string; verificationStatus: string; officialSource: string | null; checkedAt: string };
type RuleSnapshot = { id: string; authority: string; targetYear: number; documentTitle: string; requirement: string; effectiveDate: string | null; sourceUrl: string | null; retrievedAt: string; verificationStatus: string; notes: string | null };
type RevisionTask = { id: string; sourceFindingId: string | null; affectedSection: string | null; severity: string; requiredAction: string; owner: string | null; dueDate: string | null; status: string; beforeVersion: string | null; afterVersion: string | null; resolutionNote: string | null; createdAt: string };
type RouteView = {
  ok?: boolean; locked?: boolean; route?: RouteKey; lockedReason?: string[];
  reviewerTypes?: { key: string; label: string; focus: string[] }[];
  runs?: ReviewRun[]; findings?: Finding[]; revisionTasks?: RevisionTask[];
  compliance?: { targetYear: number; items: ComplianceItem[]; fatalMissing: number; snapshots: RuleSnapshot[] };
  gateStates?: Record<string, boolean>;
  eligibility?: { overall: string; fatalFailures: string[]; answered: number } | null;
  simulatedNotice?: string; error?: string;
};

const SEVERITY_COLORS: Record<string, string> = { FATAL: "#c0392b", MAJOR: "#9b5d16", MINOR: "#6b7280", SUGGESTION: "#2f6f4f" };
const STATUS_LABELS: Record<string, string> = { MET: "已符合", PARTIAL: "部分符合", MISSING: "缺漏", NOT_APPLICABLE: "不適用", AWAITING_OFFICIAL_RULE: "待官方規則", UNVERIFIED: "未驗證" };
const ELIGIBILITY_ITEMS = [
  { key: "pi_qualification", question: "主持人資格（符合教學實踐計畫申請資格）", fatal: true },
  { key: "own_course", question: "本人主授課程", fatal: true },
  { key: "credit_course", question: "正式學分課程", fatal: true },
  { key: "course_offered", question: "執行期間實際開課", fatal: true },
  { key: "student_population", question: "學生對象明確" },
  { key: "application_limit", question: "每年申請件數限制", fatal: true },
  { key: "discipline_selection", question: "學門／專案選擇" },
  { key: "internal_procedure", question: "校內程序" },
  { key: "course_data_completeness", question: "課程資料完整性" },
  { key: "duplicate_application", question: "重複申請" },
  { key: "research_ethics", question: "研究倫理" },
  { key: "teacher_student_power", question: "教師學生權力關係" },
];
const ROUTE_META: Record<RouteKey, { title: string; sub: string }> = {
  NSTC_PROPOSAL: { title: "國科會審查與合規", sub: "NSTC Review & Compliance Workspace" },
  MOE_TPR_PROPOSAL: { title: "教學實踐審查與合規", sub: "MOE Teaching Practice Review & Compliance Workspace" },
};

type Tab = "reviewer" | "eligibility" | "compliance" | "rules" | "tasks" | "gates";

export default function ReviewComplianceWorkspace({ projectId, onOpenEvidence }: { projectId: string; onOpenEvidence?: (role?: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [views, setViews] = useState<Record<RouteKey, RouteView | null>>({ NSTC_PROPOSAL: null, MOE_TPR_PROPOSAL: null });
  const [activeRoute, setActiveRoute] = useState<RouteKey | null>(null);
  const [tab, setTab] = useState<Tab>("reviewer");
  const [eligibilityDraft, setEligibilityDraft] = useState<Record<string, { status: string; evidence: string }>>({});
  const [complianceDrafts, setComplianceDrafts] = useState<Record<string, { currentStatus: string; evidence: string; requiredAction: string; missingItem: string }>>({});
  const [ruleDraft, setRuleDraft] = useState<Record<string, string>>({});
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/review-compliance`, { cache: "no-store" });
      const json = await res.json() as { ok?: boolean; routes?: Record<string, RouteView>; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "無法載入審查與合規工作區。");
      const next = { NSTC_PROPOSAL: null as RouteView | null, MOE_TPR_PROPOSAL: null as RouteView | null };
      for (const key of ["NSTC_PROPOSAL", "MOE_TPR_PROPOSAL"] as RouteKey[]) {
        const v = json.routes?.[key];
        if (v && typeof v === "object") next[key] = v as RouteView;
      }
      setViews(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "載入失敗。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function action(name: string, body: Record<string, unknown>, success?: string) {
    setError(""); setBusy(name);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/review-compliance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, route: activeRoute, ...body }) });
      const payload = await res.json() as { ok?: boolean; error?: string; failed?: { key: string; label: string; detail?: string }[] };
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "操作失敗。");
      if (success) setNotice(success);
      await load();
      return payload;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); return null; }
    finally { setBusy(""); }
  }

  function openRoute(route: RouteKey) { setActiveRoute(route); setTab("reviewer"); setEligibilityDraft({}); setComplianceDrafts({}); }
  function back() { setActiveRoute(null); }

  if (loading) return <div className="v13-panel" style={{ marginTop: 10 }}><p className="v13-muted" role="status">載入中…</p></div>;

  if (!activeRoute) {
    return (
      <div className="v13-panel" style={{ marginTop: 10 }}>
        <div className="v13-panel-head"><div><p className="section-kicker">審查與合規 · 07</p><h3>計畫審查與合規工作區</h3></div><p className="v13-panel-note">國科會／教學實踐：Reviewer 模擬（SIMULATED REVIEW）、官方規範檢查、修訂任務與 Eligibility 再確認。</p></div>
        {error && <p className="v13-error" role="alert">{error}</p>}
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {(Object.keys(ROUTE_META) as RouteKey[]).map((route) => {
            const v = views[route];
            return <div key={route} className="v13-panel" style={{ padding: 14 }}>
              <div><p className="section-kicker">{ROUTE_META[route].sub}</p><h3 style={{ margin: 0 }}>{ROUTE_META[route].title}</h3></div>
              {v?.locked ? <p className="v13-muted" style={{ margin: "6px 0" }}>Locked：{(v.lockedReason ?? []).join("；")}</p> : <p className="v13-muted" style={{ margin: "6px 0" }}>{v ? `已解鎖：Reviewer ${(v.runs ?? []).filter((r) => r.status === "COMPLETE").length}/3 視角完成 ｜ FATAL 未處理 ${(v.findings ?? []).filter((f) => f.severity === "FATAL" && ["OPEN", "ACKNOWLEDGED"].includes(f.status)).length} ｜ 合規 FATAL 缺漏 ${v.compliance?.fatalMissing ?? 0}` : "…"}</p>}
              {!v?.locked && <button type="button" className="primary-button" style={{ marginTop: 8 }} onClick={() => openRoute(route)}>進入工作區 →</button>}
            </div>;
          })}
        </div>
      </div>
    );
  }

  const view = views[activeRoute];
  const tabs: { id: Tab; label: string }[] = [{ id: "reviewer", label: "Reviewer 模擬" }, ...(activeRoute === "MOE_TPR_PROPOSAL" ? [{ id: "eligibility" as Tab, label: "Eligibility" }] : []), { id: "compliance", label: "官方合規" }, { id: "rules", label: "官方規則來源" }, { id: "tasks", label: "修訂任務" }, { id: "gates", label: "Gates" }];

  return (
    <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">{ROUTE_META[activeRoute].sub} · 07</p><h3>{ROUTE_META[activeRoute].title}</h3></div><p className="v13-panel-note">{view?.simulatedNotice ?? ""}</p></div>
      {error && <p className="v13-error" role="alert">{error}</p>}
      {notice && <p className="v13-notice" role="status">{notice}</p>}
      <div className="research-actions" style={{ flexWrap: "wrap", marginBottom: 8 }}><button type="button" className="secondary-button" onClick={back}>← 回到路線選擇</button>{tabs.map((t) => <button key={t.id} type="button" className={tab === t.id ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>

      {tab === "reviewer" && (
        <div>
          {(view?.reviewerTypes ?? []).map((rt) => {
            const run = (view?.runs ?? []).find((r) => r.reviewerType === rt.key);
            const runFindings = (view?.findings ?? []).filter((f) => f.reviewerType === rt.key && f.status !== "ACCEPTED_RISK");
            return <div key={rt.key} className="v13-panel" style={{ padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div><strong style={{ fontSize: 13 }}>{rt.label}</strong><p className="v13-muted" style={{ fontSize: 10, margin: "2px 0 0" }}>檢查重點：{rt.focus.join("／")}</p></div>
                <span className="v13-badge" style={{ background: run?.status === "COMPLETE" ? "#e0efe5" : "#e7ebe7", color: run?.status === "COMPLETE" ? "#2f6f4f" : "var(--muted)" }}>{run?.status === "COMPLETE" ? `已完成 v${run.version}` : run?.status ?? "尚未執行"}</span>
              </div>
              <div className="research-actions" style={{ marginTop: 8 }}>
                <button type="button" className="primary-button" disabled={busy === "run-reviewer"} onClick={() => void action("run-reviewer", { reviewerType: rt.key, ai: true }, `${rt.label} 模擬審查完成（AI SIMULATED REVIEW）。`)}>老麥 AI 模擬審查</button>
                <button type="button" className="secondary-button" disabled={busy === "run-reviewer"} onClick={() => void action("run-reviewer", { reviewerType: rt.key, ai: false }, `${rt.label} 規則式初檢完成。`)}>規則式初檢</button>
              </div>
              {runFindings.length > 0 && <div style={{ marginTop: 8, display: "grid", gap: 6 }}>{runFindings.map((f) => <div key={f.id} className="v13-panel" style={{ padding: 10, borderLeft: `3px solid ${SEVERITY_COLORS[f.severity] ?? "#999"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 12 }}>[{f.severity}] {f.issue}</strong><span className="v13-muted" style={{ fontSize: 10 }}>{f.sectionId}</span></div>
                {f.rationale && <p className="v13-muted" style={{ fontSize: 11, margin: "4px 0" }}>{f.rationale}</p>}
                {f.requiredRevision && <p style={{ fontSize: 11, margin: "2px 0" }}>建議修訂：{f.requiredRevision}</p>}
                <div className="research-actions" style={{ marginTop: 6, gap: 6, flexWrap: "wrap" }}>
                  {onOpenEvidence && <button type="button" className="secondary-button" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => onOpenEvidence("GAP")}>📖 前往文獻與證據中心（補強此發現）</button>}
                  {["ACKNOWLEDGED", "RESOLVED", "ACCEPTED_RISK"].filter((s) => f.status !== s).map((s) => <button key={s} type="button" className="secondary-button" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => void action("finding-status", { findingId: f.id, status: s })}>標記 {s}</button>)}
                  <button type="button" className="secondary-button" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => void action("create-revision-task", { findingId: f.id, requiredAction: f.requiredRevision || f.issue, severity: f.severity }, "已轉為修訂任務。")}>轉為修訂任務</button>
                </div>
              </div>)}</div>}
            </div>;
          })}
        </div>
      )}

      {tab === "eligibility" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>Eligibility 重新確認：Fatal 條件 FAIL 時不得建立 READY_FOR_SUBMISSION，只顯示 ELIGIBILITY_BLOCKED。整體：{view?.eligibility?.overall ?? "UNKNOWN"}{view?.eligibility?.answered ? `（已答 ${view.eligibility.answered}/${ELIGIBILITY_ITEMS.length}）` : ""}</p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{ELIGIBILITY_ITEMS.map((item) => {
            const draft = eligibilityDraft[item.key] ?? { status: "UNKNOWN", evidence: "" };
            return <div key={item.key} className="v13-panel" style={{ padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><strong style={{ fontSize: 12 }}>{item.question}{item.fatal ? "（Fatal）" : ""}</strong><select style={{ fontSize: 11 }} value={draft.status} onChange={(e) => setEligibilityDraft((d) => ({ ...d, [item.key]: { status: e.target.value, evidence: draft.evidence } }))}>{["PASS", "CONDITIONAL", "FAIL", "UNKNOWN"].map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
              <textarea rows={1} style={{ width: "100%", marginTop: 6, fontSize: 11 }} placeholder="Evidence 佐證" value={draft.evidence} onChange={(e) => setEligibilityDraft((d) => ({ ...d, [item.key]: { status: draft.status, evidence: e.target.value } }))} />
            </div>;
          })}</div>
          <div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="primary-button" disabled={busy === "save-eligibility"} onClick={() => void action("save-eligibility", { items: Object.entries(eligibilityDraft).map(([key, v]) => ({ key, status: v.status, evidence: v.evidence })) }, "Eligibility 已儲存。")}>儲存 Eligibility</button><button type="button" className="secondary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", { gateType: "MOE_TPR_ELIGIBILITY_PASSED" }, "MOE_TPR_ELIGIBILITY_PASSED 已核准。")}>核准 MOE_TPR_ELIGIBILITY_PASSED</button></div>
        </div>
      )}

      {tab === "compliance" && (
        <div>
          <div className="research-actions" style={{ flexWrap: "wrap", marginBottom: 8 }}>
            <button type="button" className="primary-button" disabled={busy === "run-compliance"} onClick={() => void action("run-compliance", { targetYear: view?.compliance?.targetYear ?? new Date().getUTCFullYear() }, "合規檢查已重新計算（依官方規則快照；年度未公告時顯示 PENDING_NEW_ANNOUNCEMENT）。")}>執行合規檢查（{view?.compliance?.targetYear ?? new Date().getUTCFullYear()} 年度）</button>
            <span className="v13-muted" style={{ fontSize: 10 }}>FATAL 缺漏：{view?.compliance?.fatalMissing ?? 0} 項（FATAL 未 MET 時申請包不得 Ready）</span>
          </div>
          <div style={{ display: "grid", gap: 6 }}>{(view?.compliance?.items ?? []).map((item) => {
            const draft = complianceDrafts[item.id] ?? { currentStatus: item.currentStatus, evidence: item.evidence ?? "", requiredAction: item.requiredAction ?? "", missingItem: item.missingItem ?? "" };
            return <div key={item.id} className="v13-panel" style={{ padding: 10, borderLeft: item.severity === "FATAL" ? "3px solid #c0392b" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <strong style={{ fontSize: 12 }}>{item.requirement}{item.severity === "FATAL" ? "（FATAL）" : ""}</strong>
                <span className="v13-badge" style={{ background: item.currentStatus === "MET" ? "#e0efe5" : item.currentStatus === "MISSING" ? "#f5e6ce" : "#e7ebe7", color: item.currentStatus === "MET" ? "#2f6f4f" : item.currentStatus === "MISSING" ? "#9b5d16" : "var(--muted)" }}>{STATUS_LABELS[item.currentStatus] ?? item.currentStatus}</span>
              </div>
              <p className="v13-muted" style={{ fontSize: 10, margin: "4px 0" }}>驗證狀態：{item.verificationStatus} ｜ 官方來源：{item.officialSource ?? "—"} ｜ 檢查時間：{item.checkedAt ? new Date(item.checkedAt).toLocaleString() : "—"}</p>
              <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                <select style={{ fontSize: 11, width: "100%" }} value={draft.currentStatus} onChange={(e) => setComplianceDrafts((d) => ({ ...d, [item.id]: { ...draft, currentStatus: e.target.value } }))}>{["MET", "PARTIAL", "MISSING", "NOT_APPLICABLE", "AWAITING_OFFICIAL_RULE", "UNVERIFIED"].map((v) => <option key={v} value={v}>{STATUS_LABELS[v] ?? v}</option>)}</select>
                <textarea rows={1} style={{ width: "100%", fontSize: 11 }} placeholder="Evidence 佐證（官方來源／校內紀錄）" value={draft.evidence} onChange={(e) => setComplianceDrafts((d) => ({ ...d, [item.id]: { ...draft, evidence: e.target.value } }))} />
                <textarea rows={1} style={{ width: "100%", fontSize: 11 }} placeholder="Required Action" value={draft.requiredAction} onChange={(e) => setComplianceDrafts((d) => ({ ...d, [item.id]: { ...draft, requiredAction: e.target.value } }))} />
              </div>
              <button type="button" className="secondary-button" style={{ marginTop: 6, padding: "3px 8px", fontSize: 10 }} onClick={() => void action("update-compliance-item", { itemId: item.id, currentStatus: draft.currentStatus, evidence: draft.evidence, requiredAction: draft.requiredAction, missingItem: draft.missingItem })}>儲存該項</button>
            </div>;
          })}</div>
        </div>
      )}

      {tab === "rules" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>官方規則來源（Official Rule Snapshot）：所有當年度資料須由最新官方來源取得；不得把年度規定寫死在程式碼。年度未公告時顯示 PENDING_NEW_ANNOUNCEMENT，可使用前一年度資料作規劃參考但不得宣稱符合新年度規範。</p>
          <div className="v13-panel" style={{ padding: 12 }}>
            <p className="section-kicker">新規則快照</p>
            <div style={{ display: "grid", gap: 6 }}>
              <input style={{ fontSize: 12 }} placeholder="文件標題（document_title）" value={ruleDraft.documentTitle ?? ""} onChange={(e) => setRuleDraft((d) => ({ ...d, documentTitle: e.target.value }))} />
              <input style={{ fontSize: 12 }} placeholder="規範要點（requirement）" value={ruleDraft.requirement ?? ""} onChange={(e) => setRuleDraft((d) => ({ ...d, requirement: e.target.value }))} />
              <input style={{ fontSize: 12 }} placeholder="官方來源 URL" value={ruleDraft.sourceUrl ?? ""} onChange={(e) => setRuleDraft((d) => ({ ...d, sourceUrl: e.target.value }))} />
              <select style={{ fontSize: 12 }} value={ruleDraft.verificationStatus ?? "UNVERIFIED"} onChange={(e) => setRuleDraft((d) => ({ ...d, verificationStatus: e.target.value }))}>{["VERIFIED_CURRENT", "VERIFIED_PREVIOUS_YEAR", "PENDING_NEW_ANNOUNCEMENT", "CONFLICTING", "UNVERIFIED"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
              <input style={{ fontSize: 12 }} placeholder="生效日期（YYYY-MM-DD，選填）" value={ruleDraft.effectiveDate ?? ""} onChange={(e) => setRuleDraft((d) => ({ ...d, effectiveDate: e.target.value }))} />
            </div>
            <div className="research-actions" style={{ marginTop: 8 }}><button type="button" className="primary-button" disabled={busy === "save-rule-snapshot" || !ruleDraft.documentTitle || !ruleDraft.requirement} onClick={() => void action("save-rule-snapshot", { authority: activeRoute === "NSTC_PROPOSAL" ? "NSTC" : "MOE_TPR", targetYear: view?.compliance?.targetYear ?? new Date().getUTCFullYear(), documentTitle: ruleDraft.documentTitle, requirement: ruleDraft.requirement, sourceUrl: ruleDraft.sourceUrl || undefined, verificationStatus: ruleDraft.verificationStatus, effectiveDate: ruleDraft.effectiveDate || undefined }, "官方規則快照已記錄。")}>儲存規則快照</button></div>
          </div>
          {(view?.compliance?.snapshots ?? []).length > 0 && <div style={{ marginTop: 8, display: "grid", gap: 6 }}>{(view?.compliance?.snapshots ?? []).map((s) => <div key={s.id} className="v13-panel" style={{ padding: 10 }}><strong style={{ fontSize: 12 }}>{s.documentTitle}</strong><span className="v13-badge" style={{ marginLeft: 8 }}>{s.verificationStatus}</span><p className="v13-muted" style={{ fontSize: 11, margin: "4px 0 0" }}>{s.requirement}{s.sourceUrl ? ` ｜ ${s.sourceUrl}` : ""} ｜ 取得時間：{new Date(s.retrievedAt).toLocaleString()}</p></div>)}</div>}
        </div>
      )}

      {tab === "tasks" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>修訂工作區：Reviewer Finding 可轉換成 Revision Task；不得直接覆蓋已核准的 Proposal Draft，每次修訂建立新版本。</p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{(view?.revisionTasks ?? []).length === 0 ? <p className="v13-muted">尚無修訂任務。在 Reviewer 模擬中點「轉為修訂任務」建立。</p> : (view?.revisionTasks ?? []).map((t) => <div key={t.id} className="v13-panel" style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 12 }}>[{t.severity}] {t.requiredAction}</strong><span className="v13-badge">{t.status}</span></div>
            <p className="v13-muted" style={{ fontSize: 10, margin: "4px 0" }}>{t.affectedSection ?? "—"} ｜ owner：{t.owner ?? "未指派"}{t.dueDate ? ` ｜ 期限：${t.dueDate}` : ""}</p>
            {t.resolutionNote && <p style={{ fontSize: 11 }}>紀錄：{t.resolutionNote}</p>}
            <div className="research-actions" style={{ marginTop: 6, gap: 6, flexWrap: "wrap" }}>
              <input style={{ fontSize: 11, flex: 1, minWidth: 160 }} placeholder="解決紀錄／後續版本" value={taskNotes[t.id] ?? ""} onChange={(e) => setTaskNotes((d) => ({ ...d, [t.id]: e.target.value }))} />
              {["IN_PROGRESS", "RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"].filter((s) => t.status !== s).map((s) => <button key={s} type="button" className="secondary-button" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => void action("update-revision-task", { taskId: t.id, status: s, resolutionNote: taskNotes[t.id] || undefined })}>→ {s}</button>)}
            </div>
          </div>)}</div>
        </div>
      )}

      {tab === "gates" && (
        <div className="v13-panel" style={{ padding: 12 }}>
          <p className="section-kicker">階段門檻</p>
          <h3 style={{ margin: "0 0 6px" }}>Gate 狀態</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {Object.entries(view?.gateStates ?? {}).map(([gate, passed]) => <div key={gate} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #eef2ef" }}><span style={{ fontSize: 12 }}>{gate}</span><span className="v13-badge" style={{ background: passed ? "#e0efe5" : "#e7ebe7", color: passed ? "#2f6f4f" : "var(--muted)" }}>{passed ? "PASSED ✓" : "NOT PASSED"}</span></div>)}
          </div>
          <div className="research-actions" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            {activeRoute === "MOE_TPR_PROPOSAL" && <button type="button" className="primary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", { gateType: "MOE_TPR_ELIGIBILITY_PASSED" }, "MOE_TPR_ELIGIBILITY_PASSED 已核准。")}>核准 MOE_TPR_ELIGIBILITY_PASSED</button>}
            <button type="button" className="primary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", { gateType: activeRoute === "NSTC_PROPOSAL" ? "NSTC_INTERNAL_REVIEW_PASSED" : "MOE_TPR_INTERNAL_REVIEW_PASSED" }, "內部審查 Gate 已核准。")}>核准內部審查 Gate</button>
            <button type="button" className="primary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", { gateType: activeRoute === "NSTC_PROPOSAL" ? "NSTC_COMPLIANCE_PASSED" : "MOE_TPR_COMPLIANCE_PASSED" }, "合規 Gate 已核准。")}>核准合規 Gate</button>
          </div>
        </div>
      )}
    </div>
  );
}
