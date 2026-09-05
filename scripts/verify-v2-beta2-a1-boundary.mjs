import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["lib/v2-beta2", "components/v2-beta2", "app/v2-beta2", "app/api/v2-beta2", "database/proposals"];
const sourceFiles = [];
for (const relativeRoot of sourceRoots) {
  const stack = [path.join(root, relativeRoot)];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const item = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(item);
      else if (/\.(?:ts|tsx|mjs|sql|json)$/u.test(entry.name)) sourceFiles.push(item);
    }
  }
}
for (const relative of ["e2e/v2-beta2-durable-core.spec.ts", "e2e/v2-beta2-product-acceptance.spec.ts", "playwright.beta2.config.ts", "product-acceptance/v2-beta2-product-acceptance.contract.json", "product-acceptance/v2-beta2-product-acceptance.vectors.json", "product-acceptance/V2_BETA2_PROFESSOR_PLAYBOOK.md", "scripts/verify-v2-beta2-durable-core-contracts.mjs", "scripts/verify-v2-beta2-durable-core-postgres.mjs", "scripts/verify-v2-beta2-route-contracts.mjs", "scripts/verify-v2-beta2-product-acceptance.mjs", "scripts/v2-beta2-route-test-loader.mjs", "scripts/run-v2-beta2-a1-postgres18-disposable.ps1", "scripts/run-v2-beta2-a1-browser-disposable.ps1", "scripts/run-v2-beta2-product-acceptance.mjs", "scripts/run-v2-beta2-product-acceptance.ps1", "scripts/setup-v2-beta2-a1-c1-browser-fixture.mjs", "lib/v2-beta2/C19_DURABLE_TRANSPORT_BOUNDARY.md"]) sourceFiles.push(path.join(root, relative));

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)?:?\/\/[^\s:'"]+:[^\s@'"]+@/iu,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|authorization)\b\s*[:=]\s*["'][A-Za-z0-9+/_=-]{20,}["']/iu,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/u,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
];
let sourceBytes = 0;
for (const file of [...new Set(sourceFiles)].sort()) {
  const source = await readFile(file, "utf8");
  sourceBytes += Buffer.byteLength(source, "utf8");
  for (const pattern of secretPatterns) assert.doesNotMatch(source, pattern, `Beta2 A1 secret value boundary ${path.relative(root, file)}`);
}

const clientSources = ["components/v2-beta2/V2Beta2ResearchOS.tsx", "lib/v2-beta2/client-transport.ts", "lib/v2-beta2/product-acceptance.ts", "app/v2-beta2/projects/[projectId]/page.tsx"];
const forbiddenIdentity = /OPENCLAW|CODEX|CHAT_COMPLETIONS|\bGPT\b|ZEEBUR|DEEPSEEK|\bNEON\b|\bN8N\b|\/v1\/(?:chat\/completions|responses)/iu;
const forbiddenClientSecret = /(?:api[_-]?key|password|secret|token)\s*[:=]\s*["'][A-Za-z0-9._~+/-]{20,}["']|bearer\s+[A-Za-z0-9._~+/-]{20,}/iu;
const withoutStableAcceptanceControlId = (source) => source.replace(/loginPassword\s*:\s*["']v2-beta2-login-password["']/gu, "STABLE_NONSECRET_ACCEPTANCE_CONTROL_ID");
for (const relative of clientSources) {
  const source = await readFile(path.join(root, relative), "utf8");
  assert.doesNotMatch(source, forbiddenIdentity, `Beta2 client provider identity boundary ${relative}`);
  assert.doesNotMatch(withoutStableAcceptanceControlId(source), forbiddenClientSecret, `Beta2 client secret boundary ${relative}`);
}

let builtFiles = 0;
let builtBytes = 0;
const builtLeafHashes = [];
if (process.argv.includes("--include-build")) {
  const stack = [path.join(root, ".next", "static")];
  const leaves = [];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const item = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(item);
      else if (/\.(?:js|css)$/u.test(entry.name)) leaves.push(item);
    }
  }
  leaves.sort((left, right) => path.relative(root, left) < path.relative(root, right) ? -1 : path.relative(root, left) > path.relative(root, right) ? 1 : 0);
  for (const file of leaves) {
    const bytes = await readFile(file);
    const source = bytes.toString("utf8");
    assert.doesNotMatch(source, forbiddenIdentity, `built-client provider identity boundary ${path.relative(root, file)}`);
    assert.doesNotMatch(withoutStableAcceptanceControlId(source), forbiddenClientSecret, `built-client secret boundary ${path.relative(root, file)}`);
    builtFiles += 1;
    builtBytes += bytes.length;
    builtLeafHashes.push(`${path.relative(root, file).replaceAll("\\", "/")}\0${bytes.length}\0${createHash("sha256").update(bytes).digest("hex")}\n`);
  }
  assert.ok(builtFiles > 0, "built client files required");
}

console.log(JSON.stringify({ status: "PASS", sourceFiles: new Set(sourceFiles).size, sourceBytes, secretValuesFound: 0, clientProviderIdentityMatches: 0, clientSecretMatches: 0, builtFiles, builtBytes, builtTreeSha256: builtFiles ? createHash("sha256").update(builtLeafHashes.join(""), "utf8").digest("hex") : null }));
