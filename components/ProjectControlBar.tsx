"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ListItem = {
  projectId: string;
  title?: string;
  updatedAt?: string | null;
  metaUpdatedAt?: string | null;
  metaVersion?: number | null;
  currentLocation?: string | null;
  primaryGoal?: string | null;
  fundingRoute?: string | null;
  publicationRoute?: string | null;
  progress?: { done?: number; total?: number; nextKey?: string | null } | null;
};
type MetaResponse = {
  ok?: boolean;
  project?: { projectId: string; title?: string };
  meta?: { metaVersion?: number; metaUpdatedAt?: string | null; currentLocation?: string | null; primaryGoal?: string | null; fundingRoute?: string | null; publicationRoute?: string | null; projectDraft?: Record<string, unknown> } | null;
  error?: string;
};

export type SaveState = "IDLE" | "UNSAVED" | "SAVING" | "SAVED" | "PARTIAL" | "FAILED" | "CONFLICT";

const FUNDING_ROUTES = ["", "NONE", "NSTC_GENERAL", "MOE_TPR", "OTHER_UNDECIDED"] as const;
const PUBLICATION_ROUTES = ["", "JOURNAL", "OTHER_UNDECIDED"] as const;

function timeText(value?: string | null): string {
  if (!value) return "";
  try { return new Date(value).toLocaleString("zh-TW", { hour12: false }); } catch { return value; }
}

export default function ProjectControlBar({ projectId, projectTitle, onSwitch, onNew }: {
  projectId: string | null;
  projectTitle?: string;
  onSwitch?: (projectId: string) => void;
  onNew?: () => void;
}) {
  const [list, setList] = useState<ListItem[]>([]);
  const [query, setQuery] = useState("");
  const [meta, setMeta] = useState<MetaResponse["meta"] | null>(null);
  const [goal, setGoal] = useState("");
  const [funding, setFunding] = useState("");
  const [publication, setPublication] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<SaveState>("IDLE");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [switchIntent, setSwitchIntent] = useState<string | null>(null);
  const [expandedPath, setExpandedPath] = useState(false);
  const savedRef = useRef("");

  const loadList = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; projects?: ListItem[] };
      if (response.ok && data.ok !== false && Array.isArray(data.projects)) setList(data.projects.filter((item) => item && item.projectId));
    } catch { /* 清單失敗不影響頁面；保留既有 */ }
  }, []);

  const loadMeta = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const data = (await response.json()) as MetaResponse;
      if (!response.ok || data.ok === false || !data.meta) { setMeta(null); setState("IDLE"); return; }
      setMeta(data.meta);
      setGoal(typeof data.meta.primaryGoal === "string" ? data.meta.primaryGoal : "");
      setFunding(typeof data.meta.fundingRoute === "string" ? data.meta.fundingRoute : "");
      setPublication(typeof data.meta.publicationRoute === "string" ? data.meta.publicationRoute : "");
      const draft = (data.meta.projectDraft ?? {}) as Record<string, unknown>;
      setNote(typeof draft.note === "string" ? draft.note : "");
      setLastSavedAt(data.meta.metaUpdatedAt ?? null);
      savedRef.current = `${data.meta.primaryGoal ?? ""}|${data.meta.fundingRoute ?? ""}|${data.meta.publicationRoute ?? ""}|${typeof draft.note === "string" ? draft.note : ""}`;
      setState("IDLE");
      setMessage("");
    } catch { setState("FAILED"); setMessage("讀取失敗；請重試。"); }
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => {
    if (projectId) { void loadMeta(projectId); setState("IDLE"); setSwitchIntent(null); }
    else { setMeta(null); setState("IDLE"); setMessage("尚未選擇專案"); }
  }, [projectId, loadMeta]);

  const currentSnapshot = useMemo(() => `${goal}|${funding}|${publication}|${note}`, [goal, funding, publication, note]);
  const dirty = projectId !== null && currentSnapshot !== savedRef.current;

  useEffect(() => {
    if (dirty && state !== "SAVING" && state !== "CONFLICT") setState((current) => (current === "IDLE" || current === "SAVED" ? "UNSAVED" : current));
    if (!dirty && (state === "UNSAVED" || state === "SAVED" || state === "PARTIAL")) setState("IDLE");
  }, [dirty, state]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function save(): Promise<boolean> {
    if (!projectId) return false;
    setState("SAVING"); setMessage("");
    const fields: Record<string, unknown> = { primaryGoal: goal || null, fundingRoute: funding || null, publicationRoute: publication || null, draft: { note } };
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, expectedVersion: meta?.metaVersion ?? null }),
      });
      const data = (await response.json()) as { ok?: boolean; idempotent?: boolean; version?: number; savedAt?: string | null; code?: string; serverVersion?: number; error?: string };
      if (response.status === 409 && data.code === "version_conflict") {
        setState("CONFLICT");
        setMessage(`版本衝突：伺服器已到 v${data.serverVersion ?? 0}。請「讀取專案」載入最新版本後再編輯（本地未儲存內容仍保留）。`);
        return false;
      }
      if (!response.ok || data.ok === false) { setState("FAILED"); setMessage(data.error || "儲存失敗（本地內容保留）。"); return false; }
      savedRef.current = currentSnapshot;
      setLastSavedAt(data.savedAt ?? new Date().toISOString());
      setState("SAVED");
      setMessage(data.idempotent ? "內容相同，未建立重複版本。" : `已儲存（v${data.version}）`);
      void loadList();
      return true;
    } catch {
      setState("FAILED"); setMessage("儲存失敗（本地內容保留）。");
      return false;
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...list].sort((a, b) => String(b.metaUpdatedAt ?? b.updatedAt ?? "").localeCompare(String(a.metaUpdatedAt ?? a.updatedAt ?? "")));
    return q ? sorted.filter((item) => (item.title ?? item.projectId).toLowerCase().includes(q)) : sorted;
  }, [list, query]);

  function requestSwitch(nextId: string) {
    if (nextId === projectId) return;
    if (dirty) { setSwitchIntent(nextId); setMessage("有未儲存變更：請選擇「儲存後切換」或「放棄未儲存變更後切換」；儲存失敗不會切換。"); return; }
    performSwitch(nextId);
  }
  async function performSwitch(nextId: string) {
    setSwitchIntent(null);
    if (dirty) {
      const saved = await save();
      if (!saved) { setMessage("儲存失敗，未切換專案。"); return; }
    }
    onSwitch?.(nextId);
  }
  function discardAndSwitch(nextId: string) { savedRef.current = currentSnapshot; setState("IDLE"); setSwitchIntent(null); onSwitch?.(nextId); }

  const current = list.find((item) => item.projectId === projectId);
  const progress = current?.progress;
  const percent = progress && progress.total ? Math.round(((progress.done ?? 0) / progress.total) * 100) : null;

  const stateLabel: Record<SaveState, string> = { IDLE: "—", UNSAVED: "未儲存變更", SAVING: "儲存中…", SAVED: "已儲存", PARTIAL: "部分儲存", FAILED: "儲存失敗", CONFLICT: "版本衝突" };

  return <section className="v13-panel" data-testid="project-control-bar" style={{ marginBottom: 12 }}>
    <div className="v13-panel-head"><div><p className="section-kicker">專案控制</p><h2>未完成專案</h2></div>
      <div className="research-actions" style={{ flexWrap: "wrap" }}>
        <button type="button" className="secondary-button" disabled={!projectId} onClick={() => { if (dirty) { const ok = window.confirm("重新讀取會捨棄本地未儲存變更，確定？"); if (!ok) return; } if (projectId) void loadMeta(projectId); }}>讀取專案</button>
        <button type="button" className="primary-button" disabled={!projectId || state === "SAVING"} onClick={() => void save()}>儲存專案</button>
        <button type="button" className="secondary-button" onClick={() => onNew?.()}>新增專案</button>
      </div>
    </div>

    {projectId && <>
      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ minWidth: 90 }}>選擇專案：</strong>
          <input aria-label="搜尋專案" placeholder="搜尋名稱…" value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: "0 1 180px", padding: "5px 8px", borderRadius: 6, border: "1px solid #d8e0db" }} />
          <select aria-label="未完成專案" value={projectId} onChange={(event) => requestSwitch(event.target.value)} style={{ flex: "1 1 260px", padding: "6px 8px", borderRadius: 6, border: "1px solid #dbe5df", background: "#fff", fontSize: 13 }}>
            {filtered.map((item) => {
              const p = item.progress;
              const label = `${item.title || item.projectId}${p && p.total ? `（${p.done ?? 0}/${p.total}）` : ""}`;
              return <option key={item.projectId} value={item.projectId}>{label}</option>;
            })}
          </select>
        </label>
        {filtered.length === 0 && <p className="v13-muted">目前沒有未完成專案。{onNew ? <button type="button" className="text-button" onClick={onNew}>新增專案</button> : null}</p>}
        <p className="v13-muted" style={{ fontSize: 12 }}>目前專案：{projectTitle || projectId} ｜ 儲存狀態：<strong style={{ color: state === "FAILED" || state === "CONFLICT" ? "#b42318" : state === "SAVING" || state === "UNSAVED" ? "#8a5a00" : undefined }}>{stateLabel[state]}</strong>{lastSavedAt ? ` ｜ 最後成功儲存：${timeText(lastSavedAt)}` : ""}</p>
        {message && <p role="status" style={{ fontSize: 13, color: state === "FAILED" || state === "CONFLICT" ? "#b42318" : "#0f7a3d" }}>{message}</p>}
        {state === "CONFLICT" && <button type="button" className="secondary-button" style={{ alignSelf: "flex-start" }} onClick={() => void loadMeta(projectId)}>讀取伺服器最新版本（放棄本地未儲存變更）</button>}
        {switchIntent && dirty && (
          <div style={{ border: "1px solid #e2b93b", background: "#fff8e1", borderRadius: 8, padding: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>切換前先處理未儲存變更：</span>
            <button type="button" className="primary-button" style={{ fontSize: 12, padding: "4px 10px" }} disabled={state === "SAVING"} onClick={() => void performSwitch(switchIntent)}>儲存後切換</button>
            <button type="button" className="secondary-button" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => discardAndSwitch(switchIntent)}>放棄本地未儲存變更後切換</button>
            <button type="button" className="secondary-button" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setSwitchIntent(null)}>取消</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 13 }}>
        <span>整體研究進度：<strong>{percent !== null ? `${percent}%` : "流程待設定"}</strong> {progress && progress.total ? `（${progress.done ?? 0} / ${progress.total} 個適用里程碑）` : "（已知節點數不足，不顯示假百分比）"}</span>
        <span>資助路線：<strong>{funding || "未設定"}</strong> ｜ 成果發表路線：<strong>{publication || "未設定"}</strong></span>
        <button type="button" className="text-button" onClick={() => setExpandedPath((value) => !value)}>{expandedPath ? "收合完整研究路徑 ▲" : "查看完整研究路徑 ▼"}</button>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <label style={{ display: "grid", gap: 4 }}><span className="v13-muted" style={{ fontSize: 12 }}>專案目標（primary goal）</span><input value={goal} placeholder="例如：驗證沉浸式回饋對安全行為留存的效果" onChange={(event) => setGoal(event.target.value)} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d8e0db" }} /></label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 4, flex: "1 1 200px" }}><span className="v13-muted" style={{ fontSize: 12 }}>資助路線（可 NONE，與發表路線並存）</span><select value={funding} onChange={(event) => setFunding(event.target.value)} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d8e0db" }}>{FUNDING_ROUTES.map((route) => <option key={route} value={route}>{route || "未設定"}</option>)}</select></label>
          <label style={{ display: "grid", gap: 4, flex: "1 1 200px" }}><span className="v13-muted" style={{ fontSize: 12 }}>成果發表路線</span><select value={publication} onChange={(event) => setPublication(event.target.value)} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #d8e0db" }}>{PUBLICATION_ROUTES.map((route) => <option key={route} value={route}>{route || "未設定"}</option>)}</select></label>
        </div>
        <label style={{ display: "grid", gap: 4 }}><span className="v13-muted" style={{ fontSize: 12 }}>本專案筆記（draft note；各模組內容仍由各自服務自動儲存）</span><textarea value={note} placeholder="首頁層級筆記…" onChange={(event) => setNote(event.target.value)} style={{ minHeight: 60, padding: 6, borderRadius: 6, border: "1px solid #d8e0db" }} /></label>
      </div>
    </>}
    {!projectId && <p className="v13-muted">尚未選擇專案；請新增或從下拉選擇。</p>}
  </section>;
}
