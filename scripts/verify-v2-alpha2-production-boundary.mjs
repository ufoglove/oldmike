import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = path.join(portalRoot, ".next", "standalone", "server.js");
assert.equal(existsSync(serverEntry), true, "v2_alpha2_production_build_missing");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  for (let attempt = 0; attempt < 50 && child.exitCode === null; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (child.exitCode === null) child.kill("SIGKILL");
}

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const cleanEnvironment = { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: "127.0.0.1", PORT: String(port) };
for (const name of ["TEST_FIXTURE", "OLD_MIKE_V2_ALPHA2_SERVER_ENABLED", "OLD_MIKE_V2_ALPHA2_LOCAL_PROTOTYPE", "OLD_MIKE_V2_ALPHA2_SYNTHETIC_PRINCIPAL", "OLD_MIKE_V2_ALPHA2_SYNTHETIC_PROVIDER", "OLD_MIKE_V2_ALPHA2_WORKER_ENABLED"]) delete cleanEnvironment[name];
const child = spawn(process.execPath, [serverEntry], { cwd: path.dirname(serverEntry), windowsHide: true, stdio: "ignore", env: cleanEnvironment });

async function boundedFetch(target, init) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error("v2_alpha2_production_server_exited");
    try { return await fetch(target, { ...init, redirect: "manual", signal: AbortSignal.timeout(1_000) }); } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("v2_alpha2_production_boundary_timeout");
}

try {
  const page = await boundedFetch(`${origin}/v2-alpha2-local`);
  assert.equal(page.status, 404);
  const apiGet = await boundedFetch(`${origin}/api/v2-alpha2/journeys/non-operational`);
  assert.equal(apiGet.status, 404);
  const apiPost = await boundedFetch(`${origin}/api/v2-alpha2/journeys`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: "{}" });
  assert.equal(apiPost.status, 404);
  console.log("V2_ALPHA2_PRODUCTION_ENTRY=HARD_DISABLED_404");
  console.log("V2_ALPHA2_PRODUCTION_WORKER=HARD_DISABLED_BY_DEFAULT");
  console.log("V2_ALPHA2_EXTERNAL_REQUESTS=0");
} finally {
  await stopChild(child);
}
