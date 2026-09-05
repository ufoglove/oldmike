import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TASK_GATEWAY_CONTRACT_VERSION,
  parseTaskEnvelope,
  taskGatewayHash,
} from "../lib/task-gateway-contract.ts";
import { ServerOnlyTaskGateway, assertContinuation, resolveTaskGatewayFeatureState } from "../lib/task-gateway.ts";
import { GoldenPathMockAdapter, runMockGoldenPath } from "../lib/task-gateway-mock.ts";
import { buildDistinctTrendLanes, dedupeScholarlyObservations, normalizeScholarlyFixture } from "../lib/topic-lab-scholarly-adapters.ts";
import { ACADEMIC_LANGUAGE_CONTRACT_VERSION, parseAcademicLanguageRequest, parseAcademicProviderResult, preservationFingerprint } from "../lib/academic-language-contract.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = path.resolve(root, "..");
const read = (relative) => readFile(path.resolve(root, relative), "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const registry = JSON.parse(await read("contracts/skill-registry.json"));
const skillIds = new Set(registry.skills.map((item) => item.id));
assert.equal(registry.status, "PINNED_LOCAL_REGISTRY_NOT_ACTIVATED");
assert.equal(registry.installationsPerformed, 0);
assert.equal(registry.skills.length, 16);
assert.ok(registry.skills.every((item) => item.license === "MIT" && /^[a-f0-9]{64}$/.test(item.sha256) && item.enabledByDefault === false));
for (const item of registry.internalContracts) {
  const bytes = await read(item.source);
  assert.equal(sha256(bytes), item.sha256, `internal contract pin mismatch: ${item.id}`);
}

const [authority, projectRoute, chatRoute, tenantRepository, gatewaySource, center, workflow, academicStudio, styles, modelCenter, blueprint, dataRfc] = await Promise.all([
  read("contracts/project-chat-authority.contract.json").then(JSON.parse),
  read("app/api/projects/route.ts"),
  read("app/api/chat/route.ts"),
  read("lib/tenant-repository.ts"),
  read("lib/task-gateway.ts"),
  read("components/GuidedResearchCenter.tsx"),
  read("components/ResearchWorkflow.tsx"),
  read("components/AcademicLanguageStudio.tsx"),
  read("app/globals.css"),
  read("contracts/model-center.contract.json").then(JSON.parse),
  readFile(path.resolve(workspace, "RESEARCH_OS_MASTER_BLUEPRINT_V1.md"), "utf8"),
  read("DATA_MODEL_RFC_FOUNDATION_V1.md"),
]);

assert.equal(authority.formalProjectAuthority, "POSTGRESQL");
assert.equal(authority.agentFilesystemAuthority, "EPHEMERAL_COMPUTE_CACHE_ONLY");
assert.equal(authority.sharedFilesystemTenantBoundary, false);
assert.match(projectRoute, /requireAuthenticatedUser/);
assert.match(projectRoute, /tenantProjectRepository\.create/);
assert.match(projectRoute, /buildCreatedProjectSummary/);
assert.match(chatRoute, /requireAuthenticatedUser/);
assert.match(chatRoute, /loadAuthorizedProjectTaskContext/);
assert.match(chatRoute, /getServerTaskGateway/);
assert.match(tenantRepository, /workspace_id|workspaceId/);
assert.match(tenantRepository, /created_by_user_id|userId/);
assert.equal(modelCenter.status, "DISABLED_LOCAL_DESIGN_ONLY");
assert.equal(modelCenter.credentialPolicy.rawKeyInBrowser, false);
assert.equal(modelCenter.liveConnectionAuthorized, false);
assert.match(blueprint, /M01[\s\S]*M11/);
assert.match(blueprint, /Portal session[\s\S]*PostgreSQL/);
assert.match(dataRfc, /MIGRATION_REQUIRED=NO/);

assert.match(gatewaySource, /import "server-only"/);
assert.match(gatewaySource, /PRIVATE_RESPONSES/);
assert.doesNotMatch(center + workflow + academicStudio, /OpenClaw|Codex|GPT|Claude|Gemini/);
assert.doesNotMatch(center + academicStudio, /apiKey|API_KEY|Authorization|Bearer|credentialReference/);
assert.match(center, /老麥建議・尚未驗證/);
assert.match(center, /老麥概念模式/);
assert.match(center, /即時查證模式/);
assert.doesNotMatch(center, />AI_PROPOSED</);
assert.doesNotMatch(center, /AI_PROPOSED 建議|每個 AI 建議/);
assert.doesNotMatch(workflow, />AI_PROPOSED<|建立為 AI_PROPOSED/);
assert.match(center, /data-testid="sidebar-display-name"/);

const baseEnvelope = {
  contractVersion: TASK_GATEWAY_CONTRACT_VERSION,
  actionId: "foundation-action-0001",
  taskId: "foundation-task-0001",
  tenantId: "tenant-fixture-0001",
  projectId: "project-fixture-0001",
  operation: "TOPIC_GOLDEN_PATH",
  idempotencyKey: "foundation-idempotency-0001",
  createdAt: "2026-08-23T00:00:00.000Z",
  payload: { kind: "TOPIC_KEYWORDS", keywords: ["職業安全", "訓練移轉"], observationWindow: { from: "2024-01-01", to: "2026-08-23" } },
  skillIds: ["scientific-brainstorming", "scientific-critical-thinking"],
  toolIds: ["FIXTURE_SCHOLARLY_METADATA"],
  continuation: null,
};
const parsedEnvelope = parseTaskEnvelope(baseEnvelope, skillIds);
assert.equal(parsedEnvelope.operation, "TOPIC_GOLDEN_PATH");
assert.throws(() => parseTaskEnvelope({ ...baseEnvelope, provider: "forbidden" }, skillIds), /invalid_task_envelope/);
assert.throws(() => parseTaskEnvelope({ ...baseEnvelope, skillIds: ["unlicensed-skill"] }, skillIds), /skill_not_allowlisted/);
assert.equal(resolveTaskGatewayFeatureState({}), "DISABLED");
assert.equal(resolveTaskGatewayFeatureState({ OLD_MIKE_TASK_GATEWAY_MODE: "PRIVATE_RESPONSES" }), "PRIVATE_RESPONSES");

const gateway = new ServerOnlyTaskGateway({ featureState: "LOCAL_MOCK_ONLY", adapter: new GoldenPathMockAdapter() });
const first = await gateway.execute(parsedEnvelope);
const replay = await gateway.execute(parsedEnvelope);
assert.equal(first.receipt.attemptClass, "FIRST");
assert.equal(replay.receipt.attemptClass, "IDEMPOTENT_REPLAY");
assert.equal(first.receipt.outputHash, replay.receipt.outputHash);
const conflicting = parseTaskEnvelope({ ...baseEnvelope, idempotencyKey: "foundation-idempotency-0002", payload: { ...baseEnvelope.payload, keywords: ["不同題目"] } }, skillIds);
await assert.rejects(() => gateway.execute(conflicting), /task_id_payload_conflict/);
const canceled = gateway.cancelBeforeExecution(parseTaskEnvelope({ ...baseEnvelope, taskId: "foundation-task-cancel", idempotencyKey: "foundation-cancel-0001" }, skillIds));
assert.equal(canceled.state, "CANCELED");
const disabled = new ServerOnlyTaskGateway({ featureState: "DISABLED", adapter: new GoldenPathMockAdapter() });
await assert.rejects(() => disabled.execute(parsedEnvelope), /task_gateway_disabled/);
const aborted = new AbortController(); aborted.abort();
await assert.rejects(() => new ServerOnlyTaskGateway({ featureState: "LOCAL_MOCK_ONLY", adapter: new GoldenPathMockAdapter() }).execute(parsedEnvelope, aborted.signal), /task_canceled/);

const trace = await runMockGoldenPath({ actionId: "golden-path-action-0001", tenantId: "tenant-fixture-0001", projectId: "project-fixture-0001", keywords: ["職業安全", "沉浸式訓練"], observationWindow: { from: "2024-01-01", to: "2026-08-23" }, approvedGates: ["RESEARCH_DIRECTION", "METHOD_AND_ETHICS", "EVIDENCE_AND_CLAIMS"], createdAt: "2026-08-23T01:00:00.000Z" });
assert.deepEqual(trace.receipts.map((item) => item.humanGate), ["RESEARCH_DIRECTION", "METHOD_AND_ETHICS", "EVIDENCE_AND_CLAIMS", "DOCUMENT_RELEASE"]);
assert.ok(trace.receipts.every((item) => item.state === "WAITING_HUMAN"));
assert.equal(trace.finalGate, "DOCUMENT_RELEASE");
assert.equal(trace.formalRecordMutations, 0);
assert.equal(trace.submissions, 0);
const topicOutput = trace.outputs[0];
assert.equal(topicOutput.candidateCount, 3);
assert.deepEqual(topicOutput.candidates.map((item) => item.lane), ["CURRENT_HOT", "EMERGING", "OPTIONAL_CONTRARIAN_GAP"]);
assert.ok(topicOutput.candidates.every((item) => item.evidenceLabel === "FIXTURE_ONLY_UNVERIFIED" && item.unsupportedBigDataClaim === false));
assert.throws(() => assertContinuation(trace.receipts[0], { ...parsedEnvelope, continuation: null }), /invalid_human_gate_continuation/);

const common = { contractVersion: "topic-lab-scholarly-fixtures/1.0.0", mode: "FIXTURE_ONLY", observationWindow: { from: "2024-01-01", to: "2026-12-31" }, retrievedAt: "2026-08-23T00:00:00.000Z", confidence: "LOW" };
const openAlex = normalizeScholarlyFixture({ ...common, provider: "OPENALEX", sampleSize: 2, records: [
  { id: "https://openalex.example/W1", doi: "https://doi.org/10.1234/current.1", display_name: "Current implementation evidence", publication_date: "2025-06-01", cited_by_count: 40, harmless_additive_field: true },
  { id: "https://openalex.example/W2", doi: null, display_name: "Emerging longitudinal signal", publication_date: "2026-03-01", cited_by_count: 2 },
] });
const crossref = normalizeScholarlyFixture({ ...common, provider: "CROSSREF", sampleSize: 1, records: [{ DOI: "10.1234/current.1", title: ["Duplicate DOI metadata"], published: { "date-parts": [[2025, 6, 1]] }, "is-referenced-by-count": 41, publisher: "additive ignored" }] });
const semantic = normalizeScholarlyFixture({ ...common, provider: "SEMANTIC_SCHOLAR", sampleSize: 1, records: [{ paperId: "paper-fixture-0003", externalIds: { DOI: "10.1234/emerging.3", CorpusId: 7 }, title: "Emerging mechanism study", publicationDate: "2026-04-01", citationCount: 3, authors: [] }] });
const deduped = dedupeScholarlyObservations([...openAlex, ...crossref, ...semantic]);
assert.equal(deduped.kept.length, 3);
assert.equal(deduped.duplicates.length, 1);
assert.equal(deduped.duplicates[0].reason, "DUPLICATE_DOI");
const lanes = buildDistinctTrendLanes([...openAlex, ...crossref, ...semantic]);
assert.equal(lanes.CURRENT_HOT.lane, "CURRENT_HOT");
assert.equal(lanes.EMERGING.lane, "EMERGING");
assert.ok(lanes.CURRENT_HOT.observationHashes.every((item) => !lanes.EMERGING.observationHashes.includes(item)));
assert.throws(() => normalizeScholarlyFixture({ ...common, provider: "OPENALEX", sampleSize: 2, records: openAlex.slice(0, 1) }), /sample_size_mismatch|invalid_openalex/);
assert.throws(() => normalizeScholarlyFixture({ ...common, provider: "OPENALEX", sampleSize: 1, records: [{ id: "id", doi: null, display_name: "Missing date", cited_by_count: 0 }] }), /invalid_openalex/);

const scratch = parseAcademicLanguageRequest({ operation: "SCRATCH_TRANSFORM", idempotencyKey: "scratch-fixture-0001", task: "TRANSLATE_EN_ZH_TW", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "The cohort included 42 adults [1] at 5 mg. $x=1$", glossaryVersionId: null, glossaryHash: null, methodParameters: { preserveCitations: true, preserveNumbers: true, preserveUnits: true, preserveFormulas: true, explainChanges: true } });
const translated = parseAcademicProviderResult({ contractVersion: ACADEMIC_LANGUAGE_CONTRACT_VERSION, status: "SUCCESS", task: "TRANSLATE_EN_ZH_TW", tonePreset: "JOURNAL_FORMAL", paragraphs: [{ index: 0, source: scratch.sourceText, revised: "此世代納入 42 名成人 [1]，劑量為 5 mg。$x=1$", changes: [{ kind: "TRANSLATION", original: "The cohort included", revised: "此世代納入", reason: "翻譯為臺灣繁體中文。" }] }], uncertainties: ["cohort 的領域譯法仍待確認。"] }, scratch);
assert.deepEqual(preservationFingerprint(scratch.sourceText), preservationFingerprint(translated.paragraphs[0].revised));
assert.match(academicStudio, /operation: scratchMode \? "SCRATCH_TRANSFORM" : "TRANSFORM"/);
assert.match(academicStudio, /段落試譯（不儲存；不建立版本）/);

assert.match(center, /aria-live="polite"|role="status"/);
assert.match(academicStudio, /aria-labelledby="m02-title"/);
assert.match(academicStudio, /aria-describedby="m02-source-help"/);
assert.match(styles, /@media\s*\(max-width:/);
assert.match(center, /sidebar-mobile-trigger|mobile/i);

console.log("BLOCKING_CATEGORY_02_TENANT_AUTH_AUTHORITY=PASS");
console.log("BLOCKING_CATEGORY_03_BROWSER_SECRET_PROVIDER_EXCLUSION=PASS");
console.log("BLOCKING_CATEGORY_04_PUBLIC_BRANDING=PASS");
console.log("BLOCKING_CATEGORY_05_MOCK_KEYWORD_GOLDEN_PATH=PASS");
console.log("BLOCKING_CATEGORY_06_CITATION_EVIDENCE_FAIL_CLOSED=PASS");
console.log("BLOCKING_CATEGORY_07_FOUR_HUMAN_GATES=PASS");
console.log("BLOCKING_CATEGORY_08_TRANSLATION_FIDELITY=PASS");
console.log("BLOCKING_CATEGORY_09_CANCEL_RESUME_IDEMPOTENCY=PASS");
console.log("BLOCKING_CATEGORY_10_DESKTOP_MOBILE_ACCESSIBILITY_SMOKE=PASS");
