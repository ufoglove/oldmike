import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifestBytes = await readFile(path.join(root, "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_R1_RESULT_MANIFEST.json"));
const manifest = JSON.parse(manifestBytes);

assert.equal(manifest.contractVersion, "old-mike-v2-alpha7-r1-result-manifest/1");
assert.equal(manifest.actionId, "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA7_R1_PUBLICATION_USABLE_REVISION_ALTERNATIVES_CLOSURE");
assert.equal(manifest.status, "FROZEN_LOCAL_PASS");
assert.equal(new Set(manifest.changedFiles.map((item) => item.path)).size, manifest.changedFiles.length);
for (const item of manifest.changedFiles) {
  assert.match(item.path, /^(?![A-Za-z]:|\/|.*\.\.(?:\/|$)).+/u);
  assert.match(item.sha256, /^[0-9a-f]{64}$/u);
  const bytes = await readFile(path.join(root, item.path));
  assert.equal(bytes.length, item.size, `${item.path} size`);
  assert.equal(hashBytes(bytes), item.sha256, `${item.path} hash`);
}

for (const authority of Object.values(manifest.authorities)) {
  const bytes = await readFile(path.join(root, authority.path));
  assert.equal(hashBytes(bytes), authority.sha256, `${authority.path} authority`);
}

const result = JSON.parse(await readFile(path.join(root, "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_R1_FOCUSED_RESULT.json"), "utf8"));
assert.equal(result.status, "FROZEN_LOCAL_PASS");
assert.equal(result.rootCause.redReproduction.completeSourceRetained, "15_OF_15");
assert.equal(result.rootCause.greenOutcome.completeSourceRetained, "0_OF_15");
assert.equal(result.correction.authoredAlternatives, 21);
assert.equal(result.correction.apply, "PASS_SELECTED_SPAN_ONLY");
assert.equal(result.correction.responseBeforeAfter, "PASS_EXACT_BOUND_SOURCE_AND_SELECTED_REVISION");
assert.equal(result.effects.liveModelProviderScholarlyJournalZoteroCalls, 0);
assert.equal(result.effects.databaseConnections, 0);
assert.equal(result.effects.formalResearchWrites, 0);
assert.equal(result.effects.externalMutations, 0);
assert.equal(manifest.gates.focusedHandoff, "PASS");

console.log(JSON.stringify({ status: "PASS", manifestSha256: hashBytes(manifestBytes), files: manifest.changedFiles.length, sourceAlpha7Frozen: "PASS", alpha6R1Dependency: "PASS", semanticClosure: "PASS", externalMutations: 0 }));
