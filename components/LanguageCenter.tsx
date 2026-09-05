"use client";

import { useCallback, useEffect, useState } from "react";

type Row = Record<string, unknown>;
type Finding = Row & { findingId?: string; section?: string; issueType?: string; originalText?: string; suggestedText?: string; risk?: string; severity?: string; status?: string };
type Data = Row & { ok?: boolean; locked?: boolean; reasons?: string[]; declaration?: string; summary?: Row; manuscript?: Row | null; workOrder?: Row | null; findings?: Finding[]; qaResults?: Row[]; disclosure?: Row | null };
const text = (v: unknown, fallback = ""): string => typeof v === "string" && v ? v : fallback;
const num = (v: unknown): number => Number(v) || 0;

function zhStatus(v: string): string {
  const map: Record<string, string> = { "DRAFT": "草稿", "READY": "就緒", "IN_PROGRESS": "進行中", "HUMAN_REVIEW": "人工複核", "QA_PENDING": "待 QA", "APPROVED": "已核准", "OUTDATED": "已過時", "CANCELLED": "已取消", "OPEN": "開啟", "ACCEPTED": "已接受", "REJECTED": "已拒絕", "PENDING": "待決定", "ACCEPT": "接受", "REJECT": "拒絕", "DEFER": "延後", "PASS": "通過", "PASS_WITH_WARNINGS": "通過（有警告）", "FAIL": "未通過", "NONE": "無", "LOW": "低", "MEDIUM": "中", "HIGH": "高", "SCIENTIFIC_MEANING_CHANGE": "科學意義改變", "BLOCKER": "阻擋", "CRITICAL": "嚴重", "MAJOR": "主要", "MINOR": "次要", "SUGGESTION": "建議" };
  return map[v] ?? v;
}

const SERVICE_OPTIONS = ["ZH_TO_EN_SCIENTIFIC_TRANSLATION", "EN_TO_ZH_ACADEMIC_TRANSLATION", "ENGLISH_ACADEMIC_POLISHING", "CHINESE_ACADEMIC_POLISHING", "BILINGUAL_PARALLEL_EDITING", "TARGET_JOURNAL_LANGUAGE_ADAPTATION", "TITLE_ABSTRACT_KEYWORD_OPTIMIZATION", "TABLE_FIGURE_CAPTION_EDITING"];
const QA_OPTIONS = ["SEMANTIC_EQUIVALENCE", "NUMERICAL_INTEGRITY", "CITATION_INTEGRITY", "TERMINOLOGY_CONSISTENCY", "CAUSAL_LANGUAGE", "CERTAINTY_CALIBRATION", "INCLUSIVE_LANGUAGE", "ACCESSIBILITY", "HYPOTHESIS_STATUS"];

export default function LanguageCenter({ projectId, onNavigate }: { projectId: string; onNavigate?: (navId: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("overview");
  const [serviceMode, setServiceMode] = useState(SERVICE_OPTIONS[2]);
  const [depth, setDepth] = useState("BALANCED");
  const [targetJournal, setTargetJournal] = useState("");
  const [allSections, setAllSections] = useState(true);
  const [fSection, setFSection] = useState("");
  const [fIssueType, setFIssueType] = useState("GRAMMAR_STYLE");
  const [fOriginal, setFOriginal] = useState("");
  const [fSuggested, setFSuggested] = useState("");
  const [fRationale, setFRationale] = useState("");
  const [fRisk, setFRisk] = useState("NONE");
  const [fSeverity, setFSeverity] = useState("SUGGESTION");
  const [qaKind, setQaKind] = useState(QA_OPTIONS[0]);
  const [qaStatus, setQaStatus] = useState("PENDING");
  const [qaIssues, setQaIssues] = useState("");
  const [disclosureText, setDisclosureText] = useState("本研究於投稿前使用 AI 輔助語言工具（老麥）進行翻譯／潤稿；所有 AI 建議均經研究者逐項複核，科學內容未變更，最終責任由研究者承擔。");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/language-center`, { cache: "no-store" });
      const json = (await res.json()) as Data;
      setData(json);
    } catch (e) { setError(String(e)); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const action = useCallback(async (name: string, body: Record<string, unknown>, successText?: string) => {
    setBusy(name); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/language-center`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const j = (await res.json()) as Row;
      if (!j.ok) {
        if (j.error === "language_requires_scientific_approval") setError("科學審查尚未核准；語言潤稿不得先於科學審查。");
        else if (j.error === "language_approval_blocked") setError("尚有未處理發現或 QA 未通過，無法核准。");
        else setError(text(j.error, "操作失敗"));
        return j;
      }
      if (successText) setNotice(successText);
      await load();
      return j;
    } catch (e) { setError(String(e)); return { ok: false }; }
    finally { setBusy(""); }
  }, [projectId, load]);

  const createOrder = async () => {
    const workOrderId = text(data?.workOrder?.workOrderId);
    if (workOrderId) { setNotice("已有進行中的語言委託。"); return; }
    await action("create-work-order", { serviceMode, routeMode: "JOURNAL_MANUSCRIPT", requestedDepth: depth, targetJournal: targetJournal || undefined, selectedSections: allSections ? undefined : manuscriptSections.map((section) => text(section.sectionId)) }, "語言委託已建立（READY，含來源快照）");
  };

  const addFinding = async () => {
    const workOrderId = text(data?.workOrder?.workOrderId);
    if (!workOrderId) { setError("請先建立語言委託"); return; }
    if (!fOriginal.trim() || !fSuggested.trim()) { setError("原文與建議皆需填寫"); return; }
    const r = await action("save-finding", { workOrderId, section: fSection || text(manuscriptSections[0]?.sectionTitle), issueType: fIssueType, originalText: fOriginal, suggestedText: fSuggested, rationale: fRationale, risk: fRisk, severity: fSeverity }, "語言發現已登錄");
    if (r.ok) { setFOriginal(""); setFSuggested(""); setFRationale(""); }
  };

  if (!data) return <section className="v13-panel"><div className="v13-panel-head"><p className="section-kicker">語言中心 · 第 15 階段</p><h2>翻譯與學術潤稿</h2></div><p>{error || "載入中…"}</p></section>;

  const locked = data.locked === true;
  const reasons = Array.isArray(data.reasons) ? data.reasons : [];
  const manuscript = data.manuscript ?? null;
  const manuscriptSections = (manuscript as { sections?: Array<{ sectionId?: string; sectionTitle?: string }> } | null)?.sections ?? [];
  const workOrder = data.workOrder ?? null;
  const findings = data.findings ?? [];
  const qaResults = data.qaResults ?? [];
  const summary = data.summary ?? {};
  const nextCenter = text(summary.nextCenter);
  const workOrderId = text(workOrder?.workOrderId);
  const cta = (label: string, target: string) => onNavigate ? <button type="button" className="primary-button" onClick={() => onNavigate(target)}>{label}</button> : null;
  const tabButton = (key: string, label: string) => <button type="button" className={tab === key ? "secondary-button" : "link-button"} style={tab === key ? { fontWeight: 700 } : undefined} onClick={() => setTab(key)}>{label}</button>;

  return <section className="v13-panel">
    <div className="v13-panel-head"><p className="section-kicker">語言中心 · 第 15 階段</p><h2>翻譯與學術潤稿</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {tabButton("overview", "總覽")}
        {tabButton("order", "委託設定")}
        {tabButton("findings", `語言發現（${findings.length}）`)}
        {tabButton("qa", `QA 與揭露（${qaResults.length}）`)}
      </div>
    </div>
    {notice && <p role="status" style={{ color: "#146c43" }}>{notice}</p>}
    {error && <p role="alert" className="v13-error">{error}</p>}
    <p style={{ color: "#8a5a00" }}><strong>聲明：</strong>{text(data.declaration)}</p>

    {tab === "overview" && (locked ? (
      <div className="v13-locked"><div><strong>LANGUAGE_CENTER_LOCKED</strong>
        <p>語言潤稿需在科學審查核准之後進行。</p>
        <ul>{reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
        {nextCenter === "scientific-review" ? cta("前往「老麥科學審查（14）」", "scientific-review") : cta("前往「全文寫作工作室（13）」", "manuscript")}
      </div></div>
    ) : (
      <div>
        <p>狀態：{zhStatus(text(summary.status))}；稿件版本 v{num(summary.manuscriptVersion)}；委託：{workOrder ? `${zhStatus(text(workOrder.status))} · ${text(workOrder.serviceMode)}` : "尚未建立"}</p>
        {!workOrder && <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => setTab("order")}>建立語言委託</button>}
      </div>
    ))}

    {tab === "order" && (
      <div>
        <div className="v13-field"><label>服務模式</label><select value={serviceMode} onChange={(e) => setServiceMode(e.target.value)}>{SERVICE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
        <div className="v13-field"><label>潤稿深度</label><select value={depth} onChange={(e) => setDepth(e.target.value)}><option value="CONSERVATIVE">保守（僅明顯錯誤）</option><option value="BALANCED">均衡</option><option value="SUBSTANTIVE_LANGUAGE_EDIT">實質語言修改</option><option value="JOURNAL_STYLE_ADAPTATION">期刊風格改寫</option></select></div>
        <div className="v13-field"><label>目標期刊（選填）</label><input value={targetJournal} onChange={(e) => setTargetJournal(e.target.value)} maxLength={200} /></div>
        <label style={{ display: "block", margin: "8px 0" }}><input type="checkbox" checked={allSections} onChange={(e) => setAllSections(e.target.checked)} /> 全部章節</label>
        <button type="button" className="primary-button" disabled={busy !== "" || Boolean(workOrder)} onClick={() => void createOrder()}>建立語言委託（READY）</button>
        {workOrder && <button type="button" className="secondary-button" disabled={busy !== ""} onClick={() => void action("approve", { workOrderId }, "已核准（揭露完成）")}>核准完成</button>}
      </div>
    )}

    {tab === "findings" && (
      <div>
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>登錄語言發現（AI_PROPOSED／研究者登錄）</strong>
          <div className="v13-field"><label>章節</label><input value={fSection} onChange={(e) => setFSection(e.target.value)} maxLength={120} placeholder={text(manuscriptSections[0]?.sectionTitle)} /></div>
          <div className="v13-field"><label>問題類型</label><input value={fIssueType} onChange={(e) => setFIssueType(e.target.value)} maxLength={60} /></div>
          <div className="v13-field"><label>原文</label><textarea value={fOriginal} onChange={(e) => setFOriginal(e.target.value)} rows={2} /></div>
          <div className="v13-field"><label>建議</label><textarea value={fSuggested} onChange={(e) => setFSuggested(e.target.value)} rows={2} /></div>
          <div className="v13-field"><label>理由</label><textarea value={fRationale} onChange={(e) => setFRationale(e.target.value)} rows={2} /></div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={fRisk} onChange={(e) => setFRisk(e.target.value)}>{["NONE", "LOW", "MEDIUM", "HIGH", "SCIENTIFIC_MEANING_CHANGE"].map((o) => <option key={o} value={o}>科學意義風險：{zhStatus(o)}</option>)}</select>
            <select value={fSeverity} onChange={(e) => setFSeverity(e.target.value)}>{["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "SUGGESTION"].map((o) => <option key={o} value={o}>{zhStatus(o)}</option>)}</select>
          </div>
          <button type="button" className="primary-button" disabled={busy !== "" || !workOrderId} onClick={() => void addFinding()}>登錄發現</button>
        </div>
        {findings.map((row) => (
          <div key={text(row.findingId)} className="v13-list-item" style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{text(row.issueType)} · {zhStatus(text(row.severity))}</strong><span>{zhStatus(text(row.status))}</span></div>
            <p style={{ margin: 4, fontSize: 13 }}>原：{text(row.originalText)}</p>
            <p style={{ margin: 4, fontSize: 13 }}>建議：{text(row.suggestedText)}</p>
            <p style={{ margin: 4, fontSize: 12 }}>科學意義風險：{zhStatus(text(row.risk))}</p>
            <div style={{ display: "flex", gap: 8 }}>
              {["ACCEPT", "REJECT", "DEFER"].map((d) => <button key={d} type="button" className="link-button" disabled={busy !== ""} onClick={() => void action("update-decision", { workOrderId, findingId: text(row.findingId), decision: d }, `決策：${zhStatus(d)}`)}>{zhStatus(d)}</button>)}
            </div>
          </div>
        ))}
      </div>
    )}

    {tab === "qa" && (
      <div>
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <strong>登錄 QA 結果（研究者判定）</strong>
          <div className="v13-field"><label>檢查項目</label><select value={qaKind} onChange={(e) => setQaKind(e.target.value)}>{QA_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="v13-field"><label>結果</label><select value={qaStatus} onChange={(e) => setQaStatus(e.target.value)}><option value="PASS">通過</option><option value="PASS_WITH_WARNINGS">通過（有警告）</option><option value="FAIL">未通過</option><option value="PENDING">待定</option></select></div>
          <div className="v13-field"><label>問題描述（選填）</label><textarea value={qaIssues} onChange={(e) => setQaIssues(e.target.value)} rows={2} /></div>
          <button type="button" className="primary-button" disabled={busy !== "" || !workOrderId} onClick={() => { void action("save-qa", { workOrderId, checkKind: qaKind, status: qaStatus, issues: qaIssues }, "QA 已登錄"); setQaIssues(""); }}>登錄 QA</button>
          <div className="v13-field"><label>AI 使用揭露草稿</label><textarea value={disclosureText} onChange={(e) => setDisclosureText(e.target.value)} rows={3} /></div>
          <button type="button" className="secondary-button" disabled={busy !== "" || !workOrderId} onClick={() => void action("save-disclosure", { workOrderId, toolCategory: "AI 輔助語言工具（老麥）", purpose: "學術語言潤稿／翻譯之 AI 輔助揭露", disclosureDraft: disclosureText }, "揭露已存")}>儲存揭露</button>
        </div>
        {qaResults.map((row, index) => <div key={index} className="v13-list-item"><strong>{text(row.checkKind)}</strong><span>{zhStatus(text(row.status))}</span><span>{text(row.issues)}</span></div>)}
      </div>
    )}
  </section>;
}
