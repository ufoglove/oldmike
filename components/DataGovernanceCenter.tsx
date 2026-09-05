"use client";

import { useCallback, useEffect, useState } from "react";

type AnyRow = Record<string, unknown>;
type Data = AnyRow & { ok?: boolean; locked?: boolean; missing?: string[]; status?: string; gates?: Record<string, boolean>; quality?: { total_score?: number; status?: string } | null; study?: { id?: string; status?: string } | null; protocol?: { status?: string; version?: number } | null; dictionary?: { total?: number; approved?: number }; mappings?: { total?: number; approved?: number }; cleanDatasetStatus?: string; analysisDatasetStatus?: string; rawAssetCount?: number; quarantineCount?: number; openCriticalQueries?: number; preregistration?: { status?: string } | null; accessPolicies?: AnyRow[]; cleaningRules?: AnyRow[] };
type Lists = AnyRow & { ok?: boolean; catalog?: AnyRow[]; variables?: AnyRow[]; mappings?: AnyRow[]; deidRuns?: AnyRow[]; rules?: AnyRow[]; quarantines?: AnyRow[]; adjudications?: AnyRow[]; duplicates?: AnyRow[]; missing?: AnyRow[]; outliers?: AnyRow[]; inclusions?: AnyRow[]; scorings?: AnyRow[]; derived?: AnyRow[]; longitudinal?: AnyRow[]; harmonization?: AnyRow[]; sensorRuns?: AnyRow[]; logRuns?: AnyRow[]; transcripts?: AnyRow[]; aiDatasets?: AnyRow[]; cohorts?: AnyRow[]; cleanDatasets?: AnyRow[]; analysisDatasets?: AnyRow[]; lockRecords?: AnyRow[]; lineage?: AnyRow[]; qualityRuns?: AnyRow[]; reports?: AnyRow[]; handoffs?: AnyRow[]; snapshots?: AnyRow[]; reviews?: AnyRow[] };
const string = (v: unknown, fb = ""): string => typeof v === "string" ? v : fb;
const bool = (v: unknown): boolean => v === true || v === "true";
const count = (rows?: unknown[]): number => rows?.length ?? 0;
const join = (rows: AnyRow[] | undefined, keys: string[], empty = "—"): string => (rows ?? []).map((r) => keys.map((k) => string(r[k])).filter(Boolean).join("@")).join(" ｜ ") || empty;
type Tab = "overview" | "audit" | "catalog" | "dictionary" | "mapping" | "deid" | "queries" | "duplicates" | "missing" | "outlier" | "scoring" | "longitudinal" | "sensor" | "qualitative" | "ai" | "clean" | "analysis" | "quality" | "lineage" | "lock" | "versions";

export default function DataGovernanceCenter({ projectId, onNavigate }: { projectId: string; onNavigate?: (navId: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [lists, setLists] = useState<Lists | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const setD = (k: string, v: unknown) => setDrafts((d) => ({ ...d, [k]: v }));

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/data-governance`, { cache: "no-store" });
      const json = await res.json() as Data;
      if (!res.ok || json.ok === false) throw new Error(string(json.error || "無法載入資料治理中心。"));
      setData(json);
      if (!json.locked) {
        const lr = await fetch(`/api/projects/${encodeURIComponent(projectId)}/data-governance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lists" }) });
        const lj = await lr.json() as Lists;
        if (lr.ok && lj.ok !== false) setLists(lj);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "載入失敗。"); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  async function action(name: string, body: Record<string, unknown>, success?: string) {
    setError(""); setBusy(name);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/data-governance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, ...body }) });
      const payload = await res.json() as { ok?: boolean; error?: string; failed?: AnyRow[] };
      if (!res.ok || payload.ok === false) {
        const reason = (payload.failed ?? []).map((f) => `${string(f.label)}（${string(f.detail)}）`).join("；");
        throw new Error(reason ? `${payload.error || "條件未滿足"}\n${reason}` : (payload.error || "操作失敗。"));
      }
      if (success) setNotice(success);
      await load();
      return payload;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失敗。"); return null; } finally { setBusy(""); }
  }
  function parseJson(key: string): Record<string, unknown> | null { try { const v = JSON.parse(string(drafts[key])); if (v && typeof v === "object" && !Array.isArray(v)) return v; setError("請輸入 JSON 物件"); return null; } catch { setError("JSON 格式錯誤"); return null; } }
  function parseArr(key: string): unknown[] | null { try { const v = JSON.parse(string(drafts[key])); if (Array.isArray(v)) return v; setError("請輸入 JSON 陣列"); return null; } catch { setError("JSON 格式錯誤"); return null; } }
  const jsonBox = (key: string, ph: string, rows = 2) => <textarea rows={rows} style={{ width: "100%", fontSize: 11 }} placeholder={ph} value={string(drafts[key])} onChange={(e) => setD(key, e.target.value)} />;
  const small = (key: string, ph: string, w = 150) => <input style={{ fontSize: 11, width: w }} placeholder={ph} value={string(drafts[key])} onChange={(e) => setD(key, e.target.value)} />;
  const cta = (label: string, fn: () => void, primary = true) => <button type="button" className={primary ? "primary-button" : "secondary-button"} onClick={fn}>{label}</button>;
  const sub = (title: string, children: React.ReactNode) => <div className="v13-subsection"><p className="section-kicker">{title}</p>{children}</div>;
  const hint = (t: string) => <p className="v13-muted" style={{ fontSize: 10, margin: "3px 0" }}>{t}</p>;
  const runJson = (key: string, name: string, success: string, bodyKey: string, extra?: Record<string, unknown>) => { const o = parseJson(key); if (o) void action(name, { ...(extra ?? {}), [bodyKey]: o }, success); };

  // AI_PROPOSED 草稿複核區（Data Access 角色矩陣＋Cleaning Rule Registry）——locked 亦可先行核准，Raw 鏈到位即用
  const prefillReview = (data?.accessPolicies?.length || data?.cleaningRules?.length) ? (
    <div className="v13-subsection" style={{ marginTop: 8 }}>
      <p className="section-kicker">AI_PROPOSED 草稿複核（先行核准，Raw 鏈到位即用）</p>
      <p className="v13-muted" style={{ fontSize: 10, margin: "2px 0 4px" }}>以下為依 Data Capture Schema／治理規格預填之草稿（DRAFT）；核准後方列入正式政策/規則。所有草稿均標 AI_PROPOSED，需研究者逐項複核。</p>
      {data?.accessPolicies?.length ? <div style={{ marginBottom: 6 }}>{data.accessPolicies.map((p) => (
        <div key={string(p.zone)} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", margin: "3px 0" }}>
          <span className="v13-badge">{string(p.zone)}</span>
          <span style={{ fontSize: 10 }}>Policy {string(p.policyVersion)}｜Status：{string(p.status)}</span>
          {string(p.status) === "DRAFT" ? cta("核准此區矩陣", () => void action("approve-access-policy", { zone: string(p.zone) }, `${string(p.zone)} 角色矩陣已核准。`), false) : null}
        </div>
      ))}</div> : null}
      {data?.cleaningRules?.length ? <div>{data.cleaningRules.map((r) => (
        <div key={string(r.ruleId)} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", margin: "3px 0" }}>
          <span className="v13-badge">{string(r.ruleType)}</span>
          <span style={{ fontSize: 10 }}>{string(r.ruleId)}｜{string(r.ruleName)}｜Severity：{string(r.severity)}｜Status：{string(r.status)}</span>
          {string(r.status) === "DRAFT" ? cta("核准規則", () => void action("approve-cleaning-rule", { ruleId: string(r.ruleId) }, `${string(r.ruleId)} 已核准（ACTIVE）。`), false) : null}
        </div>
      ))}</div> : null}
      <p className="v13-muted" style={{ fontSize: 10, marginTop: 4 }}>核准僅改變政策/規則狀態，不會解鎖治理中心（解鎖仍需 Raw Data Lock 鏈完成）。</p>
    </div>
  ) : null;

  // AI_PROPOSED 草稿複核區（Data Access 角色矩陣＋Cleaning Rule Registry）——locked 亦可先行核准，Raw 鏈到位即用
  if (loading) return <div className="v13-panel" style={{ marginTop: 10 }}><p className="v13-muted">載入中…</p></div>;
  if (data?.locked) {
    return <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">資料治理與分析資料集 · 11</p><h3>資料治理、資料清理與 Analysis Dataset 中心</h3></div></div>
      <div className="v13-empty"><strong>DATA_GOVERNANCE_CENTER_LOCKED</strong><ul>{(data.missing ?? []).map((m) => <li key={m}>{m}</li>)}</ul><p>正式資料治理需在 Raw Data Lock（RAW_DATA_LOCKED_AND_HANDOFF_READY）之後才能啟動；不得跳過 Raw Lock 直接建立 Analysis Dataset。</p>{onNavigate ? <button type="button" className="primary-button" style={{ marginTop: 10 }} onClick={() => onNavigate("execution")}>前往正式研究與資料蒐集（完成 Raw Lock）→</button> : null}</div>
      {prefillReview}
    </div>;
  }
  const gates = data?.gates ?? {};
  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "總覽" }, { id: "audit", label: "Raw 稽核" }, { id: "catalog", label: "Data Catalog" }, { id: "dictionary", label: "Data Dictionary" },
    { id: "mapping", label: "欄位映射" }, { id: "deid", label: "去識別化" }, { id: "queries", label: "Query/裁決" }, { id: "duplicates", label: "重複值" },
    { id: "missing", label: "Missing" }, { id: "outlier", label: "Outlier" }, { id: "scoring", label: "計分/衍生" }, { id: "longitudinal", label: "縱貫/多場域" },
    { id: "sensor", label: "Sensor/Log" }, { id: "qualitative", label: "質性語料" }, { id: "ai", label: "AI Dataset" }, { id: "clean", label: "Clean Dataset" },
    { id: "analysis", label: "Analysis Dataset" }, { id: "quality", label: "品質報告" }, { id: "lineage", label: "Lineage" }, { id: "lock", label: "Freeze/Lock/Handoff" },
    { id: "versions", label: "版本/簽核" },
  ];
  const TabBar = <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "8px 0" }}>{TABS.map((t) => <button key={t.id} type="button" className={tab === t.id ? "primary-button" : "secondary-button"} style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>;

  return (
    <div className="v13-panel" style={{ marginTop: 10 }}>
      <div className="v13-panel-head"><div><p className="section-kicker">資料治理與分析資料集 · 11</p><h3>資料治理、資料清理與 Analysis Dataset 中心</h3></div><p className="v13-panel-note">Raw Data 永不覆寫；清理/排除皆留紀錄；本階段不輸出 p-value／Effect Size／Hypothesis Support。</p></div>
      {error && <p className="v13-error">{error}</p>}{notice && <p className="v13-notice">{notice}</p>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        <span className="v13-badge">Status：{string(data?.status, "NOT_STARTED")}</span>
        <span className="v13-badge">Raw Assets：{data?.rawAssetCount ?? 0}</span>
        <span className="v13-badge">Quarantine：{data?.quarantineCount ?? 0}</span>
        <span className="v13-badge">CRITICAL Queries：{data?.openCriticalQueries ?? 0}</span>
        <span className="v13-badge">Dictionary：{data?.dictionary?.approved ?? 0}/{data?.dictionary?.total ?? 0} APPROVED</span>
        <span className="v13-badge">Mapping：{data?.mappings?.approved ?? 0}/{data?.mappings?.total ?? 0} APPROVED</span>
        <span className="v13-badge">Clean：{string(data?.cleanDatasetStatus, "NOT_CREATED")}</span>
        <span className="v13-badge">Analysis：{string(data?.analysisDatasetStatus, "NOT_CREATED")}</span>
        <span className="v13-badge">DQ：{data?.quality ? `${data.quality.total_score ?? "—"}（${string(data.quality.status)}）` : "未評"}</span>
      </div>
      {TabBar}

      {tab === "overview" && <div style={{ display: "grid", gap: 6 }}>
        {prefillReview}
        {sub("STAGE GATES（由 Data Manager／Statistician／PI 核准）", <div className="research-actions" style={{ gap: 6, flexWrap: "wrap" }}>
          {!gates.DATA_GOVERNANCE_AND_SCHEMA_APPROVED && cta("核准 Gate1：治理與 Schema", () => void action("approve-gate", { gateType: "DATA_GOVERNANCE_AND_SCHEMA_APPROVED" }, "Gate1 已核准。"))}
          {gates.DATA_GOVERNANCE_AND_SCHEMA_APPROVED && !gates.CLEAN_DATASET_VALIDATED && cta("核准 Gate2：Clean Dataset 驗證", () => void action("approve-gate", { gateType: "CLEAN_DATASET_VALIDATED" }, "Gate2 已核准。"))}
          {gates.CLEAN_DATASET_VALIDATED && !gates.ANALYSIS_DATASET_V1_LOCKED_AND_ANALYSIS_READY && cta("核准 Gate3：Analysis Dataset v1 Locked", () => void action("approve-gate", { gateType: "ANALYSIS_DATASET_V1_LOCKED_AND_ANALYSIS_READY" }, "Gate3 已核准（Analysis Lab Execution Mode 解鎖）。"))}
        </div>)}
        {sub("DATA ZONES（全站一致分層）", <p style={{ fontSize: 11, margin: 0 }}><code>Restricted Identity</code>｜<code>Raw Data</code>（不可變）｜<code>Staging</code>｜<code>Quarantine</code>｜<code>Clean Data</code>｜<code>Derived/Feature</code>｜<code>Analysis Data</code>｜<code>Export/Sharing</code>——Pilot／Synthetic／Formal 完全分離；PII 不得進入 Clean／Analysis Dataset。</p>)}
        {sub("NEXT BEST ACTION（單一）", <p style={{ fontSize: 11, margin: 0 }}>{data?.status === "LOCKED" ? "先完成 Raw Data Lock。" : data?.cleanDatasetStatus === "NOT_CREATED" ? "執行 Raw Data Audit → 建立 Data Catalog → 核對 Data Dictionary → 欄位映射。" : data?.analysisDatasetStatus === "NOT_CREATED" ? "定義 Analysis Cohort → 建立 Analysis Dataset v1.0。" : data?.analysisDatasetStatus === "LOCKED" ? (onNavigate ? "Analysis Dataset v1.0 已鎖定：前往分析實驗室執行正式分析 →" : "Analysis Dataset v1.0 已鎖定：前往分析實驗室執行正式分析。") : "完成 Quality Report／Lineage／Handoff → Data Manager、Statistician、PI 簽核後 Lock。"}</p>)}
        {data?.analysisDatasetStatus === "LOCKED" && onNavigate && <div style={{ marginTop: 6 }}>{cta("→ 前往分析實驗室（12）執行正式分析", () => onNavigate("analysis-lab"), true)}</div>}
      </div>}

      {tab === "audit" && <div>{sub("Raw Data Integrity Audit", <div className="research-actions" style={{ gap: 6 }}>{cta("執行 Raw Data Audit", () => void action("run-raw-audit", {}, "Raw 稽核完成（Checksum/隔離/Query 檢查）。"))}</div>)}
        <p className="v13-muted" style={{ fontSize: 10, marginTop: 4 }}>此步驟確認：Raw 全數 LOCKED、Checksum 齊全、無 Pilot/Synthetic 混入、無未處理 CRITICAL Query。</p></div>}

      {tab === "catalog" && <div>{sub("Data Catalog（逐資產：來源／格式／Checksum／敏感度／存取等級）", <div>
        {jsonBox("catalogJson", '[{ "dataAssetId": "raw_p01_t1_scale", "sourceType": "QUESTIONNAIRE", "sourceSystem": "VR 平台", "rawFileReference": "raw/…", "format": "csv", "checksum": "sha256:…", "sensitivityClassification": "INTERNAL", "accessLevel": "RESTRICTED", "owner": "PI", "steward": "DM" }]', 3)}
        <div style={{ marginTop: 4 }}>{cta("批次登錄 Catalog", () => { const a = parseArr("catalogJson"); if (a) for (const i of a) void action("save-catalog", { item: i }); setNotice("Catalog 已儲存。"); }, false)}</div>
        {hint(join(lists?.catalog, ["dataAssetId", "sourceType", "checksum"]))}
      </div>)}</div>}

      {tab === "dictionary" && <div>{sub("Canonical Data Dictionary（變數註冊＋APPROVED）", <div>
        {jsonBox("varJson", '{ "canonicalName": "hazard_detection_total", "displayLabel": "危險辨識得分", "variableRole": "OUTCOME", "dataType": "numeric", "sourceAsset": "raw_p01_t1_scale", "sourceField": "score", "piiFlag": false, "timePoint": "T1", "missingCodes": ["-999"], "scoringRule": "依 Scoring Spec v1" }', 3)}
        <div style={{ marginTop: 4 }}>{cta("註冊/更新變數", () => runJson("varJson", "save-variable", "變數已註冊。", "variable"), false)} {cta("字典快照（append-only）", () => void action("snapshot-dictionary", {}, "字典快照已建立。"), false)}</div>
        {hint(`已註冊 ${count(lists?.variables)} 筆｜${join(lists?.variables?.slice(0, 8), ["canonicalName", "status"])}${count(lists?.variables) > 8 ? "…" : ""}`)}
        {sub("變數核准", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{small("apprVar", "canonical_name", 260)}{cta("核准變數", () => void action("approve-variable", { canonicalName: drafts.apprVar }, "變數已核准。"), false)}</div>)}
      </div>)}
        {sub("SCHEMA_MAPPING_QUERY 原則", <p style={{ fontSize: 11, margin: 0 }}>實際欄位與 Data Capture Schema 不符時不得靜默改名或猜測——建立 Query 或標記 SCHEMA_MAPPING_QUERY。</p>)}
      </div>}

      {tab === "mapping" && <div>{sub("Source-to-Canonical Mapping（高風險映射需 Data Manager 核准）", <div>
        {jsonBox("mapJson", '{ "sourceAssetId": "raw_p01_t1_scale", "sourceFieldName": "score", "canonicalName": "hazard_detection_total", "sourceDataType": "text", "targetDataType": "numeric", "transformation": "cast + trim", "codeMapping": {}, "mappingStatus": "DRAFT", "verifiedBy": "" }', 3)}
        <div style={{ marginTop: 4 }}>{cta("建立/更新映射", () => runJson("mapJson", "save-mapping", "映射已儲存（無目標變數時顯示 SCHEMA_MAPPING_QUERY）。", "mapping"), false)}</div>
        {hint(`映射 ${count(lists?.mappings)} 筆｜${join(lists?.mappings?.slice(0, 6), ["sourceAsset", "sourceField", "status"])}`)}
        {sub("映射核准", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{small("mapAsset", "source_asset_id", 220)}{small("mapField", "source_field_name", 180)}{small("mapBy", "approved_by（DM）", 140)}{cta("核准映射", () => void action("approve-mapping", { sourceAssetId: drafts.mapAsset, sourceFieldName: drafts.mapField, approvedBy: drafts.mapBy }, "映射已核准。"), false)}</div>)}
      </div>)}</div>}

      {tab === "deid" && <div>{sub("De-identification Plan", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {small("deidMethod", "method（PSEUDONYMIZATION/TOKENIZATION/…）", 240)} {small("deidTrans", "transformation_version", 170)} {small("deidRiskA", "risk_before", 120)} {small("deidRiskB", "risk_after", 120)} {small("deidReviewer", "reviewer", 130)} {small("deidApproval", "approval", 130)}
        {cta("記錄 De-identification Run", () => void action("run-deidentification", { run: { method: drafts.deidMethod, transformationVersion: drafts.deidTrans, riskBefore: drafts.deidRiskA, riskAfter: drafts.deidRiskB, reviewer: drafts.deidReviewer, approval: drafts.deidApproval, status: "REVIEW_REQUIRED" } }, "De-identification Run 已記錄。"), false)}
      </div>)}
        {hint(`Runs：${join(lists?.deidRuns, ["method", "status", "reviewer"])}`)}
        <p className="v13-muted" style={{ fontSize: 10 }}>Identity Mapping Key 不得放入 Clean/Analysis Dataset；音視訊採 Restricted Access；每次執行記錄方法／欄位／風險前後／審查／殘餘風險。</p>
      </div>}

      {tab === "queries" && <div>{sub("Data Adjudication（延續 Data Query；不得靜默關閉）", <div>
        {jsonBox("adjJson", '{ "issue": "T1 分數 -999 疑為技術失敗", "affectedRecord": "raw_p01_t1_scale/P01", "evidence": "log 顯示中斷", "queryType": "TECHNICAL_FAILURE", "status": "UNDER_REVIEW" }', 3)}
        <div style={{ marginTop: 4 }}>{cta("建立裁決", () => runJson("adjJson", "adjudicate", "裁決已建立。", "adjudication"), false)}</div>
        {hint(join(lists?.adjudications?.slice(0, 6), ["issue", "status"]))}
      </div>)}
        {sub("Quarantine", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {small("qAsset", "source_asset_id", 200)}{small("qReason", "reason_category（CHECKSUM_MISMATCH/…）", 240)}
          {cta("隔離紀錄", () => void action("quarantine", { record: { sourceAssetId: drafts.qAsset, reasonCategory: drafts.qReason, checksumMismatch: true } }, "已隔離（未裁決前不得進 Clean）。"), false)}
        </div>)}
        {hint(`Quarantine：${join(lists?.quarantines, ["asset", "reason", "status"])}`)}
      </div>}

      {tab === "duplicates" && <div>{sub("Duplicate Resolution（不刪除；保留 canonical 與 exclusion flag）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {small("dupCanon", "canonical_record", 200)}{small("dupDup", "duplicate_record", 200)}{small("dupWhy", "duplicate_reason（REPEATED_IMPORT/…）", 220)}
        <select style={{ fontSize: 11 }} value={string(drafts.dupDecision, "RETAIN_CANONICAL")} onChange={(e) => setD("dupDecision", e.target.value)}><option>RETAIN_CANONICAL</option><option>BOTH_RETAINED</option><option>DUPLICATE_EXCLUDED</option></select>
        {cta("裁決 Duplicate", () => void action("resolve-duplicate", { resolution: { canonicalRecord: drafts.dupCanon, duplicateRecord: drafts.dupDup, duplicateReason: drafts.dupWhy, retentionDecision: drafts.dupDecision, adjudicator: "DM" } }, "Duplicate 已裁決。"), false)}
      </div>)}
        {hint(join(lists?.duplicates, ["canonical", "duplicate", "decision"]))}
      </div>}

      {tab === "missing" && <div>{sub("Missing Data 分類（不得全部視為同一種 Missing）", <div>
        {jsonBox("missingJson", '[{ "participantCode": "P01", "variableId": "hazard_detection_total", "timePoint": "T2", "reason": "LOST_TO_FOLLOW_UP" }, { "participantCode": "P02", "variableId": "hr_mean", "timePoint": "T1", "reason": "SENSOR_LOSS" }]', 3)}
        <div style={{ marginTop: 4 }}>{cta("批次分類", () => { const a = parseArr("missingJson"); if (a) void action("classify-missing", { items: a }, "Missing 已分類。"); }, false)}</div>
        {hint(`已分類 ${count(lists?.missing)} 筆｜${join(lists?.missing?.slice(0, 6), ["code", "var", "reason"])}`)}
      </div>)}
        <p className="v13-muted" style={{ fontSize: 10 }}>本階段不執行 Mean Imputation／LOCF／MI——除非 Analysis Plan 已明訂；插補變體另存且保留未插補版本。</p>
      </div>}

      {tab === "outlier" && <div>{sub("Outlier & Anomaly Registry（預設 RETAIN_WITH_FLAG，不靜默刪除）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {small("outTarget", "variable_or_record", 220)}{small("outMethod", "detection_method", 200)}{small("outThr", "threshold", 140)}
        <select style={{ fontSize: 11 }} value={string(drafts.outAction, "RETAIN_WITH_FLAG")} onChange={(e) => setD("outAction", e.target.value)}>{["RETAIN", "RETAIN_WITH_FLAG", "EXCLUDE_FROM_PRIMARY_ANALYSIS", "INCLUDE_IN_SENSITIVITY_ANALYSIS", "QUARANTINE", "SOURCE_CORRECTION_REQUIRED"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
        {cta("標記 Outlier", () => void action("flag-outlier", { flag: { variableOrRecord: drafts.outTarget, detectionMethod: drafts.outMethod, threshold: drafts.outThr, action: drafts.outAction, reviewer: drafts.outReviewer || "待指派" } }, "Outlier 已標記（未刪除）。"), false)}
      </div>)}
        {hint(`Flags：${join(lists?.outliers, ["target", "method", "action"])}`)}
        <p className="v13-muted" style={{ fontSize: 10 }}>所有排除須符合預先定義規則或建立 Analysis Plan Amendment；不得自動刪除。</p>
      </div>}

      {tab === "scoring" && <div>{sub("Scale Scoring（依 Instrument Version＋Scoring Specification）", <div>
        {jsonBox("scoreJson", '{ "instrumentId": "自編 VR 測驗", "instrumentVersion": "v1", "scale": "危險辨識", "subscale": "危險偵測", "sourceItems": ["q1","q2"], "reverseItems": [], "reverseCodingRule": "無反項", "missingItemRule": "依手冊：≥80% 作答才計分", "minimumValidItems": 8, "rawScoreFormula": "sum(items)", "outputVariable": "hazard_detection_total", "scoringVersion": "v1", "status": "PENDING" }', 4)}
        <div style={{ marginTop: 4 }}>{cta("註冊計分規格", () => runJson("scoreJson", "run-scoring", "計分規格已註冊。", "run"), false)}</div>
        {hint(join(lists?.scorings, ["instrument", "output", "status"]))}
      </div>)}
        {sub("Derived Variable Registry（探索性須標 EXPLORATORY）", <div>
          {jsonBox("derivedJson", '{ "variableName": "reaction_time_mean", "description": "平均反應時間", "sourceVariables": ["rt_1","rt_2"], "formulaOrCode": "mean(rt_1, rt_2)", "unit": "ms", "timeWindow": "T1 session", "relatedRq": "RQ1", "exploratory": false }', 3)}
          <div style={{ marginTop: 4 }}>{cta("註冊 Derived Variable", () => runJson("derivedJson", "save-derived", "Derived Variable 已註冊。", "variable"), false)}</div>
          {hint(`Derived：${join(lists?.derived, ["name", "exploratory"])}`)}
        </div>)}
        <p className="v13-muted" style={{ fontSize: 10 }}>不得依 Outcome 反覆嘗試 Feature 選「最顯著」版本；不得宣稱本研究信效度已成立。</p>
      </div>}

      {tab === "longitudinal" && <div>{sub("Longitudinal Linkage（時間點＋window status）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {small("llId", "longitudinal_record_id", 200)}{small("llCode", "participant_code", 150)}{small("llTp", "time_point（T2）", 110)}
        <select style={{ fontSize: 11 }} value={string(drafts.llWin, "IN_WINDOW")} onChange={(e) => setD("llWin", e.target.value)}><option>IN_WINDOW</option><option>OUT_OF_WINDOW</option><option>LATE</option><option>EARLY</option><option>MISSED</option></select>
        {cta("建立 Longitudinal Link", () => void action("save-longitudinal", { link: { longitudinalRecordId: drafts.llId, participantCode: drafts.llCode, timePoint: drafts.llTp, windowStatus: drafts.llWin } }, "Longitudinal Link 已建立。"), false)}
      </div>)}
        {hint(join(lists?.longitudinal, ["id", "code", "tp", "window"]))}
        {sub("Multi-site Harmonization（未完成 Unit/編碼轉換前不得合併）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {small("hsSite", "site（S01）", 100)}{small("hsField", "source_field", 160)}{small("hsCanon", "canonical_field", 160)}{small("hsConv", "conversion", 160)}
          {cta("記錄 Harmonization Rule", () => void action("save-harmonization", { rule: { site: drafts.hsSite, sourceField: drafts.hsField, canonicalField: drafts.hsCanon, conversion: drafts.hsConv, status: "APPROVED" } }, "Harmonization Rule 已存。"), false)}
        </div>)}
        {hint(join(lists?.harmonization, ["site", "field", "flag"]))}
      </div>}

      {tab === "sensor" && <div>{sub("Sensor Processing（Raw 檔不變；Processed 存 Recipe/Code Version）", <div>
        {jsonBox("sensorJson", '{ "rawFileId": "raw_p01_t1_eye", "processingRecipeVersion": "recipe-v1", "steps": ["integrity", "clock_drift", "artifact_flag"], "codeHash": "sha256:…", "qualityReport": { "signalOk": true } }', 3)}
        <div style={{ marginTop: 4 }}>{cta("執行 Sensor Processing", () => runJson("sensorJson", "run-sensor", "Sensor Processing Run 已記錄（Raw 不變）。", "run"), false)}</div>
        {hint(join(lists?.sensorRuns, ["file", "recipe", "status"]))}
      </div>)}
        {sub("Event Log Processing（Feature 可反查原始 Event）", <div>
          {jsonBox("logJson", '{ "batchRef": "elb_p01_t1", "recipeVersion": "log-recipe-v1", "steps": ["schema", "timestamp_normalize", "sequence_validate"], "features": [{ "name": "task_duration_s", "sourceEvents": ["task_start","task_end"] }] }', 3)}
          <div style={{ marginTop: 4 }}>{cta("執行 Log Processing", () => runJson("logJson", "run-eventlog", "Log Processing Run 已記錄。", "run"), false)}</div>
          {hint(join(lists?.logRuns, ["batch", "recipe", "status"]))}
        </div>)}
      </div>}

      {tab === "qualitative" && <div>{sub("Qualitative Corpus 準備（自動轉錄不得標 VERIFIED）", <div>
        {jsonBox("transJson", '{ "sourceRecord": "qual_p01", "guideVersion": "guide-v1", "transcriptStage": "HUMAN_VERIFIED", "transcriptionMethod": "人工核對", "humanVerification": true, "deIdentificationStatus": "APPROVED_FOR_INTERNAL_ANALYSIS", "speakerLabels": true }', 3)}
        <div style={{ marginTop: 4 }}>{cta("記錄 Transcript 進度", () => runJson("transJson", "save-transcript", "Transcript 紀錄已存。", "record"), false)}</div>
        {hint(join(lists?.transcripts, ["source", "stage", "verified"]))}
      </div>)}
        <p className="v13-muted" style={{ fontSize: 10 }}>翻譯草稿不得取代原文；本階段只建立可供後續編碼的 Corpus，不生成 Themes／Findings／Saturation。</p>
      </div>}

      {tab === "ai" && <div>{sub("AI/ML Dataset Governance（Split Unit 防 Leakage）", <div>
        {jsonBox("aiJson", '{ "datasetKey": "ai_vr_train_test", "datasetPurpose": "VR 行為模型", "labelDefinition": "事故風險二元", "splitUnit": "participant", "splitMethod": "random", "randomSeed": "42", "splitManifest": { "train": ["P01","P02"], "validation": ["P03"], "test": ["P04"] } }', 4)}
        <div style={{ marginTop: 4 }}>{cta("註冊 AI Dataset", () => runJson("aiJson", "save-ai-dataset", "AI Dataset 已註冊。", "record"), false)}
        {cta("Leakage 檢查", () => { if (drafts.aiKey) void action("check-ai-leakage", { datasetKey: drafts.aiKey }, "Leakage 檢查完成。"); else setError("請填 datasetKey"); }, false)}</div>
        {small("aiKey", "dataset_key", 260)}
        {hint(join(lists?.aiDatasets, ["key", "unit", "status"]))}
      </div>)}
        <p className="v13-muted" style={{ fontSize: 10 }}>同一 Split Unit 不得跨 Train/Test（DATA_LEAKAGE_BLOCKING_ERROR）；本階段不比較 Model Performance。</p>
      </div>}

      {tab === "clean" && <div>{sub("Analysis Inclusion Flags（不刪除；以 Flag 控制）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {small("incUnit", "participant_or_unit（P01）", 180)}
        <label style={{ fontSize: 11 }}><input type="checkbox" checked={bool(drafts.incITT)} onChange={(e) => setD("incITT", e.target.checked)} /> ITT</label>
        <label style={{ fontSize: 11 }}><input type="checkbox" checked={bool(drafts.incPP)} onChange={(e) => setD("incPP", e.target.checked)} /> Per-Protocol</label>
        {small("incEx", "exclusion_reason", 220)}
        {cta("儲存 Inclusion Decision", () => void action("save-inclusion", { decision: { participantOrUnit: drafts.incUnit, enrolledFlag: true, consentValidFlag: true, eligibilityValidFlag: true, primaryOutcomeAvailable: true, intentionToTreatFlag: bool(drafts.incITT), perProtocolFlag: bool(drafts.incPP), exclusionReason: drafts.incEx, adjudicator: "DM" } }, "Inclusion Decision 已存。"), false)}
      </div>)}
        {hint(`Decisions：${join(lists?.inclusions, ["unit", "reason"])}`)}
        {sub("建立 Clean Dataset（由 Locked Raw＋Pipeline 產生；Flags 取代刪除）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {small("cleanId", "dataset_id（clean_v1）", 180)}{small("cleanVar", "variables JSON 或留空", 240)}
          {cta("建立 Clean Dataset", () => { const extra: Record<string, unknown> = { datasetId: drafts.cleanId || "clean_v1" }; const a = parseArr("cleanVars"); if (a) { extra.variables = a; } void action("build-clean", { params: extra }, "Clean Dataset 已建立（VALIDATION_REQUIRED）。"); }, false)}
          {cta("驗證 Clean Dataset（Data Manager Review）", () => void action("validate-clean", { datasetId: drafts.cleanId || "clean_v1", reviewer: "DM" }, "Clean Dataset 已 VALIDATED（需無 CRITICAL Query／Quarantine 且 Raw 未動）。"), false)}
        </div>)}
        {jsonBox("cleanVars", '["hazard_detection_total","hazard_judgment_total","sa_score","arm"]', 2)}
        {hint(`Clean：${join(lists?.cleanDatasets, ["id", "version", "status"])}`)}
      </div>}

      {tab === "analysis" && <div>{sub("Analysis Cohorts（事後新增須標 POST_HOC）", <div>
        {jsonBox("cohortJson", '{ "cohortId": "itt", "definition": "Intention-to-Treat：所有已 Enroll 且 consent valid", "inclusionRules": ["enrolled_flag=true","consent_valid_flag=true"], "exclusionRules": [], "analysisPlanReference": "AP v1", "preregistrationReference": "PR v3", "approval": "PI/STAT" }', 4)}
        <div style={{ marginTop: 4 }}>{cta("定義 Cohort", () => runJson("cohortJson", "save-cohort", "Cohort 已定義。", "cohort"), false)}</div>
        {hint(`Cohorts：${join(lists?.cohorts, ["id", "definition", "postHoc"])}`)}
      </div>)}
        {sub("建立 Analysis Dataset v1.0（Primary Confirmatory 連結 Prereg/Analysis Plan）", <div>
          {jsonBox("adJson", '{ "datasetId": "ad_v1", "datasetType": "PRIMARY_CONFIRMATORY_DATASET", "datasetName": "Primary Analysis Dataset v1.0", "datasetPurpose": "RQ1 主要分析", "analysisPlanVersion": "AP v1", "cohortDefinition": "itt", "sourceCleanDataset": "clean_v1", "includedVariables": ["participant_code","arm","hazard_detection_total","hazard_judgment_total","sa_score"], "timePoints": ["T1","T2"], "sites": ["S01"], "maskedGroupStatus": "MASKED_LABELS", "missingnessStatus": "CLASSIFIED", "imputationStatus": "NOT_STARTED", "weightingStatus": "NOT_REQUIRED" }', 5)}
          <div style={{ marginTop: 4 }}>{cta("建立 Analysis Dataset", () => runJson("adJson", "build-analysis-dataset", "Analysis Dataset 已建立（VALIDATION_REQUIRED）。", "dataset"), false)}</div>
          {hint(join(lists?.analysisDatasets, ["id", "type", "status", "lock"]))}
        </div>)}
        <p className="v13-muted" style={{ fontSize: 10 }}>Confirmatory 與 Exploratory 分離；Primary Outcome 不存在時 Gate 失敗（included_variables 不得為空）。</p>
      </div>}

      {tab === "quality" && <div>{sub("Data Quality Assessment（內部準備度，不代表結果品質；不顯示組間差異）", <div className="research-actions" style={{ gap: 6 }}>{cta("執行 Data Quality 評分", () => void action("run-quality", {}, "品質評分完成（揭露各項缺漏）。"))}
        {cta("產生 Data Preparation & Governance Report v1.0", () => void action("generate-report", {}, "報告已建立（僅資料準備描述）。"), false)}
        {cta("建立 Research Data Preparation Snapshot v1.0", () => void action("snapshot", {}, "Snapshot 已建立。"), false)}</div>)}
        {hint(`歷次評分：${join(lists?.qualityRuns, ["total", "status"])}｜報告：${join(lists?.reports, ["version"])}`)}
        <p className="v13-muted" style={{ fontSize: 10 }}>不得用總分掩蓋 FATAL 問題；預設不顯示 Primary Outcome 平均值比較／p-value／Effect Size。</p>
      </div>}

      {tab === "lineage" && <div>{sub("Data Lineage（Analysis Variable → Raw Asset／Rule）", <p style={{ fontSize: 11, margin: 0 }}>Lineage edges：{count(lists?.lineage)} 筆。每個 Analysis Variable 皆須反查 Source File／Field／Instrument Version／Transformation Rule／Dataset Version。</p>)}
        <div className="v13-subsection-divider" />
        {sub("Reproducible Pipeline（每步存 input/output 版本與參數）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {small("plKey", "pipeline_key（pipeline_v1）", 200)}{small("plBy", "performed_by（DM）", 150)}
          {cta("執行 Data Preparation Pipeline", () => void action("run-pipeline", { pipelineKey: drafts.plKey || "pipeline_v1", params: { performedBy: drafts.plBy || "DM", inputVersion: "raw-lock-v1" } }, "Pipeline Run 已啟動（步驟紀錄）。"), false)}
        </div>)}
        <p className="v13-muted" style={{ fontSize: 10 }}>Pipeline 支援 Python／R／SQL 等可重現 Script 引用（repository_commit／dependency lock／seed）。</p>
      </div>}

      {tab === "lock" && <div>{sub("Freeze／Lock Analysis Dataset（Lock 前需 Data Manager＋Statistician＋PI 簽核）", <div className="research-actions" style={{ gap: 6, flexWrap: "wrap" }}>
        {small("adLockId", "dataset_id（ad_v1）", 200)}
        {cta("Freeze Analysis Dataset", () => void action("freeze-analysis", { datasetId: drafts.adLockId || "ad_v1" }, "Analysis Dataset 已 Freeze。"))}
        {cta("Lock Analysis Dataset", () => void action("lock-analysis", { datasetId: drafts.adLockId || "ad_v1" }, "Analysis Dataset 已 Lock（13 條件檢查）。"), false)}
      </div>)}
        {hint(`Lock 紀錄：${join(lists?.lockRecords, ["id", "type"])}`)}
        {sub("Dataset Validation Reviews（Data Manager／Statistician／PI／Domain）", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {small("revReviewer", "reviewer", 160)}
          <select style={{ fontSize: 11 }} value={string(drafts.revRole, "DATA_MANAGER")} onChange={(e) => setD("revRole", e.target.value)}><option>DATA_MANAGER</option><option>STATISTICIAN</option><option>PRINCIPAL_INVESTIGATOR</option><option>DOMAIN_REVIEWER</option></select>
          <select style={{ fontSize: 11 }} value={string(drafts.revStatus, "PENDING")} onChange={(e) => setD("revStatus", e.target.value)}><option>PENDING</option><option>APPROVED</option><option>REJECTED</option><option>CHANGES_REQUIRED</option></select>
          {cta("提交簽核", () => void action("save-review", { review: { reviewer: drafts.revReviewer, reviewRole: drafts.revRole, approvalStatus: drafts.revStatus, reviewedVersion: "v1.0" } }, "簽核已提交。"), false)}
        </div>)}
        {hint(`Reviews：${join(lists?.reviews, ["reviewer", "role", "status"])}`)}
        {sub("Analysis Data Handoff Package v1.0（不含未授權 PII）", <div className="research-actions" style={{ gap: 6 }}>{cta("建立 Handoff Package", () => void action("handoff", {}, "Handoff Package 已建立（缺項會列出）。"))}
          {cta("回寫 Blueprint v6 Analysis-Ready", () => void action("blueprint-v6", {}, "Research Blueprint v6 已建立（append-only）。"), false)}</div>)}
        {hint(`Handoff：${join(lists?.handoffs, ["version", "status", "checksum"])}`)}
        <p className="v13-muted" style={{ fontSize: 10 }}>Lock 後不得直接修改；錯誤時建立 Dataset Correction Request 並產生新版本（Lock 紀錄 type=CORRECTION_REQUEST）。</p>
      </div>}

      {tab === "versions" && <div>{sub("版本與 Audit Trail（append-only）", <p style={{ fontSize: 11, margin: 0 }}>Data Dictionary Snapshot、Clean/Analysis Dataset Version、Lock Records、Data Preparation Snapshot、Access Audit 全部以獨立版本與紀錄保存；Raw Data 永不覆寫。</p>)}
        <div className="v13-subsection-divider" />
        {hint(`Snapshots：${join((lists?.snapshots ?? []) as never, ["version", "at"])}｜Access Audit：${join((lists?.accessAudit ?? []) as never, ["role", "action", "zone"])}`)}
        <p className="v13-muted" style={{ fontSize: 10 }}>所有下載／匯出／修改／鎖定／解鎖皆記 Audit Log；不顯示 SIGNIFICANT／EFFECTIVE／SUPPORTED／PROVEN。</p>
      </div>}
    </div>
  );
}
