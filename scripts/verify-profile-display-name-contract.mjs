import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  DISPLAY_NAME_MAX_LENGTH,
  normalizeDisplayName,
} from "../lib/display-name-contract.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");

assert.equal(normalizeDisplayName("老麥研究者"), "老麥研究者");
assert.equal(normalizeDisplayName("Dr. Example"), "Dr. Example");
for (const value of [undefined, null, "", " 前後空白", "前後空白 ", "換\n行", "控制\u0000字元", "x".repeat(DISPLAY_NAME_MAX_LENGTH + 1)]) {
  assert.throws(() => normalizeDisplayName(value), /INVALID_DISPLAY_NAME/);
}

const [route, form, accountPage, homePage, center, authHttp, provisioning] = await Promise.all([
  read("app/api/account/profile/route.ts"),
  read("components/ProfileDisplayNameForm.tsx"),
  read("app/account/page.tsx"),
  read("app/page.tsx"),
  read("components/GuidedResearchCenter.tsx"),
  read("lib/auth-http.ts"),
  read("lib/account-provisioning.ts"),
]);

assert.match(route, /export async function PATCH/);
assert.match(route, /guardAuthRequest\(request, "\/account\/profile"\)/);
assert.match(route, /requireAuthenticatedUser\(\)/);
assert.match(route, /guardSensitiveAuthRateLimit/);
assert.match(route, /validateDisplayName/);
assert.match(route, /auth\.api\.updateUser\(\{ headers: request\.headers, body: \{ name: displayName \} \}\)/);
assert.doesNotMatch(route, /role|workspace|administrator|emailVerified/);
assert.match(route, /"Cache-Control": "no-store"/);

assert.match(authHttp, /"\/account\/profile"/);
assert.doesNotMatch(authHttp, /"\/update-user"/);
assert.match(provisioning, /return normalizeDisplayName\(value\)/);

assert.match(form, /method: "PATCH"/);
assert.match(form, /JSON\.stringify\(\{ displayName \}\)/);
assert.match(form, /router\.refresh\(\)/);
assert.match(form, /autoComplete="name"/);
assert.match(form, /aria-invalid=\{Boolean\(error\)\}/);
assert.match(form, /role="alert"/);
assert.match(form, /role="status"/);
assert.match(form, /aria-live="polite"/);
assert.doesNotMatch(form, /onPaste|preventDefault\(\).*paste/is);

assert.match(accountPage, /ProfileDisplayNameForm initialDisplayName=\{context\.session\.user\.name\}/);
assert.match(homePage, /export const dynamic = "force-dynamic"/);
assert.match(homePage, /GuidedResearchCenter displayName=\{context\.session\.user\.name\}/);
assert.match(center, /data-testid="sidebar-display-name"/);
assert.doesNotMatch(center, /研究主持人/);

console.log("PROFILE_AUTHORIZATION_CONTRACT=PASS");
console.log("PROFILE_VALIDATION_CONTRACT=PASS");
console.log("SESSION_REFRESH_CONTRACT=PASS");
console.log("DISPLAY_NAME_UI_CONTRACT=PASS");
console.log("DISPLAY_NAME_ACCESSIBILITY_CONTRACT=PASS");
