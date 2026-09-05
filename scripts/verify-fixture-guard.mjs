import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authConfiguration, isFixtureConfigurationInvalid, isFixtureMode } from "../lib/auth-config.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const betterAuth = await readFile(path.join(root, "lib/better-auth.ts"), "utf8");
const keys = [
  "NODE_ENV",
  "INTEGRATION_TEST_MODE",
  "TEST_FIXTURE",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "REGISTRATION_MODE",
  "ACCOUNT_PROVISIONING_MODE",
];
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const base = {
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:5432/fixture",
  BETTER_AUTH_SECRET: "fixture-only-secret-that-is-not-a-deployment-secret",
  BETTER_AUTH_URL: "http://127.0.0.1:3194",
  REGISTRATION_MODE: "closed",
  ACCOUNT_PROVISIONING_MODE: "admin_only",
};

function setEnvironment(overrides = {}) {
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, base, { NODE_ENV: "production", INTEGRATION_TEST_MODE: "1", TEST_FIXTURE: "1" }, overrides);
}

function assertRejected(overrides) {
  setEnvironment(overrides);
  assert.equal(isFixtureMode(), false);
  assert.equal(isFixtureConfigurationInvalid(), true);
  assert.equal(authConfiguration().ready, false);
}

try {
  setEnvironment();
  assert.equal(isFixtureMode(), true, "only explicit flags plus loopback URLs enable fixtures");
  assert.equal(isFixtureConfigurationInvalid(), false);
  assert.equal(authConfiguration().ready, true);

  assertRejected({ BETTER_AUTH_URL: "https://example.com" });
  assertRejected({ BETTER_AUTH_URL: "https://oldmike-research.zeabur.app" });
  assertRejected({ BETTER_AUTH_URL: "http://portal.internal:3194" });
  assertRejected({ DATABASE_URL: "postgresql://fixture:fixture@10.0.0.5:5432/fixture" });
  assertRejected({ TEST_FIXTURE: "1", INTEGRATION_TEST_MODE: undefined });
  assertRejected({ TEST_FIXTURE: undefined, INTEGRATION_TEST_MODE: "1" });

  setEnvironment({ NODE_ENV: "test", INTEGRATION_TEST_MODE: undefined, TEST_FIXTURE: undefined });
  assert.equal(isFixtureMode(), false, "NODE_ENV=test cannot enable fixture mode");
  assert.equal(isFixtureConfigurationInvalid(), false);

  assert.match(betterAuth, /isFixtureMode\(\) \? 100 : 5/);
  assert.doesNotMatch(betterAuth, /sendVerificationEmail|sendResetPassword/);

  console.log("fixture guard security: PASS (production-runtime explicit flags, loopback URL/DB gate, fail-closed invalid fixture signals, production rate limit retained)");
} finally {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
}
