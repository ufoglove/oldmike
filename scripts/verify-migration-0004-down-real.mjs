import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  classifyMigration0004DownFailure,
  migration0004DownGuardIdentifier,
} from "./migration-0004-down-diagnostics.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const psqlBin = process.env.PSQL_BIN;

function emit(label, value) {
  console.log(`${label}=${value}`);
}

function isLoopback(hostname) {
  if (net.isIP(hostname) === 4) return hostname.startsWith("127.");
  if (net.isIP(hostname) === 6) return hostname === "::1";
  return hostname.toLowerCase() === "localhost";
}

if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || !psqlBin) {
  emit("MIGRATION_0004_DOWN_REAL", "FAIL");
  emit("FAILED_STAGE", "CONFIGURATION");
  emit("ERROR_CATEGORY", "DISPOSABLE_DATABASE_REQUIRED");
  emit("EXIT_CODE", 2);
  process.exit(2);
}

const parsed = new URL(databaseUrl);
if (parsed.protocol !== "postgresql:" || !isLoopback(parsed.hostname)) {
  emit("MIGRATION_0004_DOWN_REAL", "FAIL");
  emit("FAILED_STAGE", "LOOPBACK_POLICY");
  emit("ERROR_CATEGORY", "DISPOSABLE_DATABASE_REQUIRED");
  emit("EXIT_CODE", 2);
  process.exit(2);
}
await access(psqlBin);
assert.match(path.basename(psqlBin), /^psql(?:\.exe)?$/i);

const downPath = path.join(root, "database", "migrations", "0004_registration_invite_revocation.down.sql");
const migrations = ["0001_better_auth_core.up.sql", "0002_old_mike_tenant.up.sql", "0003_registration_invites.up.sql", "0004_registration_invite_revocation.up.sql"];
const constraints0004 = [
  "registration_invites_attempt_key_format_check",
  "registration_invites_attempt_key_unique",
  "registration_invites_revoked_by_key_format_check",
  "registration_invites_revocation_pair_check",
  "registration_invites_used_or_revoked_check",
  "registration_invites_revoked_not_reserved_check",
];
const fixtureId = randomUUID();
const fixtureSecrets = [fixtureId, "1".repeat(64), "2".repeat(64), "3".repeat(64), "4".repeat(64)];
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
let failedStage = "NONE";
let errorCategory = "NONE";
let exitCode = 2;
let retainedRows = -1;
const status = {
  MIGRATION_0001_TO_0004: "FAIL",
  DOWN_EMPTY_DATA: "FAIL",
  DOWN_FORMAL_DATA_FAIL_CLOSED: "FAIL",
  DOWN_FAILURE_TRANSACTION_ROLLBACK: "FAIL",
  FORMAL_DATA_PRESERVED: "FAIL",
  DOWN_CLEANUP_RETRY: "FAIL",
};

async function apply(relativeName) {
  await pool.query(await readFile(path.join(root, "database", "migrations", relativeName), "utf8"));
}

async function resetAndApply0001To0004() {
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  for (const migration of migrations) await apply(migration);
  const result = await pool.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')");
  assert.equal(result.rows[0]?.count, 13);
  status.MIGRATION_0001_TO_0004 = "PASS";
}

function psqlEnvironment() {
  const childEnvironment = { ...process.env };
  delete childEnvironment.INTEGRATION_DATABASE_URL;
  delete childEnvironment.DATABASE_URL;
  childEnvironment.PGHOST = parsed.hostname;
  childEnvironment.PGPORT = parsed.port || "5432";
  childEnvironment.PGUSER = decodeURIComponent(parsed.username);
  childEnvironment.PGDATABASE = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.password) childEnvironment.PGPASSWORD = decodeURIComponent(parsed.password);
  else delete childEnvironment.PGPASSWORD;
  return childEnvironment;
}

function runDown() {
  return spawnSync(psqlBin, ["-X", "-v", "ON_ERROR_STOP=1", "-f", downPath], {
    cwd: root,
    env: psqlEnvironment(),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
}

async function columns0004Count() {
  const result = await pool.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND table_name='registration_invites' AND column_name = ANY($1::text[])", [["attempt_key", "revoked_at", "revoked_by_key"]]);
  return result.rows[0]?.count;
}

async function assert0004Intact() {
  assert.equal(await columns0004Count(), 3);
  const constraints = await pool.query("SELECT conname, convalidated FROM pg_constraint WHERE conrelid='registration_invites'::regclass AND conname = ANY($1::text[]) ORDER BY conname", [constraints0004]);
  assert.equal(constraints.rowCount, constraints0004.length);
  assert.equal(constraints.rows.every((row) => row.convalidated === true), true);
  const index = await pool.query("SELECT i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname='registration_invites_available_idx'");
  assert.equal(index.rowCount, 1);
  assert.equal(index.rows[0].indisvalid, true);
  assert.equal(index.rows[0].indisready, true);
  assert.match(index.rows[0].definition, /revoked_at IS NULL/);
}

async function assert0003Restored() {
  assert.equal(await columns0004Count(), 0);
  const constraints = await pool.query("SELECT count(*)::int AS count FROM pg_constraint WHERE conrelid='registration_invites'::regclass AND conname = ANY($1::text[])", [constraints0004]);
  assert.equal(constraints.rows[0]?.count, 0);
  const index = await pool.query("SELECT i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname='registration_invites_available_idx'");
  assert.equal(index.rowCount, 1);
  assert.equal(index.rows[0].indisvalid && index.rows[0].indisready, true);
  assert.doesNotMatch(index.rows[0].definition, /revoked_at/);
}

try {
  failedStage = "EMPTY_DOWN";
  await resetAndApply0001To0004();
  const emptyDown = runDown();
  assert.equal(emptyDown.status, 0);
  await assert0003Restored();
  status.DOWN_EMPTY_DATA = "PASS";

  failedStage = "FORMAL_DATA_GUARD";
  await apply("0004_registration_invite_revocation.up.sql");
  await pool.query(
    "INSERT INTO registration_invites (id, token_key, email_key, role, expires_at, created_at, created_by_key, attempt_key) VALUES ($1,$2,$3,'owner',now()+interval '1 hour',now(),$4,$5)",
    fixtureSecrets,
  );
  const blockedDown = runDown();
  const captured = `${blockedDown.stdout ?? ""}\n${blockedDown.stderr ?? ""}`;
  assert.notEqual(blockedDown.status, 0);
  assert.equal(classifyMigration0004DownFailure(blockedDown.status, captured), "DATA_LOSS_GUARD");
  assert.ok(captured.includes(migration0004DownGuardIdentifier));
  for (const secret of fixtureSecrets) assert.equal(captured.includes(secret), false);
  status.DOWN_FORMAL_DATA_FAIL_CLOSED = "PASS";

  failedStage = "ROLLBACK_INTEGRITY";
  await assert0004Intact();
  const preserved = await pool.query("SELECT count(*)::int AS count FROM registration_invites WHERE id=$1", [fixtureId]);
  assert.equal(preserved.rows[0]?.count, 1);
  status.DOWN_FAILURE_TRANSACTION_ROLLBACK = "PASS";
  status.FORMAL_DATA_PRESERVED = "PASS";

  failedStage = "CLEANUP_RETRY";
  const cleanup = await pool.query("DELETE FROM registration_invites WHERE id=$1", [fixtureId]);
  assert.equal(cleanup.rowCount, 1);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM registration_invites")).rows[0]?.count, 0);
  const retry = runDown();
  assert.equal(retry.status, 0);
  await assert0003Restored();
  status.DOWN_CLEANUP_RETRY = "PASS";
  retainedRows = 0;
  failedStage = "NONE";
  exitCode = 0;
} catch (error) {
  errorCategory = error?.code === "P0001" ? "DATA_LOSS_GUARD" : "ASSERTION_OR_DATABASE";
} finally {
  if (retainedRows !== 0) {
    try {
      const table = await pool.query("SELECT to_regclass('public.registration_invites') IS NOT NULL AS present");
      if (table.rows[0]?.present) {
        await pool.query("DELETE FROM registration_invites WHERE id=$1", [fixtureId]);
        retainedRows = (await pool.query("SELECT count(*)::int AS count FROM registration_invites WHERE id=$1", [fixtureId])).rows[0]?.count ?? -1;
      } else retainedRows = 0;
    } catch {
      retainedRows = -1;
    }
  }
  await pool.end().catch(() => {});
}

for (const [label, value] of Object.entries(status)) emit(label, value);
emit("ERROR_CATEGORY", errorCategory);
emit("FAILED_STAGE", failedStage);
emit("DATABASE_WRITES_DISPOSABLE", "FIXTURE_ONLY_CLEANED");
emit("DATABASE_WRITES_DISPOSABLE_RETAINED", retainedRows);
emit("MIGRATION_0004_DOWN_REAL", exitCode === 0 ? "PASS" : "FAIL");
emit("EXIT_CODE", exitCode);
process.exit(exitCode);
