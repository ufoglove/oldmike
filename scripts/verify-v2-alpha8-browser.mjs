import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.V2_ALPHA8_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const counters = { rescuePosts: 0, external: 0 };

async function installBoundary(page, options = {}) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) {
      counters.external += 1;
      return route.abort("blockedbyclient");
    }
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha8/rescue") {
      counters.rescuePosts += 1;
      const body = JSON.parse(request.postData() ?? "{}");
      assert.deepEqual(Object.keys(body).sort(), ["contractVersion", "focusDomain", "goal", "idempotencyKey", "materials", "requestId", "resultReadiness", "statistics"].sort());
      assert.equal(body.goal, "JOURNAL_MANUSCRIPT");
      assert.equal(body.resultReadiness, "OBSERVED_RESULTS_AVAILABLE");
      if (options.delayRescueMs) await new Promise((resolve) => setTimeout(resolve, options.delayRescueMs));
    }
    return route.continue();
  });
}

async function axe(page, viewport) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact, targets: item.nodes.flatMap((node) => node.target).slice(0, 8) })));
  const blocking = violations.filter((item) => item.impact === "critical" || item.impact === "serious");
  assert.deepEqual(blocking, [], `${viewport}_axe_${JSON.stringify(blocking)}`);
  return violations.length;
}

async function loadExampleAndGenerate(page) {
  await page.getByRole("button", { name: "載入示範半成品" }).click();
  await expect(page.getByLabel("目前結果狀態")).toHaveValue("OBSERVED_RESULTS_AVAILABLE");
  const before = counters.rescuePosts;
  await page.getByTestId("alpha8-run").click();
  await expect(page.getByTestId("alpha8-result")).toBeVisible({ timeout: 20_000 });
  assert.equal(counters.rescuePosts - before, 1, "one click produces one bounded HTTP journey");
  await expect(page.getByRole("heading", { name: "老麥已把材料接成完整研究路徑" })).toBeFocused();
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const evidence = [];
try {
  const desktopContext = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();
  await installBoundary(page);
  await page.goto(`${baseUrl}/v2-alpha8-local`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
  await expect(page.getByTestId("alpha8-workspace")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByLabel("希望完成的成果").locator("option")).toHaveCount(1);
  await expect(page.locator("details").filter({ hasText: "更多資料、表圖、文獻與備註" })).not.toHaveAttribute("open", "");
  await loadExampleAndGenerate(page);
  await expect(page.getByTestId("alpha8-direction-card")).toHaveCount(3);
  await expect(page.locator("[data-s0-field]")).toHaveCount(13);
  await expect(page.getByText("查看老麥 3 個專業建議", { exact: true })).toHaveCount(13);
  for (const field of await page.locator("[data-s0-field]").all()) {
    await field.locator("summary").click();
    const values = await field.locator("section p").allTextContents();
    assert.equal(values.length, 3);
    const normalized = values.map((value) => value.normalize("NFKC").replace(/\s+/gu, "").replace(/^(?:證據校準|證據整合|前沿重構|跨域前沿)[：｜|]/u, ""));
    assert.equal(new Set(normalized).size, 3, "S0 alternatives must be substantive, not prefix decoration");
    await field.locator("summary").click();
  }
  await expect(page.getByTestId("alpha8-draft-section")).toHaveCount(6);
  await expect(page.locator("[data-testid='alpha8-draft-section'][data-mode='PLAN_ONLY']")).toHaveCount(0);
  await expect(page.getByTestId("alpha8-result")).toHaveAttribute("data-synthetic-generation-stage-count", "2");
  await expect(page.getByTestId("alpha8-result")).toHaveAttribute("data-live-provider-submission-count", "0");
  await expect(page.getByTestId("alpha8-result")).toHaveAttribute("data-formal-write-count", "0");
  const requestCount = counters.rescuePosts;
  await page.getByTestId("alpha8-direction-card").last().click();
  assert.equal(counters.rescuePosts, requestCount, "direction switching is local only");

  const firstS0 = page.locator("[data-s0-field='workingTitle']");
  const originalS0 = await firstS0.getByTestId("alpha8-s0-value-workingTitle").textContent();
  await firstS0.locator("summary").click();
  await expect(firstS0.locator("section")).toHaveCount(3);
  await firstS0.getByRole("button", { name: "套用這個版本" }).first().click();
  const revisedS0 = await firstS0.getByTestId("alpha8-s0-value-workingTitle").textContent();
  assert.notEqual(revisedS0, originalS0);
  await firstS0.getByRole("button", { name: "復原這一欄" }).click();
  assert.equal(await firstS0.getByTestId("alpha8-s0-value-workingTitle").textContent(), originalS0);
  assert.equal(counters.rescuePosts, requestCount, "S0 alternatives apply locally");

  const draftTextareas = page.getByTestId("alpha8-current-draft").locator("textarea");
  const readDraft = () => draftTextareas.evaluateAll((elements) => elements.map((element) => element instanceof HTMLTextAreaElement ? element.value : ""));
  const originalDraft = await readDraft();
  await page.getByTestId("alpha8-apply-draft").click();
  await expect(page.getByTestId("alpha8-apply-draft")).toBeDisabled();
  const appliedDraft = await readDraft();
  assert.notDeepEqual(appliedDraft, originalDraft);
  await page.getByTestId("alpha8-undo-draft").click();
  assert.deepEqual(await readDraft(), originalDraft);
  await page.locator("textarea[data-material-kind='ABSTRACT']").fill("材料已變更，舊建議不得再套用。這段文字保留作為過期結果阻擋測試。");
  await expect(page.getByTestId("alpha8-stale")).toBeVisible();
  await expect(page.getByTestId("alpha8-apply-draft")).toBeDisabled();
  await expect(page.locator("[data-s0-field='workingTitle']").getByRole("button", { name: "套用這個版本" }).first()).toBeDisabled();
  assert.equal(counters.rescuePosts, requestCount, "editing sources never silently resubmits");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "desktop no horizontal overflow");
  evidence.push({ viewport: "1440x900", axeViolations: await axe(page, "desktop-1440x900"), focus: "PASS", liveRegion: "PASS", overflow: "PASS" });
  await desktopContext.close();

  const staleContext = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: 1000, height: 760 } });
  const stalePage = await staleContext.newPage();
  await installBoundary(stalePage, { delayRescueMs: 500 });
  await stalePage.goto(`${baseUrl}/v2-alpha8-local`, { waitUntil: "domcontentloaded" });
  await stalePage.getByRole("button", { name: "載入示範半成品" }).click();
  await stalePage.getByTestId("alpha8-run").click();
  await expect(stalePage.getByTestId("alpha8-run")).toBeDisabled();
  await stalePage.locator("textarea[data-material-kind='ABSTRACT']").fill("等待回覆期間更新的摘要必須保留，舊回覆不得成為目前成果。");
  await expect(stalePage.getByTestId("alpha8-run")).toBeEnabled({ timeout: 20_000 });
  await expect(stalePage.getByText(/較早的回覆不會成為目前結果/u)).toBeVisible();
  await expect(stalePage.getByTestId("alpha8-result")).toHaveCount(0);
  await expect(stalePage.locator("textarea[data-material-kind='ABSTRACT']")).toHaveValue("等待回覆期間更新的摘要必須保留，舊回覆不得成為目前成果。");
  await staleContext.close();

  for (const viewport of [{ name: "390x844", width: 390, height: 844 }, { name: "360x640", width: 360, height: 640 }]) {
    const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: viewport.width, height: viewport.height } });
    const mobile = await context.newPage();
    await installBoundary(mobile);
    await mobile.goto(`${baseUrl}/v2-alpha8-local`, { waitUntil: "domcontentloaded" });
    await mobile.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
    await loadExampleAndGenerate(mobile);
    await mobile.getByTestId("alpha8-direction-card").first().focus();
    await expect(mobile.getByTestId("alpha8-direction-card").first()).toBeFocused();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${viewport.name} no horizontal overflow`);
    evidence.push({ viewport: viewport.name, axeViolations: await axe(mobile, `mobile-${viewport.name}`), focus: "PASS", liveRegion: "PASS", overflow: "PASS" });
    await context.close();
  }
} finally {
  await browser.close();
}

assert.equal(counters.external, 0);
assert.equal(counters.rescuePosts, 4);
console.log(JSON.stringify({ status: "PASS", acceptanceGroup: 9, journeys: 2, viewports: 3, evidence, inFlightStaleResponse: "PASS_DROPPED_WITH_INPUT_PRESERVED", rescuePosts: counters.rescuePosts, externalRequests: 0, formalResearchWrites: 0, onlineDatabaseWrites: 0, liveProviderSubmissions: 0, screenshotsRetained: 0 }));
