import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { alpha7PrototypeEnabled } from "../lib/v2-alpha7/page-authority.ts";

assert.equal(alpha7PrototypeEnabled({ NODE_ENV: "production", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA7_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(alpha7PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "0", OLD_MIKE_V2_ALPHA7_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(alpha7PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA7_LOCAL_PROTOTYPE: "1" }), true);
const page = await readFile(new URL("../app/v2-alpha7-local/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/v2-alpha7/studio/route.ts", import.meta.url), "utf8");
assert.match(page, /alpha7PrototypeEnabled\(\)/u);
assert.match(page, /notFound\(\)/u);
assert.match(route, /alpha7PrototypeEnabled\(\)/u);
assert.match(route, /return alpha3Response\(\{ ok: false, code: "not_found" \}, 404\)/u);
assert.doesNotMatch(route, /research_documents|research_workflow_events|research_human_gates|saveReview|saveRevision/iu);
console.log(JSON.stringify({ status: "PASS", productionPage: 404, productionApi: 404, formalWriteImports: 0 }));
