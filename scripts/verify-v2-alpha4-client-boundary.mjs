import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = ["app/v2-alpha4-local/page.tsx", "components/v2-alpha4/V2Alpha4JournalWorkspace.tsx", "components/v2-alpha4/v2-alpha4.module.css", "lib/v2-alpha4/catalog.ts"];
const forbidden = /OpenClaw|Codex|ChatGPT|GPT-[A-Za-z0-9]|api[_-]?key|DATABASE_URL|Bearer\s+[A-Za-z0-9]|model[_-]?id|provider[_-]?endpoint|\/v1\/chat\/completions|\/v1\/responses|\/tools\/invoke/iu;
for (const relative of sourceFiles) assert.doesNotMatch(await readFile(path.join(portalRoot, relative), "utf8"), forbidden, `v2_alpha4_client_source_forbidden:${relative}`);
const chunksRoot = path.join(portalRoot, ".next", "static", "chunks"); const chunkFiles=[];
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const absolute=path.join(directory,entry.name);if(entry.isDirectory())await walk(absolute);else if(entry.isFile()&&entry.name.endsWith(".js"))chunkFiles.push(absolute);}}
await walk(chunksRoot); const alpha4=[];
for(const file of chunkFiles){const body=await readFile(file,"utf8");if(body.includes("從研究意圖")||body.includes("v2-alpha4-local")||body.includes("近期已發表內容的可觀察模式"))alpha4.push({file,body});}
assert.ok(alpha4.length>0,"v2_alpha4_client_bundle_chunk_not_found"); for(const item of alpha4)assert.doesNotMatch(item.body,forbidden,`v2_alpha4_client_bundle_forbidden:${path.basename(item.file)}`);
console.log(`PASS V2_ALPHA4_CLIENT_BOUNDARY chunks=${alpha4.length} secret_provider_identity=0`);

