import assert from "node:assert/strict";
import { Pool } from "pg";

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1") process.exit(2);
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
try {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM portal_administrator) AS administrators,
      (SELECT count(*)::int FROM "user") AS users,
      (SELECT count(*)::int FROM account WHERE "providerId"='credential') AS credentials,
      (SELECT count(*)::int FROM workspaces) AS workspaces,
      (SELECT count(*)::int FROM workspace_members) AS memberships,
      (SELECT name FROM "user" LIMIT 1) AS display_name
  `);
  assert.deepEqual(result.rows[0], {
    administrators: 1,
    users: 1,
    credentials: 1,
    workspaces: 1,
    memberships: 1,
    display_name: "林研究者",
  });
  console.log("PROFILE_DATABASE_PROVIDER_E2E=PASS");
  console.log("ROLE_WORKSPACE_TENANT_INVARIANTS=PASS");
} finally {
  await pool.end();
}
