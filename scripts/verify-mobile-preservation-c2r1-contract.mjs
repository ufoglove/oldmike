import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await readFile(path.join(root, "contracts", "c2-mobile-preservation.json"), "utf8"));
assert.deepEqual(Object.keys(contract).sort(), ["contractVersion", "files", "sourceArtifactClass", "sourceArtifactSha256"]);
assert.equal(contract.contractVersion, "old-mike.c2-mobile-preservation.v1");
assert.equal(contract.sourceArtifactClass, "IMMUTABLE_C2_PORTAL_ARCHIVE");
assert.match(contract.sourceArtifactSha256, /^[a-f0-9]{64}$/u);
assert.deepEqual(Object.keys(contract.files).sort(), [
  "app/globals.css",
  "app/layout.tsx",
  "components/GuidedResearchCenter.tsx",
  "scripts/verify-mobile-overlay-c2-browser.mjs",
]);
for (const [relative, expected] of Object.entries(contract.files)) {
  assert.match(expected, /^[a-f0-9]{64}$/u);
  const bytes = await readFile(path.join(root, ...relative.split("/")));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, `C2 mobile file changed: ${relative}`);
}

console.log("C2_MOBILE_SOURCE_BYTES_PRESERVED=PASS_4");
console.log("C2_MOBILE_OVERLAY_FIXES=UNCHANGED");

