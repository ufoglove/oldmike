import "server-only";

import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { authConfiguration } from "@/lib/auth-config";
import { irreversibleIdentifier, recordAuditEvent } from "@/lib/auth-audit";
import { registrationInviteKeys } from "@/lib/registration-invite-token";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export type InviteReservation = {
  inviteId: string;
  reservationId: string;
  role: "owner" | "member";
};

export async function reserveRegistrationInvite(input: { token: string; email: string }): Promise<InviteReservation | null> {
  const config = authConfiguration();
  if (!pool || !config.ready || config.registrationMode !== "invite_only") throw new Error("invitation_storage_unavailable");
  const secret = process.env.BETTER_AUTH_SECRET as string;
  let keys;
  try { keys = registrationInviteKeys({ token: input.token, email: input.email, secret }); } catch { return null; }
  const reservationId = randomUUID();
  const result = await pool.query(
    `UPDATE registration_invites
       SET reserved_at = now(), reservation_id = $3
     WHERE token_key = $1
       AND email_key = $2
       AND used_at IS NULL
       AND revoked_at IS NULL
       AND expires_at > now()
       AND (reservation_id IS NULL OR reserved_at < now() - interval '15 minutes')
     RETURNING id, role`,
    [keys.tokenKey, keys.emailKey, reservationId],
  );
  if (result.rowCount !== 1) return null;
  return { inviteId: result.rows[0].id, reservationId, role: result.rows[0].role };
}

export async function releaseRegistrationInvite(reservation: InviteReservation) {
  if (!pool) return;
  await pool.query(
    "UPDATE registration_invites SET reserved_at = NULL, reservation_id = NULL WHERE id = $1 AND reservation_id = $2 AND used_at IS NULL AND revoked_at IS NULL",
    [reservation.inviteId, reservation.reservationId],
  );
}

export async function finalizeInvitedRegistration(input: {
  reservation: InviteReservation;
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  request: Request;
}) {
  if (!pool || !authConfiguration().ready) throw new Error("invitation_storage_unavailable");
  const acceptedAt = new Date();
  const userAgentKey = irreversibleIdentifier(input.request.headers.get("user-agent") || "unknown-user-agent");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO user_consents (id, user_id, terms_version, privacy_version, accepted_at, user_agent_key) VALUES ($1, $2, $3, $4, $5, $6)",
      [randomUUID(), input.userId, input.termsVersion, input.privacyVersion, acceptedAt, userAgentKey],
    );
    const used = await client.query(
      `UPDATE registration_invites
         SET used_at = now(), used_by_user_id = $3, reserved_at = NULL, reservation_id = NULL
       WHERE id = $1 AND reservation_id = $2 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()`,
      [input.reservation.inviteId, input.reservation.reservationId, input.userId],
    );
    if (used.rowCount !== 1) throw new Error("invitation_reservation_lost");
    await client.query("COMMIT");
    await recordAuditEvent({
      eventType: "registration_invite_consumed",
      outcome: "accepted",
      userId: input.userId,
      metadata: { inviteKey: irreversibleIdentifier(input.reservation.inviteId), role: input.reservation.role },
    });
    return acceptedAt;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function removeIncompleteRegistration(userId: string) {
  if (!pool) return;
  await pool.query(
    `DELETE FROM "user" u
      WHERE u.id = $1
        AND NOT EXISTS (SELECT 1 FROM user_consents c WHERE c.user_id = u.id)`,
    [userId],
  );
}
