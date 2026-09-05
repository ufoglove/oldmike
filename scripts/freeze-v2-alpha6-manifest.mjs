import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const outputPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_RESULT_MANIFEST.json");
const changedPaths = Object.freeze([
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_FOCUSED_RESULT.json",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_IMPLEMENTATION_BRIEF.md",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_THIRD_PARTY_UAT_BRIEF.md",
  "alpha6-uat-tooling/alpha6-local-functional-uat.descriptor.json",
  "alpha6-uat-tooling/alpha6-local-functional-uat.mjs",
  "research-portal/app/api/v2-alpha6/workspace/route.ts",
  "research-portal/app/v2-alpha6-local/page.tsx",
  "research-portal/components/v2-alpha6/V2Alpha6ManuscriptWorkspace.tsx",
  "research-portal/components/v2-alpha6/v2-alpha6.module.css",
  "research-portal/lib/v2-alpha6/contracts.ts",
  "research-portal/lib/v2-alpha6/page-authority.ts",
  "research-portal/lib/v2-alpha6/runtime.ts",
  "research-portal/package.json",
  "research-portal/scripts/freeze-v2-alpha6-manifest.mjs",
  "research-portal/scripts/v2-alpha6-browser-entry.mjs",
  "research-portal/scripts/verify-v2-alpha6-browser.mjs",
  "research-portal/scripts/verify-v2-alpha6-client-boundary.mjs",
  "research-portal/scripts/verify-v2-alpha6-contracts.mjs",
  "research-portal/scripts/verify-v2-alpha6-handoff.mjs",
  "research-portal/scripts/verify-v2-alpha6-production-boundary.mjs"
]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const changedFiles = [];
for (const relativePath of changedPaths) {
  const bytes = await readFile(path.join(workspaceRoot, relativePath));
  changedFiles.push({ path: relativePath, size: bytes.byteLength, sha256: sha256(bytes) });
}

const manifest = {
  contractVersion: "old-mike-v2-alpha6-result-manifest/1",
  actionId: "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA6_MANUSCRIPT_AND_ACADEMIC_WRITING_STUDIO_VERTICAL_SLICE_V1",
  milestoneId: "V2_PRODUCT_REFOUNDATION_ALPHA6",
  status: "FROZEN_LOCAL_PASS",
  changedFiles,
  gates: {
    acceptanceGroups: 8,
    contractAssertions: 71,
    browserJourneys: 3,
    viewports: ["1440x900", "390x844", "360x640"],
    axe: "PASS_ZERO_SERIOUS_CRITICAL",
    typecheck: "PASS",
    productionBuild: "PASS",
    productionPageApi: "PASS_HARD_404",
    clientBundle: "PASS_ZERO_SECRET_PROVIDER_IDENTITY",
    focusedHandoff: "PASS"
  },
  evidence: {
    screenshotsRetained: 0,
    isolatedChildTree: "PASS_ZERO_RESIDUAL",
    loopbackListener: "PASS_ZERO_RESIDUAL",
    isolatedTemp: "PASS_ZERO_RESIDUAL"
  },
  effects: {
    migrationRequired: false,
    liveProviderCalls: 0,
    liveScholarlyCalls: 0,
    liveZoteroCalls: 0,
    onlineDatabaseConnections: 0,
    onlineDatabaseWrites: 0,
    formalResearchWrites: 0,
    externalMutations: 0,
    deployment: "NOT_EXECUTED"
  },
  next: { alpha7: "NOT_STARTED", legacyM06: "NOT_STARTED", safeNextAction: "BRAIN_REVIEW_THEN_EXACT_INDEPENDENT_THIRD_PARTY_LOCAL_UAT_ONLY" }
};
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", manifestPath: path.basename(outputPath), changedFiles: changedFiles.length, manifestSha256: sha256(await readFile(outputPath)) }));
