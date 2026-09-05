import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertReleaseVersionMatch,
  readReleaseContract,
  releaseArtifactLabel,
} from "./release-identity-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = ["package.json", "pnpm-lock.yaml", "app", "components", "lib"];
for (const item of required) await access(path.join(root, item));
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const releaseContract = await readReleaseContract(path.join(root, "release-identity.json"));
assert.equal(assertReleaseVersionMatch(releaseContract, packageJson.version, "RELEASE_PACKAGE_JSON"), releaseContract.version);
await access(path.join(root, "app", "api", "projects", "[projectId]", "research", "route.ts"));
await access(path.join(root, "release-identity.json"));
await access(path.join(root, "lib", "release-identity.ts"));
await access(path.join(root, "scripts", "verify-release-identity-contract.mjs"));
await access(path.join(root, "scripts", "scheduler-runtime-contract.mjs"));
await access(path.join(root, "scripts", "verify-scheduler-runtime-contract.mjs"));
await access(path.join(root, "scripts", "run-controlled-auth-e2e.mjs"));
await access(path.join(root, "scripts", "verify-controlled-auth-e2e-bridge-contract.mjs"));
await access(path.join(root, "scripts", "auth-config-convergence-contract.mjs"));
await access(path.join(root, "scripts", "verify-auth-config-convergence-contract.mjs"));
await access(path.join(root, "scripts", "auth-config-authoritative-provider.mjs"));
await access(path.join(root, "scripts", "verify-auth-config-authoritative-provider.mjs"));
await access(path.join(root, "scripts", "operator", "auth-config-runtime-provider.mjs"));
  await access(path.join(root, "scripts", "bootstrap-portal-administrator.mjs"));
  await access(path.join(root, "scripts", "run-admin-bootstrap.mjs"));
  await access(path.join(root, "scripts", "recover-admin-bootstrap-handoff.mjs"));
  await access(path.join(root, "scripts", "operator", "admin-bootstrap-bridge-provider.mjs"));
  await access(path.join(root, "scripts", "verify-admin-bootstrap-bridge-contract.mjs"));
  await access(path.join(root, "scripts", "verify-admin-bootstrap-bridge-real.mjs"));
await access(path.join(root, "database", "migrations", "0006_admin_provisioned_accounts.up.sql"));
await access(path.join(root, "database", "migrations", "0006_admin_provisioned_accounts.down.sql"));
await access(path.join(root, "database", "migrations", "0007_topic_lab_frontier_radar.up.sql"));
await access(path.join(root, "database", "migrations", "0007_topic_lab_frontier_radar.down.sql"));
await access(path.join(root, "lib", "topic-lab-contract.ts"));
await access(path.join(root, "lib", "topic-lab-repository.ts"));
await access(path.join(root, "lib", "topic-lab-source-provider.ts"));
await access(path.join(root, "components", "TopicLabFrontierRadar.tsx"));
await access(path.join(root, "app", "api", "projects", "[projectId]", "topic-lab", "route.ts"));
await access(path.join(root, "scripts", "verify-online-schema-state.mjs"));
await access(path.join(root, "scripts", "schema-evidence-safe-stage-contract.mjs"));
await access(path.join(root, "scripts", "verify-schema-evidence-safe-stage-contract.mjs"));
await access(path.join(root, "scripts", "verify-schema-evidence-error-origin-contract.mjs"));
await access(path.join(root, "scripts", "schema-evidence-bridge-contract.mjs"));
await access(path.join(root, "scripts", "verify-schema-evidence-bridge-contract.mjs"));
await access(path.join(root, "scripts", "verify-schema-evidence-runtime.mjs"));
await access(path.join(root, "scripts", "verify-schema-evidence-bridge-disposable.mjs"));
await access(path.join(root, "scripts", "run-v1523-schema-evidence-bridge-disposable.ps1"));
await access(path.join(root, "app", "api", "projects", "[projectId]", "academic-language", "route.ts"));
await access(path.join(root, "components", "AcademicLanguageStudio.tsx"));
await access(path.join(root, "lib", "academic-language-contract.ts"));
await access(path.join(root, "lib", "academic-language-provider.ts"));
await access(path.join(root, "lib", "academic-language-repository.ts"));
await access(path.join(root, "scripts", "verify-academic-language-contract.mjs"));
await access(path.join(root, "scripts", "verify-academic-language-disposable.mjs"));
await access(path.join(root, "scripts", "run-v1527-academic-language-disposable.ps1"));
await access(path.join(root, "scripts", "setup-academic-language-browser-fixture.mjs"));
await access(path.join(root, "scripts", "verify-academic-language-browser.mjs"));
await access(path.join(root, "scripts", "verify-academic-language-browser-db.mjs"));
await access(path.join(root, "scripts", "run-v1527-academic-language-browser-disposable.ps1"));
await access(path.join(root, "app", "api", "projects", "[projectId]", "review-studio", "route.ts"));
await access(path.join(root, "components", "ReviewStudio.tsx"));
await access(path.join(root, "lib", "review-studio-contract.ts"));
await access(path.join(root, "lib", "review-studio-provider.ts"));
await access(path.join(root, "lib", "review-studio-repository.ts"));
await access(path.join(root, "lib", "review-automation-contract.ts"));
await access(path.join(root, "lib", "review-automation-adapter.ts"));
await access(path.join(root, "contracts", "review-studio.schema.json"));
await access(path.join(root, "contracts", "review-automation-job.schema.json"));
await access(path.join(root, "contracts", "m03-review-studio.n8n.inactive.json"));
await access(path.join(root, "scripts", "verify-review-studio-contract.mjs"));
await access(path.join(root, "scripts", "run-v1528-review-studio-disposable.ps1"));
await access(path.join(root, "scripts", "run-v1528-review-studio-browser-disposable.ps1"));
await access(path.join(root, "app", "api", "projects", "[projectId]", "journal-submission", "route.ts"));
await access(path.join(root, "components", "JournalSubmissionStudio.tsx"));
await access(path.join(root, "lib", "journal-submission-contract.ts"));
await access(path.join(root, "lib", "journal-submission-provider.ts"));
await access(path.join(root, "lib", "journal-submission-repository.ts"));
await access(path.join(root, "lib", "journal-source-network-contract.ts"));
await access(path.join(root, "contracts", "journal-submission.schema.json"));
await access(path.join(root, "contracts", "m04-journal-requirement-refresh.n8n.inactive.json"));
await access(path.join(root, "contracts", "m04-public-health-evidence.n8n.inactive.json"));
await access(path.join(root, "scripts", "verify-journal-submission-contract.mjs"));
await access(path.join(root, "scripts", "run-v1529-journal-submission-disposable.ps1"));
await access(path.join(root, "scripts", "run-v1529-journal-submission-browser-disposable.ps1"));
await access(path.join(root, "app", "admin", "accounts", "page.tsx"));
await access(path.join(root, "app", "account", "change-password", "page.tsx"));
assert.equal(packageJson.dependencies?.scheduler, "0.27.0");
assert.equal(packageJson.devDependencies?.scheduler, undefined);
assert.ok(
  Object.values(packageJson.scripts ?? {}).every((command) => !command.includes("../scripts/")),
  "Portal release commands must not depend on a parent Workspace tree",
);
const lockfile = await readFile(path.join(root, "pnpm-lock.yaml"), "utf8");
assert.match(
  lockfile,
  /\n\s{6}scheduler:\s*\r?\n\s{8}specifier:\s*0\.27\.0\r?\n\s{8}version:\s*0\.27\.0/,
  "scheduler must be a directly locked production dependency",
);

function zipEntries(buffer) {
  const entries = [];
  for (let offset = 0; offset + 46 <= buffer.length;) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x02014b50) {
      offset += 1;
      continue;
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameEnd = offset + 46 + nameLength;
    assert.ok(nameEnd <= buffer.length, "ZIP entry name exceeds archive bounds");
    entries.push(buffer.subarray(offset + 46, nameEnd).toString("utf8"));
    offset = nameEnd + extraLength + commentLength;
  }
  return entries;
}

function assertSafeEntryNames(entries) {
  assert.ok(entries.length > 0, "ZIP must contain entries");
  const exact = new Set();
  const folded = new Set();
  for (const entry of entries) {
    assert.ok(!entry.includes("\\"), `ZIP entry must use POSIX '/' separators: ${entry}`);
    assert.ok(!entry.includes("\0"), "ZIP entry must not contain NUL");
    assert.ok(!entry.startsWith("/"), `ZIP entry must be relative: ${entry}`);
    assert.ok(!/^[A-Za-z]:/.test(entry), `ZIP entry must not contain a drive prefix: ${entry}`);
    assert.ok(!entry.endsWith("/"), `ZIP must not contain directory-only entries: ${entry}`);
    const segments = entry.split("/");
    assert.ok(
      segments.every((segment) => segment !== "" && segment !== "." && segment !== ".."),
      `ZIP entry contains an unsafe path segment: ${entry}`,
    );
    assert.ok(!exact.has(entry), `ZIP contains a duplicate entry: ${entry}`);
    exact.add(entry);
    const lower = entry.toLowerCase();
    assert.ok(!folded.has(lower), `ZIP contains a case-colliding entry: ${entry}`);
    folded.add(lower);
  }
}

const forbiddenReleaseEntry = /(^|\/)(node_modules|\.next|\.git|backup|backups|logs|reports|tmp|temp|clean-extract|release-validation|test-output)(\/|$)|(^|\/)\.env(?:\.(?:local|production|development))?$|tsconfig\.tsbuildinfo$|\.(?:zip|dump|bak|tmp|log)$/i;

async function verifyPortalZip(filename) {
  const entries = zipEntries(await readFile(filename));
  assertSafeEntryNames(entries);
  assert.ok(entries.includes("package.json"), "Portal ZIP must place package.json at root");
  assert.ok(entries.includes("pnpm-lock.yaml"), "Portal ZIP must place pnpm-lock.yaml at root");
  assert.ok(entries.some((entry) => entry.startsWith("app/")), "Portal ZIP must place app/ at root");
  assert.ok(entries.some((entry) => entry.startsWith("components/")), "Portal ZIP must place components/ at root");
  assert.ok(entries.some((entry) => entry.startsWith("lib/")), "Portal ZIP must place lib/ at root");
  assert.ok(
    entries.includes("scripts/clean-build-artifact.mjs"),
    "Portal ZIP must include the exact Linux build-script path",
  );
  assert.ok(
    entries.includes("app/api/projects/[projectId]/research/route.ts"),
    "Portal source ZIP must include the Research route source contract",
  );
  assert.ok(entries.includes("release-identity.json"), "Portal source ZIP must include release identity contract");
  assert.ok(entries.includes("lib/release-identity.ts"), "Portal source ZIP must include release identity implementation");
  assert.ok(entries.includes("lib/display-name-contract.ts"), "Portal source ZIP must include display-name provider contract");
  assert.ok(entries.includes("app/api/account/profile/route.ts"), "Portal source ZIP must include authenticated profile endpoint");
  assert.ok(entries.includes("components/ProfileDisplayNameForm.tsx"), "Portal source ZIP must include display-name consumer UI");
  assert.ok(entries.includes("scripts/verify-profile-display-name-contract.mjs"), "Portal source ZIP must include profile consumer/provider verifier");
  assert.ok(entries.includes("scripts/verify-public-branding-contract.mjs"), "Portal source ZIP must include public branding verifier");
  assert.ok(entries.includes("scripts/verify-profile-display-name-browser.py"), "Portal source ZIP must include native Playwright browser verifier");
  assert.ok(entries.includes("scripts/run-profile-display-name-browser-disposable.ps1"), "Portal source ZIP must include disposable browser harness");
  assert.ok(entries.includes("scripts/scheduler-runtime-contract.mjs"), "Portal source ZIP must include scheduler provider contract");
  assert.ok(entries.includes("scripts/verify-scheduler-runtime-contract.mjs"), "Portal source ZIP must include scheduler consumer/provider verifier");
  assert.ok(entries.includes("scripts/run-controlled-auth-e2e.mjs"), "Portal source ZIP must include the server-only controlled Email bridge");
  assert.ok(entries.includes("scripts/verify-controlled-auth-e2e-bridge-contract.mjs"), "Portal source ZIP must include the bridge consumer/provider contract");
  assert.ok(entries.includes("scripts/auth-config-convergence-contract.mjs"), "Portal source ZIP must include the Auth runtime configuration convergence provider contract");
  assert.ok(entries.includes("scripts/verify-auth-config-convergence-contract.mjs"), "Portal source ZIP must include the Auth runtime configuration convergence verifier");
  assert.ok(entries.includes("scripts/auth-config-authoritative-provider.mjs"), "Portal source ZIP must include the authoritative configuration provider contract");
  assert.ok(entries.includes("scripts/verify-auth-config-authoritative-provider.mjs"), "Portal source ZIP must include the authoritative configuration consumer verifier");
  assert.ok(entries.includes("scripts/operator/auth-config-runtime-provider.mjs"), "Portal source ZIP must include the redacted runtime generation provider");
  assert.ok(entries.includes("scripts/bootstrap-portal-administrator.mjs"), "Portal source ZIP must include the stdin-only one-shot administrator bootstrap");
  assert.ok(entries.includes("database/migrations/0006_admin_provisioned_accounts.up.sql"), "Portal source ZIP must include migration 0006 up");
  assert.ok(entries.includes("database/migrations/0006_admin_provisioned_accounts.down.sql"), "Portal source ZIP must include migration 0006 down");
  assert.ok(entries.includes("database/migrations/0007_topic_lab_frontier_radar.up.sql"), "Portal source ZIP must include migration 0007 up");
  assert.ok(entries.includes("database/migrations/0007_topic_lab_frontier_radar.down.sql"), "Portal source ZIP must include migration 0007 down");
  assert.ok(entries.includes("lib/topic-lab-contract.ts"), "Portal source ZIP must include Topic Lab contract");
  assert.ok(entries.includes("lib/topic-lab-repository.ts"), "Portal source ZIP must include Topic Lab repository");
  assert.ok(entries.includes("components/TopicLabFrontierRadar.tsx"), "Portal source ZIP must include Topic Lab UI");
  assert.ok(entries.includes("app/api/projects/[projectId]/topic-lab/route.ts"), "Portal source ZIP must include Topic Lab route");
  assert.ok(entries.includes("scripts/verify-topic-lab-contract.mjs"), "Portal source ZIP must include Topic Lab contract verifier");
  assert.ok(entries.includes("scripts/run-v1522-topic-lab-browser-disposable.ps1"), "Portal source ZIP must include disposable Topic Lab browser harness");
  assert.ok(entries.includes("scripts/verify-online-schema-state.mjs"), "Portal source ZIP must include the server-only schema evidence operator");
  assert.ok(entries.includes("scripts/schema-evidence-safe-stage-contract.mjs"), "Portal source ZIP must include the safe stage bitmap contract");
  assert.ok(entries.includes("scripts/verify-schema-evidence-safe-stage-contract.mjs"), "Portal source ZIP must include the safe stage bitmap verifier");
  assert.ok(entries.includes("scripts/verify-schema-evidence-error-origin-contract.mjs"), "Portal source ZIP must include the error-origin verifier");
  assert.ok(entries.includes("scripts/schema-evidence-bridge-contract.mjs"), "Portal source ZIP must include the schema evidence bridge contract");
  assert.ok(entries.includes("scripts/verify-schema-evidence-bridge-contract.mjs"), "Portal source ZIP must include the schema evidence bridge verifier");
  assert.ok(entries.includes("scripts/verify-schema-evidence-runtime.mjs"), "Portal source ZIP must include the schema evidence runtime verifier");
  assert.ok(entries.includes("scripts/run-v1523-schema-evidence-bridge-disposable.ps1"), "Portal source ZIP must include the disposable PostgreSQL 18 bridge harness");
  assert.ok(entries.includes("app/api/projects/[projectId]/academic-language/route.ts"), "Portal source ZIP must include the academic language route");
  assert.ok(entries.includes("components/AcademicLanguageStudio.tsx"), "Portal source ZIP must include the academic language UI");
  assert.ok(entries.includes("lib/academic-language-contract.ts"), "Portal source ZIP must include the academic language contract");
  assert.ok(entries.includes("lib/academic-language-provider.ts"), "Portal source ZIP must include the server-only academic language provider");
  assert.ok(entries.includes("lib/academic-language-repository.ts"), "Portal source ZIP must include the academic language repository");
  assert.ok(entries.includes("scripts/verify-academic-language-contract.mjs"), "Portal source ZIP must include the academic language contract verifier");
  assert.ok(entries.includes("scripts/run-v1527-academic-language-disposable.ps1"), "Portal source ZIP must include the M02 disposable PostgreSQL harness");
  assert.ok(entries.includes("scripts/run-v1527-academic-language-browser-disposable.ps1"), "Portal source ZIP must include the M02 browser harness");
  assert.ok(entries.includes("app/api/projects/[projectId]/review-studio/route.ts"), "Portal source ZIP must include the M03 Review Studio route");
  assert.ok(entries.includes("components/ReviewStudio.tsx"), "Portal source ZIP must include the M03 Review Studio UI");
  assert.ok(entries.includes("lib/review-studio-contract.ts"), "Portal source ZIP must include the M03 Review Studio contract");
  assert.ok(entries.includes("lib/review-studio-provider.ts"), "Portal source ZIP must include the M03 server-only provider");
  assert.ok(entries.includes("lib/review-studio-repository.ts"), "Portal source ZIP must include the M03 append-only repository");
  assert.ok(entries.includes("lib/review-automation-contract.ts"), "Portal source ZIP must include the opaque automation contract");
  assert.ok(entries.includes("lib/review-automation-adapter.ts"), "Portal source ZIP must include the disabled automation adapter");
  assert.ok(entries.includes("contracts/review-studio.schema.json"), "Portal source ZIP must include the Review Studio schema");
  assert.ok(entries.includes("contracts/review-automation-job.schema.json"), "Portal source ZIP must include the automation job schema");
  assert.ok(entries.includes("contracts/m03-review-studio.n8n.inactive.json"), "Portal source ZIP must include the inactive M03 n8n contract template");
  assert.ok(entries.includes("scripts/verify-review-studio-contract.mjs"), "Portal source ZIP must include the M03 contract verifier");
  assert.ok(entries.includes("scripts/run-v1528-review-studio-disposable.ps1"), "Portal source ZIP must include the M03 disposable PostgreSQL harness");
  assert.ok(entries.includes("scripts/run-v1528-review-studio-browser-disposable.ps1"), "Portal source ZIP must include the M03 browser harness");
  assert.ok(entries.includes("app/api/projects/[projectId]/journal-submission/route.ts"), "Portal source ZIP must include the M04 Journal Submission route");
  assert.ok(entries.includes("components/JournalSubmissionStudio.tsx"), "Portal source ZIP must include the M04 Journal Submission UI");
  assert.ok(entries.includes("lib/journal-submission-contract.ts"), "Portal source ZIP must include the M04 strict contract");
  assert.ok(entries.includes("lib/journal-submission-provider.ts"), "Portal source ZIP must include the M04 server-only provider");
  assert.ok(entries.includes("lib/journal-submission-repository.ts"), "Portal source ZIP must include the M04 append-only repository");
  assert.ok(entries.includes("lib/journal-source-network-contract.ts"), "Portal source ZIP must include the M04 official-source network contract");
  assert.ok(entries.includes("contracts/journal-submission.schema.json"), "Portal source ZIP must include the M04 schema");
  assert.ok(entries.includes("contracts/m04-journal-requirement-refresh.n8n.inactive.json"), "Portal source ZIP must include the inactive M04 journal refresh template");
  assert.ok(entries.includes("contracts/m04-public-health-evidence.n8n.inactive.json"), "Portal source ZIP must include the inactive M04 health evidence template");
  assert.ok(entries.includes("scripts/verify-journal-submission-contract.mjs"), "Portal source ZIP must include the M04 contract verifier");
  assert.ok(entries.includes("scripts/run-v1529-journal-submission-disposable.ps1"), "Portal source ZIP must include the M04 disposable PostgreSQL harness");
  assert.ok(entries.includes("scripts/run-v1529-journal-submission-browser-disposable.ps1"), "Portal source ZIP must include the M04 browser harness");
  assert.ok(entries.includes("app/admin/accounts/page.tsx"), "Portal source ZIP must include the protected account administration UI");
  assert.ok(entries.includes("app/account/change-password/page.tsx"), "Portal source ZIP must include the first-login password change UI");
  assert.ok(!entries.some((entry) => entry.startsWith("public/") && entry.endsWith("run-controlled-auth-e2e.mjs")), "Controlled Email bridge must not be public");
  assert.ok(!entries.some((entry) => entry.startsWith("public/") && ["bootstrap-portal-administrator.mjs", "run-admin-bootstrap.mjs", "recover-admin-bootstrap-handoff.mjs", "admin-bootstrap-bridge-provider.mjs"].includes(path.posix.basename(entry))), "Administrator bootstrap runtime must not be public");
  assert.ok(!entries.some((entry) => entry.startsWith("public/") && entry.endsWith("verify-online-schema-state.mjs")), "Schema evidence operator must not be public");
  assert.ok(!entries.some((entry) => entry.startsWith("public/") && entry.endsWith("schema-evidence-safe-stage-contract.mjs")), "Schema evidence safe-stage contract must not be public");
  assert.ok(
    !entries.some((entry) => entry.startsWith(`Old_Mike_Research_Portal_v${releaseArtifactLabel(releaseContract)}/`)),
    "Portal ZIP must not have a wrapper directory",
  );
assert.ok(!entries.some((entry) => forbiddenReleaseEntry.test(entry)), "Portal ZIP must be release-clean");
assert.ok(!entries.some((entry) => entry.startsWith(".next/standalone/")), "Portal source ZIP must not claim a standalone runtime");
  return entries;
}

async function verifyWorkspaceZip(filename) {
  const entries = zipEntries(await readFile(filename));
  assertSafeEntryNames(entries);
  assert.ok(entries.includes("Old_Mike_Codex_Workspace/AGENTS.md"));
  assert.ok(entries.includes("Old_Mike_Codex_Workspace/MANIFEST.json"));
  assert.ok(
    entries.includes("Old_Mike_Codex_Workspace/research-portal/scripts/clean-build-artifact.mjs"),
    "Workspace ZIP must include the exact wrapped Linux build-script path",
  );
  assert.ok(
    entries.every((entry) => entry.startsWith("Old_Mike_Codex_Workspace/")),
    "Workspace ZIP must use exactly one wrapper directory",
  );
  assert.ok(!entries.some((entry) => forbiddenReleaseEntry.test(entry)));
  return entries;
}

assert.throws(
  () => assertSafeEntryNames(["scripts\\clean-build-artifact.mjs"]),
  /POSIX/,
  "The verifier must reject Windows ZIP separators instead of normalizing them",
);

const portalZip = process.env.RELEASE_PORTAL_ZIP;
const workspaceZip = process.env.RELEASE_WORKSPACE_ZIP;
const portalEntries = portalZip ? await verifyPortalZip(portalZip) : [];
const workspaceEntries = workspaceZip ? await verifyWorkspaceZip(workspaceZip) : [];
console.log(`release package: PASS (raw POSIX entry contract verified${portalZip ? `, Portal ZIP ${portalEntries.length} entries` : ""}${workspaceZip ? `, Workspace ZIP ${workspaceEntries.length} entries` : ""})`);
