import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = path.join(portalRoot, ".next", "standalone", "server.js");
assert.equal(existsSync(serverEntry), true, "v2_alpha3_production_build_missing");

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
const child = spawn(process.execPath, [serverEntry], {
  cwd: path.dirname(serverEntry), windowsHide: true, stdio: "ignore",
  env: { ...process.env, NODE_ENV: "production", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA3_LOCAL_PROTOTYPE: "1", NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: "127.0.0.1", PORT: String(port) },
});
try {
  let page;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error("v2_alpha3_production_server_exited");
    try { page = await fetch(`${origin}/v2-alpha3-local`, { redirect: "manual", signal: AbortSignal.timeout(1_000) }); break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(page, "v2_alpha3_production_boundary_timeout");
  assert.equal(page.status, 404);
  const api = await fetch(`${origin}/api/v2-alpha3/domain-profiles`, { redirect: "manual", signal: AbortSignal.timeout(3_000) });
  assert.equal(api.status, 404);
  console.log("PASS V2_ALPHA3_PRODUCTION_BOUNDARY page=404 api=404 external_requests=0");
} finally { await stopChild(child); }
