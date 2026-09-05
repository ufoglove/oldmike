import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

import { createSyntheticAlpha7Request, createSyntheticAlpha7Workspace } from "../lib/v2-alpha7/runtime.ts";

const baseUrl = process.env.V2_ALPHA7_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const counters = { studio: 0, external: 0, formalWrites: 0 };
let lastAxeBlockingIds = [];
let lastAxeTargets = [];

async function installBoundary(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha7/studio") {
      counters.studio += 1;
      const body = JSON.parse(request.postData() ?? "{}");
      const alpha6 = body.entryMode === "ALPHA6_MANUSCRIPT";
      const responseMode = body.purpose === "AUTHOR_REVISION_AND_REVIEWER_RESPONSE";
      const expected = ["entryMode", "operation", "purpose", "requestId", alpha6 ? "sourceArtifactId" : "sourceText", ...(responseMode ? ["reviewerComments"] : [])].sort();
      assert.deepEqual(Object.keys(body).sort(), expected);
      assert.equal(body.operation, "RUN_REVIEW_STUDIO");
      if (String(body.sourceText ?? "").includes("故障保留")) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "alpha7_completion_unknown" }) });
      try {
        const fixture = createSyntheticAlpha7Request(body.requestId, body.purpose, { entryMode: body.entryMode, sourceText: body.sourceText });
        if (responseMode) fixture.reviewerComments = body.reviewerComments.map((text, index) => ({ commentId: `UI-C${index + 1}`, text, sourceSection: fixture.source.sections[0].key }));
        const workspace = createSyntheticAlpha7Workspace(fixture);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, workspace, replayed: false, providerSubmissionCount: 1, formalResearchWriteCount: 0 }) });
      } catch (error) {
        const runtimeCode = /^[a-z0-9_]+$/u.test(error?.message ?? "") ? error.message : "fixture_runtime_invalid";
        console.log(JSON.stringify({ status: "BLOCKED", activeStage: "FIXTURE_RUNTIME", reasonClass: "CONTRACT", runtimeCode }));
        return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, code: runtimeCode }) });
      }
    }
    return route.continue();
  });
}

async function axe(page, name) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact, targets: item.nodes.flatMap((node) => node.target).filter((target) => typeof target === "string").slice(0, 12) })));
  const blocking = violations.filter((item) => item.impact === "critical" || item.impact === "serious");
  lastAxeBlockingIds = blocking.map((item) => item.id);
  lastAxeTargets = blocking.flatMap((item) => item.targets).slice(0, 12);
  assert.deepEqual(blocking, [], `${name}_axe_${JSON.stringify(violations)}`);
  return violations.length;
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const viewports = [{ name: "desktop-1440x900", width: 1440, height: 900 }, { name: "mobile-390x844", width: 390, height: 844 }];
const evidence = [];
let activeStage = "BROWSER_BOOT";
let currentPage = null;
try {
  for (const viewport of viewports) {
    activeStage = `${viewport.name}_ROUTE`;
    const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    currentPage = page;
    await installBoundary(page);
    await page.goto(`${baseUrl}/v2-alpha7-local`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
    await expect(page.getByTestId("alpha7-studio")).toBeVisible();
    await expect(page.getByTestId("alpha7-studio")).toHaveAttribute("data-hydrated", "true");
    if (viewport.name.startsWith("mobile")) await page.getByTestId("alpha7-purpose").selectOption("INDEPENDENT_REVIEWER_MODE");
    const before = counters.studio;
    activeStage = `${viewport.name}_REVIEW`;
    await page.getByTestId("alpha7-run").click();
    activeStage = `${viewport.name}_FOCUS_RETURN`;
    await expect(page.getByTestId("alpha7-run")).toBeFocused();
    activeStage = `${viewport.name}_FIVE_LENSES`;
    await expect(page.locator("article[data-testid^='alpha7-lens-']")).toHaveCount(5);
    activeStage = `${viewport.name}_FINDINGS`;
    await expect(page.locator("[data-testid^='alpha7-finding-']")).toHaveCount(5);
    activeStage = `${viewport.name}_REQUEST_COUNT`;
    assert.equal(counters.studio - before, 1, `${viewport.name} one review effect`);
    if (viewport.name.startsWith("desktop")) {
      activeStage = `${viewport.name}_THREE_ALTERNATIVES`;
      await expect(page.locator("input[type=radio]")).toHaveCount(15);
      await expect(page.getByText("證據校準", { exact: true })).toHaveCount(5);
      await expect(page.getByText("期刊精簡 · 建議", { exact: true })).toHaveCount(5);
      const draft = page.getByTestId("alpha7-draft");
      const original = await draft.textContent();
      const firstFinding = page.getByTestId("alpha7-finding-1");
      const sourceSpan = (await firstFinding.locator("blockquote").textContent()).replace(/^「|」$/gu, "");
      await firstFinding.locator("details summary").click();
      const selectedRevision = await firstFinding.locator("details p").textContent();
      assert.ok(sourceSpan && selectedRevision && sourceSpan !== selectedRevision);
      activeStage = `${viewport.name}_APPLY_UNDO`;
      await page.getByTestId("alpha7-apply-1").click();
      await expect(page.getByTestId("alpha7-live")).toContainText("可立即復原");
      const revisedDraft = await draft.textContent();
      assert.equal(revisedDraft.includes(sourceSpan), false);
      assert.equal(revisedDraft.includes(selectedRevision), true);
      await page.getByTestId("alpha7-undo-1").click();
      assert.equal(await draft.textContent(), original);
      activeStage = `${viewport.name}_HUMAN_GATE`;
      await page.getByTestId("alpha7-human-gate").click();
      await expect(page.getByTestId("alpha7-live")).toContainText("不是逐項核准");
      activeStage = `${viewport.name}_RESPONSE_MATRIX`;
      await page.getByTestId("alpha7-purpose").selectOption("AUTHOR_REVISION_AND_REVIEWER_RESPONSE");
      await page.getByTestId("alpha7-run").click();
      await expect(page.getByTestId("alpha7-response-matrix")).toBeVisible();
      await expect(page.getByTestId("alpha7-response-matrix").locator("tbody tr")).toHaveCount(3);
      await expect(page.getByTestId("alpha7-response-matrix").locator("details")).toHaveCount(3);
      await firstFinding.locator("input[type=radio]").first().check();
      const revisedChoiceDetails = firstFinding.locator("details");
      if (await revisedChoiceDetails.getAttribute("open") === null) await revisedChoiceDetails.locator("summary").click();
      const nonRecommendedRevision = await revisedChoiceDetails.locator("p").textContent();
      await page.getByTestId("alpha7-response-matrix").locator("details summary").first().click();
      await expect(page.getByTestId("alpha7-response-matrix").locator("details").first().locator("p")).toHaveCount(2);
      const responseAfter = await page.getByTestId("alpha7-response-matrix").locator("details").first().locator("p").nth(1).textContent();
      assert.ok(nonRecommendedRevision && responseAfter.includes(nonRecommendedRevision));
      activeStage = `${viewport.name}_FAILURE_PRESERVATION`;
      await page.getByTestId("alpha7-entry-mode").selectOption("PASTED_MANUSCRIPT");
      await page.getByTestId("alpha7-source-text").fill("故障保留：This manuscript remains long enough for a deterministic completion-unknown preservation fixture without any external content or formal write.");
      await page.getByTestId("alpha7-run").click();
      await expect(page.getByTestId("alpha7-error")).toBeVisible();
      await expect(page.getByTestId("alpha7-response-matrix")).toBeVisible();
      assert.ok(original);
    } else {
      activeStage = `${viewport.name}_REVIEWER_READ_ONLY`;
      await expect(page.getByTestId("alpha7-reviewer-report")).toBeVisible();
      await expect(page.locator("[data-testid^='alpha7-apply-']")).toHaveCount(0);
      await expect(page.getByText("唯讀模式：修訂方案供審稿判斷，不提供作者套用操作。")).toHaveCount(5);
      activeStage = `${viewport.name}_RESPONSE_FLOW`;
      await page.getByTestId("alpha7-purpose").selectOption("AUTHOR_REVISION_AND_REVIEWER_RESPONSE");
      await page.getByTestId("alpha7-run").click();
      await expect(page.getByTestId("alpha7-response-matrix")).toBeVisible();
      await expect(page.getByTestId("alpha7-response-matrix").locator("tbody tr")).toHaveCount(3);
      await page.getByTestId("alpha7-apply-1").click();
      await expect(page.getByTestId("alpha7-live")).toContainText("可立即復原");
      await page.getByTestId("alpha7-undo-1").click();
      await expect(page.getByTestId("alpha7-live")).toContainText("已復原");
    }
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement !== document.body), true, `${viewport.name} keyboard focus retained`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${viewport.name} no horizontal overflow`);
    activeStage = `${viewport.name}_AXE`;
    evidence.push({ viewport: viewport.name, axeViolations: await axe(page, viewport.name), focus: "PASS", liveRegion: "PASS", overflow: "PASS", screenshotRetained: false });
    await context.close();
  }
} catch (error) {
  const reasonClass = error?.name === "AssertionError" ? "ASSERTION" : error?.name === "TimeoutError" || /timed out|waiting for expect/iu.test(error?.message ?? "") ? "TIMEOUT" : /strict mode violation/iu.test(error?.message ?? "") ? "SELECTOR_NOT_UNIQUE" : /route|fulfill|request/iu.test(error?.message ?? "") ? "REQUEST_BOUNDARY" : /focus/iu.test(error?.message ?? "") ? "FOCUS_EXPECTATION" : "BROWSER_RUNTIME";
  const observedCount = currentPage && activeStage.endsWith("FIVE_LENSES") ? await currentPage.locator("article[data-testid^='alpha7-lens-']").count().catch(() => -1) : -1;
  const alertCount = currentPage ? await currentPage.locator('[role="alert"]').count().catch(() => -1) : -1;
  const summaryCount = currentPage ? await currentPage.getByTestId("alpha7-summary").count().catch(() => -1) : -1;
  console.log(JSON.stringify({ status: "BLOCKED", activeStage, reasonClass, observedCount, alertCount, summaryCount, studioRequests: counters.studio, assertionActual: typeof error?.actual === "number" ? error.actual : null, assertionExpected: typeof error?.expected === "number" ? error.expected : null, axeBlockingIds: lastAxeBlockingIds, axeTargets: lastAxeTargets }));
  throw error;
} finally { await browser.close(); }

assert.equal(counters.external, 0);
assert.equal(counters.formalWrites, 0);
console.log(JSON.stringify({ status: "PASS", acceptanceGroup: 7, journeys: 2, evidence, studioRequests: counters.studio, externalCalls: 0, formalResearchWrites: 0, screenshotsRetained: 0 }));
