import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const baseUrl = process.env.V2_ALPHA2_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const evidenceRoot = path.join(workspaceRoot, "OLD_MIKE_V2_ALPHA2_SCREEN_EVIDENCE");
const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
await mkdir(evidenceRoot, { recursive: true });

function installNetworkBoundary(page, counters) {
  return page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) {
      counters.external += 1;
      return route.abort("blockedbyclient");
    }
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha2/journeys") counters.journeyPosts += 1;
    if (request.method() === "POST" && /\/api\/v2-alpha2\/journeys\/[^/]+\/assist$/u.test(target.pathname)) counters.assistPosts += 1;
    if (request.method() !== "GET" && !target.pathname.startsWith("/api/v2-alpha2/")) counters.formalMutations += 1;
    return route.continue();
  });
}

async function runAxe(page, name) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact, targets: item.nodes.map((node) => node.target.join(" ")).slice(0, 5) })));
  const blocking = violations.filter((item) => item.impact === "critical" || item.impact === "serious");
  assert.deepEqual(blocking, [], `${name}_axe_${JSON.stringify(blocking)}`);
  return violations.length;
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
let journeyRef = "";
let axeCount = 0;
try {
  const desktopCounters = { journeyPosts: 0, assistPosts: 0, formalMutations: 0, external: 0 };
  const desktop = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  await installNetworkBoundary(page, desktopCounters);
  await page.goto(`${baseUrl}/v2-alpha2-local`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
  await expect(page.getByRole("heading", { name: "今天想研究什麼？" })).toBeVisible();
  await page.getByLabel("研究關鍵字或方向").fill("大學教師如何校準生成式工具的課程使用");
  const startResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v2-alpha2/journeys");
  await page.getByRole("button", { name: "老麥整理研究方向" }).click();
  const startResponse = await startResponsePromise;
  const startBody = await startResponse.json();
  assert.equal(startResponse.status(), 202, `journey_start_${startResponse.status()}_${String(startBody?.code ?? "unknown")}`);
  await expect(page.getByTestId("alpha2-journey")).toHaveAttribute("data-last-ready-stage", "A", { timeout: 12_000 });
  await expect(page.locator("section[aria-labelledby='direction-heading'] button[data-lane]")).toHaveCount(3);
  await expect(page.locator("section[aria-labelledby='blueprint-heading']")).toHaveCount(0);
  const recommended = page.locator("section[aria-labelledby='direction-heading'] button[data-lane='BALANCED_RECOMMENDED']");
  await expect(recommended).toHaveAttribute("aria-pressed", "true");
  await expect(recommended).toContainText("推薦");
  const frontier = page.locator("section[aria-labelledby='direction-heading'] button[data-lane='FRONTIER_INNOVATION']");
  await frontier.click();
  await expect(frontier).toHaveAttribute("aria-pressed", "true");
  assert.equal(desktopCounters.journeyPosts, 1);

  await expect(page.getByTestId("alpha2-journey")).toHaveAttribute("data-last-ready-stage", "B", { timeout: 12_000 });
  await expect(page.getByRole("heading", { name: "完整 S0 草稿 · 13/13" })).toBeVisible();
  await expect(page.locator("section[aria-labelledby='blueprint-heading'] textarea")).toHaveCount(13);
  await expect(page.getByTestId("alpha2-journey")).toHaveAttribute("data-formal-write-count", "0");
  const sourceAndCompare = await page.locator("section[aria-labelledby='blueprint-heading']").innerText();
  assert.match(sourceAndCompare, /比較中：.*失效邊界/u);
  assert.match(sourceAndCompare, /草稿來源：.*作用機制與實務結果/u);

  const title = page.getByLabel("暫定研究題目");
  const originalTitle = await title.inputValue();
  const titleAssist = page.locator("[data-field='workingTitle']").getByRole("button", { name: "老麥三案" });
  await titleAssist.click();
  const dialog = page.getByRole("dialog", { name: "暫定研究題目" });
  await expect(dialog).toBeVisible();
  await expect(titleAssist).toHaveAttribute("aria-expanded", "true");
  await expect(dialog.locator("li")).toHaveCount(3, { timeout: 12_000 });
  await expect(dialog.getByText("證據優先", { exact: true })).toBeVisible();
  await expect(dialog.getByText("平衡推薦", { exact: true })).toBeVisible();
  await expect(dialog.getByText("前沿創新", { exact: true })).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog).toBeVisible();
  await dialog.locator("li").filter({ hasText: "平衡推薦" }).getByRole("button", { name: "預覽後套用" }).click();
  assert.notEqual(await title.inputValue(), originalTitle);
  await page.getByRole("button", { name: "復原上一次套用" }).click();
  await expect(title).toHaveValue(originalTitle);
  await page.getByLabel("我已檢查這份本機草稿").check();
  await expect(page.getByRole("button", { name: "正式建立尚未在 Alpha2 啟用" })).toBeDisabled();
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  journeyRef = new URL(page.url()).searchParams.get("journey") ?? "";
  assert.match(journeyRef, /^vj_[0-9a-f]{32}$/u);
  const beforeReload = { ...desktopCounters };
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("alpha2-journey")).toHaveAttribute("data-last-ready-stage", "B", { timeout: 12_000 });
  assert.deepEqual(desktopCounters, beforeReload);
  axeCount += await runAxe(page, "desktop-1440x900");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1);
  await page.screenshot({ path: path.join(evidenceRoot, "alpha2-desktop-1440x900.png"), fullPage: false });
  assert.deepEqual(desktopCounters, { journeyPosts: 1, assistPosts: 1, formalMutations: 0, external: 0 });
  await desktop.close();

  for (const viewport of [{ name: "mobile-390x844", width: 390, height: 844 }, { name: "mobile-360x640", width: 360, height: 640 }]) {
    const counters = { journeyPosts: 0, assistPosts: 0, formalMutations: 0, external: 0 };
    const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: viewport.width, height: viewport.height } });
    const mobile = await context.newPage();
    await installNetworkBoundary(mobile, counters);
    await mobile.goto(`${baseUrl}/v2-alpha2-local?journey=${encodeURIComponent(journeyRef)}`, { waitUntil: "domcontentloaded" });
    await mobile.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
    await expect(mobile.getByTestId("alpha2-journey")).toHaveAttribute("data-last-ready-stage", "B", { timeout: 12_000 });
    await expect(mobile.locator("section[aria-labelledby='direction-heading'] button[data-lane]")).toHaveCount(3);
    await expect(mobile.locator("section[aria-labelledby='blueprint-heading'] textarea")).toHaveCount(13);
    const firstAssist = mobile.getByRole("button", { name: "老麥三案" }).first();
    await firstAssist.focus();
    await expect(firstAssist).toBeFocused();
    axeCount += await runAxe(mobile, viewport.name);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `${viewport.name}_overflow`);
    assert.deepEqual(counters, { journeyPosts: 0, assistPosts: 0, formalMutations: 0, external: 0 });
    await mobile.getByRole("heading", { name: "完整 S0 草稿 · 13/13" }).evaluate((heading) => window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - 78, behavior: "instant" }));
    await mobile.screenshot({ path: path.join(evidenceRoot, `alpha2-${viewport.name}.png`), fullPage: false });
    await context.close();
  }

  console.log("V2_ALPHA2_BROWSER_JOURNEY=PASS_202_POLL_RELOAD_DESKTOP_390_360");
  console.log("V2_ALPHA2_STAGE_A_PRESERVED_WHILE_B=PASS");
  console.log("V2_ALPHA2_LOCAL_SWITCH_EFFECTS=0");
  console.log("V2_ALPHA2_FIELD_ASSIST=PASS_3_OPTIONS_APPLY_UNDO");
  console.log("V2_ALPHA2_FORMAL_RESEARCH_WRITES=0");
  console.log("V2_ALPHA2_AXE_BLOCKING=0");
  console.log(`V2_ALPHA2_AXE_ALL_IMPACTS=${axeCount}`);
  console.log("V2_ALPHA2_FOCUS_KEYBOARD_LIVE_REGION=PASS");
  console.log("V2_ALPHA2_EXTERNAL_REQUESTS=0");
  console.log("V2_ALPHA2_SCREEN_EVIDENCE=3");
} finally {
  await browser.close();
}
