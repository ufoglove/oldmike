import assert from "node:assert/strict";

import { academicLanguageHash } from "../lib/academic-language-contract.ts";
import { V2_ALPHA6_R1_SEMANTIC_FIXTURES } from "../lib/v2-alpha6-r1/semantic-language-fixtures.ts";

Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_ALPHA2_SYNTHETIC_PRINCIPAL: "1",
  OLD_MIKE_V2_ALPHA6_LOCAL_PROTOTYPE: "1",
  BETTER_AUTH_URL: "http://localhost:3000",
});

const { POST } = await import("../app/api/v2-alpha6/workspace/route.ts");
const sourceFixture = V2_ALPHA6_R1_SEMANTIC_FIXTURES.find((fixture) => fixture.fixtureId === "environment-academic-edit");
assert(sourceFixture);
const base = {
  operation: "LANGUAGE_ASSIST",
  requestId: "alpha6-r1-direct-api-001",
  task: sourceFixture.task,
  sourceText: sourceFixture.source,
  sourceHash: academicLanguageHash(sourceFixture.source),
};

async function call(body) {
  const response = await POST(new Request("http://localhost:3000/api/v2-alpha6/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", "X-Old-Mike-V2-Workspace": "fixture-workspace-v2" },
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

const first = await call(base);
assert.equal(first.status, 200);
assert.deepEqual(Object.keys(first.body).sort(), ["assistance", "contractVersion", "formalResearchWriteCount", "ok", "providerSubmissionCount", "replayed"]);
assert.equal(first.body.ok, true);
assert.equal(first.body.replayed, false);
assert.equal(first.body.providerSubmissionCount, 1);
assert.equal(first.body.formalResearchWriteCount, 0);
assert.deepEqual(first.body.assistance.options.map((option) => option.strategy), ["FAITHFUL", "PRECISE_JOURNAL_FORMAL", "NATURAL_SCHOLARLY"]);

const replay = await call(base);
assert.equal(replay.status, 200);
assert.equal(replay.body.replayed, true);
assert.equal(replay.body.providerSubmissionCount, 0);
assert.deepEqual(replay.body.assistance, first.body.assistance);

const conflict = await call({ ...base, task: "NATURAL_SCHOLARLY_STYLE" });
assert.equal(conflict.status, 409);
assert.deepEqual(conflict.body, { ok: false, code: "alpha6_idempotency_conflict" });

const staleHash = await call({ ...base, requestId: "alpha6-r1-direct-api-stale", sourceHash: "0".repeat(64) });
assert.equal(staleHash.status, 400);
assert.deepEqual(staleHash.body, { ok: false, code: "alpha6_language_source_hash_mismatch" });

const unsupportedSource = "Arbitrary unproved local translation fixture input must fail closed.";
const unsupported = await call({ ...base, requestId: "alpha6-r1-direct-api-unsupported", sourceText: unsupportedSource, sourceHash: academicLanguageHash(unsupportedSource) });
assert.equal(unsupported.status, 400);
assert.deepEqual(unsupported.body, { ok: false, code: "alpha6_fixture_input_unsupported" });

console.log(JSON.stringify({ status: "PASS", cases: 5, firstSubmission: 1, replaySubmission: 0, conflict: 409, staleHash: 400, unsupported: 400, formalResearchWrites: 0, externalCalls: 0 }));

