import { createHmac, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import { executeAdminBootstrapTransaction } from "./operator/admin-bootstrap-transaction-provider.mjs";

const { Pool } = pg;
const MAX_STDIN_BYTES = 2048;
const FIXED_FAILURES = new Set([
  "BOOTSTRAP_INPUT_INVALID",
  "BOOTSTRAP_SECRET_SOURCE_INVALID",
  "BOOTSTRAP_DATABASE_UNAVAILABLE",
  "BOOTSTRAP_SCHEMA_INVALID",
  "BOOTSTRAP_PRECONDITION_NOT_EMPTY",
  "BOOTSTRAP_AFFECTED_ROW_MISMATCH",
  "PORTAL_ADMINISTRATOR_ALREADY_EXISTS",
  "BOOTSTRAP_TRANSACTION_FAILED",
]);

function fail(category) {
  const safeCategory = FIXED_FAILURES.has(category) ? category : "BOOTSTRAP_TRANSACTION_FAILED";
  process.stderr.write(`ADMIN_BOOTSTRAP=FAIL\nERROR_CATEGORY=${safeCategory}\nEXIT_CODE=2\n`);
  process.exitCode = 2;
}

async function readPrivateInput() {
  if (process.argv.length !== 2 || process.stdin.isTTY) throw new Error("BOOTSTRAP_SECRET_SOURCE_INVALID");
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > MAX_STDIN_BYTES) throw new Error("BOOTSTRAP_INPUT_INVALID");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || /[\u0000\r]/.test(text)) throw new Error("BOOTSTRAP_INPUT_INVALID");
  const parsed = JSON.parse(text.slice(0, -1));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("BOOTSTRAP_INPUT_INVALID");
  const email = typeof parsed.email === "string" ? parsed.email : "";
  const name = typeof parsed.name === "string" ? parsed.name : "";
  const temporaryPassword = typeof parsed.temporaryPassword === "string" ? parsed.temporaryPassword : "";
  const idempotencyKey = typeof parsed.idempotencyKey === "string" ? parsed.idempotencyKey : "";
  if (email !== email.trim() || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\u0000-\u001f\u007f]/.test(email)) throw new Error("BOOTSTRAP_INPUT_INVALID");
  if (name !== name.trim() || name.length < 1 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error("BOOTSTRAP_INPUT_INVALID");
  if (temporaryPassword.length < 12 || temporaryPassword.length > 128 || /[\u0000\r\n]/.test(temporaryPassword)) throw new Error("BOOTSTRAP_INPUT_INVALID");
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) throw new Error("BOOTSTRAP_INPUT_INVALID");
  return { email: email.toLowerCase(), name, temporaryPassword, idempotencyKey };
}

let input;
try {
  input = await readPrivateInput();
} catch (error) {
  fail(error instanceof Error ? error.message : "BOOTSTRAP_INPUT_INVALID");
}

if (process.exitCode) {
  // Parsing failed; never touch the database.
} else if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
  fail("BOOTSTRAP_DATABASE_UNAVAILABLE");
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect().catch(() => null);
  if (!client) {
    fail("BOOTSTRAP_DATABASE_UNAVAILABLE");
    await pool.end().catch(() => undefined);
  } else {
    try {
      const passwordHash = await hashPassword(input.temporaryPassword);
      input.temporaryPassword = "";
      const userId = randomUUID();
      const accountId = randomUUID();
      const workspaceId = `ws_${randomUUID()}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const eventKey = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
        .update(`old-mike-account-idempotency-v1\0${input.idempotencyKey}`, "utf8").digest("hex");
      const targetKey = createHmac("sha256", process.env.BETTER_AUTH_SECRET)
        .update(`old-mike-account-admin-target-v1\0${userId}`, "utf8").digest("hex");
      await executeAdminBootstrapTransaction({
        client,
        input,
        passwordHash,
        userId,
        accountId,
        workspaceId,
        now,
        expiresAt,
        targetKey,
        eventKey,
      });
      process.stdout.write("ADMIN_BOOTSTRAP=PASS\nADMIN_SINGLETON=PASS\nPERSONAL_WORKSPACE=PASS\nTEMPORARY_PASSWORD_POLICY=PASS\nPLAINTEXT_OUTPUT=ABSENT\nEXIT_CODE=0\n");
    } catch (error) {
      fail(error instanceof Error ? error.message : "BOOTSTRAP_TRANSACTION_FAILED");
    } finally {
      client.release();
      await pool.end();
    }
  }
}
