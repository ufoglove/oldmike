import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const baseUrl = process.env.V2_ALPHA3_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const evidenceRoot = path.join(workspaceRoot, "OLD_MIKE_V2_ALPHA3_SCREEN_EVIDENCE");
const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
await mkdir(evidenceRoot, { recursive: true });

const counters = { chat: 0, literature: 0, promotion: 0, projectImport: 0, external: 0 };
function installNetworkBoundary(page) {
  return page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha3/chat") counters.chat += 1;
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha3/literature") counters.literature += 1;
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha3/promotions") counters.promotion += 1;
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha3/project-import") counters.projectImport += 1;
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
let axeCount = 0;
try {
  const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await installNetworkBoundary(page);
  await page.goto(`${baseUrl}/v2-alpha3-local`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });

  const domainSelect = page.getByLabel("本次研究重心");
  await expect(domainSelect).toBeVisible();
  await expect(domainSelect.locator("optgroup[label='內建領域'] option")).toHaveCount(6, { timeout: 12_000 });
  const builtInLabels = await domainSelect.locator("optgroup[label='內建領域'] option").allTextContents();
  assert.deepEqual(builtInLabels, ["AI跨領域應用", "AI應用於教育", "AI應用於職業安全與教育訓練", "AI應用於環境工程與環境資源管理", "AI應用於能源管理", "VR/AR/XR跨領域應用"]);

  const customTrigger = page.getByRole("button", { name: "新增研究領域", exact: true });
  await customTrigger.click();
  const customDialog = page.getByRole("dialog", { name: "新增研究領域" });
  await expect(customDialog).toBeVisible();
  await expect(customDialog.getByLabel("領域名稱（必填）")).toBeFocused();
  await customDialog.getByLabel("領域名稱（必填）").fill("AI 與高齡學習設計");
  await customDialog.getByRole("button", { name: "建立並選取" }).click();
  await expect(customDialog).toHaveCount(0);
  await expect(customTrigger).toBeFocused();
  await expect(domainSelect.locator("option:checked")).toHaveText("AI 與高齡學習設計");

  const message = page.getByLabel("研究關鍵字或問題");
  await message.fill("高齡學習者如何在證據提示下校準生成式工具的使用判斷？");
  await page.getByRole("button", { name: "送出給老麥" }).click();
  await expect(page.getByTestId("alpha3-insight-card")).toHaveCount(3, { timeout: 12_000 });
  assert.equal(counters.chat, 1);

  await page.getByRole("button", { name: "載入本機證據示範" }).click();
  await expect(page.getByText("來源覆蓋：部分")).toBeVisible();
  await expect(page.getByText("1–3 年", { exact: true })).toBeVisible();
  await expect(page.getByText("4–6 年", { exact: true })).toBeVisible();
  await expect(page.getByText("7–10 年", { exact: true })).toBeVisible();
  assert.equal(counters.literature, 1);

  const firstCard = page.getByTestId("alpha3-insight-card").first();
  await firstCard.getByRole("button", { name: "發展成三個研究方向" }).click();
  await expect(page.getByRole("heading", { name: "三個耐久研究方向" })).toBeVisible({ timeout: 12_000 });
  await expect(page.locator("#directions article")).toHaveCount(3);
  await expect(page.getByText("推薦方案 S0 已完成 13/13")).toBeVisible({ timeout: 12_000 });
  assert.equal(counters.promotion, 1);

  await firstCard.getByRole("button", { name: "匯入目前專案" }).click();
  const importDialog = page.getByRole("dialog", { name: "確認匯入目前專案？" });
  await expect(importDialog).toContainText("不建立正式研究文件");
  await importDialog.getByRole("button", { name: "確認匯入意圖" }).click();
  await expect(importDialog.getByText("已記錄意圖，正式研究寫入仍為 0。")).toBeVisible();
  assert.equal(counters.projectImport, 1);
  await importDialog.getByRole("button", { name: "關閉" }).click();

  await expect(page.getByTestId("alpha3-workspace")).toHaveAttribute("data-formal-write-count", "0");
  await page.keyboard.press("Control+L");
  await page.keyboard.press("Escape");
  await message.focus();
  await expect(message).toBeFocused();
  axeCount += await runAxe(page, "desktop-1440x900");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, "desktop_overflow");
  await page.locator("#chat [role='log']").evaluate((element) => { element.scrollTop = 0; });
  await page.locator("#chat").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidenceRoot, "alpha3-desktop-1440x900.png"), fullPage: false });

  for (const viewport of [{ name: "mobile-390x844", width: 390, height: 844 }, { name: "mobile-360x640", width: 360, height: 640 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await message.scrollIntoViewIfNeeded();
    await message.focus();
    await expect(message).toBeFocused();
    axeCount += await runAxe(page, viewport.name);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, `${viewport.name}_overflow`);
    await page.locator("#chat [role='log']").evaluate((element) => { element.scrollTop = 0; });
    await page.locator("#chat").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidenceRoot, `alpha3-${viewport.name}.png`), fullPage: false });
  }

  assert.deepEqual(counters, { chat: 1, literature: 1, promotion: 1, projectImport: 1, external: 0 });
  console.log("PASS V2_ALPHA3_BROWSER journey=1 viewports=3 exact_domains=6 insight_cards=3 alpha2_directions=3 s0=13 formal_writes=0 external=0");
  console.log(`V2_ALPHA3_AXE_ALL_IMPACTS=${axeCount}`);
  console.log("V2_ALPHA3_FOCUS_KEYBOARD_LIVE_REGION=PASS");
  console.log("V2_ALPHA3_SCREEN_EVIDENCE=3");
  await context.close();
} finally {
  await browser.close();
}
