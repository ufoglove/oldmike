import { constants as fsConstants } from "node:fs";
import { chmod, lstat, mkdir, readFile, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  MAX_ARTIFACT_BYTES,
  MAX_LEDGER_BYTES,
  readPrivateJson,
  validateInvitationArtifact,
  validateRecoveryLedger,
} from "./registration-invite-atomic.mjs";

const action = process.argv[2] ?? "";
const runDirectory = path.resolve(process.argv[3] ?? "");
const expectedOrigin = process.argv[4] ?? "";
const ARTIFACT_NAME = "invitation.json";
const LEDGER_NAME = "recovery-ledger.json";
const STATUS_NAME = "operator-status.log";

function fail() {
  process.exitCode = 2;
}

async function assertPrivateDirectory(directory) {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("private_directory_invalid");
  await chmod(directory, 0o700);
  const canonical = await realpath(directory);
  if (canonical !== directory) throw new Error("private_directory_realpath");
  if (process.platform !== "win32" && ((await stat(directory)).mode & 0o777) !== 0o700) {
    throw new Error("private_directory_mode");
  }
  return info;
}

async function prepare() {
  const parent = path.dirname(runDirectory);
  const name = path.basename(runDirectory);
  if (name !== "oldmike-controlled-invite" || !path.isAbsolute(runDirectory)) throw new Error("run_directory_policy");
  const parentInfo = await lstat(parent);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) throw new Error("temporary_parent_policy");
  await mkdir(runDirectory, { mode: 0o700 });
  await assertPrivateDirectory(runDirectory);
  for (const name of [ARTIFACT_NAME, LEDGER_NAME, STATUS_NAME]) {
    const target = path.join(runDirectory, name);
    const existing = await lstat(target).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (existing) throw new Error("private_output_preexists");
  }
  const statusPath = path.join(runDirectory, STATUS_NAME);
  const handle = await import("node:fs/promises").then(({ open }) => open(
    statusPath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0),
    0o600,
  ));
  await handle.close();
  await chmod(statusPath, 0o600);
}

async function assertPrivateFile(file, maximumBytes) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size <= 0 || info.size > maximumBytes) {
    throw new Error("private_file_policy");
  }
  if (process.platform !== "win32" && (info.mode & 0o777) !== 0o600) throw new Error("private_file_mode");
  if (typeof process.getuid === "function" && info.uid !== process.getuid()) throw new Error("private_file_owner");
  const canonical = await realpath(file);
  const relative = path.relative(runDirectory, canonical);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("private_file_realpath");
  return info;
}

async function verifyReady() {
  await assertPrivateDirectory(runDirectory);
  const artifactPath = path.join(runDirectory, ARTIFACT_NAME);
  const ledgerPath = path.join(runDirectory, LEDGER_NAME);
  const statusPath = path.join(runDirectory, STATUS_NAME);
  await assertPrivateFile(artifactPath, MAX_ARTIFACT_BYTES);
  await assertPrivateFile(ledgerPath, MAX_LEDGER_BYTES);
  await assertPrivateFile(statusPath, 4096);
  const artifact = await readPrivateJson(artifactPath, MAX_ARTIFACT_BYTES);
  const ledger = await readPrivateJson(ledgerPath, MAX_LEDGER_BYTES);
  if (!validateInvitationArtifact(artifact.value, expectedOrigin).pass) throw new Error("artifact_contract");
  if (!validateRecoveryLedger(ledger.value) || ledger.value.state !== "READY_FOR_PRIVATE_DOWNLOAD") {
    throw new Error("ledger_contract");
  }
  const status = await readFile(statusPath, "utf8");
  const required = [
    "INVITE_OUTPUT_CONTRACT=PASS",
    "INVITE_CREATE=PASS",
    "ARTIFACT_STATE=READY_FOR_PRIVATE_DOWNLOAD",
    "PRIVATE_FILE_READY=PASS",
    "INVITE_ARTIFACT_MODE=PASS",
    "INVITE_ARTIFACT_ORIGIN=PASS",
    "INVITE_ARTIFACT_PATH=PASS",
    "INVITE_ARTIFACT_SINGLE_USE=PASS",
  ];
  if (!required.every((line) => status.split(/\r?\n/).includes(line))) throw new Error("status_contract");
  if (/postgres(?:ql)?:\/\/|inviteCredential|@/i.test(status)) throw new Error("status_sensitive_output");
}

async function cleanup() {
  if (path.basename(runDirectory) !== "oldmike-controlled-invite") throw new Error("cleanup_path_policy");
  await rm(runDirectory, { recursive: true, force: true });
}

async function removeStatus() {
  await assertPrivateDirectory(runDirectory);
  await rm(path.join(runDirectory, STATUS_NAME), { force: true });
}

try {
  if (action === "prepare") await prepare();
  else if (action === "verify-ready") await verifyReady();
  else if (action === "remove-status") await removeStatus();
  else if (action === "cleanup") await cleanup();
  else throw new Error("unsupported_action");
} catch {
  fail();
}
