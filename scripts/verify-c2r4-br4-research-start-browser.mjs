import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = path.join(portalRoot, ".next", "standalone", "server.js");
const executablePath = process.env.C2R4_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
if (!existsSync(serverEntry) || !existsSync(executablePath)) throw new Error("br4_local_browser_tool_or_production_build_missing");

const direction = "探討高風險產業新進人員的安全訓練移轉與現場危害判斷";
const lanes = ["CURRENT_PRACTICE_VALUE", "EMERGING_FRONTIER", "HIGH_VALUE_GAP_OR_CONTRARIAN"];
const titles = [
  "情境判斷回饋如何提升高風險產業新進人員的安全訓練移轉",
  "適性化危害情境提示對新進人員現場判斷校準的作用機制",
  "訓練高分是否掩蓋高風險新進人員的現場危害誤判",
];
const questions = [
  "情境判斷回饋如何影響新進人員由職前訓練到現場的危害辨識移轉？",
  "適性提示能否改善新進人員對低頻高風險情境的判斷校準？",
  "訓練測驗高分是否可能與現場危害誤判並存？",
];
const methods = ["混合方法序列設計", "準實驗搭配歷程紀錄", "配對測量與邊界分析"];

function card(index) {
  return {
    lane: lanes[index],
    workingTitle: titles[index],
    researchQuestion: questions[index],
    researchValue: `方案 ${index + 1} 建立可反駁且待驗證的研究價值。`,
    mechanismTheory: ["回饋素養與訓練移轉", "認知負荷與判斷校準", "近遷移與遠遷移落差"][index],
    targetContext: "高風險產業新進人員於職前與現場銜接訓練",
    methodSketch: methods[index],
    feasibilityRisk: "資料權限、樣本與倫理條件仍待研究者確認。",
    domain: "AI × 職業安全與教育訓練",
    outputTrack: "NSTC",
    unknowns: ["可用樣本規模"],
    nextAction: "確認場域、構念與資料權限。",
    cardId: `direction_${lanes[index].toLowerCase()}_${String(index + 1).repeat(16)}`,
    cardHash: String(index + 1).repeat(64),
  };
}

const cards = lanes.map((_, index) => card(index));
const directionSet = {
  contractVersion: "research-start-two-stage/1.0.0",
  rootIntentHash: "a".repeat(64),
  researchDirectionProvenance: { value: direction, status: "USER_PROVIDED" },
  recommendedCardId: cards[0].cardId,
  recommendationRationale: "現行流程已有可觀察資料，最適合先建立可審查的研究起點。",
  cards,
};
const s0Draft = {
  workingTitle: cards[0].workingTitle,
  domain: cards[0].domain,
  outputTrack: cards[0].outputTrack,
  problemContext: `${direction}。本研究聚焦職前與現場銜接時的情境判斷回饋；場域事實仍待確認。`,
  targetUsers: cards[0].targetContext,
  expectedContribution: "建立情境判斷回饋與訓練移轉之間可檢驗的分析架構。",
  existingData: "目前僅確認可能存在訓練紀錄，實際欄位仍待盤點。",
  availableData: "可規劃情境判斷測驗與訪談資料，權限仍待確認。",
  methodIdea: cards[0].methodSketch,
  timeline: "建議十二個月，實際期程仍待確認。",
  constraints: "樣本、場域與主管評分偏差仍需控制。",
  ethicsPrivacyRisks: "需完成知情同意、去識別化與職場權力關係審查。",
  unresolvedItems: "樣本規模、資料欄位與場域權限仍待確認。",
};

async function freePort() {
  const server = net.createServer(); server.unref();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); assert(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error("br4_fixture_server_exited");
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1_000) }); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("br4_fixture_server_timeout");
}

async function stopChild(child) {
  const alive = () => { try { process.kill(child.pid, 0); return true; } catch { return false; } };
  if (!alive()) return;
  child.kill("SIGTERM");
  for (let attempt = 0; attempt < 50 && alive(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (alive()) child.kill("SIGKILL");
  for (let attempt = 0; attempt < 50 && alive(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (alive()) throw new Error("br4_fixture_server_cleanup_unknown");
}

function installNetworkGuard(page, baseUrl, counters, options = {}) {
  return page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (target.pathname === "/api/assist/topic-lab" && request.method() === "POST") {
      const body = request.postDataJSON();
      assert.equal(body.contractVersion, "research-start-two-stage/1.0.0");
      assert.equal(body.researchDirection, direction);
      assert.equal(body.sourceStrategy, "NONE");
      assert.deepEqual(Object.keys(body.advanced).sort(), ["context", "data", "domain", "ethics", "method", "outputTrack", "population", "timeline"]);
      if (body.operation === "GENERATE_DIRECTIONS") {
        counters.stageA += 1;
        assert.match(body.idempotencyKey, new RegExp(`^${body.rootIntentId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}:stage-a:`, "u"));
        await new Promise((resolve) => setTimeout(resolve, 100));
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, persistence: "NONE", stage: "STAGE_A", state: "DIRECTIONS_READY", rootIntentHash: directionSet.rootIntentHash, directionSet, providerSubmissionCount: 1, formalResearchWrites: 0, liveScholarlyEgress: 0 }) });
      }
      if (body.operation === "EXPAND_SELECTED_S0") {
        counters.stageB += 1;
        assert.equal(body.rootIntentHash, directionSet.rootIntentHash);
        assert.equal(body.selectedCard.cardId, cards[0].cardId);
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (options.failStageB) return route.fulfill({ status: 504, contentType: "application/json", body: JSON.stringify({ ok: false, error: "老麥未在本次時限內完成；三個方向與原始輸入已保留。", stage: "HTTP_ACK", completionClass: "COMPLETION_UNKNOWN", recoverableFields: ["researchDirection"], providerSubmissionCount: 1 }) });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, persistence: "NONE", stage: "STAGE_B", state: "READY_FOR_HUMAN_REVIEW", rootIntentHash: directionSet.rootIntentHash, selectedCardId: cards[0].cardId, s0Draft, s0Hash: "b".repeat(64), providerSubmissionCount: 1, formalResearchWrites: 0, liveScholarlyEgress: 0 }) });
      }
      throw new Error("unexpected_research_start_operation");
    }
    if (target.pathname === "/api/projects/preview" && request.method() === "POST") {
      counters.preview += 1;
      const body = request.postDataJSON();
      assert.equal(body.intake.problemContext.split(direction).length - 1, 1);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, preview: { projectId: "fixture-preview-project", previewHash: "c".repeat(64), workingTitle: body.intake.workingTitle, domain: body.intake.domain, outputTrack: body.intake.outputTrack, known: ["方向已保留"], unknown: ["資料權限待確認"], assumptions: ["場域可招募"], risks: ["倫理審查未完成"] } }) });
    }
    if (target.pathname === "/api/projects" && request.method() === "POST") { counters.formalCreate += 1; return route.abort("blockedbyclient"); }
    return route.continue();
  });
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [serverEntry], { cwd: path.dirname(serverEntry), windowsHide: true, stdio: "ignore", env: { ...process.env, TEST_FIXTURE: "1", C2_OVERLAY_FIXTURE: "1", C2R4_RESEARCH_START_FIXTURE: "1", NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: "127.0.0.1", PORT: String(port) } });
let browser;
try {
  await waitForServer(`${baseUrl}/c2r4-research-start-fixture`, server);
  browser = await chromium.launch({ executablePath, headless: true });
  for (const viewport of [{ width: 1440, height: 900, name: "desktop" }, { width: 390, height: 844, name: "mobile-390" }, { width: 360, height: 640, name: "mobile-360" }]) {
    const context = await browser.newContext({ locale: "zh-TW", viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    const counters = { stageA: 0, stageB: 0, preview: 0, formalCreate: 0, external: 0 };
    await installNetworkGuard(page, baseUrl, counters);
    await page.goto(`${baseUrl}/c2r4-research-start-fixture`, { waitUntil: "domcontentloaded" });
    if (viewport.width <= 820) { await page.getByRole("button", { name: "開啟選單" }).click(); await page.getByTestId("nav-quick-start").click(); }
    else await page.getByTestId("nav-quick-start").click();
    await page.getByLabel("研究方向").fill(direction);
    await page.getByTestId("research-start-submit").click();

    await expect(page.getByTestId("br4-direction-CURRENT_PRACTICE_VALUE")).toBeVisible();
    await expect(page.getByTestId("research-start-state")).toHaveAttribute("data-state", "STEP_2_COMPLETING_SELECTED_S0");
    assert.equal(counters.stageA, 1);
    assert.equal(counters.stageB, 1);
    for (const lane of lanes) await expect(page.getByTestId(`br4-direction-${lane}`)).toBeVisible();
    await expect(page.getByTestId("research-start-state")).toHaveAttribute("data-state", "READY_FOR_HUMAN_REVIEW");
    await expect(page.getByLabel(/暫定研究題目/).first()).toHaveValue(titles[0]);
    assert.equal((await page.getByLabel(/問題背景/).first().inputValue()).split(direction).length - 1, 1);

    await page.getByTestId("br4-direction-EMERGING_FRONTIER").getByRole("button", { name: "比較此方向" }).click();
    await expect(page.getByTestId("br4-expand-selected")).toBeVisible();
    assert.deepEqual(counters, { stageA: 1, stageB: 1, preview: 0, formalCreate: 0, external: 0 });
    await page.getByTestId("br4-direction-CURRENT_PRACTICE_VALUE").getByRole("button", { name: "比較此方向" }).click();
    await page.getByTestId("br4-preview-selected").click();
    await page.getByTestId("s0-preview").click();
    await expect(page.getByLabel(/我已閱讀上述預覽/)).not.toBeChecked();
    await expect(page.getByTestId("project-confirm")).toBeDisabled();
    await expect(page.getByTestId("research-start-state")).toHaveAttribute("role", "status");
    assert.equal(await page.getByTestId("research-start-state").getAttribute("aria-live"), "polite");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${viewport.name}_horizontal_overflow_${overflow}`);
    assert.deepEqual(counters, { stageA: 1, stageB: 1, preview: 1, formalCreate: 0, external: 0 });
    await context.close();
  }
  {
    const context = await browser.newContext({ locale: "zh-TW", viewport: { width: 1440, height: 900 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const counters = { stageA: 0, stageB: 0, preview: 0, formalCreate: 0, external: 0 };
    await installNetworkGuard(page, baseUrl, counters, { failStageB: true });
    await page.goto(`${baseUrl}/c2r4-research-start-fixture`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("nav-quick-start").click();
    await page.getByLabel("研究方向").fill(direction);
    await page.getByTestId("research-start-submit").click();
    await expect(page.getByTestId("research-start-state")).toHaveAttribute("data-state", "DIRECTIONS_READY");
    await expect(page.getByTestId("br4-direction-CURRENT_PRACTICE_VALUE")).toBeVisible();
    await expect(page.getByLabel("研究方向")).toHaveValue(direction);
    await expect(page.getByText("老麥未在本次時限內完成；三個方向與原始輸入已保留。").first()).toBeVisible();
    assert.deepEqual(counters, { stageA: 1, stageB: 1, preview: 0, formalCreate: 0, external: 0 });
    await context.close();
  }
  console.log("C2R4_BR4_BROWSER_FLOW=PASS_DESKTOP_390_360");
  console.log("C2R4_BR4_ONE_CLICK_TWO_EFFECTS=PASS");
  console.log("C2R4_BR4_LOCAL_SWITCH_PROVIDER_CALLS=0");
  console.log("C2R4_BR4_HUMAN_GATE_FORMAL_WRITES=0");
  console.log("C2R4_BR4_STAGE_B_UNKNOWN_PRESERVATION=PASS");
  console.log("C2R4_BR4_EXTERNAL_NETWORK_REQUESTS=0");
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(server);
}
