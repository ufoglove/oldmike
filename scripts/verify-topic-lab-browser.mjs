import assert from "node:assert/strict";
import axe from "axe-core";
import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.TOPIC_LAB_E2E_BASE_URL;
const email = process.env.TOPIC_LAB_E2E_EMAIL;
const password = process.env.TOPIC_LAB_E2E_PASSWORD;
const executablePath = process.env.TOPIC_LAB_E2E_CHROME;
if (!baseUrl || !email || !password || !executablePath) process.exit(2);
const parsed = new URL(baseUrl);
assert.equal(parsed.protocol, "https:");
assert.equal(parsed.hostname, "localhost");

const forbidden = ["OpenClaw", "Codex", "OpenAI", "ChatGPT", "Anthropic", "Claude", "Gemini", "Better Auth"];
async function branding(page) {
  const text = await page.locator("html").innerText();
  for (const value of forbidden) assert.equal(text.includes(value), false, `public branding leaked: ${value}`);
}
async function axeGate(page, include) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async (selector) => globalThis.axe.run(selector || document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
  }), include);
  assert.deepEqual(result.violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) })), []);
}

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const context = await browser.newContext({ locale: "zh-TW", viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "老麥科研工作台" })).toBeVisible();
  await branding(page);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("密碼", { exact: true }).fill(password);
  const loginResponse = page.waitForResponse((response) => response.url().includes("/api/auth/sign-in/email"));
  await page.getByRole("button", { name: "登入研究工作台" }).click();
  assert.equal((await loginResponse).status(), 200);
  await page.waitForURL(`${baseUrl}/`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("sidebar-display-name")).toHaveText("Topic Lab Fixture");
  const projectProbe = await page.evaluate(async () => {
    const response = await fetch("/api/projects", { cache: "no-store" });
    const payload = await response.json();
    return { status: response.status, code: payload.code || "", ids: Array.isArray(payload.projects) ? payload.projects.map((item) => item.projectId) : [] };
  });
  assert.deepEqual(projectProbe, { status: 200, code: "", ids: ["topic-lab-browser-project"] });
  await expect(page.locator(".breadcrumb")).toContainText("topic-lab-browser-project", { timeout: 15_000 });
  await page.getByTestId("nav-topic-lab").click();
  const lab = page.getByTestId("topic-lab-frontier-radar");
  await expect(lab).toBeVisible();
  await expect(lab.getByRole("heading", { name: "選題實驗室／前沿雷達" })).toBeVisible();
  await expect(lab).toContainText("來源一律維持 UNVERIFIED");
  await branding(page);
  await axeGate(page, "[data-testid='topic-lab-frontier-radar']");

  await lab.getByLabel("專業領域*").fill("教育心理與高等教育");
  await lab.getByLabel("研究族群*").fill("大學一年級學生");
  await lab.getByLabel("研究情境*").fill("校園學習支持與自我調節學習");
  await lab.getByLabel("方法偏好*").fill("縱貫研究、混合方法");
  await lab.getByLabel("時間限制*").fill("十二個月");
  await lab.getByLabel("資料限制*").fill("匿名問卷與既有課程紀錄");
  await lab.getByLabel("倫理與授權限制*").fill("完成倫理審查與資料授權後才可使用");
  const analyzeResponse = page.waitForResponse((response) => response.url().includes("/api/projects/topic-lab-browser-project/topic-lab") && response.request().method() === "POST");
  await lab.getByRole("button", { name: "建立選題與前沿雷達版本" }).click();
  assert.equal((await analyzeResponse).status(), 201);
  await expect(lab.getByRole("heading", { name: "快速靈感" })).toBeVisible();
  await expect(lab.getByText("INSUFFICIENT_EVIDENCE｜證據不足")).toBeVisible();
  await expect(lab.locator("[data-testid='topic-candidate-INSUFFICIENT_EVIDENCE']")).toHaveCount(3);
  await expect(lab.getByText("沒有來源觀測；所有趨勢數值保持不可用。")).toBeVisible();
  await expect(lab.getByText("來源 0 · 跨來源 0", { exact: false }).first()).toBeVisible();
  await expect(lab.getByText("不可用", { exact: true }).first()).toBeVisible();
  await branding(page);
  await axeGate(page, "[data-testid='topic-lab-frontier-radar']");

  const firstCandidate = lab.locator("[data-testid='topic-candidate-INSUFFICIENT_EVIDENCE']").first();
  await firstCandidate.getByRole("button", { name: "選擇此題並進入 Human Gate" }).click();
  await lab.getByLabel("核准理由").fill("已人工核對研究問題、來源狀態、不確定性與倫理限制。");
  await lab.getByLabel("我已核對此候選的內容、來源狀態與不確定性，理解 Human Gate 綁定此 candidate hash，內容變更即失效。").check();
  const gateResponse = page.waitForResponse((response) => response.url().includes("/api/projects/topic-lab-browser-project/topic-lab") && response.request().method() === "POST");
  await lab.getByRole("button", { name: "核准精確候選版本" }).click();
  assert.equal((await gateResponse).status(), 201);
  await expect(lab.getByRole("button", { name: "Human Gate 已建立" })).toBeVisible();
  const promotionResponse = page.waitForResponse((response) => response.url().includes("/api/projects/topic-lab-browser-project/topic-lab") && response.request().method() === "POST");
  await lab.getByRole("button", { name: "建立 S1 設計草稿" }).click();
  assert.equal((await promotionResponse).status(), 201);
  await expect(lab.getByText("已建立 S1 設計草稿版本", { exact: false })).toBeVisible();
  await axeGate(page, "[data-testid='topic-lab-frontier-radar']");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(lab).toBeVisible();
  assert.equal((await lab.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)), true, "feature must not overflow mobile viewport");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement !== document.body), true);
  await axeGate(page, "[data-testid='topic-lab-frontier-radar']");
  await context.close();
} finally {
  await browser.close();
}

console.log("TOPIC_LAB_BROWSER_E2E=PASS");
console.log("TOPIC_LAB_ACCESSIBILITY_AXE=PASS");
console.log("TOPIC_LAB_DESKTOP_MOBILE=PASS");
console.log("TOPIC_LAB_HUMAN_GATE_BROWSER=PASS");
console.log("TOPIC_LAB_PUBLIC_BRANDING_BROWSER=PASS");
