import { access, cp, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateResearchHttpResponse } from "./research-runtime-contract.mjs";
import { readReleaseContract, releaseIdentity } from "./release-identity-contract.mjs";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = path.resolve(process.env.RUNTIME_ARTIFACT_DIR || path.join(portalRoot, ".next", "standalone"));
const releaseContract = await readReleaseContract(path.join(portalRoot, "release-identity.json"));
const expectedReleaseIdentity = releaseIdentity(releaseContract);

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function resolvesInside(runtimeDirectory, packageName) {
  try {
    const runtimeRequire = createRequire(path.join(runtimeDirectory, "package.json"));
    const resolved = runtimeRequire.resolve(packageName);
    const relative = path.relative(runtimeDirectory, resolved);
    return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

function parseContentSecurityPolicy(value) {
  const directives = new Map();
  for (const rawDirective of value.split(";")) {
    const tokens = rawDirective.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length || directives.has(tokens[0])) return null;
    directives.set(tokens[0], tokens.slice(1));
  }
  return directives;
}

async function reserveLoopbackPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  if (!port) throw new Error("Unable to reserve a loopback port");
  return port;
}

function isolatedServerEnvironment(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const environment = {
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    TMPDIR: process.env.TMPDIR,
    DATABASE_URL: "postgresql://oldmike_fixture@127.0.0.1:1/oldmike_fixture",
    BETTER_AUTH_SECRET: "isolated-runtime-secret-000000000000000000000000",
    BETTER_AUTH_URL: baseUrl,
    RESEND_API_KEY: "re_isolated_runtime_fixture",
    RESEND_FROM_EMAIL: "Old Mike Research OS <no-reply@example.test>",
    REGISTRATION_MODE: "closed",
    LEGACY_AUTH_ENABLED: "false",
    OPENCLAW_EXTERNAL_SEARCH: "false",
    INTEGRATION_TEST_MODE: "1",
    TEST_FIXTURE: "1",
  };
  return Object.fromEntries(Object.entries(environment).filter(([, value]) => typeof value === "string" && value.length > 0));
}

async function waitForHealth(child, baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return null;
    try {
      const response = await fetch(`${baseUrl}/api/health?probe=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
        signal: AbortSignal.timeout(1_000),
      });
      if (response.status === 200) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function terminateChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return true;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (!exited) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
  return child.exitCode !== null || child.signalCode !== null;
}

const results = {
  ISOLATED_RUNTIME_ROOT: false,
  ISOLATED_PARENT_NODE_MODULES_ABSENT: false,
  NODE_PATH_CLEARED: false,
  STANDALONE_SERVER_BOOT: false,
  HEALTH_RENDER_SMOKE: false,
  HEALTH_RELEASE_IDENTITY: false,
  HEALTH_NO_STORE: false,
  BROWSER_CSP_GATE: false,
  LOGIN_RENDER_SMOKE: false,
  HOME_RENDER_OR_AUTH_REDIRECT: false,
  UNAUTH_PROJECTS_HTTP: false,
  CLOSED_REGISTRATION_GATE: false,
  WEB_RESEARCH_DISABLED_RUNTIME_GATE: false,
  RESEARCH_ROUTE_HTTP_GATE: false,
  RUNTIME_DEPENDENCY_GATE: false,
  CHILD_SERVER_TERMINATED: false,
};

const temporaryParent = await mkdtemp(path.join(tmpdir(), "oldmike-isolated-runtime-"));
const isolatedRoot = path.join(temporaryParent, "standalone");
let child;

try {
  results.ISOLATED_PARENT_NODE_MODULES_ABSENT = await access(path.join(temporaryParent, "node_modules"))
    .then(() => false)
    .catch(() => true);
  await cp(runtimeRoot, isolatedRoot, { recursive: true, force: true, verbatimSymlinks: false });
  results.ISOLATED_RUNTIME_ROOT = !isInside(portalRoot, isolatedRoot) && isInside(tmpdir(), isolatedRoot);
  results.RUNTIME_DEPENDENCY_GATE = ["next", "react", "react-dom", "react-dom/server", "scheduler", "pg"]
    .every((packageName) => resolvesInside(isolatedRoot, packageName));

  const port = await reserveLoopbackPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverEnvironment = isolatedServerEnvironment(port);
  results.NODE_PATH_CLEARED = !Object.hasOwn(serverEnvironment, "NODE_PATH");
  child = spawn(process.execPath, ["server.js"], {
    cwd: isolatedRoot,
    env: serverEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.resume();
  child.stderr.resume();

  const health = await waitForHealth(child, baseUrl, 30_000);
  results.STANDALONE_SERVER_BOOT = Boolean(health);
  if (health) {
    const payload = await health.json().catch(() => null);
    const cacheControl = health.headers.get("cache-control")?.toLowerCase() ?? "";
    const cdnCacheControl = health.headers.get("cdn-cache-control")?.toLowerCase() ?? "";
    results.HEALTH_RENDER_SMOKE = payload?.status === "ok" && payload?.service === "research-portal" && payload?.version === releaseContract.version;
    results.HEALTH_RELEASE_IDENTITY = payload?.releaseIdentity === expectedReleaseIdentity;
    results.HEALTH_NO_STORE = cacheControl.includes("no-store") && cacheControl.includes("no-cache") && cdnCacheControl.includes("no-store");
  }

  if (results.STANDALONE_SERVER_BOOT) {
    const login = await fetch(`${baseUrl}/login`, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const loginBody = await login.text();
results.LOGIN_RENDER_SMOKE = login.status === 200 && /<html/i.test(loginBody) && /老麥科研工作台/u.test(loginBody);
    const contentSecurityPolicy = login.headers.get("content-security-policy") || "";
    const cspDirectives = parseContentSecurityPolicy(contentSecurityPolicy);
    results.BROWSER_CSP_GATE = JSON.stringify(cspDirectives?.get("connect-src")) === JSON.stringify(["'self'"])
      && JSON.stringify(cspDirectives?.get("frame-ancestors")) === JSON.stringify(["'none'"])
      && JSON.stringify(cspDirectives?.get("object-src")) === JSON.stringify(["'none'"]);

    const home = await fetch(`${baseUrl}/`, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (home.status === 200) {
      const homeBody = await home.text();
      results.HOME_RENDER_OR_AUTH_REDIRECT = /<html/i.test(homeBody);
    } else if ([301, 302, 303, 307, 308].includes(home.status)) {
      const location = home.headers.get("location");
      results.HOME_RENDER_OR_AUTH_REDIRECT = Boolean(location && new URL(location, baseUrl).pathname === "/login");
    }

    const projects = await fetch(`${baseUrl}/api/projects`, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    results.UNAUTH_PROJECTS_HTTP = projects.status === 401;

    const registration = await fetch(`${baseUrl}/api/account/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const registrationPayload = await registration.json().catch(() => null);
    results.CLOSED_REGISTRATION_GATE = registration.status === 503 && registrationPayload?.code === "registration_unavailable";

    const webResearch = await fetch(`${baseUrl}/api/assist/web-preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.org/", purpose: "isolated runtime route registration probe" }),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const webResearchPayload = await webResearch.json().catch(() => null);
    results.WEB_RESEARCH_DISABLED_RUNTIME_GATE = webResearch.status === 503
      && webResearchPayload?.code === "web_research_disabled";

    const research = await fetch(`${baseUrl}/api/projects/00000000-0000-0000-0000-000000000000/research`, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const researchPayload = await research.json().catch(() => null);
    results.RESEARCH_ROUTE_HTTP_GATE = evaluateResearchHttpResponse(research.status, researchPayload?.code);
  }
} catch {
  // Individual gates remain false and block the release.
} finally {
  results.CHILD_SERVER_TERMINATED = await terminateChild(child);
  await rm(temporaryParent, { recursive: true, force: true });
}

for (const [name, pass] of Object.entries(results)) console.log(`${name}=${pass ? "PASS" : "FAIL"}`);
const allPass = Object.values(results).every(Boolean);
console.log(`ISOLATED_RUNTIME_SMOKE=${allPass ? "PASS" : "FAIL"}`);
process.exit(allPass ? 0 : 2);
