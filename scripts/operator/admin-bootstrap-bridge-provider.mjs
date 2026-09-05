import { constants as fsConstants } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const ADMIN_BOOTSTRAP_BRIDGE_CONTRACT = "old-mike.admin-bootstrap-noninteractive-bridge.v1";
export const ADMIN_BOOTSTRAP_PRIVATE_DIRECTORY = "oldmike-admin-bootstrap";
export const ADMIN_BOOTSTRAP_REQUEST_FILE = "bootstrap-request.json";
export const ADMIN_BOOTSTRAP_LOCK_FILE = "bootstrap-execution.lock";
export const ADMIN_BOOTSTRAP_STAGING_FILE = "administrator-password-handoff.staging";
export const ADMIN_BOOTSTRAP_READY_FILE = "administrator-password-handoff.ready";
export const DEFAULT_ADMIN_BOOTSTRAP_TIMEOUT_MS = 120_000;
export const ADMIN_BOOTSTRAP_PASSWORD_ENTROPY_BYTES = 48;

const MAX_REQUEST_BYTES = 1024;
const MAX_CHILD_OUTPUT_BYTES = 4096;
const FIXED_OPERATOR_SUCCESS = Object.freeze([
  "ADMIN_BOOTSTRAP=PASS",
  "ADMIN_SINGLETON=PASS",
  "PERSONAL_WORKSPACE=PASS",
  "TEMPORARY_PASSWORD_POLICY=PASS",
  "PLAINTEXT_OUTPUT=ABSENT",
  "EXIT_CODE=0",
]);

const ERROR_CATEGORIES = new Set([
  "ADMIN_BOOTSTRAP_IDENTIFIER_MISSING",
  "ADMIN_BOOTSTRAP_IDENTIFIER_INVALID",
  "ADMIN_BOOTSTRAP_CSPRNG_FAILURE",
  "ADMIN_BOOTSTRAP_RUNTIME_POLICY",
  "ADMIN_BOOTSTRAP_LOCK_EXISTS",
  "ADMIN_BOOTSTRAP_ARTIFACT_COLLISION",
  "ADMIN_BOOTSTRAP_ARTIFACT_FAILURE",
  "ADMIN_BOOTSTRAP_SPAWN_FAILURE",
  "ADMIN_BOOTSTRAP_TIMEOUT",
  "ADMIN_BOOTSTRAP_CHILD_SIGNAL",
  "ADMIN_BOOTSTRAP_CHILD_FAILURE",
  "ADMIN_BOOTSTRAP_OUTPUT_CONTRACT",
  "ADMIN_BOOTSTRAP_SECRET_LEAK",
  "ADMIN_BOOTSTRAP_TRANSPORT_POLICY",
  "ADMIN_BOOTSTRAP_COMMIT_ARTIFACT_STATE_UNKNOWN",
  "ADMIN_BOOTSTRAP_RECOVERY_NOT_REQUIRED",
  "ADMIN_BOOTSTRAP_RECOVERY_FAILED",
]);

export class AdminBootstrapBridgeError extends Error {
  constructor(category, stage = "UNKNOWN", options = {}) {
    super(category);
    this.name = "AdminBootstrapBridgeError";
    this.category = ERROR_CATEGORIES.has(category) ? category : "ADMIN_BOOTSTRAP_CHILD_FAILURE";
    this.stage = stage;
    this.operatorCommitted = options.operatorCommitted === true;
    this.handoffState = options.handoffState ?? "NOT_READY";
  }
}

function bridgeError(category, stage, options) {
  return new AdminBootstrapBridgeError(category, stage, options);
}

function contained(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function exactLines(value) {
  const normalized = String(value).replaceAll("\r\n", "\n");
  if (!normalized) return [];
  return (normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized).split("\n");
}

function validIdentifier(value) {
  return typeof value === "string"
    && value === value.trim()
    && value.length > 0
    && Buffer.byteLength(value, "utf8") <= 254
    && !/[\u0000-\u001f\u007f]/u.test(value)
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function fixedChildEnvironment(environment) {
  const allowed = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "NODE_ENV",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
  ];
  return Object.fromEntries(allowed
    .filter((name) => typeof environment[name] === "string" && environment[name].length > 0)
    .map((name) => [name, environment[name]]));
}

async function assertPrivateDirectory(directory) {
  if (!path.isAbsolute(directory) || path.basename(directory) !== ADMIN_BOOTSTRAP_PRIVATE_DIRECTORY) {
    throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "PRIVATE_DIRECTORY_PATH");
  }
  const parent = path.dirname(directory);
  const parentInfo = await lstat(parent).catch(() => null);
  if (!parentInfo?.isDirectory() || parentInfo.isSymbolicLink() || !samePath(await realpath(parent), parent)) {
    throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "PRIVATE_DIRECTORY_PARENT");
  }
  await mkdir(directory, { mode: 0o700 }).catch((error) => {
    if (error?.code !== "EEXIST") throw error;
  });
  await chmod(directory, 0o700);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(directory), directory)) {
    throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "PRIVATE_DIRECTORY_REALPATH");
  }
  if (process.platform !== "win32" && ((await stat(directory)).mode & 0o777) !== 0o700) {
    throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "PRIVATE_DIRECTORY_MODE");
  }
}

async function assertPrivateFile(file, { expectedMode = 0o600, maximumBytes = MAX_REQUEST_BYTES } = {}) {
  const info = await lstat(file).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size < 1 || info.size > maximumBytes) {
    throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "PRIVATE_FILE_SHAPE");
  }
  if (!samePath(await realpath(file), file)) throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "PRIVATE_FILE_REALPATH");
  if (process.platform !== "win32" && (info.mode & 0o777) !== expectedMode) {
    throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "PRIVATE_FILE_MODE");
  }
  return info;
}

async function openExclusive(file, mode = 0o600) {
  return open(file, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0), mode);
}

async function fsyncDirectory(directory, hooks = {}) {
  if (hooks.beforeDirectoryFsync) await hooks.beforeDirectoryFsync(directory);
  if (process.platform === "win32") return;
  const handle = await open(directory, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writeHandleJson(handle, value) {
  const serialized = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  try {
    await handle.writeFile(serialized);
    await handle.sync();
  } finally {
    serialized.fill(0);
  }
}

async function replaceLockState(lockPath, state) {
  const handle = await open(lockPath, "r+");
  try {
    await handle.truncate(0);
    await writeHandleJson(handle, state);
  } finally {
    await handle.close();
  }
}

async function createLock(lockPath) {
  let handle;
  try {
    handle = await openExclusive(lockPath);
  } catch (error) {
    if (error?.code === "EEXIST") throw bridgeError("ADMIN_BOOTSTRAP_LOCK_EXISTS", "ONE_SHOT_LOCK");
    throw error;
  }
  await chmod(lockPath, 0o600);
  try {
    await writeHandleJson(handle, {
      contract: ADMIN_BOOTSTRAP_BRIDGE_CONTRACT,
      executionState: "RUNNING",
      operatorCommitted: false,
      handoffState: "STAGING",
    });
  } finally {
    await handle.close();
  }
}

async function readRequest(requestPath) {
  if (!await lstat(requestPath).catch(() => null)) {
    throw bridgeError("ADMIN_BOOTSTRAP_IDENTIFIER_MISSING", "REQUEST_IDENTIFIER");
  }
  await assertPrivateFile(requestPath);
  let requestBuffer = await readFile(requestPath);
  try {
    if (requestBuffer.length > MAX_REQUEST_BYTES) throw bridgeError("ADMIN_BOOTSTRAP_IDENTIFIER_INVALID", "REQUEST_SIZE");
    const text = requestBuffer.toString("utf8");
    if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || /[\u0000\r]/u.test(text)) {
      throw bridgeError("ADMIN_BOOTSTRAP_IDENTIFIER_INVALID", "REQUEST_FRAMING");
    }
    let parsed;
    try { parsed = JSON.parse(text.slice(0, -1)); } catch { throw bridgeError("ADMIN_BOOTSTRAP_IDENTIFIER_INVALID", "REQUEST_JSON"); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw bridgeError("ADMIN_BOOTSTRAP_IDENTIFIER_INVALID", "REQUEST_JSON");
    }
    const keys = Object.keys(parsed).sort();
    if (JSON.stringify(keys) !== JSON.stringify(["adminLoginIdentifier"])) {
      throw bridgeError("ADMIN_BOOTSTRAP_IDENTIFIER_INVALID", "REQUEST_FIELDS");
    }
    if (typeof parsed.adminLoginIdentifier !== "string" || parsed.adminLoginIdentifier.length === 0) {
      throw bridgeError("ADMIN_BOOTSTRAP_IDENTIFIER_MISSING", "REQUEST_IDENTIFIER");
    }
    if (!validIdentifier(parsed.adminLoginIdentifier)) {
      throw bridgeError("ADMIN_BOOTSTRAP_IDENTIFIER_INVALID", "REQUEST_IDENTIFIER");
    }
    return parsed.adminLoginIdentifier.toLowerCase();
  } finally {
    requestBuffer.fill(0);
    requestBuffer = Buffer.alloc(0);
  }
}

function generateTemporaryPassword(randomBytesImplementation) {
  let entropy;
  try {
    entropy = randomBytesImplementation(ADMIN_BOOTSTRAP_PASSWORD_ENTROPY_BYTES);
  } catch {
    throw bridgeError("ADMIN_BOOTSTRAP_CSPRNG_FAILURE", "PASSWORD_GENERATION");
  }
  if (!Buffer.isBuffer(entropy) || entropy.length < 32) {
    entropy?.fill?.(0);
    throw bridgeError("ADMIN_BOOTSTRAP_CSPRNG_FAILURE", "PASSWORD_GENERATION");
  }
  try {
    return `${entropy.toString("base64url")}!Aa9`;
  } finally {
    entropy.fill(0);
  }
}

async function prepareStagingArtifact(stagingPath, identifier, temporaryPassword, hooks = {}) {
  let handle;
  try {
    handle = await openExclusive(stagingPath);
  } catch (error) {
    if (error?.code === "EEXIST") throw bridgeError("ADMIN_BOOTSTRAP_ARTIFACT_COLLISION", "ARTIFACT_O_EXCL");
    throw bridgeError("ADMIN_BOOTSTRAP_ARTIFACT_FAILURE", "ARTIFACT_OPEN");
  }
  await chmod(stagingPath, 0o600);
  const content = Buffer.from(`${JSON.stringify({
    contract: "old-mike.admin-bootstrap-password-handoff.v1",
    administratorLogin: identifier,
    temporaryPassword,
    mustChangePassword: true,
  })}\n`, "utf8");
  try {
    if (hooks.beforeStagingWrite) await hooks.beforeStagingWrite(stagingPath);
    await handle.writeFile(content);
    await handle.sync();
  } catch {
    throw bridgeError("ADMIN_BOOTSTRAP_ARTIFACT_FAILURE", "ARTIFACT_FSYNC");
  } finally {
    content.fill(0);
    await handle.close().catch(() => undefined);
  }
  await assertPrivateFile(stagingPath, { maximumBytes: 4096 });
}

function assertTransportPolicy({ executable, operatorPath, childArguments, childEnvironment, identifier, temporaryPassword }) {
  if (!path.isAbsolute(executable) || !path.isAbsolute(operatorPath) || childArguments.length !== 1 || childArguments[0] !== operatorPath) {
    throw bridgeError("ADMIN_BOOTSTRAP_TRANSPORT_POLICY", "CHILD_ARGUMENTS");
  }
  const values = [...childArguments, ...Object.values(childEnvironment)];
  if (values.some((value) => String(value).includes(identifier) || String(value).includes(temporaryPassword))) {
    throw bridgeError("ADMIN_BOOTSTRAP_TRANSPORT_POLICY", "CHILD_SECRET_CHANNEL");
  }
}

function collectChild(child, { inputBuffer, identifier, temporaryPassword, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const append = (current, chunk) => {
      const next = `${current}${Buffer.from(chunk).toString("utf8")}`;
      if (Buffer.byteLength(next, "utf8") > MAX_CHILD_OUTPUT_BYTES) {
        throw bridgeError("ADMIN_BOOTSTRAP_OUTPUT_CONTRACT", "CHILD_OUTPUT_LIMIT");
      }
      return next;
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      inputBuffer.fill(0);
      callback();
    };
    child.stdout?.on("data", (chunk) => {
      try { stdout = append(stdout, chunk); } catch (error) { child.kill?.("SIGTERM"); finish(() => reject(error)); }
    });
    child.stderr?.on("data", (chunk) => {
      try { stderr = append(stderr, chunk); } catch (error) { child.kill?.("SIGTERM"); finish(() => reject(error)); }
    });
    child.once("error", () => finish(() => reject(bridgeError("ADMIN_BOOTSTRAP_SPAWN_FAILURE", "CHILD_SPAWN"))));
    child.once("close", (code, signal) => finish(() => {
      if (`${stdout}\n${stderr}`.includes(identifier) || `${stdout}\n${stderr}`.includes(temporaryPassword)) {
        reject(bridgeError("ADMIN_BOOTSTRAP_SECRET_LEAK", "CHILD_OUTPUT"));
      } else if (signal) {
        reject(bridgeError("ADMIN_BOOTSTRAP_CHILD_SIGNAL", "CHILD_CLOSE"));
      } else if (code !== 0) {
        reject(bridgeError("ADMIN_BOOTSTRAP_CHILD_FAILURE", "CHILD_EXIT"));
      } else if (stderr !== "" || JSON.stringify(exactLines(stdout)) !== JSON.stringify(FIXED_OPERATOR_SUCCESS)) {
        reject(bridgeError("ADMIN_BOOTSTRAP_OUTPUT_CONTRACT", "CHILD_OUTPUT"));
      } else {
        resolve({ operatorCommitted: true });
      }
    }));
    const timer = setTimeout(() => {
      child.kill?.("SIGTERM");
      finish(() => reject(bridgeError("ADMIN_BOOTSTRAP_TIMEOUT", "CHILD_TIMEOUT")));
    }, timeoutMs);
    if (!child.stdin) {
      child.kill?.("SIGTERM");
      finish(() => reject(bridgeError("ADMIN_BOOTSTRAP_TRANSPORT_POLICY", "PRIVATE_STDIN")));
      return;
    }
    child.stdin.end(inputBuffer);
  });
}

async function runOperator({
  operatorPath,
  environment,
  identifier,
  temporaryPassword,
  timeoutMs,
  spawnImplementation,
  onSpawn,
}) {
  const operatorInfo = await lstat(operatorPath).catch(() => null);
  if (!operatorInfo?.isFile() || operatorInfo.isSymbolicLink() || !samePath(await realpath(operatorPath), operatorPath)) {
    throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "OPERATOR_PATH");
  }
  const childEnvironment = fixedChildEnvironment(environment);
  if (!childEnvironment.DATABASE_URL || !childEnvironment.BETTER_AUTH_SECRET) {
    throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "OPERATOR_ENVIRONMENT");
  }
  const executable = process.execPath;
  const childArguments = [operatorPath];
  assertTransportPolicy({ executable, operatorPath, childArguments, childEnvironment, identifier, temporaryPassword });
  const inputBuffer = Buffer.from(`${JSON.stringify({
    email: identifier,
    name: "Portal Administrator",
    temporaryPassword,
    idempotencyKey: `admin-bootstrap-${randomUUID()}`,
  })}\n`, "utf8");
  let child;
  try {
    child = spawnImplementation(executable, childArguments, {
      cwd: path.dirname(operatorPath),
      env: childEnvironment,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch {
    inputBuffer.fill(0);
    throw bridgeError("ADMIN_BOOTSTRAP_SPAWN_FAILURE", "CHILD_SPAWN");
  }
  onSpawn?.({ executable, childArguments, childEnvironment, shell: false, child });
  return collectChild(child, { inputBuffer, identifier, temporaryPassword, timeoutMs });
}

function defaultPrivateDirectory() {
  return path.join(os.tmpdir(), ADMIN_BOOTSTRAP_PRIVATE_DIRECTORY);
}

export async function runAdminBootstrapBridge({
  privateDirectory = defaultPrivateDirectory(),
  operatorPath,
  environment = process.env,
  timeoutMs = DEFAULT_ADMIN_BOOTSTRAP_TIMEOUT_MS,
  randomBytesImplementation = randomBytes,
  spawnImplementation = spawn,
  hooks = {},
  onSpawn,
} = {}) {
  if (!operatorPath) throw bridgeError("ADMIN_BOOTSTRAP_RUNTIME_POLICY", "OPERATOR_PATH");
  await assertPrivateDirectory(privateDirectory);
  const requestPath = path.join(privateDirectory, ADMIN_BOOTSTRAP_REQUEST_FILE);
  const lockPath = path.join(privateDirectory, ADMIN_BOOTSTRAP_LOCK_FILE);
  const stagingPath = path.join(privateDirectory, ADMIN_BOOTSTRAP_STAGING_FILE);
  const readyPath = path.join(privateDirectory, ADMIN_BOOTSTRAP_READY_FILE);
  let identifier = "";
  let temporaryPassword = "";
  let operatorCommitted = false;
  try {
    if (await lstat(lockPath).catch(() => null)) throw bridgeError("ADMIN_BOOTSTRAP_LOCK_EXISTS", "ONE_SHOT_LOCK");
    if (await lstat(readyPath).catch(() => null)) throw bridgeError("ADMIN_BOOTSTRAP_ARTIFACT_COLLISION", "READY_COLLISION");
    identifier = await readRequest(requestPath);
    await createLock(lockPath);
    await rm(requestPath, { force: true });
    temporaryPassword = generateTemporaryPassword(randomBytesImplementation);
    await prepareStagingArtifact(stagingPath, identifier, temporaryPassword, hooks);
    await fsyncDirectory(privateDirectory, hooks);
    await runOperator({
      operatorPath,
      environment,
      identifier,
      temporaryPassword,
      timeoutMs,
      spawnImplementation,
      onSpawn,
    });
    operatorCommitted = true;
    await replaceLockState(lockPath, {
      contract: ADMIN_BOOTSTRAP_BRIDGE_CONTRACT,
      executionState: "COMMITTED_HANDOFF_PENDING",
      operatorCommitted: true,
      handoffState: "STAGING",
    });
    if (hooks.beforeReadyRename) await hooks.beforeReadyRename(stagingPath, readyPath);
    await rename(stagingPath, readyPath);
    await chmod(readyPath, 0o600);
    await assertPrivateFile(readyPath, { maximumBytes: 4096 });
    await fsyncDirectory(privateDirectory, hooks);
    await replaceLockState(lockPath, {
      contract: ADMIN_BOOTSTRAP_BRIDGE_CONTRACT,
      executionState: "COMPLETED",
      operatorCommitted: true,
      handoffState: "READY",
    });
    return Object.freeze({
      ADMIN_BOOTSTRAP_BRIDGE: "PASS",
      ADMIN_BOOTSTRAP: "PASS",
      ADMIN_SINGLETON: "PASS",
      PASSWORD_HANDOFF_READY: "PASS",
      ONE_SHOT_LOCK: "PASS",
      AUTOMATIC_RETRY: "DISABLED",
      EXIT_CODE: 0,
    });
  } catch (error) {
    const controlled = error instanceof AdminBootstrapBridgeError
      ? error
      : bridgeError(
          operatorCommitted ? "ADMIN_BOOTSTRAP_COMMIT_ARTIFACT_STATE_UNKNOWN" : "ADMIN_BOOTSTRAP_ARTIFACT_FAILURE",
          operatorCommitted ? "HANDOFF_FINALIZE" : "BRIDGE_EXECUTION",
          { operatorCommitted },
        );
    if (operatorCommitted) {
      await replaceLockState(lockPath, {
        contract: ADMIN_BOOTSTRAP_BRIDGE_CONTRACT,
        executionState: "COMMITTED_HANDOFF_PENDING",
        operatorCommitted: true,
        handoffState: await lstat(readyPath).then(() => "READY_UNCONFIRMED").catch(() => "STAGING"),
      }).catch(() => undefined);
      throw bridgeError("ADMIN_BOOTSTRAP_COMMIT_ARTIFACT_STATE_UNKNOWN", controlled.stage, {
        operatorCommitted: true,
        handoffState: "RECOVERY_REQUIRED",
      });
    }
    await rm(stagingPath, { force: true }).catch(() => undefined);
    await rm(requestPath, { force: true }).catch(() => undefined);
    await replaceLockState(lockPath, {
      contract: ADMIN_BOOTSTRAP_BRIDGE_CONTRACT,
      executionState: "FAILED",
      operatorCommitted: false,
      handoffState: "REMOVED",
    }).catch(() => undefined);
    throw controlled;
  } finally {
    identifier = "";
    temporaryPassword = "";
  }
}

export async function recoverCommittedAdminBootstrapHandoff({
  privateDirectory = defaultPrivateDirectory(),
  hooks = {},
} = {}) {
  await assertPrivateDirectory(privateDirectory);
  const lockPath = path.join(privateDirectory, ADMIN_BOOTSTRAP_LOCK_FILE);
  const stagingPath = path.join(privateDirectory, ADMIN_BOOTSTRAP_STAGING_FILE);
  const readyPath = path.join(privateDirectory, ADMIN_BOOTSTRAP_READY_FILE);
  await assertPrivateFile(lockPath, { maximumBytes: 2048 });
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  if (lock.contract !== ADMIN_BOOTSTRAP_BRIDGE_CONTRACT || lock.executionState !== "COMMITTED_HANDOFF_PENDING" || lock.operatorCommitted !== true) {
    throw bridgeError("ADMIN_BOOTSTRAP_RECOVERY_NOT_REQUIRED", "RECOVERY_LOCK");
  }
  const staging = await lstat(stagingPath).catch(() => null);
  const ready = await lstat(readyPath).catch(() => null);
  if (staging && ready) throw bridgeError("ADMIN_BOOTSTRAP_RECOVERY_FAILED", "RECOVERY_COLLISION");
  if (staging) {
    await assertPrivateFile(stagingPath, { maximumBytes: 4096 });
    if (hooks.beforeReadyRename) await hooks.beforeReadyRename(stagingPath, readyPath);
    await rename(stagingPath, readyPath);
  } else if (!ready) {
    throw bridgeError("ADMIN_BOOTSTRAP_RECOVERY_FAILED", "RECOVERY_ARTIFACT_MISSING");
  }
  await chmod(readyPath, 0o600);
  await assertPrivateFile(readyPath, { maximumBytes: 4096 });
  await fsyncDirectory(privateDirectory, hooks);
  await replaceLockState(lockPath, {
    contract: ADMIN_BOOTSTRAP_BRIDGE_CONTRACT,
    executionState: "COMPLETED",
    operatorCommitted: true,
    handoffState: "READY",
  });
  return Object.freeze({
    ADMIN_BOOTSTRAP_HANDOFF_RECOVERY: "PASS",
    OPERATOR_REEXECUTED: "NO",
    PASSWORD_HANDOFF_READY: "PASS",
    ONE_SHOT_LOCK: "PASS",
    EXIT_CODE: 0,
  });
}
