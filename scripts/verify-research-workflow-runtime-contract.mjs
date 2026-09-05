import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  evaluateResearchHttpResponse,
  RESEARCH_ROUTE_MANIFEST_KEY,
  RESEARCH_ROUTE_PATHNAME,
  RESEARCH_ROUTE_SOURCE,
  RESEARCH_UI_RUNTIME_MARKER,
  REVIEW_STUDIO_UI_RUNTIME_MARKERS,
  runtimeContractPass,
  verifyCompiledResearchRuntime,
  verifySourceResearchContract,
} from "./research-runtime-contract.mjs";

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "oldmike-v154-runtime-contract-"));
const sourceRoot = path.join(temporaryRoot, "source");
const runtimeRoot = path.join(temporaryRoot, "runtime");
const mappedRoute = "app/api/projects/[projectId]/research/route.js";
const routeFile = path.join(runtimeRoot, ".next", "server", ...mappedRoute.split("/"));
const splitChunkFile = path.join(runtimeRoot, ".next", "server", "chunks", "9132.js");

async function writeFixture() {
  await mkdir(path.join(sourceRoot, ...path.dirname(RESEARCH_ROUTE_SOURCE).split("/")), { recursive: true });
  await writeFile(path.join(sourceRoot, ...RESEARCH_ROUTE_SOURCE.split("/")), "export const GET = () => null;\n", "utf8");
  await mkdir(path.dirname(routeFile), { recursive: true });
  await mkdir(path.dirname(splitChunkFile), { recursive: true });
  await mkdir(path.join(runtimeRoot, ".next", "static", "chunks"), { recursive: true });
  await writeFile(path.join(runtimeRoot, "server.js"), "'use strict';\n", "utf8");
  await writeFile(path.join(runtimeRoot, ".next", "server", "app-paths-manifest.json"), JSON.stringify({ [RESEARCH_ROUTE_MANIFEST_KEY]: mappedRoute }), "utf8");
  await writeFile(path.join(runtimeRoot, ".next", "routes-manifest.json"), JSON.stringify({ dynamicRoutes: [{ page: RESEARCH_ROUTE_PATHNAME, regex: "^/api/projects/([^/]+?)/research(?:/)?$" }] }), "utf8");
  await writeFile(path.join(runtimeRoot, ".next", "build-manifest.json"), "{}", "utf8");
  await writeFile(routeFile, "'use strict'; const markers=['S9_ARCHIVED','human_gate_hash_binding_invalid','old-mike-deterministic-stats','DESCRIPTIVE_STATISTICS','analysis_input_binding_failed','research_schema_unavailable','analysis_binding_required','research_workflow_events'];\n", "utf8");
  await writeFile(
    path.join(runtimeRoot, ".next", "static", "chunks", "research.js"),
    `const markers=${JSON.stringify([RESEARCH_UI_RUNTIME_MARKER, REVIEW_STUDIO_UI_RUNTIME_MARKERS[0]])};\n`,
    "utf8",
  );
  await writeFile(
    path.join(runtimeRoot, ".next", "static", "chunks", "journal.js"),
    `const markers=${JSON.stringify(REVIEW_STUDIO_UI_RUNTIME_MARKERS.slice(1))};\n`,
    "utf8",
  );
}

try {
  await writeFixture();
  assert.equal(runtimeContractPass(await verifySourceResearchContract(sourceRoot)), true);
  await unlink(path.join(sourceRoot, ...RESEARCH_ROUTE_SOURCE.split("/")));
  assert.equal(runtimeContractPass(await verifySourceResearchContract(sourceRoot)), false, "missing source route must fail");
  await writeFile(path.join(sourceRoot, ...RESEARCH_ROUTE_SOURCE.split("/")), "export const GET = () => null;\n", "utf8");

  assert.equal(runtimeContractPass(await verifyCompiledResearchRuntime(runtimeRoot)), true, "compiled runtime without route.ts must pass");
  await writeFile(routeFile, "'use strict'; const markers=['research_schema_unavailable','analysis_binding_required']; const runtime={X(){}}; runtime.X(0,[9132],()=>{});\n", "utf8");
  await writeFile(splitChunkFile, "'use strict'; const markers=['S9_ARCHIVED','human_gate_hash_binding_invalid','old-mike-deterministic-stats','DESCRIPTIVE_STATISTICS','analysis_input_binding_failed','research_workflow_events'];\n", "utf8");
  assert.equal(runtimeContractPass(await verifyCompiledResearchRuntime(runtimeRoot)), true, "route dependency closure must satisfy runtime markers");
  await unlink(splitChunkFile);
  assert.equal(runtimeContractPass(await verifyCompiledResearchRuntime(runtimeRoot)), false, "missing referenced dependency chunk must fail closed");
  await writeFixture();
  await unlink(routeFile);
  assert.equal(runtimeContractPass(await verifyCompiledResearchRuntime(runtimeRoot)), false, "missing compiled route must fail");
  await writeFixture();
  await writeFile(path.join(runtimeRoot, ".next", "server", "app-paths-manifest.json"), "{}", "utf8");
  assert.equal(runtimeContractPass(await verifyCompiledResearchRuntime(runtimeRoot)), false, "missing manifest route must fail");

  assert.equal(evaluateResearchHttpResponse(401, "unauthorized"), true);
  assert.equal(evaluateResearchHttpResponse(404, "not_found"), false, "404 must fail");
  assert.equal(evaluateResearchHttpResponse(500, "module_resolution"), false, "module-resolution 500 must fail");
  console.log("SOURCE_RELEASE_MISSING_ROUTE_REJECTED=PASS");
  console.log("STANDALONE_WITHOUT_SOURCE_ROUTE=PASS");
  console.log("COMPILED_ROUTE_REMOVAL_REJECTED=PASS");
  console.log("COMPILED_ROUTE_DEPENDENCY_CLOSURE=PASS");
  console.log("MISSING_DEPENDENCY_CHUNK_REJECTED=PASS");
  console.log("MANIFEST_ROUTE_REMOVAL_REJECTED=PASS");
  console.log("RESEARCH_HTTP_STATUS_CONTRACT=PASS");
  console.log("RESEARCH_RUNTIME_CONTRACT=PASS");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
