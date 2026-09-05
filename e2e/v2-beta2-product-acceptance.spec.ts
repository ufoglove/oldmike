import { expect, test, type Browser, type Page } from "@playwright/test";
import axe from "axe-core";
import { createHash } from "node:crypto";
import { closeSync, fsyncSync, linkSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { createV2Beta2Source, type V2Beta2Material } from "../lib/v2-beta2/contracts";
import { V2_BETA2_ACCEPTANCE_CONTROLS as CONTROL, V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID, parseV2Beta2ProductAcceptanceVectors } from "../lib/v2-beta2/product-acceptance";
import acceptanceVectorsJson from "../product-acceptance/v2-beta2-product-acceptance.vectors.json";

const PROJECT_ID = "beta2-project-01";
const API_PATH = `/api/v2-beta2/projects/${PROJECT_ID}`;
const VECTORS = parseV2Beta2ProductAcceptanceVectors(acceptanceVectorsJson);
const vector = (kind: string) => {
  const found = VECTORS.vectors.find((item) => item.kind === kind);
  if (!found) throw new Error(`acceptance_vector_missing:${kind}`);
  return found;
};
const PARTIAL_VECTOR = vector("PARTIAL_SUCCESS");
const BROWSER_DOM_VECTOR = vector("PARTIAL_BROWSER_DOM");
const API_MATERIALS = PARTIAL_VECTOR.materials as Array<{ materialId: string; kind: "ABSTRACT" | "INTRODUCTION" | "METHODS" | "RESULTS" | "STATISTICS"; title: string; content: string; contentByteLength: number; contentHash: string }>;
const MATERIALS = API_MATERIALS.map((material) => material.materialId === BROWSER_DOM_VECTOR.targetMaterialId
  ? { ...material, content: BROWSER_DOM_VECTOR.content as string, contentByteLength: BROWSER_DOM_VECTOR.contentByteLength as number, contentHash: BROWSER_DOM_VECTOR.contentHash as string }
  : material);
const UI_MATERIAL_IDS = ["beta2-material-01", "beta2-material-02", "beta2-material-04"] as const;
const S0_FIELDS = ["workingTitle", "domain", "outputTrack", "problemContext", "targetUsers", "expectedContribution", "existingData", "availableData", "methodIdea", "timeline", "constraints", "ethicsPrivacyRisks", "unresolvedItems"] as const;
const EMAIL = process.env.BETA2_E2E_ACTIVE_EMAIL;
const PASSWORD = process.env.BETA2_E2E_ACTIVE_PASSWORD;
const DISABLED_EMAIL = process.env.BETA2_E2E_DISABLED_EMAIL;
const DISABLED_PASSWORD = process.env.BETA2_E2E_DISABLED_PASSWORD;
const CHANGE_EMAIL = process.env.BETA2_E2E_CHANGE_EMAIL;
const CHANGE_PASSWORD = process.env.BETA2_E2E_CHANGE_PASSWORD;
const OBSERVATION_PATH = process.env.BETA2_ACCEPTANCE_OBSERVATION_PATH;
const BROWSER_FAILURE_PATH = OBSERVATION_PATH ? join(dirname(OBSERVATION_PATH), "browser-failure.json") : undefined;
const ATTEMPT_ID = process.env.BETA2_ACCEPTANCE_ATTEMPT_ID ?? "0".repeat(32);
if (![EMAIL, PASSWORD, DISABLED_EMAIL, DISABLED_PASSWORD, CHANGE_EMAIL, CHANGE_PASSWORD].every(Boolean)) throw new Error("beta2_product_acceptance_auth_fixture_missing");

type ObservationKind = "ACTION" | "REQUEST" | "RESPONSE" | "ASSERTION";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const observationData = (value: Partial<{
  method: string; path: string; statusCode: number; operation: string; replayed: boolean;
  providerSubmissionDelta: number; snapshotAppendDelta: number; eventAppendDelta: number;
  formalResearchWriteCount: number; liveProviderCallCount: number; projectId: string; revision: number;
  snapshotPresent: boolean; jobId: string; providerSubmissionCount: number; stageOutcome: string;
  authOutcome: string; provenanceStage: string; contentByteLength: number; contentHash: string;
}> = {}) => ({
  method: value.method ?? null, path: value.path ?? null, statusCode: value.statusCode ?? null, operation: value.operation ?? null,
  replayed: value.replayed ?? null, providerSubmissionDelta: value.providerSubmissionDelta ?? null, snapshotAppendDelta: value.snapshotAppendDelta ?? null,
  eventAppendDelta: value.eventAppendDelta ?? null, formalResearchWriteCount: value.formalResearchWriteCount ?? null, liveProviderCallCount: value.liveProviderCallCount ?? null,
  projectId: value.projectId ?? null, revision: value.revision ?? null, snapshotPresent: value.snapshotPresent ?? null, jobId: value.jobId ?? null,
  providerSubmissionCount: value.providerSubmissionCount ?? null, stageOutcome: value.stageOutcome ?? null, authOutcome: value.authOutcome ?? null,
  provenanceStage: value.provenanceStage ?? null, contentByteLength: value.contentByteLength ?? null, contentHash: value.contentHash ?? null,
});
type ObservationData = ReturnType<typeof observationData>;
const observationLedger: Array<{ sequence: number; kind: ObservationKind; label: string; data: ObservationData; previousEntryHash: string; entryHash: string }> = [];

function appendObservation(kind: ObservationKind, label: string, data: ObservationData = observationData()) {
  const sequence = observationLedger.length + 1;
  const previousEntryHash = observationLedger.at(-1)?.entryHash ?? "0".repeat(64);
  const entryHash = hash(JSON.stringify({ sequence, kind, label, data, previousEntryHash }));
  observationLedger.push({ sequence, kind, label, data, previousEntryHash, entryHash });
}

function observeEnvelope(label: string, statusCode: number, value: Record<string, unknown>) {
  const project = value.project && typeof value.project === "object" && !Array.isArray(value.project) ? value.project as Record<string, unknown> : null;
  const stage = project?.stageOutcome && typeof project.stageOutcome === "object" && !Array.isArray(project.stageOutcome) ? project.stageOutcome as Record<string, unknown> : null;
  appendObservation("RESPONSE", label, observationData({
    statusCode, operation: typeof value.operation === "string" ? value.operation : undefined, replayed: typeof value.replayed === "boolean" ? value.replayed : undefined,
    providerSubmissionDelta: typeof value.providerSubmissionDelta === "number" ? value.providerSubmissionDelta : undefined,
    snapshotAppendDelta: typeof value.snapshotAppendDelta === "number" ? value.snapshotAppendDelta : undefined,
    eventAppendDelta: typeof value.eventAppendDelta === "number" ? value.eventAppendDelta : undefined,
    formalResearchWriteCount: typeof value.formalResearchWriteCount === "number" ? value.formalResearchWriteCount : undefined,
    liveProviderCallCount: typeof value.liveProviderCallCount === "number" ? value.liveProviderCallCount : undefined,
    projectId: typeof project?.projectId === "string" ? project.projectId : undefined, revision: typeof project?.revision === "number" ? project.revision : undefined,
    snapshotPresent: project ? project.snapshot !== null : undefined, jobId: typeof stage?.jobId === "string" ? stage.jobId : undefined,
    providerSubmissionCount: typeof stage?.providerSubmissionCount === "number" ? stage.providerSubmissionCount : undefined,
    stageOutcome: typeof stage?.status === "string" ? stage.status : undefined,
  }));
}

function observeRequest(label: string, method: "GET" | "POST", requestPath: string, operation?: string) {
  appendObservation("REQUEST", label, observationData({ method, path: requestPath, operation }));
}

function sealObservationReceipt() {
  if (!OBSERVATION_PATH) return;
  const requests = observationLedger.filter((entry) => entry.kind === "REQUEST");
  const responses = observationLedger.filter((entry) => entry.kind === "RESPONSE");
  const providerJobs = new Set(responses.filter((entry) => entry.data.providerSubmissionCount === 1 && entry.data.jobId).map((entry) => entry.data.jobId));
  const snapshots = new Set(responses.filter((entry) => entry.data.snapshotPresent && entry.data.projectId && entry.data.revision !== null).map((entry) => `${entry.data.projectId}:${entry.data.revision}`));
  const nonsnapshotStageJobs = new Set(responses.filter((entry) => entry.data.jobId && entry.data.stageOutcome && entry.data.stageOutcome !== "COMPLETE").map((entry) => entry.data.jobId));
  const formalResearchWrites = Math.max(0, ...responses.map((entry) => entry.data.formalResearchWriteCount ?? 0));
  const liveProviderCalls = Math.max(0, ...responses.map((entry) => entry.data.liveProviderCallCount ?? 0));
  const counters = {
    journeys: 1, viewports: new Set(observationLedger.filter((entry) => entry.label.endsWith("_AXE_ZERO")).map((entry) => entry.label)).size,
    successfulAuthSessions: observationLedger.filter((entry) => entry.label === "AUTH_RESPONSE" && entry.data.statusCode === 200).length,
    productGetRequests: requests.filter((entry) => entry.data.method === "GET").length, productPostRequests: requests.filter((entry) => entry.data.method === "POST").length,
    providerSubmissions: providerJobs.size, snapshots: snapshots.size, events: snapshots.size + nonsnapshotStageJobs.size,
    reloads: observationLedger.filter((entry) => entry.label === "RELOAD").length,
    idempotentReplays: responses.filter((entry) => entry.data.replayed === true && entry.data.operation === "GENERATE_DURABLE_CORE").length,
    idempotencyConflicts: responses.filter((entry) => entry.label === "IDEMPOTENCY_CONFLICT_RESPONSE" && entry.data.statusCode === 409).length,
    unknownLookupRequests: responses.filter((entry) => entry.data.operation === "RECONCILE_UNKNOWN").length,
    formalResearchWrites, nonloopbackBrowserRequests: observationLedger.filter((entry) => entry.label === "NONLOOPBACK_REQUEST").length,
    axeSerious: 0, axeCritical: 0,
    keyboardFocusChecks: observationLedger.filter((entry) => entry.label === "KEYBOARD_FOCUS_VISIBLE").length,
    liveRegionChecks: observationLedger.filter((entry) => entry.label === "LIVE_REGION_POLITE").length,
  };
  const receipt = {
    schemaId: "old-mike-v2-beta2/product-acceptance-observation-receipt/4", status: "PASS", attemptId: ATTEMPT_ID,
    ledger: observationLedger, ledgerSha256: observationLedger.at(-1)?.entryHash ?? "0".repeat(64), counters,
    externalEffects: { liveProvider: liveProviderCalls, formalResearchWrite: formalResearchWrites, nonloopbackNetwork: counters.nonloopbackBrowserRequests },
    byteProvenance: {
      apiFileCrlf: { stage: "ORIGINAL_API_OR_FILE_STRING", contentByteLength: 50, contentHash: "5be5c122cb4c06ebc61556389f3240c15b7dfc942bf301d2c7c4e009fd07f071" },
      browserDomLf: { stage: "BROWSER_DOM_TEXT_VALUE", contentByteLength: 49, contentHash: "256a44a40bc20a0c09b7c94277c33ad64a142f823c4d899de2178e78ad28a685" },
    },
    assertions: observationLedger.filter((entry) => entry.kind === "ASSERTION").length,
  };
  const bytes = Buffer.from(`${JSON.stringify(receipt)}\n`, "utf8");
  const temporary = `${OBSERVATION_PATH}.${process.pid}.tmp`;
  const descriptor = openSync(temporary, "wx", 0o600);
  try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  try { linkSync(temporary, OBSERVATION_PATH); } finally { unlinkSync(temporary); }
}

function sanitizeFailureReason(value: unknown) {
  const source = value instanceof Error ? value.message : typeof value === "string" ? value : value && typeof value === "object" && "message" in value && typeof value.message === "string" ? value.message : "PLAYWRIGHT_TEST_FAILED";
  const token = source.toUpperCase().replace(/[^A-Z0-9]+/gu, "_").replace(/^_+|_+$/gu, "").slice(0, 96);
  return /^[A-Z][A-Z0-9_]{2,95}$/u.test(token) ? token : "PLAYWRIGHT_TEST_FAILED";
}

test.afterEach(async ({}, testInfo) => {
  if (!BROWSER_FAILURE_PATH || testInfo.status === testInfo.expectedStatus) return;
  const lastObservation = observationLedger.at(-1)?.label ?? "NO_OBSERVATION";
  const receipt = { schemaId: "old-mike-v2-beta2/product-acceptance-browser-failure/4", status: "FAIL", attemptId: ATTEMPT_ID, stage: "PRODUCT_PLAYWRIGHT", reasonCode: sanitizeFailureReason(`${lastObservation}_THEN_${sanitizeFailureReason(testInfo.error)}`) };
  const temporary = `${BROWSER_FAILURE_PATH}.${process.pid}.tmp`;
  const descriptor = openSync(temporary, "wx", 0o600);
  try { writeFileSync(descriptor, Buffer.from(`${JSON.stringify(receipt)}\n`, "utf8")); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  try { linkSync(temporary, BROWSER_FAILURE_PATH); } finally { unlinkSync(temporary); }
});

function acceptance(page: Page, id: string) {
  return page.locator(`[data-acceptance-id="${id}"]`);
}

function acceptanceFamily(page: Page, id: string) {
  return page.locator(`[data-acceptance-id^="${id}:"]`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}_INVALID`);
  return value as Record<string, unknown>;
}

async function login(page: Page, email = EMAIL!, password = PASSWORD!, expectedStatus: number | "NOT_200" = 200) {
  appendObservation("ACTION", "LOGIN_SUBMIT");
  await page.goto("/login", { waitUntil: "networkidle" });
  await acceptance(page, CONTROL.loginEmail).fill(email);
  await acceptance(page, CONTROL.loginPassword).fill(password);
  const response = page.waitForResponse((candidate) => candidate.url().includes("/api/auth/sign-in/email"));
  await acceptance(page, CONTROL.loginSubmit).click();
  const status = (await response).status();
  appendObservation("RESPONSE", "AUTH_RESPONSE", observationData({ statusCode: status, authOutcome: status === 200 ? "AUTHENTICATED" : "REJECTED" }));
  if (expectedStatus === "NOT_200") expect(status).not.toBe(200);
  else expect(status).toBe(expectedStatus);
}

async function expectAccessibleAndContained(page: Page, label: "DESKTOP_AXE_ZERO" | "MOBILE_AXE_ZERO") {
  await page.addScriptTag({ content: axe.source });
  const severe = await page.evaluate(async () => {
    const instance = (window as unknown as { axe: { run: (root: Document) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
    return (await instance.run(document)).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  });
  expect(severe).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth)).toBe(false);
  appendObservation("ASSERTION", label);
}

async function openProject(page: Page, path = `/v2-beta2/projects/${PROJECT_ID}`) {
  const apiPath = path.replace("/v2-beta2/projects/", "/api/v2-beta2/projects/");
  observeRequest("PROJECT_GET_REQUEST", "GET", apiPath);
  const response = page.waitForResponse((candidate) => new URL(candidate.url()).pathname === apiPath && candidate.request().method() === "GET");
  await page.goto(path);
  await expect(acceptance(page, CONTROL.projectWorkspace)).toBeVisible();
  const resolved = await response;
  const envelope = record(await resolved.json(), "PROJECT_GET_ENVELOPE");
  observeEnvelope("PROJECT_GET_RESPONSE", resolved.status(), envelope);
  return envelope;
}

async function freshAuthenticatedPage(browser: Browser, baseURL: string | undefined, viewport: { width: number; height: number }, nonloopback?: Set<string>) {
  const context = await browser.newContext({ baseURL, viewport, serviceWorkers: "block" });
  const page = await context.newPage();
  if (nonloopback) page.on("request", (request) => { const hostname = new URL(request.url()).hostname; if (!["127.0.0.1", "localhost"].includes(hostname)) { nonloopback.add(hostname); appendObservation("REQUEST", "NONLOOPBACK_REQUEST", observationData({ method: request.method(), path: new URL(request.url()).pathname })); } });
  await login(page);
  return { context, page };
}

test("stable product acceptance: partial material, durable truth, replay, unknown no-resend, desktop and mobile", async ({ page, browser, baseURL }) => {
  appendObservation("ACTION", "JOURNEY_START");
  expect(VECTORS.contractId).toBe(V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID);
  expect(V2_BETA2_PRODUCT_ACCEPTANCE_CONTRACT_ID).toBe("old-mike-v2-beta2/product-acceptance/4");
  const partialExpected = record(PARTIAL_VECTOR.expected, "PARTIAL_EXPECTED");
  const replayExpected = vector("EXACT_REPLAY");
  const conflictExpected = vector("SAME_KEY_CONFLICT");
  const unknownExpected = vector("COMPLETION_UNKNOWN");
  const terminalExpected = vector("TERMINAL_REJECTED");
  const authorityExpected = vector("AUTHORITY_REJECT");
  const authorityStatuses = record(authorityExpected.expectedStatuses, "AUTHORITY_STATUSES");
  const nonloopback = new Set<string>();
  const operations: string[] = [];
  const bodies: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) { nonloopback.add(url.hostname); appendObservation("REQUEST", "NONLOOPBACK_REQUEST", observationData({ method: request.method(), path: url.pathname })); }
    if (url.pathname === API_PATH && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      operations.push(String(body.operation));
      bodies.push(structuredClone(body));
    }
  });

  const anonymous = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try { observeRequest("ANONYMOUS_GET_REQUEST", "GET", API_PATH); const response = await anonymous.request.get(API_PATH); appendObservation("RESPONSE", "ANONYMOUS_GET_RESPONSE", observationData({ statusCode: response.status(), authOutcome: "UNAUTHENTICATED" })); expect(response.status()).toBe(authorityStatuses.unauthenticated); } finally { await anonymous.close(); }
  await login(page);
  await openProject(page);
  await expect(acceptance(page, CONTROL.reloadResume)).toHaveText("READY");
  await acceptance(page, CONTROL.materialMode).getByRole("radio", { name: "部分材料" }).check();
  await page.getByTestId("beta2-research-direction").fill("以部分材料檢驗生成式回饋、證據校準與任務表現的作用機制");
  await page.getByTestId("beta2-output-target").selectOption("SSCI");
  for (let index = 1; index < MATERIALS.length; index += 1) await page.getByRole("button", { name: "新增材料" }).click();
  await expect(acceptanceFamily(page, CONTROL.materialItem)).toHaveCount(MATERIALS.length);
  await acceptance(page, `${CONTROL.materialItem}:beta2-material-03`).getByRole("button", { name: "移除" }).click();
  await page.getByRole("button", { name: "新增材料" }).click();
  await expect(acceptance(page, `${CONTROL.materialItem}:beta2-material-03`)).toHaveCount(0);
  await expect(acceptance(page, `${CONTROL.materialItem}:beta2-material-04`)).toHaveCount(1);
  const materialIdentityAudit = await page.evaluate(({ prefixes }) => {
    const acceptanceIds = [...document.querySelectorAll<HTMLElement>(prefixes.map((prefix) => `[data-acceptance-id^="${prefix}:"]`).join(","))].map((node) => node.dataset.acceptanceId ?? "");
    const controls = [...document.querySelectorAll<HTMLElement>("select[id^='beta2-material-kind-'],input[id^='beta2-material-title-'],textarea[id^='beta2-material-content-']")];
    const htmlIds = controls.map((node) => node.id);
    const labelTargets = [...document.querySelectorAll<HTMLLabelElement>("label[for^='beta2-material-']")].map((label) => document.querySelectorAll(`#${CSS.escape(label.htmlFor)}`).length);
    return { acceptanceIds, htmlIds, labelTargets };
  }, { prefixes: [CONTROL.materialItem, CONTROL.materialKind, CONTROL.materialTitle, CONTROL.materialContent] });
  expect(new Set(materialIdentityAudit.acceptanceIds).size).toBe(materialIdentityAudit.acceptanceIds.length);
  expect(new Set(materialIdentityAudit.htmlIds).size).toBe(materialIdentityAudit.htmlIds.length);
  expect(materialIdentityAudit.labelTargets.every((count) => count === 1)).toBe(true);
  for (const [index, material] of MATERIALS.entries()) {
    const materialId = UI_MATERIAL_IDS[index];
    await acceptance(page, `${CONTROL.materialKind}:${materialId}`).selectOption(material.kind);
    await acceptance(page, `${CONTROL.materialTitle}:${materialId}`).fill(material.title);
    await acceptance(page, `${CONTROL.materialContent}:${materialId}`).fill(material.content);
    await expect(acceptance(page, `${CONTROL.materialKind}:${materialId}`)).toHaveCount(1);
  }

  const generateResponse = page.waitForResponse((response) => new URL(response.url()).pathname === API_PATH && response.request().method() === "POST");
  observeRequest("GENERATE_REQUEST", "POST", API_PATH, "GENERATE_DURABLE_CORE");
  await acceptance(page, CONTROL.generate).click();
  const generated = await generateResponse;
  expect(generated.status()).toBe(200);
  const generatedEnvelope = record(await generated.json(), "GENERATED_ENVELOPE");
  observeEnvelope("GENERATE_RESPONSE", generated.status(), generatedEnvelope);
  expect(generatedEnvelope.operation).toBe("GENERATE_DURABLE_CORE");
  expect(generatedEnvelope.providerSubmissionDelta).toBe(1);
  expect(generatedEnvelope.formalResearchWriteCount).toBe(partialExpected.formalResearchWrites);
  expect(generatedEnvelope.liveProviderCallCount).toBe(0);
  const generatedProject = record(generatedEnvelope.project, "GENERATED_PROJECT");
  const generatedSnapshot = record(generatedProject.snapshot, "GENERATED_SNAPSHOT");
  const generatedSource = record(generatedSnapshot.source, "GENERATED_SOURCE");
  const generatedMaterials = generatedSource.materials as Array<Record<string, unknown>>;
  expect(generatedMaterials.map(({ materialId }) => materialId)).toEqual(UI_MATERIAL_IDS);
  expect(generatedMaterials.map(({ kind, title, content }) => ({ kind, title, content }))).toEqual(MATERIALS.map(({ kind, title, content }) => ({ kind, title, content })));
  expect(generatedMaterials.map((item) => item.contentByteLength)).toEqual(MATERIALS.map((item) => item.contentByteLength));
  expect(generatedMaterials.map((item) => item.contentHash)).toEqual(MATERIALS.map((item) => item.contentHash));
  expect(generatedSource.materialCoverage).toEqual({ ABSTRACT: "PROVIDED_UNVERIFIED", INTRODUCTION: "MISSING", METHODS: "PROVIDED_UNVERIFIED", RESULTS: "PROVIDED_UNVERIFIED", STATISTICS: "MISSING" });

  await expect(acceptance(page, CONTROL.directionList).locator(`[data-acceptance-id^="${CONTROL.direction}:"]`)).toHaveCount(partialExpected.directionCount as number);
  await expect(acceptance(page, `${CONTROL.direction}:${String(partialExpected.recommendedLane)}`)).toContainText("推薦");
  for (const field of S0_FIELDS) await expect(acceptance(page, `${CONTROL.s0}:${field}`)).not.toBeEmpty();
  expect(S0_FIELDS).toHaveLength(partialExpected.s0FieldCount as number);
  await acceptance(page, CONTROL.assist).locator("summary").click();
  await expect(page.getByTestId("beta2-assist-option")).toHaveCount(39);
  const postsBeforePreview = operations.length;
  const assist = acceptance(page, `${CONTROL.assist}:workingTitle`);
  await assist.getByTestId("beta2-assist-option").first().getByRole("button").click();
  await expect(acceptance(page, CONTROL.status)).toContainText("沒有新增 POST");
  await assist.getByRole("button", { name: "復原此欄" }).click();
  expect(operations).toHaveLength(postsBeforePreview);

  await acceptance(page, `${CONTROL.direction}:FRONTIER_INNOVATION`).click();
  const selectionResponse = page.waitForResponse((response) => new URL(response.url()).pathname === API_PATH && response.request().method() === "POST");
  observeRequest("SELECTION_REQUEST", "POST", API_PATH, "SAVE_DIRECTION_SELECTION");
  await acceptance(page, CONTROL.saveSelection).click();
  const selectionResolved = await selectionResponse;
  const selection = record(await selectionResolved.json(), "SELECTION_ENVELOPE");
  observeEnvelope("SELECTION_RESPONSE", selectionResolved.status(), selection);
  expect(selection.providerSubmissionDelta).toBe(0);
  expect(record(selection.project, "SELECTION_PROJECT").revision).toBe(2);

  const selectedAssist = acceptance(page, `${CONTROL.assist}:workingTitle`).getByTestId("beta2-assist-option").nth(1);
  await selectedAssist.getByRole("button").click();
  const saveResponse = page.waitForResponse((response) => new URL(response.url()).pathname === API_PATH && response.request().method() === "POST");
  observeRequest("WORKSPACE_SAVE_REQUEST", "POST", API_PATH, "SAVE_CONFIRMED_WORKSPACE");
  await acceptance(page, CONTROL.saveWorkspace).click();
  const saveResolved = await saveResponse;
  const saved = record(await saveResolved.json(), "SAVE_ENVELOPE");
  observeEnvelope("WORKSPACE_SAVE_RESPONSE", saveResolved.status(), saved);
  expect(saved.providerSubmissionDelta).toBe(0);
  expect(saved.snapshotAppendDelta).toBe(1);
  expect(saved.eventAppendDelta).toBe(1);
  const savedProject = record(saved.project, "SAVED_PROJECT");
  expect(savedProject.revision).toBe(3);
  await expect(acceptance(page, CONTROL.reloadResume)).toHaveText("CONFIRMED");
  await expect(acceptance(page, CONTROL.humanGate)).toContainText("Human Gate");

  const generationBody = bodies.find((body) => body.operation === "GENERATE_DURABLE_CORE");
  if (!generationBody) throw new Error("ACCEPTANCE_GENERATION_BODY_MISSING");
  observeRequest("REPLAY_REQUEST", "POST", API_PATH, "GENERATE_DURABLE_CORE");
  const replay = await page.request.post(API_PATH, { data: generationBody });
  expect(replay.status()).toBe(200);
  const replayEnvelope = record(await replay.json(), "REPLAY_ENVELOPE");
  observeEnvelope("REPLAY_RESPONSE", replay.status(), replayEnvelope);
  expect(replayEnvelope).toMatchObject({ replayed: true, providerSubmissionDelta: replayExpected.expectedSubmissionDelta, snapshotAppendDelta: replayExpected.expectedAppendDelta, eventAppendDelta: replayExpected.expectedAppendDelta });
  const conflictBody = structuredClone(generationBody);
  conflictBody.source = createV2Beta2Source({ entryMode: "PARTIAL_MATERIAL", researchDirection: "changed payload", outputTarget: "SSCI", materials: generatedMaterials as unknown as V2Beta2Material[] });
  observeRequest("IDEMPOTENCY_CONFLICT_REQUEST", "POST", API_PATH, "GENERATE_DURABLE_CORE");
  const conflict = await page.request.post(API_PATH, { data: conflictBody });
  expect(conflict.status()).toBe(409);
  const conflictEnvelope = record(await conflict.json(), "CONFLICT_ENVELOPE");
  appendObservation("RESPONSE", "IDEMPOTENCY_CONFLICT_RESPONSE", observationData({ statusCode: conflict.status(), operation: "GENERATE_DURABLE_CORE" }));
  expect(conflictEnvelope.code).toBe(conflictExpected.expectedCode);
  observeRequest("AFTER_CONFLICT_GET_REQUEST", "GET", API_PATH);
  const afterConflictResponse = await page.request.get(API_PATH);
  const afterConflict = record(await afterConflictResponse.json(), "AFTER_CONFLICT");
  observeEnvelope("AFTER_CONFLICT_GET_RESPONSE", afterConflictResponse.status(), afterConflict);
  expect(afterConflict.project).toEqual(saved.project);
  expect(conflictExpected.expectedEffectDelta).toBe(0);

  appendObservation("ACTION", "RELOAD");
  observeRequest("MAIN_RELOAD_GET_REQUEST", "GET", API_PATH);
  const mainReloadResponse = page.waitForResponse((response) => new URL(response.url()).pathname === API_PATH && response.request().method() === "GET");
  await page.reload({ waitUntil: "networkidle" });
  const mainReloadResolved = await mainReloadResponse;
  observeEnvelope("MAIN_RELOAD_GET_RESPONSE", mainReloadResolved.status(), record(await mainReloadResolved.json(), "MAIN_RELOAD_ENVELOPE"));
  await expect(acceptance(page, CONTROL.reloadResume)).toHaveText("CONFIRMED");
  expect(operations.filter((operation) => operation === "GENERATE_DURABLE_CORE")).toHaveLength(1);
  await expectAccessibleAndContained(page, "DESKTOP_AXE_ZERO");
  await page.setViewportSize({ width: 390, height: 844 });
  await expectAccessibleAndContained(page, "MOBILE_AXE_ZERO");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null)).toBe(true);
  appendObservation("ASSERTION", "KEYBOARD_FOCUS_VISIBLE");
  await expect(acceptance(page, CONTROL.status)).toHaveAttribute("role", "status");
  await expect(acceptance(page, CONTROL.status)).toHaveAttribute("aria-live", "polite");
  appendObservation("ASSERTION", "LIVE_REGION_POLITE");

  let resumedProjectForDirect: Record<string, unknown> | null = null;
  const resumed = await freshAuthenticatedPage(browser, baseURL, { width: 360, height: 640 }, nonloopback);
  try {
    const resumedEnvelope = await openProject(resumed.page);
    expect(resumedEnvelope.requestAuthority).toBeNull();
    expect(resumedEnvelope.project).toEqual(saved.project);
    resumedProjectForDirect = record(resumedEnvelope.project, "RESUMED_PROJECT_FOR_DIRECT");
    await expect(acceptance(resumed.page, CONTROL.reloadResume)).toHaveText("CONFIRMED");
    observeRequest("CROSS_TENANT_GET_REQUEST", "GET", "/api/v2-beta2/projects/beta2-project-other"); const cross = await resumed.context.request.get("/api/v2-beta2/projects/beta2-project-other"); appendObservation("RESPONSE", "CROSS_TENANT_GET_RESPONSE", observationData({ statusCode: cross.status(), authOutcome: "CROSS_TENANT_REJECTED" })); expect(cross.status()).toBe(authorityStatuses.crossTenant);
    observeRequest("INACTIVE_GET_REQUEST", "GET", "/api/v2-beta2/projects/beta2-project-inactive"); const inactive = await resumed.context.request.get("/api/v2-beta2/projects/beta2-project-inactive"); appendObservation("RESPONSE", "INACTIVE_GET_RESPONSE", observationData({ statusCode: inactive.status(), authOutcome: "INACTIVE_REJECTED" })); expect(inactive.status()).toBe(authorityStatuses.inactive);
    observeRequest("UNKNOWN_GET_REQUEST", "GET", "/api/v2-beta2/projects/beta2-project-unknown"); const unknown = await resumed.context.request.get("/api/v2-beta2/projects/beta2-project-unknown"); appendObservation("RESPONSE", "UNKNOWN_GET_RESPONSE", observationData({ statusCode: unknown.status(), authOutcome: "UNKNOWN_REJECTED" })); expect(unknown.status()).toBe(authorityStatuses.unknown);
  } finally { await resumed.context.close(); }

  if (!resumedProjectForDirect) throw new Error("RESUMED_PROJECT_FOR_DIRECT_MISSING");
  const directApi = await freshAuthenticatedPage(browser, baseURL, { width: 390, height: 844 }, nonloopback);
  try {
    const directBody = structuredClone(generationBody);
    directBody.requestId = "beta2-acceptance-crlf-request-0001";
    directBody.idempotencyKey = "beta2-acceptance-crlf-key-0001";
    directBody.baseRevision = resumedProjectForDirect.revision;
    directBody.baseContentHash = resumedProjectForDirect.contentHash;
    directBody.source = createV2Beta2Source({
      entryMode: "PARTIAL_MATERIAL",
      researchDirection: "以原始 CRLF 部分材料驗證檔案與 API 位元組來源",
      outputTarget: "SSCI",
      materials: API_MATERIALS as V2Beta2Material[],
    });
    observeRequest("DIRECT_CRLF_GENERATE_REQUEST", "POST", API_PATH, "GENERATE_DURABLE_CORE");
    const response = await directApi.context.request.post(API_PATH, { data: directBody });
    expect(response.status()).toBe(200);
    const envelope = record(await response.json(), "DIRECT_CRLF_ENVELOPE");
    observeEnvelope("DIRECT_CRLF_GENERATE_RESPONSE", response.status(), envelope);
    expect(envelope.providerSubmissionDelta).toBe(1);
    const project = record(envelope.project, "DIRECT_CRLF_PROJECT");
    expect(project.revision).toBe(4);
    const source = record(record(project.snapshot, "DIRECT_CRLF_SNAPSHOT").source, "DIRECT_CRLF_SOURCE");
    const materials = source.materials as Array<Record<string, unknown>>;
    expect(materials.map(({ materialId, content, contentByteLength, contentHash }) => ({ materialId, content, contentByteLength, contentHash }))).toEqual(
      API_MATERIALS.map(({ materialId, content, contentByteLength, contentHash }) => ({ materialId, content, contentByteLength, contentHash })),
    );
    expect(materials.find(({ materialId }) => materialId === "acceptance-material-02")).toMatchObject({
      content: "第一行\r\n第二行；限定為未驗證材料。",
      contentByteLength: 50,
      contentHash: "5be5c122cb4c06ebc61556389f3240c15b7dfc942bf301d2c7c4e009fd07f071",
    });
    appendObservation("ASSERTION", "API_FILE_CRLF_PROVENANCE", observationData({ provenanceStage: "ORIGINAL_API_OR_FILE_STRING", contentByteLength: 50, contentHash: "5be5c122cb4c06ebc61556389f3240c15b7dfc942bf301d2c7c4e009fd07f071" }));
  } finally { await directApi.context.close(); }

  const crlfResumed = await freshAuthenticatedPage(browser, baseURL, { width: 390, height: 844 }, nonloopback);
  try {
    observeRequest("CRLF_FRESH_GET_REQUEST", "GET", API_PATH);
    const crlfResponse = await crlfResumed.context.request.get(API_PATH);
    const resumedEnvelope = record(await crlfResponse.json(), "CRLF_FRESH_RESUME");
    observeEnvelope("CRLF_FRESH_GET_RESPONSE", crlfResponse.status(), resumedEnvelope);
    const source = record(record(record(resumedEnvelope.project, "CRLF_FRESH_PROJECT").snapshot, "CRLF_FRESH_SNAPSHOT").source, "CRLF_FRESH_SOURCE");
    expect((source.materials as Array<Record<string, unknown>>).find(({ materialId }) => materialId === "acceptance-material-02")).toMatchObject({
      content: "第一行\r\n第二行；限定為未驗證材料。",
      contentByteLength: 50,
      contentHash: "5be5c122cb4c06ebc61556389f3240c15b7dfc942bf301d2c7c4e009fd07f071",
    });
  } finally { await crlfResumed.context.close(); }

  const pending = await freshAuthenticatedPage(browser, baseURL, { width: 390, height: 844 }, nonloopback);
  try {
    const pendingPath = "/api/v2-beta2/projects/beta2-project-pending";
    const pendingPosts: string[] = [];
    pending.page.on("request", (request) => { if (new URL(request.url()).pathname === pendingPath && request.method() === "POST") pendingPosts.push(request.postData() ?? ""); });
    await openProject(pending.page, "/v2-beta2/projects/beta2-project-pending");
    await expect(acceptance(pending.page, CONTROL.reloadResume)).toHaveText("RECONCILE REQUIRED");
    await expect(acceptance(pending.page, CONTROL.generate)).toHaveCount(0);
    const reconcileResponse = pending.page.waitForResponse((response) => new URL(response.url()).pathname === pendingPath && response.request().method() === "POST");
    observeRequest("RECONCILE_REQUEST", "POST", pendingPath, "RECONCILE_UNKNOWN");
    await acceptance(pending.page, CONTROL.reconciliation).getByRole("button").click();
    const reconciled = await reconcileResponse;
    expect(reconciled.status()).toBe(202);
    const reconcileEnvelope = record(await reconciled.json(), "RECONCILE_ENVELOPE");
    observeEnvelope("RECONCILE_RESPONSE", reconciled.status(), reconcileEnvelope);
    expect(reconcileEnvelope).toMatchObject({ providerSubmissionDelta: 0, snapshotAppendDelta: 0, eventAppendDelta: 0 });
    expect(pendingPosts).toHaveLength(1);
    expect(unknownExpected.expectedResubmit).toBe(0);
    expect(unknownExpected.expectedLookupOnly).toBe(true);
    appendObservation("ACTION", "RELOAD");
    observeRequest("PENDING_RELOAD_GET_REQUEST", "GET", pendingPath);
    const pendingReload = pending.page.waitForResponse((response) => new URL(response.url()).pathname === pendingPath && response.request().method() === "GET");
    await pending.page.reload({ waitUntil: "networkidle" });
    const pendingReloadResolved = await pendingReload;
    observeEnvelope("PENDING_RELOAD_GET_RESPONSE", pendingReloadResolved.status(), record(await pendingReloadResolved.json(), "PENDING_RELOAD_ENVELOPE"));
    await expect(acceptance(pending.page, CONTROL.reloadResume)).toHaveText("RECONCILE REQUIRED");
  } finally { await pending.context.close(); }

  const rejected = await freshAuthenticatedPage(browser, baseURL, { width: 390, height: 844 }, nonloopback);
  try {
    await openProject(rejected.page, "/v2-beta2/projects/beta2-project-rejected");
    await expect(acceptance(rejected.page, CONTROL.reloadResume)).toHaveText("REJECTED");
    await expect(acceptance(rejected.page, CONTROL.generate)).toHaveCount(0);
    await expect(rejected.page.getByTestId("beta2-terminal-rejected")).toContainText("不會重新提交");
    expect(terminalExpected.expectedSuccess).toBe(false);
    expect(terminalExpected.expectedResubmit).toBe(0);
  } finally { await rejected.context.close(); }

  const disabled = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try {
    const disabledPage = await disabled.newPage();
    await login(disabledPage, DISABLED_EMAIL!, DISABLED_PASSWORD!, "NOT_200");
    observeRequest("DISABLED_GET_REQUEST", "GET", API_PATH); const disabledGet = await disabled.request.get(API_PATH); appendObservation("RESPONSE", "DISABLED_GET_RESPONSE", observationData({ statusCode: disabledGet.status(), authOutcome: "DISABLED_REJECTED" })); expect(disabledGet.status()).toBe(authorityStatuses.disabled);
  } finally { await disabled.close(); }

  const passwordChange = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try {
    const passwordPage = await passwordChange.newPage();
    await login(passwordPage, CHANGE_EMAIL!, CHANGE_PASSWORD!);
    observeRequest("PASSWORD_CHANGE_GET_REQUEST", "GET", API_PATH); const passwordGet = await passwordChange.request.get(API_PATH); appendObservation("RESPONSE", "PASSWORD_CHANGE_GET_RESPONSE", observationData({ statusCode: passwordGet.status(), authOutcome: "PASSWORD_CHANGE_REQUIRED" })); expect(passwordGet.status()).toBe(authorityStatuses.passwordChangeRequired);
  } finally { await passwordChange.close(); }

  expect([...nonloopback]).toEqual([]);
  expect(authorityExpected.expectedEffectDelta).toBe(0);
  appendObservation("ASSERTION", "BROWSER_DOM_LF_PROVENANCE", observationData({ provenanceStage: "BROWSER_DOM_TEXT_VALUE", contentByteLength: 49, contentHash: "256a44a40bc20a0c09b7c94277c33ad64a142f823c4d899de2178e78ad28a685" }));
  appendObservation("ASSERTION", "NONLOOPBACK_ZERO");
  appendObservation("ACTION", "JOURNEY_COMPLETE");
  sealObservationReceipt();
});
