"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { S0_FIELDS, type S0FieldName } from "@/lib/s0-fields";
import type { V2Alpha8CoreSection, V2Alpha8Goal, V2Alpha8MaterialKind, V2Alpha8ResultReadiness, V2Alpha8S0Alternative, V2Alpha8Workspace } from "@/lib/v2-alpha8/contracts";

import styles from "./v2-alpha8.module.css";

type Props = {
  domains: readonly { id: string; label: string }[];
  goals: readonly { id: V2Alpha8Goal; label: string; detail: string }[];
};

type MaterialField = { kind: V2Alpha8MaterialKind; label: string; hint: string; rows: number };
type StatisticDraft = { statisticId: string; label: string; value: string; unit: string; sourceMaterialId: string; consistency: "CONSISTENT_REPORTED" | "CONFLICT_REPORTED" | "UNCHECKED"; note: string };

const WORKSPACE_AUTHORITY = "fixture-workspace-v2";
const MATERIAL_FIELDS: readonly MaterialField[] = [
  { kind: "ABSTRACT", label: "摘要或研究構想", hint: "可貼上寫到一半的摘要、研究目的或核心構想。", rows: 5 },
  { kind: "INTRODUCTION", label: "前言與研究背景", hint: "可包含研究問題、理論背景、動機與既有文獻摘要。", rows: 6 },
  { kind: "METHODS", label: "方法設計", hint: "研究對象、設計、工具、程序、變項與分析想法。", rows: 6 },
  { kind: "RESULTS", label: "結果與初步發現", hint: "只貼上實際觀察或已完成分析，不必整理成論文語氣。", rows: 6 },
  { kind: "DISCUSSION", label: "討論與限制", hint: "目前的解釋、限制、反直覺發現或尚未想通的地方。", rows: 5 },
  { kind: "EXPERIMENT_DATA", label: "實驗資料說明", hint: "資料版本、樣本、欄位、實驗條件與可用檔案摘要。", rows: 4 },
  { kind: "SURVEY_DATA", label: "問卷與量測資料", hint: "量表、題項、信效度、前後測或追蹤資料摘要。", rows: 4 },
  { kind: "TABLE", label: "表格與圖形摘要", hint: "表格、圖形、數值與圖說；不要上傳敏感原始資料。", rows: 4 },
  { kind: "CITATION_LIBRARY", label: "文獻與引用筆記", hint: "DOI、Zotero 筆記、理論脈絡或待核對的引用。", rows: 4 },
  { kind: "NOTE", label: "其他研究備註", hint: "期刊偏好、計畫規範、時間、限制或想保留的研究靈感。", rows: 4 },
] as const;
const CORE_MATERIAL_FIELDS = MATERIAL_FIELDS.slice(0, 5);
const OPTIONAL_MATERIAL_FIELDS = MATERIAL_FIELDS.slice(5);

const SECTION_LABELS: Record<V2Alpha8CoreSection, string> = {
  ABSTRACT: "摘要",
  INTRODUCTION: "前言",
  METHODS: "方法",
  RESULTS: "結果",
  DISCUSSION: "討論",
  CONCLUSION: "結論",
};

const EXAMPLE: Partial<Record<V2Alpha8MaterialKind, string>> = {
  ABSTRACT: "本研究探討生成式工具輔助高等教育教師備課時，信任校準如何影響課程決策。研究已完成前後測與訪談，但摘要中的結果尚未對回統計表。",
  INTRODUCTION: "教師採用生成式工具的速度很快，但目前仍不清楚何種證據會改變其信任與課程判斷。現有稿件以科技接受為背景，尚缺乏可反駁的作用機制。",
  METHODS: "採混合方法設計，共有兩組課程情境。量化部分含前後測與決策信心量表，質性部分含半結構訪談與課程文件。",
  RESULTS: "介入組的決策信心平均值提高，訪談顯示教師在看見可核對證據時較願意修正原本判斷；因果與跨場域推論尚未完成。",
  DISCUSSION: "初步結果可能與信任校準有關，但也可能受到教師經驗、課程難度與工具熟悉度影響。",
  EXPERIMENT_DATA: "資料包含前測、後測、組別、教學年資與課程類型；需再確認缺失值與排除規則。",
  SURVEY_DATA: "決策信心量表為五點量尺，已完成內部一致性初步檢查；完整信效度仍待核對。",
  TABLE: "表 1 為樣本特徵；表 2 為兩組前後測描述統計；圖 1 顯示信心變化趨勢。",
  CITATION_LIBRARY: "Zotero 已整理信任校準、教師決策與人機協作相關文獻；正式引用仍需逐筆核驗。",
};

function materialId(kind: V2Alpha8MaterialKind) {
  return `material-${kind.toLocaleLowerCase("en-US").replaceAll("_", "-")}`;
}

function laneLabel(lane: string) {
  if (lane === "EVIDENCE_FIRST") return "證據優先";
  if (lane === "BALANCED_RECOMMENDED") return "平衡推薦";
  return "前沿創新";
}

function evidenceLabel(state: string) {
  if (state === "OBSERVED") return "來自既有材料";
  if (state === "MISSING") return "尚缺資料";
  if (state === "ASSUMPTION") return "規劃假設";
  return "待核對";
}

async function requestRescue(body: unknown) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch("/api/v2-alpha8/rescue", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": WORKSPACE_AUTHORITY },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export function V2Alpha8PartialDraftWorkspace({ domains, goals }: Props) {
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [customDomain, setCustomDomain] = useState("");
  const [goal, setGoal] = useState<V2Alpha8Goal>("JOURNAL_MANUSCRIPT");
  const [resultReadiness, setResultReadiness] = useState<V2Alpha8ResultReadiness>("UNCERTAIN");
  const [materialText, setMaterialText] = useState<Partial<Record<V2Alpha8MaterialKind, string>>>({});
  const [statistics, setStatistics] = useState<StatisticDraft[]>([]);
  const [workspace, setWorkspace] = useState<V2Alpha8Workspace | null>(null);
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null);
  const [workingDraft, setWorkingDraft] = useState<Partial<Record<V2Alpha8CoreSection, string>>>({});
  const [draftBase, setDraftBase] = useState<Partial<Record<V2Alpha8CoreSection, string>>>({});
  const [undoDraft, setUndoDraft] = useState<Partial<Record<V2Alpha8CoreSection, string>> | null>(null);
  const [workingS0, setWorkingS0] = useState<Partial<Record<S0FieldName, string>>>({});
  const [s0Undo, setS0Undo] = useState<Partial<Record<S0FieldName, string>>>({});
  const [artifactDirty, setArtifactDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const resultHeading = useRef<HTMLHeadingElement | null>(null);
  const attemptIdentity = useRef<{ requestId: string; idempotencyKey: string } | null>(null);
  const statisticNameInputs = useRef<Array<HTMLInputElement | null>>([]);
  const addStatisticButton = useRef<HTMLButtonElement | null>(null);

  const selectedDomain = domains.find((item) => item.id === domainId);
  const filledFields = MATERIAL_FIELDS.filter((field) => (materialText[field.kind] ?? "").trim());
  const filledMaterialIds = filledFields.map((field) => materialId(field.kind));
  const selectedDirection = workspace?.stageA.directions.find((item) => item.directionId === selectedDirectionId) ?? workspace?.stageA.directions.find((item) => item.recommended) ?? null;
  const s0Count = workspace ? S0_FIELDS.filter((field) => workspace.stageB.s0[field.name].value.trim()).length : 0;
  const appliedCount = useMemo(() => Object.values(workingDraft).filter((value) => value?.trim()).length, [workingDraft]);

  useEffect(() => {
    if (workspace) resultHeading.current?.focus();
  }, [workspace]);

  function invalidateSource() {
    const hadActiveAttempt = attemptIdentity.current !== null;
    attemptIdentity.current = null;
    if (workspace || hadActiveAttempt) setArtifactDirty(true);
  }

  function setMaterial(kind: V2Alpha8MaterialKind, value: string) {
    invalidateSource();
    setMaterialText((current) => ({ ...current, [kind]: value }));
  }

  function loadExample() {
    invalidateSource();
    setMaterialText(EXAMPLE);
    setResultReadiness("OBSERVED_RESULTS_AVAILABLE");
    setStatistics([
      { statisticId: "stat-n", label: "有效樣本數", value: "118", unit: "人", sourceMaterialId: materialId("SURVEY_DATA"), consistency: "CONSISTENT_REPORTED", note: "使用者提供的同一版清理後資料摘要。" },
      { statisticId: "stat-alpha", label: "量表內部一致性", value: "0.86", unit: "α", sourceMaterialId: materialId("SURVEY_DATA"), consistency: "CONSISTENT_REPORTED", note: "僅作為使用者提供之描述值，仍需由分析紀錄核對。" },
    ]);
    setError(null);
    setAnnouncement("已載入示範半成品，可直接查看一鍵接續流程。");
  }

  function addStatistic() {
    const sourceMaterialId = filledMaterialIds[0] ?? "";
    invalidateSource();
    const nextIndex = statistics.length;
    setStatistics((current) => [...current, { statisticId: `stat-${crypto.randomUUID()}`, label: "", value: "", unit: "", sourceMaterialId, consistency: "UNCHECKED", note: "尚未完成一致性核對。" }]);
    setAnnouncement(`已新增統計摘要 ${nextIndex + 1}。`);
    window.setTimeout(() => statisticNameInputs.current[nextIndex]?.focus(), 0);
  }

  function updateStatistic(index: number, patch: Partial<StatisticDraft>) {
    invalidateSource();
    setStatistics((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function removeStatistic(index: number) {
    invalidateSource();
    const label = statistics[index]?.label.trim() || `第 ${index + 1} 筆`;
    const remaining = statistics.length - 1;
    setStatistics((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setAnnouncement(`已移除統計摘要：${label}。`);
    window.setTimeout(() => {
      if (remaining > 0) statisticNameInputs.current[Math.min(index, remaining - 1)]?.focus();
      else addStatisticButton.current?.focus();
    }, 0);
  }

  function updateDomain(value: string) {
    invalidateSource();
    setDomainId(value);
  }

  function updateCustomDomain(value: string) {
    invalidateSource();
    setCustomDomain(value);
  }

  function updateGoal(value: V2Alpha8Goal) {
    invalidateSource();
    setGoal(value);
  }

  function updateResultReadiness(value: V2Alpha8ResultReadiness) {
    invalidateSource();
    setResultReadiness(value);
  }

  async function runRescue() {
    if (filledFields.length === 0) {
      setError("請至少貼上一項現有材料；你的輸入不會被清除。");
      return;
    }
    const label = domainId === "CUSTOM" ? customDomain.trim() : selectedDomain?.label ?? "";
    if (label.length < 2) {
      setError("請選擇研究領域，或輸入至少 2 個字的自訂研究領域。");
      return;
    }
    const usableStatistics = statistics.filter((item) => item.label.trim() || item.value.trim() || item.unit.trim());
    if (usableStatistics.some((item) => !item.label.trim() || !item.value.trim() || !item.unit.trim() || !item.sourceMaterialId || !filledMaterialIds.includes(item.sourceMaterialId))) {
      setError("統計摘要需填完整名稱、數值、單位與來源材料；也可刪除未完成列後再繼續。");
      return;
    }
    setLoading(true);
    setError(null);
    setAnnouncement("老麥正在先盤點材料，再接續研究藍圖與六段工作稿。");
    attemptIdentity.current ??= { requestId: `alpha8-ui-${crypto.randomUUID()}`, idempotencyKey: `alpha8-idem-${crypto.randomUUID()}` };
    const identity = attemptIdentity.current;
    const sourceDraftAtSubmission = Object.fromEntries(V2_ALPHA8_CORE_SECTION_KEYS.map((sectionId) => [sectionId, materialText[SECTION_TO_INPUT[sectionId]] ?? ""]));
    try {
      const response = await requestRescue({
        contractVersion: "old-mike-v2-alpha8/1.0.0",
        requestId: identity.requestId,
        idempotencyKey: identity.idempotencyKey,
        focusDomain: domainId === "CUSTOM" ? { kind: "CUSTOM", domainId: null, label } : { kind: "BUILTIN", domainId, label },
        goal,
        resultReadiness,
        materials: filledFields.map((field) => ({ materialId: materialId(field.kind), kind: field.kind, title: field.label, content: materialText[field.kind]!.trim() })),
        statistics: usableStatistics.map((item) => ({ ...item, label: item.label.trim(), value: item.value.trim(), unit: item.unit.trim(), note: item.note.trim() || "尚未提供補充說明。" })),
      });
      const body = await response.json() as { ok?: boolean; workspace?: V2Alpha8Workspace; code?: string };
      if (!response.ok || !body.ok || !body.workspace) throw new Error(body.code ?? "alpha8_ui_request_failed");
      if (attemptIdentity.current !== identity) {
        setArtifactDirty(true);
        setError("材料在等待期間已變更；新的輸入已保留，較早的回覆不會成為目前結果。請重新接續一次。");
        setAnnouncement("已丟棄過期回覆；目前材料沒有被覆寫。");
        return;
      }
      setWorkspace(body.workspace);
      setSelectedDirectionId(body.workspace.stageA.recommendedDirectionId);
      setWorkingDraft(sourceDraftAtSubmission);
      setDraftBase(structuredClone(sourceDraftAtSubmission));
      setUndoDraft(null);
      setWorkingS0(Object.fromEntries(S0_FIELDS.map((field) => [field.name, body.workspace!.stageB.s0[field.name].value])));
      setS0Undo({});
      setArtifactDirty(false);
      setAnnouncement("已完成材料盤點、三個研究方向、13 欄研究藍圖、分析工作包與六段接續稿。");
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "";
      setError(code.includes("completion_unknown") ? "這次處理狀態尚待確認；所有輸入均已保留，系統不會自動重送。" : "這次接續未完成；所有輸入與既有草稿均已保留，系統沒有自動重送。");
      setAnnouncement("處理未完成，原始材料保持不變。");
    } finally {
      setLoading(false);
    }
  }

  function applyWholeDraft() {
    if (!workspace) return;
    if (artifactDirty) {
      setError("材料已變更；請先重新接續，再套用新的工作稿。");
      setAnnouncement("舊工作稿未套用，因為來源材料已變更。");
      return;
    }
    if (undoDraft) {
      setAnnouncement("接續稿已套用；可先完整復原，再重新套用。");
      return;
    }
    if (JSON.stringify(workingDraft) !== JSON.stringify(draftBase)) {
      setError("目前工作稿已在生成後修改；為避免覆寫，你的內容已保留。請重新接續後再套用。");
      setAnnouncement("偵測到工作稿已變更，舊建議未覆寫目前內容。");
      return;
    }
    setUndoDraft(structuredClone(workingDraft));
    setWorkingDraft(Object.fromEntries(workspace.stageB.continuedDraft.map((section) => [section.sectionId, section.text])));
    setAnnouncement("已將六段接續稿套用為本機工作稿；原稿仍保留，可立即復原。");
  }

  function undoWholeDraft() {
    if (!undoDraft) return;
    setWorkingDraft(undoDraft);
    setUndoDraft(null);
    setAnnouncement("已完整復原套用前的工作稿。");
  }

  function applyS0Alternative(field: S0FieldName, alternative: V2Alpha8S0Alternative) {
    if (artifactDirty) {
      setError("材料已變更；請先重新接續，再套用欄位建議。");
      return;
    }
    setS0Undo((current) => ({ ...current, [field]: workingS0[field] ?? "" }));
    setWorkingS0((current) => ({ ...current, [field]: alternative.value }));
    setAnnouncement(`已套用「${S0_FIELDS.find((item) => item.name === field)?.label}」的${alternative.strategy === "BALANCED_RECOMMENDED" ? "老麥推薦" : alternative.strategy === "EVIDENCE_CALIBRATED" ? "證據校準" : "前沿重構"}版本，可單欄復原。`);
  }

  function undoS0Alternative(field: S0FieldName) {
    const original = s0Undo[field];
    if (original === undefined) return;
    setWorkingS0((current) => ({ ...current, [field]: original }));
    setS0Undo((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
    setAnnouncement(`已復原「${S0_FIELDS.find((item) => item.name === field)?.label}」。`);
  }

  return <main className={styles.shell} data-testid="alpha8-workspace" data-hydrated="true">
    <header className={styles.header}>
      <a href="#alpha8-main" className={styles.brand}><span>老麥</span><small>Research OS · V2 Alpha8</small></a>
      <span className={styles.localBadge}>本機整合版 · 原始材料不覆寫</span>
    </header>

    <section className={styles.hero} id="alpha8-main">
      <p className={styles.eyebrow}>Continue what you already have</p>
      <h1>把半成品接成一條可完成的研究路徑</h1>
      <p>貼上你已有的摘要、前言、方法、結果或統計資料。老麥會保留原稿，整理三個研究方向、完整藍圖、分析規劃與可接續的六段工作稿。</p>
      <div className={styles.boundary}>本機版不查詢外部文獻、不寫入正式專案，也不把未驗證數值改寫成研究發現。</div>
    </section>

    <section className={styles.intake} aria-labelledby="intake-title">
      <div className={styles.sectionTitle}>
        <div><p className={styles.eyebrow}>01 · Research focus</p><h2 id="intake-title">先告訴老麥這次要完成什麼</h2></div>
        <button type="button" className={styles.exampleButton} onClick={loadExample}>載入示範半成品</button>
      </div>
      <div className={styles.focusGrid}>
        <label>本次研究重心
          <select value={domainId} onChange={(event) => updateDomain(event.target.value)}>
            {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.label}</option>)}
            <option value="CUSTOM">自訂研究領域</option>
          </select>
        </label>
        {domainId === "CUSTOM" && <label>自訂研究領域
          <input value={customDomain} maxLength={120} onChange={(event) => updateCustomDomain(event.target.value)} placeholder="例如：高齡照護中的人機協作" />
        </label>}
        <label>希望完成的成果
          <select value={goal} onChange={(event) => updateGoal(event.target.value as V2Alpha8Goal)}>
            {goals.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <small>{goals.find((item) => item.id === goal)?.detail}</small>
        </label>
        <label>目前結果狀態
          <select value={resultReadiness} onChange={(event) => updateResultReadiness(event.target.value as V2Alpha8ResultReadiness)}>
            <option value="UNCERTAIN">尚不確定或需要核對</option>
            <option value="RESULTS_NOT_AVAILABLE">尚未完成分析／沒有研究結果</option>
            <option value="OBSERVED_RESULTS_AVAILABLE">已有實際結果、表格或圖形</option>
          </select>
          <small>只有明確選擇已有實際結果，且提供結果／表圖材料，老麥才會撰寫結果敘述。</small>
        </label>
      </div>
    </section>

    <section className={styles.intake} aria-labelledby="materials-title">
      <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>02 · What you already have</p><h2 id="materials-title">有什麼就放什麼，不必先整理</h2></div><span className={styles.counter}>{filledFields.length} 類材料</span></div>
      <div className={styles.materialGrid}>
        {CORE_MATERIAL_FIELDS.map((field) => <label key={field.kind} className={styles.materialField}>
          <strong>{field.label}</strong><small>{field.hint}</small>
          <textarea data-material-kind={field.kind} rows={field.rows} maxLength={48_000} value={materialText[field.kind] ?? ""} onChange={(event) => setMaterial(field.kind, event.target.value)} />
        </label>)}
      </div>
      <details className={styles.moreMaterials}>
        <summary>更多資料、表圖、文獻與備註（選填）</summary>
        <div className={styles.materialGrid}>{OPTIONAL_MATERIAL_FIELDS.map((field) => <label key={field.kind} className={styles.materialField}>
          <strong>{field.label}</strong><small>{field.hint}</small>
          <textarea data-material-kind={field.kind} rows={field.rows} maxLength={48_000} value={materialText[field.kind] ?? ""} onChange={(event) => setMaterial(field.kind, event.target.value)} />
        </label>)}</div>
      </details>
    </section>

    <section className={styles.intake} aria-labelledby="statistics-title">
      <div className={styles.sectionTitle}>
        <div><p className={styles.eyebrow}>03 · Optional numbers</p><h2 id="statistics-title">補上你已知的統計摘要</h2></div>
        <button ref={addStatisticButton} type="button" className={styles.exampleButton} onClick={addStatistic} disabled={filledMaterialIds.length === 0}>新增一筆統計</button>
      </div>
      <p className={styles.help}>統計只會以你提供的原值進入工作稿；選擇「有衝突」或「待檢查」時，結果段落會自動鎖定為分析計畫。</p>
      {statistics.length === 0 ? <div className={styles.emptyState}>沒有統計也可以開始；老麥會先建立分析與資料需求。</div> : <div className={styles.statList}>
        {statistics.map((item, index) => <fieldset key={item.statisticId} className={styles.statRow}>
          <legend>統計摘要 {index + 1}</legend>
          <label>名稱<input ref={(element) => { statisticNameInputs.current[index] = element; }} value={item.label} onChange={(event) => updateStatistic(index, { label: event.target.value })} /></label>
          <label>數值<input value={item.value} onChange={(event) => updateStatistic(index, { value: event.target.value })} /></label>
          <label>單位<input value={item.unit} onChange={(event) => updateStatistic(index, { unit: event.target.value })} /></label>
          <label>來源材料<select value={item.sourceMaterialId} onChange={(event) => updateStatistic(index, { sourceMaterialId: event.target.value })}><option value="">請選擇</option>{filledFields.map((field) => <option key={field.kind} value={materialId(field.kind)}>{field.label}</option>)}</select></label>
          <label>一致性<select value={item.consistency} onChange={(event) => updateStatistic(index, { consistency: event.target.value as StatisticDraft["consistency"] })}><option value="CONSISTENT_REPORTED">我確認來自同一版資料</option><option value="UNCHECKED">尚待檢查</option><option value="CONFLICT_REPORTED">已知有衝突</option></select></label>
          <button type="button" aria-label={`移除統計摘要 ${index + 1}：${item.label.trim() || "尚未命名"}`} onClick={() => removeStatistic(index)}>移除</button>
        </fieldset>)}
      </div>}
      <button type="button" data-testid="alpha8-run" className={styles.primaryAction} onClick={() => void runRescue()} disabled={loading}>{loading ? "老麥正在接續研究…" : artifactDirty ? "材料已變更，重新完成研究接續" : "由老麥一次完成研究接續"}</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>

    {workspace && <section className={styles.results} data-testid="alpha8-result" data-synthetic-generation-stage-count={workspace.syntheticGenerationStageCount} data-live-provider-submission-count={workspace.liveProviderSubmissionCount} data-formal-write-count={workspace.formalResearchWriteCount}>
      <div className={styles.resultHero}>
        <div><p className={styles.eyebrow}>Research continuation ready</p><h2 tabIndex={-1} ref={resultHeading}>老麥已把材料接成完整研究路徑</h2><p>原始材料完整保留。下列內容是可繼續編修的本機工作成果，不會自動寫入正式專案。</p></div>
        <div className={workspace.status === "READY" ? styles.readyBadge : styles.gapBadge}>{workspace.status === "READY" ? "可接續完稿" : "已完成安全範圍，仍有資料缺口"}</div>
      </div>

      {artifactDirty && <div className={styles.staleNotice} data-testid="alpha8-stale" role="alert"><strong>材料已變更，這份結果已標記為過期。</strong><span>舊預覽仍保留供比較，但不允許套用；請按上方按鈕重新接續。</span></div>}

      <div className={styles.summaryGrid}>
        <article><span>材料盤點</span><strong>{workspace.materials.length}</strong><small>原稿均有內容雜湊與來源標記</small></article>
        <article><span>研究方向</span><strong>3</strong><small>平衡推薦已預選，切換不再送出請求</small></article>
        <article><span>研究藍圖</span><strong>{s0Count}/13</strong><small>每欄保留材料或假設邊界</small></article>
        <article><span>接續工作稿</span><strong>6</strong><small>{workspace.stageB.resultsNarrativeAllowed ? "六段可閱讀工作稿" : "缺資料段落維持分析計畫"}</small></article>
      </div>

      {workspace.stageB.blockedReasons.length > 0 && <div className={styles.notice} role="status"><strong>老麥沒有補造研究發現。</strong><span>{workspace.stageB.blockedReasons.map((reason) => reason === "RESULTS_MISSING_ANALYSIS_PLAN_ONLY" ? "尚未提供可用結果" : reason === "STATISTICAL_CONFLICT_REQUIRES_RESOLUTION" ? "統計值有衝突" : "統計尚待檢查").join("、")}；相關段落已改為可執行分析計畫。</span></div>}

      <section aria-labelledby="directions-title">
        <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>Direction options</p><h3 id="directions-title">三個可發展方向</h3></div><p>選擇只改變比較視角，老麥不會重新生成。</p></div>
        <div className={styles.directionGrid}>
          {workspace.stageA.directions.map((direction) => <button type="button" data-testid="alpha8-direction-card" key={direction.directionId} className={selectedDirection?.directionId === direction.directionId ? styles.directionSelected : styles.directionCard} aria-pressed={selectedDirection?.directionId === direction.directionId} onClick={() => setSelectedDirectionId(direction.directionId)}>
            <span>{laneLabel(direction.lane)}</span>{direction.recommended && <em>老麥推薦</em>}
            <strong>{direction.title}</strong><p>{direction.researchQuestion}</p><small>{direction.methodOptimization}</small>
          </button>)}
        </div>
        {selectedDirection && <article className={styles.directionDetail}><h4>{selectedDirection.title}</h4><div><section><strong>推薦理由</strong><p>{selectedDirection.rationale}</p></section><section><strong>預期貢獻</strong><p>{selectedDirection.expectedContribution}</p></section><section><strong>限制</strong><ul>{selectedDirection.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section></div></article>}
      </section>

      <section aria-labelledby="s0-title">
        <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>Research blueprint</p><h3 id="s0-title">完整研究藍圖 · {s0Count}/13</h3></div><p>已依推薦方向完成；事實、觀察、假設與缺口維持不同標記。</p></div>
        <div className={styles.s0Grid}>{S0_FIELDS.map((field) => <article key={field.name} data-s0-field={field.name}><header><strong>{field.label}</strong><span>{evidenceLabel(workspace.stageB.s0[field.name].evidenceState)}</span></header><p data-testid={`alpha8-s0-value-${field.name}`}>{workingS0[field.name] ?? workspace.stageB.s0[field.name].value}</p><small>來源：{workspace.stageB.s0[field.name].materialIds.length + workspace.stageB.s0[field.name].statisticIds.length} 項</small><details className={styles.s0Alternatives}><summary>查看老麥 3 個專業建議</summary><div>{workspace.stageB.s0Alternatives[field.name].map((alternative) => <section key={alternative.alternativeId} className={alternative.recommended ? styles.s0OptionRecommended : styles.s0Option}><header><strong>{alternative.strategy === "EVIDENCE_CALIBRATED" ? "證據校準" : alternative.strategy === "BALANCED_RECOMMENDED" ? "平衡推薦" : "前沿重構"}</strong>{alternative.recommended && <em>老麥推薦</em>}</header><p>{alternative.value}</p><small>{alternative.rationale}</small><button type="button" disabled={artifactDirty} onClick={() => applyS0Alternative(field.name, alternative)}>套用這個版本</button></section>)}</div></details>{s0Undo[field.name] !== undefined && <button type="button" className={styles.inlineUndo} onClick={() => undoS0Alternative(field.name)}>復原這一欄</button>}</article>)}</div>
      </section>

      <section aria-labelledby="analysis-title">
        <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>Analysis work packages</p><h3 id="analysis-title">可直接執行的分析工作包</h3></div><span className={styles.counter}>{workspace.stageB.analysisWorkPackages.length} 組</span></div>
        <div className={styles.workPackageGrid}>{workspace.stageB.analysisWorkPackages.map((item) => <article data-testid="alpha8-work-package" key={item.workPackageId}><span>{item.claimPolicy === "RECONCILIATION_ONLY" ? "先調和" : item.claimPolicy === "ANALYSIS_PLAN_ONLY" ? "分析規劃" : "證據盤點"}</span><h4>{item.title}</h4><p>{item.objective}</p><ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol><strong>產出</strong><p>{item.deliverables.join("、")}</p></article>)}</div>
      </section>

      <section aria-labelledby="draft-title">
        <div className={styles.sectionTitle}><div><p className={styles.eyebrow}>Continued draft</p><h3 id="draft-title">六段接續工作稿</h3></div><p>先預覽，再一次套用；原稿可完整復原。</p></div>
        <div className={styles.draftGrid}>{workspace.stageB.continuedDraft.map((section) => <article data-testid="alpha8-draft-section" data-mode={section.mode} key={section.sectionId} className={section.mode === "PLAN_ONLY" ? styles.planOnly : undefined}><header><div><span>{section.mode === "PLAN_ONLY" ? "分析計畫" : "接續草稿"}</span><h4>{SECTION_LABELS[section.sectionId]}</h4></div><em>{evidenceLabel(section.evidenceState)}</em></header><p>{section.text}</p>{section.unresolvedItems.length > 0 && <details><summary>仍需核對 {section.unresolvedItems.length} 項</summary><ul>{section.unresolvedItems.map((item) => <li key={item}>{item}</li>)}</ul></details>}</article>)}</div>
        <div className={styles.applyPanel}><div><strong>工作稿目前完成 {appliedCount}/6 段</strong><p>「套用」只更新本頁本機工作稿；材料或工作稿變更後，舊建議不會覆寫你的內容。</p></div><button type="button" data-testid="alpha8-apply-draft" disabled={artifactDirty || Boolean(undoDraft)} onClick={applyWholeDraft}>套用完整接續稿</button>{undoDraft && <button type="button" data-testid="alpha8-undo-draft" className={styles.undoButton} onClick={undoWholeDraft}>完整復原</button>}</div>
        <div className={styles.currentDraft} data-testid="alpha8-current-draft"><h4>目前本機工作稿</h4>{V2_ALPHA8_CORE_SECTION_KEYS.map((sectionId) => <label key={sectionId}>{SECTION_LABELS[sectionId]}<textarea value={workingDraft[sectionId] ?? ""} rows={sectionId === "INTRODUCTION" || sectionId === "METHODS" ? 7 : 5} onChange={(event) => setWorkingDraft((current) => ({ ...current, [sectionId]: event.target.value }))} /></label>)}</div>
      </section>

      <div className={styles.handoff}><div><strong>下一步：帶入 V2 完整論文工作區</strong><p>Alpha8 本機版已完成內容接續，但正式跨工作階段保存與線上老麥尚未啟用；因此此按鈕暫不寫入資料。</p></div><button type="button" disabled>正式交接將於整合版啟用</button></div>
    </section>}

    <div className={styles.srOnly} data-testid="alpha8-live" aria-live="polite" aria-atomic="true" role="status">{announcement}</div>
  </main>;
}

const SECTION_TO_INPUT: Record<V2Alpha8CoreSection, V2Alpha8MaterialKind> = {
  ABSTRACT: "ABSTRACT",
  INTRODUCTION: "INTRODUCTION",
  METHODS: "METHODS",
  RESULTS: "RESULTS",
  DISCUSSION: "DISCUSSION",
  CONCLUSION: "NOTE",
};

const V2_ALPHA8_CORE_SECTION_KEYS = Object.freeze(Object.keys(SECTION_LABELS) as V2Alpha8CoreSection[]);
