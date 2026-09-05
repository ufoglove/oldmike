import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const bytesFor = async (relative) => readFile(path.join(workspaceRoot, ...relative.split("/")));

const manifestBody = await bytesFor("OLD_MIKE_RESEARCH_OS_V2_ALPHA2_RESULT_MANIFEST.json");
const manifest = JSON.parse(manifestBody.toString("utf8"));
assert.equal(manifest.actionId, "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA2_DURABLE_RESEARCH_START_VERTICAL_SLICE");
assert.equal(manifest.status, "COMPLETED_LOCAL_ALPHA2_CANDIDATE");
assert.equal(manifest.effects.externalMutations, 0);
assert.equal(manifest.effects.onlineDatabaseConnections, 0);
assert.equal(manifest.effects.onlineDatabaseWrites, 0);
assert.equal(manifest.effects.formalResearchWrites, 0);
assert.equal(manifest.effects.archiveOrZipCreated, false);

const recalculated = [];
for (const expected of manifest.changedFiles) {
  const body = await bytesFor(expected.path);
  const details = await stat(path.join(workspaceRoot, ...expected.path.split("/")));
  assert.equal(details.size, expected.bytes, `v2_alpha2_size:${expected.path}`);
  assert.equal(sha256(body), expected.sha256, `v2_alpha2_sha:${expected.path}`);
  recalculated.push(`${expected.path}:${details.size}:${expected.sha256}`);
}
assert.equal(sha256(recalculated.join("\n")), manifest.changedFileAggregateSha256);
assert.equal(sha256(await bytesFor("research-portal/database/proposals/v2-alpha2-research-generation.up.sql")), manifest.migration.ddlSha256);

const alpha1Body = await bytesFor("OLD_MIKE_RESEARCH_OS_V2_ALPHA1_RESULT_MANIFEST.json");
assert.equal(sha256(alpha1Body), manifest.alpha1AuthoritySha256);
const alpha1 = JSON.parse(alpha1Body.toString("utf8"));
for (const item of [...alpha1.changedFiles, ...alpha1.screenEvidence]) {
  const body = await bytesFor(item.path);
  assert.equal(body.length, item.bytes, `alpha1_size:${item.path}`);
  assert.equal(sha256(body), item.sha256, `alpha1_sha:${item.path}`);
}
for (const item of manifest.immutabilityEvidence) {
  const body = await bytesFor(item.path);
  assert.equal(sha256(body), item.sha256, `historical_sha:${item.path}`);
  if (item.lines) assert.equal(body.toString("utf8").split(/\r?\n/u).length - (body.toString("utf8").endsWith("\n") ? 1 : 0), item.lines, `historical_lines:${item.path}`);
}
const rootEntries = await readdir(workspaceRoot);
assert.equal(rootEntries.some((name) => /^\.release-.*alpha2/iu.test(name)), false, "alpha2_archive_forbidden");

console.log(`V2_ALPHA2_HANDOFF_FILES_VERIFIED=${manifest.changedFiles.length}`);
console.log(`V2_ALPHA2_RESULT_MANIFEST_SHA256=${sha256(manifestBody)}`);
console.log(`V2_ALPHA2_CHANGED_FILE_AGGREGATE_SHA256=${manifest.changedFileAggregateSha256}`);
console.log(`V2_ALPHA2_DDL_SHA256=${manifest.migration.ddlSha256}`);
console.log("V2_ALPHA2_ALPHA1_IMMUTABILITY=PASS");
console.log("V2_ALPHA2_BR3_BR4_ARCHIVE_IMMUTABILITY=PASS");
console.log("V2_ALPHA2_HANDOFF=PASS");
