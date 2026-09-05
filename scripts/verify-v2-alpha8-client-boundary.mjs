import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = [
  "components/v2-alpha8/V2Alpha8PartialDraftWorkspace.tsx",
  "components/v2-alpha8/v2-alpha8.module.css",
  "app/v2-alpha8-local/page.tsx",
  "lib/v2-alpha8/page-authority.ts",
];
const forbiddenIdentity = /OPENCLAW|CODEX|CHAT_COMPLETIONS|\bGPT\b|ZEEBUR|DEEPSEEK|\/v1\/|semantic[_-]?scholar[_-]?api[_-]?key/iu;
const forbiddenSecret = /api[_-]?key\s*[:=]|bearer\s+[A-Za-z0-9._-]+|password\s*[:=]|secret\s*[:=]|token\s*[:=]/iu;
for (const relative of sources) {
  const source = await readFile(path.join(root, relative), "utf8");
  assert.doesNotMatch(source, forbiddenIdentity, `provider identity boundary ${relative}`);
  assert.doesNotMatch(source, forbiddenSecret, `secret boundary ${relative}`);
}
const component = await readFile(path.join(root, sources[0]), "utf8");
assert.match(component, /老麥/u);
assert.match(component, /原始材料不覆寫/u);
assert.match(component, /正式交接將於整合版啟用/u);

if (process.argv.includes("--include-build")) {
  const stack = [path.join(root, ".next", "static")];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const item = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(item);
      else if (/\.(?:js|css)$/u.test(entry.name)) {
        const source = await readFile(item, "utf8");
        assert.doesNotMatch(source, /OPENCLAW_GATEWAY_TOKEN|OPENCLAW_BASE_URL|\/v1\/chat\/completions|api[_-]?key\s*[:=]/iu, `built client boundary ${entry.name}`);
      }
    }
  }
}

console.log(JSON.stringify({ status: "PASS", clientFiles: sources.length, buildScanned: process.argv.includes("--include-build"), providerIdentityLeaks: 0, secretLeaks: 0, publicBranding: "老麥" }));
