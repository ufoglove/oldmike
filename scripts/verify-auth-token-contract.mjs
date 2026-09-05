import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const auth = await read("lib/better-auth.ts");
const guard = await read("lib/auth-http.ts");
const provisioning = await read("lib/account-provisioning.ts");
const forgot = await read("app/api/account/forgot-password/route.ts");

assert.match(auth, /requireEmailVerification: false/);
assert.doesNotMatch(auth, /sendVerificationEmail|sendResetPassword/);
assert.match(guard, /ADMIN_PROVISIONING_BLOCKED_PATHS/);
for (const pathName of [
  "/sign-up/email",
  "/request-password-reset",
  "/reset-password",
  "/send-verification-email",
  "/verify-email",
  "/change-password",
  "/set-password",
]) {
  assert.match(guard, new RegExp(pathName.replaceAll("/", "\\/")));
}
assert.match(provisioning, /hashPassword/);
assert.match(provisioning, /verifyPassword/);
assert.match(provisioning, /must_change_password/);
assert.match(provisioning, /DELETE FROM \\"session\\"/);
assert.match(forgot, /contact_administrator/);
assert.doesNotMatch(forgot, /sendResetPassword|reset-password\?token/);

console.log("auth credential contract: PASS (admin-only provisioning; server-side password hashing; no Email verification/reset delivery)");
