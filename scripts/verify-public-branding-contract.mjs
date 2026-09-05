import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = /OpenClaw|Codex|Old Mike|OPENCLAW|Better Auth|OpenAI|ChatGPT|Anthropic|Claude|Gemini|DeepSeek|gpt-[a-z0-9.-]+/i;
const forbiddenClientSecret = /OPENCLAW_GATEWAY_TOKEN|OLD_MIKE_RESPONSES_API_KEY|DATABASE_URL|POSTGRES_PASSWORD|PRIVATE_KEY/;
const includeBuild = process.argv.includes("--include-build");

async function filesUnder(path) {
  const found = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) found.push(...await filesUnder(full));
    else found.push(full);
  }
  return found;
}

const publicUi = [
  ...await filesUnder(resolve(root, "components")),
  resolve(root, "app/layout.tsx"),
  resolve(root, "app/login/page.tsx"),
].filter((path) => [".ts", ".tsx"].includes(extname(path)));

for (const path of publicUi) {
  const source = await readFile(path, "utf8");
  assert.doesNotMatch(source, forbidden, `public branding leak: ${path}`);
  assert.doesNotMatch(source, forbiddenClientSecret, `public client secret reference: ${path}`);
}

const apiFiles = (await filesUnder(resolve(root, "app/api"))).filter((path) => [".ts", ".tsx"].includes(extname(path)));
for (const path of apiFiles) {
  const source = await readFile(path, "utf8");
  for (const line of source.split(/\r?\n/)) {
    if (!forbidden.test(line)) continue;
    if (/^\s*(import|\/\/)/.test(line) || /callOpenClaw|OpenClawCallResult|process\.env\.OPENCLAW/.test(line)) continue;
    assert.fail(`public API branding leak: ${path}`);
  }
}

const staticRoot = resolve(root, ".next/static");
if (includeBuild && await stat(staticRoot).then(() => true).catch(() => false)) {
  for (const path of (await filesUnder(staticRoot)).filter((item) => extname(item) === ".js")) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, forbidden, `client bundle branding leak: ${path}`);
    assert.doesNotMatch(source, forbiddenClientSecret, `client bundle secret reference: ${path}`);
  }
}

const guided = await readFile(resolve(root, "components/GuidedResearchCenter.tsx"), "utf8");
assert.match(guided, /老麥/);
assert.match(guided, /AI_PROPOSED/);
assert.match(guided, /老麥建議・尚未驗證/);
assert.match(guided, /老麥概念模式/);
assert.doesNotMatch(guided, />AI_PROPOSED<|AI_PROPOSED 建議|每個 AI 建議/);
console.log("PUBLIC_UI_BRANDING_SCAN=PASS");
console.log("PUBLIC_API_ERROR_BRANDING_SCAN=PASS");
console.log(`CLIENT_BUNDLE_BRANDING_SCAN=${includeBuild ? "PASS" : "DEFERRED_UNTIL_BUILD"}`);
console.log("RESEARCH_AI_SEMANTICS_PRESERVED=PASS");
