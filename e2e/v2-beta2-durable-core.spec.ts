import { expect, test } from "@playwright/test";
import axe from "axe-core";

const API_PATH = "/api/v2-beta2/projects/beta2-project-01";
const REJECTED_API_PATH = "/api/v2-beta2/projects/beta2-project-rejected";
const PENDING_API_PATH = "/api/v2-beta2/projects/beta2-project-pending";
const MATERIAL_FIXTURES = [
  { kind: "ABSTRACT", title: "摘要原文", content: "  摘要保留前後空白；目前僅是作者提供的未驗證敘述。  " },
  { kind: "METHODS", title: "方法原文", content: "方法第一行\n方法第二行：e\u0301 與 😀 必須逐位元組保留。" },
  { kind: "RESULTS", title: "結果原文", content: "目前只觀察到描述性差異，不支持因果或顯著性推論。" },
  { kind: "STATISTICS", title: "統計原文", content: "樣本、估計量與不確定性仍待核對；p 值與 CI 不得由系統補造。" },
] as const;
const S0_FIELDS = ["workingTitle", "domain", "outputTrack", "problemContext", "targetUsers", "expectedContribution", "existingData", "availableData", "methodIdea", "timeline", "constraints", "ethicsPrivacyRisks", "unresolvedItems"] as const;
const ACTIVE_EMAIL = process.env.BETA2_E2E_ACTIVE_EMAIL;
const ACTIVE_PASSWORD = process.env.BETA2_E2E_ACTIVE_PASSWORD;
const DISABLED_EMAIL = process.env.BETA2_E2E_DISABLED_EMAIL;
const DISABLED_PASSWORD = process.env.BETA2_E2E_DISABLED_PASSWORD;
const CHANGE_EMAIL = process.env.BETA2_E2E_CHANGE_EMAIL;
const CHANGE_PASSWORD = process.env.BETA2_E2E_CHANGE_PASSWORD;
if (![ACTIVE_EMAIL, ACTIVE_PASSWORD, DISABLED_EMAIL, DISABLED_PASSWORD, CHANGE_EMAIL, CHANGE_PASSWORD].every(Boolean)) throw new Error("beta2_real_auth_fixture_missing");

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}_NOT_OBJECT`);
  return value as Record<string, unknown>;
}

async function expectAxeAndOverflow(page: import("@playwright/test").Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const api = (window as unknown as { axe: { run: (root: Document) => Promise<{ violations: Array<{ impact: string | null; id: string }> }> } }).axe;
    return (await api.run(document)).violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  });
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth)).toBe(false);
}

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("密碼", { exact: true }).fill(password);
  const response = page.waitForResponse((candidate) => candidate.url().includes("/api/auth/sign-in/email"));
  await page.getByRole("button", { name: "登入研究工作台" }).click();
  return response;
}

test("authenticated Beta2 durable generation, save, and new-session resume", async ({ page, browser, baseURL }) => {
  const nonloopback: string[] = [];
  const mutationOperations: string[] = [];
  const mutationBodies: Array<Record<string, unknown>> = [];
  const primaryPageErrors: string[] = [];
  page.on("pageerror", (error) => primaryPageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) nonloopback.push(`${url.protocol}//${url.hostname}`);
    if (url.pathname === API_PATH && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown> | null;
      mutationOperations.push(typeof body?.operation === "string" ? body.operation : "INVALID");
      if (body) mutationBodies.push(structuredClone(body));
    }
  });

  const absentContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try {
    expect((await absentContext.request.get(API_PATH)).status()).toBe(401);
  } finally {
    await absentContext.close();
  }

  expect((await login(page, ACTIVE_EMAIL!, ACTIVE_PASSWORD!)).status()).toBe(200);
  await page.goto("/v2-beta2/projects/beta2-project-01");
  await expect(page.getByRole("heading", { name: "一次提交，持久保存。" })).toBeVisible();
  await expect(page.getByTestId("beta2-persistence-badge")).toHaveText("READY");
  await expect.poll(async () => {
    if (await page.locator('input[name="beta2-entry"]').count() === 2) return "READY";
    if (primaryPageErrors.length > 0) return `PAGEERROR:${primaryPageErrors[0]}`;
    const visibleError = await page.locator('[data-testid="beta2-error"]').evaluateAll((nodes) => nodes
      .filter((node) => node instanceof HTMLElement && node.offsetParent !== null)
      .map((node) => node.textContent ?? "")[0] ?? "");
    return visibleError ? `ERROR:${visibleError}` : "PENDING";
  }, { timeout: 20_000 }).toBe("READY");
  await page.locator('input[name="beta2-entry"]').nth(1).check();
  await page.getByTestId("beta2-research-direction").fill("整合生成式回饋材料檢驗證據校準與任務表現的作用機制");
  await page.getByTestId("beta2-output-target").selectOption("SCI");
  for (let index = 1; index < MATERIAL_FIXTURES.length; index += 1) await page.getByRole("button", { name: "新增材料" }).click();
  await expect(page.getByTestId("beta2-material")).toHaveCount(MATERIAL_FIXTURES.length);
  for (const [index, fixture] of MATERIAL_FIXTURES.entries()) {
    const material = page.getByTestId("beta2-material").nth(index);
    await material.getByLabel("種類").selectOption(fixture.kind);
    await material.getByLabel("標題").fill(fixture.title);
    await material.getByLabel("原始內容").fill(fixture.content);
  }

  const generationResponsePromise = page.waitForResponse((response) => response.url().includes(API_PATH) && response.request().method() === "POST");
  await page.getByTestId("beta2-generate").click();
  const generationResponse = await generationResponsePromise;
  expect(generationResponse.status()).toBe(200);
  const generationEnvelope = object(await generationResponse.json(), "GENERATION_ENVELOPE");
  expect(generationEnvelope.providerSubmissionDelta).toBe(1);
  expect(generationEnvelope.formalResearchWriteCount).toBe(0);
  expect(generationEnvelope.liveProviderCallCount).toBe(0);
  expect(object(generationEnvelope.requestAuthority, "GENERATION_REQUEST_AUTHORITY").operation).toBe("GENERATE_DURABLE_CORE");
  expect(String(object(generationEnvelope.requestAuthority, "GENERATION_REQUEST_AUTHORITY").transportRequestHash)).toMatch(/^[0-9a-f]{64}$/);
  const generationProject = object(generationEnvelope.project, "GENERATION_PROJECT");
  const generationSnapshot = object(generationProject.snapshot, "GENERATION_SNAPSHOT");
  const generationSource = object(generationSnapshot.source, "GENERATION_SOURCE");
  const materials = generationSource.materials as Array<Record<string, unknown>>;
  expect(materials).toHaveLength(MATERIAL_FIXTURES.length);
  expect(materials.map(({ kind, title, content }) => ({ kind, title, content }))).toEqual(MATERIAL_FIXTURES);
  expect(materials.map((item) => item.contentByteLength)).toEqual(MATERIAL_FIXTURES.map((item) => new TextEncoder().encode(item.content).byteLength));
  expect(materials.every((item) => /^[0-9a-f]{64}$/.test(String(item.contentHash)))).toBe(true);
  expect(generationSource.materialCoverage).toEqual({ ABSTRACT: "PROVIDED_UNVERIFIED", INTRODUCTION: "MISSING", METHODS: "PROVIDED_UNVERIFIED", RESULTS: "PROVIDED_UNVERIFIED", STATISTICS: "PROVIDED_UNVERIFIED" });
  expect(generationSnapshot.providerSubmissionCount).toBe(1);
  const frontierDirection = (generationSnapshot.directions as Array<Record<string, unknown>>).find((item) => item.lane === "FRONTIER_INNOVATION");
  expect(frontierDirection).toBeDefined();

  await expect(page.getByRole("heading", { name: "三個專業方向" })).toBeFocused();
  await expect(page.getByTestId("beta2-persistence-badge")).toHaveText("SAVED");
  await expect(page.getByTestId("beta2-direction-EVIDENCE_FIRST")).toBeVisible();
  await expect(page.getByTestId("beta2-direction-BALANCED_RECOMMENDED")).toContainText("推薦");
  await expect(page.getByTestId("beta2-direction-FRONTIER_INNOVATION")).toBeVisible();
  for (const field of S0_FIELDS) await expect(page.getByTestId(`beta2-s0-${field}`)).not.toBeEmpty();
  await page.getByText("13 欄 Field Assist（三案）").click();
  await expect(page.getByTestId("beta2-assist-option")).toHaveCount(39);
  const postCountBeforeAssist = mutationOperations.length;
  const firstAssist = page.getByTestId("beta2-assist-workingTitle").getByTestId("beta2-assist-option").first();
  await firstAssist.getByRole("button").click();
  await expect(page.getByTestId("beta2-live")).toContainText("沒有新增 POST");
  await page.getByTestId("beta2-assist-workingTitle").getByRole("button", { name: "復原此欄" }).click();
  expect(mutationOperations).toHaveLength(postCountBeforeAssist);

  await page.getByTestId("beta2-direction-FRONTIER_INNOVATION").click();
  const selectionResponsePromise = page.waitForResponse((response) => response.url().includes(API_PATH) && response.request().method() === "POST");
  await page.getByTestId("beta2-save-selection").click();
  const selectionResponse = await selectionResponsePromise;
  expect(selectionResponse.status()).toBe(200);
  const selectionEnvelope = object(await selectionResponse.json(), "SELECTION_ENVELOPE");
  expect(selectionEnvelope.providerSubmissionDelta).toBe(0);
  expect(object(selectionEnvelope.requestAuthority, "SELECTION_REQUEST_AUTHORITY").operation).toBe("SAVE_DIRECTION_SELECTION");
  const selectionProject = object(selectionEnvelope.project, "SELECTION_PROJECT");
  expect(selectionProject.revision).toBe(2);
  const selectionSnapshot = object(selectionProject.snapshot, "SELECTION_SNAPSHOT");
  expect(selectionSnapshot.selectedDirectionId).toBe(frontierDirection!.directionId);
  expect(mutationOperations).toEqual(["GENERATE_DURABLE_CORE", "SAVE_DIRECTION_SELECTION"]);

  const selectedFrontier = (selectionSnapshot.directions as Array<Record<string, unknown>>).find((item) => item.directionId === selectionSnapshot.selectedDirectionId);
  if (!selectedFrontier) throw new Error("SELECTED_FRONTIER_MISSING");
  const selectedFieldAssist = object(selectedFrontier.fieldAssist, "SELECTED_FIELD_ASSIST");
  const workingTitleOptions = selectedFieldAssist.workingTitle as Array<Record<string, unknown>>;
  const selectedProviderS0 = object(selectedFrontier.s0, "SELECTED_PROVIDER_S0");
  const appliedWorkingTitleIndex = workingTitleOptions.findIndex((option) => option.applyValue !== selectedProviderS0.workingTitle);
  expect(appliedWorkingTitleIndex).toBeGreaterThanOrEqual(0);
  const appliedWorkingTitle = workingTitleOptions[appliedWorkingTitleIndex];
  const alternateWorkingTitle = workingTitleOptions.find((option) => option.optionId !== appliedWorkingTitle.optionId)!;
  const providerDirectionArtifact = object(selectedFrontier.humanReadableArtifact, "PROVIDER_DIRECTION_ARTIFACT");
  const postCountBeforeConfirmedAssist = mutationOperations.length;
  await page.getByTestId("beta2-assist-workingTitle").getByTestId("beta2-assist-option").nth(appliedWorkingTitleIndex).getByRole("button").click();
  await expect(page.getByTestId("beta2-s0-workingTitle")).toHaveText(String(appliedWorkingTitle.applyValue));
  expect(mutationOperations).toHaveLength(postCountBeforeConfirmedAssist);
  const confirmationResponsePromise = page.waitForResponse((response) => response.url().includes(API_PATH) && response.request().method() === "POST");
  await page.getByTestId("beta2-save-workspace").click();
  const confirmationResponse = await confirmationResponsePromise;
  expect(confirmationResponse.status()).toBe(200);
  const confirmationEnvelope = object(await confirmationResponse.json(), "CONFIRMATION_ENVELOPE");
  expect(confirmationEnvelope.providerSubmissionDelta).toBe(0);
  expect(confirmationEnvelope.snapshotAppendDelta).toBe(1);
  expect(confirmationEnvelope.eventAppendDelta).toBe(1);
  expect(object(confirmationEnvelope.requestAuthority, "CONFIRMATION_REQUEST_AUTHORITY").operation).toBe("SAVE_CONFIRMED_WORKSPACE");
  const confirmationProject = object(confirmationEnvelope.project, "CONFIRMATION_PROJECT");
  const confirmationSnapshot = object(confirmationProject.snapshot, "CONFIRMATION_SNAPSHOT");
  const confirmedWorkspace = object(confirmationSnapshot.confirmedWorkspace, "CONFIRMED_WORKSPACE");
  expect(confirmationProject.revision).toBe(3);
  expect(confirmedWorkspace.selectedDirectionId).toBe(frontierDirection!.directionId);
  expect(object(confirmedWorkspace.s0, "CONFIRMED_S0").workingTitle).toBe(appliedWorkingTitle.applyValue);
  expect(object(confirmedWorkspace.appliedAssistOptionIds, "CONFIRMED_ASSIST_IDS").workingTitle).toBe(appliedWorkingTitle.optionId);
  expect(String(confirmedWorkspace.confirmationHash)).toMatch(/^[0-9a-f]{64}$/);
  const confirmationArtifact = object(confirmationSnapshot.humanReadableArtifact, "CONFIRMATION_ARTIFACT");
  expect(String(confirmationArtifact.markdown)).toContain(String(appliedWorkingTitle.applyValue));
  expect(confirmationArtifact.artifactHash).not.toBe(providerDirectionArtifact.artifactHash);
  const confirmedSelectedDirection = (confirmationSnapshot.directions as Array<Record<string, unknown>>).find((item) => item.directionId === confirmationSnapshot.selectedDirectionId);
  expect(object(confirmedSelectedDirection?.humanReadableArtifact, "CONFIRMED_PROVIDER_DIRECTION_ARTIFACT")).toEqual(providerDirectionArtifact);
  expect(mutationOperations).toEqual(["GENERATE_DURABLE_CORE", "SAVE_DIRECTION_SELECTION", "SAVE_CONFIRMED_WORKSPACE"]);
  await expect(page.getByTestId("beta2-persistence-badge")).toHaveText("CONFIRMED");
  await expect(page.getByTestId("beta2-workspace-confirmation")).toHaveText("CONFIRMED");
  expect(await page.getByTestId("beta2-human-readable-artifact").evaluate((node) => node.textContent)).toBe(confirmationArtifact.markdown);

  const generationBody = mutationBodies.find((body) => body.operation === "GENERATE_DURABLE_CORE");
  const selectionBody = mutationBodies.find((body) => body.operation === "SAVE_DIRECTION_SELECTION");
  if (!generationBody || !selectionBody) throw new Error("HISTORICAL_REPLAY_REQUEST_BODY_MISSING");
  const historicalGenerationResponse = await page.request.post(API_PATH, { data: generationBody });
  expect(historicalGenerationResponse.status()).toBe(200);
  const historicalGenerationEnvelope = object(await historicalGenerationResponse.json(), "HISTORICAL_GENERATION_REPLAY");
  expect({ replayed: historicalGenerationEnvelope.replayed, provider: historicalGenerationEnvelope.providerSubmissionDelta, snapshot: historicalGenerationEnvelope.snapshotAppendDelta, event: historicalGenerationEnvelope.eventAppendDelta }).toEqual({ replayed: true, provider: 0, snapshot: 0, event: 0 });
  expect(historicalGenerationEnvelope.project).toEqual(generationEnvelope.project);
  const historicalSelectionResponse = await page.request.post(API_PATH, { data: selectionBody });
  expect(historicalSelectionResponse.status()).toBe(200);
  const historicalSelectionEnvelope = object(await historicalSelectionResponse.json(), "HISTORICAL_SELECTION_REPLAY");
  expect({ replayed: historicalSelectionEnvelope.replayed, provider: historicalSelectionEnvelope.providerSubmissionDelta, snapshot: historicalSelectionEnvelope.snapshotAppendDelta, event: historicalSelectionEnvelope.eventAppendDelta }).toEqual({ replayed: true, provider: 0, snapshot: 0, event: 0 });
  expect(historicalSelectionEnvelope.project).toEqual(selectionEnvelope.project);

  const confirmationBody = mutationBodies.find((body) => body.operation === "SAVE_CONFIRMED_WORKSPACE");
  if (!confirmationBody) throw new Error("CONFIRMATION_REQUEST_BODY_MISSING");
  const exactReplayResponse = await page.request.post(API_PATH, { data: confirmationBody });
  expect(exactReplayResponse.status()).toBe(200);
  const exactReplayEnvelope = object(await exactReplayResponse.json(), "CONFIRMATION_REPLAY_ENVELOPE");
  expect(exactReplayEnvelope.replayed).toBe(true);
  expect({ provider: exactReplayEnvelope.providerSubmissionDelta, snapshot: exactReplayEnvelope.snapshotAppendDelta, event: exactReplayEnvelope.eventAppendDelta }).toEqual({ provider: 0, snapshot: 0, event: 0 });
  expect(exactReplayEnvelope.project).toEqual(confirmationEnvelope.project);
  const conflictBody = structuredClone(confirmationBody);
  conflictBody.s0Summary = { ...object(conflictBody.s0Summary, "CONFLICT_S0"), workingTitle: alternateWorkingTitle.applyValue };
  conflictBody.appliedAssistOptionIds = { ...object(conflictBody.appliedAssistOptionIds, "CONFLICT_ASSIST_IDS"), workingTitle: alternateWorkingTitle.optionId };
  const conflictResponse = await page.request.post(API_PATH, { data: conflictBody });
  expect(conflictResponse.status()).toBe(409);
  expect(object(await conflictResponse.json(), "CONFIRMATION_CONFLICT").code).toBe("beta2_idempotency_conflict");

  const postCountBeforeCardSwitch = mutationOperations.length;
  await page.getByTestId("beta2-direction-EVIDENCE_FIRST").click();
  await page.getByTestId("beta2-direction-FRONTIER_INNOVATION").click();
  expect(mutationOperations).toHaveLength(postCountBeforeCardSwitch);
  await expect(page.getByTestId("beta2-s0-workingTitle")).toHaveText(String(appliedWorkingTitle.applyValue));
  await expect(page.getByTestId("beta2-save-workspace")).toBeDisabled();

  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null)).toBe(true);
  const live = page.getByTestId("beta2-live");
  await expect(live).toHaveAttribute("role", "status");
  await expect(live).toHaveAttribute("aria-live", "polite");
  await expect(live).toHaveAttribute("aria-atomic", "true");
  await expect(live).toContainText("沒有呼叫提供者");
  await expectAxeAndOverflow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectAxeAndOverflow(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await expectAxeAndOverflow(page);

  const resumedContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  try {
    const resumedPage = await resumedContext.newPage();
    expect((await login(resumedPage, ACTIVE_EMAIL!, ACTIVE_PASSWORD!)).status()).toBe(200);
    const resumedResponse = resumedPage.waitForResponse((response) => response.url().includes(API_PATH) && response.request().method() === "GET");
    await resumedPage.goto("/v2-beta2/projects/beta2-project-01");
    const resumedHttpResponse = await resumedResponse;
    expect(resumedHttpResponse.status()).toBe(200);
    const resumeEnvelope = object(await resumedHttpResponse.json(), "RESUME_ENVELOPE");
    expect(resumeEnvelope.requestAuthority).toBeNull();
    const resumeSnapshot = object(object(resumeEnvelope.project, "RESUME_PROJECT").snapshot, "RESUME_SNAPSHOT");
    expect(object(resumeEnvelope.project, "RESUME_PROJECT").revision).toBe(3);
    expect(resumeEnvelope.project).toEqual(confirmationEnvelope.project);
    expect(resumeSnapshot.selectedDirectionId).toBe(selectionSnapshot.selectedDirectionId);
    expect(object(resumeSnapshot.source, "RESUME_SOURCE").sourceHash).toBe(generationSource.sourceHash);
    expect(object(resumeSnapshot.source, "RESUME_SOURCE").materials).toEqual(generationSource.materials);
    expect(resumeSnapshot.confirmedWorkspace).toEqual(confirmationSnapshot.confirmedWorkspace);
    expect(resumeSnapshot.humanReadableArtifact).toEqual(confirmationSnapshot.humanReadableArtifact);
    await expect(resumedPage.getByTestId("beta2-direction-FRONTIER_INNOVATION")).toHaveAttribute("aria-pressed", "true");
    await expect(resumedPage.getByTestId("beta2-persistence-badge")).toHaveText("CONFIRMED");
    await expect(resumedPage.getByTestId("beta2-workspace-confirmation")).toHaveText("CONFIRMED");
    await expect(resumedPage.getByTestId("beta2-s0-workingTitle")).toHaveText(String(appliedWorkingTitle.applyValue));
    expect(await resumedPage.getByTestId("beta2-human-readable-artifact").evaluate((node) => node.textContent)).toBe(confirmationArtifact.markdown);
    await expect(resumedPage.getByTestId("beta2-material-coverage")).toContainText("INTRODUCTION：缺少（不會補造或提升為觀察證據）");
    await expect(resumedPage.getByTestId("beta2-save-workspace")).toBeDisabled();
    await expectAxeAndOverflow(resumedPage);
    expect((await resumedContext.request.get("/api/v2-beta2/projects/beta2-project-other")).status()).toBe(404);
    expect((await resumedContext.request.get("/api/v2-beta2/projects/beta2-project-inactive")).status()).toBe(404);
    expect((await resumedContext.request.get("/api/v2-beta2/projects/beta2-project-unknown")).status()).toBe(404);
  } finally {
    await resumedContext.close();
  }

  const rejectedContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  try {
    const rejectedPage = await rejectedContext.newPage();
    const rejectedPosts: string[] = [];
    rejectedPage.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === REJECTED_API_PATH && request.method() === "POST") rejectedPosts.push(request.postData() ?? "");
    });
    expect((await login(rejectedPage, ACTIVE_EMAIL!, ACTIVE_PASSWORD!)).status()).toBe(200);
    const rejectedGet = rejectedPage.waitForResponse((response) => new URL(response.url()).pathname === REJECTED_API_PATH && response.request().method() === "GET");
    await rejectedPage.goto("/v2-beta2/projects/beta2-project-rejected");
    const rejectedEnvelope = object(await (await rejectedGet).json(), "REJECTED_RESUME_ENVELOPE");
    const rejectedProject = object(rejectedEnvelope.project, "REJECTED_RESUME_PROJECT");
    const rejectedOutcome = object(rejectedProject.stageOutcome, "REJECTED_STAGE_OUTCOME");
    expect(rejectedOutcome.status).toBe("REJECTED");
    expect(rejectedOutcome.completionClass).toBe("TERMINAL_REJECTED");
    expect(object(rejectedOutcome.terminalEvent, "REJECTED_TERMINAL_EVENT").eventType).toBe("GENERATION_TERMINAL_FAILURE");
    await expect(rejectedPage.getByTestId("beta2-persistence-badge")).toHaveText("REJECTED");
    await expect(rejectedPage.getByTestId("beta2-terminal-rejected")).toContainText("不會重新提交");
    await expect(rejectedPage.getByTestId("beta2-generate")).toHaveCount(0);
    await expect(rejectedPage.getByRole("heading", { name: "三個專業方向" })).toHaveCount(0);
    await rejectedPage.reload({ waitUntil: "networkidle" });
    await expect(rejectedPage.getByTestId("beta2-persistence-badge")).toHaveText("REJECTED");
    await expect(rejectedPage.getByTestId("beta2-stage-outcome")).toHaveText("REJECTED");
    expect(rejectedPosts).toEqual([]);
    await expectAxeAndOverflow(rejectedPage);
  } finally {
    await rejectedContext.close();
  }

  const pendingContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  try {
    const pendingPage = await pendingContext.newPage();
    const pendingPosts: string[] = [];
    const pendingPageErrors: string[] = [];
    pendingPage.on("request", (request) => {
      if (new URL(request.url()).pathname === PENDING_API_PATH && request.method() === "POST") pendingPosts.push(request.postData() ?? "");
    });
    pendingPage.on("pageerror", (error) => pendingPageErrors.push(error.message));
    expect((await login(pendingPage, ACTIVE_EMAIL!, ACTIVE_PASSWORD!)).status()).toBe(200);
    const pendingGet = pendingPage.waitForResponse((response) => new URL(response.url()).pathname === PENDING_API_PATH && response.request().method() === "GET");
    await pendingPage.goto("/v2-beta2/projects/beta2-project-pending");
    const pendingEnvelope = object(await (await pendingGet).json(), "PENDING_RESUME_ENVELOPE");
    expect(pendingEnvelope.requestAuthority).toBeNull();
    expect(object(object(pendingEnvelope.project, "PENDING_PROJECT").stageOutcome, "PENDING_STAGE_OUTCOME").status).toBe("RECONCILE_REQUIRED");
    await expect(pendingPage.getByTestId("beta2-persistence-badge")).toHaveText("RECONCILE REQUIRED");
    await expect(pendingPage.getByTestId("beta2-reconciliation")).toContainText("不會再次生成");
    await expect(pendingPage.getByTestId("beta2-generate")).toHaveCount(0);
    const reconcileButton = pendingPage.getByRole("button", { name: "執行非生成式核對" });
    await expect(reconcileButton).toBeEnabled();
    const pendingHttpResponses: import("@playwright/test").Response[] = [];
    pendingPage.on("response", (response) => {
      if (new URL(response.url()).pathname === PENDING_API_PATH && response.request().method() === "POST") pendingHttpResponses.push(response);
    });
    await reconcileButton.click({ timeout: 5_000 });
    await expect.poll(async () => {
      if (pendingHttpResponses.length > 0) return "RESPONSE";
      const visibleError = await pendingPage.locator('[data-testid="beta2-error"]').evaluateAll((nodes) => nodes
        .filter((node) => node instanceof HTMLElement && node.offsetParent !== null)
        .map((node) => node.textContent ?? "")[0] ?? "");
      if (visibleError) return `ERROR:${visibleError}`;
      if (pendingPageErrors.length > 0) return `PAGEERROR:${pendingPageErrors[0]}`;
      return pendingPosts.length > 0 ? "REQUEST" : "PENDING";
    }, { timeout: 20_000 }).toBe("RESPONSE");
    const pendingHttpResponse = pendingHttpResponses[0];
    if (!pendingHttpResponse) throw new Error("PENDING_RECONCILIATION_RESPONSE_MISSING");
    expect(pendingHttpResponse.status()).toBe(202);
    const pendingMutationEnvelope = object(await pendingHttpResponse.json(), "PENDING_MUTATION_ENVELOPE");
    expect(pendingMutationEnvelope.operation).toBe("RECONCILE_UNKNOWN");
    expect(pendingMutationEnvelope.providerSubmissionDelta).toBe(0);
    expect(pendingMutationEnvelope.snapshotAppendDelta).toBe(0);
    expect(pendingMutationEnvelope.eventAppendDelta).toBe(0);
    expect(object(pendingMutationEnvelope.requestAuthority, "PENDING_REQUEST_AUTHORITY").operation).toBe("RECONCILE_UNKNOWN");
    expect(object(object(pendingMutationEnvelope.project, "PENDING_MUTATION_PROJECT").stageOutcome, "PENDING_MUTATION_STAGE").jobId).toBe(object(object(pendingEnvelope.project, "PENDING_PROJECT").stageOutcome, "PENDING_STAGE_OUTCOME").jobId);
    expect(pendingPosts).toHaveLength(1);
    await expectAxeAndOverflow(pendingPage);
  } finally {
    await pendingContext.close();
  }

  const disabledContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try {
    const disabledPage = await disabledContext.newPage();
    expect((await login(disabledPage, DISABLED_EMAIL!, DISABLED_PASSWORD!)).status()).not.toBe(200);
    expect((await disabledContext.request.get(API_PATH)).status()).toBe(401);
  } finally {
    await disabledContext.close();
  }

  const changeContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try {
    const changePage = await changeContext.newPage();
    expect((await login(changePage, CHANGE_EMAIL!, CHANGE_PASSWORD!)).status()).toBe(200);
    expect((await changeContext.request.get(API_PATH)).status()).toBe(428);
  } finally {
    await changeContext.close();
  }

  expect(nonloopback).toEqual([]);
});
