"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Candidate = { designKey: string; designName: string; designType: string; answersRqKeys: string[]; cannotAnswerRqKeys: string[]; causalInferenceCapability: string; sampleAndSiteRequirements: string; requiredTime: string; executionDifficulty: string; ethicsRisks: string; dataRequirements: string; methodStrengths: string[]; methodLimitations: string[]; routeFit: string; methodEvidenceCount: number; fitBreakdown: Record<string, number>; fitScore: number; fitRationale: string; selectionStatus: string; selectionReason: string | null };
type DesignFinding = { severity: string; code: string; chain: string; description: string; suggestion: string };
type DesignData = {
  ok: boolean; exists?: boolean; locked?: boolean; theoryLocked?: boolean; missingResearchProject?: boolean; error?: string;
  analysis?: { id: string; status: string; currentVersion: number; versionLabel: string; primaryRoute: string | null; updatedAt: string; gateState: Record<string, unknown> };
  sections?: Record<string, unknown>;
  candidates?: Candidate[];
  designEvidenceLinks?: Record<string, unknown>[];
  alignment?: { checkedAt?: string | null; findings: DesignFinding[] } | null;
  gatePreview?: { total: number; passed: number; failed: { key: string; label: string; detail: string }[] };
  missingPrerequisites?: { key: string; label: string; affects: string }[];
  missingInputs?: { key: string; label: string; affects: string }[];
  sourceInfo?: { blueprintVersion: number; theoryStatus: string; primaryRoute: string; projectTitle: string };
  versions?: { id: string; versionNumber: number; versionLabel: string; reason: string; createdAt: string }[];
};

const TABS = ["總覽", "設計候選方案", "研究對象與樣本", "組別與介入", "時點與流程", "測量需求", "RQ–Data–Analysis Matrix", "分析計畫", "Validity與Bias", "方法Evidence", "Route Alignment", "版本與修訂"];
const TAB_SECTIONS: Record<string, string[]> = {
  "研究對象與樣本": ["population_plan", "sampling_plan"],
  "組別與介入": ["study_arms", "allocation", "intervention_spec"],
  "時點與流程": ["time_points", "study_identity"],
  "測量需求": ["measurement_requirements"],
  "RQ–Data–Analysis Matrix": ["rq_data_analysis_matrix"],
  "分析計畫": ["analysis_plans", "analysis_plan_amendments"],
  "Validity與Bias": ["validity_bias_items"],
  "總覽": ["selected_design", "unresolved_design_issues"],
  "設計候選方案": [], "方法Evidence": [], "Route Alignment": [], "版本與修訂": [],
};
const FIELD_LABELS: Record<string, string> = {
  designKey: "設計 Key", designName: "設計名稱", reason: "選擇理由", alternatives: "替代方案", notRecommended: "不建議方案", limitations: "主要限制", mustStrengthen: "必須補強項目",
  studyType: "研究類型", unitOfAnalysis: "分析單位", researchSetting: "研究場域", numberOfSites: "場域數", studyDuration: "研究期間", confirmatoryOrExploratory: "確認性/探索性", primaryRoute: "主要路線",
  targetPopulation: "目標群體", accessiblePopulation: "可及群體", samplingFrame: "抽樣框架", inclusionCriteria: "納入條件", exclusionCriteria: "排除條件", recruitmentSource: "招募來源", recruitmentMethod: "招募方法", representativenessRisk: "代表性風險",
  samplingMethod: "抽樣方法", numberOfGroups: "組數", primaryOutcome: "主要結果", statisticalModel: "統計模型", expectedEffectSize: "預期效果量", effectSizeSource: "效果量來源", alpha: "Alpha", statisticalPower: "統計檢定力", repeatedMeasuresCorrelation: "重複測量相關", designEffect: "設計效應", attritionAssumption: "流失率假設", minimumRequiredN: "最小所需樣本", recruitmentTargetN: "招募目標樣本", powerStatus: "Power 狀態",
  _items: "內容（JSON 陣列；每項一個物件）",
};

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function row(value: unknown): Record<string, unknown> { return record(value) ? value : {}; }

const DESIGN_ACTIONS: { status: string; label: string }[] = [
  { status: "RECOMMENDED", label: "設為推薦" }, { status: "ALTERNATIVE", label: "替代方案" }, { status: "NOT_RECOMMENDED", label: "不建議" }, { status: "SELECTED", label: "選定此設計" }, { status: "REJECTED", label: "拒絕" },
];

export default function ResearchDesignLab({ projectId, onOpenEvidence, onOpenBlueprint, onOpenRouteWorkspace }: {
  projectId: string; onOpenEvidence?: (role: string) => void; onOpenBlueprint?: () => void; onOpenRouteWorkspace?: () => void;
}) {
  const [data, setData] = useState<DesignData | null>(null);
  const [tab, setTab] = useState("總覽");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editPicker, setEditPicker] = useState<string[] | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [compare, setCompare] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [compareResult, setCompareResult] = useState<string[] | null>(null);
  const [selReason, setSelReason] = useState<Record<string, string>>({});
  const [linkForm, setLinkForm] = useState<{ targetType: string; targetRef: string; literatureId: string; sourceLocation: string; readingStatus: string; verificationStatus: string }>({ targetType: "DESIGN", targetRef: "", literatureId: "", sourceLocation: "", readingStatus: "FULLTEXT_REVIEWED", verificationStatus: "VERIFIED" });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutosave = useRef(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/research-design`, { cache: "no-store" });
      const json = await response.json() as DesignData;
      if (!response.ok || !json.ok) throw new Error(json.error || "無法載入研究設計實驗室。");
      setData(json);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "無法載入研究設計實驗室。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!editSection || skipAutosave.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void act("edit", { edit: { section: editSection, payload: parseEditForm(editForm), reason: "自動儲存（未完成作業）" } }); }, 2500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm, editSection]);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setError(""); setNotice(""); setBusy(action);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/research-design`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const json = await response.json() as { ok?: boolean; error?: string; status?: string; failed?: { key: string; label: string; detail: string }[]; findings?: DesignFinding[]; linked?: number; count?: number; changedSections?: string[]; checkedAt?: string; versionNumber?: number };
      if (action === "lock" && !json.ok && Array.isArray(json.failed) && json.failed.length > 0) {
        setError(`研究設計核准 Gate 未通過（${json.failed.length} 項）：${json.failed.map((f) => f.label).slice(0, 3).join("、")}…。請依「核准檢查」補齊。`);
      } else if (!response.ok || !json.ok) {
        throw new Error(`${json.error || "操作失敗。"}`);
      }
      if (action === "draft") setNotice(`研究設計候選方案已建立（${json.count ?? 0} 個；分數為內部比較工具，不代表研究一定成功）。`);
      if (action === "alignment") setNotice(`Design Alignment Check 完成：${(json.findings ?? []).filter((f) => f.severity === "MAJOR_DESIGN_GAP").length} 個 MAJOR 斷鏈。`);
      if (action === "writeback") setNotice(`Research Blueprint v3 Design-Locked 已回寫（版本 ${json.versionNumber ?? ""}，不覆蓋 v1/v2/v3）。`);
      if (action === "lock" && json.ok) setNotice("🎉 RESEARCH_DESIGN_AND_ANALYSIS_PLAN_APPROVED — 研究設計與分析計畫已核准。");
      if (action === "link-evidence") setNotice(`設計證據已連結（${json.linked ?? 0} 筆，僅 ID 關聯既有文獻）。`);
      if (action === "compare" && json.changedSections) setCompareResult(json.changedSections);
      if (action !== "compare") { setEditSection(null); setEditPicker(null); setCompareResult(null); }
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); }
    finally { setBusy(""); }
  }

  if (loading) return <section className="v13-panel-stack"><div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">研究設計實驗室</p><h2>研究設計</h2></div></div><p className="v13-muted" role="status">載入中…</p></div></section>;

  if (!data?.exists) {
    return (
      <section className="v13-panel-stack" data-testid="research-design-lab">
        <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">研究設計實驗室</p><h2>研究設計</h2></div><p className="v13-panel-note">將已鎖定的理論、機制、構念與假設，轉換為可執行的研究設計與分析計畫（Planning Mode）。</p></div>
          {error && <p className="v13-error" role="alert">{error}</p>}
          <div className="v13-empty"><strong>尚無研究設計資料</strong><p>需先完成研究藍圖與理論機制鎖定。此處會自動讀取既有藍圖、理論模型與文獻證據，不會要求重複輸入。</p></div>
        </div>
      </section>
    );
  }

  if (data.locked) {
    return (
      <section className="v13-panel-stack" data-testid="research-design-lab">
        <div className="v13-panel">
          <div className="v13-panel-head"><div><p className="section-kicker">研究設計實驗室</p><h2>研究設計</h2></div></div>
          {error && <p className="v13-error" role="alert">{error}</p>}
          <div className="v13-empty"><strong>RESEARCH_DESIGN_LAB_LOCKED</strong><p>需先通過 THEORY_AND_MECHANISM_LOCKED 才能進入本階段。</p>{(data.missingPrerequisites ?? []).length > 0 && <ul style={{ textAlign: "left", margin: "8px auto", maxWidth: 420 }}>{data.missingPrerequisites?.map((m) => <li key={m.key}><strong>{m.label}</strong>：{m.affects}</li>)}</ul>}<div className="research-actions" style={{ marginTop: 10 }}>{onOpenBlueprint && <button type="button" className="secondary-button" onClick={onOpenBlueprint}>前往研究藍圖</button>}</div></div>
        </div>
      </section>
    );
  }

  const s = data.sections ?? {};
  const sections = s;
  const sampling = row(sections.sampling_plan);
  const gatePreview = data.gatePreview;
  const allGatesPass = gatePreview ? gatePreview.passed === gatePreview.total : false;

  function parseEditForm(form: Record<string, string>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      if (value.trim().startsWith("[") || value.trim().startsWith("{")) { try { payload[key] = JSON.parse(value); } catch { payload[key] = value; } }
      else payload[key] = value;
    }
    return payload;
  }

  function openEdit(section: string) {
    const current = sections[section];
    const flat: Record<string, string> = {};
    if (Array.isArray(current)) {
      flat._items = JSON.stringify(current);
    } else if (record(current)) {
      for (const [key, value] of Object.entries(current)) {
        if (key.startsWith("_")) continue;
        flat[key] = typeof value === "string" ? value : Array.isArray(value) || record(value) ? JSON.stringify(value) : String(value ?? "");
      }
    }
    skipAutosave.current = true;
    setEditSection(section); setEditForm(flat); setEditPicker(null);
    setTimeout(() => { skipAutosave.current = false; }, 50);
  }

  function startEditFromTab(tabName: string) {
    const targetSections = TAB_SECTIONS[tabName] ?? [];
    if (targetSections.length === 0) return;
    if (targetSections.length === 1) { openEdit(targetSections[0]); return; }
    setEditPicker(targetSections);
  }

  async function saveEdit() {
    if (!editSection) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await act("edit", { edit: { section: editSection, payload: parseEditForm(editForm), reason: "手動編輯" } });
  }

  function renderValue(value: unknown, depth = 0): React.ReactNode {
    if (value === null || value === undefined || value === "") return <span className="v13-muted">MISSING</span>;
    if (typeof value === "string") return <span>{value}</span>;
    if (Array.isArray(value)) return <ul style={{ margin: 0, paddingLeft: 18 }}>{value.map((item, i) => <li key={i}>{renderValue(item, depth + 1)}</li>)}</ul>;
    if (record(value)) return <dl className="v13-details">{Object.entries(value).filter(([k]) => !k.startsWith("_")).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{renderValue(v, depth + 1)}</dd></div>)}</dl>;
    return <span>{String(value)}</span>;
  }

  return (
    <section className="v13-panel-stack" data-testid="research-design-lab">
      <div className="v13-panel">
        <div className="v13-panel-head">
          <div><p className="section-kicker">RESEARCH DESIGN LAB · 研究設計</p><h2>{data.sourceInfo?.projectTitle || "研究設計"}</h2></div>
          <p className="v13-panel-note">Status <strong>{data.analysis?.status}</strong> ｜ Blueprint v{data.sourceInfo?.blueprintVersion} ｜ Theory：{data.sourceInfo?.theoryStatus} ｜ Route：{data.sourceInfo?.primaryRoute} ｜ 設計版本：{data.analysis?.currentVersion}（{data.analysis?.versionLabel}）</p>
        </div>
        {error && <p className="v13-error" role="alert">{error}</p>}
        {notice && <p className="v13-notice" role="status">{notice}</p>}
        {data.analysis?.status === "OUTDATED" && <p className="v13-error" role="alert">研究設計已標示 OUTDATED：重大來源（Gap／RQ／理論／Route）已變更。請重新執行「根據RQ產生設計候選」與 Design Alignment Check 後再核准。</p>}

        {(data.missingInputs ?? []).length > 0 && (
          <div className="v13-panel" style={{ marginTop: 10, border: "1px solid #b45309" }}>
            <div className="v13-panel-head"><div><p className="section-kicker">MISSING INPUTS · 缺少輸入</p><h3>以下資料缺少，會影響對應設計判斷</h3></div></div>
            <ul>{data.missingInputs?.map((m) => <li key={m.key}><strong>{m.label}</strong>：{m.affects}</li>)}</ul>
          </div>
        )}

        {gatePreview && (
          <div className="v13-panel" style={{ marginTop: 10, border: allGatesPass ? "1px solid var(--v13-border,#333)" : "1px solid #b45309", background: allGatesPass ? undefined : "rgba(180,83,9,0.07)" }} data-testid="design-gate-preview">
            <div className="v13-panel-head"><div><p className="section-kicker">RESEARCH DESIGN GATE · 核准檢查</p><h3>核准 Gate：{gatePreview.passed} / {gatePreview.total} 通過</h3></div>{allGatesPass ? <p className="v13-notice">全部通過，可「回寫研究藍圖 v3」並「核准研究設計」。</p> : <p className="v13-muted">以下未通過（核准前需補齊）：</p>}</div>
            {!allGatesPass && <div style={{ display: "grid", gap: 8, marginTop: 6 }}>{gatePreview.failed.map((f) => <div key={f.key} style={{ border: "1px solid var(--v13-border,#333)", borderRadius: 8, padding: "6px 10px" }}><p style={{ margin: 0 }}><strong>✗ {f.label}</strong> <small className="v13-muted">（{f.key}）</small></p><p className="v13-muted" style={{ margin: "4px 0" }}>{f.detail}</p></div>)}</div>}
          </div>
        )}

        <div className="v13-actions" style={{ flexWrap: "wrap", marginTop: 10 }}>
          {TABS.map((t) => <button key={t} type="button" className={tab === t ? "primary-button" : "secondary-button"} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        {tab === "總覽" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Selected Design</h3>
            {renderValue(sections.selected_design)}
            <h3 style={{ margin: "14px 0 8px" }}>Sampling Plan（Power 狀態：{text(sampling.powerStatus) || "NOT_STARTED"}）</h3>
            {renderValue(sections.sampling_plan)}
            <h3 style={{ margin: "14px 0 8px" }}>未解決設計議題</h3>
            {renderValue(sections.unresolved_design_issues)}
          </>
        )}

        {tab === "設計候選方案" && (
          <>
            <div className="v13-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="primary-button" disabled={busy === "draft"} onClick={() => void act("draft")}>{busy === "draft" ? "建立中…" : "根據RQ產生設計候選"}</button>
              {onOpenEvidence && <button type="button" className="secondary-button" onClick={() => onOpenEvidence("METHOD")}>補充方法文獻 →</button>}
            </div>
            <p className="v13-muted" style={{ marginTop: 8 }}>候選方案由 RQ／機制／方法方向推導；不虛構方法。{text(sections.fit_disclaimer)}</p>
            {(data.candidates ?? []).length === 0 ? <div className="v13-empty"><strong>尚未建立設計候選方案</strong><p>按「根據RQ產生設計候選」。</p></div> : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {(data.candidates ?? []).map((c) => (
                  <div key={c.designKey} className="v13-panel" style={{ padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>{c.designName}</strong><span className="v13-badge">{c.selectionStatus} · Fit {c.fitScore}/100</span></div>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>{c.designType} ｜ 因果能力：{c.causalInferenceCapability}</p>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>能回答：{c.answersRqKeys.join("、") || "—"} ｜ 無法回答：{c.cannotAnswerRqKeys.join("、") || "—"}</p>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>樣本/場域：{c.sampleAndSiteRequirements} ｜ 時間：{c.requiredTime} ｜ 難度：{c.executionDifficulty} ｜ 倫理：{c.ethicsRisks}</p>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>優勢：{c.methodStrengths.join("；")} ｜ 限制：{c.methodLimitations.join("；")} ｜ 路線適配：{c.routeFit}</p>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>方法文獻 {c.methodEvidenceCount} 筆 ｜ 權重分項：{Object.entries(c.fitBreakdown).map(([k, v]) => `${k}=${v}`).join(" ｜ ")}（{text(sections.fit_disclaimer)}）</p>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>{c.fitRationale}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {DESIGN_ACTIONS.map((a) => <button key={a.status} type="button" disabled={busy === "select"} className={c.selectionStatus === a.status ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => void act("select-design", { selection: { designKey: c.designKey, selectionStatus: a.status, reason: selReason[c.designKey] } })}>{a.label}{c.selectionStatus === a.status ? " ✓" : ""}</button>)}
                    </div>
                    <label className="research-field" style={{ marginTop: 6 }}>選擇理由／備註<input value={selReason[c.designKey] ?? ""} onChange={(e) => setSelReason({ ...selReason, [c.designKey]: e.target.value })} placeholder="為何選／為何不選（供 Alignment 追溯）" /></label>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "研究對象與樣本" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Population & Sample Planning（效果量不得自行猜測；需來自文獻/最相近研究）</h3>
            {renderValue(sections.population_plan)}
            {renderValue(sections.sampling_plan)}
            {!["CALCULATED", "VERIFIED"].includes(text(sampling.powerStatus)) && <p className="v13-notice" style={{ marginTop: 8 }}>Power Analysis 狀態：{text(sampling.powerStatus) || "NOT_STARTED"}。需先提供效果量來源（Meta-analysis／Closest Study／Pilot／Prior Research／明確假設）才能計算樣本數。</p>}
          </>
        )}

        {tab === "組別與介入" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Study Arms</h3>
            {renderValue(sections.study_arms)}
            <h3 style={{ margin: "14px 0 8px" }}>Allocation（不適用時標 NOT_APPLICABLE）</h3>
            {renderValue(sections.allocation)}
            <h3 style={{ margin: "14px 0 8px" }}>Intervention Specification（詳細操作步驟留待 Protocol 階段）</h3>
            {renderValue(sections.intervention_spec)}
          </>
        )}

        {tab === "時點與流程" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Time Points（每個時點需對應 Measure／Outcome／RQ／負擔）</h3>
            {renderValue(sections.time_points)}
            <h3 style={{ margin: "14px 0 8px" }}>Study Identity</h3>
            {renderValue(sections.study_identity)}
          </>
        )}

        {tab === "測量需求" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Measurement Requirements（本階段只定義「需要測量什麼」，正式量表留待研究工具階段）</h3>
            {renderValue(sections.measurement_requirements)}
          </>
        )}

        {tab === "RQ–Data–Analysis Matrix" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>RQ–Data–Analysis Matrix（Gap→Theory→Mechanism→Variable→Data→Analysis 全鏈可追溯）</h3>
            {renderValue(sections.rq_data_analysis_matrix)}
          </>
        )}

        {tab === "分析計畫" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Analysis Plan（Planning Mode；Execution 需待正式資料治理後啟動）</h3>
            {renderValue(sections.analysis_plans)}
            <h3 style={{ margin: "14px 0 8px" }}>Amendments（正式資料收集後修改必須建立 Amendment，不覆蓋原計畫）</h3>
            {renderValue(sections.analysis_plan_amendments)}
          </>
        )}

        {tab === "Validity與Bias" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Validity & Bias Register</h3>
            {renderValue(sections.validity_bias_items)}
          </>
        )}

        {tab === "方法Evidence" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Design Evidence Links（僅 ID 關聯既有文獻／CitationSource／Zotero，不另建文獻庫）</h3>
            <div className="v13-panel" style={{ marginTop: 6, padding: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 8 }}>
                <label className="research-field">目標類型<select value={linkForm.targetType} onChange={(e) => setLinkForm({ ...linkForm, targetType: e.target.value })}>{["DESIGN", "SAMPLING", "POWER", "MEASUREMENT", "ANALYSIS", "EFFECT_SIZE"].map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
                <label className="research-field">目標 Ref（如 designKey／constructId／RQ1）<input value={linkForm.targetRef} onChange={(e) => setLinkForm({ ...linkForm, targetRef: e.target.value })} /></label>
                <label className="research-field">既有 literature_id<input value={linkForm.literatureId} onChange={(e) => setLinkForm({ ...linkForm, literatureId: e.target.value })} placeholder="自文獻與證據中心取得" /></label>
                <label className="research-field">Source Location<input value={linkForm.sourceLocation} onChange={(e) => setLinkForm({ ...linkForm, sourceLocation: e.target.value })} /></label>
                <label className="research-field">閱讀狀態<select value={linkForm.readingStatus} onChange={(e) => setLinkForm({ ...linkForm, readingStatus: e.target.value })}><option value="FULLTEXT_REVIEWED">FULLTEXT_REVIEWED</option><option value="ABSTRACT_REVIEWED">ABSTRACT_REVIEWED</option></select></label>
                <label className="research-field">驗證狀態<select value={linkForm.verificationStatus} onChange={(e) => setLinkForm({ ...linkForm, verificationStatus: e.target.value })}>{["VERIFIED", "SUPPORTED", "INFERRED", "UNVERIFIED"].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
              </div>
              <div className="research-actions" style={{ marginTop: 8 }}>
                <button type="button" className="primary-button" disabled={busy === "link-evidence" || !linkForm.targetRef || !linkForm.literatureId} onClick={() => void act("link-evidence", { links: [{ ...linkForm, literatureId: linkForm.literatureId.trim() }] })}>連結文獻（確認屬實才標已驗證）</button>
                {onOpenEvidence && <button type="button" className="secondary-button" onClick={() => onOpenEvidence("METHOD")}>前往文獻與證據中心（METHOD）→</button>}
              </div>
            </div>
            {list(data.designEvidenceLinks).length === 0 ? <p className="v13-muted" style={{ marginTop: 8 }}>尚無設計證據連結。</p> : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{list(data.designEvidenceLinks).map((l, i) => { const r = row(l); return <div key={i} style={{ border: "1px solid var(--v13-border,#333)", borderRadius: 8, padding: "6px 10px" }}><p style={{ margin: 0 }}><strong>[{text(r.targetType)}] {text(r.targetRef)}</strong> <small className="v13-muted">{text(r.readingStatus)} / {text(r.verificationStatus)}</small></p><p className="v13-muted" style={{ margin: "4px 0" }}>literature_id: {text(r.literatureId) || "—"} ｜ Zotero: {text(r.zoteroItemKey) || "—"} ｜ CitationSource: {text(r.citationSourceId) || "—"}</p></div>; })}</div>}
          </>
        )}

        {tab === "Route Alignment" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Route Alignment（依投稿/申請路線檢查方法與產出）</h3>
            <div className="v13-list">
              <p><b>目前路線</b><span>{data.sourceInfo?.primaryRoute ?? "GENERAL"}</span></p>
              <p><b>JOURNAL</b><span>檢查方法嚴謹度、目標期刊方法契合、報告指引、樣本層級、理論貢獻。</span></p>
              <p><b>NSTC</b><span>檢查科學問題與方法一致、多年期工作包、里程碑、團隊設備、經費合理性。</span></p>
              <p><b>教學實踐</b><span>檢查 Teaching Problem→Intervention→Learning Mechanism→Student Learning Outcome→Assessment；不得只測滿意度/接受度/使用意願。</span></p>
            </div>
          </>
        )}

        {tab === "版本與修訂" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Research Design Versions（append-only，不覆蓋舊版）</h3>
            <div className="v13-table-wrap"><table><thead><tr><th>Version</th><th>Label</th><th>Reason</th><th>Created</th></tr></thead><tbody>{(data.versions ?? []).map((v) => <tr key={v.id}><td>{v.versionNumber}</td><td>{v.versionLabel}</td><td>{v.reason}</td><td>{v.createdAt.slice(0, 19).replace("T", " ")}</td></tr>)}</tbody></table></div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <label className="research-field">從版本<input style={{ width: 80 }} value={compare.from} onChange={(e) => setCompare({ ...compare, from: e.target.value })} placeholder="1" /></label>
              <label className="research-field">到版本<input style={{ width: 80 }} value={compare.to} onChange={(e) => setCompare({ ...compare, to: e.target.value })} placeholder="2" /></label>
              <button type="button" className="secondary-button" disabled={busy === "compare" || !compare.from || !compare.to} onClick={() => void act("compare", { fromVersion: Number(compare.from), toVersion: Number(compare.to) })}>比較版本</button>
            </div>
            {compareResult && <div style={{ marginTop: 8 }}><strong>變更區塊：</strong>{compareResult.length ? compareResult.join("、") : "無變更"}</div>}
          </>
        )}

        <div className="research-actions" style={{ marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" className="secondary-button" disabled={busy !== "" || (TAB_SECTIONS[tab] ?? []).length === 0} onClick={() => startEditFromTab(tab)}>手動編輯本區塊</button>
          <button type="button" className="secondary-button" disabled={busy === "alignment"} onClick={() => void act("alignment")}>執行 Design Alignment Check</button>
          <button type="button" className="primary-button" disabled={busy === "writeback"} onClick={() => void act("writeback")}>回寫研究藍圖（v3 Design-Locked）</button>
          <button type="button" className="primary-button" disabled={busy === "lock"} onClick={() => void act("lock")}>核准研究設計</button>{allGatesPass && onOpenRouteWorkspace && <button type="button" className="primary-button" style={{ background: "linear-gradient(90deg,#0f7a3d,#22a35a)" }} onClick={onOpenRouteWorkspace}>核准後 · 前往研究路線工作室 →</button>}
          {onOpenBlueprint && <button type="button" className="secondary-button" onClick={onOpenBlueprint}>前往研究藍圖</button>}
          <button type="button" className="secondary-button" onClick={() => void load()}>重新整理</button>
        </div>
        {busy === "lock" && <p className="v13-muted">核准前將執行 15 項 Gate 檢查；通過後建立 RESEARCH_DESIGN_AND_ANALYSIS_PLAN_RELEASE Human Gate。</p>}

        {editPicker && editPicker.length > 0 && !editSection && (
          <div className="v13-panel" style={{ marginTop: 10 }}>
            <div className="v13-panel-head"><div><p className="section-kicker">MANUAL EDIT · 手動編輯</p><h3>選擇要編輯的區塊</h3></div></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {editPicker.map((sectionName) => <button key={sectionName} type="button" className="secondary-button" onClick={() => openEdit(sectionName)}>{sectionName}</button>)}
              <button type="button" className="text-button" onClick={() => setEditPicker(null)}>取消</button>
            </div>
          </div>
        )}

        {editSection && (
          <div className="v13-panel" style={{ marginTop: 10 }}>
            <div className="v13-panel-head"><div><p className="section-kicker">MANUAL EDIT · 手動編輯</p><h3>區塊：{editSection}</h3></div><p className="v13-panel-note">編輯會建立新版本；不覆蓋其他已確認區塊。陣列區塊以 JSON 編輯（每項一個物件）。</p></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10 }}>
              {Object.entries(editForm).filter(([key]) => key === "_items" || !key.startsWith("_")).map(([key, value]) => <label key={key} className="research-field">{FIELD_LABELS[key] ?? key}<textarea rows={key === "_items" ? 8 : 4} value={value} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} /></label>)}
            </div>
            <div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="primary-button" disabled={busy === "edit"} onClick={() => void saveEdit()}>儲存（建立新版本）</button><button type="button" className="secondary-button" onClick={() => { setEditSection(null); setEditPicker(null); }}>取消</button></div>
          </div>
        )}
      </div>
    </section>
  );
}
