"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { S0_FIELD_LABELS, S0_FIELD_NAMES, type S0FieldName } from "@/lib/s0-fields";
import {
  V2_BETA2_CONTRACT_VERSION,
  V2_BETA2_MATERIAL_KINDS,
  V2_BETA2_OUTPUT_TARGETS,
  beta2CanonicalJson,
  createV2Beta2Material,
  createV2Beta2Source,
  type V2Beta2MaterialKind,
  type V2Beta2ResponseEnvelope,
} from "@/lib/v2-beta2/contracts";
import { createV2Beta2ClientTransport, V2Beta2ClientError } from "@/lib/v2-beta2/client-transport";
import { V2_BETA2_ACCEPTANCE_CONTROLS } from "@/lib/v2-beta2/product-acceptance";
import styles from "../v2-beta1/v2-beta1.module.css";
import beta2Styles from "./v2-beta2.module.css";

type MaterialDraft = { materialId: string; kind: V2Beta2MaterialKind; title: string; content: string };
type AppliedAssistIds = Record<S0FieldName, string | null>;

function emptyAppliedAssistIds(): AppliedAssistIds {
  return Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, null])) as AppliedAssistIds;
}

const LANE_LABELS = {
  EVIDENCE_FIRST: "證據校準",
  BALANCED_RECOMMENDED: "平衡推薦",
  FRONTIER_INNOVATION: "前沿探索",
} as const;

function newAuthority(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function errorMessage(error: unknown) {
  if (error instanceof V2Beta2ClientError) {
    if (error.code === "beta2_stale_project_head") return "專案已在另一個工作階段更新，請重新載入後再操作。";
    if (error.code === "beta2_submission_in_progress") return "同一階段正在處理；系統不會建立第二次提交。";
    if (error.code === "beta2_provider_terminal_rejected") return "提供者已明確拒絕此階段；結果未保存，系統不會重新提交。";
    if (error.code === "not_found") return "找不到可存取的專案。";
    return `目前無法完成：${error.code}`;
  }
  return "目前無法完成；沒有自動重送。";
}

export function V2Beta2ResearchOS({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const transport = useMemo(() => createV2Beta2ClientTransport(projectId), [projectId]);
  const [state, setState] = useState<V2Beta2ResponseEnvelope | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [entryMode, setEntryMode] = useState<"KEYWORD" | "PARTIAL_MATERIAL">("KEYWORD");
  const [direction, setDirection] = useState("生成式回饋如何透過證據校準影響高等教育學習者的自我調節與任務表現");
  const [outputTarget, setOutputTarget] = useState<(typeof V2_BETA2_OUTPUT_TARGETS)[number]>("SSCI");
  const [materials, setMaterials] = useState<MaterialDraft[]>([{ materialId: "beta2-material-01", kind: "RESULTS", title: "結果", content: "" }]);
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [s0Draft, setS0Draft] = useState<Partial<Record<S0FieldName, string>>>({});
  const [appliedAssistOptionIds, setAppliedAssistOptionIds] = useState<AppliedAssistIds>(emptyAppliedAssistIds);
  const [s0Undo, setS0Undo] = useState<Partial<Record<S0FieldName, { value: string; optionId: string | null }>>>({});
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const nextMaterialOrdinal = useRef(2);

  const snapshot = state?.project.snapshot ?? null;
  const selectedDirection = snapshot?.directions.find((item) => item.directionId === selectedDirectionId)
    ?? snapshot?.directions.find((item) => item.directionId === snapshot.selectedDirectionId)
    ?? null;
  const completeS0Draft = selectedDirection
    ? Object.fromEntries(S0_FIELD_NAMES.map((field) => [field, s0Draft[field] ?? selectedDirection.s0[field]])) as Record<S0FieldName, string>
    : null;
  const workspaceAlreadyConfirmed = snapshot?.confirmedWorkspace && completeS0Draft
    ? snapshot.confirmedWorkspace.selectedDirectionId === selectedDirectionId
      && beta2CanonicalJson(snapshot.confirmedWorkspace.s0) === beta2CanonicalJson(completeS0Draft)
      && beta2CanonicalJson(snapshot.confirmedWorkspace.appliedAssistOptionIds) === beta2CanonicalJson(appliedAssistOptionIds)
    : false;

  useEffect(() => {
    if (snapshot?.contentHash) resultHeading.current?.focus();
  }, [snapshot?.contentHash]);

  useEffect(() => {
    let active = true;
    void transport.resume().then((result) => {
      if (!active) return;
      setState(result);
      const selected = result.project.snapshot?.directions.find((item) => item.directionId === result.project.snapshot?.selectedDirectionId);
      setSelectedDirectionId(selected?.directionId ?? "");
      setS0Draft(result.project.snapshot ? { ...result.project.snapshot.s0Summary } : {});
      setAppliedAssistOptionIds(result.project.snapshot?.confirmedWorkspace?.appliedAssistOptionIds ?? emptyAppliedAssistIds());
      setAnnouncement(result.project.stageOutcome?.status === "REJECTED" ? "已恢復明確拒絕的 durable 結果；生成重送保持停用。" : result.project.reconciliation ? "此專案有待核對結果；重送已停用。" : result.project.snapshot ? "已從 durable snapshot 恢復專案。" : "可開始第一個 durable 研究階段。");
    }).catch((cause) => active && setError(errorMessage(cause))).finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [transport]);

  function applySnapshot(result: V2Beta2ResponseEnvelope, message: string) {
    setState(result);
    const selected = result.project.snapshot?.directions.find((item) => item.directionId === result.project.snapshot?.selectedDirectionId) ?? null;
    setSelectedDirectionId(selected?.directionId ?? "");
    setS0Draft(result.project.snapshot ? { ...result.project.snapshot.s0Summary } : {});
    setAppliedAssistOptionIds(result.project.snapshot?.confirmedWorkspace?.appliedAssistOptionIds ?? emptyAppliedAssistIds());
    setS0Undo({});
    setAnnouncement(message);
  }

  async function generate() {
    if (!state || busy || state.project.reconciliation || state.project.stageOutcome?.status === "REJECTED") return;
    setBusy(true);
    setError("");
    try {
      const sourceMaterials = entryMode === "PARTIAL_MATERIAL"
        ? materials.map((item) => createV2Beta2Material(item))
        : [];
      const source = createV2Beta2Source({ entryMode, researchDirection: direction.trim(), outputTarget, materials: sourceMaterials });
      const result = await transport.mutate({
        contractVersion: V2_BETA2_CONTRACT_VERSION,
        operation: "GENERATE_DURABLE_CORE",
        projectId,
        requestId: newAuthority("beta2-request"),
        idempotencyKey: newAuthority("beta2-idempotency"),
        baseRevision: state.project.revision,
        baseContentHash: state.project.contentHash,
        source,
      });
      applySnapshot(result, result.project.reconciliation ? "提供者結果待核對；系統已永久停止此階段的生成重送。" : "三個方向與完整 13 欄已原子保存。正式研究寫入仍為 0。");
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof V2Beta2ClientError && cause.terminalOutcome) applySnapshot(cause.terminalOutcome, "提供者已明確拒絕；沒有成功畫面，也不會自動重送。");
      else setAnnouncement("操作未完成；沒有自動重送。");
    } finally {
      setBusy(false);
    }
  }

  async function saveSelection() {
    if (!state || !snapshot || !selectedDirection || selectedDirection.directionId === snapshot.selectedDirectionId || busy
      || state.project.reconciliation !== null || state.project.stageOutcome?.status !== "COMPLETE") return;
    setBusy(true);
    setError("");
    try {
      const result = await transport.mutate({
        contractVersion: V2_BETA2_CONTRACT_VERSION,
        operation: "SAVE_DIRECTION_SELECTION",
        projectId,
        requestId: newAuthority("beta2-selection-request"),
        idempotencyKey: newAuthority("beta2-selection-idempotency"),
        baseRevision: state.project.revision,
        baseContentHash: state.project.contentHash,
        selectedDirectionId: selectedDirection.directionId,
      });
      applySnapshot(result, "方向選擇已保存為新 durable snapshot；提供者呼叫增量為 0。");
    } catch (cause) {
      setError(errorMessage(cause));
      setAnnouncement("選擇未保存；沒有呼叫提供者。");
    } finally {
      setBusy(false);
    }
  }

  async function reconcile() {
    const pending = state?.project.reconciliation;
    if (!state || !pending || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await transport.mutate({ contractVersion: V2_BETA2_CONTRACT_VERSION, operation: "RECONCILE_UNKNOWN", projectId, requestId: newAuthority("beta2-reconcile-request"), jobId: pending.jobId });
      applySnapshot(result, result.project.reconciliation ? "非生成式 lookup 仍未確定結果；重送保持停用。" : "已由原始 receipt lookup 完成核對；生成提交增量為 0。");
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof V2Beta2ClientError && cause.terminalOutcome) applySnapshot(cause.terminalOutcome, "非生成式核對確認拒絕；沒有成功畫面，也不會生成重送。");
      else setAnnouncement("核對未完成；沒有生成重送。");
    } finally {
      setBusy(false);
    }
  }

  async function saveConfirmedWorkspace() {
    if (!state || !snapshot || !selectedDirection || !completeS0Draft || busy || workspaceAlreadyConfirmed
      || selectedDirection.directionId !== snapshot.selectedDirectionId
      || state.project.reconciliation !== null || state.project.stageOutcome?.status !== "COMPLETE") return;
    setBusy(true);
    setError("");
    try {
      const result = await transport.mutate({
        contractVersion: V2_BETA2_CONTRACT_VERSION,
        operation: "SAVE_CONFIRMED_WORKSPACE",
        projectId,
        requestId: newAuthority("beta2-workspace-request"),
        idempotencyKey: newAuthority("beta2-workspace-idempotency"),
        baseRevision: state.project.revision,
        baseContentHash: state.project.contentHash,
        selectedDirectionId: selectedDirection.directionId,
        s0Summary: completeS0Draft,
        appliedAssistOptionIds,
      });
      applySnapshot(result, "已確認並持久保存 13 欄與 Assist 套用狀態；提供者呼叫增量為 0。");
    } catch (cause) {
      setError(errorMessage(cause));
      setAnnouncement("確認狀態未保存；沒有呼叫提供者。");
    } finally {
      setBusy(false);
    }
  }

  function chooseDirection(directionId: string) {
    const next = snapshot?.directions.find((item) => item.directionId === directionId);
    if (!next) return;
    const durableConfirmation = snapshot?.confirmedWorkspace?.selectedDirectionId === directionId
      ? snapshot.confirmedWorkspace
      : null;
    setSelectedDirectionId(directionId);
    setS0Draft({ ...(durableConfirmation?.s0 ?? next.s0) });
    setAppliedAssistOptionIds(durableConfirmation?.appliedAssistOptionIds ?? emptyAppliedAssistIds());
    setS0Undo({});
    setAnnouncement("已在畫面切換方向；尚未保存，也沒有呼叫提供者。");
  }

  function applyAssist(field: S0FieldName, optionId: string, value: string) {
    setS0Undo((current) => ({ ...current, [field]: { value: s0Draft[field] ?? selectedDirection?.s0[field] ?? "", optionId: appliedAssistOptionIds[field] } }));
    setS0Draft((current) => ({ ...current, [field]: value }));
    setAppliedAssistOptionIds((current) => ({ ...current, [field]: optionId }));
    setAnnouncement(`${S0_FIELD_LABELS[field]}已套用於本機預覽；沒有新增 POST。`);
  }

  function addMaterial() {
    const ordinal = nextMaterialOrdinal.current;
    nextMaterialOrdinal.current += 1;
    const materialId = `beta2-material-${String(ordinal).padStart(2, "0")}`;
    setMaterials((current) => [...current, { materialId, kind: "NOTE", title: `材料 ${ordinal}`, content: "" }]);
  }

  function undoAssist(field: S0FieldName) {
    const prior = s0Undo[field];
    if (prior === undefined) return;
    setS0Draft((current) => ({ ...current, [field]: prior.value }));
    setAppliedAssistOptionIds((current) => ({ ...current, [field]: prior.optionId }));
    setS0Undo((current) => { const next = { ...current }; delete next[field]; return next; });
    setAnnouncement(`${S0_FIELD_LABELS[field]}已復原；沒有新增 POST。`);
  }

  return <div className={styles.app} data-testid="beta2-app" data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.projectWorkspace}>
    <a href="#beta2-main" className={styles.skipLink}>跳至主要內容</a>
    <header className={styles.topbar}>
      <div className={styles.wordmark}><span>老麥</span><strong>Research OS · Beta2 Durable Core</strong></div>
      <div className={styles.projectMeta}><span>{projectTitle}</span><strong data-testid="beta2-persistence-badge" data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.reloadResume}>{state?.project.stageOutcome?.status === "REJECTED" ? "REJECTED" : state?.project.reconciliation ? "RECONCILE REQUIRED" : snapshot?.confirmedWorkspace ? "CONFIRMED" : snapshot ? "SAVED" : "READY"}</strong></div>
    </header>
    <div className={styles.workspace}>
      <nav className={`${styles.sidebar} ${beta2Styles.sidebar}`} aria-label="Beta2 durable 研究階段">
        <p className={styles.navEyebrow}>Durable project</p>
        <ul>
          <li><button className={styles.navActive} type="button"><span>01</span><strong>研究來源</strong><small>keyword / partial materials</small></button></li>
          <li><button type="button"><span>02</span><strong>三個方向</strong><small>一次本機受控生成提交</small></button></li>
          <li><button type="button"><span>03</span><strong>保存與恢復</strong><small>disposable PostgreSQL</small></button></li>
        </ul>
        <div className={`${styles.identity} ${beta2Styles.identity}`}><span>麥</span><div><strong>Real local authenticated session</strong><small>受限 PostgreSQL、非 live generation、非 UAT</small></div></div>
      </nav>
      <main id="beta2-main" className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Beta2 durable vertical slice</p>
          <h1>一次提交，持久保存。</h1>
          <p>先保存意圖，再建立唯一 submission receipt；未知結果只允許 receipt lookup，永不自動重送。</p>
          <div className={styles.stagePill}><span>Revision {state?.project.revision ?? "—"}</span><strong>正式研究寫入 0</strong></div>
        </section>
        {busy && !state ? <p className={styles.loading} role="status">正在載入 durable project…</p> : null}
        {error ? <p className={styles.error} role="alert" data-testid="beta2-error">{error}</p> : null}
        {state && !snapshot && state.project.reconciliation === null && state.project.stageOutcome?.status !== "REJECTED" ? <section className={styles.startCard} aria-labelledby="beta2-start-heading">
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>唯一生成階段</p><h2 id="beta2-start-heading">建立 durable research core</h2></div><span>sourceStrategy=NONE</span></div>
          <fieldset className={styles.choiceGroup} data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.materialMode}><legend>來源模式</legend><label><input type="radio" name="beta2-entry" value="KEYWORD" checked={entryMode === "KEYWORD"} onChange={() => setEntryMode("KEYWORD")} /> 關鍵字</label><label><input type="radio" name="beta2-entry" value="PARTIAL_MATERIAL" checked={entryMode === "PARTIAL_MATERIAL"} onChange={() => setEntryMode("PARTIAL_MATERIAL")} /> 部分材料</label></fieldset>
          <label className={styles.inputLabel} htmlFor="beta2-direction">研究關鍵字或方向</label><textarea id="beta2-direction" data-testid="beta2-research-direction" rows={3} value={direction} onChange={(event) => setDirection(event.target.value)} />
          <div className={styles.formGrid}><label>成果路徑<select data-testid="beta2-output-target" value={outputTarget} onChange={(event) => setOutputTarget(event.target.value as typeof outputTarget)}>{V2_BETA2_OUTPUT_TARGETS.map((item) => <option key={item}>{item}</option>)}</select></label></div>
          {entryMode === "PARTIAL_MATERIAL" ? <section className={styles.materialStack} aria-labelledby="beta2-materials-heading"><div className={styles.sectionHead}><h3 id="beta2-materials-heading">依序保留的材料</h3><button type="button" onClick={addMaterial}>新增材料</button></div>{materials.map((material, index) => { const kindId = `beta2-material-kind-${material.materialId}`; const titleId = `beta2-material-title-${material.materialId}`; const contentId = `beta2-material-content-${material.materialId}`; return <fieldset className={styles.materialCard} key={material.materialId} data-testid="beta2-material" data-acceptance-id={`${V2_BETA2_ACCEPTANCE_CONTROLS.materialItem}:${material.materialId}`}><legend>材料 {index + 1}</legend><label htmlFor={kindId}>種類</label><select id={kindId} aria-label={`材料 ${index + 1} 種類`} data-acceptance-id={`${V2_BETA2_ACCEPTANCE_CONTROLS.materialKind}:${material.materialId}`} value={material.kind} onChange={(event) => setMaterials((current) => current.map((item) => item.materialId === material.materialId ? { ...item, kind: event.target.value as V2Beta2MaterialKind } : item))}>{V2_BETA2_MATERIAL_KINDS.map((kind) => <option key={kind}>{kind}</option>)}</select><label htmlFor={titleId}>標題</label><input id={titleId} aria-label={`材料 ${index + 1} 標題`} data-acceptance-id={`${V2_BETA2_ACCEPTANCE_CONTROLS.materialTitle}:${material.materialId}`} value={material.title} onChange={(event) => setMaterials((current) => current.map((item) => item.materialId === material.materialId ? { ...item, title: event.target.value } : item))} /><label htmlFor={contentId}>原始內容</label><textarea id={contentId} aria-label={`材料 ${index + 1} 原始內容`} data-acceptance-id={`${V2_BETA2_ACCEPTANCE_CONTROLS.materialContent}:${material.materialId}`} rows={4} value={material.content} onChange={(event) => setMaterials((current) => current.map((item) => item.materialId === material.materialId ? { ...item, content: event.target.value } : item))} />{materials.length > 1 ? <button type="button" onClick={() => setMaterials((current) => current.filter((item) => item.materialId !== material.materialId))}>移除</button> : null}</fieldset>; })}</section> : null}
          <button className={styles.primaryAction} data-testid="beta2-generate" data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.generate} type="button" disabled={busy || direction.trim().length < 2 || (entryMode === "PARTIAL_MATERIAL" && materials.some((item) => !item.content.trim()))} onClick={() => void generate()}>{busy ? "處理中…" : "建立並持久保存"}</button>
        </section> : null}
        {state?.project.reconciliation ? <section className={styles.timelineCard} data-testid="beta2-reconciliation" data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.reconciliation}><h2>結果待核對</h2><p>此 stage 已有 submission_started receipt。系統只會查詢原 receipt，不會再次生成。</p><button className={styles.primaryAction} type="button" disabled={busy} onClick={() => void reconcile()}>執行非生成式核對</button></section> : null}
        {state?.project.stageOutcome?.status === "REJECTED" ? <section className={styles.timelineCard} data-testid="beta2-terminal-rejected"><h2>此階段已被拒絕</h2><p>durable terminal event 已保存。這不是成功或已保存狀態；系統不會重新提交。</p></section> : null}
        {snapshot && selectedDirection ? <section className={styles.journeyCard} data-testid="beta2-durable-snapshot" aria-labelledby="beta2-directions-heading">
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>已保存 durable snapshot</p><h2 ref={resultHeading} tabIndex={-1} id="beta2-directions-heading">三個專業方向</h2></div><span>{snapshot.source.outputTarget}</span></div>
          <section aria-labelledby="beta2-material-coverage-heading" data-testid="beta2-material-coverage"><h3 id="beta2-material-coverage-heading">材料證據邊界</h3><ul>{Object.entries(snapshot.source.materialCoverage).map(([kind, coverage]) => <li key={kind}><strong>{kind}</strong>：{coverage === "PROVIDED_UNVERIFIED" ? "已提供、尚未驗證" : "缺少（不會補造或提升為觀察證據）"}</li>)}</ul></section>
          <ul className={styles.directionGrid} data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.directionList}>{snapshot.directions.map((item) => <li key={item.directionId}><button type="button" data-testid={`beta2-direction-${item.lane}`} data-acceptance-id={`${V2_BETA2_ACCEPTANCE_CONTROLS.direction}:${item.lane}`} aria-label={`${LANE_LABELS[item.lane]}研究方向${item.recommended ? "（推薦）" : ""}`} aria-pressed={item.directionId === selectedDirection.directionId} onClick={() => chooseDirection(item.directionId)}><span>{LANE_LABELS[item.lane]}{item.recommended ? " · 推薦" : ""}</span><strong>{item.title}</strong><small>{item.researchQuestion}</small></button></li>)}</ul>
          <article className={styles.directionDetail}><h3>{selectedDirection.title}</h3><dl><div><dt>研究問題</dt><dd>{selectedDirection.researchQuestion}</dd></div><div><dt>作用機制</dt><dd>{selectedDirection.mechanism}</dd></div><div><dt>方法</dt><dd>{selectedDirection.method}</dd></div><div><dt>貢獻</dt><dd>{selectedDirection.contribution}</dd></div></dl></article>
          <button className={styles.primaryAction} data-testid="beta2-save-selection" data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.saveSelection} type="button" disabled={busy || state?.project.reconciliation !== null || state?.project.stageOutcome?.status !== "COMPLETE" || selectedDirection.directionId === snapshot.selectedDirectionId} onClick={() => void saveSelection()}>保存方向選擇</button>
          <details className={styles.allFields} data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.s0} open><summary>完整 13 欄 S0</summary><dl>{S0_FIELD_NAMES.map((field) => <div key={field}><dt>{S0_FIELD_LABELS[field]}</dt><dd data-testid={`beta2-s0-${field}`} data-acceptance-id={`${V2_BETA2_ACCEPTANCE_CONTROLS.s0}:${field}`}>{s0Draft[field] ?? selectedDirection.s0[field]}</dd></div>)}</dl></details>
          <details className={styles.assistPanel} data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.assist}><summary>13 欄 Field Assist（三案）</summary>{S0_FIELD_NAMES.map((field) => <article key={field} data-testid={`beta2-assist-${field}`} data-acceptance-id={`${V2_BETA2_ACCEPTANCE_CONTROLS.assist}:${field}`}><div><h3>{S0_FIELD_LABELS[field]}</h3><p>{s0Draft[field] ?? selectedDirection.s0[field]}</p>{s0Undo[field] !== undefined ? <button type="button" onClick={() => undoAssist(field)}>復原此欄</button> : null}</div><ul>{selectedDirection.fieldAssist[field].map((option) => <li key={option.optionId} data-testid="beta2-assist-option"><strong>{option.strategy}{option.recommended ? " · 推薦" : ""}</strong><p>{option.text}</p><small>理由：{option.rationale}</small><small>風險：{option.risk}</small><button type="button" onClick={() => applyAssist(field, option.optionId, option.applyValue)}>{field === "domain" || field === "outputTrack" ? "保留權威建議" : "套用至預覽"}</button></li>)}</ul></article>)}</details>
          <button className={styles.primaryAction} data-testid="beta2-save-workspace" data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.saveWorkspace} type="button" disabled={busy || workspaceAlreadyConfirmed || selectedDirection.directionId !== snapshot.selectedDirectionId || state?.project.reconciliation !== null || state?.project.stageOutcome?.status !== "COMPLETE"} onClick={() => void saveConfirmedWorkspace()}>{workspaceAlreadyConfirmed ? "13 欄與 Assist 已確認保存" : "確認並保存 13 欄與 Assist"}</button>
          <article className={styles.finalArtifact} data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.humanGate} aria-labelledby="beta2-human-gate-heading"><h3 id="beta2-human-gate-heading">人讀研究成果與 Human Gate</h3><pre className={styles.humanDraft} tabIndex={0} data-testid="beta2-human-readable-artifact">{snapshot.humanReadableArtifact.markdown}</pre></article>
        </section> : null}
        {state ? <section className={styles.truthCard}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>Persistence authority</p><h2>保存狀態</h2></div><span className={styles.zeroWrite}>正式寫入 0</span></div><dl className={styles.truthGrid}><div><dt>Project</dt><dd>{state.project.projectId}</dd></div><div><dt>Revision</dt><dd>{state.project.revision}</dd></div><div><dt>Durability</dt><dd>{state.durabilityClass}</dd></div><div><dt>Stage outcome</dt><dd data-testid="beta2-stage-outcome">{state.project.stageOutcome?.status ?? "NONE"}</dd></div><div><dt>Workspace confirmation</dt><dd data-testid="beta2-workspace-confirmation">{snapshot?.confirmedWorkspace ? "CONFIRMED" : "UNCONFIRMED"}</dd></div><div><dt>Provider submission delta</dt><dd data-testid="beta2-provider-delta">{state.providerSubmissionDelta}</dd></div></dl></section> : null}
      </main>
      <aside className={`${styles.chat} ${beta2Styles.chat}`} aria-labelledby="beta2-boundary-heading"><div className={styles.chatHead}><div><span aria-hidden="true">麥</span><div><strong id="beta2-boundary-heading">可信邊界</strong><small>Local A1 only</small></div></div></div><div className={styles.messages}><article className={styles.mikeMessage}><p>目前只使用本機 deterministic fixture 與 loopback disposable database；未連接任何 live generation、hosted database 或背景工作服務。</p></article>{snapshot ? <article className={styles.insight}><p className={styles.eyebrow}>Durable receipt</p><h3>Submission count {snapshot.providerSubmissionCount}</h3><p>選擇保存與 Field Assist 預覽不會建立第二次生成提交。</p></article> : null}</div></aside>
    </div>
    <p className={styles.live} role="status" aria-live="polite" aria-atomic="true" data-testid="beta2-live" data-acceptance-id={V2_BETA2_ACCEPTANCE_CONTROLS.status}>{announcement}</p>
  </div>;
}
