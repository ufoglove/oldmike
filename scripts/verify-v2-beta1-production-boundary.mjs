import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { v2Beta1PrototypeEnabled } from "../lib/v2-beta1/page-authority.ts";

assert.equal(v2Beta1PrototypeEnabled({ NODE_ENV: "production", TEST_FIXTURE: "1", OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(v2Beta1PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "0", OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(v2Beta1PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "0" }), false);
assert.equal(v2Beta1PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1" }), true);

const files = Object.fromEntries(await Promise.all([
  "app/research-os-local/page.tsx",
  "app/api/v2-beta1/project/route.ts",
  "lib/v2-beta1/route-handlers.ts",
  "lib/v2-beta1/runtime.ts",
  "lib/v2-beta1/auth.ts",
].map(async (relative) => [relative, await readFile(new URL(`../${relative}`, import.meta.url), "utf8")])));
const page = files["app/research-os-local/page.tsx"];
const route = files["app/api/v2-beta1/project/route.ts"];
const handlers = files["lib/v2-beta1/route-handlers.ts"];
const runtime = files["lib/v2-beta1/runtime.ts"];

assert.match(page, /v2Beta1PrototypeEnabled\(\)/u);
assert.match(page, /notFound\(\)/u);
assert.match(route, /createV2Beta1RouteHandlers/u);
assert.match(handlers, /v2Beta1PrototypeEnabled\(\)/u);
assert.match(handlers, /code: "not_found"/u);
assert.match(handlers, /resolveV2Beta1Principal\(request\)/u);
assert.match(handlers, /originAllowed\(request\)/u);
assert.match(handlers, /REQUEST_MAX_BYTES/u);
assert.match(route, /export const GET/u);
assert.match(route, /export const POST/u);
assert.doesNotMatch(route, /export\s+async\s+function\s+(?:PUT|PATCH|DELETE)/u);
assert.doesNotMatch(`${route}\n${handlers}\n${runtime}`, /\bfetch\s*\(|https?:\/\/|\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_"`]|DELETE\s+FROM|TRUNCATE\s+)|sql`|create[A-Za-z]*(?:Repository|Pool|Client)\s*\(/iu);
assert.doesNotMatch(`${route}\n${handlers}`, /setEnvironment|updateService|createService|OPENCLAW|CHAT_COMPLETIONS|\bGPT\b|ZEEBUR/iu);

console.log(JSON.stringify({ status: "PASS", evidenceClass: "STATIC_SURFACE_ABSENT", productionBehavior: "NOT_OBSERVED_BY_THIS_GATE", methods: ["GET", "POST"], originGate: "PASS_STATIC", principalGate: "PASS_STATIC", networkSurface: "ABSENT_IN_ACTIVE_ROUTE_CALL_GRAPH", databaseSurface: "ABSENT_IN_ACTIVE_ROUTE_CALL_GRAPH", formalWriteSurface: "ABSENT_IN_ACTIVE_ROUTE_CALL_GRAPH", environmentMutationSurface: "ABSENT_IN_ACTIVE_ROUTE_CALL_GRAPH" }));
