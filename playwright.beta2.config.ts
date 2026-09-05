import { defineConfig } from "@playwright/test";

const port = Number(process.env.BETA2_PLAYWRIGHT_PORT ?? "43124");
const origin = `http://127.0.0.1:${port}`;
const outputDir = process.env.BETA2_PLAYWRIGHT_OUTPUT_DIR;
if (!outputDir) throw new Error("beta2_playwright_output_dir_missing");
if (!process.env.BETA2_DISPOSABLE_DATABASE_URL || !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) throw new Error("beta2_playwright_database_profile_invalid");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 360_000,
  expect: { timeout: 20_000 },
  reporter: [["line"]],
  outputDir,
  use: {
    baseURL: origin,
    browserName: "chromium",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: ["--disable-background-networking"],
    },
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port ${port}`,
    url: `${origin}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      CI: "1",
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_NO_WARNINGS: "1",
      INTEGRATION_TEST_MODE: "1",
      TEST_FIXTURE: "1",
      OLD_MIKE_V2_BETA2_ENABLED: "1",
      OLD_MIKE_V2_BETA2_FAKE_PROVIDER: "1",
      OLD_MIKE_V2_BETA2_OPENCLAW_ADAPTER_ENABLED: "0",
      OLD_MIKE_V2_BETA2_DURABLE_LOOKUP_AUTHORITY: "0",
      BETA2_DISPOSABLE_DATABASE_URL: process.env.BETA2_DISPOSABLE_DATABASE_URL,
      DATABASE_URL: process.env.DATABASE_URL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: origin,
      REGISTRATION_MODE: "closed",
      ACCOUNT_PROVISIONING_MODE: "admin_only",
      LEGACY_AUTH_ENABLED: "false",
    },
  },
});
