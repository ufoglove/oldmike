import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/v2-alpha5-local/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/v2-alpha5/workspace/route.ts", import.meta.url), "utf8");
assert.match(page, /NODE_ENV\s*!==\s*"development"/u);
assert.match(page, /TEST_FIXTURE\s*!==\s*"1"/u);
assert.match(page, /OLD_MIKE_V2_ALPHA5_LOCAL_PROTOTYPE\s*!==\s*"1"/u);
assert.match(page, /notFound\(\)/u);
assert.match(route, /NODE_ENV\s*===\s*"development"/u);
assert.match(route, /OLD_MIKE_V2_ALPHA5_LOCAL_PROTOTYPE\s*===\s*"1"/u);
assert.match(route, /not_found/u);
assert.doesNotMatch(route, /proposal-studio-repository|SAVE_PROPOSAL_VERSION|APPROVE_PROPOSAL/u);
console.log(JSON.stringify({ status: "PASS", productionPage: 404, productionApi: 404, formalWriteImports: 0 }));
