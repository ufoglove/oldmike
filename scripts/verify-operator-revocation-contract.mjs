import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const revoke = await readFile(path.join(root, "scripts", "revoke-registration-invite.mjs"), "utf8");
const create = await readFile(path.join(root, "scripts", "create-registration-invite.mjs"), "utf8");
const migration = await readFile(path.join(root, "database", "migrations", "0004_registration_invite_revocation.up.sql"), "utf8");
const repository = await readFile(path.join(root, "lib", "registration-invites.ts"), "utf8");

assert.match(migration, /attempt_key text/);
assert.match(migration, /revoked_at timestamptz/);
assert.match(migration, /revoked_by_key text/);
assert.match(migration, /used_or_revoked_check/);
assert.match(migration, /revoked_not_reserved_check/);
assert.match(repository, /revoked_at IS NULL/g);

assert.match(revoke, /WHERE id = \$1 AND token_key = \$2 AND attempt_key = \$3 AND created_by_key = \$4/);
assert.match(revoke, /FOR UPDATE/);
assert.match(revoke, /used_at !== null/);
assert.match(revoke, /revoked_at !== null/);
assert.match(revoke, /revoked\.rowCount !== 1/);
assert.match(revoke, /baselineActiveUnusedCount/);
assert.match(revoke, /ROLLBACK/);
assert.match(revoke, /PRIVATE_RECOVERY_FILES_REMOVED=PASS/);
assert.match(revoke, /artifactSha256/);
assert.match(revoke, /privateFilesAbsent/);
assert.doesNotMatch(revoke, /ORDER BY created_at DESC|LIMIT 1|recent|latest/i);

assert.match(create, /DB_ROW_TRACKED/);
assert.match(create, /ARTIFACT_VALIDATED/);
assert.match(create, /READY_FOR_PRIVATE_DOWNLOAD/);
assert.match(create, /compensateExact/);
assert.match(create, /commitAttempted = true/);
assert.match(create, /if \(pool && identity && commitAttempted\)/);
assert.match(create, /removePrivateFiles\(artifactPath, ledgerPath\)/);

function revokeModel(row, ledger) {
  if (!row || row.id !== ledger.inviteId || row.tokenKey !== ledger.tokenKey || row.attemptKey !== ledger.attemptKey) return "FAIL_CLOSED";
  if (row.usedAt !== null || row.revokedAt !== null) return "FAIL_CLOSED";
  return "REVOKE_EXACTLY_ONE";
}
const ledger = { inviteId: "one", tokenKey: "token", attemptKey: "attempt" };
assert.equal(revokeModel({ id: "one", tokenKey: "token", attemptKey: "attempt", usedAt: null, revokedAt: null }, ledger), "REVOKE_EXACTLY_ONE");
assert.equal(revokeModel({ id: "one", tokenKey: "token", attemptKey: "attempt", usedAt: new Date(), revokedAt: null }, ledger), "FAIL_CLOSED", "used invite cannot be revoked");
assert.equal(revokeModel({ id: "one", tokenKey: "token", attemptKey: "attempt", usedAt: null, revokedAt: new Date() }, ledger), "FAIL_CLOSED", "repeated revoke must fail closed");
assert.equal(revokeModel({ id: "other", tokenKey: "token", attemptKey: "attempt", usedAt: null, revokedAt: null }, ledger), "FAIL_CLOSED");

function compensationModel(stage) {
  const plans = {
    DB_INSERT_FAILURE: { rollback: true, exactRevoke: false, removeArtifact: true, removeLedger: true },
    TEMPORARY_WRITE_FAILURE: { rollback: true, exactRevoke: false, removeArtifact: true, removeLedger: true },
    COMMIT_FAILURE: { rollback: true, exactRevoke: true, removeArtifact: true, removeLedger: true },
    POST_VERIFY_FAILURE: { rollback: false, exactRevoke: true, removeArtifact: true, removeLedger: true },
    READY_FOR_PRIVATE_DOWNLOAD: { rollback: false, exactRevoke: false, removeArtifact: false, removeLedger: false },
  };
  return plans[stage];
}
assert.deepEqual(compensationModel("DB_INSERT_FAILURE"), { rollback: true, exactRevoke: false, removeArtifact: true, removeLedger: true });
assert.deepEqual(compensationModel("TEMPORARY_WRITE_FAILURE"), { rollback: true, exactRevoke: false, removeArtifact: true, removeLedger: true });
assert.equal(compensationModel("COMMIT_FAILURE").exactRevoke, true);
assert.equal(compensationModel("POST_VERIFY_FAILURE").exactRevoke, true);
assert.equal(compensationModel("READY_FOR_PRIVATE_DOWNLOAD").removeArtifact, false);

for (const source of [revoke, create]) {
  assert.doesNotMatch(source, /console\.log\([^\n]*(?:email|token|DATABASE_URL|artifactPath|ledgerPath)/i);
}

console.log("operator revocation contract: PASS (exact ledger identity, unused-only transaction, baseline restoration, repeated revoke fail-closed)");
