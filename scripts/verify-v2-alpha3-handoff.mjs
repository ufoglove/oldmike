import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA3_RESULT_MANIFEST.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

assert.equal(manifest.actionId, "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA3_DOMAIN_CHAT_LITERATURE_INTELLIGENCE_VERTICAL_SLICE");
assert.equal(manifest.status, "LOCAL_ALPHA3_PASS_READY_FOR_BRAIN_REVIEW");
assert.equal(manifest.external.networkCalls, 0);
assert.equal(manifest.external.onlineDatabaseConnections, 0);
assert.equal(manifest.external.formalResearchWrites, 0);
assert.equal(manifest.external.externalMutations, 0);
assert.equal(manifest.external.deployment, "NOT_EXECUTED");
assert.equal(manifest.external.alpha4, "NOT_STARTED");
assert.equal(manifest.external.m06, "NOT_STARTED");

assert.ok(Array.isArray(manifest.changedFiles) && manifest.changedFiles.length >= 25);
assert.equal(new Set(manifest.changedFiles.map((item) => item.path)).size, manifest.changedFiles.length);
for (const entry of manifest.changedFiles) {
  assert.match(entry.sha256, /^[0-9a-f]{64}$/u);
  const absolute = path.resolve(workspaceRoot, entry.path);
  assert.ok(absolute.startsWith(workspaceRoot + path.sep));
  const [bytes, metadata] = await Promise.all([readFile(absolute), stat(absolute)]);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.size, entry.size);
  assert.equal(sha256(bytes), entry.sha256, `changed_file_hash_mismatch:${entry.path}`);
}

const frozen = {
  "research-portal/lib/research-config.ts": "e8ed6e6432d1cd44dbcc7dcd91ae8224a3b7b0bf49d7e9e5d13928d1650810e3",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA1_RESULT_MANIFEST.json": "ac005cea580c9c579436df669a4e065301ee59476bc056304131b036aa98f196",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA2_RESULT_MANIFEST.json": "86d8b9bfcaa7f5f0d0341680dd375db4d4f28af806e1f901bcf62a8f5bdc0117",
  ".release-v1.5.30-c2r4-br3-final/Old_Mike_Research_Portal_v1.5.30-c2r4-br3.zip": "7515acca88e14482b3543a9ea80a4af5c132aaf4d7473b3314f46e59674f562c",
  ".release-v1.5.30-c2r4-br3-final/Old_Mike_Codex_Workspace_v1.5.30-c2r4-br3.zip": "f98be320325c86c2e53b546a29148b1d7ea7e397b88623767d77990cc51c1aaa",
  ".release-v1.5.30-c2r4-br4-final/Old_Mike_Research_Portal_v1.5.30-c2r4-br4.zip": "b65f8e65db7e01778332f19eb72cebd4d3b017415ae0d40a2cbc348c3e7a082e",
  ".release-v1.5.30-c2r4-br4-final/Old_Mike_Codex_Workspace_v1.5.30-c2r4-br4.zip": "701b7e01070c37d807b328fa9f478630b748851d966cea887510160e1e0ed007",
};
assert.deepEqual(manifest.frozenAuthorities, frozen);
for (const [relative, expected] of Object.entries(frozen)) assert.equal(sha256(await readFile(path.join(workspaceRoot, relative))), expected, `frozen_authority_changed:${relative}`);

const descriptor = JSON.parse(await readFile(path.join(portalRoot, "database/proposals/v2-alpha3-domain-chat-literature.descriptor.json"), "utf8"));
for (const [kind, relative] of Object.entries({ up: "up.sql", down: "down.sql", verify: "verify.sql", reconcile: "reconcile.sql" })) {
  const bytes = await readFile(path.join(portalRoot, `database/proposals/v2-alpha3-domain-chat-literature.${relative}`));
  assert.equal(sha256(bytes), descriptor.sha256[kind]);
}

for (const [name, width, height] of [["alpha3-desktop-1440x900.png", 1440, 900], ["alpha3-mobile-390x844.png", 390, 844], ["alpha3-mobile-360x640.png", 360, 640]]) {
  const bytes = await readFile(path.join(workspaceRoot, "OLD_MIKE_V2_ALPHA3_SCREEN_EVIDENCE", name));
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(bytes.readUInt32BE(16), width);
  assert.equal(bytes.readUInt32BE(20), height);
}

assert.deepEqual(manifest.reviewAdoption, { adopted: 8, deviations: 0, capacityClaim: "NOT_MADE_NO_LIVE_INVENTORY" });
console.log(`PASS V2_ALPHA3_HANDOFF changed_files=${manifest.changedFiles.length} frozen_authorities=${Object.keys(frozen).length} screen_evidence=3 external_mutations=0`);
