import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const baseUrl = process.env.V2_ALPHA4_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const evidenceRoot = path.join(workspaceRoot, "OLD_MIKE_V2_ALPHA4_SCREEN_EVIDENCE");
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
await mkdir(evidenceRoot, { recursive: true });

const counters = { workspacePost: 0, external: 0 };
let workspaceRequestBody = null;
async function installBoundary(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha4/workspace") {
      counters.workspacePost += 1;
      workspaceRequestBody ??= request.postData();
    }
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
  await page.goto(`${baseUrl}/v2-alpha4-local`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
  const domain = page.getByLabel("本次研究重心");
  const target = page.getByLabel("本次成果目標");
  await expect(domain).toBeVisible();
  await expect(target).toBeVisible();
  assert.equal(await domain.inputValue(), "");
  assert.equal(await target.inputValue(), "");
  assert.deepEqual(await domain.locator("option:not([value=''])").allTextContents(), ["AI跨領域應用", "AI應用於教育", "AI應用於職業安全與教育訓練", "AI應用於環境工程與環境資源管理", "AI應用於能源管理", "VR/AR/XR跨領域應用"]);
  assert.deepEqual(await target.locator("option:not([value=''])").allTextContents(), ["SCI 國際期刊（實際以 SCIE 收錄驗證）", "SSCI 國際期刊", "國科會專題研究計畫（原科技部）｜Alpha5 即將推出", "教育部教學實踐研究計畫｜Alpha5 即將推出"]);
  assert.equal(await target.locator("option[value='NSTC']").getAttribute("disabled"), "");
  assert.equal(await target.locator("option[value='MOE']").getAttribute("disabled"), "");
  await domain.selectOption({ label: "AI應用於教育" });
  await target.selectOption("SCI");
  const direction = page.getByLabel("研究關鍵字或方向");
  await direction.fill("生成式工具如何影響教師以證據修正課程決策");
  await page.getByRole("button", { name: "建立三個方向與期刊工作區" }).click();
  await expect(page.getByTestId("alpha4-direction-card")).toHaveCount(3, { timeout: 15_000 });
  await expect(page.getByTestId("alpha4-journal-card")).toHaveCount(3);
  await expect(page.getByTestId("alpha4-s0-field")).toHaveCount(13);
  await expect(page.getByTestId("alpha4-review-lens")).toHaveCount(5);
  await expect(page.getByTestId("alpha4-stage")).toHaveCount(11);
  assert.equal(counters.workspacePost, 1);
  await page.getByTestId("alpha4-direction-card").last().click();
  await expect(page.getByTestId("alpha4-journal-card")).toHaveCount(3);
  await page.getByTestId("alpha4-journal-card").nth(1).click();
  assert.equal(counters.workspacePost, 1, "local direction and journal switching causes zero second effect");
  assert.ok(workspaceRequestBody, "workspace request body retained only inside synthetic fixture");
  const tenantBoundary = await page.evaluate(async ({ body }) => {
    const response = await fetch("/api/v2-alpha4/workspace", { method: "POST", headers: { "Content-Type": "application/json", "X-Old-Mike-V2-Workspace": "another-workspace-v2" }, body });
    return { status: response.status, payload: await response.json() };
  }, { body: workspaceRequestBody });
  assert.deepEqual(tenantBoundary, { status: 404, payload: { ok: false, code: "workspace_not_found" } }, "cross-tenant authority rejected before generation");
  await expect(page.getByText("近期已發表內容的可觀察模式", { exact: true })).toBeVisible();
  await expect(page.getByText("READY FOR HUMAN SUBMISSION", { exact: true })).toBeVisible();
  await expect(page.getByText(/接受機率|acceptance probability|私下偏好/iu)).toHaveCount(0);
  const humanGate = page.getByLabel("我已檢閱稿件、引用、官方政策與聲明，理解外部提交仍停用。");
  await humanGate.check();
  await expect(page.getByRole("status")).toContainText("仍未執行外部提交");
  await expect(page.getByRole("button", { name: "外部提交（Alpha4 停用）" })).toBeDisabled();
  await expect(page.getByTestId("alpha4-workspace")).toHaveAttribute("data-formal-write-count", "0");
  await direction.focus();
  await expect(direction).toBeFocused();
  axeCount += await axe(page, "desktop-1440x900");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, "desktop_overflow");
  await page.screenshot({ path: path.join(evidenceRoot, "alpha4-desktop-1440x900.png"), fullPage: true });
  for (const viewport of [{ name: "mobile-390x844", width: 390, height: 844 }, { name: "mobile-360x640", width: 360, height: 640 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.getByTestId("alpha4-direction-card").first().scrollIntoViewIfNeeded();
    await page.getByTestId("alpha4-direction-card").first().focus();
    await expect(page.getByTestId("alpha4-direction-card").first()).toBeFocused();
    axeCount += await axe(page, viewport.name);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `${viewport.name}_overflow`);
    await page.screenshot({ path: path.join(evidenceRoot, `alpha4-${viewport.name}.png`), fullPage: false });
  }
  assert.deepEqual(counters, { workspacePost: 2, external: 0 });
  console.log("PASS V2_ALPHA4_BROWSER journey=1 tenant_negative=1 workspace_effect_posts=1 viewports=3 targets=4 directions=3 journals_per_direction=3 s0=13 review_lenses=5 stages=11 formal_writes=0 external_submissions=0");
  console.log(`V2_ALPHA4_AXE_ALL_IMPACTS=${axeCount}`);
  console.log("V2_ALPHA4_KEYBOARD_FOCUS_LIVE_REGION=PASS");
  console.log("V2_ALPHA4_SCREEN_EVIDENCE=3");
  await context.close();
} finally { await browser.close(); }
