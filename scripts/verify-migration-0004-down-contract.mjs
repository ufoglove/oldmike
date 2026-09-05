import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyMigration0004DownFailure,
  migration0004DownGuardIdentifier,
} from "./migration-0004-down-diagnostics.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const downSql = await readFile(
  path.join(root, "database", "migrations", "0004_registration_invite_revocation.down.sql"),
  "utf8",
);
const realGate = await readFile(path.join(root, "scripts", "verify-migration-0004-down-real.mjs"), "utf8");

assert.equal((downSql.match(/^BEGIN;$/gm) ?? []).length, 1);
assert.equal((downSql.match(/^COMMIT;$/gm) ?? []).length, 1);
assert.match(downSql, /IF EXISTS \(SELECT 1 FROM registration_invites\)/);
assert.match(downSql, new RegExp(migration0004DownGuardIdentifier));
assert.ok(downSql.indexOf(migration0004DownGuardIdentifier) < downSql.indexOf("DROP INDEX"));
assert.doesNotMatch(downSql, /SELECT\s+(?:\*|email_key|token_key|attempt_key|revoked_by_key)/i);

assert.equal(classifyMigration0004DownFailure(0, ""), "NONE");
assert.equal(
  classifyMigration0004DownFailure(3, `本地化錯誤: ${migration0004DownGuardIdentifier}`),
  "DATA_LOSS_GUARD",
);
assert.equal(classifyMigration0004DownFailure(3, "unrelated localized failure"), "DATABASE_MIGRATION");

assert.match(realGate, /\["-X", "-v", "ON_ERROR_STOP=1", "-f", downPath\]/);
assert.match(realGate, /delete childEnvironment\.INTEGRATION_DATABASE_URL/);
assert.match(realGate, /delete childEnvironment\.DATABASE_URL/);
assert.doesNotMatch(realGate, /console\.(?:log|error)\([^\n]*(?:captured|stdout|stderr|databaseUrl)/i);

console.log("MIGRATION_0004_DOWN_CONTRACT=PASS");
console.log("DATA_LOSS_GUARD_IDENTIFIER=PASS");
console.log("PSQL_X_ON_ERROR_STOP_CONTRACT=PASS");
console.log("MIGRATION_OUTPUT_REDACTION=PASS");
