import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientSources = [
  "app/v2-alpha2-local/page.tsx",
  "components/v2-alpha2/V2Alpha2ResearchStart.tsx",
  "components/v2-alpha2/v2-alpha2.module.css",
];
const forbidden = /OpenClaw|Codex|ChatGPT|GPT-[A-Za-z0-9]|OPENCLAW_|api[_-]?key|DATABASE_URL|\/v1\/chat\/completions|\/v1\/responses|Bearer\s+[A-Za-z0-9]/iu;
for (const relative of clientSources) assert.doesNotMatch(await readFile(path.join(portalRoot, relative), "utf8"), forbidden, `v2_alpha2_client_source_forbidden:${relative}`);

const chunksRoot = path.join(portalRoot, ".next", "static", "chunks");
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(absolute);
  }
}
await walk(chunksRoot);
const alpha2Chunks = [];
for (const file of files) {
  const body = await readFile(file, "utf8");
  if (body.includes("Research OS · Alpha2") || body.includes("老麥整理研究方向")) alpha2Chunks.push({ file, body });
}
assert.ok(alpha2Chunks.length > 0, "v2_alpha2_client_bundle_chunk_not_found");
for (const item of alpha2Chunks) assert.doesNotMatch(item.body, forbidden, `v2_alpha2_client_bundle_forbidden:${path.basename(item.file)}`);
console.log(`V2_ALPHA2_CLIENT_CHUNKS_VERIFIED=${alpha2Chunks.length}`);
console.log("V2_ALPHA2_SECRET_PROVIDER_IDENTITY_SCAN=PASS");
