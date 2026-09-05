import "server-only";

import { createHmac } from "node:crypto";
import { Pool } from "pg";
import { authConfiguration } from "@/lib/auth-config";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

export function irreversibleIdentifier(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return "unavailable";
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}

export async function recordAuditEvent(input: {
  eventType: string;
  outcome: string;
  userId?: string | null;
  workspaceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!pool || !authConfiguration().ready) return;
  await pool.query(
    "INSERT INTO audit_events (workspace_id, user_id, event_type, outcome, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)",
    [input.workspaceId ?? null, input.userId ?? null, input.eventType, input.outcome, JSON.stringify(input.metadata ?? {})],
  );
}
