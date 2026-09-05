import { defineConfig } from "@playwright/test";

const origin = "http://127.0.0.1:43120";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [["line"]],
  outputDir: "test-results/v2-beta1-r1",
  use: {
    baseURL: origin,
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: ["--disable-background-networking"],
    },
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 43120",
    url: `${origin}/research-os-local`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      CI: "1",
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      TEST_FIXTURE: "1",
      C2_OVERLAY_FIXTURE: "1",
      OLD_MIKE_V2_BETA1_LOCAL_PROTOTYPE: "1",
      OLD_MIKE_V2_BETA1_SYNTHETIC_PRINCIPAL: "1",
      BETTER_AUTH_URL: origin,
    },
  },
});
