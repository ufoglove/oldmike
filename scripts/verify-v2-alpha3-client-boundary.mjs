import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  "app/v2-alpha3-local/page.tsx",
  "components/v2-alpha3/V2Alpha3Workspace.tsx",
  "components/v2-alpha3/v2-alpha3.module.css",
];
const forbidden = /OpenClaw|Codex|ChatGPT|GPT-[A-Za-z0-9]|api[_-]?key|DATABASE_URL|Bearer\s+[A-Za-z0-9]|model[_-]?id|provider[_-]?endpoint/iu;
for (const relative of sourceFiles) assert.doesNotMatch(await readFile(path.join(portalRoot, relative), "utf8"), forbidden, `v2_alpha3_client_source_forbidden:${relative}`);

const chunksRoot = path.join(portalRoot, ".next", "static", "chunks");
const chunkFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (entry.isFile() && entry.name.endsWith(".js")) chunkFiles.push(absolute);
  }
}
await walk(chunksRoot);
const alpha3Chunks = [];
for (const file of chunkFiles) {
  const body = await readFile(file, "utf8");
  if (body.includes("先選定研究邊界") || body.includes("v2-alpha3-local") || body.includes("三個耐久研究方向")) alpha3Chunks.push({ file, body });
}
assert.ok(alpha3Chunks.length > 0, "v2_alpha3_client_bundle_chunk_not_found");
for (const item of alpha3Chunks) assert.doesNotMatch(item.body, forbidden, `v2_alpha3_client_bundle_forbidden:${path.basename(item.file)}`);
console.log(`PASS V2_ALPHA3_CLIENT_BOUNDARY chunks=${alpha3Chunks.length} secret_ai_provider_identity=0`);
