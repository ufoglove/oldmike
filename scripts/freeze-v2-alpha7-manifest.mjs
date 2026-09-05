import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const outputPath = path.join(workspaceRoot, "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_RESULT_MANIFEST.json");
const baseline = { path: "OLD_MIKE_RESEARCH_OS_V2_ALPHA6_R1_RESULT_MANIFEST.json", sha256: "63023416bc4c19bda688e6459491e7dc4535b5a20af3ac22617f5b5fdf2c213e" };
const changedPaths = [
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_FOCUSED_RESULT.json",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_IMPLEMENTATION_BRIEF.md",
  "OLD_MIKE_RESEARCH_OS_V2_ALPHA7_THIRD_PARTY_UAT_BRIEF.md",
  "alpha7-uat-tooling/alpha7-local-functional-uat.descriptor.json",
  "alpha7-uat-tooling/alpha7-local-functional-uat.mjs",
  "research-portal/app/api/v2-alpha7/studio/route.ts",
  "research-portal/app/v2-alpha7-local/page.tsx",
  "research-portal/components/v2-alpha7/V2Alpha7ReviewStudio.tsx",
  "research-portal/components/v2-alpha7/v2-alpha7.module.css",
  "research-portal/lib/v2-alpha7/contracts.ts",
  "research-portal/lib/v2-alpha7/page-authority.ts",
  "research-portal/lib/v2-alpha7/runtime.ts",
  "research-portal/package.json",
  "research-portal/scripts/freeze-v2-alpha7-manifest.mjs",
  "research-portal/scripts/verify-v2-alpha7-browser.mjs",
  "research-portal/scripts/verify-v2-alpha7-client-boundary.mjs",
  "research-portal/scripts/verify-v2-alpha7-contracts.mjs",
  "research-portal/scripts/verify-v2-alpha7-handoff.mjs",
  "research-portal/scripts/verify-v2-alpha7-production-boundary.mjs"
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const baselineBytes = await readFile(path.join(workspaceRoot, baseline.path));
if (sha256(baselineBytes) !== baseline.sha256) throw new Error("alpha6_r1_baseline_hash_mismatch");
const changedFiles = [];
for (const relative of changedPaths) {
  const absolute = path.join(workspaceRoot, relative);
  const [bytes, metadata] = await Promise.all([readFile(absolute), stat(absolute)]);
  changedFiles.push({ path: relative.replaceAll("\\", "/"), size: metadata.size, sha256: sha256(bytes) });
}
changedFiles.sort((left, right) => left.path.localeCompare(right.path, "en-US"));

const manifest = {
  contractVersion: "old-mike-v2-alpha7-result-manifest/1",
  actionId: "LOCAL_OLD_MIKE_RESEARCH_OS_V2_ALPHA7_REVIEW_REVISION_AND_RESPONSE_STUDIO_VERTICAL_SLICE_V1",
  milestoneId: "V2_PRODUCT_REFOUNDATION_ALPHA7",
  status: "FROZEN_LOCAL_PASS",
  baseline: { ...baseline, disposition: "ACCEPTED_DEPENDENCY" },
  changedFiles,
  gates: {
    acceptanceGroups: 8,
    contractAssertions: 60,
    browserViewports: ["1440x900", "390x844"],
    independentLenses: 5,
    revisionAlternativesPerFinding: 3,
    responseDecisions: ["ACCEPT", "PARTIAL", "DECLINE"],
    axe: "PASS_ZERO_SERIOUS_CRITICAL",
    focus: "PASS",
    liveRegion: "PASS",
    typecheck: "PASS",
    productionBuild: "PASS",
    productionPageApi: "PASS_HARD_404",
    clientBoundary: "PASS_ZERO_SECRET_INTERNAL_IDENTITY",
    isolatedCleanup: "PASS_ZERO_CHILD_LISTENER_TEMP",
    focusedHandoff: "PASS"
  },
  effects: {
    migrationRequired: false,
    liveModelCalls: 0,
    liveScholarlyJournalZoteroCalls: 0,
    onlineDatabaseConnections: 0,
    onlineDatabaseWrites: 0,
    formalResearchWrites: 0,
    externalMutations: 0,
    deployment: "NOT_EXECUTED"
  },
  next: {
    alpha8: "NOT_STARTED",
    legacyM06: "NOT_STARTED",
    safeNextAction: "BRAIN_REVIEW_THEN_EXACT_INDEPENDENT_THIRD_PARTY_LOCAL_ALPHA7_UAT_ONLY"
  }
};
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
console.log(JSON.stringify({ status: "PASS", manifest: path.basename(outputPath), changedFiles: changedFiles.length, sha256: sha256(await readFile(outputPath)) }));
