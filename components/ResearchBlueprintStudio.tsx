"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CoverageEntry = { status: string; count: number };
type GateFix = {
  kind: "edit" | "module";
  tab?: string;
  section?: string;
  fields?: string[];
  module?: "navigator" | "evidence";
  role?: string;
  note: string;
  autoFill?: { section: string; payload: Record<string, unknown>; label: string; provisional: boolean };
};
type GateGuide = { key: string; label: string; pass: boolean; detail: string; fix?: GateFix };
type BlueprintData = {
  ok: boolean; exists?: boolean; error?: string;
  blueprint?: { id: string; status: string; primaryRoute: string | null; secondaryRoute: string | null; currentVersion: number; versionLabel: string; evidenceReadiness: string; updatedAt: string; gateState: Record<string, unknown> };
  sections?: Record<string, unknown>;
  logicFindings?: { severity: string; chain: string; description: string; suggestion: string }[];
  coverage?: Record<string, CoverageEntry>;
  gatePreview?: { checkedAt?: string; total: number; passed: number; failed: GateGuide[] };
  versions?: { id: string; versionNumber: number; versionLabel: string; reason: string; createdAt: string }[];
  nextBestAction?: { action: string; reason: string };
  outdatedReason?: string | null;
};

const TABS = ["總覽", "問題與Gap", "目的與RQ", "假設與變數", "初步架構", "工作與時程", "預期成果", "Evidence Coverage", "風險", "版本"];
const TAB_SECTIONS: Record<string, string[]> = {
  "總覽": ["identity"],
  "問題與Gap": ["core_problem", "gaps"],
  "目的與RQ": ["purpose", "objectives", "questions"],
  "假設與變數": ["hypotheses", "variables"],
  "初步架構": ["conceptual_logic", "population_context", "method"],
  "工作與時程": ["workpackages", "milestones"],
  "預期成果": ["contributions", "outputs"],
  "風險": ["risks"],
  "Evidence Coverage": [],
  "版本": [],
};
const COVERAGE_LABELS: Record<string, string> = { PROBLEM_IMPORTANCE: "Problem Importance", GAP: "Gap", THEORY: "Theory", METHOD: "Method", MEASUREMENT: "Measurement", SIMILAR_STUDY: "Similar Study", CONTRIBUTION: "Contribution", TEACHING_PROBLEM: "Teaching Problem" };
const GAP_TYPES = ["Theoretical", "Empirical", "Methodological", "Population", "Context", "Technology", "Implementation"];
const FIELD_LABELS: Record<string, string> = {
  chineseTitle: "中文題目", englishTitle: "英文題目", projectType: "專案類型", primaryRoute: "主要路線", secondaryRoute: "次要路線", targetLabel: "目標（期刊／計畫）", currentStage: "目前階段", researcherFit: "研究者契合",
  realProblem: "真實問題", populationSite: "場域", importance: "重要性", whyCurrentInsufficient: "現況不足之處", teachingProblem: "教學問題",
  statement: "陳述", direction: "方法方向", rationale: "方法理由", status: "狀態",
  primary: "主要貢獻", types: "貢獻類型",
  targetPopulation: "目標對象", inclusion: "納入條件", researchContext: "研究脈絡", researchSite: "研究場域", availableSample: "可用樣本", accessStatus: "取用狀態", recruitmentRisk: "招募風險",
  theory: "理論", chain: "邏輯鏈", expectedData: "資料規劃（expected_data）", proposedAnalysis: "分析方法（proposed_analysis）", objectiveKey: "Objective 連結", rqKey: "RQ 編號",
  _items: "內容（JSON 陣列；每項一個物件）",
};

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function row(value: unknown): Record<string, unknown> { return record(value) ? value : {}; }

export default function ResearchBlueprintStudio({ projectId, onNavigate, onOpenEvidence }: {
  projectId: string; onNavigate?: (navId: string) => void; onOpenEvidence?: (role: string) => void;
}) {
  const [data, setData] = useState<BlueprintData | null>(null);
  const [tab, setTab] = useState("總覽");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editPicker, setEditPicker] = useState<string[] | null>(null);
  const [editMeta, setEditMeta] = useState<{ label: string; provisional: boolean } | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutosave = useRef(false);
  const [compare, setCompare] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [compareResult, setCompareResult] = useState<string[] | null>(null);
  const [recoverError, setRecoverError] = useState("");

  async function recoverResearchProject() {
    setRecoverError(""); setBusy("research");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/research-project`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "建立失敗。");
      await load();
    } catch (caught) { setRecoverError(caught instanceof Error ? caught.message : "建立失敗。"); }
    finally { setBusy(""); }
  }

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/blueprint`, { cache: "no-store" });
      const json = await response.json() as BlueprintData;
      if (!response.ok || !json.ok) throw new Error(json.error || "無法載入研究藍圖。");
      setData(json);
      if (json.outdatedReason) setNotice(json.outdatedReason);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "無法載入研究藍圖。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  // autosave 必須在所有 early return 之前（hooks 順序固定，否則 React #310）
  useEffect(() => {
    if (!editSection || skipAutosave.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void act("edit", { edit: { section: editSection, payload: parseEditForm(editForm), reason: "自動儲存（未完成作業）" } });
    }, 2500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm, editSection]);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setError(""); setNotice(""); setBusy(action);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/blueprint`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const json = await response.json() as { ok?: boolean; error?: string; code?: string; status?: string; findings?: unknown[]; failed?: { key: string; label: string; detail: string }[]; changedSections?: string[] };
      // 核准失敗：顯示 Gate 未通過明細；下方「核准 Gate 檢查」面板會顯示每項的修改指引
      if (action === "approve" && !json.ok && Array.isArray(json.failed) && json.failed.length > 0) {
        const labels = json.failed.map((f) => f.label).slice(0, 3);
        setError(`藍圖核准 Gate 未通過（${json.failed.length} 項）：${labels.join("、")}…。請依下方「核准 Gate 檢查」的修改指引補齊後再核准。`);
      } else if (!response.ok || !json.ok) {
        throw new Error(`${json.error || "操作失敗。"}${json.code ? `（${json.code}）` : ""}`);
      }
      if (action === "approve" && json.ok) setNotice(json.status === "APPROVED" ? "RESEARCH BLUEPRINT APPROVED — 可進入下一階段（Conceptual Framework + Research Design）。" : "藍圖仍需修訂。");
      if (action === "verify" && json.findings) setNotice(`老麥檢查完成：${(json.findings as unknown[]).length} 項邏輯發現。`);
      if (action === "compare" && json.changedSections) setCompareResult(json.changedSections);
      if (action !== "compare") { setEditSection(null); setEditPicker(null); setEditMeta(null); setCompareResult(null); }
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); }
    finally { setBusy(""); }
  }

  if (loading) return <section className="v13-panel-stack"><div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">研究藍圖</p><h2>研究藍圖</h2></div></div><p className="v13-muted" role="status">載入中…</p></div></section>;

  if (!data?.exists || !data.blueprint) {
    return (
      <section className="v13-panel-stack" data-testid="research-blueprint-studio">
        <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">研究藍圖</p><h2>研究藍圖</h2></div><p className="v13-panel-note">根據已確認題目、投稿路線與本專案文獻，建立一份可編輯、可版本化、可核准的研究總計畫。</p></div>
          {error && <p className="v13-error" role="alert">{error}</p>}
          <div className="v13-empty"><strong>尚未建立研究藍圖</strong><p>系統會自動繼承選題與投稿導航資料；缺少的資料標示 MISSING／PROVISIONAL，不會虛構。若系統要求先建立研究專案，請先到投稿導航完成分析並按「建立研究專案」。</p><div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="primary-button" disabled={busy === "draft"} onClick={() => void act("draft")}>{busy === "draft" ? "建立中…" : "根據目前資料建立初稿"}</button>{onNavigate && <button type="button" className="secondary-button" onClick={() => onNavigate("navigator")}>前往投稿導航建立研究專案 →</button>}<button type="button" className="secondary-button" disabled={busy === "research"} onClick={() => void recoverResearchProject()}>{busy === "research" ? "建立中…" : "直接建立研究專案資料（不依賴導航）"}</button></div>{recoverError && <p className="v13-error" role="alert" style={{ marginTop: 8 }}>{recoverError}</p>}</div>
        </div>
      </section>
    );
  }

  const b = data.blueprint;
  const s = data.sections ?? {};
  const sections = s;

  function renderSectionValue(value: unknown, depth = 0): React.ReactNode {
    if (value === null || value === undefined || value === "") return <span className="v13-muted">MISSING</span>;
    if (typeof value === "string") return <span>{value}</span>;
    if (Array.isArray(value)) return <ul style={{ margin: 0, paddingLeft: 18 }}>{value.map((item, i) => <li key={i}>{renderSectionValue(item, depth + 1)}</li>)}</ul>;
    if (record(value)) return <dl className="v13-details">{Object.entries(value).filter(([k]) => !k.startsWith("_")).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{renderSectionValue(v, depth + 1)}</dd></div>)}</dl>;
    return <span>{String(value)}</span>;
  }

  function parseEditForm(form: Record<string, string>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      if (value.trim().startsWith("[") || value.trim().startsWith("{")) { try { payload[key] = JSON.parse(value); } catch { payload[key] = value; } }
      else payload[key] = value;
    }
    return payload;
  }

  function openEdit(section: string, prefill?: { payload: Record<string, unknown>; label: string; provisional: boolean }) {
    // 直接使用原始值（不可經 row()——它會把陣列轉成 {}，導致陣列區塊永遠空表單）
    const current = sections[section];
    const flat: Record<string, string> = {};
    if (Array.isArray(current)) {
      // 陣列型區塊：以單一 JSON 欄位編輯（_items），儲存時整筆取代
      flat._items = JSON.stringify(current);
    } else if (record(current)) {
      for (const [key, value] of Object.entries(current)) {
        if (key.startsWith("_")) continue;
        flat[key] = typeof value === "string" ? value : Array.isArray(value) ? JSON.stringify(value) : record(value) ? JSON.stringify(value) : String(value ?? "");
      }
    }
    if (prefill) {
      for (const [key, value] of Object.entries(prefill.payload)) {
        if (key.startsWith("_") && key !== "_items") continue;
        flat[key] = typeof value === "string" ? value : Array.isArray(value) || record(value) ? JSON.stringify(value) : String(value ?? "");
      }
    }
    skipAutosave.current = true;
    setEditSection(section); setEditForm(flat); setEditPicker(null);
    setEditMeta(prefill ? { label: prefill.label, provisional: prefill.provisional } : null);
    setTimeout(() => { skipAutosave.current = false; }, 50);
  }

  function startEditFromTab(tabName: string) {
    const targetSections = TAB_SECTIONS[tabName] ?? [];
    if (targetSections.length === 0) return;
    if (targetSections.length === 1) { openEdit(targetSections[0]); return; }
    setEditMeta(null);
    setEditPicker(targetSections);
  }

  async function saveEdit() {
    if (!editSection) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await act("edit", { edit: { section: editSection, payload: parseEditForm(editForm), reason: "手動編輯" } });
  }

  const coverage = data.coverage ?? {};
  const findings = data.logicFindings ?? [];
  const gatePreview = data.gatePreview;
  const editDisabled = busy !== "" || (TAB_SECTIONS[tab] ?? []).length === 0;

  return (
    <section className="v13-panel-stack" data-testid="research-blueprint-studio">
      <div className="v13-panel">
        <div className="v13-panel-head">
          <div><p className="section-kicker">RESEARCH BLUEPRINT · 研究藍圖</p><h2>{text(row(sections.research_identity).chineseTitle) || "未命名研究藍圖"}</h2></div>
          <p className="v13-panel-note">Primary Route：{b.primaryRoute ?? "MISSING"}{b.secondaryRoute ? ` ｜ Secondary：${b.secondaryRoute}` : ""} ｜ Status：<strong>{b.status}</strong> ｜ Evidence Readiness：{b.evidenceReadiness} ｜ Version：{b.currentVersion}（{b.versionLabel}）</p>
        </div>
        {error && <p className="v13-error" role="alert">{error}</p>}
        {notice && <p className="v13-notice" role="status">{notice}</p>}

        {gatePreview && (() => {
          const g = gatePreview;
          const allPassed = g.total > 0 && g.passed === g.total;
          return (
            <div className="v13-panel" style={{ marginTop: 12, border: allPassed ? "1px solid var(--v13-border,#333)" : "1px solid #b45309", background: allPassed ? undefined : "rgba(180,83,9,0.07)" }} data-testid="blueprint-gate-preview">
              <div className="v13-panel-head">
                <div><p className="section-kicker">APPROVAL GATES · 核准 Gate 檢查</p><h3>核准前檢查：{g.passed} / {g.total} 通過</h3></div>
                {allPassed ? <p className="v13-notice">全部 Gate 已通過，可直接按「核准研究藍圖」。</p> : <p className="v13-muted">以下 {g.failed.length} 項未通過：每一項都標示「去哪裡改」；可行時提供「老麥建議填入」（PROVISIONAL，你確認後儲存）。</p>}
              </div>
              {!allPassed && (
                <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                  {g.failed.map((f) => (
                    <div key={f.key} style={{ border: "1px solid var(--v13-border,#333)", borderRadius: 8, padding: "8px 10px" }}>
                      <p style={{ margin: 0 }}><strong>✗ {f.label}</strong> <small className="v13-muted">（{f.key}）</small></p>
                      <p className="v13-muted" style={{ margin: "4px 0" }}>{f.detail}</p>
                      {f.fix && <p className="v13-muted" style={{ margin: "4px 0" }}>修改指引：{f.fix.note}</p>}
                      <div className="research-actions" style={{ marginTop: 6, flexWrap: "wrap", gap: 6 }}>
                        {f.fix?.kind === "edit" && f.fix.tab && (
                          <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 13 }} onClick={() => { setTab(f.fix!.tab!); if (f.fix?.autoFill && f.fix.section) openEdit(f.fix.section, f.fix.autoFill); else if (f.fix?.section) openEdit(f.fix.section); }}>
                            {f.fix.autoFill ? "老麥建議填入 →" : `前往「${f.fix.tab}」修改 →`}
                          </button>
                        )}
                        {f.fix?.kind === "module" && f.fix.module === "navigator" && (
                          <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 13 }} onClick={() => onNavigate?.("navigator")}>前往投稿導航 →</button>
                        )}
                        {f.fix?.kind === "module" && f.fix.module === "evidence" && (
                          <button type="button" className="secondary-button" style={{ padding: "4px 10px", fontSize: 13 }} onClick={() => onOpenEvidence?.(f.fix?.role ?? "GAP")}>前往文獻與證據中心（{f.fix?.role ?? "GAP"}）→</button>
                        )}
                      </div>
                      {f.fix?.autoFill && <p className="v13-notice" style={{ margin: "6px 0 0" }}>老麥建議：{f.fix.autoFill.label}{f.fix.autoFill.provisional ? "（PROVISIONAL，填入後請確認再儲存）" : ""}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <div className="v13-actions" style={{ flexWrap: "wrap" }}>
          {TABS.map((t) => <button key={t} type="button" className={tab === t ? "primary-button" : "secondary-button"} style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        {tab === "總覽" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Research Identity</h3>
            {renderSectionValue(sections.research_identity)}
            <h3 style={{ margin: "14px 0 8px" }}>Next Best Action</h3>
            {data.nextBestAction ? <p className="v13-muted"><strong>{text(data.nextBestAction.action)}</strong><br /><small>{text(data.nextBestAction.reason)}</small></p> : <p className="v13-muted">MISSING</p>}
            <h3 style={{ margin: "14px 0 8px" }}>Logic Alignment Checker</h3>
            {findings.length === 0 ? <p className="v13-notice">邏輯鏈無重大斷鏈。</p> : <ul>{findings.map((f, i) => <li key={i}><strong>[{f.severity}] {f.chain}</strong>：{f.description} → {f.suggestion}</li>)}</ul>}
          </>
        )}

        {tab === "問題與Gap" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Core Research Problem</h3>
            {renderSectionValue(sections.core_problem)}
            <h3 style={{ margin: "14px 0 8px" }}>Research Gap（7 類）</h3>
            {list(sections.gaps).length === 0 ? <p className="v13-muted">MISSING</p> : list(sections.gaps).map((g, i) => <div key={i} style={{ marginBottom: 8 }}><strong>[{text(row(g).gapKey)}] {text(row(g).type)}</strong><p style={{ margin: "4px 0" }}>{text(row(g).statement)}</p><small>Evidence：{list(row(g).evidence_link_ids).length} 筆</small></div>)}
          </>
        )}

        {tab === "目的與RQ" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Research Purpose</h3>
            {renderSectionValue(sections.purpose)}
            <h3 style={{ margin: "14px 0 8px" }}>Objectives</h3>
            {renderSectionValue(sections.objectives)}
            <h3 style={{ margin: "14px 0 8px" }}>Research Questions（expected_data / proposed_analysis 為 PROVISIONAL）</h3>
            {renderSectionValue(sections.questions)}
          </>
        )}

        {tab === "假設與變數" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Preliminary Hypotheses</h3>
            {renderSectionValue(sections.hypotheses)}
            <h3 style={{ margin: "14px 0 8px" }}>Variables and Constructs</h3>
            {renderSectionValue(sections.variables)}
          </>
        )}

        {tab === "初步架構" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Conceptual Logic</h3>
            {renderSectionValue(sections.conceptual_logic)}
            <h3 style={{ margin: "14px 0 8px" }}>Population and Context</h3>
            {renderSectionValue(sections.population_context)}
            <h3 style={{ margin: "14px 0 8px" }}>Preliminary Method</h3>
            {renderSectionValue(sections.method)}
          </>
        )}

        {tab === "工作與時程" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Work Packages</h3>
            {renderSectionValue(sections.workpackages)}
            <h3 style={{ margin: "14px 0 8px" }}>Milestones</h3>
            {renderSectionValue(sections.milestones)}
          </>
        )}

        {tab === "預期成果" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Expected Contribution</h3>
            {renderSectionValue(sections.contributions)}
            <h3 style={{ margin: "14px 0 8px" }}>Expected Outputs（PLANNED，非已完成）</h3>
            {renderSectionValue(sections.outputs)}
          </>
        )}

        {tab === "Evidence Coverage" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Evidence Coverage Panel（依本專案文獻角色計算）</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
              {Object.entries(COVERAGE_LABELS).map(([key, label]) => {
                const entry = coverage[key] ?? { status: "MISSING", count: 0 };
                return <div key={key} className="v13-path-station"><strong>{entry.status}</strong><span>{label}（{entry.count}）</span><small><button type="button" className="text-button" onClick={() => onOpenEvidence?.(key === "GAP" ? "GAP" : key === "THEORY" ? "THEORY" : key === "METHOD" ? "METHOD" : key === "MEASUREMENT" ? "MEASUREMENT" : key === "SIMILAR_STUDY" ? "SIMILAR_STUDY" : "CORE")}>前往文獻與證據中心 →</button></small></div>;
              })}
            </div>
            <p className="v13-muted" style={{ marginTop: 10 }}>點擊任一項目會開啟既有「文獻與證據中心」並自動套用本專案＋角色 Filter；藍圖內不另建搜尋頁。</p>
          </>
        )}

        {tab === "風險" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Risks and Assumptions</h3>
            {renderSectionValue(sections.risks)}
          </>
        )}

        {tab === "版本" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Blueprint Versions（不覆蓋舊版）</h3>
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
          <button type="button" className="primary-button" disabled={busy !== "" || tab === "版本" || tab === "Evidence Coverage"} onClick={() => void act("regenerate", { section: tabToSection(tab) })}>{busy === "regenerate" ? "重新分析中…" : "重新分析本區塊"}</button>
          <button type="button" className="secondary-button" disabled={editDisabled} title={editDisabled && (TAB_SECTIONS[tab] ?? []).length === 0 ? "此分頁不提供直接編輯；請切換至內容分頁（問題與Gap、目的與RQ、假設與變數、初步架構、工作與時程、預期成果、風險）後再編輯。" : ""} onClick={() => startEditFromTab(tab)}>手動編輯本區塊</button>
          <button type="button" className="secondary-button" disabled={busy === "verify"} onClick={() => void act("verify")}>送交老麥檢查</button>
          <button type="button" className="secondary-button" disabled={busy === "approve"} onClick={() => void act("approve")}>核准研究藍圖</button>
          {onNavigate && <button type="button" className="secondary-button" onClick={() => onNavigate("evidence")}>送往文獻與證據中心</button>}
          <button type="button" className="secondary-button" onClick={() => void load()}>重新整理</button>
        </div>
        {busy === "approve" && <p className="v13-muted">核准前將執行 12 項 Gate 檢查（含 Evidence Coverage 與 Logic Checker）。</p>}

        {editPicker && editPicker.length > 0 && !editSection && (
          <div className="v13-panel" style={{ marginTop: 10 }}>
            <div className="v13-panel-head"><div><p className="section-kicker">MANUAL EDIT · 手動編輯</p><h3>選擇要編輯的區塊</h3></div><p className="v13-panel-note">此分頁包含多個區塊，請選擇其一。</p></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {editPicker.map((sectionName) => <button key={sectionName} type="button" className="secondary-button" onClick={() => openEdit(sectionName)}>{sectionName}</button>)}
              <button type="button" className="text-button" onClick={() => setEditPicker(null)}>取消</button>
            </div>
          </div>
        )}

        {editSection && (
          <div className="v13-panel" style={{ marginTop: 10 }}>
            <div className="v13-panel-head"><div><p className="section-kicker">MANUAL EDIT · 手動編輯</p><h3>區塊：{editSection}</h3></div><p className="v13-panel-note">編輯會建立新版本；已核准的其他區塊不受影響。{editMeta?.provisional ? "此內容為老麥建議（PROVISIONAL），請確認後再儲存。" : ""}</p></div>
            {editMeta && <p className="v13-notice" role="status">老麥建議：{editMeta.label}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10 }}>
              {Object.entries(editForm).filter(([key]) => key === "_items" || !key.startsWith("_")).map(([key, value]) => <label key={key} className="research-field">{FIELD_LABELS[key] ?? key}<textarea rows={key === "_items" ? 6 : 3} value={value} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} /></label>)}
            </div>
            <div className="research-actions" style={{ marginTop: 10 }}><button type="button" className="primary-button" disabled={busy === "edit"} onClick={() => void saveEdit()}>儲存（建立新版本）</button><button type="button" className="secondary-button" onClick={() => { setEditSection(null); setEditPicker(null); setEditMeta(null); }}>取消</button></div>
          </div>
        )}
      </div>
    </section>
  );
}

function tabToSection(tab: string): string {
  switch (tab) {
    case "總覽": return "identity";
    case "問題與Gap": return "gaps";
    case "目的與RQ": return "questions";
    case "假設與變數": return "variables";
    case "初步架構": return "method";
    case "工作與時程": return "workpackages";
    case "預期成果": return "outputs";
    case "風險": return "risks";
    default: return "core_problem";
  }
}
