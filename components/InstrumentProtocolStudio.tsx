"use client";

import { useCallback, useEffect, useState } from "react";

type StudioData = {
  ok?: boolean; locked?: boolean;
  entry?: { missing: string[]; route: string; planningAccess: boolean; executionAccess: boolean; accessNote: string; ethics: { judgment: string; teacherPower: string } | null; grants: { nstcPackageReady: boolean; moePackageReady: boolean; ethicsPackagePrepared: boolean } };
  sources?: { designVersion: number; route: string; questions: { rqKey: string; question: string }[]; matrixRows: Record<string, unknown>[]; requirementCount: number; analysisPlanCount: number };
  links?: Record<string, unknown>[]; permissions?: Record<string, unknown>[]; translations?: Record<string, unknown>[];
  catalog?: Record<string, unknown>[]; blueprints?: Record<string, unknown>[]; skills?: Record<string, unknown>[]; qualitative?: Record<string, unknown>[];
  events?: Record<string, unknown>[]; sensors?: Record<string, unknown>[]; annotations?: Record<string, unknown>[];
  interventions?: Record<string, unknown>[]; fidelities?: Record<string, unknown>[]; schedules?: Record<string, unknown>[]; fields?: Record<string, unknown>[];
  protocol?: { id: string; status: string; currentVersion: number } | null;
  protocolVersions?: Record<string, unknown>[]; latestProtocol?: { id: string; version: number; payload: Record<string, unknown> } | null;
  readiness?: { items: Record<string, unknown>[]; overall: string; version: number } | null;
  alignmentResults?: { id?: string; checkType: string; status: string; fatalCount: number; majorCount: number; checkedAt: string; results?: Record<string, unknown>[] }[];
  error?: string;
};

type Tab = "overview" | "map" | "candidates" | "permission" | "translation" | "builders" | "sensors" | "intervention" | "schedule" | "schema" | "protocol" | "align" | "readiness" | "versions";

const READINESS_LABELS: Record<string, string> = { REQUIREMENT_DEFINED: "需求已定義", CANDIDATE_NEEDED: "需找候選", CANDIDATE_FOUND: "候選已找到", EVIDENCE_INCOMPLETE: "證據不足", PERMISSION_REQUIRED: "需授權", TRANSLATION_REQUIRED: "需翻譯", SELECTED: "已選定", READY_FOR_PROTOCOL: "可入 Protocol", BLOCKED: "受阻" };
const PERMISSION_LABELS: Record<string, string> = { UNKNOWN: "未確認", PUBLIC_DOMAIN: "公共領域", OPEN_LICENSE: "開放授權", PERMISSION_NOT_REQUIRED: "不需授權", PERMISSION_REQUIRED: "需授權", REQUESTED: "已請求", APPROVED: "已核准", REJECTED: "被拒", EXPIRED: "過期", RESTRICTION_APPLIES: "有限制" };
const string = (v: unknown, fb = ""): string => typeof v === "string" ? v : fb;
const num = (v: unknown, fb = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

const PROTOCOL_SECTION_KEYS = ["identity", "background", "objectives", "design", "population", "recruitment_consent", "arms_allocation", "intervention_control", "measurements", "schedule", "data_capture", "outcomes", "sample_size", "analysis", "data_management", "privacy_security", "adverse_events", "withdrawal", "deviation_qa", "fidelity", "ethics_status", "preregistration", "dissemination", "appendices"];

export default function InstrumentProtocolStudio({ projectId, onOpenEvidence }: { projectId: string; onOpenEvidence?: (role?: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [data, setData] = useState<StudioData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [mapDrafts, setMapDrafts] = useState<Record<string, unknown>>({});
  const [protocolSections, setProtocolSections] = useState<Record<string, string>>({});
  const [activeSectionKey, setActiveSectionKey] = useState("identity");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/instruments-protocol`, { cache: "no-store" });
      const json = await res.json() as StudioData;
      if (!res.ok || json.ok === false) throw new Error(json.error || "無法載入工具與 Protocol 工作室。");
      setData(json);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "載入失敗。"); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function action(name: string, body: Record<string, unknown>, success?: string) {
    setError(""); setBusy(name);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/instruments-protocol`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const payload = await res.json() as { ok?: boolean; error?: string; failed?: { key: string; label: string; detail?: string }[] };
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "操作失敗。");
      if (success) setNotice(success);
      await load();
      return payload;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); return null; }
    finally { setBusy(""); }
  }

  if (loading) return <div className="v13-panel" style={{ marginTop: 10 }}><p className="v13-muted" role="status">載入中…</p></div>;

  if (data?.locked) {
    return (
      <div className="v13-panel" style={{ marginTop: 10 }}>
        <div className="v13-panel-head"><div><p className="section-kicker">測量、工具與量表 Protocol · 08</p><h3>研究工具、量表與 Study Protocol 工作室</h3></div></div>
        <div className="v13-empty"><strong>INSTRUMENT_STUDIO_LOCKED</strong><p>進入條件（依路線）：</p><ul>{(data.entry?.missing ?? []).map((m) => <li key={m}>{m}</li>)}</ul>{data.entry?.accessNote ? <p style={{ marginTop: 8 }}>{data.entry.accessNote}</p> : null}</div>
      </div>
    );
  }

  const entry = data?.entry;
  const links = data?.links ?? [];
  const latestProtocol = data?.latestProtocol;
  const latestSections = (latestProtocol?.payload && typeof latestProtocol.payload.sections === "object" && latestProtocol.payload.sections !== null) ? latestProtocol.payload.sections as Record<string, unknown> : {};
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "總覽" }, { id: "map", label: "Measurement Requirements" }, { id: "candidates", label: "候選與比較" }, { id: "permission", label: "授權與翻譯" }, { id: "builders", label: "測驗／評量／訪談" }, { id: "sensors", label: "Log／感測器" }, { id: "intervention", label: "介入與控制組" }, { id: "schedule", label: "Schedule of Activities" }, { id: "schema", label: "Data Capture Schema" }, { id: "protocol", label: "Study Protocol" }, { id: "align", label: "Ethics／Analysis Alignment" }, { id: "readiness", label: "Pilot Readiness" }, { id: "versions", label: "版本" },
  ];

  return (
    <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">測量、工具與量表 Protocol · 08</p><h3>研究工具、量表與 Study Protocol 工作室</h3></div><p className="v13-panel-note">{entry?.accessNote ?? ""} ｜ 本階段僅建立 PLANNED／DRAFT／PROTOCOL-READY；不產生信效度、Pilot 或研究結果。正式倫理核准／計畫核定前不得啟動執行。</p></div>
      {error && <p className="v13-error" role="alert">{error}</p>}
      {notice && <p className="v13-notice" role="status">{notice}</p>}
      {data?.sources && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <span className="v13-badge">Research Design v{data.sources.designVersion}</span>
        <span className="v13-badge">路線：{data.sources.route || "GENERAL"}</span>
        <span className="v13-badge">RQ：{data.sources.questions.length}</span>
        <span className="v13-badge">Analysis Plan 項目：{data.sources.analysisPlanCount}</span>
        <span className="v13-badge" style={{ background: entry?.executionAccess ? "#e0efe5" : "#e7ebe7", color: entry?.executionAccess ? "#2f6f4f" : "var(--muted)" }}>{entry?.executionAccess ? "execution access（倫理包已備）" : "planning access（PRE_AWARD）"}</span>
      </div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>{tabs.map((t) => <button key={t.id} type="button" className={tab === t.id ? "primary-button" : "secondary-button"} style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>

      {tab === "overview" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>核心任務：將已核准設計／構念／Measurement Requirements／分析計畫／倫理規劃轉換為可 Pilot、可版本化、可追溯的工具與 Protocol。所有量表與測驗來源需連結文獻與證據中心、CitationSource、Zotero。</p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">測量需求對照</p><strong>{links.length} 個測量需求</strong><p className="v13-muted" style={{ fontSize: 11 }}>Readiness：{links.filter((l) => string(l.readinessStatus) === "READY_FOR_PROTOCOL").length} READY_FOR_PROTOCOL ｜ {links.filter((l) => string(l.readinessStatus) === "SELECTED").length} SELECTED ｜ {links.filter((l) => string(l.readinessStatus) === "REQUIREMENT_DEFINED").length} 僅需求</p><div className="research-actions" style={{ marginTop: 6 }}><button type="button" className="primary-button" disabled={busy === "generate-map"} onClick={() => void action("generate-map", {}, "Measurement Requirement Map 已依 RQ／矩陣產生（不虛構構念）。")}>根據 Measurement Requirements 建立工具需求</button></div></div>
            <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">研究方案（Protocol）</p><strong>{data?.protocol?.status ?? "NOT_STARTED"} ｜ v{data?.protocol?.currentVersion ?? 0}</strong><p className="v13-muted" style={{ fontSize: 11 }}>核准時建立不可變 Snapshot；核准後修改工具需 Amendment（不覆蓋）。</p></div>
            <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">前導就緒度</p><strong>{data?.readiness?.overall ?? "NOT_READY"}</strong><p className="v13-muted" style={{ fontSize: 11 }}>READY 不代表可正式收集資料；執行仍須正式倫理核准＋計畫核定＋授權完成。</p></div>
            {entry?.ethics && <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">ETHICS 狀態</p><strong>{entry.ethics.judgment}</strong>{entry.ethics.teacherPower === "TEACHER_STUDENT_POWER_RISK" && <p className="v13-error" style={{ marginTop: 4 }}>⚠ 師生權力風險未解除（倫理中心 11 項檢查需全 YES）</p>}</div>}
          </div>
        </div>
      )}

      {tab === "map" && (
        <div>
          <div className="research-actions" style={{ flexWrap: "wrap", marginBottom: 8 }}><button type="button" className="secondary-button" onClick={() => void action("generate-map", {}, "已重新檢查並補齊缺 RQ 的需求列。")}>補齊缺 RQ 需求</button>{data?.sources && onOpenEvidence && <button type="button" className="secondary-button" onClick={() => onOpenEvidence("MEASUREMENT")}>📖 前往文獻與證據中心（補充測量/方法文獻）</button>}</div>
          <div style={{ display: "grid", gap: 6 }}>{links.length === 0 ? <p className="v13-muted">尚無測量需求；點上方按鈕產生（每個主要 RQ 至少一條可執行路徑）。</p> : links.map((l) => {
            const id = string(l.id);
            const draft = (mapDrafts[id] as Record<string, unknown> | undefined) ?? ({} as Record<string, unknown>);
            return <div key={id} className="v13-panel" style={{ padding: 10, borderLeft: string(l.readinessStatus) === "READY_FOR_PROTOCOL" ? "3px solid var(--teal)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 12 }}>{string(l.instrumentName)}</strong><span className="v13-badge">{READINESS_LABELS[string(l.readinessStatus)] ?? string(l.readinessStatus)}</span></div>
              <p className="v13-muted" style={{ fontSize: 11, margin: "4px 0" }}>RQ：{string(l.rqId) || "—"} ｜ 構念：{string(l.constructName) || "（待確認）"} ｜ {string(l.requirementId) || "無 requirement id"} ｜ 角色：{string(l.variableRole) || "—"} ｜ {string(l.dataType) || "mixed"} ｜ {string(l.primaryOrSecondary) || "—"} ｜ 語言：{string(l.language)} ｜ 授權：{PERMISSION_LABELS[string(l.permissionStatus)] ?? string(l.permissionStatus)}</p>
              {string(l.instrumentName).startsWith("（待選定）") && <div className="research-actions" style={{ marginTop: 6, gap: 6 }}><input style={{ fontSize: 11, flex: 1, minWidth: 140 }} placeholder="候選工具名稱（不虛構；未知欄位標 UNVERIFIED）" value={string(draft.candidateName)} onChange={(e) => setMapDrafts((d) => ({ ...d, [id]: { ...draft, candidateName: e.target.value } }))} /><button type="button" className="primary-button" disabled={busy === "add-candidate"} onClick={() => void action("add-candidate", { candidate: { name: draft.candidateName, type: string(draft.candidateType) || "STANDARDIZED_SCALE", constructId: string(l.constructId), constructName: string(l.constructName), requirementId: string(l.requirementId), rqId: string(l.rqId), hypothesisId: string(l.hypothesisId), variableRole: string(l.variableRole), dataType: string(l.dataType) }, targetLinkId: id }, "候選工具已建立（CANDIDATE_FOUND；metadata 未驗證欄位標 UNVERIFIED）。")}>加入候選</button></div>}
            </div>;
          })}</div>
        </div>
      )}

      {tab === "candidates" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>候選比較：為每個候選工具評 10 項（各 0–100），系統以權重建 100 分比較分。<strong>此分數為網站內部比較分數，不代表工具已在本研究樣本中完成信效度驗證。</strong></p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{links.filter((l) => string(l.readinessStatus) !== "REQUIREMENT_DEFINED").map((l) => {
            const id = string(l.id);
            const fit = (l.fit && typeof l.fit === "object") ? l.fit as Record<string, unknown> : {};
            const total = fit.total;
            const draft = (mapDrafts[`fit:${id}`] as Record<string, unknown> | undefined) ?? ({} as Record<string, unknown>);
            const scoreKeys = ["construct_fit", "population_fit", "context_fit", "reliability_evidence", "validity_evidence", "sensitivity", "administration", "language_cultural", "permission_cost", "analysis_compatibility"];
            return <div key={id} className="v13-panel" style={{ padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 12 }}>{string(l.instrumentName)}</strong>{total !== undefined && <span className="v13-badge">比較分：{num(total)}/100</span>}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 4, marginTop: 6 }}>{scoreKeys.map((k) => <label key={k} style={{ fontSize: 10 }}>{k.replace(/_/g, " ")}<input type="number" min={0} max={100} style={{ width: "100%", fontSize: 11 }} value={string(draft[k])} onChange={(e) => setMapDrafts((d) => ({ ...d, [`fit:${id}`]: { ...draft, [k]: e.target.value } }))} /></label>)}</div>
              <div className="research-actions" style={{ marginTop: 6, gap: 6 }}><button type="button" className="secondary-button" disabled={busy === "compare-candidates"} onClick={() => void action("compare-candidates", { scores: [{ linkId: id, scores: Object.fromEntries(scoreKeys.map((k) => [k, Number(draft[k] ?? 0)])) }] }, "比較分數已更新（內部比較用）。")}>計分</button><button type="button" className="primary-button" disabled={busy === "select-instrument"} onClick={() => void action("select-instrument", { linkId: id }, "已選定工具（同 RQ 其他候選取消選定）。")}>選定工具</button></div>
            </div>;
          })}</div>
        </div>
      )}

      {tab === "permission" && (
        <div>
          <p className="v3-muted v13-muted" style={{ fontSize: 11 }}>Permission Center：未確認授權前不得把受保護完整題項放入頁面／匯出／公開；僅保存 Metadata、題項代碼與使用者合法上傳的文件 Reference。授權核准需 permission_document。</p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{links.filter((l) => string(l.readinessStatus) !== "REQUIREMENT_DEFINED").map((l) => {
            const id = string(l.id);
            const perm = (data?.permissions ?? []).find((p) => string(p.link_id) === id);
            const draft = (mapDrafts[`perm:${id}`] as Record<string, unknown> | undefined) ?? ({} as Record<string, unknown>);
            return <div key={id} className="v13-panel" style={{ padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 12 }}>{string(l.instrumentName)}</strong><span className="v13-badge">{PERMISSION_LABELS[string(perm?.status, string(l.permissionStatus))] ?? string(perm?.status)}</span></div>
              <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                <input style={{ fontSize: 11 }} placeholder="Copyright Owner" value={string(draft.copyrightOwner, string(perm?.copyright_owner))} onChange={(e) => setMapDrafts((d) => ({ ...d, [`perm:${id}`]: { ...draft, copyrightOwner: e.target.value } }))} />
                <input style={{ fontSize: 11 }} placeholder="License Type" value={string(draft.licenseType, string(perm?.license_type))} onChange={(e) => setMapDrafts((d) => ({ ...d, [`perm:${id}`]: { ...draft, licenseType: e.target.value } }))} />
                <select style={{ fontSize: 11 }} value={string(draft.status, string(perm?.status, "UNKNOWN"))} onChange={(e) => setMapDrafts((d) => ({ ...d, [`perm:${id}`]: { ...draft, status: e.target.value } }))}>{Object.keys(PERMISSION_LABELS).map((s) => <option key={s} value={s}>{PERMISSION_LABELS[s]}（{s}）</option>)}</select>
                <input style={{ fontSize: 11 }} placeholder="許可文件（file reference／URL；APPROVED 必填）" value={string(draft.permissionDocument, string(perm?.permission_document))} onChange={(e) => setMapDrafts((d) => ({ ...d, [`perm:${id}`]: { ...draft, permissionDocument: e.target.value } }))} />
              </div>
              <button type="button" className="primary-button" style={{ marginTop: 6 }} disabled={busy === "save-permission"} onClick={() => void action("save-permission", { linkId: id, permission: { copyrightOwner: draft.copyrightOwner ?? "", licenseType: draft.licenseType ?? "", status: draft.status ?? "UNKNOWN", permissionDocument: draft.permissionDocument ?? "", permissionRequired: draft.status !== "PERMISSION_NOT_REQUIRED" } }, "授權紀錄已儲存。")}>儲存授權紀錄</button>
              <div style={{ marginTop: 6 }}><p className="v13-muted" style={{ fontSize: 10 }}>翻譯：{(data?.translations ?? []).find((t) => string(t.link_id) === id) ? string((data?.translations ?? []).find((t) => string(t.link_id) === id)?.status) : "NOT_REQUIRED"} ｜ 計分：{string(l.scoringStatus)}</p><div className="research-actions" style={{ gap: 6 }}>
                <button type="button" className="secondary-button" style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => { setTab("builders"); }}>建立翻譯／計分 →</button>
              </div></div>
            </div>;
          })}</div>
        </div>
      )}

      {tab === "builders" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>測驗藍圖（Table of Specifications）／技能評量（Rubric 錨點）／訪談觀察工具。難度與鑑別度一律 NOT_YET_TESTED；自編問卷標 NEWLY_DEVELOPED_INSTRUMENT，不得宣稱信效度；受保護題項未授權不得輸入。</p>
          <div className="v13-panel" style={{ padding: 12, marginTop: 8 }}>
            <p className="section-kicker">KNOWLEDGE TEST BLUEPRINT（測驗藍圖 JSON：{"[{\"objective\":\"…\",\"domain\":\"…\",\"cognitiveLevel\":\"…\",\"numItems\":…,\"itemType\":\"MCQ\",\"difficultyTarget\":\"…\",\"weight\":…,\"relatedRq\":\"RQ1\"}]"}）</p>
            <textarea rows={4} style={{ width: "100%", fontSize: 11 }} placeholder='[{ "objective": "辨識危險情境", "domain": "危險知覺", "cognitiveLevel": "應用", "numItems": 10, "itemType": "SCENARIO", "difficultyTarget": "中等", "weight": 0.5, "relatedRq": "RQ1" }]' value={string(mapDrafts.blueprintTos)} onChange={(e) => setMapDrafts((d) => ({ ...d, blueprintTos: e.target.value }))} />
            <input style={{ fontSize: 11, width: "100%", marginTop: 4 }} placeholder="藍圖名稱（例：VR 危險知覺知識測驗藍圖）" value={string(mapDrafts.blueprintName)} onChange={(e) => setMapDrafts((d) => ({ ...d, blueprintName: e.target.value }))} />
            <button type="button" className="primary-button" style={{ marginTop: 6 }} disabled={busy === "save-test-blueprint"} onClick={() => { const parsed = JSON.parse(string(mapDrafts.blueprintTos) || "[]"); void action("save-test-blueprint", { blueprint: { name: string(mapDrafts.blueprintName) || "未命名藍圖", tableOfSpecifications: Array.isArray(parsed) ? parsed : [], supportedItemTypes: ["MCQ", "SCENARIO"] }, items: [] }, "測驗藍圖已儲存（題項難度/鑑別度 NOT_YET_TESTED）。").catch(() => setError("藍圖 JSON 格式錯誤")); }}>建立測驗藍圖</button>
          </div>
          <div className="v13-panel" style={{ padding: 12, marginTop: 8 }}>
            <p className="section-kicker">SKILL / PERFORMANCE RUBRIC（評量 JSON：{"[{\"behavior\":\"可觀察行為\",\"criteria\":…,\"anchor1\":\"…\",\"anchor4\":\"…\"}]"}）</p>
            <textarea rows={4} style={{ width: "100%", fontSize: 11 }} placeholder='[{ "behavior": "緊急煞車前先掃視後照鏡", "scoreLevels": ["未出現", "偶爾", "大部分", "一貫"], "anchorDescription": { "0": "無掃視動作", "3": "每次煞車前均掃視" } }]' value={string(mapDrafts.skillCriteria)} onChange={(e) => setMapDrafts((d) => ({ ...d, skillCriteria: e.target.value }))} />
            <input style={{ fontSize: 11, width: "100%", marginTop: 4 }} placeholder="評量名稱" value={string(mapDrafts.skillName)} onChange={(e) => setMapDrafts((d) => ({ ...d, skillName: e.target.value }))} />
            <button type="button" className="primary-button" style={{ marginTop: 6 }} disabled={busy === "save-skill"} onClick={() => { try { const parsed = JSON.parse(string(mapDrafts.skillCriteria) || "[]"); void action("save-skill", { skill: { name: string(mapDrafts.skillName) || "未命名技能評量", criteria: Array.isArray(parsed) ? parsed : [], interRaterPlan: "INTER_RATER_RELIABILITY_PLAN（Pilot 後才產生真實一致性）" } }, "技能評量已儲存。"); } catch { setError("JSON 格式錯誤"); } }}>建立技能／行為評量</button>
          </div>
          <div className="v13-panel" style={{ padding: 12, marginTop: 8 }}>
            <p className="section-kicker">INTERVIEW / OBSERVATION（問題 JSON：{"[{\"questionId\":\"Q1\",\"question\":\"…\",\"probes\":[\"…\"],\"purpose\":\"…\",\"relatedRq\":\"RQ1\",\"sensitiveFlag\":false}]"}）</p>
            <select style={{ fontSize: 11 }} value={string(mapDrafts.qualKind, "INTERVIEW_GUIDE")} onChange={(e) => setMapDrafts((d) => ({ ...d, qualKind: e.target.value }))}>{["INTERVIEW_GUIDE", "FOCUS_GROUP_GUIDE", "OBSERVATION_PROTOCOL", "REFLECTION_LOG", "OPEN_QUESTIONNAIRE", "DOCUMENT_REVIEW_GUIDE"].map((k) => <option key={k} value={k}>{k}</option>)}</select>
            <textarea rows={4} style={{ width: "100%", fontSize: 11, marginTop: 4 }} placeholder='[{ "questionId": "Q1", "question": "…", "probes": [], "purpose": "…", "relatedRq": "RQ1", "sensitiveFlag": false }]' value={string(mapDrafts.qualGuide)} onChange={(e) => setMapDrafts((d) => ({ ...d, qualGuide: e.target.value }))} />
            <button type="button" className="primary-button" style={{ marginTop: 6 }} disabled={busy === "save-qualitative"} onClick={() => { try { const parsed = JSON.parse(string(mapDrafts.qualGuide) || "[]"); void action("save-qualitative", { instrument: { kind: string(mapDrafts.qualKind, "INTERVIEW_GUIDE"), title: string(mapDrafts.qualKind, "訪談大綱"), guide: Array.isArray(parsed) ? parsed : [] } }, "訪談/觀察工具已儲存；敏感題自動轉倫理檢查。"); } catch { setError("JSON 格式錯誤"); } }}>建立訪談／觀察大綱</button>
          </div>
        </div>
      )}

      {tab === "sensors" && (
        <div>
          <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">數位事件與系統日誌字典</p>
            <p className="v13-muted" style={{ fontSize: 10 }}>例如 Scenario Start／Hazard Click／Incorrect Decision／Reaction Time／Completion Time／AI Interaction…（需與 Data Management Plan 一致）</p>
            <textarea rows={4} style={{ width: "100%", fontSize: 11 }} placeholder='[{ "eventId": "HAZARD_CLICK", "eventName": "危險點擊", "definition": "…", "valueType": "count", "unit": "次", "relatedRq": "RQ1", "timePoint": "介入期間" }]' value={string(mapDrafts.eventDefs)} onChange={(e) => setMapDrafts((d) => ({ ...d, eventDefs: e.target.value }))} />
            <button type="button" className="secondary-button" style={{ marginTop: 6 }} onClick={() => { try { const parsed = JSON.parse(string(mapDrafts.eventDefs) || "[]"); for (const row of Array.isArray(parsed) ? parsed : []) void action("save-event", { event: row }); setNotice("Log 字典已儲存。"); } catch { setError("JSON 格式錯誤"); } }}>儲存 Log 字典</button>
          </div>
          <div className="v13-panel" style={{ padding: 12, marginTop: 8 }}><p className="section-kicker">SENSOR SPECIFICATION（device_status 預設 PLANNED；未測試不得宣稱穩定）</p>
            <textarea rows={4} style={{ width: "100%", fontSize: 11 }} placeholder='[{ "sensorKey": "EYE_TRACKING_1", "device": "…", "manufacturer": "…", "model": "…", "measuredSignal": "凝視點", "samplingRate": "120Hz", "relatedRq": "RQ1" }]' value={string(mapDrafts.sensorDefs)} onChange={(e) => setMapDrafts((d) => ({ ...d, sensorDefs: e.target.value }))} />
            <button type="button" className="secondary-button" style={{ marginTop: 6 }} onClick={() => { try { const parsed = JSON.parse(string(mapDrafts.sensorDefs) || "[]"); for (const row of Array.isArray(parsed) ? parsed : []) void action("save-sensor", { sensor: { ...row, deviceStatus: "PLANNED" } }); setNotice("感測器規格已儲存（device_status=PLANNED）。"); } catch { setError("JSON 格式錯誤"); } }}>儲存感測器規格</button>
          </div>
        </div>
      )}

      {tab === "intervention" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>介入與控制材料：控制組若缺控制類型或與實驗組差異不清 → CONTROL_CONDITION_CONFOUNDING_RISK。介入研究需 Fidelity Plan。</p>
          <div className="v13-panel" style={{ padding: 12, marginTop: 8 }}>
            <select style={{ fontSize: 11 }} value={string(mapDrafts.matType, "INTERVENTION")} onChange={(e) => setMapDrafts((d) => ({ ...d, matType: e.target.value }))}><option value="INTERVENTION">INTERVENTION 介入</option><option value="CONTROL">CONTROL 控制組</option></select>
            <input style={{ fontSize: 11, width: "100%", marginTop: 4 }} placeholder="名稱" value={string(mapDrafts.matName)} onChange={(e) => setMapDrafts((d) => ({ ...d, matName: e.target.value }))} />
            {string(mapDrafts.matType) === "CONTROL" && <select style={{ fontSize: 11, width: "100%", marginTop: 4 }} value={string(mapDrafts.controlKind, "usual_practice")} onChange={(e) => setMapDrafts((d) => ({ ...d, controlKind: e.target.value }))}>{["usual_practice", "active_control", "waitlist", "alternative_instruction", "placebo_or_sham", "no_intervention", "matched_exposure"].map((k) => <option key={k} value={k}>{k}</option>)}</select>}
            <button type="button" className="primary-button" style={{ marginTop: 6 }} disabled={busy === "save-intervention"} onClick={() => void action("save-intervention", { material: { name: string(mapDrafts.matName), materialType: string(mapDrafts.matType, "INTERVENTION"), controlKind: string(mapDrafts.controlKind), objective: "（待填）" } }, "介入/控制材料已登錄。")}>儲存</button>
          </div>
          <div className="v13-panel" style={{ padding: 12, marginTop: 8 }}><p className="section-kicker">介入忠實度計畫</p>
            <textarea rows={3} style={{ width: "100%", fontSize: 11 }} placeholder='{ "interventionManual": "…", "instructorTraining": "…", "deliveryChecklist": ["…"], "adherenceMeasure": "…", "deviationRule": "…", "fidelityThreshold": "…" }' value={string(mapDrafts.fidelity)} onChange={(e) => setMapDrafts((d) => ({ ...d, fidelity: e.target.value }))} />
            <button type="button" className="secondary-button" style={{ marginTop: 6 }} onClick={() => { try { const parsed = JSON.parse(string(mapDrafts.fidelity) || "{}"); void action("save-fidelity", { materialId: string((data?.interventions ?? [])[0]?.id, ""), plan: parsed }); } catch { setError("JSON 格式錯誤"); } }}>儲存 Fidelity Plan</button>
          </div>
        </div>
      )}

      {tab === "schedule" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>Schedule of Activities：每個活動連結 Arm／Time Point／Instrument／責任角色／時長／產生資料／倫理需求／負擔／完成規則。有 Retention 需求（如 30 天追蹤）時必須有 Follow-up 時點。</p>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{(data?.schedules ?? []).map((s) => <div key={string(s.id)} className="v13-panel" style={{ padding: 8, fontSize: 12 }}><strong>{string(s.activity)}</strong> ｜ {string(s.study_arm) || "—"} ｜ {string(s.time_point) || "—"} ｜ 工具：{string(s.instrument_link_id) || "—"}</div>)}</div>
          <div className="v13-panel" style={{ padding: 12, marginTop: 8 }}>
            <textarea rows={4} style={{ width: "100%", fontSize: 11 }} placeholder='[{ "activity": "Baseline Questionnaire", "timePoint": "T0", "instrumentLinkId": "…", "responsibleRole": "研究助理", "duration": "20 分鐘", "dataGenerated": "量表分數" }, { "activity": "Follow-up 30 天", "timePoint": "T2" }]' value={string(mapDrafts.scheduleRows)} onChange={(e) => setMapDrafts((d) => ({ ...d, scheduleRows: e.target.value }))} />
            <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => { try { const parsed = JSON.parse(string(mapDrafts.scheduleRows) || "[]"); for (const row of Array.isArray(parsed) ? parsed : []) void action("save-schedule", { row }); setNotice("Schedule 已儲存。"); } catch { setError("JSON 格式錯誤"); } }}>儲存 Schedule 活動</button>
          </div>
        </div>
      )}

      {tab === "schema" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>Data Capture Schema：未來資料欄位字典。Analysis Plan 所需變數若未定義 → ANALYSIS_VARIABLE_NOT_CAPTURED。此結構將成為後續 Data Dictionary Draft。</p>
          <div style={{ display: "grid", gap: 4, marginTop: 8 }}>{(data?.fields ?? []).map((f) => <div key={string(f.id)} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid #eef2ef" }}><code>{string(f.variable_name)}</code> ｜ {string(f.construct) || "—"} ｜ {string(f.data_type) || "—"} ｜ {string(f.time_point) || "—"} ｜ v{num(f.version)}</div>)}</div>
          <div className="v13-panel" style={{ padding: 12, marginTop: 8 }}>
            <textarea rows={4} style={{ width: "100%", fontSize: 11 }} placeholder='[{ "variableName": "hazard_click_count", "construct": "危險知覺", "dataType": "integer", "unit": "次", "timePoint": "介入期間", "personallyIdentifiable": false }]' value={string(mapDrafts.fieldDefs)} onChange={(e) => setMapDrafts((d) => ({ ...d, fieldDefs: e.target.value }))} />
            <button type="button" className="primary-button" style={{ marginTop: 6 }} onClick={() => { try { const parsed = JSON.parse(string(mapDrafts.fieldDefs) || "[]"); for (const row of Array.isArray(parsed) ? parsed : []) void action("save-data-field", { field: row }); setNotice("Data Capture Schema 已儲存。"); } catch { setError("JSON 格式錯誤"); } }}>儲存資料欄位</button>
          </div>
        </div>
      )}

      {tab === "protocol" && (
        <div>
          <div className="research-actions" style={{ flexWrap: "wrap", marginBottom: 8 }}>
            <button type="button" className="primary-button" disabled={busy === "generate-protocol"} onClick={() => void action("generate-protocol", {}, "Protocol 自動草稿已建立（僅安全可衍生區塊；其餘待研究者填寫）。")}>產生 Study Protocol Draft</button>
            <button type="button" className="secondary-button" onClick={() => void action("run-ethics-alignment", {}, "Ethics Alignment 已執行。")}>執行 Ethics Alignment Check</button>
            <button type="button" className="secondary-button" onClick={() => void action("run-analysis-alignment", {}, "Analysis Alignment 已執行。")}>執行 Analysis Alignment Check</button>
            <button type="button" className="primary-button" disabled={busy === "approve-gate"} onClick={() => void action("approve-gate", {}, "INSTRUMENTS_AND_PROTOCOL_APPROVED（Gate 全過）。解鎖 Pilot 中心（Pilot 啟動仍須倫理核准＋計畫核定）。")}>核准工具與 Protocol（Gate 全過時）</button>
            <button type="button" className="secondary-button" disabled={busy === "write-blueprint-v4"} onClick={() => void action("write-blueprint-v4", {}, "Research Blueprint Protocol-Ready 已回寫（新版本，不覆蓋既有版）。")}>回寫 Blueprint v4 Protocol-Ready</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{PROTOCOL_SECTION_KEYS.map((k) => <button key={k} type="button" className={activeSectionKey === k ? "primary-button" : "secondary-button"} style={{ padding: "3px 8px", fontSize: 10 }} onClick={() => { setActiveSectionKey(k); const s = latestSections[k]; if (s && typeof s === "object") { const textVal = (s as Record<string, unknown>).text; if (typeof textVal === "string") setProtocolSections((d) => ({ ...d, [k]: d[k] ?? textVal })); } }}>{k}</button>)}</div>
          <div className="v13-panel" style={{ padding: 12 }}>
            <p className="section-kicker">{activeSectionKey} · Protocol v{data?.protocol?.currentVersion ?? 0}（{data?.protocol?.status ?? "NOT_STARTED"}）</p>
            <textarea rows={10} style={{ width: "100%", fontSize: 12 }} value={protocolSections[activeSectionKey] ?? string((() => { const s = latestSections[activeSectionKey]; return s && typeof s === "object" ? (s as Record<string, unknown>).text : ""; })())} onChange={(e) => setProtocolSections((d) => ({ ...d, [activeSectionKey]: e.target.value }))} placeholder={`撰寫 ${activeSectionKey} 區塊…（引用既有 Versioned Records：Design／Analysis／Instrument／Ethics／DMP／Prereg 版本；不複製成孤島）`} />
            <button type="button" className="primary-button" style={{ marginTop: 6 }} disabled={busy === "save-protocol-section"} onClick={() => void action("save-protocol-section", { sectionId: activeSectionKey, content: { text: protocolSections[activeSectionKey] ?? "" } }, "Protocol 區塊已儲存（新版本，原版本保留）。")}>儲存此區塊（新版本）</button>
          </div>
        </div>
      )}

      {tab === "align" && (
        <div>
          <div className="research-actions" style={{ gap: 6, marginBottom: 8 }}><button type="button" className="secondary-button" onClick={() => void action("run-ethics-alignment", {}, "Ethics Alignment 已執行。")}>Ethics Alignment</button><button type="button" className="secondary-button" onClick={() => void action("run-analysis-alignment", {}, "Analysis Alignment 已執行。")}>Analysis Alignment</button></div>
          <div style={{ display: "grid", gap: 6 }}>{(data?.alignmentResults ?? []).map((r) => <div key={string(r.id)} className="v13-panel" style={{ padding: 10, borderLeft: r.status === "FAIL" ? "3px solid #c0392b" : r.status === "WARN" ? "3px solid #9b5d16" : "3px solid var(--teal)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: 12 }}>{r.checkType === "ETHICS" ? "Protocol–Ethics Alignment" : "Instrument–Protocol–Analysis Alignment"}</strong><span className="v13-badge">{r.status} ｜ FATAL {r.fatalCount} ｜ MAJOR {r.majorCount}</span></div>
            {r.results && Array.isArray(r.results) && (r.results as Record<string, unknown>[]).map((f) => <p key={string(f.code)} style={{ fontSize: 11, margin: "4px 0" }}><strong>[{string(f.severity)}] {string(f.code)}</strong>：{string(f.message)}</p>)}
            <p className="v13-muted" style={{ fontSize: 10 }}>檢查時間：{string(r.checkedAt)}</p>
          </div>)}
          {(data?.alignmentResults ?? []).length === 0 && <p className="v13-muted">尚未執行 Alignment 檢查（FATAL 存在時不得核准 Protocol）。</p>}
          </div>
        </div>
      )}

      {tab === "readiness" && (
        <div>
          <div className="research-actions" style={{ gap: 6, marginBottom: 8 }}><button type="button" className="primary-button" disabled={busy === "run-pilot-readiness"} onClick={() => void action("run-pilot-readiness", {}, "Pilot Readiness 已重新計算。")}>建立 Pilot Readiness Package</button></div>
          <div className="v13-panel" style={{ padding: 12 }}><p className="section-kicker">前導就緒度</p><strong style={{ fontSize: 16 }}>{data?.readiness?.overall ?? "NOT_READY"}</strong><p className="v13-muted" style={{ fontSize: 11 }}>READY 不表示可正式收集研究資料；啟動 Pilot 仍須：正式倫理核准／正式豁免確認、計畫核定、工具授權、Protocol 鎖定、Pilot Gate。</p>
            <div style={{ display: "grid", gap: 4, marginTop: 8 }}>{(data?.readiness?.items ?? []).map((item) => <div key={string(item.key)} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "4px 0", borderBottom: "1px solid #eef2ef" }}><span><strong>[{string(item.status)}]</strong> {string(item.label)}</span><span className="v13-muted" style={{ fontSize: 10 }}>{string(item.detail)}</span></div>)}</div>
          </div>
        </div>
      )}

      {tab === "versions" && (
        <div>
          <p className="v13-muted" style={{ fontSize: 11 }}>Protocol 版本（append-only；核准後修改建立新版本並標 AMENDMENT 需求；原版本保留）。</p>
          <div style={{ display: "grid", gap: 4, marginTop: 8 }}>{(data?.protocolVersions ?? []).map((v) => <div key={string(v.id)} style={{ fontSize: 12, padding: "4px 0", borderBottom: "1px solid #eef2ef" }}><strong>v{num(v.version)}</strong> ｜ {string(v.versionLabel)} ｜ {string(v.reason)} ｜ {string(v.createdAt)}</div>)}</div>
        </div>
      )}
    </div>
  );
}
