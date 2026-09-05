import assert from "node:assert/strict";
import axe from "axe-core";
import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.M02_E2E_BASE_URL;
const email = process.env.M02_E2E_EMAIL;
const password = process.env.M02_E2E_PASSWORD;
const executablePath = process.env.M02_E2E_CHROME;
if (!baseUrl || !email || !password || !executablePath) process.exit(2);
const forbidden = ["OpenClaw", "Codex", "OpenAI", "ChatGPT", "Anthropic", "Claude", "Gemini", "Better Auth"];

async function branding(page) {
  const text = await page.locator("html").innerText();
  for (const value of forbidden) assert.equal(text.includes(value), false, `public branding leaked: ${value}`);
}
async function axeGate(page, selector) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async (value) => globalThis.axe.run(value, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }), selector);
  assert.deepEqual(result.violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) })), []);
}

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext({ locale: "zh-TW", viewport: { width: 1440, height: 1100 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("密碼", { exact: true }).fill(password);
  const login = page.waitForResponse((response) => response.url().includes("/api/auth/sign-in/email"));
  await page.getByRole("button", { name: "登入研究工作台" }).click();
  assert.equal((await login).status(), 200);
  await page.waitForURL(`${baseUrl}/`); await page.waitForLoadState("networkidle");
  await expect(page.locator(".breadcrumb")).toContainText("m02-browser-project");
  await page.getByTestId("nav-academic-language").click();
  const studio = page.locator(".m02-studio");
  await expect(studio.getByRole("heading", { name: "專業翻譯與學術潤稿" })).toBeVisible();
  await branding(page); await axeGate(page, ".m02-studio");

  await studio.getByLabel("固定翻譯", { exact: false }).fill("教學實踐研究 => Teaching Practice Research");
  await studio.getByLabel("禁用詞與替代詞", { exact: false }).fill("prove => suggest");
  const glossaryResponse = page.waitForResponse((response) => response.url().includes("/academic-language") && response.request().method() === "POST");
  await studio.getByRole("button", { name: "新增術語庫版本" }).click();
  assert.equal((await glossaryResponse).status(), 201);
  await expect(studio.getByText("術語庫已新增為 append-only 版本", { exact: false })).toBeVisible();

  await studio.getByRole("textbox", { name: "原文", exact: true }).fill("教學實踐研究納入 42 participants [1]，劑量為 5 mg。$x=1$");
  const transformResponse = page.waitForResponse((response) => response.url().includes("/academic-language") && response.request().method() === "POST");
  await studio.getByRole("button", { name: "建立 append-only 草稿" }).click();
  assert.equal((await transformResponse).status(), 201);
  await expect(studio.getByText("Teaching Practice Research included 42 participants [1] at a dose of 5 mg. $x=1$", { exact: true })).toBeVisible();
  await expect(studio.getByRole("heading", { name: "逐項修改理由" })).toBeVisible();
  await expect(studio.getByText("待人工核准")).toBeVisible();
  await branding(page); await axeGate(page, ".m02-studio");

  await studio.getByLabel("核准理由").fill("已人工逐段核對內容、術語、數字、引文與單位。");
  await studio.getByLabel("我已逐段核對內容、術語、數字、引文、單位與研究主張。").check();
  const approvalResponse = page.waitForResponse((response) => response.url().includes("/academic-language") && response.request().method() === "POST");
  await studio.getByRole("button", { name: "核准此固定版本" }).click();
  assert.equal((await approvalResponse).status(), 201);
  await expect(studio.getByText("已人工核准")).toBeVisible();
  const promotionResponse = page.waitForResponse((response) => response.url().includes("/academic-language") && response.request().method() === "POST");
  await studio.getByRole("button", { name: "新增至正式文件（不覆寫）" }).click();
  assert.equal((await promotionResponse).status(), 201);
  await expect(studio.getByText("已依核准雜湊新增正式文件草稿版本", { exact: false })).toBeVisible();
  await axeGate(page, ".m02-studio");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(studio).toBeVisible();
  assert.equal(await studio.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement !== document.body), true);
  await axeGate(page, ".m02-studio");
  await context.close();
} finally { await browser.close(); }

console.log("M02_BROWSER_E2E=PASS");
console.log("M02_ACCESSIBILITY_AXE=PASS");
console.log("M02_DESKTOP_MOBILE=PASS");
console.log("M02_HUMAN_GATE_BROWSER=PASS");
console.log("M02_PUBLIC_BRANDING_BROWSER=PASS");
