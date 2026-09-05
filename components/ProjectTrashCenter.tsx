"use client";

import { useCallback, useEffect, useState } from "react";

type TrashedProject = { projectId: string; title?: string; trashedAt?: string | null };

export default function ProjectTrashCenter({ onRestored }: { onRestored?: (projectId: string) => void }) {
  const [projects, setProjects] = useState<TrashedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/projects/trash", { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; projects?: TrashedProject[]; error?: string };
      if (!response.ok || data.ok === false) throw new Error(data.error || "回收筒讀取失敗。");
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "回收筒讀取失敗。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function restore(projectId: string) {
    if (busy) return;
    setBusy(projectId); setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/restore`, { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || data.ok === false) throw new Error(data.error || "復原失敗。");
      setProjects((current) => current.filter((item) => item.projectId !== projectId));
      onRestored?.(projectId);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "復原失敗。");
    } finally {
      setBusy("");
    }
  }

  return <section className="v13-panel-stack" data-testid="project-trash-center">
    <div className="v13-panel">
      <div className="v13-panel-head"><div><p className="section-kicker">專案管理 · 回收筒</p><h2>回收筒</h2><p className="v13-muted">這裡只放你自己移入回收筒的專案。復原會保留原有專案資料與文獻關聯；不刪除 Zotero 項目或共用文獻。正式永久刪除留待保留政策與權限機制。</p></div></div>
      {loading && <p role="status" className="v13-muted">讀取回收筒…</p>}
      {!loading && error && <div className="v13-error" role="alert">{error} <button type="button" className="secondary-button" style={{ padding: "2px 8px" }} onClick={() => void load()}>重試</button></div>}
      {!loading && !error && projects.length === 0 && <div className="v13-empty"><strong>回收筒是空的</strong><p>移到回收筒的專案會出現在這裡，可隨時復原。</p></div>}
      {!loading && !error && projects.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {projects.map((project) => (
            <div key={project.projectId} className="v13-list-item" style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
              <div style={{ minWidth: 200 }}>
                <strong>{project.title || project.projectId}</strong>
                <small style={{ display: "block", color: "#5b6b63" }}>{project.projectId}{project.trashedAt ? ` ｜ 移入時間 ${String(project.trashedAt).slice(0, 16)}` : ""}</small>
              </div>
              <button type="button" className="primary-button" disabled={busy === project.projectId} onClick={() => void restore(project.projectId)}>{busy === project.projectId ? "復原中…" : "復原專案"}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>;
}
