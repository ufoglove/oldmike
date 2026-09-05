import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const outputPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_R1_RESULT_MANIFEST.json");
const sourceManifestPath = "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_RESULT_MANIFEST.json";
const sourceManifestSha256 = "0e0b4b040125b8525873279941dd773d06a9d7513c6201af9b8cde6ab379f8e4";
const changedPaths = Object.freeze([
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_R1_FOCUSED_RESULT.json",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_R1_IMPLEMENTATION_BRIEF.md",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_R1_THIRD_PARTY_UAT_BRIEF.md",
  "alpha6-r1-uat-tooling/alpha6-r1-local-functional-uat.descriptor.json",
  "alpha6-r1-uat-tooling/alpha6-r1-local-functional-uat.mjs",
  "research-portal/components/v2-alpha6/V2Alpha6ManuscriptWorkspace.tsx",
  "research-portal/lib/v2-alpha6/runtime.ts",
  "research-portal/lib/v2-alpha6-r1/semantic-language-fixtures.ts",
  "research-portal/package.json",
  "research-portal/scripts/freeze-v2-alpha6-r1-manifest.mjs",
  "research-portal/scripts/fixtures/v2-alpha6-r1-route-deps.mjs",
  "research-portal/scripts/v2-alpha6-r1-browser-entry.mjs",
  "research-portal/scripts/v2-alpha6-r1-route-loader.mjs",
  "research-portal/scripts/verify-v2-alpha6-contracts.mjs",
  "research-portal/scripts/verify-v2-alpha6-r1-browser.mjs",
  "research-portal/scripts/verify-v2-alpha6-r1-direct-api.mjs",
  "research-portal/scripts/verify-v2-alpha6-r1-handoff.mjs",
  "research-portal/scripts/verify-v2-alpha6-r1-semantic-language.mjs"
]);
const directDependencyPaths = Object.freeze([
  "research-portal/app/api/v2-alpha6/workspace/route.ts",
  "research-portal/app/v2-alpha6-local/page.tsx",
  "research-portal/components/v2-alpha6/v2-alpha6.module.css",
  "research-portal/lib/academic-language-contract.ts",
  "research-portal/lib/v2-alpha6/contracts.ts",
  "research-portal/lib/v2-alpha6/page-authority.ts"
]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function entry(relativePath) {
  const bytes = await readFile(path.join(workspaceRoot, relativePath));
  return { path: relativePath, size: bytes.byteLength, sha256: sha256(bytes) };
}

const sourceBytes = await readFile(path.join(workspaceRoot, sourceManifestPath));
if (sha256(sourceBytes) !== sourceManifestSha256) throw new Error("alpha6_source_manifest_immutability_failed");
const manifest = {
  contractVersion: "old-mike-v2-alpha6-r1-result-manifest/1",
  actionId: "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA6_R1_SEMANTIC_LANGUAGE_TRANSFORMATION_QUALITY_CLOSURE",
  milestoneId: "V2_PRODUCT_REFOUNDATION_ALPHA6",
  status: "FROZEN_LOCAL_FOCUSED_PASS",
  sourceCandidate: { path: sourceManifestPath, sha256: sourceManifestSha256, disposition: "FROZEN_NO_GO_DO_NOT_DEPLOY" },
  changedFiles: await Promise.all(changedPaths.map(entry)),
  directDependencies: await Promise.all(directDependencyPaths.map(entry)),
  gates: {
    semanticFixtureDomains: 6,
    languageTasks: 4,
    semanticAssertions: 298,
    directApiCases: 5,
    carryForwardContractGroups: 7,
    carryForwardContractAssertions: 77,
    browserViewports: ["1440x900", "390x844"],
    browserTaskJourneys: 8,
    unsupportedDraftPreservationCases: 2,
    axe: "PASS_ZERO_SERIOUS_CRITICAL",
    focus: "PASS",
    liveRegion: "PASS",
    typecheck: "PASS",
    productionBuild: "PASS",
    productionPageApi: "PASS_HARD_404",
    clientBundle: "PASS_ZERO_SECRET_PROVIDER_IDENTITY",
    isolatedCleanup: "PASS_ZERO_LISTENER_TEMP",
    focusedHandoff: "PASS"
  },
  effects: {
    migrationRequired: false,
    liveModelProviderCalls: 0,
    liveScholarlyCalls: 0,
    liveZoteroCalls: 0,
    onlineDatabaseConnections: 0,
    onlineDatabaseWrites: 0,
    formalResearchWrites: 0,
    externalMutations: 0,
    deployment: "NOT_EXECUTED"
  },
  next: { alpha7: "NOT_STARTED", legacyM06: "NOT_STARTED", safeNextAction: "BRAIN_REVIEW_THEN_EXACT_INDEPENDENT_GATE5_FOCUSED_THIRD_PARTY_LOCAL_UAT_ONLY" }
};
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", manifest: path.basename(outputPath), changedFiles: manifest.changedFiles.length, directDependencies: manifest.directDependencies.length, manifestSha256: sha256(await readFile(outputPath)) }));
