import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCHEDULER_RUNTIME_ERRORS,
  verifySchedulerRuntimeClosure,
  verifySchedulerZipEntries,
} from "./scheduler-runtime-contract.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(portalRoot, ".next", "standalone");

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createFixture(root, options = {}) {
  const runtime = path.join(root, "standalone");
  const sourcePackagePath = path.join(root, "source-package.json");
  const lockfilePath = path.join(root, "pnpm-lock.yaml");
  await writeJson(path.join(runtime, "package.json"), {
    name: "fixture-runtime",
  version: "1.5.27",
    dependencies: { scheduler: "0.27.0" },
  });
  await writeJson(sourcePackagePath, {
    dependencies: {
      "react-dom": "19.2.8",
      ...(options.devOnly ? {} : { scheduler: "0.27.0" }),
    },
    devDependencies: options.devOnly ? { scheduler: "0.27.0" } : {},
  });
  await writeFile(lockfilePath, [
    "lockfileVersion: '9.0'",
    "importers:",
    "  .:",
    "    dependencies:",
    "      scheduler:",
    "        specifier: 0.27.0",
    `        version: ${options.lockVersion ?? "0.27.0"}`,
    "",
  ].join("\n"), "utf8");
  await writeJson(path.join(runtime, "node_modules", "react-dom", "package.json"), {
    name: "react-dom",
    version: "19.2.8",
    dependencies: { scheduler: "^0.27.0" },
  });
  for (const dependency of ["next", "react", "pg"]) {
    await writeJson(path.join(runtime, "node_modules", dependency, "package.json"), {
      name: dependency,
      version: "1.0.0",
      main: "index.js",
    });
    await writeFile(path.join(runtime, "node_modules", dependency, "index.js"), "module.exports = {};\n", "utf8");
  }
  if (!options.schedulerMissing) {
    await writeJson(path.join(runtime, "node_modules", "scheduler", "package.json"), {
      name: "scheduler",
      version: options.runtimeVersion ?? "0.27.0",
      main: "index.js",
    });
    if (!options.entryMissing) {
      await writeFile(path.join(runtime, "node_modules", "scheduler", "index.js"), "module.exports = {};\n", "utf8");
    }
  }
  await writeFile(path.join(runtime, "compiled-research-route.cjs"), "require('scheduler'); module.exports = true;\n", "utf8");
  return { runtimeRoot: runtime, sourcePackagePath, lockfilePath };
}

async function expectedFailure(options, expectedCategory) {
  const root = await mkdtemp(path.join(tmpdir(), "oldmike-scheduler-fixture-"));
  try {
    const fixture = await createFixture(root, options);
    const result = await verifySchedulerRuntimeClosure(fixture);
    assert.equal(result.pass, false);
    assert.equal(result.errorCategory, expectedCategory);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const positiveRoot = await mkdtemp(path.join(tmpdir(), "oldmike-scheduler-positive-"));
try {
  const positive = await createFixture(positiveRoot);
  const result = await verifySchedulerRuntimeClosure(positive);
  assert.equal(result.pass, true);
  assert.equal(result.errorCategory, "NONE");
  assert.ok(Object.values(result.checks).every(Boolean));
  const consumer = spawnSync(process.execPath, [path.join(positive.runtimeRoot, "compiled-research-route.cjs")], {
    cwd: positive.runtimeRoot,
    env: { ...process.env, NODE_PATH: "" },
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(consumer.status, 0);
} finally {
  await rm(positiveRoot, { recursive: true, force: true });
}

await expectedFailure({ schedulerMissing: true }, SCHEDULER_RUNTIME_ERRORS.MISSING);
await expectedFailure({ entryMissing: true }, SCHEDULER_RUNTIME_ERRORS.ENTRY_MISSING);
await expectedFailure({ devOnly: true }, SCHEDULER_RUNTIME_ERRORS.MISSING);
await expectedFailure({ lockVersion: "0.27.1" }, SCHEDULER_RUNTIME_ERRORS.VERSION_MISMATCH);
await expectedFailure({ runtimeVersion: "0.28.0" }, SCHEDULER_RUNTIME_ERRORS.VERSION_MISMATCH);

const missingConsumerRoot = await mkdtemp(path.join(tmpdir(), "oldmike-scheduler-consumer-missing-"));
try {
  const fixture = await createFixture(missingConsumerRoot, { schedulerMissing: true });
  const consumer = spawnSync(process.execPath, [path.join(fixture.runtimeRoot, "compiled-research-route.cjs")], {
    cwd: fixture.runtimeRoot,
    env: { ...process.env, NODE_PATH: "" },
    encoding: "utf8",
    windowsHide: true,
  });
  assert.notEqual(consumer.status, 0);
  assert.match(consumer.stderr, /scheduler/);
  const result = await verifySchedulerRuntimeClosure(fixture);
  assert.equal(result.errorCategory, SCHEDULER_RUNTIME_ERRORS.MISSING);
} finally {
  await rm(missingConsumerRoot, { recursive: true, force: true });
}

const symlinkRoot = await mkdtemp(path.join(tmpdir(), "oldmike-scheduler-symlink-"));
try {
  const fixture = await createFixture(symlinkRoot, { schedulerMissing: true });
  const external = path.join(symlinkRoot, "external-scheduler");
  await writeJson(path.join(external, "package.json"), { name: "scheduler", version: "0.27.0", main: "index.js" });
  await writeFile(path.join(external, "index.js"), "module.exports = {};\n", "utf8");
  await symlink(external, path.join(fixture.runtimeRoot, "node_modules", "scheduler"), "junction");
  assert.equal((await lstat(path.join(fixture.runtimeRoot, "node_modules", "scheduler"))).isSymbolicLink(), true);
  const result = await verifySchedulerRuntimeClosure(fixture);
  assert.equal(result.pass, false);
  assert.equal(result.errorCategory, SCHEDULER_RUNTIME_ERRORS.EXTERNAL_SYMLINK);
} finally {
  await rm(symlinkRoot, { recursive: true, force: true });
}

const danglingRoot = await mkdtemp(path.join(tmpdir(), "oldmike-scheduler-dangling-"));
try {
  const fixture = await createFixture(danglingRoot, { schedulerMissing: true });
  await symlink(
    path.join(danglingRoot, "missing-pnpm-store-target"),
    path.join(fixture.runtimeRoot, "node_modules", "scheduler"),
    "junction",
  );
  const result = await verifySchedulerRuntimeClosure(fixture);
  assert.equal(result.pass, false);
  assert.equal(result.errorCategory, SCHEDULER_RUNTIME_ERRORS.EXTERNAL_SYMLINK);
} finally {
  await rm(danglingRoot, { recursive: true, force: true });
}

const parentRoot = await mkdtemp(path.join(tmpdir(), "oldmike-scheduler-parent-"));
try {
  const fixture = await createFixture(path.join(parentRoot, "application"), { schedulerMissing: true });
  await writeJson(path.join(parentRoot, "node_modules", "scheduler", "package.json"), {
    name: "scheduler",
    version: "0.27.0",
    main: "index.js",
  });
  await writeFile(path.join(parentRoot, "node_modules", "scheduler", "index.js"), "module.exports = {};\n", "utf8");
  const result = await verifySchedulerRuntimeClosure(fixture);
  assert.equal(result.pass, false);
  assert.equal(result.errorCategory, SCHEDULER_RUNTIME_ERRORS.PARENT_FALLBACK);
} finally {
  await rm(parentRoot, { recursive: true, force: true });
}

assert.deepEqual(
  verifySchedulerZipEntries(["node_modules/scheduler/index.js"]),
  { pass: true, errorCategory: "NONE" },
);
assert.equal(
  verifySchedulerZipEntries(["node_modules\\scheduler\\index.js"]).errorCategory,
  SCHEDULER_RUNTIME_ERRORS.ENTRY_MISSING,
);

if (!process.argv.includes("--fixtures-only")) {
  const actual = await verifySchedulerRuntimeClosure({
    runtimeRoot,
    sourcePackagePath: path.join(portalRoot, "package.json"),
    lockfilePath: path.join(portalRoot, "pnpm-lock.yaml"),
  });
  assert.equal(actual.pass, true, actual.errorCategory);
  assert.ok(Object.values(actual.checks).every(Boolean));

  const isolatedParent = await mkdtemp(path.join(tmpdir(), "oldmike-scheduler-isolated-"));
  try {
    const isolatedRuntime = path.join(isolatedParent, "standalone");
    await cp(runtimeRoot, isolatedRuntime, { recursive: true, force: true, verbatimSymlinks: false });
    assert.equal(await lstat(path.join(isolatedParent, "node_modules")).then(() => true).catch(() => false), false);
    const isolated = await verifySchedulerRuntimeClosure({
      runtimeRoot: isolatedRuntime,
      sourcePackagePath: path.join(portalRoot, "package.json"),
      lockfilePath: path.join(portalRoot, "pnpm-lock.yaml"),
    });
    assert.equal(isolated.pass, true, isolated.errorCategory);
    const researchBundle = path.join(isolatedRuntime, ".next", "server", "app", "api", "projects", "[projectId]", "research", "route.js");
    const consumer = spawnSync(process.execPath, ["-e", "require(process.argv[1])", researchBundle], {
      cwd: isolatedRuntime,
      env: { ...process.env, NODE_PATH: "" },
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    });
    assert.equal(consumer.status, 0, consumer.stderr || "compiled Research route failed to load");
  } finally {
    await rm(isolatedParent, { recursive: true, force: true });
  }

  for (const [name, pass] of Object.entries(actual.checks)) {
    console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
  }
  console.log("SCHEDULER_RESOLUTION=PASS");
  console.log("RESEARCH_WORKFLOW_SCHEDULER_CONSUMER=PASS");
}
console.log("SCHEDULER_NEGATIVE_FIXTURES=PASS");
console.log("SCHEDULER_RUNTIME_CONTRACT=PASS");
