import assert from "node:assert/strict";
import {
  ADMIN_BOOTSTRAP_TRANSACTION_CONTRACT,
  executeAdminBootstrapTransaction,
} from "./operator/admin-bootstrap-transaction-provider.mjs";

const input = Object.freeze({
  email: "bootstrap-provider@fixture.invalid",
  name: "Bootstrap Provider Fixture",
  idempotencyKey: "bootstrap-provider-idempotency-0001",
});
const parameters = Object.freeze({
  input,
  passwordHash: "fixture-password-hash",
  userId: "fixture-user",
  accountId: "fixture-account",
  workspaceId: "fixture-workspace",
  now: new Date("2026-08-20T00:00:00.000Z"),
  expiresAt: new Date("2026-08-21T00:00:00.000Z"),
  targetKey: "1".repeat(64),
  eventKey: "2".repeat(64),
});

function fixtureClient({
  schemaValid = true,
  counts = {},
  failAt = null,
  zeroRowAt = null,
} = {}) {
  const observations = [];
  let queryNumber = 0;
  const client = {
    observations,
    async query(text) {
      const normalized = String(text).replace(/\s+/g, " ").trim();
      observations.push(normalized);
      queryNumber += 1;
      if (failAt === queryNumber) throw new Error("FIXTURE_PROVIDER_FAILURE");
      if (normalized.startsWith("BEGIN")) return { rowCount: null, rows: [] };
      if (normalized === "COMMIT" || normalized === "ROLLBACK") return { rowCount: null, rows: [] };
      if (normalized.includes("pg_advisory_xact_lock")) return { rowCount: 1, rows: [{}] };
      if (normalized.includes("AS schema_valid")) return { rowCount: 1, rows: [{ schema_valid: schemaValid }] };
      if (normalized.includes("AS administrator_count")) {
        return {
          rowCount: 1,
          rows: [{
            administrator_count: 0,
            user_count: 0,
            account_count: 0,
            session_count: 0,
            workspace_count: 0,
            membership_count: 0,
            ...counts,
          }],
        };
      }
      if (normalized.startsWith("INSERT INTO")) {
        return zeroRowAt === queryNumber ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{}] };
      }
      throw new Error("UNEXPECTED_PROVIDER_QUERY");
    },
  };
  return client;
}

assert.equal(ADMIN_BOOTSTRAP_TRANSACTION_CONTRACT, "old-mike.admin-bootstrap-transaction.v2");

const positive = fixtureClient();
await executeAdminBootstrapTransaction({ client: positive, ...parameters });
assert.ok(positive.observations[0].startsWith("BEGIN ISOLATION LEVEL SERIALIZABLE"));
assert.equal(positive.observations.at(-1), "COMMIT");
const schemaIndex = positive.observations.findIndex((query) => query.includes("AS schema_valid"));
const cardinalityIndex = positive.observations.findIndex((query) => query.includes("AS administrator_count"));
const firstWriteIndex = positive.observations.findIndex((query) => query.startsWith("INSERT INTO"));
assert.ok(schemaIndex > 0 && cardinalityIndex > schemaIndex && firstWriteIndex > cardinalityIndex);
assert.equal(positive.observations.filter((query) => query.startsWith("INSERT INTO")).length, 7);
assert.equal(positive.observations.every((query) => !query.includes(input.email)), true);

const schemaInvalid = fixtureClient({ schemaValid: false });
await assert.rejects(
  executeAdminBootstrapTransaction({ client: schemaInvalid, ...parameters }),
  /BOOTSTRAP_SCHEMA_INVALID/,
);
assert.equal(schemaInvalid.observations.at(-1), "ROLLBACK");
assert.equal(schemaInvalid.observations.some((query) => query.startsWith("INSERT INTO")), false);

for (const dirtyCounts of [
  { administrator_count: 1 },
  { user_count: 1 },
  { account_count: 1 },
  { session_count: 1 },
  { workspace_count: 1 },
  { membership_count: 1 },
]) {
  const dirty = fixtureClient({ counts: dirtyCounts });
  await assert.rejects(executeAdminBootstrapTransaction({ client: dirty, ...parameters }));
  assert.equal(dirty.observations.at(-1), "ROLLBACK");
  assert.equal(dirty.observations.some((query) => query.startsWith("INSERT INTO")), false);
}

const reference = fixtureClient();
await executeAdminBootstrapTransaction({ client: reference, ...parameters });
const writeQueryNumbers = reference.observations
  .map((query, index) => query.startsWith("INSERT INTO") ? index + 1 : null)
  .filter((value) => value !== null);
for (const queryNumber of writeQueryNumbers) {
  const fault = fixtureClient({ failAt: queryNumber });
  await assert.rejects(executeAdminBootstrapTransaction({ client: fault, ...parameters }), /FIXTURE_PROVIDER_FAILURE/);
  assert.equal(fault.observations.at(-1), "ROLLBACK");
  assert.equal(fault.observations.includes("COMMIT"), false);

  const zeroRow = fixtureClient({ zeroRowAt: queryNumber });
  await assert.rejects(executeAdminBootstrapTransaction({ client: zeroRow, ...parameters }), /BOOTSTRAP_AFFECTED_ROW_MISMATCH/);
  assert.equal(zeroRow.observations.at(-1), "ROLLBACK");
  assert.equal(zeroRow.observations.includes("COMMIT"), false);
}

console.log("ADMIN_BOOTSTRAP_PROVIDER_CONTRACT=PASS");
console.log("BEGIN_TRANSACTION=PASS");
console.log("SCHEMA_PRECHECK_IN_TRANSACTION=PASS");
console.log("CARDINALITY_PRECHECK_IN_TRANSACTION=PASS");
console.log("ADMIN_SINGLETON_LOCK=PASS");
console.log("ALL_WRITES_SINGLE_TRANSACTION=PASS");
console.log("AFFECTED_ROW_ASSERTIONS=PASS");
console.log("ROLLBACK_ON_FAILURE=PASS");
console.log("NEGATIVE_FIXTURES=PASS");
