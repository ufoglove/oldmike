import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(portalRoot, "..");
const sourceExtensions = ["", ".ts", ".tsx", ".mjs", ".js", ".json", ".css"];
const sourceKinds = new Set([".ts", ".tsx", ".mjs", ".js", ".css"]);
const seeds = Object.freeze([
  "OLD_MIKE_RESEARCH_OS_V2_BETA1_IMPLEMENTATION_BRIEF.md",
  "beta1-uat-tooling/beta1-local-functional.descriptor.json",
  "beta1-uat-tooling/beta1-local-functional.mjs",
  "beta1-uat-tooling/beta1-production-behavior.descriptor.json",
  "beta1-uat-tooling/beta1-production-behavior.mjs",
  "research-portal/app/api/v2-beta1/project/route.ts",
  "research-portal/app/research-os-local/page.tsx",
  "research-portal/components/v2-beta1/V2Beta1ResearchOS.tsx",
  "research-portal/components/v2-beta1/v2-beta1.module.css",
  "research-portal/lib/v2-beta1/auth.ts",
  "research-portal/lib/v2-beta1/client-contract.ts",
  "research-portal/lib/v2-beta1/contracts.ts",
  "research-portal/lib/v2-beta1/page-authority.ts",
  "research-portal/lib/v2-beta1/route-handlers.ts",
  "research-portal/lib/v2-beta1/runtime.ts",
  "research-portal/next.config.ts",
  "research-portal/package.json",
  "research-portal/pnpm-lock.yaml",
  "research-portal/scripts/disposable-server-only-loader.mjs",
  "research-portal/scripts/v2-beta1-browser-entry.mjs",
  "research-portal/scripts/verify-v2-beta1-artifact-closure.mjs",
  "research-portal/scripts/verify-v2-beta1-browser.mjs",
  "research-portal/scripts/verify-v2-beta1-client-boundary.mjs",
  "research-portal/scripts/verify-v2-beta1-consumer-contracts.mjs",
  "research-portal/scripts/verify-v2-beta1-contracts.mjs",
  "research-portal/scripts/verify-v2-beta1-focused-closure-handoff.mjs",
  "research-portal/scripts/verify-v2-beta1-integration-contracts.mjs",
  "research-portal/scripts/verify-v2-beta1-production-boundary.mjs",
  "research-portal/tsconfig.json"
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function workspaceRelative(absolute) {
  const resolved = path.resolve(absolute);
  const relative = path.relative(workspaceRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("beta1_closure_out_of_root");
  return relative.replaceAll("\\", "/");
}

async function fileExists(candidate) {
  return stat(candidate).then((info) => info.isFile(), () => false);
}

async function resolveLocalImport(importer, specifier) {
  const normalized = specifier.split(/[?#]/u, 1)[0];
  let base;
  if (normalized.startsWith("@/")) base = path.join(portalRoot, normalized.slice(2));
  else if (normalized.startsWith(".")) base = path.resolve(path.dirname(importer), normalized);
  else return null;
  const root = path.resolve(base);
  if (root !== workspaceRoot && !root.toLowerCase().startsWith(`${workspaceRoot.toLowerCase()}${path.sep}`)) throw new Error("beta1_closure_out_of_root_import");
  for (const extension of sourceExtensions) {
    const candidate = `${base}${extension}`;
    if (await fileExists(candidate)) return path.resolve(candidate);
  }
  for (const extension of sourceExtensions.slice(1)) {
    const candidate = path.join(base, `index${extension}`);
    if (await fileExists(candidate)) return path.resolve(candidate);
  }
  throw new Error(`beta1_closure_unresolved_local_import:${workspaceRelative(importer)}`);
}

function staticSpecifiers(source) {
  const values = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
    /@import\s+(?:url\()?\s*["']([^"']+)["']/gu,
  ];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) values.push(match[1]);
  return values;
}

export async function collectV2Beta1ArtifactClosure() {
  assert.equal(new Set(seeds).size, seeds.length, "duplicate_seed");
  const pending = [...seeds.map((relative) => path.resolve(workspaceRoot, relative))];
  const visited = new Set();
  const externalPackages = new Set();
  while (pending.length) {
    const absolute = pending.pop();
    const relative = workspaceRelative(absolute);
    if (visited.has(relative)) continue;
    if (!await fileExists(absolute)) throw new Error(`beta1_closure_missing_seed_or_dependency:${relative}`);
    visited.add(relative);
    if (!sourceKinds.has(path.extname(absolute).toLowerCase())) continue;
    const source = await readFile(absolute, "utf8");
    for (const specifier of staticSpecifiers(source)) {
      const local = await resolveLocalImport(absolute, specifier);
      if (local) pending.push(local);
      else if (!specifier.startsWith("node:")) externalPackages.add(specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0]);
    }
  }
  const paths = [...visited].sort();
  const entries = await Promise.all(paths.map(async (relative) => {
    const bytes = await readFile(path.join(workspaceRoot, relative));
    return { path: relative, size: bytes.byteLength, sha256: sha256(bytes) };
  }));
  const aggregateSha256 = sha256(entries.map((entry) => `${entry.path}\0${entry.size}\0${entry.sha256}\n`).join(""));
  return { contractVersion: "old-mike-v2-beta1-artifact-closure/1", cardinality: entries.length, aggregateSha256, entries, externalPackages: [...externalPackages].sort() };
}

async function verifyExpected(manifestPath) {
  const manifestAbsolute = path.resolve(workspaceRoot, manifestPath);
  workspaceRelative(manifestAbsolute);
  const manifest = JSON.parse(await readFile(manifestAbsolute, "utf8"));
  const expected = manifest.artifactClosure;
  const actual = await collectV2Beta1ArtifactClosure();
  assert.equal(expected?.contractVersion, actual.contractVersion);
  assert.equal(expected?.cardinality, actual.cardinality);
  assert.equal(expected?.aggregateSha256, actual.aggregateSha256);
  assert.deepEqual(expected?.entries, actual.entries);
  assert.deepEqual(expected?.externalPackages, actual.externalPackages);
  return actual;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const manifestArgument = process.argv[2];
  const closure = manifestArgument ? await verifyExpected(manifestArgument) : await collectV2Beta1ArtifactClosure();
  console.log(JSON.stringify({ status: "PASS", ...closure }));
}
