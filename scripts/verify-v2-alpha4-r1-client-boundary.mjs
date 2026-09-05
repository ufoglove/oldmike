import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = ["app/v2-alpha4-r1-local/page.tsx", "components/v2-alpha4-r1/V2Alpha4R1ZoteroCenter.tsx", "components/v2-alpha4-r1/v2-alpha4-r1.module.css"];
const forbidden = /OpenClaw|Codex|ChatGPT|GPT-[A-Za-z0-9]|api[_-]?key|DATABASE_URL|Bearer\s+[A-Za-z0-9]|model[_-]?id|provider[_-]?endpoint|\/v1\/chat\/completions|\/v1\/responses|\/tools\/invoke/iu;
for (const relative of sourceFiles) assert.doesNotMatch(await readFile(path.join(portalRoot, relative), "utf8"), forbidden, `v2_alpha4_r1_client_source_forbidden:${relative}`);
const chunksRoot = path.join(portalRoot, ".next", "static", "chunks"); const chunkFiles=[];
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const absolute=path.join(directory,entry.name);if(entry.isDirectory())await walk(absolute);else if(entry.isFile()&&entry.name.endsWith(".js"))chunkFiles.push(absolute);}}
await walk(chunksRoot); const alpha4r1=[];
for(const file of chunkFiles){const body=await readFile(file,"utf8");if(body.includes("從 Zotero 匯入")||body.includes("v2-alpha4-r1-local")||body.includes("把發現帶進可查核的引用流程"))alpha4r1.push({file,body});}
assert.ok(alpha4r1.length>0,"v2_alpha4_r1_client_bundle_chunk_not_found"); for(const item of alpha4r1)assert.doesNotMatch(item.body,forbidden,`v2_alpha4_r1_client_bundle_forbidden:${path.basename(item.file)}`);
console.log(`PASS V2_ALPHA4_R1_CLIENT_BOUNDARY chunks=${alpha4r1.length} secret_provider_identity=0 zotero_public_label=allowed`);
