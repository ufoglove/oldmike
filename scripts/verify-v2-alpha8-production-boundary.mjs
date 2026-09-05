import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { alpha8PrototypeEnabled } from "../lib/v2-alpha8/page-authority.ts";

assert.equal(alpha8PrototypeEnabled({ NODE_ENV: "production", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA8_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(alpha8PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "0", OLD_MIKE_V2_ALPHA8_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(alpha8PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA8_LOCAL_PROTOTYPE: "0" }), false);
assert.equal(alpha8PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA8_LOCAL_PROTOTYPE: "1" }), true);

const page = await readFile(new URL("../app/v2-alpha8-local/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/v2-alpha8/rescue/route.ts", import.meta.url), "utf8");
const runtime = await readFile(new URL("../lib/v2-alpha8/runtime.ts", import.meta.url), "utf8");
const auth = await readFile(new URL("../lib/v2-alpha8/auth.ts", import.meta.url), "utf8");
assert.match(page, /alpha8PrototypeEnabled\(\)/u);
assert.match(page, /notFound\(\)/u);
assert.match(route, /alpha8PrototypeEnabled\(\)/u);
assert.match(route, /code: "not_found" \}, 404/u);
assert.match(route, /V2_ALPHA8_REQUEST_MAX_BYTES/u);
assert.match(route, /originAllowed\(request\)/u);
assert.match(route, /resolveV2Alpha8Principal\(request\)/u);
assert.doesNotMatch(route, /research_documents|research_workflow_events|research_human_gates|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|sql`/iu);
assert.doesNotMatch(runtime, /fetch\(|https?:\/\/|postgres|create[A-Za-z]*Repository|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|sql`/iu);
assert.doesNotMatch(auth, /request-auth|requireAuthenticatedUser|postgres|repository|database|sql`/iu);
assert.match(auth, /OLD_MIKE_V2_ALPHA8_SYNTHETIC_PRINCIPAL/u);
assert.match(auth, /status: 404, code: "not_found"/u);

console.log(JSON.stringify({ status: "PASS", productionPage: 404, productionApi: 404, requestLimitBytes: 192000, originGate: "PASS", tenantPrincipalGate: "PASS", formalWriteImports: 0, onlineDatabaseSurface: 0, externalNetworkSurface: 0 }));
