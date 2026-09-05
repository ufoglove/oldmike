import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADMIN_BOOTSTRAP_BRIDGE_CONTRACT,
  ADMIN_BOOTSTRAP_LOCK_FILE,
  ADMIN_BOOTSTRAP_PRIVATE_DIRECTORY,
  ADMIN_BOOTSTRAP_READY_FILE,
  ADMIN_BOOTSTRAP_REQUEST_FILE,
  ADMIN_BOOTSTRAP_STAGING_FILE,
  AdminBootstrapBridgeError,
  recoverCommittedAdminBootstrapHandoff,
  runAdminBootstrapBridge,
} from "./operator/admin-bootstrap-bridge-provider.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const operatorPath = path.join(portalRoot, "scripts", "bootstrap-portal-administrator.mjs");
const sentinelIdentifier = "admin-bootstrap-sentinel@fixture.invalid";
const fixedSuccess = "ADMIN_BOOTSTRAP=PASS\nADMIN_SINGLETON=PASS\nPERSONAL_WORKSPACE=PASS\nTEMPORARY_PASSWORD_POLICY=PASS\nPLAINTEXT_OUTPUT=ABSENT\nEXIT_CODE=0\n";
const baseEnvironment = Object.freeze({
  DATABASE_URL: "postgresql://disposable.invalid/fixture",
  BETTER_AUTH_SECRET: "fixture-better-auth-secret",
  NODE_ENV: "test",
  UNRELATED_SECRET: "must-not-be-inherited",
});
const observations = new Map();
const record = (name, pass) => observations.set(name, pass ? "PASS" : "FAIL");

function fakeSpawnFactory({ output = fixedSuccess, errorOutput = "", code = 0, signal = null, neverClose = false, throwOnSpawn = false } = {}) {
  const calls = [];
  const implementation = (executable, argumentsList, options) => {
    if (throwOnSpawn) throw new Error("FIXTURE_SPAWN_FAILURE");
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => { child.killed = true; return true; };
    const chunks = [];
    child.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    child.stdin.on("finish", () => {
      const privateInput = Buffer.concat(chunks);
      calls.push({ executable, argumentsList, options, privateInput });
      if (neverClose) return;
      queueMicrotask(() => {
        if (output) child.stdout.write(output);
        if (errorOutput) child.stderr.write(errorOutput);
        child.stdout.end();
        child.stderr.end();
        child.emit("close", code, signal);
      });
    });
    return child;
  };
  return { implementation, calls };
}

async function fixtureRoot() {
  const parent = await mkdtemp(path.join(os.tmpdir(), "oldmike-admin-bridge-contract-"));
  return { parent, privateDirectory: path.join(parent, ADMIN_BOOTSTRAP_PRIVATE_DIRECTORY) };
}

async function writeRequest(privateDirectory, identifier = sentinelIdentifier) {
  await mkdir(privateDirectory, { recursive: true, mode: 0o700 });
  await chmod(privateDirectory, 0o700);
  const requestPath = path.join(privateDirectory, ADMIN_BOOTSTRAP_REQUEST_FILE);
  await writeFile(requestPath, `${JSON.stringify({ adminLoginIdentifier: identifier })}\n`, { mode: 0o600, flag: "wx" });
  await chmod(requestPath, 0o600);
}

async function runFixture({
  identifier = sentinelIdentifier,
  spawnFixture = fakeSpawnFactory(),
  randomBytesImplementation = () => Buffer.alloc(48, 0x5a),
  hooks = {},
  timeoutMs = 500,
  prepare = async () => undefined,
} = {}) {
  const root = await fixtureRoot();
  await writeRequest(root.privateDirectory, identifier);
  await prepare(root.privateDirectory);
  try {
    const result = await runAdminBootstrapBridge({
      privateDirectory: root.privateDirectory,
      operatorPath,
      environment: { ...baseEnvironment },
      spawnImplementation: spawnFixture.implementation,
      randomBytesImplementation,
      hooks,
      timeoutMs,
    });
    return { ...root, result, spawnFixture };
  } catch (error) {
    return { ...root, error, spawnFixture };
  }
}

async function cleanup(root) {
  await rm(root.parent, { recursive: true, force: true });
}

assert.equal(ADMIN_BOOTSTRAP_BRIDGE_CONTRACT, "old-mike.admin-bootstrap-noninteractive-bridge.v1");

const positive = await runFixture();
try {
  assert.equal(positive.error, undefined);
  assert.equal(positive.result.ADMIN_BOOTSTRAP_BRIDGE, "PASS");
  assert.equal(positive.spawnFixture.calls.length, 1);
  const call = positive.spawnFixture.calls[0];
  const inputText = call.privateInput.toString("utf8");
  const input = JSON.parse(inputText.slice(0, -1));
  assert.equal(inputText.endsWith("\n"), true);
  assert.equal(inputText.slice(0, -1).includes("\n"), false);
  assert.equal(input.email, sentinelIdentifier);
  assert.ok(typeof input.temporaryPassword === "string" && input.temporaryPassword.length >= 64);
  assert.deepEqual(call.argumentsList, [operatorPath]);
  assert.equal(call.options.shell, false);
  assert.equal(call.options.env.UNRELATED_SECRET, undefined);
  assert.equal(Object.values(call.options.env).includes(sentinelIdentifier), false);
  assert.equal(Object.values(call.options.env).includes(input.temporaryPassword), false);
  const readyPath = path.join(positive.privateDirectory, ADMIN_BOOTSTRAP_READY_FILE);
  const readyInfo = await lstat(readyPath);
  assert.ok(readyInfo.isFile() && !readyInfo.isSymbolicLink());
  if (process.platform !== "win32") assert.equal(readyInfo.mode & 0o777, 0o600);
  assert.equal(await lstat(path.join(positive.privateDirectory, ADMIN_BOOTSTRAP_STAGING_FILE)).catch(() => null), null);
  assert.equal(await lstat(path.join(positive.privateDirectory, ADMIN_BOOTSTRAP_REQUEST_FILE)).catch(() => null), null);
  const publicOutput = Object.entries(positive.result).map(([key, value]) => `${key}=${value}`).join("\n");
  assert.equal(publicOutput.includes(sentinelIdentifier), false);
  assert.equal(publicOutput.includes(input.temporaryPassword), false);
  record("VALID_CREATE_ARTIFACT_READY", true);
  record("PRIVATE_STDIN_SINGLE_LF", true);
  record("CHILD_ENVIRONMENT_SCRUBBED", true);
  record("SHELL_FALSE", true);
  record("OPERATOR_EXECUTED_ONCE", true);
  record("ARGV_ENV_OUTPUT_SECRET_SCAN", true);

  const second = await runAdminBootstrapBridge({
    privateDirectory: positive.privateDirectory,
    operatorPath,
    environment: { ...baseEnvironment },
    spawnImplementation: positive.spawnFixture.implementation,
    randomBytesImplementation: () => Buffer.alloc(48, 0x5a),
  }).catch((error) => error);
  assert.ok(second instanceof AdminBootstrapBridgeError);
  assert.equal(second.category, "ADMIN_BOOTSTRAP_LOCK_EXISTS");
  assert.equal(positive.spawnFixture.calls.length, 1);
  record("SECOND_EXECUTION_FAIL_CLOSED", true);
} finally {
  await cleanup(positive);
}

const invalidIdentifiers = [
  "",
  "not-an-email",
  " leading@fixture.invalid",
  "trailing@fixture.invalid ",
  "line\nbreak@fixture.invalid",
  "nul\u0000byte@fixture.invalid",
  `${"a".repeat(245)}@fixture.invalid`,
];
let invalidPass = true;
for (const identifier of invalidIdentifiers) {
  const fixture = await runFixture({ identifier });
  invalidPass &&= fixture.error instanceof AdminBootstrapBridgeError
    && ["ADMIN_BOOTSTRAP_IDENTIFIER_MISSING", "ADMIN_BOOTSTRAP_IDENTIFIER_INVALID"].includes(fixture.error.category)
    && fixture.spawnFixture.calls.length === 0;
  await cleanup(fixture);
}
record("MISSING_INVALID_IDENTIFIER_FAIL_CLOSED", invalidPass);

const csprng = await runFixture({ randomBytesImplementation: () => { throw new Error("FIXTURE_CSPRNG"); } });
record("CSPRNG_FAILURE_FAIL_CLOSED", csprng.error?.category === "ADMIN_BOOTSTRAP_CSPRNG_FAILURE" && csprng.spawnFixture.calls.length === 0);
await cleanup(csprng);

const spawnFailure = await runFixture({ spawnFixture: fakeSpawnFactory({ throwOnSpawn: true }) });
record("SPAWN_FAILURE_FAIL_CLOSED", spawnFailure.error?.category === "ADMIN_BOOTSTRAP_SPAWN_FAILURE");
await cleanup(spawnFailure);

const timeout = await runFixture({ spawnFixture: fakeSpawnFactory({ neverClose: true }), timeoutMs: 20 });
record("TIMEOUT_FAIL_CLOSED", timeout.error?.category === "ADMIN_BOOTSTRAP_TIMEOUT");
await cleanup(timeout);

const signal = await runFixture({ spawnFixture: fakeSpawnFactory({ signal: "SIGTERM" }) });
record("SIGNAL_FAIL_CLOSED", signal.error?.category === "ADMIN_BOOTSTRAP_CHILD_SIGNAL");
await cleanup(signal);

const nonzero = await runFixture({ spawnFixture: fakeSpawnFactory({ code: 2, errorOutput: "ADMIN_BOOTSTRAP=FAIL\nERROR_CATEGORY=BOOTSTRAP_TRANSACTION_FAILED\nEXIT_CODE=2\n" }) });
record("NONZERO_FAIL_CLOSED", nonzero.error?.category === "ADMIN_BOOTSTRAP_CHILD_FAILURE");
await cleanup(nonzero);

const outputMismatch = await runFixture({ spawnFixture: fakeSpawnFactory({ output: "ADMIN_BOOTSTRAP=PASS\nEXIT_CODE=0\n" }) });
record("OUTPUT_CONTRACT_FAIL_CLOSED", outputMismatch.error?.category === "ADMIN_BOOTSTRAP_OUTPUT_CONTRACT");
await cleanup(outputMismatch);

const secretOutput = await runFixture({ spawnFixture: fakeSpawnFactory({ output: `${sentinelIdentifier}\n` }) });
record("OUTPUT_SECRET_LEAK_FAIL_CLOSED", secretOutput.error?.category === "ADMIN_BOOTSTRAP_SECRET_LEAK");
await cleanup(secretOutput);

const collision = await runFixture({
  prepare: async (directory) => {
    const file = path.join(directory, ADMIN_BOOTSTRAP_STAGING_FILE);
    await writeFile(file, "fixture\n", { mode: 0o600, flag: "wx" });
    await chmod(file, 0o600);
  },
});
record("ARTIFACT_O_EXCL_COLLISION_FAIL_CLOSED", collision.error?.category === "ADMIN_BOOTSTRAP_ARTIFACT_COLLISION" && collision.spawnFixture.calls.length === 0);
await cleanup(collision);

const stagingFailure = await runFixture({ hooks: { beforeStagingWrite: async () => { throw new Error("FIXTURE_FSYNC_FAILURE"); } } });
record("ARTIFACT_FSYNC_FAILURE_FAIL_CLOSED", stagingFailure.error?.category === "ADMIN_BOOTSTRAP_ARTIFACT_FAILURE" && stagingFailure.spawnFixture.calls.length === 0);
await cleanup(stagingFailure);

let renameAttempt = 0;
const renameFailure = await runFixture({
  hooks: { beforeReadyRename: async () => { renameAttempt += 1; throw new Error("FIXTURE_RENAME_FAILURE"); } },
});
try {
  assert.equal(renameFailure.error?.category, "ADMIN_BOOTSTRAP_COMMIT_ARTIFACT_STATE_UNKNOWN");
  assert.equal(renameFailure.spawnFixture.calls.length, 1);
  assert.ok(await lstat(path.join(renameFailure.privateDirectory, ADMIN_BOOTSTRAP_STAGING_FILE)));
  const lock = JSON.parse(await readFile(path.join(renameFailure.privateDirectory, ADMIN_BOOTSTRAP_LOCK_FILE), "utf8"));
  assert.equal(lock.executionState, "COMMITTED_HANDOFF_PENDING");
  const recovered = await recoverCommittedAdminBootstrapHandoff({ privateDirectory: renameFailure.privateDirectory });
  assert.equal(recovered.ADMIN_BOOTSTRAP_HANDOFF_RECOVERY, "PASS");
  assert.equal(recovered.OPERATOR_REEXECUTED, "NO");
  assert.equal(renameFailure.spawnFixture.calls.length, 1);
  record("COMMIT_SUCCESS_ARTIFACT_UNKNOWN_RECOVERY", true);
} finally {
  await cleanup(renameFailure);
}

const concurrentRoot = await fixtureRoot();
await writeRequest(concurrentRoot.privateDirectory);
const concurrentSpawn = fakeSpawnFactory();
const concurrentOptions = {
  privateDirectory: concurrentRoot.privateDirectory,
  operatorPath,
  environment: { ...baseEnvironment },
  spawnImplementation: concurrentSpawn.implementation,
  randomBytesImplementation: () => Buffer.alloc(48, 0x5a),
};
const concurrent = await Promise.allSettled([
  runAdminBootstrapBridge(concurrentOptions),
  runAdminBootstrapBridge(concurrentOptions),
]);
const winners = concurrent.filter((result) => result.status === "fulfilled").length;
const losers = concurrent.filter((result) => result.status === "rejected" && result.reason?.category === "ADMIN_BOOTSTRAP_LOCK_EXISTS").length;
record("CONCURRENT_BRIDGE_ONE_WINNER", winners === 1 && losers === 1 && concurrentSpawn.calls.length === 1);
await cleanup(concurrentRoot);

const required = [
  "VALID_CREATE_ARTIFACT_READY",
  "PRIVATE_STDIN_SINGLE_LF",
  "CHILD_ENVIRONMENT_SCRUBBED",
  "SHELL_FALSE",
  "OPERATOR_EXECUTED_ONCE",
  "ARGV_ENV_OUTPUT_SECRET_SCAN",
  "SECOND_EXECUTION_FAIL_CLOSED",
  "MISSING_INVALID_IDENTIFIER_FAIL_CLOSED",
  "CSPRNG_FAILURE_FAIL_CLOSED",
  "SPAWN_FAILURE_FAIL_CLOSED",
  "TIMEOUT_FAIL_CLOSED",
  "SIGNAL_FAIL_CLOSED",
  "NONZERO_FAIL_CLOSED",
  "OUTPUT_CONTRACT_FAIL_CLOSED",
  "OUTPUT_SECRET_LEAK_FAIL_CLOSED",
  "ARTIFACT_O_EXCL_COLLISION_FAIL_CLOSED",
  "ARTIFACT_FSYNC_FAILURE_FAIL_CLOSED",
  "COMMIT_SUCCESS_ARTIFACT_UNKNOWN_RECOVERY",
  "CONCURRENT_BRIDGE_ONE_WINNER",
];
for (const name of required) console.log(`${name}=${observations.get(name) ?? "FAIL"}`);
const pass = required.every((name) => observations.get(name) === "PASS");
console.log(`ADMIN_BOOTSTRAP_BRIDGE_CONTRACT=${pass ? "PASS" : "FAIL"}`);
console.log(`NEGATIVE_FIXTURES=${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 2);

