import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA4_R1_RESULT_MANIFEST.json");
const frozenManifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA4_RESULT_MANIFEST.json");
const frozenManifestHash = "d92608b347f02d6037852978b3ddd7defbd9146fc68a54b171436b0c2ffaa558";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const expectedChangedFiles = [
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA4_R1_THIRD_PARTY_UAT_BRIEF.md",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA4_R1_ZOTERO_CITATION_CENTER.md",
  "OLD_MIKE_V2_ALPHA4_R1_SCREEN_EVIDENCE/alpha4-r1-desktop-1440x900.png",
  "OLD_MIKE_V2_ALPHA4_R1_SCREEN_EVIDENCE/alpha4-r1-mobile-360x640.png",
  "OLD_MIKE_V2_ALPHA4_R1_SCREEN_EVIDENCE/alpha4-r1-mobile-390x844.png",
  "research-portal/app/api/v2-alpha4-r1/zotero/route.ts",
  "research-portal/app/v2-alpha4-r1-local/page.tsx",
  "research-portal/components/v2-alpha4-r1/V2Alpha4R1ZoteroCenter.tsx",
  "research-portal/components/v2-alpha4-r1/v2-alpha4-r1.module.css",
  "research-portal/lib/v2-alpha4-r1/page-authority.ts",
  "research-portal/lib/v2-alpha4-r1/zotero-contracts.ts",
  "research-portal/scripts/run-v2-alpha4-r1-browser-disposable.ps1",
  "research-portal/scripts/verify-v2-alpha4-r1-browser.mjs",
  "research-portal/scripts/verify-v2-alpha4-r1-client-boundary.mjs",
  "research-portal/scripts/verify-v2-alpha4-r1-handoff.mjs",
  "research-portal/scripts/verify-v2-alpha4-r1-production-boundary.mjs",
  "research-portal/scripts/verify-v2-alpha4-r1-zotero-contracts.mjs",
].sort();

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
assert.equal(manifest.contractVersion, "old-mike-v2-alpha4-r1/result-manifest/1");
assert.equal(manifest.parentActionId, "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA4_OUTPUT_TARGET_AND_SCIE_SSCI_JOURNAL_LIFECYCLE_VERTICAL_SLICE");
assert.equal(manifest.buildId, "ALPHA4_R1");
assert.equal(manifest.status, "LOCAL_ALPHA4_R1_PASS_READY_FOR_BRAIN_REVIEW");
assert.deepEqual(manifest.changedFiles.map(({ path: filePath }) => filePath).sort(), expectedChangedFiles);
assert.equal(new Set(manifest.changedFiles.map(({ path: filePath }) => filePath)).size, expectedChangedFiles.length);
for (const entry of manifest.changedFiles) {
  const bytes = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(bytes.byteLength, entry.size, `${entry.path}:size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path}:sha256`);
}

const frozenBytes = await readFile(frozenManifestPath);
assert.equal(sha256(frozenBytes), frozenManifestHash, "frozen_alpha4_manifest_sha256");
const frozenManifest = JSON.parse(frozenBytes);
assert.equal(frozenManifest.status, "LOCAL_ALPHA4_PASS_READY_FOR_BRAIN_REVIEW");
for (const entry of frozenManifest.changedFiles) {
  const bytes = await readFile(path.join(workspaceRoot, entry.path));
  assert.equal(bytes.byteLength, entry.size, `${entry.path}:frozen_size`);
  assert.equal(sha256(bytes), entry.sha256, `${entry.path}:frozen_sha256`);
}
for (const [filePath, expected] of Object.entries(manifest.frozenAuthorities)) assert.equal(sha256(await readFile(path.join(workspaceRoot, filePath))), expected, `${filePath}:frozen_authority`);

assert.deepEqual(manifest.zoteroGates, {
  userFacingAuthority: "PASS_ZOTERO_LIBRARY_CITATION_CENTER_PORTAL_EVIDENCE_AUTHORITY",
  explicitCollection: "PASS_NO_DEFAULT_SIX_PROJECT_COLLECTIONS",
  exactActions: "PASS_FIVE_ACTIONS",
  dedupe: "PASS_DOI_STABLE_ID_EXACT_METADATA_FUZZY_REVIEW_NO_AUTO_MERGE",
  interchange: "PASS_RIS_BIBTEX_CSL_JSON_MALFORMED_SIBLING_ISOLATION",
  stableBinding: "PASS_ITEM_KEY_METADATA_HASH_PROJECT_COLLECTION_SCOPE",
  versionConflict: "PASS_412_VISIBLE_ZERO_BLIND_OVERWRITE",
  deletion: "PASS_TOMBSTONE_PRESERVES_PORTAL_CITATION_SNAPSHOT",
  bibliography: "PASS_PINNED_CSL_REPRODUCIBLE_AND_INDEPENDENT_AUDIT",
  dataMinimisation: "PASS_METADATA_SELECTED_NOTES_NO_ATTACHMENT_PDF_FULLTEXT_RAW_BODY",
  productionBoundary: "PASS_PAGE_API_404",
});
assert.equal(manifest.tests.focusedContractAssertions, 34);
assert.equal(manifest.tests.focusedContractScenarioGroups, 8);
assert.equal(manifest.tests.browserViewports, 3);
assert.equal(manifest.tests.browserUiActions, 5);
assert.equal(manifest.tests.browserRouteNegativeFixtures, 4);
assert.equal(manifest.tests.axeAllImpacts, 0);
assert.equal(manifest.tests.productionBoundarySubgates, 2);
assert.equal(manifest.tests.clientBundleSecretProviderIdentityMatches, 0);
assert.equal(manifest.persistence.migrationRequired, "NO");
assert.equal(manifest.residual.liveWebApiBinding, "DISABLED_UNCONFIGURED_UNTESTED_REQUIRES_SEPARATE_OWNER_DECISION");
assert.deepEqual(manifest.external, {
  networkCalls: 0,
  liveZoteroApiCalls: 0,
  credentialOrKeyAccess: 0,
  onlineDatabaseConnections: 0,
  onlineDatabaseWrites: 0,
  formalResearchWrites: 0,
  externalMutations: 0,
  deployment: "NOT_EXECUTED",
  uat: "NOT_EXECUTED",
  alpha5: "NOT_STARTED",
  m06: "NOT_STARTED",
});
assert.equal(manifest.safeNextAction, "BRAIN_REVIEW_ALPHA4_R1_AND_DISPATCH_EXACT_THIRD_PARTY_LOCAL_UAT_ONLY");
assert.equal(manifest.exitCode, 0);
console.log(`PASS V2_ALPHA4_R1_HANDOFF files=${manifest.changedFiles.length} checksums=${manifest.changedFiles.length} frozen_alpha4_files=${frozenManifest.changedFiles.length} screens=3 ddl=none live_api=disabled`);
