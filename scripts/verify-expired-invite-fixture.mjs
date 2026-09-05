import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = await readFile(path.join(root, "database/migrations/0003_registration_invites.up.sql"), "utf8");
const repository = await readFile(path.join(root, "lib/registration-invites.ts"), "utf8");
const publicRoute = await readFile(path.join(root, "app/api/account/register/route.ts"), "utf8");

assert.match(migration, /CHECK \(expires_at > created_at\)/);
assert.match(repository, /expires_at > now\(\)/);
assert.match(repository, /used_at IS NULL/);
assert.match(repository, /revoked_at IS NULL/);
assert.match(publicRoute, /registration_unavailable/);
assert.doesNotMatch(publicRoute, /inviteToken|registration_invites/);

console.log("expired invitation compatibility: PASS (historical data contract retained; public consumption path disabled)");
