"use client";

import { useCallback, useEffect, useState } from "react";
import { zhStatus } from "@/lib/zh-status";

type AnyRow = Record<string, unknown>;
type Data = AnyRow & { ok?: boolean; providers?: AnyRow[]; consents?: AnyRow[]; jobs?: AnyRow[]; usage?: AnyRow[]; comparisons?: AnyRow[]; costLimits?: AnyRow[]; workOrders?: AnyRow[]; nextBestAction?: string };

export default function ExternalLanguageProviderPanel({ projectId, workOrderId }: { projectId: string; workOrderId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const string = useCallback((v: unknown, fallback = "") => typeof v === "string" && v ? v : fallback, []);
  const setD = useCallback((k: string, v: string) => setDrafts((d) => ({ ...d, [k]: v })), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/language-provider`, { cache: "no-store" });
      setData(await res.json());
    } catch (e) { setError(String(e)); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const action = useCallback(async (name: string, body: Record<string, unknown>, successText?: string) => {
    setBusy(name); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/projects/${projectId}/language-provider`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const j = await res.json();
      if (!j.ok) { setError(j.error || "操作失敗"); return j; }
      if (successText) setNotice(successText);
      await load();
      return j;
    } catch (e) { setError(String(e)); return { ok: false }; }
    finally { setBusy(""); }
  }, [projectId, load]);

  const cta = useCallback((label: string, fn: () => void, primary = true) => <button type="button" className={primary ? "primary-button" : "secondary-button"} disabled={busy !== ""} onClick={fn}>{label}</button>, [busy]);
  const sub = useCallback((title: string, children: React.ReactNode) => <div className="v13-subsection"><p className="section-kicker">{title}</p>{children}</div>, []);
  const small = (k: string, ph: string, w = 150) => <input style={{ fontSize: 11, width: w }} placeholder={ph} value={string(drafts[k])} onChange={(e) => setD(k, e.target.value)} />;
  const area = (k: string, ph: string, rows = 2) => <textarea rows={rows} style={{ width: "100%", fontSize: 11 }} placeholder={ph} value={string(drafts[k])} onChange={(e) => setD(k, e.target.value)} />;
  const providers = data?.providers ?? [];

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {error && <p className="v13-error">{error}</p>}{notice && <p className="v13-notice">{notice}</p>}
      <p className="v13-muted" style={{ fontSize: 10 }}>外部 API 僅作為 Language Provider；老麥與內部 QA 仍是科學含義與研究誠信的最終控制層。Credential 只存 Server-side；未同意不傳送；不提供 AI 偵測規避。</p>
      {sub("PROVIDERS（設定＋Test Connection）", <div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
          {small("providerId", "provider id", 160)}{small("providerName", "name", 140)}{small("providerKind", "DEEPL_TRANSLATE", 160)}
          {small("credentialReference", "credential（env:XXX）", 200)}
          {cta("儲存 Provider", () => void action("save-provider", { provider: { providerId: drafts.providerId, providerName: drafts.providerName, providerKind: drafts.providerKind, credentialReference: drafts.credentialReference, enabled: true, supportedTasks: ["TRANSLATE_ZH_TO_EN", "CORRECT_ENGLISH"], supportedLanguages: ["zh", "en"] } }, "Provider 已儲存（Credential 只存 server-side ref）。"), false)}
        </div>
        {cta("Test Connection（含 Capability Snapshot）", () => void action("test-connection", { providerId: drafts.providerId }, "連線測試完成。"), false)}
        <p style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>{providers.map((p) => `${string(p.id)}｜${string(p.kind)}｜${string(p.conn)}｜enabled:${string(p.enabled)}`).join("\n") || "（無 Provider）"}</p>
      </div>)}
      {sub("CONSENT（未同意不傳送）", <div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {small("consentProvider", "provider id", 160)}
          {cta("授予同意（GRANTED）", () => void action("consent", { providerId: drafts.consentProvider, consent: { consentId: `c_${Date.now()}`, contentScope: "SECTION_PARAGRAPH_ONLY", purpose: "科學翻譯/潤稿", includesUnpublishedManuscript: true, userDecision: "GRANTED" } }, "Consent 已記錄。"), false)}
        </div>
        <p style={{ fontSize: 10 }}>Consent 紀錄：{(data?.consents ?? []).map((c) => `${string(c.providerId)}｜${string(c.decision)}`).join(" ｜ ") || "（無）"}</p>
      </div>)}
      {sub("COST LIMIT（Hard Stop 不得自動產生費用）", <div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {small("costProvider", "provider id", 160)}{small("monthlyLimit", "monthly chars", 140)}
          {cta("儲存 Cost Limit", () => void action("cost-limit", { providerId: drafts.costProvider, limit: { monthlyLimit: Number(drafts.monthlyLimit) || 100000, warningThreshold: 80, hardStopThreshold: 100 } }, "Cost Limit 已儲存。"), false)}
          {cta("檢查 Hard Stop", () => void action("hard-stop", { providerId: drafts.costProvider }, "檢查完成。"), false)}
        </div>
      </div>)}
      {sub("LANGUAGE JOB（Token 保護＋PII 阻擋＋兩階段）", <div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {small("jobId", "job id", 160)}{small("jobProvider", "provider id", 160)}{small("taskType", "TRANSLATE_ZH_TO_EN", 200)}
        </div>
        {area("jobSource", "source text（含受保護 token）")}
        <div style={{ margin: "4px 0" }}>{cta("建立 Job（Consent/PII/Cost 檢查）", () => void action("create-job", { job: { jobId: drafts.jobId, workOrderId, providerId: drafts.jobProvider, taskType: drafts.taskType, sectionId: "sec_results", sourceText: drafts.jobSource } }, "Job 已建立（QUEUED）。"), false)}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}>
          {small("runJobId", "job id", 160)}{small("providerOutput", "provider output（模擬）", 200)}
          {cta("執行 Job", () => void action("run-job", { jobId: drafts.runJobId, providerOutput: drafts.providerOutput }, "Job 已完成（輸出存版本）。"), false)}
          {cta("Token 驗證＋寫回候選", () => void action("apply-job", { jobId: drafts.runJobId }, "Token 驗證完成。"), false)}
          {cta("QA 核准（可寫 v3）", () => void action("approve-job", { jobId: drafts.runJobId, meaningReviewed: true }, "Job 已通過 QA。"), false)}
        </div>
        <p className="v13-muted" style={{ fontSize: 10 }}>翻譯→英文 Draft→Write Correct→（選擇性）Academic Rephrase→老麥語義審查→Language QA；Token 遺失/修改 → FAILED_PROTECTED_TOKEN_VALIDATION 不寫回。</p>
        <p style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>Jobs：{(data?.jobs ?? []).map((j) => `${string(j.id)}｜${string(j.task)}｜${string(j.tokenStatus)}｜${string(j.status)}${string(j.blocked) === "true" ? "｜BLOCKED" : ""}`).join("\n") || "（無）"}</p>
      </div>)}
      {sub("SECOND OPINION（多 Provider 比對）", <div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {small("cmpPrimary", "primary provider", 160)}{small("cmpSecondary", "secondary provider（需 Consent）", 200)}
          {cta("建立比對", () => void action("compare", { comparison: { comparisonId: `cmp_${Date.now()}`, workOrderId, sectionId: "sec_abstract", primaryProviderId: drafts.cmpPrimary, secondaryProviderId: drafts.cmpSecondary, primaryOutput: "A", secondaryOutput: "B" } }, "比對已建立（第二 Provider 需已 Consent）。"), false)}
        </div>
        <p className="v13-muted" style={{ fontSize: 10 }}>不得自動以較流暢或較強勢版本作為最終答案；需 Scientific Meaning Review。</p>
      </div>)}
      {sub("USAGE", <p style={{ fontSize: 10 }}>{(data?.usage ?? []).map((u) => `${string(u.providerId)}｜est ${string(u.estimated)}｜actual ${string(u.actual)}`).join(" ｜ ") || "（尚無用量）"}</p>)}
    </div>
  );
}
