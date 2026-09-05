import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA5_RESULT_MANIFEST.json");
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.contractVersion, "old-mike-v2-alpha5/result-manifest/1");
assert.equal(manifest.actionId, "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA5_TAIWAN_PROPOSAL_ONE_CLICK_VERTICAL_SLICE_V1");
assert.equal(manifest.status, "LOCAL_ALPHA5_PASS_READY_FOR_INDEPENDENT_THIRD_PARTY_UAT");
assert.equal(manifest.currentPublic, "V1_5_30_C2R4_BR3_PRESERVED");
assert.equal(manifest.tests.acceptanceGroups, 8);
assert.equal(manifest.external.networkCalls, 0);
assert.equal(manifest.external.onlineDatabaseWrites, 0);
assert.equal(manifest.external.formalResearchWrites, 0);
assert.equal(manifest.external.externalMutations, 0);
assert.equal(manifest.persistence.migrationRequired, "NO");
assert.equal(manifest.release.archiveCreated, false);
assert.equal(new Set(manifest.changedFiles.map((item) => item.path)).size, manifest.changedFiles.length);
for (const entry of manifest.changedFiles) {
  const absolute = path.resolve(workspaceRoot, entry.path);
  assert.ok(absolute.startsWith(`${workspaceRoot}${path.sep}`));
  const bytes = await readFile(absolute);
  assert.equal((await stat(absolute)).size, entry.size, `size ${entry.path}`);
  assert.equal(sha256(bytes), entry.sha256, `hash ${entry.path}`);
}
for (const [relative, expected] of Object.entries(manifest.frozenAuthorities)) assert.equal(sha256(await readFile(path.join(workspaceRoot, relative))), expected, `frozen ${relative}`);
assert.deepEqual(manifest.changedFiles.filter((entry) => entry.path.startsWith("OLD_MIKE_V2_ALPHA5_SCREEN_EVIDENCE/")).map((entry) => entry.path).sort(), ["OLD_MIKE_V2_ALPHA5_SCREEN_EVIDENCE/desktop-1440x900.png", "OLD_MIKE_V2_ALPHA5_SCREEN_EVIDENCE/mobile-360x640.png", "OLD_MIKE_V2_ALPHA5_SCREEN_EVIDENCE/mobile-390x844.png"]);
assert.ok(manifest.changedFiles.some((entry) => entry.path === "research-portal/lib/v2-alpha5/runtime.ts"));
assert.ok(manifest.changedFiles.some((entry) => entry.path === "alpha5-uat-tooling/alpha5-local-functional-uat.mjs"));
assert.ok(manifest.changedFiles.every((entry) => !/\.zip$/iu.test(entry.path)));
console.log(JSON.stringify({ status: "PASS", manifestSha256: sha256(manifestBytes), changedFiles: manifest.changedFiles.length, frozenAuthorities: Object.keys(manifest.frozenAuthorities).length, screenEvidence: 3, archivesCreated: 0 }));
