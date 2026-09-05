import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectProductCopyTree } from "../../alpha4-uat-tooling/lib/product-copy-tree-authority.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(portalRoot, "..");
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_BETA1_THREE_JOURNEY_ADVERSARIAL_CLOSURE_1_MANIFEST.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const priorAuthorities = Object.freeze([
  Object.freeze({ path: "OLD_MIKE_RESEARCH_OS_V2_BETA1_THIN_ADAPTERS_THREE_JOURNEY_MANIFEST.json", size: 9623, sha256: "7c1f01ffc0bd6f2e94cfc861c6727931b4ca4cd240c606391bd70e818de677b4" }),
  Object.freeze({ path: "OLD_MIKE_RESEARCH_OS_V2_BETA1_THIN_ADAPTERS_THREE_JOURNEY_RESULT.md", size: 2753, sha256: "1123c6a32248962ce10083a4319b076968c7e991e78e0a88628d3f282f04ae23" }),
  Object.freeze({ path: "OLD_MIKE_RESEARCH_OS_V2_BETA1_THREE_JOURNEY_UAT_BRIEF.md", size: 2042, sha256: "0ebeb2bc00ee4df1a25a6781136fae7596c115e0b07958171ecc54cd49c9f7d0" }),
]);

const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
assert.equal(manifest.contractVersion, "old-mike-v2-beta1-three-journey-adversarial-closure-manifest/1");
assert.equal(manifest.actionId, "LOCAL_V2_BETA1_THIN_ADAPTERS_AND_THREE_JOURNEY_CLOSURE");
assert.equal(manifest.subactionId, "BRAIN_REVIEW_THREE_JOURNEY_ADVERSARIAL_CLOSURE_1");
assert.equal(manifest.status, "LOCAL_CANDIDATE_FOCUSED_CLOSURE_PASS_SELF_TEST_ONLY");
assert.equal(manifest.thirdPartyUat, "NOT_EXECUTED");
assert.equal(manifest.releaseAuthority, "NOT_GRANTED");

const localDescriptor = JSON.parse(await readFile(path.join(workspaceRoot, "beta1-uat-tooling/beta1-local-functional.descriptor.json"), "utf8"));
const productionDescriptor = JSON.parse(await readFile(path.join(workspaceRoot, "beta1-uat-tooling/beta1-production-behavior.descriptor.json"), "utf8"));
const productTree = await collectProductCopyTree(portalRoot, localDescriptor.copyExclusions);
const expectedTree = {
  contractVersion: productTree.contractVersion,
  fileCount: productTree.fileCount,
  totalBytes: productTree.totalBytes,
  aggregateSha256: productTree.aggregateSha256,
};
assert.deepEqual(manifest.productTree, expectedTree);
assert.deepEqual(localDescriptor.productTreeAuthority, expectedTree);
assert.deepEqual(productionDescriptor.productTreeAuthority, expectedTree);

assert.equal(new Set(manifest.changedFiles.map((entry) => entry.path)).size, manifest.changedFiles.length);
assert.deepEqual(manifest.changedFiles.map((entry) => entry.path), [...manifest.changedFiles.map((entry) => entry.path)].sort());
for (const entry of manifest.changedFiles) {
  const bytes = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(bytes.byteLength, entry.size, `${entry.path}_size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path}_sha256`);
}

assert.equal(new Set(manifest.toolingAuthority.entries.map((entry) => entry.path)).size, manifest.toolingAuthority.entries.length);
assert.deepEqual(manifest.toolingAuthority.entries.map((entry) => entry.path), [...manifest.toolingAuthority.entries.map((entry) => entry.path)].sort());
for (const entry of manifest.toolingAuthority.entries) {
  const bytes = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(bytes.byteLength, entry.size, `${entry.path}_tool_size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path}_tool_sha256`);
}

assert.deepEqual(manifest.priorCandidateAuthorities, priorAuthorities);
for (const authority of priorAuthorities) {
  const bytes = await readFile(path.join(workspaceRoot, authority.path));
  assert.equal(bytes.byteLength, authority.size, `${authority.path}_immutable_size`);
  assert.equal(sha256(bytes), authority.sha256, `${authority.path}_immutable_sha256`);
}

assert.deepEqual(manifest.verification.blackbox.journeys, ["KEYWORD_JOURNAL", "MULTI_MATERIAL_JOURNAL", "KEYWORD_TAIWAN"]);
assert.deepEqual(manifest.verification.blackbox.viewports, ["1440x900", "390x844", "360x640"]);
assert.equal(manifest.verification.blackbox.oneChromiumSession, true);
assert.equal(manifest.verification.blackbox.unknownSecondPosts, 0);
assert.equal(manifest.verification.blackbox.axeSeriousCritical, 0);
assert.equal(manifest.verification.productionHttp.pageGet, 404);
assert.equal(manifest.verification.productionHttp.apiGet, 404);
assert.equal(manifest.verification.productionHttp.apiPost, 404);
assert.equal(manifest.verification.effectCounts.formalResearchWriteEndpointsCalled, 0);
assert.equal(manifest.verification.effectCounts.onlineDatabaseConnections, 0);
assert.equal(manifest.verification.effectCounts.externalMutations, 0);

for (const residue of ["Old Mike Beta1 local functional isolated workspace", "Old Mike Beta1 production behavior isolated workspace"]) {
  await assert.rejects(stat(path.resolve(workspaceRoot, "..", residue)), { code: "ENOENT" });
}

console.log(JSON.stringify({
  status: "PASS",
  actionId: manifest.actionId,
  subactionId: manifest.subactionId,
  productTreeFiles: productTree.fileCount,
  productTreeSha256: productTree.aggregateSha256,
  changedFiles: manifest.changedFiles.length,
  toolingEntries: manifest.toolingAuthority.entries.length,
  manifestSha256: sha256(manifestBytes),
  focusedHandoff: "PASS",
  priorCandidateImmutability: "PASS",
  thirdPartyUat: "NOT_EXECUTED",
  releaseAuthority: "NOT_GRANTED",
}));
