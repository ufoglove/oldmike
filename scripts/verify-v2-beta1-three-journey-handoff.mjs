import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectProductCopyTree } from "../../alpha4-uat-tooling/lib/product-copy-tree-authority.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(portalRoot, "..");
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_BETA1_THIN_ADAPTERS_THREE_JOURNEY_MANIFEST.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const expectedChangedPaths = [
  "OLD_MIKE_RESEARCH_OS_V2_BETA1_IMPLEMENTATION_BRIEF.md",
  "OLD_MIKE_RESEARCH_OS_V2_BETA1_THREE_JOURNEY_UAT_BRIEF.md",
  "OLD_MIKE_RESEARCH_OS_V2_CURRENT_STATUS.md",
  "OLD_MIKE_RESEARCH_OS_V2_MASTER_PLAN.md",
  "beta1-uat-tooling/beta1-local-functional.descriptor.json",
  "beta1-uat-tooling/beta1-local-functional.mjs",
  "research-portal/components/v2-beta1/V2Beta1ResearchOS.tsx",
  "research-portal/components/v2-beta1/v2-beta1.module.css",
  "research-portal/lib/v2-beta1/client-contract.ts",
  "research-portal/lib/v2-beta1/contracts.ts",
  "research-portal/lib/v2-beta1/journey-adapters.ts",
  "research-portal/lib/v2-beta1/route-handlers.ts",
  "research-portal/lib/v2-beta1/runtime.ts",
  "research-portal/package.json",
  "research-portal/scripts/verify-v2-beta1-browser.mjs",
  "research-portal/scripts/verify-v2-beta1-consumer-contracts.mjs",
  "research-portal/scripts/verify-v2-beta1-contracts.mjs",
  "research-portal/scripts/verify-v2-beta1-egress-boundary.mjs",
  "research-portal/scripts/verify-v2-beta1-journeys.mjs",
  "research-portal/scripts/verify-v2-beta1-production-current.mjs",
  "research-portal/scripts/verify-v2-beta1-secret-boundary.mjs",
  "research-portal/scripts/verify-v2-beta1-three-journey-handoff.mjs",
].sort();

const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
assert.equal(manifest.contractVersion, "old-mike-v2-beta1-three-journey-manifest/1");
assert.equal(manifest.actionId, "LOCAL_V2_BETA1_THIN_ADAPTERS_AND_THREE_JOURNEY_CLOSURE");
assert.equal(manifest.status, "LOCAL_CANDIDATE_THREE_JOURNEY_PASS_SELF_TEST_ONLY");
assert.equal(manifest.thirdPartyUat, "NOT_EXECUTED");
assert.equal(manifest.releaseAuthority, "NOT_GRANTED");

const descriptor = JSON.parse(await readFile(path.join(workspaceRoot, "beta1-uat-tooling/beta1-local-functional.descriptor.json"), "utf8"));
const tree = await collectProductCopyTree(portalRoot, descriptor.copyExclusions);
assert.deepEqual(manifest.productTree, {
  contractVersion: tree.contractVersion,
  fileCount: tree.fileCount,
  totalBytes: tree.totalBytes,
  aggregateSha256: tree.aggregateSha256,
});
assert.deepEqual(descriptor.productTreeAuthority, manifest.productTree);

assert.deepEqual(manifest.changedFiles.map((entry) => entry.path), expectedChangedPaths);
for (const entry of manifest.changedFiles) {
  const bytes = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(bytes.byteLength, entry.size, `${entry.path}_size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path}_hash`);
}
assert.equal(new Set(manifest.toolingAuthority.entries.map((entry) => entry.path)).size, manifest.toolingAuthority.entries.length);
assert.deepEqual(manifest.toolingAuthority.entries.map((entry) => entry.path), [...manifest.toolingAuthority.entries.map((entry) => entry.path)].sort());
for (const entry of manifest.toolingAuthority.entries) {
  const bytes = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(bytes.byteLength, entry.size, `${entry.path}_tool_size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path}_tool_hash`);
}

assert.deepEqual(manifest.verification.blackbox.journeys, ["KEYWORD_JOURNAL", "PARTIAL_JOURNAL", "KEYWORD_TAIWAN"]);
assert.deepEqual(manifest.verification.blackbox.viewports, ["1440x900", "390x844", "360x640"]);
assert.equal(manifest.verification.blackbox.axeSeriousCritical, 0);
assert.equal(manifest.verification.blackbox.cardSwitchAdditionalEffects, 0);
assert.equal(manifest.verification.blackbox.reloadAdditionalEffects, 0);
assert.equal(manifest.verification.productionHttp.pageGet, 404);
assert.equal(manifest.verification.productionHttp.apiGet, 404);
assert.equal(manifest.verification.productionHttp.apiPost, 404);
assert.equal(manifest.verification.serverEgress.serverTestProcessObservedEgress, 0);
assert.equal(manifest.verification.secretBoundary.secretLeaks, 0);
assert.equal(manifest.effectCounts.formalResearchWriteEndpointsCalled, 0);
assert.equal(manifest.effectCounts.onlineDatabaseConnections, 0);
assert.equal(manifest.effectCounts.externalMutations, 0);

for (const residue of ["Old Mike Beta1 local functional isolated workspace", "Old Mike Beta1 production behavior isolated workspace"]) {
  await assert.rejects(stat(path.resolve(workspaceRoot, "..", residue)), { code: "ENOENT" });
}

console.log(JSON.stringify({
  status: "PASS",
  actionId: manifest.actionId,
  productTreeFiles: tree.fileCount,
  productTreeSha256: tree.aggregateSha256,
  changedFiles: manifest.changedFiles.length,
  toolingEntries: manifest.toolingAuthority.entries.length,
  manifestSha256: sha256(manifestBytes),
  focusedHandoff: "PASS_CURRENT_THREE_JOURNEY_CLOSURE",
  thirdPartyUat: "NOT_EXECUTED",
  releaseAuthority: "NOT_GRANTED",
}));
