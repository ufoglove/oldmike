import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_RESULT_MANIFEST.json");
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
assert.deepEqual(Object.keys(manifest).sort(), ["actionId", "changedFiles", "contractVersion", "effects", "evidence", "gates", "milestoneId", "next", "status"]);
assert.equal(manifest.contractVersion, "old-mike-v2-alpha6-result-manifest/1");
assert.equal(manifest.actionId, "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA6_MANUSCRIPT_AND_ACADEMIC_WRITING_STUDIO_VERTICAL_SLICE_V1");
assert.equal(manifest.status, "FROZEN_LOCAL_PASS");
assert.equal(manifest.changedFiles.length, 20);
assert.equal(new Set(manifest.changedFiles.map((entry) => entry.path)).size, manifest.changedFiles.length);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
for (const entry of manifest.changedFiles) {
  assert.deepEqual(Object.keys(entry).sort(), ["path", "sha256", "size"]);
  assert.match(entry.path, /^(?![A-Za-z]:|[\\/]|.*(?:^|[\\/])\.\.(?:[\\/]|$)).+/u);
  assert.match(entry.sha256, /^[0-9a-f]{64}$/u);
  const bytes = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(bytes.byteLength, entry.size, `${entry.path} size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path} sha256`);
}
for (const required of [
  "research-portal/lib/v2-alpha6/contracts.ts",
  "research-portal/lib/v2-alpha6/runtime.ts",
  "research-portal/components/v2-alpha6/V2Alpha6ManuscriptWorkspace.tsx",
  "research-portal/app/api/v2-alpha6/workspace/route.ts",
  "alpha6-uat-tooling/alpha6-local-functional-uat.mjs",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_THIRD_PARTY_UAT_BRIEF.md"
]) assert(manifest.changedFiles.some((entry) => entry.path === required), `${required} manifest binding`);
assert.equal(manifest.gates.acceptanceGroups, 8);
assert.equal(manifest.gates.contractAssertions, 71);
assert.equal(manifest.gates.browserJourneys, 3);
assert.deepEqual(manifest.gates.viewports, ["1440x900", "390x844", "360x640"]);
assert.equal(manifest.effects.liveProviderCalls, 0);
assert.equal(manifest.effects.onlineDatabaseConnections, 0);
assert.equal(manifest.effects.formalResearchWrites, 0);
assert.equal(manifest.effects.externalMutations, 0);
assert.equal(manifest.next.alpha7, "NOT_STARTED");
assert.equal(manifest.next.legacyM06, "NOT_STARTED");
console.log(JSON.stringify({ status: "PASS", changedFiles: manifest.changedFiles.length, checksums: manifest.changedFiles.length, manifestSha256: sha256(manifestBytes), externalMutations: 0 }));
