import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectV2Beta1ArtifactClosure } from "./verify-v2-beta1-artifact-closure.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(portalRoot, "..");
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_BETA1_FOCUSED_CLOSURE_1_MANIFEST.json");
const bytes = await readFile(manifestPath);
const manifest = JSON.parse(bytes.toString("utf8"));
const hash = (value) => createHash("sha256").update(value).digest("hex");

assert.equal(manifest.contractVersion, "old-mike-v2-beta1-focused-closure-manifest/1");
assert.equal(manifest.actionId, "LOCAL_V2_BETA1_UNIFIED_PROJECT_TRUTH_UI_AND_BLACKBOX_SLICE");
assert.equal(manifest.subactionId, "BRAIN_REVIEW_FROZEN_CLOSURE_1");
assert.equal(manifest.status, "LOCAL_CANDIDATE_FOCUSED_CLOSURE_PASS_SELF_TEST_ONLY");
assert.equal(manifest.releaseAuthority, "NOT_GRANTED");
assert.equal(manifest.thirdPartyUat, "NOT_EXECUTED");

const closure = await collectV2Beta1ArtifactClosure();
assert.equal(manifest.artifactClosure.cardinality, closure.cardinality);
assert.equal(manifest.artifactClosure.aggregateSha256, closure.aggregateSha256);
assert.deepEqual(manifest.artifactClosure.entries, closure.entries);
assert.deepEqual(manifest.artifactClosure.externalPackages, closure.externalPackages);
assert.equal(new Set(closure.entries.map((entry) => entry.path)).size, closure.cardinality);
assert.deepEqual(closure.entries.map((entry) => entry.path), [...closure.entries.map((entry) => entry.path)].sort());

assert.ok(Array.isArray(manifest.correctedFiles) && manifest.correctedFiles.length > 0);
assert.equal(new Set(manifest.correctedFiles.map((entry) => entry.path)).size, manifest.correctedFiles.length);
assert.deepEqual(manifest.correctedFiles.map((entry) => entry.path), [...manifest.correctedFiles.map((entry) => entry.path)].sort());
for (const entry of manifest.correctedFiles) {
  const absolute = path.resolve(workspaceRoot, entry.path);
  assert.equal(absolute.toLowerCase().startsWith(`${workspaceRoot.toLowerCase()}${path.sep}`), true);
  const current = await readFile(absolute);
  assert.equal(current.byteLength, entry.size, `${entry.path}_size`);
  assert.equal(hash(current), entry.sha256, `${entry.path}_hash`);
}

for (const authority of manifest.historicalSourceEvidence) {
  const current = await readFile(path.resolve(workspaceRoot, authority.path));
  assert.equal(current.byteLength, authority.size);
  assert.equal(hash(current), authority.sha256);
}

for (const descriptorRelative of ["beta1-uat-tooling/beta1-local-functional.descriptor.json", "beta1-uat-tooling/beta1-production-behavior.descriptor.json"]) {
  const descriptor = JSON.parse(await readFile(path.join(workspaceRoot, descriptorRelative), "utf8"));
  assert.equal(hash(await readFile(descriptor.nodeExecutable)), descriptor.nodeExecutableSha256);
  assert.equal(hash(await readFile(path.join(descriptor.sourcePortalRoot, descriptor.nextEntryRelative))), descriptor.nextBinarySha256);
  if (descriptor.browserExecutable) assert.equal(hash(await readFile(descriptor.browserExecutable)), descriptor.browserExecutableSha256);
}

for (const residue of ["Old Mike Beta1 local functional isolated workspace", "Old Mike Beta1 production behavior isolated workspace"]) {
  await assert.rejects(stat(path.resolve(workspaceRoot, "..", residue)), { code: "ENOENT" });
}
assert.deepEqual(manifest.screenEvidence.map((item) => item.viewport), ["1440x900", "390x844", "360x640"]);
assert.equal(manifest.screenEvidence.every((item) => /^[0-9a-f]{64}$/u.test(item.screenshotSha256)), true);
assert.equal(manifest.evidenceBoundaries.staticSurface, "STATIC_SURFACE_ABSENT");
assert.equal(manifest.evidenceBoundaries.browserExternalOriginRequests, "BROWSER_OBSERVED_ZERO");
assert.equal(manifest.evidenceBoundaries.productionHttp, "PRODUCTION_HTTP_OBSERVED_LOOPBACK_ONLY");
assert.equal(manifest.evidenceBoundaries.serverExternalEffects, "NOT_INSTRUMENTED_NO_ZERO_CLAIM");

console.log(JSON.stringify({ status: "PASS", actionId: manifest.actionId, subactionId: manifest.subactionId, artifactClosureCardinality: closure.cardinality, artifactClosureSha256: closure.aggregateSha256, correctedFiles: manifest.correctedFiles.length, manifestSha256: hash(bytes), focusedHandoff: "PASS", thirdPartyUat: "NOT_EXECUTED", releaseAuthority: "NOT_GRANTED" }));
