import { createHmac, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { Pool } from "pg";
import {
  ARTIFACT_CONTRACT_VERSION,
  LEDGER_CONTRACT_VERSION,
  MAX_ARTIFACT_BYTES,
  MAX_LEDGER_BYTES,
  REGISTRATION_PATH,
  assertStateTransition,
  atomicWritePrivateJson,
  readPrivateJson,
  removePrivateFiles,
  sha256Buffer,
  validateInvitationArtifact,
  validateRecoveryLedger,
} from "./operator/registration-invite-atomic.mjs";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : fallback;
}

function required(name) {
  const value = argument(name).trim();
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function hasArgument(name) {
  return process.argv.includes(`--${name}`);
}

async function readEmailFromStdin() {
  if (!hasArgument("email-stdin") || hasArgument("email") || process.stdin.isTTY) {
    throw new Error("email_stdin_required");
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 512) throw new Error("email_stdin_too_large");
    chunks.push(buffer);
  }
  let value = Buffer.concat(chunks).toString("utf8");
  if (value.endsWith("\r\n")) value = value.slice(0, -2);
  else if (value.endsWith("\n")) value = value.slice(0, -1);
  if (!value || /[\r\n\u0000]/.test(value)) throw new Error("invalid_email_stdin_shape");
  return normalizeEmail(value);
}

function keyedDigest(namespace, value, secret) {
  return createHmac("sha256", secret).update(`${namespace}\0${value}`, "utf8").digest("hex");
}

function normalizeEmail(value) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("invalid_email");
  return email;
}

function approvedOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("invalid_portal_origin");
  }
  return url.origin;
}

async function countActiveUnused(client) {
  const result = await client.query(
    "SELECT count(*)::int AS count FROM registration_invites WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > now()",
  );
  const count = Number(result.rows[0]?.count);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("active_invite_count_shape");
  return count;
}

async function compensateExact(pool, identity, baseline) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const revoked = await client.query(
      `UPDATE registration_invites
          SET revoked_at = now(), revoked_by_key = $5, reserved_at = NULL, reservation_id = NULL
        WHERE id = $1 AND token_key = $2 AND attempt_key = $3 AND created_by_key = $4
          AND used_at IS NULL AND revoked_at IS NULL`,
      [identity.inviteId, identity.tokenKey, identity.attemptKey, identity.createdByKey, identity.createdByKey],
    );
    if (![0, 1].includes(revoked.rowCount)) throw new Error("compensation_affected_rows");
    const active = await countActiveUnused(client);
    if (active !== baseline) throw new Error("compensation_baseline_mismatch");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function verifyPostCommit(pool, identity, artifactPath, ledgerPath, expectedOrigin) {
  const row = await pool.query(
    `SELECT id, used_at, revoked_at
       FROM registration_invites
      WHERE id = $1 AND token_key = $2 AND attempt_key = $3 AND created_by_key = $4`,
    [identity.inviteId, identity.tokenKey, identity.attemptKey, identity.createdByKey],
  );
  if (row.rowCount !== 1 || row.rows[0].used_at !== null || row.rows[0].revoked_at !== null) {
    throw new Error("post_commit_row_verification");
  }
  const artifact = await readPrivateJson(artifactPath, MAX_ARTIFACT_BYTES);
  if (!validateInvitationArtifact(artifact.value, expectedOrigin).pass) throw new Error("post_commit_artifact_verification");
  const ledger = await readPrivateJson(ledgerPath, MAX_LEDGER_BYTES);
  if (!validateRecoveryLedger(ledger.value) ||
      ledger.value.inviteId !== identity.inviteId ||
      ledger.value.artifactSha256 !== sha256Buffer(Buffer.from(artifact.contents, "utf8"))) {
    throw new Error("post_commit_ledger_verification");
  }
}

const databaseUrl = process.env.DATABASE_URL || "";
const secret = process.env.BETTER_AUTH_SECRET || "";
const artifactPath = argument("artifact");
const ledgerPath = argument("ledger");
let pool;
let client;
let committed = false;
let commitAttempted = false;
let ready = false;
let state = "NOT_CREATED";
let identity = null;
let baseline = 0;

async function failureCleanup() {
  if (client && !committed) await client.query("ROLLBACK").catch(() => undefined);
  if (pool && identity && commitAttempted) await compensateExact(pool, identity, baseline).catch(() => undefined);
  await removePrivateFiles(artifactPath, ledgerPath);
}

async function main() {
  if (!databaseUrl || secret.length < 32) throw new Error("operator_configuration");
  if (!artifactPath || !ledgerPath || artifactPath === ledgerPath) throw new Error("operator_private_paths");
  if (path.resolve(artifactPath) === path.resolve(ledgerPath) ||
      path.dirname(path.resolve(artifactPath)) !== path.dirname(path.resolve(ledgerPath))) {
    throw new Error("operator_private_paths");
  }
  // The controlled runner supplies the address through a private stdin pipe.
  // Email in argv or environment is deliberately unsupported.
  const email = await readEmailFromStdin();
  const origin = approvedOrigin(required("base-url"));
  const configuredOrigin = approvedOrigin(process.env.BETTER_AUTH_URL || "");
  if (origin !== configuredOrigin) throw new Error("operator_origin_not_approved");
  const operator = required("operator");
  const attemptId = argument("attempt-id", randomUUID());
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) {
    throw new Error("invalid_attempt_id");
  }
  const ttlHours = Number(argument("ttl-hours", "1"));
  if (!Number.isFinite(ttlHours) || ttlHours <= 0 || ttlHours > 168) throw new Error("invalid_ttl");

  const token = randomBytes(32).toString("base64url");
  const inviteId = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlHours * 60 * 60 * 1000);
  const tokenKey = keyedDigest("old-mike-registration-invite-token-v1", token, secret);
  const emailKey = keyedDigest("old-mike-registration-invite-email-v1", email, secret);
  const createdByKey = keyedDigest("old-mike-registration-invite-operator-v1", operator, secret);
  const attemptKey = keyedDigest("old-mike-registration-invite-attempt-v1", attemptId, secret);
  identity = { inviteId, tokenKey, attemptKey, createdByKey };

  const artifact = {
    contractVersion: ARTIFACT_CONTRACT_VERSION,
    expiresAt: expiresAt.toISOString(),
    singleUse: true,
    portalOrigin: origin,
    registrationPath: REGISTRATION_PATH,
    inviteCredential: token,
  };
  const artifactCheck = validateInvitationArtifact(artifact, origin);
  if (!artifactCheck.pass) throw new Error("artifact_contract_before_insert");

  pool = new Pool({ connectionString: databaseUrl, max: 2 });
  client = await pool.connect();
  await client.query("BEGIN");
  baseline = await countActiveUnused(client);
  const inserted = await client.query(
    `INSERT INTO registration_invites
       (id, token_key, email_key, role, expires_at, created_at, created_by_key, attempt_key)
     VALUES ($1, $2, $3, 'owner', $4, $5, $6, $7)
     RETURNING id`,
    [inviteId, tokenKey, emailKey, expiresAt, createdAt, createdByKey, attemptKey],
  );
  if (inserted.rowCount !== 1) throw new Error("invite_insert_affected_rows");
  state = assertStateTransition(state, "DB_ROW_TRACKED");

  const artifactWrite = await atomicWritePrivateJson(artifactPath, artifact, MAX_ARTIFACT_BYTES);
  state = assertStateTransition(state, "ARTIFACT_VALIDATED");
  const ledger = {
    contractVersion: LEDGER_CONTRACT_VERSION,
    attemptId,
    inviteId,
    tokenKey,
    attemptKey,
    createdByKey,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    baselineActiveUnusedCount: baseline,
    artifactSha256: artifactWrite.sha256,
    state,
  };
  if (!validateRecoveryLedger(ledger)) throw new Error("ledger_contract_before_commit");
  await atomicWritePrivateJson(ledgerPath, ledger, MAX_LEDGER_BYTES);

  commitAttempted = true;
  await client.query("COMMIT");
  committed = true;
  client.release();
  client = null;
  await verifyPostCommit(pool, identity, artifactPath, ledgerPath, origin);
  state = assertStateTransition(state, "READY_FOR_PRIVATE_DOWNLOAD");
  await atomicWritePrivateJson(ledgerPath, { ...ledger, state }, MAX_LEDGER_BYTES, { replace: true });
  ready = true;
  console.log("INVITE_OUTPUT_CONTRACT=PASS");
  console.log("INVITE_CREATE=PASS");
  console.log("ARTIFACT_STATE=READY_FOR_PRIVATE_DOWNLOAD");
  console.log("PRIVATE_FILE_READY=PASS");
}

let exiting = false;
async function signalFailure(signal) {
  if (exiting || ready) return;
  exiting = true;
  await failureCleanup();
  console.log("INVITE_CREATE=FAIL");
  console.log(`ERROR_CATEGORY=${signal === "SIGINT" ? "INTERRUPTED" : "TERMINATED"}`);
  process.exit(2);
}
process.once("SIGINT", () => void signalFailure("SIGINT"));
process.once("SIGTERM", () => void signalFailure("SIGTERM"));

try {
  await main();
} catch {
  await failureCleanup();
  console.log("INVITE_CREATE=FAIL");
  console.log("ERROR_CATEGORY=FAIL_CLOSED");
  process.exitCode = 2;
} finally {
  if (client) client.release();
  if (pool) await pool.end().catch(() => undefined);
}
