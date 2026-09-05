import { chmod, copyFile, cp, lstat, mkdir, readFile, readlink, readdir, realpath, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { verifySchedulerRuntimeClosure } from "./scheduler-runtime-contract.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(portalRoot, ".next", "standalone");
const operatorArtifacts = [
  "create-registration-invite.mjs",
  "verify-registration-invite-artifact.mjs",
  "revoke-registration-invite.mjs",
  "verify-operator-preflight.mjs",
  "verify-controlled-invite-runner.mjs",
  "run-controlled-invite.sh",
  "run-controlled-auth-e2e.mjs",
  "bootstrap-portal-administrator.mjs",
  "run-admin-bootstrap.mjs",
  "recover-admin-bootstrap-handoff.mjs",
  "schema-evidence-safe-stage-contract.mjs",
  "verify-online-schema-state.mjs",
];
const sourceCli = path.join(portalRoot, "scripts", operatorArtifacts[0]);
const runtimeCli = path.join(runtimeRoot, "operator", operatorArtifacts[0]);
const operatorManifestPath = path.join(portalRoot, "scripts", "operator", "operator-runtime-manifest.json");

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function resolvePackageDirectory(packageName, fromDirectory) {
  const requireFrom = createRequire(path.join(fromDirectory, "package.json"));
  let entry;
  try {
    entry = requireFrom.resolve(`${packageName}/package.json`);
  } catch {
    entry = requireFrom.resolve(packageName);
  }
  let directory = path.dirname(entry);
  while (directory !== path.dirname(directory)) {
    try {
      const manifest = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
      if (manifest.name === packageName) return realpath(directory);
    } catch {
      // Continue walking toward the package root.
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Unable to locate package directory for ${packageName}`);
}

const copiedPackages = new Set();
async function copyDependencyClosure(packageName, fromDirectory) {
  if (copiedPackages.has(packageName)) return;
  const sourceDirectory = await resolvePackageDirectory(packageName, fromDirectory);
  const targetDirectory = path.join(runtimeRoot, "node_modules", packageName);
  const manifest = JSON.parse(await readFile(path.join(sourceDirectory, "package.json"), "utf8"));
  copiedPackages.add(packageName);
  await rm(targetDirectory, { recursive: true, force: true });
  await mkdir(path.dirname(targetDirectory), { recursive: true });
  await cp(sourceDirectory, targetDirectory, { recursive: true, force: true, verbatimSymlinks: false });

  for (const [dependencyName, dependencyVersion] of Object.entries({
    ...(manifest.dependencies ?? {}),
    ...(manifest.optionalDependencies ?? {}),
  })) {
    try {
      await copyDependencyClosure(dependencyName, sourceDirectory);
    } catch (error) {
      if (manifest.optionalDependencies && dependencyName in manifest.optionalDependencies) continue;
      throw new Error(`Unable to package ${packageName} dependency ${dependencyName}@${dependencyVersion}: ${error.message}`);
    }
  }
}

async function materializeSymlinks(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      const linkTarget = await readlink(absolute);
      const target = path.resolve(path.dirname(absolute), linkTarget);
      const targetStat = await lstat(target);
      await rm(absolute, { recursive: true, force: true });
      if (targetStat.isDirectory()) await cp(target, absolute, { recursive: true, force: true });
      else await copyFile(target, absolute);
      await materializeSymlinks(absolute);
    } else if (entry.isDirectory()) {
      await materializeSymlinks(absolute);
    }
  }
}

const operatorManifest = JSON.parse(await readFile(operatorManifestPath, "utf8"));
if (operatorManifest.contractVersion !== "old-mike.operator-runtime-manifest.v3") {
  throw new Error("Invalid operator runtime manifest contract");
}
for (const [relative, expectedHash] of Object.entries(operatorManifest.files ?? {})) {
  const actualHash = await sha256(path.join(portalRoot, "scripts", ...relative.split("/")));
  if (actualHash !== expectedHash) throw new Error(`Source operator allowlist mismatch: ${relative}`);
}

await mkdir(runtimeRoot, { recursive: true });
await mkdir(path.join(runtimeRoot, "public"), { recursive: true });
await cp(path.join(portalRoot, "public"), path.join(runtimeRoot, "public"), { recursive: true, force: true }).catch(async (error) => {
  if (error.code !== "ENOENT") throw error;
});
await mkdir(path.join(runtimeRoot, ".next"), { recursive: true });
await cp(path.join(portalRoot, ".next", "static"), path.join(runtimeRoot, ".next", "static"), { recursive: true, force: true });
await materializeSymlinks(runtimeRoot);

// Next's file tracing can retain only the package subpaths it observed. The
// standalone server itself requires the complete @swc/helpers export map, so
// copy the locked package into the self-contained runtime artifact at build
// time. This is never downloaded or copied by an operator at runtime.
const swcHelperPackages = (await readdir(path.join(portalRoot, "node_modules", ".pnpm")))
  .filter((name) => name.startsWith("@swc+helpers@"));
if (swcHelperPackages.length !== 1) {
  throw new Error(`Expected exactly one locked @swc/helpers package, found ${swcHelperPackages.length}`);
}
const sourceSwcHelpers = path.join(
  portalRoot,
  "node_modules",
  ".pnpm",
  swcHelperPackages[0],
  "node_modules",
  "@swc",
  "helpers",
);
const runtimeSwcHelpers = path.join(runtimeRoot, "node_modules", "@swc", "helpers");
await rm(runtimeSwcHelpers, { recursive: true, force: true });
await cp(sourceSwcHelpers, runtimeSwcHelpers, { recursive: true, force: true, verbatimSymlinks: false });

const nextEnvPackages = (await readdir(path.join(portalRoot, "node_modules", ".pnpm")))
  .filter((name) => name.startsWith("@next+env@"));
if (nextEnvPackages.length !== 1) {
  throw new Error(`Expected exactly one locked @next/env package, found ${nextEnvPackages.length}`);
}
const sourceNextEnv = path.join(
  portalRoot,
  "node_modules",
  ".pnpm",
  nextEnvPackages[0],
  "node_modules",
  "@next",
  "env",
);
const runtimeNextEnv = path.join(runtimeRoot, "node_modules", "@next", "env");
await rm(runtimeNextEnv, { recursive: true, force: true });
await mkdir(path.dirname(runtimeNextEnv), { recursive: true });
await cp(sourceNextEnv, runtimeNextEnv, { recursive: true, force: true, verbatimSymlinks: false });

// Package runtime dependency closures explicitly so neither the Next server
// nor the operator CLI can fall through to the source tree's pnpm links.
// Scheduler is a direct, locked production provider because compiled React DOM
// is its consumer. Do not rely on pnpm's transitive layout or parent fallback.
await copyDependencyClosure("pg", portalRoot);
await copyDependencyClosure("react", portalRoot);
await copyDependencyClosure("scheduler", portalRoot);
await copyDependencyClosure("react-dom", portalRoot);

const schedulerClosure = await verifySchedulerRuntimeClosure({
  runtimeRoot,
  sourcePackagePath: path.join(portalRoot, "package.json"),
  lockfilePath: path.join(portalRoot, "pnpm-lock.yaml"),
});
if (!schedulerClosure.pass) {
  throw new Error(schedulerClosure.errorCategory);
}

await rm(path.join(runtimeRoot, "operator"), { recursive: true, force: true });
await mkdir(path.dirname(runtimeCli), { recursive: true });
for (const name of operatorArtifacts) {
  await copyFile(path.join(portalRoot, "scripts", name), path.join(runtimeRoot, "operator", name));
}
await cp(
  path.join(portalRoot, "scripts", "operator"),
  path.join(runtimeRoot, "operator", "operator"),
  { recursive: true, force: true, verbatimSymlinks: false },
);

const runtimeRunner = path.join(runtimeRoot, "operator", "run-controlled-invite.sh");
await chmod(runtimeRunner, 0o700);
const runtimeAuthE2EBridge = path.join(runtimeRoot, "operator", "run-controlled-auth-e2e.mjs");
await chmod(runtimeAuthE2EBridge, 0o600);
const runtimeAdministratorBootstrap = path.join(runtimeRoot, "operator", "bootstrap-portal-administrator.mjs");
await chmod(runtimeAdministratorBootstrap, 0o700);
const runtimeAdministratorBootstrapProvider = path.join(runtimeRoot, "operator", "operator", "admin-bootstrap-transaction-provider.mjs");
await chmod(runtimeAdministratorBootstrapProvider, 0o600);
const runtimeAdministratorBootstrapBridge = path.join(runtimeRoot, "operator", "run-admin-bootstrap.mjs");
await chmod(runtimeAdministratorBootstrapBridge, 0o700);
const runtimeAdministratorBootstrapRecovery = path.join(runtimeRoot, "operator", "recover-admin-bootstrap-handoff.mjs");
await chmod(runtimeAdministratorBootstrapRecovery, 0o700);
const runtimeAdministratorBootstrapBridgeProvider = path.join(runtimeRoot, "operator", "operator", "admin-bootstrap-bridge-provider.mjs");
await chmod(runtimeAdministratorBootstrapBridgeProvider, 0o600);
const runtimeSchemaEvidenceOperator = path.join(runtimeRoot, "operator", "verify-online-schema-state.mjs");
await chmod(runtimeSchemaEvidenceOperator, 0o600);
const runtimeSchemaEvidenceSafeStageContract = path.join(runtimeRoot, "operator", "schema-evidence-safe-stage-contract.mjs");
await chmod(runtimeSchemaEvidenceSafeStageContract, 0o600);

const runtimeHash = await sha256(runtimeCli);
if (runtimeHash !== operatorManifest.files[operatorArtifacts[0]]) {
  throw new Error(`Runtime registration CLI hash mismatch: ${runtimeHash}`);
}
for (const [relative, expectedHash] of Object.entries(operatorManifest.files)) {
  const runtimeArtifact = path.join(runtimeRoot, "operator", ...relative.split("/"));
  const runtimeArtifactHash = await sha256(runtimeArtifact);
  if (runtimeArtifactHash !== expectedHash) throw new Error(`Runtime operator artifact hash mismatch: ${relative}`);
  const expectedSize = operatorManifest.sizes?.[relative];
  if (!Number.isSafeInteger(expectedSize) || (await stat(runtimeArtifact)).size !== expectedSize) {
    throw new Error(`Runtime operator artifact size mismatch: ${relative}`);
  }
  const expectedMode = operatorManifest.modes?.[relative];
  if (process.platform !== "win32" && expectedMode && ((await stat(runtimeArtifact)).mode & 0o777).toString(8) !== expectedMode) {
    throw new Error(`Runtime operator artifact mode mismatch: ${relative}`);
  }
}

console.log(`runtime artifact prepared: ${path.relative(portalRoot, runtimeRoot).replaceAll(path.sep, "/")}`);
console.log(`operator CLI SHA-256: ${runtimeHash}`);
console.log(`operator runtime files: ${Object.keys(operatorManifest.files).length}`);
