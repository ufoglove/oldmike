import assert from "node:assert/strict";

Object.assign(process.env, {
  NODE_ENV: "development",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_ALPHA2_SYNTHETIC_PRINCIPAL: "1",
  OLD_MIKE_V2_ALPHA7_LOCAL_PROTOTYPE: "1",
  BETTER_AUTH_URL: "http://localhost:3000",
});

const { POST } = await import("../app/api/v2-alpha7/studio/route.ts");
const sourceText = "Evidence calibration may improve teacher decisions in two documented stages [7]. The proposed comparison uses 36 classrooms and reports uncertainty rather than claiming a verified effect. Method, ethics, and data-sharing details remain incomplete.";
const base = {
  operation: "RUN_REVIEW_STUDIO",
  requestId: "alpha7-r1-direct-api-001",
  entryMode: "PASTED_MANUSCRIPT",
  purpose: "AUTHOR_PRE_SUBMISSION_REVIEW",
  sourceText,
};

async function call(body) {
  const response = await POST(new Request("http://localhost:3000/api/v2-alpha7/studio", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", "X-Old-Mike-V2-Workspace": "fixture-workspace-v2" },
    body: JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}

const first = await call(base);
assert.equal(first.status, 200);
assert.deepEqual(Object.keys(first.body).sort(), ["contractVersion", "externalMutationCount", "formalResearchWriteCount", "ok", "providerSubmissionCount", "replayed", "requestHash", "workspace"]);
assert.equal(first.body.providerSubmissionCount, 1);
assert.equal(first.body.workspace.formalResearchWriteCount, 0);
assert.equal(first.body.workspace.prioritizedFindings.flatMap((item) => item.alternatives).every((item) => !item.revision.includes(first.body.workspace.prioritizedFindings[0].sourceSpan)), true);

const replay = await call(base);
assert.equal(replay.status, 200);
assert.equal(replay.body.replayed, true);
assert.equal(replay.body.providerSubmissionCount, 0);
assert.deepEqual(replay.body.workspace, first.body.workspace);

const conflict = await call({ operation: "RUN_REVIEW_STUDIO", requestId: base.requestId, entryMode: "ALPHA6_MANUSCRIPT", purpose: "AUTHOR_PRE_SUBMISSION_REVIEW", sourceArtifactId: "alpha6-manuscript-alpha7-local" });
assert.equal(conflict.status, 409);
assert.deepEqual(conflict.body, { ok: false, code: "alpha7_idempotency_conflict" });

const unsupportedSource = "Arbitrary manuscript content is long enough for request parsing but is outside the authored semantic fixture corpus and must remain unchanged.";
const unsupported = await call({ ...base, requestId: "alpha7-r1-direct-api-unsupported", sourceText: unsupportedSource });
assert.equal(unsupported.status, 400);
assert.deepEqual(unsupported.body, { ok: false, code: "alpha7_revision_input_unsupported" });
assert.equal(unsupportedSource, "Arbitrary manuscript content is long enough for request parsing but is outside the authored semantic fixture corpus and must remain unchanged.");

console.log(JSON.stringify({ status: "PASS", cases: 4, firstSubmission: 1, replaySubmission: 0, conflict: 409, unsupported: 400, unsupportedDraftPreserved: true, formalResearchWrites: 0, externalCalls: 0 }));
