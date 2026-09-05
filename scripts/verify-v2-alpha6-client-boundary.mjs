import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = [
  "components/v2-alpha6/V2Alpha6ManuscriptWorkspace.tsx",
  "components/v2-alpha6/v2-alpha6.module.css",
  "app/v2-alpha6-local/page.tsx",
  "lib/v2-alpha6/page-authority.ts",
];
const forbidden = /OPENCLAW|CODEX|CHAT_COMPLETIONS|\bGPT\b|ZEEBUR|\/v1\/|api[_-]?key|bearer\s|password|secret|model[_-]?id/iu;
for (const relative of sources) assert.doesNotMatch(await readFile(path.join(root, relative), "utf8"), forbidden, `client boundary ${relative}`);
if (process.argv.includes("--include-build")) {
  const stack = [path.join(root, ".next", "static")];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const item = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(item);
      else if (/\.(?:js|css)$/u.test(entry.name)) assert.doesNotMatch(await readFile(item, "utf8"), /OPENCLAW_GATEWAY_TOKEN|OPENCLAW_BASE_URL|\/v1\/chat\/completions|api[_-]?key\s*[:=]/iu, `built client boundary ${entry.name}`);
    }
  }
}
console.log(JSON.stringify({ status: "PASS", clientFiles: sources.length, buildScanned: process.argv.includes("--include-build"), secretOrProviderIdentityLeaks: 0, publicBranding: "老麥" }));
