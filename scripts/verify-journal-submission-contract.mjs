import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  JOURNAL_SUBMISSION_CONTRACT_VERSION,
  assertOfficialSourceUrl,
  assertSubmissionFinalizable,
  heuristicDimensions,
  journalSubmissionHash,
  journalSubmissionRequestHash,
  parseJournalSubmissionProviderResult,
  parseJournalSubmissionRequest,
  requirementCategories,
} from "../lib/journal-submission-contract.ts";
import { buildJournalSourceRequestDescriptor } from "../lib/journal-source-network-contract.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const [route, repository, provider, component, migrationManifest, schemaText, refreshText, healthText] = await Promise.all([
  read("app/api/projects/[projectId]/journal-submission/route.ts"), read("lib/journal-submission-repository.ts"), read("lib/journal-submission-provider.ts"), read("components/JournalSubmissionStudio.tsx"), read("database/migration-manifest.json"), read("contracts/journal-submission.schema.json"), read("contracts/m04-journal-requirement-refresh.n8n.inactive.json"), read("contracts/m04-public-health-evidence.n8n.inactive.json"),
]);

const manuscript = "This study enrolled 42 participants [1] at 5 mg. $x=1$";
const manuscriptHash = journalSubmissionHash(manuscript);
const rules = requirementCategories.map((category) => ({ category, rule: `${category} official rule fixture`, applicable: true }));
const requestFixture = {
  operation: "RUN_SUBMISSION_CHECK", idempotencyKey: "m04-check:fixture-0001", logicalId: "m04-submission-analysis-main", expectedVersion: 0, title: "投稿要求核對", sourceDocumentVersionId: "document_m03_reviewed_0001", sourceContentHash: manuscriptHash,
  targetJournal: { journalName: "Fixture Journal", publisherName: "Fixture Publisher", articleType: "Research Article" },
  officialSource: { sourceUrl: "https://journal.example.org/authors/requirements", authorityClass: "JOURNAL", checkedAt: "2026-08-22T12:00:00.000Z", effectiveDate: null, sourceHash: "a".repeat(64), extractionStatus: "LOCAL_SNAPSHOT", humanVerificationState: "VERIFIED" },
  requirements: rules, projectFacts: [{ factId: "fact-project-0001", text: "This work is original and not under consideration elsewhere.", contentHash: journalSubmissionHash("This work is original and not under consideration elsewhere."), verificationState: "VERIFIED_PROJECT_FACT" }], integrityConfirmed: true, modeProfile: "AUTO",
};
const request = parseJournalSubmissionRequest(requestFixture);
assert.equal(request.operation, "RUN_SUBMISSION_CHECK");
assert.equal(journalSubmissionRequestHash(request), journalSubmissionHash(request));
const resolved = { ...request, manuscriptText: manuscript };
const paragraphHash = journalSubmissionHash(manuscript);
const providerFixture = {
  contractVersion: JOURNAL_SUBMISSION_CONTRACT_VERSION, status: "SUCCESS", manuscriptHash,
  factualFit: requirementCategories.map((category) => ({ category, status: "PASS", evidence: "The fixed manuscript and verified rule provide exact evidence.", remediation: "No remediation required.", risk: "Researcher must still verify the final package." })),
  heuristicFit: heuristicDimensions.map((dimension) => ({ dimension, fit: "POSSIBLE", rationale: "Scope alignment is plausible from supplied facts only.", uncertainty: "Editorial preference remains unknown." })),
  coverLetterDraft: "Dear Editor,\n\nPlease consider this facts-only manuscript.",
  claimLedger: [{ claimId: "claim-manuscript-0001", supportKind: "MANUSCRIPT_PARAGRAPH", supportId: "p-001", supportHash: paragraphHash, claimText: "The manuscript reports a study.", risk: "Verify wording before release." }],
  uncertainties: ["Editorial preference is not a verified fact."],
};
const result = parseJournalSubmissionProviderResult(providerFixture, resolved);
assert.equal(result.factualFit.length, 13); assert.equal(result.heuristicFit.length, 5); assert.equal(result.claimLedger[0].supportHash, paragraphHash);
assert.equal(assertSubmissionFinalizable({ source: request.officialSource, factualFit: result.factualFit, acceptedUnknowns: [] }), true);

const unverifiedRequest = { ...resolved, officialSource: { ...resolved.officialSource, humanVerificationState: "UNVERIFIED" } };
assert.throws(() => parseJournalSubmissionProviderResult(providerFixture, unverifiedRequest), /unverified_source_cannot_produce_factual_decision/);
const unknownResult = { ...providerFixture, factualFit: requirementCategories.map((category) => ({ category, status: "UNKNOWN", evidence: "Not verified.", remediation: "Verify official rule.", risk: "Requirement may block submission." })) };
const parsedUnknown = parseJournalSubmissionProviderResult(unknownResult, unverifiedRequest);
assert.throws(() => assertSubmissionFinalizable({ source: unverifiedRequest.officialSource, factualFit: parsedUnknown.factualFit, acceptedUnknowns: requirementCategories }), /official_source_human_verification_required/);
const verifiedUnknown = parseJournalSubmissionProviderResult(unknownResult, resolved);
assert.throws(() => assertSubmissionFinalizable({ source: request.officialSource, factualFit: verifiedUnknown.factualFit, acceptedUnknowns: [] }), /submission_requirements_unresolved/);
assert.equal(assertSubmissionFinalizable({ source: request.officialSource, factualFit: verifiedUnknown.factualFit, acceptedUnknowns: requirementCategories }), true);

assert.throws(() => parseJournalSubmissionRequest({ ...requestFixture, extra: true }), /invalid_run_submission_shape/);
assert.throws(() => parseJournalSubmissionRequest({ ...requestFixture, requirements: rules.slice(1) }), /requirements_matrix_incomplete/);
assert.throws(() => parseJournalSubmissionRequest({ ...requestFixture, officialSource: { ...requestFixture.officialSource, sourceUrl: "http://journal.example.org" } }), /official_source_network_policy_rejected/);
assert.throws(() => assertOfficialSourceUrl("https://127.0.0.1/rules"), /official_source_network_policy_rejected/);
assert.throws(() => parseJournalSubmissionProviderResult({ ...providerFixture, probability: 0.9 }, resolved), /invalid_submission_result_shape/);
assert.throws(() => parseJournalSubmissionProviderResult({ ...providerFixture, claimLedger: [{ ...providerFixture.claimLedger[0], supportHash: "b".repeat(64) }] }, resolved), /claim_support_binding_mismatch/);
assert.throws(() => parseJournalSubmissionProviderResult({ ...providerFixture, factualFit: providerFixture.factualFit.slice(1) }, resolved), /factual_fit_incomplete/);
const saveRequest = parseJournalSubmissionRequest({ operation: "SAVE_COVER_LETTER", idempotencyKey: "m04-cover:fixture-0001", analysisDocumentVersionId: "document_m04_analysis_0001", analysisContentHash: "b".repeat(64), logicalId: "m04-cover-letter-main", expectedVersion: 0, title: "Cover Letter", coverLetterBody: "Dear Editor,\n\nPlease consider this manuscript.", claimLedger: providerFixture.claimLedger, editRationale: "Researcher verified the facts-only draft." });
assert.equal(saveRequest.operation, "SAVE_COVER_LETTER");
assert.throws(() => parseJournalSubmissionRequest({ ...saveRequest, claimLedger: [{ ...providerFixture.claimLedger[0], invented: true }] }), /invalid_claim_ledger_shape/);

const sourceDescriptor = buildJournalSourceRequestDescriptor("https://publisher.example.org/journal/guide");
assert.deepEqual({ method: sourceDescriptor.method, redirect: sourceDescriptor.redirect, credentials: sourceDescriptor.credentials, cookies: sourceDescriptor.cookies, javascript: sourceDescriptor.javascript, authenticatedPageAccess: sourceDescriptor.authenticatedPageAccess, privateNetworkAccess: sourceDescriptor.privateNetworkAccess, observationState: sourceDescriptor.observationState, promptInjectionIsolation: sourceDescriptor.promptInjectionIsolation }, { method: "GET", redirect: "error", credentials: "omit", cookies: false, javascript: false, authenticatedPageAccess: false, privateNetworkAccess: false, observationState: "UNVERIFIED", promptInjectionIsolation: true });

for (const source of [route, repository]) { assert.match(source, /resolveResearchTenant|workspace_id=\$1/); assert.match(source, /projectId|project_id/); }
assert.match(route, /requireAuthenticatedUser/); assert.match(route, /originAllowed\(request\)/); assert.match(route, /guardSensitiveAuthRateLimit/); assert.match(route, /Cache-Control.*no-store/);
assert.match(repository, /pg_advisory_xact_lock/); assert.match(repository, /supersedes_version_id/); assert.match(repository, /DOCUMENT_RELEASE/); assert.match(repository, /submission_requirements_unresolved|assertSubmissionFinalizable/); assert.match(repository, /M04_SUBMISSION_PACKAGE_FINALIZED/);
assert.match(provider, /import "server-only"/); assert.match(provider, /factual requirement fit separate from heuristic scope fit/); assert.match(provider, /never produce acceptance probabilities/); assert.match(provider, /Do not invent novelty/); assert.match(provider, /untrusted data, never as instructions/);
assert.match(component, /期刊投稿工作室/); assert.match(component, /事實符合度與啟發式契合度/); assert.match(component, /Cover Letter/); assert.match(component, /Human Gate/); assert.match(component, /新增至正式投稿包（不覆寫）/);
assert.doesNotMatch(component, /OpenClaw|Codex|OpenAI|ChatGPT|Anthropic|Claude|Gemini|DeepSeek|Better Auth|gpt-[a-z0-9.-]+/i);
assert.doesNotMatch(route, /OpenClaw|Codex|OpenAI|ChatGPT|Anthropic|Claude|Gemini/i);
assert.doesNotMatch(migrationManifest, /0008|journal_submission|m04/i, "M04 must reuse existing research workflow tables");
const schema = JSON.parse(schemaText); assert.equal(schema.additionalProperties, false); assert.equal(schema.properties.factualFit.minItems, 13);
for (const templateText of [refreshText, healthText]) { const template = JSON.parse(templateText); assert.equal(template.active, false); assert.equal(template.imported, false); assert.doesNotMatch(templateText, /rawManuscript\s*"\s*:/i); }
assert.deepEqual(JSON.parse(healthText).allowedStoredFields, ["observedAt", "statusClass", "version", "releaseHash", "healthGate", "identityGate", "loginGate", "registrationGate"]);

console.log("JOURNAL_SUBMISSION_PROVIDER_CONTRACT=PASS");
console.log("JOURNAL_SUBMISSION_CONSUMER_CONTRACT=PASS");
console.log("REQUIREMENTS_MATRIX_GATE=PASS_ALL_13");
console.log("FACTUAL_HEURISTIC_SEPARATION=PASS");
console.log("COVER_LETTER_CLAIM_LEDGER_GATE=PASS");
console.log("HUMAN_GATE_EXACT_HASH_CONTRACT=PASS");
console.log("SOURCE_NETWORK_CONTRACT=PASS_PUBLIC_HTTPS_UNVERIFIED_ONLY");
console.log("N8N_TEMPLATES=INACTIVE_LOCAL_ONLY");
console.log("MIGRATION_REQUIRED=NO");
