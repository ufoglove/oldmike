import { createHash } from "node:crypto";
import { access, chmod, mkdtemp, open, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import dns from "node:dns/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { classifyCapturedOutput, classifyError, errorCodeOf, evaluateSchemaResult } from "./operator-invite-diagnostics.mjs";
import { findBash, findPtyPython, shellPath } from "./controlled-runner-test-support.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.join(portalRoot, ".next", "standalone");
const runtimeCli = path.join(runtimeRoot, "operator", "create-registration-invite.mjs");
const runtimeVerifier = path.join(runtimeRoot, "operator", "verify-registration-invite-artifact.mjs");
const runtimeRunner = path.join(runtimeRoot, "operator", "run-controlled-invite.sh");
const ptyDriver = path.join(portalRoot, "scripts", "verify-controlled-runner-pty.py");
const sourceOperatorManifest = path.join(portalRoot, "scripts", "operator", "operator-runtime-manifest.json");
const syntheticEmail = ["operator-runner", "example.test"].join(String.fromCharCode(64));
const testSecret = "old-mike-local-operator-reproduction-secret-v1-32chars";
const loopbackBaseUrl = "https://127.0.0.1:3991";
const allowedErrorCategories = new Set([
  "CONFIG_VALIDATION",
  "EMAIL_VALIDATION",
  "MODULE_RESOLUTION",
  "DATABASE_AUTHENTICATION",
  "DATABASE_AUTHORIZATION",
  "DATABASE_NOT_FOUND",
  "DATABASE_SCHEMA_MISSING",
  "DATABASE_PERMISSION",
  "DATABASE_CONSTRAINT",
  "DATABASE_CONNECTION",
  "RESULT_SHAPE",
  "UNKNOWN",
]);
const expectedMigrationOrder = [
  "migrations/0001_better_auth_core.up.sql",
  "migrations/0002_old_mike_tenant.up.sql",
  "migrations/0003_registration_invites.up.sql",
  "migrations/0004_registration_invite_revocation.up.sql",
];
const expectedTables = new Set([
  "user",
  "session",
  "account",
  "verification",
  "rateLimit",
  "workspaces",
  "workspace_members",
  "projects",
  "project_artifacts",
  "user_consents",
  "audit_events",
  "portal_rate_limits",
  "registration_invites",
]);

function emit(name, value) {
  console.log(`${name}=${value}`);
}

function pass(value) {
  return value ? "PASS" : "FAIL";
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
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

function isolatedEnvironment(extra = {}) {
  const environment = {
    NODE_ENV: "production",
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
    ...extra,
  };
  return Object.fromEntries(Object.entries(environment).filter(([, value]) => typeof value === "string" && value.length > 0));
}

async function runtimeGate() {
  const checks = {
    runtimeRoot: await exists(runtimeRoot),
    cliPath: await exists(runtimeCli),
    cliHash: false,
    cliNode: false,
    cliPg: false,
    next: false,
    react: false,
    reactDom: false,
    reactDomServer: false,
    scheduler: false,
    pg: false,
  };

  if (!checks.runtimeRoot) return checks;
  const files = await collectFiles(runtimeRoot);
  const cliMatches = files.filter((file) => path.basename(file) === "create-registration-invite.mjs");
  checks.cliPath = cliMatches.length === 1 && path.resolve(cliMatches[0]) === path.resolve(runtimeCli);
  const operatorManifest = JSON.parse(await readFile(sourceOperatorManifest, "utf8"));
  if (checks.cliPath) checks.cliHash = (await sha256(runtimeCli)) === operatorManifest.files["create-registration-invite.mjs"];
  checks.cliNode = checks.cliPath && spawnSync(process.execPath, ["--check", runtimeCli], {
    stdio: "ignore",
    windowsHide: true,
    timeout: 15_000,
  }).status === 0;

  if (!checks.cliPath) return checks;
  const resolver = String.raw`
    const { createRequire } = require("node:module");
    const path = require("node:path");
    const root = process.cwd();
    const runtimeRequire = createRequire(path.join(root, "server.js"));
    const cliRequire = createRequire(path.join(root, "operator", "create-registration-invite.mjs"));
    function resolves(requireFrom, name) {
      try {
        const resolved = requireFrom.resolve(name);
        const relative = path.relative(root, resolved);
        return relative !== "" && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
      } catch { return false; }
    }
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
    cwd: runtimeRoot,
    env: isolatedEnvironment(),
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    windowsHide: true,
    timeout: 15_000,
  });
  if (resolution.status === 0) {
    try {
      const result = JSON.parse(resolution.stdout);
      checks.next = result.next === true;
      checks.react = result.react === true;
      checks.reactDom = result.reactDom === true;
      checks.reactDomServer = result.reactDomServer === true;
      checks.scheduler = result.scheduler === true;
      checks.pg = result.pg === true;
      checks.cliPg = result.cliPg === true;
    } catch {
      // Keep all resolution checks failed.
    }
  }
  return checks;
}

async function migrationGate() {
  const manifestPath = path.join(portalRoot, "database", "migration-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const sequencePass = JSON.stringify((manifest.order ?? []).slice(0, expectedMigrationOrder.length)) === JSON.stringify(expectedMigrationOrder)
    && manifest.order?.at(-1) === "migrations/0005_research_workflow_phase2.up.sql";
  const checksumEntries = Object.entries(manifest.sha256 ?? {});
  const checksumPass = checksumEntries.length === 10 && (await Promise.all(checksumEntries.map(async ([relative, expected]) => {
    const file = path.join(portalRoot, "database", relative);
    return await exists(file) && await sha256(file) === expected;
  }))).every(Boolean);
  return sequencePass && checksumPass;
}

function loopbackAddress(address, family) {
  if (family === 4 || net.isIP(address) === 4) return address.startsWith("127.");
  return address === "::1";
}

async function validateDatabaseUrl() {
  const raw = process.env.INTEGRATION_DATABASE_URL;
  if (!raw) return { ok: false, category: "CONFIG_VALIDATION", url: null };
  if (process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1") return { ok: false, category: "CONFIG_VALIDATION", url: null };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, category: "CONFIG_VALIDATION", url: null };
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) return { ok: false, category: "CONFIG_VALIDATION", url: null };
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname)) return { ok: false, category: "CONFIG_VALIDATION", url: null };
  try {
    const answers = await dns.lookup(url.hostname, { all: true });
    if (!answers.length || !answers.every((answer) => loopbackAddress(answer.address, answer.family))) {
      return { ok: false, category: "CONFIG_VALIDATION", url: null };
    }
  } catch {
    return { ok: false, category: "DATABASE_CONNECTION", url: null };
  }
  return { ok: true, category: null, url };
}

async function queryDatabase(pool, sql, values = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    return await client.query(sql, values);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}

async function databaseConnectionProbe(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const result = await client.query(`
      SELECT
        current_database() IS NOT NULL AS database_ok,
        current_user IS NOT NULL AS role_ok,
        current_setting('server_version_num')::int / 10000 = 18 AS version_ok
    `);
    const row = result.rows[0] ?? {};
    return {
      connection: true,
      identity: row.database_ok === true && row.role_ok === true,
      major18: row.version_ok === true,
      error: null,
    };
  } catch (error) {
    return { connection: true, identity: false, major18: false, error };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
}

async function schemaAndCountGate(pool) {
  const result = await queryDatabase(pool, `
    SELECT
      current_setting('transaction_read_only') = 'on' AS read_only,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public') AS public_tables,
      (SELECT count(*)::int FROM public.registration_invites) AS invite_count,
      COALESCE(
        (
          SELECT json_agg(tablename::text ORDER BY tablename)
          FROM pg_tables
          WHERE schemaname = 'public'
        ),
        '[]'::json
      ) AS table_names
  `);
  const row = result.rows[0];
  if (!Array.isArray(row.table_names)) {
    return {
      readOnly: row.read_only === true,
      schema: false,
      tableNamesShape: false,
      publicTables: row.public_tables,
      inviteCount: row.invite_count,
      resultCategory: "RESULT_SHAPE",
    };
  }
  return evaluateSchemaResult(row, expectedTables);
}

let operatorAttempted = false;

async function runOperator(runtimeUrl, logPath, temporaryDirectory) {
  const bash = findBash();
  const python = findPtyPython();
  if (!bash || !python) return 2;
  operatorAttempted = true;
  const result = spawnSync(python, [ptyDriver, bash, shellPath(runtimeRunner), "real", runtimeRoot], {
    cwd: runtimeRoot,
    env: {
      ...process.env,
      DATABASE_URL: runtimeUrl,
      BETTER_AUTH_SECRET: testSecret,
      BETTER_AUTH_URL: loopbackBaseUrl,
      TMPDIR: shellPath(temporaryDirectory),
      NODE_PATH: "",
    },
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
  });
  await writeFile(logPath, result.stdout ?? "", { mode: 0o600 });
  await chmod(logPath, 0o600);
  return result.status === 0 ? 0 : 2;
}

async function revokeTestInvite(runtimeUrl, logPath, artifactPath, ledgerPath) {
  const revokePath = path.join(runtimeRoot, "operator", "revoke-registration-invite.mjs");
  const handle = await open(logPath, "a", 0o600);
  try {
    const child = spawn(process.execPath, [
      revokePath,
      "--artifact", artifactPath,
      "--ledger", ledgerPath,
      "--operator", "local-operator-reproduction",
    ], {
      cwd: runtimeRoot,
      env: isolatedEnvironment({ DATABASE_URL: runtimeUrl, BETTER_AUTH_SECRET: testSecret }),
      stdio: ["ignore", handle.fd, handle.fd],
      windowsHide: true,
    });
    const [code] = await once(child, "close");
    return typeof code === "number" ? code : 2;
  } finally {
    await handle.close();
  }
}

async function verifyTestArtifact(logPath, artifactPath) {
  const handle = await open(logPath, "a", 0o600);
  try {
    const child = spawn(process.execPath, [
      runtimeVerifier,
      "--artifact", artifactPath,
      "--expected-origin", loopbackBaseUrl,
    ], {
      cwd: runtimeRoot,
      env: isolatedEnvironment(),
      stdio: ["ignore", handle.fd, handle.fd],
      windowsHide: true,
    });
    const [code] = await once(child, "close");
    return typeof code === "number" ? code : 2;
  } finally {
    await handle.close();
  }
}

let temporaryRoot;
let pool;
let logText = "";
let temporaryCleanup = "NOT_REQUIRED";
let exitCode = 2;
const stageStatus = {
  RUNTIME_GATE: "NOT_EXECUTED",
  MIGRATION_MANIFEST: "NOT_EXECUTED",
  DATABASE_CONNECT: "NOT_EXECUTED",
  DATABASE_SCHEMA: "NOT_EXECUTED",
  OPERATOR_EXECUTION: "NOT_EXECUTED",
  OPERATOR_CLEANUP: "NOT_REQUIRED",
};
let failedStage = "NONE";
let postgresErrorCode = "NONE";
let errorCategory = "NONE";
let inviteCreateStatus = "NOT_EXECUTED";

function recordFailure(stage, error, knownCategory = null) {
  if (failedStage === "NONE") failedStage = stage;
  if (postgresErrorCode === "NONE") {
    postgresErrorCode = error ? errorCodeOf(error) : "NOT_APPLICABLE";
  }
  if (errorCategory === "NONE") {
    errorCategory = knownCategory ?? (error ? classifyError(error).category : "UNKNOWN");
  }
}

function recordCapturedFailure(stage, capturedOutput) {
  const classified = classifyCapturedOutput(capturedOutput);
  recordFailure(stage, { code: classified.code }, classified.category);
}

try {
  let runtime;
  try {
    runtime = await runtimeGate();
  } catch (error) {
    stageStatus.RUNTIME_GATE = "FAIL";
    recordFailure("RUNTIME_GATE", error, "MODULE_RESOLUTION");
    runtime = { runtimeRoot: false, cliPath: false, cliHash: false, cliNode: false, cliPg: false, next: false, react: false, reactDom: false, reactDomServer: false, scheduler: false, pg: false };
  }
  const runtimePass = runtime.runtimeRoot && runtime.cliPath && runtime.cliHash && runtime.cliNode && runtime.cliPg && runtime.next && runtime.react && runtime.reactDom && runtime.reactDomServer && runtime.scheduler && runtime.pg;
  emit("CLI_PATH", pass(runtime.cliPath));
  emit("CLI_SHA256", pass(runtime.cliHash));
  emit("CLI_NODE_CHECK", pass(runtime.cliNode));
  emit("CLI_PG_RESOLUTION", pass(runtime.cliPg));
  emit("NEXT_RESOLUTION", pass(runtime.next));
  emit("REACT_RESOLUTION", pass(runtime.react));
  emit("REACT_DOM_RESOLUTION", pass(runtime.reactDom));
  emit("REACT_DOM_SERVER_RESOLUTION", pass(runtime.reactDomServer));
  emit("SCHEDULER_RESOLUTION", pass(runtime.scheduler));
  emit("PG_RESOLUTION", pass(runtime.pg));
  emit("RUNTIME_ARTIFACT_GATE", pass(runtimePass));
  stageStatus.RUNTIME_GATE = runtimePass ? "PASS" : "FAIL";

  if (!runtimePass) {
    recordFailure("RUNTIME_GATE", null, "MODULE_RESOLUTION");
  } else {
    let migrationPass = false;
    try {
      migrationPass = await migrationGate();
    } catch (error) {
      recordFailure("MIGRATION_MANIFEST", error);
    }
    stageStatus.MIGRATION_MANIFEST = migrationPass ? "PASS" : "FAIL";
    emit("MIGRATION_SEQUENCE", pass(migrationPass));
    if (!migrationPass) {
      recordFailure("MIGRATION_MANIFEST", null, "UNKNOWN");
    } else {
      const database = await validateDatabaseUrl();
      emit("INTEGRATION_DATABASE_URL_SET", database.url ? "PASS" : "MISSING");
      emit("INTEGRATION_DATABASE_DISPOSABLE", database.url ? "PASS" : "FAIL");
      emit("DATABASE_LOOPBACK_POLICY", pass(database.ok));
      if (!database.ok) {
        stageStatus.DATABASE_CONNECT = "FAIL";
        recordFailure("DATABASE_CONNECT", null, allowedErrorCategories.has(database.category) ? database.category : "UNKNOWN");
      } else {
        pool = new Pool({ connectionString: database.url.toString(), max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 10_000, application_name: "oldmike-local-operator-invite-repro" });
        let probe;
        try {
          probe = await databaseConnectionProbe(pool);
        } catch (error) {
          probe = { connection: false, identity: false, major18: false, error };
        }
        stageStatus.DATABASE_CONNECT = probe.connection ? "PASS" : "FAIL";
        emit("DATABASE_CONNECTION", pass(probe.connection));
        emit("DATABASE_IDENTITY", pass(probe.identity));
        emit("POSTGRES_MAJOR_18", pass(probe.major18));
        if (!probe.connection || !probe.identity || !probe.major18) {
          recordFailure("DATABASE_CONNECT", probe.error, "UNKNOWN");
        } else {
          let baseline;
          try {
            baseline = await schemaAndCountGate(pool);
          } catch (error) {
            stageStatus.DATABASE_SCHEMA = "FAIL";
            emit("POSTGRES_READ_ONLY", "FAIL");
            emit("MIGRATION_SCHEMA", "FAIL");
            emit("TABLE_NAMES_SHAPE", "NOT_EXECUTED");
            emit("DATABASE_SCHEMA", "FAIL");
            recordFailure("DATABASE_SCHEMA", error);
            baseline = null;
          }
          if (baseline) {
            stageStatus.DATABASE_SCHEMA = baseline.readOnly && baseline.schema && baseline.inviteCount === 0 ? "PASS" : "FAIL";
            emit("POSTGRES_READ_ONLY", pass(baseline.readOnly));
            emit("MIGRATION_SCHEMA", pass(baseline.schema));
            emit("TABLE_NAMES_SHAPE", pass(baseline.tableNamesShape));
            emit("DATABASE_SCHEMA", pass(stageStatus.DATABASE_SCHEMA === "PASS"));
            emit("PUBLIC_TABLES", String(baseline.publicTables));
            emit("REGISTRATION_INVITES_BEFORE", String(baseline.inviteCount));
            if (stageStatus.DATABASE_SCHEMA !== "PASS") {
              recordFailure("DATABASE_SCHEMA", null, baseline.tableNamesShape ? "UNKNOWN" : "RESULT_SHAPE");
            } else {
              temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "oldmike-operator-invite-repro-"));
              await chmod(temporaryRoot, 0o700);
              if (isInside(portalRoot, temporaryRoot)) throw new Error("temporary path is inside portal root");
              const logPath = path.join(temporaryRoot, "operator-output.log");
              const controlledRoot = path.join(temporaryRoot, "oldmike-controlled-invite");
              const artifactPath = path.join(controlledRoot, "invitation.json");
              const ledgerPath = path.join(controlledRoot, "recovery-ledger.json");
              const operatorExit = await runOperator(database.url.toString(), logPath, temporaryRoot);
              const verifierExit = operatorExit === 0 ? await verifyTestArtifact(logPath, artifactPath) : 2;
              logText = await readFile(logPath, "utf8").catch(() => "");
              for (const label of [
                "PTY_HIDDEN_INPUT",
                "TERMINAL_ECHO_RECOVERY",
                "EMAIL_LEAK_SCAN",
                "PTY_PROCESS",
                "PTY_INPUT_GATE",
                "PTY_PROBE_GATE",
                "RUNNER_PRECONDITION_GATE",
                "RUNNER_PRIVATE_PREPARE_GATE",
                "RUNNER_LAUNCH_GATE",
                "CONTROLLED_RUNNER_RESULT",
                "PRIVATE_FILE_READY",
              ]) emit(label, logText.includes(`${label}=PASS`) ? "PASS" : "FAIL");
              const ptyError = /^PTY_ERROR_CATEGORY=([A-Z_]+)$/m.exec(logText)?.[1] ?? "MISSING";
              emit("PTY_ERROR_CATEGORY", ptyError);
              const outputContract = operatorExit === 0 && verifierExit === 0 &&
                logText.includes("CONTROLLED_RUNNER_RESULT=PASS") &&
                logText.includes("PTY_HIDDEN_INPUT=PASS") &&
                logText.includes("TERMINAL_ECHO_RECOVERY=PASS") &&
                logText.includes("EMAIL_LEAK_SCAN=PASS") &&
                logText.includes("INVITE_ARTIFACT_MODE=PASS") &&
                logText.includes("INVITE_ARTIFACT_ORIGIN=PASS") &&
                logText.includes("INVITE_ARTIFACT_PATH=PASS") &&
                logText.includes("INVITE_ARTIFACT_SINGLE_USE=PASS") &&
                logText.includes("PRIVATE_FILE_READY=PASS") &&
                !logText.includes(syntheticEmail) &&
                !/inviteCredential|postgres(?:ql)?:\/\//i.test(logText);
              stageStatus.OPERATOR_EXECUTION = outputContract ? "PASS" : "FAIL";
              if (operatorExit !== 0) recordCapturedFailure("OPERATOR_EXECUTION", logText);
              let after;
              try {
                const ledger = outputContract ? JSON.parse(await readFile(ledgerPath, "utf8")) : null;
                const revokeExit = outputContract
                  ? await revokeTestInvite(database.url.toString(), logPath, artifactPath, ledgerPath)
                  : 2;
                if (revokeExit !== 0) throw new Error("operator_revoke_failed");
                const revoked = await queryDatabase(
                  pool,
                  "SELECT used_at, revoked_at FROM registration_invites WHERE id = $1 AND token_key = $2 AND attempt_key = $3 AND created_by_key = $4",
                  [ledger.inviteId, ledger.tokenKey, ledger.attemptKey, ledger.createdByKey],
                );
                if (revoked.rowCount !== 1 || revoked.rows[0].used_at !== null || revoked.rows[0].revoked_at === null) {
                  throw new Error("operator_revoke_status_invalid");
                }
                const repeatedRevoke = await revokeTestInvite(database.url.toString(), logPath, artifactPath, ledgerPath);
                if (repeatedRevoke === 0) throw new Error("operator_repeated_revoke_not_blocked");
                await pool.query(
                  "DELETE FROM registration_invites WHERE id = $1 AND token_key = $2 AND attempt_key = $3 AND created_by_key = $4 AND revoked_at IS NOT NULL AND used_at IS NULL",
                  [ledger.inviteId, ledger.tokenKey, ledger.attemptKey, ledger.createdByKey],
                );
                after = await schemaAndCountGate(pool);
              } catch (error) {
                stageStatus.OPERATOR_CLEANUP = "FAIL";
                recordFailure("OPERATOR_CLEANUP", error);
              }
              if (after) {
                emit("REGISTRATION_INVITES_AFTER", String(after.inviteCount));
                stageStatus.OPERATOR_CLEANUP = after.inviteCount === baseline.inviteCount ? "PASS" : "FAIL";
                if (stageStatus.OPERATOR_CLEANUP !== "PASS") recordFailure("OPERATOR_CLEANUP", null, "DATABASE_CONSTRAINT");
              }
              if (outputContract && stageStatus.OPERATOR_CLEANUP === "PASS") {
                inviteCreateStatus = "PASS";
                exitCode = 0;
              } else {
                inviteCreateStatus = "FAIL";
              }
            }
          }
        }
      }
    }
  }
} catch (error) {
  const stage = failedStage === "NONE"
    ? (operatorAttempted ? "OPERATOR_EXECUTION" : "DATABASE_SCHEMA")
    : failedStage;
  if (stage === "OPERATOR_EXECUTION" && operatorAttempted) stageStatus.OPERATOR_EXECUTION = "FAIL";
  recordFailure(stage, error);
  inviteCreateStatus = operatorAttempted ? "FAIL" : "NOT_EXECUTED";
  exitCode = 2;
} finally {
  logText = "";
  if (pool) await pool.end().catch(() => {});
  if (temporaryRoot) {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
    temporaryCleanup = await exists(temporaryRoot) ? "FAIL" : "PASS";
    if (temporaryCleanup !== "PASS") exitCode = 2;
    if (stageStatus.OPERATOR_CLEANUP === "NOT_REQUIRED") stageStatus.OPERATOR_CLEANUP = temporaryCleanup;
  }
  if (!operatorAttempted && inviteCreateStatus === "FAIL") inviteCreateStatus = "NOT_EXECUTED";
  if (failedStage !== "NONE" && postgresErrorCode === "NONE") postgresErrorCode = "NOT_APPLICABLE";
  if (failedStage !== "NONE" && errorCategory === "NONE") errorCategory = "UNKNOWN";
  for (const [stage, status] of Object.entries(stageStatus)) emit(stage, status);
  emit("INVITE_CREATE", inviteCreateStatus);
  emit("FAILED_STAGE", failedStage);
  emit("POSTGRES_ERROR_CODE", postgresErrorCode);
  emit("ERROR_CATEGORY", errorCategory);
  emit("TEMPORARY_OUTPUT_CLEANUP", temporaryCleanup);
  emit("LOCAL_OPERATOR_INVITE_GATE", exitCode === 0 ? "PASS" : "FAIL");
  emit("EXIT_CODE", String(exitCode));
}

process.exit(exitCode);
