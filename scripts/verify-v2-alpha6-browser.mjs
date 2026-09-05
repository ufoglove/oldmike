import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

import { academicLanguageHash } from "../lib/academic-language-contract.ts";
import {
  createAlpha6LanguageAssistance,
  createSyntheticAlpha6PastedRequest,
  createSyntheticAlpha6ProjectRequest,
  createSyntheticAlpha6Workspace,
} from "../lib/v2-alpha6/runtime.ts";

const baseUrl = process.env.V2_ALPHA6_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const counters = { generation: 0, language: 0, external: 0, formalWrites: 0 };

async function installBoundary(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha6/workspace") {
      const body = JSON.parse(request.postData() ?? "{}");
      if (body.operation === "GENERATE_WORKSPACE") {
        counters.generation += 1;
        const expectedKeys = body.entryMode === "PROJECT_ARTIFACT"
          ? ["declaredLanguage", "entryMode", "operation", "projectSourceId", "requestId"]
          : ["declaredLanguage", "entryMode", "operation", "requestId", "sourceText"];
        assert.deepEqual(Object.keys(body).sort(), expectedKeys);
        if (String(body.sourceText ?? "").includes("故障保留")) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "alpha6_completion_unknown" }) });
        const requestValue = body.entryMode === "PROJECT_ARTIFACT"
          ? createSyntheticAlpha6ProjectRequest(body.requestId)
          : createSyntheticAlpha6PastedRequest(body.requestId, body.sourceText, body.declaredLanguage);
        const workspace = createSyntheticAlpha6Workspace(requestValue);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, workspace, providerSubmissionCount: 1, formalResearchWriteCount: 0 }) });
      }
      if (body.operation === "LANGUAGE_ASSIST") {
        counters.language += 1;
        assert.deepEqual(Object.keys(body).sort(), ["operation", "requestId", "sourceHash", "sourceText", "task"]);
        assert.equal(body.sourceHash, academicLanguageHash(body.sourceText));
        const assistance = createAlpha6LanguageAssistance(body.task, body.sourceText);
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, assistance, providerSubmissionCount: 1, formalResearchWriteCount: 0 }) });
      }
      throw new Error("unexpected Alpha6 operation");
    }
    return route.continue();
  });
}

async function axe(page, name) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact, targets: item.nodes.flatMap((node) => node.target).filter((target) => typeof target === "string").slice(0, 12) })));
  const blocking = violations.filter((item) => item.impact === "critical" || item.impact === "serious");
  if (blocking.length) console.log(JSON.stringify({ status: "BLOCKED", activeStage: `${name}_AXE`, reasonClass: "AXE", axeBlockingIds: blocking.map((item) => item.id), axeTargets: blocking.flatMap((item) => item.targets).slice(0, 12) }));
  assert.deepEqual(blocking, [], `${name}_axe_${JSON.stringify(violations)}`);
  return violations.length;
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const viewports = [{ name: "desktop-1440x900", width: 1440, height: 900 }, { name: "mobile-390x844", width: 390, height: 844 }, { name: "mobile-360x640", width: 360, height: 640 }];
const evidence = [];
let activeStage = "BROWSER_BOOT";
try {
  for (const viewport of viewports) {
    activeStage = `${viewport.name}_ROUTE_READY`;
    const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    await installBoundary(page);
    await page.goto(`${baseUrl}/v2-alpha6-local`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
    await expect(page.getByTestId("alpha6-workspace")).toBeVisible();
    await page.getByLabel("從專案 S0 開始").check();
    await page.getByLabel("選擇專案研究骨架").selectOption("project-s0-alpha6-local");
    const generationBefore = counters.generation;
    activeStage = `${viewport.name}_GENERATE`;
    await page.getByTestId("alpha6-generate").click();
    await expect(page.getByRole("heading", { name: "三種專業論證策略" })).toBeFocused();
    await expect(page.locator("[data-testid^='alpha6-strategy-']")).toHaveCount(3);
    await expect(page.getByTestId("alpha6-strategy-BALANCED_JOURNAL_FIT_RECOMMENDED")).toHaveAttribute("aria-pressed", "true");
    assert.equal(counters.generation - generationBefore, 1, `${viewport.name} one generation action`);
    await page.getByTestId("alpha6-strategy-FRONTIER_THEORY_BUILDING").click();
    assert.equal(counters.generation - generationBefore, 1, `${viewport.name} strategy switch local-only`);
    await expect(page.locator("[data-testid^='alpha6-section-']")).toHaveCount(13);
    await expect(page.getByText("尚無已驗證結果：目前只建立寫作規格").first()).toBeVisible();
    const titleInput = page.getByLabel("題目內容");
    const originalTitle = await titleInput.inputValue();
    const languageBefore = counters.language;
    activeStage = `${viewport.name}_LANGUAGE_ASSIST`;
    await page.getByTestId("alpha6-assist-title").click();
    await expect(page.getByRole("heading", { name: "題目" }).last()).toBeFocused();
    await expect(page.locator("#alpha6-suggestion-drawer li")).toHaveCount(3);
    await page.getByTestId("alpha6-apply-suggestion").click();
    await expect(titleInput).not.toHaveValue(originalTitle);
    assert.equal(counters.language - languageBefore, 1, `${viewport.name} one explicit language action`);
    await page.getByRole("button", { name: "關閉三案預覽" }).click();
    await expect(page.getByTestId("alpha6-assist-title")).toBeFocused();
    await page.getByTestId("alpha6-undo-title").click();
    await expect(titleInput).toHaveValue(originalTitle);
    activeStage = `${viewport.name}_HUMAN_GATE`;
    await page.getByLabel("我已檢視證據狀態、結果缺口、期刊快照與整份稿件。").check();
    await page.getByRole("button", { name: "確認全件預覽" }).click();
    await expect(page.getByRole("status")).toContainText("正式研究寫入與外部投稿仍為零");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement !== document.body), true, `${viewport.name} keyboard focus retained`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${viewport.name} no horizontal overflow`);
    activeStage = `${viewport.name}_AXE`;
    const axeViolations = await axe(page, viewport.name);
    evidence.push({ viewport: viewport.name, axeViolations, focus: "PASS", overflow: "PASS", screenshotRetained: false });
    if (viewport.name === "desktop-1440x900") {
      const retainedTitle = await titleInput.inputValue();
      activeStage = `${viewport.name}_FAILURE_MODE_SWITCH`;
      await page.getByRole("radio", { name: /貼上既有稿件/u }).check();
      activeStage = `${viewport.name}_FAILURE_SOURCE_INPUT`;
      await page.getByTestId("alpha6-source-text").fill("故障保留：This source draft is deliberately long enough to exercise completion-unknown preservation without external content.");
      activeStage = `${viewport.name}_FAILURE_SUBMIT`;
      await page.getByTestId("alpha6-generate").click();
      activeStage = `${viewport.name}_FAILURE_ALERT`;
      await expect(page.locator('[role="alert"]').filter({ hasText: "上一版稿件都已保留" })).toBeVisible();
      activeStage = `${viewport.name}_FAILURE_DRAFT_COMPARE`;
      assert.equal(await titleInput.inputValue(), retainedTitle, "failure preserves existing draft");
    }
    await context.close();
  }
} catch (error) {
  console.log(JSON.stringify({ status: "BLOCKED", activeStage, reasonClass: error?.name === "AssertionError" ? "ASSERTION" : error?.name === "TimeoutError" ? "TIMEOUT" : "BROWSER_RUNTIME" }));
  throw error;
} finally { await browser.close(); }

assert.equal(counters.external, 0);
assert.equal(counters.formalWrites, 0);
console.log(JSON.stringify({ status: "PASS", acceptanceGroup: 8, journeys: 3, evidence, generationRequests: counters.generation, languageRequests: counters.language, externalCalls: 0, formalResearchWrites: 0, screenshotsRetained: 0 }));
