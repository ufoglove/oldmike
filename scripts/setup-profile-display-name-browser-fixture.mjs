import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const email = process.env.PROFILE_E2E_EMAIL;
const password = process.env.PROFILE_E2E_PASSWORD;
if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || !email || !password) process.exit(2);

const pool = new Pool({ connectionString: databaseUrl, max: 4 });
const migrations = [
  "0001_better_auth_core.up.sql",
  "0002_old_mike_tenant.up.sql",
  "0003_registration_invites.up.sql",
  "0004_registration_invite_revocation.up.sql",
  "0005_research_workflow_phase2.up.sql",
  "0006_admin_provisioned_accounts.up.sql",
];

async function bootstrap() {
  const input = {
    email,
    name: "Fixture Researcher",
    temporaryPassword: password,
    idempotencyKey: "profile-browser-bootstrap-0001",
  };
  const child = spawn(process.execPath, [path.join(root, "scripts/bootstrap-portal-administrator.mjs")], {
    cwd: root,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    },
  });
  let output = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.stdin.end(`${JSON.stringify(input)}\n`, "utf8");
  const [code] = await once(child, "close");
  assert.equal(code, 0);
  assert.equal(output.includes(email), false);
  assert.equal(output.includes(password), false);
}

try {
  for (const migration of migrations) {
    await pool.query(await readFile(path.join(root, "database/migrations", migration), "utf8"));
  }
  await bootstrap();
  await pool.query(
    `UPDATE account_provisioning_state
        SET status='ACTIVE', must_change_password=false,
            temporary_password_expires_at=NULL, password_changed_at=now(), updated_at=now()`,
  );
  const counts = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM portal_administrator) AS administrators,
      (SELECT count(*)::int FROM "user") AS users,
      (SELECT count(*)::int FROM account WHERE "providerId"='credential') AS credentials,
      (SELECT count(*)::int FROM workspaces) AS workspaces,
      (SELECT count(*)::int FROM workspace_members) AS memberships
  `);
  assert.deepEqual(counts.rows[0], { administrators: 1, users: 1, credentials: 1, workspaces: 1, memberships: 1 });
  console.log("PROFILE_BROWSER_FIXTURE_SETUP=PASS");
} finally {
  await pool.end();
}
