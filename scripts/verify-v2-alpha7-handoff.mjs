import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_RESULT_MANIFEST.json");
const expectedBaselineHash = "63023416bc4c19bda688e6459491e7dc4535b5a20af3ac22617f5b5fdf2c213e";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exists = (target) => lstat(target).then(() => true, () => false);

const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.contractVersion, "old-mike-v2-alpha7-result-manifest/1");
assert.equal(manifest.actionId, "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA7_REVIEW_REVISION_AND_RESPONSE_STUDIO_VERTICAL_SLICE_V1");
assert.equal(manifest.status, "FROZEN_LOCAL_PASS");
assert.equal(manifest.baseline.sha256, expectedBaselineHash);
assert.equal(sha256(await readFile(path.join(workspaceRoot, manifest.baseline.path))), expectedBaselineHash);
assert.equal(manifest.changedFiles.length, 19);
assert.equal(new Set(manifest.changedFiles.map((entry) => entry.path)).size, manifest.changedFiles.length);
for (const entry of manifest.changedFiles) {
  assert.match(entry.path, /^(?!.*(?:^|\/)\.\.?(?:\/|$)).+$/u);
  assert.match(entry.sha256, /^[0-9a-f]{64}$/u);
  const absolute = path.join(workspaceRoot, entry.path);
  const bytes = await readFile(absolute);
  assert.equal(bytes.byteLength, entry.size, `${entry.path} size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path} hash`);
}
const result = JSON.parse(await readFile(path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_FOCUSED_RESULT.json"), "utf8"));
assert.equal(result.status, "LOCAL_FOCUSED_PASS");
assert.equal(result.gates.acceptanceGroups, 8);
assert.equal(result.gates.contractAssertions, 60);
assert.equal(result.effects.formalResearchWrites, 0);
assert.equal(result.effects.externalMutations, 0);
const packageJson = JSON.parse(await readFile(path.join(portalRoot, "package.json"), "utf8"));
for (const script of ["test:v2-alpha7:contracts", "test:v2-alpha7:browser", "test:v2-alpha7:production-boundary", "test:v2-alpha7:client-boundary", "test:v2-alpha7:handoff", "freeze:v2-alpha7"]) assert.equal(typeof packageJson.scripts[script], "string", script);
const isolatedRoot = "D:\\Users\\Administrator\\Desktop\\老麥科研網站\\Old_Mike_Codex_Workspace_v1.5.3_worktree\\Old Mike Alpha7 focused UAT isolated workspace";
assert.equal(await exists(isolatedRoot), false);
console.log(JSON.stringify({ status: "PASS", manifestSha256: sha256(manifestBytes), changedFiles: manifest.changedFiles.length, baseline: "PASS", hashes: "PASS", isolatedCleanup: "PASS_ZERO_TEMP", formalResearchWrites: 0, externalMutations: 0 }));
