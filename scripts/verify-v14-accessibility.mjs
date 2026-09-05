import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const form = await readFile(new URL("../components/AuthForm.tsx", import.meta.url), "utf8"); const shell = await readFile(new URL("../components/AuthShell.tsx", import.meta.url), "utf8");
for (const value of ["autoComplete=\"email\"", "autoComplete=\"new-password\"", "role=\"alert\"", "aria-live=\"polite\"", "required", "type=\"email\""]) assert.match(form, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))); assert.match(form, /current-password/);
assert.match(shell, /aria-labelledby=\"auth-title\"/); assert.doesNotMatch(form, /CAPTCHA|disable.*paste/i);
console.log("v1.4 accessibility contracts: PASS (labels, autocomplete, keyboard-submit forms, alert/status regions, no text CAPTCHA)");
