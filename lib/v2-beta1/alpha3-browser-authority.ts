import type { V2Alpha3DomainSelection, V2Alpha3InsightCard, V2Alpha3InsightKind } from "../v2-alpha3/contracts.ts";
import { beta1Hash } from "./canonical-hash.ts";

type UnknownRecord = Record<string, unknown>;

const BUILTIN_DOMAINS = Object.freeze([
  { id: "ai-cross-disciplinary", label: "AI跨領域應用" },
  { id: "ai-education", label: "AI應用於教育" },
  { id: "ai-occupational-safety-training", label: "AI應用於職業安全與教育訓練" },
  { id: "ai-environment-resource-management", label: "AI應用於環境工程與環境資源管理" },
  { id: "ai-energy-management", label: "AI應用於能源管理" },
  { id: "xr-cross-disciplinary", label: "VR/AR/XR跨領域應用" },
] as const);

function record(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function text(value: unknown, maximum: number, code: string) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (!normalized || normalized.length > maximum) throw new Error(code);
  return normalized;
}

function lowerHex(value: unknown, code: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(code);
  return value;
}

export function parseBrowserSafeAlpha3DomainSelection(value: unknown): V2Alpha3DomainSelection {
  const input = record(value, "domain_selection_invalid");
  let binding: Omit<V2Alpha3DomainSelection, "selectionHash">;
  if (input.kind === "BUILTIN") {
    const domainId = text(input.domainId, 120, "domain_selection_invalid");
    const domain = BUILTIN_DOMAINS.find((item) => item.id === domainId);
    if (!domain) throw new Error("domain_selection_invalid");
    binding = { kind: "BUILTIN", domainId: domain.id, label: domain.label, profileId: null, profileVersion: null, profileContentHash: null };
  } else if (input.kind === "CUSTOM") {
    const profileVersion = input.profileVersion;
    if (!Number.isInteger(profileVersion) || Number(profileVersion) < 1) throw new Error("custom_domain_version_invalid");
    binding = {
      kind: "CUSTOM",
      domainId: null,
      label: text(input.label, 120, "custom_domain_name_invalid"),
      profileId: text(input.profileId, 120, "custom_domain_profile_id_invalid"),
      profileVersion: Number(profileVersion),
      profileContentHash: lowerHex(input.profileContentHash, "custom_domain_content_hash_invalid"),
    };
  } else {
    throw new Error("domain_selection_invalid");
  }
  const selectionHash = beta1Hash(binding);
  if (selectionHash !== input.selectionHash) throw new Error("domain_selection_hash_invalid");
  return { ...binding, selectionHash } as V2Alpha3DomainSelection;
}

function insightWithoutHash(value: unknown): Omit<V2Alpha3InsightCard, "hash"> {
  const input = record(value, "insight_card_invalid");
  const kinds: readonly V2Alpha3InsightKind[] = ["question", "gap", "mechanism", "method", "direction"];
  if (!kinds.includes(input.kind as V2Alpha3InsightKind)) throw new Error("insight_kind_invalid");
  if (input.evidenceBoundary !== "UNVERIFIED" && input.evidenceBoundary !== "OBSERVED_PARTIAL" && input.evidenceBoundary !== "ASSUMPTION") throw new Error("insight_evidence_boundary_invalid");
  if (!Array.isArray(input.assumptions) || input.assumptions.length > 4) throw new Error("insight_assumptions_invalid");
  return {
    kind: input.kind as V2Alpha3InsightKind,
    title: text(input.title, 240, "insight_title_invalid"),
    researchQuestion: text(input.researchQuestion, 600, "insight_question_invalid"),
    mechanism: text(input.mechanism, 800, "insight_mechanism_invalid"),
    value: text(input.value, 800, "insight_value_invalid"),
    domainFit: text(input.domainFit, 500, "insight_domain_fit_invalid"),
    evidenceBoundary: input.evidenceBoundary as V2Alpha3InsightCard["evidenceBoundary"],
    assumptions: input.assumptions.map((item) => text(item, 240, "insight_assumption_invalid")),
    nextAction: text(input.nextAction, 400, "insight_next_action_invalid"),
  };
}

export function parseBrowserSafeAlpha3InsightCard(value: unknown): V2Alpha3InsightCard {
  const input = record(value, "insight_card_invalid");
  const card = insightWithoutHash(input);
  const hash = lowerHex(input.hash, "insight_hash_invalid");
  if (beta1Hash(card) !== hash) throw new Error("insight_hash_mismatch");
  return { ...card, hash };
}
