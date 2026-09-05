import { access, lstat, readFile, realpath, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

export const SCHEDULER_RUNTIME_ERRORS = Object.freeze({
  MISSING: "RUNTIME_DEPENDENCY_SCHEDULER_MISSING",
  ENTRY_MISSING: "RUNTIME_DEPENDENCY_SCHEDULER_ENTRY_MISSING",
  EXTERNAL_SYMLINK: "RUNTIME_DEPENDENCY_EXTERNAL_SYMLINK",
  PARENT_FALLBACK: "RUNTIME_DEPENDENCY_PARENT_FALLBACK",
  VERSION_MISMATCH: "RUNTIME_DEPENDENCY_VERSION_MISMATCH",
});

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function lockedSchedulerVersion(lockfile) {
  const importer = lockfile.match(
    /(?:^|\n)\s{6}scheduler:\s*\r?\n\s{8}specifier:\s*([^\r\n]+)\r?\n\s{8}version:\s*([^\r\n]+)/,
  );
  if (!importer) return null;
  const specifier = importer[1].trim().replace(/^['"]|['"]$/g, "");
  const version = importer[2].trim().replace(/^['"]|['"]$/g, "");
  return { specifier, version };
}

async function containsSymlink(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) return true;
    if (info.isDirectory() && await containsSymlink(absolute)) return true;
  }
  return false;
}

function failure(errorCategory, checks) {
  return { pass: false, errorCategory, checks };
}

export async function verifySchedulerRuntimeClosure({
  runtimeRoot,
  sourcePackagePath,
  lockfilePath,
}) {
  const absoluteRuntime = path.resolve(runtimeRoot);
  const schedulerDirectory = path.join(absoluteRuntime, "node_modules", "scheduler");
  const checks = {
    SCHEDULER_DIRECT_OR_LOCKED_DEPENDENCY: false,
    SCHEDULER_RUNTIME_PACKAGE_DECLARATION: false,
    SCHEDULER_PACKAGE_COMPLETE: false,
    SCHEDULER_REALPATH_INSIDE_RUNTIME: false,
    SCHEDULER_PARENT_FALLBACK_BLOCKED: false,
    SCHEDULER_VERSION_MATCH: false,
    SCHEDULER_CONSUMER_VERSION_MATCH: false,
  };

  const sourcePackage = await readJson(sourcePackagePath);
  const directVersion = sourcePackage.dependencies?.scheduler;
  if (typeof directVersion !== "string" || sourcePackage.devDependencies?.scheduler) {
    return failure(SCHEDULER_RUNTIME_ERRORS.MISSING, checks);
  }

  const lock = lockedSchedulerVersion(await readFile(lockfilePath, "utf8"));
  if (!lock || lock.specifier !== directVersion || lock.version !== directVersion) {
    return failure(SCHEDULER_RUNTIME_ERRORS.VERSION_MISMATCH, checks);
  }
  checks.SCHEDULER_DIRECT_OR_LOCKED_DEPENDENCY = true;

  const runtimePackage = await readJson(path.join(absoluteRuntime, "package.json")).catch(() => null);
  if (runtimePackage?.dependencies?.scheduler !== directVersion) {
    return failure(SCHEDULER_RUNTIME_ERRORS.VERSION_MISMATCH, checks);
  }
  checks.SCHEDULER_RUNTIME_PACKAGE_DECLARATION = true;

  const schedulerInfo = await lstat(schedulerDirectory).catch(() => null);
  if (schedulerInfo?.isSymbolicLink()) {
    return failure(SCHEDULER_RUNTIME_ERRORS.EXTERNAL_SYMLINK, checks);
  }

  const runtimeRequire = createRequire(path.join(absoluteRuntime, "package.json"));
  if (!schedulerInfo) {
    try {
      const fallback = runtimeRequire.resolve("scheduler");
      if (!inside(schedulerDirectory, fallback)) {
        return failure(SCHEDULER_RUNTIME_ERRORS.PARENT_FALLBACK, checks);
      }
    } catch {}
    return failure(SCHEDULER_RUNTIME_ERRORS.MISSING, checks);
  }
  if (!schedulerInfo.isDirectory()) {
    return failure(SCHEDULER_RUNTIME_ERRORS.EXTERNAL_SYMLINK, checks);
  }

  const schedulerManifestPath = path.join(schedulerDirectory, "package.json");
  const schedulerEntryPath = path.join(schedulerDirectory, "index.js");
  if (!await exists(schedulerManifestPath) || !await exists(schedulerEntryPath)) {
    return failure(SCHEDULER_RUNTIME_ERRORS.ENTRY_MISSING, checks);
  }

  let resolvedEntry;
  try {
    resolvedEntry = runtimeRequire.resolve("scheduler");
  } catch {
    return failure(SCHEDULER_RUNTIME_ERRORS.ENTRY_MISSING, checks);
  }

  if (!inside(schedulerDirectory, resolvedEntry)) {
    return failure(SCHEDULER_RUNTIME_ERRORS.PARENT_FALLBACK, checks);
  }
  checks.SCHEDULER_PARENT_FALLBACK_BLOCKED = true;

  const resolvedDirectory = await realpath(schedulerDirectory).catch(() => null);
  if (!resolvedDirectory || !inside(absoluteRuntime, resolvedDirectory)) {
    return failure(SCHEDULER_RUNTIME_ERRORS.EXTERNAL_SYMLINK, checks);
  }
  if (await containsSymlink(schedulerDirectory)) {
    return failure(SCHEDULER_RUNTIME_ERRORS.EXTERNAL_SYMLINK, checks);
  }
  checks.SCHEDULER_REALPATH_INSIDE_RUNTIME = true;

  const schedulerManifest = await readJson(schedulerManifestPath).catch(() => null);
  const entryInfo = await lstat(schedulerEntryPath).catch(() => null);
  if (
    schedulerManifest?.name !== "scheduler" ||
    !entryInfo?.isFile() ||
    entryInfo.isSymbolicLink()
  ) {
    return failure(SCHEDULER_RUNTIME_ERRORS.ENTRY_MISSING, checks);
  }
  checks.SCHEDULER_PACKAGE_COMPLETE = true;

  if (schedulerManifest.version !== directVersion || schedulerManifest.version !== lock.version) {
    return failure(SCHEDULER_RUNTIME_ERRORS.VERSION_MISMATCH, checks);
  }
  checks.SCHEDULER_VERSION_MATCH = true;

  const reactDomManifest = await readJson(
    path.join(absoluteRuntime, "node_modules", "react-dom", "package.json"),
  ).catch(() => null);
  const expectedConsumerRange = `^${directVersion}`;
  if (reactDomManifest?.dependencies?.scheduler !== expectedConsumerRange) {
    return failure(SCHEDULER_RUNTIME_ERRORS.VERSION_MISMATCH, checks);
  }
  checks.SCHEDULER_CONSUMER_VERSION_MATCH = true;

  return { pass: true, errorCategory: "NONE", checks };
}

export function verifySchedulerZipEntries(entries) {
  const expected = "node_modules/scheduler/index.js";
  if (!Array.isArray(entries) || entries.some((entry) => entry.includes("\\"))) {
    return { pass: false, errorCategory: SCHEDULER_RUNTIME_ERRORS.ENTRY_MISSING };
  }
  return entries.includes(expected)
    ? { pass: true, errorCategory: "NONE" }
    : { pass: false, errorCategory: SCHEDULER_RUNTIME_ERRORS.ENTRY_MISSING };
}
