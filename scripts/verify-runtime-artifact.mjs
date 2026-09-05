import { access, cp, lstat, mkdtemp, readFile, readdir, realpath, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readReleaseContract,
  releaseContractHash,
} from "./release-identity-contract.mjs";
import { verifySchedulerRuntimeClosure } from "./scheduler-runtime-contract.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.resolve(process.env.RUNTIME_ARTIFACT_DIR || path.join(portalRoot, ".next", "standalone"));
const cliRelative = path.join("operator", "create-registration-invite.mjs");
const cliPath = path.join(runtimeRoot, cliRelative);
const preflightPath = path.join(runtimeRoot, "operator", "verify-operator-preflight.mjs");
const verifierPath = path.join(runtimeRoot, "operator", "verify-registration-invite-artifact.mjs");
const revokePath = path.join(runtimeRoot, "operator", "revoke-registration-invite.mjs");
const atomicModulePath = path.join(runtimeRoot, "operator", "operator", "registration-invite-atomic.mjs");
const schemaPath = path.join(runtimeRoot, "operator", "operator", "registration-invite-artifact.schema.json");
const manifestPath = path.join(runtimeRoot, "operator", "operator", "operator-runtime-manifest.json");
const controlledRunnerPath = path.join(runtimeRoot, "operator", "run-controlled-invite.sh");
const controlledRunnerVerifierPath = path.join(runtimeRoot, "operator", "verify-controlled-invite-runner.mjs");
const controlledAuthE2EBridgePath = path.join(runtimeRoot, "operator", "run-controlled-auth-e2e.mjs");
const authConfigRuntimeProviderPath = path.join(runtimeRoot, "operator", "operator", "auth-config-runtime-provider.mjs");
const administratorBootstrapPath = path.join(runtimeRoot, "operator", "bootstrap-portal-administrator.mjs");
const administratorBootstrapProviderPath = path.join(runtimeRoot, "operator", "operator", "admin-bootstrap-transaction-provider.mjs");
const administratorBootstrapBridgePath = path.join(runtimeRoot, "operator", "run-admin-bootstrap.mjs");
const administratorBootstrapRecoveryPath = path.join(runtimeRoot, "operator", "recover-admin-bootstrap-handoff.mjs");
const administratorBootstrapBridgeProviderPath = path.join(runtimeRoot, "operator", "operator", "admin-bootstrap-bridge-provider.mjs");
const sourceManifestPath = path.join(portalRoot, "scripts", "operator", "operator-runtime-manifest.json");
const releaseContract = await readReleaseContract(path.join(portalRoot, "release-identity.json"));
const expectedDeploymentId = releaseContractHash(releaseContract);

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function collectFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(absolute));
    else result.push(absolute);
  }
  return result;
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function isolatedEnvironment() {
  const environment = {
    NODE_ENV: "production",
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
  };
  return Object.fromEntries(Object.entries(environment).filter(([, value]) => typeof value === "string" && value.length > 0));
}

async function isolatedResolutionChecks() {
  const temporaryParent = await mkdtemp(path.join(tmpdir(), "oldmike-runtime-resolution-"));
  const isolatedRoot = path.join(temporaryParent, "standalone");
  const result = {
    isolatedRoot: false,
    next: false,
    react: false,
    reactDom: false,
    reactDomServer: false,
    scheduler: false,
    pg: false,
    cliPg: false,
  };

  try {
    await cp(runtimeRoot, isolatedRoot, { recursive: true, force: true, verbatimSymlinks: false });
    result.isolatedRoot = !isInside(portalRoot, isolatedRoot);
    const resolver = String.raw`
      const { createRequire } = require("node:module");
      const path = require("node:path");
      const root = process.cwd();
      function contained(resolved) {
        const relative = path.relative(root, resolved);
        return relative !== "" && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
      }
      function resolves(requireFrom, packageName) {
        try { return contained(requireFrom.resolve(packageName)); } catch { return false; }
      }
      const runtimeRequire = createRequire(path.join(root, "package.json"));
      const cliRequire = createRequire(path.join(root, "operator", "create-registration-invite.mjs"));
      process.stdout.write(JSON.stringify({
        next: resolves(runtimeRequire, "next"),
        react: resolves(runtimeRequire, "react"),
        reactDom: resolves(runtimeRequire, "react-dom"),
        reactDomServer: resolves(runtimeRequire, "react-dom/server"),
        scheduler: resolves(runtimeRequire, "scheduler"),
        pg: resolves(runtimeRequire, "pg"),
        cliPg: resolves(cliRequire, "pg")
      }));
    `;
    const resolution = spawnSync(process.execPath, ["-e", resolver], {
      cwd: isolatedRoot,
      env: isolatedEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    });
    if (resolution.status === 0) Object.assign(result, JSON.parse(resolution.stdout));
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }

  return result;
}

const runtimeExists = await exists(runtimeRoot);
const serverPath = path.join(runtimeRoot, "server.js");
const publicPath = path.join(runtimeRoot, "public");
const staticPath = path.join(runtimeRoot, ".next", "static");
const cliExists = await exists(cliPath);
const files = runtimeExists ? await collectFiles(runtimeRoot) : [];
const cliMatches = files.filter((file) => path.basename(file) === "create-registration-invite.mjs");
const cliHash = cliExists ? await sha256(cliPath) : "";
const cliSource = cliExists ? await readFile(cliPath, "utf8") : "";
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
const runtimeManifest = await readFile(manifestPath, "utf8").then(JSON.parse).catch(() => null);
const manifestMatches = runtimeManifest && JSON.stringify(runtimeManifest) === JSON.stringify(sourceManifest);
const allowlistedHashes = Object.fromEntries(await Promise.all(Object.entries(sourceManifest.files ?? {}).map(async ([relative, expected]) => {
  const runtimeFile = path.join(runtimeRoot, "operator", ...relative.split("/"));
  return [relative, await exists(runtimeFile) && await sha256(runtimeFile) === expected];
})));
const allowlistedSizes = Object.fromEntries(await Promise.all(Object.entries(sourceManifest.sizes ?? {}).map(async ([relative, expected]) => {
  const runtimeFile = path.join(runtimeRoot, "operator", ...relative.split("/"));
  return [relative, await exists(runtimeFile) && (await stat(runtimeFile)).size === expected];
})));
const serverContents = await readFile(serverPath, "utf8").catch(() => "");
const runtimePackage = await readFile(path.join(runtimeRoot, "package.json"), "utf8").then(JSON.parse).catch(() => null);
const requiredServerFiles = await readFile(path.join(runtimeRoot, ".next", "required-server-files.json"), "utf8").then(JSON.parse).catch(() => null);
const cliNodeCheck = cliExists
  ? spawnSync(process.execPath, ["--check", cliPath], { encoding: "utf8", windowsHide: true, timeout: 15_000 }).status === 0
  : false;
const preflightNodeCheck = await exists(preflightPath) &&
  spawnSync(process.execPath, ["--check", preflightPath], { encoding: "utf8", windowsHide: true, timeout: 15_000 }).status === 0;
const controlledRunnerInfo = await lstat(controlledRunnerPath).catch(() => null);
const controlledAuthE2EBridgeInfo = await lstat(controlledAuthE2EBridgePath).catch(() => null);
const controlledAuthE2EBridgeSource = controlledAuthE2EBridgeInfo?.isFile()
  ? await readFile(controlledAuthE2EBridgePath, "utf8")
  : "";
const controlledAuthE2EBridgeNodeCheck = Boolean(controlledAuthE2EBridgeInfo?.isFile()) &&
  spawnSync(process.execPath, ["--check", controlledAuthE2EBridgePath], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000,
  }).status === 0;
const controlledAuthE2EBridgeNoInput = Boolean(controlledAuthE2EBridgeInfo?.isFile())
  ? spawnSync(process.execPath, [controlledAuthE2EBridgePath], {
      cwd: path.dirname(controlledAuthE2EBridgePath),
      env: isolatedEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    })
  : null;
const authConfigRuntimeProviderInfo = await lstat(authConfigRuntimeProviderPath).catch(() => null);
const authConfigRuntimeProviderNodeCheck = Boolean(authConfigRuntimeProviderInfo?.isFile()) &&
  spawnSync(process.execPath, ["--check", authConfigRuntimeProviderPath], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000,
  }).status === 0;
const authConfigRuntimeProviderProbe = Boolean(authConfigRuntimeProviderInfo?.isFile())
  ? spawnSync(process.execPath, ["--input-type=module", "-e", `
      const provider = await import(${JSON.stringify(new URL(`file:///${authConfigRuntimeProviderPath.replaceAll("\\", "/")}`).href)});
      const evidence = provider.readAuthConfigRuntimeEvidence({
        expectedGeneration: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        environment: {
          REGISTRATION_MODE: "invite_only",
          AUTH_E2E_CONTROLLED_EMAIL: "OPAQUE_CONTROLLED_INPUT",
          AUTH_E2E_CONFIG_GENERATION: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          OPENCLAW_EXTERNAL_SEARCH: "false"
        }
      });
      process.stdout.write(JSON.stringify(evidence));
    `], {
      cwd: runtimeRoot,
      env: isolatedEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    })
  : null;
const authConfigRuntimeProviderEvidence = authConfigRuntimeProviderProbe?.status === 0
  ? JSON.parse(authConfigRuntimeProviderProbe.stdout)
  : null;
const administratorBootstrapInfo = await lstat(administratorBootstrapPath).catch(() => null);
const administratorBootstrapNodeCheck = Boolean(administratorBootstrapInfo?.isFile()) &&
  spawnSync(process.execPath, ["--check", administratorBootstrapPath], {
    encoding: "utf8", windowsHide: true, timeout: 15_000,
  }).status === 0;
const administratorBootstrapProviderInfo = await lstat(administratorBootstrapProviderPath).catch(() => null);
const administratorBootstrapProviderNodeCheck = Boolean(administratorBootstrapProviderInfo?.isFile()) &&
  spawnSync(process.execPath, ["--check", administratorBootstrapProviderPath], {
    encoding: "utf8", windowsHide: true, timeout: 15_000,
  }).status === 0;
const administratorBootstrapNoInput = Boolean(administratorBootstrapInfo?.isFile())
  ? spawnSync(process.execPath, [administratorBootstrapPath], {
      cwd: runtimeRoot, env: isolatedEnvironment(), encoding: "utf8", windowsHide: true, timeout: 15_000,
    })
  : null;
const administratorBootstrapBridgeInfo = await lstat(administratorBootstrapBridgePath).catch(() => null);
const administratorBootstrapRecoveryInfo = await lstat(administratorBootstrapRecoveryPath).catch(() => null);
const administratorBootstrapBridgeProviderInfo = await lstat(administratorBootstrapBridgeProviderPath).catch(() => null);
const administratorBootstrapBridgeSource = administratorBootstrapBridgeProviderInfo?.isFile()
  ? await readFile(administratorBootstrapBridgeProviderPath, "utf8")
  : "";
const administratorBootstrapBridgeNodeCheck = Boolean(administratorBootstrapBridgeInfo?.isFile()) &&
  spawnSync(process.execPath, ["--check", administratorBootstrapBridgePath], {
    encoding: "utf8", windowsHide: true, timeout: 15_000,
  }).status === 0;
const administratorBootstrapRecoveryNodeCheck = Boolean(administratorBootstrapRecoveryInfo?.isFile()) &&
  spawnSync(process.execPath, ["--check", administratorBootstrapRecoveryPath], {
    encoding: "utf8", windowsHide: true, timeout: 15_000,
  }).status === 0;
const administratorBootstrapBridgeProviderNodeCheck = Boolean(administratorBootstrapBridgeProviderInfo?.isFile()) &&
  spawnSync(process.execPath, ["--check", administratorBootstrapBridgeProviderPath], {
    encoding: "utf8", windowsHide: true, timeout: 15_000,
  }).status === 0;
const administratorBootstrapBridgeNoInput = Boolean(administratorBootstrapBridgeInfo?.isFile())
  ? spawnSync(process.execPath, [administratorBootstrapBridgePath], {
      cwd: runtimeRoot, env: isolatedEnvironment(), encoding: "utf8", windowsHide: true, timeout: 15_000,
    })
  : null;
const controlledRunnerVerifier = await exists(controlledRunnerVerifierPath)
  ? spawnSync(process.execPath, [controlledRunnerVerifierPath, "--runtime-root", runtimeRoot], {
      cwd: runtimeRoot,
      env: isolatedEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    })
  : null;
const controlledRunnerVerifierPass = controlledRunnerVerifier?.status === 0 &&
  controlledRunnerVerifier.stdout.includes("CONTROLLED_RUNNER_RUNTIME_GATE=PASS");
const packagedArtifactIntegrityPass = controlledRunnerVerifier?.status === 0 &&
  controlledRunnerVerifier.stdout.includes("PACKAGED_ARTIFACT_INTEGRITY=PASS");
const runtimeOwnerPolicyPass = controlledRunnerVerifier?.status === 0 &&
  controlledRunnerVerifier.stdout.includes("RUNTIME_OWNER_POLICY=PASS");
const resolutions = runtimeExists ? await isolatedResolutionChecks() : {
  isolatedRoot: false,
  next: false,
  react: false,
  reactDom: false,
  reactDomServer: false,
  scheduler: false,
  pg: false,
  cliPg: false,
};
const schedulerClosure = runtimeExists
  ? await verifySchedulerRuntimeClosure({
      runtimeRoot,
      sourcePackagePath: path.join(portalRoot, "package.json"),
      lockfilePath: path.join(portalRoot, "pnpm-lock.yaml"),
    })
  : { pass: false, errorCategory: "RUNTIME_DEPENDENCY_SCHEDULER_MISSING", checks: {} };

const dependencyChecks = {
  NEXT_RESOLUTION: resolutions.next,
  REACT_RESOLUTION: resolutions.react,
  REACT_DOM_RESOLUTION: resolutions.reactDom,
  REACT_DOM_SERVER_RESOLUTION: resolutions.reactDomServer,
  SCHEDULER_RESOLUTION: resolutions.scheduler && schedulerClosure.pass,
  PG_RESOLUTION: resolutions.pg,
};

const checks = {
  CLI_MATCH_COUNT_GATE: cliMatches.length === 1,
  CLI_APPROVED_PATH: cliMatches.length === 1 && path.resolve(cliMatches[0]) === path.resolve(cliPath),
  CLI_SHA256: cliHash === sourceManifest.files["create-registration-invite.mjs"],
  CLI_NODE_CHECK: cliNodeCheck,
  CLI_PG_RESOLUTION: resolutions.cliPg,
  CLI_NOT_PUBLIC: !files.some((file) => isInside(publicPath, file) && [
    "create-registration-invite.mjs",
    "verify-registration-invite-artifact.mjs",
    "revoke-registration-invite.mjs",
    "registration-invite-artifact.schema.json",
    "run-controlled-invite.sh",
    "verify-controlled-invite-runner.mjs",
    "run-controlled-auth-e2e.mjs",
    "auth-config-runtime-provider.mjs",
    "bootstrap-portal-administrator.mjs",
    "run-admin-bootstrap.mjs",
    "recover-admin-bootstrap-handoff.mjs",
    "admin-bootstrap-bridge-provider.mjs",
  ].includes(path.basename(file))),
  CLI_NOT_AUTO_EXECUTED: cliSource.length > 0 && ![
    "create-registration-invite.mjs",
    "verify-registration-invite-artifact.mjs",
    "revoke-registration-invite.mjs",
  ].some((name) => serverContents.includes(name)),
  OPERATOR_MANIFEST_FIXED: manifestMatches && Object.values(allowlistedHashes).every(Boolean) && Object.values(allowlistedSizes).every(Boolean),
  CONTROLLED_RUNNER_PRESENT: Boolean(controlledRunnerInfo?.isFile()),
  CONTROLLED_RUNNER_APPROVED_PATH: await realpath(controlledRunnerPath).then((value) => value === path.resolve(controlledRunnerPath)).catch(() => false),
  CONTROLLED_RUNNER_NOT_SYMLINK: Boolean(controlledRunnerInfo && !controlledRunnerInfo.isSymbolicLink()),
  CONTROLLED_RUNNER_MODE: process.platform === "win32" || Boolean(controlledRunnerInfo && (controlledRunnerInfo.mode & 0o777) === 0o700),
  CONTROLLED_RUNNER_SIZE: Boolean(controlledRunnerInfo && controlledRunnerInfo.size === sourceManifest.sizes?.["run-controlled-invite.sh"]),
  CONTROLLED_RUNNER_SHA256: await exists(controlledRunnerPath) && await sha256(controlledRunnerPath) === sourceManifest.files?.["run-controlled-invite.sh"],
  CONTROLLED_RUNNER_VERIFIER: controlledRunnerVerifierPass,
  CONTROLLED_EMAIL_BRIDGE_PRESENT: Boolean(controlledAuthE2EBridgeInfo?.isFile()),
  CONTROLLED_EMAIL_BRIDGE_APPROVED_PATH: path.resolve(controlledAuthE2EBridgePath) === path.join(runtimeRoot, "operator", "run-controlled-auth-e2e.mjs"),
  CONTROLLED_EMAIL_BRIDGE_REALPATH: await realpath(controlledAuthE2EBridgePath).then((value) => value === path.resolve(controlledAuthE2EBridgePath)).catch(() => false),
  CONTROLLED_EMAIL_BRIDGE_REGULAR_FILE: Boolean(controlledAuthE2EBridgeInfo?.isFile()),
  CONTROLLED_EMAIL_BRIDGE_NOT_SYMLINK: Boolean(controlledAuthE2EBridgeInfo && !controlledAuthE2EBridgeInfo.isSymbolicLink()),
  CONTROLLED_EMAIL_BRIDGE_LINK_COUNT: Boolean(controlledAuthE2EBridgeInfo && controlledAuthE2EBridgeInfo.nlink === 1),
  CONTROLLED_EMAIL_BRIDGE_MODE: process.platform === "win32" || Boolean(controlledAuthE2EBridgeInfo && (controlledAuthE2EBridgeInfo.mode & 0o777) === 0o600),
  CONTROLLED_EMAIL_BRIDGE_SIZE: Boolean(controlledAuthE2EBridgeInfo && controlledAuthE2EBridgeInfo.size === sourceManifest.sizes?.["run-controlled-auth-e2e.mjs"]),
  CONTROLLED_EMAIL_BRIDGE_SHA256: await exists(controlledAuthE2EBridgePath) && await sha256(controlledAuthE2EBridgePath) === sourceManifest.files?.["run-controlled-auth-e2e.mjs"],
  CONTROLLED_EMAIL_BRIDGE_NODE_CHECK: controlledAuthE2EBridgeNodeCheck,
  CONTROLLED_EMAIL_BRIDGE_NO_INPUT_FAIL_CLOSED: controlledAuthE2EBridgeNoInput?.status === 2 &&
    controlledAuthE2EBridgeNoInput.stdout.includes("ERROR_CATEGORY=CONTROLLED_EMAIL_NOT_INJECTED") &&
    controlledAuthE2EBridgeNoInput.stdout.includes("PRIVATE_FILE_READY=FAIL") &&
    !controlledAuthE2EBridgeNoInput.stderr,
  CONTROLLED_EMAIL_BRIDGE_MODULE_CLOSURE: [cliPath, verifierPath, revokePath, path.join(runtimeRoot, "operator", "operator", "controlled-invite-runner-helper.mjs")]
    .every((file) => files.includes(file)),
  CONTROLLED_EMAIL_BRIDGE_NOT_AUTO_EXECUTED: !serverContents.includes("run-controlled-auth-e2e.mjs"),
  CONTROLLED_EMAIL_BRIDGE_TRANSPORT_POLICY: controlledAuthE2EBridgeSource.includes("shell: false") &&
    controlledAuthE2EBridgeSource.includes("delete childEnvironment[CONTROLLED_EMAIL_ENV]") &&
    controlledAuthE2EBridgeSource.includes("delete environment[CONTROLLED_EMAIL_ENV]") &&
    !controlledAuthE2EBridgeSource.includes("/dev/tty") && !controlledAuthE2EBridgeSource.includes("stty"),
  AUTH_CONFIG_RUNTIME_PROVIDER_PRESENT: Boolean(authConfigRuntimeProviderInfo?.isFile()),
  AUTH_CONFIG_RUNTIME_PROVIDER_REALPATH: await realpath(authConfigRuntimeProviderPath)
    .then((value) => value === path.resolve(authConfigRuntimeProviderPath))
    .catch(() => false),
  AUTH_CONFIG_RUNTIME_PROVIDER_REGULAR_FILE: Boolean(authConfigRuntimeProviderInfo?.isFile()),
  AUTH_CONFIG_RUNTIME_PROVIDER_NOT_SYMLINK: Boolean(authConfigRuntimeProviderInfo && !authConfigRuntimeProviderInfo.isSymbolicLink()),
  AUTH_CONFIG_RUNTIME_PROVIDER_SHA256: await exists(authConfigRuntimeProviderPath) &&
    await sha256(authConfigRuntimeProviderPath) === sourceManifest.files?.["operator/auth-config-runtime-provider.mjs"],
  AUTH_CONFIG_RUNTIME_PROVIDER_SIZE: Boolean(authConfigRuntimeProviderInfo &&
    authConfigRuntimeProviderInfo.size === sourceManifest.sizes?.["operator/auth-config-runtime-provider.mjs"]),
  AUTH_CONFIG_RUNTIME_PROVIDER_NODE_CHECK: authConfigRuntimeProviderNodeCheck,
  AUTH_CONFIG_RUNTIME_PROVIDER_MODULE_CLOSURE: authConfigRuntimeProviderEvidence?.registrationMode === "invite_only" &&
    authConfigRuntimeProviderEvidence?.controlledEmailKeyPresent === true &&
    authConfigRuntimeProviderEvidence?.externalSearchDisabled === true &&
    authConfigRuntimeProviderEvidence?.configGenerationPresent === true &&
    authConfigRuntimeProviderEvidence?.configGenerationMatches === true &&
    authConfigRuntimeProviderEvidence?.sensitiveValuesExposed === false,
  AUTH_CONFIG_RUNTIME_PROVIDER_NOT_AUTO_EXECUTED: !serverContents.includes("auth-config-runtime-provider.mjs"),
  ADMIN_BOOTSTRAP_PRESENT: Boolean(administratorBootstrapInfo?.isFile()),
  ADMIN_BOOTSTRAP_REGULAR_FILE: Boolean(administratorBootstrapInfo?.isFile()),
  ADMIN_BOOTSTRAP_NOT_SYMLINK: Boolean(administratorBootstrapInfo && !administratorBootstrapInfo.isSymbolicLink()),
  ADMIN_BOOTSTRAP_REALPATH: await realpath(administratorBootstrapPath).then((value) => value === path.resolve(administratorBootstrapPath)).catch(() => false),
  ADMIN_BOOTSTRAP_MODE: process.platform === "win32" || Boolean(administratorBootstrapInfo && (administratorBootstrapInfo.mode & 0o777) === 0o700),
  ADMIN_BOOTSTRAP_SIZE: Boolean(administratorBootstrapInfo && administratorBootstrapInfo.size === sourceManifest.sizes?.["bootstrap-portal-administrator.mjs"]),
  ADMIN_BOOTSTRAP_SHA256: await exists(administratorBootstrapPath) && await sha256(administratorBootstrapPath) === sourceManifest.files?.["bootstrap-portal-administrator.mjs"],
  ADMIN_BOOTSTRAP_NODE_CHECK: administratorBootstrapNodeCheck,
  ADMIN_BOOTSTRAP_STDIN_ONLY: administratorBootstrapNoInput?.status === 2 && administratorBootstrapNoInput.stderr.includes("BOOTSTRAP_INPUT_INVALID"),
  ADMIN_BOOTSTRAP_NOT_AUTO_EXECUTED: !serverContents.includes("bootstrap-portal-administrator.mjs"),
  ADMIN_BOOTSTRAP_PROVIDER_PRESENT: Boolean(administratorBootstrapProviderInfo?.isFile()),
  ADMIN_BOOTSTRAP_PROVIDER_REGULAR_FILE: Boolean(administratorBootstrapProviderInfo?.isFile()),
  ADMIN_BOOTSTRAP_PROVIDER_NOT_SYMLINK: Boolean(administratorBootstrapProviderInfo && !administratorBootstrapProviderInfo.isSymbolicLink()),
  ADMIN_BOOTSTRAP_PROVIDER_REALPATH: await realpath(administratorBootstrapProviderPath)
    .then((value) => value === path.resolve(administratorBootstrapProviderPath))
    .catch(() => false),
  ADMIN_BOOTSTRAP_PROVIDER_MODE: process.platform === "win32" || Boolean(administratorBootstrapProviderInfo && (administratorBootstrapProviderInfo.mode & 0o777) === 0o600),
  ADMIN_BOOTSTRAP_PROVIDER_SIZE: Boolean(administratorBootstrapProviderInfo && administratorBootstrapProviderInfo.size === sourceManifest.sizes?.["operator/admin-bootstrap-transaction-provider.mjs"]),
  ADMIN_BOOTSTRAP_PROVIDER_SHA256: await exists(administratorBootstrapProviderPath) && await sha256(administratorBootstrapProviderPath) === sourceManifest.files?.["operator/admin-bootstrap-transaction-provider.mjs"],
  ADMIN_BOOTSTRAP_PROVIDER_NODE_CHECK: administratorBootstrapProviderNodeCheck,
  ADMIN_BOOTSTRAP_PROVIDER_MODULE_CLOSURE: Boolean(administratorBootstrapInfo?.isFile()) &&
    (await readFile(administratorBootstrapPath, "utf8")).includes("./operator/admin-bootstrap-transaction-provider.mjs"),
  ADMIN_BOOTSTRAP_BRIDGE_PRESENT: Boolean(administratorBootstrapBridgeInfo?.isFile()),
  ADMIN_BOOTSTRAP_BRIDGE_REGULAR_FILE: Boolean(administratorBootstrapBridgeInfo?.isFile()),
  ADMIN_BOOTSTRAP_BRIDGE_NOT_SYMLINK: Boolean(administratorBootstrapBridgeInfo && !administratorBootstrapBridgeInfo.isSymbolicLink()),
  ADMIN_BOOTSTRAP_BRIDGE_REALPATH: await realpath(administratorBootstrapBridgePath).then((value) => value === path.resolve(administratorBootstrapBridgePath)).catch(() => false),
  ADMIN_BOOTSTRAP_BRIDGE_MODE: process.platform === "win32" || Boolean(administratorBootstrapBridgeInfo && (administratorBootstrapBridgeInfo.mode & 0o777) === 0o700),
  ADMIN_BOOTSTRAP_BRIDGE_SIZE: Boolean(administratorBootstrapBridgeInfo && administratorBootstrapBridgeInfo.size === sourceManifest.sizes?.["run-admin-bootstrap.mjs"]),
  ADMIN_BOOTSTRAP_BRIDGE_SHA256: await exists(administratorBootstrapBridgePath) && await sha256(administratorBootstrapBridgePath) === sourceManifest.files?.["run-admin-bootstrap.mjs"],
  ADMIN_BOOTSTRAP_BRIDGE_NODE_CHECK: administratorBootstrapBridgeNodeCheck,
  ADMIN_BOOTSTRAP_BRIDGE_NO_INPUT_FAIL_CLOSED: administratorBootstrapBridgeNoInput?.status === 2 &&
    administratorBootstrapBridgeNoInput.stdout.includes("ERROR_CATEGORY=ADMIN_BOOTSTRAP_IDENTIFIER_MISSING") &&
    administratorBootstrapBridgeNoInput.stdout.includes("AUTOMATIC_RETRY=DISABLED") &&
    !administratorBootstrapBridgeNoInput.stderr,
  ADMIN_BOOTSTRAP_BRIDGE_TRANSPORT_POLICY: administratorBootstrapBridgeSource.includes("spawnImplementation(executable, childArguments") &&
    administratorBootstrapBridgeSource.includes("shell: false") &&
    administratorBootstrapBridgeSource.includes("stdio: [\"pipe\", \"pipe\", \"pipe\"]") &&
    administratorBootstrapBridgeSource.includes("child.stdin.end(inputBuffer)") &&
    !administratorBootstrapBridgeSource.includes("shell: true"),
  ADMIN_BOOTSTRAP_BRIDGE_MODULE_CLOSURE: Boolean(administratorBootstrapBridgeProviderInfo?.isFile()) &&
    (await readFile(administratorBootstrapBridgePath, "utf8")).includes("./operator/admin-bootstrap-bridge-provider.mjs") &&
    administratorBootstrapBridgeSource.includes("bootstrap-execution.lock") &&
    administratorBootstrapBridgeSource.includes("administrator-password-handoff.staging"),
  ADMIN_BOOTSTRAP_BRIDGE_PROVIDER_REGULAR_FILE: Boolean(administratorBootstrapBridgeProviderInfo?.isFile()),
  ADMIN_BOOTSTRAP_BRIDGE_PROVIDER_NOT_SYMLINK: Boolean(administratorBootstrapBridgeProviderInfo && !administratorBootstrapBridgeProviderInfo.isSymbolicLink()),
  ADMIN_BOOTSTRAP_BRIDGE_PROVIDER_REALPATH: await realpath(administratorBootstrapBridgeProviderPath).then((value) => value === path.resolve(administratorBootstrapBridgeProviderPath)).catch(() => false),
  ADMIN_BOOTSTRAP_BRIDGE_PROVIDER_MODE: process.platform === "win32" || Boolean(administratorBootstrapBridgeProviderInfo && (administratorBootstrapBridgeProviderInfo.mode & 0o777) === 0o600),
  ADMIN_BOOTSTRAP_BRIDGE_PROVIDER_SIZE: Boolean(administratorBootstrapBridgeProviderInfo && administratorBootstrapBridgeProviderInfo.size === sourceManifest.sizes?.["operator/admin-bootstrap-bridge-provider.mjs"]),
  ADMIN_BOOTSTRAP_BRIDGE_PROVIDER_SHA256: await exists(administratorBootstrapBridgeProviderPath) && await sha256(administratorBootstrapBridgeProviderPath) === sourceManifest.files?.["operator/admin-bootstrap-bridge-provider.mjs"],
  ADMIN_BOOTSTRAP_BRIDGE_PROVIDER_NODE_CHECK: administratorBootstrapBridgeProviderNodeCheck,
  ADMIN_BOOTSTRAP_RECOVERY_PRESENT: Boolean(administratorBootstrapRecoveryInfo?.isFile()),
  ADMIN_BOOTSTRAP_RECOVERY_REGULAR_FILE: Boolean(administratorBootstrapRecoveryInfo?.isFile()),
  ADMIN_BOOTSTRAP_RECOVERY_NOT_SYMLINK: Boolean(administratorBootstrapRecoveryInfo && !administratorBootstrapRecoveryInfo.isSymbolicLink()),
  ADMIN_BOOTSTRAP_RECOVERY_REALPATH: await realpath(administratorBootstrapRecoveryPath).then((value) => value === path.resolve(administratorBootstrapRecoveryPath)).catch(() => false),
  ADMIN_BOOTSTRAP_RECOVERY_MODE: process.platform === "win32" || Boolean(administratorBootstrapRecoveryInfo && (administratorBootstrapRecoveryInfo.mode & 0o777) === 0o700),
  ADMIN_BOOTSTRAP_RECOVERY_SIZE: Boolean(administratorBootstrapRecoveryInfo && administratorBootstrapRecoveryInfo.size === sourceManifest.sizes?.["recover-admin-bootstrap-handoff.mjs"]),
  ADMIN_BOOTSTRAP_RECOVERY_SHA256: await exists(administratorBootstrapRecoveryPath) && await sha256(administratorBootstrapRecoveryPath) === sourceManifest.files?.["recover-admin-bootstrap-handoff.mjs"],
  ADMIN_BOOTSTRAP_RECOVERY_NODE_CHECK: administratorBootstrapRecoveryNodeCheck,
  ADMIN_BOOTSTRAP_BRIDGE_NOT_AUTO_EXECUTED: !serverContents.includes("run-admin-bootstrap.mjs") && !serverContents.includes("recover-admin-bootstrap-handoff.mjs"),
  PACKAGED_ARTIFACT_INTEGRITY_GATE: packagedArtifactIntegrityPass,
  RUNTIME_OWNER_POLICY_GATE: runtimeOwnerPolicyPass,
  PREFLIGHT_ARTIFACT: preflightNodeCheck,
  OUTPUT_VERIFIER_ARTIFACT: await exists(verifierPath) && spawnSync(process.execPath, ["--check", verifierPath], { stdio: "ignore", windowsHide: true }).status === 0,
  REVOKE_OPERATOR_ARTIFACT: await exists(revokePath) && spawnSync(process.execPath, ["--check", revokePath], { stdio: "ignore", windowsHide: true }).status === 0,
  ATOMIC_MODULE_ARTIFACT: await exists(atomicModulePath),
  JSON_SCHEMA_ARTIFACT: await exists(schemaPath),
  STANDALONE_SERVER: await exists(serverPath),
  PUBLIC_COPIED: await exists(publicPath),
  STATIC_COPIED: await exists(staticPath),
  RUNTIME_PACKAGE_VERSION: runtimePackage?.version === releaseContract.version,
  RELEASE_DEPLOYMENT_ID: requiredServerFiles?.config?.deploymentId === expectedDeploymentId,
};

const runtimeDependencyGate = resolutions.isolatedRoot && Object.values(dependencyChecks).every(Boolean) && resolutions.cliPg;
console.log(`CLI_MATCH_COUNT=${cliMatches.length}`);
for (const [name, pass] of Object.entries(checks)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
for (const [name, pass] of Object.entries(dependencyChecks)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
for (const [name, pass] of Object.entries(schedulerClosure.checks)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
console.log(`SCHEDULER_ERROR_CATEGORY=${schedulerClosure.errorCategory}`);
console.log(`RUNTIME_DEPENDENCY_GATE=${runtimeDependencyGate ? "PASS" : "FAIL"}`);
const allPass = runtimeExists && runtimeDependencyGate && Object.values(checks).every(Boolean);
console.log(`RUNTIME_ARTIFACT_GATE=${allPass ? "PASS" : "FAIL"}`);
process.exit(allPass ? 0 : 2);
