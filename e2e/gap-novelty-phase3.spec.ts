import { expect, test, type Page } from "@playwright/test";

// Gap & Novelty Lab — 瀏覽器層 UI 測試（TEST 02/05/07/12 的 UI 不變量）
// 執行環境：fixture mode（TEST_FIXTURE=1 + C2_OVERLAY_FIXTURE=1，/c2-overlay-fixture）
// fixture 無 DB：Gap 模組顯示「尚未建立分析」空狀態；有 DB 的環境由 disposable 測試覆蓋。
// 有 DB 的完整流程測試在 scripts/verify-gap-novelty-disposable.mjs（TEST 01–12，DB/API 層）。

const GAP_TESTID = "gap-novelty-lab";
const FIXTURE_URL = "/c2-overlay-fixture";

async function openGapLab(page: Page) {
  await page.goto(FIXTURE_URL);
  await expect(page.getByTestId("nav-gap")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("nav-gap").click();
  await expect(page.getByTestId(GAP_TESTID)).toBeVisible({ timeout: 20_000 });
}

test("Gap 模組入口與審慎語言（TEST 07 UI）", async ({ page }) => {
  await openGapLab(page);
  // 進入 Gap 模組：標題與空狀態說明（fixture 無 DB → 尚未建立分析）
  const heading = page.locator(`[data-testid="${GAP_TESTID}"] h2`);
  await expect(heading.first()).toBeVisible();
  await expect(heading.first()).toContainText(/Gap 與新穎性/u);
  await expect(page.getByText(/尚未建立 Gap 與新穎性分析/u)).toBeVisible();
  await expect(page.getByText(/此模組會依研究藍圖建立搜尋任務、Gap Claim、Closest Study Matrix 與 Gate 檢查/u)).toBeVisible();
});

test("無 Blueprint 時 draft 被服務端拒絕且顯示錯誤（TEST 05 守衛 UI）", async ({ page }) => {
  await openGapLab(page);
  const createButton = page.getByRole("button", { name: /依研究藍圖建立搜尋計畫/u });
  await expect(createButton).toBeVisible();
  await createButton.click();
  // 服務端必須拒絕（blueprint_required / research_project_not_found / storage unavailable），不得假裝建立成功
  await expect(page.locator('[role="alert"], [data-testid="gap-novelty-lab"] .v13-error').first()).toBeVisible({ timeout: 20_000 });
});

test("Gap → Blueprint 交接按鈕存在（TEST 02 交接 UI）", async ({ page }) => {
  await openGapLab(page);
  const blueprintButton = page.getByRole("button", { name: /查看研究藍圖/u });
  await expect(blueprintButton).toBeVisible();
  await blueprintButton.click();
  // 交接目標：研究藍圖面板
  await expect(page.getByText(/研究藍圖/u).first()).toBeVisible({ timeout: 20_000 });
});

test("理論與機制維持 Locked（TEST 12 UI）", async ({ page }) => {
  await openGapLab(page);
  await page.getByTestId("nav-theory").click();
  await expect(page.getByText(/理論與機制（需先完成 Gap & Novelty Gate；本階段不提前建置）/u)).toBeVisible({ timeout: 20_000 });
});

test("Dashboard 研究進度面板（規格 24 UI）", async ({ page }) => {
  await page.goto(FIXTURE_URL);
  await expect(page.getByTestId("nav-overview")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("nav-overview").click();
  await expect(page.getByText(/研究進度與下一步/u).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Next Best Action：/u).first()).toBeVisible();
  // 理論與機制狀態（fixture 無 VALIDATED → Locked）
  await expect(page.locator(".v13-progress-grid").getByText("Locked")).toBeVisible();
});
