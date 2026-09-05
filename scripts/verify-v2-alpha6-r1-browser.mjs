import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

import { academicLanguageHash } from "../lib/academic-language-contract.ts";
import { V2_ALPHA6_R1_SEMANTIC_FIXTURES } from "../lib/v2-alpha6-r1/semantic-language-fixtures.ts";
import {
  createAlpha6LanguageAssistance,
  createSyntheticAlpha6ProjectRequest,
  createSyntheticAlpha6Workspace,
} from "../lib/v2-alpha6/runtime.ts";

const baseUrl = process.env.V2_ALPHA6_R1_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const taskFixtures = ["ai-education-zh-en", "occupational-safety-en-zh", "environment-academic-edit", "energy-natural-multiparagraph"]
  .map((fixtureId) => V2_ALPHA6_R1_SEMANTIC_FIXTURES.find((fixture) => fixture.fixtureId === fixtureId));
assert.equal(taskFixtures.every(Boolean), true);
const counters = { generation: 0, language: 0, external: 0 };

async function installBoundary(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (request.method() !== "POST" || target.pathname !== "/api/v2-alpha6/workspace") return route.continue();
    const body = JSON.parse(request.postData() ?? "{}");
    if (body.operation === "GENERATE_WORKSPACE") {
      counters.generation += 1;
      assert.deepEqual(Object.keys(body).sort(), ["declaredLanguage", "entryMode", "operation", "projectSourceId", "requestId"]);
      const workspace = createSyntheticAlpha6Workspace(createSyntheticAlpha6ProjectRequest(body.requestId));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, workspace, providerSubmissionCount: 1, formalResearchWriteCount: 0 }) });
    }
    if (body.operation === "LANGUAGE_ASSIST") {
      counters.language += 1;
      assert.deepEqual(Object.keys(body).sort(), ["operation", "requestId", "sourceHash", "sourceText", "task"]);
      assert.equal(body.sourceHash, academicLanguageHash(body.sourceText));
      try {
        const assistance = createAlpha6LanguageAssistance(body.task, body.sourceText);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, assistance, providerSubmissionCount: 1, formalResearchWriteCount: 0 }) });
      } catch (error) {
        const code = error instanceof Error ? error.message : "alpha6_assist_failed";
        return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ ok: false, code }) });
      }
    }
    throw new Error("alpha6_r1_unexpected_operation");
  });
}

async function runAxe(page, viewport) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact })));
  assert.deepEqual(violations.filter((item) => item.impact === "critical" || item.impact === "serious"), [], `${viewport}_axe`);
  return violations.length;
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const viewports = [{ name: "desktop-1440x900", width: 1440, height: 900 }, { name: "mobile-390x844", width: 390, height: 844 }];
const evidence = [];
let activeStage = "BROWSER_BOOT";
try {
  for (const viewport of viewports) {
    activeStage = `${viewport.name}_ROUTE`;
    activeStage = `${viewport.name}_CONTEXT`;
    const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: viewport.width, height: viewport.height } });
    activeStage = `${viewport.name}_PAGE`;
    const page = await context.newPage();
    activeStage = `${viewport.name}_INTERCEPT`;
    await installBoundary(page);
    activeStage = `${viewport.name}_NAVIGATION`;
    await page.goto(`${baseUrl}/v2-alpha6-local`, { waitUntil: "domcontentloaded" });
    activeStage = `${viewport.name}_STYLE`;
    await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
    activeStage = `${viewport.name}_HYDRATION`;
    await expect(page.getByTestId("alpha6-workspace")).toBeVisible();
    activeStage = `${viewport.name}_ENTRY_MODE`;
    await page.getByLabel("從專案 S0 開始").check();
    activeStage = `${viewport.name}_PROJECT_SELECT`;
    await page.getByTestId("alpha6-project").selectOption("project-s0-alpha6-local");
    activeStage = `${viewport.name}_GENERATE`;
    await page.getByTestId("alpha6-generate").click();
    activeStage = `${viewport.name}_RESULT_FOCUS`;
    await expect(page.getByRole("heading", { name: "三種專業論證策略" })).toBeFocused();
    activeStage = `${viewport.name}_SECTION_COUNT`;
    await expect(page.locator("article[data-testid^='alpha6-section-']")).toHaveCount(13);

    activeStage = `${viewport.name}_TITLE_BINDING`;
    const title = page.getByTestId("alpha6-section-input-title");
    for (const fixture of taskFixtures) {
      activeStage = `${viewport.name}_${fixture.task}_INPUT`;
      await title.fill(fixture.source);
      activeStage = `${viewport.name}_${fixture.task}_SELECT`;
      await page.getByTestId("alpha6-task-title").selectOption(fixture.task);
      const before = counters.language;
      activeStage = `${viewport.name}_${fixture.task}_OPEN`;
      await page.getByTestId("alpha6-assist-title").click();
      activeStage = `${viewport.name}_${fixture.task}_DRAWER`;
      await expect(page.getByRole("heading", { name: "題目" }).last()).toBeFocused();
      await expect(page.locator("#alpha6-suggestion-drawer li")).toHaveCount(3);
      await expect(page.locator("#alpha6-suggestion-drawer li").nth(1).getByText("推薦", { exact: true })).toBeVisible();
      activeStage = `${viewport.name}_${fixture.task}_APPLY`;
      await page.getByTestId("alpha6-apply-suggestion").click();
      await expect(page.getByTestId("alpha6-live-region")).toContainText("已套用");
      assert.notEqual(await title.inputValue(), fixture.source);
      assert.equal(counters.language - before, 1);
      activeStage = `${viewport.name}_${fixture.task}_CLOSE`;
      await page.getByRole("button", { name: "關閉三案預覽" }).click();
      await expect(page.getByTestId("alpha6-assist-title")).toBeFocused();
      activeStage = `${viewport.name}_${fixture.task}_UNDO`;
      await page.getByTestId("alpha6-undo-title").click();
      activeStage = `${viewport.name}_${fixture.task}_UNDO_VALUE`;
      await expect(title).toHaveValue(fixture.source);
      activeStage = `${viewport.name}_${fixture.task}_UNDO_LIVE`;
      await expect(page.getByTestId("alpha6-live-region")).toContainText("已復原");
    }

    const unsupported = "This arbitrary local source is intentionally outside the authored semantic fixture authority.";
    activeStage = `${viewport.name}_UNSUPPORTED_INPUT`;
    await title.fill(unsupported);
    activeStage = `${viewport.name}_UNSUPPORTED_SELECT`;
    await page.getByTestId("alpha6-task-title").selectOption("ACADEMIC_EN_EDIT");
    activeStage = `${viewport.name}_UNSUPPORTED_OPEN`;
    await page.getByTestId("alpha6-assist-title").click();
    activeStage = `${viewport.name}_UNSUPPORTED_ALERT`;
    await expect(page.locator("#alpha6-suggestion-drawer [role='alert']")).toContainText("原稿已完整保留");
    activeStage = `${viewport.name}_UNSUPPORTED_VALUE`;
    await expect(title).toHaveValue(unsupported);
    activeStage = `${viewport.name}_UNSUPPORTED_CLOSE`;
    await page.getByRole("button", { name: "關閉三案預覽" }).click();
    await expect(page.getByTestId("alpha6-assist-title")).toBeFocused();
    activeStage = `${viewport.name}_RESPONSIVE`;
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
    activeStage = `${viewport.name}_KEYBOARD`;
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement !== document.body), true);
    activeStage = `${viewport.name}_BRANDING`;
    const visibleText = await page.locator("body").innerText();
    for (const forbidden of ["OpenClaw", "ChatGPT", "GPT", "provider", "model ID"]) assert.equal(visibleText.includes(forbidden), false);
    activeStage = `${viewport.name}_AXE`;
    const axeViolations = await runAxe(page, viewport.name);
    evidence.push({ viewport: viewport.name, tasks: 4, axeBlocking: 0, axeViolations, focus: "PASS", liveRegion: "PASS", overflow: "PASS", screenshotRetained: false });
    await context.close();
  }
} catch (error) {
  console.log(JSON.stringify({ status: "BLOCKED", activeStage, reasonClass: error?.name === "AssertionError" ? "ASSERTION" : error?.name === "TimeoutError" ? "TIMEOUT" : "BROWSER_RUNTIME" }));
  throw error;
} finally {
  await browser.close();
}

assert.equal(counters.generation, 2);
assert.equal(counters.language, 10);
assert.equal(counters.external, 0);
console.log(JSON.stringify({ status: "PASS", gate: "ALPHA6_R1_FOCUSED_BROWSER", viewports: 2, taskJourneys: 8, unsupportedDraftPreservation: 2, generationRequests: 2, languageRequests: 10, evidence, axeBlocking: 0, focus: "PASS", liveRegion: "PASS", externalCalls: 0, formalResearchWrites: 0, screenshotsRetained: 0 }));
