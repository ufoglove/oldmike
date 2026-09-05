"use client";

import { useRef, useState } from "react";

import styles from "./v2-alpha4-r1.module.css";

type Action = "IMPORT" | "SAVE" | "SYNC" | "INSERT_CITATION" | "EXPORT_BIBLIOGRAPHY";
type Result = { actionLabel: string; collection: { label: string }; item: { objectVersion: number; availability: string }; receipt: { completionClass: string; itemsRead: number; itemsWritten: number; attachmentsTransferred: 0; rawBodyRetained: false }; citation?: { text: string; auditRequired: true }; bibliography?: { text: string; bibliographyHash: string; style: { styleTitle: string; snapshotHash: string } }; interchange?: { format: string; items: unknown[]; issues: unknown[] }; liveApiCallCount: 0; formalResearchWriteCount: 0; externalMutationCount: 0 };
const collections = ["00_待整理", "01_核心證據", "02_理論與方法", "03_目標期刊", "04_已引用", "99_排除"];
const actions: Array<{ id: Action; label: string }> = [{ id: "IMPORT", label: "從 Zotero 匯入" }, { id: "SAVE", label: "儲存到 Zotero" }, { id: "SYNC", label: "同步此專案" }, { id: "INSERT_CITATION", label: "插入引用" }, { id: "EXPORT_BIBLIOGRAPHY", label: "匯出參考文獻" }];

export function V2Alpha4R1ZoteroCenter({ projectRefHash }: { projectRefHash: string }) {
  const [collectionLabel, setCollectionLabel] = useState("");
  const [format, setFormat] = useState("CSL_JSON");
  const [busy, setBusy] = useState<Action | null>(null);
  const [last, setLast] = useState<Result | null>(null);
  const [announcement, setAnnouncement] = useState("請先明確選擇這個專案的 Zotero collection。");
  const [error, setError] = useState<string | null>(null);
  const firstAction = useRef<HTMLButtonElement | null>(null);

  async function run(action: Action) {
    if (!collectionLabel || busy) return;
    setBusy(action); setError(null); setAnnouncement(`${actions.find((item) => item.id === action)?.label}處理中。`);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/v2-alpha4-r1/zotero", { method: "POST", headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": "fixture-workspace-v2" }, body: JSON.stringify({ requestId: crypto.randomUUID(), action, projectRefHash, collectionLabel, format, expectedVersion: 11 }), cache: "no-store", signal: controller.signal });
      const payload = await response.json() as Result & { ok?: boolean; code?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.code ?? "zotero_local_action_failed");
      setLast(payload);
      setAnnouncement(`${payload.actionLabel}已完成；collection ${payload.collection.label} 維持明確綁定，外部 API 與正式寫入皆為 0。`);
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === "AbortError" ? "本機 Zotero 示範逾時；未重送、未覆寫。" : "本機 Zotero 示範未完成；目前選擇已保留。" );
      setAnnouncement("操作未完成；目前 collection 選擇已保留。" );
    } finally { window.clearTimeout(timer); setBusy(null); firstAction.current?.focus(); }
  }

  return <section className={styles.center} aria-labelledby="zotero-heading" data-testid="alpha4-r1-zotero-center" data-live-api-calls={last?.liveApiCallCount ?? 0} data-formal-writes={last?.formalResearchWriteCount ?? 0}>
    <header className={styles.header}><div><p>ZOTERO · PROJECT LITERATURE CENTER</p><h2 id="zotero-heading">把發現帶進可查核的引用流程</h2><span>Zotero 是使用者可見的文獻庫；事實權威仍在 Portal evidence ledger 與獨立引用稽核。</span></div><b>Alpha4-R1 本機離線合約</b></header>
    <div className={styles.binding}>
      <label>明確選擇專案 collection<select required value={collectionLabel} onChange={(event) => { setCollectionLabel(event.target.value); setLast(null); setAnnouncement(event.target.value ? `已選擇 ${event.target.value}；尚未執行任何同步。` : "請先選擇 collection。" ); }}><option value="">請選擇 collection</option>{collections.map((collection) => <option key={collection} value={collection}>{collection}</option>)}</select></label>
      <label>離線匯入格式<select value={format} onChange={(event) => setFormat(event.target.value)}><option value="RIS">RIS</option><option value="BIBTEX">BibTeX</option><option value="CSL_JSON">CSL-JSON</option></select></label>
      <p>預設只同步 metadata 與使用者明確選取的有限 notes；不含附件、PDF、全文或 raw provider body。</p>
    </div>
    <div className={styles.actions} aria-label="Zotero 專案操作">{actions.map((action, index) => <button ref={index === 0 ? firstAction : undefined} data-testid="alpha4-r1-zotero-action" key={action.id} type="button" disabled={!collectionLabel || busy !== null} onClick={() => void run(action.id)}><span>{String(index + 1).padStart(2, "0")}</span>{busy === action.id ? "處理中…" : action.label}</button>)}</div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.ledger} aria-label="Zotero 合約結果">
      <article><h3>Collection boundary</h3><p>{collectionLabel || "尚未選擇"}</p><small>所有儲存、同步、引用與匯出都必須重複驗證這個明確選擇。</small></article>
      <article><h3>Stable binding</h3><p>{last ? "item key + metadata hash 已綁定" : "等待本機操作"}</p><small>刪除只標記 binding unavailable；Portal citation snapshot 不會被刪除。</small></article>
      <article><h3>Version & conflict</h3><p>{last ? `${last.receipt.completionClass} · object v${last.item.objectVersion}` : "412 可見、零盲覆寫"}</p><small>未來 API 使用 object version 或 If-Unmodified-Since-Version。</small></article>
      <article><h3>Citation output</h3><p>{last?.citation?.text ?? last?.bibliography?.style.styleTitle ?? "等待插入或匯出"}</p><small>{last?.bibliography ? `CSL snapshot ${last.bibliography.style.snapshotHash.slice(0, 12)}…` : "引用仍須通過存在、metadata、語境三軸稽核。"}</small></article>
    </div>
    {last?.bibliography && <pre className={styles.bibliography} data-testid="alpha4-r1-bibliography">{last.bibliography.text}</pre>}
    <p className={styles.live} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
  </section>;
}
