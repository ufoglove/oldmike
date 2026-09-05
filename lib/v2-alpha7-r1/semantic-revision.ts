import "server-only";

import { preservationFingerprint } from "../academic-language-contract.ts";
import {
  V2_ALPHA7_REVISION_STRATEGIES,
  alpha7Hash,
  type V2Alpha7ReviewLens,
  type V2Alpha7RevisionAlternative,
} from "../v2-alpha7/contracts.ts";
import { findV2Alpha7R1SemanticRevisionFixture } from "./semantic-revision-fixtures.ts";

function exactArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function cautionProfile(value: string) {
  const normalized = value.toLocaleLowerCase("en-US");
  return {
    possibility: [...normalized.matchAll(/\b(?:may|might|could|possibly)\b/gu)].length,
    negation: [...normalized.matchAll(/\b(?:not|no|cannot|does not|did not|has not|have not)\b/gu)].length,
  };
}

function assertPreserved(source: string, revision: string, anchors: readonly string[]) {
  if (!revision.trim() || revision.includes(source)) throw new Error("alpha7_revision_source_retained");
  const before = preservationFingerprint(source);
  const after = preservationFingerprint(revision);
  for (const key of ["citations", "numbers", "units", "formulas"] as const) {
    if (!exactArray(before[key], after[key])) throw new Error(`alpha7_revision_${key}_changed`);
  }
  if (JSON.stringify(cautionProfile(source)) !== JSON.stringify(cautionProfile(revision))) throw new Error("alpha7_revision_modality_changed");
  const normalized = revision.toLocaleLowerCase("en-US");
  if (anchors.some((anchor) => !normalized.includes(anchor.toLocaleLowerCase("en-US")))) throw new Error("alpha7_revision_meaning_anchor_missing");
}

export function createAlpha7R1SemanticRevisionAlternatives(input: {
  findingId: string;
  lens: V2Alpha7ReviewLens;
  sourceSpan: string;
  sourceSpanHash: string;
}): V2Alpha7RevisionAlternative[] {
  const fixture = findV2Alpha7R1SemanticRevisionFixture(input.lens, input.sourceSpan);
  if (!fixture) throw new Error("alpha7_revision_input_unsupported");
  if (alpha7Hash(input.sourceSpan) !== input.sourceSpanHash) throw new Error("alpha7_source_binding_invalid");

  const alternatives = V2_ALPHA7_REVISION_STRATEGIES.map((strategy) => {
    const authored = fixture.outputs[strategy];
    assertPreserved(input.sourceSpan, authored.revision, fixture.semanticAnchors);
    return {
      alternativeId: alpha7Hash({ findingId: input.findingId, strategy, sourceSpanHash: input.sourceSpanHash, revision: authored.revision }).slice(0, 24),
      strategy,
      recommended: strategy === "JOURNAL_CONCISE_RECOMMENDED",
      sourceHash: input.sourceSpanHash,
      revision: authored.revision,
      reason: authored.reason,
      risk: authored.risk,
      preservesFacts: true as const,
    };
  });

  if (new Set(alternatives.map((item) => item.revision)).size !== 3) throw new Error("alpha7_revision_semantic_distinctness_invalid");
  return alternatives;
}

export const V2_ALPHA7_R1_SEMANTIC_REVISION_BOUNDARY = Object.freeze({
  fixtureAuthority: "AUTHORED_SUPPORTED_SOURCE_SPANS_ONLY",
  unsupportedInput: "FAIL_CLOSED_DRAFT_PRESERVED",
  completeSourceRetentionAllowed: false,
  recommendedStrategy: "JOURNAL_CONCISE_RECOMMENDED",
  externalCalls: 0,
});
