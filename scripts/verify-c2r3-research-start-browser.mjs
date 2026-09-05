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
const executablePath = process.env.C2R3_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
if (!existsSync(serverEntry) || !existsSync(executablePath)) throw new Error("c2r3_local_browser_tool_or_production_build_missing");

const S0_FIELDS = ["workingTitle", "domain", "outputTrack", "problemContext", "targetUsers", "expectedContribution", "existingData", "availableData", "methodIdea", "timeline", "constraints", "ethicsPrivacyRisks", "unresolvedItems"];
const fixtureQuestion = "在教學現場中，如何以可追溯方法改善學習支持？";

function topicCandidate(index, requestedGroup) {
  return {
    candidateId: `topic_fixture_candidate_${index}`,
    requestedGroup,
    classification: "INSUFFICIENT_EVIDENCE",
    researchQuestion: index === 1 ? fixtureQuestion : `待查證的研究候選方向 ${index}`,
    hypothesisCandidate: "候選假設仍待研究者與正式來源驗證。",
    novelty: "新穎性尚未驗證；不得視為既定事實。",
    feasibility: "先確認場域、樣本與可用資料。",
    dataMethods: ["混合方法", "去識別化資料"],
    risks: ["倫理與資料授權仍待確認"],
    nextStep: "由研究者補齊限制並核對來源。",
    professionalAdvice: "先把問題拆成可觀察機制與結果。",
    evidenceDate: "2026-08-23",
    evidenceWindow: "2023-08-23/2026-08-23",
    sourceCount: 0,
    sourceDiversity: 0,
    scoringMethod: "NO_EXTERNAL_SOURCE",
    uncertainty: "沒有外部來源觀測，僅供研究者整理方向。",
    signals: Object.fromEntries(["recency", "momentum", "evidenceVolume", "sourceDiversity", "noveltyProxy", "feasibility", "saturationRisk"].map((key) => [key, { value: key === "evidenceVolume" || key === "sourceDiversity" ? 0 : null, basis: key === "evidenceVolume" || key === "sourceDiversity" ? "OBSERVATION_DERIVED" : "NOT_AVAILABLE" }])),
    observationIds: [],
    candidateHash: String(index).repeat(64),
  };
}

const analysis = {
  contractVersion: "1.5.22",
  scoringVersion: "topic-lab-frontier-radar/1.0.0",
  status: "INSUFFICIENT_EVIDENCE",
  sourcePolicy: "NO_EXTERNAL_SOURCE",
  sourceStatus: "UNVERIFIED",
  inputHash: "a".repeat(64),
  resultHash: "b".repeat(64),
  evidenceDate: "2026-08-23",
  evidenceWindow: "2023-08-23/2026-08-23",
  method: "固定本機 fixture；不讀取外部來源。",
  uncertainty: "來源證據不足，所有候選均需人工核對。",
  observations: [],
  candidates: [topicCandidate(1, "CURRENT_HOT"), topicCandidate(2, "EMERGING"), topicCandidate(3, "OPTIONAL_CONTRARIAN_GAP")],
};

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
    if (child.exitCode !== null) throw new Error("c2r3_fixture_server_exited");
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1_000) }); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("c2r3_fixture_server_timeout");
}

async function stopChild(child) {
  const alive = () => { try { process.kill(child.pid, 0); return true; } catch { return false; } };
  if (!alive()) return;
  child.kill("SIGTERM");
  for (let attempt = 0; attempt < 50 && alive(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (alive()) child.kill("SIGKILL");
  for (let attempt = 0; attempt < 50 && alive(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (alive()) throw new Error("c2r3_fixture_server_cleanup_unknown");
}

async function axeGate(page, selector) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async (target) => {
    const result = await globalThis.axe.run(target, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return result.violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) }));
  }, selector);
  assert.deepEqual(violations, []);
}

function installNetworkGuard(page, baseUrl, counters) {
  return page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) return route.abort("blockedbyclient");
    if (target.pathname === "/api/assist/topic-lab" && request.method() === "POST") {
      counters.topic += 1;
      const body = request.postDataJSON();
      assert.equal(body.operation, "ANALYZE");
      assert.equal(body.sourceMode, "NO_EXTERNAL_SOURCE");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, draft: true, persistence: "NONE", sourceCapability: "NO_EXTERNAL_SOURCE", analysis }) });
    }
    if (target.pathname === "/api/assist/s0-draft" && request.method() === "POST") {
      counters.s0 += 1;
      const body = request.postDataJSON();
      assert.equal(body.intake.workingTitle, fixtureQuestion, "same deterministic nextIntake must reach the request");
      assert.equal(body.candidate.chineseTitle, fixtureQuestion);
      const userProvided = new Set(body.userProvidedFields);
      const draft = Object.fromEntries(S0_FIELDS.map((field) => {
        if (field === "timeline") return [field, { value: "十二個月；實際期程仍需核對。", status: "AI_PROPOSED" }];
        if (field === "constraints") return [field, { value: body.intake[field] || "", status: "RESEARCHER_INPUT_REQUIRED" }];
        return [field, { value: body.intake[field] || `待確認的 ${field}`, status: userProvided.has(field) ? "USER_PROVIDED" : "UNVERIFIED" }];
      }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { status: "success", mode: "AI_PROPOSED", completionClass: "PARTIAL_REVIEW_REQUIRED", draft, appliedCount: 1, pendingCount: 1, firstPendingField: "constraints", parserStages: { JSON_ENVELOPE: "PASS", TOP_STATUS: "PASS", DRAFT_OR_SUGGESTIONS: "PASS", FIELD_NAME: "PASS", FIELD_VALUE: "PASS", FIELD_STATUS: "PASS" }, upstreamCount: 1 } }) });
    }
    if (target.pathname === "/api/assist/field" && request.method() === "POST") {
      counters.assist += 1;
      const body = request.postDataJSON();
      assert.equal(body.surface, "S0_RESEARCH_TEXT");
      assert.equal(body.targetId, "constraints");
      assert.equal(body.action, "SUGGEST");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { completionClass: "COMPLETED", suggestions: [{ id: "suggestion-fixture-0001", text: "預算、設備與人力限制仍需由研究者逐項核對。", changeSummary: "補上待核對限制", status: "AI_PROPOSED" }], originalHash: body.currentHash, contextHash: "c".repeat(64), receipt: { completionClass: "COMPLETED", suggestionCount: 1, formalWrites: 0, retryCount: 0 }, canApply: true } }) });
    }
    if (target.pathname === "/api/projects/fixture-project-0001/topic-lab" && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, run: null }) });
    }
    return route.continue();
  });
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [serverEntry], {
  cwd: path.dirname(serverEntry), windowsHide: true, stdio: "ignore",
  env: { ...process.env, TEST_FIXTURE: "1", C2_OVERLAY_FIXTURE: "1", C2R3_RESEARCH_START_FIXTURE: "1", NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: "127.0.0.1", PORT: String(port) },
});

let browser;
try {
  await waitForServer(`${baseUrl}/c2r3-research-start-fixture`, server);
  browser = await chromium.launch({ executablePath, headless: true });

  // Journey 1: 390x844 quick start -> draft Topic Lab -> deterministic S0 -> preview/apply/undo assist.
  const first = await browser.newContext({ locale: "zh-TW", viewport: { width: 390, height: 844 } });
  const firstPage = await first.newPage();
  const firstCounters = { topic: 0, s0: 0, assist: 0 };
  await installNetworkGuard(firstPage, baseUrl, firstCounters);
  await firstPage.goto(`${baseUrl}/c2r3-research-start-fixture`, { waitUntil: "domcontentloaded" });
  await firstPage.getByRole("button", { name: "開啟選單" }).click();
  await firstPage.getByTestId("nav-quick-start").click();
  await firstPage.getByLabel("一句大致研究方向").fill("改善教學現場的學習支持");
  await firstPage.getByLabel("研究場域／對象（可選）").fill("大學課堂");
  await firstPage.getByRole("button", { name: /開始選題探索/ }).click();
  await expect(firstPage.getByTestId("topic-lab-frontier-radar")).toBeVisible();
  await expect(firstPage.getByText(/尚未建立 Project，不會持久化任何候選/)).toBeVisible();
  await firstPage.getByRole("button", { name: "建立未驗證選題草稿（不儲存）" }).click();
  await expect(firstPage.getByTestId("topic-adopt").first()).toBeVisible();
  await firstPage.getByTestId("topic-adopt").first().click();
  await expect(firstPage.getByRole("status").filter({ hasText: "已補 1 欄／仍需確認 1 欄" })).toBeVisible();
  const constraint = firstPage.getByLabel(/預算／設備／人力限制/).first();
  await expect(constraint).toBeFocused();
  const assistTrigger = firstPage.getByRole("button", { name: "老麥協助：預算／設備／人力限制" });
  await assistTrigger.click();
  await expect(assistTrigger).toHaveAttribute("aria-expanded", "true");
  const assistDialog = firstPage.getByRole("dialog", { name: "老麥" });
  const dialogBox = await assistDialog.boundingBox();
  assert(dialogBox && dialogBox.height <= 592 && dialogBox.y + dialogBox.height <= 845, "mobile assist sheet must remain bounded to about 70dvh");
  await expect(assistDialog.getByRole("button", { name: "關閉老麥建議" })).toBeFocused();
  await axeGate(firstPage, ".old-mike-assist-popover");
  await assistDialog.getByRole("button", { name: "提供建議" }).click();
  await expect(assistDialog.getByRole("button", { name: "套用這項建議" })).toBeVisible();
  await assistDialog.getByRole("button", { name: "套用這項建議" }).click();
  await expect(constraint).toHaveValue("預算、設備與人力限制仍需由研究者逐項核對。");
  await firstPage.getByRole("button", { name: "復原老麥套用" }).click();
  await expect(constraint).toHaveValue("");
  assert.deepEqual(firstCounters, { topic: 1, s0: 1, assist: 1 });
  await axeGate(firstPage, "main.workspace");
  await first.close();

  // Journey 2: 360x640 keyboard-sized chat plus project-scoped assist focus/escape/return.
  const second = await browser.newContext({ locale: "zh-TW", viewport: { width: 360, height: 640 } });
  const secondPage = await second.newPage();
  const secondCounters = { topic: 0, s0: 0, assist: 0 };
  await installNetworkGuard(secondPage, baseUrl, secondCounters);
  await secondPage.goto(`${baseUrl}/c2-overlay-fixture`, { waitUntil: "domcontentloaded" });
  const chatTrigger = secondPage.getByRole("button", { name: "開啟老麥專案對話" });
  await chatTrigger.click();
  const chat = secondPage.locator("#project-chat-overlay");
  const chatBox = await chat.boundingBox();
  assert(chatBox && Math.abs(chatBox.width - 360) <= 1 && Math.abs(chatBox.height - 640) <= 1, "360x640 project chat must remain full-screen");
  await secondPage.setViewportSize({ width: 360, height: 420 });
  const compose = await chat.locator(".v13-chat-compose").boundingBox();
  assert(compose && compose.y + compose.height <= 421, "keyboard viewport must retain the chat composer");
  await axeGate(secondPage, "#project-chat-overlay");
  await secondPage.keyboard.press("Escape");
  await expect(chatTrigger).toBeFocused();
  await secondPage.setViewportSize({ width: 360, height: 640 });
  await secondPage.getByRole("button", { name: "開啟選單" }).click();
  await secondPage.getByTestId("nav-topic-lab").click();
  const groupTrigger = secondPage.getByRole("button", { name: "協助整理研究條件" });
  await groupTrigger.click();
  await expect(groupTrigger).toHaveAttribute("aria-expanded", "true");
  const groupDialog = secondPage.getByRole("dialog", { name: "老麥" });
  await expect(groupDialog.getByRole("button", { name: "關閉老麥建議" })).toBeFocused();
  await axeGate(secondPage, ".old-mike-assist-popover");
  await secondPage.keyboard.press("Escape");
  await expect(groupTrigger).toBeFocused();
  assert.deepEqual(secondCounters, { topic: 0, s0: 0, assist: 0 });
  await second.close();

  console.log("C2R3_BROWSER_JOURNEYS=PASS_2_OF_2");
  console.log("C2R3_390X844_QUICK_TOPIC_S0_ASSIST=PASS");
  console.log("C2R3_360X640_KEYBOARD_CHAT_ASSIST=PASS");
  console.log("C2R3_AXE_FOCUS_LIVE_REGION=PASS");
  console.log("C2R3_EXTERNAL_NETWORK_REQUESTS=0");
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(server);
}
