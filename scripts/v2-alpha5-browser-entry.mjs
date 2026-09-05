import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const [verifierPath] = process.argv.slice(2);
if (!path.isAbsolute(verifierPath ?? "") || path.basename(verifierPath) !== "verify-v2-alpha5-browser.mjs") throw new Error("ALPHA5_BROWSER_ENTRY_ARGUMENTS_INVALID");
const originalLaunch = chromium.launch.bind(chromium);
chromium.launch = async (...launchArguments) => {
  const browser = await originalLaunch(...launchArguments);
  const originalNewContext = browser.newContext.bind(browser);
  browser.newContext = async (...contextArguments) => {
    const context = await originalNewContext(...contextArguments);
    const originalNewPage = context.newPage.bind(context);
    context.newPage = async (...pageArguments) => {
      const page = await originalNewPage(...pageArguments);
      const originalGoto = page.goto.bind(page);
      page.goto = async (...gotoArguments) => {
        const response = await originalGoto(...gotoArguments);
        await page.waitForFunction(() => {
          const root = document.querySelector("[data-testid='alpha5-workspace']");
          return Boolean(root && Reflect.ownKeys(root).some((key) => typeof key === "string" && key.startsWith("__reactProps")));
        }, undefined, { timeout: 15_000 });
        return response;
      };
      return page;
    };
    return context;
  };
  return browser;
};
await import(pathToFileURL(verifierPath).href);
