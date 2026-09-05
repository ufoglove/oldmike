"use client";

import { useCallback, useEffect, useState } from "react";

type RouteKey = "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL";
type PackageFile = { id: string; fileType: string; title: string; content: string; version: string; generatedAt: string | null; approvedByUser: boolean; sourceSections: unknown[]; evidenceLinks: unknown[]; status: string; updatedAt: string };
type PackageView = {
  ok?: boolean; locked?: boolean; route?: RouteKey; lockedReason?: string[];
  package?: { id: string; status: string; version: number; files: PackageFile[] } | null;
  submission?: { id: string; route: string; status: string; evidence: string | null; updatedAt: string } | null;
  grantDecisions?: { id: string; authority: string; decision: string; decisionDate: string | null; amount: number | null; applicationNumber: string | null; conditions: unknown[]; fileReference: string | null; verifiedByUser: boolean; createdAt: string }[];
  gates?: { internalApproved: boolean; complianceApproved: boolean; packageApproved: boolean; ready: boolean };
  fileSpecs?: { fileType: string; title: string }[];
  error?: string;
};
const ROUTE_META: Record<RouteKey, { title: string; sub: string }> = {
  NSTC_PROPOSAL: { title: "國科會計畫申請包", sub: "NSTC Application Package" },
  MOE_TPR_PROPOSAL: { title: "教學實踐計畫申請包", sub: "MOE Teaching Practice Application Package" },
};
const SUBMISSION_LABELS: Record<string, string> = { NOT_READY: "尚未準備完成", INTERNAL_REVIEW: "內部審查中", READY_FOR_INSTITUTIONAL_SUBMISSION: "可送校內", SUBMITTED_TO_INSTITUTION: "已送校內", SUBMITTED_TO_AUTHORITY: "已送官方", UNDER_REVIEW: "審查中", REVISION_REQUESTED: "要求修正", APPROVED: "已核定", NOT_APPROVED: "未核定", WITHDRAWN: "已撤回" };

export default function ApplicationPackageStudio({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [views, setViews] = useState<Record<RouteKey, PackageView | null>>({ NSTC_PROPOSAL: null, MOE_TPR_PROPOSAL: null });
  const [activeRoute, setActiveRoute] = useState<RouteKey | null>(null);
  const [activeFile, setActiveFile] = useState("");
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({});
  const [submissionDraft, setSubmissionDraft] = useState<Record<string, string>>({});
  const [grantDraft, setGrantDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/application-package`, { cache: "no-store" });
      const json = await res.json() as { ok?: boolean; routes?: Record<string, PackageView>; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "無法載入申請包。");
      const next = { NSTC_PROPOSAL: null as PackageView | null, MOE_TPR_PROPOSAL: null as PackageView | null };
      for (const key of ["NSTC_PROPOSAL", "MOE_TPR_PROPOSAL"] as RouteKey[]) {
        const v = json.routes?.[key];
        if (v && typeof v === "object") next[key] = v as PackageView;
      }
      setViews(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "載入失敗。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function action(name: string, body: Record<string, unknown>, success?: string) {
    setError(""); setBusy(name);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/application-package`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, route: activeRoute, ...body }) });
      const payload = await res.json() as { ok?: boolean; error?: string; failed?: { key: string; label: string; detail?: string }[] };
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "操作失敗。");
      if (success) setNotice(success);
      await load();
      return payload;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); return null; }
    finally { setBusy(""); }
  }

  function openRoute(route: RouteKey) { setActiveRoute(route); setActiveFile(""); setFileDrafts({}); setSubmissionDraft({}); setGrantDraft({}); }
  function back() { setActiveRoute(null); }

  if (loading) return <div className="v13-panel" style={{ marginTop: 10 }}><p className="v13-muted" role="status">載入中…</p></div>;

  if (!activeRoute) {
    return (
      <div className="v13-panel" style={{ marginTop: 10 }}>
        <div className="v13-panel-head"><div><p className="section-kicker">計畫申請包 · 07</p><h3>計畫申請包</h3></div><p className="v13-panel-note">國科會與教學實踐共用申請包結構，內容依 Route 產生。正式送件狀態需使用者操作或可驗證紀錄；網站不自動宣稱已送件。</p></div>
        {error && <p className="v13-error" role="alert">{error}</p>}
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {(Object.keys(ROUTE_META) as RouteKey[]).map((route) => {
            const v = views[route];
            return <div key={route} className="v13-panel" style={{ padding: 14 }}>
              <div><p className="section-kicker">{ROUTE_META[route].sub}</p><h3 style={{ margin: 0 }}>{ROUTE_META[route].title}</h3></div>
              {v?.locked ? <p className="v13-muted" style={{ margin: "6px 0" }}>Locked：{(v.lockedReason ?? []).join("；")}</p> : <p className="v13-muted" style={{ margin: "6px 0" }}>{v?.package ? `狀態：${v.package.status} ｜ 核准檔案 ${v.package.files.filter((f) => f.approvedByUser).length}/${v.package.files.length}` : ""}{v?.gates?.ready ? " ｜ ✅ READY_FOR_INSTITUTIONAL_SUBMISSION" : ""}</p>}
              {!v?.locked && <button type="button" className="primary-button" style={{ marginTop: 8 }} onClick={() => openRoute(route)}>進入申請包 →</button>}
            </div>;
          })}
        </div>
      </div>
    );
  }

  const view = views[activeRoute];
  const files = view?.package?.files ?? [];

  return (
    <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">{ROUTE_META[activeRoute].sub} · 07</p><h3>{ROUTE_META[activeRoute].title}</h3></div><p className="v13-panel-note">申請包狀態：{view?.package?.status ?? "—"} ｜ 版本 v{view?.package?.version ?? 0}{view?.gates?.ready ? " ｜ ✅ READY_FOR_INSTITUTIONAL_SUBMISSION（不表示已送件）" : ""}</p></div>
      {error && <p className="v13-error" role="alert">{error}</p>}
      {notice && <p className="v13-notice" role="status">{notice}</p>}
      <div className="research-actions" style={{ flexWrap: "wrap", marginBottom: 8 }}><button type="button" className="secondary-button" onClick={back}>← 回到路線選擇</button><button type="button" className="primary-button" disabled={busy === "approve-package"} onClick={() => void action("approve-package", {}, "申請包已達 READY_FOR_INSTITUTIONAL_SUBMISSION（需內部審查＋合規＋全檔案核准）。")}>核准申請包（Gate 全過時）</button></div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{files.map((f) => <button key={f.fileType} type="button" className={activeFile === f.fileType ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => { setActiveFile(f.fileType); setFileDrafts((d) => ({ ...d, [f.fileType]: d[f.fileType] ?? f.content })); }}>{f.approvedByUser ? "✓ " : ""}{f.title}</button>)}</div>
      {(() => {
        const file = files.find((f) => f.fileType === activeFile);
        if (!file) return <p className="v13-muted">請選擇申請包檔案開始編輯。</p>;
        const content = fileDrafts[file.fileType] ?? file.content;
        return <div className="v13-panel" style={{ padding: 12 }}>
          <p className="section-kicker">{file.fileType} · {file.version}{file.approvedByUser ? " ｜ 已核准（鎖定）" : ""}</p>
          <h3 style={{ margin: "0 0 4px" }}>{file.title}</h3>
          <textarea rows={12} style={{ width: "100%", marginTop: 6, fontSize: 12 }} value={content} onChange={(e) => setFileDrafts((d) => ({ ...d, [file.fileType]: e.target.value }))} placeholder="撰寫／彙整申請包內容…（不虛構經費、頁數、截止日期、核定狀態）" disabled={file.approvedByUser} />
          <div className="research-actions" style={{ marginTop: 8, gap: 6 }}>
            <button type="button" className="primary-button" disabled={busy === "save-file" || file.approvedByUser} onClick={() => void action("save-file", { fileType: file.fileType, content }, "申請包檔案已儲存。")}>儲存</button>
            {!file.approvedByUser && <button type="button" className="secondary-button" disabled={busy === "approve-file" || !content.trim()} onClick={() => void action("approve-file", { fileType: file.fileType }, "檔案已標記核准（鎖定此版）。")}>標記核准</button>}
          </div>
        </div>;
      })()}

      <div className="v13-panel" style={{ padding: 12, marginTop: 10 }}>
        <p className="section-kicker">送件紀錄</p>
        <h3 style={{ margin: "0 0 6px" }}>正式送件狀態</h3>
        <p className="v13-muted" style={{ fontSize: 11 }}>現況：{view?.submission ? SUBMISSION_LABELS[view.submission.status] ?? view.submission.status : "NOT_READY"}。狀態變更需使用者明確操作或可驗證紀錄；SUBMITTED 以上需填寫證據。</p>
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          <select style={{ fontSize: 12 }} value={submissionDraft.status ?? view?.submission?.status ?? "NOT_READY"} onChange={(e) => setSubmissionDraft((d) => ({ ...d, status: e.target.value }))}>{Object.entries(SUBMISSION_LABELS).map(([v, label]) => <option key={v} value={v}>{label}（{v}）</option>)}</select>
          <textarea rows={2} style={{ width: "100%", fontSize: 12 }} placeholder="證據（送件編號／日期／校內承辦紀錄）" value={submissionDraft.evidence ?? view?.submission?.evidence ?? ""} onChange={(e) => setSubmissionDraft((d) => ({ ...d, evidence: e.target.value }))} />
        </div>
        <button type="button" className="primary-button" style={{ marginTop: 8 }} disabled={busy === "update-submission"} onClick={() => void action("update-submission", { status: submissionDraft.status ?? "NOT_READY", evidence: submissionDraft.evidence ?? "" }, "送件狀態已更新（使用者操作）。")}>更新送件狀態</button>
      </div>

      <div className="v13-panel" style={{ padding: 12, marginTop: 10 }}>
        <p className="section-kicker">補助決策紀錄</p>
        <h3 style={{ margin: "0 0 6px" }}>核定紀錄</h3>
        <p className="v13-muted" style={{ fontSize: 11 }}>只有真實核定文件（決議日期＋申請編號＋已核對）才可記錄 APPROVED。</p>
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          <input style={{ fontSize: 12 }} placeholder="核定單位（Authority）" value={grantDraft.authority ?? ""} onChange={(e) => setGrantDraft((d) => ({ ...d, authority: e.target.value }))} />
          <input style={{ fontSize: 12 }} placeholder="申請編號" value={grantDraft.applicationNumber ?? ""} onChange={(e) => setGrantDraft((d) => ({ ...d, applicationNumber: e.target.value }))} />
          <input style={{ fontSize: 12 }} placeholder="決議日期（YYYY-MM-DD）" value={grantDraft.decisionDate ?? ""} onChange={(e) => setGrantDraft((d) => ({ ...d, decisionDate: e.target.value }))} />
          <select style={{ fontSize: 12 }} value={grantDraft.decision ?? "PENDING"} onChange={(e) => setGrantDraft((d) => ({ ...d, decision: e.target.value }))}>{["APPROVED", "NOT_APPROVED", "PENDING", "REVISION_REQUESTED", "WITHDRAWN"].map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <label style={{ fontSize: 11 }}><input type="checkbox" checked={grantDraft.verified === "1"} onChange={(e) => setGrantDraft((d) => ({ ...d, verified: e.target.checked ? "1" : "" }))} /> 我已核對並上傳核定文件</label>
        </div>
        <button type="button" className="primary-button" style={{ marginTop: 8 }} disabled={busy === "save-grant-decision"} onClick={() => void action("save-grant-decision", { authority: grantDraft.authority ?? "", applicationNumber: grantDraft.applicationNumber ?? "", decisionDate: grantDraft.decisionDate || undefined, decision: grantDraft.decision ?? "PENDING", verifiedByUser: grantDraft.verified === "1" }, "核定紀錄已儲存。")}>儲存核定紀錄</button>
        {(view?.grantDecisions ?? []).length > 0 && <div style={{ marginTop: 8, display: "grid", gap: 4 }}>{(view?.grantDecisions ?? []).map((g) => <div key={g.id} style={{ fontSize: 11 }}><strong>{g.authority}</strong> ｜ {g.decision} ｜ {g.decisionDate ?? "—"}{g.applicationNumber ? ` ｜ ${g.applicationNumber}` : ""}{g.verifiedByUser ? " ｜ 已核對" : ""}</div>)}</div>}
      </div>
    </div>
  );
}
