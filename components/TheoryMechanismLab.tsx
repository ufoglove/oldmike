"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Candidate = { theoryKey: string; theoryName: string; theoryType: string; originalDomain: string; coreConstructs: string[]; explanatoryMechanism: string; relatedRqKeys: string[]; relatedGapIds: string[]; fitBreakdown: Record<string, number>; fitScore: number; fitRationale: string; selectionStatus: string; selectionReason: string | null; limitations: string | null; routeFit: string | null; fulltextEvidenceStatus: string };
type AlignmentFinding = { severity: string; code: string; chain: string; description: string; suggestion: string };
type TheoryData = {
  ok: boolean; exists?: boolean; locked?: boolean; gapValidated?: boolean; missingResearchProject?: boolean; error?: string;
  analysis?: { id: string; status: string; selectionMode: string | null; currentVersion: number; versionLabel: string; primaryRoute: string | null; updatedAt: string; gateState: Record<string, unknown> };
  sections?: Record<string, unknown>;
  candidates?: Candidate[];
  theoryEvidenceLinks?: Record<string, unknown>[];
  alignment?: { checkedAt?: string | null; findings: AlignmentFinding[] } | null;
  gatePreview?: { total: number; passed: number; failed: { key: string; label: string; detail: string }[] };
  missingInputs?: { key: string; label: string; affects: string }[];
  sourceInfo?: { blueprintVersion: number; gapStatus: string; projectTitle: string };
  versions?: { id: string; versionNumber: number; versionLabel: string; reason: string; createdAt: string }[];
};

const TABS = ["總覽", "候選理論", "核心理論", "機制模型", "構念字典", "假設與命題", "競爭解釋", "邊界條件", "Evidence", "Alignment Check", "版本"];
const TAB_SECTIONS: Record<string, string[]> = {
  "核心理論": ["core_theory", "supporting_theories", "rejected_theories", "competing_theories", "unresolved_theory_issues"],
  "機制模型": ["mechanism_model"],
  "構念字典": ["construct_dictionary"],
  "假設與命題": ["hypotheses_or_propositions"],
  "競爭解釋": ["competing_explanations"],
  "邊界條件": ["boundary_conditions"],
  "總覽": [], "候選理論": [], "Evidence": [], "Alignment Check": [], "版本": [],
};
const FIELD_LABELS: Record<string, string> = {
  selectionMode: "選擇模式（FORMAL_THEORY / CONCEPTUAL_FRAMEWORK_ONLY）", theoryKey: "理論 Key", theoryName: "理論名稱", reason: "選擇理由", mechanismRole: "機制角色", coreConstructs: "核心構念", explanatoryMechanism: "解釋機制",
  paths: "機制路徑（JSON 陣列）", note: "備註", modelVersion: "模型版本", nodes: "節點（JSON 陣列）", edges: "邊（JSON 陣列）", status: "狀態",
  _items: "內容（JSON 陣列；每項一個物件）",
};

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function row(value: unknown): Record<string, unknown> { return record(value) ? value : {}; }

const CANDIDATE_ACTIONS: { status: string; label: string }[] = [
  { status: "CORE", label: "設為核心" }, { status: "SUPPORTING", label: "支持理論" }, { status: "COMPETING", label: "競爭解釋" }, { status: "REJECTED", label: "拒絕" }, { status: "INSUFFICIENT_EVIDENCE", label: "證據不足" },
];

export default function TheoryMechanismLab({ projectId, onOpenEvidence, onOpenBlueprint, onOpenDesign }: {
  projectId: string; onOpenEvidence?: (role: string) => void; onOpenBlueprint?: () => void; onOpenDesign?: () => void;
}) {
  const [data, setData] = useState<TheoryData | null>(null);
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
  const [linkForm, setLinkForm] = useState<{ targetType: string; targetRef: string; literatureId: string; sourceLocation: string; readingStatus: string; verificationStatus: string }>({ targetType: "THEORY", targetRef: "", literatureId: "", sourceLocation: "", readingStatus: "FULLTEXT_REVIEWED", verificationStatus: "VERIFIED" });
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutosave = useRef(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/theory-mechanism`, { cache: "no-store" });
      const json = await response.json() as TheoryData;
      if (!response.ok || !json.ok) throw new Error(json.error || "無法載入理論與機制實驗室。");
      setData(json);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "無法載入理論與機制實驗室。"); }
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
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/theory-mechanism`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const json = await response.json() as { ok?: boolean; error?: string; status?: string; failed?: { key: string; label: string; detail: string }[]; findings?: AlignmentFinding[]; linked?: number; count?: number; changedSections?: string[]; checkedAt?: string; versionNumber?: number };
      if (action === "lock" && !json.ok && Array.isArray(json.failed) && json.failed.length > 0) {
        setError(`模型鎖定 Gate 未通過（${json.failed.length} 項）：${json.failed.map((f) => f.label).slice(0, 3).join("、")}…。請依「鎖定檢查」補齊。`);
      } else if (!response.ok || !json.ok) {
        throw new Error(`${json.error || "操作失敗。"}`);
      }
      if (action === "draft") setNotice(`候選理論池已建立（${json.count ?? 0} 個；分數為內部適配工具，非學術共識）。`);
      if (action === "alignment") setNotice(`Alignment Check 完成：${(json.findings ?? []).filter((f) => f.severity === "MAJOR_ALIGNMENT_GAP").length} 個 MAJOR 斷鏈。`);
      if (action === "writeback") setNotice(`Research Blueprint v2 Approved 已回寫（版本 ${json.versionNumber ?? ""}，不覆蓋 v1/v2 Draft）。`);
      if (action === "lock" && json.ok) setNotice("🎉 THEORY_AND_MECHANISM_LOCKED — 研究模型已鎖定，研究設計實驗室已解鎖。");
      if (action === "link-evidence") setNotice(`理論證據已連結（${json.linked ?? 0} 筆，僅 ID 關聯既有文獻）。`);
      if (action === "compare" && json.changedSections) setCompareResult(json.changedSections);
      if (action !== "compare") { setEditSection(null); setEditPicker(null); setCompareResult(null); }
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); }
    finally { setBusy(""); }
  }

  if (loading) return <section className="v13-panel-stack"><div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">理論與機制實驗室</p><h2>理論與機制</h2></div></div><p className="v13-muted" role="status">載入中…</p></div></section>;

  if (!data?.exists) {
    return (
      <section className="v13-panel-stack" data-testid="theory-mechanism-lab">
        <div className="v13-panel"><div className="v13-panel-head"><div><p className="section-kicker">理論與機制實驗室</p><h2>理論與機制</h2></div><p className="v13-panel-note">將已驗證的 Research Gap 與 Contribution Delta，轉換為有文獻依據、可測量、可驗證的核心理論、機制模型、構念字典與概念模型。</p></div>
          {error && <p className="v13-error" role="alert">{error}</p>}
          {data?.missingResearchProject ? (
            <div className="v13-empty"><strong>尚無理論分析資料（研究專案資料未建立）</strong><p>此專案在「projects」存在，但尚未建立正式的 research project 資料（可能是修復前建立失敗的舊專案）。請先建立研究專案資料後再開啟理論與機制：</p><ul style={{ textAlign: "left", margin: "8px auto", maxWidth: 420 }}><li>到「研究藍圖」按「直接建立研究專案資料（不依賴導航）」；或</li><li>到「投稿導航」重新執行分析後按「建立研究專案」（會帶入期刊/路線/文獻）。</li></ul><div className="research-actions" style={{ marginTop: 10 }}>{onOpenBlueprint && <button type="button" className="primary-button" onClick={onOpenBlueprint}>前往研究藍圖 →</button>}</div></div>
          ) : (
            <div className="v13-empty"><strong>尚無理論分析資料</strong><p>需先完成研究藍圖與文獻準備。此處會自動讀取既有藍圖、Gap 驗證與 THEORY 角色文獻，不會要求重複輸入。</p></div>
          )}
        </div>
      </section>
    );
  }

  if (data.locked) {
    return (
      <section className="v13-panel-stack" data-testid="theory-mechanism-lab">
        <div className="v13-panel">
          <div className="v13-panel-head"><div><p className="section-kicker">理論與機制實驗室</p><h2>理論與機制</h2></div></div>
          {error && <p className="v13-error" role="alert">{error}</p>}
          <div className="v13-empty"><strong>THEORY_LAB_LOCKED</strong><p>Gap 與新穎性尚未完成正式驗證（需 GAP_AND_NOVELTY_VALIDATED），本階段不提前建置正式理論模型。請先到 Gap 與新穎性完成驗證。</p><div className="research-actions" style={{ marginTop: 10 }}>{onOpenEvidence && <button type="button" className="secondary-button" onClick={() => onOpenEvidence("THEORY")}>補充理論文獻 →</button>}{onOpenBlueprint && <button type="button" className="secondary-button" onClick={onOpenBlueprint}>前往研究藍圖</button>}</div></div>
        </div>
      </section>
    );
  }

  const s = data.sections ?? {};
  const sections = s;
  const core = row(sections.core_theory);
  const mechanismModel = row(sections.mechanism_model);
  const conceptualModel = row(sections.conceptual_model);
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
    // 直接使用原始值（不可經 row()——它會把陣列轉成 {}，導致陣列區塊永遠空表單）
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

  function modelLayout() {
    const nodes = list(conceptualModel.nodes).map((n) => row(n));
    const edges = list(conceptualModel.edges).map((e) => row(e));
    const byId = new Map(nodes.map((n) => [text(n.nodeId), n]));
    const outDegree = new Map<string, number>();
    for (const n of nodes) outDegree.set(text(n.nodeId), 0);
    const inDegree = new Map<string, number>();
    for (const n of nodes) inDegree.set(text(n.nodeId), 0);
    for (const e of edges) {
      const src = text(e.sourceNodeId); const tgt = text(e.targetNodeId);
      if (byId.has(src) && byId.has(tgt)) { outDegree.set(src, (outDegree.get(src) ?? 0) + 1); inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1); }
    }
    const queue = nodes.filter((n) => (inDegree.get(text(n.nodeId)) ?? 0) === 0).sort((a, b) => text(a.label).localeCompare(text(b.label), "zh-Hant"));
    const layers: Record<string, number> = {};
    const visited = new Set<string>();
    let layerIndex = 0;
    while (queue.length) {
      const current = [...queue]; queue.length = 0;
      for (const n of current) {
        const id = text(n.nodeId);
        if (visited.has(id)) continue;
        visited.add(id); layers[id] = layerIndex;
        for (const e of edges) {
          if (text(e.sourceNodeId) === id) {
            const tgt = text(e.targetNodeId);
            if (!visited.has(tgt) && byId.has(tgt)) queue.push(byId.get(tgt)!);
          }
        }
      }
      layerIndex += 1;
    }
    const maxLayer = Math.max(0, ...Object.values(layers));
    const cols = maxLayer + 1;
    const perCol = Math.ceil(nodes.length / Math.max(1, cols));
    return { nodes, edges, byId, layers, cols, perCol };
  }

  return (
    <section className="v13-panel-stack" data-testid="theory-mechanism-lab">
      <div className="v13-panel">
        <div className="v13-panel-head">
          <div><p className="section-kicker">THEORY & MECHANISM LAB · 理論與機制</p><h2>{data.sourceInfo?.projectTitle || "理論與機制"}</h2></div>
          <p className="v13-panel-note">Status <strong>{data.analysis?.status}</strong> ｜ Blueprint v{data.sourceInfo?.blueprintVersion} ｜ Gap：{data.sourceInfo?.gapStatus} ｜ 模式：{data.analysis?.selectionMode ?? "—"} ｜ 模型版本：{text(conceptualModel.modelVersion) || "0.0"} ｜ 理論版本：{data.analysis?.currentVersion}（{data.analysis?.versionLabel}）</p>
        </div>
        {error && <p className="v13-error" role="alert">{error}</p>}
        {notice && <p className="v13-notice" role="status">{notice}</p>}
        {data.analysis?.status === "OUTDATED" && <p className="v13-error" role="alert">模型已標示 OUTDATED：重大來源（Validated Gap／RQ／Topic／Route／Blueprint）已變更。請重新執行「根據Gap建立候選理論」與 Alignment Check 後再鎖定。</p>}

        {(data.missingInputs ?? []).length > 0 && (
          <div className="v13-panel" style={{ marginTop: 10, border: "1px solid #b45309" }}>
            <div className="v13-panel-head"><div><p className="section-kicker">MISSING INPUTS · 缺少輸入</p><h3>以下資料缺少，會影響對應的理論判斷</h3></div></div>
            <ul>{data.missingInputs?.map((m) => <li key={m.key}><strong>{m.label}</strong>：{m.affects}</li>)}</ul>
          </div>
        )}

        {gatePreview && (
          <div className="v13-panel" style={{ marginTop: 10, border: allGatesPass ? "1px solid var(--v13-border,#333)" : "1px solid #b45309", background: allGatesPass ? undefined : "rgba(180,83,9,0.07)" }} data-testid="theory-gate-preview">
            <div className="v13-panel-head"><div><p className="section-kicker">THEORY & MECHANISM GATE · 鎖定檢查</p><h3>鎖定 Gate：{gatePreview.passed} / {gatePreview.total} 通過</h3></div>{allGatesPass ? <p className="v13-notice">全部通過，可「回寫研究藍圖」並「鎖定研究模型」。</p> : <p className="v13-muted">以下未通過（鎖定前需補齊）：</p>}</div>
            {!allGatesPass && <div style={{ display: "grid", gap: 8, marginTop: 6 }}>{gatePreview.failed.map((f) => <div key={f.key} style={{ border: "1px solid var(--v13-border,#333)", borderRadius: 8, padding: "6px 10px" }}><p style={{ margin: 0 }}><strong>✗ {f.label}</strong> <small className="v13-muted">（{f.key}）</small></p><p className="v13-muted" style={{ margin: "4px 0" }}>{f.detail}</p></div>)}</div>}
          </div>
        )}

        <div className="v13-actions" style={{ flexWrap: "wrap", marginTop: 10 }}>
          {TABS.map((t) => <button key={t} type="button" className={tab === t ? "primary-button" : "secondary-button"} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        {tab === "總覽" && (
          <>
            <h3 style={{ margin: "14px 0 8px" }}>Core Theory</h3>
            {renderValue(sections.core_theory)}
            <h3 style={{ margin: "14px 0 8px" }}>Supporting / Competing / Rejected Theories</h3>
            {renderValue({ supporting: sections.supporting_theories, competing: sections.competing_theories, rejected: sections.rejected_theories })}
            <h3 style={{ margin: "14px 0 8px" }}>Mechanism Model（{list(mechanismModel.paths).length} 條路徑）</h3>
            {renderValue(mechanismModel)}
            <h3 style={{ margin: "14px 0 8px" }}>Conceptual Model v{text(conceptualModel.modelVersion)}（節點 {list(conceptualModel.nodes).length}）</h3>
            {renderValue(conceptualModel)}
            <h3 style={{ margin: "14px 0 8px" }}>未解決理論議題</h3>
            {renderValue(sections.unresolved_theory_issues)}
          </>
        )}

        {tab === "候選理論" && (
          <>
            <div className="v13-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" className="primary-button" disabled={busy === "draft"} onClick={() => void act("draft")}>{busy === "draft" ? "建立中…" : "根據Gap建立候選理論"}</button>
              {onOpenEvidence && <button type="button" className="secondary-button" onClick={() => onOpenEvidence("THEORY")}>補充理論文獻（文獻與證據中心）→</button>}
            </div>
            <p className="v13-muted" style={{ marginTop: 8 }}>候選池由既有選題資料／Validated Gap／THEORY 角色文獻推導；不虛構理論、不依知名度推薦。{text(sections.fit_disclaimer)}</p>
            {(data.candidates ?? []).length === 0 ? <div className="v13-empty"><strong>尚未建立候選理論池</strong><p>按「根據Gap建立候選理論」；若為探索性／設計科學研究，系統會提供 Conceptual Framework Only 選項。</p></div> : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {(data.candidates ?? []).map((c) => (
                  <div key={c.theoryKey} className="v13-panel" style={{ padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>{c.theoryName}</strong><span className="v13-badge">{c.selectionStatus} · Fit {c.fitScore}/100</span></div>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>{c.theoryType} ｜ {c.originalDomain} ｜ 文獻：{c.fulltextEvidenceStatus}</p>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>{c.fitRationale}</p>
                    <p className="v13-muted" style={{ margin: "4px 0" }}>權重分項：{Object.entries(c.fitBreakdown).map(([k, v]) => `${k}=${v}`).join(" ｜ ")}（{text(sections.fit_disclaimer)}）</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {CANDIDATE_ACTIONS.map((a) => <button key={a.status} type="button" disabled={busy === "select"} className={c.selectionStatus === a.status ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => void act("select-theory", { selection: { theoryKey: c.theoryKey, selectionStatus: a.status, reason: selReason[c.theoryKey] } })}>{a.label}{c.selectionStatus === a.status ? " ✓" : ""}</button>)}
                    </div>
                    <label className="research-field" style={{ marginTop: 6 }}>選擇理由／備註<input value={selReason[c.theoryKey] ?? ""} onChange={(e) => setSelReason({ ...selReason, [c.theoryKey]: e.target.value })} placeholder="為何選／為何不選（供 Alignment 追溯）" /></label>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "核心理論" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Core Theory（1 個為主，最多 2 個；不得堆疊）</h3>
            {renderValue(sections.core_theory)}
            <h3 style={{ margin: "14px 0 8px" }}>Supporting（0–2）／Competing（至少考慮 1）／Rejected</h3>
            {renderValue({ supporting_theories: sections.supporting_theories, competing_theories: sections.competing_theories, rejected_theories: sections.rejected_theories })}
            <h3 style={{ margin: "14px 0 8px" }}>未解決理論議題</h3>
            {renderValue(sections.unresolved_theory_issues)}
          </>
        )}

        {tab === "機制模型" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Mechanism Model（Intervention → Process → Outcome；每條路徑連結 Theory＋Evidence＋RQ）</h3>
            {renderValue(mechanismModel)}
            <p className="v13-muted" style={{ marginTop: 6 }}>狀態語意：PROPOSED（尚未驗證）／SUPPORTED（有文獻支持）／PARTIALLY_SUPPORTED／CONFLICTING／INSUFFICIENT_EVIDENCE。</p>
          </>
        )}

        {tab === "構念字典" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Construct Dictionary（本階段只建立概念與初步操作方向；正式量表留待研究工具階段）</h3>
            {renderValue(sections.construct_dictionary)}
          </>
        )}

        {tab === "假設與命題" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Hypotheses／Propositions</h3>
            {renderValue(sections.hypotheses_or_propositions)}
            <p className="v13-muted" style={{ marginTop: 6 }}>確認性量化研究使用 H1、H2…；探索性／質性／設計科學使用 Proposition（kind=PROPOSITION），不強制建立假設。強因果語句（causes／導致）會被 Alignment Check 標示。</p>
          </>
        )}

        {tab === "競爭解釋" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Competing Explanations（先備能力／新奇效應／教師效應／技術熟悉度／自我選擇／社會期許…）</h3>
            {renderValue(sections.competing_explanations)}
          </>
        )}

        {tab === "邊界條件" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Boundary Conditions（特定群體／任務難度／科技熟悉度／場域／時間長度／教學方式／組織條件）</h3>
            {renderValue(sections.boundary_conditions)}
          </>
        )}

        {tab === "Evidence" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Theory Evidence Links（僅 ID 關聯既有文獻／CitationSource／Zotero，不另建文獻庫）</h3>
            <div className="v13-panel" style={{ marginTop: 6, padding: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 8 }}>
                <label className="research-field">目標類型<select value={linkForm.targetType} onChange={(e) => setLinkForm({ ...linkForm, targetType: e.target.value })}>{["THEORY", "CONSTRUCT", "MECHANISM", "HYPOTHESIS", "COMPETING"].map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
                <label className="research-field">目標 Ref（如 theoryKey／constructId／pathId／H1）<input value={linkForm.targetRef} onChange={(e) => setLinkForm({ ...linkForm, targetRef: e.target.value })} /></label>
                <label className="research-field">既有 literature_id<input value={linkForm.literatureId} onChange={(e) => setLinkForm({ ...linkForm, literatureId: e.target.value })} placeholder="自文獻與證據中心取得" /></label>
                <label className="research-field">Source Location（page/section/paragraph…）<input value={linkForm.sourceLocation} onChange={(e) => setLinkForm({ ...linkForm, sourceLocation: e.target.value })} /></label>
                <label className="research-field">閱讀狀態<select value={linkForm.readingStatus} onChange={(e) => setLinkForm({ ...linkForm, readingStatus: e.target.value })}><option value="FULLTEXT_REVIEWED">FULLTEXT_REVIEWED</option><option value="ABSTRACT_REVIEWED">ABSTRACT_REVIEWED</option></select></label>
                <label className="research-field">驗證狀態<select value={linkForm.verificationStatus} onChange={(e) => setLinkForm({ ...linkForm, verificationStatus: e.target.value })}>{["VERIFIED", "SUPPORTED", "INFERRED", "UNVERIFIED"].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
              </div>
              <div className="research-actions" style={{ marginTop: 8 }}>
                <button type="button" className="primary-button" disabled={busy === "link-evidence" || !linkForm.targetRef || !linkForm.literatureId} onClick={() => void act("link-evidence", { links: [{ ...linkForm, literatureId: linkForm.literatureId.trim() }] })}>連結文獻（確認屬實才標已驗證）</button>
                {onOpenEvidence && <button type="button" className="secondary-button" onClick={() => onOpenEvidence("THEORY")}>前往文獻與證據中心（THEORY）→</button>}
              </div>
            </div>
            {list(data.theoryEvidenceLinks).length === 0 ? <p className="v13-muted" style={{ marginTop: 8 }}>尚無理論證據連結。</p> : <div style={{ display: "grid", gap: 8, marginTop: 8 }}>{list(data.theoryEvidenceLinks).map((l, i) => { const r = row(l); return <div key={i} style={{ border: "1px solid var(--v13-border,#333)", borderRadius: 8, padding: "6px 10px" }}><p style={{ margin: 0 }}><strong>[{text(r.targetType)}] {text(r.targetRef)}</strong> <small className="v13-muted">{text(r.readingStatus)} / {text(r.verificationStatus)}</small></p><p className="v13-muted" style={{ margin: "4px 0" }}>literature_id: {text(r.literatureId) || "—"} ｜ Zotero: {text(r.zoteroItemKey) || "—"} ｜ CitationSource: {text(r.citationSourceId) || "—"} ｜ {text(r.sourceLocation) || ""}</p></div>; })}</div>}
          </>
        )}

        {tab === "Alignment Check" && (
          <>
            <div className="v13-actions" style={{ marginTop: 8 }}><button type="button" className="primary-button" disabled={busy === "alignment"} onClick={() => void act("alignment")}>執行 Alignment Check</button></div>
            <p className="v13-muted" style={{ marginTop: 8 }}>檢查鏈：Validated Gap → Core Theory → Mechanism → Construct → RQ → Hypothesis／Proposition → Expected Evidence → Contribution。</p>
            {(data.alignment?.findings ?? []).length === 0 ? <p className="v13-notice" style={{ marginTop: 8 }}>{data.alignment?.checkedAt ? "Alignment Check 無斷鏈。🎉" : "尚未執行 Alignment Check。"}</p> : (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {data.alignment?.findings.map((f, i) => <div key={i} style={{ border: f.severity === "MAJOR_ALIGNMENT_GAP" ? "1px solid #b45309" : "1px solid var(--v13-border,#333)", borderRadius: 8, padding: "8px 10px" }}><p style={{ margin: 0 }}><strong>[{f.severity}] {f.code}</strong> <small className="v13-muted">（{f.chain}）</small></p><p className="v13-muted" style={{ margin: "4px 0" }}>{f.description}</p><p className="v13-muted" style={{ margin: 0 }}>建議：{f.suggestion}</p></div>)}
              </div>
            )}
          </>
        )}

        {tab === "版本" && (
          <>
            <h3 style={{ margin: "8px 0 8px" }}>Theory & Mechanism Versions（append-only，不覆蓋舊版）</h3>
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
          <button type="button" className="primary-button" disabled={busy === "writeback"} onClick={() => void act("writeback")}>回寫研究藍圖（v2 Approved）</button>
          <button type="button" className="primary-button" disabled={busy === "lock"} onClick={() => void act("lock")}>鎖定研究模型</button>{allGatesPass && onOpenDesign && <button type="button" className="primary-button" style={{ background: "linear-gradient(90deg,#0f7a3d,#22a35a)" }} onClick={onOpenDesign}>鎖定完成後 · 前往研究設計 →</button>}
          {onOpenBlueprint && <button type="button" className="secondary-button" onClick={onOpenBlueprint}>前往研究藍圖</button>}
          <button type="button" className="secondary-button" onClick={() => void load()}>重新整理</button>
        </div>
        {busy === "lock" && <p className="v13-muted">鎖定前將執行 13 項 Gate 檢查；通過後建立 THEORY_AND_MECHANISM_RELEASE Human Gate。</p>}

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

        {tab === "總覽" && (() => {
          const { nodes, edges } = modelLayout();
          if (nodes.length === 0) return null;
          return (
            <div style={{ marginTop: 10 }} data-testid="conceptual-model-visual">
              <h3 style={{ margin: "10px 0 8px" }}>Conceptual Model v{text(conceptualModel.modelVersion)}（視覺化；編輯請用「機制模型／構念字典」區塊或手動編輯）</h3>
              <div style={{ overflowX: "auto", border: "1px solid var(--v13-border,#333)", borderRadius: 8, padding: 10, minHeight: 120 }}>
                <svg width="100%" height={Math.max(160, nodes.length * 44)} viewBox={`0 0 720 ${Math.max(160, nodes.length * 44)}`} preserveAspectRatio="xMidYMid meet" style={{ maxWidth: 720 }}>
                  {edges.map((e, i) => {
                    const src = nodes.find((n) => text(n.nodeId) === text(e.sourceNodeId));
                    const tgt = nodes.find((n) => text(n.nodeId) === text(e.targetNodeId));
                    if (!src || !tgt) return null;
                    const x1 = 40 + (nodes.indexOf(src) % 3) * 220 + 100; const y1 = 30 + nodes.indexOf(src) * 44;
                    const x2 = 40 + (nodes.indexOf(tgt) % 3) * 220 + 100; const y2 = 30 + nodes.indexOf(tgt) * 44;
                    return <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8a8a8a" strokeWidth={1.2} markerEnd="url(#tmArrow)" /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} fontSize={9} fill="#8a8a8a" textAnchor="middle">{text(e.relationshipType) || text(e.label) || ""}</text></g>;
                  })}
                  <defs><marker id="tmArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#8a8a8a" /></marker></defs>
                  {nodes.map((n, i) => <g key={i}><rect x={40 + (i % 3) * 220} y={15 + i * 44} width={200} height={30} rx={6} fill={["INDEPENDENT_VARIABLE", "TECHNICAL_VARIABLE"].includes(text(n.type)) ? "#1d4ed8" : ["DEPENDENT_VARIABLE", "LEARNING_OUTCOME"].includes(text(n.type)) ? "#15803d" : ["MEDIATOR", "MODERATOR"].includes(text(n.type)) ? "#7c3aed" : "#444"} /><text x={140 + (i % 3) * 220} y={34 + i * 44} fontSize={11} fill="#fff" textAnchor="middle">{String(text(n.label) || text(n.nodeId)).slice(0, 18)}</text></g>)}
                </svg>
              </div>
              <p className="v13-muted" style={{ marginTop: 6 }}>節點類型：藍=IV／技術，綠=DV／學習結果，紫=中介/調節，灰=其他。每條線應連結 Theory＋Evidence＋RQ（見機制模型與 Evidence 分頁）。</p>
            </div>
          );
        })()}
      </div>
    </section>
  );
}
