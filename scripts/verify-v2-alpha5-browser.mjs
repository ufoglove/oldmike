import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

import { createSyntheticOfficialSourceBundle } from "../lib/v2-alpha5/official-source-bundle.ts";
import { createSyntheticAlpha5Workspace } from "../lib/v2-alpha5/runtime.ts";
import { V2_ALPHA5_CONTRACT_VERSION } from "../lib/v2-alpha5/contracts.ts";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.dirname(portalRoot);
const baseUrl = process.env.V2_ALPHA5_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const evidenceRoot = process.env.V2_ALPHA5_EVIDENCE_ROOT ? path.resolve(process.env.V2_ALPHA5_EVIDENCE_ROOT) : path.join(workspaceRoot, "OLD_MIKE_V2_ALPHA5_SCREEN_EVIDENCE");
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
await mkdir(evidenceRoot, { recursive: true });

const counters = { workspacePost: 0, external: 0, formalWrites: 0 };
let requestSequence = 0;
async function installBoundary(page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (request.method() === "POST" && target.pathname === "/api/v2-alpha5/workspace") {
      counters.workspacePost += 1;
      const body = JSON.parse(request.postData() ?? "{}");
      assert.deepEqual(Object.keys(body).sort(), ["domainSelection", "requestId", "researchDirection", "targetId"]);
      if (String(body.researchDirection).includes("故障保留")) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "fixture_pre_submission_failure" }) });
      const sourceBundle = createSyntheticOfficialSourceBundle({ targetId: body.targetId, cycleYear: 2026, domainSelection: body.domainSelection, variant: "MIXED_FRESHNESS" });
      const workspace = createSyntheticAlpha5Workspace({ contractVersion: V2_ALPHA5_CONTRACT_VERSION, requestId: body.requestId, domainSelection: body.domainSelection, targetId: body.targetId, researchDirection: body.researchDirection, sourceBundle });
      requestSequence += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, workspace, replayed: false, providerSubmissionCount: 1, fixtureSequence: requestSequence, formalResearchWriteCount: 0 }) });
    }
    return route.continue();
  });
}
async function axe(page, name) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact })));
  assert.deepEqual(violations.filter((item) => item.impact === "critical" || item.impact === "serious"), [], `${name}_axe_${JSON.stringify(violations)}`);
  return violations.length;
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const viewports = [{ name: "desktop-1440x900", width: 1440, height: 900 }, { name: "mobile-390x844", width: 390, height: 844 }, { name: "mobile-360x640", width: 360, height: 640 }];
const evidence = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    await installBoundary(page);
    await page.goto(`${baseUrl}/v2-alpha5-local`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
    await expect(page.locator("[data-testid='alpha5-workspace']")).toBeVisible();
    const domain = page.getByLabel("本次研究重心");
    const target = page.getByLabel("本次成果目標");
    assert.equal(await domain.inputValue(), ""); assert.equal(await target.inputValue(), "");
    assert.deepEqual((await domain.locator("option:not([value=''])").allTextContents()).slice(0, 6), ["AI跨領域應用", "AI應用於教育", "AI應用於職業安全與教育訓練", "AI應用於環境工程與環境資源管理", "AI應用於能源管理", "VR/AR/XR跨領域應用"]);
    assert.deepEqual(await target.locator("option:not([value=''])").allTextContents(), ["國科會專題研究計畫（原科技部）", "教育部教學實踐研究計畫"]);
    await domain.selectOption("ai-education");
    await target.selectOption(viewport.name === "mobile-360x640" ? "MOE" : "NSTC");
    await page.getByLabel("關鍵字或簡短研究方向").fill("以情境式學習改善職業安全風險辨識");
    const before = counters.workspacePost;
    await page.getByTestId("alpha5-generate").click();
    await expect(page.getByRole("heading", { name: "三個可比較的研究方向" })).toBeFocused();
    await expect(page.locator("[data-testid^='alpha5-card-']")).toHaveCount(3);
    await expect(page.getByTestId("alpha5-card-direction-2")).toHaveAttribute("aria-pressed", "true");
    assert.equal(counters.workspacePost - before, 1, `${viewport.name} one generation POST`);
    await page.getByTestId("alpha5-card-direction-3").click();
    await expect(page.getByTestId("alpha5-card-direction-3")).toHaveAttribute("aria-pressed", "true");
    assert.equal(counters.workspacePost - before, 1, `${viewport.name} card switch local-only`);
    await expect(page.getByRole("heading", { name: "完整申請草案" })).toBeVisible();
    await expect(page.getByText("算術一致")).toBeVisible();
    await expect(page.getByText("Zotero 僅支援背景、缺口、方法、討論與引用；不作官方規則或預算權威。")).toBeVisible();
    const gate = page.getByLabel("我已檢視方向、官方來源缺口、預算與證據邊界。");
    await gate.check();
    await page.getByRole("button", { name: "確認全件預覽" }).click();
    await expect(page.getByRole("status")).toContainText("正式寫入仍為零");
    await page.keyboard.press("Shift+Tab");
    assert.ok(await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement !== document.body), `${viewport.name} keyboard focus retained`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, `${viewport.name} no horizontal overflow`);
    const axeCount = await axe(page, viewport.name);
    const screenshot = path.join(evidenceRoot, `${viewport.name}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    evidence.push({ viewport: viewport.name, axeViolations: axeCount, screenshot: path.basename(screenshot) });
    if (viewport.name === "desktop-1440x900") {
      const titleBefore = await page.locator("article").filter({ hasText: "暫定題目" }).getByRole("heading").textContent();
      await page.getByLabel("關鍵字或簡短研究方向").fill("故障保留");
      await page.getByTestId("alpha5-generate").click();
      await expect(page.getByText("草案暫時無法完成。你目前的研究方向已保留，請稍後由你主動再試一次。")).toBeVisible();
      assert.equal(await page.locator("article").filter({ hasText: "暫定題目" }).getByRole("heading").textContent(), titleBefore, "failure preserves prior draft");
    }
    await context.close();
  }
} finally { await browser.close(); }

assert.equal(counters.external, 0);
assert.equal(counters.formalWrites, 0);
console.log(JSON.stringify({ status: "PASS", acceptanceGroup: 8, journeys: 3, evidence, workspacePosts: counters.workspacePost, externalCalls: 0, formalResearchWrites: 0, providerIdentityVisible: false }));
