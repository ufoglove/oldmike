import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.V2_ALPHA9_BASE_URL;
const chrome = process.env.V2_E2E_CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
assert.match(baseUrl ?? "", /^http:\/\/127\.0\.0\.1:\d+$/u);

const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const contractVersion = "old-mike-v2-alpha9/1.0.0";
const workspaceAuthority = "fixture-workspace-v2";
const sectionKeys = [
  "TITLE",
  "ABSTRACT",
  "KEYWORDS",
  "INTRODUCTION_OR_PROBLEM",
  "LITERATURE_OR_POLICY_CONTEXT",
  "RESEARCH_QUESTIONS_OR_AIMS",
  "METHODS_OR_IMPLEMENTATION",
  "RESULTS_OR_EXPECTED_OUTCOMES",
  "DISCUSSION_OR_SIGNIFICANCE",
  "CONCLUSION_OR_IMPACT",
  "LIMITATIONS_OR_RISKS",
  "REFERENCES",
  "DECLARATIONS_OR_ATTACHMENTS",
];
const revisionStrategies = ["EVIDENCE_CALIBRATED", "STRUCTURE_RECOMMENDED", "CROSS_DISCIPLINARY_CLARITY"];
const fixtures = {
  JOURNAL_MANUSCRIPT: "alpha8-journal-handoff",
  NSTC_PROPOSAL: "alpha5-nstc-handoff",
  MOE_PROPOSAL: "alpha5-moe-handoff",
};
const journeys = [
  { track: "JOURNAL_MANUSCRIPT", viewport: { name: "1440x900", width: 1440, height: 900 }, mobile: false },
  { track: "NSTC_PROPOSAL", viewport: { name: "390x844", width: 390, height: 844 }, mobile: true },
  { track: "MOE_PROPOSAL", viewport: { name: "360x640", width: 360, height: 640 }, mobile: true },
];

const counters = {
  externalRequests: 0,
  finalizePosts: 0,
  unexpectedMutationRequests: 0,
  byTrack: new Map(journeys.map(({ track }) => [track, 0])),
};

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, expected, label) {
  assert.equal(isRecord(value), true, `${label}_record`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label}_exact_keys`);
}

function normalizedAlternative(text) {
  return text.normalize("NFKC").replace(/\s+/gu, "").replace(/^(?:老麥推薦|目前比較版本|證據校準版|老麥推薦結構版|跨領域清晰版|規範界線版|老麥推薦核對版|跨域研究優先版|老麥推薦證據版|跨域脈絡版|未知項保留版|老麥推薦風險版|跨域資源彈性版)[：｜|\s]*/u, "");
}

function assertWorkspacePayload(payload, journey) {
  assertExactKeys(payload, ["ok", "contractVersion", "workspace", "replayed", "providerCallCount", "scholarlyCallCount", "databaseConnectionCount", "formalResearchWriteCount", "externalMutationCount"], `${journey.track}_response`);
  assert.equal(payload.ok, true);
  assert.equal(payload.contractVersion, contractVersion);
  assert.equal(payload.replayed, false);
  assert.equal(payload.providerCallCount, 0);
  assert.equal(payload.scholarlyCallCount, 0);
  assert.equal(payload.databaseConnectionCount, 0);
  assert.equal(payload.formalResearchWriteCount, 0);
  assert.equal(payload.externalMutationCount, 0);

  const workspace = payload.workspace;
  assertExactKeys(workspace, ["contractVersion", "requestId", "track", "status", "sourceArtifactHash", "sourceSnapshot", "proposedSnapshot", "priorityIssues", "completedCount", "gapCount", "officialComplianceStatus", "humanGate", "paperpalBoundary", "formalResearchWriteCount"], `${journey.track}_workspace`);
  assert.equal(workspace.contractVersion, contractVersion);
  assert.equal(workspace.track, journey.track);
  assert.equal(workspace.formalResearchWriteCount, 0);
  assert.match(workspace.sourceArtifactHash, /^[0-9a-f]{64}$/u);
  assert.equal(workspace.completedCount + workspace.gapCount, 13);
  assert.equal(workspace.humanGate.required, true);
  assert.equal(workspace.humanGate.confirmed, false);
  assert.equal(workspace.humanGate.scope, "WHOLE_ARTIFACT");

  for (const [name, snapshot] of [["source", workspace.sourceSnapshot], ["proposed", workspace.proposedSnapshot]]) {
    assertExactKeys(snapshot, ["title", "sections"], `${journey.track}_${name}_snapshot`);
    assert.equal(typeof snapshot.title, "string");
    assert.ok(snapshot.title.trim());
    assert.deepEqual(Object.keys(snapshot.sections), sectionKeys, `${journey.track}_${name}_exact_13_sections`);
    if (name === "proposed") assert.equal(Object.values(snapshot.sections).every((text) => typeof text === "string" && text.trim()), true);
  }

  assert.equal(workspace.priorityIssues.length, 3);
  assert.equal(new Set(workspace.priorityIssues.map((issue) => issue.issueId)).size, 3);
  assert.equal(new Set(workspace.priorityIssues.map((issue) => issue.location)).size, 3);
  for (const issue of workspace.priorityIssues) {
    assert.equal(sectionKeys.includes(issue.location), true);
    assert.equal(issue.alternatives.length, 3);
    assert.equal(new Set(issue.alternatives.map((alternative) => alternative.alternativeId)).size, 3);
    assert.equal(new Set(issue.alternatives.map((alternative) => alternative.strategy)).size, 3);
    assert.deepEqual([...new Set(issue.alternatives.map((alternative) => alternative.strategy))].sort(), [...revisionStrategies].sort());
    assert.equal(new Set(issue.alternatives.map((alternative) => normalizedAlternative(alternative.text))).size, 3, `${journey.track}_${issue.issueId}_substantive_alternatives`);
    const recommended = issue.alternatives.filter((alternative) => alternative.recommended);
    assert.equal(recommended.length, 1);
    assert.equal(recommended[0].alternativeId, issue.recommendedAlternativeId);
  }

  if (journey.track === "JOURNAL_MANUSCRIPT") {
    assert.equal(workspace.officialComplianceStatus, null);
    assert.deepEqual(workspace.paperpalBoundary, {
      mode: "MANUAL_DOCX_EXPORT_IMPORT_UNCONFIGURED",
      status: "UNCONFIGURED",
      liveConnection: false,
      sourceMutation: "FORBIDDEN",
      importedCandidateMayUpgradeEvidence: false,
      trackedDocxSemanticMerge: "NOT_IMPLEMENTED",
    });
  } else {
    assert.equal(workspace.paperpalBoundary, null);
    assert.match(workspace.officialComplianceStatus, /^BLOCKED_SOURCE_(?:AUTHORITY|FRESHNESS)$/u, `${journey.track}_official_rules_must_not_false_pass`);
    assert.notEqual(workspace.officialComplianceStatus, "PASS_OFFICIAL_CURRENT");
  }
  return workspace;
}

async function installBoundary(page, journey) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (target.origin !== baseUrl) {
      counters.externalRequests += 1;
      return route.abort("blockedbyclient");
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      if (request.method() !== "POST" || target.pathname !== "/api/v2-alpha9/finalize") {
        counters.unexpectedMutationRequests += 1;
        return route.abort("blockedbyclient");
      }
      counters.finalizePosts += 1;
      counters.byTrack.set(journey.track, (counters.byTrack.get(journey.track) ?? 0) + 1);
      const requestBody = JSON.parse(request.postData() ?? "{}");
      assertExactKeys(requestBody, ["contractVersion", "requestId", "idempotencyKey", "track", "fixtureSeed"], `${journey.track}_request`);
      assert.equal(requestBody.contractVersion, contractVersion);
      assert.equal(requestBody.track, journey.track);
      assert.equal(requestBody.fixtureSeed, fixtures[journey.track]);
      assert.match(requestBody.requestId, /^[0-9a-f-]{36}$/u);
      assert.match(requestBody.idempotencyKey, /^[0-9a-f-]{36}$/u);
      assert.notEqual(requestBody.requestId, requestBody.idempotencyKey);
      assert.equal(request.headers()["x-old-mike-v2-workspace"], workspaceAuthority);
      assert.match(request.headers()["content-type"] ?? "", /^application\/json(?:;|$)/u);
    }
    return route.continue();
  });
}

async function runAxe(page, name) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await globalThis.axe.run(document, { resultTypes: ["violations"] })).violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.flatMap((node) => node.target).slice(0, 8) })));
  const blocking = violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  assert.deepEqual(blocking, [], `${name}_axe_${JSON.stringify(blocking)}`);
  return violations.length;
}

async function horizontalOverflowEvidence(page) {
  return page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    elements: Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        const rectangle = element.getBoundingClientRect();
        return rectangle.right > window.innerWidth + 1 || rectangle.left < -1 || element.scrollWidth > element.clientWidth + 1;
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        testId: element.getAttribute("data-testid"),
        className: typeof element.className === "string" ? element.className : "",
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      })),
  }));
}

function snapshotTexts(snapshot) {
  return sectionKeys.map((key) => snapshot.sections[key]);
}

async function visiblePaper(page, mobile) {
  const paper = page.getByTestId(mobile ? "alpha9-mobile-paper" : "alpha9-paper");
  await expect(paper).toBeVisible();
  await expect(paper.locator("section[data-section-key]")).toHaveCount(13);
  assert.deepEqual(await paper.locator("section[data-section-key]").evaluateAll((sections) => sections.map((section) => section.getAttribute("data-section-key"))), sectionKeys);
  return paper;
}

async function selectLocalAlternative(page, workspace, postsBefore) {
  const firstIssue = page.getByTestId("alpha9-priority-issue").first();
  const firstIssueContract = workspace.priorityIssues[0];
  const firstAlternate = firstIssueContract.alternatives.find((alternative) => !alternative.recommended);
  assert.ok(firstAlternate);
  await firstIssue.locator("details > summary").click();
  const option = firstIssue.locator("details article").filter({ hasText: firstAlternate.label });
  await expect(option).toHaveCount(1);
  await option.getByRole("button", { name: "改用這個版本" }).click();
  await expect(firstIssue.locator(":scope > div").first().locator("span")).toContainText(firstAlternate.label);
  assert.equal(counters.finalizePosts, postsBefore, "local alternative switch must not submit");
  return firstAlternate;
}

async function assertMobileTabs(page, workspace) {
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await tabs.nth(1).focus();
  await tabs.nth(1).press("Enter");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel").getByTestId("alpha9-change-rail")).toBeVisible();
  await tabs.nth(2).focus();
  await tabs.nth(2).press("Enter");
  await expect(tabs.nth(2)).toBeFocused();
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  if (workspace.officialComplianceStatus) {
    await expect(page.getByRole("tabpanel")).toContainText(/來源年度或時效仍需更新|尚待可信的當年度官方來源核對/u);
    await expect(page.getByRole("tabpanel")).not.toContainText("已有當年度來源，可進行最終人工核對");
  }
  await tabs.nth(0).focus();
  await tabs.nth(0).press("Enter");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
}

async function exerciseJourney(browser, journey) {
  const context = await browser.newContext({ locale: "zh-TW", serviceWorkers: "block", viewport: { width: journey.viewport.width, height: journey.viewport.height } });
  const page = await context.newPage();
  await installBoundary(page, journey);
  try {
    await page.goto(`${baseUrl}/v2-alpha9-local`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "nextjs-portal { display:none!important; }" });
    await expect(page.getByTestId("alpha9-workspace")).toBeVisible();
    await expect(page.getByTestId("alpha9-workspace")).toHaveAttribute("data-formal-write-count", "0");
    await expect(page.getByTestId("alpha9-live")).toHaveAttribute("aria-live", "polite");
    await expect(page.getByTestId("alpha9-live")).toHaveAttribute("aria-atomic", "true");

    await page.getByTestId("alpha9-track").selectOption(journey.track);
    await expect(page.getByTestId("alpha9-track")).toHaveValue(journey.track);
    await page.getByTestId("alpha9-finalize").focus();
    await expect(page.getByTestId("alpha9-finalize")).toBeFocused();

    const before = counters.finalizePosts;
    const responsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v2-alpha9/finalize");
    await page.getByTestId("alpha9-finalize").press("Enter");
    const response = await responsePromise;
    assert.equal(response.status(), 200, `${journey.track}_finalize_http_200`);
    const payload = await response.json();
    const workspace = assertWorkspacePayload(payload, journey);
    await expect(page.getByTestId("alpha9-result")).toBeVisible();
    await expect(page.getByRole("heading", { name: "老麥已完成整體判讀" })).toBeFocused();
    await expect(page.getByTestId("alpha9-priority-issue")).toHaveCount(3);
    await expect(page.getByTestId("alpha9-workspace")).toHaveAttribute("data-formal-write-count", "0");
    assert.equal(counters.finalizePosts - before, 1, `${journey.track}_one_finalize_post`);
    assert.equal(counters.byTrack.get(journey.track), 1, `${journey.track}_exactly_one_post`);

    const switched = await selectLocalAlternative(page, workspace, counters.finalizePosts);
    await page.getByTestId("alpha9-open-preview").click();
    await expect(page.getByRole("heading", { name: "整份成果預覽" })).toBeFocused();
    const paper = await visiblePaper(page, journey.mobile);

    const staged = structuredClone(workspace.proposedSnapshot);
    staged.sections[workspace.priorityIssues[0].location] = switched.text;
    assert.deepEqual(await paper.locator("section[data-section-key] p").allTextContents(), snapshotTexts(staged), `${journey.track}_preview_exact_13_sections`);
    assert.notDeepEqual(snapshotTexts(staged), snapshotTexts(workspace.sourceSnapshot), `${journey.track}_apply_candidate_changes_source`);

    if (journey.mobile) await assertMobileTabs(page, workspace);
    const activePaper = await visiblePaper(page, journey.mobile);
    await page.getByTestId("alpha9-apply").focus();
    await page.getByTestId("alpha9-apply").press("Enter");
    await expect(page.getByTestId("alpha9-undo")).toBeVisible();
    await expect(page.getByTestId("alpha9-live")).toContainText("已套用到本機工作副本");
    assert.deepEqual(await activePaper.locator("section[data-section-key] p").allTextContents(), snapshotTexts(staged), `${journey.track}_whole_apply_exact_staged_content`);
    assert.equal(counters.finalizePosts, before + 1, "whole apply must stay local");

    await page.getByTestId("alpha9-undo").focus();
    await page.getByTestId("alpha9-undo").press("Enter");
    await expect(page.getByTestId("alpha9-apply")).toBeVisible();
    await expect(page.getByTestId("alpha9-live")).toContainText("已完整復原套用前的工作稿");
    assert.deepEqual(await activePaper.locator("section[data-section-key] p").allTextContents(), snapshotTexts(workspace.sourceSnapshot), `${journey.track}_undo_byte_exact_source`);
    assert.equal(counters.finalizePosts, before + 1, "whole undo must stay local");

    if (journey.track === "JOURNAL_MANUSCRIPT") {
      await expect(page.getByTestId("alpha9-change-rail").last()).toContainText("目前僅保留手動匯出／回匯邊界");
      await expect(page.getByTestId("alpha9-change-rail").last()).toContainText("不會自動連線或覆寫原稿");
    }
    const overflow = await horizontalOverflowEvidence(page);
    assert.equal(overflow.documentWidth <= overflow.viewportWidth + 1, true, `${journey.viewport.name}_no_horizontal_overflow_${JSON.stringify(overflow)}`);
    const axeViolations = await runAxe(page, journey.viewport.name);
    return {
      track: journey.track,
      viewport: journey.viewport.name,
      resultFocus: "PASS",
      priorityIssues: 3,
      alternativesPerIssue: 3,
      previewSections: 13,
      localSwitchZeroAdditionalPost: "PASS",
      wholeApplyUndo: "PASS_BYTE_EXACT",
      mobileTabs: journey.mobile ? "PASS_KEYBOARD" : "NOT_APPLICABLE_DESKTOP",
      axeCriticalSerious: 0,
      axeViolationsAllImpacts: axeViolations,
      overflow: "PASS",
      formalResearchWrites: 0,
    };
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const evidence = [];
try {
  for (const journey of journeys) evidence.push(await exerciseJourney(browser, journey));
} finally {
  await browser.close();
}

assert.equal(counters.externalRequests, 0);
assert.equal(counters.unexpectedMutationRequests, 0);
assert.equal(counters.finalizePosts, 3);
assert.deepEqual(Object.fromEntries(counters.byTrack), { JOURNAL_MANUSCRIPT: 1, NSTC_PROPOSAL: 1, MOE_PROPOSAL: 1 });
console.log(JSON.stringify({
  status: "PASS",
  acceptanceGroup: 9,
  journeys: 3,
  viewports: 3,
  evidence,
  finalizePosts: 3,
  externalRequests: 0,
  unexpectedMutationRequests: 0,
  formalResearchWrites: 0,
  onlineDatabaseWrites: 0,
  liveProviderSubmissions: 0,
  journalManualExternalReviewBoundary: "PASS_UNCONFIGURED_NO_LIVE_CONNECTION",
  proposalOfficialRules: "PASS_NOT_FALSELY_UPGRADED",
  screenshotsRetained: 0,
}));
