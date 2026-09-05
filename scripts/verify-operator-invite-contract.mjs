import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categoryFromErrorCode, classifyError, evaluateSchemaResult } from "./operator-invite-diagnostics.mjs";
import { assertReleaseVersionMatch, readReleaseContract } from "./release-identity-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runbook = await readFile(path.join(root, "V1_4_18_SINGLE_INVITE_AUTH_E2E_RUNBOOK.md"), "utf8");
const realGate = await readFile(path.join(root, "scripts", "verify-operator-invite-real.mjs"), "utf8");
const runner = await readFile(path.join(root, "scripts", "run-controlled-invite.sh"), "utf8");
const createOperator = await readFile(path.join(root, "scripts", "create-registration-invite.mjs"), "utf8");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const releaseContract = await readReleaseContract(path.join(root, "release-identity.json"));

const expectedTables = new Set([
  "user", "session", "account", "verification", "rateLimit", "workspaces",
  "workspace_members", "projects", "project_artifacts", "user_consents",
  "audit_events", "portal_rate_limits", "registration_invites",
]);

for (const [code, category] of [
  ["28P01", "DATABASE_AUTHENTICATION"],
  ["28000", "DATABASE_AUTHORIZATION"],
  ["3D000", "DATABASE_NOT_FOUND"],
  ["42P01", "DATABASE_SCHEMA_MISSING"],
  ["42501", "DATABASE_PERMISSION"],
  ["23505", "DATABASE_CONSTRAINT"],
  ["ECONNREFUSED", "DATABASE_CONNECTION"],
]) assert.equal(categoryFromErrorCode(code), category);
assert.equal(classifyError({ code: "28P01", message: "localized message" }).category, "DATABASE_AUTHENTICATION");

const tableNames = [...expectedTables];
for (const publicTables of [13, "13"]) {
  const result = evaluateSchemaResult({ read_only: true, public_tables: publicTables, invite_count: 0, table_names: tableNames }, expectedTables);
  assert.equal(result.schema, true);
  assert.equal(result.tableNamesShape, true);
}
assert.equal(evaluateSchemaResult({ read_only: true, public_tables: 12, invite_count: 0, table_names: tableNames.slice(1) }, expectedTables).schema, false);
assert.equal(evaluateSchemaResult({ read_only: true, public_tables: 14, invite_count: 0, table_names: [...tableNames, "unknown"] }, expectedTables).schema, false);
assert.equal(evaluateSchemaResult({ read_only: true, public_tables: 13, invite_count: 0, table_names: "not-array" }, expectedTables).resultCategory, "RESULT_SHAPE");

const legalStates = [
  "NOT_CREATED", "DB_ROW_TRACKED", "ARTIFACT_VALIDATED", "READY_FOR_PRIVATE_DOWNLOAD",
  "DOWNLOADED_LOCAL_SECURE", "REMOTE_REMOVED", "INVITE_CONSUMED_OR_REVOKED", "LOCAL_REMOVED",
];
for (const state of legalStates) assert.match(runbook, new RegExp(state));
for (let index = 0; index < legalStates.length - 1; index += 1) {
  assert.match(runbook, new RegExp(`${legalStates[index]}[\\s\\S]{0,120}${legalStates[index + 1]}`));
}

assert.equal(assertReleaseVersionMatch(releaseContract, packageJson.version, "OPERATOR_INVITE_PACKAGE_JSON"), releaseContract.version);
assert.match(packageJson.scripts["test:operator-invite:real"], /verify-operator-invite-real\.mjs/);
assert.match(realGate, /INTEGRATION_DATABASE_DISPOSABLE !== "1"/);
assert.doesNotMatch(realGate, /operator-repro@example\.test/);
assert.match(realGate, /verify-controlled-runner-pty\.py/);
assert.match(realGate, /run-controlled-invite\.sh/);
assert.match(realGate, /revoke-registration-invite\.mjs/);
assert.match(realGate, /TEMPORARY_OUTPUT_CLEANUP/);

assert.match(runner, /IFS= read -r -s controlled_email <\/dev\/tty/);
assert.match(runner, /--email-stdin/);
assert.doesNotMatch(runner, /--email\s+["']?\$controlled_email/);
assert.doesNotMatch(runner, /export\s+controlled_email/);
assert.match(createOperator, /email_stdin_required/);
assert.doesNotMatch(createOperator, /normalizeEmail\(required\("email"\)\)/);

for (const phrase of [
  "additionalProperties=false", "atomic", "fsync", "mode 700", "mode 600", "symlink",
  "READY_FOR_PRIVATE_DOWNLOAD", "Private Files", "exact tuple", "affected-row count",
  "active-unused count", "BEGIN TRANSACTION READ ONLY", "normal success preserves the artifact",
  ".next/standalone/operator/run-controlled-invite.sh", "stdin", "not argv", "not environment",
  "ATTEMPT10=SAFE_ABORTED_AND_ROLLED_BACK", "ATTEMPT11=NOT_EXECUTED",
]) assert.ok(runbook.includes(phrase), `Runbook missing contract phrase: ${phrase}`);

console.log("operator invite diagnostic contract: PASS (packaged runner, stdin-only Email, strict state machine, local-only real gate)");
