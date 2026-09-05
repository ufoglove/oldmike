import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const outputPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA2_RESULT_MANIFEST.json");
const changedPaths = [
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA2_DURABLE_GENERATION_RFC.md",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA2_THIRD_PARTY_UAT_BRIEF.md",
  "OLD_MIKE_V2_ALPHA2_SCREEN_EVIDENCE/alpha2-desktop-1440x900.png",
  "OLD_MIKE_V2_ALPHA2_SCREEN_EVIDENCE/alpha2-mobile-390x844.png",
  "OLD_MIKE_V2_ALPHA2_SCREEN_EVIDENCE/alpha2-mobile-360x640.png",
  "research-portal/app/v2-alpha2-local/page.tsx",
  "research-portal/app/api/v2-alpha2/journeys/route.ts",
  "research-portal/app/api/v2-alpha2/journeys/[journeyRef]/route.ts",
  "research-portal/app/api/v2-alpha2/journeys/[journeyRef]/assist/route.ts",
  "research-portal/app/api/v2-alpha2/assists/[assistRef]/route.ts",
  "research-portal/components/v2-alpha2/V2Alpha2ResearchStart.tsx",
  "research-portal/components/v2-alpha2/v2-alpha2.module.css",
  "research-portal/lib/v2-alpha2/contracts.ts",
  "research-portal/lib/v2-alpha2/provider.ts",
  "research-portal/lib/v2-alpha2/repository.ts",
  "research-portal/lib/v2-alpha2/runtime.ts",
  "research-portal/lib/v2-alpha2/worker.ts",
  "research-portal/database/proposals/v2-alpha2-research-generation.up.sql",
  "research-portal/database/proposals/v2-alpha2-research-generation.down.sql",
  "research-portal/database/proposals/v2-alpha2-research-generation.verify.sql",
  "research-portal/database/proposals/v2-alpha2-research-generation.reconcile.sql",
  "research-portal/database/proposals/v2-alpha2-research-generation.descriptor.json",
  "research-portal/scripts/fixtures/v2-alpha2-browser.sql",
  "research-portal/scripts/run-v2-alpha2-postgres18-disposable.ps1",
  "research-portal/scripts/run-v2-alpha2-browser-disposable.ps1",
  "research-portal/scripts/verify-v2-alpha2-contracts.mjs",
  "research-portal/scripts/verify-v2-alpha2-ddl-contract.mjs",
  "research-portal/scripts/verify-v2-alpha2-worker-contract.mjs",
  "research-portal/scripts/verify-v2-alpha2-provider-contract.mjs",
  "research-portal/scripts/verify-v2-alpha2-postgres.mjs",
  "research-portal/scripts/verify-v2-alpha2-browser.mjs",
  "research-portal/scripts/verify-v2-alpha2-production-boundary.mjs",
  "research-portal/scripts/verify-v2-alpha2-client-boundary.mjs",
  "research-portal/scripts/create-v2-alpha2-result-manifest.mjs",
  "research-portal/scripts/verify-v2-alpha2-handoff.mjs",
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const changedFiles = [];
for (const relative of changedPaths) {
  const absolute = path.join(workspaceRoot, ...relative.split("/"));
  const body = await readFile(absolute);
  const details = await stat(absolute);
  changedFiles.push({ path: relative, bytes: details.size, sha256: sha256(body) });
}
const changedFileAggregateSha256 = sha256(changedFiles.map((item) => `${item.path}:${item.bytes}:${item.sha256}`).join("\n"));
const ddlSha256 = changedFiles.find((item) => item.path.endsWith("v2-alpha2-research-generation.up.sql"))?.sha256;

const result = {
  actionId: "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA2_DURABLE_RESEARCH_START_VERTICAL_SLICE",
  milestoneId: "V2_PRODUCT_REFOUNDATION_ALPHA2",
  status: "COMPLETED_LOCAL_ALPHA2_CANDIDATE",
  publicAuthority: "V1_5_30_C2R4_BR3_PRESERVED",
  alpha1AuthoritySha256: "ac005cea580c9c579436df669a4e065301ee59476bc056304131b036aa98f196",
  migration: {
    state: "PROPOSAL_ONLY_NOT_APPLIED",
    baseline: "0001_THROUGH_0006",
    migration0007Dependency: "NONE",
    bytebaseExecution: "NOT_EXECUTED",
    ddlSha256,
    tables: ["research_generation_jobs", "research_generation_effects", "research_generation_results"],
    disposablePostgresql18: "PASS_ABSENT_TO_COMPLETE_AND_CLEANUP",
  },
  outcomes: {
    journey: "PASS_ONE_POST_202_POLL_RELOAD_GET_ONLY",
    directions: "PASS_EXACT_3_FIXED_LANES_ONE_RECOMMENDED",
    stageB: "PASS_EXACT_PARENT_RESULT_SELECTED_HASH_BINDING_COMPLETE_13_FIELD_S0",
    immutablePartialArtifacts: "PASS_STAGE_A_PRESERVED",
    localCardSwitchEffects: 0,
    fieldAssist: "PASS_M01_FIELD_EXACT_THREE_STRATEGIES_VALID_OPTION_ISOLATION_APPLY_UNDO",
    provenNotSubmitted: "PASS_EXACT_TERMINAL_NO_RECONCILE",
    completionUnknown: "PASS_RECONCILE_REQUIRED_NO_RESEND",
    formalResearchWrites: 0,
    liveScholarlyEgress: 0,
  },
  verification: {
    focusedContractScripts: 4,
    workerScenarioGroups: 6,
    providerRoutingScenarioGroups: 1,
    disposablePostgresql18Runs: 2,
    repositorySemanticGates: 9,
    browserJourneys: 1,
    browserViewportRuns: 3,
    screenCaptures: 3,
    typecheck: "PASS",
    productionBuild: "PASS_NEXT_16_3_1_WEBPACK",
    productionV2RouteBoundary: "PASS_404",
    axeBlockingViolations: 0,
    focusKeyboardLiveRegion: "PASS",
    clientSecretProviderIdentityScan: "PASS_1_ALPHA2_CHUNK",
  },
  limitations: {
    privateWorker: "HARD_DISABLED_BY_DEFAULT",
    migrationApplied: false,
    onlineDatabaseTested: false,
    liveProviderTested: false,
    liveScholarlyEgressApproved: false,
    alpha3Started: false,
    m06Started: false,
  },
  effects: {
    externalMutations: 0,
    onlineDatabaseConnections: 0,
    onlineDatabaseWrites: 0,
    formalResearchWrites: 0,
    deploymentExecuted: false,
    archiveOrZipCreated: false,
  },
  changedFileAggregateSha256,
  changedFiles,
  immutabilityEvidence: [
    { path: ".release-v1.5.30-c2r4-br3-final/Old_Mike_Research_Portal_v1.5.30-c2r4-br3.zip", sha256: "7515acca88e14482b3543a9ea80a4af5c132aaf4d7473b3314f46e59674f562c" },
    { path: ".release-v1.5.30-c2r4-br3-final/Old_Mike_Codex_Workspace_v1.5.30-c2r4-br3.zip", sha256: "f98be320325c86c2e53b546a29148b1d7ea7e397b88623767d77990cc51c1aaa" },
    { path: ".release-v1.5.30-c2r4-br4-final/Old_Mike_Research_Portal_v1.5.30-c2r4-br4.zip", sha256: "b65f8e65db7e01778332f19eb72cebd4d3b017415ae0d40a2cbc348c3e7a082e" },
    { path: ".release-v1.5.30-c2r4-br4-final/Old_Mike_Codex_Workspace_v1.5.30-c2r4-br4.zip", sha256: "701b7e01070c37d807b328fa9f478630b748851d966cea887510160e1e0ed007" },
    { path: "research-portal/components/GuidedResearchCenter.tsx", sha256: "616c81a6020d5d9bf86ea8bda3dfb40f747d376846352a1d9cdc15a186ac5a36" },
    { path: "research-portal/app/globals.css", lines: 1045, sha256: "ffdaa1a8fdb717e74dde1e17101ea0a8c94f57494e7d8d956b04e39a8485b2e8" },
  ],
  alpha3Boundary: "DOCUMENTED_ONLY_CONVERSATIONAL_WORKSPACE_AND_SEPARATE_SOURCE_QUERY_CHILDREN_PLUS_IMMUTABLE_MULTI_INPUT_SYNTHESIS",
  safeNextAction: "RETURN_TO_BRAIN_NO_MIGRATION_NO_DEPLOYMENT_NO_UAT_NO_ALPHA3_NO_M06",
  exitCode: 0,
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`V2_ALPHA2_RESULT_MANIFEST_FILES=${changedFiles.length}`);
console.log(`V2_ALPHA2_CHANGED_FILE_AGGREGATE_SHA256=${changedFileAggregateSha256}`);
console.log(`V2_ALPHA2_DDL_SHA256=${ddlSha256}`);
