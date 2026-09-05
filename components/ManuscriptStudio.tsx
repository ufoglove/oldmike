"use client";

import { useCallback, useEffect, useState } from "react";
import { OldMikeAssistGroupControl } from "./OldMikeAssistControl";

type Row = Record<string, unknown>;
type Section = Row & { id?: string; sectionId?: string; sectionTitle?: string; body?: string; status?: string; currentWordCount?: number };
type Data = Row & { ok?: boolean; locked?: boolean; reasons?: string[]; summary?: Row; manuscript?: Row | null; sections?: Section[] };
const text = (v: unknown, fallback = ""): string => typeof v === "string" && v ? v : fallback;
const num = (v: unknown): number => Number(v) || 0;

function zhStatus(v: string): string {
  const map: Record<string, string> = { "NOT_STARTED": "未開始", "OUTLINE_READY": "大綱就緒", "EVIDENCE_ASSEMBLED": "證據已彙整", "DRAFT": "草稿", "CLAIMS_NEED_EVIDENCE": "主張待證據", "RESULTS_INCONSISTENT": "結果不一致", "USER_REVIEW_REQUIRED": "待使用者複核", "APPROVED": "已核准", "LOCKED": "已鎖定", "OUTDATED": "已過時", "SCOPE_SETUP": "範圍設定", "STORYLINE": "故事線", "WRITING_PLAN": "寫作計畫", "STORYBOARD": "分鏡", "WRITING": "寫作中", "CONSISTENCY_CHECK": "一致性檢查", "VALIDATION_REQUIRED": "待驗證", "V1_SCIENTIFIC_DRAFT": "V1 科學草稿", "REVIEW_READY": "可送審" };
  return map[v] ?? v;
}

const ARTICLE_OPTIONS = ["QUANTITATIVE_ORIGINAL_RESEARCH", "RANDOMIZED_TRIAL", "QUASI_EXPERIMENTAL_STUDY", "LONGITUDINAL_STUDY", "QUALITATIVE_RESEARCH", "MIXED_METHODS_RESEARCH", "DESIGN_SCIENCE_RESEARCH", "AI_MODEL_DEVELOPMENT_AND_VALIDATION", "HUMAN_AI_INTERACTION_STUDY", "EDUCATIONAL_INTERVENTION", "TEACHING_PRACTICE_RESEARCH", "OCCUPATIONAL_SAFETY_STUDY", "ENVIRONMENTAL_OR_FIELD_STUDY", "METHODS_OR_SYSTEM_PAPER", "SECONDARY_DATA_ANALYSIS"];

export default function ManuscriptStudio({ projectId, onNavigate }: { projectId: string; onNavigate?: (navId: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("overview");
  const [title, setTitle] = useState("");
  const [articleType, setArticleType] = useState(ARTICLE_OPTIONS[0]);
  const [writingMode, setWritingMode] = useState("GUIDED_WRITING");
  const [stage, setStage] = useState("WRITING");
  const [editing, setEditing] = useState<string | null>(null);
  const [sectionBodies, setSectionBodies] = useState<Record<string, string>>({});
  const [sectionStatuses, setSectionStatuses] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/manuscript`, { cache: "no-store" });
      const json = (await res.json()) as Data;
      setData(json);
      const bodies: Record<string, string> = {};
      const statuses: Record<string, string> = {};
      for (const section of json.sections ?? []) {
        bodies[text(section.sectionId)] = text(section.body);
        statuses[text(section.sectionId)] = text(section.status);
      }
      setSectionBodies(bodies); setSectionStatuses(statuses);
      if (json.manuscript) { setTitle(text(json.manuscript.workingTitle)); setArticleType(text(json.manuscript.articleType, ARTICLE_OPTIONS[0])); setWritingMode(text(json.manuscript.writingMode, "GUIDED_WRITING")); setStage(text(json.manuscript.currentStage, "WRITING")); }
    } catch (e) { setError(String(e)); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const action = useCallback(async (name: string, body: Record<string, unknown>, successText?: string) => {
    setBusy(name); setError(""); setNotice("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/manuscript`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const j = (await res.json()) as Row;
      if (!j.ok) { setError(text(j.error, "操作失敗")); return j; }
      if (successText) setNotice(successText);
      await load();
      return j;
    } catch (e) { setError(String(e)); return { ok: false }; }
    finally { setBusy(""); }
  }, [projectId, load]);

  const create = async () => {
    if (!title.trim()) { setError("請填寫稿件標題／working title"); return; }
    const r = await action("create", { workingTitle: title.trim(), articleType, writingMode }, "全文稿件已建立（含預設章節）");
    if (r.ok) setTab("sections");
  };

  if (!data) return <section className="v13-panel"><div className="v13-panel-head"><p className="section-kicker">全文寫作工作室 · 第 13 階段</p><h2>全文寫作工作室</h2></div><p>{error || "載入中…"}</p></section>;

  const locked = data.locked === true;
  const reasons = Array.isArray(data.reasons) ? data.reasons : [];
  const manuscript = data.manuscript ?? null;
  const sections = data.sections ?? [];
  const summary = data.summary ?? {};
  const nextCenter = text(summary.nextCenter);
  const manuscriptId = text(manuscript?.manuscriptId);
  const cta = (label: string, target: string) => onNavigate ? <button type="button" className="primary-button" onClick={() => onNavigate(target)}>{label}</button> : null;
  const tabButton = (key: string, label: string) => <button type="button" className={tab === key ? "secondary-button" : "link-button"} style={tab === key ? { fontWeight: 700 } : undefined} onClick={() => setTab(key)}>{label}</button>;

  return <section className="v13-panel">
    <div className="v13-panel-head"><p className="section-kicker">全文寫作工作室 · 第 13 階段</p><h2>全文寫作工作室</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {tabButton("overview", "總覽")}
        {tabButton("setup", "稿件設定")}
        {tabButton("sections", `章節寫作（${sections.length}）`)}
      </div>
    </div>
    {notice && <p role="status" style={{ color: "#146c43" }}>{notice}</p>}
    {error && <p role="alert" className="v13-error">{error}</p>}

    {tab === "overview" && (locked ? (
      <div className="v13-locked"><div><strong>MANUSCRIPT_STUDIO_LOCKED</strong>
        <p>前置鏈尚未完成；全文寫作需先完成正式研究、資料治理與分析。</p>
        <ul>{reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {nextCenter === "execution" ? cta("前往「正式研究與執行」", "execution") : null}
          {nextCenter === "governance" ? cta("前往「資料治理與 Analysis Dataset」", "governance") : null}
          {nextCenter === "analysis-lab" ? cta("前往「分析實驗室（12）」", "analysis-lab") : null}
        </div>
      </div></div>
    ) : manuscript ? (
      <div>
        <p><strong>{text(manuscript.workingTitle)}</strong> · {zhStatus(text(manuscript.currentStage))} · 章節 {num(summary.sections)}／完成 {num(summary.completedSections)}</p>
        <p>稿件類型：{text(manuscript.articleType)}；寫作模式：{zhStatus(text(manuscript.writingMode))}</p>
        {num(summary.completedSections) === sections.length && sections.length > 0 && <p>所有章節已核准，可進入一致性檢查與審查。</p>}
      </div>
    ) : (
      <p>尚未建立全文稿件。請到「稿件設定」建立。</p>
    ))}

    {tab === "setup" && (
      <div>
        {!manuscript && <>
          <div className="v13-field"><label>稿件標題（working title）</label><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} /></div>
          <div className="v13-field"><label>文章類型</label><select value={articleType} onChange={(e) => setArticleType(e.target.value)}>{ARTICLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="v13-field"><label>寫作模式</label><select value={writingMode} onChange={(e) => setWritingMode(e.target.value)}><option value="GUIDED_WRITING">引導式寫作</option><option value="CO_WRITING">協作寫作</option><option value="EVIDENCE_TO_DRAFT">證據轉草稿</option></select></div>
          <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void create()}>{busy === "create" ? "建立中…" : "建立全文稿件（含預設章節）"}</button>
        </>}
        {manuscript && <>
          <div className="v13-field"><label>標題</label><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} /></div>
          <div className="v13-field"><label>文章類型</label><select value={articleType} onChange={(e) => setArticleType(e.target.value)}>{ARTICLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
          <div className="v13-field"><label>寫作模式</label><select value={writingMode} onChange={(e) => setWritingMode(e.target.value)}><option value="GUIDED_WRITING">引導式寫作</option><option value="CO_WRITING">協作寫作</option><option value="EVIDENCE_TO_DRAFT">證據轉草稿</option></select></div>
          <div className="v13-field"><label>當前階段</label><select value={stage} onChange={(e) => setStage(e.target.value)}>{["SCOPE_SETUP", "STORYLINE", "WRITING_PLAN", "WRITING", "CONSISTENCY_CHECK", "REVIEW_READY"].map((s) => <option key={s} value={s}>{zhStatus(s)}</option>)}</select></div>
          <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void action("save-settings", { manuscriptId, workingTitle: title.trim(), articleType, writingMode, currentStage: stage }, "稿件設定已更新")}>儲存設定</button>
        </>}
      </div>
    )}

    {tab === "sections" && (
      <div>
        {!manuscript ? <p>請先建立全文稿件。</p> : sections.map((section) => {
          const sid = text(section.sectionId);
          const active = editing === sid;
          return <div key={sid} className="v13-list-item" style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{text(section.sectionTitle)}</strong>
              <span>{zhStatus(text(section.status))} · {num(section.currentWordCount)} 字</span>
            </div>
            {active ? (
              <>
                <OldMikeAssistGroupControl
                  projectId={projectId}
                  surface="RESEARCH_DOCUMENT"
                  groupId="research-document"
                  value={{ title: text(section.sectionTitle), body: sectionBodies[sid] ?? "" }}
                  label="老麥：協助本章草稿／改寫"
                  onApply={(value) => setSectionBodies((d) => ({ ...d, [sid]: text(value.body) }))}
                />
                <textarea rows={8} value={sectionBodies[sid] ?? ""} onChange={(e) => setSectionBodies((d) => ({ ...d, [sid]: e.target.value }))} style={{ width: "100%" }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="primary-button" disabled={busy !== ""} onClick={() => void action("save-section", { manuscriptId, sectionId: sid, body: sectionBodies[sid] ?? "", status: text(section.status) }, "章節已儲存")}>儲存章節</button>
                  <select value={sectionStatuses[sid] ?? "NOT_STARTED"} onChange={(e) => { setSectionStatuses((d) => ({ ...d, [sid]: e.target.value })); void action("set-section-status", { manuscriptId, sectionId: sid, status: e.target.value }, "章節狀態已更新"); }}>
                    {["NOT_STARTED", "OUTLINE_READY", "EVIDENCE_ASSEMBLED", "DRAFT", "USER_REVIEW_REQUIRED", "APPROVED", "LOCKED"].map((s) => <option key={s} value={s}>{zhStatus(s)}</option>)}
                  </select>
                  <button type="button" className="secondary-button" onClick={() => setEditing(null)}>完成</button>
                </div>
              </>
            ) : (
              <button type="button" className="secondary-button" onClick={() => setEditing(sid)}>開啟寫作</button>
            )}
          </div>;
        })}
      </div>
    )}
  </section>;
}
