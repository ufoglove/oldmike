import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "database", "migrations");
const camelCaseIdentifiers = new Set([
  "emailVerified",
  "createdAt",
  "updatedAt",
  "expiresAt",
  "userId",
  "accountId",
  "providerId",
  "accessToken",
  "refreshToken",
  "idToken",
  "accessTokenExpiresAt",
  "refreshTokenExpiresAt",
  "lastRequest",
]);

function findUnquotedCamelCase(sql) {
  const findings = [];
  let index = 0;
  let state = "normal";

  while (index < sql.length) {
    const character = sql[index];
    const next = sql[index + 1];

    if (state === "line-comment") {
      if (character === "\n") state = "normal";
      index += 1;
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        state = "normal";
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }
    if (state === "single-quote") {
      if (character === "'" && next === "'") {
        index += 2;
      } else if (character === "'") {
        state = "normal";
        index += 1;
      } else {
        index += 1;
      }
      continue;
    }
    if (state === "double-quote") {
      if (character === '"' && next === '"') {
        index += 2;
      } else if (character === '"') {
        state = "normal";
        index += 1;
      } else {
        index += 1;
      }
      continue;
    }

    if (character === "-" && next === "-") {
      state = "line-comment";
      index += 2;
      continue;
    }
    if (character === "/" && next === "*") {
      state = "block-comment";
      index += 2;
      continue;
    }
    if (character === "'") {
      state = "single-quote";
      index += 1;
      continue;
    }
    if (character === '"') {
      state = "double-quote";
      index += 1;
      continue;
    }

    if (/[A-Za-z_]/.test(character)) {
      const start = index;
      index += 1;
      while (index < sql.length && /[A-Za-z0-9_$]/.test(sql[index])) index += 1;
      const token = sql.slice(start, index);
      if (camelCaseIdentifiers.has(token)) {
        const line = sql.slice(0, start).split("\n").length;
        findings.push({ token, line });
      }
      continue;
    }
    index += 1;
  }

  return findings;
}

assert.deepEqual(findUnquotedCamelCase('CREATE TABLE t ("providerId" text);'), []);
assert.deepEqual(findUnquotedCamelCase("CREATE TABLE t (providerId text);"), [{ token: "providerId", line: 1 }]);

const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
assert.ok(files.length >= 4, "expected both fixed migration up/down pairs");
const violations = [];
for (const file of files) {
  const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
  for (const finding of findUnquotedCamelCase(sql)) {
    violations.push(`${file}:${finding.line}:${finding.token}`);
  }
}
assert.deepEqual(violations, [], `camelCase identifiers must be quoted: ${violations.join(", ")}`);

const coreUp = await readFile(path.join(migrationsDirectory, "0001_better_auth_core.up.sql"), "utf8");
assert.match(coreUp, /"providerId"\s+text\s+NOT NULL/);
assert.match(coreUp, /"accountId"\s+text\s+NOT NULL/);
assert.match(coreUp, /UNIQUE\s*\(\s*"providerId"\s*,\s*"accountId"\s*\)/);

const migrationManifest = JSON.parse(await readFile(path.join(root, "database", "migration-manifest.json"), "utf8"));
for (const [relativePath, expectedHash] of Object.entries(migrationManifest.sha256)) {
  const contents = await readFile(path.join(root, "database", relativePath));
  const actualHash = createHash("sha256").update(contents).digest("hex");
  assert.equal(actualHash, expectedHash, `migration checksum mismatch: ${relativePath}`);
}

const revocationDown = await readFile(
  path.join(migrationsDirectory, "0004_registration_invite_revocation.down.sql"),
  "utf8",
);
assert.equal((revocationDown.match(/^BEGIN;$/gm) ?? []).length, 1, "0004 down must have one BEGIN");
assert.equal((revocationDown.match(/^COMMIT;$/gm) ?? []).length, 1, "0004 down must have one COMMIT");
assert.match(revocationDown, /IF EXISTS \(SELECT 1 FROM registration_invites\)/);
assert.match(revocationDown, /ERRCODE = 'P0001'/);
assert.match(revocationDown, /MESSAGE = 'MIGRATION_0004_DOWN_BLOCKED_REGISTRATION_INVITES_NOT_EMPTY'/);
const guardOffset = revocationDown.indexOf("DO $migration_0004_down_guard$");
const firstDestructiveOffset = Math.min(
  ...["DROP INDEX", "DROP CONSTRAINT", "DROP COLUMN"]
    .map((needle) => revocationDown.indexOf(needle))
    .filter((offset) => offset >= 0),
);
assert.ok(guardOffset > revocationDown.indexOf("BEGIN;") && guardOffset < firstDestructiveOffset,
  "0004 down guard must precede every destructive statement");

const adminDown = await readFile(
  path.join(migrationsDirectory, "0006_admin_provisioned_accounts.down.sql"),
  "utf8",
);
assert.equal((adminDown.match(/^BEGIN;$/gm) ?? []).length, 1, "0006 down must have one BEGIN");
assert.equal((adminDown.match(/^COMMIT;$/gm) ?? []).length, 1, "0006 down must have one COMMIT");
assert.match(adminDown, /IF EXISTS \(SELECT 1 FROM portal_administrator\)/);
assert.match(adminDown, /OR EXISTS \(SELECT 1 FROM account_provisioning_state\)/);
assert.match(adminDown, /OR EXISTS \(SELECT 1 FROM account_admin_events\)/);
assert.match(adminDown, /ERRCODE = 'P0001'/);
assert.match(adminDown, /MESSAGE = 'MIGRATION_0006_DOWN_BLOCKED_ADMIN_PROVISIONED_ACCOUNTS_NOT_EMPTY'/);
const adminGuardOffset = adminDown.indexOf("DO $migration_0006_down_guard$");
const adminFirstDropOffset = adminDown.indexOf("DROP TRIGGER");
assert.ok(adminGuardOffset > adminDown.indexOf("BEGIN;") && adminGuardOffset < adminFirstDropOffset,
  "0006 down guard must precede every destructive statement");

const topicLabDown = await readFile(
  path.join(migrationsDirectory, "0007_topic_lab_frontier_radar.down.sql"),
  "utf8",
);
assert.equal((topicLabDown.match(/^BEGIN;$/gm) ?? []).length, 1, "0007 down must have one BEGIN");
assert.equal((topicLabDown.match(/^COMMIT;$/gm) ?? []).length, 1, "0007 down must have one COMMIT");
assert.match(topicLabDown, /IF EXISTS \(SELECT 1 FROM research_topic_lab_runs\)/);
assert.match(topicLabDown, /OR EXISTS \(SELECT 1 FROM research_topic_lab_promotions\)/);
assert.match(topicLabDown, /gate_type = 'RESEARCH_DIRECTION'/);
assert.match(topicLabDown, /ERRCODE = 'P0001'/);
assert.match(topicLabDown, /MESSAGE = 'MIGRATION_0007_DOWN_BLOCKED_TOPIC_LAB_DATA_PRESENT'/);
const topicLabGuardOffset = topicLabDown.indexOf("DO $migration_0007_down_guard$");
const topicLabFirstDropOffset = topicLabDown.indexOf("DROP TRIGGER");
assert.ok(topicLabGuardOffset > topicLabDown.indexOf("BEGIN;") && topicLabGuardOffset < topicLabFirstDropOffset,
  "0007 down guard must precede every destructive statement");

console.log(`migration identifiers: PASS (${files.length} SQL files; quoted camelCase audit clean)`);
