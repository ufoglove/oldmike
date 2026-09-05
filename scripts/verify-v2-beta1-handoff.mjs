import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(portalRoot, "..");
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_BETA1_MAIN_WORKSPACE_MANIFEST.json");
const bytes = await readFile(manifestPath);
const manifest = JSON.parse(bytes.toString("utf8"));

assert.equal(manifest.contractVersion, "old-mike-v2-beta1-main-workspace-manifest/1");
assert.equal(manifest.actionId, "LOCAL_V2_BETA1_UNIFIED_PROJECT_TRUTH_UI_AND_BLACKBOX_SLICE");
assert.equal(manifest.status, "LOCAL_CANDIDATE_PASS_SELF_TEST_ONLY");
assert.equal(manifest.releaseAuthority, "NOT_GRANTED");
assert.equal(manifest.thirdPartyUat, "NOT_EXECUTED");
assert.equal(manifest.effectBoundary.liveProviderCalls, 0);
assert.equal(manifest.effectBoundary.onlineDatabaseConnections, 0);
assert.equal(manifest.effectBoundary.onlineDatabaseWrites, 0);
assert.equal(manifest.effectBoundary.formalResearchWrites, 0);
assert.equal(manifest.effectBoundary.externalMutations, 0);
assert.equal(manifest.effectBoundary.deployment, "NOT_EXECUTED");
assert.equal(manifest.effectBoundary.migration, "NOT_EXECUTED");
assert.equal(manifest.effectBoundary.v1Work, "NOT_EXECUTED");
assert.ok(Array.isArray(manifest.changedFiles) && manifest.changedFiles.length >= 12);
assert.equal(new Set(manifest.changedFiles.map((item) => item.path)).size, manifest.changedFiles.length);
assert.deepEqual(manifest.changedFiles.map((item) => item.path), [...manifest.changedFiles.map((item) => item.path)].sort());

for (const entry of manifest.changedFiles) {
  assert.equal(typeof entry.path, "string");
  assert.equal(Number.isInteger(entry.size) && entry.size > 0, true);
  assert.match(entry.sha256, /^[0-9a-f]{64}$/u);
  const absolute = path.resolve(workspaceRoot, entry.path);
  assert.equal(absolute.toLowerCase().startsWith(`${workspaceRoot.toLowerCase()}${path.sep}`), true);
  const current = await readFile(absolute);
  assert.equal(current.byteLength, entry.size, `${entry.path}_size`);
  assert.equal(createHash("sha256").update(current).digest("hex"), entry.sha256, `${entry.path}_hash`);
}

for (const authority of manifest.preservedCoreAuthorities) {
  const current = await readFile(path.resolve(workspaceRoot, authority.path));
  assert.equal(current.byteLength, authority.size, `${authority.path}_preserved_size`);
  assert.equal(createHash("sha256").update(current).digest("hex"), authority.sha256, `${authority.path}_preserved_hash`);
}

await assert.rejects(stat(path.resolve(workspaceRoot, "..", "Old Mike Beta1 local functional isolated workspace")), { code: "ENOENT" });
assert.deepEqual(manifest.screenEvidence.map((item) => item.viewport), ["1440x900", "390x844", "360x640"]);
assert.equal(manifest.screenEvidence.every((item) => /^[0-9a-f]{64}$/u.test(item.screenshotSha256)), true);

console.log(JSON.stringify({ status: "PASS", actionId: manifest.actionId, changedFiles: manifest.changedFiles.length, preservedCoreAuthorities: manifest.preservedCoreAuthorities.length, manifestSha256: createHash("sha256").update(bytes).digest("hex"), focusedHandoff: "PASS", thirdPartyUat: "NOT_EXECUTED", releaseAuthority: "NOT_GRANTED", externalMutations: 0 }));
