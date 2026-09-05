import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CONTROLLED_EMAIL_ENV = "AUTH_E2E_CONTROLLED_EMAIL";
export const MAX_CONTROLLED_EMAIL_BYTES = 254;
export const DEFAULT_TIMEOUT_MS = 60_000;

const ERROR_CATEGORIES = new Set([
  "CONTROLLED_EMAIL_NOT_INJECTED",
  "CONTROLLED_EMAIL_INVALID",
  "CONTROLLED_EMAIL_CONTROL_CHARACTER",
  "CONTROLLED_EMAIL_BRIDGE_TIMEOUT",
  "CONTROLLED_EMAIL_CHILD_FAILURE",
  "CONTROLLED_EMAIL_ENV_LEAK",
  "CONTROLLED_EMAIL_OUTPUT_LEAK",
  "CONTROLLED_EMAIL_TRANSPORT_POLICY",
  "CONTROLLED_EMAIL_PROVIDER_OUTPUT_CONTRACT",
  "CONTROLLED_EMAIL_VERIFIER_OUTPUT_CONTRACT",
  "CONTROLLED_EMAIL_READY_CONTRACT",
  "CONTROLLED_EMAIL_RECOVERY_FAILURE",
]);

const PROVIDER_SUCCESS = [
  "INVITE_OUTPUT_CONTRACT=PASS",
  "INVITE_CREATE=PASS",
  "ARTIFACT_STATE=READY_FOR_PRIVATE_DOWNLOAD",
  "PRIVATE_FILE_READY=PASS",
];

const VERIFIER_SUCCESS = [
  "INVITE_OUTPUT_CONTRACT=PASS",
  "INVITE_ARTIFACT_MODE=PASS",
  "INVITE_ARTIFACT_ORIGIN=PASS",
  "INVITE_ARTIFACT_PATH=PASS",
  "INVITE_ARTIFACT_SINGLE_USE=PASS",
];

const REVOKE_SUCCESS = [
  "INVITE_REVOCATION=PASS",
  "ACTIVE_UNUSED_BASELINE_RESTORED=PASS",
  "PRIVATE_RECOVERY_FILES_REMOVED=PASS",
];

export const BRIDGE_SUCCESS_OUTPUT = Object.freeze([
  "INVITE_CREATE=PASS",
  "ARTIFACT_VERIFY=PASS",
  "RECOVERY_LEDGER=PASS",
  "ARTIFACT_STATE=READY_FOR_PRIVATE_DOWNLOAD",
  "PRIVATE_FILE_READY=PASS",
  "EXIT_CODE=0",
]);

export class ControlledEmailBridgeError extends Error {
  constructor(category, options = {}) {
    super(category);
    this.name = "ControlledEmailBridgeError";
    this.category = ERROR_CATEGORIES.has(category) ? category : "CONTROLLED_EMAIL_CHILD_FAILURE";
    this.stage = options.stage ?? "UNKNOWN";
    this.recoveryExactRevoke = options.recoveryExactRevoke ?? "NOT_REQUIRED";
    this.privateRecoveryFilesRemoved = options.privateRecoveryFilesRemoved ?? "PASS";
  }
}

function fail(category, stage = "UNKNOWN") {
  throw new ControlledEmailBridgeError(category, { stage });
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function contained(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function normalizeControlledEmail(rawValue) {
  if (typeof rawValue !== "string") fail("CONTROLLED_EMAIL_NOT_INJECTED");
  if (rawValue.length === 0) fail("CONTROLLED_EMAIL_INVALID");
  if(/[\u0000-\u001f\u007f]/u.test(rawValue)) fail("CONTROLLED_EMAIL_CONTROL_CHARACTER");
  if (rawValue !== rawValue.trim()) fail("CONTROLLED_EMAIL_INVALID");
  const normalized = rawValue.normalize("NFC").toLowerCase();
  if (Buffer.byteLength(normalized, "utf8") > MAX_CONTROLLED_EMAIL_BYTES) fail("CONTROLLED_EMAIL_INVALID");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) fail("CONTROLLED_EMAIL_INVALID");
  return normalized;
}

function scrubbedEnvironment(sourceEnvironment) {
  const childEnvironment = { ...sourceEnvironment };
  delete childEnvironment[CONTROLLED_EMAIL_ENV];
  if (Object.hasOwn(childEnvironment, CONTROLLED_EMAIL_ENV)) fail("CONTROLLED_EMAIL_ENV_LEAK");
  return childEnvironment;
}

function exactLines(value) {
  const normalized = value.replaceAll("\r\n", "\n");
  if (normalized.length === 0) return [];
  const withoutFinal = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return withoutFinal.split("\n");
}

function exactFixedOutput(result, expectedLines) {
  return result.stderr === "" &&
    JSON.stringify(exactLines(result.stdout)) === JSON.stringify(expectedLines);
}

export function serializeBridgeSuccess(result) {
  const actual = Object.entries(result).map(([name, value]) => `${name}=${value}`);
  if (JSON.stringify(actual) !== JSON.stringify(BRIDGE_SUCCESS_OUTPUT)) {
    fail("CONTROLLED_EMAIL_TRANSPORT_POLICY", "BRIDGE_SUCCESS_OUTPUT_CONTRACT");
  }
  return `${actual.join("\n")}\n`;
}

function assertNoSensitiveOutput(stdout, stderr, rawEmail, normalizedEmail) {
  const combined = `${stdout}\n${stderr}`;
  const candidates = new Set([rawEmail, normalizedEmail].filter(Boolean));
  for (const candidate of candidates) {
    if (combined.includes(candidate)) fail("CONTROLLED_EMAIL_OUTPUT_LEAK");
  }
}

function assertTransportPolicy({ executable, arguments: childArguments, shell, emailFilePath, normalizedEmail }) {
  if (!path.isAbsolute(executable) || shell !== false || emailFilePath) fail("CONTROLLED_EMAIL_TRANSPORT_POLICY");
  if (!Array.isArray(childArguments) || childArguments.some((value) => typeof value !== "string")) {
    fail("CONTROLLED_EMAIL_TRANSPORT_POLICY");
  }
  if (childArguments.some((value) => value === normalizedEmail || value.includes(normalizedEmail))) {
    fail("CONTROLLED_EMAIL_TRANSPORT_POLICY");
  }
}

function collectChild(child, { input, timeoutMs, rawEmail, normalizedEmail }) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const maximumOutputBytes = 16 * 1024;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    const append = (current, chunk) => {
      const next = `${current}${Buffer.from(chunk).toString("utf8")}`;
      if (Buffer.byteLength(next, "utf8") > maximumOutputBytes) fail("CONTROLLED_EMAIL_OUTPUT_LEAK");
      return next;
    };

    child.stdout?.on("data", (chunk) => {
      try { stdout = append(stdout, chunk); } catch (error) { finish(() => reject(error)); child.kill(); }
    });
    child.stderr?.on("data", (chunk) => {
      try { stderr = append(stderr, chunk); } catch (error) { finish(() => reject(error)); child.kill(); }
    });
    child.once("error", () => finish(() => reject(new ControlledEmailBridgeError("CONTROLLED_EMAIL_CHILD_FAILURE"))));
    child.once("close", (code, signal) => finish(() => {
      try {
        assertNoSensitiveOutput(stdout, stderr, rawEmail, normalizedEmail);
        if (signal || code !== 0) fail("CONTROLLED_EMAIL_CHILD_FAILURE");
        resolve({ stdout, stderr, code: 0, signal: null });
      } catch (error) {
        reject(error);
      }
    }));

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(() => reject(new ControlledEmailBridgeError("CONTROLLED_EMAIL_BRIDGE_TIMEOUT")));
    }, timeoutMs);
    timer.unref?.();

    if (child.stdin) {
      if (typeof input === "string") child.stdin.end(input, "utf8");
      else child.stdin.end();
    } else if (typeof input === "string") {
      child.kill();
      finish(() => reject(new ControlledEmailBridgeError("CONTROLLED_EMAIL_TRANSPORT_POLICY")));
    }
  });
}

export async function transportControlledEmail({
  rawEmail,
  environment,
  executable = process.execPath,
  providerPath,
  providerArguments,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  shell = false,
  emailFilePath = "",
  spawnImplementation = spawn,
  onProviderSpawned = () => undefined,
}) {
  const normalizedEmail = normalizeControlledEmail(rawEmail);
  const childArguments = [providerPath, ...providerArguments];
  assertTransportPolicy({ executable, arguments: childArguments, shell, emailFilePath, normalizedEmail });
  const childEnvironment = scrubbedEnvironment(environment);
  const child = spawnImplementation(executable, childArguments, {
    cwd: path.dirname(providerPath),
    env: childEnvironment,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  onProviderSpawned({ childArguments, childEnvironment, shell: false });
  delete environment[CONTROLLED_EMAIL_ENV];
  if (Object.hasOwn(environment, CONTROLLED_EMAIL_ENV)) fail("CONTROLLED_EMAIL_ENV_LEAK");
  return collectChild(child, {
    input: `${normalizedEmail}\n`,
    timeoutMs,
    rawEmail,
    normalizedEmail,
  });
}

async function runRedactedChild({ script, arguments: childArguments, environment, timeoutMs }) {
  const child = spawn(process.execPath, [script, ...childArguments], {
    cwd: path.dirname(script),
    env: scrubbedEnvironment(environment),
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  return collectChild(child, { input: undefined, timeoutMs, rawEmail: "", normalizedEmail: "" });
}

async function preparePrivateRunDirectory(runDirectory) {
  if (!path.isAbsolute(runDirectory) || path.basename(runDirectory) !== "oldmike-controlled-invite") {
    fail("CONTROLLED_EMAIL_TRANSPORT_POLICY");
  }
  const parent = path.dirname(runDirectory);
  const parentInfo = await lstat(parent).catch(() => null);
  if (!parentInfo?.isDirectory() || parentInfo.isSymbolicLink()) fail("CONTROLLED_EMAIL_TRANSPORT_POLICY");
  const parentRealpath = await realpath(parent);
  if (!samePath(parent, parentRealpath)) fail("CONTROLLED_EMAIL_TRANSPORT_POLICY");
  await mkdir(runDirectory, { mode: 0o700 });
  await chmod(runDirectory, 0o700);
  const info = await lstat(runDirectory);
  if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(runDirectory), runDirectory)) {
    fail("CONTROLLED_EMAIL_TRANSPORT_POLICY");
  }
  if (process.platform !== "win32" && ((await stat(runDirectory)).mode & 0o777) !== 0o700) {
    fail("CONTROLLED_EMAIL_TRANSPORT_POLICY");
  }
  const statusPath = path.join(runDirectory, "operator-status.log");
  const handle = await open(
    statusPath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0),
    0o600,
  );
  await handle.close();
  await chmod(statusPath, 0o600);
}

async function cleanupFailedRun({ runDirectory, artifactPath, ledgerPath, revokePath, environment, timeoutMs }) {
  const artifact = await lstat(artifactPath).catch(() => null);
  const ledger = await lstat(ledgerPath).catch(() => null);
  let recoveryExactRevoke = "NOT_REQUIRED";
  if (artifact?.isFile() && ledger?.isFile()) {
    const revoke = await runRedactedChild({
      script: revokePath,
      arguments: ["--artifact", artifactPath, "--ledger", ledgerPath, "--operator", "controlled-auth-e2e-bridge"],
      environment,
      timeoutMs,
    });
    if (!exactFixedOutput(revoke, REVOKE_SUCCESS)) {
      throw new ControlledEmailBridgeError("CONTROLLED_EMAIL_RECOVERY_FAILURE", {
        stage: "EXACT_REVOKE_OUTPUT_CONTRACT",
        recoveryExactRevoke: "FAIL",
        privateRecoveryFilesRemoved: "FAIL",
      });
    }
    const artifactAfter = await lstat(artifactPath).catch(() => null);
    const ledgerAfter = await lstat(ledgerPath).catch(() => null);
    if (artifactAfter || ledgerAfter) {
      throw new ControlledEmailBridgeError("CONTROLLED_EMAIL_RECOVERY_FAILURE", {
        stage: "EXACT_REVOKE_FILE_CLEANUP",
        recoveryExactRevoke: "PASS",
        privateRecoveryFilesRemoved: "FAIL",
      });
    }
    recoveryExactRevoke = "PASS";
  } else if (artifact || ledger) {
    throw new ControlledEmailBridgeError("CONTROLLED_EMAIL_RECOVERY_FAILURE", {
      stage: "RECOVERY_TUPLE_INCOMPLETE",
      recoveryExactRevoke: "FAIL",
      privateRecoveryFilesRemoved: "FAIL",
    });
  }
  if (!contained(path.dirname(runDirectory), runDirectory) || path.basename(runDirectory) !== "oldmike-controlled-invite") {
    throw new ControlledEmailBridgeError("CONTROLLED_EMAIL_RECOVERY_FAILURE", {
      stage: "RECOVERY_PATH_POLICY",
      recoveryExactRevoke,
      privateRecoveryFilesRemoved: "FAIL",
    });
  }
  await rm(runDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  const runDirectoryAfter = await lstat(runDirectory).catch(() => null);
  if (runDirectoryAfter) {
    throw new ControlledEmailBridgeError("CONTROLLED_EMAIL_RECOVERY_FAILURE", {
      stage: "RECOVERY_DIRECTORY_CLEANUP",
      recoveryExactRevoke,
      privateRecoveryFilesRemoved: "FAIL",
    });
  }
  return { recoveryExactRevoke, privateRecoveryFilesRemoved: "PASS" };
}

export async function runControlledAuthE2E({
  environment = process.env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  operatorDirectory = path.dirname(fileURLToPath(import.meta.url)),
  providerOutputValidator = (result, providerStarted) => providerStarted && exactFixedOutput(result, PROVIDER_SUCCESS),
} = {}) {
  const rawEmail = environment[CONTROLLED_EMAIL_ENV];
  let normalizedEmail;
  try {
    normalizedEmail = normalizeControlledEmail(rawEmail);
  } catch (error) {
    delete environment[CONTROLLED_EMAIL_ENV];
    if (error instanceof ControlledEmailBridgeError && error.stage === "UNKNOWN") {
      error.stage = "CONTROLLED_EMAIL_INPUT";
    }
    throw error;
  }

  const providerPath = path.join(operatorDirectory, "create-registration-invite.mjs");
  const verifierPath = path.join(operatorDirectory, "verify-registration-invite-artifact.mjs");
  const revokePath = path.join(operatorDirectory, "revoke-registration-invite.mjs");
  const helperPath = path.join(operatorDirectory, "operator", "controlled-invite-runner-helper.mjs");
  const fixedPaths = [providerPath, verifierPath, revokePath, helperPath];
  for (const file of fixedPaths) {
    const info = await lstat(file).catch(() => null);
    if (!info?.isFile() || info.isSymbolicLink() || !samePath(await realpath(file), file)) {
      delete environment[CONTROLLED_EMAIL_ENV];
      fail("CONTROLLED_EMAIL_TRANSPORT_POLICY", "RUNTIME_PRECONDITION");
    }
  }

  const configuredOrigin = environment.BETTER_AUTH_URL ?? "";
  const parsedOrigin = (() => {
    try {
      const value = new URL(configuredOrigin);
      return value.protocol === "https:" && !value.username && !value.password && value.pathname === "/" && !value.search && !value.hash
        ? value.origin
        : "";
    } catch { return ""; }
  })();
  if (!parsedOrigin) {
    delete environment[CONTROLLED_EMAIL_ENV];
    fail("CONTROLLED_EMAIL_TRANSPORT_POLICY", "ORIGIN_POLICY");
  }

  const runDirectory = path.join(environment.TMPDIR || os.tmpdir(), "oldmike-controlled-invite");
  const artifactPath = path.join(runDirectory, "invitation.json");
  const ledgerPath = path.join(runDirectory, "recovery-ledger.json");
  const statusPath = path.join(runDirectory, "operator-status.log");
  let providerStarted = false;
  let runDirectoryPrepared = false;
  let failedStage = "PRIVATE_OUTPUT_PREPARE";

  try {
    await preparePrivateRunDirectory(runDirectory);
    runDirectoryPrepared = true;
    failedStage = "OPERATOR_CREATE";
    const provider = await transportControlledEmail({
      rawEmail: normalizedEmail,
      environment,
      providerPath,
      providerArguments: [
        "--email-stdin",
        "--base-url", parsedOrigin,
        "--ttl-hours", "1",
        "--operator", "controlled-auth-e2e-bridge",
        "--artifact", artifactPath,
        "--ledger", ledgerPath,
      ],
      timeoutMs,
      onProviderSpawned: () => { providerStarted = true; },
    });
    failedStage = "PROVIDER_OUTPUT_CONTRACT";
    if (!providerOutputValidator(provider, providerStarted)) {
      fail("CONTROLLED_EMAIL_PROVIDER_OUTPUT_CONTRACT", failedStage);
    }

    failedStage = "ARTIFACT_VERIFY";
    const verifier = await runRedactedChild({
      script: verifierPath,
      arguments: ["--artifact", artifactPath, "--expected-origin", parsedOrigin],
      environment,
      timeoutMs,
    });
    failedStage = "VERIFIER_OUTPUT_CONTRACT";
    if (!exactFixedOutput(verifier, VERIFIER_SUCCESS)) {
      fail("CONTROLLED_EMAIL_VERIFIER_OUTPUT_CONTRACT", failedStage);
    }

    await writeFile(statusPath, `${[...PROVIDER_SUCCESS, ...VERIFIER_SUCCESS].join("\n")}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "w",
    });
    await chmod(statusPath, 0o600);
    failedStage = "READY_CONTRACT";
    const readyContract = await runRedactedChild({
      script: helperPath,
      arguments: ["verify-ready", runDirectory, parsedOrigin],
      environment,
      timeoutMs,
    });
    if (readyContract.stdout !== "" || readyContract.stderr !== "") {
      fail("CONTROLLED_EMAIL_READY_CONTRACT", failedStage);
    }
    failedStage = "STATUS_CLEANUP";
    const statusCleanup = await runRedactedChild({
      script: helperPath,
      arguments: ["remove-status", runDirectory],
      environment,
      timeoutMs,
    });
    if (statusCleanup.stdout !== "" || statusCleanup.stderr !== "") {
      fail("CONTROLLED_EMAIL_READY_CONTRACT", failedStage);
    }
    return {
      INVITE_CREATE: "PASS",
      ARTIFACT_VERIFY: "PASS",
      RECOVERY_LEDGER: "PASS",
      ARTIFACT_STATE: "READY_FOR_PRIVATE_DOWNLOAD",
      PRIVATE_FILE_READY: "PASS",
      EXIT_CODE: 0,
    };
  } catch (error) {
    delete environment[CONTROLLED_EMAIL_ENV];
    const original = error instanceof ControlledEmailBridgeError
      ? error
      : new ControlledEmailBridgeError("CONTROLLED_EMAIL_CHILD_FAILURE", { stage: failedStage });
    if (original.stage === "UNKNOWN") original.stage = failedStage;
    if (!runDirectoryPrepared) throw original;
    try {
      const recovery = await cleanupFailedRun({ runDirectory, artifactPath, ledgerPath, revokePath, environment, timeoutMs });
      original.recoveryExactRevoke = recovery.recoveryExactRevoke;
      original.privateRecoveryFilesRemoved = recovery.privateRecoveryFilesRemoved;
      throw original;
    } catch (recoveryError) {
      if (recoveryError === original) throw original;
      throw recoveryError instanceof ControlledEmailBridgeError
        ? recoveryError
        : new ControlledEmailBridgeError("CONTROLLED_EMAIL_RECOVERY_FAILURE", {
            stage: `RECOVERY_AFTER_${original.stage}`,
            recoveryExactRevoke: "FAIL",
            privateRecoveryFilesRemoved: "FAIL",
          });
    }
  }
}

function printResult(result) {
  process.stdout.write(serializeBridgeSuccess(result));
}

async function main() {
  if (process.argv.length !== 2) fail("CONTROLLED_EMAIL_TRANSPORT_POLICY");
  printResult(await runControlledAuthE2E());
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirect) {
  main().catch((error) => {
    const controlled = error instanceof ControlledEmailBridgeError
      ? error
      : new ControlledEmailBridgeError("CONTROLLED_EMAIL_CHILD_FAILURE");
    const failureLines = [
      "INVITE_CREATE=FAIL",
      "ARTIFACT_VERIFY=FAIL",
      "RECOVERY_LEDGER=FAIL",
      "PRIVATE_FILE_READY=FAIL",
      `FAILED_STAGE=${controlled.stage}`,
      `ERROR_CATEGORY=${controlled.category}`,
      `RECOVERY_EXACT_REVOKE=${controlled.recoveryExactRevoke}`,
      `PRIVATE_RECOVERY_FILES_REMOVED=${controlled.privateRecoveryFilesRemoved}`,
      "AUTOMATIC_RETRY=DISABLED",
      "EXIT_CODE=2",
    ];
    process.stdout.write(`${failureLines.join("\n")}\n`);
    process.exitCode = 2;
  });
}
