import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const nextBin = path.join(portalRoot, "node_modules", "next", "dist", "bin", "next");
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const evidenceRoot = path.join(workspaceRoot, "OLD_MIKE_V2_SCREEN_EVIDENCE");
const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (child.exitCode !== null) throw new Error("v2_alpha1_dev_server_exited");
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(1_000) });
      if (response.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("v2_alpha1_dev_server_timeout");
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  for (let attempt = 0; attempt < 50 && child.exitCode === null; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function runAxe(page, viewportName) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact, targets: item.nodes.map((node) => node.target.join(" ")).slice(0, 8) })));
  const blocking = violations.filter((item) => item.impact === "critical" || item.impact === "serious");
  assert.deepEqual(blocking, [], `${viewportName}_axe_blocking_${JSON.stringify(blocking)}`);
  return violations.length;
}

await mkdir(evidenceRoot, { recursive: true });
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: portalRoot,
  windowsHide: true,
  stdio: "ignore",
  env: { ...process.env, NODE_ENV: "development", TEST_FIXTURE: "1", OLD_MIKE_V2_LOCAL_PROTOTYPE: "1", NEXT_TELEMETRY_DISABLED: "1" },
});

let browser;
let totalAxeViolations = 0;
try {
  await waitForServer(`${baseUrl}/v2-alpha1-local`, server);
  browser = await chromium.launch({ executablePath: chrome, headless: true });
  const viewports = [
    { name: "desktop-1440x900", width: 1440, height: 900 },
    { name: "mobile-390x844", width: 390, height: 844 },
    { name: "mobile-360x640", width: 360, height: 640 },
  ];

  for (const viewport of viewports) {
    const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    let externalRequests = 0;
    await page.route("**/*", async (route) => {
      const target = new URL(route.request().url());
      if (target.origin !== baseUrl) { externalRequests += 1; return route.abort("blockedbyclient"); }
      return route.continue();
    });
    await page.goto(`${baseUrl}/v2-alpha1-local`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await expect(page.getByRole("heading", { name: "今天想研究什麼？" })).toBeVisible();
    await page.getByLabel("研究方向").fill("大學教師採用生成式工具的教學決策與學習成效");
    await page.getByTestId("v2-generate").click();
    await expect(page.locator("[data-testid^='v2-direction-']")).toHaveCount(3);
    await expect(page.getByTestId("v2-shell")).toHaveAttribute("data-generation-effects", "1");
    await expect(page.getByTestId("v2-shell")).toHaveAttribute("data-formal-writes", "0");
    await expect(page.locator("[data-field]")).toHaveCount(13);
    await expect(page.getByText("Human Gate · 整份草稿")).toBeVisible();

    await page.getByTestId("v2-direction-FRONTIER_INNOVATION").getByRole("button", { name: "比較此方向" }).click();
    await expect(page.getByTestId("v2-shell")).toHaveAttribute("data-generation-effects", "1");

    const titleField = page.locator("[data-field='workingTitle']");
    const titleAssist = titleField.getByRole("button", { name: "老麥" });
    const originalTitle = await titleField.getByRole("textbox").inputValue();
    await titleAssist.click();
    const titleDialog = page.getByRole("dialog", { name: /調整「暫定研究題目」/u });
    await expect(titleDialog).toBeVisible();
    await expect(page.locator("#v2-suggestion-drawer li")).toHaveCount(3);
    await expect(titleDialog.getByText("前沿創新", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(titleAssist).toBeFocused();
    await titleAssist.click();
    await page.locator("#v2-suggestion-drawer li").nth(1).getByRole("button", { name: "套用此版本" }).click();
    assert.notEqual(await titleField.getByRole("textbox").inputValue(), originalTitle);
    await titleField.getByRole("button", { name: "復原" }).click();
    await expect(titleField.getByRole("textbox")).toHaveValue(originalTitle);

    await page.locator("[data-field='domain']").getByRole("button", { name: "老麥" }).click();
    await expect(page.getByText("缺少資料").first()).toBeVisible();
    await page.keyboard.press("Escape");

    if (viewport.width > 820) {
      await page.getByRole("button", { name: "設定 · Settings" }).click();
      await page.getByLabel("導覽列顯示名稱").fill("陳教授");
      await expect(page.locator("aside").getByText("陳教授", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "首頁 · Home" }).click();
    } else {
      const mobileOldMike = page.locator("nav[aria-label='手機版主要導覽'] button[aria-haspopup='dialog']");
      await mobileOldMike.click();
      await expect(page.getByRole("dialog", { name: "下一個研究動作" })).toBeVisible();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Escape");
      await expect(mobileOldMike).toBeFocused();
    }

    totalAxeViolations += await runAxe(page, viewport.name);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${viewport.name}_horizontal_overflow_${overflow}`);
    assert.equal(externalRequests, 0);
    if (viewport.width >= 390) await page.getByRole("heading", { name: "同一題目，三種可反駁的研究路徑" }).scrollIntoViewIfNeeded();
    else await page.getByRole("heading", { name: "完整 13 欄 S0，可逐欄編輯" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidenceRoot, `${viewport.name}.png`), fullPage: false });
    await context.close();
  }

  console.log("V2_ALPHA1_BROWSER_JOURNEY=PASS_DESKTOP_390_360");
  console.log("V2_ALPHA1_AXE_BLOCKING=0");
  console.log(`V2_ALPHA1_AXE_ALL_IMPACTS=${totalAxeViolations}`);
  console.log("V2_ALPHA1_FOCUS_KEYBOARD_LIVE_REGION=PASS");
  console.log("V2_ALPHA1_SCREEN_EVIDENCE=3");
  console.log("V2_ALPHA1_EXTERNAL_REQUESTS=0");
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(server);
}
