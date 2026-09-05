import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACADEMIC_LANGUAGE_CONTRACT_VERSION,
  academicLanguageRequestHash,
  academicLanguageResultHash,
  parseAcademicLanguageRequest,
  parseAcademicProviderResult,
  preservationFingerprint,
} from "../lib/academic-language-contract.ts";
import { assertGlossaryContract } from "../lib/academic-language-provider.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const [route, repository, provider, component, migrationManifest] = await Promise.all([
  read("app/api/projects/[projectId]/academic-language/route.ts"),
  read("lib/academic-language-repository.ts"),
  read("lib/academic-language-provider.ts"),
  read("components/AcademicLanguageStudio.tsx"),
  read("database/migration-manifest.json"),
]);

const glossary = parseAcademicLanguageRequest({
  operation: "SAVE_GLOSSARY",
  idempotencyKey: "m02-glossary:fixture-0001",
  logicalId: "m02-glossary-main",
  expectedVersion: 0,
  title: "專案術語庫",
  tonePreset: "JOURNAL_FORMAL",
  entries: [
    { sourceTerm: "教學實踐研究", targetTerm: "Teaching Practice Research", kind: "FIXED_TRANSLATION", caseSensitive: false },
    { sourceTerm: "structural equation modeling", targetTerm: "SEM", kind: "ABBREVIATION", caseSensitive: false },
  ],
  bannedTerms: [{ term: "prove", replacement: "suggest" }],
});
assert.equal(glossary.operation, "SAVE_GLOSSARY");
assert.equal(glossary.entries.length, 2);

const transformFixture = {
  operation: "TRANSFORM",
  modeProfile: "AUTO",
  idempotencyKey: "m02-language:fixture-0001",
  logicalId: "m02-language-main",
  expectedVersion: 0,
  title: "學術語言草稿",
  task: "TRANSLATE_ZH_EN",
  scope: "PARAGRAPH",
  tonePreset: "JOURNAL_FORMAL",
  sourceText: "教學實踐研究納入 42 participants [1]，劑量為 5 mg。$x=1$",
  glossaryVersionId: "document_m02_glossary_fixture",
  glossaryHash: "a".repeat(64),
  methodParameters: { preserveCitations: true, preserveNumbers: true, preserveUnits: true, preserveFormulas: true, explainChanges: true },
};
const transform = parseAcademicLanguageRequest(transformFixture);
assert.equal(transform.operation, "TRANSFORM");
assert.equal(academicLanguageRequestHash(transform), academicLanguageRequestHash(parseAcademicLanguageRequest({ ...transformFixture, idempotencyKey: "m02-language:fixture-9999" })));

const providerFixture = {
  contractVersion: ACADEMIC_LANGUAGE_CONTRACT_VERSION,
  status: "SUCCESS",
  task: "TRANSLATE_ZH_EN",
  tonePreset: "JOURNAL_FORMAL",
  paragraphs: [{
    index: 0,
    source: transform.sourceText,
    revised: "Teaching Practice Research included 42 participants [1] at a dose of 5 mg. $x=1$",
    changes: [{ kind: "TRANSLATION", original: "教學實踐研究納入", revised: "Teaching Practice Research included", reason: "採用專案固定術語並保持原意。" }],
  }],
  uncertainties: ["研究者仍需確認專業語境。"],
};
const parsedResult = parseAcademicProviderResult(providerFixture, transform);
assert.equal(parsedResult.paragraphs.length, 1);
assert.equal(academicLanguageResultHash(parsedResult), academicLanguageResultHash(parseAcademicProviderResult(structuredClone(providerFixture), transform)));
assert.deepEqual(preservationFingerprint(transform.sourceText), preservationFingerprint(parsedResult.paragraphs[0].revised));
assert.doesNotThrow(() => assertGlossaryContract(parsedResult, { versionId: "fixture", contentHash: "a".repeat(64), entries: glossary.entries, bannedTerms: glossary.bannedTerms }));

const scratch = parseAcademicLanguageRequest({
  operation: "SCRATCH_TRANSFORM",
  modeProfile: "AUTO",
  idempotencyKey: "m02-scratch:fixture-0001",
  task: "TRANSLATE_EN_ZH_TW",
  scope: "PARAGRAPH",
  tonePreset: "JOURNAL_FORMAL",
  sourceText: "The sample included 42 participants [1] at 5 mg. $x=1$",
  glossaryVersionId: null,
  glossaryHash: null,
  methodParameters: transformFixture.methodParameters,
});
assert.equal(scratch.operation, "SCRATCH_TRANSFORM");
const scratchResult = parseAcademicProviderResult({
  contractVersion: ACADEMIC_LANGUAGE_CONTRACT_VERSION,
  status: "SUCCESS",
  task: "TRANSLATE_EN_ZH_TW",
  tonePreset: "JOURNAL_FORMAL",
  paragraphs: [{ index: 0, source: scratch.sourceText, revised: "樣本納入 42 名參與者 [1]，劑量為 5 mg。$x=1$", changes: [{ kind: "TRANSLATION", original: "The sample included", revised: "樣本納入", reason: "轉為臺灣繁體中文並保留研究語意。" }] }],
  uncertainties: ["sample 的領域術語仍待研究者確認。"],
}, scratch);
assert.deepEqual(preservationFingerprint(scratch.sourceText), preservationFingerprint(scratchResult.paragraphs[0].revised));

assert.throws(() => parseAcademicLanguageRequest({ ...transformFixture, extra: true }), /invalid_transform_request_shape/);
assert.throws(() => parseAcademicLanguageRequest({ ...transformFixture, methodParameters: { ...transformFixture.methodParameters, preserveCitations: false } }), /unsafe_method_parameters/);
assert.throws(() => parseAcademicLanguageRequest({ ...transformFixture, glossaryHash: null }), /incomplete_glossary_binding/);
assert.throws(() => parseAcademicLanguageRequest({ ...transformFixture, scope: "PARAGRAPH", sourceText: "first\n\nsecond" }), /paragraph_scope_requires_one_paragraph/);
assert.throws(() => parseAcademicLanguageRequest({ ...scratch, scope: "FULL_TEXT" }), /scratch_requires_paragraph_scope/);
assert.throws(() => parseAcademicLanguageRequest({ ...scratch, logicalId: "must-not-persist" }), /invalid_scratch_transform_request_shape/);
assert.throws(() => parseAcademicLanguageRequest({ ...glossary, entries: [...glossary.entries, glossary.entries[0]] }), /duplicate_glossary_entry/);
assert.throws(() => parseAcademicProviderResult({ ...providerFixture, extra: true }, transform), /invalid_language_result_shape/);
assert.throws(() => parseAcademicProviderResult({ ...providerFixture, paragraphs: [{ ...providerFixture.paragraphs[0], source: "changed" }] }, transform), /invalid_language_paragraph_shape/);
assert.throws(() => parseAcademicProviderResult({ ...providerFixture, paragraphs: [{ ...providerFixture.paragraphs[0], revised: "Teaching Practice Research included 41 participants [1] at a dose of 5 mg. $x=1$" }] }, transform), /number_preservation_failed/);
assert.throws(() => parseAcademicProviderResult({ ...providerFixture, paragraphs: [{ ...providerFixture.paragraphs[0], revised: "Teaching Practice Research included 42 participants at a dose of 5 mg. $x=1$" }] }, transform), /citation_preservation_failed/);
assert.throws(() => assertGlossaryContract({ ...parsedResult, paragraphs: [{ ...parsedResult.paragraphs[0], revised: "The study included 42 participants [1] at a dose of 5 mg. $x=1$" }] }, { versionId: "fixture", contentHash: "a".repeat(64), entries: glossary.entries, bannedTerms: [] }), /glossary_term_not_preserved/);
assert.throws(() => assertGlossaryContract({ ...parsedResult, paragraphs: [{ ...parsedResult.paragraphs[0], revised: `${parsedResult.paragraphs[0].revised} prove` }] }, { versionId: "fixture", contentHash: "a".repeat(64), entries: glossary.entries, bannedTerms: glossary.bannedTerms }), /banned_term_present/);

for (const source of [route, repository]) {
  assert.match(source, /resolveResearchTenant|workspace_id = \$1/);
  assert.match(source, /projectId|project_id/);
}
assert.match(route, /requireAuthenticatedUser/);
assert.match(route, /originAllowed\(request\)/);
assert.match(route, /guardSensitiveAuthRateLimit/);
assert.match(route, /Cache-Control.*no-store/);
assert.match(repository, /created_by_user_id = \$3/);
assert.match(repository, /pg_advisory_xact_lock/);
assert.match(repository, /idempotency_payload_conflict/);
assert.match(repository, /DOCUMENT_RELEASE/);
assert.match(repository, /document_human_gate_required/);
assert.match(repository, /S7_M02_GLOSSARY_DRAFT/);
assert.match(repository, /S7_M02_LANGUAGE_DRAFT/);
assert.match(repository, /supersedes_version_id/);
assert.match(repository, /locked_at = now\(\)/);
assert.match(provider, /import "server-only"/);
assert.match(provider, /Do not invent evidence/);
assert.match(provider, /never optimize for evading detection systems/);
assert.match(component, /原文、修改後與逐項理由/);
assert.match(component, /Human Gate/);
assert.match(component, /新增至正式文件（不覆寫）/);
assert.match(component, /英翻繁中（臺灣）/);
assert.match(component, /段落試譯（不儲存；不建立版本）/);
assert.match(route, /parsed\.operation === "SCRATCH_TRANSFORM"/);
assert.match(route, /persistence: "NONE"/);
assert.doesNotMatch(route.match(/if \(parsed\.operation === "SCRATCH_TRANSFORM"\)[\s\S]*?\n    }/)?.[0] || "", /saveLanguageRun|saveGlossaryVersion|promoteLanguageDocument/);
assert.doesNotMatch(component, /OpenClaw|Codex|OpenAI|ChatGPT|Anthropic|Claude|Gemini|DeepSeek|gpt-[a-z0-9.-]+/i);
assert.doesNotMatch(route, /OpenClaw|Codex|GPT|Claude|Gemini/i);
assert.doesNotMatch(migrationManifest, /0008_academic|academic_language/i, "M02 must reuse 0005 without a new migration");

const approve = parseAcademicLanguageRequest({ operation: "APPROVE_DOCUMENT", idempotencyKey: "m02-approval:fixture-0001", documentVersionId: "document_m02_language_fixture", contentHash: "b".repeat(64), rationale: "已人工逐段核對內容與固定術語。" });
assert.equal(approve.operation, "APPROVE_DOCUMENT");
const promote = parseAcademicLanguageRequest({ operation: "PROMOTE_DOCUMENT", idempotencyKey: "m02-promotion:fixture-0001", documentVersionId: "document_m02_language_fixture", contentHash: "b".repeat(64), humanGateId: "gate_m02_document_fixture", targetLogicalId: "m02-formal-manuscript", expectedVersion: 0, title: "正式文件草稿" });
assert.equal(promote.operation, "PROMOTE_DOCUMENT");

console.log("ACADEMIC_LANGUAGE_PROVIDER_CONTRACT=PASS");
console.log("ACADEMIC_LANGUAGE_CONSUMER_CONTRACT=PASS");
console.log("STRICT_SHAPE_GATE=PASS");
console.log("BOUNDED_INPUT_GATE=PASS");
console.log("PRESERVATION_GATE=PASS");
console.log("GLOSSARY_CONTRACT=PASS");
console.log("TENANT_SCOPE_CONTRACT=PASS");
console.log("IDEMPOTENCY_CONTRACT=PASS");
console.log("HUMAN_GATE_CONTRACT=PASS");
console.log("APPEND_ONLY_VERSION_CONTRACT=PASS");
console.log("PUBLIC_BRANDING_GATE=PASS");
console.log("MIGRATION_REQUIRED=NO");
