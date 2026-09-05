import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectProductCopyTree } from "../../alpha4-uat-tooling/lib/product-copy-tree-authority.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(portalRoot, "..");
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_BETA1_ADVERSARIAL_CLOSURE_3_MANIFEST.json");
const bytes = await readFile(manifestPath);
const manifest = JSON.parse(bytes.toString("utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const expectedToolingPaths = [
  "alpha4-uat-tooling/lib/launcher-core.mjs",
  "alpha4-uat-tooling/lib/product-copy-tree-authority.mjs",
  "beta1-uat-tooling/beta1-local-functional.descriptor.json",
  "beta1-uat-tooling/beta1-local-functional.mjs",
  "beta1-uat-tooling/beta1-production-behavior.descriptor.json",
  "beta1-uat-tooling/beta1-production-behavior.mjs",
  "research-portal/package.json",
  "research-portal/pnpm-lock.yaml",
  "research-portal/scripts/disposable-server-only-loader.mjs",
  "research-portal/scripts/v2-beta1-browser-entry.mjs",
  "research-portal/scripts/verify-v2-beta1-browser.mjs",
  "research-portal/scripts/verify-v2-beta1-client-boundary.mjs",
];
const expectedHistoricalPaths = [
  "OLD_MIKE_RESEARCH_OS_V2_BETA1_CONSOLIDATED_FINAL_CLOSURE_2_MANIFEST.json",
  "OLD_MIKE_RESEARCH_OS_V2_BETA1_CONSOLIDATED_FINAL_CLOSURE_2_RESULT.md",
  "OLD_MIKE_RESEARCH_OS_V2_BETA1_FOCUSED_CLOSURE_1_MANIFEST.json",
  "OLD_MIKE_RESEARCH_OS_V2_BETA1_FOCUSED_CLOSURE_1_RESULT.md",
  "OLD_MIKE_RESEARCH_OS_V2_BETA1_MAIN_WORKSPACE_MANIFEST.json",
  "OLD_MIKE_RESEARCH_OS_V2_BETA1_MAIN_WORKSPACE_RESULT.md",
];
const expectedCorrectedPaths = [
  "beta1-uat-tooling/beta1-local-functional.descriptor.json",
  "beta1-uat-tooling/beta1-production-behavior.descriptor.json",
  "research-portal/lib/v2-beta1/client-contract.ts",
  "research-portal/lib/v2-beta1/runtime.ts",
  "research-portal/scripts/verify-v2-beta1-contracts.mjs",
  "research-portal/scripts/verify-v2-beta1-consolidated-closure-handoff.mjs",
  "research-portal/scripts/verify-v2-beta1-consumer-contracts.mjs",
  "research-portal/scripts/verify-v2-beta1-integration-contracts.mjs",
];

assert.equal(manifest.contractVersion, "old-mike-v2-beta1-adversarial-closure-manifest/3");
assert.equal(manifest.actionId, "LOCAL_V2_BETA1_UNIFIED_PROJECT_TRUTH_UI_AND_BLACKBOX_SLICE");
assert.equal(manifest.subactionId, "BRAIN_REVIEW_ADVERSARIAL_CLOSURE_3");
assert.equal(manifest.status, "LOCAL_CANDIDATE_ADVERSARIAL_CLOSURE_PASS_SELF_TEST_ONLY");
assert.equal(manifest.releaseAuthority, "NOT_GRANTED");
assert.equal(manifest.thirdPartyUat, "NOT_EXECUTED");

const localDescriptor = JSON.parse(await readFile(path.join(workspaceRoot, "beta1-uat-tooling/beta1-local-functional.descriptor.json"), "utf8"));
const productionDescriptor = JSON.parse(await readFile(path.join(workspaceRoot, "beta1-uat-tooling/beta1-production-behavior.descriptor.json"), "utf8"));
const productTree = await collectProductCopyTree(portalRoot, localDescriptor.copyExclusions);
assert.deepEqual(manifest.productTree, {
  contractVersion: productTree.contractVersion,
  fileCount: productTree.fileCount,
  totalBytes: productTree.totalBytes,
  aggregateSha256: productTree.aggregateSha256,
});
assert.deepEqual(localDescriptor.productTreeAuthority, manifest.productTree);
assert.deepEqual(productionDescriptor.productTreeAuthority, manifest.productTree);
for (const required of ["app/layout.tsx", "app/globals.css", "app/research-os-local/page.tsx", "app/api/v2-beta1/project/route.ts"]) assert.equal(productTree.entries.some((entry) => entry.path === required), true, `${required}_missing`);
assert.equal(productTree.entries.some((entry) => /(?:^|\/)\.env(?:\.|$)|\.credential\.(?:json|xml|txt)$|\.(?:pem|key)$/iu.test(entry.path) && !entry.path.endsWith(".env.example")), false);

assert.equal(Array.isArray(manifest.toolingAuthority.entries), true);
assert.equal(manifest.toolingAuthority.contractVersion, "old-mike-beta1-tooling-entrypoints/1");
assert.equal(new Set(manifest.toolingAuthority.entries.map((entry) => entry.path)).size, manifest.toolingAuthority.entries.length);
assert.deepEqual(manifest.toolingAuthority.entries.map((entry) => entry.path), [...manifest.toolingAuthority.entries.map((entry) => entry.path)].sort());
assert.deepEqual(manifest.toolingAuthority.entries.map((entry) => entry.path), expectedToolingPaths);
for (const entry of manifest.toolingAuthority.entries) {
  const file = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(file.byteLength, entry.size, `${entry.path}_size`);
  assert.equal(sha256(file), entry.sha256, `${entry.path}_hash`);
}

for (const descriptor of [localDescriptor, productionDescriptor]) {
  assert.equal(sha256(await readFile(descriptor.nodeExecutable)), descriptor.nodeExecutableSha256);
  assert.equal(sha256(await readFile(path.join(descriptor.sourcePortalRoot, descriptor.nextEntryRelative))), descriptor.nextBinarySha256);
}
assert.equal(sha256(await readFile(localDescriptor.browserExecutable)), localDescriptor.browserExecutableSha256);
const axePackage = JSON.parse(await readFile(path.join(portalRoot, localDescriptor.axeCorePackageRelative), "utf8"));
assert.equal(axePackage.version, localDescriptor.axeCoreVersion);
assert.equal(sha256(await readFile(path.join(portalRoot, localDescriptor.axeCoreRelative))), localDescriptor.axeCoreSha256);

assert.deepEqual(manifest.historicalEvidence.map((entry) => entry.path), expectedHistoricalPaths);
for (const authority of manifest.historicalEvidence) {
  const current = await readFile(path.join(workspaceRoot, authority.path));
  assert.equal(current.byteLength, authority.size);
  assert.equal(sha256(current), authority.sha256);
}
assert.deepEqual(manifest.correctedFiles.map((entry) => entry.path), expectedCorrectedPaths);
for (const entry of manifest.correctedFiles) {
  const current = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(current.byteLength, entry.size, `${entry.path}_size`);
  assert.equal(sha256(current), entry.sha256, `${entry.path}_hash`);
}
for (const residue of ["Old Mike Beta1 local functional isolated workspace", "Old Mike Beta1 production behavior isolated workspace"]) await assert.rejects(stat(path.resolve(workspaceRoot, "..", residue)), { code: "ENOENT" });

assert.equal(manifest.evidenceBoundaries.productTree, "PRODUCT_COPY_TREE_BOUND_EXACT");
assert.equal(manifest.evidenceBoundaries.tooling, "ENTRYPOINTS_AND_VERSIONS_BOUND_NOT_COMPLETE_NODE_MODULES_CLOSURE");
assert.equal(manifest.evidenceBoundaries.browserExternalOriginRequests, "BROWSER_OBSERVED_ZERO");
assert.equal(manifest.evidenceBoundaries.serverExternalEffects, "NOT_INSTRUMENTED_NO_ZERO_CLAIM");

console.log(JSON.stringify({ status: "PASS", actionId: manifest.actionId, subactionId: manifest.subactionId, productTreeFiles: productTree.fileCount, productTreeSha256: productTree.aggregateSha256, toolingEntries: manifest.toolingAuthority.entries.length, correctedFiles: manifest.correctedFiles.length, manifestSha256: sha256(bytes), focusedHandoff: "PASS", thirdPartyUat: "NOT_EXECUTED", releaseAuthority: "NOT_GRANTED" }));
