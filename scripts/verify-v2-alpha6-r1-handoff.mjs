import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_R1_RESULT_MANIFEST.json");
const bytes = await readFile(manifestPath);
const manifest = JSON.parse(bytes.toString("utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

assert.deepEqual(Object.keys(manifest).sort(), ["actionId", "changedFiles", "contractVersion", "directDependencies", "effects", "gates", "milestoneId", "next", "sourceCandidate", "status"]);
assert.equal(manifest.contractVersion, "old-mike-v2-alpha6-r1-result-manifest/1");
assert.equal(manifest.actionId, "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA6_R1_SEMANTIC_LANGUAGE_TRANSFORMATION_QUALITY_CLOSURE");
assert.equal(manifest.status, "FROZEN_LOCAL_FOCUSED_PASS");
assert.deepEqual(manifest.sourceCandidate, { path: "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_RESULT_MANIFEST.json", sha256: "0e0b4b040125b8525873279941dd773d06a9d7513c6201af9b8cde6ab379f8e4", disposition: "FROZEN_NO_GO_DO_NOT_DEPLOY" });
assert.equal(manifest.changedFiles.length, 18);
assert.equal(manifest.directDependencies.length, 6);
assert.equal(new Set(manifest.changedFiles.map((entry) => entry.path)).size, manifest.changedFiles.length);
assert.equal(new Set(manifest.directDependencies.map((entry) => entry.path)).size, manifest.directDependencies.length);

for (const entry of [...manifest.changedFiles, ...manifest.directDependencies, manifest.sourceCandidate]) {
  assert.match(entry.path, /^(?![A-Za-z]:|[\\/]|.*(?:^|[\\/])\.\.(?:[\\/]|$)).+/u);
  assert.match(entry.sha256, /^[0-9a-f]{64}$/u);
  const actual = await readFile(path.join(workspaceRoot, entry.path));
  if ("size" in entry) assert.equal(actual.byteLength, entry.size, `${entry.path} size`);
  assert.equal(sha256(actual), entry.sha256, `${entry.path} sha256`);
}

for (const [name, expected] of Object.entries({
  OLD_MIKE_RESEARCH_OS_V2_ALPHA3_RESULT_MANIFEST_JSON: "0b4006d716b6a62f7132633c0637781fc44ad3bfa40ad62c7bf06fb35146343e",
  OLD_MIKE_RESEARCH_OS_V2_ALPHA4_RESULT_MANIFEST_JSON: "d92608b347f02d6037852978b3ddd7defbd9146fc68a54b171436b0c2ffaa558",
  OLD_MIKE_RESEARCH_OS_V2_ALPHA4_R1_RESULT_MANIFEST_JSON: "fd3828f510b4b53d524b45b05fa023c4110b9b6e11561bff94c26fdb4fd561a1",
  OLD_MIKE_RESEARCH_OS_V2_ALPHA5_RESULT_MANIFEST_JSON: "449d07b09b9e8320045e101716df40d8eb87c6692115e2c91132fd450c574d9d"
})) {
  const fileName = name.replaceAll("_JSON", ".json");
  assert.equal(sha256(await readFile(path.join(workspaceRoot, fileName))), expected, `${fileName} immutable`);
}

assert.equal(manifest.gates.semanticFixtureDomains, 6);
assert.equal(manifest.gates.languageTasks, 4);
assert.equal(manifest.gates.semanticAssertions, 298);
assert.equal(manifest.gates.directApiCases, 5);
assert.equal(manifest.gates.carryForwardContractGroups, 7);
assert.equal(manifest.gates.carryForwardContractAssertions, 77);
assert.deepEqual(manifest.gates.browserViewports, ["1440x900", "390x844"]);
assert.equal(manifest.gates.browserTaskJourneys, 8);
assert.equal(manifest.gates.axe, "PASS_ZERO_SERIOUS_CRITICAL");
assert.equal(manifest.gates.focusedHandoff, "PASS");
assert.equal(manifest.effects.liveModelProviderCalls, 0);
assert.equal(manifest.effects.onlineDatabaseConnections, 0);
assert.equal(manifest.effects.onlineDatabaseWrites, 0);
assert.equal(manifest.effects.formalResearchWrites, 0);
assert.equal(manifest.effects.externalMutations, 0);
assert.equal(manifest.next.alpha7, "NOT_STARTED");
assert.equal(manifest.next.legacyM06, "NOT_STARTED");

const launcher = await readFile(path.join(workspaceRoot, "alpha6-r1-uat-tooling/alpha6-r1-local-functional-uat.mjs"), "utf8");
const descriptor = JSON.parse(await readFile(path.join(workspaceRoot, "alpha6-r1-uat-tooling/alpha6-r1-local-functional-uat.descriptor.json"), "utf8"));
assert.match(launcher, /shell: false/u);
assert.doesNotMatch(launcher, /shell: true|powershell|Invoke-WebRequest/iu);
assert.equal(descriptor.readiness.host, "127.0.0.1");
assert.deepEqual(descriptor.readiness.paths, ["/v2-alpha6-local"]);
assert.equal(descriptor.browserVerifierRelative, "scripts\\verify-v2-alpha6-r1-browser.mjs");

console.log(JSON.stringify({ status: "PASS", changedFiles: manifest.changedFiles.length, directDependencies: manifest.directDependencies.length, manifestSha256: sha256(bytes), sourceCandidateImmutability: "PASS", priorAlphaManifestsImmutability: "PASS", focusedHandoff: "PASS", externalMutations: 0 }));
