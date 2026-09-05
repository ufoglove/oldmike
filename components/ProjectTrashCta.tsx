"use client";

import { useState } from "react";

export default function ProjectTrashCta({ projectId, projectTitle, onTrashed }: {
  projectId: string | null;
  projectTitle?: string;
  onTrashed?: (projectId: string) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const disabled = !projectId;
  const titleMatch = projectTitle ? confirmText.trim() === projectTitle.trim() : false;

  async function trash() {
    if (!projectId || busy || !titleMatch) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/trash`, { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "移至回收筒失敗。");
      setArmed(false); setConfirmText("");
      onTrashed?.(projectId);
    } catch (trashError) {
      setError(trashError instanceof Error ? trashError.message : "移至回收筒失敗。");
      setArmed(false); setConfirmText("");
    } finally {
      setBusy(false);
    }
  }

  return <section className="v13-panel" data-testid="project-trash-cta" style={{ border: "2px solid #b42318", background: "#fff7f6", marginTop: 16 }}>
    <div className="v13-panel-head">
      <div><p className="section-kicker" style={{ color: "#b42318" }}>⚠️ DANGER ZONE · 危險操作</p><h2 style={{ color: "#b42318" }}>刪除本專案（移至回收筒）</h2>
        <p className="v13-muted">目前專案：<strong>{projectTitle || projectId || "（尚未載入專案）"}</strong><br />
        刪除後移至回收筒，可復原；不會刪除其他專案、共用文獻、Zotero Collection／Item、歷史版本或研究原始資料。執行中的任務會被請求取消；遲到結果不會復活已回收專案。本任務不提供永久刪除。</p>
      </div>
    </div>
    {disabled ? (
      <p role="alert" className="v13-muted">尚未載入專案或沒有刪除權限，按鈕已停用。</p>
    ) : !armed ? (
      <button type="button" className="primary-button" style={{ background: "#b42318", borderColor: "#b42318", color: "#fff" }} onClick={() => { setError(""); setArmed(true); }}>刪除本專案（移至回收筒）</button>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <strong style={{ color: "#b42318" }}>確定要將「{projectTitle || projectId}」移至回收筒嗎？</strong>
        <p className="v13-muted" style={{ fontSize: 13 }}>影響：隱藏專案、停止新增任務、請求取消執行中任務；專案內容、歷史版本與文獻關聯保留以供復原。共用文獻與 Zotero 不受影響。</p>
        {error && <p className="inline-error" role="alert" style={{ color: "#b42318" }}>{error}</p>}
        <label style={{ display: "grid", gap: 4, width: "100%", maxWidth: 420 }}>
          <span style={{ fontSize: 12, color: "#5b6b63" }}>請輸入專案名稱以確認（不會刪除 Zotero 或共用文獻）：</span>
          <input aria-label="確認專案名稱" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={projectTitle || projectId || ""} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #b42318" }} />
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="primary-button" style={{ background: "#b42318", borderColor: "#b42318", color: "#fff" }} disabled={!titleMatch || busy} onClick={() => void trash()}>{busy ? "處理中…" : "確認移至回收筒"}</button>
          <button type="button" className="secondary-button" onClick={() => { setArmed(false); setConfirmText(""); setError(""); }} disabled={busy}>取消</button>
        </div>
        {!titleMatch && <small style={{ color: "#8a5a00" }}>輸入正確專案名稱後才能確認。</small>}
      </div>
    )}
  </section>;
}
