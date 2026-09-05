import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA4_RESULT_MANIFEST.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const expectedChangedFiles = [
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA4_IMPLEMENTATION_AND_JOURNAL_LIFECYCLE.md",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA4_THIRD_PARTY_UAT_BRIEF.md",
  "OLD_MIKE_V2_ALPHA4_OPERATION_REGISTRY.md",
  "OLD_MIKE_V2_ALPHA4_SCREEN_EVIDENCE/alpha4-desktop-1440x900.png",
  "OLD_MIKE_V2_ALPHA4_SCREEN_EVIDENCE/alpha4-mobile-360x640.png",
  "OLD_MIKE_V2_ALPHA4_SCREEN_EVIDENCE/alpha4-mobile-390x844.png",
  "research-portal/app/api/v2-alpha4/workspace/route.ts",
  "research-portal/app/v2-alpha4-local/page.tsx",
  "research-portal/components/v2-alpha4/V2Alpha4JournalWorkspace.tsx",
  "research-portal/components/v2-alpha4/v2-alpha4.module.css",
  "research-portal/lib/v2-alpha4/catalog.ts",
  "research-portal/lib/v2-alpha4/contracts.ts",
  "research-portal/lib/v2-alpha4/page-authority.ts",
  "research-portal/lib/v2-alpha4/runtime.ts",
  "research-portal/package.json",
  "research-portal/scripts/run-v2-alpha4-browser-disposable.ps1",
  "research-portal/scripts/verify-v2-alpha4-browser.mjs",
  "research-portal/scripts/verify-v2-alpha4-client-boundary.mjs",
  "research-portal/scripts/verify-v2-alpha4-contracts.mjs",
  "research-portal/scripts/verify-v2-alpha4-handoff.mjs",
  "research-portal/scripts/verify-v2-alpha4-production-boundary.mjs",
].sort();

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
assert.equal(manifest.contractVersion, "old-mike-v2-alpha4/result-manifest/1");
assert.equal(manifest.actionId, "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA4_OUTPUT_TARGET_AND_SCIE_SSCI_JOURNAL_LIFECYCLE_VERTICAL_SLICE");
assert.equal(manifest.status, "LOCAL_ALPHA4_PASS_READY_FOR_BRAIN_REVIEW");
assert.deepEqual(manifest.changedFiles.map(({ path: filePath }) => filePath).sort(), expectedChangedFiles);
assert.equal(new Set(manifest.changedFiles.map(({ path: filePath }) => filePath)).size, expectedChangedFiles.length);

for (const entry of manifest.changedFiles) {
  const absolute = path.join(workspaceRoot, entry.path);
  const bytes = await readFile(absolute);
  assert.equal(bytes.byteLength, entry.size, `${entry.path}:size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path}:sha256`);
}
for (const [filePath, expected] of Object.entries(manifest.frozenAuthorities)) {
  assert.equal(sha256(await readFile(path.join(workspaceRoot, filePath))), expected, `${filePath}:frozen`);
}

assert.equal(manifest.tests.focusedContractAssertions, 55);
assert.equal(manifest.tests.browserViewports, 3);
assert.equal(manifest.tests.axeAllImpacts, 0);
assert.equal(manifest.tests.productionBoundarySubgates, 2);
assert.equal(manifest.tests.clientBundleSecretProviderIdentityMatches, 0);
assert.equal(manifest.persistence.migrationRequired, "NO");
assert.equal(manifest.persistence.ddlDescriptor, null);
assert.deepEqual(manifest.external, {
  networkCalls: 0,
  liveProviderCalls: 0,
  liveScholarlyOrPublisherCalls: 0,
  onlineDatabaseConnections: 0,
  onlineDatabaseWrites: 0,
  formalResearchWrites: 0,
  externalSubmissions: 0,
  externalMutations: 0,
  deployment: "NOT_EXECUTED",
  migration: "NOT_EXECUTED",
  uat: "NOT_EXECUTED",
  alpha5: "NOT_STARTED",
  m06: "NOT_STARTED",
});
assert.equal(manifest.safeNextAction, "BRAIN_REVIEW_ALPHA4_AND_DISPATCH_EXACT_THIRD_PARTY_LOCAL_UAT_ONLY");
assert.equal(manifest.exitCode, 0);

const packageJson = JSON.parse(await readFile(path.join(portalRoot, "package.json"), "utf8"));
for (const script of ["test:v2-alpha4:contracts", "test:v2-alpha4:browser", "test:v2-alpha4:production-boundary", "test:v2-alpha4:client-boundary"]) assert.equal(typeof packageJson.scripts[script], "string", `${script}:missing`);

console.log(`PASS V2_ALPHA4_HANDOFF files=${manifest.changedFiles.length} checksums=${manifest.changedFiles.length} frozen=${Object.keys(manifest.frozenAuthorities).length} screens=3 ddl=none`);
