"use client";

import { useEffect, useId, useRef } from "react";
import { ASSIST_REGISTRY, assistGroupFields, mergeOldMikeAssistGroupPatch, parseOldMikeAssistGroupPatch, parseOldMikeAssistGroupValue, serializeOldMikeAssistGroup, type OldMikeAssistAction, type OldMikeAssistSurface } from "@/lib/old-mike-assist-contract";
import type { ModelModeProfile } from "@/lib/model-mode-contract";
import { S0_FIELD_NAMES } from "@/lib/s0-fields";
import type { S0Intake } from "@/lib/project-contract";
import { useOldMikeAssist } from "@/hooks/useOldMikeAssist";

const ACTION_LABELS: Record<OldMikeAssistAction, string> = {
  SUGGEST: "提供建議", COMPLETE: "補齊草稿", REWRITE: "專業改寫", COMPLETE_ALL_S0: "補齊完整 S0", TRANSLATE: "翻譯", ALIGN_BILINGUAL: "雙語對齊", CRITIQUE: "審慎檢視",
};

export default function OldMikeAssistControl(props: {
  projectId?: string;
  surface: OldMikeAssistSurface;
  targetId?: string;
  groupId?: string;
  wholeS0?: boolean;
  currentValue: string;
  contextSnapshot?: Record<string, unknown>;
  currentProvenance?: "AI_PROPOSED" | "USER_PROVIDED";
  modeProfile?: ModelModeProfile;
  label?: string;
  onApply: (value: string, provenance: "AI_PROPOSED" | "USER_PROVIDED") => boolean | void;
}) {
  const registry = ASSIST_REGISTRY[props.surface];
  const actions = props.wholeS0 ? (["COMPLETE_ALL_S0"] as const) : registry.actions.filter((action) => action !== "COMPLETE_ALL_S0");
  const id = useId().replace(/:/gu, "");
  const dialogId = `old-mike-assist-${id}`;
  const titleId = `${dialogId}-title`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const assist = useOldMikeAssist(props);

  useEffect(() => {
    if (!assist.open) return;
    const dialog = dialogRef.current; const close = closeRef.current;
    if (!dialog || !close) return;
    const frame = requestAnimationFrame(() => close.focus());
    const inerted: Array<{ element: HTMLElement; inert: boolean }> = [];
    let retained: HTMLElement | null = dialog.closest<HTMLElement>(".old-mike-assist-control");
    while (retained?.parentElement && retained.parentElement !== document.body) {
      for (const sibling of retained.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== retained) { inerted.push({ element: sibling, inert: sibling.inert }); sibling.inert = true; }
      }
      retained = retained.parentElement;
    }
    document.documentElement.classList.add("assist-overlay-open");
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); assist.cancel(); triggerRef.current?.focus(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", keydown); inerted.forEach(({ element, inert }) => { element.inert = inert; }); document.documentElement.classList.remove("assist-overlay-open"); };
  }, [assist.open]);

  function cancelAndReturn() { assist.cancel(); window.setTimeout(() => triggerRef.current?.focus(), 0); }

  return <div className="old-mike-assist-control" data-assist-surface={props.surface}>
    <div className="old-mike-assist-actions">
      <button ref={triggerRef} type="button" className="old-mike-assist-trigger" aria-haspopup="dialog" aria-expanded={assist.open} aria-controls={dialogId} onClick={() => assist.setOpen(true)}>{props.label || registry.label}</button>
      {assist.canUndo && <button type="button" className="old-mike-assist-undo" onClick={assist.undo}>復原老麥套用</button>}
    </div>
    <span className="sr-only" role="status" aria-live="polite">{assist.announcement}</span>
    {assist.open && <><button type="button" className="old-mike-assist-backdrop" tabIndex={-1} aria-label="取消並關閉老麥建議" onClick={cancelAndReturn} /><div ref={dialogRef} id={dialogId} className="old-mike-assist-popover" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header><div><strong id={titleId}>老麥</strong><small>先預覽，再決定是否套用；不會寫入正式資料。</small></div><button ref={closeRef} type="button" onClick={cancelAndReturn} aria-label="關閉老麥建議">關閉</button></header>
      <div className="old-mike-assist-scroll">
        <div className="old-mike-assist-action-grid">{actions.map((action) => <button key={action} type="button" disabled={assist.loading} onClick={() => void assist.request(action)}>{ACTION_LABELS[action]}</button>)}</div>
        {assist.loading && <p role="status" aria-live="polite">老麥正在準備可預覽建議…</p>}
        {assist.error && <p className="inline-error" role="alert">{assist.error}</p>}
        {assist.response && <section aria-label="老麥建議預覽"><p><strong>老麥建議・尚未驗證</strong></p><ul>{assist.response.suggestions.map((suggestion) => <li key={suggestion.id}>{suggestion.text ? <p>{suggestion.text}</p> : <dl>{Object.entries(suggestion.fields || {}).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value}</dd></div>)}</dl>}<small>{suggestion.changeSummary}</small><button type="button" disabled={!assist.response?.canApply} onClick={() => void assist.apply(suggestion)}>套用這項建議</button></li>)}</ul>{assist.response.recoverableFields.length > 0 && <p role="status">仍需確認：{assist.response.recoverableFields.join("、")}</p>}</section>}
      </div>
      <footer><button type="button" onClick={cancelAndReturn}>取消並保留原稿</button></footer>
    </div></>}
  </div>;
}

export function OldMikeAssistWholeS0Control(props: {
  value: S0Intake;
  contextSnapshot: Record<string, unknown>;
  onApply: (value: S0Intake, provenance: "AI_PROPOSED" | "USER_PROVIDED") => void;
}) {
  const currentValue = serializeOldMikeAssistGroup(props.value, S0_FIELD_NAMES);
  return <OldMikeAssistControl
    surface="S0_RESEARCH_TEXT"
    wholeS0
    currentValue={currentValue}
    contextSnapshot={props.contextSnapshot}
    label="老麥補齊完整 S0（全部通過才可套用）"
    onApply={(raw, provenance) => {
      const parsed = parseOldMikeAssistGroupValue(raw, S0_FIELD_NAMES);
      if (!parsed) return false;
      props.onApply(parsed as S0Intake, provenance);
      return true;
    }}
  />;
}

export function OldMikeAssistGroupControl(props: {
  projectId: string;
  surface: OldMikeAssistSurface;
  groupId: string;
  value: Record<string, string>;
  contextOnlyFields?: readonly string[];
  modeProfile?: ModelModeProfile;
  label?: string;
  onApply: (value: Record<string, string>, provenance: "AI_PROPOSED" | "USER_PROVIDED") => void;
}) {
  const fields = assistGroupFields(props.surface, props.groupId);
  if (!fields) return null;
  const currentValue = serializeOldMikeAssistGroup(props.value, fields);
  return <OldMikeAssistControl
    projectId={props.projectId}
    surface={props.surface}
    groupId={props.groupId}
    currentValue={currentValue}
    modeProfile={props.modeProfile}
    label={props.label}
    onApply={(raw, provenance) => {
      const patch = parseOldMikeAssistGroupPatch(raw, fields);
      if (!patch) return false;
      const validated = mergeOldMikeAssistGroupPatch(Object.fromEntries(fields.map((field) => [field, props.value[field] ?? ""])), patch, fields);
      if (!validated || (props.contextOnlyFields || []).some((field) => validated[field] !== (props.value[field] ?? ""))) return false;
      props.onApply(validated, provenance);
      return true;
    }}
  />;
}
