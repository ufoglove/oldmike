export type AssistDraftState = {
  currentValue: string;
  currentHash: string;
  provenance: "USER_PROVIDED" | "AI_PROPOSED";
  snapshot: { value: string; hash: string; provenance: "USER_PROVIDED" | "AI_PROPOSED" } | null;
  preview: { text: string; originalHash: string } | null;
};

export function createAssistDraftState(currentValue: string, currentHash: string): AssistDraftState {
  return { currentValue, currentHash, provenance: "USER_PROVIDED", snapshot: null, preview: null };
}

export function applyAssistPreview(state: AssistDraftState, preview: { text: string; originalHash: string }, actualCurrentHash: string): AssistDraftState {
  if (preview.originalHash !== state.currentHash || preview.originalHash !== actualCurrentHash) throw new Error("assist_preview_stale");
  return { ...state, currentValue: preview.text, provenance: "AI_PROPOSED", snapshot: { value: state.currentValue, hash: state.currentHash, provenance: state.provenance }, preview: null };
}

export function undoAssistPreview(state: AssistDraftState): AssistDraftState {
  if (!state.snapshot) return state;
  return { ...state, currentValue: state.snapshot.value, currentHash: state.snapshot.hash, provenance: state.snapshot.provenance, snapshot: null, preview: null };
}

export function cancelAssistPreview(state: AssistDraftState): AssistDraftState {
  return state.preview ? { ...state, preview: null } : state;
}
