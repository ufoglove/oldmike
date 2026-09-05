import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  CONTROLLED_EMAIL_ENV,
  ControlledEmailBridgeError,
  runControlledAuthE2E,
} from "./run-controlled-auth-e2e.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseValue = process.env.INTEGRATION_DATABASE_URL ?? "";
const disposable = process.env.INTEGRATION_DATABASE_DISPOSABLE === "1";
const syntheticEmail = ["bridge-recovery", "example.test"].join(String.fromCharCode(64));
const operatorName = "controlled-auth-e2e-bridge";
const testSecret = "bridge-real-contract-secret-000000000000000000000000000000000000000000000000";

function safeLoopbackDatabase(value) {
  try {
    const parsed = new URL(value);
    return disposable && ["postgres:", "postgresql:"].includes(parsed.protocol) &&
      ["127.0.0.1", "::1", "localhost"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function keyedDigest(namespace, value) {
  return createHmac("sha256", testSecret).update(`${namespace}\0${value}`, "utf8").digest("hex");
}

async function inviteCounts(pool) {
  const result = await pool.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (
        WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
      )::int AS active_unused
    FROM registration_invites
  `);
  const total = Number(result.rows[0]?.total);
  const activeUnused = Number(result.rows[0]?.active_unused);
  assert.ok(Number.isSafeInteger(total) && total >= 0);
  assert.ok(Number.isSafeInteger(activeUnused) && activeUnused >= 0);
  return { total, activeUnused };
}

if (!safeLoopbackDatabase(databaseValue)) {
  console.log("CONTROLLED_EMAIL_BRIDGE_REAL=FAIL");
  console.log("ERROR_CATEGORY=DISPOSABLE_DATABASE_POLICY");
  process.exit(2);
}

const temporary = await mkdtemp(path.join(os.tmpdir(), "oldmike-controlled-bridge-real-"));
const pool = new Pool({
  connectionString: databaseValue,
  max: 2,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  application_name: "oldmike-controlled-email-bridge-real",
});
let fixtureId = "";
let exitCode = 2;

try {
  const baseline = await inviteCounts(pool);
  assert.deepEqual(baseline, { total: 0, activeUnused: 0 });

  const environment = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec,
    WINDIR: process.env.WINDIR,
    DATABASE_URL: databaseValue,
    BETTER_AUTH_SECRET: testSecret,
    BETTER_AUTH_URL: "https://portal.example.test",
    TMPDIR: temporary,
    [CONTROLLED_EMAIL_ENV]: syntheticEmail,
  };

  let observedError;
  try {
    await runControlledAuthE2E({
      environment,
      operatorDirectory: path.join(portalRoot, "scripts"),
      timeoutMs: 20_000,
      providerOutputValidator: () => false,
    });
  } catch (error) {
    observedError = error;
  }

  assert.ok(observedError instanceof ControlledEmailBridgeError);
  assert.equal(observedError.category, "CONTROLLED_EMAIL_PROVIDER_OUTPUT_CONTRACT");
  assert.equal(observedError.stage, "PROVIDER_OUTPUT_CONTRACT");
  assert.equal(observedError.recoveryExactRevoke, "PASS");
  assert.equal(observedError.privateRecoveryFilesRemoved, "PASS");
  assert.equal(Object.hasOwn(environment, CONTROLLED_EMAIL_ENV), false);

  const afterRecovery = await inviteCounts(pool);
  assert.deepEqual(afterRecovery, { total: 1, activeUnused: 0 });
  const createdByKey = keyedDigest("old-mike-registration-invite-operator-v1", operatorName);
  const recovered = await pool.query(
    `SELECT id, used_at, revoked_at
       FROM registration_invites
      WHERE created_by_key = $1`,
    [createdByKey],
  );
  assert.equal(recovered.rowCount, 1);
  assert.equal(recovered.rows[0].used_at, null);
  assert.notEqual(recovered.rows[0].revoked_at, null);
  fixtureId = recovered.rows[0].id;
  await access(path.join(temporary, "oldmike-controlled-invite")).then(
    () => assert.fail("private recovery directory retained"),
    () => undefined,
  );

  const cleanup = await pool.query(
    `DELETE FROM registration_invites
      WHERE id = $1 AND created_by_key = $2
        AND used_at IS NULL AND revoked_at IS NOT NULL`,
    [fixtureId, createdByKey],
  );
  assert.equal(cleanup.rowCount, 1);
  fixtureId = "";
  assert.deepEqual(await inviteCounts(pool), baseline);

  console.log("BRIDGE_CREATE_VERIFY_FAILURE_RECOVERY=PASS");
  console.log("BRIDGE_EXACT_REVOKE=PASS");
  console.log("ACTIVE_UNUSED_BASELINE_RECOVERY=PASS");
  console.log("PRIVATE_RECOVERY_FILES_REMOVED=PASS");
  console.log("AUTOMATIC_RETRY=DISABLED");
  console.log("DATABASE_WRITES_DISPOSABLE=FIXTURE_ONLY_CLEANED");
  console.log("DATABASE_WRITES_DISPOSABLE_RETAINED=0");
  console.log("CONTROLLED_EMAIL_BRIDGE_REAL=PASS");
  exitCode = 0;
} catch {
  console.log("CONTROLLED_EMAIL_BRIDGE_REAL=FAIL");
  console.log("ERROR_CATEGORY=FAIL_CLOSED");
} finally {
  if (fixtureId) {
    const createdByKey = keyedDigest("old-mike-registration-invite-operator-v1", operatorName);
    await pool.query(
      `DELETE FROM registration_invites
        WHERE id = $1 AND created_by_key = $2
          AND used_at IS NULL AND revoked_at IS NOT NULL`,
      [fixtureId, createdByKey],
    ).catch(() => undefined);
  }
  await pool.end().catch(() => undefined);
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

process.exit(exitCode);
