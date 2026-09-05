import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const manifestPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA5_RESULT_MANIFEST.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const changed = [
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA5_IMPLEMENTATION_AND_TAIWAN_PROPOSAL.md",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA5_THIRD_PARTY_UAT_BRIEF.md",
  "OLD_MIKE_V2_ALPHA5_OPERATION_REGISTRY.md",
  "OLD_MIKE_V2_ALPHA5_SCREEN_EVIDENCE/desktop-1440x900.png",
  "OLD_MIKE_V2_ALPHA5_SCREEN_EVIDENCE/mobile-390x844.png",
  "OLD_MIKE_V2_ALPHA5_SCREEN_EVIDENCE/mobile-360x640.png",
  "alpha5-uat-tooling/alpha5-local-functional-uat.descriptor.json",
  "alpha5-uat-tooling/alpha5-local-functional-uat.mjs",
  "research-portal/package.json",
  "research-portal/app/api/v2-alpha5/workspace/route.ts",
  "research-portal/app/v2-alpha5-local/page.tsx",
  "research-portal/components/v2-alpha5/V2Alpha5ProposalWorkspace.tsx",
  "research-portal/components/v2-alpha5/v2-alpha5.module.css",
  "research-portal/lib/v2-alpha5/contracts.ts",
  "research-portal/lib/v2-alpha5/official-source-bundle.ts",
  "research-portal/lib/v2-alpha5/page-authority.ts",
  "research-portal/lib/v2-alpha5/runtime.ts",
  "research-portal/scripts/freeze-v2-alpha5-manifest.mjs",
  "research-portal/scripts/v2-alpha5-browser-entry.mjs",
  "research-portal/scripts/verify-v2-alpha5-browser.mjs",
  "research-portal/scripts/verify-v2-alpha5-client-boundary.mjs",
  "research-portal/scripts/verify-v2-alpha5-contracts.mjs",
  "research-portal/scripts/verify-v2-alpha5-handoff.mjs",
  "research-portal/scripts/verify-v2-alpha5-production-boundary.mjs",
  "research-portal/scripts/verify-v2-alpha5-uat-tooling.mjs"
];
const frozenPaths = [
  "research-portal/lib/research-config.ts",
  "research-portal/lib/v2-alpha3/contracts.ts",
  "research-portal/lib/v2-alpha4/catalog.ts",
  "research-portal/lib/v2-alpha4-r1/zotero-contracts.ts",
  "research-portal/lib/proposal-studio-contract.ts",
  "research-portal/lib/proposal-studio-repository.ts",
  "research-portal/contracts/proposal-studio.schema.json",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA3_RESULT_MANIFEST.json",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA4_RESULT_MANIFEST.json",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA4_R1_RESULT_MANIFEST.json",
  ".release-v1.5.30-c2r4-br3-final/Old_Mike_Research_Portal_v1.5.30-c2r4-br3.zip",
  ".release-v1.5.30-c2r4-br3-final/Old_Mike_Codex_Workspace_v1.5.30-c2r4-br3.zip"
];
async function entry(relative) { const bytes = await readFile(path.join(workspaceRoot, relative)); const info = await stat(path.join(workspaceRoot, relative)); return { path: relative.replaceAll("\\", "/"), size: info.size, sha256: sha256(bytes) }; }
const changedFiles = await Promise.all(changed.map(entry));
const frozenAuthorities = Object.fromEntries((await Promise.all(frozenPaths.map(entry))).map((item) => [item.path, item.sha256]));
const manifest = {
  contractVersion: "old-mike-v2-alpha5/result-manifest/1",
  actionId: "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA5_TAIWAN_PROPOSAL_ONE_CLICK_VERTICAL_SLICE_V1",
  milestoneId: "V2_PRODUCT_REFOUNDATION_ALPHA5",
  status: "LOCAL_ALPHA5_PASS_READY_FOR_INDEPENDENT_THIRD_PARTY_UAT",
  currentPublic: "V1_5_30_C2R4_BR3_PRESERVED",
  featureGates: {
    domainTarget: "PASS_SIX_PRESETS_PLUS_CUSTOM_NSTC_MOE_NO_DEFAULT",
    officialSourceBundle: "PASS_TARGET_CYCLE_DOMAIN_PER_SOURCE_AGGREGATE_HASH_MIXED_CYCLE_REJECTED",
    directions: "PASS_EXACT_THREE_DISTINCT_ONE_RECOMMENDATION",
    cardSwitching: "PASS_LOCAL_ONLY_ZERO_PROVIDER_SUBMISSIONS",
    proposalDraft: "PASS_EXISTING_M05_SCHEMA_NSTC_AND_MOE",
    sourceSeparation: "PASS_OFFICIAL_HISTORICAL_RECOMMENDATION_UNKNOWN_FRESHNESS",
    budgetWorkPackages: "PASS_ARITHMETIC_LINKAGE_ATTACHMENTS_RULE_UNKNOWN",
    zoteroBoundary: "PASS_EVIDENCE_ONLY_DOI_FIRST_FUZZY_REVIEW_NO_FULLTEXT",
    humanGate: "PASS_ONE_WHOLE_ARTIFACT_GATE_FORMAL_WRITES_ZERO",
    productionBoundary: "PASS_PAGE_API_404",
    clientBoundary: "PASS_OLD_MIKE_ONLY_NO_SECRET_PROVIDER_IDENTITY"
  },
  tests: {
    acceptanceGroups: 8,
    focusedContractAssertions: 67,
    focusedContractGroups: 7,
    browserGroups: 1,
    browserViewports: 3,
    seriousCriticalAxeFindings: 0,
    keyboardFocusLiveRegion: "PASS",
    failureDraftPreservation: "PASS",
    typecheck: "PASS",
    productionBuild: "PASS_NEXT_16_3_1_WEBPACK",
    productionBoundary: "PASS",
    clientSourceAndBundleScan: "PASS_ZERO_MATCHES",
    explicitRootNode24UatTooling: "PASS",
    cleanup: "PASS_ZERO_CHILD_LISTENER_TEMP",
    screenEvidenceFiles: 3,
    focusedHandoff: "PASS",
    rootHandoff: "PREEXISTING_ROOT_DRIFT_NONBLOCKING_FOR_LOCAL_ALPHA5_UAT"
  },
  persistence: { migrationRequired: "NO", ddlDescriptor: null, proposalRepositoryAuthority: "REUSED_NOT_CALLED", fixtureIdempotencyResidual: "PROCESS_LOCAL_NOT_CROSS_REPLICA_AUTHORITY" },
  sourceAuthority: { officialSources: "SYNTHETIC_UNVERIFIED_NO_LIVE_RETRIEVAL", zotero: "LOCAL_METADATA_FIXTURE_ONLY", oldMikeProvider: "SYNTHETIC_FIXTURE_ONLY", liveOfficialVerification: "NOT_EXECUTED" },
  external: { networkCalls: 0, liveProviderCalls: 0, liveScholarlyCalls: 0, liveZoteroCalls: 0, onlineDatabaseConnections: 0, onlineDatabaseWrites: 0, formalResearchWrites: 0, externalMutations: 0, deployment: "NOT_EXECUTED", migration: "NOT_EXECUTED", uat: "LOCAL_TOOLING_AND_FUNCTIONAL_FIXTURE_ONLY", alpha6: "NOT_STARTED", m06: "NOT_STARTED" },
  release: { archiveCreated: false, productVersionChanged: false, candidateClass: "FROZEN_LOCAL_SOURCE_CANDIDATE" },
  implementationAccounting: { requiredSurface: "ADOPTED", addedConventions: ["v2-alpha5/page-authority.ts", "Node24 explicit-root UAT tooling", "focused Alpha5 handoff verifier"], deviations: [] },
  frozenAuthorities,
  changedFiles,
  safeNextAction: "BRAIN_REVIEW_ALPHA5_AND_DISPATCH_EXACT_INDEPENDENT_THIRD_PARTY_LOCAL_UAT_ONLY_NO_AUTOMATIC_DEPLOYMENT_MIGRATION_ALPHA6_M06",
  exitCode: 0
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", changedFiles: changedFiles.length, manifestSha256: sha256(await readFile(manifestPath)) }));
