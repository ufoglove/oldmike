import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFile(path.join(portalRoot, "database", "proposals", name), "utf8");
const up = await read("v2-alpha2-research-generation.up.sql");
const down = await read("v2-alpha2-research-generation.down.sql");
const verify = await read("v2-alpha2-research-generation.verify.sql");
const descriptor = JSON.parse(await read("v2-alpha2-research-generation.descriptor.json"));

for (const table of ["research_generation_jobs", "research_generation_effects", "research_generation_results"]) {
  assert.match(up, new RegExp(`CREATE TABLE ${table} \\(`, "u"));
  assert.match(up, new RegExp(`REVOKE ALL ON TABLE ${table} FROM PUBLIC`, "u"));
  assert.match(verify, new RegExp(table, "u"));
}
assert.match(up, /workspace_id text NOT NULL/u);
assert.match(up, /project_id text/u);
assert.match(up, /created_by_user_id text NOT NULL/u);
assert.match(up, /project_scope text NOT NULL CHECK \(project_scope IN \('PRE_PROJECT', 'TENANT_PROJECT'\)\)/u);
assert.match(up, /project_scope = 'PRE_PROJECT' AND project_id IS NULL/u);
assert.match(up, /project_scope = 'TENANT_PROJECT' AND project_id IS NOT NULL/u);
assert.match(up, /UNIQUE \(workspace_id, created_by_user_id, request_id\)/u);
assert.doesNotMatch(up, /UNIQUE[^\n]*(request_hash|request_commitment)/u);
for (const field of ["operation_contract_version", "payload_schema_id", "request_payload", "request_byte_count", "request_hash", "state_version", "lease_generation", "lease_owner", "lease_until"]) assert.match(up, new RegExp(`${field} `, "u"));
assert.match(up, /operation IN \('GENERATE_DIRECTIONS', 'EXPAND_SELECTED_S0', 'FIELD_ASSIST'\)/u);
assert.match(up, /parent_result_id/u);
assert.match(up, /selected_item_hash/u);
assert.match(up, /research_generation_jobs_parent_result_fk/u);
assert.match(up, /research_generation_results_selected_item_unique/u);

assert.match(up, /effect_state text NOT NULL CHECK \(effect_state IN \('INTENT_PERSISTED', 'PROVEN_NOT_SUBMITTED', 'SUBMISSION_POSSIBLE', 'ACKNOWLEDGED', 'COMPLETION_UNKNOWN', 'TERMINAL_REJECTED'\)\)/u);
assert.match(up, /CONSTRAINT research_generation_effects_one_per_job UNIQUE \(job_id\)/u);
assert.match(up, /lease_generation bigint NOT NULL/u);
assert.match(up, /FOR UPDATE SKIP LOCKED/u);
assert.match(up, /clock_timestamp\(\)/u);
assert.match(up, /RECONCILE_REQUIRED/u);
assert.match(up, /research_generation_results_append_only/u);

assert.match(down, /IF EXISTS \(SELECT 1 FROM research_generation_jobs LIMIT 1\)/u);
assert.match(down, /RAISE EXCEPTION 'research_generation_rows_present'/u);
assert.ok(down.indexOf("DROP TABLE research_generation_results") < down.indexOf("DROP TABLE research_generation_jobs"));

assert.equal(descriptor.targetSchemaAuthority, "0001_THROUGH_0006");
assert.equal(descriptor.forbiddenDependency, "0007");
assert.deepEqual(descriptor.tables, ["research_generation_jobs", "research_generation_effects", "research_generation_results"]);
assert.deepEqual(descriptor.idempotencyScope, ["workspace_id", "created_by_user_id", "request_id"]);

console.log("V2_ALPHA2_DDL_CONTRACT=PASS");
console.log("V2_ALPHA2_SCHEMA_AUTHORITY=0006_WITHOUT_0007");
console.log("V2_ALPHA2_TABLES=PASS_3");
console.log("V2_ALPHA2_EFFECT_AUTHORITY=PASS_ONE_PER_JOB");
console.log("V2_ALPHA2_RESULTS=PASS_APPEND_ONLY");
console.log("V2_ALPHA2_DOWN=PASS_FAIL_CLOSED_WITH_ROWS");
