"use client";

import { useCallback, useEffect, useState } from "react";

type LiteratureItem = {
  literatureId: string; linkId: string | null; title: string;
  authors: { given?: string; family?: string }[]; year: number | null; journal: string | null;
  doi: string | null; url: string | null; source: string; citationCount: number | null; tags: string[];
  zoteroItemKey: string | null; zoteroCollectionKey: string | null;
  role: string[]; readingStatus: string; evidenceStatus: string; relevanceScore: number | null;
  priority: number | null; notes: string | null;
  rqLinks: { rqKey: string; relationship: string }[];
  analysisCard: Record<string, unknown> | null;
  zoteroSyncStatus: string;
};
type MatrixRow = Record<string, unknown>;
type ZoteroStatus = { connection: { libraryType: string | null; libraryId: string | null; collectionKey: string | null; collectionName: string | null; authMethod: string | null; lastSyncedAt: string | null; syncStatus: string | null; hasApiKey: boolean } | null; projectZotero: Record<string, unknown> | null };

const ROLES = ["CORE", "GAP", "THEORY", "METHOD", "MEASUREMENT", "SIMILAR_STUDY", "SUPPORTING", "DISCUSSION", "BACKGROUND"];
const READING = ["DISCOVERED", "ABSTRACT_REVIEWED", "FULLTEXT_AVAILABLE", "FULLTEXT_REVIEWED", "KEY_PAPER", "EXCLUDED"];
const EVIDENCE = ["VERIFIED", "SUPPORTED", "INFERRED", "UNVERIFIED"];
const SECTIONS = ["Introduction", "Theory", "Methods", "Results", "Discussion"];
const FILTERS = ["全部", "Core", "Gap", "Theory", "Method", "Measurement", "Similar Studies", "Discussion", "Unread", "Full-text Reviewed", "Zotero Synced"];

function filterFromRole(role: string): string {
  switch (role) {
    case "GAP": return "Gap";
    case "THEORY": return "Theory";
    case "METHOD": return "Method";
    case "MEASUREMENT": return "Measurement";
    case "SIMILAR_STUDY": return "Similar Studies";
    case "CORE": return "Core";
    case "DISCUSSION": return "Discussion";
    default: return "全部";
  }
}

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function row(value: unknown): Record<string, unknown> { return record(value) ? value : {}; }
function authorsLabel(authors: unknown): string { return list(authors).map((a) => { const r = row(a); return `${text(r.family)}${text(r.given) ? `, ${text(r.given)}` : ""}`; }).slice(0, 3).join("; "); }

const EMPTY_CARD = { researchProblem: "", theory: "", population: "", method: "", variables: "", mainFindings: "", limitations: "", futureResearch: "", researchGap: "", supportsMyProject: "", differsFromMyProject: "", userNotes: "" };

export default function LiteratureEvidenceCenter({ projectId, initialRole }: { projectId: string; initialRole?: string }) {
  const [items, setItems] = useState<LiteratureItem[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [view, setView] = useState<"list" | "matrix" | "review">("list");
  const [filter, setFilter] = useState(initialRole ? filterFromRole(initialRole) : "全部");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [zotero, setZotero] = useState<ZoteroStatus | null>(null);
  const [cardFor, setCardFor] = useState<LiteratureItem | null>(null);
  const [cardForm, setCardForm] = useState<Record<string, string>>(EMPTY_CARD);
  const [cardSections, setCardSections] = useState<string[]>([]);
  const [rqFor, setRqFor] = useState<LiteratureItem | null>(null);
  const [rqText, setRqText] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectForm, setConnectForm] = useState({ apiKey: "", libraryId: "", collectionKey: "", collectionName: "" });
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", doi: "", url: "", year: "" });

  const load = useCallback(async () => {
    setError("");
    try {
      const [litRes, zotRes] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}/literature`, { cache: "no-store" }),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/zotero`, { cache: "no-store" }),
      ]);
      const lit = await litRes.json() as { ok?: boolean; items?: LiteratureItem[]; matrix?: MatrixRow[]; error?: string };
      if (!litRes.ok || !lit.ok) throw new Error(text(lit.error) || "無法載入文獻。");
      setItems(lit.items ?? []);
      setMatrix(lit.matrix ?? []);
      const zot = await zotRes.json().catch(() => null) as ZoteroStatus | null;
      setZotero(zot);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "無法載入文獻與證據中心。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  function filteredItems() {
    const value = (item: LiteratureItem) => {
      switch (filter) {
        case "Core": return item.role.includes("CORE");
        case "Gap": return item.role.includes("GAP");
        case "Theory": return item.role.includes("THEORY");
        case "Method": return item.role.includes("METHOD") || item.role.includes("MEASUREMENT");
        case "Measurement": return item.role.includes("MEASUREMENT");
        case "Similar Studies": return item.role.includes("SIMILAR_STUDY");
        case "Discussion": return item.role.includes("DISCUSSION");
        case "Unread": return item.readingStatus === "DISCOVERED";
        case "Full-text Reviewed": return ["FULLTEXT_REVIEWED", "KEY_PAPER"].includes(item.readingStatus);
        case "Zotero Synced": return item.zoteroSyncStatus === "SYNCED";
        default: return true;
      }
    };
    return items.filter(value);
  }

  // 快速審閱佇列：導航匯入（NAVIGATOR_IMPORT）＋未讀＋未指派角色的文獻優先
  function reviewQueue() {
    return items
      .filter((item) => item.source === "NAVIGATOR_IMPORT" || item.readingStatus === "DISCOVERED" || item.role.length === 0)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.readingStatus === "DISCOVERED" ? -1 : 1) || a.title.localeCompare(b.title, "zh-Hant"));
  }

  async function patchLink(item: LiteratureItem, patch: Record<string, unknown>) {
    setError(""); setBusy(item.literatureId);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/literature/${encodeURIComponent(item.literatureId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "更新失敗。");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "更新失敗。"); }
    finally { setBusy(""); }
  }

  function openCard(item: LiteratureItem) {
    const card = row(item.analysisCard);
    setCardFor(item);
    setCardForm({
      researchProblem: text(card.researchProblem), theory: text(card.theory), population: text(card.population),
      method: text(card.method), variables: text(card.variables), mainFindings: text(card.mainFindings),
      limitations: text(card.limitations), futureResearch: text(card.futureResearch), researchGap: text(card.researchGap),
      supportsMyProject: text(card.supportsMyProject), differsFromMyProject: text(card.differsFromMyProject), userNotes: text(card.userNotes),
    });
    setCardSections(list(card.usefulForSections).map((s) => text(s)));
  }

  async function saveCard() {
    if (!cardFor) return;
    setError(""); setBusy("card");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/literature/${encodeURIComponent(cardFor.literatureId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analysis-card", card: { ...cardForm, usefulForSections: cardSections } }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "分析卡儲存失敗。");
      setNotice("分析卡已儲存。"); setCardFor(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "分析卡儲存失敗。"); }
    finally { setBusy(""); }
  }

  function openRq(item: LiteratureItem) { setRqFor(item); setRqText(item.rqLinks.map((l) => `${l.rqKey}:${l.relationship}`).join("\n")); }

  async function saveRq() {
    if (!rqFor) return;
    setError(""); setBusy("rq");
    try {
      const links = rqText.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [rqKey, relationship] = line.split(":"); return { rqKey: rqKey?.trim() || "", relationship: relationship?.trim().toUpperCase() || "" }; }).filter((l) => l.rqKey && ["SUPPORTS", "THEORY", "METHOD", "MEASUREMENT", "COMPARES", "BACKGROUND", "GAP", "DISCUSSION"].includes(l.relationship));
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/literature/${encodeURIComponent(rqFor.literatureId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rq-links", links }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "RQ 連結儲存失敗。");
      setNotice(`RQ 連結已儲存（${links.length} 筆）。`); setRqFor(null); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "RQ 連結儲存失敗。"); }
    finally { setBusy(""); }
  }

  async function zoteroAction(action: string, extra: Record<string, unknown> = {}) {
    setError(""); setNotice(""); setBusy("zotero");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/zotero`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const data = await response.json() as { ok?: boolean; error?: string; note?: string; imported?: number };
      if (!response.ok || !data.ok) throw new Error(data.error || "Zotero 操作失敗。");
      setNotice(data.note ?? "Zotero 操作完成。");
      setConnectOpen(false); setConnectForm({ apiKey: "", libraryId: "", collectionKey: "", collectionName: "" });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Zotero 操作失敗。"); }
    finally { setBusy(""); }
  }

  async function addManualItem() {
    if (!addForm.title.trim()) { setError("請輸入文獻標題。"); return; }
    setError(""); setBusy("add");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/literature`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: addForm.title.trim(), doi: addForm.doi.trim() || null, url: addForm.url.trim() || null, year: addForm.year ? Number(addForm.year) : null, source: "MANUAL" }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "新增失敗。");
      setNotice("文獻已新增（DOI 重複時自動合併到既有紀錄）。");
      setAddOpen(false); setAddForm({ title: "", doi: "", url: "", year: "" }); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "新增失敗。"); }
    finally { setBusy(""); }
  }

  async function removeItem(item: LiteratureItem) {
    if (!window.confirm(`確定要將「${item.title.slice(0, 60)}」從本專案移除？文獻本身不會刪除（其他專案仍可使用）。`)) return;
    setError(""); setBusy(item.literatureId);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/literature/${encodeURIComponent(item.literatureId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remove" }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "移除失敗。");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "移除失敗。"); }
    finally { setBusy(""); }
  }

  if (loading) return <section className="v13-panel-stack"><div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">文獻與證據中心</p><h2>文獻與證據中心</h2></div></div><p className="v13-muted" role="status">載入中…</p></div></section>;

  const visible = filteredItems();

  return (
    <section className="v13-panel-stack" data-testid="literature-evidence-center">
      <div className="v13-panel">
        <div className="v13-panel-head">
          <div><p className="section-kicker">文獻與證據中心 · 專案工作區</p><h2>文獻與證據中心</h2></div>
          <p className="v13-panel-note">所有文獻集中儲存於單一文獻庫；此處只顯示本專案關聯與角色。</p>
        </div>
        {error && <p className="v13-error" role="alert">{error}</p>}
        {notice && <p className="v13-notice" role="status">{notice}</p>}

        <div className="v13-actions">
          <button type="button" className={view === "list" ? "primary-button" : "secondary-button"} onClick={() => setView("list")}>文獻列表（{items.length}）</button>
          <button type="button" className={view === "review" ? "primary-button" : "secondary-button"} onClick={() => setView("review")}>快速審閱（{reviewQueue().length}）</button>
          <button type="button" className={view === "matrix" ? "primary-button" : "secondary-button"} onClick={() => setView("matrix")}>Evidence Matrix（{matrix.length}）</button>
          <button type="button" className="secondary-button" onClick={() => setAddOpen((current) => !current)}>新增文獻</button>
          <button type="button" className="secondary-button" onClick={() => zoteroAction("sync")} disabled={busy === "zotero" || !zotero?.connection?.hasApiKey}>Sync Now</button>
          <button type="button" className="secondary-button" onClick={() => setConnectOpen((current) => !current)}>{zotero?.connection?.hasApiKey ? "Zotero 已連線 · 管理" : "CONNECT ZOTERO"}</button>
        </div>

        {connectOpen && (
          <div className="v13-panel" style={{ marginTop: 10 }}>
            <div className="v13-panel-head"><div><p className="section-kicker">Zotero 連線 · Web API v3</p><h3>{zotero?.connection?.hasApiKey ? "Zotero 連線設定" : "連線 Zotero"}</h3></div><p className="v13-panel-note">API Key 只存於伺服器端（加密），不會顯示給其他使用者。未經你確認不會修改你的 Zotero Library。</p></div>
            {zotero?.connection?.hasApiKey ? (
              <div className="v13-details">
                <div><dt>Library</dt><dd>{zotero.connection.libraryType} / {zotero.connection.libraryId}</dd></div>
                <div><dt>Collection</dt><dd>{zotero.connection.collectionKey ?? "未指定"} {zotero.connection.collectionName ? `（${zotero.connection.collectionName}）` : ""}</dd></div>
                <div><dt>Last Sync</dt><dd>{zotero.connection.lastSyncedAt ? new Date(zotero.connection.lastSyncedAt).toISOString() : "尚未同步"}</dd></div>
                <div><dt>Status</dt><dd>{zotero.connection.syncStatus}</dd></div>
              </div>
            ) : (
              <div className="v13-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
                <label className="research-field">Zotero API Key<input type="password" value={connectForm.apiKey} onChange={(event) => setConnectForm({ ...connectForm, apiKey: event.target.value })} placeholder="自 Zotero Settings → Keys 建立（限定權限）" /></label>
                <label className="research-field">Library ID（user ID 或 group ID）<input value={connectForm.libraryId} onChange={(event) => setConnectForm({ ...connectForm, libraryId: event.target.value })} placeholder="例：1234567" /></label>
                <label className="research-field">Collection Key（選填）<input value={connectForm.collectionKey} onChange={(event) => setConnectForm({ ...connectForm, collectionKey: event.target.value })} placeholder="8 字元 key；不填則同步整個 Library" /></label>
                <label className="research-field">Collection 名稱（選填）<input value={connectForm.collectionName} onChange={(event) => setConnectForm({ ...connectForm, collectionName: event.target.value })} /></label>
              </div>
            )}
            <div className="research-actions" style={{ marginTop: 10 }}>
              {zotero?.connection?.hasApiKey ? (
                <button type="button" className="danger-button" onClick={() => zoteroAction("disconnect")} disabled={busy === "zotero"}>DISCONNECT</button>
              ) : (
                <button type="button" className="primary-button" onClick={() => zoteroAction("connect", { ...connectForm, libraryType: "user" })} disabled={busy === "zotero" || !connectForm.apiKey || !connectForm.libraryId}>連線（僅伺服器端儲存）</button>
              )}
              <button type="button" className="secondary-button" onClick={() => setConnectOpen(false)}>關閉</button>
            </div>
          </div>
        )}

        {addOpen && (
          <div className="v13-panel" style={{ marginTop: 10 }}>
            <div className="v13-panel-head"><div><p className="section-kicker">ADD LITERATURE · 手動新增</p><h3>新增文獻（DOI 重複自動合併）</h3></div></div>
            <div className="v13-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
              <label className="research-field">Title *<input value={addForm.title} onChange={(event) => setAddForm({ ...addForm, title: event.target.value })} /></label>
              <label className="research-field">DOI<input value={addForm.doi} onChange={(event) => setAddForm({ ...addForm, doi: event.target.value })} placeholder="10.xxxx/xxxx" /></label>
              <label className="research-field">URL<input value={addForm.url} onChange={(event) => setAddForm({ ...addForm, url: event.target.value })} /></label>
              <label className="research-field">Year<input value={addForm.year} onChange={(event) => setAddForm({ ...addForm, year: event.target.value })} /></label>
            </div>
            <div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="primary-button" onClick={() => void addManualItem()} disabled={busy === "add"}>新增</button><button type="button" className="secondary-button" onClick={() => setAddOpen(false)}>關閉</button></div>
          </div>
        )}

        {view === "list" ? (
          <>
            <div className="v13-actions" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {FILTERS.map((f) => <button key={f} type="button" className={filter === f ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setFilter(f)}>{f}</button>)}
            </div>
            {visible.length === 0 ? <div className="v13-empty"><strong>此專案尚無文獻</strong><p>可從投稿導航建立研究專案時自動匯入、連線 Zotero 同步，或手動新增。</p></div> : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {visible.map((item) => (
                  <div key={item.literatureId} className="v13-panel" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <strong style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word", lineHeight: 1.45 }}>{item.title}</strong>
                      {item.relevanceScore ? <span className="v13-badge">相關 {item.relevanceScore}</span> : null}
                    </div>
                    <p className="v13-muted" style={{ margin: "6px 0", overflowWrap: "anywhere", wordBreak: "break-word" }}>{authorsLabel(item.authors)}{item.year ? ` · ${item.year}` : ""}{item.journal ? ` · ${item.journal}` : ""}{item.doi ? ` · DOI:${item.doi}` : ""}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginTop: 8 }}>
                      <label className="research-field" style={{ marginTop: 0 }}>角色<select value="" onChange={(event) => { const role = event.target.value; if (role) void patchLink(item, { role: [role] }); }} style={{ fontSize: 11 }}><option value="">＋ {item.role.length ? item.role.join(",") : "未指派"}</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
                      <label className="research-field" style={{ marginTop: 0 }}>閱讀<select value={item.readingStatus} onChange={(event) => void patchLink(item, { readingStatus: event.target.value })} style={{ fontSize: 11 }}>{READING.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
                      <label className="research-field" style={{ marginTop: 0 }}>證據<select value={item.evidenceStatus} onChange={(event) => void patchLink(item, { evidenceStatus: event.target.value })} style={{ fontSize: 11 }}>{EVIDENCE.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
                    </div>
                    {item.notes ? <p className="v13-muted" style={{ margin: "6px 0 0", overflowWrap: "anywhere" }}>備註：{item.notes}</p> : null}
                    <div className="research-actions" style={{ marginTop: 8, flexWrap: "wrap", gap: 6 }}>
                      <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => openCard(item)}>分析卡</button>
                      <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => openRq(item)}>RQ</button>
                      <span className="v13-badge">{item.zoteroSyncStatus}</span>
                      {item.zoteroSyncStatus !== "SYNCED" && <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => { if (window.confirm(`確定將「${item.title.slice(0, 50)}」加入 Zotero？此操作會寫入你的 Zotero Library。`)) void zoteroAction("export", { literatureId: item.literatureId }); }}>加入Zotero</button>}
                      <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 11, color: "var(--danger, #b42318)" }} onClick={() => void removeItem(item)}>移除</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : view === "review" ? (
          <>
            <div className="v13-actions" style={{ marginTop: 10, flexWrap: "wrap" }}><button type="button" className="secondary-button" onClick={() => setView("list")}>回到文獻列表</button></div>
            {reviewQueue().length === 0 ? <div className="v13-empty"><strong>待審文獻已全部完成 🎉</strong><p>沒有 NAVIGATOR_IMPORT／未讀／未指派角色的文獻。</p></div> : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }} data-testid="literature-quick-review">
                {reviewQueue().map((item) => (
                  <div key={item.literatureId} className="v13-panel" style={{ padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ flex: 1 }}>{item.title.slice(0, 100)}{item.title.length > 100 ? "…" : ""}</strong>
                      {item.priority !== null && item.priority >= 1 && <span className="v13-badge">高契合</span>}
                      {item.source === "NAVIGATOR_IMPORT" && <span className="v13-badge">導航匯入</span>}
                    </div>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>{item.year ?? ""}{item.journal ? ` · ${item.journal}` : ""}{item.doi ? ` · ${item.doi}` : ""}</p>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>目前：角色 [{item.role.join(", ") || "—"}] ｜ 閱讀 {item.readingStatus} ｜ 證據 {item.evidenceStatus}</p>
                    <div style={{ marginTop: 6 }}>
                      <span className="v13-muted" style={{ fontSize: 12 }}>角色（點擊加入，可多選）：</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        {["CORE", "GAP", "THEORY", "METHOD", "MEASUREMENT", "SIMILAR_STUDY", "SUPPORTING"].map((role) => (
                          <button key={role} type="button" disabled={busy === item.literatureId} className={item.role.includes(role) ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { if (!item.role.includes(role)) void patchLink(item, { role: [role] }); }}>{role}{item.role.includes(role) ? " ✓" : ""}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span className="v13-muted" style={{ fontSize: 12 }}>閱讀狀態：</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        {([["ABSTRACT_REVIEWED", "已讀摘要"], ["FULLTEXT_REVIEWED", "已讀全文"], ["KEY_PAPER", "關鍵文獻"]] as const).map(([value, label]) => (
                          <button key={value} type="button" disabled={busy === item.literatureId} className={item.readingStatus === value ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { if (item.readingStatus !== value) void patchLink(item, { readingStatus: value }); }}>{label}{item.readingStatus === value ? " ✓" : ""}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span className="v13-muted" style={{ fontSize: 12 }}>證據狀態（確認屬實才標記）：</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                        {([["VERIFIED", "已驗證"], ["SUPPORTED", "有支持"], ["UNVERIFIED", "未驗證"]] as const).map(([value, label]) => (
                          <button key={value} type="button" disabled={busy === item.literatureId} className={item.evidenceStatus === value ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => { if (item.evidenceStatus !== value) void patchLink(item, { evidenceStatus: value }); }}>{label}{item.evidenceStatus === value ? " ✓" : ""}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="v13-table-wrap" style={{ marginTop: 10 }}>
            <table>
              <caption className="sr-only">Evidence Matrix</caption>
              <thead><tr><th>Paper</th><th>Role</th><th>Year</th><th>Main Finding</th><th>Limitation</th><th>Gap</th><th>Supports RQ</th><th>Evidence</th></tr></thead>
              <tbody>
                {matrix.length === 0 ? <tr><td colSpan={8}><div className="v13-empty"><strong>尚無 Matrix 資料</strong><p>先新增並標記文獻角色，Matrix 會自動依專案產生（直接讀取文獻關聯，不另建資料）。</p></div></td></tr> : matrix.map((m, index) => (
                  <tr key={index}>
                    <td>{text(m.title)}</td>
                    <td>{list(m.role).map((r) => text(r)).join(",") || "—"}</td>
                    <td>{m.year ? text(m.year) : ""}</td>
                    <td>{text(m.mainFindings)?.slice(0, 80) || ""}</td>
                    <td>{text(m.limitations)?.slice(0, 80) || ""}</td>
                    <td>{text(m.researchGap)?.slice(0, 80) || ""}</td>
                    <td>{list(m.rqLinks).map((l) => { const r = row(l); return `${text(r.rqKey)}:${text(r.relationship)}`; }).join(", ") || "—"}</td>
                    <td><span className="v13-badge">{text(m.evidenceStatus)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cardFor && (
        <div className="v13-panel" style={{ marginTop: 10 }}>
          <div className="v13-panel-head"><div><p className="section-kicker">研究分析卡</p><h3>研究分析卡：{cardFor.title.slice(0, 60)}</h3></div><p className="v13-panel-note">分析卡只存在於本專案視圖；文獻本身不複製。</p></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10 }}>
            {Object.entries(EMPTY_CARD).map(([key, label]) => <label key={key} className="research-field">{label}<textarea rows={2} value={cardForm[key] ?? ""} onChange={(event) => setCardForm({ ...cardForm, [key]: event.target.value })} /></label>)}
            <div className="research-field">Useful For Sections{Object.keys(SECTIONS).map((index) => { const section = SECTIONS[Number(index)]; return <label key={section} className="v13-check" style={{ display: "inline-flex", marginRight: 8 }}><input type="checkbox" checked={cardSections.includes(section)} onChange={(event) => setCardSections(event.target.checked ? [...cardSections, section] : cardSections.filter((s) => s !== section))} />{section}</label>; })}</div>
          </div>
          <div className="research-actions" style={{ marginTop: 10 }}>
            <button type="button" className="primary-button" onClick={() => void saveCard()} disabled={busy === "card"}>儲存分析卡</button>
            <button type="button" className="secondary-button" onClick={() => setCardFor(null)}>關閉</button>
          </div>
        </div>
      )}

      {rqFor && (
        <div className="v13-panel" style={{ marginTop: 10 }}>
          <div className="v13-panel-head"><div><p className="section-kicker">文獻 ↔ 研究問題</p><h3>文獻與 Research Question 連結</h3></div><p className="v13-panel-note">每行一筆：RQ1:SUPPORTS、RQ2:THEORY、RQ3:METHOD…（關係：SUPPORTS/THEORY/METHOD/MEASUREMENT/COMPARES/BACKGROUND/GAP/DISCUSSION）</p></div>
          <textarea rows={4} style={{ width: "100%" }} value={rqText} onChange={(event) => setRqText(event.target.value)} placeholder={"RQ1:SUPPORTS\nRQ2:THEORY"} />
          <div className="research-actions" style={{ marginTop: 8 }}>
            <button type="button" className="primary-button" onClick={() => void saveRq()} disabled={busy === "rq"}>儲存 RQ 連結</button>
            <button type="button" className="secondary-button" onClick={() => setRqFor(null)}>關閉</button>
          </div>
        </div>
      )}
    </section>
  );
}
