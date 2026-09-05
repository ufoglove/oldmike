import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { S0_FIELD_NAMES } from "../lib/s0-fields.ts";
import {
  V2_BETA2_CONTRACT_VERSION,
  beta2Hash,
  createV2Beta2Material,
  createV2Beta2ProviderResult,
  createV2Beta2Source,
  parseV2Beta2ProviderResult,
} from "../lib/v2-beta2/contracts.ts";
import { resolveV2Beta2ProviderRuntime } from "../lib/v2-beta2/environment.ts";
import { DeterministicFakeV2Beta2Provider } from "../lib/v2-beta2/fake-provider.ts";
import { createBoundedV2Beta2OpenClawProviderAdapter } from "../lib/v2-beta2/openclaw-provider-adapter.ts";
import {
  V2Beta2ProviderCapabilityError,
  assertV2Beta2LookupCapability,
  assertV2Beta2SubmissionCapability,
  parseV2Beta2ProviderLookupRequest,
  parseV2Beta2ProviderSubmission,
} from "../lib/v2-beta2/provider-port.ts";
import { createV2Beta2RuntimeProvider } from "../lib/v2-beta2/provider-runtime.ts";
import {
  V2_BETA2_ACCEPTANCE_CONTROLS,
  V2_BETA2_ACCEPTANCE_MATERIAL_IDENTITY,
  V2_BETA2_PRODUCT_ACCEPTANCE_ATTEMPT_START_SCHEMA_ID,
  V2_BETA2_PRODUCT_ACCEPTANCE_CLEANUP_RECEIPT_SCHEMA_ID,
  V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID,
  V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID,
  V2_BETA2_PRODUCT_ACCEPTANCE_LAUNCHER_TERMINAL_SCHEMA_ID,
  V2_BETA2_PRODUCT_ACCEPTANCE_OBSERVATION_RECEIPT_SCHEMA_ID,
  V2_BETA2_PRODUCT_ACCEPTANCE_VERIFIER_RESULT_SCHEMA_ID,
  parseV2Beta2ProductAcceptanceAttemptStart,
  parseV2Beta2ProductAcceptanceContract,
  parseV2Beta2ProductAcceptanceContractJson,
  parseV2Beta2ProductAcceptanceCleanupReceipt,
  parseV2Beta2ProductAcceptanceInnerOutcome,
  parseV2Beta2ProductAcceptanceLauncherTerminal,
  parseV2Beta2ProductAcceptanceObservationReceipt,
  parseV2Beta2ProductAcceptanceVerifierResult,
  parseV2Beta2ProductAcceptanceVectors,
  parseV2Beta2ProductAcceptanceVectorsJson,
  serializeV2Beta2ProductAcceptanceAttemptStart,
  serializeV2Beta2ProductAcceptanceCleanupReceipt,
  serializeV2Beta2ProductAcceptanceInnerOutcome,
  serializeV2Beta2ProductAcceptanceLauncherTerminal,
  serializeV2Beta2ProductAcceptanceObservationReceipt,
} from "../lib/v2-beta2/product-acceptance.ts";

let assertions = 0;
const check = (value, message) => { assertions += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };
const throws = (operation, code) => {
  assertions += 1;
  assert.throws(operation, (error) => error instanceof Error && (error.message === code || error.code === code), code);
};
const rejects = async (operation, code) => {
  assertions += 1;
  await assert.rejects(operation, (error) => error instanceof Error && (error.message === code || error.code === code), code);
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ACCEPTANCE_BUNDLE_PATHS = Object.freeze([
  "e2e/v2-beta2-product-acceptance.spec.ts",
  "lib/v2-beta2/product-acceptance.ts",
  "package.json",
  "product-acceptance/V2_BETA2_PROFESSOR_PLAYBOOK.md",
  "product-acceptance/v2-beta2-product-acceptance.contract.json",
  "product-acceptance/v2-beta2-product-acceptance.vectors.json",
  "scripts/run-v2-beta2-product-acceptance.mjs",
  "scripts/run-v2-beta2-product-acceptance.ps1",
  "scripts/verify-v2-beta2-a1-boundary.mjs",
  "scripts/verify-v2-beta2-product-acceptance.mjs",
]);

async function computeAcceptanceBundle() {
  const entries = await Promise.all(ACCEPTANCE_BUNDLE_PATHS.map(async (relativePath) => {
    const bytes = await readFile(new URL(`../${relativePath}`, import.meta.url));
    return { relativePath, size: bytes.byteLength, sha256: sha256(bytes) };
  }));
  entries.sort((left, right) => left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0);
  const stream = Buffer.concat(entries.map((entry) => Buffer.from(`${entry.relativePath}\0${entry.size}\0${entry.sha256}\n`, "utf8")));
  return Object.freeze({ entries: Object.freeze(entries), streamBytes: stream.byteLength, acceptanceBundleSha256: sha256(stream) });
}

let stage = "LOAD_AUTHORITY";

async function main() {

const contractBytes = await readFile(new URL("../product-acceptance/v2-beta2-product-acceptance.contract.json", import.meta.url));
const vectorsBytes = await readFile(new URL("../product-acceptance/v2-beta2-product-acceptance.vectors.json", import.meta.url));
const contractRaw = contractBytes.toString("utf8");
const vectorsRaw = vectorsBytes.toString("utf8");
stage = "CONTRACT_PARSE";
const contract = parseV2Beta2ProductAcceptanceContractJson(contractRaw);
const vectors = parseV2Beta2ProductAcceptanceVectorsJson(vectorsRaw);
const consumedVectorKinds = new Set();
const vector = (kind) => {
  const found = vectors.vectors.find((item) => item.kind === kind);
  if (!found) throw new Error(`acceptance_vector_missing:${kind}`);
  consumedVectorKinds.add(kind);
  return found;
};
equal(contract.productContract, V2_BETA2_CONTRACT_VERSION, "acceptance contract binds current product contract");
equal(vectors.vectors.length, 8, "behavioral vector cardinality");
equal(new Set(Object.values(V2_BETA2_ACCEPTANCE_CONTROLS)).size, Object.keys(V2_BETA2_ACCEPTANCE_CONTROLS).length, "stable control IDs are unique");
throws(() => parseV2Beta2ProductAcceptanceContract({ ...contract, actionId: "forbidden" }), "beta2_product_acceptance_contract_invalid");
throws(() => parseV2Beta2ProductAcceptanceVectors({ ...vectors, extra: true }), "beta2_product_acceptance_vectors_invalid");
const duplicateVectorId = structuredClone(JSON.parse(vectorsRaw));
duplicateVectorId.vectors[1].id = duplicateVectorId.vectors[0].id;
throws(() => parseV2Beta2ProductAcceptanceVectors(duplicateVectorId), "beta2_product_acceptance_vectors_invalid");
const nestedVectorExtra = structuredClone(JSON.parse(vectorsRaw));
nestedVectorExtra.vectors[0].expected.extra = true;
throws(() => parseV2Beta2ProductAcceptanceVectors(nestedVectorExtra), "beta2_product_acceptance_vectors_invalid");
const wrongVectorPrimitive = structuredClone(JSON.parse(vectorsRaw));
wrongVectorPrimitive.vectors[0].expected.directionCount = "3";
throws(() => parseV2Beta2ProductAcceptanceVectors(wrongVectorPrimitive), "beta2_product_acceptance_vectors_invalid");
for (const legacyVersion of [1, 2, 3]) {
  const legacyContract = structuredClone(JSON.parse(contractRaw));
  legacyContract.schemaId = `old-mike-v2-beta2/product-acceptance-contract/${legacyVersion}`;
  legacyContract.contractId = `old-mike-v2-beta2/product-acceptance/${legacyVersion}`;
  legacyContract.version = legacyVersion;
  throws(() => parseV2Beta2ProductAcceptanceContract(legacyContract), "beta2_product_acceptance_contract_invalid");
  const mismatchedVectorContract = structuredClone(JSON.parse(vectorsRaw));
  mismatchedVectorContract.contractId = `old-mike-v2-beta2/product-acceptance/${legacyVersion}`;
  throws(() => parseV2Beta2ProductAcceptanceVectors(mismatchedVectorContract), "beta2_product_acceptance_vectors_invalid");
}
throws(() => parseV2Beta2ProductAcceptanceContractJson('{"schemaId":"x","schemaId":"y"}'), "beta2_product_acceptance_contract_invalid");
throws(() => parseV2Beta2ProductAcceptanceVectorsJson('{"schemaId":"x","schemaId":"y"}'), "beta2_product_acceptance_vectors_invalid");

stage = "KNOWN_ANSWER_HASHES";
equal(vectors.materialHashKnownAnswers.length, 6, "six material hash known answers are frozen");
for (const answer of vectors.materialHashKnownAnswers) {
  const rawBytes = Buffer.from(answer.content, "utf8");
  const canonicalPreimage = Buffer.from(JSON.stringify(answer.content), "utf8");
  equal(rawBytes.byteLength, answer.contentByteLength, `raw UTF-8 length: ${answer.id}`);
  equal(canonicalPreimage.byteLength, answer.canonicalPreimageByteLength, `canonical preimage length: ${answer.id}`);
  equal(sha256(canonicalPreimage), answer.contentHash, `independent canonical JSON string hash: ${answer.id}`);
  equal(sha256(rawBytes), answer.rawUtf8Sha256Negative, `independent raw UTF-8 negative hash: ${answer.id}`);
  check(answer.contentHash !== answer.rawUtf8Sha256Negative, `raw UTF-8 SHA is rejected as contentHash: ${answer.id}`);
  const actual = createV2Beta2Material({ materialId: `known-answer-${answer.id}`, kind: "ABSTRACT", title: answer.id, content: answer.content });
  equal(actual.contentByteLength, answer.contentByteLength, `product material byte length equals literal: ${answer.id}`);
  equal(actual.contentHash, answer.contentHash, `product material hash equals literal: ${answer.id}`);
}
for (const mutate of [
  (input) => { input.materialHashKnownAnswers[0].contentHash = input.materialHashKnownAnswers[0].rawUtf8Sha256Negative; },
  (input) => { input.materialHashKnownAnswers[0].contentHash = `${input.materialHashKnownAnswers[0].contentHash.slice(0, 63)}4`; },
  (input) => { input.materialHashKnownAnswers.reverse(); },
  (input) => { input.materialHashKnownAnswers[0].extra = true; },
  (input) => { delete input.materialHashKnownAnswers[0].canonicalPreimageByteLength; },
  (input) => { input.materialHashKnownAnswers[0].contentByteLength = "3"; },
  (input) => { input.materialHashKnownAnswers[0].contentHash = "abc"; },
  (input) => { input.materialHashKnownAnswers[0].content = "abd"; },
]) {
  const candidate = structuredClone(JSON.parse(vectorsRaw));
  mutate(candidate);
  throws(() => parseV2Beta2ProductAcceptanceVectors(candidate), "beta2_product_acceptance_vectors_invalid");
}

const uiSources = await Promise.all([
  "../components/AuthForm.tsx",
  "../components/v2-beta2/V2Beta2ResearchOS.tsx",
].map(async (path) => readFile(new URL(path, import.meta.url), "utf8")));
for (const [name, id] of Object.entries(V2_BETA2_ACCEPTANCE_CONTROLS)) check(uiSources.some((source) => source.includes(`V2_BETA2_ACCEPTANCE_CONTROLS.${name}`)), `acceptance control is rendered: ${id}`);
check(uiSources[1].includes("material.materialId"), "material acceptance IDs are scoped by stable material identity");
check(uiSources[1].includes("htmlFor={kindId}") && uiSources[1].includes("htmlFor={titleId}") && uiSources[1].includes("htmlFor={contentId}"), "material controls have explicit labels");
check(uiSources[1].includes("nextMaterialOrdinal.current += 1") && !uiSources[1].includes("current.length + 1"), "material identity uses monotonic non-reused session authority");
equal(contract.materialControlIdentity.firstMaterialId, V2_BETA2_ACCEPTANCE_MATERIAL_IDENTITY.firstMaterialId, "first material identity is frozen");

stage = "BEHAVIORAL_VECTORS";
const partial = vector("PARTIAL_SUCCESS");
const rawMaterials = partial.materials;
const materials = rawMaterials.map((item) => createV2Beta2Material(item));
const source = createV2Beta2Source({
  entryMode: "PARTIAL_MATERIAL",
  researchDirection: "以原始部分材料建立可反駁、可恢復且不超出證據的研究方向",
  outputTarget: "SSCI",
  materials,
});
equal(source.materials.length, rawMaterials.length, "partial material count");
for (const [index, material] of source.materials.entries()) {
  equal(material.materialId, rawMaterials[index].materialId, "material order is exact");
  equal(material.content, rawMaterials[index].content, "material JS string bytes are preserved");
  equal(material.contentByteLength, rawMaterials[index].contentByteLength, "material UTF-8 byte length equals frozen literal");
  equal(material.contentHash, rawMaterials[index].contentHash, "material content hash equals frozen literal");
  equal(sha256(Buffer.from(JSON.stringify(rawMaterials[index].content), "utf8")), rawMaterials[index].contentHash, "partial material literal uses canonical JSON string hash");
}
const blank = vector("MATERIAL_REJECT");
throws(() => createV2Beta2Material({ materialId: "acceptance-blank-01", kind: "ABSTRACT", title: "Blank", content: blank.content }), blank.expectedCode);
const browserDom = vector("PARTIAL_BROWSER_DOM");
equal(browserDom.stage, "BROWSER_DOM_TEXT_VALUE", "browser vector carries exact provenance stage");
equal(Buffer.byteLength(browserDom.content, "utf8"), browserDom.contentByteLength, "browser DOM LF raw byte length");
equal(Buffer.byteLength(JSON.stringify(browserDom.content), "utf8"), browserDom.canonicalPreimageByteLength, "browser DOM LF canonical preimage length");
equal(sha256(Buffer.from(JSON.stringify(browserDom.content), "utf8")), browserDom.contentHash, "browser DOM LF literal hash");
equal(sha256(Buffer.from(browserDom.content, "utf8")), browserDom.rawUtf8Sha256Negative, "browser DOM LF raw negative hash");
const apiMethods = rawMaterials.find((item) => item.materialId === browserDom.targetMaterialId);
check(Boolean(apiMethods), "API/file CRLF material is present");
equal(apiMethods.content, "第一行\r\n第二行；限定為未驗證材料。", "API/file stage restores CRLF source bytes");
equal(apiMethods.contentByteLength, 50, "API/file CRLF raw byte length is frozen");
equal(apiMethods.contentHash, "5be5c122cb4c06ebc61556389f3240c15b7dfc942bf301d2c7c4e009fd07f071", "API/file CRLF literal hash is frozen");
equal(sha256(Buffer.from(apiMethods.content, "utf8")), "05b74f20845dc8b721b42975a7ad877f5f162a53320f071b90bff6f92d2e288d", "API/file CRLF raw negative hash is frozen");

const stageInstanceHash = beta2Hash({ namespace: "acceptance-stage", sourceHash: source.sourceHash });
const requestHash = beta2Hash({ namespace: "acceptance-request", source });
const receiptCommitment = beta2Hash({ namespace: "acceptance-receipt", requestHash });
const submission = parseV2Beta2ProviderSubmission({ jobId: "acceptance-job-0001", stageInstanceHash, requestHash, receiptCommitment, source });
const fake = new DeterministicFakeV2Beta2Provider();
assertV2Beta2SubmissionCapability(fake);
assertV2Beta2LookupCapability(fake);
const fakeComplete = await fake.submit(submission);
equal(fakeComplete.completionClass, "COMPLETE", "local fake complete mapping");
const fakeResult = parseV2Beta2ProviderResult(fakeComplete.result);
equal(fakeResult.directions.length, 3, "three directions");
equal(fakeResult.directions.filter((item) => item.recommended).length, 1, "one recommendation");
equal(fakeResult.directions.find((item) => item.recommended)?.lane, "BALANCED_RECOMMENDED", "balanced lane is recommended");
check(fakeResult.directions.every((direction) => S0_FIELD_NAMES.every((field) => typeof direction.s0[field] === "string" && direction.s0[field].length > 0)), "all directions have complete 13-field S0");
equal(fakeResult.directions.reduce((count, direction) => count + S0_FIELD_NAMES.filter((field) => direction.s0[field]).length, 0), 39, "thirty-nine nonempty S0 values");
equal(fake.submissionCount, 1, "one fake submission");

const unknownVector = vector("COMPLETION_UNKNOWN");
const unknownProvider = new DeterministicFakeV2Beta2Provider();
unknownProvider.setNextOutcome("COMPLETION_UNKNOWN");
const unknownOutcome = await unknownProvider.submit({ ...submission, jobId: "acceptance-job-unknown-0001" });
equal(unknownOutcome.completionClass, "COMPLETION_UNKNOWN", "completion unknown vector maps exactly");
equal(unknownProvider.submissionCount, 1, "completion unknown submits once");
const unknownLookup = await unknownProvider.lookup({ receiptCommitment, requestHash });
equal(unknownLookup.status, "UNKNOWN", "completion unknown uses receipt lookup authority");
equal(unknownProvider.lookupCount, 1, "completion unknown lookup count");
equal(unknownProvider.submissionCount - 1, unknownVector.expectedResubmit, "completion unknown resubmit delta binds vector");

const terminalVector = vector("TERMINAL_REJECTED");
const terminalProvider = new DeterministicFakeV2Beta2Provider();
terminalProvider.setNextOutcome("TERMINAL_REJECTED");
const terminalOutcome = await terminalProvider.submit({ ...submission, jobId: "acceptance-job-terminal-0001" });
equal(terminalOutcome.completionClass === "COMPLETE", terminalVector.expectedSuccess, "terminal reject is never success");
equal(terminalProvider.submissionCount - 1, terminalVector.expectedResubmit, "terminal reject resubmit delta binds vector");

const replayVector = vector("EXACT_REPLAY");
equal(replayVector.expectedAppendDelta, 0, "exact replay append vector delegates zero-delta browser proof");
equal(replayVector.expectedSubmissionDelta, 0, "exact replay submission vector delegates zero-delta browser proof");
const conflictVector = vector("SAME_KEY_CONFLICT");
equal(conflictVector.expectedCode, "beta2_idempotency_conflict", "same-key conflict vector binds exact code");
equal(conflictVector.expectedEffectDelta, 0, "same-key conflict vector binds zero effect");
const authorityVector = vector("AUTHORITY_REJECT");
equal(authorityVector.expectedEffectDelta, 0, "authority rejection vector binds zero effect");

stage = "PROVIDER_BOUNDARY";
const boundedResult = createV2Beta2ProviderResult({
  stageInstanceHash: fakeResult.stageInstanceHash,
  sourceHash: fakeResult.sourceHash,
  providerClass: "BOUNDED_SERVER_ADAPTER",
  directions: fakeResult.directions,
  recommendedDirectionId: fakeResult.recommendedDirectionId,
  selectedDirectionId: fakeResult.selectedDirectionId,
});
const adapterEnvelope = JSON.stringify({ schemaId: "old-mike-v2-beta2/provider-adapter-response/1", receiptCommitment, requestHash, result: boundedResult });
const failureEvidence = { reasonEnum: "UPSTREAM_HTTP_REJECTED", elapsedBucket: "LT_1S", providerAttemptClass: "RESPONSE_COMPLETE" };
let protocolCalls = 0;
const adapter = createBoundedV2Beta2OpenClawProviderAdapter({
  enabledForInjectedLocalContractTest: true,
  lookupReceipt: async (lookup) => ({ status: "COMPLETE", ...lookup, result: boundedResult }),
  executeProtocol: async ({ messages }) => {
    protocolCalls += 1;
    check(messages.length === 2 && messages[0].role === "system" && messages[1].role === "user", "adapter emits bounded protocol messages");
    return { kind: "success", content: adapterEnvelope };
  },
});
assertV2Beta2SubmissionCapability(adapter);
assertV2Beta2LookupCapability(adapter);
const adapterComplete = await adapter.submit(submission);
equal(adapterComplete.completionClass, "COMPLETE", "bounded adapter complete mapping");
equal(adapterComplete.result.providerClass, "BOUNDED_SERVER_ADAPTER", "bounded adapter provider class");
const adapterLookup = await adapter.lookup({ receiptCommitment, requestHash });
equal(adapterLookup.status, "COMPLETE", "bounded adapter lookup mapping");
equal(protocolCalls, 1, "adapter protocol call count");

for (const [protocol, expectedClass] of [
  [{ kind: "completion-unknown", code: "provider_deadline", evidence: { ...failureEvidence, reasonEnum: "PROVIDER_DEADLINE", providerAttemptClass: "SUBMISSION_POSSIBLE" } }, "COMPLETION_UNKNOWN"],
  [{ kind: "terminal-rejected", code: "http_rejected", evidence: failureEvidence }, "TERMINAL_REJECTED"],
]) {
  const mapped = createBoundedV2Beta2OpenClawProviderAdapter({ enabledForInjectedLocalContractTest: true, lookupReceipt: async (lookup) => ({ status: "UNKNOWN", ...lookup }), executeProtocol: async () => protocol });
  equal((await mapped.submit(submission)).completionClass, expectedClass, `adapter maps ${expectedClass}`);
}
const proven = createBoundedV2Beta2OpenClawProviderAdapter({ enabledForInjectedLocalContractTest: true, lookupReceipt: async (lookup) => ({ status: "NOT_FOUND", ...lookup }), executeProtocol: async () => ({ kind: "proven-not-submitted", code: "configuration_missing" }) });
await rejects(() => proven.submit(submission), "beta2_provider_capability_unavailable");

for (const content of [
  JSON.stringify({ schemaId: "old-mike-v2-beta2/provider-adapter-response/1", receiptCommitment, requestHash, result: boundedResult, extra: true }),
  JSON.stringify({ schemaId: "old-mike-v2-beta2/provider-adapter-response/1", receiptCommitment, requestHash: `${requestHash.slice(0, 63)}0`, result: boundedResult }),
  JSON.stringify({ schemaId: "old-mike-v2-beta2/provider-adapter-response/1", receiptCommitment, requestHash, result: { ...boundedResult, model: "forbidden" } }),
]) {
  const malformed = createBoundedV2Beta2OpenClawProviderAdapter({ enabledForInjectedLocalContractTest: true, lookupReceipt: async (lookup) => ({ status: "UNKNOWN", ...lookup }), executeProtocol: async () => ({ kind: "success", content }) });
  await rejects(() => malformed.submit(submission), "beta2_provider_adapter_response_invalid");
}
throws(() => parseV2Beta2ProviderLookupRequest({ receiptCommitment, requestHash, extra: true }), "beta2_provider_lookup_request_invalid");
throws(() => parseV2Beta2ProviderResult({ ...fakeResult, contractVersion: "old-mike-v2-beta2/2.0.0-alpha.10" }), "beta2_provider_result_invalid");

const disabledAdapter = createBoundedV2Beta2OpenClawProviderAdapter({ enabledForInjectedLocalContractTest: false, executeProtocol: async () => { throw new Error("must_not_execute"); } });
await rejects(() => disabledAdapter.submit(submission), "beta2_provider_capability_unavailable");
let missingLookupProtocolCalls = 0;
const missingLookup = createBoundedV2Beta2OpenClawProviderAdapter({ enabledForInjectedLocalContractTest: true, executeProtocol: async () => { missingLookupProtocolCalls += 1; return { kind: "success", content: adapterEnvelope }; } });
await rejects(() => missingLookup.submit(submission), "beta2_provider_capability_unavailable");
equal(missingLookupProtocolCalls, 0, "missing lookup authority blocks before provider I/O");

const localEnvironment = {
  NODE_ENV: "development",
  INTEGRATION_TEST_MODE: "1",
  TEST_FIXTURE: "1",
  OLD_MIKE_V2_BETA2_ENABLED: "1",
  OLD_MIKE_V2_BETA2_FAKE_PROVIDER: "1",
  OLD_MIKE_V2_BETA2_LIVE_PROVIDER_ENABLED: "0",
  OLD_MIKE_V2_BETA2_OPENCLAW_ADAPTER_ENABLED: "0",
  OLD_MIKE_V2_BETA2_DURABLE_LOOKUP_AUTHORITY: "0",
  BETA2_DISPOSABLE_DATABASE_URL: "postgresql://old_mike_beta2_app_local@127.0.0.1:5432/old_mike_beta2_disposable_acceptance?application_name=old_mike_beta2_disposable",
};
equal(resolveV2Beta2ProviderRuntime(localEnvironment).mode, "LOCAL_DETERMINISTIC_FIXTURE", "strict local fixture is reachable");
check(createV2Beta2RuntimeProvider(localEnvironment) instanceof DeterministicFakeV2Beta2Provider, "runtime factory selects only local fake fixture");
for (const [environment, code] of [
  [{}, "beta2_provider_disabled"],
  [{ ...localEnvironment, NODE_ENV: "production" }, "beta2_provider_disabled"],
  [{ ...localEnvironment, OLD_MIKE_V2_BETA2_LIVE_PROVIDER_ENABLED: "1" }, "beta2_live_provider_not_authorized"],
  [{ ...localEnvironment, OLD_MIKE_V2_BETA2_OPENCLAW_ADAPTER_ENABLED: "1" }, "beta2_live_provider_not_authorized"],
  [{ ...localEnvironment, OLD_MIKE_V2_BETA2_DURABLE_LOOKUP_AUTHORITY: undefined }, "beta2_provider_configuration_invalid"],
]) {
  throws(() => createV2Beta2RuntimeProvider(environment), code);
}

stage = "PUBLIC_SURFACE";
const architectureSources = await Promise.all([
  "../lib/v2-beta2/provider-port.ts",
  "../lib/v2-beta2/openclaw-provider-adapter.ts",
  "../lib/v2-beta2/provider-runtime.ts",
  "../lib/v2-beta2/coordinator.ts",
  "../lib/v2-beta2/reconciliation.ts",
  "../lib/v2-beta2/route-handlers.ts",
].map(async (path) => readFile(new URL(path, import.meta.url), "utf8")));
check(!architectureSources[1].includes("process.env") && !architectureSources[1].includes("repository") && !architectureSources[1].includes("database"), "bounded adapter has no environment, repository, or database authority");
check(!/OPENCLAW_(?:GATEWAY_TOKEN|BASE_URL)|api[_-]?key|bearer/iu.test(architectureSources.slice(0, 3).join("\n")), "provider boundary does not read credential identities");
check(!architectureSources[3].includes("fake-provider") && !architectureSources[4].includes("fake-provider"), "coordinator and reconciliation depend only on generic provider port");
check(!architectureSources[5].includes("fake-provider"), "route does not instantiate fake provider directly");
const publicSurfaces = [uiSources[0], uiSources[1], contractRaw, vectorsRaw, await readFile(new URL("../product-acceptance/V2_BETA2_PROFESSOR_PLAYBOOK.md", import.meta.url), "utf8"), await readFile(new URL("../lib/v2-beta2/product-acceptance.ts", import.meta.url), "utf8")].join("\n");
check(!/OLD_MIKE_V2_BETA2_(?:LIVE_PROVIDER|OPENCLAW|DURABLE_LOOKUP)|OPENCLAW_|https?:\/\/|GATEWAY_TOKEN|openclaw-provider-adapter|provider-runtime/iu.test(publicSurfaces), "public acceptance surfaces expose no provider env, URL, credential, or server-only adapter identity");
equal(consumedVectorKinds.size, 8, "all eight behavioral vector kinds are consumed");
const runnerSource = await readFile(new URL("./run-v2-beta2-product-acceptance.ps1", import.meta.url), "utf8");
const launcherSource = await readFile(new URL("./run-v2-beta2-product-acceptance.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
equal(packageJson.scripts["test:v2-beta2:product-acceptance"], "node scripts/run-v2-beta2-product-acceptance.mjs", "package exposes one canonical launcher command");
check(!Object.keys(packageJson.scripts).some((name) => name !== "test:v2-beta2:product-acceptance" && name.includes("v2-beta2:product-acceptance")), "no direct verifier or PowerShell acceptance alias remains");
check([1, 2, 3].every((legacy) => !runnerSource.includes(`old-mike-v2-beta2/product-acceptance/${legacy}`)), "inner runner rejects legacy identity and derives current identity");
check(!/(?:from\s+|import\s*\()\s*["'][^"']*product-acceptance\.ts/gu.test(launcherSource) && !launcherSource.includes("experimental-strip-types"), "outer launcher uses Node built-ins only and imports no product TypeScript");
check(launcherSource.includes('shell: false') && launcherSource.includes('"wx"') && launcherSource.includes("taskkill.exe"), "outer launcher freezes no-shell spawn, exclusive writes, and bounded tree termination");

stage = "ACCEPTANCE_BUNDLE";
const bundle = await computeAcceptanceBundle();
equal(bundle.entries.length, 10, "acceptance bundle contains exactly ten product files");
equal(bundle.entries.map((entry) => entry.relativePath).join("\n"), ACCEPTANCE_BUNDLE_PATHS.join("\n"), "acceptance bundle uses UTF-16 code-unit ordinal path order");
check(bundle.entries.every((entry) => /^[0-9a-f]{64}$/u.test(entry.sha256) && entry.size > 0), "acceptance bundle file authorities are exact");
const bundleSources = await Promise.all(ACCEPTANCE_BUNDLE_PATHS.map((relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8")));
check(bundleSources.every((sourceText) => !sourceText.includes(bundle.acceptanceBundleSha256)), "acceptance bundle value is never written back into a bundled leaf");
const identityResult = parseV2Beta2ProductAcceptanceVerifierResult({
  schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_VERIFIER_RESULT_SCHEMA_ID,
  status: "PASS",
  contractId: contract.contractId,
  productContract: contract.productContract,
  acceptanceBundleSha256: bundle.acceptanceBundleSha256,
  contractFileSha256: sha256(contractBytes),
  vectorsFileSha256: sha256(vectorsBytes),
  knownAnswerCount: vectors.materialHashKnownAnswers.length,
  behavioralVectorCount: vectors.vectors.length,
  assertions: 1,
  faultMatrixCases: 12,
  externalEffects: 0,
  trustClass: contract.trustCeiling,
});
stage = "TOTAL_TERMINAL";
const zeroHash = sha256(Buffer.alloc(0));
const attemptId = "0123456789abcdef0123456789abcdef";
const leaf = (path) => ({ path, size: 1, sha256: identityResult.acceptanceBundleSha256 });
const productAuthority = { fileCount: 727, totalBytes: 1, entryStreamBytes: 1, entryStreamSha256: identityResult.acceptanceBundleSha256 };
const environment = [
  { key: "SystemRoot", value: "C:\\Windows" }, { key: "WINDIR", value: "C:\\Windows" },
  { key: "ComSpec", value: "C:\\Windows\\System32\\cmd.exe" }, { key: "PATH", value: "C:\\node;C:\\Windows\\System32" },
  { key: "TEMP", value: "C:\\evidence\\attempt\\child-temp" }, { key: "TMP", value: "C:\\evidence\\attempt\\child-temp" },
];
const environmentFingerprint = sha256(Buffer.from(environment.map(({ key, value }) => `${key}\0${value}\n`).join(""), "utf8"));
const start = parseV2Beta2ProductAcceptanceAttemptStart({
  schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_ATTEMPT_START_SCHEMA_ID, status: "STARTED", runKey: identityResult.acceptanceBundleSha256, attemptId,
  productAuthority, acceptanceBundleSha256: identityResult.acceptanceBundleSha256,
  authorityRootIdentity: { resolvedPath: "C:\\evidence", volumeIdentity: "7", fileIdentity: "11" }, claimAuthority: leaf("claim.json"),
  tools: { launcher: leaf("scripts/run-v2-beta2-product-acceptance.mjs"), runner: leaf("scripts/run-v2-beta2-product-acceptance.ps1"), node: leaf("node.exe"), powershell: leaf("powershell.exe"), taskkill: leaf("taskkill.exe") },
  argv: ["-NoProfile", "-File", "runner.ps1"], cwd: "C:\\product", environment, environmentFingerprint,
  ownedRoot: "C:\\evidence\\attempt", observationReceiptPath: "C:\\evidence\\attempt\\observation-receipt.json", cleanupReceiptPath: "C:\\evidence\\attempt\\cleanup-receipt.json", innerOutcomePath: "C:\\evidence\\attempt\\inner-outcome.json",
  postgresPort: 43121, webPort: 43122, deadlineMs: 900000,
});
equal(JSON.parse(serializeV2Beta2ProductAcceptanceAttemptStart(start)).schemaId, V2_BETA2_PRODUCT_ACCEPTANCE_ATTEMPT_START_SCHEMA_ID, "STARTED strict record serializes with /4 identity");
const blankObservationData = () => ({ method: null, path: null, statusCode: null, operation: null, replayed: null, providerSubmissionDelta: null, snapshotAppendDelta: null, eventAppendDelta: null, formalResearchWriteCount: null, liveProviderCallCount: null, projectId: null, revision: null, snapshotPresent: null, jobId: null, providerSubmissionCount: null, stageOutcome: null, authOutcome: null, provenanceStage: null, contentByteLength: null, contentHash: null });
let previousEntryHash = "0".repeat(64);
const syntheticLedger = Array.from({ length: 20 }, (_, index) => {
  const base = { sequence: index + 1, kind: "ASSERTION", label: `SYNTHETIC_${String(index + 1).padStart(2, "0")}`, data: blankObservationData(), previousEntryHash };
  const entry = { ...base, entryHash: sha256(Buffer.from(JSON.stringify(base), "utf8")) };
  previousEntryHash = entry.entryHash;
  return entry;
});
const counts = { journeys: 1, viewports: 2, successfulAuthSessions: 7, productGetRequests: 12, productPostRequests: 7, providerSubmissions: 4, snapshots: 4, events: 6, reloads: 2, idempotentReplays: 1, idempotencyConflicts: 1, unknownLookupRequests: 1, formalResearchWrites: 0, nonloopbackBrowserRequests: 0, axeSerious: 0, axeCritical: 0, keyboardFocusChecks: 1, liveRegionChecks: 1 };
const observation = parseV2Beta2ProductAcceptanceObservationReceipt({
  schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_OBSERVATION_RECEIPT_SCHEMA_ID, status: "PASS", attemptId, ledger: syntheticLedger, ledgerSha256: previousEntryHash, counters: counts,
  externalEffects: { liveProvider: 0, formalResearchWrite: 0, nonloopbackNetwork: 0 },
  byteProvenance: { apiFileCrlf: { stage: "ORIGINAL_API_OR_FILE_STRING", contentByteLength: 50, contentHash: "5be5c122cb4c06ebc61556389f3240c15b7dfc942bf301d2c7c4e009fd07f071" }, browserDomLf: { stage: "BROWSER_DOM_TEXT_VALUE", contentByteLength: 49, contentHash: "256a44a40bc20a0c09b7c94277c33ad64a142f823c4d899de2178e78ad28a685" } }, assertions: 20,
});
equal(JSON.parse(serializeV2Beta2ProductAcceptanceObservationReceipt(observation)).counters.providerSubmissions, 4, "observation receipt serializes derived counts");
const cleanupReceipt = parseV2Beta2ProductAcceptanceCleanupReceipt({ schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_CLEANUP_RECEIPT_SCHEMA_ID, status: "PASS", attemptId, environmentFingerprint, registeredPids: [100], descendantPids: [101], listenerPorts: [43121, 43122], ownedRootInventory: ["attempt-start.json", "observation-receipt.json"], listenerCount: 0, processResidualCount: 0, tempResidualCount: 0 });
equal(JSON.parse(serializeV2Beta2ProductAcceptanceCleanupReceipt(cleanupReceipt)).status, "PASS", "cleanup receipt serializes exact observations");
const inner = parseV2Beta2ProductAcceptanceInnerOutcome({
  schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_INNER_OUTCOME_SCHEMA_ID, status: "PASS", attemptId,
  contractId: identityResult.contractId, runtimeContract: identityResult.productContract, environmentFingerprint,
  acceptanceBundleSha256: identityResult.acceptanceBundleSha256, contractFileSha256: identityResult.contractFileSha256, vectorsFileSha256: identityResult.vectorsFileSha256,
  acceptanceAuthorityAssertions: identityResult.assertions,
  observationReceiptAuthority: leaf("observation-receipt.json"), cleanupReceiptAuthority: leaf("cleanup-receipt.json"),
  databaseObservation: { jobs: 4, providerSubmissions: 4, snapshots: 4, events: 6, formalResearchWrites: 0 }, counts,
  externalEffects: { liveProvider: 0, formalResearchWrite: 0, nonloopbackNetwork: 0 },
  protocol: { verifier: "PASS", database: "PASS", browser: "PASS", environment: "PASS" }, cleanup: { status: "PASS", listenerCount: 0, processResidualCount: 0, tempResidualCount: 0 }, primaryFailure: null, cleanupFailure: null,
});
equal(JSON.parse(serializeV2Beta2ProductAcceptanceInnerOutcome(inner)).counts.providerSubmissions, 4, "inner outcome binds total effect counts");
const terminal = parseV2Beta2ProductAcceptanceLauncherTerminal({
  schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_LAUNCHER_TERMINAL_SCHEMA_ID, status: "PASS", runKey: identityResult.acceptanceBundleSha256, attemptId, duplicateClaim: false,
  claimAuthority: leaf("claim.json"), startedAuthority: leaf("attempt-start.json"), innerOutcomeAuthority: leaf("inner-outcome.json"), observationReceiptAuthority: leaf("observation-receipt.json"), cleanupReceiptAuthority: leaf("cleanup-receipt.json"),
  childObservation: { spawnAttempted: true, pid: 100, exitCode: 0, signal: null, timedOut: false, overflowed: false, stdoutBytes: 0, stdoutSha256: zeroHash, stderrBytes: 0, stderrSha256: zeroHash, gracefulTerminationAttempted: false, forcedTerminationAttempted: false },
  environmentFingerprint, childEnvironmentFingerprint: environmentFingerprint,
  preProductAuthority: productAuthority, postProductAuthority: productAuthority, preAcceptanceBundleSha256: identityResult.acceptanceBundleSha256, postAcceptanceBundleSha256: identityResult.acceptanceBundleSha256,
  outerCleanup: { status: "PASS", listenerCount: 0, processResidualCount: 0, tempResidualCount: 0 }, primaryFailure: null, cleanupFailure: null,
});
equal(JSON.parse(serializeV2Beta2ProductAcceptanceLauncherTerminal(terminal)).status, "PASS", "launcher terminal serializes a strict total PASS");
for (const mutate of [
  (value) => { value.childObservation.exitCode = 1; },
  (value) => { value.childObservation.signal = "SIGTERM"; },
  (value) => { value.childObservation.timedOut = true; },
  (value) => { value.childObservation.overflowed = true; },
  (value) => { value.outerCleanup.status = "UNKNOWN"; },
  (value) => { value.postAcceptanceBundleSha256 = `${value.postAcceptanceBundleSha256.slice(0, 63)}0`; },
]) {
  const candidate = structuredClone(terminal);
  mutate(candidate);
  throws(() => parseV2Beta2ProductAcceptanceLauncherTerminal(candidate), "beta2_product_acceptance_launcher_terminal_invalid");
}
for (const legacy of [1, 2, 3]) {
  throws(() => parseV2Beta2ProductAcceptanceAttemptStart({ ...start, schemaId: `old-mike-v2-beta2/product-acceptance-attempt-start/${legacy}` }), "beta2_product_acceptance_attempt_start_invalid");
  throws(() => parseV2Beta2ProductAcceptanceObservationReceipt({ ...observation, schemaId: `old-mike-v2-beta2/product-acceptance-observation-receipt/${legacy}` }), "beta2_product_acceptance_observation_receipt_invalid");
  throws(() => parseV2Beta2ProductAcceptanceCleanupReceipt({ ...cleanupReceipt, schemaId: `old-mike-v2-beta2/product-acceptance-cleanup-receipt/${legacy}` }), "beta2_product_acceptance_cleanup_receipt_invalid");
  throws(() => parseV2Beta2ProductAcceptanceInnerOutcome({ ...inner, schemaId: `old-mike-v2-beta2/product-acceptance-inner-outcome/${legacy}` }), "beta2_product_acceptance_inner_outcome_invalid");
  throws(() => parseV2Beta2ProductAcceptanceLauncherTerminal({ ...terminal, schemaId: `old-mike-v2-beta2/product-acceptance-launcher-terminal/${legacy}` }), "beta2_product_acceptance_launcher_terminal_invalid");
}
const missingCleanup = structuredClone(inner);
delete missingCleanup.cleanup;
throws(() => parseV2Beta2ProductAcceptanceInnerOutcome(missingCleanup), "beta2_product_acceptance_inner_outcome_invalid");
throws(() => parseV2Beta2ProductAcceptanceVerifierResult({ ...identityResult, extra: true }), "beta2_product_acceptance_verifier_result_invalid");
throws(() => parseV2Beta2ProductAcceptanceVerifierResult({ ...identityResult, contractFileSha256: 42 }), "beta2_product_acceptance_verifier_result_invalid");

stage = "FAULT_MATRIX";
const faultRoot = path.join(os.tmpdir(), `old-mike-v2-beta2-acceptance-v4-fault-${process.pid}-${Date.now()}`);
const faultResult = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./run-v2-beta2-product-acceptance.mjs", import.meta.url)), "--self-test-fault-matrix", faultRoot], { cwd: process.cwd(), env: process.env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const stdout = []; const stderr = []; let stdoutBytes = 0; let stderrBytes = 0;
  child.stdout.on("data", (chunk) => { stdoutBytes += chunk.length; if (stdoutBytes <= 1_048_576) stdout.push(chunk); });
  child.stderr.on("data", (chunk) => { stderrBytes += chunk.length; if (stderrBytes <= 1_048_576) stderr.push(chunk); });
  child.once("error", reject);
  child.once("close", (exitCode, signal) => {
    if (exitCode !== 0 || signal !== null || stdoutBytes > 1_048_576 || stderrBytes > 1_048_576) { reject(new Error("FAULT_MATRIX_EXECUTION_FAILED")); return; }
    const lines = Buffer.concat(stdout).toString("utf8").trim().split(/\r?\n/u).filter(Boolean);
    if (lines.length !== 1) { reject(new Error("FAULT_MATRIX_TERMINAL_INVALID")); return; }
    try { resolve(JSON.parse(lines[0])); } catch { reject(new Error("FAULT_MATRIX_TERMINAL_INVALID")); }
  });
});
equal(faultResult.status, "PASS", "actual launcher fault matrix passes");
equal(faultResult.caseCount, 12, "actual launcher fault matrix executes twelve lifecycle cases");
check(faultResult.cases.every((item) => ["BLOCKED", "FAIL", "EXTERNAL_BLOCKED"].includes(item.disposition)), "fault matrix dispositions are exact and fail closed");
check(faultResult.productHttp === 0 && faultResult.liveProvider === 0 && faultResult.database === 0 && faultResult.formalResearchWrite === 0 && faultResult.nonloopbackNetwork === 0, "fault matrix has zero product and external effects");

stage = "COMPLETE";
return parseV2Beta2ProductAcceptanceVerifierResult({
  schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_VERIFIER_RESULT_SCHEMA_ID,
  status: "PASS",
  contractId: contract.contractId,
  productContract: contract.productContract,
  acceptanceBundleSha256: bundle.acceptanceBundleSha256,
  contractFileSha256: sha256(contractBytes),
  vectorsFileSha256: sha256(vectorsBytes),
  knownAnswerCount: vectors.materialHashKnownAnswers.length,
  behavioralVectorCount: vectors.vectors.length,
  assertions,
  faultMatrixCases: 12,
  externalEffects: 0,
  trustClass: contract.trustCeiling,
});
}

function sanitizedFailureReason(error) {
  const source = error instanceof Error ? error.message : "VERIFICATION_ASSERTION_FAILED";
  const token = source.toUpperCase().replace(/[^A-Z0-9]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, 96);
  return /^[A-Z][A-Z0-9_]{2,95}$/u.test(token) ? token : "VERIFICATION_ASSERTION_FAILED";
}

try {
  console.log(JSON.stringify(await main()));
} catch (error) {
  console.log(JSON.stringify(parseV2Beta2ProductAcceptanceVerifierResult({
    schemaId: V2_BETA2_PRODUCT_ACCEPTANCE_VERIFIER_RESULT_SCHEMA_ID,
    status: "FAIL",
    stage,
    reasonCode: sanitizedFailureReason(error),
  })));
  process.exitCode = 1;
}
