import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["lib/v2-beta1", "components/v2-beta1", "app/research-os-local", "app/api/v2-beta1", "scripts"];
const files = [];
for (const relativeRoot of roots) {
  const absolute = path.join(root, relativeRoot);
  const stack = [absolute];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const item = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(item);
      else if (/\.(?:ts|tsx|mjs|css|json)$/u.test(entry.name) && (relativeRoot !== "scripts" || /v2-beta1/iu.test(entry.name))) files.push(item);
    }
  }
}
for (const fixed of ["package.json", "pnpm-lock.yaml"]) files.push(path.join(root, fixed));
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)?:?\/\/[^\s:'"]+:[^\s@'"]+@/iu,
  /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|authorization)\b\s*[:=]\s*["'][A-Za-z0-9+/_=-]{20,}["']/iu,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}/u,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u,
];
let scannedBytes = 0;
for (const file of [...new Set(files)].sort()) {
  const source = await readFile(file, "utf8");
  scannedBytes += Buffer.byteLength(source, "utf8");
  for (const pattern of patterns) assert.doesNotMatch(source, pattern, `secret content boundary ${path.relative(root, file)}`);
}
console.log(JSON.stringify({ status: "PASS", scannedFiles: new Set(files).size, scannedBytes, contentPatterns: patterns.length, secretValuesFound: 0, scanClass: "BOUNDED_ACTIVE_BETA1_CONTENT_SCAN" }));
