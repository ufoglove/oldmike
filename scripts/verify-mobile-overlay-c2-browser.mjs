import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axe from "axe-core";
import { chromium, expect } from "@playwright/test";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = path.join(portalRoot, ".next", "standalone", "server.js");
const executablePath = process.env.C2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
if (!existsSync(serverEntry) || !existsSync(executablePath)) throw new Error("c2_local_browser_tool_or_production_build_missing");

async function freePort() {
  const server = net.createServer();
  server.unref();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  assert(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error("c2_fixture_server_exited");
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1_000) }); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("c2_fixture_server_timeout");
}

async function stopChild(child) {
  const alive = () => { try { process.kill(child.pid, 0); return true; } catch { return false; } };
  if (!alive()) return;
  child.kill("SIGTERM");
  for (let attempt = 0; attempt < 50 && alive(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (alive()) child.kill("SIGKILL");
  for (let attempt = 0; attempt < 50 && alive(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (alive()) throw new Error("c2_fixture_server_cleanup_unknown");
}

async function axeGate(page, selector) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async (target) => {
    const result = await globalThis.axe.run(target, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return result.violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) }));
  }, selector);
  assert.deepEqual(violations, []);
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [serverEntry], {
  cwd: path.dirname(serverEntry),
  windowsHide: true,
  stdio: "ignore",
  env: { ...process.env, TEST_FIXTURE: "1", C2_OVERLAY_FIXTURE: "1", NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: "127.0.0.1", PORT: String(port) },
});

let browser;
try {
  await waitForServer(`${baseUrl}/c2-overlay-fixture`, server);
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ locale: "zh-TW", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const target = new URL(route.request().url());
    if (target.hostname === "127.0.0.1") return route.continue();
    return route.abort("blockedbyclient");
  });
  await page.goto(`${baseUrl}/c2-overlay-fixture`, { waitUntil: "domcontentloaded" });

  const navTrigger = page.getByRole("button", { name: "開啟選單" });
  await navTrigger.click();
  await expect(navTrigger).toHaveAttribute("aria-expanded", "true");
  const nav = page.locator("#mobile-navigation-overlay");
  await expect(nav).toHaveAttribute("role", "dialog");
  const navBox = await nav.boundingBox();
  assert(navBox && navBox.y >= -1 && navBox.height <= 845, "390x844 sidebar must remain inside the dynamic viewport");
  await expect(nav.locator(".sidebar-foot")).toBeVisible();
  assert.equal(await page.locator("main.workspace").evaluate((element) => element.inert), true);
  assert.equal(await page.locator(".account-toolbar").evaluate((element) => element.inert), true);
  assert.equal(await page.locator(".app-shell").getAttribute("data-active-overlay"), "MOBILE_NAV");
  await nav.getByRole("button", { name: "關閉選單" }).click();
  await expect(navTrigger).toBeFocused();

  await page.setViewportSize({ width: 360, height: 640 });
  const chatTrigger = page.getByRole("button", { name: "開啟老麥專案對話" });
  await chatTrigger.click();
  const chat = page.locator("#project-chat-overlay");
  const chatBox = await chat.boundingBox();
  assert(chatBox && Math.abs(chatBox.x) <= 1 && Math.abs(chatBox.y) <= 1 && Math.abs(chatBox.width - 360) <= 1 && Math.abs(chatBox.height - 640) <= 1, "360x640 chat must be full-screen");
  await expect(chat.getByRole("button", { name: "關閉對話" })).toBeFocused();
  assert.equal(await page.locator(".app-shell").getAttribute("data-active-overlay"), "CHAT");
  assert.equal(await page.getByRole("dialog").count(), 1);
  assert.equal(await chat.locator(".v13-chat-body").evaluate((element) => getComputedStyle(element).overflowY), "auto");
  const composeBox = await chat.locator(".v13-chat-compose").boundingBox();
  assert(composeBox && composeBox.y + composeBox.height <= 641, "composer must remain above the account toolbar and viewport edge");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await chat.evaluate((element) => element.contains(document.activeElement)), true);
  await axeGate(page, "#project-chat-overlay");

  await page.setViewportSize({ width: 360, height: 420 });
  const keyboardComposeBox = await chat.locator(".v13-chat-compose").boundingBox();
  assert(keyboardComposeBox && keyboardComposeBox.y + keyboardComposeBox.height <= 421, "keyboard-sized viewport must retain the composer");
  await page.keyboard.press("Escape");
  await expect(chatTrigger).toBeFocused();
  await expect(chat).toHaveCount(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  await chatTrigger.click();
  const desktopBox = await page.locator("#project-chat-overlay").boundingBox();
  assert(desktopBox && desktopBox.width <= 410 && desktopBox.x > 900 && desktopBox.height < 900, "1440x900 must preserve the desktop floating chat");
  await axeGate(page, "#project-chat-overlay");
  await page.keyboard.press("Escape");
  await context.close();

  console.log("MOBILE_OVERLAY_C2_BROWSER=PASS");
  console.log("MOBILE_SIDEBAR_390X844=PASS");
  console.log("MOBILE_CHAT_360X640_KEYBOARD=PASS");
  console.log("OVERLAY_FOCUS_ESCAPE_RETURN_INERT_AXE=PASS");
  console.log("DESKTOP_FLOATING_CHAT_1440X900=PASS");
  console.log("VISUAL_VIEWPORT_FALLBACK=NOT_REQUIRED_DVH_PASS");
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(server);
}
