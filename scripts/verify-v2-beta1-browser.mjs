import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.V2_BETA1_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844 },
  { name: "360x640", width: 360, height: 640 },
];
const journeys = [
  { name: "KEYWORD_JOURNAL", viewport: viewports[0], entryMode: "KEYWORD", target: "SSCI", direction: "生成式回饋的證據校準與高等教育自我調節學習", expectedKind: "JOURNAL", materials: [] },
  { name: "PARTIAL_JOURNAL", viewport: viewports[1], entryMode: "PARTIAL_MATERIAL", target: "SCI", direction: "整合生成式回饋材料，檢驗證據校準與任務表現的作用機制", expectedKind: "JOURNAL", materials: [
    { kind: "ABSTRACT", title: "摘要", content: "本研究關注回饋可操作性與證據校準，不預先宣稱成效。" },
    { kind: "METHODS", title: "方法", content: "採混合方法並保留樣本、量測與分析設定待確認。" },
    { kind: "RESULTS", title: "結果", content: "目前只觀察到描述性差異，不支持因果或顯著性推論。" },
    { kind: "STATISTICS", title: "統計", content: "指標為 82%；分母、估計量與不確定性仍待核對。" },
  ] },
  { name: "KEYWORD_TAIWAN", viewport: viewports[2], entryMode: "KEYWORD", target: "MOE", direction: "XR 情境演練對職業安全教育遷移表現的影響", expectedKind: "TAIWAN_PROPOSAL", materials: [] },
];
const counters = { external: 0, unexpectedMutation: 0, journeyPosts: 0, injectedUnknownPosts: 0 };
let injectUnknown = false;

function exactKeys(value, expected, label) {
  assert.equal(Boolean(value) && typeof value === "object" && !Array.isArray(value), true, `${label}_record`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label}_exact_keys`);
}

function assertSnapshot(snapshot, expectedRevision, expectedJourneyCount) {
  exactKeys(snapshot, ["contractVersion", "projectId", "revision", "contentHash", "focusDomain", "s0Summary", "stages", "chatInsights", "timeline", "effectReceipts", "journeys", "journey", "formalResearchWriteCount", "onlineDatabaseWriteCount", "externalMutationCount", "persistenceClass"], "snapshot");
  assert.equal(snapshot.revision, expectedRevision);
  assert.equal(snapshot.timeline.length, expectedRevision - 1);
  assert.equal(snapshot.effectReceipts.length, expectedRevision - 1);
  assert.equal(snapshot.journeys.length, expectedJourneyCount);
  assert.equal(snapshot.journey?.artifactHash, snapshot.journeys.at(-1)?.artifactHash);
  assert.equal(Object.keys(snapshot.s0Summary).length, 13);
  assert.equal(Object.values(snapshot.s0Summary).every((value) => typeof value === "string" && value.trim()), true);
  assert.equal(snapshot.formalResearchWriteCount, 0);
  assert.equal(snapshot.onlineDatabaseWriteCount, 0);
  assert.equal(snapshot.externalMutationCount, 0);
}

async function installBoundary(page) {
  await page.route("**/*", async (route) => {
    const request = route.request(); const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      if (request.method() !== "POST" || target.pathname !== "/api/v2-beta1/project") { counters.unexpectedMutation += 1; return route.abort("blockedbyclient"); }
      const body = JSON.parse(request.postData() ?? "{}");
      exactKeys(body, ["contractVersion", "operation", "requestId", "idempotencyKey", "projectId", "baseRevision", "baseContentHash", "entryMode", "outputTarget", "researchDirection", "researchDomain", "materials"], "journey_request");
      assert.equal(body.contractVersion, "old-mike-v2-beta1/1.3.0"); assert.equal(body.operation, "RUN_RESEARCH_JOURNEY"); assert.match(body.baseContentHash, /^[0-9a-f]{64}$/u); assert.match(body.researchDomain.selectionHash, /^[0-9a-f]{64}$/u);
      assert.equal(request.headers()["x-old-mike-v2-workspace"], "fixture-workspace-v2");
      if (injectUnknown) {
        counters.injectedUnknownPosts += 1;
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "beta1_completion_unknown_no_resend", completionClass: "COMPLETION_UNKNOWN" }) });
      }
      counters.journeyPosts += 1;
    }
    return route.continue();
  });
}

async function runAxe(page, label) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((item) => ({ id: item.id, impact: item.impact })));
  assert.deepEqual(violations.filter((item) => item.impact === "critical" || item.impact === "serious"), [], `${label}_axe`);
  return violations.length;
}
async function assertNoOverflow(page, label) {
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  assert.equal(sizes.scrollWidth <= sizes.clientWidth + 1, true, `${label}_overflow_${JSON.stringify(sizes)}`);
}

async function fillJourney(page, journey) {
  await page.getByRole("radio", { name: journey.entryMode === "PARTIAL_MATERIAL" ? "多份既有材料" : "關鍵字或短方向" }).check();
  await page.getByTestId("beta1-output-target").selectOption(journey.target);
  await page.getByTestId("beta1-research-input").fill(journey.direction);
  if (journey.entryMode === "PARTIAL_MATERIAL") {
    const stack = page.getByTestId("beta1-materials");
    for (let index = 1; index < journey.materials.length; index += 1) await stack.getByRole("button", { name: "新增材料" }).click();
    const cards = stack.locator("fieldset");
    await expect(cards).toHaveCount(journey.materials.length);
    for (const [index, material] of journey.materials.entries()) {
      const card = cards.nth(index);
      await card.locator("select").selectOption(material.kind);
      await card.locator("input").fill(material.title);
      await card.locator("textarea").fill(material.content);
    }
  }
}

let activeStage = "BROWSER_LAUNCH";
try {
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const evidence = [];
  try {
    const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: viewports[0] });
    const page = await context.newPage(); await installBoundary(page);
    try {
      const initialGet = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v2-beta1/project");
      await page.goto(`${baseUrl}/research-os-local`, { waitUntil: "domcontentloaded" }); await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
      assert.equal((await initialGet).status(), 200); await expect(page.getByTestId("beta1-research-os")).toBeVisible(); await expect(page.locator("#beta1-nav-panel button")).toHaveCount(6);
      assert.doesNotMatch(await page.locator("body").innerText(), /OpenClaw|Codex|\bGPT\b|Zeabur|Alpha|Beta/iu);

      for (const [index, journey] of journeys.entries()) {
        activeStage = `${journey.name}_INPUT`; await page.setViewportSize({ width: journey.viewport.width, height: journey.viewport.height }); await fillJourney(page, journey);
        const postsBefore = counters.journeyPosts; const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v2-beta1/project");
        await page.getByTestId("beta1-run-journey").focus(); await page.getByTestId("beta1-run-journey").press("Enter"); const response = await responsePromise;
        activeStage = `${journey.name}_HTTP_${response.status()}`; assert.equal(response.status(), 200); const payload = await response.json(); assert.equal(payload.replayed, false); assert.equal(payload.effectSubmissionCount, 1); assert.equal(payload.liveProviderCallCount, 0);
        assertSnapshot(payload.snapshot, index + 2, index + 1); assert.equal(payload.snapshot.journey.kind, journey.expectedKind); assert.equal(payload.snapshot.journey.directions.length, 3); assert.equal(new Set(payload.snapshot.journey.directions.map((item) => item.title)).size, 3);
        const directions = payload.snapshot.journey.directions;
        for (const field of ["researchQuestion", "mechanism", "method", "contribution"]) assert.equal(new Set(directions.map((item) => item[field])).size, 3, `${journey.name}_${field}_distinct`);
        assert.equal(new Set(directions.map((item) => JSON.stringify(item.s0))).size, 3, `${journey.name}_s0_distinct`);
        assert.equal(new Set(directions.map((item) => item.selectionArtifact.wholeArtifactHash)).size, 3, `${journey.name}_whole_artifact_distinct`);
        assert.equal(new Set(directions.map((item) => item.selectionArtifact.journal?.proposedSnapshot.contentHash ?? item.selectionArtifact.taiwanProposal?.proposedSnapshot.contentHash)).size, 3, `${journey.name}_final_artifact_distinct`);
        assert.equal(directions.every((item) => Object.keys(item.s0).length === 13 && Object.values(item.fieldAssist).every((options) => options.length === 3) && item.selectionArtifact.selectedDirectionHash === item.directionHash), true);
        if (journey.materials.length) assert.deepEqual(payload.snapshot.journey.sourceMaterials.map((item) => item.content), journey.materials.map((item) => item.content));
        assert.equal(counters.journeyPosts, postsBefore + 1);

        activeStage = `${journey.name}_ARTIFACT_VISIBLE`; await expect(page.getByTestId("beta1-journey-artifact")).toBeVisible(); const selectedPanel = page.getByTestId("beta1-selected-direction"); const recommendedTitle = await selectedPanel.locator("h3").innerText(); const recommendedWholeHash = await selectedPanel.getAttribute("data-whole-artifact-hash"); const recommendedGateHash = await selectedPanel.getAttribute("data-human-gate-hash"); assert.match(recommendedWholeHash ?? "", /^[0-9a-f]{64}$/u); assert.match(recommendedGateHash ?? "", /^[0-9a-f]{64}$/u);
        activeStage = `${journey.name}_SWITCH_NONRECOMMENDED`; await page.getByTestId("beta1-direction-EVIDENCE_FIRST").click(); await expect(selectedPanel.locator("h3")).not.toHaveText(recommendedTitle); assert.notEqual(await selectedPanel.getAttribute("data-whole-artifact-hash"), recommendedWholeHash); await expect(page.getByTestId(journey.expectedKind === "JOURNAL" ? "beta1-journal-review" : "beta1-taiwan-review")).toBeVisible(); assert.equal(counters.journeyPosts, postsBefore + 1);
        activeStage = `${journey.name}_SWITCH_RESTORE`; await page.getByTestId("beta1-direction-BALANCED_RECOMMENDED").click(); await expect(selectedPanel.locator("h3")).toHaveText(recommendedTitle); assert.equal(await selectedPanel.getAttribute("data-whole-artifact-hash"), recommendedWholeHash); assert.equal(await selectedPanel.getAttribute("data-human-gate-hash"), recommendedGateHash); assert.equal(counters.journeyPosts, postsBefore + 1);
        activeStage = `${journey.name}_ASSIST_APPLY_UNDO`; await expect(page.locator('[data-testid^="beta1-assist-"]')).toHaveCount(13); const titleAssist = page.getByTestId("beta1-assist-workingTitle"); await titleAssist.locator("li").nth(1).getByRole("button", { name: "套用至預覽" }).click(); await titleAssist.getByRole("button", { name: "復原此欄" }).click();

        activeStage = `${journey.name}_WHOLE_APPLY_UNDO_GATE`; const sentinel = `原始本機草稿-${journey.name}`; const localDraft = page.getByTestId("beta1-local-draft"); const gate = page.getByTestId("beta1-confirm-gate"); await localDraft.fill(sentinel); await expect(gate).toBeDisabled(); await page.getByTestId("beta1-apply").click(); await expect(localDraft).not.toHaveValue(sentinel); await expect(gate).toBeEnabled(); await gate.click(); await expect(gate).toHaveText("已確認整份本機成果");
        await titleAssist.locator("li").nth(1).getByRole("button", { name: "套用至預覽" }).click(); await expect(gate).toBeDisabled(); await expect(gate).not.toHaveText("已確認整份本機成果"); await titleAssist.getByRole("button", { name: "復原此欄" }).click(); await expect(gate).toBeEnabled(); await expect(gate).toHaveText("確認整份成果預覽"); await gate.click(); await expect(gate).toHaveText("已確認整份本機成果");
        await page.getByTestId("beta1-undo").click(); await expect(localDraft).toHaveValue(sentinel); await expect(gate).toBeDisabled(); await expect(gate).not.toHaveText("已確認整份本機成果"); await page.getByTestId("beta1-apply").click(); await expect(gate).toBeEnabled(); await gate.click(); await expect(gate).toHaveText("已確認整份本機成果"); await expect(page.getByTestId("beta1-human-gate")).toContainText("正式研究寫入仍為 0");

        if (index === 0) {
          activeStage = "CHAT_INPUT_INFLUENCES_PREVIEW"; await page.getByTestId("beta1-chat-input").fill("不同的老麥對話內容必須進入洞見預覽"); await page.getByTestId("beta1-preview").click(); await expect(page.getByTestId("beta1-insight-preview")).toContainText("不同的老麥對話內容必須進入洞見預覽");
        }
        if (journey.viewport.width <= 390) {
          activeStage = `${journey.name}_MOBILE_FOCUS`; const dock = page.getByRole("navigation", { name: "行動版工作區切換" }); await dock.getByRole("button", { name: "老麥" }).click(); await expect(page.getByRole("complementary", { name: "老麥" })).toBeVisible(); await page.getByTestId("beta1-chat-input").focus(); await page.keyboard.press("Escape"); await expect(page.getByRole("complementary", { name: "老麥" })).toBeHidden(); await expect(dock.getByRole("button", { name: "功能" })).toBeFocused();
        }

        activeStage = `${journey.name}_OVERFLOW_AXE`; await assertNoOverflow(page, journey.viewport.name); const axeAll = await runAxe(page, journey.viewport.name); const screenshot = await page.screenshot({ fullPage: true });
        activeStage = `${journey.name}_RELOAD_GET_ONLY`; const postsBeforeReload = counters.journeyPosts; await page.reload({ waitUntil: "domcontentloaded" }); await expect(page.getByTestId("beta1-revision")).toHaveText(`版本 ${index + 2}`); await expect(page.getByTestId("beta1-journey-artifact")).toBeVisible(); assert.equal(counters.journeyPosts, postsBeforeReload);
        evidence.push({ journey: journey.name, viewport: journey.viewport.name, screenshotSha256: createHash("sha256").update(screenshot).digest("hex"), axeSeriousCritical: 0, axeAllImpacts: axeAll, horizontalOverflow: "PASS", keyboardFocus: "PASS", reloadAdditionalEffects: 0 });
      }

      activeStage = "INJECTED_UNKNOWN_NO_SECOND_POST"; injectUnknown = true; await page.getByTestId("beta1-research-input").fill("注入完成狀態不明時必須保留草稿且停止重送"); const unknownResponse = page.waitForResponse((response) => response.status() === 503 && new URL(response.url()).pathname === "/api/v2-beta1/project"); await page.getByTestId("beta1-run-journey").click(); await unknownResponse; await expect(page.getByTestId("beta1-reconcile-notice")).toBeVisible(); assert.equal(counters.injectedUnknownPosts, 1); await page.getByTestId("beta1-run-journey").click({ force: true }).catch(() => undefined); await page.waitForTimeout(100); assert.equal(counters.injectedUnknownPosts, 1); injectUnknown = false;
    } finally { await context.close(); }
  } finally { await browser.close(); }
  assert.equal(counters.external, 0); assert.equal(counters.unexpectedMutation, 0); assert.equal(counters.journeyPosts, 3); assert.equal(counters.injectedUnknownPosts, 1);
  console.log(JSON.stringify({ status: "PASS", journeys: journeys.map((item) => item.name), viewports: viewports.map((item) => item.name), evidence, oneChromiumContext: true, journeyPosts: counters.journeyPosts, injectedUnknownPosts: counters.injectedUnknownPosts, unknownSecondPosts: 0, cardSwitchAdditionalEffects: 0, reloadAdditionalEffects: 0, externalRequests: 0, unexpectedMutationRequests: 0, axeSeriousCritical: 0, formalResearchWrites: 0, onlineDatabaseWrites: 0, externalMutations: 0, screenshotsRetained: 0 }));
} catch (error) {
  console.log(JSON.stringify({ status: "BLOCKED", activeStage, reasonClass: error?.name === "TimeoutError" ? "TIMEOUT" : error?.name === "AssertionError" ? "ASSERTION" : "BROWSER_RUNTIME", subgate: /axe/iu.test(error?.message ?? "") ? "AXE" : /overflow/iu.test(error?.message ?? "") ? "OVERFLOW" : /focus/iu.test(error?.message ?? "") ? "FOCUS" : "CONTRACT" })); process.exitCode = 1;
}
