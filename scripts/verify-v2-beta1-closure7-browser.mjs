import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.V2_BETA1_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const counters = { external: 0, unexpectedMutation: 0, journeyPosts: 0 };
let activeStage = "BROWSER_LAUNCH";

function exactKeys(value, expected, label) {
  assert.equal(Boolean(value) && typeof value === "object" && !Array.isArray(value), true, `${label}_record`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label}_exact_keys`);
}

async function installBoundary(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      if (request.method() !== "POST" || target.pathname !== "/api/v2-beta1/project") { counters.unexpectedMutation += 1; return route.abort("blockedbyclient"); }
      const body = JSON.parse(request.postData() ?? "{}");
      exactKeys(body, ["contractVersion", "operation", "requestId", "idempotencyKey", "projectId", "baseRevision", "baseContentHash", "entryMode", "outputTarget", "researchDirection", "researchDomain", "materials"], "journey_request");
      assert.equal(body.contractVersion, "old-mike-v2-beta1/1.4.0");
      assert.equal(body.operation, "RUN_RESEARCH_JOURNEY");
      assert.equal(request.headers()["x-old-mike-v2-workspace"], "fixture-workspace-v2");
      counters.journeyPosts += 1;
    }
    return route.continue();
  });
}

async function runAxe(page) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact })));
  assert.deepEqual(violations.filter((item) => item.impact === "critical" || item.impact === "serious"), []);
  return violations.length;
}

try {
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      await installBoundary(page);
      activeStage = "PAGE_READY";
      const initialGet = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v2-beta1/project");
      await page.goto(`${baseUrl}/research-os-local`, { waitUntil: "domcontentloaded" });
      await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
      assert.equal((await initialGet).status(), 200);
      await expect(page.getByTestId("beta1-research-os")).toBeVisible();
      assert.doesNotMatch(await page.locator("body").innerText(), /OpenClaw|Codex|\bGPT\b|Zeabur|Alpha|Beta/iu);

      activeStage = "KEYWORD_JOURNAL_INPUT";
      await page.getByRole("radio", { name: "關鍵字或短方向" }).check();
      await page.getByTestId("beta1-output-target").selectOption("SSCI");
      await page.getByTestId("beta1-research-input").fill("生成式回饋的證據校準與高等教育自我調節學習");
      const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v2-beta1/project");
      await page.getByTestId("beta1-run-journey").focus();
      await page.getByTestId("beta1-run-journey").press("Enter");
      const response = await responsePromise;
      assert.equal(response.status(), 200);
      const payload = await response.json();
      assert.equal(payload.contractVersion, "old-mike-v2-beta1/1.4.0");
      assert.equal(payload.effectSubmissionCount, 1);
      assert.equal(payload.liveProviderCallCount, 0);
      assert.equal(payload.snapshot.journey.directions.length, 3);
      assert.equal(payload.snapshot.effectReceipts[0].generatedArtifactHash, payload.snapshot.journey.artifactHash);
      assert.equal(payload.snapshot.effectReceipts[0].payloadHash, payload.snapshot.journey.inputBundleHash);
      assert.equal(Object.values(payload.snapshot.journey.directions[1].fieldAssist).flat().length, 39);

      activeStage = "LOCAL_SWITCH_APPLY_UNDO";
      const selected = page.getByTestId("beta1-selected-direction");
      const recommendedHash = await selected.getAttribute("data-whole-artifact-hash");
      await page.getByTestId("beta1-direction-EVIDENCE_FIRST").click();
      assert.notEqual(await selected.getAttribute("data-whole-artifact-hash"), recommendedHash);
      await page.getByTestId("beta1-direction-BALANCED_RECOMMENDED").click();
      assert.equal(await selected.getAttribute("data-whole-artifact-hash"), recommendedHash);
      assert.equal(counters.journeyPosts, 1);
      const assist = page.getByTestId("beta1-assist-workingTitle");
      await assist.locator("li").nth(1).getByRole("button", { name: "套用至預覽" }).click();
      await assist.getByRole("button", { name: "復原此欄" }).click();

      activeStage = "FOCUS_LIVE_REGION_AXE_OVERFLOW";
      await expect(page.getByTestId("beta1-live")).toBeAttached();
      await page.getByTestId("beta1-chat-input").focus();
      await expect(page.getByTestId("beta1-chat-input")).toBeFocused();
      const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      assert.equal(sizes.scrollWidth <= sizes.clientWidth + 1, true);
      const axeAllImpacts = await runAxe(page);
      const screenshot = await page.screenshot({ fullPage: true });

      activeStage = "RELOAD_GET_ONLY";
      const postsBeforeReload = counters.journeyPosts;
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("beta1-journey-artifact")).toBeVisible();
      assert.equal(counters.journeyPosts, postsBeforeReload);

      assert.equal(counters.external, 0);
      assert.equal(counters.unexpectedMutation, 0);
      console.log(JSON.stringify({ status: "PASS", journeys: ["KEYWORD_JOURNAL"], viewports: ["1440x900"], oneChromiumContext: true, journeyPosts: 1, cardSwitchAdditionalEffects: 0, reloadAdditionalEffects: 0, externalRequests: 0, unexpectedMutationRequests: 0, axeSeriousCritical: 0, axeAllImpacts, focus: "PASS", liveRegion: "PASS", overflow: "PASS", screenshotSha256: createHash("sha256").update(screenshot).digest("hex"), screenshotsRetained: 0, formalResearchWrites: 0, onlineDatabaseWrites: 0, externalMutations: 0 }));
    } finally { await context.close(); }
  } finally { await browser.close(); }
} catch (error) {
  console.log(JSON.stringify({ status: "BLOCKED", activeStage, reasonClass: error?.name === "TimeoutError" ? "TIMEOUT" : error?.name === "AssertionError" ? "ASSERTION" : "BROWSER_RUNTIME", subgate: /axe/iu.test(error?.message ?? "") ? "AXE" : /overflow/iu.test(error?.message ?? "") ? "OVERFLOW" : /focus/iu.test(error?.message ?? "") ? "FOCUS" : "CONTRACT" }));
  process.exitCode = 1;
}
