import { constants as fsConstants } from "node:fs";
import {
  chmod,
  lstat,
  open,
  readFile,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export const ARTIFACT_CONTRACT_VERSION = "old-mike.registration-invite-artifact.v1";
export const LEDGER_CONTRACT_VERSION = "old-mike.registration-invite-recovery-ledger.v1";
export const REGISTRATION_PATH = "/register";
export const MAX_ARTIFACT_BYTES = 2048;
export const MAX_LEDGER_BYTES = 4096;

export const INVITATION_STATES = Object.freeze([
  "NOT_CREATED",
  "DB_ROW_TRACKED",
  "ARTIFACT_VALIDATED",
  "READY_FOR_PRIVATE_DOWNLOAD",
  "DOWNLOADED_LOCAL_SECURE",
  "REMOTE_REMOVED",
  "INVITE_CONSUMED_OR_REVOKED",
  "LOCAL_REMOVED",
]);

const STATE_TRANSITIONS = new Map([
  ["NOT_CREATED", "DB_ROW_TRACKED"],
  ["DB_ROW_TRACKED", "ARTIFACT_VALIDATED"],
  ["ARTIFACT_VALIDATED", "READY_FOR_PRIVATE_DOWNLOAD"],
  ["READY_FOR_PRIVATE_DOWNLOAD", "DOWNLOADED_LOCAL_SECURE"],
  ["DOWNLOADED_LOCAL_SECURE", "REMOTE_REMOVED"],
  ["REMOTE_REMOVED", "INVITE_CONSUMED_OR_REVOKED"],
  ["INVITE_CONSUMED_OR_REVOKED", "LOCAL_REMOVED"],
]);

const ARTIFACT_KEYS = Object.freeze([
  "contractVersion",
  "expiresAt",
  "singleUse",
  "portalOrigin",
  "registrationPath",
  "inviteCredential",
]);

const LEDGER_KEYS = Object.freeze([
  "contractVersion",
  "attemptId",
  "inviteId",
  "tokenKey",
  "attemptKey",
  "createdByKey",
  "createdAt",
  "expiresAt",
  "baselineActiveUnusedCount",
  "artifactSha256",
  "state",
]);

const HEX64 = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CREDENTIAL = /^[A-Za-z0-9_-]{43}$/;

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && expected.every((key, index) => actual[index] === [...expected].sort()[index]);
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

export function approvedPortalOrigin(value, expectedOrigin) {
  try {
    const parsed = new URL(value);
    const expected = new URL(expectedOrigin);
    return parsed.protocol === "https:" &&
      parsed.username === "" && parsed.password === "" &&
      parsed.pathname === "/" && parsed.search === "" && parsed.hash === "" &&
      expected.protocol === "https:" && parsed.origin === expected.origin && value === parsed.origin;
  } catch {
    return false;
  }
}

export function validateInvitationArtifact(value, expectedOrigin) {
  const shape = exactKeys(value, ARTIFACT_KEYS);
  const contract = shape && value.contractVersion === ARTIFACT_CONTRACT_VERSION;
  const origin = contract && approvedPortalOrigin(value.portalOrigin, expectedOrigin);
  const registrationPath = contract && value.registrationPath === REGISTRATION_PATH;
  const singleUse = contract && value.singleUse === true;
  const credential = contract && typeof value.inviteCredential === "string" && CREDENTIAL.test(value.inviteCredential);
  const expiry = contract && isIsoDate(value.expiresAt) && Date.parse(value.expiresAt) > Date.now();
  return {
    pass: Boolean(shape && contract && origin && registrationPath && singleUse && credential && expiry),
    shape: Boolean(shape && contract && credential && expiry),
    origin: Boolean(origin),
    path: Boolean(registrationPath),
    singleUse: Boolean(singleUse),
  };
}

export function validateRecoveryLedger(value) {
  const shape = exactKeys(value, LEDGER_KEYS);
  if (!shape || value.contractVersion !== LEDGER_CONTRACT_VERSION) return false;
  return UUID.test(value.attemptId) && UUID.test(value.inviteId) &&
    HEX64.test(value.tokenKey) && HEX64.test(value.attemptKey) && HEX64.test(value.createdByKey) &&
    isIsoDate(value.createdAt) && isIsoDate(value.expiresAt) &&
    Number.isSafeInteger(value.baselineActiveUnusedCount) && value.baselineActiveUnusedCount >= 0 &&
    HEX64.test(value.artifactSha256) && INVITATION_STATES.includes(value.state);
}

export function assertStateTransition(from, to) {
  if (STATE_TRANSITIONS.get(from) !== to) throw new Error("illegal_invitation_state_transition");
  return to;
}

export function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function serializePrivateJson(value, maximumBytes) {
  const serialized = JSON.stringify(value);
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes === 0 || bytes > maximumBytes || /[\u0000-\u001f]/.test(serialized.replaceAll("\\n", ""))) {
    throw new Error("private_json_size_or_control_character");
  }
  return serialized;
}

async function assertPrivateParent(parent) {
  const info = await lstat(parent);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("private_parent_invalid");
  await chmod(parent, 0o700);
  if (process.platform !== "win32" && ((await stat(parent)).mode & 0o777) !== 0o700) throw new Error("private_parent_mode");
  return realpath(parent);
}

export async function atomicWritePrivateJson(finalPath, value, maximumBytes, options = {}) {
  const parent = path.dirname(path.resolve(finalPath));
  const parentReal = await assertPrivateParent(parent);
  const resolvedFinal = path.resolve(finalPath);
  if (path.dirname(resolvedFinal) !== parent || path.dirname(await realpath(parent)) !== path.dirname(parentReal)) {
    throw new Error("private_path_invalid");
  }
  const existing = await lstat(resolvedFinal).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (existing && options.replace !== true) throw new Error("private_output_exists");
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) throw new Error("private_output_invalid");

  const serialized = serializePrivateJson(value, maximumBytes);
  const temporaryPath = path.join(parent, `.${path.basename(finalPath)}.${process.pid}.${Date.now()}.tmp`);
  let handle;
  try {
    handle = await open(temporaryPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0), 0o600);
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, resolvedFinal);
    await chmod(resolvedFinal, 0o600);
    const finalInfo = await lstat(resolvedFinal);
    if (!finalInfo.isFile() || finalInfo.isSymbolicLink() || finalInfo.size > maximumBytes) throw new Error("private_output_invalid");
    if (process.platform !== "win32" && (finalInfo.mode & 0o777) !== 0o600) throw new Error("private_output_mode");
    return { bytes: finalInfo.size, sha256: sha256Buffer(Buffer.from(serialized, "utf8")) };
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    await rm(resolvedFinal, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readPrivateJson(file, maximumBytes) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size <= 0 || info.size > maximumBytes) throw new Error("private_input_invalid");
  if (process.platform !== "win32" && (info.mode & 0o777) !== 0o600) throw new Error("private_input_mode");
  const contents = await readFile(file, "utf8");
  if (Buffer.byteLength(contents, "utf8") !== info.size) throw new Error("private_input_size_changed");
  return { value: JSON.parse(contents), contents, info };
}

export async function removePrivateFiles(...files) {
  for (const file of files.filter(Boolean)) await rm(file, { force: true }).catch(() => undefined);
}

export async function privateFilesAbsent(...files) {
  for (const file of files.filter(Boolean)) {
    try {
      await lstat(file);
      return false;
    } catch (error) {
      if (error?.code !== "ENOENT") return false;
    }
  }
  return true;
}
