import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = [
  "components/v2-beta1/V2Beta1ResearchOS.tsx",
  "components/v2-beta1/v2-beta1.module.css",
  "app/research-os-local/page.tsx",
];
const forbiddenIdentity = /OPENCLAW|CODEX|CHAT_COMPLETIONS|\bGPT\b|ZEEBUR|DEEPSEEK|\/v1\/(?:chat\/completions|responses)/iu;
const forbiddenSecret = /api[_-]?key\s*[:=]|bearer\s+[A-Za-z0-9._-]+|password\s*[:=]|secret\s*[:=]|token\s*[:=]/iu;
for (const relative of sources) {
  const source = await readFile(path.join(root, relative), "utf8");
  assert.doesNotMatch(source, forbiddenIdentity, `provider identity boundary ${relative}`);
  assert.doesNotMatch(source, forbiddenSecret, `secret boundary ${relative}`);
}
const component = await readFile(path.join(root, sources[0]), "utf8");
for (const label of ["開始研究", "證據與文獻", "設計與分析", "論文", "臺灣計畫", "終稿與投稿", "老麥", "匯入目前專案"]) assert.match(component, new RegExp(label, "u"));
assert.doesNotMatch(component, /localStorage|sessionStorage|dangerouslySetInnerHTML/u);
assert.match(component, /aria-live="polite"/u);
assert.match(component, /正式寫入 0/u);

let builtFiles = 0;
if (process.argv.includes("--include-build")) {
  const stack = [path.join(root, ".next", "static")];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const item = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(item);
      else if (/\.(?:js|css)$/u.test(entry.name)) {
        builtFiles += 1;
        const source = await readFile(item, "utf8");
        assert.doesNotMatch(source, /OPENCLAW_GATEWAY_TOKEN|OPENCLAW_BASE_URL|\/v1\/(?:chat\/completions|responses)|api[_-]?key\s*[:=]/iu, `built client boundary ${entry.name}`);
      }
    }
  }
  assert.ok(builtFiles > 0);
}
console.log(JSON.stringify({ status: "PASS", clientFiles: sources.length, publicBranding: "老麥", publicNavItems: 6, secretLeaks: 0, providerIdentityLeaks: 0, localResearchStorage: 0, builtFiles }));
