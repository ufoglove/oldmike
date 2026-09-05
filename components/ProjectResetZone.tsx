"use client";

import { useState } from "react";

const danger = { background: "#b42318", borderColor: "#b42318", color: "#fff" } as const;

export default function ProjectResetZone({ projectId, projectTitle, onResetDone }: {
  projectId: string;
  projectTitle?: string;
  onResetDone?: (projectId: string) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  async function reset() {
    if (!projectId || busy) return;
    setBusy(true); setError(""); setResult("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET_PROJECT" }),
      });
      const data = (await response.json()) as { ok?: boolean; deleted?: { projects: number; artifacts: number; children: number }; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "專案重置失敗。");
      setResult(`專案已重置：${projectId}（專案 ${data.deleted?.projects ?? 0}、artifacts ${data.deleted?.artifacts ?? 0}、關聯資料 ${data.deleted?.children ?? 0} 筆已刪除）。`);
      setArmed(false);
      onResetDone?.(projectId);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "專案重置失敗；請稍後再試或洽老麥檢查資料庫鎖定。");
      setArmed(false);
    } finally {
      setBusy(false);
    }
  }

  return <section className="v13-panel" data-testid="project-reset-zone" style={{ border: "1px solid #f3c2bd", background: "#fffafa" }}>
    <div className="v13-panel-head"><p className="section-kicker">DANGER ZONE</p><h2 style={{ color: "#b42318" }}>重置此專案</h2><p className="v13-muted">永久刪除這個專案（{projectId}）及其全部研究資料、文件、Gate 紀錄與審計軌跡。此動作不可復原，只會刪除你自己建立的專案。</p></div>
    {!armed ? (
      <button type="button" className="primary-button" style={danger} onClick={() => { setError(""); setResult(""); setArmed(true); }} disabled={busy}>重置此專案</button>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <strong style={{ color: "#b42318" }}>⚠️ 確定要永久重置「{projectTitle || projectId}」嗎？所有資料將被刪除且無法還原。</strong>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="primary-button" style={danger} onClick={() => void reset()} disabled={busy}>{busy ? "重置中…" : "確認永久重置"}</button>
          <button type="button" className="secondary-button" onClick={() => setArmed(false)} disabled={busy}>取消</button>
        </div>
      </div>
    )}
    {busy && <p className="v13-muted" role="status" style={{ marginTop: 8 }}>正在刪除資料（可能需等待資料庫鎖定釋放）…</p>}
    {error && <p className="inline-error" role="alert" style={{ marginTop: 8 }}>{error}</p>}
    {result && <p role="status" style={{ marginTop: 8, color: "#0f7a3d", fontWeight: 600 }}>{result}</p>}
  </section>;
}
