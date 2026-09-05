import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = [
  ["embedded", "postgres"].join("-"),
  ["pg", "embedded"].join("-"),
  ["@embedded", "postgres"].join("-"),
  ["@pg-ts/pg", "embedded"].join("-")
];
const excludedDirectories = new Set(["node_modules", ".next", ".git"]);

async function collectFiles(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && (excludedDirectories.has(entry.name) || entry.name.startsWith(".release-"))) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(absolute, output);
    else output.push(absolute);
  }
  return output;
}

async function hashFile(filename) {
  return crypto.createHash("sha256").update(await readFile(filename)).digest("hex");
}

const files = await collectFiles(portalRoot);
let forbiddenHit = null;
for (const filename of files) {
  const content = await readFile(filename, "utf8").catch(() => "");
  const match = forbidden.find((term) => content.toLowerCase().includes(term.toLowerCase()));
  if (match) {
    forbiddenHit = `${path.relative(portalRoot, filename)}:${match}`;
    break;
  }
}

console.log(`FORBIDDEN_EMBEDDED_REFS=${forbiddenHit ? "FAIL" : "PASS"}`);
if (forbiddenHit) {
  console.log("PRODUCTION_INSTALL_GATE=FAIL");
  process.exit(2);
}

const sourceLock = path.join(portalRoot, "pnpm-lock.yaml");
const sourceLockHash = await hashFile(sourceLock);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "old-mike-v149-production-install-"));
assert.ok(!path.resolve(temporaryRoot).startsWith(path.resolve(portalRoot) + path.sep), "temporary install must be outside source tree");

try {
  for (const filename of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]) {
    const source = path.join(portalRoot, filename);
    if (await stat(source).then(() => true).catch(() => false)) {
      await copyFile(source, path.join(temporaryRoot, filename));
    }
  }

  const installEnv = { ...process.env, CI: "true" };
  const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const install = spawnSync(pnpmCommand, ["install", "--frozen-lockfile"], {
    cwd: temporaryRoot,
    env: installEnv,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 180000
  });
  const output = `${install.stdout || ""}\n${install.stderr || ""}`;
  const ignoredBuilds = output.includes("ERR_PNPM_IGNORED_BUILDS");
  const installedLockHash = await hashFile(path.join(temporaryRoot, "pnpm-lock.yaml")).catch(() => "");
  const cleanInstall = install.status === 0 && !install.error;
  const lockUnchanged = installedLockHash === sourceLockHash;

  console.log(`CI_MODE=${installEnv.CI === "true" ? "PASS" : "FAIL"}`);
  console.log(`CLEAN_INSTALL=${cleanInstall ? "PASS" : "FAIL"}`);
  console.log(`IGNORED_BUILDS=${ignoredBuilds ? "FAIL" : "PASS"}`);
  console.log(`LOCKFILE_UNCHANGED=${lockUnchanged ? "PASS" : "FAIL"}`);

  const passed = cleanInstall && !ignoredBuilds && lockUnchanged;
  console.log(`PRODUCTION_INSTALL_GATE=${passed ? "PASS" : "FAIL"}`);
  process.exit(passed ? 0 : 2);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
