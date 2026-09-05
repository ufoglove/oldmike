import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { assertProductCopyTreeAuthority, collectProductCopyTree } from "../../alpha4-uat-tooling/lib/product-copy-tree-authority.mjs";

const exclusions = [".next", "node_modules", "playwright-report", "test-results", "logs", "screenshots", "runtime-artifact"];
const root = await mkdtemp(path.join(os.tmpdir(), "old-mike-beta1-tree-"));
const cases = [];
const gate = async (name, callback) => { await callback(); cases.push(name); };

try {
  await mkdir(path.join(root, "app"), { recursive: true });
  await mkdir(path.join(root, ".next"), { recursive: true });
  await mkdir(path.join(root, "screenshots"), { recursive: true });
  await writeFile(path.join(root, "app", "layout.tsx"), "export default function Layout(){return null}\n", "utf8");
  await writeFile(path.join(root, "app", "globals.css"), ":root{color:#123}\n", "utf8");
  await writeFile(path.join(root, "package.json"), "{}\n", "utf8");
  await writeFile(path.join(root, ".env"), "SECRET=fixture-never-retained\n", "utf8");
  await writeFile(path.join(root, ".env.example"), "NAME=example\n", "utf8");
  await writeFile(path.join(root, "owner.credential.json"), "{}\n", "utf8");
  await writeFile(path.join(root, ".next", "cache.bin"), "generated", "utf8");
  await writeFile(path.join(root, "screenshots", "screen.png"), "generated", "utf8");
  const authority = await collectProductCopyTree(root, exclusions);

  await gate("EXACT_TREE_BASELINE", async () => {
    assert.deepEqual(authority.entries.map((entry) => entry.path), [".env.example", "app/globals.css", "app/layout.tsx", "package.json"]);
    await assertProductCopyTreeAuthority(root, exclusions, authority);
  });
  await gate("TAMPER_REJECTED", async () => {
    await writeFile(path.join(root, "app", "layout.tsx"), "export default function Layout(){return 'tampered'}\n", "utf8");
    await assert.rejects(assertProductCopyTreeAuthority(root, exclusions, authority), /PRODUCT_TREE_AUTHORITY_MISMATCH/u);
    await writeFile(path.join(root, "app", "layout.tsx"), "export default function Layout(){return null}\n", "utf8");
  });
  await gate("MISSING_REJECTED", async () => {
    await unlink(path.join(root, "app", "globals.css"));
    await assert.rejects(assertProductCopyTreeAuthority(root, exclusions, authority), /PRODUCT_TREE_AUTHORITY_MISMATCH/u);
    await writeFile(path.join(root, "app", "globals.css"), ":root{color:#123}\n", "utf8");
  });
  await gate("EXTRA_REJECTED", async () => {
    await writeFile(path.join(root, "app", "unexpected.ts"), "export const unexpected=true\n", "utf8");
    await assert.rejects(assertProductCopyTreeAuthority(root, exclusions, authority), /PRODUCT_TREE_AUTHORITY_MISMATCH/u);
    await unlink(path.join(root, "app", "unexpected.ts"));
  });
  await gate("SECRET_AND_GENERATED_EXCLUSION", async () => {
    const current = await collectProductCopyTree(root, exclusions);
    assert.equal(current.entries.some((entry) => entry.path === ".env" || entry.path.includes("credential") || entry.path.startsWith(".next/") || entry.path.startsWith("screenshots/")), false);
    assert.equal(current.aggregateSha256, authority.aggregateSha256);
  });
  console.log(JSON.stringify({ status: "PASS", cases: cases.length, caseNames: cases, authorityFiles: authority.fileCount, secretFilesRetained: 0 }));
} finally {
  await rm(root, { recursive: true, force: true });
}
