"use client";

import { useEffect, useState } from "react";

type GateResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  readiness?: {
    hasRun?: boolean;
    submissionReady?: boolean;
    fatalOpen?: string[];
    majorOpen?: string[];
    officialDeadlineVerified?: boolean;
    internalDeadline?: string | null;
    lastVerifiedAt?: string | null;
  };
  routes?: { fundingRoute?: string; publicationRoute?: string };
  fatalItems?: Array<Record<string, unknown>>;
  note?: string;
};

function text(value: unknown): string { return typeof value === "string" ? value : ""; }

export default function SubmissionGate({ projectId, onNavigate }: { projectId: string; onNavigate?: (navId: string) => void }) {
  const [data, setData] = useState<GateResponse | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [rationale, setRationale] = useState("");
  const [gateResult, setGateResult] = useState<{ gateId?: string; note?: string } | null>(null);

  async function load() {
    setError(""); setBusy("load");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/submission-gate`, { cache: "no-store" });
      const payload = await response.json() as GateResponse;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "無法載入正式送件門。");
      setData(payload);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "無法載入正式送件門。"); }
    finally { setBusy(""); }
  }
  async function confirm() {
    setError(""); setGateResult(null); setBusy("confirm");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/submission-gate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true, rationale: rationale.trim() }) });
      const payload = await response.json() as GateResponse & { gateId?: string; note?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "確認送件失敗。");
      setGateResult({ gateId: payload.gateId, note: payload.note });
      setConfirmArmed(false); setRationale("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "確認送件失敗。"); }
    finally { setBusy(""); }
  }

  useEffect(() => { void load(); }, [projectId]);

  const readiness = data?.readiness;
  const ready = readiness?.submissionReady === true;
  const fatalOpen = readiness?.fatalOpen ?? [];
  const majorOpen = readiness?.majorOpen ?? [];
  const fatalItems = data?.fatalItems ?? [];

  return (
    <section className="v13-panel-stack" data-testid="submission-gate">
      <div className="v13-panel">
        <div className="v13-panel-head"><div><p className="section-kicker">SUBMISSION GATE · 送件前總檢查</p><h2>正式送件</h2></div><p className="v13-panel-note">讀取投稿與計畫導航的 Compliance Matrix 與資格 Gate。任何 fatal 項目未通過時，只顯示「尚未具備正式送件條件」。此頁不保證計畫通過或期刊接受。</p></div>
        <div className="research-actions"><button type="button" className="secondary-button" disabled={busy === "load"} onClick={() => void load()}>{busy === "load" ? "檢查中…" : "重新檢查"}</button></div>
        {error && <p className="v13-error" role="alert">{error}</p>}
      </div>

      {!data && !error && <div className="v13-panel"><p className="v13-muted">載入中…</p></div>}

      {readiness && <>
        <div className={`v13-panel ${ready ? "" : "compliance-fatal-panel"}`}>
          <div className="v13-panel-head"><div><p className="section-kicker">就緒度</p><h3>{!readiness.hasRun ? "尚未執行投稿與計畫導航" : ready ? "可正式送件（仍需使用者最終確認）" : "尚未具備正式送件條件"}</h3></div></div>
          {data?.note && <p className={ready ? "v13-muted" : "v13-error"} role="status">{data.note}</p>}
          <div className="v13-status-grid">
            <div><small>Fatal open</small><strong>{fatalOpen.length}</strong></div>
            <div><small>Major open</small><strong>{majorOpen.length}</strong></div>
            <div><small>官方截止日期已查證</small><strong>{readiness.officialDeadlineVerified === true ? "是" : "否／待查證"}</strong></div>
            <div><small>最後查證</small><strong>{readiness.lastVerifiedAt?.slice(0, 10) ?? "—"}</strong></div>
          </div>
          {data?.routes && <div className="v13-list"><p><b>路線</b><span>資助：{text(data.routes.fundingRoute) || "—"}</span><span>期刊：{text(data.routes.publicationRoute) || "—"}</span></p></div>}
          {fatalOpen.length > 0 && <div className="v13-list"><p><b>未通過的 fatal 項目</b>{fatalOpen.map((item) => <span key={item}>{item}</span>)}</p></div>}
          {majorOpen.length > 0 && <div className="v13-list"><p><b>未完成的主要項目</b>{majorOpen.map((item) => <span key={item}>{item}</span>)}</p></div>}
        </div>

        {fatalItems.length > 0 && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">FATAL ITEMS · 送件阻礙</p><h3>需先完成的行動</h3></div></div>
          <div className="v13-table-wrap"><table><thead><tr><th>ID</th><th>路線</th><th>規定</th><th>缺漏</th><th>需採取行動</th><th>官方來源</th></tr></thead><tbody>{fatalItems.map((item, index) => <tr key={`${text(item.requirement_id)}-${index}`} className="compliance-fatal"><td>{text(item.requirement_id)}</td><td>{text(item.route)}</td><td>{text(item.requirement)}</td><td>{text(item.missing_item)}</td><td>{text(item.required_action)}</td><td>{text(item.official_source)}</td></tr>)}</tbody></table></div>
        </div>}

        <div className="research-actions">
          {onNavigate && <><button type="button" className="secondary-button" onClick={() => onNavigate("navigator")}>回到投稿與計畫導航</button><button type="button" className="secondary-button" onClick={() => onNavigate("reviewer")}>前往老麥審查</button></>}
          <p className="v13-muted">送件動作（提交至官方系統）永遠需要使用者最終確認；此門不做自動送件。</p>
        </div>

        {ready && <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">人工門檻 · S8 釋出</p><h3>記錄正式送件人工確認</h3></div><p className="v13-panel-note">確認後寫入 S8_RELEASE_HUMAN_GATE（append-only）。此確認不保證計畫通過或期刊接受，實際送件仍需你在官方系統完成。</p></div>
          {gateResult ? <div className="v13-list"><p><b>已記錄</b><span>Gate ID：{gateResult.gateId}</span><span>{gateResult.note}</span></p></div> : <>
            <label className="v13-check"><input type="checkbox" checked={confirmArmed} onChange={(event) => setConfirmArmed(event.target.checked)} />我已核對 Compliance Matrix（無 fatal 未過）、官方截止日期狀態與稿件/計畫書完整性，理解此確認不保證通過或接受。</label>
            <label className="research-field">核准理由<textarea rows={3} maxLength={2000} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="說明送件依據（例如：已依官方徵件核對格式、倫理審查通過、校內截止日前送件）。" /></label>
            <button type="button" className="primary-button" disabled={busy === "confirm" || !confirmArmed || rationale.trim().length < 8} onClick={() => void confirm()}>{busy === "confirm" ? "記錄中…" : "記錄正式送件確認（S8）"}</button>
          </>}
        </div>}
      </>}
    </section>
  );
}
