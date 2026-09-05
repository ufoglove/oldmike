import { createHash } from "node:crypto";

import { expect, test, type Page, type Response } from "@playwright/test";
import axe from "axe-core";

const API_PATH = "/api/v2-beta1/project";
const CONTRACT_VERSION = "old-mike-v2-beta1/1.7.20";
const DOMAIN_VALUES = [
  "ai-cross-disciplinary",
  "ai-education",
  "ai-occupational-safety-training",
  "ai-environment-resource-management",
  "ai-energy-management",
  "xr-cross-disciplinary",
  "CUSTOM",
] as const;
const S0_FIELDS = ["workingTitle", "domain", "outputTrack", "problemContext", "targetUsers", "expectedContribution", "existingData", "availableData", "methodIdea", "timeline", "constraints", "ethicsPrivacyRisks", "unresolvedItems"] as const;
const LANES = ["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"] as const;
const STRATEGIES = ["EVIDENCE_CALIBRATED", "JOURNAL_CONCISE_RECOMMENDED", "NATURAL_SCHOLARLY"] as const;
const MIXED_ASSIST_PUNCTUATION = /(?:。，|。；|；，|，。|，；)/u;
const S0_LIMITS: Record<(typeof S0_FIELDS)[number], number> = {
  workingTitle: 160, domain: 80, outputTrack: 10, problemContext: 4000, targetUsers: 2000, expectedContribution: 4000,
  existingData: 4000, availableData: 4000, methodIdea: 4000, timeline: 500, constraints: 2000, ethicsPrivacyRisks: 4000, unresolvedItems: 4000,
};
const MATERIALS = [
  { kind: "ABSTRACT", title: "摘要", content: "本研究關注回饋可操作性與證據校準，不預先宣稱成效。" },
  { kind: "METHODS", title: "方法", content: "採混合方法並保留樣本、量測與分析設定待確認。" },
  { kind: "RESULTS", title: "結果", content: "metricId=participation; cohortId=all; timepoint=post; analysisId=primary; effectId=participation-rate; Primary participation was observed at 0.31 %; N=180; p<=0.04; 95% CI [0.02, 0.6]; citation=OWN_DATA." },
  { kind: "STATISTICS", title: "統計", content: "指標為 82%；分母、估計量與不確定性仍待核對。" },
] as const;

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}_NOT_OBJECT`);
  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}_NOT_ARRAY`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label}_NOT_TEXT`);
  return value;
}

function number(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`${label}_NOT_INTEGER`);
  return value as number;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function json(response: Response) {
  return object(await response.json(), "RESPONSE");
}

function snapshotFrom(envelope: JsonObject) {
  expect(envelope.ok).toBe(true);
  expect(envelope.contractVersion).toBe(CONTRACT_VERSION);
  return object(envelope.snapshot, "SNAPSHOT");
}

async function expectNoSeriousAxe(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const api = (window as unknown as { axe: { run: (root: Document, options: JsonObject) => Promise<{ violations: Array<{ id: string; impact: string | null }> }> } }).axe;
    const result = await api.run(document, { resultTypes: ["violations"] });
    return result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  });
  expect(violations).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth);
  expect(overflow).toBe(false);
}

function expectSnapshotCounters(snapshot: JsonObject, expectedEffects: number) {
  expect(number(snapshot.revision, "REVISION")).toBe(expectedEffects + 1);
  expect(array(snapshot.timeline, "TIMELINE")).toHaveLength(expectedEffects);
  expect(array(snapshot.effectReceipts, "RECEIPTS")).toHaveLength(expectedEffects);
  expect(array(snapshot.journeys, "JOURNEYS")).toHaveLength(expectedEffects);
  expect(snapshot.formalResearchWriteCount).toBe(0);
  expect(snapshot.onlineDatabaseWriteCount).toBe(0);
  expect(snapshot.externalMutationCount).toBe(0);
}

function expectJourneyContract(snapshot: JsonObject, target: string) {
  const journey = object(snapshot.journey, "JOURNEY");
  expect(journey.outputTarget).toBe(target);
  const directions = array(journey.directions, "DIRECTIONS").map((item, index) => object(item, `DIRECTION_${index}`));
  expect(directions).toHaveLength(3);
  expect(directions.map((item) => item.lane)).toEqual(LANES);
  expect(directions.filter((item) => item.recommended === true)).toHaveLength(1);
  for (const key of ["title", "researchQuestion", "mechanism", "method", "contribution"] as const) {
    expect(new Set(directions.map((item) => text(item[key], `DIRECTION_${key}`))).size).toBe(3);
  }
  let cardCount = 0;
  let editableCount = 0;
  let immutableCount = 0;
  const optionIds = new Set<string>();
  const optionHashes = new Set<string>();
  const domainLabel = text(object(journey.researchDomain, "RESEARCH_DOMAIN").label, "DOMAIN_LABEL");
  let sourceSegmentCount = 0;
  for (const direction of directions) {
    const s0 = object(direction.s0, "S0");
    expect(Object.keys(s0).sort()).toEqual([...S0_FIELDS].sort());
    for (const field of S0_FIELDS) expect(text(s0[field], `S0_${field}`).trim().length).toBeGreaterThan(0);
    const assist = object(direction.fieldAssist, "FIELD_ASSIST");
    const directionOptions: JsonObject[] = [];
    for (const field of S0_FIELDS) {
      const options = array(assist[field], `ASSIST_${field}`);
      expect(options).toHaveLength(3);
      expect(options.map((item, index) => text(object(item, `ASSIST_${field}_${index}`).strategy, `ASSIST_${field}_${index}_STRATEGY`))).toEqual(STRATEGIES);
      expect(options.map((item, index) => object(item, `ASSIST_${field}_${index}`).recommended)).toEqual([false, true, false]);
      for (const [index, rawOption] of options.entries()) {
        const option = object(rawOption, `ASSIST_${field}_${index}`);
        directionOptions.push(option);
        const optionText = text(option.text, `ASSIST_${field}_${index}_TEXT`);
        const applyValue = text(option.applyValue, `ASSIST_${field}_${index}_APPLY`);
        optionIds.add(text(option.optionId, `ASSIST_${field}_${index}_ID`));
        optionHashes.add(text(option.optionHash, `ASSIST_${field}_${index}_HASH`));
        expect(MIXED_ASSIST_PUNCTUATION.test(optionText)).toBe(false);
        if (field === "domain" || field === "outputTrack") {
          expect(applyValue).toBe(field === "domain" ? domainLabel : target);
        } else {
          expect(optionText).toBe(applyValue);
          expect(optionText.length).toBeLessThanOrEqual(S0_LIMITS[field]);
        }
      }
      if (field === "methodIdea") {
        const balancedMethod = text(object(options[1], "ASSIST_METHOD_BALANCED").text, "ASSIST_METHOD_BALANCED_TEXT");
        expect(balancedMethod).toMatch(/^以「[^」]+」的主要結果、機制變項、實作忠實度與情境差異建立同一分析契約。$/u);
        expect(balancedMethod.match(/[。！？]/gu) ?? []).toHaveLength(1);
      }
      cardCount += options.length;
      if (field === "domain" || field === "outputTrack") immutableCount += options.length;
      else editableCount += options.length;
    }
    for (const [label, segment] of [
      ["TITLE", text(direction.title, "DIRECTION_TITLE")],
      ["QUESTION", text(direction.researchQuestion, "DIRECTION_QUESTION")],
      ["EXISTING_DATA", text(s0.existingData, "S0_EXISTING_DATA")],
    ] as const) {
      const matching = directionOptions.filter((option) => text(option.text, `SOURCE_${label}_OPTION`).includes(segment));
      expect(matching.length, `${direction.lane}:${label}:full-source`).toBeGreaterThan(0);
      expect(matching.some((option) => text(option.text, `SOURCE_${label}_TAIL`).includes(segment.slice(-12))), `${direction.lane}:${label}:tail`).toBe(true);
      sourceSegmentCount += 1;
    }
    expect(directionOptions.some((option) => text(option.text, "ASSIST_GENERATED_ELLIPSIS").includes("…"))).toBe(false);
    const artifact = object(direction.selectionArtifact, "SELECTION_ARTIFACT");
    expect(artifact.outputTarget).toBe(target);
    expect(artifact.selectedDirectionHash).toBe(direction.directionHash);
  }
  expect({ cardCount, editableCount, immutableCount }).toEqual({ cardCount: 117, editableCount: 99, immutableCount: 18 });
  expect(optionIds.size).toBe(117);
  expect(optionHashes.size).toBe(117);
  return { journey, editableCount, reviewUnitCount: cardCount, sourceSegmentCount };
}

async function expectRenderedAssistAuthority(page: Page, journey: JsonObject, postAttempts: () => number) {
  const directions = array(journey.directions, "RENDER_DIRECTIONS").map((item, index) => object(item, `RENDER_DIRECTION_${index}`));
  const beforePosts = postAttempts();
  let renderedEditableCount = 0;
  let renderedReviewUnitCount = 0;
  for (const direction of directions) {
    const lane = text(direction.lane, "RENDER_LANE");
    await page.getByTestId(`beta1-direction-${lane}`).click();
    const expectedOptions = S0_FIELDS.flatMap((field) => array(object(direction.fieldAssist, "RENDER_FIELD_ASSIST")[field], `RENDER_${field}`).map((item, index) => object(item, `RENDER_${field}_${index}`)));
    const renderedOptions = page.getByTestId("beta1-assist-option");
    await expect(renderedOptions).toHaveCount(expectedOptions.length);
    for (const [index, expectedOption] of expectedOptions.entries()) {
      const rendered = renderedOptions.nth(index);
      const optionText = text(expectedOption.text, `RENDER_OPTION_${index}_TEXT`);
      await expect(rendered.getByTestId("beta1-assist-text")).toHaveText(optionText, { useInnerText: false });
      await expect(rendered.getByTestId("beta1-review-rationale")).toHaveText(text(expectedOption.rationale, `RENDER_OPTION_${index}_RATIONALE`), { useInnerText: false });
      await expect(rendered.getByTestId("beta1-review-risk")).toHaveText(text(expectedOption.risk, `RENDER_OPTION_${index}_RISK`), { useInnerText: false });
      expect(await rendered.getByTestId("beta1-review-boundary").textContent()).not.toContain("。；");
      const visibility = await rendered.getByTestId("beta1-assist-text").evaluate((node) => {
        const style = getComputedStyle(node);
        return { overflow: style.overflow, textOverflow: style.textOverflow, lineClamp: style.getPropertyValue("-webkit-line-clamp") };
      });
      expect(visibility.overflow).not.toBe("hidden");
      expect(visibility.textOverflow).not.toBe("ellipsis");
      expect(visibility.lineClamp === "" || visibility.lineClamp === "none").toBe(true);
      if (expectedOption.field !== "domain" && expectedOption.field !== "outputTrack") renderedEditableCount += 1;
      renderedReviewUnitCount += 1;
    }
    const methodAssist = page.getByTestId("beta1-assist-methodIdea");
    const currentValue = methodAssist.locator(":scope > div > p");
    const beforeValue = await currentValue.textContent();
    const methodOptions = array(object(direction.fieldAssist, "RENDER_METHOD_ASSIST").methodIdea, "RENDER_METHOD_OPTIONS").map((item, index) => object(item, `RENDER_METHOD_${index}`));
    const balancedApplyValue = text(methodOptions[1].applyValue, "RENDER_METHOD_BALANCED_APPLY");
    await methodAssist.getByTestId("beta1-assist-option").nth(1).getByRole("button", { name: "套用至預覽", exact: true }).click();
    await expect(currentValue).toHaveText(balancedApplyValue, { useInnerText: false });
    await methodAssist.getByRole("button", { name: "復原此欄", exact: true }).click();
    await expect(currentValue).toHaveText(beforeValue ?? "", { useInnerText: false });
    expect(postAttempts()).toBe(beforePosts);
  }
  await page.getByTestId("beta1-direction-BALANCED_RECOMMENDED").click();
  return { renderedEditableCount, renderedReviewUnitCount };
}

async function expectRenderedJournalReviewAuthority(page: Page, journey: JsonObject) {
  const balanced = array(journey.directions, "JOURNAL_DIRECTIONS").map((item, index) => object(item, `JOURNAL_DIRECTION_${index}`)).find((direction) => direction.lane === "BALANCED_RECOMMENDED");
  const journal = object(object(balanced?.selectionArtifact, "JOURNAL_ARTIFACT").journal, "JOURNAL_AUTHORITY");
  const expectedRevisions = array(journal.priorityFindings, "JOURNAL_FINDINGS").flatMap((finding, findingIndex) => array(object(finding, `JOURNAL_FINDING_${findingIndex}`).revisions, `JOURNAL_REVISIONS_${findingIndex}`).map((revision, revisionIndex) => object(revision, `JOURNAL_REVISION_${findingIndex}_${revisionIndex}`)));
  const rendered = page.getByTestId("beta1-journal-revision");
  await expect(rendered).toHaveCount(expectedRevisions.length);
  for (const [index, revision] of expectedRevisions.entries()) {
    await expect(rendered.nth(index).getByTestId("beta1-review-rationale")).toHaveText(text(revision.rationale, `JOURNAL_RATIONALE_${index}`), { useInnerText: false });
    await expect(rendered.nth(index).getByTestId("beta1-review-risk")).toHaveText(text(revision.risk, `JOURNAL_RISK_${index}`), { useInnerText: false });
    expect(await rendered.nth(index).getByTestId("beta1-review-boundary").textContent()).not.toContain("。；");
  }
}

async function waitForJourney(page: Page) {
  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === API_PATH);
  await page.getByTestId("beta1-run-journey").click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const envelope = await json(response);
  expect(envelope.trustClass).toBe("SAME_ORIGIN_TRANSITION_CONSISTENCY");
  expect(envelope.replayed).toBe(false);
  expect(envelope.effectSubmissionCount).toBe(1);
  expect(envelope.liveProviderCallCount).toBe(0);
  expect(envelope.formalResearchWriteCount).toBe(0);
  expect(envelope.onlineDatabaseWriteCount).toBe(0);
  expect(envelope.externalMutationCount).toBe(0);
  await expect(page.locator("#directions-heading")).toBeFocused();
  return snapshotFrom(envelope);
}

async function expectLocalInteractions(page: Page, postAttempts: () => number) {
  const selected = page.getByTestId("beta1-selected-direction");
  const balancedHash = await selected.getAttribute("data-whole-artifact-hash");
  const before = postAttempts();
  const evidenceCard = page.getByTestId("beta1-direction-EVIDENCE_FIRST");
  const liveRegion = page.getByTestId("beta1-live");
  await expect(liveRegion).toHaveAttribute("role", "status");
  await expect(liveRegion).toHaveAttribute("aria-live", "polite");
  await expect(liveRegion).toHaveAttribute("aria-atomic", "true");
  const announcementBeforeSwitch = await liveRegion.textContent();
  await evidenceCard.focus();
  await page.keyboard.press("Enter");
  await expect(evidenceCard).toHaveAttribute("aria-pressed", "true");
  await expect(liveRegion).not.toHaveText(announcementBeforeSwitch ?? "");
  await expect(liveRegion).toContainText("已在本機切換");
  const evidenceHash = await selected.getAttribute("data-whole-artifact-hash");
  expect(evidenceHash).not.toBe(balancedHash);
  await page.getByTestId("beta1-direction-BALANCED_RECOMMENDED").click();
  await expect(selected).toHaveAttribute("data-whole-artifact-hash", balancedHash ?? "");
  await page.getByTestId("beta1-apply").click();
  const applied = await page.getByTestId("beta1-local-draft").inputValue();
  expect(applied.length).toBeGreaterThan(200);
  expect(applied.startsWith("# ")).toBe(true);
  expect(applied).toContain("## 13 欄研究摘要");
  expect(applied).toContain("## 最終人工關卡");
  expect(applied).not.toMatch(/EVIDENCE_FIRST|CAUSAL_MECHANISM|FRONTIER_INNOVATION|BALANCED_RECOMMENDED|\"schemaId\"/);
  await expect(page.getByTestId("beta1-human-draft")).toContainText("整份人讀成果草稿");
  await expect(page.getByTestId("beta1-confirm-gate")).toBeEnabled();
  await page.getByTestId("beta1-confirm-gate").click();
  await expect(page.getByTestId("beta1-confirm-gate")).toContainText("已確認");
  await page.getByTestId("beta1-undo").click();
  await expect(page.getByTestId("beta1-local-draft")).toHaveValue("");
  await expect(page.getByTestId("beta1-confirm-gate")).toBeDisabled();
  expect(postAttempts()).toBe(before);
}

async function reloadAndRead(page: Page) {
  const responsePromise = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === API_PATH);
  await page.reload({ waitUntil: "domcontentloaded" });
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  const envelope = await json(response);
  expect(envelope.trustClass).toBe("STRUCTURAL_INTERNAL_CONSISTENCY_ONLY");
  await expect(page.getByTestId("beta1-research-os")).toBeVisible();
  return snapshotFrom(envelope);
}

test("Beta1 R2 preserves one professional project truth across three journeys", async ({ page, context }) => {
  const unexpectedOrigins: string[] = [];
  const requestBodies: JsonObject[] = [];
  let postAttempts = 0;
  let upstreamPosts = 0;
  let injectCompletionUnknown = false;
  let verifiedEditableOptions = 0;
  let verifiedRenderedReviewUnits = 0;
  let verifiedSourceSegments = 0;

  context.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "127.0.0.1") unexpectedOrigins.push(url.origin);
  });
  page.on("websocket", (socket) => {
    const url = new URL(socket.url());
    if (url.hostname !== "127.0.0.1") unexpectedOrigins.push(url.origin);
  });
  await context.route(`**${API_PATH}`, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    postAttempts += 1;
    const body = object(request.postDataJSON(), `POST_${postAttempts}`);
    requestBodies.push(body);
    expect(body.contractVersion).toBe(CONTRACT_VERSION);
    expect(body.operation).toBe("RUN_RESEARCH_JOURNEY");
    expect(typeof body.requestId).toBe("string");
    expect(typeof body.idempotencyKey).toBe("string");
    if (injectCompletionUnknown) {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify({ ok: false, code: "beta1_completion_unknown_no_resend", completionClass: "COMPLETION_UNKNOWN", generatedArtifactHash: null }),
      });
    }
    upstreamPosts += 1;
    return route.continue();
  });

  const initialGet = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === API_PATH);
  await page.goto("/research-os-local", { waitUntil: "domcontentloaded" });
  const initial = snapshotFrom(await json(await initialGet));
  expectSnapshotCounters(initial, 0);
  await expect(page.getByTestId("beta1-research-os")).toHaveAttribute("data-formal-write-count", "0");
  await expect(page.getByTestId("beta1-research-os")).toHaveAttribute("data-live-provider-call-count", "0");
  const observedDomains = await page.getByTestId("beta1-domain").locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  expect(observedDomains).toEqual(DOMAIN_VALUES);

  await page.getByTestId("beta1-chat-input").fill("不同的老麥對話內容必須進入洞見預覽");
  await page.getByTestId("beta1-preview").click();
  await expect(page.getByTestId("beta1-insight-preview")).toContainText("不同的老麥對話內容必須進入洞見預覽");
  expect(postAttempts).toBe(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId("beta1-domain").selectOption("ai-education");
  await page.getByTestId("beta1-output-target").selectOption("SSCI");
  await page.getByTestId("beta1-research-input").fill("生成式回饋的證據校準與高等教育自我調節學習");
  const first = await waitForJourney(page);
  expectSnapshotCounters(first, 1);
  const firstContract = expectJourneyContract(first, "SSCI");
  verifiedEditableOptions += firstContract.editableCount;
  verifiedSourceSegments += firstContract.sourceSegmentCount;
  const firstRendered = await expectRenderedAssistAuthority(page, firstContract.journey, () => postAttempts);
  verifiedRenderedReviewUnits += firstRendered.renderedReviewUnitCount;
  await expect(page.getByTestId("beta1-journal-review")).toBeVisible();
  await expectRenderedJournalReviewAuthority(page, firstContract.journey);
  await expectLocalInteractions(page, () => postAttempts);
  await expectNoSeriousAxe(page);
  await expectNoHorizontalOverflow(page);
  expect(await reloadAndRead(page)).toEqual(first);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("radio", { name: "多份既有材料", exact: true }).check();
  await page.getByTestId("beta1-domain").selectOption("ai-cross-disciplinary");
  await page.getByTestId("beta1-output-target").selectOption("SCI");
  await page.getByTestId("beta1-research-input").fill("整合生成式回饋材料檢驗證據校準與任務表現的作用機制");
  for (let index = 1; index < MATERIALS.length; index += 1) await page.getByRole("button", { name: "新增材料" }).click();
  for (const [index, material] of MATERIALS.entries()) {
    await page.getByTestId(`beta1-material-kind-${index}`).selectOption(material.kind);
    await page.getByTestId(`beta1-material-title-${index}`).fill(material.title);
    await page.getByTestId(`beta1-material-content-${index}`).fill(material.content);
  }
  await expect(page.getByTestId("beta1-observation-review")).toBeVisible();
  await expect(page.getByTestId("beta1-observation-candidate-0")).toContainText("UNCONFIRMED_ADVISORY");
  await expect(page.getByTestId("beta1-run-journey")).toBeDisabled();
  await page.getByTestId("beta1-observation-confirm-0").check();
  await expect(page.getByTestId("beta1-run-journey")).toBeEnabled();
  await page.getByTestId("beta1-observation-correct-0").check();
  await expect(page.getByTestId("beta1-run-journey")).toBeDisabled();
  const correction = page.getByTestId("beta1-observation-correction-0");
  await correction.getByLabel("估計值", { exact: true }).fill("82.0");
  await expect(page.getByTestId("beta1-run-journey")).toBeDisabled();
  await page.getByTestId("beta1-observation-confirm-correction-0").click();
  await expect(page.getByTestId("beta1-run-journey")).toBeDisabled();
  await correction.getByLabel("估計值", { exact: true }).fill("0.310");
  await page.getByTestId("beta1-observation-confirm-correction-0").click();
  await expect(page.getByTestId("beta1-run-journey")).toBeEnabled();
  const second = await waitForJourney(page);
  expectSnapshotCounters(second, 2);
  const secondContract = expectJourneyContract(second, "SCI");
  verifiedEditableOptions += secondContract.editableCount;
  verifiedSourceSegments += secondContract.sourceSegmentCount;
  const secondRendered = await expectRenderedAssistAuthority(page, secondContract.journey, () => postAttempts);
  verifiedRenderedReviewUnits += secondRendered.renderedReviewUnitCount;
  const secondJourney = secondContract.journey;
  const sourceMaterials = array(secondJourney.sourceMaterials, "SOURCE_MATERIALS").map((item, index) => object(item, `SOURCE_${index}`));
  expect(sourceMaterials).toHaveLength(MATERIALS.length);
  for (const [index, material] of MATERIALS.entries()) {
    expect(sourceMaterials[index].kind).toBe(material.kind);
    expect(sourceMaterials[index].title).toBe(material.title);
    expect(sourceMaterials[index].content).toBe(material.content);
    expect(sourceMaterials[index].contentHash).toBe(sha256(JSON.stringify(material.content)));
  }
  const observationAuthority = object(secondJourney.observationAuthority, "OBSERVATION_AUTHORITY");
  expect(observationAuthority.trustLabel).toBe("EXPLICIT_USER_ASSERTION");
  expect(observationAuthority.scopeClass).toBe("SESSION_OR_LOCAL_SCOPE_BOUND");
  expect(array(observationAuthority.records, "OBSERVATION_RECORDS")).toHaveLength(1);
  expect(object(secondJourney.evidenceAuthority, "EVIDENCE_AUTHORITY").observationAuthorityHash).toBe(observationAuthority.authorityHash);
  const chatDock = page.getByRole("button", { name: "老麥", exact: true }).last();
  await chatDock.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#beta1-chat-panel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(chatDock).toBeFocused();
  await expectLocalInteractions(page, () => postAttempts);
  await expectNoSeriousAxe(page);
  await expectNoHorizontalOverflow(page);
  expect(await reloadAndRead(page)).toEqual(second);

  await page.setViewportSize({ width: 360, height: 640 });
  await page.getByRole("radio", { name: "關鍵字或短方向", exact: true }).check();
  await page.getByTestId("beta1-domain").selectOption("ai-occupational-safety-training");
  await page.getByTestId("beta1-output-target").selectOption("MOE");
  await page.getByTestId("beta1-research-input").fill("XR情境演練對職業安全教育遷移表現的影響");
  const third = await waitForJourney(page);
  expectSnapshotCounters(third, 3);
  const thirdContract = expectJourneyContract(third, "MOE");
  verifiedEditableOptions += thirdContract.editableCount;
  verifiedSourceSegments += thirdContract.sourceSegmentCount;
  const thirdRendered = await expectRenderedAssistAuthority(page, thirdContract.journey, () => postAttempts);
  verifiedRenderedReviewUnits += thirdRendered.renderedReviewUnitCount;
  expect({ verifiedEditableOptions, verifiedRenderedReviewUnits, verifiedSourceSegments }).toEqual({ verifiedEditableOptions: 297, verifiedRenderedReviewUnits: 351, verifiedSourceSegments: 27 });
  await expect(page.getByTestId("beta1-taiwan-review")).toBeVisible();
  await expectLocalInteractions(page, () => postAttempts);
  await expectNoSeriousAxe(page);
  await expectNoHorizontalOverflow(page);
  expect(await reloadAndRead(page)).toEqual(third);

  const journeys = array(third.journeys, "FINAL_JOURNEYS").map((item, index) => object(item, `FINAL_JOURNEY_${index}`));
  expect(new Set(journeys.map((journey) => text(journey.inputBundleHash, "INPUT_BUNDLE_HASH"))).size).toBe(3);
  const receipts = array(third.effectReceipts, "FINAL_RECEIPTS").map((item, index) => object(item, `RECEIPT_${index}`));
  expect(new Set(receipts.map((receipt) => text(receipt.effectId, "EFFECT_ID"))).size).toBe(3);

  injectCompletionUnknown = true;
  await page.getByTestId("beta1-research-input").fill("注入完成狀態不明時必須保留草稿且停止重送");
  const unknownResponse = page.waitForResponse((response) => response.status() === 503 && new URL(response.url()).pathname === API_PATH);
  await page.getByTestId("beta1-run-journey").click();
  await unknownResponse;
  await expect(page.getByTestId("beta1-reconcile-notice")).toBeVisible();
  await expect(page.getByTestId("beta1-run-journey")).toBeDisabled();
  expect({ postAttempts, upstreamPosts }).toEqual({ postAttempts: 4, upstreamPosts: 3 });
  await page.getByTestId("beta1-run-journey").click({ force: true }).catch(() => undefined);
  await expect.poll(() => postAttempts).toBe(4);
  injectCompletionUnknown = false;
  expect(await reloadAndRead(page)).toEqual(third);

  expect(requestBodies).toHaveLength(4);
  expect(array(requestBodies[0].materials, "J1_MATERIALS")).toEqual([]);
  expect(array(requestBodies[1].materials, "J2_MATERIALS").map((item) => object(item, "J2_MATERIAL").content)).toEqual(MATERIALS.map((material) => material.content));
  expect(requestBodies[0].observationConfirmation).toBeNull();
  expect(object(requestBodies[1].observationConfirmation, "J2_OBSERVATION_CONFIRMATION").authorityHash).toBe(observationAuthority.authorityHash);
  expect(requestBodies[2].observationConfirmation).toBeNull();
  expect(array(requestBodies[2].materials, "J3_MATERIALS")).toEqual([]);
  expect(unexpectedOrigins).toEqual([]);
  expect(postAttempts).toBe(4);
  expect(upstreamPosts).toBe(3);
});
