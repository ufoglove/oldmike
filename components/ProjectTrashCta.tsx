"use client";

import { useState } from "react";

export default function ProjectTrashCta({ projectId, projectTitle, onTrashed }: {
  projectId: string;
  projectTitle?: string;
  onTrashed?: (projectId: string) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function trash() {
    if (!projectId || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/trash`, { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "移至回收筒失敗。");
      setArmed(false);
      onTrashed?.(projectId);
    } catch (trashError) {
      setError(trashError instanceof Error ? trashError.message : "移至回收筒失敗。");
      setArmed(false);
    } finally {
      setBusy(false);
    }
  }

  return <section className="v13-panel" data-testid="project-trash-cta" style={{ border: "1px solid #d8e0db", background: "#fbfcfb" }}>
    <div className="v13-panel-head"><p className="section-kicker">專案管理</p><h2>移至回收筒</h2><p className="v13-muted">暫時收起這個專案（{projectId}）。回收筒可隨時復原；不會刪除 Zotero 項目或其他專案共用的文獻。正式永久刪除留待專屬保留政策與權限機制，本階段不提供一鍵清空。</p></div>
    {!armed ? (
      <button type="button" className="secondary-button" style={{ borderColor: "#b42318", color: "#b42318" }} onClick={() => { setError(""); setArmed(true); }} disabled={busy}>移至回收筒</button>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <strong>確定要將「{projectTitle || projectId}」移至回收筒嗎？可以隨時復原，共用文獻與 Zotero 不受影響。</strong>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="primary-button" style={{ background: "#b42318", borderColor: "#b42318" }} onClick={() => void trash()} disabled={busy}>{busy ? "處理中…" : "確認移至回收筒"}</button>
          <button type="button" className="secondary-button" onClick={() => setArmed(false)} disabled={busy}>取消</button>
        </div>
      </div>
    )}
    {error && <p className="inline-error" role="alert" style={{ marginTop: 8 }}>{error}</p>}
  </section>;
}
