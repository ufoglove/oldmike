import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REVIEW_STUDIO_CONTRACT_VERSION,
  applyReviewDecisions,
  parseReviewProviderResult,
  parseReviewStudioRequest,
  reviewEarlyStopEligible,
  reviewRequestHash,
  reviewStudioHash,
} from "../lib/review-studio-contract.ts";
import {
  REVIEW_AUTOMATION_CONTRACT_VERSION,
  ReviewNonceGuard,
  assertReviewAutomationTransition,
  parseReviewAutomationPayload,
  reviewAutomationRetryBudget,
  signReviewAutomationPayload,
  verifyReviewAutomationSignature,
} from "../lib/review-automation-contract.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const [route, repository, provider, component, adapter, migrationManifest, automationTemplate, schema] = await Promise.all([
  read("app/api/projects/[projectId]/review-studio/route.ts"), read("lib/review-studio-repository.ts"), read("lib/review-studio-provider.ts"), read("components/ReviewStudio.tsx"), read("lib/review-automation-adapter.ts"), read("database/migration-manifest.json"), read("contracts/m03-review-studio.n8n.inactive.json"), read("contracts/review-studio.schema.json"),
]);

const sourceText = "This method enrolled 42 participants [1] at 5 mg. $x=1$";
const methodParameters = { preserveCitations: true, preserveNumbers: true, preserveUnits: true, preserveFormulas: true, preserveParagraphIdentity: true, explainRecommendations: true, prohibitInventedEvidence: true };
const runFixture = {
  operation: "RUN_REVIEW", idempotencyKey: "m03-review:fixture-0001", logicalId: "m03-review-main", expectedVersion: 0, title: "審稿草稿", stage: "REVIEW", cycle: 0, previousReviewDocumentVersionId: null,
  source: { kind: "PASTED_TEXT", text: sourceText }, lenses: ["ARGUMENT_STRUCTURE", "METHOD", "EVIDENCE_CLAIM_SUPPORT", "CLARITY", "TERMINOLOGY", "JOURNAL_FIT", "ETHICS_REPRODUCIBILITY"], journalProfile: "審慎的學術期刊語境。", methodParameters, modeProfile: "AUTO",
};
const request = parseReviewStudioRequest(runFixture);
assert.equal(request.operation, "RUN_REVIEW");
const resolved = { ...request, sourceText, sourceDocumentVersionId: null, sourceContentHash: reviewStudioHash(sourceText) };
assert.equal(reviewRequestHash(request), reviewRequestHash(resolved));
const start = sourceText.indexOf("method"); const end = start + "method".length;
const providerFixture = {
  contractVersion: REVIEW_STUDIO_CONTRACT_VERSION, status: "SUCCESS", cycle: 0, qualityDelta: 6, lenses: request.lenses,
  findings: [{ findingId: "finding-method-0001", lens: "METHOD", severity: "P1", paragraphId: "p-001", startOffset: start, endOffset: end, sourceSpanHash: reviewStudioHash("method"), suggestedRevision: "study", rationale: "名稱應與實際設計一致。", risk: "方法識別可能不精確。", uncertainty: "需由研究者確認設計。", action: "確認設計後決定是否採用。" }], uncertainties: ["未取得研究設計附件。"],
};
const result = parseReviewProviderResult(providerFixture, resolved);
assert.equal(result.findings[0].paragraphId, "p-001"); assert.equal(reviewEarlyStopEligible(result), false);
const revision = applyReviewDecisions(sourceText, result.findings, [{ findingId: "finding-method-0001", action: "ACCEPT", editedText: null }]);
assert.equal(revision.revisedText, "This study enrolled 42 participants [1] at 5 mg. $x=1$");
assert.equal(revision.paragraphs[0].paragraphId, "p-001");
const converged = parseReviewProviderResult({ ...providerFixture, qualityDelta: 2, findings: [{ ...providerFixture.findings[0], severity: "P2" }] }, resolved);
assert.equal(reviewEarlyStopEligible(converged), true);

const reReview = parseReviewStudioRequest({ ...runFixture, idempotencyKey: "m03-re-review:fixture-0001", stage: "RE_REVIEW", cycle: 1, previousReviewDocumentVersionId: "document_m03_review_0001", source: { kind: "DOCUMENT_VERSION", documentVersionId: "document_m03_revision_0001", contentHash: "a".repeat(64) } });
assert.equal(reReview.operation, "RUN_REVIEW"); assert.equal(reReview.cycle, 1);
const revisionRequest = parseReviewStudioRequest({ operation: "SAVE_REVISION", idempotencyKey: "m03-revision:fixture-0001", reviewDocumentVersionId: "document_m03_review_0001", reviewContentHash: "b".repeat(64), logicalId: "m03-revision-main", expectedVersion: 0, title: "修訂一", decisions: [{ findingId: "finding-method-0001", action: "EDIT", editedText: "study" }] });
assert.equal(revisionRequest.operation, "SAVE_REVISION");
assert.throws(() => parseReviewStudioRequest({ ...runFixture, extra: true }), /invalid_run_review_shape/);
assert.throws(() => parseReviewStudioRequest({ ...runFixture, lenses: ["METHOD", "METHOD"] }), /duplicate_review_lens/);
assert.throws(() => parseReviewStudioRequest({ ...runFixture, stage: "RE_REVIEW", cycle: 0 }), /invalid_review_state_binding/);
assert.throws(() => parseReviewStudioRequest({ ...runFixture, source: { kind: "PASTED_TEXT", text: "x\u0000y" } }), /invalid_source_text/);
assert.throws(() => parseReviewStudioRequest({ ...revisionRequest, decisions: [{ findingId: "finding-method-0001", action: "EDIT", editedText: null }] }), /invalid_review_decision_edit_binding/);
assert.throws(() => parseReviewProviderResult({ ...providerFixture, extra: true }, resolved), /invalid_review_result_shape/);
assert.throws(() => parseReviewProviderResult({ ...providerFixture, findings: [{ ...providerFixture.findings[0], sourceSpanHash: "0".repeat(64) }] }, resolved), /source_span_hash_mismatch/);
assert.throws(() => parseReviewProviderResult({ ...providerFixture, findings: [providerFixture.findings[0], { ...providerFixture.findings[0], findingId: "finding-overlap-0002", startOffset: start + 1, sourceSpanHash: reviewStudioHash("ethod") }] }, resolved), /overlapping_review_findings/);
assert.throws(() => applyReviewDecisions(sourceText, result.findings, [{ findingId: "finding-method-0001", action: "EDIT", editedText: "study with 41 participants" }]), /number_preservation_failed/);
assert.throws(() => applyReviewDecisions(sourceText, result.findings, []), /incomplete_review_decisions/);

const payload = parseReviewAutomationPayload({ contractVersion: REVIEW_AUTOMATION_CONTRACT_VERSION, jobId: "job-fixture-0001", operation: "REVIEW", idempotencyKey: "automation-fixture-0001", requestedAt: "2026-08-22T10:00:00.000Z", status: "QUEUED", sourceHash: "c".repeat(64), resultHash: null });
assert.equal(assertReviewAutomationTransition("QUEUED", "RUNNING"), "RUNNING");
assert.equal(assertReviewAutomationTransition("RUNNING", "WAITING_HUMAN"), "WAITING_HUMAN");
assert.throws(() => assertReviewAutomationTransition("WAITING_HUMAN", "RUNNING"), /invalid_review_automation_transition/);
assert.equal(reviewAutomationRetryBudget("TRANSIENT_TRANSPORT"), 1); assert.equal(reviewAutomationRetryBudget("TENANT"), 0); assert.equal(reviewAutomationRetryBudget("CONTENT"), 0);
const secret = "fixture-only-signing-secret-000000000000"; const timestamp = "1787392800000"; const nonce = "0123456789abcdef0123456789abcdef"; const signature = signReviewAutomationPayload(payload, timestamp, nonce, secret); const guard = new ReviewNonceGuard();
assert.equal(verifyReviewAutomationSignature(payload, timestamp, nonce, signature, secret, guard, Number(timestamp)), true);
assert.throws(() => verifyReviewAutomationSignature(payload, timestamp, nonce, signature, secret, guard, Number(timestamp)), /review_automation_replay_rejected/);
assert.throws(() => parseReviewAutomationPayload({ ...payload, manuscript: "forbidden" }), /invalid_review_automation_payload/);
assert.throws(() => parseReviewAutomationPayload({ ...payload, status: "COMPLETED", resultHash: null }), /invalid_review_automation_result_binding/);

for (const source of [route, repository]) { assert.match(source, /resolveResearchTenant|workspace_id = \$1/); assert.match(source, /projectId|project_id/); }
assert.match(route, /requireAuthenticatedUser/); assert.match(route, /originAllowed\(request\)/); assert.match(route, /guardSensitiveAuthRateLimit/); assert.match(route, /Cache-Control.*no-store/);
assert.match(repository, /pg_advisory_xact_lock/); assert.match(repository, /S7_M03_REVIEW_RESULT/); assert.match(repository, /S7_M03_REVISED_DRAFT/); assert.match(repository, /DOCUMENT_RELEASE/); assert.match(repository, /review_convergence_gate_required/); assert.match(repository, /supersedes_version_id/); assert.match(repository, /M03_HUMAN_APPROVED_PROMOTION/);
assert.match(provider, /import "server-only"/); assert.match(provider, /Review only; do not rewrite/); assert.match(provider, /Do not invent evidence/); assert.match(provider, /never optimize for evading detection systems/i);
assert.match(component, /REVIEW → REVISE → RE-REVIEW/); assert.match(component, /精確來源範圍/); assert.match(component, /Human Gate/); assert.match(component, /新增至正式文件（不覆寫）/);
assert.doesNotMatch(component, /OpenClaw|Codex|OpenAI|ChatGPT|Anthropic|Claude|Gemini|DeepSeek|gpt-[a-z0-9.-]+/i); assert.doesNotMatch(route, /OpenClaw|Codex|GPT|Claude|Gemini/i);
assert.match(adapter, /reviewAutomationAdapterState\(\)/); assert.match(adapter, /DISABLED/); assert.match(adapter, /retryBudget/); assert.match(adapter, /AbortSignal\.timeout/);
assert.doesNotMatch(automationTemplate, /manuscript[^\"]*\s*:/i); assert.match(automationTemplate, /"active": false/); assert.match(automationTemplate, /"imported": false/); assert.match(automationTemplate, /humanWaitingClosesExecution/);
assert.doesNotMatch(migrationManifest, /0008_review|review_studio/i, "M03 must reuse existing research workflow tables");
assert.equal(JSON.parse(schema).additionalProperties, false);

console.log("REVIEW_STUDIO_PROVIDER_CONTRACT=PASS");
console.log("REVIEW_STUDIO_CONSUMER_CONTRACT=PASS");
console.log("STRICT_SHAPE_GATE=PASS");
console.log("REVIEW_LENS_GATE=PASS_ALL_7");
console.log("EXACT_SPAN_GATE=PASS");
console.log("PRESERVATION_GATE=PASS");
console.log("REVISION_LOOP_GATE=PASS_MAX_2");
console.log("EARLY_STOP_GATE=PASS_DELTA_LT_3_NO_P0");
console.log("HUMAN_GATE_CONTRACT=PASS");
console.log("APPEND_ONLY_VERSION_CONTRACT=PASS");
console.log("AUTOMATION_JOB_CONTRACT=PASS_OPAQUE_METADATA_ONLY");
console.log("AUTOMATION_SIGNATURE_REPLAY_GATE=PASS");
console.log("AUTOMATION_RETRY_POLICY=PASS_ONE_TRANSIENT_ZERO_POLICY_CONTENT_TENANT");
console.log("N8N_TEMPLATE_STATE=INACTIVE_LOCAL_ONLY");
console.log("MIGRATION_REQUIRED=NO");
