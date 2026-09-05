import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const component = await readFile(new URL("../components/GuidedResearchCenter.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
const browser = await readFile(new URL("./verify-mobile-overlay-c2-browser.mjs", import.meta.url), "utf8");

assert.match(component, /type ActiveOverlay = "NONE" \| "MOBILE_NAV" \| "CHAT"/);
assert.match(component, /useState<ActiveOverlay>\("NONE"\)/);
assert.doesNotMatch(component, /const \[mobileNav,/);
assert.doesNotMatch(component, /const \[chatOpen,/);
assert.match(component, /aria-expanded=/);
assert.match(component, /aria-controls="mobile-navigation-overlay"/);
assert.match(component, /aria-controls="project-chat-overlay"/);
assert.match(component, /aria-labelledby="mobile-navigation-title"/);
assert.match(component, /aria-labelledby="project-chat-title"/);
assert.match(component, /role="log"/);
assert.match(component, /inert=/);
assert.doesNotMatch(component, /autoFocus/);
assert.doesNotMatch(component, /visualViewport/);

assert.match(layout, /viewportFit:\s*"cover"/);
assert.match(css, /height:\s*100dvh/);
assert.match(css, /env\(safe-area-inset-top\)/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /overscroll-behavior:\s*contain/);
assert.match(css, /grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)\s+auto/);
assert.match(css, /\.v13-chat-body\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/s);
assert.match(browser, /390[^\n]*844/);
assert.match(browser, /360[^\n]*640/);
assert.match(browser, /1440[^\n]*900/);
assert.match(browser, /axe/);
assert.match(browser, /Escape/);

console.log("MOBILE_OVERLAY_C2_SOURCE_CONTRACT=PASS");
console.log("VISUAL_VIEWPORT_FALLBACK=NOT_REQUIRED_BY_CONTRACT_DVH_TARGETED_TEST_REQUIRED");
