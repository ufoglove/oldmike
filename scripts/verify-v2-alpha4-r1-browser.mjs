import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const baseUrl = process.env.V2_ALPHA4_R1_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const evidenceRoot = path.join(workspaceRoot, "OLD_MIKE_V2_ALPHA4_R1_SCREEN_EVIDENCE");
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const projectRefHash = createHash("sha256").update("fixture-workspace-v2:fixture-alpha4-r1-project").digest("hex");
const collections = ["00_待整理", "01_核心證據", "02_理論與方法", "03_目標期刊", "04_已引用", "99_排除"];
const actions = ["從 Zotero 匯入", "儲存到 Zotero", "同步此專案", "插入引用", "匯出參考文獻"];
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
await mkdir(evidenceRoot, { recursive: true });

const counters = { zoteroPosts: 0, external: 0 };
async function installBoundary(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha4-r1/zotero") counters.zoteroPosts += 1;
    return route.continue();
  });
}
async function axe(page, name) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact, targets: item.nodes.map((node) => node.target.join(" ")).slice(0, 5) })));
  assert.deepEqual(violations.filter((item) => item.impact === "critical" || item.impact === "serious"), [], `${name}_axe_${JSON.stringify(violations)}`);
  return violations.length;
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
let axeCount = 0;
try {
  const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await installBoundary(page);
  await page.goto(`${baseUrl}/v2-alpha4-r1-local`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
  const center = page.getByTestId("alpha4-r1-zotero-center");
  await expect(center).toBeVisible();
  const collection = page.getByLabel("明確選擇專案 collection");
  const format = page.getByLabel("離線匯入格式");
  assert.equal(await collection.inputValue(), "");
  assert.deepEqual(await collection.locator("option:not([value=''])").allTextContents(), collections);
  assert.deepEqual(await format.locator("option").allTextContents(), ["RIS", "BibTeX", "CSL-JSON"]);
  await expect(page.getByTestId("alpha4-r1-zotero-action")).toHaveCount(5);
  for (const label of actions) await expect(page.getByRole("button", { name: label })).toBeDisabled();

  await collection.selectOption("01_核心證據");
  await format.selectOption("RIS");
  const live = center.getByRole("status");
  for (const label of actions) {
    const button = page.getByRole("button", { name: label });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(live).toContainText(`${label}已完成`);
    if (label === "儲存到 Zotero") await expect(center.getByText(/COMPLETE · object v12/u)).toBeVisible();
    if (label === "插入引用") await expect(center.getByText("(Lin, 2025)", { exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("alpha4-r1-bibliography")).toContainText("Lin, Mei");
  assert.equal(counters.zoteroPosts, 5, "one UI request per explicit action");
  await expect(center).toHaveAttribute("data-live-api-calls", "0");
  await expect(center).toHaveAttribute("data-formal-writes", "0");

  const negative = await page.evaluate(async ({ hash }) => {
    const post = async (body) => {
      const response = await fetch("/api/v2-alpha4-r1/zotero", { method: "POST", headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": "fixture-workspace-v2" }, body: JSON.stringify(body), cache: "no-store" });
      return { status: response.status, payload: await response.json() };
    };
    const common = { projectRefHash: hash, collectionLabel: "01_核心證據", format: "CSL_JSON" };
    return {
      conflict412: await post({ ...common, requestId: "r1-browser-version-conflict", action: "SAVE", expectedVersion: 10 }),
      wrongProject: await post({ ...common, projectRefHash: "0".repeat(64), requestId: "r1-browser-wrong-project", action: "SYNC", expectedVersion: 11 }),
      idempotentFirst: await post({ ...common, requestId: "r1-browser-idempotency", action: "SYNC", expectedVersion: 11 }),
      idempotentConflict: await post({ ...common, requestId: "r1-browser-idempotency", action: "SYNC", collectionLabel: "02_理論與方法", expectedVersion: 11 }),
    };
  }, { hash: projectRefHash });
  assert.equal(negative.conflict412.status, 412);
  assert.equal(negative.conflict412.payload.overwritten, false);
  assert.equal(negative.wrongProject.status, 400);
  assert.equal(negative.wrongProject.payload.code, "zotero_contract_invalid");
  assert.equal(negative.idempotentFirst.status, 200);
  assert.equal(negative.idempotentFirst.payload.liveApiCallCount, 0);
  assert.equal(negative.idempotentConflict.status, 409);
  assert.equal(negative.idempotentConflict.payload.code, "zotero_idempotency_conflict");
  assert.equal(counters.zoteroPosts, 9);
  assert.equal(counters.external, 0);

  await collection.focus();
  await expect(collection).toBeFocused();
  axeCount += await axe(page, "desktop-1440x900");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, "desktop_overflow");
  await center.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidenceRoot, "alpha4-r1-desktop-1440x900.png"), fullPage: true });
  for (const viewport of [{ name: "mobile-390x844", width: 390, height: 844 }, { name: "mobile-360x640", width: 360, height: 640 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await center.scrollIntoViewIfNeeded();
    await collection.focus();
    await expect(collection).toBeFocused();
    axeCount += await axe(page, viewport.name);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `${viewport.name}_overflow`);
    await page.screenshot({ path: path.join(evidenceRoot, `alpha4-r1-${viewport.name}.png`), fullPage: false });
  }
  console.log("PASS V2_ALPHA4_R1_BROWSER journey=1 ui_actions=5 route_negatives=4 viewports=3 collections=6 formats=3 live_api_calls=0 formal_writes=0 external_mutations=0");
  console.log(`V2_ALPHA4_R1_AXE_ALL_IMPACTS=${axeCount}`);
  console.log("V2_ALPHA4_R1_KEYBOARD_FOCUS_LIVE_REGION=PASS");
  console.log("V2_ALPHA4_R1_SCREEN_EVIDENCE=3");
  await context.close();
} finally { await browser.close(); }
