import { createHmac } from "node:crypto";
import { Pool } from "pg";
import {
  MAX_ARTIFACT_BYTES,
  MAX_LEDGER_BYTES,
  privateFilesAbsent,
  readPrivateJson,
  removePrivateFiles,
  sha256Buffer,
  validateRecoveryLedger,
} from "./operator/registration-invite-atomic.mjs";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

function digest(namespace, value, secret) {
  return createHmac("sha256", secret).update(`${namespace}\0${value}`, "utf8").digest("hex");
}

async function activeUnusedCount(client) {
  const result = await client.query(
    "SELECT count(*)::int AS count FROM registration_invites WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > now()",
  );
  const count = Number(result.rows[0]?.count);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("active_invite_count_shape");
  return count;
}

const databaseUrl = process.env.DATABASE_URL || "";
const secret = process.env.BETTER_AUTH_SECRET || "";
const ledgerPath = argument("ledger");
const artifactPath = argument("artifact");
const operator = argument("operator").trim();
let pool;
let client;

try {
  if (!databaseUrl || secret.length < 32 || !ledgerPath || !artifactPath || !operator) throw new Error("revoke_configuration");
  const ledgerFile = await readPrivateJson(ledgerPath, MAX_LEDGER_BYTES);
  const ledger = ledgerFile.value;
  if (!validateRecoveryLedger(ledger)) throw new Error("revoke_ledger_contract");
  const artifactFile = await readPrivateJson(artifactPath, MAX_ARTIFACT_BYTES);
  if (sha256Buffer(Buffer.from(artifactFile.contents, "utf8")) !== ledger.artifactSha256) {
    throw new Error("revoke_artifact_digest");
  }
  const revokedByKey = digest("old-mike-registration-invite-operator-v1", operator, secret);

  pool = new Pool({ connectionString: databaseUrl, max: 2 });
  client = await pool.connect();
  await client.query("BEGIN");
  const current = await client.query(
    `SELECT used_at, revoked_at, expires_at
       FROM registration_invites
      WHERE id = $1 AND token_key = $2 AND attempt_key = $3 AND created_by_key = $4
      FOR UPDATE`,
    [ledger.inviteId, ledger.tokenKey, ledger.attemptKey, ledger.createdByKey],
  );
  if (current.rowCount !== 1) throw new Error("revoke_row_not_exact");
  if (current.rows[0].used_at !== null) throw new Error("revoke_used_forbidden");
  if (current.rows[0].revoked_at !== null) throw new Error("revoke_repeated_forbidden");

  const revoked = await client.query(
    `UPDATE registration_invites
        SET revoked_at = now(), revoked_by_key = $5, reserved_at = NULL, reservation_id = NULL
      WHERE id = $1 AND token_key = $2 AND attempt_key = $3 AND created_by_key = $4
        AND used_at IS NULL AND revoked_at IS NULL`,
    [ledger.inviteId, ledger.tokenKey, ledger.attemptKey, ledger.createdByKey, revokedByKey],
  );
  if (revoked.rowCount !== 1) throw new Error("revoke_affected_rows");
  if (await activeUnusedCount(client) !== ledger.baselineActiveUnusedCount) throw new Error("revoke_baseline_mismatch");
  await client.query("COMMIT");
  client.release();
  client = null;
  await removePrivateFiles(artifactPath, ledgerPath);
  if (!await privateFilesAbsent(artifactPath, ledgerPath)) throw new Error("revoke_private_cleanup");
  console.log("INVITE_REVOCATION=PASS");
  console.log("ACTIVE_UNUSED_BASELINE_RESTORED=PASS");
  console.log("PRIVATE_RECOVERY_FILES_REMOVED=PASS");
} catch {
  if (client) await client.query("ROLLBACK").catch(() => undefined);
  console.log("INVITE_REVOCATION=FAIL");
  console.log("ERROR_CATEGORY=FAIL_CLOSED");
  process.exitCode = 2;
} finally {
  if (client) client.release();
  if (pool) await pool.end().catch(() => undefined);
}
