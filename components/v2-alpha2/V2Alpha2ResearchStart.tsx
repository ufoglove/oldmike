"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { S0_FIELDS, type S0FieldName } from "@/lib/s0-fields";
import type { V2Alpha2FieldAssistArtifact, V2Alpha2JourneySnapshot, V2Alpha2SuggestionOption } from "@/lib/v2-alpha2/contracts";
import styles from "./v2-alpha2.module.css";

const WORKSPACE_AUTHORITY = "fixture-workspace-v2";
const EMPTY_DRAFT = Object.fromEntries(S0_FIELDS.map((field) => [field.name, ""])) as Record<S0FieldName, string>;

function mergeSnapshot(previous: V2Alpha2JourneySnapshot | null, incoming: V2Alpha2JourneySnapshot) {
  if (!previous) return incoming;
  if (previous.journeyRef !== incoming.journeyRef) throw new Error("journey_reference_changed");
  if (previous.stageA && incoming.stageA && previous.stageA.contentHash !== incoming.stageA.contentHash) throw new Error("stage_a_changed");
  if (previous.stageB && incoming.stageB && previous.stageB.contentHash !== incoming.stageB.contentHash) throw new Error("stage_b_changed");
  const rank = { NONE: 0, A: 1, B: 2 } as const;
  return {
    ...incoming,
    lastReadyStage: rank[previous.lastReadyStage] > rank[incoming.lastReadyStage] ? previous.lastReadyStage : incoming.lastReadyStage,
    stageA: incoming.stageA ?? previous.stageA,
    stageB: incoming.stageB ?? previous.stageB,
    selectedCompareDirectionId: incoming.selectedCompareDirectionId ?? previous.selectedCompareDirectionId,
    s0SourceDirectionId: incoming.s0SourceDirectionId ?? previous.s0SourceDirectionId,
  };
}

async function localRequest(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(path, { ...init, headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": WORKSPACE_AUTHORITY, ...init?.headers }, signal: controller.signal, cache: "no-store" });
  } finally { window.clearTimeout(timeout); }
}

function stateCopy(state: V2Alpha2JourneySnapshot["state"] | "IDLE") {
  if (state === "IDLE") return "尚未開始";
  if (state === "QUEUED" || state === "RUNNING") return "老麥正在整理三個研究方向";
  if (state === "STAGE_A_READY" || state === "STAGE_B_QUEUED" || state === "STAGE_B_RUNNING") return "三個方向已完成，正在補齊推薦藍圖";
  if (state === "STAGE_B_READY") return "完整藍圖已可人工審閱";
  if (state === "RECONCILE_REQUIRED") return "處理狀態尚待確認；已完成內容仍保留";
  if (state === "FAILED") return "本次整理未完成；已完成內容仍保留";
  return "本次整理已取消";
}

type AssistState = { field: S0FieldName; assistRef: string | null; artifact: V2Alpha2FieldAssistArtifact | null; status: "REQUESTING" | "PENDING" | "READY" | "ERROR" };

export function V2Alpha2ResearchStart() {
  const [direction, setDirection] = useState("");
  const [journeyRef, setJourneyRef] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<V2Alpha2JourneySnapshot | null>(null);
  const [selectedCompareDirectionId, setSelectedCompareDirectionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<S0FieldName, string>>(EMPTY_DRAFT);
  const [undoDraft, setUndoDraft] = useState<Record<S0FieldName, string> | null>(null);
  const [assist, setAssist] = useState<AssistState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [humanGate, setHumanGate] = useState(false);
  const announcedState = useRef<string | null>(null);
  const loadedStageBHash = useRef<string | null>(null);
  const assistTrigger = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const directions = snapshot?.stageA?.directions ?? [];
  const recommendedId = snapshot?.stageA?.recommendedDirectionId ?? null;
  const selectedDirection = directions.find((item) => item.directionId === selectedCompareDirectionId) ?? directions.find((item) => item.directionId === recommendedId) ?? null;
  const readyCount = snapshot?.stageB ? S0_FIELDS.filter((field) => draft[field.name].trim()).length : 0;

  useEffect(() => {
    const fromUrl = new URL(window.location.href).searchParams.get("journey");
    if (fromUrl) setJourneyRef(fromUrl);
  }, []);

  useEffect(() => {
    if (!journeyRef) return;
    let disposed = false;
    const poll = async () => {
      try {
        const response = await localRequest(`/api/v2-alpha2/journeys/${encodeURIComponent(journeyRef)}`);
        const body = await response.json() as { ok?: boolean; journey?: V2Alpha2JourneySnapshot };
        if (!response.ok || !body.ok || !body.journey) throw new Error("poll_failed");
        if (!disposed) setSnapshot((previous) => mergeSnapshot(previous, body.journey!));
      } catch { if (!disposed) setError("暫時無法更新進度。已完成的方向與草稿不會被清除。"); }
    };
    void poll();
    const interval = window.setInterval(() => { void poll(); }, 280);
    return () => { disposed = true; window.clearInterval(interval); };
  }, [journeyRef]);

  useEffect(() => {
    if (!snapshot || announcedState.current === snapshot.state) return;
    announcedState.current = snapshot.state;
    const copy = stateCopy(snapshot.state);
    setAnnouncement(copy);
    if (!selectedCompareDirectionId && snapshot.stageA) setSelectedCompareDirectionId(snapshot.stageA.recommendedDirectionId);
    if (snapshot.stageB && loadedStageBHash.current !== snapshot.stageB.contentHash) {
      loadedStageBHash.current = snapshot.stageB.contentHash;
      setDraft(snapshot.stageB.fields);
      setUndoDraft(null);
    }
  }, [snapshot, selectedCompareDirectionId]);

  useEffect(() => {
    if (!assist?.assistRef || assist.status === "READY" || assist.status === "ERROR") return;
    let disposed = false;
    const interval = window.setInterval(async () => {
      try {
        const response = await localRequest(`/api/v2-alpha2/assists/${encodeURIComponent(assist.assistRef!)}`);
        const body = await response.json() as { ok?: boolean; assist?: { completionClass: string; artifact: V2Alpha2FieldAssistArtifact | null } };
        if (!response.ok || !body.ok || !body.assist) throw new Error("assist_poll_failed");
        if (body.assist.artifact && !disposed) setAssist((current) => current ? { ...current, status: "READY", artifact: body.assist!.artifact } : null);
        if (body.assist.completionClass === "TERMINAL_REJECTED" || body.assist.completionClass === "COMPLETION_UNKNOWN") if (!disposed) setAssist((current) => current ? { ...current, status: "ERROR" } : null);
      } catch { if (!disposed) setAssist((current) => current ? { ...current, status: "ERROR" } : null); }
    }, 250);
    return () => { disposed = true; window.clearInterval(interval); };
  }, [assist]);

  useEffect(() => {
    if (!assist) return;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>("button,[href],input,textarea,[tabindex]:not([tabindex='-1'])") ?? [];
    focusable[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeAssist(); return; }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [assist?.field]);

  async function startJourney() {
    const normalized = direction.trim();
    if (!normalized) { setError("請先輸入一個研究關鍵字或方向。"); return; }
    setError(null); setSnapshot(null); setHumanGate(false); loadedStageBHash.current = null;
    try {
      const response = await localRequest("/api/v2-alpha2/journeys", { method: "POST", body: JSON.stringify({ contractVersion: "old-mike-v2-alpha2/1.0.0", idempotencyKey: `explicit-${crypto.randomUUID()}`, researchDirection: normalized, sourceStrategy: "NONE" }) });
      const body = await response.json() as { ok?: boolean; journeyRef?: string };
      if (response.status !== 202 || !body.ok || !body.journeyRef) throw new Error("start_failed");
      setJourneyRef(body.journeyRef); setAnnouncement("已送出整理工作，您可以留在本頁查看進度。");
      const url = new URL(window.location.href); url.searchParams.set("journey", body.journeyRef); window.history.replaceState({}, "", url);
    } catch { setError("目前無法開始整理。您的輸入仍保留，系統沒有建立正式研究資料。"); }
  }

  async function cancelJourney() {
    if (!journeyRef || !snapshot?.cancelAllowed) return;
    await localRequest(`/api/v2-alpha2/journeys/${encodeURIComponent(journeyRef)}`, { method: "DELETE", body: "{}" });
  }

  async function openAssist(field: S0FieldName, trigger: HTMLButtonElement) {
    if (!journeyRef || !snapshot?.stageB) return;
    assistTrigger.current = trigger;
    setAssist({ field, assistRef: null, artifact: null, status: "REQUESTING" });
    try {
      const response = await localRequest(`/api/v2-alpha2/journeys/${encodeURIComponent(journeyRef)}/assist`, { method: "POST", body: JSON.stringify({ idempotencyKey: `assist-${crypto.randomUUID()}`, targetField: field, currentValue: draft[field], contextSnapshot: { researchDirection: snapshot.stageA?.researchDirection, selectedDirection: snapshot.stageA?.directions.find((item) => item.directionId === snapshot.s0SourceDirectionId), s0: draft } }) });
      const body = await response.json() as { ok?: boolean; assistRef?: string };
      if (response.status !== 202 || !body.ok || !body.assistRef) throw new Error("assist_start_failed");
      setAssist((current) => current ? { ...current, assistRef: body.assistRef!, status: "PENDING" } : null);
    } catch { setAssist((current) => current ? { ...current, status: "ERROR" } : null); }
  }

  function closeAssist() { setAssist(null); window.setTimeout(() => assistTrigger.current?.focus(), 0); }
  function applySuggestion(option: V2Alpha2SuggestionOption) {
    if (!assist) return;
    setUndoDraft(draft); setDraft({ ...draft, [assist.field]: option.text }); setAnnouncement(`${S0_FIELDS.find((field) => field.name === assist.field)?.label ?? "欄位"}已套用，可復原。`); closeAssist();
  }
  function undo() { if (!undoDraft) return; setDraft(undoDraft); setUndoDraft(null); setAnnouncement("已復原上一次老麥建議。"); }

  const progress = snapshot?.lastReadyStage === "B" ? 2 : snapshot?.lastReadyStage === "A" ? 1 : 0;
  const showInlineNotice = snapshot?.state === "RECONCILE_REQUIRED" || snapshot?.state === "FAILED";
  const publicStatus = useMemo(() => stateCopy(snapshot?.state ?? "IDLE"), [snapshot?.state]);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="#alpha2-main" aria-label="老麥研究作業系統 Alpha2 首頁"><span>老麥</span><small>Research OS · Alpha2</small></a>
      <div className={styles.localBadge}>本機原型 · 不寫入正式研究資料</div>
    </header>

    <section className={styles.hero} id="alpha2-main">
      <p className={styles.eyebrow}>從一個方向，形成可繼續的研究藍圖</p>
      <h1>今天想研究什麼？</h1>
      <p>輸入一個關鍵字或方向。老麥先整理三個可比較方案，再只為推薦方案補齊完整 S0。</p>
      <div className={styles.startRow}>
        <label className={styles.srOnly} htmlFor="alpha2-direction">研究關鍵字或方向</label>
        <textarea id="alpha2-direction" value={direction} onChange={(event) => setDirection(event.target.value)} maxLength={1000} rows={3} placeholder="例如：大學教師如何校準生成式工具的課程使用" />
        <button type="button" onClick={startJourney}>老麥整理研究方向</button>
      </div>
      <p className={styles.boundary}>此階段採概念模式，不查詢外部學術來源；趨勢、引用與正式事實仍需後續證據驗證。</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>

    {journeyRef && <section className={styles.workspace} aria-labelledby="journey-title" data-testid="alpha2-journey" data-last-ready-stage={snapshot?.lastReadyStage ?? "NONE"} data-formal-write-count={snapshot?.formalWriteCount ?? 0}>
      <div className={styles.workspaceHeading}>
        <div><p className={styles.eyebrow}>研究啟動進度</p><h2 id="journey-title">{publicStatus}</h2></div>
        {snapshot?.cancelAllowed && <button className={styles.secondaryButton} type="button" onClick={cancelJourney}>取消尚未送出的工作</button>}
      </div>
      <div className={styles.progressGrid} aria-label="兩階段進度">
        <div className={progress >= 1 ? styles.progressDone : styles.progressActive}><span>01</span><strong>比較三個方向</strong><small>{progress >= 1 ? "已完成" : "整理中"}</small></div>
        <div className={progress >= 2 ? styles.progressDone : progress === 1 ? styles.progressActive : styles.progressWaiting}><span>02</span><strong>補齊推薦藍圖</strong><small>{progress >= 2 ? "已完成" : progress === 1 ? "整理中" : "等待前一步"}</small></div>
      </div>
      {showInlineNotice && <div className={styles.inlineNotice} role="status"><strong>已完成的內容仍保留。</strong><span>目前狀態尚待確認；請使用「查看目前進度」，不要重送或切換服務。</span></div>}

      {directions.length === 3 && <section aria-labelledby="direction-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Discover</p><h3 id="direction-heading">三個研究方向</h3></div><p>切換卡片只改變比較視角，不會再送出工作。</p></div>
        <div className={styles.directionGrid}>
          {directions.map((item) => <button type="button" key={item.directionId} data-lane={item.lane} onClick={() => setSelectedCompareDirectionId(item.directionId)} className={item.directionId === selectedDirection?.directionId ? styles.directionSelected : styles.directionCard} aria-pressed={item.directionId === selectedDirection?.directionId}>
            <span className={styles.laneLabel}>{item.lane === "EVIDENCE_FIRST" ? "證據優先" : item.lane === "BALANCED_RECOMMENDED" ? "平衡推薦" : "前沿創新"}</span>
            {item.directionId === recommendedId && <span className={styles.recommended}>推薦</span>}
            <strong>{item.workingTitle}</strong><span>{item.researchQuestion}</span><small>{item.methodSketch}</small>
          </button>)}
        </div>
        {selectedDirection && <article className={styles.comparison}><h4>{selectedDirection.workingTitle}</h4><dl><div><dt>研究價值</dt><dd>{selectedDirection.researchValue}</dd></div><div><dt>作用機制</dt><dd>{selectedDirection.mechanismTheory}</dd></div><div><dt>可行性與風險</dt><dd>{selectedDirection.feasibilityRisk}</dd></div></dl></article>}
      </section>}

      {snapshot?.stageB && <section className={styles.blueprint} aria-labelledby="blueprint-heading">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Blueprint</p><h3 id="blueprint-heading">完整 S0 草稿 · {readyCount}/13</h3></div><div><span>比較中：{selectedDirection?.workingTitle ?? "—"}</span><span>草稿來源：{directions.find((item) => item.directionId === snapshot.s0SourceDirectionId)?.workingTitle ?? "推薦方向"}</span></div></div>
        <p className={styles.blueprintIntro}>每個欄位都可請老麥提供證據優先、平衡推薦與前沿創新三案。建議只進入本機草稿；整份藍圖最後才進入 Human Gate。</p>
        {undoDraft && <button type="button" className={styles.undoButton} onClick={undo}>復原上一次套用</button>}
        <div className={styles.fieldGrid}>
          {S0_FIELDS.map((field) => <div className={styles.field} key={field.name} data-field={field.name}>
            <div className={styles.fieldHeading}><label htmlFor={`field-${field.name}`}>{field.label}</label><button type="button" aria-haspopup="dialog" aria-expanded={assist?.field === field.name} aria-controls="alpha2-assist" onClick={(event) => void openAssist(field.name, event.currentTarget)}>老麥三案</button></div>
            <textarea id={`field-${field.name}`} value={draft[field.name]} maxLength={field.maxLength} rows={field.name === "workingTitle" || field.name === "domain" || field.name === "outputTrack" ? 2 : 5} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })} />
          </div>)}
        </div>
        <div className={styles.humanGate}><div><strong>Human Gate · 整份藍圖</strong><p>這不是逐欄核准。只有您確認完整 13 欄後，未來才能進入正式專案建立界線。</p></div><label><input type="checkbox" checked={humanGate} onChange={(event) => setHumanGate(event.target.checked)} />我已檢查這份本機草稿</label><button type="button" disabled>正式建立尚未在 Alpha2 啟用</button></div>
      </section>}
    </section>}

    {assist && <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeAssist(); }}>
      <div id="alpha2-assist" className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="assist-title" ref={dialogRef}>
        <div className={styles.drawerHeading}><div><p className={styles.eyebrow}>老麥欄位協助</p><h2 id="assist-title">{S0_FIELDS.find((field) => field.name === assist.field)?.label}</h2></div><button type="button" onClick={closeAssist} aria-label="關閉老麥建議">關閉</button></div>
        {(assist.status === "REQUESTING" || assist.status === "PENDING") && <p role="status" aria-live="polite">正在整理三種策略，原稿保持不變…</p>}
        {assist.status === "ERROR" && <p role="alert">這次建議未完成；原欄位保持不變。若狀態不明，請先查看目前進度。</p>}
        {assist.artifact && <ul className={styles.suggestionList}>{assist.artifact.slots.map((slot) => <li key={slot.strategy}>
          <span>{slot.strategy === "EVIDENCE_FIRST" ? "證據優先" : slot.strategy === "BALANCED_RECOMMENDED" ? "平衡推薦" : "前沿創新"}</span>
          {slot.status === "VALID" ? <><p>{slot.option.text}</p><small>{slot.option.rationale} · {slot.option.boundary === "MISSING_DATA" ? "缺少資料" : "尚未驗證"}</small><button type="button" onClick={() => applySuggestion(slot.option)}>預覽後套用</button></> : <p className={styles.missingOption}>此策略未形成可用建議；其他有效選項仍可使用。</p>}
        </li>)}</ul>}
      </div>
    </div>}
    <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
  </main>;
}
