import "server-only";

import { Pool } from "pg";
import { authConfiguration } from "@/lib/auth-config";
import { irreversibleIdentifier } from "@/lib/auth-audit";
import { NextResponse } from "next/server";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;

let lastExpiredRateLimitSweep = 0;

// 順手清理過期速率限制列（每小時最多一次；失敗不影響主流程）。
// 過期列原本就由 upsert 原地覆寫，刪除僅為避免長期累積。
async function sweepExpiredRateLimits(client: import("pg").PoolClient) {
  const now = Date.now();
  if (now - lastExpiredRateLimitSweep < 60 * 60 * 1000) return;
  lastExpiredRateLimitSweep = now;
  try {
    await client.query("DELETE FROM portal_rate_limits WHERE reset_at < now() - interval '1 day'");
  } catch {
    // best-effort：清理失敗不阻擋速率限制主流程
  }
}

export class RateLimitStorageUnavailable extends Error {
  constructor() { super("rate_limit_storage_unavailable"); }
}

export async function consumePersistentRateLimit(input: { scope: string; identifier?: string; windowSeconds: number; max: number }) {
  if (!pool || !authConfiguration().ready) throw new RateLimitStorageUnavailable();
  const key = `${input.scope}:${irreversibleIdentifier(input.identifier || "global")}`;
  const client = await pool.connect();
  try {
    const result = await client.query<{ count: number; reset_at: Date }>(
      `INSERT INTO portal_rate_limits (key, count, reset_at)
       VALUES ($1, 1, now() + ($2::text || ' seconds')::interval)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN portal_rate_limits.reset_at <= now() THEN 1 ELSE portal_rate_limits.count + 1 END,
         reset_at = CASE WHEN portal_rate_limits.reset_at <= now() THEN now() + ($2::text || ' seconds')::interval ELSE portal_rate_limits.reset_at END
       RETURNING count, reset_at`,
      [key, input.windowSeconds],
    );
    const row = result.rows[0];
    if (!row) throw new RateLimitStorageUnavailable();
    await sweepExpiredRateLimits(client);
    const retryAfter = Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000));
    return { allowed: row.count <= input.max, retryAfter };
  } finally {
    client.release();
  }
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json({ ok: false, code: "rate_limited", error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } });
}

export async function guardSensitiveAuthRateLimit(input: { scope: string; identifier?: string; windowSeconds: number; max: number }) {
  try {
    const result = await consumePersistentRateLimit(input);
    return result.allowed ? null : rateLimitResponse(result.retryAfter);
  } catch (error) {
    if (error instanceof RateLimitStorageUnavailable) return NextResponse.json({ ok: false, code: "auth_storage_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: false, code: "auth_storage_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
