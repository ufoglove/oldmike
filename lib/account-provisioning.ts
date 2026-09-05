import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { Pool, type PoolClient } from "pg";
import { authConfiguration } from "@/lib/auth-config";
import { normalizeDisplayName } from "@/lib/display-name-contract";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
const TEMPORARY_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;
const ADMIN_LOCK_KEY = "old-mike.portal-administrator.v1";
const ACCOUNT_LOCK_KEY = "old-mike.admin-account-provisioning.v1";

export const ACCOUNT_STATUSES = ["ACTIVE", "PASSWORD_CHANGE_REQUIRED", "DISABLED"] as const;
export type AccountStatus = typeof ACCOUNT_STATUSES[number];

export class AccountProvisioningError extends Error {
  constructor(public readonly code: string, public readonly httpStatus = 409) {
    super(code);
  }
}

function requirePool() {
  if (!pool || !authConfiguration().ready) throw new AccountProvisioningError("ACCOUNT_PROVISIONING_UNAVAILABLE", 503);
  return pool;
}

function commitment(namespace: string, value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new AccountProvisioningError("ACCOUNT_PROVISIONING_UNAVAILABLE", 503);
  return createHmac("sha256", secret).update(`${namespace}\0${value}`, "utf8").digest("hex");
}

export function normalizeProvisioningEmail(value: string) {
  if (typeof value !== "string" || value !== value.trim() || value.length > 254) {
    throw new AccountProvisioningError("INVALID_ACCOUNT_IDENTITY", 400);
  }
  const normalized = value.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new AccountProvisioningError("INVALID_ACCOUNT_IDENTITY", 400);
  }
  return normalized;
}

export function validateDisplayName(value: string) {
  try {
    return normalizeDisplayName(value);
  } catch {
    throw new AccountProvisioningError("INVALID_DISPLAY_NAME", 400);
  }
}

export function validateProvisioningPassword(value: string) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128 || /[\u0000\r\n]/.test(value)) {
    throw new AccountProvisioningError("INVALID_PASSWORD_POLICY", 400);
  }
  return value;
}

function validateIdempotencyKey(value: string) {
  if (typeof value !== "string" || value.length < 16 || value.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new AccountProvisioningError("INVALID_IDEMPOTENCY_KEY", 400);
  }
  return commitment("old-mike-account-idempotency-v1", value);
}

async function beginAccountTransaction(client: PoolClient) {
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ACCOUNT_LOCK_KEY]);
}

async function assertAdministrator(client: PoolClient, userId: string) {
  const result = await client.query<{ user_id: string }>(
    "SELECT user_id FROM portal_administrator WHERE singleton_key = 1 AND user_id = $1",
    [userId],
  );
  if (result.rowCount !== 1) throw new AccountProvisioningError("ADMINISTRATOR_REQUIRED", 403);
}

async function insertAdminEvent(client: PoolClient, input: {
  actorAdminId: string;
  targetUserId: string;
  eventKind: string;
  idempotencyCommitment: string;
}) {
  await client.query(
    `INSERT INTO account_admin_events
       (actor_admin_id, target_user_key, event_kind, idempotency_key)
     VALUES ($1, $2, $3, $4)`,
    [
      input.actorAdminId,
      commitment("old-mike-account-admin-target-v1", input.targetUserId),
      input.eventKind,
      input.idempotencyCommitment,
    ],
  );
}

async function insertAccountGraph(client: PoolClient, input: {
  userId: string;
  email: string;
  name: string;
  passwordHash: string;
  createdByAdminId: string | null;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TEMPORARY_PASSWORD_TTL_MS);
  const workspaceId = `ws_${randomUUID()}`;
  await client.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, false, $4, $4)`,
    [input.userId, input.name, input.email, now],
  );
  await client.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $2, $3, $4, $4)`,
    [randomUUID(), input.userId, input.passwordHash, now],
  );
  await client.query(
    "INSERT INTO workspaces (id, name, owner_user_id) VALUES ($1, $2, $3)",
    [workspaceId, `${input.name} Personal Workspace`, input.userId],
  );
  await client.query(
    "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
    [workspaceId, input.userId],
  );
  await client.query(
    `INSERT INTO account_provisioning_state
       (user_id, status, must_change_password, temporary_password_expires_at,
        password_version, password_changed_at, created_by_admin_id, created_at, updated_at)
     VALUES ($1, 'PASSWORD_CHANGE_REQUIRED', true, $2, 1, NULL, $3, $4, $4)`,
    [input.userId, expiresAt, input.createdByAdminId, now],
  );
  return { workspaceId, expiresAt };
}

export async function bootstrapPortalAdministrator(input: {
  email: string;
  name: string;
  temporaryPassword: string;
  idempotencyKey: string;
}) {
  const email = normalizeProvisioningEmail(input.email);
  const name = validateDisplayName(input.name);
  const temporaryPassword = validateProvisioningPassword(input.temporaryPassword);
  const idempotencyCommitment = validateIdempotencyKey(input.idempotencyKey);
  const passwordHash = await hashPassword(temporaryPassword);
  const client = await requirePool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ADMIN_LOCK_KEY]);
    const existing = await client.query("SELECT 1 FROM portal_administrator LIMIT 1");
    if (existing.rowCount !== 0) throw new AccountProvisioningError("PORTAL_ADMINISTRATOR_ALREADY_EXISTS", 409);
    const userId = randomUUID();
    await insertAccountGraph(client, { userId, email, name, passwordHash, createdByAdminId: null });
    await client.query(
      "INSERT INTO portal_administrator (singleton_key, user_id) VALUES (1, $1)",
      [userId],
    );
    await client.query(
      "UPDATE account_provisioning_state SET created_by_admin_id = $1, updated_at = now() WHERE user_id = $1",
      [userId],
    );
    await insertAdminEvent(client, {
      actorAdminId: userId,
      targetUserId: userId,
      eventKind: "ADMIN_BOOTSTRAPPED",
      idempotencyCommitment,
    });
    await client.query("COMMIT");
    return { ok: true as const, userId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function provisionStandardAccount(input: {
  actorAdminId: string;
  email: string;
  name: string;
  temporaryPassword: string;
  idempotencyKey: string;
}) {
  const email = normalizeProvisioningEmail(input.email);
  const name = validateDisplayName(input.name);
  const temporaryPassword = validateProvisioningPassword(input.temporaryPassword);
  const idempotencyCommitment = validateIdempotencyKey(input.idempotencyKey);
  const passwordHash = await hashPassword(temporaryPassword);
  const client = await requirePool().connect();
  try {
    await beginAccountTransaction(client);
    await assertAdministrator(client, input.actorAdminId);
    const priorEvent = await client.query<{ target_user_key: string }>(
      "SELECT target_user_key FROM account_admin_events WHERE idempotency_key = $1",
      [idempotencyCommitment],
    );
    if (priorEvent.rowCount === 1) {
      const existing = await client.query<{ id: string }>("SELECT id FROM \"user\" WHERE email = $1", [email]);
      const existingId = existing.rows[0]?.id;
      if (!existingId || priorEvent.rows[0]?.target_user_key !== commitment("old-mike-account-admin-target-v1", existingId)) {
        throw new AccountProvisioningError("IDEMPOTENCY_TARGET_MISMATCH", 409);
      }
      await client.query("COMMIT");
      return { ok: true as const, userId: existingId, idempotent: true as const };
    }
    const duplicate = await client.query("SELECT 1 FROM \"user\" WHERE email = $1", [email]);
    if (duplicate.rowCount !== 0) throw new AccountProvisioningError("ACCOUNT_ALREADY_EXISTS", 409);
    const userId = randomUUID();
    const graph = await insertAccountGraph(client, {
      userId,
      email,
      name,
      passwordHash,
      createdByAdminId: input.actorAdminId,
    });
    await insertAdminEvent(client, {
      actorAdminId: input.actorAdminId,
      targetUserId: userId,
      eventKind: "ACCOUNT_PROVISIONED",
      idempotencyCommitment,
    });
    await client.query("COMMIT");
    return { ok: true as const, userId, workspaceId: graph.workspaceId, idempotent: false as const };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getAccountPolicy(userId: string) {
  const result = await requirePool().query<{
    status: AccountStatus;
    must_change_password: boolean;
    temporary_password_expires_at: Date | null;
    password_version: number;
    is_administrator: boolean;
  }>(
    `SELECT s.status, s.must_change_password, s.temporary_password_expires_at,
            s.password_version, (a.user_id IS NOT NULL) AS is_administrator
       FROM account_provisioning_state s
       LEFT JOIN portal_administrator a ON a.user_id = s.user_id AND a.singleton_key = 1
      WHERE s.user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) throw new AccountProvisioningError("ACCOUNT_PROVISIONING_STATE_MISSING", 503);
  return {
    status: row.status,
    mustChangePassword: row.must_change_password,
    temporaryPasswordExpired: row.must_change_password
      && (!row.temporary_password_expires_at || row.temporary_password_expires_at.getTime() <= Date.now()),
    passwordVersion: row.password_version,
    isAdministrator: row.is_administrator,
  };
}

export async function isSessionCreationAllowed(userId: string) {
  try {
    const policy = await getAccountPolicy(userId);
    return policy.status !== "DISABLED" && !policy.temporaryPasswordExpired;
  } catch {
    return false;
  }
}

export async function listProvisionedAccounts(actorAdminId: string) {
  const client = await requirePool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    await assertAdministrator(client, actorAdminId);
    const result = await client.query<{
      id: string;
      name: string;
      email: string;
      status: AccountStatus;
      must_change_password: boolean;
      temporary_password_expires_at: Date | null;
      password_version: number;
      is_administrator: boolean;
    }>(
      `SELECT u.id, u.name, u.email, s.status, s.must_change_password,
              s.temporary_password_expires_at, s.password_version,
              (a.user_id IS NOT NULL) AS is_administrator
         FROM account_provisioning_state s
         JOIN "user" u ON u.id = s.user_id
         LEFT JOIN portal_administrator a ON a.user_id = u.id AND a.singleton_key = 1
        ORDER BY s.created_at ASC`,
    );
    await client.query("ROLLBACK");
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      mustChangePassword: row.must_change_password,
      temporaryPasswordExpiresAt: row.temporary_password_expires_at?.toISOString() ?? null,
      passwordVersion: row.password_version,
      isAdministrator: row.is_administrator,
    }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function lockManagedTarget(client: PoolClient, actorAdminId: string, targetUserId: string) {
  await assertAdministrator(client, actorAdminId);
  const target = await client.query<{ is_administrator: boolean; must_change_password: boolean }>(
    `SELECT (a.user_id IS NOT NULL) AS is_administrator, s.must_change_password
       FROM account_provisioning_state s
       LEFT JOIN portal_administrator a ON a.user_id = s.user_id AND a.singleton_key = 1
      WHERE s.user_id = $1 FOR UPDATE OF s`,
    [targetUserId],
  );
  const row = target.rows[0];
  if (!row) throw new AccountProvisioningError("ACCOUNT_NOT_FOUND", 404);
  if (row.is_administrator) throw new AccountProvisioningError("ADMINISTRATOR_LIFECYCLE_LOCKED", 403);
  return row;
}

export async function resetTemporaryPassword(input: {
  actorAdminId: string;
  targetUserId: string;
  temporaryPassword: string;
  idempotencyKey: string;
}) {
  const temporaryPassword = validateProvisioningPassword(input.temporaryPassword);
  const passwordHash = await hashPassword(temporaryPassword);
  const idempotencyCommitment = validateIdempotencyKey(input.idempotencyKey);
  const client = await requirePool().connect();
  try {
    await beginAccountTransaction(client);
    await lockManagedTarget(client, input.actorAdminId, input.targetUserId);
    const prior = await client.query("SELECT 1 FROM account_admin_events WHERE idempotency_key = $1", [idempotencyCommitment]);
    if (prior.rowCount === 1) {
      await client.query("COMMIT");
      return { ok: true as const, idempotent: true as const };
    }
    const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS);
    await client.query(
      `UPDATE account SET password = $1, "updatedAt" = now()
        WHERE "userId" = $2 AND "providerId" = 'credential'`,
      [passwordHash, input.targetUserId],
    );
    await client.query(
      `UPDATE account_provisioning_state
          SET status = 'PASSWORD_CHANGE_REQUIRED', must_change_password = true,
              temporary_password_expires_at = $1, password_version = password_version + 1,
              updated_at = now()
        WHERE user_id = $2`,
      [expiresAt, input.targetUserId],
    );
    await client.query("DELETE FROM \"session\" WHERE \"userId\" = $1", [input.targetUserId]);
    await insertAdminEvent(client, {
      actorAdminId: input.actorAdminId,
      targetUserId: input.targetUserId,
      eventKind: "TEMPORARY_PASSWORD_RESET",
      idempotencyCommitment,
    });
    await client.query("COMMIT");
    return { ok: true as const, idempotent: false as const };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setManagedAccountEnabled(input: {
  actorAdminId: string;
  targetUserId: string;
  enabled: boolean;
  idempotencyKey: string;
}) {
  const idempotencyCommitment = validateIdempotencyKey(input.idempotencyKey);
  const client = await requirePool().connect();
  try {
    await beginAccountTransaction(client);
    const target = await lockManagedTarget(client, input.actorAdminId, input.targetUserId);
    const prior = await client.query("SELECT 1 FROM account_admin_events WHERE idempotency_key = $1", [idempotencyCommitment]);
    if (prior.rowCount === 1) {
      await client.query("COMMIT");
      return { ok: true as const, idempotent: true as const };
    }
    const status = input.enabled
      ? (target.must_change_password ? "PASSWORD_CHANGE_REQUIRED" : "ACTIVE")
      : "DISABLED";
    await client.query("UPDATE account_provisioning_state SET status = $1, updated_at = now() WHERE user_id = $2", [status, input.targetUserId]);
    if (!input.enabled) await client.query("DELETE FROM \"session\" WHERE \"userId\" = $1", [input.targetUserId]);
    await insertAdminEvent(client, {
      actorAdminId: input.actorAdminId,
      targetUserId: input.targetUserId,
      eventKind: input.enabled ? "ACCOUNT_ENABLED" : "ACCOUNT_DISABLED",
      idempotencyCommitment,
    });
    await client.query("COMMIT");
    return { ok: true as const, idempotent: false as const, status };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeManagedSessions(input: {
  actorAdminId: string;
  targetUserId: string;
  idempotencyKey: string;
}) {
  const idempotencyCommitment = validateIdempotencyKey(input.idempotencyKey);
  const client = await requirePool().connect();
  try {
    await beginAccountTransaction(client);
    await lockManagedTarget(client, input.actorAdminId, input.targetUserId);
    const prior = await client.query("SELECT 1 FROM account_admin_events WHERE idempotency_key = $1", [idempotencyCommitment]);
    if (prior.rowCount === 1) {
      await client.query("COMMIT");
      return { ok: true as const, idempotent: true as const };
    }
    await client.query("DELETE FROM \"session\" WHERE \"userId\" = $1", [input.targetUserId]);
    await insertAdminEvent(client, {
      actorAdminId: input.actorAdminId,
      targetUserId: input.targetUserId,
      eventKind: "SESSIONS_REVOKED",
      idempotencyCommitment,
    });
    await client.query("COMMIT");
    return { ok: true as const, idempotent: false as const };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function changeOwnPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  acceptConsent?: boolean;
  termsVersion?: string;
  privacyVersion?: string;
  userAgent?: string;
}) {
  const currentPassword = validateProvisioningPassword(input.currentPassword);
  const newPassword = validateProvisioningPassword(input.newPassword);
  if (currentPassword === newPassword) throw new AccountProvisioningError("PASSWORD_REUSE_REJECTED", 400);
  const client = await requirePool().connect();
  try {
    await beginAccountTransaction(client);
    const stateResult = await client.query<{ must_change_password: boolean; status: AccountStatus }>(
      "SELECT must_change_password, status FROM account_provisioning_state WHERE user_id = $1 FOR UPDATE",
      [input.userId],
    );
    const state = stateResult.rows[0];
    if (!state || state.status === "DISABLED") throw new AccountProvisioningError("ACCOUNT_ACCESS_DENIED", 403);
    const credential = await client.query<{ password: string | null }>(
      `SELECT password FROM account
        WHERE "userId" = $1 AND "providerId" = 'credential'
        FOR UPDATE`,
      [input.userId],
    );
    const currentHash = credential.rows[0]?.password;
    if (!currentHash || !await verifyPassword({ hash: currentHash, password: currentPassword })) {
      throw new AccountProvisioningError("CURRENT_PASSWORD_INVALID", 400);
    }
    if (state.must_change_password) {
      if (!input.acceptConsent || input.termsVersion !== "2026-08-16" || input.privacyVersion !== "2026-08-16") {
        throw new AccountProvisioningError("CONSENT_REQUIRED", 400);
      }
      await client.query(
        `INSERT INTO user_consents
           (id, user_id, terms_version, privacy_version, accepted_at, user_agent_key)
         VALUES ($1, $2, $3, $4, now(), $5)
         ON CONFLICT (user_id) DO NOTHING`,
        [randomUUID(), input.userId, input.termsVersion, input.privacyVersion, commitment("old-mike-user-agent-v1", input.userAgent || "unavailable")],
      );
    }
    const nextHash = await hashPassword(newPassword);
    await client.query(
      `UPDATE account SET password = $1, "updatedAt" = now()
        WHERE "userId" = $2 AND "providerId" = 'credential'`,
      [nextHash, input.userId],
    );
    await client.query(
      `UPDATE account_provisioning_state
          SET status = 'ACTIVE', must_change_password = false,
              temporary_password_expires_at = NULL,
              password_version = password_version + 1,
              password_changed_at = now(), updated_at = now()
        WHERE user_id = $1`,
      [input.userId],
    );
    const revoked = await client.query("DELETE FROM \"session\" WHERE \"userId\" = $1", [input.userId]);
    await client.query(
      `INSERT INTO audit_events (user_id, event_type, outcome, metadata)
       VALUES ($1, 'account_password_changed', 'success', $2::jsonb)`,
      [input.userId, JSON.stringify({ sessionsRevoked: revoked.rowCount ?? 0, mustChangePasswordCleared: true })],
    );
    await client.query("COMMIT");
    return { ok: true as const, sessionsRevoked: revoked.rowCount ?? 0 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
