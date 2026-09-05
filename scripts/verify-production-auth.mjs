import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); const runtimeRoot = path.join(root, ".next", "standalone"); const nodeBinary = process.execPath; const server = path.join(runtimeRoot, "server.js"); const port = 3191;
function environment(extra = {}) { return { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, NODE_ENV: "production", PORT: String(port), ...extra }; }
async function waitForServer(child) { for (let i = 0; i < 40; i += 1) { try { const response = await fetch(`http://127.0.0.1:${port}/login`); if (response.ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 250)); } child.kill(); throw new Error("production server did not become ready"); }
assert.ok(await import("node:fs/promises").then(({ access }) => access(server).then(() => true).catch(() => false)), "standalone server is required");
async function run(extra, expected) { const child = spawn(nodeBinary, [server], { cwd: runtimeRoot, env: environment(extra), stdio: "ignore", windowsHide: true }); try { await waitForServer(child); const auth = await fetch(`http://127.0.0.1:${port}/api/auth/sign-in/email`, { method: "POST", headers: { "content-type": "application/json", origin: `http://127.0.0.1:${port}` }, body: JSON.stringify({ email: "fixture@example.test", password: "fixture-password" }) }); const projects = await fetch(`http://127.0.0.1:${port}/api/projects`); assert.equal(auth.status, expected.auth); assert.equal(projects.status, expected.projects); } finally { child.kill(); await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once("exit", resolve); }); } }
await run({}, { auth: 503, projects: 503 });
console.log("production auth: PASS (missing server auth configuration fails closed with 503; authenticated-config 401 is covered by route contract and tenant fixture)");
