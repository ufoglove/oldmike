"use client";

import { useEffect, useRef, useState } from "react";
import {
  OLD_MIKE_ASSIST_CONTRACT_VERSION,
  canonicalAssistSource,
  parseOldMikeAssistGroupValue,
  serializeOldMikeAssistGroup,
  ASSIST_REGISTRY,
  type OldMikeAssistAction,
  type OldMikeAssistResponse,
  type OldMikeAssistSuggestion,
  type OldMikeAssistSurface,
} from "@/lib/old-mike-assist-contract";
import { S0_FIELD_NAMES } from "@/lib/s0-fields";
import type { ModelModeProfile } from "@/lib/model-mode-contract";

let activeAssistOwner: string | null = null;

async function valueHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestId() {
  const value = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `assist:${value}`;
}

export function useOldMikeAssist(input: {
  projectId?: string;
  surface: OldMikeAssistSurface;
  targetId?: string;
  groupId?: string;
  wholeS0?: boolean;
  currentValue: string;
  contextSnapshot?: Record<string, unknown>;
  currentProvenance?: "AI_PROPOSED" | "USER_PROVIDED";
  modeProfile?: ModelModeProfile;
  onApply: (value: string, provenance: "AI_PROPOSED" | "USER_PROVIDED") => boolean | void;
}) {
  const owner = useRef(requestId());
  const currentValueRef = useRef(input.currentValue);
  currentValueRef.current = input.currentValue;
  const inputRef = useRef(input);
  inputRef.current = input;
  const controller = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [response, setResponse] = useState<OldMikeAssistResponse | null>(null);
  const [snapshot, setSnapshot] = useState<{ value: string; hash: string; provenance: "AI_PROPOSED" | "USER_PROVIDED" } | null>(null);

  useEffect(() => () => { controller.current?.abort(); if (activeAssistOwner === owner.current) activeAssistOwner = null; }, []);

  async function request(action: OldMikeAssistAction) {
    if (loading) return;
    if (activeAssistOwner && activeAssistOwner !== owner.current) { setError("另一個老麥建議仍在處理，請先完成或取消。 "); return; }
    activeAssistOwner = owner.current;
    setError(""); setResponse(null); setLoading(true); setAnnouncement("老麥正在準備可預覽建議。");
    const startedValue = currentValueRef.current;
    const registry = ASSIST_REGISTRY[input.surface];
    const groupFields = input.wholeS0 ? S0_FIELD_NAMES : input.groupId ? registry.groupFields[input.groupId] : null;
    const current = groupFields ? parseOldMikeAssistGroupValue(startedValue, groupFields) : startedValue;
    if (current === null) { setError("目前欄位群組未通過固定契約，原稿未變更。"); setLoading(false); activeAssistOwner = null; return; }
    const contextSnapshot = { ...(input.contextSnapshot || {}), current };
    const sourceHash = await valueHash(canonicalAssistSource(contextSnapshot));
    const abort = new AbortController(); controller.current = abort;
    try {
      const endpoint = input.projectId ? `/api/projects/${encodeURIComponent(input.projectId)}/assist` : "/api/assist/field";
      const result = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractVersion: OLD_MIKE_ASSIST_CONTRACT_VERSION,
          idempotencyKey: requestId(),
          surface: input.surface,
          action,
          targetKind: input.wholeS0 ? "WHOLE_S0" : input.targetId ? "FIELD" : "GROUP",
          schemaId: input.wholeS0 ? "s0-fields/1.0.0" : input.targetId || input.groupId,
          sourceHash,
          contextSnapshot,
          selection: null,
          modeProfile: input.modeProfile || "AUTO",
        }),
        signal: abort.signal,
      });
      const data = await result.json() as { ok?: boolean; data?: OldMikeAssistResponse; error?: string; stage?: string; recoverableFields?: string[] };
      if (!result.ok || !data.ok || !data.data) throw new Error(data.error || `老麥目前無法提供建議${data.stage ? `（${data.stage}）` : ""}。${data.recoverableFields?.length ? ` 請檢查：${data.recoverableFields.join("、")}` : ""}`);
      const latest = inputRef.current;
      const latestFields = latest.wholeS0 ? S0_FIELD_NAMES : latest.groupId ? ASSIST_REGISTRY[latest.surface].groupFields[latest.groupId] : null;
      const latestCurrent = latestFields ? parseOldMikeAssistGroupValue(currentValueRef.current, latestFields) : currentValueRef.current;
      const currentHash = latestCurrent === null ? "" : await valueHash(canonicalAssistSource({ ...(latest.contextSnapshot || {}), current: latestCurrent }));
      if (currentHash !== sourceHash || data.data.sourceHash !== sourceHash) { setError("內容已變更，這組建議已過期，未套用。 "); setAnnouncement("建議已標記為過期。"); return; }
      setResponse(data.data); setAnnouncement(`已取得 ${data.data.suggestions.length} 項老麥建議，尚未套用。`);
    } catch (reason) {
      if (abort.signal.aborted) setAnnouncement("已取消老麥建議；原稿未變更。");
      else { setError(reason instanceof Error ? reason.message : "老麥目前無法提供建議。"); setAnnouncement("老麥建議未完成；未自動重送。 "); }
    } finally {
      controller.current = null; setLoading(false); if (activeAssistOwner === owner.current) activeAssistOwner = null;
    }
  }

  async function apply(suggestion: OldMikeAssistSuggestion) {
    if (!response) return;
    const latest = inputRef.current;
    const groupFields = latest.wholeS0 ? S0_FIELD_NAMES : latest.groupId ? ASSIST_REGISTRY[latest.surface].groupFields[latest.groupId] : null;
    const latestCurrent = groupFields ? parseOldMikeAssistGroupValue(currentValueRef.current, groupFields) : currentValueRef.current;
    const actualHash = latestCurrent === null ? "" : await valueHash(canonicalAssistSource({ ...(latest.contextSnapshot || {}), current: latestCurrent }));
    if (actualHash !== response.sourceHash || !response.canApply) { setError(response.canApply ? "內容已變更，這組建議已過期，未套用。 " : `建議仍有待確認欄位：${response.recoverableFields.join("、")}`); setResponse(null); return; }
    const previous = currentValueRef.current;
    const nextValue = suggestion.text ?? (suggestion.fields && groupFields ? JSON.stringify(suggestion.fields) : "");
    if (!nextValue || input.onApply(nextValue, "AI_PROPOSED") === false) { setError("建議格式未通過目前欄位契約，原稿未變更。 "); setAnnouncement("建議未套用。 "); return; }
    setSnapshot({ value: previous, hash: actualHash, provenance: input.currentProvenance || "USER_PROVIDED" });
    setResponse(null); setOpen(false); setAnnouncement("已套用老麥建議；仍需研究者確認。 ");
  }

  function undo() {
    if (!snapshot) return;
    input.onApply(snapshot.value, snapshot.provenance); setSnapshot(null); setAnnouncement("已復原套用前內容。 ");
  }

  function cancel() {
    controller.current?.abort(); setResponse(null); setError(""); setOpen(false); setAnnouncement("已取消；原稿未變更。 ");
  }

  return { open, setOpen, loading, error, announcement, response, canUndo: Boolean(snapshot), request, apply, undo, cancel };
}
