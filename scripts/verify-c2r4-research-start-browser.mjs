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
const executablePath = process.env.C2R4_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
if (!existsSync(serverEntry) || !existsSync(executablePath)) throw new Error("c2r4_local_browser_tool_or_production_build_missing");

const direction = "改善高風險作業人員的擴增實境安全訓練移轉";
const lanes = ["CURRENT_PRACTICE_VALUE", "EMERGING_FRONTIER", "HIGH_VALUE_GAP_OR_CONTRARIAN"];
const titles = [
  "擴增實境回饋時點對高風險作業危害辨識與訓練移轉的情境比較",
  "沉浸式安全訓練中認知負荷軌跡對危害辨識移轉的縱貫機制",
  "擴增實境提示依賴造成高風險作業訓練移轉失效的邊界條件",
];
const questions = [
  "不同回饋時點如何改變危害辨識與現場訓練移轉？",
  "認知負荷軌跡是否解釋沉浸訓練後的危害辨識移轉？",
  "提示依賴在何種情境下會降低延宕危害辨識與移轉？",
];
const methods = ["準實驗情境比較", "三波縱貫機制分析", "提示撤除實驗與邊界分析"];
const targets = ["高風險作業人員的擴增實境回饋訓練場域", "高風險作業人員的沉浸式訓練與延宕評量場域", "高風險作業人員的提示撤除與真實工作情境"];
const contributions = ["建立回饋時點的可反駁實務比較", "建立認知負荷軌跡的時間機制證據", "界定提示依賴的失效邊界"];
const signalNames = ["recency", "momentum", "evidenceVolume", "sourceDiversity", "noveltyProxy", "feasibility", "saturationRisk"];

function candidate(index) {
  const lane = lanes[index];
  const s0Draft = {
    workingTitle: titles[index], domain: "AR/VR/XR × 職業安全與教育訓練", outputTrack: "NSTC", problemContext: `研究者原始方向：${direction}。本方案研究問題：${questions[index]} 專業背景與場域條件仍待核對。`,
    targetUsers: targets[index], expectedContribution: contributions[index],
    existingData: "目前沒有已確認的正式資料；需先盤點可用紀錄", availableData: "可規劃去識別化危害辨識與延宕測量資料，權限待確認", methodIdea: methods[index],
    timeline: "建議分為場域協議、前測、介入、延宕後測與分析，實際期程待確認", constraints: "樣本、設備與場域介入負荷仍待確認", ethicsPrivacyRisks: "需完成倫理、隱私、職場同意與去識別化審查", unresolvedItems: "場域、樣本數、工具效度與資料權限待研究者核定",
  };
  return {
    candidateId: `research_plan_${index + 1}`, lane, requestedLane: lane,
    requestedGroup: index === 0 ? "CURRENT_HOT" : index === 1 ? "EMERGING" : "OPTIONAL_CONTRARIAN_GAP",
    recommended: index === 1, workingTitle: titles[index], researchQuestion: questions[index], researchValue: `方案 ${index + 1} 將可觀察構念連結至安全訓練決策`, mechanismTheory: index === 0 ? "回饋時點與近端強化" : index === 1 ? "認知負荷與記憶鞏固" : "提示依賴與撤除成本", targetContext: targets[index], contribution: contributions[index], methodDesign: methods[index], dataPlan: "去識別化危害辨識、訓練表現與延宕測量，權限與樣本量待確認", feasibility: "先以單一場域小規模驗證量測與招募", riskEthics: "倫理、隱私、職場權力關係與設備風險均需正式審查", evidenceStatus: "UNVERIFIED", assumptions: ["場域願意提供去識別化資料"], unresolvedItems: ["樣本數", "資料權限"], nextAction: "研究者核對構念、場域與資料後再進入正式預覽", researchDirectionProvenance: { value: direction, status: "USER_PROVIDED" }, s0Draft, qualityWarnings: [], candidateHash: String(index + 1).repeat(64),
    classification: "INSUFFICIENT_EVIDENCE", observedClassification: "INSUFFICIENT_EVIDENCE", hypothesisCandidate: questions[index], novelty: "新穎性尚未驗證", dataMethods: [methods[index], "去識別化資料"], risks: ["倫理與資料授權仍待確認"], professionalAdvice: "先確認構念與可反駁設計", evidenceDate: "2026-08-24", evidenceWindow: "2023-08-24/2026-08-24", sourceCount: 0, sourceDiversity: 0, scoringMethod: "NO_OBSERVATION_EVIDENCE", uncertainty: "學術來源未啟用，趨勢指標不可用", signals: Object.fromEntries(signalNames.map((name) => [name, { value: name === "feasibility" ? 500 : null, basis: name === "feasibility" ? "USER_CONSTRAINT_PROXY" : "NOT_AVAILABLE" }])), observationIds: [],
  };
}

const analysis = {
  contractVersion: "1.5.30-c2r4", scoringVersion: "topic-lab-frontier-radar/1.1.0", status: "INSUFFICIENT_EVIDENCE", sourcePolicy: "NONE", sourceStatus: "UNVERIFIED", inputHash: "a".repeat(64), resultHash: "b".repeat(64), evidenceDate: "2026-08-24", evidenceWindow: "2023-08-24/2026-08-24", method: "固定本機 fixture；未呼叫外部來源", uncertainty: "來源不可用，三個方案均為待驗證概念", observations: [], candidates: lanes.map((_, index) => candidate(index)), recommendedCandidateId: "research_plan_2", recommendationRationale: "第二方案具明確時間機制與可反駁設計，但仍需來源與研究者核對",
};

async function freePort() {
  const server = net.createServer(); server.unref();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); assert(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve)); return address.port;
}
async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error("c2r4_fixture_server_exited");
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1_000) }); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("c2r4_fixture_server_timeout");
}
async function stopChild(child) {
  const alive = () => { try { process.kill(child.pid, 0); return true; } catch { return false; } };
  if (!alive()) return; child.kill("SIGTERM");
  for (let attempt = 0; attempt < 50 && alive(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (alive()) child.kill("SIGKILL");
  for (let attempt = 0; attempt < 50 && alive(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 100));
  if (alive()) throw new Error("c2r4_fixture_server_cleanup_unknown");
}
async function axeGate(page, selector) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async (target) => (await globalThis.axe.run(target, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) })), selector);
  assert.deepEqual(violations, []);
}
function installNetworkGuard(page, baseUrl, counters) {
  return page.route("**/*", async (route) => {
    const request = route.request(); const target = new URL(request.url());
    if (target.origin !== baseUrl) { counters.external += 1; return route.abort("blockedbyclient"); }
    if (target.pathname === "/api/assist/topic-lab" && request.method() === "POST") {
      counters.topic += 1; const body = request.postDataJSON();
      assert.equal(body.operation, "ANALYZE"); assert.equal(body.researchDirection, direction); assert.equal(body.sourceStrategy, "NONE"); assert.match(body.idempotencyKey, /^research-start:[a-f0-9]{64}$/u);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, draft: true, persistence: "NONE", sourceCapability: "SCHOLARLY_DISABLED", analysis, providerSubmissionCount: 1 }) });
    }
    if (target.pathname === "/api/assist/s0-draft") { counters.forbiddenS0 += 1; return route.abort("blockedbyclient"); }
    if (target.pathname === "/api/assist/field" && request.method() === "POST") {
      counters.assist += 1; const body = request.postDataJSON(); assert.equal(body.surface, "S0_RESEARCH_TEXT"); assert.equal(body.schemaId, "workingTitle"); assert.equal(body.targetKind, "FIELD"); assert.equal(body.contextSnapshot.researchDirection, direction); assert.equal(body.contextSnapshot.s0.methodIdea, methods[2]);
      return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: "老麥服務暫時不可用；原稿已保留。", stage: "PROVIDER_COMPLETION_UNKNOWN", recoverableFields: ["workingTitle"] }) });
    }
    if (target.pathname === "/api/projects/preview" && request.method() === "POST") {
      counters.preview += 1; const body = request.postDataJSON(); assert.equal(body.intake.workingTitle, titles[2]); assert.match(body.intake.problemContext, new RegExp(direction, "u")); assert.notEqual(body.intake.problemContext, direction);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, preview: { projectId: "fixture-preview-project", previewHash: "c".repeat(64), workingTitle: titles[2], domain: body.intake.domain, outputTrack: body.intake.outputTrack, known: [direction], unknown: ["資料權限待確認"], assumptions: ["場域可招募"], risks: ["倫理審查未完成"] } }) });
    }
    if (target.pathname === "/api/projects" && request.method() === "POST") { counters.formalCreate += 1; return route.abort("blockedbyclient"); }
    return route.continue();
  });
}

const port = await freePort(); const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [serverEntry], { cwd: path.dirname(serverEntry), windowsHide: true, stdio: "ignore", env: { ...process.env, TEST_FIXTURE: "1", C2_OVERLAY_FIXTURE: "1", C2R4_RESEARCH_START_FIXTURE: "1", NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: "127.0.0.1", PORT: String(port) } });
let browser;
try {
  await waitForServer(`${baseUrl}/c2r4-research-start-fixture`, server);
  browser = await chromium.launch({ executablePath, headless: true });
  for (const viewport of [{ width: 1440, height: 900, name: "desktop" }, { width: 390, height: 844, name: "mobile-390" }, { width: 360, height: 640, name: "mobile-360" }]) {
    const context = await browser.newContext({ locale: "zh-TW", viewport }); const page = await context.newPage();
    const counters = { topic: 0, assist: 0, preview: 0, formalCreate: 0, forbiddenS0: 0, external: 0 };
    await installNetworkGuard(page, baseUrl, counters); await page.goto(`${baseUrl}/c2r4-research-start-fixture`, { waitUntil: "domcontentloaded" });
    if (viewport.width <= 820) { await page.getByRole("button", { name: "開啟選單" }).click(); await page.getByTestId("nav-quick-start").click(); } else await page.getByTestId("nav-quick-start").click();
    const directionInput = page.getByLabel("研究方向"); await directionInput.fill(direction);
    const submit = page.getByTestId("research-start-submit"); await expect(submit).toBeVisible(); const submitBox = await submit.boundingBox(); assert(submitBox && submitBox.x >= 0 && submitBox.x + submitBox.width <= viewport.width + 1, `${viewport.name} CTA overflow`);
    await submit.click(); await expect(page.getByTestId("topic-lab-frontier-radar")).toBeVisible();
    await expect(page.getByText("概念優先序／待驗證").first()).toBeVisible();
    for (const lane of lanes) await expect(page.getByTestId(`research-plan-${lane}`)).toBeVisible();
    await expect(page.getByTestId("research-plan-EMERGING_FRONTIER").getByRole("button", { name: "已選擇此方案" })).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("research-plan-HIGH_VALUE_GAP_OR_CONTRARIAN").getByRole("button", { name: "選擇此方案" }).click();
    assert.equal(counters.topic, 1, "candidate switching must not submit again");
    await page.getByTestId("topic-adopt").click();
    await expect(page.getByRole("status").filter({ hasText: "完整 13 欄已帶入" })).toBeVisible();
    await expect(page.getByLabel(/暫定研究題目/).first()).toHaveValue(titles[2]); assert.match(await page.getByLabel(/問題背景/).first().inputValue(), new RegExp(direction, "u")); await expect(page.getByLabel(/方法或技術構想/).first()).toHaveValue(methods[2]);
    const title = page.getByLabel(/暫定研究題目/).first(); const originalTitle = await title.inputValue(); const trigger = page.getByRole("button", { name: "老麥協助：暫定研究題目" }); await trigger.click(); const dialog = page.getByRole("dialog", { name: "老麥" }); await expect(dialog.getByRole("button", { name: "關閉老麥建議" })).toBeFocused();
    if (viewport.name === "mobile-360") { await page.setViewportSize({ width: 360, height: 420 }); const box = await dialog.boundingBox(); assert(box && box.y + box.height <= 421, "assist sheet must fit keyboard viewport"); }
    await dialog.getByRole("button", { name: "提供建議" }).click(); await expect(dialog.getByRole("alert")).toContainText("原稿已保留"); await expect(title).toHaveValue(originalTitle); await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
    if (viewport.name === "mobile-360") await page.setViewportSize({ width: 360, height: 640 });
    await page.getByTestId("s0-preview").click(); await expect(page.getByLabel(/我已閱讀上述預覽/)).not.toBeChecked(); await expect(page.getByTestId("project-confirm")).toBeDisabled();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(overflow <= 1, `${viewport.name} horizontal overflow ${overflow}`);
    await axeGate(page, "main.workspace");
    assert.deepEqual(counters, { topic: 1, assist: 1, preview: 1, formalCreate: 0, forbiddenS0: 0, external: 0 });
    await context.close();
  }
  console.log("C2R4_BROWSER_FLOW=PASS_DESKTOP_390_360");
  console.log("C2R4_ONE_POST_LOCAL_SWITCH_HUMAN_GATE=PASS");
  console.log("C2R4_FAILURE_DRAFT_PRESERVATION=PASS");
  console.log("C2R4_AXE_FOCUS_KEYBOARD_LIVE_REGION=PASS");
  console.log("C2R4_EXTERNAL_NETWORK_REQUESTS=0");
} finally { await browser?.close().catch(() => undefined); await stopChild(server); }
