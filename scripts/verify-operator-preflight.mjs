import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import { Pool } from "pg";
import { evaluatePhase0InventoryResult } from "./operator-invite-diagnostics.mjs";

const ERROR_CODE_CATEGORIES = new Map([
  ["28P01", "DATABASE_AUTHENTICATION"],
  ["28000", "DATABASE_AUTHORIZATION"],
  ["3D000", "DATABASE_NOT_FOUND"],
  ["42P01", "DATABASE_SCHEMA_MISSING"],
  ["42501", "DATABASE_PERMISSION"],
  ["23503", "DATABASE_CONSTRAINT"],
  ["23505", "DATABASE_CONSTRAINT"],
  ["23514", "DATABASE_CONSTRAINT"],
  ["ECONNREFUSED", "DATABASE_CONNECTION"],
  ["ETIMEDOUT", "DATABASE_CONNECTION"],
  ["ENOTFOUND", "DATABASE_CONNECTION"],
  ["EAI_AGAIN", "DATABASE_CONNECTION"],
]);

function errorCodeOf(error) {
  return typeof error?.code === "string" && error.code.length > 0 ? error.code.toUpperCase() : "UNKNOWN";
}

function categoryFromErrorCode(code) {
  return ERROR_CODE_CATEGORIES.get(String(code ?? "").toUpperCase()) ?? "UNKNOWN";
}

const appRoot = path.resolve(process.cwd());
const runtimeRoot = path.join(appRoot, ".next", "standalone");
const runtimeCli = path.join(runtimeRoot, "operator", "create-registration-invite.mjs");
const approvedSha256 = "297c194ed02b967fcd753e8b00cdb7a317943148c26ad4d12ee2bec26ee9fba9";
const expectedTables = [
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
];

const output = new Map();
let failedStage = "NONE";
let postgresErrorCode = "NONE";
let errorCategory = "NONE";

function set(name, value) {
  output.set(name, String(value));
}

function pass(value) {
  return value ? "PASS" : "FAIL";
}

function notExecuted() {
  return "NOT_EXECUTED";
}

function fail(stage, error = null, category = null) {
  if (failedStage === "NONE") failedStage = stage;
  if (error && postgresErrorCode === "NONE") postgresErrorCode = errorCodeOf(error);
  if (errorCategory === "NONE") {
    errorCategory = category ?? (error ? categoryFromErrorCode(errorCodeOf(error)) : "UNKNOWN");
  }
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function contained(root, file) {
  const relative = path.relative(root, file);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function isolatedEnvironment() {
  const allowed = ["PATH", "SystemRoot", "ComSpec", "WINDIR", "TEMP", "TMP", "TMPDIR"];
  return Object.fromEntries(allowed
    .filter((name) => typeof process.env[name] === "string" && process.env[name].length > 0)
    .map((name) => [name, process.env[name]]));
}

async function runtimeGate() {
  const files = await collectFiles(runtimeRoot);
  const cliMatches = files.filter((file) => path.basename(file) === "create-registration-invite.mjs");
  const cliPathPass = cliMatches.length === 1 && path.resolve(cliMatches[0]) === path.resolve(runtimeCli);
  const cliExists = await exists(runtimeCli);
  const cliHashPass = cliPathPass && cliExists && await sha256(runtimeCli) === approvedSha256;
  const cliNodePass = cliPathPass && spawnSync(process.execPath, ["--check", runtimeCli], {
    stdio: "ignore",
    windowsHide: true,
    timeout: 15_000,
  }).status === 0;
  const serverContents = await readFile(path.join(runtimeRoot, "server.js"), "utf8").catch(() => "");
  const publicRoot = path.join(runtimeRoot, "public");
  const cliNotPublic = !contained(publicRoot, runtimeCli);
  const cliNotAutoExecuted = !serverContents.includes("create-registration-invite.mjs");
  const resolution = {
    next: false,
    react: false,
    reactDom: false,
    reactDomServer: false,
    scheduler: false,
    pg: false,
    cliPg: false,
  };

  if (await exists(runtimeRoot) && cliPathPass) {
    const resolver = String.raw`
      const { createRequire } = require("node:module");
      const path = require("node:path");
      const root = process.cwd();
      function resolves(requireFrom, name) {
        try {
          const resolved = requireFrom.resolve(name);
          const relative = path.relative(root, resolved);
          return relative !== "" && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
        } catch { return false; }
      }
      const runtimeRequire = createRequire(path.join(root, "server.js"));
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
    const resolved = spawnSync(process.execPath, ["-e", resolver], {
      cwd: runtimeRoot,
      env: isolatedEnvironment(),
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    });
    if (resolved.status === 0) {
      try { Object.assign(resolution, JSON.parse(resolved.stdout)); } catch { /* keep failures */ }
    }
  }

  return {
    cliMatches: cliMatches.length,
    cliPathPass,
    cliHashPass,
    cliNodePass,
    cliPgPass: resolution.cliPg === true,
    cliNotPublic,
    cliNotAutoExecuted,
    nextPass: resolution.next === true,
    reactPass: resolution.react === true,
    reactDomPass: resolution.reactDom === true,
    reactDomServerPass: resolution.reactDomServer === true,
    schedulerPass: resolution.scheduler === true,
    pgPass: resolution.pg === true,
  };
}

function ipv4Parts(address) {
  const parts = address.split(".").map((part) => Number(part));
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

function privateIpv4(address) {
  const parts = ipv4Parts(address);
  if (!parts) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) || (a === 192 && b === 2) || (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function privateIpv6(address) {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("ff") || normalized.startsWith("2001:db8") || normalized.startsWith("2001:0db8")) return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return Boolean(mapped && privateIpv4(mapped[1]));
}

function privateAddress(address, family) {
  const ipFamily = family || net.isIP(address);
  return ipFamily === 4 ? privateIpv4(address) : ipFamily === 6 ? privateIpv6(address) : false;
}

async function validateDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { ok: false, category: "CONFIG_VALIDATION", url: null, protocol: false, hostMatch: false, dnsPrivate: false };
  let url;
  try { url = new URL(raw); } catch {
    return { ok: false, category: "CONFIG_VALIDATION", url: null, protocol: false, hostMatch: false, dnsPrivate: false };
  }
  const protocol = ["postgres:", "postgresql:"].includes(url.protocol) && !url.username && !url.password && ["", "5432"].includes(url.port);
  const referenceHosts = [process.env.POSTGRES_HOST, process.env.OLDMIKE_POSTGRES_STAGING_HOST]
    .filter((value) => typeof value === "string" && value.length > 0);
  const hostMatch = referenceHosts.length > 0 && referenceHosts.includes(url.hostname);
  if (!protocol || !hostMatch) return { ok: false, category: "CONFIG_VALIDATION", url: null, protocol, hostMatch, dnsPrivate: false };
  let dnsPrivate = false;
  try {
    const answers = await dns.lookup(url.hostname, { all: true, verbatim: true });
    dnsPrivate = answers.length > 0 && answers.every((answer) => privateAddress(answer.address, answer.family));
  } catch {
    return { ok: false, category: "DATABASE_CONNECTION", url: null, protocol, hostMatch, dnsPrivate: false };
  }
  return { ok: protocol && hostMatch && dnsPrivate, category: null, url, protocol, hostMatch, dnsPrivate };
}

async function databaseGate(url) {
  const pool = new Pool({
    connectionString: url.toString(),
    max: 1,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    application_name: "oldmike-operator-readonly-preflight",
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const expectedDatabase = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const expectedUser = decodeURIComponent(url.username || process.env.POSTGRES_USER || process.env.PGUSER || "");
    const probe = await client.query(`
      WITH relations AS (
        SELECT c.oid, n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p')
      ), expected_relations AS (
        SELECT oid
        FROM relations
        WHERE nspname = 'public'
          AND relname = ANY($3::text[])
      )
      SELECT
        current_database() = $1 AS database_match,
        current_user = $2 AS user_match,
        current_setting('transaction_read_only') = 'on' AS read_only,
        (current_setting('server_version_num')::integer / 10000) AS postgres_major,
        to_regnamespace('public') IS NOT NULL AS public_schema,
        has_schema_privilege(current_user, 'public', 'USAGE') AS public_usage,
        (SELECT count(*) FROM relations WHERE nspname = 'public') AS public_tables,
        (SELECT count(*) FROM relations
          WHERE nspname NOT IN ('pg_catalog', 'information_schema')
            AND nspname !~ '^pg_toast') AS non_system_tables,
        (SELECT count(DISTINCT nspname) FROM relations
          WHERE nspname NOT IN ('pg_catalog', 'information_schema')
            AND nspname !~ '^pg_toast') AS schemas_with_tables,
        (SELECT count(*) FROM expected_relations) AS expected_tables_present,
        (SELECT count(*) FROM public.projects) AS project_count,
        (SELECT count(*) FROM public.project_artifacts) AS project_artifact_count,
        (SELECT count(*) FROM public.registration_invites
          WHERE used_at IS NULL AND expires_at > now()) AS active_unused_invite_count,
        (SELECT count(*) FROM pg_constraint c
          JOIN expected_relations e ON e.oid = c.conrelid
          WHERE NOT c.convalidated) AS unvalidated_constraints,
        (SELECT count(*) FROM pg_index i
          JOIN expected_relations e ON e.oid = i.indrelid
          WHERE NOT i.indisvalid OR NOT i.indisready) AS invalid_indexes,
        has_table_privilege(current_user, 'public.registration_invites', 'INSERT') AS insert_privilege
    `, [expectedDatabase, expectedUser, expectedTables]);
    const row = probe.rows[0];
    const evaluated = evaluatePhase0InventoryResult(row, {
      expectedTableCount: expectedTables.length,
    });
    const result = {
      readOnly: evaluated.checks?.readOnly === true,
      identity: evaluated.checks?.database === true,
      userMatch: evaluated.checks?.user === true,
      major18: evaluated.checks?.postgresMajor === true,
      publicSchema: evaluated.checks?.publicSchema === true,
      publicUsage: evaluated.checks?.publicUsage === true,
      publicTables: evaluated.counts?.public_tables,
      nonSystemTables: evaluated.counts?.non_system_tables,
      schemasWithTables: evaluated.counts?.schemas_with_tables,
      expectedTablesPresent: evaluated.counts?.expected_tables_present,
      projectCount: evaluated.counts?.project_count,
      projectArtifactCount: evaluated.counts?.project_artifact_count,
      activeUnusedInviteCount: evaluated.counts?.active_unused_invite_count,
      unvalidatedConstraints: evaluated.counts?.unvalidated_constraints,
      invalidIndexes: evaluated.counts?.invalid_indexes,
      inviteCount: evaluated.counts?.active_unused_invite_count,
      resultCategory: evaluated.resultCategory,
      schema: evaluated.allowed,
      insertPrivilege: row?.insert_privilege === true,
      constraints: evaluated.checks?.constraints === true,
      indexes: evaluated.checks?.indexes === true,
      error: null,
    };
    await client.query("ROLLBACK");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* read-only cleanup */ }
    error.phase0Category = "DATABASE_QUERY";
    throw error;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

const runtime = await runtimeGate().catch((error) => {
  fail("RUNTIME_GATE", null, "MODULE_RESOLUTION");
  return {
    cliMatches: 0, cliPathPass: false, cliHashPass: false, cliNodePass: false,
    cliPgPass: false, cliNotPublic: false, cliNotAutoExecuted: false,
    nextPass: false, reactPass: false, reactDomPass: false,
    reactDomServerPass: false, schedulerPass: false, pgPass: false,
    error,
  };
});
set("CLI_MATCH_COUNT", runtime.cliMatches);
set("CLI_APPROVED_PATH", pass(runtime.cliPathPass));
set("CLI_SHA256", pass(runtime.cliHashPass));
set("CLI_NODE_CHECK", pass(runtime.cliNodePass));
set("CLI_PG_RESOLUTION", pass(runtime.cliPgPass));
set("CLI_NOT_PUBLIC", pass(runtime.cliNotPublic));
set("CLI_NOT_AUTO_EXECUTED", pass(runtime.cliNotAutoExecuted));
set("NEXT_RESOLUTION", pass(runtime.nextPass));
set("REACT_RESOLUTION", pass(runtime.reactPass));
set("REACT_DOM_RESOLUTION", pass(runtime.reactDomPass));
set("REACT_DOM_SERVER_RESOLUTION", pass(runtime.reactDomServerPass));
set("SCHEDULER_RESOLUTION", pass(runtime.schedulerPass));
set("PG_RESOLUTION", pass(runtime.pgPass));
const runtimePass = runtime.cliMatches === 1 && runtime.cliPathPass && runtime.cliHashPass &&
  runtime.cliNodePass && runtime.cliPgPass && runtime.cliNotPublic && runtime.cliNotAutoExecuted &&
  runtime.nextPass && runtime.reactPass && runtime.reactDomPass && runtime.reactDomServerPass &&
  runtime.schedulerPass && runtime.pgPass;
set("RUNTIME_CLI_GATE", pass(runtimePass));
if (!runtimePass) fail("RUNTIME_GATE", null, "MODULE_RESOLUTION");

const database = await validateDatabaseUrl();
set("DATABASE_URL_SET", database.url ? "PASS" : "MISSING");
set("DATABASE_PROTOCOL_POLICY", pass(database.protocol));
set("DATABASE_INJECTED_HOST_MATCH", pass(database.hostMatch));
set("DATABASE_DNS_PRIVATE", pass(database.dnsPrivate));
let databaseResult = null;
if (database.ok) {
  try {
    databaseResult = await databaseGate(database.url);
    set("DATABASE_CONNECTION", "PASS");
  } catch (error) {
    set("DATABASE_CONNECTION", "FAIL");
    set("DATABASE_IDENTITY", notExecuted());
    set("DATABASE_USER_MATCH", notExecuted());
    set("POSTGRES_MAJOR_18", notExecuted());
    set("POSTGRES_READ_ONLY", notExecuted());
    set("PUBLIC_SCHEMA", notExecuted());
    set("PUBLIC_USAGE", notExecuted());
    set("PUBLIC_TABLE_COUNT", notExecuted());
    set("NON_SYSTEM_TABLE_COUNT", notExecuted());
    set("SCHEMAS_WITH_TABLES_COUNT", notExecuted());
    set("EXPECTED_TABLES_PRESENT_COUNT", notExecuted());
    set("PROJECT_COUNT", notExecuted());
    set("PROJECT_ARTIFACT_COUNT", notExecuted());
    set("UNVALIDATED_CONSTRAINT_COUNT", notExecuted());
    set("INVALID_INDEX_COUNT", notExecuted());
    set("REGISTRATION_INVITES_COUNT", notExecuted());
    set("INVENTORY_RESULT_SHAPE", notExecuted());
    set("DATABASE_SCHEMA", notExecuted());
    set("INSERT_PRIVILEGE", notExecuted());
    set("CONSTRAINTS_VALIDATED", notExecuted());
    set("INDEXES_VALID", notExecuted());
    fail(error.phase0Category === "DATABASE_QUERY" ? "DATABASE_SCHEMA" : "DATABASE_CONNECT",
      error, error.phase0Category ?? null);
  }
} else {
  set("DATABASE_CONNECTION", notExecuted());
  set("DATABASE_IDENTITY", notExecuted());
  set("DATABASE_USER_MATCH", notExecuted());
  set("POSTGRES_MAJOR_18", notExecuted());
  set("POSTGRES_READ_ONLY", notExecuted());
  set("PUBLIC_SCHEMA", notExecuted());
  set("PUBLIC_USAGE", notExecuted());
  set("PUBLIC_TABLE_COUNT", notExecuted());
  set("NON_SYSTEM_TABLE_COUNT", notExecuted());
  set("SCHEMAS_WITH_TABLES_COUNT", notExecuted());
  set("EXPECTED_TABLES_PRESENT_COUNT", notExecuted());
  set("PROJECT_COUNT", notExecuted());
  set("PROJECT_ARTIFACT_COUNT", notExecuted());
  set("UNVALIDATED_CONSTRAINT_COUNT", notExecuted());
  set("INVALID_INDEX_COUNT", notExecuted());
  set("REGISTRATION_INVITES_COUNT", notExecuted());
  set("INVENTORY_RESULT_SHAPE", notExecuted());
  set("DATABASE_SCHEMA", notExecuted());
  set("INSERT_PRIVILEGE", notExecuted());
  set("CONSTRAINTS_VALIDATED", notExecuted());
  set("INDEXES_VALID", notExecuted());
  fail("DATABASE_CONFIGURATION", null, database.category ?? "CONFIG_VALIDATION");
}

if (databaseResult) {
  set("DATABASE_IDENTITY", pass(databaseResult.identity));
  set("DATABASE_USER_MATCH", pass(databaseResult.userMatch));
  set("POSTGRES_MAJOR_18", pass(databaseResult.major18));
  set("POSTGRES_READ_ONLY", pass(databaseResult.readOnly));
  set("PUBLIC_SCHEMA", pass(databaseResult.publicSchema));
  set("PUBLIC_USAGE", pass(databaseResult.publicUsage));
  set("PUBLIC_TABLE_COUNT", databaseResult.publicTables);
  set("NON_SYSTEM_TABLE_COUNT", databaseResult.nonSystemTables);
  set("SCHEMAS_WITH_TABLES_COUNT", databaseResult.schemasWithTables);
  set("EXPECTED_TABLES_PRESENT_COUNT", databaseResult.expectedTablesPresent);
  set("PROJECT_COUNT", databaseResult.projectCount);
  set("PROJECT_ARTIFACT_COUNT", databaseResult.projectArtifactCount);
  set("UNVALIDATED_CONSTRAINT_COUNT", databaseResult.unvalidatedConstraints);
  set("INVALID_INDEX_COUNT", databaseResult.invalidIndexes);
  set("REGISTRATION_INVITES_COUNT", databaseResult.inviteCount);
  set("INVENTORY_RESULT_SHAPE", pass(databaseResult.resultCategory !== "RESULT_SHAPE"));
  set("DATABASE_SCHEMA", pass(databaseResult.schema));
  set("INSERT_PRIVILEGE", pass(databaseResult.insertPrivilege));
  set("CONSTRAINTS_VALIDATED", pass(databaseResult.constraints));
  set("INDEXES_VALID", pass(databaseResult.indexes));
  if (!databaseResult.readOnly || !databaseResult.identity || !databaseResult.userMatch ||
      !databaseResult.major18 || !databaseResult.schema ||
      !databaseResult.insertPrivilege || !databaseResult.constraints || !databaseResult.indexes) {
    fail("DATABASE_SCHEMA", null, databaseResult.resultCategory ?? "RESULT_SHAPE");
  }
}

const policy = {
  secret: typeof process.env.BETTER_AUTH_SECRET === "string" && process.env.BETTER_AUTH_SECRET.length >= 32,
  authUrl: (() => {
    try {
      const url = new URL(process.env.BETTER_AUTH_URL ?? "");
      return url.protocol === "https:" && !url.username && !url.password && ["", "443"].includes(url.port);
    } catch { return false; }
  })(),
  registrationClosed: process.env.REGISTRATION_MODE === "closed",
  legacyDisabled: process.env.LEGACY_AUTH_ENABLED === "false",
  externalSearchOff: process.env.OPENCLAW_EXTERNAL_SEARCH === "false",
  integrationFlagsOff: process.env.INTEGRATION_TEST_MODE !== "1" && process.env.TEST_FIXTURE !== "1",
};
set("BETTER_AUTH_SECRET_POLICY", pass(policy.secret));
set("BETTER_AUTH_URL_POLICY", pass(policy.authUrl));
set("REGISTRATION_MODE_CLOSED", pass(policy.registrationClosed));
set("LEGACY_AUTH_DISABLED", pass(policy.legacyDisabled));
set("OPENCLAW_EXTERNAL_SEARCH_OFF", pass(policy.externalSearchOff));
set("INTEGRATION_FLAGS_OFF", pass(policy.integrationFlagsOff));
if (!Object.values(policy).every(Boolean)) fail("POLICY", null, "CONFIG_VALIDATION");

const allPass = failedStage === "NONE" && runtimePass && databaseResult &&
  policy.secret && policy.authUrl && policy.registrationClosed && policy.legacyDisabled &&
  policy.externalSearchOff && policy.integrationFlagsOff;
if (allPass) {
  postgresErrorCode = "NONE";
  errorCategory = "NONE";
}
set("FAILED_STAGE", failedStage);
set("POSTGRES_ERROR_CODE", postgresErrorCode);
set("ERROR_CATEGORY", errorCategory);
set("PREFLIGHT", pass(allPass));
set("EXIT_CODE", allPass ? 0 : 2);
for (const [name, value] of output) console.log(`${name}=${value}`);
process.exit(allPass ? 0 : 2);
