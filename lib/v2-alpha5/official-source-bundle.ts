import { createHash } from "node:crypto";

import { parseDomainSelection, type V2Alpha3DomainSelection } from "../v2-alpha3/contracts.ts";
import {
  V2_ALPHA5_CONTRACT_VERSION,
  V2_ALPHA5_TARGETS,
  type V2Alpha5Freshness,
  type V2Alpha5OfficialSourceBundle,
  type V2Alpha5OfficialSourceKind,
  type V2Alpha5OfficialSourceRecord,
  type V2Alpha5TargetId,
  type V2Alpha5TargetSelection,
  V2_ALPHA5_TARGET_CATALOG_VERSION,
} from "./contracts.ts";

const SOURCE_KINDS: V2Alpha5OfficialSourceKind[] = ["ANNOUNCEMENT", "RULES", "FORMS", "ATTACHMENTS", "BUDGET", "REVIEW_CRITERIA", "TIMELINE"];
const HEX = /^[a-f0-9]{64}$/;

const canonical = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
};
export const alpha5Hash = (value: unknown) => createHash("sha256").update(canonical(value), "utf8").digest("hex");

export function createAlpha5TargetSelection(targetId: V2Alpha5TargetId): V2Alpha5TargetSelection {
  const target = V2_ALPHA5_TARGETS.find((item) => item.id === targetId);
  if (!target) throw new Error("alpha5_target_invalid");
  const base = { targetId: target.id, label: target.label, proposalMode: target.proposalMode, catalogVersion: V2_ALPHA5_TARGET_CATALOG_VERSION };
  return { ...base, selectionHash: alpha5Hash(base) };
}

function source(kind: V2Alpha5OfficialSourceKind, targetId: V2Alpha5TargetId, cycleYear: number, freshness: "CURRENT" | "STALE" | "MISSING"): V2Alpha5OfficialSourceRecord {
  const facts: Record<string, string | number | boolean | null> = freshness === "MISSING" ? {} : kind === "BUDGET"
    ? { operatingUnitCostTwd: targetId === "NSTC" ? 18000 : 12000, teachingMaterialUnitCostTwd: targetId === "NSTC" ? 9000 : 8000, ceilingStatus: "UNKNOWN_REQUIRES_OFFICIAL_VERIFICATION" }
    : kind === "TIMELINE"
      ? { officialDeadline: null, deadlineStatus: "UNKNOWN_REQUIRES_OFFICIAL_VERIFICATION" }
      : { availability: "SYNTHETIC_UNVERIFIED", currentFactStatus: "UNKNOWN" };
  const record = { kind, targetId, cycleYear, freshness, retrievedAt: freshness === "MISSING" ? null : "2026-08-25T00:00:00.000Z", effectiveAt: null, facts };
  return { kind, cycleYear, freshness, retrievedAt: record.retrievedAt, effectiveAt: null, facts, sourceHash: alpha5Hash(record) };
}

export function createSyntheticOfficialSourceBundle(input: { targetId: V2Alpha5TargetId; cycleYear: number; domainSelection: V2Alpha3DomainSelection; variant?: "CURRENT" | "MIXED_FRESHNESS" | "MISSING" | "MIXED_CYCLE" }): V2Alpha5OfficialSourceBundle {
  const domain = parseDomainSelection(input.domainSelection);
  const variant = input.variant ?? "MIXED_FRESHNESS";
  const sources = SOURCE_KINDS.map((kind, index) => {
    const freshness = variant === "MISSING" ? "MISSING" : variant === "CURRENT" ? "CURRENT" : variant === "MIXED_CYCLE" ? "CURRENT" : index === 4 ? "STALE" : index === 6 ? "MISSING" : "CURRENT";
    return source(kind, input.targetId, input.cycleYear + (variant === "MIXED_CYCLE" && kind === "FORMS" ? -1 : 0), freshness);
  });
  const cycleMismatch = sources.some((item) => item.cycleYear !== input.cycleYear);
  const freshness: V2Alpha5Freshness = cycleMismatch ? "MIXED_CYCLE" : sources.every((item) => item.freshness === "CURRENT") ? "CURRENT" : sources.every((item) => item.freshness === "MISSING") ? "MISSING" : "STALE";
  const withoutHash = {
    contractVersion: V2_ALPHA5_CONTRACT_VERSION,
    targetId: input.targetId,
    cycleYear: input.cycleYear,
    disciplineHash: domain.selectionHash,
    applicationState: "LOCAL_SYNTHETIC_UNVERIFIED" as const,
    sources,
    officialDeadline: { status: "UNKNOWN" as const, value: null, sourceHash: sources.find((item) => item.kind === "TIMELINE")?.sourceHash ?? null },
    institutionalDeadline: { status: "UNKNOWN" as const, value: null, sourceHash: null },
    freshness,
  };
  return { ...withoutHash, bundleHash: alpha5Hash(withoutHash) };
}

export function parseOfficialSourceBundle(value: unknown, expected: { targetId: V2Alpha5TargetId; domainSelectionHash: string }): V2Alpha5OfficialSourceBundle {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("alpha5_source_bundle_shape_invalid");
  const bundle = value as V2Alpha5OfficialSourceBundle;
  if (bundle.contractVersion !== V2_ALPHA5_CONTRACT_VERSION || bundle.targetId !== expected.targetId || bundle.disciplineHash !== expected.domainSelectionHash || !HEX.test(bundle.bundleHash)) throw new Error("alpha5_source_bundle_binding_invalid");
  if (!Array.isArray(bundle.sources) || bundle.sources.length !== SOURCE_KINDS.length || new Set(bundle.sources.map((item) => item.kind)).size !== SOURCE_KINDS.length || SOURCE_KINDS.some((kind) => !bundle.sources.some((item) => item.kind === kind))) throw new Error("alpha5_source_bundle_sources_invalid");
  if (bundle.sources.some((item) => !HEX.test(item.sourceHash) || !["CURRENT", "STALE", "MISSING"].includes(item.freshness))) throw new Error("alpha5_source_record_invalid");
  const mixedCycle = bundle.sources.some((item) => item.cycleYear !== bundle.cycleYear);
  if (mixedCycle !== (bundle.freshness === "MIXED_CYCLE")) throw new Error("alpha5_source_cycle_class_invalid");
  if (mixedCycle) throw new Error("alpha5_source_cycle_mixed");
  const { bundleHash, ...withoutHash } = bundle;
  if (alpha5Hash(withoutHash) !== bundleHash) throw new Error("alpha5_source_bundle_hash_invalid");
  return bundle;
}
