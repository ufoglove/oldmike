"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Icon from "./Icons";
import ModelModePicker from "./ModelModePicker";
import { OldMikeAssistGroupControl } from "./OldMikeAssistControl";
import type { AcademicLanguageTask, AcademicScope, AcademicTonePreset, GlossaryEntryKind } from "@/lib/academic-language-contract";
import type { ModelModeProfile } from "@/lib/model-mode-contract";

type Glossary = {
  versionId: string;
  logicalId: string;
  versionNumber: number;
  title: string;
  contentHash: string;
  tonePreset: AcademicTonePreset;
  entries: Array<{ sourceTerm: string; targetTerm: string; kind: GlossaryEntryKind; caseSensitive: boolean }>;
  bannedTerms: Array<{ term: string; replacement: string }>;
  appendOnly: true;
};

type LanguageDocument = {
  documentVersionId: string;
  logicalId: string;
  versionNumber: number;
  title: string;
  contentHash: string;
  sourceHash: string;
  resultHash: string;
  task: AcademicLanguageTask;
  scope: AcademicScope;
  tonePreset: AcademicTonePreset;
  methodParameters: Record<string, true>;
  glossaryBinding: { versionId: string; contentHash: string } | null;
  paragraphs: Array<{ index: number; source: string; revised: string; changes: Array<{ kind: string; original: string; revised: string; reason: string }> }>;
  uncertainties: string[];
  humanGate: { status: "REQUIRED" | "APPROVED"; id: string | null };
  appendOnly: true;
};

type Workspace = { contractVersion: string; glossaries: Glossary[]; documents: LanguageDocument[] };

type ScratchResult = {
  task: AcademicLanguageTask;
  tonePreset: AcademicTonePreset;
  paragraphs: LanguageDocument["paragraphs"];
  uncertainties: string[];
  sourceHash: string;
  resultHash: string;
  persistence: "NONE";
  humanGate: "NOT_APPLICABLE";
};

const toneLabels: Record<AcademicTonePreset, string> = {
  JOURNAL_CONCISE: "期刊精煉",
  JOURNAL_FORMAL: "期刊正式",
  JOURNAL_INTERPRETIVE: "審慎詮釋",
};

function requestKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function parseMappings(value: string, kind: GlossaryEntryKind) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split("=>");
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new Error("每一行請使用「原詞 => 固定用語」格式。");
    return { sourceTerm: parts[0].trim(), targetTerm: parts[1].trim(), kind, caseSensitive: false };
  });
}

function parseBanned(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split("=>");
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) throw new Error("每一行禁用詞請使用「禁用詞 => 建議詞」格式。");
    return { term: parts[0].trim(), replacement: parts[1].trim() };
  });
}

export default function AcademicLanguageStudio({ projectId }: { projectId: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"glossary" | "transform" | "approve" | "promote" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [glossaryTitle, setGlossaryTitle] = useState("專案術語庫");
  const [fixedTerms, setFixedTerms] = useState("");
  const [abbreviations, setAbbreviations] = useState("");
  const [bannedTerms, setBannedTerms] = useState("");
  const [tonePreset, setTonePreset] = useState<AcademicTonePreset>("JOURNAL_FORMAL");
  const [task, setTask] = useState<AcademicLanguageTask>("TRANSLATE_ZH_EN");
  const [scope, setScope] = useState<AcademicScope>("PARAGRAPH");
  const [title, setTitle] = useState("學術語言草稿");
  const [sourceText, setSourceText] = useState("");
  const [scratchMode, setScratchMode] = useState(false);
  const [scratchResult, setScratchResult] = useState<ScratchResult | null>(null);
  const [selectedGlossary, setSelectedGlossary] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [rationale, setRationale] = useState("");
  const [modeProfile, setModeProfile] = useState<ModelModeProfile>("AUTO");

  const activeDocument = useMemo(() => workspace?.documents.find((item) => item.documentVersionId === activeDocumentId) || workspace?.documents[0] || null, [workspace, activeDocumentId]);
  const currentGlossary = workspace?.glossaries.find((item) => item.versionId === selectedGlossary) || null;
  const glossaryVersion = Math.max(0, ...(workspace?.glossaries.filter((item) => item.logicalId === "m02-glossary-main").map((item) => item.versionNumber) || [0]));
  const languageVersion = Math.max(0, ...(workspace?.documents.filter((item) => item.logicalId === "m02-language-main").map((item) => item.versionNumber) || [0]));

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/academic-language`, { cache: "no-store" });
      const data = await response.json() as { ok?: boolean; workspace?: Workspace; error?: string };
      if (!response.ok || !data.ok || !data.workspace) throw new Error(data.error || "無法載入學術語言版本。");
      setWorkspace(data.workspace);
      setSelectedGlossary((current) => current || data.workspace?.glossaries[0]?.versionId || "");
      setActiveDocumentId((current) => current || data.workspace?.documents[0]?.documentVersionId || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "無法載入學術語言版本。");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/academic-language`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as { ok?: boolean; error?: string; [key: string]: unknown };
    if (!response.ok || !data.ok) throw new Error(data.error || "操作未通過固定契約。");
    return data;
  }

  async function saveGlossary(event: FormEvent) {
    event.preventDefault(); setBusy("glossary"); setError(""); setNotice("");
    try {
      const entries = [...parseMappings(fixedTerms, "FIXED_TRANSLATION"), ...parseMappings(abbreviations, "ABBREVIATION")];
      await post({ operation: "SAVE_GLOSSARY", idempotencyKey: requestKey("m02-glossary"), logicalId: "m02-glossary-main", expectedVersion: glossaryVersion, title: glossaryTitle, tonePreset, entries, bannedTerms: parseBanned(bannedTerms) });
      setNotice("術語庫已新增為 append-only 版本；既有版本未被覆寫。");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "術語庫未儲存。"); } finally { setBusy(""); }
  }

  async function transform(event: FormEvent) {
    event.preventDefault(); setBusy("transform"); setError(""); setNotice("");
    try {
      const data = await post({
        operation: scratchMode ? "SCRATCH_TRANSFORM" : "TRANSFORM",
        idempotencyKey: requestKey("m02-language"),
        ...(scratchMode ? {} : { logicalId: "m02-language-main", expectedVersion: languageVersion, title }),
        task,
        scope: scratchMode ? "PARAGRAPH" : scope,
        tonePreset,
        sourceText,
        glossaryVersionId: currentGlossary?.versionId || null,
        glossaryHash: currentGlossary?.contentHash || null,
        methodParameters: { preserveCitations: true, preserveNumbers: true, preserveUnits: true, preserveFormulas: true, explainChanges: true },
        modeProfile,
      });
      if (scratchMode) {
        setScratchResult(data.scratch as ScratchResult);
        setNotice("段落已在不儲存模式完成；結果未寫入正式文件、版本或專案紀錄。");
        return;
      }
      const document = data.document as LanguageDocument;
      setNotice("已建立新的輸入／輸出版本；原文與既有正式文件均未被覆寫。");
      await load();
      setActiveDocumentId(document.documentVersionId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "老麥未產生可接受的語言版本。"); } finally { setBusy(""); }
  }

  async function approve() {
    if (!activeDocument || !reviewConfirmed) return;
    setBusy("approve"); setError(""); setNotice("");
    try {
      await post({ operation: "APPROVE_DOCUMENT", idempotencyKey: requestKey("m02-approval"), documentVersionId: activeDocument.documentVersionId, contentHash: activeDocument.contentHash, rationale });
      setNotice("Human Gate 已綁定此版本與內容雜湊；後續變更須建立新版本並重新核准。");
      setReviewConfirmed(false); setRationale(""); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "人工核准未完成。"); } finally { setBusy(""); }
  }

  async function promote() {
    if (!activeDocument || activeDocument.humanGate.status !== "APPROVED" || !activeDocument.humanGate.id) return;
    setBusy("promote"); setError(""); setNotice("");
    try {
      await post({ operation: "PROMOTE_DOCUMENT", idempotencyKey: requestKey("m02-promotion"), documentVersionId: activeDocument.documentVersionId, contentHash: activeDocument.contentHash, humanGateId: activeDocument.humanGate.id, targetLogicalId: "m02-formal-manuscript", expectedVersion: 0, title: activeDocument.title });
      setNotice("已依核准雜湊新增正式文件草稿版本；未覆寫任何既有文件。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "尚未併入正式文件。"); } finally { setBusy(""); }
  }

  return <section className="v13-panel m02-studio" aria-labelledby="m02-title">
    <div className="v13-panel-head"><div><p className="section-kicker">M02 · 專案級語言流程</p><h2 id="m02-title">專業翻譯與學術潤稿</h2></div><p className="v13-panel-note">所有結果先成為 append-only 草稿；未通過 Human Gate 不得發布或併入正式文件。</p></div>
    <ModelModePicker operation="ACADEMIC_LANGUAGE" value={modeProfile} onChange={setModeProfile} testId="m02-model-mode" />
    {error && <div className="v13-error" role="alert">{error}</div>}
    {notice && <div className="m02-notice" role="status" aria-live="polite">{notice}</div>}
    {loading ? <div className="v13-empty" role="status"><Icon name="file" /><div><strong>正在載入專案語言版本</strong><p>老麥只讀取目前 Project ID 的 append-only 記錄。</p></div></div> : <>
      <div className="m02-grid">
        <form className="m02-card" onSubmit={saveGlossary} aria-labelledby="m02-glossary-title">
          <header><div><small>VERSIONED GLOSSARY</small><h3 id="m02-glossary-title">專案術語庫</h3></div><span className="v13-badge required">v{glossaryVersion + 1}</span></header>
          <label>術語庫名稱<input value={glossaryTitle} onChange={(event) => setGlossaryTitle(event.target.value)} maxLength={240} required /></label>
          <label>固定翻譯<small>每行：原詞 =&gt; 固定英文</small><textarea value={fixedTerms} onChange={(event) => setFixedTerms(event.target.value)} rows={4} maxLength={12000} placeholder="教學實踐研究 => Teaching Practice Research" /></label>
          <label>縮寫<small>每行：全名 =&gt; 縮寫</small><textarea value={abbreviations} onChange={(event) => setAbbreviations(event.target.value)} rows={3} maxLength={8000} placeholder="structural equation modeling => SEM" /></label>
          <label>禁用詞與替代詞<small>每行：禁用詞 =&gt; 建議詞</small><textarea value={bannedTerms} onChange={(event) => setBannedTerms(event.target.value)} rows={3} maxLength={8000} /></label>
          <OldMikeAssistGroupControl projectId={projectId} surface="M02_TERMINOLOGY" groupId="m02-terminology" value={{ fixedTerms, abbreviations, bannedTerms }} modeProfile={modeProfile} onApply={(value) => { setFixedTerms(value.fixedTerms); setAbbreviations(value.abbreviations); setBannedTerms(value.bannedTerms); }} />
          <label>期刊語氣<select value={tonePreset} onChange={(event) => setTonePreset(event.target.value as AcademicTonePreset)}>{Object.entries(toneLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <button className="secondary-button" type="submit" disabled={busy !== ""}>{busy === "glossary" ? "儲存版本中…" : "新增術語庫版本"}</button>
        </form>

        <form className="m02-card" onSubmit={transform} aria-labelledby="m02-work-title">
          <header><div><small>BOUNDED INPUT · EXPLAINABLE OUTPUT</small><h3 id="m02-work-title">建立語言草稿</h3></div><span className="v13-badge required">Human Gate</span></header>
          <div className="m02-choice-row"><label><input type="radio" name="m02-task" checked={task === "TRANSLATE_ZH_EN"} onChange={() => setTask("TRANSLATE_ZH_EN")} />專業中翻英</label><label><input type="radio" name="m02-task" checked={task === "TRANSLATE_EN_ZH_TW"} onChange={() => setTask("TRANSLATE_EN_ZH_TW")} />英翻繁中（臺灣）</label><label><input type="radio" name="m02-task" checked={task === "EDIT_ACADEMIC_EN"} onChange={() => setTask("EDIT_ACADEMIC_EN")} />英語學術潤稿</label></div>
          <label className="v13-check"><input type="checkbox" checked={scratchMode} onChange={(event) => { setScratchMode(event.target.checked); setScratchResult(null); }} />段落試譯（不儲存；不建立版本）</label>
          {!scratchMode && <label>草稿名稱<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} required /></label>}
          <div className="m02-two-fields"><label>處理範圍<select value={scratchMode ? "PARAGRAPH" : scope} disabled={scratchMode} onChange={(event) => setScope(event.target.value as AcademicScope)}><option value="PARAGRAPH">單一段落</option><option value="FULL_TEXT">全文（有界）</option></select></label><label>期刊語氣<select value={tonePreset} onChange={(event) => setTonePreset(event.target.value as AcademicTonePreset)}>{Object.entries(toneLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
          <label>綁定術語庫版本<select value={selectedGlossary} onChange={(event) => setSelectedGlossary(event.target.value)}><option value="">不綁定術語庫</option>{workspace?.glossaries.map((item) => <option key={item.versionId} value={item.versionId}>{item.title} · v{item.versionNumber}</option>)}</select></label>
          <label>原文<textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={11} maxLength={48000} required aria-describedby="m02-source-help" /></label>
          <small id="m02-source-help">{sourceText.length}/48000 字元；保留引文、數字、單位與公式，不新增未提供的事實。</small>
          <button className="primary-button" type="submit" disabled={busy !== "" || !sourceText.trim()}>{busy === "transform" ? "處理中…" : scratchMode ? "不儲存試譯" : "建立 append-only 草稿"}</button>
        </form>
      </div>

      <section className="m02-results" aria-labelledby="m02-results-title">
        <div className="m02-results-head"><div><p className="section-kicker">並排審閱</p><h3 id="m02-results-title">原文、修改後與逐項理由</h3></div>{workspace?.documents.length ? <label>選擇版本<select value={activeDocument?.documentVersionId || ""} onChange={(event) => setActiveDocumentId(event.target.value)}>{workspace.documents.map((item) => <option key={item.documentVersionId} value={item.documentVersionId}>{item.title} · v{item.versionNumber}</option>)}</select></label> : null}</div>
        {scratchResult && <article className="m02-paragraph" aria-labelledby="m02-scratch-title"><h4 id="m02-scratch-title">不儲存段落試譯</h4><p className="v13-muted">未建立文件版本、Human Gate 或正式紀錄。</p>{scratchResult.paragraphs.map((paragraph) => <div key={paragraph.index}><div className="m02-side-by-side"><section><h5>原文</h5><p>{paragraph.source}</p></section><section><h5>修改後</h5><p>{paragraph.revised}</p></section></div><div className="m02-change-list"><h5>修改理由</h5><ol>{paragraph.changes.map((change, index) => <li key={`${change.kind}-${index}`}><strong>{change.kind}</strong><p>{change.reason}</p></li>)}</ol></div></div>)}{scratchResult.uncertainties.length > 0 && <div className="m02-uncertainties"><h5>術語與語意不確定性</h5><ul>{scratchResult.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul></div>}</article>}
        {!activeDocument ? <div className="v13-empty"><Icon name="file" /><div><strong>尚無語言草稿</strong><p>建立草稿後，這裡會顯示逐段並排版本與可解釋的修改理由。</p></div></div> : <>
          <div className="m02-result-meta"><span className={`v13-badge ${activeDocument.humanGate.status.toLowerCase()}`}>{activeDocument.humanGate.status === "APPROVED" ? "已人工核准" : "待人工核准"}</span><span>來源雜湊 <code>{activeDocument.sourceHash.slice(0, 12)}…</code></span><span>結果雜湊 <code>{activeDocument.resultHash.slice(0, 12)}…</code></span><span>{toneLabels[activeDocument.tonePreset]}</span></div>
          {activeDocument.paragraphs.map((paragraph) => <article className="m02-paragraph" key={paragraph.index} aria-labelledby={`m02-paragraph-${paragraph.index}`}><h4 id={`m02-paragraph-${paragraph.index}`}>段落 {paragraph.index + 1}</h4><div className="m02-side-by-side"><section><h5>原文</h5><p>{paragraph.source}</p></section><section><h5>修改後</h5><p>{paragraph.revised}</p></section></div><div className="m02-change-list"><h5>逐項修改理由</h5>{paragraph.changes.length ? <ol>{paragraph.changes.map((change, index) => <li key={`${change.kind}-${index}`}><strong>{change.kind}</strong><p>{change.reason}</p>{(change.original || change.revised) && <small>{change.original || "（新增銜接）"} → {change.revised || "（刪除）"}</small>}</li>)}</ol> : <p>此段未記錄語意或措辭變更。</p>}</div></article>)}
          {activeDocument.uncertainties.length > 0 && <div className="m02-uncertainties"><h4>待研究者確認</h4><ul>{activeDocument.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul></div>}
          <div className="m02-human-gate"><div><h4>Human Gate</h4><p>核准會鎖定目前版本與內容雜湊。任何後續修改都必須建立新版本並重新審核。</p></div>{activeDocument.humanGate.status === "REQUIRED" ? <div className="m02-review-controls"><label>核准理由<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} maxLength={2000} required /></label><label className="v13-check"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} />我已逐段核對內容、術語、數字、引文、單位與研究主張。</label><button type="button" className="primary-button" onClick={() => void approve()} disabled={busy !== "" || !reviewConfirmed || rationale.trim().length < 8}>{busy === "approve" ? "核准中…" : "核准此固定版本"}</button></div> : <div className="m02-review-controls"><p className="m02-approved"><Icon name="shield" />此版本已通過人工核准，可另行新增至正式文件。</p><button type="button" className="secondary-button" onClick={() => void promote()} disabled={busy !== ""}>{busy === "promote" ? "建立正式草稿中…" : "新增至正式文件（不覆寫）"}</button></div>}</div>
        </>}
      </section>
    </>}
  </section>;
}
