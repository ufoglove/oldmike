import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, lstat, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_RELEASE_IDENTITY, parseOperatorOutput } from "./schema-evidence-bridge-contract.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.resolve(process.env.RUNTIME_ARTIFACT_DIR || path.join(portalRoot, ".next", "standalone"));
const relativeOperator = "verify-online-schema-state.mjs";
const relativeSafeStageContract = "schema-evidence-safe-stage-contract.mjs";
const sourceOperator = path.join(portalRoot, "scripts", relativeOperator);
const runtimeOperator = path.join(runtimeRoot, "operator", relativeOperator);
const sourceSafeStageContract = path.join(portalRoot, "scripts", relativeSafeStageContract);
const runtimeSafeStageContract = path.join(runtimeRoot, "operator", relativeSafeStageContract);
const sourceManifest = JSON.parse(await readFile(path.join(portalRoot, "scripts", "operator", "operator-runtime-manifest.json"), "utf8"));

async function sha256(filename) {
  return createHash("sha256").update(await readFile(filename)).digest("hex");
}
async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}
function isolatedEnvironment() {
  return Object.fromEntries(Object.entries({
    NODE_ENV: "production", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec, WINDIR: process.env.WINDIR, TEMP: process.env.TEMP,
    TMP: process.env.TMP, TMPDIR: process.env.TMPDIR,
  }).filter(([, value]) => typeof value === "string" && value.length > 0));
}

const runtimeInfo = await lstat(runtimeOperator);
const safeStageRuntimeInfo = await lstat(runtimeSafeStageContract);
const sourceHash = await sha256(sourceOperator);
const runtimeHash = await sha256(runtimeOperator);
const safeStageSourceHash = await sha256(sourceSafeStageContract);
const safeStageRuntimeHash = await sha256(runtimeSafeStageContract);
const syntax = spawnSync(process.execPath, ["--check", runtimeOperator], { encoding: "utf8", windowsHide: true, timeout: 15_000 });
const safeStageSyntax = spawnSync(process.execPath, ["--check", runtimeSafeStageContract], { encoding: "utf8", windowsHide: true, timeout: 15_000 });
const requireFromOperator = createRequire(runtimeOperator);
const pgResolved = (() => {
  try {
    const resolved = requireFromOperator.resolve("pg");
    const relative = path.relative(runtimeRoot, resolved);
    return relative !== "" && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  } catch { return false; }
})();

const exposedFiles = [
  ...await collect(path.join(runtimeRoot, "public")),
  ...await collect(path.join(runtimeRoot, ".next", "static")),
];
let clientExcluded = true;
for (const filename of exposedFiles) {
  const data = await readFile(filename);
  if (data.includes(Buffer.from("old-mike.schema-evidence-operator.v4")) ||
      data.includes(Buffer.from(relativeOperator)) ||
      data.includes(Buffer.from(relativeSafeStageContract))) clientExcluded = false;
}
const serverSource = await readFile(path.join(runtimeRoot, "server.js"), "utf8");
const notAutoExecuted = !serverSource.includes(relativeOperator) && !serverSource.includes("old-mike.schema-evidence-operator.v4");

const temporaryParent = await mkdtemp(path.join(tmpdir(), "oldmike-v1527-schema-operator-"));
let isolatedExecution = false;
let isolatedOutputRedacted = false;
try {
  const isolatedRoot = path.join(temporaryParent, "standalone");
  await cp(runtimeRoot, isolatedRoot, { recursive: true, force: true, verbatimSymlinks: false });
  const isolatedOperator = path.join(isolatedRoot, "operator", relativeOperator);
  const execution = spawnSync(process.execPath, [isolatedOperator], {
    cwd: isolatedRoot, env: isolatedEnvironment(), encoding: "utf8", windowsHide: true, timeout: 15_000,
  });
  const evidence = parseOperatorOutput(execution.stdout);
  isolatedExecution = execution.status === 3 && evidence.classification === "DATABASE_UNAVAILABLE" &&
    evidence.releaseIdentity === EXPECTED_RELEASE_IDENTITY && evidence.operatorIdentity === "PASS" &&
    evidence.operatorSourceSha256 === sourceHash && execution.stderr === "";
  isolatedOutputRedacted = !/(?:postgres(?:ql)?:\/\/|password|secret|token|@[^\s]+|DATABASE_URL(?:%3D|=)|"DATABASE_URL"\s*:)/i.test(execution.stdout + execution.stderr);
} finally {
  await rm(temporaryParent, { recursive: true, force: true });
}

const checks = {
  OPERATOR_SERVER_ONLY_PATH: path.resolve(runtimeOperator) === path.join(runtimeRoot, "operator", relativeOperator),
  OPERATOR_REGULAR_FILE: runtimeInfo.isFile(),
  OPERATOR_NOT_SYMLINK: !runtimeInfo.isSymbolicLink(),
  OPERATOR_REALPATH: await realpath(runtimeOperator) === path.resolve(runtimeOperator),
  OPERATOR_MODE: process.platform === "win32" || (runtimeInfo.mode & 0o777) === 0o600,
  OPERATOR_SOURCE_RUNTIME_SHA_MATCH: sourceHash === runtimeHash,
  SAFE_STAGE_CONTRACT_REGULAR_FILE: safeStageRuntimeInfo.isFile(),
  SAFE_STAGE_CONTRACT_NOT_SYMLINK: !safeStageRuntimeInfo.isSymbolicLink(),
  SAFE_STAGE_CONTRACT_SOURCE_RUNTIME_SHA_MATCH: safeStageSourceHash === safeStageRuntimeHash,
  SAFE_STAGE_CONTRACT_MANIFEST_SHA_MATCH: sourceManifest.files?.[relativeSafeStageContract] === safeStageSourceHash,
  SAFE_STAGE_CONTRACT_MANIFEST_SIZE_MATCH: sourceManifest.sizes?.[relativeSafeStageContract] === safeStageRuntimeInfo.size,
  SAFE_STAGE_CONTRACT_MANIFEST_MODE_MATCH: sourceManifest.modes?.[relativeSafeStageContract] === "600",
  SAFE_STAGE_CONTRACT_NODE_CHECK: safeStageSyntax.status === 0,
  OPERATOR_MANIFEST_SHA_MATCH: sourceManifest.files?.[relativeOperator] === sourceHash,
  OPERATOR_MANIFEST_SIZE_MATCH: sourceManifest.sizes?.[relativeOperator] === runtimeInfo.size,
  OPERATOR_MANIFEST_MODE_MATCH: sourceManifest.modes?.[relativeOperator] === "600",
  OPERATOR_NODE_CHECK: syntax.status === 0,
  OPERATOR_PG_CLOSURE: pgResolved,
  OPERATOR_CLIENT_EXCLUSION: clientExcluded,
  OPERATOR_NOT_AUTO_EXECUTED: notAutoExecuted,
  OPERATOR_RELEASE_IDENTITY: (await readFile(runtimeOperator, "utf8")).includes(EXPECTED_RELEASE_IDENTITY),
  OPERATOR_ISOLATED_EXECUTION: isolatedExecution,
  OPERATOR_OUTPUT_REDACTION: isolatedOutputRedacted,
};
for (const [name, pass] of Object.entries(checks)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
console.log(`OPERATOR_SHA256=${sourceHash}`);
console.log(`RUNTIME_PACKAGING_GATE=${Object.values(checks).every(Boolean) ? "PASS" : "FAIL"}`);
assert.ok(Object.values(checks).every(Boolean), "Schema evidence runtime packaging gate failed");
