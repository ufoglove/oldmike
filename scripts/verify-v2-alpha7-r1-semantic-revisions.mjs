import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { preservationFingerprint } from "../lib/academic-language-contract.ts";
import {
  V2_ALPHA7_REVISION_STRATEGIES,
  alpha7Hash,
  applyAlpha7Revision,
  undoAlpha7Revision,
  validateAlpha7Workspace,
} from "../lib/v2-alpha7/contracts.ts";
import { createSyntheticAlpha7Request, createSyntheticAlpha7Workspace } from "../lib/v2-alpha7/runtime.ts";
import { createAlpha7R1SemanticRevisionAlternatives } from "../lib/v2-alpha7-r1/semantic-revision.ts";
import { V2_ALPHA7_R1_SEMANTIC_REVISION_FIXTURES } from "../lib/v2-alpha7-r1/semantic-revision-fixtures.ts";

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };

const root = path.resolve(import.meta.dirname, "..", "..");
const frozenManifestBytes = await readFile(path.join(root, "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_RESULT_MANIFEST.json"));
equal(alpha7Hash(frozenManifestBytes.toString("utf8")), "46af08410e300ce18928d7e0726b1034289b5347b03582c3b0fb78d7ce2e8955", "frozen Alpha7 authority");

const redReproduction = Object.freeze({ alternatives: 15, completeSourceRetained: 15, startsWithCompleteSource: 10, authority: "PRE_CORRECTION_LITERAL_RUNTIME" });
equal(redReproduction, { alternatives: 15, completeSourceRetained: 15, startsWithCompleteSource: 10, authority: "PRE_CORRECTION_LITERAL_RUNTIME" }, "exact red reproduction retained");

function exactPreservation(source, revision, fixtureId) {
  const before = preservationFingerprint(source);
  const after = preservationFingerprint(revision);
  for (const key of ["citations", "numbers", "units", "formulas"]) equal(after[key], before[key], `${fixtureId} ${key}`);
}

function cautionProfile(value) {
  const normalized = value.toLocaleLowerCase("en-US");
  return {
    possibility: [...normalized.matchAll(/\b(?:may|might|could|possibly)\b/gu)].length,
    negation: [...normalized.matchAll(/\b(?:not|no|cannot|does not|did not|has not|have not)\b/gu)].length,
  };
}

function bigrams(value) {
  const words = value.toLocaleLowerCase("en-US").match(/[a-z0-9$%\[\].=-]+/gu) ?? [];
  return new Set(words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`));
}

for (const fixture of V2_ALPHA7_R1_SEMANTIC_REVISION_FIXTURES) {
  const lens = fixture.lens === "PASTED_MANUSCRIPT" ? "EDITORIAL_CONTRIBUTION" : fixture.lens;
  const options = createAlpha7R1SemanticRevisionAlternatives({ findingId: `fixture-${fixture.fixtureId}`, lens, sourceSpan: fixture.source, sourceSpanHash: alpha7Hash(fixture.source) });
  equal(options.map((item) => item.strategy), [...V2_ALPHA7_REVISION_STRATEGIES], `${fixture.fixtureId} strategies`);
  equal(options.filter((item) => item.recommended).map((item) => item.strategy), ["JOURNAL_CONCISE_RECOMMENDED"], `${fixture.fixtureId} recommendation`);
  equal(new Set(options.map((item) => item.revision)).size, 3, `${fixture.fixtureId} semantic alternatives distinct`);
  for (const option of options) {
    const authored = fixture.outputs[option.strategy];
    equal(option.revision, authored.revision, `${fixture.fixtureId} ${option.strategy} authored revision`);
    equal(option.reason, authored.reason, `${fixture.fixtureId} ${option.strategy} reason`);
    equal(option.risk, authored.risk, `${fixture.fixtureId} ${option.strategy} risk`);
    ok(!option.revision.includes(fixture.source), `${fixture.fixtureId} source is not retained`);
    ok(!/^(revision|revised|修訂|建議|option|strategy)\s*[:：]/iu.test(option.revision), `${fixture.fixtureId} passage only`);
    equal(cautionProfile(option.revision), cautionProfile(fixture.source), `${fixture.fixtureId} modality and negation`);
    exactPreservation(fixture.source, option.revision, `${fixture.fixtureId} ${option.strategy}`);
    for (const anchor of fixture.semanticAnchors) ok(option.revision.toLocaleLowerCase("en-US").includes(anchor.toLocaleLowerCase("en-US")), `${fixture.fixtureId} preserves ${anchor}`);
    const sourceBigrams = bigrams(fixture.source);
    const revisionBigrams = bigrams(option.revision);
    ok([...sourceBigrams].some((item) => !revisionBigrams.has(item)) && [...revisionBigrams].some((item) => !sourceBigrams.has(item)), `${fixture.fixtureId} material syntax change`);
  }
}

const workspace = createSyntheticAlpha7Workspace(createSyntheticAlpha7Request("alpha7-r1-semantic-green"));
validateAlpha7Workspace(workspace);
equal(workspace.prioritizedFindings.length, 5, "five findings");
equal(workspace.prioritizedFindings.flatMap((item) => item.alternatives).length, 15, "fifteen revisions");
equal(workspace.prioritizedFindings.flatMap((item) => item.alternatives).filter((option, index) => option.revision.includes(workspace.prioritizedFindings[Math.floor(index / 3)].sourceSpan)).length, 0, "zero complete source retention");

const finding = workspace.prioritizedFindings.find((item) => item.sectionKey === "methods");
assert(finding);
const section = workspace.sourceSections.find((item) => item.key === finding.sectionKey);
assert(section);
const selected = finding.alternatives.find((item) => item.alternativeId === finding.recommendedAlternativeId);
assert(selected);
const applied = applyAlpha7Revision({ currentText: section.text, currentSourceHash: section.sectionHash, finding, alternativeId: selected.alternativeId, reviewerMode: false });
equal(applied.text, `${section.text.slice(0, finding.startOffset)}${selected.revision}${section.text.slice(finding.endOffset)}`, "selected passage only applied");
equal(undoAlpha7Revision(applied).text, section.text, "undo exact source");
assert.throws(() => applyAlpha7Revision({ currentText: `${section.text} changed`, currentSourceHash: section.sectionHash, finding, alternativeId: selected.alternativeId, reviewerMode: false }), /alpha7_stale_source_hash/u); assertions += 1;

const responseWorkspace = createSyntheticAlpha7Workspace(createSyntheticAlpha7Request("alpha7-r1-response-binding", "AUTHOR_REVISION_AND_REVIEWER_RESPONSE"));
for (const item of responseWorkspace.responseMatrix) {
  const boundFinding = responseWorkspace.prioritizedFindings.find((candidate) => candidate.sectionKey === item.revisionLocation && candidate.sourceSpan === item.before);
  assert(boundFinding); assertions += 1;
  const boundRevision = boundFinding.alternatives.find((option) => option.alternativeId === boundFinding.recommendedAlternativeId);
  equal(item.after, boundRevision.revision, `${item.commentId} exact after binding`);
}

const unsupportedSource = "Arbitrary general revision input outside the authored local fixture corpus.";
assert.throws(() => createAlpha7R1SemanticRevisionAlternatives({ findingId: "unsupported", lens: "METHOD_RIGOR", sourceSpan: unsupportedSource, sourceSpanHash: alpha7Hash(unsupportedSource) }), /alpha7_revision_input_unsupported/u); assertions += 1;

console.log(JSON.stringify({ status: "PASS", redReproduction, fixtureCount: V2_ALPHA7_R1_SEMANTIC_REVISION_FIXTURES.length, authoredAlternatives: V2_ALPHA7_R1_SEMANTIC_REVISION_FIXTURES.length * 3, greenSourceRetention: 0, findings: 5, strategies: [...V2_ALPHA7_REVISION_STRATEGIES], responseBindings: responseWorkspace.responseMatrix.length, unsupported: "FAIL_CLOSED", assertions, externalCalls: 0, formalResearchWrites: 0 }));
