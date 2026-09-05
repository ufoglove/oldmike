import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = ["components/v2-alpha5/V2Alpha5ProposalWorkspace.tsx", "components/v2-alpha5/v2-alpha5.module.css"];
const forbidden = /OPENCLAW|CHAT_COMPLETIONS|\/v1\/|api[_-]?key|bearer\s|password|secret|providerSubmissionCount\s*[:=]\s*["'`]|model[_-]?id/iu;
for (const relative of sources) assert.doesNotMatch(await readFile(path.join(root, relative), "utf8"), forbidden, `client boundary ${relative}`);
const buildRoot = path.join(root, ".next", "static");
if (process.argv.includes("--include-build")) {
  const stack = [buildRoot];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const item = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(item);
      else if (/\.(?:js|css)$/u.test(entry.name)) assert.doesNotMatch(await readFile(item, "utf8"), /OPENCLAW_GATEWAY_TOKEN|OPENCLAW_BASE_URL|\/v1\/chat\/completions|api[_-]?key\s*[:=]/iu, `built client boundary ${entry.name}`);
    }
  }
}
console.log(JSON.stringify({ status: "PASS", clientFiles: sources.length, buildScanned: process.argv.includes("--include-build"), secretOrProviderIdentityLeaks: 0 }));
