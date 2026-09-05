import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectProductCopyTree } from "../../alpha4-uat-tooling/lib/product-copy-tree-authority.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(portalRoot, "..");
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_BETA1_THREE_JOURNEY_PRODUCT_AND_RECEIPT_CLOSURE_2_MANIFEST.json");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const priorAuthorities = Object.freeze([
  Object.freeze({ path: "OLD_MIKE_RESEARCH_OS_V2_BETA1_THREE_JOURNEY_ADVERSARIAL_CLOSURE_1_MANIFEST.json", size: 10702, sha256: "c0bf047f7baa9108706e2400524dc383a195ca56a7a3452571865da9ac3b06b5" }),
  Object.freeze({ path: "OLD_MIKE_RESEARCH_OS_V2_BETA1_THREE_JOURNEY_ADVERSARIAL_CLOSURE_1_RESULT.md", size: 3813, sha256: "c203aad8c4841270249ea7baaaf05e665560d7d6cb9e59040133fd34aa9ddc88" }),
  Object.freeze({ path: "OLD_MIKE_RESEARCH_OS_V2_BETA1_THREE_JOURNEY_ADVERSARIAL_CLOSURE_1_UAT_BRIEF.md", size: 3193, sha256: "e16fd1f7ebc4f52f50df24e8253fb33b40ea100b0ca20ecac498569eb778b278" }),
]);

async function checkedEntry(entry, suffix = "") {
  const bytes = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(bytes.byteLength, entry.size, `${entry.path}${suffix}_size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path}${suffix}_sha256`);
  return bytes;
}

const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
assert.equal(manifest.contractVersion, "old-mike-v2-beta1-product-receipt-closure-manifest/1");
assert.equal(manifest.actionId, "LOCAL_V2_BETA1_THIN_ADAPTERS_AND_THREE_JOURNEY_CLOSURE");
assert.equal(manifest.subactionId, "BRAIN_REVIEW_THREE_JOURNEY_PRODUCT_AND_RECEIPT_CLOSURE_2");
assert.equal(manifest.status, "LOCAL_CANDIDATE_FOCUSED_CLOSURE_PASS_SELF_TEST_ONLY");
assert.equal(manifest.thirdPartyUat, "NOT_EXECUTED");
assert.equal(manifest.releaseAuthority, "NOT_GRANTED");

const localDescriptor = JSON.parse(await readFile(path.join(workspaceRoot, "beta1-uat-tooling/beta1-local-functional.descriptor.json"), "utf8"));
const productionDescriptor = JSON.parse(await readFile(path.join(workspaceRoot, "beta1-uat-tooling/beta1-production-behavior.descriptor.json"), "utf8"));
const productTree = await collectProductCopyTree(portalRoot, localDescriptor.copyExclusions);
const currentTree = { contractVersion: productTree.contractVersion, fileCount: productTree.fileCount, totalBytes: productTree.totalBytes, aggregateSha256: productTree.aggregateSha256 };
assert.deepEqual(manifest.productTree, currentTree);
assert.deepEqual(localDescriptor.productTreeAuthority, currentTree);
assert.deepEqual(productionDescriptor.productTreeAuthority, currentTree);

for (const key of ["preAction", "postAction", "delta"]) await checkedEntry(manifest.productTreeAuthority[key], `_${key}`);
const preTree = JSON.parse((await checkedEntry(manifest.productTreeAuthority.preAction)).toString("utf8")).productTree;
const postTree = JSON.parse((await checkedEntry(manifest.productTreeAuthority.postAction)).toString("utf8")).productTree;
const delta = JSON.parse((await checkedEntry(manifest.productTreeAuthority.delta)).toString("utf8"));
assert.equal(preTree.aggregateSha256, "83da949a4a80e3ccf29737895f1652bf69c037aae5ec3b228761b14c805d95d4");
assert.deepEqual({ contractVersion: postTree.contractVersion, fileCount: postTree.fileCount, totalBytes: postTree.totalBytes, aggregateSha256: postTree.aggregateSha256 }, currentTree);
assert.deepEqual(postTree.entries, productTree.entries);
const preByPath = new Map(preTree.entries.map((entry) => [entry.path, entry]));
const postByPath = new Map(postTree.entries.map((entry) => [entry.path, entry]));
const expectedAdded = postTree.entries.filter((entry) => !preByPath.has(entry.path));
const expectedRemoved = preTree.entries.filter((entry) => !postByPath.has(entry.path));
const expectedModified = postTree.entries.filter((entry) => preByPath.has(entry.path) && (preByPath.get(entry.path).size !== entry.size || preByPath.get(entry.path).sha256 !== entry.sha256)).map((entry) => ({ before: preByPath.get(entry.path), after: entry }));
assert.deepEqual(delta.added, expectedAdded);
assert.deepEqual(delta.removed, expectedRemoved);
assert.deepEqual(delta.modified, expectedModified);

assert.deepEqual(manifest.priorCandidateAuthorities, priorAuthorities);
for (const authority of priorAuthorities) await checkedEntry(authority, "_immutable");
for (const list of [manifest.changedFiles, manifest.toolingAuthority.entries]) {
  assert.equal(new Set(list.map((entry) => entry.path)).size, list.length);
  assert.deepEqual(list.map((entry) => entry.path), [...list.map((entry) => entry.path)].sort());
  for (const entry of list) await checkedEntry(entry);
}

assert.equal(manifest.verification.productReceiptContracts.groups, 6);
assert.equal(manifest.verification.httpRouteMatrix.scenarios, 15);
assert.equal(manifest.verification.consumerContracts.cases, 23);
assert.equal(manifest.verification.blackbox.oneChromiumSession, true);
assert.deepEqual(manifest.verification.blackbox.journeys, ["KEYWORD_JOURNAL", "PARTIAL_JOURNAL", "KEYWORD_TAIWAN"]);
assert.deepEqual(manifest.verification.blackbox.viewports, ["1440x900", "390x844", "360x640"]);
assert.equal(manifest.verification.blackbox.cardSwitchAdditionalEffects, 0);
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

console.log(JSON.stringify({ status: "PASS", actionId: manifest.actionId, subactionId: manifest.subactionId, preActionProductTreeSha256: preTree.aggregateSha256, postActionProductTreeSha256: productTree.aggregateSha256, productTreeFiles: productTree.fileCount, delta: { added: delta.added.length, modified: delta.modified.length, removed: delta.removed.length }, changedFiles: manifest.changedFiles.length, manifestSha256: sha256(manifestBytes), focusedHandoff: "PASS", priorCandidateImmutability: "PASS", thirdPartyUat: "NOT_EXECUTED", releaseAuthority: "NOT_GRANTED" }));
