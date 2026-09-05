import { access, lstat, readFile, realpath } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

export const RESEARCH_ROUTE_SOURCE = "app/api/projects/[projectId]/research/route.ts";
export const RESEARCH_ROUTE_MANIFEST_KEY = "/api/projects/[projectId]/research/route";
export const RESEARCH_ROUTE_PATHNAME = "/api/projects/[projectId]/research";
export const RESEARCH_UI_RUNTIME_MARKER = "old-mike-research-workflow-runtime-v1.5.6";
export const REVIEW_STUDIO_UI_RUNTIME_MARKERS = Object.freeze(["m03-studio", "m04-studio", "期刊投稿工作室"]);

const RUNTIME_MARKERS = Object.freeze({
  RESEARCH_CONTRACT_RUNTIME_CLOSURE: ["S9_ARCHIVED", "human_gate_hash_binding_invalid"],
  RESEARCH_ANALYSIS_RUNTIME_CLOSURE: ["old-mike-deterministic-stats", "DESCRIPTIVE_STATISTICS", "analysis_input_binding_failed"],
  RESEARCH_REPOSITORY_RUNTIME_CLOSURE: ["research_schema_unavailable", "analysis_binding_required", "research_workflow_events"],
});

const MAX_RUNTIME_CHUNK_CLOSURE = 256;

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJson(file) {
  const parsed = JSON.parse(await readFile(file, "utf8"));
  if (!isPlainObject(parsed)) throw new Error("RESULT_SHAPE");
  return parsed;
}

async function regularContainedFile(root, file) {
  const rootReal = await realpath(root);
  const info = await lstat(file);
  const fileReal = await realpath(file);
  return info.isFile() && !info.isSymbolicLink() && isInside(rootReal, fileReal);
}

function referencedWebpackChunkIds(source) {
  const identifiers = new Set();
  for (const match of source.matchAll(/\.X\(\d+,\[([\d,\s]+)\]/g)) {
    for (const token of match[1].split(",")) {
      const identifier = token.trim();
      if (/^\d+$/.test(identifier)) identifiers.add(identifier);
    }
  }
  return [...identifiers];
}

async function readRouteDependencyClosure(serverRoot, entrySource) {
  const sources = [entrySource];
  const pending = referencedWebpackChunkIds(entrySource);
  const visited = new Set();
  while (pending.length > 0) {
    const identifier = pending.shift();
    if (visited.has(identifier)) continue;
    if (visited.size >= MAX_RUNTIME_CHUNK_CLOSURE) throw new Error("RUNTIME_CHUNK_CLOSURE_LIMIT");
    visited.add(identifier);
    const chunkFile = path.join(serverRoot, "chunks", `${identifier}.js`);
    if (!await regularContainedFile(serverRoot, chunkFile).catch(() => false)) {
      throw new Error("RUNTIME_CHUNK_MISSING");
    }
    const source = await readFile(chunkFile, "utf8");
    sources.push(source);
    for (const nested of referencedWebpackChunkIds(source)) {
      if (!visited.has(nested)) pending.push(nested);
    }
  }
  return sources.join("\n");
}

export async function verifySourceResearchContract(sourceRoot) {
  const route = path.join(sourceRoot, ...RESEARCH_ROUTE_SOURCE.split("/"));
  const info = await lstat(route).catch(() => null);
  return {
    SOURCE_RESEARCH_ROUTE_PRESENT: Boolean(info?.isFile()),
    SOURCE_RESEARCH_ROUTE_NOT_SYMLINK: Boolean(info && !info.isSymbolicLink()),
  };
}

export async function verifyCompiledResearchRuntime(runtimeRoot) {
  const nextRoot = path.join(runtimeRoot, ".next");
  const serverRoot = path.join(nextRoot, "server");
  const appPathsFile = path.join(serverRoot, "app-paths-manifest.json");
  const routesFile = path.join(nextRoot, "routes-manifest.json");
  const serverFile = path.join(runtimeRoot, "server.js");
  const checks = {
    STANDALONE_SERVER_PRESENT: false,
    COMPILED_ROUTE_MANIFEST_GATE: false,
    COMPILED_ROUTE_BUNDLE_PRESENT: false,
    COMPILED_ROUTE_BUNDLE_NODE_CHECK: false,
    COMPILED_ROUTE_DEPENDENCY_CLOSURE: false,
    RESEARCH_ROUTE_REGISTERED: false,
    RESEARCH_CONTRACT_RUNTIME_CLOSURE: false,
    RESEARCH_ANALYSIS_RUNTIME_CLOSURE: false,
    RESEARCH_REPOSITORY_RUNTIME_CLOSURE: false,
    RESEARCH_WORKFLOW_UI_BUNDLE: false,
    STANDALONE_SOURCE_ROUTE_ABSENCE_ALLOWED: false,
  };

  checks.STANDALONE_SERVER_PRESENT = await regularContainedFile(runtimeRoot, serverFile).catch(() => false);
  const appPaths = await readJson(appPathsFile).catch(() => null);
  const mapped = appPaths?.[RESEARCH_ROUTE_MANIFEST_KEY];
  const safeMapping = typeof mapped === "string" && mapped.length > 0 &&
    !mapped.includes("\\") && !path.posix.isAbsolute(mapped) &&
    mapped.split("/").every((segment) => segment && segment !== "." && segment !== "..");
  checks.COMPILED_ROUTE_MANIFEST_GATE = Boolean(safeMapping);

  let bundle = "";
  let dependencyClosure = "";
  if (safeMapping) {
    const bundleFile = path.join(serverRoot, ...mapped.split("/"));
    checks.COMPILED_ROUTE_BUNDLE_PRESENT = await regularContainedFile(serverRoot, bundleFile).catch(() => false);
    if (checks.COMPILED_ROUTE_BUNDLE_PRESENT) {
      checks.COMPILED_ROUTE_BUNDLE_NODE_CHECK = spawnSync(process.execPath, ["--check", bundleFile], {
        stdio: "ignore",
        windowsHide: true,
        timeout: 15_000,
      }).status === 0;
      bundle = await readFile(bundleFile, "utf8");
      dependencyClosure = await readRouteDependencyClosure(serverRoot, bundle).catch(() => "");
      checks.COMPILED_ROUTE_DEPENDENCY_CLOSURE = dependencyClosure.length > 0;
    }
  }

  const routes = await readJson(routesFile).catch(() => null);
  checks.RESEARCH_ROUTE_REGISTERED = Array.isArray(routes?.dynamicRoutes) && routes.dynamicRoutes.some((route) =>
    isPlainObject(route) && route.page === RESEARCH_ROUTE_PATHNAME && typeof route.regex === "string" && route.regex.includes("research"),
  );

  for (const [name, markers] of Object.entries(RUNTIME_MARKERS)) {
    checks[name] = dependencyClosure.length > 0 && markers.every((marker) => dependencyClosure.includes(marker));
  }

  const staticRoot = path.join(nextRoot, "static", "chunks");
  // Next 16 standalone output uses build-manifest.json for client chunks. The
  // contract deliberately follows the generated artifact instead of assuming
  // an older app-build-manifest filename.
  const staticManifest = path.join(nextRoot, "build-manifest.json");
  const staticFiles = await collectJavaScript(staticRoot).catch(() => []);
  const staticClosure = (await Promise.all(staticFiles.map((file) => readFile(file, "utf8").catch(() => "")))).join("\n");
  checks.RESEARCH_WORKFLOW_UI_BUNDLE = await access(staticManifest).then(() => true, () => false) &&
    staticClosure.includes(RESEARCH_UI_RUNTIME_MARKER) &&
    REVIEW_STUDIO_UI_RUNTIME_MARKERS.every((marker) => staticClosure.includes(marker));

  const standaloneSource = path.join(runtimeRoot, ...RESEARCH_ROUTE_SOURCE.split("/"));
  checks.STANDALONE_SOURCE_ROUTE_ABSENCE_ALLOWED = await access(standaloneSource).then(() => false, () => true);
  return checks;
}

async function collectJavaScript(directory) {
  const { readdir } = await import("node:fs/promises");
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectJavaScript(absolute));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(absolute);
  }
  return files;
}

export function evaluateResearchHttpResponse(status, code) {
  return status === 401 && code === "unauthorized";
}

export function runtimeContractPass(checks) {
  return Object.values(checks).every(Boolean);
}
