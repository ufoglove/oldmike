import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertReleaseVersionMatch, readReleaseContract } from "./release-identity-contract.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(portalRoot, "..");
const actionId = "LOCAL_FOUNDATION_RUNTIME_CLOSURE_PROJECT_CREATE_AND_TASK_GATEWAY_LIVE_ADAPTER_V1";
const resultPath = "LOCAL_FOUNDATION_RUNTIME_CLOSURE_PROJECT_CREATE_AND_TASK_GATEWAY_LIVE_ADAPTER_V1_RESULT.json";

const readText = (relativePath) => readFile(path.resolve(workspaceRoot, relativePath), "utf8");
const readJson = async (relativePath) => JSON.parse(await readText(relativePath));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const result = await readJson(resultPath);
assert.equal(result.ACTION_ID, actionId);
assert.equal(result.STATUS, "COMPLETED_LOCAL_ONLY_RUNTIME_DEPLOYABLE_NOT_ONLINE");
assert.equal(result.TEST_CATEGORY_COUNT, 8);
assert.equal(Object.keys(result.TEST_CATEGORIES).length, 8);
assert.ok(Object.values(result.TEST_CATEGORIES).every((value) => String(value).startsWith("PASS")));
assert.equal(result.PUBLIC_VERSION_OR_ZIP, "NOT_CREATED");
assert.equal(result.DEPLOYMENT, "NOT_EXECUTED");
assert.equal(result.DATABASE_CONNECTIONS_ONLINE, 0);
assert.equal(result.DATABASE_WRITES_ONLINE, 0);
assert.equal(result.EXTERNAL_MUTATIONS, 0);
assert.equal(result.M05_STATUS, "NOT_STARTED");

const ledger = await readJson("AUTOMATION_ACTION_LEDGER.json");
const matchingActions = ledger.actions.filter((action) => action.actionId === actionId);
assert.equal(matchingActions.length, 1);
assert.equal(matchingActions[0].status, "COMPLETED");
assert.deepEqual(matchingActions[0].result, result);
assert.equal(matchingActions[0].resultFingerprint, sha256(JSON.stringify(result)));
assert.equal(matchingActions[0].duplicateDispatchCount, 0);

const manifest = await readJson("MANIFEST.json");
assert.deepEqual(manifest.foundation_runtime_closure_v1, {
  status: "COMPLETED_LOCAL_ONLY_RUNTIME_DEPLOYABLE_NOT_ONLINE",
  project_create: "POSTGRES_TRANSACTION_EXACT_ONCE_TENANT_SAFE",
  chat: "AUTHORIZED_BOUNDED_POSTGRES_CONTEXT_TASK_GATEWAY",
  task_gateway: "PRIVATE_RESPONSES_ADAPTER_DEPLOYABLE_DEFAULT_DISABLED",
  schema_migration: "NOT_REQUIRED_NOT_EXECUTED",
  blocking_test_categories: 8,
  release_version_or_zip: "NOT_CREATED",
  deployment: "NOT_EXECUTED",
  online_database_writes: 0,
  external_mutations: 0,
  m05_status: "NOT_STARTED"
});

const requiredEntrypoints = [
  resultPath,
  "research-portal/lib/foundation-runtime-contract.ts",
  "research-portal/lib/task-context-repository.ts",
  "research-portal/lib/task-gateway-responses-adapter.ts",
  "research-portal/lib/task-gateway-runtime.ts",
  "research-portal/scripts/verify-foundation-runtime-contract.mjs",
  "research-portal/scripts/verify-foundation-runtime-disposable.mjs",
  "research-portal/scripts/verify-foundation-runtime-handoff.mjs"
];
for (const entrypoint of requiredEntrypoints) assert.ok(manifest.entrypoints.includes(entrypoint), `missing entrypoint ${entrypoint}`);

const packageJson = await readJson("research-portal/package.json");
const releaseContract = await readReleaseContract(path.join(portalRoot, "release-identity.json"));
assert.equal(assertReleaseVersionMatch(releaseContract, packageJson.version, "FOUNDATION_RUNTIME_PACKAGE_JSON"), releaseContract.version);
assert.equal(packageJson.scripts["test:foundation-runtime:handoff"], "node scripts/verify-foundation-runtime-handoff.mjs");

const registry = await readJson("research-portal/contracts/skill-registry.json");
const pinnedIds = new Set([
  "old-mike-task-gateway-contract",
  "old-mike-task-gateway-runtime",
  "old-mike-private-responses-adapter",
  "old-mike-task-context-repository",
  "old-mike-foundation-runtime-contract"
]);
for (const contract of registry.internalContracts.filter(({ id }) => pinnedIds.has(id))) {
  const literal = await readFile(path.resolve(portalRoot, contract.source));
  assert.equal(contract.sha256, sha256(literal), `internal contract pin mismatch ${contract.id}`);
  pinnedIds.delete(contract.id);
}
assert.equal(pinnedIds.size, 0);

const fileManifest = new Set((await readText("FILE_MANIFEST.txt")).trim().split(/\r?\n/u));
const checksumLines = (await readText("SHA256SUMS.txt")).trim().split(/\r?\n/u);
const checksumMap = new Map(checksumLines.map((line) => {
  const match = /^([0-9a-f]{64})  (.+)$/u.exec(line);
  assert.ok(match, `invalid checksum line ${line}`);
  return [match[2], match[1]];
}));
for (const relativePath of requiredEntrypoints) {
  assert.ok(fileManifest.has(relativePath), `missing file manifest entry ${relativePath}`);
  const literal = await readFile(path.resolve(workspaceRoot, relativePath));
  assert.equal(checksumMap.get(relativePath), sha256(literal), `workspace checksum mismatch ${relativePath}`);
}

console.log("FOUNDATION_RUNTIME_HANDOFF=PASS");
