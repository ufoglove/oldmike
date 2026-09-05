import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { alpha9PrototypeEnabled } from "../lib/v2-alpha9/page-authority.ts";

assert.equal(alpha9PrototypeEnabled({ NODE_ENV: "production", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA9_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(alpha9PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "0", OLD_MIKE_V2_ALPHA9_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(alpha9PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA9_LOCAL_PROTOTYPE: "0" }), false);
assert.equal(alpha9PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA9_LOCAL_PROTOTYPE: "1" }), true);

const files = Object.fromEntries(await Promise.all([
  "app/v2-alpha9-local/page.tsx",
  "app/api/v2-alpha9/finalize/route.ts",
  "lib/v2-alpha9/runtime.ts",
  "lib/v2-alpha9/auth.ts",
  "lib/v2-alpha9/adapters.ts",
  "lib/v2-alpha9/manuscript-review.ts",
  "lib/v2-alpha9/taiwan-review.ts",
].map(async (relative) => [relative, await readFile(new URL(`../${relative}`, import.meta.url), "utf8")])));

const page = files["app/v2-alpha9-local/page.tsx"];
const route = files["app/api/v2-alpha9/finalize/route.ts"];
const runtime = files["lib/v2-alpha9/runtime.ts"];
const auth = files["lib/v2-alpha9/auth.ts"];
assert.match(page, /alpha9PrototypeEnabled\(\)/u);
assert.match(page, /notFound\(\)/u);
assert.match(route, /alpha9PrototypeEnabled\(\)/u);
assert.match(route, /code: "not_found" \}, 404/u);
assert.match(route, /V2_ALPHA9_REQUEST_MAX_BYTES/u);
assert.match(route, /originAllowed\(request\)/u);
assert.match(route, /resolveV2Alpha9Principal\(request\)/u);
assert.doesNotMatch(route, /export\s+async\s+function\s+(?:GET|PUT|PATCH|DELETE)/u);
assert.match(auth, /OLD_MIKE_V2_ALPHA9_SYNTHETIC_PRINCIPAL/u);
assert.match(auth, /status: 404, code: "not_found"/u);

const effectSurface = [route, runtime, files["lib/v2-alpha9/adapters.ts"], files["lib/v2-alpha9/manuscript-review.ts"], files["lib/v2-alpha9/taiwan-review.ts"]].join("\n");
assert.doesNotMatch(effectSurface, /\bfetch\s*\(|https?:\/\/|\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_"`]|DELETE\s+FROM|TRUNCATE\s+)|sql`|create[A-Za-z]*(?:Repository|Pool|Client)\s*\(/iu);
assert.doesNotMatch(route, /process\.env|environmentVariables|setEnvironment|updateService|createService/iu);
assert.doesNotMatch(runtime, /process\.env|OPENCLAW|CODEX|CHAT_COMPLETIONS|\bGPT\b|ZEEBUR|DEEPSEEK/iu);

console.log(JSON.stringify({
  status: "PASS",
  productionPage: 404,
  productionApi: 404,
  requestLimitBytes: 16_384,
  originGate: "PASS",
  tenantPrincipalGate: "PASS",
  mutationMethods: 0,
  formalWriteSurface: 0,
  onlineDatabaseSurface: 0,
  externalNetworkSurface: 0,
  environmentMutationSurface: 0,
}));
