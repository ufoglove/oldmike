import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  closeSync, existsSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTRACT_ID = "old-mike-v2-beta2/product-acceptance/4";
const RUNTIME_CONTRACT = "old-mike-v2-beta2/2.0.0-alpha.11";
const CLAIM_SCHEMA = "old-mike-v2-beta2/product-acceptance-run-claim/4";
const ATTEMPT_SCHEMA = "old-mike-v2-beta2/product-acceptance-attempt-start/4";
const OBSERVATION_SCHEMA = "old-mike-v2-beta2/product-acceptance-observation-receipt/4";
const CLEANUP_SCHEMA = "old-mike-v2-beta2/product-acceptance-cleanup-receipt/4";
const INNER_SCHEMA = "old-mike-v2-beta2/product-acceptance-inner-outcome/4";
const TERMINAL_SCHEMA = "old-mike-v2-beta2/product-acceptance-launcher-terminal/4";
const DEADLINE_MS = 900_000;
const STREAM_CAP_BYTES = 1_048_576;
const PRODUCT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = path.dirname(PRODUCT_ROOT);
const LAUNCHER_PATH = fileURLToPath(import.meta.url);
const RUNNER_PATH = path.join(PRODUCT_ROOT, "scripts", "run-v2-beta2-product-acceptance.ps1");
const SYSTEM_ROOT = process.env.SystemRoot ?? "C:\\Windows";
const POWERSHELL_PATH = path.join(SYSTEM_ROOT, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const TASKKILL_PATH = path.join(SYSTEM_ROOT, "System32", "taskkill.exe");
const DEFAULT_AUTHORITY_ROOT = path.join(WORKSPACE_ROOT, ".v2-beta2-product-acceptance-v4");
const EXCLUDED_TOP_LEVEL = new Set([".next", "node_modules", "playwright-report", "test-results", "logs", "screenshots", "runtime-artifact"]);
const BUNDLE_PATHS = Object.freeze([
  "e2e/v2-beta2-product-acceptance.spec.ts",
  "lib/v2-beta2/product-acceptance.ts",
  "package.json",
  "product-acceptance/V2_BETA2_PROFESSOR_PLAYBOOK.md",
  "product-acceptance/v2-beta2-product-acceptance.contract.json",
  "product-acceptance/v2-beta2-product-acceptance.vectors.json",
  "scripts/run-v2-beta2-product-acceptance.mjs",
  "scripts/run-v2-beta2-product-acceptance.ps1",
  "scripts/verify-v2-beta2-a1-boundary.mjs",
  "scripts/verify-v2-beta2-product-acceptance.mjs",
]);
const ENVIRONMENT_KEYS = Object.freeze(["SystemRoot", "WINDIR", "ComSpec", "PATH", "TEMP", "TMP"]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const zeroHash = () => sha256(Buffer.alloc(0));
const exactOrdered = (value, keys, code) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) throw new Error(code);
  return value;
};
const hash = (value, code) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(code);
  return value;
};
const reason = (value, code) => {
  if (typeof value !== "string" || !/^[A-Z][A-Z0-9_]{2,95}$/u.test(value)) throw new Error(code);
  return value;
};
const count = (value, minimum, maximum, code) => {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(code);
  return value;
};
const sanitizedReason = (error, fallback = "OUTER_UNEXPECTED_FAILURE") => {
  const candidate = error instanceof Error ? error.message : fallback;
  return /^[A-Z][A-Z0-9_]{2,95}$/u.test(candidate) ? candidate : fallback;
};

function parseJsonString(raw, cursor, code) {
  const start = cursor.index;
  if (raw[cursor.index] !== '"') throw new Error(code);
  cursor.index += 1;
  while (cursor.index < raw.length) {
    const character = raw[cursor.index];
    if (character === '"') {
      cursor.index += 1;
      try { return JSON.parse(raw.slice(start, cursor.index)); } catch { throw new Error(code); }
    }
    if (character === "\\") { cursor.index += 2; continue; }
    if (character.charCodeAt(0) < 0x20) throw new Error(code);
    cursor.index += 1;
  }
  throw new Error(code);
}

function parseDuplicateAwareJson(raw, code) {
  if (typeof raw !== "string" || raw.startsWith("\uFEFF")) throw new Error(code);
  const cursor = { index: 0 };
  const whitespace = () => { while (/\s/u.test(raw[cursor.index] ?? "")) cursor.index += 1; };
  const value = () => {
    whitespace();
    const character = raw[cursor.index];
    if (character === "{") {
      cursor.index += 1; whitespace(); const keys = new Set();
      if (raw[cursor.index] === "}") { cursor.index += 1; return; }
      while (cursor.index < raw.length) {
        whitespace(); const key = parseJsonString(raw, cursor, code);
        if (keys.has(key)) throw new Error(code); keys.add(key); whitespace();
        if (raw[cursor.index] !== ":") throw new Error(code); cursor.index += 1; value(); whitespace();
        if (raw[cursor.index] === "}") { cursor.index += 1; return; }
        if (raw[cursor.index] !== ",") throw new Error(code); cursor.index += 1;
      }
      throw new Error(code);
    }
    if (character === "[") {
      cursor.index += 1; whitespace();
      if (raw[cursor.index] === "]") { cursor.index += 1; return; }
      while (cursor.index < raw.length) {
        value(); whitespace();
        if (raw[cursor.index] === "]") { cursor.index += 1; return; }
        if (raw[cursor.index] !== ",") throw new Error(code); cursor.index += 1;
      }
      throw new Error(code);
    }
    if (character === '"') { parseJsonString(raw, cursor, code); return; }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(raw.slice(cursor.index))?.[0];
    if (!token) throw new Error(code); cursor.index += token.length;
  };
  value(); whitespace();
  if (cursor.index !== raw.length) throw new Error(code);
  try { return JSON.parse(raw); } catch { throw new Error(code); }
}

function parseStrictRecord(bytes, parser, code) {
  const raw = bytes.toString("utf8");
  if (bytes.length === 0 || bytes[0] === 0xef || !raw.endsWith("\n") || raw.endsWith("\n\n")) throw new Error(code);
  const parsed = parser(parseDuplicateAwareJson(raw.slice(0, -1), code));
  if (`${JSON.stringify(parsed)}\n` !== raw) throw new Error(code);
  return parsed;
}

function writeExclusiveRecord(target, record) {
  const bytes = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
  const descriptor = openSync(target, "wx", 0o600);
  try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  return bytes;
}

function atomicRecord(target, record) {
  const bytes = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
  const temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`;
  const descriptor = openSync(temporary, "wx", 0o600);
  try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  try { linkSync(temporary, target); } finally { unlinkSync(temporary); }
  return bytes;
}

function fileAuthority(filePath, displayPath = filePath) {
  const bytes = readFileSync(filePath);
  return { path: displayPath, size: bytes.length, sha256: sha256(bytes) };
}

function productAuthority() {
  const leaves = [];
  const walk = (directory, relativeDirectory = "") => {
    for (const name of readdirSync(directory)) {
      if (!relativeDirectory && EXCLUDED_TOP_LEVEL.has(name)) continue;
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      if (relativePath === "next-env.d.ts") continue;
      const absolutePath = path.join(directory, name);
      const stats = lstatSync(absolutePath);
      if (stats.isSymbolicLink()) throw new Error("PRODUCT_REPARSE_ENTRY");
      if (stats.isDirectory()) walk(absolutePath, relativePath);
      else if (stats.isFile()) leaves.push({ relativePath, absolutePath, size: stats.size });
      else throw new Error("PRODUCT_NONREGULAR_ENTRY");
    }
  };
  walk(PRODUCT_ROOT);
  leaves.sort((left, right) => left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0);
  const entries = leaves.map((leaf) => ({ ...leaf, sha256: sha256(readFileSync(leaf.absolutePath)) }));
  const stream = Buffer.concat(entries.map((entry) => Buffer.from(`${entry.relativePath}\0${entry.size}\0${entry.sha256}\n`, "utf8")));
  return { fileCount: entries.length, totalBytes: entries.reduce((sum, entry) => sum + entry.size, 0), entryStreamBytes: stream.length, entryStreamSha256: sha256(stream) };
}

function bundleAuthority() {
  const entries = BUNDLE_PATHS.map((relativePath) => fileAuthority(path.join(PRODUCT_ROOT, ...relativePath.split("/")), relativePath));
  const ordered = [...entries].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (ordered.some((entry, index) => entry.path !== BUNDLE_PATHS[index])) throw new Error("ACCEPTANCE_BUNDLE_ORDER_INVALID");
  const stream = Buffer.concat(ordered.map((entry) => Buffer.from(`${entry.path}\0${entry.size}\0${entry.sha256}\n`, "utf8")));
  return { entries: ordered, entryStreamBytes: stream.length, sha256: sha256(stream) };
}

function authorityRootIdentity(authorityRoot) {
  mkdirSync(authorityRoot, { recursive: true });
  const resolvedPath = realpathSync.native(authorityRoot);
  const stats = statSync(resolvedPath, { bigint: true });
  return { resolvedPath, volumeIdentity: stats.dev.toString(10), fileIdentity: stats.ino.toString(10) };
}

function environmentFor(ownedRoot) {
  const childTemp = path.join(ownedRoot, "child-temp");
  const values = {
    SystemRoot: SYSTEM_ROOT,
    WINDIR: process.env.WINDIR ?? SYSTEM_ROOT,
    ComSpec: process.env.ComSpec ?? path.join(SYSTEM_ROOT, "System32", "cmd.exe"),
    PATH: [path.dirname(process.execPath), path.join(SYSTEM_ROOT, "System32"), path.dirname(POWERSHELL_PATH)].join(path.delimiter),
    TEMP: childTemp,
    TMP: childTemp,
  };
  const ordered = ENVIRONMENT_KEYS.map((key) => ({ key, value: values[key] }));
  const fingerprint = sha256(Buffer.from(ordered.map(({ key, value }) => `${key}\0${value}\n`).join(""), "utf8"));
  return { values, ordered, fingerprint, childTemp };
}

function toolAuthorities() {
  return {
    launcher: fileAuthority(LAUNCHER_PATH, "scripts/run-v2-beta2-product-acceptance.mjs"),
    runner: fileAuthority(RUNNER_PATH, "scripts/run-v2-beta2-product-acceptance.ps1"),
    node: fileAuthority(process.execPath, realpathSync.native(process.execPath)),
    powershell: fileAuthority(POWERSHELL_PATH, realpathSync.native(POWERSHELL_PATH)),
    taskkill: fileAuthority(TASKKILL_PATH, realpathSync.native(TASKKILL_PATH)),
  };
}

function computeRunKey(product, bundle, rootIdentity) {
  const preimage = `${CONTRACT_ID}\0${product.entryStreamSha256}\0${bundle.sha256}\0${rootIdentity.resolvedPath}\0${rootIdentity.volumeIdentity}\0${rootIdentity.fileIdentity}\n`;
  return sha256(Buffer.from(preimage, "utf8"));
}

function parseInner(value) {
  const code = "INNER_OUTCOME_INVALID";
  if (value?.status === "PASS") {
    const input = exactOrdered(value, ["schemaId", "status", "attemptId", "contractId", "runtimeContract", "environmentFingerprint", "acceptanceBundleSha256", "contractFileSha256", "vectorsFileSha256", "acceptanceAuthorityAssertions", "observationReceiptAuthority", "cleanupReceiptAuthority", "databaseObservation", "counts", "externalEffects", "protocol", "cleanup", "primaryFailure", "cleanupFailure"], code);
    if (input.schemaId !== INNER_SCHEMA || input.contractId !== CONTRACT_ID || input.runtimeContract !== RUNTIME_CONTRACT || input.primaryFailure !== null || input.cleanupFailure !== null) throw new Error(code);
    hash(input.environmentFingerprint, code); hash(input.acceptanceBundleSha256, code); hash(input.contractFileSha256, code); hash(input.vectorsFileSha256, code);
    return input;
  }
  const input = exactOrdered(value, ["schemaId", "status", "attemptId", "environmentFingerprint", "observationReceiptAuthority", "cleanupReceiptAuthority", "cleanup", "primaryFailure", "cleanupFailure"], code);
  if (input.schemaId !== INNER_SCHEMA || !["FAIL", "BLOCKED"].includes(input.status) || !/^[0-9a-f]{32}$/u.test(input.attemptId)) throw new Error(code);
  hash(input.environmentFingerprint, code);
  if (!input.primaryFailure && !input.cleanupFailure) throw new Error(code);
  return input;
}

function parseObservation(value) {
  const code = "OBSERVATION_RECEIPT_INVALID";
  const input = exactOrdered(value, ["schemaId", "status", "attemptId", "ledger", "ledgerSha256", "counters", "externalEffects", "byteProvenance", "assertions"], code);
  if (input.schemaId !== OBSERVATION_SCHEMA || input.status !== "PASS" || !/^[0-9a-f]{32}$/u.test(input.attemptId) || !Array.isArray(input.ledger) || input.ledger.length < 20) throw new Error(code);
  let previous = "0".repeat(64);
  input.ledger.forEach((entry, index) => {
    exactOrdered(entry, ["sequence", "kind", "label", "data", "previousEntryHash", "entryHash"], code);
    if (entry.sequence !== index + 1 || entry.previousEntryHash !== previous) throw new Error(code);
    const expected = sha256(Buffer.from(JSON.stringify({ sequence: entry.sequence, kind: entry.kind, label: entry.label, data: entry.data, previousEntryHash: entry.previousEntryHash }), "utf8"));
    if (entry.entryHash !== expected) throw new Error(code);
    previous = entry.entryHash;
  });
  if (input.ledgerSha256 !== previous) throw new Error(code);
  const counters = exactOrdered(input.counters, ["journeys", "viewports", "successfulAuthSessions", "productGetRequests", "productPostRequests", "providerSubmissions", "snapshots", "events", "reloads", "idempotentReplays", "idempotencyConflicts", "unknownLookupRequests", "formalResearchWrites", "nonloopbackBrowserRequests", "axeSerious", "axeCritical", "keyboardFocusChecks", "liveRegionChecks"], code);
  if (counters.journeys !== 1 || counters.viewports !== 2 || counters.successfulAuthSessions !== 7 || counters.productPostRequests !== 7 || counters.providerSubmissions !== 4 || counters.snapshots !== 4 || counters.events !== 6 || counters.reloads !== 2 || counters.idempotentReplays !== 1 || counters.idempotencyConflicts !== 1 || counters.unknownLookupRequests !== 1 || counters.formalResearchWrites !== 0 || counters.nonloopbackBrowserRequests !== 0 || counters.axeSerious !== 0 || counters.axeCritical !== 0) throw new Error(code);
  const effects = exactOrdered(input.externalEffects, ["liveProvider", "formalResearchWrite", "nonloopbackNetwork"], code);
  if (Object.values(effects).some((item) => item !== 0)) throw new Error(code);
  const provenance = exactOrdered(input.byteProvenance, ["apiFileCrlf", "browserDomLf"], code);
  if (provenance.apiFileCrlf?.stage !== "ORIGINAL_API_OR_FILE_STRING" || provenance.apiFileCrlf?.contentByteLength !== 50 || provenance.apiFileCrlf?.contentHash !== "5be5c122cb4c06ebc61556389f3240c15b7dfc942bf301d2c7c4e009fd07f071" || provenance.browserDomLf?.stage !== "BROWSER_DOM_TEXT_VALUE" || provenance.browserDomLf?.contentByteLength !== 49 || provenance.browserDomLf?.contentHash !== "256a44a40bc20a0c09b7c94277c33ad64a142f823c4d899de2178e78ad28a685") throw new Error(code);
  return input;
}

function parseCleanup(value) {
  const code = "CLEANUP_RECEIPT_INVALID";
  const input = exactOrdered(value, ["schemaId", "status", "attemptId", "environmentFingerprint", "registeredPids", "descendantPids", "listenerPorts", "ownedRootInventory", "listenerCount", "processResidualCount", "tempResidualCount"], code);
  if (input.schemaId !== CLEANUP_SCHEMA || input.status !== "PASS" || input.listenerCount !== 0 || input.processResidualCount !== 0 || input.tempResidualCount !== 0) throw new Error(code);
  hash(input.environmentFingerprint, code);
  return input;
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return server;
}

async function portIsFree(port) {
  const server = net.createServer();
  try { await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); }); return true; }
  catch { return false; }
  finally { if (server.listening) await new Promise((resolve) => server.close(resolve)); }
}

async function terminateTree(child, observation) {
  if (!child || child.pid === undefined) return;
  observation.gracefulTerminationAttempted = true;
  try { child.kill("SIGTERM"); } catch { /* observation continues to forced tree termination */ }
  await new Promise((resolve) => setTimeout(resolve, 500));
  observation.forcedTerminationAttempted = true;
  await new Promise((resolve) => {
    const killer = spawn(TASKKILL_PATH, ["/PID", String(child.pid), "/T", "/F"], { cwd: PRODUCT_ROOT, env: { SystemRoot: SYSTEM_ROOT }, shell: false, stdio: "ignore", windowsHide: true });
    killer.once("close", resolve); killer.once("error", resolve);
  });
}

function inventory(directory, prefix = "") {
  if (!existsSync(directory)) return [];
  const result = [];
  for (const name of readdirSync(directory)) {
    const item = path.join(directory, name); const relative = prefix ? `${prefix}/${name}` : name; const stats = lstatSync(item);
    if (stats.isSymbolicLink()) result.push(`${relative}:REPARSE`);
    else if (stats.isDirectory()) { result.push(`${relative}/`); result.push(...inventory(item, relative)); }
    else result.push(relative);
  }
  return result.sort();
}

function nullableAuthority(filePath) {
  return existsSync(filePath) ? fileAuthority(filePath, filePath) : null;
}

async function observeChild(executable, argv, options) {
  const observation = { spawnAttempted: true, pid: null, exitCode: null, signal: null, timedOut: false, overflowed: false, stdoutBytes: 0, stdoutSha256: zeroHash(), stderrBytes: 0, stderrSha256: zeroHash(), gracefulTerminationAttempted: false, forcedTerminationAttempted: false };
  const stdoutHash = createHash("sha256"); const stderrHash = createHash("sha256");
  let child;
  try { child = spawn(executable, argv, { cwd: PRODUCT_ROOT, env: options.environment, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); }
  catch { throw Object.assign(new Error("OUTER_SPAWN_FAILURE"), { observation }); }
  observation.pid = child.pid ?? null;
  child.stdout?.on("data", (chunk) => { observation.stdoutBytes += chunk.length; stdoutHash.update(chunk); if (observation.stdoutBytes > options.streamCapBytes && !observation.overflowed) { observation.overflowed = true; void terminateTree(child, observation); } });
  child.stderr?.on("data", (chunk) => { observation.stderrBytes += chunk.length; stderrHash.update(chunk); if (observation.stderrBytes > options.streamCapBytes && !observation.overflowed) { observation.overflowed = true; void terminateTree(child, observation); } });
  const timer = setTimeout(() => { observation.timedOut = true; void terminateTree(child, observation); }, options.deadlineMs);
  const closed = await new Promise((resolve) => { child.once("close", (exitCode, signal) => resolve({ exitCode, signal })); child.once("error", (error) => resolve({ error })); });
  clearTimeout(timer);
  observation.stdoutSha256 = stdoutHash.digest("hex"); observation.stderrSha256 = stderrHash.digest("hex");
  if (closed.error) throw Object.assign(new Error("OUTER_SPAWN_FAILURE"), { observation });
  observation.exitCode = closed.exitCode; observation.signal = closed.signal;
  return { child, observation };
}

function duplicateTerminal(claimPath, claim, product, bundle, environmentFingerprint) {
  const claimAuthority = fileAuthority(claimPath, claimPath);
  return {
    schemaId: TERMINAL_SCHEMA, status: "BLOCKED", runKey: claim.runKey, attemptId: claim.attemptId, duplicateClaim: true,
    claimAuthority, startedAuthority: null, innerOutcomeAuthority: null, observationReceiptAuthority: null, cleanupReceiptAuthority: null,
    childObservation: { spawnAttempted: false, pid: null, exitCode: null, signal: null, timedOut: false, overflowed: false, stdoutBytes: 0, stdoutSha256: zeroHash(), stderrBytes: 0, stderrSha256: zeroHash(), gracefulTerminationAttempted: false, forcedTerminationAttempted: false },
    environmentFingerprint, childEnvironmentFingerprint: null, preProductAuthority: product, postProductAuthority: product, preAcceptanceBundleSha256: bundle.sha256, postAcceptanceBundleSha256: bundle.sha256,
    outerCleanup: { status: "PASS", listenerCount: 0, processResidualCount: 0, tempResidualCount: 0 }, primaryFailure: { stage: "CLAIM", reasonCode: "DUPLICATE_RUN_CLAIM" }, cleanupFailure: null,
  };
}

async function executeAttempt({ authorityRoot, faultMode = null, deadlineMs = DEADLINE_MS, streamCapBytes = STREAM_CAP_BYTES, terminalWriteFailure = false }) {
  const preProduct = productAuthority(); const preBundle = bundleAuthority(); const rootIdentity = authorityRootIdentity(authorityRoot); const tools = toolAuthorities();
  const runKey = computeRunKey(preProduct, preBundle, rootIdentity); const attemptId = randomBytes(16).toString("hex");
  const claimsRoot = path.join(authorityRoot, "claims"); const attemptsRoot = path.join(authorityRoot, "attempts"); mkdirSync(claimsRoot, { recursive: true }); mkdirSync(attemptsRoot, { recursive: true });
  const ownedRoot = path.join(attemptsRoot, attemptId); const envAuthority = environmentFor(ownedRoot);
  const claimPath = path.join(claimsRoot, `${runKey}.json`);
  const claim = { schemaId: CLAIM_SCHEMA, status: "CLAIMED", runKey, attemptId, productAuthority: preProduct, acceptanceBundleSha256: preBundle.sha256, authorityRootIdentity: rootIdentity, tools, cwd: PRODUCT_ROOT, environmentFingerprint: envAuthority.fingerprint, ownedRoot, deadlineMs };
  let claimBytes;
  try { claimBytes = writeExclusiveRecord(claimPath, claim); }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = parseStrictRecord(readFileSync(claimPath), (value) => exactOrdered(value, ["schemaId", "status", "runKey", "attemptId", "productAuthority", "acceptanceBundleSha256", "authorityRootIdentity", "tools", "cwd", "environmentFingerprint", "ownedRoot", "deadlineMs"], "CLAIM_INVALID"), "CLAIM_INVALID");
    return { terminal: duplicateTerminal(claimPath, existing, preProduct, preBundle, envAuthority.fingerprint), terminalPath: null, spawned: 0, duplicate: true, externalBlocked: false };
  }

  mkdirSync(ownedRoot, { recursive: false }); mkdirSync(envAuthority.childTemp, { recursive: false });
  const startedPath = path.join(ownedRoot, "attempt-start.json"); const observationPath = path.join(ownedRoot, "observation-receipt.json"); const cleanupPath = path.join(ownedRoot, "cleanup-receipt.json"); const innerPath = path.join(ownedRoot, "inner-outcome.json"); const terminalPath = path.join(ownedRoot, "launcher-terminal.json"); const workRoot = path.join(ownedRoot, "inner-work");
  const postgresReservation = await reservePort(); const webReservation = await reservePort(); const postgresPort = postgresReservation.address().port; const webPort = webReservation.address().port;
  let executable = POWERSHELL_PATH;
  let argv = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", RUNNER_PATH, "-AttemptId", attemptId, "-OwnedRoot", ownedRoot, "-WorkRoot", workRoot, "-ObservationReceiptPath", observationPath, "-CleanupReceiptPath", cleanupPath, "-InnerOutcomePath", innerPath, "-PostgresPort", String(postgresPort), "-WebPort", String(webPort), "-DeadlineMs", String(deadlineMs), "-NodePath", process.execPath, "-ExpectedBundleSha256", preBundle.sha256, "-ExpectedEnvironmentFingerprint", envAuthority.fingerprint];
  if (faultMode) {
    if (faultMode === "SPAWN_FAILURE") executable = path.join(ownedRoot, "missing-executable.exe");
    else { executable = process.execPath; argv = [LAUNCHER_PATH, "--fault-child", faultMode, attemptId, innerPath, envAuthority.fingerprint, ownedRoot]; }
  }
  const started = { schemaId: ATTEMPT_SCHEMA, status: "STARTED", runKey, attemptId, productAuthority: preProduct, acceptanceBundleSha256: preBundle.sha256, authorityRootIdentity: rootIdentity, claimAuthority: { path: claimPath, size: claimBytes.length, sha256: sha256(claimBytes) }, tools, argv, cwd: PRODUCT_ROOT, environment: envAuthority.ordered, environmentFingerprint: envAuthority.fingerprint, ownedRoot, observationReceiptPath: observationPath, cleanupReceiptPath: cleanupPath, innerOutcomePath: innerPath, postgresPort, webPort, deadlineMs };
  const startedBytes = atomicRecord(startedPath, started);
  await Promise.all([new Promise((resolve) => postgresReservation.close(resolve)), new Promise((resolve) => webReservation.close(resolve))]);

  let observation = { spawnAttempted: false, pid: null, exitCode: null, signal: null, timedOut: false, overflowed: false, stdoutBytes: 0, stdoutSha256: zeroHash(), stderrBytes: 0, stderrSha256: zeroHash(), gracefulTerminationAttempted: false, forcedTerminationAttempted: false };
  let inner = null; let primaryFailure = null; let cleanupFailure = null;
  try {
    const observed = await observeChild(executable, argv, { environment: envAuthority.values, deadlineMs, streamCapBytes }); observation = observed.observation;
    if (observation.overflowed) throw new Error("OUTER_STREAM_OVERFLOW");
    if (observation.timedOut) throw new Error("OUTER_TIMEOUT");
    if (observation.signal !== null) throw new Error("OUTER_SIGNAL");
    const candidates = readdirSync(ownedRoot).filter((name) => /^inner-outcome(?:-.+)?\.json$/u.test(name));
    if (candidates.length === 0) throw new Error(observation.exitCode === 2 ? "RUNNER_PREENTRY_NO_INNER" : "INNER_OUTCOME_ZERO");
    if (candidates.length !== 1 || candidates[0] !== "inner-outcome.json") throw new Error("INNER_OUTCOME_MULTIPLE");
    inner = parseStrictRecord(readFileSync(innerPath), parseInner, "INNER_OUTCOME_INVALID");
    if (inner.attemptId !== attemptId) throw new Error("INNER_OUTCOME_STALE");
    if ((inner.status === "PASS" && observation.exitCode !== 0) || (inner.status === "FAIL" && observation.exitCode !== 1) || (inner.status === "BLOCKED" && observation.exitCode !== 2)) throw new Error("INNER_EXIT_MISMATCH");
  } catch (error) {
    if (error?.observation) observation = error.observation;
    primaryFailure = { stage: "LAUNCHER_OBSERVATION", reasonCode: sanitizedReason(error) };
  }

  if (existsSync(envAuthority.childTemp)) {
    try { rmdirSync(envAuthority.childTemp); } catch { /* inventory records residual */ }
  }
  const postProduct = productAuthority(); const postBundle = bundleAuthority();
  const listenerCount = (await portIsFree(postgresPort) ? 0 : 1) + (await portIsFree(webPort) ? 0 : 1);
  const allowed = new Set(["attempt-start.json", "observation-receipt.json", "cleanup-receipt.json", "inner-outcome.json"]);
  const ownedInventory = inventory(ownedRoot); const unexpected = ownedInventory.filter((name) => !allowed.has(name));
  const processResidualCount = observation.spawnAttempted && observation.pid !== null && observation.exitCode === null ? 1 : 0;
  const outerCleanup = { status: listenerCount === 0 && processResidualCount === 0 && unexpected.length === 0 ? "PASS" : "FAIL", listenerCount, processResidualCount, tempResidualCount: unexpected.length };
  if (outerCleanup.status !== "PASS") cleanupFailure = { stage: "OUTER_CLEANUP", reasonCode: "OUTER_CLEANUP_RESIDUAL" };
  if (JSON.stringify(preProduct) !== JSON.stringify(postProduct) || preBundle.sha256 !== postBundle.sha256) primaryFailure = primaryFailure ?? { stage: "PRODUCT_AUTHORITY", reasonCode: "PRODUCT_OR_BUNDLE_DRIFT" };

  let observationReceipt = null; let cleanupReceipt = null;
  try { if (existsSync(observationPath)) observationReceipt = parseStrictRecord(readFileSync(observationPath), parseObservation, "OBSERVATION_RECEIPT_INVALID"); } catch (error) { primaryFailure = primaryFailure ?? { stage: "OBSERVATION_RECEIPT", reasonCode: sanitizedReason(error) }; }
  try { if (existsSync(cleanupPath)) cleanupReceipt = parseStrictRecord(readFileSync(cleanupPath), parseCleanup, "CLEANUP_RECEIPT_INVALID"); } catch (error) { cleanupFailure = cleanupFailure ?? { stage: "CLEANUP_RECEIPT", reasonCode: sanitizedReason(error) }; }
  if (inner?.status === "PASS") {
    if (!observationReceipt || !cleanupReceipt) primaryFailure = primaryFailure ?? { stage: "RECEIPT_BINDING", reasonCode: "PASS_RECEIPT_MISSING" };
    else if (inner.observationReceiptAuthority?.sha256 !== sha256(readFileSync(observationPath)) || inner.cleanupReceiptAuthority?.sha256 !== sha256(readFileSync(cleanupPath)) || inner.environmentFingerprint !== envAuthority.fingerprint || cleanupReceipt.environmentFingerprint !== envAuthority.fingerprint || inner.acceptanceBundleSha256 !== preBundle.sha256 || JSON.stringify(inner.counts) !== JSON.stringify(observationReceipt.counters)) primaryFailure = primaryFailure ?? { stage: "RECEIPT_BINDING", reasonCode: "PASS_RECEIPT_MISMATCH" };
  }

  let status = "BLOCKED";
  if (!primaryFailure && !cleanupFailure && inner?.status === "PASS" && observation.exitCode === 0) status = "PASS";
  else if (!primaryFailure && !cleanupFailure && inner?.status === "FAIL" && observation.exitCode === 1) status = "FAIL";
  else if (!primaryFailure && inner?.status === "BLOCKED") primaryFailure = inner.primaryFailure ?? { stage: "INNER", reasonCode: "INNER_BLOCKED" };
  if (inner?.status === "FAIL" && !primaryFailure) primaryFailure = inner.primaryFailure;
  if (inner?.cleanupFailure && !cleanupFailure) cleanupFailure = inner.cleanupFailure;
  if (status === "FAIL" && (!primaryFailure || cleanupFailure || outerCleanup.status !== "PASS")) status = "BLOCKED";
  if (status === "PASS" && (primaryFailure || cleanupFailure || outerCleanup.status !== "PASS")) status = "BLOCKED";
  if (status === "BLOCKED" && !primaryFailure && !cleanupFailure) primaryFailure = { stage: "TERMINAL_CLASSIFICATION", reasonCode: "TERMINAL_PROTOCOL_BLOCKED" };

  const terminal = {
    schemaId: TERMINAL_SCHEMA, status, runKey, attemptId, duplicateClaim: false,
    claimAuthority: { path: claimPath, size: claimBytes.length, sha256: sha256(claimBytes) }, startedAuthority: { path: startedPath, size: startedBytes.length, sha256: sha256(startedBytes) }, innerOutcomeAuthority: nullableAuthority(innerPath), observationReceiptAuthority: nullableAuthority(observationPath), cleanupReceiptAuthority: nullableAuthority(cleanupPath),
    childObservation: observation, environmentFingerprint: envAuthority.fingerprint, childEnvironmentFingerprint: inner?.environmentFingerprint ?? null,
    preProductAuthority: preProduct, postProductAuthority: postProduct, preAcceptanceBundleSha256: preBundle.sha256, postAcceptanceBundleSha256: postBundle.sha256,
    outerCleanup, primaryFailure, cleanupFailure,
  };
  if (terminalWriteFailure) writeExclusiveRecord(terminalPath, { injected: true });
  try { atomicRecord(terminalPath, terminal); return { terminal, terminalPath, spawned: observation.spawnAttempted ? 1 : 0, duplicate: false, externalBlocked: false }; }
  catch { return { terminal: null, terminalPath, spawned: observation.spawnAttempted ? 1 : 0, duplicate: false, externalBlocked: true, externalReason: "TERMINAL_WRITE_FAILURE" }; }
}

function faultFailureInner(attemptId, environmentFingerprint) {
  return { schemaId: INNER_SCHEMA, status: "FAIL", attemptId, environmentFingerprint, observationReceiptAuthority: null, cleanupReceiptAuthority: null, cleanup: { status: "PASS", listenerCount: 0, processResidualCount: 0, tempResidualCount: 0 }, primaryFailure: { stage: "FAULT_CHILD", reasonCode: "TYPED_FAULT_FAILURE" }, cleanupFailure: null };
}

async function faultChild(mode, attemptId, innerPath, environmentFingerprint, ownedRoot) {
  if (mode === "EXIT2_NO_INNER") { process.exitCode = 2; return; }
  if (mode === "MALFORMED_INNER") { writeFileSync(innerPath, "{malformed\n", "utf8"); process.exitCode = 2; return; }
  if (mode === "TORN_INNER") { writeFileSync(innerPath, '{"schemaId":"torn"', "utf8"); process.exitCode = 2; return; }
  if (mode === "MULTIPLE_INNER") { writeFileSync(innerPath, `${JSON.stringify(faultFailureInner(attemptId, environmentFingerprint))}\n`, "utf8"); writeFileSync(path.join(ownedRoot, "inner-outcome-extra.json"), "{}\n", "utf8"); process.exitCode = 1; return; }
  if (mode === "STALE_INNER") { writeFileSync(innerPath, `${JSON.stringify(faultFailureInner("f".repeat(32), environmentFingerprint))}\n`, "utf8"); process.exitCode = 1; return; }
  if (["TYPED_FAIL", "TERMINAL_WRITE_FAILURE", "CLEANUP_RESIDUAL"].includes(mode)) {
    writeFileSync(innerPath, `${JSON.stringify(faultFailureInner(attemptId, environmentFingerprint))}\n`, "utf8");
    if (mode === "CLEANUP_RESIDUAL") writeFileSync(path.join(ownedRoot, "unregistered-residual.tmp"), "residual", "utf8");
    process.exitCode = 1; return;
  }
  if (mode === "TIMEOUT") { await new Promise((resolve) => setTimeout(resolve, 60_000)); return; }
  if (mode === "OVERFLOW") { process.stdout.write("X".repeat(8_192)); await new Promise((resolve) => setTimeout(resolve, 60_000)); return; }
  throw new Error("FAULT_MODE_INVALID");
}

async function runFaultMatrix(authorityRoot) {
  const resolved = path.resolve(authorityRoot);
  if (resolved === path.parse(resolved).root || resolved === PRODUCT_ROOT || resolved === WORKSPACE_ROOT) throw new Error("FAULT_ROOT_INVALID");
  if (existsSync(resolved)) throw new Error("FAULT_ROOT_EXISTS");
  mkdirSync(resolved, { recursive: true });
  const results = [];
  const cases = [
    ["SPAWN_FAILURE", "BLOCKED"], ["EXIT2_NO_INNER", "BLOCKED"], ["MALFORMED_INNER", "BLOCKED"], ["TORN_INNER", "BLOCKED"], ["MULTIPLE_INNER", "BLOCKED"], ["STALE_INNER", "BLOCKED"], ["TYPED_FAIL", "FAIL"], ["TIMEOUT", "BLOCKED"], ["OVERFLOW", "BLOCKED"], ["TERMINAL_WRITE_FAILURE", "EXTERNAL_BLOCKED"], ["CLEANUP_RESIDUAL", "BLOCKED"],
  ];
  try {
    for (const [mode, expected] of cases) {
      const caseRoot = path.join(resolved, mode.toLowerCase());
      const outcome = await executeAttempt({ authorityRoot: caseRoot, faultMode: mode, deadlineMs: mode === "TIMEOUT" ? 750 : 10_000, streamCapBytes: mode === "OVERFLOW" ? 1_024 : 16_384, terminalWriteFailure: mode === "TERMINAL_WRITE_FAILURE" });
      const actual = outcome.externalBlocked ? "EXTERNAL_BLOCKED" : outcome.terminal?.status;
      if (actual !== expected || outcome.spawned !== 1) throw new Error(`FAULT_MATRIX_DISPOSITION_INVALID_${mode}_${expected}_${actual ?? "NONE"}_${outcome.spawned}_${outcome.terminal?.primaryFailure?.reasonCode ?? "NO_PRIMARY"}_${outcome.terminal?.cleanupFailure?.reasonCode ?? "NO_CLEANUP"}`);
      results.push({ mode, disposition: actual, canonicalTerminalCount: outcome.externalBlocked ? 0 : 1, externalBlocked: outcome.externalBlocked });
    }
    const duplicateRoot = path.join(resolved, "duplicate-concurrent-claim");
    const [first, second] = await Promise.all([
      executeAttempt({ authorityRoot: duplicateRoot, faultMode: "TYPED_FAIL", deadlineMs: 10_000, streamCapBytes: 16_384 }),
      executeAttempt({ authorityRoot: duplicateRoot, faultMode: "TYPED_FAIL", deadlineMs: 10_000, streamCapBytes: 16_384 }),
    ]);
    const duplicateSet = [first, second];
    if (duplicateSet.filter((item) => item.spawned === 1).length !== 1 || duplicateSet.filter((item) => item.duplicate && item.terminal?.status === "BLOCKED").length !== 1) throw new Error("FAULT_MATRIX_DUPLICATE_INVALID");
    results.push({ mode: "DUPLICATE_CONCURRENT_CLAIM", disposition: "BLOCKED", canonicalTerminalCount: 1, externalBlocked: false });
    return { schemaId: "old-mike-v2-beta2/product-acceptance-fault-matrix/4", status: "PASS", cases: results, caseCount: results.length, productHttp: 0, liveProvider: 0, database: 0, formalResearchWrite: 0, nonloopbackNetwork: 0 };
  } finally {
    if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
  }
}

async function canonicalMain() {
  if (process.cwd() !== PRODUCT_ROOT) throw new Error("LAUNCHER_CWD_INVALID");
  const result = await executeAttempt({ authorityRoot: DEFAULT_AUTHORITY_ROOT });
  const output = result.externalBlocked ? { schemaId: TERMINAL_SCHEMA, status: "BLOCKED", externalBlocked: true, reasonCode: result.externalReason } : result.terminal;
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = result.externalBlocked || result.terminal?.status === "BLOCKED" ? 2 : result.terminal?.status === "FAIL" ? 1 : 0;
}

const args = process.argv.slice(2);
try {
  if (args[0] === "--fault-child") await faultChild(args[1], args[2], args[3], args[4], args[5]);
  else if (args[0] === "--self-test-fault-matrix") {
    if (args.length !== 2) throw new Error("FAULT_MATRIX_ARGV_INVALID");
    const result = await runFaultMatrix(args[1]); process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (args.length === 0) await canonicalMain();
  else throw new Error("LAUNCHER_ARGV_INVALID");
} catch (error) {
  process.stderr.write(`${sanitizedReason(error)}\n`);
  process.exitCode = 2;
}
