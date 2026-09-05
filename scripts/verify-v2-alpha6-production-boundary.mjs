import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { alpha6PrototypeEnabled } from "../lib/v2-alpha6/page-authority.ts";

assert.equal(alpha6PrototypeEnabled({ NODE_ENV: "production", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA6_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(alpha6PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "0", OLD_MIKE_V2_ALPHA6_LOCAL_PROTOTYPE: "1" }), false);
assert.equal(alpha6PrototypeEnabled({ NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_ALPHA6_LOCAL_PROTOTYPE: "1" }), true);
const page = await readFile(new URL("../app/v2-alpha6-local/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/v2-alpha6/workspace/route.ts", import.meta.url), "utf8");
assert.match(page, /alpha6PrototypeEnabled\(\)/u);
assert.match(page, /notFound\(\)/u);
assert.match(route, /alpha6PrototypeEnabled\(\)/u);
assert.match(route, /return alpha3Response\(\{ ok: false, code: "not_found" \}, 404\)/u);
assert.doesNotMatch(route, /saveLanguageRun|saveProposalVersion|research_documents|research_workflow_events/iu);
console.log(JSON.stringify({ status: "PASS", productionPage: 404, productionApi: 404, formalWriteImports: 0 }));
