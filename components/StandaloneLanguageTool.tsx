"use client";

import { FormEvent, useState } from "react";
import Icon from "./Icons";
import ModelModePicker from "./ModelModePicker";
import type { AcademicLanguageTask, AcademicScope, AcademicTonePreset } from "@/lib/academic-language-contract";
import type { ModelModeProfile } from "@/lib/model-mode-contract";

const toneLabels: Record<AcademicTonePreset, string> = {
  JOURNAL_CONCISE: "期刊精煉",
  JOURNAL_FORMAL: "期刊正式",
  JOURNAL_INTERPRETIVE: "審慎詮釋",
};

type Engine = "OLD_MIKE" | "DEEPL";

type StandaloneResult = {
  contractVersion: string;
  task: AcademicLanguageTask;
  tonePreset: AcademicTonePreset;
  paragraphs: Array<{ index: number; source: string; revised: string; changes: Array<{ kind: string; original: string; revised: string; reason: string }> }>;
  uncertainties: string[];
  sourceHash: string;
  resultHash: string;
  persistence: "NONE";
  humanGate: "NOT_APPLICABLE";
  mode: "STANDALONE_AI_PROPOSED";
  engine: "OLD_MIKE" | "DEEPL";
  mechanical?: {
    engine: "LANGUAGETOOL";
    available: boolean;
    degradedParagraphs: number[];
    issues: Array<{ paragraphIndex: number; offset: number; length: number; message: string; shortMessage?: string; ruleId: string; category: string; replacements: string[] }>;
  };
  note: string;
};

function applyLtSelection(source: string, issues: NonNullable<StandaloneResult["mechanical"]>["issues"], selected: Set<string>, paragraphIndex: number): string {
  const chosen = issues.filter((issue) => issue.paragraphIndex === paragraphIndex && issue.replacements.length > 0 && selected.has(`${paragraphIndex}:${issues.indexOf(issue)}`)).sort((a, b) => b.offset - a.offset);
  let draft = source;
  for (const issue of chosen) {
    const before = draft.slice(0, issue.offset);
    const after = draft.slice(issue.offset + issue.length);
    draft = before + (issue.replacements[0] ?? "") + after;
  }
  return draft;
}

const changeKindLabels: Record<string, string> = {
  GRAMMAR: "文法", TERMINOLOGY: "術語", CLARITY: "清晰度", TONE: "語氣", STRUCTURE: "結構", TRANSLATION: "翻譯",
};
const isGrammarCheck = (task: AcademicLanguageTask) => task === "GRAMMAR_CHECK";

function deeplUnavailableReason(task: AcademicLanguageTask, termsFilled: boolean): string | null {
  if (task === "EDIT_ACADEMIC_EN") return "DeepL 不支援英語學術潤稿（僅老麥 AI）。";
  if (task === "GRAMMAR_CHECK") return "DeepL 不支援英文文法檢查（僅老麥 AI）。";
  if (termsFilled) return "術語表／禁用詞僅老麥 AI 引擎可用（DeepL Free 不支援）。";
  return null;
}

const transientErrorHints: Record<string, string> = {
  invalid_language_paragraph_shape: "老麥引擎本次回應未通過固定格式契約（已自動重試仍失敗，通常為暫時性）。建議：縮短為單一段落後再試，或稍後重送。",
  invalid_language_response: "老麥引擎本次回應無法安全解析（已自動重試仍失敗，通常為暫時性）。建議：縮短為單一段落後再試，或稍後重送。",
  language_result_paragraph_mismatch: "段落數或順序與原文不一致（已自動重試仍失敗）。請縮短內容後再試。",
  language_result_binding_mismatch: "語言任務綁定不一致（已自動重試仍失敗）。請重新送出。",
  citation_preservation_failed: "引文未逐字保留，為保護文獻完整性已拒絕輸出。請確認原文引文格式後再試。",
  number_preservation_failed: "數字未逐字保留，為避免數據錯誤已拒絕輸出。請確認後再試。",
  unit_preservation_failed: "單位未逐字保留，已拒絕輸出。請確認後再試。",
  formula_preservation_failed: "公式未逐字保留，已拒絕輸出。請確認後再試。",
  glossary_term_not_preserved: "固定術語未完整套用，已拒絕輸出。請檢查術語表與原文後再試。",
  banned_term_present: "輸出仍含禁用詞，已拒絕輸出。請調整後再試。",
  language_service_unavailable: "老麥引擎暫時無法連線（可能忙碌中）。請稍後再試。",
  language_service_not_ready: "老麥引擎尚未設定完成，請通知管理員。",
  language_service_policy_error: "老麥引擎政策設定不符，請通知管理員。",
  deepl_not_configured: "DeepL 引擎尚未設定（缺少 API Key），請通知管理員。",
  deepl_task_not_supported: "DeepL 僅支援中→英／英→繁中翻譯；英語學術潤稿請使用老麥 AI 引擎。",
  deepl_quota_exceeded: "DeepL Free 每月字元額度已用罄；請改用老麥 AI 引擎或升級 DeepL 方案。",
  deepl_rate_limited: "DeepL 暫時限制請求頻率；請稍後再試或改用老麥 AI 引擎。",
  deepl_auth_failed: "DeepL API Key 驗證失敗，請通知管理員。",
  deepl_upstream_error: "DeepL 暫時無法連線；請稍後再試或改用老麥 AI 引擎。",
};

function errorText(code: string | undefined, fallback: string | undefined): string {
  const hint = code ? transientErrorHints[code] : undefined;
  if (hint) return `${hint}（錯誤碼 ${code}）`;
  if (code === "rate_limit_exceeded") return "送出次數過於頻繁，請稍候片刻再試。";
  return `${fallback || "老麥目前無法完成這項獨立語言處理。"}${code ? `（錯誤碼 ${code}）` : ""}`;
}

export default function StandaloneLanguageTool() {
  const [task, setTask] = useState<AcademicLanguageTask>("TRANSLATE_ZH_EN");
  const [tonePreset, setTonePreset] = useState<AcademicTonePreset>("JOURNAL_FORMAL");
  const [scope, setScope] = useState<AcademicScope>("PARAGRAPH");
  const [sourceText, setSourceText] = useState("");
  const [fixedTerms, setFixedTerms] = useState("");
  const [abbreviations, setAbbreviations] = useState("");
  const [bannedTerms, setBannedTerms] = useState("");
  const [modeProfile, setModeProfile] = useState<ModelModeProfile>("AUTO");
  const [engine, setEngine] = useState<Engine>("OLD_MIKE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<StandaloneResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [appliedLt, setAppliedLt] = useState<Record<string, boolean>>({});

  const termsFilled = Boolean(fixedTerms.trim() || abbreviations.trim() || bannedTerms.trim());
  const deeplLockedReason = deeplUnavailableReason(task, termsFilled);
  // 任務或術語表使 DeepL 不可用時，自動退回老麥 AI（避免送出後被拒）
  const effectiveEngine: Engine = engine === "DEEPL" && deeplLockedReason ? "OLD_MIKE" : engine;

  async function transform(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice(""); setResult(null); setCopied(false); setAppliedLt({});
    try {
      const response = await fetch("/api/standalone/academic-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "STANDALONE_TRANSFORM",
          task,
          scope,
          tonePreset,
          sourceText,
          modeProfile,
          engine: effectiveEngine,
          terms: { fixedTerms: fixedTerms.trim() || undefined, abbreviations: abbreviations.trim() || undefined, bannedTerms: bannedTerms.trim() || undefined },
        }),
      });
      const data = await response.json() as { ok?: boolean; scratch?: StandaloneResult; error?: string; code?: string };
      if (!response.ok || !data.ok || !data.scratch) throw new Error(errorText(data.code, data.error));
      setResult(data.scratch);
      const engineNotice = data.scratch.engine === "DEEPL" ? "DeepL 引擎輸出為第三方機器翻譯草稿：未寫入任何研究專案；請人工核對專業術語與語意。" : isGrammarCheck(task) ? "英文文法檢查為診斷結果：問題清單與建議修正僅供參考，不會自動改寫任何檔案。" : "獨立工具輸出為 AI_PROPOSED 草稿：未寫入任何研究專案、版本或正式文件。";
      setNotice(engineNotice);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "獨立翻譯未完成。");
    } finally { setBusy(false); }
  }

  function copyResult() {
    if (!result) return;
    const text = result.paragraphs.map((paragraph) => paragraph.revised).join("\n\n");
    void navigator.clipboard.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => setCopied(false));
  }

  function copyMechanicalFullText() {
    if (!result) return;
    const selected = new Set(Object.entries(appliedLt).filter(([, on]) => on).map(([key]) => key));
    const issues = result.mechanical?.issues ?? [];
    const text = result.paragraphs.map((paragraph) => applyLtSelection(paragraph.source, issues, selected, paragraph.index)).join("\n\n");
    void navigator.clipboard.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => setCopied(false));
  }

  function toggleParagraphLt(paragraphIndex: number, on: boolean) {
    if (!result?.mechanical) return;
    setAppliedLt((prev) => {
      const next = { ...prev };
      result.mechanical!.issues.forEach((issue, issueIndex) => {
        if (issue.paragraphIndex === paragraphIndex && issue.replacements.length > 0) next[`${paragraphIndex}:${issueIndex}`] = on;
      });
      return next;
    });
  }

  function renderLtBatchPanel(current: NonNullable<StandaloneResult>): React.ReactNode {
    const issues = current.mechanical?.issues ?? [];
    if (issues.length === 0) return null;
    const selectable = issues.filter((issue) => issue.replacements.length > 0);
    const selectedCount = selectable.filter((issue) => appliedLt[`${issue.paragraphIndex}:${issues.indexOf(issue)}`]).length;
    return <section className="m02-card" style={{ marginTop: 10 }}>
      <header><div><small>機械檢查層（LanguageTool）</small><h4>批次套用 LT 建議</h4></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="secondary-button" onClick={() => setAppliedLt(Object.fromEntries(selectable.map((issue) => [`${issue.paragraphIndex}:${issues.indexOf(issue)}`, true] as [string, boolean])))}>全部套用</button>
          <button type="button" className="link-button" onClick={() => setAppliedLt({})}>全部取消</button>
          <button type="button" className="primary-button" disabled={selectedCount === 0} onClick={copyMechanicalFullText}>複製套用結果（{selectedCount}/{selectable.length}）</button>
        </div>
      </header>
      <p className="v13-muted" style={{ fontSize: 11 }}>LT 機械建議僅作輔助；套用會先取代最長落差的修正，AI 層已保留數字／引文／術語。正式文稿仍須人工核對。</p>
      {current.paragraphs.map((paragraph) => {
        const paraIssues = issues.filter((issue) => issue.paragraphIndex === paragraph.index);
        if (paraIssues.length === 0) return null;
        return <div key={paragraph.index} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <strong>段落 {paragraph.index + 1}（{paraIssues.length} 項）</strong>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" className="link-button" onClick={() => toggleParagraphLt(paragraph.index, true)}>套用此段全部</button>
              <button type="button" className="link-button" onClick={() => toggleParagraphLt(paragraph.index, false)}>取消此段</button>
            </span>
          </div>
          <ul className="m02-change-list">{paraIssues.map((issue) => {
            const key = `${issue.paragraphIndex}:${issues.indexOf(issue)}`;
            const original = paragraph.source.slice(issue.offset, issue.offset + issue.length);
            const enabled = issue.replacements.length > 0;
            return <li key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input type="checkbox" checked={Boolean(appliedLt[key])} disabled={!enabled} onChange={(event) => setAppliedLt((prev) => ({ ...prev, [key]: event.target.checked }))} />
              <div><p>{issue.message}</p><small>{original || "（空白）"} → {issue.replacements[0] ?? "（無建議）"}{issue.replacements.length > 1 ? `（另有 ${issue.replacements.length - 1} 個替代）` : ""}</small></div>
            </li>;
          })}</ul>
        </div>;
      })}
    </section>;
  }

  return <section className="v13-panel m02-studio" aria-labelledby="standalone-language-title">
    <div className="v13-panel-head"><div><p className="section-kicker">獨立工具 · 不需研究專案或前面流程</p><h2 id="standalone-language-title">翻譯與學術潤稿（獨立）</h2></div><p className="v13-panel-note">主要用途：paper 文獻與簡單寫作。結果為 AI_PROPOSED 草稿，不寫入任何研究專案、版本或正式文件；老麥仍是最終語義控制層，所有數字、引文與術語須人工核對。</p></div>
    <ModelModePicker operation="ACADEMIC_LANGUAGE" value={modeProfile} onChange={setModeProfile} testId="standalone-language-model-mode" />
    <div className="m02-choice-row" style={{ marginTop: 10 }}>
      <span className="v13-badge" style={{ alignSelf: "center" }}>引擎</span>
      <label><input type="radio" name="standalone-engine" checked={effectiveEngine === "OLD_MIKE"} onChange={() => setEngine("OLD_MIKE")} />老麥 AI（學術語境＋術語表）</label>
      <label><input type="radio" name="standalone-engine" checked={effectiveEngine === "DEEPL"} disabled={Boolean(deeplLockedReason)} onChange={() => setEngine("DEEPL")} />DeepL 專業翻譯</label>
      {deeplLockedReason ? <small className="v13-muted">🔒 {deeplLockedReason}</small> : <small className="v13-muted">DeepL：專業機器翻譯；文字將傳送至第三方伺服器處理，請勿輸入含個資或機密內容；不支援術語表與學術潤稿。</small>}
    </div>
    {error && <div className="v13-error" role="alert">{error}</div>}
    {notice && <div className="m02-notice" role="status" aria-live="polite">{notice}</div>}
    <form className="m02-card" onSubmit={transform} aria-labelledby="standalone-work-title" style={{ marginTop: 12 }}>
      <header><div><small>獨立翻譯與潤稿</small><h3 id="standalone-work-title">貼上文字 → 老麥處理</h3></div><span className="v13-badge required">AI_PROPOSED</span></header>
      <div className="m02-choice-row">
        <label><input type="radio" name="standalone-task" checked={task === "TRANSLATE_ZH_EN"} onChange={() => setTask("TRANSLATE_ZH_EN")} />中文→英文（投稿/文獻）</label>
        <label><input type="radio" name="standalone-task" checked={task === "TRANSLATE_EN_ZH_TW"} onChange={() => setTask("TRANSLATE_EN_ZH_TW")} />英文→繁中（臺灣）</label>
        <label><input type="radio" name="standalone-task" checked={task === "EDIT_ACADEMIC_EN"} onChange={() => setTask("EDIT_ACADEMIC_EN")} />英語學術潤稿</label>
        <label><input type="radio" name="standalone-task" checked={task === "GRAMMAR_CHECK"} onChange={() => setTask("GRAMMAR_CHECK")} />英文文法檢查（診斷）</label>
      </div>
      <div className="m02-two-fields">
        <label>處理範圍<select value={scope} onChange={(event) => setScope(event.target.value as AcademicScope)}><option value="PARAGRAPH">單一段落</option><option value="FULL_TEXT">全文（有界）</option></select></label>
        <label>期刊語氣<select value={tonePreset} onChange={(event) => setTonePreset(event.target.value as AcademicTonePreset)}>{Object.entries(toneLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>
      <label>原文<textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={11} maxLength={48000} required aria-describedby="standalone-source-help" /></label>
      <small id="standalone-source-help">{sourceText.length}/48000 字元；保留引文、數字、單位與公式，不新增未提供的事實。</small>
      <button className="primary-button" type="submit" disabled={busy || !sourceText.trim()}>{busy ? "處理中…" : effectiveEngine === "DEEPL" ? "DeepL 翻譯" : isGrammarCheck(task) ? "開始文法檢查" : "老麥翻譯／潤稿"}</button>
    </form>
    <details className="m02-card" style={{ marginTop: 10 }}>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>臨時術語表（本次有效，不儲存）</summary>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        <label>固定翻譯<small>每行：原詞 =&gt; 固定英文</small><textarea value={fixedTerms} onChange={(event) => setFixedTerms(event.target.value)} rows={3} maxLength={12000} placeholder="教學實踐研究 => Teaching Practice Research" /></label>
        <label>縮寫<small>每行：全名 =&gt; 縮寫</small><textarea value={abbreviations} onChange={(event) => setAbbreviations(event.target.value)} rows={2} maxLength={8000} placeholder="structural equation modeling => SEM" /></label>
        <label>禁用詞與替代詞<small>每行：禁用詞 =&gt; 建議詞</small><textarea value={bannedTerms} onChange={(event) => setBannedTerms(event.target.value)} rows={2} maxLength={8000} /></label>
      </div>
    </details>
    <section className="m02-results" aria-labelledby="standalone-results-title" style={{ marginTop: 12 }}>
      <div className="m02-results-head"><div><p className="section-kicker">並排審閱</p><h3 id="standalone-results-title">{isGrammarCheck(task) ? "診斷結果：逐項問題與建議" : "原文、修改後與逐項理由"}</h3></div>{result ? <button type="button" className="secondary-button" onClick={copyResult}>{copied ? "已複製 ✓" : isGrammarCheck(task) ? "複製修正後全文" : "複製修改後全文"}</button> : null}</div>
      {!result ? <div className="v13-empty"><Icon name="file" /><div><strong>尚無輸出</strong><p>貼上文字後點「{isGrammarCheck(task) ? "開始文法檢查" : "老麥翻譯／潤稿"}」；輸出只顯示在此處，不會寫入任何專案。</p></div></div> : <>
        <p className="v13-muted" style={{ fontSize: 10 }}>{result.engine === "DEEPL" ? "🤖 引擎：DeepL 專業翻譯　·　" : "🧠 引擎：老麥 AI　·　"}{result.note}</p>
        {isGrammarCheck(task) && <p className="v13-muted" style={{ fontSize: 11 }}>{(() => { const total = result.paragraphs.reduce((n, paragraph) => n + paragraph.changes.length, 0); return total === 0 ? "✅ 未發現需要修正的問題（或引擎未標記任何問題）。" : `🔍 發現 ${total} 個問題，均附建議修正與理由；可逐項判斷後套用。`; })()}</p>}
        {isGrammarCheck(task) ? renderLtBatchPanel(result) : null}
        {result.paragraphs.map((paragraph) => <article className="m02-paragraph" key={paragraph.index} aria-labelledby={`standalone-paragraph-${paragraph.index}`}><h4>段落 {paragraph.index + 1}</h4><div className="m02-side-by-side"><section><h5>原文</h5><p>{paragraph.source}</p></section><section><h5>{isGrammarCheck(task) ? "修正後" : "修改後"}</h5><p>{paragraph.revised}</p></section></div><div className="m02-change-list"><h5>{isGrammarCheck(task) ? "問題與建議修正" : "逐項修改理由"}</h5>{paragraph.changes.length ? <ol>{paragraph.changes.map((change, index) => <li key={`${change.kind}-${index}`}><strong>{changeKindLabels[change.kind] ?? change.kind}</strong><p>{change.reason}</p>{(change.original || change.revised) && <small>{change.original || "（新增銜接）"} → {change.revised || "（刪除）"}</small>}</li>)}</ol> : <p>{isGrammarCheck(task) ? "此段未發現需要修正的問題。" : "此段未記錄語意或措辭變更。"}</p>}</div></article>)}
        {result.uncertainties.length > 0 && <div className="m02-uncertainties"><h4>待研究者確認</h4><ul>{result.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul></div>}
      </>}
    </section>
  </section>;
}
