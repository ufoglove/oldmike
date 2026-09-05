import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextEntry = path.join(portalRoot, "node_modules", "next", "dist", "bin", "next");
const host = "127.0.0.1";
const requestTimeoutMs = 5_000;
const startupTimeoutMs = 60_000;

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return true;
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.off("close", onClose);
      resolve(false);
    }, timeoutMs);
    const onClose = () => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once("close", onClose);
  });
}

async function terminateChild(child) {
  if (child.exitCode !== null) return Object.freeze({ graceful: true, forced: false });
  child.kill("SIGTERM");
  if (await waitForExit(child, 10_000)) return Object.freeze({ graceful: true, forced: false });
  child.kill("SIGKILL");
  assert.equal(await waitForExit(child, 10_000), true);
  return Object.freeze({ graceful: false, forced: true });
}

async function listenerClosed(port) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const settle = (closed) => {
      socket.destroy();
      resolve(closed);
    };
    socket.setTimeout(1_000, () => settle(true));
    socket.once("connect", () => settle(false));
    socket.once("error", () => settle(true));
  });
}

async function allocatePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function observe(origin, pathname, method) {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const observation = Object.freeze({ status: response.status });
  await response.body?.cancel().catch(() => undefined);
  return observation;
}

async function waitForServer(child, origin) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw Object.assign(new Error("SERVER_EARLY_EXIT"), { code: "SERVER_EARLY_EXIT", stage: "START" });
    try {
      const response = await observe(origin, "/research-os-local", "GET");
      if (response.status === 404) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Object.assign(new Error("SERVER_START_TIMEOUT"), { code: "SERVER_START_TIMEOUT", stage: "START" });
}

let child = null;
let port = null;
let stage = "PRECHECK";
try {
  if (process.argv.length !== 2) throw Object.assign(new Error("ARGUMENTS_FORBIDDEN"), { code: "ARGUMENTS_FORBIDDEN", stage });
  await access(path.join(portalRoot, ".next", "BUILD_ID"));
  await access(nextEntry);
  port = await allocatePort();
  const origin = `http://${host}:${port}`;
  const env = Object.fromEntries(
    ["SystemRoot", "SYSTEMROOT", "ComSpec", "COMSPEC", "TEMP", "TMP"].flatMap((key) => typeof process.env[key] === "string" ? [[key, process.env[key]]] : []),
  );
  Object.assign(env, {
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    HOSTNAME: host,
    PORT: String(port),
    BETTER_AUTH_URL: origin,
  });

  stage = "START";
  child = spawn(process.execPath, [nextEntry, "start", "--hostname", host, "--port", String(port)], {
    cwd: portalRoot,
    env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore"],
  });
  await waitForServer(child, origin);

  stage = "HTTP_MATRIX";
  const observations = Object.freeze({
    pageGet: await observe(origin, "/research-os-local", "GET"),
    apiGet: await observe(origin, "/api/v2-beta1/project", "GET"),
    apiPost: await observe(origin, "/api/v2-beta1/project", "POST"),
    apiPut: await observe(origin, "/api/v2-beta1/project", "PUT"),
    apiPatch: await observe(origin, "/api/v2-beta1/project", "PATCH"),
    apiDelete: await observe(origin, "/api/v2-beta1/project", "DELETE"),
  });
  assert.deepEqual(observations, {
    pageGet: { status: 404 },
    apiGet: { status: 404 },
    apiPost: { status: 404 },
    apiPut: { status: 405 },
    apiPatch: { status: 405 },
    apiDelete: { status: 405 },
  });

  stage = "CLEANUP";
  const childCleanup = await terminateChild(child);
  child = null;
  assert.equal(await listenerClosed(port), true);
  console.log(JSON.stringify({
    status: "PASS",
    buildAuthority: "CURRENT_EXISTING_NEXT_BUILD",
    buildCountThisGate: 0,
    productionHttpObserved: { pageGet: 404, apiGet: 404, apiPost: 404, unsupportedMethods: { PUT: 405, PATCH: 405, DELETE: 405 } },
    cleanup: { childProcess: childCleanup, listener: "PASS_ZERO_LISTENER" },
    loopbackOnly: true,
    browserObservation: "NOT_RUN",
    serverExternalEffectsObservation: "NOT_INSTRUMENTED",
    formalResearchWriteObservation: "NOT_INSTRUMENTED_BY_THIS_GATE",
    exitCode: 0,
  }));
} catch (error) {
  console.log(JSON.stringify({
    status: "BLOCKED",
    stage: error?.stage ?? stage,
    reason: /^[A-Z0-9_]+$/u.test(error?.code ?? "") ? error.code : error?.name === "AssertionError" ? "HTTP_MATRIX_INVALID" : "LOCAL_RUNTIME_FAILURE",
    buildCountThisGate: 0,
    exitCode: 2,
  }));
  process.exitCode = 2;
} finally {
  if (child?.exitCode === null) await terminateChild(child).catch(() => undefined);
  if (port !== null) await listenerClosed(port).catch(() => false);
}
