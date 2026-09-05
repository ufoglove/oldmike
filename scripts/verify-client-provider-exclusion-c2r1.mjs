import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const providerIdentity = /\b(?:openclaw|codex|openai|chatgpt|anthropic|claude|gemini|deepseek|gpt-[a-z0-9.-]+)\b/iu;
const secretIdentifier = /(?:OPENCLAW_GATEWAY_TOKEN|OLD_MIKE_RESPONSES_BEARER_TOKEN|OLD_MIKE_RESPONSES_ENDPOINT|OPENCLAW_BASE_URL)/u;

async function collect(directory, extensions) {
  if (!(await stat(directory).catch(() => null))?.isDirectory()) return [];
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collect(absolute, extensions));
    else if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) result.push(absolute);
  }
  return result;
}

const sourceFiles = [
  ...await collect(path.join(root, "components"), [".tsx", ".css"]),
  ...await collect(path.join(root, "app"), [".tsx", ".css"]),
];
assert(sourceFiles.length > 0);
for (const filename of sourceFiles) {
  const source = await readFile(filename, "utf8");
  assert.doesNotMatch(source, providerIdentity, `public provider identity leaked in ${path.relative(root, filename)}`);
  assert.doesNotMatch(source, secretIdentifier, `server-only authority leaked in ${path.relative(root, filename)}`);
}

const buildFiles = await collect(path.join(root, ".next", "static"), [".js", ".css"]);
if (process.argv.includes("--include-build")) assert(buildFiles.length > 0, "built client bundle missing");
for (const filename of buildFiles) {
  const source = await readFile(filename, "utf8");
  assert.doesNotMatch(source, providerIdentity, `built client provider identity leaked in ${path.relative(root, filename)}`);
  assert.doesNotMatch(source, secretIdentifier, `built client server-only authority leaked in ${path.relative(root, filename)}`);
}

console.log(`CLIENT_SOURCE_PROVIDER_SECRET_SCAN=PASS_${sourceFiles.length}`);
console.log(`CLIENT_BUILD_PROVIDER_SECRET_SCAN=${process.argv.includes("--include-build") ? `PASS_${buildFiles.length}` : "DEFERRED_UNTIL_BUILD"}`);

