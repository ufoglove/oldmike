import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  "app/v2-alpha1-local/page.tsx",
  "components/v2/AssistableField.tsx",
  "components/v2/SuggestionDrawer.tsx",
  "components/v2/OldMikeResearchOSV2.tsx",
  "lib/v2/prototype-contract.ts",
];
const forbidden = /OpenClaw|Codex|ChatGPT|GPT-[A-Za-z0-9]|api[_-]?key|DATABASE_URL|Bearer\s+[A-Za-z0-9]/iu;
for (const relative of sourceFiles) assert.doesNotMatch(await readFile(path.join(portalRoot, relative), "utf8"), forbidden, `v2_client_source_forbidden:${relative}`);

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
const v2Chunks = [];
for (const file of chunkFiles) {
  const body = await readFile(file, "utf8");
  if (body.includes("今天想研究什麼") || body.includes("v2-alpha1-local") || body.includes("Research OS · V2")) v2Chunks.push({ file, body });
}
assert.ok(v2Chunks.length > 0, "v2_client_bundle_chunk_not_found");
for (const item of v2Chunks) assert.doesNotMatch(item.body, forbidden, `v2_client_bundle_forbidden:${path.basename(item.file)}`);
console.log(`V2_ALPHA1_CLIENT_CHUNKS_VERIFIED=${v2Chunks.length}`);
console.log("V2_ALPHA1_SECRET_PROVIDER_IDENTITY_SCAN=PASS");

