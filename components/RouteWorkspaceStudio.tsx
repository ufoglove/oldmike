"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import OldMikeAssistControl from "./OldMikeAssistControl";
import { ROUTE_SECTION_DEFS, type RouteSectionDef } from "@/lib/route-section-catalog";

type RouteKey = "JOURNAL_PLANNING" | "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL";
type SectionRecord = { sectionId: string; title: string; objective: string | null; outline: unknown[]; draftContent: string; evidenceLinks: unknown[]; citationSources: unknown[]; zoteroItems: unknown[]; status: string; userApproved: boolean; provenance: string; version: number; updatedAt: string };

const ROUTE_META: Record<RouteKey, { title: string; sub: string; label: string }> = {
  JOURNAL_PLANNING: { title: "國際期刊研究規劃", sub: "Journal Research Planning Studio", label: "期刊" },
  NSTC_PROPOSAL: { title: "國科會計畫書", sub: "NSTC Proposal Studio", label: "國科會" },
  MOE_TPR_PROPOSAL: { title: "教學實踐計畫書", sub: "MOE Teaching Practice Proposal Studio", label: "教學實踐" },
};

const SECTIONS_BY_ROUTE: Record<RouteKey, RouteSectionDef[]> = ROUTE_SECTION_DEFS;

function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

type WorkspaceView = { workspace: { id: string; workspaceRole: string; status: string; sections: SectionRecord[]; gates: unknown[]; courseResearchAlignment: unknown[] } | null; designGate: { approved: boolean; missing: string[] }; locked: boolean; lockedReason: string[] };

export default function RouteWorkspaceStudio({ projectId, onOpenEvidence, onOpenEthics }: { projectId: string; onOpenEvidence?: (role?: string) => void; onOpenEthics?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [views, setViews] = useState<Record<RouteKey, WorkspaceView | null>>({ JOURNAL_PLANNING: null, NSTC_PROPOSAL: null, MOE_TPR_PROPOSAL: null });
  const [activeRoute, setActiveRoute] = useState<RouteKey | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [aiDrafts, setAiDrafts] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<string>("");
  const [journalFamilyDraft, setJournalFamilyDraft] = useState("");
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/route-workspace`, { cache: "no-store" });
      const data = await res.json() as { ok?: boolean; routes?: Record<string, WorkspaceView | { ok: boolean; error?: string }>; error?: string };
      if (!res.ok || !data.ok) throw new Error(text(data.error) || "無法載入路線工作室。");
      if (data.routes) {
        const next = { JOURNAL_PLANNING: null as WorkspaceView | null, NSTC_PROPOSAL: null as WorkspaceView | null, MOE_TPR_PROPOSAL: null as WorkspaceView | null };
        for (const key of Object.keys(data.routes) as RouteKey[]) {
          const v = data.routes[key];
          if (v && typeof v === "object" && "designGate" in v) next[key] = v as WorkspaceView;
        }
        setViews(next);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "載入失敗。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function action(name: string, body: Record<string, unknown>, success?: string) {
    setError(""); setBusy(name);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/route-workspace`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const payload = await res.json() as { ok?: boolean; error?: string; failed?: { key: string; label: string; detail?: string }[]; status?: string };
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "操作失敗。");
      if (success) setNotice(success);
      await load();
      return payload;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); return null; }
    finally { setBusy(""); }
  }

  function openRoute(route: RouteKey) {
    setActiveRoute(route);
    setActiveSection("");
    const ws = views[route]?.workspace;
    if (ws && ws.sections.length) setActiveSection(ws.sections[0].sectionId);
    setDrafts({});
    setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function createWorkspace(route: RouteKey, role: "PRIMARY" | "SECONDARY") {
    void action("create", { route, role }, `${ROUTE_META[route].title} 工作區已建立（NOT_STARTED）。`);
  }

  function saveSection(route: RouteKey, sectionId: string) {
    const content = drafts[`${route}:${sectionId}`] ?? "";
    const aiOriginated = aiDrafts[`${route}:${sectionId}`] === true;
    void action("update-section", { route, sectionId, draftContent: content, status: content.trim() ? "DRAFT" : "NOT_STARTED", provenance: aiOriginated ? "AI_PROPOSED" : "USER_PROVIDED" }, "段落已儲存（新版本，不覆蓋已核准版）。");
  }

  function approveSection(route: RouteKey, sectionId: string, label: string) {
    void action("update-section", { route, sectionId, userApproved: true, status: "APPROVED", provenance: "USER_REVIEWED" }, `${label}（已記錄為正式版本，AI 標示已移除；原版本保留於歷程）。`);
  }

  const meta = activeRoute ? ROUTE_META[activeRoute] : null;
  const view = activeRoute ? views[activeRoute] : null;

  return (
    <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">研究路線工作室 · 06</p><h3>研究路線工作室</h3></div><p className="v13-panel-note">依主要 Funding／Publication Route 建立：國際期刊研究規劃／國科會計畫書／教學實踐計畫書。所有論述與引用連結既有文獻與證據中心、CitationSource、Zotero。</p></div>
      {error && <p className="v13-error" role="alert">{error}</p>}
      {notice && <p className="v13-notice" role="status">{notice}</p>}
      {loading ? <p className="v13-muted" role="status">載入中…</p> : (
        <>
          {!activeRoute && (
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {(Object.keys(ROUTE_META) as RouteKey[]).map((route) => {
                const v = views[route];
                const ws = v?.workspace;
                return (
                  <div key={route} className="v13-panel" style={{ padding: 14, border: ws ? (ws.workspaceRole === "PRIMARY" ? "2px solid var(--teal)" : "1px solid #dde2dd") : undefined }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <p className="section-kicker">{ROUTE_META[route].sub}</p>
                        <h3 style={{ margin: 0 }}>{ROUTE_META[route].title}</h3>
                      </div>
                      {ws && <span className="v13-badge" style={{ background: ws.workspaceRole === "PRIMARY" ? "var(--teal)" : "#e7ebe7", color: ws.workspaceRole === "PRIMARY" ? "white" : "var(--muted)" }}>{ws.workspaceRole === "PRIMARY" ? "PRIMARY" : ws.workspaceRole === "SECONDARY" ? "SECONDARY" : ws.workspaceRole}</span>}
                    </div>
                    <p className="v13-muted" style={{ margin: "6px 0" }}>{ws ? `狀態：${ws.status} ｜ 版本：v${(ws as { currentVersion?: number }).currentVersion ?? 0}` : v?.locked ? `Locked：${v.lockedReason.join("；") || "研究設計尚未核准"}` : "尚未建立"}</p>
                    {ws ? (
                      <div className="research-actions" style={{ marginTop: 8 }}>
                        <button type="button" className="primary-button" onClick={() => openRoute(route)}>{ws.status === "OUTDATED" ? "檢視（OUTDATED 需更新）→" : "進入工作區 →"}</button>
                        {ws.status === "OUTDATED" && <span className="v13-badge" style={{ background: "#f5e6ce", color: "#9b5d16" }}>上游變更，需重新檢視</span>}
                      </div>
                    ) : (
                      <div className="research-actions" style={{ marginTop: 8 }}>
                        {v?.locked ? <p className="v13-muted">研究設計核准後可建立。</p> : <button type="button" className="primary-button" disabled={busy === "create"} onClick={() => createWorkspace(route, route === "JOURNAL_PLANNING" ? "PRIMARY" : "SECONDARY")}>＋ 建立{ROUTE_META[route].label}工作區</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {activeRoute && meta && view && (
            <div ref={sectionRef} style={{ marginTop: 12 }}>
              <div className="v13-actions" style={{ flexWrap: "wrap" }}>
                <button type="button" className="secondary-button" onClick={() => setActiveRoute(null)}>← 回到三路線</button>
                <strong style={{ fontSize: 14 }}>{meta.title} {view.workspace ? `（${view.workspace.workspaceRole} · ${view.workspace.status}）` : ""}</strong>
                {activeRoute === "JOURNAL_PLANNING" && <input aria-label="目標期刊或期刊家族" style={{ fontSize: 11, minWidth: 220, flex: "0 1 260px" }} placeholder="目標期刊或期刊家族（Gate 需此項；例：SSCI 教育科技領域期刊）" value={journalFamilyDraft} onChange={(event) => setJournalFamilyDraft(event.target.value)} />}
                <button type="button" className="secondary-button" onClick={() => { setActiveSection(""); setActiveRoute(null); void action("gate", { route: activeRoute, payload: journalFamilyDraft.trim() ? { journalFamily: journalFamilyDraft.trim() } : {} }); }}>執行 Gate 檢查</button>
                <button type="button" className="primary-button" onClick={() => void action("gate", { route: activeRoute, payload: journalFamilyDraft.trim() ? { journalFamily: journalFamilyDraft.trim() } : {}, lock: true }, `${meta.title} 已核准（Gate 通過）。`)}>核准（Gate 全過時）</button>{view.workspace?.status === "APPROVED" && onOpenEthics && <button type="button" className="primary-button" style={{ background: "linear-gradient(90deg,#0f7a3d,#22a35a)" }} onClick={onOpenEthics}>已核准 · 前往研究倫理／IRB 中心 →</button>}
              </div>
              {view.locked && !view.workspace && <div className="v13-empty"><strong>ROUTE_WORKSPACE_LOCKED</strong><p>{view.lockedReason.join("；") || "研究設計尚未核准；無法建立路線工作室。"}</p></div>}
              {view.workspace && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {SECTIONS_BY_ROUTE[activeRoute].map((sec) => {
                      const existing = view.workspace!.sections.find((s) => s.sectionId === sec.id);
                      return <button key={sec.id} type="button" className={activeSection === sec.id ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => { setActiveSection(sec.id); setDrafts((d) => { if (!(d[`${activeRoute}:${sec.id}`] !== undefined)) return { ...d, [`${activeRoute}:${sec.id}`]: existing?.draftContent ?? "" }; return d; }); }}>{existing && existing.status !== "NOT_STARTED" ? "✓ " : ""}{sec.title}</button>;
                    })}
                  </div>
                  {(() => {
                    const sec = SECTIONS_BY_ROUTE[activeRoute].find((s) => s.id === activeSection);
                    if (!sec) return <p className="v13-muted">請選擇上方段落開始撰寫。</p>;
                    const existing = view.workspace!.sections.find((s) => s.sectionId === sec.id);
                    const draftKey = `${activeRoute}:${sec.id}`;
                    const content = drafts[draftKey] ?? existing?.draftContent ?? "";
                    return (
                      <div className="v13-panel" style={{ padding: 12 }}>
                        <p className="section-kicker">{sec.id.toUpperCase()}</p>
                        <h3 style={{ margin: "0 0 4px" }}>{sec.title}</h3>
                        <p className="v13-muted" style={{ fontSize: 11 }}>{sec.objective}</p>
                        {existing && <p className="v13-muted" style={{ fontSize: 10 }}>狀態：{existing.status}{existing.userApproved ? "（已核准）" : ""} ｜ v{existing.version} ｜ 來源：{existing.provenance === "AI_PROPOSED" ? "AI 草稿（待你確認為正式）" : existing.provenance === "USER_REVIEWED" ? "正式版本（已確認）" : "研究者自行撰寫"}</p>}
                        <div className="research-actions" style={{ marginTop: 6, gap: 6, flexWrap: "wrap" }}>
                          <OldMikeAssistControl projectId={projectId} surface="ROUTE_WORKSPACE_SECTION" targetId={sec.id} currentValue={content} contextSnapshot={{ sectionId: sec.id, route: activeRoute, sectionTitle: sec.title, goal: sec.objective }} currentProvenance={content.trim() && !existing?.userApproved ? "USER_PROVIDED" : undefined} label="老麥：一鍵草稿／深入建議（先預覽再套用）" onApply={(value) => { setDrafts((d) => ({ ...d, [draftKey]: value })); setAiDrafts((d) => ({ ...d, [draftKey]: true })); return true; }} />
                          <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => onOpenEvidence?.()}>📖 前往文獻與證據中心</button>
                          <span className="v13-muted" style={{ fontSize: 10 }}>引用只能來自專案文獻／Evidence Matrix／CitationSource／Zotero；無來源顯示 CITATION NEEDED</span>
                        </div>
                        <textarea rows={10} style={{ width: "100%", marginTop: 8, fontSize: 12, minHeight: 160 }} value={content} onChange={(event) => setDrafts((d) => ({ ...d, [draftKey]: event.target.value }))} placeholder={`撰寫 ${sec.title} 草稿…（不得虛構文獻/DOI/結果；結果未取得時標示 NOT YET AVAILABLE）`} />
                        <div className="research-actions" style={{ marginTop: 8 }}>
                          <button type="button" className="primary-button" disabled={busy === "update-section"} onClick={() => saveSection(activeRoute, sec.id)}>儲存段落</button>
                          {(() => {
                            if (!existing || existing.status === "APPROVED") return null;
                            const isAi = existing.provenance === "AI_PROPOSED" || aiDrafts[draftKey] === true;
                            return <button type="button" className={isAi ? "primary-button" : "secondary-button"} disabled={busy === "update-section" || !(content.trim())} onClick={() => approveSection(activeRoute, sec.id, isAi ? "已一鍵轉為正式版本（AI 標示已移除）" : "段落已標記核准（鎖定此版）")}>{isAi ? "✓ 一鍵轉為正式版本（移除 AI 標示）" : "標記已核准（鎖定此版）"}</button>;
                          })()}
                        </div>
                        {existing && existing.evidenceLinks.length > 0 && <p className="v13-muted" style={{ marginTop: 6, fontSize: 10 }}>已連結證據：{existing.evidenceLinks.length} 筆</p>}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
