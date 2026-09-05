import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await readFile(path.join(root, "contracts", "c2r4-br3-mobile-preservation.json"), "utf8"));
assert.deepEqual(Object.keys(contract).sort(), ["contractVersion", "files", "sourceArtifactClass", "sourceArtifactSha256"]);
assert.equal(contract.contractVersion, "old-mike.c2r4-br3-mobile-preservation.v1");
assert.equal(contract.sourceArtifactClass, "IMMUTABLE_C2R4_BR2_PORTAL_ARCHIVE");
assert.equal(contract.sourceArtifactSha256, "95cf65dae2a206ffe3fe94b4980e0c6afdf00619c610c272c045819865c8fa6a");
assert.deepEqual(Object.keys(contract.files).sort(), [
  "app/globals.css",
  "app/layout.tsx",
  "components/GuidedResearchCenter.tsx",
  "scripts/verify-mobile-overlay-c2-browser.mjs",
]);
for (const [relative, expected] of Object.entries(contract.files)) {
  assert.match(expected, /^[a-f0-9]{64}$/u);
  const bytes = await readFile(path.join(root, ...relative.split("/")));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, `BR2 mobile file changed: ${relative}`);
}
console.log("C2R4_BR3_MOBILE_PRESERVATION=PASS_BR2_BYTES_4");

