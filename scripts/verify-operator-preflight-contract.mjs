import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePhase0InventoryResult } from "./operator-invite-diagnostics.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preflight = await readFile(path.join(root, "scripts", "verify-operator-preflight.mjs"), "utf8");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

assert.equal(packageJson.scripts["test:operator-preflight:contract"], "node scripts/verify-operator-preflight-contract.mjs");
assert.equal(packageJson.scripts["test:operator-preflight"], "node scripts/verify-operator-preflight.mjs");
assert.match(preflight, /\.next["']?,?\s*\)?[\s\S]*standalone/);
assert.match(preflight, /create-registration-invite\.mjs/);
assert.match(preflight, /297c194ed02b967fcd753e8b00cdb7a317943148c26ad4d12ee2bec26ee9fba9/);
assert.match(preflight, /spawnSync\(process\.execPath, \["--check", runtimeCli\]/);
assert.match(preflight, /create-registration-invite\.mjs/);
assert.match(preflight, /PG_RESOLUTION/);
assert.match(preflight, /REACT_DOM_SERVER_RESOLUTION/);
assert.match(preflight, /SCHEDULER_RESOLUTION/);
assert.match(preflight, /BEGIN TRANSACTION READ ONLY/);
assert.match(preflight, /FROM pg_class c\s+JOIN pg_namespace n ON n\.oid = c\.relnamespace/);
assert.match(preflight, /c\.relkind IN \('r', 'p'\)/);
assert.match(preflight, /non_system_tables/);
assert.match(preflight, /schemas_with_tables/);
assert.match(preflight, /expected_tables_present/);
assert.match(preflight, /project_count/);
assert.match(preflight, /project_artifact_count/);
assert.match(preflight, /has_table_privilege\(current_user, 'public\.registration_invites', 'INSERT'\)/);
assert.match(preflight, /convalidated/);
assert.match(preflight, /indisvalid/);
assert.match(preflight, /REGISTRATION_MODE/);
assert.match(preflight, /INTEGRATION_TEST_MODE/);
assert.match(preflight, /TEST_FIXTURE/);
assert.match(preflight, /DATABASE_URL_SET/);
assert.match(preflight, /DATABASE_INJECTED_HOST_MATCH/);
assert.match(preflight, /DATABASE_DNS_PRIVATE/);
assert.match(preflight, /BETTER_AUTH_SECRET_POLICY/);
assert.match(preflight, /BETTER_AUTH_URL_POLICY/);
assert.match(preflight, /REGISTRATION_INVITES_COUNT/);
assert.match(preflight, /PREFLIGHT/);
assert.match(preflight, /operator-readonly-preflight/);
assert.match(preflight, /process\.cwd\(\)/);
assert.doesNotMatch(preflight, /create-registration-invite\.mjs.*--email/s);
assert.doesNotMatch(preflight, /INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|CREATE\s+|ALTER\s+|DROP\s+/i);
assert.doesNotMatch(preflight, /console\.log\([^\n]*(?:DATABASE_URL|password|secret|token|Email|connection string|hostname|role_name|database_name)/i);
assert.doesNotMatch(preflight, /console\.log\([^\n]*(?:message|detail|hint|query|stdout|stderr)/i);
assert.match(preflight, /POSTGRES_ERROR_CODE/);
assert.match(preflight, /ERROR_CATEGORY/);

const validBase = {
  database_match: true,
  user_match: true,
  read_only: true,
  postgres_major: "18",
  public_schema: true,
  public_usage: true,
  public_tables: "13",
  non_system_tables: "13",
  schemas_with_tables: "1",
  expected_tables_present: "13",
  project_count: "0",
  project_artifact_count: "0",
  active_unused_invite_count: "0",
  unvalidated_constraints: "0",
  invalid_indexes: "0",
  target_fingerprint: "b64f139577217b6a9fa1a56851f322e4",
};
const evaluate = (row) => evaluatePhase0InventoryResult(row, {
  expectedTableCount: 13,
  expectedTargetFingerprint: "b64f139577217b6a9fa1a56851f322e4",
});

assert.equal(evaluate(validBase).allowed, true, "string count 13 must parse safely");
assert.equal(evaluate({ ...validBase, public_tables: 13 }).allowed, true,
  "numeric count 13 must parse safely");

const missing = { ...validBase };
delete missing.public_tables;
assert.equal(evaluate(missing).resultCategory, "RESULT_SHAPE");
assert.equal(evaluate({ ...validBase, public_tables: null }).resultCategory, "RESULT_SHAPE");
assert.equal(evaluate({ ...validBase, public_tables: "thirteen" }).resultCategory, "COUNT_PARSE");
assert.equal(evaluate({ ...validBase, public_tables: "0" }).allowed, false);
assert.equal(evaluate({ ...validBase, expected_tables_present: "12" }).allowed, false);
assert.equal(evaluate({ ...validBase, target_fingerprint: "different" }).allowed, false);
assert.equal(evaluate({ ...validBase, target_fingerprint: "different" }).failedField,
  "target_fingerprint");

assert.match(preflight, /phase0Category = "DATABASE_QUERY"/);
assert.doesNotMatch(preflight, /FROM pg_tables WHERE schemaname = 'public'/);
assert.doesNotMatch(preflight, /public_tables\s*===\s*expectedTables\.length/);

console.log("phase 0 inventory contract: PASS (pg_class inventory, safe count parsing, target/result fail-closed, redacted output)");
