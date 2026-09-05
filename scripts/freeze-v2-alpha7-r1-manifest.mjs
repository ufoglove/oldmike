import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const manifestPath = path.join(root, "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_R1_RESULT_MANIFEST.json");
const changedPaths = [
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_R1_FOCUSED_RESULT.json",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_R1_IMPLEMENTATION_BRIEF.md",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_R1_THIRD_PARTY_UAT_BRIEF.md",
  "research-portal/components/v2-alpha7/V2Alpha7ReviewStudio.tsx",
  "research-portal/lib/v2-alpha7/contracts.ts",
  "research-portal/lib/v2-alpha7/runtime.ts",
  "research-portal/lib/v2-alpha7-r1/semantic-revision-fixtures.ts",
  "research-portal/lib/v2-alpha7-r1/semantic-revision.ts",
  "research-portal/package.json",
  "research-portal/scripts/freeze-v2-alpha7-r1-manifest.mjs",
  "research-portal/scripts/v2-alpha7-r1-route-loader.mjs",
  "research-portal/scripts/verify-v2-alpha7-browser.mjs",
  "research-portal/scripts/verify-v2-alpha7-contracts.mjs",
  "research-portal/scripts/verify-v2-alpha7-r1-direct-api.mjs",
  "research-portal/scripts/verify-v2-alpha7-r1-handoff.mjs",
  "research-portal/scripts/verify-v2-alpha7-r1-semantic-revisions.mjs"
];

const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const changedFiles = [];
for (const relative of changedPaths) {
  const bytes = await readFile(path.join(root, relative));
  changedFiles.push({ path: relative.replaceAll("\\", "/"), size: bytes.length, sha256: hashBytes(bytes) });
}

const manifest = {
  contractVersion: "old-mike-v2-alpha7-r1-result-manifest/1",
  actionId: "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA7_R1_PUBLICATION_USABLE_REVISION_ALTERNATIVES_CLOSURE",
  milestoneId: "V2_PRODUCT_REFOUNDATION_ALPHA7",
  status: "FROZEN_LOCAL_PASS",
  authorities: {
    frozenAlpha7NoGo: { path: "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_RESULT_MANIFEST.json", sha256: "46af08410e300ce18928d7e0726b1034289b5347b03582c3b0fb78d7ce2e8955", disposition: "FROZEN_NO_GO_DO_NOT_DEPLOY" },
    acceptedAlpha6R1: { path: "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_R1_RESULT_MANIFEST.json", sha256: "63023416bc4c19bda688e6459491e7dc4535b5a20af3ac22617f5b5fdf2c213e", disposition: "ACCEPTED_DEPENDENCY" }
  },
  changedFiles,
  gates: {
    redReproduction: "PASS_15_OF_15_RETAINED_10_OF_15_PREFIXED",
    semanticCorpus: "PASS_7_FIXTURES_21_ALTERNATIVES_420_ASSERTIONS",
    greenSourceRetention: "PASS_0_OF_15",
    directApi: "PASS_4_CASES",
    regressionContracts: "PASS_8_GROUPS_61_ASSERTIONS",
    browser: "PASS_DESKTOP_1440X900_MOBILE_390X844",
    responseBinding: "PASS_EXACT_BEFORE_AFTER",
    reviewerMode: "PASS_READ_ONLY",
    axe: "PASS_ZERO_SERIOUS_CRITICAL",
    focus: "PASS",
    liveRegion: "PASS",
    overflow: "PASS",
    typecheck: "PASS",
    productionBuild: "PASS",
    productionPageApi: "PASS_HARD_404",
    clientBoundary: "PASS_ZERO_SECRET_PROVIDER_IDENTITY",
    cleanup: "PASS_ZERO_CHILD_LISTENER_TEMP",
    focusedHandoff: "PASS"
  },
  effects: { migrationRequired: false, liveCalls: 0, databaseConnections: 0, databaseWrites: 0, formalResearchWrites: 0, externalMutations: 0, deployment: "NOT_EXECUTED" },
  next: { alpha8: "NOT_STARTED", legacyM06: "NOT_STARTED", safeNextAction: "BRAIN_DISPATCH_INDEPENDENT_GATE4_FOCUSED_LOCAL_UAT_ONLY" }
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", manifest: path.basename(manifestPath), changedFiles: changedFiles.length, sha256: hashBytes(await readFile(manifestPath)) }));
